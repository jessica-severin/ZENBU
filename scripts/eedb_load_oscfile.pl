#!/usr/bin/perl -w 
BEGIN{
    unshift(@INC, "/zenbu/src/ZENBU_2.6.3/lib");
}


=head1 NAME - eedb_load_oscfile.pl

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

use EEDB::Tools::MultiLoader;
use EEDB::Tools::OSCFileParser;

no warnings 'redefine';
$| = 1;

my $help;
my $passwd = '';

my $file = "";
my $assembly_name = '';
my $url = undef;
my $update = 0;
my $store = 0;
my $debug=0;
my $sparse =0;
my $default_data_type = "raw";

my $fsrc = undef;
my $fsrc_name = undef;
my $display_interval = 1000;
my $exp_prefix = undef;
my ($library_id, $sequencing_id);
my $platform = '';
my $sym_type = undef;
my $skip_metadata = 0;

my @exp_column_types = ();
my $exp_col_count = 0;

GetOptions( 
            'url:s'        =>  \$url,
            'file:s'       =>  \$file,
            'assembly:s'   =>  \$assembly_name,
            'asm:s'        =>  \$assembly_name,
            'fsrc:s'       =>  \$fsrc_name,
            'datatype:s'   =>  \$default_data_type,
            'exp_prefix:s' =>  \$exp_prefix,
            'symtype:s'    =>  \$sym_type,
            'platform:s'   =>  \$platform,
            'update'       =>  \$update,
            'store'        =>  \$store,
            'sparse'       =>  \$sparse,
            'skipmetadata' =>  \$skip_metadata,
            'debug:s'      =>  \$debug,
            'v'            =>  \$debug,
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

if(!$file or !(-e $file)) {
  printf("ERROR: must specify -file for data loading\n\n");
  usage();
}

printf("\n==============\n");
printf("eeDB:: %s\n", $eeDB->url);

my $oscfile = EEDB::Tools::OSCFileParser->new;
$oscfile->{'debug'}= $debug;
$oscfile->{'_outputmode'}= "feature";
$oscfile->database($eeDB);
$oscfile->init_from_file($file, "platform" => $platform, 'skip_metadata'=>$skip_metadata);
if($debug>1) {
  print("\n============\n");
  print($oscfile->display_contents);
  print("\n====== experiments\n");
  foreach my $exp (@{$oscfile->experiments}) {
    print($exp->display_contents);
  }
  print("\n====== feature_source\n");
  print($oscfile->feature_source->display_contents);
}

my $assembly = EEDB::Assembly->fetch_by_name($eeDB, $oscfile->assembly_name);
unless($assembly) { printf("error fetching assembly [%s]\n\n", $assembly_name); usage(); }
$assembly->display_info;

$fsrc = $oscfile->feature_source;
if(!($fsrc->check_exists_db($eeDB)) and $store) { $fsrc->store($eeDB); }
$fsrc->display_info;

foreach my $experiment (@{$oscfile->experiments}) {
  if(!($experiment->check_exists_db($eeDB)) and $store) { $experiment->store($eeDB); }
  $experiment->display_info;
}
#
# OK ready to process now
#

my $error_path = $file . ".errors";
open(ERRORFILE, ">>", $error_path);

#calc_exp_total_express();

load_oscfile_datarows();

close(ERRORFILE);

exit(1);

#########################################################################################

sub usage {
  print "eedb_load_oscfile.pl [options]\n";
  print "  -help               : print this help\n";
  print "  -url <url>          : URL to database\n";
  print "  -file <path>        : path to a OSCfile\n";
  print "  -fsrc <name>        : name of the FeatureSource for column 1 data\n";
  print "eedb_load_oscfile.pl v2.3.2\n";
  
  exit(1);  
}

#########################################################################################


sub load_oscfile_datarows {
  printf("============== load_oscfile_datarows ==============\n");
  my $linecount=0;
  my $line;
  my $multiLoad = new EEDB::Tools::MultiLoader;
  $multiLoad->database($eeDB);
  $multiLoad->do_store($store);
 
  my $starttime = time();
    
  my $gz = gzopen($file, "rb") ;
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    next if($line =~ /^\#/);
    next if($line eq "");
    last if(($debug>2) and ($linecount>10));
    $linecount++;
    if($linecount == 1) { next; }

    $line =~ s/\r//g;
    
    my $feature = $oscfile->convert_dataline_to_feature($line);
    my $chrom = EEDB::Chrom->fetch_by_name_assembly_id($eeDB, $feature->chrom_name, $assembly->id);
    unless($chrom) { #create the chromosome;
      $chrom = new EEDB::Chrom;
      $chrom->chrom_name($feature->chrom_name);
      $chrom->assembly($assembly);
      $chrom->chrom_type('chromosome');
      $chrom->store($eeDB) if($store);
      printf("need to create chromosome :: [%s]\n", $feature->chrom_name);
    }
    $feature->chrom($chrom);
     
    if($debug and ($debug == 2)) { $feature->display_info; }
    if($debug and ($debug > 2)) { print($feature->display_contents); }

    if($debug>1) {
      foreach my $express (sort {$a->experiment->id <=> $b->experiment->id} @{$feature->get_expression_array}) {
        printf("   %s\n", $express->display_desc);
      }
    }
    $multiLoad->store_feature($feature);    

    if($linecount % $display_interval == 0) { 
      my $rate = $linecount / (time() - $starttime);
      printf("%10d (%1.2f x/sec): %s\n", $linecount, $rate, $feature->display_desc); 
    }
  }
  $gz->gzclose;
  $multiLoad->flush_buffers;
  
  $fsrc->update_feature_count;

  my $total_time = time() - $starttime;
  my $rate = $linecount / $total_time;
  printf("TOTAL: %10d :: %1.3f min :: %1.2f x/sec\n", $linecount, $total_time/60.0, $rate);
}


###################################
#
# experiment related section
#
###################################

# simple routine loops through the file calculating the total tag counts
# to be used in TPM calculations
sub calc_exp_total_express {  
  printf("============== calc_exp_total_express ==============\n");
  my $starttime = time();
  my $linecount=0;
  my $line;  
  my $gz = gzopen($file, "rb") ;
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    next if($line =~ /^\#/);
    next if($line eq "");
    $linecount++;
    if($linecount == 1) { next; }
    $line =~ s/\r//g;
    
    #sequence        subject strand  start   end     edit    subject_sequence        map_position    A       E       P3      P5      P7      P9      P12     P18     P28     total
    #AAAAAAAAAAAAACTTTCTCAAGAA       chr12   -       26364765        26364789        M0AG    gaaaaaaaaaaaactttctcaagaa       1       0       1       0       0       0       0       0       0       0       1
    my ($seqtag, $chrname, $strand, $start, $end, $edit, $subj_seq, @expression)  = split(/\t/, $line);
    
    my $mapcount = $expression[0];
    unless($mapcount) {  printf("error: %s\n", $line); }
    for(my $x=1; $x<$exp_col_count; $x++) {
      my $expobj = $exp_column_types[$x];      
      $expobj->{'total'} += $expression[$x] / $mapcount ;
      if($mapcount == 1) {
        $expobj->{'singlemap_total'} += $expression[$x];
      }
    }
 
    if($linecount % 50000 == 0) { 
      my $rate = $linecount / (time() - $starttime);
      printf("totalcalc %10d (%1.2f x/sec)\n", $linecount, $rate); 
    }
  }
  $gz->gzclose;
  
  for(my $x=1; $x<$exp_col_count; $x++) {
    my $expobj = $exp_column_types[$x];      
    my $experiment = $expobj->{'experiment'};
    
    my $total = sprintf("%1.2f", $expobj->{'total'});
    $expobj->{'total'} = $total; #rounds to 2 decimal places
    
    #my $mdata = $experiment->metadataset->add_tag_data("total_tag_count", $total);    
    my $mdata = $experiment->metadataset->add_tag_data("total_mapnorm_tagcnt", $total);    
    unless($mdata->check_exists_db($eeDB)) {
      $experiment->store_metadata if($store);
    }
    #$mdata = $experiment->metadataset->add_tag_data("total_singlemap_tag_count", $expobj->{"singlemap_total"});
    $mdata = $experiment->metadataset->add_tag_data("total_singlemap_tagcnt", $expobj->{"singlemap_total"});
    
    
    
    
    unless($mdata->check_exists_db($eeDB)) {
      $experiment->store_metadata if($store);
    }

    $experiment->display_info;
    printf("    %1.2f total tag count\n", $total);
    printf("    %1.2f total singlemap tag count\n", $expobj->{"singlemap_total"});
    printf("  %1.3f%% singlemap\n", 100* $expobj->{"singlemap_total"}/ $total);
  }

  my $total_time = time() - $starttime;
  my $rate = $linecount / $total_time;
  printf("TOTAL: %10d :: %1.3f min :: %1.2f x/sec\n", $linecount, $total_time/60.0, $rate);
}     


