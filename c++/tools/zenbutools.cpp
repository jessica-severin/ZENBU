/* $Id: zenbutools.cpp,v 1.20 2015/11/13 09:03:34 severin Exp $ */

/****
 
 NAME
 
 zdxtools - DESCRIPTION of Object
 
 DESCRIPTION
 
 zdxtools is a ZENBU system command line tool to access and process data both
 remotely on ZENBU federation servers and locally with ZDX file databases.
 The API is designed to both enable ZENBU advanced features, but also to provide
 a backward compatibility to samtools and bedtools so that zdxtools can be a "drop in"
 replacement for these other tools.
 
 CONTACT
 
 Jessica Severin <jessica.severin@gmail.com>
 
 LICENSE
 
 * Software License Agreement (BSD License)
 * MappedQueryDB [MQDB] toolkit
 * copyright (c) 2006-2009 Jessica Severin
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 
 APPENDIX
 
 The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _
 
 ***/

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
#include <EEDB/Feature.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/Tools/RemoteUserTool.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/WebServices/MetaSearch.h>
#include <EEDB/WebServices/RegionServer.h>
#include <EEDB/WebServices/ConfigServer.h>


#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>             _parameters;
EEDB::WebServices::WebBase     *webservice;
EEDB::User                     *_user_profile=NULL;

void  usage();
bool  get_cmdline_user();
//bool  verify_remote_user();

void  list_datasources();
void  list_peers();
void  show_object();
void  show_config();
    
int main(int argc, char *argv[]) {

  //seed random with usec of current time
  struct timeval  starttime;
  gettimeofday(&starttime, NULL);
  srand(starttime.tv_usec);

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
    if(arg == "-ids") {
      string ids;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        ids += " "+ argvals[j];
      }
      _parameters["ids"] += ids;
    }
    
    if(arg == "-mode")          { _parameters["mode"] = argvals[0]; }

    if(arg == "-file")          { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-f")             { _parameters["_input_file"] = argvals[0]; }
    
    if(arg == "-url")           { _parameters["_url"] = argvals[0]; }

    if(arg == "-hashkey")       { _parameters["hashkey"] = argvals[0]; }
    if(arg == "-buildtime")     { _parameters["buildtime"] = argvals[0]; }
    if(arg == "-jobid")         { _parameters["jobid"] = argvals[0]; _parameters["mode"] = "jobid"; }
    
    if(arg == "-assembly")      { _parameters["asmb"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["asmb"] = argvals[0]; }
    if(arg == "-asmb")          { _parameters["asmb"] = argvals[0]; }
    if(arg == "-assembly_name") { _parameters["asmb"] = argvals[0]; }
    if(arg == "-chr")           { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom")         { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom_name")    { _parameters["chrom"] = argvals[0]; }
    if(arg == "-start")         { _parameters["start"] = argvals[0]; }
    if(arg == "-end")           { _parameters["end"] = argvals[0]; }

    if(arg == "-sources")       { _parameters["mode"] = "sources"; }
    if(arg == "-experiments")   { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-exps")          { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-fsrc")          { _parameters["mode"] = "sources"; _parameters["source"] = "FeatureSource"; }
    if(arg == "-peers")         { _parameters["mode"] = "peers"; }

    if(arg == "-id")            { _parameters["mode"] = "object"; _parameters["id"] = argvals[0];  }

    if(arg == "-config")        { _parameters["mode"] = "config"; _parameters["id"] = argvals[0];  }

    if(arg == "-chroms")        { _parameters["mode"] = "chroms"; }

    if(arg == "-format")        { _parameters["format"] = argvals[0]; }
    if(arg == "-filter")        { _parameters["filter"] = argvals[0]; }
    if(arg == "-collab")        { _parameters["collab"] = argvals[0]; }
    
  }
  
  webservice = new EEDB::WebServices::WebBase();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    webservice->set_parameter((*param).first, (*param).second);
  }
  webservice->postprocess_parameters();
  get_cmdline_user();
  webservice->set_user_profile(_user_profile);

  //execute the mode
  if(_parameters["mode"] == "sources") {
    list_datasources();
  } else if(_parameters["mode"] == "peers") {
    list_peers();
  } else if(_parameters["mode"] == "object") {    
    show_object();
  } else if(_parameters["mode"] == "config") {    
    show_config();
  } else {
    usage();
  }
  
  exit(1);
}



void usage() {
  printf("zenbutools [options]\n");
  printf("  -help                     : print this help\n");
  printf("  -collab <collab_uuid>     : filter searches to specific collaboaration\n");
  printf("  -filter <keyword logix>   : filter searches with keyword expression\n");
  printf("  -sources                  : data sources query\n");
  printf("  -exps                     : data sources query for only Experiments\n");
  printf("  -fsrc                     : data sources query for only FeatureSources\n");
  printf("  -peers                    : peers query\n");
  printf("  -id <zenbu_id>            : fetch specific object\n");
  printf("  -config <uuid>            : fetch specific configuration\n");
  printf("zenbutools v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}



////////////////////////////////////////////////////////////////////////////
//
// user query methods
//
////////////////////////////////////////////////////////////////////////////


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
  char* email = strtok(config_text, " \t\n");
  char* secret = strtok(NULL, " \t\n");
  
  printf("[%s] -> [%s]\n", email, secret);
  
  _user_profile = new EEDB::User();
  if(email)  { _user_profile->email_address(email); }
  if(secret) { _user_profile->hmac_secretkey(secret); }
  
  free(config_text);
  close(fildes);
  
  return true;
}

/*
bool  verify_remote_user() {
  //collaborations user is member/owner of
  //might also need to cache peers, but for now try to do without caching
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>user</mode>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_user.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<user");
  if(!start_ptr) { free(chunk.memory); return false; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
  
  rapidxml::xml_node<> *node = root_node->first_node("eedb_user");
  EEDB::User *user = NULL;
  if(node) {   
    user = new EEDB::User(node);
  }
  if(!user) { return false; }
  
  //fprintf(stderr, "%s\n", user->xml().c_str());
  
  free(chunk.memory);
  doc.clear();
  
  return true;
}
*/

//
/////////////////////////////////////////////////////////////////////////////////////////////////
//


void list_datasources() {

  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "list"; }

  map<string, EEDB::Peer*>  peer_map;
  long exp_count=0;
  long fsrc_count=0;
  
  if(_parameters.find("collab") != _parameters.end()) {
    webservice->set_parameter("collab", _parameters["collab"]);
    webservice->postprocess_parameters();
  }
  EEDB::SPStream *stream = webservice->source_stream();

  // sources
  string source_type = "";
  if(_parameters.find("source") != _parameters.end()) {
    source_type = _parameters["source"];
  }

  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources(source_type, _parameters["filter"]);
  } else {
    stream->stream_data_sources(source_type);
  }
  
  while(MQDB::DBObject* obj = stream->next_in_stream()) {
    if(obj->classname() == EEDB::Peer::class_name) { 
      EEDB::Peer *peer = (EEDB::Peer*)obj;
      peer_map[peer->uuid()] = peer;
      continue; 
    }

    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(obj->db_id(), uuid, objID, objClass);
    //printf("        uuid: %s\n", uuid.c_str());
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    
    
    EEDB::DataSource* source = (EEDB::DataSource*)obj;
    if(obj->classname() == EEDB::Experiment::class_name) { exp_count++; }
    if(obj->classname() == EEDB::FeatureSource::class_name) { fsrc_count++; }
    
    if(_parameters["format"] == "xml") {
      printf("%s\n", source->xml().c_str());
    }
    if((_parameters["format"] == "simplexml") || (_parameters["format"] == "simple_xml")) {
      printf("%s", source->simple_xml().c_str());
    }
    if(_parameters["format"] == "list") {
      printf("%60s   %s\n", obj->db_id().c_str(),source->display_name().c_str());
    }
    if(_parameters["format"] == "detail") {
      printf("-------\n");
      printf("       db_id: %s\n", obj->db_id().c_str());
      printf("        name: %s\n", source->display_name().c_str());
      printf(" description: %s\n", source->description().c_str());
      if(peer) { printf("    peer: %s\n", peer->db_url().c_str()); }
    }
    
    source->release();
  }

  fprintf(stderr, "%ld peers --- %ld featuresources --- %ld experiments --- [%ld total sources]\n", peer_map.size(), fsrc_count, exp_count, fsrc_count+exp_count);
  stream->disconnect();  
}



void list_peers() {
  map<string, EEDB::Peer*>  peer_map;
  
  if(_parameters.find("collab") != _parameters.end()) {
    webservice->set_parameter("collab", _parameters["collab"]);
    webservice->postprocess_parameters();
  }
  EEDB::SPStream *stream = webservice->source_stream();

  // peers
  stream->stream_peers();
  while(MQDB::DBObject* obj = stream->next_in_stream()) { 
    if(!obj) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(!(peer->is_valid())) { continue; }
    peer_map[peer->uuid()] = peer;
    printf("%s\n", peer->xml().c_str());
  }

  fprintf(stderr, "%ld peers\n", peer_map.size());
  stream->disconnect();  
}



void show_object() {  
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "xml"; }

  if(_parameters.find("collab") != _parameters.end()) {
    webservice->set_parameter("collab", _parameters["collab"]);
    webservice->postprocess_parameters();
  }
  EEDB::SPStream *stream = webservice->source_stream();
  
  MQDB::DBObject* object = stream->fetch_object_by_id(_parameters["id"]);
  if(object) {
    printf("\n");
    if(_parameters["format"] == "xml") {
      printf("%s\n", object->xml().c_str());
    }
    if((_parameters["format"] == "simplexml") || (_parameters["format"] == "simple_xml")) {
      printf("%s", object->simple_xml().c_str());
    }
  } else {
    printf("unable to fetch id [%s]\n", _parameters["id"].c_str());
  }
  stream->disconnect();  
}


void show_config() {
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
  
  
  EEDB::Configuration* config = configservice->get_config_uuid(_parameters["id"]);
  if(config) {
    printf("\n");
    if(_parameters["format"] == "xml") {
      printf("%s\n", config->xml().c_str());
    }
    if((_parameters["format"] == "simplexml") || (_parameters["format"] == "simple_xml")) {
      printf("%s", config->simple_xml().c_str());
    }
  } else {
    printf("unable to fetch config [%s]\n", _parameters["id"].c_str());
  }
}



