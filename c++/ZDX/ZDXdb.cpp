/*  $Id: ZDXdb.cpp,v 1.20 2014/10/22 07:05:12 severin Exp $ */

/*******

NAME - ZDX::ZDXdb

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
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <zlib.h>
#include <boost/algorithm/string.hpp>
#include <boost/algorithm/string/replace.hpp>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>

#include <ZDX/ZDXdb.h>


using namespace std;

const char*  ZDX::ZDXdb::class_name = "ZDX::ZDXdb";



////////////////////////////////////////////////////////////////////////////////////////////


ZDX::ZDXdb::ZDXdb() {
  init();
}

ZDX::ZDXdb::~ZDXdb() {
  disconnect();
}

void ZDX::ZDXdb::init() {
  _classname = ZDX::ZDXdb::class_name;
  _zdx_fd = -1;
  _disconnect_count = 0;
  _retain_count = 1;
  _mode = ZDXNONE;
  
  bzero(&(_header), sizeof(zdx_header));
}


void ZDX::ZDXdb::xml(string &xml_buffer) {
  xml_buffer += "<zxd>";
  xml_buffer += "/<zxd>";
}

//////////////////////////////////////////////////////////////////////////////////////////////////


void ZDX::ZDXdb::retain() {
  _retain_count++;
  //fprintf(stderr, "[%s] retain(%ld)\n", _classname, _retain_count);
}

void ZDX::ZDXdb::release() {
  _retain_count--;
  if(_retain_count == 0) { delete this; }
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// creation, open, connect, disconnect of new ZDXdb instances
//
//////////////////////////////////////////////////////////////////////////////////////////////////


ZDX::ZDXdb*   ZDX::ZDXdb::create_new(string path, string magic) {
  ZDXdb*  zdxdb = new ZDX::ZDXdb();

  zdxdb->_zdx_path = path;

  strncpy(zdxdb->_header.magic, magic.c_str(), 15); //\0 terminated
  
  boost::uuids::uuid u = boost::uuids::uuid(boost::uuids::random_generator()());
  int i=0;
  boost::uuids::uuid::const_iterator i_data;
  for(i_data = u.begin(); i_data!=u.end(); ++i_data, ++i) {
    zdxdb->_header.uuid[i] = static_cast<unsigned char>(*i_data);
    //printf("%d [%d]\n", i, bytes[i]);
  }
  
  //create file and write header
  zdxdb->_zdx_fd = open(path.c_str(), O_CREAT | O_TRUNC | O_RDWR, 0664);
  if(zdxdb->_zdx_fd == -1) { 
    fprintf(stderr, "zdx error : can't create file [%s]\n", path.c_str()); 
    zdxdb->release();
    return NULL; //error
  }
  
  //use write lock and fstat to see if there is race condition on creating file
  //if I got the first write-lock the file will be zero size

  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(zdxdb->_zdx_fd, F_SETLKW, &fl);  // set lock and wait

  struct stat stbuf;
  if(fstat(zdxdb->_zdx_fd, &stbuf) == 0) {
    if(stbuf.st_size == 0) {
      // write out zdx_header 
      write(zdxdb->_zdx_fd, &(zdxdb->_header), sizeof(zdx_header));
      fprintf(stderr, "ZDXdb::create_new %s - got write lock\n", path.c_str());
    }
  }
  
  //unlock
  fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
  fcntl(zdxdb->_zdx_fd, F_SETLK, &fl);  /* set the region to unlocked */

  zdxdb->disconnect();
    
  return zdxdb;
}


ZDX::ZDXdb*   ZDX::ZDXdb::open_zdx(string path) {
  //to open for reading or appending data
  struct stat stbuf;
  if(stat(path.c_str(), &stbuf) == -1) { 
    //fprintf(stderr, "ZDXdb::open_zdx error: file %s does not exist\n", path.c_str());
    return NULL; 
  }

  ZDXdb*  zdxdb = new ZDX::ZDXdb();

  zdxdb->_zdx_path = path;

  if(zdxdb->connect(ZDXREAD) == -1) {
    fprintf(stderr, "ZDXdb::open_zdx error: failed to open file %s\n", path.c_str());
    zdxdb->release();
    return NULL; //error
  }  
  return zdxdb;
}


int  ZDX::ZDXdb::connect(zdx_mode mode) {
  //to open for reading or append data
  if(_mode == mode) { return _zdx_fd; }
  
  disconnect();
  
  if(mode == ZDXREAD) {
    _zdx_fd = open(_zdx_path.c_str(), O_RDONLY | O_NONBLOCK, 0644);
    if(_zdx_fd == -1) { 
      fprintf(stderr, "zdx error opening file [%s]\n", _zdx_path.c_str());
      return -1;
    }    
    //read header
    if(read(_zdx_fd, &(_header), sizeof(zdx_header)) != sizeof(zdx_header)) { 
      fprintf(stderr, "zdx can't read header [%s]\n", _zdx_path.c_str()); 
      return -1;
    }
    _mode = ZDXREAD;
  }

  if(mode == ZDXWRITE) {
    _zdx_fd = open(_zdx_path.c_str(), O_RDWR, 0644);
    if(_zdx_fd == -1) { 
      fprintf(stderr, "zdx error opening file [%s]\n", _zdx_path.c_str());
      return -1;
    }
    _mode = ZDXWRITE;
  }
  return _zdx_fd;
}


void  ZDX::ZDXdb::disconnect() {
  if(_zdx_fd != -1) {
    close(_zdx_fd);
    _zdx_fd = -1;
    _disconnect_count++;
  }
  _mode = ZDXNONE;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// attributes interface
//
//////////////////////////////////////////////////////////////////////////////////////////////////

ZDX::zdx_header*   ZDX::ZDXdb::header() {
  return &(_header);
}

string  ZDX::ZDXdb::path() {
  return _zdx_path;
}

string  ZDX::ZDXdb::magic() {
  string mgc = _header.magic;
  return mgc;
}


string ZDX::ZDXdb::uuid_hexstring() {
  char hex[] = "0123456789ABCDEF";
  char str[40];
    
  memset(str, 0, 40);
  int idx=0;
  for(int i=0; i<=15; i++) {
    unsigned int val = static_cast<unsigned char>(_header.uuid[i]);
    unsigned int nib1 = (val /16) &15;
    unsigned int nib2 = val & 15;
    //printf("%d [%d] [%d %d]\n", i, val, nib1, nib2);
    
    str[idx++] = hex[nib1];
    str[idx++] = hex[nib2];
    if (i == 3 || i == 5 || i == 7 || i == 9) { str[idx++] = '-'; }
  }
  
  string hexstring = str;
  //printf("%s\n", hexstring.c_str());
  return hexstring;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// subsystem offset table
//
//////////////////////////////////////////////////////////////////////////////////////////////////


int64_t  ZDX::ZDXdb::subsystem_offset(int subsys_num) {
  if(subsys_num<0 || subsys_num>32) { return 0; }
  if(connect(ZDXREAD) == -1) { return 0; }
  return _header.subsys_offset[subsys_num];
}

bool  ZDX::ZDXdb::write_subsystem_offset(int subsys_num, int64_t offset) {
  if(subsys_num<0 || subsys_num>32) { return false; }
  if(connect(ZDXWRITE) == -1) { return false; }

  _header.subsys_offset[subsys_num] = offset;

  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  

  fcntl(_zdx_fd, F_SETLKW, &fl);  // set lock and wait

  lseek(_zdx_fd, 32 + (subsys_num*sizeof(int64_t)), SEEK_SET);  
  write(_zdx_fd, &(offset), sizeof(int64_t));

  fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
  fcntl(_zdx_fd, F_SETLK, &fl);  /* set the region to unlocked */

  return true;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// building interface
//
//////////////////////////////////////////////////////////////////////////////////////////////////

ZDX::zdxnode*  ZDX::ZDXdb::allocate_znode(long blob_size) {
  ZDX::zdxnode* node = (ZDX::zdxnode*)malloc(blob_size + sizeof(zdxnode));
  bzero(node, blob_size + sizeof(zdxnode));
  node->blob_size = blob_size;
  return node;
}


void  ZDX::ZDXdb::release_znode(zdxnode* node) {
  free(node);
}


int64_t  ZDX::ZDXdb::write_znode(zdxnode* node) {
  //write zdxnode onto end of the file
  if(!node) { return false; }
  
  if(connect(ZDXWRITE) == -1) { return false; }

  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(_zdx_fd, F_SETLKW, &fl);  // set lock and wait
    
  int64_t offset = lseek(_zdx_fd, 0, SEEK_END);
  uint64_t ws = write(_zdx_fd, node, node->blob_size + sizeof(zdxnode));

  fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
  fcntl(_zdx_fd, F_SETLK, &fl);  /* set the region to unlocked */

  if(ws != node->blob_size + sizeof(zdxnode)) { offset = -1; }
  return offset;
}


bool  ZDX::ZDXdb::update_znode_next(int64_t znode_offset, int64_t next_znode_offset) {
  //adjust the next_znode point for znode at znode_offset  
  if(connect(ZDXWRITE) == -1) { return false; }
  
  //next_znode is first int64_t bytes of the znode record
  struct flock fl;
  fl.l_type   = F_WRLCK;  /* F_RDLCK, F_WRLCK, F_UNLCK    */
  fl.l_whence = SEEK_SET; /* SEEK_SET, SEEK_CUR, SEEK_END */
  fl.l_start  = 0;        /* Offset from l_whence         */
  fl.l_len    = 0;        /* length, 0 = to EOF           */
  fl.l_pid    = getpid(); /* our PID                      */  
  
  fcntl(_zdx_fd, F_SETLKW, &fl);  // set lock and wait
  
  if(lseek(_zdx_fd, znode_offset, SEEK_SET) != znode_offset) { return false; }  
  if(write(_zdx_fd, &(next_znode_offset), sizeof(int64_t)) != sizeof(int64_t)) { return false; }

  fl.l_type   = F_UNLCK;         /* tell it to unlock the region */
  fcntl(_zdx_fd, F_SETLK, &fl);  /* set the region to unlocked */

  return true;
}


ZDX::zdxnode*  ZDX::ZDXdb::fetch_znode(int64_t offset) {
  //fetching from db 
  if(connect(ZDXREAD) == -1) { return NULL; }

  //read znode header to get blob_size
  lseek(_zdx_fd, offset, SEEK_SET);  
  ZDX::zdxnode tnode;
  if(read(_zdx_fd, &(tnode), sizeof(ZDX::zdxnode)) != sizeof(ZDX::zdxnode)) { 
    fprintf(stderr, "zdx can't read znode header\n"); 
    return NULL;
  }
  
  //malloc real znode and copy header over
  long fullsize = tnode.blob_size + sizeof(zdxnode);
  ZDX::zdxnode* node = (ZDX::zdxnode*)malloc(fullsize);
  bzero(node, fullsize);
  
  //read again with blob_size
  lseek(_zdx_fd, offset, SEEK_SET);  
  if(read(_zdx_fd, node, fullsize) != fullsize) { 
    fprintf(stderr, "zdx can't read znode blob\n"); 
    free(node);
    return NULL;
  }
  
  return node;
}


