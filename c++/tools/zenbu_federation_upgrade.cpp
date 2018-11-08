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
#include <EEDB/Configuration.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/RegionServer.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

void upgrade_oscdbs(vector<EEDB::Peer*> seedpeers);
void upgrade_oscdbs_v2();
void upgrade_bamdb();

void usage();
EEDB::SPStreams::FederatedSourceStream*  source_stream();
void edit_configs();
bool save_mdata_edits(MQDB::DBObject *obj);
void usage();

void upgrade_configurations();
void upgrade_configs_from_peer(EEDB::Peer* peer, EEDB::Collaboration* collab);
EEDB::Configuration* copy_config(EEDB::Feature *feature);

bool                        _count_only=false;
long                        _upgrade_max = 0;
long                        _upgrade_count = 0;
EEDB::WebServices::WebBase* _webservice;
map<string,string>          _parameters;
string                      _owner_identity;
bool                        _save_edits = true;


int main(int argc, char *argv[]) {
  int             loop=10000;
  int count;
  struct timeval   starttime,endtime,difftime;
  DBObject         *tobj;
  void                    *stmt;
  
  gettimeofday(&starttime, NULL);
  srand(time(NULL));

  _webservice = new EEDB::WebServices::WebBase();
  _webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  
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
    if(arg == "-nostore")   { _save_edits=false; }
    if(arg == "-count")     { _count_only=true; }
    if(arg == "-mode")      { _parameters["mode"] = argvals[0]; }
    if(arg == "-format")    { _parameters["format"] = argvals[0]; }
    if(arg == "-sources")   { _parameters["mode"] = "sources"; }
    if(arg == "-show")      { _parameters["submode"] = "show"; }
    if(arg == "-uuid")      { _parameters["uuid"] = argvals[0]; }
    
    if(arg == "-oscdb")     { _parameters["mode"] = "oscdb"; }
    if(arg == "-bamdb")     { _parameters["mode"] = "bamdb"; }
    if(arg == "-configs")   { _parameters["mode"] = "configs"; }
    
    if(arg == "-limit")     { _upgrade_max = strtol(argv[argi], NULL, 10); }
    if(arg == "-max")       { _upgrade_max = strtol(argv[argi], NULL, 10); }

    if(arg == "-configtype")   { 
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
  
  if(_parameters["mode"] == "oscdb") {
    upgrade_oscdbs_v2();
  } else if(_parameters["mode"] == "bamdb") {
    upgrade_bamdb();
  } else if(_parameters["mode"] == "configs") {
    upgrade_configurations();
  } else {
    usage();
  }

  exit(1);
}

void usage() {
  printf("zenbu_federation_upgrade [options]\n");
  printf("  -help                 : print this help\n");
  printf("  -oscdb                : upgrade OSCDB from v1 (sqlite) to v2 (xml) based\n");
  printf("  -bamdb                : upgrade BAMDB to include quality tpm counts\n");
  printf("  -configs              : upgrade configuration system to userDB centralized system\n");
  printf("  -search <phrase>      : search federation for sources matching search phrase\n");
  printf("  -configtype <type>    : only upgrade configurations of configtype (view, track, script, autosave)\n");
  printf("  -show                 : display metadata of object after editing\n");
  printf("  -nostore              : don't store modifications back into database\n");
  printf("zenbu_federation_upgrade v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
}


//
//
////////////////////////////////////////////////////////////////////////////////////////////
//
//



void upgrade_oscdbs(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;
  vector<EEDB::Peer*>::iterator         seed_it;

  printf("\n====== upgrade_oscdb == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  //fstream->add_peer_id_filter("21D8ECD0-DB41-11DE-A484-B9E07D1FBB02");
  //fstream->add_peer_id_filter("B8AD8E88-DB3F-11DE-8090-94DE46B56B58");
  stream = fstream;

  stream->stream_peers();
  count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    printf("%s\n", peer->xml().c_str());
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) { 
      printf("OK OSCDB\n");
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      oscdb->upgrade_db();
      count++;
    }
  }
  printf("%d peers\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}



void upgrade_oscdbs_v2() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  printf("\n====== upgrade_oscdb == \n");
  gettimeofday(&starttime, NULL);

  webservice->parse_config_file("/etc/zenbu/zenbu.conf");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->init_service_request();
  //string post_data ="<zenbu_query> <peers>6C9A5EFA-B74C-11E0-A5FE-F77B07DE6BB6</peers><mode>peers</mode> </zenbu_query>";
  string post_data ="<zenbu_query> <mode>peers</mode> </zenbu_query>";
  webservice->set_post_data(post_data);
  webservice->process_xml_parameters();
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  stream = webservice->source_stream();

  stream->stream_peers();
  int upgrade_count=0;
  int upgradable=0;
  int total_peer_count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(!(peer->is_valid())) { printf("%s - not valid\n", peer->xml().c_str()); }
    total_peer_count++;
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) { 
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(oscdb->oscdb_version() == 1) {
        upgradable++;
        if(_upgrade_max<=0 || upgrade_count<_upgrade_max) { 
          if(!_count_only) { 
            printf("%s\n", peer->xml().c_str());
            oscdb->upgrade_db(); 
            upgrade_count++; 
          }
        }
      }
    }
  }
  printf("%d total peers\n", total_peer_count);
  printf("%d upgradable\n", upgradable);
  printf("%d upgraded\n", upgrade_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void upgrade_bamdb() {
  struct timeval                        starttime, buildstart, endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  
  printf("\n====== upgrade_bamdb == \n");
  gettimeofday(&starttime, NULL);
  
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  webservice->init_service_request();
  //string post_data ="<zenbu_query> <peers>6C9A5EFA-B74C-11E0-A5FE-F77B07DE6BB6</peers><mode>peers</mode> </zenbu_query>";
  string post_data ="<zenbu_query> <mode>peers</mode> </zenbu_query>";
  webservice->set_post_data(post_data);
  webservice->process_xml_parameters();
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  stream = webservice->source_stream();
  
  map<string,EEDB::Peer*>           filtered_peers;
  map<string,EEDB::Peer*>::iterator it_peer;

  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources("", _parameters["filter"]);
  } else {
    stream->stream_data_sources("");
  }

  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    //if(!source->is_active()) { continue; }
    //if(!source->is_visible()) { continue; }
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer && peer->driver() != "bamdb") { continue; }
    printf("%s  %s\n", source->name().c_str(), source->db_id().c_str());
    if(peer) { 
      printf("   %s\n", peer->db_url().c_str()); 
      filtered_peers[uuid] = peer;
    } else {
      printf("  NO PEER\n");
    }
  }
  printf("%ld peers to process\n", filtered_peers.size());

  int upgrade_count=0;
  int upgradable=0;
  int total_peer_count=0;
  for(it_peer = filtered_peers.begin(); it_peer!=filtered_peers.end(); it_peer++) {
    if(_upgrade_max>0 && upgrade_count>=_upgrade_max) { break; }
    
    EEDB::Peer *peer = it_peer->second;
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() != EEDB::SPStreams::BAMDB::class_name) { continue; }
    total_peer_count++;
    
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
    if(!(bamdb->experiment())) { continue; }
    if(!bamdb->experiment()->metadataset()->has_metadata_like("q3_total_count", "")) { upgradable++; }
    
    if(_save_edits) { 
      gettimeofday(&buildstart, NULL);
      //bamdb->calc_total_counts();  //this will always force a recalc
      bamdb->q3_count(); //will trigger build if needed
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &buildstart, &difftime);
      fprintf(stderr, "%s _calc_total_counts %lld %lld %lld %lld (%1.3fsec)\n", peer->xml().c_str(), 
                       bamdb->total_count(), bamdb->q3_count(), bamdb->q20_count(), bamdb->q40_count(),
                       (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      if(bamdb->experiment()->metadataset()->has_metadata_like("q3_total_count", "")) { upgrade_count++; }
    }
    peer->disconnect();
  }
  printf("%d total bamdb peers\n", total_peer_count);
  printf("%d upgradable\n", upgradable);
  printf("%d upgraded\n", upgrade_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}



//////////////////////////////////////////////////////////////////////////////////////////////////////
//
//
// upgrade configuration system from pre 2.5.x system to new configuration system
//
//


void upgrade_configurations() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  printf("\n====== upgrade_configurations == \n"); 
  
  MQDB::Database      *userdb        = _webservice->userDB();
  EEDB::Collaboration *public_collab = _webservice->public_collaboration();
  EEDB::Collaboration *curated       = _webservice->curated_collaboration();
  vector<EEDB::Peer*> seeds          = _webservice->seed_peers();
  //EEDB::Peer          *autosave      = _webservice->autosave_peer(); //deprecated
  
  if(!userdb) { return; }
  
  //work through all the various places where configuration were previously saved
  //and copy them into the centralized userDB::collaboration system

  //special databases first
  if(curated) {
    EEDB::Peer *peer = curated->group_registry();
    upgrade_configs_from_peer(peer, curated);    
  }
  if(public_collab) {
    EEDB::Peer *peer = public_collab->group_registry();
    upgrade_configs_from_peer(peer, public_collab);    
  }
  //if(autosave) {
  //  upgrade_configs_from_peer(autosave, NULL);    
  //}

  //seed peers
  vector<EEDB::Peer*>::iterator  it;
  for(it = seeds.begin(); it != seeds.end(); it++) {
    upgrade_configs_from_peer(*it, public_collab);    
  }

  //all users
  printf("\n====== upgrade user configurations\n"); 
  vector<DBObject*> users = EEDB::User::fetch_all(userdb);
  for(unsigned i=0; i<users.size(); i++) {
    EEDB::User *user = (EEDB::User*)users[i];
    upgrade_configs_from_peer(user->user_registry(), NULL);    
  }
  
  //all collaborations
  printf("\n====== upgrade collaboration configurations\n"); 
  vector<DBObject*> collabs = EEDB::Collaboration::fetch_all(userdb);
  for(unsigned i=0; i<collabs.size(); i++) {
    EEDB::Collaboration *collab = (EEDB::Collaboration*)collabs[i];
    upgrade_configs_from_peer(collab->group_registry(), collab);    
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void upgrade_configs_from_peer(EEDB::Peer* peer, EEDB::Collaboration* collab) {
  if(!peer) { return; }
  if(_upgrade_max>0 && _upgrade_count>=_upgrade_max) { exit(0); }

  EEDB::SPStreams::SourceStream *stream = peer->source_stream();
  if(!stream) { return; }

  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  //printf("%s\n", peer->xml().c_str());
  //if(_parameters.find("configtype") != _parameters.end()) { 
  //  printf("%s\n", _parameters["configtype"].c_str());
  //}
    
  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources("FeatureSource", _parameters["filter"]);
  } else {
    stream->stream_data_sources("FeatureSource");
  }
  
  int count=0;
  while(EEDB::FeatureSource *source = (EEDB::FeatureSource*)stream->next_in_stream()) {
    if(_upgrade_max>0 && _upgrade_count>=_upgrade_max) { exit(0); }
    if(source->classname() != EEDB::FeatureSource::class_name) { continue; }
    //if(!source->is_active()) { continue; }
    //if(!source->is_visible()) { continue; }
    if(source->category() != "config") { continue; }
    if(!_parameters["configtype"].empty() && (source->name() != _parameters["configtype"])) { continue; }

    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);    
    printf("%s  %s\n", source->name().c_str(), source->category().c_str());
    if(peer) { printf("   %s\n", peer->db_url().c_str()); }
    printf("   %s\n", source->db_id().c_str());
    
    vector<MQDB::DBObject*> features = EEDB::Feature::fetch_all_by_source(source);
    for(unsigned int i=0; i<features.size(); i++) {
      EEDB::Feature *feature = (EEDB::Feature*)features[i];
      EEDB::Configuration *config = copy_config(feature);
      if(config) { config->link_to_collaboration(collab); }
    }
  }
  //printf("%d total sources\n", count);
  //gettimeofday(&endtime, NULL);
  //timersub(&endtime, &starttime, &difftime);
  //printf("%1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


EEDB::Configuration*  copy_config(EEDB::Feature *feature) {
  if(_upgrade_max>0 && _upgrade_count>=_upgrade_max) { return NULL; }
  
  if(!feature) { return NULL; }
  MQDB::Database  *userdb = _webservice->userDB();
  if(!userdb) { return NULL; }  
  
  EEDB::FeatureSource *source = feature->feature_source();
  if(source->category() != "config") {  return NULL; }
  if(!_parameters["configtype"].empty() && (source->name() != _parameters["configtype"])) { return NULL; }
    
  EEDB::Metadata *md = feature->metadataset()->find_metadata("uuid","");
  if(!md) { return NULL; }
  string config_uuid = md->data();
  printf("uuid : %s  %s", config_uuid.c_str(), source->name().c_str());
  
  //if(_parameters["format"] == "fullxml") {
  //  printf("=====\n%s\n", feature->xml().c_str());
  //}
  //if(_parameters["format"] == "simplexml") {
  //  printf("=====\n%s\n", feature->simple_xml().c_str());
  //}
    
  EEDB::Configuration *config = EEDB::Configuration::fetch_by_uuid(userdb, config_uuid);
  if(config) { 
    printf(" EXISTS\n");
    return config;
  }
  
  printf(" create userDB config\n");
  _upgrade_count++;
  
  config = new EEDB::Configuration;
  config->uuid(config_uuid);
  config->metadataset()->merge_metadataset(feature->metadataset()); 
  config->config_type(source->name());
  config->access_count((long)feature->significance());
  
  EEDB::Metadata *openid = feature->metadataset()->find_metadata("eedb:owner_OpenID","");
  if(openid) {
    EEDB::User *user = EEDB::User::fetch_by_openID(userdb, openid->data());
    config->owner(user);
  }

  config->metadataset()->remove_metadata_like("eedb:owner_OpenID", "");  //old system
  config->metadataset()->remove_metadata_like("eedb:owner_nickname", "");  //old system
  
  config->store(userdb);
  //printf("%s\n", config->xml().c_str());
  
  //EEDB::Configuration *config2 = EEDB::Configuration::fetch_by_uuid(userdb, config_uuid);
  //if(config2) {
  //  printf("%s\n", config2->xml().c_str());
  //}
  return config;

}

