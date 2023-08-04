/* $Id: SubfeaturesToEdges.h,v 1.7 2023/07/20 07:18:26 severin Exp $ */

/***

NAME - EEDB::SPStreams::SubfeaturesToEdges

SYNOPSIS

DESCRIPTION

Converts features (with subfeatures) to a Edge object(s). To ease loading and processing
for intra-chromosomal data. Pair data can be converted into a BED12 "dumb bell" where pair-feature1 is the 
first block and pair-feature2 is the last block and the distance of the pair is the edge connecting
the pairs.

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

#ifndef _EEDB_SPSTREAMS_SUBFEATURESTOEDGES_H
#define _EEDB_SPSTREAMS_SUBFEATURESTOEDGES_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <deque>
#include <EEDB/SPStream.h>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>
#include <EEDB/EdgeSource.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {
  
class SubfeaturesToEdges : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;
  
  public:
    SubfeaturesToEdges();                // constructor
    SubfeaturesToEdges(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~SubfeaturesToEdges();                // destructor
    void init();                     // initialization method

    string display_contents();

    void   add_subfeature_category_filter(string value) { _subfeat_filter_categories[value] = true; }    
    void   transfer_expression(bool value) { _transfer_expression = value; }
    void   transfer_metadata(bool value) { _transfer_metadata = value; }
    void   mode(string value) { _mode = value; }

  protected: 
    map<string,bool>             _subfeat_filter_categories;
    bool                         _transfer_expression;
    bool                         _transfer_metadata;
    string                       _mode;

    map<string, EEDB::EdgeSource*>     _dynamic_edgesource_hash;  //from fsrcID -> dynamic edge_source
    map<string, EEDB::DataSource*>     _sources_cache;
    EEDB::SPStreams::StreamBuffer*     _source_streambuffer;

    EEDB::Edge*                      _process_feature(EEDB::Feature* feature);
    EEDB::EdgeSource*                _dynamic_edge_source(EEDB::Feature* feature);
    EEDB::EdgeSource*                _dynamic_edge_source(EEDB::DataSource* source);
    void                             _cache_datasource(EEDB::DataSource* source);

  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);
    string             _display_desc();
    MQDB::DBObject*    _next_in_stream();
    void               _stream_clear();
    void               _reset_stream_node();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    void               _reload_stream_data_sources();
    void               _stream_data_sources(string classname, string filter_logic);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
