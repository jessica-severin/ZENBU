/* $Id: Database.h,v 1.91 2019/08/01 01:19:15 severin Exp $ */

/***
NAME - MQDB::Database
 
DESCRIPTION
 
Generalized handle on an DBI database handle. Used to provide
an instance which holds connection information and allows
a higher level get_connection/ disconnect logic that persists
above the specific DBI connections. Also provides a real object
for use with the rest of the toolkit.
 
SUMMARY

MQDB::Database provides the foundation of the MappedQuery system.  
Databases are primarily specified with a URL format.
The URL format includes specification of a driver so this single
method can select among the supported DBD drivers.  Currently the
system supports MYSQL, Oracle, and SQLite.
The URL also allows the system to provide the foundation for doing
federation of persisted objects.  Each DBObject contains a pointer
to the Database instance where it is stored.  With the database URL
and internal database ID, each object is defined in a global space.

Attributes of MQDB::Database
  driver   :  mysql, oracle, sqlite (default mysql)
  user     :  username if the database requires
  password :  password if the database requires
  host     :  hostname of the database server machine 
  port     :  IP port of the database if required 
              (mysql default is 3306)
  dbname   :  database/schema name on the database server
              for sqlite, this is the database file

Example URLS
  mysql://<user>:<pass>@<host>:<port>/<database_name>
  mysql://<host>:<port>/<database_name>
  mysql://<user>@<host>:<port>/<database_name>
  mysql://<host>/<database_name>
  oracle://<user>:<pass>@/<database_name>
  oracle://<user>:<pass>@<host>:<port>/<database_name>
  sqlite:///<database_file> 


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


#ifndef _MQDB_DATABASE_H 
#define _MQDB_DATABASE_H 


#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <iostream>
#include <sstream>
#include <openssl/sha.h>
#include <boost/algorithm/string/replace.hpp>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>

#include <sqlite3.h>
#include <mysql.h>

using namespace std;

namespace MQDB {

//
// general MQDB functions
//
string   uuid_b64string();
string   uuid_hexstring();
string   html_escape(string data);
string   unescape_html(string data);
void     urldecode(string &data);
string   l_to_string(long value);
string   d_to_string(double value);
time_t   seconds_from_epoch(const std::string& s);
void     unparse_dbid(string dbid, string &uuid, long int &objID, string &objClass);
string   to_hex(unsigned char s);
string   sha256(string line);
string   sha512(string line);
void     process_mem_usage(double& vm_usage, double& resident_set);
string   exec_result(string cmd);

  
// dynadata
typedef enum { UNDEF, STRING, CHAR, INT, INT64, FLOAT, DOUBLE, DATE, TIMESTAMP, BLOB } dynadata_type;
class dynadata  {
  public:
    dynadata_type    type;
    string           colname;
    long long int    i_int64;
    double           i_double;
    float            i_float;
    long int         i_int;
    time_t           i_timestamp;
    string           i_date;
    string           i_string;
    char             i_char;
    void*            i_blob; //for a malloced block
  public:
    dynadata();                    // constructor
   ~dynadata();                    // destructor
    string    to_string();
    string    display_desc();

};

class Database {
  public:
    Database();                    // constructor
    Database(string url, ...);     // constructor from URL and options
   ~Database();                    // destructor

    Database*  copy();        // Shallow copy 
     
    void         retain();
    void         release();
    long int     retain_count() { return _retain_count; }
    void         persistent(bool value);

    //string      display_desc();
    //void        display_info();

    bool   get_connection();
    void   disconnect();
    int    disconnect_count();


    string       driver();
    string       host();
    int          port();
    string       user();
    string       password();
    string       dbname();
    const char*  uuid();
    const char*  uuid(const char* uuid);
    long int     last_insert_id() { return _last_insert_id; }


    //to reset user/password
    void         user(string value);
    void         password(string value);

    string full_url();
    string url();
    string public_url();
    string xml();
    string alias();
    string alias(string name);

    void* prepare_fetch_sql(const char* sql);
    void* prepare_fetch_sql(const char* sql, const char* fmt, ...);
    void* prepare_fetch_sql(const char* sql, const char* fmt, va_list ap);
    bool fetch_next_row_map(void* stmt, map<string, dynadata> &row_map);
    bool fetch_next_row_vector(void* stmt, vector<dynadata> &row_vector);
    void finalize_stmt(void* stmt);

    void do_sql(const char* sql);
    void do_sql(const char* sql, const char* fmt, ...);

    dynadata fetch_col_value(const char* sql);
    dynadata fetch_col_value(const char* sql, const char* fmt, ...);

  protected:
    string       _driver;
    string       _host;
    int          _port;
    string       _user;
    string       _password;
    string       _dbname;
    const char*  _uuid;
    long int     _last_insert_id;
    bool         _persistent;

  protected:
    void     init();        // initialization method which subclasses can extend
    void     init_from_url(string url, ...);

    string          _short_url;
    int             _disconnect_count;
    string          _alias;
    void*           _dbc;
    long int        _retain_count;
    
    void* sqlite_prepare_fetch_sql(const char* sql, const char* fmt, va_list ap);
    void* mysql_prepare_fetch_sql(const char* sql, const char* fmt, va_list ap);

    bool sqlite_fetch_next_row_map(void* stmt, map<string, dynadata> &row_map);
    bool mysql_fetch_next_row_map(void* stmt, map<string, dynadata> &row_map);

    bool sqlite_fetch_next_row_vector(void* stmt, vector<dynadata> &row_vector);
    bool mysql_fetch_next_row_vector(void* stmt, vector<dynadata> &row_vector);

    void sqlite_do_sql(const char* sql, const char* fmt, va_list ap);
    void sqlite_do_sql(const char* sql);
    void mysql_do_sql(const char* sql, const char* fmt, va_list ap);

    dynadata sqlite_fetch_col_value(const char* sql, const char* fmt, va_list ap);
    dynadata mysql_fetch_col_value(const char* sql, const char* fmt, va_list ap);

};

};   //namespace


/* new MQDB::Database(url, ...)

  Description: primary instance creation method
  Parameter  : a string in URL format
  Returntype : instance of MQDB::Database
  Examples   : MQDB::Database db = new MQDB::Database("mysql://<user>:<pass>@<host>:<port>/<database_name>");
               e.g. mysql://<host>:<port>/<database_name>
               e.g. mysql://<user>@<host>:<port>/<database_name>
               e.g. mysql://<host>/<database_name>
               e.g. sqlite:///<database_file> 
  Exceptions : none

*/

/* get_connection

  Description: connects to database and returns a DBI connection
  Returntype : bool if connect was established
  Exceptions : none

*/


/* disconnect

  Description: disconnects handle from database, but retains object and 
               all information so that it can be reconnected again 
               at a later time.
  Returntype : none
  Exceptions : none

*/


/* full_url

  Description: returns the URL of this database with user and password
  Returntype : string
  Exceptions : none

*/

/* url

  Description: returns URL of this database but without user:password
               used for global referencing and federation systems
  Returntype : string
  Exceptions : none

*/


/* xml

  Description: returns XML of this database but without user:password
               used for global referencing and federation systems
  Returntype : string
  Exceptions : none

*/

/* execute_sql

  Description    : executes SQL statement with external parameters and placeholders
  Example        : $db->execute_sql("insert into table1(id, value) values(?,?)", $id, $value);
  Parameter[1]   : sql statement string
  Parameter[2..] : optional parameters for the SQL statement
  Returntype     : none
  Exceptions     : none

*/

/* do_sql

  Description    : executes SQL statement with "do" and no external parameters. 
                   does not prepare a statement for data retrieval.
                   useful for INSERT, DELETE, UPDATE type commands
  Example        : $db->do_sql("insert into table1(id, value) values(null,'hello world');");
  Parameter      : sql statement string with no external parameters
  Returntype     : none
  Exceptions     : none

*/

/* fetch_col_value

  Arg (1)    : $sql (string of SQL statement with place holders)
  Arg (2...) : optional parameters to map to the placehodlers within the SQL
  Example    : $value = $self->fetch_col_value($db, "select some_column from my_table where id=?", $id);
  Description: General purpose function to allow fetching of a single column from a single row.
  Returntype : scalar value
  Exceptions : none
  Caller     : within subclasses to easy development

*/

#endif
