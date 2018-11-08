#!/usr/bin/perl -w 
BEGIN{
    unshift(@INC, "/zenbu/src/MappedQuery_0.958/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}


use strict;
use warnings;
use Getopt::Long;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::Database;
use EEDB::SPStream::OSCFileDB;
use EEDB::Tools::LSArchiveImport;

no warnings 'redefine';
$| = 1;

my $help;
my $file = undef;
my $store = 1;
my $platform = '';
my $fid = undef;
my $assembly_name = undef;
my $debug = 1;
my $builddir = undef;
my $deploydir = undef;
my $registry_url = undef;
my $workfile = undef;
my $bed_input = undef;
my $delve_input = undef;
my $osclsa = undef;
my $experiment_name = undef;
my $score_as_expression = undef;
my $single_tagmap = undef;
my $default_mapcount = undef;
my $display_name = undef;
my $library_id = undef;
my $external_keywords = undef;
my $genas_files = undef;

my $metadataset = new EEDB::MetadataSet;

GetOptions( 
            'file:s'           =>  \$file,
            'id:s'             =>  \$fid,
            'bed'              =>  \$bed_input,
            'delve'            =>  \$delve_input,
            'LSA'              =>  \$osclsa,
            'GeNAS'            =>  \$genas_files,
            'keywords:s'       =>  \$external_keywords,
            'builddir:s'       =>  \$builddir,
            'deploydir:s'      =>  \$deploydir,
            'registry:s'       =>  \$registry_url,
            'store'            =>  \$store,
            'platform:s'       =>  \$platform,
            'library:s'        =>  \$library_id,
            'score_express:s'  =>  \$score_as_expression,
            'single_tagmap'    =>  \$single_tagmap,
            'mapcount:s'       =>  \$default_mapcount,
            'display_name:s'   =>  \$display_name,
            'expname:s'        =>  \$experiment_name,
            'assembly:s'       =>  \$assembly_name,
            'asm:s'            =>  \$assembly_name,
            'v'                =>  \$debug,
            'debug:s'          =>  \$debug,
            'help'             =>  \$help
            );

if ($help) { usage(); }

if(!defined($file)) {
  printf("ERROR:: must specify OSCTable file to build database\n\n");
  usage();
}

my $total_starttime = time();

unless($builddir and (-d $builddir)) {
  $builddir = "/tmp";
}
unless($builddir and (-d $builddir)) {
  printf("ERROR:: builddir [%s] does not exist\n\n", $builddir);
  usage();
}

printf("file : %s\n", $file);
if($file =~ /(.+)\:(.+)/) { 
  printf("copy input from remote location\n   host : %s\n   file : %s\n", $1,$2);

  $workfile = $file;
  if((my $p2=rindex($file, "/")) != -1) {
    $workfile = $builddir . substr($file, $p2);
  }
  printf("prepare local workfile :: %s\n", $workfile);
  my $cmd = "scp " . $file . " ". $workfile;
  print($cmd, "\n");
  system($cmd);
  $file = $workfile;
} 

if(!(-e $file)) {
  printf("ERROR:: input file [%s] does not exist\n\n", $file);
  usage();
}

if($genas_files) {
  #uses samtools to convert BAM to SAM and to apply a -q quality cutoff filter
  #replaces $file with new sam file
  genas_get_loading_info();  
}


if($file =~ /\.bam/) {
  #uses samtools to convert BAM to SAM and to apply a -q quality cutoff filter
  #replaces $file with new sam file
  preprocess_bam_file();
}

if($library_id) {
  $metadataset->add_tag_symbol("osc_libID", $library_id);
}
if($external_keywords) {
  my $md = EEDB::Metadata->new("keywords", $external_keywords);
  $metadataset->merge_metadataset($md->extract_keywords);
}

my %options = ("platform" => $platform,
               "metadata" => $metadataset,
               "deploy_dir" => $deploydir,
               "build_dir" => $builddir,
               "assembly" => $assembly_name,
               "experiment_name" => $experiment_name,
               "store" => $store);
if($display_name) { $options{"display_name"} = $display_name; }
if($score_as_expression) { $options{"score_as_expression"} = $score_as_expression; }
if($single_tagmap) { 
  $options{"single_tagmap"} = 1; 
  $options{"default_mapcount"} = 1;
}
if($default_mapcount) { $options{"default_mapcount"} = $default_mapcount; }
#$options{"experiment_name"} = $experiment_name;


my $eeDB = EEDB::SPStream::OSCFileDB->new;
$eeDB->{'debug'}= $debug;
my $url = $eeDB->create_db_for_file($file, %options);
if($url) { printf("return url : %s\n", $url); }

if($osclsa) { synchronize_with_OSC_LSArchive($eeDB); }

my $total_time = time() - $total_starttime;
printf("BUILD FINISH: %1.3f min\n", $total_time/60.0);

create_and_register_peer($url);

#cleanup local input workfile
if(defined($workfile) and (-e $workfile)) {
  my $cmd = "rm ". $workfile;
  print($cmd, "\n");
  system($cmd);
}

$total_time = time() - $total_starttime;
printf("TOTAL RUNTIME: %1.3f min\n", $total_time/60.0);

exit(1);
#########################################################################################

sub usage {
  print "eedb_create_OSCFileDB.pl [options]\n";
  print "  -help                     : print this help\n";
  print "  -file <path>              : path to a OSCFile to be used for creating database\n";
  print "  -builddir <path>          : path to local directory where file building takes place\n";
  print "  -deploydir <path>         : final directory where oscdb is copied back to when completed\n";
  print "  -registry <URL>           : eeDB URL of registry database used to record new peer in federation\n";
  print "  -platform <name>          : name of the experimental platform\n";
  print "  -assembly <name>          : name of the genome assembly for this file (eg hg18 or mm9)\n";
  print "  -single_tagmap            : enable simple expression for files with single sequence tags mapped to single locations\n";
  print "  -score_express <exptype>  : eedb:score column is mapped to expression of type <exptype>\n";
  print "  -display_name <name>      : nice display name for FeatureSource and Experiments\n";
  print "  -LSA                      : enable RIKEN OSC LSArchive synchronization\n";
  print "  -GeNAS                    : GeNAS production file automation prequery\n";
  print "eedb_create_OSCFileDB.pl v1.0\n";
  
  exit(1);  
}

#########################################################################################

sub synchronize_with_OSC_LSArchive {
  my $oscdb = shift;

  my $LSA = new EEDB::Tools::LSArchiveImport;
  $LSA->{'debug'} = $debug;

  my $count=0;
  my $fail_count=0;
  my $stream_count=0;

  my $stream = $oscdb;
  $stream->stream_data_sources('class' => "Experiment");
  while(my $experiment = $stream->next_in_stream) {
    next unless($experiment->is_active eq 'y');
    next unless($experiment->class eq "Experiment");

    if($experiment->platform eq "TFBS_scan") { next; }
    if($experiment->platform eq "SQRL_RNAseq") { next; }
    if($experiment->exp_accession =~ /_mapcount/) { next; }
    $stream_count++;

    my $libID_md = $experiment->metadataset->find_metadata('osc:LSArchive_library_osc_lib_id');
    if($libID_md) { printf("ALREADY SYNCED : %s\n", $experiment->display_desc); next; }

    my $rtnexp = $LSA->sync_metadata_for_experiment($experiment);
    if($rtnexp) {
      $experiment->store_metadata;
      $experiment->update;
      printf("SYNC OK : %s", $experiment->display_desc);
      $count++;
    } else {
      $fail_count++;
      printf("FAIL    : %s", $experiment->display_desc);
    }
    if($libID_md) { printf("  :: RE-SYNC"); }
    print("\n");
  }
  printf("%d experiments synced (new)\n", $count);
  if($fail_count < $stream_count) {
    printf("%d / %d experiments FAILED to sync\n", $fail_count, $stream_count);
  } else {
    printf("%d experiments SYNCED OK\n", $stream_count);
  }
}


sub create_and_register_peer {
  my  $url = shift;

  if(!$registry_url) { return; }
  unless($url) { return; }

  printf("=== create_and_registry_peer\n");
  printf("  url :: %s\n", $url);

  my $registryDB = EEDB::Database->new_from_url($registry_url);
  unless($registryDB and $registryDB->test_connection) {
    printf(STDERR "error with registry\n");
    return;
  }
  my $registryPeer = EEDB::Peer->fetch_self($registryDB);
  printf("  registry ::   %s\n", $registryPeer->xml);

  my $eeDB = EEDB::Database->new_from_url($url);
  unless($eeDB and $eeDB->test_connection) {
    printf(STDERR "error with connecting to newly created OSCDB\n");
    return;
  }

  my $peer = EEDB::Peer->create_self_peer_for_db($eeDB);
  unless($peer) { 
    printf(STDERR "failed to create peer for OSCDB\n");
    return; 
  }
  print($peer->xml, "\n");

  #now register into eedb_registry
  my $peer_copy = $peer->copy;
  $peer_copy->database(undef);
  $peer_copy->store($registryDB);
  print($url,"\n");
}


sub preprocess_bam_file {
  printf("bam file : [%s]\n", $file);
  unless($builddir and (-d $builddir)) {
    printf("no builddir specified so using /tmp\n");
    $builddir = "/tmp";
  }

  my $filename = $file;
  if((my $p2=rindex($file, "/")) != -1) {
    $filename = substr($file, $p2);
  }
  if($filename =~ /(.*)\.bam/) { $filename = $1; }
  printf("  file basename [%s]\n", $filename);
  my $samfile = $builddir . $filename . ".sam";
  printf("  prepare sam file [%s]\n", $samfile);

  $workfile = $samfile;  #so will be deleted at end
  my $cmd = "/usr/bin/samtools view -h -q 10 $file > $samfile";
  printf($cmd, "\n");
  system($cmd);
  $file = $samfile;
}


sub genas_get_loading_info {
  #genas generated file without proper metadata.
  #must parse filename for libraryID, sampleID, barcode
  #then must parse <libid>.data.xml for genome assembly information
  #store directly into $metadataset
  printf(STDERR "genas file : [%s]\n", $file);

  my $filename = $file;
  my $genas_dir = $file;
  if((my $p2=rindex($filename, "/")) != -1) {
    $filename = substr($filename, $p2+1);
    $genas_dir = substr($file, 0, $p2);
    $p2=rindex($genas_dir, "/");
    $genas_dir = substr($genas_dir, 0, $p2+1);
  }
  #remove filetype extension
  if((my $p2=rindex($filename, ".")) != -1) {
    $filename = substr($filename, 0, $p2);
  }
  
  my $p1=index($filename, ".");
  my $p2=rindex($filename, ".");
  if(($p1 == -1) || ($p2 == -1) || ($p1 == $p2)) { 
    printf(STDERR "error extracting GeNAS library.sample.barcode information\n");
    exit(-1);
  }
  
  my $libID    = substr($filename, 0, $p1);
  my $barcode  = substr($filename, $p2+1);
  my $sampleID = substr($filename, $p1+1, $p2-$p1-1);
  
  printf(STDERR "libID    [%s]\n", $libID);
  printf(STDERR "sampleID [%s]\n", $sampleID);
  printf(STDERR "barcode  [%s]\n", $barcode);
  
  $metadataset->add_tag_symbol("osc_libID", $libID);
  $metadataset->add_tag_symbol("osc:LSA_sample_barcode", $barcode);
  #$metadataset->add_tag_symbol("osc-some-sample-tag", $sampleID);

  #
  # next get genome assembly from <libid>.data.xml
  # <PARAMETER NAME="assembly_name" TYPE="ASSEMBLY" VALUE="hg19"/>
  #
  my $dataxml = $genas_dir . $libID . ".data.xml";
  if(!(-e $dataxml)) { 
    printf(STDERR "error openiing <libid>.data.xml file to extract assembly_name for mapping\n");
    exit(-1);
  }
  #printf(STDERR "%s\n", $dataxml);
  
  #TODO parse/grep the XML file for the assembly_name tag
  open(XMLFILE, $dataxml);
  while(my $line = lc(<XMLFILE>)) {
    chomp($line);
    if($line =~ /parameter(.+)assembly_name(.+)value=\"(.+)\"/) {
      #printf(STDERR "assembly line : [%s]\n", $line);
      printf(STDERR "assembly [%s]\n", $3);
      $assembly_name = $3;
      last;
    }
  }
  close(XMLFILE);
}


1;
