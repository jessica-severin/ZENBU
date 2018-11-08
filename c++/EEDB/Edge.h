/* $Id: Edge.h,v 1.7 2013/04/08 05:47:52 severin Exp $ */

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

#ifndef _EEDB_EDGE_H
#define _EEDB_EDGE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/EdgeSource.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Feature;

class Edge : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  protected:
    EEDB::MetadataSet     _metadataset;
    EEDB::EdgeSource*     _edge_source;
    EEDB::Feature*        _feature1;
    EEDB::Feature*        _feature2;
    
    long int              _edge_source_id;
    long int              _feature1_id;
    long int              _feature2_id;
    double                _weight;
    string                _sub_type;
    char                  _direction;
    bool                  _metadata_loaded;

  public:
    Edge();                 // constructor
   ~Edge();                 // destructor
    void init();            // initialization method

    //get atributes
    EEDB::EdgeSource*     edge_source();
    EEDB::MetadataSet*    metadataset();

    EEDB::Feature*        feature1();
    EEDB::Feature*        feature2();

    string                sub_type() { return _sub_type; }
    double                weight() { return _weight; }
    long int              feature1_id();
    long int              feature2_id();


    //set atributes
    void                  edge_source(EEDB::EdgeSource* obj);
    void                  feature1(EEDB::Feature* obj);
    void                  feature2(EEDB::Feature* obj);
    void                  sub_type(string value) { _sub_type = value; }
    void                  weight(double value)   { _weight = value; }

    //display and export
    void display_info();
    string display_desc();
    string display_contents();

    bool check_exists_db(Database *db);
    bool store(MQDB::Database *db);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Edge* obj = new EEDB::Edge;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //

    static Edge*
    fetch_by_id(MQDB::Database *db, long int edge_id) {
      const char *sql = "SELECT * FROM edge WHERE edge_id=?";
      return (EEDB::Edge*) MQDB::fetch_single(EEDB::Edge::create, db, sql, "d", edge_id);
    }

    static vector<DBObject*>
    fetch_all_with_feature_id(MQDB::Database *db, long int feature_id) {
      const char *sql = "SELECT edge.* FROM edge JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature1_id=? \
                         UNION \
                         SELECT edge.* FROM edge JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature2_id=? ";
      return MQDB::fetch_multiple(EEDB::Edge::create, db, sql, "dd", feature_id, feature_id);
    }


    static vector<DBObject*>
    fetch_all_with_feature_id(MQDB::Database *db, long int feature_id, long int source_id) {
      const char *sql = "SELECT * FROM edge WHERE edge_source_id=? AND feature1_id=? \
                         UNION \
                         SELECT * FROM edge WHERE edge_source_id=? AND feature2_id=? ";
      return MQDB::fetch_multiple(EEDB::Edge::create, db, sql, "dddd", source_id, feature_id, source_id, feature_id);
    }

    /*
    static long int 
    get_count_symbol_search(MQDB::Database *db, string value, string type) {
      const char *sql = "SELECT count(distinct symbol_id) from symbol WHERE sym_type=? AND sym_value like ?";
      value += "%";
      dynadata dd = db->fetch_col_value(sql, "ss", type.c_str(), value.c_str());
      return dd.i_int;
    }
    */

  
/*
##### public class methods for fetching by utilizing DBObject framework methods #####


sub fetch_all_by_source {
  my $class = shift;
  my $db = shift;
  my $link_source = shift; #EdgeSource object

  my $sql = "SELECT * FROM edge WHERE edge_source_id=?";
  return $class->fetch_multiple($db, $sql, $link_source->id);
}

sub stream_all_by_source {
  my $class = shift;
  my $source = shift; #EdgeSource object with database connection
  my $sort = shift; #optional flag for sorting
  
  return undef unless($source and $source->database);

  my $sql = "SELECT * FROM edge WHERE edge_source_id=? ";
  if(defined($sort) and ($sort eq 'f1')) { $sql .= "ORDER by feature1_id "; }
  if(defined($sort) and ($sort eq 'f2')) { $sql .= "ORDER by feature2_id "; }
  return $class->stream_multiple($source->database, $sql, $source->id);
}
*/

/*
sub fetch_all_from_feature_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;
  my $edge_source_ids = shift; #optional
  
  my $sql = sprintf("SELECT * FROM edge fl JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature1_id='%s' ", $id);
  if(defined($edge_source_ids)) {
    $sql .= sprintf("AND fl.edge_source_id in(%s)", $edge_source_ids);
  }  
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_to_feature_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;
  my $edge_source_ids = shift; #optional

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature2_id='%s' ", $id);
  if(defined($edge_source_ids)) {
    $sql .= sprintf("AND fl.edge_source_id in(%s)", $edge_source_ids);
  }  
  return $class->fetch_multiple($db, $sql);
}
*/

/*
sub fetch_all_with_feature {
  my $class = shift;
  my $feature = shift;
  my %options = @_; #like category=>"subfeature", sources=>[$esrc1, $esrc2,$esrc3]
  
  unless(defined($feature) && $feature->isa('EEDB::Feature')) {
    #die('fetch_all_with_feature param1 must be a EEDB::Feature');
    return [];
  }
  my $list1 = $class->fetch_all_with_feature1($feature, %options);
  my $list2 = $class->fetch_all_with_feature2($feature, %options);
  my @rtnlist = (@$list1, @$list2);
  return \@rtnlist;
}

sub fetch_all_with_feature1 {
  my $class = shift;
  my $feature1 = shift;
  my %options = @_; #like category=>"subfeature", sources=>[$esrc1, $esrc2,$esrc3]
  
  unless(defined($feature1) && $feature1->isa('EEDB::Feature')) {
    #die('fetch_all_with_feature1 param1 must be a EEDB::Feature');
    return [];
  }
  unless($feature1->database) { return []; }
  
  my $sql = "SELECT * FROM edge fl JOIN edge_source using(edge_source_id) WHERE feature1_id=? ";
  if(%options) {
    if($options{'category'}) {
      $sql .= sprintf(" AND category='%s'", $options{'category'});
    }
    if($options{'sources'}) {
      my @lsrc_ids;
      foreach my $lsrc (@{$options{'sources'}}) { push @lsrc_ids, $lsrc->id; }
      $sql .= sprintf(" AND fl.edge_source_id in(%s)", join(',', @lsrc_ids));
    }
  }  
  return $class->fetch_multiple($feature1->database, $sql, $feature1->id);
}

sub fetch_all_with_feature2 {
  my $class = shift;
  my $feature2 = shift;
  my %options = @_; #like category=>"subfeature", sources=>[$esrc1, $esrc2,$esrc3]
  
  unless(defined($feature2) && $feature2->isa('EEDB::Feature')) {
    #die('fetch_all_with_feature2 param1 must be a EEDB::Feature');
    return [];
  }
  unless($feature2->database) { return []; }

  my $sql = "SELECT * FROM edge fl JOIN edge_source using(edge_source_id) WHERE feature2_id= ?";
  if(%options) {
    if($options{'category'}) {
      $sql .= sprintf(" AND category='%s'", $options{'category'});
    }
    if($options{'sources'}) {
      my @lsrc_ids;
      foreach my $lsrc (@{$options{'sources'}}) { push @lsrc_ids, $lsrc->id; }
      $sql .= sprintf(" AND fl.edge_source_id in(%s)", join(',', @lsrc_ids));
    }
  }  
  return $class->fetch_multiple($feature2->database, $sql, $feature2->id);
}

sub fetch_all_visible_with_feature_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;
  my $edge_source_ids = shift; #optional

  if($__riken_EEDB_edge_global_should_cache != 0) {
    my $edge_hash = $__riken_EEDB_edge_global_featureid_cache->{$db . $id};
    if(defined($edge_hash)) { 
      my @edges = values(%$edge_hash);
      return \@edges; 
    }
  }

  my $sql = sprintf("SELECT %s center_id, fl.* FROM edge fl JOIN edge_source using(edge_source_id) WHERE is_visible ='y' AND(feature1_id='%s' OR feature2_id='%s') ", $id, $id, $id);
  if(defined($edge_source_ids)) {
    $sql .= sprintf("AND fl.edge_source_id in (%s)", $edge_source_ids);
  }
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_active_with_feature_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
                    "WHERE is_active ='y' AND(feature1_id='%s' OR feature2_id='%s') ", $id, $id);
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_visible_with_feature_id_list {
  my $class = shift;
  my $db = shift;
  my $id_list = shift;

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
                    "WHERE is_visible ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_active_with_feature_id_list {
  my $class = shift;
  my $db = shift;
  my $id_list = shift;

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
                    "WHERE is_active ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_visible_between_feature_id_list {
  my $class = shift;
  my $db = shift;
  my $id_list = shift;

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
                    "WHERE is_visible ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_active_between_feature_id_list {
  my $class = shift;
  my $db = shift;
  my $id_list = shift;

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
                    "WHERE is_active ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_active_expand_from_feature_id_list {
  my $class = shift;
  my $db = shift;
  my $id_list = shift;

  my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
                    "WHERE is_active ='y' AND feature1_id in(%s) OR feature2_id in(%s)", $id_list, $id_list);
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_visible {
  my $class = shift;
  my $db = shift;

  my $sql = sprintf("SELECT * FROM edge JOIN edge_source using(edge_source_id) WHERE is_visible ='y' ");
  return $class->fetch_multiple($db, $sql);
}

sub stream_all_visible {
  my $class = shift;
  my $db = shift;

  my $sql = sprintf("SELECT * FROM edge JOIN edge_source using(edge_source_id) WHERE is_visible ='y' ");
  return $class->stream_multiple($db, $sql);
}

sub fetch_all_like_link {
  my $class = shift;
  my $db = shift;
  my $link = shift; #Edge object
  
  #'like' means same feature1, feature2, and source

  my $sql = "SELECT * FROM edge ".
             "WHERE feature1_id=? and feature2_id=? and edge_source_id=?";
  return $class->fetch_multiple($db, $sql, $link->feature1_id, $link->feature2_id, $link->edge_source->id);
}


sub fetch_all_with_metadata {
  my $class = shift;
  my $source = shift; #EdgeSource object uses database of source for fetching
  my @mdata_array = @_; #Metadata object(s)
  
  if(defined($source) && !($source->isa('EEDB::EdgeSource'))) {
    die('second parameter [source] must be a EEDB::EdgeSource');
  }
  
  if(!defined($source->database) or !defined($source->primary_id)) { return []; }
  
  my @mdata_ids;
  foreach my $mdata (@mdata_array) {
    unless(defined($mdata) && ($mdata->class eq 'Metadata')) {
      die("$mdata is not a EEDB::Metadata");
    }
    if(defined($mdata->primary_id)) {push @mdata_ids, $mdata->id; }
  }
  if(scalar(@mdata_ids) == 0) { return []; } #if mdata objects not stored then return []
    
  my $sql = sprintf("SELECT e.* FROM edge e JOIN edge_2_metadata using(edge_id) WHERE metadata_id in(%s) ",
                   join(',', @mdata_ids));
  $sql .= sprintf(" AND edge_source_id=%d", $source->id);
  $sql .= sprintf(" GROUP BY e.edge_id");

  #print($sql, "\n", );
  return $class->fetch_multiple($source->database, $sql);
}

sub fetch_all_with_symbol {
  my $class = shift;
  my $db = shift;
  my $source = shift; #EdgeSource object
  my $symbol = shift; #Symbol object
  my $response_limit = shift; #optional
  
  unless(defined($source) && $source->isa('EEDB::EdgeSource')) {
    die('second parameter [source] must be a EEDB::EdgeSource');
  }
  unless(defined($symbol) && ($symbol->class eq 'Symbol')) {
    die('third parameter [symbol] must be a EEDB::Symbol');
  }

  my $sql = sprintf("SELECT e.* FROM edge f ".
                    "JOIN edge_2_symbol using(edge_id)  ".
                    "WHERE symbol_id = %d ", 
                    $symbol->id);
  if(defined($source)) {
    $sql .= sprintf("AND edge_source_id=%d", $source->id);
  }
  $sql .= sprintf(" GROUP BY e.edge_id"); #to make sure the edge is not sent more than once
  if($response_limit) {
    $sql .= sprintf(" LIMIT %d", $response_limit);
  }

  #print($sql, "\n", );
  return $class->fetch_multiple($db, $sql);
}


###############################################################################################
#
# streaming API section
#
###############################################################################################


sub stream_all_with_feature { #used by EEDB::Tools::EdgeCompare (experimental approach)
  my $class = shift;
  my $db = shift;
  my $feature = shift;
  my %options = @_; #optional
  
  my $id = $feature->id;
  my $sql = "SELECT * FROM edge e ";
  if(%options and $options{'visible'} eq 'y') { 
    $sql .= " JOIN edge_source es on(e.edge_source_id = es.edge_source_id and es.is_visible='y') ";
  }

  $sql .= sprintf("WHERE (feature1_id='%s' OR feature2_id='%s') ", $id, $id);
    
  if(%options and $options{'sources'}) {
    my @lsrc_ids;
    foreach my $lsrc (@{$options{'sources'}}) { push @lsrc_ids, $lsrc->id; }
    $sql .= sprintf("AND e.edge_source_id in(%s) ", join(',', @lsrc_ids));
  }  
  
  $sql .= "ORDER by weight desc";
  if(%options and $options{'end'} eq 'f1') { $sql .= ",feature1_id, feature2_id "; }
  if(%options and $options{'end'} eq 'f2') { $sql .= ",feature2_id, feature1_id "; }

  #printf("<sql>%s</sql>\n", $sql);
  return $class->stream_multiple($db, $sql);
}
*/

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);

};

};   //namespace

#endif
