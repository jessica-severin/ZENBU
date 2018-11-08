/* $Id: FeatureEmitter.cpp,v 1.29 2014/12/04 05:07:05 severin Exp $ */

/***

NAME - EEDB::SPStreams::FeatureEmitter

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
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/WebServices/WebBase.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::FeatureEmitter::class_name = "EEDB::SPStreams::FeatureEmitter";
bool         EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist = false;

//call out functions
//function prototypes
MQDB::DBObject*  _spstream_featureemitter_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::FeatureEmitter*)node)->_next_in_stream();
}
bool _spstream_featureemitter_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::FeatureEmitter*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_featureemitter_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FeatureEmitter*)node)->_reset_stream_node();
}
void _spstream_featureemitter_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::FeatureEmitter*)node)->_stream_clear();
}
void _spstream_featureemitter_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::FeatureEmitter*)obj;
}
string _spstream_featureemitter_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::FeatureEmitter*)obj)->_display_desc();
}
void _spstream_featureemitter_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::FeatureEmitter*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::FeatureEmitter::FeatureEmitter() {
  init();
}

EEDB::SPStreams::FeatureEmitter::~FeatureEmitter() {
  if(_region_chrom != NULL) { _region_chrom->release(); }
  if(_feature_source != NULL) { _feature_source->release(); }
  _region_chrom   = NULL;
  _feature_source = NULL;
}

void EEDB::SPStreams::FeatureEmitter::init() {
  EEDB::SPStream::init();
  _classname      = EEDB::SPStreams::FeatureEmitter::class_name;
  _module_name    = "FeatureEmitter";

  _source_stream  = NULL;
  _dynamic        = true;
  _width          = 1000.0;  // 1kb
  _coarseness     = 1.0;  //no coarse modification
  _overlap        = 0;
  _fixed_grid     = false;
  _both_strands   = false;
  _current_strand = '+';
  
  _current_start  = -1;
  _current_count  = 1;
  _region_start   = -1;
  _region_end     = -1;
  _region_chrom   = NULL;
  
  _feature_source = new EEDB::FeatureSource();
  _feature_source->name("feature_emitter");
  _feature_source->category("dynamic");
 
  //function pointer code
  _funcptr_delete                   = _spstream_featureemitter_delete_func;
  _funcptr_display_desc             = _spstream_featureemitter_display_desc_func;
  _funcptr_xml                      = _spstream_featureemitter_xml_func;
  _funcptr_simple_xml               = _spstream_featureemitter_xml_func;
 
  _funcptr_next_in_stream           = _spstream_featureemitter_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_featureemitter_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_featureemitter_stream_clear_func;
  _funcptr_stream_by_named_region   = _spstream_featureemitter_stream_by_named_region_func;
}

string EEDB::SPStreams::FeatureEmitter::_display_desc() {
  return "FeatureEmitter";
}

string EEDB::SPStreams::FeatureEmitter::display_contents() {
  return display_desc();
}


////////////////////////////////////////////////////////////////////////////
// Instance methods
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::FeatureEmitter::width(double value) {
  _width = value;
  _dynamic = false;
}
void  EEDB::SPStreams::FeatureEmitter::overlap(long int value) {
  _overlap = value;
}
void  EEDB::SPStreams::FeatureEmitter::fixed_grid(bool value) {
  _fixed_grid = value;
}
void  EEDB::SPStreams::FeatureEmitter::both_strands(bool value) {
  _both_strands = value;
}

void  EEDB::SPStreams::FeatureEmitter::dynamic(bool value) {
  //use global parameters to set width based on dynamics of query
  _dynamic = value;
  if(value) { EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist = true; }
}


bool  EEDB::SPStreams::FeatureEmitter::dynamic() {
  return _dynamic;
}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


void  EEDB::SPStreams::FeatureEmitter::_reset_stream_node() {
  _current_start  = -1;
  _current_count  = 1;
  _region_start   = -1;
  _region_end     = -1;
  _current_strand = '+';
  if(_region_chrom != NULL) { _region_chrom->release(); }
  _region_chrom   = NULL;
}


void EEDB::SPStreams::FeatureEmitter::_stream_clear() {
  _current_start  = -1;
  _current_count  = 1;
  _region_start   = -1;
  _region_end     = -1;
  _current_strand = '+';
  if(_region_chrom != NULL) { _region_chrom->release(); }
  _region_chrom   = NULL;
}


MQDB::DBObject* EEDB::SPStreams::FeatureEmitter::_next_in_stream() {
  if(_current_start < 0)    { return NULL; }  //finished
  if(_region_chrom == NULL) { return NULL; }  //finished
  
  long int  end     = (long int)floor(_current_start -1 + _width);
  double    exp_end = _region_start  -1 + (_width * _current_count);
  if(fabs(exp_end-end) >= 0.5) {
    if(exp_end > end) { end++; }
    else { end--; }
  }
  if(end<_current_start) { end = _current_start; }

  EEDB::Feature *feature = EEDB::Feature::realloc();
  feature->feature_source(_feature_source);
  feature->chrom(_region_chrom);
  feature->chrom_start(_current_start);  
  feature->chrom_end(end);

  if(_both_strands) { 
    feature->strand(_current_strand); 
    if(_current_strand=='+') { _current_strand = '-'; }
    else { 
      _current_strand = '+'; 
      long int start = end +1 - _overlap;
      if(start > _current_start) { _current_start = start; }
      else { _current_start++; }
      _current_count++;
    }
  } else {
    long int start = end +1 - _overlap;
    if(start > _current_start) { _current_start = start; }
    else { _current_start++; }
    _current_count++;
  }
  feature->primary_name("block_" + feature->chrom_location());
  
  if(_region_end>0 && (_current_start > _region_end)) { _current_start = -1; }  //finished
  
  return feature;
}


bool  EEDB::SPStreams::FeatureEmitter::_stream_by_named_region(
            string assembly_name, string chrom_name, long int start, long int end) {
              
  EEDB::Assembly *asmb = new EEDB::Assembly();
  asmb->assembly_name(assembly_name);
  asmb->ncbi_version(assembly_name);
  asmb->ucsc_name(assembly_name);

  _region_chrom = new EEDB::Chrom();
  _region_chrom->assembly(asmb);
  _region_chrom->chrom_name(chrom_name);

  if(start < 0) { start = 1; }
  
  if(_dynamic) {
    _width = 3;
    if(EEDB::WebServices::WebBase::global_parameters.find("global_bin_size") != EEDB::WebServices::WebBase::global_parameters.end()) { 
      string value = EEDB::WebServices::WebBase::global_parameters["global_bin_size"];
      _width = strtod(value.c_str(), NULL); 
      if(_width<1) { _width = 1.0; }      
      fprintf(stderr,"FeatureEmitter dynamic : global bin %1.13f\n",_width);
    }
    else if((end>0) && (EEDB::WebServices::WebBase::global_parameters.find("display_width") != EEDB::WebServices::WebBase::global_parameters.end())) { 
      string value = EEDB::WebServices::WebBase::global_parameters["display_width"];
      long num_per_region = strtol(value.c_str(), NULL, 10); 
      if(num_per_region>0) {
        _width = (double)(end-start) / (double)num_per_region;
        fprintf(stderr,"FeatureEmitter dynamic : global display %ld => %1.13f\n", num_per_region, _width);
      }
    }    
    else {
      fprintf(stderr,"FeatureEmitter dynamic : using default of %1.1f\n", _width);
    }
    
    if(_coarseness > 1.0) {
      _width = _width * _coarseness;
      fprintf(stderr,"FeatureEmitter dynamic : adjust coarseness to %1.1f\n", _width);
    }
  }
  
  if(_fixed_grid) {
    long int grid = (long int) floor(_width-_overlap);
    if(grid<1) { grid = 1; }
    start = (start/grid)*grid + 1;
  }

  _current_start = start;
  _region_start  = start;
  _region_end    = end;
  return true;
}


/******************************************************************************/


void EEDB::SPStreams::FeatureEmitter::_xml(string &xml_buffer) {
  char buffer[256];
  _xml_start(xml_buffer);  //from superclass
  
  snprintf(buffer, 256, "<overlap>%ld</overlap>", _overlap);
  xml_buffer.append(buffer);

  if(_dynamic) {
    xml_buffer.append("<dynamic/>");
  } else {
    snprintf(buffer, 256, "<width>%f</width>", _width);
    xml_buffer.append(buffer);
  }

  if(_coarseness != 1.0) { 
    snprintf(buffer, 256, "<coarseness>%f</coarseness>", _coarseness);
    xml_buffer.append(buffer);
  }
  
  if(_fixed_grid) { xml_buffer.append("<fixed_grid>true</fixed_grid>"); }
  if(_both_strands) { xml_buffer.append("<both_strands>true</both_strands>"); }
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::FeatureEmitter::FeatureEmitter(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("width")) != NULL) { width(strtod(node->value(), NULL)); }
  if((node = root_node->first_node("coarseness")) != NULL) { 
    _coarseness = strtod(node->value(), NULL);
    if(_coarseness == 0) { _coarseness=1.0; }
  }

  if((node = root_node->first_node("overlap")) != NULL) { _overlap = strtol(node->value(), NULL, 10); }
  if(((node = root_node->first_node("fixed_grid")) != NULL) and (string(node->value()) == "true")) {
    _fixed_grid=true;
  }
  if(((node = root_node->first_node("both_strands")) != NULL) and (string(node->value()) == "true")) {
    _both_strands=true;
  }
  
  if(_dynamic) {
    EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist = true;
  }
}


