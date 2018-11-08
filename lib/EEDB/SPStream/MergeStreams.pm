=head1 NAME - EEDB::SPStream::MergeStreams

=head1 DESCRIPTION

a signal-processing-stream filter built around the same code as EEDB::Tools:OverlapCompare
As a stream filter the idea is a restricted use-case which is very common.
This filter is configured with a set of sources and expansion distances.
These sources form a collation of "templates" which are used for "clustering".
If the input features/expressions overlaps with any of these sources the tempate
is copied and the expression is "collected" under it as a "pseudo-cluster".
There will also be an optional min/max to compress the feature to the
limits of the input stream.

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

package EEDB::SPStream::MergeStreams;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::MergeStreams"; }


#################################################
# 
# initialization and configuration methods
#
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);

  $self->{'_input_stream_count'} = 0;
  $self->{'_side_stream_count'} = 0;

  $self->{'_side_stream'} = undef;

  $self->{'current_feature1'}= undef;
  $self->{'current_feature2'}= undef;
  
  $self->{'debug'} = 0;
  
  my %options = @args;
  if($options{'source'}) { $self->source_stream($options{'source'}); }
  if($options{'side'}) { $self->side_stream($options{'side'}); }
  return $self;
}


=head2 side_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none 

=cut

sub side_stream {
  my $self = shift;
  if(@_) {
    my $stream = shift;
    unless(defined($stream) && ($stream->isa('EEDB::SPStream') or $stream->isa('MQdb::DBStream'))) {
      printf(STDERR "ERROR:: side_stream() param must be a EEDB::SPStream or MQdb::DBStream");
      return;
    }
    if($stream eq $self) {
      printf(STDERR "ERROR: can not set source_stream() to itself");
      return;
    }
    $self->{'_side_stream'} = $stream;
  }
  return $self->{'_side_stream'};
}

=head2 add_source_filter

  Description: sets filters based on FeatureSource, EdgeSource, or Experiment objects
  Exceptions : none

=cut

sub add_source_filter {
  my $self = shift;
  my $source = shift;
  
  if($self->source_stream) {
    $self->source_stream->add_source_filter($source);
  } 
  if($self->side_stream) {
    $self->side_stream->add_source_filter($source);
  }  
  return $self;
}

sub add_expression_datatype {
  my ($self, $datatype) = @_;
  if($self->source_stream) {
    $self->source_stream->add_expression_datatype($datatype);
  } 
  if($self->side_stream) {
    $self->side_stream->add_expression_datatype($datatype);
  }  
  return $self;
}

sub sourcestream_output {
  my ($self, $mode) = @_;
  if($self->source_stream) {
    $self->source_stream->sourcestream_output($mode);
  } 
  if($self->side_stream) {
    $self->side_stream->sourcestream_output($mode);
  }  
}

sub clear_all_filters {
  my $self = shift;
  if($self->source_stream) {
    $self->source_stream->clear_all_filters;
  } 
  if($self->side_stream) {
    $self->side_stream->clear_all_filters;
  }  
}


###############################################################
#
# The OverlapCompare algorithm code modified for 
# stream-filtering without the call-out functions
#
###############################################################

sub next_in_stream {
  my $self = shift;
  
  while(1) {

    unless($self->{"current_feature1"}) {
      $self->{"current_feature1"} = $self->source_stream->next_in_stream;
      if($self->{"current_feature1"}) { $self->{'_input_stream_count'}++; }
    }
    my $feature1 = $self->{"current_feature1"};

    unless($self->{"current_feature2"}) {
      $self->{"current_feature2"} = $self->side_stream->next_in_stream;
      if($self->{"current_feature2"}) { $self->{'_side_stream_count'}++; }
    }
    my $feature2 = $self->{"current_feature2"};

    if(!defined($feature1) and !defined($feature2)) { last; } 
    
    my $cmp = compare_features($feature1, $feature2);
    
    if($cmp > 0) { 
      $self->{"current_feature2"} = undef;
      return $feature2;
    } else { #either choose obj1 or both same
      $self->{"current_feature1"} = undef;
      return $feature1;
    }
  }
  return undef;
}


sub compare_features {
  my $obj1 = shift;
  my $obj2 = shift;
  
  if(!defined($obj1)) { return 1; }  #choose obj2
  if(!defined($obj2)) { return -1; } #choose obj1
  
  if(($obj1->class ne "Feature") and ($obj1->class ne "Expression")) { return 0; }
  if(($obj2->class ne "Feature") and ($obj2->class ne "Expression")) { return 0; }
  if(!defined($obj1->chrom) or !defined($obj2->chrom)) { return 0; }
  
  # merge function
  # for expression ::   ORDER BY chrom_start, chrom_end, fe.feature_id, experiment_id, datatype
  # for feature    ::   ORDER BY chrom_start, chrom_end, feature_id
  # chrom order not guaranteed, could be sorted by name or size. 
  #    chrom just guaranteed that all chrom objects grouped together
  
  if($obj1->chrom_name ne $obj2->chrom_name) { return -1; } #keep input order (obj1 before obj2)
   
  if($obj1->chrom_start < $obj2->chrom_start) { return -1; } 
  if($obj1->chrom_start > $obj2->chrom_start) { return 1; } 

  if($obj1->chrom_end < $obj2->chrom_end) { return -1; } 
  if($obj1->chrom_end > $obj2->chrom_end) { return 1; } 
  
  my $id1 = $obj1->id;
  my $id2 = $obj2->id;
  if($obj1->class eq "Expression") { $id1 = $obj1->feature->id; }
  if($obj2->class eq "Expression") { $id2 = $obj2->feature->id; }
  if($id1 le $id2) { return -1; } 
  if($id1 ge $id2) { return 1; } 
  
  if(($obj1->class eq 'Expression') and ($obj2->class eq 'Expression')) {

    if($obj1->experiment->id lt $obj2->experiment->id) { return -1; } 
    if($obj1->experiment->id gt $obj2->experiment->id) { return 1; } 

    if($obj1->type lt $obj2->type) { return -1; } 
    if($obj1->type gt $obj2->type) { return 1; } 
  }

  return 0; # same, equals
}


sub _reset_stream {
  my $self = shift;

  $self->SUPER::_reset_stream;

  $self->{'_input_stream_count'} = 0;
  $self->{'_side_stream_count'} = 0;
  $self->{'current_feature1'}= undef;
  $self->{'current_feature2'}= undef;
  return $self;
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
  $self->_reset_stream;
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_clear(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_clear(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
  return undef;
}


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

  if($self->source_stream) {
    my $f1 = $self->source_stream->fetch_object_by_id($id);
    if($f1) { return $f1; }
  }
  if($self->side_stream) {
    my $f2 = $self->side_stream->fetch_object_by_id($id);
    if($f2) { return $f2; }
  }
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

  $self->_reset_stream;
  if($self->source_stream) {
    $self->source_stream->stream_features_by_metadata_search(@_);
  }
  if($self->side_stream) {
    $self->side_stream->stream_features_by_metadata_search(@_);
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

  $self->_reset_stream;
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_by_named_region(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_by_named_region(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
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

  $self->_reset_stream;
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_by_chrom(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_by_chrom(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
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

  $self->_reset_stream;
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_all(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_all(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
}


=head2 stream_data_sources

  Description: stream all sources(FeatureSource, EdgeSource, and Experiment) out of database(s)
  Returntype : $self
  Exceptions : none 

=cut

sub stream_data_sources {
  my $self = shift;
  
  $self->_reset_stream;
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_data_sources(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_data_sources(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
}

=head2 stream_chromosomes

  Description: stream all EEDB::Chrom chromosomes from databases on the stream
  Returntype : $self
  Exceptions : none 

=cut

sub stream_chromosomes {
  my $self = shift;
  $self->_reset_stream;
 
  $self->_reset_stream;
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_chromosomes(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_chromosomes(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
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
  my $ok=0;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_peers(@_)) { $ok=1; }
  }
  if(defined($self->side_stream)) { 
    if($self->side_stream->stream_peers(@_)) { $ok=1; }
  }
  if($ok) { return $self} else { return undef; }
  return undef;
}


=head2 disconnect

  Description: send "disconnect" message to all spstream modules
  Returntype : undef

=cut

sub disconnect {
  my $self = shift;

  $self->_reset_stream;
  if(defined($self->source_stream)) { 
    $self->source_stream->disconnect;
  }
  if(defined($self->side_stream)) { 
    $self->side_stream->disconnect;
  }
  return undef;
}  


#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("MergeStreams");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = $self->SUPER::xml_start."\n";
  if($self->side_stream) {
    $str .= "<side_stream>\n";
    $str .= $self->side_stream->xml;
    $str .= "</side_stream>\n";
  }
  return $str;
}

sub _init_from_xmltree {
  my $self = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  unless($xmlTree->{'-module'} eq "EEDB::SPStream::MergeStreams") { return undef; }  
  if($xmlTree->{'side_stream'}) {
    my ($head,$tail) = EEDB::SPStream->create_stream_from_xmltree($xmlTree->{'side_stream'});
    if($head) { $self->side_stream($head); }
  }  
  return $self;
}


1;

