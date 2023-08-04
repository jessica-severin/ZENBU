/* $Id: SubfeaturesToEdges.cpp,v 1.8 2023/07/20 07:18:26 severin Exp $ */

/***

NAME - EEDB::SPStreams::SubfeaturesToEdges

SYNOPSIS

DESCRIPTION

A feature emitter which scans the genomic sequence for motif site patterns. 
Algorithm is based on PWM matric and the MATCH scoring method, but can be configured to search for 
string literals, IUPAC strings or PWM motifs.
General purpose site searching tool which can be configured for everything from:
 restriction sites
 Cas9 sites
 Transcription-factor binding sites

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU system
 * copyright (c) 2007-2017 Jessica Severin RIKEN
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
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/SubfeaturesToEdges.h>
#include <EEDB/WebServices/WebBase.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::SubfeaturesToEdges::class_name = "EEDB::SPStreams::SubfeaturesToEdges";

//call out functions
//function prototypes
MQDB::DBObject*  _spstream_dumbbelltoedge_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::SubfeaturesToEdges*)node)->_next_in_stream();
}
bool _spstream_dumbbelltoedge_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::SubfeaturesToEdges*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_dumbbelltoedge_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SubfeaturesToEdges*)node)->_reset_stream_node();
}
void _spstream_dumbbelltoedge_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SubfeaturesToEdges*)node)->_stream_clear();
}
void _spstream_dumbbelltoedge_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SubfeaturesToEdges*)node)->_reload_stream_data_sources();
}
void _spstream_dumbbelltoedge_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::SubfeaturesToEdges*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_dumbbelltoedge_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::SubfeaturesToEdges*)obj;
}
string _spstream_dumbbelltoedge_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::SubfeaturesToEdges*)obj)->_display_desc();
}
void _spstream_dumbbelltoedge_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::SubfeaturesToEdges*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::SubfeaturesToEdges::SubfeaturesToEdges() {
  init();
}

EEDB::SPStreams::SubfeaturesToEdges::~SubfeaturesToEdges() {
  //if(_edge_source != NULL) { _edge_source->release(); }
  //_edge_source = NULL;
}

void EEDB::SPStreams::SubfeaturesToEdges::init() {
  EEDB::SPStream::init();
  _classname      = EEDB::SPStreams::SubfeaturesToEdges::class_name;
  _module_name    = "SubfeaturesToEdges";

  _source_stream   = NULL;
  
  _region_start        = -1;
  _region_end          = -1;
  _transfer_expression = true;
  _transfer_metadata   = false;
  _mode                = "ends";
    
  _dynamic_edgesource_hash.clear();
  _source_streambuffer=NULL;

  //function pointer code
  _funcptr_delete                   = _spstream_dumbbelltoedge_delete_func;
  _funcptr_display_desc             = _spstream_dumbbelltoedge_display_desc_func;
  _funcptr_xml                      = _spstream_dumbbelltoedge_xml_func;
  _funcptr_simple_xml               = _spstream_dumbbelltoedge_xml_func;
 
  _funcptr_next_in_stream           = _spstream_dumbbelltoedge_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_dumbbelltoedge_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_dumbbelltoedge_stream_clear_func;
  _funcptr_stream_by_named_region   = _spstream_dumbbelltoedge_stream_by_named_region_func;

  _funcptr_reload_stream_data_sources   = _spstream_dumbbelltoedge_reload_stream_data_sources_func;
  _funcptr_stream_data_sources          = _spstream_dumbbelltoedge_stream_data_sources_func;
}

string EEDB::SPStreams::SubfeaturesToEdges::_display_desc() {
  string desc = "SubfeaturesToEdges\n";
  //char buffer[256];
  
  return desc;
}


string EEDB::SPStreams::SubfeaturesToEdges::display_contents() {
  return display_desc();
}


////////////////////////////////////////////////////////////////////////////
// Instance methods
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::SubfeaturesToEdges::_reset_stream_node() {
  _region_start   = -1;
  _region_end     = -1;
  if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }  
}


void EEDB::SPStreams::SubfeaturesToEdges::_stream_clear() {
  _region_start   = -1;
  _region_end     = -1;
  if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }  
}


bool EEDB::SPStreams::SubfeaturesToEdges::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  //fprintf(stderr,"StreamSubfeatures::_stream_by_named_region %s %d .. %d\n", chrom_name.c_str(), start,_region_end);
  return EEDB::SPStream::_stream_by_named_region(assembly_name, chrom_name, start, end);
}


MQDB::DBObject* EEDB::SPStreams::SubfeaturesToEdges::_next_in_stream() {
  MQDB::DBObject *obj;
  
  //stream the dynamic experiments from _source_streambuffer if available
  if(_source_streambuffer) {
    obj = _source_streambuffer->next_in_stream();
    if(obj) { return obj; }
    else {
      _source_streambuffer->release(); 
      _source_streambuffer=NULL;
    }
  }

  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature\expression objects are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      EEDB::Edge* edge = _process_feature((EEDB::Feature*)obj);
      if(edge) { return edge; }
    }
  }
  
  return NULL; 
}


EEDB::Edge*  EEDB::SPStreams::SubfeaturesToEdges::_process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return NULL; }

  // get the first and last subfeatures. since subfeatures are sorted can just grab front/back
  vector<EEDB::Feature*> subfeatures = feature->subfeatures();
  EEDB::Feature  *feat1 = NULL;
  EEDB::Feature  *feat2 = NULL;
  if(!subfeatures.empty()) { 
    feat1 = subfeatures.front();
    feat2 = subfeatures.back();
  } else {
    //if there are no subfeatures then create 1bp blocks on start/end
    EEDB::FeatureSource *source = feature->feature_source();
    //var sub1 = { start:feature.start, end:feature.start };
    //var sub2 = { start:feature.end, end:feature.end };
    feat1 = feature->create_subfeature(source, 0, 1, 1);
    feat2 = feature->create_subfeature(source, feature->chrom_end()-feature->chrom_start(), 1, 2);
  }
  //printf("=====\n%s\n", feature->xml().c_str());
  //EEDB::Feature  *feat1 = subfeatures.front();
  //EEDB::Feature  *feat2 = subfeatures.back();
  /*
  for(unsigned int i=0; i<subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = subfeatures[i];
    
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
    
    if(!feat1) { feat1 = subfeat; }
    if(!feat2) { feat2 = subfeat; }
    
    if(subfeat->chrom_start() < feat1->chrom_start()) { feat1 = subfeat; }
    if(subfeat->chrom_start() > feat2->chrom_start()) { feat2 = subfeat; }
  }
  */
  if(!feat1 || !feat2) { feature->release(); return NULL; }
  //printf("feat1 %s\t\tfeat2 %s\n", feat1->simple_xml().c_str(), feat2->simple_xml().c_str());

  EEDB::Edge* edge = new EEDB::Edge();
  edge->edge_source(_dynamic_edge_source(feature));
  edge->feature1(feat1);
  edge->feature2(feat2);
  edge->calc_direction();
  string dbID = feature->db_id();
  if(!dbID.empty()) {
    //create "fake" id based off of original feature dbID
    edge->db_id(dbID+ ":::Edge");
  }
  
  if(_transfer_expression) {
    vector<EEDB::Expression*> expressions = feature->expression_array();
    for(unsigned int j=0; j<expressions.size(); j++) { 
      //convert expression into EdgeWeight
      EEDB::Expression *expression = expressions[j];
      
      if(expression == NULL) { continue; }
      if(!expression->experiment()) { continue; }
      
      edge->add_edgeweight(expression->experiment(), expression->datatype()->type(), expression->value());
    }      
  }

  //transfer metadata
  if(_transfer_metadata) {
    edge->metadataset()->merge_metadataset(feature->metadataset());
  }
  edge->metadataset()->add_tag_data("display_name", feature->primary_name());
      
  //finished with feature
  feature->release();  
  //printf("%s\n", edge->xml().c_str());

  return edge;
}

////////////////////////////////////////////////////////////////////////////
//
// dynamic source creation section

EEDB::EdgeSource*  EEDB::SPStreams::SubfeaturesToEdges::_dynamic_edge_source(EEDB::Feature* feature) {
  if(!feature) { return NULL; }
  if(!feature->feature_source()) { return NULL; }
  
  return _dynamic_edge_source(feature->feature_source());
}
  
  
EEDB::EdgeSource*  EEDB::SPStreams::SubfeaturesToEdges::_dynamic_edge_source(EEDB::DataSource *source) {
  if(!source) { return NULL; }
  if(source->classname() == EEDB::EdgeSource::class_name) { return (EEDB::EdgeSource*)source; }
  
  EEDB::EdgeSource *edgesource = _dynamic_edgesource_hash[source->db_id()];
  if(edgesource) { return edgesource; }
  
  fprintf(stderr, "create dynamic EdgeSource for %s\n", source->db_id().c_str());
  edgesource = new EEDB::EdgeSource;
  source->metadataset(); //lazyload if needed
  source->_copy(edgesource);

  //little magic, resetting the primary_id back to itself will cause the db_id() to be rebuilt but now as an EdgeSource. 
  //Since ZENBU always creates increasing primary_ids for all sources within a _funcptr_stream_peers
  //there will never be a default case where a FeatureSource and EdgeSource within the same peer will have the same
  //primary_id, thus this is guaranteeed to create a parallel but not conflicting EdgeSource
  edgesource->primary_id(source->primary_id());
  edgesource->database(NULL);

  //link the dynamic parallel edgesource to the fsrcID
  _dynamic_edgesource_hash[source->db_id()] = edgesource;
  edgesource->retain();

  _cache_datasource(edgesource);
  return edgesource;
}



void EEDB::SPStreams::SubfeaturesToEdges::_reload_stream_data_sources() {
  if(!source_stream()) { return; }
  
  //fprintf(stderr, "SubfeaturesToEdges::_reload_stream_data_sources\n");
  // first pass this down the stream
  source_stream()->reload_stream_data_sources();
  
  map<string, EEDB::DataSource*>::iterator it;
  if(_sources_cache.empty()) { 
    //stream all sources into my cache and add dynamic Experiments as needed
    source_stream()->stream_data_sources();
    EEDB::DataSource *source;
    while((source = (EEDB::DataSource*)source_stream()->next_in_stream())) {
      _cache_datasource(source);
    }
    
    //check cache for missing/depend    
    for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
      EEDB::DataSource* source = (*it).second;
      if(source->classname() == EEDB::FeatureSource::class_name) {
        _dynamic_edge_source(source);        
      }
    }
  }
}


void EEDB::SPStreams::SubfeaturesToEdges::_stream_data_sources(string classname, string filter_logic) { 
  // first check if we need to reload
  _reload_stream_data_sources();
  //fprintf(stderr, "SubfeaturesToEdges::_stream_data_sources  cache-size %ld\n", _dynamic_edgesource_hash.size());
  
  map<string, EEDB::EdgeSource*>::iterator it;
  if(!_dynamic_edgesource_hash.empty()) {
    if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }
    _source_streambuffer = new EEDB::SPStreams::StreamBuffer();
    
    for(it = _dynamic_edgesource_hash.begin(); it != _dynamic_edgesource_hash.end(); it++) {
      EEDB::DataSource* source = (*it).second;
      if(source == NULL) { continue; }
      source->retain();
      _source_streambuffer->add_object(source);
    }
  }
  
  //then pass down the stream
  if(source_stream() != NULL) { source_stream()->stream_data_sources(classname, filter_logic); }
}


void EEDB::SPStreams::SubfeaturesToEdges::_cache_datasource(EEDB::DataSource* source) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  
  if(source == NULL) { return; }
  if(!source->is_active()) { return; }
  string dbid = source->db_id();
  search_it = _sources_cache.find(dbid);
  if(search_it == _sources_cache.end()) { 
    source->retain();
    _sources_cache[dbid] = source;
    //fprintf(stderr, "cache source: %s\n", source->simple_xml().c_str());
  }
}



/******************************************************************************/


void EEDB::SPStreams::SubfeaturesToEdges::_xml(string &xml_buffer) {
  //char buffer[256];
  _xml_start(xml_buffer);  //from superclass
  
  xml_buffer.append("<mode>"+_mode+"</mode>");
    
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  if(_transfer_expression) { xml_buffer.append("<transfer_expression>true</transfer_expression>"); }
  else { xml_buffer.append("<transfer_expression>false</transfer_expression>"); }
  
  if(_transfer_metadata) { xml_buffer.append("<transfer_metadata>true</transfer_metadata>"); }
  else { xml_buffer.append("<transfer_metadata>false</transfer_metadata>"); }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::SubfeaturesToEdges::SubfeaturesToEdges(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  //rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("category_filter")) != NULL) { 
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }
  
  _transfer_expression = false;
  if((node = root_node->first_node("transfer_expression")) != NULL) { 
    if(string(node->value()) == "true") { _transfer_expression=true; }
  }
  
  _transfer_metadata = false;
  if((node = root_node->first_node("transfer_metadata")) != NULL) { 
    if(string(node->value()) == "true") { _transfer_metadata=true; }
  }
}

