/* $Id: OSCTableGenerator.h,v 1.7 2014/02/10 04:41:28 severin Exp $ */

/***

NAME - EEDB::Tools::OSCTableGenerator

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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

#ifndef _EEDB_TOOLS_OSCTABLEGENERATOR_H
#define _EEDB_TOOLS_OSCTABLEGENERATOR_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <list>
#include <MQDB/DBObject.h>
#include <EEDB/Assembly.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Datatype.h>
#include <EEDB/Tools/OSCFileParser.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace Tools {

class OSCTableGenerator : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

  public:
    OSCTableGenerator();         // constructor
   ~OSCTableGenerator();         // destructor
    void init();                 // initialization method

    void             source_stream(EEDB::SPStream* value) { _source_stream = value; }
    EEDB::SPStream*  source_stream() { return _source_stream; }

    void             assembly_name(string value) { _assembly_name = value; }
    void             add_expression_datatype(EEDB::Datatype* datatype);
    void             export_subfeatures(string mode);
    void             export_feature_metadata(bool value);
    void             export_experiment_metadata(bool value);
    void             export_header_metadata(bool value);

    string           generate_oscheader();
    string           osctable_feature_output(EEDB::Feature * feature);

  //internal variables and methods, should not be considered open API
  private:
    bool                             _export_feature_metadata;
    string                           _export_subfeatures;
    bool                             _export_experiment_metadata;
    bool                             _export_header_metadata;
    string                           _assembly_name;
    EEDB::SPStream*                  _source_stream;
    list<EEDB::Datatype*>            _expression_datatypes;
    list<EEDB::Experiment*>          _experiments;

    string                           _osctable_feature_metadata(EEDB::Feature * feature);

  public: //for callback functions
    void   _xml(string &xml_buffer);
    string _display_desc();

};

};   //namespace Tools

};   //namespace EEDB


#endif
