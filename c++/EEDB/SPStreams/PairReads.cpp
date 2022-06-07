/* $Id: PairReads.cpp,v 1.4 2020/04/20 02:04:09 severin Exp $ */

/***

NAME - EEDB::SPStreams::PairReads

SYNOPSIS

DESCRIPTION

processing module which collates expression from the primary stream
 onto features on the side stream (templates) based on genomic
 overlap logic

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
#include <EEDB/EdgeSource.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/PairReads.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::PairReads::class_name = "EEDB::SPStreams::PairReads";

//function prototypes
MQDB::DBObject* _spstream_pairreads_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::PairReads*)node)->_next_in_stream();
}
void _spstream_pairreads_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::PairReads*)node)->_reset_stream_node();
}
void _spstream_pairreads_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::PairReads*)node)->_stream_clear();
}
void _spstream_pairreads_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::PairReads*)obj;
}
void _spstream_pairreads_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::PairReads*)obj)->_xml(xml_buffer);
}
bool _spstream_pairreads_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::PairReads*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
}
void _spstream_pairreads_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::PairReads*)node)->_reload_stream_data_sources();
}
void _spstream_pairreads_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::PairReads*)node)->_stream_data_sources(classname, filter_logic);
}

bool _spstream_pairreads_feature_name_sort_func (EEDB::Feature *a, EEDB::Feature *b);
bool _spstream_pairreads_feature_pos_sort_func (EEDB::Feature *a, EEDB::Feature *b);

EEDB::SPStreams::PairReads::PairReads() {
  init();
}

EEDB::SPStreams::PairReads::~PairReads() {
}


void EEDB::SPStreams::PairReads::init() {
  EEDB::SPStream::init();  
  _classname                  = EEDB::SPStreams::PairReads::class_name;
  _module_name                = "PairReads";

  _funcptr_delete             = _spstream_pairreads_delete_func;
  _funcptr_xml                = _spstream_pairreads_xml_func;
  _funcptr_simple_xml         = _spstream_pairreads_xml_func;

  _funcptr_next_in_stream           = _spstream_pairreads_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_pairreads_reset_stream_node_func;
  _funcptr_stream_clear             = _spstream_pairreads_stream_clear_func;
  _funcptr_stream_by_named_region   = _spstream_pairreads_stream_by_named_region_func;

  _funcptr_reload_stream_data_sources   = _spstream_pairreads_reload_stream_data_sources_func;
  _funcptr_stream_data_sources          = _spstream_pairreads_stream_data_sources_func;

  _ignore_strand             = true;
  _output_unpaired           = false;
  _sam_md_checks             = true;
  _distance                  = 0;
  _min_length = -1;
  _max_length = -1;

  _feature_buffer.clear();
  _source_streambuffer=NULL;
}

void EEDB::SPStreams::PairReads::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::PairReads::display_desc() {
  return "PairReads";
}

string EEDB::SPStreams::PairReads::display_contents() {
  return display_desc();
}

/*****************************************************************************************/

void  EEDB::SPStreams::PairReads::distance(long value) {
  if(value < 0) { value = abs(value); }
  _distance = value;
}

void  EEDB::SPStreams::PairReads::ignore_strand(bool value) {
  _ignore_strand = value;
}

void  EEDB::SPStreams::PairReads::output_unpaired(bool value) {
  _output_unpaired = value;
}

void  EEDB::SPStreams::PairReads::sam_md_checks(bool value) {
  _sam_md_checks = value;
}

void  EEDB::SPStreams::PairReads::min_length(long value) {
  if(value < 0) { value = abs(value); }
  _min_length = value;
}

void  EEDB::SPStreams::PairReads::max_length(long value) {
  if(value < 0) { value = abs(value); }
  _max_length = value;
}


/*****************************************************************************************/

void EEDB::SPStreams::PairReads::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass
  
  char buffer[256];
  snprintf(buffer, 256, "<distance>%ld</distance>", _distance);
  xml_buffer.append(buffer);

  if(_ignore_strand) { xml_buffer.append("<ignore_strand>true</ignore_strand>"); }
  else { xml_buffer.append("<ignore_strand>false</ignore_strand>"); }
  
  if(_output_unpaired) { xml_buffer.append("<output_unpaired>true</output_unpaired>"); }
  else { xml_buffer.append("<output_unpaired>false</output_unpaired>"); }

  if(_sam_md_checks) { xml_buffer.append("<sam_md_checks>true</sam_md_checks>"); }
  else { xml_buffer.append("<sam_md_checks>false</sam_md_checks>"); }

  if(_min_length >=0) { 
    snprintf(buffer, 256, "<min_length>%ld</min_length>", _min_length);
    xml_buffer.append(buffer);    
  }
  if(_max_length >=0) { 
    snprintf(buffer, 256, "<max_length>%ld</max_length>", _max_length);
    xml_buffer.append(buffer);    
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::PairReads::PairReads(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  //rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((node = root_node->first_node("distance")) != NULL) {
    _distance = strtol(node->value(), NULL, 10);
  }
  
  _ignore_strand = false;
  if((node = root_node->first_node("ignore_strand")) != NULL) {
    if(string(node->value()) == "true") { _ignore_strand=true; }
  }

  _output_unpaired = false;
  if((node = root_node->first_node("output_unpaired")) != NULL) {
    if(string(node->value()) == "true") { _output_unpaired=true; }
  }

  _sam_md_checks = false;
  if((node = root_node->first_node("sam_md_checks")) != NULL) {
    if(string(node->value()) == "true") { _sam_md_checks=true; }
  }

  if((node = root_node->first_node("min_length")) != NULL) {
    _min_length = strtol(node->value(), NULL, 10);
  }
  if((node = root_node->first_node("max_length")) != NULL) {
    _max_length = strtol(node->value(), NULL, 10);
  }
}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::PairReads::_stream_clear() {
  //re-initialize the stream-stack back to a clear/empty state
  if(source_stream() != NULL) { source_stream()->stream_clear(); }
  _reset_stream_node();
}


void EEDB::SPStreams::PairReads::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();

  map<string, EEDB::Feature*>::iterator it1;
  for(it1 = _feature_buffer.begin(); it1!=_feature_buffer.end(); it1++) { (*it1).second->release(); }
  _feature_buffer.clear();

  if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }  

  _region_start = -1;
  _region_end   = -1;
}


bool EEDB::SPStreams::PairReads::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  if(start > _distance) { start -= _distance; }
  if(end > 0) { end += _distance; }

  fprintf(stderr,"PairReads::_stream_by_named_region[%ld] %s %s %ld .. %ld (extd %ld-%ld)\n", (long)this, assembly_name.c_str(), chrom_name.c_str(), _region_start, _region_end, start,end);

  //TODO: may need to pre-query and slip the start point backwards to make sure we get first cluster correctly 
  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}


MQDB::DBObject* EEDB::SPStreams::PairReads::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj;

  //stream the dynamic sources from _source_streambuffer if available
  if(_source_streambuffer) {
    //fprintf(stderr, "_source_streambuffer active : return sources\n");
    obj = _source_streambuffer->next_in_stream();
    if(obj) { return obj; }
    else {
      _source_streambuffer->release(); 
      _source_streambuffer=NULL;
    }
  }

  //otherwise process main stream
  //fprintf(stderr, "PairReads::_next_in_stream : main stream\n");

  while((obj = _source_stream->next_in_stream()) != NULL) {
    //non-feature\expression objects on the primary source stream
    //are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    EEDB::Edge *edge = _process_object(obj);
    obj->release();
    if(edge!=NULL) { return edge; }
  }
  
  // input stream is empty so empty out the buffer
  if(!_feature_buffer.empty() && _output_unpaired) {
    map<string, EEDB::Feature*>::iterator it1 = _feature_buffer.begin();
    if(it1!=_feature_buffer.end()) {
      EEDB::Feature* feature = it1->second;
      _feature_buffer.erase(it1);
      return feature;
    }
  }

  long cnt=0;
  if(!_feature_buffer.empty()) {
    //fprintf(stderr, "%ld unpaired features\n", _feature_buffer.size());
    map<string, EEDB::Feature*>::iterator it1 = _feature_buffer.begin();
    while(it1!=_feature_buffer.end()) {
      EEDB::Feature* feature = it1->second;
      if(feature->chrom_start() <= _region_end && feature->chrom_end() >= _region_start) { cnt++; }
      feature->release();
      it1++;
    }
    _feature_buffer.clear();
  }
  //fprintf(stderr, "%ld unpaired features - inside query region %ld..%ld\n", cnt, _region_start, _region_end);

  return NULL; 
}

///////////////////////////////////////////////////////////////////////////
//
// dynamic source creation section
//
///////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::PairReads::_reload_stream_data_sources() {
  //fprintf(stderr, "PairReads::_reload_stream_data_sources\n");

  if(!source_stream()) { return; }
    
  // first pass this down the stream
  source_stream()->reload_stream_data_sources();

  map<string, EEDB::DataSource*>::iterator it;
  if(_sources_cache.empty()) {
    //fprintf(stderr, "_sources_cache empty: build dynamic EdgeSources\n");
    //stream all sources into my cache and add dynamic EdgeSources as needed
    source_stream()->stream_data_sources();
    EEDB::DataSource *source;
    while((source = (EEDB::DataSource*)source_stream()->next_in_stream())) {
      _cache_datasource(source);
    }
    
    //check cache for missing/dependent edgesources    
    for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
      EEDB::DataSource* source = (*it).second;
      if((source->classname() == EEDB::FeatureSource::class_name) || 
         (source->classname() == EEDB::Experiment::class_name)) {
        _dynamic_edgesource_for(source);
      }
    }
  }
}


EEDB::EdgeSource*  EEDB::SPStreams::PairReads::_dynamic_edgesource_for(EEDB::DataSource *source) {
  if(!source) { return NULL; }
  if(source->classname() == EEDB::EdgeSource::class_name) { return (EEDB::EdgeSource*)source; }
  
  EEDB::EdgeSource *edgesource = _dynamic_edgesource_hash[source->db_id()];
  if(edgesource) { return edgesource; }
  
  fprintf(stderr, "create dynamic EdgeSource for %s\n", source->db_id().c_str());
  edgesource = new EEDB::EdgeSource;
  source->metadataset(); //lazyload if needed
  source->_copy(edgesource);

  //little magic, resetting the primary_id back to itself will cause the db_id() to be rebuilt but now as an EdgeSource. 
  //Since ZENBU always creates increasing primary_ids for all sources within a _funcptr_stream_peers
  //there will never be a default case where a FeatureSource and EdgeSource within the same peer will have the same
  //primary_id, thus this is guaranteeed to create a parallel but not conflicting EdgeSource
  edgesource->primary_id(source->primary_id());
  edgesource->database(NULL);

  //link the dynamic parallel edgesource to the fsrcID
  _dynamic_edgesource_hash[source->db_id()] = edgesource;
  edgesource->retain();

  _cache_datasource(edgesource);
  return edgesource;
}


void EEDB::SPStreams::PairReads::_stream_data_sources(string classname, string filter_logic) { 
  // first check if we need to reload
  //fprintf(stderr, "PairReads::_stream_data_sources\n");

  _reload_stream_data_sources();
  
  map<string, EEDB::EdgeSource*>::iterator it;
  if(!_dynamic_edgesource_hash.empty()) {
    if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }
    _source_streambuffer = new EEDB::SPStreams::StreamBuffer();
    
    for(it = _dynamic_edgesource_hash.begin(); it != _dynamic_edgesource_hash.end(); it++) {
      EEDB::DataSource* source = (*it).second;
      if(source == NULL) { continue; }
      source->retain();
      _source_streambuffer->add_object(source);
    }
  }
  
  //then pass down the stream
  if(source_stream() != NULL) { source_stream()->stream_data_sources(classname, filter_logic); }
}

void EEDB::SPStreams::PairReads::_cache_datasource(EEDB::DataSource* source) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  
  if(source == NULL) { return; }
  if(!source->is_active()) { return; }
  string dbid = source->db_id();
  search_it = _sources_cache.find(dbid);
  if(search_it == _sources_cache.end()) { 
    source->retain();
    _sources_cache[dbid] = source;
  }
}


//
////////////////////////////////////////////////////////////
//

EEDB::Edge* EEDB::SPStreams::PairReads::_process_object(MQDB::DBObject* obj) {
  if(obj==NULL) { return NULL; }
  
  EEDB::Feature  *feat1 =NULL;
  if(obj->classname() == EEDB::Feature::class_name) { feat1 = (EEDB::Feature*)obj; }
  if(feat1==NULL) { return NULL; }
  //fprintf(stderr, "feat1: %s\n", feat1->bed_description("bed6").c_str());
    
  EEDB::Edge *edge = _test_build_pair(feat1);
  //if(!edge) {
  //  fprintf(stderr, "something went wrong, found matching name, but failed to make edge\n");
  //}

  if(edge) {
    if((edge->feature1()->chrom_end() < _region_start) && (edge->feature2()->chrom_end() < _region_start)) {
      //fprintf(stderr, "discard edge because before region_start\n");
      edge->release();
      return NULL;
    }
    if(_region_end>0 && (edge->feature1()->chrom_start() > _region_end) && (edge->feature2()->chrom_start() > _region_end)) {
      //fprintf(stderr, "discard edge because after region_end\n");
      edge->release();
      return NULL;
    }
    if(((edge->feature1()->chrom_end() < _region_start) && (edge->feature2()->chrom_start() > _region_end)) ||
       ((edge->feature2()->chrom_end() < _region_start) && (edge->feature1()->chrom_start() > _region_end))) {
      //fprintf(stderr, "discard edge because neither end falls inside region\n");
      edge->release();
      return NULL;
    }
    //printf STDERR "finished %s\n", $edge->display_desc;
    //printf STDERR "finished %s\n", $edge->display_desc;
    // if(edge->chrom_end() - edge->chrom_start() +1 >= 300000) {
    //   fprintf(stderr, "pair (%ld bp) %s : %s - %s\n", 
    //       edge->chrom_end() - edge->chrom_start() +1,
    //       edge->feature1()->primary_name().c_str(), 
    //       edge->feature1()->chrom_location().c_str(), edge->feature2()->chrom_location().c_str());
    // }
    return edge;
  }
  return NULL;
}


EEDB::Edge*  EEDB::SPStreams::PairReads::_test_build_pair(EEDB::Feature* feature1) {
  if(!feature1) { return NULL; }
  if(!feature1->feature_source()) { return NULL; }
  
  //if mate_chrom_name set then must be intra-chromosomal for this module to work
  if(!feature1->mate_chrom_name().empty() && (feature1->mate_chrom_name() != feature1->chrom_name())) {
    //fprintf(stderr, "f1 mate_chrom [%s] different, only can pair intra-chrom\n", md->data().c_str());
    return NULL;
  }

  //length filters
  if(!feature1->mate_chrom_name().empty() && feature1->mate_start()>0) {
    long length = abs(feature1->chrom_start() - feature1->mate_start() +1);    
    if((_min_length>0) && (length < _min_length)) { 
      return NULL;
    }
    if((_max_length>0) && (length > _max_length)) {
      return NULL;
    }
  }    

  long f1_sam_flags =0;
  if(_sam_md_checks) {
    EEDB::Metadata *md = feature1->metadataset()->find_metadata("sam:flags", "");
    if(md) { f1_sam_flags = strtol(md->data().c_str(), NULL, 10); }
  
    // if(_add_metadata) { feature->metadataset()->add_tag_data("sam:flags", buf); }
    // 
    // if(flags & 0x0010) { feature->strand('-'); } else { feature->strand('+'); }
    // if(flags & 0x0004) { /*fprintf(stderr, "0x04 unmapped\n");*/ feature->chrom(NULL); }
    // if(flags & 0x0001) {  //paired reads
    //     fprintf(stderr, "paired read\n");
    //     if(!(flags & 0x0002)) { /*fprintf(stderr, "0x08 pair is unaligned\n");*/ feature->chrom(NULL); }
    //     if(flags & 0x0008) { /*fprintf(stderr, "0x08 pair is unaligned\n");*/ feature->chrom(NULL); }
    //     
    //     if(_add_metadata) {
    //     feature->metadataset()->add_tag_data("sam:flag", "0x01_paired");
    //     feature->metadataset()->add_tag_data("sam:paired", "paired");
    //     if(flags & 0x0002) { feature->metadataset()->add_tag_data("sam:flag", "0x02_proper_pair"); }
    //     if(flags & 0x0008) { feature->metadataset()->add_tag_data("sam:flag", "0x08_mate_unmapped"); }
    //     if(flags & 0x0010) { feature->metadataset()->add_tag_data("sam:flag", "0x10_read_rev_strand"); }
    //     if(flags & 0x0020) { feature->metadataset()->add_tag_data("sam:flag", "0x20_mate_rev_strand"); }
    //     if(flags & 0x0040) { feature->metadataset()->add_tag_data("sam:flag", "0x40_first_in_pair"); }
    //     if(flags & 0x0080) { feature->metadataset()->add_tag_data("sam:flag", "0x80_second_in_pair"); }
    //     
    //     if(flags & 0x0040) { feature->metadataset()->add_tag_data("sam:pair", "first"); }
    //     if(flags & 0x0080) { feature->metadataset()->add_tag_data("sam:pair", "second"); }

    if(!(f1_sam_flags & 0x0001)) {
      fprintf(stderr, "feature1 NOT PAIRED : %s %s \n", feature1->primary_name().c_str(), feature1->chrom_location().c_str());
      return NULL;
    }
    if(!(f1_sam_flags & 0x0002)) {
      fprintf(stderr, "f1 not 0x02_proper_pair\n");
      return NULL;
    }
    if(f1_sam_flags & 0x0008) {
      fprintf(stderr, "f1 0x08_mate_unmapped\n");
      return NULL;
    }

    if(feature1->mate_start()>0) {
      if(_region_end>0 && feature1->mate_start() > _region_end) {
        //fprintf(stderr, "f1 mate_start after end %ld > %ld : skip\n", mate_start, _region_end);
        return NULL;
      }
      if(_region_start>0 && feature1->mate_start() < _region_start) {
        //fprintf(stderr, "f1 mate_start before start %ld < %ld : skip\n", mate_start, _region_start);
        return NULL;
      }
    }

    // md = feature1->metadataset()->find_metadata("sam:mate_chrom", "");
    // if(md) {
    //   if((md->data() != "=") && (md->data() != feature1->chrom_name())) {
    //     //fprintf(stderr, "f1 mate_chrom [%s] different, only can pair intra-chrom\n", md->data().c_str());
    //     return NULL;
    //   }
    // }
    // md = feature1->metadataset()->find_metadata("sam:mate_start", "");
    // if(md) {
    //   long mate_start = strtol(md->data().c_str(), NULL, 10);
    //   if(_region_end>0 && mate_start > _region_end) {
    //     //fprintf(stderr, "f1 mate_start after end %ld > %ld : skip\n", mate_start, _region_end);
    //     return NULL;
    //   }
    //   if(_region_start>0 && mate_start < _region_start) {
    //     //fprintf(stderr, "f1 mate_start before start %ld < %ld : skip\n", mate_start, _region_start);
    //     return NULL;
    //   }
    // }
  }
    
  map<string, EEDB::Feature*>::iterator it2 = _feature_buffer.find(feature1->primary_name());
  if(it2 == _feature_buffer.end()) {
    feature1->retain();
    _feature_buffer[feature1->primary_name()] = feature1;
    return NULL;
  }
  EEDB::Feature *feature2 = (*it2).second;
  //fprintf(stderr, "feat2: %s\n", feature2->bed_description("bed12").c_str());
  
  if(!feature2) { return NULL; }
  if(!feature2->feature_source()) { return NULL; }
  
  if(feature1->primary_name() != feature2->primary_name()) { 
    fprintf(stderr, "something wrong: did map lookup but now names don't match\n");
    return NULL;
  }
  //fprintf(stderr, "pair names match %s\n", feature1->primary_name().c_str());

  //might need to make this more flexible
  if(feature1->feature_source()->db_id() != feature2->feature_source()->db_id()) { 
    fprintf(stderr, "pair names match but fsrcid NOT %s != %s\n", 
      feature1->feature_source()->db_id().c_str(), feature2->feature_source()->db_id().c_str());
    return NULL; 
  }
 
  bool flip_pair = false;
  long f2_sam_flags = 0;
  if(_sam_md_checks) {
    EEDB::Metadata *md = feature2->metadataset()->find_metadata("sam:flags", "");
    if(md) { f2_sam_flags = strtol(md->data().c_str(), NULL, 10); }
    if((f1_sam_flags & 0x0040) && (f2_sam_flags & 0x0040)) {
      //fprintf(stderr, "ERROR f1 & f2 both first-in-pair\n");
      return NULL;
    }
    if((f1_sam_flags & 0x0080) && (f2_sam_flags & 0x0080)) {
      //fprintf(stderr, "ERROR f1 & f2 both second-in-pair\n");
      return NULL;
    }
    
    if(f1_sam_flags & 0x0080) { flip_pair=true; } //f1 is second
    if(f2_sam_flags & 0x0040) { flip_pair=true; } //f2 is first
    
    //TODO: more sam_flags checks
    if(!(f2_sam_flags & 0x0002)) {
      fprintf(stderr, "ERROR f2 not 0x02_proper_pair\n");
      return NULL;
    }
    //if(flags & 0x0002) { feature->metadataset()->add_tag_data("sam:flag", "0x02_proper_pair"); }
    //if(flags & 0x0008) { feature->metadataset()->add_tag_data("sam:flag", "0x08_mate_unmapped"); }
  }

  //fprintf(stderr, "  ==found pair\n");

  // if(!_ignore_strand and (feat1->strand()!=' ') and (feat2->strand()!=' ') and (feat1->strand() != feat2->strand())) {
  //   //fprintf(stderr, "  --no match strand, so skip next\n");
  //   it2++;
  //   continue;
  // }
 

  EEDB::Edge *edge = EEDB::Edge::realloc();
  edge->primary_id(-1);
  edge->direction('+');
  edge->metadataset(); 
  
  //EEDB::EdgeSource *edgesource = _dynamic_edgesource_hash[feature1->feature_source()->db_id()];
  EEDB::EdgeSource *edgesource = _dynamic_edgesource_for(feature1->feature_source());  
  if(edgesource) { edge->edge_source(edgesource); }
  else {
    fprintf(stderr, "no edgesource for %s\n", feature1->feature_source()->db_id().c_str());
    exit(1);
  }

  if(flip_pair) {
    //fprintf(stderr, "edge flip pair f1/f2\n");
    edge->feature1(feature2);
    edge->feature2(feature1);
  } else {
    //fprintf(stderr, "edge norm pair f1/f2\n");
    edge->feature1(feature1);
    edge->feature2(feature2);
  }
  
  edge->calc_direction();

  //transfer expression from feature1 as edge_weight else add a simple tagcount
  vector<EEDB::Expression*>  expression = edge->feature1()->expression_array();
  if(!expression.empty()) {
    for(unsigned int j=0; j<expression.size(); j++) {
      EEDB::Expression *express = expression[j];
      edge->add_edgeweight(express->experiment(), express->datatype()->type(), express->value());
    }
  } else {
    edge->add_edgeweight(edgesource, "tagcount", 1);
  }

  //metadata - still not sure if I need any, maybe best to just keep on the features
  //edge->metadataset()->add_tag_data(colobj->colname, colobj->data);
  //edge->metadataset()->merge_metadataset(feature1->metadataset());
  //edge->metadataset()->merge_metadataset(feature2->metadataset());
  //edge->metadataset()->remove_duplicates();

  //fprintf(stderr, "%s", edge->xml().c_str());
  //fprintf(stderr, "pair %s : %s <=> %s\n", feature1->primary_name().c_str(), feature1->chrom_location().c_str(), feature2->chrom_location().c_str());

  _feature_buffer.erase(feature2->primary_name());
  feature2->release();

  return edge;
}


bool _spstream_pairreads_feature_name_sort_func (EEDB::Feature *a, EEDB::Feature *b) {
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->primary_name() < b->primary_name()) { return true; }
  return false;
}

bool _spstream_pairreads_feature_pos_sort_func (EEDB::Feature *a, EEDB::Feature *b) {
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->chrom_start() < b->chrom_start()) { return true; }
  if((a->chrom_start() == b->chrom_start()) &&
     (a->chrom_end() < b->chrom_end())) { return true; }
  return false;
}

