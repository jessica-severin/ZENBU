/* $Id: MakeStrandless.cpp,v 1.2 2013/04/08 07:38:17 severin Exp $ */

/***

NAME - EEDB::SPStreams::MakeStrandless

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


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/MakeStrandless.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::MakeStrandless::class_name = "EEDB::SPStreams::MakeStrandless";

//function prototypes
void _spstream_makestrandless_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MakeStrandless*)obj;
}
MQDB::DBObject* _spstream_makestrandless_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MakeStrandless*)node)->_next_in_stream();
}
void _spstream_makestrandless_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::MakeStrandless*)obj)->_xml(xml_buffer);
}
string _spstream_makestrandless_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::MakeStrandless*)obj)->_display_desc();
}


EEDB::SPStreams::MakeStrandless::MakeStrandless() {
  init();
}

EEDB::SPStreams::MakeStrandless::~MakeStrandless() {
}

void EEDB::SPStreams::MakeStrandless::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::MakeStrandless::class_name;
  _module_name               = "MakeStrandless";
  _funcptr_delete            = _spstream_makestrandless_delete_func;
  _funcptr_xml               = _spstream_makestrandless_xml_func;
  _funcptr_simple_xml        = _spstream_makestrandless_xml_func;
  _funcptr_display_desc      = _spstream_makestrandless_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_makestrandless_next_in_stream_func;
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::MakeStrandless::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::MakeStrandless::MakeStrandless(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
}

string EEDB::SPStreams::MakeStrandless::_display_desc() {
  return "MakeStrandless";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::MakeStrandless::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj;
  while((obj = _source_stream->next_in_stream()) != NULL) {
        
    //non-feature\expression objects on the primary source stream
    //are just passed through this module      
    if(obj->classname() != EEDB::Feature::class_name) {
      return obj;
    }

    EEDB::Feature *feature = (EEDB::Feature*)obj;
    feature->strand(' ');
    return feature;
  }

  // input stream is empty so done
  return NULL;
}


