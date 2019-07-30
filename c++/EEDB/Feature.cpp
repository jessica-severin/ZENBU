/* $Id: Feature.cpp,v 1.317 2019/03/20 07:13:11 severin Exp $ */

/***

NAME - EEDB::Feature

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
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Experiment.h>


EEDB::FeatureLink::FeatureLink() {
  //constructor
  feature = NULL;
  next = NULL;
  prev = NULL; 
}

EEDB::FeatureLink::~FeatureLink() { 
  // destructor
  feature = NULL;
  next = NULL;
  prev = NULL;       
}


//initialize global variables
vector<EEDB::Feature*>    EEDB::Feature::_realloc_feature_array(1024);
int                       EEDB::Feature::_realloc_idx = 0;
const char*               EEDB::Feature::class_name = "Feature";

using namespace std;
using namespace MQDB;

void _eedb_feature_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Feature*)obj)->_xml(xml_buffer);
}
void _eedb_feature_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Feature*)obj)->_simple_xml(xml_buffer);
}
void _eedb_feature_mdata_xml_func(MQDB::DBObject *obj, string &xml_buffer, map<string,bool> tags) {
  ((EEDB::Feature*)obj)->_mdata_xml(xml_buffer, tags);
}
string _eedb_feature_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::Feature*)obj)->_display_desc();
}
void _eedb_feature_delete_func(MQDB::DBObject *obj) { 
  EEDB::Feature::dealloc((EEDB::Feature*)obj);  //fake delete
}


EEDB::Feature::Feature() {
  init();
}

EEDB::Feature::~Feature() {
  _dealloc();
}

void  EEDB::Feature::_dealloc() {
  //fake delete
  if(_feature_source != NULL) {
    _feature_source->release();
    _feature_source = NULL;
  }
  if(_chrom != NULL) {
    _chrom->release();
    _chrom = NULL;
  }
  if(_database) {
    _database->release();
    _database = NULL;
  }
  
  _metadataset.clear();

  _edgeset.clear(); //clear edges and subfeatures

  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    _subfeature_array[i]->release();
  }
  _subfeature_array.clear();
  
  for(unsigned int i=0; i<_expression_array.size(); i++) {
    _expression_array[i]->release();
  }
  _expression_array.clear();
  _expression_hash.clear();

  _peer_uuid = NULL;
  _db_id.clear();
  init();
}


EEDB::Feature*  EEDB::Feature::realloc() {
  if(_realloc_idx > 0) {
    EEDB::Feature *obj = _realloc_feature_array[_realloc_idx];
    _realloc_feature_array[_realloc_idx] = NULL;
    _realloc_idx--;
    obj->init();
    return obj;
  }
  EEDB::Feature *obj  = new EEDB::Feature();
  return obj;    
}    


void  EEDB::Feature::dealloc(EEDB::Feature *obj) {
  if(_realloc_idx < 1000) {
    obj->_dealloc();  //releases internal object references
    _realloc_idx++;
    _realloc_feature_array[_realloc_idx] = obj;
  } else {
    delete obj;
  }
}


void EEDB::Feature::init() {
  MQDB::MappedQuery::init();
  _classname            = EEDB::Feature::class_name;
  _funcptr_delete       = _eedb_feature_delete_func;
  _funcptr_xml          = _eedb_feature_xml_func;
  _funcptr_simple_xml   = _eedb_feature_simple_xml_func;
  _funcptr_mdata_xml    = _eedb_feature_mdata_xml_func;
  _funcptr_display_desc = _eedb_feature_display_desc_func;

  _metadata_loaded    = false;
  _subfeatures_loaded = false;
  _expression_loaded  = false;
  _chrom              = NULL;
  _feature_source     = NULL;
  _subfeatures_sorted = false;

  _chrom_id          = -1;
  _feature_source_id = -1;
  
  _chrom_start     = -1;
  _chrom_end       = -1;
  _last_update     = 0;
  _strand          = ' ';
  _significance    = 0.0;
  
  _primary_name.clear();
  _chrom_name.clear();
}


void  EEDB::Feature::clear() {
  _metadataset.clear();  
  _edgeset.clear(); //clear edges and subfeatures
  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    _subfeature_array[i]->release();
  }  
  _subfeature_array.clear();
  for(unsigned int i=0; i<_expression_array.size(); i++) {
    _expression_array[i]->release();
  }
  _expression_array.clear();  
  _expression_hash.clear();  
}


bool EEDB::Feature::operator== (EEDB::Feature& b) {
  if(_chrom_start != b._chrom_start) { return false; } 
  if(_chrom_end != b._chrom_end) { return false; } 
  if(_strand != b._strand) { return false; } 
  if(chrom()->operator!=(*b.chrom())){ return false; }
  return true;
}

bool EEDB::Feature::operator!= (EEDB::Feature& b) {
  if(_chrom_start != b._chrom_start) { return true; } 
  if(_chrom_end != b._chrom_end) { return true; } 
  if(_strand != b._strand) { return true; } 
  if(chrom()->operator!=(*b.chrom())){ return true; }
  return false;
}

bool EEDB::Feature::operator< (EEDB::Feature& b) {
  // for feature    ::   ORDER BY chrom_start, chrom_end
  // chrom() checking must be done before this call.

  if(_chrom_start < b._chrom_start) { return true; } 
  if(_chrom_start > b._chrom_start) { return false; } 
  //chrom_starts are equal
  if(_chrom_end < b._chrom_end) { return true; } 
  return false;
}

bool EEDB::Feature::overlaps(EEDB::Feature *b) {
  // for feature    ::   ORDER BY chrom_start, chrom_end
  // chrom() checking must be done before this call.
  if(_chrom_end   < b->_chrom_start) { return false; } //this ends before b starts (f1<f2)
  if(_chrom_start > b->_chrom_end)   { return false; } //this starts AFTER b ends  (f1>f2)
  return true;
}

bool EEDB::Feature::overlaps(EEDB::Feature *b, long int distance) {
  // for feature    ::   ORDER BY chrom_start, chrom_end
  // chrom() checking must be done before this call.
  if(_chrom_end   < b->_chrom_start - distance) { return false; } //this ends before b starts (f1<f2)
  if(_chrom_start > b->_chrom_end + distance)   { return false; } //this starts AFTER b ends  (f1>f2)
  return true;
}

bool EEDB::Feature::subfeature_overlap_check(EEDB::Feature *b) {
  //checks if any of this->subfeatures overlaps with "b" subfeatures
  // if no subfeatures then parent feature boundary hit is sufficient
  // if both have subfeatures then must be subfeature-to-subfeature hit
  // for feature    ::   ORDER BY chrom_start, chrom_end
  // chrom() checking must be done before this call.
  if(_chrom_end   < b->_chrom_start) { return false; } //this ends before b starts (f1<f2)
  if(_chrom_start > b->_chrom_end)   { return false; } //this starts AFTER b ends  (f1>f2)
    
  //makes sure subfeatures are loaded
  subfeatures(); 
  vector<EEDB::Feature*> b_subfeats = b->subfeatures();

  if(_subfeature_array.empty() and b_subfeats.empty()) { return true; }

  if(_subfeature_array.empty() and !(b_subfeats.empty())) { 
    //this has no subfeatures so just check b_subfeats against this boundaries
    for(unsigned int i=0; i<b_subfeats.size(); i++) { 
      EEDB::Feature *subfeat = b_subfeats[i];
      if((_chrom_start <= subfeat->_chrom_end) && (_chrom_end >= subfeat->_chrom_start)) { return true; }
    }
  }
  
  if(!(_subfeature_array.empty()) and b_subfeats.empty()) {
    //b has no subfeatures so just check b boundaries against this subfeatures
    for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
      EEDB::Feature *subfeat = _subfeature_array[i];
      if((b->_chrom_start <= subfeat->_chrom_end) && (b->_chrom_end >= subfeat->_chrom_start)) { return true; }
    }
  }

  if(!(_subfeature_array.empty()) and !(b_subfeats.empty())) {
    //both have subfeatures so do subfeature-to-subfeature check
    for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
      EEDB::Feature *subfeat1 = _subfeature_array[i];
      for(unsigned int j=0; j<b_subfeats.size(); j++) { 
        EEDB::Feature *subfeat2 = b_subfeats[j];
        if((subfeat1->_chrom_start <= subfeat2->_chrom_end) && (subfeat1->_chrom_end >= subfeat2->_chrom_start)) { return true; }
      }
    }
  }
  //nope fell through so no match
  return false;
}


bool EEDB::Feature::subfeature_overlap_check(EEDB::Feature *b, map<string,bool> &subfeat_categories) {
  return subfeature_overlap_check(b, subfeat_categories, 0);
}


bool EEDB::Feature::subfeature_overlap_check(EEDB::Feature *b, map<string,bool> &subfeat_categories, long int distance) {
  //checks if any of this->subfeatures overlaps with "b" subfeatures
  // if no subfeatures then parent feature boundary hit is sufficient
  // if both have subfeatures then must be subfeature-to-subfeature hit
  // for feature    ::   ORDER BY chrom_start, chrom_end
  // chrom() checking must be done before this call.
  
  if(_chrom_end   < b->_chrom_start - distance) { return false; } //this ends before b starts (f1<f2)
  if(_chrom_start > b->_chrom_end + distance)   { return false; } //this starts AFTER b ends  (f1>f2)
  
  bool use_category = !subfeat_categories.empty();
  
  //makes sure subfeatures are loaded
  subfeatures(); 
  vector<EEDB::Feature*> b_subfeats = b->subfeatures();
  
  if(_subfeature_array.empty() and b_subfeats.empty()) { return true; }
  
  if(_subfeature_array.empty() and !(b_subfeats.empty())) { 
    //this has no subfeatures so just check b_subfeats against this boundaries
    for(unsigned int i=0; i<b_subfeats.size(); i++) { 
      EEDB::Feature *subfeat = b_subfeats[i];
      if(use_category) {
        EEDB::FeatureSource *fsrc = subfeat->feature_source();
        if(!fsrc || !subfeat_categories[fsrc->category()]) { continue; }
      }
      if((_chrom_start - distance <= subfeat->_chrom_end) &&
         (_chrom_end >= subfeat->_chrom_start - distance)) { return true; }
    }
  }
  
  if(!(_subfeature_array.empty()) and b_subfeats.empty()) {
    //b has no subfeatures so just check b boundaries against this subfeatures
    for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
      EEDB::Feature *subfeat = _subfeature_array[i];
      if(use_category) {
        EEDB::FeatureSource *fsrc = subfeat->feature_source();
        if(!fsrc || !subfeat_categories[fsrc->category()]) { continue; }
      }      
      if((b->_chrom_start - distance <= subfeat->_chrom_end) &&
         (b->_chrom_end >= subfeat->_chrom_start - distance)) { return true; }
    }
  }
  
  if(!(_subfeature_array.empty()) and !(b_subfeats.empty())) {
    //both have subfeatures so do subfeature-to-subfeature check
    for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
      EEDB::Feature *subfeat1 = _subfeature_array[i];
      if(use_category) {
        EEDB::FeatureSource *fsrc1 = subfeat1->feature_source();
        if(!fsrc1 || !subfeat_categories[fsrc1->category()]) { continue; }
      }      
      for(unsigned int j=0; j<b_subfeats.size(); j++) { 
        EEDB::Feature *subfeat2 = b_subfeats[j];
        if(use_category) {
          EEDB::FeatureSource *fsrc2 = subfeat2->feature_source();
          if(!fsrc2 || !subfeat_categories[fsrc2->category()]) { continue; }
        }              
        if((subfeat1->_chrom_start - distance <= subfeat2->_chrom_end) &&
           (subfeat1->_chrom_end >= subfeat2->_chrom_start - distance)) { return true; }
      }
    }
  }
  //nope fell through so no match
  return false;
}


bool EEDB::Feature::subfeatures_match(EEDB::Feature *b) {
  //checks that all the subfeatures of this->subfeatures matches/equals all the "b" subfeatures
  //does not check strand, this can be done outside this function call if required

  //first check parent bounds
  if(_chrom_end   != b->_chrom_start) { return false; } //this ends before b starts (f1<f2)
  if(_chrom_start != b->_chrom_end)   { return false; } //this starts AFTER b ends  (f1>f2)
  
  //makes sure subfeatures are loaded
  subfeatures(); 
  vector<EEDB::Feature*> b_subfeats = b->subfeatures();
  
  if(_subfeature_array.size() != b_subfeats.size()) { return false; }  //must be same number
  if(_subfeature_array.empty() && b_subfeats.empty()) { return true; } //both empty
  
  //both subfeature arrays are sorted so can do a 1-to-1 match up
  unsigned int i=0;
  while(i<_subfeature_array.size()) { 
    EEDB::Feature *subfeat1 = _subfeature_array[i];
    EEDB::Feature *subfeat2 = b_subfeats[i];
    if(!(subfeat1 != subfeat2)) { return false; }    
  }
  
  //fell through so everything matches ok
  return true;
}


string EEDB::Feature::_display_desc() {
  char buffer[2048];
  string  str;

  str = "Feature(" +db_id()+ ")";
  if(feature_source()) { str += " " + feature_source()->name(); }

  if(chrom()) {
    str += " "+ assembly_name();
    snprintf(buffer, 2040, " %s:%ld..%ld%c", chrom_name().c_str(), _chrom_start, _chrom_end, _strand);
    str += buffer;
  }
  str += " : " + primary_name();

  if(_significance != 0.0) { 
    snprintf(buffer, 2040, " sig:%1.2f", _significance); 
    str += buffer;
  }
  /* old display_desc include metadata in a comma list, but not doing that here */
  return str;
}


string EEDB::Feature::display_contents() {
  string str = display_desc() + "\n";
  if(feature_source()) { str += "  " + feature_source()->display_desc() + "\n"; }

  str += "  " +metadataset()->display_contents();   

  /*
  my $expr_array = $self->expression_array();
  foreach my $express (@$expr_array) {
    $str .= "  ". $express->display_desc ."\n";   
  }

  my $edges = $self->edgeset->extract_category("subfeature")->edges;
  if(scalar(@$edges)) {
    foreach my $edge (sort {(($a->feature1->chrom_start <=> $b->feature1->chrom_start) ||
                              ($a->feature1->chrom_end <=> $b->feature1->chrom_end))
                            } @{$edges}) {
      $str .= "  " . $edge->feature1->simple_xml;
    }
  }
  */
  
  return str;
}


void EEDB::Feature::_xml_start(string &xml_buffer) {
  //html_escape is extremely slow, need to rethink....
  
  char buffer[2048];
  xml_buffer.append("<feature id=\"");
  xml_buffer.append(db_id());
  xml_buffer.append("\"");
  if(!_primary_name.empty()) {
    xml_buffer.append(" name=\"");
    xml_buffer.append(_primary_name);  //maybe html_escape()
    xml_buffer.append("\"");
  }

  if(chrom()) {
    snprintf(buffer, 2040, " start=\"%ld\" end=\"%ld\" strand=\"%c\"", 
          _chrom_start, _chrom_end, _strand);
    xml_buffer.append(buffer);
  }

  if(_significance != 0.0) { 
    snprintf(buffer, 2040, " sig=\"%g\"", _significance); 
    xml_buffer.append(buffer);
  }

  if(_last_update>0) {
    xml_buffer.append(" date=\"");
    time_t t_update = _last_update;
    string t_value = ctime(&t_update);
    t_value.resize(t_value.size()-1); //remove \n    
    xml_buffer.append(t_value);
    xml_buffer.append("\"");
  }
  
  if(feature_source()) { xml_buffer += " source_id=\"" + _feature_source->db_id() + "\""; }
  
  xml_buffer.append(" >");
  
  //change XML from version 1.xxx this is better and faster
  if(chrom())          { _chrom->simple_xml(xml_buffer); }

  //for now I need to leave this in. the jscript is still not
  //smart enough to efficiently connect external featuresources 2012-05-29
  if(feature_source()) { _feature_source->simple_xml(xml_buffer); }
}


void EEDB::Feature::_xml_end(string &xml_buffer) {
  xml_buffer.append("</feature>\n"); 
}


void EEDB::Feature::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  _xml_end(xml_buffer);
}


void EEDB::Feature::_mdata_xml(string &xml_buffer, map<string,bool> mdtags) {
  _xml_start(xml_buffer);
  vector<EEDB::Metadata*> mdlist = metadataset()->all_metadata_with_tags(mdtags);
  vector<EEDB::Metadata*>::iterator it1;
  for(it1=mdlist.begin(); it1!=mdlist.end(); it1++) {
    (*it1)->xml(xml_buffer);
  }
  _xml_end(xml_buffer);
}


bool _subfeature_edge_sort_func (EEDB::Edge *a, EEDB::Edge *b) { 
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->feature1() == NULL) { return false; }
  if(b->feature1() == NULL) { return true; }
  if(a->feature1()->chrom_start() < b->feature1()->chrom_start()) { return true; }
  if((a->feature1()->chrom_start() == b->feature1()->chrom_start()) && 
     (a->feature1()->chrom_end() < b->feature1()->chrom_end())) { return true; }
  return false;
}

bool _subfeature_sort_func (EEDB::Feature *a, EEDB::Feature *b) { 
  if(a == NULL) { return false; }
  if(b == NULL) { return true; }
  if(a->chrom_start() < b->chrom_start()) { return true; }
  if((a->chrom_start() == b->chrom_start()) && 
     (a->chrom_end() < b->chrom_end())) { return true; }
  return false;
}


void EEDB::Feature::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  //xml_buffer.append("\n"); 

  //if(feature_source()) { _feature_source->simple_xml(xml_buffer); }

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }
  
  _xml_subfeatures(xml_buffer);
  _xml_expression(xml_buffer);

  _xml_end(xml_buffer);
}


void EEDB::Feature::fullxml(string &xml_buffer) {
  _xml_start(xml_buffer);

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }
  
  _xml_subfeatures(xml_buffer);
  _xml_expression(xml_buffer);

  _xml_end(xml_buffer);
}


void  EEDB::Feature::xml_interchange(string &xml_buffer, int level) {
  //special XML for zenbu-2-zenbu interchange
  //html_escape is extremely slow, need to rethink....
  char buffer[2048];
  xml_buffer += "<feature id=\"" + db_id() + "\"";
  
  if(!_primary_name.empty()) {
    xml_buffer += " name=\"" + _primary_name+ "\"";  //maybe html_escape()
  }
  
  if(chrom()) {
    snprintf(buffer, 2040, " start=\"%ld\" end=\"%ld\" strand=\"%c\"", 
             _chrom_start, _chrom_end, _strand);
    xml_buffer.append(buffer);
    xml_buffer += " chr=\"" + chrom()->chrom_name() + "\"";
    xml_buffer += " asm=\"" + chrom()->assembly_name() + "\"";      
  }
  
  if(_significance != 0.0) { 
    snprintf(buffer, 2040, " sig=\"%g\"", _significance); 
    xml_buffer.append(buffer);
  }
  
  if(_last_update>0) {
    xml_buffer.append(" date=\"");
    time_t t_update = _last_update;
    string t_value = ctime(&t_update);
    t_value.resize(t_value.size()-1); //remove \n    
    xml_buffer.append(t_value);
    xml_buffer.append("\"");
  }
  
  if(feature_source()) {
    if(!_feature_source->db_id().empty()) {
      xml_buffer += " fsrc_id=\"" + _feature_source->db_id() + "\"";
    } else {
      xml_buffer += " ctg=\"" + _feature_source->category() + "\"";
      xml_buffer += " fsrc=\"" + _feature_source->name() + "\"";
    }
  }
  xml_buffer.append(" >");
  
  if(level>0) {
    xml_buffer.append("\n");
    EEDB::MetadataSet *mdset = metadataset();
    if(mdset!=NULL) { mdset->xml(xml_buffer); }
    
    _xml_subfeatures(xml_buffer);
    _xml_expression(xml_buffer);    
  }
  
  xml_buffer.append("</feature>\n");
}


void EEDB::Feature::_xml_subfeatures(string &xml_buffer) {  
  char    buffer[2048];
  
  subfeatures(); //makes sure it is loaded and sorted
  if(_subfeature_array.empty()) { return; }
  
  snprintf(buffer, 2040, "<subfeatures count=\"%d\">", (int)_subfeature_array.size());
  xml_buffer.append(buffer);

  for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
    EEDB::Feature *subfeat = _subfeature_array[i];

    xml_buffer.append("<feature ");
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    if(fsrc) { xml_buffer += "ctg=\""+ fsrc->category() + "\" "; }
    if(_significance != 0.0) { 
      snprintf(buffer, 2040, "sig=\"%1.2f\" ", _significance); 
      xml_buffer.append(buffer);
    }    
    snprintf(buffer, 2040, "start=\"%ld\" end=\"%ld\" strand=\"%c\" ", subfeat->chrom_start(), subfeat->chrom_end(), subfeat->strand());
    xml_buffer.append(buffer);
    
    if(!subfeat->primary_name().empty()) {
      xml_buffer.append("name=\"");
      xml_buffer.append(subfeat->primary_name());  //maybe html_escape()
      xml_buffer.append("\" ");
    }

    if(fsrc) { xml_buffer += "fsrc_id=\"" + fsrc->db_id() + "\" "; }

    xml_buffer.append("/>\n");
  }
  xml_buffer.append("</subfeatures>\n");  
}


void EEDB::Feature::_xml_expression(string &xml_buffer) {    
  load_expression(); //lazy load if needed
  for(unsigned int i=0; i<_expression_array.size(); i++) {
    EEDB::Expression *expr = _expression_array[i];
    //if(expr->value() == 0.0) { continue; } 
    expr->simple_xml(xml_buffer);
  }
}


bool EEDB::Feature::init_from_xml(void *xml_node) {
  // using a rapidxml node
  init();
  if(xml_node==NULL) { return false; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr, *attr2;
  rapidxml::xml_node<>      *node;
  
  if(strcmp(root_node->name(), "feature")!=0) { return false; }
  
  if((attr = root_node->first_attribute("fsrc_id"))) { 
    _feature_source = (EEDB::FeatureSource*)EEDB::DataSource::sources_cache_get(attr->value());
    if(_feature_source) { _feature_source->retain(); }
  } else if((node = root_node->first_node("featuresource")) != NULL) {
    if((attr = node->first_attribute("id"))) {
      _feature_source = (EEDB::FeatureSource*)EEDB::DataSource::sources_cache_get(attr->value());
      if(_feature_source) { _feature_source->retain(); }
    }
  } else {
    attr  = root_node->first_attribute("fsrc");
    attr2 = root_node->first_attribute("ctg");
    if(attr && attr2) {
      string tid = attr->value();
      tid += string("_") + attr2->value();
      _feature_source = (EEDB::FeatureSource*)EEDB::DataSource::sources_cache_get(tid);
      if(_feature_source) { _feature_source->retain(); }
      else {
        _feature_source = new EEDB::FeatureSource();
        _feature_source->category(attr2->value());
        _feature_source->name(attr->value());
        _feature_source->db_id(tid);
        EEDB::DataSource::add_to_sources_cache(_feature_source);
        //fprintf(stderr, "fsrc cache miss, xml create %s\n", _feature_source->simple_xml().c_str());
      }
    }
  }


  if((attr = root_node->first_attribute("name")))     { _primary_name = attr->value(); }

  if((attr = root_node->first_attribute("start")))    { _chrom_start = strtol(attr->value(), NULL, 10); }
  if((attr = root_node->first_attribute("end")))      { _chrom_end = strtol(attr->value(), NULL, 10); }
  if((attr = root_node->first_attribute("strand")))   { strand(attr->value()[0]); }
  
  if((attr = root_node->first_attribute("name")))     { _primary_name = attr->value(); }
  if((attr = root_node->first_attribute("sig")))      { _significance = strtod(attr->value(), NULL); }
  
  if((attr = root_node->first_attribute("id")))       { db_id(attr->value()); }
  
  //_last_update TODO
  
  //chrom(): for now features will always be pulled from systems where the chrom is set externally
      
  // metadata
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }
  _metadata_loaded = true;
  
  // subfeatures
  rapidxml::xml_node<>  *subfeat_node = root_node->first_node("subfeatures");
  if(subfeat_node) {
    if((node = subfeat_node->first_node("feature")) != NULL) {
      while(node) {
        EEDB::Feature *subfeat = EEDB::Feature::realloc();
        if(subfeat->init_from_xml(node)) {
          subfeat->chrom(chrom());
          add_subfeature(subfeat);
          subfeat->release(); //retained by feature
        } else { 
          fprintf(stderr, "failed to init xml subfeature\n");
          subfeat->release(); 
        }
        node = node->next_sibling("feature");
      }
    }
  }
  _subfeatures_loaded = true;

  // expression
  if((node = root_node->first_node("expression")) != NULL) {
    while(node) {
      EEDB::Expression *expression = EEDB::Expression::realloc();
      if(expression->init_from_xml(node)) {
        _expression_array.push_back(expression);
      } else {
        fprintf(stderr, "failed to init xml expression\n");
        expression->release();
      }
      node = node->next_sibling("expression");
    }    
  }
  _expression_loaded = true;
  return true;
}
  

////////////////////////////////////////////////////////////////////////////////

string   EEDB::Feature::gff_description(bool show_metadata) {
  string str;
  char buffer[2048];
  EEDB::FeatureSource *fsrc = feature_source();
  string fsrc_name = fsrc->name();
  boost::algorithm::replace_all(fsrc_name, " ", "_");

  //GFF3 style
  snprintf(buffer, 2040, "%s\t%s\t%s\t%ld\t%ld\t%1.3f\t%c",
                    chrom_name().c_str(),
                    fsrc_name.c_str(),
                    fsrc->category().c_str(),
                    _chrom_start,
                    _chrom_end,
                    _significance,
                    _strand);
  str = buffer;
  
  EEDB::Metadata *phaseMD = metadataset()->find_metadata("gff:frame", "");
  if(phaseMD) {
    str += "\t" + phaseMD->data();
  } else {
    str += "\t.";
  }
  str += "\t";

  subfeatures(); //makes sure it is loaded and sorted

  //attributes
  string gff_id;
  if(!_subfeature_array.empty()) {
    EEDB::Metadata *gffIdMD = metadataset()->find_metadata("gff:ID", "");
    if(gffIdMD) { gff_id = gffIdMD->data(); }
    else { gff_id = MQDB::uuid_b64string(); }
    snprintf(buffer, 2040, "ID=\"%s\";", gff_id.c_str());
    str += buffer;
  }

  snprintf(buffer, 2040, "Name=\"%s\"", _primary_name.c_str());
  str += buffer;
  
  if(chrom()!=NULL) {
    snprintf(buffer, 2040, ";asm=\"%s\"", chrom()->assembly_name().c_str());
    str += buffer;
  }
  if(show_metadata) {
    str += ";" +metadataset()->gff_description();
  }
  
  //subfeatures
  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    str += "\n"; //terminate previous line
    EEDB::Feature *subfeat = _subfeature_array[i];
    
    string subfeat_gff;
    
    snprintf(buffer, 2040, "%s\t%s\t%s\t%ld\t%ld\t%1.3f\t%c",
             chrom_name().c_str(),
             fsrc_name.c_str(),
             subfeat->feature_source()->category().c_str(),
             subfeat->chrom_start(),
             subfeat->chrom_end(),
             subfeat->significance(),
             subfeat->strand());
    subfeat_gff = buffer;
    
    EEDB::Metadata *phaseMD = subfeat->metadataset()->find_metadata("gff:frame", "");
    if(phaseMD) {
      subfeat_gff += "\t" + phaseMD->data();
    } else {
      subfeat_gff += "\t.";
    }
    
    //subfeature attributes
    snprintf(buffer, 2040, "\tParent=\"%s\";Name=\"%s\"", gff_id.c_str(), subfeat->primary_name().c_str());
    subfeat_gff += buffer;
    
    if(chrom()!=NULL) {
      snprintf(buffer, 2040, ";asm=\"%s\"", chrom()->assembly_name().c_str());
      subfeat_gff += buffer;
    }
    if(show_metadata) {
      subfeat_gff += ";" + subfeat->metadataset()->gff_description();
    }
    
    str += subfeat_gff;
  }
  
  if(gff_id.empty()) {
    metadataset()->add_metadata("gff:ID", gff_id); //for later reuse
  }
  
  return str;
}


string   EEDB::Feature::bed_description(string format) {
  string str;
  char buffer[2048];

  //BED3 (BED is zero based)
  snprintf(buffer, 2040, "%s\t%ld\t%ld", chrom_name().c_str(), _chrom_start-1, _chrom_end);
  str = buffer;
  if(format.empty()) { return str; } //default to BED3 if not specified
  boost::algorithm::to_lower(format);
  if(format == "bed3") { return str; }

  //both BED6 and BED12 have these next 3 columns
  snprintf(buffer, 2040, "\t%s\t%1.2f\t%c", primary_name().c_str(), _significance, _strand);
  str += buffer;
  if(format == "bed6") { return str; }

  if(format == "bed12") { 
    // thickStart, thickEnd, itemRgb, blockCount, blockSizes, blockStarts
    long int thickStart  = _chrom_start-1;
    long int thickEnd    = _chrom_end;
    string   blockStarts;
    string   blockSizes;
    long int blockCount  = 0;

    //convert subfeatures into bed-blocks
    subfeatures(); //makes sure it is loaded and sorted
    for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
      //minimalized subfeature info
      EEDB::Feature *subfeat = _subfeature_array[i];      
      if(!subfeat) { continue; }
      EEDB::FeatureSource *fsrc = subfeat->feature_source();
      
      if(fsrc && (fsrc->category() == "3utr")) {
        if((subfeat->strand() == '+') and (thickEnd > subfeat->chrom_start())) {
          thickEnd   = subfeat->chrom_start() - 1; 
        }
        if((subfeat->strand() == '-') and (thickStart < subfeat->chrom_end())) {
          thickStart = subfeat->chrom_end(); 
        }
      }
      else if(fsrc && (fsrc->category() == "5utr")) {
        if((subfeat->strand() == '+') and (thickStart < subfeat->chrom_end())) {
          thickStart = subfeat->chrom_end();
        }
        if((subfeat->strand() == '-') and (thickEnd > subfeat->chrom_start())) {
          thickEnd   = subfeat->chrom_start() - 1;
        }
      }
      else {
        if(!blockStarts.empty()) { blockStarts +=","; blockSizes+=","; }
        snprintf(buffer, 2040, "%ld", subfeat->chrom_start() - _chrom_start);
        blockStarts += buffer;
        snprintf(buffer, 2040, "%ld", subfeat->chrom_end() - subfeat->chrom_start() + 1);
        blockSizes += buffer;
        blockCount++;
      }
    }
    snprintf(buffer, 2040, "\t%ld\t%ld\t%d\t%ld", thickStart, thickEnd, 0, blockCount);
    str += buffer;
    str += "\t" + blockSizes + "\t" + blockStarts;
  }
  return str;
}


string   EEDB::Feature::category_cigar() {
  string ctg_cigar;
  char buffer[2048];

  subfeatures(); //makes sure they are loaded and sorted
  map<string,bool> categories;
  for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
    EEDB::Feature *subfeat = _subfeature_array[i];      
    EEDB::FeatureSource *fsrc = subfeat->feature_source();
    categories[fsrc->category()] = true;
  }
  
  map<string,bool>::iterator ctg_it;
  for(ctg_it=categories.begin(); ctg_it!=categories.end(); ctg_it++) {
    if(!ctg_cigar.empty()) { ctg_cigar += ","; }
    ctg_cigar += (*ctg_it).first +":";
    
    long lastpos = _chrom_start;
    //convert subfeatures of current catgeory into cigar line
    for(unsigned int i=0; i<_subfeature_array.size(); i++) { 
      //minimalized subfeature info
      EEDB::Feature *subfeat = _subfeature_array[i];      
      EEDB::FeatureSource *fsrc = subfeat->feature_source();
      if(fsrc->category() != (*ctg_it).first) { continue; }
      
      if(subfeat->chrom_start() > lastpos+1) {
        snprintf(buffer, 2040, "%ldN", subfeat->chrom_start() - lastpos - 1);
        ctg_cigar += buffer;
      }
      
      snprintf(buffer, 2040, "%ldM", subfeat->chrom_end() - subfeat->chrom_start()+1);
      ctg_cigar += buffer;

      lastpos = subfeat->chrom_end();
    }
  }
  return ctg_cigar;
}


string   EEDB::Feature::dasgff_xml() {
  string str;
  char buffer[2048];

  //<FEATURE id="id" label="label">
  //<TYPE id="id" category="category" reference="yes|no">type label</TYPE>
  //<METHOD id="id"> method label </METHOD>
  //<START> start </START>
  //<END> end </END>
  //<SCORE> [X.XX|-] </SCORE>
  //<ORIENTATION> [0|-|+] </ORIENTATION>
  //<PHASE> [0|1|2|-]</PHASE>
  //<NOTE> note text </NOTE>
  //<LINK href="url"> link text </LINK>
  //<TARGET id="id" start="x" stop="y">target name</TARGET>
  //<GROUP id="id" label="label" type="type">
  //<NOTE> note text </NOTE>
  //<LINK href="url"> link text </LINK>
  //<TARGET id="id" start="x" stop="y">target name</TARGET>
  //</GROUP>
  //</FEATURE>

  snprintf(buffer, 2040, "<FEATURE id=\"%s\" label=\"%s\">\n",
                    db_id().c_str(), primary_name().c_str());
  str = buffer;

  EEDB::FeatureSource *fsrc = feature_source();                    
  snprintf(buffer, 2040, "<TYPE id=\"%ld\" category=\"%s\" reference=\"no\">%s</TYPE>\n",
                    fsrc->primary_id(), fsrc->category().c_str(), fsrc->name().c_str());
  str += buffer;
  
  snprintf(buffer, 2040, "<START>%ld</START><END>%ld</END>", _chrom_start, _chrom_end);
  str += buffer;
  
  char strand = _strand;
  if(strand == ' ') { strand = '0'; }
  snprintf(buffer, 2040, "<ORIENTATION>%c</ORIENTATION>", strand);
  str += buffer;

  str += "<PHASE>-</PHASE>\n";
  snprintf(buffer, 2040, "<SCORE>%g</SCORE>\n", _significance);
  str += buffer;
                    
  str += "</FEATURE>\n";
  
  return str;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string  EEDB::Feature::assembly_name() { 
  if(chrom()) { return chrom()->assembly_name(); } 
  else { return ""; }
}

string  EEDB::Feature::chrom_name() { 
  if(chrom()) { return chrom()->chrom_name(); } 
  else if(!_chrom_name.empty()) { return _chrom_name; }
  else { return ""; }
}

string      EEDB::Feature::primary_name() { return _primary_name; }
long int    EEDB::Feature::chrom_start()  { return _chrom_start; }
long int    EEDB::Feature::chrom_end()    { return _chrom_end; }
char        EEDB::Feature::strand()       { return _strand; }
double      EEDB::Feature::significance() { return _significance; }
time_t      EEDB::Feature::last_update()  { return _last_update; }

long int  EEDB::Feature::min_start() { 
  //for resized features, checks subfeatures
  long int start = _chrom_start;
  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    EEDB::Feature *subfeat = _subfeature_array[i];
    if(subfeat->chrom_start() < start) { start = subfeat->chrom_start(); }
  }
  return start;
}

long int  EEDB::Feature::max_end() {
  long int end = _chrom_end;
  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    EEDB::Feature *subfeat = _subfeature_array[i];
    if(subfeat->chrom_end() > end) { end = subfeat->chrom_end(); }
  }
  return end;
}

string      EEDB::Feature::chrom_location() {
  char buffer[2048];
  if(!chrom()) { return ""; }
  snprintf(buffer, 2040, "%s:%ld..%ld%c", chrom_name().c_str(), _chrom_start, _chrom_end, _strand);
  return buffer;
}


void  EEDB::Feature::chrom_start(long int value) {
  //eedb is a 1base coordinate system
  if(value <= 0) { _chrom_start = -1; }
  else { _chrom_start = value; }
}

void  EEDB::Feature::chrom_end(long int value) {
  if(value <= 0) { _chrom_end = -1; }
  else { _chrom_end = value; }
}

void  EEDB::Feature::strand(char value) {
  if((value == '-') or (value == '+')) {
    _strand = value;
  } else {
    _strand = ' ';
  }

}

// lazy load object methods

EEDB::MetadataSet*   EEDB::Feature::metadataset() {
  if(!_metadata_loaded) {
    _metadata_loaded = true;
    if(_database != NULL) {
      vector<DBObject*> symbols = 
         EEDB::Symbol::fetch_all_by_feature_id(_database, _primary_db_id);
      _metadataset.add_metadata(symbols);

      vector<DBObject*> mdata = 
         EEDB::Metadata::fetch_all_by_feature_id(_database, _primary_db_id);
      _metadataset.add_metadata(mdata);
    }
    //$self->{'metadataset'}->remove_duplicates;
  }
  return &_metadataset;
}


EEDB::FeatureSource*  EEDB::Feature::feature_source() {
  if(_feature_source != NULL) { return _feature_source; }
  
  if(_database and (_feature_source_id != -1)) { //lazy load from database
    //fprintf(stderr, "lazy load feature_source [%ld]\n", _database->retain_count());
    _feature_source = EEDB::FeatureSource::fetch_by_id(_database, _feature_source_id);
  }
  return _feature_source;
}

void  EEDB::Feature::feature_source(EEDB::FeatureSource* obj) {
  if(obj != NULL) { obj->retain(); }
  if(_feature_source != NULL) { _feature_source->release(); }
  _feature_source = obj;
  if(obj) { _peer_uuid = obj->peer_uuid(); }
}


EEDB::Chrom*  EEDB::Feature::chrom() {
  if(_chrom != NULL) { return _chrom; }
  
  if(_database and (_chrom_id != -1)) { //lazy load from database
    //fprintf(stderr, "lazy load chrom [%ld]\n", _database->retain_count());
    _chrom = EEDB::Chrom::fetch_by_id(_database, _chrom_id);
  }
  return _chrom;
}

void  EEDB::Feature::chrom(EEDB::Chrom* obj) {
  if(obj!=NULL) { obj->retain(); }
  if(_chrom != NULL) { _chrom->release(); }
  _chrom_id = -1;
  _chrom = obj;
  if(obj!=NULL) { _chrom_id = obj->primary_id(); }
}

long int  EEDB::Feature::chrom_id() {
  if(_chrom_id != -1) { return _chrom_id; }
  if(chrom()) { return _chrom->primary_id(); }
  return -1;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// subfeature  API calls
//
//////////////////////////////////////////////////////////////////////////////////////////////////


vector<EEDB::Feature*>  EEDB::Feature::subfeatures() {
  if(!_subfeature_array.empty()) { 
    if(!_subfeatures_sorted) {
      sort(_subfeature_array.begin(), _subfeature_array.end(), _subfeature_sort_func);
      _subfeatures_sorted = true;
    }
    return _subfeature_array; 
  }
  
  //lazy load from mysql database if needed
  _load_subfeatures();
  sort(_subfeature_array.begin(), _subfeature_array.end(), _subfeature_sort_func);
  _subfeatures_sorted = true;

  return _subfeature_array;
}


void  EEDB::Feature::add_subfeature(EEDB::Feature* subfeat) {
  if(!subfeat) { return; }
  subfeat->retain();
  _subfeature_array.push_back(subfeat);
  _subfeatures_sorted = false;
}


void  EEDB::Feature::clear_subfeatures() {
  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    _subfeature_array[i]->release();
  }  
  _subfeature_array.clear();  
  _subfeatures_loaded = true;
}


void  EEDB::Feature::remove_duplicate_subfeatures() {
  vector<EEDB::Feature*>   t_subfeats;
  
  subfeatures(); //forces a resort
  
  EEDB::Feature *last_feat=NULL;
  for(unsigned int i=0; i<_subfeature_array.size(); i++) {
    EEDB::Feature *subfeat = _subfeature_array[i];
    if(!last_feat) { last_feat = subfeat; }
    else {
      bool different=false;
      
      if(last_feat->chrom_start() != subfeat->chrom_start()) { different=true; } 
      if(last_feat->chrom_end()   != subfeat->chrom_end())   { different=true; } 
      if(last_feat->feature_source() && subfeat->feature_source() 
         && (last_feat->feature_source()->category() != subfeat->feature_source()->category())) { different=true; }
      
      if(different) { 
        t_subfeats.push_back(last_feat);
        last_feat = subfeat;
      } else {
        subfeat->release();
      }
    }
  }  
  if(last_feat) { t_subfeats.push_back(last_feat); }
  _subfeature_array = t_subfeats;
}


void  EEDB::Feature::overlap_merge_subfeatures() {
  subfeatures(); //forces a resort
  
  vector<EEDB::Feature*>::iterator it1 = _subfeature_array.begin();
  vector<EEDB::Feature*>::iterator it2 = it1 + 1;
  
  while(it1 != _subfeature_array.end()) {
    EEDB::Feature *subfeat1 = (*it1);
    if(!subfeat1) { break; }
    EEDB::FeatureSource *fsrc1 = subfeat1->feature_source();
    //fprintf(stderr, "feat1: %s\n", feat1->bed_description("bed12").c_str());
    it2 = it1 + 1;
    while(it2 != _subfeature_array.end()) {
      EEDB::Feature *subfeat2 = (*it2);
      if(!subfeat2) { break; }
      EEDB::FeatureSource *fsrc2 = subfeat2->feature_source();
      
      if(fsrc1 && fsrc2 && (fsrc1->category() != fsrc2->category())) {
        it2++;
        continue;
      }
      
      if((subfeat1->chrom_start() <= subfeat2->chrom_end()) && (subfeat2->chrom_start() <= subfeat1->chrom_end())) {
        //overlaps
        if(subfeat2->chrom_start() < subfeat1->chrom_start()) {
          subfeat1->chrom_start(subfeat2->chrom_start());
        }
        if(subfeat2->chrom_end() > subfeat1->chrom_end()) {
          subfeat1->chrom_end(subfeat2->chrom_end());
        }
        subfeat2->release();
        _subfeature_array.erase(it2);
        //maybe it2 is still valid and now points to next element, vector::iterator might be simple int
      } else {
        it2++;
      }
    }
    it1++;
  }
}


void  EEDB::Feature::create_subfeature(EEDB::FeatureSource *source, long bstart, long bsize, long bidx) {
  //creates a new subfeature based on 'block' like parameters (start-offset, size, and block-index number)
  if(!source) { return; }
  EEDB::Feature *subfeat = EEDB::Feature::realloc();
  subfeat->feature_source(source);
  subfeat->chrom(chrom());
  subfeat->strand(_strand);
  subfeat->chrom_start(_chrom_start + bstart);
  subfeat->chrom_end(_chrom_start + bstart + bsize - 1);
  
  string name = _primary_name +"_";
  if(source->category().empty()) { name += "subfeat"; }
  else { name += source->category(); }
  char buffer[2048];
  sprintf(buffer, "%ld",bidx);
  name += buffer;
  subfeat->primary_name(name);
  
  add_subfeature(subfeat);
  subfeat->release(); //retained by feature
}


void  EEDB::Feature::create_cigar_subfeatures(EEDB::FeatureSource *source, string cigar) {
  //universal parser for GFF / GTF / SAM cigar lines
  // GFF / GFF3 / Exonerate CIGAR logic  (ex: M3 I1 M2 F1 M4)
  // M        match
	// I        insert a gap into the reference sequence
	// D        insert a gap into the target (delete from reference)
	// F        frameshift forward in the reference sequence
	// R        frameshift reverse in the reference sequence
  //
  // SAM/BAM cigar logic (ex: 8M2I4M1D3M )
  //  $cigar =~ m/([0-9]+)([MIDNSHPX])/g
  // M 0 alignment match (can be a sequence match or mismatch)
  // I 1 insertion to the reference
  // D 2 deletion from the reference
  // N 3 skipped region from the reference
  // S 4 soft clipping (clipped sequences present in SEQ)
  // H 5 hard clipping (clipped sequences NOT present in SEQ)
  // P 6 padding (silent deletion from padded reference)
  // = 7 sequence match
  // X 8 sequence mismatch
  
  if(cigar.empty()) { return; }
  if(!source) { return; }
    
  /*
  if($cigar =~ /H/) {
    //the cigar contains Hard Clipped sequences and therefore may 
    //contain `Multi-part alignments` that are not parsed well 
    //with this code
    return;
  }
  */
  
  char* cigar_buf = (char*)malloc(cigar.size() + 3);
  strcpy(cigar_buf, cigar.c_str());
  char *ptr = cigar_buf;
    
  long curr_pos = 0;
  long curr_block_size = 0;
  long bidx = 1;

  long len = 0;
  char op = ' ';

  while(1) {
    while(*ptr == ' ') { ptr++; }
    
    if((op != ' ') && (len>0)) { 
      if((op == 'M') || (op == 'X') || (op == '=')) {
        //// M  Alignment match (can be a sequence match or mismatch)
        curr_block_size += len;
      } 
      else if (op == 'I') {
        // I  Insertion to the reference 
        //    (position on genome does not increase, but there is additional bases in this sequence tag)
        //    no change to block pos or size
      }    
      else if(op == 'D') {
        // D  Deletion from the reference (base(s) in reference, missing from sequence tag)
        // choice of either expanding block size, or creating new subfeature
        
        curr_block_size += len;
        
        /* -- alternate mode that small deletes create subfeatures
        if(curr_block_size>0) {
          create_subfeature(source, curr_pos, curr_block_size, bidx);
          bidx++;
        }
        curr_pos += curr_block_size + len;
        curr_block_size = 0;
         */
      }
      else if(op == 'N') {
        //// N  Skipped region from the reference
        if(curr_block_size>0) {
          create_subfeature(source, curr_pos, curr_block_size, bidx);
          bidx++;
        }
        curr_pos += curr_block_size + len;
        curr_block_size = 0;
      } 
      //else if(op == 'S') {
      // S  Soft clip on the read (clipped sequence present in <seq>)
      //} else if(op == 'H') {
      // H  Hard clip on the read (clipped sequence NOT present in <seq>)
      //} else if (op == 'P') {
      // P  Padding (silent deletion from the padded reference sequence)
      //} else {
      //unrecognized cigar operator
      //}
      
      op = ' ';
      len = 0;
    }
    
    if(*ptr == '\0') { break; }
    
    if(isdigit(*ptr)) {
      len = 0;
      while(isdigit(*ptr)) {
        len = len * 10;
        len += (*ptr - '0');
        ptr++;
      }
    }

    if((*ptr != '\0') && !isdigit(*ptr) && !isspace(*ptr)) {
      op = *ptr;
      ptr++;
    }
  }
  
  if(curr_block_size>0) {
    create_subfeature(source, curr_pos, curr_block_size, bidx);
  }
  free(cigar_buf);
}

void  EEDB::Feature::_load_subfeatures() {
  if(_subfeatures_loaded) { return; }
  if(_database == NULL) { return; }
  if(_primary_db_id == -1) { return; }
  
  string sql = "SELECT f1.* FROM feature f1 JOIN edge e1 on(f1.feature_id=e1.feature1_id) \
               JOIN edge_source es1 on(e1.edge_source_id = es1.edge_source_id AND es1.category=\"subfeature\") \
               WHERE e1.feature2_id=?";
  
  vector<DBObject*> t_result = MQDB::fetch_multiple(EEDB::Feature::create, _database, sql.c_str(), "d", _primary_db_id);

  vector<MQDB::DBObject*>::iterator  it;  
  for(it = t_result.begin(); it != t_result.end(); it++) {
    EEDB::Feature *subfeat = (EEDB::Feature*)(*it);
    if(!subfeat) { continue; }
    subfeat->chrom(chrom());
    _subfeature_array.push_back(subfeat);
  }
  _subfeatures_loaded = true;
  _subfeatures_sorted = false;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods : storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

DBObject* EEDB::Feature::create(map<string, dynadata> &row_map, Database* db) {
  EEDB::Feature *obj = EEDB::Feature::realloc();
  obj->database(db);
  obj->init_from_row_map(row_map);
  return obj;
}


void  EEDB::Feature::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["feature_id"].i_int;
  _primary_name    = row_map["primary_name"].i_string;

  _chrom_start     = row_map["chrom_start"].i_int;
  _chrom_end       = row_map["chrom_end"].i_int;
  _significance    = row_map["significance"].i_double;

  if(row_map["last_update"].type == MQDB::STRING) {
    string date_string = row_map["last_update"].i_string;
    _last_update = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["last_update"].type == MQDB::TIMESTAMP) {
    _last_update = row_map["last_update"].i_timestamp;
  }

  strand(row_map["strand"].i_string[0]);

  //_type            = boost::algorithm::to_lower_copy(row_map["sym_type"].i_string);
  //if(value.type != MQDB::UNDEF) {
  //$self->{'chrom_name'}     = $rowHash->{'chrom_name'};

  _chrom_id             = row_map["chrom_id"].i_int;
  _feature_source_id    = row_map["feature_source_id"].i_int;
}


EEDB::Feature*  EEDB::Feature::fetch_by_id(MQDB::Database *db, long int id) {
  const char *sql = "SELECT * FROM feature WHERE feature_id=?";
  return (EEDB::Feature*) MQDB::fetch_single(EEDB::Feature::create, db, sql, "d", id);
}


vector<DBObject*>  EEDB::Feature::fetch_all_by_ids(MQDB::Database *db, vector<long int> &fids) {
  vector<DBObject*>  t_result;
  if(db==NULL) { return t_result; }
  if(fids.empty()) { return t_result; }
  
  string sql = "SELECT * FROM feature WHERE feature_id in(";
  //loop on feature_ids
  char    buffer[64];
  vector<long int>::iterator  it2;
  for(it2=fids.begin(); it2!=fids.end(); it2++) {
    if(it2 != fids.begin()) { sql += ","; }
    snprintf(buffer, 63, "%ld", (*it2));
    sql += buffer;
  }
  sql += ")";
  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "");
}


vector<DBObject*>  EEDB::Feature::fetch_all_by_sources(MQDB::Database *db, vector<long int> &fsrc_ids) {
  vector<DBObject*>  t_result;
  if(db==NULL) { return t_result; }
  
  string sql = "SELECT * FROM feature ";
  
  //loop on feature_source_ids
  if(!fsrc_ids.empty()) {
    char    buffer[64];
    vector<long int>::iterator  it2;
    sql += "WHERE feature_source_id in(";
    for(it2=fsrc_ids.begin(); it2!=fsrc_ids.end(); it2++) {
      if(it2 != fsrc_ids.begin()) { sql += ","; }
      snprintf(buffer, 63, "%ld", (*it2));
      sql += buffer;          
    }
    sql += ")";
  }
  
  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "");
}


long int  EEDB::Feature::get_count_symbol_search(MQDB::Database *db, string value, string type) {
  value += "%";
  if(type.empty()) {
    const char *sql = "SELECT count(distinct feature_id) FROM symbol join feature_2_symbol using(symbol_id) \
    WHERE sym_value like ?";
    dynadata dd = db->fetch_col_value(sql, "s", value.c_str());
    return dd.i_int;
  } else {
    const char *sql = "SELECT count(distinct feature_id) FROM symbol join feature_2_symbol using(symbol_id) \
    WHERE sym_type=? AND sym_value like ?";
    dynadata dd = db->fetch_col_value(sql, "ss", type.c_str(), value.c_str());
    return dd.i_int;
  }
  return 0;
}


vector<DBObject*> EEDB::Feature::fetch_all_with_keywords(MQDB::Database *db, vector<long int> &fsrc_ids, vector<string> &keywords) {
  // fetch_all_with_keywords
  //    used for feature metadata filtering, generates list of potential features to post process
  vector<DBObject*>  t_result;
  if(keywords.empty()) { return t_result; }
  
  string sql = "SELECT * FROM feature JOIN (";

  sql += "SELECT distinct feature_id FROM feature_2_symbol JOIN (";
  //loop on keywords
  vector<string>::iterator  it1;
  for(it1=keywords.begin(); it1!=keywords.end(); it1++) {
    if(it1 != keywords.begin()) { sql += " UNION "; }
    sql += "SELECT symbol_id FROM symbol WHERE sym_value like \"" + (*it1) + "%\""; 
  }
  sql += ")s1 using(symbol_id) ";

  //now union with metadata
  sql += " UNION ";
  sql += "SELECT distinct feature_id FROM feature_2_metadata JOIN (";
  //loop on keywords
  for(it1=keywords.begin(); it1!=keywords.end(); it1++) {
    if(it1 != keywords.begin()) { sql += " UNION "; }
    sql += "SELECT metadata_id FROM metadata WHERE data like \"" + (*it1) + "%\""; 
  }
  sql += ")m1 using(metadata_id) ";
  
  sql += ")f1 using(feature_id)";
  
  //loop on feature_source_ids
  if(!fsrc_ids.empty()) {
    char    buffer[64];
    vector<long int>::iterator  it2;
    sql += " WHERE feature_source_id in(";
    for(it2=fsrc_ids.begin(); it2!=fsrc_ids.end(); it2++) {
      if(it2 != fsrc_ids.begin()) { sql += ","; }
      snprintf(buffer, 63, "%ld", (*it2));
      sql += buffer;          
    }
    sql += ")";
  }      

/*
  string sql = "SELECT * FROM feature JOIN ((SELECT distinct feature_id FROM feature_2_symbol JOIN symbol using(symbol_id) WHERE sym_value like ?";
  if(!type.empty()) { sql += " AND sym_type='"+type+"'"; }
  sql += ") UNION ";
  sql += "(SELECT distinct feature_id FROM feature_2_metadata JOIN metadata using(metadata_id) where data like ?";
  if(!type.empty()) { sql += " AND data_type='"+type+"'"; }
  sql += "))t1 using(feature_id) where feature_source_id = ?";

  //fprintf(stderr, "%s\n", sql.c_str());
  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "ssd", value.c_str(), value.c_str(), source->primary_id());
*/

  /*
   SELECT * FROM feature JOIN 
   (select distinct feature_id FROM feature_2_symbol JOIN 
   (select symbol_id from symbol where sym_value like "tumor%" UNION
   select symbol_id from symbol where sym_value like "necrosis%" UNION
   select symbol_id from symbol where sym_value like "fact%" 
   )s1 using(symbol_id )
   )f1 using(feature_id ) 
   WHERE feature_source_id in(31);
   */

  //fprintf(stderr, "%s\n", sql.c_str());
  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "");
}


void  EEDB::Feature::stream_by_named_region(MQDB::DBStream   *dbstream, 
                       vector<long int> &fsrc_ids, 
                       string           assembly_name,
                       string           chrom_name,
                       long int         chrom_start,
                       long int         chrom_end)
{
  //stream all features from a specific region on a genome with a given set of source filters
  MQDB::Database  *db;
  char            buffer[2048];
  
  if(dbstream ==NULL) { return; }
  db = dbstream->database();
  if(db==NULL) { return; }
  //printf("  stream_by_named_region %s :: %s : %ld .. %ld [%ld]\n", assembly_name.c_str(), chrom_name.c_str(), chrom_start, chrom_end, db->retain_count());
  
  //EEDB::Chrom *chrom = EEDB::Chrom::fetch_by_name(db, assembly_name, chrom_name);
  EEDB::Assembly *asmb = EEDB::Assembly::fetch_by_name(db, assembly_name);
  if(!asmb) { return; }
  EEDB::Chrom *chrom = asmb->get_chrom(chrom_name.c_str());
  if(!chrom) { return; }
  
  string sql;
  snprintf(buffer, 2040, "SELECT * FROM feature f WHERE chrom_id=%ld", chrom->primary_id());
  sql = buffer;
  chrom->release();
  
  //loop on feature_source_ids
  if(!fsrc_ids.empty()) {
    char    buffer[64];
    vector<long int>::iterator  it2;
    sql += " AND feature_source_id in(";
    for(it2=fsrc_ids.begin(); it2!=fsrc_ids.end(); it2++) {
      if(it2 != fsrc_ids.begin()) { sql += ","; }
      snprintf(buffer, 63, "%ld", (*it2));
      sql += buffer;          
    }
    sql += ")";
  }      
  
  if(chrom_start>0) { 
    snprintf(buffer, 2040, " AND chrom_end >= %ld ", chrom_start);
    sql += buffer;
  }
  if(chrom_end >0) {
    snprintf(buffer, 2040, " AND chrom_start <= %ld ", chrom_end);
    sql += buffer;
  }
  sql += " ORDER BY chrom_start, chrom_end, f.feature_id";
  
  //printf("%s\n", sql.c_str());
  dbstream->class_create(EEDB::Feature::create);
  dbstream->prepare_sql(sql.c_str());
}


void  EEDB::Feature::stream_by_named_region(MQDB::DBStream   *dbstream, 
                                            vector<long int> &fsrc_ids,
                                            vector<long int> &exp_ids, 
                                            vector<string>   &datatypes,
                                            string           assembly_name,
                                            string           chrom_name,
                                            long int         chrom_start,
                                            long int         chrom_end)
{
  //stream all features from a specific region on a genome with a given set of source filters
  MQDB::Database  *db;
  char            buffer[2048];
  
  if(dbstream ==NULL) { return; }
  db = dbstream->database();
  if(db==NULL) { return; }
  //printf("  stream_by_named_region (expr) %s :: %s : %ld .. %ld [%ld]\n", assembly_name.c_str(), chrom_name.c_str(), chrom_start, chrom_end, db->retain_count());
  
  //EEDB::Chrom *chrom = EEDB::Chrom::fetch_by_name(db, assembly_name, chrom_name);
  EEDB::Assembly *asmb = EEDB::Assembly::fetch_by_name(db, assembly_name);
  if(!asmb) { return; }
  EEDB::Chrom *chrom = asmb->get_chrom(chrom_name.c_str());
  if(!chrom) { return; }
  
  //loop on feature_source_ids
  string fsrc_clause;
  if(!fsrc_ids.empty()) {
    fsrc_clause += " AND feature_source_id in(";
    for(unsigned int i=0; i<fsrc_ids.size(); i++) {
      if(i != 0) { fsrc_clause += ","; }
      snprintf(buffer, 63, "%ld", fsrc_ids[i]);
      fsrc_clause += buffer;          
    }
    fsrc_clause += ")";
  }      
  
  //loop on experiment_ids
  string exp_clause;
  if(!exp_ids.empty()) {
    exp_clause += " AND experiment_id in(";
    for(unsigned int i=0; i<exp_ids.size(); i++) {
      if(i != 0) { exp_clause += ","; }
      snprintf(buffer, 63, "%ld", exp_ids[i]);
      exp_clause += buffer;          
    }
    exp_clause += ")";
  }      
  
  //loop on datatypes
  string datatype_clause;
  if(!datatypes.empty()) {
    datatype_clause += " AND datatype in(";
    for(unsigned int i=0; i<datatypes.size(); i++) {
      if(i != 0) { datatype_clause += ","; }
      snprintf(buffer, 63, "'%s'", datatypes[i].c_str());
      datatype_clause += buffer;          
    }
    datatype_clause += ")";
  }      
    
  string sql;
  sql = "SELECT f.* FROM feature f ";
  sql += "JOIN expression using(feature_id) JOIN expression_datatype using(datatype_id) ";
  snprintf(buffer, 2040, "WHERE chrom_id=%ld", chrom->primary_id()); sql += buffer;
  if(chrom_start>0) { snprintf(buffer, 2040, " AND chrom_end >= %ld ", chrom_start); sql += buffer; }
  if(chrom_end >0)  { snprintf(buffer, 2040, " AND chrom_start <= %ld ", chrom_end); sql += buffer; }
  sql += fsrc_clause + exp_clause + datatype_clause;
  sql += " GROUP BY f.feature_id ORDER BY chrom_start, chrom_end, f.feature_id";
  
  //fprintf(stderr, "%s\n", sql.c_str());  
  dbstream->class_create(EEDB::Feature::create);
  dbstream->prepare_sql(sql.c_str());
}


vector<DBObject*>  EEDB::Feature::fetch_all_by_primary_name(MQDB::Database *db, vector<long int> &fsrc_ids, string name) {
  vector<DBObject*>  t_result;
  if(db==NULL) { return t_result; }
  
  string sql = "SELECT * FROM feature WHERE primary_name=? ";
  
  //loop on feature_source_ids
  if(!fsrc_ids.empty()) {
    char    buffer[64];
    vector<long int>::iterator  it2;
    sql += "AND feature_source_id in(";
    for(it2=fsrc_ids.begin(); it2!=fsrc_ids.end(); it2++) {
      if(it2 != fsrc_ids.begin()) { sql += ","; }
      snprintf(buffer, 63, "%ld", (*it2));
      sql += buffer;          
    }
    sql += ")";
  }
  sql += " ORDER BY feature_id";

  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "s", name.c_str());
}


vector<DBObject*>  EEDB::Feature::fetch_all_by_source(EEDB::FeatureSource* source) {
  vector<DBObject*>  t_result;
  if(source==NULL) { return t_result; }
  MQDB::Database *db = source->database();
  if(!db) { return t_result; }
  
  const char *sql = "SELECT * FROM feature WHERE feature_source_id=?";
  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql, "d", source->primary_id());
}


vector<DBObject*>  EEDB::Feature::fetch_all_by_source_primary_name(EEDB::FeatureSource* source, string name) {
  vector<DBObject*>  t_result;
  if(source==NULL) { return t_result; }
  MQDB::Database *db = source->database();
  if(!db) { return t_result; }
  if(name.empty()) { return t_result; }

  string sql = "SELECT * FROM feature WHERE primary_name like ? AND feature_source_id = ?";
  sql += " ORDER BY chrom_start, chrom_end, feature_id";

  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "sd", name.c_str(), source->primary_id());
}


vector<DBObject*>  EEDB::Feature::fetch_all_by_source_metadata(EEDB::FeatureSource* source, string type, string value) {
  vector<DBObject*>  t_result;
  if(source==NULL) { return t_result; }
  MQDB::Database *db = source->database();
  if(!db) { return t_result; }
  if(value.empty()) { return t_result; }
  
  //$sym_value =~ s/\"/\\\"/g;
  //$sym_value =~ s/\'/\\\'/g;  #'
 
//select * from feature join ((SELECT distinct feature_id FROM feature_2_symbol JOIN symbol using(symbol_id) where sym_value like "ENSG00000223546%") UNION (SELECT distinct feature_id FROM feature_2_metadata JOIN metadata using(metadata_id) where data like "ENSG00000223546%"))t1 using(feature_id) where feature_source_id in(9);

  //value += "%"; //to force it into a prefix like search

  string sql = "SELECT * FROM feature JOIN ((SELECT distinct feature_id FROM feature_2_symbol JOIN symbol using(symbol_id) WHERE sym_value like ?";
  if(!type.empty()) { sql += " AND sym_type='"+type+"'"; }
  sql += ") UNION ";
  sql += "(SELECT distinct feature_id FROM feature_2_metadata JOIN metadata using(metadata_id) where data like ?";
  if(!type.empty()) { sql += " AND data_type='"+type+"'"; }
  sql += "))t1 using(feature_id) where feature_source_id = ?";

  //fprintf(stderr, "%s\n", sql.c_str());
  return MQDB::fetch_multiple(EEDB::Feature::create, db, sql.c_str(), "ssd", value.c_str(), value.c_str(), source->primary_id());
}


EEDB::Feature*  EEDB::Feature::fetch_by_source_primary_name(EEDB::FeatureSource* source, string name) {
  if(source==NULL) { return NULL; }
  MQDB::Database *db = source->database();
  if(!db) { return NULL; }
  
  string sql = "SELECT * from feature WHERE feature_source_id=? and primary_name=? ORDER BY feature_id LIMIT 1";
  //fprintf(stderr, "%s\n", sql.c_str());
  return (EEDB::Feature*) MQDB::fetch_single(EEDB::Feature::create, db, sql.c_str(), "ds", source->primary_id(), name.c_str());
}


// stream_by_named_region
//    stream all features from a specific region on a genome with a given set of source filters
void  EEDB::Feature::fetch_by_region(MQDB::Database *db, EEDB::SPStreams::StreamBuffer *stream,
                                     vector<long int> &fsrc_ids, 
                                     vector<long int> &exp_ids, 
                                     vector<string>   &datatypes, 
                                     string           assembly_name,
                                     string           chrom_name,
                                     long int         chrom_start,
                                     long int         chrom_end)
{
  char              buffer[2048];
  
  if(db==NULL) { return; }
  //printf("  fetch_by_region %s :: %s : %ld .. %ld\n", assembly_name.c_str(), chrom_name.c_str(), chrom_start, chrom_end);
  
  //EEDB::Chrom *chrom = EEDB::Chrom::fetch_by_name(db, assembly_name, chrom_name);
  EEDB::Assembly *asmb = EEDB::Assembly::fetch_by_name(db, assembly_name);
  if(!asmb) { return; }
  EEDB::Chrom *chrom = asmb->get_chrom(chrom_name.c_str());
  if(!chrom) { return; }
  
  //loop on feature_source_ids
  string fsrc_clause;
  if(!fsrc_ids.empty()) {
    fsrc_clause += " AND feature_source_id in(";
    for(unsigned int i=0; i<fsrc_ids.size(); i++) {
      if(i != 0) { fsrc_clause += ","; }
      snprintf(buffer, 63, "%ld", fsrc_ids[i]);
      fsrc_clause += buffer;          
    }
    fsrc_clause += ")";
  }      
  
  //loop on experiment_ids
  string exp_clause;
  if(!exp_ids.empty()) {
    exp_clause += " AND experiment_id in(";
    for(unsigned int i=0; i<exp_ids.size(); i++) {
      if(i != 0) { exp_clause += ","; }
      snprintf(buffer, 63, "%ld", exp_ids[i]);
      exp_clause += buffer;          
    }
    exp_clause += ")";
  }      
  
  //loop on datatypes
  string datatype_clause;
  if(!datatypes.empty()) {
    datatype_clause += " AND datatype in(";
    for(unsigned int i=0; i<datatypes.size(); i++) {
      if(i != 0) { datatype_clause += ","; }
      snprintf(buffer, 63, "'%s'", datatypes[i].c_str());
      datatype_clause += buffer;          
    }
    datatype_clause += ")";
  }      
  
  string sql;
  sql = "SELECT f.*, experiment_id, expression_id, value, sig_error, datatype FROM feature f ";
  sql += "JOIN expression using(feature_id) JOIN expression_datatype using(datatype_id) ";
  snprintf(buffer, 2040, "WHERE chrom_id=%ld", chrom->primary_id()); sql += buffer;
  if(chrom_start>0) { snprintf(buffer, 2040, " AND chrom_end >= %ld ", chrom_start); sql += buffer; }
  if(chrom_end >0)  { snprintf(buffer, 2040, " AND chrom_start <= %ld ", chrom_end); sql += buffer; }
  sql += fsrc_clause + exp_clause + datatype_clause;
  sql += " ORDER BY chrom_start, chrom_end, f.feature_id";
  
  //fprintf(stderr, "%s\n", sql.c_str());  
  vector<DBObject*> e_result = MQDB::fetch_multiple(EEDB::Expression::create, db, sql.c_str(), "");

  //perform the expression2feature collation and fill the streambuffer
  EEDB::Feature *currentfeature = NULL;
  for(unsigned i=0; i<e_result.size(); i++) {
    EEDB::Expression *express = (EEDB::Expression*)e_result[i];
    if(!currentfeature) { 
      currentfeature = EEDB::Feature::fetch_by_id(db, express->feature_id());
    }
    if(!currentfeature) { 
      throw(13); //something wrong
    }
    if(currentfeature->primary_id() != express->feature_id()) {
      //finished with this feature
      stream->add_object(currentfeature);
      currentfeature = EEDB::Feature::fetch_by_id(db, express->feature_id());
    }    
    currentfeature->add_expression(express);
    express->release();
  }
  if(currentfeature) {
    //add in the last currentfeature
    stream->add_object(currentfeature);
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// expression management API section
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::Feature::load_expression() {
  if(_expression_loaded) { return; }
  _expression_loaded = true;
  if(_database != NULL) {
    vector<DBObject*> express_array = EEDB::Expression::fetch_all_by_feature_id(_database, _primary_db_id);
    for(unsigned int i=0; i< express_array.size(); i++) {
      EEDB::Expression* express = (EEDB::Expression*)express_array[i];
      _expression_array.push_back(express);
    }
  }
}

vector<EEDB::Expression*>  EEDB::Feature::expression_array() {
  if(!_expression_loaded) { load_expression(); }
  return _expression_array;
}


void  EEDB::Feature::empty_expression_array() {
  vector<EEDB::Expression*>::iterator  it;
  for(it = _expression_array.begin(); it != _expression_array.end(); it++) {
    (*it)->release();
  }
  _expression_array.clear();
  _expression_hash.clear();
}

void  EEDB::Feature::add_expression(EEDB::Expression *expression) {  
  if(expression == NULL) { return; }
  if(!expression->experiment()) { return; }
  expression->retain();
  _expression_array.push_back(expression);
  _expression_loaded = true;
}

void  EEDB::Feature::copy_expression(EEDB::Expression *expression) {  
  if(expression == NULL) { return; }
  if(!expression->experiment()) { return; }
  if(_expression_hash.empty()) { rebuild_expression_hash(); }
  string expkey = expression->experiment_dbid() + expression->datatype()->type();
  if(_expression_hash.find(expkey) == _expression_hash.end()) {
    //copy content to a new expression object
    //do not set the feature since this can cause looped memory reference
    EEDB::Expression *expr2 = EEDB::Expression::realloc();
    expr2->experiment(expression->experiment());
    expr2->datatype(expression->datatype());
    expr2->value(expression->value());
    expr2->count(expression->count());
    expr2->sig_error(expression->sig_error());
    expr2->duplication(expression->duplication());
    _expression_array.push_back(expr2);
    _expression_hash[expkey] = expr2;
  }
  _expression_loaded = true;
}

void  EEDB::Feature::add_expression(EEDB::Experiment *experiment, EEDB::Datatype *datatype, double value) {  
  if(experiment == NULL) { return; }
  if(datatype == NULL) { return; }

  if(_expression_hash.empty()) { rebuild_expression_hash(); }
  string expkey = experiment->db_id() + datatype->type();
  if(_expression_hash.find(expkey) == _expression_hash.end()) {
    EEDB::Expression *expression = EEDB::Expression::realloc();    
    expression->experiment(experiment);
    expression->datatype(datatype);
    expression->value(value);
    expression->count(1);
    expression->sig_error(1.0);
    expression->duplication(1);
    //do not set the feature since this can cause looped memory reference
    _expression_array.push_back(expression);
    _expression_hash[expkey] = expression;
  }
  _expression_loaded = true;
}


EEDB::Expression*  EEDB::Feature::get_expression(EEDB::Experiment *experiment, EEDB::Datatype *datatype) {
  //searches for expression, if it is not found it will create the expression object
  if(!_expression_loaded) { load_expression(); }

  EEDB::Expression* express = find_expression(experiment, datatype);
  if(express) { return express; }

  express = EEDB::Expression::realloc();    
  express->experiment(experiment);
  express->datatype(datatype);
  express->value(0.0);
  express->count(0);
  _expression_array.push_back(express);
  if(!_expression_hash.empty()) { 
    string expkey = experiment->db_id() + datatype->type();
    _expression_hash[expkey] = express; 
  }
  return express;
}


bool  EEDB::Feature::build_expression_hash() {
  if(!_expression_hash.empty()) { return false; }
  rebuild_expression_hash();
  return true;
}

void  EEDB::Feature::rebuild_expression_hash() {
  _expression_hash.clear();
  for(unsigned int i=0; i< _expression_array.size(); i++) {
    EEDB::Expression *expr = _expression_array[i];
    if(!expr) { continue; }
    string expkey = expr->experiment_dbid() + expr->datatype()->type();
    _expression_hash[expkey] = expr;
  }  
}


EEDB::Expression*  EEDB::Feature::find_expression(EEDB::Experiment *experiment, EEDB::Datatype *datatype) {
  //searches for expression, if it is not found it will return NULL
  if(!_expression_loaded) { load_expression(); }
  
  if(!_expression_hash.empty() and (experiment != NULL) and (datatype != NULL)) { //use hash
    string expkey = experiment->db_id() + datatype->type();
    if(_expression_hash.find(expkey) != _expression_hash.end()) {
      return _expression_hash[expkey];
    } else {
      return NULL;
    }
  }
  
  for(unsigned int i=0; i< _expression_array.size(); i++) {
    EEDB::Expression *expr = _expression_array[i];
    if((experiment != NULL) and (experiment->db_id() != expr->experiment_dbid())) { continue; }
    if((datatype   != NULL) and (datatype != expr->datatype())) { continue; } 
    return expr;
  }
  return NULL;
}


bool  EEDB::Feature::collate_expression(EEDB::Feature *feat2, t_collate_express_mode express_mode) {
  //collate expression data from feat2 into this feature
  if(feat2==NULL) { return false; }
      
  vector<EEDB::Expression*>  expression = feat2->expression_array();
  for(unsigned int i=0; i<expression.size(); i++) {
    
    EEDB::Expression *expr2 = expression[i];
    EEDB::Expression *expr1 = find_expression(expr2->experiment(), expr2->datatype());
    
    if(expr1) {
      double value = expr1->value();
      double eff_value = expr1->value() / expr1->duplication();
      switch(express_mode) {
        case CL_MIN:
          if(i==0) { value = expr2->value(); }
          else if(expr2->value() < value) { value = expr2->value(); }
          break;
        case CL_MAX:
          if(i==0) { value = expr2->value(); }
          else if(expr2->value() > value) { value = expr2->value(); }
          break;
        case CL_SUM:
          value     += expr2->value();
          eff_value += expr2->value() / expr2->duplication();
          break;
        case CL_MEAN:
          value     += expr2->value();
          eff_value += expr2->value() / expr2->duplication();
          break;
        case CL_COUNT:
          value++;
          break;
        case CL_NONE:
          break;
      }
      expr1->value(value);
      expr1->count(expr1->count() + expr2->count());
      expr1->duplication(value / eff_value);
    } else {
      copy_expression(expr2);
    }
  }
  return true;
}


void  EEDB::Feature::calc_significance(t_collate_express_mode cmode) {
  if(cmode == CL_NONE) { return; }
  load_expression(); //lazy load if needed
  double sig = 0.0;
  for(unsigned int i=0; i<_expression_array.size(); i++) {
    EEDB::Expression *express = _expression_array[i];
    switch(cmode) {
      case CL_MIN: 
        if(i==0) { sig = express->value(); }
        else if(express->value() < sig) { sig = express->value(); }
        break;
      case CL_MAX: 
        if(i==0) { sig = express->value(); }
        else if(express->value() > sig) { sig = express->value(); }
        break;
      case CL_SUM: 
        sig += express->value();
        break;
      case CL_MEAN: 
        sig += express->value();
        break;
      case CL_COUNT: 
        sig++;
        break;
      case CL_NONE:
        break;
    }
  }
  if(cmode == CL_MEAN) {
    sig = sig / _expression_array.size();
  }
  significance(sig);
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// MappedQuery override methods - storage
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::Feature::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(feature_source() == NULL) { return false; }

  db->do_sql("INSERT INTO feature(feature_source_id, chrom_id, primary_name, \
              chrom_start, chrom_end, strand, significance) \
             VALUES(?,?,?,?,?,?,?)", "ddsddcf", 
             feature_source()->primary_id(), chrom_id(), _primary_name.c_str(),
             _chrom_start, _chrom_end, _strand, _significance);

  if(db->last_insert_id() < 0) { return false; }
  
  _primary_db_id = db->last_insert_id();
  database(db);
  _peer_uuid = NULL;
  _db_id.clear();
             
  //now do the symbols and metadata  
  store_metadata();

  //link to chunk system  (maybe not port since it was not as good as expected)
  //$self->_link_2_chunk();
  return true;
}


bool EEDB::Feature::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }

  MQDB::Database *db = database();
  
  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Symbol::class_name) {
      EEDB::Symbol *sym = (EEDB::Symbol*)md;
      if(!sym->check_exists_db(db)) { sym->store(db); }
      sym->store_link_to_feature(this);
    } else {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_feature(this);
    }
  }
  return true;
}


bool EEDB::Feature::update_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  //unlink all old metadata
  db->do_sql("DELETE FROM feature_2_metadata WHERE feature_id=?", "d", primary_id());
  db->do_sql("DELETE FROM feature_2_symbol   WHERE feature_id=?", "d", primary_id());
  
  //store again
  store_metadata();
  return true;
}


bool EEDB::Feature::update_location() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();

  const char *sql = "UPDATE feature SET primary_name=?, chrom_id=?, chrom_start=?, chrom_end=?, strand=? WHERE feature_id=?";
  db->do_sql(sql, "sdddcd", _primary_name.c_str(), chrom_id(), _chrom_start, _chrom_end, _strand, primary_id());
  return true;
}


bool EEDB::Feature::store_expression() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }

  load_expression(); //lazy load if needed
  for(unsigned int i=0; i<_expression_array.size(); i++) {
    EEDB::Expression *expr = _expression_array[i];
    //if(expr->value() == 0.0) { continue; } 
    expr->store(this);
  }
  return true;
}


