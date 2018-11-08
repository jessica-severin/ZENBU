/* $Id: UniqueFeature.cpp,v 1.13 2013/04/08 07:36:16 severin Exp $ */

/***

NAME - EEDB::SPStreams::UniqueFeature

SYNOPSIS

DESCRIPTION

 A stream module which will compress features on a stream into unique ones.
 Unique is always defined as equal start/end, but with additional options
 to allow more refined uniqueness (featuresource, category, strand, metadata...)
 
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
#include <EEDB/SPStreams/UniqueFeature.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::UniqueFeature::class_name = "EEDB::SPStreams::UniqueFeature";

//function prototypes
void _spstream_uniquefeature_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::UniqueFeature*)obj;
}
MQDB::DBObject* _spstream_uniquefeature_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::UniqueFeature*)node)->_next_in_stream();
}
void _spstream_uniquefeature_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::UniqueFeature*)node)->_reset_stream_node();
}
void _spstream_uniquefeature_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::UniqueFeature*)obj)->_xml(xml_buffer);
}
string _spstream_uniquefeature_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::UniqueFeature*)obj)->_display_desc();
}


EEDB::SPStreams::UniqueFeature::UniqueFeature() {
  init();
}

EEDB::SPStreams::UniqueFeature::~UniqueFeature() {
}

void EEDB::SPStreams::UniqueFeature::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::UniqueFeature::class_name;
  _module_name               = "UniqueFeature";
  _funcptr_delete            = _spstream_uniquefeature_delete_func;
  _funcptr_xml               = _spstream_uniquefeature_xml_func;
  _funcptr_simple_xml        = _spstream_uniquefeature_xml_func;
  _funcptr_display_desc      = _spstream_uniquefeature_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream     = _spstream_uniquefeature_next_in_stream_func;
  _funcptr_reset_stream_node  = _spstream_uniquefeature_reset_stream_node_func;

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

string EEDB::SPStreams::UniqueFeature::_display_desc() {
  string str = "UniqueFeature";
  return str;
}


void EEDB::SPStreams::UniqueFeature::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  _feature_buffer.xml(xml_buffer);

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::UniqueFeature::UniqueFeature(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  
  if(string(root_node->name()) != "spstream") { return; }  
  
  _feature_buffer.init_xml(root_node);
  _feature_buffer.unique_features(true);
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::UniqueFeature::_next_in_stream() {
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


void EEDB::SPStreams::UniqueFeature::_reset_stream_node() {  
  _feature_buffer.reset();
  _region_start        = -1;
  _region_end          = -1;
}


//
////////////////////////////////////////////////////////////
//


void EEDB::SPStreams::UniqueFeature::_process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return; }
    
  // check if we are finished with subfeatures on the head of the _subfeature_buffer
  _feature_buffer.transfer_completed(feature->chrom_start());

  if((_region_start>0) && (feature->chrom_end()   < _region_start)) {
    feature->release();
    return; 
  }
  if((_region_end>0) && (feature->chrom_start() > _region_end)) { 
    feature->release();
    return; 
  }
  
  _feature_buffer.insert_feature(feature);   
}



