/*  $Id: TrackRequest.cpp,v 1.40 2015/02/02 10:42:03 severin Exp $ */

/*******

NAME - EEDB::TrackRequest

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

******/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sys/stat.h>
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/TrackCache.h>
#include <EEDB/TrackRequest.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/Chrom.h>
#include <sqlite3.h>
#include <stdarg.h>

using namespace std;
using namespace MQDB;


//////////////////////////////////////////////////////////////////////////////////////

const char*  EEDB::TrackRequest::class_name = "EEDB::TrackRequest";

void _eedb_trackcache_buildrequest_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::TrackRequest*)obj;
}
void _eedb_trackcache_buildrequest_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::TrackRequest*)obj)->_xml(xml_buffer);
}
void _eedb_trackcache_buildrequest_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::TrackRequest*)obj)->_xml(xml_buffer);
}
string _eedb_trackcache_buildrequest_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::TrackRequest*)obj)->_display_desc();
}

EEDB::TrackRequest::TrackRequest() {
  init();
}

EEDB::TrackRequest::~TrackRequest() {
}


void EEDB::TrackRequest::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::TrackRequest::class_name;
  
  _funcptr_delete            = _eedb_trackcache_buildrequest_delete_func;
  _funcptr_display_desc      = _eedb_trackcache_buildrequest_display_desc_func;
  _funcptr_xml               = _eedb_trackcache_buildrequest_xml_func;
  _funcptr_simple_xml        = _eedb_trackcache_buildrequest_simple_xml_func;

  _track_cache  = NULL;

  _request_time = 0;
  _chrom_start  = -1;
  _chrom_end    = -1;
  
  _track_cache_id = -1;
  _user_id        = -1;  
  _num_segs       = 0;
  _unbuilt        = 0;
  _send_email     = false;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////


string    EEDB::TrackRequest::request_date_string() { 
  string str;
  if(_request_time>0) {
    time_t t_update = _request_time;
    char *ct_value = ctime(&t_update);
    if(ct_value != NULL) {
      int len = strlen(ct_value);
      if(len>0) {
        ct_value[len-1] = '\0';
        str = ct_value;
      }
    }
  }
  return str;
}


EEDB::TrackCache*  EEDB::TrackRequest::track_cache() {
  if(_track_cache) { return _track_cache; }
  //lazy load method
  if(database() == NULL) { return NULL; }
  if(_track_cache_id == -1) { return NULL; }
  
  _track_cache = EEDB::TrackCache::fetch_by_id(database(), _track_cache_id);
  return _track_cache;
}
  
  
string  EEDB::TrackRequest::track_hashkey() {
  if(_hashkey.empty()) {
    if(track_cache()) {
      _hashkey = track_cache()->track_hashkey();
    }
  }
  return _hashkey;
}


////////////////////////////////////////////////////////////////


string EEDB::TrackRequest::_display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "TrackRequest(db %ld ) %s", 
    _primary_db_id, 
    request_date_string().c_str());
  /*
  long                  user_id() { return _user_id; }
  string                assembly_name() { return _assembly_name; }
  string                chrom_name() { return _chrom_name; }
  long                  chrom_start() { return _chrom_start; }
  long                  chrom_end() { return _chrom_end; }
*/
  
  return buffer;
}


void EEDB::TrackRequest::_xml(string &xml_buffer) {
  char buffer[2048];

  xml_buffer.append("<track_request ");
  snprintf(buffer, 2040, "id=\"%ld\" ", _primary_db_id);
  xml_buffer.append(buffer);
    
  xml_buffer.append("time=\"" + request_date_string() +"\" ");
  xml_buffer.append("asmb=\"" + _assembly_name +"\" ");
  xml_buffer.append("chrom=\"" + _chrom_name +"\" ");
  snprintf(buffer, 2040, "start=\"%ld\" end=\"%ld\" ", _chrom_start, _chrom_end);
  xml_buffer.append(buffer);
  snprintf(buffer, 2040, "num_segs=\"%ld\" unbuilt=\"%ld\" ", _num_segs, _unbuilt);
  xml_buffer.append(buffer);
  if(_send_email) { xml_buffer.append("send_email=\"y\" "); }

  xml_buffer.append(">");


  if(!track_hashkey().empty()) { xml_buffer += "<hashkey>"+_hashkey+"</hashkey>"; }
  if(!_track_name.empty()) { xml_buffer += "<track_name>"+html_escape(_track_name)+"</track_name>"; }
  if(!_view_uuid.empty()) { xml_buffer += "<view_uuid>"+_view_uuid+"</view_uuid>"; }

  EEDB::ZDX::ZDXstream *zdxstream =  track_cache()->zdxstream();
  if(zdxstream) {
    ZDXdb* zdxdb = zdxstream->zdxdb();  
    if(zdxdb) {
      long numsegs, numbuilt, numclaimed, seg_start;
      EEDB::ZDX::ZDXsegment::build_stats(zdxdb, _assembly_name.c_str(), _chrom_name.c_str(), _chrom_start, _chrom_end, numsegs, numbuilt, numclaimed, seg_start);
      snprintf(buffer, 2040, "<build_stats numsegs=\"%ld\" numbuilt=\"%ld\" numclaimed=\"%ld\" seg_start=\"%ld\"/>", numsegs, numbuilt, numclaimed, seg_start);
      xml_buffer.append(buffer);
    }
  }

  xml_buffer.append("</track_request>");
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// class level MQDB style fetch methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::TrackRequest::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id      = row_map["track_request_id"].i_int;
  _track_cache_id     = row_map["track_cache_id"].i_int;
  _user_id            = row_map["user_id"].i_int;
  _hashkey            = row_map["hash_key"].i_string;
  
  _track_name         = row_map["track_name"].i_string;
  _view_uuid          = row_map["view_uuid"].i_string;
  
  _assembly_name      = row_map["assembly"].i_string;
  _chrom_name         = row_map["chrom"].i_string;
  _chrom_start        = row_map["start"].i_int;
  _chrom_end          = row_map["end"].i_int;

  _num_segs           = row_map["num_segs"].i_int;
  _unbuilt            = row_map["unbuilt"].i_int;

  if(row_map["send_email"].i_string == string("y"))  { _send_email=true; } else { _send_email=false; }

  if(row_map["request_time"].type == MQDB::STRING) {
    string date_string = row_map["request_time"].i_string;
    _request_time = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["request_time"].type == MQDB::TIMESTAMP) {
    _request_time = row_map["request_time"].i_timestamp;
  }
}


vector<DBObject*>  EEDB::TrackRequest::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM track_request";
  return MQDB::fetch_multiple(EEDB::TrackRequest::create, db, sql, "");
}


vector<DBObject*>  EEDB::TrackRequest::fetch_all(EEDB::TrackCache *tc) {
  vector<DBObject*> requests;
  if(!tc) { return requests; }
  if(!tc->database()) { return requests; }
  MQDB::Database *db = tc->database();
  
  const char *sql = "SELECT * FROM track_request WHERE track_cache_id=?";
  return MQDB::fetch_multiple(EEDB::TrackRequest::create, db, sql, "d", tc->primary_id());
}


string  EEDB::TrackRequest::best_build_hashkey(MQDB::Database *db) {
  //part of the auto-building machinery. This operation picks a track_cache from the database based on a combination of
  //track_request and then falling back to 'unbuilt but accessed recently'
  if(db==NULL) { return ""; }
    
  //otherwise pick a track_cache hashkey based on biased rand-sort of pending requests
  const char *sql = "SELECT hashkey FROM (SELECT * FROM track_cache \
                     JOIN (SELECT track_cache_id, count(*) num_req, sum(unbuilt)/count(*) avg_unbuilt \
                           FROM track_request WHERE unbuilt>0 group by track_cache_id)t1\
                     USING(track_cache_id) \
                     WHERE broken!='y' AND percent_complete!=100 \
                     ORDER BY (avg_unbuilt*(seg_buildtime+1)) asc limit 20)t2 \
                     ORDER BY rand() limit 1";
    
  dynadata value = db->fetch_col_value(sql, "");
  if(value.type == MQDB::STRING) { return value.i_string; }
  
  return "";
}


EEDB::TrackRequest*  EEDB::TrackRequest::fetch_best(EEDB::TrackCache *tc) {
  if(!tc) { return NULL; }
  if(!tc->database()) { return NULL; }
  MQDB::Database *db = tc->database();

  EEDB::TrackRequest * request = NULL;
  
  const char *sql = "SELECT track_request.*, unbuilt/((TIME_TO_SEC(TIMEDIFF(NOW(), request_time))/60/60)+1) metric \
                     FROM track_request \
                     WHERE unbuilt>0 and start!=-1 and track_cache_id=? ORDER BY metric limit 1";
  request = (EEDB::TrackRequest*)MQDB::fetch_single(EEDB::TrackRequest::create, db, sql, "d", tc->primary_id());
  if(request) { 
    request->_track_cache = tc;
    return request;
  }

  sql = "SELECT track_request.*, unbuilt/((TIME_TO_SEC(TIMEDIFF(NOW(), request_time))/60/60)+1) metric \
         FROM track_cache JOIN track_request USING(track_cache_id) \
         WHERE unbuilt>0 and track_cache.track_cache_id=? ORDER BY metric limit 1";
  request = (EEDB::TrackRequest*)MQDB::fetch_single(EEDB::TrackRequest::create, db, sql, "d", tc->primary_id());
  if(request) { request->_track_cache = tc; }
  return request;
}


EEDB::TrackRequest*  EEDB::TrackRequest::fetch_best(MQDB::Database *db) { 
  EEDB::TrackRequest * request = NULL;
  
  const char *sql = "SELECT track_request.*, (unbuilt*seg_buildtime)/((TIME_TO_SEC(TIMEDIFF(NOW(), request_time))/60/60)+1) metric \
                     FROM track_request JOIN track_cache using(track_cache_id) \
                     WHERE unbuilt>0 and start!=-1 and seg_buildtime>0 and broken!=\"y\" ORDER BY metric*(1+rand()) limit 1";
  request = (EEDB::TrackRequest*)MQDB::fetch_single(EEDB::TrackRequest::create, db, sql, "");
  if(request) { return request; }
  
  sql = "SELECT track_request.*, unbuilt/((TIME_TO_SEC(TIMEDIFF(NOW(), request_time))/60/60)+1) metric \
         FROM track_request JOIN track_cache using(track_cache_id) \
         WHERE unbuilt>0 and broken!=\"y\" ORDER BY metric*(1+rand()) limit 1";
  request = (EEDB::TrackRequest*)MQDB::fetch_single(EEDB::TrackRequest::create, db, sql, "");
  return request;
}


EEDB::TrackRequest*  EEDB::TrackRequest::fetch_by_id(MQDB::Database *db, long int id) {  
  const char *sql = "SELECT * FROM track_request WHERE track_request_id=?";
  return (EEDB::TrackRequest*) MQDB::fetch_single(EEDB::TrackRequest::create, db, sql, "d", id);
}


vector<DBObject*>  EEDB::TrackRequest::fetch_by_user(EEDB::User *user) {
  vector<DBObject*> requests;
  if(!user) { return requests; }
  if(!user->database()) { return requests; }
  MQDB::Database *db = user->database();
  
  const char *sql = "SELECT track_request.*, hashkey FROM track_request JOIN track_cache using(track_cache_id) WHERE user_id=?";
  return MQDB::fetch_multiple(EEDB::TrackRequest::create, db, sql, "d", user->primary_id());
}


////////////////////////////////////////////////////////////////////////////////////////


bool EEDB::TrackRequest::store(EEDB::TrackCache *trackcache) {
  if(!trackcache) { return false; }
  MQDB::Database *db = trackcache->database();
  if(db==NULL) { return false; }
  
  const char *email = "";
  if(_send_email) { email = "y"; }
  const char *sql = "INSERT ignore INTO track_request \
                     (track_cache_id,user_id,assembly,chrom,start,end,num_segs,unbuilt,send_email,track_name,view_uuid) \
                     VALUES(?,?,?,?,?,?,?,?,?,?,?)";
  db->do_sql(sql, "ddssddddsss", 
             trackcache->primary_id(), _user_id, _assembly_name.c_str(), _chrom_name.c_str(), _chrom_start, _chrom_end,
             _num_segs, _unbuilt, email, _track_name.c_str(), _view_uuid.c_str());

  if(db->last_insert_id() < 0) { return false; }
  
  _primary_db_id = db->last_insert_id();
  database(db);
  _peer_uuid = NULL;
  _db_id.clear();
  return true;
}


bool  EEDB::TrackRequest::update_unbuilt(long value) {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  _unbuilt = value;
  
  MQDB::Database *db = database();
  const char *sql = "UPDATE track_request SET unbuilt=? WHERE track_request_id=?";
  db->do_sql(sql, "dd", _unbuilt, primary_id());
  return true;
}


bool  EEDB::TrackRequest::delete_from_db() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  const char *sql = "DELETE FROM track_request WHERE track_request_id=?";
  db->do_sql(sql, "d", primary_id());
  return true;
}


/*
bool EEDB::TrackCache::log_build_request(EEDB::User *user, string assembly_name, string chrom_name, long start, long end) {
  if(_database==NULL) { return false; }
  
  zdxstream();
  if(!_zdxstream) { return false; }
  
  if(_zdxstream->is_built(assembly_name, chrom_name , start, end)) { return false; } //already built
  
  long user_id = -1;
  if(user) { user_id = user->primary_id(); }
  const char *sql = "INSERT INTO track_request (track_cache_id,user_id,assembly,chrom,start,end,num_segs,unbuilt) VALUES(?,?,?,?,?,?,?,?)";
  _database->do_sql(sql, "ddssdd", _primary_db_id, user_id, assembly_name.c_str(), chrom_name.c_str(), start, end);
  return true;
}

*/
