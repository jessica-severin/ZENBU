/* Id: Database.cpp,v 1.48 2010/05/10 03:52:51 severin Exp  */

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
  driver   :  mysql, sqlite (default mysql)
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

***/
#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sstream>
#include <fstream>
#include <sqlite3.h>
#include <stdarg.h>
#include <unistd.h>
#include <ios>
#include <string>

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_io.hpp>

#include <boost/date_time.hpp>
namespace bt = boost::posix_time;

#include <MQDB/Database.h>


using namespace std;
using namespace MQDB;


MQDB::dynadata::dynadata() {
  type        = UNDEF;
  i_blob      = NULL;
  i_int64     = 0;
  i_double    = 0.0;
  i_float     = 0.0;
  i_int       = 0;
  i_timestamp = 0;
  i_char      = '\0';  
}

MQDB::dynadata::~dynadata() {
  if((type == BLOB) and (i_blob != NULL)) {
    //fprintf(stderr, "dynadata free blob\n");
    free(i_blob);
    i_blob = NULL;
  }
}

string MQDB::dynadata::to_string() {
  string value;
  char t_buf[1024];

  switch(type) {
    case INT:
      sprintf(t_buf,"%ld",i_int);
      value = t_buf;
      break;

    case FLOAT:
      sprintf(t_buf,"%g",i_float);
      value = t_buf;
      break;
      
    case DOUBLE:
      sprintf(t_buf,"%g",i_double);
      value = t_buf;
      break;

    case STRING:
      value = i_string;
      break;

    case CHAR:
      value = i_char;
      break;

    case TIMESTAMP:
      value = ctime(&i_timestamp);
      value.resize(value.size()-1); //remove \n
      break;
      
    default: break;
  }
  return value;
}

string MQDB::dynadata::display_desc() {
  string value;
  value = "dynadata(";
  switch(type) {
    case INT:       value +="INT"; break;
    case FLOAT:     value +="FLOAT"; break;
    case DOUBLE:    value +="DOUBLE"; break;
    case STRING:    value +="STRING"; break;
    case CHAR:      value +="CHAR"; break;
    case TIMESTAMP: value +="TIMESTAMP"; break;
    default: break;
  }
  value += ") ["+ to_string() +"]";
  return value;
}


/*****************************************************************************
* MysqlStmt
*
* mysql needs to manage several data elements on the client side for 
* each statement prepare.  This class will be hidden to users.
* This is the statement returned when connecting to mysql and is what is
* passed into fetch_next_row_map(). 
* The user just needs a treat as a void* stmt
*
******************************************************************************/

namespace MQDB {
class MysqlStmt {
  public:
    MYSQL_STMT       *ppStmt;
    MYSQL_RES        *result_metadata;
    MYSQL_FIELD      *fields;
    int              num_fields;
    MYSQL_BIND       *result_bind;
    my_bool          *result_is_null;
       
    MysqlStmt(MYSQL_STMT *stmt) {
      init();
      ppStmt = stmt;
      _init_statement();
    }
    
    ~MysqlStmt() {
      //printf("delete MysqlStmt\n");
      if(result_is_null != NULL) { free(result_is_null); }
      if(result_bind != NULL) { 
        for(int i = 0; i < num_fields; i++) {
          if(result_bind[i].buffer != NULL) {
            free(result_bind[i].buffer);
          }
          if(result_bind[i].length != NULL) {
            free(result_bind[i].length);
          }

        }
        free(result_bind); 
      }
      mysql_free_result(result_metadata);
      mysql_stmt_close(ppStmt);
    }
    
  private:
    void init() {
      ppStmt = NULL;
      result_metadata = NULL;
      fields = NULL;
      num_fields = 0;
      result_bind = NULL;
      result_is_null = NULL;
    }

    void _init_statement() {
      if(ppStmt == NULL) { return; }
      //prepare the output result set if it exists
      result_metadata = mysql_stmt_result_metadata(ppStmt);
      if(result_metadata) {
        num_fields = mysql_num_fields(result_metadata);      
        if(num_fields > 0) { _bind_result(); }
      }
    }
      
    void _bind_result() {
      fields = mysql_fetch_fields(result_metadata);  

      result_bind = (MYSQL_BIND*)malloc(num_fields * sizeof(MYSQL_BIND));
      bzero(result_bind, num_fields * sizeof(MYSQL_BIND));

      result_is_null = (my_bool*)malloc(num_fields * sizeof(my_bool));      
      bzero(result_is_null, num_fields * sizeof(my_bool));

      //fprintf(stderr, "mysql stmt has [%d] fields\n", num_fields);
      for(int i = 0; i < num_fields; i++) {
        //fprintf(stderr,"  [%d] : %s\n", i, fields[i].name);
        result_bind[i].buffer_type = MYSQL_TYPE_NULL;
        result_bind[i].buffer      = NULL;
        result_bind[i].is_null     = &(result_is_null[i]);
        result_bind[i].length      = NULL;

        switch (fields[i].type) {
          case MYSQL_TYPE_TINY:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(4); //really 1 byte
            bzero(result_bind[i].buffer, 4);
            break;
          case MYSQL_TYPE_SHORT:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(short));
            bzero(result_bind[i].buffer, sizeof(short));
            break;
          case MYSQL_TYPE_LONG:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(long));
            bzero(result_bind[i].buffer, sizeof(long));
            break;
          case MYSQL_TYPE_INT24:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(long));
            bzero(result_bind[i].buffer, sizeof(long));
            break;
          case MYSQL_TYPE_LONGLONG:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(long long));
            bzero(result_bind[i].buffer, sizeof(long long));
            break;
          case MYSQL_TYPE_DECIMAL:
            break;
          case MYSQL_TYPE_NEWDECIMAL:
            break;
          case MYSQL_TYPE_FLOAT:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(float));
            bzero(result_bind[i].buffer, sizeof(float));
            break;
          case MYSQL_TYPE_DOUBLE:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(double));
            bzero(result_bind[i].buffer, sizeof(double));
            break;
          case MYSQL_TYPE_BIT:
            break;
          case MYSQL_TYPE_TIMESTAMP:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(MYSQL_TIME));
            bzero(result_bind[i].buffer, sizeof(MYSQL_TIME));
            break;
          case MYSQL_TYPE_DATE:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(MYSQL_TIME));
            bzero(result_bind[i].buffer, sizeof(MYSQL_TIME));
            break;
          case MYSQL_TYPE_TIME:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(MYSQL_TIME));
            bzero(result_bind[i].buffer, sizeof(MYSQL_TIME));
            break;
          case MYSQL_TYPE_DATETIME:
            result_bind[i].buffer_type = fields[i].type;
            result_bind[i].buffer      = (void*)malloc(sizeof(MYSQL_TIME));
            bzero(result_bind[i].buffer, sizeof(MYSQL_TIME));
            break;
          case MYSQL_TYPE_YEAR:
            break;
          case MYSQL_TYPE_STRING:
            result_bind[i].buffer_type   = fields[i].type;
            result_bind[i].buffer_length = 1024;
            result_bind[i].buffer        = (void*)calloc(1024,1);
            result_bind[i].length        = (long unsigned int*)(calloc(sizeof(long unsigned int), 1));
            break;
          case MYSQL_TYPE_VAR_STRING: //longtext is 4GB, mediumtext is 16MB. use 64MB as compromise
            result_bind[i].buffer_type   = fields[i].type;
            result_bind[i].buffer_length = 64*1024*1024; //max 64MB
            result_bind[i].buffer        = (void*)calloc(64*1024*1024 +2, 1);
            result_bind[i].length        = (long unsigned int*)(calloc(sizeof(long unsigned int), 1));
           break;
          case MYSQL_TYPE_BLOB:  //medium blob is 16MB max, LONGBLOB is 4GB
            result_bind[i].buffer_type   = fields[i].type;
            result_bind[i].buffer_length = 64*1024*1024;
            result_bind[i].buffer        = (void*)calloc(64*1024*1024 +2, 1);
            result_bind[i].length        = (long unsigned int*)(calloc(sizeof(long unsigned int), 1));
            break;
          case MYSQL_TYPE_SET:
            break;
          case MYSQL_TYPE_ENUM:
            break;
          case MYSQL_TYPE_GEOMETRY:
            break;
          case MYSQL_TYPE_NULL:
            break;
          default:
            break;
        }
      }
      if(mysql_stmt_bind_result(ppStmt, result_bind)) {
        fprintf(stderr, "Failed to bind mysql result Error: %s\n", mysql_stmt_error(ppStmt));
        mysql_stmt_close(ppStmt);
        ppStmt = NULL;
        //delete stmt;
        //return NULL;
      }
    }
};
};


//
//================================================================================
//

/* new

  Description: instance creation method
  Returntype : instance of this Class (subclass)
  Exceptions : none

*/

MQDB::Database::Database() {
  //fprintf(stderr, "MQDB::Database new %ld\n", (long)this);  
  init();
}

MQDB::Database::Database(string url, ...) {
  //fprintf(stderr, "MQDB::Database new %s %ld\n", url.c_str(), (long)this);
  init_from_url(url);
}

MQDB::Database::~Database() {
  // destructor
  //fprintf(stderr, "MQDB::Database destroy %ld : %s\n", (long)this, url().c_str());
  disconnect();
}


void MQDB::Database::init() {
  _uuid             = NULL;  //initially not set

  _driver           = "";
  _port             = 3306;  //mysql default
  _last_insert_id   = -1;
  
  _disconnect_count = 0;
  _dbc              = NULL;
  _retain_count     = 1;
  _persistent       = true;
}


void MQDB::Database::retain() {
  _retain_count++;
  //fprintf(stderr, "database %ld retain(%ld)\n", (long)this, _retain_count);
}


void MQDB::Database::release() {
  _retain_count--;
  //fprintf(stderr, "database %ld release(%ld)\n", (long)this, _retain_count);
  if(_persistent) { return; }
  if(_retain_count == 0) { 
    disconnect();
    delete this; 
  }
}


void  MQDB::Database::persistent(bool value) {
  _persistent = value;
}


/* init_from_url

  Description: primary instance creation method
  Parameter  : a string in URL format
  Returntype : instance of MQDB::Database
  Examples   : my db = MQDB::Database->new_from_url("mysql://<user>:<pass>@<host>:<port>/<database_name>");
               e.g. mysql://<user>:<pass>@<host>:<port>/<database_name>
               e.g. mysql://<host>:<port>/<database_name>
               e.g. mysql://<user>@<host>:<port>/<database_name>
               e.g. mysql://<host:<prt>>/<database_name>
               e.g. mysql://<host>/<database_name>
               e.g. sqlite:///<database_file> 
  my class = shift;
  Exceptions : none

*/

void MQDB::Database::init_from_url(string url, ...) {  
  string t_driver, t_user, t_host, t_pass, t_dbname, t_conn, t_params, t_path;
  int t_port = -1;
  string t_hostport, t_userpass;
  size_t  p1, p2, p3;
  
  init();
  if(url.empty()) { return; }

  //if(optionsuser)     { user = optionsuser; }
  //if(optionspassword) { pass = optionspassword; }

  //cout << "FETCH [" << url << "]\n";
  
  p1 = url.find("://");
  if(p1==string::npos) { return; }
  
  t_driver = url.substr(0, p1);
  url      = url.substr(p1+3);
  //cout << "db_url=" << url << "\n";

  p1 = url.find("/");
  if(p1==string::npos) { return; }

  t_conn   = url.substr(0, p1);
  t_dbname = url.substr(p1+1);
  if((p2=t_dbname.find(";")) != string::npos) {
    t_params = t_dbname.substr(p2+1);
    t_dbname = t_dbname.substr(0, p2);
  }
  if(((t_driver.compare("mysql")==0) or (t_driver.compare("oracle")==0)) and ((p2=t_dbname.find("/")) != string::npos)) {
    t_path   = t_dbname.substr(p2+1);
    t_dbname = t_dbname.substr(0, p2);
  }
  while(!t_params.empty()) {
    string t_token = t_params;
    if((p2=t_params.rfind(";")) != string::npos) {
      t_token  = t_params.substr(0, p2);
      t_params = t_params.substr(p2+1);
    } else { t_params.clear(); }
    
    //if(token =~ /type=(.*)/) {
    //  type = 1;
    //}
    //if(token =~ /discon=(.*)/) {
    //  discon = 1;
    //}
    //if(token =~ /species=(.*)/) {
    //  species = 1;
    //}
  }
  //species=t_host . "_" . t_dbname unless(defined(species));
  //print("  conn=conn\n  dbname=t_dbname\n  path=path\n");

  if((p1=t_conn.find("@")) != string::npos) {
    t_userpass = t_conn.substr(0, p1);
    t_hostport = t_conn.substr(p1+1);

    if((p2 = t_userpass.find(":")) != string::npos) {
      if(t_user.empty()) {
        t_user = t_userpass.substr(0, p2);
      }
      if(t_pass.empty()) {
        t_pass = t_userpass.substr(p2+1);
      }
    } else if(!t_userpass.empty() and t_user.empty()) { t_user = t_userpass; }
  }
  else {
    t_hostport = t_conn;
  }
  if((p3 = t_hostport.find(":")) != string::npos) {
    t_port = atoi(t_hostport.substr(p3+1).c_str()) ;
    t_host = t_hostport.substr(0, p3);
  } else { t_host=t_hostport; }  

  _uuid = NULL;
  
  if(t_driver.compare("sqlite")==0) { t_port=-1; t_host=""; t_user=""; t_pass=""; }
  if(t_driver.compare("mysql")==0) { 
    if(t_port==-1) { t_port=3306; }
  }
  _driver   = t_driver;
  _host     = t_host;
  _port     = t_port;
  _dbname   = t_dbname;
  _user     = t_user;
  _password = t_pass;
  if(t_driver.compare("sqlite")==0) { 
    _dbname = "/";
    _dbname.append(t_dbname);
  }

}


/* copy

  Description: makes a copy of the database configuration.
               New instance will have its own database connection 
  Returntype : instance of MQDB::Database

*/

MQDB::Database* MQDB::Database::copy() {
  MQDB::Database  *mycopy = new MQDB::Database();
  
  mycopy->_uuid     = _uuid;
  mycopy->_driver   = _driver;
  mycopy->_host     = _host;
  mycopy->_port     = _port;
  mycopy->_user     = _user;
  mycopy->_password = _password;
  mycopy->_dbname   = _dbname;

  //fprintf(stderr, "MQDB::Database copy %ld -> %ld\n", (long)this, (long)mycopy);  
  return mycopy;
}


/* get_connection

  Description: connects to database and returns true if successful
  Returntype : bool
  Exceptions : none

*/

bool MQDB::Database::get_connection() {

  if(_driver == "mysql") {
    if(_dbc == NULL) {
      MYSQL *mysql;
      mysql = mysql_init(NULL);
      unsigned int  tout = 1;
      mysql_options(mysql, MYSQL_OPT_CONNECT_TIMEOUT, (const char*)&tout);
      //mysql_options(mysql, MYSQL_OPT_READ_TIMEOUT, &tout);
      if(!mysql_real_connect(mysql,_host.c_str(),_user.c_str(),_password.c_str(),_dbname.c_str(),_port,NULL,0)) {
        fprintf(stderr, "Failed to connect to database [%s %d %s]: Error: %s\n", _host.c_str(), _port, _dbname.c_str(), mysql_error(mysql));
        mysql_close(mysql);
      } else {
        _dbc = mysql;
      }
    }
  } 

  if(_driver == "sqlite") {
    if(_dbc == NULL) {
      sqlite3 *db;
      int retry=5;
      int rc = sqlite3_open(_dbname.c_str(), &db);
      while(rc && (retry>0)) {
        fprintf(stderr, "SQLITE Can't open database [%s]: %s\n", _dbname.c_str(), sqlite3_errmsg(db));
        sqlite3_close(db);
        //should sleep a bit
        retry--;
        rc = sqlite3_open(_dbname.c_str(), &db);
      }
      if(!rc && (retry!=5)) {
        fprintf(stderr, "SQLITE [%s] opened on retry %d\n", _dbname.c_str(), 5-retry);
      }
      if(!rc){ _dbc = db; }
    }
  } 
  
  if(_dbc!=NULL) { return true; }
  else { return false; }
}


/* disconnect

  Description: disconnects handle from database, but retains object and 
               all information so that it can be quickly reconnected again 
               at a later time.
  Returntype : none
  Exceptions : none

*/

void MQDB::Database::disconnect() {
  if(_dbc == NULL) { return; }
    
  if(_driver == "mysql") {
    mysql_close((MYSQL*) _dbc);
  }
    
  if(_driver == "sqlite") {
    sqlite3_close((sqlite3*) _dbc);
  } 
  
  _disconnect_count++;
  _dbc = NULL;
  //printf("DISCONNECT\n");
  
  return;
}



//********************************************
// attribute access methods 
//********************************************

string      MQDB::Database::driver() { return _driver; }
string      MQDB::Database::host() { return _host; }
int         MQDB::Database::port() { return _port; }
string      MQDB::Database::user() { return _user; }
string      MQDB::Database::password() { return _password; }
string      MQDB::Database::dbname() { return _dbname; }
const char* MQDB::Database::uuid() { return _uuid; }

void        MQDB::Database::user(string value) { _user = value; }
void        MQDB::Database::password(string value) { _password = value; }

/* uuid

  Description: the worldwide unique identifier for the database where this object resides.
  Returntype : UUID string or ""
  Exceptions : none

*/

const char* MQDB::Database::uuid(const char* value) {
  _uuid = value;
  return _uuid;
}


int MQDB::Database::disconnect_count() { return _disconnect_count; }

/* full_url

  Description: returns the URL of this database with user and password
  Returntype : string
  Exceptions : none

*/

string MQDB::Database::full_url() {
  string url = _driver + "://";
  if(!_host.empty()) {
    if(!_user.empty()) {
      url += _user;
      if(!_password.empty()) { url += ":"; url += _password; }
      url += "@";
    }
    url.append(_host);
    if(_port>=0) {
      char t_port[16];
      sprintf(t_port,"%d",_port);
      url.append(":").append(t_port); 
    }
  }
  if(!_dbname.empty()) {
    if(_dbname.c_str()[0] != '/') { url += "/"; }
    url.append(_dbname);
  }
  return url;
}

/* url

  Description: returns URL of this database but without user:password
               used for global referencing and federation systems
  Returntype : string
  Exceptions : none

*/

string MQDB::Database::url() {
  //no username or password in URL 
  if(!_short_url.empty()) { return _short_url; }

  _short_url = _driver + "://";
  if(!_host.empty()) {
    _short_url.append(_host);
    if(_port>=0) {
      char t_port[16];
      sprintf(t_port,"%d",_port);
      _short_url.append(":").append(t_port); 
    }
  }
  if(!_dbname.empty()) {
    if(_dbname.c_str()[0] != '/') { _short_url += "/"; }
    _short_url.append(_dbname);
  }
  return _short_url;
}


string MQDB::Database::public_url() {
  string url = _driver + "://";
  if(!_host.empty()) {
    url += "read:read@";
    url.append(_host);
    if(_port>=0) {
      char t_port[16];
      sprintf(t_port,"%d",_port);
      url.append(":").append(t_port); 
    }
  }
  if(!_dbname.empty()) {
    if(_dbname.c_str()[0] != '/') { url += "/"; }
    url.append(_dbname);
  }
  return url;
}

/* xml

  Description: returns XML of this database but without user:password
               used for global referencing and federation systems
  Returntype : string
  Exceptions : none

*/


string MQDB::Database::xml() {
  //no username or password in URL  
  
  string xml = "<database name=\"";
  xml.append(alias());
  xml.append("\" url=\"");
  xml.append(url());
  xml.append("\" ");
  if(_uuid != NULL) { xml.append("uuid=\"").append(_uuid).append("\" "); }
  xml.append("/>\n");             
  return xml;
}


string MQDB::Database::alias() {
  if(!_alias.empty()) { return _alias; }
  return _dbname;
}

string MQDB::Database::alias(string name) {  
  _alias = name;
  return _alias;
}


/**************************************************************************************************
*
* prepare_fetch_sql
*
*      Description    : executes SQL statement with external parameters and placeholders
*      Example        : $db->execute_sql("insert into table1(id, value) values(?,?)", $id, $value);
*      Parameter[1]   : sql statement string
*      Parameter[2..] : optional parameters for the SQL statement
*      Returntype     : none
*      Exceptions     : none
*
**************************************************************************************************/

//    map<string, dynadata> fetch_next_row_map();

void* MQDB::Database::prepare_fetch_sql(const char* sql) {
  if(!get_connection()) { return NULL; }
  if(_driver == "sqlite") {
    return sqlite_prepare_fetch_sql(sql, "", NULL);
  }
  if(_driver == "mysql") {
    return mysql_prepare_fetch_sql(sql, "", NULL);
  }
  return NULL;
}

void* MQDB::Database::prepare_fetch_sql(const char* sql, const char* fmt, ...) {
  if(!get_connection()) { return NULL; }
  va_list    ap;
  va_start(ap, fmt);
  if(_driver == "sqlite") {
    return sqlite_prepare_fetch_sql(sql, fmt, ap);
  }
  if(_driver == "mysql") {
    return mysql_prepare_fetch_sql(sql, fmt, ap);
  }
  va_end(ap);
  return NULL;
}

void* MQDB::Database::prepare_fetch_sql(const char* sql, const char* fmt, va_list ap) {
  if(!get_connection()) { return NULL; }
  if(_driver == "sqlite") {
    return sqlite_prepare_fetch_sql(sql, fmt, ap);
  }
  if(_driver == "mysql") {
    return mysql_prepare_fetch_sql(sql, fmt, ap);
  }
  return NULL;
}

/**************************************************************************************************
*
* fetch_next_row_map
*
*      Description    : returns the next row from the prepared statement into a 
*                       map of column_name to dynadata
*
**************************************************************************************************/

bool MQDB::Database::fetch_next_row_map(void* stmt, map<string, dynadata> &row_map) {
  if(_driver == "sqlite") {
    return sqlite_fetch_next_row_map(stmt, row_map);
  }
  if(_driver == "mysql") {
    return mysql_fetch_next_row_map(stmt, row_map);
  }
  return false;
}

bool MQDB::Database::fetch_next_row_vector(void* stmt, vector<dynadata> &row_vector) {
  if(_driver == "sqlite") {
    return sqlite_fetch_next_row_vector(stmt, row_vector);
  }
  if(_driver == "mysql") {
    return mysql_fetch_next_row_vector(stmt, row_vector);
  }
  return false;
}

void MQDB::Database::finalize_stmt(void* stmt) {
  if(stmt == NULL) { return; }
  if(_driver == "sqlite") {
    sqlite3_finalize((sqlite3_stmt*)stmt);
  }
  if(_driver == "mysql") {
    MQDB::MysqlStmt *t_stmt = (MQDB::MysqlStmt*)stmt;
    delete t_stmt;
  }
}

/**********************************************************************************************
*
* do_sql
*
*      Description    : executes SQL statement which does not expect returned data.
*                       does not prepare a statement for data retrieval.
*                       useful for INSERT, DELETE, UPDATE type commands
*      Example        : $db->do_sql("insert into table1(id, value) values(null,'hello world');");
*      Parameter      : sql statement string with no external parameters
*      Returntype     : none
*      Exceptions     : none
*
**********************************************************************************************/


void MQDB::Database::do_sql(const char* sql) {
  if(!get_connection()) { return; }
  if(_driver == "sqlite") {
    sqlite_do_sql(sql);
  }
  if(_driver == "mysql") {
    mysql_do_sql(sql, "", NULL);
  }
}

void MQDB::Database::do_sql(const char* sql, const char* fmt, ...) {
  if(!get_connection()) { return; }
  va_list    ap;
  va_start(ap, fmt);
  if(_driver == "sqlite") {
    sqlite_do_sql(sql, fmt, ap);
  }
  if(_driver == "mysql") {
    mysql_do_sql(sql, fmt, ap);
  }
  va_end(ap);
}

/**************************************************************************************************
*
* fetch_col_value
*
*   Arg (1)    : sql (string of SQL statement with place holders)
*   Arg (2...) : optional parameters to map to the placehodlers within the SQL
*   Example    : value = fetch_col_value(db, "select some_column from my_table where id=?", id);
*   Description: General purpose function to allow fetching of a single column from a single row.
*   Returntype : scalar value
*   Exceptions : none
*   Caller     : within subclasses to easy development
*
**************************************************************************************************/

dynadata MQDB::Database::fetch_col_value(const char* sql) {
  dynadata   value;

  if(!get_connection()) { return value; }
  if(_driver == "sqlite") {
    value= sqlite_fetch_col_value(sql, "", NULL);
  }
  if(_driver == "mysql") {
    value= mysql_fetch_col_value(sql, "", NULL);
  }
  return value;
}

dynadata MQDB::Database::fetch_col_value(const char* sql, const char* fmt, ...) {
  dynadata   value;
  va_list    ap;

  if(!get_connection()) { return value; }
  va_start(ap, fmt);
  if(_driver == "sqlite") {
    value= sqlite_fetch_col_value(sql, fmt, ap);
  }
  if(_driver == "mysql") {
    value= mysql_fetch_col_value(sql, fmt, ap);
  }
  va_end(ap);
  return value;
}


/*****************************************************************************
******************************************************************************
*
* internal SQLITE methods
*
******************************************************************************
*****************************************************************************/

void* MQDB::Database::sqlite_prepare_fetch_sql(const char* sql, const char* fmt, va_list ap) {
  va_list         ap2;
  const char      *pzTail;    /* OUT: Pointer to unused portion of zSql */
  int             param_idx=1;
//int             colcnt, col_idx;
  sqlite3_stmt*   ppStmt = NULL;

  if(!get_connection()) { return NULL; }
  sqlite3_prepare_v2((sqlite3*)_dbc, sql, -1, &ppStmt, &pzTail);
  if(ppStmt == NULL) { return NULL; }
    
  if(ap != NULL) {
    va_copy(ap2, ap);
    while(*fmt) {
      switch(*fmt++) {
        char* s;
        int d;
        char c;
        double t_double;
      
        case 's':                       //string
          s = va_arg(ap2, char *);
          sqlite3_bind_text(ppStmt, param_idx, s, -1, SQLITE_STATIC);
          break;

        case 'd':                       // int
          d = va_arg(ap2, int);
          sqlite3_bind_int(ppStmt, param_idx, d);
          break;

        case 'c':                       // char
          // Note: char is promoted to int.
          c = va_arg(ap2, int);
          sqlite3_bind_text(ppStmt, param_idx, &c, 1, SQLITE_STATIC);
          break;

        case 'f':                       // double
          t_double = va_arg(ap2, double);
          sqlite3_bind_double(ppStmt, param_idx, t_double);
          break;

        default: break;
          /*    
          int sqlite3_bind_blob(sqlite3_stmt*, int, const void*, int n, void(*)(void*));
          int sqlite3_bind_int(sqlite3_stmt*, int, int);
          int sqlite3_bind_int64(sqlite3_stmt*, int, sqlite3_int64);
          int sqlite3_bind_null(sqlite3_stmt*, int);
          int sqlite3_bind_text(sqlite3_stmt*, int, const char*, int n, void(*)(void*));
          int sqlite3_bind_text16(sqlite3_stmt*, int, const void*, int, void(*)(void*));
          int sqlite3_bind_value(sqlite3_stmt*, int, const sqlite3_value*);
          int sqlite3_bind_zeroblob(sqlite3_stmt*, int, int n);
          */
      }
      param_idx++;
    }
    va_end(ap2);
  }

  return (void*)ppStmt;
}


bool MQDB::Database::sqlite_fetch_next_row_map(void* stmt, map<string, dynadata> &row_map) {
  string                colname;
  int                   rtn;
  int                   colcnt, idx;
  sqlite3_stmt*         ppStmt = (sqlite3_stmt*)stmt;

    
  row_map.clear();
  if(ppStmt == NULL) { return false; }

  rtn = sqlite3_step(ppStmt);
  if(!(rtn==SQLITE_ROW || rtn==SQLITE_OK)) {
    //no more rows
    sqlite3_finalize(ppStmt);
    ppStmt = NULL;
    return false;  //empty
  }

  colcnt = sqlite3_column_count(ppStmt);
  for(idx=0; idx<colcnt; idx++) {
    dynadata value;
    value.type = MQDB::UNDEF;
    rtn = sqlite3_column_type(ppStmt, idx);
    switch (rtn) {
      case SQLITE_INTEGER:
        value.type = MQDB::INT;
        value.i_int = sqlite3_column_int(ppStmt, idx);
        break;
      case SQLITE_FLOAT:
        value.type = MQDB::DOUBLE;
        value.i_double = sqlite3_column_double(ppStmt, idx);
        break;
      case SQLITE_BLOB:
        //value.set_type(INT);
        break;
      case SQLITE_TEXT:
        value.type = MQDB::STRING;
        value.i_string = string((const char*)sqlite3_column_text(ppStmt, idx));
        break;
      case SQLITE_NULL:
        value.type = MQDB::UNDEF;
        break;
        
      default: break;
    }
    colname = sqlite3_column_name(ppStmt, idx);
    row_map[colname] = value;
  }
 
  return true;
}


bool MQDB::Database::sqlite_fetch_next_row_vector(void* stmt, vector<dynadata> &row_vector) {
  int                   rtn;
  int                   colcnt, idx;
  sqlite3_stmt*         ppStmt = (sqlite3_stmt*)stmt;

    
  row_vector.clear();
  if(ppStmt == NULL) { return false; }

  rtn = sqlite3_step(ppStmt);
  if(!(rtn==SQLITE_ROW || rtn==SQLITE_OK)) {
    //no more rows
    sqlite3_finalize(ppStmt);
    ppStmt = NULL;
    return false;  //empty
  }

  colcnt = sqlite3_column_count(ppStmt);
  for(idx=0; idx<colcnt; idx++) {
    dynadata value;
    value.type = MQDB::UNDEF;
    rtn = sqlite3_column_type(ppStmt, idx);
    switch (rtn) {
      case SQLITE_INTEGER:
        value.type = MQDB::INT;
        value.i_int = sqlite3_column_int(ppStmt, idx);
        break;
      case SQLITE_FLOAT:
        value.type = MQDB::DOUBLE;
        value.i_double = sqlite3_column_double(ppStmt, idx);
        break;
      case SQLITE_BLOB:
        //value.set_type(INT);
        break;
      case SQLITE_TEXT:
        value.type = MQDB::STRING;
        value.i_string = string((const char*)sqlite3_column_text(ppStmt, idx));
        break;
      case SQLITE_NULL:
        value.type = MQDB::UNDEF;
        break;
        
      default: break;
    }
    value.colname = sqlite3_column_name(ppStmt, idx);
    row_vector.push_back(value);
  }
 
  return true;
}


void MQDB::Database::sqlite_do_sql(const char* sql, const char* fmt, va_list ap) {
  va_list      ap2;
  dynadata     value;
  sqlite3_stmt *ppStmt;    /* OUT: Statement handle */
  const char   *pzTail;    /* OUT: Pointer to unused portion of zSql */
  int          param_idx=1;
  int          rtn;

  if(sql == NULL) { return; }
  
  //MQDB uses MYSQL dialect syntax so need to convert into sqlite dialect when needed
  string t_sql = sql;
  boost::algorithm::replace_all(t_sql, "INSERT ignore", "INSERT or ignore");
  if(t_sql.find("UNLOCK TABLES") == 0) { t_sql = "END TRANSACTION;"; }
  if(t_sql.find("LOCK TABLE") == 0)    { t_sql = "BEGIN TRANSACTION;"; }
    
  get_connection();
  sqlite3_prepare_v2((sqlite3*)_dbc, t_sql.c_str(), -1, &ppStmt, &pzTail);
  if(ppStmt == NULL) { return; }
    
  if(ap != NULL) {
    va_copy(ap2, ap);
    while(*fmt) {
      switch(*fmt++) {
        char* s;
        int d;
        char c;
        double t_double;
 
        case 's':                       //string
          s = va_arg(ap2, char *);
          sqlite3_bind_text(ppStmt, param_idx, s, -1, SQLITE_STATIC);
          break;

        case 'd':                       // int
          d = va_arg(ap2, int);
          sqlite3_bind_int(ppStmt, param_idx, d);
          break;

        case 'c':                       // char
          // Note: char is promoted to int.
          c = va_arg(ap2, int);
          sqlite3_bind_text(ppStmt, param_idx, &c, 1, SQLITE_STATIC);
          break;

        case 'f':                       // double
          t_double = va_arg(ap2, double);
          sqlite3_bind_double(ppStmt, param_idx, t_double);
          break;
          
        default: break;
          /*    
          int sqlite3_bind_blob(sqlite3_stmt*, int, const void*, int n, void(*)(void*));
          int sqlite3_bind_double(sqlite3_stmt*, int, double);
          int sqlite3_bind_int(sqlite3_stmt*, int, int);
          int sqlite3_bind_int64(sqlite3_stmt*, int, sqlite3_int64);
          int sqlite3_bind_null(sqlite3_stmt*, int);
          int sqlite3_bind_text(sqlite3_stmt*, int, const char*, int n, void(*)(void*));
          int sqlite3_bind_text16(sqlite3_stmt*, int, const void*, int, void(*)(void*));
          int sqlite3_bind_value(sqlite3_stmt*, int, const sqlite3_value*);
          int sqlite3_bind_zeroblob(sqlite3_stmt*, int, int n);
          */
      }
      param_idx++;
    }
    va_end(ap2);
  }

  rtn = sqlite3_step(ppStmt);
  sqlite3_finalize(ppStmt);

  long int tmp_id = sqlite3_last_insert_rowid((sqlite3*)_dbc);
  if(tmp_id) { _last_insert_id = tmp_id; }
  else { _last_insert_id = -1; }
}


void MQDB::Database::sqlite_do_sql(const char* sql) {
  if(sql == NULL) { return; }
  
  //MQDB uses MYSQL dialect syntax so need to convert into sqlite dialect when needed
  string t_sql = sql;
  boost::algorithm::replace_all(t_sql, "INSERT ignore", "INSERT or ignore");
  if(t_sql.find("UNLOCK TABLES") == 0) { t_sql = "END TRANSACTION;"; }
  if(t_sql.find("LOCK TABLE") == 0)    { t_sql = "BEGIN TRANSACTION;"; }
    
  get_connection();

  //fprintf(stderr, "new sqlite_do_sql [%s]\n", t_sql.c_str());
  sqlite3_exec((sqlite3*)_dbc, t_sql.c_str(), NULL, NULL, NULL);

  long int tmp_id = sqlite3_last_insert_rowid((sqlite3*)_dbc);
  if(tmp_id) { _last_insert_id = tmp_id; }
  else { _last_insert_id = -1; }
}


dynadata MQDB::Database::sqlite_fetch_col_value(const char* sql, const char* fmt, va_list ap) {
  va_list      ap2;
  dynadata     value;
  sqlite3_stmt *ppStmt;    /* OUT: Statement handle */
  const char   *pzTail;    /* OUT: Pointer to unused portion of zSql */
  int          param_idx=1;
  int          rtn;

  get_connection();
  sqlite3_prepare_v2((sqlite3*)_dbc, sql, -1, &ppStmt, &pzTail);
  if(ppStmt == NULL) { return value; }
    
  if(ap != NULL) {
    va_copy(ap2, ap);
    while(*fmt) {
      switch(*fmt++) {
        char* s;
        int d;
        char c;
        double t_double;
      
        case 's':                       //string
          s = va_arg(ap2, char *);
          sqlite3_bind_text(ppStmt, param_idx, s, -1, SQLITE_STATIC);
          break;

        case 'd':                       // int
          d = va_arg(ap2, int);
          sqlite3_bind_int(ppStmt, param_idx, d);
          break;

        case 'c':                       // char
          // Note: char is promoted to int.
          c = va_arg(ap2, int);
          sqlite3_bind_text(ppStmt, param_idx, &c, 1, SQLITE_STATIC);
          break;

        case 'f':                       // double
          t_double = va_arg(ap2, double);
          sqlite3_bind_double(ppStmt, param_idx, t_double);
          break;
          
        default: break;
          /*    
          int sqlite3_bind_blob(sqlite3_stmt*, int, const void*, int n, void(*)(void*));
          int sqlite3_bind_double(sqlite3_stmt*, int, double);
          int sqlite3_bind_int(sqlite3_stmt*, int, int);
          int sqlite3_bind_int64(sqlite3_stmt*, int, sqlite3_int64);
          int sqlite3_bind_null(sqlite3_stmt*, int);
          int sqlite3_bind_text(sqlite3_stmt*, int, const char*, int n, void(*)(void*));
          int sqlite3_bind_text16(sqlite3_stmt*, int, const void*, int, void(*)(void*));
          int sqlite3_bind_value(sqlite3_stmt*, int, const sqlite3_value*);
          int sqlite3_bind_zeroblob(sqlite3_stmt*, int, int n);
          */
      }
      param_idx++;
    }
    va_end(ap2);
  }

  
  rtn = sqlite3_step(ppStmt);
  if(rtn==SQLITE_ROW || rtn==SQLITE_OK) {
    rtn = sqlite3_column_type(ppStmt, 0);
    switch (rtn) {
      case SQLITE_INTEGER:
        value.type = MQDB::INT;
        value.i_int = sqlite3_column_int(ppStmt, 0);
        break;
      case SQLITE_FLOAT:
        value.type = MQDB::DOUBLE;
        value.i_double = sqlite3_column_double(ppStmt, 0);
        break;
      case SQLITE_BLOB:
        //value.set_type(INT);
        break;
      case SQLITE_TEXT:
        value.type = MQDB::STRING;
        value.i_string = string((const char*)sqlite3_column_text(ppStmt, 0));
        break;
      case SQLITE_NULL:
        value.type = MQDB::UNDEF;
        break;
        
      default: break;
    }
  }
 
  sqlite3_finalize(ppStmt);
  return value;
}


/*****************************************************************************
******************************************************************************
*
* internal MYSQL related methods
*
******************************************************************************
******************************************************************************/


void* MQDB::Database::mysql_prepare_fetch_sql(const char* sql, const char* fmt, va_list ap) {
  va_list           ap2;
  MYSQL_STMT        *ppStmt;
  MQDB::MysqlStmt   *stmt;
  
  if(!get_connection()) { return NULL; }

  ppStmt = mysql_stmt_init((MYSQL*)_dbc);
  if(ppStmt == NULL) {
    fprintf(stderr, "Failed to init mysql statement [%s] Error: %s\n", sql, mysql_error((MYSQL*)_dbc));
    return NULL;
  }

  if(mysql_stmt_prepare(ppStmt, sql, strlen(sql)) != 0) {
    fprintf(stderr, "Failed to prepare mysql statement [%s] db[%s] Error: %s\n", sql, url().c_str(), mysql_stmt_error(ppStmt));
    mysql_stmt_close(ppStmt);
    return NULL;
  }

  //OK go ahead and start preparations
  stmt = new MQDB::MysqlStmt(ppStmt);

  // if option params, bind them 
  if(fmt!=NULL && ap!=NULL) {
    int         bind_cnt = strlen(fmt);
    MYSQL_BIND  mysql_bind[bind_cnt];
    dynadata    mysql_buffer[bind_cnt];
    //vector<dynadata>   mysql_buffer;
    int         param_idx=0;
    memset(mysql_bind, 0, sizeof(mysql_bind));

    va_copy(ap2, ap);
    while(param_idx < bind_cnt) {
        char         t_char;
        char*        s;
        long int     d;
        double       t_double;
        time_t       t_time;
        struct tm*   t_tm;
        MYSQL_TIME*  mysql_time;
        
        mysql_bind[param_idx].buffer = NULL;
      
      switch(fmt[param_idx]) {
        case 's':                       //string
          s = va_arg(ap2, char *);
          mysql_buffer[param_idx].i_string = s;
          mysql_buffer[param_idx].i_int = strlen(s);
          
          mysql_bind[param_idx].buffer_type = MYSQL_TYPE_STRING;
          
          mysql_bind[param_idx].buffer = (void*)(mysql_buffer[param_idx].i_string.c_str());
          mysql_bind[param_idx].buffer_length= mysql_buffer[param_idx].i_int;
          mysql_bind[param_idx].length= (long unsigned int*)(&(mysql_buffer[param_idx].i_int));
          break;

        case 'c':                       // char
          t_char = (char)va_arg(ap2, int);
          mysql_buffer[param_idx].i_string = t_char;
          mysql_buffer[param_idx].i_int = 1;
          
          mysql_bind[param_idx].buffer_type = MYSQL_TYPE_STRING;
          
          mysql_bind[param_idx].buffer        = (void*)(mysql_buffer[param_idx].i_string.c_str());
          mysql_bind[param_idx].buffer_length = mysql_buffer[param_idx].i_int;
          mysql_bind[param_idx].length        = (long unsigned int*)(&(mysql_buffer[param_idx].i_int));
          break;

        case 'd':                       // int
          d = va_arg(ap2, int);
          mysql_buffer[param_idx].i_int = d;

          mysql_bind[param_idx].buffer_type = MYSQL_TYPE_LONG;
          mysql_bind[param_idx].buffer = &(mysql_buffer[param_idx].i_int);
          break;

        case 'f':                       // double
          t_double = va_arg(ap2, double);
          mysql_buffer[param_idx].i_double = t_double;

          mysql_bind[param_idx].buffer_type = MYSQL_TYPE_DOUBLE;
          mysql_bind[param_idx].buffer = &(mysql_buffer[param_idx].i_double);
          break;

        case 't':                      // time as (time_t) type
          t_time = va_arg(ap2, time_t);
          t_tm = localtime(&t_time);

          mysql_time = (MYSQL_TIME*)malloc(sizeof(MYSQL_TIME));
          memset(mysql_time, 0, sizeof(MYSQL_TIME));
          mysql_buffer[param_idx].i_blob = mysql_time;
          mysql_buffer[param_idx].type   = MQDB::BLOB;

          mysql_time->year   = t_tm->tm_year + 1900; 
          mysql_time->month  = t_tm->tm_mon + 1;
          mysql_time->day    = t_tm->tm_mday;
          mysql_time->hour   = t_tm->tm_hour;
          mysql_time->minute = t_tm->tm_min;
          mysql_time->second = t_tm->tm_sec;

          mysql_bind[param_idx].buffer_type = MYSQL_TYPE_DATE;
          mysql_bind[param_idx].buffer = mysql_buffer[param_idx].i_blob;
          mysql_bind[param_idx].is_null = 0;
          mysql_bind[param_idx].length = 0;

          break;
           
        default: break;
      }
      param_idx++;
    }
    va_end(ap2);
    
    if(mysql_stmt_bind_param(ppStmt, mysql_bind) != 0) {
      fprintf(stderr, "Failed to bind mysql statement Error: %s\n", mysql_stmt_error(ppStmt));
      delete stmt;  //deletes buffers and closes statment
      return NULL;
    }
    if(mysql_stmt_execute(ppStmt)) {
      fprintf(stderr, "Failed to execute mysql statement Error: %s\n", mysql_stmt_error(ppStmt));
      delete stmt;  //deletes buffers and closes statment
      return NULL;
    }
  } else {
    if(mysql_stmt_execute(ppStmt)) {
      fprintf(stderr, "Failed to execute mysql statement Error: %s\n", mysql_stmt_error(ppStmt));
      delete stmt;  //deletes buffers and closes statment
      return NULL;
    }
  }
  
  // if we want to bind results and buffer entire result set onto the client 
  // do code like this
  //mysql_stmt_store_result(ppStmt);
  
  return (void*)stmt;
}


bool MQDB::Database::mysql_fetch_next_row_map(void* in_stmt,  map<string, dynadata> &row_map) {
  MQDB::MysqlStmt        *stmt = (MQDB::MysqlStmt*)in_stmt;
  string                 colname;

  row_map.clear();
  if(stmt == NULL) { return false; }

  MYSQL_STMT *ppStmt = stmt->ppStmt;

  //printf("mysql_fetch_next_row_map\n");
  
  if(mysql_stmt_fetch(ppStmt)) { 
    //maybe problem or finished
    delete stmt;
    return false; 
  }
  //printf("after mysql_stmt_fetch\n");
      
  for(int i=0; i<stmt->num_fields; i++) {
    dynadata value;
    short    t_short;
    int      t_int;
    value.type = MQDB::UNDEF;
    //printf("  [%d] : %s\n", i, stmt->fields[i].name);
    colname = stmt->fields[i].name;

    if(!(*(stmt->result_bind[i].is_null))) {
      MYSQL_TIME  *rtn_time = (MYSQL_TIME*)stmt->result_bind[i].buffer;

      long unsigned int buf_length = 0;
      if(stmt->result_bind[i].length != NULL) { buf_length = *(stmt->result_bind[i].length); }

      switch (stmt->result_bind[i].buffer_type) {
        case MYSQL_TYPE_TINY:
          value.type = MQDB::CHAR;
          value.i_char = *((char*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_SHORT:
          value.type = MQDB::INT;
          t_short = *((short*)stmt->result_bind[i].buffer);
          value.i_int = t_short;
          break;
        case MYSQL_TYPE_LONG:
          value.type = MQDB::INT;
          t_int = *((int*)stmt->result_bind[i].buffer);
          value.i_int = t_int;
          break;
        case MYSQL_TYPE_INT24:
          value.type = MQDB::INT;
          value.i_int = *((long int*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_LONGLONG:
          value.type = MQDB::INT64;
          value.i_int64 = *((long long int*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_FLOAT:  //actually store it into dynadata.i_double
          value.type = MQDB::DOUBLE;
          value.i_double = *((float*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_DOUBLE:
          value.type = MQDB::DOUBLE;
          value.i_double = *((double*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_TIMESTAMP:
        case MYSQL_TYPE_DATE:
        case MYSQL_TYPE_TIME:
        case MYSQL_TYPE_DATETIME:
        case MYSQL_TYPE_YEAR:
          struct tm t_time;
          memset(&t_time, 0, sizeof(t_time));

          t_time.tm_year = rtn_time->year - 1900;
          t_time.tm_mon = rtn_time->month -1;
          t_time.tm_mday = rtn_time->day;
          t_time.tm_hour = rtn_time->hour;
          t_time.tm_min = rtn_time->minute;
          t_time.tm_sec = rtn_time->second;

          value.type = MQDB::TIMESTAMP;
          value.i_timestamp = mktime(&t_time);
          break;

        case MYSQL_TYPE_STRING:
          value.type = MQDB::STRING;
          value.i_string = (char*)stmt->result_bind[i].buffer;
          bzero(stmt->result_bind[i].buffer, buf_length+1);
          break;
        case MYSQL_TYPE_VAR_STRING:
          value.type = MQDB::STRING;
          value.i_string = (char*)stmt->result_bind[i].buffer;
          bzero(stmt->result_bind[i].buffer, buf_length+1);
          break;
        case MYSQL_TYPE_BLOB:
          value.type = MQDB::STRING;
          value.i_string = (char*)stmt->result_bind[i].buffer;
          bzero(stmt->result_bind[i].buffer, buf_length+1);
          break;
        case MYSQL_TYPE_NULL:
          value.type = MQDB::UNDEF;
          break;
        /*
        case MYSQL_TYPE_BIT:
          break;
        case MYSQL_TYPE_DECIMAL:
          break;
        case MYSQL_TYPE_NEWDECIMAL:
          break;
        case MYSQL_TYPE_SET:
          break;
        case MYSQL_TYPE_ENUM:
          break;
        case MYSQL_TYPE_GEOMETRY:
          break;
        */
        default:
          break;
      }
    }

    row_map[colname] = value;
  }
  
  return true;
}


bool MQDB::Database::mysql_fetch_next_row_vector(void* in_stmt,  vector<dynadata> &row_vector) {
  MQDB::MysqlStmt        *stmt = (MQDB::MysqlStmt*)in_stmt;

  row_vector.clear();
  if(stmt == NULL) { return false; }

  MYSQL_STMT *ppStmt = stmt->ppStmt;

  //printf("mysql_fetch_next_row_map\n");
  
  if(mysql_stmt_fetch(ppStmt)) { 
    //maybe problem or finished
    delete stmt;
    return false; 
  }
  //printf("after mysql_stmt_fetch\n");
      
  for(int i=0; i<stmt->num_fields; i++) {
    dynadata value;
    short    t_short;
    int      t_int;
    value.type = MQDB::UNDEF;
    //printf("  [%d] : %s\n", i, stmt->fields[i].name);
    value.colname = stmt->fields[i].name;

    if(!(*(stmt->result_bind[i].is_null))) {
      MYSQL_TIME  *rtn_time = (MYSQL_TIME*)stmt->result_bind[i].buffer;

      long unsigned int buf_length = 0;
      if(stmt->result_bind[i].length != NULL) { buf_length = *(stmt->result_bind[i].length); }

      switch (stmt->result_bind[i].buffer_type) {
        case MYSQL_TYPE_TINY:
          value.type = MQDB::CHAR;
          value.i_char = *((char*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_SHORT:
          value.type = MQDB::INT;
          t_short = *((short*)stmt->result_bind[i].buffer);
          value.i_int = t_short;
          break;
        case MYSQL_TYPE_LONG:
          value.type = MQDB::INT;
          t_int = *((int*)stmt->result_bind[i].buffer);
          value.i_int = t_int;
          break;
        case MYSQL_TYPE_INT24:
          value.type = MQDB::INT;
          value.i_int = *((long int*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_LONGLONG:
          value.type = MQDB::INT64;
          value.i_int64 = *((long long int*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_FLOAT:  //actually store it into dynadata.i_double
          value.type = MQDB::DOUBLE;
          value.i_double = *((float*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_DOUBLE:
          value.type = MQDB::DOUBLE;
          value.i_double = *((double*)stmt->result_bind[i].buffer);
          break;
        case MYSQL_TYPE_TIMESTAMP:
        case MYSQL_TYPE_DATE:
        case MYSQL_TYPE_TIME:
        case MYSQL_TYPE_DATETIME:
        case MYSQL_TYPE_YEAR:
          struct tm t_time;
          memset(&t_time, 0, sizeof(t_time));

          t_time.tm_year = rtn_time->year - 1900;
          t_time.tm_mon = rtn_time->month -1;
          t_time.tm_mday = rtn_time->day;
          t_time.tm_hour = rtn_time->hour;
          t_time.tm_min = rtn_time->minute;
          t_time.tm_sec = rtn_time->second;

          value.type = MQDB::TIMESTAMP;
          value.i_timestamp = mktime(&t_time);
          break;

        case MYSQL_TYPE_STRING:
          value.type = MQDB::STRING;
          value.i_string = (char*)stmt->result_bind[i].buffer;
          bzero(stmt->result_bind[i].buffer, buf_length+1);
          break;
        case MYSQL_TYPE_VAR_STRING:
          value.type = MQDB::STRING;
          value.i_string = (char*)stmt->result_bind[i].buffer;
          bzero(stmt->result_bind[i].buffer, buf_length+1);
         break;
        case MYSQL_TYPE_BLOB:
          value.type = MQDB::STRING;
          value.i_string = (char*)stmt->result_bind[i].buffer;
          bzero(stmt->result_bind[i].buffer, buf_length+1);
          break;
        case MYSQL_TYPE_NULL:
          value.type = MQDB::UNDEF;
          break;
        /*
        case MYSQL_TYPE_BIT:
          break;
        case MYSQL_TYPE_DECIMAL:
          break;
        case MYSQL_TYPE_NEWDECIMAL:
          break;
        case MYSQL_TYPE_SET:
          break;
        case MYSQL_TYPE_ENUM:
          break;
        case MYSQL_TYPE_GEOMETRY:
          break;
        */
        default:
          break;
      }
      row_vector.push_back(value);
    }
  }
  
  return true;
}


dynadata MQDB::Database::mysql_fetch_col_value(const char* sql, const char* fmt, va_list ap) {
  map<string, dynadata>  row_map;
  dynadata               value;
  
  MQDB::MysqlStmt *stmt = (MQDB::MysqlStmt*)mysql_prepare_fetch_sql(sql, fmt, ap);
  if(stmt == NULL) { return value; }

  if(!MQDB::Database::mysql_fetch_next_row_map(stmt, row_map)) { return value; }
      
  string colname = stmt->fields[0].name;
  value = row_map[colname];
  delete stmt;
  
  return value;
}


void MQDB::Database::mysql_do_sql(const char* sql, const char* fmt, va_list ap) {  
  MQDB::MysqlStmt *stmt = (MQDB::MysqlStmt*)mysql_prepare_fetch_sql(sql, fmt, ap);
  if(mysql_insert_id((MYSQL*) _dbc) != 0) {
    _last_insert_id = mysql_insert_id((MYSQL*) _dbc);
  } else { _last_insert_id=-1; }
  if(stmt != NULL) { delete stmt; }
}

/*********************************************************************
*
* uuid functions
*
*********************************************************************/


string MQDB::uuid_b64string() {
  char b64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  char str[23];
  boost::uuids::uuid::const_iterator i_data;
  std::size_t i=0;
  string b64string;
  unsigned int   b64a, b64b, b64c, b64d;
  unsigned long int   val64;
  unsigned char  bytes[18];

  boost::uuids::uuid u = boost::uuids::uuid(boost::uuids::random_generator()());

  memset(bytes, 0, 18);
  memset(str, 0, 23);
  for(i_data = u.begin(); i_data!=u.end(); ++i_data, ++i) {
    bytes[i] = static_cast<unsigned char>(*i_data);
    //printf("%d [%d]\n", i, bytes[i]);
  }
  for(i=0; i<=5; i++) {
    val64 = bytes[i*3] + bytes[(i*3)+1]*256 + bytes[(i*3)+2]*256*256;
    b64a = val64 & 63;
    b64b = (val64/64) & 63;
    b64c = (val64/64/64) & 63;
    b64d = (val64/64/64/64) & 63;
    //printf("%d %ld [%d %d %d %d]\n", i, val64, b64a, b64b, b64c, b64d);

    str[i*4] = b64[b64a];
    if(i<5) {
      str[(i*4)+1] = b64[b64b];
      str[(i*4)+2] = b64[b64c];
      str[(i*4)+3] = b64[b64d];
    } else {
      if(b64b>0) { str[(i*4)+1] = b64[b64b]; }
    }
  }

  b64string = str;
  //printf("%s\n", b64string.c_str());
  return b64string;
}

string MQDB::uuid_hexstring() {
  char hex[] = "0123456789ABCDEF";
  char str[40];
  boost::uuids::uuid::const_iterator i_data;
  std::size_t i=0;
  unsigned int   nib1, nib2;
  int            idx;

  boost::uuids::uuid u = boost::uuids::uuid(boost::uuids::random_generator()());

  memset(str, 0, 40);
  idx=0;
  for(i_data = u.begin(); i_data!=u.end(); ++i_data, ++i) {
    unsigned int val = static_cast<unsigned char>(*i_data);
    nib1 = (val /16) &15;
    nib2 = val & 15;
    //printf("%d [%d] [%d %d]\n", i, val, nib1, nib2);

    str[idx++] = hex[nib1];
    str[idx++] = hex[nib2];
    if (i == 3 || i == 5 || i == 7 || i == 9) { str[idx++] = '-'; }
  }

  string hexstring = str;
  //printf("%s\n", hexstring.c_str());
  //string hexstring = boost::uuids::to_string(u);

  return hexstring;
}

string  MQDB::html_escape(string data) {
  string t_data = data;
  //web escape data
  boost::algorithm::replace_all(t_data, "&", "&amp;");
  boost::algorithm::replace_all(t_data, "\"", "&quot;");
  boost::algorithm::replace_all(t_data, "<", "&lt;");
  boost::algorithm::replace_all(t_data, ">", "&gt;");
  return t_data;
}

string  MQDB::unescape_html(string data) {
  string t_data = data;
  //web unescape data
  boost::algorithm::replace_all(t_data, "&amp;", "&");
  boost::algorithm::replace_all(t_data, "&quot;", "\"");
  boost::algorithm::replace_all(t_data, "&lt;", "<");
  boost::algorithm::replace_all(t_data, "&gt;", ">");

  boost::algorithm::replace_all(t_data, "%20", " ");
  boost::algorithm::replace_all(t_data, "%3A", ":");
  boost::algorithm::replace_all(t_data, "%2F", "/");
  boost::algorithm::replace_all(t_data, "%3F", "?");
  boost::algorithm::replace_all(t_data, "%3D", "=");
  boost::algorithm::replace_all(t_data, "%26", "&");
  boost::algorithm::replace_all(t_data, "%25", "%");  
  
  return t_data;
}

void MQDB::urldecode(string &data) {
  //web unescape data
  boost::algorithm::ireplace_all(data, "%20", " ");
  boost::algorithm::ireplace_all(data, "%21", "!");
  boost::algorithm::ireplace_all(data, "%22", "\"");
  boost::algorithm::ireplace_all(data, "%23", "#");
  boost::algorithm::ireplace_all(data, "%24", "$");
  boost::algorithm::ireplace_all(data, "%25", "%");
  boost::algorithm::ireplace_all(data, "%26", "&");
  boost::algorithm::ireplace_all(data, "%27", "\'");
  boost::algorithm::ireplace_all(data, "%28", "(");
  boost::algorithm::ireplace_all(data, "%29", ")");
  boost::algorithm::ireplace_all(data, "%2A", "*");
  boost::algorithm::ireplace_all(data, "%2B", "+");
  boost::algorithm::ireplace_all(data, "%2C", ",");
  boost::algorithm::ireplace_all(data, "%2D", "-");
  boost::algorithm::ireplace_all(data, "%2E", ".");
  boost::algorithm::ireplace_all(data, "%2F", "/");
  boost::algorithm::ireplace_all(data, "%3C", "<");
  boost::algorithm::ireplace_all(data, "%3E", ">");
  boost::algorithm::ireplace_all(data, "%2F", "/");
  boost::algorithm::ireplace_all(data, "%3A", ":");
  boost::algorithm::ireplace_all(data, "%2C", ",");
  boost::algorithm::ireplace_all(data, "%0D", ""); //CR
  boost::algorithm::ireplace_all(data, "%0A", ""); //LF
  boost::algorithm::ireplace_all(data, "%3D", "="); 
}


//parsing different time strings into epoch seconds
const std::locale formats[] = {
std::locale(std::locale::classic(),new bt::time_input_facet("%Y-%m-%d %H:%M:%S")),
std::locale(std::locale::classic(),new bt::time_input_facet("%Y/%m/%d %H:%M:%S")),
std::locale(std::locale::classic(),new bt::time_input_facet("%d.%m.%Y %H:%M:%S")),
std::locale(std::locale::classic(),new bt::time_input_facet("%a %b %d %H:%M:%S %Y %z")), //Thu Sep 16 05:29:35 2010 GMT
std::locale(std::locale::classic(),new bt::time_input_facet("%a %b %e ! %H:%M:%S %Y %z")), //Thu Sep  6 05:29:35 2010 GMT
std::locale(std::locale::classic(),new bt::time_input_facet("%Y-%m-%d"))};
const size_t formats_n = sizeof(formats)/sizeof(formats[0]);

time_t MQDB::seconds_from_epoch(const std::string& s) {
  bt::ptime pt;
  for(size_t i=0; i<formats_n; ++i) {
    std::istringstream is(s);
    is.imbue(formats[i]);
    is >> pt;
    if(pt != bt::ptime()) break;
  }
  if(pt == bt::ptime()) { return 0; }
  
  bt::ptime timet_start(boost::gregorian::date(1970,1,1));
  bt::time_duration diff = pt - timet_start;
  return diff.ticks()/bt::time_duration::rep_type::ticks_per_second;
}

void MQDB::unparse_dbid(string dbid, string &uuid, long int &objID, string &objClass) {
  uuid.clear();
  objClass="Feature";
  objID = -1;
  
  size_t   p1;
  if((p1 = dbid.find("::")) != string::npos) {
    uuid = dbid.substr(0, p1);
    string idclass = dbid.substr(p1+2);
    if((p1 = idclass.find(":::")) != string::npos) {
      objClass = idclass.substr(p1+3);
      string t_id = idclass.substr(0, p1);
      objID = atoi(t_id.c_str());
    } else {
      objID = atoi(idclass.c_str());
    }
  }
}


string MQDB::l_to_string(long value) {
  std::stringstream ss;
  ss << value;
  return ss.str();
}

string MQDB::d_to_string(double value) {
  std::stringstream ss;
  ss << value;
  return ss.str();
}


string MQDB::to_hex(unsigned char s) {
  stringstream ss;
  ss << hex << (int) s;
  return ss.str();
}   

string MQDB::sha256(string line) {    
  unsigned char hash[SHA256_DIGEST_LENGTH];
  SHA256_CTX sha256;
  SHA256_Init(&sha256);
  SHA256_Update(&sha256, line.c_str(), line.length());
  SHA256_Final(hash, &sha256);
  
  string output = "";    
  for(int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
    output += to_hex(hash[i]);
  }
  return output;
}

string MQDB::sha512(string line) {    
  unsigned char hash[SHA512_DIGEST_LENGTH];
  SHA512_CTX sha512;
  SHA512_Init(&sha512);
  SHA512_Update(&sha512, line.c_str(), line.length());
  SHA512_Final(hash, &sha512);
  
  string output = "";    
  for(int i = 0; i < SHA512_DIGEST_LENGTH; i++) {
    output += to_hex(hash[i]);
  }
  return output;
}

//////////////////////////////////////////////////////////////////////////////
//
// process_mem_usage(double &, double &) - takes two doubles by reference,
// attempts to read the system-dependent data for a process' virtual memory
// size and resident set size, and return the results in KB. Don Wakefield.
//
// On failure, returns 0.0, 0.0

void MQDB::process_mem_usage(double& vm_usage, double& resident_set) {
  using std::ios_base;
  using std::ifstream;
  using std::string;
  
  vm_usage     = 0.0;
  resident_set = 0.0;
  
  // 'file' stat seems to give the most reliable results
  //
  ifstream stat_stream("/proc/self/stat",ios_base::in);
  
  // dummy vars for leading entries in stat that we don't care about
  //
  string pid, comm, state, ppid, pgrp, session, tty_nr;
  string tpgid, flags, minflt, cminflt, majflt, cmajflt;
  string utime, stime, cutime, cstime, priority, nice;
  string O, itrealvalue, starttime;
  
  // the two fields we want
  //
  unsigned long vsize;
  long rss;
  
  stat_stream >> pid >> comm >> state >> ppid >> pgrp >> session >> tty_nr
  >> tpgid >> flags >> minflt >> cminflt >> majflt >> cmajflt
  >> utime >> stime >> cutime >> cstime >> priority >> nice
  >> O >> itrealvalue >> starttime >> vsize >> rss; // don't care about the rest
  
  stat_stream.close();
  
  long page_size_kb = sysconf(_SC_PAGE_SIZE) / 1024; // in case x86-64 is configured to use 2MB pages
  vm_usage     = vsize / 1024.0;
  resident_set = rss * page_size_kb;
}


string MQDB::exec_result(string cmd) {
  FILE* pipe = popen(cmd.c_str(), "r");
  if (!pipe) return "ERROR";
  char buffer[128];
  std::string result = "";
  while(!feof(pipe)) {
    if(fgets(buffer, 128, pipe) != NULL) { result += buffer; }
  }
  pclose(pipe);
  return result;
}

