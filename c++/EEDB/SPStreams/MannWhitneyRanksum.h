/* $Id: MannWhitneyRanksum.h,v 1.5 2016/02/24 06:27:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::MannWhitneyRanksum

SYNOPSIS

DESCRIPTION

 An advanced signal procesor which performs a ranksum mann-whitney analysis 
 across all the metadata of all the experiments based on an expression ranking
 
CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [eeDB] system
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

#ifndef _EEDB_SPSTREAMS_MANNWHITNEYRANKSUM_H
#define _EEDB_SPSTREAMS_MANNWHITNEYRANKSUM_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <list>
#include <EEDB/SPStream.h>
#include <EEDB/Feature.h>
#include <EEDB/Experiment.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

  class MWGroup : public EEDB::Metadata {
  public:
    string     src_id_key;
    
    long       other_count;
    long       group_count;
    double     other_sum;
    double     group_sum;
    double     zscore;
    double     pvalue;
    long       abundance_count;
    vector<double>  abundance_zscores;
    
  public:  //global class level
    static const char*  class_name;
    
    MWGroup();                // constructor
    MWGroup(void *xml_node);  // constructor using a rapidxml <spstream> description
    ~MWGroup();               // destructor
    void init();              // initialization method
    void reset_stats();       // reset all the statistics variables
    MWGroup* copy();

    void               add_experiment_id(string value);
    void               add_metadata(EEDB::Metadata *mdata);

    bool               has_experiment_id(string value);
    double             avg_zscore();
    double             max_zscore();

    void               _xml(string &xml_buffer);
    void               _simple_xml(string &xml_buffer);
    
    list<EEDB::Metadata*> _mdata_list;
    map<string,bool>      _exp_id_hash;

  };

namespace SPStreams {

class MannWhitneyRanksum : public EEDB::SPStream {
  
  public:  //global class level
    static const char*  class_name;

  public:
    MannWhitneyRanksum();                // constructor
    MannWhitneyRanksum(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~MannWhitneyRanksum();                // destructor
    void init();                         // initialization method
  
    void               set_mdata_key_filter(string filter); //space separated list of keys
    void               add_mdata_key_filter(string key);
    void               set_experiment_filter(string filter);
    void               set_min_zscore(double value);

    string                  mdgroup_xml();  //for output
    vector<EEDB::MWGroup*>  mdgroups();

    bool               loadprep_experiment_metadata();
    bool               analyze_feature(EEDB::Feature *feature);

  private:
    string                             _experiment_filter;
    map<string, bool>                  _filter_mdkeys;
    double                             _min_zscore;
  
    map<string, EEDB::Experiment*>     _experiment_cache;   //srcID to experiment to keep cache
    map<string, EEDB::Metadata*>       _keyval_mdata;       // [key::value] = mdata
    map<string, double>                _keyval_enrichment;  // [key::value] = double pvalue stat
    map<string, map<string, bool> >    _keyval_experiment;  // [key::value][expid] = mdata present in experiment
  
    map<string, EEDB::MWGroup*>        _mdgroup_hash;


  //used for callback functions, should not be considered open API
  public:
    MQDB::DBObject*    _next_in_stream();
    void               _xml(string &xml_buffer);
    string             _display_desc();
    void               _reset_stream_node();
    void               _stream_clear();
    void               _stream_data_sources(string classname, string filter_logic);
    void               _reload_stream_data_sources();
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
