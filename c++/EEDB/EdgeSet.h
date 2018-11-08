/* $Id: EdgeSet.h,v 1.10 2013/04/08 05:47:52 severin Exp $ */

/***

NAME - EEDB::EdgeSet

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


#ifndef _EEDB_EDGESET_H
#define _EEDB_EDGESET_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Edge.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Edge;

class EdgeSet : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    EdgeSet();               // constructor
   ~EdgeSet();               // destructor
    void init();             // initialization method
    EdgeSet* copy();         // clone a copy of set, point as same Edge objects

    //get atribute
    string name() { return _name; }
    string description() { return _description; }

    //set attribute
    void name(string value)        { _name = value; }
    void description(string value) { _description = value; }

    void display_info();
    string display_desc();
    string display_contents();

    void                 clear();
    int                  size();
    bool                 empty();
    vector<EEDB::Edge*>  edges();
    void                 add_edges(vector<MQDB::DBObject*> &edges);
    void                 add_edge(EEDB::Edge *edge);

    EdgeSet* extract_category(string category);

    //sub feature_set()
    //sub feature1_set()
    //sub feature2_set()

    //sub remove_edgesource {
    //sub extract_edgesource {
    //sub remove_local_leaves {

    //sub find_edges_with_feature1_hash_based {
    //sub find_edges_with_feature2_hash_based {
    //sub find_linksource_name {
    //sub find_edges_with_feature1 {
    //sub find_edges_with_feature2 {


  private:
   // sub _build_sorted_lists {
    string                  _name;
    string                  _description;
    vector<EEDB::Edge*>     _edges;

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);

};

};   //namespace

#endif
