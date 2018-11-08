/*  $Id: Job.cpp,v 1.23 2016/10/05 08:52:58 severin Exp $ */

/*******

NAME - EEDB::JobQueue::Job

SYNOPSIS

DESCRIPTION

CONTACT

  Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
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
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/JobQueue/Job.h>
#include <EEDB/Chrom.h>
#include <sqlite3.h>
#include <stdarg.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::JobQueue::Job::class_name = "EEDB::JobQueue::Job";

void _eedb_job_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::JobQueue::Job*)obj;
}
void _eedb_job_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::JobQueue::Job*)obj)->_xml(xml_buffer);
}
void _eedb_job_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::JobQueue::Job*)obj)->_xml(xml_buffer);
}
string _eedb_job_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::JobQueue::Job*)obj)->_display_desc();
}

EEDB::JobQueue::Job::Job() {
  init();
}

EEDB::JobQueue::Job::Job(EEDB::User *user) {
  init();
  
  if(!user) { return; }
  if(user->database() == NULL) { return; }
  
  _user = user;
  _status = "READY";
}

EEDB::JobQueue::Job::~Job() {
}


void EEDB::JobQueue::Job::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::JobQueue::Job::class_name;
  _funcptr_delete            = _eedb_job_delete_func;
  _funcptr_display_desc      = _eedb_job_display_desc_func;
  _funcptr_xml               = _eedb_job_xml_func;
  _funcptr_simple_xml        = _eedb_job_simple_xml_func;
  _created                   = 0;
  _completed                 = 0;
  _status                    = "READY";
  _metadata_loaded           = false;
  _user                      = NULL;
  _user_id                   = -1;
  _analysis_id               = -1;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////



string    EEDB::JobQueue::Job::created_date_string() { 
  string str;
  if(_created>0) {
    time_t t_update = _created;
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

string    EEDB::JobQueue::Job::completed_date_string() { 
  string str;
  if(_completed>0) {
    time_t t_update = _completed;
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


EEDB::User*   EEDB::JobQueue::Job::user() {
  if(_user) { return _user; }
  
  if((_database != NULL) && (_user_id != -1)) { 
    _user = EEDB::User::fetch_by_id(_database, _user_id);
  }
  return _user;
}


EEDB::MetadataSet*   EEDB::JobQueue::Job::metadataset() {
  if(!_metadata_loaded) {
    _metadata_loaded = true;
    if(_database != NULL) {      
      vector<DBObject*> mdata = EEDB::Metadata::fetch_all_by_job_id(_database, _primary_db_id);
      _metadataset.add_metadata(mdata);
    }
    //$self->{'metadataset'}->remove_duplicates;
  }
  return &_metadataset;
}


void   EEDB::JobQueue::Job::status(string value) {
  _status = value;
}


string  EEDB::JobQueue::Job::display_name() { 
  EEDB::Metadata *md;
  if((md = metadataset()->find_metadata("display_name", ""))) { return md->data(); }
  return "";
}

string  EEDB::JobQueue::Job::description() { 
  EEDB::Metadata *md;
  if((md = metadataset()->find_metadata("description", ""))) { return md->data(); }
  return "";
}

string  EEDB::JobQueue::Job::genome_name() { 
  EEDB::Metadata *md;
  if((md = metadataset()->find_metadata("assembly", ""))) { return md->data(); }
  return "";
}

////////////////////////////////////////////////////////////////



string EEDB::JobQueue::Job::_display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "Job(db %ld ) %s", 
    _primary_db_id, 
    created_date_string().c_str());
  return buffer;
}


void EEDB::JobQueue::Job::_xml(string &xml_buffer) {

  xml_buffer.append("<job status=\"");
  xml_buffer.append(_status);
  xml_buffer.append("\" create_date=\"");
  xml_buffer.append(created_date_string());
  xml_buffer.append("\">\n");

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }
  
  xml_buffer.append("</job>\n"); 
}

EEDB::JobQueue::Job::Job(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "job") { return; }
  
  if((attr = root_node->first_attribute("status"))) { _status = attr->value(); }
  
  if((attr = root_node->first_attribute("create_date"))) {
    string date_string = attr->value();
    _created = MQDB::seconds_from_epoch(date_string);    
  }
  
  // metadata
  EEDB::MetadataSet *mdset = metadataset();
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      mdset->add_metadata(mdata);
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      mdset->add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }  
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// class level MQDB style fetch methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::JobQueue::Job::init_from_row_map(map<string, dynadata> &row_map) {
  /*
   | job_id       | int(11)                                                 |      | PRI | NULL                | auto_increment |
   | analysis_id  | int(11)                                                 |      | MUL | 0                   |                |
   | user_id      | int(11)                                                 |      |     | 0                   |                |
   | job_claim    | char(40)                                                |      | MUL |                     |                |
   | worker_id    | int(11)                                                 |      | MUL | 0                   |                |
   | status       | enum('READY','BLOCKED','CLAIMED','RUN','DONE','FAILED') |      |     | READY               |                |
   | retry_count  | int(11)                                                 |      |     | 0                   |                |
   | created      | timestamp                                               | YES  |     | CURRENT_TIMESTAMP   |                |
   | completed    | datetime                                                |      |     | 0000-00-00 00:00:00 |                |
   | branch_code  | int(11)                                                 |      |     | 1                   |                |
   | runtime_msec | int(11)                                                 |      |     | 0                   |                |
   | query_count  | int(11)                                                 |      |     | 0                   |                |   
   */
  
  
  _primary_db_id   = row_map["job_id"].i_int;
  _status          = row_map["status"].i_string;
  _user_id         = row_map["user_id"].i_int;
  _analysis_id     = row_map["analysis_id"].i_int;
  
  /*
   _taxon_id        = row_map["taxon_id"].i_int;
   _ucsc_name       = row_map["ucsc_name"].i_string;
   _primary_db_id   = row_map["collaboration_id"].i_int;
   _group_uuid      = row_map["uuid"].i_string;
   _owner_identity  = row_map["owner_openid"].i_string;
   _display_name    = row_map["display_name"].i_string;
   _member_status   = row_map["member_status"].i_string;
      
   if(row_map["openID"].type == STRING) {
   if(row_map["openID"].i_string == _owner_identity) { _member_status = "OWNER"; }
   }
   if(_member_status.empty()) { _member_status = "not_member"; }   
   */
  
  if(row_map["completed"].type == MQDB::STRING) {
    string date_string = row_map["completed"].i_string;
    _completed = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["completed"].type == MQDB::TIMESTAMP) {
    _completed = row_map["completed"].i_timestamp;
  }
  if(row_map["created"].type == MQDB::STRING) {
    string date_string = row_map["created"].i_string;
    _created = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["created"].type == MQDB::TIMESTAMP) {
    _created = row_map["created"].i_timestamp;
  }
  
}


vector<MQDB::DBObject*>  EEDB::JobQueue::Job::fetch_all_by_user(EEDB::User *user) {
  vector<MQDB::DBObject*> t_result;
  if(!user) { return t_result; }
  if(user->database() == NULL) { return t_result; }
  
  MQDB::Database *db = user->database();
  //ignore DONE and older than 24hour jobs
  const char *sql = "SELECT * FROM job WHERE user_id=? AND status!='DONE' AND (UNIX_TIMESTAMP()-UNIX_TIMESTAMP(created))/86400<=1.0 ORDER BY created";
  return MQDB::fetch_multiple(EEDB::JobQueue::Job::create, db, sql, "d", user->primary_id());
}


EEDB::JobQueue::Job*  EEDB::JobQueue::Job::fetch_by_id(MQDB::Database *db, long int id) {  
  const char *sql = "SELECT * FROM job WHERE job_id=?";
  EEDB::JobQueue::Job *job = (EEDB::JobQueue::Job*) MQDB::fetch_single(EEDB::JobQueue::Job::create, db, sql, "d", id);
  return job;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// MappedQuery storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::JobQueue::Job::store() {
  if(_user == NULL) { return false; }
  MQDB::Database *db = _user->database();
  if(db==NULL) { return false; }
  
  db->do_sql("INSERT INTO job(user_id, status) VALUES(?,?)", "ds", 
             _user->primary_id(), _status.c_str());
  
  if(db->last_insert_id() < 0) { return false; }
  
  _primary_db_id = db->last_insert_id();
  database(db);
  _peer_uuid = NULL;
  _db_id.clear();
  
  //now do the symbols and metadata  
  store_metadata();  
  return true;
}


bool EEDB::JobQueue::Job::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  metadataset()->remove_duplicates();

  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Metadata::class_name) {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_job(this);
    }
  }
  return true;
}


bool EEDB::JobQueue::Job::update_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  //unlink all old metadata
  db->do_sql("DELETE FROM job_2_metadata WHERE job_id=?", "d", primary_id());
  
  //store again
  store_metadata();
  return true;
}



