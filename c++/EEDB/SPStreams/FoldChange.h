/* $Id: FoldChange.h,v 1.1 2017/02/06 09:51:01 severin Exp $ */

/***

NAME - EEDB::SPStreams::FoldChange

SYNOPSIS

DESCRIPTION

 A simple signal procesor which is configured with a minimum expression value
 and which will only pass expressions which are greater than that value

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

#ifndef _EEDB_SPSTREAMS_FOLDCHANGE_H
#define _EEDB_SPSTREAMS_FOLDCHANGE_H

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

class FoldChange : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    FoldChange();                // constructor
    FoldChange(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~FoldChange();                // destructor
    void init();                 // initialization method

    bool     loadprep_experiment_metadata();
    bool     analyze_feature(EEDB::Feature *feature);

  private:
    string                   _pre_filter;  //overall filter to only analyze within that group
    string                   _control_group_filter_logic;
    vector<string>           _group_by_keys;
    vector<string>           _match_controls_by_keys;
    EEDB::Datatype*          _datatype;
    EEDB::Datatype*          _output_datatype;

    map<string, EEDB::Experiment*>     _experiment_cache;      // srcID to experiment to keep cache
    map<string, EEDB::Experiment*>     _control_experiments;   // srcID to experiment for the controls
    map<string, map<string, bool> >    _key_val_types;         // [key] = set of values
    map<string, map<string, bool> >    _keyval_experiment;     // [key::value][expid] = mdata present in experiment

  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);
    MQDB::DBObject*    _next_in_stream();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
