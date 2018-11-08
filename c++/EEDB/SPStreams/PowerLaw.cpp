/* $Id: PowerLaw.cpp,v 1.3 2013/04/08 07:39:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::PowerLaw

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
#include <EEDB/SPStreams/PowerLaw.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::PowerLaw::class_name = "EEDB::SPStreams::PowerLaw";

//function prototypes
void _spstream_PowerLaw_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::SPStreams::PowerLaw*)obj;
}
MQDB::DBObject* _spstream_PowerLaw_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::PowerLaw*)node)->_next_in_stream();
}
void _spstream_PowerLaw_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::SPStreams::PowerLaw*)obj)->_xml(xml_buffer);
}
string _spstream_PowerLaw_display_desc_func(MQDB::DBObject *obj) {
  return ((EEDB::SPStreams::PowerLaw*)obj)->_display_desc();
}


EEDB::SPStreams::PowerLaw::PowerLaw() {
  init();
}

EEDB::SPStreams::PowerLaw::~PowerLaw() {
}

void EEDB::SPStreams::PowerLaw::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::PowerLaw::class_name;
  _module_name               = "PowerLaw";
  _funcptr_delete            = _spstream_PowerLaw_delete_func;
  _funcptr_xml               = _spstream_PowerLaw_xml_func;
  _funcptr_simple_xml        = _spstream_PowerLaw_xml_func;
  _funcptr_display_desc      = _spstream_PowerLaw_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_PowerLaw_next_in_stream_func;

  //attribute variables
  _lambda = 0;
  _beta   = 0;

  _beta_tag = "beta";  // Default tags are beta, lambda (will look for {datatype}_beta and {datatype}_lambda
  _lambda_tag = "lambda";
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::PowerLaw::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  //no parameters for now
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::PowerLaw::PowerLaw(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("lambda")) != NULL) {  // If lambda is provided in script
    _lambda = strtod(node->value(), NULL);
  }

  if((node = root_node->first_node("beta")) != NULL) { // If beta is provided in script
    _beta = strtod(node->value(), NULL);
  }

  if((node = root_node->first_node("lambda_tag")) != NULL) {  // If lambda_tag is provided in script (example: beta1, lambda1 will find {datatype}_beta1 and {datatype}_lambda1)
    _lambda_tag = node->value();
  }

  if((node = root_node->first_node("beta_tag")) != NULL) { // If beta_tag is provided in script
    _beta_tag = node->value();
  }

}

string EEDB::SPStreams::PowerLaw::_display_desc() {
  return "PowerLaw";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


/* string EEDB::SPStreams::PowerLaw::_find_md(std::string key) {
  EEDB::MetadataSet       *mdset = experiment->metadataset();
  vector<EEDB::Metadata*>  mdlist = mdset->metadata_list();

  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];

    size_t i_pos   = md->type().rfind(key);
    if (i_pos!=string::npos)
      return md->data().c_str();

    return ""; // Fail
  }
} */


MQDB::DBObject* EEDB::SPStreams::PowerLaw::_next_in_stream() {
  //cout << "*** NEXT IN STREAM ***" << endl;
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  //cout << EEDB::Experiment::class_name << endl;

  if(obj->classname() == EEDB::Experiment::class_name) {
    EEDB::Experiment *experiment = (EEDB::Experiment*)obj;
    _process_experiment(experiment);
  }
  
  //else if(obj->classname() == EEDB::Expression::class_name) {
  //  EEDB::Expression *express = (EEDB::Expression*)obj;
  //  _process_expression(express);
  //}
  
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


void  EEDB::SPStreams::PowerLaw::_process_experiment(EEDB::Experiment *experiment) {
  //transfer the total counts from metadata into variables for map normalization
  if(experiment == NULL) { return; }
  //return;

  
  //fprintf(stderr, "PowerLaw exp [%s]\n", experiment->db_id().c_str());

  EEDB::MetadataSet       *mdset = experiment->metadataset();
  vector<EEDB::Metadata*>  mdlist = mdset->metadata_list();

  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    
    //string vtype = "";

    size_t i_pos   = md->type().rfind("_" + _beta_tag);  // find meta tags that end in _beta_tag ("beta" by default)
    if (i_pos==string::npos) {
      i_pos   = md->type().rfind("_" + _lambda_tag);   // find meta tags that end in _lambda_tag ("lambda" by default)
      if (i_pos==string::npos) { continue; }
    }

    string vtype = md->type().substr(i_pos+1, string::npos);
    string dtype  = md->type().substr(0, i_pos);  // Get datatype
    double value  = strtod(md->data().c_str(), NULL);
    _experiment_totals[experiment->db_id()][dtype][vtype] = value;  // store datatype->value type
    //std::cout << "** _process_experiment ** " << dtype << "_" << vtype << " = "<< value << endl;
  }

}

void  EEDB::SPStreams::PowerLaw::_process_expression(EEDB::Expression *express) {
	//return;

  if(express == NULL) { return; }
  EEDB::Experiment *exp = express->experiment();
  if(exp == NULL) { return; }
  EEDB::Datatype *dtype = express->datatype();
  if(dtype == NULL) { return; }

  //cout << "****" << endl;

  double beta   = _experiment_totals[exp->db_id()][dtype->type()][_beta_tag];
  double lambda = _experiment_totals[exp->db_id()][dtype->type()][_lambda_tag];

  if (_beta != 0 && _lambda != 0 ) {
    beta   = _beta;
    lambda = _lambda;
  }

  if (beta == 0 || lambda == 0 ) return;

  //cout << "** PowerLaw using: beta=" << beta << " lambda=" << lambda << endl;

  //NOTE: lambda and beta are define as inverse values (L = 1/lambda, B = 1/beta)
  //  exp(ln[x*L]*B) = exp(ln[(x*L)^B)]) = (x*L)^B = (x/lambda)^(1/beta)


  double value = express->value();
  value = pow(value/lambda,1/beta);

  express->value(value);
  express->datatype(dtype->type() + "_powerlaw");

}


