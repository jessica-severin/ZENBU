/* $Id: TemplateFilter.h,v 1.9 2013/11/26 08:45:52 severin Exp $ */

/***

NAME - EEDB::SPStreams::TemplateFilter

SYNOPSIS

DESCRIPTION

a signal-processing-stream filter
As a stream filter the idea is a restricted use-case which is very common.
This filter is configured with a side_stream of "template" features.
These sources form a collation of "templates" which are used for "clustering".
If the input features/expressions overlaps with any of these sources the tempate
is copied and the expression from the primary stream 
is "collected" under it as a "pseudo-cluster".

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

#ifndef _EEDB_SPSTREAMS_TEMPLATEFILTER_H
#define _EEDB_SPSTREAMS_TEMPLATEFILTER_H

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


class TemplateFilter : public EEDB::SPStreams::MergeStreams {
  public:  //global class level
    static const char*  class_name;

  public:
    TemplateFilter();                // constructor
    TemplateFilter(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~TemplateFilter();                // destructor
    void init();                     // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    void  overlap_mode(string value)                    { _overlap_mode = value; }
    void  ignore_strand(bool value)                     { _ignore_strand = value; }
    void  invert(bool value)                            { _overlap_state = !value; }


  protected:
    string                       _overlap_mode;
    bool                         _ignore_strand;
    bool                         _overlap_state;
    long int                     _overlap_distance;
    bool                         _overlap_check_subfeatures;
  
    bool                         _template_stream_primed;
    bool                         _template_stream_empty;
    deque<EEDB::Feature*>        _template_buffer;

    bool                         _process_feature(EEDB::Feature *feature);
    bool                         _overlap_check(EEDB::Feature *feature, EEDB::Feature *cluster);
    EEDB::Feature*               _extend_template_buffer();

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
