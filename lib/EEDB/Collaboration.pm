# $Id: Collaboration.pm,v 1.30 2010/11/05 07:46:48 severin Exp $
=head1 NAME - EEDB::Collaboration

=head1 SYNOPSIS

=head1 DESCRIPTION

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2010 Jessica Severin RIKEN OSC
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

package EEDB::Collaboration;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use Data::UUID;

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "EEDB::Collaboration"; }

=head2 create_new_collaboration

  Description  : high-level class level routine to create an new Collaboration profile
                 within a system (user database, user directory structure)
                 given a verified OpenID identify from the net.
  Parameter[1] : an EEDB::User instance
  Parameter[2] : $name : display_name of the group
  Parameter[3] : $public_announce : <optional> if "y" or "true" then this collaboration is 
                 visible for any user to request-to-join
  Returntype   : instance of EEDB::Collaboration or undef if problem.

=cut

sub create_new_collaboration {
  my $class = shift;
  my $user = shift;  # an EEDB::User who is creating and responsible for management
  my $display_name = shift;
  my $public_announce = shift;
  
  unless($user and $user->database) { return undef; }

  my $collaboration = new EEDB::Collaboration;
  $collaboration->display_name($display_name);
  $collaboration->public_announce($public_announce);
  $collaboration->owner_openid($user->openID);
  $collaboration->metadataset->add_tag_data('eedb:owner_OpenID', $user->openID);
  
  # internal UUID
  my $ug    = new Data::UUID;
  my $uuid  = $ug->create_b64();
  chomp($uuid);
  $uuid =~ s/=//g;
  $uuid =~ s/\+/\-/g;
  $uuid =~ s/\//_/g;
  if($uuid =~ /^\-/) { $uuid = "z".$uuid; } #dirs beginning with "-" are problem on cmdline
  $collaboration->uuid($uuid);

  $collaboration->store($user->database);

  ## create group registry
  $collaboration->_create_registry("group_registry", $display_name);

  #add the creator of the Collaboration also to its list of members
  my $sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,?)";
  $user->database->execute_sql($sql, $collaboration->id, $user->id, "MEMBER");

  $collaboration->{'_member_status'} = "owner";

  return $collaboration;
}

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  $self->{'_display_name'} = "";
  $self->{'_uuid'} = "";
  $self->{'_member_status'} = "not_member";
  return $self;
}


##########################
#
# getter/setter methods of data which is stored in database
#
##########################

sub display_name {
  my $self = shift;
  return $self->{'_display_name'} = shift if(@_);
  $self->{'_display_name'}='' unless(defined($self->{'_display_name'}));
  return $self->{'_display_name'};
}

sub owner_openid {
  my $self = shift;
  return $self->{'_owner_openid'} = shift if(@_);
  $self->{'_owner_openid'}='' unless(defined($self->{'_owner_openid'}));
  return $self->{'_owner_openid'};
}

sub uuid {
  my $self = shift;
  return $self->{'_uuid'} = shift if(@_);
  $self->{'_uuid'}='' unless(defined($self->{'_uuid'}));
  return $self->{'_uuid'};
}

sub public_announce {
  my $self = shift;
  if(@_) {
    my $value = shift;
    if($value eq "y") { $self->{'_public_announce'}='y'; }
    if($value eq "true") { $self->{'_public_announce'}='y'; }
  }
  $self->{'_public_announce'}='' unless(defined($self->{'_public_announce'}));
  return $self->{'_public_announce'};
}

sub member_status {
  my $self = shift;
  return $self->{'_member_status'};
}

sub description {
  my $self = shift;
  
  my $descMD = $self->metadataset->find_metadata("description", undef);
  if($descMD) { return $descMD->data; }
  else { return ""; }
}

sub member_count {
  my $self = shift;

  if(!defined($self->database)) { return 0; }
  my $sql = "SELECT count(*) FROM collaboration_2_user WHERE collaboration_id=? and member_status='MEMBER'";
  return $self->fetch_col_value($self->database, $sql, $self->id);
}

sub member_users {
  my $self = shift;
  if(!defined($self->database)) { return 0; }
  return EEDB::User->fetch_all_members_by_collaboration($self);
}

sub pending_user_requests {
  my $self = shift;
  return EEDB::User->fetch_requested_users_by_collaboration($self);
}

sub pending_user_invitations {
  my $self = shift;
  return EEDB::User->fetch_invited_users_by_collaboration($self);
}

sub metadataset {
  my $self = shift;
  
  if(!defined($self->{'_metadataset'})) {
    $self->{'_metadataset'} = new EEDB::MetadataSet;

    if($self->database) {
      my $symbols = EEDB::Symbol->fetch_all_by_collaboration_id($self->database, $self->id);
      $self->{'_metadataset'}->add_metadata(@$symbols);

      my $mdata = EEDB::Metadata->fetch_all_by_collaboration_id($self->database, $self->id);
      $self->{'_metadataset'}->add_metadata(@$mdata);
    }
    $self->{'_metadataset'}->remove_duplicates;
  }
  return $self->{'_metadataset'};
}

=head2 group_registry

  Description  : returns the EEDB::Peer of the registry used by this group.
  Returntype   : EEDB::Peer connected to group's database registry.

=cut

sub group_registry {
  my $self = shift;

  if($self->{'_group_registry'}) { return $self->{'_group_registry'}; }
  
  my $reg_mdata = $self->metadataset->find_metadata("group_registry", undef);
  unless($reg_mdata) { return undef; }
  
  my $peer = EEDB::Peer->fetch_self_from_url($reg_mdata->data);
  if($peer) { $self->{'_group_registry'} = $peer; }

  return $self->{'_group_registry'};
}

=head2 group_directory

  Description  : returns the local directory location used by 
                 this collaboration group.
  Returntype   : string path to local directory.

=cut

sub group_directory {
  my $self = shift;

  if($self->{'_group_directory'}) { return $self->{'_group_directory'}; }
  
  my $dir_mdata = $self->metadataset->find_metadata("group_dir", undef);
  unless($dir_mdata) { return undef; }
  $self->{'_group_directory'} = $dir_mdata->data;
  
  return $self->{'_group_directory'};
}


####################################

sub display_desc {
  my $self = shift;
  my $str = sprintf("Collaboration(%s)", $self->db_id);
  $str .= sprintf(" [%s]", $self->uuid);
  $str .= sprintf(" : %s", $self->display_name);
  return $str;
}

sub display_contents {
  my $self = shift;
  my $str = $self->display_desc;
  $str .= "\n". $self->metadataset->display_contents;   
  return $str;
}

sub group_registry_stats {
  my $self = shift;

  my $metadataset = new EEDB::MetadataSet;
  my $reg = $self->group_registry;
  unless($reg) { return $metadataset; }
  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->add_seed_peers($reg);

  my $peer_count=0;
  my $source_count=0;
  my $experiment_count=0;

  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) { $peer_count++; }

  $stream->stream_data_sources();
  while(my $obj = $stream->next_in_stream) {
    unless($obj) { next; }
    if($obj->class eq "Experiment") { $experiment_count++; }
    if($obj->class eq "FeatureSource") { $source_count++; }
  }
  $metadataset->add_tag_data("peer_count", $peer_count);
  $metadataset->add_tag_data("experiment_count", $experiment_count);
  $metadataset->add_tag_data("source_count", $source_count);

  return $metadataset;
}


####################################

sub xml_start {
  my $self = shift;
  my $str = sprintf("<eedb_collaboration name=\"%s\" uuid=\"%s\" owner=\"%s\" member_count=\"%d\" member_status=\"%s\" ", 
                    $self->display_name, $self->uuid, $self->owner_openid,
		    $self->member_count, $self->member_status);
  if($self->public_announce eq "y") { $str .= "public_announce=\"y\" "; }
  $str .= " >";
  return $str;
}

sub xml_end {
  my $self = shift;
  return "</eedb_collaboration>\n"; 
}

sub xml {
  my $self = shift;
  
  my $str = $self->xml_start;

  if(($self->{'_member_status'} eq "owner") or ($self->{'_member_status'} eq "MEMBER")) {
    my $members = $self->member_users;
    if(scalar(@$members)>0) {
      $str .= sprintf("<member_users count=\"%d\" >", scalar(@$members));
      foreach my $user (@$members) { $str .= $user->simple_xml; }
      $str .= "</member_users>\n";
    }
  }

  if($self->{'_member_status'} eq "owner") {
    $str .= "\n". $self->metadataset->xml;
    my $requests = $self->pending_user_requests;
    if(scalar(@$requests)>0) {
      $str .= sprintf("<user_requests count=\"%d\" >", scalar(@$requests));
      foreach my $user (@$requests) { $str .= $user->simple_xml; }
      $str .= "</user_requests>\n";
    }
    my $invites = $self->pending_user_invitations;
    if(scalar(@$invites)>0) {
      $str .= sprintf("<user_invitations count=\"%d\" >", scalar(@$invites));
      foreach my $user (@$invites) { $str .= $user->simple_xml; }
      $str .= "</user_invitations>\n";
    }
  } else {
    my $descMD = $self->metadataset->find_metadata("description", undef);
    if($descMD) { $str .= $descMD->xml; }
  }
  $str .= $self->xml_end;
  return $str;
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
  my $sql = "INSERT INTO collaboration (display_name, uuid, owner_openid, public_announce) VALUES(?,?,?,?)";
  $self->database->execute_sql($sql, $self->display_name, $self->uuid, $self->owner_openid, $self->public_announce);
  
  my $dbID = $db->fetch_col_value("select collaboration_id from collaboration where uuid=?", $self->uuid);
  if($dbID) { $self->primary_id($dbID); }

  #now do the symbols and metadata  
  $self->store_metadata;

  return $self;
}

sub store_metadata {
  my $self = shift;

  my $mdata_list = $self->metadataset->metadata_list;
  foreach my $mdata (@$mdata_list) {
    if(!defined($mdata->primary_id)) { 
      $mdata->store($self->database);
    }
    $mdata->store_link_to_collaboration($self);
  }
}


##### DBObject instance override methods #####

sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbh = shift;

  $self->primary_id($rowHash->{'collaboration_id'});
  $self->uuid($rowHash->{'uuid'});
  $self->display_name($rowHash->{'display_name'});
  $self->owner_openid($rowHash->{'owner_openid'});
  $self->public_announce($rowHash->{'public_announce'});
  if($rowHash->{'member_status'}) { $self->{'_member_status'} = $rowHash->{'member_status'}; }
  if($rowHash->{'openID'}) {
    if($rowHash->{'openID'} eq $rowHash->{'owner_openid'}) { $self->{'_member_status'} = "owner"; }
  } 
  return $self;
}


##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_by_uuid {
  my $class = shift;
  my $user = shift; #EEDB::User instance
  my $uuid = shift;

  unless(defined($user) && $user->isa('EEDB::User')) {
    print(STDERR 'ERROR fetch_by_uuid() param must be a EEDB::User');
    return undef;
  }
  return undef unless($user->database);

  my $sql = "SELECT c.*, openID, member_status from collaboration c LEFT JOIN ".
            "(SELECT * from collaboration_2_user join user u using(user_id) where u.user_id=?)t using(collaboration_id) ".
	    "WHERE c.uuid=?";
  return $class->fetch_single($user->database, $sql, $user->id, $uuid);
}

sub fetch_all_by_user {
  my $class = shift;
  my $user = shift; #EEDB::User instance

  unless(defined($user) && $user->isa('EEDB::User')) {
    print(STDERR 'ERROR fetch_all_by_user() param must be a EEDB::User');
    return [];
  }
  return [] unless($user->database);
  
  my $sql = "SELECT c.*, openID, member_status from collaboration c LEFT JOIN ".
            "(SELECT * from collaboration_2_user JOIN user u using(user_id) WHERE u.user_id=?)t using(collaboration_id) ".
	    "WHERE (public_announce='y' and member_status is NULL) or member_status!='REJECTED'";
  return $class->fetch_multiple($user->database, $sql, $user->id);
}

sub fetch_by_user_member {
  my $class = shift;
  my $user = shift; #EEDB::User instance

  unless(defined($user) && $user->isa('EEDB::User')) {
    print(STDERR 'ERROR fetch_by_user_member() param must be a EEDB::User');
    return [];
  }
  return [] unless($user->database);
  
  my $sql = "SELECT c.*, openID, member_status from collaboration c ".
            "JOIN collaboration_2_user using(collaboration_id) ".
	    "JOIN user u using(user_id) ".
	    "WHERE u.user_id=? and member_status='MEMBER'";
  return $class->fetch_multiple($user->database, $sql, $user->id);
}

#
#################################################################################
#


sub _create_registry {
  my $self = shift;
  my $reg_name = shift;
  my $display_name = shift;
  
  my $collaboration_uuid = $self->uuid;
  
  unless(($ENV{'EEDB_USER_ROOTDIR'}) and (-d $ENV{'EEDB_USER_ROOTDIR'})) { return undef; }
  
  #user directory
  my $groupdir = $ENV{'EEDB_USER_ROOTDIR'} ."/". $collaboration_uuid;
  mkdir($groupdir, 0700);
  unless(-d $groupdir) {
    printf(STDERR "ERROR: _create_group_registry unable to create user directory\n");
    return undef;
  }
  
  #template sqlite eeDB database
  my $template = $ENV{'EEDB_ROOT'} . "/sql/eedb_template.sqlite";
  unless(-e $template) {
    printf(STDERR "ERROR: EEDB_ROOT not setup unable to create user registry\n");
    return undef;
  }
  
  my $dbpath = $groupdir ."/". $reg_name .".sqlite";
  my $cmd = "cp " . $template ." ". $dbpath;
  system($cmd);
  unless(-e $dbpath) {
    printf(STDERR "ERROR: unable to create sqlite user registry\n");
    return undef;
  }
  chmod(0600, $dbpath);

  my $dburl = "sqlite://" . $dbpath;
  my $regDB = EEDB::Database->new_from_url($dburl);
  my $regPeer = EEDB::Peer->create_self_peer_for_db($regDB); 
  
  #create system FeatureSources
  my $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_configs", $regDB);
  $fsrc->metadataset->add_tag_data("eedb:display_name", $display_name . " gLyphs configs");
  $fsrc->store_metadata;

  $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyph_track_configs", $regDB);
  $fsrc->metadataset->add_tag_data("eedb:display_name", $display_name . " track configs");
  $fsrc->store_metadata;
  
  $self->metadataset->add_tag_data("group_registry", $dburl);
  $self->metadataset->add_tag_data("group_dir", $groupdir);
  $self->store_metadata;

  return $self;
}



##############################################################################################
#
# collaboration manangement routines
#
##############################################################################################

sub ignore_collaboration {
  my $self = shift;
  my $user = shift;  #an EEDB::User
  
  unless($self->database) { return undef; }
  unless($self->peer_uuid eq $user->peer_uuid) { return undef; }

  if($self->member_status eq "not_member") {
    my $sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,'REJECTED')";
    $self->database->execute_sql($sql, $self->id, $user->id);
  }
  if($self->member_status eq "INVITED") {
    my $sql = "UPDATE collaboration_2_user set member_status='REJECTED' where collaboration_id=? and user_id=?";
    $self->database->execute_sql($sql, $self->id, $user->id);
  }
}


sub request_to_join_public_collaboration {
  my $self = shift;
  my $user = shift;  #an EEDB::User
  
  unless($self->database) { return undef; }
  unless($self->peer_uuid eq $user->peer_uuid) { return undef; }
  if($self->public_announce ne "y") { return undef; }
  
  my $sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,?)";
  $self->database->execute_sql($sql, $self->id, $user->id, "REQUEST");
}


sub accept_user_request_to_collaboration {
  my $self = shift;
  my $openID = shift;

  unless($self->database) { return undef; }
  if($self->member_status ne "owner") { return undef; }

  my $requests = $self->pending_user_requests;
  foreach my $user (@$requests) {
    if($user->openID ne $openID) { next; }
    my $sql = "UPDATE collaboration_2_user set member_status='MEMBER' where collaboration_id=? and user_id=?";
    $self->database->execute_sql($sql, $self->id, $user->id);
  }
}


sub reject_user_request_to_collaboration {
  my $self = shift;
  my $openID = shift;

  unless($self->database) { return undef; }
  unless(($self->member_status eq "owner") or ($self->member_status eq "INVITED")) { return undef; }

  my $requests = $self->pending_user_requests;
  foreach my $user (@$requests) {
    if($user->openID ne $openID) { next; }
    my $sql = "UPDATE collaboration_2_user set member_status='REJECTED' where collaboration_id=? and user_id=?";
    $self->database->execute_sql($sql, $self->id, $user->id);
  }
}


sub invite_user_to_collaboration {
  my $self = shift;
  my $openID = shift;

  unless($self->database) { return undef; }
  if($self->member_status ne "owner") { return undef; }

  #need to find user, then insert an invitation
  my $user = EEDB::User->fetch_by_openID($self->database, $openID);
  unless($user) { return undef; }

  my $sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,?)";
  $self->database->execute_sql($sql, $self->id, $user->id, "INVITED");
}


sub accept_invitation_to_collaboration {
  my $self = shift;
  my $user = shift;  #an EEDB::User

  unless($self->database) { return undef; }
  unless($self->member_status eq "INVITED") { return undef; }

  my $sql = "SELECT member_status FROM collaboration_2_user WHERE collaboration_id=? and user_id=?";
  my $status = $self->fetch_col_value($self->database, $sql, $self->id, $user->id);
  unless($status eq "INVITED") { return undef; }

  $sql = "UPDATE collaboration_2_user set member_status='MEMBER' where collaboration_id=? and user_id=?";
  $self->database->execute_sql($sql, $self->id, $user->id);
}


sub unlink_shared_peer {
  my $self = shift;
  my $peer = shift;

  unless($peer) { return "no profile registry"; }
  my $stream = $peer->source_stream;
  unless($stream) { return "no profile registry"; }

  my $collaborationReg = $self->group_registry;
  unless($collaborationReg and $collaborationReg->peer_database) { return "problem with user registry"; }

  $stream->stream_data_sources('class'=>'FeatureSource');
  my $source = undef;
  while($source = $stream->next_in_stream) {
    next unless($source);
    if($source->primary_id eq "1") { last; }
  }
  unless($source) {
    $self->{'upload_error'} ="primary database source not found";
  }

  my $ownerMD = $source->metadataset->find_metadata("eedb:owner_OpenID");
  if(!($ownerMD) or ($ownerMD->data ne $self->openID)) {
    my $msg = $source->display_desc;
    $msg .= " ** not my uploaded source, can not delete";
    return $msg;
  }

  my $idx = index($peer->db_url, $self->group_directory);
  if($idx == -1) {
    return "database not in my upload directory";
  }
  my $dbfile = substr($peer->db_url, $idx);
  unless(-d $dbfile) { return "unable to get directory stats on uploaded database"; }

  # then delete peer from my registry
  my $collaborationDB = $self->group_registry->peer_database;
  $collaborationDB->execute_sql("DELETE from peer WHERE uuid=?", $peer->uuid);

  return undef;
}


sub share_peer_database {
  my $self = shift;
  my $peer = shift;

  unless($peer) { return "problem with uploaded database"; }
  my $stream = $peer->source_stream;
  unless($stream) { return "problem with uploaded database"; }

  unless(($self->member_status eq "MEMBER") or ($self->member_status eq "owner")) {
    return "not a member of collaboration, so unable to share data with it";
  }

  my $collaborationReg = $self->group_registry;
  unless($collaborationReg and $collaborationReg->peer_database) { return "problem with collaboration registry"; }

  $stream->stream_data_sources('class'=>'FeatureSource');
  my $source = undef;
  while($source = $stream->next_in_stream) {
    next unless($source);
    if($source->primary_id eq "1") { last; }
  }
  unless($source) {
    return "upload database primary source not found";
  }

  #OK everything checks out, go and created sharing

  my $collaborationDB = $self->group_registry->peer_database;
  $collaborationDB->disconnect;
  $collaborationDB->user('zenbu_admin');
  $collaborationDB->password('zenbu_admin');

  my $peer_copy = $peer->copy;
  $peer_copy->database(undef);
  $peer_copy->store($collaborationDB);

  $source->metadataset->add_tag_symbol("eedb:shared_in_collaboration", $self->uuid);
  $source->store_metadata;

  return undef;
}


1;

