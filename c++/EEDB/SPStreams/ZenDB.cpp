/* $Id: ZenDB.cpp,v 1.31 2021/05/22 01:43:18 severin Exp $ */

/***

NAME - EEDB::SPStreams::ZenDB

SYNOPSIS

DESCRIPTION

Converts a MQDB::Database API interface into the SPStream SourceStream API.
Allows data to be streamed into a federated query via the SPStream API.

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
#include <sys/stat.h>
#include <sys/types.h>
#include <fcntl.h>
#include <sys/time.h>
#include <zlib.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/ZenDB.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::ZenDB::class_name = "EEDB::SPStreams::ZenDB";

#define READ_BUFSIZE    8192
#define BUFSIZE         8192*3



//function prototypes
MQDB::DBObject* _spstream_zendb_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::ZenDB*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_zendb_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::ZenDB*)node)->_fetch_object_by_id(fid);
}
void _spstream_zendb_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ZenDB*)node)->_stream_clear();
}
void _spstream_zendb_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ZenDB*)node)->_stream_peers();
}
void _spstream_zendb_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ZenDB*)node)->_disconnect();
}
void _spstream_zendb_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ZenDB*)node)->_reset_stream_node();
}
void _spstream_zendb_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::ZenDB*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_zendb_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ZenDB*)node)->_reload_stream_data_sources();
}
void _spstream_zendb_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::ZenDB*)obj;
}
string _spstream_zendb_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::ZenDB*)obj)->_display_desc();
}

//dummy stubs to be implemented by subclasses
bool _spstream_zendb_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  //do nothing
  return true;
}
void _spstream_zendb_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  //do nothing
}
void _spstream_zendb_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  //do nothing
}


EEDB::SPStreams::ZenDB::ZenDB() {
  init();
}

EEDB::SPStreams::ZenDB::~ZenDB() {
  if(_database != NULL) {
    _database->release();
    _database = NULL;
  }
}

EEDB::SPStreams::ZenDB*  EEDB::SPStreams::ZenDB::new_from_url(string url) {
  EEDB::SPStreams::ZenDB*   zdb = new EEDB::SPStreams::ZenDB();
  if(zdb->_init_from_url(url)) { return zdb; }
  delete zdb;
  return NULL;
}

void EEDB::SPStreams::ZenDB::init() {
  EEDB::SPStreams::SourceStream::init();
  _classname                 = EEDB::SPStreams::ZenDB::class_name;
  _module_name               = "ZenDB";
  _db_type                   = "zdb";

  _funcptr_delete            = _spstream_zendb_delete_func;
  _funcptr_display_desc      = _spstream_zendb_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_zendb_next_in_stream_func;
  _funcptr_disconnect                         = _spstream_zendb_disconnect_func;
  _funcptr_stream_clear                       = _spstream_zendb_stream_clear_func;
  _funcptr_stream_data_sources                = _spstream_zendb_stream_data_sources_func;
  _funcptr_reload_stream_data_sources         = _spstream_zendb_reload_stream_data_sources_func;
  _funcptr_stream_peers                       = _spstream_zendb_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_zendb_reset_stream_node_func;
  _funcptr_fetch_object_by_id                 = _spstream_zendb_fetch_object_by_id_func;

  //dummy for subclasses
  _funcptr_stream_by_named_region             = _spstream_zendb_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_zendb_stream_features_by_metadata_search_func;
  _funcptr_stream_chromosomes                 = _spstream_zendb_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_zendb_stream_peers_func;

  
  //attribute variables
  _database  = NULL;
  _self_peer = NULL;
  _peer_uuid = NULL;
  _load_source_metadata = true;
  _default_assembly = NULL;
  _primary_source = NULL;
  _create_source_id = 1;
  _initialized = false;
  
  _version = 0;  //1=oscheader/sqlite version, 2=xml/cidx version
  _modify_time = 0;

}

string EEDB::SPStreams::ZenDB::_display_desc() {
  string str = "ZenDB [";
  if(_self_peer) { str += _self_peer->xml(); }
  else if(_database != NULL) { str += _database->full_url(); }
  str += "]";
  return str;
}


//////////////////////////////////////////////////////////////////////////////////////////////////


string  EEDB::SPStreams::ZenDB::create_new(string filepath) {
  _create_new(filepath);  
  _copy_self_to_deploy_dir();  
  string oscdb_url = _db_type+"://" + _zendb_dir;
  return oscdb_url;
}


string  EEDB::SPStreams::ZenDB::_create_new(string filepath) {
  //unless(filepath =~ /^\//) { filepath = getcwd ."/". filepath; }
  _parameters["_inputfile"] = filepath;
  
  if(!_create_db_dir()) { return ""; }  //empty meaning failed
  _initialized = true;
  
  //create peer
  _self_peer = new EEDB::Peer();
  _self_peer->create_uuid();
  _peers_cache[_self_peer->uuid()] = _self_peer;
 
  //set some parameters
  //TODO
  
  //last step write out the XML setup
  string xml_path = _zendb_dir + "/"+_db_type+".xml";
  int xmlfd = open(xml_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  if(xmlfd == -1) { 
    fprintf(stderr, "zendb can't open xml file [%s]\n", xml_path.c_str()); 
    return ""; //error
  }
  string xml_buffer;  
  _zendb_xml(xml_buffer);
  write(xmlfd, xml_buffer.c_str(), xml_buffer.size());
  close(xmlfd);
  
  string oscdb_url = _db_type+"://" + _zendb_dir;
  return oscdb_url;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// connection and initializatio methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::SPStreams::ZenDB::_init_from_url(string url) {
  string t_driver, t_dbname, t_conn, t_params, t_path;
  string t_hostport, t_userpass;
  size_t  p1;
  struct stat stbuf;
  
  if(url.empty()) { return false; }

  p1 = url.find("://");
  if(p1==string::npos) { return false; }
  
  t_driver = boost::algorithm::to_lower_copy(url.substr(0, p1));
  t_dbname = url.substr(p1+3);
  if(t_driver != _db_type) { return false; }
  //cout << "db_url=" << url << "\n";
 
  //edit t_dbname for trailing / or internal double //
  while(t_dbname[t_dbname.size()-1] == '/') {
    t_dbname = t_dbname.substr(0, t_dbname.size()-1);
    //fprintf(stderr, "trim trailing / [%s]\n", t_dbname.c_str());
  }
  while((p1=t_dbname.find("//"))!=string::npos) {
    t_dbname.erase(p1,1);
    //fprintf(stderr, "trim double // [%s]\n", t_dbname.c_str());
  }

  //do directory exists test
  if(stat(t_dbname.c_str(), &stbuf) == -1) { return false; }
  
  //set _zendb_dir and test if we can connect to internal sqlite database
  _zendb_dir = t_dbname;

  struct stat statbuf;
  string path = _zendb_dir + "/"+_db_type+".xml";
  if(stat(path.c_str(), &statbuf) == 0) {
    _version = 2;
    _modify_time = statbuf.st_mtime;
    return true;
  }
  path = _zendb_dir + "/"+_db_type+".sqlite";
  if(stat(path.c_str(), &statbuf) == 0) {
    _version = 1;
    _modify_time = statbuf.st_mtime;
    return true;
  }
  return false;
}


MQDB::Database* EEDB::SPStreams::ZenDB::database() {
  if(_database != NULL) { return _database; }

  if(_zendb_dir.empty()) { return NULL; }
  string path = _zendb_dir + "/"+_db_type+".sqlite";
  string t_url = "sqlite://" + path;
  //if(_debug>0) { fprintf(stderr, "connect supportdb [%s]\n", t_url.c_str());
  struct stat statbuf;
  if(stat(path.c_str(), &statbuf) != 0) { return NULL; }
  
  MQDB::Database *db = new MQDB::Database(t_url);
  if(db == NULL) { return NULL; }
    
  if(!(db->get_connection())) { 
    db->disconnect(); 
    delete db;
    return NULL; 
  }
  _database  = db;
  return _database;
}  


void  EEDB::SPStreams::ZenDB::_full_initialize() {
  if(_initialized) { return; }  
  _initialized = true;
  
  if(_version == 1) { _init_from_sqlite(); }
  if(_version == 2) { _init_from_xmldb(); }
  
  return;
}


bool  EEDB::SPStreams::ZenDB::_init_from_xmldb() {
  // ZENBU 2.xxx version ZenDB which uses XML database internally  
  string                    path = _zendb_dir + "/"+_db_type+".xml";
  int                       fildes;
  off_t                     cfg_len;
  char*                     config_text;
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node, *section_node;
    
  peer();
  
  //printf("ZenDB::_init_from_xmldb [%s]\n", path.c_str());
  fildes = open(path.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return false; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  close(fildes);
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  root_node = doc.first_node();
  if((root_node->name() != string("zendb")) and (root_node->name() != string("oscfile"))) { return false; }

  /* // parameters section
  section_node = root_node->first_node("parameters");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(string(node->name()) == "input_file") { _parameters["_inputfile"] = node->value(); } 
      else { _parameters[node->name()] = node->value(); }
      node = node->next_sibling();
    }
  } */
  
  // sources section
  section_node = root_node->first_node("sources");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(strcmp(node->name(), "experiment")==0) {
        EEDB::Experiment *exp = new EEDB::Experiment(node, _load_source_metadata);
        if(_self_peer) { exp->peer_uuid(_self_peer->uuid()); }
        exp->metadataset()->remove_metadata_like("keyword", "");
        exp->metadataset()->remove_duplicates();
        _add_datasource(exp);
        exp->release();
      }
      if(strcmp(node->name(), "featuresource")==0) {
        EEDB::FeatureSource *fsrc = new EEDB::FeatureSource(node);
        if(_self_peer) { fsrc->peer_uuid(_self_peer->uuid()); }
        fsrc->metadataset()->remove_metadata_like("keyword", "");
        fsrc->metadataset()->remove_duplicates();
        _add_datasource(fsrc);
        if(fsrc->primary_id() == 1) { 
          _primary_source = fsrc;
          fsrc->retain();
        }
        fsrc->release();
      }
      if(strcmp(node->name(), "edge_source")==0) {
        //TODO
      }
      node = node->next_sibling();
    }
  }
  free(config_text);
  
  // post processing    
  assembly();  //generate if parameter is set
  
  _database = NULL;

  if(!_sources_cache.empty()) { _sources_cache_loaded = true; }
  return true;
}


void  EEDB::SPStreams::ZenDB::_init_from_sqlite() {
  // ZENBU 1.xxx version with sqlite database
  if(!database()) { return; }

  if(peer() == NULL) { return; }  //loads from database

  //first load sources and transfer into parser
  EEDB::SPStreams::SourceStream::_reload_stream_data_sources();
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    _add_datasource(source);
    source->release();
  }

  //then setup assembly
  //string asm_name = _oscfileparser.default_assembly_name();
  //EEDB::Assembly *assembly = EEDB::Assembly::fetch_by_name(_database, asm_name);
  //_oscfileparser.set_assembly(assembly);
  //_oscfileparser.default_assembly();  //to make sure it is set

  _database->disconnect();
}


//
//////////////////////////////////////////////////////////////////////////////////////////////////
//
//example template code for subclasses to implement _fetch_object_by_id

MQDB::DBObject* EEDB::SPStreams::ZenDB::_fetch_object_by_id(string fid) {
  string uuid;
  string objClass="Feature";
  long int objID = -1;

  unparse_eedb_id(fid, uuid, objID, objClass);
  
  if(objClass == "Feature") { 
    if(uuid.empty()) { return NULL; }
    if(peer_uuid() == NULL) { return NULL; }
    if(uuid != string(_peer_uuid)) { return NULL; }
    return _fetch_feature_by_id(objID);
  }
  else { 
    // first check if we need to reload sources
    _reload_stream_data_sources(); 
    return _sources_cache[fid]; 
  }
}


EEDB::Feature*  EEDB::SPStreams::ZenDB::_fetch_feature_by_id(long int feature_id) {
  //TO BE IMPLEMENTED BY SUBCLASS
  return NULL;
}


//////////////////////////////////////////////////////////////////////////////////////////////////

/***** stream_peers
  Description: stream all known peers from database
*****/

void EEDB::SPStreams::ZenDB::_stream_peers() {
  peer(); //make sure it is loaded
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  source_stream(streambuffer);
  
  map<string, EEDB::Peer*>::iterator it;
  for(it = _peers_cache.begin(); it != _peers_cache.end(); it++) {
    EEDB::Peer* peer = (*it).second;
    peer->retain();
    streambuffer->add_object(peer);
  }
}

//
////////////////////////////////////////////////////////////////////////////////////////////////////////
//

/***** next_in_stream

  Description: since this is a source, it needs to override this method and 
               do appropriate business logic to control the stream.
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

*****/

MQDB::DBObject* EEDB::SPStreams::ZenDB::_next_in_stream() {  
  //_source_stream is a Buffer for sources,chroms....
  if(_source_stream != NULL) {
    MQDB::DBObject *obj = _source_stream->next_in_stream();
    //if no more objects then clear the source_stream()
    if(obj == NULL) { 
      _source_stream->release();
      _source_stream = NULL;
      //_disconnect();
    }
    return obj;
  }  
  return NULL;
}


/***** disconnect
  Description: disconnects handle from database, but retains object and 
               all information so that it can be reconnected again 
               at a later time.
*****/

void  EEDB::SPStreams::ZenDB::_disconnect() {
  if(_database != NULL) { _database->disconnect(); }  
  _disconnect_count++;
}


/***** stream_clear
  Description: re-initialize the stream-stack back to a clear/empty state
*****/

void EEDB::SPStreams::ZenDB::_stream_clear() {
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  _full_initialize();  //initialize if not already
}

/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::ZenDB::_reset_stream_node() {
  EEDB::SPStreams::SourceStream::_reset_stream_node();
  _full_initialize();  //make sure it is initialized now  
}


/***** assembly management section ******/

void  EEDB::SPStreams::ZenDB::set_assembly(EEDB::Assembly* assembly) {
  //first one set becomes the default assembly if not previously defined
  if(assembly==NULL) { return; }
  
  if(_default_assembly!=NULL) {
    _default_assembly->release();
    _default_assembly = NULL;
  }    
  assembly->retain();
  _default_assembly = assembly;
  _parameters["genome_assembly"] = assembly->assembly_name();
}


string  EEDB::SPStreams::ZenDB::assembly_name() {
  if(_default_assembly) { return _default_assembly->assembly_name(); }
     
  if(_parameters.find("genome_assembly") != _parameters.end()) {
    return _parameters["genome_assembly"];
  }
  return "";
}


EEDB::Assembly*  EEDB::SPStreams::ZenDB::assembly() {
  if(_default_assembly != NULL) { return _default_assembly; }
  
  if(_parameters.find("genome_assembly") != _parameters.end()) {
    _default_assembly = new EEDB::Assembly;
    _default_assembly->assembly_name(_parameters["genome_assembly"]);
  }
  return _default_assembly;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// override of EEDB::SPStream::SourceStream superclass methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


EEDB::Peer* EEDB::SPStreams::ZenDB::peer() { 
  if(_self_peer != NULL) { return _self_peer; }

  //if no _self_peer defined and _peers_cache is loaded then we are
  //cached/copy version and do not have a reference peer
  if(!_peers_cache.empty()) { return NULL; } 

  if(_version == 1) {
    // ZENBU 1.xxx version with oscheader and sqlite database
    if(!database()) { return NULL; }

    // fetch peer from sqlite database
    const char *sql = "SELECT * FROM peer WHERE is_self=1";
    Peer* peer = (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, _database, sql, "s", _database->alias().c_str());
    if(peer) { 
      _self_peer = peer;
      _peer_uuid = peer->uuid();
      _database->uuid(_peer_uuid);
      _peers_cache[peer->uuid()] = peer;
    }
    _database->disconnect();
  }
  if(_version == 2) {
    _peer_from_xml_file();
  }
  return _self_peer;
}

const char* EEDB::SPStreams::ZenDB::peer_uuid() { //override from DBObject
  peer();
  return _peer_uuid;
}

void EEDB::SPStreams::ZenDB::peer(EEDB::Peer *peer) {
  if(peer==NULL) { return; }
  _self_peer = peer;
  _peer_uuid = peer->uuid();
  if(_database) { _database->uuid(_peer_uuid); }
}


bool EEDB::SPStreams::ZenDB::_peer_from_xml_file() {
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *root_node, *node, *section_node;

  string path = _zendb_dir + "/"+_db_type+".xml";
  fildes = open(path.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return false; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  close(fildes);
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  root_node = doc.first_node();
  if(!root_node) { return false; }
  if((root_node->name() != string("zendb")) and (root_node->name() != string("oscfile"))) { return false; }  
  
  // parameters section
  section_node = root_node->first_node("parameters");
  if(section_node) {
    node = section_node->first_node();
    while(node) {
      if(string(node->name()) == "input_file") { _parameters["_inputfile"] = node->value(); }
      else { _parameters[node->name()] = node->value(); }
      node = node->next_sibling();
    }
  }

  // peers section
  node = root_node->first_node("peer");
  while(node) {
    EEDB::Peer *peer = EEDB::Peer::new_from_xml(node);
    if(peer) {
      _peers_cache[peer->uuid()] = peer;
      _self_peer = peer;
    }
    node = node->next_sibling("peer");
  }
  if(_peers_cache.size() != 1) { _self_peer = NULL; } //not defined when multiple peers
  
  _database = NULL;
  _peer_uuid = NULL;
  if(_self_peer) { 
    _peer_uuid = _self_peer->uuid(); 
    _self_peer->db_url(db_url());  //reset to actual location where this initialized from
  }
  
  free(config_text);
  return true;
}


string  EEDB::SPStreams::ZenDB::db_url() {
  return _db_type+"://" + _zendb_dir;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  source streaming section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::ZenDB::_stream_data_sources(string classname, string filter_logic) {
  if(!_source_is_active) { return; }
  
  // first check if we need to reload
  _reload_stream_data_sources();
  
  //then call the superclass method
  EEDB::SPStreams::SourceStream::_stream_data_sources(classname, filter_logic);
}


void EEDB::SPStreams::ZenDB::_reload_stream_data_sources() {
  // first check if we need to reload
  //fprintf(stderr," ZenDB::_reload_stream_data_sources [%s] stat files\n", _peer_uuid);
  struct stat statbuf;
  string path;
  if(_version==1) { path = _zendb_dir + "/"+_db_type+".sqlite"; }
  if(_version==2) { path = _zendb_dir + "/"+_db_type+".xml"; }
  if(stat(path.c_str(), &statbuf) == 0) {
    if(_modify_time != statbuf.st_mtime) { 
      _modify_time = statbuf.st_mtime;
      fprintf(stderr, "%s _reload_stream_data_sources [%s]\n", _db_type.c_str(), _peer_uuid);
      _initialized = false;
      _sources_cache_loaded = false;
      _sources_cache.clear();  //clear old cache
      
      _full_initialize();
    }
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  internal methods for building .oscdb structure
//  section for sorting the OSCdb file and building the indexes
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::ZenDB::set_parameter(string tag, string value) {
  if(tag.empty()) { return; }
  if(value.empty()) { return; }

  //convert aliases to official names
  if(tag == "genome_assemblies")    { tag = "genome_assembly"; }
  if(tag == "genome")               { tag = "genome_assembly"; }
  if(tag == "assembly_name")        { tag = "genome_assembly"; }
  if(tag == "assembly")             { tag = "genome_assembly"; }
  if(tag == "platform")             { tag = "eedb:platform"; }

  if(tag == "owner_openid")         { tag = "_owner_identity"; }
  if(tag == "owner_identity")       { tag = "_owner_identity"; }

  if(tag == "oneline-onecount")         { tag = "_singletagmap_expression"; }
  if(tag == "single_sequencetags")      { tag = "_singletagmap_expression"; }
  if(tag == "singletagmap_expression")  { tag = "_singletagmap_expression"; }

  if(tag == "build_dir")            { tag = "_build_dir"; }
  if(tag == "deploy_dir")           { tag = "_deploy_dir"; }
  
  _parameters[tag] = value;
}


bool  EEDB::SPStreams::ZenDB::save_xmldb() {
  _full_initialize();
    
  //make sure sources are cached with metadata, and clean up
  stream_data_sources("", "  "); //non-empty filter to trigger metadata load
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(_self_peer) { source->peer_uuid(_self_peer->uuid()); }  //reset uuid to keep in sync
    source->metadataset()->remove_metadata_like("osc_header","");
    source->metadataset()->remove_metadata_like("eedb:owner_nickname","");
    source->metadataset()->remove_metadata_like("eedb:owner_OpenID","");
    source->metadataset()->remove_metadata_like("eedb:owner_email","");
    source->metadataset()->remove_metadata_like("eedb:owner_uuid","");
    source->metadataset()->remove_metadata_like("eedb:dbid","");
  }

  //version the old XML database
  string xml_path = _zendb_dir + "/"+_db_type+".xml";
  struct stat statbuf;
  string tpath = xml_path+".orig";
  if(stat(tpath.c_str(), &statbuf) != 0) {
    //does not exist
    string cmd = "cp "+xml_path+" "+tpath;
    system(cmd.c_str());
  }
  tpath = xml_path+".bck";
  string cmd = "cp "+xml_path+" "+tpath;
  //fprintf(stderr, "%s", cmd.c_str());
  system(cmd.c_str());
  
  //last step write out the new XML database
  return _save_xml();
}


bool  EEDB::SPStreams::ZenDB::_save_xml() {
  //write out the XML setup
  _parameters["filetype"].clear();
  string xml_path = _zendb_dir + "/"+_db_type+".xml";
  int xmlfd = open(xml_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  if(xmlfd == -1) { 
    fprintf(stderr, "zendb can't open xml file [%s]\n", xml_path.c_str()); 
    return false; //error
  }
  string xml_buffer;
  _zendb_xml(xml_buffer);
  write(xmlfd, xml_buffer.c_str(), xml_buffer.size());
  close(xmlfd);
  
  return true;
}


void  EEDB::SPStreams::ZenDB::_zendb_xml(string &xml_buffer) {
  char    buffer[2048];
  xml_buffer.append("<zendb>\n");
  
  //parameters
  map<string,string>::iterator    p_it;
  xml_buffer.append("  <parameters>\n");  
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    if((*p_it).first.empty()) { continue; }
    if((*p_it).second.empty()) { continue; }
    snprintf(buffer, 2040, "    <%s>%s</%s>\n", (*p_it).first.c_str(), (*p_it).second.c_str(), (*p_it).first.c_str());
    xml_buffer.append(buffer);
  }
  xml_buffer.append("  </parameters>\n");
  
  //sources
  xml_buffer.append("  <sources>\n");  
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    source->xml(xml_buffer);
  }
  xml_buffer.append("  </sources>\n");  
  
  //peers
  map<string, EEDB::Peer*>::iterator it2;
  for(it2 = _peers_cache.begin(); it2 != _peers_cache.end(); it2++) {
    EEDB::Peer* peer = (*it2).second;
    peer->xml(xml_buffer); 
  }  
  
  xml_buffer.append("\n</zendb>\n");
}



bool  EEDB::SPStreams::ZenDB::_create_db_dir() {
  _zendb_dir.clear();
  _parameters["_input_dir"].clear();

  string filepath = _parameters["_inputfile"];
  if(filepath.empty()) { return false; }

  size_t ridx = filepath.rfind("/");
  if(ridx!=string::npos) {
    _parameters["_input_dir"] = filepath.substr(0,ridx);
    filepath = filepath.substr(ridx+1);
    _parameters["_filename"] = filepath;
  }
  
  string extension;    
  size_t strpos = filepath.rfind(".gz");
  if(strpos!=string::npos) { filepath.resize(strpos); }
  strpos = filepath.rfind(".");
  if(strpos!=string::npos) {
    extension = filepath.substr(strpos+1);
    filepath.resize(strpos);
  }
  _parameters["_build_filename"] = filepath;
  
  if(_parameters.find("_build_dir") != _parameters.end()) { 
    //should also check to make sure the build_dir exists with a stat()
    _zendb_dir = _parameters["_build_dir"] +"/"+ filepath + "."+_db_type;
  } else if(!_parameters["_input_dir"].empty()) {
    _zendb_dir = _parameters["_input_dir"] +"/"+ filepath + "."+_db_type;
  } else {
    _zendb_dir = filepath + "."+_db_type;
  }
  if(mkdir(_zendb_dir.c_str(), 0000775)== -1) {
    if(errno != EEXIST) { return false; }  //already existing is OK, otherwise error
  }
  return true;  
}


void  EEDB::SPStreams::ZenDB::_copy_self_to_deploy_dir() {
  //performs copy if needed, resets _zendb_dir variable

  if(_parameters.find("_deploy_dir") == _parameters.end()) { return; }
  if(_parameters.find("_build_dir")  == _parameters.end()) { return; }

  string oscdir    = _zendb_dir;
  string deploydir = _parameters["_deploy_dir"];

  size_t ridx = oscdir.rfind("/");
  if(ridx!=string::npos) {
    deploydir += oscdir.substr(ridx);
  }
  fprintf(stderr, "copy %s\n from [%s]\n to   [%s]\n", _db_type.c_str(), oscdir.c_str(), deploydir.c_str());
          
  //
  // copy to new location: deploydir may be remote scp format
  //
  string cmd;
  ridx = deploydir.find(":");
  if(ridx != string::npos) {
    string host  = deploydir.substr(0, ridx);
    string fname = deploydir.substr(ridx);
    fprintf(stderr, "scp %s back to remote location host[%s] file[%s]\n", _db_type.c_str(), host.c_str(), fname.c_str());
    cmd = "scp -rp " + oscdir + " "+ deploydir;
    deploydir = fname;
  } else {
    cmd = "cp -rp " + oscdir + " "+ deploydir;
  }
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());

  // now old version in _build_dir
  cmd = "rm "+ oscdir+"/"+_db_type+"*; rmdir "+ oscdir;
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());

  _zendb_dir = deploydir;
}


//-----------------------------------------------------------------------------------
//

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// fetch/creation of sources as needed for subclasses
//

EEDB::FeatureSource*  EEDB::SPStreams::ZenDB::_primary_featuresource() {
  if(_primary_source != NULL) { return _primary_source; }
  
  peer();
  if(!_self_peer) { return NULL; }

  _primary_source = new EEDB::FeatureSource();
  
  _primary_source->peer_uuid(_self_peer->uuid());
  _primary_source->primary_id(_create_source_id++);
  _primary_source->create_date(time(NULL));

  _add_datasource(_primary_source);
  
  if(_parameters.find("_fsrc_name") != _parameters.end()) {
    _primary_source->name(_parameters["_fsrc_name"]);    
  }
  else if(_parameters.find("display_name") != _parameters.end()) {
    _primary_source->name(_parameters["display_name"]);    
  }
  
  if(_parameters.find("_fsrc_category") != _parameters.end()) {
    _primary_source->category(_parameters["_fsrc_category"]);    
  }
  
  if(_parameters.find("_owner_identity") != _parameters.end()) {
    _primary_source->owner_identity(_parameters["_owner_identity"]);    
  }

  return _primary_source;
}


EEDB::FeatureSource*  EEDB::SPStreams::ZenDB::_get_category_featuresource(string category) {  
  if(_category_featuresources.find(category) != _category_featuresources.end()) {
    return _category_featuresources[category];
  }
  
  // not found so create
  //make sure _primary_source is created first
  if(!_primary_featuresource()) { return NULL; }
  
  EEDB::FeatureSource *source = new EEDB::FeatureSource();
  string name = _primary_source->name();
  name += "_" + category;
  source->name(name);  
  source->category(category);
  source->primary_id(_create_source_id++);
  source->peer_uuid(_primary_source->peer_uuid());
  source->create_date(time(NULL));
    
  _add_datasource(source);
  _category_featuresources[category] = source;
  
  return source;
}


EEDB::Experiment*  EEDB::SPStreams::ZenDB::_create_experiment() {  
  //make sure _primary_source is created first
  if(!_primary_featuresource()) { return NULL; }
  
  EEDB::Experiment *source = new EEDB::Experiment();
  string name = _primary_source->name();
  source->name(name);  
  source->primary_id(_create_source_id++);
  source->peer_uuid(_primary_source->peer_uuid());
  source->create_date(time(NULL));
  
  if(_parameters.find("_owner_identity") != _parameters.end()) {
    source->owner_identity(_parameters["_owner_identity"]);    
  }
  
  vector<EEDB::Metadata*> mdlist = _primary_source->metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    source->metadataset()->add_metadata(md);
    md->retain(); //add_metadata does not perform a retain
  }
  
  _add_datasource(source);  
  return source;
}


EEDB::Chrom*  EEDB::SPStreams::ZenDB::_get_chrom(const char* chrom_name) {
  if(chrom_name==NULL) { return NULL; }
  if(assembly() == NULL) { return NULL; }
  return _default_assembly->get_chrom(chrom_name);
  return NULL;
}


void  EEDB::SPStreams::ZenDB::_create_subfeature(EEDB::Feature *feature, string category, long int bidx, long int bstart, long int bsize) {  
  if(!feature) { return; }
  long int start  = feature->chrom_start();
  
  char buffer[256];
  snprintf(buffer, 256, "%ld", bidx);  
  string name = feature->primary_name() + "_block" +  buffer;
  
  EEDB::Feature *subfeat = EEDB::Feature::realloc();
  subfeat->primary_id(-1);
  subfeat->feature_source(_get_category_featuresource(category));
  subfeat->primary_name(name);
  subfeat->chrom(feature->chrom());
  subfeat->chrom_start(start + bstart);
  subfeat->chrom_end(start + bstart + bsize - 1);
  subfeat->strand(feature->strand());
  feature->add_subfeature(subfeat);
  subfeat->release(); //retained by feature

  //fprintf(stderr, "%s : [%s]\n", $subfeat->primary_name, $subfeat->chrom_location) if(_debug_level);
}

