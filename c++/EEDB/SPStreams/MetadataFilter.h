/* $Id: MetadataFilter.h,v 1.3 2013/04/08 07:38:17 severin Exp $ */

/***

NAME - EEDB::SPStreams::MetadataFilter

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

#ifndef _EEDB_SPSTREAMS_METADATAFILTER_H
#define _EEDB_SPSTREAMS_METADATAFILTER_H

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

class MetadataFilter : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

  public:
    MetadataFilter();                // constructor
    MetadataFilter(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~MetadataFilter();                // destructor
    void init();                     // initialization method

    void  inverse(bool value) { _inverse = value; }

  private:
    enum { FEATURE, FEATURESOURCE, EXPERIMENT, ALL, ANY }  _mdset_mode;
    string                   _filter_logic;
    bool                     _inverse;
    vector<EEDB::Metadata*>  _specific_mdata;
    
    bool               _check_metadataset(EEDB::MetadataSet *mdset);
  
  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*    _next_in_stream();
    void               _xml(string &xml_buffer);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
