/* $Id: TemplateCluster.cpp,v 1.55 2020/04/28 01:28:55 severin Exp $ */

/***

NAME - EEDB::SPStreams::TemplateCluster

SYNOPSIS

DESCRIPTION

processing module which collates expression from the primary stream
 onto features on the side stream (templates) based on genomic
 overlap logic

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
#include <EEDB/Feature.h>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/TemplateCluster.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::TemplateCluster::class_name = "EEDB::SPStreams::TemplateCluster";

//function prototypes
MQDB::DBObject* _spstream_templatecluster_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::TemplateCluster*)node)->_next_in_stream();
}
void _spstream_templatecluster_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::TemplateCluster*)node)->_reset_stream_node();
}
void _spstream_templatecluster_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::TemplateCluster*)node)->_stream_clear();
}
void _spstream_templatecluster_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::TemplateCluster*)obj;
}
void _spstream_templatecluster_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::TemplateCluster*)obj)->_xml(xml_buffer);
}
bool _spstream_templatecluster_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::TemplateCluster*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}


EEDB::SPStreams::TemplateCluster::TemplateCluster() {
  init();
}

EEDB::SPStreams::TemplateCluster::~TemplateCluster() {
}


void EEDB::SPStreams::TemplateCluster::init() {
  EEDB::SPStreams::MergeStreams::init();  
  _classname                  = EEDB::SPStreams::TemplateCluster::class_name;
  _module_name                = "TemplateCluster";

  _funcptr_delete             = _spstream_templatecluster_delete_func;
  _funcptr_xml                = _spstream_templatecluster_xml_func;
  _funcptr_simple_xml         = _spstream_templatecluster_xml_func;

  _funcptr_next_in_stream           = _spstream_templatecluster_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_templatecluster_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_templatecluster_stream_clear_func;
  _funcptr_stream_by_named_region   = _spstream_templatecluster_stream_by_named_region_func;

  _overlap_mode          = "area";
  _expression_mode       = CL_SUM;
  _ignore_strand         = false;
  _template_stream_empty = false;
  _skip_empty_templates  = true;
  _stream_features_mode  = false;;
  _overlap_check_subfeatures = false; //extend overlap logic to require subfeature overlap
  _overlap_distance      = 0;
  _scan_extend_distance  = 0;
  _edges_mode            = false;

  _completed_templates.clear();
  _template_buffer.clear();
  _edge_buffer.clear();
}

void EEDB::SPStreams::TemplateCluster::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::TemplateCluster::display_desc() {
  return "TemplateCluster";
}

string EEDB::SPStreams::TemplateCluster::display_contents() {
  return display_desc();
}

void  EEDB::SPStreams::TemplateCluster::overlap_mode(string value) {
  //area, height, 5end, 3end
  _overlap_mode = value;
}

void  EEDB::SPStreams::TemplateCluster::overlap_check_subfeatures(bool value) {
  _overlap_check_subfeatures = value;
}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::TemplateCluster::_next_in_stream() {
  if(!_stream_features_mode) { //call super class 
    return EEDB::SPStreams::MergeStreams::_next_in_stream();
  }

  MQDB::DBObject *obj;
  
  if(!_completed_templates.empty()) {
    EEDB::Feature* cluster = _completed_templates.front();
    _completed_templates.pop_front();
    return cluster; 
  }
  
  if((_source_stream!=NULL) and (!_template_stream_empty or !_template_buffer.empty())) {
    while((obj = _source_stream->next_in_stream()) != NULL) {

      if(obj->classname() == EEDB::Feature::class_name) {
        //if cluster is returned then it is completed
        EEDB::Feature *cluster = _process_feature(obj);
        obj->release();
        if(cluster!=NULL) { return cluster; }        
      }
      else if(obj->classname() == EEDB::Edge::class_name) {
        //if clustered edge is returned then it is completed
        EEDB::Edge *edge = _process_edge(obj);
        obj->release();
        if(edge!=NULL) { return edge; }        
      }
      else {
        //everything else is just passed through this module      
        return obj;
      }

      //if the template stream is empty and there are no templates in the buffer for
      //analysis, then we can stop processing, so clear the primary stream
      if(_template_stream_empty && _template_buffer.empty()) {
        _source_stream->stream_clear(); 
        //fprintf(stderr, "TemplateCluster:: templates done\n");
        break;
      }
    }
  }
  
  //TODO: if _edges_mode so some final magic here
  
  if(!_edge_buffer.empty()) {
    EEDB::Edge* edge = _edge_buffer.front();
    _edge_buffer.pop_front();
    return edge; 
  }

  //
  // input stream is empty so move all _template_buffer into _completed_templates
  //
  while(!_template_buffer.empty()) {
    EEDB::Feature* cluster = _template_buffer.front();
    _template_buffer.pop_front();
    if(cluster!=NULL) {
      _calc_template_significance(cluster);
      if(_edges_mode or (_skip_empty_templates and (cluster->significance() <= 0.0))) {
        cluster->release();
      } else {
        _completed_templates.push_back(cluster);
      }
    }
  }

  //
  // return finished clusters now
  //
  if(!_completed_templates.empty()) {
    EEDB::Feature* cluster = _completed_templates.front();
    _completed_templates.pop_front();
    return cluster; 
  }

  return NULL; 
}


void EEDB::SPStreams::TemplateCluster::_stream_clear() {
  //re-initialize the stream-stack back to a clear/empty state
  if(source_stream() != NULL) { source_stream()->stream_clear(); }
  if(side_stream() != NULL)   { side_stream()->stream_clear(); }  

  EEDB::SPStreams::MergeStreams::_reset_stream_node();

  for(unsigned int i=0; i<_template_buffer.size(); i++) { _template_buffer[i]->release(); }
  _template_buffer.clear();

  for(unsigned int i=0; i<_completed_templates.size(); i++) { _completed_templates[i]->release(); }
  _completed_templates.clear();

  _template_stream_empty = false;
  _stream_features_mode  = false;
  _region_start = -1;
  _region_end   = -1;
}


/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::TemplateCluster::_reset_stream_node() {
  EEDB::SPStreams::MergeStreams::_reset_stream_node();

  for(unsigned int i=0; i<_template_buffer.size(); i++) {
    _template_buffer[i]->release();
  }
  for(unsigned int i=0; i<_completed_templates.size(); i++) {
    _completed_templates[i]->release();
  }
  _completed_templates.clear();
  _template_buffer.clear();
  _template_stream_empty = false;
  _stream_features_mode  = false;
  _region_start = -1;
  _region_end   = -1;
}


bool EEDB::SPStreams::TemplateCluster::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  if(_overlap_distance>0) { 
    start -= _overlap_distance; 
    if(end>0) { end += _overlap_distance; }
  }
  if(_scan_extend_distance>0) { 
    start -= _scan_extend_distance; 
    if(end>0) { end += _scan_extend_distance; }
  }
  if(start<0) { start = -1; }
  _region_start = start;
  _region_end   = end;

  fprintf(stderr,"TemplateCluster::_stream_by_named_region[%ld] %s %s %ld .. %ld\n", (long)this, assembly_name.c_str(), chrom_name.c_str(), start, end);

  _stream_features_mode  = true;

  //side stream is dominant one, so primary becomes slave to it
  if((side_stream() == NULL) || (source_stream() == NULL)) { 
    _template_stream_empty = true;
    return true;
  }
  //side_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
  side_stream()->stream_by_named_region(assembly_name, chrom_name, start, -1);
  
  //get first feature on the side stream
  EEDB::Feature *cluster = _extend_template_buffer();
  if(!cluster) { return true; }
  
  //check if first side-feature starts outside region, if so then done before we start
  if((_region_end>0) and (cluster->min_start() > _region_end)) {
    //fprintf(stderr, "TemplateCluster::_stream_by_named_region -- done before we start\n");
    cluster->release();
    _stream_clear();
    _template_stream_empty = true;
    return true;
  }
    
  //fprintf(stderr, "TemplateCluster (%s %s %ld..%ld) first cluster %s\n", 
  //        assembly_name.c_str(), chrom_name.c_str(), start, end,
  //        cluster->simple_xml().c_str());
  
  //now slave the primary stream to the first cluster start and stream it
  //open-ended until the end of the templates  
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, cluster->min_start(), -1);
}

//
////////////////////////////////////////////////////////////
//

EEDB::Feature* EEDB::SPStreams::TemplateCluster::_process_feature(MQDB::DBObject* obj) {
  if(obj==NULL) { return NULL; }
  
  EEDB::Feature  *in_feature =NULL;
  if(obj->classname() == EEDB::Feature::class_name) { in_feature = (EEDB::Feature*)obj; }
  if(in_feature==NULL) { return NULL; }

  EEDB::Feature *cluster = NULL;

  //
  // check if we are finished with clusters on the head of the buffer
  //
  if(!_template_buffer.empty()) {
    cluster = _template_buffer.front();
    while(!_edges_mode && (cluster!=NULL) and (cluster->max_end() < in_feature->chrom_start())) { 
      _template_buffer.pop_front();
      _calc_template_significance(cluster);
      if(_skip_empty_templates and (cluster->significance() <= 0.0)) { 
        cluster->release();
      } else {
        _completed_templates.push_back(cluster);
      }
      if(_template_buffer.empty()) { cluster = NULL; }
      else { cluster = _template_buffer.front(); }
    }
  }
  
  //
  // templates empty so this could mean a large gap so be careful about 
  // filling in, skip over templates which are finished before in_feature
  //
  if(_template_buffer.empty()) { 
    long skips = 0;
    //fprintf(stderr, "in_feature%s", in_feature->simple_xml().c_str());
    //fprintf(stderr, "_template_buffer.empty [region %ld .. %ld]\n", _region_start, _region_end);
    cluster = _extend_template_buffer();
    while(!_edges_mode && (cluster!=NULL) and (cluster->max_end() < in_feature->chrom_start())) {
      skips++;
      cluster = _template_buffer.front();
      _template_buffer.pop_front();
      _calc_template_significance(cluster);
      if(_skip_empty_templates and (cluster->significance() <= 0.0)) {
        cluster->release();
      } else {
        _completed_templates.push_back(cluster);
      }
      cluster = _extend_template_buffer();
    }
    if(skips>1000000) { fprintf(stderr, "TemplateCluster template_buffer skips %ld\n", skips); }
  }

  //
  // do work on the end of the buffer, 
  // fill in until we hit a template which is beyond(>in_feature)
  //
  if(!_template_buffer.empty()) { 
    cluster = _template_buffer.back();
    while(cluster and (cluster->min_start() <= in_feature->chrom_end())) {
      cluster = _extend_template_buffer();
    }
  }
  cluster = NULL;
  if(_template_buffer.empty()) { return NULL; }  //no more templates to process

  //
  // then process the overlaps in the buffer
  //
  _modify_ends(in_feature);

  // check for template_hit normalization, otherwise expression will not be
  // counted properly and over counted
  vector<EEDB::Feature*>    template_hits;
  for(unsigned int i=0; i<_template_buffer.size(); i++) {
    cluster = _template_buffer[i];
    if(!_ignore_strand and (cluster->strand()!=' ') and (in_feature->strand()!=' ') and (in_feature->strand() != cluster->strand())) { continue; }
    if(_overlap_check_subfeatures) {
      if(cluster->subfeature_overlap_check(in_feature, _subfeat_filter_categories)) { template_hits.push_back(cluster); }
    } else {
      if(cluster->overlaps(in_feature)) { template_hits.push_back(cluster);  }
    }
  }
  //fprintf(stderr, "%s hits %d templates\n", in_feature->chrom_location().c_str(), template_hits.size());

  for(unsigned int i=0; i<template_hits.size(); i++) {
    cluster = template_hits[i];
    if(obj->classname() == EEDB::Expression::class_name) {
      _cluster_add_expression(cluster, (EEDB::Expression*)obj, template_hits.size());
    }
    if(obj->classname() == EEDB::Feature::class_name) {
      vector<EEDB::Expression*>  expression = in_feature->expression_array();
      for(unsigned int j=0; j<expression.size(); j++) {
        _cluster_add_expression(cluster, expression[j], template_hits.size());
      }
    }
  }

  if(!_edges_mode && !_completed_templates.empty()) {
    EEDB::Feature *cluster = _completed_templates.front();
    _completed_templates.pop_front();
    return cluster;
  }
  if(_edges_mode) {
    if(template_hits.empty() || template_hits.size() >1) {
      fprintf(stderr, "%s hits %ld templates: WARN\n", in_feature->chrom_location().c_str(), template_hits.size());
    }
    //fprintf(stderr, "%s hits %ld templates\n", in_feature->chrom_location().c_str(), template_hits.size());
    if(!template_hits.empty()) {
      cluster = template_hits[0];
      return cluster;
    }
  }
  return NULL; 
}


EEDB::Feature*  EEDB::SPStreams::TemplateCluster::_extend_template_buffer() {
  //get next feature on the side/template stream and append into the _template_buffer
  if(_side_stream==NULL) { return NULL; }  
  if(_template_stream_empty) { return NULL; }
  MQDB::DBObject *obj = _side_stream->next_in_stream();
  while(obj!=NULL and (obj->classname() != EEDB::Feature::class_name)) {
    obj->release();
    obj = _side_stream->next_in_stream();
  }

  EEDB::Feature *feature = (EEDB::Feature*)obj;
  if(!_edges_mode and (obj!=NULL) and (_region_end>0) and (feature->min_start() > _region_end)) {
    //template is outside query region so can stop
    obj->release();
    obj = NULL;
  }

  //side_stream is presorted so push_back retains that sort order
  if(obj==NULL) { 
    _template_stream_empty = true; 
    _side_stream->stream_clear();
  } else { 
    _template_buffer.push_back((EEDB::Feature*)obj); 
    //fprintf(stderr, "extend_template_buffer : %s\n", feature->chrom_location().c_str());
  }
  return (EEDB::Feature*)obj;
}


void  EEDB::SPStreams::TemplateCluster::_calc_template_significance(EEDB::Feature* feature) {
  //final post processing of cluster prior to returning
  if(feature==NULL) { return; }
  
  if(_overlap_mode == "area") {
    vector<EEDB::Expression*>  expression = feature->expression_array();
    for(unsigned int j=0; j<expression.size(); j++) {
      EEDB::Expression *expr = expression[j];
      double value = expr->value() / expr->duplication();
      expr->value(value);
      expr->duplication(1.0);
    }
  }
  
  double significance = 0.0;
  vector<EEDB::Expression*>  expression = feature->expression_array();
  for(unsigned int i=0; i<expression.size(); i++) {
    switch(_expression_mode) {      
      case CL_MIN: 
        if(i==0) { significance = expression[i]->value(); }
        else if(expression[i]->value() < significance) { significance = expression[i]->value(); }
        break;
      case CL_MAX: 
        if(i==0) { significance = expression[i]->value(); }
        else if(expression[i]->value() > significance) { significance = expression[i]->value(); }
        break;
      case CL_SUM: 
      case CL_MEAN: 
        significance += expression[i]->value();
        break;
      case CL_COUNT: 
        significance++;
        break;
      case CL_NONE: 
        significance = feature->significance();
        break;
    }
  }
  if(_expression_mode == CL_MEAN) {
    significance = significance / expression.size();
  }      
  feature->significance(significance);
}


void EEDB::SPStreams::TemplateCluster::_modify_ends(EEDB::Feature *feature) {
  if(feature ==NULL) { return; }

  long int start = feature->chrom_start();
  long int end   = feature->chrom_end();
  if(_overlap_mode == "5end") {
    if(feature->strand() == '+') { feature->chrom_end(start); }
    if(feature->strand() == '-') { feature->chrom_start(end); }
    if(feature->strand() == ' ') { feature->chrom_end(start); }
  }
  if(_overlap_mode == "3end") {
    if(feature->strand() == '+') { feature->chrom_start(end); }
    if(feature->strand() == '-') { feature->chrom_end(start); }
    if(feature->strand() == ' ') { feature->chrom_start(end); }
  }
  if(_overlap_distance > 0) {
    feature->chrom_start(feature->chrom_start() - _overlap_distance);
    feature->chrom_end(feature->chrom_end() + _overlap_distance);
  }
}


void EEDB::SPStreams::TemplateCluster::_cluster_add_expression(EEDB::Feature *cluster, EEDB::Expression *express, long dup_count) {
  if(express==NULL or cluster==NULL) { return; }
  if(express->value() == 0.0) { return; }
  EEDB::Experiment *experiment = express->experiment();
  if(experiment==NULL) { return; }
  
  cluster->build_expression_hash();
  EEDB::Expression *expr = cluster->get_expression(experiment, express->datatype());
  //fprintf(stderr, "  cluster %s exp [%s] v=%f d=%f\n", cluster->chrom_location().c_str(), expr->datatype()->type().c_str(), expr->value(), expr->duplication());
  double value = expr->value();
  double eff_value = expr->value() / expr->duplication();
  switch(_expression_mode) {
    case CL_MEAN: 
    case CL_SUM: 
      value     += express->value();
      eff_value += (express->value() / express->duplication()) / dup_count;
      break;
    case CL_MIN: 
      if(express->value() < value) { 
        value     = express->value(); 
        eff_value = express->value();
      }
      break;
    case CL_MAX: 
      if(express->value() > value) { 
        value = express->value(); 
        eff_value = express->value();
      }
      break;
    case CL_COUNT: 
      value += 1.0;
      eff_value = value;
      break;
    case CL_NONE: 
      break;
  }
  expr->value(value);
  expr->count(expr->count() + express->count());
  expr->duplication(value / eff_value);
  //fprintf(stderr, "    merged v=%f d=%f\n", expr->value(), expr->duplication());
}


/*****************************************************************************************/

void EEDB::SPStreams::TemplateCluster::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass

  //older style of <ignore_strand value="1" />
  if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  else { xml_buffer.append("<ignore_strand>false</ignore_strand>"); }
  
  if(_skip_empty_templates) { xml_buffer.append("<skip_empty_templates>true</skip_empty_templates>"); }
  else { xml_buffer.append("<skip_empty_templates>false</skip_empty_templates>"); }
  
  if(!_overlap_mode.empty()) { 
    xml_buffer.append("<overlap_mode>");
    xml_buffer.append(_overlap_mode);
    xml_buffer.append("</overlap_mode>"); 
  }
  if(_overlap_distance > 0) {
    char buffer[256];
    snprintf(buffer, 256, "<distance>%ld</distance>", _overlap_distance);
    xml_buffer.append(buffer);        
  }  
  if(_scan_extend_distance > 0) {
    char buffer[256];
    snprintf(buffer, 256, "<scan_extend_distance>%ld</scan_extend_distance>", _scan_extend_distance);
    xml_buffer.append(buffer);        
  }  

  if(_overlap_check_subfeatures) { xml_buffer.append("<overlap_subfeatures>true</overlap_subfeatures>"); }
  else { xml_buffer.append("<overlap_subfeatures>false</overlap_subfeatures>"); }
  
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  
  switch(_expression_mode) {
    case CL_SUM:   xml_buffer.append("<expression_mode>sum</expression_mode>"); break;
    case CL_MIN:   xml_buffer.append("<expression_mode>min</expression_mode>");break;
    case CL_MAX:   xml_buffer.append("<expression_mode>max</expression_mode>");break;
    case CL_COUNT: xml_buffer.append("<expression_mode>count</expression_mode>");break;
    case CL_MEAN:  xml_buffer.append("<expression_mode>mean</expression_mode>");break;
    case CL_NONE:  xml_buffer.append("<expression_mode>none</expression_mode>");break;
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::TemplateCluster::TemplateCluster(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("overlap_mode")) != NULL) {
    overlap_mode(string(node->value()));
  }

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

  if((node = root_node->first_node("distance")) != NULL) {
    _overlap_distance = strtol(node->value(), NULL, 10);
    if(_overlap_distance<0) { _overlap_distance = 0; }
  }
  if(((node = root_node->first_node("scan_extend_distance")) != NULL) ||
     ((node = root_node->first_node("prescan_distance")) != NULL)) {
    _scan_extend_distance = strtol(node->value(), NULL, 10);
    if(_scan_extend_distance<0) { _scan_extend_distance = 0; }
  }

  _skip_empty_templates = true;
  if((node = root_node->first_node("skip_empty_templates")) != NULL) { 
    if(string(node->value()) == "false") { _skip_empty_templates=false; }
  }
    
  _ignore_strand = false;
  if((node = root_node->first_node("ignore_strand")) != NULL) { 
    if(string(node->value()) == "true") { _ignore_strand=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _ignore_strand=true;
    }
  }
  if((node = root_node->first_node("overlap_subfeatures")) != NULL) {
    _overlap_check_subfeatures=false;
    if(string(node->value()) == "true") { _overlap_check_subfeatures=true; }
  }  
  
  if((node = root_node->first_node("category_filter")) != NULL) {
    _subfeat_filter_categories.clear();
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }
  
  if(((node = root_node->first_node("template_stream")) != NULL) || ((node = root_node->first_node("side_stream")) != NULL)) {
    create_side_stream_from_xml(node);
  }
}

//---------------------------------------------------------------------
//
// Edge version of code
//
//---------------------------------------------------------------------

EEDB::Edge* EEDB::SPStreams::TemplateCluster::_process_edge(MQDB::DBObject* obj) {
  if(obj==NULL) { return NULL; }
  
  EEDB::Edge  *in_edge =NULL;
  if(obj->classname() == EEDB::Edge::class_name) { in_edge = (EEDB::Edge*)obj; }
  if(in_edge==NULL) { return NULL; }

//   fprintf(stderr, "process_edge %c %ld..%ld (%ld bp) %s : %s - %s\n", 
//           in_edge->direction(), in_edge->chrom_start(), in_edge->chrom_end(),
//           in_edge->chrom_end() - in_edge->chrom_start() +1,
//           in_edge->feature1()->primary_name().c_str(), 
//           in_edge->feature1()->chrom_location().c_str(), in_edge->feature2()->chrom_location().c_str());

  if((_region_end>0) and (in_edge->chrom_start() > _region_end)) {
    fprintf(stderr, "edge starts after _region_end : STOP IT!!!\n");
    //we can stop processing, so clear the primary stream
    _source_stream->stream_clear(); 
    //fprintf(stderr, "TemplateCluster:: templates done\n");
    fprintf(stderr, "final edge_buffer %ld edges\n", _edge_buffer.size());
    return NULL;
  }

  //process f1/f2 into templates and update in_edge with templates
  _edges_mode = true;
  EEDB::Feature *f1 = _process_feature(in_edge->feature1());
  if(f1) {
    //fprintf(stderr, "f1 %s => %s\n", in_edge->feature1()->chrom_location().c_str(), f1->chrom_location().c_str());
    in_edge->feature1(f1);
  }
  
  EEDB::Feature *f2 = _process_feature(in_edge->feature2());
  if(f2) {
    //fprintf(stderr, "f2 %s => %s\n", in_edge->feature2()->chrom_location().c_str(), f2->chrom_location().c_str());
    in_edge->feature2(f2);
  }

  //TODO: magic to merge edges
  EEDB::Edge *out_edge = NULL;
  for(unsigned int i=0; i<_edge_buffer.size(); i++) { 
    EEDB::Edge *tedge = _edge_buffer[i];
    if(!tedge) { continue; }
    
    if((tedge->feature1() == in_edge->feature1()) && 
       (tedge->feature2() == in_edge->feature2())) {
      //fprintf(stderr, "merge into template edge %s - %s\n", tedge->feature1()->chrom_location().c_str(), tedge->feature2()->chrom_location().c_str());
      //metadata
      tedge->metadataset()->merge_metadataset(in_edge->metadataset());
      tedge->metadataset()->remove_duplicates();
    
      //TODO: edge_weight
      vector<EEDB::EdgeWeight*>  weights = in_edge->edgeweight_array();
      for(unsigned int j=0; j<weights.size(); j++) {
        _edge_merge_weight(tedge, weights[j]);
      }

      out_edge = tedge;
      break;
    } 
  }
  
  if(!out_edge) {
    //fprintf(stderr, "new template edge  f1 %s => f2 %s\n", in_edge->feature1()->chrom_location().c_str(), in_edge->feature2()->chrom_location().c_str());
    in_edge->calc_direction();
    in_edge->retain();
    _edge_buffer.push_back(in_edge);
  }

  //return out_edge; //not sure, I think I have to keep all edges in buffer until end
  return NULL;
}


void EEDB::SPStreams::TemplateCluster::_edge_merge_weight(EEDB::Edge *edge, EEDB::EdgeWeight *weight) {
  if(weight==NULL or edge==NULL) { return; }
  if(weight->weight() == 0.0) { return; }
  EEDB::DataSource *datasource = weight->datasource();
  if(datasource==NULL) { return; }
  
  EEDB::EdgeWeight *wgt = edge->find_edgeweight(datasource, weight->datatype());
  if(!wgt) {
    //fprintf(stderr, "no weight for %s : just add\n", datasource->db_id().c_str());
    edge->add_edgeweight(weight);
    return;
  }
  
  //fprintf(stderr, "  edge %s exp [%s] v=%f d=%f\n", edge->chrom_location().c_str(), expr->datatype()->type().c_str(), wgt->weight());
  double value = wgt->weight();
  switch(_expression_mode) {
    case CL_MEAN: 
    case CL_SUM: 
      value     += weight->weight();
      break;
    case CL_MIN: 
      if(weight->weight() < value) { 
        value     = weight->weight(); 
      }
      break;
    case CL_MAX: 
      if(weight->weight() > value) { 
        value = weight->weight(); 
      }
      break;
    case CL_COUNT: 
      value += 1.0;
      break;
    case CL_NONE: 
      break;
  }
  wgt->weight(value);
  //fprintf(stderr, "    merged v=%f d=%f\n", wgt->weight());
}

