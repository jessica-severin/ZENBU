/* $Id: NormalizePerMillion.cpp,v 1.7 2013/04/08 07:39:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::NormalizePerMillion

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
#include <EEDB/SPStreams/NormalizePerMillion.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::NormalizePerMillion::class_name = "EEDB::SPStreams::NormalizePerMillion";

//function prototypes
void _spstream_normalizepermillion_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::NormalizePerMillion*)obj;
}
MQDB::DBObject* _spstream_normalizepermillion_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::NormalizePerMillion*)node)->_next_in_stream();
}
void _spstream_normalizepermillion_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::NormalizePerMillion*)obj)->_xml(xml_buffer);
}
string _spstream_normalizepermillion_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::NormalizePerMillion*)obj)->_display_desc();
}


EEDB::SPStreams::NormalizePerMillion::NormalizePerMillion() {
  init();
}

EEDB::SPStreams::NormalizePerMillion::~NormalizePerMillion() {
}

void EEDB::SPStreams::NormalizePerMillion::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::NormalizePerMillion::class_name;
  _module_name               = "NormalizePerMillion";
  _funcptr_delete            = _spstream_normalizepermillion_delete_func;
  _funcptr_xml               = _spstream_normalizepermillion_xml_func;
  _funcptr_simple_xml        = _spstream_normalizepermillion_xml_func;
  _funcptr_display_desc      = _spstream_normalizepermillion_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_normalizepermillion_next_in_stream_func;

  //attribute variables
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::NormalizePerMillion::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  //no parameters for now
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::NormalizePerMillion::NormalizePerMillion(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  
  if(string(root_node->name()) != "spstream") { return; }
  //no parameters for now
}

string EEDB::SPStreams::NormalizePerMillion::_display_desc() {
  return "NormalizePerMillion";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::NormalizePerMillion::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  if(obj->classname() == EEDB::Experiment::class_name) {
    EEDB::Experiment *experiment = (EEDB::Experiment*)obj;
    _process_experiment(experiment);
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


void  EEDB::SPStreams::NormalizePerMillion::_process_experiment(EEDB::Experiment *experiment) {
  //transfer the total counts from metadata into variables for map normalization
  if(experiment == NULL) { return; }
  
  //fprintf(stderr, "NormalizePerMillion exp [%s]\n", experiment->db_id().c_str());

  EEDB::MetadataSet       *mdset = experiment->metadataset();
  vector<EEDB::Metadata*>  mdlist = mdset->metadata_list();

  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    
    size_t ipos = md->type().rfind("_total");
    if(ipos!=string::npos) {
      string dtype  = md->type().substr(0, ipos);
      double total  = strtod(md->data().c_str(), NULL);
      //fprintf(stderr, "exp [%s] dtype[%s]  total=%1.3f\n", experiment->db_id().c_str(), dtype.c_str(), total);
      _experiment_totals[experiment->db_id()][dtype] = total;
    }
  }
}


void  EEDB::SPStreams::NormalizePerMillion::_process_expression(EEDB::Expression *express) {
  if(express == NULL) { return; }
  EEDB::Experiment *exp = express->experiment();
  if(exp == NULL) { return; }
  EEDB::Datatype *dtype = express->datatype();
  if(dtype == NULL) { return; }

  double total = _experiment_totals[exp->db_id()][dtype->type()];
  if(total > 0.0) {
    double tval = 1000000.0/total * express->value();
    express->value(tval);
    express->datatype(dtype->type() + "_pm");
  }
}


