/* $Id: MetadataSet.cpp,v 1.82 2018/10/05 05:21:21 severin Exp $ */

/****
NAME - EEDB::MetadataSet

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
#include <EEDB/MetadataSet.h>

using namespace std;
using namespace MQDB;

bool mdset_sort_func (EEDB::Metadata *a, EEDB::Metadata *b);

const char*               EEDB::MetadataSet::class_name = "MetadataSet";

void _eedb_metadataset_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::MetadataSet*)obj;
}
void _eedb_metadataset_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::MetadataSet*)obj)->_xml(xml_buffer);
}
void _eedb_metadataset_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::MetadataSet*)obj)->_xml(xml_buffer);
}


EEDB::MetadataSet::MetadataSet() {
  init();
}

EEDB::MetadataSet::~MetadataSet() {
  vector<EEDB::Metadata*>::iterator  it;
  for(it = _metadata.begin(); it != _metadata.end(); it++) {
    (*it)->release();
  }
}

void EEDB::MetadataSet::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::MetadataSet::class_name;
  _funcptr_delete            = _eedb_metadataset_delete_func;
  _funcptr_xml               = _eedb_metadataset_xml_func;
  _funcptr_simple_xml        = _eedb_metadataset_simple_xml_func;
}


void EEDB::MetadataSet::init_from_xml(void *xml_node) {
  // init using a rapidxml parent node
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      add_metadata(mdata);
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }
}
  


//////////////////////////////////////////////////////////////////////////////////////////////////
// Instance methods
//////////////////////////////////////////////////////////////////////////////////////////////////



EEDB::MetadataSet* EEDB::MetadataSet::copy() {
  EEDB::MetadataSet *mdset2 = new EEDB::MetadataSet();
  mdset2->merge_metadataset(this); //does shallow copy (shares mdata and increases retain count)
  return mdset2;
}


////////////////////////////////////


void EEDB::MetadataSet::merge_metadataset(EEDB::MetadataSet *mdset) {
  vector<EEDB::Metadata*> data = mdset->metadata_list();
  for(unsigned int i=0; i<data.size(); i++) {
    EEDB::Metadata *mdata = (EEDB::Metadata*)data[i];
    if(mdata !=NULL) {
      mdata->retain();
      _metadata.push_back(mdata);
    }
  }
  sort(_metadata.begin(), _metadata.end(), mdset_sort_func);
}

void EEDB::MetadataSet::add_metadata(vector<DBObject*> data) {
  for(unsigned int i=0; i<data.size(); i++) {
    EEDB::Metadata *mdata = (EEDB::Metadata*)data[i];
    if(mdata !=NULL) { _metadata.push_back(mdata); }
  }
}

void EEDB::MetadataSet::add_metadata(vector<EEDB::Metadata*> data) {
  for(unsigned int i=0; i<data.size(); i++) {
    EEDB::Metadata *mdata = (EEDB::Metadata*)data[i];
    if(mdata !=NULL) { _metadata.push_back(mdata); }
  }
}

void EEDB::MetadataSet::add_metadata(EEDB::Metadata* data) {
  if(data==NULL) { return; }
  _metadata.push_back(data);
}


EEDB::Metadata* EEDB::MetadataSet::add_metadata(string tag, string value) {
  EEDB::Metadata     *md = NULL;
  if(EEDB::Symbol::is_symbol(value)) {
    md = add_tag_symbol(tag, value);
  } else {
    md = add_tag_data(tag, value);
  }
  return md;
}

void EEDB::MetadataSet::remove_metadata(vector<EEDB::Metadata*> data) {
  for(unsigned int i=0; i<data.size(); i++) {
    EEDB::Metadata *mdata = data[i];
    if(mdata !=NULL) { remove_metadata(mdata); }
  }  
}

void EEDB::MetadataSet::remove_metadata(EEDB::Metadata* data) {
  if(data==NULL) { return; }
  vector<EEDB::Metadata*>::iterator it, it2;
  it = it2 = _metadata.begin();
  while(it != _metadata.end()) {
    if((*it) == data) { 
      _metadata.erase(it);
      it = it2;
    } else { 
      it2 = it;
      it++; 
    }
  }
}

void EEDB::MetadataSet::remove_metadata_like(string tag, string value) {
  vector<EEDB::Metadata*> mdata = find_all_metadata_like(tag, value);
  remove_metadata(mdata);
}

EEDB::Symbol* EEDB::MetadataSet::add_tag_symbol(string tag, string value) {
  Symbol *symbol = new EEDB::Symbol(tag, value);
  _metadata.push_back(symbol);
  return symbol;
}

EEDB::Metadata* EEDB::MetadataSet::add_tag_data(string tag, string value) {
  Metadata *mdata = new EEDB::Metadata(tag, value);
  _metadata.push_back(mdata);
  return mdata;
}

bool mdset_sort_func (EEDB::Metadata *a, EEDB::Metadata *b) {
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (*a < *b); 
}

void EEDB::MetadataSet::remove_duplicates() {
  if(_metadata.empty()) { return; }

  //resort the metadata list
  sort(_metadata.begin(), _metadata.end(), mdset_sort_func);
  
  //do neighbor unique/delete
  vector<Metadata*> newlist;
  newlist.push_back(_metadata[0]);
  EEDB::Metadata *last = _metadata[0];
  for(unsigned int i=1; i<_metadata.size(); i++) {
    EEDB::Metadata *md = _metadata[i];
    if(*last != *md) {
      newlist.push_back(md);
      last = md;
    } else {
      md->release();
    }
  }
  _metadata = newlist;
}


void EEDB::MetadataSet::clear() {
  for(unsigned int i=0; i<_metadata.size(); i++) {
    EEDB::Metadata *md = _metadata[i];
    md->release();
  }
  _metadata.clear();
}
  

/*
=head2 convert_bad_symbols

  Description  : Symbol is a special subclass of metadata which is supposed to be keyword-like
                 Symbols should have no whitespace and should be short enough to fit in the table
                 This method will double check the metadata and any improper Symbol is 
                 converted into EEDB::Metadata and unlinked from database.
                 This is useful when mirroring data or prior to bulk loading.
  Returntype   : $self
  Exceptions   : none

=cut
*/

/*
EEDB::MetadataSet::convert_bad_symbols {
  my $self = shift;
  //since Symbol is a special subclass of Metadata and uses the same
  //instance variables, I can just recast if there is a problem
  
  foreach my $mdata (@{$self->metadata_list}) {
    my $value = $mdata->data;
    if (($mdata->class eq "Symbol") and (($value =~ /\s/) or (length($value)>120))) {
      //if has whitespace or it is too long then this is Metadata
      bless $mdata, "EEDB::Metadata";
      $mdata->primary_id(undef);
      $mdata->database(undef);
    }
  }
  return $self;
}
*/


void EEDB::MetadataSet::extract_keywords() {
  for(unsigned int i=0; i<_metadata.size(); i++) {
    EEDB::Metadata *mdata = _metadata[i];
    if(mdata->type() == "configXML") { continue; }
    if(mdata->classname() == EEDB::Metadata::class_name) {
      mdata->extract_keywords(this);
    }
  }
  remove_duplicates();
}

void  EEDB::MetadataSet::extract_mdkeys(map<string, bool> &mdkey_hash) {
  for(unsigned int i=0; i<_metadata.size(); i++) {
    EEDB::Metadata *mdata = _metadata[i];
    //if(mdata->type() == "configXML") { continue; }
    if(mdata->classname() == EEDB::Metadata::class_name) {
      mdata->extract_mdkeys(mdkey_hash);
    }
  }
}  

////////////////////////////////////////////////////////////////////////////////////////////////
//
// list access methods
//
////////////////////////////////////////////////////////////////////////////////////////////////


int EEDB::MetadataSet::count() {
  return _metadata.size();
}

int EEDB::MetadataSet::size() {
  return _metadata.size();
}

vector<EEDB::Metadata*> EEDB::MetadataSet::metadata_list() {
  return _metadata;
}

int EEDB::MetadataSet::data_size() {
  int bytes =0;
  for(unsigned int i=0; i<_metadata.size(); i++) {
    EEDB::Metadata *md = _metadata[i];
    bytes += md->data_size();
  }
  return bytes;
}


////////////////////////////////////////////////////////////////////////////////////////////////
//
// search methods
//
////////////////////////////////////////////////////////////////////////////////////////////////

EEDB::Metadata* EEDB::MetadataSet::find_metadata(string tag, string value) {
  //returns first occurance matching search pattern. 
  //if value is set, this is an exact match search
  //if value is empty, this returns the first occurance with matching tag.
  if(tag.empty() && value.empty()) { return NULL; }
  boost::algorithm::to_lower(value);

  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    bool rtn = true;
    if(!tag.empty() && (mdata->type() != tag)) { rtn = false; }
    if(!value.empty()) {
      //string tval = mdata->data().substr(0,value.size());
      string tval = mdata->data();
      boost::algorithm::to_lower(tval);
      if(tval != value) { rtn = false; }
    }
    if(rtn) { return mdata; }
  } 
  return NULL;
}


vector<EEDB::Metadata*> EEDB::MetadataSet::find_all_metadata_like(string tag, string value) {
  //returns simple array reference of mdata
  //finds all occurance matching search pattern
  //tag (if specified) must match exactly, but value(if specified) is allowed to be a 'prefix'
  
  vector<Metadata*> rtn_mdata;

  if(tag.empty() && value.empty()) { return rtn_mdata; }
  boost::algorithm::to_lower(value);
  
  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    bool rtn = true;
    if(!tag.empty() && (mdata->type() != tag)) { rtn = false; }
    if(rtn && !value.empty()) {
      string tval = mdata->data().substr(0,value.size());
      boost::algorithm::to_lower(tval);
      if(tval != value) { rtn = false; }
    }
    if(rtn) { rtn_mdata.push_back(mdata); }
  } 
  return rtn_mdata;
}


vector<EEDB::Metadata*> EEDB::MetadataSet::all_metadata_with_tags(map<string,bool> tags) {
  vector<Metadata*> rtn_mdata;
  
  if(tags.empty()) { return rtn_mdata; }
  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    if(tags[mdata->type()]) { rtn_mdata.push_back(mdata); }
  }
  return rtn_mdata;
}


bool EEDB::MetadataSet::has_metadata_like(string tag, string value) {
  //tag (if specified) must match exactly (case-sensitive)
  //value (if specified) is allowed to be a case-insensitive 'prefix'
  
  if(tag.empty() && value.empty()) { return false; }
  boost::algorithm::to_lower(value);

  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    bool rtn = true;
    if(!tag.empty() && (mdata->type() != tag)) { rtn = false; }
    if(!value.empty()) {
      //prior to 2.8.3 this only searched Symbols, now everything
      
      //--prefix search
      //string tval = mdata->data().substr(0,value.size());
      //boost::algorithm::to_lower(tval);
      //if(tval != value) { rtn = false; }

      //--anywhere search
      string tval = mdata->data();
      boost::algorithm::to_lower(tval);
      if(tval.find(value)==string::npos) { rtn = false; }
    }
    if(rtn) { return true; }
  } 
  return false;
}


bool EEDB::MetadataSet::check_by_filter_logic(string filter) {
  string phrase1, phrase2;
  size_t  p1, p2, p3;
  
  if(filter.empty()) { return true; }  //empty string matches everything

  //trim white space from front
  p1=0;
  while(p1<filter.length() and (filter.at(p1)==' ' or filter.at(p1)=='\t')) {
    p1++;
  }
  if(p1>0) { 
    filter = filter.substr(p1);
    //printf("  after trim[%s]\n", filter.c_str());
  }
  if(filter.empty()) { return true; }  //empty string matches everything

  //fprintf(stderr, "check_by_filter_logic[%s]\n", filter.c_str());  

  //"not" phrase
  p1 = filter.find("not ");
  if(p1==0) { 
    //invert phrase logic response
    //printf("  not phrase[%s]\n", filter.c_str());
    filter = filter.substr(p1+4);
    if(check_by_filter_logic(filter)) { return false; } else { return true; }
  }

  //"!(" not phrase
  p1 = filter.find("!(");
  if(p1==0) { 
    //invert block logic response
    //printf("  not phrase[%s]\n", filter.c_str());
    filter = filter.substr(1);
    if(check_by_filter_logic(filter)) { return false; } else { return true; }
  }
  
  // '(' blocking
  if(filter.at(0) == '(') {
    int cnt=1;
    p1=1;
    while(p1<filter.length() and cnt>0) {
      if(filter.at(p1) == '(') { cnt++; }
      if(filter.at(p1) == ')') { cnt--; }
      if(cnt>0) { p1++; }
    }
    phrase1.clear();
    phrase2.clear();
    if(cnt==0) { phrase1 = filter.substr(1, p1-1); }
    else { phrase1 = filter.substr(1); }
    
    if(p1<filter.length()) { p1++; } //move past the ')'
    //eat whitespace on phrase2
    while(p1<filter.length() and (filter.at(p1)==' ' or filter.at(p1)=='\t')) { p1++; }
    
    if(p1>=filter.length()) { 
      //no phrase2 so just do phrase1
      return check_by_filter_logic(phrase1); 
    }
    
    phrase2 = filter.substr(p1);
    //printf("  phrase2[%s]\n", phrase2.c_str());
    p2 = phrase2.find("or ");
    p3 = phrase2.find("and ");
    if(p2==0) {
      phrase2 = phrase2.substr(3);
      if(check_by_filter_logic(phrase1) or check_by_filter_logic(phrase2)) { return true; }
      else { return false; }
    } 
    else if(p3==0) {
      phrase2 = phrase2.substr(4);
      if(check_by_filter_logic(phrase1) and check_by_filter_logic(phrase2)) { return true; }
      else { return false; }
    } else {
      if(check_by_filter_logic(phrase1) and check_by_filter_logic(phrase2)) { return true; }
      else { return false; }
    }
  }


  //and phrases
  p1 = filter.find(" and ");
  if(p1!=string::npos) { 
    //process "and" phrases, any false in the "and" will cause a fail
    phrase1 = filter.substr(0, p1);
    phrase2 = filter.substr(p1+5);
    if(check_by_filter_logic(phrase1) and check_by_filter_logic(phrase2)) { return true; }
    else { return false; }
  }  
  
  //or phrases
  p1 = filter.find(" or ");
  if(p1!=string::npos) { 
    //process "or" phrases, any true makes it true
    phrase1 = filter.substr(0, p1);
    phrase2 = filter.substr(p1+4);
    if(check_by_filter_logic(phrase1) or check_by_filter_logic(phrase2)) { return true; }
    else { return false; }
  }  

  //2017-2-6 changed logic, now := and ~= requires () to isolate, but now allows spaces in key and value
  //ex: (oligo_info.target_gene_name:=negative control: scrambled antisense)
  //now everything before := ~= is key and everything after is value 
  //so only way to isolate is with ( ), not with " "

  //check for "key:=value" logic
  string key;
  p1 = filter.find(":=");
  if(p1!=string::npos) { 
    key = filter.substr(0, p1);
    if(p1+2 < filter.size()) {
      string val1 = filter.substr(p1+2);
      filter = val1;
    } else { filter = ""; }
    //fprintf(stderr, "found key:=value logic [%s] := [%s]\n", key.c_str(), filter.c_str());
    if(find_metadata(key, filter)) { return true; }
    else { return false; }
  }  
  //check for "key~=value" logic
  p1 = filter.find("~=");
  if(p1!=string::npos) { 
    key = filter.substr(0, p1);
    if(p1+2 < filter.size()) {
      string val1 = filter.substr(p1+2);
      filter = val1;
    } else { filter = ""; }
    //fprintf(stderr, "found key~=value logic [%s] :~ [%s]\n", key.c_str(), filter.c_str());
    if(has_metadata_like(key, filter)) { return true; }
    else { return false; }
  }  

  //multi word phrases like "brain cortex", translates as an implied "and"
  p1 = filter.find(" ");
  if(p1!=string::npos) { 
    //process " " phrases, any false makes it false
    phrase1 = filter.substr(0, p1);
    phrase2 = filter.substr(p1+1);
    if(check_by_filter_logic(phrase1) and check_by_filter_logic(phrase2)) { return true; }
    else { return false; }
  }  

  //OK this is a bare keyword now
  //check for !<key>
  bool invert_keyword = false;
  if(filter.at(0) == '!') { 
    filter = filter.substr(1);
    invert_keyword = true;
  }
  if(filter.empty()) { return true; }  //empty string matches everything
  bool rtn = has_metadata_like(key, filter);
  if(invert_keyword) { rtn = !rtn; }
  //printf("  keyword check [%s] %d\n", filter.c_str(), rtn);
  return rtn;
}


////////////////////////////////

string EEDB::MetadataSet::display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "MetadataSet() %d mdata", count());
  return buffer;
}


string EEDB::MetadataSet::display_contents() {
  string  str = display_desc() + "\n";
  sort(_metadata.begin(), _metadata.end(), mdset_sort_func);
  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    if(mdata->classname() == EEDB::Symbol::class_name) { 
      str += "  " + ((Symbol*)mdata)->display_desc() + "\n";
    } else {
      str += "  " + mdata->display_desc() + "\n";
    }
  }
  return str;
}

void EEDB::MetadataSet::_xml(string &xml_buffer) {
  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    //if(mdata->type() == "keyword") { continue; } //always hide the 'keywords' from the xml output
    xml_buffer.append("  ");
    mdata->xml(xml_buffer);
  }
}


void  EEDB::MetadataSet::xml_nokeywords(string &xml_buffer) {
  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    if(mdata->type() == "keyword") { continue; }
    xml_buffer.append("  ");
    mdata->xml(xml_buffer);
  }
}


string EEDB::MetadataSet::gff_description() {
  //the GFF2 format is not very robust , but this will be a ZENBU interpretation
  string gffdesc;
  
  for(unsigned int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    if(mdata->type() == "keyword") { continue; } //always hide the 'keywords' from the xml output
    //snprintf(buffer, 2040, ";asm=\"%s\"", chrom()->assembly()->assembly_name().c_str());
    if(!gffdesc.empty()) { gffdesc += ";"; }
    string t_data = mdata->data();
    boost::algorithm::replace_all(t_data, "\t", " ");
    boost::algorithm::replace_all(t_data, "\n", " ");
    boost::algorithm::replace_all(t_data, "\r", " ");
    boost::algorithm::replace_all(t_data, "\"", "'");
    
    gffdesc += mdata->type() +"=\"";
    gffdesc += t_data + "\"";
  }
  
  /*
  my $str ='';                  
  my $sym_hash ={};
  foreach my $mdata (sort {($b->class cmp $a->class) or ($a->type cmp $b->type) or ($a->data cmp $b->data)} @{$self->metadata_list}) {
    next unless($mdata->class eq 'Symbol');
    next if($mdata->type eq 'keyword');  //always hide the 'keywords' from the gff metadata output
    next if($mdata->data =~ /[\s\"\",]/);
    next if($mdata->data =~ /,/);
    //my $data = $mdata->data;
    //$data =~ s/\"/\\\"/g;
    //$str .= sprintf("%s=\"%s\"", $mdata->type, $data);
    my $data = $sym_hash->{$mdata->type};
    if(defined($data)) { $data .= ","; }
    $data .= $mdata->data;  
    $sym_hash->{$mdata->type} = $data;
  }
  my $first=1;
  foreach my $key (sort keys(%$sym_hash)) {
    unless($first) { $str .= ";"; }
    $first=0;
    my $data = $sym_hash->{$key};
    $str .= sprintf("_%s=\"%s\"", $key, $data);
  }
  */
  
  return gffdesc;
}


void  EEDB::MetadataSet::add_from_gff_attributes(string gff_attribs) {
  if(gff_attribs.empty()) { return; }
  
  char* attribs = (char*)malloc(gff_attribs.size()+3);
  bzero(attribs,gff_attribs.size()+3);
  strcpy(attribs, gff_attribs.c_str());
  
  //parse the separate categories from the gff_attribute and create metadata
  char *p1, *p2;
  p1 = p2 = attribs;
  string tag, value;
  int state=1;
  while(state != -1) {
    switch(state) {
      case 1: //get tag (delimited by space or =)
        while((*p1)==' ') { p1++; } //eat leading white space
        if(*p1 == '\0') { state= -1; break; }
        p2 = p1;
        while((*p2)!='\0' and (*p2)!=' ' and (*p2)!='=') { p2++; }
        if((*p2)=='\0') { state= -1; break; }
        *p2='\0';
        tag = p1;
        state=2;
        p2++;
        p1=p2;
        break;
      case 2: //get value
        while((*p1)==' ') { p1++; } //eat leading white space
        if(*p1 == '\0') { state= -1; break; }
        p2 = p1;
        if(*p1 == '"') { //find matching "
          p1++;
          p2 = p1;
          while((*p2)!='\0' and (*p2)!='"') { p2++; }
          if((*p2)=='"') { *p2='\0'; p2++; }
        }
        while((*p2)!='\0' and (*p2)!=',' and (*p2)!=';') { p2++; }
        
        if((*p2)==',') { state = 2; } //stay here because multiple values for same tag
        if((*p2)==';') { state = 1; } //move to next tag
        
        if((*p2)!='\0') {
          *p2='\0';
          p2++;
        }
        value = p1;
        add_tag_data(tag, value);
        p1 = p2;
        break;
    }
  }
  free(attribs);
  //extract_keywords();
}

////////////////////////////////////////////////////////////////

/*
bool EEDB::MetadataSet::store(MQDB::Database *db) {
  //just makes sure the Metadata/Symbols are stored/synched with database
  //used prior to doing linkage
  
  if(db==NULL) { return false; }  
  for(int i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    if(mdata->primary_id() < 0) { 
      if(mdata->classname() == EEDB::Symbol::class_name) { ((Symbol*)mdata)->store(db); }
      else { mdata->store(db); }
    }
  }
}
*/



