/* $Id: DBStream.h,v 1.27 2013/04/08 05:44:45 severin Exp $ */

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


#ifndef _MQDB_DBSTREAM_H
#define _MQDB_DBSTREAM_H


#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <MQDB/DBObject.h>
#include <MQDB/Database.h>
using namespace std;

namespace MQDB {


class DBStream : public DBObject {
  public:  //global class level
    static const char*  class_name;
    
  protected:
    void*        _stream_sth;
    Database*    _stream_database;

  public:
    DBStream();               // constructor
   ~DBStream();               // destructor
    void init();              // initialization method

    Database*  database();
    Database*  database(Database* db);
    void       class_create(DBObject* (*createFunc)(map<string, dynadata> &row_map, Database* db));
  
    void prepare_sql(const char* sql);
    void prepare_sql(const char* sql, const char* fmt, ...);
    void prepare_sql(const char* sql, const char* fmt, va_list ap);

    DBObject*             next_in_stream();
    vector <DBObject*>    as_array();

  private:
    static bool   _db_should_use_result;
    DBObject*   (*_createFunc)(map<string, dynadata> &row_map, Database* db);
    
  public:
    /* set_stream_useresult_behaviour

      Description  : sets a global behaviour for all DBStreams.  
                     setting use_result to "on" will leave the results on the database and
                     will keep the database connection open durring streaming.  
                     Both methods have similar speed performance, but keeping the results 
                     on the database server means the client uses essentially no memory.
                     The risk of turning this on is that the the database connection remains open
                     and there is risk of it timing out if processing takes a long time to stream all data.
                     When turned off, the entire result set is transfered in bulk to the driver (DBD::mysql)
                     and streaming happens from the underlying driver code and the perl code layer.
                     Default is "off" since this is safer but one risks needing lots of memory on the client.
      Parameter[1] : bool true/false: "true" turns the use_result on and keeps the database connection open
      Returntype   : none
      Exceptions   : none
      Example      : MQDB::DBStream->set_stream_useresult_behaviour(1);

    */
    static bool set_stream_useresult_behaviour(bool mode) {      
      _db_should_use_result = mode;
      return _db_should_use_result;
    }

};


};   //namespace

#endif


