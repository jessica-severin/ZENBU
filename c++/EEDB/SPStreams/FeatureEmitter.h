/* $Id: FeatureEmitter.h,v 1.17 2014/07/18 06:07:07 severin Exp $ */

/***

NAME - EEDB::SPStreams::FeatureEmitter

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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

#ifndef _EEDB_SPSTREAMS_FEATUREEMITTER_H
#define _EEDB_SPSTREAMS_FEATUREEMITTER_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <deque>
#include <EEDB/SPStream.h>
#include <EEDB/Feature.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class FeatureEmitter : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;
    static bool         dynamic_emitters_exist;

  public:
    FeatureEmitter();                // constructor
    FeatureEmitter(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~FeatureEmitter();                // destructor
    void init();                     // initialization method

    string display_contents();

    void   dynamic(bool value); //use global parameters to set width based on dynamics of query
    void   width(double value);
    void   overlap(long int value);
    void   fixed_grid(bool value);
    void   both_strands(bool value);
    void   num_per_region(long int value);
  
    //get attributes
    bool   dynamic();

  protected:
    double                _width;
    double                _coarseness;
    long int              _overlap;
    bool                  _dynamic;
    bool                  _fixed_grid;
    bool                  _both_strands;
    long int              _current_start;
    long int              _current_count;
    char                  _current_strand;
    EEDB::Chrom*          _region_chrom;
    EEDB::FeatureSource*  _feature_source;

  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);
    string             _display_desc();
    MQDB::DBObject*    _next_in_stream();
    void               _stream_clear();
    void               _reset_stream_node();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);


};

};   //namespace SPStreams

};   //namespace EEDB


#endif
