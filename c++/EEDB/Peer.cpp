/* $Id: Peer.cpp,v 1.154 2020/01/28 05:15:54 severin Exp $ */

/***

NAME - EEDB::Peer

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
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <sqlite3.h>
#include <stdarg.h>

#include <MQDB/MappedQuery.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/Peer.h>

using namespace std;
using namespace MQDB;

bool                      EEDB::Peer::global_should_cache = true;
map<string, EEDB::Peer*>  EEDB::Peer::global_uuid_cache;
string                    EEDB::Peer::global_current_web_url;
const char*               EEDB::Peer::class_name = "Peer";

void _eedb_peer_delete_func(MQDB::DBObject *obj) { 
  ((EEDB::Peer*)obj)->_delete();
}
void _eedb_peer_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Peer*)obj)->_xml(xml_buffer);
}
void _eedb_peer_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Peer*)obj)->_xml(xml_buffer);
}


EEDB::Peer::Peer() {
  init();
}

EEDB::Peer::~Peer() {
  free_source_stream();
}

void EEDB::Peer::init() {
  MQDB::MappedQuery::init();  //super
  _classname                 = EEDB::Peer::class_name;
  _funcptr_delete            = _eedb_peer_delete_func;
  _funcptr_xml               = _eedb_peer_xml_func;
  _funcptr_simple_xml        = _eedb_peer_simple_xml_func;

  _federation_depth       = 0;
  _database_is_valid      = -1;  //not tested
  _persistent             = true;
  _is_remote              = false;
  
  _peer_external_database = NULL;
  _source_stream          = NULL;
}

EEDB::Peer* EEDB::Peer::copy() {
  EEDB::Peer *t_copy = new EEDB::Peer();
  t_copy->set_uuid(_peer_uuid);
  t_copy->alias(_alias);
  t_copy->db_url(_db_url);
  return t_copy;
}

void EEDB::Peer::_delete() {
  disconnect();
  if(_persistent) { return; }
  delete this;
}


bool EEDB::Peer::operator< (const EEDB::Peer& b) {
  if(_federation_depth != b._federation_depth) {
    if(_federation_depth < b._federation_depth) { return true; } else { return false; }
  }
  return (boost::algorithm::to_lower_copy(_alias) < boost::algorithm::to_lower_copy(b._alias));
}


//
// URL based constructor
//
EEDB::Peer*  EEDB::Peer::new_from_url(string url) {
  EEDB::Peer  *peer = NULL;
  if(url.empty()) { return NULL; }
  size_t p1 = url.find("://");
  if(p1==string::npos) { return NULL; }
  string t_driver = boost::algorithm::to_lower_copy(url.substr(0, p1));
  
  if(t_driver == string("oscdb")) {
    peer = new EEDB::Peer();
    peer->_db_url = url;
    if(peer->_connect_via_oscdb()) { 
      //need to transfer all values from internal peer to external peer
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)(peer->source_stream());
      peer->set_uuid(oscdb->peer()->uuid());
      peer->alias(oscdb->peer()->alias());
      peer->db_url(oscdb->peer()->db_url());
      return peer; 
    }
    delete peer;
    return NULL;
  }
  else if(t_driver == string("bamdb")) {
    peer = new EEDB::Peer();
    peer->_db_url = url;
    if(peer->_connect_via_bamdb()) { 
      //need to transfer all values from internal peer to external peer
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)(peer->source_stream());
      peer->set_uuid(bamdb->peer()->uuid());
      peer->alias(bamdb->peer()->alias());
      peer->db_url(bamdb->db_url());
      return peer; 
    }
    delete peer;
    return NULL;
  }
  else if(t_driver == string("zdx")) {
    peer = new EEDB::Peer();
    peer->_db_url = url;
    if(peer->_connect_via_zdx()) { 
      //need to transfer all values from internal peer to external peer
      EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)(peer->source_stream());
      peer->set_uuid(zdxstream->self_peer()->uuid());
      peer->alias(zdxstream->self_peer()->alias());
      peer->db_url(zdxstream->self_peer()->db_url());
      return peer; 
    }
    delete peer;
    return NULL;
  }
  else if((t_driver == string("http")) or (t_driver == string("https")) or (t_driver == string("zenbu"))) {
    //fprintf(stderr, "try to connect to remote zenbu[%s]\n", url.c_str());
    EEDB::SPStreams::RemoteServerStream *rstream = EEDB::SPStreams::RemoteServerStream::new_from_url(url);
    if(!rstream) { return NULL; }
    EEDB::Peer* peer = rstream->master_peer();
    EEDB::Peer::add_to_cache(peer);
    return peer;
  } 
  else if((t_driver == string("mysql")) or  (t_driver == string("sqlite"))) {
    //MQDB database (sqlite or mysql)
    MQDB::Database *db = new MQDB::Database(url);
    if(db == NULL) { return NULL; }
    if(!db->get_connection()) { return NULL; }
    
    const char *sql = "SELECT * FROM peer WHERE is_self=1";
    MQDB::DBObject *obj = MQDB::fetch_single(EEDB::Peer::create, db, sql, "");
    if(obj != NULL) { peer = (EEDB::Peer*)obj; }
    db->disconnect();
    
    if(!peer) { 
      //not found internally so create new one, will not be "valid" but can be use in creation processes
      db->release();
      peer = new EEDB::Peer;      
      peer->create_uuid();
      peer->db_url(url);
      size_t p2 = url.rfind("/");
      if(p2!=string::npos) { 
        string t_alias = url.substr(p2+1);
        peer->alias(t_alias);
      }
    }
  }
  return peer;
}



//
// static member function each subclass must implement this code
// replace the "<class*> obj = new <class>" line with subclass specific class type
// must return as DBObject* cast
//
DBObject*  EEDB::Peer::create(map<string, dynadata> &row_map, MQDB::Database* db) {
  Peer  *obj = EEDB::Peer::check_cache(row_map["uuid"].i_string);
  if(obj!=NULL) { obj->retain(); return obj; }
  
  obj = new EEDB::Peer;
  obj->database(db);
  obj->init_from_row_map(row_map);
  EEDB::Peer::add_to_cache(obj);
  return obj;
}

//
// static member functions for object retrieval from database
//
vector<DBObject*>  EEDB::Peer::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM peer";
  return MQDB::fetch_multiple(EEDB::Peer::create, db, sql, "");
}

EEDB::Peer*  EEDB::Peer::fetch_by_uuid(MQDB::Database *db, string uuid) {
  const char *sql = "SELECT * FROM peer WHERE uuid=?";
  return (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, db, sql, "s", uuid.c_str());
}

EEDB::Peer*  EEDB::Peer::fetch_by_name(MQDB::Database *db, string name) {
  //a fuzzy method which allows either the UUID or alias to be used for access
  const char *sql = "SELECT * FROM peer WHERE uuid=? or alias=?";
  return (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, db, sql, "ss", name.c_str(), name.c_str());
}

EEDB::Peer*  EEDB::Peer::fetch_by_alias(MQDB::Database *db, string name) {
  //a fuzzy method which allows either the UUID or alias to be used for access
  const char *sql = "SELECT * FROM peer WHERE alias=?";
  return (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, db, sql, "s", name.c_str());
}

EEDB::Peer*  EEDB::Peer::fetch_self(MQDB::Database *db) {
  const char *sql = "SELECT * FROM peer WHERE is_self=1";
  Peer* peer = (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, db, sql, "");
  if(peer != NULL) { db->uuid(peer->uuid()); }
  return peer;
}

void  EEDB::Peer::set_current_web_url(string value) {
  EEDB::Peer::global_current_web_url = value;
}

void  EEDB::Peer::set_cache_behaviour(bool value) {
  if(EEDB::Peer::global_should_cache != value) {
    //if changing state, then flush the caches
    EEDB::Peer::global_uuid_cache.clear(); //maybe need to release
  }
  EEDB::Peer::global_should_cache = value;
}

EEDB::Peer*  EEDB::Peer::check_cache(string &uuid) {
  if(!EEDB::Peer::global_should_cache) { return NULL; }
  if(EEDB::Peer::global_uuid_cache.find(uuid) == EEDB::Peer::global_uuid_cache.end()) { return NULL; }
  return EEDB::Peer::global_uuid_cache[uuid];
}

int  EEDB::Peer::global_cache_size() {
  return global_uuid_cache.size();
}

vector<EEDB::Peer*>  EEDB::Peer::global_cached_peers() {
  vector<Peer*>  peers;
  map<string, Peer*>::iterator it;
  for(it=global_uuid_cache.begin(); it != global_uuid_cache.end(); it++) {
    peers.push_back((*it).second);
  }
  return peers;
}

void  EEDB::Peer::add_to_cache(Peer *obj) {
  if(!EEDB::Peer::global_should_cache) { return; }
  //if(obj->database() == NULL) { return; }
  if(obj->uuid() == NULL) { return; }
  string uuid = obj->uuid();
  if(EEDB::Peer::global_uuid_cache.find(uuid) != EEDB::Peer::global_uuid_cache.end()) { return; }
  obj->retain();
  EEDB::Peer::global_uuid_cache[uuid] = obj;
}


/////////////////////////////////////////////////////////////////////////


void EEDB::Peer::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Peer::display_desc() {
  char buffer[2048];
  string  desc;
  snprintf(buffer, 2040, "Peer[%s] %s", _peer_uuid, alias().c_str());
  desc = buffer;
  if(!_db_url.empty())  { desc += " db::" + _db_url; }
  return desc;
}

string EEDB::Peer::display_contents() {
  return display_desc();
}

void EEDB::Peer::_xml(string &xml_buffer) {
  xml_buffer.append("<peer");
  if(_peer_uuid != NULL) { 
    xml_buffer.append(" uuid=\"");
    xml_buffer.append(_peer_uuid);
    xml_buffer.append("\"");
  }
  if(!_alias.empty()) { 
    xml_buffer.append(" alias=\"");
    xml_buffer.append(_alias);
    xml_buffer.append("\"");
  }
  if(!_db_url.empty()) { 
    xml_buffer.append(" db_url=\"");
    xml_buffer.append(_db_url);
    xml_buffer.append("\"");
  }
  char buffer[2048];
  snprintf(buffer, 2040, " depth=\"%d\"", federation_depth());
  xml_buffer.append(buffer);
  xml_buffer.append(" ></peer>");
}


EEDB::Peer*  EEDB::Peer::new_from_xml(void *xml_node) {
  //pseudo constructor using a rapidxml node
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;

  if(root_node==NULL) { return NULL; }
  if(string(root_node->name()) != "peer") { return NULL; }

  attr = root_node->first_attribute("uuid");
  if(!attr) { return NULL; }
  string uuid = attr->value();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(peer!=NULL) { peer->retain(); return peer; }

  peer = new EEDB::Peer;
  peer->set_uuid(uuid);
  if((attr = root_node->first_attribute("alias")))   { peer->alias(attr->value()); }
  if((attr = root_node->first_attribute("db_url")))  { peer->db_url(attr->value()); }

  EEDB::Peer::add_to_cache(peer);
  return peer;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string       EEDB::Peer::driver() { return _driver; }
const char*  EEDB::Peer::uuid() { return _peer_uuid; }
string       EEDB::Peer::alias() { return _alias; }
string       EEDB::Peer::db_url() { return _db_url; }
int          EEDB::Peer::federation_depth() { return _federation_depth; }

long  EEDB::Peer::source_file_size() {
  if(_driver == "oscdb") {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)source_stream();
    return oscdb->source_file_size();
  }
  if(_driver == "bamdb") {
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)source_stream();
    return bamdb->source_file_size();
  }   
  return 0;
}

string  EEDB::Peer::source_md5sum() {
  if(_driver == "oscdb") {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)source_stream();
    return oscdb->source_md5sum();
  }
  if(_driver == "bamdb") {
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)source_stream();
    return bamdb->source_md5sum();
  }   
  return 0;
}

void EEDB::Peer::db_url(string value) { 
  _db_url = value;
  size_t p1 = _db_url.find("://");
  if(p1!=string::npos) { _driver = _db_url.substr(0, p1); }
}

void EEDB::Peer::alias(string value) { _alias = value; }

void EEDB::Peer::federation_depth(int value) { 
  if((_federation_depth == 0) or (value < _federation_depth)) { 
    _federation_depth = value;
  }
}

void EEDB::Peer::set_uuid(string value) {
  char *t_uuid = (char*)malloc(value.size()+1);
  bzero(t_uuid, value.size()+1);
  strcpy(t_uuid, value.c_str());
  if(_peer_uuid != NULL) { free((void*)_peer_uuid); }
  _peer_uuid = t_uuid;
}

void EEDB::Peer::create_uuid() {
  string uuid = MQDB::uuid_hexstring();
  set_uuid(uuid);  
}

void  EEDB::Peer::persistent(bool value) {
  _persistent = value;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods : storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Peer::init_from_row_map(map<string, dynadata> &row_map) {
  set_uuid(row_map["uuid"].i_string);
  alias(row_map["alias"].i_string);
  db_url(row_map["db_url"].i_string);
}


bool  EEDB::Peer::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(_peer_uuid == NULL) { create_uuid(); }
  
  db->do_sql("INSERT ignore INTO peer (uuid, alias, db_url) VALUES(?,?,?)", "sss", 
             _peer_uuid, _alias.c_str(), _db_url.c_str());
  
  database(db);
  return true;
}


EEDB::Peer*  EEDB::Peer::create_self_peer_for_db(MQDB::Database *db) {
  if(!db) { return NULL; }
  if(!(db->get_connection())) { return NULL; } 
    
  //db->do_sql("DELETE from peer WHERE is_self=1");
  //db->do_sql("UPDATE peer SET is_self=-1 WHERE is_self=1"); //clears old "selfs"
  
  string url = db->public_url();
  EEDB::Peer *peer = new EEDB::Peer();
  peer->create_uuid();
  peer->db_url(url);
  
  size_t p2 = url.rfind("/");
  if(p2!=string::npos) { 
    string t_alias = url.substr(p2+1);
    peer->alias(t_alias);
  }
  
  peer->store(db);
  db->do_sql("UPDATE peer SET is_self=1 WHERE uuid=?", "s", peer->uuid());
  //printf("new peer : %s\n", peer->xml().c_str());
  db->disconnect();

  return peer;  
}


void EEDB::Peer::disconnect() {
  if(_source_stream != NULL) { 
    _source_stream->disconnect();
  }
  if(_peer_external_database != NULL) { 
    _peer_external_database->disconnect();
  }
}


void  EEDB::Peer::free_source_stream() {
  if((_driver == string("mysql")) or (_driver == string("sqlite"))) { 
    //first release stream then database
    if(_source_stream != NULL) { 
      _source_stream->disconnect();
      _source_stream->release();
    }
    if(_peer_external_database != NULL) { 
      _peer_external_database->disconnect();
      _peer_external_database->release();
    }
    _source_stream = NULL;
    _peer_external_database = NULL;
  }

  if(_driver != string("oscdb")) {
    //database managed inside so just delete stream
    if(_source_stream != NULL) { 
      _source_stream->disconnect();
      _source_stream->release();
    }
    _source_stream = NULL;
    _peer_external_database = NULL;
  }

  _neighbor_peers.clear();
}



//////////////////////////////////////////////////////////////////////
//
// peer database connection section
//
//////////////////////////////////////////////////////////////////////


/*
bool EEDB::Peer::retest_is_valid() {
  if(_driver == "oscdb") {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)source_stream();
    if(!oscdb) { return false; }
  }
  if(_driver == "bamdb") {
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)source_stream();
    if(!bamdb) { return false; }
  }   
  if(_driver == "zdx") {
    EEDB::SPStreams::ZDX *zdxdb = (EEDB::SPStreams::ZDXDB*)source_stream();
    if(!zdxdb) { return false; }
  }   
  
  //fprintf(stderr, "retest_is_valid[%s]\n", uuid());
  if(_database_is_valid == 1) { 
    MQDB::Database *db = peer_database();
    if((db!=NULL) and db->get_connection()) { return true; }
  }
  //failed the simple retest so do full disconnect and reconnect
  fprintf(stderr, "retest_is_valid[%s] full test\n", uuid());
  free_source_stream();
  _database_is_valid   = -1;
  return is_valid();
}
*/

bool EEDB::Peer::retest_is_valid() {
  return true;
  //disconnect(); 
  //_connect_to_source_stream();
  //if(_database_is_valid == 1) { return true; }
  //return false;
}


bool EEDB::Peer::is_valid() {
  //_database_is_valid == -1 means not tested yet
  //_database_is_valid == 0  means tested but failed
  //_database_is_valid == 1  means tested and OK

  if(_database_is_valid == 1) { return true; }
  if(_database_is_valid == 0) { return false; }

  if(_peer_uuid == NULL) { _database_is_valid = 0; return false; }
  
  _connect_to_source_stream();

  if(_database_is_valid == 1) { return true; }
  return false;
}


MQDB::Database* EEDB::Peer::peer_database() {
  if(_database_is_valid==1) { return _peer_external_database; }
  _connect_to_source_stream();
  return _peer_external_database;
}


EEDB::SPStreams::SourceStream* EEDB::Peer::source_stream() {
  if(_source_stream != NULL) { return _source_stream; }
  _connect_to_source_stream();
  return _source_stream;
}

void  EEDB::Peer::remote_server_stream(EEDB::SPStreams::RemoteServerStream *stream) {
  if(_source_stream!=NULL) { _source_stream->release(); }
  _source_stream = stream;
  _source_stream->retain();
  _database_is_valid = 1;
  _is_remote = true;
}

bool  EEDB::Peer::is_remote() {
  return _is_remote;
}


void EEDB::Peer::_connect_to_source_stream() {
  if(_source_stream != NULL) { return; }  //already connected
  
  if(_peer_uuid == NULL) { _database_is_valid = 0; return; }
  
  if(_db_url.empty())  { _database_is_valid = 0; }

  if(_driver == "oscdb" and _connect_via_oscdb()) { return; }
  if(_driver == "bamdb" and _connect_via_bamdb()) { return; }
  if(((_driver == "mysql") or (_driver == "sqlite")) and _connect_via_mqdb()) { return; }  
  if(((_driver == "http") or (_driver == "zenbu")) and _connect_via_remote_stream()) { return; }  
  if(_driver == "zdx") { if(_connect_via_zdx()) { return; } else { /*fprintf(stderr, "zdx FAILED INIT [%s] %s\n", _peer_uuid, _db_url.c_str());*/ } }
  if(_driver == "zdx") { if(_connect_via_zdx()) { return; } /* else { fprintf(stderr, "zdx FAILED INIT [%s] %s\n", _peer_uuid, _db_url.c_str()); }*/ }

  _database_is_valid = 0;  //fell through so no valid database connection
}


bool EEDB::Peer::_connect_via_mqdb() {
  if(_database_is_valid == 0) { return false; }  //previously tested and failed

  size_t p1 = _db_url.find("://");
  if(p1==string::npos) { return false; }  
  string t_driver = _db_url.substr(0, p1);
  if((t_driver != string("mysql")) && (t_driver != string("sqlite"))) { return false; }
  
  if(_peer_external_database != NULL) { return true; }

  MQDB::Database *db = new MQDB::Database(_db_url);
  if(db == NULL) { return false; }
  
  if(!(db->get_connection())) { 
    db->disconnect(); 
    delete db;
    return false; 
  }
  
  dynadata value = db->fetch_col_value("SELECT uuid FROM peer WHERE is_self=1 and uuid=?", "s", _peer_uuid);
  if(value.type != MQDB::STRING) { db->disconnect(); delete db; return false; }
  if(value.i_string != string(_peer_uuid)) { db->disconnect(); delete db; return false; }
  
  //OK
  db->disconnect();

  db->alias(_alias);
  db->uuid(_peer_uuid);
  
  _peer_external_database = db;
  _source_stream          = new EEDB::SPStreams::SourceStream(db);
  _database_is_valid      = 1;
  _driver                 = db->driver();
  return true;
}


bool EEDB::Peer::_connect_via_oscdb() {
  if(_database_is_valid == 0) { return false; }  //previously tested and failed
  size_t p1 = _db_url.find("://");
  if(p1==string::npos) { return false; }  
  string t_driver = boost::algorithm::to_lower_copy(_db_url.substr(0, p1));
  if(t_driver != string("oscdb")) { return false; }
  
  if(_source_stream != NULL) { return true; } //already connected

  EEDB::SPStreams::OSCFileDB *oscdb = EEDB::SPStreams::OSCFileDB::new_from_url(_db_url);
  if(oscdb == NULL) { return false; }
  
  //test internal peer
  if((oscdb->peer() == NULL) ||
     (oscdb->peer()->uuid() == NULL) ||
     (_peer_uuid != NULL && strcmp(oscdb->peer()->uuid(), _peer_uuid) != 0)) {
    _database_is_valid = 0;
    return false; 
  }  
  
  _source_stream          = oscdb;
  _database_is_valid      = 1;
  _driver                 = "oscdb";

  if(_db_url != oscdb->peer()->db_url()) {
    //fprintf(stderr, "warning: peer[%s] internal db_url [%s] does not match external db_url [%s]\n", 
    //        _peer_uuid, oscdb->peer()->db_url().c_str(), _db_url.c_str());
  }          
  
  return true;
}


bool EEDB::Peer::_connect_via_bamdb() {
  if(_database_is_valid == 0) { return false; }  //previously tested and failed
  size_t p1 = _db_url.find("://");
  if(p1==string::npos) { return false; }  
  string t_driver = boost::algorithm::to_lower_copy(_db_url.substr(0, p1));
  if(t_driver != string("bamdb")) { return false; }
  
  if(_source_stream != NULL) { return true; } //already connected
  
  EEDB::SPStreams::BAMDB *bamdb = EEDB::SPStreams::BAMDB::new_from_url(_db_url);
  if(bamdb == NULL) { return false; }
  
  //test internal peer
  if((bamdb->peer() == NULL) ||
     (bamdb->peer()->uuid() == NULL) ||
     (_peer_uuid != NULL && strcmp(bamdb->peer()->uuid(), _peer_uuid) != 0)) {
    _database_is_valid = 0;
    fprintf(stderr, "BAMDB peer_uuid mismatch external[%s] internal[%s]\n", _peer_uuid, bamdb->peer()->uuid());
    return false; 
  }  
    
  _source_stream          = bamdb;
  _database_is_valid      = 1;
  _driver                 = "bamdb";
  
  if(_db_url != bamdb->peer()->db_url()) {
    //fprintf(stderr, "warning: peer[%s] internal db_url [%s] does not match external db_url [%s]\n", 
    //        _peer_uuid, oscdb->peer()->db_url().c_str(), _db_url.c_str());
  }          
  
  return true;
}


bool EEDB::Peer::_connect_via_remote_stream() {
  if(_database_is_valid == 0) { return false; }  //previously tested and failed
  if(_source_stream!= NULL) { return true; } //already connected
  fprintf(stderr, "EEDB::Peer::_connect_via_remote_stream try to connect [%s] %ld\n", _db_url.c_str(), (long)this);
  
  EEDB::SPStreams::RemoteServerStream *rstream = EEDB::SPStreams::RemoteServerStream::new_from_url(_db_url);
  if(!rstream) { return false; }

  _source_stream          = rstream;
  _database_is_valid      = 1;
  _driver                 = "zenbu";
    
  return true;  
}


bool EEDB::Peer::_connect_via_zdx() {
  if(_database_is_valid == 0) { return false; }  //previously tested and failed
  if(_source_stream!= NULL) { return true; } //already connected

  size_t p1 = _db_url.find("://");
  if(p1==string::npos) { return false; }  
  string t_driver = _db_url.substr(0, p1);
  if(t_driver != string("zdx")) { return false; }
  
  string t_path = _db_url.substr(p1+3);
  EEDB::ZDX::ZDXstream* zdxstream = EEDB::ZDX::ZDXstream::open(t_path);
  if(!zdxstream) { return false; }      
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!zdxdb) { return false; }
  if(zdxdb->magic() != string("ZDXRIKENZENBU01")) { return false; }

  if(!zdxstream->self_peer()) { return false; }
  if(_peer_uuid && (strcmp(_peer_uuid, zdxstream->self_peer()->uuid()) !=0)) { return false; }
  if(!_peer_uuid) { set_uuid(zdxstream->self_peer()->uuid()); }
  
  _source_stream          = zdxstream;
  _database_is_valid      = 1;
  _driver                 = "zdx";
  
  return true;  
}



////////////////////////////////////////////////////
//
// federated peer-2-peer searching/caching
//
////////////////////////////////////////////////////

EEDB::Peer* EEDB::Peer::find_peer(string uuid, int max_depth) {
  map<string, EEDB::Peer*> uuid_peers;
  uuid_peers[uuid] = NULL;
  bool rtn = find_peers(uuid_peers, max_depth);
  if(rtn) { return uuid_peers[uuid]; }
  return NULL;
}

    
bool EEDB::Peer::find_peers(map<string, EEDB::Peer*> &uuid_peers, int max_depth) {
  if(uuid_peers.empty()) { return false; }
  if(max_depth<=0) { return false; }
  map<string, bool>  network_search_flag;  //to track which peers we have visited  
  /*
  fprintf(stderr, "find_peers [%d]\n", uuid_peers.size());
  map<string, EEDB::Peer*>::iterator  it;
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    fprintf(stderr, "  %s\n", it->first.c_str());
  }
  */

  //first recursive search the cached neighbor peers
  bool rtn = _multipeer_neighbor_search(uuid_peers, max_depth, network_search_flag);
  if(rtn) { return rtn; }
  if(_is_remote) { return rtn; }
  
  //then do again connecting to network  
  network_search_flag.clear();
  rtn = _multipeer_network_search(uuid_peers, max_depth, network_search_flag);
  return rtn;
}


EEDB::Peer* EEDB::Peer::cache_find_peer(string uuid, int max_depth) {
  map<string, EEDB::Peer*> uuid_peers;
  uuid_peers[uuid] = NULL;
  bool rtn = cache_find_peers(uuid_peers, max_depth);
  if(rtn) { return uuid_peers[uuid]; }
  return NULL;
}


bool EEDB::Peer::cache_find_peers(map<string, EEDB::Peer*> &uuid_peers, int max_depth) {
  if(uuid_peers.empty()) { return false; }
  if(max_depth<=0) { return false; }
  map<string, bool>  network_search_flag;  //to track which peers we have visited  
  //fprintf(stderr, "find_peers [%d]\n", uuid_peers.size());
  return _multipeer_neighbor_search(uuid_peers, max_depth, network_search_flag);
}


bool EEDB::Peer::_multipeer_neighbor_search(map<string, EEDB::Peer*> &uuid_peers, 
                                           int max_depth, 
                                           map<string, bool> &network_search_flag) {
  //fprintf(stderr, "_multipeer_neighbor_search [%s]\n", display_desc().c_str());
  //recursive search of the cached neighbors
  if(network_search_flag.find(uuid()) != network_search_flag.end()) { return false; }
  network_search_flag[uuid()] = true;

  if(_multipeer_add_testdone(uuid_peers, this)) { return true; } //finished

  //no need to search inside an oscdb or bamdb for additional peers
  if(driver() == string("oscdb")) { return false; }
  if(driver() == string("bamdb")) { return false; }
  if(_is_remote) { return false; }

  //test next layer down
  if(federation_depth() + 1 > max_depth) { return false; }
  map<string, EEDB::Peer*>::iterator it;
  for(it = _neighbor_peers.begin(); it != _neighbor_peers.end(); it++) {
    if((*it).second->_multipeer_neighbor_search(uuid_peers, max_depth, network_search_flag)) { return true; }
  }
  return false;
}
 

bool EEDB::Peer::_multipeer_network_search(map<string, EEDB::Peer*> &uuid_peers, 
                                           int max_depth, 
                                           map<string, bool> &network_search_flag) {
  //fprintf(stderr, "_multipeer_network_search [%s]\n", display_desc().c_str());
  if(network_search_flag.find(uuid()) != network_search_flag.end()) { return false; }
  network_search_flag[uuid()] = true;

  if(_multipeer_add_testdone(uuid_peers, this)) { return true; } //finished

  //no need to search inside an oscdb or bamdb for additional peers
  if(driver() == string("oscdb")) { return false; }
  if(driver() == string("bamdb")) { return false; }
  if(_is_remote) { return false; }
  //fprintf(stderr, "  driver [%s]\n", driver().c_str());

  //test next layer down
  int next_depth = federation_depth() + 1;
  if(next_depth > max_depth) { return false; }

  //fprintf(stderr, "  network search into [%s]\n", display_desc().c_str());
  EEDB::SPStreams::SourceStream *stream = source_stream();
  if(stream == NULL) { return false; }

  if((_driver == "http") or (_driver == "zenbu")) {
    map<string, EEDB::Peer*>::iterator it;
    EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)stream;
    rstream->clear_filters();
    for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
      if((*it).second == NULL) {
        //fprintf(stderr, "add [%s] to peer filter\n", (*it).first.c_str());
        rstream->add_peer_id_filter((*it).first.c_str());
      }
    }
  }
  stream->stream_peers();
  

  EEDB::Peer *peer = (EEDB::Peer*)stream->next_in_stream();
  while(peer != NULL) {
    _neighbor_peers[peer->uuid()] = peer;
    peer->federation_depth(next_depth); 
    if(peer->_multipeer_network_search(uuid_peers, max_depth, network_search_flag)) { return true; }
    peer = (EEDB::Peer*)stream->next_in_stream();
  }
  return false;
}


bool EEDB::Peer::_multipeer_add_testdone(map<string, EEDB::Peer*> &uuid_peers, EEDB::Peer *peer) {
  map<string, EEDB::Peer*>::iterator  it;
  bool                                finished = true;

  if(peer == NULL) { return false; }
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    if((it->first == peer->uuid()) or (it->first == peer->alias())) {
      //fprintf(stderr, "found uuid match [%s]\n", peer->uuid());
      if(peer->is_valid()) { 
        it->second = peer;
      }
    }
    if(it->second == NULL) { finished=false; }
  }
  return finished;
}


bool EEDB::Peer::_multipeer_test_done(map<string, EEDB::Peer*> &uuid_peers) {
  map<string, EEDB::Peer*>::iterator  it;
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    //any missing peer (NULL) means we are not done
    if((*it).second == NULL) { return false; }
  }
  return true;  //yep all found
}


/***** all_network_peers

  Description: performs a peer-2-peer network search collecting
               all peers into a hash reference with a recursive algorithm
  Returntype : hash reference of peers;
  Exceptions : none

*****/

void EEDB::Peer::all_network_peers(int max_depth, map<string, EEDB::Peer*> &uuid_peers) {  
  if(max_depth<0) { max_depth =7; }

  if(uuid_peers.find(uuid()) != uuid_peers.end()) { return; }  //already found
  
  if(!is_valid()) { return; }
  if(_federation_depth == 0) { _federation_depth = 1; }
  if(_federation_depth > max_depth) { return; }

  EEDB::SPStreams::SourceStream *stream = source_stream();
  if(stream == NULL) { return; }

  //only place where peer is placed into the hash
  uuid_peers[uuid()] = this;

  //no need to search inside an oscdb or bamdb for additional peers
  if(driver() == string("oscdb")) { return; }
  if(driver() == string("bamdb")) { return; }
  if(driver() == string("zdx")) { return; }
  if(_is_remote) { return; }

  //tested test next layer down
  vector<EEDB::Peer*>            new_peers;
  vector<EEDB::Peer*>::iterator  it;

  stream->stream_peers();
  int next_depth = _federation_depth + 1;
  EEDB::Peer *peer;
  while((peer = (EEDB::Peer*)stream->next_in_stream())) {
    _neighbor_peers[peer->uuid()] = peer;
    if(uuid_peers.find(peer->uuid()) != uuid_peers.end()) { continue; }
    peer->federation_depth(next_depth);
    new_peers.push_back(peer);
  }
  //fprintf(stderr, "peer search registry [%s] %s -- %ld new peers added\n", uuid(), db_url().c_str(), new_peers.size());
  for(it = new_peers.begin(); it != new_peers.end(); it++) {
    (*it)->all_network_peers(max_depth, uuid_peers);
  }
}

