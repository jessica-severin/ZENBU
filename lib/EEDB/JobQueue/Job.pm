# $Id: Job.pm,v 1.4 2012/09/13 05:50:42 severin Exp $
=head1 NAME - EEDB::JobQueue::Job

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


$VERSION = 2.107;

package EEDB::JobQueue::Job;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use MQdb::MappedQuery;
use EEDB::User;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "EEDB::JobQueue::Job"; }



#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  $self->{'_status'} = "READY";

  #EEDB::User*         _user;
  #EEDB::MetadataSet   _metadataset;
  #bool                _metadata_loaded;
  #string              _status;
  #time_t              _created;
  #time_t              _completed;
  
  return $self;
}


##########################
#
# getter/setter methods of data which is stored in database
#
##########################

sub user {
  my $self = shift;
  return $self->{'_user'} = shift if(@_);
  return $self->{'_user'};
}

sub status {
  my $self = shift;
  return $self->{'_status'} = shift if(@_);
  return $self->{'_status'};
}

sub metadataset {
  my $self = shift;
  
  if(!defined($self->{'metadataset'})) {
    $self->{'metadataset'} = new EEDB::MetadataSet;

    if($self->database) {
      my $mdata = EEDB::Metadata->fetch_all_by_job_id($self->database, $self->id);
      $self->{'metadataset'}->add_metadata(@$mdata);
      $self->database->disconnect;
    }
    $self->{'metadataset'}->remove_duplicates;
  }
  return $self->{'metadataset'};
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


#################################################
#
# DBObject override methods
#
#################################################

sub store {
  my $self = shift;

  if($self->user == undef) { return undef; }
  my $db = $self->user->database();
  if(!$db) { return undef; }
  
  if($db) { $self->database($db); }
  my $dbh = $self->database->get_connection;  
  my $sql = "INSERT INTO job(user_id, status, analysis_id) VALUES(?,?, 1)";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->user->primary_id, $self->status());
  my $dbID = $dbh->last_insert_id(undef, undef, qw(feature feature_id));
  $sth->finish;
  return undef unless($dbID);
  $self->primary_id($dbID);
  
  #now do the metadata  
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
    if(!defined($mdata->primary_id)) { $mdata->store($self->database); }
    $mdata->store_link_to_job($self);
  }
}

sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbh = shift;

  $self->primary_id($rowHash->{'job_id'});
  $self->status($rowHash->{'status'});
   
  return $self;
}


##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_by_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  unless($db) { return undef; }
  my $sql = "SELECT * FROM job WHERE job_id=?";
  return $class->fetch_single($db, $sql, $id);
}

sub fetch_all_by_user_id {
  my $class = shift;
  my $db = shift;
  my $user_id = shift;

  my $sql = "SELECT * FROM job WHERE user_id=?";
  return $class->fetch_multiple($db, $sql, $user_id);
}


1;

