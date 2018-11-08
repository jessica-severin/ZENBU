/* $Id: NormalizeRPKM.cpp,v 1.6 2013/04/08 07:39:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::NormalizeRPKM

SYNOPSIS

DESCRIPTION

 A simple signal procesor which retrieve the total count from the experiment metadata 
and the lenght of the feature (subfeature  --selected thru subfeat_filter_categories--
cumulative length or feature lenght) to recompute the expression level as
per million per 1000 basepairs (RPKM)

CONTACT

Jessica Severin <severin@gsc.riken.jp>
Nicolas Bertin <nbertin@gsc.riken.jp>

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
#include <EEDB/SPStreams/NormalizeRPKM.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::NormalizeRPKM::class_name = "EEDB::SPStreams::NormalizeRPKM";

//function prototypes
void _spstream_normalizerpkm_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::NormalizeRPKM*)obj;
}
MQDB::DBObject* _spstream_normalizerpkm_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::NormalizeRPKM*)node)->_next_in_stream();
}
void _spstream_normalizerpkm_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::NormalizeRPKM*)obj)->_xml(xml_buffer);
}
string _spstream_normalizerpkm_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::NormalizeRPKM*)obj)->_display_desc();
}


EEDB::SPStreams::NormalizeRPKM::NormalizeRPKM() {
  init();
}

EEDB::SPStreams::NormalizeRPKM::~NormalizeRPKM() {
}

void EEDB::SPStreams::NormalizeRPKM::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::NormalizeRPKM::class_name;
  _module_name               = "NormalizeRPKM";
  _funcptr_delete            = _spstream_normalizerpkm_delete_func;
  _funcptr_xml               = _spstream_normalizerpkm_xml_func;
  _funcptr_simple_xml        = _spstream_normalizerpkm_xml_func;
  _funcptr_display_desc      = _spstream_normalizerpkm_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_normalizerpkm_next_in_stream_func;

  //attributes
  _subfeat_filter_categories["exon"] = true;
  _subfeat_filter_categories["block"] = true;
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::NormalizeRPKM::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass

  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  _xml_end(xml_buffer);  //from SPStream superclass
}


EEDB::SPStreams::NormalizeRPKM::NormalizeRPKM(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("category_filter")) != NULL) {
    _subfeat_filter_categories.clear();
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }
}

string EEDB::SPStreams::NormalizeRPKM::_display_desc() {
  return "NormalizeRPKM";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::NormalizeRPKM::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  if(obj->classname() == EEDB::Experiment::class_name) {
    EEDB::Experiment *experiment = (EEDB::Experiment*)obj;
    _process_experiment(experiment);
  }
  else if(obj->classname() == EEDB::Feature::class_name) {
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    //fprintf(stderr, "rpkm %s %s\n", feature->primary_name().c_str(), feature->chrom_location().c_str());
    
    long int len = 0;
    vector<EEDB::Feature*> subfeatures = feature->subfeatures();
    if(!subfeatures.empty()) {
      for(unsigned int i=0; i<subfeatures.size(); i++) {
        EEDB::Feature *subfeat = subfeatures[i];
        EEDB::FeatureSource *fsrc = subfeat->feature_source();
        if(!fsrc) { continue; }
        if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
        len += subfeat->chrom_end() - subfeat->chrom_start() +1;
      }
    }
    // if the length is still zero, then use the extreme boundaries
    if(len == 0){ 
      len = feature->chrom_end() - feature->chrom_start() +1;
    }
    
    vector<EEDB::Expression*>  expression = feature->expression_array();
    for(unsigned int i=0; i<expression.size(); i++) {
      _process_expression(expression[i], len);
    }
    feature->rebuild_expression_hash();
  } 
  //other classes are not modified
  
  //everything is just passed through
  return obj;
}


void  EEDB::SPStreams::NormalizeRPKM::_process_experiment(EEDB::Experiment *experiment) {
  //transfer the total counts from metadata into variables for map normalization
  if(experiment == NULL) { return; }
  //fprintf(stderr, "NormalizeRPKM exp [%s]\n", experiment->db_id().c_str());
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


void  EEDB::SPStreams::NormalizeRPKM::_process_expression(EEDB::Expression *express, long int len) {
  if(express == NULL) { return; }
  EEDB::Experiment *exp = express->experiment();
  if(exp == NULL) { return; }
  EEDB::Datatype *dtype = express->datatype();
  if(dtype == NULL) { return; }
  if(len <= 0) { return; }

  double total = _experiment_totals[exp->db_id()][dtype->type()];
  //if(total <= 0.0) { return; }
  if(total <= 0.0) { total = 1000000.0; }

  double tval = (1000000.0/total) * express->value() / (len / 1000.0);
  express->value(tval);
  express->datatype(dtype->type() + "_rpkm");
}


