
/* $Id: BigWigDB.h,v 1.3 2026/08/26 04:11:50 severin Exp $ */

/***

NAME - SPStream::SourceStreams::BigWigDB

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

#ifndef _EEDB_SPSTREAMS_BIGWIGDB_H
#define _EEDB_SPSTREAMS_BIGWIGDB_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <bigWig.h>
#include <EEDB/DataSource.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/ZenDB.h>

#undef max
#undef min

using namespace std;
using namespace MQDB;

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

namespace SPStreams {

class BigWigDB : public EEDB::SPStreams::ZenDB {
  public:  //global class level
    static const char*  class_name;

  public:
    BigWigDB();                    // constructor
   ~BigWigDB();                    // destructor
    void init();                // initialization method

    // create new BigWigDB from input file and set parameters
    string  create_new(string filepath);

    // connect to bigwigdb
    static EEDB::SPStreams::BigWigDB*  new_from_url(string url);

    // public API for tools
    EEDB::Experiment*   experiment();

    long                source_file_size();
    string              source_md5sum();
    bool                path_to_bigwig_file(string &path, string &filename);

    EEDB::Feature*      convert_wig_interval_to_feature(bwOverlappingIntervals_t *intervals, uint32_t idx, string chrom_name);
    void                add_metadata(bool value)    { _add_metadata = value; }
    void                add_subfeatures(bool value) { _add_subfeatures = value; }
    void                add_expression(bool value)  { _add_expression = value; }

  //internal API below
  protected:    
    bool                   _init_from_url(string url);
    bool                   _init_from_xmldb();
    bool                   _read_bigwig_info();
    bool                   _read_bigwig_header();
  
    bigWigFile_t*            _bw_fp;
    bwOverlapIterator_t*     _bw_iter;
    uint32_t                 _bw_iter_idx;
    string                   _region_chrom_name;
    EEDB::Datatype*          _datatype;
    
    //samfile_t*             _samlib_fp;
    //bam_iter_t             _samlib_iter;
    //bam1_t*                _samlib_bam_align;

    bool                   _region_set;
    bool                   _add_expression;
    bool                   _add_subfeatures;
    bool                   _add_metadata;
    EEDB::Experiment*      _primary_experiment;

  //internal API used for callback functions, should not be considered open API
  public:
    string             _display_desc();
    void               _stream_clear();
    void               _reset_stream_node();
    void               _disconnect();
    MQDB::DBObject*    _next_in_stream();
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    EEDB::Feature*     _fetch_feature_by_id(long int feature_id);
    void               _reload_stream_data_sources();
    void               _stream_data_sources(string classname, string filter_logic);
    void               _get_dependent_datasource_ids(map<string,bool> &source_ids);
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
  
  private:
    EEDB::Feature*     _next_feature();
    static bool        _libbigwig_bwInit;
    char               _bigwig_strand;
    void               _show_current_bw_iter();


};

};   //namespace SPStreams

};   //namespace EEDB


#endif
