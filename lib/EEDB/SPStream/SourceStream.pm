=head1 NAME - EEDB::SPStream::SourceStream

=head1 DESCRIPTION

A wrapper around a stream generated from a set of FeatureSources
which is used as input to a signal-processing stack

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

package EEDB::SPStream::SourceStream;

use strict;

use EEDB::Feature;
use EEDB::Expression;
use EEDB::ExpressionDatatype;
use EEDB::Peer;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::SourceStream"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_database'} = undef;
  $self->{'_peer'} = undef;
  $self->{'_sourcestream_output'} = "feature";
  $self->{'_featuresource_array'} = undef;
  $self->{'_edgesource_array'} = undef;
  $self->{'_experiment_array'} = undef;
  $self->{'_expression_datatype_array'} = undef;
  $self->{'_assembly_stream_chroms'} = [];
  $self->{'_sources_cache'} = {};
  $self->{'_peers_cache'} = undef;
  $self->{'_sources_class_count'} = {};
  $self->{'_sources_cache_last_reload'} = undef;
  $self->{'_sources_cache_next_update'} = undef;
  $self->{'_filter_source_ids'} = undef;
  $self->{'_source_is_active'} = 1;
  return $self;
}

sub new_from_url {
  my $class = shift;
  my $url = shift;

  #my $stream1  = new EEDB::SPStream::SourceStream();
  #$stream1->sourcestream_output("expression");
  #$stream1->add_named_feature_source("solexaCAGE_tagmap_I46-DA,solexaCAGE_tagmap_I47-DA,solexaCAGE_tagmap_I48-DA");
  #$stream1->add_expression_datatype("mapnorm_tagcnt");
  #$stream1->add_named_experiments("I46-DA_2706-67E8,I46-DA_2707-67F8,I46-DA_2708-67G8,I47-DA_2706-67F1,I47-DA_2707-67G1,I47-DA_2708-67H1,I48-DA_2706-67I1,I48-DA_2707-67A2,I48-DA_2708-67B2");
    
  my $self = $class->new;
  my $peer = EEDB::Peer->fetch_self_from_url($url);
  $self->peer($peer);
  return $self;
}

sub peer {
  my $self = shift;
  my $peer = shift;
  
  if($peer) {
    unless(defined($peer) && $peer->isa('EEDB::Peer')) {
      die('peer param must be a EEDB::Peer');
    }
    $self->{'_peer'} = $peer;
    $self->{'_database'} = $peer->peer_database;
  }
  return $self->{'_peer'};
}

sub database {
  my $self = shift;
  my $db = shift;
  if(defined($db)) {
    if(!($db->isa('MQdb::Database'))) { die("$db is not a MQdb::Database"); }
    if($self->{'_database'}) {
      if($db ne $self->{'_database'}) {
        #die("ERROR using multiple databases on one SourceStream is not currently allowed");
      }
    } else {
      $self->{'_database'} = $db;
      if($db->uuid) {
        $self->{'_peer'} = EEDB::Peer->fetch_by_name($db, $db->uuid);
      }
    }
  }
  return $self->{'_database'};
}

sub uuid {
  my $self = shift;
  if($self->peer) { return $self->peer->uuid; }
  if($self->database) { return $self->database->uuid; }
  return undef;
}

sub sourcestream_output {
  my ($self, $mode) = @_;
  if($mode) {
    if(lc($mode) eq "subfeature") { $self->{'_sourcestream_output'} = "subfeature"; }
    if(lc($mode) eq "simple_feature") { $self->{'_sourcestream_output'} = "simple_feature"; }
    if(lc($mode) eq "feature") { $self->{'_sourcestream_output'} = "feature"; }
    if(lc($mode) eq "full_feature") { $self->{'_sourcestream_output'} = "feature"; }
    if(lc($mode) eq "express") { $self->{'_sourcestream_output'} = "express"; }
    if(lc($mode) eq "expression") { $self->{'_sourcestream_output'} = "express"; }
    if(lc($mode) eq "edge") { $self->{'_sourcestream_output'} = "edge"; }    
  }
  return $self->{'_sourcestream_output'};
}

sub add_expression_datatype {
  my ($self, $datatype) = @_;
  return unless(defined($datatype));
  push @{$self->{'_expression_datatype_array'}}, $datatype;
  return $self;
}

sub add_source_filter {
  my ($self, $source) = @_;
  return unless(defined($source));
  $self->{'_filter_source_ids'}->{$source->db_id} = 1;

  if($source->class eq 'FeatureSource') { $self->add_feature_source($source); }
  if($source->class eq 'Experiment') { $self->add_experiment($source); }
  if($source->class eq 'EdgeSource') { $self->add_edge_source($source); }

  unless($self->{'_featuresource_array'} or $self->{'_edgesource_array'} or $self->{'_experiment_array'}) {
    $self->{'_source_is_active'} = 0;
  }
  return $self;
}  

sub add_feature_source {
  my ($self, $source) = @_;
  return unless(defined($source));
  return unless($source->isa('EEDB::FeatureSource'));
  return unless($source->peer_uuid eq $self->uuid);
  push @{$self->{'_featuresource_array'}}, $source;
  $self->{'_source_is_active'} = 1;
  return $self;
}  

sub add_edge_source {
  my ($self, $source) = @_;
  return unless(defined($source));
  return unless($source->isa('EEDB::EdgeSource'));
  return unless($source->peer_uuid eq $self->uuid);
  push @{$self->{'_edgesource_array'}}, $source;
  $self->{'_source_is_active'} = 1;
  return $self;
}  

sub add_named_feature_source {
  my $self = shift;
  my $fsrc_names = shift;
  
  unless($fsrc_names and $self->database) {
    die('ERROR:: add_named_feature_source requires set database and a list of names');
  }
  foreach my $name (split(/,/, $fsrc_names)) {
    my $fsrc = EEDB::FeatureSource->fetch_by_name($self->database, $name);
    if($fsrc) {
      $self->add_feature_source($fsrc);
    }
  }
}

sub add_experiment {
  my ($self, $experiment) = @_;
  return unless(defined($experiment));
  return unless($experiment->isa('EEDB::Experiment'));
  return unless($experiment->peer_uuid eq $self->uuid);
  push @{$self->{'_experiment_array'}}, $experiment;
  $self->{'_source_is_active'} = 1;
  return $self;
}  

sub add_named_experiments {
  my ($self, $exp_names) = @_;
  unless($exp_names and $self->database) {
    die('ERROR:: add_named_experiment requires set database and a list of names');
  }
  foreach my $name (split(/,/, $exp_names)) {
    my $exp = EEDB::Experiment->fetch_by_exp_accession($self->database, $name);
    if($exp) {
      $self->add_experiment($exp);
    }
  }  
}  

sub clear_all_filters {
  my $self = shift;
  
  $self->{'_filter_source_ids'} = undef;
  $self->{'_source_is_active'} = 1;
  $self->{'_featuresource_array'} = undef;
  $self->{'_experiment_array'} = undef;
  $self->{'_expression_datatype_array'} = undef;
  $self->{'_assembly_stream_chroms'} = [];
  $self->source_stream(undef); #clears the stream
  return $self;
}

#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################

=head2 stream_clear

  Description: re-initialize the stream-stack back to a clear/empty state
  Returntype : undef;
  Exceptions : none 

=cut

sub stream_clear {
  my $self = shift;
  $self->_reset_stream;

  $self->{'_assembly_stream_chroms'} = [];
  $self->source_stream(undef); #clears the stream
  return undef;
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

  unless($self->{'_source_is_active'}) { return undef; }

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
  if($peerUUID and $self->uuid and ($peerUUID ne $self->uuid)) {
    if($self->source_stream) {
      return $self->source_stream->fetch_object_by_id($id);
    } else { return undef; }
  }

  if($objClass eq "Feature")       { return EEDB::Feature->fetch_by_id($self->database, $objID); }
  if($objClass eq "Experiment")    { return EEDB::Experiment->fetch_by_id($self->database, $objID); }
  if($objClass eq "FeatureSource") { return EEDB::FeatureSource->fetch_by_id($self->database, $objID); }
  if($objClass eq "EdgeSource")    { return EEDB::EdgeSource->fetch_by_id($self->database, $objID); }
  if($objClass eq "Edge")          { return EEDB::Edge->fetch_by_id($self->database, $objID); }
  if($objClass eq "Expression")    { return EEDB::Expression->fetch_by_id($self->database, $objID); }
  if($objClass eq "Symbol")        { return EEDB::Symbol->fetch_by_id($self->database, $objID); }
  if($objClass eq "Metadata")      { return EEDB::Metadata->fetch_by_id($self->database, $objID); }
  if($objClass eq "Chrom")         { return EEDB::Chrom->fetch_by_id($self->database, $objID); }
  if($objClass eq "Assembly")      { return EEDB::Assembly->fetch_by_id($self->database, $objID); }

  return undef;
}

=head2 stream_features_by_metadata_search

  Description: perform search of features through metadata filter logic
  Arg (1)    : %options_hash : available optional parameters
               'keyword_list' => <string> :: a comma separated list of metadata keywords, returns merged list
               'filter' => <string> :: string is a keyword/logic string which is applied to the metadata
  Returntype : undef
  Exceptions : none 

=cut

sub stream_features_by_metadata_search {
  my $self = shift;
  my %options = @_;

  unless($self->{'_source_is_active'}) { $self->source_stream(undef);  return undef; }

  my $streambuffer = new EEDB::SPStream::StreamBuffer;
  $self->source_stream($streambuffer);

  my @src_filter;
  if($self->{'_featuresource_array'}) { 
    @src_filter = @{$self->{'_featuresource_array'}};
    $options{'sources'} = $self->{'_featuresource_array'}; 
  }

  #filter logic idea:: take the filter logic and generate a keyword list
  #which will generate a superset of features, 
  #then apply the actual filter logic to perform a refined filter
  
  my @keywords;
  my $uniq_features = {};

  if($options{'keyword_list'}) {
    my @names = split(/[,\s]/, $options{'keyword_list'});
    push @keywords, @names;
    foreach my $name (@keywords) {
      next unless($name);
      my $t_features = [];
      if($name =~ /^primary_name\:\:(.+)/) {
        $t_features = EEDB::Feature->fetch_all_by_primary_name($self->database, $1, @src_filter);
      } elsif($name =~ /^(.+)\:\:(.+)/) {
        $t_features = EEDB::Feature->fetch_all_by_symbol($self->database, $1, $2, %options);    
      } else {
        $t_features = EEDB::Feature->fetch_all_symbol_search($self->database, $name, undef, undef, @src_filter);
      }
      foreach my $tfeat (@$t_features) {
        next unless($tfeat->feature_source->is_active eq 'y');
        $uniq_features->{$tfeat->db_id} = $tfeat;
      }
    }
  }
  
  if($options{'filter'}) {
    my $filter = $options{'filter'};
    my @or_phrases = split (/\s+or\s+/, $filter);
    foreach my $or_block (@or_phrases) {
      $or_block =~ s/\s+and\s+/ /g;
      #$filter =~ s/[\(\)]/ /g;
      my @names = split(/[,\s]/, $or_block);
      
      #use the counting system to pick the keyword with the lowest count
      #to reduce the search overhead
      my $best_name = undef;
      my $best_count = -1;
      foreach my $name (@names) {
        next unless($name);
        my $sym = $name;
        if($name =~ /^(.+)\:\:(.+)/) { $sym = $2; }
        if(!$sym or (length($sym) < 3)) { next; }
        my $like_count = EEDB::Feature->get_count_symbol_search($self->database, $sym ."%");
        if(!defined($best_name) or ($like_count < $best_count)) {
          $best_name = $name;
          $best_count = $like_count;
        }
      }
      if(!defined($best_name)) { next; }
        
      my $t_features = [];
      if($best_name =~ /^primary_name\:\:(.+)/) {
        $t_features = EEDB::Feature->fetch_all_by_primary_name($self->database, $1, @src_filter);
      } elsif($best_name =~ /^(.+)\:\:(.+)/) {
        $t_features = EEDB::Feature->fetch_all_by_symbol($self->database, $1, $2, %options);    
      } else {
        $t_features = EEDB::Feature->fetch_all_symbol_search($self->database, $best_name, undef, undef, @src_filter);
      }
      foreach my $tfeat (@$t_features) {
	next unless($tfeat and $tfeat->feature_source);
        next unless($tfeat->feature_source->is_active eq 'y');
        if(((scalar(@names) > 1) or (scalar(@or_phrases) > 1)) and
           !($tfeat->metadataset->check_by_filter_logic($options{'filter'}))) { next; }
        $uniq_features->{$tfeat->db_id} = $tfeat;
      }
    }
  }
  
  foreach my $tfeat (values(%{$uniq_features})) {
    $streambuffer->add_objects($tfeat);
  }
  
  return undef;
}


=head2 stream_by_named_region

  Description: stream all Features from a specific region on a genome
  Arg (1)    : $assembly_name (string)
  Arg (2)    : $chrom_name (string)
  Arg (3)    : $chrom_start (integer)
  Arg (4)    : $chrom_end (integer)
  Returntype : $self
  Exceptions : none 

=cut

sub stream_by_named_region {
  my $self = shift;
  my $assembly_name = shift;
  my $chrom_name = shift;
  my $chrom_start = shift;
  my $chrom_end = shift;

  unless($self->{'_source_is_active'}) { $self->source_stream(undef);  return undef; }

  my %options;
  if($self->{'_experiment_array'}) { $options{'experiments'} = $self->{'_experiment_array'}; }
  if($self->{'_featuresource_array'}) { $options{'sources'} = $self->{'_featuresource_array'}; }
  if($self->{'_expression_datatype_array'}) { $options{'datatypes'} = $self->{'_expression_datatype_array'}; }
  my $stream = undef;
  if($self->sourcestream_output eq 'express') {
    $stream = EEDB::Expression->stream_by_named_region(
                     $self->database,
                     $assembly_name,
                     $chrom_name,
                     $chrom_start,
                     $chrom_end,
                     %options);
  }
  if($self->sourcestream_output =~ /feature/) {
    $stream = EEDB::Feature->stream_by_named_region(
                     $self->database,
                     $assembly_name,
                     $chrom_name,
                     $chrom_start,
                     $chrom_end,
                     %options);
  }                     
  $self->source_stream($stream);
  return $self;
}


sub stream_by_chrom {
  my $self = shift;
  my $chrom = shift;  #EEDB::Chrom object

  return undef unless($chrom and $chrom->isa("EEDB::Chrom"));
  unless($self->{'_source_is_active'}) { $self->source_stream(undef); return undef; }
  
  my %options;
  if($self->{'_experiment_array'}) { $options{'experiments'} = $self->{'_experiment_array'}; }
  if($self->{'_featuresource_array'}) { $options{'sources'} = $self->{'_featuresource_array'}; }
  if($self->{'_expression_datatype_array'}) { $options{'datatypes'} = $self->{'_expression_datatype_array'}; }

  my $stream = undef;
  if($self->sourcestream_output eq 'express') {
    $stream = EEDB::Expression->stream_by_chrom(
                     $chrom,
                     %options);
  }
  if($self->sourcestream_output =~ /feature/) {
    $stream = EEDB::Feature->stream_by_chrom(
                     $chrom,
                     %options);
  }                     
  $self->source_stream($stream);
  return $self;
}


=head2 stream_chromosomes

  Description: streams Assembly and Chrom (chromosomes) out of database
  Arg (1)    : %options_hash : available optional parameters
               'asm' => <string> :: only stream to specified assembly name
  Returntype : $self
  Exceptions : none 

=cut

sub stream_chromosomes {
  my $self = shift;
  my %options = @_;
  
  unless($self->{'_source_is_active'}) { $self->source_stream(undef);  return undef; }

  my $streambuffer = new EEDB::SPStream::StreamBuffer;
  $self->source_stream($streambuffer);

  my $eeDB = $self->database;

  my $chroms = [];
  if(defined($options{'asm'})) {
    $chroms = EEDB::Chrom->fetch_all_by_assembly_name($eeDB, $options{'asm'});
  } else {
    $chroms = EEDB::Chrom->fetch_all($eeDB);
  }
  $streambuffer->add_objects(@$chroms);
  $eeDB->disconnect;
  return $self
}

sub stream_all {
  my $self = shift;

  unless($self->{'_source_is_active'}) { $self->source_stream(undef);  return undef; }

  my %options;
  if($self->{'_experiment_array'}) { $options{'experiments'} = $self->{'_experiment_array'}; }
  if($self->{'_featuresource_array'}) { $options{'sources'} = $self->{'_featuresource_array'}; }
  if($self->{'_expression_datatype_array'}) { $options{'datatypes'} = $self->{'_expression_datatype_array'}; }
  
  my $stream = undef;
  if($self->sourcestream_output eq 'express') {
    $stream = EEDB::Expression->stream_all(
                     $self->database, 
                     %options);
  }
  if($self->sourcestream_output =~ /feature/) {
    $stream = EEDB::Feature->stream_all(
                     $self->database, 
                     %options);
  }
  if($self->sourcestream_output eq 'edge') {
    $stream = EEDB::Edge->stream_all(
                     $self->database, 
                     %options);
  }
            
  $self->source_stream($stream);
  return $self;
}

=head2 stream_data_sources

  Description: stream all sources(FeatureSource, EdgeSource, and Experiment) out of database
  Arg (1)    : %options_hash : available optional parameters
               'class' => <string> ['FeatureSource' | 'Experiment' | 'ExpressionDatatype' ]
               'filter' => <string> :: string is a keyword/logic string which is applied to the metadata
               'source_ids' => [dbid, dbid, ...] :: array reference of dbIDs
  Returntype : $self
  Exceptions : none 

=cut


sub stream_data_sources {
  my $self = shift;
  my %options = @_;
  
  unless($self->{'_source_is_active'}) { $self->source_stream(undef);  return undef; }

  my $streambuffer = new EEDB::SPStream::StreamBuffer;
  $self->source_stream($streambuffer);

  #if specific source dbIDs are specified, only those sources are allowed
  if(defined($options{'source_ids'})) {
    my @source_ids = @{$options{'source_ids'}};
    $options{'src_id_hash'} = {};
    foreach my $dbid (@source_ids) { $options{'src_id_hash'}->{$dbid} = 1; }
  }    
  
  $self->reload_stream_data_sources();
 
  my @sources = values(%{$self->{'_sources_cache'}});

  foreach my $source (@sources) {
    #if global filter source_ids are set, check those
    if(defined($self->{'_filter_source_ids'}) and !($self->{'_filter_source_ids'}->{$source->db_id})) { next; }

    #if specific filter source_ids are specified, only those sources are allowed
    if(defined($options{'src_id_hash'}) 
       and !defined($options{'src_id_hash'}->{$source->db_id})) { next; }

    #if specific filter names are specified, only those sources are allowed
    if(defined($options{'filter_sourcenames'}) 
       and ($source->class eq "FeatureSource")
       and !defined($options{'filter_sourcenames'}->{$source->name})) { next; }

    if(defined($options{'filter_category'}) 
       and ($source->class eq "FeatureSource")
       and !defined($options{'filter_category'}->{$source->category})) { next; }

    #if it passed previous filters, and filter-logic is specified, check it next
    if(defined($options{'filter'}) 
       and (($source->class eq "Experiment") or ($source->class eq "FeatureSource") or ($source->class eq "EdgeSource"))
       and !($source->metadataset->check_by_filter_logic($options{'filter'}))) { next; }
       
    #last apply class filter
    if(defined($options{'class'}) and 
      ($options{'class'} ne "ExpressionDatatype") and
      ($source->class ne $options{'class'})) { next; }

    #OK passed filters so add to the stream buffer
    $streambuffer->add_objects($source);

    #if it is Experiment or FeatureSource then 
    #also add the source-specific ExpressionDatatype(s) to the stream
    if(($source->class eq "Experiment") or ($source->class eq "FeatureSource")) {
      my $dtypes = $source->expression_datatypes;
      $streambuffer->add_objects(@$dtypes);
    }
  }

  return $self
}


sub reload_stream_data_sources {
  my $self = shift;
  my %options = @_;
  
  if(defined($self->{'_sources_cache_last_reload'})) { return; } 
 #if(defined($self->{'_sources_cache_next_update'}) and (time() < $self->{'_sources_cache_next_update'})) { return; }
 #if(defined($self->{'_sources_cache_next_update'})) { return; } 
  #print("reload_stream_data_sources\n");

  my $eeDB = $self->database;

  #clear old cache
  $self->{'_sources_cache'} = {};
  $self->{'_sources_class_count'} = {};

  #if class is defined as filter option, it is a hard filter, only those matching class are allowed
  my $exps      = EEDB::Experiment->fetch_all($eeDB);
  my $fsrcs     = EEDB::FeatureSource->fetch_all($eeDB);
  my $esrcs     = EEDB::EdgeSource->fetch_all($eeDB);
  my $datatypes = EEDB::ExpressionDatatype->fetch_all($eeDB);
  my @sources   = (@$fsrcs, @$esrcs, @$exps, @$datatypes);
  #printf("fetched %d sources\n", scalar(@sources));

  foreach my $source (@sources) {
    next unless(defined($source));
    next unless($source->is_active eq 'y');
    if($self->{'_sources_cache'}->{$source->db_id}) {
      $source = $self->{'_sources_cache'}->{$source->db_id};
    } else {
      $self->{'_sources_cache'}->{$source->db_id} = $source;
      $self->{'_sources_class_count'}->{$source->class} += 1;
    }  
    if($source->class ne "ExpressionDatatype") {
      $source->{'metadataset'} = undef; #flushes old metadata
      #but do not load metadata at this time, do it later when needed
    }
  }
  $eeDB->disconnect;
  
  #next update is mimumum of 8 hours with a random component of up to an additional 3 hours
  $self->{'_sources_cache_next_update'} = time() + 48*3600 + int(rand(12*3600));
  $self->{'_sources_cache_last_reload'} = time();
  #printf("loaded %d source for peer %s\n", scalar(keys(%{$self->{'_sources_cache'}})), $self->database->uuid);

  return $self
}


sub cache_sources {
  my $self = shift;
  return $self->{'_sources_cache'};
}


sub free_sources_cache {
  my $self = shift;
  $self->{'_sources_cache_next_update'} = undef;
  $self->{'_sources_cache_last_reload'} = undef;
  $self->{'_sources_class_count'} = {};

  my @sources = values(%{$self->{'_sources_cache'}});
  foreach my $source (@sources) {
    $source->global_uncache;
  }
  $self->{'_sources_cache'} = {};
}



########################################################################################################

=head2 stream_peers

  Description: stream all known peers from database
  Arg (1)    : %options_hash : available optional parameters
               'uuid' => <string> :: filter for specific peer UUID
               'alias' => <string> :: filter for specific peer alias/name
  Returntype : $self
  Exceptions : none 

=cut

sub stream_peers {
  my $self = shift;
  my %options = @_;
    
  unless($self->{'_source_is_active'}) { $self->source_stream(undef);  return undef; }

  my $streambuffer = new EEDB::SPStream::StreamBuffer;
  $self->source_stream($streambuffer);
  
  $self->{'_peers_cache'} = {};
  my $eeDB  = $self->database;
  my $peers = EEDB::Peer->fetch_all($eeDB);
  foreach my $peer (@$peers) {
    $self->{'_peers_cache'}->{$peer->uuid} = $peer;
  }
  $eeDB->disconnect;

  foreach my $peer (values(%{$self->{'_peers_cache'}})) {
    next unless(defined($peer));
    if(defined($options{'uuid'}) and ($peer->uuid ne $options{'uuid'})) { next; }
    if(defined($options{'alias'}) and ($peer->alias ne $options{'alias'})) { next; }
    if(defined($options{'name'}) and 
       ($peer->uuid ne $options{'name'}) and ($peer->alias ne $options{'name'})) { next; }
    #don't check valid here since we need this method to do fast searches of federation
    #do the valid check outside
    $streambuffer->add_objects($peer);
  }

  return $self;
}

#
####################################################
#

=head2 next_in_stream

  Description: since this is a source, it needs to override this method and 
               do appropriate business logic to control the stream.
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

=cut

sub next_in_stream {
  my $self = shift;
  if(!defined($self->source_stream)) { return undef; }

  my $obj = $self->source_stream->next_in_stream;
  while(!defined($obj) and @{$self->{'_assembly_stream_chroms'}}) {
    my $chrom = shift @{$self->{'_assembly_stream_chroms'}};
    printf("reset chrom:: %s\n", $chrom->display_desc) if($self->{'debug'});
    $self->stream_by_chrom($chrom);
    if(!defined($self->source_stream)) { return undef; }
    $obj = $self->source_stream->next_in_stream;
  }
  #if no more objects then clear the source_stream()
  if(!defined($obj)) { $self->source_stream(undef); }
  return $obj;
}

=head2 disconnect

  Description: send "disconnect" message to source database
  Returntype : undef

=cut

sub disconnect {
  my $self = shift;
  if(defined($self->database)) { $self->database->disconnect; }
  return undef;
}


#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("SourceStream");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = $self->SUPER::xml_start . "\n";
  
  if($self->peer) { $str .= $self->peer->xml; }  
  $str .= sprintf("<sourcestream_output value=\"%s\"/>\n", $self->sourcestream_output);
  
  if($self->{'_expression_datatype_array'}) {
    $str .= "<expression_datatypes value=\"";
    $str .= join(",", @{$self->{'_expression_datatype_array'}});
    $str .= "\" />\n";
  }
  
  if($self->{'_featuresource_array'}) {
    foreach my $fsrc (@{$self->{'_featuresource_array'}}) { $str .= $fsrc->simple_xml; }
  }
  
  if($self->{'_experiment_array'}) {
    foreach my $fsrc (@{$self->{'_experiment_array'}}) { $str .= $fsrc->simple_xml; }
  }

  return $str;
}


#does not implement _init_from_xmltree() since this consitutes a security leak

1;

