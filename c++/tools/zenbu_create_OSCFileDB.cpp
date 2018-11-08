#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <rapidxml_print.hpp>  //rapidxml must be include before boost
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>


#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <MQDB/DBStream.h>
#include <EEDB/Assembly.h>
#include <EEDB/Chrom.h>
#include <EEDB/Metadata.h>
#include <EEDB/Symbol.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Datatype.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/RegionServer.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>        _parameters;

void build_oscdb();
void usage();
void preprocess_bam_file();

int main(int argc, char *argv[]) {
  MQDB::Database  *db;
  dynadata  value;
  int             loop=10000;
  int             chrom_id;
  map<string, dynadata> row_map;
  map<string, dynadata>::iterator it;
  int count;
  DBObject         *tobj;
  EEDB::Assembly   *assembly;
  EEDB::Chrom      *chrom;
  vector<MQDB::DBObject*> assemblies;
  vector<MQDB::DBObject*> chroms;
  int                     idx;
  void                    *stmt;
  
  srand(time(NULL));
  
  //_parameters["build_dir"] = "/tmp";
  
  for(int argi=1; argi<argc; argi++) {
    
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];

    string argval;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      if(!argval.empty()) { argval += " "; }
      argval += argv[argi]; 
    }
    
    if(arg == "-file")          { _parameters["input_file"] = argval; }
    if(arg == "-builddir")      { _parameters["build_dir"] = argval; }
    if(arg == "-deploydir")     { _parameters["deploy_dir"] = argval; }
    if(arg == "-registry")      { _parameters["registry_url"] = argval; }
    if(arg == "-keywords")      { _parameters["keywords"] = argval; }
    if(arg == "-display_name")  { _parameters["display_name"] = argval; }
    if(arg == "-description")   { _parameters["description"] = argval; }
    if(arg == "-assembly")      { _parameters["genome_assembly"] = argval; }
    if(arg == "-score_express") { _parameters["score_as_expression"] = argval; }
    if(arg == "-test")          { _parameters["test_stream"] = "true"; }
        
    if(arg == "-single_tagmap") { _parameters["singletagmap_expression"] = "true"; }
    if(arg == "-GeNAS")         { _parameters["GeNAS"] = "true"; } //not implemented yet
    if(arg == "-LSA")           { _parameters["LSA"] = "true"; } //not implemented yet
  
    /*
     
     if(_parameters.find("display_name") != _parameters.end()) { fprintf(xmlfp,"    <display_name>%s</display_name>\n", _parameters["display_name"].c_str()); }
     if(_parameters.find("description") != _parameters.end()) { fprintf(xmlfp,"    <description>%s</description>\n", _parameters["description"].c_str()); }
     if(_parameters.find("assembly") != _parameters.end()) { fprintf(xmlfp,"    <genome_assembly>%s</genome_assembly>\n", _parameters["assembly"].c_str()); }
     if(_parameters.find("platform") != _parameters.end()) { fprintf(xmlfp,"    <platform>%s</platform>\n", _parameters["platform"].c_str()); }
     if(_parameters.find("bedscore_expression") != _parameters.end()) { fprintf(xmlfp,"    <score_as_expression>%s</score_as_expression>\n", _parameters["datatype"].c_str()); }
     if(_parameters.find("singletagmap_expression") != _parameters.end()) { fprintf(xmlfp,"    <singletagmap_expression>%s</singletagmap_expression>\n", _parameters["singletagmap_expression"].c_str()); }

     
     //oscdb->set_parameter("build_dir","/tmp/");
     //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
     oscdb->set_parameter("owner_openid", _user_profile->openID());

     
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
     */
    
    /*
    if(arg == "-add") {
      if(argi+2 < argc) {
        string tag   = argv[++argi];
        string value = argv[++argi];
        append_metadata_edit_command("add", tag, value, "");
      }
    }
    if(arg == "-delete") {
      argi++;
      string tag, value;
      if(argi < argc) { tag = argv[argi]; }
      argi++;
      if(argi < argc) { value = argv[argi]; }
      append_metadata_edit_command("delete", tag, value, "");
    }
    */
    
    //if(arg == "-count") { count_only=true; }
    //if((arg == "-limit") || (arg == "-max")) { 
    //  argi++;
    //  if(argi<argc) {  
    //    upgrade_max = strtol(argv[argi], NULL, 10);
    //  }
    //}
  }
  
  build_oscdb();
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_create_OSCFileDB.pl [options]\n");
  printf("  -help                     : printf(this help\n");
  printf("  -file <path>              : path to a OSCFile to be used for creating database\n");
  printf("  -builddir <path>          : path to local directory where file building takes place\n");
  printf("  -deploydir <path>         : final directory where oscdb is copied back to when completed\n");
  printf("  -registry <URL>           : eeDB URL of registry database used to record new peer in federation\n");
  printf("  -platform <name>          : name of the experimental platform\n");
  printf("  -assembly <name>          : name of the genome assembly for this file (eg hg18 or mm9)\n");
  printf("  -single_tagmap            : enable simple expression for files with single sequence tags mapped to single locations\n");
  printf("  -score_express <exptype>  : eedb:score column is mapped to expression of type <exptype>\n");
  printf("  -display_name <name>      : nice display name for FeatureSource and Experiments\n");
  printf("  -description <text>       : nice description for FeatureSourced and Experiments\n");
  printf("  -LSA                      : enable RIKEN OSC LSArchive synchronization\n");
  printf("  -GeNAS                    : GeNAS production file automation prequery\n");
  printf("zenbu_create_OSCFileDB.pl v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


void build_oscdb() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  string input_file = _parameters["input_file"];
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    usage();    
  }

  EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    oscdb->set_parameter((*it).first, (*it).second);
  }

  //oscdb->set_parameter("build_dir","/tmp/");
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());

  string oscpath = oscdb->create_db_for_file(input_file);
  printf("oscdb url : %s\n", oscpath.c_str());
  
  /*
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
  */

  if(_parameters["test_stream"] == "true") {
    oscdb->test_stream();
  }
}


void preprocess_bam_file() {
  string file     = _parameters["input_file"];
  string builddir = _parameters["build_dir"];

  printf("bam file : [%s]\n", file.c_str());
  /*
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
   */
}


/*
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
*/


/*
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
*/


/*
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
*/
