/* $Id: Symbol.h,v 1.17 2013/04/08 05:47:52 severin Exp $ */

/***

NAME - EEDB::Symbol

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

#ifndef _EEDB_SYMBOL_H
#define _EEDB_SYMBOL_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Metadata.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Symbol : public EEDB::Metadata {
  public:  //global class level
    static const char*  class_name;

  public:
    Symbol();                 // constructor
    Symbol(string type, string data);  // constructor
    Symbol(const char* type, const char* data);  // constructor
    Symbol(void *xml_node);   // constructor using a rapidxml node
   ~Symbol();                 // destructor
    void init();              // initialization method

    static bool is_symbol(string value);
  
    //get atribute
    string symbol() { return _data; }

    string display_contents();

    bool check_exists_db(MQDB::Database *db);
    bool store(MQDB::Database *db);
    bool update(MQDB::Database *db) { return false; }  //override superclass method

    bool store_link_to_feature(EEDB::Feature *obj);
    bool store_link_to_edge(EEDB::Edge *obj);
    bool store_link_to_experiment(EEDB::Experiment *obj);
    bool store_link_to_featuresource(EEDB::FeatureSource *obj);
    bool store_link_to_edge_source(EEDB::EdgeSource *obj);
    bool store_link_to_user(EEDB::User *obj);
    bool store_link_to_collaboration(EEDB::Collaboration *obj);
    bool store_link_to_configuration(EEDB::Configuration *obj);

    bool unlink_from_feature(EEDB::Feature *obj);
    bool unlink_from_experiment(EEDB::Experiment *obj);
    bool unlink_from_feature_source(EEDB::FeatureSource *obj);
    bool unlink_from_edge_source(EEDB::EdgeSource *obj);
    bool unlink_from_user(EEDB::User *obj);


    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Symbol* obj = new EEDB::Symbol;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //

    static Symbol*
    fetch_by_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT * FROM symbol WHERE symbol_id=?";
      return (EEDB::Symbol*) MQDB::fetch_single(EEDB::Symbol::create, db, sql, "d", id);
    }

    static Symbol*
    fetch_by_type_name(MQDB::Database *db, const char *type, const char *data) {
      const char *sql = "SELECT * FROM symbol WHERE sym_value = ? AND sym_type=?";
      return (EEDB::Symbol*) MQDB::fetch_single(EEDB::Symbol::create, db, sql, "ss", type, data);
    }


    static vector<DBObject*>
    fetch_all(MQDB::Database *db) {
      const char *sql = "SELECT * FROM symbol";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "");
    }

    static vector<DBObject*>
    fetch_all_by_feature_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT * FROM feature_2_symbol join symbol using(symbol_id) where feature_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }

    static vector<DBObject*>
    fetch_all_by_edge_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT * FROM edge_2_symbol join symbol using(symbol_id) where edge_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }


    static vector<DBObject*>
    fetch_all_by_experiment_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT * FROM experiment_2_symbol join symbol using(symbol_id) where experiment_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }

    static vector<DBObject*>
    fetch_all_by_feature_source_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT s.* FROM symbol s join feature_source_2_symbol using(symbol_id) where feature_source_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }

    static vector<DBObject*>
    fetch_all_by_edge_source_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT s.* FROM symbol s join edge_source_2_symbol using(symbol_id) where edge_source_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }

    static vector<DBObject*>
    fetch_all_by_user_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT s.* FROM symbol s join user_2_symbol using(symbol_id) where user_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }

    static vector<DBObject*>
    fetch_all_by_collaboration_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT s.* FROM symbol s join collaboration_2_symbol using(symbol_id) where collaboration_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }

    static vector<DBObject*>
    fetch_all_by_configuration_id(MQDB::Database *db, long int id) {
      const char *sql = "SELECT s.* FROM symbol s join configuration_2_symbol using(symbol_id) where configuration_id = ?";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "d", id);
    }
  

    static vector<DBObject*>
    fetch_all_symbol_search(MQDB::Database *db, string value, string type) {
      const char *sql = "SELECT * FROM symbol WHERE sym_type=? AND sym_value like ?";
      value += "%";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "ss", type.c_str(), value.c_str());
    }

    static vector<DBObject*>
    fetch_all_symbol_search(MQDB::Database *db, string value) {
      const char *sql = "SELECT * FROM symbol WHERE sym_value like ?";
      value += "%";
      return MQDB::fetch_multiple(EEDB::Symbol::create, db, sql, "s", value.c_str());
    }


    static long int 
    get_count_symbol_search(MQDB::Database *db, string value, string type) {
      const char *sql = "SELECT count(distinct symbol_id) from symbol WHERE sym_type=? AND sym_value like ?";
      value += "%";
      dynadata dd = db->fetch_col_value(sql, "ss", type.c_str(), value.c_str());
      return dd.i_int;
    }

    static long int 
    get_count_symbol_search(MQDB::Database *db, string value) {
      const char *sql = "SELECT count(distinct symbol_id) from symbol WHERE sym_value like ?";
      value += "%";
      dynadata dd = db->fetch_col_value(sql, "s", value.c_str());
      return dd.i_int;
    }

  //internal API used for callback functions, should not be considered open API
  public:
    void    _xml(string &xml_buffer);
    string  _display_desc();

};

};   //namespace

#endif
