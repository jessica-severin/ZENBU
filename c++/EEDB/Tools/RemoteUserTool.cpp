/* $Id: RemoteUserTool.cpp,v 1.8 2019/07/31 06:59:15 severin Exp $ */

/***

NAME - EEDB::Tools::RemoteUserTool

SYNOPSIS

DESCRIPTION

 Collection of methods to interact in a remote manner with a single ZENBU user system using the
 HMAC authentication protocol. Provides access to all the user manipluations WS API functions
 - upload file
 - delete file
 - edit metadata
 - share data with collaboration
 - list user uploaded data
 
CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
 * copyright (c) 2007-2013 Jessica Severin RIKEN OSC
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin RIKEN OSC nor the
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


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
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
#include <boost/algorithm/string.hpp>
#include <EEDB/Assembly.h>
#include <EEDB/Chrom.h>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/User.h>
#include <EEDB/Tools/RemoteUserTool.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::Tools::RemoteUserTool::class_name = "EEDB::Tools::RemoteUserTool";

//call out functions
void _tools_remoteusertool_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::RemoteUserTool*)obj;
}
void _tools_remoteusertool_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Tools::RemoteUserTool*)obj)->_xml(xml_buffer);
}
void _tools_remoteusertool_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Tools::RemoteUserTool*)obj)->_xml(xml_buffer);
}


////////////////////////////////////////////////////////////////////////////
//
// libcurl callback code 
//
////////////////////////////////////////////////////////////////////////////

struct RSS_curl_buffer {
  char *memory;
  size_t size;
  size_t alloc_size;
};

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


EEDB::Tools::RemoteUserTool::RemoteUserTool() {
  init();
}

EEDB::Tools::RemoteUserTool::~RemoteUserTool() {
  // we're done with libcurl, so clean it up
  curl_global_cleanup();
}


EEDB::Tools::RemoteUserTool*  EEDB::Tools::RemoteUserTool::new_from_url(string url) {
  EEDB::Tools::RemoteUserTool*   stream = new EEDB::Tools::RemoteUserTool();
  stream->server_url(url);
  if(stream->_init_remote_server()) { return stream; }
  delete stream;
  return NULL;
}


void EEDB::Tools::RemoteUserTool::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::Tools::RemoteUserTool::class_name;
  _funcptr_delete            = _tools_remoteusertool_delete_func;
  _funcptr_xml               = _tools_remoteusertool_xml_func;
  _funcptr_simple_xml        = _tools_remoteusertool_simple_xml_func;
  
  //attribute variables
  _web_peer        = NULL;
  _user            = NULL;
  
  _server_url = "http://fantom.gsc.riken.jp/zenbu/";

  curl_global_init(CURL_GLOBAL_ALL);  
}

void EEDB::Tools::RemoteUserTool::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Tools::RemoteUserTool::display_desc() {
  string str = "RemoteUserTool";
  return str;
}

string EEDB::Tools::RemoteUserTool::display_contents() {
  return display_desc();
}


void EEDB::Tools::RemoteUserTool::_xml(string &xml_buffer) {
  xml_buffer += "<remote_user_tool>\n";
  xml_buffer += "<server_url>"+ _server_url +"</server_url>\n";
  xml_buffer += "</remote_user_tool>\n";
}


////////////////////////////////////////////////////////////////////////////
//
// configuration methods
//
////////////////////////////////////////////////////////////////////////////

void  EEDB::Tools::RemoteUserTool::server_url(string url) {
  _server_url = url;
}


EEDB::User*  EEDB::Tools::RemoteUserTool::current_user() {
  if(_user) { return _user; }
  _get_cmdline_user();
  return _user;
}


void  EEDB::Tools::RemoteUserTool::set_user(EEDB::User* user) {
  if(_user) { _user->release(); _user=NULL; }
  if(user) {
    user->retain();
    _user = user;
  }
}


bool  EEDB::Tools::RemoteUserTool::_get_cmdline_user() {
  //reads ~/.zenbu/id_hmac to get hmac authentication secret
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  
  if(_user) { return true; }
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
  
  _user = new EEDB::User();
  if(email)  { _user->email_address(email); }
  if(secret) { _user->hmac_secretkey(secret); }
  
  free(config_text);
  close(fildes);
  return true;
}


void  EEDB::Tools::RemoteUserTool::set_peer_uuids(string peers) {
  _peers_filter = peers;
}


////////////////////////////////////////////////////////////////////////////
//
// spstream API call back methods
//
////////////////////////////////////////////////////////////////////////////

bool  EEDB::Tools::RemoteUserTool::_init_remote_server() {
  //uses the mode=status method to check if the server is alive
  //gets stats, get webserver uuid, allows initing fake registry_peer
  //http://fantom.gsc.riken.jp/zenbu/cgi/eedb_search.fcgi?mode=status
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
    
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL; // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string url = _server_url + "/cgi/eedb_search.fcgi?mode=status";
  //fprintf(stderr, "URL: %s\n", url.c_str());
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  curl_easy_cleanup(curl);
  
  //fprintf(stderr, "%s\n", chunk.memory);

  char *start_ptr = strstr(chunk.memory, "<zenbu_status>");
  if(!start_ptr) { free(chunk.memory); return  false; } 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
  
  rapidxml::xml_node<> *node = root_node->first_node("web_uuid");
  if(!node) { free(chunk.memory); return false; }
  
  _web_peer = new EEDB::Peer();
  _web_peer->set_uuid(node->value());
  _web_peer->db_url(_server_url);
      
  free(chunk.memory);
  return true;
}


////////////////////////////////////////////////////////////////////////////
//
// user query methods
//
////////////////////////////////////////////////////////////////////////////

bool  EEDB::Tools::RemoteUserTool::verify_remote_user() {
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
  if(current_user()) {
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>user</mode>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_user.fcgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user) {
    string key = _user->hmac_secretkey();
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


vector<EEDB::Collaboration*>  EEDB::Tools::RemoteUserTool::fetch_user_collaborations() {
  //collaborations user is member/owner of
  //might also need to cache peers, but for now try to do without caching
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  vector<EEDB::Collaboration*>   collaborations;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return collaborations; }
    
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>collaborations</mode>";  
  paramXML += "<format>fullxml</format>";  //maybe option for simple_xml
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_user.fcgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user) {
    string key = _user->hmac_secretkey();
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
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<collaborations");
  if(!start_ptr) { free(chunk.memory); return collaborations; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return collaborations; } 
  
  rapidxml::xml_node<> *node = root_node->first_node("collaboration");
  while(node) {   
    EEDB::Collaboration *obj = new EEDB::Collaboration(node);
    collaborations.push_back(obj); 
    node = node->next_sibling("collaboration");
  }

  free(chunk.memory);
  doc.clear();
  
  return collaborations;
}


EEDB::SPStream*  EEDB::Tools::RemoteUserTool::stream_uploaded_data_sources(string classname, string filter_logic) {
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  
  CURL *curl = curl_easy_init();
  if(!curl) { return streambuffer; }
    
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(current_user()) {
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  if(classname == "Experiment") { paramXML += "<mode>experiments</mode>"; }
  else if(classname == "FeatureSource") { paramXML += "<mode>feature_sources</mode>"; }
  else { paramXML += "<mode>sources</mode>"; }
  
  if(!_peers_filter.empty()) { paramXML += "<peers>"+ _peers_filter +"</peers>"; }

  if(!filter_logic.empty()) { paramXML += "<filter>"+filter_logic+"</filter>"; }
  
  paramXML += "<collab>private</collab><format>fullxml</format></zenbu_query>";  
  fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_search.fcgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user) {
    string key = _user->hmac_secretkey();
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
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = NULL;
  if(classname == "Experiment") { start_ptr = strstr(chunk.memory, "<experiments"); }
  else if(classname == "FeatureSource") { start_ptr = strstr(chunk.memory, "<feature_sources"); }
  else { start_ptr = strstr(chunk.memory, "<sources"); }
  if(!start_ptr) { free(chunk.memory); return streambuffer; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return streambuffer; } 
  
  rapidxml::xml_node<> *node;
  node = root_node->first_node("peer");
  while(node) {
    EEDB::Peer *peer = EEDB::Peer::new_from_xml(node);
    streambuffer->add_object(peer); 
    node = node->next_sibling("peer");
  }
  node = root_node->first_node("experiment");
  while(node) {   
    EEDB::Experiment *source = new EEDB::Experiment(node, true);
    streambuffer->add_object(source); 
    node = node->next_sibling("experiment");
  }
  node = root_node->first_node("featuresource");
  while(node) {
    EEDB::FeatureSource *source = new EEDB::FeatureSource(node);
    streambuffer->add_object(source); 
    node = node->next_sibling("featuresource");
  }
  
  free(chunk.memory);
  doc.clear();

  return streambuffer;
}

