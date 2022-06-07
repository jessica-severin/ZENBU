/* $Id: EdgeLengthFilter.cpp,v 1.2 2020/04/01 01:50:41 severin Exp $ */

/***

NAME - EEDB::SPStreams::EdgeLengthFilter

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
#include <EEDB/Edge.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/EdgeLengthFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::EdgeLengthFilter::class_name = "EEDB::SPStreams::EdgeLengthFilter";

//function prototypes
void _spstream_edgelengthfilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::EdgeLengthFilter*)obj;
}
MQDB::DBObject* _spstream_edgelengthfilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::EdgeLengthFilter*)node)->_next_in_stream();
}
void _spstream_edgelengthfilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::EdgeLengthFilter*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::EdgeLengthFilter::EdgeLengthFilter() {
  init();
}

EEDB::SPStreams::EdgeLengthFilter::~EdgeLengthFilter() {
}

void EEDB::SPStreams::EdgeLengthFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::EdgeLengthFilter::class_name;  
  _module_name               = "EdgeLengthFilter";
  _funcptr_delete            = _spstream_edgelengthfilter_delete_func;
  _funcptr_xml               = _spstream_edgelengthfilter_xml_func;
  _funcptr_simple_xml        = _spstream_edgelengthfilter_xml_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_edgelengthfilter_next_in_stream_func;

  //attribute variables
  _min_length = -1;
  _max_length = -1;
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::EdgeLengthFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass
  
  char buffer[256];
  //older style of <ignore_strand value="1" />
  if(_min_length >=0) { 
    snprintf(buffer, 256, "<min_length>%ld</min_length>", _min_length);
    xml_buffer.append(buffer);    
  }
  if(_max_length >=0) { 
    snprintf(buffer, 256, "<max_length>%ld</max_length>", _max_length);
    xml_buffer.append(buffer);    
  }
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::EdgeLengthFilter::EdgeLengthFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("min_length")) != NULL) {
    _min_length = strtol(node->value(), NULL, 10);
  }
  if((node = root_node->first_node("max_length")) != NULL) {
    _max_length = strtol(node->value(), NULL, 10);
  }
}

/*****************************************************************************************/

void  EEDB::SPStreams::EdgeLengthFilter::min_length(long value) {
  if(value < 0) { value = abs(value); }
  _min_length = value;
}

void  EEDB::SPStreams::EdgeLengthFilter::max_length(long value) {
  if(value < 0) { value = abs(value); }
  _max_length = value;
}


/*****************************************************************************************/

MQDB::DBObject* EEDB::SPStreams::EdgeLengthFilter::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-edge objects on the primary source stream
      //are just passed through this module      
      if(obj->classname() != EEDB::Edge::class_name) {
        return obj;
      }
      
      //if edge passes legnth filter, return it
      EEDB::Edge *edge = (EEDB::Edge*)obj;
      long int length = edge->chrom_end() - edge->chrom_start() + 1;
      if(length < _min_length) { 
        obj->release();
        continue;
      }
      if((_max_length>0) && (length > _max_length)) {
        obj->release();
        continue;
      }      
      return obj;
    }
  }
  
  // input stream is empty so done
  return NULL; 
}




