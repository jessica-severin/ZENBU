#!/usr/bin/perl -w
BEGIN{
    unshift(@INC, "/zenbu/src/MappedQuery_0.958/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}

use Getopt::Long;
use EEDB::Feature;
use EEDB::Tools::LSArchiveImport;


my $debug =0;
my $lsa = new EEDB::Tools::LSArchiveImport;
my $library_name = undef;

GetOptions( 
    'lib:s'        =>  \$library_name,
    'debug:s'      =>  \$debug,
    'v'            =>  \$debug
    );


#$lsa->{'debug'} = 3;

#
# make a work directory for today
#
my ($Second, $Minute, $Hour, $Day, $Month, $Year, $WeekDay, $DayOfYear, $IsDST) = localtime(time);
$Year += 1900;
$Month++;
if(length($Month)==1) { $Month = "0" . $Month; }
if(length($Day)==1) { $Day = "0" . $Day; }
$date = "$Year$Month$Day";
printf("today is [%s]\n", $date);
my $workdir = "/eeDB2/input/LSA/mapping/" . $date;
mkdir($workdir);

my $libraries_submitted =0;
my $dir = "/quality_control/current/library/";
opendir(QCDIR, $dir);
my @files= reverse readdir(QCDIR);
foreach my $file (@files) {
  next if($file eq ".");  
  next if($file eq "..");  

  my $libname = $file;
  my $revision = "";

  if($library_name and ($library_name ne $libname)) { next; }

  $file = $dir . $file;
  while(-l $file) {
    $file = readlink($file);
    if($file =~ /^\./) { $file = $dir . $file; }
    #printf("  follow link : %s\n", $file);
  }
  unless(-e $file) { next; }
  printf("check [%s]  ", $file);

  if(find_previous_library($libname, "/zenbu/dbs3/genas_autoload")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs3/fantom5_autoload")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs3/oscfile_autoload")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs2/")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs2/genas_autoload")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs2/genas_autoload/fantom5")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs1/")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs1/genas_autoload")) { next; }
  if(find_previous_library($libname, "/zenbu/dbs1/genas_autoload/fantom5")) { next; }

  my $rtn = check_lsarchive_commercial($libname);
  if($rtn==2) { printf("  FANTOM5\n"); next; }
  if($rtn==1) { printf("  COMMERCIAL\n"); next; }
  if($rtn==0) { printf("  OSC\n"); }
  printf("  LOAD\n");

  if(-d $file . "/bwa_mapped_bed12_pe") {
    #GeNAS CAGEscan library
    genas_cagescan_bed12($file . "/bwa_mapped_bed12_pe/", $rtn);
    $libraries_submitted++;
  }
  elsif(-d $file . "/genome_mapped") {
    #printf("  2010 delve pipeline\n");
    load_2010_genome_mapping($file . "/genome_mapped/", $rtn);
    $libraries_submitted++;
  }
  elsif(-e $file . "/". $libname . ".mapping.gz") {
    my $infile = $file . "/". $libname . ".mapping.gz";
    #printf("  2009 mapping pipeline [%s]\n", $infile);
    load_2009_lsa_mapping($libname, $infile);
    $libraries_submitted++;
  }
}
closedir(QCDIR);
printf("\n===========\nsubmitted %d libraries for loading\n", $libraries_submitted);

exit(0);

###############################################################################

sub check_lsarchive_commercial {
  my $libname = shift;

  #printf("TEST[%s]\n", $libname);
  my $experiments = $lsa->get_experiments_by_libraryID($libname);
  if(scalar(@$experiments)==0) {
    printf("  [%s] :: no LSA experiments, probably commercial\n", $libname) if($debug);
    return 1;
  }
  my $count=0;
  foreach my $experiment (@$experiments) {
    if($experiment->metadataset()->has_metadata_like("osc:LSArchive_application_application_type", "FANTOM5")) { return 2; }
    $count++;
    #printf("%s\n", $experiment->xml());
  }
  if($count>0) { 
    #got experiments so not commercial
    return 0; 
  } else { return 2; } #FANTOM5
}


sub find_previous_library {
  my $libname = shift;
  my $dir     = shift;

  unless($dir) { return undef; }

  opendir(DBSDIR, $dir);
  my @files= readdir(DBSDIR);
  foreach my $file (@files) {
    next if($file eq ".");  
    next if($file eq "..");  
    if($file =~ /$libname/) { 
      closedir(DBSDIR); 
      printf("  ALREADY_LOADED in %s\n", $dir);
      printf("  OSCDB already loaded revision [%s] in %s\n", $file, $dir) if($debug);
      return $file; 
    }
  }
  closedir(DBSDIR);
  return undef;
}


sub load_2009_lsa_mapping {
  my $libname = shift;
  my $file = shift;

  unless(-e $file) { next; }

  my $revision = "";
  if($file =~ /revision\/(\d*)\//) {
    #print("  found revision\n");
    $revision = $1;
  }

  my $newname = $libname;
  if($revision) { $newname .= "_revision" . $revision; }
  $newname .= ".mapping.gz";

  $newname = $workdir ."/". $newname;
  printf("  LOAD [%s] => [%s]\n", $file, $newname);

  my $sys = sprintf("ln -s %s %s", $file, $newname);
  print($sys, "\n");
  system($sys);

  #$cmd = sprintf("qsub /zenbu/src/ZENBU_2.302/scripts/oscfile_clustersubmit.sh %s", $newname);
  $cmd = sprintf("/zenbu/src/ZENBU_2.302/scripts/oscfile_localbuild.sh %s", $newname);
  print($cmd, "\n\n");
  system($cmd);

  return;

  #foreach my $experiment (@$experiments) {
  #  #if($metadata) { print($experiment->display_contents,"\n"); }
  #  print($experiment->display_desc,"\n");
  #}

  next;

  my ($dev,$ino,$mode,$nlink,$uid,$gid,$rdev,$size,$atime,$mtime,$ctime,$blksize,$blocks) = lstat($file);
  my ($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = localtime($mtime);
  $year += 1900;
  if($mon < 10) { $mon = "0".$mon; }
  if($mday < 10) { $mday = "0".$mday; }
  my $fdate = $year . $mon . $mday ."v1";

  printf("%s\t%s\t%s\n", $mtime, $fdate, $file);
}


sub load_2010_genome_mapping {
  my $dir = shift;
  my $rtncode = shift;

  opendir(MAPDIR, $dir);
  my @bam_files= readdir(MAPDIR);
  foreach my $name (@bam_files) {
    next if($name eq ".");  
    next if($name eq "..");  
    next unless($name =~ /\.bam$/);  
    my $bampath = $dir . $name;
    printf("  LOAD [%s]\n", $bampath);
    #my $cmd = sprintf("qsub /zenbu/src/ZENBU_2.302/scripts/genas_bam_clustersubmit.sh %s", $bampath);
    my $cmd = sprintf("/zenbu/src/ZENBU_2.302/scripts/genas_bam_localbuild.sh %s", $bampath);
    if($rtncode and $rtncode==2) {  #FANTOM5
      #$cmd = sprintf("qsub /zebu/src/ZENBU_2.302/scripts/genas_fantom5_clustersubmit.sh %s", $bampath);
      $cmd = sprintf("/zebu/src/ZENBU_2.302/scripts/genas_fantom5_localbuild.sh %s", $bampath);
    }
    print($cmd, "\n");
    system($cmd);
  }
  closedir(MAPDIR);
}


sub genas_cagescan_bed12 {
  my $dir = shift;
  my $rtncode = shift;

  opendir(MAPDIR, $dir);
  my @bed_files= readdir(MAPDIR);
  foreach my $name (@bed_files) {
    next if($name eq ".");  
    next if($name eq "..");  
    next unless($name =~ /\.bed$/);  
    my $bedpath = $dir . $name;
    printf("  LOAD [%s]\n", $bedpath);
    #my $cmd = sprintf("qsub /zenbu/src/ZENBU_2.302/scripts/genas_cagescan_clustersubmit.sh %s", $bedpath);
    my $cmd = sprintf("/zenbu/src/ZENBU_2.302/scripts/genas_cagescan_localbuild.sh %s", $bedpath);
    print($cmd, "\n");
    system($cmd);
  }
  closedir(MAPDIR);
}



