/* $Id: StreamTKs.cpp,v 1.9 2013/11/26 08:50:48 severin Exp $ */

/***

NAME - EEDB::SPStreams::StreamTKs

SYNOPSIS

DESCRIPTION

 A stream module which will merge incoming features into transcriptional frameworks (TKs)
TKs are chains of TSS, splice-donors, splice-acceptors and TSE.

(Transcript) Features with SubFeatures of eedb:category `exon` are transformed into (TK) Features with
 1 bp-wide SubFeatures corresponding to (eedb:category) TSS, splice-donors, splice-acceptors and TSE.
 TSS, splice-donors and splice-acceptors (but not TSE) overlapping SubFeatures are merged into the same 
 (TK) Features which get streamed out.

CONTACT

Jessica Severin <severin@gsc.riken.jp>
Nicolas Bertin <nbertin@gsc.riken.jp>

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
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/StreamTKs.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::StreamTKs::class_name = "EEDB::SPStreams::StreamTKs";

//function prototypes
void _spstream_streamtks_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::StreamTKs*)obj;
}
MQDB::DBObject* _spstream_streamtks_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::StreamTKs*)node)->_next_in_stream();
}
void _spstream_streamtks_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::StreamTKs*)node)->_reset_stream_node();
}
void _spstream_streamtks_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::StreamTKs*)obj)->_xml(xml_buffer);
}
string _spstream_streamtks_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::StreamTKs*)obj)->_display_desc();
}
bool _spstream_streamtks_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::StreamTKs*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}

////////////////////////////////////////////////////////////////////////////
//
// creation methods
//
////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::StreamTKs::StreamTKs() {
  init();
}

EEDB::SPStreams::StreamTKs::~StreamTKs() {
}

void EEDB::SPStreams::StreamTKs::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::StreamTKs::class_name;
  _module_name               = "StreamTKs";
  _funcptr_delete            = _spstream_streamtks_delete_func;
  _funcptr_xml               = _spstream_streamtks_xml_func;
  _funcptr_simple_xml        = _spstream_streamtks_xml_func;
  _funcptr_display_desc      = _spstream_streamtks_display_desc_func;

  _funcptr_next_in_stream           = _spstream_streamtks_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_streamtks_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_streamtks_stream_by_named_region_func;
  
  _transfer_expression = false;
  _region_start        = -1;
  _region_end          = -1;

  _feature_buffer.unique_features(true);
  _feature_buffer.match_category(true);
  _feature_buffer.match_source(false);
  _feature_buffer.expression_mode(CL_SUM);

  _splice_donor_fsrc  = new EEDB::FeatureSource;
  _splice_donor_fsrc->category("splice_donor");
  _splice_acceptor_fsrc  = new EEDB::FeatureSource;
  _splice_acceptor_fsrc->category("splice_acceptor");
  _tss_fsrc  = new EEDB::FeatureSource;
  _tss_fsrc->category("tss");
  _tse_fsrc  = new EEDB::FeatureSource;
  _tse_fsrc->category("tse");

  _overlap_condition["splice_donor"] = 0;
  _overlap_condition["splice_acceptor"] = 0;
  _overlap_condition["tss"] = 10;
  _overlap_condition["tse"] = 0;
 
  _metadata_tag = "source_transcript_primary_name";
  _tk_basename = "TK";
  _tk_count = 1;
  _subfeat_filter_categories["block"] = true;
  _subfeat_filter_categories["exon"] = true;
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::StreamTKs::_display_desc() {
  string str = "StreamTKs";
  return str;
}


void EEDB::SPStreams::StreamTKs::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  if(_transfer_expression) { xml_buffer.append("<transfer_expression>true</transfer_expression>"); }
  
  //older style of <ignore_strand value="1" />
  //if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::StreamTKs::StreamTKs(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node, *node2;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("category_filter")) != NULL) { 
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }
  
  _transfer_expression = false;
  if((node = root_node->first_node("transfer_expression")) != NULL) { 
    if(string(node->value()) == "true") { _transfer_expression=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _transfer_expression=true;
    }
  }
  
  // unique control section
  _feature_buffer.unique_features(false);
  if((node2 = root_node->first_node("unique")) != NULL) { 
    _feature_buffer.unique_features(true);
    _feature_buffer.match_category(true);
    _feature_buffer.match_source(false);
    _feature_buffer.expression_mode(CL_SUM);
    
    if((node = node2->first_node("match_category")) != NULL) { 
      if(string(node->value()) == "true") { _feature_buffer.match_category(true); }
      else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
        _feature_buffer.match_category(true);
      }
    }
    if((node = node2->first_node("match_source")) != NULL) { 
      if(string(node->value()) == "true") { _feature_buffer.match_source(true); }
      else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
        _feature_buffer.match_source(true);
      }
    }
    if((node = node2->first_node("expression_mode")) != NULL) { 
      string mode = node->value();
      if(mode == "sum")   { _feature_buffer.expression_mode(CL_SUM); }
      if(mode == "min")   { _feature_buffer.expression_mode(CL_MIN); }
      if(mode == "max")   { _feature_buffer.expression_mode(CL_MAX); }
      if(mode == "count") { _feature_buffer.expression_mode(CL_COUNT); }
      if(mode == "mean")  { _feature_buffer.expression_mode(CL_MEAN); }
    }
  }
}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::StreamTKs::_next_in_stream() {
  MQDB::DBObject *obj;

  // check if with this new incoming feature shall trigger the release of buffered spfeatures
  EEDB::Feature *feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature\expression objects are just passed through this module      
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      // process the feature will       
      _process_feature((EEDB::Feature*)obj);

      feature = _feature_buffer.next_completed_feature();
      if(feature) { return feature; }
    }
  }
  
  // input stream is empty so move all _subfeature_buffer into _completed_subfeatures
  _feature_buffer.transfer_all_to_completed();
    
  // return next completed feature if available
  feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }  
  return NULL; 
}


void EEDB::SPStreams::StreamTKs::_reset_stream_node() {  

  EEDB::SPStream::_reset_stream_node();

  // need to see with Jessica how to best get TKs when there are input features extending beyond the edge of the selected region
  _feature_buffer.reset();
  _region_start        = -1;
  _region_end          = -1;
}


bool EEDB::SPStreams::StreamTKs::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  // need to see with Jessica how to best get TKs when there are input features extending beyond the edge of the selected region
  _region_start = start;
  _region_end   = end;
  //fprintf(stderr,"StreamTKs::_stream_by_named_region %s %d .. %d\n", chrom_name.c_str(), start,_region_end);
  return EEDB::SPStream::_stream_by_named_region(assembly_name, chrom_name, start, end);
}


//
////////////////////////////////////////////////////////////
//


void EEDB::SPStreams::StreamTKs::_process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return; }

  // feature must have a strand ... need to check with Jessica if there isnt a better way here
  if((feature->strand() != '+') && (feature->strand() != '-')) { 
    feature->release();
    return; 
  }

  
  // derive from the feature a spfeature object whose subfeatures are the tss, splice_donor, splice_acceptor and tse sites
  // EEDB::Feature *spfeature  is a TK seed
  EEDB::Feature *spfeature = EEDB::Feature::realloc();
  spfeature->chrom(feature->chrom());
  spfeature->chrom_start(feature->chrom_start());
  spfeature->chrom_end(feature->chrom_end());
  spfeature->strand(feature->strand());

  //spfeature->primary_name(feature->primary_name());
  spfeature->metadataset()->add_tag_data(_metadata_tag, feature->primary_name());

  // all_subfeatures lists the subfeatures of the streamed feature
  //     subfeatures lists the subfeatures of the streamed feature matching the proper _subfeat_filter_categories
  vector<EEDB::Feature*> all_subfeatures = feature->subfeatures();
  vector<EEDB::Feature*> subfeatures;
  
  for(unsigned int i=0; i<all_subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = all_subfeatures[i];
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
    subfeatures.push_back(subfeat);
  }  
  // loop thru the subfeatures of features matching the proper _subfeat_filter_categories
  //           and create splicings, tss and tse features that are added to spfeature (for now just a partial copy of the streamed feature)
  for(unsigned int i=0; i<subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = subfeatures[i];

    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }

    EEDB::Feature *spfeat_start = EEDB::Feature::realloc();
    spfeat_start->chrom(feature->chrom());
    spfeat_start->strand(feature->strand());
    spfeat_start->chrom_start(subfeat->chrom_start());
    spfeat_start->chrom_end(subfeat->chrom_start());
    
    EEDB::Feature *spfeat_end = EEDB::Feature::realloc();
    spfeat_end->chrom(feature->chrom());
    spfeat_end->strand(feature->strand());
    spfeat_end->chrom_start(subfeat->chrom_end());
    spfeat_end->chrom_end(subfeat->chrom_end());
    
    if (feature->strand() == '+'){
      if (i==0){
       	spfeat_start->feature_source(_tss_fsrc);
        spfeat_end->feature_source(_splice_donor_fsrc);	
      }
      else if (i==subfeatures.size()-1){
        spfeat_start->feature_source(_splice_acceptor_fsrc);
      	spfeat_end->feature_source(_tse_fsrc);
      }
      else{
        spfeat_start->feature_source(_splice_acceptor_fsrc);
      	spfeat_end->feature_source(_splice_donor_fsrc);
      }
    }
    else {
      if (i==0){
       	spfeat_start->feature_source(_tse_fsrc);
        spfeat_end->feature_source(_splice_acceptor_fsrc);	
      }
      else if (i==subfeatures.size()-1){
        spfeat_start->feature_source(_splice_donor_fsrc);
      	spfeat_end->feature_source(_tss_fsrc);
      }
      else{
        spfeat_start->feature_source(_splice_donor_fsrc);
        spfeat_end->feature_source(_splice_acceptor_fsrc);
      }
    }
    spfeature->add_subfeature(spfeat_start);
    spfeat_start->release();
    spfeature->add_subfeature(spfeat_end);
    spfeat_end->release();
  }


  // release the feature now that we are done with it
  feature->release();
  
  // check the overlap between subfeatures of spfeature and buffered spfeatures
  // if overlap, remove the buffered spfeature from the buffer and put it into a list
  vector<EEDB::Feature*> overlapping;
  FeatureLink *flink;
  flink = _feature_buffer.buffer_start();
  while(flink){
    //if(flink->feature->subfeature_overlap_check(spfeature)) {
    if(_conditioned_subfeature_overlap_check(flink->feature, spfeature)) {
      overlapping.push_back(flink->feature);
      FeatureLink* fl = flink;
      flink = flink->next;
      _feature_buffer.remove_link(fl);
    }
    else{
      flink = flink->next; 
    }
  }
  // merge the subfeatures of spfeature with all the listed overlapping buffered spfeature
  // update the extreme boundaries of spfeature if needed
  for(unsigned int i=0; i< overlapping.size(); i++) {
    vector<EEDB::Feature*> spfeats = overlapping[i]->subfeatures();
    for(unsigned int j=0; j< spfeats.size(); j++) {
        spfeature->add_subfeature(spfeats[j]);
        if (overlapping[i]->chrom_start() < spfeature->chrom_start()) { spfeature->chrom_start(overlapping[i]->chrom_start()); }
        if (overlapping[i]->chrom_end() > spfeature->chrom_end())   { spfeature->chrom_end(overlapping[i]->chrom_end());     }
    }
    spfeature->metadataset()->merge_metadataset( overlapping[i]->metadataset() );
    overlapping[i]->release();
  }
  spfeature->remove_duplicate_subfeatures();

  // put the (possibly modified/merged) spfeature in the _feature_buffer
  if ( spfeature->primary_name().empty() ){
    char tk_name[1024];
    snprintf(tk_name, 1024, "%s%d", _tk_basename.c_str(),  _tk_count);
    spfeature->primary_name(tk_name);
    _tk_count += 1;
  }

  _feature_buffer.insert_feature(spfeature);
}


bool  EEDB::SPStreams::StreamTKs::_conditioned_subfeature_overlap_check(EEDB::Feature *a, EEDB::Feature *b) {
  if(a->strand() != b->strand()) { return false; }

  vector<EEDB::Feature*> a_subfeats = a->subfeatures();
  vector<EEDB::Feature*> b_subfeats = b->subfeatures();

  //both have subfeatures so do subfeature-to-subfeature check
  for(unsigned int i=0; i<a_subfeats.size(); i++) { 
    EEDB::Feature *subfeat1 = a_subfeats[i];
    if(_overlap_condition.find(subfeat1->feature_source()->category()) != _overlap_condition.end()) {
      int overlap_distance = _overlap_condition[subfeat1->feature_source()->category()];
      for(unsigned int j=0; j<b_subfeats.size(); j++) { 
        EEDB::Feature *subfeat2 = b_subfeats[j];
        if(subfeat1->feature_source()->category() == subfeat2->feature_source()->category()) {
          if (subfeat1->chrom_end() < subfeat2->chrom_start() - overlap_distance) { continue; } //f1 ends before f2 starts
          if (subfeat1->chrom_start() > subfeat2->chrom_end() + overlap_distance) { continue; } //f1 starts after f2 ends
          return true;
        }
      }
    } 
  }
  return false;
}
