/* $Id: DBObject.cpp,v 1.46 2022/07/08 02:39:27 severin Exp $ */

/***
NAME

MQDB::DBObject - DESCRIPTION of Object

SYNOPSIS

Root class for all objects in MappedQuery toolkit

DESCRIPTION

Root object for toolkit and all derived subclasses. 
All objects in the MappedQuery structure are designed to 
be persisted in a database. Here database is a more broad
term and can be considered any object persistance systems.
Currently the toolkit works with SQL based systems but 
object databases or custom storage engines are possible.
Provides base common methods used by all objects. 

AUTHOR

Contact Jessica Severin: jessica.severin@gmail.com

LICENSE

 * Software License Agreement (BSD License)
 * MappedQueryDB [MQDB] toolkit
 * copyright (c) 2006-2013 Jessica Severin
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin nor the
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

The rest of the documentation details each of the object methods. 
Internal methods are usually preceded with a _

***/

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <sqlite3.h>
#include <stdarg.h>
//#include <boost/algorithm/string.hpp>

using namespace std;
using namespace MQDB;

const char*  MQDB::DBObject::class_name = "MQDB::DBObject";

//function prototypes
void _dbobject_default_delete_func(MQDB::DBObject *obj) { 
  delete obj;  //cast as MQDB::DBObject
}
string _dbobject_default_display_desc_func(MQDB::DBObject *obj) { 
  return obj->_display_desc();
}

void _dbobject_default_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  //_funcptr_xml          = _dbobject_default_xml_func;
}

void _dbobject_default_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  //_funcptr_simple_xml   = _dbobject_default_simple_xml_func;
}

void _dbobject_default_mdata_xml_func(MQDB::DBObject *obj, string &xml_buffer, map<string,bool> mdtags) {
  //_funcptr_mdata_xml    = _dbobject_default_mdata_xml_func;
}

// helper function
void MQDB::parse_federated_id(string fid, string &uuid, long int &objID, string &objClass) {
  uuid.clear();
  objClass="Feature";
  objID = -1;
  
  size_t   p1;
  if((p1 = fid.find("::")) != string::npos) {
    uuid = fid.substr(0, p1);
    string idclass = fid.substr(p1+2);
    if((p1 = idclass.find(":::")) != string::npos) {
      objClass = idclass.substr(p1+3);
      string t_id = idclass.substr(0, p1);
      objID = atoi(t_id.c_str());
    } else {
      objID = atoi(idclass.c_str());
    }
  }
}

/* new

  Description: instance creation method
  Returntype : instance of this Class (subclass)
  Exceptions : none

*/

MQDB::DBObject::DBObject() {
  init();
}

MQDB::DBObject::~DBObject() {
  if(_database) {
    _database->release();
    _database = NULL;
  }
}

/* init

  Description: initialization method which subclasses can extend
  Returntype : $self
  Exceptions : subclass dependent

*/

void MQDB::DBObject::init() {
  //internal variables minimal allocation

  _retain_count  = 1;
  _primary_db_id = -1;  
  _database      = NULL;
  _classname     = MQDB::DBObject::class_name;
  _peer_uuid     = NULL;
  _root_uuid     = NULL;
  _db_id.clear();
 
  //function pointer code
  _funcptr_delete       = _dbobject_default_delete_func;
  _funcptr_display_desc = _dbobject_default_display_desc_func;
  _funcptr_xml          = _dbobject_default_xml_func;
  _funcptr_simple_xml   = _dbobject_default_simple_xml_func;
  _funcptr_mdata_xml    = _dbobject_default_mdata_xml_func;
}

/* copy

  Description: Shallow copy which copies all base attributes of object 
               to new instance of same class
  Returntype : same as calling instance
  Exceptions : subclass dependent

*/

MQDB::DBObject* MQDB::DBObject::copy() {
  DBObject *copy = new MQDB::DBObject;

  copy->_primary_db_id        = _primary_db_id;
  copy->_database             = _database;
  copy->_funcptr_delete       = _funcptr_delete;
  copy->_funcptr_display_desc = _funcptr_display_desc;
  copy->_funcptr_xml          = _funcptr_xml;
  copy->_funcptr_simple_xml   = _funcptr_simple_xml;
  copy->_funcptr_mdata_xml    = _funcptr_mdata_xml;
  return copy;
}

void MQDB::DBObject::retain() {
  _retain_count++;
  //fprintf(stderr, "[%s] retain(%ld)\n", _classname, _retain_count);
}

void MQDB::DBObject::release() {
  _retain_count--;
  if(_retain_count <= 0) { _funcptr_delete(this); }
}


///////////////////////////////////////////////////////////////////////////////////////
// Instance methods
///////////////////////////////////////////////////////////////////////////////////////

/* classname

  Description: fixed string symbol for this class. Must be implemented 
               for each subclass and each subclass within toolkit 
               should return a unique name. used by global  methods.
  Returntype : string
  Exceptions : error if subclass does not redefine

*/

const char* MQDB::DBObject::classname() {
  return _classname;
}

/* database

  Description: the MQDB::Database where this object is permanently persisted to.
               Here database is any object persistance system.
  Returntype : MQDB::Database
  Exceptions : die if invalid setter value type is provided 

*/

MQDB::Database* MQDB::DBObject::database() {
  return _database;
}

void MQDB::DBObject::database(MQDB::Database* db) {
  if(db) { db->retain(); }
  if(_database) { _database->release(); }
  _database = db;
}

/* primary_id

  Description: the unique identifier for this object within database.
  Returntype : scalar or UNDEF
  Exceptions : none

*/

long int MQDB::DBObject::primary_id() {
  return _primary_db_id;
}

void MQDB::DBObject::primary_id(long int id) {
  _primary_db_id = id;
  _db_id.clear();
}

string MQDB::DBObject::id() {
  char  buffer[128];
  snprintf(buffer, 127, "%ld", _primary_db_id);
  return buffer;
}


/* peer_uuid

  Description: the worldwide unique identifier for the database where this object resides.
  Returntype : UUID string or ""
  Exceptions : none

*/

void MQDB::DBObject::peer_uuid(const char* uuid) {
  _peer_uuid = uuid; 
  _db_id.clear();
}

const char* MQDB::DBObject::peer_uuid() {
  if(_peer_uuid != NULL) { return _peer_uuid; }
  if(_database == NULL) { return NULL; }
  if(_database->uuid() != NULL) {
    _peer_uuid = _database->uuid();
  }
  return _peer_uuid;
}

void MQDB::DBObject::root_uuid(const char* uuid) {
  _root_uuid = uuid; 
}

const char* MQDB::DBObject::root_uuid() {
  return _root_uuid;
}


/* db_id

  Description: the worldwide unique identifier for this object.
               A URL-like combination of database, class, and id
  Returntype : string or undef if database is not defined
  Exceptions : none

*/

string MQDB::DBObject::db_id() {
  if(!_db_id.empty()) { return _db_id; }
  if(_primary_db_id == -1) { return ""; }

  if(peer_uuid() != NULL) {
    _db_id = peer_uuid();
    _db_id += "::" + id();
    if(_classname != string("Feature")) { _db_id += ":::" + string(_classname); }
  } else if(_database != NULL) {
    _db_id = _database->url();
    _db_id += "/"+ string(_classname) +"?id="+ id();
  }
  return _db_id;
}


void MQDB::DBObject::db_id(string id) {
  //used for 'proxy' objects where we do not have a real
  //connection to the peer, but we know it's federated ID
  if(id.empty()) { return; }
  
  _db_id = id;
  _peer_uuid = NULL;
  _primary_db_id = -1;
}


/* display_desc

  Description: general purpose debugging method that returns a nice
               human readable description of the object instance contents.
               Each subclass should implement and return a nice string.
  Returntype : string scalar 
  Exceptions : none

*/

string MQDB::DBObject::display_desc() {
  return _funcptr_display_desc(this);
}

string MQDB::DBObject::_display_desc() {
  return "";
}

/* display_info

  Description: convenience method which prints the display_desc string
               with a carriage return to STDOUT. useful for debugging.
  Returntype : none
  Exceptions : none

*/

void MQDB::DBObject::display_info() {
  printf("%s\n", this->display_desc().c_str());
}


/* xml
  Description: every object in system should be persistable in XML format.
               returns an XML description of the object and all child objects.
               Each subclass must implement and return a proper XML string.
               Convenient to use an xml_start() xml_end() pattern.
*/

void MQDB::DBObject::xml(string &xml_buffer) {
  _funcptr_xml(this, xml_buffer);
}

/* simple_xml
  Description: Can be used when only the primary XML start tag and attributes are needed
               Convenient to use an xml_start() xml_end() pattern.
*/

void MQDB::DBObject::simple_xml(string &xml_buffer) {
  _funcptr_simple_xml(this, xml_buffer);
}


/* mdata_xml
 Description: Can be used when only a specific set of metadata is required. Allows for more compact memory usage
 when transfering metadata to clients
 */

void MQDB::DBObject::mdata_xml(string &xml_buffer, map<string,bool> mdtags) {
  _funcptr_mdata_xml(this, xml_buffer, mdtags);
}


/* convenience methods when one wants to quickly code up some tests
   and see some xml output without needing to worry about performance
*/

string MQDB::DBObject::xml() {
  string xml_buffer;
  xml_buffer.reserve(100000);
  xml(xml_buffer);  //does func_ptr magic
  return xml_buffer;
}

string MQDB::DBObject::simple_xml() {
  string xml_buffer;
  xml_buffer.reserve(100000);
  simple_xml(xml_buffer);  //does func_ptr magic
  return xml_buffer;
}

string MQDB::DBObject::mdata_xml(map<string,bool> mdtags) {
  string xml_buffer;
  xml_buffer.reserve(100000);
  mdata_xml(xml_buffer, mdtags);  //does func_ptr magic
  return xml_buffer;
}

