/* $Id: InteractionMatrix.h,v 1.3 2021/07/15 02:25:39 severin Exp $ */

/***

NAME - EEDB::InteractionMatrix

SYNOPSIS

DESCRIPTION

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
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

#ifndef _EEDB_INTERACTIOMATRIX_H
#define _EEDB_INTERACTIOMATRIX_H

#include <stdio.h>
#include <stdlib.h>
#include <sys/time.h>
#include <iostream>
#include <string>
#include <vector>
#include <boost/numeric/ublas/symmetric.hpp>  //symetric NxN matrix
#include <boost/numeric/ublas/io.hpp>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

  typedef struct {
    EEDB::DataSource*   datasource;
    EEDB::Datatype*     datatype;
    double              value;
    //long                fidx1;
    //long                fidx2;
    //char                direction;
  } interaction_signal_t;
  
  typedef struct { 
    EEDB::Feature* feature;
    long           idx; 
  } feature_idx_t;

class InteractionMatrix : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

  public:
    InteractionMatrix();                // constructor
   ~InteractionMatrix();                // destructor
    void init();                        // initialization method
    void init_from_xml(void *xml_node); // init using a rapidxml parent node

    //InteractionMatrix* copy();

    void display_info();
    string display_desc();
    string display_contents();

    void  ignore_direction(bool value);

    long    add_feature(EEDB::Feature *feature);  //return feature idx into unique array
    bool    add_dumbbell(EEDB::Feature *feature);
    bool    add_edge(EEDB::Edge *edge);
    void    clear_all();
    void    clear_connections();

    // access methods
    int                     feature_count();
    int                     matrix_size();
    
    vector<EEDB::Feature*>  extract_features();
    vector<EEDB::Edge*>     extract_edges();

    void                    stream_extract_edges();
    EEDB::Edge*             next_edge();

  protected:
    long                         _feature_idx;   //master count of known features
    vector<EEDB::Feature*>       _features;      //fast lookup from idx to feature
    map<string, feature_idx_t >  _feature_hash;  //dbid or chrom_loc as hash-ID
    bool                         _ignore_direction;

    struct timeval               _starttime;
    double                       _last_debug;
    long                         _input_edge_count;

    map<long long, vector < interaction_signal_t > >            _matrix;  //3d matrix feature-2-feature hashID -> vector of signals
    map<long long, vector < interaction_signal_t > >::iterator  _stream_edge_it;
    //map<long long, EEDB::Edge* >            _matrix;  //3d matrix feature-2-feature hashID -> vector of signals
    //map<long long, EEDB::Edge* >::iterator  _stream_edge_it;
    
    void    _clear_features();

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);

};

};   //namespace

#endif
