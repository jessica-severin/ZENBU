/* $Id: TrackCache.h,v 1.35 2013/12/11 11:21:34 severin Exp $ */

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


#ifndef _EEDB_TRACKCACHE_H
#define _EEDB_TRACKCACHE_H

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
  
  class TrackCache : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;
    static string       cache_dir;
  
  public:
    TrackCache();                  // constructor
    TrackCache(void *xml_node);    // constructor using a rapidxml node
   ~TrackCache();                  // destructor
    void init();                   // initialization method

    //get atribute
    string                track_hashkey() { return _track_hashkey; }
    string                remote_server_url() { return _remote_server_url; }
    bool                  is_remote();
    time_t                last_access() { return _last_access; }
    long                  hit_count() { return _hit_count; }
    double                percent_complete() { return _percent_complete; }
    double                segment_buildtime() { return _seg_buildtime; }
    bool                  broken() { return _broken; }
    
    EEDB::MetadataSet*    metadataset();
    string                last_access_date_string();

    //set attribute
    void                  hit_count(long value) { _hit_count=value; }
    void                  remote_server_url(string value) { _remote_server_url= value; }

    //for building/extending internal stream database
    void                   track_configxml(string value);
    string                 track_configxml();
    EEDB::ZDX::ZDXstream*  zdxstream();
    EEDB::ZDX::ZDXsegment* request_build_segment(string assembly_name, string chrom_name, long start, long end);
    bool                   cache_file_exists();
    
    bool                   remote_sync_segment(string assembly, string chrom_name, long chrom_pos, EEDB::User* user);
    bool                   remote_sync_segment(EEDB::ZDX::ZDXsegment* zdxseg, EEDB::User* user);
    bool                   remote_sync_region(string assembly_name, string chrom_name, long int start, long int end, EEDB::User* user);

    //database methods
    bool    store(MQDB::Database *db);
    bool    store_metadata();
    bool    update_metadata();
    bool    log_location(EEDB::User *user, string asmb, string chrom, long start, long end);
    bool    update_buildstats(long numsegments, double buildtime);
    void    update_broken(bool value);
    void    update_remote_url(string url);

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      TrackCache* obj = new EEDB::TrackCache;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void  init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static TrackCache*       fetch_by_id(MQDB::Database *db, long int id);
    static TrackCache*       fetch_by_hashkey(MQDB::Database *db, string hashkey);
    static string            best_build_hashkey(MQDB::Database *db);
    static vector<DBObject*> fetch_all(MQDB::Database *db);


  protected:
    EEDB::MetadataSet      _metadataset;
    bool                   _metadata_loaded;
    time_t                 _last_access;
    string                 _track_hashkey;
    string                 _remote_server_url;
    long                   _hit_count;
    double                 _percent_complete;
    double                 _seg_buildtime;
    bool                   _broken;
    string                 _cache_file;
    EEDB::ZDX::ZDXstream*  _zdxstream;

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    string _display_desc();
  };
    
};   //namespace EEDB

#endif 
