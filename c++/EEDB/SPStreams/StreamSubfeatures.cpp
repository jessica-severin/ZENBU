/* $Id: StreamSubfeatures.cpp,v 1.17 2013/11/26 08:50:48 severin Exp $ */

/***

NAME - EEDB::SPStreams::StreamSubfeatures

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
#include <EEDB/SPStreams/StreamSubfeatures.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::StreamSubfeatures::class_name = "EEDB::SPStreams::StreamSubfeatures";

//function prototypes
void _spstream_streamsubfeatures_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::StreamSubfeatures*)obj;
}
MQDB::DBObject* _spstream_streamsubfeatures_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::StreamSubfeatures*)node)->_next_in_stream();
}
void _spstream_streamsubfeatures_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::StreamSubfeatures*)node)->_reset_stream_node();
}
void _spstream_streamsubfeatures_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::StreamSubfeatures*)obj)->_xml(xml_buffer);
}
string _spstream_streamsubfeatures_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::StreamSubfeatures*)obj)->_display_desc();
}
bool _spstream_streamsubfeatures_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::StreamSubfeatures*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}

////////////////////////////////////////////////////////////////////////////
//
// creation methods
//
////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::StreamSubfeatures::StreamSubfeatures() {
  init();
}

EEDB::SPStreams::StreamSubfeatures::~StreamSubfeatures() {
}

void EEDB::SPStreams::StreamSubfeatures::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::StreamSubfeatures::class_name;
  _module_name               = "StreamSubfeatures";
  _funcptr_delete            = _spstream_streamsubfeatures_delete_func;
  _funcptr_xml               = _spstream_streamsubfeatures_xml_func;
  _funcptr_simple_xml        = _spstream_streamsubfeatures_xml_func;
  _funcptr_display_desc      = _spstream_streamsubfeatures_display_desc_func;

  _funcptr_next_in_stream           = _spstream_streamsubfeatures_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_streamsubfeatures_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_streamsubfeatures_stream_by_named_region_func;
  
  _transfer_expression = false;
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

string EEDB::SPStreams::StreamSubfeatures::_display_desc() {
  string str = "StreamSubfeatures";
  return str;
}


void EEDB::SPStreams::StreamSubfeatures::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  if(_transfer_expression) { xml_buffer.append("<transfer_expression>true</transfer_expression>"); }
  
  if(_feature_buffer.unique_features()) {
    xml_buffer += "<unique>";
    _feature_buffer.xml(xml_buffer);
    xml_buffer += "</unique>";
  }
    
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::StreamSubfeatures::StreamSubfeatures(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node, *node2;
  rapidxml::xml_attribute<> *attr;
  
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
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _transfer_expression=true;
    }
  }
  
  // unique control section
  _feature_buffer.unique_features(false);
  if((node2 = root_node->first_node("unique")) != NULL) { 
    _feature_buffer.init_xml(node2);
    _feature_buffer.unique_features(true);
  }
}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::StreamSubfeatures::_next_in_stream() {
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


void EEDB::SPStreams::StreamSubfeatures::_reset_stream_node() {  
  _feature_buffer.reset();
  _region_start        = -1;
  _region_end          = -1;
}


bool EEDB::SPStreams::StreamSubfeatures::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  //fprintf(stderr,"StreamSubfeatures::_stream_by_named_region %s %d .. %d\n", chrom_name.c_str(), start,_region_end);
  return EEDB::SPStream::_stream_by_named_region(assembly_name, chrom_name, start, end);
}


//
////////////////////////////////////////////////////////////
//


void EEDB::SPStreams::StreamSubfeatures::_process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return; }
  
  vector<EEDB::Feature*> subfeatures = feature->subfeatures();
  if(subfeatures.empty()) { 
    //option here to put the primary feature on the buffer 
    //if there are no subfeatures
    feature->release();
    return; 
  }

  // check if we are finished with subfeatures on the head of the _subfeature_buffer
  _feature_buffer.transfer_completed(feature->chrom_start());
    
  // find the valid subfeatures which we can output
  vector<EEDB::Feature*> valid_subfeats;
  for(unsigned int i=0; i<subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = subfeatures[i];
    
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
    
    if((_region_start>0) && (subfeat->chrom_end() < _region_start)) { continue; }
    if((_region_end>0) && (subfeat->chrom_start() > _region_end)) { continue; }
    
    valid_subfeats.push_back(subfeat);
  }
  if(valid_subfeats.empty()) { feature->release(); return; }
  
  //adjust duplication factor
  if(_transfer_expression) {
     vector<EEDB::Expression*> expression = feature->expression_array();
     for(unsigned int j=0; j<expression.size(); j++) { 
       expression[j]->duplication_adjust(valid_subfeats.size());
     }
  }
  
  // move the valid_subfeats to the resort buffer
  for(unsigned int i=0; i<valid_subfeats.size(); i++) { 
    EEDB::Feature *subfeat = valid_subfeats[i];
        
    subfeat->retain(); //because the feature will later be released
    if(_transfer_expression) {
      vector<EEDB::Expression*> expression = feature->expression_array();
      for(unsigned int j=0; j<expression.size(); j++) { subfeat->copy_expression(expression[j]); }      
    }
    _feature_buffer.insert_feature(subfeat); 
  }
  
  //finished with feature
  feature->release();  
}


