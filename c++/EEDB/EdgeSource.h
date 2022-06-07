/* $Id: EdgeSource.h,v 1.18 2017/10/12 07:58:15 severin Exp $ */

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
#include <EEDB/Peer.h>
#include <EEDB/DataSource.h>
#include <EEDB/MetadataSet.h>

using namespace std;
using namespace MQDB;

namespace EEDB {


class EdgeSource : public EEDB::DataSource {
  public:  //global class level
    static const char*  class_name;

  public:
    EdgeSource();               // constructor
    EdgeSource(void *xml_node); // constructor using a rapidxml node
   ~EdgeSource();               // destructor
    void init();                // initialization method

    //get atribute
    EEDB::FeatureSource*    feature_source1();
    EEDB::FeatureSource*    feature_source2();
    string                  feature_source1_dbid();
    string                  feature_source2_dbid();
    string                  category();
    string                  classification();

    string                  feature_source1_uuid();
    string                  feature_source2_uuid();
    EEDB::Peer*             feature_source1_peer();
    EEDB::Peer*             feature_source2_peer();

    long int                edge_count();
    long int                get_edge_count();
  
    //set atribute
    void      category(string value);
    void      classification(string value);
    void      feature_source1(EEDB::FeatureSource* fsrc);
    void      feature_source2(EEDB::FeatureSource* fsrc);
    void      feature_source1_dbid(string id);
    void      feature_source2_dbid(string id);
    void      edge_count(long value);


    //display and export
    void   display_info();
    string display_desc();
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
      EdgeSource* obj = new EEDB::EdgeSource;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);

    // static member functions for object retrieval from database
    static EEDB::EdgeSource*       fetch_by_id(MQDB::Database *db, long int id);
    static vector<DBObject*>       fetch_all(MQDB::Database *db);
    static EEDB::EdgeSource*       fetch_by_name(MQDB::Database *db, string name);
    static vector<DBObject*>       fetch_all_by_category(MQDB::Database *db, string category);

  protected:
    string                 _category;
    string                 _classification;
    long int               _edge_count;
    EEDB::FeatureSource*   _feature_source1;
    EEDB::FeatureSource*   _feature_source2;
    string                 _feature_source1_dbid;
    string                 _feature_source2_dbid;
  private:
    EEDB::Peer*            _feature_source1_peer;
    EEDB::Peer*            _feature_source2_peer;


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
