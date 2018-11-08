/* $Id: Metadata.cpp,v 1.96 2016/04/13 08:49:26 severin Exp $ */

/***
NAME - EEDB::Metadata

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

#include <MQDB/MappedQuery.h>
#include <EEDB/Metadata.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Configuration.h>
#include <EEDB/JobQueue/Job.h>
#include <EEDB/TrackCache.h>

using namespace std;
using namespace MQDB;
using namespace boost::algorithm;

const char*               EEDB::Metadata::class_name = "Metadata";

void _eedb_metadata_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Metadata*)obj;
}
void _eedb_metadata_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Metadata*)obj)->_xml(xml_buffer);
}
void _eedb_metadata_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Metadata*)obj)->_xml(xml_buffer);
}
string _eedb_metadata_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::Metadata*)obj)->_display_desc();
}


EEDB::Metadata::Metadata() {
  init();
}

EEDB::Metadata::Metadata(string type, string data) {
  init();
  _type.swap(type);
  _data.swap(data);
}

EEDB::Metadata::~Metadata() {
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}

void EEDB::Metadata::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::Metadata::class_name;
  _funcptr_delete            = _eedb_metadata_delete_func;
  _funcptr_xml               = _eedb_metadata_xml_func;
  _funcptr_simple_xml        = _eedb_metadata_simple_xml_func;
  _funcptr_display_desc      = _eedb_metadata_display_desc_func;
}

bool EEDB::Metadata::operator== (const EEDB::Metadata& b) {
  string  a_class = classname();
  string  b_class = ((EEDB::Metadata)b).classname();
  return (
          (a_class == b_class) &&
          (_type == b._type) && 
          (to_lower_copy(_data) == to_lower_copy(b._data)));
}

bool EEDB::Metadata::operator!= (const EEDB::Metadata& b) {
  string  a_class = classname();
  string  b_class = ((EEDB::Metadata)b).classname();
  return (
          (a_class != b_class) || 
          (_type != b._type) || 
          (to_lower_copy(_data) != to_lower_copy(b._data)));
}

bool EEDB::Metadata::operator< (const EEDB::Metadata& b) {
  string  a_class = classname();
  string  b_class = ((EEDB::Metadata)b).classname();
  if(a_class != b_class) {
    if(a_class > b_class) { return true; } else { return false; }
  }
  if(_type != b._type) {
    if(_type < b._type) { return true; } else { return false; }
  }
  string d1 = to_lower_copy(_data);
  string d2 = to_lower_copy(b._data);
  if(d1 != d2) {
    if(d1 < d2) { return true; } else { return false; }
  }
  if(_primary_db_id != b._primary_db_id) {
    if(_primary_db_id < 0) { return false; }
    if(b._primary_db_id < 0) { return true; }   
    if(_primary_db_id < b._primary_db_id) { return true; } else { return false; }
  }
  return false;
}

string EEDB::Metadata::_display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "Metadata(%ld) %s (%d bytes)", 
      _primary_db_id, _type.c_str(), data_size());
  return buffer;
}

string EEDB::Metadata::display_contents() {
  char buffer[256];
  snprintf(buffer, 256, "Metadata(%ld) [%s]:", 
      _primary_db_id, _type.c_str());
  string str = buffer;
  str += "\"" + data() + "\"";
  return str;
}

void EEDB::Metadata::_xml(string &xml_buffer) {
  xml_buffer.append("<mdata type=\"");
  xml_buffer.append(html_escape(_type));
  xml_buffer.append("\">");
  
  if(_type == "configXML") {
    xml_buffer.append(_data);
  } else {
    xml_buffer.append(html_escape(_data));
  }

  xml_buffer.append("</mdata>\n");
}

EEDB::Metadata::Metadata(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  _data.clear();
  if(string(root_node->name()) != "mdata") { return; }
  if((attr = root_node->first_attribute("type"))) { _type = attr->value(); }
  if(root_node->value()) { 
    _data = root_node->value(); 
  }
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// keyword analysis
//
//////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::Metadata::extract_keywords(EEDB::MetadataSet *mdset) {
  if(mdset == NULL) { return; }

  //split primary keywords on , ( ) [ ] { } : ; ! ? ' " or whitespace
  //secondary split on . _ - /
  map<string, bool> unq_keywords;
  char* data_buf = (char*)malloc(_data.size() + 3);
  strcpy(data_buf, _data.c_str());
  const char * seps = ",[](){};<>&#$!\? \'\"\t\n\r";
  char *tok = strtok(data_buf, seps);
  while(tok != NULL) {
    int tok_len = strlen(tok);

    //remove an ending . (periods)
    while((tok_len>0) && (tok[tok_len-1] == '.')) {
      tok[tok_len-1] = '\0';
      tok_len--;
    }
    if(tok_len <= 1) { tok = strtok(NULL, seps); continue; }
  
    //convert all keywords to lowercase
    for(int i=0; i<tok_len; i++) {
      tok[i] = tolower(tok[i]);
    }

    if((strcmp(tok, "of")==0) or
       (strcmp(tok, "is")==0) or 
       (strcmp(tok, "are")==0) or
       (strcmp(tok, "were")==0) or
       (strcmp(tok, "he")==0) or 
       (strcmp(tok, "from")==0) or
       (strcmp(tok, "for")==0) or 
       (strcmp(tok, "the")==0) or 
       (strcmp(tok, "and")==0) or 
       (strcmp(tok, "or")==0) or 
       (strcmp(tok, "with")==0) or 
       (strcmp(tok, "this")==0) or 
       (strcmp(tok, "to")==0) or 
       (strcmp(tok, "in")==0) or
       (strcmp(tok, "no")==0))
    {
      tok = strtok(NULL, seps); 
      continue;
    }

    //printf("   "%s"\n", tok);
    unq_keywords[tok] = true;
    
    tok = strtok(NULL, seps);
  }
  free(data_buf);

  map<string, bool>::iterator  it;
  for(it=unq_keywords.begin(); it!=unq_keywords.end(); it++) {
    mdset->add_tag_symbol("keyword", (*it).first);

    //sub-keyword tests
    if((*it).first.find_first_of("-_./") != string::npos) {
      char* data_buf = (char*)malloc((*it).first.size() + 3);
      strcpy(data_buf, (*it).first.c_str());
      char *tok = strtok(data_buf, "-_./");
      while(tok != NULL) {
        int tok_len = strlen(tok);
        if(tok_len >= 2) {
          mdset->add_tag_symbol("keyword", tok);
        }
        tok = strtok(NULL, "-_./");
      }
      free(data_buf);
    }
  }
}


void  EEDB::Metadata::extract_mdkeys(map<string, bool> &mdkey_hash) {
  if(_data.empty()) { return; }
  if(_data.size()<2) { return; }
  
  char* data_buf = (char*)malloc(_data.size() + 3);
  strcpy(data_buf, _data.c_str());
  long len = _data.size();
  char mdkey[4];
  bzero(mdkey, 4);
  
  //fprintf(stderr, "extract_mdkeys from [%s]\n", _data.c_str());
  long i=0;
  while(i<len-2) {
    mdkey[0] = tolower(data_buf[i]);
    mdkey[1] = tolower(data_buf[i+1]);
    mdkey[2] = tolower(data_buf[i+2]);    
    mdkey_hash[mdkey] = true;
    //fprintf(stderr, "  mdkey [%s]\n", mdkey);
    i++;
  }
  
  mdkey[0] = tolower(data_buf[i]);
  mdkey[1] = tolower(data_buf[i+1]);
  mdkey[2] = ' ';
  mdkey_hash[mdkey] = true;
  //fprintf(stderr, "  mdkey [%s]\n", mdkey);

  free(data_buf);
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods : storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::Metadata::check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  dynadata value = db->fetch_col_value("SELECT metadata_id FROM metadata where data_type=? and data=?", "ss", 
                                       _type.c_str(), _data.c_str());
  if(value.type != MQDB::INT) { return false; }
  
  _primary_db_id = value.i_int;
  database(db);
  return true;
}


bool EEDB::Metadata::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(check_exists_db(db)) { return true; }
  
  db->do_sql("INSERT INTO metadata (data_type, data) VALUES(?,?)", "ss", 
             _type.c_str(), _data.c_str());
             
  return check_exists_db(db);  //checks the database and sets the id
}


bool EEDB::Metadata::update() {
  //use with extreme caution since metadata can be shared between objects!!!!!
  if(_database == NULL) { return false; }
  if(_primary_db_id == -1) { return false; }
  
  _database->do_sql("UPDATE metadata SET data_type=?, data=? WHERE metadata_id=?", "ssd", 
                    _type.c_str(), _data.c_str(), _primary_db_id);
  return true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// static member functions for object retrieval from database
//
//////////////////////////////////////////////////////////////////////////////////////////////////

EEDB::Metadata*  EEDB::Metadata::fetch_by_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT * FROM metadata WHERE metadata_id=?";
  return (EEDB::Metadata*) MQDB::fetch_single(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM metadata";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "");
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_feature_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join feature_2_metadata using(metadata_id) WHERE feature_id=?";
  //$sql .= sprintf(" AND data_type=\"%s\"", $type) if($type);
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_edge_id(MQDB::Database *db, long int id) {
  const char*  sql = "SELECT m.* FROM metadata m join edge_2_metadata using(metadata_id) WHERE edge_id=?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_experiment_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join experiment_2_metadata using(metadata_id) WHERE experiment_id=?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_feature_source_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join feature_source_2_metadata using(metadata_id) where feature_source_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_edge_source_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join edge_source_2_metadata using(metadata_id) where edge_source_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_user_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join user_2_metadata using(metadata_id) where user_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_collaboration_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join collaboration_2_metadata using(metadata_id) where collaboration_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_job_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join job_2_metadata using(metadata_id) where job_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_region_cache_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join region_cache_2_metadata using(metadata_id) where region_cache_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_track_cache_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join track_cache_2_metadata using(metadata_id) where track_cache_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Metadata::fetch_all_by_configuration_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT m.* FROM metadata m join configuration_2_metadata using(metadata_id) where configuration_id = ?";
  return MQDB::fetch_multiple(EEDB::Metadata::create, db, sql, "d", id);
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// link to objects
//
//////////////////////////////////////////////////////////////////////////////////////////////////


bool EEDB::Metadata::store_link_to_feature(EEDB::Feature *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO feature_2_metadata (feature_id, metadata_id) VALUES(?,?)", "dd", 
            obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_experiment(EEDB::Experiment *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO experiment_2_metadata (experiment_id, metadata_id) VALUES(?,?)", "dd", 
            obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_featuresource(EEDB::FeatureSource *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO feature_source_2_metadata (feature_source_id, metadata_id) VALUES(?,?)", "dd", 
            obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_edge_source(EEDB::EdgeSource *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO edge_source_2_metadata (edge_source_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_edge(EEDB::Edge *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO edge_2_metadata (edge_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_user(EEDB::User *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO user_2_metadata (user_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_collaboration(EEDB::Collaboration *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }

  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
    
  db->do_sql("INSERT ignore INTO collaboration_2_metadata (collaboration_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_configuration(EEDB::Configuration *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }
  
  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
  
  db->do_sql("INSERT ignore INTO configuration_2_metadata (configuration_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_job(EEDB::JobQueue::Job *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }
  
  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
  
  db->do_sql("INSERT ignore INTO job_2_metadata (job_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


bool EEDB::Metadata::store_link_to_track_cache(EEDB::TrackCache *obj) {
  if(obj==NULL) { return false; }
  if(obj->database() == NULL) { return false; }
  if(obj->primary_id() == -1) { return false; }
  
  MQDB::Database *db = obj->database();
  if(!check_exists_db(db)) { if(!store(db)) { return false; } }
  
  db->do_sql("INSERT ignore INTO track_cache_2_metadata (track_cache_id, metadata_id) VALUES(?,?)", "dd", 
             obj->primary_id(), _primary_db_id);
  return true;
}


////////////////////////////////////////////////////////////////////////////////////////////
//
// unlink methods
//
////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::Metadata::unlink_from_feature(EEDB::Feature *obj) {
  return false;
}

bool EEDB::Metadata::unlink_from_experiment(EEDB::Experiment *obj) {
  return false;
}

bool EEDB::Metadata::unlink_from_feature_source(EEDB::FeatureSource *obj) {
  return false;
}

bool EEDB::Metadata::unlink_from_edge_source(EEDB::EdgeSource *obj) {
  return false;
}

bool EEDB::Metadata::unlink_from_user(EEDB::User *obj) {
  return false;
}

bool EEDB::Metadata::unlink_from_collaboration(EEDB::Collaboration *obj) {
  return false;
}

bool EEDB::Metadata::unlink_from_job(EEDB::JobQueue::Job *obj) {
  return false;
}

//////////////////////////////////////////////////////////////////



/********** TODO

sub unlink_from_feature { 
  my $self = shift;
  my $feature = shift;
  
  unless($feature->database) {
    printf(STDERR "ERROR:: %s has no database to link Metadata\n", $feature->simple_display_desc);
    die();
  }
  $feature->database->execute_sql(
      "DELETE from feature_2_metadata where feature_id=? and metadata_id=?",
      $feature->id, $self->id);
}

sub unlink_from_experiment { 
  my $self = shift;
  my $experiment = shift;
  
  unless($experiment->database) {
    printf(STDERR "ERROR:: %s has no database to link Metadata\n", $experiment->display_desc);
    die();
  }
  $experiment->database->execute_sql(  
      "DELETE from experiment_2_metadata where experiment_id=? and metadata_id=?",
      $experiment->id, $self->id);
}

sub unlink_from_feature_source { 
  my $self = shift;
  my $fsrc = shift;
  
  unless($fsrc->database) {
    printf(STDERR "ERROR:: %s has no database to link Metadata\n", $fsrc->display_desc);
    die();
  }
  $fsrc->database->execute_sql(  
      "DELETE from feature_source_2_metadata where feature_source_id=? and metadata_id=?",
      $fsrc->id, $self->id);
}

sub unlink_from_edge_source { 
  my $self = shift;
  my $edge_source = shift;
  
  unless($edge_source->database) {
    printf(STDERR "ERROR:: %s has no database to link Metadata\n", $edge_source->display_desc);
    die();
  }
  $edge_source->database->execute_sql(  
      "DELETE from edge_source_2_metadata where edge_source_id=? and metadata_id=?",
      $edge_source->id, $self->id);
}

sub unlink_from_user { 
  my $self = shift;
  my $user = shift;
  
  unless($user->database) {
    printf(STDERR "ERROR:: %s has no database to link Metadata\n", $user->display_desc);
    die();
  }
  $user->database->execute_sql(  
      "DELETE from user_2_metadata where user_id=? and metadata_id=?",
      $user->id, $self->id);
}
**********/


void  EEDB::Metadata::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["metadata_id"].i_int;
  _type.swap(row_map["data_type"].i_string);
  _data.swap(row_map["data"].i_string);
}


