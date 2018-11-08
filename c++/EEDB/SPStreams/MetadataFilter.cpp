/* $Id: MetadataFilter.cpp,v 1.8 2013/04/08 07:38:17 severin Exp $ */

/***

NAME - EEDB::SPStreams::MetadataFilter

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
#include <EEDB/SPStreams/MetadataFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::MetadataFilter::class_name = "EEDB::SPStreams::MetadataFilter";

//function prototypes
void _spstream_metadatafilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MetadataFilter*)obj;
}
MQDB::DBObject* _spstream_metadatafilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MetadataFilter*)node)->_next_in_stream();
}
void _spstream_metadatafilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::MetadataFilter*)obj)->_xml(xml_buffer);
}

EEDB::SPStreams::MetadataFilter::MetadataFilter() {
  init();
}

EEDB::SPStreams::MetadataFilter::~MetadataFilter() {
}

void EEDB::SPStreams::MetadataFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::MetadataFilter::class_name;
  _module_name               = "MetadataFilter";
  _funcptr_delete            = _spstream_metadatafilter_delete_func;
  _funcptr_xml               = _spstream_metadatafilter_xml_func;
  _funcptr_simple_xml        = _spstream_metadatafilter_xml_func;

  //function pointer code
  _funcptr_next_in_stream    = _spstream_metadatafilter_next_in_stream_func;

  //attribute variables
  _inverse      = false;
  _filter_logic = "";
  _mdset_mode   = FEATURE;  
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::MetadataFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  if(_inverse) { xml_buffer.append("<inverse>true</inverse>"); }
  if(!_filter_logic.empty()) { xml_buffer.append("<filter>" + _filter_logic + "</filter>"); }

  switch(_mdset_mode) {
    case FEATURE:       xml_buffer.append("<mdata_mode>feature</mdata_mode>"); break;
    case FEATURESOURCE: xml_buffer.append("<mdata_mode>featuresource</mdata_mode>"); break;
    case EXPERIMENT:    xml_buffer.append("<mdata_mode>experiment</mdata_mode>"); break;
    case ALL:           xml_buffer.append("<mdata_mode>all</mdata_mode>"); break;
    case ANY:           xml_buffer.append("<mdata_mode>any</mdata_mode>"); break;
  }
  
  for(unsigned int i=0; i<_specific_mdata.size(); i++) {
    _specific_mdata[i]->xml(xml_buffer);
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::MetadataFilter::MetadataFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }
  
  _inverse = false;
  if((node = root_node->first_node("inverse")) != NULL) { 
    if(string(node->value()) == "true") { _inverse=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _inverse=true;
    }
  }
  
  _filter_logic.clear();
  if((node = root_node->first_node("filter")) != NULL) { 
    _filter_logic = node->value();
  }
  
  _mdset_mode = FEATURE;
  if((node = root_node->first_node("mdata_mode")) != NULL) { 
    if(string(node->value()) == "feature") { _mdset_mode = FEATURE; }
    if(string(node->value()) == "featuresource") { _mdset_mode = FEATURESOURCE; }
    if(string(node->value()) == "experiment") { _mdset_mode = EXPERIMENT; }
    if(string(node->value()) == "all") { _mdset_mode = ALL; }
    if(string(node->value()) == "any") { _mdset_mode = ANY; }
  }

  _specific_mdata.clear();
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      if(mdata) { _specific_mdata.push_back(mdata); }
      node = node->next_sibling("mdata");
    }    
  }
    
}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::MetadataFilter::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj;
  while((obj = _source_stream->next_in_stream()) != NULL) {

    //non-feature objects are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    EEDB::Feature*             feature = (EEDB::Feature*)obj;
    EEDB::MetadataSet*         mdset = NULL;
    vector<EEDB::Expression*>  expression;

    //if object passes overlap-test, return it
    bool ok = false;
    switch(_mdset_mode) {
      case FEATURE:
        mdset = feature->metadataset();
        if(_check_metadataset(mdset)) { ok = true; break; }
        break;
        
      case FEATURESOURCE:
        if(feature->feature_source()) {
          mdset = feature->feature_source()->metadataset();
          if(_check_metadataset(mdset)) { ok = true; break; }
        }
        break;
        
      case EXPERIMENT:
        expression = feature->expression_array();
        for(unsigned int i=0; i<expression.size(); i++) {
          EEDB::Experiment *exp = expression[i]->experiment();
          if(exp == NULL) { continue; }
          mdset = exp->metadataset();
          if(_check_metadataset(mdset)) { ok = true; break; }
        }
        break;
        
      case ALL:
        ok = true; //need to check backwards
        mdset = feature->metadataset();
        if(!_check_metadataset(mdset)) { ok = false; break; }
        if(feature->feature_source()) {
          mdset = feature->feature_source()->metadataset();
          if(!_check_metadataset(mdset)) { ok = false; break; }
        }
        expression = feature->expression_array();
        for(unsigned int i=0; i<expression.size(); i++) {
          EEDB::Experiment *exp = expression[i]->experiment();
          if(exp == NULL) { continue; }
          mdset = exp->metadataset();
          if(!_check_metadataset(mdset)) { ok = false; break; }
        }        
        break;
                
      case ANY:
        mdset = feature->metadataset();
        if(_check_metadataset(mdset)) { ok = true; break; }
        if(feature->feature_source()) {
          mdset = feature->feature_source()->metadataset();
          if(_check_metadataset(mdset)) { ok = true; break; }
        }
        expression = feature->expression_array();
        for(unsigned int i=0; i<expression.size(); i++) {
          EEDB::Experiment *exp = expression[i]->experiment();
          if(exp == NULL) { continue; }
          mdset = exp->metadataset();
          if(_check_metadataset(mdset)) { ok = true; break; }
        }        
        break;
    }
    
    if(ok == !_inverse) { return obj; }
    obj->release();
  }

  // input stream is empty so done
  return NULL;
}

//
////////////////////////////////////////////////////////////
//

/*matching metadata. inverse option, filter-logic option, 
 options to check metadata of the Feature or the associated FeatureSource and/or Experiments*/

bool EEDB::SPStreams::MetadataFilter::_check_metadataset(EEDB::MetadataSet *mdset) {
  if(!mdset) { return false; }
  
  if(!_filter_logic.empty()) {    
    if(mdset->check_by_filter_logic(_filter_logic)) { return true; }
  }

  //specific mdata tests for presence of any of these in the metadata set
  for(unsigned int i=0; i<_specific_mdata.size(); i++) {
    EEDB::Metadata *md = _specific_mdata[i];
    if(mdset->find_metadata(md->type(), md->data()) != NULL) { return true; }
  }
  
  return false;  //defaults to fail unless matches are found
}



