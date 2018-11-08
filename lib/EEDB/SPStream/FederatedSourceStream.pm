=head1 NAME - EEDB::SPStream::FederatedSourceStream

=head1 DESCRIPTION

  An EEDB::SPStream subclass that functions as a high level SourceStream.
  This class allows a higher level setup using peers, federatedIDs of sources,
  and complex/dynamic source configuration with keyword searching of sources.
  Designed to allow easy configuration of complex mixed source stream with 
  minimal setup or XML description.  
  Will be used in webservices and simply scripting of data in the federation.

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

package EEDB::SPStream::FederatedSourceStream;

use strict;

use EEDB::SPStream::MergeStreams;
use EEDB::SPStream::MultiSourceStream;
use EEDB::SPStream::StreamBuffer;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

###############################################################
# Class methods
###############################################################

sub class { return "EEDB::SPStream::FederatedSourceStream"; }

###############################################################
# 
# initialization and configuration methods
#
###############################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  
  $self->{'_seeding_peers'} = [];
  $self->{'_peer_ids'} = {}; #used internally for filtering and source building
  $self->{'_source_ids'} = {};
  $self->{'_sourcenames'} = {};
  $self->{'_source_keyword_search'} = undef;
  $self->{'_filter_keywords'} = undef;
  $self->{'_known_peers_cache'} = {};

  $self->{'_allow_full_federation_search'} = 1;
  $self->{'_clone_peers_on_build'} = 0;
  $self->{'_peer_search_depth'} = 7;
  $self->{'_debug'} = 0;
  
  return $self;
}

=head2 add_seed_peers

  Description: adds Peer objects to be used for seeding the federated search.
               Search either uses source_ids or "keywords" to generate list of 
               specific sources to feed data into this SourceStream.

=cut

sub add_seed_peers {
  my $self = shift;
  my @peers = @_;

  foreach my $peer (@peers) {
    next unless(defined($peer) && $peer->isa('EEDB::Peer'));
    push @{$self->{'_seeding_peers'}}, $peer;
    $peer->federation_depth(1);
  }
  return $self;
}

=head2 add_source_ids

  Description: add a list of federated source IDS to be used for configuring
               the source stream with specific Experiment and/or FeatureSource

=cut

sub add_source_ids {
  my $self = shift;
  my @ids = @_;

  if(scalar(@ids)) {
    foreach my $id (@ids) { 
      next unless($id);
      if($id =~ /(.+)::(.+):::(.+)/) { 
        $self->{'_peer_ids'}->{$1} = 1;
        $self->{'_source_ids'}->{$id} = 1;
      }
    }
    $self->{'_source_stream'} = undef; #clear old source_stream    
  }
  return $self;
}

=head2 add_peer_ids

  Description: add a list of federated source IDS to be used for configuring
               the source stream with specific Experiment and/or FeatureSource

=cut

sub add_peer_ids {
  my $self = shift;
  my @ids = @_;

  if(scalar(@ids)) {
    foreach my $id (@ids) { 
      next unless($id);
      $self->{'_peer_ids'}->{$id} = 1;
    }
    $self->{'_source_stream'} = undef; #clear old source_stream    
  }
  return $self;
}

=head2 add_source_names

  Description: extend the available sources by searching peers
               for sources matching names in this filter

=cut

sub add_source_names {
  my $self = shift;
  my @names = @_;

  if(scalar(@names)) {
    foreach my $name (@names) { 
      next unless($name);
      $self->{'_sourcenames'}->{$name} = 1;
    }
    $self->{'_source_stream'} = undef; #clear old source_stream    
  }
  return $self;
}


=head2 set_experiment_keyword_filter

  Description: add a keyword filter to further limit the sources
               previously specified by other filters.

=cut

sub set_experiment_keyword_filter {
  my $self = shift;
  my $filter = shift;

  if($filter) {
    $self->{'_filter_keywords'} = $filter;
    $self->{'_source_stream'} = undef; #clear old source_stream        
  }
  return $self;
}


=head2 source_keyword_search

  Description: set/get the keyword search used to dynamically find 
               sources in the federation which are all used for feeding 
               data on this SourceStream. 
               This method is used as replacement for specific configuration
               since it needs to search the entire federation to find all
               possible sources matching keyword pattern and then use
               results to configure the stream for further proccessing.

=cut

sub source_keyword_search {
  my $self = shift;
  if(@_) {
    $self->{'_source_keyword_search'} = shift;
    $self->_configure_from_federation_search;
  }
  return $self->{'_source_keyword_search'};  
}


sub _configure_from_federation_search {
  my $self = shift;

  #clear previous config and rebuild based on keyword searching
  $self->{'_source_stream'} = undef;
  $self->{'_peer_ids'}   = {};
  $self->{'_source_ids'} = {};
  $self->{'_known_peers_cache'} = {};
  $self->{'_sourcenames'} = {};

  #get all peers in federation now that filters are cleared
  my @peers = @{$self->get_peers};
  #printf("searching %d peers\n", scalar(@peers));

  my %options;
  $options{'filter'} = $self->{'_source_keyword_search'};
  foreach my $peer (@peers) {
    my $stream = $peer->source_stream;
    $stream->stream_data_sources(%options);
    while(my $source = $stream->next_in_stream) {
      #next unless(($source->class eq "Experiment") or ($source->class eq "FeatureSource") or ($source->class eq "EdgeSource"));
      #next unless($source->class eq "Experiment");
      next unless(($source->class eq "Experiment") or ($source->class eq "FeatureSource"));
      #printf("found match : %s", $source->simple_xml);
      $self->{'_source_ids'}->{$source->db_id} = 1;
      $self->{'_peer_ids'}->{$peer->uuid} = 1;
    }
  }
    
  #clear the stream again so it is rebuilt
  $self->{'_source_stream'} = undef;

}


sub allow_full_federation_search {
  my $self = shift;
  if(@_) {
    my $value = shift;
    if($value){ $self->{'_allow_full_federation_search'} = 1; }
    else      { $self->{'_allow_full_federation_search'} = 0; }
  }
  return $self->{'_allow_full_federation_search'};
}


sub clone_peers_on_build {
  my $self = shift;
  if(@_) {
    my $value = shift;
    if($value){ $self->{'_clone_peers_on_build'} = 1; }
    else      { $self->{'_clone_peers_on_build'} = 0; }
  }
  return $self->{'_clone_peers_on_build'};
}


#################################################################################
#
# if I need to implement some of the SourceStream API which is not 
# just passed through to $self->source_stream I should do it here

sub sourcestream_output {
  my ($self, $mode) = @_;
  return $self->source_stream->sourcestream_output($mode);
}

sub add_expression_datatype {
  my ($self, $datatype) = @_;
  return $self->source_stream->add_expression_datatype($datatype);
}

#################################################################################

=head2 source_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none 

=cut

sub source_stream {
  my $self = shift;
  $self->SUPER::source_stream(@_);
  if(!defined($self->{'_source_stream'})) {
    $self->_build_source_stream();
  }
  return $self->{'_source_stream'};
}

sub _build_unfiltered_stream {
  my $self = shift;

  my $stream = undef;
  my @peers = @{$self->get_peers};
  
  if($self->{'_clone_peers_on_build'}) {
    my @clones;
    foreach my $peer (@peers) {
      my $clone = $peer->copy();
      push @clones, $clone;
    }
    @peers = @clones;
  }

  #first build the unfiltered stream based on peers
  if(scalar(@peers)==1) {
    $stream = $peers[0]->source_stream;
  } else {
    $stream = new EEDB::SPStream::MultiSourceStream;
    foreach my $peer (@peers) {
      my $stream1 = $peer->source_stream;
      next unless($stream1);
      $stream->add_sourcestream($stream1);
    }
  }
  if($stream) { $stream->clear_all_filters; }
  return $stream;
}


sub _build_source_stream {
  my $self = shift;

  my $stream = $self->_build_unfiltered_stream;  #MultiSourceStream just based on peers
  my $sources = {};
  
  #first get the sources specified by source_id
  if(scalar(%{$self->{'_source_ids'}})) {
    my %options;
    $options{'source_ids'} = [keys(%{$self->{'_source_ids'}})];
    $stream->stream_data_sources(%options);
    while(my $source = $stream->next_in_stream) {
      next if($source->class eq "ExpressionDatatype");
      next unless($self->{'_source_ids'}->{$source->db_id});
      $sources->{$source->db_id} = $source;
    }
  }  

  #then add FeatureSource specified by name
  if(scalar(%{$self->{'_sourcenames'}})) {
    my %options;
    $options{'class'} = "FeatureSource";
    #if(defined($self->{'srcfilter'})) { $options{'filter'} = $self->{'srcfilter'}; }
    $options{'filter_sourcenames'} = $self->{'_sourcenames'};
    $stream->stream_data_sources(%options);
    while(my $source = $stream->next_in_stream) {
      next unless($source);
      next if($source->class eq "ExpressionDatatype");
      $sources->{$source->db_id} = $source;
    }
  }
  
  #last if an expfilter is specified, then apply that as a post filter
  #on the sources specified above.  if no sources above, then it will
  #stream all Experiments from the peers specified in the unfiltered_stream 
  #and apply the logic on those returned Experiments
  if($self->{'_filter_keywords'}) {
    my $exp_count = 0;
    foreach my $source (values(%{$sources})) {
      if($source->class eq "Experiment") { $exp_count++; }
    }
    if($exp_count == 0) {
      #no sources specified meaning need to get from stream
      my %options;
      $options{'filter'} = $self->{'_filter_keywords'};
      $options{'class'} = "Experiment";
      $stream->stream_data_sources(%options);
      while(my $source = $stream->next_in_stream) {
        next unless($source);
        next unless($source->db_id);
        next unless($source->class eq "Experiment");
        $sources->{$source->db_id} = $source;
      }
    } else {
      my $new_sources = {};
      foreach my $source (values(%{$sources})) {
        if($source->class eq "Experiment") {
          if($source->metadataset->check_by_filter_logic($self->{'_filter_keywords'})) {
            $new_sources->{$source->db_id} = $source;
          }
        } else {
          $new_sources->{$source->db_id} = $source;
        }
      }
      $sources = $new_sources;
    }
    #if after filtering there are no sources remaining then create empty MultiSourceStream
    if(scalar(%{$sources})==0) {
      $stream = new EEDB::SPStream::MultiSourceStream;
    }
  }
  
  #apply the source objects to the stream
  my @filter_sources = values(%{$sources});
  foreach my $source (@filter_sources) {
    $stream->add_source_filter($source);
  }

  $self->{'_source_stream'} = $stream;
  return $stream;
}


#
###############################################################
#

sub get_peers {
  my $self = shift;

  my @ps;
  if(scalar(keys(%{$self->{'_peer_ids'}}))>0) {
    #peers hash set up with name/id in keys, and 'O' in values
    #on return if the peer was found the value will point at the Peer object
    my $peers = {};
    foreach my $id (keys(%{$self->{'_peer_ids'}})) {
      $peers->{$id} = 0; #defined but not a Peer
    }
    foreach my $seedpeer (@{$self->{'_seeding_peers'}}) {
      $seedpeer->find_peers($peers, $self->{'_peer_search_depth'});
    }
    foreach my $peer (values(%$peers)) {
      if($peer and ($peer ne 0) and $peer->retest_is_valid) {
        push @ps, $peer;
      }
    }
  } elsif($self->{'_allow_full_federation_search'}) {
    foreach my $seedpeer (@{$self->{'_seeding_peers'}}) {
      $seedpeer->all_network_peers($self->{'_peer_search_depth'}, $self->{'_known_peers_cache'});
    }
    foreach my $peer (values(%{$self->{'_known_peers_cache'}})) {
      if($peer and $peer->retest_is_valid) {
        push @ps, $peer;
      }
    }
  }
  return \@ps;
}


sub _find_peer {
  my $self = shift;
  my $uuid = shift;

  my $peer = $self->{'_known_peers_cache'}->{$uuid};
  if($peer) { return $peer; }
  
  foreach my $seedpeer (@{$self->{'_seeding_peers'}}) {
    if($seedpeer->uuid eq $uuid) { return $seedpeer; }
  }

  foreach my $seedpeer (@{$self->{'_seeding_peers'}}) {
    $peer = $seedpeer->find_peer($uuid, $self->{'_peer_search_depth'});
    if($peer) { 
      if(!$self->{'_known_peers_cache'}->{$peer->uuid}) {
        $self->{'_known_peers_cache'}->{$peer->uuid} = $peer;
      }
      return $peer; 
    }
  }
  return $peer;
}


#
#########################################################
#

=head2 next_in_stream

  Description: return the next object in the stream stack
               depending on the configuration this will either be an on-the-fly created object
               or an object passed through filters, or a primary object streamed out of database/peer
  Returntype : either an EEDB::Feature or EEDB::Expression object or undef if end of stream
  Exceptions : none 

=cut

sub next_in_stream {
  my $self = shift;
  my $stream = $self->source_stream;
  if(!defined($stream)) { return undef; }
  my $obj = $stream->next_in_stream();
  if($obj) { return $obj; }
  if($stream->class eq "EEDB::SPStream::StreamBuffer") {
    $self->{'_source_stream'} = undef;
  }
  return undef;
}


sub stream_peers {
  my $self = shift;
  my %options = @_;
    
  my $streambuffer = new EEDB::SPStream::StreamBuffer;
  $self->source_stream($streambuffer);

  my @peers = @{$self->get_peers};  
  foreach my $peer (@peers) {
    next unless(defined($peer));
    #next unless($peer->test_is_valid);
    #if($peer->test_peer_database_is_valid) { $peer->peer_database->disconnect; }
    if(defined($options{'uuid'}) and ($peer->uuid ne $options{'uuid'})) { next; }
    if(defined($options{'alias'}) and ($peer->alias ne $options{'alias'})) { next; }
    if(defined($options{'name'}) and 
       ($peer->uuid ne $options{'name'}) and ($peer->alias ne $options{'name'})) { next; }
    $streambuffer->add_objects($peer);
  }
}


=head2 fetch_object_by_id

  Description: fetch single object from database
  Arg (1)    : $id (federatedID <uuid>::id:::<class>)
  Returntype : EEDB::Feature
  Exceptions : none 

=cut

sub fetch_object_by_id {
  my $self = shift;
  my $id = shift;

  my $objClass="Feature";
  my $peerUUID="";
  my $objID=$id;
  
  if($id =~ /(.+)::(\d+):::(.+)/) {
    $peerUUID = $1;
    $objID = $2;
    $objClass = $3;
  }
  elsif($id =~ /(.+)::(\d+)/) {
    $peerUUID = $1;
    $objID = $2;
  }

  if(!$peerUUID) { return undef; }
  my $peer = $self->_find_peer($peerUUID);
  unless($peer) { return undef; }
  return $peer->source_stream->fetch_object_by_id($id);
}


=head2 disconnect

  Description: send "disconnect" message to all spstream modules
  Returntype : undef

=cut

sub disconnect {
  my $self = shift;
  if(defined($self->{'_source_stream'})) { 
    $self->{'_source_stream'}->disconnect;
  }
  return undef;
}  


#
###############################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("FederatedSourceStream");
  return $str;
}

sub xml {
  my $self = shift;
  my $str = $self->xml_start() . $self->xml_end();
  return $str;
}

sub xml_start {
  my $self = shift;

  my $str = $self->SUPER::xml_start . "\n";
  
  $str .= "<seed_peers>\n";
  foreach my $peer (@{$self->{'_seeding_peers'}}) { $str .= $peer->xml; }
  $str .= "</seed_peers>\n";
  
  if($self->{'_source_keyword_search'}) {
    $str .= "<configure_keyword_search>";
    $str .= $self->{'_source_keyword_search'};
    $str .= "</configure_keyword_search>\n";
  } else {
    if(scalar(%{$self->{'_peer_ids'}})) {
      $str .= "<peers>";
      foreach my $uuid (keys(%{$self->{'_peer_ids'}})) {
        my $peer = $self->_find_peer($uuid);
        if($peer and $peer->test_is_valid) { $str .= $peer->xml; }
      }
      $str .= "</peers>";
    }
    if(scalar(%{$self->{'_source_ids'}})) {
      $str .= "<source_ids>";
      foreach my $src_id (keys(%{$self->{'_source_ids'}})) { 
        $str .= sprintf("<id>%s</id>", $src_id);
      }
      $str .= "</source_ids>\n";
    }
    if(scalar(%{$self->{'_sourcenames'}})) {
      $str .= "<source_names>";
      foreach my $name (keys(%{$self->{'_sourcenames'}})) { 
        $str .= sprintf("<name>%s</name>", $name);
      }
      $str .= "</source_names>\n";
    }
  }
  return $str;
}


1;
