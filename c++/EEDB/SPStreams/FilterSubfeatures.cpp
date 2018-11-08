/* $Id: FilterSubfeatures.cpp,v 1.3 2013/11/26 08:48:49 severin Exp $ */

/***

NAME - EEDB::SPStreams::FilterSubfeatures

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
#include <EEDB/SPStreams/FilterSubfeatures.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::FilterSubfeatures::class_name = "EEDB::SPStreams::FilterSubfeatures";

//function prototypes
void _spstream_filtersubfeatures_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::FilterSubfeatures*)obj;
}
MQDB::DBObject* _spstream_filtersubfeatures_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::FilterSubfeatures*)node)->_next_in_stream();
}
void _spstream_filtersubfeatures_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FilterSubfeatures*)node)->_reset_stream_node();
}
void _spstream_filtersubfeatures_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::FilterSubfeatures*)obj)->_xml(xml_buffer);
}
string _spstream_filtersubfeatures_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::FilterSubfeatures*)obj)->_display_desc();
}
bool _spstream_filtersubfeatures_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::FilterSubfeatures*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}

////////////////////////////////////////////////////////////////////////////
//
// creation methods
//
////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::FilterSubfeatures::FilterSubfeatures() {
  init();
}

EEDB::SPStreams::FilterSubfeatures::~FilterSubfeatures() {
}

void EEDB::SPStreams::FilterSubfeatures::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::FilterSubfeatures::class_name;
  _module_name               = "FilterSubfeatures";
  _funcptr_delete            = _spstream_filtersubfeatures_delete_func;
  _funcptr_xml               = _spstream_filtersubfeatures_xml_func;
  _funcptr_simple_xml        = _spstream_filtersubfeatures_xml_func;
  _funcptr_display_desc      = _spstream_filtersubfeatures_display_desc_func;

  _funcptr_next_in_stream           = _spstream_filtersubfeatures_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_filtersubfeatures_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_filtersubfeatures_stream_by_named_region_func;
  
  _region_start        = -1;
  _region_end          = -1;

  _feature_buffer.unique_features(false);
  _feature_buffer.match_category(false);
  _feature_buffer.match_source(false);
  _feature_buffer.expression_mode(CL_SUM);
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::FilterSubfeatures::_display_desc() {
  string str = "FilterSubfeatures";
  return str;
}


void EEDB::SPStreams::FilterSubfeatures::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::FilterSubfeatures::FilterSubfeatures(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("category_filter")) != NULL) { 
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }  
}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::FilterSubfeatures::_next_in_stream() {
  MQDB::DBObject *obj;
  
  EEDB::Feature *feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature\expression objects are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      _process_feature((EEDB::Feature*)obj);

      feature = _feature_buffer.next_completed_feature();
      if(feature) { return feature; }
    }
  }
  
  // input stream is empty so move all _subfeature_buffer into _completed_subfeatures
  _feature_buffer.transfer_all_to_completed();
    
  // return next completed feature if available
  feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }  
  return NULL; 
}


void EEDB::SPStreams::FilterSubfeatures::_reset_stream_node() {  
  _feature_buffer.reset();
  _region_start        = -1;
  _region_end          = -1;
}


bool EEDB::SPStreams::FilterSubfeatures::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  //fprintf(stderr,"FilterSubfeatures::_stream_by_named_region %s %d .. %d\n", chrom_name.c_str(), start,_region_end);
  return EEDB::SPStream::_stream_by_named_region(assembly_name, chrom_name, start, end);
}


//
////////////////////////////////////////////////////////////
//


void EEDB::SPStreams::FilterSubfeatures::_process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return; }
  
  vector<EEDB::Feature*> subfeatures = feature->subfeatures();
  if(subfeatures.empty()) { 
    //option here to put the primary feature on the buffer 
    //if there are no subfeatures
    feature->release();
    return; 
  }

  // check if we are finished with features on the head of the _feature_buffer
  _feature_buffer.transfer_completed(feature->chrom_start());
    
  // find the valid subfeatures which we can output
  vector<EEDB::Feature*> valid_subfeats;
  for(unsigned int i=0; i<subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = subfeatures[i];
    
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
        
    subfeat->retain();
    valid_subfeats.push_back(subfeat);
  }
  if(valid_subfeats.empty()) { feature->release(); return; }
  
  //rebuild the feature with valid subfeatures and resize
  feature->clear_subfeatures();
  for(unsigned int i=0; i<valid_subfeats.size(); i++) { 
    EEDB::Feature *subfeat = valid_subfeats[i];        
    feature->add_subfeature(subfeat);
    subfeat->release(); //since feature now retains it
    if(i==0) {
      feature->chrom_start(subfeat->chrom_start());
      feature->chrom_end(subfeat->chrom_end());
    } else {
      if(subfeat->chrom_start() < feature->chrom_start()) {
        feature->chrom_start(subfeat->chrom_start());
      }
      if(subfeat->chrom_end() > feature->chrom_end()) {
        feature->chrom_end(subfeat->chrom_end());
      }
    }
  }
  
  if((_region_start>0) && (feature->chrom_end() < _region_start)) { feature->release(); return; }
  if((_region_end>0) && (feature->chrom_start() > _region_end)) { feature->release(); return; }

  _feature_buffer.insert_feature(feature);
}


