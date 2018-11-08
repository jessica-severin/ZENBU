/* $Id: Dummy.cpp,v 1.14 2014/11/25 09:35:16 severin Exp $ */

/***

NAME - EEDB::SPStreams::Dummy

SYNOPSIS

DESCRIPTION

a simple SPStream which does nothing and always returns a NULL object

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
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>

using namespace std;
using namespace MQDB;

const char*               EEDB::SPStreams::Dummy::class_name = "EEDB::SPStreams::Dummy";

//dummy functions which deactivate stream operations
MQDB::DBObject* _spstream_dummy_next_in_stream_func(EEDB::SPStream* node) { return NULL; }
MQDB::DBObject* _spstream_dummy_fetch_object_by_id_func(EEDB::SPStream* node, string fid) { return NULL; }
void _spstream_dummy_stream_clear_func(EEDB::SPStream* node) {}
bool _spstream_dummy_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) { return true;}
void _spstream_dummy_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {}
void _spstream_dummy_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {}
void _spstream_dummy_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {}
void _spstream_dummy_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {}
void _spstream_dummy_stream_peers_func(EEDB::SPStream* node) {}
void _spstream_dummy_reload_stream_data_sources_func(EEDB::SPStream* node) {}
void _spstream_dummy_disconnect_func(EEDB::SPStream* node) {}
void _spstream_dummy_reset_stream_node_func(EEDB::SPStream* node) {}
void _spstream_dummy_get_proxies_by_name(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies) {}

EEDB::SPStreams::Dummy::Dummy() {
  init();
}

EEDB::SPStreams::Dummy::~Dummy() {
}

void _spstream_dummy_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::Dummy*)obj;
}

void EEDB::SPStreams::Dummy::init() {
  EEDB::SPStream::init();
  _classname      = EEDB::SPStreams::Dummy::class_name;
  _module_name    = "Dummy";
  _funcptr_delete = _spstream_dummy_delete_func;

  _source_stream  = NULL;
  
  //function pointer code
  _funcptr_next_in_stream                     = _spstream_dummy_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_dummy_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_dummy_disconnect_func;
  _funcptr_stream_clear                       = _spstream_dummy_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_dummy_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_dummy_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_dummy_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_dummy_get_dependent_datasource_ids_func;
  _funcptr_stream_chromosomes                 = _spstream_dummy_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_dummy_stream_peers_func;
  _funcptr_reload_stream_data_sources         = _spstream_dummy_reload_stream_data_sources_func;
  _funcptr_reset_stream_node                  = _spstream_dummy_reset_stream_node_func;
  _funcptr_get_proxies_by_name                = _spstream_dummy_get_proxies_by_name;

}

void EEDB::SPStreams::Dummy::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::Dummy::display_desc() {
  return "Dummy";
}

string EEDB::SPStreams::Dummy::display_contents() {
  return display_desc();
}



////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
////////////////////////////////////////////////////////////////////////////

EEDB::SPStreams::Dummy::Dummy(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  // does nothing for Dummy
  init();
}

