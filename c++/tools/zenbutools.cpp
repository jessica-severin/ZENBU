/* $Id: zenbutools.cpp,v 1.25 2024/07/31 00:47:56 severin Exp $ */

/****
 
 NAME
 
 zdxtools - DESCRIPTION of Object
 
 DESCRIPTION
 
 zenbutools is a ZENBU system command line tool to access and process data both
 remotely on ZENBU federation servers and with local files.
 This will allow for pipeline processing of files outside of a ZENBU system but still
 allow for integration of data uploaded into ZENBU to be utilized in the 
 zenbutools external processing scripts
 
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
#include <sys/stat.h>
#include <fcntl.h>

#include <pwd.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
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

bool                           _verbose = false;
map<string,string>             _parameters;
EEDB::User                     *_user_profile=NULL;
long                           _login_retry_count = 0;
MQDB::Database                 *_registry_db = NULL;
vector<string>                 _input_files;
string                         _script;
struct timeval                 starttime;

string                         assembly_name;
string                         chrom_name;
long                           chrom_start = -1;
long                           chrom_end = -1;

EEDB::SPStreams::SourceStream     *input_file_stream = NULL;

FILE                              *output = stdout;
string                            _output_buffer;
EEDB::Tools::OSCTableGenerator*   _osctable_generator=NULL;

EEDB::WebServices::RegionServer   *webservice;

void  usage();
bool  get_cmdline_user();
bool  verify_remote_user();
void  parse_location();

bool  create_local_registry();
bool  load_script_file();

void  list_datasources();
void  list_peers();
void  show_object();
void  show_config();
void  stream_region();
void  stream_chrom_region(EEDB::SPStream *stream, string chrom);

void  prepare_output(EEDB::SPStream* stream);
void  close_output();
void  output_buffer_send(bool check);

    
bool build_file(string input_file);
void build_oscdb(string input_file);
void build_bamdbdb(string input_file);

int main(int argc, char *argv[]) {

  //seed random with usec of current time
  struct timeval  starttime;
  gettimeofday(&starttime, NULL);
  srand(starttime.tv_usec);

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

    if(arg == "-files") {
      for(unsigned int j=0; j<argvals.size(); j++) { 
        _input_files.push_back(argvals[j]);
      }
    }

    if(arg == "-peers") { 
      _parameters["mode"] = "peers";
      string peers;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        if(j>0) { peers += ","; }
        peers += argvals[j];
      }
      _parameters["peers"] = peers;
    }
    //if(arg == "-peer")           { _parameters["peer"] = argvals[0]; }  //peer specific filter

    if(arg == "-source_ids") {
      //<source_ids>7AA26B8D-8634-45A4-8F74-DF3E04B3456A::1:::FeatureSource,</source_ids>
      _parameters["mode"] = "sources";
      string source_ids;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        if(j>0) { source_ids += ","; }
        source_ids += argvals[j];
      }
      _parameters["source_ids"] = source_ids;
    }

    
    if(arg == "-mode")          { _parameters["mode"] = argvals[0]; }
    if(arg == "-v")             { _verbose = true; }
    if(arg == "-verbose")       { _verbose = true; }

    // local file interface and building file db
    if(arg == "-file")          { _input_files.push_back(argvals[0]); }
    if(arg == "-f")             { _input_files.push_back(argvals[0]); }
    if(arg == "-builddir")      { _parameters["_build_dir"] = argvals[0]; }
    if(arg == "-rebuild")       { _parameters["_rebuild"] = "true"; }

    if(arg == "-script")        { _parameters["_script_path"] = argvals[0]; }

    if(arg == "-o")             { _parameters["output_path"] = argvals[0]; }

    if(arg == "-o")             { _parameters["output_path"] = argvals[0]; }

    if(arg == "-keywords")      { _parameters["keywords"] = argvals[0]; }
    if(arg == "-display_name")  { _parameters["display_name"] = argvals[0]; }
    if(arg == "-description")   { _parameters["description"] = argvals[0]; }
    if(arg == "-platform")      { _parameters["platform"] = argvals[0]; }
    if(arg == "-assembly")      { _parameters["genome_assembly"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["genome_assembly"] = argvals[0]; }
    if(arg == "-ignore_int_asm"){ _parameters["ignore_internal_assembly"] = "true"; }
    if(arg == "-score_express") { _parameters["score_as_expression"] = argvals[0]; }

    if(arg == "-url")           { _parameters["_url"] = argvals[0]; }
    
    if(arg == "-assembly")      { _parameters["assembly_name"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["assembly_name"] = argvals[0]; }
    if(arg == "-asmb")          { _parameters["assembly_name"] = argvals[0]; }
    if(arg == "-assembly_name") { _parameters["assembly_name"] = argvals[0]; }
    if(arg == "-chr")           { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom")         { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom_name")    { _parameters["chrom"] = argvals[0]; }
    if(arg == "-start")         { _parameters["start"] = argvals[0]; }
    if(arg == "-end")           { _parameters["end"] = argvals[0]; }

    if(arg == "-loc")           { _parameters["loc"] = argvals[0]; _parameters["mode"] = "region"; parse_location(); }
    if(arg == "-region")        { _parameters["loc"] = argvals[0]; _parameters["mode"] = "region"; parse_location(); }

    if(arg == "-chroms")        { _parameters["mode"] = "chroms"; } //show chroms for assembly?

    //if(arg == "-hashkey")       { _parameters["hashkey"] = argvals[0]; }
    //if(arg == "-buildtime")     { _parameters["buildtime"] = argvals[0]; }
    //if(arg == "-jobid")         { _parameters["jobid"] = argvals[0]; _parameters["mode"] = "jobid"; }
    
    // <asm>hg38</asm>
    // <mode>region</mode>
    // <source_outmode>full_feature</source_outmode>
    // <display_width>907</display_width>
    // <format>fullxml</format>

    if(arg == "-sources")       { _parameters["mode"] = "sources"; }
    if(arg == "-experiments")   { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-exps")          { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-featuresources"){ _parameters["mode"] = "sources"; _parameters["source"] = "FeatureSource"; }
    if(arg == "-fsrc")          { _parameters["mode"] = "sources"; _parameters["source"] = "FeatureSource"; }
    
    if(arg == "-id")            { _parameters["mode"] = "object"; _parameters["id"] = argvals[0];  }

    if(arg == "-config")        { _parameters["mode"] = "config"; _parameters["id"] = argvals[0];  }

    if(arg == "-format")        { _parameters["format"] = argvals[0]; }
    if(arg == "-filter")        { _parameters["filter"] = argvals[0]; }
    if(arg == "-collab")        { _parameters["collab"] = argvals[0]; }
  }
  
  get_cmdline_user();
  if(!_user_profile) {
    printf("\nERROR: unable to read your ~/.zenbu/id_hmac file to identify your login identify. Please create file according to documentation.\nhttps://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/Data_loading#Bulk_command-line_upload_of_datafiles\n\n");
    usage();
  }

  if(_parameters.find("_url") == _parameters.end()) {
    printf("\nERROR: must specify -url to remote ZENBU system\n\n");
    usage(); 
  }
  if(_verbose) {  printf("zenbu URL: %s\n", _parameters["_url"].c_str()); }

  bool login_ok = verify_remote_user();
  while(!login_ok && _login_retry_count<3) {
    _login_retry_count++;
    printf("\nERROR: unable to login to remote server [%s] as user [%s] -- try %ld\n",
           _parameters["_url"].c_str(), _user_profile->email_identity().c_str(), _login_retry_count);
    sleep(_login_retry_count * 2);
    login_ok = verify_remote_user();
  }
  if(!login_ok) { usage(); }


  // local registry to help manage local files and locally built zenbu-dbs
  if(!create_local_registry()) { usage(); }
  
  //
  // connect to ZENBU server for access to remote data
  //
  webservice = new EEDB::WebServices::RegionServer();
  //webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  
  webservice->add_seed_url(_registry_db->url());  //local registry
  webservice->add_seed_url(_parameters["_url"]);  //remote zenbu
  webservice->init_db();
  
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    webservice->set_parameter((*param).first, (*param).second);
    printf("param %s : (%s)\n", (*param).first.c_str(), (*param).second.c_str());
  }
  
  if(_parameters.find("collab") != _parameters.end()) {
    webservice->set_parameter("collab", _parameters["collab"]);
  }

  if(_parameters.find("_script_path") != _parameters.end()) {
    load_script_file();
  }
   
  webservice->postprocess_parameters();
  webservice->set_user_profile(_user_profile);
  
   
  //
  // prepare/build local file into oscdb/bamdb for integration into scripting system
  //
  vector<string>::iterator file_it;

  for(file_it=_input_files.begin(); file_it!=_input_files.end(); file_it++) {
    build_file(*file_it);
    if(_parameters.find("mode") == _parameters.end()) { exit(1); } //only building dbs
  }
  
  //execute the mode
  if(_parameters["mode"] == "sources") {
    list_datasources();
  } else if(_parameters["mode"] == "peers") {
    list_peers();
  } else if(_parameters["mode"] == "object") {
    show_object();
  } else if(_parameters["mode"] == "config") {
    show_config();
  } else if(_parameters["mode"] == "region") {
    stream_region();
  } else {
    usage();
  }
  
  
  exit(1);
}



void usage() {
  printf("zenbutools [options]\n");
  printf("  -help                         : print this help\n");
  printf("  -url <url>                    : http url for remote ZENBU server\n");
  printf("  -collab <collab_uuid>         : filter searches to specific collaboaration\n");
  printf("  -filter <keyword logix>       : filter searches with keyword expression\n");
  printf("  -sources                      : data sources query\n");
  printf("  -exps                         : data sources query for only Experiments\n");
  printf("  -fsrc                         : data sources query for only FeatureSources\n");
  printf("  -peers <uuids>                : peers query with optional list of peer uuids\n");
  printf("  -source_ids <uuids>           : sources query with optional list of source uuids\n");
  printf("  -id <zenbu_id>                : fetch specific object\n");
  printf("  -config <uuid>                : fetch specific configuration\n");
  printf("  -file <path>                  : local file to be registered for processing\n");
  printf("  -files <path>                 : local files to be registered for processing (space separated)\n");
  printf("    -assembly <genome name>     : genome assembly name for coordinate space of upload\n");
  printf("    -builddir <path>            : directory to build the local databases\n");
  //printf("    -name <text>                : display name for upload data source(s)\n");
  //printf("    -desc <text>                : description for upload data source(s)\n");
  //printf("    -gff_mdata <text>           : metadata to associate with upload. In GFF attribute format like -gff_mdata \"tag1=value1;tag2=long value with spaces;tag3=value2\"\n");
  //printf("    -platform <text>            : platform metadata for upload data source(s)\n");
  printf("    -score_exp <datatype>       : use bed score column as expression value with <datatype>\n");
  printf("    -singletag_exp <datatype>   : each line of file gets expression value of 1 with <datatype>: default 'tagcount'\n");
  //printf("    -collab_uuid <uuid>         : share this uploaded data to specified collaboration\n");
  //printf("    -edges                      : indicate that this is an edge file\n");
  //printf("    -edgef1 <source_uuid>       : for edge file, link edgef1 to this data source (uuid)\n");
  //printf("    -edgef2 <source_uuid>       : for edge file, link edgef2 to this data source (uuid)\n");
  //printf("    -allow_duplicates           : do not perform the duplicate-uploads checks\n");
  printf("  -script <path                 : file containing ZENBU processing script\n");
  printf("  -verbose                      : verbose\n");

  printf("zenbutools v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


////////////////////////////////////////////////////////////////////////////
//
// libcurl callback code 
//
////////////////////////////////////////////////////////////////////////////

static size_t _rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp) {
  size_t realsize = size * nmemb;
  struct RSS_curl_buffer *mem = (struct RSS_curl_buffer *)userp;
  //fprintf(stderr, "_rss_curl_writeMemoryCallback %ld\n", realsize);
  
  if(mem->size + realsize + 1 >= mem->alloc_size) {
    mem->alloc_size += realsize + 2*1024*1024;
    mem->memory = (char*)realloc(mem->memory, mem->alloc_size);
    //fprintf(stderr, "realloc %ld\n", mem->alloc_size);
  }
  if(mem->memory == NULL) {
    // out of memory!
    fprintf(stderr, "curl not enough memory (realloc returned NULL)\n");
    exit(EXIT_FAILURE);
  }
  
  memcpy(&(mem->memory[mem->size]), contents, realsize);
  mem->size += realsize;
  mem->memory[mem->size] = 0;
  return realsize;
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
  char* url = strtok(NULL, " \t\n");
  
  //printf("[%s] -> [%s]\n", email, secret);
  
  _user_profile = new EEDB::User();
  if(email)  { _user_profile->email_address(email); }
  if(secret) { _user_profile->hmac_secretkey(secret); }

  if(url && (_parameters.find("_url")==_parameters.end()))    { _parameters["_url"] = url; }
  
  free(config_text);
  close(fildes);
  
  return true;
}


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
  
  string url = _parameters["_url"] + "/cgi/eedb_user.cgi";  
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
  
  if(_verbose) { fprintf(stderr, "%s\n", user->xml().c_str()); }
  
  free(chunk.memory);
  doc.clear();
  
  return true;
}


bool create_local_registry() {
  //creates local_registry.sqlite in ~/.zenbu/
  int                      fildes;

  struct passwd *pw = getpwuid(getuid());
  string dbpath = pw->pw_dir;
  dbpath += "/.zenbu/local_registry.sqlite";  
  if(_verbose) { fprintf(stderr, "local_registry : %s\n", dbpath.c_str());  }

  string dburl = "sqlite://" + dbpath;
  _registry_db = new MQDB::Database(dburl);
  if((_registry_db==NULL) or !(_registry_db->get_connection())) { 
    printf("\nERROR: unable to connect to registry database [%s]!!\n\n", dburl.c_str());
    if(_registry_db) { _registry_db->release(); }
    _registry_db = NULL;
    return false;
  }

  EEDB::Peer::create_peer_table_for_db(_registry_db);

  EEDB::Peer*  regPeer = EEDB::Peer::fetch_self(_registry_db);
  if(regPeer) {
    if(_verbose) { fprintf(stderr, "local_registry self-peer exists : %s\n", regPeer->xml().c_str()); }
    return true;
  }

  regPeer = EEDB::Peer::create_self_peer_for_db(_registry_db); 
  if(!regPeer) { return false; }
  if(_verbose) { fprintf(stderr, "created self peer\n"); }
  
  chmod(dbpath.c_str(), 0660);
  return true;
}


bool  load_script_file() {
  //reads ~/.zenbu/id_hmac to get hmac authentication secret
  int                      fildes;
  off_t                    len;
  char*                    script_text;
  
  _script.clear();

  if(_parameters.find("_script_path")==_parameters.end()) { return false; }
  
  string path = _parameters["_script_path"];
  
  fildes = open(path.c_str(), O_RDONLY, 0x700);
  if(fildes<0) { return false; } //error
  
  len = lseek(fildes, 0, SEEK_END);  
  //printf("script file %lld bytes long\n", (long long)len);
  lseek(fildes, 0, SEEK_SET);
  
  script_text = (char*)malloc(len+1);
  memset(script_text, 0, len+1);
  read(fildes, script_text, len);
  
  //_script = script_text;
  fprintf(stderr, "%s\n", script_text);
  
  close(fildes);
  
  //
  // parse script XML and send to webservice
  //
  // int   xml_len  = _script.size();
  // char* xml_text = (char*)malloc(xml_len+1);
  // memset(xml_text, 0, xml_len+1);
  // memcpy(xml_text, _script.c_str(), xml_len);  
  // //fprintf(stderr, "%s\n", _post_data.c_str());
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  rapidxml::xml_attribute<> *attr;
  
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(script_text);
  } catch(rapidxml::parse_error &e) {
    fprintf(stderr, "script xml parse error\n");
    free(script_text);
    return false;
  }

  root_node = doc.first_node();
  if(!root_node) { free(script_text); return false; }

  string root_name = root_node->name();
  boost::algorithm::to_lower(root_name);
  if(root_name != string("zenbu_script")) { 
    fprintf(stderr, "script missing outer <zenbu_script>\n");
    free(script_text); 
    return false;
  }
      
  webservice->parse_processing_stream(root_node);
  
  free(script_text);

  return true;
}


void parse_location() {
  size_t   p1;
  if(_parameters.find("loc") == _parameters.end()) { return; }
  
  string loc = _parameters["loc"];
  //fprintf(stderr, "parse_location %s\n", loc.c_str());

  if((p1 = loc.find("::")) != string::npos) {
    _parameters["assembly_name"] = loc.substr(0,p1);
    string tstr = loc.substr(p1+2);
    loc = tstr;
  }
  
  _parameters["chrom_name"] = loc;
  if((p1 = loc.find(":")) != string::npos) {
    _parameters["chrom_name"] = loc.substr(0,p1);
    string tstr = loc.substr(p1+1);
    if((p1 = tstr.find("..")) != string::npos) {
      _parameters["chrom_start"] = tstr.substr(0,p1);
      _parameters["chrom_end"]   = tstr.substr(p1+2);
    }
    if((p1 = tstr.find("-")) != string::npos) {
      _parameters["chrom_start"] = tstr.substr(0,p1);
      _parameters["chrom_end"]   = tstr.substr(p1+1);
    }
  }  
}

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
  //EEDB::SPStream *stream = webservice->source_stream();
  EEDB::SPStream *stream = webservice->region_stream();

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
  //fprintf(stderr, "%s\n", stream->xml().c_str());

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


void stream_region() {    
  assembly_name = _parameters["assembly_name"];
  chrom_name = _parameters["chrom_name"];
  chrom_start = strtol(_parameters["chrom_start"].c_str(),NULL, 10);
  chrom_end = strtol(_parameters["chrom_end"].c_str(), NULL,10);
  
  // if(_parameters.find("collab") != _parameters.end()) {
  //   webservice->set_parameter("collab", _parameters["collab"]);
  //   webservice->postprocess_parameters();
  // }
  
  if(_parameters["format"].empty()) { _parameters["format"]="bed12"; }

  EEDB::Assembly *assembly = webservice->find_assembly(assembly_name); //to load into cache

  EEDB::SPStream *stream = webservice->region_stream();
  
  prepare_output(stream);
  
  if(chrom_name.empty()) {
    fprintf(stderr, "stream_region : all chroms\n");
    //loop on all chroms
    chrom_start = -1;
    chrom_end = -1;

    vector<EEDB::Chrom*> chroms;
    if(assembly) { assembly->all_chroms(chroms); }
    if(!assembly || chroms.empty()) {
      _parameters["_error"] = "failed to find assembly ["+assembly_name+"] and fetch chroms";
      fprintf(stderr, "%s\n", _parameters["_error"].c_str());
      return;
    }
    fprintf(stderr, "found %ld chroms\n", chroms.size());

    vector<EEDB::Chrom*>::iterator chr_it;
    for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
      EEDB::Chrom *chrom = (*chr_it);
      stream_chrom_region(stream, chrom->chrom_name());
    }

  } else {
    stream_chrom_region(stream, chrom_name);
  }
}


void stream_chrom_region(EEDB::SPStream *stream, string chrom) {
  char                 buffer[2048];
  map<string, bool>    dep_ids;

  chrom_name = _parameters["chrom_name"];
  if(!chrom.empty()) {  
    chrom_name = chrom;
  }
  fprintf(stderr, "stream_chrom_region: %s:%ld..%ld\n", chrom_name.c_str(), chrom_start, chrom_end);
  
  // assembly = _parameters["assembly_name"];
  // chrom_name = _parameters["chrom_name"];
  // chrom_start = strtol(_parameters["chrom_start"].c_str(),NULL, 10);
  // chrom_end = strtol(_parameters["chrom_end"].c_str(), NULL,10);

//   check_over_memory();

//   if(_parameters["expression_visualize"] == "true") {
//     _parameters["overlap_mode"] = "height";
//     _parameters["binning"] = "sum";
//     _parameters["strandless"] = "true";
//     //stream = _append_expression_histogram_binning(stream);
//   }
    
  long _total_count = 0;
  long _raw_count   = 0;

  //stream data sources to make sure they are cached with metadata
  stream->stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)stream->next_in_stream()) {
    if(source->classname() != EEDB::Experiment::class_name &&
       source->classname() != EEDB::FeatureSource::class_name &&
       source->classname() != EEDB::EdgeSource::class_name) { continue; }

    EEDB::DataSource::add_to_sources_cache(source);
    dep_ids[source->db_id()] = true; 

    //string   uuid, objClass;
    //long int objID;
    //MQDB::unparse_dbid(source->db_id(), uuid, objID, objClass);
    //printf("        uuid: %s\n", uuid.c_str());
    //EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    //printf("%60s   %s\n", source->db_id().c_str(),source->display_name().c_str());
  }

  string format = _parameters["format"];
  if(format.find("gff") != string::npos) { format = "gff"; }
  if(format.find("bed") != string::npos) { format = "bed"; }
  //fprintf(stderr, "RegionServer::stream_region_features outmode[%s] format[%s] mode[%s]\n", _parameters["source_outmode"].c_str(), _parameters["format"].c_str(), _parameters["format_mode"].c_str());

  bool trim_starts=false;
  if(_parameters["feature_restream"] == "true") { trim_starts=true; }

  string last_feature_id;
  long   last_feature_start = -1;
  stream->stream_by_named_region(assembly_name, chrom_name, chrom_start, chrom_end);
  bool show_chrom=true;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Feature *feature = NULL;
    EEDB::Edge    *edge = NULL;
    if(obj->classname() == EEDB::Feature::class_name) { feature = (EEDB::Feature*)obj; }
    if(obj->classname() == EEDB::Edge::class_name)    { edge = (EEDB::Edge*)obj; }

    if(!edge && !feature) { obj->release(); continue; }

    if(edge) {
      if(format == "xml")  { 
        edge->xml(_output_buffer); 
      }
      _total_count++;
      obj->release();
      output_buffer_send(true);
      continue;
    }

    if(trim_starts && (feature->chrom_start() < chrom_start)) {
      //fprintf(stderr, "feature_restream from %ld, feature %ld trimmed\n", chrom_start, feature->chrom_start());
      feature->release();
      continue;
    }
    if(last_feature_start == -1) { last_feature_start = feature->chrom_start(); }


    //collate all the dependant sources
    EEDB::FeatureSource *fsrc;
    if(feature->feature_source()) {
      fsrc = feature->feature_source();
      if(fsrc) { dep_ids[fsrc->db_id()] = true; }
    }
    vector<EEDB::Feature*> subfeatures = feature->subfeatures();
    for(unsigned int i=0; i<subfeatures.size(); i++) { 
      fsrc = subfeatures[i]->feature_source();
      if(fsrc) { dep_ids[fsrc->db_id()] = true; }
    }
    vector<EEDB::Expression*> expression = feature->expression_array();
    for(unsigned int i=0; i<expression.size(); i++) {
      EEDB::Experiment *exp = expression[i]->experiment();
      if(exp) { dep_ids[exp->db_id()] = true; }
    }

    if(_parameters["format"].find("bed") != string::npos) { 
      _output_buffer += feature->bed_description(_parameters["format"]) + "\n";
    }

    if(_parameters["format"] == "wig") {
      //snprintf(buffer, 2040,"%d\t%1.3f\n", $start + floor(($win*$span) + 0.5), $windows->{$win}->{'all'});
    }
    
    if(format == "gff") { 
      bool show_mdata = false;
      if(_parameters["export_feature_metadata"] == "true") { show_mdata = true; }
      _output_buffer += feature->gff_description(show_mdata) + "\n"; 
    }
    if(format == "osc" && (_osctable_generator!=NULL))  { 
      _output_buffer += _osctable_generator->osctable_feature_output(feature) + "\n";
    }
    if(format == "das")  { _output_buffer += feature->dasgff_xml() + "\n"; }

    if(format == "xml")  { 
      if(show_chrom && (feature->chrom())) { 
        show_chrom=false;
        feature->chrom()->simple_xml(_output_buffer); 
      }
      if(_parameters["format_mode"] == "fullxml") { 
        feature->xml(_output_buffer);
      } else if(_parameters["submode"] == "simple_feature") { 
        feature->simple_xml(_output_buffer); 
      } else if(_parameters["submode"] == "subfeature") { 
        feature->_xml_start(_output_buffer);
        feature->_xml_subfeatures(_output_buffer);
        feature->_xml_end(_output_buffer);
      } else { 
        feature->xml(_output_buffer);
      }
    }
    _total_count++;

    last_feature_start = feature->chrom_start();
    last_feature_id = feature->db_id();

    obj->release();
    output_buffer_send(true);
  }
  //_raw_count = _raw_objcounter->count();
  //stream->stream_clear();

  //add all the sources and dependant sources that appeared in the features that streamed
  // if(_parameters["format"] == "xml") {
  //   //fprintf(stderr, "stream_region_features -- %ld dependent sources\n", dep_ids.size());
  //   EEDB::SPStreams::FederatedSourceStream  *fstream = secured_federated_source_stream();
  //   fstream->clone_peers_on_build(false);
  //   map<string, bool>::iterator it1;
  //   for(it1=dep_ids.begin(); it1!=dep_ids.end(); it1++) {
  //     fstream->add_source_id_filter((*it1).first);
  //     //fprintf(stderr, "dependent %s\n", (*it1).first.c_str());
  //   }
  //   stream = fstream;
  // 
  //   //add the script in case dynamic sources were created
  //   if(_stream_processing_head != NULL) {
  //       _output_buffer += "<note>added script for streaming of sources</note>";
  //     _stream_processing_tail->source_stream(fstream);
  //     stream = _stream_processing_head; //replace the previous stream
  //   }
  // 
  //   _output_buffer += "<sources>\n";
  //   if(_parameters.find("filter")!=_parameters.end()) { _output_buffer += "<filter>"+_parameters["filter"]+"</filter>\n"; }
  //   long int experiment_count=0, fsrc_count=0;
  //   stream->stream_data_sources();
  //   while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
  //     //source->simple_xml(_output_buffer);
  //     EEDB::DataSource::add_to_sources_cache(source);
  //     if(source->classname() == EEDB::FeatureSource::class_name) {
  //       fsrc_count++;
  //       //((EEDB::FeatureSource*)source)->desc_xml(_output_buffer);
  //     }
  //     if(source->classname() == EEDB::Experiment::class_name) {
  //       experiment_count++;
  //       //((EEDB::Experiment*)source)->desc_xml(_output_buffer);
  //     }
  //     source->mdata_xml(_output_buffer, _desc_xml_tags);
  //   }
  //   if(experiment_count>0 || fsrc_count>0) {
  //     snprintf(buffer, 2040, "<result_count experiments=\"%ld\" featuresources=\"%ld\" />\n", experiment_count, fsrc_count);
  //     _output_buffer.append(buffer);
  //   }
  //   _output_buffer += "</sources>\n";
  // 
  //   //_output_buffer += "<peers>\n";
  //   //fstream->stream_peers();
  //   //while(MQDB::DBObject* obj = fstream->next_in_stream()) { obj->xml(_output_buffer); }
  //   //_output_buffer += ("</peers>\n");
  // 
  //   fstream->release();
  // }
  
  // 
  //   // peers
  //   stream->stream_peers();
  //   while(MQDB::DBObject* obj = stream->next_in_stream()) { 
  //     if(!obj) { continue; }
  //     EEDB::Peer *peer = (EEDB::Peer*)obj;
  //     if(!(peer->is_valid())) { continue; }
  //     peer_map[peer->uuid()] = peer;
  //     printf("%s\n", peer->xml().c_str());
  //   }
  // 
  //   fprintf(stderr, "%ld peers\n", peer_map.size());
  //   stream->disconnect();
  
  output_buffer_send(false); //force a flush
}


//==========================================================================
//
// output related functions
//


void  prepare_output(EEDB::SPStream* stream) {
  string filename = "";
  string assembly_name = _parameters["assembly_name"];
  string chrom_name    = _parameters["chrom_name"];

  // if(_parameters.find("track_title") != _parameters.end()) { 
  //   filename = _parameters["track_title"];
  //   boost::algorithm::replace_all(filename, " ", "_");
  //   boost::algorithm::replace_all(filename, ",", "");
  //   boost::algorithm::replace_all(filename, ";", "");
  //   boost::algorithm::replace_all(filename, ":", "");
  //   boost::algorithm::replace_all(filename, "#", "");
  //   boost::algorithm::replace_all(filename, "@", "");
  //   boost::algorithm::replace_all(filename, "+", "");
  //   boost::algorithm::replace_all(filename, "=", "");
  //   boost::algorithm::replace_all(filename, "\%", "");
  //   boost::algorithm::replace_all(filename, "&", "");
  //   boost::algorithm::replace_all(filename, "{", "");
  //   boost::algorithm::replace_all(filename, "}", "");
  //   boost::algorithm::replace_all(filename, "\\", "");
  //   boost::algorithm::replace_all(filename, "/", "");
  //   boost::algorithm::replace_all(filename, "\?", "");
  //   boost::algorithm::replace_all(filename, "$", "");
  //   boost::algorithm::replace_all(filename, "!", "");
  //   boost::algorithm::replace_all(filename, "*", "");
  //   boost::algorithm::replace_all(filename, "<", "");
  //   boost::algorithm::replace_all(filename, ">", "");
  //   boost::algorithm::replace_all(filename, "\'", "");
  //   boost::algorithm::replace_all(filename, "`", "");
  //   boost::algorithm::replace_all(filename, "\"", "");
  // }

  if(_parameters.find("output_path") != _parameters.end()) {
    string filename = _parameters["output_path"];
    output = fopen(filename.c_str(), "w");
  }

  char buffer[2048];
  _output_buffer.clear();

  if(_parameters["format"] == "osc") {
    if(!_osctable_generator) { _osctable_generator = new EEDB::Tools::OSCTableGenerator; }
    _osctable_generator->source_stream(stream);
    _osctable_generator->assembly_name(assembly_name);

    _osctable_generator->export_subfeatures("");
    if(_parameters.find("export_subfeatures") != _parameters.end()) { _osctable_generator->export_subfeatures(_parameters["export_subfeatures"]); }

    _osctable_generator->export_experiment_metadata(false);
    if(_parameters["export_experiment_metadata"] == "true") { _osctable_generator->export_experiment_metadata(true); }

    _osctable_generator->export_header_metadata(true);
    if(_parameters["export_osc_metadata"] == "false") { _osctable_generator->export_header_metadata(false); }

    _osctable_generator->export_feature_metadata(false);
    if(_parameters["export_feature_metadata"] == "true") { _osctable_generator->export_feature_metadata(true); }

    if(_parameters.find("output_datatype") != _parameters.end()) {
      _osctable_generator->add_expression_datatype(EEDB::Datatype::get_type(_parameters["output_datatype"]));
    }
    else if(_parameters.find("exptype") != _parameters.end()) {
      _osctable_generator->add_expression_datatype(EEDB::Datatype::get_type(_parameters["exptype"]));
    }
    
    _output_buffer.append(_osctable_generator->generate_oscheader());
    output_buffer_send(false); //force a flush
  }
  
  else if(_parameters["format"].find("bed") == 0) {
    /*
    snprintf(buffer, 2040, "browser position %s %s:%ld-%ld\n", assembly_name.c_str(), chrom_name.c_str(), chrom_start, chrom_end);
    _output_buffer.append(buffer);
    //_output_buffer.append("browser hide all\n");
    if(_parameters.find("track_title") != _parameters.end()) { 
      _output_buffer += "track name=\""+_parameters["track_title"]+"\"\n";
    } else {
      _output_buffer.append("track name=\"eedb test track\"\n");
    }
    //_output_buffer.append("visibility=2\n");
    */
  }

  else if(_parameters["format"].find("gff") == 0) {
    /*
    #_output_buffer.append("browser position %s %s:%d-%d\n", $assembly_name, $chrom_name, $start, $end);
    #_output_buffer.append("browser hide all\n");
    #if($self->{'track_title'}) {
    #  _output_buffer.append("track name=\"%s\"\n", $self->{'track_title'});
    #} else {
    #  _output_buffer.append("track name=\"eedb test track\"\n");
    #}
    #_output_buffer.append("visibility=2\n");
    */
  }
  else if(_parameters["format"]  == "wig") {
    /*
    _output_buffer.append("browser position %s:%d-%d\n",  $chrom_name, $start, $end);
    _output_buffer.append("browser hide all\n");
    _output_buffer.append("browser pack refGene encodeRegions\n");
    _output_buffer.append("browser dense gap assembly rmsk mrna est\n");
    _output_buffer.append("browser full altGraph\n");

    _output_buffer.append("track type=wiggle_0 name=\"CAGE_L1\" description=\"variableStep format\" ");
    #_output_buffer.append("visibility=full autoScale=off viewLimits=0.0:25.0 color=0,255,0 ");
    _output_buffer.append("visibility=full color=0,255,0 ");
    _output_buffer.append("priority=10\n");
    _output_buffer.append("variableStep chrom=%s span=%d\n", $chrom_name, $span);
    _output_buffer.append("#params start=%s  end=%s  reg_len=%d  win_width=%s\n", $start, $end, $end-$start, _display_width);
    */
  } 
  else {
  }
  
  output_buffer_send(true);
}


void  close_output() {
  char                 buffer[2048];
  struct timeval       endtime, time_diff;
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  
  // if(_parameters["format"] == "xml") {
  //   //fprintf(stderr, "<process_summary processtime_sec=\"%1.6f\" count=\"%ld\" rawcount=\"%ld\"/>\n", runtime, _total_count, _raw_count);
  //   if(runtime < 1.0) {
  //     snprintf(buffer, 2040,"<process_summary processtime_msec=\"%1.6f\" count=\"%ld\" rawcount=\"%ld\"/>\n", runtime*1000.0, _total_count, _raw_count);
  //   } else {
  //     snprintf(buffer, 2040,"<process_summary processtime_sec=\"%1.6f\" count=\"%ld\" rawcount=\"%ld\"/>\n", runtime, _total_count, _raw_count);
  //   }
  // 
  //   _output_buffer.append(buffer);
  //   snprintf(buffer, 2040,"<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  //   _output_buffer.append(buffer);
  //   _output_buffer.append("</region>\n");
  // }
  
  // if(_parameters["format"] == "das") {
  //   _output_buffer.append("</SEGMENT>\n");
  //   _output_buffer.append("</GFF>\n");
  //   _output_buffer.append("</DASGFF>\n");      
  // }

  // if((_parameters["format"] == "wig")) {
  //   //fprintf(stderr, "wig processtime_sec: %1.3f   count: %ld\n", runtime, _total_count);
  // }
  
  // if((_parameters["format"].find("bed") != string::npos) or (_parameters["format"] == "osc")) { 
  //   //maybe also output for GFF
  //   //fprintf(stderr,"bed processtime_sec: %1.6f   raw_count: %ld   processed_count: %ld\n", runtime, _raw_count, _total_count);
  // }

  output_buffer_send(false); //forces a flush output
  
  if(output != stdout) { fclose(output); }
  
  //fprintf(stderr,"region processtime_sec: %1.6f   raw_count: %ld   processed_count: %ld\n", runtime, _raw_count, _total_count);
}


void  output_buffer_send(bool check) {
  if(check && _output_buffer.size() < 100000) { return; }
  
  fprintf(output, "%s", _output_buffer.c_str());
  fflush(stdout);

  _output_buffer.clear();
}

//==========================================================================
//
// building file into ZENBU oscdb/bamdb structure so it can be processed
//

bool build_file(string input_file) {
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    return false;    
  }
  fprintf(stderr, "input:      %s\n", input_file.c_str());
  
  // string filetype;
  // size_t p1 = input_file.rfind(".");
  // if(p1!=string::npos) {
  //   filetype = boost::algorithm::to_lower_copy(input_file.substr(p1+1));
  // }
  // printf("filetype [%s]\n", filetype.c_str());
  
  string filename = input_file;
  size_t ridx = filename.rfind("/");
  if(ridx!=string::npos) {
    _parameters["_input_dir"] = filename.substr(0,ridx);
    filename = filename.substr(ridx+1);
  }
  
  string extension;    
  size_t strpos = filename.rfind(".gz");
  if(strpos!=string::npos) { filename.resize(strpos); }
  strpos = filename.rfind(".");
  if(strpos!=string::npos) {
    extension = boost::algorithm::to_lower_copy(filename.substr(strpos+1));
    filename.resize(strpos);
  }
  _parameters["_filename"] = filename;
  _parameters["_extension"] = extension;
  
  _parameters["_build_type"] = "oscdb";
  if(extension=="bam") { _parameters["_build_type"] = "bamdb"; }
  
  string dbpath;
  
  if(_parameters.find("_build_dir") != _parameters.end()) { 
    //should also check to make sure the build_dir exists with a stat()
    dbpath = _parameters["_build_dir"] +"/"+ filename + "." + _parameters["_build_type"];
  } else if(!_parameters["_input_dir"].empty()) {
    dbpath = _parameters["_input_dir"] +"/"+ filename + "." + _parameters["_build_type"];
  } else {
    dbpath = filename + "." + _parameters["_build_type"];
  }
  
  string dburl = _parameters["_build_type"] + "://" + dbpath;
  
  fprintf(stderr, "filename:   %s\n", _parameters["_filename"].c_str());
  fprintf(stderr, "extension:  %s\n", _parameters["_extension"].c_str());
  fprintf(stderr, "build_type: %s\n", _parameters["_build_type"].c_str());
  fprintf(stderr, "dbpath:     %s\n", dbpath.c_str());
  
  
  //TODO: check if already built
  bool dbvalid = false;
  struct stat stbuf;
  if((stat(dbpath.c_str(), &stbuf) == 0) && (_parameters["_rebuild"] != "true")) { 
    printf("db exists: ");
    
    switch (stbuf.st_mode & S_IFMT) {
      case S_IFBLK:  printf("block device\n");            break;
      case S_IFCHR:  printf("character device\n");        break;
      case S_IFDIR:  printf("directory\n");               break;
      case S_IFIFO:  printf("FIFO/pipe\n");               break;
      case S_IFLNK:  printf("symlink\n");                 break;
      case S_IFREG:  printf("regular file\n");            break;
      case S_IFSOCK: printf("socket\n");                  break;
      default:       printf("unknown?\n");                break;
    }
    
    fprintf(stderr, "check dburl: %s\n", dburl.c_str());
    EEDB::Peer *t_peer = EEDB::Peer::new_from_url(dburl);
    if(t_peer) {
      if(t_peer->is_valid()) {
        fprintf(stderr, "peer is valid: %s\n", t_peer->uuid());
        if(_registry_db) {
          t_peer->store(_registry_db); //just in case
        }
        dbvalid = true;
      } else {
        fprintf(stderr, "peer is invalid\n");
        dbvalid = false;
      }
    }
  }
  
  if(dbvalid) { return true; }
  
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

  if(_parameters["_build_type"] == "bamdb") {
    build_bamdbdb(input_file);
  }
  if(_parameters["_build_type"] == "oscdb") {
    build_oscdb(input_file);
  }
  
  return true;
}


void build_oscdb(string input_file) {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
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

  string builddir = _parameters["_build_dir"];
  if(!builddir.empty()) {
    oscdb->set_parameter("build_dir",builddir);
  }
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());

  string oscpath = oscdb->create_db_for_file(input_file);
  printf("oscdb url : %s\n", oscpath.c_str());
  
  /*
  if($osclsa) { synchronize_with_OSC_LSArchive($eeDB); }
  
  my $total_time = time() - $totalstarttime;
  printf("BUILD FINISH: %1.3f min\n", $total_time/60.0);
  
  create_and_register_peer($url);
  
  #cleanup local input workfile
  if(defined($workfile) and (-e $workfile)) {
    my $cmd = "rm ". $workfile;
    print($cmd, "\n");
    system($cmd);
  }
  
  $total_time = time() - $totalstarttime;
  printf("TOTAL RUNTIME: %1.3f min\n", $total_time/60.0);
  */

  if(_parameters["test_stream"] == "true") {
    oscdb->test_stream();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("build time %1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);  
}



void build_bamdbdb(string input_file) {
  //fprintf(stderr, "build BAMDB\n");
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    usage();    
  }
  
  EEDB::SPStreams::BAMDB *bamdb = new EEDB::SPStreams::BAMDB();
  map<string,string>::iterator  it;
  for(it=_parameters.begin(); it!=_parameters.end(); it++) {
    //printf("  parameter : <%s>%s</>\n", (*it).first.c_str(), (*it).second.c_str());
    bamdb->set_parameter((*it).first, (*it).second);
  }
  
  string builddir = _parameters["_build_dir"];
  if(!builddir.empty()) {
    bamdb->set_parameter("build_dir",builddir);
  }

  
  //bamdb->set_parameter("build_dir","/tmp/");
  //bamdb->set_parameter("deploy_dir", _user_profile->user_directory());
  //bamdb->set_parameter("deploy_dir", _user_profile->user_directory());
  
  string url = bamdb->create_new(input_file);
  printf("bamdb url : %s\n", url.c_str());
  
  /*
   if($osclsa) { synchronize_with_OSC_LSArchive($eeDB); }
   
   my $total_time = time() - $totalstarttime;
   printf("BUILD FINISH: %1.3f min\n", $total_time/60.0);
   
   create_and_register_peer($url);
   
   #cleanup local input workfile
   if(defined($workfile) and (-e $workfile)) {
   my $cmd = "rm ". $workfile;
   print($cmd, "\n");
   system($cmd);
   }
   
   $total_time = time() - $totalstarttime;
   printf("TOTAL RUNTIME: %1.3f min\n", $total_time/60.0);
   */
  
  if(_parameters["test_stream"] == "true") {
    //bamdb->test_stream();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("build time %1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}





