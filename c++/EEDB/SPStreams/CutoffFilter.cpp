/* $Id: CutoffFilter.cpp,v 1.12 2018/11/16 07:54:45 severin Exp $ */

/***

NAME - EEDB::SPStreams::CutoffFilter

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
#include <EEDB/SPStreams/CutoffFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::CutoffFilter::class_name = "EEDB::SPStreams::CutoffFilter";

//function prototypes
void _spstream_cutofffilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::CutoffFilter*)obj;
}
MQDB::DBObject* _spstream_cutofffilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::CutoffFilter*)node)->_next_in_stream();
}
void _spstream_cutofffilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::CutoffFilter*)obj)->_xml(xml_buffer);
}
string _spstream_cutofffilter_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::CutoffFilter*)obj)->_display_desc();
}


EEDB::SPStreams::CutoffFilter::CutoffFilter() {
  init();
}

EEDB::SPStreams::CutoffFilter::~CutoffFilter() {
}

void EEDB::SPStreams::CutoffFilter::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::CutoffFilter::class_name;
  _module_name               = "CutoffFilter";
  _funcptr_delete            = _spstream_cutofffilter_delete_func;
  _funcptr_xml               = _spstream_cutofffilter_xml_func;
  _funcptr_simple_xml        = _spstream_cutofffilter_xml_func;
  _funcptr_display_desc      = _spstream_cutofffilter_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_cutofffilter_next_in_stream_func;

  //attribute variables
  _min_cutoff = 0.0;
  _max_cutoff = 0.0;
  _apply_min_cutoff = false;
  _apply_max_cutoff = false;
  _filter_by_experiment = false; //filter based on feature.significance not individual experiments
  _filter_mode = FEATURE;
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::CutoffFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  char buffer[256];

  if(_filter_mode == EXPERIMENT) { xml_buffer.append("<filter_mode>experiment</filter_mode>"); }

  if(_apply_min_cutoff) {
    snprintf(buffer, 256, "<min_cutoff>%f</min_cutoff>", _min_cutoff);
    xml_buffer.append(buffer);
  }
  if(_apply_max_cutoff) {
    snprintf(buffer, 256, "<max_cutoff>%f</max_cutoff>", _max_cutoff);
    xml_buffer.append(buffer);
  }

  if(_filter_by_experiment) { xml_buffer.append("<filter_by_experiment>true</filter_by_experiment>"); }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::CutoffFilter::CutoffFilter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("min_cutoff")) != NULL) {
    _min_cutoff = strtod(node->value(), NULL);
    _apply_min_cutoff = true;
  }    
  if((node = root_node->first_node("max_cutoff")) != NULL) {
    _max_cutoff = strtod(node->value(), NULL);
    _apply_max_cutoff = true;
  }
  
  _filter_by_experiment = false;
  if((node = root_node->first_node("filter_by_experiment")) != NULL) { 
    if(string(node->value()) == "true") { _filter_by_experiment=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _filter_by_experiment=true;
    }
  }  

  _filter_mode = FEATURE;
  if((node = root_node->first_node("filter_mode")) != NULL) { 
    if(string(node->value()) == "experiment") { _filter_mode = EXPERIMENT; }
  }  
}

string EEDB::SPStreams::CutoffFilter::_display_desc() {
  char buffer[256];
  snprintf(buffer, 256, "CutoffFilter [%f]", _min_cutoff);
  return buffer;
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::CutoffFilter::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj;
  while((obj = _source_stream->next_in_stream()) != NULL) {

    //non-feature objects are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    
    bool ok=true;
    if(_filter_mode == EXPERIMENT) {
      //filter on experiment expression. apply to the experiment/expression by zero-out the expression value
      vector<EEDB::Expression*>  expression = feature->expression_array();
      for(unsigned int i=0; i<expression.size(); i++) {
        //maybe do a datatype filter here
        double expr = expression[i]->value();        
        if(_apply_min_cutoff && expr < _min_cutoff) { expression[i]->value(0); }
        if(_apply_max_cutoff && expr > _max_cutoff) { expression[i]->value(0); }
      }
      feature->calc_significance(CL_SUM);
    }
    if((_filter_mode == FEATURE) && _filter_by_experiment) {
      //filter on experiment expression. at least one experiment/expression must be OK
      vector<EEDB::Expression*>  expression = feature->expression_array();
      for(unsigned int i=0; i<expression.size(); i++) {
        //maybe do a datatype filter here
        ok=true;
        double expr = expression[i]->value();        
        if(_apply_min_cutoff && expr < _min_cutoff) { ok=false; }
        if(_apply_max_cutoff && expr > _max_cutoff) { ok=false; }
        if(ok) { break; }  //found first valid experiment/expression so features is OK
      }
    }
    if((_filter_mode == FEATURE) && !_filter_by_experiment) {
      //filter on feature significance
      ok=true;
      if(_apply_min_cutoff && (feature->significance() < _min_cutoff)) { ok=false; }
      if(_apply_max_cutoff && (feature->significance() > _max_cutoff)) { ok=false; }
    }
    
    if(ok) { return feature; }
    
    //continue
    obj->release();
  }

  // input stream is empty so done
  return NULL;
}


