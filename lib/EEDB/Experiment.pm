# $Id: Experiment.pm,v 1.67 2010/11/04 09:23:26 severin Exp $
=head1 NAME - EEDB::Experiment

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

my $__riken_EEDB_experiment_global_should_cache = 1;
my $__riken_EEDB_experiment_global_id_cache = {};
my $__riken_EEDB_experiment_global_name_cache = {};

$VERSION = 0.953;

package EEDB::Experiment;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "Experiment"; }

sub set_cache_behaviour {
  my $class = shift;
  my $mode = shift;

  $__riken_EEDB_experiment_global_should_cache = $mode;

  if(defined($mode) and ($mode eq '0')) {
    #if turning off caching, then flush the caches
    $__riken_EEDB_experiment_global_id_cache = {};
    $__riken_EEDB_experiment_global_name_cache = {};
  }
}



#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  $self->{'series_name'} = undef;
  $self->{'exp_accession'} = undef;
  $self->{'series_point'} = undef;
  
  return $self;
}

sub global_uncache {
  my $self = shift;
  delete $__riken_EEDB_experiment_global_id_cache->{$self->db_id};
  delete $__riken_EEDB_experiment_global_name_cache->{$self->database() . $self->exp_accession};
  return undef;
}

##########################
#
# getter/setter methods of data which is stored in database
#
##########################

sub exp_accession {
  my $self = shift;
  return $self->{'exp_accession'} = shift if(@_);
  return $self->{'exp_accession'};
}

sub display_name {
  my $self = shift;
  if(@_) {
    return $self->{'display_name'} = shift;
  }
  my $disp = "";
  my $mdata = $self->metadataset->find_all_metadata_like("eedb:display_name");
  if(@$mdata) { 
    $disp = $mdata->[0]->data; 
  } else {
    if(!defined($self->{'display_name'}) and defined($self->{'exp_accession'})) {
      $disp = $self->{'exp_accession'};
    } else {
      $disp = $self->{'display_name'};
    }
  }
  return $disp;
}

sub platform {
  my $self = shift;
  return $self->{'platform'} = shift if(@_);
  $self->{'platform'}='' unless(defined($self->{'platform'}));
  return $self->{'platform'};
}

sub series_name {
  my $self = shift;
  return $self->{'series_name'} = shift if(@_);
  $self->{'series_name'}='' unless(defined($self->{'series_name'}));
  return $self->{'series_name'};
}

sub series_point {
  my $self = shift;
  return $self->{'series_point'} = shift if(@_);
  $self->{'series_point'}=0 unless(defined($self->{'series_point'}));
  return $self->{'series_point'};
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

sub metadataset {
  my $self = shift;
  
  if(!defined($self->{'metadataset'})) {
    $self->{'metadataset'} = new EEDB::MetadataSet;

    if($self->database) {
      my $symbols = EEDB::Symbol->fetch_all_by_experiment_id($self->database, $self->id);
      $self->{'metadataset'}->add_metadata(@$symbols);

      my $mdata = EEDB::Metadata->fetch_all_by_experiment_id($self->database, $self->id);
      $self->{'metadataset'}->add_metadata(@$mdata);
      $self->database->disconnect;
    }
    #if($self->platform) { $self->{'metadataset'}->add_tag_symbol("eedb:platform", $self->platform); }
    #if($self->series_name) { $self->{'metadataset'}->add_tag_symbol("eedb:series_name", $self->series_name); }
    #if($self->display_name) { $self->{'metadataset'}->add_tag_data("eedb:display_name", $self->display_name); }
    $self->{'metadataset'}->remove_duplicates;
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

####################################

sub display_desc
{
  my $self = shift;
  #my $str = sprintf("Experiment(%s) [%s] %s : (%s, %s) : %s", $self->db_id, $self->platform, $self->display_name, $self->series_name, $self->series_point, $self->exp_accession);

  my $str = sprintf("Experiment(%s)", $self->db_id);
  $str .= sprintf(" [%s]", $self->platform);
  $str .= sprintf(" %s :", $self->display_name);
  $str .= sprintf(" (%s, %s)", $self->series_name, $self->series_point);
  if($self->exp_accession) { $str .= sprintf(" : %s", $self->exp_accession); }
  return $str;
}

sub display_contents {
  my $self = shift;
  my $str = $self->display_desc;
  $str .= "\n". $self->metadataset->display_contents;   
  return $str;
}

####################################

sub xml_start {
  my $self = shift;
  my $str = sprintf("<experiment id=\"%s\" platform=\"%s\" name=\"%s\" exp_acc=\"%s\" ",
           $self->db_id,
           $self->platform,
           $self->display_name,
           $self->exp_accession);
  $str .= sprintf("series_name=\"%s\" ", $self->series_name) if($self->series_name);
  $str .= sprintf("series_point=\"%s\" ", $self->series_point) if(defined($self->series_point));
  if($self->owner_openid) { $str .= sprintf("owner_openid=\"%s\" ", $self->owner_openid); }
  $str .= ">";
  return $str;
}

sub xml_end {
  my $self = shift;
  return "</experiment>\n"; 
}

sub xml {
  my $self = shift;
  
  my $str = $self->xml_start;
  if($self->owner_openid) {
    $str .= sprintf("<owner_openid>%s</owner_openid>\n", $self->owner_openid);
  }

  $str .= "\n". $self->metadataset->xml;
  
  my $dtypes = $self->expression_datatypes;
  foreach my $type (sort {($a->datatype cmp $b->datatype)} @$dtypes) {
    $str .= "  " . $type->xml;
  }
           
  $str .= $self->xml_end;
  return $str;
}


sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
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

sub get_from_cache_by_id {
  my $class = shift;
  my $dbid = shift;

  if($__riken_EEDB_experiment_global_should_cache == 0) { return undef; }
  return $__riken_EEDB_experiment_global_id_cache->{$dbid};
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
  my $dbID = $db->fetch_col_value("select experiment_id from experiment where exp_accession=?", $self->exp_accession);
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
  my $sql = "INSERT ignore INTO experiment ".
             "(exp_accession, display_name, platform, series_name, series_point, is_active, owner_openid) ".
             "VALUES(?,?,?,?,?,?,?)";
  $self->database->execute_sql($sql,
                $self->exp_accession,
                $self->display_name,
                $self->platform,
                $self->series_name,
                $self->series_point,
                $self->is_active,
                $self->owner_openid
                );

  $self->check_exists_db($db);
  
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

  my $mdata_list = $self->metadataset->metadata_list;
  foreach my $mdata (@$mdata_list) {
    if(!defined($mdata->primary_id)) { 
      $mdata->store($self->database);
      #$mdata->store_link_to_experiment($self);
    }
    $mdata->store_link_to_experiment($self);
  }
}

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



##### DBObject instance override methods #####

sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbh = shift;

  if(($__riken_EEDB_experiment_global_should_cache != 0) and ($self->database())) {
    my $dbID = $self->database->uuid ."::". $rowHash->{'experiment_id'} .":::Experiment";
    my $cached_self = $__riken_EEDB_experiment_global_id_cache->{$dbID};
    if(defined($cached_self)) { return $cached_self; }
  }

  $self->primary_id($rowHash->{'experiment_id'});
  $self->series_name($rowHash->{'series_name'});
  $self->exp_accession($rowHash->{'exp_accession'});
  $self->display_name($rowHash->{'display_name'});
  $self->platform($rowHash->{'platform'});
  $self->series_point($rowHash->{'series_point'});
  $self->is_active($rowHash->{'is_active'});
  $self->owner_openid($rowHash->{'owner_openid'}) if(defined($rowHash->{'owner_openid'}));
   
  if($__riken_EEDB_experiment_global_should_cache != 0) {
    $__riken_EEDB_experiment_global_id_cache->{$self->db_id} = $self;
    $__riken_EEDB_experiment_global_name_cache->{$self->database() . $self->exp_accession} = $self;
  }

  return $self;
}


##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_by_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  unless($db) { return undef; }
  if($__riken_EEDB_experiment_global_should_cache != 0) {
    my $dbID = $db->uuid ."::". $id .":::Experiment";
    my $cached_self = $__riken_EEDB_experiment_global_id_cache->{$dbID};
    if(defined($cached_self)) { return $cached_self; }
  }

  my $sql = "SELECT * FROM experiment WHERE experiment_id=?";
  return $class->fetch_single($db, $sql, $id);
}

sub fetch_all {
  my $class = shift;
  my $db = shift;

  my $sql = "SELECT * FROM experiment ORDER BY platform, series_name, series_point, exp_accession";
  return $class->fetch_multiple($db, $sql);
}

sub fetch_all_by_platform {
  my $class = shift;
  my $db = shift;
  my $platform = shift;

  my $sql = "SELECT * FROM experiment WHERE platform=? ORDER BY platform, series_name, series_point, exp_accession";
  return $class->fetch_multiple($db, $sql, $platform);
}

sub fetch_by_exp_accession {
  my $class = shift;
  my $db = shift;
  my $exp_accession = shift;

  if($__riken_EEDB_experiment_global_should_cache != 0) {
    my $feature = $__riken_EEDB_experiment_global_name_cache->{$db . $exp_accession};
    if(defined($feature)) { return $feature; }
  }

  my $sql = "SELECT * FROM experiment WHERE exp_accession=?";
  return $class->fetch_single($db, $sql, $exp_accession);
}


sub fetch_all_by_filter_search {
  my $class = shift;
  my $db = shift;
  my $filter = shift; 
  my $response_limit = shift; #optional
  
  my $filter_sql = "(SELECT distinct t1.experiment_id FROM \n";

  my @clauses = split (/\s+and\s+/, $filter);
  my $and_count=0;
  foreach my $and_clause (@clauses) {
    my $or_sql = "(SELECT distinct experiment_id FROM experiment_2_symbol join symbol using(symbol_id) WHERE "; 
    #sym_value like "RIKEN1%" or sym_value like 'RIKEN3%' or sym_value like 'CAGE%')t1
    #printf("or block :: %s\n", $and_clause);
    my @toks = split (/\s+or\s+/, $and_clause);
    my $or_count=0;
    foreach my $tok (@toks)  {
      $or_count++;
      $tok =~ s/^\s+//g;
      $tok =~ s/\s+$//g;
      $tok =~ s/_/\\_/g;
      $tok =~ s/\"/\\\"/g; 
      $tok =~ s/\'/\\\'/g;  #'
      if($or_count>1) { $or_sql .= " or "; }
      $or_sql .= sprintf(" sym_value like \"%s%%\" ", $tok);
      
    }
    $and_count++;
    $or_sql .= sprintf(") t%d", $and_count);
    if($and_count>1) { $filter_sql .= ",\n"; }
    $filter_sql .= "  ". $or_sql;
  }
  if($and_count > 1) {
    $filter_sql .= "\nWHERE ";
    my $x=1;
    while($x < $and_count) {
      if($x>1) { $filter_sql .= " AND "; }
      $filter_sql .= sprintf(" t%d.experiment_id = t%d.experiment_id ", $x, $x+1);
      $x++;
    }
  }

  $filter_sql .= ")";
    
  my $sql = sprintf("SELECT e.* FROM experiment e join %s filter where e.experiment_id = filter.experiment_id", $filter_sql);
  $sql .= sprintf(" LIMIT %d", $response_limit) if($response_limit);

  #print($sql, "\n", );
  return $class->fetch_multiple($db, $sql);
  #return [];
}


1;

