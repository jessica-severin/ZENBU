/* $Id: OverlapMerge.cpp,v 1.5 2022/02/02 11:04:21 severin Exp $ */

/***

NAME - EEDB::SPStreams::OverlapMerge

SYNOPSIS

DESCRIPTION

simple clustering algorithm which processes features on the main stream for overalaps and merges

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
#include <EEDB/SPStreams/OverlapMerge.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::OverlapMerge::class_name = "EEDB::SPStreams::OverlapMerge";

//function prototypes
MQDB::DBObject* _spstream_overlapmerge_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::OverlapMerge*)node)->_next_in_stream();
}
void _spstream_overlapmerge_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OverlapMerge*)node)->_reset_stream_node();
}
void _spstream_overlapmerge_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OverlapMerge*)node)->_stream_clear();
}
void _spstream_overlapmerge_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::OverlapMerge*)obj;
}
void _spstream_overlapmerge_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::OverlapMerge*)obj)->_xml(xml_buffer);
}
bool _spstream_overlapmerge_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::OverlapMerge*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}
bool _spstream_overlap_merge_feature_sort_func (EEDB::Feature *a, EEDB::Feature *b);

EEDB::SPStreams::OverlapMerge::OverlapMerge() {
  init();
}

EEDB::SPStreams::OverlapMerge::~OverlapMerge() {
}


void EEDB::SPStreams::OverlapMerge::init() {
  EEDB::SPStream::init();  
  _classname                  = EEDB::SPStreams::OverlapMerge::class_name;
  _module_name                = "OverlapMerge";

  _funcptr_delete             = _spstream_overlapmerge_delete_func;
  _funcptr_xml                = _spstream_overlapmerge_xml_func;
  _funcptr_simple_xml         = _spstream_overlapmerge_xml_func;

  _funcptr_next_in_stream           = _spstream_overlapmerge_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_overlapmerge_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_overlapmerge_stream_clear_func;
  _funcptr_stream_by_named_region   = _spstream_overlapmerge_stream_by_named_region_func;

  _expression_mode           = CL_SUM;
  _ignore_strand             = false;
  _stream_features_mode      = false;
  _distance                  = 0;
  _overlap_check_subfeatures = false; //extend overlap logic to require subfeature overlap
  _merge_subfeatures         = true;

  _cluster_buffer.clear();
}

void EEDB::SPStreams::OverlapMerge::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::OverlapMerge::display_desc() {
  return "OverlapMerge";
}

string EEDB::SPStreams::OverlapMerge::display_contents() {
  return display_desc();
}

/*****************************************************************************************/

void  EEDB::SPStreams::OverlapMerge::distance(long value) {
  if(value < 0) { value = 0; }
  _distance = value;
}

void  EEDB::SPStreams::OverlapMerge::ignore_strand(bool value) {
  _ignore_strand = value;
}

void  EEDB::SPStreams::OverlapMerge::expression_mode(t_collate_express_mode value) {
  _expression_mode = value;
}

void  EEDB::SPStreams::OverlapMerge::overlap_check_subfeatures(bool value) {
  _overlap_check_subfeatures = value;
}

void  EEDB::SPStreams::OverlapMerge::merge_subfeatures(bool value) {
  _merge_subfeatures = value;
}

/*****************************************************************************************/

void EEDB::SPStreams::OverlapMerge::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass
  
  char buffer[256];
  snprintf(buffer, 256, "<distance>%ld</distance>", _distance);
  xml_buffer.append(buffer);

  if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  else { xml_buffer.append("<ignore_strand>false</ignore_strand>"); }
  
  if(_overlap_check_subfeatures) { xml_buffer.append("<overlap_check_subfeatures>true</overlap_check_subfeatures>"); }
  else { xml_buffer.append("<overlap_check_subfeatures>false</overlap_check_subfeatures>"); }
  
  if(_merge_subfeatures) { xml_buffer.append("<merge_subfeatures>true</merge_subfeatures>"); }
  else { xml_buffer.append("<merge_subfeatures>false</merge_subfeatures>"); }
  
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<subfeature_category_filter>"+(it->first)+"</subfeature_category_filter>");
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


EEDB::SPStreams::OverlapMerge::OverlapMerge(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("distance")) != NULL) {
    _distance = strtol(node->value(), NULL, 10);
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
  
  _ignore_strand = false;
  if((node = root_node->first_node("ignore_strand")) != NULL) {
    if(string(node->value()) == "true") { _ignore_strand=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _ignore_strand=true;
    }
  }
  if((node = root_node->first_node("overlap_check_subfeatures")) != NULL) {
    _overlap_check_subfeatures=false;
    if(string(node->value()) == "true") { _overlap_check_subfeatures=true; }
  }
  if((node = root_node->first_node("merge_subfeatures")) != NULL) {
    _merge_subfeatures=false;
    if(string(node->value()) == "true") { _merge_subfeatures=true; }
  }
  
  if((node = root_node->first_node("subfeature_category_filter")) != NULL) {
    _subfeat_filter_categories.clear();
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("subfeature_category_filter");
    }
  }

}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::OverlapMerge::_next_in_stream() {
  if(!_stream_features_mode) { //call super class 
    return EEDB::SPStream::_next_in_stream();
  }

  MQDB::DBObject *obj;
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      //non-feature\expression objects on the primary source stream
      //are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      EEDB::Feature *cluster = _process_object(obj);
      obj->release();

      if((cluster!=NULL) and (_region_start>0) and (cluster->chrom_end() < _region_start)) {
        //before the query region so discard
        cluster->release();
        cluster = NULL;
      }

      if((cluster!=NULL) and (_region_end>0) and (cluster->chrom_start() > _region_end)) {
        //cluster is outside query region so can stop
        cluster->release();
        cluster = NULL;
        _reset_stream_node();
        return NULL;
      }

      if(cluster!=NULL) { return cluster; }
    }
  }
  
  // input stream is empty so empty out the buffer
  if(!_cluster_buffer.empty()) {
    EEDB::Feature* cluster = _cluster_buffer.front();
    _cluster_buffer.pop_front();
    return cluster; 
  }

  return NULL; 
}


void EEDB::SPStreams::OverlapMerge::_stream_clear() {
  //re-initialize the stream-stack back to a clear/empty state
  if(source_stream() != NULL) { source_stream()->stream_clear(); }
  _reset_stream_node();
}


/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::OverlapMerge::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();

  //for(unsigned int i=0; i<_cluster_buffer.size(); i++) { _cluster_buffer[i]->release(); }
  list<EEDB::Feature*>::iterator it1;
  for(it1 = _cluster_buffer.begin(); it1!=_cluster_buffer.end(); it1++) { (*it1)->release(); }
  _cluster_buffer.clear();

  _stream_features_mode  = false;
  _region_start = -1;
  _region_end   = -1;
}


bool EEDB::SPStreams::OverlapMerge::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  _stream_features_mode  = true;

  //fprintf(stderr,"OverlapMerge::_stream_by_named_region[%ld] %s %s %d .. %d\n", (long)this, assembly_name.c_str(), chrom_name.c_str(), start, end);

  //TODO: may need to pre-query and slip the start point backwards to make sure we get first cluster correctly
  //return source_stream()->stream_by_named_region(assembly_name, chrom_name, cluster->chrom_start(), -1);
  
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, -1);
}

//
////////////////////////////////////////////////////////////
//

EEDB::Feature* EEDB::SPStreams::OverlapMerge::_process_object(MQDB::DBObject* obj) {
  if(obj==NULL) { return NULL; }
  
  EEDB::Feature  *feature =NULL;
  if(obj->classname() == EEDB::Feature::class_name) { feature = (EEDB::Feature*)obj; }
  if(feature==NULL) { return NULL; }
  
  feature->retain();
  //return feature;
  //fprintf(stderr, "in-feature %s\n", feature->bed_description("bed12").c_str());
  
  EEDB::Feature *finished_cluster = NULL;
  //
  // first see if we are done with the cluster on the head of the buffer
  //
  if(!_cluster_buffer.empty()) {
    EEDB::Feature *cluster = _cluster_buffer.front();
    if(cluster and (cluster->chrom_end() < feature->chrom_start() - _distance)) {
      // no chance of further overlaps so done with this cluster
      finished_cluster = cluster;
      _cluster_buffer.pop_front();
    }
  }

  //insert the new feature into the buffer in sorted order
  _cluster_buffer.push_front(feature);
  _cluster_buffer.sort(_spstream_overlap_merge_feature_sort_func);
  
  //process the sorted buffer for overlaps and merge
  list<EEDB::Feature*>::iterator it1 = _cluster_buffer.begin();
  list<EEDB::Feature*>::iterator it2, it3;
  while(it1 != _cluster_buffer.end()) {
    EEDB::Feature *feat1 = (*it1);
    //fprintf(stderr, "feat1: %s\n", feat1->bed_description("bed12").c_str());
    it2 = it1;
    it2++;
    while(it2 != _cluster_buffer.end()) {
      EEDB::Feature *feat2 = (*it2);
      //fprintf(stderr, "  feat2: %s\n", feat2->bed_description("bed12").c_str());
      if(feat2->chrom_start() > feat1->chrom_end() + _distance) { //finished with it2 loop
        //fprintf(stderr, "  --finish it2 loop\n");
        break;
      }

      if(!_ignore_strand and (feat1->strand()!=' ') and (feat2->strand()!=' ') and (feat1->strand() != feat2->strand())) {
        //fprintf(stderr, "  --no match strand, so skip next\n");
        it2++;
        continue;
      }
      
      bool touch = false;
      if(_overlap_check_subfeatures) {
        if(feat1->subfeature_overlap_check(feat2, _subfeat_filter_categories, _distance)) { touch = true; }
      } else {
        if(feat1->overlaps(feat2, _distance)) { touch = true;  }
      }

      if(touch) {
        //fprintf(stderr, "  ==found overlap\n");
        _merge_cluster(feat1, feat2);
        //fprintf(stderr, "  ==after merge %s\n", feat1->bed_description("bed12").c_str());
        feat2->release();
        //it3 = it2;
        //it3++;
        _cluster_buffer.erase(it2);
        //it2 = it3;
        //might need to back up and try again from the beginning, in case the exon structure cause overlap
        it2 = it1;
        it2++;
      } else {
        it2++;
      }
    }
    it1++;
  }

  
  /*
  //
  // process the overlaps in the buffer
  //
  vector<EEDB::Feature*>  touched_clusters;
  vector<EEDB::Feature*>  other_clusters;
  for(unsigned int i=0; i<_cluster_buffer.size(); i++) {
    EEDB::Feature *cluster = _cluster_buffer[i];
    if(!_ignore_strand and (cluster->strand()!=' ') and (feature->strand()!=' ') and (feature->strand() != cluster->strand())) {
      other_clusters.push_back(cluster);
      continue;
    }
    
    bool touch = false;
    if(_overlap_check_subfeatures) {
      if(cluster->subfeature_overlap_check(feature, _subfeat_filter_categories)) { touch = true; }
    } else {
      if(cluster->overlaps(feature, _distance)) { touch = true;  }
    }

    if(touch) { touched_clusters.push_back(cluster); }
    else { other_clusters.push_back(cluster); }
  }
  
  //
  // if no clusters were tocuhed then create new cluster
  // and sort new cluster into buffer
  //
  if(scalar(@touched_clusters) == 0) {
    my $new_cluster  = $self->create_new_cluster($obj);
    push @{$self->{'_cluster_buffer'}}, $new_cluster;
    //printf STDERR "buffer %d size\n", scalar(@{$self->{'_cluster_buffer'}});
    foreach my $c1 (@{$self->{'_cluster_buffer'}}) {
      //printf STDERR "  buffer: %s\n", $c1->display_desc();
    }
    my @sortedarray = sort cluster_sort_func @{$self->{'_cluster_buffer'}};
    //sort(_subfeature_array.begin(), _subfeature_array.end(), _subfeature_sort_func);
    //printf STDERR "after sort\n";
    $self->{'_cluster_buffer'} = [@sortedarray];
  }
  else {
    //
    // >= 1 cluster was touched, first one in array becomes master
    //
    my $cluster1 = shift @touched_clusters;
    //printf STDERR "touched %s\n", $cluster->display_desc;
    $self->extend_cluster($cluster1, $obj);
    $self->cluster_merge_expression($cluster1, $obj);
    
    //remaining touched clusters now need to be merged into the master
    foreach my $cluster2 (@touched_clusters) {
      if($cluster2->chrom_start < $cluster1->chrom_start) { $cluster1->chrom_start($cluster2->chrom_start); }
      if($cluster2->chrom_end > $cluster->chrom_end) { $cluster1->chrom_end($cluster2->chrom_end); }
      $self->cluster_merge_expression($cluster1, $cluster2);
    }
    
    // rebuild the sorted _cluster_buffer
    push @other_clusters, $cluster1;
    my @sortedarray = sort cluster_sort_func @other_clusters;
    //sort(_subfeature_array.begin(), _subfeature_array.end(), _spstream_overlap_merge_feature_sort_func);
    $self->{'_cluster_buffer'} = \@sortedarray;
  }
  */
  
  if(finished_cluster) {
    finished_cluster->primary_id(-1); //unlink from original object
    finished_cluster->calc_significance(_expression_mode);
    //printf STDERR "finished %s\n", $finished_cluster->display_desc;
    return finished_cluster;
  }
  return NULL;
}


void EEDB::SPStreams::OverlapMerge::_merge_cluster(EEDB::Feature* cluster, EEDB::Feature* feature) {
  if(!cluster) { return; }
  if(!feature) { return; }
  
  long start = feature->chrom_start();
  long end   = feature->chrom_end();
  if(start < cluster->chrom_start()) { cluster->chrom_start(start); }
  if(end > cluster->chrom_end())     { cluster->chrom_end(end); }

  //subfeatures
  vector<EEDB::Feature*> subfeatures = feature->subfeatures();
  for(unsigned int i=0; i<subfeatures.size(); i++) {
    EEDB::Feature *subfeat = subfeatures[i];
    cluster->add_subfeature(subfeat);
  }
  if(_merge_subfeatures) { cluster->overlap_merge_subfeatures(); }

  //metadata
  EEDB::MetadataSet *mdset = feature->metadataset();
  cluster->metadataset()->merge_metadataset(mdset);
  cluster->metadataset()->remove_duplicates();
  string name2 = feature->primary_name();
  cluster->metadataset()->add_metadata("merge_alt_names", name2);

  //merge expression
  vector<EEDB::Expression*>  expression = feature->expression_array();
  for(unsigned int j=0; j<expression.size(); j++) {
    _cluster_add_expression(cluster, expression[j], 1);
  }
  //remove primary_id to de-link from the parent feature since this is a new Feature now
  cluster->primary_id(-1);
}


void EEDB::SPStreams::OverlapMerge::_cluster_add_expression(EEDB::Feature *cluster, EEDB::Expression *express, long dup_count) {
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


bool _spstream_overlap_merge_feature_sort_func (EEDB::Feature *a, EEDB::Feature *b) {
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->chrom_start() < b->chrom_start()) { return true; }
  if((a->chrom_start() == b->chrom_start()) &&
     (a->chrom_end() < b->chrom_end())) { return true; }
  return false;
}


