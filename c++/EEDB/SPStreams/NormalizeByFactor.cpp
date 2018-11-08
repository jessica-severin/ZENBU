/* $Id: NormalizeByFactor.cpp,v 1.7 2014/11/26 09:12:57 severin Exp $ */

/***

NAME - EEDB::SPStreams::NormalizeByFactor

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
#include <EEDB/SPStreams/NormalizeByFactor.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::NormalizeByFactor::class_name = "EEDB::SPStreams::NormalizeByFactor";

//function prototypes
void _spstream_normalizebyfactor_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::NormalizeByFactor*)obj;
}
MQDB::DBObject* _spstream_normalizebyfactor_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::NormalizeByFactor*)node)->_next_in_stream();
}
void _spstream_normalizebyfactor_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::NormalizeByFactor*)obj)->_xml(xml_buffer);
}
string _spstream_normalizebyfactor_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::NormalizeByFactor*)obj)->_display_desc();
}


EEDB::SPStreams::NormalizeByFactor::NormalizeByFactor() {
  init();
}

EEDB::SPStreams::NormalizeByFactor::~NormalizeByFactor() {
}

void EEDB::SPStreams::NormalizeByFactor::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::NormalizeByFactor::class_name;
  _module_name               = "NormalizeByFactor";
  _funcptr_delete            = _spstream_normalizebyfactor_delete_func;
  _funcptr_xml               = _spstream_normalizebyfactor_xml_func;
  _funcptr_simple_xml        = _spstream_normalizebyfactor_xml_func;
  _funcptr_display_desc      = _spstream_normalizebyfactor_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_normalizebyfactor_next_in_stream_func;

  //attribute variables
  _datatype =  EEDB::Datatype::get_type("tagcount");
  _output_datatype.clear();
  _experiment_metadata_tag.clear();
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::NormalizeByFactor::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass

  xml_buffer += "<datatype>" + _datatype->type() + "</datatype>";

  xml_buffer += "<output_datatype>" + _output_datatype + "</output_datatype>";

  if(!_experiment_metadata_tag.empty()) {
    xml_buffer += "<experiment_metadata_tag>" + _experiment_metadata_tag + "</experiment_metadata_tag>";
  }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::NormalizeByFactor::NormalizeByFactor(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("datatype")) != NULL) {
    _datatype = EEDB::Datatype::get_type(node->value());
  }  
  if((node = root_node->first_node("output_datatype")) != NULL) {
    _output_datatype = node->value();
  }  
  if((node = root_node->first_node("experiment_metadata_tag")) != NULL) {
    _experiment_metadata_tag = node->value();
  }  
  
}

string EEDB::SPStreams::NormalizeByFactor::_display_desc() {
  return "NormalizeByFactor";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::NormalizeByFactor::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  if(obj->classname() == EEDB::Experiment::class_name) {
    EEDB::Experiment *experiment = (EEDB::Experiment*)obj;
    _get_experiment_factor(experiment);
  }
  
  else if(obj->classname() == EEDB::Expression::class_name) {
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


void  EEDB::SPStreams::NormalizeByFactor::_get_experiment_factor(EEDB::Experiment *experiment) {
  //transfer the total counts from metadata into variables for map normalization
  if(experiment == NULL) { return; }
  
  //fprintf(stderr, "NormalizeByFactor exp [%s]\n", experiment->db_id().c_str());

  EEDB::MetadataSet  *mdset = experiment->metadataset();
  EEDB::Metadata     *md = mdset->find_metadata(_experiment_metadata_tag, "");
  if(!md) { 
    fprintf(stderr, "WARN NormalizeByFactor %s no tag [%s]\n", experiment->db_id().c_str(), _experiment_metadata_tag.c_str());
    return; 
  }
  
  double factor = strtod(md->data().c_str(), NULL);
  _experiment_factors[experiment->db_id()] = factor;
  //fprintf(stderr, "NormalizeByFactor exp [%s] %1.7f\n", experiment->db_id().c_str(), factor);
}


void  EEDB::SPStreams::NormalizeByFactor::_process_expression(EEDB::Expression *express) {
  if(express == NULL) { return; }
  EEDB::Experiment *exp = express->experiment();
  if(exp == NULL) { return; }
  EEDB::Datatype *dtype = express->datatype();
  if(dtype == NULL) { return; }
  if(dtype != _datatype) { return; }

  if(_experiment_factors.find(exp->db_id()) == _experiment_factors.end()) { 
    EEDB::Experiment* source = (EEDB::Experiment*)EEDB::DataSource::sources_cache_get(exp->db_id());
    if(!source) { return; }
    _get_experiment_factor(source);
  }
  if(_experiment_factors.find(exp->db_id()) == _experiment_factors.end()) { 
    fprintf(stderr, "WARN NormalizeByFactor unable to access factor %s [%s]\n", exp->db_id().c_str(), _experiment_metadata_tag.c_str());
    return; 
  }
  
  double factor = _experiment_factors[exp->db_id()];
  double tval = express->value() * factor;
  
  express->value(tval);
  express->datatype(_output_datatype);
}


