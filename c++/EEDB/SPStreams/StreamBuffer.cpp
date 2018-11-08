/* $Id: StreamBuffer.cpp,v 1.6 2015/02/05 06:18:08 severin Exp $ */

/***

NAME - EEDB::SPStreams::StreamBuffer

SYNOPSIS

DESCRIPTION

a simple SPStream which has an internal buffer. allows for external filling of buffer
or to fill from the source_stream();

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
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::StreamBuffer::class_name = "EEDB::SPStreams::StreamBuffer";

//function prototypes
MQDB::DBObject* _spstream_streambuffer_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::StreamBuffer*)node)->_next_in_stream();
}
void _spstream_streambuffer_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::StreamBuffer*)node)->_reset_stream_node();
}
void _spstream_streambuffer_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::StreamBuffer*)node)->_stream_clear();
}


EEDB::SPStreams::StreamBuffer::StreamBuffer() {
  init();
}

EEDB::SPStreams::StreamBuffer::~StreamBuffer() {
}

void _spstream_streambuffer_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::StreamBuffer*)obj;
}

void EEDB::SPStreams::StreamBuffer::init() {
  EEDB::SPStream::init();
  _classname      = EEDB::SPStreams::StreamBuffer::class_name;
  _funcptr_delete = _spstream_streambuffer_delete_func;

  _source_stream  = NULL;
  _stream_buffering_size = -1; //don't buffer from the source_stream
 
  //function pointer code
  _funcptr_next_in_stream         = _spstream_streambuffer_next_in_stream_func;
  _funcptr_reset_stream_node      = _spstream_streambuffer_reset_stream_node_func;
  _funcptr_stream_clear           = _spstream_streambuffer_stream_clear_func;
}

void EEDB::SPStreams::StreamBuffer::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::StreamBuffer::display_desc() {
  return "StreamBuffer";
}

string EEDB::SPStreams::StreamBuffer::display_contents() {
  return display_desc();
}


////////////////////////////////////////////////////////////////////////////
// Instance methods
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::StreamBuffer::add_object(MQDB::DBObject* obj) {
  if(obj == NULL) { return; }
  _object_buffer.push_back(obj);
}


void  EEDB::SPStreams::StreamBuffer::add_objects(vector<MQDB::DBObject*> objs) {
  vector<MQDB::DBObject*>::iterator  it;
  for(it = objs.begin(); it != objs.end(); it++) {
    _object_buffer.push_back((*it));
  }
}


void  EEDB::SPStreams::StreamBuffer::release_objects() {
  deque<MQDB::DBObject*>::iterator  it;
  for(it = _object_buffer.begin(); it != _object_buffer.end(); it++) {
    if(*it) { 
      (*it)->release(); 
      //fprintf(stderr, "release remaining feature\n");
    }
  }
  _object_buffer.clear();
}

////////////////////////////////////////////////////////////////////////////
//
// override method for subclasses which will
// do all the work
//
///////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::StreamBuffer::_reset_stream_node() {
  _region_start   = -1;
  _region_end     = -1;
  release_objects();
}


void EEDB::SPStreams::StreamBuffer::_stream_clear() {
  _region_start   = -1;
  _region_end     = -1;
  release_objects();
}


MQDB::DBObject* EEDB::SPStreams::StreamBuffer::_next_in_stream() {
  if(_object_buffer.size() > 0) {
    MQDB::DBObject *obj = _object_buffer.front();
    _object_buffer.pop_front();
    return obj;
  } else {
    /*
    if(defined($self->source_stream) and $self->{'_stream_buffering_size'}) { 
      for(my $i=0; $i<$self->{'_stream_buffering_size'}; $i++) {
        my $obj = $self->source_stream->next_in_stream;
        if(!defined($obj)) { $self->add_objects($obj); }
      }
    }
    */
  }  
  return NULL;
}


