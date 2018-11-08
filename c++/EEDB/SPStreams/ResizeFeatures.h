/* $Id: ResizeFeatures.h,v 1.4 2012/10/02 06:12:42 severin Exp $ */

/***

NAME - EEDB::SPStreams::ResizeFeatures

SYNOPSIS

DESCRIPTION

 works on features with subfeatures. generates "intron" category objects 
 between "exon" category objects
 
CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2009 Jessica Severin RIKEN OSC
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

#ifndef _EEDB_SPSTREAMS_RESIZEFEATURES
#define _EEDB_SPSTREAMS_RESIZEFEATURES

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class ResizeFeatures : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;
  
  public:
    ResizeFeatures();                // constructor
    ResizeFeatures(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~ResizeFeatures();                // destructor
    void init();                        // initialization method

    void   add_feature_category_filter(string value) { _feat_filter_categories[value] = true; }

protected:
    map<string,bool>             _feat_filter_categories;
    string                       _mode;
    long int                     _expansion;
    bool                         _feature_stream_empty;
    bool                         _retain_subfeatures;
    deque<EEDB::Feature*>        _feature_buffer;
    deque<EEDB::Feature*>        _completed_features;
    
    EEDB::Feature*               _process_feature(EEDB::Feature* feature);
    bool                         _overlap_check(EEDB::Feature *feature, EEDB::Feature *cluster);

    void                         _store_original_coords(EEDB::Feature* feature);
    void                         _restore_original_coords(EEDB::Feature* feature);

  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*    _next_in_stream();
    void               _xml(string &xml_buffer);
    void               _reset_stream_node();
    string             _display_desc();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
