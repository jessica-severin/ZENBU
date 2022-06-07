/* $Id: SPStream.cpp,v 1.108 2021/07/08 04:43:20 severin Exp $ */

/***

NAME - EEDB::SPStream

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/SPStream.h>
#include <EEDB/Experiment.h>

//for dynamic stream creation from XML
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/MergeStreams.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/ObjectCount.h>
#include <EEDB/SPStreams/Proxy.h>
#include <EEDB/SPStreams/TemplateFilter.h>
#include <EEDB/SPStreams/CutoffFilter.h>
#include <EEDB/SPStreams/CalcFeatureSignificance.h>
#include <EEDB/SPStreams/IDFilter.h>
#include <EEDB/SPStreams/NormalizePerMillion.h>
#include <EEDB/SPStreams/CalcInterSubfeatures.h>
#include <EEDB/SPStreams/StreamSubfeatures.h>
#include <EEDB/SPStreams/UniqueFeature.h>
#include <EEDB/SPStreams/ResizeFeatures.h>
#include <EEDB/SPStreams/FeatureLengthFilter.h>
#include <EEDB/SPStreams/MakeStrandless.h>
#include <EEDB/SPStreams/TopHits.h>
#include <EEDB/SPStreams/ExpressionDatatypeFilter.h>
#include <EEDB/SPStreams/Paraclu.h>
#include <EEDB/SPStreams/NeighborCutoff.h>
#include <EEDB/SPStreams/NormalizeRPKM.h>
#include <EEDB/SPStreams/DevNull.h>
#include <EEDB/SPStreams/StreamTKs.h>
#include <EEDB/SPStreams/NormalizeByFactor.h>
#include <EEDB/SPStreams/FeatureRename.h>
#include <EEDB/SPStreams/RenameExperiments.h>
#include <EEDB/SPStreams/RescalePseudoLog.h>
#include <EEDB/SPStreams/FilterSubfeatures.h>
#include <EEDB/SPStreams/OverlapAnnotate.h>
#include <EEDB/SPStreams/OverlapMerge.h>
#include <EEDB/SPStreams/MetadataFilter.h>
#include <EEDB/SPStreams/MetadataManipulate.h>
#include <EEDB/SPStreams/StrandFilter.h>
#include <EEDB/SPStreams/FlipStrand.h>
#include <EEDB/SPStreams/MannWhitneyRanksum.h>
#include <EEDB/SPStreams/CachePoint.h>
#include <EEDB/SPStreams/SiteFinder.h>
#include <EEDB/SPStreams/DemultiplexSource.h>
#include <EEDB/SPStreams/CAGECorrection.h>
#include <EEDB/SPStreams/AppendExpression.h>
#include <EEDB/SPStreams/PairReads.h>
#include <EEDB/SPStreams/EdgeLengthFilter.h>
#include <EEDB/SPStreams/DumbBellToEdge.h>
#include <EEDB/SPStreams/MergeEdges.h>


using namespace std;
using namespace MQDB;

const char*               EEDB::SPStream::class_name = "EEDB::SPStream";

//function prototypes
//these are functions so need to pass obj as parameter
//this is also outside of class scope so only public attributes/methods available
MQDB::DBObject* _spstream_default_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStream*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_default_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStream*)node)->_fetch_object_by_id(fid);
}
void _spstream_default_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStream*)node)->_stream_clear();
}
bool _spstream_default_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStream*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_default_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  ((EEDB::SPStream*)node)->_stream_features_by_metadata_search(search_logic);
}
void _spstream_default_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStream*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_default_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  ((EEDB::SPStream*)node)->_stream_chromosomes(assembly_name, chrom_name);
}
void _spstream_default_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStream*)node)->_stream_peers();
}
void _spstream_default_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStream*)node)->_reload_stream_data_sources();
}
void _spstream_default_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStream*)node)->_disconnect();
}
void _spstream_default_get_proxies_by_name(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies) {
  ((EEDB::SPStream*)node)->_get_proxies_by_name(proxy_name, proxies);
}
void _spstream_default_get_dependent_datasource_ids(EEDB::SPStream* node, map<string, bool> &source_ids) {
  ((EEDB::SPStream*)node)->_get_dependent_datasource_ids(source_ids);
}
void _spstream_default_stream_all_features_func(EEDB::SPStream* node) {
  ((EEDB::SPStream*)node)->_stream_all_features();
}
bool _spstream_default_fetch_features_func(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash) {
  return ((EEDB::SPStream*)node)->_fetch_features(fid_hash);
}
void _spstream_default_stream_edges_func(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash, string search_logic) {
  ((EEDB::SPStream*)node)->_stream_edges(fid_hash, search_logic);
}
void _spstream_default_reset_stream_node_func(EEDB::SPStream* node) {
  //this is not passed down the stream, but can be replaced by subclasses
  //with a function which resets pointers,counters or other internal
  //variables to bring the stream back to a clean starting point
  ((EEDB::SPStream*)node)->_reset_stream_node();
}

void _eedb_spstream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStream*)obj;
}
void _eedb_spstream_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStream*)obj)->_xml(xml_buffer);
}
void _eedb_spstream_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStream*)obj)->_xml(xml_buffer);
}
string _eedb_spstream_display_desc_func(MQDB::DBObject *obj) {
  return ((EEDB::SPStream*)obj)->_display_desc();
}


//
////////////////////////////////////////////////////////////////////////////////////////
//

EEDB::SPStream::SPStream() {
  init();
}

EEDB::SPStream::~SPStream() {
}

void EEDB::SPStream::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::SPStream::class_name;
  _funcptr_delete            = _eedb_spstream_delete_func;  
  _funcptr_xml               = _eedb_spstream_xml_func;
  _funcptr_simple_xml        = _eedb_spstream_simple_xml_func;
  _funcptr_display_desc      = _eedb_spstream_display_desc_func;
  
  _source_stream  = NULL;
  _side_stream    = NULL;
  _region_start   = -1;
  _region_end     = -1;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_default_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_default_fetch_object_by_id_func;
  _funcptr_fetch_features                     = _spstream_default_fetch_features_func;
  _funcptr_disconnect                         = _spstream_default_disconnect_func;
  _funcptr_stream_clear                       = _spstream_default_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_default_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_default_stream_features_by_metadata_search_func;
  _funcptr_stream_all_features                = _spstream_default_stream_all_features_func;
  _funcptr_stream_data_sources                = _spstream_default_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_default_stream_chromosomes_func;
  _funcptr_stream_edges                       = _spstream_default_stream_edges_func;
  _funcptr_stream_peers                       = _spstream_default_stream_peers_func;
  _funcptr_reload_stream_data_sources         = _spstream_default_reload_stream_data_sources_func;
  _funcptr_reset_stream_node                  = _spstream_default_reset_stream_node_func;
  _funcptr_get_proxies_by_name                = _spstream_default_get_proxies_by_name;
  _funcptr_get_dependent_datasource_ids       = _spstream_default_get_dependent_datasource_ids;

}

void EEDB::SPStream::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStream::_display_desc() {
  string xml = "SPStream[";
  xml += _classname;
  xml += "]";
  return xml;
}

string EEDB::SPStream::display_contents() {
  return display_desc();
}


void EEDB::SPStream::_xml_start(string &xml_buffer) {
  //depth first search to reverse order
  if(_source_stream) {
    _source_stream->xml(xml_buffer);
  }
  
  xml_buffer.append("<spstream module=\"");
  xml_buffer.append(_module_name);
  xml_buffer.append("\">");
}

void EEDB::SPStream::_xml_end(string &xml_buffer) {
  if(_side_stream) {  
    xml_buffer.append("<side_stream>");
    _side_stream->xml(xml_buffer);
    xml_buffer.append("</side_stream>");
  }
  xml_buffer.append("</spstream>");
}

void EEDB::SPStream::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}


////////////////////////////////////////////////////////////////////////////


void EEDB::SPStream::unparse_eedb_id(string fid, string &uuid, long int &objID, string &objClass) {
  uuid.clear();
  objClass="Feature";
  objID = -1;

  size_t   p1;
  if((p1 = fid.find("::")) != string::npos) {
    uuid = fid.substr(0, p1);
    string idclass = fid.substr(p1+2);
    if((p1 = idclass.find(":::")) != string::npos) {
      objClass = idclass.substr(p1+3);
      string t_id = idclass.substr(0, p1);
      objID = atoi(t_id.c_str());
    } else {
      objID = atoi(idclass.c_str());
    }
  }
}
    

////////////////////////////////////////////////////////////////////////////
// Instance methods
////////////////////////////////////////////////////////////////////////////


/***** source_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or NULL if not set
  Exceptions : none 

*****/

EEDB::SPStream*  EEDB::SPStream::source_stream() { return (EEDB::SPStream*)_source_stream; }

void  EEDB::SPStream::source_stream(EEDB::SPStream* value) {
  if(value == NULL) { 
    _source_stream = NULL;
  } else {
    if(value == this) {
      fprintf(stderr, "ERROR: can not set source_stream() to itself\n");
      return;
    } else {
      _source_stream = value;
    }

  }
}

/***** side_stream
 
 Description: set the input or source stream feeding objects into this level of the stream stack.
 Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or NULL if not set
 Exceptions : none 
 
 *****/


EEDB::SPStream*  EEDB::SPStream::side_stream() { 
  return (EEDB::SPStream*)_side_stream; 
}

void  EEDB::SPStream::side_stream(EEDB::SPStream* value) {
  if(value == NULL) { 
    _side_stream = NULL;
  } else {
    if(value == this) {
      fprintf(stderr, "ERROR: can not set side_stream() to itself\n");
      return;
    } else {
      _side_stream = value;
    }
    
  }
}


////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
////////////////////////////////////////////////////////////////////////////

/***** next_in_stream
  Description: return the next object in the stream stack
               depending on the configuration this will either be an on-the-fly created object
               or an object passed through filters, or a primary object streamed out of database/peer
  Returntype : either a DBObject or NULL if end of stream
*****/

MQDB::DBObject*  EEDB::SPStream::next_in_stream() {
  return _funcptr_next_in_stream(this);
}


/***** fetch_object_by_id
  Description: fetch single feature object from stream using global federated-ID. 
               passes query down the stream until it is satisfied
  Arg (1)    : $fedID (federated ID <uuid>::<id>:::<class>)
*****/

MQDB::DBObject* EEDB::SPStream::fetch_object_by_id(string id) {
  reset_stream_node();
  return _funcptr_fetch_object_by_id(this, id);
}  

bool EEDB::SPStream::fetch_features(map<string, EEDB::Feature*> &fid_hash) {
  reset_stream_node();
  return _funcptr_fetch_features(this, fid_hash);
}


/***** stream_clear
  Description: re-initialize the stream-stack back to a clear/empty state
*****/

void EEDB::SPStream::stream_clear() {
  _funcptr_stream_clear(this);
}


/***** stream_by_named_region
  Description: configure/initialize the stream-stack to a stream from a named region.
               This will be passed down the stack until it reaches an SPStream::SourceStream instance
               which then knows how to create a new stream from a database.
  Arg (1)    : $assembly_name (string)
  Arg (2)    : $chrom_name (string)
  Arg (3)    : $chrom_start (integer)
  Arg (4)    : $chrom_end (integer)
*****/

bool  EEDB::SPStream::stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  reset_stream_node();
  return _funcptr_stream_by_named_region(this, assembly_name, chrom_name, start, end);
}


/***** stream_data_sources
  Description: stream all sources(FeatureSource, EdgeSource, and Experiment) out of database
*****/

void EEDB::SPStream::stream_data_sources() {
  reset_stream_node();
  _funcptr_stream_data_sources(this, string(""), string(""));
}

void EEDB::SPStream::stream_data_sources(string classname) {
  reset_stream_node();
  _funcptr_stream_data_sources(this, classname, "");
}

void EEDB::SPStream::stream_data_sources(string classname, string filter_logic) {
  reset_stream_node();
  _funcptr_stream_data_sources(this, classname, filter_logic);
}

void EEDB::SPStream::get_dependent_datasource_ids(map<string,bool> &source_ids) {
  reset_stream_node();
  _funcptr_get_dependent_datasource_ids(this, source_ids);
}

/***** reload_stream_data_sources
  Description: SourceStream will cache sources(FeatureSource, EdgeSource, and Experiment)
               System automatically will do a reload ever hour to check for new sources
               added to previously cached peer/databases. But it may be useful to manually
               force a cache refresh.
*****/

void EEDB::SPStream::reload_stream_data_sources() {
  reset_stream_node();
  _funcptr_reload_stream_data_sources(this);
}


/***** stream_chromosomes
  Description: stream all EEDB::Chrom chromosomes from databases on the stream
*****/

void EEDB::SPStream::stream_chromosomes(string assembly_name, string chrom_name) {
  reset_stream_node();
  _funcptr_stream_chromosomes(this, assembly_name, chrom_name);
}

/***** stream_edges
 Description: stream edges based on filters ,peers, sources and a list of features
 *****/

void EEDB::SPStream::stream_edges(map<string, EEDB::Feature*> fid_hash, string search_logic) {
  reset_stream_node();
  _funcptr_stream_edges(this, fid_hash, search_logic);
}

/***** stream_all_features
 Description: stream all features based on filters ,peers, and sources
 *****/

void EEDB::SPStream::stream_all_features() {
  reset_stream_node();
  _funcptr_stream_all_features(this);
}

/***** stream_peers
  Description: stream all known peers from database
*****/

void EEDB::SPStream::stream_peers() {
  reset_stream_node();
  _funcptr_stream_peers(this);
}


/***** stream_features_by_metadata_search
  Description: perform search of features through metadata filter logic
  Arg (1)    : a keyword/logic string which is applied to the metadata (optional)
*****/

void  EEDB::SPStream::stream_features_by_metadata_search(string search_logic) {
  reset_stream_node();
  _funcptr_stream_features_by_metadata_search(this, search_logic);
}  


/***** disconnect
  Description: send "disconnect" message to all spstream modules
*****/

void  EEDB::SPStream::disconnect() {
  _funcptr_disconnect(this);
}


/***** reset_stream_node
  Description: can be reimplemented by subclasses. 
               This is called at the beginning of every stream_xxxxx() call.
               Useful for reseting/clearing internal caches/variables between
               different streams.
*****/

void EEDB::SPStream::reset_stream_node() {
  _funcptr_reset_stream_node(this);
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////


void  EEDB::SPStream::create_stream_from_xml(void *xml_node, SPStream* &head, SPStream* &tail) {
  //linear order in XML is order of appending onto 'head'
  rapidxml::xml_node<>  *root_node = (rapidxml::xml_node<>*)xml_node;
  
  head = NULL;
  tail = NULL;
  
  if(root_node == NULL) { return; }
  
  rapidxml::xml_node<> *stream_node = root_node->first_node("spstream");
  while(stream_node) {
    EEDB::SPStream *spstream = EEDB::SPStream::_xmlnode_create_spstream(stream_node);
    if(spstream!=NULL) {
      if(tail==NULL) { tail = spstream; }
      if(head!=NULL) { spstream->source_stream(head); }
      head = spstream;
    }
    stream_node = stream_node->next_sibling("spstream");
  }  
}


void  EEDB::SPStream::create_side_stream_from_xml(void *xml_node) {
  //used by stream modules which need to create a side_stream on them selves
  rapidxml::xml_node<>  *node = (rapidxml::xml_node<>*)xml_node;
  
  EEDB::SPStream *head  = NULL;
  EEDB::SPStream *tail  = NULL;
  EEDB::SPStream::create_stream_from_xml(node, head, tail);
  if(head) { side_stream(head); }  
}


EEDB::SPStream*  EEDB::SPStream::reverse_stream(SPStream* node) {
  //recursive algorithm to reverse node and its source_stream()
  // 'node' is the parent of this, so in reverse this->source_stream should point at parent 'node'
  // returns the new head which is the deepest node of the stream

  if(_side_stream) {
    _side_stream = _side_stream->reverse_stream(NULL);
  }
  
  EEDB::SPStream *new_head = this;
  if(_source_stream!=NULL) { 
    new_head = _source_stream->reverse_stream(this);
  }
  
  _source_stream = node;
  return new_head;  
}


EEDB::SPStream* EEDB::SPStream::_xmlnode_create_spstream(void *xml_node) {
  //master mapper from named modules to actual class binding (not a dynamically typed language)
  if(xml_node==NULL) { return NULL; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  EEDB::SPStream            *spstream = NULL;
  
  if(string(root_node->name()) != "spstream") { return NULL; }

  attr = root_node->first_attribute("module");
  if(!attr) { return NULL;}
  string modname = attr->value();

  size_t p1;
  string tstr;
  if((p1 = modname.find("EEDB::SPStream::")) != string::npos)  { tstr=modname; modname = tstr.substr(16); }
  if((p1 = modname.find("EEDB::SPStreams::")) != string::npos) { tstr=modname; modname = tstr.substr(17); }

  //massive if block now....but in the future maybe a directory of runtime linked plugins
  
  if(modname == "TemplateCluster")   { spstream = new EEDB::SPStreams::TemplateCluster(xml_node); }
  if(modname == "CollateExpression") { spstream = new EEDB::SPStreams::TemplateCluster(xml_node); }
  
  //OverlapCluster and OverlapMerge do the same thing, changed namecd 
  if(modname == "OverlapCluster")    { spstream = new EEDB::SPStreams::OverlapMerge(xml_node); } //OverlapMerge performs denovo clustering
  if(modname == "OverlapMerge")      { spstream = new EEDB::SPStreams::OverlapMerge(xml_node); } //OverlapMerge performs denovo clustering
  
  //OverlapFilter and TemplateFilter do the same thing
  if(modname == "TemplateFilter")    { spstream = new EEDB::SPStreams::TemplateFilter(xml_node); }
  if(modname == "OverlapFilter")     { spstream = new EEDB::SPStreams::TemplateFilter(xml_node); }
  
  if(modname == "Dummy")             { spstream = new EEDB::SPStreams::Dummy(xml_node); }
  if(modname == "MergeStreams")      { spstream = new EEDB::SPStreams::MergeStreams(xml_node); }
  if(modname == "FeatureEmitter")    { spstream = new EEDB::SPStreams::FeatureEmitter(xml_node); }
  if(modname == "ObjectCount")       { spstream = new EEDB::SPStreams::ObjectCount(xml_node); }
  if(modname == "Proxy")             { spstream = new EEDB::SPStreams::Proxy(xml_node); }
  if(modname == "SiteFinder")        { spstream = new EEDB::SPStreams::SiteFinder(xml_node); }
  if(modname == "DemultiplexSource") { spstream = new EEDB::SPStreams::DemultiplexSource(xml_node); }
  if(modname == "PairReads")         { spstream = new EEDB::SPStreams::PairReads(xml_node); }
  if(modname == "CAGECorrection")    { spstream = new EEDB::SPStreams::CAGECorrection(xml_node); }
  if(modname == "AppendExpression")  { spstream = new EEDB::SPStreams::AppendExpression(xml_node); }
  if(modname == "DumbBellToEdge")    { spstream = new EEDB::SPStreams::DumbBellToEdge(xml_node); }
  if(modname == "MergeEdges")        { spstream = new EEDB::SPStreams::MergeEdges(xml_node); }

  if(modname == "FederatedSourceStream")     { spstream = new  EEDB::SPStreams::FederatedSourceStream(xml_node); }
  if(modname == "CachePoint")                { spstream = new  EEDB::SPStreams::CachePoint(xml_node); }

  if(modname == "CutoffFilter")              { spstream = new  EEDB::SPStreams::CutoffFilter(xml_node); }
  if(modname == "CalcFeatureSignificance")   { spstream = new  EEDB::SPStreams::CalcFeatureSignificance(xml_node); }
  if(modname == "IDFilter")                  { spstream = new  EEDB::SPStreams::IDFilter(xml_node); }

  if(modname == "NormalizePerMillion")       { spstream = new  EEDB::SPStreams::NormalizePerMillion(xml_node); }
  if(modname == "CalcInterSubfeatures")      { spstream = new  EEDB::SPStreams::CalcInterSubfeatures(xml_node); }
  if(modname == "StreamSubfeatures")         { spstream = new  EEDB::SPStreams::StreamSubfeatures(xml_node); }
  if(modname == "UniqueFeature")             { spstream = new  EEDB::SPStreams::UniqueFeature(xml_node); }
  if(modname == "ResizeFeatures")            { spstream = new  EEDB::SPStreams::ResizeFeatures(xml_node); }
  if(modname == "ExpressionDatatypeFilter")  { spstream = new  EEDB::SPStreams::ExpressionDatatypeFilter(xml_node); }
  if(modname == "FeatureLengthFilter")       { spstream = new  EEDB::SPStreams::FeatureLengthFilter(xml_node); }
  if(modname == "EdgeLengthFilter")          { spstream = new  EEDB::SPStreams::EdgeLengthFilter(xml_node); }
  if(modname == "MakeStrandless")            { spstream = new  EEDB::SPStreams::MakeStrandless(xml_node); }
  if(modname == "TopHits")                   { spstream = new  EEDB::SPStreams::TopHits(xml_node); }
  if(modname == "NormalizeRPKM")             { spstream = new  EEDB::SPStreams::NormalizeRPKM(xml_node); }
  if(modname == "NormalizeByFactor")         { spstream = new  EEDB::SPStreams::NormalizeByFactor(xml_node); }
  if(modname == "DevNull")                   { spstream = new  EEDB::SPStreams::DevNull(xml_node); }
  if(modname == "StreamTKs")                 { spstream = new  EEDB::SPStreams::StreamTKs(xml_node); }
  if(modname == "FeatureRename")             { spstream = new  EEDB::SPStreams::FeatureRename(xml_node); }
  if(modname == "RenameExperiments")         { spstream = new  EEDB::SPStreams::RenameExperiments(xml_node); }
  if(modname == "RescalePseudoLog")          { spstream = new  EEDB::SPStreams::RescalePseudoLog(xml_node); }
  if(modname == "FilterSubfeatures")         { spstream = new  EEDB::SPStreams::FilterSubfeatures(xml_node); }
  if(modname == "StrandFilter")              { spstream = new  EEDB::SPStreams::StrandFilter(xml_node); }
  if(modname == "FlipStrand")                { spstream = new  EEDB::SPStreams::FlipStrand(xml_node); }
  
  if(modname == "Paraclu")                   { spstream = new  EEDB::SPStreams::Paraclu(xml_node); }
  if(modname == "NeighborCutoff")            { spstream = new  EEDB::SPStreams::NeighborCutoff(xml_node); }

  if(modname == "OverlapAnnotate")           { spstream = new  EEDB::SPStreams::OverlapAnnotate(xml_node); }
  if(modname == "MetadataFilter")            { spstream = new  EEDB::SPStreams::MetadataFilter(xml_node); }
  if(modname == "MetadataManipulate")        { spstream = new  EEDB::SPStreams::MetadataManipulate(xml_node); }

  if(modname == "MannWhitneyRanksum")        { spstream = new  EEDB::SPStreams::MannWhitneyRanksum(xml_node); }

  return spstream;
}


EEDB::SPStream::SPStream(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  // default super class method which does nothing. 
  // subclasses need only implement this method
  init();
}


void  EEDB::SPStream::get_proxies_by_name(string proxy_name, vector<EEDB::SPStream*> &proxies) {
  reset_stream_node();
  _funcptr_get_proxies_by_name(this, proxy_name, proxies);
}


//
// default stream API methods
//

void  EEDB::SPStream::_reset_stream_node() {
  _region_start   = -1;
  _region_end     = -1;
}

MQDB::DBObject* EEDB::SPStream::_next_in_stream() {
  if(source_stream() != NULL) { return source_stream()->next_in_stream(); }
  return NULL;
}

MQDB::DBObject* EEDB::SPStream::_fetch_object_by_id(string fid) {
  if(source_stream() != NULL) { return source_stream()->fetch_object_by_id(fid); }
  return NULL;
}

bool EEDB::SPStream::_fetch_features(map<string, EEDB::Feature*> &fid_hash) {
  if(source_stream() != NULL) { return source_stream()->fetch_features(fid_hash); }
  return false;
}

void EEDB::SPStream::_stream_clear() {
  if(source_stream() != NULL) { source_stream()->stream_clear(); }
}

bool EEDB::SPStream::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  if(source_stream() != NULL) { 
    return source_stream()->stream_by_named_region(assembly_name, chrom_name, start, end);
  }
  return false;
}

void EEDB::SPStream::_stream_features_by_metadata_search(string search_logic) {
  if(source_stream() != NULL) { source_stream()->stream_features_by_metadata_search(search_logic); }
}

void EEDB::SPStream::_stream_all_features() {
  if(source_stream() != NULL) { source_stream()->stream_all_features(); }
}

void EEDB::SPStream::_stream_data_sources(string classname, string filter_logic) {
  if(source_stream() != NULL) { source_stream()->stream_data_sources(classname, filter_logic); }
}

void EEDB::SPStream::_get_dependent_datasource_ids(map<string, bool> &source_ids) {
  if(source_stream() != NULL) { source_stream()->get_dependent_datasource_ids(source_ids); }
}

void EEDB::SPStream::_stream_chromosomes(string assembly_name, string chrom_name) {
  if(source_stream() != NULL) { source_stream()->stream_chromosomes(assembly_name, chrom_name); }
}

void EEDB::SPStream::_stream_edges(map<string, EEDB::Feature*> fid_hash, string search_logic) {
  if(source_stream() != NULL) { source_stream()->stream_edges(fid_hash, search_logic); }
}

void EEDB::SPStream::_stream_peers() {
  if(source_stream() != NULL) { source_stream()->stream_peers(); }
}

void EEDB::SPStream::_reload_stream_data_sources() {
  if(source_stream() != NULL) { source_stream()->reload_stream_data_sources(); }
}

void EEDB::SPStream::_disconnect() {
  if(source_stream() != NULL) { source_stream()->disconnect(); }
}

void EEDB::SPStream::_get_proxies_by_name(string proxy_name, vector<EEDB::SPStream*> &proxies) {
  if(source_stream() != NULL) { source_stream()->get_proxies_by_name(proxy_name, proxies); }
}



