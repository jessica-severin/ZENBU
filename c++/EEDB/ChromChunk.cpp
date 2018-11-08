/* $Id: ChromChunk.cpp,v 1.45 2015/10/15 03:42:24 severin Exp $ */

/******

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
#include <EEDB/ChromChunk.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::ChromChunk::class_name = "ChromChunk";

void _eedb_chromchunk_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::ChromChunk*)obj;
}
void _eedb_chromchunk_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::ChromChunk*)obj)->_xml(xml_buffer);
}
void _eedb_chromchunk_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::ChromChunk*)obj)->_xml(xml_buffer);
}

EEDB::ChromChunk::ChromChunk() {
  init();
}

EEDB::ChromChunk::~ChromChunk() {
}

void EEDB::ChromChunk::init() {
  MQDB::MappedQuery::init();

  _classname                 = EEDB::ChromChunk::class_name;
  _funcptr_delete            = _eedb_chromchunk_delete_func;
  _funcptr_xml               = _eedb_chromchunk_xml_func;
  _funcptr_simple_xml        = _eedb_chromchunk_simple_xml_func;

  _chrom        = NULL;
  _chrom_id     = -1;
  _chrom_start  = -1;
  _chrom_end    = -1;
}

////////////////////////////////////////////////////
//
// display/xml section 
//
////////////////////////////////////////////////////

void EEDB::ChromChunk::display_info() {
  printf("%s\n", display_desc().c_str());
}


string EEDB::ChromChunk::display_desc() {
  string  str;
  char buffer[2048];
  snprintf(buffer, 2040, "ChromChunk(db %s ) %s %s : %ld - %ld", 
           db_id().c_str(),
           assembly_name().c_str(),
           chrom_name().c_str(),
           _chrom_start, _chrom_end);

  str = buffer;
  return str;
}


void EEDB::ChromChunk::_xml(string &xml_buffer) {
  char    buffer[2048];
  snprintf(buffer, 2040, "<chrom_chunk id=\"%s\" asm=\"%s\" chr=\"%s\" start=\"%ld\" end=\"%ld\">",
                     db_id().c_str(),
                     assembly_name().c_str(),
                     chrom_name().c_str(),
                     _chrom_start, _chrom_end);
  xml_buffer.append(buffer);
  
  if(!_sequence.empty()) {
    xml_buffer.append("<sequence>");
    xml_buffer.append(html_escape(_sequence));
    xml_buffer.append("</sequence>");
  }

  xml_buffer.append("</chrom_chunk>");
}



EEDB::ChromChunk::ChromChunk(void *xml_node) {
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
  
  if((attr = root_node->first_attribute("asm")))    { _assembly_name = attr->value(); }
  if((attr = root_node->first_attribute("chr")))    { _chrom_name = attr->value(); }
  if((attr = root_node->first_attribute("start")))  { _chrom_start = strtol(attr->value(), NULL, 10); }
  if((attr = root_node->first_attribute("end")))    { _chrom_end = strtol(attr->value(), NULL, 10); }
  
  //sequence
  rapidxml::xml_node<> *seq_node = root_node->first_node("sequence");
  if(seq_node && seq_node->value()) {
    _sequence = seq_node->value();
  }
}


/*
sub dump_to_fasta_file {
  my $self = shift;
  my $fastafile = shift;
  
  my $bioseq = $self->sequence;
  unless(defined($fastafile)) {
    $fastafile = $bioseq->id . ".fa";
  }

  //printf("  writing chunk %s\n", $self->display_id);
  open(OUTSEQ, ">$fastafile")
    or $self->die("Error opening $fastafile for write");
  my $output_seq = Bio::SeqIO->new( -fh =>\*OUTSEQ, -format => 'fasta');
  $output_seq->write_seq($bioseq);
  close OUTSEQ;

  return $self;
}
*/

////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

EEDB::Chrom*   EEDB::ChromChunk::chrom() { return _chrom; }
long int       EEDB::ChromChunk::chrom_start() { return _chrom_start; }
long int       EEDB::ChromChunk::chrom_end() { return _chrom_end; }
string         EEDB::ChromChunk::sequence() { return _sequence; }

string         EEDB::ChromChunk::assembly_name() {
  if(_chrom == NULL) { return _assembly_name; }
  return _chrom->assembly_name();
}
string         EEDB::ChromChunk::chrom_name() {
  if(_chrom != NULL) { return _chrom->chrom_name(); }
  return _chrom_name;
}

//set attributea
void  EEDB::ChromChunk::chrom(EEDB::Chrom* value) {
  _chrom = value;
}

void  EEDB::ChromChunk::chrom_start(long int value) {
  _chrom_start = value;
}

void  EEDB::ChromChunk::chrom_end(long int value) {
  _chrom_end = value;
}

void  EEDB::ChromChunk::sequence(const char* value) {
  if(value==NULL) { _sequence.clear(); }
  else { _sequence = value; }
}




////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////

/*
sub chrom {
  my ($self, $chrom) = @_;
  if($chrom) {
    unless(defined($chrom) && $chrom->isa('EEDB::ChromChunk')) {
      die('chrom param must be a EEDB::ChromChunk');
    }
    $self->{'chrom'} = $chrom;
  }
  
  //lazy load from database if possible
  if(!defined($self->{'chrom'}) and 
     defined($self->database) and 
     defined($self->{'chrom_id'}))
  {
    //printf("LAZY LOAD chrom_id=%d\n", $self->{'_chrom_id'});
    my $chrom = EEDB::ChromChunk->fetch_by_id($self->database, $self->{'chrom_id'});
    if(defined($chrom)) { $self->{'chrom'} = $chrom; }
  }
  return $self->{'chrom'};
}
*/


/*
sub assembly_name {
  my $self = shift;
  return $self->{'assembly_name'} = shift if(@_);
  $self->{'assembly_name'}='' unless(defined($self->{'assembly_name'}));
  if($self->chrom) { 
    return $self->chrom->assembly->ucsc_name;
  } else { 
    return $self->{'assembly_name'};
  }
}
*/

/*
sub chrom_name {
  my $self = shift;
  return $self->{'chrom_name'} = shift if(@_);
  $self->{'chrom_name'}='' unless(defined($self->{'chrom_name'}));
  if($self->chrom) { 
    return $self->chrom->chrom_name;
  } else { 
    return $self->{'chrom_name'}; 
  }
}
*/

/*
sub chrom_id {
  my $self = shift;
  return $self->{'chrom_id'} = shift if(@_);
  $self->{'chrom_id'}='' unless(defined($self->{'chrom_id'}));
  if($self->chrom) { 
    return $self->chrom->id;
  } else { 
    return $self->{'chrom_id'};
  }
}
*/

/*
sub chrom_start {
  my $self = shift;
  return $self->{'chrom_start'} = shift if(@_);
  $self->{'chrom_start'}=0 unless(defined($self->{'chrom_start'}));
  return $self->{'chrom_start'};
}
*/

/*
sub chrom_end {
  my $self = shift;
  return $self->{'chrom_end'} = shift if(@_);
  $self->{'chrom_end'}=0 unless(defined($self->{'chrom_end'}));
  return $self->{'chrom_end'};
}
*/

/*
sub seq_length {
  my $self = shift;
  return $self->chrom_end - $self->chrom_start + 1;
}
*/

/*
sub chunk_name {
  my $self = shift;
  return sprintf("chunk%d-%s_%s:%d..%d", $self->id, $self->assembly_name, $self->chrom_name, $self->chrom_start, $self->chrom_end);
}
*/



/**** get_subsequence
  Description  : uses ChromChunk objects and the sequence in the database to 
                 return the actual sequence in this region. Since the
                 ChromChunk is assigned to a specific Assembly one only needs to specify
                 the start/end and an optional strand to fetch the sequence.
  Parameter[1] : chrom_start 
                 the chromosome start of the region to fetch
  Parameter[2] : chrom_end  
                 the chromosome end of the region to fetch
***/

string EEDB::ChromChunk::get_subsequence(long int start, long int end) {
  string sequence;

  if(start < _chrom_start) { start = _chrom_start; }
  if(end   > _chrom_end)   { end   = _chrom_end; }
  long int offset = start - _chrom_start;
  long int length = end - start + 1;

  if(!_sequence.empty()) {
    return _sequence.substr(offset, length);
  }
  
  if(!_database) { return sequence; }
  offset += 1; //SQL substr() starts with 1
  dynadata value = _database->fetch_col_value(
        "SELECT substr(sequence, ?, ?) FROM chrom_chunk_seq WHERE chrom_chunk_id=?", "ddd", 
        offset, length, _primary_db_id);
  if(value.type != MQDB::STRING) { return sequence; }

  return value.i_string;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


////////// DBObject instance override methods //////////


void  EEDB::ChromChunk::init_from_row_map(map<string, dynadata> &row_map) {
  if(row_map["chrom_id"].type != INT) { return; }

  _primary_db_id   = row_map["chrom_chunk_id"].i_int;
  _chrom_start     = row_map["chrom_start"].i_int;
  _chrom_end       = row_map["chrom_end"].i_int;

  if(row_map["chrom_id"].type == INT) {
    _chrom_id        = row_map["chrom_id"].i_int;
  } else {
    _assembly_name   = row_map["ucsc_name"].i_string;
    _chrom_name      = row_map["chrom_name"].i_string;
  }
}


//////////////////////////////////////////////////////////

/*

sub EEDB::ChromChunk::create_chunks {
  my $self = shift;
  my $chunk_size = shift;
  my $chunk_overlap = shift;

  if($self->chrom_length < 1) { return; }
  
  unless(defined($chunk_size))    { $chunk_size = 505000; } //ie 505 kbase
  unless(defined($chunk_overlap)) { $chunk_overlap = 5000; } //ie 5 kbase

  my $start = 1; //chromosomes are referenced starting at '1'
  my $chrom_length = $self->chrom_length;

  while($start < $chrom_length) {
    my $end = $start + $chunk_size - 1;
    if($end > $chrom_length) { $end = $chrom_length; }
    //printf("%s :: %d .. %d\n", $self->chrom_name, $chrom_start, $end);
    
    my $chunk = EEDB::ChromChunk->new(
                     'chrom' => $self,
                     'chrom_start'=>$start, 
                     'chrom_end'=>$end,
                     'db'=>$self->database);
    //$chunk->display_info;

    if($end >= $chrom_length) { last; }
    $start = $end - $chunk_overlap + 1;
  }  
}
*/

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

/*
sub store {
  my $self = shift;
  my $db   = shift;
  
  if($db) { $self->database($db); }

  if(!defined($self->chrom_id)) {
    $self->_fetch_chrom_id_for_store();
  }
  return undef unless($self->chrom_id);
    
  my $sql = "INSERT ignore INTO chrom_chunk (chrom_id,chrom_start,chrom_end,chunk_len) VALUES(?,?,?,?)";
  $self->database->execute_sql($sql, $self->chrom_id, $self->chrom_start, $self->chrom_end, $self->seq_length);

  $sql = "select chrom_chunk_id from chrom_chunk where chrom_id=? and chrom_start=? and chrom_end=?";
  my $dbID = $self->fetch_col_value($self->database, $sql, $self->chrom_id, $self->chrom_start, $self->chrom_end);
  $self->primary_id($dbID);
  
  //now store the sequence
  $self->store_seq();
}
*/

/*
sub check_exists_db {
  my $self = shift;
  my $db   = shift;
  
  return undef unless($db);
  my $sql = "select chrom_chunk_id from chrom_chunk where chrom_id=? and chrom_start=? and chrom_end=?";
  my $dbID = $db->fetch_col_value($sql, $self->chrom_id, $self->chrom_start, $self->chrom_end);
  if($dbID) {
    $self->primary_id($dbID);
    $self->database($db);
    return $self;
  } else {
    return undef;
  }
}
*/

/*
sub store_seq {
  my $self = shift;
  
  return unless(defined($self->{'_sequence'}));

  my $dbh = $self->database->get_connection;  
  my $sql = "INSERT ignore INTO chrom_chunk_seq (chrom_chunk_id, sequence) VALUES(?,?)";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->primary_id, $self->sequence->seq);
  $sth->finish;
}
*/


/*
sub _fetch_sequence {
  my $self = shift;

  my $sql = "SELECT sequence FROM chrom_chunk_seq WHERE chrom_chunk_id=?";
  my $seq = $self->fetch_col_value($self->database, $sql, $self->primary_id);
  return unless(defined($seq));
  my $name = sprintf("chunk%d-%s-%s-%d", $self->id, $self->assembly_name, $self->chrom_name, $self->chrom_start);
  my $bioseq = Bio::Seq->new(-id=>$name, -seq=>$seq);
  $self->sequence($bioseq); 
}


sub _fetch_chrom_id_for_store {
  my $self = shift;

  my $sql = "SELECT chrom_id FROM chrom join assembly using(assembly_id) WHERE chrom_name=? and (ncbi_version=? or ucsc_name=?)";
  my $chrom_id = $self->fetch_col_value($self->database, $sql, $self->chrom_name, $self->assembly_name, $self->assembly_name);
  $self->chrom_id($chrom_id);
}
*/


