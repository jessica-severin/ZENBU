/* $Id: Datatype.h,v 1.7 2013/04/08 05:47:52 severin Exp $ */

/***

NAME - EEDB::Datatype

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

#ifndef _EEDB_DATATYPE_H
#define _EEDB_DATATYPE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Datatype {
  
  public: //class methods
    //to allocation use these methods to reuse objects from global cache
    //  EEDB::Datatype *datatype = EEDB::Datatype::get_type("tagcount");
    //  EEDB::Datatype *datatype = EEDB::Datatype::get_type(type);  /where type is string

    static EEDB::Datatype* get_type(const char *type);
    static EEDB::Datatype* get_type(string &type);
    static EEDB::Datatype* from_xml(void *xml_node); // constructor using a rapidxml node

  
  public: //instance methods
    string type() { return _datatype; }

    bool operator==(EEDB::Datatype* b);
    bool operator==(string &b);
    bool operator==(const char* b);
    bool operator!=(EEDB::Datatype* b);
    bool operator!=(string &b);
    bool operator!=(const char* b);
    
    string   xml();
    void     xml(string &xml_buffer);

  private:
    static map<string, EEDB::Datatype*> _datatype_cache;
    string                              _datatype;

};

};   //namespace

#endif
