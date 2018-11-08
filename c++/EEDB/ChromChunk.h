/* $Id: ChromChunk.h,v 1.12 2015/10/15 03:42:24 severin Exp $ */

/***

NAME - EEDB::ChromChunk

DESCRIPTION

An object that corresponds to specific segment of a chromosome within an assembly.  
A ChromChunk can be use as framework for indexing (OSCFileDB) or storing/retrieve
genomic sequence.

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


#ifndef _EEDB_CHROMCHUNK_H
#define _EEDB_CHROMCHUNK_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Chrom.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class ChromChunk : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    ChromChunk();               // constructor
    ChromChunk(void *xml_node); // constructor using a rapidxml node
   ~ChromChunk();               // destructor
    void init();                // initialization method

    //get atribute
    string         assembly_name();
    string         chrom_name();
    EEDB::Chrom*   chrom();
    long int       chrom_start();
    long int       chrom_end();
    string         sequence();
    string         get_subsequence(long int chrom_start, long int chrom_end);

    //set attribute
    void         chrom(EEDB::Chrom* value);
    void         chrom_start(long int value);
    void         chrom_end(long int value);
    void         sequence(const char* value);


    void         display_info();
    string       display_desc();

    bool         store(MQDB::Database *db);


    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject*  create(map<string, dynadata> &row_map, Database* db) {
      ChromChunk* obj = new EEDB::ChromChunk;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void init_from_row_map(map<string, dynadata> &row_map);


    static ChromChunk* 
    fetch_by_id(MQDB::Database *db, long int id) {
      ChromChunk* obj = (ChromChunk*) MQDB::DBCache::check_cache(db, id, "ChromChunk");
      if(obj!=NULL) { obj->retain(); return obj; }
      
      const char *sql = "SELECT * FROM chrom_chunk join chrom using(chrom_id) join assembly using(assembly_id) WHERE chrom_chunk_id=?";
      obj = (EEDB::ChromChunk*) MQDB::fetch_single(EEDB::ChromChunk::create, db, sql, "d", id);

      MQDB::DBCache::add_to_cache(obj);
      return obj;
    }

    static vector<DBObject*> 
    fetch_all(MQDB::Database *db) {
      const char *sql = "SELECT * FROM chrom_chunk join chrom using(chrom_id) join assembly using(assembly_id)";
      return MQDB::fetch_multiple(EEDB::ChromChunk::create, db, sql, "");
    }

    /* TODO...
    static vector<DBObject*> 
    fetch_all_for_feature(Feature *feature) {
      vector<DBObject*> result;
      if(feature == NULL) { return result; }
      if(feature->database() == NULL) { return result; }
      Database *db = feature->database();
      const char *sql = "SELECT * FROM feature_2_chunk JOIN chrom_chunk using(chrom_chunk_id) ".
                        "JOIN chrom using(chrom_id) JOIN assembly using(assembly_id) ".
                        "WHERE feature_id=?";
      return MQDB::fetch_multiple(EEDB::ChromChunk::create, db, sql, "d", feature->primary_id());
    }
    */

    static vector<DBObject*> 
    fetch_all_by_assembly_name(Database *db, string assembly_name) {
       const char *sql = "SELECT * FROM chrom_chunk JOIN chrom USING(chrom_id) JOIN assembly USING(assembly_id) \
                          WHERE (ncbi_version=? or ucsc_name=?) ORDER BY chrom_chunk_id";
      return MQDB::fetch_multiple(EEDB::ChromChunk::create, db, sql, 
                         "ss", assembly_name.c_str(), assembly_name.c_str());
    }

    static vector<DBObject*> 
    fetch_all_by_named_region(Database *db, string assembly_name, string chrom_name, long int start, long int end) {
      char buffer[2048];
      string sql = "SELECT * FROM chrom_chunk JOIN chrom USING(chrom_id) JOIN assembly USING(assembly_id) \
                    WHERE (ncbi_version=? or ucsc_name=?) AND chrom_name = ?";
      if(start>0) { snprintf(buffer, 2040, " AND chrom_end >= %ld", start); sql += buffer; }
      if(end>0)   { snprintf(buffer, 2040, " AND chrom_start <= %ld", end); sql += buffer; }
      sql += " ORDER BY chrom_start";
      return MQDB::fetch_multiple(EEDB::ChromChunk::create, db, sql.c_str(), "sss", 
                 assembly_name.c_str(), assembly_name.c_str(), chrom_name.c_str());
    }

    static ChromChunk*  
    fetch_first_for_region_start(Database *db, string assembly_name, string chrom_name, long int start) {
      char buffer[2048];
      string sql = "SELECT * FROM chrom_chunk JOIN chrom USING(chrom_id) JOIN assembly USING(assembly_id) \
                    WHERE (ncbi_version=? or ucsc_name=?) AND chrom_name = ?";
      if(start>0) { snprintf(buffer, 2040, " AND chrom_end >= %ld", start); sql += buffer; }
      sql += " ORDER BY chrom_start LIMIT 1";
      return (EEDB::ChromChunk*)MQDB::fetch_single(EEDB::ChromChunk::create, db, sql.c_str(), "sss", 
                 assembly_name.c_str(), assembly_name.c_str(), chrom_name.c_str());
    }
    

  //***************************************************
  // internal
  //***************************************************

  //protected attribute variables
  protected:  
    EEDB::Chrom      *_chrom;
    long int          _chrom_id;
    long int          _chrom_start;
    long int          _chrom_end;
    string            _sequence;
    string            _assembly_name;  //alternate if no _chrom
    string            _chrom_name;     //alternate if no _chrom

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);

};

};   //namespace


#endif

