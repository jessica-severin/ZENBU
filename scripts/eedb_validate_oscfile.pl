#!/usr/bin/perl -w 
BEGIN{
    unshift(@INC, "/zenbu/src/MappedQuery/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}

use strict;
use warnings;
use Getopt::Long;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::Tools::OSCFileParser;


no warnings 'redefine';
$| = 1;

my $help;
my $well = undef;
my $plate = undef;
my $design_id = undef;
my $postgate = 0;
my $passwd = '';
my $rna_list = [];
my $align_id = undef;
my $known = 0;
my $file = undef;
my $url = undef;
my $store = 1;
my $platform = '';
my $assembly = undef;
my $fid = undef;
my $loc = undef;
my $debug = 1;
my $streamsources = 0;
my $skipmetadata = 0;
my $calc_totals = 0;
my $convert_eedbns = 1;

my $experiment_name = undef;
my $score_as_expression = undef;
my $single_tagmap = undef;
my $display_name = undef;
my $osclsa = undef;


GetOptions( 
            'file:s'       =>  \$file,
            'platform:s'   =>  \$platform,
            'assembly:s'   =>  \$assembly,
            'asm:s'        =>  \$assembly,
            'skipmetadata' =>  \$skipmetadata,
            'eedbns'       =>  \$convert_eedbns,
            'LSA'          =>  \$osclsa,
            'v'            =>  \$debug,
            'debug:s'      =>  \$debug,
            'totals'       =>  \$calc_totals,
            'score_express:s'  =>  \$score_as_expression,
            'single_tagmap'    =>  \$single_tagmap,
            'display_name:s'   =>  \$display_name,
            'help'         =>  \$help
            );

if ($help) { usage(); }

unless($file and (-e $file)) {
  print("ERROR: must specify -file to validate\n\n");
  usage();
} 

my $metadataset = new EEDB::MetadataSet;
if($osclsa) {
  my $libID = $file;
  if($libID =~ /(.+)\.gz$/) { $libID = $1; }
  if(($libID =~ /(.+)\.osc/) or ($libID =~ /(.+)\.mapping/) or ($libID =~ /(.+)\.tsv/)) {
    $libID = $1;
  } elsif($libID =~ /(.+)\.(\w+)$/) {
    $libID = $1;
  }
  $metadataset->add_tag_symbol("osc_libID", $libID);
}

my %options = ("platform" => $platform,
               "metadata" => $metadataset,
               "experiment_name" => $experiment_name,
               'skip_metadata'=>$skipmetadata,
               'eedbns'=>$convert_eedbns, 
               'assembly'=>$assembly,
               "store" => $store);
if($display_name) { $options{"display_name"} = $display_name; }
if($score_as_expression) { $options{"score_as_expression"} = $score_as_expression; }
if($single_tagmap) { $options{"single_tagmap"} = 1; printf("single_tagmap turned ON\n"); }
#$options{"experiment_name"} = $experiment_name;

my $oscfile = EEDB::Tools::OSCFileParser->new;
$oscfile->{'debug'}= $debug;
$oscfile->init_from_file($file, %options);
print("\n====== experiments\n");
foreach my $exp (@{$oscfile->experiments}) { $exp->display_info; }
print("\n====== feature_source\n");
$oscfile->feature_source->display_info;

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
if($calc_totals) {
  $oscfile->calc_expression_totals;
  print("\n====== experiments\n");
  foreach my $exp (@{$oscfile->experiments}) {
    print($exp->display_contents);
  }
}

printf("\n===== file status\n");
if($oscfile->assembly_name) { printf("-- genome : %s\n", $oscfile->assembly_name); }
else { print("-- FAILED no genome assembly set\n"); }

if($oscfile->{'_has_genome-coordinate'}) { printf("-- OK has %s genome-coordinate namespace\n", $oscfile->{'_coordinate_system'}); }
else { print("-- FAILED genome-coordinate namespace check\n"); }

if($oscfile->{'_do_mapnormalize'}) { print("-- can perform simple map normalization\n"); }

if($oscfile->{'_has_expression'}) { print("-- expression data present\n"); }
else { print("-- WARNING no expression data present\n"); }

exit;



exit(1);
#########################################################################################

sub usage {
  print "eedb_validate_oscfile.pl [options]\n";
  print "  -help               : print this help\n";
  print "  -file <path>        : OSCfile to validate\n";
  print "  -platform <path>    : experimental platform\n";
  print "  -totals             : perform scan to calculate totals for experiments\n";
  print "  -v                  : basic debug messages\n";
  print "  -debug <level>      : verbose debug messages\n";
  print "eedb_validate_oscfile.pl v1.0\n";
  
  exit(1);  
}
