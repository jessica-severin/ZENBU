/* $Id: CachePoint.cpp,v 1.14 2016/06/08 06:50:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::CachePoint

SYNOPSIS

DESCRIPTION

 infrastructure module which interacts with the TrackCache system and ZDX cache files
 to provide smart mid-stream caching

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
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Feature.h>
#include <EEDB/SPStream.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/TrackCache.h>
#include <EEDB/TrackRequest.h>
#include <EEDB/SPStreams/CachePoint.h>

using namespace std;
using namespace MQDB;

const char*      EEDB::SPStreams::CachePoint::class_name = "EEDB::SPStreams::CachePoint";
EEDB::User*      EEDB::SPStreams::CachePoint::_user = NULL;
MQDB::Database*  EEDB::SPStreams::CachePoint::_userDB = NULL;


//function prototypes
void _spstream_cachepoint_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::CachePoint*)obj;
}
MQDB::DBObject* _spstream_cachepoint_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::CachePoint*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_cachepoint_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::CachePoint*)node)->_fetch_object_by_id(fid);
}
void _spstream_cachepoint_stream_features_by_metadata_search_func(EEDB::SPStream* node, string filter_logic) {
  ((EEDB::SPStreams::CachePoint*)node)->_stream_features_by_metadata_search(filter_logic);
}
void _spstream_cachepoint_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::CachePoint*)node)->_stream_peers();
}
void _spstream_cachepoint_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::CachePoint*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_cachepoint_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  ((EEDB::SPStreams::CachePoint*)node)->_stream_chromosomes(assembly_name, chrom_name);
}
void _spstream_cachepoint_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::CachePoint*)node)->_disconnect();
}
void _spstream_cachepoint_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::CachePoint*)node)->_reset_stream_node();
}
bool _spstream_cachepoint_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::CachePoint*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_cachepoint_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::CachePoint*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::CachePoint::~CachePoint() {
}

EEDB::SPStreams::CachePoint::CachePoint() {
  init();
}

void EEDB::SPStreams::CachePoint::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::CachePoint::class_name;
  _module_name               = "CachePoint";
  _funcptr_delete            = _spstream_cachepoint_delete_func;
  _funcptr_xml               = _spstream_cachepoint_xml_func;
  _funcptr_simple_xml        = _spstream_cachepoint_xml_func;
  
  //function pointer code
  _funcptr_next_in_stream                     = _spstream_cachepoint_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_cachepoint_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_cachepoint_disconnect_func;
  _funcptr_stream_by_named_region             = _spstream_cachepoint_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_cachepoint_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_cachepoint_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_cachepoint_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_cachepoint_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_cachepoint_reset_stream_node_func;
  
  //attribute variables
  _source_stream = NULL;
  
  _track_cache = NULL;
  _zdxstream = NULL;
  
  _region_start = -1;
  _region_end = -1;
}


////////////////////////////////////////////////////////////////////////////
// Instance methods
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::CachePoint::set_current_user(EEDB::User* user) {
  if(_user) { _user->release(); _user=NULL; }
  if(user) {
    user->retain();
    _user = user;
  }
}

void  EEDB::SPStreams::CachePoint::set_userDB(MQDB::Database *db) {
  if(db) { db->retain(); }
  _userDB = db;
}

void  EEDB::SPStreams::CachePoint::track_cache(EEDB::TrackCache* trackcache) {
  _track_cache = NULL;
  _zdxstream   = NULL;
  
  EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
  if(!zdxstream) { return; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!zdxdb) { return; }
  
  _track_cache  = trackcache;
}

EEDB::TrackCache*  EEDB::SPStreams::CachePoint::track_cache() {
  return _track_cache;
}


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
////////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::CachePoint::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();
  _region_start  = -1;
  _region_end    = -1;
  _zdxstream     = NULL;
}


void  EEDB::SPStreams::CachePoint::_disconnect() {
  EEDB::SPStream::_disconnect();
  _zdxstream = NULL;
}


MQDB::DBObject* EEDB::SPStreams::CachePoint::_next_in_stream() {
  if(_zdxstream) {
    return _zdxstream->next_in_stream();
  }
  return EEDB::SPStream::_next_in_stream();
}


bool  EEDB::SPStreams::CachePoint::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  bool rtn = true;
  if(_check_track_cache(assembly_name, chrom_name, start, end)) {
    _zdxstream = _track_cache->zdxstream();
    rtn &= _zdxstream->stream_by_named_region(assembly_name, chrom_name, start, end);
    fprintf(stderr, "CachePoint::_stream_by_named_region [%s] using ZDX cache\n", _track_cache->track_hashkey().c_str());
    if(!_track_cache->remote_server_url().empty()) { fprintf(stderr, "CachePoint remote track cache\n"); }
  } else {
    fprintf(stderr, "CachePoint::_stream_by_named_region [%s] not built, direct streaming\n", _track_cache->track_hashkey().c_str());
    rtn &= EEDB::SPStream::_stream_by_named_region(assembly_name, chrom_name, start, end);
  }  
  _region_start = start;
  _region_end   = end;
  return rtn;
}


bool  EEDB::SPStreams::CachePoint::_check_track_cache(string assembly_name, string chrom_name, long start, long end) {
  //this is the method used at query time to see if TrackCache is built
  if(!_track_cache) { return false; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }
    
  if(zdxstream->is_built(assembly_name, chrom_name, start, end)) { 
    return true; 
  }
  
  // log a 'guest' track_request for this region  
  ZDXdb* zdxdb = zdxstream->zdxdb();
  long numsegs, numbuilt, numclaimed, unbuilt, seg_start;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, chrom_name, start, end, numsegs, numbuilt, numclaimed, seg_start);
  
  if(numsegs==0) {
    //trackcache not properly built so can't do anything
    return false;
  }
  
  unbuilt = numsegs-numbuilt-numclaimed;
  if(unbuilt>0) {  
    //TODO: right now this generates too many requests, need to rethink how to do this
    /*
    EEDB::TrackRequest* buildrequest = new EEDB::TrackRequest();
    buildrequest->assembly_name(assembly_name);
    buildrequest->chrom_name(chrom_name); 
    buildrequest->chrom_start(start);
    buildrequest->chrom_end(end);
    buildrequest->num_segs(numsegs);
    buildrequest->unbuilt(unbuilt);
    buildrequest->track_name("CachePoint");
    buildrequest->view_uuid("");
    
    buildrequest->store(_track_cache);
    */
  }
  
  return false;
}


////////////////////////////////////////////////////////////////////////////
// these methods might redirect into the zdx cache in the future 
// but for now they just go down the main stream

MQDB::DBObject* EEDB::SPStreams::CachePoint::_fetch_object_by_id(string fid) {
  return  EEDB::SPStream::_fetch_object_by_id(fid);
}


void EEDB::SPStreams::CachePoint::_stream_features_by_metadata_search(string filter_logic) {
  EEDB::SPStream::_stream_features_by_metadata_search(filter_logic);
}


void  EEDB::SPStreams::CachePoint::_stream_chromosomes(string assembly_name, string chrom_name) {
  EEDB::SPStream::_stream_chromosomes(assembly_name, chrom_name);
}


void EEDB::SPStreams::CachePoint::_stream_data_sources(string classname, string filter_logic) {
  EEDB::SPStream::_stream_data_sources(classname, filter_logic);
}


void EEDB::SPStreams::CachePoint::_stream_peers() {
  EEDB::SPStream::_stream_peers();
}


/*****************************************************************************************/

void EEDB::SPStreams::CachePoint::_xml(string &xml_buffer) {
  if(_source_stream) {
    _source_stream->xml(xml_buffer);
  }
}


EEDB::SPStreams::CachePoint::CachePoint(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  
  if(string(root_node->name()) != "spstream") { return; }  
}



