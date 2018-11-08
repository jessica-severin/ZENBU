/* $Id: CachePoint.h,v 1.7 2016/06/08 06:50:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::CachePoint

SYNOPSIS

DESCRIPTION

 infrastructure module which interacts with the TrackCache system and ZDX cache files
 to provide smart mid-stream caching
 
CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
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

#ifndef _EEDB_SPSTREAMS_CACHEPOINT_H
#define _EEDB_SPSTREAMS_CACHEPOINT_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/SPStream.h>
#include <EEDB/ZDX/ZDXstream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace SPStreams {

class CachePoint : public EEDB::SPStream {
  public:  //global class level
    static const char*  class_name;

    //class levels methods set global variables
    static void  set_current_user(EEDB::User *user); 
    static void  set_userDB(MQDB::Database *db);

    CachePoint();                // constructor
    CachePoint(void *xml_node);  // constructor using a rapidxml <spstream> description
   ~CachePoint();                // destructor
    void init();                 // initialization method    

    //set methods
    void track_cache(EEDB::TrackCache* cache);
    void userDB(MQDB::Database* db);

    //get methods
    EEDB::TrackCache*   track_cache();
    MQDB::Database*     userDB();

  
  //internal variables and methods, should not be considered open API
  protected:
    EEDB::TrackCache*      _track_cache;
    EEDB::ZDX::ZDXstream*  _zdxstream;
    
    bool                   _check_track_cache(string assembly_name, string chrom_name, long start, long end);

  private: //class level
    static EEDB::User*           _user;
    static MQDB::Database*       _userDB;

  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);  

    void               _disconnect();
    void               _reset_stream_node();
  
    void               _stream_peers();
    void               _stream_data_sources(string classname, string filter_logic);
    MQDB::DBObject*    _fetch_object_by_id(string fid);
    void               _stream_features_by_metadata_search(string filter_logic);
    bool               _stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end);
    void               _stream_chromosomes(string assembly_name, string chrom_name);
    
    MQDB::DBObject*    _next_in_stream();
  
};

};   //namespace SPStreams

};   //namespace EEDB


#endif
