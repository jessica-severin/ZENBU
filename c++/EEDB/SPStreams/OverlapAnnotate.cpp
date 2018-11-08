/* $Id: OverlapAnnotate.cpp,v 1.7 2013/11/26 08:50:14 severin Exp $ */

/***

NAME - EEDB::SPStreams::OverlapAnnotate

SYNOPSIS

DESCRIPTION

a simple SPStream which has an internal buffer. allows for external filling of buffer
or to fill from the source_stream();

CONTACT

Jessica Severin <severin@gsc.riken.jp>

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
#include <EEDB/Feature.h>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/OverlapAnnotate.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::OverlapAnnotate::class_name = "EEDB::SPStreams::OverlapAnnotate";

//function prototypes
MQDB::DBObject* _spstream_overlapannotate_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::OverlapAnnotate*)node)->_next_in_stream();
}
void _spstream_overlapannotate_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OverlapAnnotate*)node)->_reset_stream_node();
}
void _spstream_overlapannotate_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::OverlapAnnotate*)obj;
}
void _spstream_overlapannotate_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::OverlapAnnotate*)obj)->_xml(xml_buffer);
}
bool _spstream_overlapannotate_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::OverlapAnnotate*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}


EEDB::SPStreams::OverlapAnnotate::OverlapAnnotate() {
  init();
}

EEDB::SPStreams::OverlapAnnotate::~OverlapAnnotate() {
  _reset_stream_node();
}


void EEDB::SPStreams::OverlapAnnotate::init() {
  EEDB::SPStreams::MergeStreams::init();  
  _classname                  = EEDB::SPStreams::OverlapAnnotate::class_name;
  _module_name                = "OverlapAnnotate";

  _funcptr_delete             = _spstream_overlapannotate_delete_func;
  _funcptr_xml                = _spstream_overlapannotate_xml_func;
  _funcptr_simple_xml         = _spstream_overlapannotate_xml_func;

  _funcptr_next_in_stream           = _spstream_overlapannotate_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_overlapannotate_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_overlapannotate_stream_by_named_region_func;

  _overlap_mode          = "area";
  _ignore_strand         = false;
  _overlap_distance      = 0;
  _side_stream_empty     = false;
  _side_stream_primed    = false;
  _overlap_check_subfeatures = false; //extend overlap logic to require subfeature overlap
  _side_stream_buffer.clear();
}

void EEDB::SPStreams::OverlapAnnotate::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::OverlapAnnotate::display_desc() {
  return "OverlapAnnotate";
}

string EEDB::SPStreams::OverlapAnnotate::display_contents() {
  return display_desc();
}

////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
///////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::OverlapAnnotate::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  //older style of <ignore_strand value="1" />
  if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  if(_overlap_check_subfeatures) { xml_buffer.append("<overlap_subfeatures>true</overlap_subfeatures>"); }
  
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
  
  switch(_mdset_mode) {
    case FEATURE:       xml_buffer.append("<mdata_mode>feature</mdata_mode>"); break;
    case FEATURESOURCE: xml_buffer.append("<mdata_mode>featuresource</mdata_mode>"); break;
    case EXPERIMENT:    xml_buffer.append("<mdata_mode>experiment</mdata_mode>"); break;
    case ALL:           xml_buffer.append("<mdata_mode>all</mdata_mode>"); break;
  }
  
  for(unsigned int i=0; i<_specific_mdata.size(); i++) {
    _specific_mdata[i]->xml(xml_buffer);
  }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::OverlapAnnotate::OverlapAnnotate(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
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
  if((node = root_node->first_node("overlap_mode")) != NULL) { 
    _overlap_mode=node->value();
  }
  
  _mdset_mode = FEATURE;
  if((node = root_node->first_node("mdata_mode")) != NULL) { 
    if(string(node->value()) == "feature") { _mdset_mode = FEATURE; }
    if(string(node->value()) == "featuresource") { _mdset_mode = FEATURESOURCE; }
    if(string(node->value()) == "experiment") { _mdset_mode = EXPERIMENT; }
    if(string(node->value()) == "all") { _mdset_mode = ALL; }
  }
  
  _specific_mdata.clear();
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      if(mdata) { _specific_mdata.push_back(mdata); }
      node = node->next_sibling("mdata");
    }    
  }
  
  if((node = root_node->first_node("distance")) != NULL) {
    _overlap_distance = strtol(node->value(), NULL, 10);
  }
  
  //side stream last
  if((node = root_node->first_node("side_stream")) != NULL) {
    create_side_stream_from_xml(node);
  }  
  
}



////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::OverlapAnnotate::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {

      //non-features on the primary source stream are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }

      _process_feature((EEDB::Feature*)obj);
      return obj;
    }
  }
  
  // input stream is empty so done
  return NULL; 
}


void EEDB::SPStreams::OverlapAnnotate::_reset_stream_node() {
  EEDB::SPStreams::MergeStreams::_reset_stream_node();

  for(unsigned int i=0; i<_side_stream_buffer.size(); i++) {
    _side_stream_buffer[i]->release();
  }
  _side_stream_buffer.clear();
  _side_stream_empty = false;
  _side_stream_primed= false;
}


bool EEDB::SPStreams::OverlapAnnotate::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  
  if((side_stream() == NULL) || (source_stream() == NULL)) { 
    _side_stream_empty = true;
    return true;
  }
  //primary stream is dominant one, so side becomes slave to it
  //side stream is primed when needed in _process_feature()
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}

//
////////////////////////////////////////////////////////////
//

void  EEDB::SPStreams::OverlapAnnotate::_process_feature(EEDB::Feature *feature) {  
  
  if(_side_stream_empty && _side_stream_buffer.empty()) { return; }  //no more sidefeatures to process

  if(!_side_stream_primed) {
    //feature is first valid feature on primary stream so use it to slave the side stream
    side_stream()->stream_by_named_region(feature->assembly_name(), feature->chrom_name(), feature->chrom_start(), -1);
    _side_stream_primed = true;
    //fprintf(stderr, "OverlapAnnotate prime with first feature %s\n", feature->simple_xml().c_str());
  }

  deque<EEDB::Feature*>::iterator tb_it;
  EEDB::Feature *sidefeature = NULL;  

  //make sure we have at least one feature in template_buffer
  if(_side_stream_buffer.empty()) { _extend_side_stream_buffer(); }
  if(_side_stream_buffer.empty()) { return; }  //no more templates to process
  
  //
  // trim/extend _side_stream_buffer till first feature overlaps with current feature.
  //
  tb_it = _side_stream_buffer.begin();
  while((tb_it!=_side_stream_buffer.end()) and ((*tb_it)->chrom_end() < feature->chrom_start())) { 
    (*tb_it)->release();
    _side_stream_buffer.pop_front();
    if(_side_stream_buffer.empty()) { _extend_side_stream_buffer(); }
    tb_it = _side_stream_buffer.begin();
  }
  // extend buffer as needed
  if(!_side_stream_buffer.empty()) { 
    sidefeature = _side_stream_buffer.back();
    while(sidefeature and (sidefeature->chrom_start() <= feature->chrom_end())) {
      sidefeature = _extend_side_stream_buffer();
    }
  }
  sidefeature = NULL;
  if(_side_stream_buffer.empty()) { return; }  //no more sidefeatures to process
  
  //
  // then process the overlaps in the _side_stream_buffer
  //
  for(unsigned int i=0; i<_side_stream_buffer.size(); i++) {
    sidefeature = _side_stream_buffer[i];
    if(!_ignore_strand and (sidefeature->strand() != ' ') and (feature->strand()!=' ') and 
       (feature->strand() != sidefeature->strand())) { continue; }
    if(_overlap_check(feature, sidefeature)) { 
      _transfer_metadata(feature, sidefeature);
    }
  }
}


EEDB::Feature*  EEDB::SPStreams::OverlapAnnotate::_extend_side_stream_buffer() {
  if(_side_stream==NULL) { return NULL; }  
  if(_side_stream_empty) { return NULL; }
  MQDB::DBObject *obj = _side_stream->next_in_stream();
  while(obj!=NULL and (obj->classname() != EEDB::Feature::class_name)) {
    obj->release();
    obj = _side_stream->next_in_stream();
  }
  //side_stream is presorted so push_back retains that sort order
  if(obj==NULL) { _side_stream_empty = true; }
  else { _side_stream_buffer.push_back((EEDB::Feature*)obj); }
  return (EEDB::Feature*)obj;
}


bool  EEDB::SPStreams::OverlapAnnotate::_overlap_check(EEDB::Feature *feature, EEDB::Feature *sidefeature) {
  if(feature==NULL) { return false; }
  if(sidefeature==NULL) { return false; }

  //_overlap_mode "modifies" the input stream, not the side stream features
  long int start = feature->chrom_start();
  long int end   = feature->chrom_end();
  if(_overlap_mode == "5end") {
    if(feature->strand() == '+') { end   = start; }
    if(feature->strand() == '-') { start = end; }
  }
  if(_overlap_mode == "3end") {
    if(feature->strand() == '+') { start = end; }
    if(feature->strand() == '-') { end   = start; }
  }
  
  // for feature    ::   ORDER BY chrom_start, chrom_end
  // chrom() checking must be done before this call.
  if(end   < sidefeature->chrom_start() - _overlap_distance) { return false; } //feature ends before sidefeature starts (f1<f2)
  if(start > sidefeature->chrom_end()   + _overlap_distance) { return false; } //feature starts after sidefeature ends  (f1>f2)
  
  if(_overlap_check_subfeatures) {
    if(!sidefeature->subfeature_overlap_check(feature)) { return false; }
  }
  return true;
}


void  EEDB::SPStreams::OverlapAnnotate::_transfer_metadata(EEDB::Feature *feature, EEDB::Feature *sidefeature) {
  //transfer metadata from sidefeature onto feature based on mdset_mode (which mdset to transfer from)
  
  if(feature==NULL) { return; }
  if(sidefeature==NULL) { return; }

  EEDB::MetadataSet*         mdset = NULL;
  vector<EEDB::Expression*>  expression;
  
  switch(_mdset_mode) {
    case FEATURE:
      mdset = sidefeature->metadataset();
      _transfer_metadata(feature, mdset);
      break;
      
    case FEATURESOURCE:
      if(sidefeature->feature_source()) {
        mdset = sidefeature->feature_source()->metadataset();
        _transfer_metadata(feature, mdset);
      }
      break;
      
    case EXPERIMENT:
      expression = sidefeature->expression_array();
      for(unsigned int i=0; i<expression.size(); i++) {
        EEDB::Experiment *exp = expression[i]->experiment();
        if(exp == NULL) { continue; }
        mdset = exp->metadataset();
        _transfer_metadata(feature, mdset);
      }
      break;
      
    case ALL:
      mdset = sidefeature->metadataset();
      _transfer_metadata(feature, mdset);

      if(sidefeature->feature_source()) {
        mdset = sidefeature->feature_source()->metadataset();
        _transfer_metadata(feature, mdset);
      }
      
      expression = sidefeature->expression_array();
      for(unsigned int i=0; i<expression.size(); i++) {
        EEDB::Experiment *exp = expression[i]->experiment();
        if(exp == NULL) { continue; }
        mdset = exp->metadataset();
        _transfer_metadata(feature, mdset);
      }        
      break;      
  }
  
  //TODO: allow transfer of attributes of sidefeature 
  //  eg primary_name, feature_source name/category
  
  
  //final clean up
  feature->metadataset()->remove_duplicates();
}


void  EEDB::SPStreams::OverlapAnnotate::_transfer_metadata(EEDB::Feature *feature, EEDB::MetadataSet *mdset) {
  if(feature==NULL) { return; }
  if(mdset==NULL) { return; }
  //all transfers via shared pointer and retain()
  
  //specific mdata allows for select transfer
  for(unsigned int i=0; i<_specific_mdata.size(); i++) {
    EEDB::Metadata *md1 = _specific_mdata[i];
    EEDB::Metadata *md2 = mdset->find_metadata(md1->type(), md1->data());
    
    if(md2) {
      md2->retain();
      feature->metadataset()->add_metadata(md2);
    }
  }
  
  if(_specific_mdata.empty()) { //transfer everything
    feature->metadataset()->merge_metadataset(mdset);
  }  
}
