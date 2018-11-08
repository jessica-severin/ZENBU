/* $Id: OverlapAnnotate.h,v 1.5 2013/11/26 08:45:52 severin Exp $ */

/***

NAME - EEDB::SPStreams::OverlapAnnotate

SYNOPSIS

DESCRIPTION
 This module is configured with a side_stream of features containing metadata annotation.
 If the input features overlaps with any of these sidefeatures the metadata is transfered
 from the sidefeature onto the primary stream feature.
 System contains controls for how overlap is determined and how metadata is transfered
 
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

#ifndef _EEDB_SPSTREAMS_OVERLAPANNOTATE_H
#define _EEDB_SPSTREAMS_OVERLAPANNOTATE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <deque>
#include <EEDB/SPStreams/MergeStreams.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {


class OverlapAnnotate : public EEDB::SPStreams::MergeStreams {
  public:  //global class level
    static const char*  class_name;

  public:
    OverlapAnnotate();                // constructor
    OverlapAnnotate(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~OverlapAnnotate();                // destructor
    void init();                      // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    void  overlap_mode(string value)                    { _overlap_mode = value; }
    void  ignore_strand(bool value)                     { _ignore_strand = value; }
    void  overlap_distance(long int value)              { _overlap_distance = value; }


  protected:
    string                       _overlap_mode;
    bool                         _ignore_strand;
    long int                     _overlap_distance;
    bool                         _overlap_check_subfeatures;
  
    enum { FEATURE, FEATURESOURCE, EXPERIMENT, ALL }  _mdset_mode;
    vector<EEDB::Metadata*>      _specific_mdata;
  
  private:
    bool                         _side_stream_primed;
    bool                         _side_stream_empty;
    deque<EEDB::Feature*>        _side_stream_buffer;

    void                         _process_feature(EEDB::Feature *feature);
    bool                         _overlap_check(EEDB::Feature *feature, EEDB::Feature *cluster);
    EEDB::Feature*               _extend_side_stream_buffer();
  
    void                         _transfer_metadata(EEDB::Feature *feature, EEDB::Feature *sidefeature);
    void                         _transfer_metadata(EEDB::Feature *feature, EEDB::MetadataSet *mdset);

  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*        _next_in_stream();
    void                   _reset_stream_node();
    void                   _xml(string &xml_buffer);
    bool                   _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);


};

};   //namespace SPStreams

};   //namespace EEDB


#endif
