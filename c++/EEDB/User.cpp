/* $Id: User.cpp,v 1.79 2016/10/05 08:52:58 severin Exp $ */

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
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>

using namespace std;
using namespace MQDB;

const char*               EEDB::User::class_name = "EEDB::User";

void _eedb_user_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::User*)obj;
}
void _eedb_user_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::User*)obj)->_xml(xml_buffer);
}
void _eedb_user_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::User*)obj)->_simple_xml(xml_buffer);
}


EEDB::User::User() {
  init();
}

EEDB::User::~User() {
}

void EEDB::User::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::User::class_name;
  _funcptr_delete            = _eedb_user_delete_func;
  _funcptr_xml               = _eedb_user_xml_func;
  _funcptr_simple_xml        = _eedb_user_simple_xml_func;
  
  _uuid.clear();
  _openid_array.clear();
  _email_identity.clear();
  _nickname.clear();
  _hmac_secretkey.clear();
  _user_registry = NULL;
  _metadataset = NULL;
  _private_collaboration = NULL;
  _has_password = false;
}

void EEDB::User::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::User::display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "User(%ld) [%s] : %s", 
    _primary_db_id, _email_identity.c_str(), _nickname.c_str());
  return buffer;
}

string EEDB::User::display_contents() {
  string str = display_desc() +"\n";
  str += _metadataset->display_contents();
  return str;
}


bool EEDB::User::match(EEDB::User* user2) {
  if(!user2) { return false; }
  
  if(user2->match(_email_identity)) { return true; }

  openIDs(); //make sure they are loaded
  vector<string>::iterator it;
  for(it=_openid_array.begin(); it!=_openid_array.end(); it++) {
    if(user2->match(*it)) { return true; }
  }
  
  return false;
}


bool EEDB::User::match(string user_identity) {
  if(user_identity.empty()) { return false; }
  if(!_email_identity.empty() and (user_identity == _email_identity)) { return true; }

  openIDs(); //make sure they are loaded
  vector<string>::iterator it;
  for(it=_openid_array.begin(); it!=_openid_array.end(); it++) {
    if((*it).empty()) { continue; }
    if((*it) == user_identity) { return true; }
  }
  return false;
}


///////////////////////////////////////////////////////////////////////////////////////


void EEDB::User::_xml_start(string &xml_buffer) {
  xml_buffer.append("<eedb_user nickname=\"");
  xml_buffer.append(html_escape(_nickname));
  if(!_email_identity.empty()) {
    xml_buffer.append("\" valid_email=\"");
    xml_buffer.append(html_escape(_email_identity));
  }
  xml_buffer.append("\" >");
  
  if(!_has_password) { xml_buffer.append("<no_password/>"); }
}

void EEDB::User::_xml_end(string &xml_buffer) {
  xml_buffer.append("</eedb_user>\n"); 
}

void EEDB::User::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::User::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);

  //openIDs
  openIDs(); //make sure they are loaded
  vector<string>::iterator it;
  for(it=_openid_array.begin(); it!=_openid_array.end(); it++) {
    xml_buffer.append("<openid>");
    xml_buffer.append(html_escape((*it)));
    xml_buffer.append("</openid>");    
  }

  //metadata
  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }  

  if(!_hmac_secretkey.empty()) {
    xml_buffer += "<hmac_secretkey>" + _hmac_secretkey + "</hmac_secretkey>";
  }

  _xml_end(xml_buffer);
}


EEDB::User::User(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "eedb_user") { return; }
  
  if((attr = root_node->first_attribute("openID")))          { add_openID(attr->value()); }
  if((attr = root_node->first_attribute("nickname")))        { _nickname = attr->value(); }    
  if((attr = root_node->first_attribute("valid_email")))     { _email_identity = attr->value(); }    
  std::transform(_email_identity.begin(), _email_identity.end(), _email_identity.begin(), ::tolower);

  // metadata
  metadataset(); //make sure it is initialized
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      _metadataset->add_metadata(mdata);
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
  metadataset()->remove_duplicates();
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string    EEDB::User::uuid() { return _uuid; }
string    EEDB::User::nickname() { return _nickname; }
string    EEDB::User::hmac_secretkey() { return _hmac_secretkey; }
string    EEDB::User::email_identity() { return _email_identity; }

void EEDB::User::generate_hmac_secretkey() {
  if(database() == NULL) { return; }
  if(primary_id() == -1) { return; }

  string message;
  for(unsigned i=0; i<10; i++) { message += uuid_hexstring(); }
  _hmac_secretkey = sha512(message);

  database()->do_sql("UPDATE user SET hmac_secretkey=? WHERE user_id=?", "sd", _hmac_secretkey.c_str(), _primary_db_id);
}


void EEDB::User::add_openID(string value) { 
  if(value.empty()) { return; }
  _openid_array.push_back(value);
}

vector<string> EEDB::User::openIDs() { 
  if(!_openid_array.empty()) { return _openid_array; }
  if(!_database) { return _openid_array; }

  map<string, dynadata>   row_map;
  const char *sql = "SELECT DISTINCT openid FROM user_authentication where user_id=?";
  void *stmt = _database->prepare_fetch_sql(sql, "d", _primary_db_id);
  while(_database->fetch_next_row_map(stmt, row_map)) {
    add_openID(row_map["openid"].i_string); 
  }
  return _openid_array;
}


void EEDB::User::email_address(string value) { 
  _email_identity = value;
  std::transform(_email_identity.begin(), _email_identity.end(), _email_identity.begin(), ::tolower);
}
void EEDB::User::nickname(string value) { 
  _nickname = value;
}
void EEDB::User::hmac_secretkey(string value) { 
  _hmac_secretkey = value;
}

EEDB::MetadataSet* EEDB::User::metadataset() {
  if(_metadataset == NULL) {
    _metadataset = new EEDB::MetadataSet;
    if(_database != NULL) {
      vector<DBObject*> symbols = 
         EEDB::Symbol::fetch_all_by_user_id(_database, _primary_db_id);
      _metadataset->add_metadata(symbols);

      vector<DBObject*> mdata = 
         EEDB::Metadata::fetch_all_by_user_id(_database, _primary_db_id);
      _metadataset->add_metadata(mdata);
    }
    _metadataset->remove_duplicates();
  }
  return _metadataset;
}


EEDB::Peer* EEDB::User::user_registry() {

  if(_user_registry == NULL) {
    EEDB::Metadata  *mdata = metadataset()->find_metadata("user_registry", "");
    if(mdata) {  
      EEDB::Peer *peer = EEDB::Peer::new_from_url(mdata->data());
      if(peer) {
        if(peer->is_valid()) { _user_registry = peer; }
        peer->disconnect();
      }
    }
  }
  return _user_registry;
}


string EEDB::User::user_directory() {
  if(_user_directory.empty()) {
    EEDB::Metadata  *mdata = metadataset()->find_metadata("user_dir", "");
    if(mdata) {  
      _user_directory = mdata->data();
    }
  }
  return _user_directory;
}


vector<MQDB::DBObject*> EEDB::User::member_collaborations() {
  return EEDB::Collaboration::fetch_all_by_user_member(this);
}


EEDB::Collaboration*  EEDB::User::private_collaboration() {
  if(_private_collaboration) { return _private_collaboration; }
  if(!user_registry()) { return NULL; }
  
  _private_collaboration = new EEDB::Collaboration();
  _private_collaboration->group_registry(user_registry());
  _private_collaboration->member_status("OWNER");
  //_private_collaboration->owner_identity(email_identity());
  _private_collaboration->owner(this);
  _private_collaboration->group_uuid("private");
  _private_collaboration->primary_id(-1);
  _private_collaboration->display_name("private");  
  
  return _private_collaboration;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// user management methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


EEDB::User*  EEDB::User::create_new_profile(MQDB::Database *userDB, string email_ident) {
  //creates stub user
  if(!userDB) { return NULL; }
    
  string user_rootdir = getenv("EEDB_USER_ROOTDIR");
  string eedb_root = getenv("EEDB_ROOT");
  if(user_rootdir.empty()) { return NULL; }
  if(eedb_root.empty()) { return NULL; }

  //make sure email_ident is lowercase
  std::transform(email_ident.begin(), email_ident.end(), email_ident.begin(), ::tolower);

  EEDB::User *user = EEDB::User::fetch_by_email(userDB, email_ident);
  if(user) {
    user->release();
    fprintf(stderr, "ERROR: user [%s] already exists\n", email_ident.c_str());
    return NULL;
  }
  
  user = new EEDB::User();
  user->_email_identity = email_ident;
          
  //user internal UUID
  string uuid = MQDB::uuid_b64string();
  //uuid is also name of directory so can not start with "-" or "_"
  if(uuid[0] == '-') { uuid = "z" + uuid; }
  if(uuid[0] == '_') { uuid = "z" + uuid; }  
  user->metadataset()->add_tag_data("uuid", uuid);
  user->_uuid = uuid;
      
  userDB->do_sql("INSERT ignore INTO user (email_identity, user_uuid) VALUES(?,?)", "ss", 
                 email_ident.c_str(), uuid.c_str());
  
  dynadata value = userDB->fetch_col_value("SELECT user_id FROM user WHERE user_uuid=?", "s", uuid.c_str());
  if(value.type != MQDB::INT) { return NULL; }
  user->primary_id(value.i_int);
  user->database(userDB);
  
  user->store_metadata();
  user->generate_hmac_secretkey();
  //password and email validation will happen after this stub is created


  //create user registry
  fprintf(stderr, "create user registry [%s]\n", uuid.c_str());
  fprintf(stderr, "EEDB_USER_ROOTDIR [%s]\n", user_rootdir.c_str());
  
  //user directory
  string userdir = user_rootdir + "/" + uuid;
  fprintf(stderr, "mkdir [%s]\n", userdir.c_str());
  if(mkdir(userdir.c_str(), 0770) != 0) {
    fprintf(stderr, "ERROR: unable to create new user directory\n");
    return NULL;
  }
  
  //template sqlite eeDB database
  string sqlite_template = eedb_root + "/sql/eedb_template.sqlite";
  //TODO: need to test 
  //unless(-e $template) {
  //  printf(STDERR "ERROR: EEDB_ROOT not setup unable to create user registry\n");
  //  return undef;
  //}
  
  string dbpath = userdir + "/user_registry.sqlite";
  string cmd = "cp "+ sqlite_template +" "+ dbpath;
  system(cmd.c_str());
  //TODO: need to test
  //unless(-e $dbpath) {
  //  printf(STDERR "ERROR: unable to create sqlite user registry\n");
  //  return undef;
  //}
  chmod(dbpath.c_str(), 0660);
  
  string dburl = "sqlite://" + dbpath;
  MQDB::Database *regDB = new MQDB::Database(dburl);
  if(!regDB) { return NULL; }
  EEDB::Peer     *regPeer = EEDB::Peer::create_self_peer_for_db(regDB); 
  if(!regPeer) { return NULL; }
  
  user->metadataset()->add_tag_data("user_registry", dburl);
  user->metadataset()->add_tag_data("user_dir", userdir);
  user->store_metadata();
  
  return user;
}



//
// =============================================================
//

EEDB::User*  EEDB::User::merge_user_profiles(EEDB::User *user1, EEDB::User *user2) {
  if(!user1 || !user2) { return NULL; }
  if(!user1->email_identity().empty() && !user2->email_identity().empty()) { return NULL; }
  
  EEDB::User *master_user=NULL, *slave_user=NULL;
  
  if(user1->primary_id() < user2->primary_id()) {
    master_user = user1;
    slave_user  = user2; 
  } else {
    master_user = user2;
    slave_user  = user1; 
  }
  
  MQDB::Database *db = master_user->database();
  string master_dir  = master_user->user_directory() +"/";
  string slave_dir   = slave_user->user_directory() +"/";
  
  //first transfer email_identity if needed
  if(master_user->email_identity().empty()) {
    fprintf(stderr, "transfer email identity to master\n");
    master_user->set_valid_email(slave_user->email_identity());
    slave_user->set_valid_email("");
  }
  
  //loop through uploaded data: 
  //  don't move/relocate, keep them in the old location, but 
  //  change owner, and add them to master registry
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream();
  fstream->add_seed_peer(slave_user->user_registry());
  fstream->stream_peers();
  while(EEDB::Peer* peer = (EEDB::Peer*)fstream->next_in_stream()) {
    string dburl = peer->db_url();
    //fprintf(stderr, "dburl [%s]\n", dburl.c_str());

    if(dburl.find("user_registry") != string::npos) { continue; }
    if(!(peer->is_valid())) { continue; }

    //register in master_user registry
    fprintf(stderr, "register dburl [%s]\n", dburl.c_str());
    peer->store(master_user->user_registry()->peer_database());
  }


  //adjust owner of peer internal sources
  fstream->add_seed_peer(master_user->user_registry());
  fstream->stream_peers();
  while(EEDB::Peer* peer = (EEDB::Peer*)fstream->next_in_stream()) {
    string dburl = peer->db_url();

    if(!(peer->is_valid())) { continue; }
    if(dburl.find("user_registry") != string::npos) { continue; }

    if((dburl.find(slave_dir) == string::npos) && (dburl.find(master_dir) == string::npos)) {
      continue;
    }

    fprintf(stderr, "adjust owner dburl [%s]\n", dburl.c_str());
    EEDB::SPStream *pstream = peer->source_stream();
    pstream->stream_data_sources();
    EEDB::FeatureSource *source;
    while((source = (EEDB::FeatureSource*)pstream->next_in_stream())) {
      source->owner_identity(master_user->email_identity());
    }

    //save updates
    if(peer->driver() == "oscdb") {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
      oscdb->save_xmldb();
    } else if(peer->driver() == "bamdb") {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)peer->source_stream();
      bamdb->save_xmldb();
    }

    // maybe delete peer from slave registry
    //slave_user->user_registry()->peer_database()->do_sql("DELETE from peer WHERE uuid=?", "s", peer->uuid());
  }
  

  //adjust collaborations: 
  //  change owner for collaborations which the slave owns
  db->do_sql("UPDATE collaboration SET owner_user_id=? WHERE owner_user_id=?", "dd", 
             master_user->primary_id(), slave_user->primary_id());

  //adjust configuration owner: 
  db->do_sql("UPDATE configuration SET user_id=? WHERE user_id=?", "dd", 
             master_user->primary_id(), slave_user->primary_id());

  //  switch collaboration_2_user
  db->do_sql("UPDATE IGNORE collaboration_2_user SET user_id=? WHERE user_id=?", "dd", master_user->primary_id(), slave_user->primary_id());
  db->do_sql("DELETE FROM collaboration_2_user WHERE user_id=?", "d", slave_user->primary_id());

  //transfer the OpenIDs from the slave to the master
  db->do_sql("UPDATE user_authentication SET user_id=? WHERE user_id=?", "dd", 
             master_user->primary_id(), slave_user->primary_id());

  //last delete slave from  userDB
  //db->do_sql("DELETE from  user WHERE user_id=?", "d", slave_user->primary_id());
  //db->do_sql("UPDATE user set openID='', email_identity='', hmac_secretkey='', password_hash=''  WHERE user_id=?", "d", slave_user->primary_id());

  return master_user;
}


bool  EEDB::User::update_upload_ownership() {
  if(email_identity().empty()) { return false; }
    
  string user_dir = user_directory() +"/";

  //loop through uploaded data: 
  //  adjust owner of peer internal sources
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream();
  fstream->add_seed_peer(user_registry());
  fstream->stream_peers();
  while(EEDB::Peer* peer = (EEDB::Peer*)fstream->next_in_stream()) {
    string dburl = peer->db_url();
    
    if(!(peer->is_valid())) { continue; }
    if(dburl.find("user_registry") != string::npos) { continue; }
    if(dburl.find(user_dir) == string::npos) { continue; }
    
    fprintf(stderr, "adjust owner dburl [%s]\n", dburl.c_str());
    EEDB::SPStream *pstream = peer->source_stream();
    pstream->stream_data_sources();
    EEDB::FeatureSource *source;
    while((source = (EEDB::FeatureSource*)pstream->next_in_stream())) {
      source->owner_identity(email_identity());
    }
    
    //save updates
    if(peer->driver() == "oscdb") {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
      oscdb->save_xmldb();
    } else if(peer->driver() == "bamdb") {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)peer->source_stream();
      bamdb->save_xmldb();
    }    
  }
    
  return true;
}


bool  EEDB::User::validate_password_hash(string password_hash) {
  if(password_hash.empty()) { return false; }
  if(!_database) { return false; }

  map<string, dynadata>   row_map;
  const char *sql = "SELECT password_hash FROM user WHERE user_id=?";
  void *stmt = _database->prepare_fetch_sql(sql, "d", _primary_db_id);
  _database->fetch_next_row_map(stmt, row_map);
  _database->finalize_stmt(stmt);

  string hash2 = row_map["password_hash"].i_string;
  if(hash2 == password_hash) { return true; }
  return false;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// Database fetch methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::User::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["user_id"].i_int;
  _uuid            = row_map["user_uuid"].i_string;
  _email_identity  = row_map["email_identity"].i_string;
  _nickname        = row_map["nickname"].i_string;
  _hmac_secretkey  = row_map["hmac_secretkey"].i_string;
  std::transform(_email_identity.begin(), _email_identity.end(), _email_identity.begin(), ::tolower);
  
  _has_password = true;
  if(row_map["password_hash"].i_string.empty()) { _has_password = false; }
}

vector<DBObject*>  EEDB::User::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM user";
  return MQDB::fetch_multiple(EEDB::User::create, db, sql, "");
}

EEDB::User*  EEDB::User::fetch_by_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT * FROM user WHERE user_id=?";
  return (EEDB::User*) MQDB::fetch_single(EEDB::User::create, db, sql, "d", id);
}

EEDB::User*  EEDB::User::fetch_by_uuid(MQDB::Database *db, string uuid) {
  if(uuid.empty()) { return NULL; }
  const char *sql = "SELECT * FROM user WHERE user_uuid=?";
  return (EEDB::User*) MQDB::fetch_single(EEDB::User::create, db, sql, "s", uuid.c_str());
}

EEDB::User*  EEDB::User::fetch_by_openID(MQDB::Database *db, string openid) {
  if(openid.empty()) { return NULL; }
  const char *sql = "SELECT user.* FROM user JOIN user_authentication using(user_id) where user_authentication.openID=?";
  return (EEDB::User*) MQDB::fetch_single(EEDB::User::create, db, sql, "s", openid.c_str());
}

EEDB::User*  EEDB::User::fetch_by_email(MQDB::Database *db, string email) {
  if(email.empty()) { return NULL; }
  const char *sql = "SELECT * FROM user WHERE email_identity=?";
  return (EEDB::User*) MQDB::fetch_single(EEDB::User::create, db, sql, "s", email.c_str());
}


vector<DBObject*>  EEDB::User::fetch_all_by_collaboration(EEDB::Collaboration *collaboration) { 
  vector<DBObject*> users;
  if(!collaboration) { return users; }
  if(collaboration->database()==NULL) { return users; }
  
  const char *sql = "SELECT u.* FROM user u join collaboration_2_user using(user_id) where collaboration_id = ?";
  return MQDB::fetch_multiple(EEDB::User::create, collaboration->database(), sql, "d", collaboration->primary_id());
}

 
vector<DBObject*>  EEDB::User::fetch_requested_users_by_collaboration(EEDB::Collaboration *collaboration) { 
  vector<DBObject*> users;
  if(!collaboration) { return users; }
  if(collaboration->database()==NULL) { return users; }
  
  const char *sql = "SELECT u.*, uuid, member_status FROM user u JOIN collaboration_2_user using(user_id) \
    JOIN collaboration c using(collaboration_id) WHERE c.collaboration_id = ? and member_status='REQUEST' ";
  return MQDB::fetch_multiple(EEDB::User::create, collaboration->database(), sql, "d", collaboration->primary_id());
}


vector<DBObject*>  EEDB::User::fetch_invited_users_by_collaboration(EEDB::Collaboration *collaboration) { 
  vector<DBObject*> users;
  if(!collaboration) { return users; }
  if(collaboration->database()==NULL) { return users; }
  
  const char *sql ="SELECT u.*, uuid, member_status FROM user u JOIN collaboration_2_user using(user_id) \
    JOIN collaboration c using(collaboration_id) WHERE c.collaboration_id = ? and member_status='INVITED' ";
  return MQDB::fetch_multiple(EEDB::User::create, collaboration->database(), sql, "d", collaboration->primary_id());
}


vector<DBObject*>  EEDB::User::fetch_all_members_by_collaboration(EEDB::Collaboration *collaboration) {
  vector<DBObject*> users;
  if(!collaboration) { return users; }
  if(collaboration->database()==NULL) { return users; }
  
  const char *sql = "SELECT u.*, uuid, member_status FROM user u join collaboration_2_user using(user_id) \
    JOIN collaboration c using(collaboration_id) \
    WHERE c.collaboration_id = ? and member_status='MEMBER' ";
  return MQDB::fetch_multiple(EEDB::User::create, collaboration->database(), sql, "d", collaboration->primary_id());
}


EEDB::User*  EEDB::User::fetch_collaboration_owner(EEDB::Collaboration *collaboration) {
  if(!collaboration) { return NULL; }
  if(collaboration->database()==NULL) { return NULL; }
  
  const char *sql = "SELECT u.*, uuid, member_status FROM user u JOIN collaboration_2_user using(user_id) \
    JOIN collaboration c using(collaboration_id) WHERE c.collaboration_id = ? AND u.openID = c.owner_openid ";
  return (EEDB::User*)MQDB::fetch_single(EEDB::User::create, collaboration->database(), sql, "d", collaboration->primary_id());
}




//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////
/*
sub check_exists_db {
  my $self = shift;
  my $db   = shift;
  
  unless($db) { return undef; }
  if(defined($self->primary_id) and ($self->primary_id>0)) { return $self; }
  
  #check if it is already in the database
  my $dbID = $db->fetch_col_value("select user_id from user where openID=?", $self->openID);
  if($dbID) {
    $self->primary_id($dbID);
    $self->database($db);
    return $self;
  } else {
    return undef;
  }
}
*/

bool  EEDB::User::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }

  MQDB::Database *db = database();
  
  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Symbol::class_name) {
      EEDB::Symbol *sym = (EEDB::Symbol*)md;
      if(!sym->check_exists_db(db)) { sym->store(db); }
      sym->store_link_to_user(this);
    } else {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_user(this);
    }
  }
  return true;
}


void  EEDB::User::update() {
  if(database() == NULL) { return; }
  if(primary_id() == -1) { return; }

  database()->do_sql("UPDATE user SET nickname=? WHERE user_id=?", "sd", _nickname.c_str(), _primary_db_id);
  database()->do_sql("UPDATE user SET hmac_secretkey=? WHERE user_id=?", "sd", _hmac_secretkey.c_str(), _primary_db_id);

  //now do the symbols and metadata  
  store_metadata();
}


bool EEDB::User::set_valid_email(string email) {
  if(database() == NULL) { return false; }
  if(_primary_db_id == -1) { return false; }
  
  //make sure email in in lowercase
  std::transform(email.begin(), email.end(), email.begin(), ::tolower);

  database()->do_sql("UPDATE user SET email_identity=? WHERE user_id=?", "sd",
                     email.c_str(), _primary_db_id);
  _email_identity = email;
  return true;
}

  
//
//////////////////////////////////////////////////////////////////////////////////////////////////
//

string  EEDB::User::delete_uploaded_peer(EEDB::Peer *peer) {
  if(peer==NULL) { return "no profile registry"; }

  EEDB::SPStreams::SourceStream *stream = peer->source_stream();
  if(stream==NULL) { return "no profile registry"; }

  user_registry();
  user_directory();
  
  if((_user_registry == NULL) || (_user_registry->peer_database() == NULL)) { return "problem with user registry"; }

  string error_msg;
  bool is_owner = false;
  stream->stream_data_sources();
  EEDB::DataSource *source;
  while((source = (EEDB::DataSource*)stream->next_in_stream())) {
    if(source->owner_identity().empty()) { continue; }  
    if(match(source->owner_identity())) { is_owner = true; }
    else { 
      error_msg += "** not my uploaded source, can not delete";
      error_msg += " owned by " + source->owner_identity();
      error_msg += " "+source->display_desc();
    }
  }
  if(!is_owner) { return error_msg; }

  size_t idx;
  if((idx = peer->db_url().find(_user_directory)) == string::npos) {
    return "database not in my upload directory";
  }

  string dbfile = peer->db_url().substr(idx);  
  struct stat statbuf;
  if(stat(dbfile.c_str(), &statbuf) != 0) {
    return "unable to get directory stats on uploaded database"; 
  }

  // OK go and delete now
  // first delete files from my upload directory
  string cmd = "rm " + dbfile + "/" + peer->driver() + ".*; rmdir " + dbfile;
  if(peer->driver() == "zdx") { cmd = "rm " + dbfile; }
  system(cmd.c_str());

  // then delete peer from my registry
  _user_registry->peer_database()->do_sql("DELETE from peer WHERE uuid=?", "s", peer->uuid());

  return "";
}
