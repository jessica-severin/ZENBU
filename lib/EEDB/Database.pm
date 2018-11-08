# $Id: Database.pm,v 1.29 2010/11/24 07:43:53 severin Exp $
=head1 NAME - EEDB::Database

=head1 SYNOPSIS

=head1 DESCRIPTION

EdgeExpressDB override and extension of MQdb::Database to support other custom
database engines used by the EdgeExpressDB system

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

$VERSION = 0.953;

package EEDB::Database;

use strict;
use EEDB::SPStream::OSCFileDB;
use Data::UUID;

use MQdb::Database;
our @ISA = qw(MQdb::Database);

#################################################
# Class methods
#################################################

sub class { return "EEDB::Database"; }

=head2 new_from_url

  Description: primary instance creation method
  Parameter  : a string in URL format
  Returntype : instance of MQdb::Database
  Examples   : my $db = MQdb::Database->new_from_url("mysql://<user>:<pass>@<host>:<port>/<database_name>");
               e.g. mysql://<host>:<port>/<database_name>
               e.g. mysql://<user>@<host>:<port>/<database_name>
               e.g. mysql://<host>/<database_name>
               e.g. sqlite:///<database_file> 
  my $class = shift;
  Exceptions : none

=cut

sub new_from_url {
  my $class = shift;
  my $url = shift;
  my %options = @_;

  my $db = $class->SUPER::new_from_url($url, %options);
  if($db->driver eq "oscdb") {
    return EEDB::SPStream::OSCFileDB->new_from_url($url, %options);
  }
  elsif($db->driver eq "http") {
    #return EEDB::SPStream::EEWebXMLStream->new_from_url($url, %options);
    #$db = EEDB::Tools::EEFileDB->new_from_url($url, %options);
  }
  return $db;
}


sub get_connection {
  my $self = shift;
  #if(!defined($self->{'DB_CONNECTION'})) { printf("EEDB::Database get_connection :: %s\n", $self->uuid); }
  return $self->SUPER::get_connection(@_);
}

sub disconnect {
  my $self = shift;
  my $rtnval = $self->SUPER::disconnect(@_);
  #if($rtnval) { printf("EEDB::Database DISCONNECT :: %s\n", $self->uuid); }   
  return $rtnval;
}

=head2 fetch_object_by_id

  Description: fetch single object from database
  Arg (1)    : $id (federatedID <uuid>::id:::<class>)
  Returntype : any EEDB IDed object (Feature, Edge, Expression, Experiment, FeatureSource....)
  Exceptions : none 

=cut

sub fetch_object_by_id {
  my $self = shift;
  my $id = shift;

  my $objClass="Feature"; #default class is Feature so <uuid>::id means a feature
  my $peerUUID="";
  my $objID=$id;
  
  if($id =~ /(.+)::(\d+):::(.+)/) {
    $peerUUID = $1;
    $objID = $2;
    $objClass = $3;
  }
  elsif($id =~ /(.+)::(\d+)/) {
    $peerUUID = $1;
    $id = $2;
  }
  if($peerUUID and $self->uuid and ($peerUUID ne $self->uuid)) { return undef; }
  
  if($objClass eq "Feature") { return EEDB::Experiment->fetch_by_id($self, $objID); }
  if($objClass eq "FeatureSource") { return EEDB::FeatureSource->fetch_by_id($self, $objID); }
  if($objClass eq "Expression") { return EEDB::Expression->fetch_by_id($self, $objID); }
  if($objClass eq "Experiment") { return EEDB::Experiment->fetch_by_id($self, $objID); }
  if($objClass eq "Edge") { return EEDB::Edge->fetch_by_id($self, $objID); }
  if($objClass eq "EdgeSource") { return EEDB::EdgeSource->fetch_by_id($self, $objID); }
  if($objClass eq "Chrom") { return EEDB::Chrom->fetch_by_id($self, $objID); }
  if($objClass eq "Assembly") { return EEDB::Assembly->fetch_by_id($self, $objID); }
  if($objClass eq "ChromChunk") { return EEDB::ChromChunk->fetch_by_id($self, $objID); }

  return undef;
}

=head2 display_desc

  Description: general purpose debugging method that returns a nice
               human readable description of the object instance contents.
               Each subclass should implement and return a nice string.
  Returntype : string scalar 
  Exceptions : none

=cut

sub display_desc {
  my $self = shift;
  return sprintf("EEDB::Database [%s]", $self->full_url);
}

=head2 display_info

  Description: convenience method which prints the display_desc string
               with a carriage return to STDOUT. useful for debugging.
  Returntype : none
  Exceptions : none

=cut

sub display_info {
  my $self = shift;
  printf("%s\n", $self->display_desc);
}

=head2 uuid

  Description: the unique UUID for this database/peer.  
               If database was created by an EEDB::Peer object, this will be set to the peer UUID.
               If the database was created directly, it will create a new UUID.
               Setting with undef will cause it to re-generate a new UUID.
  Arg (1)    : $uuid <string>
  Returntype : string
  Exceptions : none

=cut

sub uuid {
  my $self = shift;
  if(@_) { $self->{'_uuid'} = shift; }
  if(!defined($self->{'_uuid'})) {
    my $ug    = new Data::UUID;
    my $uuid  = $ug->create();
    $self->{'_uuid'} = $ug->to_string($uuid);
  }
  return $self->{'_uuid'};
}

sub uuid64 {
  my $ug    = new Data::UUID;
  my $uuid  = $ug->create_b64();
  chomp($uuid);
  $uuid =~ s/=//g;
  $uuid =~ s/\+/\-/g;
  $uuid =~ s/\//_/g;
  if($uuid =~ /^\-/) { $uuid = "z".$uuid; } #dirs beginning with "-" are problem on cmdline
  return $uuid;
}

1;

