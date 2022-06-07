/* $Id: DataSource.h,v 1.25 2018/12/05 00:33:15 severin Exp $ */

/***

NAME - EEDB::DataSource

SYNOPSIS

DESCRIPTION

abstract superclass for FeatureSource, Experiment, EdgeSource, ExpressionDatatype

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

#ifndef _EEDB_DATA_SOURCE_H
#define _EEDB_DATA_SOURCE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Datatype.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
  
class DataSource : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    DataSource();               // constructor
    DataSource(void *xml_node); // constructor using a rapidxml node
   ~DataSource();               // destructor
    void init();                // initialization method
    
    EEDB::DataSource*   copy();

    //get atribute
    string    name()         { return _name; }
    string    display_name();
    string    description();
    string    owner_identity();
    string    demux_key()    { return _demux_key; }
    bool      is_active()    { return _is_active; }
    bool      is_visible()   { return _is_visible; }
    time_t    create_date();
    string    create_date_string();

    void                  load_metadata();  //trigger lazy load of metadata
    EEDB::MetadataSet*    metadataset();

    //expression datatypes
    void                   clear_datatypes();
    void                   add_datatype(EEDB::Datatype* dtype);
    map<string, Datatype*> expression_datatypes();
    bool                   has_datatype(string type);

    //subsources/demux
    EEDB::DataSource*           subsource_for_key(string demux_key);
    vector<EEDB::DataSource*>   subsources();
    
    //set atribute
    void      name(string value)         { _name = value; }
    void      display_name(string value) { _display_name = value; }
    void      description(string value)  { _description = value; }
    void      owner_identity(string value) { _owner_identity = value; }
    void      demux_key(string value)    { _demux_key = value; }

    void      is_active(bool value)      { _is_active = value; }
    void      is_visible(bool value)     { _is_visible = value; }
    void      create_date(time_t value);

    void      clear_xml_caches();


    //display and export
    string _display_desc();
    string display_contents();

    bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      DataSource* obj = new EEDB::DataSource;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);

  public:  //global cache system to allow random access to previously loaded source
    static void               add_to_sources_cache(EEDB::DataSource* source);
    static EEDB::DataSource*  sources_cache_get(string dbid);
    static void               clear_sources_cache();
  
    static map<string, EEDB::DataSource*>  sources_cache;
  
  protected:
    bool              _is_active;
    bool              _is_visible;
    string            _name;
    string            _display_name;
    string            _description;
    string            _owner_identity;
    string            _demux_key;
    time_t            _create_date;
    EEDB::MetadataSet _metadataset;
    bool              _metadata_loaded;
    void              (*_funcptr_load_metadata)(EEDB::DataSource* obj);
    EEDB::DataSource* (*_funcptr_copy)(EEDB::DataSource* obj);

    string            _xml_cache;
    string            _simple_xml_cache;

    map<string, Datatype*>  _datatypes;
    bool                    _load_datatype_from_metadata();

    map<string, EEDB::DataSource*>  _subsource_hash;

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    EEDB::DataSource*   _copy(EEDB::DataSource* copy);

};

};   //namespace

#endif
