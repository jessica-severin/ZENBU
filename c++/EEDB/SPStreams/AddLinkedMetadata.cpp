/* $Id: AddLinkedMetadata.cpp,v 1.1 2019/02/21 07:32:35 severin Exp $ */

/***

NAME - EEDB::SPStreams::AddLinkedMetadata

SYNOPSIS

DESCRIPTION

 This module is configured with a side_stream of features containing metadata.
 Using a linking metadata value, if the primary_stream object has linking-metadata to any 
 side_stream feature with same metadata, then the full metadata of the side_stream feature is 
 transfered onto the primary_stream object.
 Side stream should be populated with a metadata file source since all objects on side stream must be
 loaded into a memory hash prior to streaming of objects on the primary_stream

CONTACT

Jessica Severin <jessica.severin@riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
 * copyright (c) 2007-2019 Jessica Severin RIKEN OSC
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
#include <EEDB/Feature.h>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/AddLinkedMetadata.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::AddLinkedMetadata::class_name = "EEDB::SPStreams::AddLinkedMetadata";

//function prototypes
MQDB::DBObject* _spstream_addlinkedmetadata_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::AddLinkedMetadata*)node)->_next_in_stream();
}
void _spstream_addlinkedmetadata_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::AddLinkedMetadata*)node)->_reset_stream_node();
}
void _spstream_addlinkedmetadata_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::AddLinkedMetadata*)node)->_stream_clear();
}
void _spstream_addlinkedmetadata_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::AddLinkedMetadata*)obj;
}
void _spstream_addlinkedmetadata_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::AddLinkedMetadata*)obj)->_xml(xml_buffer);
}
bool _spstream_addlinkedmetadata_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::AddLinkedMetadata*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}


EEDB::SPStreams::AddLinkedMetadata::AddLinkedMetadata() {
  init();
}

EEDB::SPStreams::AddLinkedMetadata::~AddLinkedMetadata() {
  _reset_stream_node();
}


void EEDB::SPStreams::AddLinkedMetadata::init() {
  EEDB::SPStreams::MergeStreams::init();  
  _classname                  = EEDB::SPStreams::AddLinkedMetadata::class_name;
  _module_name                = "AddLinkedMetadata";

  _funcptr_delete             = _spstream_addlinkedmetadata_delete_func;
  _funcptr_xml                = _spstream_addlinkedmetadata_xml_func;
  _funcptr_simple_xml         = _spstream_addlinkedmetadata_xml_func;

  _funcptr_reset_stream_node        = _spstream_addlinkedmetadata_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_addlinkedmetadata_stream_clear_func;
  _funcptr_next_in_stream           = _spstream_addlinkedmetadata_next_in_stream_func;
  
  //TODO: I may write specific code for each streaming method to switch to just primary stream
  //or I may just hack it by relinking the functions to default function which only directs to primary stream
  _funcptr_fetch_object_by_id                 = _spstream_default_fetch_object_by_id_func;
  _funcptr_stream_by_named_region             = _spstream_default_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_default_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_default_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_default_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_default_stream_peers_func;
  _funcptr_reload_stream_data_sources         = _spstream_default_reload_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_default_get_dependent_datasource_ids;
  _funcptr_stream_all_features                = _spstream_default_stream_all_features_func;
  _funcptr_stream_edges                       = _spstream_default_stream_edges_func;
  _funcptr_fetch_features                     = _spstream_default_fetch_features_func;
  
  //these best left in default MergeStream mode  
  //_funcptr_disconnect                         = _spstream_default_disconnect_func;
  //_funcptr_get_proxies_by_name                = _spstream_default_get_proxies_by_name;
  
  _target_mode = ALL;
  _primary_linking_mdkey = "";
  _side_linking_mdkey = "";

  _linking_mdata_hash.clear();
}

void EEDB::SPStreams::AddLinkedMetadata::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::AddLinkedMetadata::display_desc() {
  return "AddLinkedMetadata";
}

string EEDB::SPStreams::AddLinkedMetadata::display_contents() {
  return display_desc();
}

////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
///////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::AddLinkedMetadata::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  if(!_primary_linking_mdkey.empty()) { xml_buffer += "<primary_linking_mdkey>"+_primary_linking_mdkey+"</primary_linking_mdkey>"; }
  if(!_side_linking_mdkey.empty()) { xml_buffer += "<side_linking_mdkey>"+_side_linking_mdkey+"</side_linking_mdkey>"; }
    
  switch(_target_mode) {
    case FEATURE:       xml_buffer.append("<target_mode>feature</target_mode>"); break;
    case FEATURESOURCE: xml_buffer.append("<target_mode>featuresource</target_mode>"); break;
    case EXPERIMENT:    xml_buffer.append("<target_mode>experiment</target_mode>"); break;
    case EDGESOURCE:    xml_buffer.append("<target_mode>edgesource</target_mode>"); break;
    case DATASOURCE:    xml_buffer.append("<target_mode>datasource</target_mode>"); break;
    case ALL:           xml_buffer.append("<target_mode>all</target_mode>"); break;
  }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::AddLinkedMetadata::AddLinkedMetadata(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  //rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("primary_linking_mdkey")) != NULL) { 
    _primary_linking_mdkey=node->value();
  }
  if((node = root_node->first_node("side_linking_mdkey")) != NULL) { 
    _side_linking_mdkey=node->value();
  }

  _target_mode = ALL;
  if((node = root_node->first_node("target_mode")) != NULL) { 
    if(string(node->value()) == "feature") { _target_mode = FEATURE; }
    if(string(node->value()) == "featuresource") { _target_mode = FEATURESOURCE; }
    if(string(node->value()) == "experiment") { _target_mode = EXPERIMENT; }
    if(string(node->value()) == "edgesource") { _target_mode = EDGESOURCE; }
    if(string(node->value()) == "datasource") { _target_mode = DATASOURCE; }
    if(string(node->value()) == "all") { _target_mode = ALL; }
  }
  
  //side stream last
  if((node = root_node->first_node("side_stream")) != NULL) {
    create_side_stream_from_xml(node);  //from MergeStreams superclass
  }  
}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::AddLinkedMetadata::_reset_stream_node() {
  EEDB::SPStreams::MergeStreams::_reset_stream_node();
  _preload_side_stream_linking_mdata_hash();  
}


void EEDB::SPStreams::AddLinkedMetadata::_stream_clear() {
  fprintf(stderr, "AddLinkedMetadata::_stream_clear\n");
  if(source_stream()) { source_stream()->stream_clear(); }
  if(side_stream())   { side_stream()->stream_clear(); }

  //clear the _linking_mdata_hash to force reload on next stream call
  //map<string, EEDB::MetadataSet*>::iterator it1;
  //for(it1=_linking_mdata_hash.begin(); it1!=_linking_mdata_hash.end(); it1++) {
  //  if((*it1).second) { (*it1).second->release(); }
  //}
  //_linking_mdata_hash.clear();
}


MQDB::DBObject* EEDB::SPStreams::AddLinkedMetadata::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      if(obj->classname() == EEDB::Feature::class_name) {
        if(_process_feature((EEDB::Feature*)obj)) { return obj; }
        else { obj->release(); obj=NULL; }
      }
      
      if((obj->classname() == EEDB::FeatureSource::class_name) ||
         (obj->classname() == EEDB::Experiment::class_name) ||
         (obj->classname() == EEDB::EdgeSource::class_name)) {
        if(_process_datasource((EEDB::DataSource*)obj)) { return obj; }
        else { obj->release(); obj=NULL; }
      }
      
      if(obj) { return obj; }
    }
  }
  
  // input stream is empty so done
  return NULL; 
}

//
////////////////////////////////////////////////////////////
//

void  EEDB::SPStreams::AddLinkedMetadata::_preload_side_stream_linking_mdata_hash() {
  if(_side_linking_mdkey.empty()) { return; }
  if(_side_stream==NULL) { return; }
  if(!_linking_mdata_hash.empty()) { return; }
  
  fprintf(stderr, "_preload_side_stream_linking_mdata_hash: side_linking_mdkey[%s]\n", _side_linking_mdkey.c_str());
  
  EEDB::Feature* feature = NULL;
  _side_stream->stream_all_features();
  long count=0;
  while((feature = (EEDB::Feature*)_side_stream->next_in_stream()) != NULL) {
    count++;
    if(feature->classname() != EEDB::Feature::class_name) {
      feature->release();
      continue;
    }
    
    vector<Metadata*>::iterator lmd_it;
    vector<Metadata*> link_mdata = feature->metadataset()->find_all_metadata_like(_side_linking_mdkey, "");
    for(lmd_it=link_mdata.begin(); lmd_it!=link_mdata.end(); lmd_it++) {
      string value = (*lmd_it)->data();
      if(_linking_mdata_hash.find(value) == _linking_mdata_hash.end()) {
        EEDB::MetadataSet *mdset2 = feature->metadataset()->copy();
        _linking_mdata_hash[value] = mdset2;
      } else {
        //merge in
        fprintf(stderr, "multiple mdata side features with same link_key[%s]  value[%s]\n", _side_linking_mdkey.c_str(), value.c_str());
        EEDB::MetadataSet *mdset2 = _linking_mdata_hash[value];
        mdset2->merge_metadataset(feature->metadataset());
        mdset2->remove_duplicates();
      }
    }
    feature->release();
  }
  fprintf(stderr, "built _linking_mdata_hash %ld features, with %ld linking sets\n", count, _linking_mdata_hash.size());
}


bool  EEDB::SPStreams::AddLinkedMetadata::_process_feature(EEDB::Feature *feature) {
  if(!feature) { return true; }
  if(_target_mode!=FEATURE && _target_mode!=ALL) { return true; } //ignore and leave as is  
  if(_side_linking_mdkey.empty()) { return true; }
  if(_primary_linking_mdkey.empty()) { return true; }
  if(_linking_mdata_hash.empty()) { return true; }
  //fprintf(stderr, "_transfer_linking_metadata : %s %s\n", source->db_id().c_str(), source->demux_key().c_str());
  
  if(!feature->metadataset()) { return true; }
  
  vector<Metadata*> primary_mdata = feature->metadataset()->find_all_metadata_like(_primary_linking_mdkey, "");
  vector<Metadata*>::iterator pmd_it;
  for(pmd_it=primary_mdata.begin(); pmd_it!=primary_mdata.end(); pmd_it++) {
    string value = (*pmd_it)->data();
    if(_linking_mdata_hash.find(value) == _linking_mdata_hash.end()) { 
      //fprintf(stderr, "no mdata for primary key[%s] value[%s]\n", _primary_linking_mdkey.c_str(), value.c_str());
      continue;
    }
    EEDB::MetadataSet *mdset2 = _linking_mdata_hash[value];
    if(!mdset2) { continue; }     
    feature->metadataset()->merge_metadataset(mdset2);
  }
  feature->metadataset()->remove_duplicates();
  return true;
}


bool  EEDB::SPStreams::AddLinkedMetadata::_process_datasource(EEDB::DataSource *source) {
  if(!source) { return true; }
  if(_target_mode==FEATURE) { return true; } //ignore and leave as is  
  if(_target_mode==FEATURESOURCE && (source->classname() != EEDB::FeatureSource::class_name)) { return true; }
  if(_target_mode==EXPERIMENT    && (source->classname() != EEDB::Experiment::class_name)) { return true; }
  if(_target_mode==EDGESOURCE    && (source->classname() != EEDB::EdgeSource::class_name)) { return true; }
  if(_side_linking_mdkey.empty()) { return true; }
  if(_primary_linking_mdkey.empty()) { return true; }
  if(_linking_mdata_hash.empty()) { return true; }

  if(!source->metadataset()) { return true; }
  
  vector<Metadata*> primary_mdata = source->metadataset()->find_all_metadata_like(_primary_linking_mdkey, "");
  vector<Metadata*>::iterator pmd_it;
  for(pmd_it=primary_mdata.begin(); pmd_it!=primary_mdata.end(); pmd_it++) {
    string value = (*pmd_it)->data();
    if(_linking_mdata_hash.find(value) == _linking_mdata_hash.end()) { 
      //fprintf(stderr, "no mdata for primary key[%s] value[%s]\n", _primary_linking_mdkey.c_str(), value.c_str());
      continue;
    }
    EEDB::MetadataSet *mdset2 = _linking_mdata_hash[value];
    if(!mdset2) { continue; }     
    source->metadataset()->merge_metadataset(mdset2);
  }
  source->metadataset()->remove_duplicates();
  return true;
}

/*
void  EEDB::SPStreams::DemultiplexSource::_transfer_linking_metadata(EEDB::DataSource* source) {
  if(!source) { return; }
  if(_side_linking_mdkey.empty()) { return; }
  if(_linking_mdata_hash.empty()) { return; }
  //fprintf(stderr, "_transfer_linking_metadata : %s %s\n", source->db_id().c_str(), source->demux_key().c_str());
  
  EEDB::MetadataSet* src_mdset = source->metadataset();
  if(!src_mdset) { return; }
  
  string  demux_key = source->demux_key();
  EEDB::MetadataSet *mdset2 = _linking_mdata_hash[demux_key];
  if(!mdset2) {
    //fprintf(stderr, "no mdata for demux[%s]\n", demux_key.c_str());
    return;
  }
  
  source->metadataset()->merge_metadataset(mdset2);
  source->metadataset()->remove_duplicates();
}
*/
