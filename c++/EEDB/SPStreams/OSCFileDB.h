
/* $Id: OSCFileDB.h,v 1.55 2019/02/27 09:04:53 severin Exp $ */

/***

NAME - SPStream::SourceStreams::OSCFileDB

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

#ifndef _EEDB_SPSTREAMS_OSCFILEDB_H
#define _EEDB_SPSTREAMS_OSCFILEDB_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/DataSource.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStream.h>
#include <EEDB/Tools/OSCFileParser.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

namespace SPStreams {

class OSCFileDB : public EEDB::SPStreams::SourceStream {
  public:  //global class level
    static const char*  class_name;

  public:
    OSCFileDB();                    // constructor
   ~OSCFileDB();                    // destructor
    void init();                    // initialization method

    static EEDB::SPStreams::OSCFileDB*  new_from_url(string url) {
      EEDB::SPStreams::OSCFileDB*   osc = new EEDB::SPStreams::OSCFileDB();
      if(osc->_init_from_url(url)) { return osc; }
      delete osc;
      return NULL;
    }

    string   create_db_for_file(string filepath);
    void     set_parameter(string tag, string value);  //external parameters used for creation
    string   error_message();
    bool     repair();

    EEDB::Peer*        peer(); //primary "self" peer fetched from internal sqlite or xml
    void               peer(EEDB::Peer *peer);  //for initialization from a Peer
    MQDB::Database*    database();  //override
    void               database(MQDB::Database* db) { return; }  //override not allowed to set externally

    EEDB::Tools::OSCFileParser*        oscfileparser();

    map<string, EEDB::DataSource*>     data_sources_cache();
    void                               free_sources_cache();

    string                             assembly_name();
    const char*                        peer_uuid();
    
    long long int                      current_seek_pos() { return _data_current_seek_pos; }

    bool                               upgrade_db();
    bool                               build_feature_md_index();
    bool                               save_xmldb();
    int                                oscdb_version() { return _version; }
    long                               source_file_size();
    string                             source_md5sum();

  //internal API below
  protected:    
    string                      _oscdb_dir;
    EEDB::Peer*                 _self_peer;

    EEDB::Tools::OSCFileParser* _oscfileparser;
    bool                        _parser_initialized;
    t_outputmode                _outmode;

    int                         _ridx_fd;
    int                         _cidx_fd;
    int                         _efidx_fd;
    int                         _data_fd;
    char*                       _data_buffer;
    char*                       _data_line_ptr;
    char*                       _data_line_end;
    char*                       _data_bufend;
    long long int               _data_current_seek_pos;
    string                      _stream_chrom;
    long int                    _stream_start;
    long int                    _stream_end;
    EEDB::Feature*              _stream_next_feature;
    map<string,string>          _parameters;  //used when building new OSCDB
    long int                    _chunk_size;
    vector<void*>               _chrom_indexes;  //pointers to malloced chunkindex_t records from cidx file
    int                         _version;
    time_t                      _modify_time;
    map<long int,bool>          _fsrc_filter_ids;
    map<long int,bool>          _exp_filter_ids;
    string                      _error_msg;
    long long int               _data_buffer_size;
    MQDB::Database*             _feature_md_sqlite;

    void               _add_to_sources_cache(vector<MQDB::DBObject*> &sources);
    bool               _init_from_url(string url);
    void               _init_from_xmldb();
    void               _init_from_sqlite();
    bool               _peer_from_xml_file();
    bool               _connect_to_files();
    void               _close_files();
    bool               _prepare_data_file(string path);
    bool               _create_oscdb_dir();
    bool               _sort_input_file(string path);
    bool               _build_indexes();
    bool               _save_xml();
    bool               _region_index_sqlite(string assembly_name, string chrom_name, long int start, long int end);
    bool               _region_index_cidx(string assembly_name, string chrom_name, long int start, long int end);
    void               _copy_self_to_deploy_dir();
    bool               _create_edge_osc_filedb();
    bool               _build_edge_indexes();
    map<string, vector<EEDB::Feature*> > _load_edgelink_feature_hash(EEDB::FeatureSource* fsrc, string link_key);

  public:  //public for now for development
    bool               _seek_to_datarow(long int obj_id);
    long long int      _get_datarow_offset(long int obj_id);
    bool               _prepare_next_line();
    void               test_stream();
    bool               _seek_to_edge_min_feature_id(long int min_f1id, long int min_f2id);


  //internal API used for callback functions, should not be considered open API
  public:
    string             _display_desc();
    void               _disconnect();
    void               _stream_clear();
    void               _reset_stream_node();
    void               _stream_peers();
    MQDB::DBObject*    _next_in_stream();
    void               _stream_data_sources(string classname, string filter_logic);
    void               _get_dependent_datasource_ids(map<string,bool> &source_ids);
    void               _reload_stream_data_sources();
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    EEDB::Feature*     _fetch_feature_by_id(long int feature_id);
    EEDB::Edge*        _fetch_edge_by_id(long int edge_id);
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    void               _stream_all_features();
    bool               _fetch_features(map<string, EEDB::Feature*> &fid_hash);
    void               _stream_edges(map<string, EEDB::Feature*> fid_hash);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
