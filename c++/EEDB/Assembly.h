/* $Id: Assembly.h,v 1.29 2018/08/13 03:43:29 severin Exp $ */

/****
NAME - EEDB::Assembly

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

**************/


#ifndef _EEDB_ASSEMBLY_H
#define _EEDB_ASSEMBLY_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <MQDB/DBCache.h>
#include <EEDB/DataSource.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
class Chrom;

class Taxon : public EEDB::DataSource {
  public:  //global class level
    static const char*  class_name;
    
  public:
    Taxon();               // constructor
    ~Taxon();              // destructor
    void init();           // initialization method
    
    //set attribute
    void    taxon_id(int id);
    //get atribute
    int     taxon_id() { return _taxon_id; }
    string  genus();
    string  species();
    string  common_name();
    string  classification();

    //NCBI taxonomy webservice fetch info
    bool              fetch_NCBI_taxonomy_info();  //loads taxonomy information into existing assembly
  
  protected:
    int              _taxon_id;
    string           _genus;
    string           _species;
    string           _classification;
    string           _common_name;
  
  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
  private:
  static map<long, EEDB::Taxon*>   global_ncbi_taxonid_cache;

};

  
class Assembly : public EEDB::Taxon {
  public:  //global class level
    static const char*  class_name;

  public:
    Assembly();               // constructor
    Assembly(void *xml_node); // constructor using a rapidxml node
   ~Assembly();               // destructor
    void init();              // initialization method
  
    //get atribute
    string  ncbi_version() { return _ncbi_name; }
    string  ncbi_assembly_accession() { return _ncbi_assembly_acc; }
    string  ucsc_name() { return _ucsc_name; }
    time_t  release_date() { return _release_date; }
    string  release_date_string();
    string  assembly_name();
    bool    sequence_loaded() { return _sequence_loaded; }

    //set attribute
    void    assembly_name(string value);
    void    ncbi_version(string value);
    void    ncbi_assembly_accession(string value);
    void    ucsc_name(string value);
    void    release_date(time_t value);
    void    sequence_loaded(bool value);

    EEDB::Chrom*          get_chrom(string chrom_name);
    vector<EEDB::Chrom*>  get_chroms();
    void                  all_chroms(vector<EEDB::Chrom*> &chroms);
    void                  add_chrom(EEDB::Chrom* chrom);

    bool check_exists_db(MQDB::Database *db);
    bool store(MQDB::Database *db);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Assembly* obj = new EEDB::Assembly;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void  init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static Assembly*         fetch_by_id(MQDB::Database *db, long int id);
    static Assembly*         fetch_by_name(MQDB::Database *db, string name);
    static vector<DBObject*> fetch_all(MQDB::Database *db);
  
    static vector<Assembly*> fetch_from_NCBI_by_search(string search_term); //ex: GCF_000001895.5 or rn6 or rat
  
  public:  //global cache system to allow random access from anywhere in the code
    static EEDB::Assembly*  cache_get_assembly(string name);
    static void             add_to_assembly_cache(EEDB::Assembly* assembly);
    static void             clear_assembly_cache();

  protected:
    string           _ncbi_name;
    string           _ncbi_assembly_acc;
    string           _ucsc_name;
    string           _assembly_name;
    time_t           _release_date;
    bool             _sequence_loaded;

    map<string, EEDB::Chrom*>  _chroms_map;
    EEDB::Chrom               *_last_chrom;
  
    static map<string, EEDB::Assembly*>  _global_assembly_cache;
    static void                          _named_add_to_assembly_cache(string name, EEDB::Assembly* assembly);


  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml_start(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml(string &xml_buffer);
    void   _mdata_xml(string &xml_buffer, map<string,bool> tags);
    void   _load_metadata();
    string _display_desc();
};

};   //namespace

#endif 
