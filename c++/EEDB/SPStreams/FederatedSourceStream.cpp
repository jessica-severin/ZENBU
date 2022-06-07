/* $Id: FederatedSourceStream.cpp,v 1.92 2020/03/02 08:26:32 severin Exp $ */

/***

NAME - EEDB::SPStreams::FederatedSourceStream

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
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/RemoteServerStream.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::FederatedSourceStream::class_name = "EEDB::SPStreams::FederatedSourceStream";

//call out functions
void _spstream_federatedsourcestream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::FederatedSourceStream*)obj;
}
void _spstream_federatedsourcestream_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::FederatedSourceStream*)obj)->_xml(xml_buffer);
}
void _spstream_federatedsourcestream_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::FederatedSourceStream*)obj)->_xml(xml_buffer);
}

//SPStream functions
MQDB::DBObject* _spstream_federatedsourcestream_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::FederatedSourceStream*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_federatedsourcestream_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::FederatedSourceStream*)node)->_fetch_object_by_id(fid);
}
void _spstream_federatedsourcestream_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FederatedSourceStream*)node)->_stream_peers();
}
bool _spstream_federatedsourcestream_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { return stream->stream_by_named_region(assembly_name, chrom_name, start, end); }
  return false;
}
void _spstream_federatedsourcestream_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { stream->stream_data_sources(classname, filter_logic); }
}
void _spstream_federatedsourcestream_reload_stream_data_sources_func(EEDB::SPStream* node) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { stream->reload_stream_data_sources(); }
}
void _spstream_federatedsourcestream_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { stream->get_dependent_datasource_ids(source_ids); }
}
void _spstream_federatedsourcestream_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { stream->stream_chromosomes(assembly_name, chrom_name); }
}
void _spstream_federatedsourcestream_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { stream->stream_features_by_metadata_search(search_logic); }
}
void _spstream_federatedsourcestream_stream_all_features_func(EEDB::SPStream* node) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { stream->stream_all_features(); }
}
bool _spstream_federatedsourcestream_fetch_features_func(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { return stream->fetch_features(fid_hash); }
  return false;
}
void _spstream_federatedsourcestream_stream_edges_func(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash, string filter_logic) {
  EEDB::SPStream* stream = ((EEDB::SPStreams::FederatedSourceStream*)node)->_build_source_stream();
  if(stream != NULL) { return stream->stream_edges(fid_hash, filter_logic); }
}
void _spstream_federatedsourcestream_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FederatedSourceStream*)node)->_disconnect_stream();
}
void _spstream_federatedsourcestream_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FederatedSourceStream*)node)->_stream_clear();
}
void _spstream_federatedsourcestream_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FederatedSourceStream*)node)->_reset_stream_node();
}



EEDB::SPStreams::FederatedSourceStream::FederatedSourceStream() {
  init();
}

EEDB::SPStreams::FederatedSourceStream::~FederatedSourceStream() {
}


void EEDB::SPStreams::FederatedSourceStream::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::FederatedSourceStream::class_name;
  _module_name               = "FederatedSourceStream";
  _funcptr_delete            = _spstream_federatedsourcestream_delete_func;
  _funcptr_xml               = _spstream_federatedsourcestream_xml_func;
  _funcptr_simple_xml        = _spstream_federatedsourcestream_simple_xml_func;
  
  //function pointer code
  _funcptr_next_in_stream                     = _spstream_federatedsourcestream_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_federatedsourcestream_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_federatedsourcestream_disconnect_func;
  _funcptr_stream_clear                       = _spstream_federatedsourcestream_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_federatedsourcestream_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_federatedsourcestream_stream_features_by_metadata_search_func;
  _funcptr_stream_all_features                = _spstream_federatedsourcestream_stream_all_features_func;
  _funcptr_fetch_features                     = _spstream_federatedsourcestream_fetch_features_func;
  _funcptr_stream_edges                       = _spstream_federatedsourcestream_stream_edges_func;
  _funcptr_stream_data_sources                = _spstream_federatedsourcestream_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_federatedsourcestream_get_dependent_datasource_ids_func;
  _funcptr_reload_stream_data_sources         = _spstream_federatedsourcestream_reload_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_federatedsourcestream_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_federatedsourcestream_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_federatedsourcestream_reset_stream_node_func;


  //attribute variables
  _source_stream                = NULL;
  _allow_full_federation_search = true;
  _clone_peers_on_build         = false;
  _peer_search_depth            = 7;
  _sourcestream_output           = "feature";
  
  /*
  $self->{'_sourcenames'} = {};
  $self->{'_source_keyword_search'} = undef;
  $self->{'_filter_keywords'} = undef;
  */
}

void EEDB::SPStreams::FederatedSourceStream::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::FederatedSourceStream::display_desc() {
  string str = "FederatedSourceStream";
  return str;
}

string EEDB::SPStreams::FederatedSourceStream::display_contents() {
  return display_desc();
}


void EEDB::SPStreams::FederatedSourceStream::_xml(string &xml_buffer) {
  xml_buffer.append("<spstream module=\"");
  xml_buffer.append(_module_name);
  xml_buffer.append("\">");

  //xml_buffer.append("<peer_search_depth>"+l_to_string(_peer_search_depth)+"</peer_search_depth>");
  xml_buffer.append("<source_outmode>"+_sourcestream_output+"</source_outmode>");

  if(_allow_full_federation_search) { xml_buffer.append("<allow_full_federation_search>true</allow_full_federation_search>"); }
  //else { xml_buffer.append("<allow_full_federation_search>false</allow_full_federation_search>"); }

  //if(_clone_peers_on_build) { xml_buffer.append("<clone_peers_on_build>true</clone_peers_on_build>"); }
  //else { xml_buffer.append("<clone_peers_on_build>false</clone_peers_on_build>"); }

  if(!_filter_experiment_searchlogic.empty()) {
    xml_buffer.append("<filter_experiment_searchlogic>"+_filter_experiment_searchlogic+"</filter_experiment_searchlogic>");
  }

  map<string, EEDB::Datatype*>::iterator  it3;
  for(it3 = _expression_datatypes.begin(); it3 != _expression_datatypes.end(); it3++) {
    (*it3).second->xml(xml_buffer);;
  }

  if(!_filter_peer_ids.empty() &&_filter_object_ids.empty() && _filter_source_ids.empty()) {
    xml_buffer.append("<filter_peer_ids>");
    map<string, bool>::iterator it4;
    for(it4 = _filter_peer_ids.begin(); it4 != _filter_peer_ids.end(); it4++) {
      if(it4!=_filter_peer_ids.begin()) { xml_buffer.append(","); }
      xml_buffer.append((*it4).first);
    }
    xml_buffer.append("</filter_peer_ids>");
  }
  if(!_filter_object_ids.empty()) {
    xml_buffer.append("<filter_object_ids>");
    map<string, bool>::iterator it4;
    for(it4 = _filter_object_ids.begin(); it4 != _filter_object_ids.end(); it4++) {
      if(it4!=_filter_object_ids.begin()) { xml_buffer.append(","); }
      xml_buffer.append((*it4).first);
    }
    xml_buffer.append("</filter_object_ids>");
  }
  if(!_filter_source_ids.empty()) {
    xml_buffer.append("<filter_source_ids>");
    map<string, bool>::iterator it4;
    for(it4 = _filter_source_ids.begin(); it4 != _filter_source_ids.end(); it4++) {
      if(it4!=_filter_source_ids.begin()) { xml_buffer.append(","); }
      xml_buffer.append((*it4).first);
    }
    xml_buffer.append("</filter_source_ids>");
  }
  if(!_filter_source_names.empty()) {
    xml_buffer.append("<filter_source_names>");
    map<string, bool>::iterator it4;
    for(it4 = _filter_source_names.begin(); it4 != _filter_source_names.end(); it4++) {
      if(it4!=_filter_source_names.begin()) { xml_buffer.append(","); }
      xml_buffer.append((*it4).first);
    }
    xml_buffer.append("</filter_source_names>");
  }

  xml_buffer.append("</spstream>");
}


EEDB::SPStreams::FederatedSourceStream::FederatedSourceStream(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("source_outmode")) != NULL) {
    set_sourcestream_output(string(node->value()));
  }
  if((node = root_node->first_node("filter_experiment_searchlogic")) != NULL) {
    _filter_experiment_searchlogic = string(node->value());
  }
  _allow_full_federation_search=false;
  if((node = root_node->first_node("allow_full_federation_search")) != NULL) {
    if(string(node->value()) == "true") { _allow_full_federation_search=true; }
  }
  //if((node = root_node->first_node("clone_peers_on_build")) != NULL) {
  //  _clone_peers_on_build=false;
  //  if(string(node->value()) == "true") { _clone_peers_on_build=true; }
  //}

  //datatypes
  if((node = root_node->first_node("datatype")) != NULL) {
    while(node) {
      EEDB::Datatype *dtype = EEDB::Datatype::from_xml(node);
      if(dtype) { add_expression_datatype_filter(dtype); }
      node = node->next_sibling("datatype");
    }
  }
  
  //filter_peer_ids
  if((node = root_node->first_node("filter_peer_ids")) != NULL) {
    char* buf = (char*)malloc(strlen(node->value())+2);
    strcpy(buf, node->value());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) { _filter_peer_ids[p1] = true; }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  //filter_object_ids
  if((node = root_node->first_node("filter_object_ids")) != NULL) {
    char* buf = (char*)malloc(strlen(node->value())+2);
    strcpy(buf, node->value());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        _filter_peer_ids[p1] = true;
        string id = p1;
        size_t p2;
        if((p2 = id.find("::")) != string::npos) {
          string uuid = id.substr(0, p2);
          _filter_peer_ids[uuid] = true;
        }
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  //filter_source_ids
  if((node = root_node->first_node("filter_source_ids")) != NULL) {
    char* buf = (char*)malloc(strlen(node->value())+2);
    strcpy(buf, node->value());
    char *p1 = strtok(buf, ", \t");    
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        _filter_source_ids[p1] = true;
        string id = p1;
        size_t p2;
        if((p2 = id.find("::")) != string::npos) {
          string uuid = id.substr(0, p2);
          _filter_peer_ids[uuid] = true;
        }
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  //filter_source_names
  if((node = root_node->first_node("filter_source_names")) != NULL) {
    char* buf = (char*)malloc(strlen(node->value())+2);
    strcpy(buf, node->value());
    char *p1 = strtok(buf, ",\t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) { _filter_source_names[p1] = true; }
      p1 = strtok(NULL, ",\t");
    }
    free(buf);
  }

  //maybe need some post processing
}


////////////////////////////////////////////////////////////////////////////
//
// configuration methods
//
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::FederatedSourceStream::allow_full_federation_search(bool value) {
  _allow_full_federation_search = value;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}


void  EEDB::SPStreams::FederatedSourceStream::clone_peers_on_build(bool value) {
  _clone_peers_on_build = value;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}

void  EEDB::SPStreams::FederatedSourceStream::set_peer_search_depth(int value) {
  _peer_search_depth = value;
}

/***** add_seed_peers
  Description: adds Peer objects to be used for seeding the federated search.
               Search either uses source_ids or "keywords" to generate list of 
               specific sources to feed data into this SourceStream.
*****/

void  EEDB::SPStreams::FederatedSourceStream::add_seed_peer(EEDB::Peer* peer) {
  if(peer == NULL) { return; }
  _seed_peers.push_back(peer);
  peer->federation_depth(1);
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}

void  EEDB::SPStreams::FederatedSourceStream::clear_seed_peers() {
  _seed_peers.clear();
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}


/***** add_peer_id_filter
  Description: add a list of federated source IDS to be used for configuring
               the source stream with specific Experiment and/or FeatureSource
*****/

void  EEDB::SPStreams::FederatedSourceStream::add_peer_id_filter(string uuid) {
  _filter_peer_ids[uuid] = true;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}


void  EEDB::SPStreams::FederatedSourceStream::clear_source_filters() {
  _filter_source_ids.clear();
  _filter_source_names.clear();
  //does not alter the peer filters
}

/***** add_source_id_filter
  Description: add a list of federated source IDS to be used for configuring
               the source stream with specific Experiment and/or FeatureSource
*****/

void  EEDB::SPStreams::FederatedSourceStream::add_source_id_filter(string id) {
  if(id.empty()) { return; }
  _filter_source_ids[id] = true;
  
  size_t p1;
  if((p1 = id.find("::")) != string::npos) {
    string uuid = id.substr(0, p1);
    _filter_peer_ids[uuid] = true;
  }
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}


void  EEDB::SPStreams::FederatedSourceStream::add_object_id_filter(string id) {
  if(id.empty()) { return; }
  _filter_object_ids[id] = true;
  
  size_t p1;
  if((p1 = id.find("::")) != string::npos) {
    string uuid = id.substr(0, p1);
    _filter_peer_ids[uuid] = true;
  }
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}


/***** add_source_name_filter
  Description: extend the available sources by searching peers
               for sources matching names in this filter
*****/

void  EEDB::SPStreams::FederatedSourceStream::add_source_name_filter(string name) {
  if(name.empty()) { return; }
  _filter_source_names[name] = true;  
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}


/***** set_experiment_searchlogic_filter
  Description: add a keyword filter to further limit the sources
               previously specified by other filters.
*****/

void  EEDB::SPStreams::FederatedSourceStream::set_experiment_searchlogic_filter(string search_logic) {
  _filter_experiment_searchlogic = search_logic;
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }
}



/***** configure_with_source_search
  Description: set/get the keyword search used to dynamically find 
               sources in the federation which are all used for feeding 
               data on this SourceStream. 
               This method is used as replacement for specific configuration
               since it needs to search the entire federation to find all
               possible sources matching keyword pattern and then use
               results to configure the stream for further proccessing.

*****/

void EEDB::SPStreams::FederatedSourceStream::configure_with_source_search(string search_logic) { 
  /*
    if(@_) {
      $self->{'_source_keyword_search'} = shift;
      $self->_configure_from_federation_search;
    }
    return $self->{'_source_keyword_search'};  
  }
  */
}


/*
sub _configure_from_federation_search {
  my $self = shift;

  #clear previous config and rebuild based on keyword searching
  $self->{'_source_stream'} = undef;
  $self->{'_peer_ids'}   = {};
  $self->{'_source_ids'} = {};
  $self->{'_sourcenames'} = {};

  #get all peers in federation now that filters are cleared
  my @peers = @{$self->get_peers};
  #printf("searching %d peers\n", scalar(@peers));

  my %options;
  $options{'filter'} = $self->{'_source_keyword_search'};
  foreach my $peer (@peers) {
    my $stream = $peer->source_stream;
    $stream->stream_data_sources(%options);
    while(my $source = $stream->next_in_stream) {
      #next unless(($source->class eq "Experiment") or ($source->class eq "FeatureSource") or ($source->class eq "EdgeSource"));
      #next unless($source->class eq "Experiment");
      next unless(($source->class eq "Experiment") or ($source->class eq "FeatureSource"));
      #printf("found match : %s", $source->simple_xml);
      $self->{'_source_ids'}->{$source->db_id} = 1;
      $self->{'_peer_ids'}->{$peer->uuid} = 1;
    }
  }
    
  #clear the stream again so it is rebuilt
  $self->{'_source_stream'} = undef;

}
*/


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will do all streaming work
//
////////////////////////////////////////////////////////////////////////////

/***** stream_peers *****/

void EEDB::SPStreams::FederatedSourceStream::_stream_peers() {
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();

  if(_source_stream) { _source_stream->release(); }
  _source_stream = streambuffer;
  
  vector<EEDB::Peer*> peers = _get_peers();
  vector<EEDB::Peer*>::iterator it;
  for(it = peers.begin(); it != peers.end(); it++) {
    (*it)->retain();
    streambuffer->add_object(*it);
  }
}


/***** next_in_stream *****/

MQDB::DBObject* EEDB::SPStreams::FederatedSourceStream::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }
  
  MQDB::DBObject *obj;  
  while((obj = _source_stream->next_in_stream()) != NULL) {
    if(_filter_object_ids.empty()) { return obj; }
    if(_filter_object_ids.find(obj->db_id()) != _filter_object_ids.end()) { return obj; }
    //failed filter check
    obj->release();
  }
  
  //finished. source_stream is always a dynamically created object
  //either a StreamBuffer or a MultiMergeStream so can delete here
  _source_stream->release();
  _source_stream = NULL;

  return NULL;
}


/***** fetch_object_by_id *****/
MQDB::DBObject* EEDB::SPStreams::FederatedSourceStream::_fetch_object_by_id(string fid) {
  string uuid;
  size_t p1;
  if((p1 = fid.find("::")) != string::npos) {
    uuid = fid.substr(0, p1);
  }
  if(uuid.empty()) { return NULL; }
  EEDB::Peer *peer = _find_peer(uuid);
  if(!peer) { return NULL; }
  if(peer->source_stream() == NULL) { return NULL; }
  return peer->source_stream()->fetch_object_by_id(fid);
}


/////////////////////////////////////////////////////////////
//
// methods for fine tuning source streaming


void  EEDB::SPStreams::FederatedSourceStream::set_sourcestream_output(string value) {
  _sourcestream_output = value;
}

void  EEDB::SPStreams::FederatedSourceStream::add_expression_datatype_filter(EEDB::Datatype* datatype) {
  _expression_datatypes[datatype->type()] = datatype;
}


void EEDB::SPStreams::FederatedSourceStream::_disconnect_stream() {
  for(unsigned int i=0; i<_cloned_peers.size(); i++) {
    EEDB::Peer* peer = _cloned_peers[i];
    peer->disconnect();
    peer->release();
  }
  _cloned_peers.clear();
  if(_source_stream != NULL) { _source_stream->disconnect(); }
}


void EEDB::SPStreams::FederatedSourceStream::_stream_clear() {
  _disconnect_stream();
  if(_source_stream) { 
    _source_stream->stream_clear();
    _source_stream->release(); 
  }
  _source_stream=NULL;
}


void EEDB::SPStreams::FederatedSourceStream::_reset_stream_node() {
  //this is not passed down the stream, but can be replaced by subclasses
  //with a function which resets pointers,counters or other internal
  //variables to bring the stream back to a clean starting point
}


////////////////////////////////////////////////////////////////////////////
//
// stream building section
//
////////////////////////////////////////////////////////////////////////////

/***** source_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none 

*****/

EEDB::SPStream*  EEDB::SPStreams::FederatedSourceStream::_build_source_stream() {
  if(_source_stream) { _source_stream->release(); _source_stream=NULL; }

  EEDB::SPStreams::MultiMergeStream *stream = _build_unfiltered_stream();

  //for each peer, resets any source_id_filter() from previous queries
  stream->clear_sourcestream_filters();  

  //first add explicit source_ids filters
  map<string, bool>::iterator  it1;
  for(it1 = _filter_source_ids.begin(); it1 != _filter_source_ids.end(); it1++) {
    stream->add_source_id_filter((*it1).first);
  }

  //if _filter_source_names OR _filter_experiment_searchlogic is set
  //  then we need to stream_data_sources(), post filter,
  //  and then extend the add_source_id_filter() with additional ids
  //  these filters work to refine the previous explicit filters (peer_ids, source_ids) 
  if(!_filter_source_names.empty() or !_filter_experiment_searchlogic.empty()) {
    map<string, bool>  modified_filter_ids;
    if(!_filter_source_names.empty()) {
      stream->stream_data_sources("FeatureSource");
      while(EEDB::DataSource *obj = (EEDB::DataSource*)stream->next_in_stream()) {
        if(obj->classname() != EEDB::FeatureSource::class_name) { obj->release(); continue; }
        if(_filter_source_names[obj->name()]) {
          modified_filter_ids[obj->db_id()] = true;
        }
        obj->release();
      }
    }

    if(!_filter_experiment_searchlogic.empty()) {
      stream->stream_data_sources("Experiment", _filter_experiment_searchlogic);
      while(EEDB::DataSource *obj = (EEDB::DataSource*)stream->next_in_stream()) {
        if(obj->classname() != EEDB::Experiment::class_name) { obj->release(); continue; }
        modified_filter_ids[obj->db_id()] = true;
        obj->release();
      }
    }
    
    if(modified_filter_ids.empty()) {
      //failed to find matches so need to return an empty stream
      stream->release();
      _source_stream = new EEDB::SPStreams::StreamBuffer();
      return _source_stream;
    } else {
      //need to rebuild filter with the new modified_filter_ids
      stream->clear_sourcestream_filters();
      for(it1 = modified_filter_ids.begin(); it1 != modified_filter_ids.end(); it1++) {
        stream->add_source_id_filter((*it1).first);
      }
    }
  }
  
  stream->set_sourcestream_output(_sourcestream_output);

  map<string, EEDB::Datatype*>::iterator  it3;
  for(it3 = _expression_datatypes.begin(); it3 != _expression_datatypes.end(); it3++) {
    stream->add_expression_datatype_filter((*it3).second);
  }

  _source_stream = stream;
  return _source_stream;
}


EEDB::SPStreams::MultiMergeStream*  
EEDB::SPStreams::FederatedSourceStream::_build_unfiltered_stream() {
  EEDB::SPStreams::MultiMergeStream  *stream = new EEDB::SPStreams::MultiMergeStream;
  vector<EEDB::Peer*>::iterator      it;
  vector<EEDB::Peer*>                peers = _get_peers();
  map<string, EEDB::Peer*>           remote_root_peers;
  map<string, EEDB::Peer*>::iterator it2;
  map<string, bool>::iterator        it3;

  //consolidate remote servers all via unique web_url
  for(it = peers.begin(); it != peers.end(); it++) {
    EEDB::Peer *peer = (*it);
    if(peer->is_remote()) {
      EEDB::SPStreams::RemoteServerStream* rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      EEDB::Peer* rpeer = rstream->master_peer();
      if(remote_root_peers.find(rpeer->uuid()) == remote_root_peers.end()) {
        rstream->clear_filters();
        remote_root_peers[rpeer->uuid()] = rpeer;
      }
    }
  }
    
  //build the unfiltered stream based on peers
  for(it = peers.begin(); it != peers.end(); it++) {
    EEDB::Peer *peer = (*it);

    if(peer->is_remote()) { continue; }
    if(remote_root_peers.find(peer->uuid()) != remote_root_peers.end()) { continue; }
    
    if(_clone_peers_on_build) {
      EEDB::Peer *clone = peer->copy();
      _cloned_peers.push_back(clone);
      peer = clone;
    }
    stream->add_sourcestream(peer->source_stream());
  }

  //add in the remote-root peers
  for(it2 = remote_root_peers.begin(); it2 != remote_root_peers.end(); it2++) {
    EEDB::Peer *peer = (*it2).second;
    EEDB::SPStreams::RemoteServerStream* rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
    for(it3 = _filter_peer_ids.begin(); it3 != _filter_peer_ids.end(); it3++) {
      rstream->add_peer_id_filter((*it3).first);
    }
    for(it3 = _filter_source_ids.begin(); it3 != _filter_source_ids.end(); it3++) {
      rstream->add_source_id_filter((*it3).first);
    }
    stream->add_sourcestream(peer->source_stream());
  }    
  
  return stream;
}


void  EEDB::SPStreams::FederatedSourceStream::get_peers(map<string, EEDB::Peer*> &peers_cache) {
  vector<EEDB::Peer*>::iterator       it;
  
  //then search
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer *seedpeer = (*it);
    if(seedpeer->cache_find_peers(peers_cache, _peer_search_depth)) { break; } //found everything
  }
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer *seedpeer = (*it);
    if(seedpeer->find_peers(peers_cache, _peer_search_depth)) { break; } //found everything
  }  
}


vector<EEDB::Peer*>  EEDB::SPStreams::FederatedSourceStream::_get_peers() {
  vector<EEDB::Peer*>                 ps;
  vector<EEDB::Peer*>::iterator       it;
  map<string, EEDB::Peer*>            peers_cache;
  map<string, EEDB::Peer*>::iterator  it2;
  map<string, bool>::iterator         it3;

  if(!_filter_peer_ids.empty()) {
    //first prep the peers_cache with peer uuids we are looking for
    for(it3 = _filter_peer_ids.begin(); it3 != _filter_peer_ids.end(); it3++) {
      peers_cache[(*it3).first] = NULL;
    }
    //then search
    for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
      EEDB::Peer *seedpeer = (*it);
      if(seedpeer->cache_find_peers(peers_cache, _peer_search_depth)) { break; /*found everything*/ }
    }
    for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
      EEDB::Peer *seedpeer = (*it);
      if(seedpeer->find_peers(peers_cache, _peer_search_depth)) { break; /*found everything*/ }
    }
  }else if(_allow_full_federation_search) {
    //do full federation search of all peers
    for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
      EEDB::Peer *seedpeer = (*it);
      seedpeer->all_network_peers(_peer_search_depth, peers_cache);
    }
  }

  for(it2 = peers_cache.begin(); it2 != peers_cache.end(); it2++) {
    EEDB::Peer *peer = (*it2).second;
    if(peer==NULL) { continue; }
    if(!peer->retest_is_valid()) { continue; }
    ps.push_back(peer);
  }
  return ps;
}


EEDB::Peer*  EEDB::SPStreams::FederatedSourceStream::_find_peer(string uuid) {
  EEDB::Peer *peer = NULL;
  
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    peer = (*it);
    if(peer->uuid() == uuid) { return peer; }
  }
  
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer *seedpeer = (*it);
    peer = seedpeer->cache_find_peer(uuid, _peer_search_depth);
    if(peer) { return peer; }
  }

  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer *seedpeer = (*it);
    peer = seedpeer->find_peer(uuid, _peer_search_depth);
    if(peer) { return peer; }
  }
  return NULL;
}


