/* $Id: TemplateCluster.h,v 1.22 2020/04/28 01:28:55 severin Exp $ */

/***

NAME - EEDB::SPStreams::TemplateCluster

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

#ifndef _EEDB_SPSTREAMS_TEMPLATECLUSTER_H
#define _EEDB_SPSTREAMS_TEMPLATECLUSTER_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <deque>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>
#include <EEDB/SPStreams/MergeStreams.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class TemplateCluster : public EEDB::SPStreams::MergeStreams {
  public:  //global class level
    static const char*  class_name;

  public:
    TemplateCluster();                // constructor
    TemplateCluster(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~TemplateCluster();                // destructor
    void init();                      // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    void  overlap_mode(string value);  //area, height, 5end, 3end
    void  ignore_strand(bool value)                     { _ignore_strand = value; }
    void  skip_empty_templates(bool value)              { _skip_empty_templates = value; }
    void  expression_mode(t_collate_express_mode value) { _expression_mode = value; }
    void  overlap_check_subfeatures(bool value);
    void  overlap_distance(long value) { _overlap_distance = value; }
    void  scan_extend_distance(long value) { _scan_extend_distance = value; }
    

  protected:
    string                       _overlap_mode;
    t_collate_express_mode       _expression_mode;
    bool                         _ignore_strand;
    bool                         _skip_empty_templates;
    bool                         _template_stream_empty;
    bool                         _overlap_check_subfeatures;
    long int                     _overlap_distance;
    long int                     _scan_extend_distance;
    map<string,bool>             _subfeat_filter_categories;
    deque<EEDB::Feature*>        _template_buffer;
    deque<EEDB::Feature*>        _completed_templates;
    bool                         _stream_features_mode;
    bool                         _edges_mode;
    deque<EEDB::Edge*>           _edge_buffer;

    EEDB::Feature*               _process_feature(MQDB::DBObject* obj);
    EEDB::Edge*                  _process_edge(MQDB::DBObject* obj);
    void                         _modify_ends(EEDB::Feature *feature);
    EEDB::Feature*               _extend_template_buffer();
    void                         _calc_template_significance(EEDB::Feature* feature);
    void                         _cluster_add_expression(EEDB::Feature *cluster, EEDB::Expression *express, long dup_count);
    void                         _edge_merge_weight(EEDB::Edge *edge, EEDB::EdgeWeight *weight);

  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*        _next_in_stream();
    void                   _reset_stream_node();
    void                   _stream_clear();
    void                   _xml(string &xml_buffer);
    bool                   _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);


};

};   //namespace SPStreams

};   //namespace EEDB


#endif
