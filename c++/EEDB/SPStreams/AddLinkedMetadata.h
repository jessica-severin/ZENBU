/* $Id: AddLinkedMetadata.h,v 1.1 2019/02/21 07:32:35 severin Exp $ */

/***

NAME - EEDB::SPStreams::AddLinkedMetadata

SYNOPSIS

DESCRIPTION
 This module is configured with a side_stream of features containing metadata.
 Using a linking metadata value, if the primary_stream object has linking-metadata to any 
 side_stream feature with same metadata, then the full metadata of the side_stream feature is 
 transfered onto the primary_stream object.
 Side stream should be populated with a metadata file source since all objects on side stream must be
 loaded into a memory hash prior to streaming of objects on the primary_stream
 
CONTACT

Jessica Severin <jessica.severin@riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
 * copyright (c) 2007-2019 Jessica Severin RIKEN OSC
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

#ifndef _EEDB_SPSTREAMS_ADDLINKEDMETADATA_H
#define _EEDB_SPSTREAMS_ADDLINKEDMETADATA_H

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

typedef enum { FEATURE, FEATURESOURCE, EXPERIMENT, EDGESOURCE, DATASOURCE, ALL }  target_mode_t;

class AddLinkedMetadata : public EEDB::SPStreams::MergeStreams {
  public:  //global class level
    static const char*  class_name;

  public:
    AddLinkedMetadata();                // constructor
    AddLinkedMetadata(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~AddLinkedMetadata();                // destructor
    void init();                        // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    void  target_mode(string value);
    void  primary_linking_mdkey(string value);
    void  side_linking_mdkey(string value);

  protected:
    target_mode_t     _target_mode;
    string            _primary_linking_mdkey;
    string            _side_linking_mdkey;

    map<string, EEDB::MetadataSet*>  _linking_mdata_hash; //linking mdata value -> full mdset to transfer  

    void              _preload_side_stream_linking_mdata_hash();
    bool              _process_feature(EEDB::Feature *feature);
    bool              _process_datasource(EEDB::DataSource *source);
  
  //callback functions, should not be considered open API
  public:
    void              _xml(string &xml_buffer);
    void              _reset_stream_node();
    void              _stream_clear();
    MQDB::DBObject*   _next_in_stream();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
