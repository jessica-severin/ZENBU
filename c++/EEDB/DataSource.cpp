/* $Id: DataSource.cpp,v 1.27 2015/06/04 03:50:53 severin Exp $ */

/***

NAME - EEDB::DataSource

SYNOPSIS

DESCRIPTION

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
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
#include <MQDB/MappedQuery.h>
#include <EEDB/DataSource.h>
#include <sqlite3.h>
#include <stdarg.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::DataSource::class_name = "EEDB::DataSource";
map<string, EEDB::DataSource*>  EEDB::DataSource::sources_cache;

void _eedb_datasource_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::DataSource*)obj;
}
string _eedb_datasource_display_desc_func(MQDB::DBObject *obj) { 
  //_funcptr_display_desc = _dbobject_default_display_desc_func;
  return ((EEDB::DataSource*)obj)->_display_desc();
}
void _eedb_datasource_default_load_metadata(EEDB::DataSource *obj) { 
}
void _eedb_datasource_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::DataSource*)obj)->_xml(xml_buffer);
}
void _eedb_datasource_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::DataSource*)obj)->_simple_xml(xml_buffer);
}


EEDB::DataSource::DataSource() {
  init();
}

EEDB::DataSource::~DataSource() {
}

void EEDB::DataSource::init() {
  MQDB::MappedQuery::init();
  _classname              = EEDB::DataSource::class_name;
  _funcptr_delete         = _eedb_datasource_delete_func;
  _funcptr_display_desc   = _eedb_datasource_display_desc_func;
  _funcptr_load_metadata  = _eedb_datasource_default_load_metadata;
  _funcptr_xml            = _eedb_datasource_xml_func;
  _funcptr_simple_xml     = _eedb_datasource_simple_xml_func;

  _is_active        = true;
  _is_visible       = true;
  _metadata_loaded  = false;
  _create_date      = 0;
}

string EEDB::DataSource::_display_desc() {
  return "Datasource()";
}

string EEDB::DataSource::display_contents() {
  return display_desc();
}

void EEDB::DataSource::_xml_start(string &xml_buffer) {
  xml_buffer.append("<datasource>");
}

void EEDB::DataSource::_xml_end(string &xml_buffer) {
  xml_buffer.append("</datasource>");
}

void EEDB::DataSource::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::DataSource::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::DataSource::clear_xml_caches() {
  _xml_cache.clear();
  _simple_xml_cache.clear();
}


//////////////////////////////////////////////////////////////////////////////////////////////////

string EEDB::DataSource::display_name() { 
  load_metadata();
  if(_display_name.empty() and !_name.empty()) { return _name; }
  return _display_name;
}

string EEDB::DataSource::description() { 
  load_metadata();
  return _description;
}

void  EEDB::DataSource::load_metadata() {
  //trigger lazy load of metadata
  if(_metadata_loaded) { return; }
  _metadata_loaded = true;
  _funcptr_load_metadata(this); 
}

EEDB::MetadataSet*   EEDB::DataSource::metadataset() {
  if(!_metadata_loaded) { 
    _metadata_loaded = true;
    _funcptr_load_metadata(this); 
  }
  return &_metadataset;
}


string  EEDB::DataSource::owner_identity() {
  //if(!_owner_identity.empty()) { return _owner_identity; }
  //EEDB::Metadata *md = metadataset()->find_metadata("eedb:owner_OpenID", "");
  //if(md) { _owner_identity = md->data(); }
  return _owner_identity;
}

time_t  EEDB::DataSource::create_date() { 
  return _create_date; 
}

void  EEDB::DataSource::create_date(time_t value) { 
  _create_date = value; 
}

string  EEDB::DataSource::create_date_string() { 
  string str;
  if(_create_date>0) {
    time_t t_update = _create_date;
    string t_value = ctime(&t_update);
    t_value.resize(t_value.size()-1); //remove \n
    str = t_value;
  }
  return str;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// datatype section
//

map<string, EEDB::Datatype*> EEDB::DataSource::expression_datatypes() {
  if(!_datatypes.empty()) { return _datatypes; }
  _load_datatype_from_metadata();
  return _datatypes;
}


void  EEDB::DataSource::clear_datatypes() {
  _datatypes.clear();
}

void  EEDB::DataSource::add_datatype(EEDB::Datatype* dtype) {
  if(!dtype) { return; }
  _datatypes[dtype->type()] = dtype;
}


bool  EEDB::DataSource::has_datatype(string dtype) {
  if(dtype.empty()) { return false; }
  if(_datatypes.find(dtype) != _datatypes.end()) { return true; }
  return false;
}


bool EEDB::DataSource::_load_datatype_from_metadata() {
  vector<EEDB::Metadata*> metadata;
  metadata = metadataset()->find_all_metadata_like("eedb:expression_datatype", "");
  
  for(unsigned int i=0; i<metadata.size(); i++) {
    string data = metadata[i]->data();
    EEDB::Datatype *dtype = EEDB::Datatype::get_type(data);
    if(dtype) { add_datatype(dtype); }
  }  
  if(_datatypes.empty()) { return false; }
  return true;
}




//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods : storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////



void  EEDB::DataSource::init_from_row_map(map<string, dynadata> &row_map) {
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// global sources cache, used for XML building of data stream
// webservices need to fill cache, no automatic systems
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void EEDB::DataSource::add_to_sources_cache(EEDB::DataSource* source) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  
  if(source == NULL) { return; }
  if(!source->is_active()) { return; }
  string fid = source->db_id();
  if(fid.empty()) { return; }

  if(EEDB::DataSource::sources_cache.find(fid) == EEDB::DataSource::sources_cache.end()) { 
    source->retain();
    EEDB::DataSource::sources_cache[fid] = source;
  } 
}


EEDB::DataSource*  EEDB::DataSource::sources_cache_get(string fid) {
  if(EEDB::DataSource::sources_cache.find(fid) == EEDB::DataSource::sources_cache.end()) { return NULL; }
  EEDB::DataSource* source = EEDB::DataSource::sources_cache[fid];
  if(!source->is_active()) { return NULL; }
  return source;
}


void EEDB::DataSource::clear_sources_cache() {
  map<string, EEDB::DataSource*>::iterator  it;
  for(it = EEDB::DataSource::sources_cache.begin(); it != EEDB::DataSource::sources_cache.end(); it++) {
    if((*it).second != NULL) { (*it).second->release(); }
  }
  EEDB::DataSource::sources_cache.clear();
}

