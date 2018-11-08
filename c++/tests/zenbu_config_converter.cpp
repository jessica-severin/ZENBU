#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
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
#include <EEDB/WebServices/UserSystem.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>          _parameters;
string                      _owner_identity;
bool                        _save_edits;
EEDB::WebServices::WebBase* _webservice;

EEDB::SPStreams::FederatedSourceStream*  source_stream();
void edit_configs();
bool save_mdata_edits(MQDB::DBObject *obj);
void usage();
void show_peers();
void show_config_sources();
void show_config();
void copy_config();
void copy_config(EEDB::Feature *feature, EEDB::FeatureSource *dest_source);

int main(int argc, char *argv[]) {  
  _save_edits = false;
  srand(time(NULL));
  
  if(argc==1) { usage(); }
  _parameters["mode"] = "peers";

  _webservice = new EEDB::WebServices::WebBase();
  _webservice->parse_config_file("/var/www/html/zenbu2/cgi/eedb_server_config.xml");

  for(int argi=1; argi<argc; argi++) {
    
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    
    vector<string> argvals;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      argvals.push_back(argv[argi]);
    }

    if(arg == "-help")      { usage(); }
    if(arg == "-openid")    { _owner_identity = argvals[0]; }
    if(arg == "-store")     { _save_edits=true; }
    if(arg == "-save")      { _save_edits=true; }
    if(arg == "-mode")      { _parameters["mode"] = argvals[0]; }
    if(arg == "-format")    { _parameters["format"] = argvals[0]; }
    if(arg == "-sources")   { _parameters["mode"] = "sources"; }
    if(arg == "-show")      { _parameters["mode"] = "show"; }
    if(arg == "-source_id") { _parameters["source_id"] = argvals[0]; }
    if(arg == "-id")        { _parameters["id"] = argvals[0]; }
    if(arg == "-dest")      { _parameters["dest"] = argvals[0]; }
    if(arg == "-type")   { 
      string cfg = argvals[0];       
      if(cfg == "view")     { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "glyphs")   { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "gLyphs")   { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "track")    { _parameters["configtype"] = "eeDB_gLyph_track_configs"; }
      if(cfg == "script")   { _parameters["configtype"] = "ZENBU_script_configs"; }
      if(cfg == "autosave") { _parameters["configtype"] = "eeDB_gLyphs_autoconfigs"; }      
    }
    if(arg == "-search") { _parameters["filter"] = argvals[0]; }
    if(arg == "-ids") {
      string ids;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        ids += " "+ argvals[j];
      }
      _parameters["ids"] += ids;
    }
    if(arg == "-peers") { 
      string tstr;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        tstr += " "+argvals[j];
      }
      _parameters["peers"] += tstr;
    }
  }
  
  if(_parameters["mode"] == "peers") {
    show_peers();
  } else if(_parameters["mode"] == "sources") {
    show_config_sources();
  } else if(_parameters["mode"] == "show") {
    show_config();
  } else if(_parameters["mode"] == "copy") {
    copy_config();
  } else {
    usage();
  }
  
  exit(1);
}


void usage() {
  printf("zenbu_config_manager [options]\n");
  printf("  -help                 : print this help\n");
  printf("  -ids <id,..>          : list of fedID of Experiment/FeatureSource to edit\n");
  printf("  -peers <uuid,..>      : list of peer UUIDs to edit all sources of these peers\n");
  printf("  -search <phrase>      : search federation for sources matching search phrase\n");
  printf("  -show                 : display metadata of object after editing\n");
  printf("  -store                : store modifications back into database\n");
  printf("  -add <tag> <value>    : add metadata in specified sources. eg: -add eedb:display_name \"some description\"\n");
  printf("  -delete <tag>         : delete all metadata with <tag> in specified sources. eg: -delete \"eedb:display_name\"\n");
  printf("  -delete <tag> <value> : delete specific metadata with <tag> <value>\n");
  printf("  -kw                   : delete all keywords and perform new keyword extraction\n");
  printf("zenbu_config_manager v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
}

//
// ------------------------------------------------------------------------------------------
//

EEDB::SPStreams::FederatedSourceStream*  source_stream() {
  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *stream;
  
  stream = new EEDB::SPStreams::FederatedSourceStream();
  stream->set_peer_search_depth(1); //only search the top level seeds
  
  MQDB::Database *userDB = _webservice->userDB();

  if(!_owner_identity.empty()) {
    EEDB::User *user =  EEDB::User::fetch_by_openID(userDB, _owner_identity);
    if(user && user->user_registry()) {
      stream->add_seed_peer(user->user_registry());
    }
  }
  
  vector<MQDB::DBObject*>::iterator  it2;
  vector<MQDB::DBObject*> collaborations = EEDB::Collaboration::fetch_all(userDB);
  for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
    EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
    stream->add_seed_peer(collab->group_registry());
  }

  if(_webservice->public_collaboration()) {
    stream->add_seed_peer(_webservice->public_collaboration()->group_registry());
  }

  userDB->disconnect(); 
  return stream;
}


void show_peers() {
  struct timeval    starttime,endtime,difftime;
  
  printf("\n====== show_peers == \n");
  gettimeofday(&starttime, NULL);
    
  EEDB::SPStream *stream = source_stream();
  
  stream->stream_peers();
  int total_peer_count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(!(peer->is_valid())) { printf("%s - not valid\n", peer->xml().c_str()); }
    total_peer_count++;
    //EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    printf("%s\n", peer->xml().c_str());
  }
  printf("%d total peers\n", total_peer_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void show_config_sources() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  printf("\n====== show_config_sources == \n"); 
  
  //EEDB::SPStream *stream = source_stream();
  EEDB::SPStreams::FederatedSourceStream *stream = _webservice->source_stream();
  
  //if(_webservice->autosave_peer()) { 
  //  stream->add_seed_peer(_webservice->autosave_peer()); 
  //} 
  
  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources("FeatureSource", _parameters["filter"]);
  } else {
    stream->stream_data_sources("FeatureSource");
  }
  
  
  int count=0;
  while(EEDB::FeatureSource *source = (EEDB::FeatureSource*)stream->next_in_stream()) {
    if(source->classname() != EEDB::FeatureSource::class_name) { continue; }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }
    if(source->category() != "config") { continue; }
    if(!_parameters["configtype"].empty() && (source->name() != _parameters["configtype"])) { continue; }
    
    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);    
    printf("%s  %s\n", source->name().c_str(), source->category().c_str());
    if(peer) { printf("   %s\n", peer->db_url().c_str()); }
    printf("   %s\n", source->db_id().c_str());
  }
  printf("%d total sources\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void copy_config() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  printf("\n====== copy_config == \n"); 
  
  if(_parameters.find("id") == _parameters.end()){ return; }
  if(_parameters.find("dest") == _parameters.end()){ return; }
  
  EEDB::SPStreams::FederatedSourceStream *stream = _webservice->source_stream();
  //if(_webservice->autosave_peer()) { 
  //  stream->add_seed_peer(_webservice->autosave_peer()); 
  //} 
  
  EEDB::FeatureSource *dest_source = (EEDB::FeatureSource*)stream->fetch_object_by_id(_parameters["dest"]);
  EEDB::Feature       *feature     = (EEDB::Feature*)stream->fetch_object_by_id(_parameters["id"]);

  if(!dest_source) {
    fprintf(stderr,"dest [%s] not found\n", _parameters["dest"].c_str());
    return;
  }
  
  copy_config(feature, dest_source);
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void copy_config(EEDB::Feature *feature, EEDB::FeatureSource *dest_source) {  
  if(!dest_source) { return; }  
  if(dest_source->classname() != EEDB::FeatureSource::class_name) { return; }
  if(!feature) { return; }
  if(feature->classname() != EEDB::Feature::class_name) { return; }

  EEDB::FeatureSource *source = feature->feature_source();
  if(source->category() != "config") { return; }
  if(!_parameters["configtype"].empty() && (source->name() != _parameters["configtype"])) { return; }

  feature->metadataset(); //lazy load

  if(_parameters["format"] == "fullxml") {
    printf("\n=====\n%s\n", feature->xml().c_str());
  } else {
    printf("\n=====\n%s\n", feature->simple_xml().c_str());
  }
  
  string uuid = source->peer_uuid();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);    
  printf("%s  %s\n", source->name().c_str(), source->category().c_str());
  if(peer) { printf("   %s\n", peer->db_url().c_str()); }
  printf("   %s\n", source->db_id().c_str());
  EEDB::Metadata *md = feature->metadataset()->find_metadata("uuid","");
  if(md) { printf("   uuid : %s\n", md->data().c_str()); }

  printf("copy to dest\n");
  uuid = dest_source->peer_uuid();
  EEDB::Peer *dest_peer = EEDB::Peer::check_cache(uuid);    
  printf("%s  %s\n", dest_source->name().c_str(), dest_source->category().c_str());
  if(peer) { printf("  %s\n", dest_peer->db_url().c_str()); }
  
  feature->primary_id(-1);
  feature->database(NULL);
  feature->feature_source(dest_source);
  if(_save_edits) { feature->store(dest_peer->peer_database()); }
  printf("\n%s\n", feature->simple_xml().c_str());
}


void show_config() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  printf("\n====== show_config == \n"); 
  
  if(_parameters.find("id") == _parameters.end()){ return; }
  
  EEDB::SPStreams::FederatedSourceStream *stream = _webservice->source_stream();
  //if(_webservice->autosave_peer()) { 
  //  stream->add_seed_peer(_webservice->autosave_peer()); 
  //} 
  stream->allow_full_federation_search(false);
  
  EEDB::Feature       *feature = (EEDB::Feature*)stream->fetch_object_by_id(_parameters["id"]);
  EEDB::FeatureSource *source  = feature->feature_source();

  if(_parameters["format"] == "fullxml") {
    printf("%s\n", feature->xml().c_str());
  } else {
    printf("%s\n", feature->simple_xml().c_str());
  }
  
  string uuid = source->peer_uuid();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);    
  printf("%s  %s\n", source->name().c_str(), source->category().c_str());
  if(peer) { printf("   %s\n", peer->db_url().c_str()); }
  printf("   %s\n", source->db_id().c_str());
  EEDB::Metadata *md = feature->metadataset()->find_metadata("uuid","");
  if(md) { printf("   uuid : %s\n", md->data().c_str()); }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}






