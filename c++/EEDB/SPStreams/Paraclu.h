/* $Id: Paraclu.h,v 1.12 2013/11/26 08:45:52 severin Exp $ */

/***

NAME - EEDB::SPStreams::Paraclu

SYNOPSIS

DESCRIPTION

 works on features with subfeatures. generates "intron" category objects 
 between "exon" category objects
 
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

#ifndef _EEDB_SPSTREAMS_PARACLU
#define _EEDB_SPSTREAMS_PARACLU

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/Tools/ResortBuffer.h>
#include <EEDB/Tools/Paraclu.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class Paraclu : public EEDB::SPStream {
    
  public:  //global class level
    static const char*  class_name;
  
  public:
    Paraclu();                // constructor
    Paraclu(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~Paraclu();                // destructor
    void init();              // initialization method
  
    void   min_value(double value) { _min_cutoff_value = value; }
    void   min_stability(double value) { _min_stability = value; }
    void   min_density(double value) { _min_density = value; }
    void   max_cluster_length(long value) { _max_cluster_length = value; }
    void   selection_mode(EEDB::t_paraclu_mode value) { _selection_mode = value; }

    double min_value() { return _min_cutoff_value; }
    double min_stability() { return _min_stability; }
    double min_density() { return _min_density; }
    long   max_cluster_length() { return _max_cluster_length; }
    
  protected:
    EEDB::Tools::ResortBuffer*   _output_buffer;
    EEDB::FeatureSource*         _feature_source;

    EEDB::Tools::Paraclu*        _paraclu_tool_plus;
    EEDB::Tools::Paraclu*        _paraclu_tool_minus;

    long                         _max_cluster_length;
    double                       _min_cutoff_value;
    double                       _min_stability;  // child/parent density ratio for STABILITY_CUT mode
    double                       _min_density; 
    EEDB::t_paraclu_mode         _selection_mode;


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
