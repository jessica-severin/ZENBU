/* $Id: Chrom.cpp,v 1.82 2018/08/13 03:38:17 severin Exp $ */

/******

NAME - EEDB::Chrom

SYNOPSIS

An object to encapsulate a Chromosome within an Assembly.

DESCRIPTION

An object that corresponds to specific chromosomes within an assembly.  Because Chrom is tied to a specific
assembly, an instance of a Chrom identifies not only the chromosome, but also the assembly and species

As with all objects in EEDB, Chrom interits from MQdb::DBObject and MQdb::MappedQuery.
Please refer to these documents for all superclass methods

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

******/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sqlite3.h>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/Assembly.h>
#include <EEDB/Chrom.h>
#include <EEDB/ChromChunk.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::Chrom::class_name = "Chrom";

void _eedb_chrom_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Chrom*)obj;
}
void _eedb_chrom_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Chrom*)obj)->_xml(xml_buffer);
}
void _eedb_chrom_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Chrom*)obj)->_xml(xml_buffer);
}
string _eedb_chrom_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::Chrom*)obj)->_display_desc();
}

bool chrom_length_sort_func(EEDB::Chrom* first, EEDB::Chrom* second) {
  if(first->chrom_length() < second->chrom_length()) { return true;}
  else { return false; }
}

EEDB::Chrom::Chrom() {
  init();
}

EEDB::Chrom::~Chrom() {
  if(_assembly != NULL) { _assembly->release(); _assembly=NULL; }
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}


void EEDB::Chrom::init() {
  MQDB::MappedQuery::init();

  _classname                 = EEDB::Chrom::class_name;
  _funcptr_delete            = _eedb_chrom_delete_func;
  _funcptr_xml               = _eedb_chrom_xml_func;
  _funcptr_simple_xml        = _eedb_chrom_simple_xml_func;
  _funcptr_display_desc      = _eedb_chrom_display_desc_func;

  _assembly = NULL;
  _assembly_id = -1;
  _chrom_length = -1;
  
  _zdxstream = NULL;
}

bool EEDB::Chrom::operator== (EEDB::Chrom& b) {
  if(assembly_name() != b.assembly_name()){ return false; }
  if(_chrom_name != b._chrom_name) { return false; }
  return true;
}

bool EEDB::Chrom::operator!= (EEDB::Chrom& b) {
  if(assembly_name() != b.assembly_name()){ return true; }
  if(_chrom_name != b._chrom_name) { return true; }
  return false;
}

bool EEDB::Chrom::operator< (EEDB::Chrom& b) {
  if(assembly_name() < b.assembly_name()){ return true; }
  if(assembly_name() > b.assembly_name()){ return false; }
  if(_chrom_name < b._chrom_name) { return true; }
  return false;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

string  EEDB::Chrom::fullname() {
  if(!_fullname.empty()) { return _fullname;}
  _fullname = assembly_name();
  if(!_fullname.empty()) { _fullname += "::"; }
  _fullname += chrom_name();
  return _fullname;
}

string  EEDB::Chrom::assembly_name() {
  if(!_assembly_name.empty()) { return _assembly_name; }
  if(assembly() != NULL) { _assembly_name = _assembly->assembly_name(); }
  return _assembly_name;
}

long int  EEDB::Chrom::assembly_id() {
  if(_assembly != NULL) { return _assembly->primary_id(); }
  return -1;
}

EEDB::Assembly* EEDB::Chrom::assembly() {
  if((_assembly==NULL) and (_database!=NULL) and (_assembly_id != -1)) { //lazy load from database
    _assembly = EEDB::Assembly::fetch_by_id(_database, _assembly_id);
    _assembly_name = _assembly->assembly_name();
  }
  return _assembly;
}

//set methods

void  EEDB::Chrom::assembly_name(string value) {
  _assembly_name = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::chrom_name(string value) {
  _chrom_name = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::ncbi_chrom_name(string value) {
  _ncbi_chrom_name = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::chrom_name_alt1(string value) {
  _chrom_name_alt1 = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::ncbi_accession(string value) {
  _ncbi_accession = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::refseq_accession(string value) {
  _refseq_accession = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::chrom_type(string value) {
  _chrom_type = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::description(string value) {
  _description = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::assembly(EEDB::Assembly* obj) {
  if(_assembly) { _assembly->release(); }
  _assembly = obj;
  _assembly_id = obj->primary_id();
  _assembly_name = _assembly->assembly_name();
  if(_assembly) { _assembly->retain(); }
  _xml_cache.clear();
}

void  EEDB::Chrom::chrom_length(long int value) {
  _chrom_length = value;
  _xml_cache.clear();
}

void  EEDB::Chrom::zdxstream(EEDB::ZDX::ZDXstream* zstream) {
  //used for Chrom/ChromChunk loaded into ZDX files
  _zdxstream = zstream;
}

string EEDB::Chrom::_display_desc() {
  string  str;
  char buffer[2048];
  snprintf(buffer, 2040, "Chrom(db %ld ) ", _primary_db_id);
  str = buffer;
  if(assembly()) { str += assembly()->ucsc_name() + " "; }
  str += chrom_type() +" "+ chrom_name();

  snprintf(buffer, 2040, " : len %ld :: ", chrom_length());
  str += buffer;

  str += description();
  return str;
}


void EEDB::Chrom::_xml(string &xml_buffer) {
  char    buffer[2048];

  if(_xml_cache.empty()) {
    _xml_cache.append("<chrom chr=\"");
    _xml_cache.append(_chrom_name);
    _xml_cache.append("\"");

    if(!_ncbi_accession.empty()) {
      _xml_cache.append(" ncbi_chrom_acc=\"");
      _xml_cache.append(html_escape(_ncbi_accession));
      _xml_cache.append("\"");
    }

    if(!_ncbi_chrom_name.empty()) {
      _xml_cache.append(" ncbi_chrom_name=\"");
      _xml_cache.append(html_escape(_ncbi_chrom_name));
      _xml_cache.append("\"");
    }

    if(!_chrom_name_alt1.empty()) {
      _xml_cache.append(" chrom_name_alt1=\"");
      _xml_cache.append(html_escape(_chrom_name_alt1));
      _xml_cache.append("\"");
    }

    if(!_refseq_accession.empty()) {
      _xml_cache.append(" refseq_chrom_acc=\"");
      _xml_cache.append(html_escape(_refseq_accession));
      _xml_cache.append("\"");
    }

    _xml_cache.append(" asm=\"");
    _xml_cache.append(assembly_name());
    _xml_cache.append("\""); 

    if(assembly()) {
      if(!_assembly->ucsc_name().empty()) { 
        _xml_cache.append(" ucsc_asm=\""); 
        _xml_cache.append(_assembly->ucsc_name()); 
        _xml_cache.append("\""); 
      }

      if(!_assembly->ncbi_version().empty()) { 
        _xml_cache.append(" ncbi_asm=\""); 
        _xml_cache.append(_assembly->ncbi_version()); 
        _xml_cache.append("\""); 
      }

      if(_assembly->taxon_id() != -1) { 
        snprintf(buffer, 2040, " taxon_id=\"%d\" ", _assembly->taxon_id()); 
        _xml_cache.append(buffer); 
      }
    }

    if(_chrom_length>0) {
      snprintf(buffer, 2040, " length=\"%ld\" ", _chrom_length);
      _xml_cache.append(buffer);
    }
    
    if(_primary_db_id != -1) {
      _xml_cache.append(" id=\"");
      _xml_cache.append(db_id());
      _xml_cache.append("\"");
    }
    
    if(!_description.empty()) {
      _xml_cache.append(" description=\"");
      _xml_cache.append(html_escape(_description));
      _xml_cache.append("\"");
    }

    _xml_cache.append(" />");
  }
  xml_buffer.append(_xml_cache);
}


EEDB::Chrom::Chrom(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if((attr = root_node->first_attribute("id"))) {
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(attr->value(), uuid, objID, objClass);
    _primary_db_id = objID;
    _db_id = attr->value(); //store federatedID, if peer is set later, it will be recalculated
  }
  
  if((attr = root_node->first_attribute("chr")))         { _chrom_name = attr->value(); }
  if((attr = root_node->first_attribute("length")))      { _chrom_length = strtol(attr->value(), NULL, 10); }
  if((attr = root_node->first_attribute("asm")))         { _assembly_name = attr->value(); }
  if((attr = root_node->first_attribute("description"))) { _description = attr->value(); }
  if((attr = root_node->first_attribute("ncbi_chrom_acc")))   { _ncbi_accession = attr->value(); }
  if((attr = root_node->first_attribute("refseq_chrom_acc"))) { _refseq_accession = attr->value(); }
  if((attr = root_node->first_attribute("ncbi_chrom_name")))  { _ncbi_chrom_name = attr->value(); }
  if((attr = root_node->first_attribute("chrom_name_alt1")))  { _chrom_name_alt1 = attr->value(); }
}



///////////////////////////////////////////////////////////////////////////////////////////////////////

/**** get_subsequence
  Description  : uses ChromChunk objects and the sequence in the database to 
                 return the actual sequence in this region. Since the
                 Chrom is assigned to a specific Assembly one only needs to specify
                 the start/end and an optional strand to fetch the sequence.
  Parameter[1] : chrom_start 
                 the chromosome start of the region to fetch
  Parameter[2] : chrom_end  
                 the chromosome end of the region to fetch
  Parameter[3] : strand <optional> as "-" or "+"
                 the strand of the sequence. if "-" then it will return the sequence 
                 on the reverse strand by reverse complementing the sequence
  Returntype   : Bio::Seq instance or undef if a data error happens
  Errors       : if the region is not valid or if data is not present it will return undef
  Exceptions   : none
***/

string  EEDB::Chrom::get_subsequence(long int chrom_start, long int chrom_end, string strand) {
  //must provide valid coordinates
  string sequence;
  //fprintf(stderr, "get_subsequence %s %ld %ld %s\n", xml().c_str(), chrom_start, chrom_end, strand.c_str());
  
  if(assembly() == NULL) { return ""; }
  if(!(assembly()->sequence_loaded())) { return ""; }
  
  if(chrom_start < 0) { chrom_start=1; }                 //default to start of chromosome
  if(chrom_end < 0)   { chrom_end = _chrom_length -1; }  //default to end of chromosome
  if(chrom_start > chrom_end) { 
    long int t1 = chrom_start;
    chrom_start = chrom_end;
    chrom_end = t1;;
  }
  string asm_name =  assembly()->assembly_name();

  //fetch_all_named_region returns chunks in sorted order by chrom_start
  vector<DBObject*> chunks;
  if(_zdxstream!=NULL) {
    _zdxstream->stream_by_named_region(asm_name, _chrom_name, chrom_start, chrom_end);
    while(MQDB::DBObject *obj = _zdxstream->next_in_stream()) {
      if(obj->classname() == EEDB::ChromChunk::class_name) {
        chunks.push_back(obj);
      } else {
        obj->release();
      }
    }
  }
  else if(_database!=NULL) {
    chunks = EEDB::ChromChunk::fetch_all_by_named_region(_database, asm_name, _chrom_name, chrom_start, chrom_end);
  }
  if(chunks.empty()) { return ""; }
  
  //first see if region fits entirely inside one chunk
  //coord compare is much faster than string concats
  for(unsigned int i=0; i<chunks.size(); i++) {
    EEDB::ChromChunk *chunk = (EEDB::ChromChunk*)chunks[i];
    if((chrom_start >= chunk->chrom_start()) and (chrom_end <= chunk->chrom_end())) {
      sequence = chunk->get_subsequence(chrom_start, chrom_end);
      if(strand == "-") {
        //do rev-complement here
        std::reverse(sequence.begin(),sequence.end());
        string::iterator it1;
        string rosette1 ="acgtrymkswhbvdnxACGTRYMKSWHBVDNX";
        string rosette2 ="tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX";
        for(it1=sequence.begin(); it1!=sequence.end(); it1++) {
          size_t found = rosette1.find(*it1);
          if (found!=std::string::npos) {
            *it1 = rosette2[found];
          }
        }
      }
      return sequence;
    }
  }
  
  //// more than one chunk required to cover entire region so concat
  //// keep track of how much has already been concatonated by $ts and loop
  //// then do reverse complement at end
  long int ts = chrom_start; //keep running track of position
  
  for(unsigned int i=0; i<chunks.size(); i++) {
    EEDB::ChromChunk *chunk = (EEDB::ChromChunk*)chunks[i];
    long int te = chunk->chrom_end();
    if(chrom_end < te) { te = chrom_end; }  //end is in middle of this chunk
    sequence += chunk->get_subsequence(ts, te);
    ts = te+1;
    if(ts > chrom_end) { break; } //we are done
  }
  if(strand == "-") {
    //do rev-complement here
  }

  return sequence;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

//
// static member functions for object retrieval from database
//

EEDB::Chrom*  EEDB::Chrom::fetch_by_id(MQDB::Database *db, long int id) {
  Chrom* obj = (Chrom*) MQDB::DBCache::check_cache(db, id, "Chrom");
  if(obj!=NULL) { obj->retain(); return obj; }
  
  const char *sql = "SELECT * FROM chrom WHERE chrom_id=?";
  obj = (EEDB::Chrom*) MQDB::fetch_single(EEDB::Chrom::create, db, sql, "d", id);
  
  MQDB::DBCache::add_to_cache(obj);
  return obj;
}

EEDB::Chrom*   EEDB::Chrom::fetch_by_assembly_chrom_name_acc(Assembly *assembly, string name_acc) {
  if(assembly == NULL) { return NULL; }
  if(assembly->database() == NULL) { return NULL; }
  Database *db = assembly->database();
  
  const char *sql = "SELECT * FROM chrom WHERE assembly_id=? AND (chrom_name=? or ncbi_chrom_acc=? or refseq_chrom_acc=?)";
  EEDB::Chrom *chrom = (EEDB::Chrom*) MQDB::fetch_single(EEDB::Chrom::create, db, sql, "dsss", assembly->primary_id(),
                                                         name_acc.c_str(), name_acc.c_str(), name_acc.c_str());
  return chrom;
}

vector<DBObject*>  EEDB::Chrom::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM chrom ORDER BY chrom_length";
  return MQDB::fetch_multiple(EEDB::Chrom::create, db, sql, "");
}


vector<DBObject*>  EEDB::Chrom::fetch_all_by_assembly(Assembly *assembly) {
  vector<DBObject*> result;
  if(assembly == NULL) { return result; }
  if(assembly->database() == NULL) { return result; }
  Database *db = assembly->database();
  const char *sql = "SELECT * FROM chrom WHERE assembly_id=? ORDER BY chrom_length";
  vector<DBObject*> chroms = MQDB::fetch_multiple(EEDB::Chrom::create, db, sql, "d", assembly->primary_id());
  for(unsigned int i=0; i<chroms.size(); i++) { ((EEDB::Chrom*)(chroms[i]))->assembly(assembly); }
  return chroms;
}


bool EEDB::Chrom::check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  dynadata value = db->fetch_col_value("SELECT chrom_id FROM chrom WHERE chrom_name=? AND assembly_id=?",
                                       "sd",  _chrom_name.c_str(), assembly_id());
  if(value.type != MQDB::INT) { return false; }
  
  _primary_db_id = value.i_int;
  database(db);
  return true;
}


bool EEDB::Chrom::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(check_exists_db(db)) { return true; }
  
  db->do_sql("INSERT ignore INTO chrom (chrom_name, chrom_type, description, ncbi_chrom_acc, ncbi_chrom_name, chrom_name_alt1, refseq_chrom_acc, assembly_id, chrom_length) \
             VALUES(?,?,?,?,?,?,?,?,?)", "sssssssdd",
             _chrom_name.c_str(), _chrom_type.c_str(), _description.c_str(), _ncbi_accession.c_str(),
             _ncbi_chrom_name.c_str(), _chrom_name_alt1.c_str(), _refseq_accession.c_str(), assembly_id(), _chrom_length);
             
  return check_exists_db(db);  //checks the database and sets the id
}


void EEDB::Chrom::update() {
  if((_database==NULL) || (_primary_db_id == -1)) { return; }

  const char *sql = "UPDATE chrom SET chrom_type=?, description=?, ncbi_chrom_acc=?, ncbi_chrom_name=?, chrom_name_alt1=?, refseq_chrom_acc=?, chrom_length=? WHERE chrom_id=?";

  _database->do_sql(sql, "ssssssdd", _chrom_type.c_str(), _description.c_str(), _ncbi_accession.c_str(), _ncbi_chrom_name.c_str(),
                    _chrom_name_alt1.c_str(), _refseq_accession.c_str(), _chrom_length, _primary_db_id);
}


////////// DBObject instance override methods //////////

DBObject* EEDB::Chrom::create(map<string, dynadata> &row_map, Database* db) {
  Chrom* obj = new EEDB::Chrom;
  obj->database(db);
  obj->init_from_row_map(row_map);
  return obj;
}

//init_from_row_map is an internal method used by the MappedQuery template machinery
void  EEDB::Chrom::init_from_row_map(map<string, dynadata> &row_map) {
  if(row_map["chrom_id"].type != INT) { return ; }

  _primary_db_id   = row_map["chrom_id"].i_int;
  _chrom_length    = row_map["chrom_length"].i_int;
  _chrom_name      = row_map["chrom_name"].i_string;
  _chrom_type      = row_map["chrom_type"].i_string;
  _description     = row_map["description"].i_string;
  if(row_map["ncbi_chrom_name"].type == MQDB::STRING) {
    _ncbi_accession = row_map["ncbi_chrom_name"].i_string;
  }
  if(row_map["ncbi_chrom_acc"].type == MQDB::STRING) {
    _ncbi_accession = row_map["ncbi_chrom_acc"].i_string;
  }
  if(row_map["refseq_chrom_acc"].type == MQDB::STRING) {
    _ncbi_accession = row_map["refseq_chrom_acc"].i_string;
  }

  _assembly_id     = row_map["assembly_id"].i_int;
}


//////////////////////////////////////////////////////////

/*
sub EEDB::Chrom::create_chunks {
  my $self = shift;
  my $chunk_size = shift;
  my $chunk_overlap = shift;

  if($self->chrom_length < 1) { return; }
  
  unless(defined($chunk_size))    { $chunk_size = 505000; } //ie 505 kbase
  unless(defined($chunk_overlap)) { $chunk_overlap = 5000; } //ie 5 kbase

  my chrom_start = 1; //chromosomes are referenced starting at '1'
  my $chrom_length = $self->chrom_length;

  while(chrom_start < $chrom_length) {
    my chrom_end = chrom_start + $chunk_size - 1;
    if(chrom_end > $chrom_length) { chrom_end = $chrom_length; }
    //printf("%s :: %d .. %d\n", $self->chrom_name, $chrom_start, chrom_end);
    
    my $chunk = EEDB::ChromChunk->new(
                     'chrom' => $self,
                     'chrom_start'=>chrom_start, 
                     'chrom_end'=>chrom_end,
                     'db'=>$self->database);
    //$chunk->display_info;

    if(chrom_end >= $chrom_length) { last; }
    chrom_start = chrom_end - $chunk_overlap + 1;
  }  
}
*/



