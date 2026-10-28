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
#include <boost/algorithm/string/case_conv.hpp>

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
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/RegionServer.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/Tools/ZDXBuilder.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>        _parameters;

void build_oscdb();
void build_bamdbdb();
void build_zdxdb();
void usage();

int main(int argc, char *argv[]) {
  vector<MQDB::DBObject*> assemblies;
  vector<MQDB::DBObject*> chroms;
    
  for(int argi=1; argi<argc; argi++) {
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];

    string argval;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      if(!argval.empty()) { argval += " "; }
      argval += argv[argi]; 
    }
    
    if(arg == "-file")          { _parameters["_input_file"] = argval; }
    if(arg == "-builddir")      { _parameters["_build_dir"] = argval; }
    //if(arg == "-deploydir")     { _parameters["_deploy_dir"] = argval; }
    //if(arg == "-registry")      { _parameters["registry_url"] = argval; }
    if(arg == "-keywords")      { _parameters["keywords"] = argval; }
    if(arg == "-display_name")  { _parameters["display_name"] = argval; }
    if(arg == "-description")   { _parameters["description"] = argval; }
    if(arg == "-platform")      { _parameters["platform"] = argval; }
    if(arg == "-assembly")      { _parameters["genome_assembly"] = argval; }
    if(arg == "-asm")           { _parameters["genome_assembly"] = argval; }
    if(arg == "-ignore_int_asm"){ _parameters["ignore_internal_assembly"] = "true"; }
    if(arg == "-score_express") { _parameters["score_as_expression"] = argval; }
    if(arg == "-test")          { _parameters["test_stream"] = "true"; }
    if(arg == "-bamloc")        { _parameters["_bam_loc"] = argval; }
    if(arg == "-owner")         { _parameters["owner_identity"] = argval; }
    if(arg == "-single_tagmap") { _parameters["singletagmap_expression"] = "true"; }
  }
  
  string input_file = _parameters["_input_file"];
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    usage();    
  }
  
  string filetype;
  size_t p1 = input_file.rfind(".");
  if(p1!=string::npos) {
    filetype = boost::algorithm::to_lower_copy(input_file.substr(p1+1));
  }
  printf("filetype [%s]\n", filetype.c_str());
  build_zdxdb();
  
  //if(filetype == "bam") {
  //  build_bamdbdb();
  //} else {
  //  build_oscdb();
  //}
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_zdxdb_builder [options]\n");
  printf("  -help                     : printf(this help\n");
  printf("  -file <path>              : path to file (osc, bed, gff, sam) to be used for creating zdx database\n");
  printf("  -owner <email>            : set owner identify email to allow user editing after loading\n");
  //printf("  -registry <URL>           : eeDB URL of registry database used to record new peer in federation\n");
  printf("  -builddir <path>          : path to local directory where file building takes place\n");
  //printf("  -deploydir <path>         : final directory where zdxdb is copied back to when completed\n");
  printf("  -assembly <name>          : name of the genome assembly for this file (eg hg18 or mm9)\n");
  printf("  -platform <name>          : name of the experimental platform\n");
  printf("  -single_tagmap            : enable simple expression for files with single sequence tags mapped to single locations\n");
  printf("  -score_express <exptype>  : eedb:score column is mapped to expression of type <exptype>\n");
  printf("  -display_name <name>      : nice display name for FeatureSource and Experiments\n");
  printf("  -description <text>       : nice description for FeatureSourced and Experiments\n");
  printf("zenbu_zdxdb_builder v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


void build_zdxdb() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  string input_file = _parameters["_input_file"];
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    usage();    
  }
  string genome = _parameters["genome_assembly"];

  EEDB::Tools::ZDXBuilder *zdxbuilder = new EEDB::Tools::ZDXBuilder();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    //printf("  parameter : %s : %s\n", (*it).first.c_str(), (*it).second.c_str());
    zdxbuilder->set_parameter((*it).first, (*it).second);
  }
  
  //oscdb->set_parameter("build_dir","/tmp/");
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());

  /*
  // make sure all the chroms are loaded into memory
  EEDB::WebServices::RegionServer *webservice = new EEDB::WebServices::RegionServer();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();
  webservice->postprocess_parameters();
    
  EEDB::Assembly *assembly = webservice->find_assembly(genome);
  if(!assembly) {
    fprintf(stderr, "failed to find genome [%s] by normal method, switching to full streaming\n", genome.c_str());
    EEDB::SPStreams::FederatedSourceStream *asm_stream = webservice->superuser_federated_source_stream();
    asm_stream->allow_full_federation_search(true);
    asm_stream->set_peer_search_depth(2); //only search the seeds and registry layers
    asm_stream->stream_chromosomes(genome, "");
    while(MQDB::DBObject *obj = asm_stream->next_in_stream()) { 
      if(!obj) { continue; }
      fprintf(stderr, "%s", obj->xml().c_str());
      if(obj->classname() == EEDB::Assembly::class_name) { 
        assembly = (EEDB::Assembly*)obj;
        if(assembly->assembly_name() != genome) {
          fprintf(stderr, "problem asm_name not match [%s] != [%s]\n", genome.c_str(), assembly->assembly_name().c_str());
          assembly = NULL;
        } else {
          fprintf(stderr, "found assembly %s [%s]\n", genome.c_str(), assembly->assembly_name().c_str());
          break;
        }
      }
    }
  }
  */

  EEDB::Peer *peer = zdxbuilder->create_zdx_for_file(input_file);
  if(peer) {
    printf("%s\n", peer->xml().c_str());
  }
  
  //if(_parameters["test_stream"] == "true") {
  //  oscdb->test_stream();
  //}
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("build time %1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);  
}


void build_oscdb() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  string input_file = _parameters["_input_file"];
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
  
  if(_parameters["test_stream"] == "true") {
    oscdb->test_stream();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("build time %1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);  
}



void build_bamdbdb() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  string input_file = _parameters["_input_file"];
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    usage();    
  }
  
  EEDB::SPStreams::BAMDB *bamdb = new EEDB::SPStreams::BAMDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    bamdb->set_parameter((*it).first, (*it).second);
  }
  
  //bamdb->set_parameter("build_dir","/tmp/");
  //bamdb->set_parameter("deploy_dir", _user_profile->user_directory());
  //bamdb->set_parameter("deploy_dir", _user_profile->user_directory());
  
  string url = bamdb->create_new(input_file);
  printf("bamdb url : %s\n", url.c_str());
    
  if(_parameters["test_stream"] == "true") {
    //bamdb->test_stream();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("build time %1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}


/*
 * bool  EEDB::JobQueue::UploadFile::process_upload_job(long job_id) {
  _current_job = EEDB::JobQueue::Job::fetch_by_id(_userDB, job_id);
  if(!_current_job) { return false; }

  EEDB::Metadata *md = _current_job->metadataset()->find_metadata("xmlpath", "");
  if(!md) { return false; }

  string xmlpath = md->data();  
  if(!read_upload_xmlinfo(xmlpath)) { 
    _upload_parameters["upload_error"] = "unable to read upload xml config";
    return false; 
  }
  string file = _upload_parameters["_inputfile"];
  
  struct stat statbuf;
  if(stat(file.c_str(), &statbuf) != 0) {
    _upload_parameters["upload_error"] = "unable to open input file";
    return false; 
  }
  
  if(!_current_job->user()) {
    _upload_parameters["upload_error"] = "no user asigned to upload job";
    return false; 
  }

  fprintf(stderr, "upload data into ZENBU [%s]\n", file.c_str());

  map<string,string>::iterator  param_it;
  bool zdxload = false;
  if(_upload_parameters["filetype"] == "gff") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gff2") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gff3") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gtf") { zdxload=true; }
  if(_upload_parameters["filetype"] == "gtf2") { zdxload=true; }
  if(_upload_parameters["build_feature_name_index"] == "true") { zdxload=true; }
  if(_upload_parameters["load_into_zdx"] == "true") { zdxload=true; }

  _gff_virtual_parents = false;
  if(_upload_parameters["gff_virtual_parents"] == "true") { _gff_virtual_parents=true; }

  //disconnect userdb durring the build process so that the mysql connection does not time out_feature
  _userDB->disconnect();
  
  EEDB::Peer *upload_peer = NULL;
  if(zdxload) {
    _upload_parameters["owner_identity"] = _current_job->user()->email_identity();
    upload_peer = load_into_zdx();
    if(!upload_peer) {
      _current_job->metadataset()->remove_metadata_like("upload_error", "");
      _current_job->metadataset()->add_tag_data("upload_error", _upload_parameters["upload_error"]);
      _current_job->update_metadata();
      return false; 
    }
  } 
*/
