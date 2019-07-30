/* $Id: BAMDB.cpp,v 1.66 2017/07/07 07:45:47 severin Exp $ */

/***

NAME - EEDB::SPStreams::BAMDB

SYNOPSIS

DESCRIPTION

 Rebuild of the BAMDB code. 
 using the low-level API of samtools-lib '-lbam' for directly reading BAM files.
 Uses the native parsing and cigar/strand parsing derived from OSCFileParser 
 
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
#include <sys/stat.h>
#include <zlib.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>

#include <EEDB/SPStreams/BAMDB.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::BAMDB::class_name = "EEDB::SPStreams::BAMDB";

#define READ_BUFSIZE    8192
#define BUFSIZE         8192*3


//function prototypes
MQDB::DBObject* _spstream_bamdb_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::BAMDB*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_bamdb_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::BAMDB*)node)->_fetch_object_by_id(fid);
}
void _spstream_bamdb_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BAMDB*)node)->_stream_clear();
}
void _spstream_bamdb_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BAMDB*)node)->_disconnect();
}
void _spstream_bamdb_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BAMDB*)node)->_reset_stream_node();
}
void _spstream_bamdb_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::BAMDB*)obj;
}
string _spstream_bamdb_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::BAMDB*)obj)->_display_desc();
}
void _spstream_bamdb_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BAMDB*)node)->_reload_stream_data_sources();
}
void _spstream_bamdb_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::BAMDB*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_bamdb_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  ((EEDB::SPStreams::BAMDB*)node)->_get_dependent_datasource_ids(source_ids);
}
bool _spstream_bamdb_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::BAMDB*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_bamdb_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  //TODO? don't know if samtools provides this functionality
}


EEDB::SPStreams::BAMDB::BAMDB() {
  init();
}

EEDB::SPStreams::BAMDB::~BAMDB() {
  if(_database != NULL) {
    _database->release();
    _database = NULL;
  }
}


void EEDB::SPStreams::BAMDB::init() {
  EEDB::SPStreams::ZenDB::init();
  _classname                 = EEDB::SPStreams::BAMDB::class_name;
  _module_name               = "BAMDB";
  _db_type                   = "bamdb";

  _funcptr_delete            = _spstream_bamdb_delete_func;
  _funcptr_display_desc      = _spstream_bamdb_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_bamdb_next_in_stream_func;
  _funcptr_disconnect                         = _spstream_bamdb_disconnect_func;
  _funcptr_stream_clear                       = _spstream_bamdb_stream_clear_func;
  _funcptr_reload_stream_data_sources         = _spstream_bamdb_reload_stream_data_sources_func;

  _funcptr_stream_data_sources                = _spstream_bamdb_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_bamdb_get_dependent_datasource_ids_func;
  //_funcptr_stream_peers                       = _spstream_zendb_stream_peers_func;
  //_funcptr_stream_chromosomes                 = _spstream_zendb_stream_chromosomes_func;
  _funcptr_reset_stream_node                  = _spstream_bamdb_reset_stream_node_func;
  _funcptr_fetch_object_by_id                 = _spstream_bamdb_fetch_object_by_id_func;
  _funcptr_stream_by_named_region             = _spstream_bamdb_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_bamdb_stream_features_by_metadata_search_func;

  //attribute variables
  _samlib_fp = NULL;
  
  _region_set = false;
  _parameters["_bam_loc"] = "link";
  _primary_experiment = NULL;
  _add_expression = true;
  _add_subfeatures = false;
  _add_metadata = false;
  _q3_count = -1;
  _q20_count = -1;
  _q40_count = -1;
  _unaligned_count = -1;
  _total_count = -1;
}

string EEDB::SPStreams::BAMDB::_display_desc() {
  string str = "BAMDB [";
  if(_self_peer) { str += _self_peer->xml(); }
  else if(_database != NULL) { str += _database->full_url(); }
  str += "]";
  return str;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// creation and building new BAMDB
//
//////////////////////////////////////////////////////////////////////////////////////////////////

string  EEDB::SPStreams::BAMDB::create_new(string filepath) {

  EEDB::SPStreams::ZenDB::_create_new(filepath);

  // decide how original BAM file is located
  bool bam_ok = false;
  string newpath = _zendb_dir+"/"+_db_type+".bam";
  struct stat statbuf; 

  if((stat(newpath.c_str(), &statbuf) == 0) &&  ((statbuf.st_mode & S_IFMT) == S_IFREG)) {
    fprintf(stderr, "bamdb internal bam file already exists.\n");
    //unlink(newpath.c_str());
    _parameters["_bam_loc"] = "ok";
    bam_ok=true;
  }

  if(_parameters["_bam_loc"] == "link") {
    if(link(filepath.c_str(), newpath.c_str()) == 0) {
      filepath = newpath;
      fprintf(stderr, "hard link to %s\n", filepath.c_str());    
      bam_ok=true;
    } else {
      fprintf(stderr, "hard link failed, perform copy\n");
      _parameters["_bam_loc"] = "copy";
    }
  }

  if(_parameters["_bam_loc"] == "symlink") {
    if(symlink(filepath.c_str(), newpath.c_str()) == 0) {
      filepath = newpath;
      fprintf(stderr, "symbolic link to %s\n", filepath.c_str());    
      bam_ok=true;
    } else {
      fprintf(stderr, "soft link failed, perform copy\n");
      _parameters["_bam_loc"] = "copy";
    }
  }

  if(_parameters["_bam_loc"] == "copy") {
    string cmd = "cp "+filepath + " " + newpath;
    fprintf(stderr, "%s\n", cmd.c_str());
    if(system(cmd.c_str()) == 0) {
      filepath = newpath;
      fprintf(stderr, "copy to %s\n", filepath.c_str());    
      bam_ok=true;
    } else {
      fprintf(stderr, "copy failed\n");
    }
  }
  if(!bam_ok) {
    fprintf(stderr, "problem moving bam into bamdb %s\n", filepath.c_str());    
    return "ERROR problem moving bam into bamdb";
  }
  
  //else {
    //leave BAM file in original location
    //this option is for network-disk environments where hardlinks 
    //fprintf(stderr, "used shared location %s\n", filepath.c_str());    
  //}
  _parameters["bam_path"] = filepath;

  string cmd;
  if(!_read_bam_header()) {
    return _parameters["_parse_error"];
  }
  
  if(_parameters.find("genome_assembly")==_parameters.end()) {
    fprintf(stderr, "warning genome_assembly not set\n");
    return "ERROR genome assembly not set";
  }    
  
  // try to Create index
  bool index_failed = false;
  string bai_path = filepath + ".bai";
  fprintf(stderr, "create index %s.bai\n", filepath.c_str());
  cmd = "samtools index " + filepath;
  fprintf(stderr, "%s\n", cmd.c_str());
  if(system(cmd.c_str()) != 0) { index_failed = true; }

  if(index_failed || (stat(bai_path.c_str(), &statbuf) != 0)) {
    fprintf(stderr, "failed to make index so sort and index\n");

    // sort bam file
    fprintf(stderr, "sort bam file %s\n", filepath.c_str());
    string prename = filepath + ".pre";
    rename(filepath.c_str(), prename.c_str());
    //cmd = "mv " + filepath + " " + prename;
    //fprintf(stderr, "%s\n", cmd.c_str());
    //system(cmd.c_str());
    cmd = "samtools sort " + prename +" "+ _zendb_dir+"/"+_db_type;
    fprintf(stderr, "%s\n", cmd.c_str());
    if(system(cmd.c_str()) != 0) {
      fprintf(stderr, "failed to sort bam file %s\n", filepath.c_str());
      return "ERROR failed to sort bam file";
    }
    unlink(prename.c_str());
  
    // Create index
    fprintf(stderr, "create index %s.bai\n", filepath.c_str());
    cmd = "samtools index " + filepath;
    fprintf(stderr, "%s\n", cmd.c_str());
    if(system(cmd.c_str()) != 0) {
      fprintf(stderr, "failed to index bam file %s\n", filepath.c_str());
      return "ERROR failed to index bam file";
    }
  }
  
  /*
  // check index
  if(!_bam_reader->LocateIndex()) {
    fprintf(stderr, "Could not create index file %s\n", filepath.c_str());
    return "ERROR could not create index file";
  }
  */

  
  //create primary featuresource with metadata
  _primary_featuresource();
  _primary_source->name(_parameters["_filename"]);
  _primary_source->category("bam");  
  EEDB::MetadataSet *mdset = _primary_source->metadataset();
  EEDB::Metadata *md;

  mdset->add_tag_data("input_filename", _parameters["_filename"]);
  mdset->add_tag_symbol("eedb:assembly_name", _parameters["genome_assembly"]);

  map<string,string>::iterator    p_it;
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    
    if(((*p_it).first == "eedb:display_name") or ((*p_it).first == "display_name")) {
      if(mdset->has_metadata_like("eedb:display_name", "")) { continue; }
      mdset->add_tag_data("eedb:display_name", (*p_it).second);
      continue;
    }
    
    if(((*p_it).first == "eedb:description") or ((*p_it).first == "description")) {
      if(mdset->has_metadata_like("description", "")) { continue; }
      if(mdset->has_metadata_like("eedb:description", "")) { continue; }
      mdset->add_tag_data("description", (*p_it).second);
      continue;
    }    

    //add everything else
    mdset->add_tag_data((*p_it).first, (*p_it).second);
  }
  if(!mdset->has_metadata_like("eedb:display_name", "")) { 
    mdset->add_tag_data("eedb:display_name", _parameters["_filename"]);
  }

  md = mdset->find_metadata("gff_mdata", "");
  if(md) { mdset->add_from_gff_attributes(md->data()); }
  
  mdset->remove_duplicates();

  //create primary experiment
  _primary_experiment = _create_experiment();
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("tagcount"));
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("mapquality"));
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("q20_tpm"));
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("tpm"));
  if(_parameters.find("eedb:platform")!=_parameters.end()) {
    _primary_experiment->platform(_parameters["eedb:platform"]);
    _primary_experiment->metadataset()->add_tag_data("eedb:platform", _parameters["eedb:platform"]);
  } else {
    md = mdset->find_metadata("sam:platform_unit", "");
    if(md) {
      _primary_experiment->platform(md->data());
    }
  }
  _initialized = true;

  //save final version of XML
  _save_xml();
  
  //copy to deploy directory
  _copy_self_to_deploy_dir();  

  calc_total_counts();
  
  string url = _db_type+"://" + _zendb_dir;
  return url;
}


bool  EEDB::SPStreams::BAMDB::_read_bam_header() {
  string cmd;
  //first check for valid header
  cmd = "samtools view -H " + _zendb_dir+"/"+_db_type + ".bam";
  //fprintf(stderr, "%s\n", cmd.c_str());
  
  _primary_featuresource();
  EEDB::MetadataSet *mdset = _primary_source->metadataset();
  
  FILE* fp = popen(cmd.c_str(), "r");
  if(!fp) { 
    _parameters["_parse_error"] = "ERROR unable to read BAM header";
    return false; 
  }

  bool ignore_asmb = false;
  if(_parameters.find("ignore_internal_assembly")!=_parameters.end()) { ignore_asmb = true; }
  assembly();
  
  char buffer[8192];
  while(!feof(fp) && (fgets(buffer, 8192, fp)!=NULL)) {
    //parse sequence/assembly
    //@HD	VN:1.0
    //@SQ	SN:chr1	LN:249250621	AS:hg19	SP:Homo sapiens

    if(strncmp(buffer, "@SQ",3) ==0) {
      //fprintf(stderr, "SQ line\n");
      map<string, string> sq_hash;
      char* tok = strtok(buffer+3, "\t\n\r");
      while(tok!=NULL) {
        if(strlen(tok) >3) {
          //fprintf(stderr, "  tok[%s]\n", tok);
          tok[2] = '\0';
          //fprintf(stderr, "  [%s] = [%s]\n", tok, tok+3);
          sq_hash[tok] = tok+3;
        }
        tok = strtok(NULL, "\t\n\r");
      }
      
      if(sq_hash.find("AS") != sq_hash.end()) {
        if(_parameters.find("genome_assembly")==_parameters.end()) {
          _parameters["genome_assembly"] = sq_hash["AS"];
          assembly();
        }
        if(!ignore_asmb && (_parameters["genome_assembly"] != sq_hash["AS"])) {
          //fprintf(stderr, "warning BAM internal assembly does not match [%s] != [%s]\n", 
          //        _parameters["genome_assembly"].c_str(), (*it1).AssemblyID.c_str());
          _parameters["_parse_error"] = "ERROR internal assembly in BAM does not match specified assembly name";
          return false;
        }
      }
      
      if(assembly() && (sq_hash.find("SN") != sq_hash.end())) {
        //fprintf(stderr, "add chrom %s\n", sq_hash["SN"].c_str());
        EEDB::Chrom *chrom = assembly()->get_chrom(sq_hash["SN"].c_str());
        if(chrom) { fprintf(stderr, "%s\n", chrom->xml().c_str()); }
      }      
    }
    
    
    //get metadata from readgroup
    //@RG	ID:CThi10060.3959-67E4.GAT	SM:3959-67E4	LB:CThi10060	DS:	PU:Illumina (HiSeq2000; Single-Read; 50base)	CN:GeNAS	DT:2012-01-06 00:00:00	PL:OP-SOLEXA-96CAGE-v3.3
    if(strncmp(buffer, "@RG",3) ==0) {
      //fprintf(stderr, "RG line: %s", buffer+3);
      map<string, string> rg_hash;
      char* tok = strtok(buffer+3, "\t\n\r");
      while(tok!=NULL) {
        if(strlen(tok) >3) {
          //fprintf(stderr, "  tok[%s]\n", tok);
          tok[2] = '\0';
          fprintf(stderr, "RG [%s] = [%s]\n", tok, tok+3);
          rg_hash[tok] = tok+3;
        }
        tok = strtok(NULL, "\t\n\r");
      }
      
      map<string, string>::iterator rg_it;
      for(rg_it=rg_hash.begin(); rg_it!=rg_hash.end(); rg_it++) {
        if((*rg_it).first == "ID")  { mdset->add_tag_data("sam:id", (*rg_it).second); }
        if((*rg_it).first == "SM")  { mdset->add_tag_data("sam:sample", (*rg_it).second); }
        if((*rg_it).first == "LB")  { mdset->add_tag_data("sam:library", (*rg_it).second); }
        if((*rg_it).first == "DS")  { mdset->add_tag_data("sam:description", (*rg_it).second); }
        if((*rg_it).first == "FO")  { mdset->add_tag_data("sam:flow_order", (*rg_it).second); }
        if((*rg_it).first == "CN")  { mdset->add_tag_data("sam:center", (*rg_it).second); }
        if((*rg_it).first == "PL")  { mdset->add_tag_data("sam:platform", (*rg_it).second); }
        if((*rg_it).first == "KS")  { mdset->add_tag_data("sam:key_sequence", (*rg_it).second); }
        if((*rg_it).first == "PI")  { mdset->add_tag_data("sam:predicted_insert_size", (*rg_it).second); }
        if((*rg_it).first == "DT")  { mdset->add_tag_data("sam:production_date", (*rg_it).second); }
        if((*rg_it).first == "PG")  { mdset->add_tag_data("sam:program", (*rg_it).second); }
        if((*rg_it).first == "PU")  { mdset->add_tag_data("sam:platform_unit", (*rg_it).second); }
      }
    }
    
    //get metadata from program group
    //@PG	ID:Delve	VN:Delve 0.9	CL:/quality_control/development/bin/delve -u 1 -o /tmp/964001.1.all.q/MmHDRKHRwC.sam -m /tmp/964001.1.all.q/MNb7gyNIir/model/CNhs12317.model -t 8 align /tmp/964001.1.all.q/MNb7gyNIir/temp/CNhs12317_data/delve_seed/output/CNhs12317.2011_2_23_RikenRun9_1100FOV.fc1.ch1.10157-103A4.nobarcode.sam /tmp/964001.1.all.q/MNb7gyNIir/temp/CNhs12317_data/genome_sequence/output/hg19_female.fa 
    if(strncmp(buffer, "@PG",3) ==0) {
      //fprintf(stderr, "PG line: %s", buffer+3);
      map<string, string> pg_hash;
      char* tok = strtok(buffer+3, "\t\n\r");
      while(tok!=NULL) {
        if(strlen(tok) >3) {
          //fprintf(stderr, "  tok[%s]\n", tok);
          tok[2] = '\0';
          fprintf(stderr, "PG [%s] = [%s]\n", tok, tok+3);
          pg_hash[tok] = tok+3;
        }
        tok = strtok(NULL, "\t\n\r");
      }
      
      map<string, string>::iterator pg_it;
      for(pg_it=pg_hash.begin(); pg_it!=pg_hash.end(); pg_it++) {
        if((*pg_it).first == "PN")  { mdset->add_tag_data("sam:program_name", (*pg_it).second); }
        if((*pg_it).first == "ID")  { mdset->add_tag_data("sam:program_id", (*pg_it).second); }
        if((*pg_it).first == "CL")  { mdset->add_tag_data("sam:command_line", (*pg_it).second); }
        if((*pg_it).first == "DS")  { mdset->add_tag_data("sam:program_description", (*pg_it).second); }
        if((*pg_it).first == "VN")  { mdset->add_tag_data("sam:program_version", (*pg_it).second); }
      }
    }
    
  }
  pclose(fp);
  
  _save_xml();

  return true;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// connection and initialization methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::BAMDB*  EEDB::SPStreams::BAMDB::new_from_url(string url) {
  EEDB::SPStreams::BAMDB*   bamdb = new EEDB::SPStreams::BAMDB();
  if(!bamdb->_init_from_url(url)) {
    delete bamdb;
    return NULL;
  }
  return bamdb;
}


bool EEDB::SPStreams::BAMDB::_init_from_url(string url) {

  //cout << url << endl;

  if(!EEDB::SPStreams::ZenDB::_init_from_url(url)) { return false; }

  peer();

  //determine of using an internal or external bam file
  struct stat statbuf; 
  string path = _zendb_dir + "/"+_db_type+".bam";
  if(stat(path.c_str(), &statbuf) == 0) {
    _parameters["bam_path"] = path;
    //fprintf(stderr, "BAMDB using internal bam file [%s]\n", path.c_str());
    return true;
  }

  //cout << _parameters["bam_path"] << endl;

  // otherwise check bam_path variable and stat file
  // and check file access ability of file with file stat
  path = _parameters["bam_path"];

  if (boost::starts_with(path,"ftp://")) {
	  //fprintf(stderr, "BAMDB using ftp remote bam file [%s]\n", path.c_str());
	  return true;
  } else if(stat(path.c_str(), &statbuf) == 0) {
    //fprintf(stderr, "BAMDB using remote bam file [%s]\n", path.c_str());
    return true;
  }
  
  return false;
}


bool  EEDB::SPStreams::BAMDB::_init_from_xmldb() {
  // ZENBU 2.xxx version all use XML database internally  
  string                    path = _zendb_dir + "/"+_db_type+".xml";
  int                       fildes;
  off_t                     cfg_len;
  char*                     config_text;
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node, *section_node;
  
  if(_initialized) { return true; }  

  peer();
  
  //fprintf(stderr,"BAMDB::_init_from_xmldb [%s]\n", path.c_str());
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
  if((root_node->name() != string("zendb")) and (root_node->name() != string("oscfile"))) { return false; }
  
  // parameters section
  /*
  section_node = root_node->first_node("parameters");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(string(node->name()) == "input_file") { _parameters["_inputfile"] = node->value(); } 
      else { _parameters[node->name()] = node->value(); }
      node = node->next_sibling();
    }
  }
  */
  
  // sources section
  section_node = root_node->first_node("sources");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(strcmp(node->name(), "experiment")==0) {
        EEDB::Experiment *exp = new EEDB::Experiment(node, _load_source_metadata);
        if(_self_peer) { exp->peer_uuid(_self_peer->uuid()); }
        exp->metadataset()->remove_metadata_like("keyword", "");
        exp->metadataset()->remove_duplicates();
        _add_datasource(exp);
        _primary_experiment = exp;
        exp->release();
      }
      if(strcmp(node->name(), "featuresource")==0) {
        EEDB::FeatureSource *fsrc = new EEDB::FeatureSource(node);
        fsrc->is_visible(false);
        fsrc->is_active(true);
        if(_self_peer) { fsrc->peer_uuid(_self_peer->uuid()); }
        fsrc->metadataset()->remove_metadata_like("keyword", "");
        fsrc->metadataset()->remove_duplicates();
        _add_datasource(fsrc);
        //this hides the FeatureSource on the source streams and security checks
        //but still maintains the current class design
        //in prep for future 3.0 release which only will use DataSource, may break some configs though
        if(fsrc->primary_id() == 1) { 
          _primary_source = fsrc;
          fsrc->retain();
        }
        fsrc->release();
      }
      if(strcmp(node->name(), "edge_source")==0) {
        //not needed at this time
      }
      node = node->next_sibling();
    }
  }
  free(config_text);

  // post processing    
  assembly();  //generate if parameter is set

  //transfer the create date to experiment (patch)
  if(_primary_source && _primary_experiment) {
    _primary_experiment->create_date(_primary_source->create_date());
  }
  
  //post-adjust the datasources (patching for 3.0)
  /*
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source->classname() == EEDB::FeatureSource::class_name) {
      source->is_visible(false);
      source->is_active(false);
    }
    if(source->classname() == EEDB::Experiment::class_name) {
      _primary_experiment = (EEDB::Experiment*)source;
      _primary_experiment->add_datatype(EEDB::Datatype::get_type("tagcount"));
      _primary_experiment->add_datatype(EEDB::Datatype::get_type("mapquality"));
      _primary_experiment->add_datatype(EEDB::Datatype::get_type("q20_tpm"));
    }
  }
  */
  
  _database = NULL;
  
  if(!_sources_cache.empty()) { _sources_cache_loaded = true; }
  _initialized = true;
  return true;
}


//
//////////////////////////////////////////////////////////////////////////////////////////////////
//

MQDB::DBObject* EEDB::SPStreams::BAMDB::_fetch_object_by_id(string fid) {
  if(peer_uuid() == NULL) { return NULL; }

  string uuid;
  string objClass="Feature";
  long int objID = -1;

  unparse_eedb_id(fid, uuid, objID, objClass);

  if(uuid.empty()) { return NULL; }
  if(uuid != string(_peer_uuid)) { return NULL; }
  
  if(objClass == "Feature") { return _fetch_feature_by_id(objID); }
  else { 
    // first check if we need to reload sources
    _reload_stream_data_sources(); 
    return _sources_cache[fid]; 
  }
  return NULL;
}


EEDB::Feature*  EEDB::SPStreams::BAMDB::_fetch_feature_by_id(long int feature_id) {
  //TO BE IMPLEMENTED BY SUBCLASS
  return NULL;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  source streaming section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::BAMDB::_stream_data_sources(string classname, string filter_logic) {
  if(!_source_is_active) { return; }
  
  // first check if we need to reload
  _reload_stream_data_sources();
  
  //then call the superclass method
  EEDB::SPStreams::SourceStream::_stream_data_sources(classname, filter_logic);
}


void EEDB::SPStreams::BAMDB::_get_dependent_datasource_ids(map<string,bool> &source_ids) {
  if(!_source_is_active) { return; }
  
  _reload_stream_data_sources();  //internal method not superclass and function redirect
  
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }
    
    if(_stream_is_datasource_filtered) {
      if(!_filter_source_ids[source->db_id()]) { continue; }
    }
    
    source_ids[source->db_id()] = true;
  }
  if(_database) { _database->disconnect(); }
}


void EEDB::SPStreams::BAMDB::_reload_stream_data_sources() {
  // first check if we need to reload
  //fprintf(stderr," BAMDB::_reload_stream_data_sources [%s]\n", _peer_uuid);
  struct stat statbuf;
  string path;
  if(_version==1) { path = _zendb_dir + "/"+_db_type+".sqlite"; }
  if(_version==2) { path = _zendb_dir + "/"+_db_type+".xml"; }
  if(stat(path.c_str(), &statbuf) == 0) {
    if(_modify_time != statbuf.st_mtime) { 
      _modify_time = statbuf.st_mtime;
      fprintf(stderr, "%s _reload_stream_data_sources [%s]\n", _db_type.c_str(), _peer_uuid);
      _initialized = false;
      _sources_cache_loaded = false;
      _sources_cache.clear();  //clear old cache
      _init_from_xmldb();      
    }
  }
}


//
////////////////////////////////////////////////////////////////////////////////////////////////////////
//

/***** next_in_stream

  Description: since this is a source, it needs to override this method and 
               do appropriate business logic to control the stream.
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

*****/

MQDB::DBObject* EEDB::SPStreams::BAMDB::_next_in_stream() {
  //_source_stream is a Buffer for sources,chroms....
  if(_source_stream != NULL) {
    MQDB::DBObject *obj = _source_stream->next_in_stream();
    //if no more objects then clear the source_stream()
    if(obj == NULL) { 
      _source_stream->release();
      _source_stream = NULL;
      _disconnect();
    }
    return obj;
  }

  if(_region_set) {
    EEDB::Feature *feature = _next_feature();
    if(!feature) {
      //fprintf(stderr, "BAMDB (%ld) finished\n", (long)this);
      _region_set = false;
      _disconnect();
    }
    return feature;
  }
  return NULL;  
}


/***** stream_clear
  Description: re-initialize the stream-stack back to a clear/empty state
*****/

void EEDB::SPStreams::BAMDB::_stream_clear() {
  //fprintf(stderr, "BAMDB::_stream_clear (%ld)\n", (long)this);
  _disconnect();
}

/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::BAMDB::_reset_stream_node() {
  //fprintf(stderr, "BAMDB::_reset_stream_node (%ld)\n", (long)this);
  EEDB::SPStreams::SourceStream::_reset_stream_node();
  _init_from_xmldb();  //make sure it is initialized now  
  _region_set     = false;
  _region_start   = -1;
  _region_end     = -1;
  if(_samlib_fp) { 
    samclose(_samlib_fp);
    _samlib_fp = NULL;
    bam_iter_destroy(_samlib_iter);
    bam_destroy1(_samlib_bam_align);
  }
}


void EEDB::SPStreams::BAMDB::_disconnect() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  EEDB::SPStreams::ZenDB::_disconnect();
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  if(_samlib_fp) { 
    samclose(_samlib_fp);
    _samlib_fp = NULL;
    bam_iter_destroy(_samlib_iter);
    bam_destroy1(_samlib_bam_align);
  }  
  _region_set     = false;
  _region_start   = -1;
  _region_end     = -1;

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  //fprintf(stderr, "BAMDB::_disconnect (%ld) %1.6f sec\n", (long)this, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}


bool  EEDB::SPStreams::BAMDB::_stream_by_named_region(string asm_name, string chrom_name, long int start, long int end) {
  //fprintf(stderr,"BAMDB::_stream_by_named_region [%s] %s %s %ld .. %ld\n", peer_uuid(), asm_name.c_str(), chrom_name.c_str(), start, end);
  _region_set     = false;
  _region_start   = -1;
  _region_end     = -1;
  
  if(!_source_is_active) { return true; }
  
  //initialize if not already
  if(!experiment()) { return false; }  //some error
  
  //check assembly
  if(asm_name != assembly()->assembly_name()) { return true; }  //if wrong assembly then return empty stream
  
  _add_expression = false;
  if((_sourcestream_output == "feature") ||
     (_sourcestream_output == "express") ||
     (_sourcestream_output == "simple_express") ||
     (_sourcestream_output == "skip_metadata")) { 
    _add_expression = true; 
  }
  _add_subfeatures = false;
  if((_sourcestream_output == "feature") ||
     (_sourcestream_output == "express") ||
     (_sourcestream_output == "subfeature") ||
     (_sourcestream_output == "skip_expression") ||
     (_sourcestream_output == "skip_metadata")) { 
    _add_subfeatures = true;
  }
  _add_metadata = false;
  if((_sourcestream_output == "feature") ||
     (_sourcestream_output == "skip_expression")) {
    _add_metadata = true;
  }
  
  if(start < 1) { start = 1; }
  _region_set        = true;
  _region_start      = start;
  _region_end        = end;
  //fprintf(stderr, "bamdb region %s start=%ld  end=%ld\n", chrom_name.c_str(), _region_start, _region_end);
  
  //new samtools-lib  mode
  string file = _zendb_dir+"/"+_db_type + ".bam";
  _samlib_fp = samopen(file.c_str(), "rb", 0);
  if (_samlib_fp == 0) {  
    fprintf(stderr, "Fail to open BAM file %s\n", file.c_str());  
    return false;  
  }
  string chrom_loc = chrom_name+":";
  if(_region_end == -1) { 
    char buf1[256];
    sprintf(buf1, "%ld", _region_start);
    chrom_loc += buf1;
  } else {
    char buf1[256];
    sprintf(buf1, "%ld-%ld", _region_start, _region_end);
    chrom_loc += buf1;
  }
  
  int chrom_ref, tbeg, tend;
  bam_parse_region(_samlib_fp->header, chrom_loc.c_str(), &chrom_ref, &tbeg, &tend); // parse the region  
  if(chrom_ref < 0) {
    fprintf(stderr, "samlib Invalid region %s [%s] [%s]\n", chrom_loc.c_str(), _peer_uuid, _zendb_dir.c_str());
    samclose(_samlib_fp);
    _samlib_fp = NULL;
    _region_set     = false;
    _region_start   = -1;
    _region_end     = -1;
    return true; //return true because this region chrom_ref is not known, never fails for beg/end out ot range
    //treat as if it is an empty region, rather than a fail condition
  }
  //fprintf(stderr, "samlib loc[%s] => %d %d %d\n", chrom_loc.c_str(), chrom_ref, tbeg, tend);
  
  bam_index_t *idx = bam_index_load(file.c_str()); // load BAM index  
  if(idx == 0) {  
    fprintf(stderr, "samlib BAM indexing file [%s] is not available\n", file.c_str());
    samclose(_samlib_fp);
    _samlib_fp = NULL;
    return false;  
  }
  _samlib_iter = bam_iter_query(idx, chrom_ref, tbeg, tend);
  bam_index_destroy(idx);  //only need the index open to start the bam_iter

  _samlib_bam_align = bam_init1();
  return true;
}


EEDB::Feature* EEDB::SPStreams::BAMDB::_next_feature() {
  if(!_region_set) return NULL;
  
  EEDB::Feature *feature = NULL;
  while(1) {
    if(feature) { //clean up from previous loop
      feature->release();
      feature=NULL;
    }
    
    //samtools-lib mode
    if(!_samlib_fp) return NULL;
    int ret = bam_iter_read(_samlib_fp->x.bam, _samlib_iter, _samlib_bam_align);
    if(ret<0) {
      //fprintf(stderr, "BAMDB [%s] stream finished\n", _peer_uuid);
      return NULL;
    }
        
    feature = _convert_to_feature(_samlib_bam_align);

    if(!feature) { return NULL; }
    if(!feature->chrom()) { 
      //fprintf(stderr,"SKIP unaligned feature\n");
      continue; 
    }
    if(feature->chrom_end() < _region_start) {
      fprintf(stderr,"SKIP pre-start f.end=%ld  r.start=%ld\n", feature->chrom_end(), _region_start);
      continue;
    }
    if(_add_expression && _primary_experiment && feature->expression_array().empty()) {
      //supposed to have expression, but no expression added -> so it should be filtered out
      continue;
    }
        
    //everything is ok so break
    break;
  }
  
  if(!feature) { return NULL; }
  if((_region_end!=-1) and (feature->chrom_start() > _region_end)) {
    feature->release(); 
    feature=NULL;
  }
  return feature;
}


EEDB::Feature* EEDB::SPStreams::BAMDB::_convert_to_feature(bam1_t *al) {
  if(!al) { return NULL; }
  
  EEDB::Feature *feature = EEDB::Feature::realloc();
  
  //create all internal data structures so that lazyload is not triggered later
  feature->metadataset(); 
  feature->load_expression();
  feature->subfeatures();
  
  // set attributes
  //feature->primary_id(al->Bin);  // BAM (standard) index bin number for this alignment.
  feature->primary_name(bam_get_qname(al));  
  feature->feature_source(_primary_source);
  feature->significance(al->core.qual);
  feature->chrom_start(al->core.pos+1);  // position (0-based) where alignment starts
  
  //chrom
  if(al->core.tid >= 0) { // chr
    char* chr_name = _samlib_fp->header->target_name[al->core.tid];
    EEDB::Chrom *chrom = assembly()->get_chrom(chr_name);
    feature->chrom(chrom);
    //TODO: manage multiple assemblies
  }
  
  //strand
  long int flags = al->core.flag;
  if(flags & 0x0010) { feature->strand('-'); } else { feature->strand('+'); }
  if(flags & 0x0004) { /*fprintf(stderr, "0x04 unmapped\n");*/ feature->chrom(NULL); }
  if(flags & 0x0001) {  //paired reads
    //fprintf(stderr, "paired read\n");
    //if(!(flags & 0x0002)) { /*fprintf(stderr, "0x08 pair is unaligned\n");*/ feature->chrom(NULL); }
    //if(flags & 0x0008) { /*fprintf(stderr, "0x08 pair is unaligned\n");*/ feature->chrom(NULL); }
    //if(flags & 0x0040) { } //fprintf(stderr, "0x40 mate1\n");
    //if(flags & 0x0080) { } //fprintf(stderr, "0x80 mate2\n");
    if(flags & 0x0080) { //fprintf(stderr, "0x80 mate2\n");         
      if(flags & 0x0020) { feature->strand('-'); } else { feature->strand('+'); }
    }
    //if(flags & 0x0040) { feature->chrom(NULL); }  //debuging remove the first mate (only shows mate2)
    //if(flags & 0x0080) { feature->chrom(NULL); }  //debuging remove the second mated (only shows mate1)

    if(_parameters["flip_mated_pair_orientation"] == "yes") {
      char strand = feature->strand();
      if(strand == '+') { feature->strand('-'); }
      if(strand == '-') { feature->strand('+'); }
    }
  } else {
    //fprintf(stderr, "single read\n");
  }

  //expression
  if(_add_expression && _primary_experiment) {  
    if(_expression_datatypes.find("tagcount") != _expression_datatypes.end()) {
      feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("tagcount"), 1.0);
    }
    
    if(_expression_datatypes.find("mapquality") != _expression_datatypes.end()) {
      feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("mapquality"), al->core.qual);
    }
    
    if(_expression_datatypes.find("q3_tpm") != _expression_datatypes.end()) {
      if(q3_count() > 0 && (al->core.qual>= 3)) {
        double value = 1000000.0 / _q3_count;
        feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("q3_tpm"), value);
      }
    }
    
    if(_expression_datatypes.find("q20_tpm") != _expression_datatypes.end()) {
      if(q20_count() > 0 && (al->core.qual>= 20)) {
        double value = 1000000.0 / _q20_count;
        feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("q20_tpm"), value);
      }
    }
    
    if(_expression_datatypes.find("q40_tpm") != _expression_datatypes.end()) {
      if(q40_count() > 0 && (al->core.qual>= 40)) {
        double value = 1000000.0 / _q40_count;
        feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("q40_tpm"), value);
      }
    }
    
    if(_expression_datatypes.find("tpm") != _expression_datatypes.end()) {
      if(total_count() > 0) {
        double value = 1000000.0 / _total_count;
        feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("tpm"), value);
      }
    }
  }

  
  //seqeunce of the read
  if(_add_metadata) {
    uint8_t *seq_p = bam_get_seq(al);
    char samseq[al->core.l_qseq+1]; // need +1 for \0 at end
    char BASES[17] = "=ACMGRSVTWYHKDBN";
    for(int32_t i = 0; i < al->core.l_qseq; ++i) {
      samseq[i] = BASES[bam_seqi(seq_p, i)];
    }
    samseq[al->core.l_qseq] = '\0'; // null terminate for proper std::string construciton
    feature->metadataset()->add_tag_data("sam:seq", string(samseq));
  } 

  //cigar parsing for length and optional subfeatures
  uint32_t *cigar = NULL;
  if(al->core.n_cigar) { cigar = bam_get_cigar(al); }
  
  long int curr_pos = 0;
  long int curr_block_size = 0;
  long int bidx = 1;
  string cigar_str;
  char strbuf[256];
  for(unsigned i = 0; i < al->core.n_cigar; ++i) {
    char     op = bam_cigar_opchr(cigar[i]);
    long int len = bam_cigar_oplen(cigar[i]);
    if(_add_metadata) {
      sprintf(strbuf, "%ld%c", len, op);
      cigar_str += strbuf;
    }

    if((op == 'M') || (op == 'X') || (op == '=')) {
    //if(op == 'M') {
      //// M  Alignment match (can be a sequence match or mismatch)
      curr_block_size += len;
    }
    else if(op == 'D') {
      // D  Deletion from the reference (base(s) in reference, missing from sequence tag)
      // choice of either expanding block size, or creating new subfeature
      
      curr_block_size += len;
      
      /* -- alternate mode that small deletes create subfeatures
       if(curr_block_size>0) {
       create_subfeature(source, curr_pos, curr_block_size, bidx);
       bidx++;
       }
       curr_pos += curr_block_size + len;
       curr_block_size = 0;
       */
    }
    else if(op == 'N') {
      //// N  Skipped region from the reference
      if(curr_block_size>0) {
        if(_add_subfeatures) { _create_subfeature(feature, "block", bidx, curr_pos, curr_block_size); }
        bidx++;
      }
      curr_pos += curr_block_size + len;
      curr_block_size = 0;
    } 
    //elsif($op == 'S') {
    //// S  Soft clip on the read (clipped sequence present in <seq>)
    //} elsif($op == 'H') {
    //// H  Hard clip on the read (clipped sequence NOT present in <seq>)
    //} elsif ($op == 'I') {
    //// I  Insertion to the reference
    //} elsif ($op == 'P') {
    //// P  Padding (silent deletion from the padded reference sequence)
    //} else {
    //unrecognized cigar operator
    //}
  }
  if(curr_block_size>0 && _add_subfeatures) {
    _create_subfeature(feature, "block", bidx, curr_pos, curr_block_size);
    curr_pos += curr_block_size;
  }
  if(_add_metadata) { feature->metadataset()->add_tag_data("sam:cigar", cigar_str); }

  // Calculates alignment end position, based on starting position and CIGAR data. (default usePadded=false, zeroBased=true)
  feature->chrom_end(feature->chrom_start() + curr_pos -1);

  return feature;
}
  

////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// methods for building and loading new BAM file into BAMDB
//
////////////////////////////////////////////////////////////////////////////////////////////////////////

EEDB::Experiment*  EEDB::SPStreams::BAMDB::experiment() {
  if(_primary_experiment) { return _primary_experiment; }
  
  _init_from_xmldb();

  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(source->classname() != EEDB::Experiment::class_name) { continue; }
    _primary_experiment = (EEDB::Experiment*)source;
    break;
  }

  return _primary_experiment;
}

long long  EEDB::SPStreams::BAMDB::q3_count() {
  if(_q3_count > 0) { return _q3_count; }
  
  //check metadata
  //fprintf(stderr, "BAMDB::calc_q3_count\n");
  if(!experiment()) { return -1; }
  
  EEDB::MetadataSet  *mdset = _primary_experiment->metadataset();
  EEDB::Metadata     *md = mdset->find_metadata("q3_total_count", "");
  if(md) { 
    _q3_count = strtol(md->data().c_str(), NULL, 10);
    return _q3_count;
  }
  
  calc_total_counts();
  return _q3_count;
}

long long  EEDB::SPStreams::BAMDB::q20_count() {
  if(_q20_count > 0) { return _q20_count; }
  
  //check metadata
  //fprintf(stderr, "BAMDB::calc_q20_count\n");
  if(!experiment()) { return -1; }
  
  EEDB::MetadataSet  *mdset = _primary_experiment->metadataset();
  EEDB::Metadata     *md = mdset->find_metadata("q20_total_count", "");
  if(md) { 
    _q20_count = strtol(md->data().c_str(), NULL, 10);
    return _q20_count;
  }
  
  calc_total_counts();
  return _q20_count;
}

long long  EEDB::SPStreams::BAMDB::q40_count() {
  if(_q40_count > 0) { return _q40_count; }
  
  //check metadata
  //fprintf(stderr, "BAMDB::calc_q40_count\n");
  if(!experiment()) { return -1; }
  
  EEDB::MetadataSet  *mdset = _primary_experiment->metadataset();
  EEDB::Metadata     *md = mdset->find_metadata("q20_total_count", "");
  if(md) { 
    _q40_count = strtol(md->data().c_str(), NULL, 10);
    return _q40_count;
  }
  
  calc_total_counts();
  return _q40_count;
}


long long  EEDB::SPStreams::BAMDB::total_count() {
  if(_total_count > 0) { return _total_count; }
  
  //check metadata
  if(!experiment()) { return -1; }
  
  EEDB::MetadataSet  *mdset = _primary_experiment->metadataset();
  EEDB::Metadata     *md = mdset->find_metadata("tagcount_total", "");
  if(md) { 
    _total_count = strtol(md->data().c_str(), NULL, 10);
    return _total_count;
  }
  
  calc_total_counts();
  return _total_count;
}


bool  EEDB::SPStreams::BAMDB::calc_total_counts() {
  struct timeval    starttime,endtime,difftime;
  double            rate;

  gettimeofday(&starttime, NULL);

  if(!experiment()) { return false; }
  //fprintf(stderr, "BAMDB::calc_total_counts\n");
  
  //scan the BAM file and calculate  
  _total_count = 0;
  _q3_count = 0;
  _q20_count = 0;
  _q40_count = 0;
  _unaligned_count = 0;

  _primary_experiment->metadataset()->remove_metadata_like("tagcount_total", "");
  _primary_experiment->metadataset()->remove_metadata_like("q3_total_count", "");
  _primary_experiment->metadataset()->remove_metadata_like("q20_total_count", "");
  _primary_experiment->metadataset()->remove_metadata_like("q40_total_count", "");
  _primary_experiment->metadataset()->remove_metadata_like("unaligned_total_count", "");
  _primary_experiment->metadataset()->remove_metadata_like("tpm_total", ""); //legacy

  //reset the datatypes
  _primary_experiment->clear_datatypes();
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("tagcount"));
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("mapquality"));

  
  //new samtools-lib  mode
  string file = _zendb_dir+"/"+_db_type + ".bam";
  _samlib_fp = samopen(file.c_str(), "rb", 0);
  if (_samlib_fp == 0) {  
    fprintf(stderr, "Fail to open BAM file %s\n", file.c_str());  
    return false;  
  }
    
  char buffer[8192];
  _samlib_bam_align = bam_init1();

  int ret=0;
  int in_count=0;
  do {
    ret = bam_read1(_samlib_fp->x.bam, _samlib_bam_align);  
    in_count++;

    if(in_count % 100000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      rate = (double)_total_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr,"%10lld features  %13.2f obj/sec", _total_count, rate);
      fprintf(stderr," q3=%lld  q20=%lld  q40=%lld unalign=%lld", _q3_count, _q20_count, _q40_count, _unaligned_count);
      fprintf(stderr,"\n");
    }

    EEDB::Feature *feature = _convert_to_feature(_samlib_bam_align);
    if(!feature) { 
      fprintf(stderr, "could not parse feature line\n");
      _unaligned_count++;
      continue; 
    }
    if(!feature->chrom()) { 
      //fprintf(stderr, "could not parse chrom\n"); 
      feature->release();
      _unaligned_count++;
      continue; 
    }
    //fprintf(stderr, "yeah feature\n!");

    _total_count++;
    //osc parser puts mapq into the score/significance
    if(feature->significance() >= 3)  { _q3_count++; }
    if(feature->significance() >= 20) { _q20_count++; }
    if(feature->significance() >= 40) { _q40_count++; }
    
    feature->release(); 
  } while(ret>=0);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)_total_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr,"%10lld features  %13.2f obj/sec", _total_count, rate);
  fprintf(stderr,"  %1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr," aligned %lld\n", _total_count);
  fprintf(stderr," q3      %lld\n q20     %lld\n q40     %lld\n unalign %lld\n", _q3_count, _q20_count, _q40_count, _unaligned_count);

  //store as metadata
  _primary_experiment->clear_xml_caches();

  snprintf(buffer, 2040, "%lld", _total_count);
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("tpm"));
  _primary_experiment->metadataset()->add_tag_data("tagcount_total", string(buffer));

  snprintf(buffer, 2040, "%lld", _q3_count);
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("q3_tpm"));
  _primary_experiment->metadataset()->add_tag_data("q3_total_count", string(buffer));

  snprintf(buffer, 2040, "%lld", _q20_count);
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("q20_tpm"));
  _primary_experiment->metadataset()->add_tag_data("q20_total_count", string(buffer));
    
  snprintf(buffer, 2040, "%lld", _q40_count);
  _primary_experiment->add_datatype(EEDB::Datatype::get_type("q40_tpm"));
  _primary_experiment->metadataset()->add_tag_data("q40_total_count", string(buffer));

  snprintf(buffer, 2040, "%lld", _unaligned_count);
  _primary_experiment->metadataset()->add_tag_data("unaligned_total_count", string(buffer));
  
  //fprintf(stderr, "q20_total_count %lld %s\n", _q20_count, _primary_experiment->db_id().c_str());
  fprintf(stderr, "%s\n", _primary_experiment->xml().c_str());

  _primary_experiment->metadataset()->remove_duplicates();
  _save_xml();
    
  samclose(_samlib_fp);
  _samlib_fp = NULL;
  bam_destroy1(_samlib_bam_align);

  return true;
}


long EEDB::SPStreams::BAMDB::source_file_size() {
  if(!experiment()) { return -1; }
  EEDB::Metadata  *mdata = experiment()->metadataset()->find_metadata("zenbu:source_file_size", "");
  if(mdata) {  
    long val = strtol(mdata->data().c_str(), NULL, 10);
    return val;
  }

  string file = _zendb_dir+"/"+_db_type + ".bam";
  int fildes = open(file.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return -1; } //error

  long file_size = lseek(fildes, 0, SEEK_END);
  close(fildes);

  string str1 = l_to_string(file_size);
  experiment()->metadataset()->add_tag_data("zenbu:source_file_size", str1);
  save_xmldb();

  return file_size;
}


string EEDB::SPStreams::BAMDB::source_md5sum() {
  if(!experiment()) { return ""; }
  EEDB::Metadata  *mdata = experiment()->metadataset()->find_metadata("zenbu:source_md5sum", "");
  if(mdata) {  
    return mdata->data();
  }

  string file = _zendb_dir+"/"+_db_type + ".bam";
  string cmd = "md5sum "+ file;
  string str1 = exec_result(cmd);
  if(str1.empty()) { return ""; } //can not calculate so just run 
  //fprintf(stderr, "md5sum return : [%s]\n", str1.c_str());

  std::size_t p1 = str1.find(" ");
  if(p1!=std::string::npos) { str1.resize(p1); }
  //fprintf(stderr, "md5sum [%s]\n", str1.c_str());

  //store into experiment
  experiment()->metadataset()->add_tag_data("zenbu:source_md5sum", str1);
  save_xmldb();

  return str1;
}


bool EEDB::SPStreams::BAMDB::path_to_bam_file(string &path, string &filename) {
  if(!experiment()) { return false; }

  path = _zendb_dir+"/"+_db_type + ".bam";
  struct stat statbuf; 
  if(stat(path.c_str(), &statbuf) == -1) {
    path = "";
    //fprintf(stderr, "bamdb internal bam does not exist\n");
    return false;
  }

  EEDB::Metadata *md1 = experiment()->metadataset()->find_metadata("orig_filename", "");
  //EEDB::Metadata *md2 = experiment()->metadataset()->find_metadata("input_filename", "");
  EEDB::Metadata *md3 = experiment()->metadataset()->find_metadata("upload_unique_name", "");
  EEDB::Metadata *md4 = experiment()->metadataset()->find_metadata("original_filename", ""); //older upload system
  //fprintf(stderr, "bam path ok1\n");

  if(md1) {
    //orig_filename: new system where this is the name of the original file prior to upload. Usually a full path
    //so just use this but remove the full path
    string tname = md1->data();
    //fprintf(stderr, "orig_filename [%s]\n", tname.c_str());
    std::size_t p1 = tname.rfind("/");
    if(p1!=std::string::npos) { tname = tname.substr(p1+1); }
    //fprintf(stderr, "name from orig_filename [%s]\n", tname.c_str());
    filename = tname;
  } else
  if(md4 || md3) {
    //original_filename or upload_unique_name. means same thing. 
    //the orignal filename with a uuid appended with __ after name and before .bam
    string tname;
    if(md3) { tname = md3->data(); }
    if(md4) { tname = md4->data(); }
    //fprintf(stderr, "upload_unique_name [%s]\n", tname.c_str());
    std::size_t p1 = tname.rfind("/");
    if(p1!=std::string::npos) { tname = tname.substr(p1+1); }
    p1 = tname.rfind("__");
    if(p1!=std::string::npos) { tname.resize(p1); }
    tname += ".bam";
    //fprintf(stderr, "name from upload_unique_name [%s]\n", tname.c_str());
    filename = tname;
  } else {
    //use the pathname of this BAMDB
    string tname = _zendb_dir;
    //fprintf(stderr, "name from bamdb path [%s]\n", tname.c_str());
    std::size_t p1 = tname.rfind("/");
    if(p1!=std::string::npos) { tname = tname.substr(p1+1); }
    p1 = tname.rfind("__");
    if(p1!=std::string::npos) { tname.resize(p1); }
    p1 = tname.rfind(".bamdb");
    if(p1!=std::string::npos) { tname.resize(p1); }
    tname += ".bam";
    //fprintf(stderr, "name from bamdb path [%s]\n", tname.c_str());
    filename = tname;
  }

  return true;
}

