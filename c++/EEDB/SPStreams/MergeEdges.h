/* $Id: MergeEdges.h,v 1.2 2021/07/14 03:34:11 severin Exp $ */

/***

NAME - EEDB::SPStreams::MergeEdges

SYNOPSIS

DESCRIPTION

 a simple module to combine exact edges merging weights and metadata. uses the IDs or locations
 of feature1/feature2 to identify equal connections

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

#ifndef _EEDB_SPSTREAMS_MergeEdges_H
#define _EEDB_SPSTREAMS_MergeEdges_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <deque>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>
#include <EEDB/InteractionMatrix.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class MergeEdges : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    MergeEdges();                // constructor
    MergeEdges(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~MergeEdges();                // destructor
    void init();                      // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    void  ignore_direction(bool value);
    void  expression_mode(t_collate_express_mode value);

  protected:
    t_collate_express_mode       _expression_mode;
    bool                         _stream_from_matrix;
    bool                         _streaming_region;
    bool                         _ignore_direction;
  
    EEDB::InteractionMatrix*     _interact_matrix;

    EEDB::Edge*                  _process_object(MQDB::DBObject* obj);
    bool                         _check_edges_equal(EEDB::Edge* edge1, EEDB::Edge* edge2);
    bool                         _merge_edges(EEDB::Edge* edge1, EEDB::Edge* edge2); //tests and merges
    void                         _cluster_add_weight(EEDB::Edge *cluster, EEDB::EdgeWeight *weight);
    void                         _transfer_metadata(EEDB::Edge *edge, EEDB::Edge *edge2);
    void                         _transfer_metadata(EEDB::Edge *edge, EEDB::MetadataSet *mdset);

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
