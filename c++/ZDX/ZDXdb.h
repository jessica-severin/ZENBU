/* $Id: ZDXdb.h,v 1.10 2013/04/08 05:41:01 severin Exp $ */

/****
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

**************/


#ifndef _ZDX_ZDXDB_H
#define _ZDX_ZDXDB_H

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <zlib.h>

using namespace std;

namespace ZDX {
  
  typedef struct {
    char          magic[16];
    unsigned char uuid[16]; //128bit uuid
    int64_t       subsys_offset[32];  
  } zdx_header;  //280bytes
  
  typedef struct {
    int64_t    next_znode;  //64bit fseek offset
    int64_t    prev_znode;  //64bit fseek offset
    char       content_format_code[8];
    uint32_t   blob_size;   //max 4GB max per zdxnode
    char       blob[4];
  } zdxnode;
  
  typedef enum {ZDXREAD, ZDXWRITE, ZDXNONE}  zdx_mode;

  class ZDXdb {
    public: //API methods for user query
      //query interface, but also use superclass SourceStream and Stream APIs

      static const char*  class_name;

      ZDXdb();            // constructor
      ~ZDXdb();           // destructor
      void init();        // initialization method
          
      static ZDXdb*   create_new(string path, string magic);
      static ZDXdb*   open_zdx(string path); //to open existing zdx file

      int             connect(zdx_mode mode); //to open for reading or append data, returns fd
      void            disconnect();
          
      void            retain();
      void            release();
      long int        retain_count() { return _retain_count; }
  
      void            xml(string &xml_buffer);

      //ZDXdb attributes API
      string          path();
      string          magic();
      string          uuid_hexstring();
  
      zdx_header*     header();
    
      int64_t         subsystem_offset(int subsys_num);
      bool            write_subsystem_offset(int subsys_num, int64_t offset);

      // zdxnode API
      zdxnode*        allocate_znode(long blob_size);  //create new prior to write
      int64_t         write_znode(zdxnode* node);      //returns offset where node was written
      bool            update_znode_next(int64_t znode_offset, int64_t next_znode_offset);

      zdxnode*        fetch_znode(int64_t offset);     //fetching from db
      void            release_znode(zdxnode* node);
   

    protected: //variables      
      zdx_header                _header;
      int                       _zdx_fd;
      string                    _zdx_path;
      const char*               _classname;
      long int                  _disconnect_count;
      long int                  _retain_count;
      zdx_mode                  _mode;
    
      
  };
  
};   //namespace ZDX


#endif 
