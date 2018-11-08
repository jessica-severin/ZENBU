
/* $Id: ZenDB.h,v 1.7 2013/04/08 07:36:16 severin Exp $ */

/***

NAME - SPStream::SourceStreams::ZenDB

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

#ifndef _EEDB_SPSTREAMS_ZENDB_H
#define _EEDB_SPSTREAMS_ZENDB_H

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

class ZenDB : public EEDB::SPStreams::SourceStream {
  public:  //global class level
    static const char*  class_name;

  public:
    ZenDB();                    // constructor
   ~ZenDB();                    // destructor
    void init();                    // initialization method

    static EEDB::SPStreams::ZenDB*  new_from_url(string url);
  
    string             create_new(string filepath);
    void               set_parameter(string tag, string value); //external parameters used for creation

    EEDB::Peer*        peer(); //primary "self" peer fetched from internal sqlite or xml
    void               peer(EEDB::Peer *peer);  //for initialization from a Peer
    const char*        peer_uuid();
    string             db_url();
  
    MQDB::Database*    database();  //override
    void               database(MQDB::Database* db) { return; }  //override not allowed to set externally

    void                               set_assembly(EEDB::Assembly* assembly);
    EEDB::Assembly*                    assembly();
    string                             assembly_name();
    
    bool                               save_xmldb();

  //internal API below
  protected:    
    string                               _zendb_dir;
    EEDB::Peer*                          _self_peer;
    map<string, EEDB::Peer*>             _peers_cache;

    map<string,string>                   _parameters;  //used when building new OSCDB
    int                                  _version;
    time_t                               _modify_time;
    bool                                 _initialized;
    string                               _db_type;
    bool                                 _load_source_metadata;
  
    EEDB::Assembly*                      _default_assembly;
    EEDB::FeatureSource*                 _primary_source;
    map<string, EEDB::FeatureSource*>    _category_featuresources;
    int                                  _create_source_id;

    string             _create_new(string filepath);
    bool               _init_from_url(string url);
    void               _full_initialize();
    bool               _init_from_xmldb();
    void               _init_from_sqlite();
    bool               _peer_from_xml_file();
    bool               _prepare_data_file(string path);
    bool               _create_db_dir();
    bool               _save_xml();
    void               _copy_self_to_deploy_dir();
    void               _zendb_xml(string &xml_buffer);
  
    // to aid subclasses in loading/creation process
    EEDB::FeatureSource*       _primary_featuresource();
    EEDB::FeatureSource*       _get_category_featuresource(string category);
    EEDB::Chrom*               _get_chrom(const char* chrom_name);  
    EEDB::Experiment*          _create_experiment();
    void                       _create_subfeature(EEDB::Feature *feature, string category, long int bidx, long int bstart, long int bsize);



  //internal API used for callback functions, should not be considered open API
  public:
    string             _display_desc();
    void               _disconnect();
    void               _stream_clear();
    void               _reset_stream_node();
    void               _stream_peers();
    MQDB::DBObject*    _next_in_stream();
    void               _stream_data_sources(string classname, string filter_logic);
    void               _reload_stream_data_sources();
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    EEDB::Feature*     _fetch_feature_by_id(long int feature_id);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
