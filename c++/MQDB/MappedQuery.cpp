/* $Id: MappedQuery.cpp,v 1.34 2013/04/08 05:44:45 severin Exp $ */

/****

NAME

MQDB::MappedQuery - DESCRIPTION of Object

SYNOPSIS

An Object_relational_mapping (ORM) design pattern based on mapping 
named_column results from any query into attributes of an object.
As long as the column_names are parsable into attributes, any query is ok.
This is an evolution of several ideas I have either used or created over 
the last 15 years of coding.  This is a variation on the ActiveRecord design 
pattern but it trades more  flexibility, power and control for slightly 
less automation.  It still provides a development speed/ease advange 
over many ORM patterns.

DESCRIPTION

MappedQuery is an abstract superclass that is a variation on the
ActiveRecord design pattern.  Instead of actively mapping
a table into an object, this will actively map the result of
a query into an object.  The query is standardized for a subclass
of this object, and the columns returned by the query define
the attributes of the object.  This gives much more flexibility 
than the standard implementation of ActiveRecord.  Since this
design pattern is based around mapping a query (from potentially a
multiple table join) to a single class object, this pattern is
called MappedQuery.

In this particular implementation of this design pattern
(mainly due to some limitations in perl) several aspects
must be hand coded as part of the implementation of a 
subclass.  Subclasses must handcode
- all accessor methods
- override the create(row_map) method 
- APIs for all explicit fetch methods 
  (by using the superclass fetch_single and fetch_multiple)
- the store methods are coded by general DBI code (no framework assistance)

Individual MQDB::Database handle objects are assigned at an instance level
for each object. This is different from some ActiveRecord implementations 
which place database handles into a global context or at the Class level.
By placing it with each instance, this allows creation of instances of the
same class pulled from two different databases, but with similar schemas.
This is very useful when building certain types of data analysis systems.

The only restriction is that the database handle must be able run the 
queries that the object requires for it to work.

Future implementations could do more automatic code generation
but this version already speeds development time by 2x-3x
without imposing any limitations and retains all the flexibility
of handcoding with DBI.

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

***/

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <MQDB/DBStream.h>
#include <MQDB/MappedQuery.h>
#include <sqlite3.h>
#include <stdarg.h>
//#include <boost/algorithm/string.hpp>

using namespace std;
using namespace MQDB;

const char*  MQDB::MappedQuery::class_name = "MQDB::MappedQuery";


//////////////////////////////////////////////////////////////////////////////////////////////////
// Subclass must override these methods
//////////////////////////////////////////////////////////////////////////////////////////////////

MQDB::MappedQuery::MappedQuery() {
  init();
}


void MQDB::MappedQuery::init() {
  MQDB::DBObject::init();
  _classname     = MQDB::MappedQuery::class_name;
}

/* store

  Description: This method is just an empty template as part of the API definition.
               How it is defined, and how parameters are handled are completely up to each
               subclass.  Each subclass should override and implement.
  Returntype : $self
  Exceptions : none
  Caller     : general loader scripts

*/

void store() {
  fprintf(stderr, "store must be implemented by subclass");
  exit(1);
}


/* init_from_row_map
  Description: This method must be overridden by subclasses to do the mapping of columns 
               from the query response into attributes of the object.  This is part of the
               internal factory machinery. The instance of the class is created before this method is
               called and the default init() method has already been called.  The purpose of this
               method is to initialize the rest of the state of the instance based on the row_map data
*/

void  MQDB::MappedQuery::init_from_row_map(map<string, dynadata> &row_map) {
  //should by implemented by subclass to map columns into instance variables
  fprintf(stderr, "init_from_row_map must be implemented by subclass [%s]", _classname);
}



/**************  Factory functions *************************************************/


/******************************************* 
  fetch_single

  Description: General purpose template function for fetching a single instance
               of this class(subclass) using the create(row_map, database) method to convert
               a row of data into an object.
  Arg (1)    : $database (MQDB::Database)
  Arg (2)    : $sql (string of SQL statement with place holders)
  Arg (3...) : optional parameters to map to the placehodlers within the SQL
  Returntype : instance of this Class (subclass)
  Exceptions : none
  Caller     : subclasses (not public methods)
  Example    : 
                  sub fetch_by_id {
                      my $class = shift;
                      my $db = shift;
                      my $id = shift;
                      my $sql = "SELECT * FROM symbol WHERE symbol_id=?";
                      return $class->fetch_single($db, $sql, $id);
                  }


*******************************************/

DBObject* 
MQDB::fetch_single(DBObject* (*createFunc)(map<string, dynadata> &row_map, MQDB::Database* db), 
                   MQDB::Database *db, const char* sql, const char* fmt, ...)
{
  va_list                 ap;
  map<string, dynadata>   row_map;
  void                    *stmt;
  DBObject                *obj;

  if(db == NULL) { return NULL; }
  //if(!(db->get_connection)) { printf STDERR "error with connection on query %s", sql; return NULL; }
  va_start(ap, fmt);
  stmt = db->prepare_fetch_sql(sql, fmt, ap);
  va_end(ap);
  db->fetch_next_row_map(stmt, row_map);
  if(row_map.empty()) { return NULL; }

  obj = createFunc(row_map, db);
  db->finalize_stmt(stmt);
  return obj;
}



/******************************************* 
  fetch_multiple

  Description: General purpose template function for fetching an array of instance
               of this class(subclass) using the create(row_map, database) method to convert
               a row of data into an object.
  Arg (1)    : $database (MQDB::Database)
  Arg (2)    : $sql (string of SQL statement with place holders)
  Arg (3...) : optional parameters to map to the placehodlers within the SQL
  Returntype : array of all instances of this Class (subclass) which match the query
  Exceptions : none
  Caller     : subclasses (not public methods)
  Example    : 
                  sub fetch_all_by_value {
                      my $class = shift;
                      my $db = shift;
                      my $name = shift;
                      my $sql = "SELECT * FROM symbol WHERE sym_value=?";
                      return $class->fetch_multiple($db, $sql, $name);
                  }

*******************************************/ 

vector<DBObject*> 
MQDB::fetch_multiple(DBObject* (*createFunc)(map<string, dynadata> &row_map, Database* db), 
                     Database *db, const char* sql, const char* fmt, ...)
{
  va_list                 ap;
  map<string, dynadata>   row_map;
  vector<DBObject*>       result;
  DBObject                *obj;
  void                    *stmt;

  if(db == NULL) { return result; }
  //if(!(db->get_connection)) { printf STDERR "error with connection on query %s", sql; return result; }
  va_start(ap, fmt);
  stmt = db->prepare_fetch_sql(sql, fmt, ap);
  va_end(ap);

  while(db->fetch_next_row_map(stmt, row_map)) {
    obj = createFunc(row_map, db);
    if(obj != NULL) { result.push_back(obj); }
  }
  return result;
}



/******************************************* 
  stream_multiple

  Description: General purpose template function for fetching multiple instance
               of this class(subclass) using the create(row_map, database) method to convert
               a row of data into an object. Instead of instantiating all
               instance at once and returning as array, this method returns
               a DBStream instance which then creates each instance from an
               open handle on each $stream->next_in_stream() call.
  Arg (1)    : $database (MQDB::Database)
  Arg (2)    : $sql (string of SQL statement with place holders)
  Arg (3...) : optional parameters to map to the placehodlers within the SQL
  Returntype : DBStream object
  Exceptions : none
  Caller     : subclasses use this internally when creating new API stream_by....() methods
  Example    :
                  sub stream_by_value {
                      my $class = shift;
                      my $db = shift;
                      my $name = shift;
                      my $sql = "SELECT * FROM symbol WHERE sym_value=?";
                      return $class->stream_multiple($db, $sql, $name);
                  }
                  
*******************************************/ 

MQDB::DBStream* 
MQDB::stream_multiple(DBObject* (*createFunc)(map<string, dynadata> &row_map, Database* db), 
                      Database *db, const char* sql, const char* fmt, ...)
{
  va_list  ap;
  va_start(ap, fmt);

  MQDB::DBStream* stream = new MQDB::DBStream;
  
  if(db == NULL) { return stream; }
  stream->database(db);
  stream->class_create(createFunc);
  stream->prepare_sql(sql, fmt, ap);
  va_end(ap);
  return stream;
}








