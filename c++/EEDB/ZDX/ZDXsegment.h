/* $Id: ZDXsegment.h,v 1.46 2016/11/11 09:08:38 severin Exp $ */

/****
NAME - EEDB::ZDX::ZDXsegment

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


#ifndef _EEDB_ZDX_ZDXSEGMENT_H
#define _EEDB_ZDX_ZDXSEGMENT_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <zlib.h>
#include <MQDB/DBObject.h>
#include <EEDB/Chrom.h>
#include <EEDB/ChromChunk.h>
#include <EEDB/Tools/ResortBuffer.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <ZDX/ZDXdb.h>

using namespace std;
using namespace MQDB;
using namespace ZDX;

namespace EEDB {
  
  class Peer;  //forward declaration to avoid include circle
  
  namespace ZDX {
    class ZDXstream; //forward declaration
    
    typedef struct {
      int32_t  chrom_start;
      int32_t  chrom_end;
      int64_t  znode;          //64bit file offset to first zdxnode containing data of this segment
    } zdx_chrom_segment;
    
    typedef struct {
      int64_t    segments_offset;  //offset to segments array. build complete array when create chrom
      int64_t    outlier_znodes;   //offset znode array of features which do not fall nicely into segments
      int32_t    segment_size;
      int32_t    chrom_length;
      char       name[64];
      char       ncbi_accession[32];
      char       refseq_accession[32];
      char       ncbi_name[32];
      char       name_alt1[32];
      char       reserved[40];
    } zdx_chrom; //256bytes
    
    typedef struct {
      int64_t    next_chrom_table;  //offset to next chrom_table in chaing. read all
      char       assembly_name[64];
      char       ncbi_accession[32];
      char       reserved[152];     //... maybe other assembly attributes
      zdx_chrom  chroms[32];
    } zdx_chrom_table;
    
    class ZDXsegment : public MQDB::DBObject {
      
    public: //API methods for user query
      //query interface, but also use superclass SourceStream and Stream APIs

      static const char*  class_name;
      
      ZDXsegment();             // constructor
      ZDXsegment(ZDXdb* zdxdb); // constructor
      ~ZDXsegment();            // destructor
      void init();              // initialization method
                
      static ZDXsegment*  new_at_position(ZDXdb* zdxdb, EEDB::Chrom* chrom, long chrom_position); 
            // constructor for creating/access a segment, used for both building and queries of ZDXsegment
            // if chrom/segments does not exist, it will be created

      static ZDXsegment*  fetch(ZDXdb* zdxdb, string asm_name, string chrom_name, long chrom_position);
            //object constructor for accessing a segment, used for queries of ZDXsegment
      
      static ZDXsegment*  unbuilt_segment(ZDXdb* zdxdb, string assembly_name, string chrom_name, long start, long end);
            //search the region specified (or entire zdx) for a series of unbuilt segments

      static vector<ZDXsegment*>   fetch_claimed_segments(ZDXdb* zdxdb);
            //get all the currently claimed/building segments
            //used fo analyzing for failed builders and reseting of claims

      static vector<EEDB::Chrom*>  fetch_all_chroms(ZDXdb* zdxdb);
      static EEDB::Chrom*          fetch_chrom(ZDXdb* zdxdb, string asm_name, string chrom_name);
      static long                  num_chroms(ZDXdb* zdxdb);
      static double                calc_percent_completed(ZDXdb* zdxdb, bool show);
      static vector<EEDB::Chrom*>  unbuilt_chroms(ZDXdb* zdxdb);
      static void                  build_stats(ZDXdb* zdxdb, string assembly_name, string chrom_name, long start, long end,
                                               long &numsegs, long &numbuilt, long &numclaimed, long &seg_start);

      static void                  reset_failed_claims(ZDXdb* zdxdb);

      ZDXsegment*   next_segment();  //returns next segment in order after this one
      bool          init_next_segment(); //re-initializes segment to be the one after this one
      ZDXsegment*   prev_segment();  //returns previous segment in order before this one
      ZDXsegment*   first_segment(); //first segment of this chrom
      

      string        assembly_name();
      string        chrom_name();
      long          chrom_start();
      long          chrom_end();
      long          segment_size();
      EEDB::Chrom*  chrom();
      ZDXdb*        zdxdb();
      
      //streaming features out of segment
      bool             stream_region(long int start, long int end);  //preps segment for feature streaming;
      MQDB::DBObject*  next_in_stream();

      //ZDX binary syncing
      void             binary_sync_send(FILE* fp);
      bool             binary_sync_receive(char* chunk_data, long chunk_size);
      
      long test_next_znode();
      bool znode_stats();

    public: // API methods for building/augmenting new ZDXsegment
      void  add_sorted_feature(EEDB::Feature* feature);  //features will be added in sorted order
      void  add_unsorted_feature(EEDB::Feature* feature);
      bool  add_chrom_chunk(EEDB::ChromChunk* chunk);
      bool  reclaim_for_appending(); //used for unsorted loading
      bool  write_segment_features();
      bool  write_build_complete(); //flips the claim to built

      static void  finish_build(ZDXdb* zdxdb);

      
      //for tracking features which extend beyond borders of segment. 
      //chrom_end should represent farthest extent of features in this segment
      bool  extend_chrom_end(long chrom_end);  
      
      //chromosomes and segments
      int64_t         create_chrom(EEDB::Chrom*);
      bool            claim_segment();  //for parallel building
      bool            clear_claim();    //'garbage' clean up of failed building
      void            show_chrom_segments();

      bool            reload();
      bool            is_built();
      bool            is_claimed();
      
      //builder stats
      string          builder_host();
      pid_t           builder_pid();
      double          build_time_msec();
      double          build_starttime();
      double          build_endtime();
      
      ZDXstream*      zdxstream() { return _zdxstream; }
      void            zdxstream(ZDXstream* obj) { _zdxstream = obj; }

    protected: //variables
      ZDXdb*                         _zdxdb;
      ZDXstream*                     _zdxstream;
      zdx_chrom_table                _zchrom_table;
      zdx_chrom*                     _zchrom;
      EEDB::Chrom*                   _chrom;
      zdx_chrom_segment              _zsegment;
      int64_t                        _segment_offset; //for updating znode
      int64_t                        _zchrom_offset;  //for updating zchrom
      EEDB::Tools::ResortBuffer      _feature_buffer;
      vector<EEDB::Feature*>         _outlier_buffer;
      string                         _output_buffer;
      int64_t                        _last_znode; //for writing
      int64_t                        _last_outlier_znode; //for writing
      int64_t                        _next_znode; //for reading
      long int                       _region_start, _region_end;
      EEDB::SPStreams::StreamBuffer* _streambuffer;
      struct timeval                 _seg_starttime;
      string                         _build_host;
      pid_t                          _build_pid;
      double                         _build_time;
      double                         _build_start;
      double                         _build_end;

      
    protected: //internal API below
      bool      _init_segment(string asm_name, string chrom_name, int64_t position);
      bool      _create_segments_array(zdx_chrom &zchrom);
      bool      _znode_append_features(bool check);
      bool      _load_next_znode();
      void      _load_builder_stats();

    public: //internal API used for callback functions, should not be considered protected API
      void               _xml(string &xml_buffer);
      string             _display_desc();

      static char*  _compress_buffer;
      static long   _compress_buflen;

    };
    
  };   //namespace ZDX
  
};   //namespace EEDB

#endif 
