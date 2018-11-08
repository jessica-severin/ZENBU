/* $Id: NeighborCutoff.cpp,v 1.5 2013/04/08 07:39:45 severin Exp $ */

/***

NAME - EEDB::SPStreams::NeighborCutoff

SYNOPSIS

DESCRIPTION

processing module which explores a neighborhood window of features
 and applies a cutoff based on ja signal-to-noise concept.
 Signal is defined as the largest feature-signal in the neighborhood
 and a ratio is used to define the lower-end of cutoff to remove 
 weak neighbor features.
 
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
#include <EEDB/SPStreams/NeighborCutoff.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::NeighborCutoff::class_name = "EEDB::SPStreams::NeighborCutoff";

//function prototypes
MQDB::DBObject* _spstream_neighborcutoff_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::NeighborCutoff*)node)->_next_in_stream();
}
void _spstream_neighborcutoff_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::NeighborCutoff*)node)->_reset_stream_node();
}
void _spstream_neighborcutoff_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::NeighborCutoff*)obj;
}
void _spstream_neighborcutoff_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::NeighborCutoff*)obj)->_xml(xml_buffer);
}


EEDB::SPStreams::NeighborCutoff::NeighborCutoff() {
  init();
}

EEDB::SPStreams::NeighborCutoff::~NeighborCutoff() {
}


void EEDB::SPStreams::NeighborCutoff::init() {
  EEDB::SPStream::init();  
  _classname                  = EEDB::SPStreams::NeighborCutoff::class_name;
  _module_name                = "NeighborCutoff";

  _funcptr_delete             = _spstream_neighborcutoff_delete_func;
  _funcptr_xml                = _spstream_neighborcutoff_xml_func;
  _funcptr_simple_xml         = _spstream_neighborcutoff_xml_func;

  _funcptr_next_in_stream     = _spstream_neighborcutoff_next_in_stream_func;
  _funcptr_reset_stream_node  = _spstream_neighborcutoff_reset_stream_node_func;

  _neighbor_distance = 1000;
  _min_ratio         = 10.0;
  
  _strongest           = NULL;

  _output_buffer.unique_features(false);
  _output_buffer.match_category(false);
  _output_buffer.match_source(false);
  _output_buffer.expression_mode(CL_SUM);
}

void  EEDB::SPStreams::NeighborCutoff::min_ratio(double value) { 
  if(value < 1.0) { value = 1.0; }
  _min_ratio = value; 
}

void  EEDB::SPStreams::NeighborCutoff::neighbor_distance(long value) { 
  _neighbor_distance = value; 
}



////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::NeighborCutoff::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass
  
  char buffer[256];
  snprintf(buffer, 256, "<distance>%ld</distance>", _neighbor_distance);
  xml_buffer.append(buffer);
  
  snprintf(buffer, 256, "<ratio>%f</ratio>", _min_ratio);
  xml_buffer.append(buffer);
    
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::NeighborCutoff::NeighborCutoff(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("ratio")) != NULL) {
    min_ratio(strtod(node->value(), NULL));
  }  
  
  if((node = root_node->first_node("distance")) != NULL) {
    _neighbor_distance = strtol(node->value(), NULL, 10);
  }
}


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::NeighborCutoff::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();
  _output_buffer.reset();    
  _strongest = NULL;
}


MQDB::DBObject* EEDB::SPStreams::NeighborCutoff::_next_in_stream() {
  MQDB::DBObject *obj;
  
  EEDB::Feature *feature = _output_buffer.next_completed_feature();
  if(feature) { return feature; }
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature\expression objects are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      EEDB::Feature *feature = (EEDB::Feature *)obj;
      _process_feature(feature);

      feature = _output_buffer.next_completed_feature();
      if(feature) { return feature; }
    }
  }
    
  // input stream is empty so move all _subfeature_buffer into _completed_subfeatures
  _rescan_buffer();
  _output_buffer.transfer_all_to_completed();
  
  // return next completed feature if available
  feature = _output_buffer.next_completed_feature();
  if(feature) { return feature; }  
  return NULL; 
}

//
////////////////////////////////////////////////////////////
//


void  EEDB::SPStreams::NeighborCutoff::_process_feature(EEDB::Feature* feature) {
  if(feature==NULL) { return; }

  //printf("_process_feature %s [%f]\n", feature->chrom_location().c_str(), feature->significance());

  if(!_strongest) {
    _output_buffer.insert_feature(feature);
    _rescan_buffer();
    return;
  }

  if(feature->significance() > _strongest->feature->significance()) {
    //new feature is strongest, must rescan buffer
    _output_buffer.insert_feature(feature);
    _rescan_buffer();
    return;
  }    

  if(feature->chrom_start() - _strongest->feature->chrom_end() < _neighbor_distance) {
    //within distance so can directly check noise ratio
    double noise_ratio = _strongest->feature->significance() / feature->significance();
    if(noise_ratio > _min_ratio) {
      //don't bother inserting
      //printf("  noise\n");
      feature->release();
      return;
    } else {
      //printf("  OK signal\n");
      _output_buffer.insert_feature(feature);
    }

  } else {
    //printf("  outside range, just insert\n");
    _output_buffer.transfer_completed(feature->chrom_start() - _neighbor_distance);
    _output_buffer.insert_feature(feature);
    _rescan_buffer();
  }
}


void  EEDB::SPStreams::NeighborCutoff::_rescan_buffer() {
  FeatureLink *start = _output_buffer.buffer_start();
  FeatureLink *end   = _output_buffer.buffer_end();
  FeatureLink *flink;
  
  //printf("rescan_buffer\n");
  if(!start || !end) { return; }
  
  //need to find new strongest in buffer
  flink = start;
  _strongest = flink;
  flink = flink->next;
  while(flink) {
    if(flink->feature->significance() > _strongest->feature->significance()) {
      _strongest = flink;
    }
    if(flink==end) { break; }
    flink = flink->next;
  }
  //printf("  new strongest %s [%f]\n", _strongest->feature->chrom_location().c_str(), _strongest->feature->significance());

  _output_buffer.transfer_completed(_strongest->feature->chrom_start() - _neighbor_distance);

  //now perform signal-2-noise filtering
  flink = _output_buffer.buffer_start();
  while(flink) {
    //printf("  scan %s [%f]\n", flink->feature->chrom_location().c_str(), flink->feature->significance());
    if(flink==_strongest) { flink = flink->next; continue; }
    if(flink->feature->chrom_start() - _neighbor_distance > _strongest->feature->chrom_end()) { break; }
    
    double noise_ratio = _strongest->feature->significance() / flink->feature->significance();
    if(noise_ratio > _min_ratio) {
      //printf("    noise\n");
      FeatureLink* fl1 = flink;
      flink = flink->next;
      _output_buffer.remove_link(fl1);
    } else {
      flink = flink->next;
    }
  }
}


