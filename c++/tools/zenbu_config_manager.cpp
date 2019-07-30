#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string>
#include <iostream>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <sys/types.h>

#include <pwd.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
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
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/UserSystem.h>
#include <EEDB/WebServices/ConfigServer.h>

using namespace std;
using namespace MQDB;

map<string,string>          _parameters;
string                      _owner_identity;
bool                        _save_edits;
EEDB::WebServices::WebBase* _webservice;
EEDB::User*                 _user_profile=NULL;
MQDB::Database*             _userDB = NULL;
bool                        _import_collaboration = true;

void usage();
bool get_cmdline_user();

void show_configs();
bool load_from_xmlfile();
void missing_sources();

int main(int argc, char *argv[]) {  
  _save_edits = false;
  srand(time(NULL));
  
  if(argc==1) { usage(); }
  _parameters["mode"] = "";
  _parameters["collab"] = "all";
  
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
    
    if(arg == "-userdb")    {
      _parameters["_userdb_url"] = argvals[0];
      _userDB = new MQDB::Database(_parameters["_userdb_url"]);
      if(_userDB && _userDB->get_connection()) {
        dynadata value = _userDB->fetch_col_value("SELECT uuid FROM peer WHERE is_self=1");
        if(value.type == MQDB::STRING) {
          char* uuid = (char*)malloc(value.i_string.length() + 3);
          strcpy(uuid, value.i_string.c_str());
          _userDB->uuid(uuid);
        }
        fprintf(stderr, "%s\n", _userDB->xml().c_str());
      }
      else {
        fprintf(stderr, "failed to connect to userDB %s\n", _parameters["_userdb_url"].c_str());
        _userDB = NULL;
      }
    }

    if(arg == "-format")    { _parameters["format"] = argvals[0]; }
    if(arg == "-filter")    { _parameters["filter"] = argvals[0]; }
    if(arg == "-collab")    { _parameters["collab"] = argvals[0]; }
    if(arg == "-user")      { _parameters["user_email"] = argvals[0]; }

    if(arg == "-ignore_collab")   { _import_collaboration = false; }
    
    if(arg == "-uuid")      { 
      _parameters["mode"] = "show";
      _parameters["uuid"] = argvals[0]; 
    }

    if(arg == "-showall") { _parameters["mode"] = "show"; }
    
    if(arg == "-type")   { 
      string cfg = argvals[0];       
      if(cfg == "view")     { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "glyphs")   { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "gLyphs")   { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "track")    { _parameters["configtype"] = "eeDB_gLyph_track_configs"; }
      if(cfg == "script")   { _parameters["configtype"] = "ZENBU_script_configs"; }
      if(cfg == "autosave") { _parameters["configtype"] = "eeDB_gLyphs_autoconfigs"; }      
    }
        
    if(arg == "-search") { 
      _parameters["mode"] = "show";
      if(!argvals.empty()) {
        _parameters["filter"] = argvals[0]; 
      }
    }
    if(arg == "-loadxml") { 
      _parameters["mode"] = "loadxml";
      if(argvals.empty()) {
        fprintf(stderr, "ERROR: must specify the path to the xml file to load\n\n");
        usage();
      } else {
        _parameters["_xml_file"] = argvals[0];
      }
    }
    
    if(arg == "-missing_sources") { 
      _parameters["mode"] = "missing_sources";
    }
    if(arg == "-share_collab")    { _parameters["share_collab"] = argvals[0]; }
    if(arg == "-share_missing")   { _parameters["share_missing"] = "true"; }
    
  }
  
  if(_parameters["mode"] == "show") {
    show_configs();
  } else if(_parameters["mode"] == "loadxml") {
    if(!load_from_xmlfile()) { usage(); }    
  } else if(_parameters["mode"] == "missing_sources") {
    missing_sources();
  } else {
    usage();
  }
  
  exit(1);
}


void usage() {
  printf("zenbu_config_manager [options]\n");
  printf("  -help                     : print this help\n");
  printf("  -userdb <url>             : url to specific zenbu userDB\n");
  printf("  -uuid <uuid>              : fetch config by uuid\n");
  printf("  -showall                  : fetch all accessible configurations\n");
  printf("  -filter <keyword logic>   :   search for configurations\n");
  printf("  -search <keyword logix>   :   search for configurations\n");
  printf("  -type <config_type>       :   select one: view, track, script, autosave\n");
  printf("  -format <type>            :   select one: minxml, descxml, fullxml, xml, search\n");
  printf("  -collab <uuid>            :   filter for specific collaboration\n");
  printf("  -user <email>             :   filter for specific user\n");
  printf("  -loadxml <xml_file>       : load configurations from XML file\n");
  printf("  -ignore_collab            :   ignore collaboration when loading (makes private)\n");
  printf("  -missing_sources          : show missing sources from configuration(s)\n");
  printf("    -share_collab <uuid>    :   test sharing for this collaboration\n");
  printf("    -share_missing          :   share the missing sources to share_collab collaboration\n");
  printf("zenbu_config_manager v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
}

//
// ------------------------------------------------------------------------------------------
//

bool  get_cmdline_user() {
  //reads ~/.zenbu/id_hmac to get hmac authentication secret
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  
  if(_user_profile) { return true; }
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

  MQDB::Database *userDB = NULL;
  if(_userDB) { userDB = _userDB; }
  else if(_webservice) { userDB = _webservice->userDB(); }

  EEDB::User *user = EEDB::User::fetch_by_email(userDB, email);
  if(user && user->hmac_secretkey() == secret) {
    _user_profile = user;
    fprintf(stderr, "%s\n", user->xml().c_str());
    _webservice->set_user_profile(_user_profile);
    return true;
  }

  return true;
}


//
// ------------------------------------------------------------------------------------------
//


void show_configs() {
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "xml"; }

  vector<EEDB::Configuration*> configs;
  map<string, long>            user_stats;

  if(_userDB) {
    string filter = _parameters["filter"];
    //int    limit  = strtol(_parameters["limit"].c_str(), NULL, 10);
    
    string config_type = _parameters["configtype"];
    if(config_type == "eeDB_gLyphs_configs")      { config_type = "VIEW"; }
    if(config_type == "eeDB_gLyph_track_configs") { config_type = "TRACK"; }
    if(config_type == "ZENBU_script_configs")     { config_type = "SCRIPT"; }
    if(config_type == "eeDB_gLyphs_autoconfigs")  { config_type = "AUTOSAVE"; }
    
    vector<DBObject*> t_array;
    if(!_parameters["uuid"].empty()) {
      EEDB::Configuration* config = EEDB::Configuration::fetch_by_uuid(_userDB, _parameters["uuid"]);
      if(config) { t_array.push_back(config); }
    } else {
      t_array = EEDB::Configuration::fetch_all(_userDB);
    }
    //vector<DBObject*> t_array = EEDB::Configuration::fetch_by_metadata_search(_userDB, config_type, NULL, filter);
    fprintf(stderr, "returned %ld configs before filter checks\n", t_array.size());
    for(unsigned i=0; i<t_array.size(); i++) {
      EEDB::Configuration *config = (EEDB::Configuration*)t_array[i];
      if((_parameters["collab"] == "private") && (config->collaboration() != NULL)) { continue; }
      if(_parameters["collab"] != "all" && _parameters["collab"] != "private") {
        if(!config->collaboration()) { continue; }
        string collab_uuid = config->collaboration()->group_uuid();
        if(collab_uuid != _parameters["collab"]) { continue; }
      }
      if(!config_type.empty() && (config->config_type() != config_type)) { continue; }

      if(!config->owner()) { continue; }
      string user_email = config->owner()->email_identity();
      if(!_parameters["user_email"].empty() && (_parameters["user_email"] != user_email)) { continue; }
//    if(user_email.empty()) { fprintf(stderr, "%s\n", config->xml().c_str()); sleep(3); }
      
      if(!filter.empty() && !config->check_by_filter_logic(filter)) { continue; }

      user_stats[config->owner()->email_identity()]++;
      configs.push_back(config);
    }
  } else {
    EEDB::WebServices::ConfigServer *configservice = new EEDB::WebServices::ConfigServer();
    configservice->parse_config_file("/etc/zenbu/zenbu.conf");
    configservice->init_service_request();
    map<string,string>::iterator param;
    for(param = _parameters.begin(); param != _parameters.end(); param++) {
      configservice->set_parameter((*param).first, (*param).second);
    }
    configservice->postprocess_parameters();
    
    get_cmdline_user();
    configservice->set_user_profile(_user_profile);
    
    EEDB::SPStreams::RemoteServerStream::set_stream_output(_parameters["format"]);
    
    if(!_parameters["uuid"].empty()) {
      EEDB::Configuration* config = configservice->get_config_uuid(_parameters["uuid"]);
      if(config) { configs.push_back(config); }
    } else {
      configs = configservice->get_configs_search();
    }
  }
  fprintf(stderr, "%ld configs after filter\n", configs.size());
  fprintf(stderr, "%ld different users\n", user_stats.size());
  map<string,long>::iterator it_u;
  for(it_u=user_stats.begin(); it_u!=user_stats.end(); it_u++) {
    fprintf(stderr, "  %s -- %ld config\n", (*it_u).first.c_str(), (*it_u).second);
  }
  sleep(5);
  
  printf("<results>\n");
  long total_configs=0;
  for(unsigned i=0; i<configs.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)configs[i];
    total_configs++;
        
    if(_parameters["format"] == "minxml") {
      printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%ld\" create_date=\"%s\">", 
             config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
      if(config->collaboration()) { printf("%s", config->collaboration()->min_xml().c_str()); }
      else { printf("<collaboration name=\"private\" uuid=\"private\" />"); }
      printf("</configuration>\n");
    }
    else if(_parameters["format"] == "descxml") {
      printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%ld\" create_date=\"%s\">\n",    
             config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
      printf("<mdata type=\"eedb:display_name\">%s</mdata>\n", html_escape(config->display_name()).c_str());
      printf("<mdata type=\"description\">%s</mdata>\n", html_escape(config->description()).c_str());
      printf("</configuration>\n");
    }
    else if(_parameters["format"] == "search") { 
      printf("<match desc=\"%s\" feature_id=\"%s\" type=\"%s\" />\n", 
             html_escape(config->display_name()).c_str(), 
             html_escape(config->uuid()).c_str(), 
             config->config_type().c_str());
    } 
    else if(_parameters["format"] == "fullxml") { 
      printf("%s", config->xml().c_str());
    }
    else {
      printf("%s", config->simple_xml().c_str());
    }    
  }
  printf("</results>\n");
  
  fprintf(stderr,"fetched configs = %ld\n", total_configs);
}

//
// ------------------------------------------------------------------------------------------
//

void missing_sources() {
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "xml"; }
  
  EEDB::WebServices::ConfigServer *configservice = new EEDB::WebServices::ConfigServer();
  configservice->parse_config_file("/etc/zenbu/zenbu.conf");
  configservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    configservice->set_parameter((*param).first, (*param).second);
  }
  configservice->postprocess_parameters();
  
  get_cmdline_user();
  configservice->set_user_profile(_user_profile);
  
  vector<EEDB::Configuration*> configs;
  
  EEDB::SPStreams::RemoteServerStream::set_stream_output(_parameters["format"]);
  
  if(!_parameters["uuid"].empty()) {
    EEDB::Configuration* config = configservice->get_config_uuid(_parameters["uuid"]);
    if(config) { configs.push_back(config); }
  } else {
    configs = configservice->get_configs_search();
  }

  MQDB::Database *userDB = NULL;
  if(_userDB) { userDB = _userDB; }
  else if(_webservice) { userDB = _webservice->userDB(); }

  EEDB::Collaboration *share_collab = NULL;
  if(!_parameters["share_collab"].empty()) {
    if(_user_profile) {
      share_collab = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["share_collab"]);
    } else {
      share_collab = EEDB::Collaboration::fetch_by_uuid(userDB, _parameters["share_collab"]);
    }
    if(!share_collab) {
      printf("WARNING can not find share collaboration [%s]\n", _parameters["share_collab"].c_str());
    } else {
      printf("share missing into %s\n", share_collab->simple_xml().c_str());
    }
  }

  EEDB::WebServices::WebBase *public_webservice = new EEDB::WebServices::WebBase();
  public_webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  public_webservice->init_service_request();
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    public_webservice->set_parameter((*param).first, (*param).second);
  }
  public_webservice->postprocess_parameters();


  //printf("<missing_sources>\n");
  long total_configs=0;
  for(unsigned i=0; i<configs.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)configs[i];
    total_configs++;
    
    printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%ld\" create_date=\"%s\">\n",    
           config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
    printf("  <mdata type=\"eedb:display_name\">%s</mdata>\n", html_escape(config->display_name()).c_str());
    printf("  <mdata type=\"description\">%s</mdata>\n", html_escape(config->description()).c_str());

    //TODO: missing sources code/display
    printf("  ====== missing sources =======\n");
    
    map<string, EEDB::DataSource*> sources = config->get_all_data_sources();
    printf("configuration has %ld total sources.. search for missing....\n", sources.size());

    EEDB::SPStreams::FederatedSourceStream* public_stream = public_webservice->secured_federated_source_stream();
    EEDB::SPStreams::FederatedSourceStream* stream2 = configservice->secured_federated_source_stream();

    map<string, EEDB::DataSource*>::iterator it1;
    for(it1=sources.begin(); it1!=sources.end(); it1++) {
      if((*it1).second) { continue; }
      string dbid = (*it1).first;
      public_stream->add_source_id_filter(dbid);
      stream2->add_source_id_filter(dbid);
    }
    
    //if there is share_collab, also add the collab into the public "compare against" search space
    if(share_collab) {
      public_stream->add_seed_peer(share_collab->group_registry());
    }
    
    //stream peers from my space to make sure they are in cache
    stream2->stream_peers();
    while(EEDB::Peer *peer = (EEDB::Peer*)stream2->next_in_stream()) {
      if(peer->classname() != EEDB::Peer::class_name) { continue; }
    }

    public_stream->stream_data_sources();
    while(EEDB::DataSource* source = (EEDB::DataSource*)public_stream->next_in_stream()) {
      if((source->classname() != EEDB::Experiment::class_name) &&
         (source->classname() != EEDB::FeatureSource::class_name)) { continue; }
      
      if(sources.find(source->db_id()) != sources.end()) {
        source->retain();
        sources[source->db_id()] = source;
        EEDB::DataSource::add_to_sources_cache(source);
      }      
    }      

    long miss_count=0;
    for(it1=sources.begin(); it1!=sources.end(); it1++) {
      if((*it1).second) { continue; }
      string dbid = (*it1).first;
      //printf("  %s\n", dbid.c_str());
      printf("  missing %s ", dbid.c_str());

      if(share_collab && (_parameters["share_missing"]=="true")) {
        string   uuid, objClass;
        long int objID;
        MQDB::unparse_dbid(dbid, uuid, objID, objClass);
        EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
        if(!peer) { printf("  error can't find peer %s", uuid.c_str()); }
        else {
          string error = share_collab->share_peer_database(peer);
          if(!error.empty()) { printf("  error: %s", error.c_str()); }
          else { printf(" shared to : %s", share_collab->display_name().c_str()); }
        }
      }
      printf("\n");
      miss_count++;
    }
    printf("\ntotal %ld missing\n", miss_count);
    printf("  ==============================\n");
    
    printf("</configuration>\n");
  }
  //printf("</missing_sources>\n");
  
  fprintf(stderr,"fetched configs = %ld\n", total_configs);
}


//
// ------------------------------------------------------------------------------------------
//


bool load_from_xmlfile() {
  MQDB::Database *userDB = NULL;
  rapidxml::xml_attribute<> *attr;
  
  if(_userDB) { userDB = _userDB; }
  else if(_webservice) { userDB = _webservice->userDB(); }
  
  if(!userDB) {
    printf("ERROR: zenbu server configuration problem. can not connect to userDB\n");
    return false;
  }
  
  if(_parameters.find("_xml_file") == _parameters.end()) { 
    printf("ERROR: must specify the path to the xml file to load\n\n");
    return false;
  }  
  int fildes = open(_parameters["_xml_file"].c_str(), O_RDONLY, 0x755);
  if(fildes<0) { 
    printf("ERROR: problem opening xml file [%s]\n\n", _parameters["_xml_file"].c_str());
    return false;
  }  
  off_t cfg_len = lseek(fildes, 0, SEEK_END);  
  //printf("config file %lld bytes long\n", (long long)cfg_len);
  lseek(fildes, 0, SEEK_SET);
  
  char* config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  //fprintf(stderr, "config:::%s\n=========\n", config_text);
  
  rapidxml::xml_document<> doc;
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  } catch(rapidxml::parse_error &e) {
    free(config_text);
    printf("ERROR: problem parsing xml file [%s]\n\n", _parameters["_xml_file"].c_str());
    return false;
  }
  
  rapidxml::xml_node<> *root_node = doc.first_node();
  if(root_node->name() != string("results")) { 
    printf("ERROR: problem parsing xml file [%s]\n\n", _parameters["_xml_file"].c_str());
    return false; 
  }
  
  //configurations
  long total_count=0, load_count=0;;
  rapidxml::xml_node<> *node = root_node->first_node("configuration");
  while(node) {   
    total_count++;
    string uuid;
    if((attr = node->first_attribute("uuid"))) { uuid = attr->value(); }
    EEDB::Configuration *config = new EEDB::Configuration(node);
    if(!config || !(config->metadataset()->has_metadata_like("configXML",""))) { 
      printf("ERROR parsing configuration [%s]\n", uuid.c_str()); 
      node = node->next_sibling("configuration");
      continue;
    }

    //printf("%s\n", config->simple_xml().c_str());
    
    EEDB::Configuration *cfg2 = EEDB::Configuration::fetch_by_uuid(userDB, config->uuid());
    if(cfg2) { 
      //printf("config already loaded [%s] %s -- %s\n", config->uuid().c_str(), config->display_name().c_str(), config->owner()->email_identity().c_str());
      cfg2->release();
      node = node->next_sibling("configuration");
      continue;
    }
      
    EEDB::MetadataSet *mdset = config->metadataset();
    mdset->remove_duplicates();
    mdset->extract_keywords();
      
    if(config->owner()) {
      EEDB::User *user = EEDB::User::fetch_by_email(userDB, config->owner()->email_identity());
      if(!user) { 
        printf("can not find user [%s]\n", config->owner()->email_identity().c_str());
        node = node->next_sibling("configuration");
        continue;
      }
      if(user) { config->owner(user); }
    } else {
      printf("config missing owner\n");
      node = node->next_sibling("configuration");
      continue;
    }
      
    printf("load [%s] -- %s\n", config->uuid().c_str(), config->display_name().c_str());
    config->store(userDB);
    load_count++;
      
    if(_import_collaboration && config->collaboration()) {
      EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userDB, config->collaboration()->group_uuid());
      if(!collab) { 
        printf("WARNING can not find collaboration [%s]-- need to create\n", config->collaboration()->group_uuid().c_str());
        //TODO: create collaboration?
      }
      if(collab) { 
        config->link_to_collaboration(collab);
      }
    }

    node = node->next_sibling("configuration");
  }
  
  free(config_text);
  doc.clear();
  fprintf(stderr, "loaded %ld / %ld configs\n",load_count, total_count);
  return true;
}





