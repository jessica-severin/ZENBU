/* $Id: Chrom.h,v 1.36 2018/08/13 03:38:49 severin Exp $ */

/***

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

***/


#ifndef _EEDB_CHROM_H
#define _EEDB_CHROM_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Assembly.h>
#include <EEDB/ZDX/ZDXstream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Chrom : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Chrom();               // constructor
    Chrom(void *xml_node); // constructor using a rapidxml node
   ~Chrom();               // destructor
    void init();           // initialization method

    bool operator==(EEDB::Chrom& b);
    bool operator!=(EEDB::Chrom& b);
    bool operator<(EEDB::Chrom& b);

    //get atribute
    string       chrom_name() { return _chrom_name; } //usually ucsc name
    string       ncbi_chrom_name() { return _ncbi_chrom_name; }
    string       chrom_name_alt1() { return _chrom_name_alt1; }
    string       ncbi_accession() { return _ncbi_accession; }  //GenBank accession
    string       refseq_accession() { return _refseq_accession; }
    string       chrom_type() { return _chrom_type; }
    string       description() { return _description; }
    long int     chrom_length() { return _chrom_length; }
    Assembly*    assembly();
    string       assembly_name();
    long int     assembly_id();
    string       fullname();

    string       get_subsequence(long int chrom_start, long int chrom_end, string strand);

    //set attribute
    void         assembly_name(string value);
    void         chrom_name(string value);
    void         chrom_name_alt1(string value);
    void         ncbi_chrom_name(string value);
    void         ncbi_accession(string value);
    void         refseq_accession(string value);
    void         chrom_type(string value);
    void         description(string value);
    void         chrom_length(long int value);
    void         assembly(Assembly* value);
  
    bool         check_exists_db(MQDB::Database *db);
    bool         store(MQDB::Database *db);
    void         update();

    void         zdxstream(EEDB::ZDX::ZDXstream* zstream); //used for Chrom/ChromChunk loaded into ZDX files

    /*** TODO ***
    bool equals { my $self = shift;
    Chrom* get_from_cache_by_id { my $class = shift; my $dbid = shift;
    Chrom* get_from_cache_by_name { my $class = shift; my $assembly_name = shift; my $chrom_name = shift;
    Sequence get_subsequence { my $self   = shift; my $start  = shift; my $end    = shift; my $strand = shift; //optional
    void update { my $self = shift; 
    void create_chunks { my $self = shift; my $chunk_size = shift; my $chunk_overlap = shift;
    */

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject*  create(map<string, dynadata> &row_map, Database* db);
    void              init_from_row_map(map<string, dynadata> &row_map);


    //
    // static member functions for object retrieval from database
    //
    static Chrom*             fetch_by_id(MQDB::Database *db, long int id);
    static Chrom*             fetch_by_assembly_chrom_name_acc(Assembly *assembly, string name_acc);
    static vector<DBObject*>  fetch_all(MQDB::Database *db);
    static vector<DBObject*>  fetch_all_by_assembly(Assembly *assembly);
  

  protected:
    Assembly*   _assembly;
    long int    _assembly_id;
    long int    _chrom_length;
    string      _fullname;
    string      _assembly_name;
    string      _chrom_name;
    string      _chrom_name_alt1;
    string      _ncbi_chrom_name;
    string      _ncbi_accession;
    string      _refseq_accession;
    string      _chrom_type;
    string      _description;
    string      _xml_cache;
  
    EEDB::ZDX::ZDXstream* _zdxstream;
  
  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    string _display_desc();

};

};   //namespace

bool chrom_length_sort_func(EEDB::Chrom* first, EEDB::Chrom* second);


#endif

