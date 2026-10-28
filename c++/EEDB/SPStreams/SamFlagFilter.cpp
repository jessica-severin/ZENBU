/* $Id: SamFlagFilter.cpp,v 1.1 2023/12/13 05:37:04 severin Exp $ */

/***

NAME - EEDB::SPStreams::SamFlagFilter

SYNOPSIS

DESCRIPTION

 A simple signal procesor which will filter features based on their sam:flag metadata

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * ZENBU system
 * copyright (c) 2007-2023 Jessica Severin RIKEN
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
#include <EEDB/SPStreams/SamFlagFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::SamFlagFilter::class_name = "EEDB::SPStreams::SamFlagFilter";

//function prototypes
void _spstream_samflagfilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::SamFlagFilter*)obj;
}
MQDB::DBObject* _spstream_samflagfilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::SamFlagFilter*)node)->_next_in_stream();
}
void _spstream_samflagfilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::SamFlagFilter*)obj)->_xml(xml_buffer);
}
string _spstream_samflagfilter_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::SamFlagFilter*)obj)->_display_desc();
}


EEDB::SPStreams::SamFlagFilter::SamFlagFilter() {
  init();
}

EEDB::SPStreams::SamFlagFilter::~SamFlagFilter() {
}

void EEDB::SPStreams::SamFlagFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::SamFlagFilter::class_name;
  _module_name               = "SamFlagFilter";
  _funcptr_delete            = _spstream_samflagfilter_delete_func;
  _funcptr_xml               = _spstream_samflagfilter_xml_func;
  _funcptr_simple_xml        = _spstream_samflagfilter_xml_func;
  _funcptr_display_desc      = _spstream_samflagfilter_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_samflagfilter_next_in_stream_func;

  //attribute variables
  _flags_mask = 0;
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::SamFlagFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  char buffer[256];
  if(_flags_mask != '\0') {
    snprintf(buffer, 256, "<mask>%ld</mask>", _flags_mask);
    xml_buffer.append(buffer);
  }
  if(_invert) { xml_buffer.append("<invert>true</invert>"); }
  else { xml_buffer.append("<invert>false</invert>"); }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::SamFlagFilter::SamFlagFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("mask")) != NULL) {
    _flags_mask = strtol(node->value(), NULL, 10);
    fprintf(stderr, "SamFlagFilter [%s]  mask:%ld\n", node->value(),_flags_mask);
  }
  
  _invert = false;
  if((node = root_node->first_node("invert")) != NULL) { 
    if(string(node->value()) == "true") { _invert=true; }
    else { _invert=false; }
  }

}

string EEDB::SPStreams::SamFlagFilter::_display_desc() {
  char buffer[256];
  snprintf(buffer, 256, "SamFlagFilter [%ld]", _flags_mask);
  string rtn = buffer;
  if(_invert) { rtn += "invert"; }
  
  return rtn;
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::SamFlagFilter::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj;
  while((obj = _source_stream->next_in_stream()) != NULL) {

    //non-feature objects are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    
    EEDB::MetadataSet *mdset = feature->metadataset();
     
    bool ok = _check_metadataset(mdset);
    if(ok == !_invert) { return obj; }

    //continue to next feature in the stream
    obj->release();
  }

  // input stream is empty so done
  return NULL;
}


bool EEDB::SPStreams::SamFlagFilter::_check_metadataset(EEDB::MetadataSet *mdset) {
  if(!mdset) { return false; }
  
  EEDB::Metadata *md = mdset->find_metadata("sam:flags", "");
  if(!md) { return false; } //must have sam:flags to pass filter
  
  long flags = strtol(md->data().c_str(), NULL, 10);
  
  if((flags & _flags_mask) == _flags_mask) {
    //bitwise & to mask, if matches the mask then all bits are set
    return true;
  }

  return false;  //defaults to fail unless matches are found
}





