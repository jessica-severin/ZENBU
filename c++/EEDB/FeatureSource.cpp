/*  $Id: FeatureSource.cpp,v 1.128 2016/09/16 06:58:41 severin Exp $ */

/***
NAME - EEDB::FeatureSource

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
#include <EEDB/FeatureSource.h>
#include <EEDB/Symbol.h>
#include <EEDB/Metadata.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Peer.h>

using namespace std;
using namespace MQDB;

const char*               EEDB::FeatureSource::class_name = "FeatureSource";


EEDB::FeatureSource::FeatureSource() {
  init();
}

EEDB::FeatureSource::~FeatureSource() {
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}

void _eedb_featuresource_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::FeatureSource*)obj;
}
string _eedb_featuresource_display_desc_func(MQDB::DBObject *obj) { 
  //_funcptr_display_desc = _dbobject_default_display_desc_func;
  return ((EEDB::FeatureSource*)obj)->_display_desc();
}
void _eedb_featuresource_load_metadata_func(EEDB::DataSource *obj) { 
  //_funcptr_load_metadata     = _eedb_featuresource_load_metadata_func;
  ((EEDB::FeatureSource*)obj)->_load_metadata();
}
void _eedb_featuresource_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::FeatureSource*)obj)->_xml(xml_buffer);
}
void _eedb_featuresource_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::FeatureSource*)obj)->_simple_xml(xml_buffer);
}
void _eedb_featuresource_mdata_xml_func(MQDB::DBObject *obj, string &xml_buffer, map<string,bool> tags) {
  ((EEDB::FeatureSource*)obj)->_mdata_xml(xml_buffer, tags);
}


void EEDB::FeatureSource::init() {
  EEDB::DataSource::init();
  _classname                 = EEDB::FeatureSource::class_name;
  _funcptr_delete            = _eedb_featuresource_delete_func;
  _funcptr_display_desc      = _eedb_featuresource_display_desc_func;
//_funcptr_display_contents  = _eedb_featuresource_display_contents_func;
  _funcptr_load_metadata     = _eedb_featuresource_load_metadata_func;
  _funcptr_xml               = _eedb_featuresource_xml_func;
  _funcptr_simple_xml        = _eedb_featuresource_simple_xml_func;
  _funcptr_mdata_xml         = _eedb_featuresource_mdata_xml_func;

  _feature_count             = -1;
  _create_date               = 0;
}


EEDB::FeatureSource*  EEDB::FeatureSource::new_from_name(MQDB::Database *db, string category, string name) {
  if(name.empty()) { return NULL; }
  if(!db) { return NULL; }

  EEDB::FeatureSource *fsrc = NULL;
  if(category.empty()) {
    fsrc = EEDB::FeatureSource::fetch_by_name(db, name);
  } else {
    fsrc = EEDB::FeatureSource::fetch_by_category_name(db, category, name);
  }
    
  if(!fsrc){
    fsrc = new EEDB::FeatureSource();
    fsrc->name(name);
    fsrc->category(category);
    fsrc->import_source("");
    fsrc->is_active(true);
    fsrc->is_visible(true);
    fsrc->store(db);
  }
  return fsrc;
}


////////////////////////////////////////////////////
//
// XML and description section
//
////////////////////////////////////////////////////

string EEDB::FeatureSource::_display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040,"FeatureSource(%s) %s : %s : %s",
                    db_id().c_str(),
                    _category.c_str(),
                    _name.c_str(),
                    _import_source.c_str());
  return buffer;
}

string EEDB::FeatureSource::display_contents() {
  string desc = display_desc() + "\n";
  desc += metadataset()->display_contents();   
  return desc;
}


void EEDB::FeatureSource::_xml_start(string &xml_buffer) {
  char    buffer[2048];
  //snprintf(buffer, 2040, "<featuresource id=\"%s\" category=\"%s\" name=\"%s\"",
  //                  db_id().c_str(),
  //                  _category.c_str(),
  //                  display_name().c_str());
  //xml_buffer.append(buffer);

  xml_buffer.append("<featuresource id=\"");
  xml_buffer.append(db_id());
  xml_buffer.append("\" category=\"");
  xml_buffer.append(html_escape(_category));
  xml_buffer.append("\" name=\"");
  xml_buffer.append(html_escape(display_name()));
  xml_buffer.append("\" ");

  if(!_import_source.empty()) { xml_buffer += " source=\""+_import_source+"\""; }
  if(!_comments.empty()) { xml_buffer += " comments=\""+_comments+"\""; }
  xml_buffer += " create_date=\""+ create_date_string() +"\"";
  snprintf(buffer, 2040, " create_timestamp=\"%ld\"", _create_date);
  xml_buffer.append(buffer);
  
  if(_feature_count>0) {
    snprintf(buffer, 2040, " feature_count=\"%ld\"",  _feature_count);
    xml_buffer.append(buffer);
  }
   
  if(!_owner_identity.empty()) { xml_buffer += " owner_identity=\""+_owner_identity+"\""; }

  xml_buffer.append(">");
}

void EEDB::FeatureSource::_xml_end(string &xml_buffer) {
  xml_buffer.append("</featuresource>\n");
}

void EEDB::FeatureSource::_simple_xml(string &xml_buffer) {
  if(_simple_xml_cache.empty()) {
    _xml_start(_simple_xml_cache);
    _xml_end(_simple_xml_cache);
  }
  xml_buffer.append(_simple_xml_cache);
}

void EEDB::FeatureSource::_xml(string &xml_buffer) {
  char    buffer[2048];
  _xml_start(xml_buffer);
  xml_buffer.append("\n");

  long int count = feature_count();
  if(count>0) {
    snprintf(buffer, 2040, "<feature_count value=\"%ld\" />\n",  count);
    xml_buffer += buffer;
  }
  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }

  expression_datatypes(); //to lazy load if needed
  map<string, EEDB::Datatype*>::iterator it;
  for(it=_datatypes.begin(); it!=_datatypes.end(); it++) {
    (*it).second->xml(xml_buffer);
  }
  
  _xml_end(xml_buffer);
}


void EEDB::FeatureSource::_mdata_xml(string &xml_buffer, map<string,bool> mdtags) {
  _xml_start(xml_buffer);
  
  vector<EEDB::Metadata*> mdlist = metadataset()->all_metadata_with_tags(mdtags);
  vector<EEDB::Metadata*>::iterator it1;
  for(it1=mdlist.begin(); it1!=mdlist.end(); it1++) {
    (*it1)->xml(xml_buffer);
  }
  
  /*
  //slightly expanded with description
  EEDB::Metadata  *mdata = metadataset()->find_metadata("description", "");
  if(mdata) { mdata->xml(xml_buffer); }
  mdata = metadataset()->find_metadata("eedb:assembly_name", "");
  if(mdata) { mdata->xml(xml_buffer); }
  mdata = metadataset()->find_metadata("assembly_name", "");
  if(mdata) { mdata->xml(xml_buffer); }
  mdata = metadataset()->find_metadata("eedb:display_name", "");
  if(mdata) { mdata->xml(xml_buffer); }
  mdata = metadataset()->find_metadata("zenbu:proxy_id", "");
  if(mdata) { mdata->xml(xml_buffer); }
  */
  
  _xml_end(xml_buffer);
}

EEDB::FeatureSource::FeatureSource(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "featuresource") { return; }
  
  if((attr = root_node->first_attribute("name")))           { _name = attr->value(); }
  if((attr = root_node->first_attribute("category")))       { _category = attr->value(); }
  if((attr = root_node->first_attribute("source")))         { _import_source = attr->value(); }
  if((attr = root_node->first_attribute("comments")))       { _comments = attr->value(); }
  if((attr = root_node->first_attribute("owner_openid")))   { _owner_identity = attr->value(); } //backward compatibility
  if((attr = root_node->first_attribute("owner_identity"))) { _owner_identity = attr->value(); }
  
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
  if((attr = root_node->first_attribute("feature_count"))) {
    _feature_count = strtol(attr->value(), NULL, 10); 
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
  
  // datatypes
  if((node = root_node->first_node("datatype")) != NULL) {
    while(node) {
      EEDB::Datatype *dtype = EEDB::Datatype::from_xml(node);
      if(dtype) { add_datatype(dtype); }
      node = node->next_sibling("datatype");
    }    
  }
  
  parse_metadata_into_attributes();  
}


void EEDB::FeatureSource::parse_metadata_into_attributes() {
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
}


/*
sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  //a hash tree generated by XML::TreePP
  
  my $self = undef;
  my $new = 0;
  if(($__riken_EEDB_feature_source_global_should_cache != 0) and defined($xmlTree->{'-id'})) {
    my $obj = $__riken_EEDB_feature_source_global_id_cache->{$xmlTree->{'-id'}};
    if($obj) { $self = $obj; }
  }
  unless($self) { $self = new $class; $new=1; }
  $self->db_id($xmlTree->{'-id'}) if($xmlTree->{'-id'});
  $self->name($xmlTree->{'-name'}) if($xmlTree->{'-name'});
  $self->category($xmlTree->{'-category'}) if($xmlTree->{'-category'});
  $self->import_source($xmlTree->{'-source'}) if($xmlTree->{'-source'});
  $self->comments($xmlTree->{'-comments'}) if($xmlTree->{'-comments'});
  $self->create_date($xmlTree->{'-create_date'}) if($xmlTree->{'-create_date'});
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
  
  if(($__riken_EEDB_feature_source_global_should_cache != 0) and $new) {
    $__riken_EEDB_feature_source_global_id_cache->{$self->db_id} = $self;
  }
  
  return $self;
}
*/


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string    EEDB::FeatureSource::category() { return _category; }
string    EEDB::FeatureSource::import_source() { return _import_source; }
string    EEDB::FeatureSource::comments() { return _comments; }

void  EEDB::FeatureSource::category(string value) { _category = value; }
void  EEDB::FeatureSource::import_source(string value) { _import_source = value; }
void  EEDB::FeatureSource::comments(string value) { _comments = value; }

long int  EEDB::FeatureSource::feature_count() {
  return _feature_count;
}

void  EEDB::FeatureSource::feature_count(long int value) {
  _feature_count = value;
}

long int  EEDB::FeatureSource::update_feature_count() {
  if(_database == NULL) { return -1; }

  const char *sql;
  sql = "UPDATE feature_source, \
        (SELECT feature_source_id, count(*) cnt from feature where feature_source_id=? group by feature_source_id)t \
        SET feature_count = cnt \
        WHERE feature_source.feature_source_id = t.feature_source_id";
  _database->do_sql(sql, "d", _primary_db_id);
  
  sql = "SELECT feature_count FROM feature_source WHERE feature_source_id=?";
  dynadata value = _database->fetch_col_value(sql, "d", _primary_db_id);
  _feature_count = value.i_int;
  return _feature_count;
}


void  EEDB::FeatureSource::_load_metadata() {
  if(_database == NULL) { return; }
  vector<DBObject*> symbols = 
     EEDB::Symbol::fetch_all_by_feature_source_id(_database, _primary_db_id);
  _metadataset.add_metadata(symbols);

  vector<DBObject*> mdata = 
     EEDB::Metadata::fetch_all_by_feature_source_id(_database, _primary_db_id);
  _metadataset.add_metadata(mdata);
  
  parse_metadata_into_attributes();
}


map<string, EEDB::Datatype*> EEDB::FeatureSource::expression_datatypes() {
  if(!_datatypes.empty()) { return _datatypes; }
  if(_load_datatype_from_db()) { return _datatypes; }
  if(_load_datatype_from_metadata()) { return _datatypes; }
  return _datatypes;
}


bool EEDB::FeatureSource::_load_datatype_from_db() {
  map<string, dynadata>   row_map;

  if(_database == NULL) { return false; }

  const char *sql = "SELECT DISTINCT datatype FROM expression_datatype \
                     JOIN feature_source_2_datatype  using(datatype_id) \
                     WHERE feature_source_id=?";

  void *stmt = _database->prepare_fetch_sql(sql, "d", _primary_db_id);
  while(_database->fetch_next_row_map(stmt, row_map)) {
    EEDB::Datatype *dtype = EEDB::Datatype::get_type(row_map["datatype"].i_string);
    if(dtype) { add_datatype(dtype); }
  }
  if(_datatypes.empty()) { return false; }
  return true;
}



////////////////////////////////////////////////////////////////////////

DBObject* EEDB::FeatureSource::create(map<string, dynadata> &row_map, Database* db) {
  FeatureSource* obj = new EEDB::FeatureSource;
  obj->database(db);
  obj->init_from_row_map(row_map);
  return obj;
}


void  EEDB::FeatureSource::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["feature_source_id"].i_int;
  _name            = row_map["name"].i_string;
  _category        = row_map["category"].i_string;
  _import_source   = row_map["import_source"].i_string;
  _comments        = row_map["comments"].i_string;
  _feature_count   = row_map["feature_count"].i_int;
  _owner_identity  = row_map["owner_openid"].i_string;

  if(row_map["import_date"].type == MQDB::STRING) {
    string date_string = row_map["import_date"].i_string;
    _create_date = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["import_date"].type == MQDB::TIMESTAMP) {
    _create_date = row_map["import_date"].i_timestamp;
  }

  if(row_map["is_active"].i_string == string("y")) { _is_active=true;} else { _is_active=false; }
  if(row_map["is_visible"].i_string == string("y")) { _is_visible=true;} else { _is_visible=false; }
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::FeatureSource::check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  dynadata value = db->fetch_col_value("SELECT feature_source_id FROM feature_source where name=?", "s", 
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


bool EEDB::FeatureSource::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(check_exists_db(db)) { return true; }
  
  const char *visible_char="", *active_char="";
  
  if(_is_active)  { active_char  = "y"; }
  if(_is_visible) { visible_char = "y"; }

  db->do_sql("INSERT ignore INTO feature_source \
              (name, category, import_source, import_date, is_active, is_visible) \
              VALUES(?,?,?,?,?,?)", "ssssss", 
             name().c_str(),
             _category.c_str(),
             _import_source.c_str(),
             create_date_string().c_str(),
             active_char,
             visible_char
            );
             
  if(!check_exists_db(db)) { return false; }

  //now do the symbols and metadata  
  store_metadata();
  _xml_cache.clear();
  _simple_xml_cache.clear();
  return true;
}


bool EEDB::FeatureSource::store_metadata() {
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
      sym->store_link_to_featuresource(this);
    } else {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_featuresource(this);
    }
  }
  _xml_cache.clear();
  _simple_xml_cache.clear();
  return true;
}


bool EEDB::FeatureSource::update_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  //unlink all old metadata
  db->do_sql("DELETE FROM feature_source_2_metadata WHERE feature_source_id=?", "d", primary_id());
  db->do_sql("DELETE FROM feature_source_2_symbol   WHERE feature_source_id=?", "d", primary_id());
  
  //store again
  store_metadata();
  return true;
}


/*
sub update {
  my $self = shift;

  unless($self->database) { return; }
  unless(defined($self->primary_id)) { return; }
  
  my $sql = "UPDATE feature_source SET category=?, import_source=?, is_active=?, is_visible=? WHERE feature_source_id=?";
  $self->database->execute_sql($sql, 
                               $self->category, 
                               $self->import_source, 
                               $self->is_active, 
                               $self->is_visible, 
                               $self->primary_id);
}
*/


/*
sub sync_importdate_to_features {
  my $self = shift;
  
  my $sql = "SELECT max(last_update) FROM feature where feature_source_id=?";
  my $lastdate =  $self->fetch_col_value($self->database, $sql, $self->id);

  $sql = "UPDATE feature_source SET import_date=? WHERE feature_source_id=?";
  $self->database->execute_sql($sql, $lastdate, $self->id);
}
*/




