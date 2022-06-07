/* $Id: MultiMergeStream.cpp,v 1.35 2020/03/02 08:26:32 severin Exp $ */

/***

NAME - EEDB::SPStreams::MultiMergeStream

SYNOPSIS

DESCRIPTION

a variation on MergeStream, but designed to be a primary source made up of many
component databases (for example a collection of OSCFileDB). Allows one to 
create virtual databases made up of component databases.

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
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::MultiMergeStream::class_name = "EEDB::SPStreams::MultiMergeStream";

//function prototypes
MQDB::DBObject* _spstream_multimergestream_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MultiMergeStream*)node)->_next_in_stream();
}

MQDB::DBObject* _spstream_multimergestream_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::MultiMergeStream*)node)->_fetch_object_by_id(fid);
}

void _spstream_multimergestream_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_clear();
}

bool _spstream_multimergestream_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}

void _spstream_multimergestream_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_features_by_metadata_search(search_logic);
}

void _spstream_multimergestream_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_data_sources(classname, filter_logic);
}

void _spstream_multimergestream_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_get_dependent_datasource_ids(source_ids);
}

void _spstream_multimergestream_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_chromosomes(assembly_name, chrom_name);
}

void _spstream_multimergestream_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_peers();
}

void _spstream_multimergestream_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_reload_stream_data_sources();
}

void _spstream_multimergestream_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_disconnect();
}

void _spstream_multimergestream_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_reset_stream_node();
}

void _spstream_multimergestream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MultiMergeStream*)obj;
}

void _spstream_multimergestream_get_proxies_by_name_func(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_get_proxies_by_name(proxy_name, proxies);
}

bool _spstream_multimergestream_fetch_features_func(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash) {
  return ((EEDB::SPStreams::MultiMergeStream*)node)->_fetch_features(fid_hash);
}

void _spstream_multimergestream_stream_edges_func(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash, string filter_logic) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_edges(fid_hash, filter_logic);
}

void _spstream_multimergestream_stream_all_features_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::MultiMergeStream*)node)->_stream_all_features();
}


EEDB::SPStreams::MultiMergeStream::MultiMergeStream() {
  init();
}

EEDB::SPStreams::MultiMergeStream::MultiMergeStream(MQDB::Database* db) {
  init();
  database(db);
}

EEDB::SPStreams::MultiMergeStream::~MultiMergeStream() {
  for(unsigned i=0; i<_sourcestreams.size(); i++) {
    EEDB::SPStreams::MultistreamElement *mse = _sourcestreams[i];
    if(mse->stream != NULL) { 
      mse->stream->disconnect();
      mse->stream->release();
      mse->stream = NULL;
    }
    delete mse;
  }
  _sourcestreams.clear();
}

void EEDB::SPStreams::MultiMergeStream::init() {
  EEDB::SPStream::init();
  _classname      = EEDB::SPStreams::MultiMergeStream::class_name;
  _module_name    = "MultiMergeStream";
  _funcptr_delete = _spstream_multimergestream_delete_func;
  
  //function pointer code
  _funcptr_next_in_stream                     = _spstream_multimergestream_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_multimergestream_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_multimergestream_disconnect_func;
  _funcptr_stream_clear                       = _spstream_multimergestream_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_multimergestream_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_multimergestream_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_multimergestream_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_multimergestream_get_dependent_datasource_ids_func;
  _funcptr_reload_stream_data_sources         = _spstream_multimergestream_reload_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_multimergestream_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_multimergestream_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_multimergestream_reset_stream_node_func;
  _funcptr_get_proxies_by_name                = _spstream_multimergestream_get_proxies_by_name_func;
  _funcptr_fetch_features                     = _spstream_multimergestream_fetch_features_func;
  _funcptr_stream_edges                       = _spstream_multimergestream_stream_edges_func;
  _funcptr_stream_all_features                = _spstream_multimergestream_stream_all_features_func;

  //attribute variables
  _source_stream        = NULL;  //super class variable not used
  _active_sourcestreams = NULL;
  /*
    
  $self->{'_sourcestreams'} = []; 
  #array of hashes hashes holding all information on each source
  
  $self->{'_sourcestream_output'} = "feature";
  $self->{'debug'} = 0;  
  */
}

void EEDB::SPStreams::MultiMergeStream::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::MultiMergeStream::display_desc() {
  string str = "MultiMergeStream [";
  return str;
}

string EEDB::SPStreams::MultiMergeStream::display_contents() {
  return display_desc();
}

/*
sub xml_start {
  my $self = shift;
  my $str = sprintf("<spstream module=\"%s\" >\n", $self->class);
  $str .= sprintf("<sourcestream_output value=\"%s\"/>\n", $self->sourcestream_output);

  foreach my $sshash (@{$self->{'_sourcestreams'}}) {
    $str .= "<stream_source>\n";
    $str .= $sshash->{'sourcestream'}->xml;
    $str .= "</stream_source>\n";
  }
  return $str;
}


sub _init_from_xmltree {
  my $self = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  unless($xmlTree->{'-module'} eq "EEDB::SPStream::MultiMergeStream") { return undef; }
  
  if($xmlTree->{'sourcestream_output'}) {
    $self->sourcestream_output($xmlTree->{'sourcestream_output'}->{'-value'});
  }  

  if($xmlTree->{'stream_source'}) {
    my $sources = $xmlTree->{'stream_source'};
    unless($sources =~ /ARRAY/) { $sources = [$sources]; }
    foreach my $sourceTree (@$sources) {
      my ($head,$tail) = EEDB::SPStream->create_stream_stack_from_xml($sourceTree);
      if($head) { $self->add_sourcestream($head); }
    }  
  }
  return $self;
}
*/


////////////////////////////////////////////////////////////////////////////
//
// initialization and configuration methods
//
////////////////////////////////////////////////////////////////////////////

/***** clear_sourcestream_filters
  Description: resets directly connected source_streams to have no filters
*****/

void EEDB::SPStreams::MultiMergeStream::clear_sourcestream_filters()  {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    if((*it)->stream_is_source) {
      EEDB::SPStreams::SourceStream  *source = (EEDB::SPStreams::SourceStream*) (*it)->stream;
      source->clear_sourcestream_filters();
    }
  }
}

void EEDB::SPStreams::MultiMergeStream::add_source_id_filter(string fid)  {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    if((*it)->stream_is_source) {
      EEDB::SPStreams::SourceStream  *source = (EEDB::SPStreams::SourceStream*) (*it)->stream;
      source->add_source_id_filter(fid);
    }
  }
}


/***** add_expression_datatype_filter
  Description: sets filters for Expression data to only specified expression_datatypes 
*****/

void EEDB::SPStreams::MultiMergeStream::add_expression_datatype_filter(EEDB::Datatype* datatype)  {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    if((*it)->stream_is_source) {
      EEDB::SPStreams::SourceStream  *source = (EEDB::SPStreams::SourceStream*) (*it)->stream;
      source->add_expression_datatype_filter(datatype);
    }
  }
}

/***** set_sourcestream_output
  Description: sets output object (Feature, Expression, Edge) when streaming 
*****/

void  EEDB::SPStreams::MultiMergeStream::set_sourcestream_output(string value) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    if((*it)->stream_is_source) {
      EEDB::SPStreams::SourceStream  *source = (EEDB::SPStreams::SourceStream*) (*it)->stream;
      source->set_sourcestream_output(value);
    }
  }
}



/***** add_stream
  Description: add an EEDB::SPStream into the pool of streams to merge.
*****/

void EEDB::SPStreams::MultiMergeStream::add_stream(EEDB::SPStream* stream) {
  //add stream to streams to be merged
  if(stream == NULL) { return; }
  
  EEDB::SPStreams::MultistreamElement *mse = new EEDB::SPStreams::MultistreamElement;
  stream->retain();
  mse->stream = stream;
  _sourcestreams.push_back(mse);
}


/***** add_sourcestream
  Description: add an EEDB::SPStreams::SourceStream into the pool of streams to merge.
               SourceStream has additional API functionality which is enabled for these streams
*****/

void EEDB::SPStreams::MultiMergeStream::add_sourcestream(EEDB::SPStreams::SourceStream* stream) {
  //add stream to streams to be merged
  if(stream == NULL) { return; }
  
  EEDB::SPStreams::MultistreamElement *mse = new EEDB::SPStreams::MultistreamElement;
  stream->retain();
  mse->stream = stream;
  mse->stream_is_source = true;  
  _sourcestreams.push_back(mse);
}



////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////


bool multistream_sort_func (EEDB::SPStreams::MultistreamElement *a, EEDB::SPStreams::MultistreamElement *b) { 
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  return (*a < *b); 
}


void EEDB::SPStreams::MultiMergeStream::_resort_active_streams() {
  //head of active streams has been updated, rest of linked-list is already sorted.
  //just need to move the head element by insert-sort
  EEDB::SPStreams::MultistreamElement *st1, *st2, *st3;

  if(_active_sourcestreams == NULL) { return; }
  
  if(_active_sourcestreams->stream_is_empty) {
    //stream is empty so unlink and move _active_sourcestreams to next
    //printf("active head is empty, move to next stream\n");
    st1 = _active_sourcestreams;
    _active_sourcestreams = _active_sourcestreams->next;
    st1->next =NULL;
    st1->prev =NULL;
    if(_active_sourcestreams != NULL) { _active_sourcestreams->prev = NULL; }
    return;
  }
  if(_active_sourcestreams->next == NULL) { return; } //active stream is only one left

  //_active_sourcestreams maybe needs to move
  //move st1 pointer to location where need to insert
  st1 = _active_sourcestreams;
  while((st1->next !=NULL) and (*(st1->next) < *_active_sourcestreams)) {
    //next stream is less than active so need to move
    st1 = st1->next;
  }
  
  if(st1 != _active_sourcestreams) {
    //need to move active to between st1 and st1->next
    st3 = _active_sourcestreams->next;  //st3 will become new head active
    
    st2 = st1->next;
    _active_sourcestreams->prev = st1;
    _active_sourcestreams->next = st2;
    st1->next = _active_sourcestreams;
    if(st2!=NULL) {
      st2->prev = _active_sourcestreams;
    }
    _active_sourcestreams = st3;
    _active_sourcestreams->prev = NULL;
  }
}


void EEDB::SPStreams::MultiMergeStream::_init_active_streams() {  
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->input_stream_count = 0;
    (*it)->stream_is_empty    = true;  //set to empty first
    (*it)->current_object     = (*it)->stream->next_in_stream();
    if((*it)->current_object != NULL) {
      (*it)->stream_is_empty = false;
      (*it)->input_stream_count = 1;
      (*it)->next = NULL;
      (*it)->prev = NULL;
      (*it)->object_class = MSE_OTHER;
      if((*it)->current_object->classname() == EEDB::Feature::class_name)    { (*it)->object_class = MSE_FEATURE; }
      if((*it)->current_object->classname() == EEDB::Expression::class_name) { (*it)->object_class = MSE_EXPRESS; }
    }
  }
  sort(_sourcestreams.begin(), _sourcestreams.end(), multistream_sort_func);

  _active_sourcestreams = NULL;  //linked list which will be sorted
  EEDB::SPStreams::MultistreamElement  *t_tail=NULL;

  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if(!(*it)->stream_is_empty) {
      if(_active_sourcestreams == NULL) {
        _active_sourcestreams = (*it);
      } else {
        t_tail->next = (*it);
        (*it)->prev  = t_tail;
      }
      t_tail = (*it);
    }
  }
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
//////////////////////////////////////////////////////////////////////////////////////////////////

/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::MultiMergeStream::_reset_stream_node() {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->current_object     = NULL;
    (*it)->stream_is_empty    = true;  //reset to empty, _init_active_streams will change
    (*it)->object_class       = MSE_OTHER;    
    (*it)->input_stream_count = 0;
    if((*it)->stream_is_source) {
      //EEDB::SPStreams::SourceStream  *source = (EEDB::SPStreams::SourceStream*) (*it)->stream;
      //source->sourcestream_output(_sourcestream_output);
    }
  }
}


/***** fetch_object_by_id
  Description: fetch single object from database
  Arg (1)    : $id (federatedID <uuid>::id:::<class>)
  Returntype : either an MQDB::DBObject* or NULL if not found
*****/

MQDB::DBObject* EEDB::SPStreams::MultiMergeStream::_fetch_object_by_id(string fid) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    MQDB::DBObject *obj = (*it)->stream->fetch_object_by_id(fid);
    if(obj!=NULL) { return obj; }
  }
  return NULL;
}


/***** next_in_stream
  Description: return the next object in the stream stack
               depending on the configuration this will either be an on-the-fly created object
               or an object passed through filters, or a primary object streamed out of database/peer
  Returntype : either an MQDB::DBObject* or NULL if end of stream
*****/

MQDB::DBObject* EEDB::SPStreams::MultiMergeStream::_next_in_stream() {
  //array of _sourcestreams is alrady sorted and preloaded so just
  //grab object from stream at head of array, then prefetch and resort
  
  if(_active_sourcestreams == NULL) { return NULL; }

  EEDB::SPStreams::MultistreamElement *mse = _active_sourcestreams;

  if(mse == NULL) { return NULL; }
  if(mse->stream_is_empty) { return NULL; }
  if(mse->stream == NULL) { return NULL; }
  
  MQDB::DBObject*  next_obj = mse->current_object;
  
  //now reload and resort
  mse->current_object = mse->stream->next_in_stream();
  if(mse->current_object == NULL) { mse->stream_is_empty = true; }
  else { 
    mse->input_stream_count++; 
    mse->object_class = MSE_OTHER;
    if(mse->current_object->classname() == EEDB::Feature::class_name)    { mse->object_class = MSE_FEATURE; }
    if(mse->current_object->classname() == EEDB::Expression::class_name) { mse->object_class = MSE_EXPRESS; }
  }
  
  _resort_active_streams();
  
  return next_obj;
}


/***** stream_clear
  Description: re-initialize the stream-stack back to a clear/empty state
*****/

void EEDB::SPStreams::MultiMergeStream::_stream_clear() {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_clear();
  }
  _reset_stream_node();
}


/***** stream_data_sources
  Description: stream all sources(FeatureSource, EdgeSource, and Experiment) out of database
*****/

void EEDB::SPStreams::MultiMergeStream::_stream_data_sources(string classname, string filter_logic) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_data_sources(classname, filter_logic);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}

void EEDB::SPStreams::MultiMergeStream::_reload_stream_data_sources() {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->reload_stream_data_sources();
  }
}

void EEDB::SPStreams::MultiMergeStream::_get_dependent_datasource_ids(map<string,bool> &source_ids) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->get_dependent_datasource_ids(source_ids);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


/***** stream_by_named_region
  Description: configure/initialize the stream-stack to a stream from a named region.
               This will be passed down the stack until it reaches an SPStream::SourceStream instance
               which then knows how to create a new stream from a database.
*****/

bool EEDB::SPStreams::MultiMergeStream::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  bool rtn = true;
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    rtn &= (*it)->stream->stream_by_named_region(assembly_name, chrom_name, start, end);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
  return rtn;
}


/***** stream_features_by_metadata_search
  Description: perform search of features through metadata filter logic
  Arg (1)    : a keyword/logic string which is applied to the metadata (optional)
*****/

void EEDB::SPStreams::MultiMergeStream::_stream_features_by_metadata_search(string search_logic) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_features_by_metadata_search(search_logic);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


/***** stream_chromosomes
  Description: stream all EEDB::Chrom chromosomes from databases on the stream
*****/

void EEDB::SPStreams::MultiMergeStream::_stream_chromosomes(string assembly_name, string chrom_name) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_chromosomes(assembly_name, chrom_name);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


void EEDB::SPStreams::MultiMergeStream::_get_proxies_by_name(string proxy_name, vector<EEDB::SPStream*> &proxies) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->get_proxies_by_name(proxy_name, proxies);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


/***** stream_peers
  Description: stream all known peers from database
*****/

void EEDB::SPStreams::MultiMergeStream::_stream_peers() {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_peers();
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


/***** disconnect
  Description: send "disconnect" message to all spstream modules
*****/

void  EEDB::SPStreams::MultiMergeStream::_disconnect() {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->disconnect();
  }
}


bool  EEDB::SPStreams::MultiMergeStream::_fetch_features(map<string, EEDB::Feature*> &fid_hash) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    if(!((*it)->stream->fetch_features(fid_hash))) { return false; }
  }
  return true;
}


void  EEDB::SPStreams::MultiMergeStream::_stream_edges(map<string, EEDB::Feature*> fid_hash, string filter_logic) {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_edges(fid_hash, filter_logic);
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


void  EEDB::SPStreams::MultiMergeStream::_stream_all_features() {
  vector<EEDB::SPStreams::MultistreamElement*>::iterator   it;
  for(it = _sourcestreams.begin(); it != _sourcestreams.end(); it++) {
    if((*it)->stream == NULL) { continue; }
    (*it)->stream->stream_all_features();
  }
  _init_active_streams();  //prepares for next_in_stream() calls
}


////////////////////////////////////////////////////////////////////////////
//
// MultistreamElement section
//
////////////////////////////////////////////////////////////////////////////

EEDB::SPStreams::MultistreamElement::MultistreamElement() {
  //constructor
  stream = NULL;
  current_object = NULL;
  input_stream_count = 0;
  stream_is_empty = true;
  stream_is_source = false;
  object_class = MSE_OTHER;

}

bool EEDB::SPStreams::MultistreamElement::operator< (const EEDB::SPStreams::MultistreamElement& b) {
  MQDB::DBObject *obj1 = current_object;
  MQDB::DBObject *obj2 = b.current_object;
  
  if(obj1==obj2) { return false; }  //either same or both NULL (pointer compare)
  if(obj1==NULL) { return false; }  //NULL > real objects
  if(obj2==NULL) { return true; }   //obj1!=NULL but obj2==NULL (NULL > real objects)
  
  //if either a or b is an "other" object no sort order
  if((object_class == MSE_OTHER) or (b.object_class == MSE_OTHER)) { return false; }
    
  EEDB::Feature *feature1=NULL, *feature2=NULL;
  if(object_class == MSE_FEATURE) { feature1 = (EEDB::Feature*)obj1; }
  if(object_class == MSE_EXPRESS) { feature1 = ((EEDB::Expression*)obj1)->feature(); }

  if(b.object_class == MSE_FEATURE) { feature2 = (EEDB::Feature*)obj2; }
  if(b.object_class == MSE_EXPRESS) { feature2 = ((EEDB::Expression*)obj2)->feature(); }

  if(feature1==NULL or feature2==NULL) { return false; }
  
  return (*feature1) < (*feature2);
}

