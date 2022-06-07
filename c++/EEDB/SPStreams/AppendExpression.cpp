/* $Id: AppendExpression.cpp,v 1.4 2019/03/26 07:07:45 severin Exp $ */

/***

NAME - EEDB::SPStreams::AppendExpression

SYNOPSIS

DESCRIPTION

dynamic experiment/expression generation module to
fill in for feature-sources which do not have loaded experiments.
Initial version will just perform count, but I can see this also being
used to translate score/metadata into expression dynamically

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU system
 * copyright (c) 2007-2018 Jessica Severin RIKEN OSC
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
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/AppendExpression.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::AppendExpression::class_name = "EEDB::SPStreams::AppendExpression";

//function prototypes
void _spstream_appendexpression_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::AppendExpression*)obj;
}
void _spstream_appendexpression_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::AppendExpression*)obj)->_xml(xml_buffer);
}

MQDB::DBObject* _spstream_appendexpression_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::AppendExpression*)node)->_next_in_stream();
}
void _spstream_appendexpression_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::AppendExpression*)node)->_reset_stream_node();
}
void _spstream_appendexpression_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::AppendExpression*)node)->_stream_clear();
}

void _spstream_appendexpression_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::AppendExpression*)node)->_reload_stream_data_sources();
}
void _spstream_appendexpression_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::AppendExpression*)node)->_stream_data_sources(classname, filter_logic);
}
//void _spstream_appendexpression_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
//  if(node->source_stream() != NULL) { node->source_stream()->get_dependent_datasource_ids(source_ids); }
//}
//bool _spstream_appendexpression_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
//  return ((EEDB::SPStreams::AppendExpression*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);  
//}


/*
//void _spstream_appendexpression_stream_peers_func(EEDB::SPStream* node) {
//  if(node->source_stream() != NULL) { node->source_stream()->stream_peers(); }
//}
MQDB::DBObject* _spstream_appendexpression_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return NULL;
}
void _spstream_appendexpression_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
}
void _spstream_appendexpression_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
}
void _spstream_appendexpression_disconnect_func(EEDB::SPStream* node) {
}
void _spstream_appendexpression_get_proxies_by_name(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies) {
}
*/


EEDB::SPStreams::AppendExpression::AppendExpression() {
  init();
}

EEDB::SPStreams::AppendExpression::~AppendExpression() {
}

void EEDB::SPStreams::AppendExpression::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::AppendExpression::class_name;
  _module_name               = "AppendExpression";
  _funcptr_delete            = _spstream_appendexpression_delete_func;
  _funcptr_xml               = _spstream_appendexpression_xml_func;
  _funcptr_simple_xml        = _spstream_appendexpression_xml_func;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_appendexpression_next_in_stream_func;
  _funcptr_reset_stream_node                  = _spstream_appendexpression_reset_stream_node_func;
  _funcptr_stream_clear                       = _spstream_appendexpression_stream_clear_func;

  _funcptr_reload_stream_data_sources         = _spstream_appendexpression_reload_stream_data_sources_func;
  _funcptr_stream_data_sources                = _spstream_appendexpression_stream_data_sources_func;

  //_funcptr_stream_by_named_region             = _spstream_appendexpression_stream_by_named_region_func;
  //_funcptr_stream_peers                       = _spstream_appendexpression_stream_peers_func;
  //_funcptr_fetch_object_by_id                 = _spstream_appendexpression_fetch_object_by_id_func;
  //_funcptr_disconnect                         = _spstream_appendexpression_disconnect_func;
  //_funcptr_stream_features_by_metadata_search = _spstream_appendexpression_stream_features_by_metadata_search_func;
  //_funcptr_get_dependent_datasource_ids       = _spstream_appendexpression_get_dependent_datasource_ids_func;
  //_funcptr_stream_chromosomes                 = _spstream_appendexpression_stream_chromosomes_func;
  //_funcptr_get_proxies_by_name                = _spstream_appendexpression_get_proxies_by_name;
  
  //attribute variables
  _count_expression_datatype = EEDB::Datatype::get_type("count");
  _source_streambuffer=NULL;

}



////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::AppendExpression::_reset_stream_node() {
  //reset happens before each stream call so don't clear the _dynamic_experiment_hash since this 
  //needs to persist between the stream_datasources, _stream_by_named_region and others
  //since this is called before every main streaming call I can perform the source-load-logic here
  if(_sources_cache.empty()) { _reload_stream_data_sources(); }  //only executes the first time
  if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }  
}

void EEDB::SPStreams::AppendExpression::_stream_clear() {
  //re-initialize the stream-stack back to a clear/empty state
  //_dynamic_experiment_hash.clear(); //still not sure if I need to do this or not
  if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }  
}

/*
basic idea:
- create experiments by streaming all FeatureSource into this module and then create parallel 
   experiments for each needed one.  make available on the stream_datasources() method

*/

MQDB::DBObject* EEDB::SPStreams::AppendExpression::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }
  
  MQDB::DBObject *obj=NULL;
  
  //stream the dynamic experiments from _source_streambuffer if available
  if(_source_streambuffer) {
    obj = _source_streambuffer->next_in_stream();
    if(obj) { return obj; }
    else {
      _source_streambuffer->release(); 
      _source_streambuffer=NULL;
    }
  }
 
  //otherwise process main stream
  while((obj = _source_stream->next_in_stream()) != NULL) {

    //non-feature objects on the primary source stream
    //are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }
    
    //if feature's FeatureSource has a matching dynamic Experiment precalculated, then append the expression here
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    if(feature->feature_source()) {
      EEDB::Experiment *experiment = _dynamic_experiment_hash[feature->feature_source()->db_id()];
      if(experiment) {
        //count expression
        feature->add_expression(experiment, _count_expression_datatype, 1.0);
        
        //mdata expression
        if(!_mdata_expression_datatypes.empty()) {
          //specific mdata lookup for conversion to expression
          vector<Metadata*> mdlist = feature->metadataset()->metadata_list();
          for(unsigned int i=0; i<mdlist.size(); i++) {
            if(_mdata_expression_datatypes.find(mdlist[i]->type()) != _mdata_expression_datatypes.end()) {
              EEDB::Datatype *dtype = _mdata_expression_datatypes[mdlist[i]->type()];
              double value = strtod(mdlist[i]->data().c_str(), NULL);
              if(value!=0.0) {
                feature->add_expression(experiment, dtype, value);
              }
            }              
          }
        }
      }
    }    
    //vector<EEDB::Metadata*> matching_md = feature->metadataset()->find_all_metadata_like(md->type(), "");
    //for(unsigned j=0; j<matching_md.size(); j++) {
    //  double value = strtod(matching_md[j]->data().c_str(), NULL);
    //  if(value!=0.0) {
    //    feature->add_expression(experiment, EEDB::Datatype::get_type(matching_md[j]->type()), value);
    //  }
    //}
    return feature;
  }

  return NULL;
}


// dynamic source creation section

void EEDB::SPStreams::AppendExpression::_reload_stream_data_sources() {
  if(!source_stream()) { return; }
  
  // first pass this down the stream
  source_stream()->reload_stream_data_sources();

  map<string, EEDB::DataSource*>::iterator it;
  if(_sources_cache.empty()) { 
    //stream all sources into my cache and add dynamic Experiments as needed
    source_stream()->stream_data_sources();
    EEDB::DataSource *source;
    while((source = (EEDB::DataSource*)source_stream()->next_in_stream())) {
      _cache_datasource(source);
    }
    
    //check cache for missing/dependent experiments    
    for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
      EEDB::DataSource* source = (*it).second;
      if(source->classname() == EEDB::FeatureSource::class_name) {
        EEDB::Experiment *experiment = _dynamic_experiment_hash[source->db_id()];
        if(!experiment) {
          experiment = new EEDB::Experiment;
          source->metadataset(); //lazyload if needed
          source->_copy(experiment);

          //little magic, resetting the primary_id back to itself will cause the db_id() to be rebuilt but now as an Experiment. 
          //Since ZENBU always creates increasing primary_ids for all sources within a _funcptr_stream_peers
          //there will never be a default case where a FeatureSource and Experiment within the same peer will have the same
          //primary_id, thus this is guaranteeed to create a parallel but not conflicting Experiment
          experiment->primary_id(source->primary_id());
          experiment->database(NULL);

          //link the dynamic parallel experiment to the fsrcID
          _dynamic_experiment_hash[source->db_id()] = experiment;
        }
      }
    }
  }
}


void EEDB::SPStreams::AppendExpression::_stream_data_sources(string classname, string filter_logic) { 
  // first check if we need to reload
  _reload_stream_data_sources();
  
  map<string, EEDB::Experiment*>::iterator it;
  if(!_dynamic_experiment_hash.empty()) {
    if(_source_streambuffer) { _source_streambuffer->release(); _source_streambuffer=NULL; }
    _source_streambuffer = new EEDB::SPStreams::StreamBuffer();
    
    for(it = _dynamic_experiment_hash.begin(); it != _dynamic_experiment_hash.end(); it++) {
      EEDB::DataSource* source = (*it).second;
      if(source == NULL) { continue; }
      source->retain();
      _source_streambuffer->add_object(source);
    }
  }
  
  //then pass down the stream
  if(source_stream() != NULL) { source_stream()->stream_data_sources(classname, filter_logic); }
}

/*
void EEDB::SPStreams::SourceStream::_stream_data_sources(string classname, string filter_logic) {
  if(!_source_is_active) { return; }
  
  _reload_stream_data_sources();  //internal method not superclass and function redirect

  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    //if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }
    if(!classname.empty() and (source->classname() != classname)) { continue; }
    
    if(!filter_logic.empty()) {
      EEDB::MetadataSet  *mdset = source->metadataset();
      if((mdset != NULL) and (!(mdset->check_by_filter_logic(filter_logic)))) { continue; }
    }
    
    if(_stream_is_datasource_filtered) {
      if(!_filter_source_ids[source->db_id()]) { continue; }
    }

    source->retain();
    streambuffer->add_object(source);
  }
  if(_database) { _database->disconnect(); }
}
*/

void EEDB::SPStreams::AppendExpression::_cache_datasource(EEDB::DataSource* source) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  
  if(source == NULL) { return; }
  if(!source->is_active()) { return; }
  string fid = source->db_id();
  search_it = _sources_cache.find(fid);
  if(search_it == _sources_cache.end()) { 
    source->retain();
    _sources_cache[fid] = source;
  }
}


/*
    colobj->experiment = new EEDB::Experiment();
    colobj->experiment->name(colobj->expname);
    colobj->experiment->display_name(colobj->expname);



    if($oscfileparser->{'_one_line_one_expression_count'}) {
      my $colname = "exp.tagcount.";
      if($oscfileparser->{'_exp_prefix'}) { $colname .= $oscfileparser->{'_exp_prefix'}; }
      else { $colname .= "experiment"; } 
      my $colobj = $oscfileparser->_create_colobj_by_name($colname);
      $colobj->{'colnum'} = scalar(@columns);
      $oscfileparser->_prepare_experiment_colobj($colobj);
      if($oscfileparser->{'_description'}) { 
        $colobj->{'description'} = $oscfileparser->{'_description'};
      } else {
        $colobj->{'description'} = "single sequence tags, no redundancy compression, tagcount=1 for every tag";
      }
      printf HEADERFILE "##ColumnVariable[%s] = %s\n", $colname, $colobj->{'description'};
      push @columns, $colname;
      $self->{'_one_line_one_expression_count'} = $oscfileparser->{'_one_line_one_expression_count'};
    }
    if($oscfileparser->{'_default_mapcount'}) {
      my $colname = "exp.mapcount.";
      if($oscfileparser->{'_exp_prefix'}) { $colname .= $oscfileparser->{'_exp_prefix'}; }
      else { $colname .= "experiment"; } 
      my $colobj = $oscfileparser->_create_colobj_by_name($colname);
      $colobj->{'colnum'} = scalar(@columns);
      $oscfileparser->_prepare_experiment_colobj($colobj);
      $colobj->{'description'} = "multi-map count";
      printf HEADERFILE "##ColumnVariable[%s] = %s\n", $colname, $colobj->{'description'};
      push @columns, $colname;
      $self->{'_default_mapcount'} = $oscfileparser->{'_default_mapcount'};
    }
*/

/*****************************************************************************************/

void EEDB::SPStreams::AppendExpression::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from superclass

  //<datatype type="new_type"/>
  if(_count_expression_datatype) { _count_expression_datatype->xml(xml_buffer); }

  map<string, EEDB::Datatype*>::iterator it1;
  for(it1=_mdata_expression_datatypes.begin(); it1!=_mdata_expression_datatypes.end(); it1++) {
    xml_buffer += "<mdata type=\""+ ((*it1).first) +"\"></mdata>\n";
  }

  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::AppendExpression::AppendExpression(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  //rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  /*
  if((node = root_node->first_node("ignore_strand")) != NULL) { 
    if(string(node->value()) == "true") { _ignore_strand=true; }
    else if((attr = node->first_attribute("value")) and (string(attr->value())=="1")) {
      _ignore_strand=true;
    }
  }
  */

  // datatypes
  if((node = root_node->first_node("datatype")) != NULL) { 
    EEDB::Datatype *dtype = EEDB::Datatype::from_xml(node);
    if(dtype) { _count_expression_datatype = dtype; }
  }
  
  _mdata_expression_datatypes.clear();
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      if(mdata) {
        EEDB::Datatype *dtype = EEDB::Datatype::get_type(mdata->type().c_str());
        _mdata_expression_datatypes[mdata->type()] = dtype; 
      }
      node = node->next_sibling("mdata");
    }    
  }
  
}

