
/* $Id: RemoteServerStream.h,v 1.28 2015/05/29 07:53:55 severin Exp $ */

/***

NAME - SPStreams::RemoteServerStream

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

#ifndef _EEDB_SPSTREAMS_RemoteServerStream_H
#define _EEDB_SPSTREAMS_RemoteServerStream_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/DataSource.h>
#include <EEDB/Configuration.h>
#include <EEDB/Collaboration.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/TrackCache.h>

using namespace std;
using namespace MQDB;

struct RSS_curl_buffer {
  char *memory;
  size_t size;
  size_t alloc_size;
};
size_t rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp);

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

namespace SPStreams {

  class RemoteServerStream : public EEDB::SPStreams::SourceStream {

  public:  //global class level
    static const char*  class_name;
    
    //class levels methods set global variables
    static void  set_current_user(EEDB::User *user); 
    static void  set_userDB(MQDB::Database *db);
    static void  set_stream_output(string output);
    static void  set_collaboration_filter(string collab);
    
  public:
    RemoteServerStream();           // constructor
   ~RemoteServerStream();           // destructor
    void init();                    // initialization method

    static EEDB::SPStreams::RemoteServerStream*  new_from_url(string url);
  
    void   display_info();
    string display_desc();
    string display_contents();

    EEDB::Peer*  master_peer();

    //setup methods
    void    server_url(string url);
        
    void    clear_filters();
    void    add_peer_id_filter(string id);
    void    add_object_id_filter(string id);
    void    add_source_id_filter(string id);
    void    add_source_name_filter(string name);
    void    set_experiment_searchlogic_filter(string search_logic);
    
    //source stream not used, this is the end source 'locally'
    EEDB::SPStream*  source_stream() { return NULL; }
    void             source_stream(EEDB::SPStream* value) { return; };

    //Configuration related methods (not streaming API)    
    Configuration*          fetch_config_by_uuid(EEDB::User* user, string uuid);
    vector<Configuration*>  fetch_configs_by_uuid_list(EEDB::User* user, string uuid_list);
    vector<Configuration*>  fetch_configs_by_metadata_search(string config_type, EEDB::User* user, string filter_logic, string collab, string sortmode, string sortorder);
    vector<Collaboration*>  fetch_collaborations(EEDB::User* user);

    //region-sequence (not streaming API)    
    string                  fetch_region_sequence(EEDB::User* user, string assembly_name, string chrom_name, long int start, long int end, string strand);
    
    //TrackCache mirroring methods
    void                    mirror_remote_trackcaches(string hashkey_list); //global level

  public:
    
  private:
    string                       _server_url;
    EEDB::Peer*                  _web_peer;
    map<string, bool>            _filter_object_ids;
    map<string, bool>            _filter_peer_ids;
    map<string, bool>            _filter_source_names;
    string                       _filter_experiment_searchlogic;
    long int                     _restream_start;
    string                       _region_assembly_name;
    string                       _region_chrom_name;

    EEDB::Peer*                  _remote_peer_from_xml(void *xml_node);

  private: //class level
    static EEDB::User*           _user;
    static MQDB::Database*       _userDB;
    static string                _stream_output;
    static string                _collaboration_filter;


  //used for callback functions, should not be considered open API
  public:
    void               _stream_peers();
    MQDB::DBObject*    _next_in_stream();
    void               _stream_data_sources(string classname, string filter_logic);
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    void               _disconnect_stream();
    void               _reload_stream_data_sources();

    void               _reset_stream_node();
    void               _stream_clear();
      
    void               _stream_features_by_metadata_search(string filter_logic);
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    void               _stream_chromosomes(string assembly_name, string chrom_name);
  
    void               _xml(string &xml_buffer);
    bool               _init_remote_server();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
