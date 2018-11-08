/* $Id: EdgeSource.h,v 1.14 2013/04/08 05:47:52 severin Exp $ */

/***

NAME - EEDB::EdgeSource

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

#ifndef _EEDB_EDGESOURCE_H
#define _EEDB_EDGESOURCE_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <MQDB/DBCache.h>
#include <EEDB/DataSource.h>
#include <EEDB/MetadataSet.h>

using namespace std;
using namespace MQDB;

namespace EEDB {


class EdgeSource : public EEDB::DataSource {
  public:  //global class level
    static const char*  class_name;

  public:
    EdgeSource();             // constructor
   ~EdgeSource();             // destructor
    void init();              // initialization method

    //get atribute
    string             category();
    string             classification();
    time_t             create_date();
    string             create_date_string();

    long int           edge_count();
    long int           get_edge_count();


    //set atribute
    void      category(string value);
    void      classification(string value);
    void      create_date(time_t value);


    //display and export
    void   display_info();
    string display_desc();
    string display_contents();

    bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      EdgeSource* obj = new EEDB::EdgeSource;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //

    static EdgeSource*
    fetch_by_id(MQDB::Database *db, long int id) {
      EdgeSource* obj = (EdgeSource*) MQDB::DBCache::check_cache(db, id, "EdgeSource");
      if(obj!=NULL) { obj->retain(); return obj; }
      
      const char *sql = "SELECT * FROM edge_source WHERE edge_source_id=?";
      obj = (EEDB::EdgeSource*) MQDB::fetch_single(EEDB::EdgeSource::create, db, sql, "d", id);
      
      MQDB::DBCache::add_to_cache(obj);
      return obj;
    }

    static vector<DBObject*>
    fetch_all(MQDB::Database *db) {
      const char *sql = "SELECT * FROM edge_source";
      return MQDB::fetch_multiple(EEDB::EdgeSource::create, db, sql, "");
    }

    static EdgeSource*
    fetch_by_name(MQDB::Database *db, string name) {
      const char *sql = "SELECT * FROM edge_source WHERE name=?";
      return (EEDB::EdgeSource*) MQDB::fetch_single(EEDB::EdgeSource::create, db, sql, "s", name.c_str());
    }
 
    static vector<DBObject*>
    fetch_all_by_category(MQDB::Database *db, string category) {
      const char *sql = "SELECT * FROM edge_source WHERE category=?";
      return MQDB::fetch_multiple(EEDB::EdgeSource::create, db, sql, "s", category.c_str());
    }

  protected:
    string             _category;
    string             _classification;
    time_t             _create_date;
    long int           _edge_count;

  //internal API used for callback functions, should not be considered open API
  public:
    void     _load_metadata();

    void     _xml(string &xml_buffer);
    void     _simple_xml(string &xml_buffer);
    void     _xml_start(string &xml_buffer);
    void     _xml_end(string &xml_buffer);

};

};   //namespace

#endif
