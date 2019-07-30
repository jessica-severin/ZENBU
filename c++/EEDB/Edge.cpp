/* $Id: Edge.cpp,v 1.92 2019/02/27 09:00:17 severin Exp $ */

/***

NAME - EEDB::Edge

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

#include <MQDB/MappedQuery.h>
#include <EEDB/Edge.h>
#include <EEDB/Feature.h>
//#include <boost/algorithm/string.hpp>

using namespace std;
using namespace MQDB;

vector<EEDB::Edge*>    EEDB::Edge::_realloc_edge_array(8096);
int                    EEDB::Edge::_realloc_idx = 0;
const char*            EEDB::Edge::class_name = "Edge";

void _eedb_edge_delete_func(MQDB::DBObject *obj) { 
  EEDB::Edge::_realloc((EEDB::Edge*)obj);  //fake delete
}
void _eedb_edge_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Edge*)obj)->_xml(xml_buffer);
}
void _eedb_edge_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Edge*)obj)->_simple_xml(xml_buffer);
}


EEDB::Edge::Edge() {
  //in general do not use, instead use
  //  EEDB::Edge *obj = EEDB::Edge::realloc();  //to 'new'
  init();
}

EEDB::Edge::~Edge() {
  _dealloc();
}

void  EEDB::Edge::_dealloc() {
  //fake delete
  if(_edge_source != NULL) {
    _edge_source->release();
    _edge_source = NULL;
  }
  if(_database) {
    _database->release();
    _database = NULL;
  }
  
  _metadataset.clear();
  _metadata_loaded   = false;
  _direction         = ' ';
  _edge_source_id    = -1;

  if(_feature1 != NULL) { _feature1->release(); }
  if(_feature2 != NULL) { _feature2->release(); }
  _feature1 = NULL;
  _feature2 = NULL;
  _feature1_id = -1;
  _feature2_id = -1;
 
  //edge_weights
  for(unsigned int i=0; i<_edgeweight_array.size(); i++) {
    _edgeweight_array[i]->release();
  }
  _edgeweight_array.clear();
}


//////////////////////////////////////////////////////////////////////////
//memory management system to reuse object memory
EEDB::Edge*  EEDB::Edge::realloc() {
  if(_realloc_idx > 0) {
    EEDB::Edge *obj = _realloc_edge_array[_realloc_idx];
    _realloc_edge_array[_realloc_idx] = NULL;
    _realloc_idx--;
    obj->init();
    return obj;
  }
  EEDB::Edge  *obj  = new EEDB::Edge();
  return obj;
}

void  EEDB::Edge::_realloc(EEDB::Edge *obj) {
  if(_realloc_idx < 8000) {
    obj->_dealloc();  //releases internal object references
    _realloc_idx++;
    _realloc_edge_array[_realloc_idx] = obj;
  } else {
    delete obj;
  }
}

//////////////////////////////////////////////////////////////////////////

void EEDB::Edge::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::Edge::class_name;
  _funcptr_delete            = _eedb_edge_delete_func;
  _funcptr_xml               = _eedb_edge_xml_func;
  _funcptr_simple_xml        = _eedb_edge_simple_xml_func;
    
  _metadata_loaded   = false;
  _edge_source       = NULL;
  _feature1          = NULL;
  _feature2          = NULL;

  //_weight            = 0.0;
  _direction         = ' ';

  _feature1_id       = -1;
  _feature2_id       = -1;
  _edge_source_id    = -1;
}


EEDB::Edge* EEDB::Edge::copy() {
  return copy(NULL);
}


EEDB::Edge* EEDB::Edge::copy(EEDB::Edge* copy) {
  if(!copy) { copy = new EEDB::Edge; }

  copy->_primary_db_id          = _primary_db_id;
  copy->_database               = _database;
  copy->_db_id                  = _db_id;
  copy->_peer_uuid              = _peer_uuid;

  copy->_edge_source_id         = _edge_source_id;
  copy->_feature1_id            = _feature1_id;
  copy->_feature2_id            = _feature2_id;
  copy->_direction              = _direction;

  if(_edge_source) { _edge_source->retain(); }
  if(_feature1) { _feature1->retain(); }
  if(_feature2) { _feature2->retain(); }
  copy->_edge_source = _edge_source; 
  copy->_feature1 = _feature1; 
  copy->_feature2 = _feature2; 

  //maybe need deeper copy of these, or leave shallow/shared for now
  metadataset(); //make sure it is loaded
  copy->_metadata_loaded = _metadata_loaded;
  if(_metadata_loaded) {
    copy->_metadataset.clear();
    copy->_metadataset.merge_metadataset(&_metadataset);
    copy->_metadataset.remove_duplicates();
  }

  for(unsigned int i=0; i< _edgeweight_array.size(); i++) {
    EEDB::EdgeWeight *edgeweight = _edgeweight_array[i];
    copy->add_edgeweight(edgeweight);
  }

  return copy;
}


void EEDB::Edge::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::Edge::display_desc() {
  char buffer[2048];  
  snprintf(buffer, 2040, "Edge(%s) %s(%ld) => %s(%ld) : %s",
           db_id().c_str(), 
           feature1()->primary_name().c_str(),
           feature1_id(),
           feature2()->primary_name().c_str(),
           feature2_id(),
           //_weight,
           edge_source()->name().c_str()
           );  
  /*
  my $mdata_list = metadataset->metadata_list;
  my $first=1;
  if(defined($mdata_list) and (scalar(@$mdata_list))) {
    $str .= ' (';
    foreach my $mdata (@$mdata_list) {
      if($first) { $first=0; }
      else { $str .= ','; }
      $str .= sprintf("(%s,\"%s\")", $mdata->type, $mdata->data);
    }
    $str .= ')';
  }
  */
  return buffer;
}


string EEDB::Edge::display_contents() {
  string str = display_desc();
  /*
  my $str = sprintf("Edge(%s) %s(%s) => %s(%s) : %f %s",
           $self->id, 
           $self->feature1->primary_name,
           $self->feature1->id,
           $self->feature2->primary_name,
           $self->feature2->id,
           $self->weight,
           $self->edge_source->uqname
           );  
  $str .= "\n". $self->metadataset->display_contents;   
  */
  return str;
}


void EEDB::Edge::_xml_start(string &xml_buffer) {
  char buffer[2048];
  xml_buffer.append("<edge");

  xml_buffer.append(" id=\"");
  xml_buffer.append(db_id());
  xml_buffer.append("\"");

  snprintf(buffer, 2040, " dir=\"%c\"", _direction); 
  xml_buffer.append(buffer);

  //if(!_sub_type.empty()) {
  //  xml_buffer.append(" sub_type=\"");
  // xml_buffer.append(_sub_type);
  //  xml_buffer.append("\"");
  //}
  //if(_weight != 0.0) {
  //  snprintf(buffer, 2040, " weight=\"%1.17g\"", _weight);
  //  xml_buffer.append(buffer);
  //}

  /*
  if(feature1_id() != -1) { 
    snprintf(buffer, 2040, " f1id=\"%ld\"", feature1_id()); 
    xml_buffer.append(buffer);
  }
  if(feature2_id() != -1) { 
    snprintf(buffer, 2040, " f2id=\"%ld\"", feature2_id()); 
    xml_buffer.append(buffer);
  }
  */
  if(!feature1_dbid().empty()) {
    xml_buffer.append(" f1id=\"");
    xml_buffer.append(feature1_dbid());
    xml_buffer.append("\"");
  }
  if(!feature2_dbid().empty()) {
    xml_buffer.append(" f2id=\"");
    xml_buffer.append(feature2_dbid());
    xml_buffer.append("\"");
  }

  if(edge_source()) { 
    xml_buffer.append(" esrc_id=\"");
    xml_buffer.append(edge_source()->db_id());
    xml_buffer.append("\"");
  }

  xml_buffer.append(" >\n");
  
  for(unsigned int i=0; i< _edgeweight_array.size(); i++) {
    EEDB::EdgeWeight *edgeweight = _edgeweight_array[i];
    xml_buffer += "  ";
    edgeweight->simple_xml(xml_buffer);
    xml_buffer += "\n";
  }
  
  //for now I need to leave this in. the jscript is still not
  //smart enough to efficiently connect external edgesources 2012-05-29
  //if(edge_source()) { edge_source()->simple_xml(xml_buffer); }
}

void EEDB::Edge::_xml_end(string &xml_buffer) {  
  xml_buffer.append("</edge>\n");
}

void EEDB::Edge::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}

void EEDB::Edge::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);

  //if(feature1()) { 
  //  xml_buffer.append("<feature1>");
  //  feature1()->simple_xml(xml_buffer);
  //  xml_buffer.append("</feature1>");
  //}

  //if(feature2()) { 
  //  xml_buffer.append("<feature2>");
  //  feature2()->simple_xml(xml_buffer);
  //  xml_buffer.append("</feature2>");
  //}

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }

  _xml_end(xml_buffer);
}



////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

long int  EEDB::Edge::feature1_id() { 
  if(_feature1 != NULL) { return _feature1->primary_id(); }
  return _feature1_id;
}
long int  EEDB::Edge::feature2_id() { 
  if(_feature2 != NULL) { return _feature2->primary_id(); }
  return _feature2_id; 
}

string  EEDB::Edge::feature1_dbid() {
  if(_feature1 != NULL) { return _feature1->db_id(); }
  string uuid;
  if(edge_source()) {
    uuid = edge_source()->feature_source1_uuid();
  } else if(peer_uuid()) { uuid = peer_uuid(); }
  string dbid = uuid +"::"+ l_to_string(_feature1_id);
  return dbid;
}
string  EEDB::Edge::feature2_dbid() {
  if(_feature2 != NULL) { return _feature2->db_id(); }
  string uuid;
  if(edge_source()) {
    uuid = edge_source()->feature_source2_uuid();
  } else if(peer_uuid()) { uuid = peer_uuid(); }
  string dbid = uuid +"::"+ l_to_string(_feature2_id);
  return dbid;
}

//direct set feature1/2 primary_id, uses edge_source for peer/feature_source for lazy load or for exteranl bulk setting
void  EEDB::Edge::feature1_id(long int id) {
  if(_feature1 != NULL) { _feature1->release(); }
  _feature1 = NULL;
  _feature1_id = id;
}
void  EEDB::Edge::feature2_id(long int id) {
  if(_feature2 != NULL) { _feature2->release(); }
  _feature2 = NULL;
  _feature2_id = id;
}

// lazy load object methods
EEDB::MetadataSet*   EEDB::Edge::metadataset() {
  if(!_metadata_loaded) {
    _metadata_loaded = true;
    if(_database != NULL) {
    //  vector<DBObject*> symbols = EEDB::Symbol::fetch_all_by_edge_id(_database, _primary_db_id);
    //  _metadataset.add_metadata(symbols);
    //
    //  vector<DBObject*> mdata = EEDB::Metadata::fetch_all_by_edge_id(_database, _primary_db_id);
    //  _metadataset.add_metadata(mdata);
    }
  }
  return &_metadataset;
}


EEDB::EdgeSource*  EEDB::Edge::edge_source() {
  if(_edge_source != NULL) { return _edge_source; }
  if(_database and (_edge_source_id != -1)) { //lazy load from database
    _edge_source = EEDB::EdgeSource::fetch_by_id(_database, _edge_source_id);
    _edge_source->retain();
  }
  return _edge_source;
}

void  EEDB::Edge::edge_source(EEDB::EdgeSource* obj) {
  if(_edge_source != NULL) { _edge_source->release(); }
  _edge_source = obj;
  _edge_source_id = -1;
  if(_edge_source != NULL) { _edge_source->retain(); }
}


EEDB::Feature*  EEDB::Edge::feature1() {
  if(_feature1 != NULL) { return _feature1; }
  if(_database and (_feature1_id != -1)) { //lazy load from database
    _feature1 = EEDB::Feature::fetch_by_id(_database, _feature1_id);
  }
  return _feature1;
}

void  EEDB::Edge::feature1(EEDB::Feature* obj) {
  if(_feature1 != NULL) { _feature1->release(); }
  _feature1 = obj;
  _feature1_id = -1;
  if(_feature1 != NULL) { _feature1->retain(); }
}


EEDB::Feature*  EEDB::Edge::feature2() {
  if(_feature2 != NULL) { return _feature2; }
  if(_database and (_feature2_id != -1)) { //lazy load from database
    _feature2 = EEDB::Feature::fetch_by_id(_database, _feature2_id);
  }
  return _feature2;
}

void  EEDB::Edge::feature2(EEDB::Feature* obj) {
  if(_feature2 != NULL) { _feature2->release(); }
  _feature2 = obj;
  _feature2_id = -1;
  if(_feature2 != NULL) { _feature2->retain(); }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// edgeweight management API section
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

vector<EEDB::EdgeWeight*>  EEDB::Edge::edgeweight_array() {
  return _edgeweight_array;
}

void  EEDB::Edge::clear_edgeweight_array() {
  vector<EEDB::EdgeWeight*>::iterator  it;
  for(it = _edgeweight_array.begin(); it != _edgeweight_array.end(); it++) {
    (*it)->release();
  }
  _edgeweight_array.clear();
}


void  EEDB::Edge::add_edgeweight(EEDB::EdgeWeight *edgeweight) {
  if(edgeweight == NULL) { return; }
  if(!edgeweight->datasource()) { return; }
  edgeweight->retain();
  _edgeweight_array.push_back(edgeweight);
}

EEDB::EdgeWeight*  EEDB::Edge::add_edgeweight(EEDB::DataSource *datasource, string datatype, double weight) {
  if(datasource==NULL) { datasource = edge_source(); }
  EEDB::EdgeWeight *edgeweight = EEDB::EdgeWeight::realloc();
  edgeweight->datasource(datasource);
  edgeweight->datatype(EEDB::Datatype::get_type(datatype));
  edgeweight->weight(weight);
  //do not set the edge since this can cause looped memory reference
  _edgeweight_array.push_back(edgeweight);
  return edgeweight;
}

EEDB::EdgeWeight*  EEDB::Edge::find_edgeweight(EEDB::DataSource *datasource, EEDB::Datatype *datatype) {
  //searches for edgeweight, if it is not found it will return NULL
  for(unsigned int i=0; i< _edgeweight_array.size(); i++) {
    EEDB::EdgeWeight *edgeweight = _edgeweight_array[i];
    if((datasource != NULL) and (datasource->db_id() != edgeweight->datasource_dbid())) { continue; }
    if((datatype   != NULL) and (datatype != edgeweight->datatype())) { continue; }
    return edgeweight;
  }
  return NULL;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods : storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::Edge::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id    = row_map["edge_id"].i_int;
  _edge_source_id   = row_map["edge_source_id"].i_int;
  _feature1_id      = row_map["feature1_id"].i_int;
  _feature2_id      = row_map["feature2_id"].i_int;
  _direction        = row_map["direction"].i_string[0];
  if(_direction == '\0') { _direction = ' '; }
  
  string subtype = row_map["sub_type"].i_string;
  double weight = row_map["weight"].i_double;
  if(!subtype.empty() || weight!=0) {
    EEDB::EdgeWeight *edgeweight = EEDB::EdgeWeight::realloc();
    string source_dbid = string(_database->uuid()) +"::"+ l_to_string(_edge_source_id) + ":::EdgeSource";
    edgeweight->datasource_dbid(source_dbid);
    edgeweight->datatype(subtype);
    edgeweight->weight(weight);
    //edgeweight->datatype(row_map["sub_type"].i_string);
    //edgeweight->weight(row_map["weight"].i_double);
    _edgeweight_array.push_back(edgeweight);
  }
}


bool EEDB::Edge::store(MQDB::Database *db) {
  if(db==NULL) { return false; }

  long   esrc_id = -1;
  long   f1_id   = -1;
  long   f2_id   = -1;

  if(edge_source()) { esrc_id = edge_source()->primary_id(); }
  if(feature1())    { f1_id = feature1()->primary_id(); }
  if(feature2())    { f2_id = feature2()->primary_id(); }
  char dir[8];
  sprintf(dir, "%c", _direction);

  if(_edgeweight_array.empty()) {
    db->do_sql("INSERT ignore INTO edge (edge_source_id, feature1_id, feature2_id, direction, sub_type, weight) VALUES(?,?,?,?,?,?)", "dddssf",
               esrc_id, f1_id, f2_id, dir, "", 0.0);
  }
  for(unsigned int i=0; i< _edgeweight_array.size(); i++) {
    double weight = _edgeweight_array[i]->weight();
    string type   = _edgeweight_array[i]->datatype()->type();

    db->do_sql("INSERT ignore INTO edge (edge_source_id, feature1_id, feature2_id, direction, sub_type, weight) VALUES(?,?,?,?,?,?)", "dddssf",
               esrc_id, f1_id, f2_id, dir, type.c_str(), weight);
  }
  if(db->last_insert_id() < 0) { return false; }

  _primary_db_id = db->last_insert_id();
  database(db);
  _peer_uuid = NULL;
  _db_id.clear();

  return true;
}



EEDB::Edge*  EEDB::Edge::fetch_by_id(MQDB::Database *db, long int edge_id) {
  const char *sql = "SELECT * FROM edge WHERE edge_id=?";
  return (EEDB::Edge*) MQDB::fetch_single(EEDB::Edge::create, db, sql, "d", edge_id);
}


vector<MQDB::DBObject*>  EEDB::Edge::fetch_all_with_feature_id(MQDB::Database *db, long int feature_id) {
  const char *sql = "SELECT edge.* FROM edge JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature1_id=? \
                     UNION \
                     SELECT edge.* FROM edge JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature2_id=? \
                     ORDER BY LEAST(feature1_id, feature2_id ), direction";
  return MQDB::fetch_multiple(EEDB::Edge::create, db, sql, "dd", feature_id, feature_id);
}


vector<MQDB::DBObject*>  EEDB::Edge::fetch_all_with_feature_id(MQDB::Database *db, long int feature_id, long int source_id) {
  const char *sql = "SELECT * FROM edge WHERE edge_source_id=? AND feature1_id=? \
                     UNION \
                     SELECT * FROM edge WHERE edge_source_id=? AND feature2_id=? \
                     ORDER BY LEAST(feature1_id, feature2_id ), direction";
  return MQDB::fetch_multiple(EEDB::Edge::create, db, sql, "dddd", source_id, feature_id, source_id, feature_id);
}


vector<EEDB::Edge*>  EEDB::Edge::fetch_all_by_sources_features(MQDB::Database *db, vector<long int> &src_ids, vector<long int> &fids) {
  fprintf(stderr, "Edge::fetch_all_by_sources_features\n");
  vector<EEDB::Edge*>  edges;
  if(db==NULL) { return edges; }
  if(fids.empty() && src_ids.empty()) { return edges; }
  //if(fids.empty() || src_ids.empty()) { return edges; }

  char    buffer[64];
  vector<long int>::iterator  it1;

  //mysql> select * from edge where (feature1_id in( 238424,124121) or feature2_id in(238424,124121)) and edge_source_id in(1,2);

  //loop on source_ids
  string esrc;
  for(it1=src_ids.begin(); it1!=src_ids.end(); it1++) {
    if(it1 != src_ids.begin()) { esrc += ","; }
    snprintf(buffer, 63, "%ld", (*it1));
    esrc += buffer;
  }
  //fprintf(stderr, "esrc : %s\n", esrc.c_str());

  //loop on feature_ids
  string feats;
  for(it1=fids.begin(); it1!=fids.end(); it1++) {
    if(it1 != fids.begin()) { feats += ","; }
    snprintf(buffer, 63, "%ld", (*it1));
    feats += buffer;
  }
  //fprintf(stderr, "feat : %s\n", feats.c_str());

  //string sql = "SELECT * FROM edge WHERE (feature1_id in("+feats+") or feature2_id in("+feats+")) and edge_source_id in("+esrc+") ";
  //sql += " ORDER BY LEAST(feature1_id, feature2_id ), direction";

  string sql;
  if(fids.empty() && !src_ids.empty()) {
    sql = "SELECT * FROM edge WHERE edge_source_id in("+esrc+") ORDER BY LEAST(feature1_id, feature2_id ), direction";
  } else if(!fids.empty() && src_ids.empty()) {
    sql = "SELECT * FROM edge WHERE feature1_id in("+feats+") ";
    sql += "UNION ";
    sql += "SELECT * FROM edge WHERE feature2_id in("+feats+") ";
    sql += "ORDER BY LEAST(feature1_id, feature2_id ), direction";
  } else {
    sql = "SELECT * FROM edge WHERE feature1_id in("+feats+") and edge_source_id in("+esrc+") ";
    sql += "UNION ";
    sql += "SELECT * FROM edge WHERE feature2_id in("+feats+") and edge_source_id in("+esrc+") ";
    sql += "ORDER BY LEAST(feature1_id, feature2_id ), direction";
  }

  //fprintf(stderr, "%s\n", sql.c_str());
  vector<DBObject*> t_result = MQDB::fetch_multiple(EEDB::Edge::create, db, sql.c_str(), "");
  
  vector<MQDB::DBObject*>::iterator it2;
  for(it2=t_result.begin(); it2!=t_result.end(); it2++) {
    EEDB::Edge *edge = (EEDB::Edge*)(*it2);
    if(edge == NULL) { continue; }
    if(edge->classname() != EEDB::Edge::class_name) { continue; }
    edges.push_back(edge);
  }
  merge_edges(edges);
  return edges;
}


bool _edge_merge_sort_func (EEDB::Edge *a, EEDB::Edge *b) {
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  
  if((a->feature1_id() != -1) && (b->feature1_id() == -1)) { return true; }
  if((a->feature1_id() == -1) && (b->feature1_id() != -1)) { return false; }
  if((a->feature2_id() != -1) && (b->feature2_id() == -1)) { return true; }
  if((a->feature2_id() == -1) && (b->feature2_id() != -1)) { return false; }
  
  if(a->feature1_id() < b->feature1_id()) { return true; }
  if(a->feature1_id() > b->feature1_id()) { return false; }

  if(a->feature2_id() < b->feature2_id()) { return true; }
  if(a->feature2_id() > b->feature2_id()) { return false; }

  if(a->direction() < b->direction()) { return true; }
  if(a->direction() > b->direction()) { return true; }
  
  return false; //keep same
}


void  EEDB::Edge::merge_edges(vector<EEDB::Edge*> &edges) {
  if(edges.empty()) { return; }

  //fprintf(stderr, "merge %ld edges\n", edges.size());
  sort(edges.begin(), edges.end(), _edge_merge_sort_func);
  //fprintf(stderr, "merge edges: after sort\n");

  unsigned pos1=0, pos2=1;
  while(pos1 < edges.size()) {
    //fprintf(stderr, "p1=%d  p2=%d\n", pos1, pos2);
    EEDB::Edge* edge1 = edges[pos1];
    edge1->edge_source(); //make sure loaded and in DataSource::add_to_sources_cache
    if(edge1->feature1_id() == -1) {
      pos1++;
      pos2 = pos1 + 1;
      continue;
    }
    //edge1->metadataset(); //load
    if(pos2 < edges.size()) {
      //compare for merge
      EEDB::Edge* edge2 = edges[pos2];
      edge2->edge_source(); //make sure loaded and in DataSource::add_to_sources_cache
      if(edge2->feature1_id() == -1) {
        pos2++;
        continue;
      }
      if(edge1->peer_uuid() != edge2->peer_uuid()) {
        pos2++;
        continue;
      }
      if((edge1->feature1_id() == edge2->feature1_id()) &&
         (edge1->feature2_id() == edge2->feature2_id()) &&
         (edge1->direction() == edge2->direction())) {
        //merge match, first weights
        //fprintf(stderr, "merge:\n %s %s\n", edge1->simple_xml().c_str(), edge2->simple_xml().c_str());
        vector<EEDB::EdgeWeight*> weights = edge2->edgeweight_array();
        for(unsigned j=0; j<weights.size(); j++) {
          edge1->add_edgeweight(weights[j]);
        }

        //TODO: load metadata and merge 
        //edge2->metadataset(); //load

        //invalidate edge2 so it can be removed latter
        edge2->clear_edgeweight_array();
        edge2->feature1(NULL);
        edge2->feature2(NULL);
        pos2++;
      } else {
        //because of sort we know we are done and can move pos1 to next
        pos1++;
        pos2 = pos1 +1;
      }
    } else {
      //increment pos1, reset pos2
      pos1++;
      pos2 = pos1 +1;
    }
  }
  //fprintf(stderr, "resort and cleanup %ld edges\n", edges.size());
  //sort moves invalid edges to back, then remove them
  sort(edges.begin(), edges.end(), _edge_merge_sort_func);

  EEDB::Edge* edge = edges.back();
  while(edge && (edge->feature1_id() == -1)) {
    edges.pop_back();
    edge = edges.back();
  }
  //fprintf(stderr, "%ld edges after merge\n", edges.size());
}



/*
# $Id: Edge.cpp,v 1.92 2019/02/27 09:00:17 severin Exp $
=head1 NAME - EEDB::Edge

=head1 SYNOPSIS

=head1 DESCRIPTION

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

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

=head1 APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

=cut

my $__riken_EEDB_edge_global_should_cache = 0;
my $__riken_EEDB_edge_global_id_cache = {};
my $__riken_EEDB_edge_global_featureid_cache = {};

$VERSION = 0.953;

package EEDB::Edge;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use EEDB::Feature;
use EEDB::EdgeSource;
use EEDB::MetadataSet;

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "Edge"; }

sub set_cache_behaviour {
  my $class = shift;
  my $mode = shift;
  
  $__riken_EEDB_edge_global_should_cache = $mode;
  
  if(defined($mode) and ($mode eq '0')) {
    #if turning off caching, then flush the caches
    $__riken_EEDB_edge_global_id_cache = {};
    $__riken_EEDB_edge_global_featureid_cache = {};
  }
}

sub get_cache_size {
  return scalar(keys(%$__riken_EEDB_edge_global_id_cache));
}



#######################

sub get_neighbor {
  my $self = shift;
  my $feature = shift;

  my $dir = "";
  my $neighbor = undef;

  if($self->feature1_id == $feature->id) {
    $dir = "link_to";
    $neighbor = $self->feature2;
  } elsif($self->feature2_id == $feature->id) {
    $dir = "link_from";
    $neighbor = $self->feature1;
  } elsif($self->feature1_id == $self->feature2_id) {
    $dir = "link_self";
    $neighbor = $self->feature1;
  }
  return ($dir, $neighbor);
}


#################################################
#
# DBObject override methods
#
#################################################

sub store {
  my $self = shift;
  my $db   = shift;
  
  if($db) { $self->database($db); }
  my $dbh = $self->database->get_connection;  
  my $sql = "INSERT ignore INTO edge (
                feature1_id,
                feature2_id,
                sub_type,
                direction,
                edge_source_id,
                weight
                )
             VALUES(?,?,?,?,?,?)";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->feature1->id,
                $self->feature2->id,
                $self->sub_type,
                $self->direction,
                $self->edge_source->id,
                $self->weight);

  my $dbID = $sth->{'mysql_insertid'};
  #my $dbID = $dbh->last_insert_id(undef, undef, qw(edge edge_id));
  $sth->finish;
  $self->primary_id($dbID);

  return $self;
}

sub store_metadata {
  my $self = shift;
  unless($self->database) {
    printf(STDERR "ERROR: no database to store metadata\n");
    return;
  }

  my $mdata_list = $self->metadataset->metadata_list;
  foreach my $mdata (@$mdata_list) {
    if(!defined($mdata->primary_id)) { 
      $mdata->store($self->database);
    }
    $mdata->store_link_to_edge($self);
  }
}

sub check_exists_db {
  my $self = shift;
  
  unless($self->edge_source) { return undef; }
  unless($self->edge_source->database) { return undef; }
  if(defined($self->primary_id)) { return $self; }
  
  #check if it is already in the database
  my $dbc = $self->edge_source->database->get_connection;  
  my $sth = $dbc->prepare("SELECT edge_id FROM edge where feature1_id=? and feature2_id=? and edge_source_id=?");
  $sth->execute($self->feature1->id, $self->feature2->id, $self->edge_source->id);
  my ($edge_id) = $sth->fetchrow_array();
  $sth->finish;
  
  if($edge_id) {
    $self->primary_id($edge_id);
    $self->database($self->edge_source->database);
    return $self;
  } else {
    return undef;
  }
}

*/


/*
 static long int
 get_count_symbol_search(MQDB::Database *db, string value, string type) {
 const char *sql = "SELECT count(distinct symbol_id) from symbol WHERE sym_type=? AND sym_value like ?";
 value += "%";
 dynadata dd = db->fetch_col_value(sql, "ss", type.c_str(), value.c_str());
 return dd.i_int;
 }
 */


/*
 ##### public class methods for fetching by utilizing DBObject framework methods #####
 
 
 sub fetch_all_by_source {
 my $class = shift;
 my $db = shift;
 my $link_source = shift; #EdgeSource object
 
 my $sql = "SELECT * FROM edge WHERE edge_source_id=?";
 return $class->fetch_multiple($db, $sql, $link_source->id);
 }
 
 sub stream_all_by_source {
 my $class = shift;
 my $source = shift; #EdgeSource object with database connection
 my $sort = shift; #optional flag for sorting
 
 return undef unless($source and $source->database);
 
 my $sql = "SELECT * FROM edge WHERE edge_source_id=? ";
 if(defined($sort) and ($sort eq 'f1')) { $sql .= "ORDER by feature1_id "; }
 if(defined($sort) and ($sort eq 'f2')) { $sql .= "ORDER by feature2_id "; }
 return $class->stream_multiple($source->database, $sql, $source->id);
 }
 */

/*
 sub fetch_all_from_feature_id {
 my $class = shift;
 my $db = shift;
 my $id = shift;
 my $edge_source_ids = shift; #optional
 
 my $sql = sprintf("SELECT * FROM edge fl JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature1_id='%s' ", $id);
 if(defined($edge_source_ids)) {
 $sql .= sprintf("AND fl.edge_source_id in(%s)", $edge_source_ids);
 }
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_to_feature_id {
 my $class = shift;
 my $db = shift;
 my $id = shift;
 my $edge_source_ids = shift; #optional
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) WHERE is_active='y' AND feature2_id='%s' ", $id);
 if(defined($edge_source_ids)) {
 $sql .= sprintf("AND fl.edge_source_id in(%s)", $edge_source_ids);
 }
 return $class->fetch_multiple($db, $sql);
 }
 */

/*
 sub fetch_all_with_feature {
 my $class = shift;
 my $feature = shift;
 my %options = @_; #like category=>"subfeature", sources=>[$esrc1, $esrc2,$esrc3]
 
 unless(defined($feature) && $feature->isa('EEDB::Feature')) {
 #die('fetch_all_with_feature param1 must be a EEDB::Feature');
 return [];
 }
 my $list1 = $class->fetch_all_with_feature1($feature, %options);
 my $list2 = $class->fetch_all_with_feature2($feature, %options);
 my @rtnlist = (@$list1, @$list2);
 return \@rtnlist;
 }
 
 sub fetch_all_with_feature1 {
 my $class = shift;
 my $feature1 = shift;
 my %options = @_; #like category=>"subfeature", sources=>[$esrc1, $esrc2,$esrc3]
 
 unless(defined($feature1) && $feature1->isa('EEDB::Feature')) {
 #die('fetch_all_with_feature1 param1 must be a EEDB::Feature');
 return [];
 }
 unless($feature1->database) { return []; }
 
 my $sql = "SELECT * FROM edge fl JOIN edge_source using(edge_source_id) WHERE feature1_id=? ";
 if(%options) {
 if($options{'category'}) {
 $sql .= sprintf(" AND category='%s'", $options{'category'});
 }
 if($options{'sources'}) {
 my @lsrc_ids;
 foreach my $lsrc (@{$options{'sources'}}) { push @lsrc_ids, $lsrc->id; }
 $sql .= sprintf(" AND fl.edge_source_id in(%s)", join(',', @lsrc_ids));
 }
 }
 return $class->fetch_multiple($feature1->database, $sql, $feature1->id);
 }
 
 sub fetch_all_with_feature2 {
 my $class = shift;
 my $feature2 = shift;
 my %options = @_; #like category=>"subfeature", sources=>[$esrc1, $esrc2,$esrc3]
 
 unless(defined($feature2) && $feature2->isa('EEDB::Feature')) {
 #die('fetch_all_with_feature2 param1 must be a EEDB::Feature');
 return [];
 }
 unless($feature2->database) { return []; }
 
 my $sql = "SELECT * FROM edge fl JOIN edge_source using(edge_source_id) WHERE feature2_id= ?";
 if(%options) {
 if($options{'category'}) {
 $sql .= sprintf(" AND category='%s'", $options{'category'});
 }
 if($options{'sources'}) {
 my @lsrc_ids;
 foreach my $lsrc (@{$options{'sources'}}) { push @lsrc_ids, $lsrc->id; }
 $sql .= sprintf(" AND fl.edge_source_id in(%s)", join(',', @lsrc_ids));
 }
 }
 return $class->fetch_multiple($feature2->database, $sql, $feature2->id);
 }
 
 sub fetch_all_visible_with_feature_id {
 my $class = shift;
 my $db = shift;
 my $id = shift;
 my $edge_source_ids = shift; #optional
 
 if($__riken_EEDB_edge_global_should_cache != 0) {
 my $edge_hash = $__riken_EEDB_edge_global_featureid_cache->{$db . $id};
 if(defined($edge_hash)) {
 my @edges = values(%$edge_hash);
 return \@edges;
 }
 }
 
 my $sql = sprintf("SELECT %s center_id, fl.* FROM edge fl JOIN edge_source using(edge_source_id) WHERE is_visible ='y' AND(feature1_id='%s' OR feature2_id='%s') ", $id, $id, $id);
 if(defined($edge_source_ids)) {
 $sql .= sprintf("AND fl.edge_source_id in (%s)", $edge_source_ids);
 }
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_active_with_feature_id {
 my $class = shift;
 my $db = shift;
 my $id = shift;
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
 "WHERE is_active ='y' AND(feature1_id='%s' OR feature2_id='%s') ", $id, $id);
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_visible_with_feature_id_list {
 my $class = shift;
 my $db = shift;
 my $id_list = shift;
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
 "WHERE is_visible ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_active_with_feature_id_list {
 my $class = shift;
 my $db = shift;
 my $id_list = shift;
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
 "WHERE is_active ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_visible_between_feature_id_list {
 my $class = shift;
 my $db = shift;
 my $id_list = shift;
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
 "WHERE is_visible ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_active_between_feature_id_list {
 my $class = shift;
 my $db = shift;
 my $id_list = shift;
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
 "WHERE is_active ='y' AND feature1_id in(%s) AND feature2_id in(%s)", $id_list, $id_list);
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_active_expand_from_feature_id_list {
 my $class = shift;
 my $db = shift;
 my $id_list = shift;
 
 my $sql = sprintf("SELECT fl.* FROM edge fl JOIN edge_source using(edge_source_id) ".
 "WHERE is_active ='y' AND feature1_id in(%s) OR feature2_id in(%s)", $id_list, $id_list);
 return $class->fetch_multiple($db, $sql);
 }
 
 sub fetch_all_visible {
 my $class = shift;
 my $db = shift;
 
 my $sql = sprintf("SELECT * FROM edge JOIN edge_source using(edge_source_id) WHERE is_visible ='y' ");
 return $class->fetch_multiple($db, $sql);
 }
 
 sub stream_all_visible {
 my $class = shift;
 my $db = shift;
 
 my $sql = sprintf("SELECT * FROM edge JOIN edge_source using(edge_source_id) WHERE is_visible ='y' ");
 return $class->stream_multiple($db, $sql);
 }
 
 sub fetch_all_like_link {
 my $class = shift;
 my $db = shift;
 my $link = shift; #Edge object
 
 #'like' means same feature1, feature2, and source
 
 my $sql = "SELECT * FROM edge ".
 "WHERE feature1_id=? and feature2_id=? and edge_source_id=?";
 return $class->fetch_multiple($db, $sql, $link->feature1_id, $link->feature2_id, $link->edge_source->id);
 }
 
 
 sub fetch_all_with_metadata {
 my $class = shift;
 my $source = shift; #EdgeSource object uses database of source for fetching
 my @mdata_array = @_; #Metadata object(s)
 
 if(defined($source) && !($source->isa('EEDB::EdgeSource'))) {
 die('second parameter [source] must be a EEDB::EdgeSource');
 }
 
 if(!defined($source->database) or !defined($source->primary_id)) { return []; }
 
 my @mdata_ids;
 foreach my $mdata (@mdata_array) {
 unless(defined($mdata) && ($mdata->class eq 'Metadata')) {
 die("$mdata is not a EEDB::Metadata");
 }
 if(defined($mdata->primary_id)) {push @mdata_ids, $mdata->id; }
 }
 if(scalar(@mdata_ids) == 0) { return []; } #if mdata objects not stored then return []
 
 my $sql = sprintf("SELECT e.* FROM edge e JOIN edge_2_metadata using(edge_id) WHERE metadata_id in(%s) ",
 join(',', @mdata_ids));
 $sql .= sprintf(" AND edge_source_id=%d", $source->id);
 $sql .= sprintf(" GROUP BY e.edge_id");
 
 #print($sql, "\n", );
 return $class->fetch_multiple($source->database, $sql);
 }
 
 sub fetch_all_with_symbol {
 my $class = shift;
 my $db = shift;
 my $source = shift; #EdgeSource object
 my $symbol = shift; #Symbol object
 my $response_limit = shift; #optional
 
 unless(defined($source) && $source->isa('EEDB::EdgeSource')) {
 die('second parameter [source] must be a EEDB::EdgeSource');
 }
 unless(defined($symbol) && ($symbol->class eq 'Symbol')) {
 die('third parameter [symbol] must be a EEDB::Symbol');
 }
 
 my $sql = sprintf("SELECT e.* FROM edge f ".
 "JOIN edge_2_symbol using(edge_id)  ".
 "WHERE symbol_id = %d ",
 $symbol->id);
 if(defined($source)) {
 $sql .= sprintf("AND edge_source_id=%d", $source->id);
 }
 $sql .= sprintf(" GROUP BY e.edge_id"); #to make sure the edge is not sent more than once
 if($response_limit) {
 $sql .= sprintf(" LIMIT %d", $response_limit);
 }
 
 #print($sql, "\n", );
 return $class->fetch_multiple($db, $sql);
 }
 
 
 ###############################################################################################
 #
 # streaming API section
 #
 ###############################################################################################
 
 
 sub stream_all_with_feature { #used by EEDB::Tools::EdgeCompare (experimental approach)
 my $class = shift;
 my $db = shift;
 my $feature = shift;
 my %options = @_; #optional
 
 my $id = $feature->id;
 my $sql = "SELECT * FROM edge e ";
 if(%options and $options{'visible'} eq 'y') {
 $sql .= " JOIN edge_source es on(e.edge_source_id = es.edge_source_id and es.is_visible='y') ";
 }
 
 $sql .= sprintf("WHERE (feature1_id='%s' OR feature2_id='%s') ", $id, $id);
 
 if(%options and $options{'sources'}) {
 my @lsrc_ids;
 foreach my $lsrc (@{$options{'sources'}}) { push @lsrc_ids, $lsrc->id; }
 $sql .= sprintf("AND e.edge_source_id in(%s) ", join(',', @lsrc_ids));
 }
 
 $sql .= "ORDER by weight desc";
 if(%options and $options{'end'} eq 'f1') { $sql .= ",feature1_id, feature2_id "; }
 if(%options and $options{'end'} eq 'f2') { $sql .= ",feature2_id, feature1_id "; }
 
 #printf("<sql>%s</sql>\n", $sql);
 return $class->stream_multiple($db, $sql);
 }
 */


