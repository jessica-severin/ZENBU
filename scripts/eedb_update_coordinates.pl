#!/usr/bin/perl -w 
BEGIN{
  unshift(@INC, "/zenbu/src/MappedQuery/lib");
  unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}

=head1 NAME - eedb_update_coordinates.pl

=head1 SYNOPSIS

=head1 DESCRIPTION
 input file is in BED6 format. uses name of BED line to lookup feature in database
 and updates corrdinates

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
use Getopt::Long;
use Data::Dumper;
use Switch;

use Bio::SeqIO;
use Bio::SimpleAlign;
use Bio::AlignIO;
use File::Temp;
use Compress::Zlib;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::Database;
use MQdb::MappedQuery;

use EEDB::FeatureSource;
use EEDB::EdgeSource;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Experiment;
use EEDB::Expression;
use EEDB::Tools::MultiLoader;

no warnings 'redefine';
$| = 1;

my $help;
my $passwd = '';

my $file = undef;
my $url = undef;
my $store = 0;
my $debug=0;

my $mode = "feature";

my $fsrc = undef;
my $fsrc_name = undef;
my $display_interval = 100;

my @data_column_types = ();
my $primary_datatype = undef;
my $data_col_count = 0;

GetOptions( 
            'url:s'        =>  \$url,
            'file:s'       =>  \$file,
            'fsrc:s'       =>  \$fsrc_name,
            'mode'         =>  \$mode,
            'store'        =>  \$store,
            'v'            =>  \$debug,
            'debug:s'      =>  \$debug,
            'help'         =>  \$help
            );


if ($help) { usage(); }

my $eeDB = undef;
if($url) {
  $eeDB = EEDB::Database->new_from_url($url);
} 
unless($eeDB) { 
  printf("ERROR: connection to database\n\n");
  usage(); 
}

if(($mode ne "feature") and ($mode ne "experiment")) {
  printf("ERROR: unknown mode[%s]\n\n", $mode);
  usage(); 
}

printf("\n==============\n");

if(defined($fsrc_name)) {
  my $category = undef;
  if($fsrc_name =~ /(\w+)\:\:(.+)/) {
    $category = $1;
    $fsrc_name = $2;
    $fsrc = EEDB::FeatureSource->fetch_by_category_name($eeDB, $1, $2);
  } else {
    $fsrc = EEDB::FeatureSource->fetch_by_name($eeDB, $fsrc_name);
  }
  unless($fsrc){
    $fsrc = new EEDB::FeatureSource;
    $fsrc->name($fsrc_name);
    $fsrc->category($category);
    $fsrc->import_source(""); 
    $fsrc->store($eeDB) if($store);
    printf("Needed to create:: ");
  }
  $fsrc->display_info;
} else {
  printf("ERROR must specify -fsrc param\n\n");
  usage();
}


if($file and (-e $file)) { 
  my $error_path = $file . ".errors";
  open(ERRORFILE, ">>", $error_path);
  update_coordinates();
  close(ERRORFILE);
} else {
  printf("ERROR: must specify file for data loading\n\n");
  usage(); 
}

exit(1);

#########################################################################################

sub usage {
  print "eedb_update_coordinates.pl [options]\n";
  print "  -help               : print this help\n";
  print "  -url <url>          : URL to database\n";
  print "  -fsrc <name>        : name of the FeatureSource\n";
  print "  -file <path>        : path to a BED6 file with new coordinates\n";
  print "  -store              : store updates into database\n";
  print "  -v                  : simple debugging output\n";
  print "eedb_update_coordinates.pl v1.0\n";
  
  exit(1);  
}

#########################################################################################


sub update_coordinates {

  printf("==============\n");
  my $starttime = time();
  my $linecount=0;
  my $gz = gzopen($file, "rb") ;
  my $line;
  my $assembly;
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    next if($line =~ /^\#/);
    $linecount++;
    $line =~ s/\r//g;
    
    #BED6 style file
    my ($chrom_name, $start, $end, $name, $score, $strand) = split(/\s/, $line);

    $start += 1; #BED is 0base, ZENBU is 1base
    
    #1. chrom - The name of the chromosome (e.g. chr3, chrY, chr2_random) or scaffold (e.g. scaffold10671).
    #2. chromStart - The starting position of the feature in the chromosome or scaffold. The first base in a chromosome is numbered 0.
    #3. chromEnd - The ending position of the feature in the chromosome or scaffold. The chromEnd base is not included in the display of the feature. For example, the first 100 bases of a chromosome are defined as chromStart=0, chromEnd=100, and span the bases numbered 0-99. 
    #4. name - Defines the name of the BED line. This label is displayed to the left of the BED line in the Genome Browser window when the track is open to full display mode or directly to the left of the item in pack mode.
    #5. score - A score between 0 and 1000. If the track line useScore attribute is set to 1 for this annotation data set, the score value will determine the level of gray in which this feature is displayed (higher numbers = darker gray).
    #6. strand - Defines the strand - either '+' or '-'.

    my ($feature, $other) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB, $fsrc, $name, "EntrezID")};
    if(!defined($feature)) {
      #printf(ERRORFILE "ERROR LINE: %s\n  feature [%s] not in database", $line, $name);
      printf("ERROR LINE: %s == feature [%s] not in database\n", $line, $name);
      next;
    }
    if(defined($other)) { 
      #printf(ERRORFILE "ERROR LINE: %s\n  feature [%s] in database more than once for FeatureSource [%s]", $line, $name, $fsrc->name); 
      printf("ERROR LINE: %s == feature [%s] in database more than once for FeatureSource [%s]\n", $line, $name, $fsrc->name); 
    }

    if($debug) { printf("%s %s", $feature->primary_name(), $feature->chrom_location()); }
    
    if(!$assembly && ($feature->chrom()->assembly())) { $assembly = $feature->chrom()->assembly(); }
    
    if($feature->chrom_name() ne $chrom_name) {
      if($debug) { printf(" ==CHROM changed=="); }
      my $chrom = EEDB::Chrom->fetch_by_assembly_chrname($assembly, $chrom_name);
      $feature->chrom($chrom);
    }
    
    $feature->chrom_start($start);
    $feature->chrom_end($end);
    $feature->strand($strand);
    
    if($store) { $feature->update_location(); }
    
    if($debug == 1) { printf(" => %s\n", $feature->chrom_location()); }
    if($debug >= 2) { printf("\n%s", $feature->display_contents()); }

    if(!$debug && ($linecount % $display_interval == 0)) { 
      my $rate = $linecount / (time() - $starttime);
      printf("%10d (%1.2f x/sec)\n", $linecount, $rate); 
    }
  }
  $gz->gzclose();

  my $total_time = time() - $starttime;
  my $rate = $linecount / $total_time;
  printf("TOTAL: %10d :: %1.3f min :: %1.2f x/sec\n", $linecount, $total_time/60.0, $rate);
}

