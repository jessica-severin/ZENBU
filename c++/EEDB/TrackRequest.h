/* $Id: TrackRequest.h,v 1.17 2013/05/24 06:10:07 severin Exp $ */

/****
NAME - EEDB::TrackCache

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


#ifndef _EEDB_TRACKREQUEST_H
#define _EEDB_TRACKREQUEST_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <zlib.h>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/User.h>
#include <EEDB/ZDX/ZDXstream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {  
    
  class TrackRequest : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;
    
  public:
    TrackRequest();      // constructor
    ~TrackRequest();     // destructor
    void init();         // initialization method
        
    TrackCache*           track_cache();
    long                  track_cache_id() { return _track_cache_id; }
    string                track_hashkey();
    long                  user_id() { return _user_id; }
    string                track_name() { return _track_name; }
    string                view_uuid() { return _view_uuid; }
    string                assembly_name() { return _assembly_name; }
    string                chrom_name() { return _chrom_name; }
    long                  chrom_start() { return _chrom_start; }
    long                  chrom_end() { return _chrom_end; }
    long                  num_segs() { return _num_segs; }
    long                  unbuilt() { return _unbuilt; }
    bool                  send_email() { return _send_email; }
    string                request_date_string();

    void                  user_id(long value) { _user_id=value; }
    void                  track_name(string value) { _track_name = value; }
    void                  view_uuid(string value) { _view_uuid = value; }
    void                  assembly_name(string value) { _assembly_name=value; }
    void                  chrom_name(string value) { _chrom_name=value; }
    void                  chrom_start(long value) { _chrom_start=value; }
    void                  chrom_end(long value) { _chrom_end=value; }
    void                  num_segs(long value) { _num_segs=value; }
    void                  unbuilt(long value) { _unbuilt=value; }
    void                  send_email(bool value) { _send_email=value; }
    
    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      TrackRequest* obj = new EEDB::TrackRequest;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void  init_from_row_map(map<string, dynadata> &row_map);
    
    //
    // static member functions for object retrieval from database
    //
    static vector<DBObject*>        fetch_all(MQDB::Database *db);
    static vector<DBObject*>        fetch_all(EEDB::TrackCache *tc);
    static TrackRequest*            fetch_by_id(MQDB::Database *db, long int id);
    static vector<DBObject*>        fetch_by_user(EEDB::User *user);

    static TrackRequest*            fetch_best(EEDB::TrackCache *tc);
    static TrackRequest*            fetch_best(MQDB::Database *db);

    static string                   best_build_hashkey(MQDB::Database *db);

    bool                       store(EEDB::TrackCache *trackcache);
    bool                       update_unbuilt(long value);
    bool                       delete_from_db();

  protected:    
    EEDB::TrackCache*     _track_cache;
    long                  _track_cache_id;
    string                _hashkey;
    string                _track_name;
    string                _view_uuid;
    long                  _user_id;
    string                _assembly_name;
    string                _chrom_name;
    long                  _chrom_start;
    long                  _chrom_end;
    long                  _num_segs;
    long                  _unbuilt;
    bool                  _send_email;
    time_t                _request_time;


  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    string _display_desc();
    
  };
  

};   //namespace EEDB

#endif 
