
/* $Id: FederatedSourceStream.h,v 1.23 2015/01/22 05:01:11 severin Exp $ */

/***

NAME - SPStreams::FederatedSourceStream

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

#ifndef _EEDB_SPSTREAMS_FEDERATEDSOURCESTREAM_H
#define _EEDB_SPSTREAMS_FEDERATEDSOURCESTREAM_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/DataSource.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

namespace SPStreams {

class FederatedSourceStream : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    FederatedSourceStream();                // constructor
    FederatedSourceStream(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~FederatedSourceStream();                // destructor
    void init();                            // initialization method

    void   display_info();
    string display_desc();
    string display_contents();

    //configuration methods
    void    allow_full_federation_search(bool value);
    void    clone_peers_on_build(bool value);

    void    add_seed_peer(EEDB::Peer* peer);
    void    clear_seed_peers();
    void    set_peer_search_depth(int value);
    
    void    add_peer_id_filter(string id);
    void    add_object_id_filter(string id);
    void    clear_source_filters();
    void    add_source_id_filter(string id);
    void    add_source_name_filter(string name);
    void    set_experiment_searchlogic_filter(string search_logic);
    void    add_expression_datatype_filter(EEDB::Datatype* datatype);
    void    set_sourcestream_output(string value);

    //meta-method which does all configuration with logic search
    void configure_with_source_search(string search_logic);
    
    //source stream not used
    EEDB::SPStream*  source_stream() { return NULL; }
    void             source_stream(EEDB::SPStream* value) { return; };

    void             get_peers(map<string, EEDB::Peer*> &uuid_peers);

  private:
    vector<EEDB::Peer*>          _seed_peers;
    bool                         _clone_peers_on_build;
    vector<EEDB::Peer*>          _cloned_peers;
    bool                         _allow_full_federation_search;
    map<string, bool>            _filter_source_ids;
    map<string, bool>            _filter_object_ids;
    map<string, bool>            _filter_peer_ids;
    map<string, bool>            _filter_source_names;
    string                       _filter_experiment_searchlogic;
    int                          _peer_search_depth;
    string                       _sourcestream_output;
    map<string, EEDB::Datatype*> _expression_datatypes;

    vector<EEDB::Peer*>    _get_peers();
    EEDB::Peer*            _find_peer(string uuid);

    EEDB::SPStreams::MultiMergeStream*  _build_unfiltered_stream();


  //used for callback functions, should not be considered open API
  public:
    EEDB::SPStream*    _build_source_stream();
    void               _reset_stream_node();
    void               _stream_clear();
    void               _stream_peers();
    MQDB::DBObject*    _next_in_stream();
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    void               _disconnect_stream();

    void               _xml(string &xml_buffer);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
