/* $Id: StrandFilter.cpp,v 1.1 2014/11/27 05:01:54 severin Exp $ */

/***

NAME - EEDB::SPStreams::StrandFilter

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
#include <EEDB/SPStreams/StrandFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::StrandFilter::class_name = "EEDB::SPStreams::StrandFilter";

//function prototypes
void _spstream_strandfilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::StrandFilter*)obj;
}
MQDB::DBObject* _spstream_strandfilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::StrandFilter*)node)->_next_in_stream();
}
void _spstream_strandfilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::StrandFilter*)obj)->_xml(xml_buffer);
}
string _spstream_strandfilter_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::StrandFilter*)obj)->_display_desc();
}


EEDB::SPStreams::StrandFilter::StrandFilter() {
  init();
}

EEDB::SPStreams::StrandFilter::~StrandFilter() {
}

void EEDB::SPStreams::StrandFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::StrandFilter::class_name;
  _module_name               = "StrandFilter";
  _funcptr_delete            = _spstream_strandfilter_delete_func;
  _funcptr_xml               = _spstream_strandfilter_xml_func;
  _funcptr_simple_xml        = _spstream_strandfilter_xml_func;
  _funcptr_display_desc      = _spstream_strandfilter_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_strandfilter_next_in_stream_func;

  //attribute variables
  _strand_filter = '\0';
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::StrandFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  char buffer[256];
  if(_strand_filter != '\0') {
    snprintf(buffer, 256, "<strand>%c</strand>", _strand_filter);
    xml_buffer.append(buffer);
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::StrandFilter::StrandFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("strand")) != NULL) {
    if(node->value_size()>0) {
      _strand_filter = node->value()[0];
    }
  }    
}

string EEDB::SPStreams::StrandFilter::_display_desc() {
  char buffer[256];
  snprintf(buffer, 256, "StrandFilter [%c]", _strand_filter);
  return buffer;
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::StrandFilter::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj;
  while((obj = _source_stream->next_in_stream()) != NULL) {

    //non-feature objects are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    
    if(feature->strand() == _strand_filter) { return feature; }
    
    //continue to next feature in the stream
    obj->release();
  }

  // input stream is empty so done
  return NULL;
}


