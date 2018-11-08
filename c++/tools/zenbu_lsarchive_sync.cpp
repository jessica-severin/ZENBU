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
#include <EEDB/Tools/LSArchiveImport.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/RegionServer.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

void lsarchive_sync_sources();
void usage();
bool save_mdata_edits(MQDB::DBObject *obj);

map<string,string>        _parameters;
string                    _owner_identity;
bool                      _save;
bool                      _show;

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
  
  _save = false;
  _show = false;
  srand(time(NULL));
  
  if(argc==1) { usage(); }
  
  for(int argi=1; argi<argc; argi++) {
    
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    
    vector<string> argvals;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      argvals.push_back(argv[argi]);
    }
    
    if(arg == "-help")   { usage(); }
    if(arg == "-owner")  { _owner_identity = argvals[0]; }
    if(arg == "-show")   { _show=true; }
    if(arg == "-store")  { _save=true; }
    if(arg == "-save")   { _save=true; }
    if(arg == "-search") { _parameters["filter"] = argvals[0]; }
    if(arg == "-ids") {
      string ids;
      for(int j=0; j<argvals.size(); j++) { 
        ids += " "+ argvals[j];
      }
      _parameters["ids"] += ids;
    }
    if(arg == "-peers") { 
      string tstr;
      for(int j=0; j<argvals.size(); j++) { 
        tstr += " "+argvals[j];
      }
      _parameters["peers"] += tstr;
    }
  }
  
  lsarchive_sync_sources();
  
  exit(1);
}


void usage() {
  printf("zenbu_lsarchive_sync.pl [options]\n");
  printf("  -help                 : print this help\n");
  printf("  -ids <id,..>          : list of fedID of Experiment/FeatureSource to edit\n");
  printf("  -peers <uuid,..>      : list of peer UUIDs to edit all sources of these peers\n");
  printf("  -search <phrase>      : search federation for sources matching search phrase\n");
  printf("  -show                 : display metadata of object after editing\n");
  printf("  -store                : store modifications back into database\n");
  printf("zenbu_lsarchive_sync.pl v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
}


//
//
////////////////////////////////////////////////////////////////////////////////////////////
//
//


void lsarchive_sync_sources() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  EEDB::Tools::LSArchiveImport          *lsa = new EEDB::Tools::LSArchiveImport();
  printf("\n====== lsarchive sync datasources == \n");
  gettimeofday(&starttime, NULL);
  
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");

  
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  //printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    webservice->set_parameter((*param).first, (*param).second);
  }
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  //printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  stream = webservice->source_stream();
  
  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources("", _parameters["filter"]);
  } else {
    stream->stream_data_sources("");
  }
  
  int edit_count=0;
  int total_peer_count=0;
  vector<EEDB::DataSource*> _objects;
  map<string, EEDB::Peer*>  peers;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { continue; }
        
    if(!_owner_identity.empty()) {
      source->owner_identity(_owner_identity);
    }

    printf("--- %s", source->simple_xml().c_str());

    //now apply edits and collect peers for saving
    if(lsa->sync_metadata_for_datasource(source)) { 
      printf("  SYNC OK!\n");
      _objects.push_back(source);
      edit_count++;     
      EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
      if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
        //oscdb so need to collate peers to secondary save
        peers[uuid] = peer;
      } else {
        //older mysql/sqlite based source so can save right now
        if(_save) { save_mdata_edits(source); }
      }
    }
    
  }
  int object_count= _objects.size();
  
  
  map<string, EEDB::Peer* >::iterator peer;
  for(peer=peers.begin(); peer!=peers.end(); peer++) {
    EEDB::SPStreams::SourceStream *sourcestream = (*peer).second->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(_save) { oscdb->save_xmldb(); }  //automatically upgrades if needed
    }
    //printf("%s", source->xml().c_str());
  }
  
  
  for(int j=0; j<_objects.size(); j++) {
    EEDB::DataSource *source = _objects[j];
    if(_show) { printf("%s", source->xml().c_str()); }
  }
  
  printf("%d total objects\n", object_count);
  printf("%d edited\n", edit_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


bool save_mdata_edits(MQDB::DBObject *obj) {
  //several if statements here
  //first is it an XMLdb database or a MQDB database
  //then what is the class and how do we record changes
  if(!obj) { return false; }
  if(!_save) { return false; }
  
  string uuid = obj->peer_uuid();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(!peer) { return false; }
  
  if(!(peer->is_valid())) { return false; /*printf("not valid\n");*/ }
  EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
  if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;    
    if(oscdb->save_xmldb()) { return true; } //upgrades if needed
  }
  else if(sourcestream->classname() == EEDB::SPStreams::SourceStream::class_name) {  
    if(obj->classname() == EEDB::Feature::class_name) {
      ((EEDB::Feature*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::FeatureSource::class_name) {
      ((EEDB::FeatureSource*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::EdgeSource::class_name) {
      //((EEDB::EdgeSource*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::Experiment::class_name) {
      ((EEDB::Experiment*)obj)->update_metadata();
    }
  }
  return true;
}



