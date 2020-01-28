/* $Id: DemultiplexSource.cpp,v 1.3 2020/01/27 10:11:05 severin Exp $ */

/***

NAME - EEDB::SPStreams::DemultiplexSource

SYNOPSIS

DESCRIPTION

 A simple signal procesor which is configured with a minimum expression value
 and which will only pass expressions which are greater than that value

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
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/DemultiplexSource.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::DemultiplexSource::class_name = "EEDB::SPStreams::DemultiplexSource";

//function prototypes
void _spstream_demultiplexsource_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::DemultiplexSource*)obj;
}
void _spstream_demultiplexsource_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::DemultiplexSource*)node)->_reset_stream_node();
}
void _spstream_demultiplexsource_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::DemultiplexSource*)node)->_stream_clear();
}
MQDB::DBObject* _spstream_demultiplexsource_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::DemultiplexSource*)node)->_next_in_stream();
}
void _spstream_demultiplexsource_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::DemultiplexSource*)obj)->_xml(xml_buffer);
}

EEDB::SPStreams::DemultiplexSource::DemultiplexSource() {
  init();
}

EEDB::SPStreams::DemultiplexSource::~DemultiplexSource() {
}

void EEDB::SPStreams::DemultiplexSource::init() {
  EEDB::SPStreams::MergeStreams::init();  
  _classname                 = EEDB::SPStreams::DemultiplexSource::class_name;
  _module_name               = "DemultiplexSource";
  _funcptr_delete            = _spstream_demultiplexsource_delete_func;
  _funcptr_xml               = _spstream_demultiplexsource_xml_func;
  _funcptr_simple_xml        = _spstream_demultiplexsource_xml_func;

  //function pointer code
  _funcptr_reset_stream_node   = _spstream_demultiplexsource_reset_stream_node_func;
  _funcptr_stream_clear        = _spstream_demultiplexsource_stream_clear_func;
  _funcptr_next_in_stream      = _spstream_demultiplexsource_next_in_stream_func;

  //might be best to relink these functions to default function which only directs to primary stream
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
  
  //attribute variables
  _demux_source_mode  = EXPERIMENT;  // enum { FEATURESOURCE, EXPERIMENT }
  _demux_mdata.clear();
  _side_linking_mdkey = "";
  _enable_full_demux = false;
  
  //internal data structures
  _linking_mdata_hash.clear();
  _subsource_hash.clear();
}

//methods for setting parameters for debugging
void   EEDB::SPStreams::DemultiplexSource::set_demux_source_mode(string mode) {
  if(mode == "featuresource") { _demux_source_mode = FEATURESOURCE; }
  if(mode == "experiment")    { _demux_source_mode = EXPERIMENT; }  
}

void  EEDB::SPStreams::DemultiplexSource::add_demux_mdata_keys(string mdkeys) {
  if(mdkeys.empty()) { return; }
  char* buf = (char*)malloc(mdkeys.size()+2);
  strcpy(buf, mdkeys.c_str());
  char *p1 = strtok(buf, ", \t");
  while(p1!=NULL) {
    if(strlen(p1) > 0) {
      string mdkey = p1;
      //if(mdkey == "ID")           { mdata->type() = "eedb:name"; }
      //if(mdkey == "id")           { mdata->type() = "eedb:name"; }
      //if(mdkey == "name")         { mdata->type() = "eedb:name"; }
      EEDB::Metadata *mdata = new EEDB::Metadata(mdkey, "");
      _demux_mdata.push_back(mdata);
    }
    p1 = strtok(NULL, ", \t");
  }
  free(buf);   
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::DemultiplexSource::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  

  switch(_demux_source_mode) {
    case FEATURESOURCE: xml_buffer.append("<source_mode>featuresource</source_mode>"); break;
    case EXPERIMENT:    xml_buffer.append("<source_mode>experiment</source_mode>"); break;
  }
  if(!_side_linking_mdkey.empty()) { xml_buffer += "<side_linking_mdkey>"+_side_linking_mdkey+"</side_linking_mdkey>"; }
  
  if(_enable_full_demux) { xml_buffer.append("<full_demux>true</full_demux>"); }
  else { xml_buffer.append("<full_demux>false</full_demux>"); }
  
  xml_buffer.append("<demux_mdata>");
  for(unsigned int i=0; i<_demux_mdata.size(); i++) {
    _demux_mdata[i]->xml(xml_buffer);
  }
  xml_buffer.append("</demux_mdata>");

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::DemultiplexSource::DemultiplexSource(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node, *demux_mdata_node;
  //rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }
    
  _demux_source_mode = EXPERIMENT;
  if((node = root_node->first_node("mdata_mode")) != NULL) { 
    if(string(node->value()) == "featuresource") { _demux_source_mode = FEATURESOURCE; }
    if(string(node->value()) == "experiment")    { _demux_source_mode = EXPERIMENT; }
  }
  if((node = root_node->first_node("source_mode")) != NULL) { 
    if(string(node->value()) == "featuresource") { _demux_source_mode = FEATURESOURCE; }
    if(string(node->value()) == "experiment")    { _demux_source_mode = EXPERIMENT; }
  }
  
  if((node = root_node->first_node("side_linking_mdkey")) != NULL) { 
    _side_linking_mdkey=node->value();
  }

  if((node = root_node->first_node("full_demux")) != NULL) {
    _enable_full_demux=false;
    if(string(node->value()) == "true") { _enable_full_demux=true; }
  }  

  _demux_mdata.clear();
  demux_mdata_node = root_node->first_node("demux_mdata");
  if(demux_mdata_node != NULL) {
    if((node = demux_mdata_node->first_node("mdata")) != NULL) {
      while(node) {
        EEDB::Metadata *mdata = new EEDB::Metadata(node);
        //if(mdata->type() == "ID")           { mdata->type() = "eedb:name"; }
        //if(mdata->type() == "id")           { mdata->type() = "eedb:name"; }
        //if(mdata->type() == "name")         { mdata->type() = "eedb:name"; }
        if(mdata) { _demux_mdata.push_back(mdata); }
        node = node->next_sibling("mdata");
      }    
    }
  }
  if((node = root_node->first_node("demux_mdkeys")) != NULL) { //space, tab, comma separated list
    if(node->value()) { add_demux_mdata_keys(node->value()); }
  }

  //side stream last
  if((node = root_node->first_node("side_stream")) != NULL) {
    create_side_stream_from_xml(node);  //from superclass
  }
}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::DemultiplexSource::_reset_stream_node() {
  fprintf(stderr, "DemultiplexSource::_reset_stream_node\n");
  EEDB::SPStreams::MergeStreams::_reset_stream_node();
  _preload_side_stream_linking_mdata_hash();  
}


void EEDB::SPStreams::DemultiplexSource::_stream_clear() {
  fprintf(stderr, "DemultiplexSource::_stream_clear\n");
  if(source_stream()) { source_stream()->stream_clear(); }
  if(side_stream())   { side_stream()->stream_clear(); }

  //clear the _linking_mdata_hash to force reload on next stream call
  //map<string, EEDB::MetadataSet*>::iterator it1;
  //for(it1=_linking_mdata_hash.begin(); it1!=_linking_mdata_hash.end(); it1++) {
  //  if((*it1).second) { (*it1).second->release(); }
  //}
  //_linking_mdata_hash.clear();
  //_subsource_hash.clear();
}


MQDB::DBObject* EEDB::SPStreams::DemultiplexSource::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  //non-feature objects are just passed through this module      
  if((obj->classname() == EEDB::FeatureSource::class_name) || 
     (obj->classname() == EEDB::Experiment::class_name)) {
    EEDB::DataSource*  source = (EEDB::DataSource*)obj;
    _full_demux_source(source);
  }

  if(obj->classname() != EEDB::Feature::class_name) {
    return obj;
  }
  
  EEDB::Feature*  feature = (EEDB::Feature*)obj;
  if(!_demux_source_for_feature(feature)) {
    fprintf(stderr, "some sort of error with the demux\n");
  }
  return feature;
}

//
////////////////////////////////////////////////////////////
//

void  EEDB::SPStreams::DemultiplexSource::_preload_side_stream_linking_mdata_hash() {
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


bool  EEDB::SPStreams::DemultiplexSource::_demux_source_for_feature(EEDB::Feature* feature) {
  if(!feature) { return false; }
  if(_demux_mdata.empty()) { return true; }
  
  //first generate the demux key from the _demux_mdata
  EEDB::MetadataSet*   mdset = feature->metadataset();
  string demux_key;  
  for(unsigned int i=0; i<_demux_mdata.size(); i++) {
    EEDB::Metadata *md1 = _demux_mdata[i];
    if(md1->type().empty()) { continue; }    
    EEDB::Metadata *md2 = mdset->find_metadata(md1->type(), "");  
    if(md2) {
      //fprintf(stderr, "found demux key[%s]  value[%s]\n", md2->type().c_str(), md2->data().c_str());
      if(!demux_key.empty()) { demux_key += "_"; }
      demux_key += md2->data();
    } else if((md1->type() == "name") || (md1->type() == "eedb:name")) {
      if(feature->primary_name().empty()) { continue; }
      //fprintf(stderr, "found demux key[%s]  value[%s]\n", md1->type().c_str(), feature->primary_name().c_str());
      if(!demux_key.empty()) { demux_key += "_"; }
      demux_key += feature->primary_name();
    } //else if() {}
  }
  if(demux_key.empty()) {
    //fprintf(stderr, "error: unable to generate demux key\n");
    return false;
  }
  //fprintf(stderr, "demux_key[%s]\n", demux_key.c_str());
  

  //then determine based on the _demux_source_mode decide how the demux is applied
  if(_demux_source_mode == FEATURESOURCE) {
    EEDB::FeatureSource *fsrc = feature->feature_source();
    if(!fsrc) { return false; }
    EEDB::FeatureSource *demux_fsrc = (EEDB::FeatureSource*)fsrc->subsource_for_key(demux_key);
    if(!demux_fsrc) {         
      fprintf(stderr, "demux failed to return a FeatureSource");
      return false;
    }
    if(demux_fsrc->classname() != EEDB::FeatureSource::class_name) {
      fprintf(stderr, "demux did not return a FeatureSource class\n");
      return false;
    }
    //link mdata if needed
    if(_subsource_hash.find(demux_fsrc->db_id()) == _subsource_hash.end()) {
      _subsource_hash[demux_fsrc->db_id()] = demux_fsrc;
      _transfer_linking_metadata(demux_fsrc);
    }      
    //switch to demuxed FeatureSource
    feature->feature_source(demux_fsrc);  
  }
      
  if(_demux_source_mode == EXPERIMENT) {
    vector<EEDB::Expression*>  expression = feature->expression_array();
    //fprintf(stderr, "feature has %ld expression values\n", expression.size());
    for(unsigned int i=0; i<expression.size(); i++) {
      EEDB::Experiment *exp = expression[i]->experiment();
      if(!exp) { continue; }
      EEDB::Experiment *demux_exp = (EEDB::Experiment*)exp->subsource_for_key(demux_key);
      if(!demux_exp) {         
        fprintf(stderr, "demux failed to return a DataSource\n");
        return false;
      }
      //fprintf(stderr, "%s\n", demux_exp->xml().c_str());
      if(demux_exp->classname() != EEDB::Experiment::class_name) {
        fprintf(stderr, "demux datasource is not an Experiment class\n");
        return false;
      }
      //link mdata if needed
      if(_subsource_hash.find(demux_exp->db_id()) == _subsource_hash.end()) {
        _subsource_hash[demux_exp->db_id()] = demux_exp;
        _transfer_linking_metadata(demux_exp);
      }      
      //switch to demuxed Experiment
      expression[i]->experiment(demux_exp); 
    }
  }
  
  return true;
}

void  EEDB::SPStreams::DemultiplexSource::_full_demux_source(EEDB::DataSource* source) {
  //using the side_stream linking mdata file. It will use all the demux keys from the _linking_mdata_hash
  //to fill in all the possible demux keys for the sources streamed through this module.
  if(!source) { return; }
  if(!_enable_full_demux) { return; }

  _preload_side_stream_linking_mdata_hash();  
  if(_linking_mdata_hash.empty()) { return; }

  fprintf(stderr, "DemultiplexSource::_full_demux_source: %s", source->simple_xml().c_str());  

  EEDB::FeatureSource *fsrc = NULL;
  EEDB::Experiment *exp = NULL;
  if(_demux_source_mode == FEATURESOURCE) { fsrc = (EEDB::FeatureSource*)source; }
  if(_demux_source_mode == EXPERIMENT)    { exp =  (EEDB::Experiment*)source; } 
  if(!fsrc && !exp) { return; }
  
  map<string, EEDB::MetadataSet*>::iterator it1;
  for(it1=_linking_mdata_hash.begin(); it1!=_linking_mdata_hash.end(); it1++) {
    string demux_key = (*it1).first;
    //fprintf(stderr, "demux_key[%s]\n", demux_key.c_str());
  
    if(fsrc) {
      EEDB::FeatureSource *demux_fsrc = (EEDB::FeatureSource*)fsrc->subsource_for_key(demux_key);
      //link mdata if needed
      if(demux_fsrc && (_subsource_hash.find(demux_fsrc->db_id()) == _subsource_hash.end())) {
        _subsource_hash[demux_fsrc->db_id()] = demux_fsrc;
        _transfer_linking_metadata(demux_fsrc);
      }      
    }
    
    if(exp) {
      EEDB::Experiment *demux_exp = (EEDB::Experiment*)exp->subsource_for_key(demux_key);
      //link mdata if needed
      if(demux_exp && (_subsource_hash.find(demux_exp->db_id()) == _subsource_hash.end())) {
        _subsource_hash[demux_exp->db_id()] = demux_exp;
        _transfer_linking_metadata(demux_exp);
      }      
    }
  }
}


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

