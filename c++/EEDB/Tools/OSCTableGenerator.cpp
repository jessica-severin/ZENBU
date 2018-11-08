/* $Id: OSCTableGenerator.cpp,v 1.19 2014/05/15 07:22:09 severin Exp $ */

/***

NAME - EEDB::Tools::OSCTableGenerator

SYNOPSIS

DESCRIPTION

OSCTableGenerator takes information from a stream and then features 
to generate OSCtable formated output

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
#include <string>
#include <stdarg.h>
#include <zlib.h>
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Tools/OSCTableGenerator.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::Tools::OSCTableGenerator::class_name = "EEDB::Tools::OSCTableGenerator";

void   _eedb_tools_osctablegenerator_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::OSCTableGenerator*)obj;
}

//////////////////////////////////////////////////////////////////////////////


EEDB::Tools::OSCTableGenerator::OSCTableGenerator() {
  init();
}

EEDB::Tools::OSCTableGenerator::~OSCTableGenerator() {
}

void EEDB::Tools::OSCTableGenerator::init() {
  MQDB::DBObject::init();
  _classname            = EEDB::Tools::OSCTableGenerator::class_name;
  _funcptr_delete       = _eedb_tools_osctablegenerator_delete_func;
//_funcptr_xml          = _eedb_tools_osctablegenerator_xml_func;
//_funcptr_simple_xml   = _eedb_tools_osctablegenerator_xml_func;

  _export_feature_metadata = false;
  _export_subfeatures = "";
  _export_experiment_metadata = true;
  _export_header_metadata = true;
  _source_stream = NULL;
  _experiments.clear();
  _expression_datatypes.clear();
  
}

////////////////////////////////////////////////////////////////////////////////////////

void EEDB::Tools::OSCTableGenerator::add_expression_datatype(EEDB::Datatype* datatype) {
  if(datatype==NULL) { return; }
  _expression_datatypes.push_back(datatype);
}

void  EEDB::Tools::OSCTableGenerator::export_subfeatures(string value) {
  _export_subfeatures = value;
}

void  EEDB::Tools::OSCTableGenerator::export_feature_metadata(bool value) {
  _export_feature_metadata = value;
}

void  EEDB::Tools::OSCTableGenerator::export_experiment_metadata(bool value) {
  _export_experiment_metadata = value;
}

void  EEDB::Tools::OSCTableGenerator::export_header_metadata(bool value) {
  _export_header_metadata = value;
}


//////////////////////////////////////////////////////////////////////////////
//
// oscheader section
//
//////////////////////////////////////////////////////////////////////////////


string  EEDB::Tools::OSCTableGenerator::generate_oscheader() {
  string header;
  char buffer[2048];
  list<EEDB::Experiment*>::iterator  it1;
  list<EEDB::Datatype*>::iterator    it2;

  _experiments.clear();
  if(_source_stream) {
    _source_stream->stream_data_sources("Experiment");
    while(MQDB::DBObject *obj = _source_stream->next_in_stream()) {
      if(obj->classname() != EEDB::Experiment::class_name) { continue; }
      _experiments.push_back((EEDB::Experiment*)obj);
    }
  }
  _experiments.sort(EEDB::Experiment::sort_func);

  if(_export_header_metadata) {
    time_t now_time =time(NULL);
    string time_str;
    char *ct_value = ctime(&now_time);
    if(ct_value != NULL) {
      int len = strlen(ct_value);
      if(len>0) {
        ct_value[len-1] = '\0';
        time_str = ct_value;
      }
    }    
    header += "##Date = " + time_str +"\n";
    
    header += "##ParameterValue[filetype] = osc\n";

    snprintf(buffer, 2040, "##ParameterValue[genome] = %s\n", _assembly_name.c_str());
    header += buffer;

    header += "##ColumnVariable[eedb:chrom] = chromosome name\n";
    header += "##ColumnVariable[eedb:start.0base] = chromosome start in 0base coordinate system\n";
    header += "##ColumnVariable[eedb:end] = chromosome end\n";
    header += "##ColumnVariable[eedb:strand] = chromosome strand\n";
    header += "##ColumnVariable[eedb:score] = score or significance of the feature\n";
    if(_export_feature_metadata) {
      header += "##ColumnVariable[gff:attributes] = complete feature metadata in GFF attributes format\n";
    }

    for(it1 = _experiments.begin(); it1 != _experiments.end(); it1++) {
      EEDB::Experiment *experiment = (*it1);
      for(it2 = _expression_datatypes.begin(); it2 != _expression_datatypes.end(); it2++) {
        EEDB::Datatype* datatype = (*it2);
        string colid = "exp." + datatype->type() + "." + experiment->name();
        snprintf(buffer, 2040, "##ColumnVariable[%s] = %s %s\n", 
               colid.c_str(), datatype->type().c_str(), experiment->display_name().c_str());
        header += buffer;

        snprintf(buffer, 2040, "##ExperimentMetadata[%s][zenbu:proxy_id] = %s\n", 
                  experiment->name().c_str(), experiment->db_id().c_str());
        header += buffer;

        if(_export_experiment_metadata) {
          snprintf(buffer, 2040, "##ExperimentMetadata[%s][eedb:display_name] = %s\n", 
                    experiment->name().c_str(), experiment->display_name().c_str());
          header += buffer;

          vector<EEDB::Metadata*> mdlist = experiment->metadataset()->metadata_list();
          for(unsigned int i=0; i<mdlist.size(); i++) {
            EEDB::Metadata *md = mdlist[i];
            if(md->type() == "keyword") { continue; }
            if(md->type() == "osc_header") { continue; }

            snprintf(buffer, 2040, "##ExperimentMetadata[%s][%s] = %s\n", 
                      experiment->name().c_str(), md->type().c_str(), md->data().c_str());
            header += buffer;
          }
        }
      }
    }
  }

  //now the column header line like BED12
  header += "eedb:chrom\teedb:start.0base\teedb:end\teedb:name\teedb:score\teedb:strand";

  if(_export_subfeatures == "bed") {
    header += "\teedb:bed_thickstart\teedb:bed_thickend\tbed:itemRgb\teedb:bed_block_count\teedb:bed_block_sizes\teedb:bed_block_starts";
  }
  if(_export_subfeatures == "cigar") {
    header += "\teedb:ctg_cigar";
  }
  if(_export_feature_metadata) {
    header += "\tgff:attributes";
  }

  for(it1 = _experiments.begin(); it1 != _experiments.end(); it1++) {
    EEDB::Experiment *experiment = (*it1);
    for(it2 = _expression_datatypes.begin(); it2 != _expression_datatypes.end(); it2++) {
      EEDB::Datatype* datatype = (*it2);
      string colid = "exp." + datatype->type() + "." + experiment->name();
      header += "\t" + colid;
    }
  }
  
  header += "\n";

  return header;
}


//////////////////////////////////////////////////////////////////////////////
//
// generate osctable version of feature line
//
//////////////////////////////////////////////////////////////////////////////

string  EEDB::Tools::OSCTableGenerator::osctable_feature_output(EEDB::Feature* feature) {
  string  str;
  char buffer[2048];
  
  if(feature == NULL) { return str; }
  
  if(_export_subfeatures == "bed") {
    str = feature->bed_description("BED12");
  } else if(_export_subfeatures == "cigar") {
    str = feature->bed_description("BED6");
    str += "\t" + feature->category_cigar();
  } else {
    str = feature->bed_description("BED6");
  }

  if(_export_feature_metadata) {
    //str += _osctable_feature_metadata(feature);
    str += "\t" + feature->metadataset()->gff_description();
  }


  list<EEDB::Experiment*>::iterator  it1;
  list<EEDB::Datatype*>::iterator    it2;
  for(it1 = _experiments.begin(); it1 != _experiments.end(); it1++) {
    EEDB::Experiment *experiment = (*it1);
    for(it2 = _expression_datatypes.begin(); it2 != _expression_datatypes.end(); it2++) {
      EEDB::Datatype* datatype = (*it2);
      EEDB::Expression *express = feature->find_expression(experiment, datatype);
      if(express) {
        snprintf(buffer, 2040, "\t%1.2f", express->value());
        str += buffer;
      } else {
        str += "\t0.0";
      }
    }
  }
    
  return str;
}


//////////////////////////////////////////////////////////////////////////////
//
// Metadata and Symbols
//
//////////////////////////////////////////////////////////////////////////////


string  EEDB::Tools::OSCTableGenerator::_osctable_feature_metadata(EEDB::Feature * feature) {
  string  str;

  /*
  my $entrezGene =""; 
  my $md1 = $feature->metadataset->find_metadata("EntrezGene");
  if($md1) { $entrezGene = $md1->data; }
  str += sprintf("\t%s", $entrezGene);
 
  my $entrezID = "";
  my $md2 = $feature->metadataset->find_metadata("EntrezID");
  if($md2) { $entrezID = $md2->data; };
  str += sprintf("\t%s", $entrezID);

  my $md3 = $feature->metadataset->find_all_metadata_like("Entrez_synonym");
  my $syns="";
  foreach my $mdata (@$md3) {
    if($syns) { $syns += ","; }
    $syns += $mdata->data;
  }
  str += sprintf("\t%s", $syns);

  my $desc = "";
  my $md4 = $feature->metadataset->find_metadata("description", undef);
  if($md4) { $desc = $md4->data; }
  str += sprintf("\t%s", $desc);
  */
  return str;
}


