/* $Id: ExpressionDatatypeFilter.cpp,v 1.10 2013/04/08 07:37:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::ExpressionDatatypeFilter

SYNOPSIS

DESCRIPTION

a variation on MergeStream, but designed to be a primary source made up of many
component databases (for example a collection of OSCFileDB). Allows one to 
create virtual databases made up of component databases.

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
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/ExpressionDatatypeFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::ExpressionDatatypeFilter::class_name = "EEDB::SPStreams::ExpressionDatatypeFilter";

//function prototypes
void _spstream_expressiondatatypefilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::ExpressionDatatypeFilter*)obj;
}
MQDB::DBObject* _spstream_expressiondatatypefilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::ExpressionDatatypeFilter*)node)->_next_in_stream();
}
void _spstream_expressiondatatypefilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::ExpressionDatatypeFilter*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::ExpressionDatatypeFilter::ExpressionDatatypeFilter() {
  init();
}

EEDB::SPStreams::ExpressionDatatypeFilter::~ExpressionDatatypeFilter() {
}

void EEDB::SPStreams::ExpressionDatatypeFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::ExpressionDatatypeFilter::class_name;
  _module_name               = "ExpressionDatatypeFilter";
  _funcptr_delete            = _spstream_expressiondatatypefilter_delete_func;
  _funcptr_xml               = _spstream_expressiondatatypefilter_xml_func;
  _funcptr_simple_xml        = _spstream_expressiondatatypefilter_xml_func;
  
  //function pointer code
  _funcptr_next_in_stream    = _spstream_expressiondatatypefilter_next_in_stream_func;
  
}

void EEDB::SPStreams::ExpressionDatatypeFilter::add_expression_datatype_filter(EEDB::Datatype* datatype) {
  _expression_datatypes[datatype->type()] = datatype;
}

////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

EEDB::SPStreams::ExpressionDatatypeFilter::ExpressionDatatypeFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }  
  
  // datatypes
  if((node = root_node->first_node("datatype")) != NULL) { 
    while(node) {
      EEDB::Datatype *dtype = EEDB::Datatype::from_xml(node);
      if(dtype) { _expression_datatypes[dtype->type()] = dtype; }
      node = node->next_sibling("datatype");
    }    
  }  
}


void EEDB::SPStreams::ExpressionDatatypeFilter::_xml(string &xml_buffer) {
  map<string, EEDB::Datatype*>::iterator  it;

  _xml_start(xml_buffer);  //from superclass
  if(!_expression_datatypes.empty()) {
    for(it = _expression_datatypes.begin(); it != _expression_datatypes.end(); it++) {
      (*it).second->xml(xml_buffer);
    }
  }
  _xml_end(xml_buffer);  //from superclass  
}



////////////////////////////////////////////////////////////////////////////
//
// stream API methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::ExpressionDatatypeFilter::_next_in_stream() {
  MQDB::DBObject *obj = NULL;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature objects on the primary source stream
      //are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      EEDB::Feature *feature = (EEDB::Feature*)(obj);
      vector<EEDB::Expression*>  filtered_expression;
      vector<EEDB::Expression*>  expression = feature->expression_array();
      
      for(unsigned int i=0; i<expression.size(); i++) {
        if(_expression_datatypes.find(expression[i]->datatype()->type()) != _expression_datatypes.end()) {
          //datatype matches so can return;
          expression[i]->retain();
          filtered_expression.push_back(expression[i]);
        }          
      }
      feature->empty_expression_array();
      for(unsigned int i=0; i<filtered_expression.size(); i++) {
        feature->add_expression(filtered_expression[i]);
        filtered_expression[i]->release();
      }
      feature->calc_significance(CL_SUM);
      return obj;
    }
  }
  // input stream is empty so done
  return NULL; 
}


