/* $Id: DBStream.cpp,v 1.29 2013/04/08 05:44:45 severin Exp $ */

/*******

NAME

MQDB::DBStream - DESCRIPTION of Object

SYNOPSIS

A simplified object to manage a collection of information related to streaming data from
a database.  at least with MYSQL, the perl driver does odd caching so to stream one
needs to create a new database connection in order to stream

CONTACT

Jessica Severin <jessica.severin@gmail.com>

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

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

*/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sqlite3.h>
#include <stdarg.h>
#include <boost/algorithm/string.hpp>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <MQDB/DBStream.h>

using namespace std;
using namespace MQDB;


bool         MQDB::DBStream::_db_should_use_result = false;
const char*  MQDB::DBStream::class_name = "MQDB::DBStream";


MQDB::DBStream::DBStream() {
  init();
}

MQDB::DBStream::~DBStream() {
  if(_stream_sth!=NULL && _stream_database!=NULL) {
    _stream_database->finalize_stmt(_stream_sth);
  }
  if(_database != NULL) { 
    _database->disconnect();
    _database->release();
  }
  if(_stream_database != NULL) { 
    _stream_database->disconnect();
    delete _stream_database;
  }
  _stream_sth = NULL;  
  _database = NULL;  
  _stream_database = NULL;  
}

void _mqdb_dbstream_delete_func(MQDB::DBObject *obj) { 
  delete (MQDB::DBStream*)obj;
}

void MQDB::DBStream::init() {
  MQDB::DBObject::init();
  _classname       = MQDB::DBStream::class_name;
  _funcptr_delete  = _mqdb_dbstream_delete_func;
  _stream_sth      = NULL;  
  _database        = NULL;  
  _stream_database = NULL;  
}


/**************************************************************************************************
*
  database()

  Description: Needs to have two database connections open, one for the active
               stream handle, and one for lazy-loading additional data on the returned 
               objects.  This is used to set the database which is the one streaming objects
  Arg (1)    : $database (MQdb::Database) for setting
  Returntype : MQdb::Database
  Exceptions : none
  Callers    :  MQdb::MappedQuery
*
**************************************************************************************************/

MQDB::Database* 
MQDB::DBStream::database(MQDB::Database* db) {
  if(_database != NULL) {
    _database->disconnect();
    _database->release();
    _database = NULL;  
  }
  if(db!=NULL) {
    db->retain();  
    _database = db;
  }
  if(_stream_database != NULL) {
    _stream_database->disconnect();
    _stream_database->release();
    _stream_database = NULL;  
  }
  if(_database !=NULL) {
    _stream_database = _database->copy();
  }
  return _stream_database;
}

MQDB::Database* MQDB::DBStream::database() {
  return _database;
}


/**************************************************************************************************
*
* class_create
*
*      Description: set class creation function for these prepare statements
*
**************************************************************************************************/

void MQDB::DBStream::class_create(DBObject* (*createFunc)(map<string, dynadata> &row_map, Database* db)) {
  _createFunc = createFunc;
} 


/**************************************************************************************************
*
* prepare_sql
*
*      Description: this is an internal system method.  It is used to set the SQL query used
*                   to stream objects out of a database.  Must be have stream_class() set
*                   to a subclass of DBStream which implements the mapRow() method.
*      Example        : $db->execute_sql("insert into table1(id, value) values(?,?)", $id, $value);
*      Parameter[1]   : sql statement string
*      Parameter[2..] : optional parameters for the SQL statement
*      Returntype     : none
*      Exceptions     : none
*
**************************************************************************************************/


void MQDB::DBStream::prepare_sql(const char* sql) {
  if(_stream_database == NULL) { return; } 
  if(_stream_sth!=NULL) {
    _stream_database->finalize_stmt(_stream_sth);
    _stream_sth = NULL;  
  }
  _stream_sth = _stream_database->prepare_fetch_sql(sql);
}


void MQDB::DBStream::prepare_sql(const char* sql, const char* fmt, ...) {
  if(_stream_database == NULL) { return; } 
  if(_stream_sth!=NULL) {
    _stream_database->finalize_stmt(_stream_sth);
    _stream_sth = NULL;  
  }

  va_list    ap;
  va_start(ap, fmt);
  _stream_sth = _stream_database->prepare_fetch_sql(sql, fmt, ap);
  va_end(ap);
}


void MQDB::DBStream::prepare_sql(const char* sql, const char* fmt, va_list ap) {
  if(_stream_database == NULL) { return; } 
  if(_stream_sth!=NULL) {
    _stream_database->finalize_stmt(_stream_sth);
    _stream_sth = NULL;  
  }
  _stream_sth = _stream_database->prepare_fetch_sql(sql, fmt, ap);
}


/******************************************* 
*  next_in_stream
*
*  Description: gets the next object in the stream. If the stream is empty it return undef.
*  Returntype : instance of the defined DBStream::stream_class, or undef
*  Exceptions : none
*  Example    :  
*                my $stream = WorldKit::Person->stream_all_by_country_region($db, "USA", "wisconsin");
*                while(my $person = $stream->next_in_stream) { 
*                  //do something
*                }
*******************************************/

DBObject* 
MQDB::DBStream::next_in_stream() {
  map<string, dynadata>   row_map;
  DBObject                *obj;

  if(_stream_database == NULL) { return NULL; } 
  if(_stream_sth == NULL) { return NULL; }
  if(_createFunc == NULL) { return NULL; }

  if(!_stream_database->fetch_next_row_map(_stream_sth, row_map)) {
    _stream_sth = NULL; //no need to finalize since it is taken care of internally
    return NULL; 
  }

  //use the other database here for lazy load later
  obj = _createFunc(row_map, _database);  
  obj->database(_database); 
  return obj;
}


/******************************************* 
*  as_array
*
*  Description: instantiates all remaining instances in the stream and returns them as an array
*  Returntype : reference to array of instances of the defined class of this stream
*  Exceptions : none
*  
*******************************************/

vector <DBObject*>
MQDB::DBStream::as_array() {
  vector <DBObject*>  obj_array;
  while(DBObject* obj = next_in_stream()) {
    obj_array.push_back(obj);
  }
  return obj_array;
}





