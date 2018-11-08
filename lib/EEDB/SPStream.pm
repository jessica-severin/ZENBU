=head1 NAME - EEDB::SPStream

=head1 SYNOPSIS

=head1 DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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

package EEDB::SPStream;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use XML::TreePP;

use MQdb::DBStream;
use MQdb::DBObject;
our @ISA = qw(MQdb::DBObject);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_source_stream'} = undef;
  return $self;
}

=head2 source_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none 

=cut

sub source_stream {
  my $self = shift;
  if(@_) {
    my $stream = shift;
    if(defined($stream)) {
      #unless($stream->isa('EEDB::SPStream') or $stream->isa('MQdb::DBStream')) {
      #  warn("ERROR:: source_stream() param must be a EEDB::SPStream or MQdb::DBStream");
      #  return undef;
      #}
      if($stream eq $self) {
        warn("ERROR: can not set source_stream() to itself");
        return undef;
      }
    }
    $self->{'_source_stream'} = $stream;
  }
  return $self->{'_source_stream'};
}


=head2 outstream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none 

=cut

sub outstream {
  my $self = shift;
  return $self;
}

=head2 add_source_filter

  Description: sets filters based on FeatureSource, EdgeSource, or Experiment objects
  Exceptions : none 

=cut

sub add_source_filter {
  my $self = shift;
  if(defined($self->source_stream)) { 
    return $self->source_stream->add_source_filter(@_);
  }
  return undef;
}  


#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################

=head2 next_in_stream

  Description: return the next object in the stream stack
               depending on the configuration this will either be an on-the-fly created object
               or an object passed through filters, or a primary object streamed out of database/peer
  Returntype : either an EEDB::Feature or EEDB::Expression object or undef if end of stream
  Exceptions : none 

=cut

sub next_in_stream {
  my $self = shift;
  if(defined($self->source_stream)) { return $self->source_stream->next_in_stream(); }
  return undef;
}

=head2 stream_clear

  Description: re-initialize the stream-stack back to a clear/empty state
  Returntype : undef;
  Exceptions : none 

=cut

sub stream_clear {
  my $self = shift;
  $self->_reset_stream;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_clear(@_)) { return $self; }
  }
  return undef;
}


=head2 stream_by_named_region

  Description: configure/initialize the stream-stack to a stream from a named region.
               This will be passed down the stack until it reaches an SPStream::SourceStream instance
               which then knows how to create a new stream from a database.
  Arg (1)    : $assembly_name (string)
  Arg (2)    : $chrom_name (string)
  Arg (3)    : $chrom_start (integer)
  Arg (4)    : $chrom_end (integer)
  Returntype : either $self of the last SPStream of the stack or undef if error;
  Exceptions : none 

=cut

sub stream_by_named_region {
  my $self = shift;
  $self->_reset_stream;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_by_named_region(@_)) { return $self; }
  }
  return undef;
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
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_by_chrom(@_)) { return $self; }
  }
  return undef;
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
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_all(@_)) { return $self; }
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
  $self->_reset_stream;
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_data_sources(@_)) { return $self; }
  }
  return undef;
}

=head2 reload_stream_data_sources

  Description: SourceStream will cache sources(FeatureSource, EdgeSource, and Experiment)
               System automatically will do a reload ever hour to check for new sources
               added to previously cached peer/databases. But it may be useful to manually
               force a cache refresh.
  Returntype : $self
  Exceptions : none 

=cut

sub reload_stream_data_sources {
  my $self = shift;
  $self->_reset_stream;
  if(defined($self->source_stream)) { 
    if($self->source_stream->reload_stream_data_sources(@_)) { return $self; }
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
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_chromosomes(@_)) { return $self; }
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
  if(defined($self->source_stream)) { 
    if($self->source_stream->stream_peers(@_)) { return $self; }
  }
  return undef;
}

=head2 fetch_object_by_id

  Description: fetch single feature object from stream using global federated-ID. 
               passes query down the stream until it is satisfied
  Arg (1)    : $fedID (federated ID <uuid>::id)
  Returntype : EEDB::Feature
  Exceptions : none 

=cut

sub fetch_object_by_id {
  my $self = shift;
  my $id = shift;
  if(defined($self->source_stream)) { 
    return $self->source_stream->fetch_object_by_id($id);
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
  if(defined($self->source_stream)) { 
    return $self->source_stream->stream_features_by_metadata_search(@_);
  }
  return undef;
}  

=head2 disconnect

  Description: send "disconnect" message to all spstream modules
  Returntype : undef

=cut

sub disconnect {
  my $self = shift;
  if(defined($self->source_stream)) { 
    $self->source_stream->disconnect;
  }
  return undef;
}  

=head2 _reset_stream

  Description: can be reimplemented by subclasses. 
               This is called at the beginning of every stream_xxxxx() call.
               Useful for reseting/clearing internal caches/variables between
               different streams.
  Returntype : undef

=cut

sub _reset_stream {
  #this is not passed down the stream, but rather more like an internal method
  return undef;
}


#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("SPStream[%s]", $self->class);
  return $str;
}

=head2 xml

  Description: returns an XML description of this instance of SPStream and 
               then calls the source_stream to get its XML effectively creating a 
               signal-processing stack until it reaches an EEDB::SPStream::SourceStream.
               Each subclass must implement a proper xml_start().
               The superclass xml_end() will work in all cases. No need to override this method.
  Returntype : string scalar 
  Exceptions : none 
  Default    : default is a simple xml_start + xml_end 

=cut

sub xml {
  my $self = shift;
  my $str = $self->xml_start() . $self->xml_end();
  if($self->source_stream) {
    $str .= $self->source_stream->xml;
  }
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = sprintf("<spstream module=\"%s\" >", $self->class);
  return $str;
}

sub xml_end {
  my $self = shift;
  return "</spstream>\n";
}


sub create_stream_from_xmlconfig {
  my $class = shift;
  my $xmlData = shift;
  
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);
  unless($tree->{"stream"}) { return undef; }

  my ($head, $tail);
  my $spstreams = $tree->{'stream'}->{"spstream"};
  unless($spstreams =~ /ARRAY/) { $spstreams = [$spstreams]; }
  foreach my $spstreamXML (@$spstreams) {
    my $spstream = $class->_xmltree_create_spstream($spstreamXML);
    if($spstream) {
      unless($head) { $head = $spstream; }
      if($tail) { $tail->source_stream($spstream); }
      $tail = $spstream;
    }
  }
  return ($head, $tail);
}


sub create_stream_from_xmltree {
  my $class = shift;
  my $tree = shift;  #tree generated by XML::TreePP;

  unless($tree) { return undef; }

  my ($head, $tail);
  my $spstreams = $tree->{'spstream'};
  unless($spstreams) { return undef; }
  unless($spstreams =~ /ARRAY/) { $spstreams = [$spstreams]; }
  foreach my $spstreamTreeNode (@$spstreams) {
    my $spstream = EEDB::SPStream->_xmltree_create_spstream($spstreamTreeNode);
    if($spstream) {
      unless($head) { $head = $spstream; }
      if($tail) { $tail->source_stream($spstream); }
      $tail = $spstream;
    }
  }
  return ($head, $tail);
}


sub _xmltree_create_spstream {
  my $class = shift;
  my $tree = shift;
  
  unless($tree and $tree->{'-module'}) { return undef; }
  
  my $module = $tree->{'-module'};
  eval "require $module";
  my $obj = $module->new();
  if($obj->_init_from_xmltree($tree)) { return $obj; }
  return undef;
}

sub _init_from_xmltree {
  my $self = shift;
  # default super class method. subclasses need only implement this method
  # and return $self; on success or return undef; on fail
  return undef;
}

1;


