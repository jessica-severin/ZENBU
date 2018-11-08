/*  $Id: EdgeSource.cpp,v 1.68 2014/01/27 10:14:12 severin Exp $ */

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
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/EdgeSource.h>

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

  _edge_count     = -1;
  _create_date    = 0;
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
  snprintf(buffer, 2040, "<edgesource id=\"%s\" name=\"%s\" create_date=\"%s\" count=\"%ld\" ",
                    db_id().c_str(),
                    display_name().c_str(),
                    create_date_string().c_str(),
                    edge_count());
  xml_buffer.append(buffer);

  if(!_classification.empty()) { xml_buffer += " classification=\"" + _classification + "\""; } 
  if(!_category.empty())       { xml_buffer += " category=\"" + _category + "\""; } 
  //$str .= sprintf(" f1_federated=\"%s\"", $self->peer1->alias) if($self->db1_is_external); 
  //$str .= sprintf(" f2_federated=\"%s\"", $self->peer2->alias) if($self->db2_is_external); 
  if(!_owner_identity.empty()) { xml_buffer += " owner_identity=\""+_owner_identity+"\""; }

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

  if(!_owner_identity.empty()) {
    xml_buffer += "<owner_identity>"+_owner_identity+"</owner_identity>\n";
  }

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }

  _xml_end(xml_buffer);
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
time_t    EEDB::EdgeSource::create_date() { return _create_date; }

string    EEDB::EdgeSource::create_date_string() { 
  string str;
  if(_create_date>0) {
    time_t t_update = _create_date;
    string t_value = ctime(&t_update);
    t_value.resize(t_value.size()-1); //remove \n
    str = t_value;
  }
  return str;
}

void EEDB::EdgeSource::category(string value) { 
  _category = value;
}
void EEDB::EdgeSource::classification(string value) { 
  _classification = value;
}
void EEDB::EdgeSource::create_date(time_t value) { 
  _create_date = value;
}

/*
sub display_name {
  my $self = shift;
  return $self->{'display_name'} = shift if(@_);
  if(!defined($self->{'display_name'}) and defined($self->{'name'})) {
    return $self->{'name'};
  } else {
    return $self->{'display_name'};
  }
}
*/


/*
sub db1_is_external {
  my $self = shift;  
  if(defined($self->{'_f1_ext_peer'})) { return 1;} else { return 0; }
}
*/

/*
sub db2_is_external {
  my $self = shift;  
  if(defined($self->{'_f2_ext_peer'})) { return 1;} else { return 0; }
}
*/

/*
sub peer1 {
  my $self = shift;
  my $peer = shift;
  
  if($peer) {
    unless(defined($peer) && $peer->isa('EEDB::Peer')) {
      die('peer1 param must be a EEDB::Peer');
    }
    $self->{'_peer1'} = $peer;
  }

  if(defined($self->{'_f1_ext_peer'})) { 
    if(!defined($self->{'_peer1'})) {
      $self->{'_peer1'} = EEDB::Peer->fetch_by_name($self->database, $self->{'_f1_ext_peer'});
    }
  }
  return $self->{'_peer1'};
}
*/

/*
sub peer2 {
  my $self = shift;
  my $peer = shift;
  
  if($peer) {
    unless(defined($peer) && $peer->isa('EEDB::Peer')) {
      die('peer2 param must be a EEDB::Peer');
    }
    $self->{'_peer2'} = $peer;
  }
  
  if(defined($self->{'_f2_ext_peer'})) { 
    if(!defined($self->{'_peer2'})) {
      $self->{'_peer2'} = EEDB::Peer->fetch_by_name($self->database, $self->{'_f2_ext_peer'});
    }
  }
  return $self->{'_peer2'};
}
*/


/*
sub database1 {
  my $self = shift;
  if($self->peer1) { return $self->peer1->peer_database; }
  else { return $self->database; }
}
*/

/*
sub database2 {
  my $self = shift;
  if($self->peer2) { return $self->peer2->peer_database; }
  else { return $self->database; }
}
*/

////////////////////////////////////////////////////

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
  _owner_identity  = row_map["owner_openid"].i_string;

  if(row_map["create_date"].type == MQDB::STRING) {
    string date_string = row_map["create_date"].i_string;
    _create_date = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["create_date"].type == MQDB::TIMESTAMP) {
    _create_date = row_map["create_date"].i_timestamp;
  }

  if(row_map["is_active"].i_string == string("y")) { _is_active=true;} else { _is_active=false; }
  if(row_map["is_visible"].i_string == string("y")) { _is_visible=true;} else { _is_visible=false; }

  //$self->{'_f1_ext_peer'} = $rowHash->{'f1_ext_peer'};
  //$self->{'_f2_ext_peer'} = $rowHash->{'f2_ext_peer'};
}


//////////////////////////////////////////////////////////////////////////////////////////////////
// Global cache methods
//////////////////////////////////////////////////////////////////////////////////////////////////

/*
sub set_cache_behaviour {
  my $class = shift;
  my $mode = shift;
  
  $__riken_gsc_edgesource_global_should_cache = $mode;
  
  if(defined($mode) and ($mode eq '0')) {
    //if turning off caching, then flush the caches
    $__riken_gsc_edgesource_global_id_cache = {};
    $__riken_gsc_edgesource_global_name_cache = {};
  }
}
*/

/*
sub create_from_name {
  //if $db parameter is supplied then it will check the database first
  //otherwise it will create one and store it (if $db is provided)
  my $class     = shift;
  my $esrc_name = shift;
  my $db        = shift; //optional
  
  if(!$esrc_name) { return undef; }
  
  my $category = undef;
  if($esrc_name =~ /(\w+)\:\:(.+)/) {
    $category = $1;
    $esrc_name = $2;
  }
  my $esrc = undef;
  $esrc = EEDB::EdgeSource->fetch_by_name($db, $esrc_name) if(defined($db));
  unless($esrc){
    $esrc = new EEDB::EdgeSource;
    $esrc->name($esrc_name);
    $esrc->category($category);
    $esrc->store($db) if($db);
  }
  return $esrc;
}
*/

/*
sub global_uncache {
  my $self = shift;
  delete $__riken_gsc_edgesource_global_id_cache->{$self->db_id};
  delete $__riken_gsc_edgesource_global_name_cache->{$self->database() . $self->name};
  return undef;
}
*/

/*
sub get_from_cache_by_id {
  my $class = shift;
  my $dbid = shift;

  if($__riken_gsc_edgesource_global_should_cache == 0) { return undef; }
  return $__riken_gsc_edgesource_global_id_cache->{$dbid};
}
*/

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
  if(defined($self->primary_id)) { return $self; }
  
  //check if it is already in the database
  my $dbID = $db->fetch_col_value("SELECT edge_source_id FROM edge_source where name=?", $self->name);
  if($dbID) {
    $self->primary_id($dbID);
    $self->database($db);
    return $self;
  } else {
    return undef;
  }
}
*/

/*
sub store {
  my $self = shift;
  my $db   = shift;
  
  unless($db) { return undef; }  
  if($self->check_exists_db($db)) { return $self; }
  
  my $peer1_name = undef;
  my $peer2_name = undef;
  
  if($self->peer1) { $peer1_name = $self->peer1->alias; }
  if($self->peer2) { $peer2_name = $self->peer2->alias; }
  
  $db->execute_sql("INSERT ignore INTO edge_source ".
                   "(is_active, is_visible, name, display_name, category, classification, f1_ext_peer, f2_ext_peer) ".
                   "VALUES(?,?,?,?,?,?,?,?)",
                    $self->is_active,
                    $self->is_visible,
                    $self->name,
                    $self->display_name,
                    $self->category,
                    $self->classification,
                    $peer1_name,
                    $peer2_name
                    );
                    
  $self->check_exists_db($db);  //checks the database and sets the primary_id

  //now do the symbols and metadata  
  $self->store_metadata;
                    
  return $self; 
}
*/

/*
sub store_metadata {
  my $self = shift;
  unless($self->database) {
    printf(STDERR "ERROR: no database to store metadata\n");
    return;
  }

  my $mdata_list = $self->metadataset->metadata_list;
  foreach my $mdata (@$mdata_list) {
    if(!defined($mdata->primary_id)) { 
      $mdata->store($self->database);
    }
    $mdata->store_link_to_edge_source($self);
  }
}
*/

/*
sub update_edge_count {
  my $self = shift;
  
  $self->get_edge_count;
  my $sql = "UPDATE edge_source SET edge_count = ? WHERE edge_source_id=?";
  $self->database->execute_sql($sql, $self->edge_count, $self->id);
}
*/


