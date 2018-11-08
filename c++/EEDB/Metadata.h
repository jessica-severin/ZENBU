/* $Id: Metadata.h,v 1.31 2014/11/10 05:31:08 severin Exp $ */

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


#ifndef _EEDB_METADATA_H
#define _EEDB_METADATA_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

  typedef struct {
    string   mode;
    string   tag;
    string   oldvalue;
    string   newvalue;
    string   db_id;
    string   obj_filter;
  } mdedit_t;
  
  namespace JobQueue{  class Job; }

class MetadataSet;
class Feature;
class Edge;
class Expression;
class FeatureSource;
class Experiment;
class EdgeSource;
class User;
class Collaboration;
class Configuration;
class TrackCache;

class Metadata : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Metadata();               // constructor
    Metadata(string type, string data);  // constructor
    Metadata(void *xml_node); // constructor using a rapidxml node
   ~Metadata();               // destructor
    void init();              // initialization method

    bool operator==(const EEDB::Metadata& b);
    bool operator!=(const EEDB::Metadata& b);
    bool operator<(const EEDB::Metadata& b);
    bool operator>(const EEDB::Metadata& b);

    //get atribute
    string  type() { return _type; }
    string  data() { return _data; }
    int     data_size() { return _data.size(); }
    
    void    extract_keywords(EEDB::MetadataSet *mdset);
    void    extract_mdkeys(map<string, bool> &mdkey_hash);
                           
    // display
    string  display_contents();

    //database store
    bool check_exists_db(MQDB::Database *db);
    bool store(MQDB::Database *db);
    bool update();

    bool store_link_to_feature(EEDB::Feature *obj);
    bool store_link_to_edge(EEDB::Edge *obj);
    bool store_link_to_experiment(EEDB::Experiment *obj);
    bool store_link_to_featuresource(EEDB::FeatureSource *obj);
    bool store_link_to_edge_source(EEDB::EdgeSource *obj);
    bool store_link_to_user(EEDB::User *obj);
    bool store_link_to_collaboration(EEDB::Collaboration *obj);
    bool store_link_to_configuration(EEDB::Configuration *obj);
    bool store_link_to_job(EEDB::JobQueue::Job *obj);
    bool store_link_to_track_cache(EEDB::TrackCache *obj);

    bool unlink_from_feature(EEDB::Feature *obj);
    bool unlink_from_experiment(EEDB::Experiment *obj);
    bool unlink_from_feature_source(EEDB::FeatureSource *obj);
    bool unlink_from_edge_source(EEDB::EdgeSource *obj);
    bool unlink_from_user(EEDB::User *obj);
    bool unlink_from_collaboration(EEDB::Collaboration *obj);
    bool unlink_from_job(EEDB::JobQueue::Job *obj);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Metadata* obj = new EEDB::Metadata;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //
    static Metadata*         fetch_by_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all(MQDB::Database *db);
    static vector<DBObject*> fetch_all_by_feature_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_edge_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_experiment_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_feature_source_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_edge_source_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_user_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_collaboration_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_job_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_region_cache_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_track_cache_id(MQDB::Database *db, long int id);
    static vector<DBObject*> fetch_all_by_configuration_id(MQDB::Database *db, long int id);


    /**** TODO
    sub fetch_all_by_data {
      my $class = shift;
      my $db = shift;
      my $data = shift; 
      my $data_type = shift; #optional
      my $response_limit = shift; #optional
  
      const char *sql = sprintf("SELECT * FROM metadata WHERE data = ?");
      if(defined($data_type)) {
        $sql .= sprintf(" AND data_type='%s'", $data_type);
      }
      if($response_limit) {
        $sql .= sprintf(" LIMIT %d", $response_limit);
      }
      return $class->fetch_multiple($db, $sql, $data);
    }

    sub fetch_all_by_type {
      my $class = shift;
      my $db = shift;
      my $data_type = shift;
      my $response_limit = shift; #optional
  
      const char *sql = sprintf("SELECT * FROM metadata WHERE data_type='%s'", $data_type);
      if($response_limit) {
        $sql .= sprintf(" ORDER BY metadata_id LIMIT %d", $response_limit);
      }
      return $class->fetch_multiple($db, $sql);
    }

    sub fetch_all_by_feature {
      my $class = shift;
      my $feature = shift;
      my %options = @_;  #like types=>['authors','title']

      my @types = @{$options{'types'}} if($options{'types'});

      const char *sql = "SELECT m.* FROM metadata m join feature_2_metadata using(metadata_id) WHERE feature_id=?";
      $sql .= " AND data_type in (?)" if(@types);
      if(@types) {
        return $class->fetch_multiple($feature->database, $sql, $feature->id, join(',', @types));
      } else {
        return $class->fetch_multiple($feature->database, $sql, $feature->id);
      }
    }
    */

  
  protected:
    string           _type;
    string           _data;

  //internal API used for callback functions, should not be considered open API
  public:
    void    _xml(string &xml_buffer);
    string  _display_desc();


};

};   //namespace

#endif
