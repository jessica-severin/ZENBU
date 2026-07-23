/* $Id: ZDXBuilder.cpp,v 1.4 2026/07/08 07:21:42 severin Exp $ */

/***

NAME - EEDB::JobQueue::ZDXBuilder

SYNOPSIS

DESCRIPTION

Specific subclass of WebBase which is focused on caching metadata from sources
in order to provide fast keyword logic searching

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
#include <string.h>
#include <string>
#include <vector>
#include <stdarg.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
//#include <yaml.h>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <unistd.h>
#include <pwd.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
//#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/Peer.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Chrom.h>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>
#include <EEDB/Expression.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/Tools/ZDXBuilder.h>
//#include <EEDB/WebServices/RegionServer.h>
#include <lz4/lz4.h>

using namespace std;
using namespace MQDB;

size_t rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp);

const char*               EEDB::Tools::ZDXBuilder::class_name = "EEDB::Tools::ZDXBuilder";

void _upload_test_read_zdx(EEDB::ZDX::ZDXstream *zdxstream);
void _feature_unique_metadata_by_type(EEDB::Feature *feature, EEDB::Metadata *new_mdata);

EEDB::Tools::ZDXBuilder::ZDXBuilder() {
  init();
}

EEDB::Tools::ZDXBuilder::~ZDXBuilder() {
}

void _eedb_job_upload_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::ZDXBuilder*)obj;
}

void EEDB::Tools::ZDXBuilder::init() {
  //MQDB::MappedQuery::init();
  _classname      = EEDB::Tools::ZDXBuilder::class_name;
  _funcptr_delete = _eedb_job_upload_delete_func;
    
  //_chunk_size    = 505000; //ie 505 kbase
  //_chunk_overlap =   5000; //ie 5 kbase
  _chunk_size    = 100000;
  _chunk_overlap = 0;
  _gff_virtual_parents = false;
  
  _parameters["genome_assembly"] = "non-genomic"; //default
}


void EEDB::Tools::ZDXBuilder::set_parameter(string tag, string value) {
  //used for debugging
  _parameters[tag] = value;
}

/***** assembly management section ******/

void  EEDB::Tools::ZDXBuilder::set_assembly(EEDB::Assembly* assembly) {
  //first one set becomes the default assembly if not previously defined
  if(assembly==NULL) { return; }
  
  if(_default_assembly!=NULL) {
    _default_assembly->release();
    _default_assembly = NULL;
  }    
  assembly->retain();
  _default_assembly = assembly;
  _parameters["genome_assembly"] = assembly->assembly_name();
}

EEDB::Assembly*  EEDB::Tools::ZDXBuilder::assembly() {
  if(_default_assembly != NULL) { return _default_assembly; }
  
  if(_parameters.find("genome_assembly") == _parameters.end()) {
    _parameters["genome_assembly"] = "non-genomic";
  }
  
  _default_assembly = new EEDB::Assembly;
  _default_assembly->assembly_name(_parameters["genome_assembly"]);
  if(_parameters["genome_assembly"] == "non-genomic") {
    //create stub chromosome for the zdx chrom/segment system
    EEDB::Chrom* chrom = _default_assembly->get_chrom("NA");
    chrom->chrom_length(1); //set to 1 so ZDX can create
  }
  //_default_assembly->owner_identity(_current_job->user()->email_identity());
  //_default_assembly->create_date(time(NULL));

  return _default_assembly;
}


/*************************************
 * 
 * 
 * 
*************************************/

EEDB::Peer*  EEDB::Tools::ZDXBuilder::create_zdx_for_file(string filepath) {  
  EEDB::Peer*  peer = NULL;
  
  struct stat statbuf;
  if(stat(filepath.c_str(), &statbuf) != 0) {
    _parameters["upload_error"] = "unable to open input file";
    fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
    return NULL; 
  }

  _parameters["_inputfile"] = filepath;
  _build_output_filename();
  
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("_parameter : %s : %s\n", (*it).first.c_str(), (*it).second.c_str());
  }

  if((_parameters["_filetype"]  == "bed") || (_parameters["_filetype"] == "osc") || (_parameters["_filetype"]  == "sam") || 
      (_parameters["_filetype"] == "gff") || (_parameters["_filetype"] == "gff2") || (_parameters["_filetype"] == "gff3") ||
      (_parameters["_filetype"] == "gtf") || (_parameters["_filetype"] == "gtf2")) {
    peer = _load_osc_file();
    if(!peer) {
      fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
      return NULL;
    }
  }

  if((_parameters["_filetype"]  == "fasta") || (_parameters["_filetype"]  == "fa") || (_parameters["_filetype"]  == "fas") ||
     (_parameters["_filetype"]  == "fasta.tar") || (_parameters["_filetype"]  == "fa.tar")) {
    //genome upload
    //TODO: check if genome name exists, to decide if loading into new or previous genome
    //<upload_genome_name>homoSap-jms1</upload_genome_name>
    //_parameters["owner_identity"] = _current_job->user()->email_identity();

    peer = _load_new_genome();
    if(!peer) {
      fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
      return NULL;
    }    
  }
  
  //registry new oscdb peer into user registry
  //EEDB::Peer *user_reg = _current_job->user()->user_registry();
  //fprintf(stderr, "%s\n", genome_peer->xml().c_str());
  //genome_peer->store(user_reg->peer_database());
  //upload_peer = genome_peer;
  
  return peer;
}

//--------------------------------------------------------------------------------
//
// ZDX building internal methids
//
//--------------------------------------------------------------------------------

string  EEDB::Tools::ZDXBuilder::_build_output_filename() {
  string filepath = _parameters["_inputfile"];
  if(filepath.empty()) { return ""; }
  
  size_t ridx = filepath.rfind("/");
  if(ridx!=string::npos) {
    _parameters["_input_dir"] = filepath.substr(0,ridx);
    filepath = filepath.substr(ridx+1);
  }
  
  string extension;    
  size_t strpos = filepath.rfind(".gz");
  if(strpos!=string::npos) { filepath.resize(strpos); }
  
  strpos = filepath.rfind(".tar");
  if(strpos!=string::npos) { filepath.resize(strpos); }

  strpos = filepath.rfind(".");
  if(strpos!=string::npos) {
    extension = filepath.substr(strpos+1);
    filepath.resize(strpos);
  }
  _parameters["_build_filename"] = filepath;
  _parameters["_filetype"] = extension;
  
  string output_path;
  if(_parameters.find("_build_dir") != _parameters.end()) { 
    //should also check to make sure the build_dir exists with a stat()
    output_path = _parameters["_build_dir"] +"/"+ filepath;
  } else if(!_parameters["_input_dir"].empty()) {
    output_path = _parameters["_input_dir"] +"/"+ filepath;
  } else {
    output_path = filepath;
  }
  _parameters["_outputfile"] = output_path;
  return output_path;  
}


/*
bool  EEDB::Tools::ZDXBuilder::process_upload_job(long job_id) {
  _current_job = EEDB::JobQueue::Job::fetch_by_id(_userDB, job_id);
  if(!_current_job) { return false; }

  EEDB::Metadata *md = _current_job->metadataset()->find_metadata("xmlpath", "");
  if(!md) { return false; }

  string xmlpath = md->data();  
  if(!read_upload_xmlinfo(xmlpath)) { 
    _parameters["upload_error"] = "unable to read upload xml config";
    return false; 
  }
  string file = _parameters["_inputfile"];
  
  struct stat statbuf;
  if(stat(file.c_str(), &statbuf) != 0) {
    _parameters["upload_error"] = "unable to open input file";
    return false; 
  }
  
  if(!_current_job->user()) {
    _parameters["upload_error"] = "no user asigned to upload job";
    return false; 
  }

  fprintf(stderr, "upload data into ZENBU [%s]\n", file.c_str());

  map<string,string>::iterator  param_it;
  bool zdxload = false;
  if(_parameters["_filetype"] == "gff") { zdxload=true; }
  if(_parameters["_filetype"] == "gff2") { zdxload=true; }
  if(_parameters["_filetype"] == "gff3") { zdxload=true; }
  if(_parameters["_filetype"] == "gtf") { zdxload=true; }
  if(_parameters["_filetype"] == "gtf2") { zdxload=true; }
  if(_parameters["build_feature_name_index"] == "true") { zdxload=true; }
  if(_parameters["load_into_zdx"] == "true") { zdxload=true; }

  _gff_virtual_parents = false;
  if(_parameters["gff_virtual_parents"] == "true") { _gff_virtual_parents=true; }

  //disconnect userdb durring the build process so that the mysql connection does not time out_feature
  _userDB->disconnect();
  
  EEDB::Peer *upload_peer = NULL;
  if(zdxload) {
    _parameters["owner_identity"] = _current_job->user()->email_identity();
    upload_peer = load_into_zdx();
    if(!upload_peer) {
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", _parameters["upload_error"]);
      _current_job->update_metadata();
      return false; 
    }
  } 
  else if((_parameters["_filetype"]  == "bam") || (_parameters["_filetype"]  == "sam")) {
    //BAMDB
    EEDB::SPStreams::BAMDB *bamdb = new EEDB::SPStreams::BAMDB();
    for(param_it = _parameters.begin(); param_it != _parameters.end(); param_it++) {
      if((*param_it).first == "_inputfile") { continue; }
      bamdb->set_parameter((*param_it).first, (*param_it).second);
    }
    bamdb->set_parameter("owner_identity", _current_job->user()->email_identity());
    bamdb->set_parameter("ignore_internal_assembly", "yes");

    string url = bamdb->create_new(file);
    if(url.empty()) {
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", "problem uploading BAM file");
      _current_job->update_metadata();
      return false; 
    }
    if(url.find("ERROR")!=std::string::npos) {
      url.erase(0, 6);
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", url);
      _current_job->update_metadata();
      return false; 
    }
    fprintf(stderr, "new bamdb url [%s]\n", url.c_str());
        
    //registry new oscdb peer into user registry
    EEDB::Peer *user_reg = _current_job->user()->user_registry();
    
    EEDB::Peer *peer = bamdb->peer();
    peer->db_url(url);  //set peer db_url to full URL location
    fprintf(stderr, "%s\n", peer->xml().c_str());
    peer->store(user_reg->peer_database());
    upload_peer = peer;
  }
  else if((_parameters["_filetype"]  == "fasta") || (_parameters["_filetype"]  == "fa") ||
          (_parameters["_filetype"]  == "fas") ||
          (_parameters["_filetype"]  == "fasta.tar") || (_parameters["_filetype"]  == "fa.tar")) {
    //genome upload
    //TODO: check if genome name exists, to decide if loading into new or previous genome
    //<upload_genome_name>homoSap-jms1</upload_genome_name>
    _parameters["owner_identity"] = _current_job->user()->email_identity();

    EEDB::Peer* genome_peer = _load_new_genome();
    if(!genome_peer) {
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", _parameters["upload_error"]);
      _current_job->update_metadata();
      fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
      return false;
    }
    
    //registry new oscdb peer into user registry
    EEDB::Peer *user_reg = _current_job->user()->user_registry();
    fprintf(stderr, "%s\n", genome_peer->xml().c_str());
    genome_peer->store(user_reg->peer_database());
    upload_peer = genome_peer;
  }
  else {
    //OSCDB for bed,gff,gtf,osctable files
    EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();

    for(param_it = _parameters.begin(); param_it != _parameters.end(); param_it++) {
      if((*param_it).first == "_inputfile") { continue; }
      //fprintf(stderr, "set oscdb param [%s] = [%s]\n", (*param_it).first.c_str(), (*param_it).second.c_str());
      oscdb->set_parameter((*param_it).first, (*param_it).second);
    }
    
    //oscdb->set_parameter("build_dir","/tmp/");
    //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
    oscdb->set_parameter("owner_identity", _current_job->user()->email_identity());
    
    string osc_url = oscdb->create_db_for_file(file);
    if(osc_url.empty()) {
      //something went wrong
      fprintf(stderr,"BUILD ERROR [%s]\n", oscdb->error_message().c_str());
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error",oscdb->error_message());
      _current_job->update_metadata();
      return false;
    }
    fprintf(stderr, "new oscdb url [%s]\n", osc_url.c_str());
    
    //make sure database is re-connected
    _userDB->disconnect();
    
    //registry new oscdb peer into user registry
    EEDB::Peer *user_reg = _current_job->user()->user_registry();
    EEDB::Peer *oscdb_peer = oscdb->peer();
    oscdb_peer->db_url(osc_url);  //set peer db_url to full URL location
    fprintf(stderr, "%s\n", oscdb_peer->xml().c_str());
    oscdb_peer->store(user_reg->peer_database());
    upload_peer = oscdb_peer;

    string oscpath = osc_url;
    boost::algorithm::replace_all(oscpath, "oscdb://", "");
    string cmd = string("chown -R apache:apache ") + oscpath;
    fprintf(stderr, "%s\n", cmd.c_str());
    system(cmd.c_str());

    cmd = string("chown -R www-data ") + oscpath;
    fprintf(stderr, "%s\n", cmd.c_str());
    system(cmd.c_str());
  }

  if(upload_peer) {
    string peerpath = upload_peer->db_url();
    fprintf(stderr, "db_url : %s\n", peerpath.c_str());
    size_t p1 = peerpath.find("://");
    if(p1!=string::npos) { 
      peerpath = peerpath.substr(p1+3);
      fprintf(stderr, "path : %s\n", peerpath.c_str());

      string cmd = string("chown -R apache:apache ") + peerpath;
      fprintf(stderr, "%s\n", cmd.c_str());
      system(cmd.c_str());

      cmd = string("chown -R www-data ") + peerpath;
      fprintf(stderr, "%s\n", cmd.c_str());
      system(cmd.c_str());
    }
  }
  
  return true;
}
*/

//--------------------------------------------------------------------------------
//
// Loading OSC like files into ZDX related methods
//
//--------------------------------------------------------------------------------

class fbuf_entry {
  public:
    string  link_id;
    string  category;
    map<string,bool>  parents;
    string  parents_str;
    EEDB::Feature* feature;
};


EEDB::Peer*  EEDB::Tools::ZDXBuilder::_load_osc_file() {
  // uses OSCFileParser to read file and load into zdxdb
  
  struct timeval      starttime,loopstarttime,endtime,difftime;
  long                count=0;
  char                strbuffer[8192];
  string              _error_msg;
  
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool>            sourceid_filter;

  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gettimeofday(&starttime, NULL);
    
  string inpath = _parameters["_inputfile"];
  string genome = _parameters["genome_assembly"];
  //boost::algorithm::to_lower(genome); 

  gzFile gz = gzopen(inpath.c_str(), "rb");
  if(!gz) {
    snprintf(strbuffer, 8190, "failed to gzopen input file [%s]", inpath.c_str());
    _parameters["upload_error"] = strbuffer;
    return NULL;
  }
  
  string outpath = _build_output_filename();
  outpath += ".zdx";
  fprintf(stderr, "upload to zdx : inpath [%s] => [%s]\n", inpath.c_str(), outpath.c_str());
  
  if(_parameters.find("display_name") == _parameters.end()) {    
    _parameters["display_name"] = _parameters["_build_filename"];
  }
  if(_parameters.find("description") == _parameters.end()) {
    _parameters["description"] = _parameters["_build_filename"];
  }
  _parameters["orig_file"] = inpath;
  

  //create the ZDX file
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new(outpath);
  EEDB::Peer* zdxpeer = zdxstream->self_peer();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  
  ZDXdb* zdxdb = zdxstream->zdxdb();
  EEDB::Assembly *assembly = this->assembly();
  
  //
  // OscFileParser based parsing
  //
  EEDB::Tools::OSCFileParser *oscparser = new EEDB::Tools::OSCFileParser();
  oscparser->set_peer(zdxpeer);
  oscparser->set_assembly(assembly);
  map<string,string>::iterator    p_it;
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    oscparser->set_parameter((*p_it).first, (*p_it).second);
  }  
  
  //start the parsing
  if(!oscparser->init_from_file(inpath)) { 
    _error_msg+="unable to parse file format. ";
  }  
  if(!oscparser->default_assembly()) { //to make sure it is initialized
    _error_msg+="no genome_assembly is defined. ";
  }

  switch(oscparser->coordinate_system()) {
    case Tools::EDGES: 
      fprintf(stderr, "oscfile is EDGE type\n"); 
      break;
    case Tools::UNDEF: 
      fprintf(stderr, "oscfile is UNDEF type\n"); 
      break;
    case Tools::BASE0: 
      fprintf(stderr, "oscfile is BASE0 type\n"); 
      break;
    case Tools::BASE1: 
      fprintf(stderr, "oscfile is BASE1 type\n"); 
      break;
  }

  if(oscparser->coordinate_system() != Tools::EDGES) {
    if(!oscparser->primary_feature_source()) { //to make sure it is initialized
      _error_msg+="problem creating oscfile primary_feature_source. ";
    }
  }
  if(assembly->assembly_name()!= "non-genomic") {
    int chrom_idx, start_idx, end_idx, strand_idx; 
    oscparser->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
    if(chrom_idx== -1 || start_idx==-1) {
      _error_msg+="malformed file: does not defined chrom or chrom_start columns. "; 
    }
  }
  
  if(!_error_msg.empty()) {
    fprintf(stderr, "%s\n", _error_msg.c_str());
    _parameters["upload_error"] = _error_msg;
    return NULL;
  }
  string filetype  = oscparser->get_parameter("filetype");
  fprintf(stderr, "parsing [%s] filetype\n", filetype.c_str());
  
  if(assembly->assembly_name()!= "non-genomic") {
    //chrom subdivide, sort, recombine so there is a single file in the proper sort order
    //this methods sorts on ascending chrom_start and for same start if sorts desc chrom_end so that longest come first
    gzclose(gz);
    string sort_path = oscparser->sort_input_file();
    if(sort_path.empty()) {
      _error_msg+="error sorting input file. ";
      _error_msg += oscparser->get_parameter("_parsing_error");
      _parameters["upload_error"] = _error_msg;
      return NULL;
    }
    fprintf(stderr, "sorted file: %s\n", sort_path.c_str());
    if(!oscparser->init_from_file(sort_path)) {
      _error_msg+="unable to parse sorted file. ";
      _error_msg += oscparser->get_parameter("_parsing_error");
      _parameters["upload_error"] = _error_msg;
      return NULL;
    }
    //reopen the sorted file
    gz = gzopen(sort_path.c_str(), "rb");
    if(!gz) {
      snprintf(strbuffer, 8190, "failed to gzopen sorted input file [%s]", sort_path.c_str());
      _parameters["upload_error"] = strbuffer;
      return NULL;
    }
  }

  //create the genome chromosomes in the ZDX
  //chromosomes are either defined externally when the assembly was set
  //or the chrom_length was calculated durring the sort procedure above
  //non-genomic assembly creates a stub "NA" chromosome
  vector<EEDB::Chrom*> chroms;
  if(assembly) { assembly->all_chroms(chroms); }
  if(!assembly || chroms.empty()) {
    _parameters["upload_error"] = "failed to find assembly ["+genome+"] and chroms";
    //fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
    return NULL;
  }
  fprintf(stderr, "%ld chroms\n", chroms.size());
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  //create all the chromosomes
  for(unsigned int j=0; j<chroms.size(); j++) {
    EEDB::Chrom *chrom = chroms[j];
    if(chrom->chrom_length() < 1) { continue; }
    zdxstream->create_chrom(chrom);
  }
  long numchroms =  EEDB::ZDX::ZDXsegment::num_chroms(zdxdb);
  fprintf(stderr, "loaded %ld chroms into zdx\n", numchroms);

  //reading of file and line parsing  
  gzrewind(gz);
  EEDB::ZDX::ZDXsegment* zseg = NULL;
  
  count=0;
  long              last_update=0;
  map<string,long>  category_count;
  long              feature_id=1;
  long              line_count=0;
  long              max_chrom_pos=0;
  string            current_chrom_name;
  list<fbuf_entry>  feature_buffer;
  
  gettimeofday(&loopstarttime, NULL);
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;
    if(_data_buffer[0] == '#') { continue; }    
    if(filetype == "osc") { 
      if(count==0) { //first non-parameter/comment line is the header columns line
        count++;
        continue;
      }
    }
    count++;
    //if(count>38000) { break; } //for debugging memory double release at exit(1) in job 312816
    
    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      continue;  //empty line
    }
    string tline = _data_buffer; //tmp copy for error message. not efficient but no other nice way
    
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    EEDB::Feature* in_feature = oscparser->convert_dataline_to_feature(_data_buffer, EEDB::FULL_FEATURE, datatypes, sourceid_filter);
    if(!in_feature) { 
      if(tline.length() > 255) { tline = tline.substr(0,255) + "..."; }
      snprintf(strbuffer, 8190, "datafile line %ld : unable to parse [", line_count);
      string error_msg = strbuffer + tline + "] " + oscparser->get_parameter("_parsing_error");
      _parameters["upload_error"] = error_msg;
      //fprintf(stderr, "%s\n", error_msg.c_str());
      return NULL;
    }

    //unmapped features get the "NA" chrom
    if(!in_feature->chrom() || (in_feature->chrom()->chrom_name().empty()) || (in_feature->chrom()->chrom_name() == "*")) {
      //in_feature->release();
      //continue;
      EEDB::Chrom* chrom = assembly->get_chrom("NA");
      in_feature->chrom(chrom);
    }
    
    string in_category = in_feature->feature_source()->category();
    category_count[in_category]++;
    EEDB::DataSource::add_to_sources_cache(in_feature->feature_source());

    //check for un-mapped feature here and add to special chrom/zseg
    //I assume that un-mapped features are not from gff and thus don't need to perform the parent logic
    if(in_feature->chrom()->chrom_name() =="NA" || in_feature->chrom_start()== -1 || in_feature->chrom_end() == -1) {
      //fprintf(stderr, "unmapped feature %s\n", in_feature->chrom_location().c_str());
      if(!zseg || (zseg->assembly_name() != in_feature->chrom()->assembly_name()) 
         || (zseg->chrom_name() != in_feature->chrom()->chrom_name())) {
        if(zseg) {
          //if(zseg->chrom_name() != out_feature->chrom()->chrom_name()) {
          //  fprintf(stderr, "  chrom [%s] total count %ld\n", zseg->chrom_name().c_str(), chrom_count[zseg->chrom_name()]);
          //}
          //write the old zsegment
          fprintf(stderr, "write_segment_features %s\n", zseg->display_desc().c_str());
          zseg->write_segment_features();
          zseg->release();
          zseg=NULL;
        }
        if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, in_feature->chrom()->assembly_name(), in_feature->chrom()->chrom_name())) {
          fprintf(stderr, "need to create zdx chromosome %s\n", in_feature->chrom()->xml().c_str());
          if(zdxstream->create_chrom(in_feature->chrom()) == -1) {
            _parameters["upload_error"] = "unknown chromosome [" + in_feature->chrom()->chrom_name() + "]";
            return NULL;
          }
        }
        zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, in_feature->chrom()->assembly_name(), in_feature->chrom()->chrom_name(), in_feature->chrom_start());
        if(zseg) { 
          fprintf(stderr, "fetched %s at pos %ld\n", zseg->display_desc().c_str(), in_feature->chrom_start());
          zseg->reclaim_for_appending();
        }
      }
      if(zseg) {
        //in_feature added now to a zseg
        //fprintf(stderr, "add to %s\n", zseg->display_desc().c_str());
        zseg->add_unsorted_feature(in_feature);
        in_feature->release(); //handed over to zseg which retains
        in_feature = NULL;
        continue; 
      }
      fprintf(stderr, "some problem with adding unmapped feature to zseg\n");
    }    
    
        
    in_feature->primary_id(feature_id++);
    fbuf_entry fent1;
    fent1.feature = in_feature;
    fent1.category = in_category;
    fent1.link_id = "";
    fent1.parents.clear();
    
    if(current_chrom_name.empty()) {  //first initialization of gap finding
      current_chrom_name = in_feature->chrom_name();
      max_chrom_pos = in_feature->chrom_end();
      //fprintf(stderr, "chrom[%s] new max_chrom_pos %ld\n", current_chrom_name.c_str(), max_chrom_pos);
    }

    //show progress update every 3 seconds
    gettimeofday(&endtime, NULL);
    if(last_update==0) { last_update = endtime.tv_sec; }
    if(endtime.tv_sec > last_update + 3) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &loopstarttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld input features  %13.2f obj/sec [buf %ld]\n", count, rate, feature_buffer.size());
    }

    //GFF name/ID/Parents extended parsing logic
    if((filetype == "gff") || (filetype == "gff3") || (filetype == "gff2") || (filetype == "gtf") || (filetype == "gtf2")) {
      EEDB::Metadata* md1, *md2, *md3;
      
      //exon_id, transcript_id, gene_id are Ensembl, Havana, gencode variation GTF
      //like GTF2  http://mblab.wustl.edu/GTF2.html
      md1 = in_feature->metadataset()->find_metadata("gene_id","");
      md2 = in_feature->metadataset()->find_metadata("transcript_id","");
      md3 = in_feature->metadataset()->find_metadata("exon_id","");
      if(in_category=="exon") {
        if(md3) {
          in_feature->primary_name(md3->data());
        } else if(md2) {
          in_feature->primary_name(md2->data()+"_exon");
        } else if(md1) {
          in_feature->primary_name(md1->data()+"_exon");
        }
      }

      if(md2) {
        if(in_category=="transcript") {
          in_feature->primary_name(md2->data());
          fent1.link_id = md2->data();
        }
        if(in_category=="exon") {
          fent1.parents[md2->data()] = true;;
        }
      }

      if(md1) {
        if(in_category=="gene") {
          in_feature->primary_name(md1->data());
          fent1.link_id = md1->data();
        }
        if(in_category=="transcript") {
          fent1.parents[md1->data()] = true;;
        }
        if((in_category=="exon") && fent1.parents.empty()) {
          fent1.parents[md1->data()] = true;
        }
      }

      //GFF3 spec (ID and Parenti) override the GTF2 attributes
      if((md1 = in_feature->metadataset()->find_metadata("ID",""))) {
        fent1.link_id = md1->data();
        in_feature->primary_name(md1->data());
        in_feature->metadataset()->add_metadata("gff:ID", md1->data());
        in_feature->metadataset()->remove_metadata_like("ID", md1->data());
      }
      if((md1 = in_feature->metadataset()->find_metadata("Name",""))) {
        in_feature->primary_name(md1->data()); 
        in_feature->metadataset()->add_metadata("gff:Name", md1->data());
        in_feature->metadataset()->remove_metadata_like("Name", md1->data());
      }
      vector<Metadata*> md4s = in_feature->metadataset()->find_all_metadata_like("Parent", "");
      for(unsigned i2=0; i2<md4s.size(); i2++) {
        fent1.parents[md4s[i2]->data()] = true; 
      }
      //might need to parse other GFF/GTF parent/child methods in the future

      //cleanup old display_name so that it resets
      in_feature->metadataset()->remove_metadata_like("eedb:display_name", ""); //since reset above
    }

    map<string,bool>::iterator parent_it;
    for(parent_it=fent1.parents.begin(); parent_it!=fent1.parents.end(); parent_it++) {
      fent1.parents_str += (*parent_it).first + ",";
    }
    //fprintf(stderr, "===IN  %13s %30s %30s \tmax_chrom_pos=%ld\t%30s\tparents:%s\n", in_category.c_str(), in_feature->primary_name().c_str(), in_feature->chrom_location().c_str(), max_chrom_pos, in_feature->db_id().c_str(), fent1.parents_str.c_str());
    //fprintf(stderr, "%s\n", in_feature->xml().c_str());
    feature_buffer.push_back(fent1);

    //check for non-overlapping gap or chrom change
    if((in_feature->chrom_name() == current_chrom_name) and (in_feature->chrom_start() <= max_chrom_pos)) {
      //fprintf(stderr, "  in_feature %s overlapping max_chrom_pos %ld\n", in_feature->chrom_location().c_str(), max_chrom_pos);
      if(max_chrom_pos < in_feature->chrom_end()) { 
        max_chrom_pos = in_feature->chrom_end();
        //fprintf(stderr, "chrom[%s] new max_chrom_pos %ld\n", current_chrom_name.c_str(), max_chrom_pos);
      }
      continue;
    }

    //fprintf(stderr, "GAP!! max:%s::%ld  in-feature:%s\n", current_chrom_name.c_str(), max_chrom_pos, in_feature->chrom_location().c_str());
    //if(in_feature->chrom_name() != current_chrom_name) { fprintf(stderr, "GAP!! chromosome\n"); } else { fprintf(stderr, "GAP!! %ldbp\n", in_feature->chrom_start() - max_chrom_pos); }

    //GFF based sub-in_feature consolidation
    //new version performs double loop within feature_buffer to find linkage, after a GAP is detected.
    list<fbuf_entry>::iterator it6,it7;
    for(it6=feature_buffer.begin(); it6!=feature_buffer.end(); it6++) {
      //skip features in buffer after the GAP
      if(!it6->feature) { continue; }
      if(it6->feature->chrom_name() != current_chrom_name) { continue; }
      if(it6->feature->chrom_start() > max_chrom_pos) { continue; }

      if(!(it6->parents.empty())) {
        bool found_parent=false;
        //fprintf(stderr, "searching for parents : %s\n", it6->feature->primary_name().c_str());
        for(it7=feature_buffer.begin(); it7!=feature_buffer.end(); it7++) {
          if(it6->parents.find(it7->link_id) != it6->parents.end()) { 
            EEDB::Feature *linkfeat = it7->feature;
            //fprintf(stderr, "  LINK %s into %s\n", it6->feature->primary_name().c_str(), linkfeat->primary_name().c_str());
            linkfeat->add_subfeature(it6->feature);
            found_parent=true;
          }
        }
        if(!found_parent) {
          fprintf(stderr, "WARNING!! didn't find parents [%s] for : %s  %s\n", it6->parents_str.c_str(), it6->feature->primary_name().c_str(), it6->feature->chrom_location().c_str());
          //TODO: this might the place to do the virtual parent creationg logic, or this might be a failure condition. For now just a warning
        }
      }
    }

    if(feature_buffer.empty()) {
      fprintf(stderr, "STRANGE!!! feature_buffer is empty\n");
      if(in_feature->chrom_name() != current_chrom_name) {
        current_chrom_name = in_feature->chrom_name();
        max_chrom_pos = in_feature->chrom_end();
      }
      if(max_chrom_pos < in_feature->chrom_end()) { max_chrom_pos = in_feature->chrom_end(); }
      continue;
    }


    //write pre-gap features from feature_buffer into ZDX
    fbuf_entry fent2 = feature_buffer.front();
    EEDB::Feature *out_feature = fent2.feature;

    while(out_feature && (out_feature->chrom_name() == current_chrom_name) && (out_feature->chrom_start() <= max_chrom_pos)) {
      //fprintf(stderr, "===OUT  %13s %30s %30s  %s \tsubfeats=%ld:: bufsize=%ld\n", out_feature->feature_source()->category().c_str(), out_feature->primary_name().c_str(), out_feature->chrom_location().c_str(), out_feature->db_id().c_str(), out_feature->subfeatures().size(), feature_buffer.size());
      //fprintf(stderr,"\n===OUT %ld\n%s======\n\n", feature_buffer.size(), out_feature->xml().c_str());
      
      //TODO: probably need to change to start+segsize instead of end because of the extend_end() code
      if(!zseg 
         || (zseg->assembly_name() != out_feature->chrom()->assembly_name()) 
         || (zseg->chrom_name() != out_feature->chrom()->chrom_name())
         //|| (out_feature->chrom_start() > zseg->chrom_end())
         || (out_feature->chrom_start() > (zseg->chrom_start() + zseg->segment_size() -1))
         || (out_feature->chrom_start() < zseg->chrom_start())
         ) {
        if(zseg) {
          //if(zseg->chrom_name() != out_feature->chrom()->chrom_name()) {
          //  fprintf(stderr, "  chrom [%s] total count %ld\n", zseg->chrom_name().c_str(), chrom_count[zseg->chrom_name()]);
          //}
          //write the old zsegment
          //fprintf(stderr, "  write %s\n", zseg->display_desc().c_str());
          zseg->write_segment_features();
          zseg->release();
          zseg=NULL;
        }
        if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name())) {
          fprintf(stderr, "need to create zdx chromosome %s\n", out_feature->chrom()->xml().c_str());
          if(zdxstream->create_chrom(out_feature->chrom()) == -1) {
            _parameters["upload_error"] = "unknown chromosome [" + out_feature->chrom()->chrom_name() + "]";
            return NULL;
          }
        }
        zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name(), out_feature->chrom_start());
        if(zseg) { 
          //fprintf(stderr, "  read %s based on %ld\n", zseg->display_desc().c_str(), out_feature->chrom_start());
          zseg->reclaim_for_appending();
        }
      }
      if(zseg) {
        zseg->add_unsorted_feature(out_feature);
      } else { 
        //maybe this is a failure error condition
        fprintf(stderr, "failed to fetch zseg [%s]\n", out_feature->chrom_location().c_str()); 
        _parameters["upload_error"] = "position "+out_feature->chrom_location()+" outside range of chromosome";
        return NULL;
      }
      
      feature_buffer.pop_front();
      out_feature->release();
      out_feature = NULL;

      if(!feature_buffer.empty()) {
        fent2 = feature_buffer.front();
        out_feature = fent2.feature;
      }
    } //while write zdx
    

    //update the gap parameters
    if(in_feature->chrom_name() != current_chrom_name) {
      //if(zseg) {
      //  fprintf(stderr, "  write %s\n", zseg->display_desc().c_str());
      //  zseg->write_segment_features();
      //  zseg->release();
      //  zseg=NULL;
      //}
      current_chrom_name = in_feature->chrom_name();
      max_chrom_pos      = in_feature->chrom_end();
      //fprintf(stderr, "change chromosome : %s\n", current_chrom_name.c_str());
    }
    if(max_chrom_pos < in_feature->chrom_end()) { 
      max_chrom_pos = in_feature->chrom_end(); 
      //fprintf(stderr, "update max_chrom_pos : %ld\n", max_chrom_pos);
    }
    //sleep(5);
  } //gzgets loop

  fprintf(stderr, "finished main read loop, need to flush remaining bufers\n");
  
  //GFF based sub-in_feature consolidation
  //new version performs double loop within feature_buffer to find linkage, after a GAP is detected.
  list<fbuf_entry>::iterator it6,it7;
  for(it6=feature_buffer.begin(); it6!=feature_buffer.end(); it6++) {
    //skip features in buffer after the GAP
    if(!it6->feature) { continue; }
    if(it6->feature->chrom_name() != current_chrom_name) { continue; }
    if(it6->feature->chrom_start() > max_chrom_pos) { continue; }

    if(!(it6->parents.empty())) {
      bool found_parent=false;
      //fprintf(stderr, "searching for parents : %s\n", it6->feature->primary_name().c_str());
      for(it7=feature_buffer.begin(); it7!=feature_buffer.end(); it7++) {
        if(it6->parents.find(it7->link_id) != it6->parents.end()) { 
          EEDB::Feature *linkfeat = it7->feature;
          //fprintf(stderr, "  LINK %s into %s\n", it6->feature->primary_name().c_str(), linkfeat->primary_name().c_str());
          linkfeat->add_subfeature(it6->feature);
          found_parent=true;
        }
      }
      if(!found_parent) {
        fprintf(stderr, "WARNING!! didn't find parents [%s] for : %s  %s\n", it6->parents_str.c_str(), it6->feature->primary_name().c_str(), it6->feature->chrom_location().c_str());
        //TODO: this might the place to do the virtual parent creationg logic, or this might be a failure condition. For now just a warning
      }
    }
  }

  //flush remaining feature_buffer
  //fprintf(stderr, "flush remaining feature_buffer %ld\n", feature_buffer.size());
  //sleep(3);
  while(!feature_buffer.empty()) {    
    fbuf_entry fent2 = feature_buffer.front();
    EEDB::Feature *out_feature = fent2.feature;
    feature_buffer.pop_front();

    //fprintf(stderr, "===OUT  %13s %30s  %s :: bufsize=%ld\n", out_feature->feature_source()->category().c_str(), out_feature->chrom_location().c_str(), out_feature->db_id().c_str(), feature_buffer.size());
    //fprintf(stderr,"\n===OUT %ld\n%s======\n\n", feature_buffer.size(), out_feature->xml().c_str());
    
    //write into ZDX
    if(!zseg 
       || (zseg->assembly_name() != out_feature->chrom()->assembly_name()) 
       || (zseg->chrom_name() != out_feature->chrom()->chrom_name())
       //|| (out_feature->chrom_start() > zseg->chrom_end())
       || (out_feature->chrom_start() > (zseg->chrom_start() + zseg->segment_size() -1))
       || (out_feature->chrom_start() < zseg->chrom_start())
       ) {
      if(zseg) {
        //write the old zsegment
        fprintf(stderr, "  write %s\n", zseg->display_desc().c_str());
        zseg->write_segment_features();
        zseg->release();
        zseg=NULL;
      }
      if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name())) {
        fprintf(stderr, "need to create zdx chromosome %s\n", out_feature->chrom()->xml().c_str());
        if(zdxstream->create_chrom(out_feature->chrom()) == -1) {
          _parameters["upload_error"] = "unknown chromosome [" + out_feature->chrom()->chrom_name() + "]";
          return NULL;
        }
      }
      zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name(), out_feature->chrom_start());
      if(zseg) { 
        //fprintf(stderr, "  read %s based on %ld\n", zseg->display_desc().c_str(), out_feature->chrom_start());
        zseg->reclaim_for_appending();
      }
    }
    if(zseg) {
      zseg->add_unsorted_feature(out_feature);
    } else { 
      fprintf(stderr, "failed to fetch zseg [%s]\n", out_feature->chrom_location().c_str());
    }
    
    out_feature->release();        
  }
  if(zseg) { //write the last zsegment  
    fprintf(stderr, "  write %s\n", zseg->display_desc().c_str());
    zseg->write_segment_features(); 
    zseg->release();
    zseg=NULL;
  } 
  gzclose(gz); //close input file
    
  //go through all the segments and make sure all the empty ones are set to "finished"
  EEDB::ZDX::ZDXsegment::finish_build(zdxdb);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "\n%ld input features in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));  
  fprintf(stderr, "%ld output features\n", feature_id-1);
  
  map<string,long>::iterator it1;
  for(it1=category_count.begin(); it1!=category_count.end(); it1++) {
    fprintf(stderr, "  %s :: %ld\n", it1->first.c_str(), (*it1).second);
  } 
  
  
  //save data sources
  fprintf(stderr, "\n==== save sources\n");
  zdxpeer = zdxstream->self_peer();
  zdxpeer->retain();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());

  vector<EEDB::DataSource*> sources = oscparser->datasources();
  vector<EEDB::DataSource*>::iterator it2;
  for(it2=sources.begin(); it2!=sources.end(); it2++) {
    EEDB::DataSource *source = (*it2);
    source->peer_uuid(zdxpeer->uuid());  //reset uuid
    source->metadataset()->remove_metadata_like("osc_header","");
    source->metadataset()->remove_metadata_like("eedb:owner_OpenID","");
    //if(!owner_ident.empty()) { source->owner_identity(owner_ident); }

    if(source->classname() == EEDB::FeatureSource::class_name) { 
      string ctg = ((EEDB::FeatureSource*)source)->category();
      ((EEDB::FeatureSource*)source)->feature_count(category_count[ctg]);
    }
    
    if(zdxstream->get_datasource(source->db_id()) == NULL) {
      fprintf(stderr, "%s", source->simple_xml().c_str()); 
      zdxstream->add_datasource(source);
    }
  }
  zdxstream->write_source_section();
  
  //_upload_test_read_zdx(zdxstream);  

  //always build the feature index and name index when loading into ZDX
  zdxstream->rebuild_feature_index();

  if(_parameters["build_feature_name_index"] != "false") {
    zdxstream->build_feature_name_index();
  }

  free(_data_buffer);
  //zdxstream->release();
  
  //registry new zdx peer into user registry
  // if(_current_job && _current_job->user()) {
  //   EEDB::Peer *user_reg = _current_job->user()->user_registry();
  //   fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  //   zdxpeer->store(user_reg->peer_database());
  // }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "load_into_zdx in %1.6f sec [%s]\n",
          (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0, outpath.c_str());  
  return zdxpeer;
}


void _upload_test_read_zdx(EEDB::ZDX::ZDXstream *zdxstream) {
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL); //reset timer
  
  if(!zdxstream) { return;}
  ZDXdb* zdxdb = zdxstream->zdxdb();

  //cache the sources
  zdxstream->stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)zdxstream->next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
  }
  
  // get chroms
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  fprintf(stderr,"\n==== zdx read test %ld chroms\n", chroms.size());
    
  long total_count=0;
  long chrom_count=0;
  map<string,long> category_count;
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    EEDB::Chrom *chrom = (*chr_it);
    chrom_count=0;
    zdxstream->stream_by_named_region(chrom->assembly_name(), chrom->chrom_name(), -1, -1);
    while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
      if(obj->classname() != EEDB::Feature::class_name) { obj->release(); fprintf(stderr, "oops not a feature\n"); continue; }
      EEDB::Feature *feature = (EEDB::Feature*)obj;
      if(feature->feature_source()) { 
        string category = feature->feature_source()->category();
        category_count[category]++;
      }      
      total_count++;
      chrom_count++;
      obj->release();
    }
    
    if(chrom_count>0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      double runtime  = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
      fprintf(stderr, "%s :: %1.2f obj/sec  %ld \n", chrom->fullname().c_str(), (total_count/runtime), chrom_count);
    }
  }
  
  map<string,long>::iterator it1;
  for(it1=category_count.begin(); it1!=category_count.end(); it1++) {
    fprintf(stderr, "  %s :: %ld\n", it1->first.c_str(), (*it1).second);
  } 
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "zdx read %ld features in %1.6f sec \n", total_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);  
}


//--------------------------------------------------------------------------------
//
// Genome loading from files into ZDX
//
//--------------------------------------------------------------------------------


EEDB::Peer*  EEDB::Tools::ZDXBuilder::_load_new_genome() {
  //create new genome, loading into ZDX
  struct timeval      starttime,endtime,difftime;
  char                strbuffer[8192];
  
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool>            sourceid_filter;
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gettimeofday(&starttime, NULL);
  
  string inpath   = _parameters["_inputfile"];
  string genome   = _parameters["upload_genome_name"];
  long taxon_id   = strtol(_parameters["taxon_id"].c_str(), NULL, 10);
  string filetype = _parameters["_filetype"];
  
  string basename = _build_output_filename();
  string outpath  = basename + ".zdx";
  fprintf(stderr, "upload to zdx : inpath [%s] => [%s]\n", inpath.c_str(), outpath.c_str());
  _parameters["orig_file"] = inpath;
  
  //create the ZDX file
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new(outpath);
  EEDB::Peer* zdxpeer = zdxstream->self_peer();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  
  //get the genome information from NCBI webservices
  EEDB::Assembly* assembly = new EEDB::Assembly();
  assembly->taxon_id(taxon_id);
  assembly->assembly_name(genome);
  assembly->sequence_loaded(true);
  assembly->owner_identity(_parameters["owner_identity"]);
  assembly->create_date(time(NULL));

  if(!assembly->fetch_NCBI_taxonomy_info()) {
    snprintf(strbuffer, 8190, "error fetching taxon_id %ld from NCBI", taxon_id);
    _parameters["upload_error"] = strbuffer;
    return NULL;
  }
  fprintf(stderr,"%s\n", assembly->xml().c_str());

  //write assembly into zdx
  zdxstream->add_genome(assembly);  //for loading new genomes
  zdxstream->write_source_section();
  
  //decide if .tar and need to extract into a directory,which also switches the mode
  if(filetype =="fasta.tar" || filetype=="fa.tar") {
    //extract .tar
    string seqdir = basename + ".seqdir";
    fprintf(stderr, "need to extract genome dir [%s]\n", seqdir.c_str());
    mkdir(seqdir.c_str(), 0770);
    //if(mkdir(seqdir.c_str(), 0770)!= 0) {
    //  _parameters["upload_error"] = "error extracting sequence from tar";
    //  return NULL;
    //}
    //unpack the .tar into seqdir
    string cmd = "tar -x -C "+seqdir+" -f "+inpath;
    if(inpath.rfind(".tar.gz") != string::npos) { cmd += " -z"; }
    fprintf(stderr, "%s\n", cmd.c_str());
    if(system(cmd.c_str()) != 0) {
      _parameters["upload_error"] = "error extracting sequence from tar";
      //fprintf(stderr, "%s", _parameters["upload_error"].c_str());
      return NULL;
    }
    
    //loop on each sequence file
    fprintf(stderr,"\ncreating new set of genome chunks\n");
    fprintf(stderr,"   assembly   : %s\n", genome.c_str());
    fprintf(stderr,"   taxon      : %ld %s %s-%s\n", taxon_id, assembly->common_name().c_str(), assembly->genus().c_str(), assembly->species().c_str());
    fprintf(stderr,"   genome_dir : %s\n", seqdir.c_str());
    fprintf(stderr,"   chunk_size : %ld\n", _chunk_size);
    fprintf(stderr,"   overlap    : %ld\n", _chunk_overlap);
    fprintf(stderr,"---------------\n");
    
    DIR *dp = opendir(seqdir.c_str());
    if(dp==NULL) {
      _parameters["upload_error"] = "error extracting sequence from tar";
      //fprintf(stderr, "%s", _parameters["upload_error"].c_str());
      return NULL;
    }
    struct dirent *d;
    bool rtn=true;
    while((d = readdir(dp)) != NULL) {
      if(strcmp(d->d_name, ".")==0) { continue; }
      if(strcmp(d->d_name, "..")==0) { continue; }
      string path = seqdir +"/"+ d->d_name;
      
      rtn &= _fasta_create_chromosomes(zdxstream, assembly, path, false);
      if(!rtn) { break; }
      rtn &= _chromosome_chunk_fasta(zdxstream, assembly, path, false);
      if(!rtn) { break; }

      cmd = "rm "+path;
      fprintf(stderr, "%s\n", cmd.c_str());
      system(cmd.c_str());
    }
    //clean up the seqdir
    cmd = "rmdir "+seqdir;
    fprintf(stderr, "%s\n", cmd.c_str());
    system(cmd.c_str());
    
    if(!rtn) { return NULL; }
    closedir(dp);
  }
  else if(filetype =="fasta" || filetype=="fa" || filetype=="fas" || filetype=="fna") {
    fprintf(stderr,"\ncreating new set of genome chunks\n");
    fprintf(stderr,"   assembly   : %s\n", genome.c_str());
    fprintf(stderr,"   taxon      : %ld %s %s-%s\n", taxon_id, assembly->common_name().c_str(), assembly->genus().c_str(), assembly->species().c_str());
    fprintf(stderr,"   seq file   : %s\n", inpath.c_str());
    fprintf(stderr,"   chunk_size : %ld\n", _chunk_size);
    fprintf(stderr,"   overlap    : %ld\n", _chunk_overlap);
    fprintf(stderr,"---------------\n");
    
    if(!_fasta_create_chromosomes(zdxstream, assembly, inpath, true)) { return NULL; }
    if(!_chromosome_chunk_fasta(zdxstream, assembly, inpath, true)) { return NULL; }
  }
  else {
    _parameters["upload_error"] = "unknown file type ["+filetype+"]";
    //fprintf(stderr, "%s", _parameters["upload_error"].c_str());
    return NULL;
  }

  //TODO: maybe show the chroms loaded into the zdx as check that it worked
  //ZDXdb* zdxdb = zdxstream->zdxdb();
  //vector<EEDB::Chrom*> chroms;
  //fprintf(stderr, "%ld chroms\n", chroms.size());
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "loaded genome [%s] in %1.6f sec \n", genome.c_str(), (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  return zdxpeer;
}


bool EEDB::Tools::ZDXBuilder::_fasta_create_chromosomes(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name) {
  //zdx needs the chromosomes with correct length created first before it can create the zdxsegments, before we can load the ChromChunk into the
  //segments. So need to first scan the fasta file to get the correct sequence length
  struct timeval      starttime,endtime,difftime;
  char                strbuffer[8192];
  
  if(!zdxstream) { return false; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  
  gettimeofday(&starttime, NULL);
  
  if((path.rfind(".fasta") == string::npos) &&
     (path.rfind(".fasta.gz") == string::npos) &&
     (path.rfind(".fa") == string::npos) &&
     (path.rfind(".fa.gz") == string::npos) &&
     (path.rfind(".fna") == string::npos) &&
     (path.rfind(".fna.gz") == string::npos) &&
     (path.rfind(".fas") == string::npos) &&
     (path.rfind(".tar.gz") == string::npos)) {
    _parameters["upload_error"] = "unknown file type ["+path+"]";
    return false;
  }
  fprintf(stderr,"fasta_create_chromosomes [%s]\n", path.c_str());
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) {
    snprintf(strbuffer, 8190, "failed to gzopen input file [%s]", path.c_str());
    _parameters["upload_error"] = strbuffer;
    return false;
  }
  
  long          line_count=0;
  string        name;
  EEDB::Chrom*  chrom=NULL;
  string        description;
  long          chrom_len =0;
  
  //get chrom_name from filename first in case the internal fasta >header is not used
  name = path;
  size_t ridx = name.rfind("/");
  if(ridx!=string::npos) {
    name = name.substr(ridx+1);
  }
  ridx = name.rfind(".fa");
  if(ridx!=string::npos) {
    name.resize(ridx);
  }
  
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;
    if(_data_buffer[0] == '#') { continue; }
    
    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      continue;  //empty line
    }
    
    if(_data_buffer[0] == '>') { //title line
      if(chrom and (chrom_len>0)) {
        fprintf(stderr,"  chrom_len = %ld\n", chrom_len);
        chrom->chrom_length(chrom_len);
        fprintf(stderr, "  create zdx chromosome %s\n", chrom->xml().c_str());
        if(zdxstream->create_chrom(chrom) == -1) {
          _parameters["upload_error"] = "unable to create chromosome [" +chrom->fullname()+ "]";
          return false;
        }
        chrom= NULL;
      }
      
      //switch to new chrom
      description = &(_data_buffer[1]);
      if(use_header_name) {
        name.clear();
        ridx = description.find("gi|");
        if(ridx!=string::npos) {
          //if($nm1 =~ /^gi\|(.*)\|(.*)\|(.*)\|/) { $name = $3;
          name = description.substr(ridx+3);
          for(int j=0; j<2; j++) {
            ridx = name.find("|");
            if(ridx!=string::npos) { name = name.substr(ridx+1); }
            else { name.clear(); }
          }
          ridx = name.find("|");
          if(ridx!=string::npos) { name.resize(ridx); }
          else { name.clear(); }
        } else {
          //name is first word no spaces
          name = description;
          size_t ridx = name.find_first_of(" \t");
          if(ridx!=string::npos) {
            name.resize(ridx);
          }
        }
        use_header_name = true; //maybe first one we can use filename, but other ones must use internal header name
      }
      fprintf(stderr,"  chrom name[%s]\n  desc[%s]\n", name.c_str(), description.c_str());
      
      chrom = EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, assembly->assembly_name(), name);
      if(!chrom) {
        //create the chromosome;
        chrom = new EEDB::Chrom;
        chrom->chrom_name(name);
        chrom->assembly(assembly);
        chrom->description(description);
      }
      
      //reset variables
      chrom_len =0;
    } else {
      if(!chrom) { continue; }
      chrom_len += strlen(_data_buffer);
    }
  }
  if(chrom and (chrom_len>0)) {
    fprintf(stderr,"  chrom_len = %ld\n", chrom_len);
    chrom->chrom_length(chrom_len);
    fprintf(stderr, "  create zdx chromosome %s\n", chrom->xml().c_str());
    if(zdxstream->create_chrom(chrom) == -1) {
      _parameters["upload_error"] = "unable to create chromosome [" +chrom->fullname()+ "]";
      return false;
    }
  }
  
  free(_data_buffer);
  gzclose(gz); //close input file
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "  %ld lines in %1.6f sec \n", line_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  
  return true;
}


bool EEDB::Tools::ZDXBuilder::_chromosome_chunk_fasta(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name) {
  struct timeval      starttime,endtime,difftime;
  char                strbuffer[8192];
  
  ZDXdb* zdxdb = NULL;
  if(zdxstream) { zdxdb = zdxstream->zdxdb(); }
    
  gettimeofday(&starttime, NULL);

  if((path.rfind(".fasta") == string::npos) &&
     (path.rfind(".fasta.gz") == string::npos) &&
     (path.rfind(".fa") == string::npos) &&
     (path.rfind(".fa.gz") == string::npos) &&
     (path.rfind(".fna") == string::npos) &&
     (path.rfind(".fna.gz") == string::npos) &&
     (path.rfind(".fas") == string::npos) &&
     (path.rfind(".tar.gz") == string::npos)) {
    _parameters["upload_error"] = "unknown file type ["+path+"]";
    fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
    return false;
  }
  
  fprintf(stderr,"chromosome_chunk_fasta [%s]\n", path.c_str());
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) {
    snprintf(strbuffer, 8190, "failed to gzopen input file [%s]", path.c_str());
    _parameters["upload_error"] = strbuffer;
    fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
    return false;
  }
  
  long          line_count=0;
  string        name;
  EEDB::Chrom*  chrom=NULL;
  string        description;
  string        seq;
  long          chrom_start = 1; //chromosomes are referenced starting at '1'
  long          chrom_len =0;

  //get chrom_name from filename first in case the internal fasta >header is not used
  name = path;
  size_t ridx = name.rfind("/");
  if(ridx!=string::npos) {
    name = name.substr(ridx+1);
  }
  ridx = name.rfind(".fa");
  if(ridx!=string::npos) {
    name.resize(ridx);
  }
  
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;
    if(_data_buffer[0] == '#') { continue; }
    
    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      continue;  //empty line
    }
    
    if(_data_buffer[0] == '>') { //title line
      fprintf(stderr, "title line: %s\n", _data_buffer);
      //create last chunk(s) on previous chrom
      while(seq.length()>0) {
        string chunkseq = seq.substr(0, _chunk_size);
        //fprintf(stderr,"  chunk %ld : %ld : %ld : %ld :: ", chrom_start, _chunk_size, seq.length(), chunkseq.length());
        _create_chunk(zdxstream, chrom, chrom_start, chrom_start+_chunk_size-1, chunkseq);
        if(seq.length() > _chunk_size-_chunk_overlap) {
          seq = seq.substr(_chunk_size-_chunk_overlap); //grab last 'chunk_overlap' bases for overlap region and any remaining
          chrom_start += _chunk_size - _chunk_overlap;
        } else { seq.clear(); }
        //fprintf(stderr,"%ld\n", seq.length());
      }
      
      //switch to new chrom
      description = &(_data_buffer[1]);
      if(use_header_name) {
        name.clear();
        ridx = description.find("gi|");
        if(ridx!=string::npos) {
          //if($nm1 =~ /^gi\|(.*)\|(.*)\|(.*)\|/) { $name = $3;
          name = description.substr(ridx+3);
          for(int j=0; j<2; j++) {
            ridx = name.find("|");
            if(ridx!=string::npos) { name = name.substr(ridx+1); }
            else { name.clear(); }
          }
          ridx = name.find("|");
          if(ridx!=string::npos) { name.resize(ridx); }
          else { name.clear(); }
        } else {
          //name is first word no spaces
          name = description;
          size_t ridx = name.find_first_of(" \t");
          if(ridx!=string::npos) {
            name.resize(ridx);
          }
        }
        use_header_name = true; //maybe first one we can use filename, but other ones must use internal header name
      }
      fprintf(stderr,"  chrom name[%s]\n  desc[%s]\n", name.c_str(), description.c_str());

      if(zdxdb) {  //storing into zdx
        chrom = EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, assembly->assembly_name(), name);
      } else {  //storing into mysql/sqlite
        chrom = assembly->get_chrom(name);
      }

      if(!chrom) {
        _parameters["upload_error"] = "unable to fetch chromosome [" +assembly->assembly_name() +"] ["+ name+ "]";
        fprintf(stderr, "%s\n", _parameters["upload_error"].c_str());
        return false;
      }
      
      //reset variables
      seq.erase();
      chrom_start = 1; //chromosomes are referenced starting at '1'
      chrom_len =0;
      //if(chrom) { fprintf(stderr,"  %s\n", chrom->display_desc().c_str()); }
    } else {
      if(!chrom) {
        _parameters["upload_error"] = "no chromosome definition";
        return false;
      }
      if(seq.length() >= _chunk_size) {
        string chunkseq = seq.substr(0, _chunk_size);
        //fprintf(stderr,"  chunk %ld : %ld : %ld : %ld :: ", chrom_start, _chunk_size, seq.length(), chunkseq.length());
        _create_chunk(zdxstream, chrom, chrom_start, chrom_start+_chunk_size-1, chunkseq);
        seq = seq.substr(_chunk_size-_chunk_overlap); //grab last 'chunk_overlap' bases for overlap region and any remaining
        chrom_start += _chunk_size - _chunk_overlap;
        //fprintf(stderr,"%ld\n", seq.length());
      }
      //$line =~ s/\s* //g;  //maybe need to remove spaces
      seq += _data_buffer;
      long tlen = strlen(_data_buffer);
      chrom_len += tlen;
      //fprintf(stderr,"%ld : %ld : %ld\n", tlen, seq.length(), chrom_start);
    }
  }

  //if sequence left un-chunked then need to chunk it
  while(seq.length()>0) {
    string chunkseq = seq.substr(0, _chunk_size);
    //fprintf(stderr,"  chunk %ld : %ld : %ld : %ld :: ", chrom_start, _chunk_size, seq.length(), chunkseq.length());
    _create_chunk(zdxstream, chrom, chrom_start, chrom_start+_chunk_size-1, chunkseq);
    if(seq.length() > _chunk_size-_chunk_overlap) {
      seq = seq.substr(_chunk_size-_chunk_overlap); //grab last 'chunk_overlap' bases for overlap region and any remaining
      chrom_start += _chunk_size - _chunk_overlap;
    } else { seq.clear(); }
    //fprintf(stderr,"%ld\n", seq.length());
  }
  
  free(_data_buffer);
  gzclose(gz); //close input file

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "  %ld lines in %1.6f sec \n", line_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  
  return true;
}


bool EEDB::Tools::ZDXBuilder::_create_chunk(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Chrom *chrom, long chr_start, long chr_end, string seq) {
  fprintf(stderr,"  chunk %s : %ld : %ld : %ld :: ", chrom->fullname().c_str(), chr_start, _chunk_size, seq.length());
  
  EEDB::ChromChunk* chunk = new EEDB::ChromChunk();
  chunk->chrom(chrom);
  chunk->chrom_start(chr_start);
  chunk->chrom_end(chr_end);
  chunk->sequence(seq.c_str());

  if(zdxstream) {    
    ZDXdb* zdxdb = zdxstream->zdxdb();
    if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, chrom->assembly_name(), chrom->chrom_name())) {
      _parameters["upload_error"] = "unknown chromosome [" + chrom->chrom_name() + "]";
      return false;
    }
    
    EEDB::ZDX::ZDXsegment* zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, chrom->assembly_name(), chrom->chrom_name(), chr_start);
    if(!zseg) {
      _parameters["upload_error"] = "internal zdx segment error [" + chrom->chrom_name() + "]";
      return false;
    }

    zseg->reclaim_for_appending();
    fprintf(stderr, "%s\n", zseg->xml().c_str());
    
    //write ChromChunk into zseg
    if(!zseg->add_chrom_chunk(chunk)) {
      _parameters["upload_error"] = "error writing chunk to zdx " + zseg->xml();
      return false;
    }
    zseg->write_build_complete(); //finished write, releases claim
    return true;
  } else if(chrom && chrom->database() && (chrom->database()->driver()=="mysql" || chrom->database()->driver()=="sqlite")) {
    //store chunk into mysql/sqlite
    //because chunk->chrom() is set to a mysql/sqlite chrom, it uses that database to store the chunk 
    //so no extra parameters are needed. also performs the check_exists_db() internally
    chunk->store();
    fprintf(stderr, "%s\n", chunk->display_desc().c_str());
    return true;
  }
  return false;
}

