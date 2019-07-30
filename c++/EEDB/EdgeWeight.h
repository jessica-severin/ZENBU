/* $Id: EdgeWeight.h,v 1.1 2017/05/16 06:40:43 severin Exp $ */

/***

NAME - EEDB::EdgeWeight

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


#ifndef _EEDB_EDGEWEIGHT_H
#define _EEDB_EDGEWEIGHT_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Chrom.h>
#include <EEDB/Datatype.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Experiment;
class EdgeSource;
class Edge;
class Datatype;
class Chrom;

class EdgeWeight : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

   public:  
    //memory management system to reuse object memory
    //use instead of new
    //eg:    EEDB::EdgeWeight *obj = EEDB::EdgeWeight::realloc();  //to 'new'
    //       obj->release();  //to 'delete' 
    static EEDB::EdgeWeight*  realloc();
  
  protected:
    double              _weight;
    EEDB::Datatype*     _datatype;
    string              _datasource_dbid;
    EEDB::DataSource*   _datasource;
    EEDB::Edge*         _edge;

  public:
    EdgeWeight();               // constructor
   ~EdgeWeight();               // destructor
    void init();                // initialization method
    bool init_from_xml(void *xml_node); // init using a rapidxml node
    
    bool operator==(const EEDB::EdgeWeight& b);
    bool operator!=(const EEDB::EdgeWeight& b);
    bool operator<(const EEDB::EdgeWeight& b);
    bool operator>(const EEDB::EdgeWeight& b);

    //get atribute
    EEDB::Datatype*      datatype();
    double               weight();
    EEDB::DataSource*    datasource();
    string               datasource_dbid();
    EEDB::Edge*          edge();

    //set attribute
    void   datatype(EEDB::Datatype *type);
    void   datatype(string dtype);
    void   weight(double weight);
    void   datasource(EEDB::DataSource *source);
    void   datasource_dbid(string value);
    void   edge(EEDB::Edge *edge);

    //display and export
    void   display_info();
    string display_desc();
    string display_contents();

  private:
    static vector<EEDB::EdgeWeight*>    _realloc_edgeweight_array;
    static int                          _realloc_idx;

  public: //for callback function
    void         _dealloc();  //to fake delete
    static void  _realloc(EEDB::EdgeWeight *obj);
    
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);

};

};   //namespace

#endif
