# $Id: User.pm,v 1.36 2014/03/18 07:57:16 severin Exp $
=head1 NAME - EEDB::User

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

$VERSION = 0.953;

package EEDB::User;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use Data::UUID;
use Net::OpenID::VerifiedIdentity;

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "EEDB::User"; }

=head2 create_new_profile

  Description  : high-level class level routine to create an new user profile
                 within a system (user database, user directory structure)
                 given a verified OpenID identify from the net.
  Parameter[1] : a Net::OpenID::VerifiedIdentity instance
  Parameter[2] : an EEDB::Database instance of the user database
  Returntype   : instance of EEDB::User or undef if problem.

=cut

sub create_new_profile {
  my $class = shift;
  my $vident = shift;  # a Net::OpenID::VerifiedIdentity
  my $userDB = shift;  # an EEDB::Database 
  
  unless(defined($vident) and ($vident->isa('Net::OpenID::VerifiedIdentity'))) {
    return undef;
  }
  unless(defined($userDB) and ($userDB->isa('EEDB::Database'))) {
    return undef;
  }

  my $openID = $vident->url;
  my $user = EEDB::User->fetch_by_openID($userDB, $openID);

  if(!defined($user)) {
    $user = new EEDB::User;
    $user->openID($openID);

    ##$user->metadataset->add_tag_symbol('test', 'hello world');
    ##my $sreg = $vident->extension_fields('http://openid.net/srv/ax/1.0');
    #my $sreg = $vident->extension_fields('http://openid.net/extensions/sreg/1.1');
    #foreach my $regkey (keys(%$sreg)) {
    #  $user->metadataset->add_tag_symbol('openid:'.$regkey, $sreg->{$regkey});
    #}

    my $sreg = $vident->signed_extension_fields('http://openid.net/extensions/sreg/1.1');
    if($sreg->{'email'}) { $user->email_address($sreg->{'email'}); }
    if($sreg->{'fullname'}) { $user->metadataset->add_tag_symbol('openid:fullname', $sreg->{'fullname'}); }
    if($sreg->{'nickname'}) { $user->metadataset->add_tag_symbol('openid:nickname', $sreg->{'nickname'}); }
    if($sreg->{'country'}) { $user->metadataset->add_tag_symbol('openid:country', $sreg->{'country'}); }
    if($sreg->{'language'}) { $user->metadataset->add_tag_symbol('openid:language', $sreg->{'language'}); }
    if($sreg->{'timezone'}) { $user->metadataset->add_tag_symbol('openid:timezone', $sreg->{'timezone'}); }
    if($sreg->{'gender'}) { $user->metadataset->add_tag_symbol('openid:gender', $sreg->{'gender'}); }
    if($sreg->{'dob'}) { $user->metadataset->add_tag_symbol('openid:dob', $sreg->{'dob'}); }

    # user internal UUID
    my $ug    = new Data::UUID;
    my $uuid  = $ug->create_b64();
    chomp($uuid);
    $uuid =~ s/=//g;
    $uuid =~ s/\+/\-/g;
    $uuid =~ s/\//_/g;
    if($uuid =~ /^\-/) { $uuid = "z".$uuid; } #dirs beginning with "-" are problem on cmdline
    $user->metadataset->add_tag_data('uuid', $uuid);
    $user->{'_user_uuid'} = $uuid;
    $user->store($userDB);

    ## create user registry
    $user->_create_registry("user_registry");
  }
  return $user;
}

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  $self->{'_user_uuid'} = undef;
  $self->{'_openID'} = undef;
  $self->{'_email_address'} = undef;
  
  return $self;
}


##########################
#
# getter/setter methods of data which is stored in database
#
##########################

sub openID {
  my $self = shift;
  return $self->{'_openID'} = shift if(@_);
  $self->{'_openID'}='' unless(defined($self->{'_openID'}));
  return $self->{'_openID'};
}

sub email_address {
  my $self = shift;
  return $self->{'_email_address'} = shift if(@_);
  $self->{'_email_address'}='' unless(defined($self->{'_email_address'}));
  return $self->{'_email_address'};
}

sub nickname {
  my $self = shift;
  return $self->{'_nickname'} = shift if(@_);
  $self->{'_nickname'}='' unless(defined($self->{'_nickname'}));
  return $self->{'_nickname'};
}

sub user_uuid {
  my $self = shift;
  return $self->{'_user_uuid'} = shift if(@_);
  $self->{'_user_uuid'}='' unless(defined($self->{'_user_uuid'}));
  return $self->{'_user_uuid'};
}


sub metadataset {
  my $self = shift;
  
  if(!defined($self->{'_metadataset'})) {
    $self->{'_metadataset'} = new EEDB::MetadataSet;

    if($self->database) {
      my $symbols = EEDB::Symbol->fetch_all_by_user_id($self->database, $self->id);
      $self->{'_metadataset'}->add_metadata(@$symbols);

      my $mdata = EEDB::Metadata->fetch_all_by_user_id($self->database, $self->id);
      $self->{'_metadataset'}->add_metadata(@$mdata);
    }
    #if($self->openID) { $self->{'_metadataset'}->add_tag_symbol("eedb:openID", $self->openID); }
    #if($self->email_address) { $self->{'_metadataset'}->add_tag_symbol("eedb:email_address", $self->email_address); }
    $self->{'_metadataset'}->remove_duplicates;
  }
  return $self->{'_metadataset'};
}


sub user_registry {
  my $self = shift;

  if($self->{'_user_registry'}) { return $self->{'_user_registry'}; }
  
  my $reg_mdata = $self->metadataset->find_metadata("user_registry", undef);
  unless($reg_mdata) { return undef; }
  
  my $peer = EEDB::Peer->fetch_self_from_url($reg_mdata->data);
  if($peer) { $self->{'_user_registry'} = $peer; }

  return $self->{'_user_registry'};
}


sub user_directory {
  my $self = shift;

  if($self->{'_user_directory'}) { return $self->{'_user_directory'}; }
  
  my $dir_mdata = $self->metadataset->find_metadata("user_dir", undef);
  unless($dir_mdata) { return undef; }
  $self->{'_user_directory'} = $dir_mdata->data;
  
  return $self->{'_user_directory'};
}


sub member_collaborations {
  my $self = shift;
  return EEDB::Collaboration->fetch_by_user_member($self);
}


####################################

sub display_desc
{
  my $self = shift;
  my $str = sprintf("User(%s)", $self->db_id);
  $str .= sprintf(" [%s]", $self->openID);
  $str .= sprintf(" : %s", $self->email_address);
  $str .= sprintf(" : %s", $self->nickname);
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
  my $str = sprintf("<eedb_user openID=\"%s\" nickname=\"%s\" ", $self->openID, $self->nickname);
  $str .= ">";
  return $str;
}

sub xml_end {
  my $self = shift;
  return "</eedb_user>\n"; 
}

sub xml {
  my $self = shift;
  
  my $str = $self->xml_start;
  if($self->email_address =~ /\w\@/) {
    $str .= "\n". EEDB::Metadata->new("eedb:email_address", $self->email_address)->xml;
  }
  $str .= "\n". $self->metadataset->xml;
  $str .= $self->xml_end;
  return $str;
}


sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  my $self = new $class;
  $self->db_id($xmlTree->{'-id'}) if($xmlTree->{'-id'});
  $self->openID($xmlTree->{'-openID'}) if($xmlTree->{'-openID'});
  $self->email_address($xmlTree->{'-email'}) if($xmlTree->{'-email'});
 
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

sub check_exists_db {
  my $self = shift;
  my $db   = shift;
  
  unless($db) { return undef; }
  if(defined($self->primary_id) and ($self->primary_id>0)) { return $self; }
  
  #check if it is already in the database
  my $dbID = $db->fetch_col_value("select user_id from user where user_uuid=?", $self->user_uuid);
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
  
  if($self->check_exists_db($db)) { return $self; }

  if($db) { $self->database($db); }
  
  my $user_uuid = $self->metadataset->find_metadata('uuid');
  
  my $sql = "INSERT INTO user (user_uuid, nickname) VALUES(?,?)";
  $self->database->execute_sql($sql, $self->user_uuid, $self->nickname);
  $self->check_exists_db($db);

  $sql = "INSERT INTO user_authentication (user_id, openID) VALUES(?,?)";
  $self->database->execute_sql($sql, $self->primary_id, $self->openID);
  $self->check_exists_db($db);
  
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
    $mdata->store_link_to_user($self);
  }
}

sub update {
  my $self = shift;
  
  my $sql = "UPDATE user set nickname=? where openID=?";
  $self->database->execute_sql($sql, $self->nickname, $self->openID);
  
  #now do the symbols and metadata  
  $self->store_metadata;

  return $self;
}


##### DBObject instance override methods #####

sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbh = shift;

  $self->primary_id($rowHash->{'user_id'});
  $self->user_uuid($rowHash->{'user_uuid'});
  $self->openID($rowHash->{'openID'});
  $self->email_address($rowHash->{'email_identity'});
  $self->nickname($rowHash->{'nickname'});
   
  return $self;
}


##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_all {
  my $class = shift;
  my $db = shift;

  my $sql = "SELECT * FROM user";
  return $class->fetch_multiple($db, $sql);
}

sub fetch_by_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  unless($db) { return undef; }
  my $sql = "SELECT * FROM user WHERE user_id=?";
  return $class->fetch_single($db, $sql, $id);
}

sub fetch_by_openID {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  unless($db) { return undef; }
  #my $sql = "SELECT * FROM user JOIN user_authentication using(user_id) where user_authentication.openID=?";
  my $sql = "SELECT user.* FROM user JOIN user_authentication using(user_id) where user_authentication.openID=?";
  return $class->fetch_single($db, $sql, $id);
}

sub fetch_by_email {
  my $class = shift;
  my $db = shift;
  my $email = shift;

  unless($db) { return undef; }
  my $sql = "SELECT * FROM user WHERE email_identity=?";
  return $class->fetch_single($db, $sql, $email);
}

sub fetch_all_by_email {
  my $class = shift;
  my $db = shift;
  my $email = shift;

  my $sql = "SELECT * FROM user WHERE email_identity=?";
  return $class->fetch_multiple($db, $sql, $email);
}

sub fetch_all_by_collaboration {
  my $class = shift;
  my $collaboration = shift; #EEDB::User instance

  unless(defined($collaboration) && $collaboration->isa('EEDB::Collaboration')) {
    print(STDERR 'ERROR fetch_all_by_collaboration() param must be a EEDB::Collaboration');
    return [];
  }
  return [] unless($collaboration->database);
  
  my $sql = "SELECT u.* FROM user u join collaboration_2_user using(user_id) where collaboration_id = ?";
  return $class->fetch_multiple($collaboration->database, $sql, $collaboration->id);
}


sub fetch_requested_users_by_collaboration {
  my $class = shift;
  my $collaboration = shift; #EEDB::Collaboration instance

  unless(defined($collaboration) && $collaboration->isa('EEDB::Collaboration')) {
    print(STDERR 'ERROR fetch_all_by_collaboration() param must be a EEDB::Collaboration');
    return [];
  }
  return [] unless($collaboration->database);

  my $sql = "SELECT u.*, uuid, member_status FROM user u join collaboration_2_user using(user_id) ".
            "JOIN collaboration c using(collaboration_id) ".
            "where c.collaboration_id = ? and member_status='REQUEST' ";
  return $class->fetch_multiple($collaboration->database, $sql, $collaboration->id);
}


sub fetch_invited_users_by_collaboration {
  my $class = shift;
  my $collaboration = shift; #EEDB::Collaboration instance

  unless(defined($collaboration) && $collaboration->isa('EEDB::Collaboration')) {
    print(STDERR 'ERROR fetch_all_by_collaboration() param must be a EEDB::Collaboration');
    return [];
  }
  return [] unless($collaboration->database);

  my $sql = "SELECT u.*, uuid, member_status FROM user u join collaboration_2_user using(user_id) ".
            "JOIN collaboration c using(collaboration_id) ".
            "where c.collaboration_id = ? and member_status='INVITED' ";
  return $class->fetch_multiple($collaboration->database, $sql, $collaboration->id);
}


sub fetch_all_members_by_collaboration {
  my $class = shift;
  my $collaboration = shift; #EEDB::Collaboration instance

  unless(defined($collaboration) && $collaboration->isa('EEDB::Collaboration')) {
    print(STDERR 'ERROR fetch_all_by_collaboration() param must be a EEDB::Collaboration');
    return [];
  }
  return [] unless($collaboration->database);

  my $sql = "SELECT u.*, uuid, member_status FROM user u join collaboration_2_user using(user_id) ".
            "JOIN collaboration c using(collaboration_id) ".
            "where c.collaboration_id = ? and member_status='MEMBER' ";
  return $class->fetch_multiple($collaboration->database, $sql, $collaboration->id);
}



#
#################################################################################
#


sub _create_registry {
  my $self = shift;
  my $reg_name = shift;
  
  my $user_uuid = $self->metadataset->find_metadata('uuid');
  unless($user_uuid) { return undef; }
  
  printf(STDERR "_create_registry [%s]\n", $user_uuid->data);
  printf(STDERR "EEDB_USER_ROOTDIR [%s]\n", $ENV{'EEDB_USER_ROOTDIR'});
  #unless(($ENV{'EEDB_USER_ROOTDIR'}) and (-d $ENV{'EEDB_USER_ROOTDIR'})) { return undef; }
  unless($ENV{'EEDB_USER_ROOTDIR'}) { return undef; }
  
  #user directory
  my $userdir = $ENV{'EEDB_USER_ROOTDIR'} ."/". $user_uuid->data;
  printf(STDERR "mkdir [%s]\n", $userdir);
  mkdir($userdir, 0700);
  unless(-d $userdir) {
    printf(STDERR "ERROR: _create_user_registry unable to create user directory\n");
    return undef;
  }
  
  #template sqlite eeDB database
  my $template = $ENV{'EEDB_ROOT'} . "/sql/eedb_template.sqlite";
  unless(-e $template) {
    printf(STDERR "ERROR: EEDB_ROOT not setup unable to create user registry\n");
    return undef;
  }
  
  my $dbpath = $userdir ."/". $reg_name .".sqlite";
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
  #EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_autoconfigs", $regDB);
  #my $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_configs", $regDB);
  #$fsrc->metadataset->add_tag_data("eedb:display_name", "user private gLyphs configs");
  #$fsrc->store_metadata;

  #$fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyph_track_configs", $regDB);
  #$fsrc->metadataset->add_tag_data("eedb:display_name", "user private track configs");
  #$fsrc->store_metadata;

  #$fsrc = EEDB::FeatureSource->create_from_name("config::ZENBU_script_configs", $regDB);
  #$fsrc->metadataset->add_tag_data("eedb:display_name", "user private scripts");
  #$fsrc->store_metadata;

  $self->metadataset->add_tag_data("user_registry", $dburl);
  $self->metadataset->add_tag_data("user_dir", $userdir);
  $self->store_metadata;

  return $self;
}

sub delete_uploaded_peer {
  my $self = shift;
  my $peer = shift;

  unless($peer) { return "no profile registry"; }
  my $stream = $peer->source_stream;
  unless($stream) { return "no profile registry"; }

  my $userReg = $self->user_registry;
  unless($userReg and $userReg->peer_database) { return "problem with user registry"; }

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
  if(!(($source->owner_openid eq $self->openID) or
     ($ownerMD and ($ownerMD->data eq $self->openID)))) {
    my $msg = $source->display_desc;
    $msg .= " ** not my uploaded source, can not delete";
    return $msg;
  }

  my $idx = index($peer->db_url, $self->user_directory);
  if($idx == -1) {
    return "database not in my upload directory";
  }
  my $dbfile = substr($peer->db_url, $idx);
  unless(-d $dbfile) { return "unable to get directory stats on uploaded database"; }

  # OK go and delete now
  # first delete files from my upload directory
  my $cmd = sprintf("rm %s/oscdb.*; rmdir %s", $dbfile, $dbfile);
  #print(STDERR "$cmd\n");
  system($cmd);

  # then delete peer from my registry
  my $userDB = $self->user_registry->peer_database;
  $userDB->execute_sql("DELETE from peer WHERE uuid=?", $peer->uuid);

  return undef;
}

1;

