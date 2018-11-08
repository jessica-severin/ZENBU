#!/usr/bin/perl -w 
BEGIN{
  unshift(@INC, "/zenbu/src/MappedQuery/lib");
  unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}


=head1 NAME - eedb_metadata_edit.pl

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
if(!$url) { $url = "mysql://read:read\@osc-mysql.gsc.riken.jp/eeDB_LSA_registry"; }

GetOptions( 
            'id:s'         =>  \($self->{'ids'}),
            'ids:s'        =>  \($self->{'ids'}),
            'peers:s'      =>  \($self->{'peer_uuids'}),
            'depth:s'      =>  \($self->{'depth'}),
            'full'         =>  \($self->{'full_update'}),
            'search'       =>  \($self->{'search_filter'}),
            'add:s'        =>  \($self->{'add_metadata'}),
            'show'         =>  \($self->{'show'}),
           #'delete:s'     =>  \($self->{'delete_metadata'}),
            'delete_tag:s' =>  \($self->{'delete_metadata_tag'}),
            'debug:s'      =>  \($self->{'debug'}),
            'help'         =>  \$help,
            'store'        =>  \$store
            );

if ($help) { usage(); }

my $regPeer  = EEDB::Peer->fetch_self_from_url($url);
my $regDB    = $regPeer->peer_database;
$regPeer->display_info;

unless($regDB) { 
  printf("ERROR: connecting to database\n\n");
  usage(); 
}

unless($self->{'add_metadata'} or $self->{'show'} or $self->{'delete_metadata'} or $self->{'delete_metadata_tag'}) {
  printf("ERROR: please specify add metadata edit option [-show -add -delete -delete_tag]\n\n");
  usage(); 
}

edit_metadata();

exit(1);
#########################################################################################

sub usage {
  print "eedb_metadata_edit.pl [options]\n";
  print "  -help               : print this help\n";
  print "  -ids <id,..>        : list of fedID of Experiment/FeatureSource to sync\n";
  print "  -show               : display metadata of object after editing\n";
  print "  -store              : store modifications back into database\n";
  print "  -add <mdata>        : add metadata in specified sources. <mdata> like \"eedb:display_name=some description\"\n";
#  print "  -delete <mdata>     : delete specific metadata in specified sources. <mdata> like \"eedb:display_name=some description\"\n";
  print "  -delete_tag <tag>   : delete all metadata with <tag> in specified sources. <tag> like \"eedb:display_name\"\n";
#  print "  -peers <uuid>,...  : uuid(s) of peers to update, comma separated list or single uuid\n";
#  print "  -full              : do full federation search and update\n";
#  print "  -search <filter>   : when doing full federation search , apply this filter, and update\n";
  print "eedb_metadata_edit.pl v1.0\n";
  
  exit(1);  
}


###################################################################################

sub edit_metadata {
  my $LSA = new EEDB::Tools::LSArchiveImport;
  $LSA->{'debug'} = $self->{'debug'};

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->allow_full_federation_search(0); 
  $stream->add_seed_peers($regPeer);

  #if($self->{'full_update'}  || $self->{'search_filter'}) { 
  #  print("### stream ALL peers from federation\n");
  #  $stream->allow_full_federation_search(1); 
  #}
  #if($self->{'search_filter'}) { $stream->source_keyword_search($self->{'search_filter'}); }

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
  #$options{'class'} = "Experiment";
  $stream->stream_data_sources(%options);
  while(my $obj = $stream->next_in_stream) {
    if($obj->class eq "ExpressionDatatype") { next; }

    my $objDB = $obj->database;
    $objDB->disconnect();
    $objDB->user("zenbu_admin");
    $objDB->password("zenbu_admin");

    #next unless($obj->class eq "Experiment");
    $stream_count++;

    #TODO option to delete/replace not just append
    if(defined($self->{'delete_metadata_tag'})) {
      my $mds = $obj->metadataset->find_all_metadata_like($self->{'delete_metadata_tag'}, undef);
      foreach my $mdata (@$mds) {
        printf("deleting metadata : %s\n", $mdata->display_desc);
	if($store) { $mdata->unlink_from_object($obj); }
        $obj->metadataset->remove_metadata($mdata);
      }
    }


    if($self->{'add_metadata'}) {
      my $md_tag   = "keyword";
      my $md_value = $self->{'add_metadata'};
      if($self->{'add_metadata'} =~ /([\w:]+)\=(.+)/) {
        $md_tag   = $1;
        $md_value = $2;
      }
      printf("add metadata [%s] : [%s]\n", $md_tag, $md_value);
      my $md1 = $obj->metadataset->add_tag_data($md_tag, $md_value);
      $obj->metadataset->merge_metadataset($md1->extract_keywords);
    }

    if($self->{'show'}) { printf("%s\n", $obj->display_contents); }
    my $mdata_list = $obj->metadataset->metadata_list;
    foreach my $mdata (@$mdata_list) {
      if(!defined($mdata->primary_id)) { 
        if($self->{'debug'} > 2) { printf("  new metadata : %s\n", $mdata->display_desc); }
      }
    }

    if($store) {
      $obj->store_metadata;
      $obj->update;
    }
    $count++;
  }
  #if($count>0) { last; }

  printf("%d objects altered\n", $count);
}



