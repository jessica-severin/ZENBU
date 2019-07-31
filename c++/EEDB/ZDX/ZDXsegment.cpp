/*  $Id: ZDXsegment.cpp,v 1.89 2019/07/31 06:59:15 severin Exp $ */

/*******

NAME - EEDB::ZDX::ZDXsegment

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

******/


#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <iostream>
#include <string>
#include <sys/stat.h>
#include <sys/types.h>
#include <fcntl.h>
#include <sys/time.h>
#include <zlib.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Peer.h>
#include <EEDB/Chrom.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <lz4/lz4.h>

//#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 


using namespace std;
using namespace MQDB;
using namespace ZDX;

const char*  EEDB::ZDX::ZDXsegment::class_name = "EEDB::ZDX::ZDXsegment";

char*  EEDB::ZDX::ZDXsegment::_compress_buffer = NULL;
long   EEDB::ZDX::ZDXsegment::_compress_buflen = 0;

//function prototypes
void _zdx_zdxsegment_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::ZDX::ZDXsegment*)obj;
}
void _zdx_zdxsegment_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::ZDX::ZDXsegment*)obj)->_xml(xml_buffer);
}
string _zdx_zdxsegment_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::ZDX::ZDXsegment*)obj)->_display_desc();
}


////////////////////////////////////////////////////////////////////////////////////////////
//
//


EEDB::ZDX::ZDXsegment::ZDXsegment() {
  init();
}

EEDB::ZDX::ZDXsegment::ZDXsegment(ZDXdb* zdb) {
  init();
  if(zdb) { zdb->retain(); }
  _zdxdb = zdb;
}
  
EEDB::ZDX::ZDXsegment::~ZDXsegment() {
  if(_zdxdb != NULL) { _zdxdb->release(); }
  if(_chrom != NULL) { _chrom->release(); }
  _zdxdb     = NULL;
  _zchrom    = NULL;
  _chrom     = NULL;
  _feature_buffer.reset();
  _output_buffer.clear();
}


void EEDB::ZDX::ZDXsegment::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::ZDX::ZDXsegment::class_name;

  _funcptr_delete            = _zdx_zdxsegment_delete_func;
  _funcptr_display_desc      = _zdx_zdxsegment_display_desc_func;
  _funcptr_xml               = _zdx_zdxsegment_xml_func;
  _funcptr_simple_xml        = _zdx_zdxsegment_xml_func;
  
  //attribute variables
  _database    = NULL;
  _peer_uuid   = NULL;
  _zdxdb       = NULL;
  _zdxstream   = NULL;
    
  bzero(&_zchrom_table, sizeof(EEDB::ZDX::zdx_chrom_table));
  bzero(&_zsegment, sizeof(EEDB::ZDX::zdx_chrom_segment));
  _zchrom         = NULL;
  _chrom          = NULL;
  _segment_offset = -1;
  _last_znode     = -1;
  _next_znode     = -1;
  _region_start   = -1;
  _region_end     = -1;
  _last_outlier_znode = -1;
  _zchrom_offset  = -1;

  _feature_buffer.reset();
  _feature_buffer.unique_features(false);
  _feature_buffer.match_category(false);
  _feature_buffer.match_source(false);
  _feature_buffer.expression_mode(CL_NONE); //CL_SUM caused bugs, would force the score to disappear or change 
  
  _output_buffer.clear();
  
  _streambuffer = NULL;
  
  _build_pid = 0;
  _build_time = 0;
  _build_start = 0;
  _build_end = 0;
}


EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXsegment::new_at_position(ZDXdb* zdxdb, EEDB::Chrom* chrom, long chrom_position) {
  if(!chrom) { return NULL; }
  EEDB::ZDX::ZDXsegment *segment = new EEDB::ZDX::ZDXsegment(zdxdb);
  if(segment->create_chrom(chrom) == -1) {
    segment->release();
    return NULL;
  }
  if(!segment->_init_segment(chrom->assembly_name(), chrom->chrom_name(), chrom_position)) {
    segment->release();
    return NULL;
  }
  return segment;
}


EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXsegment::fetch(ZDXdb* zdxdb, string asm_name, string chrom_name, long chrom_position) {
  EEDB::ZDX::ZDXsegment *segment = new EEDB::ZDX::ZDXsegment(zdxdb);
  if(!segment->_init_segment(asm_name, chrom_name, chrom_position)) {
    segment->release();
    return NULL;
  }
  return segment;
}


//when streaming, this will return the next segment in order after this one
EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXsegment::next_segment() {
  if(!_zchrom) { return NULL;}
  EEDB::ZDX::ZDXsegment *zseg = new EEDB::ZDX::ZDXsegment(_zdxdb);
  if(!zseg->_init_segment(_zchrom_table.assembly_name, _zchrom->name, _zsegment.chrom_start + _zchrom->segment_size)) {
    zseg->release();
    return NULL;
  }
  return zseg;
}

//re-initializes this segment to the contents of the next segment in order after this one
bool EEDB::ZDX::ZDXsegment::init_next_segment() {
  if(_zchrom==NULL) { return false; }
  if(_zchrom->segments_offset == 0) { _zchrom = NULL; return false; }
  
  if(_segment_offset == -1) { _zchrom = NULL; return false; }
  if(_zsegment.chrom_end >= _zchrom->chrom_length) { _zchrom = NULL; return false; }

  if(!_zdxdb) { return false; }  
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }
    
  _segment_offset += sizeof(zdx_chrom_segment);
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading  segment\n");
    _segment_offset = -1;
    _zchrom = NULL;
    return false;
  }
  
  return true;
}



//this will return the previous segment in order before this one
EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXsegment::prev_segment() {
  if(!_zchrom) { return NULL;}
  if(_zsegment.chrom_start <= 1) { return NULL; }
  EEDB::ZDX::ZDXsegment *zseg = new EEDB::ZDX::ZDXsegment(_zdxdb);
  if(!zseg->_init_segment(_zchrom_table.assembly_name, _zchrom->name, _zsegment.chrom_start-1)) {
    zseg->release();
    return NULL;
  }
  return zseg;
}

//when streaming, this will return the next segment in order after this one
EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXsegment::first_segment() {
  if(!_zchrom) { return NULL;}
  EEDB::ZDX::ZDXsegment *zseg = new EEDB::ZDX::ZDXsegment(_zdxdb);
  if(!zseg->_init_segment(_zchrom_table.assembly_name, _zchrom->name, 1)) {
    zseg->release();
    return NULL;
  }
  return zseg;
}

//used for analyzing failed builders and auto-reseting
vector<EEDB::ZDX::ZDXsegment*>  EEDB::ZDX::ZDXsegment::fetch_claimed_segments(ZDXdb* zdxdb) {
  vector<ZDXsegment*> seg_array;
  if(!zdxdb) { return seg_array; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  int zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return seg_array; }
  
  while(1) {
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      break;
    }
    
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        break;
      }
      
      for(long seg=0; seg<num_segs; seg++) {
        if(segments[seg].znode < 0) { 
          EEDB::ZDX::ZDXsegment *zseg = new EEDB::ZDX::ZDXsegment(zdxdb);
          if(zseg->_init_segment(ctable.assembly_name, zchrom->name, segments[seg].chrom_start)) {
            seg_array.push_back(zseg);
          } else {
            zseg->release();
          }
        }
      }
    }
    offset = ctable.next_chrom_table;
  }
  
  zdxdb->disconnect();
  return seg_array;
}


//////////////////////////////////////////////////////////////////////////////////////////////////


string EEDB::ZDX::ZDXsegment::_display_desc() {
  string desc = "ZDXsegment";
  if(_zchrom) {
    desc += " "+assembly_name()+"::"+ chrom_name() +":";
    char buffer[2048];
    snprintf(buffer, 2040, " %ld..%ld", chrom_start(), chrom_end());
    desc += buffer;
  }
  return desc;
}

void  EEDB::ZDX::ZDXsegment::_xml(string &xml_buffer) {
  char buffer[2048];
  xml_buffer += "<zdxsegment";

  if(_zchrom) {
    xml_buffer.append(" asm=\"" + assembly_name() +"\"");
    xml_buffer.append(" chrom=\"" + chrom_name() +"\"");
    snprintf(buffer, 2040, " start=\"%ld\" end=\"%ld\"", chrom_start(), chrom_end());
    xml_buffer.append(buffer);
  }
  
  xml_buffer += " />";
}

ZDXdb*  EEDB::ZDX::ZDXsegment::zdxdb() {
  return _zdxdb;
}

string  EEDB::ZDX::ZDXsegment::assembly_name() {
  if(!_zchrom) { return ""; }
  return _zchrom_table.assembly_name;
}

string  EEDB::ZDX::ZDXsegment::chrom_name() {
  if(!_zchrom) { return ""; }
  return _zchrom->name;
}

long    EEDB::ZDX::ZDXsegment::chrom_start() {
  if(!_zchrom) { return -1;}
  return _zsegment.chrom_start;
}

long    EEDB::ZDX::ZDXsegment::chrom_end() {
  if(!_zchrom) { return -1;}
  return _zsegment.chrom_end;
}

long  EEDB::ZDX::ZDXsegment::segment_size() {
  if(!_zchrom) { return -1;}
  return _zchrom->segment_size;
}

EEDB::Chrom*   EEDB::ZDX::ZDXsegment::chrom() {
  if(_chrom) { return _chrom; }
  if(!_zchrom) { return NULL;}
  _chrom = new EEDB::Chrom();
  _chrom->chrom_name(chrom_name());
  _chrom->assembly_name(assembly_name());
  return _chrom;
}

string  EEDB::ZDX::ZDXsegment::builder_host() {
  _load_builder_stats();
  return _build_host;
}

pid_t  EEDB::ZDX::ZDXsegment::builder_pid() {
  _load_builder_stats();
  return _build_pid;
}

double  EEDB::ZDX::ZDXsegment::build_time_msec() {
  _load_builder_stats();
  return _build_time;
}

double  EEDB::ZDX::ZDXsegment::build_starttime() {
  _load_builder_stats();
  return _build_start;
}
double  EEDB::ZDX::ZDXsegment::build_endtime() {
  _load_builder_stats();
  return _build_end;
}

void  EEDB::ZDX::ZDXsegment::_load_builder_stats() {
  if(_build_pid != 0) { return; }
  
  //load from znode
  if(!_zdxdb) { return; }
  if(!_zchrom) { return; }
  if(_zsegment.znode == 0) { return; }
  
  //get last znode of segment
  zdxnode *znode = NULL;
  int64_t zoff = abs(_zsegment.znode);
  while(zoff != 0) {
    znode = _zdxdb->fetch_znode(zoff);
    if(!znode) { return; }
    zoff = znode->next_znode;
    if(zoff != 0) { free(znode); }
  }
  if(!znode) { return; }
  
  //get uncompress_buffer_len
  uint32_t uncompress_buffer_len;
  memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
  
  if(_compress_buffer == NULL) {
    _compress_buflen = 10240; //10kb;
    _compress_buffer = (char*)malloc(_compress_buflen);
  }
  if(uncompress_buffer_len+1 > _compress_buflen) {
    _compress_buflen = ((uncompress_buffer_len+1)/10240 + 1) * 10240; //multiples of 10kb;
    _compress_buffer = (char*)realloc(_compress_buffer, _compress_buflen);
  }
  bzero(_compress_buffer, _compress_buflen);
  
  // LZ4 uncompress
  int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), _compress_buffer, uncompress_buffer_len);
  free(znode);
  if(sinkint < 0) { return; }  
  
  //then parse XML
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(_compress_buffer);
  root_node = doc.first_node();
  if(!root_node || (root_node->name() != string("zdx"))) { 
    return; 
  }
  
  // get the builder_info
  if((node = root_node->first_node("builder_info")) != NULL) {
    rapidxml::xml_node<> *node2;
    if((node2 = node->first_node("host")) != NULL) {
      _build_host = node2->value();
    }
    if((node2 = node->first_node("pid")) != NULL) {
      _build_pid = strtol(node2->value(), NULL, 10);
    }
    if(_zsegment.znode >100) {
      //finished so buildtime is valid
      if((node2 = node->first_node("build_time_msec")) != NULL) {
        _build_time = strtod(node2->value(), NULL);
      }
      if((node2 = node->first_node("start_time")) != NULL) {
        _build_start = strtod(node2->value(), NULL);
      }
      if((node2 = node->first_node("end_time")) != NULL) {
        _build_end = strtod(node2->value(), NULL);
      }
    }
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// creation and building new ZDXsegment
//
//////////////////////////////////////////////////////////////////////////////////////////////////

int64_t  EEDB::ZDX::ZDXsegment::create_chrom(EEDB::Chrom* chrom) {
  if(!chrom) { return -1; }
  if(!_zdxdb) { return -1; }
  
  string asm_name = chrom->assembly_name();
  string chrom_name = chrom->chrom_name();
  long chrom_length = chrom->chrom_length();
  
  if(chrom_length < 1) {
    fprintf(stderr, "zdxstream error : can not create_chrom [%s] [%s] with size %ld\n", asm_name.c_str(), chrom_name.c_str(), chrom_length);
    return -1;
  }
  
  // check if assembly/chrom exists
  int64_t offset = _zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2

  //reset back to write mode
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return -1; }
    
  EEDB::ZDX::zdx_chrom_table  ctable;

  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  if(offset == 0) {
    //printf("create first chrom_table [%s] [%s] %ld\n", asm_name.c_str(), chrom_name.c_str(), chrom_length);
    //means no assembly was created 
    bzero(&ctable, sizeof(zdx_chrom_table));
    memcpy(ctable.assembly_name, asm_name.c_str(), asm_name.size());
    
    strncpy(ctable.chroms[0].name, chrom_name.c_str(), 63);
    strncpy(ctable.chroms[0].ncbi_accession, chrom->ncbi_accession().c_str(), 31);
    strncpy(ctable.chroms[0].refseq_accession, chrom->refseq_accession().c_str(), 31);
    strncpy(ctable.chroms[0].ncbi_name, chrom->ncbi_chrom_name().c_str(), 31);
    strncpy(ctable.chroms[0].name_alt1, chrom->chrom_name_alt1().c_str(), 31);
    ctable.chroms[0].chrom_length = chrom_length;
    ctable.chroms[0].segment_size = 100000; //100kb
    
    if(!_create_segments_array(ctable.chroms[0])) {
      fprintf(stderr, "zdxsegement error writing segments\n");
      return -1; 
    }

    // write out chrom_table 
    zdxfd = _zdxdb->connect(ZDXWRITE);

    //lock
    fl.l_type = F_WRLCK;
    fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
    
    offset = lseek(zdxfd, 0, SEEK_END);    
    if(write(zdxfd, &ctable, sizeof(zdx_chrom_table)) != sizeof(zdx_chrom_table)) {
      fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
      fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */

      fprintf(stderr, "zdxsegement error writing chrom_table\n");
      return -1;
    }

    //unlock
    fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    
    if(!_zdxdb->write_subsystem_offset(2, offset)) {
      fprintf(stderr, "zdxstream error writing sources\n");
      return -1;
    }
    return offset;
  }
    
  while(1) {
    //printf("read chrom_table at %ld\n", offset);
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      _zdxdb->disconnect();
      return -1;
    }
    if(strncmp(ctable.assembly_name, asm_name.c_str(), 64) == 0) { 
      //printf("found matching assembly chrom_table\n");
      for(int c_idx=0; c_idx<32; c_idx++) {
        
        if(ctable.chroms[c_idx].segments_offset == 0) {
          //found a chrom_table with matching assembly, and open chrom-slot
          //means I have not found chrom yet, and I should create one here
          //printf("create [%d] new chrom [%s[ [%s] %ld\n", c_idx, asm_name.c_str(), chrom_name.c_str(), chrom_length);

          strncpy(ctable.chroms[c_idx].name, chrom_name.c_str(), 63);
          strncpy(ctable.chroms[c_idx].ncbi_accession, chrom->ncbi_accession().c_str(), 31);
          strncpy(ctable.chroms[c_idx].refseq_accession, chrom->refseq_accession().c_str(), 31);
          strncpy(ctable.chroms[c_idx].ncbi_name, chrom->ncbi_chrom_name().c_str(), 31);
          strncpy(ctable.chroms[c_idx].name_alt1, chrom->chrom_name_alt1().c_str(), 31);
          ctable.chroms[c_idx].chrom_length = chrom_length;
          ctable.chroms[c_idx].segment_size = 100000; //100kb
          if(!_create_segments_array(ctable.chroms[c_idx])) { 
            fprintf(stderr, "zdxsegement error writing segments\n");
            return -1;
          }

          //write out this chrom record in the array, no need to write whole chrom table
          zdxfd = _zdxdb->connect(ZDXWRITE);
          //offset is now pointing at the chrom_table start in the file
          char* p1 = (char*)&ctable; //turn into byte pointer
          char* p2 = (char*)&(ctable.chroms[c_idx]);
          
          //lock
          fl.l_type = F_WRLCK;
          fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
          
          lseek(zdxfd, offset + (p2-p1), SEEK_SET);
          if(write(zdxfd, &(ctable.chroms[c_idx]), sizeof(zdx_chrom)) != sizeof(zdx_chrom)) {
            //unlock
            fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
            fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */

            fprintf(stderr, "zdxsegement error writing chrom[%d] into chrom_table\n", c_idx);
            return -1;
          }  
          
          //unlock
          fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
          fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
          
          return offset;
        }
        
        if(strncmp(ctable.chroms[c_idx].name, chrom_name.c_str(), 64) == 0) {
          //printf("already exists chrom [%s] [%s]\n", asm_name.c_str(), chrom_name.c_str());
          return offset;
        }
      }
    }
    
    if(ctable.next_chrom_table == 0) {
      //printf("need to create new chrom_table, previous one is full\n");
      //no more chrom_tables in chain so create new one
      EEDB::ZDX::zdx_chrom_table  new_ctable;

      bzero(&new_ctable, sizeof(zdx_chrom_table));
      memcpy(new_ctable.assembly_name, asm_name.c_str(), asm_name.size());
      
      strncpy(new_ctable.chroms[0].name, chrom_name.c_str(), 63);
      strncpy(new_ctable.chroms[0].ncbi_accession, chrom->ncbi_accession().c_str(), 31);
      strncpy(new_ctable.chroms[0].refseq_accession, chrom->refseq_accession().c_str(), 31);
      strncpy(new_ctable.chroms[0].ncbi_name, chrom->ncbi_chrom_name().c_str(), 31);
      strncpy(new_ctable.chroms[0].name_alt1, chrom->chrom_name_alt1().c_str(), 31);
      new_ctable.chroms[0].chrom_length = chrom_length;
      new_ctable.chroms[0].segment_size = 100000; //100kb

      if(!_create_segments_array(new_ctable.chroms[0])) {
        fprintf(stderr, "zdxsegement error writing segments\n");
        return -1;
      }
      
      // write out new chrom_table 
      //printf("new chrom_table first chrom [%s] [%s] %ld\n", asm_name.c_str(), chrom_name.c_str(), chrom_length);
      zdxfd = _zdxdb->connect(ZDXWRITE);
      
      //lock
      fl.l_type = F_WRLCK;
      fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
      
      int64_t new_offset = lseek(zdxfd, 0, SEEK_END);
      if(write(zdxfd, &new_ctable, sizeof(zdx_chrom_table)) != sizeof(zdx_chrom_table)) {
        //unlock
        fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
        fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
        
        fprintf(stderr, "zdxsegement error writing chrom_table\n");
        return -1;
      }
      //printf("new chrom_table at %ld\n", new_offset);
      
      //update the current chrom_table.next_chrom_table
      //offset still points at the previous chrom_table
      lseek(zdxfd, offset, SEEK_SET); //next_chrom_table is first bytes of chrom_table
      if(write(zdxfd, &new_offset, sizeof(int64_t)) != sizeof(int64_t)) {
        //unlock
        fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
        fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */

        fprintf(stderr, "zdxstream error writing chrom_table\n");
        return -1;
      }
      
      //unlock
      fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
      fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
      
      return new_offset;
    }
    
    offset = ctable.next_chrom_table;
  }
    
  return -1;
}


bool  EEDB::ZDX::ZDXsegment::_create_segments_array(zdx_chrom &zchrom) {
  if(zchrom.segment_size<=0) { return false; }
  if(zchrom.chrom_length<=0) { return false; }
  
  int  zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }

  long num_segs = zchrom.chrom_length / zchrom.segment_size + 1;

  zdx_chrom_segment segments[num_segs];
  
  int32_t pos=1;
  for(long seg=0; seg<num_segs; seg++) {
    segments[seg].chrom_start  = pos;
    segments[seg].chrom_end    = pos + zchrom.segment_size -1;
    segments[seg].znode        = 0;
    pos += zchrom.segment_size;
  }

  // write out the segments array
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
    
  zchrom.segments_offset = lseek(zdxfd, 0, SEEK_END);
  ssize_t rtn = write(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs);
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */

  if(rtn != (ssize_t)sizeof(zdx_chrom_segment)*num_segs) {
    fprintf(stderr, "zdxsegement error writing chrom_table segments\n");
    return false;
  }
  return true;
}


bool  EEDB::ZDX::ZDXsegment::_init_segment(string asm_name, string chrom_name, int64_t position) {
  _chrom = new EEDB::Chrom();
  _chrom->chrom_name(chrom_name);
  _chrom->assembly_name(asm_name);
      
  bzero(&_zchrom_table, sizeof(EEDB::ZDX::zdx_chrom_table));
  bzero(&_zsegment, sizeof(EEDB::ZDX::zdx_chrom_segment));
  _zchrom = NULL;
  
  if(!_zdxdb) { return false; }
  
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }
    
  int64_t offset = _zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  while(1) {
    if(_zchrom!=NULL) { break; }
    if(offset == 0) { return false; }
    
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &_zchrom_table, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      return false;
    }
        
    if(strncmp(_zchrom_table.assembly_name, asm_name.c_str(), 64) == 0) { 
      for(int i=0; i<32; i++) {
        if(_zchrom_table.chroms[i].segments_offset == 0) { break; }
        if(strncmp(_zchrom_table.chroms[i].name, chrom_name.c_str(), 64) == 0) { 
          _zchrom = &(_zchrom_table.chroms[i]);
          _zchrom_offset = offset + ((char*)_zchrom - (char*)(&_zchrom_table));
          break;
        }
      }
    }
    offset = _zchrom_table.next_chrom_table;
  }
  if(_zchrom==NULL) { return false; }
  if(_zchrom->segments_offset == 0) { _zchrom = NULL; return false; }

  //long num_segs = _zchrom->chrom_length / _zchrom->segment_size + 1;
  //fprintf(stderr, "[%s] %dbp, segsize=%d num=%ld\n", _zchrom->name, _zchrom->chrom_length, _zchrom->segment_size, num_segs); 

  if(position<1) { position = 1; }
  if(position > _zchrom->chrom_length) { _zchrom = NULL; return false; }
  
  long int segnum = (position-1) / _zchrom->segment_size;
  _segment_offset = _zchrom->segments_offset + (segnum * sizeof(zdx_chrom_segment));
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading  segment\n");
    _segment_offset = -1;
    _zchrom = NULL;
    return false;
  }
  
  return true;
}


bool  EEDB::ZDX::ZDXsegment::claim_segment() {
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
  
  //claim it by writing a -1 into the _zsegment.znode
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }

  // write out the segments array
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    fprintf(stderr, "zdxsegement error claiming  segment\n");
    _segment_offset = -1;
    _zchrom = NULL;
    return false;
  }

  if(_zsegment.znode!=0) { return false; } //already claimed by another or already built

  _zsegment.znode = -1;
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    fprintf(stderr, "zdxsegement error claiming segment\n");
    _zsegment.znode = 0;
    _zdxdb->disconnect();
    return false;
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */

  //write an empty znode with builder stats at beginning
  gettimeofday(&_seg_starttime, NULL);
  _znode_append_features(false);

  _zdxdb->disconnect();
  
  return true;
}


bool  EEDB::ZDX::ZDXsegment::clear_claim() {
  //'garbage' clean up of failed building
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
  
  //claim it by writing a -1 into the _zsegment.znode
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
    
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error claiming  segment\n");
    return false;
  }
  
  if(_zsegment.znode >= 0) { return false; } //not claimed nor building
  _zsegment.znode = 0;  //reset to unbuilt state
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait

  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error claiming segment\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    _zdxdb->disconnect();
    return false;
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  _zdxdb->disconnect();
  return true;
}


bool  EEDB::ZDX::ZDXsegment::reload() {
  if(_segment_offset<=0) { return false; } //not initialized properly
  
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading segment\n");
    return false;
  }
  _zdxdb->disconnect();
  return true;
}


bool  EEDB::ZDX::ZDXsegment::is_built() {
  if(_segment_offset<=0) { return false; } //not initialized properly

  /*
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading segment\n");
    return false;
  }
  _zdxdb->disconnect();
  */
  
  if(_zsegment.znode>0) { return true; }
  return false;
}


bool  EEDB::ZDX::ZDXsegment::is_claimed() {
  if(_segment_offset<=0) { return false; } //not initialized properly
  
  /*
  int zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return false; }

  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading segment\n");
    return false;
  }
  _zdxdb->disconnect();
  */
  
  if(_zsegment.znode < 0) { return true; } //not finished building
  return false;
}

////////////////////////////////////////////////////////////////////////////////////////////////
//
//

void   EEDB::ZDX::ZDXsegment::show_chrom_segments() {
  if(!_zdxdb) { return; }
  
  int  zdxfd = _zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  // check if assembly/chrom exists
  int64_t offset = _zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  while(1) {
    //printf("read chrom_table at %ld\n", offset);
    if(offset == 0) { return; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      _zdxdb->disconnect();
      return;
    }
    printf("chrom_table [%s]\n", ctable.assembly_name);
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;

      printf("%4d: [%s] %d bp, segsize=%d num=%ld\n", c_idx, zchrom->name, zchrom->chrom_length, zchrom->segment_size, num_segs); 
      
      zdx_chrom_segment segments[num_segs];
            
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdxsegement error read chrom_table segments\n");
        return;
      }
      
      for(long seg=0; seg<num_segs; seg++) {
        printf("  %7ld: %7d..%7d [%lld]\n", seg, segments[seg].chrom_start, segments[seg].chrom_end, (long long)segments[seg].znode);
      }
    }
        
    offset = ctable.next_chrom_table;
  }
}


vector<EEDB::Chrom*>  EEDB::ZDX::ZDXsegment::fetch_all_chroms(ZDXdb* zdxdb) {
  vector<EEDB::Chrom*> chroms;
  
  if(!zdxdb) { return chroms; }
  
  int  zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return chroms; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  // check if assembly/chrom exists
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  while(1) {
    //printf("read chrom_table at %ld\n", offset);
    if(offset == 0) { return chroms; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      return chroms;
    }
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }
      
      EEDB::Chrom* chrom = new EEDB::Chrom();
      chrom->assembly_name(ctable.assembly_name);
      chrom->chrom_name(zchrom->name);
      chrom->ncbi_accession(zchrom->ncbi_accession);
      chrom->refseq_accession(zchrom->refseq_accession);
      chrom->ncbi_chrom_name(zchrom->ncbi_name);
      chrom->chrom_name_alt1(zchrom->name_alt1);
      chrom->chrom_length(zchrom->chrom_length);
      
      chroms.push_back(chrom);
    }
    
    offset = ctable.next_chrom_table;
  }
  
  return chroms;
}


EEDB::Chrom*  EEDB::ZDX::ZDXsegment::fetch_chrom(ZDXdb* zdxdb, string asm_name, string chrom_name) {
  if(!zdxdb) { return NULL; }
  
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  if(offset == 0) { return NULL; }
  
  int  zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return NULL; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  while(offset!=0) {
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      return NULL;
    }
    if(strncmp(ctable.assembly_name, asm_name.c_str(), 64) == 0) { 
      for(int c_idx=0; c_idx<32; c_idx++) {
        zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
        if(zchrom->segments_offset == 0) { break; }
        
        if((strncmp(ctable.chroms[c_idx].name, chrom_name.c_str(), 64) == 0) ||
           (strncmp(ctable.chroms[c_idx].ncbi_accession, chrom_name.c_str(), 32) == 0) ||
           (strncmp(ctable.chroms[c_idx].refseq_accession, chrom_name.c_str(), 32) == 0) ||
           (strncmp(ctable.chroms[c_idx].name_alt1, chrom_name.c_str(), 32) == 0) ||
           (strncmp(ctable.chroms[c_idx].ncbi_name, chrom_name.c_str(), 32) == 0)) {
          EEDB::Chrom* chrom = new EEDB::Chrom();
          chrom->assembly_name(ctable.assembly_name);
          chrom->chrom_name(zchrom->name);
          chrom->ncbi_accession(zchrom->ncbi_accession);
          chrom->refseq_accession(zchrom->refseq_accession);
          chrom->ncbi_chrom_name(zchrom->ncbi_name);
          chrom->ncbi_chrom_name(zchrom->name_alt1);
          chrom->chrom_length(zchrom->chrom_length);
          return chrom;
        }        
      }
    }
    offset = ctable.next_chrom_table;
  }
  return NULL;  
}
  

long  EEDB::ZDX::ZDXsegment::num_chroms(ZDXdb* zdxdb) {  
  if(!zdxdb) { return 0; }
  
  int  zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return 0; }
    
  // check if assembly/chrom exists
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  if(offset == 0) { return 0; }

  EEDB::ZDX::zdx_chrom_table  ctable;
  long  count=0;

  while(1) {
    //printf("read chrom_table at %ld\n", offset);
    if(offset == 0) { return count; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      return count;
    }
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }
      count++;
    }
    
    offset = ctable.next_chrom_table;
  }
  
  return count;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// class level methods for getting statistics
//
//////////////////////////////////////////////////////////////////////////////////////////////////


double   EEDB::ZDX::ZDXsegment::calc_percent_completed(ZDXdb* zdxdb, bool show) {
  if(!zdxdb) { return -1; }
  
  int  zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return -1; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  // check if assembly/chrom exists
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  long count=0;
  long completed=0;
    
  while(1) {
    //printf("read chrom_table at %ld\n", offset);
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      break;
    }
    //printf("chrom_table [%s]\n", ctable.assembly_name);
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      
      //printf("%4d: [%s] %d bp, segsize=%d num=%ld\n", c_idx, zchrom->name, zchrom->chrom_length, zchrom->segment_size, num_segs); 
      
      zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdxsegement error read chrom_table segments\n");
        return -1;
      }

      if(show) { printf("%s %s %s [%d bp] ", ctable.assembly_name, zchrom->name, zchrom->ncbi_accession, zchrom->chrom_length); }
      
      for(long seg=0; seg<num_segs; seg++) {
        count++;
        if(segments[seg].znode > 0) {
          if(show) { printf("O"); }
          completed++;
        }
        else if(segments[seg].znode < 0) {
          if(show) { printf("X"); }
        }
        else {
          if(show) { printf("-"); }
        }
      }
      if(show) { printf("\n"); }
    }
    
    offset = ctable.next_chrom_table;
  }
  return (double)completed / (double)count;
}


vector<EEDB::Chrom*>  EEDB::ZDX::ZDXsegment::unbuilt_chroms(ZDXdb* zdxdb) {
  vector<EEDB::Chrom*> chroms;

  if(!zdxdb) { return chroms; }
  
  int  zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return chroms; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  // check if assembly/chrom exists
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
    
  while(1) {
    //printf("read chrom_table at %ld\n", offset);
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      return chroms;
    }
    //printf("chrom_table [%s]\n", ctable.assembly_name);
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; } // no more chroms left
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      if(num_segs==0) { continue; }
      //printf("%4d: [%s] %d bp, segsize=%d num=%ld\n", c_idx, zchrom->name, zchrom->chrom_length, zchrom->segment_size, num_segs); 
      
      zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdxsegement error read chrom_table segments\n");
        continue; //move onto the next chrom
      }
            
      bool unbuilt=false;
      for(long seg=0; seg<num_segs; seg++) {
        if(segments[seg].znode == 0) { unbuilt=true; break; }
      }
      
      if(unbuilt) {
        EEDB::Chrom* chrom = new EEDB::Chrom();
        chrom->assembly_name(ctable.assembly_name);
        chrom->chrom_name(zchrom->name);
        chrom->chrom_length(zchrom->chrom_length);
        chroms.push_back(chrom);
      }
    }
    
    offset = ctable.next_chrom_table;
  }
  return chroms;
}


void  EEDB::ZDX::ZDXsegment::build_stats(ZDXdb* zdxdb, string assembly_name, string chrom_name, long start, long end, 
                                         long &numsegs, long &numbuilt, long &numclaimed, long &seg_start) {
  numsegs    = 0;
  numbuilt   = 0;
  numclaimed = 0;  
  seg_start = start;
  
  if(!zdxdb) { return; }
  
  int zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2    
  while(1) {
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      break;
    }

    if(!assembly_name.empty() && (strncmp(ctable.assembly_name, assembly_name.c_str(), 64) != 0)) {
      //not matched assembly name
      offset = ctable.next_chrom_table;
      continue;
    }
    
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      if(chrom_name.empty() || (strncmp(ctable.chroms[c_idx].name, chrom_name.c_str(), 64) == 0)) {
        long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
        zdx_chrom_segment segments[num_segs];
        
        lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
        if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
          fprintf(stderr, "zdxsegement error read chrom_table segments\n");
          return;
        }
        
        for(long seg=0; seg<num_segs; seg++) {
          if((start>0) && (segments[seg].chrom_end < start)) { continue; }
          if((end>0) && (segments[seg].chrom_start > end)) { continue; }          
          numsegs++;
          if(segments[seg].znode > 0) { numbuilt++; }
          if(segments[seg].znode < 0) { numclaimed++; }
          if(segments[seg].chrom_start < seg_start) { seg_start = segments[seg].chrom_start; }
        }
      }
    }
      
    offset = ctable.next_chrom_table;
  }
}


EEDB::ZDX::ZDXsegment*  EEDB::ZDX::ZDXsegment::unbuilt_segment(ZDXdb* zdxdb, string assembly_name, string chrom_name, long start, long end) {
  //search the region specified (or entire zdx) for a series of unbuilt segments
  //depending on how parameters are specified it will either return the first unbuilt segment it finds
  //or it will choose a semi-random unbuilt segment
  //segment is not claimed by this method
  
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);  
  
  //fprintf(stderr, "ZDXsegment::unbuilt_segment\n");
  if(!zdxdb) { return NULL; }
    
  srandom(time(NULL));
  bool randomize_chrom = false;
  bool randomize_pos   = false;
  bool found_segment   = false;
  string  found_asmb;
  string  found_chrom;
  long    found_pos = -1;
  
  //if(chrom_name.empty()) { randomize_chrom = true; }
  //if(start==-1)          { randomize_pos = true; }  //turn off the randomize so it always returns first available
  
  int zdxfd = zdxdb->connect(ZDXREAD);
  if(zdxfd == -1) { return NULL; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2    
  while(1) {
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      break;
    }
    
    if(!randomize_chrom && !assembly_name.empty() && (strncmp(ctable.assembly_name, assembly_name.c_str(), 64) != 0)) {
      //not matched assembly name so move to next chrom_table
      offset = ctable.next_chrom_table;
      continue;
    }
    
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      if(!randomize_chrom && !chrom_name.empty() && (strncmp(zchrom->name, chrom_name.c_str(), 64) != 0)) {
        continue;
      }
      //fprintf(stderr, "chrom %s %s\n", ctable.assembly_name, zchrom->name);
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdxsegement error read chrom_table segments\n");
        continue;
      }
      
      for(long seg=0; seg<num_segs; seg++) {
        if((start>0) && (segments[seg].chrom_end < start)) { continue; }
        if((end>0) && (segments[seg].chrom_start > end)) { continue; }

        if(segments[seg].znode == 0) { 
          found_asmb  = ctable.assembly_name;
          found_chrom = zchrom->name;
          found_pos   = segments[seg].chrom_start;
          found_segment = true;
          //fprintf(stderr, "found unbuilt %s %s %ld\n", found_asmb.c_str(), found_chrom.c_str(), found_pos);
          
          if(randomize_pos) {
            long dice = (long)floor(100.0 * (double)random() / RAND_MAX);
            if(dice!=1) { // 1:100 chance I use this segment, otherwise check another
              //fprintf(stderr, "randpos dice %ld move next\n", dice);
              continue;
            }
          }
          break;
        }
      }

      if(found_segment && randomize_chrom) {
        long dice = (long)floor(7.0 * (double)random() / RAND_MAX);
        // 1:7 chance I use this chrom
        if(dice==1) { 
          //fprintf(stderr, "randchrom dice %ld pick this one\n", dice);
          break;
        } else {
          //fprintf(stderr, "randchrom dice %ld move next\n", dice);
          continue;
        }
      }
      if(found_segment && !randomize_chrom) { break; }
    }
    if(found_segment) { break; }
    offset = ctable.next_chrom_table;
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  //fprintf(stderr, "  %1.6f msec\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  if(found_segment) {
    EEDB::ZDX::ZDXsegment *segment = new EEDB::ZDX::ZDXsegment(zdxdb);
    if(segment->_init_segment(found_asmb, found_chrom, found_pos)) {
      //fprintf(stderr, "ZDXsegment::unbuilt_segment %s\n", segment->xml().c_str());
      return segment;  
    }
    segment->release(); //something wrong so keep going
  }
  return NULL;  
}



void  EEDB::ZDX::ZDXsegment::reset_failed_claims(ZDXdb* zdxdb) {
  //run this only when one knows that that no workers are actively claiming and building
  if(!zdxdb) { return; }
    
  EEDB::ZDX::zdx_chrom_table  ctable;
  
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  int zdxfd = zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return; }

  //lock around write
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
      
  while(1) {
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      break;
    }
        
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        break;
      }
      
      for(long seg=0; seg<num_segs; seg++) {
        if(segments[seg].znode < 0) { 
          //fprintf(stderr, "reset %s %s %ld\n", ctable.assembly_name, zchrom->name, segments[seg].chrom_start);
          segments[seg].znode = 0;  //reset to unbuilt state
          int64_t segoff = zchrom->segments_offset + (seg * sizeof(zdx_chrom_segment));
          lseek(zdxfd, segoff, SEEK_SET);
          if(write(zdxfd, &(segments[seg]), sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
            fprintf(stderr, "zdxsegement error writing unclaim\n");
          }
        }
      }
    }
    offset = ctable.next_chrom_table;
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */  
  
  zdxdb->disconnect();
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// adding features to segment znodes
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::ZDX::ZDXsegment::reclaim_for_appending() {
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
    
  if(_zsegment.znode<0) { 
    fprintf(stderr, "segment already claimed by another %ld\n",(long int)_zsegment.znode);
    return false; 
  } //already claimed by another or already built
  
  if(_zsegment.znode>0) {
    //already had features. need to read old features back in
    //fprintf(stderr, "load previous features from %s znode:%lld\n", display_desc().c_str(), _zsegment.znode);
    _region_start   = -1;
    _region_end     = -1;
    if(_streambuffer) { _streambuffer->release_objects(); _streambuffer->release(); _streambuffer = NULL; }    
    _streambuffer = new EEDB::SPStreams::StreamBuffer();
    _next_znode = _zsegment.znode;
    
    while(_load_next_znode()) { } 
    _next_znode = -1;
    
    //transfer from _streambuffer to _feature_buffer
    long count=0;
    while(MQDB::DBObject *obj = _streambuffer->next_in_stream()) {
      if(obj->classname() == EEDB::Feature::class_name) { 
        _feature_buffer.insert_feature((EEDB::Feature*)obj); 
        count++;
      } else { 
        fprintf(stderr, "not feature in znode"); 
        obj->release();
      }
    }
    //fprintf(stderr, "loaded %ld previous features from %s znode:%lld\n", count, display_desc().c_str(), _zsegment.znode);
    //fprintf(stderr, "loaded %ld previous feature back in from segment %lld\n", count, _zsegment.znode);
    _streambuffer->release_objects();
    _streambuffer->release(); 
    _streambuffer = NULL;
    
    //_zsegment.znode = -_zsegment.znode; //If I can figure out how to reuse
    _zsegment.znode = -1; //reset to -1
  }
  if(_zsegment.znode==0) {
    //first claim
    _zsegment.znode = -1;
  }
  

  //grab it for writing
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  // write lock
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
  
  /*
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fl.l_type = F_UNLCK;         // tell it to unlock the region 
    fcntl(zdxfd, F_SETLK, &fl);  // set the region to unlocked
    fprintf(stderr, "zdxsegement error read claiming segment\n");
    _segment_offset = -1;
    _zchrom = NULL;
    return false;
  }
  */
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    fprintf(stderr, "zdxsegement error writing segment claim\n");
    _zsegment.znode = 0;
    _zdxdb->disconnect();
    return false;
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  
  gettimeofday(&_seg_starttime, NULL);
  _zdxdb->disconnect();  
  return true;  
}


bool  EEDB::ZDX::ZDXsegment::add_chrom_chunk(EEDB::ChromChunk* chunk) {
  //ChromChunks are stored in individual znodes so no need to buffer
  //just write directly into a znode
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
  if(!_zdxdb) { return false; }
  if(!chunk) { return false; }
  
  if(_zsegment.chrom_end < chunk->chrom_end()) {
    extend_chrom_end(chunk->chrom_end());
  }
  
  //lock the file for writing
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  //
  // compress and write chunk XML into a znode
  //
  string xml_buffer = "<zdx>";
  
  xml_buffer += "<builder_info>";
  char host[1024], buffer[2048];
  bzero(host, 1024);
  gethostname(host, 1024);
  xml_buffer += string("<host>") + host + string("</host>");
  
  pid_t pid = getpid();
  snprintf(buffer, 2040, "<pid>%d</pid>", pid);
  xml_buffer += buffer;
  
  struct timeval endtime,difftime;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_seg_starttime, &difftime);
  snprintf(buffer, 2040, "<build_time_msec>%1.6f</build_time_msec>", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  xml_buffer += buffer;
  
  snprintf(buffer, 2040, "<start_time>%1.6f</start_time>", (double)_seg_starttime.tv_sec + ((double)_seg_starttime.tv_usec)/1000000.0);
  xml_buffer += buffer;
  snprintf(buffer, 2040, "<end_time>%1.6f</end_time>", (double)endtime.tv_sec + ((double)endtime.tv_usec)/1000000.0);
  xml_buffer += buffer;
  
  xml_buffer += "</builder_info>";
  //fprintf(stderr, "%s\n", xml_buffer.c_str());
  
  chunk->xml(xml_buffer);
  
  xml_buffer += "</zdx>";
  
  uint32_t  uncompress_buffer_len = xml_buffer.size();
  int64_t   znode_offset=0;
  zdxnode*  znode = NULL;
  
  //lz4 compression
  char*  compress_buffer = (char*)malloc(LZ4_compressBound(xml_buffer.size()));
  long   outSize = LZ4_compress(xml_buffer.c_str(), compress_buffer, xml_buffer.size());
  
  znode = _zdxdb->allocate_znode(outSize+sizeof(uint32_t));
  if(_last_znode >=0) { znode->prev_znode = _last_znode; }
  
  memcpy(znode->content_format_code, "CHRCHUNK", 8); //chrom_chunk znode
  
  //first copy binary uint32_t of length of uncompressed buffer size
  //fprintf(stderr, "uncompress_buffer_len %d\n", uncompress_buffer_len);
  memcpy(znode->blob, &uncompress_buffer_len, sizeof(uint32_t));
  //then copy the compressed data into the znode
  memcpy(znode->blob+sizeof(uint32_t), compress_buffer, outSize);
  
  //fprintf(stderr, "    zseg chunk seqlen=%ld  xml1=%ld xml2=%ld znode=%ld xratio=%1.3f\n", chunk->sequence().length(), chunk->xml().length(), xml_buffer.length(), outSize, (double)xml_buffer.length()/outSize);
  //fprintf(stderr, "%s\n", xml_buffer.c_str());
  
  znode_offset = _zdxdb->write_znode(znode);
  if(znode_offset<=0) {
    free(compress_buffer);
    fprintf(stderr, "zdxsegment error writing features\n");
    _zdxdb->disconnect();
    return false;
  }
  free(compress_buffer);
  
  //write znode offset
  if(_zsegment.znode == -1) {
    //first znode so write it into the segment, but as negative to indicate that it is still building
    _zsegment.znode = -znode_offset;
    //lock around write
    struct flock fl;
    fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
    fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
    fl.l_start  = 0;        /* Offset from l_whence         */
    fl.l_len    = 0;        /* length, 0 = to EOF           */
    fl.l_pid    = getpid(); /* our PID                      */
    fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
    
    lseek(zdxfd, _segment_offset, SEEK_SET);
    if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
      fprintf(stderr, "zdxsegement error updating segment\n");
      fl.l_type = F_UNLCK;         /* tell it to unlock the region */
      fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
      _zdxdb->disconnect();
      return false;
    }
    //unlock
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  } else {
    // need adjust previous znode.next_znode pointers
    if(!_zdxdb->update_znode_next(_last_znode, znode_offset)) {
      fprintf(stderr, "zdxsegement error updating last znode next_znode pointer\n");
      _zdxdb->disconnect();
      return false;
    }
  }
  _last_znode = znode_offset;
  
  //printf("wrote znode\n");
  if(znode) { free(znode); }
  
  /*
   // lock file for writing
   struct flock fl;
   fl.l_type   = F_WRLCK;  // F_RDLCK, F_WRLCK, F_UNLCK
   fl.l_whence = SEEK_SET; // SEEK_SET, SEEK_CUR, SEEK_END
   fl.l_start  = 0;        // Offset from l_whence
   fl.l_len    = 0;        // length, 0 = to EOF
   fl.l_pid    = getpid(); // our PID
   
   fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
   
   lseek(zdxfd, _segment_offset, SEEK_SET);
   if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
   fprintf(stderr, "zdxsegement error reading  segment\n");
   fl.l_type = F_UNLCK;         // tell it to unlock the region
   fcntl(zdxfd, F_SETLK, &fl);  // set the region to unlocked
   return false;
   }
   
   _zsegment.znode = llabs(_zsegment.znode);
   
   lseek(zdxfd, _segment_offset, SEEK_SET);
   if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
   fprintf(stderr, "zdxsegement error writing znode offset\n");
   fl.l_type = F_UNLCK;         // tell it to unlock the region
   fcntl(zdxfd, F_SETLK, &fl);  // set the region to unlocked
   _zdxdb->disconnect();
   return false;
   }
   
   //unlock
   fl.l_type = F_UNLCK;         // tell it to unlock the region
   fcntl(zdxfd, F_SETLK, &fl);  // set the region to unlocked
   */
  
  _zdxdb->disconnect();
  return true;
}


void  EEDB::ZDX::ZDXsegment::add_unsorted_feature(EEDB::Feature* feature) {
  //features are added to segment in a non-sorted order so they need to be buffered and sorted
  //and there is no way to 'finish' the buffer early
  if(!feature) { return; }  
  feature->retain();
  _feature_buffer.insert_feature(feature);
}


void  EEDB::ZDX::ZDXsegment::add_sorted_feature(EEDB::Feature* feature) {
  //features are added to segment in a SORTED order so  
  //it is possible to apply completion immeadiately
  if(!feature) { return; }
  feature->retain();
  _feature_buffer.insert_feature(feature);
  _feature_buffer.transfer_all_to_completed();
  _znode_append_features(true);
}


bool  EEDB::ZDX::ZDXsegment::write_segment_features() {  
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
  
  //perform flush and write out all features into znodes
  _feature_buffer.transfer_all_to_completed();
  while(_znode_append_features(true)) { }
  _znode_append_features(false); //write last znode even if it is small
  
  //change sign on _zsegment.znode to positive to indicate that completed
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  // lock file for writing
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
    
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading  segment\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    return false;
  }
  
  _zsegment.znode = llabs(_zsegment.znode);
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error writing znode offset\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    _zdxdb->disconnect();
    return false;
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  
  _zdxdb->disconnect();
  return true;
}


bool  EEDB::ZDX::ZDXsegment::write_build_complete() {
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
  
  //change sign on _zsegment.znode to positive to indicate that completed
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  // lock file for writing
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading  segment\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    return false;
  }
  
  _zsegment.znode = llabs(_zsegment.znode);
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error writing znode offset\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    _zdxdb->disconnect();
    return false;
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  
  _zdxdb->disconnect();
  return true;
}


void  EEDB::ZDX::ZDXsegment::finish_build(ZDXdb* zdxdb) {
  //fill in all remaining unbuilt segments with a znode==1 to indicate build is finished
  //fprintf(stderr, "ZDXsegment::finish_build\n");
  if(!zdxdb) { return; }
  
  EEDB::ZDX::zdx_chrom_table  ctable;
  int64_t offset = zdxdb->subsystem_offset(2);  //chrom_tables are subsystem 2
  
  int zdxfd = zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return; }
  // write lock
  struct flock fl;
  fl.l_type   = F_WRLCK;  // F_RDLCK, F_WRLCK, F_UNLCK    
  fl.l_whence = SEEK_SET; // SEEK_SET, SEEK_CUR, SEEK_END 
  fl.l_start  = 0;        // Offset from l_whence         
  fl.l_len    = 0;        // length, 0 = to EOF           
  fl.l_pid    = getpid(); // our PID                        
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
  
  while(1) {
    if(offset == 0) { break; }
    lseek(zdxfd, offset, SEEK_SET);  
    if(read(zdxfd, &ctable, sizeof(EEDB::ZDX::zdx_chrom_table)) != sizeof(EEDB::ZDX::zdx_chrom_table)) { 
      zdxdb->disconnect();
      break;
    }
    
    for(int c_idx=0; c_idx<32; c_idx++) {
      zdx_chrom *zchrom = &(ctable.chroms[c_idx]);
      if(zchrom->segments_offset == 0) { break; }  //last chrom, no more to check
      
      long num_segs = zchrom->chrom_length / zchrom->segment_size + 1;
      zdx_chrom_segment segments[num_segs];
      
      lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
      if(read(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
        fprintf(stderr, "zdxsegement error read chrom_table segments\n");
        return;
      }

      bool changed = false;
      for(long seg=0; seg<num_segs; seg++) {
        if(segments[seg].znode == 0) {
          segments[seg].znode = 1;
          changed=true;
        }
      }
      
      if(changed) {
        lseek(zdxfd, zchrom->segments_offset, SEEK_SET);
        if(write(zdxfd, segments, sizeof(zdx_chrom_segment)*num_segs) != (unsigned)sizeof(zdx_chrom_segment)*num_segs) {
          fprintf(stderr, "ZDXsegment::finish_build - error writing chrom segments\n");
        }      
      }
    }
    
    offset = ctable.next_chrom_table;
  }
    
  //unlock
  fl.l_type = F_UNLCK;         // tell it to unlock the region
  fcntl(zdxfd, F_SETLK, &fl);  // set the region to unlocked
}


bool  EEDB::ZDX::ZDXsegment::_znode_append_features(bool check) {
  if(_segment_offset<=0) { return false; }
  if(!_zdxdb) { return false; }

  //check the _feature_buffer for completed features
  if(_output_buffer.size() < 200000) { 
    EEDB::Feature *feature = _feature_buffer.next_completed_feature();  
    while(feature) {
      if(_zsegment.chrom_end < feature->chrom_end()) { 
        extend_chrom_end(feature->chrom_end());
      }
        
      feature->xml_interchange(_output_buffer,1);
      feature->release();
      feature = NULL;

      if(_output_buffer.size() >= 200000) { break; }  //200kb uncompressed size
      feature = _feature_buffer.next_completed_feature();
    }
  }
  if(check && (_output_buffer.size() < 200000)) { return false; }  //_output_buffer is not ready
  //fprintf(stderr, "output buffer big enough %ld bytes, feature_buffer %ld features remaining [cap %ld]\n", 
  //   _output_buffer.size(), _feature_buffer.completed_buffer_size(), _output_buffer.capacity());

  //lock the file for writing
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }

  //
  // compress and write _output_buffer into a znode
  //
  string xml_buffer = "<zdx>";
  
  xml_buffer += "<builder_info>";
  char host[1024], buffer[2048];
  bzero(host, 1024);
  gethostname(host, 1024);
  xml_buffer += string("<host>") + host + string("</host>");

  pid_t pid = getpid();
  snprintf(buffer, 2040, "<pid>%d</pid>", pid);
  xml_buffer += buffer;

  struct timeval endtime,difftime;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_seg_starttime, &difftime);
  snprintf(buffer, 2040, "<build_time_msec>%1.6f</build_time_msec>", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  xml_buffer += buffer;

  snprintf(buffer, 2040, "<start_time>%1.6f</start_time>", (double)_seg_starttime.tv_sec + ((double)_seg_starttime.tv_usec)/1000000.0);
  xml_buffer += buffer;
  snprintf(buffer, 2040, "<end_time>%1.6f</end_time>", (double)endtime.tv_sec + ((double)endtime.tv_usec)/1000000.0);
  xml_buffer += buffer;

  xml_buffer += "</builder_info>";
  //fprintf(stderr, "%s\n", xml_buffer.c_str());
  
  xml_buffer += _output_buffer;
  xml_buffer += "</zdx>";
  
  uint32_t  uncompress_buffer_len = xml_buffer.size();
  int64_t   znode_offset=0;
  zdxnode*  znode = NULL;

  int cmode = 3; //lz4

  /*
  // uncompressed version
  if(cmode==1) {
    znode = _zdxdb->allocate_znode(xml_buffer.size());
    memcpy(znode->blob, xml_buffer.c_str(), xml_buffer.size());
    //printf("blob start[%s]\n", znode->blob);
    if(!_zdxdb->write_znode(znode)) {
      fprintf(stderr, "zdxstream error writing sources\n");
      _zdxdb->disconnect();
      return false;
    }
  }
  
  // zlib compression
  if(cmode==2) {
    uLongf    cbuf_len = compressBound(uncompress_buffer_len)+16; //add a few extra bytes to be safe
    Bytef*    compress_buffer = (Bytef*)malloc(cbuf_len);
    
    if(compress(compress_buffer, &cbuf_len, (Bytef*)xml_buffer.c_str(), xml_buffer.size()) != Z_OK) {
      fprintf(stderr, "zdxsegment error compressing features\n");
      _zdxdb->disconnect();
      return false;
    }
    //printf("write out segment znode %d => %ld [%1.3fx]\n", uncompress_buffer_len, cbuf_len, (double)uncompress_buffer_len/cbuf_len);
    
    znode = _zdxdb->allocate_znode(cbuf_len+sizeof(uint32_t));
    if(_last_znode >=0) { znode->prev_znode = _last_znode; }
    
    //first copy binary uint32_t of length of uncompressed buffer size
    //fprintf(stderr, "uncompress_buffer_len %d\n", uncompress_buffer_len);
    memcpy(znode->blob, &uncompress_buffer_len, sizeof(uint32_t));  
    //then copy the compressed data into the znode
    memcpy(znode->blob+sizeof(uint32_t), compress_buffer, cbuf_len);
    
    znode_offset = _zdxdb->write_znode(znode);
    if(znode_offset<=0) {
      free(compress_buffer);
      fprintf(stderr, "zdxsegment error writing features\n");
      _zdxdb->disconnect();
      return false;
    }
    free(compress_buffer);
  }
   */
  
  if(cmode==3) {
    char*  compress_buffer = (char*)malloc(LZ4_compressBound(xml_buffer.size()));
    
    long outSize = LZ4_compress(xml_buffer.c_str(), compress_buffer, xml_buffer.size());
    
    znode = _zdxdb->allocate_znode(outSize+sizeof(uint32_t));
    if(_last_znode >=0) { znode->prev_znode = _last_znode; }

    memcpy(znode->content_format_code, "FEAT", 4); //normal znode

    //first copy binary uint32_t of length of uncompressed buffer size
    //fprintf(stderr, "uncompress_buffer_len %d\n", uncompress_buffer_len);
    memcpy(znode->blob, &uncompress_buffer_len, sizeof(uint32_t));  
    //then copy the compressed data into the znode
    memcpy(znode->blob+sizeof(uint32_t), compress_buffer, outSize);
    
    znode_offset = _zdxdb->write_znode(znode);
    if(znode_offset<=0) {
      free(compress_buffer);
      fprintf(stderr, "zdxsegment error writing features\n");
      _zdxdb->disconnect();
      return false;
    }
    free(compress_buffer);
  }
  
  //write znode offset
  if(_zsegment.znode == -1) {
    //first znode so write it into the segment, but as negative to indicate that it is still building
    _zsegment.znode = -znode_offset;
    //lock around write
    struct flock fl;
    fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
    fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
    fl.l_start  = 0;        /* Offset from l_whence         */
    fl.l_len    = 0;        /* length, 0 = to EOF           */
    fl.l_pid    = getpid(); /* our PID                      */      
    fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait

    lseek(zdxfd, _segment_offset, SEEK_SET);
    if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
      fprintf(stderr, "zdxsegement error updating segment\n");
      fl.l_type = F_UNLCK;         /* tell it to unlock the region */
      fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
      _zdxdb->disconnect();
      return false;
    }  
    //unlock
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  } else {
    // need adjust previous znode.next_znode pointers
    if(!_zdxdb->update_znode_next(_last_znode, znode_offset)) {
      fprintf(stderr, "zdxsegement error updating last znode next_znode pointer\n");
      _zdxdb->disconnect();
      return false;
    }
  }
  _last_znode = znode_offset;

  //printf("wrote znode\n");

  //finished
  if(znode) { free(znode); }
  _output_buffer.clear();
  _zdxdb->disconnect();  //free the write lock
  return true;
}


bool  EEDB::ZDX::ZDXsegment::extend_chrom_end(long new_end) { 
  if(_zchrom==NULL) { return false; }
  if(_segment_offset<=0) { return false; }
    
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  
  // lock file for writing
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(read(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error reading  segment\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    return false;
  }
  
  if((_zsegment.chrom_end < new_end) || (new_end<0)) {
    //printf("segment [%s%s %d..%d] new chrom_end %ld\n", 
    //       assembly_name().c_str(), chrom_name().c_str(), chrom_start(), chrom_end(), new_end);
    
    if(new_end < 0) { new_end = _zsegment.chrom_start + _zchrom->segment_size -1; }
    _zsegment.chrom_end = new_end;
    
    lseek(zdxfd, _segment_offset, SEEK_SET);
    if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
      fprintf(stderr, "zdxsegement error writing znode offset\n");
      fl.l_type = F_UNLCK;         /* tell it to unlock the region */
      fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
      _zdxdb->disconnect();
      return false;
    }
  }
  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  
  _zdxdb->disconnect();
  return true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// reading/streaming features out of segment znodes
//
//////////////////////////////////////////////////////////////////////////////////////////////////

MQDB::DBObject*  EEDB::ZDX::ZDXsegment::next_in_stream() {
  //only streams features out of znodes -> streambuffer
  if(_streambuffer == NULL) { return NULL; }

  while(1) {
    MQDB::DBObject *obj = _streambuffer->next_in_stream();
    if(obj) { return obj; }
    if(!_load_next_znode()) { 
      //if no more objects then clear
      _streambuffer->release_objects();
      _streambuffer->release();
      _streambuffer = NULL;
      return NULL;
    }
  }
  return NULL;
}

bool  EEDB::ZDX::ZDXsegment::stream_region(long int start, long int end) {
  if(!_zdxdb) { return false; }
  if(!_zchrom) { return false; }
  if(_zsegment.znode<=0) { return false; }  //error because segment is not ready/built

  _region_start   = start;
  _region_end     = end;
  
  if(_streambuffer) {
    _streambuffer->release_objects();
    _streambuffer->release();
    _streambuffer = NULL;
  }
  
  //first time to get from system offset table
  _next_znode = _zsegment.znode;
  _streambuffer = new EEDB::SPStreams::StreamBuffer();

  //<0 is building, =0 is unbuiilt, 1-100 are built but no znode, >100 has znode
  if(_next_znode>=1 && _next_znode<=100) { _next_znode = -1; return true; } //empty segment
  
  if(!_load_next_znode()) { _next_znode = -1; return false; }
  return true;
}


bool  EEDB::ZDX::ZDXsegment::_load_next_znode() {  
  //struct timeval  starttime,endtime,difftime;
  //gettimeofday(&starttime, NULL);  

  if(!_zdxdb) { return false; }  
  if(_next_znode<=0) { return false; } 
  if(_next_znode>=1 && _next_znode<=100) { _next_znode = -1; return true; } //empty segment
  //<0 is building, =0 is unbuiilt, 1-100 are built but no znode, >100 has real znode

  zdxnode *znode = _zdxdb->fetch_znode(_next_znode);
  if(!znode) { return false; }
  _next_znode = znode->next_znode;
  //fprintf(stderr, "ZDXsegment::_load_next_znode\n");

  //get uncompress_buffer_len
  uint32_t uncompress_buffer_len;
  memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
    
  if(_compress_buffer == NULL) {
    _compress_buflen = 10240; //10kb;
    _compress_buffer = (char*)malloc(_compress_buflen);
  }
  if(uncompress_buffer_len+1 > _compress_buflen) {
    _compress_buflen = ((uncompress_buffer_len+1)/10240 + 1) * 10240; //multiples of 10kb;
    _compress_buffer = (char*)realloc(_compress_buffer, _compress_buflen);
  }
  bzero(_compress_buffer, _compress_buflen);
  
  // LZ4 uncompress
  int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), _compress_buffer, uncompress_buffer_len);
  if(sinkint < 0) { 
    fprintf(stderr, "zdxstream error uncompressing segment znode\n");
    _next_znode = -1;
    return false;    
  }  
  free(znode);
    
  //then parse XML
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(_compress_buffer);
  root_node = doc.first_node();
  if(!root_node || (root_node->name() != string("zdx"))) { 
    fprintf(stderr, "zdxsegment failed to parse xml\n");
    return false; 
  }
  
  // feature
  if((node = root_node->first_node("feature")) != NULL) { 
    while(node) {
      EEDB::Feature *feature = EEDB::Feature::realloc();
      if(feature->init_from_xml(node)) {
        if(_region_start>0 && feature->chrom_end()<_region_start) {
          //fprintf(stderr, "skip feature %ld < %ld\n", feature->chrom_end(), _region_start);
          feature->release();
        } else if(_region_end>0 && feature->chrom_start()>_region_end) {
          //fprintf(stderr, "skip feature %ld > %ld\n", feature->chrom_start(), _region_end);
          feature->release();
        } else {
          //fprintf(stderr, "have feature\n");
          feature->chrom(_chrom);
          _streambuffer->add_object(feature);
        }
      } else { feature->release(); }
      node = node->next_sibling("feature");
    }    
  }
  // chrom_chunk
  if((node = root_node->first_node("chrom_chunk")) != NULL) {
    while(node) {
      EEDB::ChromChunk *chunk = new EEDB::ChromChunk(node);
      if(_region_start>0 && chunk->chrom_end()<_region_start) {
        //fprintf(stderr, "skip feature %ld < %ld\n", feature->chrom_end(), _region_start);
        chunk->release();
      } else if(_region_end>0 && chunk->chrom_start()>_region_end) {
        //fprintf(stderr, "skip feature %ld > %ld\n", feature->chrom_start(), _region_end);
        chunk->release();
      } else {
        //fprintf(stderr, "have feature\n");
        chunk->chrom(_chrom);
        _streambuffer->add_object(chunk);
      }
      node = node->next_sibling("chrom_chunk");
    }
  }
  //gettimeofday(&endtime, NULL);
  //timersub(&endtime, &starttime, &difftime);
  //fprintf(stderr, "  %1.6f msec\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  return true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// binary sync send/receive
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::ZDX::ZDXsegment::binary_sync_send(FILE* fp) {
  if(!_zdxdb) { return; }
  if(!_zchrom) { return; }
  if(_zsegment.znode<=0) { return; }

  //sending on webservice, so print to stdout
  fprintf(fp, "ZDXSEGMENT %s:::%s::%d..%d\n", _zchrom_table.assembly_name, _zchrom->name, _zsegment.chrom_start, _zsegment.chrom_end);
  //fprintf(fp, "%s\n", xml().c_str());
  
  //get last znode of segment
  zdxnode *znode = NULL;
  int64_t zoff = abs(_zsegment.znode);
  while(zoff != 0) {
    znode = _zdxdb->fetch_znode(zoff);
    if(!znode) { return; }
    
    //send the binary content of znode
    fprintf(fp, "ZNODE\t%s\t%d\n", znode->content_format_code, znode->blob_size);    
    //memset(znode->blob, ' ', znode->blob_size); //for debugging, zero out the node with spaces
    fwrite(znode->blob, znode->blob_size, 1, stdout);
    
    /*    
    typedef struct {
      int64_t    next_znode;  //64bit fseek offset
      int64_t    prev_znode;  //64bit fseek offset
      char       content_format_code[8];
      uint32_t   blob_size;   //max 4GB max per zdxnode
      char       blob[4];
    } zdxnode;
    */

    zoff = znode->next_znode;
    if(zoff != 0) { free(znode); }
  }  
  fprintf(fp, "ZDXSEGMENT_END\n");
}


bool  EEDB::ZDX::ZDXsegment::binary_sync_receive(char* chunk_data, long chunk_size) {
  //fprintf(stderr, "EEDB::ZDX::ZDXsegment::binary_sync_receive\n");
  if(!_zdxdb) { return false; }
  if(!_zchrom) { return false; }
  //if(_zsegment.znode != -1) { return false; }  //must already be claimed
  
  char *p1, *p2, *p3;
  //fprintf(stderr, "%s\n", chunk_data);
  if(strncmp(chunk_data, "ZDXSEGMENT",10) != 0) { return false; } 

  //get the zseg location
  p1 = chunk_data+10;
  p2 = strchr(p1, '\n');
  if(!p2) { free(chunk_data); return false; }
  *p2 = '\0';
  string loc_str = p1;
  //parse location and check/update segment
  string chrom_name  = loc_str;
  long seg_start=-1, seg_end=-1;
  size_t p4;
  if((p4 = loc_str.rfind("::")) != string::npos) {
    chrom_name = loc_str.substr(0,p4);
    string tstr = loc_str.substr(p4+2);
    if((p4 = tstr.find("..")) != string::npos) {
      string start_str = tstr.substr(0,p4);
      seg_start = strtol(start_str.c_str(), NULL, 10);
      string end_str = tstr.substr(p4+2);
      seg_end   = strtol(end_str.c_str(), NULL, 10);
    }
  }
  fprintf(stderr, "ZDXSEGMENT remote-sync loc:[%s] %ld..%ld bytes:%ld\n", loc_str.c_str(), seg_start, seg_end, chunk_size);
  if((seg_start>0) && (seg_start!= _zsegment.chrom_start)) {
    fprintf(stderr, "  update zseg.start = %ld\n", seg_start);
    _zsegment.chrom_start = seg_start; 
  }
  if((seg_end>0) && (seg_end!= _zsegment.chrom_end)) {
    fprintf(stderr, "  update zseg.end = %ld\n", seg_end);
    _zsegment.chrom_end = seg_end; 
  }
  
  //lock the file for writing
  int zdxfd = _zdxdb->connect(ZDXWRITE);
  if(zdxfd == -1) { return false; }
  _last_znode = -1;
  
  int64_t first_znode_offset = -1;

  p1 = p2+1;
  while(p1 < chunk_data + chunk_size) {
    if(strncmp(p1, "ZNODE",5) != 0) { break; } 
    
    p2 = strchr(p1, '\n');
    if(!p2) { break; }
    *p2 = '\0';
    char* p_blob = p2+1;
    
    //TODO: get content_format_code from chunk_data

    p3 = rindex(p1, '\t');
    if(!p3) { break; }
    long znode_size = strtol(p3+1, NULL, 10);
    //fprintf(stderr, "[%s] size=%ld\n", p1, znode_size);
    
    //copy extracted blob into znode of segment
    zdxnode*  znode = _zdxdb->allocate_znode(znode_size);
    if(_last_znode >=0) { znode->prev_znode = _last_znode; }
    
    memcpy(znode->content_format_code, "FEAT", 4); //TODO: use content_format_code from chunk_data
    memcpy(znode->blob, p_blob, znode_size);
    
    int64_t znode_offset = _zdxdb->write_znode(znode);
    if(znode_offset<=0) {
      fprintf(stderr, "zdxsegment error writing znode\n");
      _zdxdb->disconnect();
      return false;
    }    
    
    //write znode offset
    if(first_znode_offset == -1) {
      //first znode so make sure to set _zsegment.znode but do not write
      first_znode_offset = znode_offset;
    } else {
      // need adjust previous znode.next_znode pointers
      if(!_zdxdb->update_znode_next(_last_znode, znode_offset)) {
        fprintf(stderr, "zdxsegement error updating last znode next_znode pointer\n");
        _zdxdb->disconnect();
        return false;
      }
    }
    _last_znode = znode_offset;    
    free(znode);
    
    //move to next ZNODE
    p1 = p_blob + znode_size;
  }
  
  if(strncmp(p1, "ZDXSEGMENT_END",14) != 0) { 
    fprintf(stderr, "ZDXSEGMENT_END missing!\n"); 
    return false;
  } 
  
  //write _zsegment.znode offset
  //lock around write
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */      
  fcntl(zdxfd, F_SETLKW, &fl);  // set lock and wait
  
  _zsegment.znode = first_znode_offset;
  
  lseek(zdxfd, _segment_offset, SEEK_SET);
  if(write(zdxfd, &_zsegment, sizeof(zdx_chrom_segment)) != (unsigned)sizeof(zdx_chrom_segment)) {
    fprintf(stderr, "zdxsegement error updating segment\n");
    fl.l_type = F_UNLCK;         /* tell it to unlock the region */
    fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
    _zdxdb->disconnect();
    return false;
  }  
  //unlock
  fl.l_type = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxfd, F_SETLK, &fl);  /* set the region to unlocked */
  
  //finished
  _zdxdb->disconnect();  //free the write lock
  return true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// tests
//
//////////////////////////////////////////////////////////////////////////////////////////////////


long  EEDB::ZDX::ZDXsegment::test_next_znode() {  
  if(!_zdxdb) { return 0; }
  if(!_zchrom) { return 0; }
  if(_zsegment.znode<=0) { return 0; }
  //printf("test_next_znode\n");

  long size=0;
  //first time to get from system offset table
  if(_next_znode<=0) { _next_znode = _zsegment.znode; }

  zdxnode *znode = _zdxdb->fetch_znode(_next_znode);
  if(!znode) { return 0; }
  //printf("[%ld] blob_size %d\n", _next_znode, znode->blob_size);
  _next_znode = znode->next_znode;
  //printf("blob [%s]\n", znode->blob);
  
  //first uncompress data
  uint32_t uncompress_buffer_len;
  memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
  //fprintf(stderr, "uncompress_buffer_len %d\n", uncompress_buffer_len);
  
  size = uncompress_buffer_len;
  //size = znode->blob_size;
  
  if(_compress_buffer == NULL) {
    _compress_buflen = 10240; //10kb;
    _compress_buffer = (char*)malloc(_compress_buflen);
    printf("expand buffer to %ld\n", _compress_buflen);
  }
  if(uncompress_buffer_len+1 > _compress_buflen) {
    _compress_buflen = ((uncompress_buffer_len+1)/10240 + 1) * 10240; //multiples of 10kb;
    _compress_buffer = (char*)realloc(_compress_buffer, _compress_buflen);
    printf("expand buffer to %ld\n", _compress_buflen);
  }
  bzero(_compress_buffer, _compress_buflen);
  
  // LZ4 uncompress
  int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), _compress_buffer, uncompress_buffer_len);
  if(sinkint < 0) { 
    fprintf(stderr, "zdxstream error uncompressing segment znode\n");
    _next_znode = -1;
    return 0;    
  }
  
  /*
  uLongf buflen = uncompress_buffer_len;
  if(uncompress((Bytef*)_compress_buffer, &buflen, 
                (Bytef*)(znode->blob+sizeof(uint32_t)), 
                znode->blob_size-sizeof(uint32_t)) != Z_OK) {
    fprintf(stderr, "zdxstream error uncompressing segment znode\n");
    _next_znode = -1;
    return 0;
  }
   */
  
  free(znode);

  
  //printf("uncompressed xml string %ld bytes\n", buflen);
  //printf("uncompressed xml string %ld bytes\n", strlen(config_text));
  //printf("%s", config_text);
  
  //then parse XML
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(_compress_buffer);
  root_node = doc.first_node();
  if(!root_node || (root_node->name() != string("zdx"))) { 
    fprintf(stderr, "zdxsegment failed to parse xml\n");
    return false; 
  }

  // feature parsing
  if((node = root_node->first_node("feature")) != NULL) { 
    while(node) {
      EEDB::Feature *feature = EEDB::Feature::realloc();
      if(feature->init_from_xml(node)) {
        if(_region_start>0 && feature->chrom_end()<_region_start) {
          //printf("skip feature\n");
        } else if(_region_end>0 && feature->chrom_start()>_region_end) {
          //printf("skip feature\n");
        } else {
          //printf("have feature\n");
          feature->chrom(_chrom);
          //feature->retain();
          //_streambuffer->add_object(feature);
        }
      }
      feature->release();
      node = node->next_sibling("feature");
    }    
  }      
  //free(config_text);
  
  if(_next_znode==0) { return 0; }
  return size;  
}


bool  EEDB::ZDX::ZDXsegment::znode_stats() {
  if(!_zdxdb) { return false; }
  if(!_zchrom) { return false; }
  //if(_zsegment.znode<=0) { return false; }  //error because segment is not ready/built
  
  _region_start   = -1;
  _region_end     = -1;
  
  if(_streambuffer) {
    _streambuffer->release_objects();
    _streambuffer->release();
    _streambuffer = NULL;
  }
  
  //first time to get from system offset table
  _next_znode = _zsegment.znode;
  _streambuffer = new EEDB::SPStreams::StreamBuffer();
  
  long znode_count=0;
  long feat_count=0;
  long chunk_count=0;
  
  //fprintf(stderr, "%s\n", xml().c_str());
  
  //<0 is building, =0 is unbuiilt, 1-100 are built but no znode, >100 has znode
  if(_next_znode>=1 && _next_znode<=100) { _next_znode = -1; return true; } //empty segment
  
  while(_next_znode>0 || _next_znode < -100) {
    if(_next_znode>=1 && _next_znode<=100) { _next_znode = -1; continue; } //empty segment
    //<0 is building, =0 is unbuiilt, 1-100 are built but no znode, >100 has real znode
    
    _next_znode = llabs(_next_znode); //load the claimed and building nodes too
    zdxnode *znode = _zdxdb->fetch_znode(_next_znode);
    if(!znode) { break; }

    znode_count++;
    char buf1[10];
    bzero(buf1,10);
    strncpy(buf1, znode->content_format_code, 8);
    fprintf(stderr, "  znode[%ld] %s : %d bytes", _next_znode, buf1, znode->blob_size);

    _next_znode = znode->next_znode;

    //get uncompress_buffer_len
    uint32_t uncompress_buffer_len;
    memcpy(&uncompress_buffer_len, znode->blob, sizeof(uint32_t));
    
    if(_compress_buffer == NULL) {
      _compress_buflen = 10240; //10kb;
      _compress_buffer = (char*)malloc(_compress_buflen);
    }
    if(uncompress_buffer_len+1 > _compress_buflen) {
      _compress_buflen = ((uncompress_buffer_len+1)/10240 + 1) * 10240; //multiples of 10kb;
      _compress_buffer = (char*)realloc(_compress_buffer, _compress_buflen);
    }
    bzero(_compress_buffer, _compress_buflen);
    
    // LZ4 uncompress
    int sinkint = LZ4_uncompress((char*)(znode->blob+sizeof(uint32_t)), _compress_buffer, uncompress_buffer_len);
    if(sinkint < 0) {
      fprintf(stderr, "zdxstream error uncompressing segment znode\n");
      _next_znode = -1;
      break;
    }
    free(znode);
    
    //then parse XML
    rapidxml::xml_document<>  doc;
    rapidxml::xml_node<>      *node, *root_node;
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(_compress_buffer);
    root_node = doc.first_node();
    if(!root_node || (root_node->name() != string("zdx"))) {
      fprintf(stderr, "zdxsegment failed to parse xml\n");
      break;
    }
    
    // feature
    if((node = root_node->first_node("feature")) != NULL) {
      long fc=0;
      while(node) {
        fc++;
        node = node->next_sibling("feature");
      }
      fprintf(stderr, " : %ld features", fc);
      feat_count += fc;
    }
    // chrom_chunk
    if((node = root_node->first_node("chrom_chunk")) != NULL) {
      long cc=0;
      while(node) {
        cc++;
        node = node->next_sibling("chrom_chunk");
      }
      fprintf(stderr, " : %ld chunks", cc);
      chunk_count += cc;
    }
    fprintf(stderr, "\n");
  }
  //fprintf(stderr, "  %ld feat : %ld chunks\n", feat_count, chunk_count);
  

  _streambuffer->release_objects();
  _streambuffer->release();
  _streambuffer = NULL;
  
  return true;
}



