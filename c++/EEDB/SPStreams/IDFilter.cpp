/* $Id: IDFilter.cpp,v 1.5 2013/04/08 07:38:17 severin Exp $ */

/***

NAME - EEDB::SPStreams::IDFilter

SYNOPSIS

DESCRIPTION

a simple SPStream which does nothing and always returns a NULL object

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
#include <EEDB/SPStreams/IDFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::IDFilter::class_name = "EEDB::SPStreams::IDFilter";

//function prototypes
void _spstream_idfilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::IDFilter*)obj;
}
MQDB::DBObject* _spstream_idfilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::IDFilter*)node)->_next_in_stream();
}
void _spstream_idfilter_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::IDFilter*)node)->_reset_stream_node();
}
void _spstream_idfilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::IDFilter*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::IDFilter::IDFilter() {
  init();
}

EEDB::SPStreams::IDFilter::~IDFilter() {
}

void EEDB::SPStreams::IDFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::IDFilter::class_name;
  _module_name               = "IDFilter";
  _funcptr_delete            = _spstream_idfilter_delete_func;
  _funcptr_xml               = _spstream_idfilter_xml_func;
  _funcptr_simple_xml        = _spstream_idfilter_xml_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_idfilter_next_in_stream_func;
  _funcptr_reset_stream_node      = _spstream_idfilter_reset_stream_node_func;

  //attribute variables
  _filter_ids.clear();
}


void EEDB::SPStreams::IDFilter::set_id_list(string id_list) {
  char* buf = (char*)malloc(id_list.size()+2);
  strcpy(buf, id_list.c_str());
  char *p1 = strtok(buf, ", \t");
  while(p1!=NULL) {
    if(strlen(p1) > 0) {
      string id = p1;
      _filter_ids[id] = true;
    }
    p1 = strtok(NULL, ", \t");
  }
  free(buf);
}


void EEDB::SPStreams::IDFilter::add_id(string id) {
  _filter_ids[id] = true;
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::IDFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass

  map<string,bool>::iterator  it;  
  for(it = _filter_ids.begin(); it != _filter_ids.end(); it++) {
    //obj->xml(xml_buffer);
  }
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::IDFilter::IDFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  //rapidxml::xml_node<>      *node;
  //rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  //if((node = root_node->first_node("minimum_feature_length")) != NULL) {
  //  _min_feature_length = strtol(node->value(), NULL, 10);
  //}
}


void EEDB::SPStreams::IDFilter::_reset_stream_node() {
}


MQDB::DBObject* EEDB::SPStreams::IDFilter::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(_source_stream==NULL) { return NULL; }
  while((obj = _source_stream->next_in_stream()) != NULL) {
    if(_filter_ids[obj->db_id()]) { return obj; }    
    obj->release();
  }
  
  // input stream is empty so done
  return NULL; 
}


