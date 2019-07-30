/* $Id: SourceStream.cpp,v 1.157 2018/04/16 08:26:01 severin Exp $ */

/***

NAME - EEDB::SPStreams::SourceStream

SYNOPSIS

DESCRIPTION

Converts a MQDB::Database API interface into the SPStream SourceStream API.
Allows data to be streamed into a federated query via the SPStream API.

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
#include <boost/algorithm/string.hpp>
#include <EEDB/Chrom.h>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Feature.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/DBStream.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::SourceStream::class_name = "EEDB::SPStreams::SourceStream";

//function prototypes
void _spstream_sourcestream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::SourceStream*)obj;
}
MQDB::DBObject* _spstream_sourcestream_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::SourceStream*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_sourcestream_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::SourceStream*)node)->_fetch_object_by_id(fid);
}
void _spstream_sourcestream_stream_features_by_metadata_search_func(EEDB::SPStream* node, string filter_logic) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_features_by_metadata_search(filter_logic);
}
void _spstream_sourcestream_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_peers();
}
void _spstream_sourcestream_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_sourcestream_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  ((EEDB::SPStreams::SourceStream*)node)->_get_dependent_datasource_ids(source_ids);
}
void _spstream_sourcestream_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SourceStream*)node)->_reload_stream_data_sources();
}
void _spstream_sourcestream_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_chromosomes(assembly_name, chrom_name);
}
void _spstream_sourcestream_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SourceStream*)node)->_disconnect();
}
void _spstream_sourcestream_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SourceStream*)node)->_reset_stream_node();
}
bool _spstream_sourcestream_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::SourceStream*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
bool _spstream_sourcestream_fetch_features_func(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash) {
  return ((EEDB::SPStreams::SourceStream*)node)->_fetch_features(fid_hash);
}
void _spstream_sourcestream_stream_edges_func(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_edges(fid_hash);
}
void _spstream_sourcestream_stream_all_features_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_all_features();
}
void _spstream_sourcestream_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::SPStreams::SourceStream*)obj)->_xml(xml_buffer);
}
void _spstream_sourcestream_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::SourceStream*)node)->_stream_clear();
}




EEDB::SPStreams::SourceStream::SourceStream() {
  init();
}

EEDB::SPStreams::SourceStream::SourceStream(MQDB::Database* db) {
  init();
  database(db);
  _peer_uuid = db->uuid();
}

EEDB::SPStreams::SourceStream::~SourceStream() {
}

void EEDB::SPStreams::SourceStream::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::SourceStream::class_name;
  _module_name               = "SourceStream";
  _funcptr_delete            = _spstream_sourcestream_delete_func;
  _funcptr_xml               = _spstream_sourcestream_xml_func;
  _funcptr_simple_xml        = _spstream_sourcestream_xml_func;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_sourcestream_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_sourcestream_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_sourcestream_disconnect_func;
  _funcptr_stream_clear                       = _spstream_sourcestream_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_sourcestream_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_sourcestream_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_sourcestream_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_sourcestream_get_dependent_datasource_ids_func;
  _funcptr_reload_stream_data_sources         = _spstream_sourcestream_reload_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_sourcestream_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_sourcestream_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_sourcestream_reset_stream_node_func;
  _funcptr_fetch_features                     = _spstream_sourcestream_fetch_features_func;
  _funcptr_stream_edges                       = _spstream_sourcestream_stream_edges_func;
  _funcptr_stream_all_features                = _spstream_sourcestream_stream_all_features_func;

  //attribute variables
  _source_stream                 = NULL;
  _source_is_active              = true;
  _sources_cache_loaded          = false;
  _disconnect_count              = 0;
  _stream_is_datasource_filtered = false;
  _sourcestream_output           = "feature";
  _assembly_loaded               = false;


  /*
  $self->{"_edgesource_array"} = undef;
  $self->{"_experiment_array"} = undef;
  */
}

void EEDB::SPStreams::SourceStream::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::SourceStream::display_desc() {
  string str = "SourceStream [";
  if(_database != NULL) { str += _database->public_url(); }
  str += "]";
  return str;
}

string EEDB::SPStreams::SourceStream::display_contents() {
  return display_desc();
}


void EEDB::SPStreams::SourceStream::_xml(string &xml_buffer) {
  //maybe do not need to persist to XML anymore
  _xml_start(xml_buffer);  //superclass

  if(_database) { xml_buffer.append(_database->xml()); }

  if(!_filter_source_ids.empty()) {
    xml_buffer.append("<filter_source_ids>");
    map<string, bool>::iterator it4;
    for(it4 = _filter_source_ids.begin(); it4 != _filter_source_ids.end(); it4++) {
      if(it4!=_filter_source_ids.begin()) { xml_buffer.append(","); }
      xml_buffer.append((*it4).first);
    }
    xml_buffer.append("</filter_source_ids>");
  }

  /*
  $str .= sprintf("<sourcestream_output value=\"%s\"/>\n", _sourcestream_output);
  
  if($self->{"_expression_datatypes"}) {
    $str .= "<expression_datatypes value=\"";
    $str .= join(",", @{$self->{"_expression_datatypes"}});
    $str .= "\" />\n";
  }
  
  if($self->{"_featuresource_array"}) {
    foreach my $fsrc (@{$self->{"_featuresource_array"}}) { $str .= $fsrc->simple_xml; }
  }
  
  if($self->{"_experiment_array"}) {
    foreach my $fsrc (@{$self->{"_experiment_array"}}) { $str .= $fsrc->simple_xml; }
  }
  */
  _xml_end(xml_buffer);
}


/*
//does not implement _init_from_xmltree() since this consitutes a security leak
sub _init_from_xmltree { }
*/


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
////////////////////////////////////////////////////////////////////////////

/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::SourceStream::_reset_stream_node() {
  EEDB::SPStream::_reset_stream_node();
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
}

/***** clear_sourcestream_filters
  Description: re-initialize SourceStream to state prior to setting source filters
               (maybe do not need anymore)
*****/


void EEDB::SPStreams::SourceStream::clear_sourcestream_filters() {
  //reset_stream_node();
  
  _source_is_active = true;
  _filter_source_ids.clear();
  _filter_exp_ids.clear();
  _filter_fsrc_ids.clear();
  _expression_datatypes.clear();
  _stream_is_datasource_filtered = false;
  _sourcestream_output = "feature";
  /*  
  $self->{"_assembly_stream_chroms"} = [];
  */
}


void EEDB::SPStreams::SourceStream::set_sourcestream_output(string value) {
  value = boost::algorithm::to_lower_copy(value);
  if(value.empty()) { return; }

  if(value == "subfeature")     { _sourcestream_output = "subfeature"; }
  if(value == "simple_feature") { _sourcestream_output = "simple_feature"; }
  if(value == "feature")        { _sourcestream_output = "feature"; }
  if(value == "full_feature")   { _sourcestream_output = "feature"; }
  if(value == "express")        { _sourcestream_output = "express"; }
  if(value == "expression")     { _sourcestream_output = "express"; }
  if(value == "edge")           { _sourcestream_output = "edge"; }    
  if(value == "simple_express") { _sourcestream_output = "simple_express"; }
  if(value == "skip_metadata")  { _sourcestream_output = "skip_metadata"; }
  if(value == "skip_expression"){ _sourcestream_output = "skip_expression"; }

}


void EEDB::SPStreams::SourceStream::add_expression_datatype_filter(EEDB::Datatype* datatype) {
  _expression_datatypes[datatype->type()] = datatype;
}


void EEDB::SPStreams::SourceStream::add_source_id_filter(string fid) {
  if(fid.empty()) { return; }
  _stream_is_datasource_filtered = true;
  
  if(_filter_source_ids.empty()) { _source_is_active = false; }

  string   uuid;
  string   objClass="Feature";
  long int objID = -1;

  unparse_eedb_id(fid, uuid, objID, objClass);

  //check if uuid matches mine
  if(uuid.empty()) { return; }
  if(_peer_uuid!=NULL and (uuid != string(_peer_uuid))) { return; }
    
  if(objClass == string("FeatureSource")) { _filter_fsrc_ids[fid] = true; }
  if(objClass == string("Experiment"))    { _filter_exp_ids[fid] = true; }

  _filter_source_ids[fid] = true;
  _source_is_active = true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
//////////////////////////////////////////////////////////////////////////////////////////////////


/***** fetch_object_by_id

  Description: fetch single object from database
  Arg (1)    : $id (federatedID <uuid>::id:::<class>)
  Returntype : EEDB::Feature
  Exceptions : none 

*****/

MQDB::DBObject* EEDB::SPStreams::SourceStream::_fetch_object_by_id(string fid) {
  if(_database ==NULL) { return NULL; }
  if(_database->uuid() ==NULL) { return NULL; }
  //if(!_source_is_active) { return NULL; }

  string   uuid, objClass;
  long int objID = -1;

  unparse_eedb_id(fid, uuid, objID, objClass);

  if(uuid.empty()) { return NULL; }
  if(uuid != _database->uuid()) { return NULL; }
  _database->disconnect();
  
  if(objClass == "Feature")       { return EEDB::Feature::fetch_by_id(_database, objID); }
  if(objClass == "Experiment")    { return EEDB::Experiment::fetch_by_id(_database, objID); }
  if(objClass == "FeatureSource") { return EEDB::FeatureSource::fetch_by_id(_database, objID); }
  if(objClass == "EdgeSource")    { return EEDB::EdgeSource::fetch_by_id(_database, objID); }
  if(objClass == "Edge")          { return EEDB::Edge::fetch_by_id(_database, objID); }
  if(objClass == "Expression")    { return EEDB::Expression::fetch_by_id(_database, objID); }
  if(objClass == "Symbol")        { return EEDB::Symbol::fetch_by_id(_database, objID); }
  if(objClass == "Metadata")      { return EEDB::Metadata::fetch_by_id(_database, objID); }
  if(objClass == "Chrom")         { return EEDB::Chrom::fetch_by_id(_database, objID); }
  if(objClass == "Assembly")      { return EEDB::Assembly::fetch_by_id(_database, objID); }

  return NULL;
}


/***** stream_features_by_metadata_search

  Description: perform search of features through metadata filter logic
  Arg (1)    : %options_hash : available optional parameters
               "keyword_list" => <string> :: a comma separated list of metadata keywords, returns merged list
               "filter" => <string> :: string is a keyword/logic string which is applied to the metadata
  Returntype : undef
  Exceptions : none 

*****/

void EEDB::SPStreams::SourceStream::_stream_features_by_metadata_search(string filter_logic) {
  if(_database ==NULL) { return; }
  if(!_source_is_active) { return; }

  if(_peer_uuid==NULL) { return; }
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  map<string, bool>::iterator  it;
  vector<long int>             fsrc_ids;
  
  string uuid, objClass;
  long int objID;
  
  for(it = _filter_source_ids.begin(); it != _filter_source_ids.end(); it++) {
    string fid = (*it).first;
    unparse_eedb_id(fid, uuid, objID, objClass);
    if(uuid.empty()) { continue; }
    if(uuid != string(_peer_uuid)) { continue; }
    if(objClass != string("FeatureSource")) { continue; }
    fsrc_ids.push_back(objID);
  }
  
  if(!_filter_source_ids.empty() and fsrc_ids.empty()) {
    //filters are set, but none of them match my uuid 
    //so return empty stream
    return;
  }
  
  //if filter is empty effectively stream all features
  if(filter_logic.empty()) { 
    vector<MQDB::DBObject*> feats = EEDB::Feature::fetch_all_by_sources(_database, fsrc_ids);
    for(unsigned int i=0; i<feats.size(); i++) {    
      streambuffer->add_object(feats[i]);
    }
    return;
  }

  //now extract critical keywords, pre-stream potential features
  //then followup with full logic filtering for actual matches
  vector<string>  keywords;
  bool add_next_tok = true;
  char *tok;
  char *buffer = (char*)malloc(filter_logic.size()+3);
  strcpy(buffer, filter_logic.c_str());
  tok =strtok(buffer, " \t()");
  while(tok!=NULL) {
    bool ok=true;
    if(tok[0] == '!') { ok = false; }
    if(strcmp(tok, "and")==0) { ok = false; }
    if(strcmp(tok, "or")==0) { ok = false; add_next_tok=true; }
    if(strlen(tok) < 3) { ok = false; }
    if(ok and add_next_tok) {
      keywords.push_back(tok);
      add_next_tok = false;
    }
    tok =strtok(NULL, " \t()");
  }
  free(buffer);
  
  vector<MQDB::DBObject*> feats = EEDB::Feature::fetch_all_with_keywords(_database, fsrc_ids, keywords);
  
  vector<MQDB::DBObject*>::iterator it2;
  for(it2 = feats.begin(); it2 != feats.end(); it2++) {
    EEDB::MetadataSet *mdset = ((EEDB::Feature*)(*it2))->metadataset();
    if(mdset == NULL) { continue; }
    if(!(mdset->check_by_filter_logic(filter_logic))) { continue; }
    streambuffer->add_object(*it2);
  }


  /*  old code for reference if something is still not right
  if($options{"filter"}) {
    my $filter = $options{"filter"};
    my @or_phrases = split (/\s+or\s+/, $filter);
    foreach my $or_block (@or_phrases) {
      $or_block =~ s/\s+and\s+/ /g;
      #$filter =~ s/[\(\)]/ /g;
      my @names = split(/[,\s]/, $or_block);
      
      #use the counting system to pick the keyword with the lowest count
      #to reduce the search overhead
      my $best_name = undef;
      my $best_count = -1;
      foreach my $name (@names) {
        next unless($name);
        my $sym = $name;
        if($name =~ /^(.+)\:\:(.+)/) { $sym = $2; }
        if(!$sym or (length($sym) < 3)) { next; }
        my $like_count = EEDB::Feature->get_count_symbol_search($self->database, $sym ."%");
        if(!defined($best_name) or ($like_count < $best_count)) {
          $best_name = $name;
          $best_count = $like_count;
        }
      }
      if(!defined($best_name)) { next; }
        
      my $t_features = [];
      if($best_name =~ /^primary_name\:\:(.+)/) {
        $t_features = EEDB::Feature->fetch_all_by_primary_name($self->database, $1, @src_filter);
      } elsif($best_name =~ /^(.+)\:\:(.+)/) {
        $t_features = EEDB::Feature->fetch_all_by_symbol($self->database, $1, $2, %options);    
      } else {
        $t_features = EEDB::Feature->fetch_all_symbol_search($self->database, $best_name, undef, undef, @src_filter);
      }
      foreach my $tfeat (@$t_features) {
	      next unless($tfeat and $tfeat->feature_source);
        next unless($tfeat->feature_source->is_active eq "y");
        if(((scalar(@names) > 1) or (scalar(@or_phrases) > 1)) and
           !($tfeat->metadataset->check_by_filter_logic($options{"filter"}))) { next; }
        $uniq_features->{$tfeat->db_id} = $tfeat;
      }
    }
  }
  */
  
}


bool  EEDB::SPStreams::SourceStream::_fetch_features(map<string, EEDB::Feature*> &fid_hash) {
  if(_database ==NULL) { return false; }
  if(_database->uuid() ==NULL) { return false; }
  //if(!_source_is_active) { return NULL; }
  if(fid_hash.empty()) { return true; }
  
  //_database->disconnect();
  vector<long int> fids;
  
  map<string, EEDB::Feature*>::iterator   it;
  for(it = fid_hash.begin(); it != fid_hash.end(); it++) {
    if((*it).second != NULL) { continue; }  //skip if feature already fetched
    
    string fid = (*it).first;
    
    string   uuid, objClass;
    long int objID = -1;
    
    unparse_eedb_id(fid, uuid, objID, objClass);
    
    if(uuid.empty()) { return false; }
    if(uuid != _database->uuid()) { continue; }
    if(objClass != "Feature") { continue; }
    fids.push_back(objID);
    
    //version1 direct fetch
    //EEDB::Feature *feature = EEDB::Feature::fetch_by_id(_database, objID);
    //if(!feature) { return false; }
    //(*it).second = feature;
    //fprintf(stderr, "%s", feature->simple_xml().c_str());
  }
  fprintf(stderr, "need to fetch %ld ids from peer[%s]\n", fids.size(), _database->uuid());
  
  //version2 using multi-fetch
  vector<MQDB::DBObject*>  features = EEDB::Feature::fetch_all_by_ids(_database, fids);
  //fprintf(stderr, "multifetch returned %ld\n", features.size());
  vector<MQDB::DBObject*>::iterator it3;
  for(it3 = features.begin(); it3 != features.end(); it3++) {
    if((*it3) == NULL) { continue; }
    EEDB::Feature * feature = (EEDB::Feature*)(*it3);
    if(fid_hash.find(feature->db_id()) == fid_hash.end()) {
      fprintf(stderr, "SourceStream::_fetch_features something wrong, fetched feature which is not in the fid_hash [%s]\n",
              feature->db_id().c_str());
      return false;
    }
    fid_hash[feature->db_id()] = feature;
    //fprintf(stderr, "%s", feature->simple_xml().c_str());
  }
  if(fids.size() != features.size()) { return false; }
  return true;
}


void  EEDB::SPStreams::SourceStream::_stream_edges(map<string, EEDB::Feature*> fid_hash) {
  if(_database ==NULL) { return; }
  if(!_source_is_active) { return; }
  if(_peer_uuid==NULL) { return; }
  fprintf(stderr, "SourceStream::_stream_edges peer[%s]\n", _peer_uuid);
  
  map<string, bool>::iterator  it1;
  vector<long int>             esrc_ids;
  
  string uuid, objClass;
  long int objID;
  
  for(it1 = _filter_source_ids.begin(); it1 != _filter_source_ids.end(); it1++) {
    string fid = (*it1).first;
    unparse_eedb_id(fid, uuid, objID, objClass);
    if(uuid.empty()) { continue; }
    if(uuid != string(_peer_uuid)) { continue; }
    if(objClass != string("EdgeSource")) { continue; }
    esrc_ids.push_back(objID);
  }
  if(esrc_ids.empty()) {
    fprintf(stderr, "stream_edges peer[%s] no matching edge_sources\n", _peer_uuid);
    return;
  }
  
  //get feature_ids matching my database
  vector<long int> fids;
  map<string, EEDB::Feature*>::iterator   it2;
  for(it2 = fid_hash.begin(); it2 != fid_hash.end(); it2++) {
    string fid = (*it2).first;
    string   uuid, objClass;
    long int objID = -1;
    unparse_eedb_id(fid, uuid, objID, objClass);
    
    if(objClass != "Feature") { continue; }
    if(uuid.empty()) { continue; }
    //if(uuid != _database->uuid()) { continue; }  //TODO: need to check against the edge_source peers
    fids.push_back(objID);
  }
  if(!fid_hash.empty() && fids.empty()) {
    fprintf(stderr, "stream_edges peer[%s] no matching features\n", _peer_uuid);
    return;
  }
  //fprintf(stderr, "need to fetch edges connected to %ld features %ld src from peer[%s]\n", fids.size(), esrc_ids.size(), _database->uuid());

  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;

  vector<EEDB::Edge*>  edges = EEDB::Edge::fetch_all_by_sources_features(_database, esrc_ids, fids);
  //fprintf(stderr, "fetched %ld edges\n", edges.size());
  
  vector<EEDB::Edge*>::iterator it3;
  for(it3 = edges.begin(); it3 != edges.end(); it3++) {
    EEDB::Edge *edge = (*it3);
    streambuffer->add_object(edge);
  }
}


void  EEDB::SPStreams::SourceStream::_stream_all_features() {
  if(_database ==NULL) { return; }
  if(!_source_is_active) { return; }
  if(_peer_uuid==NULL) { return; }
  
  if(_source_stream != NULL) {
    _source_stream->disconnect();
    _source_stream->release();
  }
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  map<string, bool>::iterator  it1;
  vector<long int> fsrc_ids;
  string uuid, objClass;
  long int objID;
  
  for(it1 = _filter_source_ids.begin(); it1 != _filter_source_ids.end(); it1++) {
    string fid = (*it1).first;
    unparse_eedb_id(fid, uuid, objID, objClass);
    if(uuid.empty()) { continue; }
    if(uuid != string(_peer_uuid)) { continue; }
    if(objClass != string("FeatureSource")) { continue; }
    fsrc_ids.push_back(objID);
  }
  
  vector<DBObject*> features = EEDB::Feature::fetch_all_by_sources(_database, fsrc_ids);
  //fprintf(stderr, "SourceStream::_stream_all_features: fetched %ld features\n", features.size());

  vector<DBObject*>::iterator it3;
  for(it3 = features.begin(); it3 != features.end(); it3++) {
    EEDB::Feature *feature = (EEDB::Feature*)(*it3);
    if(feature->classname() != EEDB::Feature::class_name) {
      fprintf(stderr, "problem, featch returned non-features\n");
      continue;
    }
    streambuffer->add_object(feature);
  }
}


/***** stream_by_named_region

  Description: stream all Features from a specific region on a genome
  Arg (1)    : $assembly_name (string)
  Arg (2)    : $chrom_name (string)
  Arg (3)    : $chrom_start (integer)
  Arg (4)    : $chrom_end (integer)
  Returntype : $self
  Exceptions : none 

*****/

bool  EEDB::SPStreams::SourceStream::_stream_by_named_region(
            string assembly_name, string chrom_name, long int start, long int end) {

  if(_database ==NULL) { return false; }
  if(!_source_is_active) { return true; }

  if(_source_stream != NULL) { 
    _source_stream->disconnect(); 
    _source_stream->release(); 
  }
  _source_stream = NULL;
    
  map<string, bool>::iterator  it;
  vector<long int>             fsrc_ids;
  vector<long int>             exp_ids;
  
  string uuid, objClass;
  long int objID;
  
  for(it = _filter_source_ids.begin(); it != _filter_source_ids.end(); it++) {
    string fid = (*it).first;
    unparse_eedb_id(fid, uuid, objID, objClass);
    if(uuid.empty()) { continue; }
    if(objClass == string("FeatureSource")) { fsrc_ids.push_back(objID); }
    if(objClass == string("Experiment"))    { exp_ids.push_back(objID); }
  }
  
  if(!_filter_source_ids.empty() and fsrc_ids.empty() and exp_ids.empty()) {
    //filters are set, but none of them match my uuid so return empty stream
    return true;
  }
  //printf("SourceStream::_stream_by_named_region\n");
  //printf("  _sourcestream_output = [%s]\n", _sourcestream_output.c_str());
  
  if(!_database->get_connection()) { return false; }

  // TODO
  //   new logic here.
  //   stream expression if exp_ids set or output=="expression"
  //      else stream features
  
  if((_sourcestream_output == "edge")) {
    //not implemented yet since does not make sense yet....
  }    
  else if((_sourcestream_output == "express") or !exp_ids.empty()) {    
    map<string, EEDB::Datatype*>::iterator  it3;
    vector<string>  datatypes;
    for(it3 = _expression_datatypes.begin(); it3 != _expression_datatypes.end(); it3++) {
      datatypes.push_back((*it3).first);
    }

    EEDB::SPStreams::DBStream *stream = new EEDB::SPStreams::DBStream;
    stream->dbstream()->database(_database);
    EEDB::Feature::stream_by_named_region(stream->dbstream(), 
                                          fsrc_ids, exp_ids, datatypes, 
                                          assembly_name, chrom_name, start, end);
    _source_stream = stream;
  } else {
    //stream features _sourcestream_output == "subfeature" or  "simple_feature" or "feature"
    //in db streaming there is no difference between these output modes    
    EEDB::SPStreams::DBStream *stream = new EEDB::SPStreams::DBStream;
    stream->dbstream()->database(_database);
    EEDB::Feature::stream_by_named_region(stream->dbstream(), fsrc_ids, assembly_name, chrom_name, start, end);
    _source_stream = stream;
  }
  return true;
}


/***** stream_chromosomes

  Description: streams Assembly and Chrom (chromosomes) out of database
  Arg (1)    : %options_hash : available optional parameters
               "asm" => <string> :: only stream to specified assembly name
  Returntype : $self
  Exceptions : none 

*****/

void  EEDB::SPStreams::SourceStream::_stream_chromosomes(string assembly_name, string chrom_name) {
  if(_database ==NULL) { return; }

  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;

  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;

  boost::algorithm::to_lower(assembly_name);

  _reload_stream_data_sources();  //internal method not superclass and function redirect

  /*
  if(!_assembly_loaded) {
    vector<MQDB::DBObject*> assemblies = EEDB::Assembly::fetch_all(_database);
    for(unsigned int i=0; i<assemblies.size(); i++) {
      EEDB::Assembly *assembly = (EEDB::Assembly*)assemblies[i];
      if(!assembly->sequence_loaded()) { continue; }
      _assembly_cache.push_back(assembly);
    }
    _assembly_loaded = true;
  }
   */

  for(unsigned int i=0; i<_assembly_cache.size(); i++) {
    EEDB::Assembly *assembly = (EEDB::Assembly*)_assembly_cache[i];
    if(!assembly_name.empty() and 
       (boost::algorithm::to_lower_copy(assembly->assembly_name()) != assembly_name) and 
       (boost::algorithm::to_lower_copy(assembly->ncbi_version()) != assembly_name) and 
       (boost::algorithm::to_lower_copy(assembly->ncbi_assembly_accession()) != assembly_name) and 
       (boost::algorithm::to_lower_copy(assembly->ucsc_name()) != assembly_name)) { continue; }
    
    assembly->retain();
    streambuffer->add_object(assembly);

    if(!chrom_name.empty()) {
      EEDB::Chrom* chrom = assembly->get_chrom(chrom_name.c_str());
      if(chrom and (chrom->primary_id() != -1)) { 
        chrom->retain();
        streambuffer->add_object(chrom); 
      }
    } else if(!assembly_name.empty()) {
      //all chromosomes
      vector<EEDB::Chrom*> chroms;
      assembly->all_chroms(chroms);
      for(unsigned int j=0; j<chroms.size(); j++) { 
        chroms[j]->retain();
        streambuffer->add_object(chroms[j]); 
      }
    }
  }

  _database->disconnect();
}


/***** stream_data_sources

  Description: stream all sources(FeatureSource, EdgeSource, and Experiment) out of database
  Arg (1)    : %options_hash : available optional parameters
               "class" => <string> ["FeatureSource" | "Experiment" | "ExpressionDatatype" ]
               "filter" => <string> :: string is a keyword/logic string which is applied to the metadata
               "source_ids" => [dbid, dbid, ...] :: array reference of dbIDs
  Returntype : $self
  Exceptions : none 

*****/

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


void EEDB::SPStreams::SourceStream::_get_dependent_datasource_ids(map<string,bool> &source_ids) {
  if(!_source_is_active) { return; }
  
  _reload_stream_data_sources();  //internal method not superclass and function redirect
    
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }

    if(_stream_is_datasource_filtered) {
      if(!_filter_source_ids[source->db_id()]) { continue; }
    }
    
    source_ids[source->db_id()] = true;
    //TODO: perform cross-query through edge/expression for other sources
  }
  if(_database) { _database->disconnect(); }
}


void EEDB::SPStreams::SourceStream::_reload_stream_data_sources() {
  if(_database ==NULL) { return; }
  if(_sources_cache_loaded) { return; }

  //clear old cache
  _sources_cache.clear();
  
  //if class is defined as filter option, it is a hard filter, only those matching class are allowed
  vector<MQDB::DBObject*> exps       = EEDB::Experiment::fetch_all(_database);
  _add_to_sources_cache(exps);

  vector<MQDB::DBObject*> fsrcs      = EEDB::FeatureSource::fetch_all(_database);
  _add_to_sources_cache(fsrcs);

  vector<MQDB::DBObject*> esrcs      = EEDB::EdgeSource::fetch_all(_database);
  _add_to_sources_cache(esrcs);

  vector<MQDB::DBObject*> assemblies = EEDB::Assembly::fetch_all(_database);
  for(unsigned int i=0; i<assemblies.size(); i++) {
    EEDB::Assembly *assembly = (EEDB::Assembly*)assemblies[i];
    if(!assembly->sequence_loaded()) { continue; }
    _assembly_cache.push_back(assembly);
    _add_datasource(assembly);
  }
  
  _database->disconnect();
  _sources_cache_loaded = true;
  
  //fprintf(stderr, "SourceStream loaded %d source for peer %s\n", (int)_sources_cache.size(), _database->url().c_str());
}


void EEDB::SPStreams::SourceStream::_add_to_sources_cache(vector<MQDB::DBObject*> &sources) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  vector<MQDB::DBObject*>::iterator         it;

  for(it = sources.begin(); it != sources.end(); it++) {
    EEDB::DataSource  *source = (EEDB::DataSource*)(*it);
    if(source == NULL) { continue; }
    if(!source->is_active()) { continue; }
    string fid = source->db_id();
    search_it = _sources_cache.find(fid);
    if(search_it != _sources_cache.end()) { 
      source = _sources_cache[fid];
    } else {
      _sources_cache[fid] = source;
    } 
     
    //old code : flushe old metadata, 
    //do not load metadata at this time, do it later when needed
  }
}


void EEDB::SPStreams::SourceStream::_add_datasource(EEDB::DataSource* source) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  
  if(source == NULL) { return; }
  if(!source->is_active()) { return; }
  string fid = source->db_id();
  search_it = _sources_cache.find(fid);
  if(search_it != _sources_cache.end()) { 
    source = _sources_cache[fid];
  } else {
    source->retain();
    _sources_cache[fid] = source;
  } 
}


EEDB::DataSource*  EEDB::SPStreams::SourceStream::get_datasource(string dbid) {
  map<string, EEDB::DataSource*>::iterator  search_it;
  search_it = _sources_cache.find(dbid);
  if(search_it != _sources_cache.end()) {
    return (*search_it).second;
  }
  return NULL;
}


map<string, EEDB::DataSource*>  EEDB::SPStreams::SourceStream::data_sources_cache() {
  return _sources_cache;
}


void EEDB::SPStreams::SourceStream::free_sources_cache() {
  map<string, EEDB::DataSource*>::iterator  it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    if((*it).second != NULL) { (*it).second->release(); }
  }
  _sources_cache.clear();
  _sources_cache_loaded = false;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/***** stream_peers
  Description: stream all known peers from database
  Arg (1)    : %options_hash : available optional parameters
               "uuid" => <string> :: filter for specific peer UUID
               "alias" => <string> :: filter for specific peer alias/name
*****/

void EEDB::SPStreams::SourceStream::_stream_peers() {
  if(_database ==NULL) { return; }
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  vector<MQDB::DBObject*> peers = EEDB::Peer::fetch_all(_database);
  for(unsigned int idx=0; idx<peers.size(); idx++) {
    EEDB::Peer *peer = (EEDB::Peer*)peers[idx];
    peer->retain();
    streambuffer->add_object(peer);
  }
  _database->disconnect();
}

//
////////////////////////////////////////////////////////////////////////////////////////////////////////
//

/***** next_in_stream

  Description: since this is a source, it needs to override this method and 
               do appropriate business logic to control the stream.
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

*****/

MQDB::DBObject* EEDB::SPStreams::SourceStream::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  //if no more objects then clear the source_stream()
  if(obj == NULL) { 
    if(_source_stream != NULL) { _source_stream->release(); }
    _source_stream = NULL;
    return NULL;
  }
  return obj;
}


/***** disconnect
  Description: send "disconnect" message to source database
*****/
void  EEDB::SPStreams::SourceStream::_disconnect() {
  if(_database != NULL) { _database->disconnect(); }
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
}


/***** stream_clear
 Description: re-initialize the stream-stack back to a clear/empty state
 *****/

void EEDB::SPStreams::SourceStream::_stream_clear() {
  if(_source_stream != NULL) { 
    _source_stream->disconnect(); 
    _source_stream->release(); 
  }
  _source_stream = NULL;
  _disconnect();
}



