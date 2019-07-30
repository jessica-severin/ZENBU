/* $Id: DemultiplexSource.h,v 1.2 2019/02/26 23:58:33 severin Exp $ */

/***

NAME - EEDB::SPStreams::DemultiplexSource

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

#ifndef _EEDB_SPSTREAMS_DEMULTIPLEXSOURCE_H
#define _EEDB_SPSTREAMS_DEMULTIPLEXSOURCE_H

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

class DemultiplexSource : public EEDB::SPStreams::MergeStreams {
  public:  //global class level
    static const char*  class_name;

  public:
    DemultiplexSource();                // constructor
    DemultiplexSource(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~DemultiplexSource();                // destructor
    void init();                        // initialization method

    void   set_demux_source_mode(string mode);
    void   add_demux_mdata_keys(string mdkeys);  //comma/space/tab separated list of keys
    
  private:
    enum { FEATURESOURCE, EXPERIMENT }  _demux_source_mode;
    vector<EEDB::Metadata*>             _demux_mdata;
    string                              _side_linking_mdkey;
    
    map<string, EEDB::DataSource*>      _subsource_hash;     //to track newly generated subsources  
    map<string, EEDB::MetadataSet*>     _linking_mdata_hash; //linking mdata value -> full mdset to transfer  

    bool   _demux_source_for_feature(EEDB::Feature *feature);
    void   _preload_side_stream_linking_mdata_hash();
    void   _transfer_linking_metadata(EEDB::DataSource* source);

    
  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*    _next_in_stream();
    void               _xml(string &xml_buffer);
    void               _reset_stream_node();
    void               _stream_clear();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
