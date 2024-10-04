/* $Id: GapFilterAnnotate.h,v 1.3 2024/03/11 08:00:10 severin Exp $ */

/***

NAME - EEDB::SPStreams::GapFilterAnnotate

SYNOPSIS

DESCRIPTION
  
  A complex module designed to analyzed "gapped" protocols like PARIS2 or RADICL-seq.
  Performs a combination filtering, categorizing and labeling in a single step.
  Uses an optional side stream with known transcript annotations like GENCODE.
 
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

#ifndef _EEDB_SPSTREAMS_GAPFILTERANNOTATE_H
#define _EEDB_SPSTREAMS_GAPFILTERANNOTATE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/MergeStreams.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class GapFilterAnnotate : public EEDB::SPStreams::MergeStreams {
  public:  //global class level
    static const char*  class_name;
  
  public:
    GapFilterAnnotate();                // constructor
    GapFilterAnnotate(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~GapFilterAnnotate();                // destructor
    void init();                        // initialization method
    
    void  min_gap_length(long value);

    void  overlap_mode(string value)                    { _overlap_mode = value; }
    void  ignore_strand(bool value)                     { _ignore_strand = value; }
    void  overlap_distance(long int value)              { _overlap_distance = value; }
    void  skip_unannotated(bool value)                  { _skip_unannotated = value; }
    void  inverse(bool value)                           { _inverse = value; }
    
    void clear_annotation_mdtypes();
    void add_annotation_mdtype(string type);


  protected:
    long int         _min_gap_length;
    string           _overlap_mode;
    bool             _ignore_strand;
    long int         _overlap_distance;
    bool             _overlap_check_subfeatures;
    bool             _skip_unannotated;
    bool             _inverse;

    enum { FEATURE, FEATURESOURCE, EXPERIMENT, ALL }  _mdset_mode;
    vector<string>                                    _annotation_mdtypes;
    
  private:
    bool                         _side_stream_primed;
    bool                         _side_stream_empty;
    deque<EEDB::Feature*>        _side_stream_buffer;

    bool                         _gap_analyze_feature(EEDB::Feature *feature);

    deque<EEDB::Feature*>        _calc_gaps(EEDB::Feature* feature);
    map<string,bool>             _subfeat_filter_categories;
    EEDB::FeatureSource*         _new_subfeature_source;   

    bool                         _overlap_check(EEDB::Feature *feature, EEDB::Feature *cluster);
    EEDB::Feature*               _extend_side_stream_buffer();
  
    void                         _transfer_metadata(EEDB::Feature *feature, EEDB::Feature *sidefeature);
    void                         _transfer_metadata(EEDB::Feature *feature, EEDB::MetadataSet *mdset);

  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*        _next_in_stream();
    void                   _reset_stream_node();
    void                   _xml(string &xml_buffer);
    string                 _display_desc();
    bool                   _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
        

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
