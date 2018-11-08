# $Id: FeatureSource.pm,v 1.73 2010/12/01 07:53:27 severin Exp $
=head1 NAME - EEDB::FeatureSource

=head1 SYNOPSIS

=head1 DESCRIPTION

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2009 Jessica Severin RIKEN OSC
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

my $__riken_EEDB_feature_source_global_should_cache = 1;
my $__riken_EEDB_feature_source_global_id_cache = {};
my $__riken_EEDB_feature_source_global_name_cache = {};

$VERSION = 0.953;

package EEDB::FeatureSource;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "FeatureSource"; }

sub set_cache_behaviour {
  my $class = shift;
  my $mode = shift;
  
  $__riken_EEDB_feature_source_global_should_cache = $mode;
  
  if(defined($mode) and ($mode eq '0')) {
    #if turning off caching, then flush the caches
    $__riken_EEDB_feature_source_global_id_cache = {};
    $__riken_EEDB_feature_source_global_name_cache = {};
  }
}

sub create_from_name {
  #if $db parameter is supplied then it will check the database first
  #otherwise it will create one and store it (if $db is provided)
  my $class     = shift;
  my $fsrc_name = shift;
  my $db        = shift; #optional
  
  if(!$fsrc_name) { return undef; }
  
  my $fsrc = undef;
  my $category = undef;
  if($fsrc_name =~ /(\w+)\:\:(.+)/) {
    $category = $1;
    $fsrc_name = $2;
    $fsrc = EEDB::FeatureSource->fetch_by_category_name($db, $1, $2) if($db);
  } else {
    $fsrc = EEDB::FeatureSource->fetch_by_name($db, $fsrc_name) if($db);
  }
  unless($fsrc){
    $fsrc = new EEDB::FeatureSource;
    $fsrc->name($fsrc_name);
    $fsrc->category($category);
    $fsrc->import_source("");
    $fsrc->is_active('y');
    $fsrc->is_visible('y');
    $fsrc->primary_id(-1); #for debugging
    $fsrc->store($db) if($db);
  }
  return $fsrc;
}


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  return $self;
}

sub global_uncache {
  my $self = shift;
  delete $__riken_EEDB_feature_source_global_id_cache->{$self->db_id};
  delete $__riken_EEDB_feature_source_global_name_cache->{$self->database() . $self->category . $self->name};
  delete $__riken_EEDB_feature_source_global_name_cache->{$self->database() . $self->name};
  return undef;
}

sub name {
  my $self = shift;
  return $self->{'name'} = shift if(@_);
  $self->{'name'}='' unless(defined($self->{'name'}));
  return $self->{'name'};
}

sub category {
  #like 'class', basically a high level controlled vocabulary of types
  #but not implemented as any constraint in the database.  Up to the data
  #user to control the vocabular prior to data import.  Not the DB's job to
  #babysit the vocabular checks
  my $self = shift;
  return $self->{'category'} = shift if(@_);
  $self->{'category'}='' unless(defined($self->{'category'}));
  return $self->{'category'};
}

sub import_source {
  my $self = shift;
  return $self->{'import_source'} = shift if(@_);
  $self->{'import_source'}='' unless(defined($self->{'import_source'}));
  return $self->{'import_source'};
}

sub import_date {
  my $self = shift;
  return $self->{'import_date'} = shift if(@_);
  $self->{'import_date'}='' unless(defined($self->{'import_date'}));
  return $self->{'import_date'};
}

sub comments {
  my $self = shift;
  return $self->{'comments'} = shift if(@_);
  $self->{'comments'}='' unless(defined($self->{'comments'}));
  return $self->{'comments'};
}

sub owner_openid {
  my $self = shift;
  return $self->{'_owner_openid'} = shift if(@_);
  $self->{'_owner_openid'}='' unless(defined($self->{'_owner_openid'}));
  return $self->{'_owner_openid'};
}

sub is_active {
  my $self = shift;
  return $self->{'is_active'} = shift if(@_);
  $self->{'is_active'}='' unless(defined($self->{'is_active'}));
  return $self->{'is_active'};
}

sub is_visible {
  my $self = shift;
  return $self->{'is_visible'} = shift if(@_);
  $self->{'is_visible'}='' unless(defined($self->{'is_visible'}));
  return $self->{'is_visible'};
}

sub feature_count {
  my $self = shift;
  return $self->{'_feature_count'} = shift if(@_);
  unless(defined($self->{'_feature_count'})) {
    $self->get_feature_count();
  }
  return $self->{'_feature_count'};
}

sub metadataset {
  my $self = shift;
  
  if(!defined($self->{'metadataset'})) {
    $self->{'metadataset'} = new EEDB::MetadataSet;

    if($self->database) {
      my $symbols = EEDB::Symbol->fetch_all_by_feature_source_id($self->database, $self->id);
      $self->{'metadataset'}->add_metadata(@$symbols);

      my $mdata = EEDB::Metadata->fetch_all_by_feature_source_id($self->database, $self->id);
      $self->{'metadataset'}->add_metadata(@$mdata);
      $self->database->disconnect;
    }
  }
  return $self->{'metadataset'};
}

sub expression_datatypes {
  my $self = shift;
  
  my $datatypes = [];
  my $mdata = $self->metadataset->find_all_metadata_like("eedb:expression_datatype");
  foreach my $data (@$mdata) { 
    my $dtype = EEDB::ExpressionDatatype->new($data->data);
    push @$datatypes, $dtype;
  }
  return $datatypes;
}


################

sub get_feature_count {
  my $self = shift;
  
  if(!defined($self->database)) { return 0; }
  my $sql = "SELECT count(*) FROM feature WHERE feature_source_id=?";
  $self->{'_feature_count'} = $self->fetch_col_value($self->database, $sql, $self->id);
  return $self->{'_feature_count'};
}

################

sub feature_id_list {
  #returns a simple array of feature_id for all features in this source
  #useful for remote streaming. does as direct query, no cache
  my $self = shift;
  my $sql = "SELECT feature_id FROM feature where feature_source_id=?";
  return $self->fetch_multiple($self->database, $sql, $self->id);
}


################

sub display_desc {
  my $self = shift;
  my $str = sprintf("FeatureSource(%s) %s : %s : %s",
           $self->db_id, 
           $self->name,
           $self->category,
           $self->import_source
           );  
  return $str;
}

sub display_contents {
  my $self = shift;

  my $str = $self->display_desc;
  $str .= "\n". $self->metadataset->display_contents;   
  return $str;
}

sub xml {
  my $self = shift;
  my $str = $self->xml_start;
  if($self->owner_openid) {
    $str .= sprintf("<owner_openid>%s</owner_openid>\n", $self->owner_openid);
  }
  my $count = $self->feature_count;
  if($count) { $str .= sprintf("<feature_count value=\"%d\" />\n",  $count); }
  $str .= "\n". $self->metadataset->xml;
  $str .= $self->xml_end;
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = sprintf("<featuresource id=\"%s\" category=\"%s\" name=\"%s\" source=\"%s\" comments=\"%s\" ",
           $self->db_id, 
           $self->category,
           $self->name,
           $self->import_source,
           $self->comments
           );
  $str .= sprintf("import_date=\"%s\" ", $self->import_date) if(defined($self->import_date));
  if($self->owner_openid) { $str .= sprintf("owner_openid=\"%s\" ", $self->owner_openid); }
  $str .= ">";

  return $str;
}

sub xml_end {
  my $self = shift;
  return "</featuresource>\n";
}


sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
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
  $self->import_date($xmlTree->{'-import_date'}) if($xmlTree->{'-import_date'});
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


sub get_from_cache_by_id {
  my $class = shift;
  my $dbid = shift;

  if($__riken_EEDB_feature_source_global_should_cache == 0) { return undef; }
  return $__riken_EEDB_feature_source_global_id_cache->{$dbid};
}

#################################################
#
# DBObject override methods
#
#################################################

sub check_exists_db {
  my $self = shift;
  my $db   = shift;
  
  unless($db) { return undef; }
  if(defined($self->primary_id) and ($self->primary_id>0)) { return $self; }
  
  #check if it is already in the database
  my $dbID = $db->fetch_col_value("SELECT feature_source_id FROM feature_source where name=?", $self->name);
  if($dbID) {
    $self->primary_id($dbID);
    $self->database($db);
    return $self;
  } else {
    return undef;
  }
}

sub store {
  my $self = shift;
  my $db   = shift;
  
  if($db) { $self->database($db); }
  
  $db->execute_sql("INSERT ignore INTO feature_source ".
                   "(name, category, is_active, is_visible, owner_openid, import_source, import_date) ".
                   "VALUES(?,?,?,?,?,?,?)",
                    $self->name,
                    $self->category,
                    $self->is_active,
                    $self->is_visible,
                    $self->owner_openid,
                    $self->import_source,
                    $self->import_date);

  $self->check_exists_db($db);  #checks the database and sets the primary_id

  #now do the symbols and metadata  
  $self->store_metadata;
                    
  return $self; 
}

sub store_metadata {
  my $self = shift;
  unless($self->database) {
    printf(STDERR "ERROR: no database to store metadata\n");
    return;
  }

  return unless($self->{'metadataset'}); #if not created then don't lazy load
  
  my $mdata_list = $self->metadataset->metadata_list;
  foreach my $mdata (@$mdata_list) {
    if(!defined($mdata->primary_id)) {
      $mdata->store($self->database);
    }
    $mdata->store_link_to_feature_source($self);
  }
}

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


sub sync_importdate_to_features {
  my $self = shift;
  
  my $sql = "SELECT max(last_update) FROM feature where feature_source_id=?";
  my $lastdate =  $self->fetch_col_value($self->database, $sql, $self->id);

  $sql = "UPDATE feature_source SET import_date=? WHERE feature_source_id=?";
  $self->database->execute_sql($sql, $lastdate, $self->id);
}

sub update_feature_count {
  my $self = shift;
  my $sql = "UPDATE feature_source SET feature_count = ? WHERE feature_source_id=?";
  $self->database->execute_sql($sql, $self->feature_count, $self->id);
}


##### DBObject instance override methods #####

sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbh = shift;

  if(($__riken_EEDB_feature_source_global_should_cache != 0) and ($self->database())) {
    my $dbID = $self->database->uuid ."::". $rowHash->{'feature_source_id'} .":::FeatureSource";
    my $cached_self = $__riken_EEDB_feature_source_global_id_cache->{$dbID};
    if(defined($cached_self)) { return $cached_self; }
  }

  $self->primary_id($rowHash->{'feature_source_id'});
  $self->name($rowHash->{'name'});
  $self->category($rowHash->{'category'});
  $self->import_source($rowHash->{'import_source'});
  $self->import_date($rowHash->{'import_date'});
  $self->comments($rowHash->{'comments'});  
  $self->is_active($rowHash->{'is_active'});  
  $self->is_visible($rowHash->{'is_visible'});  
  $self->owner_openid($rowHash->{'owner_openid'});
  $self->feature_count($rowHash->{'feature_count'});  
  $self->owner_openid($rowHash->{'owner_openid'}) if(defined($rowHash->{'owner_openid'})); 

  if($__riken_EEDB_feature_source_global_should_cache != 0) {
    $__riken_EEDB_feature_source_global_id_cache->{$self->db_id} = $self;
    $__riken_EEDB_feature_source_global_name_cache->{$self->database() . $self->category . $self->name} = $self;
    $__riken_EEDB_feature_source_global_name_cache->{$self->database() . $self->name} = $self;
  }
  return $self;
}


##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_all {
  my $class = shift;
  my $db = shift;
  my $sql = "SELECT * FROM feature_source";
  return $class->fetch_multiple($db, $sql);
}

sub fetch_by_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  unless($db) { return undef; }
  if($__riken_EEDB_feature_source_global_should_cache != 0) {
    my $dbID = $db->uuid ."::". $id .":::FeatureSource";
    my $cached_self = $__riken_EEDB_feature_source_global_id_cache->{$dbID};
    if(defined($cached_self)) { return $cached_self; }
  }

  my $sql = "SELECT * FROM feature_source WHERE feature_source_id=?";
  return $class->fetch_single($db, $sql, $id);
}

sub fetch_all_by_chrom_chunk_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;
  
  #turn on the ChromChunk caching or this will explode
  #EEDB::ChromChunk->set_cache_behaviour(1);

  my $sql = "SELECT * FROM feature_source ".
            "WHERE chrom_chunk_id = ? ORDER BY chrom_start";
  return $class->fetch_multiple($db, $sql, $id);
}

sub fetch_by_name {
  my $class = shift;
  my $db = shift;
  my $name = shift;
  
  if($__riken_EEDB_feature_source_global_should_cache != 0) {
    my $obj = $__riken_EEDB_feature_source_global_name_cache->{$db . $name};
    if(defined($obj)) { return $obj; }
  }

  my $sql = "SELECT * FROM feature_source WHERE name=? ";
  return $class->fetch_single($db, $sql, $name);
}

sub fetch_by_category_name {
  my $class = shift;
  my $db = shift;
  my $category = shift;
  my $name = shift;
  
  if($__riken_EEDB_feature_source_global_should_cache != 0) {
    my $obj = $__riken_EEDB_feature_source_global_name_cache->{$db . $category . $name};
    if(defined($obj)) { return $obj; }
  }

  my $sql = "SELECT * FROM feature_source ".
            "WHERE name=? and category=?";
  return $class->fetch_single($db, $sql, $name, $category);
}


1;

