/* $Id: MergeStreams.cpp,v 1.53 2019/02/15 04:36:20 severin Exp $ */

/***

NAME - EEDB::SPStreams::MergeStreams

SYNOPSIS

DESCRIPTION

a signal-processing-stream filter built around the same code as EEDB::Tools:OverlapCompare
As a stream filter the idea is a restricted use-case which is very common.
This filter is configured with a set of sources and expansion distances.
These sources form a collation of "templates" which are used for "clustering".
If the input features/expressions overlaps with any of these sources the tempate
is copied and the expression is "collected" under it as a "pseudo-cluster".
There will also be an optional min/max to compress the feature to the
limits of the input stream.

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
#include <EEDB/SPStreams/MergeStreams.h>
#include <EEDB/SPStream.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::MergeStreams::class_name = "EEDB::SPStreams::MergeStreams";

//function prototypes
MQDB::DBObject*  _spstream_mergestreams_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MergeStreams*)node)->_next_in_stream();
}

void _spstream_mergestreams_stream_clear_func(EEDB::SPStream* node) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_clear(); }
  if(t_side_stream != NULL)         { t_side_stream->stream_clear(); }
}

MQDB::DBObject* _spstream_mergestreams_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  if(node->source_stream() != NULL) { 
    MQDB::DBObject *obj = node->source_stream()->fetch_object_by_id(fid); 
    if(obj!=NULL) { return obj; }
  }
  if(node->side_stream() != NULL) { 
    MQDB::DBObject *obj = node->side_stream()->fetch_object_by_id(fid);
    if(obj!=NULL) { return obj; }
  }
  return NULL;
}
  
bool _spstream_mergestreams_fetch_features_func(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  bool rtn=true;
  if(node->source_stream() != NULL) { rtn = rtn && node->source_stream()->fetch_features(fid_hash); }
  if(t_side_stream != NULL)         { rtn = rtn && t_side_stream->fetch_features(fid_hash); }
  return rtn;
}

void _spstream_mergestreams_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_features_by_metadata_search(search_logic); }
  if(t_side_stream != NULL)         { t_side_stream->stream_features_by_metadata_search(search_logic); }
}

void _spstream_mergestreams_stream_all_features_func(EEDB::SPStream* node) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_all_features(); }
  if(t_side_stream != NULL)         { t_side_stream->stream_all_features(); }
}

bool _spstream_mergestreams_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::MergeStreams*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}

void _spstream_mergestreams_stream_edges_func(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_edges(fid_hash); }
  if(t_side_stream != NULL)         { t_side_stream->stream_edges(fid_hash); }
}

void _spstream_mergestreams_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_data_sources(classname, filter_logic); }
  if(t_side_stream != NULL)         { t_side_stream->stream_data_sources(classname, filter_logic); }
}

void _spstream_mergestreams_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->get_dependent_datasource_ids(source_ids); }
  if(t_side_stream != NULL)         { t_side_stream->get_dependent_datasource_ids(source_ids); }
}

void _spstream_mergestreams_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_chromosomes(assembly_name, chrom_name); }
  if(t_side_stream != NULL)         { t_side_stream->stream_chromosomes(assembly_name, chrom_name); }
}

void _spstream_mergestreams_stream_peers_func(EEDB::SPStream* node) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->stream_peers(); }
  if(t_side_stream != NULL)         { t_side_stream->stream_peers(); }
}

void _spstream_mergestreams_disconnect_func(EEDB::SPStream* node) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->disconnect(); }
  if(t_side_stream != NULL)         { t_side_stream->disconnect(); }
}

void _spstream_mergestreams_reload_stream_data_sources_func(EEDB::SPStream* node) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->reload_stream_data_sources(); }
  if(t_side_stream != NULL)         { t_side_stream->reload_stream_data_sources(); }
}

void _spstream_mergestreams_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MergeStreams*)node)->_reset_stream_node();
}

void _spstream_mergestreams_get_proxies_by_name(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies) {
  EEDB::SPStream* t_side_stream = node->side_stream();
  if(node->source_stream() != NULL) { node->source_stream()->get_proxies_by_name(proxy_name, proxies); }
  if(t_side_stream != NULL)         { t_side_stream->get_proxies_by_name(proxy_name, proxies); }
}

void _spstream_mergestreams_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MergeStreams*)obj;
}
void _spstream_mergestreams_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::MergeStreams*)obj)->_xml(xml_buffer);
}




EEDB::SPStreams::MergeStreams::MergeStreams() {
  init();
}

EEDB::SPStreams::MergeStreams::~MergeStreams() {
}

void EEDB::SPStreams::MergeStreams::init() {
  MQDB::DBObject::init();
  _classname                  = EEDB::SPStreams::MergeStreams::class_name;
  _module_name                = "MergeStreams";
  _funcptr_delete             = _spstream_mergestreams_delete_func;
  _funcptr_xml                = _spstream_mergestreams_xml_func;
  _funcptr_simple_xml         = _spstream_mergestreams_xml_func;

  _source_stream   = NULL;
  _side_stream     = NULL;
  _current_object1 = NULL;
  _current_object2 = NULL;

  
  //function pointer code
  _funcptr_next_in_stream                     = _spstream_mergestreams_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_mergestreams_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_mergestreams_disconnect_func;
  _funcptr_stream_clear                       = _spstream_mergestreams_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_mergestreams_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_mergestreams_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_mergestreams_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_mergestreams_get_dependent_datasource_ids_func;
  _funcptr_stream_chromosomes                 = _spstream_mergestreams_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_mergestreams_stream_peers_func;
  _funcptr_reload_stream_data_sources         = _spstream_mergestreams_reload_stream_data_sources_func;
  _funcptr_reset_stream_node                  = _spstream_mergestreams_reset_stream_node_func;
  _funcptr_get_proxies_by_name                = _spstream_mergestreams_get_proxies_by_name;
  _funcptr_stream_all_features                = _spstream_mergestreams_stream_all_features_func;
  _funcptr_fetch_features                     = _spstream_mergestreams_fetch_features_func;
  _funcptr_stream_edges                       = _spstream_mergestreams_stream_edges_func;
}


void EEDB::SPStreams::MergeStreams::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::MergeStreams::display_desc() {
  string xml = "SPStream[";
  xml += _classname;
  xml += "]";
  return xml;
}

string EEDB::SPStreams::MergeStreams::display_contents() {
  return display_desc();
}



////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::MergeStreams::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::MergeStreams::MergeStreams(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("side_stream")) != NULL) {
    create_side_stream_from_xml(node);
  }
}


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
////////////////////////////////////////////////////////////////////////////

/***** reset_stream_node
   This is called at the beginning of every stream_xxxxx() call.
   use to reset/clear internal caches/variables between different streams.
*****/

void EEDB::SPStreams::MergeStreams::_reset_stream_node() {
  if(_current_object1) { _current_object1->release(); }
  if(_current_object2) { _current_object2->release(); }
  _current_object1 = NULL;
  _current_object2 = NULL;
  _region_start   = -1;
  _region_end     = -1;
}

bool EEDB::SPStreams::MergeStreams::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  bool rtn = true;
  if(source_stream() != NULL) { 
    rtn &= source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
  }
  EEDB::SPStream* t_side_stream = side_stream();
  if(t_side_stream != NULL) { 
    rtn &= t_side_stream->stream_by_named_region(assembly_name, chrom_name, start, end);
  }
  return rtn;
}


/***** next_in_stream
  Description: return the next object in the stream stack
               depending on the configuration this will either be an on-the-fly created object
               or an object passed through filters, or a primary object streamed out of database/peer
  Returntype : either a DBObject or NULL if end of stream
*****/

MQDB::DBObject*  EEDB::SPStreams::MergeStreams::_next_in_stream() {
  EEDB::Feature   *feature1=NULL, *feature2=NULL;
  MQDB::DBObject  *obj;

  //from last round one or both are NULL so fill
  if((_source_stream!=NULL) and (_current_object1==NULL)) {
    _current_object1 = _source_stream->next_in_stream();
  }
  if((_side_stream!=NULL) and (_current_object2==NULL)) {
    _current_object2 = _side_stream->next_in_stream();
  }

  //NULL tests
  if((_current_object1==NULL) and (_current_object2==NULL)) { return NULL; }  //we are done
  if(_current_object1==NULL) { 
    obj = _current_object2; 
    _current_object2 = NULL;
    return obj; 
  }
  if(_current_object2==NULL) {
    obj = _current_object1; 
    _current_object1 = NULL;
    return obj;
  }
  
  //now we have two objects so need to pick
  if(_current_object1->classname() == EEDB::Feature::class_name) { 
    feature1 = (EEDB::Feature*)_current_object1;
  }
  if(_current_object1->classname() == EEDB::Expression::class_name) { 
    feature1 = ((EEDB::Expression*)_current_object1)->feature();
  }
  if(_current_object2->classname() == EEDB::Feature::class_name) { 
    feature2 = (EEDB::Feature*)_current_object2;
  }
  if(_current_object2->classname() == EEDB::Expression::class_name) { 
    feature2 = ((EEDB::Expression*)_current_object2)->feature();
  }

  if(feature1==NULL) {
    //_current_object1 is neither feature or expression so just return it
    obj = _current_object1; 
    _current_object1 = NULL;
    return obj;
  }
  if(feature2==NULL) {
    //_current_object2 is neither feature or expression so just return it
    obj = _current_object2; 
    _current_object2 = NULL;
    return obj;
  }
  
  if((*feature1) < (*feature2)) {
    obj = _current_object1; 
    _current_object1 = NULL;
    return obj;
  } else {
    obj = _current_object2; 
    _current_object2 = NULL;
    return obj;
  }
}



