/* $Id: DBStream.cpp,v 1.5 2013/04/08 07:37:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::DBStream

SYNOPSIS

DESCRIPTION

Wrapper around MQDB::DBStream so that it can be used by subclasses of SPStream.
Allows it to be plugged into _source_stream of subclasses and conform to some
of the SPStream API.  Used by EEDB::SPStreams::SourceStream

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
#include <EEDB/SPStreams/DBStream.h>

using namespace std;
using namespace MQDB;

const char*               EEDB::SPStreams::DBStream::class_name = "EEDB::SPStreams::DBStream";

//function prototypes
MQDB::DBObject* _spstream_dbstream_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::DBStream*)node)->_next_in_stream();
}
void _spstream_dbstream_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::DBStream*)obj;
}


EEDB::SPStreams::DBStream::DBStream() {
  init();
}

EEDB::SPStreams::DBStream::~DBStream() {
  if(_dbstream) { _dbstream->release(); }
}

void EEDB::SPStreams::DBStream::init() {
  EEDB::SPStream::init();
  _classname               = EEDB::SPStreams::DBStream::class_name;
  _funcptr_delete          = _spstream_dbstream_delete_func;
  _funcptr_next_in_stream  = _spstream_dbstream_next_in_stream_func;

  _source_stream  = NULL;
  _dbstream       = new MQDB::DBStream; 
}

void EEDB::SPStreams::DBStream::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::SPStreams::DBStream::display_desc() {
  return "DBStream";
}

string EEDB::SPStreams::DBStream::display_contents() {
  return display_desc();
}


////////////////////////////////////////////////////////////////////////////
// Instance methods
////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::DBStream::database(MQDB::Database *db) {
  _dbstream->database(db);
}

MQDB::Database*  EEDB::SPStreams::DBStream::database() {
  return _dbstream->database();
}

MQDB::DBStream*  EEDB::SPStreams::DBStream::dbstream() {
  return _dbstream;
}

MQDB::DBObject* EEDB::SPStreams::DBStream::_next_in_stream() {
  return _dbstream->next_in_stream();
}


