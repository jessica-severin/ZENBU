#!/usr/local/bin/perl -w 
BEGIN{
    unshift(@INC, "/zenbu/src/MappedQuery/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}

=head1 NAME - eedb_getobject.pl

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

use strict;
use warnings;

use Time::HiRes;
my $launch_time = time();

use Getopt::Long;
use Data::Dumper;
use Switch;

use File::Temp;

use EEDB::Database;
use EEDB::Feature;
use EEDB::Expression;
use EEDB::Edge;
use EEDB::EdgeSource;
use EEDB::SPStream::MultiSourceStream;
use EEDB::SPStream::MergeStreams;

no warnings 'redefine';
$| = 1;

my $self = {};
my $global_source_cache = {};
my $global_source_counts = {};

my $help;
my $passwd = '';
my $obj_id = undef;
my $assembly = 'hg18';
my $show_express=undef;
my $format = 'content';
my $format_xml = undef;
my $format_gff = undef;
my $format_das = undef;
my $show_full_mdata = undef;
my $region_loc = undef;

$self->{'starttime'} = time()*1000;
$self->{'mode'} = "feature";
$self->{'depth'} = 3;
$self->{'format'} = "xml";

my $url = $ENV{EEDB_REGISTRY};

GetOptions( 
            'url:s'      =>  \$url,
            'id:s'       =>  \($self->{'id'}),
            'depth:s'    =>  \($self->{'depth'}),
            'peer:s'     =>  \($self->{'peer_name'}),
            'mode:s'     =>  \($self->{'mode'}),
            'exptype:s'  =>  \($self->{'exptype'}),
            'format:s'   =>  \($self->{'format'}),
            'types:s'    =>  \($self->{'types'}),
            'filter:s'   =>  \($self->{'expfilter'}),
            'addmeta:s'  =>  \($self->{'addmeta'}),
            'express'    =>  \$show_express,
            'xml'        =>  \$format_xml,
            'gff'        =>  \$format_gff,
            'das'        =>  \$format_das,
            'mdata'      =>  \$show_full_mdata,
            'loc:s'      =>  \$self->{'loc'},
            'help'       =>  \$help
            );

if ($help) { usage(); }

my $eeDB = undef;
if($url) {
  $eeDB = EEDB::Database->new_from_url($url);
} 
unless($eeDB and $eeDB->get_connection) { 
  printf("ERROR: connection to database\n\n");
  usage(); 
}

if($format_xml) {$format = 'xml';}
if($format_gff) {$format = 'gff';}
if($format_das) {$format = 'das';}

my $time1 = Time::HiRes::time();

if(defined($self->{'peer_name'})) {
  $self->{'peer_ids'}->{$self->{'peer_name'}} = 1;
}

if(defined($self->{'id'})) {
  if($self->{'id'} =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; }
  elsif($self->{'id'} =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; }
}
if($self->{'expfilter'}) {
  $self->{'apply_source_filter'} = 1;
  if($self->{'format'} eq 'debug') {  printf("apply filter :: [%s]\n", $self->{'expfilter'}); }
}

if($self->{'addmeta'}) {
  $self->{'_metadata'} = [];
  my @mda = split /,/, $self->{'addmeta'};
  foreach my $td (@mda) {
    if($td =~ /(.+)::(.+)/) { 
      my $mdata = EEDB::Symbol->new($1, $2); 
      push @{$self->{'_metadata'}}, $mdata;
    }
  }
}

#now process objects

if($self->{'mode'} eq "sources") { show_sources($self); }
elsif($self->{'mode'} eq "experiments") { show_sources($self); }
elsif($self->{'mode'} eq "feature_sources") { show_sources($self); }
elsif($self->{'mode'} eq "expression_datatypes") { show_sources($self); }
elsif($self->{'mode'} eq "edge_sources") { show_sources($self); }
else {
  show_peers($self);
  if(defined($self->{'id'})) { get_singlenode($self); }
  if(defined($self->{'loc'})) { fetch_region_objects($self); } 
}
#else { fetch_features(); }

printf("process time :: %1.3f secs\n", (Time::HiRes::time() - $time1));
printf("real time :: %d secs\n", (time() - $launch_time));

$eeDB->disconnect;

exit(1);
#########################################################################################

sub usage {
  print "eedb_getobject.pl [options]\n";
  print "  -help              : print this help\n";
  print "  -url <url>         : URL to database\n";
  print "  -id <int>          : dbID of the feature to fetch\n";
  print "  -loc <region>      : fetch all features within region\n";
  print "  -das               : display feature in DAS xml format\n";
  print "  -gff               : display feature in expanded GFF format\n";
  print "  -mdata             : in GFF also show all symbol metadata\n";
  print "  -xml               : display feature in XML format\n";
  print "  -express           : in XML format also display expression for feature(s)\n";
  print "eedb_getobject.pl v1.0\n";
  
  exit(1);  
}


###################################################################################

sub get_peers_orig {
  my $self = shift;

  my %peers;
  if(defined($self->{'peer_name'})) {
    my $peer = find_peer($self, $self->{'peer_name'});
    if($peer) { $peers{$peer->uuid} = $peer; }
  }
  foreach my $uuid (keys(%{$self->{'peer_ids'}})) {
    my $peer = find_peer($self, $uuid);
    if($peer) { $peers{$peer->uuid} = $peer; }
  }
  unless(scalar(keys(%peers))) {
    find_peer($self, "");
    foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
      if($peer) { $peers{$peer->uuid} = $peer; }
    }
  }
  foreach my $peer (values(%peers)) {
    next unless($peer);
    next unless($peer->source_stream);
    $peer->source_stream->cache_sources;
  }

  my @ps = values(%peers);
  return \@ps;
}

sub get_peers {
  my $self = shift;

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(\d+)(.*)/) { $self->{'peer_name'} = $1; }
  }

  my %peers;
  if(defined($self->{'peer_name'})) {
    my $peer = find_peer($self, $self->{'peer_name'});
    if($peer and $peer->test_is_valid) { $peers{$peer->uuid} = $peer; }
  }
  foreach my $uuid (keys(%{$self->{'peer_ids'}})) {
    my $peer = find_peer($self, $uuid);
    if($peer and $peer->test_is_valid) { $peers{$peer->uuid} = $peer; }
  }
  unless(scalar(keys(%peers))) {
    find_peer($self, "");
    foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
      if($peer and $peer->test_is_valid) { $peers{$peer->uuid} = $peer; }
    }
  }

  my @ps = values(%peers);
  return \@ps;
}

sub find_peer {
  my $self = shift;
  my $uuid = shift;

  my $peer = EEDB::Peer->check_global_peer_cache($uuid);
  unless($peer) {
    my $start_peer = EEDB::Peer->fetch_self($eeDB);
    $peer = $start_peer->find_peer($uuid, 3);
  }
  return $peer;
}


###############################################################

sub show_peers {
  my $self = shift;

  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<peers>\n");

  my @peers = @{get_peers($self)};
  printf("<stats count=\"%d\" />\n", scalar(@peers));
  foreach my $peer (@peers) {
    next unless($peer);
    next unless($peer->test_is_valid);
    print($peer->xml_start);
    if($peer->test_peer_database_is_valid) { print("VALID-DB "); }
    if($peer->test_peer_database_is_valid) { $peer->peer_database->disconnect; }
    print($peer->xml_end);
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" peer_count=\"%d\" loaded_sources=\"%s\"/>\n", 
         $total_time/1000.0, scalar(@peers), scalar(keys(%$global_source_cache)));
  printf("</peers>\n");
}

###########################################################

sub input_stream {
  my $self = shift;

  return source_filtered_stream($self);
}

sub unfiltered_stream {
  my $self = shift;

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(\d+)(.*)/) { $self->{'peer_name'} = $1; }
  }

  my @peers = @{get_peers($self)};
  my $web_urls = {};
  
  my $stream = undef;
  if(scalar(@peers)==1) {
    $stream = $peers[0]->source_stream;
  } else {
    $stream = new EEDB::SPStream::MultiSourceStream;
    foreach my $peer (@peers) {
      my $stream1 = $peer->source_stream;
      next unless($stream1);
      $stream->add_sourcestream($stream1);

      #if($stream1->class eq "EEDB::SPStream::EEWebXMLStream") {
      #  unless($web_urls->{$stream1->url}) {
      #    $web_urls->{$stream1->url} = 1;
      #    $stream1->peer(undef);
      #    $stream->add_sourcestream($stream1);
      #  }
      #} else {
      #  $stream->add_sourcestream($stream1);
      #}
    }
  }
  return $stream;
}

sub source_filtered_stream {
  my $self = shift;

  my $stream = unfiltered_stream($self);

  my %options;
  if(defined($self->{'expfilter'})) { $options{'filter'} = $self->{'expfilter'}; }
  if(defined($self->{'source_ids'})) { $options{'source_ids'} = $self->{'source_ids'}; }

  $stream->stream_data_sources(%options);

  $self->{'known_sources'} = {};
  while(my $source = $stream->next_in_stream) {
    $self->{'known_sources'}->{$source->db_id} = $source;
  }
  
  if($self->{'apply_source_filter'}) {
    my @filter_sources = values(%{$self->{'known_sources'}});
    foreach my $source (@filter_sources) {
      $stream->add_source_filter($source);
    }
  }
  return $stream;
}

###########################################################


sub get_singlenode {
  my $self = shift;

  my $stream = input_stream($self);
  print($stream->xml,"\n");
  my $object = $stream->fetch_object_by_id($self->{'id'});
  if($object) { 
    if($format eq "xml") {
      print($object->xml,"\n");
    } else {
      print($object->display_contents,"\n");
    }
  }
  else { printf("ERROR: unable to fetch feature\n%s\n", $stream->xml); }
  $stream->disconnect;
}


sub fetch_region_objects {
  my $self = shift;

  if(defined($self->{'loc'}) and ($self->{'loc'} =~ /(.*)\:\:(.*)\:(.*)\.\.(.*)/)) {
    $self->{'assembly_name'} = $1;
    $self->{'chrom_name'} = $2;
    $self->{'start'} = $3;
    $self->{'end'} = $4;
  }

  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  my $stream = input_stream($self);
  print($stream->xml,"\n");

  if($self->{'mode'} eq "expression") {
    $stream->sourcestream_output("expression");
    if($self->{'exptype'}) {
      $stream->add_expression_datatype($self->{'exptype'});
    }
  } elsif($self->{'mode'} eq "subfeature") {
    print("\n======== use subfeature\n");
    $stream->sourcestream_output("subfeature");
  } elsif($self->{'mode'} eq "full_feature") {
    $stream->sourcestream_output("feature");
  } else {
    $stream->sourcestream_output("simple_feature");
  }

  my $count=0;
  printf("stream_by_named_region %s %s %s %s\n", $assembly, $chrom_name, $start, $end);
  $stream->stream_by_named_region($assembly, $chrom_name, $start, $end);
  while(my $object = $stream->next_in_stream) {
    $count++;
    if($self->{'mode'} eq "full_feature") { print($object->display_contents,"\n"); }
    if($self->{'mode'} eq "subfeature") { xml_full_feature($object); }
    else { print($object->display_desc,"\n"); }
  }
  $self->{'feature_count'} = $count;
  $self->{'count'} = $count;
}


sub get_sources {
  my $self = shift;

  my $stream = input_stream($self);
  $stream->stream_data_sources();
  while(my $object = $stream->next_in_stream) {
    if(($self->{'mode'} eq "experiments") and ($object->class ne "Experiment")) { next; } 
    if(($self->{'mode'} eq "feature_sources") and ($object->class ne "FeatureSource")) { next; } 

    if(defined($self->{'filter'}) and (($object->class eq "Experiment") or ($object->class eq "FeatureSource"))) {
      next unless($object->metadataset->check_by_filter_logic($self->{'filter'}));
    }
    if($format eq "xml") {
      print($object->simple_xml);
    } else {
      print($object->display_desc,"\n");
    }
  }
}

sub xml_full_feature {
  my $feature = shift;

  my $edges = $feature->edgeset->extract_category("subfeature")->edges;
  print($feature->xml_start);
  if(scalar(@$edges)) {
    print("\n  <subfeatures>\n");
    foreach my $edge (sort {(($a->feature1->chrom_start <=> $b->feature1->chrom_start) ||
                              ($a->feature1->chrom_end <=> $b->feature1->chrom_end))
                            } @{$edges}) {
      print("    ", $edge->feature1->simple_xml);
    }
    print("  </subfeatures>\n");
  }
  print($feature->xml_end);
}


sub show_sources {
  my $self = shift;

  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<sources>\n");

  my $src_hash = {};
  my $peer_uuid_hash = {};
  my $in_total=0;

  my $stream = unfiltered_stream($self);

  my %options;
  if(defined($self->{'expfilter'})) { $options{'filter'} = $self->{'expfilter'}; }
  if(defined($self->{'source_ids'})) { $options{'source_ids'} = $self->{'source_ids'}; }
  if($self->{'mode'} eq "experiments")     { $options{'class'} = "Experiment"; } 
  if($self->{'mode'} eq "feature_sources") { $options{'class'} = "FeatureSource"; } 
  if($self->{'mode'} eq "expression_datatypes") { $options{'class'} = "ExpressionDatatype"; } 
  if($self->{'mode'} eq "edge_sources") { $options{'class'} = "EdgeSource"; } 

  $stream->stream_data_sources(%options);

  while(my $source = $stream->next_in_stream) {
    $in_total++;
    $src_hash->{$source->db_id} = $source;
    if(defined($source->peer_uuid)) {
      $peer_uuid_hash->{$source->peer_uuid} = 1;
    }
  }

  my @sources = values (%{$src_hash});

  if(defined($self->{'expfilter'})) {
    printf("<filter>%s</filter>\n", $self->{'expfilter'});
  }
  printf("<result_count method=\"%s\" total=\"%s\" filtered=\"%s\" />\n", 
     $self->{'mode'}, scalar(keys(%{$global_source_cache})), scalar(@sources));

  foreach my $uuid (keys(%{$peer_uuid_hash})) {
    my $peer = EEDB::Peer->check_global_peer_cache($uuid);
    if($peer) { print($peer->xml); }
  }
  foreach my $src (@sources) {
    if($self->{'format'} eq 'fullxml') { print($src->xml); }
    else { print($src->simple_xml); }
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(@sources));
  printf("<peer known=\"%s\" count=\"%s\" />\n", scalar(@{EEDB::Peer->global_cached_peers}), scalar(keys(%{$peer_uuid_hash})));
}


