/* $Id: GapFilterAnnotate.cpp,v 1.5 2024/03/11 08:00:10 severin Exp $ */

/***

NAME - EEDB::SPStreams::GapFilterAnnotate

SYNOPSIS

DESCRIPTION

  A complex module designed to analyzed "gapped" protocols like PARIS2 or RADICL-seq.
  Performs a combination filtering, categorizing and labeling in a single step.
  Uses an optional side stream with known transcript annotations like GENCODE.

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
#include <MQDB/Database.h>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/GapFilterAnnotate.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::GapFilterAnnotate::class_name = "EEDB::SPStreams::GapFilterAnnotate";

//function prototypes
void _spstream_gapfilterannotate_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::GapFilterAnnotate*)node)->_reset_stream_node();
}
void _spstream_gapfilterannotate_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::GapFilterAnnotate*)obj;
}
MQDB::DBObject* _spstream_gapfilterannotate_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::GapFilterAnnotate*)node)->_next_in_stream();
}
void _spstream_gapfilterannotate_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::GapFilterAnnotate*)obj)->_xml(xml_buffer);
}
string _spstream_gapfilterannotate_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::GapFilterAnnotate*)obj)->_display_desc();
}
bool _spstream_gapfilterannotate_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::GapFilterAnnotate*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}


EEDB::SPStreams::GapFilterAnnotate::GapFilterAnnotate() {
  init();
}

EEDB::SPStreams::GapFilterAnnotate::~GapFilterAnnotate() {
  _reset_stream_node();
}

void EEDB::SPStreams::GapFilterAnnotate::init() {
  EEDB::SPStreams::MergeStreams::init();  

  _classname                 = EEDB::SPStreams::GapFilterAnnotate::class_name;
  _module_name               = "GapFilterAnnotate";
  _funcptr_delete            = _spstream_gapfilterannotate_delete_func;
  _funcptr_xml               = _spstream_gapfilterannotate_xml_func;
  _funcptr_simple_xml        = _spstream_gapfilterannotate_xml_func;
  _funcptr_display_desc      = _spstream_gapfilterannotate_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream           = _spstream_gapfilterannotate_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_gapfilterannotate_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_gapfilterannotate_stream_by_named_region_func;

  //attributes  
  _new_subfeature_source   = new EEDB::FeatureSource();
  _new_subfeature_source->name("GapFilterAnnotate");
  _new_subfeature_source->category("gap");

  _min_gap_length        = 0; //0 means all gaps are analyzed, a positive number means gaps < min will be ignored in the analysis
  _overlap_mode          = "area";
  _mdset_mode            = FEATURE;
  _ignore_strand         = false;
  _overlap_distance      = 0;
  _skip_unannotated      = true;
  _inverse               = false;
  _overlap_check_subfeatures = true; //extend overlap logic to require subfeature overlap
  _annotation_mdtypes.clear();

  _side_stream_empty     = false;
  _side_stream_primed    = false;
  _side_stream_buffer.clear();
  
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::GapFilterAnnotate::_display_desc() {
  string str = "GapFilterAnnotate";
  return str;
}


void EEDB::SPStreams::GapFilterAnnotate::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  char buffer[256];
  
  if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  else { xml_buffer.append("<ignore_strand>false</ignore_strand>"); }
  
  if(_overlap_check_subfeatures) { xml_buffer.append("<overlap_subfeatures>true</overlap_subfeatures>"); }
  else { xml_buffer.append("<overlap_subfeatures>false</overlap_subfeatures>"); }
  
  if(_skip_unannotated) { xml_buffer.append("<skip_unannotated>true</skip_unannotated>"); }
  else { xml_buffer.append("<skip_unannotated>false</skip_unannotated>"); }
  
  if(_inverse) { xml_buffer.append("<inverse>true</inverse>"); }
  else { xml_buffer.append("<inverse>false</inverse>"); }

  if(!_overlap_mode.empty()) { 
    xml_buffer.append("<overlap_mode>");
    xml_buffer.append(_overlap_mode);
    xml_buffer.append("</overlap_mode>"); 
  }
  
  if(_overlap_distance > 0) {
    snprintf(buffer, 256, "<distance>%ld</distance>", _overlap_distance);
    xml_buffer.append(buffer);        
  }

  if(_min_gap_length >=0) { 
    snprintf(buffer, 256, "<min_gap_length>%ld</min_gap_length>", _min_gap_length);
    xml_buffer.append(buffer);    
  }

  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  
  switch(_mdset_mode) {
    case FEATURE:       xml_buffer.append("<mdata_mode>feature</mdata_mode>"); break;
    case FEATURESOURCE: xml_buffer.append("<mdata_mode>featuresource</mdata_mode>"); break;
    case EXPERIMENT:    xml_buffer.append("<mdata_mode>experiment</mdata_mode>"); break;
    case ALL:           xml_buffer.append("<mdata_mode>all</mdata_mode>"); break;
  }
  
  for(unsigned int i=0; i<_annotation_mdtypes.size(); i++) {
    //_annotation_mdtypes[i]->xml(xml_buffer);
    snprintf(buffer, 256, "<annotation_mdtype>%s</annotation_mdtype>", _annotation_mdtypes[i].c_str());
    xml_buffer.append(buffer);    
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::GapFilterAnnotate::GapFilterAnnotate(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("ignore_strand")) != NULL) { 
    _ignore_strand= false;
    if(string(node->value()) == "true") { _ignore_strand=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _ignore_strand=true;
    }
  }
  _overlap_check_subfeatures=false;
  if((node = root_node->first_node("overlap_subfeatures")) != NULL) {
    if(string(node->value()) == "true") { _overlap_check_subfeatures=true; }
  }
  _skip_unannotated=false;
  if((node = root_node->first_node("skip_unannotated")) != NULL) {
    if(string(node->value()) == "true") { _skip_unannotated=true; }
  }
  _inverse = false;
  if((node = root_node->first_node("inverse")) != NULL) { 
    if(string(node->value()) == "true") { _inverse=true; }
  }

  if((node = root_node->first_node("overlap_mode")) != NULL) { 
    _overlap_mode=node->value();
  }
  if((node = root_node->first_node("distance")) != NULL) {
    _overlap_distance = strtol(node->value(), NULL, 10);
  }

  if((node = root_node->first_node("min_gap_length")) != NULL) {
    _min_gap_length = strtol(node->value(), NULL, 10);
  }

  if((node = root_node->first_node("category_filter")) != NULL) { 
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }
  
  _mdset_mode = FEATURE;
  if((node = root_node->first_node("mdata_mode")) != NULL) { 
    if(string(node->value()) == "feature") { _mdset_mode = FEATURE; }
    if(string(node->value()) == "featuresource") { _mdset_mode = FEATURESOURCE; }
    if(string(node->value()) == "experiment") { _mdset_mode = EXPERIMENT; }
    if(string(node->value()) == "all") { _mdset_mode = ALL; }
  }

  _annotation_mdtypes.clear();
  if((node = root_node->first_node("annotation_mdtype")) != NULL) {
    while(node) {
      string mdtype = node->value();
      _annotation_mdtypes.push_back(mdtype);
      node = node->next_sibling("annotation_mdtype");
    }    
  }

  //side stream last
  if((node = root_node->first_node("side_stream")) != NULL) {
    //fprintf(stderr, "GapFilterAnnotate init side_stream\n");
    create_side_stream_from_xml(node);
  }  

}

/*****************************************************************************************/

void  EEDB::SPStreams::GapFilterAnnotate::min_gap_length(long value) {
  if(value < 0) { value = 0; }
  _min_gap_length = value;
}

void  EEDB::SPStreams::GapFilterAnnotate::clear_annotation_mdtypes() {
  _annotation_mdtypes.clear();
}
 
void  EEDB::SPStreams::GapFilterAnnotate::add_annotation_mdtype(string type) {
  if(type.empty()) { return; }
  _annotation_mdtypes.push_back(type);
}


/*****************************************************************************************/

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::GapFilterAnnotate::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }
  MQDB::DBObject *obj;
  
  while((obj = _source_stream->next_in_stream()) != NULL) {
    
    //non-feature objects on the primary source stream
    //are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    if(_gap_analyze_feature((EEDB::Feature*)obj) != _inverse) {
      return obj;
    }

    obj->release();
  }
  
  // input stream is empty so done
  return NULL; 
}


void EEDB::SPStreams::GapFilterAnnotate::_reset_stream_node() {
  EEDB::SPStreams::MergeStreams::_reset_stream_node();

  for(unsigned int i=0; i<_side_stream_buffer.size(); i++) {
    _side_stream_buffer[i]->release();
  }
  _side_stream_buffer.clear();
  _side_stream_empty = false;
  _side_stream_primed= false;
}


bool EEDB::SPStreams::GapFilterAnnotate::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  
  if((side_stream() == NULL) || (source_stream() == NULL)) {
    //side stream is optional in this module
    _side_stream_empty = true;
  }
  //primary stream is dominant one, so side becomes slave to it
  //side stream is primed when needed in _gap_analyze_feature()
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}

//
////////////////////////////////////////////////////////////
//

bool  EEDB::SPStreams::GapFilterAnnotate::_gap_analyze_feature(EEDB::Feature *feature) {  
  //first perform the _min_gap_length checks
  deque<EEDB::Feature*> gaps = _calc_gaps(feature);
  
  deque<EEDB::Feature*>::iterator gap_it = gaps.begin();
  while(gap_it!=gaps.end()) {
    EEDB::Feature *feature = (*gap_it);
    long gap_len = feature->chrom_end() - feature->chrom_start()+1;
    if(gap_len < _min_gap_length) {
      //printf("gap too short: %ld : %s\n", gap_len, feature->chrom_location().c_str());
      feature->release();
      gaps.erase(gap_it);
      gap_it = gaps.begin();
    } else { gap_it++; }
  }
  if(gaps.empty()) { 
    //printf("no gaps remaining after filtering: %s\n", feature->display_desc().c_str());
    return false;
  }

  //next perform the comparison with the optional transcript models
  //remove gaps which match up with known introns
  //and perform annotation to label if input feature is fully contained within a single
  //gene/transcript (and label intragenomic) 
  //or if it connects different genes (intergenomic) and label the two genes
  if(_side_stream_empty && _side_stream_buffer.empty()) {
    if(gaps.size()>1) { feature->metadataset()->add_tag_symbol("gaptype", "gapm"); }
    else { feature->metadataset()->add_tag_symbol("gaptype", "gap1"); }
    for(unsigned int i=0; i<gaps.size(); i++) { gaps[i]->release(); }
    return true;
  }  //gaps but no more side features

  if(!_side_stream_primed) {
    //feature is first valid feature on primary stream so use it to slave the side stream
    side_stream()->stream_by_named_region(feature->assembly_name(), feature->chrom_name(), feature->chrom_start(), -1);
    _side_stream_primed = true;
    //fprintf(stderr, "GapFilterAnnotate prime side_stream with first feature %s\n", feature->simple_xml().c_str());
  }

  deque<EEDB::Feature*>::iterator tb_it;
  EEDB::Feature *sidefeature = NULL;  

  //make sure we have at least one feature in template_buffer
  if(_side_stream_buffer.empty()) { _extend_side_stream_buffer(); }
  if(_side_stream_buffer.empty()) { 
    //no more templates to process
    if(gaps.empty()) { return false; }
    else {
      if(gaps.size()>1) { feature->metadataset()->add_tag_symbol("gaptype", "gapm"); }
      else { feature->metadataset()->add_tag_symbol("gaptype", "gap1"); }
      for(unsigned int i=0; i<gaps.size(); i++) { gaps[i]->release(); }
      return true;
    }
  }
  
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
  if(_side_stream_buffer.empty()) {
     //no more sidefeatures to process
    if(gaps.empty()) { return false; }
    else {
      if(gaps.size()>1) { feature->metadataset()->add_tag_symbol("gaptype", "gapm"); }
      else { feature->metadataset()->add_tag_symbol("gaptype", "gap1"); }
      for(unsigned int i=0; i<gaps.size(); i++) { gaps[i]->release(); }
      return true;
    }    
  }
  
  //
  // then process the overlaps in the _side_stream_buffer
  //
  for(unsigned int i=0; i<_side_stream_buffer.size(); i++) {
    sidefeature = _side_stream_buffer[i];
    if(!_ignore_strand and (sidefeature->strand() != ' ') and (feature->strand()!=' ') and 
       (feature->strand() != sidefeature->strand())) { continue; }
    if(_overlap_check(feature, sidefeature)) {
      deque<EEDB::Feature*> gaps2 = _calc_gaps(sidefeature);
      
      //compare gaps with gaps2 and remove any gap1 which correspond to known introns
      gap_it = gaps.begin();
      while(gap_it!=gaps.end()) {
        EEDB::Feature *gap1 = (*gap_it);
        bool intron_match = false;
        for(unsigned int k=0; k<gaps2.size(); k++) { 
          EEDB::Feature* gap2 = gaps2[k];
          if((abs(gap1->chrom_start() - gap2->chrom_start()) <=_overlap_distance) && 
             (abs(gap1->chrom_end() - gap2->chrom_end()) <= _overlap_distance)) { 
            //fprintf(stderr, "gap %s matches intron %s\n", gap1->chrom_location().c_str(), gap2->chrom_location().c_str());
            intron_match = true;
            break;
          }
        }
        if(intron_match) {
          //delete gap1 from gaps        
          gap1->release();
          gaps.erase(gap_it);
          gap_it = gaps.begin();
        } else { 
          gap_it++;
        }
      }
      
      for(unsigned int j=0; j<gaps2.size(); j++) { gaps2[j]->release(); }

      if(gaps.empty()) { 
        //printf("all remaining gaps matched known introns, filter out\n");
        return false;
      }
      //printf("annotate %s with %s\n", feature->chrom_location().c_str(), sidefeature->display_desc().c_str());
      _transfer_metadata(feature, sidefeature);
    }
  }
  
  if(gaps.empty()) { return false; } //probably shouldn't happen at this point but just in case
  
  //input feature has valid and unknown gaps
  if(gaps.size()>1) { feature->metadataset()->add_tag_symbol("gaptype", "gapm"); }
  else { feature->metadataset()->add_tag_symbol("gaptype", "gap1"); }
  feature->metadataset()->add_tag_symbol("gapcount", l_to_string(gaps.size()));

  for(unsigned int i=0; i<gaps.size(); i++) { gaps[i]->release(); }

  if(!_annotation_mdtypes.empty()) {
    string primary_type = _annotation_mdtypes[0]; //first one is the primary 
    vector<Metadata*> mdlist = feature->metadataset()->find_all_metadata_like(primary_type, "");
    if(mdlist.size()>1) {
      feature->metadataset()->add_tag_symbol("interaction_type", "interaction"); //between genes
    } else if(mdlist.size()==1) {
      feature->metadataset()->add_tag_symbol("interaction_type", "structural"); //contained within a single gene
    } else {
      feature->metadataset()->add_tag_symbol("interaction_type", "none"); //no primary annotation
    }
  }
      
  if(_skip_unannotated) {
    bool has_annotation = false;
    for(unsigned int i=0; i<_annotation_mdtypes.size(); i++) {
      has_annotation = has_annotation || feature->metadataset()->has_metadata_like(_annotation_mdtypes[i], "");
    }
    if(!has_annotation) { 
      //fprintf(stderr, "skip unannotated %s\n", feature->chrom_location().c_str());
      return false;
    }
  }

  return true;
}


deque<EEDB::Feature*>  EEDB::SPStreams::GapFilterAnnotate::_calc_gaps(EEDB::Feature* feature) {
  //analyze subfeatures and generate gaps/introns between selected subfeatures (category)
  deque<EEDB::Feature*> gaps;
  if(feature==NULL) { return gaps; }
  
  vector<EEDB::Feature*> subfeatures = feature->subfeatures();
  if(subfeatures.empty()) { return gaps; }
  
  EEDB::Feature *last_subfeat=NULL;
  
  for(unsigned int i=0; i<subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = subfeatures[i];
    
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
    
    if(last_subfeat) {
      if(last_subfeat->chrom_end()+1 <= subfeat->chrom_start()-1) {
        //OK there is space between the subfeatures to create a new fill-in subfeature
        
        EEDB::Feature *sf2 = EEDB::Feature::realloc();
        sf2->feature_source(_new_subfeature_source);
        
        sf2->primary_name(last_subfeat->primary_name() + ".5");
        sf2->chrom(feature->chrom());
        sf2->strand(feature->strand());
        sf2->chrom_start(last_subfeat->chrom_end() + 1);
        sf2->chrom_end(subfeat->chrom_start()-1);
        
        gaps.push_back(sf2);
      }
    }

    last_subfeat = subfeat;        
  }
  return gaps;
}


EEDB::Feature*  EEDB::SPStreams::GapFilterAnnotate::_extend_side_stream_buffer() {
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


bool  EEDB::SPStreams::GapFilterAnnotate::_overlap_check(EEDB::Feature *feature, EEDB::Feature *sidefeature) {
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


void  EEDB::SPStreams::GapFilterAnnotate::_transfer_metadata(EEDB::Feature *feature, EEDB::Feature *sidefeature) {
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


void  EEDB::SPStreams::GapFilterAnnotate::_transfer_metadata(EEDB::Feature *feature, EEDB::MetadataSet *mdset) {
  if(feature==NULL) { return; }
  if(mdset==NULL) { return; }
  //all transfers via shared pointer and retain()
    
  //specific mdata allows for select transfer
  for(unsigned int i=0; i<_annotation_mdtypes.size(); i++) {
    EEDB::Metadata *md2 = mdset->find_metadata(_annotation_mdtypes[i], "");
    
    if(md2) {
      md2->retain();
      feature->metadataset()->add_metadata(md2);
      //printf("add_metadata %s : %s  to %s\n", md2->type().c_str(), md2->data().c_str(), feature->chrom_location().c_str());
    }
  }
  
  if(_annotation_mdtypes.empty()) { //transfer everything
    feature->metadataset()->merge_metadataset(mdset);
  }  
}


