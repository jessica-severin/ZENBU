/* $Id: FilterSubfeatures.h,v 1.3 2013/11/26 08:45:52 severin Exp $ */

/***

NAME - EEDB::SPStreams::FilterSubfeatures

SYNOPSIS

DESCRIPTION

 works on features with subfeatures. filters subfeatures out of the primary feature, resizes and resorts
 
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

#ifndef _EEDB_SPSTREAMS_FILTERSUBFEATURES
#define _EEDB_SPSTREAMS_FILTERSUBFEATURES

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/Tools/ResortBuffer.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class FilterSubfeatures : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;
  
  public:
    FilterSubfeatures();                // constructor
    FilterSubfeatures(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~FilterSubfeatures();                // destructor
    void init();                        // initialization method

    void   add_subfeature_category_filter(string value) { _subfeat_filter_categories[value] = true; }

protected:
    map<string,bool>             _subfeat_filter_categories;
    EEDB::Tools::ResortBuffer    _feature_buffer;
    
    void                         _process_feature(EEDB::Feature* feature);

  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*    _next_in_stream();
    void               _xml(string &xml_buffer);
    void               _reset_stream_node();
    string             _display_desc();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
