/* $Id: PairReads.h,v 1.3 2020/04/20 02:04:09 severin Exp $ */

/***

NAME - EEDB::SPStreams::PairReads

SYNOPSIS

DESCRIPTION

 a signal-processing-stream implementaion of the FANTOM3-style window based clustering
 Since the algorithm just uses local infomation, one can implement in a very direct way
 using storted streams.  This SPStream requires a positionally sorted stream of features
 or expression objects. And it will return a stream of Features possibly with expressions
 attached to them

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

#ifndef _EEDB_SPSTREAMS_PAIRREADS_H
#define _EEDB_SPSTREAMS_PAIRREADS_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <deque>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class PairReads : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    PairReads();                // constructor
    PairReads(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~PairReads();                // destructor
    void init();                      // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    void  distance(long value);
    void  ignore_strand(bool value);
    void  output_unpaired(bool value);
    void  sam_md_checks(bool value);
    void  min_length(long value);
    void  max_length(long value);

  protected:
    bool       _ignore_strand;
    bool       _output_unpaired;
    bool       _sam_md_checks;
    long       _distance;
    long       _min_length;
    long       _max_length;
  
    map<string, EEDB::Feature*>        _feature_buffer;

    map<string, EEDB::DataSource*>     _sources_cache;
    EEDB::SPStreams::StreamBuffer*     _source_streambuffer;
    map<string, EEDB::EdgeSource*>     _dynamic_edgesource_hash; //from fsrcID -> dynamic edge_source

    EEDB::Edge*                  _process_object(MQDB::DBObject* obj);
    EEDB::Edge*                  _test_build_pair(EEDB::Feature* feature1);
    void                         _cache_datasource(EEDB::DataSource* source);
    EEDB::EdgeSource*            _dynamic_edgesource_for(EEDB::DataSource *source);
  
  private:

  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*    _next_in_stream();
    void               _reset_stream_node();
    void               _stream_clear();
    void               _xml(string &xml_buffer);
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    
    void               _reload_stream_data_sources();
    void               _stream_data_sources(string classname, string filter_logic);

    
};

};   //namespace SPStreams

};   //namespace EEDB


#endif
