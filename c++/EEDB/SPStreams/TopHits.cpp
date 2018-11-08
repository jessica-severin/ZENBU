/* $Id: TopHits.cpp,v 1.6 2013/04/08 07:36:16 severin Exp $ */

/***

NAME - EEDB::SPStreams::TopHits

SYNOPSIS

DESCRIPTION

module which keeps a fixed size buffer of highest significance features 
 
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
#include <EEDB/Symbol.h>
#include <EEDB/Feature.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/TopHits.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::TopHits::class_name = "EEDB::SPStreams::TopHits";

//function prototypes
void _spstream_tophit_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::TopHits*)obj;
}
MQDB::DBObject* _spstream_tophit_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::TopHits*)node)->_next_in_stream();
}
void _spstream_tophit_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::TopHits*)node)->_reset_stream_node();
}
void _spstream_tophit_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::TopHits*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::TopHits::TopHits() {
  init();
}

EEDB::SPStreams::TopHits::~TopHits() {
}

void EEDB::SPStreams::TopHits::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::TopHits::class_name;
  _module_name               = "TopHits";

  _funcptr_delete            = _spstream_tophit_delete_func;
  _funcptr_xml               = _spstream_tophit_xml_func;
  _funcptr_simple_xml        = _spstream_tophit_xml_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_tophit_next_in_stream_func;
  _funcptr_reset_stream_node      = _spstream_tophit_reset_stream_node_func;

  //attribute variables
  _queue_length = 25;
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::TopHits::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass
  
  char buffer[256];
  snprintf(buffer, 256, "<queue_length>%ld</queue_length>", _queue_length);
  xml_buffer.append(buffer);    

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::TopHits::TopHits(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("queue_length")) != NULL) {
    if((attr = node->first_attribute("value"))) {
      _queue_length = strtol(attr->value(), NULL, 10);
    } else {
      _queue_length = strtol(node->value(), NULL, 10);
    }
  }
}


void EEDB::SPStreams::TopHits::_reset_stream_node() {
  for(unsigned int i=0; i<_tophit_queue.size(); i++) {
    _tophit_queue[i]->release();
  }
  _tophit_queue.clear();
}

       
bool tophits_sort_func (EEDB::Feature *a, EEDB::Feature *b) { 
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  return (a->significance() > b->significance());
}


MQDB::DBObject* EEDB::SPStreams::TopHits::_next_in_stream() {
  MQDB::DBObject *obj;
  
  EEDB::Feature *feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }

  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature objects are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      //process all features into tophit queue
      feature = (EEDB::Feature*)obj;
      if(_tophit_queue.size() < _queue_length) {
        _tophit_queue.push_back(feature);
        sort(_tophit_queue.begin(), _tophit_queue.end(), tophits_sort_func);
      } else {
        if(tophits_sort_func(_tophit_queue.back(), feature)) {
          //new feature is less than smallest element in queue so throw it out
          feature->release();
        } else {
          _tophit_queue.push_back(feature);
          sort(_tophit_queue.begin(), _tophit_queue.end(), tophits_sort_func);
          feature = _tophit_queue.back();
          _tophit_queue.pop_back();
          feature->release();
        }
      }
    }
  }
  
  //put the tophits into a resort buffer
  for(unsigned int i=0; i<_tophit_queue.size(); i++) {
    _feature_buffer.insert_feature(_tophit_queue[i]); 
  }
  _tophit_queue.clear();  
  _feature_buffer.transfer_all_to_completed();
  
  // return next completed feature if available
  feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }  
  return NULL; 
}


