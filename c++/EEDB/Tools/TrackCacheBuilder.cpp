/* $Id: TrackCacheBuilder.cpp,v 1.224 2019/07/31 06:59:15 severin Exp $ */

/***

NAME - EEDB::Tools::TrackCacheBuilder

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
#include <string>
#include <stdarg.h>
#include <sys/types.h>
#include <sys/time.h>
#include <sys/mman.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
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
#include <EEDB/TrackCache.h>
#include <EEDB/TrackRequest.h>
#include <EEDB/Configuration.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/Proxy.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/Tools/TrackCacheBuilder.h>
#include <EEDB/WebServices/RegionServer.h>

using namespace std;
using namespace MQDB;
 

///////////////////////////////////////////////////////////////////////////////
//
// TrackCacheBuilder
//
///////////////////////////////////////////////////////////////////////////////

const char* EEDB::Tools::TrackCacheBuilder::class_name = "EEDB::Tools::TrackCacheBuilder";
bool        EEDB::Tools::TrackCacheBuilder::building_segments = false;

void check_over_memory() {
  double vm_usage, resident_set;
  MQDB::process_mem_usage(vm_usage, resident_set);
  //fprintf(stderr, "process_mem_usage %1.3fMB res\n", resident_set/1024.0);
  if(resident_set > 4*1024*1024) { //4GB
    fprintf(stderr, "self destruct, using %f MB memory\n", resident_set/1024.0);
    throw(17);
  }
}


EEDB::Tools::TrackCacheBuilder::TrackCacheBuilder() {
  init();
}

EEDB::Tools::TrackCacheBuilder::~TrackCacheBuilder() {
}


void _eedb_tools_trackcachebuilder_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::TrackCacheBuilder*)obj;
}


void EEDB::Tools::TrackCacheBuilder::init() {
  EEDB::WebServices::RegionServer::init();
  _classname      = EEDB::Tools::TrackCacheBuilder::class_name;
  _funcptr_delete = _eedb_tools_trackcachebuilder_delete_func;
  
  _track_stream = NULL;
  _current_request = NULL;
}


bool EEDB::Tools::TrackCacheBuilder::parse_config_file(string path) {
  bool rtn = EEDB::WebServices::RegionServer::parse_config_file(path);
  init_service_request();
  return rtn;
}


bool  EEDB::Tools::TrackCacheBuilder::init_from_track_cache(string track_hashkey) {
  //fprintf(stderr, "init_from_track_cache [%s]\n", track_uuid.c_str());
  if(!_userDB) { return false; }
  
  _track_cache = EEDB::TrackCache::fetch_by_hashkey(_userDB, track_hashkey);
  if(!_track_cache) { return false; }
  
  EEDB::Metadata *md = _track_cache->metadataset()->find_metadata("configXML", "");
  if(!md) { return false; }
  store_new();
  
  bool rtn = init_from_track_configXML(md->data());
  //fprintf(stderr,"sources_ids=[%s]\n", _parameters["source_ids"].c_str());
  return rtn;
}


bool  EEDB::Tools::TrackCacheBuilder::init_from_track_configXML(string configXML) {
  //fprintf(stderr, "init_from_track_configXML : %s\n\n\n", configXML.c_str());
  
  if(configXML.empty()) { return false; }
  
  int   xml_len  = configXML.size();
  char* xml_text = (char*)malloc(xml_len+1);
  memset(xml_text, 0, xml_len+1);
  memcpy(xml_text, configXML.c_str(), xml_len);  
  //fprintf(stderr, "%s\n", xml_text);
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *node2, *root_node, *track_node;
  rapidxml::xml_attribute<> *attr;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(xml_text);
  
  root_node = doc.first_node();
  if(!root_node) { free(xml_text); return false; }
  
  string root_name = root_node->name();
  boost::algorithm::to_lower(root_name);
  if((root_name != string("eedbglyphstrackconfig")) &&
     (root_name != string("zconfigxml"))) { free(xml_text); return false; }
  
  //fprintf(stderr, "OK we have a track config\n");
  
  //some additional defaults
  _parameters["binning"]         = "sum";
  _parameters["overlap_mode"]    = "5end";
  
  if((track_node = root_node->first_node("gLyphTrack")) != NULL) { 
    if((node2 = track_node->first_node("source_ids"))) { 
      _parameters["source_ids"] = node2->value();
    }
    
    for(node2 = track_node->first_node("source"); node2; node2 = node2->next_sibling("source")) {
      if((attr = node2->first_attribute("id"))) {
        if(!_parameters["source_ids"].empty()) { _parameters["source_ids"] += ","; }
        _parameters["source_ids"] += attr->value();
      }
    }
    
    if((attr = track_node->first_attribute("title"))) { _parameters["track_title"] = attr->value(); }
    if((attr = track_node->first_attribute("track_title"))) { _parameters["track_title"] = attr->value(); }
    if((attr = track_node->first_attribute("format"))) { _parameters["format"] = attr->value(); }
    if((attr = track_node->first_attribute("format_mode"))) { _parameters["format_mode"] = attr->value(); }
    if((attr = track_node->first_attribute("glyphStyle"))) { _parameters["glyphStyle"] = attr->value(); }
    if((attr = track_node->first_attribute("uuid"))) { _parameters["track_uuid"] = attr->value(); }
    if((attr = track_node->first_attribute("track_uuid"))) { _parameters["track_uuid"] = attr->value(); }
    
    if((attr = track_node->first_attribute("scorecolor"))) { _parameters["scorecolor"] = attr->value(); }
    if((attr = track_node->first_attribute("backColor"))) { _parameters["backColor"] = attr->value(); }
    if((attr = track_node->first_attribute("hidezeroexps"))) { _parameters["hidezeroexps"] = attr->value(); }
    if((attr = track_node->first_attribute("exptype"))) { _parameters["exptype"] = attr->value(); }
    if((attr = track_node->first_attribute("datatype"))) { _parameters["datatype"] = attr->value(); }
    if((attr = track_node->first_attribute("hide"))) { _parameters["hide"] = attr->value(); }
    if((attr = track_node->first_attribute("nocache"))) { _parameters["nocache"] = attr->value(); }
    if((attr = track_node->first_attribute("mode"))) { _parameters["mode"] = attr->value(); }
    if((attr = track_node->first_attribute("submode"))) { _parameters["submode"] = attr->value(); }
    
    if((attr = track_node->first_attribute("peerName"))) { _parameters["peers"] = attr->value(); }
    if((attr = track_node->first_attribute("peers"))) { _parameters["peers"] = attr->value(); }
    if((attr = track_node->first_attribute("peer_names"))) { _parameters["peers"] = attr->value(); }
    
    if((attr = track_node->first_attribute("sources"))) { _parameters["sources"] = attr->value(); }
    if((attr = track_node->first_attribute("source_ids"))) { _parameters["source_ids"] = attr->value(); }
    if((attr = track_node->first_attribute("source_names"))) { _parameters["source_names"] = attr->value(); }
    if((attr = track_node->first_attribute("source_outmode"))) { _parameters["source_outmode"] = attr->value(); }
    
    if((attr = track_node->first_attribute("logscale"))) { _parameters["logscale"] = attr->value(); }
    if((attr = track_node->first_attribute("height"))) { _parameters["height"] = attr->value(); }
    if((attr = track_node->first_attribute("maxlevels"))) { _parameters["height"] = attr->value(); }
    if((attr = track_node->first_attribute("expscaling"))) { _parameters["expscaling"] = attr->value(); }
    if((attr = track_node->first_attribute("strandless"))) { _parameters["strandless"] = attr->value(); }
    if((attr = track_node->first_attribute("overlap_mode"))) { _parameters["overlap_mode"] = attr->value(); }
    if((attr = track_node->first_attribute("binning"))) { _parameters["binning"] = attr->value(); }
    if((attr = track_node->first_attribute("skip_default_expression_binning"))) { _parameters["skip_default_expression_binning"] = attr->value(); }
    
    if((attr = track_node->first_attribute("display_width"))) { _parameters["display_width"] = attr->value(); }
    if((attr = track_node->first_attribute("global_bin_size"))) { _parameters["global_bin_size"] = attr->value(); }
    if((attr = track_node->first_attribute("asm"))) { _parameters["assembly_name"] = attr->value(); }
    if((attr = track_node->first_attribute("assembly_name"))) { _parameters["assembly_name"] = attr->value(); }
    if((attr = track_node->first_attribute("chrom"))) { _parameters["chrom_name"] = attr->value(); }
    if((attr = track_node->first_attribute("chrom_name"))) { _parameters["chrom_name"] = attr->value(); }
    if((attr = track_node->first_attribute("loc"))) { _parameters["loc"] = attr->value(); }
    
    //config for _append_expression_histogram_binning paramters
    if((node2 = track_node->first_node("expression_binning"))) { 
      _parameters["expression_binning"] = "true";
      if((attr = node2->first_attribute("overlap_mode"))) { _parameters["overlap_mode"] = attr->value(); }
      if((attr = node2->first_attribute("binning"))) { _parameters["binning"] = attr->value(); }
      if((attr = node2->first_attribute("strandless"))) { _parameters["strandless"] = attr->value(); }
      if((attr = node2->first_attribute("binsize"))) { _parameters["bin_size"] = attr->value(); }
      if((attr = node2->first_attribute("bin_size"))) { _parameters["bin_size"] = attr->value(); }
      if((attr = node2->first_attribute("subfeatures"))) { _parameters["overlap_check_subfeatures"] = attr->value(); }
    }
    
    if((node = track_node->first_node("zenbu_script")) != NULL) { parse_processing_stream(node); }
  }
  
  if(_parameters.find("global_bin_size") != _parameters.end()) { 
    EEDB::WebServices::WebBase::global_parameters["global_bin_size"] = _parameters["global_bin_size"];
  }
  
  //if format and source_outmode are not set, parse glyphStyle logic
  string glyphStyle = _parameters["glyphStyle"];
  if(!glyphStyle.empty()) {
    if(_parameters.find("source_outmode")==_parameters.end()) {
      _parameters["source_outmode"]  = "simple_feature";
      //parse glyphStyle into source_outmode if not explicit
      if(glyphStyle=="express") { _parameters["source_outmode"] = "expression"; }
      
      if(glyphStyle=="transcript" || 
         glyphStyle=="probesetloc" || 
         glyphStyle=="thin-transcript" || 
         glyphStyle=="thick-transcript") { _parameters["source_outmode"] = "subfeature"; }
      
      if(glyphStyle=="singletrack" ||
         glyphStyle=="spectrum" ||
         glyphStyle=="experiment-heatmap" || 
         glyphStyle=="seqtag") { _parameters["source_outmode"] = "full_feature"; }
      
      if(_stream_processing_head != NULL) { _parameters["source_outmode"] = "full_feature"; }
    }
    
    if(_parameters.find("format")==_parameters.end()) {
      _parameters["format"] = "fullxml";
      
      if(glyphStyle=="centroid" ||
         glyphStyle=="thick-arrow" ||
         glyphStyle=="medium-arrow" ||
         glyphStyle=="box" ||
         glyphStyle=="arrow" ||
         glyphStyle=="line" ||
         glyphStyle=="exon" ||
         glyphStyle=="medium-exon" ||
         glyphStyle=="thin-exon" ||
         glyphStyle=="utr" ||
         glyphStyle=="thin" ||
         glyphStyle=="cytoband") { _parameters["format"] = "xml"; }
    }
  }
  
  free(xml_text);    

  //
  // post process parameters, maybe do not need anymore, but for now copy/paste and edit later
  //
  postprocess_parameters();

  return true;
}
  

void  EEDB::Tools::TrackCacheBuilder::postprocess_parameters() {
  //call super-superclass method (not regionserver)
  EEDB::WebServices::MetaSearch::postprocess_parameters();
  
  //first convert aliased paramter names to official internal name
  if(_parameters.find("datatype") != _parameters.end())     { _parameters["exptype"] = _parameters["datatype"]; }
  if(_parameters.find("segment") != _parameters.end())      { _parameters["loc"] = _parameters["segment"]; }
  if(_parameters.find("chrom") != _parameters.end())        { _parameters["chrom_name"] = _parameters["chrom"]; }
  if(_parameters.find("window_width") != _parameters.end()) { _parameters["display_width"] = _parameters["window_width"]; }


  //set defaults if they were not defined
  if(_parameters.find("binning") == _parameters.end())        { _parameters["binning"] = "sum"; }
  if(_parameters.find("mode") == _parameters.end())           { _parameters["mode"] = "region"; }
  if(_parameters.find("overlap_mode") == _parameters.end())   { _parameters["overlap_mode"] = "area"; }
  if(_parameters.find("format") == _parameters.end())         { _parameters["format"] = "xml"; }

  if(_parameters.find("assembly_name") == _parameters.end()) {
    if(!_default_genome.empty()) { _parameters["assembly_name"] = _default_genome; }
  }

  EEDB::WebServices::MetaSearch::postprocess_parameters();

  if(_parameters["format"] == "wig") { _parameters["mode"] = "express"; }
  if(_parameters.find("assembly_name") == _parameters.end()) { _parameters["assembly_name"] = "hg18"; }

  if(_parameters.find("display_width") != _parameters.end()) { 
    _display_width = strtol(_parameters["display_width"].c_str(), NULL, 10);
  }
  if(_display_width < 200) { _display_width = 200; }

  size_t   p1;
  if((p1 = _parameters["mode"].find("express_")) != string::npos) {
    string tstr = _parameters["mode"].substr(p1+8);
    _parameters["overlap_mode"] = tstr;
    _parameters["mode"] = "express";
  }

  if(_parameters.find("loc") != _parameters.end()) {
    _parameters["chrom_name"] = _parameters["loc"];
    if((p1 = _parameters["loc"].find(":")) != string::npos) {
      _parameters["chrom_name"] = _parameters["loc"].substr(0,p1);
      string tstr = _parameters["loc"].substr(p1+1);
      if((p1 = tstr.find("..")) != string::npos) {
        _parameters["chrom_start"] = tstr.substr(0,p1);
        _parameters["chrom_end"]   = tstr.substr(p1+2);
      }
    }
  }

  if(_parameters.find("chrom_start") != _parameters.end()) { 
    _region_start = strtol(_parameters["chrom_start"].c_str(), NULL, 10);
  }
  if(_parameters.find("chrom_end") != _parameters.end()) { 
    _region_end = strtol(_parameters["chrom_end"].c_str(), NULL, 10);
  }
  
  //if source_outmode was not set in query then apply old default behaviours
  if(_parameters["source_outmode"].empty()) { 
    _parameters["source_outmode"] = "simple_feature"; 
    if(_parameters["mode"] == "express") { _parameters["source_outmode"] = "expression"; }
    if(_parameters["submode"] == "expression") { _parameters["source_outmode"] = "expression"; }
    if(_parameters["source_outmode"] != "expression") {
      if(_parameters["submode"] == "subfeature")   { _parameters["source_outmode"] = "subfeature"; }
      if(_parameters["submode"] == "full_feature") { _parameters["source_outmode"] = "feature"; }
    }
  }

  if(_parameters.find("script_source_outmode") != _parameters.end()) {
    _parameters["source_outmode"] = _parameters["script_source_outmode"];
  }

  if(_parameters.find("skip_default_expression_binning")!=_parameters.end()) { 
    _parameters["expression_binning"] = "false";
  }  
  
  //set some of the global parameters
  if(_parameters.find("display_width") != _parameters.end()) { 
    EEDB::WebServices::WebBase::global_parameters["display_width"] = _parameters["display_width"];
  }
  
  if(EEDB::WebServices::WebBase::global_parameters.find("global_bin_size") == EEDB::WebServices::WebBase::global_parameters.end()) { 
    if(_parameters.find("bin_size") != _parameters.end()) { 
      EEDB::WebServices::WebBase::global_parameters["global_bin_size"] = _parameters["bin_size"];
    }
  }
}



//----------------------------------------------------
//
// autobuild background system
//


EEDB::TrackCache*  EEDB::Tools::TrackCacheBuilder::track_cache() {
  if(!_track_cache) { return NULL; }

  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return NULL; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!zdxdb) { return NULL; }

  _build_trackcache_chroms();

  return _track_cache;
}  


bool  EEDB::Tools::TrackCacheBuilder::build_trackcache_sources() { 
  if(!track_cache()) { return false; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }
  
  
  // test if we need to store sources
  //
  zdxstream->stream_data_sources();  //forces a reload if needed
  
  //fprintf(stderr, "TrackCacheBuilder::build_trackcache_sources\n");
  bool  missing_sources=false;
  
  //use a special stream with scripting
  EEDB::SPStream *stream = trackbuilder_stream();

  //first stream the sources with the script and cache
  stream->stream_data_sources();
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
  }

  //get dependent datasource ids
  map<string, bool> dep_ids;
  stream->get_dependent_datasource_ids(dep_ids);
  fprintf(stderr, "TrackCacheBuilder::build_trackcache_sources -- %ld dependent sources\n", dep_ids.size());
  EEDB::SPStreams::FederatedSourceStream  *fstream = _superuser_federated_source_stream();
  fstream->clone_peers_on_build(false);
  map<string, bool>::iterator it1;
  for(it1=dep_ids.begin(); it1!=dep_ids.end(); it1++) {
    fstream->add_source_id_filter((*it1).first);
    //fprintf(stderr, "dependent %s\n", (*it1).first.c_str());
  }
  
  fstream->stream_data_sources();
  while(EEDB::DataSource *source = (EEDB::DataSource*)fstream->next_in_stream()) {
    if(source->db_id().empty()) {
      if(source->classname() == EEDB::FeatureSource::class_name) { 
        EEDB::FeatureSource *fsrc = (EEDB::FeatureSource*)source;
        string dbid = fsrc->name() + "_" + fsrc->category();
        source->db_id(dbid);
      }
    }
    EEDB::DataSource::add_to_sources_cache(source);
    
    if(zdxstream->get_datasource(source->db_id()) == NULL) {
      fprintf(stderr, "missing source %s", source->simple_xml().c_str()); 
      missing_sources = true;
      zdxstream->add_datasource(source);
      
      string uuid = source->peer_uuid();
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { zdxstream->add_peer(peer); }
    }
  }
  if(missing_sources) {
    zdxstream->write_source_section();
    fprintf(stderr, "write missing sources\n");
  }
  fstream->release();

  return true;  
}


bool  EEDB::Tools::TrackCacheBuilder::autobuild_track_cache() {
  //find an unbuilt segment and build it up to the max runtime (eHive-like)
  struct timeval      starttime,buildstart,endtime,difftime;

  gettimeofday(&starttime, NULL);  
  gettimeofday(&buildstart, NULL);  
  
  if(_parameters.find("assembly_name") == _parameters.end()) { return false; }
  
  if(!track_cache()) { return false; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  
  //fprintf(stderr, "autobuild trackcache [%s] asm=%s\n", _track_cache->track_hashkey().c_str(), _parameters["assembly_name"].c_str());
  _build_trackcache_chroms();
  zdxstream->reload_stream_data_sources();   // make sure sources are loaded
    
  int max_build_time=300; //seconds
  if(_parameters.find("max_track_build_seconds") != _parameters.end()) {
    max_build_time = strtol(_parameters["max_track_build_seconds"].c_str(), NULL, 10);
    srand(time(NULL));
    double wiggle = floor(0.5 + (max_build_time * ((double)rand() / (double)RAND_MAX)));
    max_build_time = max_build_time/2 + (long)wiggle;
    if(max_build_time<=0) { max_build_time = 300; }
  }
  long total=0;
  long seg_count=0;  
    
  string   assembly_name = _parameters["assembly_name"];
  string   chrom_name    = _parameters["chrom_name"];
  if(_parameters.find("reqid") != _parameters.end()) {
    long reqid = strtol(_parameters["reqid"].c_str(), NULL, 10);
    _current_request = EEDB::TrackRequest::fetch_by_id(_userDB, reqid);
    if(_current_request) { fprintf(stderr, "fetch specific request %s\n", _current_request->xml().c_str()); }
  }
  else if(!chrom_name.empty()) {
    fprintf(stderr, "autobuild_track_cache with specific region [%s %ld .. %ld]\n", chrom_name.c_str(), _region_start, _region_end);
    _current_request = new EEDB::TrackRequest();
    _current_request->assembly_name(assembly_name);
    _current_request->chrom_name(chrom_name); 
    _current_request->chrom_start(_region_start);
    _current_request->chrom_end(_region_end);    
  } else {
    _track_cache->update_buildstats(0, 0.0);
    _current_request = EEDB::TrackRequest::fetch_best(_track_cache);
    if(_current_request) { 
      fprintf(stderr, "changing to request %s\n", _current_request->xml().c_str());
    }    
  }
  if(!_current_request) { fprintf(stderr, "no pending requests for [%s]\n", _track_cache->track_hashkey().c_str()); }    
  
  bool is_remote=false;
  if(!_track_cache->remote_server_url().empty()) { is_remote=true; }

  EEDB::ZDX::ZDXsegment *zseg = _request_build_segment();  
  while(zseg) {
    zseg->zdxstream(zdxstream);
            
    if(is_remote) {
      _track_cache->remote_sync_segment(zseg, NULL);
    } else {
      total += _build_zdxsegment(zseg);
    }
    seg_count++;
    zseg->release();
    
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    if(difftime.tv_sec >  max_build_time) { break; }
    
    timersub(&endtime, &buildstart, &difftime);
    double buildtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
   
    if(buildtime > 30.0) {
      //if its been going for more than 30 seconds, update buildstats and
      //make sure the current request is still the best one
      update_work_done(seg_count);
      _track_cache->update_buildstats(seg_count, buildtime);
      gettimeofday(&buildstart, NULL);
      seg_count=0;
      
      if(chrom_name.empty()) {
        EEDB::TrackRequest* request = EEDB::TrackRequest::fetch_best(_track_cache);
        if(request) {
          if(request->chrom_start()!=-1) {
            fprintf(stderr, "changing to request %s\n", request->xml().c_str());
            if(_current_request) { _current_request->release(); }
            _current_request = request;
          } else {
            request->release();
          }
        }
      }
    }
      
    zseg = _request_build_segment();
  }
    
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "built %ld objs in %1.6f sec\n", total, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  
  //update build stats
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &buildstart, &difftime);
  double buildtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
  _track_cache->update_buildstats(seg_count, buildtime);
  update_work_done(seg_count);

  ZDXdb* zdxdb = zdxstream->zdxdb();  
  double percent_complete = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, false);
  
  if(percent_complete == 1.0) {
    update_finished("NO_WORK");
  } else {
    update_finished("JOB_LIMIT");
  }

  return true;  
}



EEDB::ZDX::ZDXsegment*  EEDB::Tools::TrackCacheBuilder::_request_build_segment() {
  //smart method which finds an unbuilt segment region
  //fprintf(stderr, "request_build_segment\n");

  if(!_track_cache) { return NULL; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return NULL; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  
  EEDB::ZDX::ZDXsegment *zseg = NULL;

  //if no _current_request and not remote then we are doing a random background build
  /*
  if(!_current_request && _track_cache->remote_server_url().empty()) {
    zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, "", "", 1, -1);
    while(zseg) {
      if(zseg->claim_segment()) { return zseg; } //GOT ONE
      zseg->release();
      zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, "", "", 1, -1);
    }
  }
  */
  
  //see if we can just work within the current request
  long fail_count=0;
  while(_current_request) {    
    zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, _current_request->assembly_name(), _current_request->chrom_name(), 
                                                  _current_request->chrom_start(), _current_request->chrom_end());
    if(!zseg) {
      //no unbuilt segments in this request region
      _current_request->release();
      _current_request = NULL;
      if(_parameters["chrom_name"].empty()) {
        _track_cache->update_buildstats(0, 0.0);
        _current_request = EEDB::TrackRequest::fetch_best(_track_cache);
        if(_current_request) { 
          fprintf(stderr, "changing to request %s\n", _current_request->xml().c_str());
        }
      }
    }
    if(zseg) {
      //fprintf(stderr, "try to claim %s\n", zseg->xml().c_str());
      if(zseg->claim_segment()) { 
        //fprintf(stderr, "OK got claim\n");
        //if(_current_request) { fprintf(stderr, "%s\n", _current_request->xml().c_str()); }
        //fprintf(stderr, "%s\n", zseg->xml().c_str());
        return zseg; 
      } else {
        //TODO if this happens we can enter an infinite loop, need to fix this
        //sometimes this a race condition, sometimes an infinite loop.
        //need to be smarter to see if we keep grabbing same segment
        fail_count++;
        if(fail_count>10) {
          fprintf(stderr, "FAILURE: failed to claim 10 'unclaimed seg', need to fail out completely\n");
          _current_request->release();
          _current_request = NULL;
          zseg->release();
          return NULL;
        }
      }
      zseg->release();
    }
  }

  //working from a specific region request via parameters
  if(!_parameters["chrom_name"].empty()) { return NULL; }

  /*
  //no more requests so loop back around to the start of the chromosome;  
  zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, "", "", 1, -1);
  while(zseg) {
    if(zseg->claim_segment()) { return zseg; } //GOT ONE
    zseg->release();
    zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, "", "", 1, -1);
  }
   */
  return NULL;    
}


long  EEDB::Tools::TrackCacheBuilder::_build_zdxsegment(EEDB::ZDX::ZDXsegment* zseg) {
  if(!zseg) { return 0; }
  //fprintf(stderr, "\n_build_zdxsegment [%s] %s\n", _track_cache->track_hashkey().c_str(), zseg->xml().c_str());
    
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  map<string, EEDB::DataSource*>  stream_sources; //sources appearing on the stream
  
  // special super user stream for background track building
  EEDB::SPStream* stream = trackbuilder_stream();
  check_over_memory();
  
  long count=0;
  long zseg_end = zseg->chrom_start()+zseg->segment_size()-1;
  if(!stream->stream_by_named_region(zseg->assembly_name(), zseg->chrom_name(), zseg->chrom_start(), zseg_end)) {
    fprintf(stderr, "failed to initialize streaming %s %s\n", _track_cache->track_hashkey().c_str(), zseg->xml().c_str());
    zseg->clear_claim();
    throw(17);
  }
  check_over_memory();

  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
    EEDB::Feature *feature= (EEDB::Feature*)obj; 
    if(feature->chrom_start() < zseg->chrom_start()) {
      //extend_chrom_end on previous segment
      EEDB::ZDX::ZDXsegment* t_zseg = EEDB::ZDX::ZDXsegment::fetch(zseg->zdxdb(), zseg->assembly_name(), 
                                                                   zseg->chrom_name(), feature->chrom_start());
      if(t_zseg) {
        if(!t_zseg->is_built()) {
          t_zseg->extend_chrom_end(feature->chrom_end());
          //fprintf(stderr, "extend previous %s %s\n", t_zseg->xml().c_str(), feature->simple_xml().c_str());
        }
        t_zseg->release();
      }
      obj->release();
      continue;
    }
    if(feature->chrom_start() > zseg_end) {
      obj->release(); 
      break; //done
    }
    count++;
    if(count%1000 == 0) { check_over_memory(); }

    feature->chrom(zseg->chrom());
    
    EEDB::FeatureSource *fsrc = feature->feature_source();
    if(fsrc) {
      if(fsrc->db_id().empty()) {
        string dbid = fsrc->name() + "_" + fsrc->category();
        fsrc->db_id(dbid);
      }
      if(stream_sources.find(fsrc->db_id()) == stream_sources.end()) {
        fsrc->retain();
        stream_sources[fsrc->db_id()] = fsrc;
      }
    }
    
    vector<EEDB::Feature*> subfeatures = feature->subfeatures();
    for(unsigned int i=0; i<subfeatures.size(); i++) { 
      EEDB::Feature *subfeat = subfeatures[i];
      fsrc = subfeat->feature_source();
      if(!fsrc) { continue; }
      if(fsrc->db_id().empty()) { 
        string dbid = fsrc->name() + "_" + fsrc->category();
        fsrc->db_id(dbid);
      }
      if(stream_sources.find(fsrc->db_id()) == stream_sources.end()) {
        fsrc->retain();
        stream_sources[fsrc->db_id()] = fsrc;
      }
    }
    
    //fprintf(stderr, "%s\n", feature->simple_xml().c_str());
    //fprintf(stderr, "%s\n", feature->xml().c_str());
    zseg->add_sorted_feature(feature);
    
    //if(count % 100 == 0) {
    //  gettimeofday(&endtime, NULL);
    //  timersub(&endtime, &starttime, &difftime);
    //  double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
    //  fprintf(stderr, "%10ld features  %1.6f obj/sec\n", count, rate);
    //}
    
    obj->release();
  }
  zseg->write_segment_features(); //flush remaining features

  //check for missing sources
  bool  missing_sources=false;
  map<string, EEDB::DataSource*>::iterator it2;
  for(it2=stream_sources.begin(); it2!=stream_sources.end(); it2++) {
    EEDB::DataSource *source = (*it2).second;
    if(zseg->zdxstream()->get_datasource((*it2).first) == NULL) {
      //fprintf(stderr, "missing source %s", source->simple_xml().c_str()); 
      missing_sources = true;
      zseg->zdxstream()->add_datasource(source);
      if(source->peer_uuid()) {
        string uuid = source->peer_uuid();
        EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
        if(peer) { zseg->zdxstream()->add_peer(peer); }
      }
    }
    if(missing_sources) {
      zseg->zdxstream()->write_source_section();
      //fprintf(stderr, "write missing sources\n");
    }
  }

  MQDB::DBCache::clear_cache();
  
  stream->stream_clear();
  //disconnect();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "_build_zdxsegment %ld objs in %1.6f sec %s %s\n", count, 
          (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0, 
          _track_cache->track_hashkey().c_str(),
          zseg->xml().c_str());
  //fprintf(stderr, "%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  
  return count;
}


/////////////////////////////////////////////////////////////



bool  EEDB::Tools::TrackCacheBuilder::testbuild_region() {
  //perform a fake build on trackcache for specific region without claiming or writing
  struct timeval      starttime,buildstart,endtime,difftime;
  
  gettimeofday(&starttime, NULL);  
  gettimeofday(&buildstart, NULL);  
  
  if(_parameters.find("assembly_name") == _parameters.end()) { 
    fprintf(stderr, "no assembly specified\n");
    return false; 
  }
  if(_parameters.find("chrom_name") == _parameters.end()) { 
    fprintf(stderr, "no chrom_name specified\n");
    return false; 
  }
  if(_parameters.find("chrom_start") == _parameters.end()) { 
    fprintf(stderr, "no chrom_start specified\n");
    return false; 
  }
  if(_parameters.find("chrom_end") == _parameters.end()) { 
    fprintf(stderr, "no chrom_end specified\n");
    return false; 
  }
  if(!track_cache()) { return false; }
  
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  
  string   assembly_name = _parameters["assembly_name"];
  string   chrom_name    = _parameters["chrom_name"];
  long     chrom_start   = strtol(_parameters["chrom_start"].c_str(), NULL, 10);
  long     chrom_end     = strtol(_parameters["chrom_end"].c_str(), NULL, 10);
  
  fprintf(stderr, "trackcache [%s] loc=%s %s %ld %ld\n", 
          _track_cache->track_hashkey().c_str(), 
          assembly_name.c_str(), chrom_name.c_str(), chrom_start, chrom_end);
  
  _build_trackcache_chroms();
  zdxstream->reload_stream_data_sources();   // make sure sources are loaded
  
  //
  //-- fake build of region/segment
  //
  map<string, EEDB::DataSource*>  stream_sources; //sources appearing on the stream
  
  // special super user stream for background track building
  EEDB::SPStream* stream = trackbuilder_stream();
  check_over_memory();
  
  long count=0;  
  long prestart_count = 0;
  
  stream->stream_by_named_region(assembly_name, chrom_name, chrom_start, chrom_end);
  check_over_memory();
  
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
    EEDB::Feature *feature= (EEDB::Feature*)obj; 
    if(feature->chrom_start() < chrom_start) {
      prestart_count++;
      obj->release(); 
      continue;
    }
    if(feature->chrom_start() > chrom_end) {
      obj->release(); 
      fprintf(stderr, "hit feature past region end\n");
      break; //done
    }
    count++;
    if(count%1000 == 0) { check_over_memory(); }
    
    //feature->chrom(zseg->chrom());
    
    EEDB::FeatureSource *fsrc = feature->feature_source();
    if(fsrc) {
      if(fsrc->db_id().empty()) {
        string dbid = fsrc->name() + "_" + fsrc->category();
        fsrc->db_id(dbid);
      }
      if(stream_sources.find(fsrc->db_id()) == stream_sources.end()) {
        fsrc->retain();
        stream_sources[fsrc->db_id()] = fsrc;
      }
    }
    
    vector<EEDB::Feature*> subfeatures = feature->subfeatures();
    for(unsigned int i=0; i<subfeatures.size(); i++) { 
      EEDB::Feature *subfeat = subfeatures[i];
      fsrc = subfeat->feature_source();
      if(!fsrc) { continue; }
      if(fsrc->db_id().empty()) { 
        string dbid = fsrc->name() + "_" + fsrc->category();
        fsrc->db_id(dbid);
      }
      if(stream_sources.find(fsrc->db_id()) == stream_sources.end()) {
        fsrc->retain();
        stream_sources[fsrc->db_id()] = fsrc;
      }
    }
    
    //fprintf(stderr, "%s\n", feature->simple_xml().c_str());
    
    //if(count % 100 == 0) {
    //  gettimeofday(&endtime, NULL);
    //  timersub(&endtime, &starttime, &difftime);
    //  double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
    //  fprintf(stderr, "%10ld features  %1.6f obj/sec\n", count, rate);
    //}
    
    obj->release();
  }
  MQDB::DBCache::clear_cache();
  
  stream->stream_clear();
  //disconnect();
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "_build_zdxsegment %ld objs in %1.6f sec %s\n", count, 
          (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0, 
          _track_cache->track_hashkey().c_str());
  //fprintf(stderr, "%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  
  //
  //-- done with fake segment region
  //
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "built %ld objs in %1.6f sec\n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
    
  return true;  
}


/**************************************************************************
 *
 * super user streams access all data from all users
 *
 **************************************************************************/

EEDB::SPStreams::FederatedSourceStream*  EEDB::Tools::TrackCacheBuilder::_superuser_federated_source_stream() {  
  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *fstream;
  
  fstream = new EEDB::SPStreams::FederatedSourceStream();
  fstream->set_peer_search_depth(_peer_search_depth);
  fstream->allow_full_federation_search(false);
  fstream->clone_peers_on_build(false);

  //seeds
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    fstream->add_seed_peer((*it));
  }
  
  if(_public_collaboration) {
    fstream->add_seed_peer(_public_collaboration->group_registry());
  }
  if(_curated_collaboration) {
    fstream->add_seed_peer(_curated_collaboration->group_registry());
  }
  
  //all user registries
  vector<DBObject*> all_users = EEDB::User::fetch_all(_userDB);
  for(unsigned i=0; i<all_users.size(); i++) {
    EEDB::User* user = (EEDB::User*)all_users[i];
    if(user->user_registry()) {
      fstream->add_seed_peer(user->user_registry());
    }
  }

  //all collaboration registries
  vector<DBObject*> all_collabs = EEDB::Collaboration::fetch_all(_userDB);
  for(unsigned i=0; i<all_collabs.size(); i++) {
    EEDB::Collaboration* collab = (EEDB::Collaboration*)all_collabs[i];
    if(collab->group_registry()) {
      fstream->add_seed_peer(collab->group_registry());
    }
  }
  
  return fstream;
}


EEDB::SPStream*  EEDB::Tools::TrackCacheBuilder::trackbuilder_stream() {  
  //special 'superuser' stream which can access all uploaded data from all users
  if(_track_stream) { return _track_stream; }

  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *fstream;
  EEDB::SPStream                          *stream;
    
  //first check the processing script for proxies and replace with FederatedSourceStreams
  _trackbuilder_setup_proxy_streams();

  fstream = _superuser_federated_source_stream();
  fstream->clone_peers_on_build(false);
  fstream->set_sourcestream_output(_parameters["source_outmode"]);
    
  // setup filters
  if(!_filter_peer_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_peer_ids.begin(); it2 != _filter_peer_ids.end(); it2++) {
      fstream->add_peer_id_filter((*it2).first);
    }
  }
  if(!_filter_source_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
      fstream->add_source_id_filter((*it2).first);
    }
  }
  if(!_filter_source_names.empty()) {
    map<string, bool>::iterator  it2;
    for(unsigned int i=0; i<_filter_source_names.size(); i++) {
      fstream->add_source_name_filter(_filter_source_names[i]);
    }
  }
  if(!_filter_ids_array.empty()) {
    vector<string>::iterator  it;
    for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
      fstream->add_object_id_filter(*it);
    }
  }
      
  if(_parameters.find("exptype") != _parameters.end()) {
    fstream->add_expression_datatype_filter(EEDB::Datatype::get_type(_parameters["exptype"]));
  }
  
  //do outmode here (no API currently for this, need to add API into FederatedSourceStream,...)
  //  maybe need to reorgnize. currently only used by OSCFileParser but need to migrate up
  //  t_outputmode outputmode
  
  stream  = fstream;
  
  //append the scripting last
  if(_stream_processing_head != NULL) {
    _cachepoint_setup_processing_stream(_stream_processing_head);

    _stream_processing_tail->source_stream(stream);
    stream = _stream_processing_head;
  }
  
  if(_parameters["expression_binning"] == "true") { 
    stream = _append_expression_histogram_binning(stream);
  }
  
  _track_stream = stream;
  return stream;
}


void  EEDB::Tools::TrackCacheBuilder::_trackbuilder_setup_proxy_streams() {
  if((_stream_processing_head == NULL) || (_stream_processing_tail == NULL)) { return; }
  if(_processing_datastreams.empty()) { return; }
  
  map<string, EEDB::TrackDef*>::iterator   datasrc;
  for(datasrc=_processing_datastreams.begin(); datasrc!=_processing_datastreams.end(); datasrc++) {
    EEDB::TrackDef*   track = (*datasrc).second;
    
    //next get proxies in the processing stream and replace them
    vector<EEDB::SPStream*>            proxies;
    vector<EEDB::SPStream*>::iterator  it1;
    _stream_processing_head->get_proxies_by_name(track->name, proxies);
    
    for(it1=proxies.begin(); it1!=proxies.end(); it1++) {
      EEDB::SPStreams::Proxy  *proxy = (EEDB::SPStreams::Proxy*)(*it1);
      
      if(proxy->proxy_stream() == NULL) {
        EEDB::SPStreams::FederatedSourceStream *fstream = _superuser_federated_source_stream();
        fstream->clone_peers_on_build(true);
        
        map<string, bool>::iterator it2;
        for(it2 = track->source_ids.begin(); it2 != track->source_ids.end(); it2++) {
          fstream->add_source_id_filter((*it2).first);
        }
        
        if(!track->source_outmode.empty()) { 
          fstream->set_sourcestream_output(track->source_outmode);
        }
        if(!track->expression_datatype.empty()) { 
          fstream->add_expression_datatype_filter(EEDB::Datatype::get_type(track->expression_datatype));
        }
        
        proxy->proxy_stream(fstream);
      }
    }
  }
}


bool  EEDB::Tools::TrackCacheBuilder::_access_check() {
  map<string, bool>            source_hash;
  map<string, bool>::iterator  src_it;

  //get ids from both _filter_source_ids and _filter_ids_array for checking
  if(!_filter_ids_array.empty()) {
    vector<string>::iterator  it;
    for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
      source_hash[(*it)] = false;
    }
  }
  if(!_filter_source_ids.empty()) {
    map<string, bool>::iterator  it;
    for(it = _filter_source_ids.begin(); it != _filter_source_ids.end(); it++) {
      source_hash[(*it).first] = false;
    }
  }
  //get sources from scripted <datastream>
  if(!_processing_datastreams.empty()) {
    map<string, EEDB::TrackDef*>::iterator  it1;
    for(it1=_processing_datastreams.begin(); it1!=_processing_datastreams.end(); it1++) {
      EEDB::TrackDef*   track = (*it1).second;
      
      map<string, bool>::iterator it2;
      for(it2 = track->source_ids.begin(); it2 != track->source_ids.end(); it2++) {
        source_hash[(*it2).first] = false;
      }    
    }
  }
  if(source_hash.empty()) { return false; }

  //
  // make sure all the sources are really available via streaming
  //
  EEDB::SPStreams::FederatedSourceStream *fstream = _superuser_federated_source_stream();
  fstream->clone_peers_on_build(false);
  fstream->allow_full_federation_search(false);
  
  bool failed = false;
  for(src_it = source_hash.begin(); src_it != source_hash.end(); src_it++) {
    fstream->add_source_id_filter((*src_it).first);
    //fprintf(stderr, "security check [%s]\n", (*src_it).first.c_str());
  }
  
  fstream->stream_data_sources();
  while(MQDB::DBObject *source = fstream->next_in_stream()) {
    if(!source) { continue; }
    //fprintf(stderr, "%s\n", source->simple_xml().c_str());
    src_it = source_hash.find(source->db_id());
    if(src_it != source_hash.end()) {
      (*src_it).second = true;
    }
  }
  
  for(src_it = source_hash.begin(); src_it != source_hash.end(); src_it++) {
    if(!(*src_it).second) { 
      fprintf(stderr, "TrackCacheBuilder::_access_check failed [%s]\n", (*src_it).first.c_str());
      failed = true;
    }
  }
  if(failed) { return false; }
  return true;
}


bool  EEDB::Tools::TrackCacheBuilder::security_check() {
  if(_access_check()) { return true; }

  fprintf(stderr, "TrackCacheBuilder::security_check failed\n");
  track_cache()->update_broken(true);
  return false;

  //for not this is dangerous, it appears sometimes a "false" security error
  //arises from things like disk errors, nfs, or too many open file handles
  //
  // 'fill in' all the track cache segments with empty znodes
  //
  /*
  if(!_track_cache) { return false; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!zdxdb) { return false; }
  
  vector<EEDB::Chrom*>           chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    EEDB::Chrom *chrom = (*chr_it);
    
    EEDB::ZDX::ZDXsegment* zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, chrom->assembly_name(), chrom->chrom_name(), -1);
    while(zseg) {
      if(zseg->claim_segment()) {
        zseg->write_segment_features(); //since nothing added it will write an empty znode
      }     
      
      EEDB::ZDX::ZDXsegment* seg = zseg->next_segment();
      zseg->release();
      zseg = seg;
    }
  }
  */
  return false;
}


/**************************************************************************
 *
 * database methods to log builders (added in v2.8.2) 
 *
 **************************************************************************/


bool EEDB::Tools::TrackCacheBuilder::store_new() {
  if(!_userDB) { return false; }
  if(!_track_cache) { return false; }
  
  char host[1024];
  bzero(host, 1024);
  gethostname(host, 1024);  
  pid_t pid = getpid();

  _userDB->do_sql("INSERT INTO track_builder (track_cache_id, host, process_id, born, last_check_in) VALUES(?,?,?,NOW(),NOW())", 
                  "dsd", _track_cache->primary_id(), host, pid);
  if(_userDB->last_insert_id() < 0) { return false; }
  
  _primary_db_id = _userDB->last_insert_id();
  return true;
}


bool  EEDB::Tools::TrackCacheBuilder::update_work_done(int increment_count) {
  if(!_userDB) { return false; }
  if(_primary_db_id == -1) { return false; }
  
  _userDB->do_sql("UPDATE track_builder set work_done=work_done+?, last_check_in=NOW() WHERE track_builder_id=?", 
                  "dd", increment_count, _primary_db_id);
  return true;
}


bool  EEDB::Tools::TrackCacheBuilder::update_finished(string status) {
  if(!_userDB) { return false; }
  if(_primary_db_id == -1) { return false; }
  
  _userDB->do_sql("UPDATE track_builder set last_check_in=NOW(), died=NOW(), cause_of_death=? WHERE track_builder_id=?", 
                  "sd", status.c_str(), _primary_db_id);
  return true;
}
