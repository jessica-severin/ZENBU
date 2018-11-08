/* $Id: ResortBuffer.h,v 1.13 2014/10/24 08:30:15 severin Exp $ */

/***

NAME - EEDB::Tools::ResortBuffer

SYNOPSIS

DESCRIPTION

 works on features with subfeatures. generates "intron" category objects 
 between "exon" category objects
 
CONTACT

Jessica Severin <severin@gsc.riken.jp> <jessica.severin@gmail.com>

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

#ifndef _EEDB_TOOLS_RESORTBUFFER
#define _EEDB_TOOLS_RESORTBUFFER

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/TemplateCluster.h>

using namespace std;
using namespace MQDB;
using namespace EEDB::SPStreams;

namespace EEDB {

namespace Tools {  
  
class ResortBuffer : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;
  
  public:
    ResortBuffer();                // constructor
   ~ResortBuffer();                // destructor
    void init();                   // initialization method
    void init_xml(void *xml_node); // initialize using a rapidxml <spstream> description
    void reset();                  // reset tool to initial state
  
    void             insert_feature(EEDB::Feature* feature);
    EEDB::Feature*   next_completed_feature();
    void             transfer_all_to_completed();
    void             transfer_completed(long chrom_start);
    long             completed_buffer_size();
  
    FeatureLink*     buffer_start() { return _feature_buffer_start; }
    FeatureLink*     buffer_end()   { return _feature_buffer_end; }
    void             remove_link(FeatureLink *flink);

    // unique control code
    void                     unique_features(bool value) { _unique_features = value; }
    void                     match_category(bool value) { _match_category = value; }
    void                     match_source(bool value) { _match_source = value; }
    void                     match_strand(bool value) { _match_strand = value; }
    void                     match_subfeatures(bool value) { _match_subfeatures = value; }
    void                     expression_mode(t_collate_express_mode value) { _expression_mode = value; }
  
    bool                     unique_features() { return _unique_features; }
    bool                     match_category() { return _match_category; }
    bool                     match_source() { return _match_source; }
    bool                     match_strand() { return _match_strand; }
    bool                     match_subfeatures() { return _match_subfeatures; }
    t_collate_express_mode   expression_mode() { return _expression_mode; }
  
  protected:
    FeatureLink                  *_feature_buffer_start, *_feature_buffer_end;
    FeatureLink                  *_completed_start, *_completed_end;
    bool                         _unique_features;
    bool                         _match_category;
    bool                         _match_source;
    bool                         _match_strand;
    bool                         _match_subfeatures;
    bool                         _merge_metadata;
    t_collate_express_mode       _expression_mode;
  
    string                       _expression_mode_string();
    bool                         _merge_unique_features(EEDB::Feature *feat1, EEDB::Feature *feat2);

    
  public:  //used for callback functions, should not be considered open API
    void               _xml(string &xml_buffer);
    string             _display_desc();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
