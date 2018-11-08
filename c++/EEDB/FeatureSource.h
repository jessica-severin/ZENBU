/* $Id: FeatureSource.h,v 1.31 2016/05/13 08:52:32 severin Exp $ */

/***

NAME - EEDB::FeatureSource

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

#ifndef _EEDB_FEATURESOURCE_H
#define _EEDB_FEATURESOURCE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <MQDB/DBCache.h>
#include <EEDB/DataSource.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Datatype.h>

using namespace std;
using namespace MQDB;

namespace EEDB {


class FeatureSource : public EEDB::DataSource {
  public:  //global class level
    static const char*  class_name;

  public:
    FeatureSource();               // constructor
    FeatureSource(void *xml_node); // constructor using a rapidxml node
   ~FeatureSource();               // destructor
    void init();                   // initialization method

    static EEDB::FeatureSource*  new_from_name(MQDB::Database *db, string category, string name);

    //get atribute
    string    category();
    string    import_source();
    string    comments();
    long int  feature_count();
    long int  update_feature_count();

    map<string, Datatype*> expression_datatypes();

    //set atribute
    void    category(string value);
    void    import_source(string value);
    void    comments(string value);
    void    feature_count(long int value);

    //display and export
    string _display_desc();
    string display_contents();

    bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);
  
    bool store_metadata();
    bool update_metadata();
    void parse_metadata_into_attributes();


    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject*  create(map<string, dynadata> &row_map, Database* db);
    void              init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //

    static FeatureSource*
    fetch_by_id(MQDB::Database *db, long int id) {
      FeatureSource* obj = (FeatureSource*) MQDB::DBCache::check_cache(db, id, "FeatureSource");
      if(obj!=NULL) { obj->retain(); return obj; }
      
      const char *sql = "SELECT * FROM feature_source WHERE feature_source_id=?";
      obj = (EEDB::FeatureSource*) MQDB::fetch_single(EEDB::FeatureSource::create, db, sql, "d", id);

      MQDB::DBCache::add_to_cache(obj);
      return obj;
    }

    static vector<DBObject*>
    fetch_all(MQDB::Database *db) {
      const char *sql = "SELECT * FROM feature_source";
      return MQDB::fetch_multiple(EEDB::FeatureSource::create, db, sql, "");
    }

    static FeatureSource*
    fetch_by_name(MQDB::Database *db, string name) {
      const char *sql = "SELECT * FROM feature_source WHERE name=?";
      return (EEDB::FeatureSource*) MQDB::fetch_single(EEDB::FeatureSource::create, db, sql, 
                        "s", name.c_str());
    }

    static FeatureSource*
    fetch_by_category_name(MQDB::Database *db, string category, string name) {
      const char *sql = "SELECT * FROM feature_source WHERE name=? and category=?";
      return (EEDB::FeatureSource*) MQDB::fetch_single(EEDB::FeatureSource::create, db, sql, 
                        "ss", name.c_str(), category.c_str());
    }
    

  protected:
    string             _category;
    string             _import_source;
    string             _comments;
    long int           _feature_count;

    bool               _load_datatype_from_db();

  //internal API used for callback functions, should not be considered open API
  public:
    void     _load_metadata();

    void     _xml(string &xml_buffer);
    void     _simple_xml(string &xml_buffer);
    void     _xml_start(string &xml_buffer);
    void     _xml_end(string &xml_buffer);
    void     _mdata_xml(string &xml_buffer, map<string,bool> tags);

};

};   //namespace

#endif
