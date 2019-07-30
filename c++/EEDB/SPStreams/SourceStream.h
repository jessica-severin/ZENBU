
/* $Id: SourceStream.h,v 1.31 2017/07/25 06:35:41 severin Exp $ */

/***

NAME - SPStream::SourceStream

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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

#ifndef _EEDB_SPSTREAMS_SOURCESTREAM_H
#define _EEDB_SPSTREAMS_SOURCESTREAM_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/Datatype.h>
#include <EEDB/DataSource.h>
#include <EEDB/Assembly.h>
#include <EEDB/SPStream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

namespace SPStreams {

class SourceStream : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    SourceStream();                    // constructor
    SourceStream(MQDB::Database *db);  // constructor
   ~SourceStream();                    // destructor
    void init();                       // initialization method

    void   display_info();
    string display_desc();
    string display_contents();

    void   clear_sourcestream_filters();
    void   add_source_id_filter(string id);
    void   add_expression_datatype_filter(EEDB::Datatype* datatype);
    void   set_sourcestream_output(string value);

    map<string, EEDB::DataSource*>     data_sources_cache();
    void                               free_sources_cache();
    EEDB::DataSource*                  get_datasource(string dbid);

  protected:
    map<string, EEDB::DataSource*>     _sources_cache;
    bool                               _source_is_active;
    bool                               _sources_cache_loaded;
    vector<EEDB::Assembly*>            _assembly_cache;
    bool                               _assembly_loaded;
    int                                _disconnect_count;
    bool                               _stream_is_datasource_filtered;
    map<string, bool>                  _filter_source_ids, _filter_exp_ids, _filter_fsrc_ids;
    string                             _sourcestream_output;
    map<string, EEDB::Datatype*>       _expression_datatypes;

    void                               _add_to_sources_cache(vector<MQDB::DBObject*> &sources);
    void                               _add_datasource(EEDB::DataSource* source);


  //used for callback functions, should not be considered open API
  public:
    void               _disconnect();
    void               _stream_clear();
    void               _stream_peers();
    MQDB::DBObject*    _next_in_stream();
    void               _stream_data_sources(string classname, string filter_logic);
    void               _get_dependent_datasource_ids(map<string,bool> &source_ids);
    void               _reload_stream_data_sources();
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    void               _stream_features_by_metadata_search(string filter_logic);
    void               _reset_stream_node();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    void               _stream_chromosomes(string assembly_name, string chrom_name);
    void               _stream_all_features();
    bool               _fetch_features(map<string, EEDB::Feature*> &fid_hash);
    void               _stream_edges(map<string, EEDB::Feature*> fid_hash);

    void               _xml(string &xml_buffer);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
