/* $Id: Edge.h,v 1.10 2019/02/27 09:00:17 severin Exp $ */

/***

NAME - EEDB::Edge

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

#ifndef _EEDB_EDGE_H
#define _EEDB_EDGE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <list>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/EdgeWeight.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Feature;

class Edge : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

    //memory management system to reuse object memory
    //use instead of new
    //eg:    EEDB::Edge *obj = EEDB::Edge::realloc();  //to 'new'
    //       obj->release();  //to 'delete' 
    static EEDB::Edge*  realloc();

  public:
    Edge();                 // constructor
   ~Edge();                 // destructor
    void init();            // initialization method

    EEDB::Edge*           copy();
    EEDB::Edge*           copy(EEDB::Edge* copy);

    //get atributes
    EEDB::EdgeSource*     edge_source();
    EEDB::MetadataSet*    metadataset();

    EEDB::Feature*        feature1();
    EEDB::Feature*        feature2();

    //string                sub_type() { return _sub_type; }
    //double                weight() { return _weight; }
    char                  direction() { return _direction; }
    long int              feature1_id();
    string                feature1_dbid();
    long int              feature2_id();
    string                feature2_dbid();

    //EdgeWeight
    vector<EEDB::EdgeWeight*>   edgeweight_array();
    void                        clear_edgeweight_array();
    void                        add_edgeweight(EEDB::EdgeWeight *edgeweight);
    EEDB::EdgeWeight*           add_edgeweight(EEDB::DataSource *source, string datatype, double weight);
    EEDB::EdgeWeight*           find_edgeweight(EEDB::DataSource *source, EEDB::Datatype *datatype);

    //set atributes
    void                  edge_source(EEDB::EdgeSource* obj);
    void                  feature1(EEDB::Feature* obj);
    void                  feature2(EEDB::Feature* obj);
    void                  feature1_id(long int id);
    void                  feature2_id(long int id);
    //void                  sub_type(string value) { _sub_type = value; }
    //void                  weight(double value)   { _weight = value; }
    void                  direction(char value)   { _direction = value; }

    //display and export
    void display_info();
    string display_desc();
    string display_contents();

    //bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Edge* obj = new EEDB::Edge;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);

    // static member functions for object retrieval from database
    static EEDB::Edge*           fetch_by_id(MQDB::Database *db, long int edge_id);
    static vector<DBObject*>     fetch_all_with_feature_id(MQDB::Database *db, long int feature_id);
    static vector<DBObject*>     fetch_all_with_feature_id(MQDB::Database *db, long int feature_id, long int source_id);
  
    static vector<EEDB::Edge*>   fetch_all_by_sources_features(MQDB::Database *db,
                                                               vector<long int> &source_ids,
                                                               vector<long int> &feature_ids);
    static void                  merge_edges(vector<EEDB::Edge*>  &edges);
  
  protected:
    EEDB::MetadataSet     _metadataset;
    EEDB::EdgeSource*     _edge_source;
    EEDB::Feature*        _feature1;
    EEDB::Feature*        _feature2;
    
    long int              _edge_source_id;
    long int              _feature1_id;
    long int              _feature2_id;
  
    //double                _weight;
    //string                _sub_type;
    char                  _direction;
    bool                  _metadata_loaded;
    
    vector<EEDB::EdgeWeight*>      _edgeweight_array;

  private:
    static vector<EEDB::Edge*>    _realloc_edge_array;
    static int                    _realloc_idx;

  public: //for callback function
    void         _dealloc();  //to fake delete
    static void  _realloc(EEDB::Edge *obj);

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);

};

};   //namespace

#endif
