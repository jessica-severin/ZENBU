/* $Id: ResizeFeatures.cpp,v 1.8 2012/10/02 06:12:42 severin Exp $ */

/***

NAME - EEDB::SPStreams::ResizeFeatures

SYNOPSIS

DESCRIPTION

 A stream module which will convert features with subfeatures into a stream of 
 sorted subfeatures. other classes are simply passed through the module.
 features without subfeatures are optionally passed through the module.

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2009 Jessica Severin RIKEN OSC
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
#include <EEDB/SPStreams/ResizeFeatures.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::ResizeFeatures::class_name = "EEDB::SPStreams::ResizeFeatures";

//function prototypes
void _spstream_resizefeatures_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::ResizeFeatures*)obj;
}
MQDB::DBObject* _spstream_resizefeatures_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::ResizeFeatures*)node)->_next_in_stream();
}
void _spstream_resizefeatures_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ResizeFeatures*)node)->_reset_stream_node();
}
void _spstream_resizefeatures_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::ResizeFeatures*)obj)->_xml(xml_buffer);
}
string _spstream_resizefeatures_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::ResizeFeatures*)obj)->_display_desc();
}


EEDB::SPStreams::ResizeFeatures::ResizeFeatures() {
  init();
}

EEDB::SPStreams::ResizeFeatures::~ResizeFeatures() {
}

void EEDB::SPStreams::ResizeFeatures::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::ResizeFeatures::class_name;
  _module_name               = "ResizeFeatures";
  _funcptr_delete            = _spstream_resizefeatures_delete_func;
  _funcptr_xml               = _spstream_resizefeatures_xml_func;
  _funcptr_simple_xml        = _spstream_resizefeatures_xml_func;
  _funcptr_display_desc      = _spstream_resizefeatures_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream     = _spstream_resizefeatures_next_in_stream_func;
  _funcptr_reset_stream_node  = _spstream_resizefeatures_reset_stream_node_func;

  _feature_stream_empty = false;
  _mode = ""; //undefined
  _expansion = 0;
  _retain_subfeatures = false;
  _feature_buffer.clear();
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::ResizeFeatures::_display_desc() {
  string str = "ResizeFeatures";
  return str;
}


void EEDB::SPStreams::ResizeFeatures::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  if(!_feat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_feat_filter_categories.begin(); it!=_feat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  if(!_mode.empty()) { xml_buffer.append("<mode>"+_mode+"</mode>"); }
  
  if(_retain_subfeatures) { xml_buffer.append("<retain_subfeatures>true</retain_subfeatures>"); }
  
  char buffer[256];
  snprintf(buffer, 256, "<expand>%ld</expand>", _expansion);
  xml_buffer.append(buffer);
    
  //older style of <ignore_strand value="1" />
  //if(_overlap_state==false) { xml_buffer.append("<inverse>true</inverse>"); }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::ResizeFeatures::ResizeFeatures(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("category_filter")) != NULL) { 
    while(node) {
      string category = node->value();
      _feat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }

  if((node = root_node->first_node("mode")) != NULL) { 
    _mode = node->value();
  }
  
  if((node = root_node->first_node("expand")) != NULL) {
    _expansion = labs(strtol(node->value(), NULL, 10));
  }
    
  _retain_subfeatures = false;
  if((node = root_node->first_node("retain_subfeatures")) != NULL) { 
    if(string(node->value()) == "true") { _retain_subfeatures=true; }
  }  
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::ResizeFeatures::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(!_completed_features.empty()) {
    EEDB::Feature* feat = _completed_features.front();
    _completed_features.pop_front();
    return feat; 
  }
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature objects on the primary source stream
      //are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      //if feat is returned then we know we have some completed features
      EEDB::Feature *feat = _process_feature((EEDB::Feature*)obj);
      if(feat!=NULL) { return feat; }
    }
  }
  
  // input stream is empty so move all _feature_buffer into _completed_features
  while(!_feature_buffer.empty()) {
    EEDB::Feature* feat = _feature_buffer.front();
    _feature_buffer.pop_front();
    if(feat!=NULL) { _completed_features.push_back(feat); }
  }
    
  // return finished clusters now
  if(!_completed_features.empty()) {
    EEDB::Feature* feat = _completed_features.front();
    _completed_features.pop_front();
    return feat; 
  }
  
  return NULL; 
}


/***** reset_stream_node
 Description: re-initialize this stream node prior to reconfiguring stream
 *****/

void EEDB::SPStreams::ResizeFeatures::_reset_stream_node() {  
  for(unsigned int i=0; i<_feature_buffer.size(); i++) {
    _feature_buffer[i]->release();
  }
  _completed_features.clear();
  _feature_buffer.clear();
  _feature_stream_empty = false;
}



//
////////////////////////////////////////////////////////////
//

bool _spstream_resizefeatures_feature_sort_func (EEDB::Feature *a, EEDB::Feature *b) { 
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->chrom_start() < b->chrom_start()) { return true; }
  if((a->chrom_start() == b->chrom_start()) && 
     (a->chrom_end() < b->chrom_end())) { return true; }
  return false;
}



EEDB::Feature* EEDB::SPStreams::ResizeFeatures::_process_feature(EEDB::Feature* feature) {
  //final post processing of feat prior to returning
  if(feature==NULL) { return NULL; }

  string mode = _mode;  
  EEDB::FeatureSource *fsrc = feature->feature_source();
  if(fsrc && !_feat_filter_categories.empty() && !_feat_filter_categories[fsrc->category()]) { 
    // not in the categories of Features we should manipulate so change mode to nothing
    mode = "";
  }
  
  // subfeatures are not valid after resizing
  if(!_retain_subfeatures) {
    feature->clear_subfeatures(); 
  }
    
  //
  // check if we are finished with features on the head of the _feature_buffer
  //
  if(!_feature_buffer.empty()) {
    EEDB::Feature  *feat = _feature_buffer.front();
    while((feat!=NULL) and (feat->chrom_end() < (feature->chrom_start() - _expansion))) { 
      _feature_buffer.pop_front();
      _completed_features.push_back(feat);
      if(_feature_buffer.empty()) { feat = NULL; }
      else { feat = _feature_buffer.front(); }
    }
  }
  
  
  //
  // process the current feature and sort into the _feature_buffer
  //
  long int  start = feature->chrom_start();
  long int  end   = feature->chrom_end();

  if(mode == "shrink_start") {
    feature->chrom_end(start);
  }
  if(mode == "shrink_end") {
    feature->chrom_start(end);
  }
  if(mode == "shrink_5prime") {
    if(feature->strand() == '+') { feature->chrom_end(start); }
    if(feature->strand() == '-') { feature->chrom_start(end); }
  }
  if(mode == "shrink_3prime") {
    if(feature->strand() == '+') { feature->chrom_start(end); }
    if(feature->strand() == '-') { feature->chrom_end(start); }
  }

  if(mode == "expand_start") {
    feature->chrom_start(start - _expansion);
  }
  if(mode == "expand_end") {
    feature->chrom_end(end + _expansion);
  }
  if(mode == "expand_5prime") {
    if(feature->strand() == '+') { feature->chrom_start(start - _expansion); }
    if(feature->strand() == '-') { feature->chrom_end(end + _expansion); }
  }
  if(mode == "expand_3prime") {
    if(feature->strand() == '+') { feature->chrom_end(end + _expansion); }
    if(feature->strand() == '-') { feature->chrom_start(start - _expansion); }
  }
  if(mode == "store") {
    _store_original_coords(feature); 
  }   
  if(mode == "restore") {
    _restore_original_coords(feature);
  }
  
  _feature_buffer.push_back(feature); 
  
  //do simple resorting of the _feature_buffer
  sort(_feature_buffer.begin(), _feature_buffer.end(), _spstream_resizefeatures_feature_sort_func);
  
  // return a completed feature if possible
  if(!_completed_features.empty()) {
    EEDB::Feature *feat = _completed_features.front();
    _completed_features.pop_front();
    return feat;
  }  
  return NULL;
}


void  EEDB::SPStreams::ResizeFeatures::_store_original_coords(EEDB::Feature* feature) {
  if(!feature) { return; }

  //clear previous _orig_coord_xxx metadata
  feature->metadataset()->remove_metadata_like("orig_coord_start", "");
  feature->metadataset()->remove_metadata_like("orig_coord_end", "");
  feature->metadataset()->remove_metadata_like("orig_coord_strand", "");
  
  char buffer[2048];
  snprintf(buffer, 2040,"%ld", feature->chrom_start());
  feature->metadataset()->add_tag_data("orig_coord_start", buffer);

  snprintf(buffer, 2040,"%ld", feature->chrom_end());
  feature->metadataset()->add_tag_data("orig_coord_end", buffer);
  
  snprintf(buffer, 2040,"%c", feature->strand());
  feature->metadataset()->add_tag_data("orig_coord_strand", buffer);
}


void  EEDB::SPStreams::ResizeFeatures::_restore_original_coords(EEDB::Feature* feature) {
  if(!feature) { return; }
  
  EEDB::Metadata *md;
  md = feature->metadataset()->find_metadata("orig_coord_start","");
  if(md) { feature->chrom_start(strtol(md->data().c_str(), NULL, 10)); }

  md = feature->metadataset()->find_metadata("orig_coord_end","");
  if(md) { feature->chrom_end(strtol(md->data().c_str(), NULL, 10)); }

  md = feature->metadataset()->find_metadata("orig_coord_strand","");
  if(md) { 
    char strand =' ';
    if(!md->data().empty()) { strand = md->data()[0]; }
    feature->strand(strand);
  }
  
  //clear previous _orig_coord_xxx metadata
  feature->metadataset()->remove_metadata_like("orig_coord_start", "");
  feature->metadataset()->remove_metadata_like("orig_coord_end", "");
  feature->metadataset()->remove_metadata_like("orig_coord_strand", "");  
}

