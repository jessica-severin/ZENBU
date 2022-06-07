/* $Id: FoldChange.cpp,v 1.3 2019/07/31 06:59:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::FoldChange

SYNOPSIS

DESCRIPTION

 A basic differential-expression / statistics analysis module to calculate fold-change of experiment 
 relative to matching controls. Building with grouping and control-matching logic so that the same
 framework can be reusued for more advanced statistical analysis modules

CONTACT

Jessica Severin <jessica.severin@riken.jp>

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
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FoldChange.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::FoldChange::class_name = "EEDB::SPStreams::FoldChange";

//function prototypes
void _spstream_foldchange_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::FoldChange*)obj;
}
MQDB::DBObject* _spstream_foldchange_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::FoldChange*)node)->_next_in_stream();
}
void _spstream_foldchange_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::FoldChange*)obj)->_xml(xml_buffer);
}
bool _spstream_foldchange_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::FoldChange*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}

EEDB::SPStreams::FoldChange::FoldChange() {
  init();
}

EEDB::SPStreams::FoldChange::~FoldChange() {
}

void EEDB::SPStreams::FoldChange::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::FoldChange::class_name;
  _module_name               = "FoldChange";
  _funcptr_delete            = _spstream_foldchange_delete_func;
  _funcptr_xml               = _spstream_foldchange_xml_func;
  _funcptr_simple_xml        = _spstream_foldchange_xml_func;

  //function pointer code
  _funcptr_next_in_stream              = _spstream_foldchange_next_in_stream_func;
  _funcptr_stream_by_named_region      = _spstream_foldchange_stream_by_named_region_func;

  //attribute variables
  _pre_filter = "";
  _datatype = NULL;
  _output_datatype = EEDB::Datatype::get_type("fc");
  _group_by_keys.clear();
  
  _control_experiments.clear();
  _experiment_cache.clear();

}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::FoldChange::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  if(_datatype) { xml_buffer += "<datatype>" + _datatype->type() + "</datatype>"; }
  
  xml_buffer += "<output_datatype>" + _output_datatype->type() + "</output_datatype>";

  if(!_pre_filter.empty()) { xml_buffer.append("<pre_filter>" + _pre_filter + "</pre_filter>"); }

  if(!_group_by_keys.empty()) {
    vector<string>::iterator it1;
    xml_buffer.append("<group_by_keys>");
    for(it1=_group_by_keys.begin(); it1!=_group_by_keys.end(); it1++) {
      if(it1!=_group_by_keys.begin()) { xml_buffer += ","; }
      xml_buffer.append(*it1);
    }
    xml_buffer.append("</group_by_keys>");
  }

  if(!_match_controls_by_keys.empty()) {
    vector<string>::iterator it1;
    xml_buffer.append("<match_controls_by_keys>");
    for(it1=_group_by_keys.begin(); it1!=_group_by_keys.end(); it1++) {
      if(it1!=_group_by_keys.begin()) { xml_buffer += ","; }
      xml_buffer.append(*it1);
    }
    xml_buffer.append("</match_controls_by_keys>");
  }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::FoldChange::FoldChange(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  //rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("datatype")) != NULL) {
    _datatype = EEDB::Datatype::get_type(node->value());
  }
  if((node = root_node->first_node("output_datatype")) != NULL) {
    _output_datatype = EEDB::Datatype::get_type(node->value());
  }
  
  _pre_filter.clear();
  if((node = root_node->first_node("pre_filter")) != NULL) {
    _pre_filter = node->value();
  }

  //group_by_keys
  _group_by_keys.clear();
  if((node = root_node->first_node("group_by_keys")) != NULL) {
    char* buf = (char*)malloc(strlen(node->value())+2);
    strcpy(buf, node->value());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) { _group_by_keys.push_back(p1); }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  //match_controls_by_keys: use these md keys to match exp with control groups
  _match_controls_by_keys.clear();
  if((node = root_node->first_node("_match_controls_by_keys")) != NULL) {
    char* buf = (char*)malloc(strlen(node->value())+2);
    strcpy(buf, node->value());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) { _match_controls_by_keys.push_back(p1); }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }

}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

bool EEDB::SPStreams::FoldChange::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  
  fprintf(stderr,"FoldChange::_stream_by_named_region[%ld] %s %s %ld .. %ld\n", (long)this, assembly_name.c_str(), chrom_name.c_str(), start, end);
  
  loadprep_experiment_metadata();
  
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}


MQDB::DBObject* EEDB::SPStreams::FoldChange::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }
  
  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }
  
  if(obj->classname() == EEDB::Feature::class_name) {
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    analyze_feature(feature);
  }
  
  //everything else is just passed through
  return obj;
}

//
////////////////////////////////////////////////////////////
//

bool EEDB::SPStreams::FoldChange::loadprep_experiment_metadata() {
  if(!_experiment_cache.empty()) { return true; }
  
  struct timeval       starttime, endtime, time_diff;
  gettimeofday(&starttime, NULL);
  
  //make sure variables are clear
  _experiment_cache.clear();   // [srcID] = experiment :: to keep cache of all experiments
  _control_experiments.clear();   //md-group to srcID to experiment to keep cache

  _key_val_types.clear();      // [key][value] = bool ; for each key get set of values
  _keyval_experiment.clear();  // [key::value][expid] = bool :: mdata present in experiment
  
  EEDB::SPStream  *stream = source_stream();
  
  if(!_pre_filter.empty()) {
    stream->stream_data_sources("Experiment", _pre_filter);
  } else {
    stream->stream_data_sources("Experiment");
  }
  
  long sources_count=0;
  while(EEDB::Experiment *source = (EEDB::Experiment*)stream->next_in_stream()) {
    if(source->classname() != EEDB::Experiment::class_name) { continue; }
    
    source->metadataset()->remove_duplicates();
    sources_count++;
    
    source->retain();
    EEDB::DataSource::add_to_sources_cache(source);
    
    if(source->metadataset()->check_by_filter_logic(_control_group_filter_logic)) {
      _control_experiments[source->db_id()] = source;
    } else {
      _experiment_cache[source->db_id()] = source;
    }
    
    vector<EEDB::Metadata*> mdlist = source->metadataset()->metadata_list();
    for(unsigned int i=0; i<mdlist.size(); i++) {
      EEDB::Metadata *md = mdlist[i];
      string key = md->type();
      if(key=="keyword") { continue; }
      
      string value = md->data();
      //boost::algorithm::to_lower(value);
      string keyval = key+"::"+value;
      
      _key_val_types[key][value] = true;
      _keyval_experiment[keyval][source->db_id()] = true;
    }
  }
  fprintf(stderr,"FoldChange::loadprep_experiment_metadata exps=%ld %ld ctrls=%ld mdkeyvals=%ld\n",
          sources_count, _experiment_cache.size(), _control_experiments.size(), _keyval_experiment .size());
  
  //example test for groups
  vector<string>::iterator it1;
  for(it1=_group_by_keys.begin(); it1!=_group_by_keys.end(); it1++) {
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  fprintf(stderr, "loadprep_experiment_metadata %1.3f msec\n", runtime);
  return true;
}


bool EEDB::SPStreams::FoldChange::analyze_feature(EEDB::Feature *feature) {
  struct timeval       starttime, endtime, time_diff;
  
  _debug=false;
  
  if(!feature) { return false; }
  gettimeofday(&starttime, NULL);
  
  if(_debug) { fprintf(stderr, "\n\nMannWhitneyRanksum::analyze_feature :: %s", feature->simple_xml().c_str()); }
  
  //fill in all the missing experiments to convert the sparse-matrix to a full-matrix
  vector<EEDB::Expression*>  feat_exp_array = feature->expression_array();
  vector<EEDB::Expression*>  express_array; //final array for analysis
  
  if(_debug) { fprintf(stderr, "%ld filtered experiments in cache\n", _experiment_cache.size()); }
  if(_debug) { fprintf(stderr, "%ld feature expressions\n", feat_exp_array.size()); }
  
  //first place the expression which matches the known/filtered experiments into express_hash
  map<string, EEDB::Expression*>  express_hash;   //experiment srcID to expression, fill in the missing
  EEDB::Datatype *dtype = NULL;
  for(unsigned i=0; i<feat_exp_array.size(); i++) {
    EEDB::Expression *expr = feat_exp_array[i];
    if(_experiment_cache.find(expr->experiment_dbid()) != _experiment_cache.end()) {
      express_hash[expr->experiment_dbid()] = expr;
      dtype = expr->datatype();
    }
  }
  if(_debug) { fprintf(stderr, "  %ld expression match the experiment filter\n", express_hash.size()); }

  /*
  string mdgroup;
  vector<string>::iterator it1;
  for(it1=_group_by_keys.begin(); it1!=_group_by_keys.end(); it1++) {
    Metadata* md1 = source->metadataset()->find_metadata((*it1), "");
    if(md1) {
      if(!mdgroup.empty()) { mdgroup += "_"; }
      mdgroup += md1->type() +"::"+ md1->data();
    }
  }
  if(!mdgroup.empty()) {
    boost::algorithm::replace_all(mdgroup, " ", "_");
    fprintf(stderr, "mdgroup[%s] %s\n", mdgroup.c_str(), source->simple_xml().c_str());
    _control_experiments[mdgroup][source->db_id()] = source; //general group for all controls
  }
  */
  
  if(_debug) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &time_diff);
    //double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
    //fprintf(stderr, "found %ld significant mann whitney groups - %1.3f msec\n", mdcount, runtime);
  }
  
  return true;
}




