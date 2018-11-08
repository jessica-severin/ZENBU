/* $Id: ResortBuffer.cpp,v 1.31 2016/05/19 10:28:28 severin Exp $ */

/***

NAME - EEDB::Tools::ResortBuffer

SYNOPSIS

DESCRIPTION

 A tool to encapsulate the double resort buffer concept when needing to 
 modify the feature stream which might result in a change in sort order
 
CONTACT

Jessica Severin <severin@gsc.riken.jp> <jessica.severin@gmail.com>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
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
#include <EEDB/Tools/ResortBuffer.h>

using namespace std;
using namespace MQDB;

////////////////////////////////////////////////////////////////////////////
//
// ResortBuffer section
//
////////////////////////////////////////////////////////////////////////////

const char*  EEDB::Tools::ResortBuffer::class_name = "EEDB::Tools::ResortBuffer";

//function prototypes
void _tools_resortbuffer_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::ResortBuffer*)obj;
}
void _tools_resortbuffer_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Tools::ResortBuffer*)obj)->_xml(xml_buffer);
}
string _tools_resortbuffer_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::Tools::ResortBuffer*)obj)->_display_desc();
}


EEDB::Tools::ResortBuffer::ResortBuffer() {
  init();
}

EEDB::Tools::ResortBuffer::~ResortBuffer() {
}

void EEDB::Tools::ResortBuffer::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::Tools::ResortBuffer::class_name;
  _module_name               = "ResortBuffer";
  _funcptr_delete            = _tools_resortbuffer_delete_func;
  _funcptr_xml               = _tools_resortbuffer_xml_func;
  _funcptr_simple_xml        = _tools_resortbuffer_xml_func;
  _funcptr_display_desc      = _tools_resortbuffer_display_desc_func;

  _feature_buffer_start = NULL;
  _feature_buffer_end   = NULL;
  _completed_start      = NULL;
  _completed_end        = NULL;
  
  _unique_features  = false;
  _match_category   = false;
  _match_source     = false;
  _match_strand     = true;
  _match_subfeatures = false;
  _merge_metadata   = false;
  _expression_mode  = CL_SUM;
}


string EEDB::Tools::ResortBuffer::_display_desc() {
  string str = "ResortBuffer";
  return str;
}


void EEDB::Tools::ResortBuffer::_xml(string &xml_buffer) {
  if(_unique_features) { xml_buffer.append("<unique_features>true</unique_features>"); }
  if(_match_category) { xml_buffer.append("<match_category>true</match_category>"); }
  if(_match_source) { xml_buffer.append("<match_source>true</match_source>"); }
  if(!_match_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  if(_match_subfeatures) { xml_buffer.append("<match_subfeatures>true</match_subfeatures>"); }
  if(_merge_metadata) { xml_buffer.append("<merge_metadata>true</merge_metadata>"); }
  xml_buffer += "<expression_mode>"+_expression_mode_string()+"</expression_mode>";  
}


void  EEDB::Tools::ResortBuffer::init_xml(void *xml_node) {
  // initialize using a rapidxml description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
    
  _unique_features  = false;
  _match_category   = false;
  _match_source     = false;
  _match_strand     = true;
  _match_subfeatures = false;
  _merge_metadata   = false;
  _expression_mode  = CL_SUM;
  
  if((node = root_node->first_node("match_category")) != NULL) { 
    if(string(node->value()) == "true") { _match_category = true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _match_category = true;
    }
  }
  if((node = root_node->first_node("match_source")) != NULL) { 
    if(string(node->value()) == "true") { _match_source = true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _match_source = true;
    }
  }
  if((node = root_node->first_node("ignore_strand")) != NULL) { 
    if(string(node->value()) == "true") { _match_strand = false; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _match_strand = false;
    }
  }
  if((node = root_node->first_node("match_subfeatures")) != NULL) { 
    if(string(node->value()) == "true") { _match_subfeatures = true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _match_subfeatures = true;
    }
  }  
  if((node = root_node->first_node("merge_metadata")) != NULL) { 
    if(string(node->value()) == "true") { _merge_metadata = true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _merge_metadata = true;
    }
  }
  if((node = root_node->first_node("expression_mode")) != NULL) { 
    string mode = node->value();
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
// methods to working with completed features 
//
////////////////////////////////////////////////////////////////////////////


void EEDB::Tools::ResortBuffer::reset() {  
  EEDB::FeatureLink *fl2, *fl = _feature_buffer_start;
  while(fl !=NULL) {
    fl->feature->release();
    fl2 = fl;
    fl = fl->next;
    delete fl2;
  }
  _feature_buffer_start = NULL;
  _feature_buffer_end   = NULL;

  fl = _completed_start;
  while(fl !=NULL) {
    fl->feature->release();
    fl2 = fl;
    fl = fl->next;
    delete fl2;
  }
  _completed_start = NULL;
  _completed_end   = NULL;
}



EEDB::Feature*  EEDB::Tools::ResortBuffer::next_completed_feature() {
  if(_completed_start == NULL) { return NULL; }
  
  EEDB::FeatureLink *fl = _completed_start;
  
  _completed_start = fl->next;
  if(_completed_start) { 
    _completed_start->prev = NULL; 
  } else {
    _completed_start = NULL;
    _completed_end   = NULL;
  }

  EEDB::Feature* feature = fl->feature;
  delete fl;
  if(feature) { feature->calc_significance(_expression_mode); }
  return feature; 
}


void  EEDB::Tools::ResortBuffer::transfer_all_to_completed() {  
  if(_feature_buffer_start==NULL) { return; }

  //just link the two lists together
  if(_completed_end) {
    _completed_end->next = _feature_buffer_start;
    _feature_buffer_start->prev = _completed_end;
    _completed_end = _feature_buffer_end;
  } else {
    _completed_start = _feature_buffer_start;
    _completed_end   = _feature_buffer_end;
  }

  _feature_buffer_start = NULL;
  _feature_buffer_end   = NULL;
}


void  EEDB::Tools::ResortBuffer::transfer_completed(long chrom_start) {
  // check if we are finished with features on the head of the _feature_buffer
  // which 'end' before 'chrom_start'
  if(_feature_buffer_start==NULL) { return; }
  
  EEDB::FeatureLink *rbe1, *fl = _feature_buffer_start;
  while(fl!=NULL) {
    //if(fl->feature->chrom_end() >= chrom_start) { break; }    
    if(fl->feature->chrom_start() >= chrom_start) { break; }    
    fl = fl->next;
  }
  
  if(fl) {
    if(fl == _feature_buffer_start) { 
      //still on start so nothing to transfer
      return; 
    }

    //fl is new _feature_buffer_start and everything before this needs to transfer
    rbe1 = fl->prev;
    if(_completed_end) {
      _completed_end->next = _feature_buffer_start;
      _feature_buffer_start->prev = _completed_end;
    } else {
      _completed_start = _feature_buffer_start;
    }
    _completed_end = rbe1;
    _completed_end->next = NULL;
    _feature_buffer_start = fl;
    _feature_buffer_start->prev = NULL;    
  } else {
    //walked through entire feature buffer so transfer everything
    transfer_all_to_completed();
    return;
  }
}
  

long  EEDB::Tools::ResortBuffer::completed_buffer_size() {
  long count=0;
  EEDB::FeatureLink *fl = _completed_start;
  while(fl!=NULL) {
    count++;
    fl = fl->next;
  }
  return count;
}

//
////////////////////////////////////////////////////////////
//

bool _resortbuffer_feature_sort_func (EEDB::Feature *a, EEDB::Feature *b) { 
  if(a->chrom_start() < b->chrom_start()) { return true; }
  if(a->chrom_start() > b->chrom_start()) { return false; }

  if(a->chrom_end() < b->chrom_end()) { return true; }
  if(a->chrom_end() > b->chrom_end()) { return false; }

  if(a->strand() < b->strand()) { return true; }
  return false;
}


void  EEDB::Tools::ResortBuffer::insert_feature(EEDB::Feature* feature) {
  if(!feature) { return; }
    
  if(_unique_features) {
    if(!_match_strand) { //strip the strand off of the feature to make it strandless
      feature->strand(' ');
    }
    
    feature->significance(1.0);
    feature->primary_id(-1); //manipulating features so no longer same as original
    feature->peer_uuid(NULL); //manipulating features so no longer same as original

    /*
    vector<EEDB::Expression*>  expression = feature->expression_array();    
    //add count datatype for each experiment
    for(unsigned int i=0; i<expression.size(); i++) {      
      EEDB::Expression *expr1 = expression[i];
      EEDB::Expression *expr2 = feature->get_expression(expr1->experiment(), EEDB::Datatype::get_type("unique_count"));
      if(expr2->value() == 0) {
        expr2->value(1);
        expr2->count(1);
      }
    }
    */
  }

  EEDB::FeatureLink *nfl = new EEDB::FeatureLink();
  nfl->feature = feature;

  if(_feature_buffer_start == NULL) {
    _feature_buffer_start = nfl;
    _feature_buffer_end   = nfl;
    return;
  }

  //insert sort by moving backward from end of _feature_buffer
  EEDB::FeatureLink *fl = _feature_buffer_end;
  
  while(fl && _resortbuffer_feature_sort_func(feature, fl->feature)) {
    fl = fl->prev;
  }
  
  if(fl) {
    //feature falls between fl and fl->next
    
    if(_unique_features) {
      if(_merge_unique_features(fl->feature, feature)) {
        feature->release();
        delete nfl;
        return;
      }
    }

    nfl->prev = fl;
    nfl->next = fl->next;
    fl->next = nfl;
    if(nfl->next) { 
      nfl->next->prev = nfl; 
    } else {
      _feature_buffer_end = nfl; //new end
    }
  } else {
    // feature falls at the front of the buffer
    if(_feature_buffer_start && _unique_features) {
      // need to check unique merge with head of buffer
      if(_merge_unique_features(_feature_buffer_start->feature, feature)) {
        feature->release();
        delete nfl;
        return;
      }
    }
    nfl->next = _feature_buffer_start;
    _feature_buffer_start->prev = nfl;
    _feature_buffer_start = nfl;
  }  
}


void  EEDB::Tools::ResortBuffer::remove_link(FeatureLink *flink) {
  if(!flink) { return; }
  
  FeatureLink* fl1 = flink->prev;
  FeatureLink* fl2 = flink->next;

  if(fl1) { fl1->next = fl2; }
  if(fl2) { fl2->prev = fl1; }
  
  if(_feature_buffer_start == flink) { _feature_buffer_start = fl2; }  
  if(_feature_buffer_end == flink)   { _feature_buffer_end = fl1; }
}



//
///////////////////////////////////////////////////////////////////////
//
// unique feature code
//

string EEDB::Tools::ResortBuffer::_expression_mode_string() {
  string mode_str;
  switch(_expression_mode) {
    case CL_SUM:   
      mode_str = "sum";
      break;
    case CL_MIN:   
      mode_str = "min";
      break;
    case CL_MAX:   
      mode_str = "max";
      break;
    case CL_COUNT: 
      mode_str = "count";
      break;
    case CL_MEAN:  
      mode_str = "mean";
      break;
    case CL_NONE:
      mode_str = "none";
      break;
  }
  return mode_str;
}


bool EEDB::Tools::ResortBuffer::_merge_unique_features(EEDB::Feature *feat1, EEDB::Feature *feat2) {
  //merges data from feat2 into feat1 if unique match
  if(feat1==NULL or feat2==NULL) { return false; }
  
  //check coordinate
  if(feat1->chrom_start() != feat2->chrom_start()) { return false; }
  if(feat1->chrom_end() != feat2->chrom_end()) { return false; }
  
  if(_match_strand && (feat1->strand() != feat2->strand())) { return false; }
  
  if(_match_category) { //do additional category check
    if(feat1->feature_source()->category() != feat2->feature_source()->category()) { return false; }
  }
  if(_match_source) {
    if(feat1->feature_source()->db_id() != feat2->feature_source()->db_id()) { return false; }
  }
  if(_match_subfeatures && !feat1->subfeatures_match(feat2)) { return false; }
    
  // OK can merge
  
  //simple count of merges
  feat1->significance(feat1->significance()+1.0);
  
  //collate expression from feat2 into feat1  
  vector<EEDB::Expression*>  expression = feat2->expression_array();
  for(unsigned int i=0; i<expression.size(); i++) {
    
    EEDB::Expression *expr2 = expression[i];
    EEDB::Expression *expr1 = feat1->find_expression(expr2->experiment(), expr2->datatype());
    
    if(expr1) {
      double value = expr1->value();
      double eff_value = expr1->value() / expr1->duplication();
      switch(_expression_mode) {
        case CL_MIN:
          if(i==0) { value = expr2->value(); }
          else if(expr2->value() < value) { value = expr2->value(); }
          break;
        case CL_MAX:
          if(i==0) { value = expr2->value(); }
          else if(expr2->value() > value) { value = expr2->value(); }
          break;
        case CL_SUM:
          value     += expr2->value();
          eff_value += expr2->value() / expr2->duplication();
          break;
        case CL_MEAN:
          value     += expr2->value();
          eff_value += expr2->value() / expr2->duplication();
          break;
        case CL_COUNT:
          value++;
          break;
        case CL_NONE:
          break;
      }
      expr1->value(value);
      expr1->count(expr1->count() + expr2->count());
      expr1->duplication(value / eff_value);
    } else {
      feat1->copy_expression(expr2);
    }
  }

  if(_merge_metadata) {
    //merge the metadata from feat2 into feat1
    feat1->metadataset()->merge_metadataset(feat2->metadataset());
    feat1->metadataset()->remove_duplicates();
  }

  return true;
}


