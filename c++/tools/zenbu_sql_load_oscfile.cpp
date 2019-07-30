#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <pwd.h>
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
string                    _error_msg;
EEDB::User*               _user_profile=NULL;

EEDB::WebServices::WebBase  *webservice;

bool load_oscfile();
bool load_osc_edge_file();
void usage();
bool get_cmdline_user();

int main(int argc, char *argv[]) {
  MQDB::Database  *db;
  dynadata  value;
  map<string, dynadata>::iterator it;
  int count;
  
  srand(time(NULL));
  
  //_parameters["build_dir"] = "/tmp";
  _parameters["_mode"] = "osc";
  
  for(int argi=1; argi<argc; argi++) {
    
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];

    string argval;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      if(!argval.empty()) { argval += " "; }
      argval += argv[argi]; 
    }
    
    if(arg == "-help")   { usage(); }

    if(arg == "-file")          { _parameters["input_file"] = argval; }
    if(arg == "-url")           { _parameters["_db_url"] = argval; }
    if(arg == "-builddir")      { _parameters["build_dir"] = argval; }
    if(arg == "-deploydir")     { _parameters["deploy_dir"] = argval; }
    if(arg == "-registry")      { _parameters["registry_url"] = argval; }
    if(arg == "-keywords")      { _parameters["keywords"] = argval; }
    if(arg == "-display_name")  { _parameters["display_name"] = argval; }
    if(arg == "-description")   { _parameters["description"] = argval; }
    if(arg == "-assembly")      { _parameters["genome_assembly"] = argval; }
    if(arg == "-score_express") { _parameters["score_as_expression"] = argval; }
    if(arg == "-test")          { _parameters["_test_mode"] = "true"; }
    if(arg == "-owner")         { _parameters["owner_identity"] = argval; }
    if(arg == "-single_tagmap") { _parameters["singletagmap_expression"] = "true"; }

    if(arg == "-fsrc1") { _parameters["featuresource1"] = argval; }
    if(arg == "-fsrc2") { _parameters["featuresource2"] = argval; }
    if(arg == "-featuresource1") { _parameters["featuresource1"] = argval; }
    if(arg == "-featuresource2") { _parameters["featuresource2"] = argval; }
    if(arg == "-edgesource") { _parameters["edgesource"] = argval; }
    if(arg == "-feature1") { _parameters["feature1_name"] = argval; }
    if(arg == "-edges") { _parameters["_mode"] = "edge"; }
    if(arg == "-edge") { _parameters["_mode"] = "edge"; }
  
  }

  if(_parameters.find("display_name") == _parameters.end()) {    
    string name = _parameters["input_file"];
    size_t p2 = name.rfind("/");
    if(p2!=string::npos) { 
      string t_name = name.substr(p2+1);
      name = t_name;
    }
    _parameters["display_name"] = name;
  }

  if(_parameters.find("description") == _parameters.end()) {    
    _parameters["description"] = _parameters["display_name"];
  }
  
  webservice = new EEDB::WebServices::WebBase();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  get_cmdline_user(); //fetch and set webservice
  //fprintf(stderr, "after setup and fetch user\n");

  if(_parameters["_mode"] == "osc") {
    if(!load_oscfile()) {
      if(!_error_msg.empty()) { printf("\n%s\n\n", _error_msg.c_str()); }
      usage();
    }
  }
  if(_parameters["_mode"] == "edge") {
    if(!load_osc_edge_file()) {
      if(!_error_msg.empty()) { printf("\n%s\n\n", _error_msg.c_str()); }
      usage();
    }
  }

  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_sql_load_oscfile [options]\n");
  printf("  -help                     : print this help\n");
  printf("  -file <path>              : path to a OSCFile to be used for creating database\n");
  printf("  -url <URL>                : URL to mysql/sqlite database where the data will be stored\n");
  printf("  -platform <name>          : name of the experimental platform\n");
  printf("  -assembly <name>          : name of the genome assembly for this file (eg hg18 or mm9)\n");
  printf("  -single_tagmap            : enable simple expression for files with single sequence tags mapped to single locations\n");
  printf("  -score_express <exptype>  : eedb:score column is mapped to expression of type <exptype>\n");
  printf("  -display_name <name>      : nice display name for FeatureSource and Experiments\n");
  printf("  -description <text>       : nice description for FeatureSourced and Experiments\n");
  printf("  -edges                    : parse file in edges OSCtable format\n");
  printf("  -featuresource1 <dbid>    : zenbu ID for edge.featuresource1\n");
  printf("  -featuresource2 <dbid>    : zenbu ID for edge.featuresource2\n");
  printf("  -edgesource <name>        : if edgesource was already loaded into sql-db use this\n");
  printf("  -feature1 <dbid>          : special edge mode where all edges are connected to a single feature1 and file only specifies feature2_name\n");
  printf("zenbu_sql_load_oscfile v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


bool  get_cmdline_user() {
  //reads ~/.zenbu/id_hmac to get hmac authentication secret
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;

  if(_user_profile) { return true; }

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());

  struct passwd *pw = getpwuid(getuid());
  string path = pw->pw_dir;
  path += "/.zenbu/id_hmac";
  fildes = open(path.c_str(), O_RDONLY, 0x700);
  if(fildes<0) { return false; } //error

  cfg_len = lseek(fildes, 0, SEEK_END);
  //printf("config file %lld bytes long\n", (long long)cfg_len);
  lseek(fildes, 0, SEEK_SET);

  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);

  string email = strtok(config_text, " \t\n");
  string secret = strtok(NULL, " \t\n");

  free(config_text);
  close(fildes);

  printf("user [%s] -> [%s]\n", email.c_str(), secret.c_str());

  //_user_profile = new EEDB::User();
  //if(email)  { _user_profile->email_address(email); }
  //if(secret) { _user_profile->hmac_secretkey(secret); }

  EEDB::User *user = EEDB::User::fetch_by_email(userdb, email);
  if(user && user->hmac_secretkey() == secret) {
    _user_profile = user;
    fprintf(stderr, "%s\n", user->xml().c_str());
    webservice->set_user_profile(_user_profile);
    return true;
  }

  return false;
}



//*****************************************************************
//
// standard osc file loading
//
//*****************************************************************

bool load_oscfile() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  bool test_mode = false;
  if(_parameters["_test_mode"] == "true") { test_mode = true; }

  string input_file = _parameters["input_file"];
  if(input_file.empty()) {
    _error_msg = "ERROR: no specified input file";
    return false;
  }

  EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    oscdb->set_parameter((*it).first, (*it).second);
  }

  oscdb->set_parameter("_inputfile", input_file);

  EEDB::Tools::OSCFileParser* oscfileparser = oscdb->oscfileparser();

  oscfileparser->sparse_metadata(true);

  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    if((*it).first[0] == '_') { continue; }
    oscfileparser->set_parameter((*it).first, (*it).second);
  }

  if(!oscfileparser->init_from_file(input_file)) { 
    _error_msg="unable to parse file format"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    return false; 
  }  

  //don't load the assembly, make sure it is set externally after connecting to sql db

  if(!oscfileparser->primary_feature_source()) { //to make sure it is initialized
    _error_msg="problem creating oscfile primary_feature_source"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    return false;
  }

  if(oscfileparser->default_assembly_name() != "non-genomic") {        
    int chrom_idx, start_idx, end_idx, strand_idx; 
    oscfileparser->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
    if(chrom_idx== -1 || start_idx==-1) {
      _error_msg="warning file does not defined chrom or chrom_start columns"; 
      fprintf(stderr, "%s\n", _error_msg.c_str());
    }
  }

  oscfileparser->peer()->alias(_parameters["_build_filename"]);

  oscfileparser->display_info();

  if(_parameters.find("genome_assembly") == _parameters.end()) {
    _error_msg = "ERROR: must specify -assembly";
    return false;
  }

  //
  // next prepare the sql database
  if(_parameters.find("_db_url") == _parameters.end()) {
    _error_msg = "ERROR: must specify -url for the database for loading";
    return false;
  }
  EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["_db_url"]);
  if(!peer) {
    _error_msg = "ERROR: unable to connect to peer [" + _parameters["_db_url"] +"]";
    return false;
  }

  printf("%s\n", peer->xml().c_str());

  MQDB::Database* db = peer->peer_database();
  if(!db) {
    _error_msg = "ERROR: unable to get database from peer";
    return false;
  }
  db->disconnect();
  db->user("zenbu_admin");
  db->password("zenbu_admin");

  printf("%s\n", db->xml().c_str());

  //
  //make sure assembly and chroms are loaded
  if(oscfileparser->default_assembly_name() != "non-genomic") {        
    EEDB::Assembly *assembly = webservice->find_assembly(_parameters["genome_assembly"]);
    if(!assembly) {
      _error_msg = "ERROR: unable to find assembly [" + _parameters["genome_assembly"] +"]";
      return false;
    }
    printf("%s", assembly->xml().c_str());

    vector<EEDB::Chrom*> chroms = assembly->get_chroms();
    printf("[%s] %ld chroms\n", assembly->assembly_name().c_str(), chroms.size());

    if(!test_mode) { assembly->store(db); }
    for(unsigned int j=0; j<chroms.size(); j++) {
      EEDB::Chrom *chrom = chroms[j];
      if(!test_mode) { chrom->store(db); }
      printf("   %s\n", chrom->xml().c_str());
    }

    oscfileparser->set_assembly(assembly);
  }

  //
  // make sure all sources are stored
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool> source_ids;

  vector<EEDB::DataSource*> sources = oscfileparser->datasources();
  vector<EEDB::DataSource*>::iterator it2;
  for(it2=sources.begin(); it2!=sources.end(); it2++) {
    EEDB::DataSource *source = (*it2);
    source->metadataset()->remove_metadata_like("osc_header","");
    source->metadataset()->remove_metadata_like("eedb:owner_OpenID","");
    source->metadataset()->remove_metadata_like("keyword","");
    if(!_parameters["owner_identity"].empty()) { source->owner_identity(_parameters["owner_identity"]); }

    if(source->classname() == EEDB::FeatureSource::class_name) { 
      if(!test_mode) { ((EEDB::FeatureSource*)source)->store(db); }
    }
    if(source->classname() == EEDB::Experiment::class_name) { 
      EEDB::Experiment* exp = (EEDB::Experiment*)source;
      exp->is_active(true);
      exp->is_visible(true);
      if(!test_mode) { exp->store(db); }

      //collect all the datatypes to allow full parsing of feature
      map<string, EEDB::Datatype*> dtypes = exp->expression_datatypes();
      map<string, EEDB::Datatype*>::iterator it3;
      for(it3=dtypes.begin(); it3!=dtypes.end(); it3++) {
        datatypes[it3->first] = it3->second;
      }
    }

    //collect all the sources to allow full parsing of feature
    source_ids[source->db_id()] = true;
    if(test_mode) { printf("%s\n", source->xml().c_str()); }
  }

  //
  // read the input file and store the features
  //
  double                  rate;
  EEDB::t_outputmode      outmode = EEDB::FULL_FEATURE;
  char                    buffer[8192];
  char*                   _data_buffer;

  gzFile gz = gzopen(input_file.c_str(), "rb");
  if(!gz) { 
    _error_msg = "ERROR: unable to open input file [" + input_file +"]";
    return false; 
  }
  
  unsigned buflen = 10*1024*1024; //10MB, max allowed line length
  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  string filetype  = oscfileparser->get_parameter("filetype");

  oscfileparser->set_parameter("_skip_ignore_on_output", "true");

  gettimeofday(&starttime, NULL);
  long int count=0;
  long last_update=starttime.tv_sec;
  string tline;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }

    if(filetype == "osc") { 
      if(_data_buffer[0] == '#') { continue; }
      if(count==0) { //first non-parameter/comment line is the header columns line
        count++;
        fprintf(stderr, "oscheader [%s]\n", _data_buffer);
        continue;
      }
    }
    if(filetype == "bed") { 
      if(strncmp(_data_buffer, "track ", 6) == 0) { continue; }
      if(strncmp(_data_buffer, "browser ", 8) == 0) { continue; }
    }

    tline = _data_buffer; //tmp copy for error message. not efficient but no other nice way
    if(tline.length() > 255) { tline = tline.substr(0,255) + "..."; }

    if(strlen(_data_buffer) >= buflen-1) {
      snprintf(buffer, 8190, "datafile error, line %ld exceeded max 10MB line length --[", count);
      _error_msg = buffer + tline + "] ";
      _error_msg += oscfileparser->get_parameter("_parsing_error") + " -";
      return false;
    }
    
    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      //empty line
      continue;
    }
    
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    EEDB::Feature* feature = oscfileparser->convert_dataline_to_feature(_data_buffer, outmode, datatypes, source_ids);
    if(!feature) { 
      snprintf(buffer, 8190, "unable to parse line %ld --[", count);
      _error_msg = buffer + tline + "] ";
      _error_msg += oscfileparser->get_parameter("_parsing_error") + " -";
      return false;
    }
    
    //
    //now store in db
    count++;
    //printf("%s\n", feature->xml().c_str());
    //printf("%s\n", feature->chrom()->xml().c_str());
    if(!test_mode) {
      feature->store(db);
      feature->store_expression();
    } else {
      printf("%s\n", feature->xml().c_str());
    }

    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 1) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
      fprintf(stderr, "%s\n", feature->xml().c_str());
    }

    feature->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
    
  //close files
  gzclose(gz);
  free(_data_buffer);

  //
  //update the feature_count in the primary feature_source
  EEDB::FeatureSource *fsrc = oscfileparser->primary_feature_source();
  fsrc->feature_count(count-1);
  fsrc->update_feature_count();

  //last step write out the XML setup
  //string xml_path = _oscdb_dir + "/oscdb.xml";
  //int xmlfd = open(xml_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  //if(xmlfd == -1) { 
  //  fprintf(stderr, "filessystem error: can't open oscdb.xml file [%s]\n", xml_path.c_str()); 
  //  return false; //error
  //}
  //string xml_buffer;  
  //oscfileparser()->xml(xml_buffer);
  //write(xmlfd, xml_buffer.c_str(), xml_buffer.size());
  //close(xmlfd);
  
  //_copy_self_to_deploy_dir();  //performs copy if needed, resets _oscdb_dir variable
  
  // copy the peer created in the parser into the oscdb so it can
  // be used directly after building
  //peer(oscfileparser()->peer());

  //string oscdb_url = "oscdb://" + _oscdb_dir;
  //return oscdb_url;


  //string oscpath = oscdb->create_db_for_file(input_file);
  //printf("oscdb url : %s\n", oscpath.c_str());
  
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

  //if(_parameters["test_stream"] == "true") {
  //  oscdb->test_stream();
  //}

  return true;
}



bool load_osc_edge_file_fantom6() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  printf("\n=== load_osc_edge_file\n");
  string input_file = _parameters["input_file"];
  if(input_file.empty()) {
    _error_msg = "ERROR: no specified input file";
    return false;
  }

  bool test_mode = false;
  if(_parameters["_test_mode"] == "true") { test_mode = true; }

  EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    oscdb->set_parameter((*it).first, (*it).second);
  }

  oscdb->set_parameter("_inputfile", input_file);

  EEDB::Tools::OSCFileParser* oscfileparser = oscdb->oscfileparser();

  oscfileparser->sparse_metadata(true);

  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    if((*it).first[0] == '_') { continue; }
    oscfileparser->set_parameter((*it).first, (*it).second);
  }

  if(!oscfileparser->init_from_file(input_file)) { 
    _error_msg="unable to parse file format"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    return false; 
  }  

  //don't load the assembly, make sure it is set externally after connecting to sql db

  if(!oscfileparser->primary_feature_source()) { //to make sure it is initialized
    _error_msg="problem creating oscfile primary_feature_source"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    return false;
  }

  oscfileparser->peer()->alias(_parameters["_build_filename"]);

  oscfileparser->display_info();

  if(_parameters.find("genome_assembly") == _parameters.end()) {
    _error_msg = "ERROR: must specify -assembly";
    return false;
  }

  //
  // next prepare the sql database
  if(_parameters.find("_db_url") == _parameters.end()) {
    _error_msg = "ERROR: must specify -url for the database for loading";
    if(!test_mode) { return false; }
  }

  MQDB::Database* db = NULL;
  EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["_db_url"]);
  if(!peer) {
    _error_msg = "ERROR: unable to connect to peer [" + _parameters["_db_url"] +"]";
    if(!test_mode) { return false; }
  }

  printf("%s\n", peer->xml().c_str());
  if(peer) {
    db = peer->peer_database();
    if(!db) {
      _error_msg = "ERROR: unable to get database from peer";
      if(!test_mode) { return false; }
    } else {
      db->disconnect();
      db->user("zenbu_admin");
      db->password("zenbu_admin");
      printf("%s\n", db->xml().c_str());
    }
  }

  //
  //make sure assembly and chroms are loaded
  EEDB::Assembly *assembly = webservice->find_assembly(_parameters["genome_assembly"]);
  if(!assembly) {
    _error_msg = "ERROR: unable to find assembly [" + _parameters["genome_assembly"] +"]";
    return false;
  }
  printf("%s", assembly->xml().c_str());

  vector<EEDB::Chrom*> chroms = assembly->get_chroms();
  printf("[%s] %ld chroms\n", assembly->assembly_name().c_str(), chroms.size());

  assembly->store(db);
  for(unsigned int j=0; j<chroms.size(); j++) {
    EEDB::Chrom *chrom = chroms[j];
    chrom->store(db);
    printf("   %s\n", chrom->xml().c_str());
  }

  oscfileparser->set_assembly(assembly);

  //
  // TODO temporay hack to get this working now
  //
  EEDB::FeatureSource* fsrc1 = EEDB::FeatureSource::fetch_by_id(db,6);
  EEDB::FeatureSource* fsrc2 = EEDB::FeatureSource::fetch_by_id(db,9);
  printf("fsrc1: %s", fsrc1->simple_xml().c_str());
  printf("fsrc2: %s", fsrc2->simple_xml().c_str());
  sleep(1);

  //
  // make sure edge sources are stored
  EEDB::EdgeSource *edgesource = oscfileparser->get_edgesource("");
  edgesource->feature_source1_dbid(fsrc1->db_id());
  edgesource->feature_source2_dbid(fsrc2->db_id());
  edgesource->is_active(true);
  edgesource->is_visible(true);
  if(!_parameters["owner_identity"].empty()) { edgesource->owner_identity(_parameters["owner_identity"]); }
  edgesource->store(db);
  printf("%s\n", edgesource->xml().c_str());
  sleep(1);

  /*
  map<string, EEDB::Datatype*> datatypes;
  map<string, bool> source_ids;

  vector<EEDB::DataSource*> sources = oscfileparser->datasources();
  vector<EEDB::DataSource*>::iterator it2;
  for(it2=sources.begin(); it2!=sources.end(); it2++) {
    EEDB::DataSource *source = (*it2);
    source->metadataset()->remove_metadata_like("osc_header","");
    source->metadataset()->remove_metadata_like("eedb:owner_OpenID","");
    source->metadataset()->remove_metadata_like("keyword","");
    if(!_parameters["owner_identity"].empty()) { source->owner_identity(_parameters["owner_identity"]); }

    if(source->classname() == EEDB::FeatureSource::class_name) { 
      //((EEDB::FeatureSource*)source)->store(db);
    }
    if(source->classname() == EEDB::Experiment::class_name) { 
      EEDB::Experiment* exp = (EEDB::Experiment*)source;
      exp->is_active(true);
      exp->is_visible(true);
      //exp->store(db);

      //collect all the datatypes to allow full parsing of feature
      map<string, EEDB::Datatype*> dtypes = exp->expression_datatypes();
      map<string, EEDB::Datatype*>::iterator it3;
      for(it3=dtypes.begin(); it3!=dtypes.end(); it3++) {
        datatypes[it3->first] = it3->second;
      }
    }
    if(source->classname() == EEDB::EdgeSource::class_name) { 
      EEDB::EdgeSource* esrc = (EEDB::EdgeSource*)source;
      esrc->is_active(true);
      esrc->is_visible(true);
      esrc->store(db);
    }

    //collect all the sources to allow full parsing of feature
    source_ids[source->db_id()] = true;
  }
  */

  //
  // TODO temporay hack to get this working now
  //
  //string feature1_name = "G0223546_01";
  string feature1_name = _parameters["feature1_name"];
  vector<DBObject*> tarray = EEDB::Feature::fetch_all_by_source_metadata(fsrc1, "", feature1_name.c_str());
  //vector<DBObject*> tarray = EEDB::Feature::fetch_all_by_source_metadata(fsrc1, "", "ENSG0000022354%");
  printf("got %ld features\n", tarray.size());
  if(tarray.size()!=1) {
    fprintf(stderr, "ERROR fetching unique feature for [%s], found got %ld features\n", feature1_name.c_str(), tarray.size());
    return false;
  }
  EEDB::Feature* feature1 = (EEDB::Feature*)(tarray[0]);
  printf("%s\n", feature1->xml().c_str());
  sleep(5);

  //
  // read the input file and store the features
  //
  double                  rate;
  EEDB::t_outputmode      outmode = EEDB::FULL_FEATURE;
  char                    buffer[8192];
  char*                   _data_buffer;

  gzFile gz = gzopen(input_file.c_str(), "rb");
  if(!gz) { 
    _error_msg = "ERROR: unable to open input file [" + input_file +"]";
    return false; 
  }
  
  unsigned buflen = 10*1024*1024; //10MB, max allowed line length
  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  string filetype  = oscfileparser->get_parameter("filetype");

  oscfileparser->set_parameter("_skip_ignore_on_output", "true");

  gettimeofday(&starttime, NULL);
  long int line_count=0;
  long int datarow_count=0;
  long int edge_count=0;
  long last_update=starttime.tv_sec;
  string tline;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;
    if(_data_buffer[0] == '#') { continue; }

    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      //empty line
      continue;
    }

    if(filetype == "osc") { 
      if(_data_buffer[0] == '#') { continue; }
      if(datarow_count==0) { //first non-parameter/comment line is the header columns line
        datarow_count++;
        fprintf(stderr, "oscheader [%s]\n", _data_buffer);
        continue;
      }
    }
    if(filetype == "bed") { 
      if(strncmp(_data_buffer, "track ", 6) == 0) { continue; }
      if(strncmp(_data_buffer, "browser ", 8) == 0) { continue; }
    }

    tline = _data_buffer; //tmp copy for error message. not efficient but no other nice way
    if(tline.length() > 255) { tline = tline.substr(0,255) + "..."; }

    if(strlen(_data_buffer) >= buflen-1) {
      snprintf(buffer, 8190, "datafile error, line %ld exceeded max 10MB line length --[", line_count);
      _error_msg = buffer + tline + "] ";
      _error_msg += oscfileparser->get_parameter("_parsing_error") + " -";
      return false;
    }
    
    vector<EEDB::Edge*> edges;
    vector<EEDB::Edge*>::iterator e_it;
    
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    //vector<EEDB::Edge* edges = oscfileparser->convert_dataline_to_edges(_data_buffer, outmode, datatypes, source_ids);

    if(!oscfileparser->segment_line(_data_buffer)) {
      snprintf(buffer, 8190, "ERROR segmenting line %ld --[", line_count);
      _error_msg = buffer + tline + "] ";
      return false;
    }

    vector<EEDB::Tools::OSC_column>  *cols = oscfileparser->columns();

    //printf("\n%s\n", tline.c_str());
    //get feature2
    string f2_name = (*cols)[0].data;
    //printf("look up f2 [%s]\n", f2_name.c_str());
    vector<DBObject*> farray = EEDB::Feature::fetch_all_by_source_metadata(fsrc2, "", f2_name);
    //printf("got %ld features\n", farray.size());
    if(farray.size()>1) {
      snprintf(buffer, 8190, "ERROR looking up uniq end-feature[%s] returned %ld from line %ld --[", f2_name.c_str(), farray.size(), line_count);
      _error_msg = buffer + tline + "] ";
      return false;
    }
    EEDB::Feature* feature2 = (EEDB::Feature*)(farray[0]);
    if(!feature2) {
      snprintf(buffer, 8190, "ERROR did not find end-feature[%s] from line %ld --[", f2_name.c_str(), line_count);
      _error_msg = buffer + tline + "] ";
      return false;
    }

    //printf("%s", feature2->simple_xml().c_str());

    /*
     col[  0]    feature              ID => eedb:name     
     col[  1]   metadata      geneSymbol => geneSymbol    
     col[  2]   metadata        baseMean => baseMean      
     col[  3]   metadata  log2FoldChange => log2FoldChange
     col[  4]   metadata          pvalue => pvalue        
     col[  5]   metadata            padj => padj          
     col[  6]   metadata      KD.tpm.ave => KD.tpm.ave    
     col[  7]   metadata      NC.tpm.ave => NC.tpm.ave    
     */

     //ENSG00000137463	MGARP	391.27768020683357	0.5131251188895338	1.4921735846013088e-8	3.789822470170404e-5	42.96211997752246	29.62420567004315

    //TODO: perform the _NA check or maybe just prefilter the file to load
    //ENSG00000273492	AP000230.1	2.3721254543930828	1.0801220713395987	0.14169643079788866	NA	0.30799294748809486	0.15632038601332313
    //this has everything but the padj is NA

    bool skip=false;
    bool padj_NA = false;
    if(strstr((*cols)[5].data, "NA") != NULL) { padj_NA=true; }

    EEDB::Edge *edge = new EEDB::Edge();
    edge->edge_source(edgesource);
    edge->feature1(feature1);
    edge->feature2(feature2);
    edge->direction('+');
    edges.push_back(edge);
    for(unsigned j=2; j<(*cols).size(); j++) {
      if((j!=5) && (strstr((*cols)[j].data, "NA") != NULL)) { 
        //fprintf(stderr, "  col[%ld] [%s][%s] is NA\n", j,(*cols)[j].colname.c_str(), (*cols)[j].data);
        skip=true; 
        continue; 
      }
      if((*cols)[j].data == NULL) { skip=true; continue; }

      edge->add_edgeweight(edgesource, (*cols)[j].colname, strtod((*cols)[j].data, NULL));

      //EEDB::Edge *edge = new EEDB::Edge();
      //edge->edge_source(edgesource);
      //edge->feature1(feature1);
      //edge->feature2(feature2);
      //edge->direction('+');
      //edge->sub_type((*cols)[j].colname);
      //edge->weight(strtod((*cols)[j].data, NULL));
      //edges.push_back(edge);
    }   

    if(!padj_NA && skip) {
      fprintf(stderr, "DSeq ERROR: padj has value but something else is NA [%s]\n", tline.c_str());
    }

    if(skip || padj_NA) { 
      //fprintf(stderr, "skip line contains NA [%s]\n", tline.c_str());
      for(e_it=edges.begin(); e_it!=edges.end(); e_it++) {
        EEDB::Edge *edge = (*e_it);
        edge->release();
      }
      feature2->release();
      continue;
    }

    if(edges.empty()) { 
      snprintf(buffer, 8190, "unable to parse line %ld --[", line_count);
      _error_msg = buffer + tline + "] ";
      _error_msg += oscfileparser->get_parameter("_parsing_error") + " -";
      return false;
    }

    datarow_count++;
    
    bool upd = false;
    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 1) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      rate = (double)datarow_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      upd = true;
      fprintf(stderr, "%10ld valid data rows, %10ld edges  %13.2f obj/sec\n", datarow_count-1, edge_count, rate);
      //fprintf(stderr, "%s", feature2->simple_xml().c_str());
    }

    //
    //now store in db
    for(e_it=edges.begin(); e_it!=edges.end(); e_it++) {
      EEDB::Edge *edge = (*e_it);
      edge_count++;
      //printf("%s", edge->simple_xml().c_str());

      edge->store(db);

      //if(upd) { fprintf(stderr, "%s", edge->simple_xml().c_str()); }

      edge->release();
    }

    feature2->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)datarow_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld valid data rows %ld edges  %13.2f obj/sec\n", datarow_count-1, edge_count, rate);
    
  //close files
  gzclose(gz);
  free(_data_buffer);

  //
  //update the feature_count in the primary feature_source
  //EEDB::FeatureSource *fsrc = oscfileparser->primary_feature_source();
  //fsrc->feature_count(edge_count);
  //fsrc->update_feature_count();

  return true;
}



bool load_osc_edge_file() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  printf("\n=== load_osc_edge_file\n");
  string input_file = _parameters["input_file"];
  if(input_file.empty()) {
    _error_msg = "ERROR: no specified input file";
    return false;
  }

  bool test_mode = false;
  if(_parameters["_test_mode"] == "true") { test_mode = true; }

  EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    oscdb->set_parameter((*it).first, (*it).second);
  }

  oscdb->set_parameter("_inputfile", input_file);

  EEDB::Tools::OSCFileParser* oscfileparser = oscdb->oscfileparser();

  oscfileparser->sparse_metadata(true);

  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    if((*it).first[0] == '_') { continue; }
    oscfileparser->set_parameter((*it).first, (*it).second);
  }

  if(!oscfileparser->init_from_file(input_file)) { 
    _error_msg="unable to parse file format"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    if(!test_mode) { return false; }
  }  

  //don't load the assembly, make sure it is set externally after connecting to sql db

  if(!oscfileparser->primary_edge_source()) { //to make sure it is initialized
    _error_msg="problem creating oscfile primary_edge_source"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    return false;
  }

  oscfileparser->peer()->alias(_parameters["_build_filename"]);

  oscfileparser->display_info();

  //display the sources created by parsing headers
  vector<EEDB::DataSource*> sources = oscfileparser->datasources();
  vector<EEDB::DataSource*>::iterator it2;
  for(it2=sources.begin(); it2!=sources.end(); it2++) {
    EEDB::DataSource *source = (*it2);
    printf("%s\n", source->xml().c_str());
  }

  if(_parameters.find("genome_assembly") == _parameters.end()) {
    _error_msg = "ERROR: must specify -assembly";
    return false;
  }

  //
  // next prepare the sql database
  if(_parameters.find("_db_url") == _parameters.end()) {
    _error_msg = "ERROR: must specify -url for the database for loading";
    return false;
  }
  fprintf(stderr, "before the db stuff\n");

  MQDB::Database* db = NULL;
  EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["_db_url"]);
  if(!peer) {
    _error_msg = "ERROR: unable to connect to peer [" + _parameters["_db_url"] +"]";
    return false;
  }

  if(peer) {
    printf("%s\n", peer->xml().c_str());
    db = peer->peer_database();
    if(!db) {
      _error_msg = "ERROR: unable to get database from peer";
      return false;
    } else {
      db->disconnect();
      db->user("zenbu_admin");
      db->password("zenbu_admin");
      printf("%s\n", db->xml().c_str());
    }
  }

  //
  //make sure assembly and chroms are loaded
  EEDB::Assembly *assembly = webservice->find_assembly(_parameters["genome_assembly"]);
  if(!assembly) {
    _error_msg = "ERROR: unable to find assembly [" + _parameters["genome_assembly"] +"]";
    return false;
  }
  printf("%s", assembly->xml().c_str());

  vector<EEDB::Chrom*> chroms = assembly->get_chroms();
  printf("[%s] %ld chroms\n", assembly->assembly_name().c_str(), chroms.size());

  if(!test_mode) { assembly->store(db); }
  for(unsigned int j=0; j<chroms.size(); j++) {
    EEDB::Chrom *chrom = chroms[j];
    if(!test_mode) { chrom->store(db); }
    //printf("   %s\n", chrom->xml().c_str());
  }

  oscfileparser->set_assembly(assembly);

  //
  // get featuresource1 and featuresource2 
  //
  gettimeofday(&starttime, NULL);
  string src_ids = "";
  if(_parameters.find("featuresource1") != _parameters.end()) { src_ids += _parameters["featuresource1"] + ","; }
  if(_parameters.find("featuresource2") != _parameters.end()) { src_ids += _parameters["featuresource2"] + ","; }
  if(_parameters.find("edgesource") != _parameters.end()) { src_ids += _parameters["edgesource"] + ","; }
  fprintf(stderr, "source_ids %s\n", src_ids.c_str());
  webservice->set_parameter("source_ids", src_ids);

  webservice->set_user_profile(_user_profile);

  webservice->postprocess_parameters();

  EEDB::SPStream *stream = webservice->source_stream();

  // make sure edge sources are stored
  EEDB::EdgeSource *edgesource = oscfileparser->primary_edge_source();
  EEDB::FeatureSource* fsrc1 = NULL;
  EEDB::FeatureSource* fsrc2 = NULL;

  //if(_parameters.find("edgesource") != _parameters.end()) {
  //  edgesource = (EEDB::EdgeSource*) stream->fetch_object_by_id(_parameters["edgesource"]);
  //  fsrc1 = (EEDB::FeatureSource*) stream->fetch_object_by_id(edgesource->feature_source1_dbid());
  //  fsrc2 = (EEDB::FeatureSource*) stream->fetch_object_by_id(edgesource->feature_source2_dbid());
  //  //TODO: set the ocfileparser edgesource once available
  //}
  fsrc1 = (EEDB::FeatureSource*) stream->fetch_object_by_id(_parameters["featuresource1"]);
  fsrc2 = (EEDB::FeatureSource*) stream->fetch_object_by_id(_parameters["featuresource2"]);
  if(fsrc1) {
    printf("fsrc1: %s", fsrc1->simple_xml().c_str());
  } else {
    fprintf(stderr, "unable to fetch featuresource1 [%s]\n", _parameters["featuresource1"].c_str());
    return false;
  }
  if(fsrc2) {
    printf("fsrc2: %s", fsrc2->simple_xml().c_str());
  } else {
    fprintf(stderr, "unable to fetch featuresource2 [%s]\n", _parameters["featuresource2"].c_str());
    return false;
  }
  edgesource->feature_source1(fsrc1);
  edgesource->feature_source2(fsrc2);
  if(!test_mode) { edgesource->store(db); }
  printf("\n%s", edgesource->xml().c_str());
  //printf("fsrc1: %s", fsrc1->simple_xml().c_str());
  //printf("fsrc2: %s", fsrc2->simple_xml().c_str());

  string uuid = fsrc1->peer_uuid();
  EEDB::Peer *peer1 = EEDB::Peer::check_cache(uuid);
  uuid = fsrc2->peer_uuid();
  EEDB::Peer *peer2 = EEDB::Peer::check_cache(uuid);
  printf("peer1: %s\n", peer1->xml().c_str());
  printf("peer2: %s\n", peer2->xml().c_str());

  //stream all the features in fsrc1 and create in-memory hashes to find matchups 
  gettimeofday(&starttime, NULL);
  map<string, EEDB::Feature*> fsrc1_feature_hash;
  vector<EEDB::Feature*> fsrc1_feature_list;
  EEDB::SPStreams::SourceStream *stream1 = peer1->source_stream(); 
  stream1->clear_sourcestream_filters();
  stream1->add_source_id_filter(fsrc1->db_id());
  printf("stream1: %s\n", stream1->xml().c_str());
  stream1->stream_all_features();
  printf("after stream_all_features\n");
  while(EEDB::Feature *feature = (EEDB::Feature*)stream1->next_in_stream()) {
    if(feature->classname() != EEDB::Feature::class_name) { 
      fprintf(stderr, "problem, stream returned non-features\n");
      continue;
    }
    //feature->metadataset();
    string name = feature->primary_name();
    if(fsrc1_feature_hash.find(name) != fsrc1_feature_hash.end()) {
      fprintf(stderr, "WARNING: features with duplicate primary_name [%s] in fsrc1, name hash might not be reliable\n", name.c_str());
    }
    fsrc1_feature_hash[name] = feature;
    fsrc1_feature_list.push_back(feature);
    //fprintf(stderr, "%s\n", feature->xml().c_str());
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  double loadtime = ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "loaded fsrc1 list(%ld) hash(%ld) feature in %1.3f sec\n", fsrc1_feature_list.size(), fsrc1_feature_hash.size(), loadtime);

  //stream all the features in fsrc2 and create in-memory hashes to find matchups 
  gettimeofday(&starttime, NULL);
  map<string, EEDB::Feature*> fsrc2_feature_hash;
  vector<EEDB::Feature*> fsrc2_feature_list;
  EEDB::SPStreams::SourceStream *stream2 = peer2->source_stream(); 
  stream2->clear_sourcestream_filters();
  stream2->add_source_id_filter(fsrc2->db_id());
  printf("stream2: %s\n", stream2->xml().c_str());
  stream2->stream_all_features();
  printf("after stream_all_features\n");
  while(EEDB::Feature *feature = (EEDB::Feature*)stream2->next_in_stream()) {
    if(feature->classname() != EEDB::Feature::class_name) { 
      fprintf(stderr, "problem, stream returned non-features\n");
      continue;
    }
    //feature->metadataset();
    string name = feature->primary_name();
    if(fsrc2_feature_hash.find(name) != fsrc2_feature_hash.end()) {
      fprintf(stderr, "WARNING: features with duplicate primary_name [%s] in fsrc2, name hash might not be reliable\n", name.c_str());
    }
    fsrc2_feature_hash[name] = feature;
    fsrc2_feature_list.push_back(feature);
    //fprintf(stderr, "%s\n", feature->xml().c_str());
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  loadtime = ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "loaded fsrc2 list(%ld) hash(%ld) feature in %1.3f sec\n", fsrc2_feature_list.size(), fsrc2_feature_hash.size(), loadtime);

  // special code if file does not have a edgef1 column, but uses a fixed feature1
  EEDB::Feature* feature1 = NULL;
  //string feature1_name = "G0223546_01";
  if(_parameters.find("feature1_name") != _parameters.end()) {
    string feature1_name = _parameters["feature1_name"];
    vector<DBObject*> tarray = EEDB::Feature::fetch_all_by_source_metadata(fsrc1, "", feature1_name.c_str());
    //vector<DBObject*> tarray = EEDB::Feature::fetch_all_by_source_metadata(fsrc1, "", "ENSG0000022354%");
    printf("got %ld features\n", tarray.size());
    if(tarray.size()!=1) {
      fprintf(stderr, "ERROR fetching unique feature for [%s], found got %ld features\n", feature1_name.c_str(), tarray.size());
      return false;
    }
    feature1 = (EEDB::Feature*)(tarray[0]);
    printf("%s\n", feature1->xml().c_str());
    sleep(5);
  }

  //
  // read the input file and store the edges
  //
  double                  rate;
  EEDB::t_outputmode      outmode = EEDB::FULL_FEATURE;
  char                    buffer[8192];
  char*                   _data_buffer;

  gzFile gz = gzopen(input_file.c_str(), "rb");
  if(!gz) { 
    _error_msg = "ERROR: unable to open input file [" + input_file +"]";
    return false; 
  }
  
  unsigned buflen = 10*1024*1024; //10MB, max allowed line length
  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  string filetype  = oscfileparser->get_parameter("filetype");

  oscfileparser->set_parameter("_skip_ignore_on_output", "true");

  vector<EEDB::Tools::OSC_column>  *cols = oscfileparser->columns();
  EEDB::Tools::OSC_column* edgef1 = NULL;
  EEDB::Tools::OSC_column* edgef2 = NULL;
  for(unsigned i=0; i<cols->size(); i++) {
    if(!edgef1 && (string((*cols)[i].colname) == "edgef1_name")) { edgef1 = &((*cols)[i]); }
    if(!edgef2 && (string((*cols)[i].colname) == "edgef2_name")) { edgef2 = &((*cols)[i]); }
    if(string((*cols)[i].colname) == "edgef1_id") { edgef1 = &((*cols)[i]); }
    if(string((*cols)[i].colname) == "edgef2_id") { edgef2 = &((*cols)[i]); }
  }
  if(!edgef2) {
    _error_msg = "edgef2 column not defined, needed for edge linking";
    return false;
  }
  if(!feature1 && !edgef1) {
    _error_msg = "neither global feature1 nor edgef1 column defined, needed for edge linking";
    return false;
  }

  //if using mdata, rebuild the hashes using mdkey
  vector<EEDB::Feature*>::iterator it1;
  if(edgef1 && (edgef1->datatype) && (edgef1->datatype->type() != "name") && (edgef1->datatype->type() != "primary_name")) {
    fsrc1_feature_hash.clear();
    string mdkey = edgef1->datatype->type();
    printf("\nrebuild fsrc1_hash with mdkey [%s]\n", mdkey.c_str());
    for(it1=fsrc1_feature_list.begin(); it1!=fsrc1_feature_list.end(); it1++) {
      EEDB::Feature *feature1 = (*it1);
      feature1->metadataset(); //make sure it is loaded
      EEDB::Metadata* md2= feature1->metadataset()->find_metadata(mdkey,"");
      if(!md2) { continue; }
      string name = md2->data();
      if(fsrc1_feature_hash.find(name) != fsrc1_feature_hash.end()) {
        fprintf(stderr, "WARNING: feature with duplicate [%s] [%s] in fsrc1_hash\n", mdkey.c_str(), name.c_str());
      }
      fsrc1_feature_hash[name] = feature1;
      fprintf(stderr, "  feature[%s]  mdkey[%s]  value[%s]\n", feature1->primary_name().c_str(), mdkey.c_str(), name.c_str());
    }
    fprintf(stderr, "rebuilt fsrc1_hash %ld feature in %1.3f sec\n", fsrc2_feature_hash.size(), loadtime);
  }
  if(edgef2 && (edgef2->datatype) && (edgef2->datatype->type() != "name") && (edgef2->datatype->type() != "primary_name")) {
    fsrc2_feature_hash.clear();
    string mdkey = edgef2->datatype->type();
    printf("\nrebuild fsrc2_hash with mdkey [%s]\n", mdkey.c_str());
    for(it1=fsrc2_feature_list.begin(); it1!=fsrc2_feature_list.end(); it1++) {
      EEDB::Feature *feature1 = (*it1);
      feature1->metadataset(); //make sure it is loaded
      EEDB::Metadata* md2= feature1->metadataset()->find_metadata(mdkey,"");
      if(!md2) { continue; }
      string name = md2->data();
      if(fsrc2_feature_hash.find(name) != fsrc2_feature_hash.end()) {
        fprintf(stderr, "WARNING: feature with duplicate [%s] [%s] in fsrc1_hash\n", mdkey.c_str(), name.c_str());
      }
      fsrc2_feature_hash[name] = feature1;
      fprintf(stderr, "  feature[%s]  mdkey[%s]  value[%s]\n", feature1->primary_name().c_str(), mdkey.c_str(), name.c_str());
    }
    fprintf(stderr, "rebuilt fsrc2_hash %ld feature in %1.3f sec\n", fsrc2_feature_hash.size(), loadtime);
  }


  map<string, bool> problem_names;
  gettimeofday(&starttime, NULL);
  long int line_count=0;
  long int datarow_count=0;
  long int edge_count=0;
  long last_update=starttime.tv_sec;
  string tline;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;
    if(_data_buffer[0] == '#') { continue; }

    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      //empty line
      continue;
    }

    if(filetype == "osc") { 
      if(_data_buffer[0] == '#') { continue; }
      if(datarow_count==0) { //first non-parameter/comment line is the header columns line
        datarow_count++;
        fprintf(stderr, "oscheader [%s]\n", _data_buffer);
        continue;
      }
    }

    tline = _data_buffer; //tmp copy for error message. not efficient but no other nice way
    if(tline.length() > 255) { tline = tline.substr(0,255) + "..."; }

    if(strlen(_data_buffer) >= buflen-1) {
      snprintf(buffer, 8190, "datafile error, line %ld exceeded max 10MB line length --[", line_count);
      _error_msg = buffer + tline + "] ";
      _error_msg += oscfileparser->get_parameter("_parsing_error") + " -";
      return false;
    }
    
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    EEDB::Edge *edge = oscfileparser->convert_dataline_to_edge(_data_buffer);
    if(!edge) {
      snprintf(buffer, 8190, "ERROR parsing line %ld --[", line_count);
      _error_msg = buffer + tline + "] ";
      return false;
    }

    //if(!oscfileparser->segment_line(_data_buffer)) {
    //  snprintf(buffer, 8190, "ERROR segmenting line %ld --[", line_count);
    //  _error_msg = buffer + tline + "] ";
    //  return false;
    //}
    //printf("\n%s\n", tline.c_str());
    datarow_count++;

    //lookup feature1 if using column rather than global feature1
    if(!feature1 && edgef1 && (edgef1->colname == "edgef1_name")) {
      string f1_name = edgef1->data;
      string mdkey;
      if(edgef1->datatype) { mdkey = edgef1->datatype->type(); }
      //printf("look up f1 primary_name [%s][%s]\n", mdkey.c_str(), f1_name.c_str());
      //if(mdkey.empty() || (mdkey == "name") || (mdkey == "primary_name")) {
        EEDB::Feature* f1 = fsrc1_feature_hash[f1_name];
        if(!f1) {
          snprintf(buffer, 8190, "ERROR looking up uniq start-feature1[%s] from line %ld --[", f1_name.c_str(), line_count);
          _error_msg = buffer + tline + "] ";
          problem_names["f1: "+f1_name] = true;
          //fprintf(stderr, "%s\n", _error_msg.c_str());
          if(!test_mode) { return false; }
        }
        edge->feature1(f1);
      //}
    }
    if(!test_mode && !edge->feature1()) {
      snprintf(buffer, 8190, "ERROR did not find start-feature1 from line %ld --[", line_count);
      _error_msg = buffer + tline + "] ";
      return false;
    }

    //lookup feature2 if using column rather than global feature2
    if(edgef2 && (edgef2->colname == "edgef2_name")) {
      string f2_name = edgef2->data;
      string mdkey;
      if(edgef2->datatype) { mdkey = edgef2->datatype->type(); }
      //printf("look up f2 primary_name [%s][%s]\n", mdkey.c_str(), f2_name.c_str());
      vector<DBObject*> farray;
      if(mdkey.empty() || (mdkey == "name") || (mdkey == "primary_name")) {
        EEDB::Feature* f2 = fsrc2_feature_hash[f2_name];
        if(!f2) {
          snprintf(buffer, 8190, "ERROR looking up uniq start-feature2[%s] returned %ld from line %ld --[", f2_name.c_str(), farray.size(), line_count);
          _error_msg = buffer + tline + "] ";
          problem_names["f2: "+f2_name] = true;
          //fprintf(stderr, "%s\n", _error_msg.c_str());
          if(!test_mode) { return false; }
        }
        edge->feature2(f2);
      } else {
        fprintf(stderr, "need to look up f2 via metadata key[%s] value[%s]\n", mdkey.c_str(), f2_name.c_str());
        //loop on the fsrc2_feature_hash and find matching feature
        //farray = EEDB::Feature::fetch_all_by_source_metadata(fsrc2, mdkey, f2_name);
        //printf("  edgef2 got %ld features\n", farray.size());
        //if(farray.size()>1) {
        //  snprintf(buffer, 8190, "ERROR looking up uniq start-feature2[%s] returned %ld from line %ld --[", f2_name.c_str(), farray.size(), line_count);
        //  _error_msg = buffer + tline + "] ";
        //  return false;
        //}
        //if(!farray.empty()) { feature2 = (EEDB::Feature*)(farray[0]); }
      }
    }
    if(!test_mode && !edge->feature2()) {
      snprintf(buffer, 8190, "ERROR did not find start-feature2 from line %ld --[", line_count);
      _error_msg = buffer + tline + "] ";
      return false;
    }

    //printf("%s", edge->feature1()->simple_xml().c_str());
    //printf("%s", edge->feature2()->simple_xml().c_str());

    //now store in db
    edge_count++;
    if(!test_mode) { edge->store(db); }

    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 1) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      rate = (double)datarow_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld valid data rows, %10ld edges  %13.2f obj/sec\n", datarow_count-1, edge_count, rate);
      fprintf(stderr, "%s", edge->simple_xml().c_str());
    }

    edge->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)datarow_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  loadtime = ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld valid data rows %ld edges  %13.2f obj/sec\n", datarow_count-1, edge_count, rate);
  fprintf(stderr, "%13.2f sec total load time\n", loadtime);
    
  //close files
  gzclose(gz);
  free(_data_buffer);

  //
  //update the feature_count in the primary feature_source
  //EEDB::FeatureSource *fsrc = oscfileparser->primary_feature_source();
  //fsrc->feature_count(edge_count);
  //fsrc->update_feature_count();

  map<string,bool>::iterator it4;
  for(it4=problem_names.begin(); it4!=problem_names.end(); it4++) {
    fprintf(stderr, "problem name lookup %s\n", (*it4).first.c_str());
  }

  return true;
}



bool load_osc_edge_file_new_oscdb() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  printf("\n=== load_osc_edge_file\n");
  string input_file = _parameters["input_file"];
  if(input_file.empty()) {
    _error_msg = "ERROR: no specified input file";
    return false;
  }

  bool test_mode = false;
  if(_parameters["_test_mode"] == "true") { test_mode = true; }

  EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    oscdb->set_parameter((*it).first, (*it).second);
  }

  oscdb->set_parameter("_inputfile", input_file);

  EEDB::Tools::OSCFileParser* oscfileparser = oscdb->oscfileparser();

  oscfileparser->sparse_metadata(true);

  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    if((*it).first[0] == '_') { continue; }
    oscfileparser->set_parameter((*it).first, (*it).second);
  }

  if(!oscfileparser->init_from_file(input_file)) { 
    _error_msg="unable to parse file format"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    if(!test_mode) { return false; }
  }  

  //don't load the assembly, make sure it is set externally after connecting to sql db

  if(!oscfileparser->primary_edge_source()) { //to make sure it is initialized
    _error_msg="problem creating oscfile primary_edge_source"; 
    _error_msg += " " + oscfileparser->get_parameter("_parsing_error") + " -";
    return false;
  }

  oscfileparser->peer()->alias(_parameters["_build_filename"]);

  //display the sources created by parsing headers
  oscfileparser->display_info();

  vector<EEDB::DataSource*> sources = oscfileparser->datasources();
  vector<EEDB::DataSource*>::iterator it2;
  for(it2=sources.begin(); it2!=sources.end(); it2++) {
    EEDB::DataSource *source = (*it2);
    printf("%s\n", source->xml().c_str());
  }
  sleep(1);

  if(_parameters.find("genome_assembly") == _parameters.end()) {
    _error_msg = "ERROR: must specify -assembly";
    return false;
  }

  //
  // next prepare the sql database
  if(_parameters.find("_db_url") == _parameters.end()) {
    _error_msg = "ERROR: must specify -url for the database for loading";
    return false;
  }
  fprintf(stderr, "before the db stuff\n");

  MQDB::Database* db = NULL;
  EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["_db_url"]);
  if(!peer) {
    _error_msg = "ERROR: unable to connect to peer [" + _parameters["_db_url"] +"]";
    return false;
  }

  if(peer) {
    printf("%s\n", peer->xml().c_str());
    db = peer->peer_database();
    if(!db) {
      _error_msg = "ERROR: unable to get database from peer";
      return false;
    } else {
      db->disconnect();
      db->user("zenbu_admin");
      db->password("zenbu_admin");
      printf("%s\n", db->xml().c_str());
    }
  }

  //
  //make sure assembly and chroms are loaded
  EEDB::Assembly *assembly = webservice->find_assembly(_parameters["genome_assembly"]);
  if(!assembly) {
    _error_msg = "ERROR: unable to find assembly [" + _parameters["genome_assembly"] +"]";
    return false;
  }
  printf("%s", assembly->xml().c_str());

  vector<EEDB::Chrom*> chroms = assembly->get_chroms();
  printf("[%s] %ld chroms\n", assembly->assembly_name().c_str(), chroms.size());

  if(!test_mode) { assembly->store(db); }
  for(unsigned int j=0; j<chroms.size(); j++) {
    EEDB::Chrom *chrom = chroms[j];
    if(!test_mode) { chrom->store(db); }
    //printf("   %s\n", chrom->xml().c_str());
  }

  oscfileparser->set_assembly(assembly);

  //
  // TODO temporay hack to get this working now
  //
  string src_ids = "";
  if(_parameters.find("featuresource1") != _parameters.end()) { src_ids += _parameters["featuresource1"] + ","; }
  if(_parameters.find("featuresource2") != _parameters.end()) { src_ids += _parameters["featuresource2"] + ","; }
  if(_parameters.find("edgesource") != _parameters.end()) { src_ids += _parameters["edgesource"] + ","; }
  fprintf(stderr, "source_ids %s\n", src_ids.c_str());
  webservice->set_parameter("source_ids", src_ids);
  webservice->postprocess_parameters();

  EEDB::SPStream *stream = webservice->source_stream();

  // make sure edge sources are stored
  EEDB::EdgeSource *edgesource = oscfileparser->primary_edge_source();
  EEDB::FeatureSource* fsrc1 = NULL;
  EEDB::FeatureSource* fsrc2 = NULL;

  //if(_parameters.find("edgesource") != _parameters.end()) {
  //  edgesource = (EEDB::EdgeSource*) stream->fetch_object_by_id(_parameters["edgesource"]);
  //  fsrc1 = (EEDB::FeatureSource*) stream->fetch_object_by_id(edgesource->feature_source1_dbid());
  //  fsrc2 = (EEDB::FeatureSource*) stream->fetch_object_by_id(edgesource->feature_source2_dbid());
  //  //TODO: set the ocfileparser edgesource once available
  //} else {
  fsrc1 = (EEDB::FeatureSource*) stream->fetch_object_by_id(_parameters["featuresource1"]);
  fsrc2 = (EEDB::FeatureSource*) stream->fetch_object_by_id(_parameters["featuresource2"]);
  //edgesource = oscfileparser->get_edgesource("");
  edgesource->feature_source1(fsrc1);
  edgesource->feature_source2(fsrc2);
  //edgesource->is_active(true);
  //edgesource->is_visible(true);
  //if(!_parameters["owner_identity"].empty()) { edgesource->owner_identity(_parameters["owner_identity"]); }
  if(!test_mode) { edgesource->store(db); }
  //}
  printf("\n%s", edgesource->xml().c_str());
  printf("fsrc1: %s", fsrc1->simple_xml().c_str());
  printf("fsrc2: %s", fsrc2->simple_xml().c_str());

  //if all edges connected to a single feature1
  EEDB::Feature* feature1 = NULL;
  if(_parameters.find("feature1_name") != _parameters.end()) {
    string feature1_name = _parameters["feature1_name"];
    vector<DBObject*> tarray = EEDB::Feature::fetch_all_by_source_metadata(fsrc1, "", feature1_name.c_str());
    //vector<DBObject*> tarray = EEDB::Feature::fetch_all_by_source_metadata(fsrc1, "", "ENSG0000022354%");
    printf("got %ld features\n", tarray.size());
    if(tarray.size()!=1) {
      fprintf(stderr, "ERROR fetching unique feature for [%s], found got %ld features\n", feature1_name.c_str(), tarray.size());
      return false;
    }
    feature1 = (EEDB::Feature*)(tarray[0]);
    printf("%s\n", feature1->xml().c_str());
    sleep(5);
  }

  //
  // read the input file and store the features
  //
  double                  rate;
  EEDB::t_outputmode      outmode = EEDB::FULL_FEATURE;
  char                    buffer[8192];
  char*                   _data_buffer;

  gzFile gz = gzopen(input_file.c_str(), "rb");
  if(!gz) { 
    _error_msg = "ERROR: unable to open input file [" + input_file +"]";
    return false; 
  }
  
  unsigned buflen = 10*1024*1024; //10MB, max allowed line length
  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  string filetype  = oscfileparser->get_parameter("filetype");

  oscfileparser->set_parameter("_skip_ignore_on_output", "true");

  vector<EEDB::Tools::OSC_column>  *cols = oscfileparser->columns();
  EEDB::Tools::OSC_column* edgef1 = NULL;
  EEDB::Tools::OSC_column* edgef2 = NULL;
  for(unsigned i=0; i<cols->size(); i++) {
    if(string((*cols)[i].colname) == "edgef1_name") { edgef1 = &((*cols)[i]); }
    if(string((*cols)[i].colname) == "edgef2_name") { edgef2 = &((*cols)[i]); }
  }
  if(!edgef2) {
    _error_msg = "edgef2 column not defined, needed for edge linking";
    return false;
  }
  if(!feature1 && !edgef1) {
    _error_msg = "neither global feature1 nor edgef1 column defined, needed for edge linking";
    return false;
  }

  gettimeofday(&starttime, NULL);
  long int line_count=0;
  long int datarow_count=0;
  long int edge_count=0;
  long last_update=starttime.tv_sec;
  string tline;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;

    if(_data_buffer[0] == '#') { continue; }

    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) { //empty line
      continue;
    }

    if(filetype == "osc") { 
      if(_data_buffer[0] == '#') { continue; }
      if(datarow_count==0) { //first non-parameter/comment line is the header columns line
        datarow_count++;
        fprintf(stderr, "oscheader [%s]\n", _data_buffer);
        continue;
      }
    }

    tline = _data_buffer; //tmp copy for error message. not efficient but no other nice way
    //if(tline.length() > 255) { tline = tline.substr(0,255) + "..."; }

    if(strlen(_data_buffer) >= buflen-1) {
      snprintf(buffer, 8190, "datafile error, line %ld exceeded max 10MB line length --[", line_count);
      //_error_msg = buffer + tline + "] ";
      _error_msg += oscfileparser->get_parameter("_parsing_error") + " -";
      return false;
    }
    
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    //printf("%s\n", tline.c_str());
    EEDB::Edge *edge = oscfileparser->convert_dataline_to_edge(_data_buffer);
    if(!edge) {
      snprintf(buffer, 8190, "ERROR parsing line %ld --[", line_count);
      //_error_msg = buffer + tline + "] ";
      return false;
    }
    //fprintf(stderr, "%s", edge->xml().c_str());

    datarow_count++;

    bool upd = false;
    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 1) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      rate = (double)datarow_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      upd = true;
      fprintf(stderr, "%10ld valid data rows, %10ld edges  %13.2f obj/sec\n", datarow_count-1, edge_count, rate);
      //fprintf(stderr, "%s", feature2->simple_xml().c_str());
    }

    //if(upd) { fprintf(stderr, "%s", edge->simple_xml().c_str()); }
    edge->release();
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)datarow_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld valid data rows %ld edges  %13.2f obj/sec\n", datarow_count-1, edge_count, rate);
    
  //close files
  gzclose(gz);
  free(_data_buffer);
 
  //
  //update the feature_count in the primary feature_source
  //EEDB::FeatureSource *fsrc = oscfileparser->primary_feature_source();
  //fsrc->feature_count(edge_count);
  //fsrc->update_feature_count();

  return true;
}



