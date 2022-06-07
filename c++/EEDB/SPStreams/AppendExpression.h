/* $Id: AppendExpression.h,v 1.3 2019/03/26 07:07:45 severin Exp $ */

/***

NAME - EEDB::SPStreams::AppendExpression

SYNOPSIS

DESCRIPTION

dynamic experiment/expression generation module to
fill in for feature-sources which do not have loaded experiments.
Initial version will just perform count, but I can see this also being
used to translate score/metadata into expression dynamically

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU system
 * copyright (c) 2007-2018 Jessica Severin RIKEN OSC
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

#ifndef _EEDB_SPSTREAMS_APPENDEXPRESSION_H
#define _EEDB_SPSTREAMS_APPENDEXPRESSION_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/Feature.h>
#include <EEDB/Experiment.h>
#include <EEDB/SPStreams/StreamBuffer.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class AppendExpression : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    AppendExpression();                // constructor
    AppendExpression(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~AppendExpression();                // destructor
    void init();                       // initialization method

  private:
    EEDB::Datatype*                    _count_expression_datatype;
    map<string, EEDB::Datatype*>       _mdata_expression_datatypes;
    map<string, EEDB::Experiment*>     _dynamic_experiment_hash; //from fsrcID -> dynamic experiment
    map<string, EEDB::DataSource*>     _sources_cache;
    EEDB::SPStreams::StreamBuffer*     _source_streambuffer;

    void                               _cache_datasource(EEDB::DataSource* source);


  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);

    MQDB::DBObject*    _next_in_stream();
    void               _reset_stream_node();
    void               _stream_clear();
    
    void               _reload_stream_data_sources();
    void               _stream_data_sources(string classname, string filter_logic);
    
};

};   //namespace SPStreams

};   //namespace EEDB


#endif
