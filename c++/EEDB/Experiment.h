/* $Id: Experiment.h,v 1.31 2018/12/05 00:35:20 severin Exp $ */

/***

NAME - EEDB::Experiment

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

#ifndef _EEDB_EXPERIMENT_H
#define _EEDB_EXPERIMENT_H

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


class Experiment : public EEDB::DataSource {
  public:  //global class level
    static const char*  class_name;

  public:
    Experiment();               // constructor
    Experiment(void *xml_node, bool load_metadata); // constructor using a rapidxml node
   ~Experiment();               // destructor
    void init();                // initialization method

    bool operator==(EEDB::Experiment* b);

    //set atribute
    void      platform(string value);
    void      series_name(string value);
    void      series_point(double value);

    //get atribute
    string    platform();
    string    series_name();
    double    series_point();

    map<string, Datatype*> expression_datatypes();


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
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Experiment* obj = new EEDB::Experiment;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //

    static Experiment*
    fetch_by_id(MQDB::Database *db, long int id) {
      Experiment* obj = (Experiment*) MQDB::DBCache::check_cache(db, id, "Experiment");
      if(obj!=NULL) { obj->retain(); return obj; }
      
      const char *sql = "SELECT * FROM experiment WHERE experiment_id=?";
      obj = (EEDB::Experiment*) MQDB::fetch_single(EEDB::Experiment::create, db, sql, "d", id);

      MQDB::DBCache::add_to_cache(obj);
      return obj;
    }


    static vector<DBObject*>
    fetch_all(MQDB::Database *db) {
      const char *sql = "SELECT * FROM experiment ORDER BY platform, series_name, series_point, exp_accession";
      return MQDB::fetch_multiple(EEDB::Experiment::create, db, sql, "");
    }


    static vector<DBObject*>
    fetch_all_by_platform(MQDB::Database *db, string platform) {
      const char *sql = "SELECT * FROM experiment WHERE platform=? ORDER BY platform, series_name, series_point, exp_accession";
      return MQDB::fetch_multiple(EEDB::Experiment::create, db, sql, "s", platform.c_str());
    }


    static Experiment*
    fetch_by_name(MQDB::Database *db, string name) {      
      const char *sql = "SELECT * FROM experiment WHERE exp_accession=?";
      return (EEDB::Experiment*) MQDB::fetch_single(EEDB::Experiment::create, db, sql, "s", name.c_str());
    }

    static bool sort_func (EEDB::Experiment *a, EEDB::Experiment *b);  //to be used by STL sort() calls

  protected:
    string             _platform;
    string             _series_name;
    double             _series_point;

    bool               _load_datatype_from_db();

  //internal API used for callback functions, should not be considered open API
  public:
    void     _load_metadata();

    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    void   _mdata_xml(string &xml_buffer, map<string,bool> mdtags);
    EEDB::DataSource*   _copy(EEDB::DataSource* copy);

  
};

};   //namespace

#endif
