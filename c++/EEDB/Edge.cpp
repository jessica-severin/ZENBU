/* $Id: Edge.cpp,v 1.81 2013/04/08 05:47:52 severin Exp $ */

/***

NAME - EEDB::Edge

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

#include <MQDB/MappedQuery.h>
#include <EEDB/Edge.h>
#include <EEDB/Feature.h>
//#include <boost/algorithm/string.hpp>

using namespace std;
using namespace MQDB;

const char*  EEDB::Edge::class_name = "Edge";

void _eedb_edge_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Edge*)obj;
}
void _eedb_edge_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Edge*)obj)->_xml(xml_buffer);
}
void _eedb_edge_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Edge*)obj)->_simple_xml(xml_buffer);
}


EEDB::Edge::Edge() {
  init();
}

EEDB::Edge::~Edge() {
  if(_feature1 != NULL) { _feature1->release(); }
  if(_feature2 != NULL) { _feature2->release(); }
  _feature1 = NULL;
  _feature2 = NULL;
  _feature1_id = -1;
  _feature2_id = -1;
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}


void EEDB::Edge::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::Edge::class_name;
  _funcptr_delete            = _eedb_edge_delete_func;
  _funcptr_xml               = _eedb_edge_xml_func;
  _funcptr_simple_xml        = _eedb_edge_simple_xml_func;
    
  _metadata_loaded   = false;
  _edge_source       = NULL;
  _feature1          = NULL;
  _feature2          = NULL;

  _weight            = 0.0;
  _direction         = ' ';

  _feature1_id       = -1;
  _feature2_id       = -1;
  _edge_source_id    = -1;
}

void EEDB::Edge::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Edge::display_desc() {
  char buffer[2048];  
  snprintf(buffer, 2040, "Edge(%s) %s(%ld) => %s(%ld) : %f %s",
           db_id().c_str(), 
           feature1()->primary_name().c_str(),
           feature1_id(),
           feature2()->primary_name().c_str(),
           feature2_id(),
           _weight,
           edge_source()->name().c_str()
           );  
  /*
  my $mdata_list = metadataset->metadata_list;
  my $first=1;
  if(defined($mdata_list) and (scalar(@$mdata_list))) {
    $str .= ' (';
    foreach my $mdata (@$mdata_list) {
      if($first) { $first=0; }
      else { $str .= ','; }
      $str .= sprintf("(%s,\"%s\")", $mdata->type, $mdata->data);
    }
    $str .= ')';
  }
  */
  return buffer;
}


string EEDB::Edge::display_contents() {
  string str = display_desc();
  /*
  my $str = sprintf("Edge(%s) %s(%s) => %s(%s) : %f %s",
           $self->id, 
           $self->feature1->primary_name,
           $self->feature1->id,
           $self->feature2->primary_name,
           $self->feature2->id,
           $self->weight,
           $self->edge_source->uqname
           );  
  $str .= "\n". $self->metadataset->display_contents;   
  */
  return str;
}


void EEDB::Edge::_xml_start(string &xml_buffer) {
  char buffer[2048];
  xml_buffer.append("<edge id=\"");
  xml_buffer.append(db_id());
  xml_buffer.append("\"");

  snprintf(buffer, 2040, " dir=\"%c\"", _direction); 
  xml_buffer.append(buffer);

  //string                _sub_type;

  if(_feature1_id != -1) { 
    snprintf(buffer, 2040, " f1id=\"%ld\"", _feature1_id); 
    xml_buffer.append(buffer);
  }
  if(_feature2_id != -1) { 
    snprintf(buffer, 2040, " f2id=\"%ld\"", _feature2_id); 
    xml_buffer.append(buffer);
  }

  if(_weight != 0.0) { 
    snprintf(buffer, 2040, " weight=\"%1.5f\"", _weight); 
    xml_buffer.append(buffer);
  }
  xml_buffer.append(" >");
  
  //for now I need to leave this in. the jscript is still not
  //smart enough to efficiently connect external edgesources 2012-05-29
  if(edge_source()) { edge_source()->simple_xml(xml_buffer); }
  
  
  /*
   my $str = sprintf("<edge id=\"%s\" source=\"%s\" source_id=\"%s\" weight=\"%f\" dir=\"%s\" >\n",
   $self->db_id,
   $self->edge_source->uqname,
   $self->edge_source->db_id,
   $self->weight,
   $self->direction,
   );
   */
    
  /*
  my $str = sprintf("<edge source=\"%s\" f1id=\"%d\" f2id=\"%d\" name1=\"%s\" name2=\"%s\" weight=\"%f\" dir=\"%s\" edge_id=\"%s\" />",
           $self->edge_source->uqname,
           $self->feature1_id,
           $self->feature2_id,
           $self->feature1->primary_name,
           $self->feature2->primary_name,
           $self->weight,
           $self->direction,
           $self->id
           );
  */  
}

void EEDB::Edge::_xml_end(string &xml_buffer) {  
  xml_buffer.append("</edge>\n");
}

void EEDB::Edge::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::Edge::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);

  if(feature1()) { 
    xml_buffer.append("<feature1>");
    feature1()->simple_xml(xml_buffer);
    xml_buffer.append("</feature1>");
  }

  if(feature2()) { 
    xml_buffer.append("<feature2>");
    feature2()->simple_xml(xml_buffer);
    xml_buffer.append("</feature2>");
  }

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }

  _xml_end(xml_buffer);
}



////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

long int  EEDB::Edge::feature1_id() { 
  if(_feature1 != NULL) { return _feature1->primary_id(); }
  return _feature1_id;
}
long int  EEDB::Edge::feature2_id() { 
  if(_feature2 != NULL) { return _feature2->primary_id(); }
  return _feature2_id; 
}

/*
sub direction {
  my $self = shift;
  return $self->{'direction'} = shift if(@_);
  $self->{'direction'}='' unless(defined($self->{'direction'}));
  return $self->{'direction'};
}

void  EEDB::Feature::strand(char value) {
  if((value == '-') or (value == '+')) {
    _strand = value;
  } else {
    _strand = ' ';
  }

}
*/

// lazy load object methods

EEDB::MetadataSet*   EEDB::Edge::metadataset() {
  if(!_metadata_loaded) {
    _metadata_loaded = true;
    if(_database != NULL) {
      vector<DBObject*> symbols = EEDB::Symbol::fetch_all_by_edge_id(_database, _primary_db_id);
      _metadataset.add_metadata(symbols);

      vector<DBObject*> mdata = EEDB::Metadata::fetch_all_by_edge_id(_database, _primary_db_id);
      _metadataset.add_metadata(mdata);
    }
    //$self->{'metadataset'}->remove_duplicates;
  }
  return &_metadataset;
}


EEDB::EdgeSource*  EEDB::Edge::edge_source() {
  if(_edge_source != NULL) { return _edge_source; }
  if(_database and (_edge_source_id != -1)) { //lazy load from database
    _edge_source = EEDB::EdgeSource::fetch_by_id(_database, _edge_source_id);
  }
  return _edge_source;
}

void  EEDB::Edge::edge_source(EEDB::EdgeSource* obj) {
  if(_edge_source != NULL) { _edge_source->release(); }
  _edge_source = obj;
  _edge_source_id = -1;
  if(_edge_source != NULL) { _edge_source->retain(); }
}


EEDB::Feature*  EEDB::Edge::feature1() {
  if(_feature1 != NULL) { return _feature1; }
  if(_database and (_feature1_id != -1)) { //lazy load from database
    _feature1 = EEDB::Feature::fetch_by_id(_database, _feature1_id);
  }
  return _feature1;
}

void  EEDB::Edge::feature1(EEDB::Feature* obj) {
  if(_feature1 != NULL) { _feature1->release(); }
  _feature1 = obj;
  _feature1_id = -1;
  if(_feature1 != NULL) { _feature1->retain(); }
}


EEDB::Feature*  EEDB::Edge::feature2() {
  if(_feature2 != NULL) { return _feature2; }
  if(_database and (_feature2_id != -1)) { //lazy load from database
    _feature2 = EEDB::Feature::fetch_by_id(_database, _feature2_id);
  }
  return _feature2;
}

void  EEDB::Edge::feature2(EEDB::Feature* obj) {
  if(_feature2 != NULL) { _feature2->release(); }
  _feature2 = obj;
  _feature2_id = -1;
  if(_feature2 != NULL) { _feature2->retain(); }
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods : storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::Edge::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id    = row_map["edge_id"].i_int;
  _edge_source_id   = row_map["edge_source_id"].i_int;
  _feature1_id      = row_map["feature1_id"].i_int;
  _feature2_id      = row_map["feature2_id"].i_int;
  _direction        = row_map["direction"].i_string[0];
  _sub_type         = row_map["sub_type"].i_string;
  _weight           = row_map["weight"].i_double;
  if(_direction == '\0') { _direction = ' '; }
}


/*
# $Id: Edge.cpp,v 1.81 2013/04/08 05:47:52 severin Exp $
=head1 NAME - EEDB::Edge

=head1 SYNOPSIS

=head1 DESCRIPTION

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
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

=head1 APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

=cut

my $__riken_EEDB_edge_global_should_cache = 0;
my $__riken_EEDB_edge_global_id_cache = {};
my $__riken_EEDB_edge_global_featureid_cache = {};

$VERSION = 0.953;

package EEDB::Edge;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use EEDB::Feature;
use EEDB::EdgeSource;
use EEDB::MetadataSet;

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "Edge"; }

sub set_cache_behaviour {
  my $class = shift;
  my $mode = shift;
  
  $__riken_EEDB_edge_global_should_cache = $mode;
  
  if(defined($mode) and ($mode eq '0')) {
    #if turning off caching, then flush the caches
    $__riken_EEDB_edge_global_id_cache = {};
    $__riken_EEDB_edge_global_featureid_cache = {};
  }
}

sub get_cache_size {
  return scalar(keys(%$__riken_EEDB_edge_global_id_cache));
}



#######################

sub get_neighbor {
  my $self = shift;
  my $feature = shift;

  my $dir = "";
  my $neighbor = undef;

  if($self->feature1_id == $feature->id) {
    $dir = "link_to";
    $neighbor = $self->feature2;
  } elsif($self->feature2_id == $feature->id) {
    $dir = "link_from";
    $neighbor = $self->feature1;
  } elsif($self->feature1_id == $self->feature2_id) {
    $dir = "link_self";
    $neighbor = $self->feature1;
  }
  return ($dir, $neighbor);
}


#################################################
#
# DBObject override methods
#
#################################################

sub store {
  my $self = shift;
  my $db   = shift;
  
  if($db) { $self->database($db); }
  my $dbh = $self->database->get_connection;  
  my $sql = "INSERT ignore INTO edge (
                feature1_id,
                feature2_id,
                sub_type,
                direction,
                edge_source_id,
                weight
                )
             VALUES(?,?,?,?,?,?)";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->feature1->id,
                $self->feature2->id,
                $self->sub_type,
                $self->direction,
                $self->edge_source->id,
                $self->weight);

  my $dbID = $sth->{'mysql_insertid'};
  #my $dbID = $dbh->last_insert_id(undef, undef, qw(edge edge_id));
  $sth->finish;
  $self->primary_id($dbID);

  return $self;
}

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
    $mdata->store_link_to_edge($self);
  }
}

sub check_exists_db {
  my $self = shift;
  
  unless($self->edge_source) { return undef; }
  unless($self->edge_source->database) { return undef; }
  if(defined($self->primary_id)) { return $self; }
  
  #check if it is already in the database
  my $dbc = $self->edge_source->database->get_connection;  
  my $sth = $dbc->prepare("SELECT edge_id FROM edge where feature1_id=? and feature2_id=? and edge_source_id=?");
  $sth->execute($self->feature1->id, $self->feature2->id, $self->edge_source->id);
  my ($edge_id) = $sth->fetchrow_array();
  $sth->finish;
  
  if($edge_id) {
    $self->primary_id($edge_id);
    $self->database($self->edge_source->database);
    return $self;
  } else {
    return undef;
  }
}

*/
