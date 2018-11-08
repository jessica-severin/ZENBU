/* $Id: RescalePseudoLog.cpp,v 1.3 2013/04/08 07:36:16 severin Exp $ */

/***

NAME - EEDB::SPStreams::RescalePseudoLog

SYNOPSIS

DESCRIPTION

  A simple signal procesor which rescale expression level as pseudo log
Log transformation is convenient to vizualize data whose expression levels
varies in a wide range of values, but zero values are common places and
log(base,0) is not defined and we would thus need to recurse to pseudocount
(typically arbitrarily adding 0.5).

Alternatively we can use pseudolog defined as asinh(x/2) / log(base), which
has the following nice properties
   * is defined for all real x values
   * pseudolog(base, 0) = 0
   * pseudolog(base, -x) = -1* pseudolog(base, x)
   * pseudolog(base, x) ~ log(base, x) for x > base values
           [ For information :                                         ]
           [       pseudolog(10,1)  = 0.2089876; log10(1)  = 0         ]
           [       pseudolog(10,2)  = 0.3827757; log10(2)  = 0.3010300 ]
           [       pseudolog(10,3)  = 0.5188791; log10(3)  = 0.4771213 ]
           [       pseudolog(10,4)  = 0.6269629; log10(4)  = 0.6020600 ]
           [       pseudolog(10,5)  = 0.7153834; log10(5)  = 0.6989700 ]
           [       pseudolog(10,10) = 1.0042792; log10(10) = 1         ]
           [       pseudolog(10,100)= 2.0000430; log10(100)= 2         ]
           [       pseudolog(2,1)  = 0.6942419; log2(1)  = 0           ]
           [       pseudolog(2,2)  = 1.2715533; log2(2)  = 1           ]
           [       pseudolog(2,3)  = 1.7236790; log2(3)  = 1.584963    ]
           [       pseudolog(2,4)  = 2.0827257; log2(4)  = 2           ]
           [       pseudolog(2,5)  = 2.3764522; log2(5)  = 2.321928    ]
           [       pseudolog(2,10) = 3.3361433; log2(10) = 3.321928    ]
           [       pseudolog(2,100)= 6.6440004; log2(100)= 6.643856    ]

CONTACT

Nicolas Bertin <nbertin@gsc.riken.jp>
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
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Experiment.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/RescalePseudoLog.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::RescalePseudoLog::class_name = "EEDB::SPStreams::RescalePseudoLog";

//function prototypes
void _spstream_rescalepseudolog_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::RescalePseudoLog*)obj;
}
MQDB::DBObject* _spstream_rescalepseudolog_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::RescalePseudoLog*)node)->_next_in_stream();
}
void _spstream_rescalepseudolog_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::RescalePseudoLog*)obj)->_xml(xml_buffer);
}
string _spstream_rescalepseudolog_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::RescalePseudoLog*)obj)->_display_desc();
}


EEDB::SPStreams::RescalePseudoLog::RescalePseudoLog() {
  init();
}

EEDB::SPStreams::RescalePseudoLog::~RescalePseudoLog() {
}

void EEDB::SPStreams::RescalePseudoLog::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::RescalePseudoLog::class_name;
  _module_name               = "RescalePseudoLog";
  _funcptr_delete            = _spstream_rescalepseudolog_delete_func;
  _funcptr_xml               = _spstream_rescalepseudolog_xml_func;
  _funcptr_simple_xml        = _spstream_rescalepseudolog_xml_func;
  _funcptr_display_desc      = _spstream_rescalepseudolog_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_rescalepseudolog_next_in_stream_func;

  //attribute variables 
  // default to base 10 (aka pseudolog10)
  base(10);
}


void EEDB::SPStreams::RescalePseudoLog::base(long value) {
  _base = value;
  char buffer[17];
  snprintf(buffer, 16, "_pseudolog%ld", value);
  _base_str = buffer;
}

void EEDB::SPStreams::RescalePseudoLog::base(char* value) {
  if(value==NULL) { return; }
  _base_str = string("_pseudolog") + value;
  _base = strtol(value, NULL, 10);
}



////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::RescalePseudoLog::RescalePseudoLog(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node; 
  rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("base")) != NULL) {
    //base(strtol(node->value(), NULL, 10));
    base(node->value());
  }
}

string EEDB::SPStreams::RescalePseudoLog::_display_desc() {
  char buffer[256];
  snprintf(buffer, 256, "RescalePseudoLog%ld", _base);
  return buffer;
}


void EEDB::SPStreams::RescalePseudoLog::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  char buffer[256];
  snprintf(buffer, 256, "<base>%ld</base>", _base);
  xml_buffer.append(buffer);
  
  _xml_end(xml_buffer);  //from superclass
}




////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::RescalePseudoLog::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  if(obj->classname() == EEDB::Expression::class_name) {
    EEDB::Expression *express = (EEDB::Expression*)obj;
    _process_expression(express);
  }
  
  else if(obj->classname() == EEDB::Feature::class_name) {
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    vector<EEDB::Expression*>  expression = feature->expression_array();
    for(unsigned int i=0; i<expression.size(); i++) {
      _process_expression(expression[i]);
    }
    feature->rebuild_expression_hash();
  } 
  //other classes are not modified
  
  //everything is just passed through
  return obj;
}


void  EEDB::SPStreams::RescalePseudoLog::_process_expression(EEDB::Expression *express) {
  if(express == NULL) { return; }
  EEDB::Experiment *exp = express->experiment();
  if(exp == NULL) { return; }
  EEDB::Datatype *dtype = express->datatype();
  if(dtype == NULL) { return; }

  double tval =  asinh( express->value() / 2) / log(_base) ;
  express->value(tval);
  express->datatype(dtype->type() + _base_str);
}


