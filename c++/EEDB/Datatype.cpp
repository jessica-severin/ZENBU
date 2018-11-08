/*  $Id: Datatype.cpp,v 1.7 2013/04/08 05:47:52 severin Exp $ */

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

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <EEDB/Datatype.h>

map<string, EEDB::Datatype*>   EEDB::Datatype::_datatype_cache;

////////////////////////////////////////////////////
// static class methods

EEDB::Datatype* EEDB::Datatype::get_type(const char *type) {
  string strtype = type;
  return get_type(strtype);
}

EEDB::Datatype*  EEDB::Datatype::get_type(string &type) {
  if(_datatype_cache.find(type) != _datatype_cache.end()) {
    return _datatype_cache[type];
  }
  Datatype *obj = new EEDB::Datatype;
  obj->_datatype = type;
  _datatype_cache[type] = obj;
  return obj;
}

EEDB::Datatype*  EEDB::Datatype::from_xml(void *xml_node) {
  //constructor using a rapidxml node
  if(xml_node==NULL) { return NULL; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "datatype") { return NULL; }
  if((attr = root_node->first_attribute("type"))) { 
    return get_type(attr->value());
  }
  if((attr = root_node->first_attribute("value"))) { 
    return get_type(attr->value());
  }
  if(root_node->value()) { 
    return get_type(root_node->value());
  }
  return NULL;
}

////////////////////////////////////////////////////

bool EEDB::Datatype::operator==(EEDB::Datatype* b) {
  return (this->_datatype == b->_datatype);
}

bool EEDB::Datatype::operator==(string &b) {
  return (this->_datatype == b);
}

bool EEDB::Datatype::operator==(const char* b) {
  return (this->_datatype == b);
}


bool EEDB::Datatype::operator!=(EEDB::Datatype* b) {
  return (this->_datatype != b->_datatype);
}

bool EEDB::Datatype::operator!=(string &b) {
  return (this->_datatype != b);
}

bool EEDB::Datatype::operator!=(const char* b) {
  return (this->_datatype != b);
}


string EEDB::Datatype::xml() {
  string xml_buffer;
  xml(xml_buffer);  //does func_ptr magic
  return xml_buffer;
}

void EEDB::Datatype::xml(string &xml_buffer) {
  xml_buffer.append("<datatype type=\"");
  xml_buffer.append(_datatype);
  xml_buffer.append("\"/>");
}




