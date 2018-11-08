/* $Id: MannWhitneyRanksum.cpp,v 1.6 2016/02/24 06:27:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::MannWhitneyRanksum

SYNOPSIS

DESCRIPTION

 A simple signal procesor which is configured with a minimum expression value
 and which will only pass expressions which are greater than that value

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [eeDB] system
 * copyright (c) 2007-2015 Jessica Severin RIKEN OSC
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
#include <string.h>
#include <string>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/MannWhitneyRanksum.h>

using namespace std;
using namespace MQDB;


const char*  EEDB::SPStreams::MannWhitneyRanksum::class_name = "EEDB::SPStreams::MannWhitneyRanksum";

//function prototypes
void _spstream_mannwhitney_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MannWhitneyRanksum*)obj;
}
void _spstream_mannwhitney_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::SPStreams::MannWhitneyRanksum*)obj)->_xml(xml_buffer);
}
string _spstream_mannwhitney_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::MannWhitneyRanksum*)obj)->_display_desc();
}
MQDB::DBObject* _spstream_mannwhitney_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MannWhitneyRanksum*)node)->_next_in_stream();
}
bool _spstream_mannwhitney_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::MannWhitneyRanksum*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
/*
void _spstream_mannwhitney_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MannWhitneyRanksum*)node)->_reset_stream_node();
}
void _spstream_mannwhitney_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MannWhitneyRanksum*)node)->_stream_clear();
}
void _spstream_mannwhitney_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::MannWhitneyRanksum*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_mannwhitney_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MannWhitneyRanksum*)node)->_reload_stream_data_sources();
}
*/

EEDB::SPStreams::MannWhitneyRanksum::MannWhitneyRanksum() {
  init();
}

EEDB::SPStreams::MannWhitneyRanksum::~MannWhitneyRanksum() {
}

void EEDB::SPStreams::MannWhitneyRanksum::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::MannWhitneyRanksum::class_name;
  _module_name               = "MannWhitneyRanksum";
  _funcptr_delete            = _spstream_mannwhitney_delete_func;
  _funcptr_xml               = _spstream_mannwhitney_xml_func;
  _funcptr_simple_xml        = _spstream_mannwhitney_xml_func;
  _funcptr_display_desc      = _spstream_mannwhitney_display_desc_func;

  //function pointer code
  //_funcptr_reset_stream_node           = _spstream_mannwhitney_reset_stream_node_func;
  //_funcptr_stream_clear                = _spstream_mannwhitney_stream_clear_func;
  //_funcptr_stream_data_sources         = _spstream_mannwhitney_stream_data_sources_func;
  //_funcptr_reload_stream_data_sources  = _spstream_mannwhitney_reload_stream_data_sources_func;
  _funcptr_next_in_stream              = _spstream_mannwhitney_next_in_stream_func;
  _funcptr_stream_by_named_region      = _spstream_mannwhitney_stream_by_named_region_func;

  //attribute variables
  _experiment_cache.clear();
  _experiment_filter.clear();
  _filter_mdkeys.clear();
  _min_zscore = 1.6449; //equiv of pvalue 0.05
}

void EEDB::SPStreams::MannWhitneyRanksum::set_mdata_key_filter(string filter) {
  //space separated list of keys
  _filter_mdkeys.clear();
  if(!filter.empty()) {
    char *str = strdup(filter.c_str());
    char* tok = strtok(str," \t\n");
    while(tok) {
      _filter_mdkeys[tok] = true;
      fprintf(stderr, "MannWhitneyRanksum::set_mdata_key_filter [%s]\n", tok);
      tok = strtok(NULL," \t\n");
    }
    free(str);
  }
}

void EEDB::SPStreams::MannWhitneyRanksum::add_mdata_key_filter(string key) {
  fprintf(stderr, "MannWhitneyRanksum::set_mdata_key_filter [%s]\n", key.c_str());
  _filter_mdkeys[key] = true;
}

void EEDB::SPStreams::MannWhitneyRanksum::set_experiment_filter(string filter) {
  _experiment_filter = filter;
  _experiment_cache.clear(); //clear the experiment filter cache so it can recalculate
  //clear _mdgroup_hash
  map<string, EEDB::MWGroup*>::iterator mdg_it;
  for(mdg_it = _mdgroup_hash.begin(); mdg_it != _mdgroup_hash.end(); mdg_it++) {
    EEDB::MWGroup *mdgroup = (*mdg_it).second;
    mdgroup->release();
  }
  _mdgroup_hash.clear();
}

void EEDB::SPStreams::MannWhitneyRanksum::set_min_zscore(double value) {
  _min_zscore = fabs(value);
}



////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::MannWhitneyRanksum::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  char strbuf[256];

  snprintf(strbuf, 256, "<min_zscore>%1.6f</min_zscore>", _min_zscore);
  xml_buffer += strbuf;
  
  if(!_experiment_filter.empty()) {
    xml_buffer += "<experiment_filter>" + _experiment_filter + "</experiment_filter>";
  }

  if(!_filter_mdkeys.empty()) {
    xml_buffer += "<mdata_keys_filter>";
    map<string,bool>::iterator it1;
    for(it1=_filter_mdkeys.begin(); it1!=_filter_mdkeys.end(); it1++) {
      xml_buffer += (*it1).first+" ";
    }
    xml_buffer += "</mdata_keys_filter>";
  }
  
  _xml_end(xml_buffer);  //from superclass
}


string EEDB::SPStreams::MannWhitneyRanksum::mdgroup_xml() {
  string xml_buffer;
  char   strbuf[1024];
  
  snprintf(strbuf, 1024, "<metadata_groups count=\"%ld\">\n", _mdgroup_hash.size());
  xml_buffer = strbuf;

  map<string, EEDB::MWGroup*>::iterator mdg_it;
  for(mdg_it = _mdgroup_hash.begin(); mdg_it != _mdgroup_hash.end(); mdg_it++) {
    EEDB::MWGroup *mdgroup = (*mdg_it).second;
    mdgroup->xml(xml_buffer);
  }
  xml_buffer += "/<metadata_groups>\n";
  return xml_buffer;
}


bool _mannwhit_mwgroup_sort_func (EEDB::MWGroup *a, EEDB::MWGroup *b) {
  if(a == NULL) { return false; }  //a is NULL, so pick b
  if(b == NULL) { return true; }   //b is NULL, so pick a
  
  if(a->avg_zscore() < b->avg_zscore()) { return false; }
  if(a->avg_zscore() > b->avg_zscore()) { return true; }
  
  if(a->abundance_count < b->abundance_count) { return false; }
  if(a->abundance_count > b->abundance_count) { return true; }
  
  return false;
}


vector<EEDB::MWGroup*>  EEDB::SPStreams::MannWhitneyRanksum::mdgroups() {
  vector<EEDB::MWGroup*> mwgroup_array;

  
  map<string, EEDB::MWGroup*>::iterator mdg_it;
  for(mdg_it = _mdgroup_hash.begin(); mdg_it != _mdgroup_hash.end(); mdg_it++) {
    mwgroup_array.push_back((*mdg_it).second);
  }
  std::sort(mwgroup_array.begin(), mwgroup_array.end(), _mannwhit_mwgroup_sort_func);
  
  return mwgroup_array;
}


EEDB::SPStreams::MannWhitneyRanksum::MannWhitneyRanksum(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }

  if((node = root_node->first_node("min_zscore")) != NULL) {
    _min_zscore = strtod(node->value(), NULL);
  }
  if((node = root_node->first_node("experiment_filter")) != NULL) {
    _experiment_filter = node->value();
  }
  if((node = root_node->first_node("mdata_keys_filter")) != NULL) {
    set_mdata_key_filter(node->value());
  }
}

string EEDB::SPStreams::MannWhitneyRanksum::_display_desc() {
  return "MannWhitneyRanksum";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

/*
void EEDB::SPStreams::MannWhitneyRanksum::_stream_clear() {
  //re-initialize the stream-stack back to a clear/empty state
  if(source_stream() != NULL) { source_stream()->stream_clear(); }
  
  EEDB::SPStream::_reset_stream_node();
  fprintf(stderr, "MannWhitneyRanksum::_stream_clear\n");
  
  _region_start = -1;
  _region_end   = -1;
}


void EEDB::SPStreams::MannWhitneyRanksum::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();
  fprintf(stderr, "MannWhitneyRanksum::_reset_stream_node\n");

  _region_start = -1;
  _region_end   = -1;
}

void EEDB::SPStreams::MannWhitneyRanksum::_stream_data_sources(string classname, string filter_logic) {
  fprintf(stderr, "MannWhitneyRanksum::_stream_data_sources\n");
}

void EEDB::SPStreams::MannWhitneyRanksum::_reload_stream_data_sources() {
  fprintf(stderr, "MannWhitneyRanksum::_reload_stream_data_sources\n");
}
*/


bool EEDB::SPStreams::MannWhitneyRanksum::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  
  fprintf(stderr,"MannWhitneyRanksum::_stream_by_named_region[%ld] %s %s %ld .. %ld\n", (long)this, assembly_name.c_str(), chrom_name.c_str(), start, end);
  
  loadprep_experiment_metadata();

  return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
}


MQDB::DBObject* EEDB::SPStreams::MannWhitneyRanksum::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  if(obj->classname() == EEDB::Feature::class_name) {
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    analyze_feature(feature);
  }
  
  //everything else is just passed through
  return obj;
}


////////////////////////////////////////////////////////////////////////////
//
// MannWhitney ranksum analysis methods
//
////////////////////////////////////////////////////////////////////////////


bool _mw_expression_rank_sort_func (EEDB::Expression *a, EEDB::Expression *b) {
  // < function
  if(a == NULL) { return false; }  //a is NULL, so pick b
  if(b == NULL) { return true; }   //b is NULL, so pick a
  
  if(a->value() < b->value()) { return true; }
  if(a->value() > b->value()) { return false; }
  
  return false;
}


bool EEDB::SPStreams::MannWhitneyRanksum::loadprep_experiment_metadata() {
  if(!_experiment_cache.empty()) { return true; }

  struct timeval       starttime, endtime, time_diff;
  gettimeofday(&starttime, NULL);
  
  //make sure variables are clear
  _experiment_cache.clear();   // [srcID] = experiment :: to keep cache of all experiments
  _keyval_mdata.clear();       // [key::value] = mdata
  _keyval_enrichment.clear();  // [key::value] = double :: pvalue stat
  _keyval_experiment.clear();  // [key::value][expid] = bool :: mdata present in experiment

  EEDB::SPStream  *stream = source_stream();
    
  if(!_experiment_filter.empty()) {
    stream->stream_data_sources("Experiment", _experiment_filter);
  } else {
    stream->stream_data_sources("Experiment");
  }
    
  long sources_count=0;
  while(EEDB::Experiment *source = (EEDB::Experiment*)stream->next_in_stream()) {
    if(source->classname() != EEDB::Experiment::class_name) { continue; }
    
    source->metadataset()->remove_duplicates();
    sources_count++;
    vector<EEDB::Metadata*> mdlist = source->metadataset()->metadata_list();
    for(unsigned int i=0; i<mdlist.size(); i++) {
      EEDB::Metadata *md = mdlist[i];
      string key = md->type();
      if(key=="keyword") { continue; }
      if(!_filter_mdkeys.empty() && (_filter_mdkeys.find(key)==_filter_mdkeys.end())) { continue; }
      
      string value = md->data();
      //boost::algorithm::to_lower(value);
      string keyval = key+"::"+value;
      
      source->retain();
      _experiment_cache[source->db_id()] = source;
      _keyval_mdata[keyval] = md;
      _keyval_enrichment[keyval] = 0;
      _keyval_experiment[keyval][source->db_id()] = true;
      
      EEDB::DataSource::add_to_sources_cache(source);
    }
  }
  fprintf(stderr,"MannWhitneyRanksum::loadprep_experiment_metadata exps=%ld %ld  mdkeyvals=%ld\n",
          sources_count, _experiment_cache.size(), _keyval_mdata.size());
  
  //create unique experiment-groups based on source_id-list
  //loop on each metadata and generate a unique id-list to hash into a group
  map<string, EEDB::Metadata*>::iterator  md_it1;
  //fprintf(stderr, "ranksum %ld keyval_metadata\n", _keyval_mdata.size());
  for(md_it1 = _keyval_mdata.begin(); md_it1 != _keyval_mdata.end(); md_it1++) {
    EEDB::Metadata *mdata  = (*md_it1).second;
    string          keyval = (*md_it1).first;
    
    map<string, map<string, bool> >::iterator it7;
    it7 = _keyval_experiment.find(keyval);
    
    list<string> src_ids;
    map<string, EEDB::Experiment*>::iterator it4;
    for(it4=_experiment_cache.begin(); it4!=_experiment_cache.end(); it4++) {
      EEDB::Experiment *exp = (*it4).second;
      if((*it7).second[exp->db_id()]) {  //present
        src_ids.push_back(exp->db_id());
      }
    }
    if(src_ids.size() < 2) { continue; } //group need at least 2 experiments
    if(sources_count - src_ids.size() < 2) { continue; } //need at least 2 experiments in out-group
    
    //make unique src_id_key
    src_ids.sort();  //sort just to make sure it is unique reproducible
    string src_id_key;
    list<string>::iterator s_it;
    for(s_it=src_ids.begin(); s_it!=src_ids.end(); s_it++) {
      src_id_key += (*s_it);
    }
    //create mdgroup if missing or add new metadata if exists
    if(_mdgroup_hash.find(src_id_key) == _mdgroup_hash.end()) {
      //first time
      EEDB::MWGroup *mdgroup = new EEDB::MWGroup();
      mdgroup->src_id_key = src_id_key;
      mdgroup->add_metadata(mdata);
      for(s_it=src_ids.begin(); s_it!=src_ids.end(); s_it++) {
        mdgroup->add_experiment_id(*s_it);
      }
      mdgroup->retain();
      _mdgroup_hash[src_id_key] = mdgroup;
    } else {
      //append
      EEDB::MWGroup *mdgroup = (EEDB::MWGroup*)_mdgroup_hash[src_id_key];
      mdgroup->add_metadata(mdata);
    }
  }
  fprintf(stderr, "  %ld src_id_key groups\n", _mdgroup_hash.size());

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  fprintf(stderr, "loadprep_experiment_metadata %1.3f msec\n", runtime);
  return true;
}

      
bool EEDB::SPStreams::MannWhitneyRanksum::analyze_feature(EEDB::Feature *feature) {
  struct timeval       starttime, endtime, time_diff;

  _debug=false;

  if(!feature) { return false; }
  gettimeofday(&starttime, NULL);

  if(_debug) { fprintf(stderr, "\n\nMannWhitneyRanksum::analyze_feature :: %s", feature->simple_xml().c_str()); }
  
  //fill in all the missing experiments to convert the sparse-matrix to a full-matrix
  vector<EEDB::Expression*>  feat_exp_array = feature->expression_array();
  vector<EEDB::Expression*>  express_array; //final array for analysis

  if(_debug) { fprintf(stderr, "%ld filtered experiments in cache\n", _experiment_cache.size()); }
  if(_debug) { fprintf(stderr, "%ld feature expressions\n", feat_exp_array.size()); }
  
  //first place the expression which matches the known/filtered experiments into express_hash
  map<string, EEDB::Expression*>  express_hash;   //experiment srcID to expression, fill in the missing
  EEDB::Datatype *dtype = NULL;
  for(unsigned i=0; i<feat_exp_array.size(); i++) {
    EEDB::Expression *expr = feat_exp_array[i];
    if(_experiment_cache.find(expr->experiment_dbid()) != _experiment_cache.end()) {
      express_hash[expr->experiment_dbid()] = expr;
      dtype = expr->datatype();
    }
  }
  if(_debug) { fprintf(stderr, "  %ld expression match the experiment filter\n", express_hash.size()); }
  
  //second fill in the missing expression with zero values
  map<string, EEDB::Experiment*>::iterator it4;
  for(it4=_experiment_cache.begin(); it4!=_experiment_cache.end(); it4++) {
    EEDB::Experiment *experiment = (*it4).second;
    if(express_hash.find(experiment->db_id()) == express_hash.end()) {
      //missing Expression
      EEDB::Expression *expr2 = EEDB::Expression::realloc();
      expr2->experiment(experiment);
      expr2->datatype(dtype);
      expr2->value(0);
      expr2->sig_error(0);
      express_hash[experiment->db_id()] = expr2;
    }
  }
  if(_debug) { fprintf(stderr, "  %ld after fill in\n",express_hash.size()); }
  
  //third covert express_hash to express_array
  map<string, EEDB::Expression*>::iterator it5;
  for(it5=express_hash.begin(); it5!=express_hash.end(); it5++) {
    EEDB::Expression *express = (*it5).second;
    express_array.push_back(express);
  }
  
  //ranksum sort the expression array and asign the rank number
  std::sort(express_array.begin(), express_array.end(), _mw_expression_rank_sort_func);
  
  unsigned pos=0;
  while(pos<express_array.size()) {
    express_array[pos]->sig_error(pos+1);
    
    unsigned pos2 = pos;
    double sumrank=pos+1;
    while((pos2+1<express_array.size()) &&
          (express_array[pos]->value() == express_array[pos2+1]->value())) {
      sumrank += (pos2+1)+1;
      pos2++;
    }
    if(pos != pos2) {  //duplicates
      sumrank = sumrank / (pos2-pos+1);
      for(unsigned i=pos; i<=pos2; i++) {
        express_array[i]->sig_error(sumrank);
      }
      pos = pos2;
    }
    pos++;
  }
  //rank stored in the ->sig_error()
  
  
  //loop on each mdgroup, foreach mdgroup check all expression/experiments to match
  //calc rank-sum statistic for each metadata
  long mdcount=0;
  map<string, EEDB::MWGroup*>::iterator mdg_it;
  for(mdg_it = _mdgroup_hash.begin(); mdg_it != _mdgroup_hash.end(); mdg_it++) {
    EEDB::MWGroup *mdgroup = (*mdg_it).second;
    mdgroup->reset_stats();

    long group_count = 0;
    long other_count = 0;
    //calculate the ranksums
    double group_sum=0.0, other_sum=0.0, totalRank=0.0;
    double group_mean=0.0, other_mean=0.0;
    vector<EEDB::Expression*>::iterator it6;
    for(it6=express_array.begin(); it6!=express_array.end(); it6++) {
      EEDB::Expression *expr = (*it6);
      
      if(mdgroup->has_experiment_id(expr->experiment_dbid())) {
        group_sum += expr->sig_error();
        group_count++;
        //group_mean += log(expr->value());
        group_mean += expr->value();
      } else {
        other_sum += expr->sig_error();
        other_count++;
        //other_mean += log(expr->value());
        other_mean += expr->value();
      }
      totalRank += expr->sig_error();

    }
    mdgroup->other_count = other_count;
    mdgroup->group_count = group_count;
    mdgroup->other_sum   = other_sum;
    mdgroup->group_sum   = group_sum;

    if(group_count < 2) { continue; } //need at least 2 experiments
    if(other_count < 2) { continue; } //need at least 2 experiments in out-group
    
    group_mean /= group_count;
    other_mean /= other_count;
    
    //calc the wilcoxon-mann-whitney u-test
    //redo from https://epilab.ich.ucl.ac.uk/coursematerial/statistics/non_parametric/wilcox_mann_whitney.html
    
    double n1 = group_count;
    double n2 = other_count;
    
    double u1 = group_sum - ((n1 * (n1+1)) / 2.0);
    //double u2 = other_sum - ((n2 * (n2+1)) / 2.0);
    
    //double Uobt= 0.0;
    //if(u1<u2) { Uobt = u1; } else { Uobt = u2; }
    double Uobt= u1;  //if I want to preserve the directionality, just use U1
    
    double oa = sqrt(n1*n2*(n1+n2+1)/12);
    
    double zscore = (Uobt -  (n1 * n2 / 2)) / oa;
    
    /*
     if(group_count < other_count) {
     na = group_count;
     wa = group_sum;
     nb = other_count;
     } else {
     na = other_count;
     wa = other_sum;
     nb = group_count;
     }
     
     double ua = na * (na + nb + 1) / 2;
     double oa = sqrt(na*nb*(na+nb+1)/12);
     
     double zscore = (wa-ua) / oa;
     */
    
    //TODO: need to do table lookup for when either n1 or n2 is less than 20
    
    //TODO: need to do zscore to pvalue calc/lookup
    double pvalue = zscore;

    mdgroup->zscore = zscore;
    mdgroup->pvalue = pvalue;

    //fprintf(stderr, "ok6\n");
    //fprintf(stderr, "%s", mdgroup->simple_xml().c_str());

    if(fabs(zscore)>_min_zscore) {
      if(_debug) {
        fprintf(stderr, "%s", mdgroup->simple_xml().c_str());
        fprintf(stderr, "SIGNIFICANT!!!!!\n");
      }
      mdcount++;
      
      mdgroup->other_count = other_count;
      mdgroup->group_count = group_count;
      mdgroup->other_sum = other_sum;
      mdgroup->group_sum = group_sum;
      mdgroup->zscore = zscore;
      mdgroup->pvalue = pvalue;
      mdgroup->abundance_count++;
      mdgroup->abundance_zscores.push_back(zscore);

      mdgroup->retain();
      feature->metadataset()->add_metadata(mdgroup);
    }
    /*
     EEDB::MetadataSet *mdset = experiment->metadataset();
     if(mdset->find_metadata(mdata->type(), mdata->data())) {
     _keyval_enrichment[keyval]++;
     }
     */
  }
  if(_debug) { 
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &time_diff);
    double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
    fprintf(stderr, "found %ld significant mann whitney groups - %1.3f msec\n", mdcount, runtime);
  }

  return true;
}


////////////////////////////////////////////////////////////////////////////
//
// MWGroup section
//
////////////////////////////////////////////////////////////////////////////

const char*  EEDB::MWGroup::class_name = "EEDB::MWGroup";

//function prototypes
void _spstream_mwgroup_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::MWGroup*)obj;
}
void _spstream_mwgroup_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::MWGroup*)obj)->_xml(xml_buffer);
}
void _spstream_mwgroup_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::MWGroup*)obj)->_simple_xml(xml_buffer);
}

EEDB::MWGroup::MWGroup() {
  init();
}

EEDB::MWGroup::~MWGroup() {
  fprintf(stderr, "mwgroup delete\n");
}

void EEDB::MWGroup::init() {
  EEDB::Metadata::init();
  _classname                 = EEDB::MWGroup::class_name;
  _funcptr_delete            = _spstream_mwgroup_delete_func;
  _funcptr_xml               = _spstream_mwgroup_xml_func;
  _funcptr_simple_xml        = _spstream_mwgroup_simple_xml_func;
  
  //attribute variables
  _exp_id_hash.clear();
  src_id_key.clear();
  _mdata_list.clear();
  
  other_count = 0;
  group_count = 0;
  other_sum = 0.0;
  group_sum = 0.0;
  zscore = 0.0;
  pvalue = 0.0;
  abundance_count = 0;
}

void EEDB::MWGroup::reset_stats() {
  other_count = 0;
  group_count = 0;
  other_sum = 0.0;
  group_sum = 0.0;
  zscore = 0.0;
  pvalue = 0.0;
}

bool EEDB::MWGroup::has_experiment_id(string value) {
  if(_exp_id_hash.find(value) == _exp_id_hash.end()) { return false; }
  return _exp_id_hash[value];
}

void EEDB::MWGroup::add_experiment_id(string value) {
  _exp_id_hash[value] = true;
}

void  EEDB::MWGroup::add_metadata(EEDB::Metadata *mdata) {
  if(!mdata) { return; }
  if(_mdata_list.empty()) {
    //set type/data to the first element in the group
    _type = mdata->type();
    _data = mdata->data();
  }
  _mdata_list.push_back(mdata);
}


void EEDB::MWGroup::_simple_xml(string &xml_buffer) {
  if(_mdata_list.empty()) { return; }
  
  char strbuf[8192];
  EEDB::Metadata *mdata  = _mdata_list.front();
  
  long src_count=0;
  map<string,bool>::iterator it2;
  for(it2=_exp_id_hash.begin(); it2!=_exp_id_hash.end(); it2++) {
    if((*it2).second) { src_count++; }
  }
  
  snprintf(strbuf, 8192,
           "<mdgroup type=\"%s\" value=\"%s\" source_count=\"%ld\" other_count=\"%ld\" group_count=\"%ld\" other_ranksum=\"%f\" group_ranksum=\"%f\" zscore=\"%f\" pvalue=\"%f\" >",
           html_escape(mdata->type()).c_str(), html_escape(mdata->data()).c_str(),
           src_count, other_count, group_count, other_sum, group_sum, zscore, pvalue);
  xml_buffer += strbuf;
  xml_buffer += "</mdgroup>\n";
}

void EEDB::MWGroup::_xml(string &xml_buffer) {
  if(_mdata_list.empty()) { return; }
  
  char strbuf[8192];
  EEDB::Metadata *mdata  = _mdata_list.front();

  long src_count=0;
  map<string,bool>::iterator it2;
  for(it2=_exp_id_hash.begin(); it2!=_exp_id_hash.end(); it2++) {
    if((*it2).second) { src_count++; }
  }
  
  snprintf(strbuf, 8192,
          "<mdgroup type=\"%s\" value=\"%s\" source_count=\"%ld\" other_count=\"%ld\" group_count=\"%ld\" other_ranksum=\"%f\" group_ranksum=\"%f\" zscore=\"%f\" pvalue=\"%f\" >",
           html_escape(mdata->type()).c_str(), html_escape(mdata->data()).c_str(),
           src_count, other_count, group_count, other_sum, group_sum, zscore, pvalue);
  xml_buffer += strbuf;

  //_exp_id_hash to get unique source ids in this group
  for(it2=_exp_id_hash.begin(); it2!=_exp_id_hash.end(); it2++) {
    if((*it2).second) { xml_buffer += "<datasource id=\"" + (*it2).first + "\"/>"; }
  }
  
  //individual metadata which share exact same experiment group
  list<EEDB::Metadata*>::iterator s_it;
  for(s_it=_mdata_list.begin(); s_it!=_mdata_list.end(); s_it++) {
    (*s_it)->xml(xml_buffer);
  }
  xml_buffer += "</mdgroup>\n";
}

EEDB::MWGroup::MWGroup(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  //rapidxml::xml_node<>      *node;
  
  //TODO: need to do this to store/retrieve finished results from ZDX
  
  if(string(root_node->name()) != "spstream") { return; }
}


EEDB::MWGroup* EEDB::MWGroup::copy() {
  EEDB::MWGroup *t_copy = new EEDB::MWGroup();
  t_copy->src_id_key = src_id_key;
  t_copy->other_count = other_count;
  t_copy->group_count = group_count;
  t_copy->other_sum = other_sum;
  t_copy->group_sum = group_sum;
  t_copy->zscore = zscore;
  t_copy->pvalue = pvalue;
  t_copy->abundance_count = abundance_count;
  
  t_copy->abundance_zscores = abundance_zscores;
  t_copy->_mdata_list = _mdata_list;
  t_copy->_exp_id_hash = _exp_id_hash;
  return t_copy;
}

double  EEDB::MWGroup::avg_zscore() {
  double sum=0;
  for(unsigned i=0; i<abundance_zscores.size(); i++) {
    sum += fabs(abundance_zscores[i]);
  }
  return sum/abundance_zscores.size();
}

double  EEDB::MWGroup::max_zscore() {
  double max=0;
  for(unsigned i=0; i<abundance_zscores.size(); i++) {
    if(fabs(abundance_zscores[i]) > fabs(max)) { max = abundance_zscores[i]; }
  }
  return max;
}




