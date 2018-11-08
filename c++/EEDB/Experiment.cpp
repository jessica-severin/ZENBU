/*  $Id: Experiment.cpp,v 1.116 2016/09/16 06:58:41 severin Exp $ */

/***
NAME - EEDB::Experiment

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
#include <MQDB/MappedQuery.h>
#include <EEDB/Experiment.h>
#include <EEDB/Peer.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::Experiment::class_name = "Experiment";

EEDB::Experiment::Experiment() {
  init();
}

EEDB::Experiment::~Experiment() {
}

void _eedb_experiment_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Experiment*)obj;
}
string _eedb_experiment_display_desc_func(MQDB::DBObject *obj) { 
  //_funcptr_display_desc = _dbobject_default_display_desc_func;
  return ((EEDB::Experiment*)obj)->_display_desc();
}
void _eedb_experiment_load_metadata_func(EEDB::DataSource *obj) { 
  //_funcptr_load_metadata     = _eedb_experiment_load_metadata_func;
  ((EEDB::Experiment*)obj)->_load_metadata();
}
void _eedb_experiment_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Experiment*)obj)->_xml(xml_buffer);
}
void _eedb_experiment_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Experiment*)obj)->_simple_xml(xml_buffer);
}
void _eedb_experiment_mdata_xml_func(MQDB::DBObject *obj, string &xml_buffer, map<string,bool> tags) {
  ((EEDB::Experiment*)obj)->_mdata_xml(xml_buffer, tags);
}
//  _funcptr_xml               = _eedb_experiment_xml_func;
//  _funcptr_simple_xml        = _eedb_experiment_simple_xml_func;



void EEDB::Experiment::init() {
  EEDB::DataSource::init();
  _classname                 = EEDB::Experiment::class_name;
  _funcptr_delete            = _eedb_experiment_delete_func;
  _funcptr_display_desc      = _eedb_experiment_display_desc_func;
  _funcptr_load_metadata     = _eedb_experiment_load_metadata_func;
  _funcptr_xml               = _eedb_experiment_xml_func;
  _funcptr_simple_xml        = _eedb_experiment_simple_xml_func;
  _funcptr_mdata_xml         = _eedb_experiment_mdata_xml_func;

  _series_point              = 0.0;
}


////////////////////////////////////////////////////

bool EEDB::Experiment::operator== (EEDB::Experiment* b) {
  return (this->db_id() == b->db_id());
}


bool EEDB::Experiment::sort_func (EEDB::Experiment *a, EEDB::Experiment *b) { 
  // < function
  if(a == NULL) { return false; }  //real < NULL 
  if(b == NULL) { return true; }  //a not NULL, but b is NULL

  if(!(a->platform().empty()) and b->platform().empty()) { return true; }
  if(a->platform().empty() and !(b->platform().empty())) { return false; }

  if(a->platform() < b->platform()) { return true; }
  if(a->platform() > b->platform()) { return false; }

  if(a->display_name() < b->display_name()) { return true; }
  return false;
}


////////////////////////////////////////////////////
//
// XML and description section
//
////////////////////////////////////////////////////

string EEDB::Experiment::_display_desc() {
  char buffer[2048];
  string str = "Experiment(" + db_id()+ ")";
  str += " ["+_platform+"]";
  if(!_display_name.empty()) { str += " "+_display_name; }
  if(!_series_name.empty()) {
    snprintf(buffer, 2040," : (%s, %1.2f)", _series_name.c_str(), _series_point);
    str += buffer;
  }
  str += " : {"+ _name +"}";
  return str;
}

/*
sub display_contents {
  my $self = shift;
  my $str = $self->display_desc;
  $str .= "\n". $self->metadataset->display_contents;   
  return $str;
}
*/


string EEDB::Experiment::display_contents() {
  return display_desc();
}

void EEDB::Experiment::_xml_start(string &xml_buffer) {
  char    buffer[2048];

  xml_buffer.append("<experiment id=\"");
  xml_buffer.append(db_id());
  xml_buffer.append("\" platform=\"");
  xml_buffer.append(html_escape(_platform));
  xml_buffer.append("\" name=\"");
  xml_buffer.append(html_escape(display_name()));
  xml_buffer.append("\" exp_acc=\"");
  xml_buffer.append(html_escape(_name));
  xml_buffer.append("\" ");

  if(!_series_name.empty()) { 
    xml_buffer.append(" series_name=\"");
    xml_buffer.append(html_escape(_series_name));
    xml_buffer.append("\" ");
  }
  
  snprintf(buffer, 2040, " series_point=\"%1.3f\"", _series_point);
  xml_buffer.append(buffer);

  if(_create_date>0) {
    xml_buffer += " create_date=\""+ create_date_string() +"\"";
    snprintf(buffer, 2040, " create_timestamp=\"%ld\"", _create_date);
    xml_buffer.append(buffer);
  }

  if(!_owner_identity.empty()) { xml_buffer += " owner_identity=\""+_owner_identity+"\""; }
  xml_buffer.append(">");
}

void EEDB::Experiment::_xml_end(string &xml_buffer) {
  xml_buffer.append("</experiment>\n");
}

void EEDB::Experiment::_simple_xml(string &xml_buffer) {
  if(_simple_xml_cache.empty()) {
    _xml_start(_simple_xml_cache);
    _xml_end(_simple_xml_cache);
  }
  xml_buffer.append(_simple_xml_cache);
}

void EEDB::Experiment::_xml(string &xml_buffer) {
  if(_xml_cache.empty()) {
    _xml_start(_xml_cache);
    _xml_cache.append("\n");

    EEDB::MetadataSet *mdset = metadataset();
    if(mdset!=NULL) { mdset->xml(_xml_cache); }

    expression_datatypes(); //to lazy load if needed
    map<string, EEDB::Datatype*>::iterator it;
    for(it=_datatypes.begin(); it!=_datatypes.end(); it++) {
      (*it).second->xml(_xml_cache);
    }

    _xml_end(_xml_cache);
  }
  xml_buffer.append(_xml_cache);
}

void EEDB::Experiment::_mdata_xml(string &xml_buffer, map<string,bool> mdtags) {
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

EEDB::Experiment::Experiment(void *xml_node, bool load_metadata) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "experiment") { return; }
  
  if((attr = root_node->first_attribute("platform")))       { _platform = attr->value(); }
  if((attr = root_node->first_attribute("exp_acc")))        { _name = attr->value(); }
  if((attr = root_node->first_attribute("series_name")))    { _series_name = attr->value(); }
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
  if((attr = root_node->first_attribute("name"))) { 
    _display_name = attr->value();
  }
  if((attr = root_node->first_attribute("series_point"))) { 
  }
  if((attr = root_node->first_attribute("create_timestamp"))) {
    _create_date = strtol(attr->value(), NULL, 10); 
  }
  
  // metadata
  if(load_metadata) {
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
  
  // datatypes
  if((node = root_node->first_node("datatype")) != NULL) {
    while(node) {
      EEDB::Datatype *dtype = EEDB::Datatype::from_xml(node);
      if(dtype) { add_datatype(dtype); }
      node = node->next_sibling("datatype");
    }    
  }
}


void EEDB::Experiment::parse_metadata_into_attributes() {
  vector<EEDB::Metadata*> _mdata_list = _metadataset.metadata_list();
  for(unsigned int i=0; i<_mdata_list.size(); i++) {
    EEDB::Metadata *md = _mdata_list[i];  
    if(md->type() == "eedb:display_name") { _display_name = md->data(); }        
    if(md->type() == "description") { _description = md->data(); }        
    if(md->type() == "display_name") { _display_name = md->data(); }        
    if(md->type() == "eedb:platform") { _platform = md->data(); }        
    if(md->type() == "eedb:series_name") { _series_name = md->data(); }        
    if(md->type() == "eedb:series_point") { _series_point = strtod(md->data().c_str(), NULL); }            
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
  
  my $self = new $class;
  $self->db_id($xmlTree->{'-id'}) if($xmlTree->{'-id'});
  $self->platform($xmlTree->{'-platform'}) if($xmlTree->{'-platform'});
  $self->display_name($xmlTree->{'-name'}) if($xmlTree->{'-name'});
  $self->display_name($xmlTree->{'-exp_name'}) if($xmlTree->{'-exp_name'});
  $self->exp_accession($xmlTree->{'-exp_acc'}) if($xmlTree->{'-exp_acc'});
  $self->series_name($xmlTree->{'-series_name'}) if($xmlTree->{'-series_name'});
  $self->series_point($xmlTree->{'-series_point'}) if($xmlTree->{'-series_point'});
  $self->is_active('y');
 
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
  return $self;
}
*/



////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string    EEDB::Experiment::platform() { return _platform; }
string    EEDB::Experiment::series_name() { return _series_name; }
double    EEDB::Experiment::series_point() { return _series_point; }

void  EEDB::Experiment::platform(string value)     { _platform = value; }
void  EEDB::Experiment::series_name(string value)  { _series_name = value; }
void  EEDB::Experiment::series_point(double value) { _series_point = value; }


void  EEDB::Experiment::_load_metadata() {
  if(_database == NULL) { return; }
  vector<DBObject*> symbols = 
     EEDB::Symbol::fetch_all_by_experiment_id(_database, _primary_db_id);
  _metadataset.add_metadata(symbols);

  vector<DBObject*> mdata = 
     EEDB::Metadata::fetch_all_by_experiment_id(_database, _primary_db_id);
  _metadataset.add_metadata(mdata);

  parse_metadata_into_attributes();
}


map<string, EEDB::Datatype*> EEDB::Experiment::expression_datatypes() {
  if(!_datatypes.empty()) { return _datatypes; }
  if(_load_datatype_from_db()) { return _datatypes; }
  if(_load_datatype_from_metadata()) { return _datatypes; }
  return _datatypes;
}


bool EEDB::Experiment::_load_datatype_from_db() {
  map<string, dynadata>   row_map;
 
  if(_database == NULL) { return false; }

  const char *sql = "SELECT DISTINCT datatype FROM expression_datatype \
                     JOIN experiment_2_datatype  using(datatype_id) \
                     WHERE experiment_id=?";

  void *stmt = _database->prepare_fetch_sql(sql, "d", _primary_db_id);
  while(_database->fetch_next_row_map(stmt, row_map)) {
    EEDB::Datatype *dtype = EEDB::Datatype::get_type(row_map["datatype"].i_string);
    if(dtype) { add_datatype(dtype); }
  }
  if(_datatypes.empty()) { return false; }
  return true;
}


////////////////////////////////////////////////////////////////////////


void  EEDB::Experiment::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id     = row_map["experiment_id"].i_int;
  _name              = row_map["exp_accession"].i_string;
  _display_name      = row_map["display_name"].i_string;
  _platform          = row_map["platform"].i_string;
  _series_name       = row_map["series_name"].i_string;
  _series_point      = row_map["series_point"].i_double;
  _owner_identity    = row_map["owner_openid"].i_string;

  if(row_map["is_active"].i_string == string("y"))  { _is_active=true;} else { _is_active=false; }
  if(row_map["is_visible"].i_string == string("y")) { _is_visible=true;} else { _is_visible=false; }
}


//////////////////////////////////////////////////////////////////////////////////////////////////
// Global cache methods
//////////////////////////////////////////////////////////////////////////////////////////////////

/*
sub set_cache_behaviour {
  my $class = shift;
  my $mode = shift;

  $__riken_EEDB_experiment_global_should_cache = $mode;

  if(defined($mode) and ($mode eq '0')) {
    //if turning off caching, then flush the caches
    $__riken_EEDB_experiment_global_id_cache = {};
    $__riken_EEDB_experiment_global_name_cache = {};
  }
}
*/

/*
sub global_uncache {
  my $self = shift;
  delete $__riken_EEDB_experiment_global_id_cache->{$self->db_id};
  delete $__riken_EEDB_experiment_global_name_cache->{$self->database() . $self->exp_accession};
  return undef;
}
*/


/*
sub get_from_cache_by_id {
  my $class = shift;
  my $dbid = shift;

  if($__riken_EEDB_experiment_global_should_cache == 0) { return undef; }
  return $__riken_EEDB_experiment_global_id_cache->{$dbid};
}
*/

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::Experiment::check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  dynadata value = db->fetch_col_value("SELECT experiment_id FROM experiment WHERE exp_accession=?", "s", 
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


bool EEDB::Experiment::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(check_exists_db(db)) { return true; }
  
  const char *visible_char="", *active_char="";
  
  if(_is_active)  { active_char  = "y"; }
  if(_is_visible) { visible_char = "y"; }

  db->do_sql("INSERT ignore INTO experiment \
             (exp_accession, display_name, platform, series_name, series_point, is_active) \
             VALUES(?,?,?,?,?,?)", "ssssfs", 
             name().c_str(),
             display_name().c_str(),
             _platform.c_str(),
             _series_name.c_str(),
             _series_point,
             active_char
            );
             
  if(!check_exists_db(db)) { return false; }

  //now do the symbols and metadata  
  store_metadata();
  
  _xml_cache.clear();
  _simple_xml_cache.clear();
  
  return true;
}


bool EEDB::Experiment::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }

  MQDB::Database *db = database();
  
  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Symbol::class_name) {
      EEDB::Symbol *sym = (EEDB::Symbol*)md;
      if(!sym->check_exists_db(db)) { sym->store(db); }
      sym->store_link_to_experiment(this);
    } else {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_experiment(this);
    }
  }
  _xml_cache.clear();
  _simple_xml_cache.clear();
  return true;
}


bool EEDB::Experiment::update_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  //unlink all old metadata
  db->do_sql("DELETE FROM experiment_2_metadata WHERE experiment_id=?", "d", primary_id());
  db->do_sql("DELETE FROM experiment_2_symbol   WHERE experiment_id=?", "d", primary_id());

  //store again
  store_metadata();
  return true;
}


/*
sub update {
  my $self = shift;

  die("error no database set\n") unless($self->database);
  dies("Experiment with undef id") unless(defined($self->primary_id));
  
  my $sql = "UPDATE experiment SET display_name=?, platform=?, series_name=?, series_point=?, is_active=? WHERE experiment_id=?";
  $self->database->execute_sql($sql, 
                               $self->display_name, 
                               $self->platform, 
                               $self->series_name, 
                               $self->series_point, 
                               $self->is_active, 
                               $self->primary_id);
}
*/



