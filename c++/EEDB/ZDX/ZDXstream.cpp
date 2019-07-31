/*  $Id: ZDXstream.cpp,v 1.59 2019/07/31 06:59:15 severin Exp $ */

/*******

NAME - EEDB::ZDX::ZDXstream

SYNOPSIS

DESCRIPTION

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

******/


#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <iostream>
#include <string>
#include <sys/stat.h>
#include <sys/types.h>
#include <fcntl.h>
#include <sys/time.h>
#include <zlib.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/Peer.h>
#include <EEDB/Chrom.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <lz4/lz4.h>

//#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 

using namespace std;
using namespace MQDB;

const char*  EEDB::ZDX::ZDXstream::class_name = "EEDB::ZDX::ZDXstream";


//function prototypes
void _zdx_zdxstream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::ZDX::ZDXstream*)obj;
}
MQDB::DBObject* _zdx_zdxstream_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::ZDX::ZDXstream*)node)->_next_in_stream();
}
MQDB::DBObject* _zdx_zdxstream_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::ZDX::ZDXstream*)node)->_fetch_object_by_id(fid);
}
void _zdx_zdxstream_stream_features_by_metadata_search_func(EEDB::SPStream* node, string filter_logic) {
  ((EEDB::ZDX::ZDXstream*)node)->_stream_features_by_metadata_search(filter_logic);
}
void _zdx_zdxstream_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::ZDX::ZDXstream*)node)->_stream_peers();
}
void _zdx_zdxstream_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::ZDX::ZDXstream*)node)->_stream_data_sources(classname, filter_logic);
}
void _zdx_zdxstream_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::ZDX::ZDXstream*)node)->_reload_stream_data_sources();
}
void _zdx_zdxstream_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  ((EEDB::ZDX::ZDXstream*)node)->_stream_chromosomes(assembly_name, chrom_name);
}
void _zdx_zdxstream_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::ZDX::ZDXstream*)node)->_disconnect();
}
void _zdx_zdxstream_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::ZDX::ZDXstream*)node)->_reset_stream_node();
}
void _zdx_zdxstream_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::ZDX::ZDXstream*)node)->_stream_clear();
}
bool _zdx_zdxstream_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::ZDX::ZDXstream*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _zdx_zdxstream_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::ZDX::ZDXstream*)obj)->_xml(xml_buffer);
}


////////////////////////////////////////////////////////////////////////////////////////////
//
//


EEDB::ZDX::ZDXstream::ZDXstream() {
  init();
}

EEDB::ZDX::ZDXstream::~ZDXstream() {
  _disconnect();
  if(_zdxdb != NULL) { _zdxdb->release(); }
}


void EEDB::ZDX::ZDXstream::init() {
  EEDB::SPStreams::SourceStream::init();

  _classname                 = EEDB::ZDX::ZDXstream::class_name;
  _module_name               = "ZDXstream";

  _funcptr_delete            = _zdx_zdxstream_delete_func;
//_funcptr_display_desc      = _zdx_zdxstream_display_desc_func;
  _funcptr_xml               = _zdx_zdxstream_xml_func;
  _funcptr_simple_xml        = _zdx_zdxstream_xml_func;
  
  //function pointer code  
  _funcptr_next_in_stream                     = _zdx_zdxstream_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _zdx_zdxstream_fetch_object_by_id_func;
  _funcptr_disconnect                         = _zdx_zdxstream_disconnect_func;
  _funcptr_stream_by_named_region             = _zdx_zdxstream_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _zdx_zdxstream_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _zdx_zdxstream_stream_data_sources_func;
  _funcptr_reload_stream_data_sources         = _zdx_zdxstream_reload_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _zdx_zdxstream_stream_chromosomes_func;
  _funcptr_stream_peers                       = _zdx_zdxstream_stream_peers_func;
  _funcptr_reset_stream_node                  = _zdx_zdxstream_reset_stream_node_func;
  _funcptr_stream_clear                       = _zdx_zdxstream_stream_clear_func;
  
  //attribute variables
  _database  = NULL;
  _peer_uuid = NULL;
  _zdxdb     = NULL;
  _zsegment  = NULL;
  _self_peer = NULL;
  
  _assembly_loaded = false;
  _assembly_cache.clear();
}


string EEDB::ZDX::ZDXstream::_display_desc() {
  string desc = "ZDXstream";
  return desc;
}

void  EEDB::ZDX::ZDXstream::_xml(string &xml_buffer) {
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// creation and building new ZDXstream
//
//////////////////////////////////////////////////////////////////////////////////////////////////


EEDB::ZDX::ZDXstream*   EEDB::ZDX::ZDXstream::create_new(string path) {
  ZDXstream*  stream = new EEDB::ZDX::ZDXstream();
  stream->_zdxdb = ZDXdb::create_new(path, "ZDXRIKENZENBU01");
  if(!stream->_zdxdb) {
    stream->release();
    stream=NULL;
  }

  return stream;
}


EEDB::ZDX::ZDXstream*   EEDB::ZDX::ZDXstream::open(string path) {
  //to open and append data
  EEDB::ZDX::ZDXstream*  stream = new EEDB::ZDX::ZDXstream();
  stream->_zdxdb = ZDXdb::open_zdx(path);
  if(!stream->_zdxdb) {
    stream->release();
    stream=NULL;
  }
  return stream;
}


void   EEDB::ZDX::ZDXstream::add_datasource(EEDB::DataSource* source) {
  _reload_stream_data_sources();
  _add_datasource(source);
}


void   EEDB::ZDX::ZDXstream::add_peer(EEDB::Peer* peer) {
  if(peer == NULL) { return; }
  _reload_stream_data_sources();
  string uuid = peer->uuid();
  if(_peers_cache.find(uuid) == _peers_cache.end()) { 
    peer->retain();
    _peers_cache[uuid] = peer;
  }
}


void   EEDB::ZDX::ZDXstream::add_genome(EEDB::Assembly* assembly) {
  //for loading new genomes
  if(!assembly) { return; }
  if(!assembly->sequence_loaded()) { return; }

  _reload_stream_data_sources();

  for(unsigned int i=0; i<_assembly_cache.size(); i++) {
    EEDB::Assembly *asm1 = (EEDB::Assembly*)_assembly_cache[i];
    if(asm1->assembly_name() == assembly->assembly_name()) return;
  }
  
  assembly->retain();
  _assembly_cache.push_back(assembly);
  _assembly_loaded = true;
}


bool  EEDB::ZDX::ZDXstream::genome_sequence_loaded() {
  _reload_stream_data_sources();
  return _assembly_loaded;
}


EEDB::Peer*  EEDB::ZDX::ZDXstream::self_peer() {
  _reload_stream_data_sources();   // first check if we need to reload
  if(_self_peer) { return _self_peer; }
  
  //no self_peer defined so create it and write back
  string url = "zdx://" + _zdxdb->path();
  _self_peer = new EEDB::Peer();
  _self_peer->create_uuid();
  _self_peer->db_url(url);
  
  write_source_section();
  return _self_peer;
}


bool   EEDB::ZDX::ZDXstream::write_source_section() {
  //sources are stored in a simple subsystem. 
  //a single znode contains all the sources
  //header section [1] simply contains pointer to znode
  string xml_buffer = "<zdx>";
  
  if(_self_peer) {
    xml_buffer += "<registry_peer>";
    _self_peer->xml(xml_buffer);
    xml_buffer += "</registry_peer>";
  }
  
  map<string, EEDB::Peer*>::iterator  peer_it;
  for(peer_it = _peers_cache.begin(); peer_it != _peers_cache.end(); peer_it++) {
    EEDB::Peer* peer = (*peer_it).second;
    if(peer == NULL) { continue; }
    peer->xml(xml_buffer);
  }

  map<string, EEDB::DataSource*>::iterator  source_it;
  for(source_it = _sources_cache.begin(); source_it != _sources_cache.end(); source_it++) {
    EEDB::DataSource* source = (*source_it).second;
    if(source == NULL) { continue; }
    source->xml(xml_buffer);
  }
  
  vector<EEDB::Assembly*>::iterator  assembly_it;
  for(assembly_it = _assembly_cache.begin(); assembly_it != _assembly_cache.end(); assembly_it++) {
    if((*assembly_it) == NULL) { continue; }
    (*assembly_it)->xml(xml_buffer);
  }

  xml_buffer += "</zdx>";

  uint32_t  uncompress_buffer_len = xml_buffer.size();
  uLongf    cbuf_len = compressBound(uncompress_buffer_len)+16; //add a few extra bytes to be safe
  Bytef*    compress_buffer = (Bytef*)malloc(cbuf_len);
  
  if(compress(compress_buffer, &cbuf_len, (Bytef*)xml_buffer.c_str(), xml_buffer.size()) != Z_OK) {
    fprintf(stderr, "zdxstream error compressing sources\n");
    return false;
  }
  
  zdxnode* znode = _zdxdb->allocate_znode(cbuf_len+sizeof(uint32_t));
  
  //first write binary long of length of compress buffer
  memcpy(znode->blob, &uncompress_buffer_len, sizeof(uint32_t));
  //fprintf(stderr, "uncompress_buffer_len %d\n", uncompress_buffer_len);

  memcpy(znode->blob+sizeof(uint32_t), compress_buffer, cbuf_len);
  int64_t offset = _zdxdb->write_znode(znode);
  if(offset<=0) {
    free(compress_buffer);
    fprintf(stderr, "zdxstream error writing sources\n");
    return false;
  }
  
  if(!_zdxdb->write_subsystem_offset(1, offset)) {
    free(compress_buffer);
    fprintf(stderr, "zdxstream error writing sources\n");
    return false;
  }
  
  free(compress_buffer);


  //uncompressed version
  /*
  zdxnode* znode = _zdxdb->allocate_znode(xml_buffer.size());
  memcpy(znode->blob, xml_buffer.c_str(), xml_buffer.size());
  fprintf(stderr, "blob start[%s]\n", znode->blob);
  if(!_zdxdb->write_znode(znode)) {
    fprintf(stderr, "zdxstream error writing sources\n");
    return false;
  }
  
  if(!_zdxdb->write_subsystem_offset(1, znode->offset)) {
    fprintf(stderr, "zdxstream error writing sources\n");
    return false;
  }
  fprintf(stderr, "znode offset %lld\n", znode->offset);
  fprintf(stderr, "blob_size %ld\n", znode->blob_size);
  */

  free(znode);
  return true;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// building chromosomes and segments
//////////////////////////////////////////////////////////////////////////////////////////////////


int64_t  EEDB::ZDX::ZDXstream::create_chrom(EEDB::Chrom* chrom) {
  EEDB::ZDX::ZDXsegment *segment = new EEDB::ZDX::ZDXsegment(_zdxdb);
  int64_t rtn = segment->create_chrom(chrom);
  segment->release();
  return rtn;
}


EEDB::Chrom*  EEDB::ZDX::ZDXstream::fetch_chrom(string asm_name, string chrom_name) {
  return EEDB::ZDX::ZDXsegment::fetch_chrom(_zdxdb, asm_name, chrom_name);
}


EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXstream::claim_build_segment(EEDB::Chrom* chrom, long chrom_position) {
  EEDB::ZDX::ZDXsegment *segment = EEDB::ZDX::ZDXsegment::new_at_position(_zdxdb, chrom, chrom_position);
  if(!segment) { return NULL; }
  
  if(!segment->claim_segment()) {
    segment->release();
    return NULL;
  }

  return segment;
}


bool  EEDB::ZDX::ZDXstream::is_built(string assembly_name, string chrom_name, long start, long end) {
  EEDB::ZDX::ZDXsegment *zseg, *t_zseg;

  if(start < 1) { start = 1; }
  
  zseg = EEDB::ZDX::ZDXsegment::fetch(_zdxdb, assembly_name, chrom_name, 1); //start of chrom
  if(!zseg) { 
    //fprintf(stderr, "ZDXstream::is_built [%s] problem first segment\n", _zdxdb->path().c_str());
    return false; 
  }

  while(zseg) {
    if((end>0) and (zseg->chrom_start() >end)) { 
      zseg->release();
      zseg = NULL;
      break;
    }

    if(zseg->chrom_end() >= start) {
      if(!zseg->is_built()) {              
        //fprintf(stderr, "%s not built\n", zseg->xml().c_str());
        zseg->release();
        return false;
      }
    }
    
    t_zseg = zseg->next_segment();
    zseg->release();
    zseg = t_zseg;
  }
  return true;  
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// disconnection methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::ZDX::ZDXstream::_disconnect() {
  if(_zdxdb != NULL) { _zdxdb->disconnect(); }
  _disconnect_count++;
  _reset_stream_node();
}


void EEDB::ZDX::ZDXstream::_stream_clear() {
  _reset_stream_node();
}


void EEDB::ZDX::ZDXstream::_reset_stream_node() {
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  if(_zsegment != NULL) { _zsegment->release(); }
  _zsegment = NULL;
    
  _region_start  = -1;
  _region_end    = -1;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// connection and initialization methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::ZDX::ZDXstream::_init_from_url(string url) {
  //if(!EEDB::SPStreams::ZenDB::_init_from_url(url)) { return false; }
  return true;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  source streaming callback section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::ZDX::ZDXstream::_reload_stream_data_sources() {
  if(_sources_cache_loaded) { return; }
  if(!_zdxdb) { return; }
  //fprintf(stderr, "_reload_stream_data_sources\n");

  long long sources_offset = _zdxdb->subsystem_offset(1);  //sources in subsystem1
  //fprintf(stderr, "source offset %lld\n", sources_offset);
  if(sources_offset==0) { return; }
  
  zdxnode *znode = _zdxdb->fetch_znode(sources_offset);
  if(!znode) { return; }
  //fprintf(stderr, "blob_size %d\n", znode->blob_size);
  //fprintf(stderr, "blob [%s]\n", znode->blob);
  //return;
  
  //first uncompress data
  uint32_t uncompress_buffer_len;
  memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
  //fprintf(stderr, "uncompress_buffer_len %d\n", uncompress_buffer_len);
  
  char* znode_text = (char*)malloc(uncompress_buffer_len+1);
  bzero(znode_text,uncompress_buffer_len+1);
  uLongf buflen = uncompress_buffer_len;
  
  if(uncompress((Bytef*)znode_text, 
                &buflen, 
                (Bytef*)(znode->blob+sizeof(uint32_t)), 
                znode->blob_size-sizeof(uint32_t)) != Z_OK) {
    fprintf(stderr, "zdxstream error uncompressing sources\n");
    return;
  }
  //fprintf(stderr, "uncompressed source xml string %ld bytes\n", buflen);
  //fprintf(stderr, "uncompressed source xml string %ld bytes\n", strlen(znode_text));
  //fprintf(stderr, "%s\n", znode_text);
  
  //then parse XML
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(znode_text);
  root_node = doc.first_node();
  if(root_node->name() != string("zdx")) { return; }
  
  //registry_peer (self_peer)
  if((node = root_node->first_node("registry_peer")) != NULL) { 
    rapidxml::xml_node<> *node2 = node->first_node("peer");
    EEDB::Peer *peer = EEDB::Peer::new_from_xml(node2);
    if(peer) { _self_peer = peer; }
  }  
  
  // peers
  if((node = root_node->first_node("peer")) != NULL) { 
    while(node) {
      EEDB::Peer *peer = EEDB::Peer::new_from_xml(node);
      if(peer) { _peers_cache[peer->uuid()] = peer; }
      node = node->next_sibling("peer");
    }    
  }  

  // experiments
  if((node = root_node->first_node("experiment")) != NULL) { 
    while(node) {
      EEDB::Experiment *source = new EEDB::Experiment(node, true);
      _add_datasource(source);
      EEDB::DataSource::add_to_sources_cache(source);
      source->release();
      node = node->next_sibling("experiment");
    }    
  }  

  // featuresource
  if((node = root_node->first_node("featuresource")) != NULL) { 
    while(node) {
      EEDB::FeatureSource *source = new EEDB::FeatureSource(node);
      _add_datasource(source);
      EEDB::DataSource::add_to_sources_cache(source);
      source->release();
      node = node->next_sibling("featuresource");
    }    
  }  

  // edgesource
  if((node = root_node->first_node("edgesource")) != NULL) { 
    while(node) {
      //EEDB::EdgeSource *source = new EEDB::EdgeSource(node);
      //_add_datasource(source);
      //EEDB::DataSource::add_to_sources_cache(source);
      //source->release();
      node = node->next_sibling("edgesource");
    }    
  }  
  
  // loaded genomes : ChromChunks with sequence
  long asmb_idx=1;
  long chrom_idx=1;
  if((node = root_node->first_node("assembly")) != NULL) {
    while(node) {
      EEDB::Assembly *assembly = new EEDB::Assembly(node);
      if(!assembly) { continue; }
      if(!assembly->sequence_loaded()) { continue; }
      if(_self_peer && (assembly->primary_id() == -1)) {
        assembly->peer_uuid(_self_peer->uuid());
        assembly->primary_id(asmb_idx++);
      }
      _assembly_cache.push_back(assembly);
      _add_datasource(assembly);
      _assembly_loaded = true;
      
      //load the chroms into the Assembly
      vector<EEDB::Chrom*> chroms;
      chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(_zdxdb);
      vector<EEDB::Chrom*>::iterator chr_it;
      for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
        EEDB::Chrom *chrom = (*chr_it);
        if(chrom->assembly_name() == assembly->assembly_name()) {
          chrom->zdxstream(this);
          chrom->assembly(assembly);
          if(_self_peer && (chrom->primary_id() == -1)) {
            chrom->peer_uuid(_self_peer->uuid());
            chrom->primary_id(chrom_idx++);
          }
          assembly->add_chrom(chrom);
        }
      }

      node = node->next_sibling("assembly");
    }
  }
  free(znode_text);

  _sources_cache_loaded=true;
}


void EEDB::ZDX::ZDXstream::_stream_data_sources(string classname, string filter_logic) {
  if(!_source_is_active) { return; }

  // first check if we need to reload
  _reload_stream_data_sources();

  //then call the superclass method
  EEDB::SPStreams::SourceStream::_stream_data_sources(classname, filter_logic);
}


void  EEDB::ZDX::ZDXstream::_stream_peers() {
  if(!_source_is_active) { return; }
  _reload_stream_data_sources();

  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  source_stream(streambuffer);
  
  if(_self_peer) {
    _self_peer->retain();
    streambuffer->add_object(_self_peer);
  }

  map<string, EEDB::Peer*>::iterator it;
  for(it = _peers_cache.begin(); it != _peers_cache.end(); it++) {
    EEDB::Peer* peer = (*it).second;
    peer->retain();
    streambuffer->add_object(peer);
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  source streaming callback section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


bool  EEDB::ZDX::ZDXstream::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  if(!_zdxdb) { return false; }

  //fprintf(stderr, "ZDXstream::_stream_by_named_region [%s] %s %s %ld %ld\n",
  //       _zdxdb->path().c_str(), assembly_name.c_str(),  chrom_name.c_str(), start, end);

  //start at beginning of chrom and find first segment which overlaps start..end
  //also performs the is_built testing

  _reload_stream_data_sources();  //added this 10.1.2014, not sure what bug this was for, hope it doesn't cause problems
  
  if(start < 1) { start = 1; }
  _zsegment = EEDB::ZDX::ZDXsegment::fetch(_zdxdb, assembly_name, chrom_name, 1);
  if(!_zsegment) { return true; } //not error, just means no data
  
  while(_zsegment) {
    //fprintf(stderr, "%s\n",_zsegment->xml().c_str());
    if((end>0) and (_zsegment->chrom_start() >end)) {
      _zsegment->release();
      _zsegment = NULL;
      return true;
    }
    
    if(_zsegment->chrom_end() >= start) {
      if(!_zsegment->is_built()) {
        _zsegment->release();
        _zsegment = NULL;
        return true;
      } else {
        //found first segment
        break;
      }
    }
    
    EEDB::ZDX::ZDXsegment *t_zseg = _zsegment->next_segment();
    _zsegment->release();
    _zsegment = t_zseg;
  }    
  if(!_zsegment) { 
    return true;
  }

  _region_start = start;
  _region_end   = end;

  return _zsegment->stream_region(start, end);  //preps first segment for feature streaming;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  other streaming callback methods 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::ZDX::ZDXstream::_stream_chromosomes(string assembly_name, string chrom_name) {
  //only used when a new genome with sequence is loaded
  _reload_stream_data_sources();
  if(!_assembly_loaded) { return; }
  
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  source_stream(streambuffer);
  
  //do case-insensitive match
  boost::algorithm::to_lower(assembly_name);
  
  for(unsigned int i=0; i<_assembly_cache.size(); i++) {
    EEDB::Assembly *assembly = (EEDB::Assembly*)_assembly_cache[i];
    if(!assembly_name.empty() and
       (boost::algorithm::to_lower_copy(assembly->assembly_name()) != assembly_name) and
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


MQDB::DBObject*    EEDB::ZDX::ZDXstream::_fetch_object_by_id(string dbid) {
  if(self_peer() == NULL) { return NULL; }
  
  string uuid;
  string objClass="Feature";
  long int objID = -1;
  
  unparse_eedb_id(dbid, uuid, objID, objClass);
  
  if(uuid.empty()) { return NULL; }
  if(uuid != string(_self_peer->uuid())) { return NULL; }
  
  if(objClass == "Feature") { 
    _reload_stream_data_sources();
    return fetch_feature_by_id(objID); 
  }
  else { 
    // first check if we need to reload sources
    _reload_stream_data_sources(); 
    return _sources_cache[dbid]; 
  }
  return NULL;
}


void  EEDB::ZDX::ZDXstream::_stream_features_by_metadata_search(string filter_logic) {
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  source_stream(streambuffer);
  
  fetch_filter_search_features(filter_logic, streambuffer);
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////


MQDB::DBObject*    EEDB::ZDX::ZDXstream::_next_in_stream() {
  //_source_stream is a StreamBuffer for sources,chroms,peers....
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
  
  //streaming features via region query
  EEDB::ZDX::ZDXsegment *t_zseg;
  while(_zsegment != NULL) {
    while(MQDB::DBObject *obj = _zsegment->next_in_stream()) {
      //if(obj->classname() == EEDB::ChromChunk::class_name) {  continue; }
      if(obj->classname() == EEDB::Feature::class_name) {
        EEDB::Feature *feature = (EEDB::Feature*)obj;
        if(_stream_is_datasource_filtered) {
          if(!_filter_source_ids[feature->feature_source()->db_id()]) {
            feature->release();
            continue;
          }
        }
      }
      return obj;
    }
    
    //this segment is finished, go grab next segment in the region query
    t_zseg = _zsegment->next_segment();
    _zsegment->release();
    _zsegment = t_zseg;
    while(_zsegment) {    
      if(_region_end>0 && (_zsegment->chrom_start() > _region_end)) {
        _zsegment->release();
        _zsegment = NULL;
        return NULL;
      }
      if(_zsegment->chrom_end() >= _region_start) {
        break;
      }
      t_zseg = _zsegment->next_segment();
      _zsegment->release();
      _zsegment = t_zseg;
    }
    if(!_zsegment) { return NULL; }
    _zsegment->stream_region(_region_start, _region_end);  //preps segment for feature streaming;
  }
  
  return NULL;
}


//**************************************************************************************
//
// Object direct access indexing
//
//**************************************************************************************

/*
typedef struct {
  int64_t    next_object_idx_table;  //offset to next object_idx in chain.
  int64_t    start_idx;
  int64_t    idx_znode[16*1024];    //array of idx-offset-number to znode pointers
} zdx_object_idx_table;
*/

bool  EEDB::ZDX::ZDXstream::fetch_idx_table(int64_t idx_id, zdx_object_idx_table &idxtable, bool create) {
  if(!_zdxdb) { return false; }
  
  int  zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }

  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
    
  
  int64_t initial_offset = _zdxdb->subsystem_offset(3);  //object_idx are subsystem 3
  int64_t offset = initial_offset;

  int64_t next_start_idx = 1;
  int64_t prev_idxtable_offset = 0;
  
  while(1) {
    if(offset == 0) {
      if(!create) { return false; }
      bzero(&idxtable, sizeof(zdx_object_idx_table));
      idxtable.start_idx = next_start_idx;
      
      // write out idx_table 
      zdxfd = _zdxdb->connect(ZDXWRITE);      
      //lock
      fl.l_type = F_WRLCK;
      fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
      
      offset = lseek(zdxfd, 0, SEEK_END);
      idxtable.offset = offset;
      if(write(zdxfd, &idxtable, sizeof(zdx_object_idx_table)) != sizeof(zdx_object_idx_table)) {
        fl.l_type   = F_UNLCK;         // set unlock
        fcntl(zdxfd, F_SETLK, &fl);
        
        fprintf(stderr, "zdx error writing idx_table\n");
        return false;
      }
      //fprintf(stderr, "create idx_table [%lld .. %lld] at offset %lld\n", next_start_idx, ((next_start_idx-1)+(16*1024)), offset);

      if(prev_idxtable_offset>0) {
        lseek(zdxfd, prev_idxtable_offset, SEEK_SET);
        if(write(zdxfd, &offset, sizeof(int64_t)) != sizeof(int64_t)) {
          fl.l_type   = F_UNLCK;         // set unlock
          fcntl(zdxfd, F_SETLK, &fl);
          fprintf(stderr, "zdx error writing idx_table next offset\n");
          return false;
        }
      }
      
      //unlock
      fl.l_type   = F_UNLCK;
      fcntl(zdxfd, F_SETLK, &fl);  //set unlock
      
      if(initial_offset==0) {
        initial_offset = offset;
        if(!_zdxdb->write_subsystem_offset(3, offset)) {
          fprintf(stderr, "zdx error writing subsys offset for idx_table\n");
          return false;
        }
      }
    }
    next_start_idx += 16*1024;
    
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &idxtable, sizeof(EEDB::ZDX::zdx_object_idx_table)) != sizeof(EEDB::ZDX::zdx_object_idx_table)) { 
      _zdxdb->disconnect();
      return false;
    }
    if((idxtable.start_idx <= idx_id) && (idxtable.start_idx -1 + 16*1024 >= idx_id)) {
      //fprintf(stderr, "found id=%lld idx_table [%lld .. %lld] at offset %lld\n", 
      //        idx_id, idxtable.start_idx, ((idxtable.start_idx-1)+(16*1024)), idxtable.offset);
      return true;
    }

    //move to next idx_table;
    prev_idxtable_offset = offset;
    offset = idxtable.next_object_idx_table;
  }
  
  return false;
}


bool  EEDB::ZDX::ZDXstream::rewrite_idx_table(zdx_object_idx_table &idxtable) {
  //using table from previous fetch_idx_table
  if(!_zdxdb) { return false; }
  if(idxtable.offset <=0) { return false; }
  
  int  zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  struct flock fl;
  fl.l_type   = F_WRLCK;  // F_RDLCK, F_WRLCK, F_UNLCK
  fl.l_whence = SEEK_SET; // SEEK_SET, SEEK_CUR, SEEK_END
  fl.l_start  = 0;        // Offset from l_whence
  fl.l_len    = 0;        // length, 0 = to EOF
  fl.l_pid    = getpid(); // our PID
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
    
  lseek(zdxfd, idxtable.offset, SEEK_SET);
  if(write(zdxfd, &idxtable, sizeof(zdx_object_idx_table)) != sizeof(zdx_object_idx_table)) {
    fl.l_type   = F_UNLCK;         // set unlock
    fcntl(zdxfd, F_SETLK, &fl);
    
    fprintf(stderr, "zdx error writing idx_table\n");
    return false;
  }
  
  //unlock
  fl.l_type   = F_UNLCK;
  fcntl(zdxfd, F_SETLK, &fl);  //set unlock
  
  return true;
}


EEDB::Feature*  EEDB::ZDX::ZDXstream::fetch_feature_by_id(int64_t idx_id) {
  if(!_zdxdb) { return NULL; }
  
  const char* zdx_uuid = self_peer()->uuid();

  EEDB::ZDX::zdx_object_idx_table  idxtable;
  
  if(!fetch_idx_table(idx_id, idxtable, false)) {
    fprintf(stderr, "zdx unable to fetch obj_idx table\n");
    return NULL;
  }
  
  //fprintf(stderr, "found id=%lld idx_table [%lld .. %lld] at offset %lld\n", 
  //        idx_id, idxtable.start_idx, ((idxtable.start_idx-1)+(16*1024)), idxtable.offset);

  //get znode_offset from idx table, load znode, then find feature

  //add objID and znode_offset to idxtable
  long idx_off = idx_id - idxtable.start_idx;
  if(idx_off<0 || idx_off>=16*1024) {
    fprintf(stderr, "zdx error getting proper obj_idx offset\n");
    return NULL;
  }
  int64_t znode_offset = idxtable.idx_znode[idx_off];
  //fprintf(stderr, "idx_off %ld  znode_offset=%lld\n", idx_off, znode_offset);
  if(znode_offset<=100) { return NULL; }
  
  zdxnode *znode = _zdxdb->fetch_znode(znode_offset);
  if(!znode) { 
    fprintf(stderr, "zdx error reading znode [%ld]\n", znode_offset);
    return NULL; 
  }
  
  //get uncompress_buffer_len
  uint32_t uncompress_buffer_len;
  memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
  
  char*  uncompress_buffer = (char*)malloc(uncompress_buffer_len+64);
  bzero(uncompress_buffer, uncompress_buffer_len+64);
  
  // LZ4 uncompress
  int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), uncompress_buffer, uncompress_buffer_len);
  free(znode);
  if(sinkint < 0) { 
    fprintf(stderr, "zdxstream error uncompressing segment znode\n");
    free(uncompress_buffer);
    return NULL;    
  }
  //fprintf(stderr, "\n=====\n%s\n======\n", uncompress_buffer);
  
  //then parse XML
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  rapidxml::xml_attribute<> *attr;
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(uncompress_buffer);
  root_node = doc.first_node();
  if(!root_node || (root_node->name() != string("zdx"))) { 
    fprintf(stderr, "zdxsegment failed to parse xml\n");
    free(uncompress_buffer);
    return NULL; 
  }
  
  // feature
  if((node = root_node->first_node("feature")) != NULL) { 
    while(node) {
      EEDB::Feature *feature = EEDB::Feature::realloc();
      if(feature->init_from_xml(node)) {
        string uuid;
        string objClass="Feature";
        long int objID = -1;                  
        unparse_dbid(feature->db_id(), uuid, objID, objClass);
        
        if((uuid == zdx_uuid) && (objID == idx_id)) {
          //set the chrom
          string asm_name, chrom_name;
          if((attr = node->first_attribute("chr")))  { chrom_name = attr->value(); }
          if((attr = node->first_attribute("asm")))  { asm_name = attr->value(); }
          EEDB::Chrom* chrom = fetch_chrom(asm_name, chrom_name);
          if(chrom) { feature->chrom(chrom); }

          feature->peer_uuid(zdx_uuid); //set the feature peer_uuid
          feature->primary_id(objID); //reset the objID since the peer_uuid will clear the dbid

          free(uncompress_buffer);
          return feature;
        }
      }
      feature->release(); 
      node = node->next_sibling("feature");
    }    
  }
  free(uncompress_buffer);
  return NULL;
}


bool  EEDB::ZDX::ZDXstream::rebuild_feature_index() {
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL); //reset timer
  
  if(!_zdxdb) { return false; }  
  string zdx_uuid = self_peer()->uuid();
    
  //cache the sources
  stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
  }
  
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }
  
  fprintf(stderr,"\n==== zdxstream rebuild_feature_index\n");
  
  //read all the chrom_tables and segments and znodes and features
  long             total_count=0;
  map<string,long> category_count;
  static char*  compress_buffer=NULL;
  static long   compress_buflen=0;
  
  EEDB::ZDX::zdx_object_idx_table  idxtable;
  if(!fetch_idx_table(1, idxtable, true)) {
    fprintf(stderr, "zdx can not get index table\n");
    return false;
  }
  
  int64_t c_offset = _zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  EEDB::ZDX::zdx_chrom_table  ctable;
  while(1) {
    if(c_offset == 0) { break; }
    lseek(zdxfd, c_offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      _zdxdb->disconnect();
      break; //done with chroms
    }
    
    for(int c_idx=0; c_idx<32; c_idx++) {
      EEDB::ZDX::zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      EEDB::ZDX::zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(EEDB::ZDX::zdx_chrom_segment)*num_segs) != (unsigned)sizeof(EEDB::ZDX::zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdx error reading chrom segment\n");
        break;
      }
      fprintf(stderr, "  chrom:%s  numsegs:%ld\n", zchrom->name, num_segs);
      
      for(long seg=0; seg<num_segs; seg++) {
        if(segments[seg].znode > 100) { 
          int64_t znode_offset = segments[seg].znode;
          
          while(znode_offset>0) {
            
            zdxnode *znode = _zdxdb->fetch_znode(znode_offset);
            if(!znode) { 
              fprintf(stderr, "zdx error reading znode\n");
              break; 
            }
            
            //get uncompress_buffer_len
            uint32_t uncompress_buffer_len;
            memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
            
            if(compress_buffer == NULL) {
              compress_buflen = 10240; //10kb;
              compress_buffer = (char*)malloc(compress_buflen);
            }
            if(uncompress_buffer_len+1 > compress_buflen) {
              compress_buflen = ((uncompress_buffer_len+1)/10240 + 1) * 10240; //multiples of 10kb;
              compress_buffer = (char*)realloc(compress_buffer, compress_buflen);
            }
            bzero(compress_buffer, compress_buflen);
            
            // LZ4 uncompress
            int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), compress_buffer, uncompress_buffer_len);
            if(sinkint < 0) { 
              fprintf(stderr, "zdxstream error uncompressing segment znode\n");
              return false;    
            }  
            
            //then parse XML
            rapidxml::xml_document<>  doc;
            rapidxml::xml_node<>      *node, *root_node;
            doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(compress_buffer);
            root_node = doc.first_node();
            if(!root_node || (root_node->name() != string("zdx"))) { 
              fprintf(stderr, "zdxsegment failed to parse xml\n");
              return false; 
            }
            
            // feature
            if((node = root_node->first_node("feature")) != NULL) { 
              while(node) {
                EEDB::Feature *feature = EEDB::Feature::realloc();
                if(feature->init_from_xml(node)) {
                  string uuid;
                  string objClass="Feature";
                  long int objID = -1;                  
                  unparse_dbid(feature->db_id(), uuid, objID, objClass);
                  
                  if((uuid == zdx_uuid) && (objID>=1)) { 
                    total_count++;
                    if(feature->feature_source()) { 
                      string category = feature->feature_source()->category();
                      category_count[category]++;
                    }
                    
                    if((idxtable.start_idx > objID) || (idxtable.start_idx -1 + 16*1024 < objID)) {
                      //write old idxtable
                      if(!rewrite_idx_table(idxtable)) {
                        fprintf(stderr, "zdx can write index table\n");
                        return false;
                      }
                      
                      //get appropriate idxtable
                      if(!fetch_idx_table(objID, idxtable, true)) {
                        fprintf(stderr, "zdx can not get index table\n");
                        return false;
                      }                      
                    }
                    
                    //add objID and znode_offset to idxtable
                    long idx_off = objID - idxtable.start_idx;
                    idxtable.idx_znode[idx_off] = znode_offset;
                  }
                }
                feature->release(); 
                node = node->next_sibling("feature");
              }    
            }    
            
            //move to next znode in segment
            znode_offset = znode->next_znode;
            free(znode);
          }            
        }
      }
    }
    c_offset = ctable.next_chrom_table;
  }
  
  //finish
  if(!rewrite_idx_table(idxtable)) {
    fprintf(stderr, "zdx can not write index table\n");
  }
  
  if(compress_buffer) { free(compress_buffer); }
  
  map<string,long>::iterator it1;
  for(it1=category_count.begin(); it1!=category_count.end(); it1++) {
    fprintf(stderr, "  %s :: %ld\n", it1->first.c_str(), (*it1).second);
  } 
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "zdx indexed %ld features in %1.6f sec \n", total_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  
  return true;
}

//**************************************************************************************
//
// feture name indexing and searching
//
//**************************************************************************************

bool  EEDB::ZDX::ZDXstream::fetch_filter_search_features(string filter_logic, EEDB::SPStreams::StreamBuffer *streambuffer) {
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL); //reset timer
  
  //fprintf(stderr,"==== zdxstream fetch_filter_search_features [%s]\n", filter_logic.c_str());
  //While SourceStream allows for "empty filter == stream all", for zdx I will return nothing/fail
  if(filter_logic.empty()) { return false; }

  if(!_zdxdb) { return false; }  
  string zdx_uuid = self_peer()->uuid();
    
  long          total_count=0;
  long          match_count=0;
  static char*  compress_buffer=NULL;
  static long   compress_buflen=0;
  
  // extract all possible keywords
  vector<string>  keywords;
  char *tok;
  char *buffer = (char*)malloc(filter_logic.size()+3);
  strcpy(buffer, filter_logic.c_str());
  tok =strtok(buffer, " \t()");
  while(tok!=NULL) {
    bool ok=true;
    if(tok[0] == '!') { ok = false; }
    if(strcmp(tok, "and")==0) { ok = false; }
    if(strcmp(tok, "or")==0) { ok = false; }
    if(strlen(tok) < 3) { ok = false; }
    if(ok) { keywords.push_back(tok); }
    tok =strtok(NULL, " \t()");
  }
  free(buffer);

  //convert keywords to all possible mdkeys for loading
  map<string,bool>  mdkeys;
  vector<string>::iterator  it_key;
  for(it_key=keywords.begin(); it_key!=keywords.end(); it_key++) {
    EEDB::Metadata *md1 = new EEDB::Metadata("keyword", (*it_key));
    md1->extract_mdkeys(mdkeys);
    md1->release();
  }
  if(!_load_name_indexes(mdkeys)) { return false; }

  //reprocess keywords into critical set of znode_offsets
  vector<int64_t>  critical_znodes;
  bool             first_mdkey=true;

  for(it_key=keywords.begin(); it_key!=keywords.end(); it_key++) {
    fprintf(stderr, "keyword [%s]\n", (*it_key).c_str());
    EEDB::Metadata *md1 = new EEDB::Metadata("keyword", (*it_key));
    mdkeys.clear();
    md1->extract_mdkeys(mdkeys);
    md1->release();

    //find best mdkey in this keyword with the most discrimination (least num znodes)
    map<string, bool>::iterator it1;
    for(it1=mdkeys.begin(); it1!=mdkeys.end(); it1++) {
      if(_mdkey_znodes[(*it1).first].empty()) { continue; }
      if((*it1).first[2] == ' ') { continue; }
      fprintf(stderr, "  mdkey [%s] %ld znodes\n", (*it1).first.c_str(), _mdkey_znodes[(*it1).first].size());

      vector<int64_t> znode_array = _mdkey_znodes[(*it1).first];
      sort(znode_array.begin(), znode_array.end());

      if(first_mdkey) {
        //fprintf(stderr, "    critical_znodes.empty, so fill with these %ld znodes\n", znode_array.size());
        vector<int64_t>::iterator it2     = znode_array.begin();
        vector<int64_t>::iterator it2_end = znode_array.end();
        while(it2!=it2_end) { critical_znodes.push_back(*it2); it2++; }
        first_mdkey = false;
      } else {
        //fprintf(stderr, "    overlap %ld znodes -- %ld critical\n", znode_array.size(), critical_znodes.size());
        vector<int64_t> intersection_array;
        unsigned i = 0, j = 0;
        while((i < znode_array.size()) && (j < critical_znodes.size())) {
          if (znode_array[i] < critical_znodes[j]) { i++; }
          else if (znode_array[i] > critical_znodes[j]) { j++; }
          else {
	    intersection_array.push_back(znode_array[i]);
            i++;
	    j++;
          }
        }
        critical_znodes = intersection_array;
      }
      fprintf(stderr, "    critical znodes %ld\n", critical_znodes.size());
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "fetch_filter_search_features have %ld potential znodes in %1.6f msec \n", critical_znodes.size(),  (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //cache the sources so features load properly
  _reload_stream_data_sources();

  //
  // process the potential znodes doing full check_by_filter_logic  
  //
  //fprintf(stderr, "%ld znodes to check\n", critical_znodes.size());
  vector<int64_t>::iterator itz;
  for(itz = critical_znodes.begin(); itz != critical_znodes.end(); itz++) {
    int64_t znode_offset = (*itz);
    zdxnode *znode = _zdxdb->fetch_znode(znode_offset);
    if(!znode) { 
      fprintf(stderr, "zdx error reading znode\n");
      break; 
    }
    
    //get uncompress_buffer_len
    uint32_t uncompress_buffer_len;
    memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
    
    if(compress_buffer == NULL) {
      compress_buflen = 10240; //10kb;
      compress_buffer = (char*)malloc(compress_buflen);
    }
    if(uncompress_buffer_len+1 > compress_buflen) {
      compress_buflen = ((uncompress_buffer_len+1)/10240 + 1) * 10240; //multiples of 10kb;
      compress_buffer = (char*)realloc(compress_buffer, compress_buflen);
    }
    bzero(compress_buffer, compress_buflen);
    
    // LZ4 uncompress
    int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), compress_buffer, uncompress_buffer_len);
    if(sinkint < 0) { 
      fprintf(stderr, "zdxstream error uncompressing segment znode\n");
      return false;    
    }  
    
    //then parse XML
    rapidxml::xml_document<>  doc;
    rapidxml::xml_node<>      *node, *root_node;
    rapidxml::xml_attribute<> *attr;
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(compress_buffer);
    root_node = doc.first_node();
    if(!root_node || (root_node->name() != string("zdx"))) { 
      fprintf(stderr, "zdxsegment failed to parse xml\n");
      return false; 
    }
    
    // feature
    if((node = root_node->first_node("feature")) != NULL) { 
      while(node) {
        bool match = false;
        EEDB::Feature *feature = EEDB::Feature::realloc();
        if(feature->init_from_xml(node)) {

          //set the chrom
          string asm_name, chrom_name;
          if((attr = node->first_attribute("chr")))  { chrom_name = attr->value(); }
          if((attr = node->first_attribute("asm")))  { asm_name = attr->value(); }
          EEDB::Chrom* chrom = fetch_chrom(asm_name, chrom_name);
          if(chrom) { feature->chrom(chrom); }
          
          // might not need to do the uuid check
          string uuid;
          string objClass="Feature";
          long int objID = -1;                  
          unparse_dbid(feature->db_id(), uuid, objID, objClass);
          
          if((uuid == zdx_uuid) && (objID>=1)) { 
            total_count++;
            
            //filter logic
            EEDB::MetadataSet *mdset = feature->metadataset();
            if(mdset) {
              if(mdset->check_by_filter_logic(filter_logic)) {
                match=true;
              }
            }
            
            if(_stream_is_datasource_filtered) {
              if(!_filter_source_ids[feature->feature_source()->db_id()]) { match=false; }
            }            
            
          }
          
          if(match) {
            feature->retain();
            streambuffer->add_object(feature);
            //fprintf(stderr, "match [%s]-%ld --  %s\n", self_peer()->uuid(), znode_offset, feature->simple_xml().c_str());
            match_count++;            
          }
        }
        feature->release(); 
        node = node->next_sibling("feature");
      }    
    }    
    
    //move to next znode in segment
    znode_offset = znode->next_znode;
    free(znode);
  }
  if(compress_buffer) { free(compress_buffer); }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "zdx name search [%s] -- %ld znodes, read %ld features (found %ld) in %1.6f msec \n", 
          filter_logic.c_str(), critical_znodes.size(), total_count, match_count, 
          (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  return true;
}


bool  EEDB::ZDX::ZDXstream::build_feature_name_index() {
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL); //reset timer
  
  if(!_zdxdb) { return false; }  
  string zdx_uuid = self_peer()->uuid();
  
  //cache the sources so features load properly
  _reload_stream_data_sources();
  
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }
  
  fprintf(stderr,"\n==== zdxstream build_feature_name_index\n");
  long   znode_count=0;
  long   last_update=starttime.tv_sec;

  //mdkey-2-znode index subsystem
  //  breakdown and lookup to reduce number of znodes needing to check
  //  but for initial testing and framework lets just read everything
  
  int64_t c_offset = _zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  EEDB::ZDX::zdx_chrom_table  ctable;
  while(1) {
    if(c_offset == 0) { break; }
    lseek(zdxfd, c_offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      _zdxdb->disconnect();
      break; //done with chroms
    }
    
    for(int c_idx=0; c_idx<32; c_idx++) {
      EEDB::ZDX::zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      EEDB::ZDX::zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(EEDB::ZDX::zdx_chrom_segment)*num_segs) != (unsigned)sizeof(EEDB::ZDX::zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdx error reading chrom segment\n");
        break;
      }
      
      for(long seg=0; seg<num_segs; seg++) {
        if(segments[seg].znode > 100) { 
          int64_t znode_offset = segments[seg].znode;
          
          while(znode_offset>0) {
            
            zdxnode *znode = _zdxdb->fetch_znode(znode_offset);
            if(!znode) { 
              fprintf(stderr, "zdx error reading znode\n");
              break; 
            }
            znode_count++;
            
            if(!name_index_znode(znode_offset, znode)) {
              fprintf(stderr, "zdx error getting mdkey from znode\n");
              break; 
            }
            
            //move to next znode in segment
            znode_offset = znode->next_znode;
            free(znode);

            //show progress update every 3 seconds
            gettimeofday(&endtime, NULL);
            if(endtime.tv_sec > last_update + 3) {
              last_update = endtime.tv_sec;
              timersub(&endtime, &starttime, &difftime);
              long mdkey_count = _mdkey_znodes.size();
              double rate = (double)znode_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
              fprintf(stderr, "%10ld znodes [%ld mdkeys] %13.2f obj/sec\n", znode_count, mdkey_count, rate);
            }
            
          }            
        }
      }
    }
    c_offset = ctable.next_chrom_table;
  }
  
  //get some stats 
  long mdkey_count = _mdkey_znodes.size();
  long offset_total=0, offset_min=0, offset_max=0;
  string max_mdkey;
  
  long discrimination_effect=0;
  map<string, vector<int64_t> >::iterator it1;
  for(it1=_mdkey_znodes.begin(); it1!=_mdkey_znodes.end(); it1++) {
    string mdkey_str = (*it1).first;
    long cnt = (*it1).second.size();         
    offset_total += cnt;
    double discrimination = (double)cnt/znode_count;
    if(discrimination > 0.9) {
      //fprintf(stderr, "non-discriminating mdkey [%s] %1.2f\n", mdkey_str.c_str(), discrimination);
      discrimination_effect += cnt;
      (*it1).second.clear();
    }
    if(offset_min==0 || (cnt<offset_min)) { offset_min = cnt; }
    if(cnt>offset_max) { offset_max = cnt; max_mdkey=mdkey_str; }    
  }
  fprintf(stderr, "  %ld total mdkeys\n", mdkey_count);
  fprintf(stderr, "  %ld total offset count\n", offset_total);
  fprintf(stderr, "  %ld min offset count\n", offset_min);
  fprintf(stderr, "  %ld max offset count [%s]\n", offset_max, max_mdkey.c_str());
  fprintf(stderr, "  %1.2f avg offset count\n", (float)offset_total / mdkey_count);

  //write out into ZDX
  write_name_indexes();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "zdx name index %ld znodes [%ld mdkeys] in %1.6f sec \n", 
          znode_count, mdkey_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  return true;
}


bool  EEDB::ZDX::ZDXstream::name_index_znode(int64_t znode_offset, zdxnode* znode) {
  if(znode_offset <= 0) { return false; }
  if(znode_offset <= 100) { return true; }      
  if(!znode) { return false; }
    
  //keyword-2-znode index subsystem
  //  breakdown and lookup to reduce number of znodes needing to check
  //  but for initial testing and framework lets just read everything
  
  //get uncompress_buffer_len
  uint32_t uncompress_buffer_len;
  memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
  
  char*  uncompress_buffer = (char*)malloc(uncompress_buffer_len+64);
  bzero(uncompress_buffer, uncompress_buffer_len+64);
    
  // LZ4 uncompress
  int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), uncompress_buffer, uncompress_buffer_len);
  if(sinkint < 0) { 
    fprintf(stderr, "zdxstream error uncompressing segment znode\n");
    return false;    
  }  
  
  //then parse XML
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(uncompress_buffer);
  root_node = doc.first_node();
  if(!root_node || (root_node->name() != string("zdx"))) { 
    fprintf(stderr, "zdxsegment failed to parse xml\n");
    return false; 
  }
  
  map<string, bool> mdkey_hash;

  // feature
  if((node = root_node->first_node("feature")) != NULL) { 
    while(node) {
      EEDB::Feature *feature = EEDB::Feature::realloc();
      if(feature->init_from_xml(node)) {        
        EEDB::MetadataSet *mdset = feature->metadataset();
        if(mdset) {            
          mdset->extract_mdkeys(mdkey_hash);
        }        
      }
      feature->release(); 
      node = node->next_sibling("feature");
    }    
  }
  
  // experiments
  if((node = root_node->first_node("experiment")) != NULL) { 
    while(node) {
      EEDB::Experiment *source = new EEDB::Experiment(node, true);
      EEDB::MetadataSet *mdset = source->metadataset();
      if(mdset) {            
        mdset->extract_mdkeys(mdkey_hash);
      }        
      source->release();
      node = node->next_sibling("experiment");
    }    
  }  
  
  // featuresource
  if((node = root_node->first_node("featuresource")) != NULL) { 
    while(node) {
      EEDB::FeatureSource *source = new EEDB::FeatureSource(node);
      EEDB::MetadataSet *mdset = source->metadataset();
      if(mdset) {            
        mdset->extract_mdkeys(mdkey_hash);
      }        
      source->release();
      node = node->next_sibling("featuresource");
    }    
  }  
  
  // edgesource
  if((node = root_node->first_node("edgesource")) != NULL) { 
    while(node) {
      //EEDB::EdgeSource *source = new EEDB::EdgeSource(node);
      //EEDB::MetadataSet *mdset = source->metadataset();
      //if(mdset) {            
      //  mdset->extract_mdkeys(mdkey_hash);
      //}        
      //source->release();
      node = node->next_sibling("edgesource");
    }  
  } 
  free(uncompress_buffer);
  
  //convert mdkey_hash into _mdkey_znodes
  map<string, bool>::iterator it1;
  for(it1=mdkey_hash.begin(); it1!=mdkey_hash.end(); it1++) {
    _mdkey_znodes[(*it1).first].push_back(znode_offset);
  }
  
  return true;
}


//==============================================================


bool  EEDB::ZDX::ZDXstream::_load_name_indexes(map<string, bool> &mdkey_hash) {
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL); //reset timer

  if(!_zdxdb) { return false; }
    
  int64_t offset = _zdxdb->subsystem_offset(4);  //name_idx are subsystem 4
  if(offset == 0) { return false; }
  
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }

  while(offset>0) {    
    zdx_name_idx_table name_table;
    bzero(&name_table, sizeof(zdx_name_idx_table));

    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &name_table, sizeof(zdx_name_idx_table)) != sizeof(zdx_name_idx_table)) { 
      fprintf(stderr, "zdxstream error reading name_table\n");
      return false;
    }
    
    //loop and read the znode_array into mdkey_znodes
    for(long j=0; j<8192; j++) {
      zdx_mdkey* mdkey = &(name_table.mdkeys[j]);
      if(mdkey->mdkey[0] == '\0') { break; }
      string mdkey_str = mdkey->mdkey;
      
      //skip over mdkey which is not in the mdkey_hash
      if(!mdkey_hash.empty() && mdkey_hash.find(mdkey_str) == mdkey_hash.end()) { continue; }

      _mdkey_znodes[mdkey_str].clear(); //clear out the old offsets

      if(mdkey->znode_array_offset == 0) { break; }
      if(mdkey->array_size ==0 ) { break; }
      
      //fprintf(stderr, "mdkey [%s] reading offsets\n", mdkey_str.c_str());
      long array_size = sizeof(int64_t)*mdkey->array_size;
      int64_t* offset_array = (int64_t*)malloc(array_size);
      bzero(offset_array, array_size);
      
      lseek(zdxfd, mdkey->znode_array_offset, SEEK_SET);  
      if(read(zdxfd, offset_array, array_size) != array_size) { 
        fprintf(stderr, "zdxstream error reading name_table\n");
        return false;
      }
      
      for(long k=0; k<mdkey->array_size; k++) {
        _mdkey_znodes[mdkey_str].push_back(offset_array[k]);
      }
      free(offset_array);
    }    

    offset = name_table.next_name_idx_table;
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "_load_name_indexes [%s] %ld mdkeys in %1.6f sec \n", self_peer()->uuid(), _mdkey_znodes.size(), (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);

  return true;
}


bool  EEDB::ZDX::ZDXstream::write_name_indexes() {
  if(!_zdxdb) { return false; }
    
  int64_t initial_offset = _zdxdb->subsystem_offset(4);  //name_idx are subsystem 4
  int64_t offset = initial_offset;

  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }

  struct flock fl;
  fl.l_type   = F_WRLCK;  // F_RDLCK, F_WRLCK, F_UNLCK
  fl.l_whence = SEEK_SET; // SEEK_SET, SEEK_CUR, SEEK_END
  fl.l_start  = 0;        // Offset from l_whence
  fl.l_len    = 0;        // length, 0 = to EOF
  fl.l_pid    = getpid(); // our PID
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait

  vector<zdx_name_idx_table*>      name_index_tables;
    
  if(offset == 0) {
    //fprintf(stderr, "create first name_table\n");
    zdx_name_idx_table* name_table = (zdx_name_idx_table*)malloc(sizeof(zdx_name_idx_table));
    bzero(name_table, sizeof(zdx_name_idx_table));
        
    offset = lseek(zdxfd, 0, SEEK_END);
    name_table->offset = offset;
    if(write(zdxfd, name_table, sizeof(zdx_name_idx_table)) != sizeof(zdx_name_idx_table)) {
      fl.l_type   = F_UNLCK;         // tell it to unlock the region
      fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
      fprintf(stderr, "zdxstream error writing name_table\n");
      return false;
    }
    
    //unlock
    fl.l_type   = F_UNLCK;       // tell it to unlock the region
    fcntl(zdxfd, F_SETLK, &fl);  // set the region to unlocked
    
    if(!_zdxdb->write_subsystem_offset(4, offset)) {
      fl.l_type   = F_UNLCK;         // tell it to unlock the region
      fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
      fprintf(stderr, "zdxstream error writing name_table\n");
      return false;
    }
    //re-lock
    fl.l_type = F_WRLCK;
    fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait

    name_index_tables.push_back(name_table);
  }
  else {
    //read in the old zdx_name_idx_tables
    while(offset>0) {    
      zdx_name_idx_table* name_table = (zdx_name_idx_table*)malloc(sizeof(zdx_name_idx_table));
      bzero(name_table, sizeof(zdx_name_idx_table));
      
      lseek(zdxfd, offset, SEEK_SET);  
      if(read(zdxfd, name_table, sizeof(zdx_name_idx_table)) != sizeof(zdx_name_idx_table)) {
        fl.l_type   = F_UNLCK;         // tell it to unlock the region
        fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
        fprintf(stderr, "zdxstream error reading name_table\n");
        return false;
      }
      
      name_index_tables.push_back(name_table);      
      offset = name_table->next_name_idx_table;
    }
  }
    
  //
  // loop on the _mdkey_znodes and rebuild the indexes
  //
  map<string, vector<int64_t> >::iterator it1;
  for(it1=_mdkey_znodes.begin(); it1!=_mdkey_znodes.end(); it1++) {
    if((*it1).second.empty()) { continue; }
    string mdkey_str = (*it1).first;
    zdx_name_idx_table* name_table = NULL;
    zdx_mdkey* mdkey = NULL;

    //find mdkey_str in the name_index_tables
    vector<zdx_name_idx_table*>::iterator ntbl_it = name_index_tables.begin();
    long j=0;
    while(ntbl_it!=name_index_tables.end()) {
      name_table = (*ntbl_it);
      mdkey = &(name_table->mdkeys[j]);
      if(mdkey->mdkey[0] == '\0') {
        //fprintf(stderr, "new mdkey [%s] j=%ld\n", mdkey_str.c_str(), j);
        mdkey->mdkey[0] = mdkey_str[0];
        mdkey->mdkey[1] = mdkey_str[1];
        mdkey->mdkey[2] = mdkey_str[2];
        break;
      }
      if((mdkey->mdkey[0] == mdkey_str[0]) &&
         (mdkey->mdkey[1] == mdkey_str[1]) &&
         (mdkey->mdkey[2] == mdkey_str[2])) {          
        //fprintf(stderr, "found matching mdkey in table\n");
        break;
      }
      j++;
      if(j>=8192) {
        j=0;
        ntbl_it++;
      }
      if(ntbl_it==name_index_tables.end()) {
        //fprintf(stderr, "Create next_name_table\n");
        zdx_name_idx_table* name_table2 = (zdx_name_idx_table*)malloc(sizeof(zdx_name_idx_table));
        bzero(name_table2, sizeof(zdx_name_idx_table));
        
        int64_t next_offset = lseek(zdxfd, 0, SEEK_END);
        name_table2->offset = next_offset;
        name_table->next_name_idx_table = next_offset;
        if(write(zdxfd, name_table2, sizeof(zdx_name_idx_table)) != sizeof(zdx_name_idx_table)) {
          fl.l_type   = F_UNLCK;         // tell it to unlock the region
          fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
          fprintf(stderr, "zdxstream error writing name_table\n");
          return false;
        }
                
        name_index_tables.push_back(name_table2);
        ntbl_it = name_index_tables.begin();
      }
    }
    
    if(mdkey==NULL) {
      fl.l_type   = F_UNLCK;         // tell it to unlock the region
      fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
      fprintf(stderr, "ERROR: did not find/create zdx_name_idx_table mdkey\n");
      continue;
    }

    //write the znode_offset array into the ZDX file    
    mdkey->array_size = (*it1).second.size();
    
    long bufsize = sizeof(int64_t) * mdkey->array_size;
    int64_t* offset_array = (int64_t*)malloc(bufsize);
    bzero(offset_array, bufsize);
    
    vector<int64_t>::iterator it2     = (*it1).second.begin();
    vector<int64_t>::iterator it2_end = (*it1).second.end();
    long k=0;
    while(it2!=it2_end) {
      offset_array[k] = (*it2);
      k++;
      it2++;
    }

    int64_t offset2 = lseek(zdxfd, 0, SEEK_END);
    mdkey->znode_array_offset = offset2;
    if(write(zdxfd, offset_array, bufsize) != bufsize) {
      fl.l_type   = F_UNLCK;         // tell it to unlock the region
      fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
      fprintf(stderr, "zdxstream error writing name_table znode offsets\n");
      return false;
    }

    free(offset_array);
  }
    
  //finally re-write the name_tables  
  vector<zdx_name_idx_table*>::iterator ntbl_it = name_index_tables.begin();
  while(ntbl_it!=name_index_tables.end()) {
    zdx_name_idx_table* name_table = (*ntbl_it);
    lseek(zdxfd, name_table->offset, SEEK_SET);
    if(write(zdxfd, name_table, sizeof(zdx_name_idx_table)) != sizeof(zdx_name_idx_table)) {
      fl.l_type   = F_UNLCK;         // tell it to unlock the region
      fcntl(zdxfd, F_SETLK, &fl);    // set the region to unlocked
      fprintf(stderr, "zdxstream error re-writing name_table\n");
      return false;
    }
    ntbl_it++;
  }
  
  return false;
}

