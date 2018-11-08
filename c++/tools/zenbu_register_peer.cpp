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
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/ZDX/ZDXstream.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

void usage();
void relocate_peer(EEDB::Peer *peer);

bool                 _new_peer = false;
bool                 _clear_all_peers = false;
map<string,string>   _parameters;


int main(int argc, char *argv[]) {
  EEDB::Peer       *peer=NULL;
  EEDB::Peer       *registry=NULL;
  
  //printf("Program name: %s\n", argv[0]);
  for(int argi=1; argi<argc; argi++) {
    
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    
    string argval;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      if(!argval.empty()) { argval += " "; }
      argval += argv[argi]; 
    }
    
    if(arg == "-newpeer")         { _new_peer=true; }
    if(arg == "-clear_all_peers") { _clear_all_peers = true; }
    if(arg == "-registry")        { _parameters["registry_url"] = argval; }
    if(arg == "-url")             { _parameters["db_url"] = argval; }
    if(arg == "-relocate")        { _parameters["relocate"] = "true"; }
  }

  //
  // get connection to the Peer which we are manipulating
  //
  if(_parameters.find("db_url") == _parameters.end()) {
    printf("\nERROR: must specify -url for the eeDB instance to be registered\n");
    usage(); 
  }
  peer = EEDB::Peer::new_from_url(_parameters["db_url"]);
  if(!peer) {
    printf("\nERROR: unable to connect to peer [%s]!!\n\n", _parameters["db_url"].c_str());
    usage(); 
  }
  if(_new_peer) {
    if(peer->driver() == "oscdb") {
      printf("\noscdb based new peer code\n");
      printf("%s\n", peer->xml().c_str());
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
      oscdb->peer()->db_url(_parameters["db_url"]);
      oscdb->peer()->create_uuid();
      printf("%s\n", oscdb->peer()->xml().c_str());
      oscdb->save_xmldb();
      printf("%s\n", oscdb->peer()->xml().c_str());
    } 
    else if(peer->driver() == "bamdb") {
      printf("\nbamdb based new peer code\n");
      printf("%s\n", peer->xml().c_str());
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)peer->source_stream();
      bamdb->peer()->db_url(_parameters["db_url"]);
      bamdb->peer()->create_uuid();
      printf("%s\n", bamdb->peer()->xml().c_str());
      bamdb->save_xmldb();
      printf("%s\n", bamdb->peer()->xml().c_str());
    } 
    else if((peer->driver() == "mysql") or (peer->driver() == "sqlite")) {
      printf("sql based new peer code\n");
      
      MQDB::Database *db = new MQDB::Database(_parameters["db_url"]);
      if((db==NULL) or !(db->get_connection())) { 
        printf("\nERROR: unable to connect to sql database [%s]!!\n\n", _parameters["db_url"].c_str());
        usage(); 
      }
      printf("%s\n", db->xml().c_str());
       
      db->do_sql("DELETE from peer WHERE is_self=1");
      //db->do_sql("UPDATE peer SET is_self=-1 WHERE is_self=1"); //clears old "selfs"
        
      string url = _parameters["db_url"];
      peer->create_uuid();
      string puburl = db->public_url();
      peer->db_url(puburl);
      size_t p2 = url.rfind("/");
      if(p2!=string::npos) { 
        string t_alias = url.substr(p2+1);
        peer->alias(t_alias);
      }
      peer->store(db);
      db->do_sql("UPDATE peer SET is_self=1 WHERE uuid=?", "s", peer->uuid());
      printf("new peer : %s\n", peer->xml().c_str());
      db->disconnect();
    }
    else if(peer->driver() == "zdx") {
      printf("\nzdx new peer\n");
      printf("%s\n", peer->xml().c_str());      
      EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)peer->source_stream();
      EEDB::Peer* zdxpeer = zdxstream->self_peer();
      printf("%s\n", zdxpeer->xml().c_str());      
    }
    exit(0);
  }
  if(_parameters["relocate"] == "true") {
    relocate_peer(peer);
  }
  if(!peer->is_valid()) {
    fprintf(stderr, "\nERROR: peer [%s] is not valid\n", peer->db_url().c_str());
    printf("must make new internal peer ( -newpeer ) before can register!!\n\n");
    usage();     
  }
  /*
  if(_parameters["db_url"] != peer->db_url()) {
    fprintf(stderr, "\nERROR: peer internal db_url [%s] does not match external db_url [%s]\n", 
            peer->db_url().c_str(), _parameters["db_url"].c_str());
    printf("must make new internal peer ( -newpeer ) before can register!!\n\n");
    usage(); 
  }
   */
  printf("peer::\n   %s\n", peer->xml().c_str());

  
  //
  // check registry
  //
  if(_parameters.find("registry_url") == _parameters.end()) {
    printf("\nERROR: must specify -registry for the url to registry database\n");
    usage(); 
  }
  registry = EEDB::Peer::new_from_url(_parameters["registry_url"]);
  if(!registry or !(registry->is_valid())) {
    printf("\nERROR: unable to connect to registry [%s]!!\n\n", _parameters["registry_url"].c_str());
    usage(); 
  }
  MQDB::Database *registry_db = new MQDB::Database(_parameters["registry_url"]);
  if((registry_db==NULL) or !(registry_db->get_connection())) { 
    printf("\nERROR: unable to connect to registry database [%s]!!\n\n", _parameters["registry_url"].c_str());
    usage(); 
  }
  printf("registry::\n   %s\n", registry->xml().c_str());
  //registry_db->disconnect();
  //registry_db->user("zenbu_admin");
  //registry_db->password("zenbu_admin");
  //registry->disconnect();

  //
  // OK ready to do registry actions
  //
  //relocate_peer(peer);
  peer->store(registry_db);
  printf("connected\n");

  exit(1);
}

//
//
////////////////////////////////////////////////////////////////////////////////////////////
//
//

void usage() {
  printf("eedb_register_peer.pl [options]\n");
  printf("  -help               : printf(this help\n");
  printf("  -url <url>          : URL to source database\n");
  printf("  -registry <url>     : eeDB URL registry instance\n");
  printf("  -newpeer            : recreate the internal peer with new UUID\n");
  printf("  -relocate           : change internal peer db_url location to current\n");
  printf("  -v                  : simple debugging output\n");
  printf("  -debug <level>      : extended debugging output (eg -debug 3)\n");
  printf("eedb_register_peer.pl v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
}


void relocate_peer(EEDB::Peer *peer) {
  if(!peer) { return; }
  if(!peer->is_valid()) { return; }

  peer->db_url(_parameters["db_url"]);

  if(peer->driver() == "oscdb") {
    //printf("%s\n", peer->xml().c_str());
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
    EEDB::Peer* oscpeer = oscdb->peer();
    if(oscpeer->db_url() != _parameters["db_url"]) {
      printf("relocate  %s\n", oscpeer->xml().c_str());
      oscpeer->db_url(_parameters["db_url"]);
      oscdb->save_xmldb();
      printf("  %s\n", oscpeer->xml().c_str());
    }
  } else if(peer->driver() == "bamdb") {
    //printf("%s\n", peer->xml().c_str());
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)peer->source_stream();
    EEDB::Peer* bampeer = bamdb->peer();
    printf("relocate  %s\n", bampeer->xml().c_str());
    bampeer->db_url(_parameters["db_url"]);
    bamdb->save_xmldb();
    printf("  %s\n", bampeer->xml().c_str());
  }   
  else if(peer->driver() == "zdx") {    
    EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)peer->source_stream();
    EEDB::Peer* zdxpeer = zdxstream->self_peer();
    printf("%s\n", zdxpeer->xml().c_str());
    zdxpeer->db_url(_parameters["db_url"]);
    zdxstream->write_source_section();
    zdxpeer = zdxstream->self_peer();
    printf("%s\n", zdxpeer->xml().c_str());
  }   
}



