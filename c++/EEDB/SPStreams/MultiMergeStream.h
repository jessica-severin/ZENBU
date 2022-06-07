
/* $Id: MultiMergeStream.h,v 1.21 2020/03/02 08:26:32 severin Exp $ */

/***

NAME - SPStream::MultiMergeStream

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

#ifndef _EEDB_SPSTREAMS_MULTIMERGESTREAM_H
#define _EEDB_SPSTREAMS_MULTIMERGESTREAM_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/DataSource.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/SourceStream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

typedef enum {MSE_FEATURE, MSE_EXPRESS, MSE_OTHER}  _mse_object_class;

namespace SPStreams {

class MultistreamElement  {
  public:
    EEDB::SPStream      *stream;
    MQDB::DBObject      *current_object;
    _mse_object_class   object_class;
    long int            input_stream_count;
    bool                stream_is_empty;
    bool                stream_is_source;
    MultistreamElement  *next;
    MultistreamElement  *prev;

  public:
    MultistreamElement();                    // constructor

    bool operator<(const EEDB::SPStreams::MultistreamElement& b);
};


class MultiMergeStream : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    MultiMergeStream();                    // constructor
    MultiMergeStream(MQDB::Database *db);  // constructor
   ~MultiMergeStream();                    // destructor
    void init();                           // initialization method

    void   display_info();
    string display_desc();
    string display_contents();

    void   add_stream(EEDB::SPStream* stream);  //streams to be merged
    void   add_sourcestream(EEDB::SPStreams::SourceStream* stream);  //if a sourcestream then enables exteneded API
    
    void   clear_sourcestream_filters();
    void   add_source_id_filter(string id);
    void   add_expression_datatype_filter(EEDB::Datatype* datatype);
    void   set_sourcestream_output(string value);

  //internal API below
  protected:
    vector<EEDB::SPStreams::MultistreamElement*>   _sourcestreams;
    void                                           _resort_active_streams();
    void                                           _init_active_streams();
    EEDB::SPStreams::MultistreamElement           *_active_sourcestreams;


  //internal API used for callback functions, should not be considered open API
  public:
    void               _disconnect();
    void               _reset_stream_node();
    void               _stream_clear();
    void               _stream_peers();
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    MQDB::DBObject*    _next_in_stream();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    //void               _stream_by_chrom(string assembly_name, string chrom_name);
    void               _stream_chromosomes(string assembly_name, string chrom_name);
    void               _stream_features_by_metadata_search(string search_logic);
    void               _stream_data_sources(string classname, string filter_logic);
    void               _get_dependent_datasource_ids(map<string,bool> &source_ids);
    void               _reload_stream_data_sources();
    void               _get_proxies_by_name(string proxy_name, vector<EEDB::SPStream*> &proxies);
    void               _stream_edges(map<string, EEDB::Feature*> fid_hash, string filter_logic);
    bool               _fetch_features(map<string, EEDB::Feature*> &fid_hash);
    void               _stream_all_features();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
