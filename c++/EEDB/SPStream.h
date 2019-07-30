/* $Id: SPStream.h,v 1.33 2019/02/15 04:37:30 severin Exp $ */

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

#ifndef _EEDB_SPSTREAM_H
#define _EEDB_SPSTREAM_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Feature;  //forward reference
  
class SPStream : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

  public:
    SPStream();                // constructor
    SPStream(void *xml_node);  //constructor using a rapidxml <spstream> description
   ~SPStream();                // destructor
    void init();               // initialization method

    void display_info();
    string display_contents();

    void   unparse_eedb_id(string fid, string &uuid, long int &objID, string &objClass);

    EEDB::SPStream*  source_stream();
    void             source_stream(EEDB::SPStream* value);
    //sub outstream

    MQDB::DBObject*  next_in_stream();
    MQDB::DBObject*  fetch_object_by_id(string fid);
    bool             fetch_features(map<string, EEDB::Feature*> &fid_hash);
  
    //stream setup routines
    void             disconnect();
    void             stream_clear();
    bool             stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end); 
    void             stream_features_by_metadata_search(string search_logic);
    void             stream_all_features();
    void             stream_data_sources();
    void             stream_data_sources(string classname);
    void             stream_data_sources(string classname, string search_logic);
    void             stream_chromosomes(string assembly_name, string chrom_name);
    void             stream_edges(map<string, EEDB::Feature*> fid_hash);

    void             stream_peers();
    void             reload_stream_data_sources();
    void             reset_stream_node();
    
    //stream module creation from XML (rapidxml)
    static void      create_stream_from_xml(void *xml_node, SPStream* &head, SPStream* &tail);
    SPStream*        reverse_stream(SPStream* node);
    void             create_side_stream_from_xml(void *xml_node);
    void             get_proxies_by_name(string proxy_name, vector<EEDB::SPStream*> &proxies);
    void             get_dependent_datasource_ids(map<string, bool> &source_ids);

    EEDB::SPStream*  side_stream();
    void             side_stream(EEDB::SPStream* value);


  //private and protected internal section
  protected: //variables
    EEDB::SPStream*  _source_stream;
    string           _module_name;
    long int         _region_start, _region_end;
    EEDB::SPStream*  _side_stream;
    struct timeval   _starttime;
    bool             _debug;
    
    MQDB::DBObject* (*_funcptr_next_in_stream)(EEDB::SPStream* node);
    MQDB::DBObject* (*_funcptr_fetch_object_by_id)(EEDB::SPStream* node, string fid);
    bool            (*_funcptr_fetch_features)(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash);
    void            (*_funcptr_disconnect)(EEDB::SPStream* node);
    void            (*_funcptr_stream_clear)(EEDB::SPStream* node);
    bool            (*_funcptr_stream_by_named_region)(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end); 
    void            (*_funcptr_stream_features_by_metadata_search)(EEDB::SPStream* node, string search_logic);
    void            (*_funcptr_stream_all_features)(EEDB::SPStream* node);
    void            (*_funcptr_stream_data_sources)(EEDB::SPStream* node, string classname, string search_logic);
    void            (*_funcptr_stream_chromosomes)(EEDB::SPStream* node, string assembly_name, string chrom_name);
    void            (*_funcptr_stream_edges)(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash);
    void            (*_funcptr_stream_peers)(EEDB::SPStream* node);
    void            (*_funcptr_reload_stream_data_sources)(EEDB::SPStream* node);
    void            (*_funcptr_reset_stream_node)(EEDB::SPStream* node);
    void            (*_funcptr_get_proxies_by_name)(EEDB::SPStream* node, string name, vector<EEDB::SPStream*> &proxies);
    void            (*_funcptr_get_dependent_datasource_ids)(EEDB::SPStream* node, map<string, bool> &source_ids);

    static EEDB::SPStream* _xmlnode_create_spstream(void *xml_node);  //internal


  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    string _display_desc();
  
    MQDB::DBObject*   _next_in_stream();
    MQDB::DBObject*   _fetch_object_by_id(string fid);
    bool              _fetch_features(map<string, EEDB::Feature*> &fid_hash);
    void              _stream_clear();
    void              _reset_stream_node();
    bool              _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    void              _stream_features_by_metadata_search(string search_logic);
    void              _stream_all_features();
    void              _stream_data_sources(string classname, string filter_logic);
    void              _stream_dependent_data_sources();
    void              _stream_chromosomes(string assembly_name, string chrom_name);
    void              _stream_edges(map<string, EEDB::Feature*> fid_hash);
    void              _stream_peers();
    void              _reload_stream_data_sources();
    void              _disconnect();
    void              _get_proxies_by_name(string proxy_name, vector<EEDB::SPStream*> &proxies);
    void              _get_dependent_datasource_ids(map<string, bool> &source_ids);

};

};   //namespace

//default function prototypes
MQDB::DBObject* _spstream_default_next_in_stream_func(EEDB::SPStream* node);
MQDB::DBObject* _spstream_default_fetch_object_by_id_func(EEDB::SPStream* node, string fid);
void _spstream_default_stream_clear_func(EEDB::SPStream* node);
bool _spstream_default_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end);
void _spstream_default_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic);
void _spstream_default_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic);
void _spstream_default_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name);
void _spstream_default_stream_peers_func(EEDB::SPStream* node);
void _spstream_default_reload_stream_data_sources_func(EEDB::SPStream* node);
void _spstream_default_disconnect_func(EEDB::SPStream* node);
void _spstream_default_get_proxies_by_name(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies);
void _spstream_default_get_dependent_datasource_ids(EEDB::SPStream* node, map<string, bool> &source_ids);
void _spstream_default_stream_all_features_func(EEDB::SPStream* node);
bool _spstream_default_fetch_features_func(EEDB::SPStream* node, map<string, EEDB::Feature*> &fid_hash);
void _spstream_default_stream_edges_func(EEDB::SPStream* node, map<string, EEDB::Feature*> fid_hash);
void _spstream_default_reset_stream_node_func(EEDB::SPStream* node);
void _eedb_spstream_delete_func(MQDB::DBObject *obj);
void _eedb_spstream_xml_func(MQDB::DBObject *obj, string &xml_buffer);
void _eedb_spstream_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer);
string _eedb_spstream_display_desc_func(MQDB::DBObject *obj);

#endif
