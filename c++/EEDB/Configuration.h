/* $Id: Configuration.h,v 1.21 2018/03/20 02:38:22 severin Exp $ */

/***

NAME - EEDB::Configuration

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

#ifndef _EEDB_CONFIGURATION_H
#define _EEDB_CONFIGURATION_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <MQDB/DBObject.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Collaboration.h>

using namespace std;
using namespace MQDB;

namespace EEDB {


class Configuration : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Configuration();   // constructor
    Configuration(void *xml_node); // constructor using a rapidxml node
   ~Configuration();   // destructor
    void init();       // initialization method

    //set atribute
    void      uuid(string value);
    void      config_type(string value);
    void      owner(EEDB::User* value);
    void      access_count(long value);

    //get atribute
    EEDB::User*          owner();
    string               uuid();
    string               fixed_id();
    string               config_type();
    string               display_name();
    string               description();
    string               configXML();
    long                 access_count();
    time_t               create_date() { return _create_date; }
    time_t               last_access() { return _last_access; }
    string               last_access_date_string();
    string               create_date_string();

    EEDB::MetadataSet*   metadataset();
    EEDB::Collaboration* collaboration();
  
    map<string, EEDB::DataSource*>  get_all_data_sources();

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db);
    void             init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static Configuration*     fetch_by_id(MQDB::Database *db, long int id);
    static vector<DBObject*>  fetch_all(MQDB::Database *db);
    static Configuration*     fetch_by_uuid(MQDB::Database *db, string uuid);  //not secured
    static Configuration*     fetch_by_uuid(MQDB::Database *db, string uuid, EEDB::User* user);
    static vector<DBObject*>  fetch_all_by_type(MQDB::Database *db, string config_type, EEDB::User* user);
    static vector<DBObject*>  fetch_by_metadata_search(MQDB::Database *db, string config_type, 
                                                       EEDB::User* user, string filter_logic);
    static vector<DBObject*>  fetch_all_with_keywords(MQDB::Database *db, string config_type, 
                                                      EEDB::User* user, vector<string> &keywords);
    static vector<DBObject*>  fetch_by_uuid_list(MQDB::Database *db, EEDB::User* user, string uuid_list);

    //db methods store methods
    bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);
    bool delete_from_db();
  
    bool check_fixed_id_editor(string fixed_id, EEDB::User* user, string &status, string &msg); 
    bool assign_to_fixed_id(string fixed_id, EEDB::User* user);
    vector<EEDB::Configuration*> fixed_id_history();

    bool store_metadata();
    bool update_metadata();
    bool check_by_filter_logic(string filter_logic);

    void update_usage();
  
    bool link_to_collaboration(EEDB::Collaboration* collab);
  
  
  protected:
    string                _uuid;
    string                _fixed_id;
    string                _config_type;
    EEDB::MetadataSet*    _metadataset;
    EEDB::User*           _owner;
    EEDB::Collaboration*  _collaboration;
    long                  _owner_user_id;
    long                  _collaboration_id;
    long                  _access_count;
    time_t                _last_access;
    time_t                _create_date;
    bool                  _mdata_loaded, _symbols_loaded;
  
    vector<EEDB::Configuration*> _fixed_id_history;
    bool                         _load_fixed_id_history();

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    void   _mdata_xml(string &xml_buffer, map<string,bool> tags);

};

};   //namespace

#endif
