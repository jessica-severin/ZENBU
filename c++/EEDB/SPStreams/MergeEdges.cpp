/* $Id: MergeEdges.cpp,v 1.3 2021/07/15 02:25:39 severin Exp $ */

/***

NAME - EEDB::SPStreams::MergeEdges

SYNOPSIS

DESCRIPTION

 a simple module to combine exact edges merging weights and metadata. uses the IDs or locations
 of feature1/feature2 to identify equal connections

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
#include <EEDB/Edge.h>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/MergeEdges.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::MergeEdges::class_name = "EEDB::SPStreams::MergeEdges";

//function prototypes
MQDB::DBObject* _spstream_mergeedges_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MergeEdges*)node)->_next_in_stream();
}
void _spstream_mergeedges_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MergeEdges*)node)->_reset_stream_node();
}
void _spstream_mergeedges_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MergeEdges*)node)->_stream_clear();
}
void _spstream_mergeedges_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MergeEdges*)obj;
}
void _spstream_mergeedges_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::MergeEdges*)obj)->_xml(xml_buffer);
}
bool _spstream_mergeedges_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::MergeEdges*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}
bool _spstream_overlap_merge_edge_sort_func (EEDB::Edge *a, EEDB::Edge *b);

EEDB::SPStreams::MergeEdges::MergeEdges() {
  init();
}

EEDB::SPStreams::MergeEdges::~MergeEdges() {
}


void EEDB::SPStreams::MergeEdges::init() {
  EEDB::SPStream::init();  
  _classname                  = EEDB::SPStreams::MergeEdges::class_name;
  _module_name                = "MergeEdges";

  _funcptr_delete             = _spstream_mergeedges_delete_func;
  _funcptr_xml                = _spstream_mergeedges_xml_func;
  _funcptr_simple_xml         = _spstream_mergeedges_xml_func;

  _funcptr_next_in_stream           = _spstream_mergeedges_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_mergeedges_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_mergeedges_stream_clear_func;
  _funcptr_stream_by_named_region   = _spstream_mergeedges_stream_by_named_region_func;

  _expression_mode           = CL_SUM;
  _streaming_region          = false;
  _stream_from_matrix        = false;
  _ignore_direction          = false;

  _interact_matrix  = new EEDB::InteractionMatrix();
  _interact_matrix->clear_all();
}

void EEDB::SPStreams::MergeEdges::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::MergeEdges::display_desc() {
  return "MergeEdges";
}

string EEDB::SPStreams::MergeEdges::display_contents() {
  return display_desc();
}

/*****************************************************************************************/

void  EEDB::SPStreams::MergeEdges::ignore_direction(bool value) {
  _ignore_direction = value;
}

void  EEDB::SPStreams::MergeEdges::expression_mode(t_collate_express_mode value) {
  _expression_mode = value;
}

/*****************************************************************************************/

void EEDB::SPStreams::MergeEdges::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass
  
  if(_ignore_direction) { xml_buffer.append("<ignore_direction>true</ignore_direction>"); }
  else { xml_buffer.append("<ignore_direction>false</ignore_direction>"); }
  
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


EEDB::SPStreams::MergeEdges::MergeEdges(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
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
  
  _ignore_direction = false;
  if((node = root_node->first_node("ignore_direction")) != NULL) {
    if(string(node->value()) == "true") { _ignore_direction=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _ignore_direction=true;
    }
  }
  _interact_matrix->ignore_direction(_ignore_direction);

}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::MergeEdges::_stream_clear() {
  //re-initialize the stream-stack back to a clear/empty state
  if(source_stream() != NULL) { source_stream()->stream_clear(); }
  _reset_stream_node();
}


void EEDB::SPStreams::MergeEdges::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();

  _interact_matrix->clear_all();
  _interact_matrix->ignore_direction(_ignore_direction);

  _stream_from_matrix = false;
  _streaming_region = false;
  _region_start = -1;
  _region_end   = -1;
}


MQDB::DBObject* EEDB::SPStreams::MergeEdges::_next_in_stream() {
  MQDB::DBObject *obj;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      //only process Edge objects. everything else passed through

      if(obj->classname() == EEDB::Edge::class_name) {
        EEDB::Edge *edge = (EEDB::Edge*)obj;
        
        if(_streaming_region and (_region_start>0) and (edge->chrom_end() < _region_start)) {
          //printf("edge ends %ld before the query region %ld so discard\n", edge->chrom_end(), _region_start);
          edge->release();
          edge = NULL;
          continue;
        }

        if(_streaming_region and (_region_end>0) and (edge->chrom_start() > _region_end)) {
          //printf("edge starts after query region so can stop\n");
          edge->release();
          edge = NULL;
          _reset_stream_node();
          //return NULL;
          continue;
        }
        
        _interact_matrix->add_edge(edge);
        edge->release();
      }
      else {
        return obj;
      }
    }
  }

  // input stream is empty so empty out the interaction matrix
  if(!_stream_from_matrix) {
    _interact_matrix->stream_extract_edges();
    _stream_from_matrix = true;
    //fprintf(stderr, "first time so initialize stream_extract_edges\n");
  }
  
  if(_stream_from_matrix) {
    EEDB::Edge* edge = _interact_matrix->next_edge();
    return edge; 
  }

  return NULL; 
}


bool EEDB::SPStreams::MergeEdges::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  _streaming_region = true;

  //fprintf(stderr,"MergeEdges::_stream_by_named_region[%ld] %s %s %ld .. %ld\n", (long)this, assembly_name.c_str(), chrom_name.c_str(), start, end);  
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}

//
////////////////////////////////////////////////////////////
//

/*
EEDB::Edge* EEDB::SPStreams::MergeEdges::_process_object(MQDB::DBObject* obj) {
  if(obj==NULL) { return NULL; }
  
  EEDB::Edge  *edge =NULL;
  if(obj->classname() == EEDB::Edge::class_name) { edge = (EEDB::Edge*)obj; }
  if(edge==NULL) { return NULL; }
  
  edge->retain();
  //fprintf(stderr, "in-edge %s\n", edge->xml().c_str());
  
  EEDB::Edge *finished_cluster = NULL;
  
  // if streaming by region, I can check the buffer by location to see if a cluster is finished
  if(_stream_from_matrix && !_interact_matrix.empty()) {
    EEDB::Edge *cluster = _interact_matrix.front();
    if(cluster and (cluster->chrom_end() < edge->chrom_start())) {
      printf("edge-cluster ends before new edge - finished\n");
      // no chance of further overlaps so done with this cluster
      finished_cluster = cluster;
      _interact_matrix.pop_front();
    }
  }

  //insert the new edge into the buffer in sorted order
  _interact_matrix.push_front(edge);
  if(_stream_from_matrix) { 
    _interact_matrix.sort(_spstream_overlap_merge_edge_sort_func);
  }
  
  //process the sorted buffer for overlaps and merge
  list<EEDB::Edge*>::iterator it1 = _interact_matrix.begin();
  list<EEDB::Edge*>::iterator it2, it3;
  while(it1 != _interact_matrix.end()) {
    EEDB::Edge *edge1 = (*it1);
    //fprintf(stderr, "edge1: %s\n", edge1->xml().c_str());
    it2 = it1;
    it2++;
    while(it2 != _interact_matrix.end()) {
      EEDB::Edge *edge2 = (*it2);
      //fprintf(stderr, "  edge2: %s\n", edge2->xml().c_str());

      if(_merge_edges(edge1, edge2)) {
        //fprintf(stderr, "  ==found overlap\n");
        //fprintf(stderr, "  ==after merge %s\n", edge1->xml().c_str());
        edge2->release();
        it3 = it2; it3++;  //this code chooses the edge after the current in the list
        _interact_matrix.erase(it2);
        //it2 = it1; it2++;  //this code resets and rescans entire buffer again
        it2 = it3;  //this sets it2 to the edge after the one just removed
      } else {
        it2++;
      }
    }
    it1++;
  }  
  
  if(finished_cluster) {
    finished_cluster->primary_id(-1); //unlink from original object
    //printf STDERR "finished %s\n", $finished_cluster->display_desc;
    return finished_cluster;
  }
  
  return NULL;
}
*/


bool EEDB::SPStreams::MergeEdges::_check_edges_equal(EEDB::Edge* edge1, EEDB::Edge* edge2) {
  //check for unique via feature1/feature2 and merge into edge1 if 
  if(!edge1) { return false; }
  if(!edge2) { return false; }

  //both edges must have both features
  if(!edge1->feature1() || !edge1->feature2()) { return false; }  
  if(!edge2->feature1() || !edge2->feature2()) { return false; }

  /*
  printf("check_edges_equal\n");
  printf("  edge1 f1:(%s) %s\t f2:(%s) %s\n", edge1->feature1_dbid().c_str(), edge1->feature1()->chrom_location().c_str(),
                                                        edge1->feature2_dbid().c_str(), edge1->feature2()->chrom_location().c_str());
  printf("  edge2 f1:(%s) %s\t f2:(%s) %s\n", edge2->feature1_dbid().c_str(), edge2->feature1()->chrom_location().c_str(),
                                                        edge2->feature2_dbid().c_str(), edge2->feature2()->chrom_location().c_str());
  */

  if(!_ignore_direction and (edge1->direction()!=' ') and (edge2->direction()!=' ') and (edge1->direction() != edge2->direction())) {
    //fprintf(stderr, "  --not matching direction, so skip next\n");
    return false;
  }
  //printf("  ok with direction\n");
  //sleep(1);
  
  //first check via feature db_id
  string e1f1id = edge1->feature1_dbid();
  string e1f2id = edge1->feature2_dbid();
  string e2f1id = edge2->feature1_dbid();
  string e2f2id = edge2->feature2_dbid();
  if(!e1f1id.empty() && !e1f2id.empty() && !e2f1id.empty() & !e2f2id.empty()) {
    //printf("  has valid IDs so check them\n");
    if((e1f1id == e2f1id) && (e1f2id == e2f2id)) { return true; }
    if((e1f1id == e2f2id) && (e1f2id == e2f1id)) { return true; }
    //TODO: do I force a fail here?
    //return false;
  }
  
  //check feature equal by location/strand
  if((edge1->feature1() == edge2->feature1()) && (edge1->feature2() == edge2->feature2())) { return true; }
  if((edge1->feature1() == edge2->feature2()) && (edge1->feature2() == edge2->feature1())) { return true; }

  //long start = edge2->chrom_start();
  //long end   = edge2->chrom_end();
  //if(start < edge1->chrom_start()) { edge1->chrom_start(start); }
  //if(end > edge1->chrom_end())     { edge1->chrom_end(end); }
  
  return false;
}

  
bool EEDB::SPStreams::MergeEdges::_merge_edges(EEDB::Edge* edge1, EEDB::Edge* edge2) {
  //check for unique via feature1/feature2 and merge into edge1 if 

  if(!_check_edges_equal(edge1, edge2)) { return false; }
  //printf("merge edges\n\t%s\n\t%s\n", edge1->simple_xml().c_str(), edge2->simple_xml().c_str());
  
  //metadata
  EEDB::MetadataSet *mdset = edge2->metadataset();
  edge1->metadataset()->merge_metadataset(mdset);
  edge1->metadataset()->remove_duplicates();
  //string name2 = feature->primary_name();
  //edge1->metadataset()->add_metadata("merge_alt_names", name2);
  
  //merge wegiths
  vector<EEDB::EdgeWeight*>  weights = edge2->edgeweight_array();
  for(unsigned int j=0; j<weights.size(); j++) {
    _cluster_add_weight(edge1, weights[j]);
  }
  //remove primary_id to de-link from the parent feature since this is a new Edge now
  edge1->primary_id(-1);
  return true;
}


void EEDB::SPStreams::MergeEdges::_cluster_add_weight(EEDB::Edge *cluster, EEDB::EdgeWeight *weight) {
  /*
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
*/
}


bool _spstream_overlap_merge_edge_sort_func (EEDB::Edge *a, EEDB::Edge *b) {
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->chrom_start() < b->chrom_start()) { return true; }
  if((a->chrom_start() == b->chrom_start()) &&
     (a->chrom_end() < b->chrom_end())) { return true; }
  return false;
}


