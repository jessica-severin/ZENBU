/* $Id: Paraclu.cpp,v 1.29 2016/08/02 07:21:36 severin Exp $ */

/***

NAME - EEDB::Tools::Paraclu

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
#include <EEDB/Tools/Paraclu.h>

using namespace std;

const char*  EEDB::Tools::Paraclu::class_name = "EEDB::Tools::Paraclu";

//function prototypes
void _tools_paraclu_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::Paraclu*)obj;
}
void _tools_paraclu_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Tools::Paraclu*)obj)->_xml(xml_buffer);
}
string _tools_paraclu_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::Tools::Paraclu*)obj)->_display_desc();
}

const double infinity = 1e100;
void check_over_memory();  //from TrackCacheBuilder


////////////////////////////////////////////////////////////////////////////
//
// Cluster object
//
////////////////////////////////////////////////////////////////////////////


EEDB::Tools::Paraclu::Cluster::Cluster() {
  //constructor
  beg = NULL;
  end = NULL;
  totalValue = 0.0;
  minDensity = infinity;
  maxDensity = infinity;
  stability = 0.0;
}

EEDB::Tools::Paraclu::Cluster::~Cluster() { 
  // destructor
  beg = NULL;
  end = NULL;
  totalValue = 0.0;
  minDensity = infinity;
  maxDensity = infinity;
  stability = 0.0;
}

void  EEDB::Tools::Paraclu::Cluster::show() { 
  long cluster_length = end->feature->chrom_start() - beg->feature->chrom_start() + 1;

  std::cerr << beg->feature->chrom_name() << "\t" << beg->feature->strand() << "\t"
  << std::setprecision(20)
  << beg->feature->chrom_start() << "\t" << end->feature->chrom_start() << "\t"
  << cluster_length << "\t" << totalValue << "\t"
  << std::setprecision(3)
  << minDensity << "\t" << maxDensity ;
  std::cerr << "\t" << stability;
//  if(stability >= _min_stability) { std::cerr << "\tSTABLE"; }
//  std::cerr << "\n";
}

  
////////////////////////////////////////////////////////////////////////////
//
// creation methods
//
////////////////////////////////////////////////////////////////////////////


EEDB::Tools::Paraclu::Paraclu() {
  init();
}

EEDB::Tools::Paraclu::~Paraclu() {
}

void EEDB::Tools::Paraclu::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::Tools::Paraclu::class_name;
  _funcptr_delete            = _tools_paraclu_delete_func;
  _funcptr_xml               = _tools_paraclu_xml_func;
  _funcptr_simple_xml        = _tools_paraclu_xml_func;
  _funcptr_display_desc      = _tools_paraclu_display_desc_func;
  
  _min_cutoff_value    = 10.0;
  _max_cluster_length  = 100;
  _min_stability       = 1;
  _min_density         = 0;
  _selection_mode      = STABILITY_CUT;

  _stream_chrom        = NULL;
  _fl_buffer_start     = NULL;
  _fl_buffer_end       = NULL;
  _best_cluster        = NULL;
  _cluster_number      = 1;

  //attributes
  _feature_source = new EEDB::FeatureSource();
  _feature_source->name("Paraclu");
  _feature_source->category("cluster");
  
  _output_buffer = NULL;
}


void  EEDB::Tools::Paraclu::output_buffer(EEDB::Tools::ResortBuffer* buffer) { 
  _output_buffer = buffer; 
}

void  EEDB::Tools::Paraclu::feature_source(EEDB::FeatureSource* source) { 
  if(_feature_source) { _feature_source->release(); _feature_source = NULL; }
  if(source) { source->retain(); }
  _feature_source = source; 
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::Tools::Paraclu::_display_desc() {
  string str = "Paraclu";
  return str;
}


void EEDB::Tools::Paraclu::_xml(string &xml_buffer) {    
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
    case FULL_HIERARCHY:  xml_buffer.append("<selection_mode>full_hierarchy</selection_mode>"); break;
    case BEST_STABLE:     xml_buffer.append("<selection_mode>best_stable</selection_mode>"); break;
    case STABILITY_CUT:   xml_buffer.append("<selection_mode>stability_cut</selection_mode>"); break;
    case SMALL_STABLE:    xml_buffer.append("<selection_mode>small_stable</selection_mode>"); break;
  }

}


EEDB::Tools::Paraclu::Paraclu(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if((node = root_node->first_node("min_cutoff")) != NULL) {
    _min_cutoff_value = strtod(node->value(), NULL);
  }  

  if((node = root_node->first_node("stability")) != NULL) {
    _min_stability = strtod(node->value(), NULL);
    if(_min_stability < 1.0) { _min_stability = 1.0; }
  }  

  if((node = root_node->first_node("max_cluster_length")) != NULL) {
    _max_cluster_length = strtol(node->value(), NULL, 10);
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
  if((node = root_node->first_node("selection_mode")) != NULL) {
    if(string(node->value()) == "full_hierarchy") { _selection_mode = FULL_HIERARCHY; }
    if(string(node->value()) == "best_stable")    { _selection_mode = BEST_STABLE; }
    if(string(node->value()) == "stability_cut")  { _selection_mode = STABILITY_CUT; }
    if(string(node->value()) == "small_stable")  { _selection_mode = SMALL_STABLE; }
  }

}


////////////////////////////////////////////////////////////


 
void  EEDB::Tools::Paraclu::process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return; }
  if(!_output_buffer) { return; }
  
  // check if we are finished with clusters in the _output_buffer
  //_output_buffer->transfer_completed(feature->chrom_start());

  //fill in the featurelink buffer to have enough room to cluster properly
  if(!_stream_chrom) { 
    _stream_chrom = feature->chrom();
    _stream_chrom->retain();
  }
    
  FeatureLink *fl = new EEDB::FeatureLink();
  fl->feature = feature;
  feature->retain();
  //fprintf(stderr, "add feature %s to links\n", feature->chrom_location().c_str());

  if(_fl_buffer_start == NULL) {
    //printf("reset buffer start..end\n");
    _fl_buffer_start = fl;
    _fl_buffer_end   = fl;
  } else {    
    // add new feature onto end of feature link buffer
    _fl_buffer_end->next = fl;
    fl->prev             = _fl_buffer_end;
    _fl_buffer_end       = fl;
  }

  if(_fl_buffer_end->feature->chrom_start() - _fl_buffer_start->feature->chrom_start()+1 > _max_cluster_length * 9) {
    //_show_buffer(_fl_buffer_start, _fl_buffer_end);
    //long length = _fl_buffer_end->feature->chrom_start() - _fl_buffer_start->feature->chrom_start() + 1;

    switch(_selection_mode) {
      case FULL_HIERARCHY:
      case STABILITY_CUT:
        //fprintf(stderr, "process buffer %ld .. %ld [ %ld ]\n", _fl_buffer_start->feature->chrom_start(), _fl_buffer_end->feature->chrom_start(), length);
        _process_cluster_range_full(_fl_buffer_start, _fl_buffer_end, -infinity);
        break;
      case BEST_STABLE:
        _process_cluster_range_best(_fl_buffer_start, _fl_buffer_end);
        break;
      case SMALL_STABLE:
        int rtn = _process_cluster_range_smallest(_fl_buffer_start, _fl_buffer_end, -infinity);
        if(rtn == 0) {
          //fprintf(stderr, "entire buffer is too weak now\n");
          _discard_region(_fl_buffer_start, _fl_buffer_end);
        }
        break;
    }
    check_over_memory();
  }
}


void  EEDB::Tools::Paraclu::finish_processing() {
  if(!_output_buffer) { return; }
  FeatureLink *last_fl_start = NULL;

  while(_fl_buffer_start != NULL) {
    //_show_buffer(_fl_buffer_start, _fl_buffer_end);
    //long length = _fl_buffer_end->feature->chrom_start() - _fl_buffer_start->feature->chrom_start() + 1;
    last_fl_start = _fl_buffer_start;

    switch(_selection_mode) {
      case FULL_HIERARCHY:
      case STABILITY_CUT:
        //fprintf(stderr, "finalize buffer %ld .. %ld [ %ld ]\n", _fl_buffer_start->feature->chrom_start(), _fl_buffer_end->feature->chrom_start(), length);
        _process_cluster_range_full(_fl_buffer_start, _fl_buffer_end, -infinity);
        break;
      case BEST_STABLE:
        _process_cluster_range_best(_fl_buffer_start, _fl_buffer_end);
        break;
      case SMALL_STABLE:
        int rtn = _process_cluster_range_smallest(_fl_buffer_start, _fl_buffer_end, -infinity);
        if(rtn == 0) {
          //fprintf(stderr, "entire buffer is too weak now\n");
          _discard_region(_fl_buffer_start, _fl_buffer_end);
        }
        break;
    }
    if(_fl_buffer_start == last_fl_start) {
      //fprintf(stderr, "hmm buffer didn't change - problem\n");
      _discard_region(_fl_buffer_start, _fl_buffer_end);
    }
  }
  
  // input stream is empty so move all _subfeature_buffer into _completed_subfeatures
  //_output_buffer->transfer_all_to_completed();
}  


void  EEDB::Tools::Paraclu::reset() {
  //reset for next region query
  if(_output_buffer) { _output_buffer->reset(); }

  //reset parameters to defaults
  _min_cutoff_value    = 10.0;
  _max_cluster_length  = 100;
  _min_stability       = 1;
  _min_density         = 0;
  _selection_mode      = STABILITY_CUT;
  
  //clear from previous run
  if(_stream_chrom) { _stream_chrom->release(); }
  _discard_region(_fl_buffer_start, _fl_buffer_end);
  if(_best_cluster) { delete _best_cluster; }

  _stream_chrom        = NULL;
  _fl_buffer_start     = NULL;
  _fl_buffer_end       = NULL;
  _best_cluster        = NULL;  
  _cluster_number      = 1;
}


//--------------------------------------------------------------

// Copyright 2011 Martin C. Frith

// Find clusters in 1-dimensional data, using the method described in
// MC Frith et al. Genome Res. 2008 18(1):1-12.

// The input has 4 columns: chromosome, strand, coordinate, value.
// For example: chr20 + 60026 2

// Ported into the ZENBU Feature and SPStream system: Jessica Severin copyright 2012


double  EEDB::Tools::Paraclu::_calc_total_value(FeatureLink *beg, FeatureLink *end) {
  if(beg==NULL) { return 0; }
  FeatureLink  *flink = beg;
  double       totalValue = 0;
  while(flink) {
    totalValue += flink->feature->significance();
    if(flink == end) { break; }
    flink = flink->next;
  }
  return totalValue;
}


double  EEDB::Tools::Paraclu::_weakestPrefix(FeatureLink *beg, FeatureLink *end) {
  if(beg==end) { return 0.0; }
  unsigned origin   = beg->feature->chrom_start();
  unsigned stop_pos = end->feature->chrom_start();
  //printf("_weakestPrefix\n");
  
  _minPrefix = NULL;  //maybe not needed
  _minPrefixDensity = infinity;
  
  FeatureLink  *flink = beg;
  double       totalValue = 0;
  unsigned     pos=0;
  
  //density is calculated as 
  while(flink) {
    pos = flink->feature->chrom_start();
    //loop on identical starts in case input was not pre-clustered at 1bp resolution
    while(flink && (flink->feature->chrom_start() == pos)) { 
      totalValue += flink->feature->significance();
      flink = flink->next;
    }
    if(!flink) { break; }
    if(flink->feature->chrom_start() > stop_pos) { break; }
    
    double density = totalValue / (flink->feature->chrom_start() - origin);
    if(density < _minPrefixDensity) {
      _minPrefix = flink;
      _minPrefixDensity = density;
    }    
  }
  //printf(" total=%f  minDensity = %f  pos = %s\n", totalValue, _minPrefixDensity, _minPrefix->feature->chrom_location().c_str());
  return totalValue;
}


double  EEDB::Tools::Paraclu::_weakestSuffix(FeatureLink *beg, FeatureLink *end) {
  if(beg==end) { return 0.0; }
  unsigned beg_pos = beg->feature->chrom_start();
  unsigned end_pos = end->feature->chrom_start();
  //printf("_weakestSuffix\n");

  _minSuffix = NULL;
  _minSuffixDensity = infinity;
  
  FeatureLink  *flink = end;
  double       totalValue = 0;
  unsigned     pos = 0;
  
  while(flink) {
    pos = flink->feature->chrom_start();
    //printf("  pos = %d\n", pos);
    //loop on identical chrom_starts in case input was not pre-clustered at 1bp resolution
    while(flink && (flink->feature->chrom_start() == pos)) {
      totalValue += flink->feature->significance();
      //printf("   add to density %s\n", flink->feature->chrom_location().c_str());
      flink = flink->prev;
    }
    if(!flink) { break; }
    if(flink->feature->chrom_start() < beg_pos) { break; }

    double density = totalValue / (end_pos - flink->feature->chrom_start());
    //printf("   density = %f\n", density);
    if(density < _minSuffixDensity) {
      _minSuffix = flink->next;
      _minSuffixDensity = density;
      //printf("     !NEW minSuffix %s [ %f ]\n", _minSuffix->feature->chrom_location().c_str(), density);
    }
  }
  //printf(" total=%f  minDensity = %f  pos = %s\n", totalValue, _minSuffixDensity, _minSuffix->feature->chrom_location().c_str());
  return totalValue;
}


void EEDB::Tools::Paraclu::_show_buffer(FeatureLink *beg, FeatureLink *end) {
  printf("=== buffer\n");
  FeatureLink *fl = beg;
  while(1) {
    printf("  %s\n", fl->feature->chrom_location().c_str());
    if(fl == end) { break; }
    fl = fl->next;
  }
}


void  EEDB::Tools::Paraclu::_discard_region(FeatureLink *beg, FeatureLink *end) {
  if((beg==NULL) || (end==NULL)) { return; }

  //long cluster_length = end->feature->chrom_start() - beg->feature->chrom_start() + 1;
  //fprintf(stderr, "_discard_region %ld .. %ld [ %ld ]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length);
    
  //cut off this section from the feature link buffer
  FeatureLink *b2 = beg->prev;
  FeatureLink *e2 = end->next;
  if(b2) { b2->next = e2; }
  if(e2) { e2->prev = b2; }
  if(_fl_buffer_start == beg) { 
    _fl_buffer_start = e2;
    //printf("new _fl_buffer_start\n");
  }
  if(_fl_buffer_end == end)   { 
    _fl_buffer_end = b2; 
    //printf("new _fl_buffer_end\n");
  }
  
  beg->prev = NULL;
  end->next = NULL;
  
  EEDB::FeatureLink *flink = beg;
  while(flink!=NULL) {
    //printf("  remove link %s\n", flink->feature->chrom_location().c_str());
    flink->feature->release();
    flink->feature = NULL;
    FeatureLink *fl2 = flink;
    flink = flink->next;
    delete fl2;
  }
}

/*
void  EEDB::Tools::Paraclu::_processOneStream(std::istream &stream) {
  std::string newSeqname;
  char newStrand;
  unsigned p;
  double v;
  while (stream >> newSeqname >> newStrand >> p >> v) {
    if (newSeqname == seqname && newStrand == strand) {
      if (p > sites.back().chrom_start())
        sites.push_back(Site(p, v));
      else if (p == sites.back().chrom_start())
        sites.back().value += v;
      else
        throw std::runtime_error("unsorted input");
    } else {
      _writeClusters(sites.begin(), sites.end(), -infinity);
      sites.clear();
      seqname = newSeqname;
      strand = newStrand;
      sites.push_back(Site(p, v));
    }
  }
  if (!stream.eof()) throw std::runtime_error("bad input");
  _writeClusters(sites.begin(), sites.end(), -infinity);
}
*/

/////////////////////////////////////////////////////////////////////////////////////
//
// original ported version. close to direct interpretation of the original ParaClu algorithm
// but flipped recursion logic so that parent decides based on children and self
// also working with the sliding input buffer and the ZENBU datamodel objects
//
/////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Tools::Paraclu::_process_cluster_range_full(FeatureLink *beg, FeatureLink *end, double parentDensity) {
  //OK this is a closer attempt at martin's original algorithm, full hierarchy
  //recursive algorithm which subdivides sites
  //original paraclu called the parameter minDensity, but parentDensity is better name
  
  if((beg==NULL) || (end==NULL)) { return; }
  //if(beg==end) {  return; }
  
  long   cluster_length = end->feature->chrom_start() - beg->feature->chrom_start() + 1;
  double totalValue     = _calc_total_value(beg, end);
  double density        = totalValue / cluster_length;
  
  //fprintf(stderr, "_process_cluster_range_full  %ld .. %ld  [ %ld ] [total=%f density=%f]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length, totalValue, density);
  
  if((totalValue < _min_cutoff_value) || (density < _min_density)) { 
    //weak region so can fall out
    if(cluster_length > _max_cluster_length) { 
      //if >max_length then we are walking down the left-side, so can discard and fall out
      //fprintf(stderr, "discard large-weak region %ld .. %ld  [ %ld ] [total=%f density=%f]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length, totalValue, density);
      _discard_region(beg, end);
    }
    return; 
  } 
    
  if(beg==end) {  
    double stability = density/parentDensity; //my stability
    //fprintf(stderr, "_process_cluster_range  beg == end density[%f] parentDensity[%f] stability[%f] minstab[%f]\n", density, parentDensity, stability, _min_stability);
    if((_selection_mode==FULL_HIERARCHY) || ((_selection_mode==STABILITY_CUT) && (stability >= _min_stability))) {
      //this is part of the hierarchy
      //fprintf(stderr, "single 1bp stable cluster [%ld] & STABLE [%f]\n", cluster_length, stability);
      EEDB::Feature *feature = _generate_cluster(beg, end);
      if(feature) {
        feature->metadataset()->add_tag_data("density", d_to_string(density));
        feature->metadataset()->add_tag_data("maxDensity", d_to_string(density));  //1bp so no children
        feature->metadataset()->add_tag_data("parentDensity", d_to_string(parentDensity));
        feature->metadataset()->add_tag_data("stability", d_to_string(stability));
        _output_buffer->insert_feature(feature);
      } 
    }
    return;
  }

  
  //
  // find best mid-cut-point
  //
  _weakestPrefix(beg, end);
  _weakestSuffix(beg, end);
  
  double maxDensity;
  FeatureLink *mid = NULL;
  if(_minPrefixDensity < _minSuffixDensity) {
    maxDensity = _minPrefixDensity;
    mid = _minPrefix;
    //fprintf(stderr, "choose prefix %f %d\n", _minPrefixDensity, _minPrefix->feature->chrom_start());
  } else {
    maxDensity = _minSuffixDensity;
    mid = _minSuffix;
    //fprintf(stderr, "choose suffix %f %d\n", _minSuffixDensity, _minSuffix->feature->chrom_start());
  }  
  
  //if no mid point pop out
  if(mid==NULL) { 
    //did not find a cut so bounce out
    //fprintf(stderr, "Paraclu PROBLEM mid is null\n");
    return;
  }
  //printf("  maxDensity %f\n", maxDensity);
  //printf("  parentDensity %f\n", parentDensity);
  //printf("  mid link %s\n", mid->feature->chrom_location().c_str());
  
  double child_stability = maxDensity / parentDensity;
  
  if((cluster_length <= _max_cluster_length) && (maxDensity>parentDensity)) {
    
    //this is part of the hierarchy
    /*
     std::cerr << beg->feature->chrom_name() << "\t" << beg->feature->strand() << "\t"
     << std::setprecision(20)
     << beg->feature->chrom_start() << "\t" << end->feature->chrom_start() << "\t"
     << cluster_length << "\t" << totalValue << "\t"
     << std::setprecision(3)
     << parentDensity << "\t" << maxDensity ;
     std::cerr << "\t" << stability;
     if(stability >= _min_stability) { std::cerr << "\tSTABLE"; }
     std::cerr << "\n";
     */
    
    if((_selection_mode==FULL_HIERARCHY) || ((_selection_mode==STABILITY_CUT) && (child_stability >= _min_stability))) {
      EEDB::Feature *feature = _generate_cluster(beg, end);
      if(feature) {
        feature->metadataset()->add_tag_data("density", d_to_string(density));
        feature->metadataset()->add_tag_data("maxDensity", d_to_string(maxDensity));
        feature->metadataset()->add_tag_data("parentDensity", d_to_string(parentDensity));
        feature->metadataset()->add_tag_data("child_stability", d_to_string(child_stability));
        _output_buffer->insert_feature(feature);
        //fprintf(stderr, "make cluster %ld .. %ld  [ %ld ] [total=%f density=%f]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length, totalValue, density);
      }
    }

    if((_selection_mode==STABILITY_CUT) && (child_stability >= _min_stability)) {
      // no need to dig deeper, martin's paraclu-cut picks biggest cluster in hierarchy
      // Remove clusters that are contained in larger clusters.  This assumes
      // that the input is sorted by start position (ascending) then end
      // position (descending).
      //fprintf(stderr, "stop stability_cut\n");
      return;
    }

  }
  double newMinDensity = max(parentDensity, maxDensity);
  //double newMinDensity = parentDensity;
  //if(cluster_length <= _max_cluster_length) { newMinDensity = max(parentDensity, maxDensity); }

  FeatureLink *mid1 = mid->prev;
  long   left_length  = mid1->feature->chrom_start() - beg->feature->chrom_start() + 1;
  
  //fprintf(stderr, "left\n");
  _process_cluster_range_full(beg, mid1, newMinDensity);
  
  //only dig down right side when inside left most cluster <= max_cluster_length
  if(cluster_length <= _max_cluster_length) { 
    //fprintf(stderr, "right\n");
    _process_cluster_range_full(mid, end, newMinDensity);
  }
    
  //special transition, from above max_cluster into left-most cluster
  //once finished here we poping completely out so discard this left-most region
  if((left_length <= _max_cluster_length) && (cluster_length > _max_cluster_length)) {
    //fprintf(stderr, "discard left-side %ld .. %ld  [ %ld ] [total=%f density=%f]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length, totalValue, density);
    _discard_region(beg, mid1);
  }
  
}

/////////////////////////////////////////////////////////////////////////////////////
//
// variation on full-heirarchy cluster-selection where it picks the
// "smallest stable" cluster. chooses from bottom up of recusrison.
//
/////////////////////////////////////////////////////////////////////////////////////


int  EEDB::Tools::Paraclu::_process_cluster_range_smallest(FeatureLink *beg, FeatureLink *end, double parentDensity) {  
  //recursive algorithm which subdivides sites
  // return 0 = false weak region < min_cutoff_value
  // return 1 = true made cluster, pop out
  // return 2 = discarded some weak reagion in buffer, pop out
  //printf("_process_cluster_range\n");
  if((beg==NULL) || (end==NULL)) { return 0; }
  //if(beg==end) {  return 0; }
  
  long cluster_length = end->feature->chrom_start() - beg->feature->chrom_start() + 1;
  double totalValue   = _calc_total_value(beg, end);
  double density      = totalValue / cluster_length;

  //fprintf(stderr, "_process_cluster_range  %ld .. %ld  [ %ld ] [total=%f density=%f]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length, totalValue, density);

  if(cluster_length > _max_cluster_length) {
    //use self density if cluster region is greater than max_cluster_length
    //don't track parent density above _max_cluster_length since it is meaningless is the ZENBU buffering design
    parentDensity = density;
  }
  double newParentDensity = max(parentDensity, density); //most dense parent for children, either me or my densest parent
  double stability = density/parentDensity; //my stability

  if(cluster_length <= _max_cluster_length) {
    //fprintf(stderr, "_process_cluster_range  %ld .. %ld  [ %ld ] [total=%f stability=%f]\n", beg->feature->chrom_start(), end->feature->chrom_start(), cluster_length, totalValue, stability);
  }

  if(totalValue < _min_cutoff_value) { //weak region so can fall out
    return 0; 
  } 

  if(beg==end) {  
    //fprintf(stderr, "_process_cluster_range  beg == end density[%f] parentDensity[%f] stability[%f] minstab[%f]\n", density, parentDensity, stability, _min_stability);
    if(stability >= _min_stability) {
      //this is part of the hierarchy
      //fprintf(stderr, "this region is small [%ld] & STABLE [%f]\n", cluster_length, stability);
      EEDB::Feature *feature = _generate_cluster(beg, end);
      if(feature) {
        feature->metadataset()->add_tag_data("density", d_to_string(density));
        feature->metadataset()->add_tag_data("maxDensity", d_to_string(density));  //1bp so no children
        feature->metadataset()->add_tag_data("parentDensity", d_to_string(parentDensity));
        feature->metadataset()->add_tag_data("stability", d_to_string(stability));
        _output_buffer->insert_feature(feature);
        return 1;
      } 
    }
    //all other cases is a fail
    return 0;
  }

  //
  // find best mid-cut-point
  //
  _weakestPrefix(beg, end);
  _weakestSuffix(beg, end);
  
  double maxDensity;
  FeatureLink *mid = NULL;
  if(_minPrefixDensity < _minSuffixDensity) {
    maxDensity = _minPrefixDensity;
    mid = _minPrefix;
    //fprintf(stderr, "choose prefix %f %d\n", _minPrefixDensity, _minPrefix->feature->chrom_start());
  } else {
    maxDensity = _minSuffixDensity;
    mid = _minSuffix;
    //fprintf(stderr, "choose suffix %f %d\n", _minSuffixDensity, _minSuffix->feature->chrom_start());
  }  

  if(mid==NULL) { 
    //did not find a cut so bounce out
    //fprintf(stderr, "Paraclu PROBLEM mid is null\n");
    return 0;
  }
  //printf("  maxDensity %f\n", maxDensity);
  //printf("  parentDensity %f\n", parentDensity);
  //printf("  mid link %s\n", mid->feature->chrom_location().c_str());

  int rtn =0;
  int rtn1=0;
  int rtn2=0;

  //
  //subdivide code
  //

  //printf("  subdivide\n");
  //check left child first, if it makes a cluster return out
  //printf("\nleft child  %s .. %s  [ %ld ]\n", beg->feature->chrom_location().c_str(), end->feature->chrom_location().c_str(), cluster_length);
    
  FeatureLink *mid1 = mid->prev;
  long   left_length  = mid1->feature->chrom_start() - beg->feature->chrom_start() + 1;
  //double left_total   = _calc_total_value(beg, mid1);
  //double left_density = left_total / left_length;

  long   right_length  = end->feature->chrom_start() - mid->feature->chrom_start() + 1;
  //double right_total   = _calc_total_value(mid, end);
  //double right_density = right_total/ right_length;

  //fprintf(stderr, "left\n");
  rtn1 = _process_cluster_range_smallest(beg, mid1, newParentDensity);
  rtn = rtn1;

  if((left_length <= _max_cluster_length) && (cluster_length > _max_cluster_length)) {
    //special transition, check if child can be recovered based on signal
    if(rtn1==0) {
      double left_total   = _calc_total_value(beg, mid1);
      double left_density = left_total / left_length;
      if(left_total >= _min_cutoff_value) {
        //children failed to find stable sub clusters, but there is enough signal here to make a cluster
        EEDB::Feature *feature = _generate_cluster(beg, mid1);
        if(feature) {
          feature->metadataset()->add_tag_data("density", d_to_string(left_density));
          feature->metadataset()->add_tag_data("maxDensity", d_to_string(maxDensity));
          feature->metadataset()->add_tag_data("parentDensity", d_to_string(newParentDensity));
          feature->metadataset()->add_tag_data("stability", d_to_string(left_density/newParentDensity));
          string name = feature->primary_name() + "-wholeleft";
          feature->primary_name(name);
          _output_buffer->insert_feature(feature);
          rtn = 1;
        }
      }
    }
    if(rtn==0) { rtn=2; }
    //fprintf(stderr, "discard left-side now\n");
    _discard_region(beg, mid1);
    return rtn;
  }

  if(cluster_length > _max_cluster_length) { 
    if(rtn==0) {
      //do partial trimming of left side to slide buffer if still nothing happened below
      double left_total = _calc_total_value(beg, mid1);
      if(left_total < _min_cutoff_value) {
        //fprintf(stderr, "discard left-side now\n");
        _discard_region(beg, mid1);
        return 2;
      }
    }
    return rtn;
  }

  //
  // next check right child only if we are < max_cluster_length
  //

  //fprintf(stderr, "right child  %ld .. %ld .. %ld  [ %ld ]\n", beg->feature->chrom_start(), mid->feature->chrom_start(), end->feature->chrom_start(), cluster_length);
  //cerr <<"right\n";
  //fprintf(stderr, "right\n");
  rtn2 = _process_cluster_range_smallest(mid, end, newParentDensity);
  if(rtn2==1) { rtn = rtn2; }
  if(rtn2==2) {
    fprintf(stderr, "Paraclu PROBLEM right side returned a 2 which should never happen\n");
  }

  if(rtn1==0 && rtn2==1) {
    //right made clusters, check if left  has enough signal to be cluster
    double left_total   = _calc_total_value(beg, mid1);
    double left_density = left_total / left_length;
    if(left_total >= _min_cutoff_value) {
      EEDB::Feature *feature = _generate_cluster(beg, mid1);
      if(feature) {
        //fprintf(stderr, "LEFT-fill because right was stable\n");
        feature->metadataset()->add_tag_data("density", d_to_string(left_density));
        feature->metadataset()->add_tag_data("maxDensity", d_to_string(maxDensity));
        feature->metadataset()->add_tag_data("parentDensity", d_to_string(newParentDensity));
        feature->metadataset()->add_tag_data("stability", d_to_string(left_density/newParentDensity));
        //fprintf(stderr, "cluster %s\n", feature->chrom_location().c_str());
        string name = feature->primary_name() + "-leftfill";
        feature->primary_name(name);
        _output_buffer->insert_feature(feature);
        rtn = 1;
      }
    }
  }

  if(rtn1==1 && rtn2==0) {
    //left made clusters, check if right  has enough signal to be cluster
    double right_total   = _calc_total_value(mid, end);
    double right_density = right_total / right_length;
    if(right_total >= _min_cutoff_value) {
      //fprintf(stderr, "RIGHT-fill because left made cluster\n");
      EEDB::Feature *feature = _generate_cluster(mid, end);
      if(feature) {
        feature->metadataset()->add_tag_data("density", d_to_string(right_density));
        feature->metadataset()->add_tag_data("maxDensity", d_to_string(maxDensity));
        feature->metadataset()->add_tag_data("parentDensity", d_to_string(newParentDensity));
        feature->metadataset()->add_tag_data("stability", d_to_string(right_density/newParentDensity));
        //fprintf(stderr, "cluster %s\n", feature->chrom_location().c_str());
        string name = feature->primary_name() + "-rightfill";
        feature->primary_name(name);
        _output_buffer->insert_feature(feature);
        rtn=1;
      }
    }
  }

  if((cluster_length <= _max_cluster_length) && (stability >= _min_stability)) {
    //this is part of the hierarchy
    //fprintf(stderr, "this region is small [%ld] & STABLE [%f]\n", cluster_length, stability);
    /*
    std::cerr << beg->feature->chrom_name() << "\t" << beg->feature->strand() << "\t"
    << std::setprecision(20)
    << beg->feature->chrom_start() << "\t" << end->feature->chrom_start() << "\t"
    << cluster_length << "\t" << totalValue << "\t"
    << std::setprecision(3)
    << parentDensity << "\t" << maxDensity ;
    std::cerr << "\t" << stability;
    if(stability >= _min_stability) { std::cerr << "\tSTABLE"; }
    std::cerr << "\n";
    */

    //if children failed to make clusters, BUT I am stable then I can make a cluster
    if(rtn==0) {
      EEDB::Feature *feature = _generate_cluster(beg, end);
      if(feature) {
        feature->metadataset()->add_tag_data("density", d_to_string(density));
        feature->metadataset()->add_tag_data("maxDensity", d_to_string(maxDensity));
        feature->metadataset()->add_tag_data("parentDensity", d_to_string(parentDensity));
        feature->metadataset()->add_tag_data("stability", d_to_string(stability));
        _output_buffer->insert_feature(feature);
        return 1;    
      }
    }
  }

  return rtn;
}



EEDB::Feature*  EEDB::Tools::Paraclu::_generate_cluster(FeatureLink *beg, FeatureLink *end) {
  //this range has been deemed a valid cluster so convert into a Feature for output
  
  //fprintf(stderr, "_generate_cluster %ld .. %ld\n", beg->feature->chrom_start(), end->feature->chrom_start());
  EEDB::Feature *feature = EEDB::Feature::realloc();
  feature->feature_source(_feature_source);
  feature->chrom(_stream_chrom);
  feature->chrom_start(beg->feature->chrom_start());
  feature->chrom_end(end->feature->chrom_start());
  feature->strand(beg->feature->strand());

  EEDB::FeatureLink *flink = beg;
  while(flink) {
    feature->collate_expression(flink->feature, EEDB::CL_SUM);
    if(flink==end) { break; }
    flink = flink->next;
  }

  feature->calc_significance(CL_SUM);
  if(feature->significance() < _min_cutoff_value) {
    //fprintf(stderr, "trying to make cluster, but it is too weak so give up\n");
    feature->release();
    return NULL;
  }

  char buffer[256];
  snprintf(buffer, 256, "paraclu_%ld_%s", _cluster_number++, feature->chrom_location().c_str());
  feature->primary_name(buffer);

  return feature;
}


///////////////////////////////////////////////////////////////////////////////////////////
//
// re-interpretation of paraclu, should behave the same but new "cut/select" idea
//   works only on left-side recursion and adds concept of "best_cluster" to the 
//   depth-first search. no need for min_stability cutoff
//
///////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Tools::Paraclu::_process_cluster_range_best(FeatureLink *beg, FeatureLink *end) {  

  if(_best_cluster) {
    delete _best_cluster;
    _best_cluster = NULL;
  }
  _best_cluster = new EEDB::Tools::Paraclu::Cluster;

  _recurse_cluster_range(beg, end, -infinity);

  //if((_best_cluster->totalValue >= _min_cutoff_value) && (_best_cluster->stability >= _min_stability)) {
  //if((cluster_length <= _max_cluster_length) && (stability ) && (maxDensity > minDensity)) {
  if(_best_cluster->totalValue >= _min_cutoff_value) {
    EEDB::Feature *feature = _generate_cluster(_best_cluster);
    //printf("cluster %s\n", feature->chrom_location().c_str());
    _output_buffer->insert_feature(feature);
  } else {
    _recover_singletons(_best_cluster->beg, _best_cluster->end);
  }
  _discard_region(beg, _best_cluster->end);
}


void  EEDB::Tools::Paraclu::_recurse_cluster_range(FeatureLink *beg, FeatureLink *end, double minDensity) {  
  //recursive algorithm which subdivides sites
  //printf("_recurse_cluster_range\n");
  if((beg==NULL) || (end==NULL)) { return; }
  
  if(beg==end) {
    if(_best_cluster->stability == 0) {
      //singleton, no best above it
      _best_cluster->beg = beg;
      _best_cluster->end = end;
      _best_cluster->totalValue = beg->feature->significance();
      _best_cluster->stability = 1.0;
      _best_cluster->minDensity = minDensity;
      _best_cluster->maxDensity = minDensity;
      //_best_cluster->show();
    }
    return;
  }
    
  long cluster_length = end->feature->chrom_start() - beg->feature->chrom_start() + 1;
  //fprintf(stderr, "_recurse_cluster_range  %s .. %s  [ %ld ]\n", beg->feature->chrom_location().c_str(), end->feature->chrom_location().c_str(), cluster_length);
  
  double maxDensity=0.0, totalValue=0.0;
  FeatureLink *mid = NULL;

  totalValue = _weakestPrefix(beg, end);
  if (totalValue < _min_cutoff_value) { 
    //weak region
    if(_best_cluster->stability == 0) {
      _best_cluster->beg = beg;
      _best_cluster->end = end;
      _best_cluster->totalValue = totalValue;
      //_best_cluster->show();
      //printf(" WEAK < min_cutoff\n");
    }
    return; 
  } 
  totalValue = _weakestSuffix(beg, end);

  if(_minPrefixDensity < _minSuffixDensity) {
    maxDensity = _minPrefixDensity;
    mid = _minPrefix;
    //fprintf(stderr, "choose prefix %f %d\n", _minPrefixDensity, _minPrefix->feature->chrom_start());
  } else {
    maxDensity = _minSuffixDensity;
    mid = _minSuffix;
    //fprintf(stderr, "choose suffix %f %d\n", _minSuffixDensity, _minSuffix->feature->chrom_start());
  }

  //double maxDensity = min(_minPrefixDensity, _minSuffixDensity);
  double stability = maxDensity/minDensity;
  //printf("  maxDensity %f\n", maxDensity);
  //printf("  minDensity %f\n", minDensity);
  //printf("  stability %f\n", stability);
  
  /*
  if (maxDensity > minDensity) {
    std::cerr << beg->feature->chrom_name() << "\t" << beg->feature->strand() << "\t"
    << std::setprecision(20)
    << beg->feature->chrom_start() << "\t" << end->feature->chrom_start() << "\t"
    << cluster_length << "\t" << totalValue << "\t"
    << std::setprecision(3)
    << minDensity << "\t" << maxDensity ;
    std::cerr << "\t" << stability;
    if(stability >= _min_stability) { std::cerr << "\tSTABLE"; }
    std::cerr << "\n";
  }
  */
  
  
  if((cluster_length <= _max_cluster_length) && (maxDensity > minDensity)) {
  //if((cluster_length <= _max_cluster_length) && (stability >= _min_stability) && (maxDensity > minDensity)) {
    //printf("  this region is small [%ld] & STABLE [%f], but check children first\n", cluster_length, stability);
    if(_best_cluster->stability < stability) {
      //printf("new best cluster\n");
      _best_cluster->beg = beg;
      _best_cluster->end = end;
      _best_cluster->minDensity = minDensity;
      _best_cluster->maxDensity = maxDensity;
      _best_cluster->totalValue = totalValue;
      _best_cluster->stability = stability;
    }
  }
  
  //FeatureLink *mid = (_minPrefixDensity < _minSuffixDensity) ? _minPrefix : _minSuffix;
  double newMinDensity = max(minDensity, maxDensity);
  //printf("  mid link %s\n", mid->feature->chrom_location().c_str());

  //if <max_length and stable -> create cluster
  
  if(mid && (maxDensity < infinity)) {
    //printf("  subdivide\n");
    //check left child first, if it makes a cluster return out
    //printf("\nleft child  %s .. %s  [ %ld ]\n", beg->feature->chrom_location().c_str(), end->feature->chrom_location().c_str(), cluster_length);
    _recurse_cluster_range(beg, mid->prev, newMinDensity);
  }
  //printf("returned to parent  %s .. %s  [ %ld ]\n", beg->feature->chrom_location().c_str(), end->feature->chrom_location().c_str(), cluster_length);
}



EEDB::Feature*  EEDB::Tools::Paraclu::_generate_cluster(Cluster *cl) {
  //this range has been deemed a valid cluster
  //convert into a feature for output and readjust feature links to remove these features
  
  //fprintf(stderr, "_generate_cluster %ld .. %ld\n", cl->beg->feature->chrom_start(), cl->end->feature->chrom_start());
  EEDB::Feature *feature = EEDB::Feature::realloc();
  feature->feature_source(_feature_source);
  feature->chrom(_stream_chrom);
  feature->chrom_start(cl->beg->feature->chrom_start());
  feature->chrom_end(cl->end->feature->chrom_start());
  feature->strand(cl->beg->feature->strand());
  feature->primary_name("paraclu_" + feature->chrom_location());
  
  EEDB::FeatureLink *flink = cl->beg;
  while(flink) {
    feature->collate_expression(flink->feature, EEDB::CL_SUM);
    if(flink==cl->end) { break; }
    flink = flink->next;
  }
  feature->calc_significance(CL_SUM);

  return feature;
}


void  EEDB::Tools::Paraclu::_recover_singletons(FeatureLink *beg, FeatureLink *end) {
  //if I am about to throw away a region I need to recover any strong CTSS singletons
  //TODO: figure out where I need to call this
  EEDB::FeatureLink *flink = beg;
  while(flink) {
    if(flink->feature->significance() > _min_cutoff_value) {
      flink->feature->retain();
      _output_buffer->insert_feature(flink->feature);
    }
    if(flink==end) { break; }
    flink = flink->next;
  }
}

