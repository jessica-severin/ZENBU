/* $Id: ObjectCount.cpp,v 1.8 2019/07/31 06:59:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::ObjectCount

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
#include <sys/time.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/ObjectCount.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::ObjectCount::class_name = "EEDB::SPStreams::ObjectCount";

//function prototypes
void _spstream_objectcount_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::ObjectCount*)obj;
}
MQDB::DBObject* _spstream_objectcount_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::ObjectCount*)node)->_next_in_stream();
}
void _spstream_objectcount_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::ObjectCount*)node)->_reset_stream_node();
}
void _spstream_objectcount_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::ObjectCount*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::ObjectCount::ObjectCount() {
  init();
}

EEDB::SPStreams::ObjectCount::~ObjectCount() {
}

void EEDB::SPStreams::ObjectCount::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::ObjectCount::class_name;
  _module_name               = "ObjectCount";
  _funcptr_delete            = _spstream_objectcount_delete_func;
  _funcptr_xml               = _spstream_objectcount_xml_func;
  _funcptr_simple_xml        = _spstream_objectcount_xml_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_objectcount_next_in_stream_func;
  _funcptr_reset_stream_node      = _spstream_objectcount_reset_stream_node_func;

  //attribute variables
  _object_count = 0;
  _debug = false;
}

EEDB::SPStreams::ObjectCount::ObjectCount(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  //  no parameters to init.
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }
  
  _debug = false;
  if((node = root_node->first_node("debug")) != NULL) { 
    if(string(node->value()) == "true") { _debug=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) { _debug=true; }
  }  
}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::ObjectCount::_xml(string &xml_buffer) {
  //special module used by RegionServer and does nothing to the stream
  if(_source_stream) {
    _source_stream->xml(xml_buffer);
  }
}


void EEDB::SPStreams::ObjectCount::_reset_stream_node() {
  _object_count = 0;
  gettimeofday(&_starttime, NULL);
}


MQDB::DBObject* EEDB::SPStreams::ObjectCount::_next_in_stream() {
  struct timeval  endtime,difftime;

  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj != NULL) { _object_count++; }
  //else { fprintf(stderr, "SPStreams::ObjectCount -- stream empty count %ld\n", _object_count); }

  if(_debug && (_object_count % 100000 == 0)) {
    int pid = getpid();
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &_starttime, &difftime);
    double rate = (double)_object_count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
    fprintf(stderr,"ObjectCount (pid %d) %10ld objects  %13.2f obj/sec\n", pid, _object_count, rate);
  }

  return obj;
}



