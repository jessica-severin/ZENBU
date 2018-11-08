/* $Id: UploadFile.cpp,v 1.36 2017/02/09 07:37:53 severin Exp $ */

/***

NAME - EEDB::JobQueue::UploadFile

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
#include <EEDB/JobQueue/Job.h>
#include <EEDB/JobQueue/UploadFile.h>
#include <EEDB/SPStreams/RemoteServerStream.h>  //for curl function

#include <EEDB/WebServices/RegionServer.h>
#include <lz4/lz4.h>

using namespace std;
using namespace MQDB;

size_t rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp);

const char*               EEDB::JobQueue::UploadFile::class_name = "EEDB::JobQueue::UploadFile";

void _upload_test_read_zdx(EEDB::ZDX::ZDXstream *zdxstream);
void _feature_unique_metadata_by_type(EEDB::Feature *feature, EEDB::Metadata *new_mdata);

EEDB::JobQueue::UploadFile::UploadFile() {
  init();
}

EEDB::JobQueue::UploadFile::~UploadFile() {
}

void _eedb_job_upload_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::JobQueue::UploadFile*)obj;
}

void EEDB::JobQueue::UploadFile::init() {
  MQDB::MappedQuery::init();
  _classname      = EEDB::JobQueue::UploadFile::class_name;
  _funcptr_delete = _eedb_job_upload_delete_func;
  
  _current_job = NULL;
  _userDB = NULL;
  
  //_chunk_size    = 505000; //ie 505 kbase
  //_chunk_overlap =   5000; //ie 5 kbase
  _chunk_size    = 100000;
  _chunk_overlap = 0;
  _gff_virtual_parents = false;
}


void  EEDB::JobQueue::UploadFile::userDB(MQDB::Database *db) {
  _userDB = db;
}


void EEDB::JobQueue::UploadFile::set_parameter(string tag, string value) {
  //used for debugging
  _upload_parameters[tag] = value;
}


////////////////////////////////////////////////////////////////////////////


bool  EEDB::JobQueue::UploadFile::process_upload_job(long job_id) {
  _current_job = EEDB::JobQueue::Job::fetch_by_id(_userDB, job_id);
  if(!_current_job) { return false; }

  EEDB::Metadata *md = _current_job->metadataset()->find_metadata("xmlpath", "");
  if(!md) { return false; }

  string xmlpath = md->data();  
  if(!read_upload_xmlinfo(xmlpath)) { 
    _upload_parameters["upload_error"] = "unable to read upload xml config";
    return false; 
  }
  string file = _upload_parameters["_inputfile"];
  
  struct stat statbuf;
  if(stat(file.c_str(), &statbuf) != 0) {
    _upload_parameters["upload_error"] = "unable to open input file";
    return false; 
  }
  
  if(!_current_job->user()) {
    _upload_parameters["upload_error"] = "no user asigned to upload job";
    return false; 
  }

  fprintf(stderr, "upload data into ZENBU [%s]\n", file.c_str());

  map<string,string>::iterator  param_it;
  bool zdxload = false;
  if(_upload_parameters["filetype"] == "gff") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gff2") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gff3") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gtf") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gtf2") { zdxload=true; }
  if(_upload_parameters["build_feature_name_index"] == "true") { zdxload=true; }
  if(_upload_parameters["load_into_zdx"] == "true") { zdxload=true; }

  _gff_virtual_parents = false;
  if(_upload_parameters["gff_virtual_parents"] == "true") { _gff_virtual_parents=true; }

  EEDB::Peer *upload_peer = NULL;
  if(zdxload) {
    _upload_parameters["owner_identity"] = _current_job->user()->email_identity();
    upload_peer = load_into_zdx();
    if(!upload_peer) {
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", _upload_parameters["upload_error"]);
      _current_job->update_metadata();
      return false; 
    }
  } 
  else if((_upload_parameters["filetype"]  == "bam") || (_upload_parameters["filetype"]  == "sam")) {
    //BAMDB
    EEDB::SPStreams::BAMDB *bamdb = new EEDB::SPStreams::BAMDB();
    for(param_it = _upload_parameters.begin(); param_it != _upload_parameters.end(); param_it++) {
      if((*param_it).first == "_inputfile") { continue; }
      bamdb->set_parameter((*param_it).first, (*param_it).second);
    }
    bamdb->set_parameter("owner_identity", _current_job->user()->email_identity());
    bamdb->set_parameter("ignore_internal_assembly", "yes");

    string url = bamdb->create_new(file);
    if(url.empty()) {
      _current_job->metadataset()->add_tag_data("upload_error", "problem uploading BAM file");
      _current_job->update_metadata();
      return false; 
    }
    if(url.find("ERROR")!=std::string::npos) {
      url.erase(0, 6);
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
  else if((_upload_parameters["filetype"]  == "fasta") || (_upload_parameters["filetype"]  == "fa") ||
          (_upload_parameters["filetype"]  == "fas") ||
          (_upload_parameters["filetype"]  == "fasta.tar") || (_upload_parameters["filetype"]  == "fa.tar")) {
    //genome upload
    //TODO: check if genome name exists, to decide if loading into new or previous genome
    //<upload_genome_name>homoSap-jms1</upload_genome_name>

    EEDB::Peer* genome_peer = load_into_new_genome();
    if(!genome_peer) {
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", _upload_parameters["upload_error"]);
      _current_job->update_metadata();
      fprintf(stderr, "%s\n", _upload_parameters["upload_error"].c_str());
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

    for(param_it = _upload_parameters.begin(); param_it != _upload_parameters.end(); param_it++) {
      if((*param_it).first == "_inputfile") { continue; }
      //fprintf(stderr, "set oscdb param [%s] = [%s]\n", (*param_it).first.c_str(), (*param_it).second.c_str());
      oscdb->set_parameter((*param_it).first, (*param_it).second);
    }
    
    //oscdb->set_parameter("build_dir","/tmp/");
    //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
    oscdb->set_parameter("owner_identity", _current_job->user()->email_identity());
    
    string oscpath = oscdb->create_db_for_file(file);
    if(oscpath.empty()) {
      //something went wrong
      fprintf(stderr,"BUILD ERROR [%s]\n", oscdb->error_message().c_str());
      _current_job->metadataset()->add_tag_data("upload_error",oscdb->error_message());
      _current_job->update_metadata();
      return false;
    }
    fprintf(stderr, "new oscdb url [%s]\n", oscpath.c_str());
    
    //registry new oscdb peer into user registry
    EEDB::Peer *user_reg = _current_job->user()->user_registry();
    EEDB::Peer *oscdb_peer = oscdb->peer();
    oscdb_peer->db_url(oscpath);  //set peer db_url to full URL location
    fprintf(stderr, "%s\n", oscdb_peer->xml().c_str());
    oscdb_peer->store(user_reg->peer_database());
    upload_peer = oscdb_peer;
  }
  
  string cmd = string("chown -R apache:apache ") + _current_job->user()->user_directory();
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());
  cmd = string("chown -R www-data ") + _current_job->user()->user_directory();
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());
  
  //link into collaboration at upload time
  if(upload_peer and (_upload_parameters.find("collaboration_uuid") != _upload_parameters.end())) { 
    EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_current_job->user(), 
                                                                            _upload_parameters["collaboration_uuid"]);
    if(!collaboration) {
      fprintf(stderr, "unable to find collab [%s]\n", _upload_parameters["collaboration_uuid"].c_str());
    } else {
      fprintf(stderr, "share to collaboration [%s] : %s\n", collaboration->group_uuid().c_str(), collaboration->display_name().c_str());
      if((collaboration->member_status() == "MEMBER") or (collaboration->member_status() == "OWNER") or (collaboration->member_status() == "ADMIN")) {
        string error = collaboration->share_peer_database(upload_peer);
        if(!error.empty()) {
          fprintf(stderr, "collab_share_error: %s\n", error.c_str());
        }
      }
    }      
  }      

  //unlink(xmlpath.c_str());
  //unlink(file.c_str());

  return true;
}


bool EEDB::JobQueue::UploadFile::read_upload_xmlinfo(string xmlfile) {
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *node, *root_node, *section_node;
  
  _upload_parameters.clear();
  
  if(xmlfile.empty()) { return false; }
  
  fprintf(stderr, "read upload parameters from xmlconfig [%s]\n", xmlfile.c_str());
  
  //fprintf(stderr,"=== read config [%s]\n", xmlfile.c_str());
  //open config file, mmap into memory then copy into config_text
  fildes = open(xmlfile.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return false; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  //fprintf(stderr,"config file %lld bytes long\n", (long long)cfg_len);
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  //fprintf(stderr,"config:::%s\n=========\n", config_text);
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  
  root_node = doc.first_node();
  if(root_node->name() != string("oscfile")) { return false; }
  
  // parameters section
  section_node = root_node->first_node("parameters");
  if(section_node) { 
    node = section_node->first_node("input_file");
    if(node) { _upload_parameters["_inputfile"] = node->value(); }
    
    node = section_node->first_node();
    while(node) {
      fprintf(stderr, "param[%s] = %s\n", node->name(), node->value());
      _upload_parameters[node->name()] = node->value();
      node = node->next_sibling();
    }
  }
  
  free(config_text);
  return true;
}


//--------------------------------------------------------------------------------
//
// Loading into ZDX related methods
//
//--------------------------------------------------------------------------------

class fbuf_entry {
  public:
    string  link_id;
    EEDB::Feature* feature;
};


EEDB::Peer*  EEDB::JobQueue::UploadFile::load_into_zdx() {
  struct timeval      starttime,endtime,difftime;
  long                count=0;
  char                strbuffer[8192];
  string              _error_msg;
  
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool>            sourceid_filter;

  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gettimeofday(&starttime, NULL);
    
  string inpath = _upload_parameters["_inputfile"];
  string genome = _upload_parameters["genome_assembly"];
  //boost::algorithm::to_lower(genome); 
    
  gzFile gz = gzopen(inpath.c_str(), "rb");
  if(!gz) {
    snprintf(strbuffer, 8190, "failed to gzopen input file [%s]", inpath.c_str());
    _upload_parameters["upload_error"] = strbuffer;
    return NULL;
  }
  
  string outpath = _upload_output_name();
  outpath += ".zdx";
  fprintf(stderr, "upload to zdx : inpath [%s] => [%s]\n", inpath.c_str(), outpath.c_str());
  
  if(_upload_parameters.find("display_name") == _upload_parameters.end()) {    
    _upload_parameters["display_name"] = _upload_parameters["_build_filename"];
  }
  _upload_parameters["orig_file"] = inpath;
  

  //create the ZDX file
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new(outpath);
  EEDB::Peer* zdxpeer = zdxstream->self_peer();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  
  //create the genome chromosomes in the ZDX
  ZDXdb* zdxdb = zdxstream->zdxdb();

  // make sure all the chroms are loaded into memory
  fprintf(stderr, "load chroms [%s] ... ", genome.c_str());
  EEDB::WebServices::RegionServer *webservice = new EEDB::WebServices::RegionServer();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();
  webservice->postprocess_parameters();
    
  EEDB::Assembly *assembly = webservice->find_assembly(genome);
  vector<EEDB::Chrom*> chroms;
  if(assembly) { assembly->all_chroms(chroms); }
  if(!assembly || chroms.empty()) {
    _upload_parameters["upload_error"] = "failed to find assembly ["+genome+"] and fetch chroms";
    //fprintf(stderr, "%s\n", _upload_parameters["upload_error"].c_str());
    return NULL;
  }
  fprintf(stderr, "%ld chroms\n", chroms.size());
    
  //
  // OscFileParser based parsing
  //
  EEDB::Tools::OSCFileParser *oscparser = new EEDB::Tools::OSCFileParser();
  oscparser->set_peer(zdxpeer);
  oscparser->set_assembly(assembly);
  map<string,string>::iterator    p_it;
  for(p_it=_upload_parameters.begin(); p_it!=_upload_parameters.end(); p_it++) {
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
  if(!oscparser->primary_feature_source()) { //to make sure it is initialized
    _error_msg+="problem creating oscfile primary_feature_source. ";
  }
  
  int chrom_idx, start_idx, end_idx, strand_idx; 
  oscparser->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
  if(chrom_idx== -1 || start_idx==-1) {
    _error_msg+="malformed file: does not defined chrom or chrom_start columns. "; 
  }
  
  if(!_error_msg.empty()) {
    fprintf(stderr, "%s\n", _error_msg.c_str());
    _upload_parameters["upload_error"] = _error_msg;
    return NULL;
  }
  string filetype  = oscparser->get_parameter("filetype");
  fprintf(stderr, "parsing [%s] filetype\n", filetype.c_str());
  
  
  //reading of file and line parsing  
  gzrewind(gz);
  EEDB::ZDX::ZDXsegment* zseg = NULL;
  
  count=0;
  long              last_update=starttime.tv_sec;
  map<string,long>  category_count;
  long              feature_id=1;
  long              line_count=0;
  list<fbuf_entry>  feature_buffer;
  
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
      snprintf(strbuffer, 8190, "datafile line %ld : unable to parse [", line_count);
      string error_msg = strbuffer + tline + "] " + oscparser->get_parameter("_parsing_error");
      _upload_parameters["upload_error"] = error_msg;
      //fprintf(stderr, "%s\n", error_msg.c_str());
      return NULL;
    }

    //skip unmapped features
    if(!in_feature->chrom() || (in_feature->chrom()->chrom_name().empty()) || (in_feature->chrom()->chrom_name() == "*")) {
      in_feature->release();
      continue;
    }
    
    string category = in_feature->feature_source()->category();
    category_count[category]++;
    EEDB::DataSource::add_to_sources_cache(in_feature->feature_source());

        
    in_feature->primary_id(feature_id++);
    fbuf_entry fent1;
    fent1.feature = in_feature;
    fent1.link_id = "";
    
    bool made_link = false;
    
    //fprintf(stderr, "===IN  %13s %30s  %s\n", category.c_str(), in_feature->chrom_location().c_str(), in_feature->db_id().c_str());

    //GFF based sub-in_feature consolidation
    if((filetype == "gff") || (filetype == "gff3") || (filetype == "gff2") || (filetype == "gtf") || (filetype == "gtf2")) {
      map<string,bool> parents;
      EEDB::Metadata* md1, *md2, *md3;
      
      //exon_id, transcript_id, gene_id are Ensembl, Havana, gencode variation GTF
      //like GTF2  http://mblab.wustl.edu/GTF2.html
      md1 = in_feature->metadataset()->find_metadata("gene_id","");
      md2 = in_feature->metadataset()->find_metadata("transcript_id","");
      md3 = in_feature->metadataset()->find_metadata("exon_id","");
      if(category=="exon") {
        if(md3) {
          in_feature->primary_name(md3->data());
        } else if(md2) {
          in_feature->primary_name(md2->data());
        } else if(md1) {
          in_feature->primary_name(md1->data());
        }
      }

      if(md1) {
        if(category=="gene") {
          in_feature->primary_name(md1->data());
          fent1.link_id = md1->data();
        } else {
          parents[md1->data()] = true;; 
        }
      }
      
      if(md2) {
        if(category=="transcript") {
          in_feature->primary_name(md2->data());
          fent1.link_id = md2->data();
        } else {
          parents[md2->data()] = true;;
        }
      }

      //GFF3 spec (ID and Parenti) override the GTF2 attributes
      if((md1 = in_feature->metadataset()->find_metadata("ID",""))) {
        fent1.link_id = md1->data();
        in_feature->primary_name(md1->data());
        parents[md1->data()] = true; //any object with ID is a potential parent
        in_feature->metadataset()->add_metadata("gff:ID", md1->data());
        in_feature->metadataset()->remove_metadata_like("ID", md1->data());
      }
      if((md1 = in_feature->metadataset()->find_metadata("Name",""))) {
        in_feature->primary_name(md1->data()); 
        in_feature->metadataset()->add_metadata("gff:Name", md1->data());
        in_feature->metadataset()->remove_metadata_like("Name", md1->data());
      }
      vector<Metadata*> md2s = in_feature->metadataset()->find_all_metadata_like("Parent", "");
      for(unsigned i2=0; i2<md2s.size(); i2++) {
        parents[md2s[i2]->data()] = true; 
      }

      //cleanup old display_name so that it resets
      in_feature->metadataset()->remove_metadata_like("eedb:display_name", ""); //since reset above

      //might need to parse other GFF/GTF parent/child methods in the future

      if(!parents.empty()) {
        list<fbuf_entry>::iterator it7;
        for(it7=feature_buffer.begin(); it7!=feature_buffer.end(); it7++) {
          if(parents.find((*it7).link_id) != parents.end()) { 
            EEDB::Feature *linkfeat = (*it7).feature;
            //fprintf(stderr, "  LINK into %s\n", linkfeat->display_desc().c_str());
            linkfeat->add_subfeature(in_feature);
            made_link = true;
          }
        }
      }
    }
    
    feature_buffer.push_front(fent1);      

    //show progress update every 3 seconds
    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 3) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld input features  %13.2f obj/sec [buf %ld]\n", count, rate, feature_buffer.size());
    }
    
    if(made_link) { continue; }

    //check that in_feature does not overlap the next out_feature of the buffer
    fbuf_entry fent2 = feature_buffer.back();
    EEDB::Feature *out_feature = fent2.feature;
    if(out_feature and (in_feature->chrom_start() <= out_feature->chrom_end())) {
      //fprintf(stderr, "in_feature overlapping next out_feature so don't write out\n");
      continue;
    }
    
    //write some features into ZDX
    while(feature_buffer.size() > 300) {       
      fent2 = feature_buffer.back();
      out_feature = fent2.feature;
      feature_buffer.pop_back();
      
      //fprintf(stderr,"\n===OUT %ld\n%s======\n\n", feature_buffer.size(), out_feature->xml().c_str());
      
      if(!zseg 
         || (zseg->assembly_name() != out_feature->chrom()->assembly_name()) 
         || (zseg->chrom_name() != out_feature->chrom()->chrom_name())
         || (out_feature->chrom_start() > zseg->chrom_end())
         || (out_feature->chrom_start() < zseg->chrom_start())
         ) {
        if(zseg) {
          //if(zseg->chrom_name() != out_feature->chrom()->chrom_name()) {
          //  fprintf(stderr, "  chrom [%s] total count %ld\n", zseg->chrom_name().c_str(), chrom_count[zseg->chrom_name()]);
          //}
          //write the old zsegment
          //fprintf(stderr, "write ZDXsegment %s\n", zseg->xml().c_str());
          zseg->write_segment_features();
          zseg->release();
          zseg=NULL;
        }
        if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name())) {
          fprintf(stderr, "need to create zdx chromosome %s\n", out_feature->chrom()->xml().c_str());
          if(zdxstream->create_chrom(out_feature->chrom()) == -1) {
            _upload_parameters["upload_error"] = "unknown chromosome [" + out_feature->chrom()->chrom_name() + "]";
            return NULL;
          }
        }
        zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name(), out_feature->chrom_start());
        if(zseg) { 
          zseg->reclaim_for_appending();
          //fprintf(stderr, "changed ZDXsegment %s\n", zseg->xml().c_str());
        }
      }
      if(zseg) {
        zseg->add_unsorted_feature(out_feature);
      } else { 
        fprintf(stderr, "failed to fetch zseg [%s]\n", out_feature->chrom_location().c_str()); 
      }
      
      out_feature->release();
    }
  }
  
  //flush remaining feature_buffer
  while(!feature_buffer.empty()) {    
    fbuf_entry fent2 = feature_buffer.back();
    EEDB::Feature *out_feature = fent2.feature;
    feature_buffer.pop_back();

    //fprintf(stderr,"\n===OUT %ld\n%s======\n\n", feature_buffer.size(), out_feature->xml().c_str());
    
    //write into ZDX
    if(!zseg 
       || (zseg->assembly_name() != out_feature->chrom()->assembly_name()) 
       || (zseg->chrom_name() != out_feature->chrom()->chrom_name())
       || (out_feature->chrom_start() > zseg->chrom_end())
       || (out_feature->chrom_start() < zseg->chrom_start())
       ) {
      if(zseg) {
        //write the old zsegment
        //fprintf(stderr, "write ZDXsegment %s\n", zseg->xml().c_str());
        zseg->write_segment_features();
        zseg->release();
        zseg=NULL;
      }
      if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name())) {
        fprintf(stderr, "need to create zdx chromosome %s\n", out_feature->chrom()->xml().c_str());
        if(zdxstream->create_chrom(out_feature->chrom()) == -1) {
          _upload_parameters["upload_error"] = "unknown chromosome [" + out_feature->chrom()->chrom_name() + "]";
          return NULL;
        }
      }
      zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, out_feature->chrom()->assembly_name(), out_feature->chrom()->chrom_name(), out_feature->chrom_start());
      if(zseg) { 
        zseg->reclaim_for_appending();
        //fprintf(stderr, "changed ZDXsegment %s\n", zseg->xml().c_str());
      }
    }
    if(zseg) {
      zseg->add_unsorted_feature(out_feature);
    } else { 
      fprintf(stderr, "failed to fetch zseg [%s]\n", out_feature->chrom_location().c_str());
    }
    
    out_feature->release();        
  }
  if(zseg) { zseg->write_segment_features(); } //write the last zsegment  
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
  zdxstream->build_feature_name_index();

  free(_data_buffer);
  zdxstream->release();
  
  //registry new zdx peer into user registry
  if(_current_job && _current_job->user()) {
    EEDB::Peer *user_reg = _current_job->user()->user_registry();
    fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
    zdxpeer->store(user_reg->peer_database());
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "load_into_zdx in %1.6f sec [%s]\n",
          (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0, outpath.c_str());  
  return zdxpeer;
}


string  EEDB::JobQueue::UploadFile::_upload_output_name() {
  string filepath = _upload_parameters["_inputfile"];
  if(filepath.empty()) { return ""; }
  
  size_t ridx = filepath.rfind("/");
  if(ridx!=string::npos) {
    _upload_parameters["_input_dir"] = filepath.substr(0,ridx);
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
  _upload_parameters["_build_filename"] = filepath;
  
  string output_path;
  if(_upload_parameters.find("_build_dir") != _upload_parameters.end()) { 
    //should also check to make sure the build_dir exists with a stat()
    output_path = _upload_parameters["_build_dir"] +"/"+ filepath;
  } else if(!_upload_parameters["_input_dir"].empty()) {
    output_path = _upload_parameters["_input_dir"] +"/"+ filepath;
  } else {
    output_path = filepath;
  }
  _upload_parameters["_outputfile"] = filepath;
  return output_path;  
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


EEDB::Peer*  EEDB::JobQueue::UploadFile::load_into_new_genome() {
  //create new genome, loading into ZDX
  struct timeval      starttime,endtime,difftime;
  char                strbuffer[8192];
  
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool>            sourceid_filter;
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gettimeofday(&starttime, NULL);
  
  string inpath   = _upload_parameters["_inputfile"];
  string genome   = _upload_parameters["upload_genome_name"];
  long taxon_id   = strtol(_upload_parameters["taxon_id"].c_str(), NULL, 10);
  string filetype = _upload_parameters["filetype"];
  
  string basename = _upload_output_name();
  string outpath  = basename + ".zdx";
  fprintf(stderr, "upload to zdx : inpath [%s] => [%s]\n", inpath.c_str(), outpath.c_str());
  _upload_parameters["orig_file"] = inpath;
  
  //create the ZDX file
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new(outpath);
  EEDB::Peer* zdxpeer = zdxstream->self_peer();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  
  //get the genome information from NCBI webservices
  EEDB::Assembly* assembly = new EEDB::Assembly();
  assembly->taxon_id(taxon_id);
  assembly->assembly_name(genome);
  assembly->sequence_loaded(true);
  assembly->metadataset()->add_metadata("import_date", "today");

  if(!assembly->fetch_NCBI_taxonomy_info()) {
    snprintf(strbuffer, 8190, "error fetching taxon_id %ld from NCBI", taxon_id);
    _upload_parameters["upload_error"] = strbuffer;
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
    //  _upload_parameters["upload_error"] = "error extracting sequence from tar";
    //  return NULL;
    //}
    //unpack the .tar into seqdir
    string cmd = "tar -x -C "+seqdir+" -f "+inpath;
    if(inpath.rfind(".tar.gz") != string::npos) { cmd += " -z"; }
    fprintf(stderr, "%s\n", cmd.c_str());
    if(system(cmd.c_str()) != 0) {
      _upload_parameters["upload_error"] = "error extracting sequence from tar";
      //fprintf(stderr, "%s", _upload_parameters["upload_error"].c_str());
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
      _upload_parameters["upload_error"] = "error extracting sequence from tar";
      //fprintf(stderr, "%s", _upload_parameters["upload_error"].c_str());
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
    _upload_parameters["upload_error"] = "unknown file type ["+filetype+"]";
    //fprintf(stderr, "%s", _upload_parameters["upload_error"].c_str());
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


EEDB::Peer*  EEDB::JobQueue::UploadFile::load_into_existing_genome() {
  //appends new chromosomes into previous genome
  //TODO: this is just a stub, need to implement this version
  struct timeval      starttime,endtime,difftime;
  
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool>            sourceid_filter;
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gettimeofday(&starttime, NULL);

  string inpath   = _upload_parameters["_inputfile"];
  string genome   = _upload_parameters["genome_assembly"];  //maybe upload_genome_name
  string filetype = _upload_parameters["filetype"];

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "loaded extra chromosomes into genome [%s] in %1.6f sec \n", genome.c_str(), (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);

  return NULL;
}

//--------------------------------------------------------------------------------

bool EEDB::JobQueue::UploadFile::_fasta_create_chromosomes(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name) {
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
    _upload_parameters["upload_error"] = "unknown file type ["+path+"]";
    return false;
  }
  fprintf(stderr,"fasta_create_chromosomes [%s]\n", path.c_str());
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) {
    snprintf(strbuffer, 8190, "failed to gzopen input file [%s]", path.c_str());
    _upload_parameters["upload_error"] = strbuffer;
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
          _upload_parameters["upload_error"] = "unable to create chromosome [" +chrom->fullname()+ "]";
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
      _upload_parameters["upload_error"] = "unable to create chromosome [" +chrom->fullname()+ "]";
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


bool EEDB::JobQueue::UploadFile::_chromosome_chunk_fasta(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name) {
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
    _upload_parameters["upload_error"] = "unknown file type ["+path+"]";
    return false;
  }
  
  fprintf(stderr,"chromosome_chunk_fasta [%s]\n", path.c_str());
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) {
    snprintf(strbuffer, 8190, "failed to gzopen input file [%s]", path.c_str());
    _upload_parameters["upload_error"] = strbuffer;
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
      
      chrom = EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, assembly->assembly_name(), name);
      if(!chrom) {
        _upload_parameters["upload_error"] = "unable to fetch chromosome [" +assembly->assembly_name() +"] ["+ name+ "]";
        fprintf(stderr, "%s\n", _upload_parameters["upload_error"].c_str());
        return false;
      }
      
      //reset variables
      seq.erase();
      chrom_start = 1; //chromosomes are referenced starting at '1'
      chrom_len =0;
      //if(chrom) { fprintf(stderr,"  %s\n", chrom->display_desc().c_str()); }
    } else {
      if(!chrom) {
        _upload_parameters["upload_error"] = "no chromosome definition";
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


bool EEDB::JobQueue::UploadFile::_create_chunk(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Chrom *chrom, long chr_start, long chr_end, string seq) {
  if(!zdxstream) { return false; }
  fprintf(stderr,"  chunk %s : %ld : %ld : %ld :: ", chrom->fullname().c_str(), chr_start, _chunk_size, seq.length());
  
  EEDB::ChromChunk* chunk = new EEDB::ChromChunk();
  chunk->chrom(chrom);
  chunk->chrom_start(chr_start);
  chunk->chrom_end(chr_end);
  chunk->sequence(seq.c_str());
  
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, chrom->assembly_name(), chrom->chrom_name())) {
    _upload_parameters["upload_error"] = "unknown chromosome [" + chrom->chrom_name() + "]";
    return false;
  }
  
  EEDB::ZDX::ZDXsegment* zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, chrom->assembly_name(), chrom->chrom_name(), chr_start);
  if(!zseg) {
    _upload_parameters["upload_error"] = "internal zdx segment error [" + chrom->chrom_name() + "]";
    return false;
  }

  zseg->reclaim_for_appending();
  fprintf(stderr, "%s\n", zseg->xml().c_str());
  
  //write ChromChunk into zseg
  if(!zseg->add_chrom_chunk(chunk)) {
    _upload_parameters["upload_error"] = "error writing chunk to zdx " + zseg->xml();
    return false;
  }
  zseg->write_build_complete(); //finished write, releases claim

  return true;
}


//--------------------------------------------------------------------------------
//
// loading genome from NCBI webservices
//
//--------------------------------------------------------------------------------


EEDB::Peer*  EEDB::JobQueue::UploadFile::load_genome_from_NCBI(string search_term) {
  //use NCBI webservices to load genome. uses the NCBI RefSeq assembly_acc ID
  //for example: AssemblyAccession GCF_000002285.3  is CamFam3.1
  
  //loading genomes from NCBI webservices
  //http://www.ncbi.nlm.nih.gov/assembly/GCF_000001895.5?report=xml&format=text
  //http://www.ncbi.nlm.nih.gov/nuccore/NC_006583.3?report=fasta&log$=seqview&format=text
  //ftp://ftp.ncbi.nlm.nih.gov/genomes/ASSEMBLY_REPORTS/All/GCF_000002285.3.assembly.txt
  
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  if(search_term.empty()) { return NULL; }
  
  map<string, EEDB::Datatype*>   datatypes;
  map<string, bool>              sourceid_filter;
  vector<string>                 cols;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return NULL; }

  string name_mode = "ucsc";
  if(_upload_parameters["genome_name_mode"] == "ncbi") { name_mode="ncbi"; }
  if(_upload_parameters["genome_name_mode"] == "ensembl") { name_mode="ensembl"; }
  
  //get the genome assembly and taxon from NCBI webservices
  vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search(search_term);
  if(assembly_array.empty()) { return NULL; }
  EEDB::Assembly *assembly = assembly_array[0];
  assembly->sequence_loaded(true);
  assembly->create_date(time(NULL));

  if(name_mode!="ucsc") { assembly->assembly_name(assembly->ncbi_version()); }
  
  string user_rootdir = getenv("EEDB_USER_ROOTDIR");
  //zenbu_genome-9615-GCF_000002285.3-CanFam3.1
  string outdir = user_rootdir +"/zenbu_genome-"+l_to_string(assembly->taxon_id())+"-NCBI-"+ assembly->ncbi_assembly_accession()+"-"+ assembly->ncbi_version();
  boost::algorithm::replace_all(outdir, " ", "_");
  fprintf(stderr, "upload to [%s]\n", outdir.c_str());
  mkdir(outdir.c_str(), 0770);
  
  //create the ZDX file for the genome sequence
  string zdxpath = outdir + "/assembly.zdx";
  fprintf(stderr, "%s\n", zdxpath.c_str());
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open(zdxpath);
  if(!zdxstream) {
    zdxstream = EEDB::ZDX::ZDXstream::create_new(zdxpath);
  }
  EEDB::Peer* zdxpeer = zdxstream->self_peer();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  fprintf(stderr,"%s\n", assembly->xml().c_str());
  //write assembly into zdx
  zdxstream->add_genome(assembly);  //for loading new genomes
  zdxstream->write_source_section();
  ZDXdb* zdxdb = zdxstream->zdxdb();

  //create the entrez gene sqlite database
  string zenbu_rootdir = getenv("EEDB_ROOT");
  string entrezpath = outdir + "/entrez_gene.sqlite";
  string sqlite_template = zenbu_rootdir+"/sql/schema.sqlite";

  string cmd = "sqlite3 "+ entrezpath + " < "+sqlite_template;
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());
  
  string entrez_dburl = "sqlite://"+entrezpath;
  MQDB::Database *entrezDB = new MQDB::Database(entrez_dburl);
  EEDB::Peer *entrez_peer = NULL;
  if(entrezDB and entrezDB->get_connection()) {
    entrez_peer = EEDB::Peer::new_from_url(entrez_dburl);
    if(!entrez_peer->is_valid()) {
      entrez_peer->create_uuid();
      string puburl = entrezDB->public_url();
      entrez_peer->db_url(puburl);
      entrez_peer->store(entrezDB);
      entrezDB->do_sql("UPDATE peer SET is_self=1 WHERE uuid=?", "s", entrez_peer->uuid());
      fprintf(stderr,"new peer : %s\n", entrez_peer->xml().c_str());
    }
    assembly->store(entrezDB);
    entrezDB->uuid(entrez_peer->uuid());

    entrezDB->do_sql("PRAGMA journal_mode=OFF");
    //entrezDB->do_sql("PRAGMA synchronous=OFF");
    //entrezDB->do_sql("PRAGMA count_changes=OFF");
    //entrezDB->do_sql("PRAGMA temp_store=OFF");
  } else {
    fprintf(stderr,"\nERROR: unable to connect to sql database [%s]!!\n\n", entrez_dburl.c_str());
    return NULL;
  }

  //get the assembly report of all the chromosomes and create all the chromosomes
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  //OLD ftp://ftp.ncbi.nlm.nih.gov/genomes/ASSEMBLY_REPORTS/All/GCF_000002285.3.assembly.txt  -- OLD pre Sept 2016
  //string url = "ftp://ftp.ncbi.nlm.nih.gov/genomes/ASSEMBLY_REPORTS/All/"+assembly->ncbi_assembly_accession()+"_assembly_report.txt";
  //ftp://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/004/665/GCF_000004665.1_Callithrix_jacchus-3.2/GCF_000004665.1_Callithrix_jacchus-3.2_assembly_report.txt
  //string url = "ftp://ftp.ncbi.nlm.nih.gov/genomes/ASSEMBLY_REPORTS/All/"+assembly->ncbi_assembly_accession()+"_assembly_report.txt";
  EEDB::Metadata *md2 = assembly->metadataset()->find_metadata("FtpPath_Assembly_rpt", "");
  string url = md2->data();
  fprintf(stderr, "POST [%s]\n", url.c_str());
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  //curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str());
  //curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length());
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl);
  
  //fprintf(stderr, "%s\n", chunk.memory);
  // parse out the chromosome/scaffolds from the result
  char *line, *p1, *p2, *p3, *endline;
  p3 = chunk.memory;
  
  while(*p3 != '\0') {
    line = p3;
    while((*p3 != '\n') && (*p3 != '\r') && (*p3!='\0')) { p3++; } //find end of this line
    endline = p3;
    if(*p3!='\0') {
      *p3 = '\0';
      p3++;
    }
    while(((*p3 == '\n') || (*p3 == '\r')) && (*p3!='\0')) { p3++; } //empty lines
    
    //while(*(endline-1)==' ') { *(endline-1)='\0'; endline--; }  //eat spaces at end of line
    //while(*line==' ') { line++; } //eat spaces at start of line
    
    //fprintf(stderr,"LINE : [%s]\n", line);
    if(line[0] == '#') { continue; }
    //fprintf(stderr,"CHROM  : [%s]\n", line);
    
    //Sequence-Name	Sequence-Role	Assigned-Molecule	Assigned-Molecule-Location/Type	GenBank-Accn	Relationship	RefSeq-Accn	Assembly-Unit	Sequence-Length	UCSC-style-name
    //chr03	assembled-molecule	3	Chromosome	CM000003.3	=	NC_006585.3	Primary Assembly	91889043	chr3
    
    cols.clear();
    p1 = line;
    while(*p1!='\0') {
      p2=p1;
      while((*p2 != '\t') && (*p2!='\n') && (*p2!='\0')) { p2++; }
      *p2 = '\0';
      cols.push_back(p1);
      if(p2==endline) { break; }
      p1 = p2+1;
    }
    //fprintf(stderr,"%ld columns\n", cols.size());
    
    string chrom_name   = cols[9]; //ucsc name
    string ncbi_name    = cols[0]; 
    string refseq_accn  = cols[6];
    string genbank_accn = cols[4];
    string ucsc_name    = cols[9];

    if(chrom_name == "na") { chrom_name = cols[0]; } //if no ucsc name then use the NCBI chrom name
    if(chrom_name == "na") { chrom_name = cols[6]; } //else use RefSeq accession as name
    if(chrom_name == "na") { chrom_name = cols[4]; } //else GenBank accession as name

    if(ncbi_name=="na") { ncbi_name=""; }
    if(refseq_accn=="na") { refseq_accn=""; }
    if(genbank_accn=="na") { genbank_accn=""; }
    if(ucsc_name=="na") { ucsc_name=""; }
    
    if(name_mode=="ncbi") {
      if(!ncbi_name.empty()) { chrom_name = ncbi_name; }
    }
    if(name_mode=="ensembl") {
      //special logic for zebrafish to make like Ensembl, might extend to other situations
      if(!ncbi_name.empty()) {
        if(cols[0][0]=='M') { chrom_name = ncbi_name; } //NCBI name for MT
        if(isdigit(cols[0][0])) { chrom_name = ncbi_name; } //NCBI name is just a number
      }
      if(strstr(chrom_name.c_str(), "chrUn_")!=0) { chrom_name = genbank_accn; } //GenBank accn
    }

    //string chrom_acc    = cols[6];
    //if(chrom_acc  == "na") { chrom_acc  = cols[4]; } //use the GenBank-Accn if the RefSeq-Accn is NA
    long   chrom_length = strtol(cols[8].c_str(), NULL, 10);
    //fprintf(stderr, "[%s] [%s] %ld\n", chrom_name.c_str(), chrom_acc.c_str(), chrom_length);
    
    EEDB::Chrom *chrom = EEDB::ZDX::ZDXsegment::fetch_chrom(zdxdb, assembly->assembly_name(), chrom_name);
    if(!chrom) {
      //create the chromosome;
      chrom = new EEDB::Chrom;
      chrom->chrom_name(chrom_name);
      chrom->assembly(assembly);
      chrom->chrom_length(chrom_length);
      chrom->ncbi_chrom_name(ncbi_name);  //NCBI chrom name
      chrom->ncbi_accession(genbank_accn);   //GenBank accession
      chrom->refseq_accession(refseq_accn); //RefSeq accession
      chrom->chrom_name_alt1(ucsc_name); //store the UCSC name into the alt1 name
      //chrom->description(description);
      fprintf(stderr, "  create zdx chromosome %s\n", chrom->xml().c_str());
      if(zdxstream->create_chrom(chrom) == -1) {
        _upload_parameters["upload_error"] = "unable to create chromosome [" +chrom->fullname()+ "]";
        return NULL;
      }
      chrom->store(entrezDB);
    } else {
      //maybe need version where entrezDB needs to be built from the zdx
      chrom->assembly(assembly);
      //TODO: this is a bug, these should have been read from the ZDX
      chrom->ncbi_chrom_name(ncbi_name);  //NCBI chrom name
      chrom->ncbi_accession(genbank_accn);   //GenBank accession
      chrom->refseq_accession(refseq_accn); //RefSeq accession
      chrom->chrom_name_alt1(ucsc_name); //store the UCSC name into the alt1 name
      chrom->store(entrezDB);
    }
  }
  
  //next load the chrom sequences
  load_ncbi_chrom_sequence(zdxstream, assembly);

  //finally load the entrez genes
  load_entrez_genes_from_NCBI(zdxdb, entrezDB, assembly->assembly_name());

  //link zdx genome into entrez as registry
  //zdxpeer->store(entrezDB);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "created genome from NCBI [%s] in %1.6f sec \n", assembly->display_desc().c_str(), (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
 
  printf("genome peer::\n   %s\n", zdxpeer->xml().c_str());
  printf("entrez peer::\n   %s\n", entrez_peer->xml().c_str());

  //
  // check registry
  //
  if(!(_upload_parameters["registry_url"].empty())) {
    EEDB::Peer     *registry    = EEDB::Peer::new_from_url(_upload_parameters["registry_url"]);
    MQDB::Database *registry_db = new MQDB::Database(_upload_parameters["registry_url"]);
    //if(!registry or !(registry->is_valid())) {
    //  printf("\nERROR: unable to connect to registry [%s]!!\n\n", _upload_parameters["registry_url"].c_str());
    //}
    //if((registry_db==NULL) or !(registry_db->get_connection())) {
    //  printf("\nERROR: unable to connect to registry database [%s]!!\n\n", _upload_parameters["registry_url"].c_str());
    //}
    //printf("registry::\n   %s\n", registry->xml().c_str());

    if(registry && registry_db) {
      printf("registry::\n   %s\n", registry->xml().c_str());
      zdxpeer->store(registry_db);
      entrez_peer->store(registry_db);
    }
  }
 
  return entrez_peer;
}


bool EEDB::JobQueue::UploadFile::load_ncbi_chrom_sequence(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly) {
  if(_upload_parameters["skip_seq"] == "true") { return true; }

  fprintf(stderr, "UploadFile::load_ncbi_chrom_sequence\n");
  struct timeval                 starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);

  if(!zdxstream) { return false; }
  if(!assembly) { return false; }

  EEDB::Peer* zdxpeer = zdxstream->self_peer();
  fprintf(stderr, "%s\n", zdxpeer->xml().c_str());
  fprintf(stderr,"%s\n", assembly->xml().c_str());
  ZDXdb* zdxdb = zdxstream->zdxdb();

  string user_rootdir = getenv("EEDB_USER_ROOTDIR");
  //zenbu_genome-9615-GCF_000002285.3-CanFam3.1
  string outdir = user_rootdir +"/zenbu_genome-"+l_to_string(assembly->taxon_id())+"-NCBI-"+ assembly->ncbi_assembly_accession()+"-"+ assembly->ncbi_version();
  boost::algorithm::replace_all(outdir, " ", "_");
  fprintf(stderr, "upload to [%s]\n", outdir.c_str());
  mkdir(outdir.c_str(), 0770);

  // get chroms from the zdx
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  //sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  fprintf(stderr,"zdx has %ld chroms\n", chroms.size());

  //
  // LOAD the chromosome sequence
  //
  //http://www.ncbi.nlm.nih.gov/nuccore/NC_006583.3?report=fasta&log$=seqview&format=text
  //http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=25026556&rettype=fasta&retmode=text
  string cmd;
  long length_count=0;
  long chrom_count=0;
  string ids_str;
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    EEDB::Chrom *chrom = (*chr_it);
    chrom_count++;
    fprintf(stderr, "%5ld :: %s name[%s] ncbi_name[%s] ncbi_acc[%s] refseq_acc[%s] altname[%s] (%ldbp)\n", chrom_count, chrom->fullname().c_str(), 
      chrom->chrom_name().c_str(), 
      chrom->ncbi_chrom_name().c_str(), 
      chrom->ncbi_accession().c_str(), 
      chrom->refseq_accession().c_str(), 
      chrom->chrom_name_alt1().c_str(), 
      chrom->chrom_length());
    
    length_count += chrom->chrom_length();
    if(!ids_str.empty()) { ids_str += ","; }
    ids_str += chrom->refseq_accession();

    if(length_count > 1000000) { //group the chrom ids so that we fetch at leat 1Mbase at a time
      //http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=25026556&rettype=fasta&retmode=text
      //string fasta_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&rettype=fasta&retmode=text&id=" + chrom->refseq_accession();
      string fasta_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&rettype=fasta&retmode=text&id=" + ids_str;
      cmd = "cd " + outdir + "; wget \""+fasta_url+"\" -O sequence.fasta";
      fprintf(stderr, "%s\n", cmd.c_str());
      system(cmd.c_str());

      _chromosome_chunk_fasta(zdxstream, assembly, outdir+"/sequence.fasta", true);

      //reset counters
      ids_str.clear();
      length_count = 0;
    }
  }
  //last remaining chrom ids group
  if(length_count > 0) { 
    //http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=25026556&rettype=fasta&retmode=text
    //string fasta_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&rettype=fasta&retmode=text&id=" + chrom->refseq_accession();
    string fasta_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&rettype=fasta&retmode=text&id=" + ids_str;
    cmd = "cd " + outdir + "; wget \""+fasta_url+"\" -O sequence.fasta";
    fprintf(stderr, "FINAL %s\n", cmd.c_str());
    system(cmd.c_str());

    _chromosome_chunk_fasta(zdxstream, assembly, outdir+"/sequence.fasta", true);
  }
  //clean up the sequence.fasta file
  cmd = "rm " + outdir + "/sequence.fasta";
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());
  
  if(chroms.empty()) {
    //the assembly_report method did not work so try the genomic.fna.gz file
    fprintf(stderr, "\nassembly_report empty so try _genomic.fna.gz\n");
    EEDB::Metadata* md1 = assembly->metadataset()->find_metadata("FtpPath_GenBank", "");
    if(md1) {
      fprintf(stderr, "FtpPath_GenBank[%s]\n", md1->data().c_str());
      string fasta_name = md1->data();
      std::size_t p2 = fasta_name.rfind("/");
      if(p2!=std::string::npos) {
        fasta_name.erase(0, p2+1);
      }
      fasta_name += "_genomic.fna.gz";
      fprintf(stderr, "fasta_name[%s]\n", fasta_name.c_str());
      //string cmd = "cd " + outdir + "; wget "+md1->data()+"/*genomic.fna.gz";
      //string fasta_name = assembly->ncbi_assembly_accession()+"_"+assembly->ncbi_version()+"_genomic.fna.gz";
      string cmd = "cd " + outdir + "; wget "+md1->data()+"/"+fasta_name;
      fprintf(stderr, "%s\n", cmd.c_str());
      system(cmd.c_str());

      string path = outdir+"/"+fasta_name;
      _fasta_create_chromosomes(zdxstream, assembly, path, true);
      _chromosome_chunk_fasta(zdxstream, assembly, path, true);
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "loaded chromosome sequence from NCBI [%s] in %1.6f sec \n", assembly->display_desc().c_str(), (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);

  return true;
}



//##################################################################
//#
//# Entrez gene webservice based mathods
//#
//##################################################################

bool EEDB::JobQueue::UploadFile::load_entrez_genes_from_NCBI(ZDXdb* zdxdb, MQDB::Database *entrezDB, string assembly_name) {
  if(_upload_parameters["skip_entrez"] == "true") { return true; }

  fprintf(stderr, "UploadFile::load_entrez_genes_from_NCBI\n");
  struct timeval                 starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  if(assembly_name.empty()) { return false; }
  if(!entrezDB) { return false; }

  CURL *curl = curl_easy_init();
  if(!curl) { return false; }

  _entrez_assembly = EEDB::Assembly::fetch_by_name(entrezDB, assembly_name);
  if(!_entrez_assembly) { fprintf(stderr, "error fetching assembly [%s]\n", assembly_name.c_str());  return false; }
  fprintf(stderr, "%s\n", _entrez_assembly->xml().c_str());

  //check if chroms are loaded
  vector<DBObject*> chrs = EEDB::Chrom::fetch_all_by_assembly(_entrez_assembly);
  if(chrs.empty()) {
    fprintf(stderr, "entrezDB is missing chromosomes: copy from zdx\n");
    //read the chroms from zdx and store again into the entrezDB
    vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
    fprintf(stderr,"zdx has %ld chroms\n", chroms.size());
    vector<EEDB::Chrom*>::iterator chr_it;
    long count=0;
    for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
      EEDB::Chrom *chrom = (*chr_it);
      chrom->store(entrezDB);
      count++;
      if(count%1000==0) { fprintf(stderr, "%ld chroms copied\n", count); }
    }
  }

  string fsrc_name = "Entrez_gene_" + _entrez_assembly->ucsc_name();
  _entrez_source = EEDB::FeatureSource::fetch_by_category_name(entrezDB, "gene", fsrc_name);
  if(!_entrez_source) {
    _entrez_source = new EEDB::FeatureSource();
    _entrez_source->category("gene");
    _entrez_source->name(fsrc_name);
    _entrez_source->import_source("NCBI Entrez Gene");
    _entrez_source->create_date(time(NULL));
    _entrez_source->is_active("y");
    _entrez_source->is_visible("y");
    _entrez_source->metadataset()->add_tag_data("import_url", "https://www.ncbi.nlm.nih.gov/sites/entrez?db=gene");
    //Norway Rat (Rattus norvegicus) Rnor_6.0 / GCF_000001895.5 / rn6 entrez genes downloaded from NCBI
    _entrez_source->metadataset()->add_tag_data("description",
                                               _entrez_assembly->common_name() + " (" +_entrez_assembly->genus()+" "+_entrez_assembly->species()+") "+
                                               _entrez_assembly->ncbi_version()+" / "+
                                               _entrez_assembly->ncbi_assembly_accession()+" / "+
                                               _entrez_assembly->ucsc_name()+" entrez genes downloaded from NCBI");
    _entrez_source->metadataset()->add_tag_data("eedb:assembly_name", _entrez_assembly->assembly_name());
    _entrez_source->metadataset()->add_tag_data("ucsc_assembly_name", _entrez_assembly->ucsc_name());
    _entrez_source->metadataset()->add_tag_data("ncbi_assembly_name", _entrez_assembly->ncbi_version());
    _entrez_source->metadataset()->add_tag_data("refseq_assembly_name", _entrez_assembly->ncbi_assembly_accession());
    _entrez_source->store(entrezDB);
    fprintf(stderr,"created :: %s\n", _entrez_source->display_desc().c_str());
  }
  if(!_entrez_source) { fprintf(stderr, "error fetching/creating Entrez feature_source [%s]\n\n", fsrc_name.c_str()); return false; }
  fprintf(stderr, "%s\n", _entrez_source->xml().c_str());
  
  //my $deprecate_source = EEDB::FeatureSource->fetch_by_category_name($eeDB, "gene", "deprecated_entrez_gene");
  //unless($deprecate_source) {
  //  $deprecate_source = new EEDB::FeatureSource;
  //  $deprecate_source->category("gene");
  //  $deprecate_source->name("deprecated_entrez_gene");
  //  $deprecate_source->import_source("NCBI Entrez Gene");
  //  $deprecate_source->metadataset->add_tag_data("import_url", "http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene");
  //  $deprecate_source->store($eeDB);
  //  fprintf(stderr,"Needed to create:: %s\n", $deprecate_source->display_desc);
  //}
  //unless($deprecate_source) { fprintf(stderr,"error making [deprecated_entrez_gene] feature_source\n\n"); usage(); }

  
  //get the list of all current gene EntrezID for this taxon
  string url    = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  string params = "db=gene&retmax=300000&retmode=text&term="+
                   l_to_string(_entrez_assembly->taxon_id())+"[taxid] AND gene_all[filter]";
  //string url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&retmax=300000&term="+
  //             l_to_string(_entrez_assembly->taxon_id())+"[taxid] AND gene_all[filter]";
  //fprintf(stderr, "POST [%s]\n", url.c_str());
  fprintf(stderr, "URL: %s\n", url.c_str());
  fprintf(stderr, "PARAMS: %s\n", params.c_str());
  sleep(2);
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point

  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, params.c_str());
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, params.length());

  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "application/x-www-form-urlencoded");
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");

  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl);
  //fprintf(stderr, "%s\n", chunk.memory);

  rapidxml::xml_document<>   doc;
  rapidxml::xml_node<>       *root_node, *node, *node2;

  char *start_ptr = strstr(chunk.memory, "<eSearchResult");
  if(!start_ptr) { free(chunk.memory); return false; }
  fprintf(stderr, "returned ID list\n");
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; }

  long search_count = 0;
  if((node = root_node->first_node("Count"))) { search_count = strtol(node->value(),NULL, 10); }
  long return_count = 0;
  if((node = root_node->first_node("RetMax"))) { return_count = strtol(node->value(),NULL, 10); }
  fprintf(stderr, "search returned %ld genes\n", search_count);

  vector<long>  id_list;
  if((node = root_node->first_node("IdList"))) {
    node2 = node->first_node("Id");
    while(node2) {
      long id = strtol(node2->value(),NULL, 10);
      id_list.push_back(id);
      node2 = node2->next_sibling("Id");
    }
  }
  fprintf(stderr, "idList %ld\n", id_list.size());
  
  //filter the list into:: new, deprecated, and update
  vector<dynadata>   row_vector;
  map<long, string>  entrezIDhash;
  long newCount=0;
  long updateCount=0;
  long deprecateCount=0;
  //$loadedEntrezIDs = MQdb::MappedQuery::fetch_col_array(entrezDB, $sql, _entrez_source->id);
  const char *sql = "select sym_value from symbol join feature_2_symbol using (symbol_id) \
                     JOIN feature using(feature_id) WHERE sym_type='EntrezID' AND feature_source_id=?";
  void *stmt = entrezDB->prepare_fetch_sql(sql, "d", _entrez_source->primary_id());
  long rowcount=0;
  while(entrezDB->fetch_next_row_vector(stmt, row_vector)) {
    rowcount++;
    long geneID = strtol(row_vector[0].i_string.c_str(),NULL, 10);
    entrezIDhash[geneID] = "dbonly";
  }
  fprintf(stderr, "db has %ld entrez genes (%ld rows)\n", entrezIDhash.size(), rowcount);
  
  vector<long>::iterator it1;
  for(it1=id_list.begin(); it1!=id_list.end(); it1++) {
    long geneID = (*it1);
    if((entrezIDhash.find(geneID) != entrezIDhash.end()) && (entrezIDhash[geneID] == "dbonly")) {
      updateCount++;
      entrezIDhash[geneID]="update";
    }
    else {
      newCount++;
      entrezIDhash[geneID]="new";
    }
  }
  
  map<long, string>::iterator it2;
  for(it2=entrezIDhash.begin(); it2!=entrezIDhash.end(); it2++) {
    if((*it2).second == "dbonly") { deprecateCount++; }
  }
  fprintf(stderr, "=====\n%10ld new genes to add\n", newCount);
  fprintf(stderr, "%10ld genes to update check\n", updateCount);
  fprintf(stderr, "%10ld genes to deprecate\n=====\n", deprecateCount);
  //sleep(5);

  //debugging
  //_sync_entrez_gene_from_webservice(entrezDB, 6556);    //hg38 SLC11A1
  //_sync_entrez_gene_from_webservice(entrezDB, -1);  //flushes the buffer

  //first add new genes
  fprintf(stderr, "===== add %ld new entrez genes\n", newCount);
  for(it2=entrezIDhash.begin(); it2!=entrezIDhash.end(); it2++) {
    if((*it2).second != "new") { continue; }
    _sync_entrez_gene_from_webservice(entrezDB, (*it2).first);
  }
  _sync_entrez_gene_from_webservice(entrezDB, -1);  //flushes the buffer
  
  //then the updates
  fprintf(stderr, "===== update-check %ld entrez genes\n", updateCount);
  for(it2=entrezIDhash.begin(); it2!=entrezIDhash.end(); it2++) {
    if((*it2).second != "update") { continue; }
    _sync_entrez_gene_from_webservice(entrezDB, (*it2).first);
  }
  _sync_entrez_gene_from_webservice(entrezDB, -1);  //flushes the buffer
  
  //last deprecate
  fprintf(stderr, "===== deprecate %ld entrez genes\n", deprecateCount);
  for(it2=entrezIDhash.begin(); it2!=entrezIDhash.end(); it2++) {
    if((*it2).second != "dbonly") { continue; }
    //deprecate_geneID($geneID);
    _sync_entrez_gene_from_webservice(entrezDB, (*it2).first);
  }
  _sync_entrez_gene_from_webservice(entrezDB, -1);  //flushes the buffer
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "loaded entrez genes from NCBI [%s] in %1.6f sec \n", _entrez_assembly->display_desc().c_str(), (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  //fprintf(stderr,"MOVED stats : %d / %d = %1.2f%%\n", _entrez_locmove_count, $genecount, 100.0*_entrez_locmove_count/$genecount);
  return true;
}


void  EEDB::JobQueue::UploadFile::_sync_entrez_gene_from_webservice(MQDB::Database *entrezDB, long entrezID) {
  if(entrezID>0) {
    //$genecount++;
    //fprintf(stderr,"entrezID: %d\n", entrezID);
    _entrez_gene_id_buffer.push_back(entrezID);
    if(_entrez_gene_id_buffer.size() < 2500) { return; }
  }
  if(_entrez_gene_id_buffer.empty()) { return; }
  fprintf(stderr, "go to NCBI and get %ld genes\n", _entrez_gene_id_buffer.size());

  CURL *curl = curl_easy_init();
  if(!curl) { return; }
  
  string url    = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
  string params = "db=gene&retmode=text&id=";
  vector<long>::iterator it1;
  for(it1=_entrez_gene_id_buffer.begin(); it1!=_entrez_gene_id_buffer.end(); it1++) {
    if(it1!=_entrez_gene_id_buffer.begin()) { params += ","; }
    params += l_to_string(*it1);
  }
  fprintf(stderr, "URL: %s\n", url.c_str());
  fprintf(stderr, "PARAMS: %s\n", params.c_str());
  //sleep(2);
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, params.c_str());
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, params.length());
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "application/x-www-form-urlencoded");
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl);
  //fprintf(stderr, "%s\n", chunk.memory);  //remove
  
  rapidxml::xml_document<>   doc;
  rapidxml::xml_node<>       *root_node, *node1, *node2;
  
  char *start_ptr = strstr(chunk.memory, "<eSummaryResult");
  if(!start_ptr) { free(chunk.memory); return; }
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; }

  long summary_count=0;
  if(entrezDB->driver() == "sqlite") { entrezDB->do_sql("BEGIN"); }
  if((node1 = root_node->first_node("DocumentSummarySet"))) {
    node2 = node1->first_node("DocumentSummary");
    while(node2) {
      summary_count++;
      EEDB::Feature *feature = _extract_entrez_gene_from_summaryXML(node2);
      feature->release();
      node2 = node2->next_sibling("DocumentSummary");
    }
  }
  if(entrezDB->driver() == "sqlite") { entrezDB->do_sql("COMMIT"); }
  //fprintf(stderr, "processed %ld summaries\n", summary_count);
  //done now so clear out the buffer
  free(chunk.memory);
  _entrez_gene_id_buffer.clear();
}

   

EEDB::Feature*  EEDB::JobQueue::UploadFile::_extract_entrez_gene_from_summaryXML(rapidxml::xml_node<> *summaryXMLnode) {
  //first create a new feature for this data
  //then compare it to the database and do diffs/updates and record the changes
  rapidxml::xml_node<>       *node1, *node2;
  rapidxml::xml_attribute<>  *attr;
  
  if(strcmp(summaryXMLnode->name(), "DocumentSummary")!=0) { return NULL; }
  if(!(attr = summaryXMLnode->first_attribute("uid"))) { return NULL; }
  string entrezID = attr->value();
  //fprintf(stderr, "\n===== _extract_entrez_gene_from_summaryXML (%s)\n", entrezID.c_str());

  EEDB::Feature *new_feature = new EEDB::Feature();
  new_feature->feature_source(_entrez_source);
  new_feature->significance(0.0);
  EEDB::MetadataSet *mdset = new_feature->metadataset();
  mdset->add_tag_symbol("EntrezID", entrezID);
  
  //need to combine the description and organism name into a nice description
  string desc;
  string organism;
  
  node1 =summaryXMLnode->first_node();
  while(node1) {
    string type = node1->name();
    string value = node1->value();
    //fprintf(stderr, "key[%s] (%s)\n", type.c_str(), value.c_str());
    if(type == "Name") {
      new_feature->primary_name(value);
      mdset->add_metadata("EntrezGene", value);
    }
    else if(type == "Description") {
      desc = value;
    }
    //else if(type == "Organism") { //no longer needed
    //mdset->add_metadata("description", value);
    //  $organism = value;
    //}
    else if(type == "MapLocation") {
      mdset->add_metadata("GeneticLoc", value);
    }
    else if(type == "Summary") {
      mdset->add_metadata("Summary", value);
    }
    else if(type == "Mim") {
      node2 = node1->first_node("int");
      while(node2) {
        mdset->add_metadata("OMIM", node2->value());
        node2 = node2->next_sibling("int");
      }
    }
    else if(type == "OtherAliases") {
      mdset->add_metadata(type, value);
      char* buf = (char*)malloc(value.size()+2);
      strcpy(buf, value.c_str());
      char *p1 = strtok(buf, ",");
      while(p1!=NULL) {
        while(*p1 == ' ') { p1++; }//remove any leading space
        if(strlen(p1) > 0) {
          mdset->add_metadata("Entrez_synonym", p1);
        }
        p1 = strtok(NULL, ",");
      }
      free(buf);
    }
    else if(type == "OtherDesignations") {
      mdset->add_metadata(type, value);
      char* buf = (char*)malloc(value.size()+2);
      strcpy(buf, value.c_str());
      char *p1 = strtok(buf, "|");
      while(p1!=NULL) {
        while(*p1 == ' ') { p1++; }//remove any leading space
        if(strlen(p1) > 0) {
          mdset->add_metadata("alt_description", p1);
        }
        p1 = strtok(NULL, "|");
      }
      free(buf);
    }
    else if(type == "LocationHist") {
      _add_matching_loc_hist_XML_to_feature(node1, new_feature);
    }
    //else if(type == "GenomicInfo") { add_matching_genomic_info_XML_to_feature(new_feature, value); }  //no longer needed
    
    else if(!value.empty()) {
      mdset->add_metadata(type, value);
    }
    
    node1 = node1->next_sibling();
  }
  if(!desc.empty()) {
    //there should only be one description for a gene
    mdset->remove_metadata_like("description", "");
    //if($organism) { desc .= " [" . $organism . "]"; }
    mdset->add_metadata("description", desc);
  }
  //fprintf(stderr, "new_feature before update ====\n%s\n===========\n", new_feature->xml().c_str());
  
  new_feature = _dbcompare_update_newfeature(new_feature);
  //fprintf(stderr, "%s\n", new_feature->xml().c_str());
  return new_feature;
}



void  EEDB::JobQueue::UploadFile::_add_matching_loc_hist_XML_to_feature(rapidxml::xml_node<> *locXML, EEDB::Feature* feature) {
  //parsing the LocationHist/LocationHistType for matching assembly/chrom
  //#to get correct location
  //fprintf(stderr, "====== add_matching_loc_hist_XML_to_feature ======\n");
  if(!feature || !locXML || !_entrez_assembly) { return; }

  rapidxml::xml_node<>  *node1;
  rapidxml::xml_node<>  *locHistNode = locXML->first_node("LocationHistType");
  while(locHistNode) {
    string asmAccVer, chrAccVer;
    long   chrStart=-1, chrStop=-1;

    if((node1 = locHistNode->first_node("AssemblyAccVer"))) { asmAccVer = node1->value(); }
    if((node1 = locHistNode->first_node("ChrAccVer"))) { chrAccVer = node1->value(); }
    if((node1 = locHistNode->first_node("ChrStart"))) { chrStart = strtol(node1->value(),NULL, 10); }
    if((node1 = locHistNode->first_node("ChrStop"))) { chrStop = strtol(node1->value(),NULL, 10); }
    //fprintf(stderr, "asm[%s] chrAcc[[%s] start[%ld] stop[%ld]\n", chrAccVer.c_str(), chrAccVer.c_str(), chrStart, chrStop);
    
    //fprintf(stderr,"check asmAccVer assembly [%s]\n", _entrez_assembly->ncbi_assembly_acc());
    if(_entrez_assembly->ncbi_assembly_accession() == asmAccVer) {
      //fprintf(stderr, "^ ^ ^ found LocationHistType for requested assembly [%s]\n", _entrez_assembly->ncbi_assembly_accession().c_str());
      //EEDB::Chrom *chrom = EEDB::Chrom::fetch_by_assembly_ncbi_chrom_accession(_entrez_assembly, chrAccVer);
      EEDB::Chrom *chrom = _entrez_assembly->get_chrom(chrAccVer.c_str());
      if(chrom) {
        //fprintf(stderr, "  found matching ncbi_chrom_acc\n");
        feature->chrom(chrom);
        feature->chrom_start(chrStart);
        feature->chrom_end(chrStop);
      } else {
        //if($debug) { fprintf(stderr,"did not find a matching ncbi asembly [$chrAccVer] chrom[$chrAccVer] record\n"); }
        fprintf(stderr,"did not find chrom[%s]\n", chrAccVer.c_str());
      }
    }
    locHistNode = locHistNode->next_sibling("LocationHistType");
  }
  if(!feature->chrom()) {
    //fprintf(stderr, "WARN!! [%s] did not find a matching ncbi asembly/chrom record\n", feature->primary_name().c_str());
    return;
  }
  
  //post process
  feature->strand('+');
  string complement="";
  if(feature->chrom_start() > feature->chrom_end()) {
    //fprintf(stderr, "flip strand because start>end\n");
    long t1 = feature->chrom_start();
    feature->chrom_start(feature->chrom_end());
    feature->chrom_end(t1);
    feature->strand('-');
    complement = ", complement";
  }

  char buffer[2048];
  sprintf(buffer, "Chromosome %s, %s %s (%ld..%ld%s)",
          feature->chrom()->chrom_name().c_str(),
          _entrez_assembly->ncbi_assembly_accession().c_str(),
          feature->chrom()->ncbi_accession().c_str(),
          feature->chrom_start(),
          feature->chrom_end(),
          complement.c_str());
  feature->metadataset()->add_metadata("entrez_location", buffer);
  //fprintf(stderr,"%s\n", $full_loc);
  //fprintf(stderr, "%s\n====== END add_matching_loc_hist_XML_to_feature ======\n", feature->xml().c_str());
  return;
}


EEDB::Feature*  EEDB::JobQueue::UploadFile::_dbcompare_update_newfeature(EEDB::Feature* feature) {
  if(!feature) { return NULL; }
  if(!_entrez_source) { return feature; }

  MQDB::Database *db = _entrez_source->database();
  if(!db) { return feature; }

  //fprintf(stderr, "=== dbcompare_update_newfeature ==========\n");
  feature->metadataset()->remove_duplicates();

  bool changed=false;
  time_t tloc;
  time(&tloc);
  //fprintf(stderr, "%s\n", asctime(gmtime(&tloc)));

  EEDB::Metadata *entrezIDmd = feature->metadataset()->find_metadata("EntrezID", "");
  if(!entrezIDmd) { return feature; }
  long entrezID = strtol(entrezIDmd->data().c_str(), NULL, 10);
  if(entrezID == 0) { return feature; }
  
  vector<DBObject*> entrez_features = EEDB::Feature::fetch_all_by_source_symbol(_entrez_source, "EntrezID", entrezIDmd->data());
  if(entrez_features.empty()) {
    //not found so just store this
    feature->store(db);
    changed=true;
    fprintf(stderr, "[%9ld] NEW:: %20s : %40s : %s\n", entrezID, feature->primary_name().c_str(), feature->chrom_location().c_str(), feature->db_id().c_str());
    return feature;
  }
  EEDB::Feature *entrez_feature = (EEDB::Feature*)entrez_features[0];
  //fprintf(stderr,"=== old entrez feature before update check ===\n");
  //fprintf(stderr,"%s\n==========\n", entrez_feature->display_contents().c_str());
  //fprintf(stderr,"=== new NCBI feature ===\n");
  //fprintf(stderr,"%s\n==========\n", feature->display_contents().c_str());
  
  //
  // do the name checks
  //
  if(entrez_feature->primary_name() != feature->primary_name()) {
    fprintf(stderr,"[%9ld] NAME CHANGE:: %s => %s\n", entrezID, entrez_feature->primary_name().c_str(), feature->primary_name().c_str());
    changed=true;
    //change the old name in the symbol set (remove EntrezGene, add Entrez_synonym)
    vector<Metadata*> syms = entrez_feature->metadataset()->find_all_metadata_like("EntrezGene","");
    vector<Metadata*>::iterator it2;
    for(it2=syms.begin(); it2!=syms.end(); it2++) {
      if(feature->primary_name() != (*it2)->data()) {
        fprintf(stderr,"[%9ld] UNLINK MDATA:: %s\n", entrezID, (*it2)->display_contents().c_str());
        (*it2)->unlink_from_feature(entrez_feature);
      }
    }
    entrez_feature->metadataset()->add_metadata("Entrez_synonym", entrez_feature->primary_name());
    //then change primary_name.  additional metadata will happen below
    entrez_feature->primary_name(feature->primary_name());
  }
  
  //
  // do the location checks now
  //
  if(entrez_feature->chrom_location() != feature->chrom_location()) {
    if((entrez_feature->strand() == feature->strand()) and entrez_feature->overlaps(feature)) {
      //entrez_feature->check_overlap(feature))
      fprintf(stderr,"[%9ld] LOC WIGGLE::  %s => %s\n", entrezID,
             entrez_feature->display_desc().c_str(), feature->chrom_location().c_str());
      entrez_feature->chrom_start(feature->chrom_start());
      entrez_feature->chrom_end(feature->chrom_end());
      _entrez_locmove_count++;
      changed=true;
    } else if(!entrez_feature->chrom() or (entrez_feature->chrom_start() == -1)) {
      fprintf(stderr,"[%9ld] NEW LOC::  %s => %s\n", entrezID,
             entrez_feature->display_desc().c_str(), feature->chrom_location().c_str());
      entrez_feature->chrom(feature->chrom());
      entrez_feature->chrom_start(feature->chrom_start());
      entrez_feature->chrom_end(feature->chrom_end());
      entrez_feature->strand(feature->strand());
      _entrez_locmove_count++;
      changed=true;
    } else {
      char move_desc[2048];
      sprintf(move_desc, "%s [%ld] MAP BIG MOVE::  %s => %s", asctime(gmtime(&tloc)),
              entrezID, entrez_feature->chrom_location().c_str(), feature->chrom_location().c_str());
      fprintf(stderr,"%s :: %s\n", move_desc, entrez_feature->display_desc().c_str());
      entrez_feature->metadataset()->add_metadata("big_location_move", move_desc);
      
      entrez_feature->chrom(feature->chrom());
      entrez_feature->chrom_start(feature->chrom_start());
      entrez_feature->chrom_end(feature->chrom_end());
      entrez_feature->strand(feature->strand());
      _entrez_locmove_count++;
      changed=true;
    }
  }
  
  if(changed) { //primary_name or location has changed
    entrez_feature->update_location();
  }
  
  //
  // do the metadata check, merge in the new metadata into existing set
  //
  EEDB::MetadataSet *mdset = entrez_feature->metadataset();
  
  //special processing of description and entrez_location metadata since there should only be one of each
  EEDB::Metadata *mdata = feature->metadataset()->find_metadata("description", "");
  _feature_unique_metadata_by_type(entrez_feature, mdata);
  
  mdata = feature->metadataset()->find_metadata("entrez_location", "");
  _feature_unique_metadata_by_type(entrez_feature, mdata);

  //the rest can be standard procedure
  mdset->merge_metadataset(feature->metadataset());
  //fprintf(stderr,"=== after merge metadata ===\n%s\n==========\n", entrez_feature->display_contents().c_str());
  mdset->remove_duplicates();
  //fprintf(stderr,"=== after remove duplicates ===\n%s\n==========\n", entrez_feature->display_contents().c_str());
  
  vector<EEDB::Metadata*> mdlist = entrez_feature->metadataset()->metadata_list();
  vector<EEDB::Metadata*>::iterator it3;
  for(it3=mdlist.begin(); it3!=mdlist.end(); it3++) {
    EEDB::Metadata* mdata = (*it3);
    if(mdata->primary_id() <= 0) {
      // this is a newly loaded metadata so it needs storage and linking
      if(mdata->classname() == EEDB::Symbol::class_name) {
        EEDB::Symbol *sym = (EEDB::Symbol*)mdata;
        if(!sym->check_exists_db(db)) { sym->store(db); }
        sym->store_link_to_feature(entrez_feature);
      } else {
        if(!mdata->check_exists_db(db)) { mdata->store(db); }
        mdata->store_link_to_feature(entrez_feature);
      }
      changed=true;
      fprintf(stderr,"[%9ld] ADD MDATA:: %s -> %s\n", entrezID, entrez_feature->primary_name().c_str(), mdata->display_contents().c_str());
    }
  }
  //maybe I should also deprecate old metadata too.
  //the problem is that if any other source adds metadata to EntrezGene
  //then that data will be flushed here.
  //depends on how strict we want to be about "mirroring data" from unique providers

  if(changed) {
    //fprintf(stderr,"[%s] UPDATED::  %s\n", entrezID->data().c_str(), entrez_feature->display_desc().c_str());
    fprintf(stderr,"=== after UPDATE change ===\n");
    fprintf(stderr,"%s", entrez_feature->xml().c_str());
    fprintf(stderr,"===========================\n");
  } else {
    fprintf(stderr,"[%9ld] OK no update::  %s\n", entrezID, entrez_feature->display_desc().c_str());
  }
  
  feature->release();
  return entrez_feature;
}



void _feature_unique_metadata_by_type(EEDB::Feature *feature, EEDB::Metadata *new_mdata) {
  //This type of metadata is more like a dictionary, there should be only one of this type
  //but we want to keep a history of the previous values.  If the value changes (data!-data)
  //then move the old metadata to alt_<type> and add the new one as <type>
  if(!new_mdata || !feature) { return; }
  
  EEDB::MetadataSet *mdset    = feature->metadataset();
  EEDB::Metadata    *entrezID = mdset->find_metadata("EntrezID", "");
  string alt_type = "alt_" + new_mdata->type();
  
  vector<EEDB::Metadata*> old_mdata_array = mdset->find_all_metadata_like(new_mdata->type(), "");
  for(unsigned i2=0; i2<old_mdata_array.size(); i2++) {
    EEDB::Metadata *mdata = old_mdata_array[i2];
    if((mdata->type() == new_mdata->type()) and (mdata->data() != new_mdata->data())) {
      fprintf(stderr,"[%s] UNLINK OLD MDATA:: %s -> %s\n", entrezID->data().c_str(),
             feature->primary_name().c_str(),
             mdata->display_contents().c_str());
      mdset->add_metadata(alt_type, mdata->data());  //put the data back but with new alt type
      mdset->remove_metadata(mdata);
      mdata->unlink_from_feature(feature);
    }
  }
}


/*  --- OLD method, now uses the LocationHistType to match with correct assembly version
sub add_matching_genomic_info_XML_to_feature {
  //parsing the LocationHist/LocationHistType for matching assembly/chrom
  //to get correct location
  if($debug) { fprintf(stderr,"add_matching_genomic_info_XML_to_feature\n"); }
  my feature = shift;
  my $locXML = shift;
  return undef unless($locXML);
  
  my @locs_array;
  my $locs = $locXML->{"GenomicInfoType"};
  if($locs =~ /ARRAY/) { @locs_array = @$locs; }
  else { push @locs_array, $locs; }
  
  //fprintf(stderr,"has %ld LocationHistType entries\n", scalar(@locs_array));
  
  foreach my locHistNode (@locs_array) {
    //print("check_loc_history==\n");
    //<AnnotationRelease>105</AnnotationRelease>
    //<AssemblyAccVer>GCF_000001895.5</AssemblyAccVer>
    //<ChrAccVer>NC_005117.4</ChrAccVer>
    //<ChrStart>27657902</ChrStart>
    //<ChrStop>27660100</ChrStop>
    
    my $chrAccVer = locHistNode->{"ChrAccVer"};
    my $chrStart = locHistNode->{"ChrStart"};
    my $chrStop = locHistNode->{"ChrStop"};
    
    my $chrom = EEDB::Chrom->fetch_by_chrom_acc_assembly_id(entrezDB,$chrAccVer,_entrez_assembly->id);
    if($chrom) {
      if($debug) { fprintf(stderr,"found matching ncbi_chrom_acc [$chrAccVer]\n"); }
      feature->chrom($chrom);
      feature->chrom_start($chrStart);
      feature->chrom_end($chrStop);
    } else {
      if($debug) { fprintf(stderr,"did not find a matching ncbi chrom[$chrAccVer] record\n"); }
    }
  }
  if(!feature->chrom()) {
    //fprintf(stderr,"did not find a matching ncbi asembly/chrom record\n");
    return undef;
  }
  
  //post process
  feature->strand("+");
  my $complement="";
  if(feature->chrom_start > feature->chrom_end) {
    my $t = feature->chrom_start;
    feature->chrom_start(feature->chrom_end);
    feature->chrom_end($t);
    feature->strand("-");
    $complement = ", complement";
  }
  
  my $full_loc = sprintf("Chromosome %s, %s %s (%d..%d%s)",
                         feature->chrom()->chrom_name(),
                         _entrez_assembly->ncbi_assembly_acc(),
                         feature->chrom()->ncbi_chrom_acc(),
                         feature->chrom_start,
                         feature->chrom_end,
                         $complement);
  feature->metadataset->add_metadata("entrez_location", $full_loc);
  //fprintf(stderr,"%s\n", $full_loc);
  return feature;
}
*/


