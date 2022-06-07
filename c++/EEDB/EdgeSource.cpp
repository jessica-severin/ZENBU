/*  $Id: EdgeSource.cpp,v 1.76 2021/05/22 01:41:25 severin Exp $ */

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

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sqlite3.h>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/date_time/gregorian/gregorian.hpp> //include all types plus i/o
#include <MQDB/MappedQuery.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Peer.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::EdgeSource::class_name = "EdgeSource";

void _eedb_edgesource_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::EdgeSource*)obj;
}
void _eedb_edgesource_load_metadata_func(EEDB::DataSource *obj) { 
  ((EEDB::EdgeSource*)obj)->_load_metadata();
}
void _eedb_edgesource_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::EdgeSource*)obj)->_xml(xml_buffer);
}
void _eedb_edgesource_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::EdgeSource*)obj)->_simple_xml(xml_buffer);
}
void _eedb_edgesource_mdata_xml_func(MQDB::DBObject *obj, string &xml_buffer, map<string,bool> tags) {
  ((EEDB::EdgeSource*)obj)->_mdata_xml(xml_buffer, tags);
}


EEDB::EdgeSource::EdgeSource() {
  init();
}

EEDB::EdgeSource::~EdgeSource() {
}

void EEDB::EdgeSource::init() {
  EEDB::DataSource::init();
  _classname                 = EEDB::EdgeSource::class_name;
  _funcptr_delete            = _eedb_edgesource_delete_func;
  _funcptr_load_metadata     = _eedb_edgesource_load_metadata_func;
  _funcptr_xml               = _eedb_edgesource_xml_func;
  _funcptr_simple_xml        = _eedb_edgesource_simple_xml_func;
  _funcptr_mdata_xml         = _eedb_edgesource_mdata_xml_func;

  _edge_count     = -1;
  _create_date    = 0;

  _feature_source1 = NULL;
  _feature_source2 = NULL;
  _feature_source1_peer = NULL;
  _feature_source2_peer = NULL;
}


////////////////////////////////////////////////////
//
// XML and description section
//
////////////////////////////////////////////////////


void EEDB::EdgeSource::display_info() {
  printf("%s\n", display_desc().c_str());
}


string EEDB::EdgeSource::display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040,"EdgeSource(%s) %s : %s : %s",
                    db_id().c_str(),
                    _name.c_str(),
                    _category.c_str(),
                    _classification.c_str());
  return buffer;
}


string EEDB::EdgeSource::display_contents() {
  string desc = display_desc() + "\n";
  desc += metadataset()->display_contents();   
  return desc;
}


void EEDB::EdgeSource::_xml_start(string &xml_buffer) {
  char    buffer[2048];
  snprintf(buffer, 2040, "<edgesource id=\"%s\" name=\"%s\"",
                    db_id().c_str(), display_name().c_str());
  xml_buffer.append(buffer);

  xml_buffer += " create_date=\""+ create_date_string() +"\"";
  snprintf(buffer, 2040, " create_timestamp=\"%ld\"", _create_date);
  xml_buffer.append(buffer);

  if(!_classification.empty()) { xml_buffer += " classification=\"" + _classification + "\""; }
  if(!_category.empty())       { xml_buffer += " category=\"" + _category + "\""; } 
  if(!_owner_identity.empty()) { xml_buffer += " owner_identity=\""+_owner_identity+"\""; }

  if(edge_count()>0) {
    snprintf(buffer, 2040, " edge_count=\"%ld\"", edge_count());
    xml_buffer.append(buffer);
  }

  if(!_feature_source1_dbid.empty()) {
    xml_buffer += " feature_source1=\"" + _feature_source1_dbid + "\"";
  }
  if(!_feature_source2_dbid.empty()) {
    xml_buffer += " feature_source2=\"" + _feature_source2_dbid + "\"";
  }
  xml_buffer.append(">");
}

void EEDB::EdgeSource::_xml_end(string &xml_buffer) {
  xml_buffer.append("</edgesource>\n");
}

void EEDB::EdgeSource::_simple_xml(string &xml_buffer) {
  if(_simple_xml_cache.empty()) {
    _xml_start(_simple_xml_cache);
    _xml_end(_simple_xml_cache);
  }
  xml_buffer.append(_simple_xml_cache);
}

void EEDB::EdgeSource::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  xml_buffer.append("\n");

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }

  _xml_end(xml_buffer);
}

void EEDB::EdgeSource::_mdata_xml(string &xml_buffer, map<string,bool> mdtags) {
  _xml_start(xml_buffer);
  vector<EEDB::Metadata*> mdlist = metadataset()->all_metadata_with_tags(mdtags);
  vector<EEDB::Metadata*>::iterator it1;
  for(it1=mdlist.begin(); it1!=mdlist.end(); it1++) {
    (*it1)->xml(xml_buffer);
  }
  _xml_end(xml_buffer);
}


EEDB::EdgeSource::EdgeSource(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "edgesource") { return; }
  
  if((attr = root_node->first_attribute("name")))           { _name = attr->value(); }
  if((attr = root_node->first_attribute("category")))       { _category = attr->value(); }
  //if((attr = root_node->first_attribute("source")))         { _import_source = attr->value(); }
  //if((attr = root_node->first_attribute("comments")))       { _comments = attr->value(); }
  if((attr = root_node->first_attribute("owner_openid")))   { _owner_identity = attr->value(); } //backward compatibility
  if((attr = root_node->first_attribute("owner_identity"))) { _owner_identity = attr->value(); }
  
  if((attr = root_node->first_attribute("feature_source1"))) { _feature_source1_dbid = attr->value(); }
  if((attr = root_node->first_attribute("feature_source2"))) { _feature_source2_dbid = attr->value(); }

  if((attr = root_node->first_attribute("id"))) {
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(attr->value(), uuid, objID, objClass);
    _primary_db_id = objID;
    _db_id = attr->value(); //store federatedID, if peer is set later, it will be recalculated
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { _peer_uuid = peer->uuid(); }
  }
  
  if((attr = root_node->first_attribute("create_timestamp"))) {
    _create_date = strtol(attr->value(), NULL, 10); 
  }
  if((attr = root_node->first_attribute("edge_count"))) {
    _edge_count = strtol(attr->value(), NULL, 10); 
  }
    
  // metadata
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }
  
  parse_metadata_into_attributes();  
}


void EEDB::EdgeSource::parse_metadata_into_attributes() {
  vector<EEDB::Metadata*> _mdata_list = _metadataset.metadata_list();
  for(unsigned int i=0; i<_mdata_list.size(); i++) {
    EEDB::Metadata *md = _mdata_list[i];  
    if(md->type() == "eedb:display_name") { _display_name = md->data(); }        
    if(md->type() == "display_name") { _display_name = md->data(); }        
    if(md->type() == "eedb:category") { _category = md->data(); }
    if(md->type() == "description") { _description = md->data(); }
  }

  // add in the owner information to allow searching, will be removed on saving
  if(!_owner_identity.empty()) { 
    _metadataset.add_metadata("eedb:owner_email", _owner_identity);
  }
  _metadataset.add_metadata("eedb:dbid", db_id());
}


/*
sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  //a hash tree generated by XML::TreePP
  
  my $self = undef;
  my $new = 0;
  if(($__riken_gsc_edgesource_global_should_cache != 0) and defined($xmlTree->{'-id'})) {
    my $obj = $__riken_gsc_edgesource_global_id_cache->{$xmlTree->{'-id'}};
    if($obj) { $self = $obj; }
  }
  unless($self) { $self = new $class; $new=1; }
  $self->db_id($xmlTree->{'-id'}) if($xmlTree->{'-id'});
  $self->name($xmlTree->{'-name'}) if($xmlTree->{'-name'});
  $self->classification($xmlTree->{'-classification'}) if($xmlTree->{'-classification'});
  $self->category($xmlTree->{'-category'}) if($xmlTree->{'-category'});
  $self->create_date($xmlTree->{'-create_date'}) if($xmlTree->{'-create_date'});
  _edge_count = $xmlTree->{'-count'} if($xmlTree->{'-count'});

  //$self->import_source($xmlTree->{'-source'}) if($xmlTree->{'-source'});
  //$self->import_date($xmlTree->{'-import_date'}) if($xmlTree->{'-import_date'});
  $self->is_active('y');
  $self->is_visible('y');
 
  if(my $mdata = $xmlTree->{'mdata'}) {
    unless($mdata =~ /ARRAY/) { $mdata = [$mdata]; }
    foreach my $mdataxml (@$mdata) {
      my $obj = EEDB::Metadata->new_from_xmltree($mdataxml);
      $self->metadataset->add_metadata($obj);
    }
  }

  if(my $symbols = $xmlTree->{'symbol'}) {
    unless($symbols =~ /ARRAY/) { $symbols = [$symbols]; }
    foreach my $symxml (@$symbols) {
      my $symbol = EEDB::Symbol->new_from_xmltree($symxml);
      $self->metadataset->add_metadata($symbol);
    }
  }
  
  if(($__riken_gsc_edgesource_global_should_cache != 0) and $new) {
    $__riken_gsc_edgesource_global_id_cache->{$self->db_id} = $self;
  }
  
  return $self;
}
*/


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string    EEDB::EdgeSource::category() { return _category; }
string    EEDB::EdgeSource::classification() { return _classification; }

void EEDB::EdgeSource::category(string value) {
  _category = value;
}
void EEDB::EdgeSource::classification(string value) { 
  _classification = value;
}

string  EEDB::EdgeSource::feature_source1_dbid() {
  return _feature_source1_dbid;
}
string  EEDB::EdgeSource::feature_source2_dbid() {
  return _feature_source2_dbid;
}

string  EEDB::EdgeSource::feature_source1_uuid() {
  if(_feature_source1_dbid.empty()) { return _peer_uuid; }
  string   uuid, objClass;
  long int objID;
  MQDB::unparse_dbid(_feature_source1_dbid, uuid, objID, objClass);
  return uuid;
}
string  EEDB::EdgeSource::feature_source2_uuid() {
  if(_feature_source2_dbid.empty()) { return _peer_uuid; }
  string   uuid, objClass;
  long int objID;
  MQDB::unparse_dbid(_feature_source2_dbid, uuid, objID, objClass);
  return uuid;
}


EEDB::FeatureSource*  EEDB::EdgeSource::feature_source1() {
  if(!_feature_source1) {
    _feature_source1 = (EEDB::FeatureSource*)EEDB::DataSource::sources_cache_get(_feature_source1_dbid);
  }
  return _feature_source1;
}
EEDB::FeatureSource*  EEDB::EdgeSource::feature_source2() {
  if(!_feature_source2) {
    _feature_source2 = (EEDB::FeatureSource*)EEDB::DataSource::sources_cache_get(_feature_source2_dbid);
  }
  return _feature_source2;
}


EEDB::Peer*  EEDB::EdgeSource::feature_source1_peer() {
  if(_feature_source1_peer) { return _feature_source1_peer; }
  string   uuid, objClass;
  long int objID;
  if(_feature_source1_dbid.empty()) {
    uuid = _peer_uuid;
  } else {
    MQDB::unparse_dbid(_feature_source1_dbid, uuid, objID, objClass);
  }
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(peer) { _feature_source1_peer = peer; }
  return _feature_source1_peer;
}

EEDB::Peer*  EEDB::EdgeSource::feature_source2_peer() {
  if(_feature_source2_peer) { return _feature_source2_peer; }
  string   uuid, objClass;
  long int objID;
  if(_feature_source2_dbid.empty()) {
    uuid = _peer_uuid;
  } else {
    MQDB::unparse_dbid(_feature_source2_dbid, uuid, objID, objClass);
  }
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(peer) { _feature_source2_peer = peer; }
  return _feature_source2_peer;
}

//
// set methods
//

void  EEDB::EdgeSource::feature_source1(EEDB::FeatureSource* fsrc) {
  if(_feature_source1 != NULL) {
    _feature_source1->release();
    _feature_source1 = NULL;
  }
  _feature_source1_dbid.clear();
  _feature_source1_peer = NULL;
  if(fsrc) {
    fsrc->retain();
    _feature_source1 = fsrc;
    _feature_source1_dbid = fsrc->db_id();
  }
}
void  EEDB::EdgeSource::feature_source2(EEDB::FeatureSource* fsrc) {
  if(_feature_source2 != NULL) {
    _feature_source2->release();
    _feature_source2 = NULL;
  }
  _feature_source2_dbid.clear();
  _feature_source2_peer = NULL;
  if(fsrc) {
    fsrc->retain();
    _feature_source2 = fsrc;
    _feature_source2_dbid = fsrc->db_id();
  }
}


void  EEDB::EdgeSource::feature_source1_dbid(string id) {
  if(_feature_source1 != NULL) {
    _feature_source1->release();
    _feature_source1 = NULL;
  }
  _feature_source1_dbid = id;
  _feature_source1_peer = NULL;
}
void  EEDB::EdgeSource::feature_source2_dbid(string id) {
  if(_feature_source2 != NULL) {
    _feature_source2->release();
    _feature_source2 = NULL;
  }
  _feature_source2_dbid = id;
  _feature_source2_peer = NULL;
}


////////////////////////////////////////////////////

void EEDB::EdgeSource::edge_count(long value) {
  _edge_count = value;
}

long int EEDB::EdgeSource::edge_count() {
  if(_edge_count <= 0) { get_edge_count(); }
  return _edge_count;
}


long int  EEDB::EdgeSource::get_edge_count() {
  if(_database == NULL) { return -1; }
  const char *sql = "SELECT count(*) FROM edge WHERE edge_source_id=?";
  dynadata value = _database->fetch_col_value(sql, "d", _primary_db_id);
  _edge_count = value.i_int;
  return _edge_count;
}



void  EEDB::EdgeSource::_load_metadata() {
  if(_database == NULL) { return; }
  vector<DBObject*> symbols = 
     EEDB::Symbol::fetch_all_by_edge_source_id(_database, _primary_db_id);
  _metadataset.add_metadata(symbols);

  vector<DBObject*> mdata = 
     EEDB::Metadata::fetch_all_by_edge_source_id(_database, _primary_db_id);
  _metadataset.add_metadata(mdata);
}


////////////////////////////////////////////////////////////////////////


void  EEDB::EdgeSource::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["edge_source_id"].i_int;
  _name            = row_map["name"].i_string;
  _display_name    = row_map["display_name"].i_string;
  _category        = row_map["category"].i_string;
  _classification  = row_map["classification"].i_string;
  _edge_count      = row_map["edge_count"].i_int;

  if(row_map["owner_openid"].type == MQDB::STRING) {
    _owner_identity = row_map["owner_openid"].i_string;
  }
  if(row_map["owner_identity"].type == MQDB::STRING) {
    _owner_identity = row_map["owner_identity"].i_string;
  }

  if(row_map["create_date"].type == MQDB::STRING) {
    string date_string = row_map["create_date"].i_string;
    _create_date = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["create_date"].type == MQDB::TIMESTAMP) {
    _create_date = row_map["create_date"].i_timestamp;
  }

  if(row_map["is_active"].i_string == string("y")) { _is_active=true;} else { _is_active=false; }
  if(row_map["is_visible"].i_string == string("y")) { _is_visible=true;} else { _is_visible=false; }

  if(row_map["featuresource1"].type == MQDB::STRING) {
    _feature_source1_dbid = row_map["featuresource1"].i_string;
  }
  if(row_map["featuresource2"].type == MQDB::STRING) {
    _feature_source2_dbid = row_map["featuresource2"].i_string;
  }

  //$self->{'_f1_ext_peer'} = $rowHash->{'f1_ext_peer'};
  //$self->{'_f2_ext_peer'} = $rowHash->{'f2_ext_peer'};
}


EEDB::EdgeSource*  EEDB::EdgeSource::fetch_by_id(MQDB::Database *db, long int id) {
  if(!db) { return NULL; }
  string dbid = string(db->uuid()) +"::"+ l_to_string(id) + ":::EdgeSource";
  EEDB::EdgeSource* obj = (EEDB::EdgeSource*)EEDB::DataSource::sources_cache_get(dbid);
  //EEDB::EdgeSource* obj = (EEDB::EdgeSource*) MQDB::DBCache::check_cache(db, id, "EdgeSource");
  if(obj!=NULL) { obj->retain(); return obj; }

  const char *sql = "SELECT * FROM edge_source WHERE edge_source_id=?";
  obj = (EEDB::EdgeSource*) MQDB::fetch_single(EEDB::EdgeSource::create, db, sql, "d", id);

  //MQDB::DBCache::add_to_cache(obj);
  EEDB::DataSource::add_to_sources_cache(obj);
  return obj;
}

vector<MQDB::DBObject*>  EEDB::EdgeSource::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM edge_source";
  return MQDB::fetch_multiple(EEDB::EdgeSource::create, db, sql, "");
}

EEDB::EdgeSource*  EEDB::EdgeSource::fetch_by_name(MQDB::Database *db, string name) {
  const char *sql = "SELECT * FROM edge_source WHERE name=?";
  return (EEDB::EdgeSource*) MQDB::fetch_single(EEDB::EdgeSource::create, db, sql, "s", name.c_str());
}

vector<MQDB::DBObject*>  EEDB::EdgeSource::fetch_all_by_category(MQDB::Database *db, string category) {
  const char *sql = "SELECT * FROM edge_source WHERE category=?";
  return MQDB::fetch_multiple(EEDB::EdgeSource::create, db, sql, "s", category.c_str());
}


//////////////////////////////////////////////////////////////////////////////////////////////////
// SQL db store methods

bool EEDB::EdgeSource::check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  dynadata value = db->fetch_col_value("SELECT edge_source_id FROM edge_source where name=?", "s", 
                                       name().c_str());
  if(value.type != MQDB::INT) { return false; }
  
  _primary_db_id = value.i_int;
  database(db);
  
  _peer_uuid = NULL;
  _db_id.clear();
  _xml_cache.clear();
  _simple_xml_cache.clear();
  return true;
}


bool EEDB::EdgeSource::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(check_exists_db(db)) { return true; }
  
  const char *visible_char="", *active_char="";
  
  if(_is_active)  { active_char  = "y"; }
  if(_is_visible) { visible_char = "y"; }

  db->do_sql("INSERT ignore INTO edge_source \
              (name, category, classification, create_date, is_active, is_visible, featuresource1, featuresource2, owner_identity) \
              VALUES(?,?,?,?,?,?,?,?,?)", "sssssssss", 
             name().c_str(),
             _category.c_str(),
             _classification.c_str(),
             create_date_string().c_str(),
             active_char,
             visible_char,
             _feature_source1_dbid.c_str(),
             _feature_source2_dbid.c_str(),
             _owner_identity.c_str()
            );

  if(!check_exists_db(db)) { return false; }

  //now do the symbols and metadata  
  store_metadata();
  _xml_cache.clear();
  _simple_xml_cache.clear();
  return true;
}


bool EEDB::EdgeSource::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }

  MQDB::Database *db = database();
  
  metadataset()->remove_duplicates();

  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Symbol::class_name) {
      EEDB::Symbol *sym = (EEDB::Symbol*)md;
      if(!sym->check_exists_db(db)) { sym->store(db); }
      sym->store_link_to_edge_source(this);
    } else {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_edge_source(this);
    }
  }
  _xml_cache.clear();
  _simple_xml_cache.clear();
  return true;
}


bool EEDB::EdgeSource::update_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  //unlink all old metadata
  db->do_sql("DELETE FROM edge_source_2_metadata WHERE edge_source_id=?", "d", primary_id());
  db->do_sql("DELETE FROM edge_source_2_symbol   WHERE edge_source_id=?", "d", primary_id());
  
  //store again
  store_metadata();
  return true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

/*
sub update_edge_count {
  my $self = shift;
  
  $self->get_edge_count;
  my $sql = "UPDATE edge_source SET edge_count = ? WHERE edge_source_id=?";
  $self->database->execute_sql($sql, $self->edge_count, $self->id);
}
*/


