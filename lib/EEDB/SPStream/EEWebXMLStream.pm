=head1 NAME - EEDB::SPStream::EEWebXMLStream

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

package EEDB::SPStream::EEWebXMLStream;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use Compress::Zlib;
use Digest::MD5;
use POSIX;
use POSIX qw(setsid);
use POSIX qw(:errno_h :fcntl_h);

use EEDB::Feature;
use EEDB::Edge;
use EEDB::Expression;
use EEDB::Tools::MultiLoader;
use EEDB::Tools::OSCFileParser;
use EEDB::SPStream::Feature2Expression;
use EEDB::SPStream::StreamBuffer;

use XML::TreePP;
use LWP::UserAgent;

use EEDB::SPStream::SourceStream;
our @ISA = qw(EEDB::SPStream::SourceStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::EEWebXMLStream"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my %args = @_;
  $self->SUPER::init(@_);
  
  $self->{'_do_store'} = 1;
  $self->{'_platform'} = "SEQ";
  $self->{'_stream_next_active'} = 0;
  $self->{'debug'} = 0;
  $self->{'_expression_buffer'} = [];
  $self->{'_fsrc'} = undef;
  
  return $self;
}

################################################
#
# override of MQdb::Database superclass methods
#
################################################

=head2 new_from_url

  Description: primary instance creation method
  Parameter  : a string in URL format
  Returntype : instance of EEDB::SPStream::EEWebXMLStream
  Examples   : my $db = EEDB::SPStream::EEWebXMLStream->new_from_url("http://<user>:<pass>@<host>:<port>/path/to/eedb");
  Exceptions : none

=cut


sub new_from_url {
  my $class = shift;
  my $url = shift;
    
  my $self = $class->new;
  return $self->init_from_url($url, @_);
}


=head2 init_from_url

  Description: primary instance creation method
  Parameter  : a string in URL format
  Returntype : instance of EEDB::SPStream::EEWebXMLStream
  Examples   : my $stream =  new EEDB::SPStream::EEWebXMLStream;
             : $stream->init_from_url("http://<user>:<pass>@<host>:<port>/path/to/eedb");
  Exceptions : none

=cut

sub init_from_url {
  my $self = shift;
  my $url = shift;
  return undef unless($url);    
  $self->{'_url'} = $url;
  return $self;
}

=head2 url

  Description: returns URL
  Returntype : string
  Exceptions : none

=cut

sub url {
  my $self = shift;
  return $self->{'_url'};
}


##################################################################

sub peer {
  my $self = shift;
  
  if(@_) {
    $self->{'_peer'} = shift;
  }
  return $self->{'_peer'};
}


sub database {
  #no way to access the database directly
  my $self = shift;
  return undef;
}

sub uuid {
  my $self = shift;
  if($self->peer) { return $self->peer->uuid; }
  if($self->url) { return $self->url; }
  return undef;
}


#####################################################################
#
# override of EEDB::SPStream::SourceStream superclass methods
#
#####################################################################

=head2 source_stream

  Description: EEWebXMLStream is a source so there is nothing before this
  Returntype : undef
  Exceptions : none 

=cut

sub source_stream {
  my $self = shift;
  return undef;
}


#
# can reuse these superclass methods
#
sub add_expression_datatype {
  my $self = shift;
  $self->SUPER::add_expression_datatype(@_);
  return $self->_setup_filters;
}
sub add_feature_source {
  my $self = shift;
  $self->SUPER::add_feature_source(@_);
  return $self->_setup_filters;
}
sub add_named_feature_source {
  #TODO :: replace with some code to keep track of expnames
  my $self = shift;
  $self->SUPER::add_named_feature_source(@_);
  return $self->_setup_filters;
}
sub add_experiment {
  my $self = shift;
  #if some experiment is set, even if it is not present, then the filter
  #should be turned on
  unless($self->{'_experiment_array'}) { $self->{'_experiment_array'} = []; }
  $self->SUPER::add_experiment(@_);
  return $self->_setup_filters;
}
sub add_named_experiments {
  my $self = shift;
  #if some experiment is set, even if it is not present, then the filter
  #should be turned on
  unless($self->{'_experiment_array'}) { $self->{'_experiment_array'} = []; }
  $self->SUPER::add_named_experiments(@_);
  return $self->_setup_filters;
}

sub display_desc {
  my $self = shift;
  my $str = sprintf("EEDB::EEWebXMLStream [%s]", $self->full_url);
  return $str;
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
  
  my $url = $self->{'_url'} . "/cgi/eedb_object.fcgi?id=" . $id;
  #printf("%s\n", $url);
  
  my $tpp = XML::TreePP->new();
  
  my $ua = LWP::UserAgent->new();
  $ua->timeout( 60 );
  $ua->env_proxy;

  my $response = $ua->get($url);
  unless($response->is_success) { return undef; }

  my $tree;
  eval {
    $tree = $tpp->parsehttp( GET => $url );
  };
  unless($tree and $tree->{'objects'}) { return undef; }
  if($@) { return undef; }
  #print "TREE::" , $tree, "\n";
  my $objects = [];
  
  if($objClass eq "Feature")       { $objects = $tree->{'objects'}->{'feature'}; }
  if($objClass eq "Experiment")    { $objects = $tree->{'objects'}->{'experiment'}; }
  if($objClass eq "FeatureSource") { $objects = $tree->{'objects'}->{'featuresource'}; }
  #if($objClass eq "EdgeSource")    { return EEDB::EdgeSource->fetch_by_id($self->database, $objID); }
  #if($objClass eq "Edge")          { return EEDB::Edge->fetch_by_id($self->database, $objID); }
  #if($objClass eq "Expression")    { return EEDB::Expression->fetch_by_id($self->database, $objID); }
  #if($objClass eq "Symbol")        { return EEDB::Symbol->fetch_by_id($self->database, $objID); }
  #if($objClass eq "Metadata")      { return EEDB::Metadata->fetch_by_id($self->database, $objID); }

  my $objxml = undef;
  if($objects =~ /ARRAY/) { $objxml = $objects->[0]; }
  else {$objxml = $objects; }

  my $object = $self->_convert_xmltree_to_object($objClass, $objxml);  
  #print($object->display_contents);
  return $object;
}


sub _convert_xmltree_to_object {
  my $self = shift;
  my $objClass = shift;
  my $objxml = shift;
  
  #for my $key (keys(%$objxml)) { printf("  %s => %s\n", $key , $objxml->{$key}); }

  my $object = undef;
  if($objClass eq "Peer")          { $object = EEDB::Peer->new_from_xmltree($objxml); }
  if($objClass eq "Assembly")      { $object = EEDB::Assembly->new_from_xmltree($objxml); }
  if($objClass eq "Chrom")         { $object = EEDB::Chrom->new_from_xmltree($objxml); }
  if($objClass eq "Feature")       { $object = EEDB::Feature->new_from_xmltree($objxml); }
  if($objClass eq "Expression")    { $object = EEDB::Expression->new_from_xmltree($objxml); }
  if($objClass eq "Experiment")    { $object = EEDB::Experiment->new_from_xmltree($objxml); }
  if($objClass eq "FeatureSource") { $object = EEDB::FeatureSource->new_from_xmltree($objxml); }
  if($objClass eq "ExpressionDatatype") { $object = EEDB::ExpressionDatatype->new_from_xmltree($objxml); }
  if($objClass eq "EdgeSource")         { $object = EEDB::EdgeSource->new_from_xmltree($objxml); }

  return $object;
}

#######################################


=head2 stream_by_named_region

  Description: setup streaming of all expression (with feature) from a specific region on a genome
               with a given set of source, experiment and datatype filters
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

  $self->_reset_stream; #reset and reconnect
    
  if($self->{'debug'}>1) {
    if(defined($chrom_start) and defined($chrom_end)) {
      #printf("fetch_all_named_region %s::%s:%d..%d\n", $assembly_name, $chrom_name, $chrom_start, $chrom_end);
    } else {
      #printf("fetch_all_named_region %s::%s\n", $assembly_name, $chrom_name);
    }
  }

  #http://osc-intweb1.gsc.riken.jp/edgeexpress-devel/cgi/eedb_region.cgi?
  #asm=hg18;
  #peers=EC83C7BA-7C24-11DE-B774-9692404BA379;
  #loc=chr16:84489743..84491011;
  #format=xml;
  #mode=objects;
  #submode=feature;
  #exptype=singlemap_tpm

  my $url = $self->{'_url'} . "/cgi/eedb_region.cgi";
  my $params="format=xml;mode=objects;asm=" . $assembly_name;

  if(!defined($chrom_start) or !defined($chrom_end) or ($chrom_start<0) or ($chrom_end<0)) {
    $params .= ";chrom=" . $chrom_name;
  } else {
    $params .= ";loc=" . $chrom_name .":". $chrom_start ."..". $chrom_end;
  }

  if($self->sourcestream_output eq 'express') { $params .= ";submode=expression"; }
  elsif($self->sourcestream_output eq 'subfeature') { $params .= ";submode=subfeature"; }
  else { $params .= ";submode=feature"; }
  if($self->peer) { $params .= ";peers=" . $self->peer->uuid; }
  
  if($self->{'_filter_source_ids'}) {
    my @ids = keys(%{$self->{'_filter_source_ids'}});
    if(@ids and (scalar(@ids)>0)) {
      $params .= ";source_ids=" . join(",", @ids); 
    }
  }
  if($self->{'_filter_datatypes'}) {
    my @ids = keys(%{$self->{'_filter_datatypes'}});
    if(@ids and (scalar(@ids)>0)) {
      $params .= ";exptype=" . join(",", @ids); 
    }
  }
  #printf("%s\n", $url . "?". $params);
  
  my $tpp = XML::TreePP->new();
  my $ua = LWP::UserAgent->new();
  $ua->timeout( 60*15 );
  $ua->env_proxy;
  $tpp->set( 'lwp_useragent' => $ua );
   
  my $tree;
  eval {
    $tree = $tpp->parsehttp( POST => $url, $params );
  };
  unless($tree and $tree->{'region'}) { return undef; }
  if($@) { return undef; }
  #print "TREE::" , $tree, "\n";


  #first check for sources, parse them into global caches
  my $chrxml = $tree->{'region'}->{'chrom'}; 
  if($chrxml) {
    #printf("CONVERTING CHROM object XML!!!!!!!!!!!!\n");
    unless($chrxml =~ /ARRAY/) { $chrxml = [$chrxml]; }
    foreach my $objxml (@$chrxml) {
      my $object = $self->_convert_xmltree_to_object("Chrom", $objxml);
    }
  }
  my $fsrcxml = $tree->{'region'}->{'featuresource'}; 
  if($fsrcxml) {
    unless($fsrcxml =~ /ARRAY/) { $fsrcxml = [$fsrcxml]; }
    foreach my $objxml (@$fsrcxml) {
      my $object = $self->_convert_xmltree_to_object("FeatureSource", $objxml);  
    }
  }
  my $expxml = $tree->{'region'}->{'experiment'}; 
  if($expxml) {
    unless($expxml =~ /ARRAY/) { $expxml = [$expxml]; }
    foreach my $objxml (@$expxml) {
      my $object = $self->_convert_xmltree_to_object("Experiment", $objxml);  
    }
  }

  my $objects = [];
  my $objClass = "Feature";
  
  if($self->sourcestream_output eq 'express') { 
    $objects = $tree->{'region'}->{'expression'}; 
    $objClass = "Expression";
  } else {
    $objects = $tree->{'region'}->{'feature'}; 
    $objClass = "Feature";
  }
  unless($objects =~ /ARRAY/) { $objects = [$objects]; }

  my $streambuffer = new EEDB::SPStream::StreamBuffer;
  foreach my $objxml (@$objects) {
    my $object = $self->_convert_xmltree_to_object($objClass, $objxml);  
    $streambuffer->add_objects($object);  
  }

  $self->{'_sources_streambuffer'} = $streambuffer;
  $self->{'_stream_next_active'} = 1;

  return $self;
}


=head2 stream_by_chrom

  Description: stream all expression (with feature) on a specific EEDB::Chrom
               with a given set of source, experiment and datatype filters
  Arg (1)    : $chrom (EEDB::Chrom object with database)
  Arg (2...) : hash named filter parameters. 
                 datatypes=>["tpm","raw"], 
                 sources=>[$fsrc1, $fsrc2,$fsrc3],  instances of EEDB::FeatureSource
                 experiments=>[$exp1, $exp2]  instances of EEDB::Experiment
  Returntype : $self
  Exceptions : none 

=cut

sub stream_by_chrom {
  my $self = shift;
  my $chrom = shift;  #Chrom object with database

  return $self->stream_by_named_region($chrom->assembly->ucsc_name, $chrom->chrom_name, undef, undef);
}


=head2 stream_all

  Description: stream all features (with metadata and expression) out of database 
               with a given set of source, experiment and datatype filters
  Returntype : $self
  Exceptions : none 

=cut

sub stream_all {
  my $self = shift;
  
  $self->_reset_stream;
  $self->{'_stream_next_active'}=1;
  return $self
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

  $self->_reset_stream;
  my $streambuffer = new EEDB::SPStream::StreamBuffer;

  my $url = $self->{'_url'} . "/cgi/eedb_object.fcgi?format=xml";
  if($self->peer) { $url .= ";peers=" . $self->peer->uuid; }
  #printf("%s\n", $url);

  #if class is defined as filter option, it is a hard filter, only those matching class are allowed
  if(defined($options{'class'})) { 
    if($options{'class'} eq "Experiment") { $url .= ";mode=experiments"; }
    elsif($options{'class'} eq "FeatureSource") { $url .= ";mode=feature_sources"; }
    elsif($options{'class'} eq "ExpressionDatatype") { $url .= ";mode=expression_datatypes"; }
    elsif($options{'class'} eq "EdgeSource") { $url .= ";mode=edge_sources"; }
  } else {
    $url .= ";mode=sources";
  }
  
  #if specific source dbIDs are specified, only those sources are allowed
  if(defined($options{'source_ids'})) {
    my $srcids = join(",", @{$options{'source_ids'}});
    $url .= ";source_ids=". $srcids;    
  }
  
  #if it passed previous filters, and filter-logic is specified, check it next
  if(defined($options{'filter'})) {
    $url .= ";filter=" . $options{'filter'};
  }
  #print($url,"\n");
  
  my $tpp = XML::TreePP->new();
  my $ua = LWP::UserAgent->new();
  $ua->timeout( 60 );
  $ua->env_proxy;
  my $response = $ua->get($url);
  unless($response->is_success) { return undef; }
  
  my $tree;
  eval {
    $tree = $tpp->parsehttp( GET => $url );
  };
  unless($tree) { return undef; }
  if($@) { return undef; }

  if(defined($options{'class'})) { 
    if($options{'class'} eq "Experiment") { $tree = $tree->{'experiments'}; }
    elsif($options{'class'} eq "FeatureSource") { $tree = $tree->{'feature_sources'}; }
    elsif($options{'class'} eq "ExpressionDatatype") { $tree = $tree->{'expression_datatypes'}; } 
    elsif($options{'class'} eq "EdgeSource") { $tree = $tree->{'edge_sources'}; } 
  } else {
    $tree = $tree->{'sources'};
  }
  unless($tree) { return undef;}

  #print "TREE::" , $tree, "\n";

  #first check for sources, parse them into global caches
  my $fsrcxml = $tree->{'featuresource'}; 
  if($fsrcxml) {
    unless($fsrcxml =~ /ARRAY/) { $fsrcxml = [$fsrcxml]; }
    foreach my $objxml (@$fsrcxml) {
      my $object = $self->_convert_xmltree_to_object("FeatureSource", $objxml);  
      $streambuffer->add_objects($object);
    }
  }
  my $expxml = $tree->{'experiment'}; 
  if($expxml) {
    unless($expxml =~ /ARRAY/) { $expxml = [$expxml]; }
    foreach my $objxml (@$expxml) {
      my $object = $self->_convert_xmltree_to_object("Experiment", $objxml);  
      $streambuffer->add_objects($object);
    }
  }
  my $exptypexml = $tree->{'datatype'}; 
  if($exptypexml) {
    unless($exptypexml =~ /ARRAY/) { $exptypexml = [$exptypexml]; }
    foreach my $objxml (@$exptypexml) {
      my $object = $self->_convert_xmltree_to_object("ExpressionDatatype", $objxml);  
      $streambuffer->add_objects($object);
    }
  }
  my $esrcxml = $tree->{'edgesource'}; 
  if($esrcxml) {
    unless($esrcxml =~ /ARRAY/) { $esrcxml = [$esrcxml]; }
    foreach my $objxml (@$esrcxml) {
      my $object = $self->_convert_xmltree_to_object("EdgeSource", $objxml);  
      $streambuffer->add_objects($object);
    }
  }

  $self->{'_sources_streambuffer'} = $streambuffer;
  $self->{'_stream_next_active'} = 1;
  return $self
}

sub cache_sources {
  my $self = shift;
  #do nothing
  my $cache = {};
  return $cache;
}


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
    
  my $streambuffer = new EEDB::SPStream::StreamBuffer;

  my $url = $self->{'_url'} . "/cgi/eedb_object.fcgi?mode=peers";
  #print($url,"\n");
  
  my $tpp = XML::TreePP->new();
  my $ua = LWP::UserAgent->new();
  $ua->timeout( 60 );
  $ua->env_proxy;
  my $response = $ua->get($url);
  unless($response->is_success) { return undef; }
  
  my $tree;
  eval {
    $tree = $tpp->parsehttp( GET => $url );
  };
  unless($tree) { return undef; }
  if($@) { return undef; }

  my $peerxml = $tree->{'peers'}->{'peer'};
  unless($peerxml =~ /ARRAY/) { $peerxml = [$peerxml]; }
  foreach my $objxml (@$peerxml) {
    my $object = $self->_convert_xmltree_to_object("Peer", $objxml);  
    $streambuffer->add_objects($object);
  }

  $self->{'_sources_streambuffer'} = $streambuffer;
  $self->{'_stream_next_active'} = 1;
  return $self
}

#########################################################################

=head2 next_in_stream

  Description: will fetch next object in stream which was setup by 
               one of the stream_by_xxxx methods
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

=cut

sub next_in_stream {
  my $self = shift;
  
  #sources mode
  my $obj = undef;
  if($self->{'_sources_streambuffer'}) {
    $obj = $self->{'_sources_streambuffer'}->next_in_stream;
  }
  
  while(!defined($obj) and @{$self->{'_assembly_stream_chroms'}}) {
    my $chrom = shift @{$self->{'_assembly_stream_chroms'}};
    #printf("reset chrom:: %s\n", $chrom->display_desc) if($self->{'debug'});
    $self->stream_by_chrom($chrom);
    $obj = $self->next_in_stream;
  }
  
  if(!defined($obj)) { 
    $self->{'_sources_streambuffer'}=undef; 
    $self->{'_stream_next_active'}=0;
  }
  return $obj;
}


######################################################################
#
# internal methods for working with data from the file and
# converting into objects
#
######################################################################

sub _reset_stream {
  my $self = shift;
  $self->{'_stream_next_active'} = 0;
  $self->{'_stream_chrom'} = undef;
  $self->{'_stream_start'} = undef;
  $self->{'_stream_end'} = undef;
  $self->{'_sources_streambuffer'} = undef;
  return $self;
}


sub _setup_filters {
  my $self = shift;
    
  my $source_ids = {};
  my $datatypes = {};
    
  if($self->{'_featuresource_array'}) {
    foreach my $fsrc (@{$self->{'_featuresource_array'}}) {
      $source_ids->{$fsrc->db_id} = 1;
    }
  }
  if($self->{'_experiment_array'}) {
    foreach my $exp (@{$self->{'_experiment_array'}}) {
      $source_ids->{$exp->db_id} = 1;
    }
  }
  if($self->{'_expression_datatype_array'}) {
    foreach my $type (@{$self->{'_expression_datatype_array'}}) {
      $datatypes->{$type} = 1;
    }
  }
  
  $self->{'_filter_source_ids'} = $source_ids;
  $self->{'_filter_datatypes'} = $datatypes;
    
  return $self;
}


#
# XML section
#

sub xml_start {
  my $self = shift;
  my $str = $self->SUPER::xml_start;
  
  if($self->peer) { $str .= "\n" . $self->peer->xml; }
  else { $str .= sprintf("<url>%s</url>\n", $self->url); }
  
  if($self->sourcestream_output ne "feature") { #default is "feature"
    $str .= sprintf("<sourcestream_output value=\"%s\"/>\n", $self->sourcestream_output);
  }
  
  if($self->{'_expression_datatype_array'}) {
    $str .= "<expression_datatypes value=\"";
    $str .= join(",", @{$self->{'_expression_datatype_array'}});
    $str .= "\" />\n";
  }
  
  if($self->{'_featuresource_array'}) {
    $str .= "<featuresources>";
    foreach my $fsrc (@{$self->{'_featuresource_array'}}) { $str .= $fsrc->xml; }
    $str .= "</featuresources>\n";
  }
  
  if($self->{'_experiment_array'}) {
    $str .= "<experiments>";
    foreach my $fsrc (@{$self->{'_experiment_array'}}) { $str .= $fsrc->xml; }
    $str .= "</experiments>\n";
  }

  return $str;
}

#does not implement _init_from_xmltree() since this consitutes a security leak

1;
