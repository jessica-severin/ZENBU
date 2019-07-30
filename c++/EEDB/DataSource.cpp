/* $Id: DataSource.cpp,v 1.29 2018/12/05 00:33:15 severin Exp $ */

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
#include <sqlite3.h>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/date_time/gregorian/gregorian.hpp> //include all types plus i/o
#include <MQDB/MappedQuery.h>
#include <EEDB/DataSource.h>
#include <EEDB/Symbol.h>
#include <EEDB/Metadata.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Peer.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>

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
EEDB::DataSource* _eedb_datasource_copy_func(EEDB::DataSource *obj) { 
  return ((EEDB::DataSource*)obj)->_copy(NULL);
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
  _funcptr_copy           = _eedb_datasource_copy_func;

  _is_active        = true;
  _is_visible       = true;
  _metadata_loaded  = false;
  _create_date      = 0;
}

EEDB::DataSource* EEDB::DataSource::copy() {
  return _funcptr_copy(this);
}

EEDB::DataSource* EEDB::DataSource::_copy(EEDB::DataSource* copy) {
  if(!copy) { copy = new EEDB::DataSource; }

  copy->_primary_db_id          = _primary_db_id;
  copy->_database               = _database;
  copy->_db_id                  = _db_id;
  copy->_peer_uuid              = _peer_uuid;
  
  //copy->_funcptr_delete         = _funcptr_delete;
  //copy->_funcptr_display_desc   = _funcptr_display_desc;
  //copy->_funcptr_xml            = _funcptr_xml;
  //copy->_funcptr_simple_xml     = _funcptr_simple_xml;
  //copy->_funcptr_mdata_xml      = _funcptr_mdata_xml;
  //copy->_funcptr_load_metadata  = _funcptr_load_metadata;
  //copy->_funcptr_copy           = _funcptr_copy;

  copy->_is_active              = _is_active;
  copy->_is_visible             = _is_visible;
  copy->_name                   = _name;
  copy->_display_name           = _display_name;
  copy->_description            = _description;
  copy->_owner_identity         = _owner_identity;
  copy->_demux_key              = _demux_key;
  copy->_create_date            = _create_date;
  
  copy->_xml_cache.clear();
  copy->_simple_xml_cache.clear();
  
  //maybe need deeper copy of these, or leave up to subclass to decide
  metadataset(); //make sure it is loaded
  copy->_metadata_loaded = _metadata_loaded;
  if(_metadata_loaded) {
    copy->_metadataset.clear();
    copy->_metadataset.merge_metadataset(&_metadataset);
    copy->_metadataset.remove_duplicates();
  }
  
  expression_datatypes(); //need to lazy load these before copy
  map<string, EEDB::Datatype*>::iterator it;
  for(it=_datatypes.begin(); it!=_datatypes.end(); it++) {
    EEDB::Datatype* dtype = (*it).second;
    copy->_datatypes[dtype->type()] = dtype;
  }
  
  //map<string, EEDB::DataSource*>  _subsource_hash;  //do I need to copy this?
  //fprintf(stderr, "DataSource::_copy finished\n");
  return copy;
}

EEDB::DataSource::DataSource(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  string root_name = string(root_node->name());
  if((root_name != "datasource") && (root_name != "featuresource") && (root_name != "experiment") && (root_name != "edgesource")) { return; }
  
  if((attr = root_node->first_attribute("name")))           { _name = attr->value(); }
  if((attr = root_node->first_attribute("owner_openid")))   { _owner_identity = attr->value(); } //backward compatibility
  if((attr = root_node->first_attribute("owner_identity"))) { _owner_identity = attr->value(); }
  if((attr = root_node->first_attribute("create_timestamp"))) { _create_date = strtol(attr->value(), NULL, 10); }
  
  if((attr = root_node->first_attribute("id"))) {
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(attr->value(), uuid, objID, objClass);
    _primary_db_id = objID;
    _db_id = attr->value(); //store federatedID, if peer is set later, it will be recalculated
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { _peer_uuid = peer->uuid(); }
  }

  // metadata
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }
  
  // datatypes
  if((node = root_node->first_node("datatype")) != NULL) {
    while(node) {
      EEDB::Datatype *dtype = EEDB::Datatype::from_xml(node);
      if(dtype) { add_datatype(dtype); }
      node = node->next_sibling("datatype");
    }    
  }
  
 // parse_metadata_into_attributes();  
}


////////////////////////////////////////////////////
//
// XML and description section
//
////////////////////////////////////////////////////

string EEDB::DataSource::_display_desc() {
  return "Datasource()";
}

string EEDB::DataSource::display_contents() {
  return display_desc();
}

void EEDB::DataSource::_xml_start(string &xml_buffer) {
  char    buffer[2048];
  xml_buffer.append("<datasource id=\"");
  xml_buffer.append(db_id());
  xml_buffer.append("\" name=\"");
  xml_buffer.append(html_escape(display_name()));
  xml_buffer.append("\" ");

  if(_create_date>0) {
    xml_buffer += " create_date=\""+ create_date_string() +"\"";
    snprintf(buffer, 2040, " create_timestamp=\"%ld\"", _create_date);
    xml_buffer.append(buffer);
  }
  
  if(!_owner_identity.empty()) { xml_buffer += " owner_identity=\""+_owner_identity+"\""; }
  xml_buffer.append(">");
}

void EEDB::DataSource::_xml_end(string &xml_buffer) {
  xml_buffer.append("</datasource>");
}

void EEDB::DataSource::_simple_xml(string &xml_buffer) {
  if(_simple_xml_cache.empty()) {
    _xml_start(_simple_xml_cache);
    _xml_end(_simple_xml_cache);
  }
  xml_buffer.append(_simple_xml_cache);
}

void EEDB::DataSource::_xml(string &xml_buffer) {
  if(_xml_cache.empty()) {
    _xml_start(_xml_cache);
    _xml_cache.append("\n");

    EEDB::MetadataSet *mdset = metadataset();
    if(mdset!=NULL) { mdset->xml(_xml_cache); }

    expression_datatypes(); //to lazy load if needed
    map<string, EEDB::Datatype*>::iterator it;
    for(it=_datatypes.begin(); it!=_datatypes.end(); it++) {
      (*it).second->xml(_xml_cache);
    }

    if(!_subsource_hash.empty()) {
      char    cbuf[2048];
      snprintf(cbuf, 2040, "\n  <subsources count=\"%ld\">\n", _subsource_hash.size());
      _xml_cache.append(cbuf);
      map<string, EEDB::DataSource*>::iterator it1;
      vector<Metadata*> mdlist1 = mdset->metadata_list();
      for(it1 = _subsource_hash.begin(); it1 != _subsource_hash.end(); it1++) {
        if((*it1).second == NULL) { continue; }
        EEDB::DataSource *subsrc = (*it1).second;

        string xml_buffer;
        xml_buffer = "    <datasource id=\"" + subsrc->db_id() + "\" ";
        if(subsrc->display_name() != display_name()) { xml_buffer += "name=\"" + html_escape(subsrc->display_name()) + "\" "; }
        
        if(!subsrc->demux_key().empty()) { xml_buffer.append(" demux_key=\"" + subsrc->demux_key() + "\" "); }

        if(subsrc->create_date() != create_date()) {
          xml_buffer += " create_date=\""+ subsrc->create_date_string() +"\"";
          snprintf(cbuf, 2040, " create_timestamp=\"%ld\"", subsrc->create_date());
          xml_buffer.append(cbuf);
        }
        xml_buffer += ">";
        
        //logic to only show subsource metadata which is not present in the parent
        EEDB::MetadataSet *mdset2 = subsrc->metadataset()->copy();
        mdset2->remove_metadata(mdlist1);
        if(mdset2->size()>0) { mdset2->xml(xml_buffer); }
        
        //TODO: might need similar logic for subsource datatypes
        
        xml_buffer += "</datasource>\n";
  
        _xml_cache += xml_buffer;
      }
      _xml_cache.append("  </subsources>\n");
    }
    
    _xml_end(_xml_cache);
  }
  xml_buffer.append(_xml_cache);
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
// subsource / demux access section
//

EEDB::DataSource*  EEDB::DataSource::subsource_for_key(string demux_key) {
  if(demux_key.empty()) { return NULL; }
  EEDB::DataSource*  subsource = _subsource_hash[demux_key];
  if(!subsource) {
    subsource = this->copy();
    subsource->demux_key(demux_key);
    //subsource->database(NULL);
    //subsource->metadataset()->add_tag_data("demux_key", demux_key);
    _subsource_hash[demux_key] = subsource;
    
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(db_id(), uuid, objID, objClass);
    //fprintf(stderr, "parent source db_id  %s\n", db_id().c_str());
    //fprintf(stderr, "generate subsource demux[%s] peer[%s] id[%ld] class[%s]\n", demux_key.c_str(), uuid.c_str(), objID, objClass.c_str());
    
    string dbid = uuid;
    dbid += "::" + l_to_string(objID);
    //dbid += "s_"+ demux_key;
    dbid += "s"+ l_to_string(_subsource_hash.size());
    dbid += ":::" + objClass;
    subsource->_db_id = dbid;
  }
  return subsource;
}

vector<EEDB::DataSource*>  EEDB::DataSource::subsources() {
  vector<EEDB::DataSource*> subsource_array;
  
  map<string, EEDB::DataSource*>::iterator it1;
  for(it1 = _subsource_hash.begin(); it1 != _subsource_hash.end(); it1++) {
    if((*it1).second == NULL) { continue; }
    subsource_array.push_back((*it1).second);
  }
  return subsource_array;
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
  string dbid = source->db_id();
  if(dbid.empty()) { return; }

  if(EEDB::DataSource::sources_cache.find(dbid) == EEDB::DataSource::sources_cache.end()) { 
    source->retain();
    EEDB::DataSource::sources_cache[dbid] = source;
  } 
}


EEDB::DataSource*  EEDB::DataSource::sources_cache_get(string dbid) {
  if(EEDB::DataSource::sources_cache.find(dbid) == EEDB::DataSource::sources_cache.end()) { return NULL; }
  EEDB::DataSource* source = EEDB::DataSource::sources_cache[dbid];
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


