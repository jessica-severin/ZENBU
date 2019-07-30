/* $Id: Peer.h,v 1.39 2019/03/26 07:10:59 severin Exp $ */

/***

NAME - EEDB::Peer

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

***/

#ifndef _EEDB_PEER_H
#define _EEDB_PEER_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/SPStreams/SourceStream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

  namespace SPStreams {
    //forward declarations
    class RemoteServerStream;
  };


class Peer : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Peer();                 // constructor
   ~Peer();                 // destructor
    void init();            // initialization method
    Peer* copy();

    static EEDB::Peer*  new_from_url(string url);
    static EEDB::Peer*  new_from_xml(void *xml_node);  //constructor using a rapidxml node
    static EEDB::Peer*  create_self_peer_for_db(MQDB::Database *db);

    bool operator<(const EEDB::Peer& b);

    //get atribute
    string       driver();
    const char*  uuid();
    string       alias();
    string       db_url();
    int          federation_depth();
    long         source_file_size();
    string       source_md5sum();

    //set atribute
    void       create_uuid();
    void       alias(string value);
    void       db_url(string value); 
    void       federation_depth(int value);
    void       persistent(bool value);
  
    //remote server control methods
    void       set_uuid(string uuid);
    void       remote_server_stream(EEDB::SPStreams::RemoteServerStream *stream);
    bool       is_remote();

    void display_info();
    string display_desc();
    string display_contents();

    MQDB::Database*                   peer_database();
    EEDB::SPStreams::SourceStream*    source_stream();

    //
    bool             store(MQDB::Database *db);
    void             disconnect();    

    void             current_web_url();
    void             free_source_stream();
    void             uncache_stream_sources();
    
    bool             is_valid();
    bool             retest_is_valid();
   
    EEDB::Peer*      find_peer(string uuid, int max_depth);
    bool             find_peers(map<string,EEDB::Peer*> &uuid_peers, int max_depth);
    void             all_network_peers(int max_depth, map<string, EEDB::Peer*> &uuid_peers);

    EEDB::Peer*      cache_find_peer(string uuid, int max_depth);
    bool             cache_find_peers(map<string, EEDB::Peer*> &uuid_peers, int max_depth);


    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject*  create(map<string, dynadata> &row_map, MQDB::Database* db);
    void              init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static vector<DBObject*>  fetch_all(MQDB::Database *db);
    static EEDB::Peer*        fetch_by_uuid(MQDB::Database *db, string uuid);
    static EEDB::Peer*        fetch_by_name(MQDB::Database *db, string name);
    static EEDB::Peer*        fetch_by_alias(MQDB::Database *db, string name);
    static EEDB::Peer*        fetch_self(MQDB::Database *db);
    
    // global variable of the current webservice URL to differentiate local vs remote peers.
    static void set_current_web_url(string value);
  
    // global cache interface    
    static void           set_cache_behaviour(bool value);
    static Peer*          check_cache(string &uuid);
    static int            global_cache_size();
    static vector<Peer*>  global_cached_peers();
    static void           add_to_cache(Peer *obj);
  
    
  //private and protected internal variables and methods
  private:
    static string               global_current_web_url;
    static bool                 global_should_cache;
    static map<string, Peer*>   global_uuid_cache;


  protected:
    string                          _driver;
    string                          _alias;
    string                          _db_url;
    int                             _federation_depth;  
    int                             _database_is_valid;
    bool                            _persistent;
    MQDB::Database*                 _peer_external_database;
    EEDB::SPStreams::SourceStream*  _source_stream;
    map<string, EEDB::Peer*>        _neighbor_peers;
    

   private:
    void       _connect_to_source_stream();
    bool       _connect_via_mqdb();
    bool       _connect_via_oscdb();
    bool       _connect_via_bamdb();
    bool       _connect_via_remote_stream();
    bool       _connect_via_zdx();

    void       _peer_network_search();
    bool       _multipeer_network_search(map<string, EEDB::Peer*> &uuid_peers,  
                                         int max_depth, 
                                         map<string, bool> &network_search_flag);
    bool       _multipeer_neighbor_search(map<string, EEDB::Peer*> &uuid_peers, 
                                         int max_depth, 
                                         map<string, bool> &network_search_flag);
    bool       _multipeer_add_testdone(map<string, EEDB::Peer*> &uuid_peers, EEDB::Peer *peer);
    bool       _multipeer_test_done(map<string, EEDB::Peer*> &uuid_peers);

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    void   _delete();
    bool   _is_remote;

};

};   //namespace

#endif
