/* $Id: RemoteServerStream.cpp,v 1.73 2020/10/02 23:44:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::RemoteServerStream

SYNOPSIS

DESCRIPTION

  An EEDB::SPStream subclass that functions as a high level SourceStream.
  This class allows a higher level setup using peers, federatedIDs of sources,
  and complex/dynamic source configuration with keyword searching of sources.
  Designed to allow easy configuration of complex mixed source stream with 
  minimal setup or XML description.  
  Will be used in webservices and simply scripting of data in the federation.

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
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
#include <EEDB/TrackCache.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/ZDX/ZDXsegment.h>

using namespace std;
using namespace MQDB;

const char*      EEDB::SPStreams::RemoteServerStream::class_name = "EEDB::SPStreams::RemoteServerStream";
EEDB::User*      EEDB::SPStreams::RemoteServerStream::_user = NULL;
MQDB::Database*  EEDB::SPStreams::RemoteServerStream::_userDB = NULL;
string           EEDB::SPStreams::RemoteServerStream::_stream_output = "fullxml";
string           EEDB::SPStreams::RemoteServerStream::_collaboration_filter= "";

//call out functions
void _spstream_remoteserverstream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::RemoteServerStream*)obj;
}
void _spstream_remoteserverstream_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::RemoteServerStream*)obj)->_xml(xml_buffer);
}
void _spstream_remoteserverstream_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::RemoteServerStream*)obj)->_xml(xml_buffer);
}

//SPStream functions
MQDB::DBObject* _spstream_remoteserverstream_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::RemoteServerStream*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_remoteserverstream_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::RemoteServerStream*)node)->_fetch_object_by_id(fid);
}
void _spstream_remoteserverstream_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_stream_peers();
}
void _spstream_remoteserverstream_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_stream_clear();
}
bool _spstream_remoteserverstream_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::RemoteServerStream*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_remoteserverstream_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_remoteserverstream_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_stream_chromosomes(assembly_name, chrom_name);
}
void _spstream_remoteserverstream_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_stream_features_by_metadata_search(search_logic);
}
void _spstream_remoteserverstream_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_disconnect_stream();
}
void _spstream_remoteserverstream_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_reset_stream_node();
}
void _spstream_remoteserverstream_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::RemoteServerStream*)node)->_reload_stream_data_sources();
}


////////////////////////////////////////////////////////////////////////////
//
// libcurl callback code 
//
////////////////////////////////////////////////////////////////////////////


size_t rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp) {
  size_t realsize = size * nmemb;
  struct RSS_curl_buffer *mem = (struct RSS_curl_buffer *)userp;
  //fprintf(stderr, "rss_curl_writeMemoryCallback %ld\n", realsize);
  
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


EEDB::SPStreams::RemoteServerStream::RemoteServerStream() {
  init();
}

EEDB::SPStreams::RemoteServerStream::~RemoteServerStream() {
  // we're done with libcurl, so clean it up
  curl_global_cleanup();
}


EEDB::SPStreams::RemoteServerStream*  EEDB::SPStreams::RemoteServerStream::new_from_url(string url) {
  EEDB::SPStreams::RemoteServerStream*   stream = new EEDB::SPStreams::RemoteServerStream();
  stream->server_url(url);
  if(stream->_init_remote_server()) { return stream; }
  delete stream;
  return NULL;
}


void EEDB::SPStreams::RemoteServerStream::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::RemoteServerStream::class_name;
  _module_name               = "RemoteServerStream";
  _funcptr_delete            = _spstream_remoteserverstream_delete_func;
  _funcptr_xml               = _spstream_remoteserverstream_xml_func;
  _funcptr_simple_xml        = _spstream_remoteserverstream_simple_xml_func;
  
  //function pointer code
  _funcptr_next_in_stream                     = _spstream_remoteserverstream_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_remoteserverstream_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_remoteserverstream_disconnect_func;
  _funcptr_stream_clear                       = _spstream_remoteserverstream_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_remoteserverstream_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_remoteserverstream_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_remoteserverstream_stream_data_sources_func;
  _funcptr_reload_stream_data_sources         = _spstream_remoteserverstream_reload_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_remoteserverstream_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_remoteserverstream_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_remoteserverstream_reset_stream_node_func;

  //attribute variables
  _source_stream   = NULL;
  _web_peer        = NULL;
  _user            = NULL;
  _restream_start  = -1;
  
  _server_url = "https://fantom.gsc.riken.jp/zenbu/"; //default

  curl_global_init(CURL_GLOBAL_ALL);  
}

void EEDB::SPStreams::RemoteServerStream::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::RemoteServerStream::display_desc() {
  string str = "RemoteServerStream";
  return str;
}

string EEDB::SPStreams::RemoteServerStream::display_contents() {
  return display_desc();
}


void EEDB::SPStreams::RemoteServerStream::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);

  xml_buffer += "<server_url>"+ _server_url +"</server_url>\n";

  _xml_end(xml_buffer);
}

EEDB::Peer*  EEDB::SPStreams::RemoteServerStream::master_peer() {
  return _web_peer;
}

////////////////////////////////////////////////////////////////////////////
//
// configuration methods
//
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::RemoteServerStream::server_url(string url) {
  boost::algorithm::replace_all(url, "zenbu://", "http://");
  _server_url = url;
}

void  EEDB::SPStreams::RemoteServerStream::set_current_user(EEDB::User* user) {
  if(_user) { _user->release(); _user=NULL; }
  if(user) {
    user->retain();
    _user = user;
  }
}

void  EEDB::SPStreams::RemoteServerStream::set_userDB(MQDB::Database *db) {
  if(db) { db->retain(); }
  _userDB = db;
}

void  EEDB::SPStreams::RemoteServerStream::set_stream_output(string output) {
  if(output=="fullxml" || output=="simplexml" || output == "minxml" || output == "descxml" || output == "xml") {
    _stream_output = output;
  }
}

void  EEDB::SPStreams::RemoteServerStream::set_collaboration_filter(string collab) {
  _collaboration_filter = collab;
}

void  EEDB::SPStreams::RemoteServerStream::clear_filters() {
  _filter_source_ids.clear();
  _filter_source_names.clear();
  _filter_peer_ids.clear();
  _filter_fsrc_ids.clear();
  _filter_exp_ids.clear();
}

void  EEDB::SPStreams::RemoteServerStream::add_peer_id_filter(string uuid) {
  _filter_peer_ids[uuid] = true;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}

void  EEDB::SPStreams::RemoteServerStream::add_source_id_filter(string id) {
  string   uuid;
  string   objClass="Feature";
  long int objID = -1;

  if(id.empty()) { return; }
  unparse_eedb_id(id, uuid, objID, objClass);  
  if(uuid.empty()) { return; }
  if(objClass == string("FeatureSource")) { _filter_fsrc_ids[id] = true; }
  if(objClass == string("Experiment"))    { _filter_exp_ids[id] = true; }
  _filter_source_ids[id] = true;
  _filter_peer_ids[uuid] = true;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}

void  EEDB::SPStreams::RemoteServerStream::add_object_id_filter(string id) {
  if(id.empty()) { return; }
  _filter_object_ids[id] = true;
  
  size_t p1;
  if((p1 = id.find("::")) != string::npos) {
    string uuid = id.substr(0, p1);
    _filter_peer_ids[uuid] = true;
  }
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}

void  EEDB::SPStreams::RemoteServerStream::add_source_name_filter(string name) {
  if(name.empty()) { return; }
  _filter_source_names[name] = true;  
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}

void  EEDB::SPStreams::RemoteServerStream::set_experiment_searchlogic_filter(string search_logic) {
  _filter_experiment_searchlogic = search_logic;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}



////////////////////////////////////////////////////////////////////////////
//
// spstream API call back methods
//
////////////////////////////////////////////////////////////////////////////

bool  EEDB::SPStreams::RemoteServerStream::_init_remote_server() {
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
  
  string url = _server_url + "/cgi/eedb_search.cgi?mode=status";
  //fprintf(stderr, "URL: %s\n", url.c_str());
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
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
  _web_peer->remote_server_stream(this);
  _web_peer->_is_remote = false;
      
  free(chunk.memory);
  return true;
}

////////////////////////////////////////////////////////////////////////////
//
// stream set up / reset
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::RemoteServerStream::_disconnect_stream() {
  if(_source_stream == NULL) { return; }
  _source_stream->disconnect();
}


void  EEDB::SPStreams::RemoteServerStream::_reset_stream_node() {
  //need to rebuild the source on every query because user my change
  //and security access may change
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;

  _restream_start  = -1;
  _region_assembly_name.clear();
  _region_chrom_name.clear();
  _region_start = -1;
  _region_end   = -1;

  free_sources_cache();
}


void  EEDB::SPStreams::RemoteServerStream::_stream_clear() {
  //fprintf(stderr, "EEDB::SPStreams::RemoteServerStream::_stream_clear\n");
  _reset_stream_node();
}

void EEDB::SPStreams::RemoteServerStream::_reload_stream_data_sources() {
  //do nothing
}



////////////////////////////////////////////////////////////////////////////
//
// stream query methods
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::RemoteServerStream::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }
  
  MQDB::DBObject *obj;  
  while((obj = _source_stream->next_in_stream()) != NULL) {
    if(_filter_object_ids.empty()) { return obj; }
    if(_filter_object_ids.find(obj->db_id()) != _filter_object_ids.end()) { return obj; }
    //failed filter check
    obj->release();
  }
  if(_restream_start > 0) {
    _stream_by_named_region(_region_assembly_name, _region_chrom_name, _restream_start, _region_end);
    return _next_in_stream();
  }
  
  //finished. source_stream is always a dynamically created object
  //either a StreamBuffer or a MultiMergeStream so can delete here
  _source_stream->release();
  _source_stream = NULL;
  
  return NULL;
}


EEDB::Peer*  EEDB::SPStreams::RemoteServerStream::_remote_peer_from_xml(void *xml_node) {
  //pseudo constructor using a rapidxml node
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;

  if(root_node==NULL) { return NULL; }
  if(string(root_node->name()) != "peer") { return NULL; }

  attr = root_node->first_attribute("uuid");
  if(!attr) { return NULL; }
  string uuid = attr->value();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(peer!=NULL) { return peer; } 
  //if peer is already in the cache, then we have a local mirror version of it

  peer = new EEDB::Peer;
  peer->set_uuid(uuid);
  if((attr = root_node->first_attribute("alias")))   { peer->alias(attr->value()); }
  if((attr = root_node->first_attribute("db_url")))  { peer->db_url(attr->value()); }

  //do some magick here to redirect the peer to the webservice
  peer->remote_server_stream(this);
  if(peer->alias().empty()) { peer->alias(peer->db_url()); }
  peer->alias(peer->db_url());
  peer->db_url(_server_url);

  EEDB::Peer::add_to_cache(peer);
  return peer;
}


void EEDB::SPStreams::RemoteServerStream::_stream_peers() {
  //might also need to cache peers, but for now try to do without caching
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return; }
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
    
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point

  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>peers</mode>";
  if(!_collaboration_filter.empty()) { paramXML += "<collab>"+html_escape(_collaboration_filter)+"</collab>"; }

  if(!_filter_peer_ids.empty()) {
    paramXML += "<peers>";
    map<string, bool>::iterator  it;
    for(it = _filter_peer_ids.begin(); it != _filter_peer_ids.end(); it++) {
      string uuid = (*it).first;
      if(it != _filter_peer_ids.begin()) { paramXML += ","; }
      paramXML += uuid;
    }
    paramXML += "</peers>";
  }  
  paramXML += "</zenbu_query>";  
  
  string url = _server_url + "/cgi/eedb_search.fcgi";  
  //fprintf(stderr, "POST [%s]: %s\n", url.c_str(), paramXML.c_str());

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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 

  //fprintf(stderr, "%s\n", chunk.memory);

  char *start_ptr = strstr(chunk.memory, "<peers>");
  if(!start_ptr) { free(chunk.memory); return; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; } 
    
  streambuffer->add_object(_web_peer); 

  long count=0;
  rapidxml::xml_node<> *peer_node = root_node->first_node("peer");
  while(peer_node) {   
    EEDB::Peer *peer = _remote_peer_from_xml(peer_node);
    if(peer) {
      count++;
      streambuffer->add_object(peer); 
    }
    peer_node = peer_node->next_sibling("peer");
  }
  //fprintf(stderr, "grabbed %ld peers from remote\n", count);

  free(chunk.memory);
}


MQDB::DBObject* EEDB::SPStreams::RemoteServerStream::_fetch_object_by_id(string fid) {  
  string   uuid, objClass;
  long int objID;
  MQDB::unparse_dbid(fid, uuid, objID, objClass);  
  if(uuid.empty()) { return NULL; }
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return NULL; }
    
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point

  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>object</mode><format>fullxml</format>";
  paramXML += "<id>"+fid+"</id>";  
  paramXML += "</zenbu_query>";  
  
  string url = _server_url + "/cgi/eedb_search.cgi";  
  //fprintf(stderr, "POST [%s]: %s\n", url.c_str(), paramXML.c_str());

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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<objects");
  if(!start_ptr) { free(chunk.memory); return NULL; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return NULL; } 
  
  MQDB::DBObject *obj = NULL;  
  if(objClass == "Feature") {
    rapidxml::xml_node<> *node = root_node->first_node("feature");
    if(node) {
      //first need to parse the FeatureSource so that it is cached
      rapidxml::xml_node<> *node2 = node->first_node("featuresource");
      if(node2) { 
        EEDB::FeatureSource *source = new EEDB::FeatureSource(node2); 
        EEDB::DataSource::add_to_sources_cache(source);
      }
      //the actual feature
      EEDB::Feature *feature = EEDB::Feature::realloc();
      if(feature->init_from_xml(node)) { 
        string   uuid, objClass;
        long int objID;
        MQDB::unparse_dbid(feature->db_id(), uuid, objID, objClass);
        EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
        if(peer) { 
          feature->peer_uuid(peer->uuid());
          feature->primary_id(objID);
	}
        //next get the chrom
        rapidxml::xml_node<> *node3 = node->first_node("chrom");
        if(node3) { 
          EEDB::Chrom *chrom = new EEDB::Chrom(node3); 
	  feature->chrom(chrom);
        }

        obj = feature; 
      } else { feature->release(); }
    }
  }
  if(objClass == "Experiment") {
    rapidxml::xml_node<> *node = root_node->first_node("experiment");
    if(node) { obj = new EEDB::Experiment(node, true); }
  }
  if(objClass == "FeatureSource") {
    rapidxml::xml_node<> *node = root_node->first_node("featuresource");
    if(node) { obj = new EEDB::FeatureSource(node); }
  }
  if(objClass == "EdgeSource") {
    rapidxml::xml_node<> *node = root_node->first_node("edgesource");
    if(node) { obj = new EEDB::EdgeSource(node); }
  }
  if(objClass == "Symbol") {
    rapidxml::xml_node<> *node = root_node->first_node("symbol");
    if(node) { obj = new EEDB::Symbol(node); }
  }
  if(objClass == "Metadata") {
    rapidxml::xml_node<> *node = root_node->first_node("mdata");
    if(node) { obj = new EEDB::Metadata(node); }
  }
  if(objClass == "Chrom") {
    rapidxml::xml_node<> *node = root_node->first_node("chrom");
    if(node) { obj = new EEDB::Chrom(node); }
  }
  if(objClass == "Assembly") {
    rapidxml::xml_node<> *node = root_node->first_node("assembly");
    if(node) { obj = new EEDB::Assembly(node); }
  }
  
  /*
  if(objClass == "Edge")          { return EEDB::Edge::fetch_by_id(_database, objID); }
  if(objClass == "Expression")    { return EEDB::Expression::fetch_by_id(_database, objID); }
  */
  
  free(chunk.memory);  
  return obj;
}


void  EEDB::SPStreams::RemoteServerStream::_stream_chromosomes(string assembly_name, string chrom_name) {
  //maybe I will be forced to cache assemblies since there is a circular dependancy between assembly and chrom
  //and it is hard to fix until the source stream is freed. also chroms on an assembly do not change
  //only new assemblies are added at runtime
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;

  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return; }

  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  boost::algorithm::to_lower(assembly_name);
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point

  //------------------------------------------------------------------
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>chrom</mode><format>fullxml</format>";
  if(!_collaboration_filter.empty()) { paramXML += "<collab>"+html_escape(_collaboration_filter)+"</collab>"; }
  if(!assembly_name.empty()) { paramXML += "<assembly_name>"+assembly_name+"</assembly_name>"; }
  if(!chrom_name.empty())    { paramXML += "<chrom_name>"+chrom_name+"</chrom_name>"; }  
  paramXML += "</zenbu_query>";  
  
  string url = _server_url + "/cgi/eedb_search.fcgi";  
  //fprintf(stderr, "POST [%s]: %s\n", url.c_str(), paramXML.c_str());

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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  char *start_ptr = strstr(chunk.memory, "<chroms");
  if(!start_ptr) { free(chunk.memory); return; } 
  //fprintf(stderr, "%s\n", chunk.memory);

  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; } 
  
  map<string, EEDB::Assembly*> assembly_cache;

  rapidxml::xml_node<> *assembly_node = root_node->first_node("assembly");
  while(assembly_node) {   
    EEDB::Assembly *assembly = new EEDB::Assembly(assembly_node);
    if(assembly) {
      assembly->retain();
      assembly_cache[assembly->assembly_name()] = assembly;
    }
    assembly_node = assembly_node->next_sibling("assembly");
  }

  rapidxml::xml_node<> *chrom_node = root_node->first_node("chrom");
  while(chrom_node) {   
    EEDB::Chrom *chrom = new EEDB::Chrom(chrom_node);
    if(chrom) {
      EEDB::Assembly *assembly = assembly_cache[chrom->assembly_name()];
      if(assembly) { 
        assembly->add_chrom(chrom); //adds and retains
        chrom->assembly(assembly);
      }
      chrom->release();
    }
    chrom_node = chrom_node->next_sibling("chrom");
  }

  //get remote peers into cache
  rapidxml::xml_node<> *peer_node = root_node->first_node("peer");
  while(peer_node) {
    _remote_peer_from_xml(peer_node);
    peer_node = peer_node->next_sibling("peer");
  }
  
  free(chunk.memory);

  //now work from the cache and fill the streambuffer
  map<string, EEDB::Assembly*>::iterator it;
  for(it = assembly_cache.begin(); it!=assembly_cache.end(); it++) {
    EEDB::Assembly *assembly = (*it).second;
    
    if(!assembly_name.empty() and 
       (boost::algorithm::to_lower_copy(assembly->ncbi_version()) != assembly_name) and 
       (boost::algorithm::to_lower_copy(assembly->ucsc_name()) != assembly_name)) { continue; }
    
    assembly->retain();
    streambuffer->add_object(assembly);
    
    if(!chrom_name.empty()) {
      EEDB::Chrom* chrom = assembly->get_chrom(chrom_name.c_str());
      if(chrom and (chrom->primary_id() != -1)) { 
        chrom->retain();
        streambuffer->add_object(chrom); 
      }
    } else if(!assembly_name.empty()) {
      //all chromosomes
      vector<EEDB::Chrom*> chroms;
      assembly->all_chroms(chroms);
      for(unsigned int j=0; j<chroms.size(); j++) { 
        chroms[j]->retain();
        streambuffer->add_object(chroms[j]);
      }
    }
  }  
}


void  EEDB::SPStreams::RemoteServerStream::_stream_data_sources(string classname, string filter_logic) {
  //might also need to cache peers, but for now try to do without caching
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  free_sources_cache();

  CURL *curl = curl_easy_init();
  if(!curl) { return; }
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point

  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  if(classname == "Experiment") { paramXML += "<mode>experiments</mode>"; }
  else if(classname == "FeatureSource") { paramXML += "<mode>feature_sources</mode>"; }
  else if(classname == "EdgeSource") { paramXML += "<mode>edge_sources</mode>"; }
  else { paramXML += "<mode>sources</mode>"; }

  if(!_collaboration_filter.empty()) { paramXML += "<collab>"+html_escape(_collaboration_filter)+"</collab>"; }
  if(!filter_logic.empty()) { paramXML += "<filter>"+filter_logic+"</filter>"; }
  
  if(!_filter_peer_ids.empty()) {
    paramXML += "<peers>";
    map<string, bool>::iterator  it;
    for(it = _filter_peer_ids.begin(); it != _filter_peer_ids.end(); it++) {
      string uuid = (*it).first;
      if(it != _filter_peer_ids.begin()) { paramXML += ","; }
      paramXML += uuid;
    }
    paramXML += "</peers>";
  }  
  if(!_filter_source_ids.empty()) {
    paramXML += "<source_ids>";
    map<string, bool>::iterator  it;
    for(it = _filter_source_ids.begin(); it != _filter_source_ids.end(); it++) {
      string fid = (*it).first;
      if(it != _filter_source_ids.begin()) { paramXML += ","; }
      paramXML += fid;
    }
    paramXML += "</source_ids>";
  }  
  paramXML += "<format>"+_stream_output+"</format></zenbu_query>";  
  
  //string url = _server_url + "/cgi/eedb_search.cgi";  
  string url = _server_url + "/cgi/eedb_search.fcgi";  
  //fprintf(stderr, "POST [%s]: %s\n", url.c_str(), paramXML.c_str());

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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
    
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<sources");
  if(!start_ptr) { free(chunk.memory); return; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; } 

  rapidxml::xml_node<> *node;
  node = root_node->first_node("peer");
  while(node) {
    EEDB::Peer *peer = _remote_peer_from_xml(node);
    if(peer) { streambuffer->add_object(peer); }
    node = node->next_sibling("peer");
  }
  
  node = root_node->first_node("experiment");
  while(node) {   
    EEDB::Experiment *source = new EEDB::Experiment(node, true);
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer && peer->is_remote()) {
      streambuffer->add_object(source);
      _add_datasource(source);
    }
    source->release();
    node = node->next_sibling("experiment");
  }

  node = root_node->first_node("featuresource");
  while(node) {
    EEDB::FeatureSource *source = new EEDB::FeatureSource(node);
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer && peer->is_remote()) {
      streambuffer->add_object(source);
      _add_datasource(source);
    }
    source->release();
    node = node->next_sibling("featuresource");
  }

  node = root_node->first_node("edgesource");
  while(node) {
    EEDB::EdgeSource *source = new EEDB::EdgeSource(node);
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer && peer->is_remote()) {
      streambuffer->add_object(source);
      _add_datasource(source);
    }
    source->release();
    node = node->next_sibling("edgesource");
  }
  
  
  free(chunk.memory);
  doc.clear();
}


void  EEDB::SPStreams::RemoteServerStream::_stream_features_by_metadata_search(string filter_logic) {
  //fprintf(stderr, "RemoteServerStream::_stream_features_by_metadata_search %s [%s]\n", _server_url.c_str(), filter_logic.c_str());
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;

  CURL *curl = curl_easy_init();
  if(!curl) { return; }
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>search</mode>";
  if(!filter_logic.empty()) { paramXML += "<name>"+filter_logic+"</name>"; }
  paramXML += "<format>simplexml</format>";  
  //paramXML += "<limit>1000</limit><skip_no_location>true</skip_no_location>"; //not sure about this
  
  if(!_filter_source_ids.empty()) {
    paramXML += "<source_ids>";
    map<string, bool>::iterator  it;
    for(it = _filter_source_ids.begin(); it != _filter_source_ids.end(); it++) {
      string fid = (*it).first;
      if(it != _filter_source_ids.begin()) { paramXML += ","; }
      paramXML += fid;
    }
    paramXML += "</source_ids>";
  }  
  paramXML += "</zenbu_query>";
  
  string url = _server_url + "/cgi/eedb_search.cgi";  
  //fprintf(stderr, "POST [%s]: %s\n", url.c_str(), paramXML.c_str());
  
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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<results");
  if(!start_ptr) { free(chunk.memory); return; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; } 

  //peers and sources
  rapidxml::xml_node<> *sources_node = root_node->first_node("sources");
  if(sources_node) {
    //peers
    rapidxml::xml_node<> *peer_node = sources_node->first_node("peer");
    while(peer_node) {   
      _remote_peer_from_xml(peer_node); //make sure it is cached
      peer_node = peer_node->next_sibling("peer");
    }
  
    //featuresources
    rapidxml::xml_node<> *fsrc_node = sources_node->first_node("featuresource");
    while(fsrc_node) {
      //first need to parse the FeatureSource so that it is cached
      EEDB::FeatureSource *source = new EEDB::FeatureSource(fsrc_node); 
      EEDB::DataSource::add_to_sources_cache(source);
      //source->release(); //maybe need to release the source for memory leaks
      fsrc_node = fsrc_node->next_sibling("featuresource");
    }
  }

  //now get the feature search results
  rapidxml::xml_node<> *node = root_node->first_node("feature");
  while(node) {
    //the actual feature
    EEDB::Feature *feature = EEDB::Feature::realloc();
    if(feature->init_from_xml(node)) { 
      string   uuid, objClass;
      long int objID;
      MQDB::unparse_dbid(feature->db_id(), uuid, objID, objClass);
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { 
        feature->peer_uuid(peer->uuid());
        feature->primary_id(objID);
      }
      //next get the chrom
      rapidxml::xml_node<> *node3 = node->first_node("chrom");
      if(node3) { 
        EEDB::Chrom *chrom = new EEDB::Chrom(node3); 
        feature->chrom(chrom);
      }
      //done
      streambuffer->add_object(feature); 
    }

    node = node->next_sibling("feature");
  }
  
  free(chunk.memory);
  doc.clear();  
}


bool  EEDB::SPStreams::RemoteServerStream::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  fprintf(stderr, "RemoteServerStream::_stream_by_named_region [%s] %s::%s:%ld..%ld\n", 
          _server_url.c_str(), assembly_name.c_str(), chrom_name.c_str(), start, end);

  struct timeval  starttime, endtime, time_diff;
  gettimeofday(&starttime, NULL);

  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  long feature_count=0;
  
  _region_assembly_name.clear();
  _region_chrom_name.clear();
  _region_start = -1;
  _region_end   = -1;

  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
    
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  //datatypes
  string  datatypes;
  map<string, EEDB::Datatype*>::iterator  it3;
  for(it3 = _expression_datatypes.begin(); it3 != _expression_datatypes.end(); it3++) {
    if(!datatypes.empty()) { datatypes += ","; }
    datatypes += (*it3).first;
  }  
  
  //source_ids
  string source_ids;
  if(!_filter_source_ids.empty()) {
    vector<string> _sorted_source_ids;
    map<string, bool>::iterator  it2;
    for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
      _sorted_source_ids.push_back((*it2).first);
    }
    sort(_sorted_source_ids.begin(), _sorted_source_ids.end());
    for(unsigned int i=0; i<_sorted_source_ids.size(); i++) {
      if(i>0) { source_ids += ","; }
      source_ids += _sorted_source_ids[i];
    }
  }

  if(_sourcestream_output.empty()) { _sourcestream_output = "full_feature"; }
  if(_sourcestream_output == "feature") { _sourcestream_output = "full_feature"; }
  
  //POST to remote server 
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>region</mode>";
  paramXML += "<anonymous>true</anonymous>";
  paramXML += "<format>fullxml</format>";
  paramXML += "<feature_limit_count>30000</feature_limit_count>";
  //paramXML += "<feature_limit_count>3333</feature_limit_count>";
  //paramXML += "<feature_limit_count>3</feature_limit_count>";
  
  if(!source_ids.empty()) { paramXML += "<source_ids>"+source_ids+"</source_ids>"; }
  if(!datatypes.empty()) { paramXML += "<exptype>"+datatypes+"</exptype>"; }
  paramXML += "<source_outmode>" + _sourcestream_output + "</source_outmode>";
  
  paramXML += "<asm>"+assembly_name+"</asm>";
  paramXML += "<chrom>"+chrom_name+"</chrom>";
  paramXML += "<chrom_end>"+l_to_string((long)end)+"</chrom_end>";  
  if(_restream_start >0) {
    paramXML += "<feature_restream>true</feature_restream><chrom_start>"+l_to_string((long)_restream_start)+"</chrom_start>";
  } else {
    paramXML += "<chrom_start>"+l_to_string((long)start)+"</chrom_start>";
  }
  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_region.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 

  //fprintf(stderr, "POST: %s %s\n", url.c_str(), paramXML.c_str());
  
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
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<region");
  if(!start_ptr) { free(chunk.memory); return false; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
  
  //peers and sources
  rapidxml::xml_node<> *sources_node = root_node->first_node("sources");
  if(sources_node) {
    //peers
    rapidxml::xml_node<> *peer_node = sources_node->first_node("peer");
    while(peer_node) {   
      _remote_peer_from_xml(peer_node); //make sure it is cached
      peer_node = peer_node->next_sibling("peer");
    }
    
    //featuresources
    rapidxml::xml_node<> *fsrc_node = sources_node->first_node("featuresource");
    while(fsrc_node) {
      //first need to parse the FeatureSource so that it is cached
      EEDB::FeatureSource *source = new EEDB::FeatureSource(fsrc_node); 
      EEDB::DataSource::add_to_sources_cache(source);
      source->release(); //maybe need to release the source for memory leaks
      fsrc_node = fsrc_node->next_sibling("featuresource");
    }

    //experiment
    rapidxml::xml_node<> *exp_node = sources_node->first_node("experiment");
    while(exp_node) {
      //first need to parse the Experiment so that it is cached
      EEDB::Experiment *source = new EEDB::Experiment(exp_node, true);
      EEDB::DataSource::add_to_sources_cache(source);
      source->release(); //maybe need to release the source for memory leaks
      exp_node = exp_node->next_sibling("experiment");
    }
  }
  
  //now get the feature region results
  rapidxml::xml_node<> *node = root_node->first_node("feature");
  while(node) {
    //the actual feature
    EEDB::Feature *feature = EEDB::Feature::realloc();
    if(feature->init_from_xml(node)) { 
      string   uuid, objClass;
      long int objID;
      MQDB::unparse_dbid(feature->db_id(), uuid, objID, objClass);
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { 
        feature->peer_uuid(peer->uuid());
        feature->primary_id(objID);
      }
      //next get the chrom
      rapidxml::xml_node<> *node3 = node->first_node("chrom");
      if(node3) { 
        EEDB::Chrom *chrom = new EEDB::Chrom(node3); 
        feature->chrom(chrom);
        chrom->release();
      }
      //done
      streambuffer->add_object(feature); 
      feature->retain();
      feature_count++;
    } else {
      fprintf(stderr, "feature failed to init xml\n");
    }
    feature->release();
    
    node = node->next_sibling("feature");
  }

  //get the restream information if we hit the buffer limit and need to do restreaming later
  //<restream restart_pos="50162830" limit="3" trackcache="yes" />
  _restream_start = -1; //reset
  rapidxml::xml_node<> *restream_node = root_node->first_node("restream");
  if(restream_node) {
    rapidxml::xml_attribute<> *attr;
    if((attr = restream_node->first_attribute("restart_pos"))) { 
      _restream_start = strtol(attr->value(), NULL, 10); 
      fprintf(stderr, "hit buffer limit, restream later from %ld\n", _restream_start);
    }
  }
  
  free(chunk.memory);
  doc.clear();  

  _region_start         = start;
  _region_end           = end;
  _region_assembly_name = assembly_name;
  _region_chrom_name    = chrom_name;

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  fprintf(stderr, "remote stream %ld features, %1.3fmsec :: %1.3f feature/sec\n", feature_count, runtime, feature_count*1000.0/runtime); 
 
  return true;
}
  

string  EEDB::SPStreams::RemoteServerStream::fetch_region_sequence(EEDB::User* user, string assembly_name, string chrom_name, long int start, long int end, string strand) {
  //eedb_region.cgi?format=xml;mode=sequence;source_ids=D8072E69-F090-45A0-85B6-B0CD4B1DD7F2::1:::Chrom;asm=TAIR10;loc=Chr1:38702..38827
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
    
  CURL *curl = curl_easy_init();
  if(!curl) { return ""; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>sequence</mode>";
  paramXML += "<format>xml</format>";
  paramXML += "<asm>"+assembly_name+"</asm>";  
  char buffer[2048];
  sprintf(buffer, "%s:%ld..%ld", chrom_name.c_str(), start, end);
  paramXML += "<loc>"+string(buffer)+"</loc>";
  paramXML += "<strand>"+string(strand)+"</strand>";
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "fetch_region_sequence POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_region.cgi";  
  //fprintf(stderr, "remote : %s\n", url.c_str());
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
    //fprintf(stderr, "credentials [%s]\n", credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<genome_sequence");
  if(!start_ptr) { free(chunk.memory); return ""; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return ""; }
  
  string sequence;
  rapidxml::xml_node<> *node = root_node->first_node("sequence");
  if(node) {   
    if(node->value()) { sequence = node->value(); }
    //if((attr = node->first_attribute("length"))) { _type = attr->value(); } //maybe double check length
  }
  
  free(chunk.memory);
  doc.clear();
  
  return sequence;
}


////////////////////////////////////////////////////////////////////////////
//
// Configuration query methods
//
////////////////////////////////////////////////////////////////////////////


EEDB::Configuration*  EEDB::SPStreams::RemoteServerStream::fetch_config_by_uuid(EEDB::User* user, string uuid) {
  if(uuid.empty()) { return NULL; }
  //fprintf(stderr, "EEDB::SPStreams::RemoteServerStream::fetch_config_by_uuid [%s]\n", uuid.c_str());
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return NULL; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>config</mode><format>fullxml</format>";
  paramXML += "<uuid>"+uuid+"</uuid>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_config_server.cgi";  
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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  EEDB::Configuration *config = NULL;  
  char *start_ptr = strstr(chunk.memory, "<configuration");
  if(!start_ptr) { free(chunk.memory); return NULL; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return NULL; } 
  
  if(string(root_node->name()) != "configuration") { free(chunk.memory); return NULL; }

  config = new EEDB::Configuration(root_node);
  if(config->uuid().empty()) { 
    config->release();
    config = NULL;
  }
  
  free(chunk.memory);  
  return config;
}


vector<EEDB::Configuration*>  EEDB::SPStreams::RemoteServerStream::fetch_configs_by_uuid_list(EEDB::User* user, string uuid_list) {
  vector<EEDB::Configuration*> configs;
    
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
    
  CURL *curl = curl_easy_init();
  if(!curl) { return configs; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>configs</mode>";
  paramXML += "<format>fullxml</format>"; //or simplexml
  paramXML += "<uuid_list>"+ uuid_list +"</uuid_list>";
  //if(!_collaboration_filter.empty()) { paramXML += "<collab>"+html_escape(_collaboration_filter)+"</collab>"; }
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_config_server.cgi";  
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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<configuration_list");
  if(!start_ptr) { free(chunk.memory); return configs; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return configs; } 
  
  
  rapidxml::xml_node<> *node = root_node->first_node("configuration");
  while(node) {   
    EEDB::Configuration *config = new EEDB::Configuration(node);
    configs.push_back(config);
    node = node->next_sibling("configuration");
  }
  
  free(chunk.memory);
  doc.clear();
  
  return configs;
}


vector<EEDB::Configuration*>  
EEDB::SPStreams::RemoteServerStream::fetch_configs_by_metadata_search(string config_type, EEDB::User* user, string filter_logic, string collab, string sortmode, string sortorder) {
  vector<EEDB::Configuration*> configs;
  
  //http://10.64.129.136/zenbu/cgi/eedb_config_server.cgi?configtype=view;mode=search;format=minxml;sort=create_date;sort_order=desc;collab=all
  //basic query is just
  //eedb_config_server.cgi configtype=xxxx mode=search format=minxml collab=xxxx filter=xxx
  //sort order is down outside in the ConfigServer
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  if(config_type == "view")   { config_type = "eeDB_gLyphs_configs"; }
  if(config_type == "VIEW")   { config_type = "eeDB_gLyphs_configs"; }
  if(config_type == "glyphs") { config_type = "eeDB_gLyphs_configs"; }
  if(config_type == "gLyphs") { config_type = "eeDB_gLyphs_configs"; }
  if(config_type == "track")  { config_type = "eeDB_gLyph_track_configs"; }
  if(config_type == "TRACK")  { config_type = "eeDB_gLyph_track_configs"; }
  if(config_type == "script") { config_type = "ZENBU_script_configs"; }
  if(config_type == "SCRIPT") { config_type = "ZENBU_script_configs"; }

  CURL *curl = curl_easy_init();
  if(!curl) { return configs; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>search</mode>";
  paramXML += "<format>xml</format>";
  //paramXML += "<format>"+_stream_output+"</format>";  
  paramXML += "<configtype>"+config_type+"</configtype>";  
  if(!filter_logic.empty()) { paramXML += "<filter>"+html_escape(filter_logic)+"</filter>"; }
  if(!collab.empty()) { paramXML += "<collab>"+html_escape(collab)+"</collab>"; }
  if(!sortmode.empty()) { paramXML += "<sort>"+html_escape(sortmode)+"</sort>"; }
  if(!sortorder.empty()) { paramXML += "<sort_order>"+html_escape(sortorder)+"</sort_order>"; }
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "fetch_configs_by_metadata_search POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_config_server.cgi";  
  //fprintf(stderr, "remote : %s\n", url.c_str());
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
    //fprintf(stderr, "credentials [%s]\n", credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<results");
  if(!start_ptr) { free(chunk.memory); return configs; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return configs; } 
  
  
  rapidxml::xml_node<> *node = root_node->first_node("configuration");
  while(node) {   
    EEDB::Configuration *config = new EEDB::Configuration(node);
    configs.push_back(config);
    node = node->next_sibling("configuration");
  }
  
  free(chunk.memory);
  doc.clear();
  fprintf(stderr, "fetched %ld remote configurations\n", configs.size());

  return configs;
}


vector<EEDB::Collaboration*>  EEDB::SPStreams::RemoteServerStream::fetch_collaborations(EEDB::User* user) {
  vector<EEDB::Collaboration*> collaborations;
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return collaborations; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>collaborations</mode>";
  paramXML += "<format>fullxml</format>"; //or simplexml
  //if(!collab.empty()) { paramXML += "<collab>"+html_escape(collab)+"</collab>"; }
  paramXML += "</zenbu_query>";  
  
  string url = _server_url + "/cgi/eedb_user.fcgi";  
  //fprintf(stderr, "POST [%s]: %s\n", url.c_str(), paramXML.c_str());

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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
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
  
  map<string, EEDB::Collaboration*> collab_hash;
  rapidxml::xml_node<> *node = root_node->first_node("collaboration");
  while(node) {   
    EEDB::Collaboration *collab = new EEDB::Collaboration(node);
    if(collab_hash.find(collab->group_uuid()) == collab_hash.end()) {
      collaborations.push_back(collab);
      collab_hash[collab->group_uuid()] = collab;
    }
    node = node->next_sibling("collaboration");
  }
  
  free(chunk.memory);
  doc.clear();
  
  return collaborations;
}


////////////////////////////////////////////////////////////////////////////
//
// TrackCache related methods
//
////////////////////////////////////////////////////////////////////////////


void  EEDB::SPStreams::RemoteServerStream::mirror_remote_trackcaches(string hashkey_list) {
  //fprintf(stderr, "RemoteServerStream::mirror_remote_trackcaches\n");
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  if(!_userDB) { return; }
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
    
  CURL *curl = curl_easy_init();
  if(!curl) { return; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user) {
    //paramXML += "<authenticate><openID>"+ _user->openID() +"</openID>";
    paramXML += "<authenticate><email>"+ _user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>trackcache_list</mode>";
  paramXML += "<format>xml</format>";
  paramXML += "<cache_hashkeys>"+hashkey_list+"</cache_hashkeys>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _server_url + "/cgi/eedb_region.cgi";  
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
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<region");
  if(!start_ptr) { free(chunk.memory); return; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; } 
  
  //parse results and create local TrackCache with remote-server-url 
  rapidxml::xml_node<> *node = root_node->first_node("track_cache");
  while(node) {   
    EEDB::TrackCache *tcache = new EEDB::TrackCache(node);
    if(!tcache->track_hashkey().empty()) {
      EEDB::TrackCache *tcache2 = EEDB::TrackCache::fetch_by_hashkey(_userDB, tcache->track_hashkey());
      if(tcache2) {
        tcache2->update_remote_url(_server_url);
        fprintf(stderr, "update trackcache remote url for mirroring -- %s", tcache->track_hashkey().c_str());
      } else {
        tcache->remote_server_url(_server_url);
        tcache->store(_userDB); 
        fprintf(stderr, "new trackcache for mirroring -- %s", tcache->track_hashkey().c_str());
      }
    }
    node = node->next_sibling("track_cache");
  }
  
  free(chunk.memory);
  doc.clear();
  
  return;
}


