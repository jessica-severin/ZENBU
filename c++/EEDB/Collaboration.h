/* $Id: Collaboration.h,v 1.39 2021/01/22 06:02:24 severin Exp $ */

/***

NAME - EEDB::Collaboration

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

#ifndef _EEDB_Collaboration_H
#define _EEDB_Collaboration_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Peer.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/User.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class User;  //forward declare

  
class CollaborationUser : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;
  public:
    EEDB::User*     user;
    string          member_status;
  public:
    CollaborationUser(); // constructor
    CollaborationUser(void *xml_node);   // constructor using a rapidxml node
    ~CollaborationUser();                // destructor
    void   init();
    void   _xml(string &xml_buffer);
  
    //database methods
    static DBObject* create(map<string, dynadata> &row_map, Database* db);
    void init_from_row_map(map<string, dynadata> &row_map);
    static vector<DBObject*>  fetch_all_members_by_collaboration(EEDB::Collaboration *collaboration);
};
  

class Collaboration : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Collaboration();               // constructor
    Collaboration(void *xml_node); // constructor using a rapidxml node
   ~Collaboration();               // destructor
    void init();                   // initialization method
  
    void display_info();
    string display_desc();
    string display_contents();
    string min_xml();
    string desc_xml();

    //get atribute
    EEDB::User*  owner();
    string       display_name();
    string       description();
    string       owner_identity();
    string       group_uuid();
    bool         open_to_public();
    string       member_status();  //status of the current logged in user
    string       member_status(EEDB::User* user);

    EEDB::MetadataSet*   metadataset();
    EEDB::Peer*          group_registry();
    vector<EEDB::Peer*>  shared_data_peers();


    //set attribute
    void member_status(string value);  //status of the current logged in user
    void display_name(string value);
    void owner(EEDB::User* value);
    //void owner_identity(string value);
    void group_uuid(string value);
    void group_registry(EEDB::Peer* peer);
    bool add_user_member(EEDB::User* user, string status);
    void open_to_public(string value);

    bool validate_user(EEDB::User* user);

    //database creation methods
    bool store_new(MQDB::Database *db);
    bool store_metadata();
    bool create_new_registry();
    EEDB::Peer* create_sqlite_registry();
    EEDB::Peer* create_mysql_registry();
    bool create_config_sources(EEDB::Peer *regpeer);

    //User management API
    string   share_peer_database(EEDB::Peer *peer);
    string   unlink_shared_peer(EEDB::Peer *peer);

    void     ignore_collaboration(EEDB::User *user);
    void     accept_invitation_to_collaboration(EEDB::User *user);
    bool     accept_user_request_to_collaboration(string email);
    bool     reject_user_request_to_collaboration(string email);  

    bool     add_user_to_collaboration(string user_ident);
    bool     remove_user_from_collaboration(string user_ident);
    bool     make_user_administrator(string user_ident);
    bool     revoke_user_administrator(string user_ident);
  
    bool     make_public(bool value); //publish collaboration
    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Collaboration* obj = new EEDB::Collaboration;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static Collaboration*     fetch_by_id(MQDB::Database *db, long id);
    static Collaboration*     fetch_by_uuid(MQDB::Database *db, string uuid);
    static Collaboration*     fetch_by_uuid(EEDB::User *user, string uuid);
    static vector<DBObject*>  fetch_all_by_user(EEDB::User *user);
    static vector<DBObject*>  fetch_all_by_user_member(EEDB::User *user);
    static vector<DBObject*>  fetch_all(MQDB::Database *db); //for manager tools
    static vector<DBObject*>  fetch_all_public(MQDB::Database *db, EEDB::User *user);
    
   
  protected:
    string           _group_uuid;
    string           _member_status;
    string           _display_name;
    //string           _owner_identity;
    EEDB::User*      _owner;
    long             _owner_user_id;
  
    bool             _open_to_public;

    EEDB::MetadataSet*   _metadataset;
    EEDB::Peer*          _group_registry;
  
    vector<EEDB::CollaborationUser*>  _members;
    void                              _load_members();
    vector<EEDB::Peer*>  _shared_data_peers;
    void                 _load_shared_data_peers();

    bool                 _check_exists_db(MQDB::Database *db);

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    
    
};   //class

};   //namespace

#endif
