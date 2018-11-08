/* $Id: Paraclu.cpp,v 1.27 2016/08/02 07:21:36 severin Exp $ */

/***

NAME - EEDB::SPStreams::Paraclu

SYNOPSIS

DESCRIPTION

  Port of the paraclu program into a ZENBU SPStream module
  Copyright 2011 Martin C. Frith
 
  Find clusters in 1-dimensional data, using the method described in
  MC Frith et al. Genome Res. 2008 18(1):1-12.
 
  http://www.cbrc.jp/paraclu/
 
  The original command line code uses the input
    4 columns: chromosome, strand, coordinate, value.
    For example: chr20 + 60026 2
 
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

#include <algorithm>  // max, min
#include <cstdlib>  // EXIT_SUCCESS, EXIT_FAILURE
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <vector>

#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Paraclu.h>

using namespace std;

const char*  EEDB::SPStreams::Paraclu::class_name = "EEDB::SPStreams::Paraclu";

//function prototypes
void _spstream_paraclu_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::Paraclu*)obj;
}
MQDB::DBObject* _spstream_paraclu_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::Paraclu*)node)->_next_in_stream();
}
void _spstream_paraclu_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::Paraclu*)node)->_reset_stream_node();
}
void _spstream_paraclu_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::Paraclu*)obj)->_xml(xml_buffer);
}
string _spstream_paraclu_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::Paraclu*)obj)->_display_desc();
}
bool _spstream_paraclu_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::Paraclu*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}

//const double infinity = 1e100;

////////////////////////////////////////////////////////////////////////////
//
// creation methods
//
////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::Paraclu::Paraclu() {
  init();
}

EEDB::SPStreams::Paraclu::~Paraclu() {
  if(_feature_source) {
    _feature_source->release();
    _feature_source = NULL;
  }
  if(_output_buffer) {
    _output_buffer->release();
    _output_buffer = NULL;
  }
  if(_paraclu_tool_plus) {
    _paraclu_tool_plus->release();
    _paraclu_tool_plus = NULL;
  }
  if(_paraclu_tool_minus) {
    _paraclu_tool_minus->release();
    _paraclu_tool_minus = NULL;
  }
}

void EEDB::SPStreams::Paraclu::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::Paraclu::class_name;
  _module_name               = "Paraclu";
  _funcptr_delete            = _spstream_paraclu_delete_func;
  _funcptr_xml               = _spstream_paraclu_xml_func;
  _funcptr_simple_xml        = _spstream_paraclu_xml_func;
  _funcptr_display_desc      = _spstream_paraclu_display_desc_func;

  _funcptr_next_in_stream           = _spstream_paraclu_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_paraclu_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_paraclu_stream_by_named_region_func;
  
  _min_cutoff_value    = 10.0;
  _max_cluster_length  = 100;
  _min_stability       = 1;
  _min_density         = 0;
  _selection_mode      = EEDB::BEST_STABLE; 

  _region_start        = -1;
  _region_end          = -1;

  //attributes
  _feature_source = new EEDB::FeatureSource();
  _feature_source->name("Paraclu");
  _feature_source->category("cluster");
  
  _output_buffer = new EEDB::Tools::ResortBuffer();
  _output_buffer->unique_features(false);
  _output_buffer->match_category(false);
  _output_buffer->match_source(false);
  _output_buffer->expression_mode(CL_SUM);
  
  _paraclu_tool_plus  = new EEDB::Tools::Paraclu();
  _paraclu_tool_minus = new EEDB::Tools::Paraclu();

  _paraclu_tool_plus->output_buffer(_output_buffer);
  _paraclu_tool_minus->output_buffer(_output_buffer);

  _paraclu_tool_plus->feature_source(_feature_source);
  _paraclu_tool_minus->feature_source(_feature_source);
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::Paraclu::_display_desc() {
  string str = "Paraclu";

  switch(_selection_mode) {
    case FULL_HIERARCHY:  str.append(" mode(full_hierarchy)"); break;
    case BEST_STABLE:     str.append(" mode(most_stable)"); break;
    case STABILITY_CUT:   str.append(" mode(stability_cut)"); break;
    case SMALL_STABLE:    str.append(" mode(small_stable)"); break;
  }

  char buffer[256];
  snprintf(buffer, 256, " min_cutoff(%f)", _min_cutoff_value);
  str.append(buffer);

  snprintf(buffer, 256, " stability(%f)", _min_stability);
  str.append(buffer);

  snprintf(buffer, 256, " max_cluster_length(%ld)", _max_cluster_length);
  str.append(buffer);

  return str;
}


void EEDB::SPStreams::Paraclu::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  char buffer[256];
  snprintf(buffer, 256, "<min_cutoff>%f</min_cutoff>", _min_cutoff_value);
  xml_buffer.append(buffer);

  snprintf(buffer, 256, "<stability>%f</stability>", _min_stability);
  xml_buffer.append(buffer);

  snprintf(buffer, 256, "<max_cluster_length>%ld</max_cluster_length>", _max_cluster_length);
  xml_buffer.append(buffer);

  if(_min_density>0) {
    snprintf(buffer, 256, "<min_density>%f</min_density>", _min_density);
    xml_buffer.append(buffer);
  }
  
  switch(_selection_mode) {
    case FULL_HIERARCHY:  xml_buffer.append("<mode>full_hierarchy</mode>"); break;
    case BEST_STABLE:     xml_buffer.append("<mode>most_stable</mode>"); break;
    case STABILITY_CUT:   xml_buffer.append("<mode>stability_cut</mode>"); break;
    case SMALL_STABLE:    xml_buffer.append("<mode>small_stable</mode>"); break;
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::Paraclu::Paraclu(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("min_cutoff")) != NULL) {
    _min_cutoff_value = strtod(node->value(), NULL);
    if(_min_cutoff_value < 0) { _min_cutoff_value = 0; }
  }  

  if((node = root_node->first_node("stability")) != NULL) {
    _min_stability = strtod(node->value(), NULL);
    if(_min_stability < 1.0) { _min_stability = 1.0; }
  }  

  if((node = root_node->first_node("max_cluster_length")) != NULL) {
    _max_cluster_length = strtol(node->value(), NULL, 10);
    if(_max_cluster_length < 2) { _max_cluster_length = 2; }
  } 
  
  if((node = root_node->first_node("min_density")) != NULL) {
    _min_density = strtod(node->value(), NULL);
    if(_min_density < 0) { _min_density = 0; }
  }  
  
  _selection_mode = STABILITY_CUT;
  if(((node = root_node->first_node("full_hierarchy")) != NULL) and (string(node->value()) == "true")) {
    _selection_mode = FULL_HIERARCHY;
  }
  if(((node = root_node->first_node("most_stable")) != NULL) and (string(node->value()) == "true")) {
    _selection_mode = BEST_STABLE;
  }
  if((node = root_node->first_node("mode")) != NULL) {
    if(string(node->value()) == "full_hierarchy") { _selection_mode = FULL_HIERARCHY; }
    if(string(node->value()) == "most_stable")    { _selection_mode = BEST_STABLE; }
    if(string(node->value()) == "stability_cut")  { _selection_mode = STABILITY_CUT; }
    if(string(node->value()) == "small_stable")  { _selection_mode = SMALL_STABLE; }
  }
  
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::Paraclu::_reset_stream_node() {  
  _output_buffer->reset();
  _region_start        = -1;
  _region_end          = -1;

  _paraclu_tool_plus->reset();
  _paraclu_tool_plus->min_value(_min_cutoff_value);
  _paraclu_tool_plus->min_stability(_min_stability);
  _paraclu_tool_plus->max_cluster_length(_max_cluster_length);
  _paraclu_tool_plus->min_density(_min_density);
  _paraclu_tool_plus->selection_mode(_selection_mode);

  _paraclu_tool_minus->reset();
  _paraclu_tool_minus->min_value(_min_cutoff_value);
  _paraclu_tool_minus->min_stability(_min_stability);
  _paraclu_tool_minus->max_cluster_length(_max_cluster_length); 
  _paraclu_tool_minus->min_density(_min_density);
  _paraclu_tool_minus->selection_mode(_selection_mode);
}


bool EEDB::SPStreams::Paraclu::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  //fprintf(stderr,"Paraclu::_stream_by_named_region %s %ld .. %ld\n", chrom_name.c_str(), start, end);
  _region_start = start;
  _region_end   = end;

  // adjust range to grab more data up/down stream if needed so that clusters are correct
  long extra = _max_cluster_length * 8;
  if(start != -1) { 
    start = start - extra;
    if(start <1) { start = 1; }
  }
  if(end != -1) { end = end + extra; }

  bool rtn = true;
  if(source_stream() != NULL) { 
    //fprintf(stderr,"Paraclu:: adjust  %s %ld .. %ld\n", chrom_name.c_str(), start, end);
    rtn &= source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
  }
  //fprintf(stderr, "%s\n", display_desc().c_str());
  return rtn;
}


MQDB::DBObject* EEDB::SPStreams::Paraclu::_next_in_stream() {
  MQDB::DBObject *obj;
  
  EEDB::Feature *cluster = _output_buffer->next_completed_feature();
  while(cluster) {
    //fprintf(stderr, "completed %s\t%s\n", cluster->chrom_location().c_str(), cluster->primary_name().c_str());
    if((_region_start== -1 or (cluster->chrom_end() >= _region_start)) and
       (_region_end  == -1 or (cluster->chrom_start() <= _region_end))) { 
      return cluster; 
    }
    cluster->release();
    cluster = _output_buffer->next_completed_feature();
  }
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature\expression objects are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      EEDB::Feature *in_feature = (EEDB::Feature *)obj;
      //fprintf(stderr, "paraclu input %s\n", in_feature->chrom_location().c_str());
      if(in_feature->strand() == '-') {
        _paraclu_tool_minus->process_feature(in_feature);
      } else {
        _paraclu_tool_plus->process_feature(in_feature);
      }
      //_output_buffer->transfer_completed(in_feature->chrom_start() - _max_cluster_length);

      in_feature->release();  //now retained by each paraclu tool
      
      cluster = _output_buffer->next_completed_feature();
      if(cluster) {
        //fprintf(stderr, "completed %s\t%s\n", cluster->chrom_location().c_str(), cluster->primary_name().c_str());
        if((_region_start== -1 or (cluster->chrom_end() >= _region_start)) and
           (_region_end  == -1 or (cluster->chrom_start() <= _region_end))) { 
          return cluster; 
        }
        cluster->release();
      }
    }
  }
  
  //fprintf(stderr, "paraclu no input, finish processing\n");
  _paraclu_tool_plus->finish_processing();
  _paraclu_tool_minus->finish_processing();

  _output_buffer->transfer_all_to_completed();
  
  // return next completed feature if available
  cluster = _output_buffer->next_completed_feature();
  while(cluster) {
    //fprintf(stderr, "completed %s\t%s\n", cluster->chrom_location().c_str(), cluster->primary_name().c_str());
    if((_region_start== -1 or (cluster->chrom_end() >= _region_start)) and
       (_region_end  == -1 or (cluster->chrom_start() <= _region_end))) { 
      return cluster; 
    }
    cluster->release();
    cluster = _output_buffer->next_completed_feature();
  }

  return NULL; 
}

