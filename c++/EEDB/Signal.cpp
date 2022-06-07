/* $Id: Signal.cpp,v 1.120 2021/07/02 05:22:26 severin Exp $ */

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

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sqlite3.h>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>

#include <MQDB/DBObject.h>
#include <EEDB/DataSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Signal.h>

//initialize global variables
vector<EEDB::Signal*>    EEDB::Signal::_realloc_signal_array(1024);
int                      EEDB::Signal::_realloc_idx = 0;
const char*              EEDB::Signal::class_name = "Signal";


using namespace std;
using namespace MQDB;
using namespace boost::algorithm;

void _eedb_signal_delete_func(MQDB::DBObject *obj) { 
  EEDB::Signal::_realloc((EEDB::Signal*)obj);  //fake delete
}
void _eedb_signal_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Signal*)obj)->_xml(xml_buffer);
}
void _eedb_signal_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Signal*)obj)->_simple_xml(xml_buffer);
}


EEDB::Signal::Signal() {
  //in general do not use, instead use
  //  EEDB::Signal *obj = EEDB::Signal::realloc();  //to 'new'
  init();
}

EEDB::Signal::~Signal() {
  _dealloc();
}

//////////////////////////////////////////////////////////////////////////

//memory management system to reuse object memory
EEDB::Signal*  EEDB::Signal::realloc() {
  if(_realloc_idx > 0) {
    EEDB::Signal *obj = _realloc_signal_array[_realloc_idx];
    _realloc_signal_array[_realloc_idx] = NULL;
    _realloc_idx--;
    obj->init();
    return obj;
  }
  EEDB::Signal  *obj  = new EEDB::Signal();
  return obj;    
}

void  EEDB::Signal::_dealloc() {
  //printf("signal dealloc\n");
  //fake delete
  if(_datasource != NULL) {
    _datasource->release();
    _datasource = NULL;
  }
}

void  EEDB::Signal::_realloc(EEDB::Signal *obj) {
  if(_realloc_idx < 1000) {
    obj->_dealloc();  //releases internal object references
    _realloc_idx++;
    _realloc_signal_array[_realloc_idx] = obj;
  } else {
    delete obj;
  }
}

//////////////////////////////////////////////////////////////////////////

void EEDB::Signal::init() {
  MQDB::DBObject::init();
  _classname            = EEDB::Signal::class_name;
  _funcptr_delete       = _eedb_signal_delete_func;
  _funcptr_xml          = _eedb_signal_xml_func;
  _funcptr_simple_xml   = _eedb_signal_simple_xml_func;

  _value          = 0.0;
  _datatype       = NULL;
  _datasource     = NULL;
}


bool EEDB::Signal::operator== (const EEDB::Signal& b) {
  return (
          (_datatype == b._datatype) && 
          (_value == b._value));
}

bool EEDB::Signal::operator!= (const EEDB::Signal& b) {
  return (
          (_datatype != b._datatype) || 
          (_value != b._value));
}

bool EEDB::Signal::operator< (const EEDB::Signal& b) {
  if(_datatype != b._datatype) {
    if(_datatype < b._datatype) { return true; } else { return false; }
  }
  return (_value < b._value);
}


string EEDB::Signal::display_desc() {
  char buffer[2048];
  string str = "Signal(" + db_id() +")";
  
  if(datasource()) {
    str += _datasource->display_name() +"["+ _datasource->db_id() +"]";
  }

  snprintf(buffer, 2040, " : [%s | %1.7f value]", _datatype->type().c_str(), _value);
  str += buffer;       
  return str;
}


void EEDB::Signal::_xml_start(string &xml_buffer) {
  //change XML to be more simple, basic info and IDs in xml_start()
  //but Feature/Experiment object simple_xml in full xml()
  char buffer[2048];

  xml_buffer.append("<signal datatype=\"");
  xml_buffer.append(_datatype->type());
  xml_buffer.append("\" ");
  snprintf(buffer, 2040, "value=\"%1.13g\" ", _value);
  xml_buffer.append(buffer);

  xml_buffer += "datasource_id=\"" + datasource_dbid() + "\" ";

  xml_buffer.append(">");
}

void EEDB::Signal::_xml_end(string &xml_buffer) {
  xml_buffer.append("</signal>\n");
}

void EEDB::Signal::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::Signal::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}


bool EEDB::Signal::init_from_xml(void *xml_node) {
  // init using a rapidxml node
  init();
  if(xml_node==NULL) { return false; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if((string(root_node->name()) != "expression") && (string(root_node->name()) != "signal")) { return false; }
     
  if((attr = root_node->first_attribute("datatype"))) { _datatype = EEDB::Datatype::get_type(attr->value()); }
  if((attr = root_node->first_attribute("value")))    { _value = strtod(attr->value(), NULL); }
  if((attr = root_node->first_attribute("datasource_id"))) { _datasource_dbid = attr->value(); }
  return true;
}



////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

EEDB::DataSource*  EEDB::Signal::datasource() {
  if(_datasource != NULL) { return _datasource; }
  if(!_datasource_dbid.empty()) {
    _datasource = EEDB::DataSource::sources_cache_get(_datasource_dbid);
    if(_datasource) { _datasource->retain(); }
  }
  return _datasource;
}

string  EEDB::Signal::datasource_dbid() {
  if(!_datasource_dbid.empty()) { return _datasource_dbid; }
  if(datasource()) { return _datasource->db_id(); }
  return "";
}

//setters

void   EEDB::Signal::value(double value) { 
  _value = value;
}

void   EEDB::Signal::datatype(string value) { 
  _datatype = EEDB::Datatype::get_type(value); 
}

void   EEDB::Signal::datatype(EEDB::Datatype *type) { 
  _datatype = type; 
}

void   EEDB::Signal::datasource(EEDB::DataSource *source) {
  if(source != NULL) { source->retain(); }
  if(_datasource != NULL) { _datasource->release(); }
  _datasource = source;
  _datasource_dbid.clear();
}

void   EEDB::Signal::datasource_dbid(string value) {
  if(_datasource != NULL) { _datasource->release(); }
  _datasource = NULL;
  _datasource_dbid = value;
}

