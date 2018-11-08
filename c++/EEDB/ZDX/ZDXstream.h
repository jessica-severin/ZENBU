/* $Id: ZDXstream.h,v 1.22 2016/04/05 08:40:26 severin Exp $ */

/****
NAME - EEDB::ZDX::ZDXstream

SYNOPSIS

DESCRIPTION

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

**************/


#ifndef _EEDB_ZDX_ZDXSTREAM_H
#define _EEDB_ZDX_ZDXSTREAM_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <zlib.h>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <ZDX/ZDXdb.h>

using namespace std;
using namespace MQDB;
using namespace ZDX;

namespace EEDB {
  
  class Peer;  //forward declaration to avoid include circle
  
  namespace ZDX {

    //object index
    typedef struct {
      int64_t    next_object_idx_table;  //offset to next object_idx in chain.
      int64_t    offset;                 //offset of this table for re-rewrite
      int64_t    start_idx;
      int64_t    idx_znode[16*1024];    //array of idx-offset-number to znode pointers
    } zdx_object_idx_table;
    
    //mdkey name index
    typedef struct {
      int64_t    znode_array_offset;  //offset to array of int64_t which point at znodes
      int32_t    array_size;
      char       mdkey[4];
    } zdx_mdkey;

    typedef struct {
      int64_t    offset;  //offset to this name_idx_table in the zdx file
      int64_t    next_name_idx_table;  //offset to next name_idx_table in chain
      zdx_mdkey  mdkeys[8192];
    } zdx_name_idx_table;
        
    
    //forward declaration to avoid include circle
    class ZDXsegment;  
    
    class ZDXstream : public EEDB::SPStreams::SourceStream {
      
    public: //API methods for user query
      //query interface, but also use superclass SourceStream and Stream APIs

      static const char*  class_name;
      
      ZDXstream();            // constructor
      ~ZDXstream();           // destructor
      void init();            // initialization method
      
      static ZDXstream*   new_from_url(string url);
    

    public: // API methods for building/augmenting new ZDXstream
      
      static ZDXstream*   create_new(string path);                                         
      static ZDXstream*   open(string path); // to open for append data
      //use SPStream::disconnect() to close handles, release locks

      ZDXdb*              zdxdb() { return _zdxdb; }
      
      //sources and peers
      void             add_datasource(EEDB::DataSource* source);
      void             add_peer(EEDB::Peer* peer);
      void             add_genome(EEDB::Assembly* assembly);  //for loading new genomes
      bool             write_source_section();
      EEDB::Peer*      self_peer();
      bool             genome_sequence_loaded();

      //chromosomes and segments
      int64_t         create_chrom(EEDB::Chrom* chrom);
      ZDXsegment*     claim_build_segment(EEDB::Chrom* chrom, long chrom_position); 
      bool            is_built(string assembly_name, string chrom_name, long start, long end); 
      EEDB::Chrom*    fetch_chrom(string asm_name, string chrom_name);
            
      //object indexing
      EEDB::Feature*         fetch_feature_by_id(int64_t feature_id);
      bool                   fetch_idx_table(int64_t idx_id, zdx_object_idx_table &idxtable, bool create);
      bool                   rewrite_idx_table(zdx_object_idx_table &idxtable);
      bool                   rebuild_feature_index();

      //feature name indexing
      bool                   fetch_filter_search_features(string filter_logic, EEDB::SPStreams::StreamBuffer *streambuffer);
      bool                   build_feature_name_index(); //all segment-znodes
      bool                   name_index_znode(int64_t znode_offset, zdxnode* znode);
      bool                   write_name_indexes();

    protected: //variables
      ZDXdb*                        _zdxdb;
      map<string, EEDB::Peer*>      _peers_cache;
      EEDB::ZDX::ZDXsegment*        _zsegment;
      EEDB::Peer*                   _self_peer;
      
      map<string, vector<int64_t> >    _mdkey_znodes;


    protected: //internal API below
      bool               _init_from_url(string url);

      
    public: //internal API used for callback functions, should not be considered protected API
      void               _disconnect();
      void               _stream_clear();
      void               _reset_stream_node();

      MQDB::DBObject*    _next_in_stream();
      MQDB::DBObject*    _fetch_object_by_id(string fid);
      
      void               _reload_stream_data_sources();
      void               _stream_data_sources(string classname, string filter_logic);
      void               _stream_peers();
      
      void               _stream_features_by_metadata_search(string filter_logic);
      bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
      void               _stream_chromosomes(string assembly_name, string chrom_name);
      
      void               _xml(string &xml_buffer);
      string             _display_desc();
    
      bool               _load_name_indexes(map<string, bool> &mdkeys);

    };
    
  };   //namespace ZDX
  
};   //namespace EEDB

#endif 
