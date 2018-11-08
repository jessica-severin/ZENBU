/* $Id: CalcInterSubfeatures.cpp,v 1.7 2013/04/08 07:37:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::CalcInterSubfeatures

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
#include <EEDB/SPStreams/CalcInterSubfeatures.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::CalcInterSubfeatures::class_name = "EEDB::SPStreams::CalcInterSubfeatures";

//function prototypes
void _spstream_calcintersubfeatures_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::CalcInterSubfeatures*)obj;
}
MQDB::DBObject* _spstream_calcintersubfeatures_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::CalcInterSubfeatures*)node)->_next_in_stream();
}
void _spstream_calcintersubfeatures_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::CalcInterSubfeatures*)obj)->_xml(xml_buffer);
}
string _spstream_calcintersubfeatures_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::CalcInterSubfeatures*)obj)->_display_desc();
}


EEDB::SPStreams::CalcInterSubfeatures::CalcInterSubfeatures() {
  init();
}

EEDB::SPStreams::CalcInterSubfeatures::~CalcInterSubfeatures() {
}

void EEDB::SPStreams::CalcInterSubfeatures::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::CalcInterSubfeatures::class_name;
  _module_name               = "CalcInterSubfeatures";
  _funcptr_delete            = _spstream_calcintersubfeatures_delete_func;
  _funcptr_xml               = _spstream_calcintersubfeatures_xml_func;
  _funcptr_simple_xml        = _spstream_calcintersubfeatures_xml_func;
  _funcptr_display_desc      = _spstream_calcintersubfeatures_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream    = _spstream_calcintersubfeatures_next_in_stream_func;
  
  //attributes
  _new_subfeature_source   = new EEDB::FeatureSource();
  _new_subfeature_source->name("CalcInterSubfeatures");
  _new_subfeature_source->category("intron");
  
}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

string EEDB::SPStreams::CalcInterSubfeatures::_display_desc() {
  string str = "CalcInterSubfeatures";
  return str;
}


void EEDB::SPStreams::CalcInterSubfeatures::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
    
  if(!_subfeat_filter_categories.empty()) {
    map<string,bool>::iterator  it;
    for(it=_subfeat_filter_categories.begin(); it!=_subfeat_filter_categories.end(); it++) {
      xml_buffer.append("<category_filter>"+(it->first)+"</category_filter>");
    }
  }
  xml_buffer += "<new_subfeature_category>" + _new_subfeature_source->category() + "</new_subfeature_category>";
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::CalcInterSubfeatures::CalcInterSubfeatures(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "spstream") { return; }  

  if((node = root_node->first_node("category_filter")) != NULL) { 
    while(node) {
      string category = node->value();
      _subfeat_filter_categories[category] = true;
      node = node->next_sibling("category_filter");
    }    
  }
  
  if((node = root_node->first_node("new_subfeature_category")) != NULL) { 
    string ctg = node->value();
    if(!ctg.empty()) { _new_subfeature_source->category(ctg); }
  }
}


////////////////////////////////////////////////////////////////////////////
//
// callback methods 
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::CalcInterSubfeatures::_next_in_stream() {
  if(_source_stream == NULL) { return NULL; }

  MQDB::DBObject *obj = _source_stream->next_in_stream();
  if(obj == NULL) { return NULL; }
          
  if(obj->classname() == EEDB::Feature::class_name) {
    EEDB::Feature *feature = (EEDB::Feature*)obj;
    _calc_inter_subfeatures(feature);
  } 
  return obj;
}


void  EEDB::SPStreams::CalcInterSubfeatures::_calc_inter_subfeatures(EEDB::Feature* feature) {
  //final post processing of cluster prior to returning
  if(feature==NULL) { return; }
  
  vector<EEDB::Feature*> subfeatures = feature->subfeatures();
  if(subfeatures.empty()) { return; }
  
  EEDB::Feature *last_subfeat=NULL;
  
  for(unsigned int i=0; i<subfeatures.size(); i++) { 
    EEDB::Feature *subfeat = subfeatures[i];
    
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(!fsrc) { continue; }
    if(!_subfeat_filter_categories.empty() && !_subfeat_filter_categories[fsrc->category()]) { continue; }
    
    if(last_subfeat) {
      if(last_subfeat->chrom_end()+1 <= subfeat->chrom_start()-1) {
        //OK there is space between the subfeatures to create a new fill-in subfeature
        
        EEDB::Feature *sf2 = EEDB::Feature::realloc();
        sf2->feature_source(_new_subfeature_source);
        
        sf2->primary_name(last_subfeat->primary_name() + ".5");
        sf2->chrom(feature->chrom());
        sf2->strand(feature->strand());
        sf2->chrom_start(last_subfeat->chrom_end() + 1);
        sf2->chrom_end(subfeat->chrom_start()-1);
        
        feature->add_subfeature(sf2);
        sf2->release(); //because now retained by 'feature'
      }
    }

    last_subfeat = subfeat;        
  }
}


