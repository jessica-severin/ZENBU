/* $Id: OSCFileParser.cpp,v 1.226 2019/11/15 04:41:17 severin Exp $ */

/***

NAME - EEDB::Tools::OSCFileParser

SYNOPSIS

DESCRIPTION

a simple SPStream which does nothing and always returns a NULL object

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2013 Jessica Severin RIKEN OSC
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin RIKEN OSC nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

***/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/time.h>
#include <string>
#include <stdarg.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <zlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Tools/OSCFileParser.h>

using namespace std;
using namespace MQDB;

const char*               EEDB::Tools::OSCFileParser::class_name = "EEDB::Tools::OSCFileParser";

//function prototypes
void _eedb_tools_oscfileparser_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::OSCFileParser*)obj;
}
void _eedb_tools_oscfileparser_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Tools::OSCFileParser*)obj)->_xml(xml_buffer);
}


EEDB::Tools::OSC_column::OSC_column() {
  data            = NULL;
  experiment      = NULL;   
  datatype        = NULL;
  colnum          = -1;
  express_total   = 0.0;
  singlemap_total = 0.0;
  mapnorm_total   = 0.0;
}

EEDB::Tools::OSC_column::~OSC_column() {
}

string  EEDB::Tools::OSC_column::display_desc() {
  char buffer[2048];
  string  str;

  unsigned int max_origname = 0;
  unsigned int max_name = 0;

  string name = "";
  int len = (max_origname) - orig_colname.size();
  while(len>0) {len--; name +=" ";}
  name += orig_colname + string(" => ") + colname;
  
  len = max_name - colname.size(); while(len>0) {len--; name +=" ";}
  snprintf(buffer, 2000, "   col[%3d] %10s  ", colnum, osc_namespace().c_str());
  str += buffer;
  str += name;
  
  string dtype;
  if(datatype) { dtype = datatype->type(); }
  
  if(oscnamespace == EXPRESSION) {
    if(!description.empty()) { str += " :: " + description; }
    str += "\n";
    
    len = 20 - dtype.size();
    while(len>0) {len--; dtype +=" ";}
    snprintf(buffer, 2000, "%18s %s %s", "", dtype.c_str(), experiment->display_desc().c_str());
    str += buffer;
  }
  
  if((oscnamespace == EDGE) && (datatype)) {
    if((colname == "edgef1_name") || (colname == "edgef2_name")) {
      str += " ["+dtype + "]";
    }
    if(colname == "edge_weight") {
      str += " ["+dtype + "]";
    }
  }
  
  if(!description.empty()) { str += " :: " + description; }
  
  return str;
}


void  EEDB::Tools::OSC_column::xml(string &xml_buffer) {
  char buffer[2048];
  snprintf(buffer, 2040, "<column num=\"%d\" name=\"%s\" namespace=\"%s\"",
        colnum, colname.c_str(), osc_namespace().c_str());
  xml_buffer.append(buffer);
  
  if((oscnamespace == EXPRESSION) && datatype && experiment) { 
    snprintf(buffer, 2040, " datatype=\"%s\" expid=\"%s\"", datatype->type().c_str(), experiment->db_id().c_str());
    xml_buffer.append(buffer);    
  }

  if((oscnamespace == EDGE) && datatype) {
    snprintf(buffer, 2040, " datatype=\"%s\"", datatype->type().c_str());
    xml_buffer.append(buffer);
    if(!expname.empty()) {
      snprintf(buffer, 2040, " expname=\"%s\"", expname.c_str());
      xml_buffer.append(buffer);
    }
  }

  if(!orig_colname.empty() && (orig_colname!=colname)) {
    snprintf(buffer, 2040, " orig_colname=\"%s\"", orig_colname.c_str());
    xml_buffer.append(buffer);
  }

  xml_buffer.append(">");

  if(!description.empty()) { xml_buffer += "<description>"+description+"</description>"; }

  if(oscnamespace == EXPRESSION) { 
    snprintf(buffer, 2040, "<totals sum=\"%f\" singlemap=\"%f\" mapnorm=\"%f\"/>", express_total, singlemap_total, mapnorm_total);
    xml_buffer.append(buffer);
  }
  xml_buffer.append("</column>\n");
}


void EEDB::Tools::OSC_column::init_from_xmlnode(void *xml_node) {
  //constructor using a rapidxml node
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "column") { return; }
  
  if((attr = root_node->first_attribute("num"))) {
    colnum = strtol(attr->value(), NULL, 10);
  }
  if((attr = root_node->first_attribute("name"))) {
    colname = attr->value();
    orig_colname = attr->value();
  }
  if((attr = root_node->first_attribute("orig_colname"))) {
    orig_colname = attr->value();
  }

  if((attr = root_node->first_attribute("namespace"))) {
    oscnamespace = IGNORE;
    if(strcmp(attr->value(), "feature")==0) { oscnamespace = FEATURE; }
    if(strcmp(attr->value(), "genomic")==0) { oscnamespace = GENOMIC; }
    if(strcmp(attr->value(), "metadata")==0) { oscnamespace = METADATA; }
    if(strcmp(attr->value(), "expression")==0) { oscnamespace = EXPRESSION; }
    if(strcmp(attr->value(), "edge")==0) { oscnamespace = EDGE; }
  }
    
  if((node = root_node->first_node("description")) != NULL) { description = node->value(); }
  
  if(oscnamespace == EXPRESSION) {
    experiment      = NULL;
    data            = NULL;
    express_total   = 0.0;
    singlemap_total = 0.0;
    mapnorm_total   = 0.0;
    
    if((attr = root_node->first_attribute("datatype"))) {
      datatype = EEDB::Datatype::get_type(attr->value());
    }
    if((attr = root_node->first_attribute("expid"))) {
      expname = attr->value();  //placeholder
    }
    if((node = root_node->first_node("totals")) != NULL) { 
      if((attr = node->first_attribute("sum")))       { express_total = strtod(attr->value(), NULL); }
      if((attr = node->first_attribute("singlemap"))) { singlemap_total = strtod(attr->value(), NULL); }
      if((attr = node->first_attribute("mapnorm")))   { mapnorm_total = strtod(attr->value(), NULL); }
      //fprintf(stderr, "reading totals from XML sum:%f single:%f map:%f\n", express_total, singlemap_total, mapnorm_total);
    }
  }
  
  if(oscnamespace == EDGE) {
    data            = NULL;
    datatype        = NULL;

    if((attr = root_node->first_attribute("datatype"))) {
      datatype = EEDB::Datatype::get_type(attr->value());
    }
    if((attr = root_node->first_attribute("expname"))) {
      expname = attr->value();  //placeholder and for future-proofing
    }
  }
  
}


//////////////////////////////////////////////////////////////////////////////

//initialize global variables
bool    EEDB::Tools::OSCFileParser::_load_source_metadata = true;
bool    EEDB::Tools::OSCFileParser::_sparse_expression = true;
bool    EEDB::Tools::OSCFileParser::_sparse_metadata = false;


EEDB::Tools::OSCFileParser::OSCFileParser() {
  init();
}

EEDB::Tools::OSCFileParser::~OSCFileParser() {
}

void EEDB::Tools::OSCFileParser::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::Tools::OSCFileParser::class_name;
  _funcptr_delete            = _eedb_tools_oscfileparser_delete_func;
  _funcptr_xml               = _eedb_tools_oscfileparser_xml_func;
  _funcptr_simple_xml        = _eedb_tools_oscfileparser_xml_func;

  _debug_level      = 3;
  _create_source_id = 2;
  
  _idx_asm      = -1;  //if assembly is in a column
  _idx_chrom    = -1;
  _idx_start    = -1;
  _idx_end      = -1;
  _idx_strand   = -1;
  _idx_mapcount = -1;
  _idx_demux_fsrc = _idx_demux_exp = -1;
  _idx_name = _idx_fid = _idx_score = _idx_fsrc_category = _idx_fsrc_id = -1;
  _idx_bed_block_count = _idx_bed_block_sizes = _idx_bed_block_starts = -1;
  _idx_bed_thickstart = _idx_bed_thickend = -1;
  _idx_sam_flag = _idx_cigar = _idx_sam_opt = -1;    
  _idx_ctg_cigar = _idx_gff_attributes = -1;
  _idx_edge_f1 = _idx_edge_f2 = -1;

  _primary_feature_source = NULL;
  _primary_edge_source = NULL;
  _subfeature_edgesource  = NULL;
  _default_assembly       = NULL;
  _peer = NULL;
  _segment_mode           = OSCTAB;
  _coordinate_system      = UNDEF;
  
  _parameters.clear();
  _column_descriptions.clear();
  _columns.clear();
  
  /*  maybe need to do checks for reinit, but probably best never to reinit
  vector<EEDB::DataSource*>               _data_sources;
  EEDB::FeatureSource*                    _primary_feature_source;
  map<string, EEDB::FeatureSource*>       _category_featuresources;
  EEDB::EdgeSource*                       _subfeature_edgesource;
  EEDB::Assembly*                         _default_assembly;
  map<string, EEDB::Assembly*>            _assemblies;
  EEDB::Peer*                             _peer;
  */
  
  /*
  $self->{'_inputfile'} = undef;
  $self->{'_ext_header'} = undef;
  $self->{'_input_file_ext'} = undef;

  $self->{'_allow_aliases'}  = 1;
  
  $self->{'_fsrc'} = undef;
  $self->{'_header_cols'} = [];
  $self->{'_header_names'} = {};
  $self->{'_experiment_hash'} = {};
  $self->{'_variable_columns'} = [];
  $self->{'_expression_dataypes'} = {};
  $self->{'_header_data'} = "";
  $self->{'_has_subfeatures'}=0;

  $self->{'_default_mapcount'} = undef;
  $self->{'_skip_metadata'} = 0;
  
  $self->{'_filter_datatypes'}   = undef;
  $self->{'_filter_experiments'} = undef;
  */
  
}

void EEDB::Tools::OSCFileParser::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Tools::OSCFileParser::display_desc() {
  char buffer[2048];
  string  str = "OSCFileParser [" + _parameters["_inputfile"] + "]\n";
  
  unsigned int max_origname = 0;
  unsigned int max_name = 0;
  for(unsigned int i=0; i < _columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);
    if(colobj->orig_colname.size() > max_origname) { max_origname = colobj->orig_colname.size(); }
    if(colobj->colname.size() > max_name)          { max_name = colobj->colname.size(); }
  }

  bool has_expression=false;
  for(unsigned int i=0; i < _columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);

    string name = ""; 
    int len = (max_origname) - colobj->orig_colname.size(); 
    while(len>0) {len--; name +=" ";}
    name += colobj->orig_colname + string(" => ") + colobj->colname; 
    
    len = max_name - colobj->colname.size(); while(len>0) {len--; name +=" ";}
    snprintf(buffer, 2000, "   col[%3d] %10s  ", i, colobj->osc_namespace().c_str());
    str += buffer;
    str += name;

    //if(!colobj->description.empty()) { str += " :: " + colobj->description; }
    //str += "\n";

    if(colobj->oscnamespace == EXPRESSION) {
      if(!colobj->description.empty()) { str += " :: " + colobj->description; }
      str += "\n";

      string datatype = colobj->datatype->type();
      len = 20 - datatype.size(); 
      while(len>0) {len--; datatype +=" ";}
      snprintf(buffer, 2000, "%18s %s %s", "", datatype.c_str(), colobj->experiment->display_desc().c_str());
      str += buffer;
      has_expression = true;
    }

    if((colobj->oscnamespace == EDGE) && (colobj->datatype)) { 
      string datatype = colobj->datatype->type();
      //string strpad;
      //len = 20 - datatype.size(); 
      //while(len>0) {len--; strpad += " ";}
      //snprintf(buffer, 2000, "%18s %s %s\n", colobj->colname.c_str(), datatype.c_str(), colobj->experiment->display_desc().c_str());
      //snprintf(buffer, 2000, "%18s %s\n", colobj->colname.c_str(), datatype.c_str());
      //str += buffer;

      //for(unsigned i=0; i<22; i++) { str += " "; }
      if((colobj->colname == "edgef1_name") || (colobj->colname == "edgef2_name")) {
        //str += strpad + "["+datatype + "] mdkey"; 
        //str += "                      mdkey["+datatype + "]"; 
        str += " ["+datatype + "]"; 
      }
      if(colobj->colname == "edge_weight") {
        //str += strpad + "["+datatype + "] weight"; 
        //str += "                      weight["+datatype + "]"; 
        str += " ["+datatype + "]"; 
      }
      //str += "\n";
    }

    if(!colobj->description.empty()) { str += " :: " + colobj->description; }
    str += "\n";

    /*
    if(($colobj->{'namespace'} == "expression") and 
       (_do_mapnormalize) and 
       (($colobj->{'datatype'} == "raw") or ($colobj->{'datatype'} == "tagcount")) and
       ($colobj->{'colname'} != "eedb:mapcount")) {
      printf("%22s %s %20s  %s\n", "", $name, "singlemap_tagcnt", $colobj->{'experiment'}->display_desc);
      printf("%22s %s %20s  %s\n", "", $name, "singlemap_tpm", $colobj->{'experiment'}->display_desc);
      printf("%22s %s %20s  %s\n", "", $name, "mapnorm_tagcnt", $colobj->{'experiment'}->display_desc);
      printf("%22s %s %20s  %s\n", "", $name, "mapnorm_tpm", $colobj->{'experiment'}->display_desc);
    }
    */
  }

  if(_coordinate_system == EDGES) { 
    str += "-- EDGE-based file\n";
    return str;
  }
  
  if(_parameters["genome_assembly"].empty() && (_idx_asm==-1)) { 
    str += "-- ERROR no genome assembly specified\n"; 
    str += "   must specify either ##ParameterValue[genome_assembly] or an [eedb:genome] column\n";
  } 
  else {
    str += "-- default genome : [" + _parameters["genome_assembly"]+ "]\n"; 
  }
  if(_coordinate_system == UNDEF &&(_parameters["genome_assembly"]!="non-genomic")) { 
    str += "-- FAILED genome-coordinate and edge namespace checks\n";
    if(_idx_chrom == -1) { str += "   ERROR: you are missing a [chrom] column\n"; }
    if(_idx_start == -1) { str += "   ERROR: you are missing a [start.0base] or [start.1base] column\n"; }
    if(_idx_edge_f1 == -1) { str += "   ERROR: you are missing a [edgef1] column\n"; }
    if(_idx_edge_f2 == -1) { str += "   ERROR: you are missing a [edgef2] column\n"; }
  }
  if((_coordinate_system == BASE0) || (_coordinate_system == BASE1)) {
    if(_coordinate_system == BASE0) { str += "-- has 0base genome-coordinate namespace\n"; }
    if(_coordinate_system == BASE1) { str += "-- has 1base genome-coordinate namespace\n"; }
    if((_idx_end==-1) && (_idx_cigar==-1)) { 
      str += "   WARNING: you have not specified an [end] or [sam_cigar] column so all features will be 1base long\n";
    }
    if((_idx_strand==-1) && (_idx_sam_flag==-1)) { 
      str += "   WARNING: you have not specified a [strand] or [sam_flag] column so all features will be strandless\n";
    }
    if(has_expression) { str += "-- expression data present\n"; }
    else { str += "-- WARNING no expression data present\n"; }
  }

  //if($self->{'_has_subfeatures'}) { print("-- has block subfeature structure\n"); }
  //if(_do_mapnormalize) { print("-- can perform simple map normalization\n"); }
  //if(_idx_mapcount != -1) { print(" -- activate simple mapnormalization\n"); }
  //if(has_expression) { str += "-- expression data present\n"; }
  //else { str += "-- WARNING no expression data present\n"; }
  
  return str;
}

string EEDB::Tools::OSCFileParser::error_message() {
  string str;
  
  if(_coordinate_system == EDGES) {
    return "";
  }
  
  if(_coordinate_system == UNDEF) {
    if((_idx_edge_f1 != -1) || (_idx_edge_f2 != -1)) {
      str = "failed column checks: appears to be edge file but ";
      if(_idx_edge_f1 == -1) { str += "missing [edgef1] column "; }
      if(_idx_edge_f2 == -1) { str += "missing [edgef2] column "; }
      return str;
    }
    if((_idx_chrom != -1) || (_idx_start != -1) || (_idx_end != -1) || (_idx_strand != -1)) {
      str = "failed column checks: appears to be genomic file but ";
      if(_idx_chrom == -1)  { str += "missing [eedb:chrom] column; "; }
      if(_idx_start == -1)  { str += "missing [eedb:start.0base] or [eedb:start.1base] column; "; }
      if(_idx_end == -1)    { str += "missing [eedb:end] column; "; }
      if(_idx_strand == -1) { str += "missing [eedb:strand] column; "; }
      return str;
    }
  }
  
  if((_coordinate_system == BASE0) || (_coordinate_system == BASE1)) {
    if(_parameters["genome_assembly"].empty() && (_idx_asm==-1)) {
      return "no genome assembly is defined";
    }
    //if((_idx_end==-1) && (_idx_cigar==-1)) {
    //  str += "   WARNING: you have not specified an [end] or [sam_cigar] column so all features will be 1base long\n";
    //}
    //if((_idx_strand==-1) && (_idx_sam_flag==-1)) {
    // str += "   WARNING: you have not specified a [strand] or [sam_flag] column so all features will be strandless\n";
    //}
    //if(has_expression) { str += "-- expression data present\n"; }
    //else { str += "-- WARNING no expression data present\n"; }
  }
  return "";
}


void EEDB::Tools::OSCFileParser::_xml(string &xml_buffer) {
  char    buffer[2048];
  xml_buffer.append("<oscfile>\n");
  
  //parameters
  map<string,string>::iterator    p_it;
  xml_buffer.append("  <parameters>\n");  
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    if((*p_it).first.empty()) { continue; }
    if((*p_it).second.empty()) { continue; }
    
    xml_buffer += "    <" + (*p_it).first + ">";
    xml_buffer += (*p_it).second;
    xml_buffer += "</" + (*p_it).first + ">\n";

    //snprintf(buffer, 2040, "    <%s>%s</%s>\n", (*p_it).first.c_str(), (*p_it).second.c_str(), (*p_it).first.c_str());
    //xml_buffer.append(buffer);
  }
  xml_buffer.append("  </parameters>\n");

  //sources
  xml_buffer.append("  <sources>\n");  
  vector<EEDB::DataSource*>::iterator  s_it;
  for(s_it=_data_sources.begin(); s_it!=_data_sources.end(); s_it++) {
    (*s_it)->xml(xml_buffer);
  }
  xml_buffer.append("  </sources>\n");  
  
  //columns
  snprintf(buffer, 2040, "  <columns count=\"%ld\">\n", _columns.size());
  xml_buffer.append(buffer);
  for(unsigned int i=0; i < _columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);
    
    colobj->xml(xml_buffer);
  }
  xml_buffer.append("  </columns>\n");

  //peer
  if(_peer) { _peer->xml(xml_buffer); }  

  xml_buffer.append("\n</oscfile>\n");
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// external API methods to get and set attributes
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Tools::OSCFileParser::clear_parameter(string tag) {
  if(tag.empty()) { return; }
  _parameters[tag].clear();
}


void  EEDB::Tools::OSCFileParser::set_parameter(string tag, string value) {
  if(tag.empty()) { return; }
  if(value.empty()) { return; }

  //convert aliases to official names
  if(tag == "genome_assemblies")    { tag = "genome_assembly"; }
  if(tag == "genome")               { tag = "genome_assembly"; }
  if(tag == "assembly_name")        { tag = "genome_assembly"; }
  if(tag == "assembly")             { tag = "genome_assembly"; }

  if(tag == "platform")             { tag = "eedb:platform"; }

  if(tag == "oneline-onecount")     { tag = "singlemap_sequencetags"; }
  if(tag == "single_sequencetags")  { tag = "singlemap_sequencetags"; }
  if(tag == "owner_openid")         { tag = "_owner_identity"; }
  if(tag == "owner_identity")       { tag = "_owner_identity"; }
  if(tag == "input_file")           { tag = "_inputfile"; }
  if(tag == "inputfile")            { tag = "_inputfile"; }

  if(tag == "build_feature_name_index")  { tag = "_build_feature_name_index"; }


  //do not allow later parameters to over-write previous parameters
  if(_parameters.find(tag) != _parameters.end()) { return; }

  _parameters[tag] = value;
}


string  EEDB::Tools::OSCFileParser::get_parameter(string tag) {
  if(_parameters.find(tag) == _parameters.end()) { return ""; }
  return _parameters[tag];
}


void EEDB::Tools::OSCFileParser::_transfer_parameters_to_source(EEDB::DataSource* source) {
  map<string,string>::iterator    p_it;
  EEDB::MetadataSet               *mdset;
  
  if(source==NULL) { return; }
  mdset = source->metadataset();
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    if((*p_it).first == "display_name") { continue; }
    if((*p_it).first == "eedb:display_name") { continue; }
    
    if(((*p_it).first == "eedb:description") or ((*p_it).first == "description")) {
      if(mdset->has_metadata_like("description", "")) { continue; }
      if(mdset->has_metadata_like("eedb:description", "")) { continue; }
    }
    
    mdset->add_tag_data((*p_it).first, (*p_it).second);
    if((*p_it).first == "genome_assembly") {
      mdset->add_tag_symbol("eedb:assembly_name", (*p_it).second);
    }
  }
  if(source->classname() == EEDB::FeatureSource::class_name) {
    mdset->add_tag_symbol("eedb:category", ((EEDB::FeatureSource*)source)->category());
  }
  if(source->classname() == EEDB::Experiment::class_name) {
    mdset->add_tag_symbol("eedb:platform", ((EEDB::Experiment*)source)->platform());
  }
  
  mdset->add_tag_data("eedb:name", source->name());  //allows for keyword extraction later

  EEDB::Metadata *md = mdset->find_metadata("gff_mdata", "");
  if(md) { mdset->add_from_gff_attributes(md->data()); }

  //mdset->extract_keywords();
}


void  EEDB::Tools::OSCFileParser::set_datasource(EEDB::DataSource* source) {
  if(source==NULL) { return; }
  //printf("OSCFileParser::set_datasource %s\n", source->display_desc().c_str());
  if(source->classname() == EEDB::FeatureSource::class_name) {
    EEDB::FeatureSource* fsrc = (EEDB::FeatureSource*)source;
    if(source->primary_id() == 1) { 
      _primary_feature_source = fsrc; 
    }
    _category_featuresources[fsrc->category()] = fsrc;
    if(fsrc->category() == "exon") { _category_featuresources["block"] = fsrc; }
  }
  if(source->classname() == EEDB::EdgeSource::class_name) {
    EEDB::EdgeSource* esrc = (EEDB::EdgeSource*)source;
    if(esrc->category() == "subfeature") { _subfeature_edgesource = esrc; }
    if(esrc->primary_id() == 1) { _primary_edge_source = esrc; }
  }
  _data_sources.push_back(source);
  _sources_cache[source->db_id()] = source;
  if(source->primary_id() >= _create_source_id) { _create_source_id = source->primary_id()+1; }
}


void  EEDB::Tools::OSCFileParser::set_peer(EEDB::Peer* peer) {
  _peer = peer;
}


/***** assembly management section ******/

void  EEDB::Tools::OSCFileParser::set_assembly(EEDB::Assembly* assembly) {
  //first one set becomes the default assembly if not previously defined
  if(assembly==NULL) { return; }
  //printf("set assembly %s\n", assembly->display_desc().c_str());
  _assemblies[assembly->assembly_name()] = assembly;

  if(_default_assembly==NULL) {
    _default_assembly = assembly;
    _parameters["genome_assembly"] = assembly->assembly_name();
  }
}


string  EEDB::Tools::OSCFileParser::default_assembly_name() {
  if(_parameters.find("genome_assembly") != _parameters.end()) {
    return _parameters["genome_assembly"];
  }
  return "";
}


EEDB::Assembly*  EEDB::Tools::OSCFileParser::default_assembly() {
  if(_default_assembly != NULL) { return _default_assembly; }
  
  if(_parameters.find("genome_assembly") != _parameters.end()) {
    _default_assembly = new EEDB::Assembly;
    _default_assembly->assembly_name(_parameters["genome_assembly"]);
  }
  return _default_assembly;
}


//sub coordinate_system {  return $self->{'_coordinate_system'}; }


string EEDB::Tools::OSCFileParser::oscheader() {
  //converts parameters and columns into oscheader formated data
  
  map<string,string>::iterator    p_it;
  vector<OSC_column>::iterator    c_it;
  string                          header;
  
  //maybe do non-parameters first (contact info)
  
  //then parameters
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    header += "##ParameterValue[" + (*p_it).first + "] = "+ (*p_it).second + "\n";
  }
  
  //then column descriptions
  for(c_it=_columns.begin(); c_it!=_columns.end(); c_it++) {
    if((*c_it).description.empty()) { continue; }
    header += "##ColumnVariable[" + (*c_it).colname + "] = "+ (*c_it).description + "\n";
  }

  //then columns
  for(c_it=_columns.begin(); c_it!=_columns.end(); c_it++) {
    if(c_it != _columns.begin()) { header += "\t"; }
    header += (*c_it).colname;
  }
  header += "\n";

  return header;
}


void EEDB::Tools::OSCFileParser::get_genomic_column_indexes(int &chrom_idx, int &start_idx, int &end_idx, int &strand_idx) {
  chrom_idx  = _idx_chrom;
  start_idx  = _idx_start;
  end_idx    = _idx_end;
  strand_idx = _idx_strand;
}


vector<EEDB::Tools::OSC_column*>  EEDB::Tools::OSCFileParser::get_expression_columns() {
  vector<EEDB::Tools::OSC_column*>   exp_columns;

  for(unsigned int i=0; i<_columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);
    if(colobj->oscnamespace == EXPRESSION) {
      exp_columns.push_back(colobj);
    }
  }
  return exp_columns;
}


/*
sub get_mapcount_index {
  my $self = shift;
  return _idx_mapcount;
}

sub column_records {
  my $self = shift;
  //pseudo hash/object with these key-attributes
    //colname : 
    //orig_colname :
    //colnum :
    //namespace => enum(id, metadata, genomic, expression)
    //datatype         **only if expression
    //expname          **only if expression
    //total            **only if expression
    //singlemap_total  **only if expression and mapnormalize
    //mapnorm_total    **only if expression and mapnormalize
    //display_name     **only if expression
    //experiment       **only if expression
  return $self->{'_header_cols'};
}

sub input_file_ext {
  my $self = shift;
  if($self->{'_input_file_ext'}) { return $self->{'_input_file_ext'}; }
  return "";
}

*/


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// initialization / setup methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


bool  EEDB::Tools::OSCFileParser::init_from_file(string filename) {
  _columns.clear();

  //fprintf(stderr, "OSCFileParser::init_from_file [%s]\n", filename.c_str());
  _parameters["_inputfile"] = filename;
  
  if(_parameters.find("filetype") == _parameters.end()) {
    //no specific filetype parameter specified so extract from filename
    string extension;    
    size_t strpos = filename.rfind(".gz");
    if(strpos!=string::npos) { filename.resize(strpos); }
    strpos = filename.rfind(".");
    if(strpos!=string::npos) {
      extension = filename.substr(strpos+1);
      filename.resize(strpos);
    }
    if(extension.empty()) { return false; }
    _parameters["filetype"] = extension;
  }
  //fprintf(stderr, "  filetype [%s]\n", _parameters["filetype"].c_str());
  
  // post processing
  string ftype = _parameters["filetype"];
  if(ftype == "bed") {
    return init_from_bed_file(_parameters["_inputfile"]);
  } else if(ftype == "osc") {
    return init_from_oscheader_file(_parameters["_inputfile"]);
  } else if(ftype == "sam") {
    return init_from_sam_file(_parameters["_inputfile"]);
  } else if((ftype == "gff") || (ftype == "gtf") || (ftype == "gff2") || (ftype == "gff3")) {
    return init_from_gff_file(_parameters["_inputfile"]);
  } else if(ftype == "xml") {
    return init_from_xml_file(_parameters["_inputfile"]);
  }
  return false;
}


bool  EEDB::Tools::OSCFileParser::init_from_oscheader_file(string path) {
  _columns.clear();
  _parameters["_inputfile"] = path;
  
  //fprintf(stderr, "OSCFileParser::init_from_oscheader_file [%s]\n", path.c_str());
  //
  //use gzread() and read 1MB of data to do initialization 
  int    line_count=0;
  int    bufsize = 1024*1024;
  char   *p1, *p2, *p3, *line;
  
  char*  buffer = (char*)malloc(bufsize+3);
  bzero(buffer, bufsize+3);  //ensures there are \0 characters at the end

  //first pass for global parameters and column line
  //fprintf(stderr, "  first pass for global parameters and column line\n");
  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) { return false; }  //failed to open
  while(gzgets(gz, buffer, bufsize) != NULL) {
    line = buffer;
    line_count++;
    p1=buffer;
    while((*p1 != '\0')&&(*p1 != '\n')) { p1++; }
    *p1 = '\0';
    if(p1 == buffer) { continue; } //skip empty lines
    
    if(strncmp(line, "##", 2) == 0) {
      _parse_OSCheader_metadata_line(line);
    } else if(strncmp(line, "#", 1) == 0) {
      continue;  //skip single # lines as comments
    } else {
      //this is first line after ## so these are the column descriptions
      //fprintf(stderr, "columns line [%s]\n", line);
      vector<string>  columns;
      p3=line;
      while(*p3 != '\0') {
        p2=p3;  //beginning of new column
        while((*p3 != '\0') && (*p3 != '\t') && (*p3 != '\r')) { p3++; }
        if(*p3 != '\0') { //not finished yet
          *p3 = '\0';  //null terminate column
          p3++;
        }
        while(*p2== ' ') { p2++; } //remove leading spaces, is null terminated so no worries
        char *p4 = p3-2; //last char before \0
        while((*p4== ' ') && (p4>p2)) { *p4 = '\0'; p4--; } //remove trailing spaces, move null termination
        columns.push_back(string(p2));
      }
      _parse_column_names(columns);
      break;  //done
    }
  }
  
  //second pass for ExperimentMetadata  
  //fprintf(stderr, "  second pass for ExperimentMetadata\n");
  gzrewind(gz);
  while(gzgets(gz, buffer, bufsize) != NULL) {
    p1=buffer;
    while((*p1 != '\0')&&(*p1 != '\n')) { p1++; }
    *p1 = '\0';
    if(p1 == buffer) { continue; } //skip empty lines
    if(strncmp(buffer, "##", 2) == 0) {
      _parse_OSCheader_experiment_metadata(buffer);
    } else {
      break; //done
    }
  }
  
  gzclose(gz);
  free(buffer);

  //if not columns are defined then the Parser is invalid
  if(_columns.empty()) { return false; }
  
  
  //set the datatypes of the primary feature source
  for(unsigned int i=0; i<_columns.size(); i++) {
    OSC_column *colobj = &(_columns[i]);    
    if(colobj->datatype != NULL) {
      //fprintf(stderr, "set featuresource datatype [%s]\n", colobj->datatype->type().c_str());
      if((_coordinate_system == BASE0) || (_coordinate_system == BASE1)) {
        primary_feature_source()->add_datatype(colobj->datatype);
      }
      if(_coordinate_system == EDGES) {
        primary_edge_source()->add_datatype(colobj->datatype);
      }
      //primary_feature_source()->add_datatype(colobj->datatype);
      //primary_feature_source()->metadataset()->add_tag_symbol("eedb:expression_datatype", colobj->datatype->type() + "_pm");
    }
  }
  
  
  /*
  if($self->{'_one_line_one_expression_count'}) {
    my $colname = "exp.tagcount.";
    if($self->{'_default_experiment_name'}) { $colname .= $self->{'_default_experiment_name'}; }
    elsif($self->{'_exp_prefix'}) { $colname .= $self->{'_exp_prefix'}; }
    else { $colname .= "experiment"; } 
    my $colobj = $self->_convert_column_name_aliases($colname);
    if($self->{'_description'}) { 
      $colobj->{'description'} = $self->{'_description'};
    } else {
      $colobj->{'description'} = "single sequence tags, no redundancy compression, tagcount=1 for every tag";
    }
    $self->{'_header_data'} .= sprintf("////ColumnVariable[%s] = %s\n", $colname, $colobj->{'description'});
    push @columns, $colname;
  }
  if($self->{'_default_mapcount'}) {
    my $colname = "exp.mapcount.";
    if($self->{'_default_experiment_name'}) { $colname .= $self->{'_default_experiment_name'}; }
    elsif($self->{'_exp_prefix'}) { $colname .= $self->{'_exp_prefix'}; }
    else { $colname .= "experiment"; } 
    $colname .= "_mapcount";
    my $colobj = $self->_convert_column_name_aliases($colname);
    $colobj->{'description'} = "multi-map count";
    $self->{'_header_data'} .= sprintf("////ColumnVariable[%s] = %s\n", $colname, $colobj->{'description'});;
    push @columns, $colname;
  }
 */
  //fprintf(stderr, "  finished OSCFileParser::init_from_oscheader_file\n");

 return true;
}


void  EEDB::Tools::OSCFileParser::_parse_OSCheader_metadata_line(char* line) {
  if(line==NULL) { return; }
  //printf("oscheader_line [%s]\n", line);

  if(strstr(line, "##ColumnVariable[") == line) {
    char* colname = line + 17;
    char* p2 = strstr(colname, "]");
    if(p2==NULL) { return; }  //malformed
    *p2 = '\0';
    p2++;
    if(*p2 == '\0') { return; } //incomplete
    char *p3 = strstr(p2, "=");
    if(p3==NULL) { return; } //malformed
    p3++;
    while(*p3==' ') { p3++; }
    
    //printf("  column [%s] = [%s]\n", colname, p3);
    _column_descriptions[colname] = p3;
  }
  if(strstr(line, "##ParameterValue[") == line) {
    char* tag = line + 17;
    char* p2 = strstr(tag, "]");
    if(p2==NULL) { return; }  //malformed
    *p2 = '\0';
    p2++;
    if(*p2 == '\0') { return; } //incomplete
    char *p3 = strstr(p2, "=");
    if(p3==NULL) { return; } //malformed
    p3++;
    while(*p3==' ') { p3++; }    
    set_parameter(tag, p3);
  }
}


void  EEDB::Tools::OSCFileParser::_parse_OSCheader_experiment_metadata(char* line) {
  if(line==NULL) { return; }
  //printf("oscheader_line [%s]\n", line);
    
  if(strstr(line, "##ExperimentMetadata[") == line) {
    char* p2 = line;

    char *expname = strstr(p2, "[");
    if(expname==NULL) { return; }  //malformed
    expname++;
    p2 = strstr(expname, "]");
    if(p2==NULL) { return; }  //malformed
    *p2 = '\0';
    p2++;
    if(*p2 == '\0') { return; } //incomplete

    char *tag = strstr(p2, "[");
    if(tag==NULL) { return; }  //malformed
    tag++;
    p2 = strstr(tag, "]");
    if(p2==NULL) { return; }  //malformed
    *p2 = '\0';
    p2++;
    if(*p2 == '\0') { return; } //incomplete
    
    char *value = strstr(p2, "=");
    if(value==NULL) { return; } //malformed
    value++;
    while(*value==' ') { value++; }

    //fprintf(stderr, "ExperimentMetadata [%s] [%s] = %s\n", expname, tag, value);
    
    /*
    my $fullname = $exp_name;
    $fullname =~ s/\s/_/g;
    if($self->{'_exp_prefix'} and (index($fullname, $self->{'_exp_prefix'})!=0)) { $fullname = $self->{'_exp_prefix'} .'_'. $fullname; }
    */
    for(unsigned int i=0; i<_columns.size(); i++) {
      OSC_column *colobj = &(_columns[i]);
      if(colobj->experiment == NULL) { continue; }
      EEDB::Experiment *experiment = colobj->experiment;
      if(experiment->name() == expname) {      
        if(strcmp(tag, "eedb:series_name")==0)  { 
          experiment->series_name(value);
        }
        if(strcmp(tag, "eedb:series_point")==0) { 
          long int point = strtol(value, NULL, 10);
          experiment->series_point(point);
        }
        if(strcmp(tag, "eedb:display_name")==0) { 
          experiment->metadataset()->remove_metadata_like("display_name", ""); 
          experiment->metadataset()->remove_metadata_like("eedb:display_name", ""); 
        }
        if(strcmp(tag, "description")==0) { 
          experiment->metadataset()->remove_metadata_like("description", ""); 
          experiment->metadataset()->remove_metadata_like("eedb:description", ""); 
        }
        experiment->metadataset()->add_tag_data(tag, value);
        experiment->metadataset()->extract_keywords();
      }
    }
  }
}


/*
sub _parse_OSCheader_metadata_line {
 my $self = shift;
 my $line = shift;
 
 unless($line =~ /^\#\#(.*)/) { return ""; }
 $line = $1;
 #print("parseheader :: ", $line, "\n");
 
 if($line =~ /ColumnVariable\[(.+)\]\s*\=\s*(.*)/) {
   my $colname = $1;
   my $desc = $2;
   my $colobj = $self->_create_colobj_by_name($colname);
   $colobj->{'description'} = $desc;
   $line = sprintf("##ColumnVariable[%s] = %s", $colobj->{'colname'}, $desc);
   return $line;
 }
 elsif($line =~ /ParameterValue\[(.+)\]\s*\=\s*(.*)/) {
   my $param_type  = $1;
   my $param_value = $2;
   
   if($self->{'_allow_aliases'}) {
     if($param_type eq "genome_assemblies") { $param_type = "genome_assembly"; }
     if($param_type eq "genome")            { $param_type = "genome_assembly"; }
   }
   
   if($param_type eq "genome_assembly") { 
     $self->{'_assembly_name'} = $param_value;  
     $self->{'_header_metadataset'}->add_tag_symbol("assembly_name", $self->{'_assembly_name'});
   }
   if($param_type eq "description") {
     if(!($self->{'_description'})) { $self->{'_description'} = $param_value; }
     return undef; #do not add to general metadata or output header
   }
   if($param_type eq "eedb:display_name") {
     if(!($self->{'_display_name'})) { $self->{'_display_name'} = $param_value; }
     return undef; #do not add to general metadata or output header
   }
   
   #next are un-official names useful for eeDB
   if($param_type eq "platform") { $param_type = "eedb:platform" };
   if($param_type eq "eedb:platform") {
     $self->{'_platform'} = $param_value; 
     $self->{'_header_metadataset'}->add_tag_symbol("eedb:platform",  $param_value);
     $line = sprintf("##ParameterValue[%s] = %s", $param_type, $param_value);
     return $line;
   }
   if($param_type eq "experiment_name") {
     $self->{'_exp_prefix'} = $param_value; 
   }
   if($param_type eq "experiment_prefix") {
     $self->{'_exp_prefix'} = $param_value; 
   }
   if($param_type eq "experiment_seriespoint") {
     $self->{'_default_experiment_seriespoint'} = $param_value; 
   }
   if($param_type eq "score_as_expression") {
     if(!defined($self->{'_score_as_expression'})) {
       $self->{'_score_as_expression'} = $param_value;
     }
     return $line;
   }
   if(($param_type =~ "oneline-onecount") or ($param_type eq "single_sequencetags")) {
     $self->{'_one_line_one_expression_count'} = 1;
     return undef;
   }
   if($param_type =~ "default_mapcount") {
     $self->{'_default_mapcount'} = $param_value;
     return undef;
   }
   
   $line = sprintf("##ParameterValue[%s] = %s", $param_type, $param_value);
   if($param_value =~ /\s/) {
     my $md = $self->{'_header_metadataset'}->add_tag_data($param_type, $param_value);
     $self->{'_header_metadataset'}->merge_metadataset($md->extract_keywords);
   } else {
     $self->{'_header_metadataset'}->add_tag_symbol($param_type, $param_value);
   }
   return $line;
 } elsif($line =~ /ExperimentMetadata/) {
   if($line =~ /^ExperimentMetadata\[(.+)\]\[(.+)\]\s*\=\s*(.*)/) {
     my $exp_name = $1;
     my $tag = $2;
     my $value = $3;
     my $fullname = $exp_name;
     $fullname =~ s/\s/_/g;
     if($self->{'_exp_prefix'} and (index($fullname, $self->{'_exp_prefix'})!=0)) { $fullname = $self->{'_exp_prefix'} .'_'. $fullname; }
     printf(STDERR "ExperimentMetadata exp=%s  tag=%s  val=%s/\n", $fullname, $tag, $value);
     my $experiment = $self->_get_experiment($fullname);
     if($tag and $value) {
     if($tag eq "eedb:display_name") { $experiment->metadataset->remove_metadata_like("eedb:display_name", undef); }
     if($tag eq "eedb:series_name")  { $experiment->series_name($value); return undef; }
     if($tag eq "eedb:series_point") { $experiment->series_point($value); return undef; }
     if($tag eq "description") { $experiment->metadataset->remove_metadata_like("description", undef); }
     my $md1 = $experiment->metadataset->add_tag_data($tag, $value);
     $experiment->metadataset->merge_metadataset($md1->extract_keywords);
     }
   }
   return undef;  //don't save it back out
 } elsif($line =~ /(.+)\s*\=\s*(.*)/) {
   my $tag = $1;
   my $value = $2;
   $tag =~ s/\s*$//g;
   $self->{'_header_metadataset'}->add_tag_data($tag, $value);
 }
 return "##" . $line;
}
*/



bool EEDB::Tools::OSCFileParser::init_from_bed_file(string path) {
  _columns.clear();
  _parameters["_inputfile"] = path;
  _parameters["filetype"]   = "bed";
  _parameters["bed_format"] = "BED_unknown";  //default
  if(_parameters.find("_fsrc_category") == _parameters.end()) {
    _parameters["_fsrc_category"] = "bed_region";
  }
    
  //if(_debug_level>0) { printf("=== bed_header [%s]\n", path.c_str()); }

  //chr1    134212714       134230065       NM_028778       0       +       134212806       134228958       0       7       335,121,152,66,120,133,2168,    0,8815,11559,11993,13820,14421,15183,

  //1. chrom - The name of the chromosome (e.g. chr3, chrY, chr2_random) or scaffold (e.g. scaffold10671).
  //2. chromStart - The starting position of the feature in the chromosome or scaffold. The first base in a chromosome is numbered 0.
  //3. chromEnd - The ending position of the feature in the chromosome or scaffold. The chromEnd base is not included in the display of the feature. For example, the first 100 bases of a chromosome are defined as chromStart=0, chromEnd=100, and span the bases numbered 0-99. 
  //4. name - Defines the name of the BED line. This label is displayed to the left of the BED line in the Genome Browser window when the track is open to full display mode or directly to the left of the item in pack mode.
  //5. score - A score between 0 and 1000. If the track line useScore attribute is set to 1 for this annotation data set, the score value will determine the level of gray in which this feature is displayed (higher numbers = darker gray).
  //6. strand - Defines the strand - either '+' or '-'.
  //7. thickStart - The starting position at which the feature is drawn thickly (for example, the start codon in gene displays).
  //8. thickEnd - The ending position at which the feature is drawn thickly (for example, the stop codon in gene displays).
  //9. itemRgb - An RGB value of the form R,G,B (e.g. 255,0,0). If the track line itemRgb attribute is set to "On", this RBG value will determine the display color of the data contained in this BED line. NOTE: It is recommended that a simple color scheme (eight colors or less) be used with this attribute to avoid overwhelming the color resources of the Genome Browser and your Internet browser.
  //10. blockCount - The number of blocks (exons) in the BED line.
  //11. blockSizes - A comma-separated list of the block sizes. The number of items in this list should correspond to blockCount.
  //12. blockStarts - A comma-separated list of block starts. All of the blockStart positions should be calculated relative to chromStart. The number of items in this list should correspond to blockCount. 

  map<int, int>  column_counts;       //number_of_columns and how many times it occurs
  long           bed_column_count=3;  //best number of columns in bed file

  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) { return false; }  //failed to open
  
  //use gzread() and read 10KB of data to do checking 
  int    line_count=0, valid_line_count=0;;
  int    bufsize = 1024*10;
  
  char*  buffer = (char*)malloc(bufsize+3);  //10KB
  bzero(buffer, bufsize+3);  //ensures there are \0 characters at the end
  bufsize = gzread(gz, buffer, bufsize);
  if(bufsize<=0) {  //failed to read
    gzclose(gz);
    free(buffer);
    return false;
  }
    
  char  *p1, *p2, *line;
  bool  is_tsv = false;
  int   colcnt=1;

  //first pass to check count total tabs
  p1=buffer;
  int tab_count=0;
  while(*p1 != '\0') {
    if(*p1 == '\t') { tab_count++; }
    p1++;
  }
  if((tab_count > 0) && (tab_count > (bufsize * 0.01))) { is_tsv = true; }

  //second pass to segment lines and count columns
  line=p1=buffer;
  while(*p1 != '\0') {
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; } 
    if(*p1 == '\0') { break; } //end of buffer so stop

    *p1 = '\0';  //null terminate the line
    if((p1-line == 0) || (strncmp(line, "track", 5) == 0)) {
      //skip empty lines and BED track header line
      p1++;
      line = p1;
      continue; 
    } 

    line_count++;
    
    colcnt=1;
    p2=line;  //now use p2 to segment the line
    while(*p2 != '\0') { 
      if(is_tsv && (*p2 == '\t')) { colcnt++; }
      if(!is_tsv && (*p2 == ' ')) {
        colcnt++;
        while(*(p2+1) == ' ') { p2++; }
      }
      p2++;
    }
    
    if(colcnt>=3 && colcnt<=12) {
      valid_line_count++;
      column_counts[colcnt] += 1;
      if(column_counts[colcnt] > column_counts[bed_column_count]) { bed_column_count = colcnt; }
    }

    //move forward getting ready for next line
    p1++;
    line = p1;
  }
  gzclose(gz);
  free(buffer);

  if(line_count==0) { return false; }
  if(valid_line_count==0) { return false; }
  if((double)valid_line_count / line_count < 0.9) { return false; }  //must have at least 90% of lines being valid
    
  
  _parameters["bed_format"] = "BED" + l_to_string(bed_column_count);
    
  vector<string>  columns;
  columns.push_back("eedb:chrom");
  columns.push_back("eedb:start.0base");
  columns.push_back("eedb:end");

  if(bed_column_count==4)  { columns.push_back("eedb:score"); }  //specific BED4/bedGraph format
  if(bed_column_count>4)   { columns.push_back("eedb:name"); }
  
  if(bed_column_count>=5)  { columns.push_back("eedb:score"); }
  if(bed_column_count>=6)  { columns.push_back("eedb:strand"); }
  if(bed_column_count>=7)  { columns.push_back("eedb:bed_thickstart"); }
  if(bed_column_count>=8)  { columns.push_back("eedb:bed_thickend"); }
  if(bed_column_count>=9)  { columns.push_back("bed:itemRgb"); }
  if(bed_column_count>=10) { columns.push_back("eedb:bed_block_count"); }
  if(bed_column_count>=11) { columns.push_back("eedb:bed_block_sizes"); }
  if(bed_column_count>=12) { columns.push_back("eedb:bed_block_starts"); }
                 
  _parse_column_names(columns);

  if(is_tsv) { _segment_mode = OSCTAB; }
  else { _segment_mode = OSCSPACE; }
  
  if(bed_column_count == 12) {
    _get_category_featuresource("block");
    _get_category_featuresource("3utr"); 
    _get_category_featuresource("5utr"); 
  }
  
  return true;
}


bool EEDB::Tools::OSCFileParser::init_from_sam_file(string path) {
  _columns.clear();
  _parameters["filetype"] = "sam";

  //printf("=== sam_header [%s]\n", path.c_str());

  /*
  my $line;
  my $gz = gzopen(path, "rb") ;
  if($gz) { 
    while(my $bytesread = $gz->gzreadline($line)) {
      chomp($line);
      if($line =~ /^@/) {
        $self->{'_header_data'} .= sprintf("////ParameterValue[sam_header_line] = %s\n", $line);
      } else { last; }
    }
    $gz->gzclose;
  }
  */

  vector<string>  columns;
  columns.push_back("eedb:name");
  columns.push_back("eedb:sam_flag");
  columns.push_back("eedb:chrom");
  columns.push_back("eedb:start.1base");
  columns.push_back("eedb:score");  // SAM_MAPQ -> eedb:score
  columns.push_back("eedb:sam_cigar");
  columns.push_back("sam:mrnm");
  columns.push_back("sam:mpos");
  columns.push_back("sam:isize");
  columns.push_back("eedb:seqread");
  columns.push_back("sam:qual");
  columns.push_back("eedb:sam_opt");
                 
  _parse_column_names(columns);
  return true;
}


bool EEDB::Tools::OSCFileParser::init_from_gff_file(string path) {
  _columns.clear();
  _parameters["filetype"] = "gff";
  
  //printf("=== gff_header [%s]\n", path.c_str());

  //$self->{'_header_data'} = "";
  //$self->{'_header_data'} .= "##ParameterValue[filetype] = gff\n";
  //$self->{'_header_data'} .= sprintf("##ParameterValue[genome] = %s\n", $self->assembly_name);
  
  //Fields are: <seqname> <source> <feature> <start> <end> <score> <strand> <frame> [attributes] [comments] 

  vector<string>  columns;
  columns.push_back("eedb:chrom");
  columns.push_back("gff:source");  //basically metadata
  columns.push_back("eedb:fsrc_category");  //EEDB featuresource category is the same as the GFF feature_type
  columns.push_back("eedb:start.1base");
  columns.push_back("eedb:end");
  columns.push_back("eedb:score");
  columns.push_back("eedb:strand");
  columns.push_back("gff:frame");
  columns.push_back("gff:attributes");
    
  _parse_column_names(columns);
  return true;
}


bool EEDB::Tools::OSCFileParser::init_from_xml_file(string path) {
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *node, *root_node, *section_node;
  rapidxml::xml_attribute<> *attr;

  //fprintf(stderr, "OSCFileParser::init_from_xml_file : %s\n", path.c_str());
  map<string, EEDB::DataSource*>  sources_map;  

  _columns.clear();
  //printf("init_from_xml_file [%s]\n", path.c_str());
  
  //printf("=== read config [%s]\n", path.c_str());
  //open config file, mmap into memory then copy into config_text
  fildes = open(path.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return false; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  close(fildes);
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  root_node = doc.first_node();
  if(root_node->name() != string("oscfile")) { return false; }

  // parameters section
  section_node = root_node->first_node("parameters");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(string(node->name()) == "input_file") { _parameters["_inputfile"] = node->value(); } 
      else { _parameters[node->name()] = node->value(); }
      node = node->next_sibling();
    }
  }

  // peers section
  section_node = root_node->first_node("peer");
  if(section_node) { 
    _peer = EEDB::Peer::new_from_xml(section_node);
  }  
  
  // sources section
  section_node = root_node->first_node("sources");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(strcmp(node->name(), "experiment")==0) {
        //fprintf(stderr, "OSCFileParser::init_from_xml_file parsing experiment\n");
        EEDB::Experiment *exp = new EEDB::Experiment(node, _load_source_metadata);
        //if(_peer) { exp->peer_uuid(_peer->uuid()); }
        set_datasource(exp);
        sources_map[exp->db_id()] = exp;
      }
      if(strcmp(node->name(), "featuresource")==0) {
        EEDB::FeatureSource *fsrc = new EEDB::FeatureSource(node);
        //if(_peer) { fsrc->peer_uuid(_peer->uuid()); }
        set_datasource(fsrc);
        sources_map[fsrc->db_id()] = fsrc;
      }
      if(strcmp(node->name(), "edgesource")==0) {
        //if(_peer) { esrc->peer_uuid(_peer->uuid()); }
        EEDB::EdgeSource *esrc = new EEDB::EdgeSource(node);
        set_datasource(esrc);
        sources_map[esrc->db_id()] = esrc;
      }
      node = node->next_sibling();
    }
  }
  
  // columns section
  section_node = root_node->first_node("columns");
  if(section_node) { 
    //if there is a columns section then it is already built
    _parameters["filetype"].clear();
    _columns.clear();
    if((attr = section_node->first_attribute("count"))) {
      long int count = strtol(attr->value(), NULL, 10);
      _columns.resize(count);
    }

    long i=0;
    node = section_node->first_node("column");
    while(node) {
      OSC_column *colobj = &(_columns[i++]);
      colobj->init_from_xmlnode(node);
      if(!colobj->expname.empty()) { colobj->experiment = (EEDB::Experiment*)sources_map[colobj->expname]; }

      string xmlbuf;
      colobj->xml(xmlbuf);
      //printf("%s\n", xmlbuf.c_str());

      node = node->next_sibling("column");
    }
    postprocess_columns();
  }

  free(config_text);
  
  // post processing
  string ftype = _parameters["filetype"];
  if(ftype == "bed") {
    return init_from_bed_file(_parameters["_inputfile"]);
  } else if(ftype == "osc") {
    return init_from_oscheader_file(_parameters["_inputfile"]);
  } else if(ftype == "sam") {
    return init_from_sam_file(_parameters["_inputfile"]);
  } else if((ftype == "gff") || (ftype == "gtf") || (ftype == "gff2") || (ftype == "gff3")) {
    return init_from_gff_file(_parameters["_inputfile"]);
  }
  return true;
}



//////////////////////////       column   setup        ///////////////////////////////////////////

void  EEDB::Tools::OSCFileParser::_parse_column_names(vector<string> &columns) {
  _columns.resize(columns.size());
  
  for(unsigned int i=0; i<columns.size(); i++) {
    OSC_column *colobj = &(_columns[i]);
    _columns[i].colnum  = i;
    _columns[i].colname = columns[i];
    _columns[i].orig_colname = columns[i];

    _process_column(colobj);
  }
  postprocess_columns();
}
    

void  EEDB::Tools::OSCFileParser::_process_column(OSC_column *colobj) {
  int    i = colobj->colnum;
  string column_name = colobj->colname;

  if(_column_descriptions.find(column_name) != _column_descriptions.end()) {
    //transfer from the header information into the column object
    colobj->description = _column_descriptions[column_name];
  }
  
    _convert_column_name_aliases(colobj);

    if(_parameters.find("_skip_metadata") != _parameters.end()) {
      colobj->oscnamespace = IGNORE; 
    } else { colobj->oscnamespace = METADATA; }

    // fixed namespaces to _idx_xxxx variables
    if(colobj->colname == "eedb:genome")       { colobj->oscnamespace = GENOMIC; _idx_asm = i; }
    if(colobj->colname == "eedb:chrom")        { colobj->oscnamespace = GENOMIC; _idx_chrom = i; }
    if(colobj->colname == "eedb:start.0base")  { colobj->oscnamespace = GENOMIC; _idx_start = i; }
    if(colobj->colname == "eedb:start.1base")  { colobj->oscnamespace = GENOMIC; _idx_start = i; }
    if(colobj->colname == "eedb:end")          { colobj->oscnamespace = GENOMIC; _idx_end = i; }
    if(colobj->colname == "eedb:strand")       { colobj->oscnamespace = GENOMIC; _idx_strand = i; }

    if(colobj->colname == "eedb:bed_block_count")  { colobj->oscnamespace = GENOMIC; _idx_bed_block_count = i; }
    if(colobj->colname == "eedb:bed_block_sizes")  { colobj->oscnamespace = GENOMIC; _idx_bed_block_sizes = i; }
    if(colobj->colname == "eedb:bed_block_starts") { colobj->oscnamespace = GENOMIC; _idx_bed_block_starts = i; }
    if(colobj->colname == "eedb:bed_thickstart")   { colobj->oscnamespace = GENOMIC; _idx_bed_thickstart = i; }
    if(colobj->colname == "eedb:bed_thickend")     { colobj->oscnamespace = GENOMIC; _idx_bed_thickend = i; }

    if(colobj->colname == "eedb:mapcount")     { colobj->oscnamespace = EXPRESSION; _idx_mapcount = i; }
    
    if(colobj->colname == "eedb:name")         { colobj->oscnamespace = FEATURE; _idx_name = i; }
    if(colobj->colname == "id")                { colobj->oscnamespace = FEATURE; _idx_name = i; }
    if(colobj->colname == "eedb:feature_id")   { colobj->oscnamespace = FEATURE; _idx_fid = i; }
    if(colobj->colname == "eedb:primary_id")   { colobj->oscnamespace = FEATURE; _idx_fid = i; }

    if(colobj->colname == "eedb:score")        { colobj->oscnamespace = FEATURE; _idx_score = i; }
    if(colobj->colname == "eedb:significance") { colobj->oscnamespace = FEATURE; _idx_score = i; }

    if(colobj->colname == "eedb:fsrc_category"){ colobj->oscnamespace = FEATURE; _idx_fsrc_category = i; }
    if(colobj->colname == "eedb:fsrc_id")      { colobj->oscnamespace = FEATURE; _idx_fsrc_id = i; }
    if(colobj->colname == "eedb:demux_fsrc")   { colobj->oscnamespace = FEATURE; _idx_demux_fsrc = i; }
    if(colobj->colname == "eedb:demux_exp")    { colobj->oscnamespace = FEATURE; _idx_demux_exp = i; }

    if(colobj->colname == "eedb:sam_flag")     { colobj->oscnamespace = METADATA; _idx_sam_flag = i; }
    if(colobj->colname == "eedb:sam_cigar")    { colobj->oscnamespace = METADATA; _idx_cigar = i; }
    if(colobj->colname == "eedb:sam_opt")      { colobj->oscnamespace = METADATA; _idx_sam_opt = i; }

    if(colobj->colname == "eedb:ctg_cigar")    { colobj->oscnamespace = GENOMIC; _idx_ctg_cigar = i; }
    if(colobj->colname == "gff:attributes")    { colobj->oscnamespace = METADATA; _idx_gff_attributes = i; }

    if(colobj->colname == "edgef1")            { colobj->oscnamespace = EDGE; colobj->colname = "edgef1_name"; _idx_edge_f1 = i; }
    if(colobj->colname == "edgef2")            { colobj->oscnamespace = EDGE; colobj->colname = "edgef2_name"; _idx_edge_f2 = i; }
    if(colobj->colname == "edgef1_name")       { colobj->oscnamespace = EDGE; _idx_edge_f1 = i; }
    if(colobj->colname == "edgef2_name")       { colobj->oscnamespace = EDGE; _idx_edge_f2 = i; }
    if(colobj->colname == "edgef1_id")         { colobj->oscnamespace = EDGE; _idx_edge_f1 = i; }
    if(colobj->colname == "edgef2_id")         { colobj->oscnamespace = EDGE; _idx_edge_f2 = i; }

    //
    // expression namespace
    //
    string datatype = "raw";  //default
    string exp_name;
    if(colobj->colname.find("norm.") == 0) {
      datatype = "norm";
      exp_name = colobj->colname.substr(5);
    }
    else if(colobj->colname.find("raw.")==0) {
      datatype = "raw";
      exp_name = colobj->colname.substr(4);
    }
    else if(colobj->colname.find("exp.")==0) {
      string t_str = colobj->colname.substr(4);
      //printf("exp [%s]\n", t_str.c_str());
      size_t p1 = t_str.find('.');
      if(p1!=string::npos) {
        datatype = t_str.substr(0,p1);
        exp_name = t_str.substr(p1+1);
      } else {  // just exp.<data_type>  assume to use feature source name like score_as_expression
        datatype = t_str;
        exp_name = primary_feature_source()->name();
      }
    }
    else if(colobj->colname.find("ignore.")==0) {
      datatype = "ignore";
      exp_name=""; 
      colobj->oscnamespace = IGNORE; 
    }
    //else if(colobj->colname == "eedb:mapcount") {
    //  $datatype = "mapcount";
    //  $exp_name="mapcount"; 
    //}

    if(!exp_name.empty()) {
      colobj->oscnamespace = EXPRESSION;
      colobj->datatype     = EEDB::Datatype::get_type(datatype);
      colobj->expname      = exp_name;
      if(datatype == "mapcount") { _idx_mapcount = i; }
      _get_experiment(colobj);
    }
    
    //if((colobj->oscnamespace != "genomic") and (colobj->oscnamespace != "")) {
    //    push @{$self->{'_variable_columns'}}, $colobj;
    //}    

    //EDGES
    if(colobj->colname.find("edgef1.")==0) {
      string t_str = colobj->colname.substr(7);
      colobj->oscnamespace = EDGE;
      colobj->colname      = "edgef1_name";
      colobj->datatype     = EEDB::Datatype::get_type(t_str);
      _idx_edge_f1 = i;
    }
    if(colobj->colname.find("edgef2.")==0) {
      string t_str = colobj->colname.substr(7);
      colobj->oscnamespace = EDGE;
      colobj->colname      = "edgef2_name";
      colobj->datatype     = EEDB::Datatype::get_type(t_str);
      _idx_edge_f2 = i;
    }
    if(colobj->colname.find("ewt.")==0) {
      string t_str = colobj->colname.substr(4);
      //printf("ewt [%s]\n", t_str.c_str());
      size_t p1 = t_str.find('.');
      if(p1!=string::npos) {
        datatype = t_str.substr(0,p1);
        exp_name = t_str.substr(p1+1);
      } else {  // just exp.<data_type>  assume to use feature source name like score_as_expression
        datatype = t_str;
        exp_name = primary_edge_source()->name();
      }

      colobj->oscnamespace = EDGE;
      colobj->colname      = "edge_weight";
      colobj->datatype     = EEDB::Datatype::get_type(datatype);
      colobj->expname      = exp_name;
      //_get_experiment(colobj);
    }
 
}


void  EEDB::Tools::OSCFileParser::postprocess_columns() {
  //post processing after all columns are known
  _coordinate_system = UNDEF;
  
  EEDB::Datatype *mapcount = EEDB::Datatype::get_type("mapcount");

  //recalculate global _idx values
  for(unsigned int i=0; i<_columns.size(); i++) {
    OSC_column *colobj = &(_columns[i]);
    _columns[i].colnum  = i;

    // fixed namespaces to _idx_xxxx variables
    if(colobj->colname == "eedb:genome")           { _idx_asm = i; }
    if(colobj->colname == "eedb:chrom")            { _idx_chrom = i; }
    if(colobj->colname == "eedb:start.0base")      { _idx_start = i; }
    if(colobj->colname == "eedb:start.1base")      { _idx_start = i; }
    if(colobj->colname == "eedb:end")              { _idx_end = i; }
    if(colobj->colname == "eedb:strand")           { _idx_strand = i; }

    if(colobj->colname == "eedb:bed_block_count")  { _idx_bed_block_count = i; }
    if(colobj->colname == "eedb:bed_block_sizes")  { _idx_bed_block_sizes = i; }
    if(colobj->colname == "eedb:bed_block_starts") { _idx_bed_block_starts = i; }
    if(colobj->colname == "eedb:bed_thickstart")   { _idx_bed_thickstart = i; }
    if(colobj->colname == "eedb:bed_thickend")     { _idx_bed_thickend = i; }

    if(colobj->colname == "eedb:mapcount")         { _idx_mapcount = i; }

    if(colobj->colname == "eedb:name")             { _idx_name = i; }
    if(colobj->colname == "id")                    { _idx_name = i; }
    if(colobj->colname == "eedb:feature_id")       { _idx_fid = i; }
    if(colobj->colname == "eedb:primary_id")       { _idx_fid = i; }

    if(colobj->colname == "eedb:score")            { _idx_score = i; }
    if(colobj->colname == "eedb:significance")     { _idx_score = i; }

    if(colobj->colname == "eedb:fsrc_category")    { _idx_fsrc_category = i; }
    if(colobj->colname == "eedb:fsrc_id")          { _idx_fsrc_id = i; }
    if(colobj->colname == "eedb:demux_fsrc")       { _idx_demux_fsrc = i; }
    if(colobj->colname == "eedb:demux_exp")        { _idx_demux_exp = i; }
    
    if(colobj->colname == "eedb:sam_flag")         { _idx_sam_flag = i; }
    if(colobj->colname == "eedb:sam_cigar")        { _idx_cigar = i; }
    if(colobj->colname == "eedb:sam_opt")          { _idx_sam_opt = i; }

    if(colobj->colname == "eedb:ctg_cigar")        { _idx_ctg_cigar = i; }
    if(colobj->colname == "gff:attributes")        { _idx_gff_attributes = i; }

    if(colobj->colname == "edgef1_id")             { _idx_edge_f1 = i; }
    if(colobj->colname == "edgef2_id")             { _idx_edge_f2 = i; }

    if((colobj->oscnamespace == EXPRESSION) and (colobj->datatype == mapcount)) { _idx_mapcount = i; }
  }
  
  if((_idx_edge_f1!=-1) && (_idx_edge_f2!=-1)) {
    _coordinate_system = EDGES;
  }

  if((_idx_start!=-1) && (_idx_chrom!=-1)) {
    //minimum for genomic coordinates is a chrom and start
    if(_columns[_idx_start].colname == "eedb:start.0base") { _coordinate_system = BASE0; }
    if(_columns[_idx_start].colname == "eedb:start.1base") { _coordinate_system = BASE1; }
  }

  if((_idx_score!=-1) && (_parameters.find("score_as_expression") != _parameters.end())) {
    //get/create experiment with identical name to to feature_source
    OSC_column *colobj = &(_columns[_idx_score]);
    colobj->oscnamespace = EXPRESSION;
    colobj->datatype     = EEDB::Datatype::get_type(_parameters["score_as_expression"]);
    colobj->expname      = primary_feature_source()->name();
    _get_experiment(colobj);
    //colobj->experiment->add_datatype(colobj->datatype);
    //colobj->experiment->add_datatype("unity");
  }

  if(_idx_mapcount != -1) {
    //get/create experiment with identical name to to feature_source
    OSC_column *colobj = &(_columns[_idx_mapcount]);
    if(colobj->experiment == NULL) {
      colobj->oscnamespace = EXPRESSION;
      colobj->datatype     = EEDB::Datatype::get_type("mapcount");
      colobj->expname      = primary_feature_source()->name();
      _get_experiment(colobj);

      //next prep other expression columns which can be "map normalized"
      for(unsigned int i=0; i < _columns.size(); i++) {
        EEDB::Tools::OSC_column *colobj = &(_columns[i]);
        if(colobj->experiment == NULL) { continue; }
        if((*(colobj->datatype) != "raw") and (*(colobj->datatype) != "tagcount")) { continue; } 
        //colobj->experiment->add_datatype("mapcount");
        //colobj->experiment->add_datatype("singlemap_tagcnt");
        //colobj->experiment->add_datatype("singlemap_tpm");
        //colobj->experiment->add_datatype("mapnorm_tagcnt");
        //colobj->experiment->add_datatype("mapnorm_tpm");
      }
    }
  }  
}


void  EEDB::Tools::OSCFileParser::append_column(string column_name) {
  int i = _columns.size();
  _columns.resize(i+1);
  
  OSC_column *colobj = &(_columns[i]);
  _columns[i].colnum  = i;
  _columns[i].colname = column_name;
  _columns[i].orig_colname = column_name;

  _process_column(colobj);
}  


void  EEDB::Tools::OSCFileParser::prepend_column(string column_name) {
  OSC_column  colobj1;
  vector<OSC_column>::iterator it;
  it = _columns.begin();
  it = _columns.insert(it, colobj1);

  OSC_column *colobj = &(_columns[0]);
  colobj->colnum  = 0;
  colobj->colname = column_name;
  colobj->orig_colname = column_name;

  _process_column(colobj);  
}  


void  EEDB::Tools::OSCFileParser::reset_to_oscdb() {
  _segment_mode = OSCTAB;
  _parameters.erase("bed_format");
  _parameters.erase("input_file");
  _parameters.erase("score_as_expression");
  _parameters.erase("default_mapcount");
  _parameters.erase("singlemap_sequencetags");
  _parameters.erase("oneline-onecount");
  _parameters.erase("single_sequencetags");
  _parameters.erase("filetype");
}


void  EEDB::Tools::OSCFileParser::remove_ignore_columns() {
  vector<OSC_column>::iterator it, it2;
  it = it2 = _columns.begin();
  while(it != _columns.end()) {
    if((*it).oscnamespace == IGNORE) {
      _columns.erase(it);
      it = it2;
    } else {
      it2 = it; //keep pointer at last valid column
      it++;
    }
  }
  for(unsigned int i=0; i<_columns.size(); i++) {
    _columns[i].colnum = i;
  }
}


void EEDB::Tools::OSCFileParser::_convert_column_name_aliases(OSC_column *colobj) {
  //if(_skip_aliases) { return; }
  
  //rename adjustment for some legacy OSCFile namespaces
  if(colobj->colname == "subject")      { colobj->colname = "eedb:chrom"; }
  if(colobj->colname == "chromosome")   { colobj->colname = "eedb:chrom"; }
  if(colobj->colname == "start")        { colobj->colname = "eedb:start.0base"; }
  if(colobj->colname == "stop")         { colobj->colname = "eedb:end"; }
  if(colobj->colname == "ID")           { colobj->colname = "eedb:name"; }
  if(colobj->colname == "map_position") { colobj->colname = "eedb:mapcount"; }
  if(colobj->colname == "raw.total")    { colobj->colname = "ignore.total"; }

  //eeDB additional namespace adjustments
  if(colobj->colname == "id")           { colobj->colname = "eedb:name"; }
  if(colobj->colname == "name")         { colobj->colname = "eedb:name"; }
  if(colobj->colname == "sequence")     { colobj->colname = "eedb:name"; }
  if(colobj->colname == "score")        { colobj->colname = "eedb:score"; }
  if(colobj->colname == "significance") { colobj->colname = "eedb:significance"; }
  if(colobj->colname == "chrom")        { colobj->colname = "eedb:chrom"; }
  if(colobj->colname == "start.0base")  { colobj->colname = "eedb:start.0base"; }
  if(colobj->colname == "start.1base")  { colobj->colname = "eedb:start.1base"; }
  if(colobj->colname == "end")          { colobj->colname = "eedb:end"; }
  if(colobj->colname == "strand")       { colobj->colname = "eedb:strand"; }
  if(colobj->colname == "genome")       { colobj->colname = "eedb:genome"; }
  if(colobj->colname == "assembly")     { colobj->colname = "eedb:genome"; }
  if(colobj->colname == "raw.mapcount") { colobj->colname = "eedb:mapcount"; }
  if(colobj->colname == "mapcount")     { colobj->colname = "eedb:mapcount"; }
  if(colobj->colname == "category")     { colobj->colname = "eedb:fsrc_category"; }

  if(colobj->colname == "bed_block_count")  { colobj->colname = "eedb:bed_block_count"; }
  if(colobj->colname == "bed_block_sizes")  { colobj->colname = "eedb:bed_block_sizes"; }
  if(colobj->colname == "bed_block_starts") { colobj->colname = "eedb:bed_block_starts"; }
  if(colobj->colname == "bed_thickstart")   { colobj->colname = "eedb:bed_thickstart"; }
  if(colobj->colname == "bed_thickend")     { colobj->colname = "eedb:bed_thickend"; }      

  if(colobj->colname == "bed:block_count")  { colobj->colname = "eedb:bed_block_count"; }
  if(colobj->colname == "bed:block_sizes")  { colobj->colname = "eedb:bed_block_sizes"; }
  if(colobj->colname == "bed:block_starts") { colobj->colname = "eedb:bed_block_starts"; }
  if(colobj->colname == "bed:thickstart")   { colobj->colname = "eedb:bed_thickstart"; }
  if(colobj->colname == "bed:thickend")     { colobj->colname = "eedb:bed_thickend"; }      
}


bool EEDB::Tools::OSCFileParser::segment_line(char* line) {
  //performs in-situ buffer modification like strtok() and rapidxml
  //to columnate and prepare line buffer for parsing

  char *p1, *p2;
  int  colnum;
  int numcols = _columns.size();
  
  for(int i=0; i < numcols; i++) { _columns[i].data = NULL; }
  if(line==NULL) { return false; }
  
  p2=line;
  colnum=0;
  if(_segment_mode == OSCTAB) {
    bool ok = true;
    while(ok) {
      if(colnum >= numcols) { break; } //more columns than expected, not an error, just ignore extras
      if(*p2=='\"' || *p2=='\'') { p2++; } //column starts with a " or ' 
      p1=p2;  //beginning of new column
      while((*p2 != '\0') && (*p2 != '\t')) { p2++; }
      _columns[colnum++].data = p1;
      if(*(p2-1)=='\"' || *(p2-1)=='\'') { *(p2-1) = '\0'; } //column end with a " or ' 
      if(*p2 != '\0') { //not finished yet
        *p2 = '\0';  //null terminate column
        p2++;
      } else {
        ok = false;
      }
    }
  }

  if(_segment_mode == OSCSPACE) {
    while(*p2 != '\0') {
      if(colnum >= numcols) { break; } //more columns then expected
      if(*p2=='\"' || *p2=='\'') { p2++; } //column starts with a " or ' 
      p1=p2;  //beginning of new column
      while((*p2 != '\0') && (*p2 != ' ')) { p2++; }
      _columns[colnum++].data = p1;
      if(*(p2-1)=='\"' || *(p2-1)=='\'') { *(p2-1) = '\0'; } //column end with a " or ' 
      if(*p2 == '\0') { break; }  //finished with line
      *p2 = '\0';  //null terminate column
      while(*(p2+1) == ' ') { p2++; }  //multiple spaces in a row are same column deliminator
      p2++;
    }
  }  
  if(colnum != numcols) {
    //not expected numbed of columns, line is not valid
    char strbuf[8192];
    snprintf(strbuf, 8192, "column count error - read %d, expected %d", colnum, numcols);
    _parameters["_parsing_error"] = strbuf;
    for(int i=0; i < numcols; i++) { _columns[i].data = NULL; }
    return false;
  }
  //for(int i=0; i<numcols; i++) { 
  //  fprintf(stderr, "  %s : [%s]\n", _columns[i].display_desc().c_str(), _columns[i].data);
  //}

  return true;
}


void  EEDB::Tools::OSCFileParser::test_scan_file(string path) {    
  if(_debug_level>0) { printf("=== test_scan_file [%s]\n", path.c_str()); }

  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) { return; }  //failed to open
  
  //use gzread() and read 10KB of data to do checking 
  int    line_count=0;
  int    bufsize = 1024*3000; // 3MB
  
  char*  buffer = (char*)malloc(bufsize+3);
  bzero(buffer, bufsize+3);  //ensures there are \0 characters at the end
  bufsize = gzread(gz, buffer, bufsize);
  if(bufsize<=0) {  //failed to read
    gzclose(gz);
    free(buffer);
    return;
  }
    
  struct timeval   starttime, endtime, time_diff;
  gettimeofday(&starttime, NULL);

  char  *p1, *line;
  string  xml_buffer;
  xml_buffer.reserve(100000);
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool> source_ids;

  //int   colcnt=0;
  line=p1=buffer;
  while(*p1 != '\0') {
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; } 
    if(*p1 == '\0') { break; } //end of buffer so stop

    *p1 = '\0';  //null terminate the line
    line_count++;
    //printf("line [%s]\n", line);
    EEDB::Feature* feature = convert_dataline_to_feature(line, FULL_FEATURE, datatypes, source_ids);
    if(feature != NULL) {
      /*
      int  colnum =0;
      for(colnum=0; colnum < _columns.size(); colnum++) {
        colcnt++;
        //printf("  %s : [%s]\n", _columns[colnum].display_desc().c_str(), _columns[colnum].data);
      }
      */
      //feature->simple_xml(xml_buffer);
      //feature->xml(xml_buffer);
      //printf("%s", xml_buffer.c_str());
      xml_buffer.clear();
      feature->release();
    }

    //move forward getting ready for next line
    p1++;
    line = p1;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;

  printf("processtime_msec=\"%1.6f\"\n", runtime);
  printf("rate= %1.6f / sec\n", line_count * 1000.0 / runtime);
  
  gzclose(gz);
  free(buffer);
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// section to dynamically converting datalines into EEDB objects
//
//////////////////////////////////////////////////////////////////////////////////////////////////


vector<EEDB::Tools::OSC_column>*  EEDB::Tools::OSCFileParser::columns() {
  return &_columns;
}

/***** convert_dataline_to_feature
  Description  : given the header structure, it will parse a single dataline 
                 from the file into objects (Feature, Metadata, Expression)
******/

EEDB::Feature* EEDB::Tools::OSCFileParser::convert_dataline_to_feature(
                char* line, 
                t_outputmode outputmode, 
                map<string, EEDB::Datatype*> &datatypes,
                map<string, bool> &sourceid_filter) {
  if(line==NULL) { return NULL; }
  //if(_debug_level>2) { printf("convertLINE: %s\n", line); }
  if(!segment_line(line)) { return NULL; }  //some problems

  EEDB::Feature *feature = EEDB::Feature::realloc();
  
  //create all internal data structures so that lazyload is not triggered later
  feature->metadataset(); 
  feature->load_expression();
  feature->subfeatures();

  if(_idx_fsrc_id != -1) {
    EEDB::FeatureSource *source = (EEDB::FeatureSource*)_sources_cache[_columns[_idx_fsrc_id].data];
    if(source && source->classname() != EEDB::FeatureSource::class_name) { 
      feature->feature_source(source);      
    }
  } else if(_idx_fsrc_category != -1) {
    feature->feature_source(_get_category_featuresource(_columns[_idx_fsrc_category].data));
  } else {
    feature->feature_source(primary_feature_source());
  }
  
  //fsrc demux if needed
  if(_idx_demux_fsrc != -1 && (feature->feature_source()!=NULL)) {
    string demux_key = _columns[_idx_demux_fsrc].data;
    EEDB::FeatureSource *fsrc = feature->feature_source();
    //fprintf(stderr, "demux_key[%s]\n", demux_key.c_str());
    if(!demux_key.empty()) {
      EEDB::FeatureSource *demux_fsrc = (EEDB::FeatureSource*)fsrc->subsource_for_key(demux_key);
      if(demux_fsrc) {
        feature->feature_source(demux_fsrc);  //switch to demuxed FeatureSource
      }
    }
  } 

  
  //id/name setting
  if(_idx_fid != -1)   { feature->primary_id(strtol(_columns[_idx_fid].data, NULL, 10)); }
  if(_idx_score != -1) { feature->significance(strtod(_columns[_idx_score].data, NULL)); }
  if(_idx_name != -1)  { 
    feature->primary_name(_columns[_idx_name].data); 
    //feature->metadataset()->add_tag_symbol("eedb:primary_name", feature->primary_name());
    if((outputmode==FULL_FEATURE) or (outputmode==SKIPEXPRESSION)) { 
      feature->metadataset()->add_tag_data("eedb:display_name", feature->primary_name());
    }
  } else {
    string name = feature->feature_source()->name();
    feature->primary_name(name); 
    if((outputmode==FULL_FEATURE) or (outputmode==SKIPEXPRESSION)) { 
      feature->metadataset()->add_tag_data("eedb:display_name", name);
    }
  }

  if((_idx_chrom != -1) && (_idx_start!=-1))  {
    EEDB::Chrom  *chrom = NULL;
    if(_idx_asm != -1) { 
      chrom = _get_chrom(_columns[_idx_asm].data, _columns[_idx_chrom].data);
    } else {
      chrom = _get_chrom(_columns[_idx_chrom].data);
    }
    feature->chrom(chrom);
    
    //BASE0 formats are 0 reference and eeDB is 1 referenced so I need to +1 to start
    //BASE0 is also not-inclusive, but eeDB is inclusive so I do NOT need to +1 to the end
    long start = strtol(_columns[_idx_start].data, NULL, 10);
    if(_coordinate_system == BASE0) { start++; }
    feature->chrom_start(start);
    
    if((_idx_end == -1) and (_idx_cigar == -1)) { feature->chrom_end(start); }
    else if(_idx_end != -1) { feature->chrom_end(strtol(_columns[_idx_end].data, NULL, 10)); }
    else if(_idx_cigar != -1) { _convert_cigar_to_end_pos(feature);  }

    if(_idx_strand != -1) { feature->strand(*(_columns[_idx_strand].data)); }
    else if(_idx_sam_flag != -1) {
      long int flags = strtol(_columns[_idx_sam_flag].data, NULL, 10);
      if(flags & 0x0010) { feature->strand('-'); }
      else               { feature->strand('+'); }
      if(flags & 0x0004) { /*fprintf(stderr, "0x04 unmapped\n");*/ feature->chrom(NULL); } //maybe unset the chrom()
      if(flags & 0x0001) {  //paired reads
        //fprintf(stderr, "paired read\n");
        //if(flags & 0x0008) { /*fprintf(stderr, "0x08 pair is unaligned\n");*/ feature->chrom(NULL); }
        //if(flags & 0x0020) { //fprintf(stderr, "0x20 crick pair\n"); feature->strand('-'); } else { feature->strand('+'); }
        //if(flags & 0x0040) { } //fprintf(stderr, "0x40 mate1\n");
        if(flags & 0x0080) { //fprintf(stderr, "0x80 mate2\n");         
          if(flags & 0x0010) { feature->strand('+'); } else { feature->strand('-'); }
        }
        //if((flags & 0x0080) &&  (flags & 0x0020)) { fprintf(stderr, "0x40 0x80 reversed mate2\n"); }
        //if((flags & 0x0080) &&  (flags & 0x0008)) { fprintf(stderr, "0x08 0x80 unaligned mate2\n"); }        
        if(_parameters["flip_mated_pair_orientation"] == "yes") {
          char strand = feature->strand();
          if(strand == '+') { feature->strand('-'); }
          if(strand == '-') { feature->strand('+'); }
        }

      } else {
        //fprintf(stderr, "single read\n");
      }

    }
  }
  if(outputmode == SIMPLE_FEATURE) { return feature; }

  //convert subfeature if present
  if(outputmode != SIMPLE_EXPRESSION) {
    if(_idx_ctg_cigar != -1) {
      _convert_category_cigar_to_subfeatures(feature);
    } else if((_idx_bed_block_count!=-1) && (_idx_bed_block_sizes!=-1) && (_idx_bed_block_starts!=-1)) {
      if(!_convert_bed_block_extensions(feature)) {
        //problem parsing the bed-block subfeatures so fail out
        feature->release();
        return NULL;
      }
    } else if(_idx_cigar != -1) {
      _convert_cigar_to_subfeatures(feature);
    }
    if(outputmode == SUBFEATURE) { return feature; }
  }

  //
  // metadata and expression section
  //
  double mapcount =0;
  if(_idx_mapcount != -1) { mapcount = strtod(_columns[_idx_mapcount].data, NULL); }

  for(int i=0; i < (int)_columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);
    if(colobj->oscnamespace == METADATA) {
      if((outputmode == SIMPLE_EXPRESSION) || (outputmode == SKIPMETADATA)) { continue; }
      if(_sparse_metadata and ((colobj->data == NULL) or (colobj->data[0] == '\0'))) { continue; }
      feature->metadataset()->add_tag_data(colobj->colname, colobj->data);
      if(_idx_gff_attributes == i) { _convert_gff_attributes(feature); }
    }
    
    if(colobj->oscnamespace == EXPRESSION) {
      if(outputmode == SKIPEXPRESSION) { continue; }
      if(colobj->datatype == NULL) { continue; }
      if(colobj->experiment == NULL) { continue; }
      
      if(!sourceid_filter.empty() and (sourceid_filter.find(colobj->experiment->db_id()) == sourceid_filter.end())) { continue; }

      double exp_value = strtod(_columns[i].data, NULL);

      if(i == _idx_score) {  //score_as_expression [this is the 'score' column and tagged as EXPRESSION]
        //fprintf(stderr, "score as expression dtype[%s]\n", colobj->datatype->type().c_str());
        if(datatypes.find("unity") != datatypes.end()) { 
          feature->add_expression(colobj->experiment, EEDB::Datatype::get_type("unity"), 1);
        }
        if(datatypes.empty() || (datatypes.find(colobj->datatype->type()) != datatypes.end())) {
          feature->add_expression(colobj->experiment, colobj->datatype, exp_value);
        }

        //check if user is requesting "datatype" normalized into pm (per million)
        if(colobj->express_total>0) {
          string coltype_pm = colobj->datatype->type() + "_pm";
          if(datatypes.find(coltype_pm) != datatypes.end()) {
            double tval = 1000000.0 * exp_value / colobj->express_total;
            feature->add_expression(colobj->experiment, EEDB::Datatype::get_type(coltype_pm), tval);
          }
        }
      }
      else {
        if(_sparse_expression and (exp_value == 0.0)) { continue; }

        //if datatypes filter is empty or matches, then add the unmodified expression for the column
        if(datatypes.empty() || (datatypes.find(colobj->datatype->type()) != datatypes.end())) {
          feature->add_expression(colobj->experiment, colobj->datatype, exp_value);
        }
        
        //check if user is requesting "datatype" normalized into pm (per million)
        if(colobj->express_total>0) {
          string coltype_pm = colobj->datatype->type() + "_pm";
          if(datatypes.find(coltype_pm) != datatypes.end()) {
            double tval = 1000000.0 * exp_value / colobj->express_total;
            feature->add_expression(colobj->experiment, EEDB::Datatype::get_type(coltype_pm), tval);
          }
          //if((colobj->datatype->type() == "tagcount") && (datatypes.find("tpm") != datatypes.end())) {         
          //  double tval = 1000000.0 * exp_value / colobj->express_total;
          //  feature->add_expression(colobj->experiment, EEDB::Datatype::get_type("tpm"), tval);
          //}
        }
        
        //check if we can perform map-normalization
        if((mapcount>0) and ((colobj->datatype->type() == "raw") or (colobj->datatype->type() == "tagcount"))) {         

          if(mapcount == 1) {
            if(datatypes.find("singlemap_tagcnt") != datatypes.end()) {
              feature->add_expression(colobj->experiment, EEDB::Datatype::get_type("singlemap_tagcnt"), exp_value);
            }
            if((colobj->singlemap_total>0) and (datatypes.find("singlemap_tpm") != datatypes.end())) {
              double tval = 1000000.0 * exp_value / colobj->singlemap_total;
              feature->add_expression(colobj->experiment, EEDB::Datatype::get_type("singlemap_tpm"), tval);
            }
          }
        
          //mapnorm works for mapcount >=1
          if(datatypes.find("mapnorm_tagcnt") != datatypes.end()) {
            feature->add_expression(colobj->experiment, EEDB::Datatype::get_type("mapnorm_tagcnt"), exp_value/mapcount);
          }
          if((colobj->express_total>0) and (datatypes.find("mapnorm_tpm") != datatypes.end())) {
            double tval = 1000000.0 * exp_value / mapcount / colobj->express_total;
            feature->add_expression(colobj->experiment, EEDB::Datatype::get_type("mapnorm_tpm"), tval);
          }
         
          //if(_debug_level>2) {
          //  printf("\ncolnum   : %d\n", $colobj->{'colnum'});
          //  printf("colname  : %s\n", $colobj->{'colname'});
          //  printf("exp      : %s\n", $experiment);
          //  printf("expid    : %s\n", $experiment->id);
          //  printf("datatype : %s\n", $datatype);
          //  printf("value    : %s\n", $value);
          //}          
        }
      }
    }
  }
    
  //last perform experiment demux if needed
  if(_idx_demux_exp != -1) {
    string demux_key = _columns[_idx_demux_exp].data;
    //fprintf(stderr, "exp demux_key[%s]\n", demux_key.c_str());    
    vector<EEDB::Expression*>  expression = feature->expression_array();
    //fprintf(stderr, "feature has %ld expression values\n", expression.size());
    for(unsigned int i=0; i<expression.size(); i++) {
      EEDB::Experiment *exp = expression[i]->experiment();
      if(!exp) { continue; }
      EEDB::Experiment *demux_exp = (EEDB::Experiment*)exp->subsource_for_key(demux_key);
      if(demux_exp && (demux_exp->classname() == EEDB::Experiment::class_name)) {
        expression[i]->experiment(demux_exp);  //switch to demuxed Experiment
      }
    }
  }

  
  return feature;
}


bool  EEDB::Tools::OSCFileParser::_convert_bed_block_extensions(EEDB::Feature *feature) {
  if((_idx_bed_block_count==-1) or (_idx_bed_block_sizes==-1) or (_idx_bed_block_starts==-1)) { return true; }

  feature->subfeatures();

  /* TODO
  my $blockCount_colobj  = $self->{'_header_names'}->{'eedb:bed_block_count'};
  my $blockSizes_colobj  = $self->{'_header_names'}->{'eedb:bed_block_sizes'};
  my $blockStarts_colobj = $self->{'_header_names'}->{'eedb:bed_block_starts'};
  my $thickStart_colobj  = $self->{'_header_names'}->{'eedb:bed_thickstart'};
  my $thickEnd_colobj    = $self->{'_header_names'}->{'eedb:bed_thickend'};
  */
  
  long int thickStart = feature->chrom_start();
  long int thickEnd   = feature->chrom_end();
  long int blockCount = strtol(_columns[_idx_bed_block_count].data, NULL, 10);
  
  if(_idx_bed_thickstart != -1) { 
    //thinkStart is really the end of the 5'UTR region in 0base
    //so converting to 1base means not doing anything
    thickStart = strtol(_columns[_idx_bed_thickstart].data, NULL, 10); 
  }
  if(_idx_bed_thickend   != -1) { 
    //thinkEnd is really the start of the 3'UTR region in 0base
    //so need to +1 to convert to 1base coordinate system
    thickEnd = strtol(_columns[_idx_bed_thickend].data, NULL, 10); 
    if(_coordinate_system == BASE0) { thickEnd++; }
  }

  char *size1  = _columns[_idx_bed_block_sizes].data;
  char *size2  = size1;
  char *start1 = _columns[_idx_bed_block_starts].data;
  char *start2 = start1;

  //fprintf(stderr, "_convert_bed_block_extensions %ld blocks, sizes[%s] start[%s]\n", blockCount, size1, start1);
  
  char strand    = feature->strand();

  char name[2048];
  long int  prev_bstart=0;
  char strbuf[8192];
  
  for(int i=0; i<blockCount; i++) {

    while((*size2 != '\0') and (*size2 != ',')) { size2++; }
    if(*size2 == '\0' && i!=blockCount-1) {
      fprintf(stderr, "OSCFileParser::_convert_bed_block_extensions ERROR not enough sizes %d / %ld\n", i+1, blockCount);
      fprintf(stderr, "ERROR with dataline -- %s", output_current_dataline().substr(0,255).c_str());
      snprintf(strbuf, 8192, "convert_bed_block_extensions ERROR not enough sizes %d / %ld\n", i+1, blockCount);
      _parameters["_parsing_error"] = strbuf;
      return false;
    }
    //*size2 = '\0';
    long int bsize = strtol(size1, NULL, 10);
    size1 = size2+1;
    size2 = size1;

    while((*start2 != '\0') and (*start2 != ',')) { start2++; }
    if(*start2 == '\0' && i!=blockCount-1) {
      fprintf(stderr, "OSCFileParser::_convert_bed_block_extensions ERROR not enough starts %d / %ld\n", i+1, blockCount);
      fprintf(stderr, "ERROR with dataline -- %s", output_current_dataline().substr(0,255).c_str());
      snprintf(strbuf, 8192, "convert_bed_block_extensions ERROR not enough starts %d / %ld\n", i+1, blockCount);
      _parameters["_parsing_error"] = strbuf;
      return false;
    }
    //*start2 = '\0';
    long int bstart = strtol(start1, NULL, 10);
    start1 = start2+1;
    start2 = start1;
    if(bstart < prev_bstart) {
      fprintf(stderr, "OSCFileParser::_convert_bed_block_extensions ERROR starts not in order %ld < previous %ld\n", bstart, prev_bstart);
      fprintf(stderr, "ERROR with dataline -- %s", output_current_dataline().substr(0,255).c_str());
      snprintf(strbuf, 8192, "convert_bed_block_extensions ERROR starts not in order %ld < previous %ld\n", bstart, prev_bstart);
      _parameters["_parsing_error"] = strbuf;
      return false;
    }
    prev_bstart = bstart;
        
    
    EEDB::Feature *subfeat = EEDB::Feature::realloc();
    subfeat->feature_source(_get_category_featuresource("block"));
    
    sprintf(name, "%s_block%d", feature->primary_name().c_str(), i+1);
    subfeat->primary_name(name);
    subfeat->chrom(feature->chrom());
    subfeat->strand(strand);
    subfeat->chrom_start(feature->chrom_start() + bstart);
    subfeat->chrom_end(feature->chrom_start() + bstart + bsize - 1);

    feature->add_subfeature(subfeat);
    subfeat->release(); //retained by feature
    
    if(thickStart > subfeat->chrom_start()) {
      long int uend = subfeat->chrom_end();
      if(thickStart < uend) { uend = thickStart; }

      EEDB::Feature *utr = EEDB::Feature::realloc();
      utr->chrom(feature->chrom());
      utr->chrom_start(subfeat->chrom_start());
      utr->chrom_end(uend);
      utr->strand(strand);
      if(strand == '-') { 
        utr->feature_source(_get_category_featuresource("3utr")); 
        sprintf(name, "%s_3utr", feature->primary_name().c_str());
        utr->primary_name(name);
      } else { 
        utr->feature_source(_get_category_featuresource("5utr")); 
        sprintf(name, "%s_5utr", feature->primary_name().c_str());
        utr->primary_name(name);
      }

      feature->add_subfeature(utr);
      utr->release(); //retained by feature
    }

    if(thickEnd < subfeat->chrom_end()) {
      long int ustart = subfeat->chrom_start();
      if(thickEnd > ustart) { ustart = thickEnd; }

      EEDB::Feature *utr = EEDB::Feature::realloc();
      utr->chrom(feature->chrom());
      utr->chrom_start(ustart);
      utr->chrom_end(subfeat->chrom_end());
      utr->strand(strand);
      if(strand == '-') { 
        utr->feature_source(_get_category_featuresource("5utr")); 
        sprintf(name, "%s_5utr", feature->primary_name().c_str());
        utr->primary_name(name);
      } else { 
        utr->feature_source(_get_category_featuresource("3utr")); 
        sprintf(name, "%s_3utr", feature->primary_name().c_str());
        utr->primary_name(name);
      }

      feature->add_subfeature(utr);
      utr->release(); //retained by feature
    }
  }
  return true;
}


void  EEDB::Tools::OSCFileParser::_convert_cigar_to_end_pos(EEDB::Feature *feature) {
  //TODO: need this
  if(!feature) { return; }
  
  char *cigar  = _columns[_idx_cigar].data;
  if(!cigar) { return; }  
  char *ptr = cigar;
  
  long curr_pos = 0;  
  long len = 0;
  char op = ' ';
  while(1) {
    if((op != ' ') && (len>0)) { 
      //// M  Alignment match (can be a sequence match or mismatch)
      if((op == 'M') || (op == 'X') || (op == '=')) { curr_pos += len; } 
      //// D  Deletion from the reference
      if(op == 'D') { curr_pos += len; }
      //// N  Skipped region from the reference
      if(op == 'N') { curr_pos += len; }      
      op = ' ';
      len = 0;
    }
    while(*ptr == ' ') { ptr++; }    
    if(*ptr == '\0') { break; }
    if(isdigit(*ptr)) {
      len = 0;
      while(isdigit(*ptr)) {
        len = len * 10;
        len += (*ptr - '0');
        ptr++;
      }
    }
    if((*ptr != '\0') && !isdigit(*ptr) && !isspace(*ptr)) {
      op = *ptr;
      ptr++;
    }
  }
  feature->chrom_end(feature->chrom_start() + curr_pos -1);

  /*
  my $curr_pos = 0;
  while($cigar =~ m/([0-9]+)([MIDNSHP])/g) {
   my $len = $1;
   my $op = $2;
   //// M  Alignment match (can be a sequence match or mismatch)
   if($op == 'M'){ $curr_pos += $len; }
   //// D  Deletion from the reference
   elsif ($op == 'D') { $curr_pos += $len; }
   //// N  Skipped region from the reference
   elsif ($op == 'N'){ $curr_pos += $len; }
  }
  */
}


void  EEDB::Tools::OSCFileParser::_convert_cigar_to_subfeatures(EEDB::Feature *feature) {
  if(!feature) { return; }
  
  EEDB::FeatureSource *source = _get_category_featuresource("block");
  if(!source) { return; }

  char *cigar  = _columns[_idx_cigar].data;

  feature->create_cigar_subfeatures(source, cigar);
}


void  EEDB::Tools::OSCFileParser::_convert_category_cigar_to_subfeatures(EEDB::Feature *feature) {
  if(!feature) { return; }
  
  char* ctg_cigar = _columns[_idx_ctg_cigar].data;
  if(!ctg_cigar) { return; }
  
  //parse the separate categories from the ctg_cigar and create the subfeature category layers
  char *p1, *p2;
  p1 = p2 = ctg_cigar;
  string category, cigar;
  int state=1;
  while(state != -1) {
    switch(state) {
      case 1: //get category
        if(*p2 == '\0') { state= -1; break; }
        while((*p2)!='\0' and (*p2)!=':') { p2++; }
        if((*p2)==':') {
          *p2='\0';
          category = p1;
          state=2;
          p2++;
          p1=p2;
        }
        break;
      case 2: //get cigar
        if(*p2 == '\0') { state= -1; break; }
        while((*p2)!='\0' and (*p2)!=',' and (*p2)!=';') { p2++; }
        if((*p2)==',' or (*p2)==';') { 
          *p2='\0';
          p2++;
        }
        cigar = p1;
        p1=p2;
        state=3;
        break;
      case 3: //create subfeatures
        EEDB::FeatureSource *source = _get_category_featuresource(category);
        if(source) { 
          feature->create_cigar_subfeatures(source, cigar);
        }
        category.clear();
        cigar.clear();
        state=1;
        break;
    }
  }
}


void  EEDB::Tools::OSCFileParser::_convert_gff_attributes(EEDB::Feature *feature) {
  if(!feature) { return; }
  if(_idx_gff_attributes == -1) { return; }
  
  EEDB::MetadataSet *mdset = feature->metadataset();
  
  char* attribs = _columns[_idx_gff_attributes].data;
  if(!attribs) { return; }
  
  //parse the separate categories from the gff_attribute and create metadata
  char *p1, *p2;
  p1 = p2 = attribs;
  string tag, value;
  int state=1;
  while(state != -1) {
    switch(state) {
      case 1: //get tag (delimited by space or =)
        while((*p1)==' ') { p1++; } //eat leading white space
        if(*p1 == '\0') { state= -1; break; }
        p2 = p1;
        while((*p2)!='\0' and (*p2)!=' ' and (*p2)!='=') { p2++; }
        if((*p2)=='\0') { state= -1; break; }
        *p2='\0';
        tag = p1;
        state=2;
        p2++;
        p1=p2;
        break;
      case 2: //get value
        while((*p1)==' ') { p1++; } //eat leading white space
        if(*p1 == '\0') { state= -1; break; }
        p2 = p1;        
        if(*p1 == '"') { //find matching "
          p1++; 
          p2 = p1;
          while((*p2)!='\0' and (*p2)!='"') { p2++; }
          if((*p2)=='"') { *p2='\0'; p2++; }
        }
        while((*p2)!='\0' and (*p2)!=',' and (*p2)!=';') { p2++; }

        if((*p2)==',') { state = 2; } //stay here because multiple values for same tag
        if((*p2)==';') { state = 1; } //move to next tag
        
        if((*p2)!='\0') { 
          *p2='\0';
          p2++;
        }
        value = p1;
        mdset->add_tag_data(tag, value);
        p1 = p2;
        break;
    }
  }
  //mdset->extract_keywords();
  //TODO: need to eventually support the gff3 parent/id subfeature system
}


string  EEDB::Tools::OSCFileParser::output_current_dataline() {
  bool skip_ignore = false;
  string outputline;
  
  if(_parameters.find("_skip_ignore_on_output") != _parameters.end()) { skip_ignore=true; }

  long count=0;
  for(unsigned int i=0; i < _columns.size(); i++) { 
    if(skip_ignore && (_columns[i].oscnamespace == IGNORE)) { continue; }
    if(count>0) { outputline += "\t"; }
    if(_columns[i].data) { outputline += _columns[i].data; }
    count++;
  }
  outputline += "\n";
  return outputline;
}


EEDB::Edge*  EEDB::Tools::OSCFileParser::convert_dataline_to_edge(char* line) {
  if(line==NULL) { return NULL; }
  //if(_debug_level>2) { printf("convertLINE: %s\n", line); }
  if(!segment_line(line)) { return NULL; }  //some problems
  return convert_segmented_columns_to_edge();
}

EEDB::Edge*    EEDB::Tools::OSCFileParser::convert_segmented_columns_to_edge() {
  //EEDB::Edge *edge = new EEDB::Edge(); //maybe need realloc system like for Feature
  EEDB::Edge *edge = EEDB::Edge::realloc();

  edge->edge_source(primary_edge_source());
  edge->direction('+');
  
  //create all internal data structures so that lazyload is not triggered later
  edge->metadataset(); 

  //id/name setting
  if(_idx_fid != -1)   { edge->primary_id(strtol(_columns[_idx_fid].data, NULL, 10)); }

  //set edge feature1/feature2 either by primary_id or by dynamic mdata/name lookup
  //mdata/name is used during initially loading, while the primary_id is after oscdb is built and indexed
  if(_idx_edge_f1 != -1) {
    EEDB::Tools::OSC_column *colobj = &(_columns[_idx_edge_f1]);
    if((colobj->oscnamespace == EEDB::Tools::EDGE) && (colobj->colname == "edgef1_id")) { 
      edge->feature1_id( strtol(colobj->data, NULL, 10) );
    }
    if((colobj->oscnamespace == EEDB::Tools::EDGE) && (colobj->colname == "edgef1_name")) {
      //edge->feature1_dbid(colobj->data);
      /*
      char strbuf[8192];
      string mdkey;
      if(colobj->datatype) { mdkey = colobj->datatype->type(); }
      string f1_name = colobj->data;
      //fprintf(stderr, "look up f1 [%s][%s] in [%s]\n", mdkey.c_str(), f1_name.c_str(), primary_edge_source()->feature_source1()->display_name().c_str());
      vector<DBObject*> farray;
      if(mdkey.empty() || (mdkey == "name") || (mdkey == "primary_name")) {
        farray = EEDB::Feature::fetch_all_by_source_primary_name(primary_edge_source()->feature_source1(), f1_name);
      } else {
        farray = EEDB::Feature::fetch_all_by_source_metadata(primary_edge_source()->feature_source1(), mdkey, f1_name);
      }
      //printf("  edgef1_name got %ld features\n", farray.size());
      if(farray.size() == 1) { 
        EEDB::Feature *feature1 = (EEDB::Feature*)(farray[0]);
        edge->feature1(feature1);
        feature1->release();  //edge does a retain
      } else {
        fprintf(stderr, "ERROR with dataline -- %s", output_current_dataline().substr(0,255).c_str());
        snprintf(strbuf, 8190, "ERROR looking up uniq edge-feature1[%s] returned %ld", f1_name.c_str(), farray.size());
        _parameters["_parsing_error"] = strbuf;
        return NULL;
      }
      */
    }
    //printf("%s", feature1->simple_xml().c_str());
  }
  if(_idx_edge_f2 != -1) {
    EEDB::Tools::OSC_column *colobj = &(_columns[_idx_edge_f2]);
    if((colobj->oscnamespace == EEDB::Tools::EDGE) && (colobj->colname == "edgef2_id")) { 
      edge->feature2_id( strtol(colobj->data, NULL, 10) );
    }
    if((colobj->oscnamespace == EEDB::Tools::EDGE) && (colobj->colname == "edgef2_name")) {
      //edge->feature2_dbid(colobj->data);
      /*
      string mdkey;
      if(colobj->datatype) { mdkey = colobj->datatype->type(); }
      string f2_name = colobj->data;
      //fprintf(stderr, "look up f2 [%s][%s] in [%s]\n", mdkey.c_str(), f2_name.c_str(), primary_edge_source()->feature_source2()->display_name().c_str());
      vector<DBObject*> farray;
      if(mdkey.empty() || (mdkey == "name") || (mdkey == "primary_name")) {
        farray = EEDB::Feature::fetch_all_by_source_primary_name(primary_edge_source()->feature_source2(), f2_name);
      } else {
        farray = EEDB::Feature::fetch_all_by_source_metadata(primary_edge_source()->feature_source2(), mdkey, f2_name);
      }
      //printf("  edgef2_name got %ld features\n", farray.size());
      if(farray.size() == 1) { 
        EEDB::Feature *feature2 = (EEDB::Feature*)(farray[0]);
        edge->feature2(feature2);
        feature2->release();  //edge does a retain
      } else {
        fprintf(stderr, "ERROR with dataline -- %s", output_current_dataline().substr(0,255).c_str());
        snprintf(strbuf, 8190, "ERROR looking up uniq edge-feature2[%s] returned %ld", f2_name.c_str(), farray.size());
        _parameters["_parsing_error"] = strbuf;
        return false;
      }
      */
    }
    //printf("%s", feature2->simple_xml().c_str());
  }

  //edge_weights
  for(int i=0; i < (int)_columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);
    if(colobj->oscnamespace != EEDB::Tools::EDGE) { continue; }
    if(colobj->colname != "edge_weight") { continue; }
    string datatype = colobj->datatype->type();
    edge->add_edgeweight(primary_edge_source(), datatype, strtod(colobj->data, NULL));
  }   

  // metadata
  for(int i=0; i < (int)_columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = &(_columns[i]);
    if(colobj->oscnamespace == METADATA) {
      if(_sparse_metadata and ((colobj->data == NULL) or (colobj->data[0] == '\0'))) { continue; }
      edge->metadataset()->add_tag_data(colobj->colname, colobj->data);
    }
  }

  //fprintf(stderr, "%s", edge->xml().c_str());
  
  return edge;
}


////////////////////////////////////////////////////////////////////////////////////////////////
//
// experiment and source related section
//
////////////////////////////////////////////////////////////////////////////////////////////////

/*
sub calc_expression_totals {  
  my $self = shift;
  
  return unless($self->{'_inputfile'});

  printf("============== calc_expression_totals ==============\n") if(_debug_level);
  my $starttime = time();
  my $linecount=0;
  my $line;  

  //first clear the totals
  foreach my $colobj (@{$self->{'_variable_columns'}}) {
    next unless($colobj->{'namespace'} == 'expression');
    colobj->express_total = 0.0;
    colobj->mapnorm_total = 0.0;
    colobj->singlemap_total = 0.0;
  }

  my $mapcount_idx  = _idx_mapcount;

  my $gz = gzopen($self->{'_inputfile'}, "rb") ;
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    next if($line =~ /^\///);
    next if($line == "");
    $linecount++;
    if($linecount == 1) { next; }
    $line =~ s/\r//g;
    
    my @columns = split(/\t/, $line);
    
    my $mapcount = undef;
    if($mapcount_idx) { $mapcount = $columns[$mapcount_idx]; }

    foreach my $colobj (@{$self->{'_variable_columns'}}) {
      next unless($colobj->{'namespace'} == 'expression');
      my $value = $columns[$colobj->{'colnum'}]; 

      $colobj->express_total += $value;

      if(defined($mapcount) and ($mapcount > 0)) {
        colobj->mapnorm_total += $value / $mapcount;
        if($mapcount == 1) { colobj->singlemap_total += $value; }
      }
    }
    
    if(_debug_level and ($linecount % 50000 == 0)) { 
      my $rate = $linecount / (time() - $starttime);
      printf(" calc_totals %10d (%1.2f x/sec)\n", $linecount, $rate); 
    }
  }
  $gz->gzclose;  
  
  foreach my $colobj (@{$self->{'_variable_columns'}}) {
    next unless($colobj->{'namespace'} == 'expression');
    my $experiment = $colobj->{'experiment'};
    my $datatype = $colobj->{'datatype'};
    next unless($experiment);
        
    $experiment->metadataset->add_tag_data($datatype . "_total", $colobj->express_total);
    if($mapcount_idx) {
      $experiment->metadataset->add_tag_data($datatype . "_mapnorm_total", colobj->mapnorm_total);    
      $experiment->metadataset->add_tag_data($datatype . "_singlemap_total", colobj->singlemap_total);
    }
  }

  if(_debug_level) {
    $linecount--; //remove the header from the total count;
    my $total_time = time() - $starttime;
    my $rate = $linecount / $total_time;
    printf("TOTAL: %10d :: %1.3f min :: %1.2f x/sec\n", $linecount, $total_time/60.0, $rate);
  }
}     
*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// dynamic fetch/creation of sources as needed 
// related to BED style subfeature blocks
//

EEDB::FeatureSource*  EEDB::Tools::OSCFileParser::primary_feature_source() {
  if(_primary_feature_source != NULL) { return _primary_feature_source; }
  
  //not set this is part of creation process
  if(!_peer) {
    _peer = new EEDB::Peer();
    _peer->create_uuid();
  }
  
  _primary_feature_source = new EEDB::FeatureSource();
  _data_sources.push_back(_primary_feature_source);

  _primary_feature_source->peer_uuid(_peer->uuid());
  _primary_feature_source->primary_id(1);
  _primary_feature_source->create_date(time(NULL));

  if(_parameters.find("_fsrc_name") != _parameters.end()) {
    _primary_feature_source->name(_parameters["_fsrc_name"]);    
  }
  else if(_parameters.find("display_name") != _parameters.end()) {
    _primary_feature_source->name(_parameters["display_name"]);    
  }

  if(_parameters.find("_fsrc_category") != _parameters.end()) {
    _primary_feature_source->category(_parameters["_fsrc_category"]);    
  }
  
  if(_parameters.find("_owner_identity") != _parameters.end()) {
    _primary_feature_source->owner_identity(_parameters["_owner_identity"]);    
  }
  
  _transfer_parameters_to_source(_primary_feature_source);
  
  //$fsrc->import_source($self->{'_inputfile'});
  //$fsrc->import_date(scalar(gmtime()) . " GMT");

  //add to the global sources cache
  EEDB::DataSource::add_to_sources_cache(_primary_feature_source);
  //fprintf(stderr, "OSCFileParser created primary source %s\n", _primary_feature_source->xml().c_str());

  return _primary_feature_source;
}


EEDB::EdgeSource*  EEDB::Tools::OSCFileParser::primary_edge_source() {
  if(_primary_edge_source != NULL) { return _primary_edge_source; }

  //not set this is part of creation process
  if(!_peer) {
    _peer = new EEDB::Peer();
    _peer->create_uuid();
  }
  
  _primary_edge_source = new EEDB::EdgeSource();
  _data_sources.push_back(_primary_edge_source);

  _primary_edge_source->peer_uuid(_peer->uuid());
  _primary_edge_source->primary_id(1);
  _primary_edge_source->create_date(time(NULL));
  _primary_edge_source->is_active(true);
  _primary_edge_source->is_visible(true);

  if(_parameters.find("_source_name") != _parameters.end()) {
    _primary_edge_source->name(_parameters["_source_name"]);    
  }
  else if(_parameters.find("display_name") != _parameters.end()) {
    _primary_edge_source->name(_parameters["display_name"]);    
  }

  if(_parameters.find("_source_category") != _parameters.end()) {
    _primary_edge_source->category(_parameters["_source_category"]);    
  }
  if(_parameters.find("_source_classification") != _parameters.end()) {
    _primary_edge_source->category(_parameters["_source_classification"]);    
  }
  
  if(_parameters.find("_owner_identity") != _parameters.end()) {
    _primary_edge_source->owner_identity(_parameters["_owner_identity"]);    
  }

  if(_parameters.find("_featuresource1_dbid") != _parameters.end()) {
    _primary_edge_source->feature_source1_dbid(_parameters["_featuresource1_dbid"]);    
  }
  if(_parameters.find("_featuresource2_dbid") != _parameters.end()) {
    _primary_edge_source->feature_source2_dbid(_parameters["_featuresource2_dbid"]);    
  }
  
  _transfer_parameters_to_source(_primary_edge_source);
  
  //$fsrc->import_source($self->{'_inputfile'});
  //$fsrc->import_date(scalar(gmtime()) . " GMT");

  //add to the global sources cache
  EEDB::DataSource::add_to_sources_cache(_primary_edge_source);
  //fprintf(stderr, "OSCFileParser created primary source %s\n", _primary_edge_source->xml().c_str());

  /*
  EEDB::FeatureSource* fsrc1 = NULL;
  EEDB::FeatureSource* fsrc2 = NULL;

  if(_parameters.find("edgesource") != _parameters.end()) {
    edgesource = (EEDB::EdgeSource*) stream->fetch_object_by_id(_parameters["edgesource"]);
    fsrc1 = (EEDB::FeatureSource*) stream->fetch_object_by_id(edgesource->feature_source1_dbid());
    fsrc2 = (EEDB::FeatureSource*) stream->fetch_object_by_id(edgesource->feature_source2_dbid());
    //TODO: set the ocfileparser edgesource once available
  } else {
    fsrc1 = (EEDB::FeatureSource*) stream->fetch_object_by_id(_parameters["featuresource1"]);
    fsrc2 = (EEDB::FeatureSource*) stream->fetch_object_by_id(_parameters["featuresource2"]);
    edgesource = oscfileparser->get_edgesource("");
    edgesource->feature_source1_dbid(fsrc1->db_id());
    edgesource->feature_source2_dbid(fsrc2->db_id());
  }
  printf("\n%s", edgesource->xml().c_str());
  printf("fsrc1: %s", fsrc1->simple_xml().c_str());
  printf("fsrc2: %s", fsrc2->simple_xml().c_str());
  */

  return _primary_edge_source;
}




EEDB::FeatureSource*  EEDB::Tools::OSCFileParser::_get_category_featuresource(string category) {  
  if(_category_featuresources.find(category) != _category_featuresources.end()) {
    return _category_featuresources[category];
  }
  
  EEDB::FeatureSource *source = new EEDB::FeatureSource();
  string name = primary_feature_source()->name();
  name += "_" + category;
  source->name(name);  
  source->category(category);
  source->primary_id(_create_source_id++);
  source->peer_uuid(primary_feature_source()->peer_uuid());
  source->create_date(time(NULL));

  if(_parameters.find("_owner_identity") != _parameters.end()) {
    source->owner_identity(_parameters["_owner_identity"]);    
  }
  
  //$fsrc->import_source($self->{'_inputfile'});

  _transfer_parameters_to_source(source);

  _data_sources.push_back(source);
  _category_featuresources[category] = source;

  //add to the global sources cache
  EEDB::DataSource::add_to_sources_cache(source);
  //fprintf(stderr, "OSCFileParser created category source %s\n", source->xml().c_str());

  return source;
}


EEDB::EdgeSource*  EEDB::Tools::OSCFileParser::get_edgesource(string category) {  
  if(_category_edgesources.find(category) != _category_edgesources.end()) {
    return _category_edgesources[category];
  }
  
  EEDB::EdgeSource *source = new EEDB::EdgeSource();
  string name = primary_feature_source()->name();
  if(!category.empty()) { name += "_" + category; }
  source->name(name);  
  source->category(category);
  source->primary_id(_create_source_id++);
  source->peer_uuid(primary_feature_source()->peer_uuid());
  source->create_date(time(NULL));

  if(_parameters.find("_owner_identity") != _parameters.end()) {
    source->owner_identity(_parameters["_owner_identity"]);    
  }
  
  //$fsrc->import_source($self->{'_inputfile'});

  _transfer_parameters_to_source(source);

  _data_sources.push_back(source);
  _category_edgesources[category] = source;

  //add to the global sources cache
  EEDB::DataSource::add_to_sources_cache(source);
  //fprintf(stderr, "OSCFileParser created category source %s\n", source->xml().c_str());

  return source;
}


void EEDB::Tools::OSCFileParser::_get_experiment(OSC_column *colobj) {
  //printf("OSCFileParser::_get_experiment col[%d]\n", colobj->colnum);
  vector<EEDB::DataSource*>::iterator   it;
  
  for(it=_data_sources.begin(); it!=_data_sources.end(); it++) {
    if((*it)->classname() != EEDB::Experiment::class_name) { continue; }
    //do suffix match of Experiments with colobj->expname
    //colobj expname should be smaller than experiment name in system
    string  name = (*it)->name();
    if(name.find(colobj->expname) != string::npos) {
      colobj->experiment = (EEDB::Experiment*)(*it);
      break;
    }
  }
  
  //not found so create one
  if(colobj->experiment == NULL) {
    colobj->experiment = new EEDB::Experiment();
    colobj->experiment->name(colobj->expname);
    string tname = colobj->expname;
    urldecode(tname);
    colobj->experiment->display_name(tname);
    colobj->experiment->primary_id(_create_source_id++);
    colobj->experiment->peer_uuid(primary_feature_source()->peer_uuid());
    colobj->experiment->create_date(time(NULL));
    
    if(_parameters.find("eedb:platform") != _parameters.end()) {
      colobj->experiment->platform(_parameters["eedb:platform"]);
    }
    //if($self->{'_default_experiment_seriespoint'}) { $seriespoint = $self->{'_default_experiment_seriespoint'}; };
    if(!colobj->description.empty()) {
      colobj->experiment->metadataset()->add_tag_data("description", colobj->description);
      colobj->experiment->metadataset()->extract_keywords();
    }     
    
    if(_parameters.find("_owner_identity") != _parameters.end()) {
      colobj->experiment->owner_identity(_parameters["_owner_identity"]);    
    }
    
    _transfer_parameters_to_source(colobj->experiment);

    _data_sources.push_back(colobj->experiment);
        
    //print("==create");
    /*
    $experiment->series_point($seriespoint);
    $experiment->metadataset->add_tag_symbol("expname", $exp_name);
    $experiment->metadataset->add_tag_data("oscfile_colnum", $col_count);
    $experiment->metadataset->add_tag_data("col_desc", $colobj->{'description'}) if($colobj->{'description'});
    */
  } else {
    //transfer the total counts from metadata into variables for map normalization
    EEDB::Metadata     *mdata = NULL;
    EEDB::MetadataSet  *mdset = colobj->experiment->metadataset();
    string             datatype = colobj->datatype->type();

    //fprintf(stderr, "found matching experiment col[%s]\n", colobj->expname.c_str());
    //colobj->experiment->display_info();

    if((mdata = mdset->find_metadata(datatype + "_total", ""))) {
      colobj->express_total = strtod(mdata->data().c_str(), NULL);
    }
    if((mdata = mdset->find_metadata(datatype + "_singlemap_total", ""))) {
      colobj->singlemap_total = strtod(mdata->data().c_str(), NULL);
    }
    if((mdata = mdset->find_metadata(datatype + "_mapnorm_total", ""))) {
      colobj->mapnorm_total = strtod(mdata->data().c_str(), NULL);
    }
  }

  if(colobj->datatype != NULL) {
    colobj->experiment->add_datatype(colobj->datatype);
    //colobj->experiment->metadataset()->add_tag_symbol("eedb:expression_datatype", colobj->datatype->type());
    //colobj->experiment->metadataset()->add_tag_symbol("eedb:expression_datatype", colobj->datatype->type() + "_pm");
  }
}


EEDB::EdgeSource*  EEDB::Tools::OSCFileParser::_sublink_source() {
  if(_subfeature_edgesource != NULL) { return _subfeature_edgesource; }
  if(primary_feature_source() == NULL) { return NULL; }

  _subfeature_edgesource = new EEDB::EdgeSource();
  _data_sources.push_back(_subfeature_edgesource);

  string link_name = primary_feature_source()->name() + "_subfeature";
  _subfeature_edgesource->name(link_name);
  _subfeature_edgesource->category("subfeature");
  _subfeature_edgesource->is_active("y"); 
  _subfeature_edgesource->is_visible("y"); 

  //if(!defined(_subfeature_edgesource) and defined($self->database)) {
  //  _subfeature_edgesource = EEDB::EdgeSource->fetch_by_name($self->database, $link_name);
  //}

  /*
  _subfeature_edgesource->metadataset->add_tag_symbol("eedb:category", "subfeature");
  _subfeature_edgesource->metadataset->add_tag_symbol("eedb:name", $link_name);
  _subfeature_edgesource->metadataset->add_tag_data("name", $link_name);
  _subfeature_edgesource->metadataset->add_tag_symbol("eedb:assembly_name", default_assembly_name());
  if($self->{'_external_metadata'}) {
    _subfeature_edgesource->metadataset->merge_metadataset($self->{'_external_metadata'});
  }
  if(defined($self->database)) { _subfeature_edgesource->store($self->database); }
  if(_debug_level) {
    printf("Needed to create:: ");
    _subfeature_edgesource->display_info;
  }
  */

  return _subfeature_edgesource;
}


EEDB::Chrom*  EEDB::Tools::OSCFileParser::_get_chrom(const char* chrom_name) {
  if(chrom_name==NULL) { return NULL; }
  if(_default_assembly == NULL) { return NULL; }
  return _default_assembly->get_chrom(chrom_name);
}


EEDB::Chrom*  EEDB::Tools::OSCFileParser::_get_chrom(const char* asm_name, const char* chrom_name) {
  if((chrom_name==NULL) || (asm_name==NULL)) { return NULL; }

  map<string, EEDB::Assembly*>::iterator  it;
  it = _assemblies.find(asm_name);
  if(it == _assemblies.end()) {
    //do I create assemblies as needed?
    return NULL;
  }
  if((*it).second == NULL) { return NULL; }
  return (*it).second->get_chrom(chrom_name);
}


/**********************************************************************
 * 
 * sorting of input files for general purpose load/index
 * copied and modified from OSCFileDB to here
 *
 */

string  EEDB::Tools::OSCFileParser::sort_input_file() {
  //
  // read the input file and subdivide into separate chromosomes
  //
  struct timeval    starttime,endtime,difftime;
  double            rate, runtime;
  map<string, int>  chrom_outfiles;
  string            linebuffer;
  char              buffer[8192];
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool> source_ids;
  map<string, EEDB::Chrom*>  chroms;
  
  string path = _parameters["_inputfile"];
  if(path.empty()) { return ""; }
  fprintf(stderr,"sort_input_file [%s]\n", path.c_str());

  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) { return ""; }  //failed to open

  int chrom_idx, start_idx, end_idx, strand_idx; 
  get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
  if(chrom_idx== -1 || start_idx==-1) {
    fprintf(stderr, "oscfile header does not defined chrom or chrom_start columns");
    return "";
  }
  
  //create tmp working dir
  string builddir = path + "_sortdir/";
  if(mkdir(builddir.c_str(), 0777)) {
    if(errno != EEXIST) { //already existing is OK, otherwise error
      fprintf(stderr, "filesystem error: unable to create sort workdir");
      return "";
    }
  }
  fprintf(stderr, "using workdir [%s]\n", builddir.c_str());
  
  //prepare the reading buffer
  char*  data_buffer = (char*)malloc(24576);  // 24 kilobytes
  bzero(data_buffer, 24576);
  
  string filetype  = get_parameter("filetype");
  
  //first I need to split the file on chromosome since the unix sort does not allow
  //mixing of alpha and numerical sorting on different columns
  gettimeofday(&starttime, NULL);
  long int count=0;
  while(gzgets(gz, data_buffer, 24576) != NULL) {
    if(filetype == "osc") { 
      if(data_buffer[0] == '#') { continue; }
      if(count==0) { //first non-parameter/comment line is the header columns line
        count++;
        continue;
      }
    }
    count++;
    if(data_buffer[0] == '#') { continue; }
    
    char *p1=data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    
    linebuffer = data_buffer;
    EEDB::Feature* feature = convert_dataline_to_feature(data_buffer, SIMPLE_FEATURE, datatypes, source_ids);
    if(!feature) { //unable to parse the line
      fprintf(stderr, "failed to parse line %ld during sort:: %s\n", count, data_buffer);
      return "";
    }
    
    string chrname = "unmapped";
    if(feature->chrom()) { 
      chrname = feature->chrom()->chrom_name();
      if(chrname == "*") { chrname = "unmapped"; } 
    }
        
    if(feature->chrom_end() > feature->chrom()->chrom_length()) {
      feature->chrom()->chrom_length(feature->chrom_end());
    }
        
    int chrfd=0;
    if(chrom_outfiles.find(chrname) == chrom_outfiles.end()) {
      //create chrom outfile
      string tpath = builddir + chrname;
      //fprintf(stderr, "create chr_outfile [%s]\n", tpath.c_str());
      chrfd = open(tpath.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
      chrom_outfiles[chrname] = chrfd;
      chroms[chrname] = feature->chrom();
    } else {
      chrfd = chrom_outfiles[chrname];
    }
    write(chrfd, linebuffer.c_str(), linebuffer.length());
    write(chrfd, "\n", 1);
    
    feature->release();
    
    if(count % 100000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
  
  //close files
  gzclose(gz);
  map<string, int>::iterator chr_it;
  for(chr_it=chrom_outfiles.begin(); chr_it!=chrom_outfiles.end(); chr_it++) {
    close((*chr_it).second);
    //maybe do something else here since we know all the chromosomes in the file now
  }
  

  string sort_cmd;
  snprintf(buffer, 8190, "sort -n -k%d ", start_idx+1);
  sort_cmd = buffer;
  if(end_idx != -1) { 
    snprintf(buffer, 8190, "-k%dr ", end_idx+1);
    sort_cmd += buffer;
  }
  if(strand_idx != -1) { 
    snprintf(buffer, 8190, "-k%d ", strand_idx+1);
    sort_cmd += buffer;
  }
  
  string sort_path = path;
  size_t p1 = sort_path.rfind(".gz");
  if(p1!=string::npos) { sort_path.resize(p1); }
  sort_path += ".sort";
  unlink(sort_path.c_str());
  fprintf(stderr, "merging sorts into [%s]\n", sort_path.c_str());
  int sort_fd = open(sort_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  
  //sort chromosomes by chrom_length for merging
  //$starttime = time();  //reset timer
  list<EEDB::Chrom*>                  chrom_list;
  list<EEDB::Chrom*>::iterator        chr_it3;
  map<string, EEDB::Chrom*>::iterator chr_it2;
  
  for(chr_it2=chroms.begin(); chr_it2!=chroms.end(); chr_it2++) {
    chrom_list.push_back((*chr_it2).second);
  }
  chrom_list.sort(chrom_length_sort_func);
  
  for(chr_it3=chrom_list.begin(); chr_it3!=chrom_list.end(); chr_it3++) {
    fprintf(stderr, "sort chrom [%s]\n", (*chr_it3)->chrom_name().c_str());
    
    string chrfile     = builddir + (*chr_it3)->chrom_name();
    string sortchrfile = chrfile+".sort";
        
    string cmd = sort_cmd;
    cmd += chrfile +" > " + sortchrfile;
    fprintf(stderr, "\t%s\n", cmd.c_str());
    system(cmd.c_str());
    
    //concat into main file
    char readbuf[65535];
    FILE *chrfp = fopen(sortchrfile.c_str(), "r");
    while(fgets(readbuf, 65530, chrfp) != NULL) {
      linebuffer = readbuf;
      write(sort_fd, linebuffer.c_str(), linebuffer.length());      
    }
    fclose(chrfp);
    
    unlink(chrfile.c_str());
    unlink(sortchrfile.c_str());
    
  }
  rmdir(builddir.c_str());
  close(sort_fd);
  
  //switch the original and sort files
  //string old_path = path + ".unsorted";
  //rename(path.c_str(), old_path.c_str());
  //rename(sort_path.c_str(), path.c_str());
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
  
  rate = (double)count / runtime;
  fprintf(stderr, "sorted %ld objects\n", count);
  fprintf(stderr, "  %1.6f sec\n", runtime);
  fprintf(stderr, "  %1.3f objs/sec\n", rate); 
  
  return sort_path;
}

