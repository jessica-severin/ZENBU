/* $Id: Collaboration.cpp,v 1.108 2019/02/07 07:15:16 severin Exp $ */

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

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <unistd.h>
#include <sqlite3.h>
#include <stdarg.h>
#include <string>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <MQDB/MappedQuery.h>
#include <EEDB/Collaboration.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <sqlite3.h>
#include <stdarg.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::Collaboration::class_name = "EEDB::Collaboration";

void _eedb_collaboration_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Collaboration*)obj;
}
void _eedb_collaboration_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Collaboration*)obj)->_xml(xml_buffer);
}
void _eedb_collaboration_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Collaboration*)obj)->_simple_xml(xml_buffer);
}
bool _collaboration_members_sort_func (EEDB::CollaborationUser *a, EEDB::CollaborationUser *b);


EEDB::Collaboration::Collaboration() {
  init();
}

EEDB::Collaboration::~Collaboration() {
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}

void EEDB::Collaboration::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::Collaboration::class_name;
  _funcptr_delete            = _eedb_collaboration_delete_func;
  _funcptr_xml               = _eedb_collaboration_xml_func;
  _funcptr_simple_xml        = _eedb_collaboration_simple_xml_func;

  _member_status   = "not_member";  
  _group_registry  = NULL;
  _metadataset     = NULL;
  _open_to_public  = false;
  
  _owner            = NULL;
  _owner_user_id    = -1;  
}

void EEDB::Collaboration::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Collaboration::display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "Collaboration(%ld) [%s] : %s", 
    _primary_db_id, _group_uuid.c_str(), _display_name.c_str());
  return buffer;
}

string EEDB::Collaboration::display_contents() {
  string str = display_desc() +"\n";
  str += _metadataset->display_contents();
  return str;
}


///////////////////////////////////////////////////////////////////////////////////////

EEDB::Collaboration::Collaboration(void *xml_node) {
  //constructor using a rapidxml node
  //for RemoteServer streaming data-interchange
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "collaboration") { return; }
  
  if((attr = root_node->first_attribute("name")))          { _display_name = attr->value(); }
  if((attr = root_node->first_attribute("uuid")))          { _group_uuid = attr->value(); }
  //if((attr = root_node->first_attribute("OWNER")))         { _owner_identity = attr->value(); }
  if((attr = root_node->first_attribute("member_status"))) { _member_status = attr->value(); }
  
  _open_to_public = false;
  if((node = root_node->first_node("open_to_public")) != NULL) { 
    if(string(node->value()) == "y") { _open_to_public=true; }
  }

  //owner
  rapidxml::xml_node<> *owner_node = root_node->first_node("OWNER");
  if(owner_node) {
    rapidxml::xml_node<> *node = owner_node->first_node("eedb_user");    
    if(node) {
      _owner = new EEDB::User(node);
      _owner_user_id = -1;
    }
  }
  
  //get list of member users
  rapidxml::xml_node<> *users_node = root_node->first_node("member_users");
  if(users_node) {
    rapidxml::xml_node<> *node = users_node->first_node("eedb_user");
    while(node) {   
      EEDB::CollaborationUser *user = new EEDB::CollaborationUser(node);
      _members.push_back(user);
      node = node->next_sibling("eedb_user");
    }
  }
   
  // shared_data_peers
  rapidxml::xml_node<> *shared_node = root_node->first_node("shared_data_peers");
  if(shared_node) {
    rapidxml::xml_node<> *node = shared_node->first_node("peer");
    while(node) {   
      EEDB::Peer*peer = EEDB::Peer::new_from_xml(node);
      _shared_data_peers.push_back(peer);
      node = node->next_sibling("peer");
    }
  }

  // metadata
  metadataset(); //make sure it is initialized
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      if((mdata->type()!="group_dir") and (mdata->type()!="group_registry")) {
        _metadataset->add_metadata(mdata); 
      }
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      _metadataset->add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }
  
  //parse_metadata_into_attributes();  
}


string EEDB::Collaboration::min_xml() {
  string xml_buffer;

  xml_buffer.append("<collaboration name=\"");
  xml_buffer.append(html_escape(_display_name));
  xml_buffer.append("\" uuid=\"");
  xml_buffer.append(html_escape(_group_uuid));
  xml_buffer.append("\" member_status=\"");
  xml_buffer.append(html_escape(_member_status));
  xml_buffer.append("\" ");
  if(open_to_public()) { xml_buffer += "open_to_public=\"y\" "; }
  xml_buffer.append(" />");
  return xml_buffer.c_str();
}


void EEDB::Collaboration::_xml_start(string &xml_buffer) {
  xml_buffer.append("<collaboration name=\"");
  xml_buffer.append(html_escape(_display_name));
  xml_buffer.append("\" uuid=\"");
  xml_buffer.append(html_escape(_group_uuid));
  //xml_buffer.append("\" owner=\"");
  //xml_buffer.append(html_escape(_owner_identity));
  xml_buffer.append("\" member_status=\"");
  xml_buffer.append(html_escape(_member_status));
  xml_buffer.append("\" ");
  
  if(open_to_public()) { xml_buffer += "open_to_public=\"y\" "; }

  xml_buffer.append(">");
  
  if(owner()) {
    xml_buffer.append("<owner>");
    owner()->simple_xml(xml_buffer); 
    xml_buffer.append("</owner>");
  }
}

void EEDB::Collaboration::_xml_end(string &xml_buffer) {
  xml_buffer.append("</collaboration>\n");
}

void EEDB::Collaboration::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::Collaboration::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  xml_buffer.append("\n");

  char buffer[2048];
  if(_member_status == "OWNER" || _member_status == "MEMBER" || _member_status == "ADMIN") {
    _load_members();
    snprintf(buffer, 2040, "<member_users count=\"%d\" >\n" , (int)_members.size());
    xml_buffer.append(buffer);
    for(unsigned int i=0; i<_members.size(); i++) {
      _members[i]->simple_xml(xml_buffer);
    }
    xml_buffer.append("</member_users>\n");
  }

  if(_member_status == "OWNER" || _member_status == "ADMIN") {
    vector<EEDB::Peer*> peers = shared_data_peers();
    snprintf(buffer, 2040, "<shared_data_peers count=\"%d\" >\n" , (int)peers.size());
    xml_buffer.append(buffer);
    vector<EEDB::Peer*>::iterator it;
    for(it=peers.begin(); it!=peers.end(); it++) {
      (*it)->xml(xml_buffer);
      xml_buffer.append("\n");
    }
    xml_buffer.append("</shared_data_peers>\n");    
    metadataset()->xml(xml_buffer);

    vector<MQDB::DBObject*> requests = EEDB::User::fetch_requested_users_by_collaboration(this);
    if(requests.size()>0) {
      snprintf(buffer, 2040, "<user_requests count=\"%d\" >" , (int)requests.size());
      xml_buffer.append(buffer);
      for(unsigned int i=0; i<requests.size(); i++) {
        EEDB::User *user = (EEDB::User*)requests[i];
        user->simple_xml(xml_buffer);
        user->release();
      }
      xml_buffer.append("</user_requests>\n");
    }

    vector<MQDB::DBObject*> invites = EEDB::User::fetch_invited_users_by_collaboration(this);
    if(invites.size()>0) {
      snprintf(buffer, 2040, "<user_invitations count=\"%d\" >" , (int)invites.size());
      xml_buffer.append(buffer);
      for(unsigned int i=0; i<invites.size(); i++) {
        EEDB::User *user = (EEDB::User*)invites[i];
        user->simple_xml(xml_buffer);
        user->release();
      }
      xml_buffer.append("</user_invitations>\n");
    }    
  } else if(_member_status == "MEMBER") {
    vector<EEDB::Peer*> peers = shared_data_peers();
    snprintf(buffer, 2040, "<shared_data_peers count=\"%d\" >\n" , (int)peers.size());
    xml_buffer.append(buffer);
    vector<EEDB::Peer*>::iterator it;
    for(it=peers.begin(); it!=peers.end(); it++) {
      (*it)->xml(xml_buffer);
      xml_buffer.append("\n");
    }
    xml_buffer.append("</shared_data_peers>\n");
    metadataset()->xml(xml_buffer);
  } else {
    EEDB::Metadata *descMD = metadataset()->find_metadata("description", "");
    if(descMD) { descMD->xml(xml_buffer); }
  }

  _xml_end(xml_buffer);
}


string EEDB::Collaboration::desc_xml() {
  string xml_buffer;

  _xml_start(xml_buffer);
  xml_buffer.append("\n");

  char buffer[2048];
  if(_member_status == "OWNER" || _member_status == "MEMBER" || _member_status == "ADMIN") {
    _load_members();
    snprintf(buffer, 2040, "<member_users count=\"%d\" >\n" , (int)_members.size());
    xml_buffer.append(buffer);
    for(unsigned int i=0; i<_members.size(); i++) {
      _members[i]->simple_xml(xml_buffer);
    }
    xml_buffer.append("</member_users>\n");
  }

  if(_member_status == "OWNER" || _member_status == "ADMIN") {
    metadataset()->xml(xml_buffer);

    //vector<MQDB::DBObject*> requests = EEDB::User::fetch_requested_users_by_collaboration(this);
    //if(requests.size()>0) {
    //  snprintf(buffer, 2040, "<user_requests count=\"%d\" >" , (int)requests.size());
    //  xml_buffer.append(buffer);
    //  for(unsigned int i=0; i<requests.size(); i++) {
    //    EEDB::User *user = (EEDB::User*)requests[i];
    //    user->simple_xml(xml_buffer);
    //    user->release();
    //  }
    //  xml_buffer.append("</user_requests>\n");
    //}

    //vector<MQDB::DBObject*> invites = EEDB::User::fetch_invited_users_by_collaboration(this);
    //if(invites.size()>0) {
    //  snprintf(buffer, 2040, "<user_invitations count=\"%d\" >" , (int)invites.size());
    //  xml_buffer.append(buffer);
    //  for(unsigned int i=0; i<invites.size(); i++) {
    //    EEDB::User *user = (EEDB::User*)invites[i];
    //    user->simple_xml(xml_buffer);
    //    user->release();
    //  }
    //  xml_buffer.append("</user_invitations>\n");
    //}    
  } else if(_member_status == "MEMBER") {
    metadataset()->xml(xml_buffer);
  } else {
    EEDB::Metadata *descMD = metadataset()->find_metadata("description", "");
    if(descMD) { descMD->xml(xml_buffer); }
  }
  _xml_end(xml_buffer);

  return xml_buffer;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string    EEDB::Collaboration::display_name() { return _display_name; }
string    EEDB::Collaboration::group_uuid() { return _group_uuid; }
bool      EEDB::Collaboration::open_to_public() { return _open_to_public; }
string    EEDB::Collaboration::member_status() { return _member_status; }

string EEDB::Collaboration::description() { 
  EEDB::Metadata *descMD = metadataset()->find_metadata("description", "");
  if(descMD) { return descMD->data(); }
  return "";
}

void EEDB::Collaboration::member_status(string value) { 
  _member_status = value;
}
void EEDB::Collaboration::display_name(string value) { 
  _display_name = value;
}
//string    EEDB::Collaboration::owner_identity() { return _owner_identity; }
//void EEDB::Collaboration::owner_identity(string value) { 
//  _owner_identity = value;
//}
void EEDB::Collaboration::group_uuid(string value) {
  _group_uuid = value;
}
void EEDB::Collaboration::open_to_public(string value) { 
  _open_to_public = false;
  if(value == "y")    { _open_to_public = true; }
  if(value == "true") { _open_to_public = true; }
}

EEDB::User*  EEDB::Collaboration::owner() {
  if(_owner) { return _owner; }
  if(_owner_user_id == -1) { return NULL; }
  if(database() == NULL) { return NULL; }
  
  _owner = EEDB::User::fetch_by_id(_database, _owner_user_id);
  return _owner;
}

void  EEDB::Collaboration::owner(EEDB::User* value) {
  _owner = value;
  _owner_user_id = -1;
  if(_owner) { _owner_user_id = _owner->primary_id(); }
}


void EEDB::Collaboration::group_registry(EEDB::Peer* peer) {
  if(!peer) { return; }
  if(!peer->is_valid()) { return; }
  _group_registry = peer; 
  //reset password
  MQDB::Database *db = peer->peer_database();
  if(db && database()) {
    db->disconnect();
    db->user(database()->user());
    db->password(database()->password());
  }          
  peer->disconnect();
}


void EEDB::Collaboration::_load_members() {
  if(!_members.empty()) { return;}
  if(database()==NULL) { return; }
  if(primary_id() == -1) { return; }

  if((_member_status == "OWNER") || (_member_status == "MEMBER") || _member_status == "ADMIN") {
    vector<MQDB::DBObject*> tmp_members = EEDB::CollaborationUser::fetch_all_members_by_collaboration(this);
    for(unsigned int i=0; i<tmp_members.size(); i++) {
      EEDB::CollaborationUser *user = (EEDB::CollaborationUser*)tmp_members[i];
      if(user && user->user && user->user->match(owner())) { user->member_status = "OWNER"; }
      _members.push_back(user);
    }
  } else {
    //this is a public collaboration or one we have been invited to join
    EEDB::User *owner = EEDB::User::fetch_collaboration_owner(this);
    add_user_member(owner, "OWNER");
    //if(owner) { _members.push_back(owner); }
  }
  sort(_members.begin(), _members.end(), _collaboration_members_sort_func);
}


bool  EEDB::Collaboration::add_user_member(EEDB::User* user, string status) {
  //used for non-database created collaborations (like the curated_collaboration
  if(!user) { return false; }
  if(status.empty()) { status = "MEMBER"; }
  if(status!="MEMBER" && status!="OWNER" && status!="ADMIN") { return false; }
  EEDB::CollaborationUser *member = new EEDB::CollaborationUser();
  member->user = user;
  member->member_status = status;
  _members.push_back(member);
  return true;
}

bool  EEDB::Collaboration::validate_user(EEDB::User* user) {
  //used for non-database created collaborations (like the curated_collaboration)
  _member_status = "not_member";
  if(!user) { return false; }
  for(unsigned int i=0; i<_members.size(); i++) {
    if(user->match(_members[i]->user)) {
      _member_status = _members[i]->member_status;
      return true;
    }
  }
  return false;
}

string EEDB::Collaboration::member_status(EEDB::User* user) {
  //loads members from database and confirms status but does not set internal _member_status
  string status = "not_member";
  if(!user) { return status; }
  _load_members();
  for(unsigned int i=0; i<_members.size(); i++) {
    if(user->match(_members[i]->user)) {
      return _members[i]->member_status;
    }
  }
  return status;
}


EEDB::MetadataSet* EEDB::Collaboration::metadataset() {
  if(_metadataset == NULL) {
    _metadataset = new EEDB::MetadataSet;
    if(_database != NULL) {
      vector<DBObject*> symbols = 
         EEDB::Symbol::fetch_all_by_collaboration_id(_database, _primary_db_id);
      _metadataset->add_metadata(symbols);

      vector<DBObject*> mdata = 
         EEDB::Metadata::fetch_all_by_collaboration_id(_database, _primary_db_id);
      _metadataset->add_metadata(mdata);
    }
    _metadataset->remove_metadata_like("eedb:sharedb_peer_uuid", "");  //old system
    _metadataset->remove_metadata_like("keyword", "");  //old system
    _metadataset->remove_duplicates();
  }
  return _metadataset;
}


EEDB::Peer* EEDB::Collaboration::group_registry() {
  if(_group_registry == NULL) {
    EEDB::Metadata  *mdata = metadataset()->find_metadata("group_registry", "");
    if(mdata) {  
      EEDB::Peer *peer = EEDB::Peer::new_from_url(mdata->data());
      if(peer) {
        if(peer->is_valid()) {
          _group_registry = peer; 
          //reset password
          MQDB::Database *db = peer->peer_database();
          if(db) {
            db->disconnect();
            db->user(database()->user());
            db->password(database()->password());
          }          
        }
        peer->disconnect();
      }
    }
  }
  return _group_registry;
}


vector<EEDB::Peer*>  EEDB::Collaboration::shared_data_peers() {
  _load_shared_data_peers();
  return _shared_data_peers;
}


void EEDB::Collaboration::_load_shared_data_peers() {
  if(!_shared_data_peers.empty()) { return;}
  if(group_registry()==NULL) { return; }

  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream();
  fstream->add_seed_peer(group_registry());

  fstream->stream_peers();
  while(EEDB::Peer* peer = (EEDB::Peer*)fstream->next_in_stream()) {
    if(!(peer->is_valid())) { continue; }
    if(peer->uuid() == _group_registry->uuid()) { continue; }
    _shared_data_peers.push_back(peer);
  }
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// class level MQDB style fetch methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Collaboration::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["collaboration_id"].i_int;
  _group_uuid      = row_map["uuid"].i_string;
  _owner_user_id   = row_map["owner_user_id"].i_int;
  _display_name    = row_map["display_name"].i_string;
  _member_status   = row_map["member_status"].i_string;

  open_to_public(row_map["open_to_public"].i_string);

  if((row_map.find("user_id") != row_map.end()) && (_owner_user_id>0) and (_owner_user_id==row_map["user_id"].i_int)) {
    _member_status = "OWNER";
  }
  
  if(_member_status.empty()) { _member_status = "not_member"; }
}


EEDB::Collaboration*  EEDB::Collaboration::fetch_by_id(MQDB::Database *db, long id) {
  if(!db) { return NULL; }
  Collaboration* obj = (Collaboration*) MQDB::DBCache::check_cache(db, id, EEDB::Collaboration::class_name);
  if(obj!=NULL) { obj->retain(); return obj; }
  
  //fprintf(stderr, "fetch collab %ld\n", id);
  const char *sql = "SELECT * FROM collaboration WHERE collaboration_id=?";
  obj = (Collaboration*)MQDB::fetch_single(EEDB::Collaboration::create, db, sql, "d", id);
  
  MQDB::DBCache::add_to_cache(obj);
  return obj;
}


EEDB::Collaboration*  EEDB::Collaboration::fetch_by_uuid(EEDB::User *user, string uuid) {
  if(user == NULL) { return NULL; }
  if(user->database() == NULL) { return NULL; }
  
  MQDB::Database *db = user->database();
  const char *sql = "SELECT c.*, user_id, member_status FROM collaboration c \
  LEFT JOIN (SELECT * from collaboration_2_user WHERE user_id=?)t \
  using(collaboration_id) WHERE c.uuid=?";
  return (EEDB::Collaboration*) MQDB::fetch_single(EEDB::Collaboration::create, db, sql, "ds", user->primary_id(), uuid.c_str());
}


EEDB::Collaboration*  EEDB::Collaboration::fetch_by_uuid(MQDB::Database *db, string uuid) {
  if(!db) { return NULL; }
  
  const char *sql = "SELECT * FROM collaboration c WHERE c.uuid=?";
  return (EEDB::Collaboration*) MQDB::fetch_single(EEDB::Collaboration::create, db, sql, "s", uuid.c_str());
}


vector<MQDB::DBObject*>  EEDB::Collaboration::fetch_all_by_user(EEDB::User *user) {
  vector<MQDB::DBObject*> t_result;
  if(user->database() == NULL) { return t_result; }
  
  MQDB::Database *db = user->database();
  const char *sql = "SELECT c.*, user_id, member_status from collaboration c LEFT JOIN \
  (SELECT * from collaboration_2_user WHERE user_id=?)t using(collaboration_id) \
  WHERE (open_to_public='y' and member_status is NULL) or member_status!='REJECTED'";
  return MQDB::fetch_multiple(EEDB::Collaboration::create, db, sql, "d", user->primary_id());
}


vector<MQDB::DBObject*>  EEDB::Collaboration::fetch_all_by_user_member(EEDB::User *user) {
  vector<MQDB::DBObject*> t_result;
  if(user->database() == NULL) { return t_result; }
  
  MQDB::Database *db = user->database();
  const char *sql = "SELECT c.*, user_id, member_status from collaboration c \
  JOIN collaboration_2_user using(collaboration_id) \
  WHERE user_id=? and (member_status='MEMBER' or member_status='ADMIN')";
  
  return MQDB::fetch_multiple(EEDB::Collaboration::create, db, sql, "d", user->primary_id());
}


vector<DBObject*> EEDB::Collaboration::fetch_all(MQDB::Database *db) {
  //for manager tools
  vector<MQDB::DBObject*> t_result;
  if(db == NULL) { return t_result; }
  
  const char *sql = "SELECT * FROM collaboration";
  return MQDB::fetch_multiple(EEDB::Collaboration::create, db, sql, "");
}


vector<MQDB::DBObject*>  EEDB::Collaboration::fetch_all_public(MQDB::Database *db, EEDB::User *user) {
  vector<MQDB::DBObject*> t_result;
  if(db == NULL) { return t_result; }

  long user_id = -1;
  if(user) { user_id = user->primary_id(); }
  
  //const char *sql = "SELECT * from collaboration WHERE open_to_public='y'";
  //return MQDB::fetch_multiple(EEDB::Collaboration::create, db, sql, "");

  const char *sql = "SELECT c.*, user_id, member_status from collaboration c LEFT JOIN \
  (SELECT * from collaboration_2_user WHERE user_id=?)t using(collaboration_id) \
  WHERE open_to_public='y'";
  return MQDB::fetch_multiple(EEDB::Collaboration::create, db, sql, "d", user_id);
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


bool EEDB::Collaboration::_check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  dynadata value = db->fetch_col_value("SELECT collaboration_id FROM collaboration WHERE uuid=?", "s", _group_uuid.c_str());
  if(value.type != MQDB::INT) { return false; }
  
  _primary_db_id = value.i_int;
  database(db);
  _peer_uuid = db->uuid();
  _db_id.clear();
  
  return true;
}


bool EEDB::Collaboration::store_new(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  if(_check_exists_db(db)) { return true; }
        
  db->do_sql("INSERT INTO collaboration (display_name, uuid, owner_user_id) VALUES(?,?,?)", 
             "ssdc", 
             _display_name.c_str(), 
             _group_uuid.c_str(), 
             //_owner_identity.c_str(), 
             _owner_user_id);
  
  if(!_check_exists_db(db)) { return false; }  //gets _primary_db_id
  
  //now store the symbols and metadata  
  store_metadata();
  
  if(!create_new_registry()) {
    //maybe need to delete since this failed
    return false; 
  }
  
  return true;
}


bool EEDB::Collaboration::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Symbol::class_name) {
      EEDB::Symbol *sym = (EEDB::Symbol*)md;
      if(!sym->check_exists_db(db)) { sym->store(db); }
      sym->store_link_to_collaboration(this);
    } else {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_collaboration(this);
    }
  }
  return true;
}


bool EEDB::Collaboration::create_config_sources(EEDB::Peer *collabReg) {
  if(collabReg==NULL) { return false; }
  MQDB::Database *db = collabReg->peer_database();
  if(!db) { return false; }
  
  EEDB::FeatureSource *fsrc = NULL;

  /*
  fsrc = EEDB::FeatureSource::new_from_name(db, "config", "eeDB_gLyphs_configs");
  if(fsrc) {
    fsrc->metadataset()->add_tag_data("eedb:display_name", _display_name + " views");
    fsrc->store_metadata();
  }
  
  fsrc = EEDB::FeatureSource::new_from_name(db, "config", "eeDB_gLyph_track_configs");
  if(fsrc) {
    fsrc->metadataset()->add_tag_data("eedb:display_name", _display_name + " tracks");
    fsrc->store_metadata();
  }
  
  fsrc = EEDB::FeatureSource::new_from_name(db, "config", "ZENBU_script_configs");
  if(fsrc) {
    fsrc->metadataset()->add_tag_data("eedb:display_name", _display_name + " scripts");
    fsrc->store_metadata();
  }
  */
  
  fsrc = EEDB::FeatureSource::new_from_name(db, "config", "ZENBU_user_annotations");
  if(fsrc) {
    fsrc->metadataset()->add_tag_data("eedb:display_name", _display_name + " user annotations");
    fsrc->store_metadata();
  }
  
  return true;
}


bool EEDB::Collaboration::create_new_registry() {
  //EEDB::Peer *regpeer = create_mysql_registry();
  EEDB::Peer *regpeer = create_sqlite_registry();
  if(!regpeer) { return false; }
  
  group_registry(regpeer);
  metadataset()->add_tag_data("group_registry", regpeer->db_url());
  store_metadata();
  
  return true;
}


EEDB::Peer*  EEDB::Collaboration::create_sqlite_registry() {
  if(database() == NULL) { return NULL; }
  if(primary_id() == -1) { return NULL; }
  if(group_uuid().empty()) { return NULL; }
  
  //if(metadataset()->has_metadata_like("group_registry", "")) { return true; }
  
  //2.10 with heavy users the avialable mysql ports are being used up too quickly
  //decided to remove as much mysql from the system as possible.
  //reverting back to a sqlite registry with the possibility of an ZML or ZDX registry in the future
  
  MQDB::Database *db = database();
  db->disconnect();
  db->user(database()->user());
  db->password(database()->password());
  
  string user_rootdir = getenv("EEDB_USER_ROOTDIR");
  string eedb_root = getenv("EEDB_ROOT");
  if(user_rootdir.empty()) { return NULL; }
  if(eedb_root.empty()) { return NULL; }
  
  //create user registry
  //fprintf(stderr, "create group registry [%s]\n", uuid.c_str());
  //fprintf(stderr, "EEDB_USER_ROOTDIR [%s]\n", user_rootdir.c_str());
  
  //collaboration directory
  string groupdir = user_rootdir + "/" + group_uuid();
  fprintf(stderr, "collaboration dir [%s]\n", groupdir.c_str());
  
  struct stat statbuf;
  if(stat(groupdir.c_str(), &statbuf) == 0) {
    if(S_ISDIR(statbuf.st_mode)) {
      fprintf(stderr, "directory already exists\n");
    }
  } else {
    fprintf(stderr, "create new dir\n");
    if(mkdir(groupdir.c_str(), 0770) != 0) {
      fprintf(stderr, "ERROR: unable to create new collaboration directory\n");
      return NULL;
    }
  }
  
  //template sqlite database
  string sqlite_template = eedb_root + "/sql/eedb_template.sqlite";
  string dbpath = groupdir + "/group_registry.sqlite";
  
  if(stat(dbpath.c_str(), &statbuf) == 0) {
    fprintf(stderr, "sqlite already exists\n");
  } else {
    string cmd = "cp "+ sqlite_template +" "+ dbpath;
    system(cmd.c_str());
    chmod(dbpath.c_str(), 0660);
  }
  
  string dburl = "sqlite://" + groupdir + "/group_registry.sqlite";
  fprintf(stderr, "%s\n", dburl.c_str());
  MQDB::Database *regDB = new MQDB::Database(dburl);
  if(!regDB) {
    fprintf(stderr, "ERROR: unable to create/open sqlite [%s]\n", dburl.c_str());
    return NULL;
  }
  
  //this works so possibility in future to encode all the table creation code here
  //and avoid the template copy step
  //regDB->do_sql("CREATE TABLE peer ( uuid varchar(255) NOT NULL default '', alias varchar(255) NOT NULL default '', is_self tinyint(1) default '0', db_url varchar(255) default NULL, web_url varchar(255) default NULL, PRIMARY KEY  (uuid) );");
  
  //test if registry already has a self-peer otherwise create
  EEDB::Peer *regPeer = EEDB::Peer::fetch_self(regDB);
  if(regPeer) {
    fprintf(stderr, "regpeer already exists\n");
  } else {
    fprintf(stderr, "create regpeer\n");
    regPeer = EEDB::Peer::create_self_peer_for_db(regDB);
  }
  fprintf(stderr, "regpeer :: %s\n", regPeer->xml().c_str());
  //if(!regPeer) { return NULL; }
  
  if(!create_config_sources(regPeer)) { return NULL; }
  metadataset()->add_tag_data("group_sqlite_registry", regPeer->db_url());
  store_metadata();  
  
  return regPeer;
}


EEDB::Peer*  EEDB::Collaboration::create_mysql_registry() {
  //old mysql based registry code. not using, but leaving here in case I want to re-enable later
  if(database() == NULL) { return NULL; }
  if(primary_id() == -1) { return NULL; }
  if(group_uuid().empty()) { return NULL; }

  if(metadataset()->has_metadata_like("group_registry", "")) { return group_registry(); }

  //new 2.3 system, the collaboration will not exist as a directory
  //but will be created in the mysql user database as
  //  zenbu_collab_uuidxxxxxxxxxxxx
  
  const char* eedb_root = getenv("EEDB_ROOT");
  
  MQDB::Database *db = database();  
  db->disconnect();
  db->user(database()->user());
  db->password(database()->password());
  
  string collab_dbname = "zenbu_collab_" + group_uuid();
  
  //create database
  char buffer[2048];
  sprintf(buffer, "mysqladmin -u%s -p%s -h%s -P%d create %s",
          database()->user().c_str(), database()->password().c_str(),
          db->host().c_str(), db->port(), collab_dbname.c_str());
  system(buffer);
  
  //create schema
  sprintf(buffer, "mysql -u%s -p%s -h%s -P%d %s < %s/sql/schema.sql > /dev/null", 
          database()->user().c_str(), database()->password().c_str(),
          db->host().c_str(), db->port(), collab_dbname.c_str(), eedb_root);
  system(buffer);

  //grant read:read access
  sprintf(buffer, "echo \"GRANT SELECT, CREATE TEMPORARY TABLES ON %s.* TO 'read'@'%%'\" | mysql -u%s -p%s -h%s -P%d", 
          collab_dbname.c_str(),
          database()->user().c_str(), database()->password().c_str(), db->host().c_str(), db->port());
  system(buffer);
  
  //create internal peer
  sprintf(buffer, "mysql://%s:%s@%s:%d/%s", 
          database()->user().c_str(), database()->password().c_str(),
          db->host().c_str(), db->port(), collab_dbname.c_str());
  MQDB::Database *collabDB = new MQDB::Database(buffer);
  if(!collabDB) {
    fprintf(stderr,"could not connect to new collab db\n");
    return NULL;
  }
  EEDB::Peer *peer = EEDB::Peer::create_self_peer_for_db(collabDB);
  if(!peer) {
    fprintf(stderr,"could not get collab peer\n");
    return NULL;
  }
  
  if(!create_config_sources(peer)) { return NULL; }
  metadataset()->add_tag_data("group_mysql_registry", peer->db_url());
  store_metadata();

  return peer;
}



/*
sub group_registry_stats {
  my $self = shift;

  my $metadataset = new EEDB::MetadataSet;
  my $reg = $self->group_registry;
  unless($reg) { return $metadataset; }
  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->add_seed_peers($reg);

  my $peer_count=0;
  my $source_count=0;
  my $experiment_count=0;

  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) { $peer_count++; }

  $stream->stream_data_sources();
  while(my $obj = $stream->next_in_stream) {
    unless($obj) { next; }
    if($obj->class eq "Experiment") { $experiment_count++; }
    if($obj->class eq "FeatureSource") { $source_count++; }
  }
  $metadataset->add_tag_data("peer_count", $peer_count);
  $metadataset->add_tag_data("experiment_count", $experiment_count);
  $metadataset->add_tag_data("source_count", $source_count);

  return $metadataset;
}
*/




//////////////////////////////////////////////////////////////////////////////////////////////////
//
// collaboration manangement routines
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Collaboration::ignore_collaboration(EEDB::User *user) {
  //used for both ignoring PUBLIC and INVITED collaborations
  if(!_database) { return; }
  if(!user) { return; }
  //unless($self->peer_uuid eq $user->peer_uuid) { return undef; }
 
  //if((_member_status == "not_member") and (_public_announce))  { 
  //  const char *sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,'REJECTED')";
  //  _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
  //}
  if(_member_status == "INVITED") { 
    const char *sql = "UPDATE collaboration_2_user set member_status='REJECTED' where collaboration_id=? and user_id=?";
    _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
  }
}


void  EEDB::Collaboration::accept_invitation_to_collaboration(EEDB::User *user) {
  if(!_database) { return; }
  if(!user) { return; }
  if(_member_status != "INVITED") { return; }

  //double check INVITED status
  const char *sql = "SELECT member_status FROM collaboration_2_user WHERE collaboration_id=? and user_id=?";
  dynadata value = _database->fetch_col_value(sql, "dd", _primary_db_id, user->primary_id());
  if(value.i_string != "INVITED") { return; }
  
  sql = "UPDATE collaboration_2_user set member_status='MEMBER' where collaboration_id=? and user_id=?";
  _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
}

//---- OWNER ONLY methods ----

bool  EEDB::Collaboration::accept_user_request_to_collaboration(string user_email) {
  //OWNER only operation for PUBLIC collaborations
  if(!_database) { return false; }
  if(_member_status!="OWNER" && _member_status!="ADMIN") { return false; }
  //if(!_public_announce) { return false; }

  vector<MQDB::DBObject*> requests = EEDB::User::fetch_requested_users_by_collaboration(this);
  for(unsigned int i=0; i<requests.size(); i++) {
    EEDB::User *user = (EEDB::User*)requests[i];
    if(user->email_identity() == user_email) {
      const char * sql = "UPDATE collaboration_2_user set member_status='MEMBER' where collaboration_id=? and user_id=?";
      _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
    }
  }
  return true;
}


bool  EEDB::Collaboration::reject_user_request_to_collaboration(string user_email) {
  //OWNER only operation for PUBLIC collaborations
  if(!_database) { return false; }
  if(_member_status!="OWNER" && _member_status!="ADMIN") { return false; }
  //if(!_public_announce) { return false; }
  
  vector<MQDB::DBObject*> requests = EEDB::User::fetch_requested_users_by_collaboration(this);
  for(unsigned int i=0; i<requests.size(); i++) {
    EEDB::User *user = (EEDB::User*)requests[i];
    if(user->email_identity() == user_email) {
      const char *sql = "UPDATE collaboration_2_user set member_status='REJECTED' where collaboration_id=? and user_id=?";
      _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
    }
  }
  return true;
}


bool  EEDB::Collaboration::add_user_to_collaboration(string user_ident) {
  //OWNER ONLY operation for both PUBLIC and PRIVATE collaborations
  if(!_database) { return false; }
  if(_member_status!="OWNER" && _member_status!="ADMIN") { return false; }

  //need to find user, then insert an invitation
  //first try ident as email, then as openID
  EEDB::User *user = EEDB::User::fetch_by_email(_database, user_ident);
  if(!user) { user = EEDB::User::fetch_by_openID(_database, user_ident); }
  if(!user) { return false; }
  
  const char *sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,?)";
  _database->do_sql(sql, "dds", _primary_db_id, user->primary_id(), "MEMBER");

  //allows resetting of previously rejected users to be re-invited
  sql = "UPDATE collaboration_2_user set member_status='MEMBER' WHERE member_status!='MEMBER' and member_status!='ADMIN' and collaboration_id=? and user_id=?";
  _database->do_sql(sql, "dd", _primary_db_id, user->primary_id(), "");
  return true;
}


bool  EEDB::Collaboration::remove_user_from_collaboration(string user_ident) {
  if(!_database) { return false; }
  if(_member_status!="OWNER" && _member_status!="ADMIN") { return false; }
  if(user_ident.empty()) { return false; }
  
  //need to find user, then remove from collaboration
  //first try ident as email, then as openID
  EEDB::User *user = EEDB::User::fetch_by_email(_database, user_ident);
  if(!user) { user = EEDB::User::fetch_by_openID(_database, user_ident); }
  if(!user) { return false; }
  if(member_status(user) != "MEMBER") { return false; }
  
  const char *sql = "UPDATE collaboration_2_user set member_status='REJECTED' where collaboration_id=? and user_id=?";
  _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
  
  return true;
}


bool  EEDB::Collaboration::make_user_administrator(string user_ident) {
  if(!_database) { return false; }
  if(_member_status!="OWNER" && _member_status!="ADMIN") { return false; }
  if(user_ident.empty()) { return false; }
  
  //need to find user, then remove from collaboration
  //first try ident as email, then as openID
  EEDB::User *user = EEDB::User::fetch_by_email(_database, user_ident);
  if(!user) { user = EEDB::User::fetch_by_openID(_database, user_ident); }
  if(!user) { return false; }
  if(member_status(user) != "MEMBER") { return false; }
  
  const char *sql = "UPDATE collaboration_2_user set member_status='ADMIN' where collaboration_id=? and user_id=?";
  _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
  
  return true;
}


bool  EEDB::Collaboration::revoke_user_administrator(string user_ident) {
  if(!_database) { return false; }
  if(_member_status!="OWNER" && _member_status!="ADMIN") { return false; }
  if(user_ident.empty()) { return false; }
  
  //need to find user, then remove from collaboration
  //first try ident as email, then as openID
  EEDB::User *user = EEDB::User::fetch_by_email(_database, user_ident);
  if(!user) { user = EEDB::User::fetch_by_openID(_database, user_ident); }
  if(!user) { return false; }
  if(member_status(user) != "ADMIN") { return false; }
  
  const char *sql = "UPDATE collaboration_2_user set member_status='MEMBER' where collaboration_id=? and user_id=?";
  _database->do_sql(sql, "dd", _primary_db_id, user->primary_id());
  
  return true;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// collaboration data sharing routines
//
//////////////////////////////////////////////////////////////////////////////////////////////////


string  EEDB::Collaboration::share_peer_database(EEDB::Peer *peer) {
  if(!peer) { return "problem with uploaded database"; }

  EEDB::SPStreams::SourceStream *stream = peer->source_stream();
  if(!stream) { return "problem with uploaded database"; }

  if((member_status() != "MEMBER") and (member_status() != "OWNER") && (member_status() != "ADMIN")) {
    return "not a member of collaboration, so unable to share data with it";
  }

  EEDB::Peer *collaborationReg = group_registry();
  if(collaborationReg==NULL or collaborationReg->peer_database()==NULL) { 
    return "problem with collaboration registry"; 
  }

  //stream->stream_data_sources("FeatureSource");
  //EEDB::FeatureSource *source = NULL;
  //while((source = (EEDB::FeatureSource*)stream->next_in_stream())) {
  //  if(source->primary_id() == 1) { break; }
  //}
  //if(!source) {
  //  return "upload database primary source not found";
  //}

  //OK everything checks out, go and create federation peer-2-peer link
  MQDB::Database *collaborationDB = group_registry()->peer_database();
  EEDB::Peer *peer_copy = peer->copy();
  peer_copy->database(NULL);
  peer_copy->store(collaborationDB);

  //old 1.x system stored additional metadata in the Source   
  //source->metadataset()->add_tag_symbol("eedb:shared_in_collaboration", _group_uuid);
  //source->store_metadata();

  //2.x stores the additional metadata in the Collaboration
  //metadataset()->add_tag_symbol("eedb:sharedb_peer_uuid", peer->uuid());
  //store_metadata();

  //2.4 does not store as metadata, uses the actual group_registry peers
  
  return "";
}


string  EEDB::Collaboration::unlink_shared_peer(EEDB::Peer *peer) {  
  if((member_status() != "MEMBER") and (member_status() != "OWNER") and (member_status() != "ADMIN")) {
    return "not a member of collaboration, so unable to unshare data with it";
  }
  
  EEDB::Peer *collaborationReg = group_registry();
  if(collaborationReg==NULL or collaborationReg->peer_database()==NULL) { 
    return "problem with collaboration registry"; 
  }
  
  if(!peer) { return "uploaded peer not defined"; }
  
  EEDB::SPStreams::SourceStream *stream = peer->source_stream();
  if(!stream) { return "problem with uploaded peer"; }
  
  //stream->stream_data_sources("FeatureSource");
  //EEDB::FeatureSource *source = NULL;
  //while((source = (EEDB::FeatureSource*)stream->next_in_stream())) {
  //  if(source->primary_id() == 1) { break; }
  //}
  //if(!source) {
  //  return "uploaded database primary source not found";
  //}
  
  // check if peer is already linked into this collaboration
  vector<EEDB::Peer*> peers = shared_data_peers();
  vector<EEDB::Peer*>::iterator it;
  for(it=peers.begin(); it!=peers.end(); it++) {
    if((*it)->uuid() == peer->uuid()) { break; }
  }
  if(it == peers.end()) {
    return "uploaded peer not shared with the collaboration";
  }
  
  //OK everything checks out, go and unlink
  MQDB::Database *collaborationDB = group_registry()->peer_database();
  collaborationDB->do_sql("DELETE from peer WHERE uuid=?", "s", peer->uuid());
  
  return "";
}


/**********************************************************************
 *
 * CollaborationUser
 *
 **********************************************************************/
const char* EEDB::CollaborationUser::class_name = "EEDB::CollaborationUser";

void _eedb_collaborationuser_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::CollaborationUser*)obj;
}
void _eedb_collaborationuser_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::CollaborationUser*)obj)->_xml(xml_buffer);
}


EEDB::CollaborationUser::CollaborationUser() {
  init();
}

EEDB::CollaborationUser::~CollaborationUser() {
}

void EEDB::CollaborationUser::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::CollaborationUser::class_name;
  _funcptr_delete            = _eedb_collaborationuser_delete_func;
  _funcptr_xml               = _eedb_collaborationuser_xml_func;
  _funcptr_simple_xml        = _eedb_collaborationuser_xml_func;
  user = NULL;
  member_status.clear();
}


void EEDB::CollaborationUser::_xml(string &xml_buffer) {
  if(!user) { return; }

  xml_buffer += "<eedb_user ";
  xml_buffer += " valid_email=\"" + html_escape(user->email_identity()) +"\"";
  xml_buffer += " nickname=\"" + html_escape(user->nickname()) + "\"";
  xml_buffer += " member_status=\"" + member_status + "\"";
  xml_buffer += " ></eedb_user>\n";
}


EEDB::CollaborationUser::CollaborationUser(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "eedb_user") { return; }
  user = new EEDB::User(xml_node);
  if((attr = root_node->first_attribute("member_status")))   { member_status = attr->value(); }
}


MQDB::DBObject*  EEDB::CollaborationUser::create(map<string, dynadata> &row_map, Database* db) {
  EEDB::CollaborationUser* obj = new EEDB::CollaborationUser();
  obj->database(db);
  obj->init_from_row_map(row_map);
  return obj;
}


void  EEDB::CollaborationUser::init_from_row_map(map<string, dynadata> &row_map) {
  user = new EEDB::User;
  user->database(database());
  user->init_from_row_map(row_map);
  member_status    = row_map["member_status"].i_string;
}

                                                       
vector<DBObject*>  EEDB::CollaborationUser::fetch_all_members_by_collaboration(EEDB::Collaboration *collaboration) {
  vector<DBObject*> users;
  if(!collaboration) { return users; }
  if(collaboration->database()==NULL) { return users; }
  
  const char *sql = "SELECT u.*, uuid, member_status FROM user u join collaboration_2_user using(user_id) \
  JOIN collaboration c using(collaboration_id) \
  WHERE c.collaboration_id = ? and member_status in('MEMBER', 'ADMIN', 'OWNER') ";
  return MQDB::fetch_multiple(EEDB::CollaborationUser::create, collaboration->database(), sql, "d", collaboration->primary_id());
}


bool _collaboration_members_sort_func (EEDB::CollaborationUser *a, EEDB::CollaborationUser *b) {
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->user == NULL) { return false; }
  if(b->user == NULL) { return true; }

  if(a->member_status == "OWNER") { return true; }
  if(b->member_status == "OWNER") { return false; }

  if(a->member_status=="ADMIN" && b->member_status!="ADMIN") { return true; }
  if(b->member_status=="ADMIN" && a->member_status!="ADMIN") { return false; }
  
  if(a->user->email_identity() < b->user->email_identity()) { return true; }
  if(a->user->email_identity() > b->user->email_identity()) { return false; }
  return false;
}

