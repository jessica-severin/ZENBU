/* $Id: TemplateFilter.cpp,v 1.17 2013/11/26 08:52:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::TemplateFilter

SYNOPSIS

DESCRIPTION

a simple SPStream which has an internal buffer. allows for external filling of buffer
or to fill from the source_stream();

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
#include <EEDB/SPStreams/TemplateFilter.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::TemplateFilter::class_name = "EEDB::SPStreams::TemplateFilter";

//function prototypes
MQDB::DBObject* _spstream_templatefilter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::TemplateFilter*)node)->_next_in_stream();
}
void _spstream_templatefilter_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::TemplateFilter*)node)->_reset_stream_node();
}
void _spstream_templatefilter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::TemplateFilter*)obj;
}
void _spstream_templatefilter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::TemplateFilter*)obj)->_xml(xml_buffer);
}
bool _spstream_templatefilter_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::TemplateFilter*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}


EEDB::SPStreams::TemplateFilter::TemplateFilter() {
  init();
}

EEDB::SPStreams::TemplateFilter::~TemplateFilter() {
}


void EEDB::SPStreams::TemplateFilter::init() {
  EEDB::SPStreams::MergeStreams::init();  
  _classname                  = EEDB::SPStreams::TemplateFilter::class_name;
  _module_name                = "TemplateFilter";

  _funcptr_delete             = _spstream_templatefilter_delete_func;
  _funcptr_xml                = _spstream_templatefilter_xml_func;
  _funcptr_simple_xml         = _spstream_templatefilter_xml_func;

  _funcptr_next_in_stream           = _spstream_templatefilter_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_templatefilter_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_templatefilter_stream_by_named_region_func;

  _overlap_mode          = "area";
  _ignore_strand         = false;
  _overlap_state         = true;
  _overlap_distance      = 0;
  _template_stream_empty     = false;
  _template_stream_primed    = false;
  _overlap_check_subfeatures = false; //extend overlap logic to require subfeature overlap
  _template_buffer.clear();
}

void EEDB::SPStreams::TemplateFilter::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::TemplateFilter::display_desc() {
  return "TemplateFilter";
}

string EEDB::SPStreams::TemplateFilter::display_contents() {
  return display_desc();
}


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::TemplateFilter::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {

      //non-features on the primary source stream
      //are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }

      //if object passes overlap-test, return it
      if(_process_feature((EEDB::Feature*)obj) == _overlap_state) { return obj; }
      obj->release();
    }
  }
  
  // input stream is empty so done
  return NULL; 
}


/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::TemplateFilter::_reset_stream_node() {
  EEDB::SPStreams::MergeStreams::_reset_stream_node();

  for(unsigned int i=0; i<_template_buffer.size(); i++) {
    _template_buffer[i]->release();
  }
  _template_buffer.clear();
  _template_stream_empty = false;
  _template_stream_primed= false;
}


bool EEDB::SPStreams::TemplateFilter::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  
  if((side_stream() == NULL) || (source_stream() == NULL)) { 
    _template_stream_empty = true;
    return true;
  }
  //primary stream is dominant one, so side becomes slave to it
  //side stream is primed when needed in _process_feature()
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}

//
////////////////////////////////////////////////////////////
//

bool  EEDB::SPStreams::TemplateFilter::_process_feature(EEDB::Feature *feature) {  
  deque<EEDB::Feature*>::iterator tb_it;
  EEDB::Feature *sidefeature = NULL;  

  if(!_template_stream_primed) {
    //feature is first valid feature on primary stream so use it to slave the side stream
    side_stream()->stream_by_named_region(feature->assembly_name(), feature->chrom_name(), feature->chrom_start(), -1);
    _template_stream_primed = true;
    //fprintf(stderr, "TemplateFilter prime with first feature %s\n", feature->simple_xml().c_str());
  }

  //make sure we have at least one feature in template_buffer
  if(_template_buffer.empty()) { _extend_template_buffer(); }
  if(_template_buffer.empty()) { return false; }  //no more templates to process

  //
  // trim/extend _template_buffer till first feature overlaps with current feature.
  //
  tb_it = _template_buffer.begin();
  while((tb_it!=_template_buffer.end()) and ((*tb_it)->chrom_end() < feature->chrom_start())) { 
    (*tb_it)->release();
    _template_buffer.pop_front();
    if(_template_buffer.empty()) { _extend_template_buffer(); }
    tb_it = _template_buffer.begin();
  }
  // extend buffer as needed
  if(!_template_buffer.empty()) { 
    sidefeature = _template_buffer.back();
    while(sidefeature and (sidefeature->chrom_start() <= feature->chrom_end())) {
      sidefeature = _extend_template_buffer();
    }
  }
  sidefeature = NULL;
  if(_template_buffer.empty()) { return false; }  //no more templates to process

  //
  // then process the overlaps in the _template_buffer
  //
  for(unsigned int i=0; i<_template_buffer.size(); i++) {
    sidefeature = _template_buffer[i];
    if(!_ignore_strand and (sidefeature->strand() != ' ') and (feature->strand()!=' ') and 
       (feature->strand() != sidefeature->strand())) { continue; }
    if(_overlap_check(feature, sidefeature)) { 
      return true; //if not labeling, the first overlap is good enough
    }
  }
  return false; 
}


EEDB::Feature*  EEDB::SPStreams::TemplateFilter::_extend_template_buffer() {
  if(_side_stream==NULL) { return NULL; }  
  if(_template_stream_empty) { return NULL; }
  MQDB::DBObject *obj = _side_stream->next_in_stream();
  while(obj!=NULL and (obj->classname() != EEDB::Feature::class_name)) {
    obj->release();
    obj = _side_stream->next_in_stream();
  }
  //side_stream is presorted so push_back retains that sort order
  if(obj==NULL) { _template_stream_empty = true; }
  else { _template_buffer.push_back((EEDB::Feature*)obj); }
  return (EEDB::Feature*)obj;
}


bool  EEDB::SPStreams::TemplateFilter::_overlap_check(EEDB::Feature *feature, EEDB::Feature *sidefeature) {
  if(feature==NULL) { return false; }
  if(sidefeature==NULL) { return false; }

  //_overlap_mode "modifies" the input stream, not the template/side stream features
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


/*****************************************************************************************/

void EEDB::SPStreams::TemplateFilter::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  
  //older style of <ignore_strand value="1" />
  if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  if(_overlap_state==false) { xml_buffer.append("<inverse>true</inverse>"); }
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

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::TemplateFilter::TemplateFilter(void *xml_node) {
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
  if((node = root_node->first_node("is_strand_sensitive")) != NULL) { 
    if((attr = node->first_attribute("value")) and (string(attr->value())=="0")) {
      _ignore_strand=true;
    }
  }
  if((node = root_node->first_node("inverse")) != NULL) { 
    if(string(node->value()) == "true") { _overlap_state=false; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _overlap_state=false;
    }
  }
  if((node = root_node->first_node("overlap_subfeatures")) != NULL) {
    _overlap_check_subfeatures=false;
    if(string(node->value()) == "true") { _overlap_check_subfeatures=true; }
  }  
  
  if((node = root_node->first_node("overlap_mode")) != NULL) { 
    _overlap_mode=node->value();
  }
  
  if((node = root_node->first_node("distance")) != NULL) {
    _overlap_distance = strtol(node->value(), NULL, 10);
  }
  
  if((node = root_node->first_node("side_stream")) != NULL) {
    create_side_stream_from_xml(node);
  }
}




