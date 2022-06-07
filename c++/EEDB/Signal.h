/* $Id: Signal.h,v 1.25 2021/07/02 05:22:27 severin Exp $ */

/***

NAME - EEDB::Signal

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


#ifndef _EEDB_SIGNAL_H
#define _EEDB_SIGNAL_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <boost/algorithm/string.hpp>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <EEDB/DataSource.h>
#include <EEDB/Datatype.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Experiment;
class Feature;
class Datatype;
class Chrom;

class Signal : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

   public:  
    //memory management system to reuse object memory
    //use instead of new
    //eg:    EEDB::Signal *obj = EEDB::Signal::realloc();  //to 'new'
    //       obj->release();  //to 'delete' 
    static EEDB::Signal*  realloc();
  
  protected:
    EEDB::DataSource*   _datasource;
    EEDB::Datatype*     _datatype;
    double              _value;
    string              _datasource_dbid;

  public:
    Signal();               // constructor
   ~Signal();               // destructor
    void init();            // initialization method
    bool init_from_xml(void *xml_node); // init using a rapidxml node
    
    bool operator==(const EEDB::Signal& b);
    bool operator!=(const EEDB::Signal& b);
    bool operator<(const EEDB::Signal& b);
    bool operator>(const EEDB::Signal& b);

    //get atribute
    double               value() { return _value; }
    EEDB::Datatype*      datatype();
    EEDB::DataSource*    datasource();
    string               datasource_dbid();

    //set attribute
    void   value(double weight);
    void   datatype(EEDB::Datatype *type);
    void   datatype(string dtype);
    void   datasource(EEDB::DataSource *source);
    void   datasource_dbid(string value);

    //display and export
    string display_desc();


  private:
    static vector<EEDB::Signal*>    _realloc_signal_array;
    static int                      _realloc_idx;

  public: //for callback function
    void         _dealloc();  //to fake delete
    static void  _realloc(EEDB::Signal *obj);
    
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);


};

};   //namespace

#endif
