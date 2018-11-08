/* $Id: Paraclu.h,v 1.14 2013/04/08 07:32:28 severin Exp $ */

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

#ifndef _EEDB_TOOLS_PARACLU
#define _EEDB_TOOLS_PARACLU

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/Feature.h>
#include <EEDB/Tools/ResortBuffer.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

  typedef enum { FULL_HIERARCHY, BEST_STABLE, SMALL_STABLE, STABILITY_CUT }  t_paraclu_mode;

namespace Tools {
  
class Paraclu : public MQDB::DBObject {    
  
  class Cluster {
    public:
      FeatureLink    *beg, *end;
      double         totalValue;
      double         minDensity, maxDensity;
      double         stability;
      
      Cluster();  //constructor  
      ~Cluster(); // destructor

      void show();
  };
  
  public:  //global class level
    static const char*  class_name;
  
  public:
    Paraclu();                // constructor
    Paraclu(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~Paraclu();                // destructor
    void init();              // initialization method

    void   output_buffer(EEDB::Tools::ResortBuffer* buffer);
    void   feature_source(EEDB::FeatureSource* source);
  
    void   min_value(double value) { _min_cutoff_value = value; }
    void   min_stability(double value) { _min_stability = value; }
    void   min_density(double value) { _min_density = value; }
    void   max_cluster_length(long value) { _max_cluster_length = value; }
    void   selection_mode(t_paraclu_mode value) { _selection_mode = value; }

    double min_value() { return _min_cutoff_value; }
    double min_stability() { return _min_stability; }
    long   max_cluster_length() { return _max_cluster_length; }
  
    // processing API
    void                        process_feature(EEDB::Feature* feature);
    void                        finish_processing();
    void                        reset();  //reset for next region query

  protected:
    EEDB::Tools::ResortBuffer*   _output_buffer;
    EEDB::FeatureSource*         _feature_source;

    long                         _max_cluster_length;
    double                       _min_cutoff_value;
    double                       _min_stability;  //parent child ratio
    double                       _min_density;
    t_paraclu_mode               _selection_mode;

    // internal variables for processing
    FeatureLink                  *_fl_buffer_start, *_fl_buffer_end;
    FeatureLink                  *_minPrefix, *_minSuffix;
    double                       _minPrefixDensity, _minSuffixDensity;
    EEDB::Chrom                  *_stream_chrom;
    Cluster                      *_best_cluster;
    long int                     _cluster_number;
    
    double                       _calc_total_value(FeatureLink* beg, FeatureLink* end);
    double                       _weakestPrefix(FeatureLink* beg, FeatureLink* end);
    double                       _weakestSuffix(FeatureLink* beg, FeatureLink* end);
    void                         _show_buffer(FeatureLink *beg, FeatureLink *end);
    void                         _discard_region(FeatureLink *beg, FeatureLink *end);

    void                         _process_cluster_range_full(FeatureLink* beg, FeatureLink* end, double minDensity);
    int                          _process_cluster_range_smallest(FeatureLink* beg, FeatureLink* end, double minDensity);
    EEDB::Feature*               _generate_cluster(FeatureLink *beg, FeatureLink *end);

    //variation on paraclu density search which looks for best sability point cut
    void                         _process_cluster_range_best(FeatureLink* beg, FeatureLink* end);
    void                         _recurse_cluster_range(FeatureLink *beg, FeatureLink *end, double minDensity);
    EEDB::Feature*               _generate_cluster(Cluster *cl);
    void                         _recover_singletons(FeatureLink *beg, FeatureLink *end);   

  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);
    string             _display_desc();
  
};

};   //namespace Tools

};   //namespace EEDB


#endif
