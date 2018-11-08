#!/usr/bin/perl -w 
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
use EEDB::SPStream::FederatedSourceStream;
use EEDB::Tools::LSArchiveImport;


no warnings 'redefine';
$| = 1;

my $self = {};

my $help;
my $passwd = '';
my $store = 0;
my $obj_id = undef;
my $assembly = 'hg18';
my $format = 'content';
my $region_loc = undef;

$self->{'starttime'} = time();
$self->{'depth'} = 4;
$self->{'debug'} = 1;

my $url = $ENV{EEDB_REGISTRY};

GetOptions( 
            'ids:s'      =>  \($self->{'ids'}),
            'peers:s'    =>  \($self->{'peer_uuids'}),
            'depth:s'    =>  \($self->{'depth'}),
            'full'       =>  \($self->{'full_update'}),
            'search'     =>  \($self->{'search_filter'}),
            'debug:s'    =>  \($self->{'debug'}),
            'help'       =>  \$help,
            'store'      =>  \$store
            );

if ($help) { usage(); }

my $regPeer  = EEDB::Peer->fetch_self_from_url("mysql://read:read\@osc-mysql.gsc.riken.jp/eeDB_LSA_registry");
my $regDB    = $regPeer->peer_database;
$regPeer->display_info;

unless($regDB) { 
  printf("ERROR: connecting to database\n\n");
  usage(); 
}

#manual_update_metadata();
unless(LSA_experiment_sync()) {
  usage(); 
}

exit(1);
#########################################################################################

sub usage {
  print "eedb_federation_update.pl [options]\n";
  print "  -help              : print this help\n";
  print "  -ids <id,..>   : list of fedID of Experiment/FeatureSource to sync\n";
  print "  -peers <uuid>,...  : uuid(s) of peers to update, comma separated list or single uuid\n";
  print "  -full              : do full federation search and update\n";
  print "  -search <filter>   : when doing full federation search , apply this filter, and update\n";
  print "eedb_federation_update.pl v1.0\n";
  
  exit(1);  
}


###################################################################################

sub manual_update_metadata {
  #this is a template method to manually add/remove metadata by hand

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->add_seed_peers($regPeer);

  #$stream->source_keyword_search("c04 or c09");
  #$stream->source_keyword_search("fantom3 mm9");
  #$stream->add_source_ids("C957FFA2-F8AF-11DD-99B1-B083FEFA0F18::21:::FeatureSource");
  #$stream->add_source_ids("2AB7A6CA-8BD7-11DE-A42E-451BB6AEF512::1:::Experiment");

  #$stream->stream_data_sources('class' => "FeatureSource");
  #$stream->stream_data_sources();
  my $count=0;
  while(my $source = $stream->next_in_stream) {
    if($source->class eq "ExpressionDatatype") { next; }

    #$source->metadataset->add_tag_symbol("species_name", 'mouse');
    #$source->store_metadata;

    $source->display_info;
    $count++;
  }
  printf("processed %d sources\n", $count);
}


sub LSA_experiment_sync {
  
  my $LSA = new EEDB::Tools::LSArchiveImport;
  $LSA->{'debug'} = $self->{'debug'};

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  if($self->{'full_update'}  || $self->{'search_filter'}) { 
    print("### stream ALL peers from federation\n");
    $stream->allow_full_federation_search(1); 
  } else { $stream->allow_full_federation_search(0); }
  $stream->add_seed_peers($regPeer);
  if($self->{'search_filter'}) { $stream->source_keyword_search($self->{'search_filter'}); }

  if($self->{'peer_uuids'}) {
    my @ids = split(/,/, $self->{'peer_uuids'});
    $stream->add_peer_ids(@ids);
  }
  if($self->{'ids'}) {
    my @ids = split(/,/, $self->{'ids'});
    $stream->add_source_ids(@ids);
  }
  
  $stream->stream_peers();
  my $count=0;
  while(my $p2 = $stream->next_in_stream) {
    #printf("%s", $p2->xml);
    $count++;
  }
  if($count ==0) { return undef; }

  printf("streamed %d peers\n", $count);

  $count=0;
  my $fail_count=0;
  my $stream_count=0;
  my %options;
  $options{'class'} = "Experiment";
  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) {
    unless($peer->db_url =~ /^oscdb/) { next; }
    my $stream2 = $peer->source_stream;
    $stream2->stream_data_sources(%options);
    while(my $experiment = $stream2->next_in_stream) {
      next unless($experiment->class eq "Experiment");

      if($experiment->platform eq "TFBS_scan") { next; }
      #if($experiment->platform eq "helicosCAGE") { next; }
      #if($experiment->platform eq "SQRL_RNAseq") { next; }
      #if($experiment->platform eq "ChIP-chip") { next; }
      if($experiment->exp_accession =~ /_mapcount/) { next; }
      $stream_count++;

      my $libID_md = $experiment->metadataset->find_metadata('osc:LSArchive_library_osc_lib_id');
      #if($libID_md) { printf("ALREADY SYNCED : %s\n", $experiment->display_desc); next; }

      #printf("%s ", $experiment->display_desc);

      my $rtnexp = $LSA->sync_metadata_for_experiment($experiment);
      if($rtnexp) {

        if($self->{'debug'} > 2) { printf("%s ", $experiment->display_desc); }
        my $mdata_list = $rtnexp->metadataset->metadata_list;
        foreach my $mdata (@$mdata_list) {
          if(!defined($mdata->primary_id)) { 
            if($self->{'debug'} > 2) { printf("  new metadata : %s\n", $mdata->display_desc); }
          }
        }

        if($store) {
          $experiment->store_metadata;
          $experiment->update;
        }
        printf("SYNC OK : %s", $experiment->display_desc);
        $count++;
      } else { 
        $fail_count++;
        printf("FAIL    : %s", $experiment->display_desc);
      }
      if($libID_md) { printf("  :: RE-SYNC"); }
      print("\n");
    }
    #if($count>0) { last; }
  }
  printf("%d experiments synced (new)\n", $count);
  printf("%d / %d experiments FAILED to sync\n", $fail_count, $stream_count);
}



