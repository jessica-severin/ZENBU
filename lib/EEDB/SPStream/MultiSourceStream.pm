=head1 NAME - EEDB::SPStream::MultiSourceStream

=head1 DESCRIPTION

a variation on MergeStream, but designed to be a primary source made up of many
component databases (for example a collection of OSCFileDB). Allows one to 
create virtual databases made up of component databases.

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

package EEDB::SPStream::MultiSourceStream;

use strict;

use EEDB::Database;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::MultiSourceStream"; }


#################################################
# 
# initialization and configuration methods
#
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  
  $self->{'_sourcestreams'} = []; 
  #array of hashes hashes holding all information on each source
  
  $self->{'_sourcestream_output'} = "feature";
  $self->{'debug'} = 0;
  
  my %options = @args;
  if($options{'source'}) { $self->source_stream($options{'source'}); }
  if($options{'side'}) { $self->side_stream($options{'side'}); }
  return $self;
}


=head2 add_source_filter

  Description: sets filters based on FeatureSource, EdgeSource, or Experiment objects
  Exceptions : none

=cut

sub add_source_filter {
  my $self = shift;
  my $source = shift;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->add_source_filter($source);
  }
  return $self;
}

sub add_expression_datatype {
  my ($self, $datatype) = @_;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->add_expression_datatype($datatype);
  }
  return $self;
}

sub add_feature_source {
  my ($self, $source) = @_;
  return unless(defined($source));
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->add_feature_source($source);
  }
  return $self;
}  

sub add_experiment {
  my ($self, $experiment) = @_;
  return unless(defined($experiment));
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->add_experiment($experiment);
  }
  return $self;
}  

=head2 source_stream

  Description: MultiSourceStream does not use ->source_stream since it is designed to be a leaf
               of a processing tree. Use add_sourcestream() method instead to define a colletion
               of sources. Override to do nothing.
  Exceptions : none 

=cut

sub source_stream {
  my $self = shift;
  return undef;
}


sub add_sourcestream {
  my $self = shift;
  my $db = shift;
  if(defined($db)) {
    if(!($db->isa('EEDB::SPStream::SourceStream'))) { 
      print(STDERR "$db is not a EEDB::SPStream::SourceStream\n");
      return;
    }
    if($db->uuid) {
      push @{$self->{'_sourcestreams'}}, {'sourcestream' => $db, "colID"=>scalar(@{$self->{'_sourcestreams'}}) };
    }
  }
  return $self;
}


sub sourcestream_output {
  my ($self, $mode) = @_;
  if($mode) {
    if(lc($mode) eq "simple_feature") { $self->{'_sourcestream_output'} = "simple_feature"; }
    if(lc($mode) eq "feature") { $self->{'_sourcestream_output'} = "feature"; }
    if(lc($mode) eq "express") { $self->{'_sourcestream_output'} = "express"; }
    if(lc($mode) eq "expression") { $self->{'_sourcestream_output'} = "express"; }
    if(lc($mode) eq "edge") { $self->{'_sourcestream_output'} = "edge"; }    
  }
  return $self->{'_sourcestream_output'};
}

sub clear_all_filters {
  my $self = shift;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->clear_all_filters;
  }  
  return $self;
}

sub _configure_filters {
  my $self = shift;
  
  $self->{'_active_streams'} = undef;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    #first reset filters on each source
    $sshash->{"_current_object"} = undef;
    $sshash->{'_input_stream_count'} = 0;
    $sshash->{'_stream_empty'} = 0;
    
    #reconfigure output
    $sshash->{'sourcestream'}->sourcestream_output($self->sourcestream_output);
  }  
}

#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################


sub display_desc {
  my $self = shift;
  my $str = sprintf("MultiSourceStream");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = sprintf("<spstream module=\"%s\" >\n", $self->class);
  $str .= sprintf("<sourcestream_output value=\"%s\"/>\n", $self->sourcestream_output);

  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $str .= "<stream_source>\n";
    $str .= $sshash->{'sourcestream'}->xml;
    $str .= "</stream_source>\n";
  }
  return $str;
}


sub _init_from_xmltree {
  my $self = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  unless($xmlTree->{'-module'} eq "EEDB::SPStream::MultiSourceStream") { return undef; }
  
  if($xmlTree->{'sourcestream_output'}) {
    $self->sourcestream_output($xmlTree->{'sourcestream_output'}->{'-value'});
  }  

  if($xmlTree->{'stream_source'}) {
    my $sources = $xmlTree->{'stream_source'};
    unless($sources =~ /ARRAY/) { $sources = [$sources]; }
    foreach my $sourceTree (@$sources) {
      my ($head,$tail) = EEDB::SPStream->create_stream_from_xmltree($sourceTree);
      if($head) { $self->add_sourcestream($head); }
    }  
  }
  return $self;
}


###############################################################
#
# variation on MergeStreams
#
###############################################################

=head2 fetch_object_by_id

  Description: fetch single feature object from database
               overrides super class method
  Arg (1)    : $id (integer)
  Returntype : EEDB::Feature
  Exceptions : none 

=cut

sub fetch_object_by_id {
  my $self = shift;
  my $id = shift;
  
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    my $obj = $sshash->{'sourcestream'}->fetch_object_by_id($id);
    if($obj) { return $obj; }
  }
  return undef;
}


=head2 next_in_stream

  Description: return the next object in the stream stack
               depending on the configuration this will either be an on-the-fly created object
               or an object passed through filters, or a primary object streamed out of database/peer
  Returntype : either an EEDB::Feature or EEDB::Expression object or undef if end of stream
  Exceptions : none 

=cut

sub next_in_stream {
  my $self = shift;
  
  $self->_init_active_streams;
  
  my $head_sshash = $self->{'_active_streams'}->[0];
  if(!defined($head_sshash)) { 
    $self->{'_active_streams'} = undef;
    return undef; 
  }

  my $next_obj = $head_sshash->{"_current_object"};
  
  $head_sshash->{"_current_object"} = $head_sshash->{'sourcestream'}->next_in_stream;
  unless($head_sshash->{"_current_object"}) { 
    $head_sshash->{'_stream_empty'}=1;
    shift @{$self->{'_active_streams'}}; #shift the empty stream off the active stream list
    return $next_obj;
  }
  $head_sshash->{'_input_stream_count'}++;

  #now resort the active streams so that next time the head stream is correct
  #my @sortstreams = sort _compare_active_streams @{$self->{'_active_streams'}};
  $self->_resort_active_streams();

  return $next_obj;
}


sub _resort_active_streams {
  my $self = shift;
  
  #just need to move the head [0] element by insert-sort.
  my $streams = $self->{'_active_streams'};
  my $head_sshash = $self->{'_active_streams'}->[0];

  for(my $i=1; $i<scalar(@$streams); $i++) {
    my $sshash = $streams->[$i];
    if(_compare_active_streams($head_sshash, $sshash) <= 0) { 
      last; #in correct location
    }
    #else need to readjust
    $streams->[$i-1] = $sshash;
    $streams->[$i]   = $head_sshash;
  }  
}


sub _compare_active_streams {
  my $sshash1 = shift;
  my $sshash2 = shift;

  my $obj1 = $sshash1->{"_current_object"};
  my $obj2 = $sshash2->{"_current_object"};
  
  if(!defined($obj1) and !defined($obj2)) { return 0; }  #both undef then equal
  if(!defined($obj1)) { return 1; }  #choose obj2
  if(!defined($obj2)) { return -1; } #choose obj1

  #non-Feature before features
  my $obj1_is_feat=0;
  my $obj2_is_feat=0;
  if(($obj1->class eq "Feature") or ($obj1->class eq "Expression")) { $obj1_is_feat=1; }
  if(($obj2->class eq "Feature") or ($obj2->class eq "Expression")) { $obj2_is_feat=1; }
  if(!$obj1_is_feat and !$obj2_is_feat) { return 0; } #no sort order for non-features
  if(!$obj1_is_feat and $obj2_is_feat) { return -1; } #choose 1
  if($obj1_is_feat and !$obj2_is_feat) { return 1; } #choose 2
  
  if(!defined($obj1->chrom) and !defined($obj2->chrom)) { return 0; }
  if(!defined($obj1->chrom) and defined($obj2->chrom)) { return -1; }
  if(defined($obj1->chrom) and !defined($obj2->chrom)) { return 1; }
    
  # merge function
  # for expression ::   ORDER BY chrom_start, chrom_end, fe.feature_id, experiment_id, datatype
  # for feature    ::   ORDER BY chrom_start, chrom_end, feature_id
  # chrom order not guaranteed, could be sorted by name or size. 
  #    chrom just guaranteed that all chrom objects grouped together
  
  if($obj1->chrom_name ne $obj2->chrom_name) { 
    return ($obj1->chrom_name cmp $obj2->chrom_name);
  } 
   
  if($obj1->chrom_start < $obj2->chrom_start) { return -1; } 
  if($obj1->chrom_start > $obj2->chrom_start) { return 1; } 

  if($obj1->chrom_end < $obj2->chrom_end) { return -1; } 
  if($obj1->chrom_end > $obj2->chrom_end) { return 1; } 

  return 0;

  #effectively equal at this point, do not really need to do the next checks

  my $id1 = $obj1->id;
  my $id2 = $obj2->id;
  if($obj1->class eq "Expression") { $id1 = $obj1->feature->id; }
  if($obj2->class eq "Expression") { $id2 = $obj2->feature->id; }
  if($id1 lt $id2) { return -1; } 
  if($id1 gt $id2) { return 1; } 
 
  if(($obj1->class eq 'Expression') and ($obj2->class eq 'Expression')) {

    if($obj1->experiment->id lt $obj2->experiment->id) { return -1; } 
    if($obj1->experiment->id gt $obj2->experiment->id) { return 1; } 

    if($obj1->type lt $obj2->type) { return -1; } 
    if($obj1->type gt $obj2->type) { return 1; } 
  }

  return 0; # same, equals
}


sub _init_active_streams {
  my $self = shift;

  if(defined($self->{'_active_streams'})) { return; }
  
  $self->{'_active_streams'} = []; 
  my @streams; 
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    unless($sshash->{"_current_object"}) {
      $sshash->{"_current_object"} = $sshash->{'sourcestream'}->next_in_stream;
      unless($sshash->{"_current_object"}) { 
        $sshash->{'_stream_empty'}=1;
        next; 
      }
      $sshash->{'_input_stream_count'}++;
    }
    push @streams, $sshash;
  }
  my @sort_streams = sort { _compare_active_streams($a,$b) }  @streams;
  $self->{'_active_streams'} = \@sort_streams;
}



#########################################################################
#
# need to override all the set up methods so that they call
# both source_stream() and side_stream()
#
#########################################################################

=head2 stream_clear

  Description: re-initialize the stream-stack back to a clear/empty state
  Returntype : undef;
  Exceptions : none 

=cut

sub stream_clear {
  my $self = shift;
  $self->_configure_filters;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_clear(@_);
  }
  return undef;
}

=head2 stream_data_sources

  Description: stream all sources(FeatureSource, EdgeSource, and Experiment) out of database
  Returntype : $self
  Exceptions : none 

=cut

sub stream_data_sources {
  my $self = shift;
  $self->_configure_filters;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_data_sources(@_);
  }
  return undef;
}

=head2 stream_by_named_region

  Description: configure/initialize the stream-stack to a stream from a named region.
               This will be passed down the stack until it reaches an SPStream::SourceStream instance
               which then knows how to create a new stream from a database.
  Returntype : either $self of the last SPStream of the stack or undef if error;
  Exceptions : none 

=cut

sub stream_by_named_region {
  my $self = shift;
  $self->_configure_filters;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_by_named_region(@_);
  }
}

=head2 stream_by_chrom

  Description: configure/initialize the stream-stack to a stream from a specific chrom (EEDB::Chrom object).
               This will be passed down the stack until it reaches an SPStream::SourceStream instance
               which then knows how to create a new stream from a database.
  Returntype : either $self of the last SPStream of the stack or undef if error;
  Exceptions : none 

=cut

sub stream_by_chrom {
  my $self = shift;
  $self->_configure_filters;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_by_chrom(@_);
  }
}


=head2 stream_all

  Description: configure/initialize the stream-stack to stream all data (do global process).
               This will be passed down the stack until it reaches an SPStream::SourceStream instance
               which then knows how to create a new stream from a database.
  Returntype : either $self of the last SPStream of the stack or undef if error;
  Exceptions : none 

=cut

sub stream_all {
  my $self = shift;
  $self->_configure_filters;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_all(@_);
  }
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

  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_features_by_metadata_search(@_);
  }
  return undef;
}  

=head2 stream_chromosomes

  Description: stream all EEDB::Chrom chromosomes from databases on the stream
  Returntype : $self
  Exceptions : none 

=cut

sub stream_chromosomes {
  my $self = shift;
  $self->_reset_stream;
  $self->_configure_filters;
  #find first stream which returns Chrom objects
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    my $stream = $sshash->{'sourcestream'};
    $stream->stream_chromosomes(@_);
    my $obj = $stream->next_in_stream;
    if(defined($obj) and ($obj->class eq "Chrom")) { 
      #OK this stream is good, reset back
      $stream->stream_chromosomes(@_);
      return undef;
    } else {
      #don't use this one, clear it back
      $sshash->{'sourcestream'}->stream_clear;
      next;
    }
  }
  return undef;
}

=head2 stream_peers

  Description: stream all known peers from database
  Arg (1)    : %options_hash : available optional parameters
               'uuid' => <string> :: filter for specific peer UUID
               'alias' => <string> :: filter for specific peer alias/name

=cut

sub stream_peers {
  my $self = shift;
  $self->_reset_stream;
  $self->_configure_filters;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->stream_peers(@_);
  }
  return undef;
}



=head2 disconnect

  Description: send "disconnect" message to all spstream modules
  Returntype : undef

=cut

sub disconnect {
  my $self = shift;
  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $sshash->{'sourcestream'}->disconnect;
  }
  return undef;
}  



1;

