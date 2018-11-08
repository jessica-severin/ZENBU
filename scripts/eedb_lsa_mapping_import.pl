#!/usr/bin/perl -w
BEGIN{
    unshift(@INC, "/zenbu/src/MappedQuery_0.958/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}

use EEDB::Feature;
use EEDB::Tools::LSArchiveImport;


my $debug =0;
my $lsa = new EEDB::Tools::LSArchiveImport;
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
my $workdir = "/eeDB/input/LSA/mapping/" . $date;
mkdir($workdir);

my $dir = "/quality_control/current/library/";
opendir(QCDIR, $dir);
my @files= readdir(QCDIR);
foreach my $file (@files) {
  next if($file eq ".");  
  next if($file eq "..");  

  my $libname = $file;
  my $revision = "";

  $file = $dir . $file;
  #print($file, "\n");
  while(-l $file) {
    $file = readlink($file);
    if($file =~ /^\./) { $file = $dir . $file; }
    #printf("  follow link : %s\n", $file);
  }
  unless(-e $file) { next; }
  #if(-e $file) { print("  OK revision directory exists\n"); }

  $file .= "/". $libname . ".mapping.gz";
  unless(-e $file) { next; }
  if($debug and (-e $file)) { print("  OK mapping file exists\n"); }

  if(-e "/eeDB/dbs/" . $libname . ".oscdb") {
    printf("OSCDB %s already exists without revision\n", $libname) if($debug);
    next;
  }

  if($file =~ /revision\/(\d*)\//) {
    #print("  found revision\n");
    $revision = $1;
  }

  my $newname = $libname;
  if($revision) { $newname .= "_revision" . $revision; }
  $newname .= ".mapping.gz";

  my $new_oscdb = "/eeDB/dbs/" . $newname . ".oscdb";
  if(-e $new_oscdb) {
    print("OSCDB already exists :: %s\n", $new_oscdb) if($debug);
    next;
  }
  
  my $alt_oscdb = find_previous_library($libname);
  if($alt_oscdb) {
    printf("OSCDB exists as alternate version load [%s] => [%s]\n", $file, $alt_oscdb) if($debug);
    next;
  }

  #printf("TEST[%s]\n", $libname);
  my $experiments = $lsa->get_experiments_by_libraryID($libname);
  if(scalar(@$experiments)==0) {
    printf("%s :: no LSA experiments, probably commercial\n", $libname) if($debug);
    next;
  }

  $newname = $workdir ."/". $newname;
  printf("LOAD [%s] => [%s]\n", $file, $newname);
  my $sys = sprintf("cp -p %s %s", $file, $newname);
  print($sys, "\n");
  system($sys);

  $qsub = sprintf("qsub /zenbu/src/ZENBU_2.302/scripts/oscfile_clustersubmit.sh %s", $newname);
  print($qsub, "\n");
  system($qsub);

  next;

  

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
closedir(QCDIR);
exit(0);


sub find_previous_library {
  my $libname = shift;

  my $dir = "/eeDB/dbs/";
  opendir(DBSDIR, $dir);
  my @files= readdir(DBSDIR);
  foreach my $file (@files) {
    next if($file eq ".");  
    next if($file eq "..");  
    if($file =~ /$libname/) { closedir(DBSDIR); return $file; }
  }
  closedir(DBSDIR);
  return undef;
}


