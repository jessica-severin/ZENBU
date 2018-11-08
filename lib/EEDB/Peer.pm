# $Id: Peer.pm,v 1.77 2010/08/02 09:20:37 severin Exp $
=head1 NAME - EEDB::Peer

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

my $__riken_EEDB_peer_global_uuid_cache = {};
my $__riken_EEDB_peer_global_current_web_url = undef;

$VERSION = 0.953;

package EEDB::Peer;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use Data::UUID;
use Net::Ping;

use EEDB::Database;
use EEDB::SPStream::SourceStream;
use EEDB::SPStream::EEWebXMLStream;

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "Peer"; }

=head2 create_self_peer_for_db

  Description: used when creating a new instance of an eeDB database
  Returntype : EEDB::Peer
  Exceptions : none

=cut

sub create_self_peer_for_db {
  #used as part of new EEDB instance creation process.
  #each EEDB instance will have a peer entry for itself, this way when
  #other EEDB databases need to externally link to features they can use copy 
  #this self-peer entry to the remote database
  
  my $class = shift;
  my $db = shift; #required
  my $web_url = shift; #optional
  
  return undef unless($db);

  my $self = undef;  
  my $uuid = $db->fetch_col_value("SELECT uuid FROM peer WHERE is_self=1 and alias=?", $db->alias);
  if($uuid) {
    $self = EEDB::Peer->fetch_by_uuid($db, $uuid);
  } else {
    my $dburl = $db->full_url;
    if($db->driver eq "mysql") {
      $dburl = sprintf("mysql://read:read\@%s:%s/%s", $db->host, $db->port, $db->dbname);
    }
    $self = new EEDB::Peer;
    $self->create_uuid;
    $self->alias($db->alias);
    $self->db_url($dburl);
    if($web_url) { $self->web_url($web_url); }               
    $self->store($db);
    $db->execute_sql("UPDATE peer SET is_self=0"); #clears old "selfs"
    $db->execute_sql("UPDATE peer SET is_self=1 WHERE uuid=?", $self->uuid);
  }
  return $self;
}

=head2 fetch_self_from_url

  Description: use database URL to connect and then fetches primary/self Peer
  Returntype : EEDB::Peer
  Exceptions : none

=cut

sub fetch_self_from_url {
  my $class = shift;
  my $url = shift;
  
  my $db = EEDB::Database->new_from_url($url);
  unless($db) { return undef; }
  unless($db->test_connection) { return undef; }
  
  my $sql = "SELECT * FROM peer WHERE is_self=1 and alias=?";
  return $class->fetch_single($db, $sql, $db->alias);
}

=head2 current_web_url

  Description: set a global variable of the current webservice URL
               to differentiate local vs remote peers.
  Returntype : string of currently set value
  Exceptions : none

=cut

sub current_web_url {
  my $class = shift;
  if(@_) { $__riken_EEDB_peer_global_current_web_url = shift; }
  return $__riken_EEDB_peer_global_current_web_url;
}


sub check_global_peer_cache {
  my $class = shift;
  my $uuid = shift;
  
  if(!defined($uuid)) { return undef; }
  my $peer = $__riken_EEDB_peer_global_uuid_cache->{$uuid};
  if(defined($peer)) { return $peer; }
  return undef;
}


sub empty_global_peer_cache {
  my $class = shift;
  my $mode = shift;
  
  my @peers = values(%{$__riken_EEDB_peer_global_uuid_cache});
  foreach my $peer (@peers) { $peer->free_source_stream; }
  $__riken_EEDB_peer_global_uuid_cache = {};
}


sub global_cached_peers {
  my $class = shift;
  my $depth = shift;
  
  if(!defined($depth) or $depth<0) { $depth =7; }
  my @peers = values(%{$__riken_EEDB_peer_global_uuid_cache});
  return \@peers;
}


sub global_uncache_peer {
  my $class = shift;
  my $peer_uuid = shift;
  
  my $peer = $__riken_EEDB_peer_global_uuid_cache->{$peer_uuid};
  unless($peer) { return; }
  $peer->free_source_stream;
  delete $__riken_EEDB_peer_global_uuid_cache->{$peer_uuid};
  return undef;
}

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_tested_valid'} = undef;
  $self->{'_federation_depth'} = 0;
  $self->{'_neighbor_peers'} = {};
  return $self;
}

sub copy {
  my $self = shift;

  my $copy = EEDB::Peer->new();
  $copy->primary_id($self->primary_id());
  $copy->alias($self->alias());
  $copy->db_url($self->db_url());
  $copy->web_url($self->web_url());
  return $copy;
}


sub create_uuid {
  my $self = shift;
  
  my $ug    = new Data::UUID;
  my $uuid  = $ug->create();
  $self->primary_id($ug->to_string($uuid));
}

sub disconnect {
  my $self = shift;
  if($self->{'_source_stream'}) { 
    $self->{'_source_stream'}->disconnect; 
  }
  if($self->{'_peer_external_database'}) { 
    $self->{'_peer_external_database'}->disconnect;
  }
}

sub free_source_stream {
  my $self = shift;
  
  if(defined($self->{'_source_stream'})) {
    my @sources = values(%{$self->{'_source_stream'}->{'_sources_cache'}});
    foreach my $source (@sources) {
      $source->global_uncache;
    }
    $self->{'_source_stream'}->{'_sources_cache'} = undef;
    $self->{'_source_stream'}->{'_peers_cache'} = undef;
    $self->{'_source_stream'}->{'_peer'} = undef;
    if($self->{'_source_stream'}->{'_database'}) {
      $self->{'_source_stream'}->{'_database'} = undef;
    }
  }
  my $db = $self->{'_peer_external_database'};
  if(defined($db) and $db->isa('EEDB::SPStream::SourceStream')) {
    $db->disconnect;
    $self->{'_peer_external_database'} = undef;
  }
  $self->{'_source_stream'} = undef;
  $self->{'_neighbor_peers'} = {};
}

sub uncache_stream_sources {
  my $self = shift;
  if(defined($self->{'_source_stream'})) {
    $self->{'_source_stream'}->free_sources_cache;
  }
}


##########################
#
# getter/setter methods of data which is stored in database
#
##########################

sub uuid {
  my $self = shift;
  return $self->primary_id;
}

sub alias {
  my $self = shift;
  return $self->{'alias'} = shift if(@_);
  return $self->{'alias'};
}

sub db_url {
  my $self = shift;
  return $self->{'db_url'} = shift if(@_);
  return $self->{'db_url'};
}

sub web_url {
  my $self = shift;
  return $self->{'web_url'} = shift if(@_);
  $self->{'web_url'}="" unless(defined($self->{'web_url'}));
  return $self->{'web_url'};
}

sub federation_depth {
  my $self = shift;
  if(@_) { $self->{'_federation_depth'} = shift; }
  $self->{'_federation_depth'}=0 unless(defined($self->{'_federation_depth'}));
  return $self->{'_federation_depth'};
}

sub display_desc {
  my $self = shift;
  my $str = sprintf("Peer(%s) %s ", $self->id, $self->alias);
  $str .= sprintf(" db::%s", $self->db_url) if($self->db_url);
  $str .= sprintf(" web::%s", $self->web_url) if($self->web_url);
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = sprintf("<peer uuid=\"%s\"  alias=\"%s\"", $self->id, $self->alias);
  $str .= sprintf(" db_url=\"%s\"", $self->db_url) if($self->db_url);
  $str .= sprintf(" web_url=\"%s\"", $self->web_url) if($self->web_url);
  $str .= sprintf(" depth=\"%s\"", $self->federation_depth);
  $str .= ">";
  return $str;
}

sub xml_end {
  my $self = shift;
  return "</peer>\n";
}

sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  if(defined($xmlTree->{'-uuid'})) {
    my $obj = $__riken_EEDB_peer_global_uuid_cache->{$xmlTree->{'-uuid'}};
    if($obj) { return $obj; }
  }
  
  my $self = new $class;
  $self->primary_id($xmlTree->{'-uuid'}) if($xmlTree->{'-uuid'});
  $self->alias($xmlTree->{'-alias'}) if($xmlTree->{'-alias'});
  $self->db_url($xmlTree->{'-db_url'}) if($xmlTree->{'-db_url'});
  $self->web_url($xmlTree->{'-web_url'}) if($xmlTree->{'-web_url'});
  
  #always cache peers
  $__riken_EEDB_peer_global_uuid_cache->{$self->uuid} = $self;
  return $self;
}

##### URL follow section ##########


sub peer_database {
  my $self = shift;
  
  if(defined($self->db_url)) { 
    if(!defined($self->{'_peer_external_database'})) {
      my $db = EEDB::Database->new_from_url($self->db_url);
      if($db) {
        $db->alias($self->alias);
        $db->uuid($self->uuid);
        $self->{'_peer_external_database'} = $db;
      }
    }
    return $self->{'_peer_external_database'};
  }
  return $self->database; 
}

sub test_is_valid {
  my $self = shift;
  if($self->test_peer_database_is_valid) { return 1; }
  if($self->test_web_service_is_valid) { return 1; }
  return 0;
}

sub retest_is_valid {
  my $self = shift;

  if($self->{'_tested_valid'}) { 
    if(($self->peer_database) and ($self->peer_database->test_connection)) { return 1; }
    return 0;
  }

  $self->{'_tested_valid'} = undef;
  $self->{'_web_service_is_valid'} = undef;
  if($self->test_peer_database_is_valid) { return 1; }
  if($self->test_web_service_is_valid) { return 1; }
  return 0;
}

sub test_peer_database_is_valid {
  my $self = shift;

  unless($self) { return undef; }
  if(!defined($self->{'_tested_valid'})) { 
    $self->{'_tested_valid'} = 0;
    my $db = undef;
    eval {
      $db = $self->peer_database;
      unless($db and $db->test_connection) { $db = undef; }
      if($db) {
        my $uuid = $db->fetch_col_value("SELECT uuid FROM peer WHERE is_self=1 and uuid=?", $self->uuid);
        $db->disconnect;
        if(!defined($uuid) or ($uuid ne $self->uuid)) { $db = undef; }
      }
    };
    unless($db) { return undef; }
    if($@) { $db->disconnect; return undef; }

    $db->disconnect;
    $self->{'_tested_valid'} = 1;
    if(defined($__riken_EEDB_peer_global_current_web_url)) {
      $self->web_url($__riken_EEDB_peer_global_current_web_url);
    }
  }
  return $self->{'_tested_valid'};
}


sub test_web_service_is_valid {
  my $self = shift;

  #still not ready for release
  return undef;

  unless($self) { return undef; }
  unless($self->web_url) { return undef; }
  unless(defined($__riken_EEDB_peer_global_current_web_url)) { return undef; }

  if($self->web_url eq $__riken_EEDB_peer_global_current_web_url) { 
    #one of my peers so don't check and loop back on myself
    return undef;
  }
  
  unless(defined($self->{'_web_service_is_valid'})) {    
    $self->{'_web_service_is_valid'} = 0;
    my $url = $self->web_url . "/cgi/eedb_object.fcgi?mode=status";

    my $ua = LWP::UserAgent->new();
    $ua->timeout( 3 );
    $ua->env_proxy;
    my $response = $ua->get($url);
    unless($response->is_success) { return undef; }

    my $tpp = XML::TreePP->new();
    my $tree;
    eval { $tree = $tpp->parsehttp( GET => $url ); };
    unless($tree and $tree->{'eedb_status'}) { return undef; }
    if($@) { return undef; }

    $self->{'_web_service_is_valid'} = 1;
  }
  return $self->{'_web_service_is_valid'};
} 


sub source_stream {
  my $self = shift;
  if($self->{'_source_stream'}) { return $self->{'_source_stream'}; }
  
  if($self->test_peer_database_is_valid) {
    my $db = $self->peer_database;
    if($db->isa('EEDB::SPStream::SourceStream')) {
      $self->{'_source_stream'} = $db;
    } else {
      my $stream = new EEDB::SPStream::SourceStream();
      $stream->peer($self);
      $self->{'_source_stream'} = $stream;
    }
  }
  elsif($self->test_web_service_is_valid) {
    my $url = $self->web_url;
    my $stream = EEDB::SPStream::EEWebXMLStream->new_from_url($url);
    if($stream) {
      $stream->peer($self);
      $self->{'_source_stream'} = $stream;
    }
  }
  return $self->{'_source_stream'};
}


#################################################
#
# DBObject override methods
#
#################################################


sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbc = shift;

  my $uuid = uc($rowHash->{'uuid'});
  my $cached_self = $__riken_EEDB_peer_global_uuid_cache->{$uuid};
  if(defined($cached_self)) { return $cached_self; }

  $self->primary_id($uuid);
  $self->alias($rowHash->{'alias'});
  $self->db_url($rowHash->{'db_url'}) if($rowHash->{'db_url'});
  $self->web_url($rowHash->{'web_url'}) if($rowHash->{'web_url'});
  
  #always cache peers
  $__riken_EEDB_peer_global_uuid_cache->{$self->uuid} = $self;

  return $self;
}

##### storage/update #####

sub store {
  my $self = shift;
  my $db   = shift;
  
  unless($db) { return undef; }  
  if(!defined($self->primary_id)) { $self->create_uuid; }
  
  $db->execute_sql("INSERT ignore INTO peer (uuid, alias, db_url, web_url) VALUES(?,?,?,?)",
                   $self->id, $self->alias, $self->db_url, $self->web_url);
  $self->database($db);
  return $self;
}



##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_by_uuid {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  my $sql = "SELECT * FROM peer WHERE uuid=?";
  return $class->fetch_single($db, $sql, $id);
}

sub fetch_all {
  my $class = shift;
  my $db = shift;

  my $sql = "SELECT * FROM peer";
  return $class->fetch_multiple($db, $sql);
}

sub fetch_by_name {
  #a fuzzy method which allows either the UUID or alias to be 
  #used for access
  my $class = shift;
  my $db = shift;
  my $name = shift;

  my $sql = "SELECT * FROM peer WHERE uuid=? or alias=?";
  return $class->fetch_single($db, $sql, $name, $name);
}

sub fetch_by_alias {
  my $class = shift;
  my $db = shift;
  my $alias = shift;

  my $sql = "SELECT * FROM peer WHERE alias=?";
  return $class->fetch_single($db, $sql, $alias);
}

sub fetch_self {
  my $class = shift;
  my $db = shift;
  
  my $sql = "SELECT * FROM peer WHERE is_self=1 and alias=?";
  my $peer = $class->fetch_single($db, $sql, $db->alias);
  if($peer) { $db->uuid($peer->uuid); }
  return $peer;
}



######################################################################
#
# federated peer-2-peer searching/caching
#
######################################################################

sub find_peer {
  my $self = shift;
  my $id_name = shift;
  my $depth = shift;

  if(!defined($id_name)) { return undef; }

  my $network_search_flag = {};
  my $peer = $self->_peer_network_search($id_name, $depth, $network_search_flag);
  if($peer and !($peer->retest_is_valid)) { return undef; }
  return $peer; 
}


=head2 _peer_network_search

  Description: internal method which performs a deep search of the peer-2-peer
               network looking for specified Peer uuid/name
  Returntype : EEDB::Peer or undef
  Exceptions : none

=cut

sub _peer_network_search {
  my $self = shift;
  my $id_name = shift;
  my $depth = shift;
  my $network_search_flag = shift;

  if(!defined($id_name)) { return undef; }
  if(!defined($depth) or ($depth<=0)) { return undef; }

  if($network_search_flag->{$self->uuid}) { return undef; }
  $network_search_flag->{$self->uuid} =1;

  unless($self->test_is_valid) { return undef; }

  if(($self->uuid eq $id_name) or ($self->alias eq $id_name)) { return $self; }

  my $peer = $self->{'_neighbor_peers'}->{$id_name};
  if(defined($peer)) { return $peer; }

  #I am an oscdb so do not bother searching into my peers since I am always a leaf
  if($self->db_url and ($self->db_url =~ /^oscdb/)) { return undef; }

  #tested test next layer down
  my $stream = $self->source_stream;
  unless($stream) { return undef; }
  $self->{'_neighbor_peers'} = {};
  $stream->stream_peers;
  my $next_depth = $self->federation_depth + 1;
  while(my $peer = $stream->next_in_stream) {
    next unless($peer);    
    #if($peer->federation_depth == 0) { $peer->federation_depth($next_depth); }
    if(($peer->federation_depth == 0) or ($next_depth < $peer->federation_depth)) { 
      $peer->federation_depth($next_depth); 
    }

    $self->{'_neighbor_peers'}->{$peer->uuid} = $peer;
    $self->{'_neighbor_peers'}->{$peer->alias} = $peer;
    if(($peer->uuid eq $id_name) or ($peer->alias eq $id_name)) { return $peer; }

    #no need to search inside an oscdb for additional peers
    if($peer->db_url =~ /^oscdb:/) { next; }
    my $found_peer = $peer->_peer_network_search($id_name, $depth-1, $network_search_flag);
    if($found_peer) { 
      return $found_peer; 
    }
  }

  return undef;
}


sub find_peers {
  my $self = shift;
  my $peers = shift;  #hash with id/name in key and undefs in the values
  my $depth = shift;

  if(!defined($peers)) { return undef; }
  my $network_search_flag = {};
  return $self->_multipeer_network_search($peers, $depth, $network_search_flag);
}


sub _multipeer_network_search {
  my $self = shift;
  my $peers = shift;
  my $depth = shift;
  my $network_search_flag = shift;

  if(!defined($peers)) { return undef; }
  if(!defined($depth) or ($depth<=0)) { return undef; }
  if(_multipeer_test_done($peers)) { return 1; }

  if($network_search_flag->{$self->uuid}) { return undef; }
  $network_search_flag->{$self->uuid} =1;

  unless($self->test_is_valid) { return undef; }

  if(_multipeer_add_testdone($peers, $self)) { return 1; } #finished

  #tested test next layer down
  my $stream = $self->source_stream;
  unless($stream) { return undef; }
  $stream->stream_peers;
  my $next_depth = $self->federation_depth + 1;
  while(my $peer = $stream->next_in_stream) {
    next unless($peer);    
    #if($peer->federation_depth == 0) { $peer->federation_depth($next_depth); }
    if(($peer->federation_depth == 0) or ($next_depth < $peer->federation_depth)) { 
      $peer->federation_depth($next_depth); 
    }

    if(_multipeer_add_testdone($peers, $peer)) { return 1; } #finished

    #no need to search inside an oscdb for additional peers
    if($peer->db_url =~ /^oscdb:/) { next; }
    if($peer->_multipeer_network_search($peers, $depth, $network_search_flag)) { return 1; }
  }

  return undef;
}


sub _multipeer_add_testdone {
  my $peers = shift;  #hash of peers to find
  my $peer  = shift;  #peer to check

  unless($peers and $peer) { return 0; }
  if(defined($peers->{$peer->uuid}) and ($peers->{$peer->uuid} == 0)) {
    $peers->{$peer->uuid} = $peer;
    return _multipeer_test_done($peers);
  }
  if(defined($peers->{$peer->alias}) and ($peers->{$peer->alias} == 0)) {
    $peers->{$peer->alias} = $peer;
    return _multipeer_test_done($peers);
  }
  return 0; #not done
}


sub _multipeer_test_done {
  my $peers = shift; #hash of peers to find
  foreach my $peer (values(%{$peers})) {
    if(defined($peer) and ($peer eq 0)) { return 0; }
  }
  return 1;  #yep all found
}


=head2 all_network_peers

  Description: performs a peer-2-peer network search collecting
               all peers into a hash reference with a recursive algorithm
  Returntype : hash reference of peers;
  Exceptions : none

=cut

sub all_network_peers {
  my $self = shift;
  my $depth = shift;
  my $peer_hash = shift;
  
  if(!defined($peer_hash)) { $peer_hash = {}; }
  if(!defined($depth) or $depth<0) { $depth =7; }

  if($peer_hash->{$self->uuid}) { return $peer_hash; }
  unless($self->test_is_valid) { return $peer_hash; }
  unless($self->source_stream) { return $peer_hash; }

  if($self->federation_depth == 0) { $self->federation_depth(1); }
  if($self->federation_depth > $depth) { return $peer_hash; }

  #only place where peer is placed into the hash
  $peer_hash->{$self->uuid} = $self;

  #do not bother searching into oscdb databases for updated peer neighbors
  if($self->db_url and ($self->db_url =~ /oscdb/)) { return $peer_hash; }

  my @new_peers;
  my $stream = $self->source_stream;
  $stream->stream_peers;
  while(my $peer = $stream->next_in_stream) {
    next unless($peer);
    if($peer_hash->{$peer->uuid}) { next; }

    $peer->federation_depth($self->federation_depth + 1);
    push @new_peers, $peer;
  }

  foreach my $peer (@new_peers) {
    $peer->all_network_peers($depth, $peer_hash);
  }
  return $peer_hash;
}




1;

