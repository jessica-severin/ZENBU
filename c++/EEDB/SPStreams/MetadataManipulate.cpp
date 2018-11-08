/* $Id: MetadataManipulate.cpp,v 1.2 2013/04/08 07:38:17 severin Exp $ */

/***

NAME - EEDB::SPStreams::MetadataManipulate

SYNOPSIS

DESCRIPTION

 A signal procesor which modify the display_name of streamed experiments using a 
selection of their associated metadata

CONTACT

Jessica Severin <severin@gsc.riken.jp>
Nicolas Bertin <nbertin@gsc.riken.jp>

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
#include <EEDB/SPStreams/MetadataManipulate.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::MetadataManipulate::class_name = "EEDB::SPStreams::MetadataManipulate";

//function prototypes
void _spstream_metadatamanipulate_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::MetadataManipulate*)obj;
}
MQDB::DBObject* _spstream_metadatamanipulate_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::MetadataManipulate*)node)->_next_in_stream();
}
void _spstream_metadatamanipulate_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::MetadataManipulate*)obj)->_xml(xml_buffer);
}
string _spstream_metadatamanipulate_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::MetadataManipulate*)obj)->_display_desc();
}


EEDB::SPStreams::MetadataManipulate::MetadataManipulate() {
  init();
}

EEDB::SPStreams::MetadataManipulate::~MetadataManipulate() {
}

void EEDB::SPStreams::MetadataManipulate::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::MetadataManipulate::class_name;
  _module_name               = "MetadataManipulate";
  _funcptr_delete            = _spstream_metadatamanipulate_delete_func;
  _funcptr_xml               = _spstream_metadatamanipulate_xml_func;
  _funcptr_simple_xml        = _spstream_metadatamanipulate_xml_func;
  _funcptr_display_desc      = _spstream_metadatamanipulate_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream         = _spstream_metadatamanipulate_next_in_stream_func;

  //attributes

}


void  EEDB::SPStreams::MetadataManipulate::add_prefix_tag(string prefix, string tag) {
  t_md_prefix md_el;
   md_el.tag = tag;
   md_el.prefix = prefix;
   _prefix_tags.push_back(md_el);
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::MetadataManipulate::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass

  vector<t_md_prefix>::iterator  it;
  for(it=_prefix_tags.begin(); it!=_prefix_tags.end(); it++) {
    xml_buffer.append("<tag prefix=\""+(*it).prefix+"\">");
    xml_buffer.append((*it).tag);
    xml_buffer.append("</tag>");
  }
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::MetadataManipulate::MetadataManipulate(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  

  if(string(root_node->name()) != "spstream") { return; }

  // get the list of metadata tags
  // comments from jess, shoud be a more complex structure with types (int, float, string)
  //                     so that the format can be more than just a bunch of %s
  // also it would be neat if the interface could accomodate input such as
  // 1/  <format>%s-%s</format>
  //     <tag>enc:cell_line</tag>
  //     <tag>enc:antibody</tag>  
  // 2/  <format>%s-%s</format>
  //     <tag>enc:cell_line,enc:antibody</tag>  // aka comma delim
  // 3/  <format>%s-%s</format>
  //     <tag>enc:cell_line enc:antibody</tag> // aka space delim

  if((node = root_node->first_node("tag")) != NULL) { 
    while(node) {
      t_md_prefix md_el;
      md_el.tag = node->value();
      md_el.prefix = " ";
      if((attr = node->first_attribute("prefix"))) { md_el.prefix = attr->value(); }
      _prefix_tags.push_back(md_el);
      node = node->next_sibling("tag");
    }    
  }
}

string EEDB::SPStreams::MetadataManipulate::_display_desc() {
  return "MetadataManipulate";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::MetadataManipulate::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }

  if(obj->classname() == EEDB::Experiment::class_name) {
    EEDB::Experiment *experiment = (EEDB::Experiment*)obj;
    _process_experiment(experiment);
  }
  //other classes are not modified
  
  //everything is just passed through
  return obj;
}


void  EEDB::SPStreams::MetadataManipulate::_process_experiment(EEDB::Experiment *experiment) {
  if(experiment == NULL) { return; }
  
  experiment->metadataset(); //lazy load if needed
  experiment->clear_xml_caches();

  //fprintf(stderr, "MetadataManipulate exp [%s]\n", experiment->db_id().c_str());
  string new_name;
  for(unsigned int i=0; i<_prefix_tags.size(); i++) {
    string value = "";

    EEDB::Metadata *md = experiment->metadataset()->find_metadata(_prefix_tags[i].tag, "");
    if (md != NULL){ value = md->data(); }
    new_name += _prefix_tags[i].prefix;
    new_name += value;
  }

  experiment->display_name(new_name);
}
