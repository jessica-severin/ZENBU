/* $Id: User.h,v 1.29 2018/08/13 04:05:37 severin Exp $ */

/***

NAME - EEDB::User

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

#ifndef _EEDB_User_H
#define _EEDB_User_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Peer.h>
#include <EEDB/MetadataSet.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Collaboration;  //forward declare

class User : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    User();                 // constructor
    User(void *xml_node);   // constructor using a rapidxml node
   ~User();                 // destructor
    void init();            // initialization method
  
    bool match(EEDB::User* user2);
    bool match(string user_identity);

    void display_info();
    string display_desc();
    string display_contents();

    //get atribute
    string    uuid();
    string    email_identity();
    string    nickname();
    string    hmac_secretkey();
    string    status();

    vector<string>      openIDs();

    EEDB::MetadataSet*  metadataset();
    EEDB::Peer*         user_registry();
    string              user_directory();

    vector<MQDB::DBObject*> member_collaborations();

    EEDB::Collaboration*  private_collaboration();  //returns user as a Collaboration object
  
    //set attribute
    void email_address(string value);
    void nickname(string value);
    void hmac_secretkey(string value);

    void add_openID(string value);
  
    //database methods
    bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);
    bool store_metadata();
    void update();

    string   delete_uploaded_peer(EEDB::Peer *peer);
    void     generate_hmac_secretkey();

    bool     set_valid_email(string email);

    //new user management methods
    static EEDB::User*  create_new_profile(MQDB::Database *db, string email_ident);
    static EEDB::User*  merge_user_profiles(EEDB::User *user1, EEDB::User *user2);
    bool                validate_password_hash(string password_hash);
    bool                update_upload_ownership();

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      User* obj = new EEDB::User;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static vector<DBObject*>  fetch_all(MQDB::Database *db);
    static EEDB::User*        fetch_by_id(MQDB::Database *db, long int id);
    static EEDB::User*        fetch_by_uuid(MQDB::Database *db, string uuid);
    static EEDB::User*        fetch_by_openID(MQDB::Database *db, string openid);
    static EEDB::User*        fetch_by_email(MQDB::Database *db, string email);

    static vector<DBObject*>  fetch_all_by_collaboration(EEDB::Collaboration *collaboration);
    static vector<DBObject*>  fetch_requested_users_by_collaboration(EEDB::Collaboration *collaboration);
    static vector<DBObject*>  fetch_invited_users_by_collaboration(EEDB::Collaboration *collaboration);
    static vector<DBObject*>  fetch_all_members_by_collaboration(EEDB::Collaboration *collaboration);
    static EEDB::User*        fetch_collaboration_owner(EEDB::Collaboration *collaboration);
  
  
  protected:
    string           _uuid;
    vector<string>   _openid_array;
    string           _email_identity;
    string           _nickname;
    string           _hmac_secretkey;
    bool             _has_password;
    string           _status;

    EEDB::MetadataSet*    _metadataset;
    EEDB::Peer*           _user_registry;
    string                _user_directory;
    EEDB::Collaboration*  _private_collaboration;

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    
};   //class

};   //namespace

#endif
