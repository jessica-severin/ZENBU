/* $Id: CalcFeatureSignificance.cpp,v 1.9 2016/06/20 06:35:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::CalcFeatureSignificance

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
#include <EEDB/SPStreams/CalcFeatureSignificance.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::CalcFeatureSignificance::class_name = "EEDB::SPStreams::CalcFeatureSignificance";

//function prototypes
void _spstream_calcfeaturesignificance_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::CalcFeatureSignificance*)obj;
}
MQDB::DBObject* _spstream_calcfeaturesignificance_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::CalcFeatureSignificance*)node)->_next_in_stream();
}
void _spstream_calcfeaturesignificance_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::CalcFeatureSignificance*)obj)->_xml(xml_buffer);
}
string _spstream_calcfeaturesignificance_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::CalcFeatureSignificance*)obj)->_display_desc();
}


EEDB::SPStreams::CalcFeatureSignificance::CalcFeatureSignificance() {
  init();
}

EEDB::SPStreams::CalcFeatureSignificance::~CalcFeatureSignificance() {
}

void EEDB::SPStreams::CalcFeatureSignificance::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::CalcFeatureSignificance::class_name;
  _module_name               = "CalcFeatureSignificance";
  _funcptr_delete            = _spstream_calcfeaturesignificance_delete_func;
  _funcptr_xml               = _spstream_calcfeaturesignificance_xml_func;
  _funcptr_simple_xml        = _spstream_calcfeaturesignificance_xml_func;
  _funcptr_display_desc      = _spstream_calcfeaturesignificance_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream    = _spstream_calcfeaturesignificance_next_in_stream_func;

  //attribute variables
  _expression_mode           = CL_SUM;
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::CalcFeatureSignificance::_display_desc() {
  string str = "CalcFeatureSignificance mode:[";
  str += expression_mode_string();
  str += "]";
  return str;
}


string EEDB::SPStreams::CalcFeatureSignificance::expression_mode_string() {
  string mode_str;
  switch(_expression_mode) {
    case CL_SUM:   mode_str = "sum"; break;
    case CL_MIN:   mode_str = "min"; break;
    case CL_MAX:   mode_str = "max"; break;
    case CL_COUNT: mode_str = "count"; break;
    case CL_MEAN:  mode_str = "mean"; break;
    case CL_NONE:  mode_str = "none"; break;
  }
  return mode_str;
}


void EEDB::SPStreams::CalcFeatureSignificance::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  xml_buffer.append("<expression_mode>");  
  xml_buffer += expression_mode_string();
  xml_buffer.append("</expression_mode>");
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::CalcFeatureSignificance::CalcFeatureSignificance(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("expression_mode")) != NULL) { 
    string mode = node->value();
    _expression_mode = CL_SUM;
    if(mode == "sum")   { _expression_mode = CL_SUM; }
    if(mode == "min")   { _expression_mode = CL_MIN; }
    if(mode == "max")   { _expression_mode = CL_MAX; }
    if(mode == "count") { _expression_mode = CL_COUNT; }
    if(mode == "mean")  { _expression_mode = CL_MEAN; }
    if(mode == "none")  { _expression_mode = CL_NONE; }
  }
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::CalcFeatureSignificance::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }
          
  if(obj->classname() == EEDB::Feature::class_name) {
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    feature->calc_significance(_expression_mode);
  } 
  return obj;
}

