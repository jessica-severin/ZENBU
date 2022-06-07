/* $Id: InteractionMatrix.cpp,v 1.4 2021/07/15 02:25:39 severin Exp $ */

/****
NAME - EEDB::InteractionMatrix

SYNOPSIS

DESCRIPTION

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
#include <sqlite3.h>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/InteractionMatrix.h>

using namespace std;
using namespace MQDB;

bool mdset_sort_func (EEDB::Metadata *a, EEDB::Metadata *b);

const char*  EEDB::InteractionMatrix::class_name = "InteractionMatrix";

void _eedb_interactionmatrix_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::InteractionMatrix*)obj;
}
void _eedb_interactionmatrix_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::InteractionMatrix*)obj)->_xml(xml_buffer);
}
void _eedb_interactionmatrix_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::InteractionMatrix*)obj)->_xml(xml_buffer);
}


EEDB::InteractionMatrix::InteractionMatrix() {
  init();
}

EEDB::InteractionMatrix::~InteractionMatrix() {
  clear_all();
}

void EEDB::InteractionMatrix::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::InteractionMatrix::class_name;
  _funcptr_delete            = _eedb_interactionmatrix_delete_func;
  _funcptr_xml               = _eedb_interactionmatrix_xml_func;
  _funcptr_simple_xml        = _eedb_interactionmatrix_simple_xml_func;
  
  _feature_idx = 0;       //master index of known features
  _features.clear();      //fast lookup from idx to feature
  _feature_hash.clear();  //dbid or chrom_loc as hash-ID    
  _matrix.clear();        //3d matrix feature-2-feature -> vector of signals
  _stream_edge_it = _matrix.end();  
  _last_debug = 0.0;
  _input_edge_count = 0;
  _ignore_direction = false;

  gettimeofday(&_starttime, NULL);
}


void EEDB::InteractionMatrix::init_from_xml(void *xml_node) {
  // init using a rapidxml parent node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  // if((node = root_node->first_node("expression_mode")) != NULL) {
  //   string mode = node->value();
  //   _expression_mode = CL_SUM;
  //   if(mode == "sum")   { _expression_mode = CL_SUM; }
  //   if(mode == "min")   { _expression_mode = CL_MIN; }
  //   if(mode == "max")   { _expression_mode = CL_MAX; }
  //   if(mode == "count") { _expression_mode = CL_COUNT; }
  //   if(mode == "mean")  { _expression_mode = CL_MEAN; }
  //   if(mode == "none")  { _expression_mode = CL_NONE; }
  // }
  
  _ignore_direction = false;
  if((node = root_node->first_node("ignore_direction")) != NULL) {
    if(string(node->value()) == "true") { _ignore_direction=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _ignore_direction=true;
    }
  }
}


void EEDB::InteractionMatrix::_xml(string &xml_buffer) {  
  if(_ignore_direction) { xml_buffer.append("<ignore_direction>true</ignore_direction>"); }
  else { xml_buffer.append("<ignore_direction>false</ignore_direction>"); }
  
  // switch(_expression_mode) {
  //   case CL_SUM:   xml_buffer.append("<expression_mode>sum</expression_mode>"); break;
  //   case CL_MIN:   xml_buffer.append("<expression_mode>min</expression_mode>");break;
  //   case CL_MAX:   xml_buffer.append("<expression_mode>max</expression_mode>");break;
  //   case CL_COUNT: xml_buffer.append("<expression_mode>count</expression_mode>");break;
  //   case CL_MEAN:  xml_buffer.append("<expression_mode>mean</expression_mode>");break;
  //   case CL_NONE:  xml_buffer.append("<expression_mode>none</expression_mode>");break;
  // }
  
  // for(unsigned int i=0; i<_matrix.size(); i++) {
  //   Metadata *mdata = _matrix[i];
  //   //if(mdata->type() == "keyword") { continue; } //always hide the 'keywords' from the xml output
  //   xml_buffer.append("  ");
  //   mdata->xml(xml_buffer);
  // }
}


string EEDB::InteractionMatrix::display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "InteractionMatrix() %d cells", matrix_size());
  return buffer;
}


string EEDB::InteractionMatrix::display_contents() {
  string  str = display_desc() + "\n";
  // sort(_matrix.begin(), _matrix.end(), mdset_sort_func);
  // for(unsigned int i=0; i<_matrix.size(); i++) {
  //   Metadata *mdata = _matrix[i];
  //   if(mdata->classname() == EEDB::Symbol::class_name) { 
  //     str += "  " + ((Symbol*)mdata)->display_desc() + "\n";
  //   } else {
  //     str += "  " + mdata->display_desc() + "\n";
  //   }
  // }
  return str;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
// Instance methods
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::InteractionMatrix::ignore_direction(bool value) {
  _ignore_direction = value;
}


long  EEDB::InteractionMatrix::add_feature(EEDB::Feature *feature) {
  if(!feature) { return -1; }
  string featID = feature->db_id();
  if(featID.empty()) { featID = feature->chrom_location(); }
  if(featID.empty()) {
    //printf("ERROR feature has no dbID or chromLoc can't hash\n");
    return -1;
  }
  
  map<string, feature_idx_t >::iterator it1 = _feature_hash.find(featID);
   
  if(it1 != _feature_hash.end()) {
    //already hashed so return
    //printf("feature %s already hashed\n", featID.c_str());
    return (it1->second).idx;
  }
  
  //printf("new feature %ld : %s\n", _feature_idx, featID.c_str());
  feature->retain();
  _features.push_back(feature);

  feature_idx_t  fidx;
  fidx.feature = feature;
  fidx.idx = _feature_idx++;  
  _feature_hash[featID] = fidx;
    
  return fidx.idx;
}


bool  EEDB::InteractionMatrix::add_dumbbell(EEDB::Feature *feature) {
  //TODO might copy the dumb bell code here
  return true;
}


bool  EEDB::InteractionMatrix::add_edge(EEDB::Edge *edge) {
  if(!edge) { return false; }
  
  long idx1 = add_feature(edge->feature1());
  if(idx1<0) { return false; }
  long idx2 = add_feature(edge->feature2());
  if(idx2<0) { return false; }
  
  _input_edge_count++;

  //direction check code,  edge direction can be ' ' or = + - C D (C=convergent, D=divergent)
  char dir = edge->direction();
  if(_ignore_direction || dir==' ' || dir=='=') {  //always place smaller idx first
    if(idx2<idx1) {
      long tidx = idx1;
      idx1 = idx2;
      idx2 = tidx;
    }
  } else {
    if(dir == '-') {
      long tidx = idx1;
      idx1 = idx2;
      idx2 = tidx;
    }
  }
  
  //EEDB::Feature *feature1 = _features[idx1];
  //EEDB::Feature *feature2 = _features[idx2];

  //add connection into matrix
  long long hash_id = (idx1<<32) + (idx2 & 0xFFFFFFFF); //long is 64bit so put idx1 in upper 32bits and idx2 in lower 32bits
  //long t1 = (hash_id & 0xFFFFFFFF00000000)>>32;
  //long t2 = hash_id & 0xFFFFFFFF;
  //if(idx1!=t1 || idx2!=t2) { printf("hash=%lld  idx1=%ld  t1=%ld\t\tidx2=%ld  t2=%ld\n", hash_id, idx1,t1,idx2,t2); }
  
  //Edge hash version
  //if(_matrix.find(hash_id) == _matrix.end()) {
  //  _matrix[hash_id] = edge;
  //  edge->retain();
  //  return true;
  //}

  vector<EEDB::EdgeWeight*>  weights = edge->edgeweight_array();
  for(unsigned i=0; i<weights.size(); i++) {
    interaction_signal_t    sig;
    sig.datasource   = weights[i]->datasource();
    sig.datatype     = weights[i]->datatype();
    sig.value        = weights[i]->weight();
    //sig.fidx1        = idx1;
    //sig.fidx2        = idx2;
    //sig.direction    = edge->direction();
    _matrix[hash_id].push_back(sig);
    //_matrix[hash_id]->add_edgeweight(weights[i]);
  }  

  /*
  struct timeval  endtime,difftime;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &difftime);
  double runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
  if(runtime > _last_debug + 1) {
    long count = _matrix.size();
    fprintf(stderr, "%1.3f obj/sec (input %ld) [%ld matrix]\n", _input_edge_count / runtime, _input_edge_count, count);
    _last_debug = runtime;
  }
  */

  return true;
}
    
    
/*    
void EEDB::InteractionMatrix::remove_metadata(EEDB::Metadata* data) {
  if(data==NULL) { return; }
  vector<EEDB::Metadata*>::iterator it, it2;
  it = it2 = _metadata.begin();
  while(it != _metadata.end()) {
    if((*it) == data) { 
      _metadata.erase(it);
      it = it2;
    } else { 
      it2 = it;
      it++; 
    }
  }
}
*/


void EEDB::InteractionMatrix::clear_all() {
  clear_connections();
  _clear_features();
  gettimeofday(&_starttime, NULL);
}

  
void EEDB::InteractionMatrix::_clear_features() {
  for(unsigned int i=0; i<_features.size(); i++) {
    EEDB::Feature *feat = _features[i];
    feat->release();
  }  
  _feature_idx = 0;       //master count of known features
  _features.clear();      //fast lookup from idx to feature
  _feature_hash.clear();  //dbid or chrom_loc as hash-ID    
}


void EEDB::InteractionMatrix::clear_connections() {
  //TODO: might need some special looping
  // for(unsigned int i=0; i<_metadata.size(); i++) {
  //   EEDB::Metadata *md = _metadata[i];
  //   md->release();
  // }
  _matrix.clear();        //3d matrix feature-2-feature -> vector of signals
  _stream_edge_it = _matrix.end();
  _input_edge_count = 0;
}


////////////////////////////////////////////////////////////////////////////////////////////////
//
// list access methods
//
////////////////////////////////////////////////////////////////////////////////////////////////

// access methods

    
int EEDB::InteractionMatrix::feature_count() {
  return _features.size();
}

int EEDB::InteractionMatrix::matrix_size() {
  long count = _matrix.size();
//  long count = 0;
//   for(unsigned int i=0; i<_matrix.size(); i++) {
//     for(unsigned int k=0; k<_matrix[i].size(); k++) {
//       count++;
//     }
//   }
  return count;
}

vector<EEDB::Feature*> EEDB::InteractionMatrix::extract_features() {
  return _features;
}

vector<EEDB::Edge*> EEDB::InteractionMatrix::extract_edges() {
  vector<EEDB::Edge*>  edges;
  
  //Edge hash version
  // map<long long, EEDB::Edge*>::iterator it1;
  // for(it1=_matrix.begin(); it1!=_matrix.end(); it1++) {
  //   EEDB::Edge* edge = (*it1).second;
  //   edges.push_back(edge);
  // }

  map<long long, vector < interaction_signal_t > >::iterator it1;
  vector<interaction_signal_t>::iterator                     it2;
  
    
  for(it1=_matrix.begin(); it1!=_matrix.end(); it1++) {
    long long hash_id = (*it1).first;
        
    long idx1 = (hash_id & 0xFFFFFFFF00000000)>>32;
    long idx2 = hash_id & 0xFFFFFFFF;
    //if(idx1!=t1 || idx2!=t2) { printf("hash=%lld  idx1=%ld  t1=%ld\t\tidx2=%ld  t2=%ld\n", hash_id, idx1,t1,idx2,t2); }
  
    EEDB::Feature *feature1 = _features[idx1];
    EEDB::Feature *feature2 = _features[idx2];
    if(!feature1 || !feature2) {
      fprintf(stderr, "ERROR could not look up features hash=%lld\tidx1=%ld\tidx2=%ld\n", hash_id, idx1, idx2);
      continue;
    }
    
    EEDB::Edge* edge = new EEDB::Edge();
    //edge->edge_source(sig->datasource);
    edge->feature1(feature1);
    edge->feature2(feature2);
    edges.push_back(edge);
    
    for(it2=it1->second.begin(); it2!=it1->second.end(); it2++) {
      interaction_signal_t   *sig = &(*it2);
  
      //sig.datasource   = weights[i]->datasource();
      //sig.datatype     = weights[i]->datatype();
      //sig.value        = weights[i]->weight();
      //sig.fidx1        = idx1;
      //sig.fidx2        = idx2;
      
      edge->add_edgeweight(sig->datasource, sig->datatype->type(), sig->value);
    }
  }  
  
  return edges;
}


void  EEDB::InteractionMatrix::stream_extract_edges() {
  _stream_edge_it = _matrix.begin();
}


EEDB::Edge*  EEDB::InteractionMatrix::next_edge() {
  if(_stream_edge_it == _matrix.end()) { return NULL; }
  
  vector<interaction_signal_t>::iterator  it2;

  long long hash_id = (*_stream_edge_it).first;
        
  long idx1 = (hash_id & 0xFFFFFFFF00000000)>>32;
  long idx2 = hash_id & 0xFFFFFFFF;
  //if(idx1!=t1 || idx2!=t2) { printf("hash=%lld  idx1=%ld  t1=%ld\t\tidx2=%ld  t2=%ld\n", hash_id, idx1,t1,idx2,t2); }

  EEDB::Feature *feature1 = _features[idx1];
  EEDB::Feature *feature2 = _features[idx2];
  if(!feature1 || !feature2) {
    fprintf(stderr, "ERROR could not look up features hash=%lld\tidx1=%ld\tidx2=%ld\n", hash_id, idx1, idx2);
    _stream_edge_it++;
    return NULL;
  }
  
  EEDB::Edge* edge = new EEDB::Edge();
  //EEDB::Edge* edge = _matrix[hash_id];
  //edge->edge_source(sig->datasource);
  edge->feature1(feature1);
  edge->feature2(feature2);
  
  for(it2=_stream_edge_it->second.begin(); it2!=_stream_edge_it->second.end(); it2++) {
    interaction_signal_t   *sig = &(*it2);

    //sig.datasource   = weights[i]->datasource();
    //sig.datatype     = weights[i]->datatype();
    //sig.value        = weights[i]->weight();
    //sig.fidx1        = idx1;
    //sig.fidx2        = idx2;
    
    edge->add_edgeweight(sig->datasource, sig->datatype->type(), sig->value);
  }

  _stream_edge_it++;
  return edge;
}
    
/*
int EEDB::InteractionMatrix::data_size() {
  int bytes =0;
  for(unsigned int i=0; i<_matrix.size(); i++) {
    EEDB::Metadata *md = _matrix[i];
    bytes += md->data_size();
  }
  return bytes;
}
*/

