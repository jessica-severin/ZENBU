/* $Id: Expression.cpp,v 1.117 2013/04/08 05:47:52 severin Exp $ */

/***
NAME - EEDB::Expression

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
#include <EEDB/Expression.h>
#include <EEDB/Feature.h>
#include <EEDB/Experiment.h>
#include <EEDB/Datatype.h>

//initialize global variables
vector<EEDB::Expression*>    EEDB::Expression::_realloc_expression_array(1024);
int                          EEDB::Expression::_realloc_idx = 0;
const char*                  EEDB::Expression::class_name = "Expression";


using namespace std;
using namespace MQDB;
using namespace boost::algorithm;

/* xml
  Description: every object in system should be persistable in XML format.
               returns an XML description of the object and all child objects.
               Each subclass must implement and return a proper XML string.
               Convenient to use an xml_start() xml_end() pattern.
*/
void _eedb_expression_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Expression*)obj)->_xml(xml_buffer);
}


/* simple_xml
  Description: Can be used when only the primary XML start tag and attributes are needed
               Convenient to use an xml_start() xml_end() pattern.
*/
void _eedb_expression_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Expression*)obj)->_simple_xml(xml_buffer);
}


EEDB::Expression::Expression() {
  //in general do not use, instead use
  //  EEDB::Expression *obj = EEDB::Expression::realloc();  //to 'new'
  init();
}

EEDB::Expression::~Expression() {
  _dealloc();
}

//////////////////////////////////////////////////////////////////////////

//memory management system to reuse object memory
EEDB::Expression*  EEDB::Expression::realloc() {
  if(_realloc_idx > 0) {
    EEDB::Expression *obj = _realloc_expression_array[_realloc_idx];
    _realloc_expression_array[_realloc_idx] = NULL;
    _realloc_idx--;
    obj->init();
    return obj;
  }
  EEDB::Expression  *obj  = new EEDB::Expression();
  return obj;    
}

//delete functions
void _eedb_expression_delete_func(MQDB::DBObject *obj) { 
  EEDB::Expression::_realloc((EEDB::Expression*)obj);  //fake delete
}

void  EEDB::Expression::_dealloc() {
  //printf("expression dealloc\n");
  //fake delete
  if(_feature != NULL) {
    _feature->release();
    _feature = NULL;
  }
  if(_experiment != NULL) {
    _experiment->release();
    _experiment = NULL;
  }
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}

void  EEDB::Expression::_realloc(EEDB::Expression *obj) {
  if(_realloc_idx < 1000) {
    obj->_dealloc();  //releases internal object references
    _realloc_idx++;
    _realloc_expression_array[_realloc_idx] = obj;
  } else {
    delete obj;
  }
}

//////////////////////////////////////////////////////////////////////////

void EEDB::Expression::init() {
  MQDB::MappedQuery::init();
  _classname            = EEDB::Expression::class_name;
  _funcptr_delete       = _eedb_expression_delete_func;
  _funcptr_xml          = _eedb_expression_xml_func;
  _funcptr_simple_xml   = _eedb_expression_simple_xml_func;

  _value          = 0.0;
  _sig_error      = 1.0;
  _count          = 1;
  _duplication    = 1.0;
  
  _experiment     = NULL;
  _feature        = NULL;
  _datatype       = NULL;
  _experiment_id  = -1;
  _feature_id     = -1;
  _experiment_dbid.clear();
}


bool EEDB::Expression::operator== (const EEDB::Expression& b) {
  return (
          (_datatype == b._datatype) && 
          (_value == b._value));
}

bool EEDB::Expression::operator!= (const EEDB::Expression& b) {
  return (
          (_datatype != b._datatype) || 
          (_value != b._value));
}

bool EEDB::Expression::operator< (const EEDB::Expression& b) {
  if(_datatype != b._datatype) {
    if(_datatype < b._datatype) { return true; } else { return false; }
  }
  return (_value < b._value);
  /*
  # merge function
  # for expression ::   ORDER BY chrom_start, chrom_end, fe.feature_id, experiment_id, datatype
  if((a_class eq 'Expression') and (b_class eq 'Expression')) {

    if($obj1->experiment->id lt $obj2->experiment->id) { return -1; } 
    if($obj1->experiment->id gt $obj2->experiment->id) { return 1; } 

    if($obj1->type lt $obj2->type) { return -1; } 
    if($obj1->type gt $obj2->type) { return 1; } 
  }
  return 0; # same, equals
  */
}


void EEDB::Expression::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Expression::display_desc() {
  char buffer[2048];
  string str = "Expression(" + db_id() +")";
  
  if(feature()) {
    snprintf(buffer, 2040, " %s[%ld] %s <=>", 
         _feature->primary_name().c_str(), _feature->primary_id(), _feature->chrom_location().c_str());
    str += buffer;       
  }
  if(experiment()) {
    str += _experiment->display_name() +"["+ _experiment->db_id() +"]";
  }

  snprintf(buffer, 2040, " : [%s | %1.7f value | %1.5f sigerr]", _datatype->type().c_str(), _value, _sig_error);
  str += buffer;       
  return str;
}

string EEDB::Expression::display_contents() {
  return display_desc();
}

void EEDB::Expression::_xml_start(string &xml_buffer) {
  //change XML to be more simple, basic info and IDs in xml_start()
  //but Feature/Experiment object simple_xml in full xml()
  char buffer[2048];

  xml_buffer.append("<expression datatype=\"");
  xml_buffer.append(_datatype->type());
  xml_buffer.append("\" ");
  snprintf(buffer, 2040, "value=\"%1.13g\" ", _value);
  xml_buffer.append(buffer);
  if(_sig_error != 1.0) {
    snprintf(buffer, 2040, "sig=\"%g\" ", _sig_error);
    xml_buffer.append(buffer);
  }
  if(_count!=1) {
    snprintf(buffer, 2040, "count=\"%ld\" ", _count);
    xml_buffer.append(buffer);
  }
  if(_duplication!=1.0) {
    snprintf(buffer, 2040, "dup=\"%1.13g\" ", _duplication);
    xml_buffer.append(buffer);
  }
  
  if(feature()) { 
    xml_buffer.append("feature_id=\"");
    xml_buffer.append(_feature->db_id());
    xml_buffer.append("\" ");
  }
  xml_buffer += "experiment_id=\"" + experiment_dbid() + "\" ";

  xml_buffer.append(">");
}

void EEDB::Expression::_xml_end(string &xml_buffer) {
  xml_buffer.append("</expression>\n");
}

void EEDB::Expression::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::Expression::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  if(feature())    { _feature->simple_xml(xml_buffer); }
  if(experiment()) { _experiment->simple_xml(xml_buffer); }
  _xml_end(xml_buffer);
}


bool EEDB::Expression::init_from_xml(void *xml_node) {
  // init using a rapidxml node
  init();
  if(xml_node==NULL) { return false; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if(strcmp(root_node->name(), "expression")!=0) { return false; }
  
  if((attr = root_node->first_attribute("datatype"))) { _datatype = EEDB::Datatype::get_type(attr->value()); }
  if((attr = root_node->first_attribute("value")))    { _value = strtod(attr->value(), NULL); }
  if((attr = root_node->first_attribute("sig")))      { _sig_error = strtod(attr->value(), NULL); }
  if((attr = root_node->first_attribute("count")))    { _count = strtol(attr->value(), NULL, 10); }
  if((attr = root_node->first_attribute("dup")))      { _duplication = strtod(attr->value(), NULL); }
  //if((attr = root_node->first_attribute("feature_id"))) { }
  if((attr = root_node->first_attribute("experiment_id"))) { _experiment_dbid = attr->value(); }
  return true;
}


string   EEDB::Expression::bed_description(string format) {
  string str;
  char buffer[2048];

  //BED3
  snprintf(buffer, 2040, "%s\t%ld\t%ld", chrom_name().c_str(), chrom_start(), chrom_end());
  str = buffer;
  if(format.empty()) { return str; } //default to BED3 if not specified
  boost::algorithm::to_lower(format);
  if(format == "bed3") { return str; }

  //both BED6 and BED12 have these next 3 columns
  string name = primary_name();
  if(experiment()) { name += "_" + experiment()->name(); }
  name += "_" + _datatype->type();

  snprintf(buffer, 2040, "\t%s\t%1.9f\t%c", name.c_str(), _value, strand());
  str += buffer;
  if(format == "bed6") { return str; }

  if(format == "bed12") {
    // thickStart, thickEnd, itemRgb, blockCount, blockSizes, blockStarts
    long int thickStart  = chrom_start();
    long int thickEnd    = chrom_end();
    string   blockStarts;
    string   blockSizes;
    long int blockCount  = 0;

    snprintf(buffer, 2040, "\t%ld\t%ld\t%d\t%ld", thickStart, thickEnd, 0, blockCount);
    str += buffer;
    str += "\t" + blockSizes + "\t" + blockStarts;
  }
  return str;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

/*
void   EEDB::Expression::set(EEDB::Experiment *exp, EEDB::Datatype *type, double value) {
  if(exp != NULL) { exp->retain(); }
  if(_experiment != NULL) { _experiment->release(); }
  _experiment = exp;
  _datatype = type;
  _value = value;
}
*/

void   EEDB::Expression::value(double value) { _value = value; };
void   EEDB::Expression::count(long int value) { _count = value; };
void   EEDB::Expression::sig_error(double value) { _sig_error = value; }

void   EEDB::Expression::datatype(string value) { 
  _datatype = EEDB::Datatype::get_type(value); 
}
void   EEDB::Expression::datatype(EEDB::Datatype *type) { 
  _datatype = type; 
}

void   EEDB::Expression::experiment(EEDB::Experiment *source) {
  if(source != NULL) { source->retain(); }
  if(_experiment != NULL) { _experiment->release(); }
  _experiment = source;
  _experiment_dbid.clear();
}

EEDB::Experiment*  EEDB::Expression::experiment() {
  if(_experiment != NULL) { return _experiment; }
  
  if(_database and (_experiment_id != -1)) { //lazy load from database
    _experiment = EEDB::Experiment::fetch_by_id(_database, _experiment_id);
  }
  if(!_experiment_dbid.empty()) {
    _experiment = (EEDB::Experiment*)EEDB::DataSource::sources_cache_get(_experiment_dbid);
    if(_experiment) { _experiment->retain(); }
  }  
  return _experiment;
}

EEDB::Feature*  EEDB::Expression::feature() {
  if(_feature != NULL) { return _feature; }
  
  if(_database and (_feature_id != -1)) { //lazy load from database
    _feature = EEDB::Feature::fetch_by_id(_database, _feature_id);
  }
  return _feature;
}
void  EEDB::Expression::feature(EEDB::Feature* obj) {
  if(_feature != NULL) { _feature->release(); }
  _feature = obj;
  if(_feature != NULL) { _feature->retain(); }
}

string  EEDB::Expression::experiment_dbid() {
  if(!_experiment_dbid.empty()) { return _experiment_dbid; }
  if(experiment()) { return _experiment->db_id(); }
  return "";
}


////////////////////////////
// redirect methods to internal _feature object
// allows Expression objects to be treated as Feature object on a stream
// only implement read access
//

string  EEDB::Expression::primary_name() {
  if(feature()) { return _feature->primary_name(); }
  return string("");
}

string  EEDB::Expression::chrom_name() {
  if(feature()) { return _feature->chrom_name(); }
  return string("");
}

long int  EEDB::Expression::chrom_start() {
  if(feature()) { return _feature->chrom_start(); }
  return -1;
}

long int  EEDB::Expression::chrom_end() {
  if(feature()) { return _feature->chrom_end(); }
  return -1;
}

char  EEDB::Expression::strand() {
  if(feature()) { return _feature->strand(); }
  return '\0';
}

string  EEDB::Expression::chrom_location() {
  if(feature()) { return _feature->chrom_location(); }
  return string("");
}

long int  EEDB::Expression::chrom_id() {
  if(feature()) { return _feature->chrom_id(); }
  return -1;
}

EEDB::Chrom*  EEDB::Expression::chrom() {
  if(feature()) { return _feature->chrom(); }
  return NULL;
}


//
// static member functions for object retrieval from database
//

EEDB::Expression*  EEDB::Expression::fetch_by_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT * FROM expression JOIN expression_datatype USING(datatype_id) WHERE expression_id=?";
  return (EEDB::Expression*) MQDB::fetch_single(EEDB::Expression::create, db, sql, "d", id);
}

vector<DBObject*>  EEDB::Expression::fetch_all_by_feature_id(MQDB::Database *db, long int id) {
  //being called from a Feature that is already in memory so do not join to feature table
  const char *sql = "SELECT * FROM expression JOIN expression_datatype USING(datatype_id) WHERE feature_id=?";
  return MQDB::fetch_multiple(EEDB::Expression::create, db, sql, "d", id);
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::Expression::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["expression_id"].i_int;
  _value           = row_map["value"].i_double;
  _sig_error       = row_map["sig_error"].i_double;

  _feature_id      = row_map["feature_id"].i_int;
  _experiment_id   = row_map["experiment_id"].i_int;

  if(row_map["datatype"].type == MQDB::STRING) {
    _datatype = EEDB::Datatype::get_type(row_map["datatype"].i_string);
  }
}



/*****************

sub store {
  my $self = shift;
  my $db   = shift;
  
  if($db) { $self->database($db); }
  my $dbh = $self->database->get_connection;  
  my $sql = "INSERT ignore INTO expression ".
             "(experiment_id, feature_id, type, value, sig_error) ".
             "VALUES(?,?,?,?,?)";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->experiment->id,
                $self->feature->id,
                $self->type,
                $self->value,
                $self->sig_error
                );  
  my $dbID = $dbh->last_insert_id(undef, undef, qw(expression expression_id));
  $sth->finish;
  if(!$dbID) {
    $dbID = $self->fetch_col_value(
         $db,
         "select expression_id from expression where experiment_id=? and feature_id=?",
         $self->experiment->id,
         $self->feature->id);
    
  }
  $self->primary_id($dbID);

  return $self;
}

*/

