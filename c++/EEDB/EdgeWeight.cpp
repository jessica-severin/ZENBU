/* $Id: EdgeWeight.cpp,v 1.2 2017/07/25 06:31:18 severin Exp $ */

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

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sqlite3.h>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>

#include <MQDB/MappedQuery.h>
#include <EEDB/EdgeWeight.h>
#include <EEDB/Edge.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/Datatype.h>

//initialize global variables
vector<EEDB::EdgeWeight*>    EEDB::EdgeWeight::_realloc_edgeweight_array(8096);
int                          EEDB::EdgeWeight::_realloc_idx = 0;
const char*                  EEDB::EdgeWeight::class_name = "EdgeWeight";


using namespace std;
using namespace MQDB;
using namespace boost::algorithm;

void _eedb_edgeweight_delete_func(MQDB::DBObject *obj) {
  EEDB::EdgeWeight::_realloc((EEDB::EdgeWeight*)obj);  //fake delete
}
void _eedb_edgeweight_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::EdgeWeight*)obj)->_xml(xml_buffer);
}
void _eedb_edgeweight_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::EdgeWeight*)obj)->_simple_xml(xml_buffer);
}


EEDB::EdgeWeight::EdgeWeight() {
  //in general do not use, instead use
  //  EEDB::EdgeWeight *obj = EEDB::EdgeWeight::realloc();  //to 'new'
  init();
}

EEDB::EdgeWeight::~EdgeWeight() {
  _dealloc();
}

void  EEDB::EdgeWeight::_dealloc() {
  //printf("edgeweight dealloc\n");
  //fake delete
  if(_edge != NULL) {
    _edge->release();
    _edge = NULL;
  }
  if(_datasource != NULL) {
    _datasource->release();
    _datasource = NULL;
  }
}

//////////////////////////////////////////////////////////////////////////
//memory management system to reuse object memory
EEDB::EdgeWeight*  EEDB::EdgeWeight::realloc() {
  if(_realloc_idx > 0) {
    EEDB::EdgeWeight *obj = _realloc_edgeweight_array[_realloc_idx];
    _realloc_edgeweight_array[_realloc_idx] = NULL;
    _realloc_idx--;
    obj->init();
    return obj;
  }
  EEDB::EdgeWeight  *obj  = new EEDB::EdgeWeight();
  return obj;    
}

void  EEDB::EdgeWeight::_realloc(EEDB::EdgeWeight *obj) {
  if(_realloc_idx < 8000) {
    obj->_dealloc();  //releases internal object references
    _realloc_idx++;
    _realloc_edgeweight_array[_realloc_idx] = obj;
  } else {
    delete obj;
  }
}

//////////////////////////////////////////////////////////////////////////

void EEDB::EdgeWeight::init() {
  MQDB::MappedQuery::init();
  _classname            = EEDB::EdgeWeight::class_name;
  _funcptr_delete       = _eedb_edgeweight_delete_func;
  _funcptr_xml          = _eedb_edgeweight_xml_func;
  _funcptr_simple_xml   = _eedb_edgeweight_simple_xml_func;

  _datatype        = NULL;
  _weight          = 0.0;
  
  _datasource      = NULL;
  _edge            = NULL;
  _datasource_dbid.clear();
}


bool EEDB::EdgeWeight::operator== (const EEDB::EdgeWeight& b) {
  return (
          (_datatype == b._datatype) && 
          (_weight == b._weight));
}

bool EEDB::EdgeWeight::operator!= (const EEDB::EdgeWeight& b) {
  return (
          (_datatype != b._datatype) || 
          (_weight != b._weight));
}

bool EEDB::EdgeWeight::operator< (const EEDB::EdgeWeight& b) {
  if(_datatype != b._datatype) {
    if(_datatype < b._datatype) { return true; } else { return false; }
  }
  return (_weight < b._weight);
}


void EEDB::EdgeWeight::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::EdgeWeight::display_desc() {
  char buffer[2048];
  string str = "EdgeWeight";
  
  if(datasource()) {
    str += _datasource->display_name() +"["+ _datasource->db_id() +"]";
  }
  if(_datatype) {
    snprintf(buffer, 2040, " : [%s | %1.7f weight]", _datatype->type().c_str(), _weight);
    str += buffer;       
  }
  return str;
}

string EEDB::EdgeWeight::display_contents() {
  return display_desc();
}

void EEDB::EdgeWeight::_xml_start(string &xml_buffer) {
  char buffer[2048];

  xml_buffer.append("<edgeweight datatype=\"");
  xml_buffer.append(_datatype->type());
  xml_buffer.append("\" ");
  
  snprintf(buffer, 2040, "weight=\"%1.13g\" ", _weight);
  xml_buffer.append(buffer);
  
  xml_buffer += "datasource_id=\"" + datasource_dbid() + "\" ";

  xml_buffer.append(">");
}

void EEDB::EdgeWeight::_xml_end(string &xml_buffer) {
  xml_buffer.append("</edgeweight>");
}

void EEDB::EdgeWeight::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::EdgeWeight::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  if(datasource()) { _datasource->simple_xml(xml_buffer); }
  _xml_end(xml_buffer);
}


bool EEDB::EdgeWeight::init_from_xml(void *xml_node) {
  // init using a rapidxml node
  init();
  if(xml_node==NULL) { return false; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if(strcmp(root_node->name(), "edgeweight")!=0) { return false; }
  
  if((attr = root_node->first_attribute("datatype"))) { _datatype = EEDB::Datatype::get_type(attr->value()); }
  if((attr = root_node->first_attribute("weight")))    { _weight = strtod(attr->value(), NULL); }
  if((attr = root_node->first_attribute("datasource_id"))) { _datasource_dbid = attr->value(); }
  return true;
}


////////////////////////////////////////////////////
//
// getter/setter methods
//
////////////////////////////////////////////////////

//getters
EEDB::Datatype*  EEDB::EdgeWeight::datatype() { return _datatype; }
double           EEDB::EdgeWeight::weight() { return _weight; }

EEDB::DataSource*  EEDB::EdgeWeight::datasource() {
  if(_datasource != NULL) { return _datasource; }
  if(!_datasource_dbid.empty()) {
    _datasource = EEDB::DataSource::sources_cache_get(_datasource_dbid);
    if(_datasource) { _datasource->retain(); }
  }
  return _datasource;
}

string  EEDB::EdgeWeight::datasource_dbid() {
  if(!_datasource_dbid.empty()) { return _datasource_dbid; }
  if(datasource()) { return _datasource->db_id(); }
  return "";
}

EEDB::Edge*  EEDB::EdgeWeight::edge() {
  return _edge;
}

//setters
void   EEDB::EdgeWeight::weight(double weight) {
  _weight = weight;
}

void   EEDB::EdgeWeight::datatype(string type) {
  _datatype = EEDB::Datatype::get_type(type);
}

void   EEDB::EdgeWeight::datatype(EEDB::Datatype *type) { 
  _datatype = type; 
}

void   EEDB::EdgeWeight::datasource(EEDB::DataSource *source) {
  if(source != NULL) { source->retain(); }
  if(_datasource != NULL) { _datasource->release(); }
  _datasource = source;
  _datasource_dbid.clear();
}

void   EEDB::EdgeWeight::datasource_dbid(string value) {
  if(_datasource != NULL) { _datasource->release(); }
  _datasource = NULL;
  _datasource_dbid = value;
}

void  EEDB::EdgeWeight::edge(EEDB::Edge* obj) {
  if(_edge != NULL) { _edge->release(); }
  _edge = obj;
  if(_edge != NULL) { _edge->retain(); }
}



