/* $Id: TrackCacheBuilder.h,v 1.55 2014/11/10 05:31:10 severin Exp $ */

/***

NAME - EEDB::Tools::TrackCacheBuilder

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
RegionServer is short hand for Signal-Process-Stream

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

#ifndef _EEDB_TOOLS_TRACKCACHEBUILDER_H
#define _EEDB_TOOLS_TRACKCACHEBUILDER_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <EEDB/SPStream.h>
#include <EEDB/User.h>
#include <EEDB/Feature.h>
#include <EEDB/TrackCache.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/Tools/OSCTableGenerator.h>
#include <EEDB/WebServices/RegionServer.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
  
namespace Tools {

  class TrackCacheBuilder : public EEDB::WebServices::RegionServer {
  
  public:  //global class level
    static const char*  class_name;
    static bool         building_segments;

  public:
    TrackCacheBuilder();      // constructor
    ~TrackCacheBuilder();     // destructor
    void init();              // initialization method

    bool    parse_config_file(string path);  //federation configuration 

    bool    init_from_track_configXML(string configXML);
    bool    init_from_track_cache(string track_uuid);
    
    EEDB::TrackCache*     track_cache();    
    bool                  build_trackcache_sources();
    bool                  autobuild_track_cache();
    bool                  security_check();

    EEDB::SPStream*       trackbuilder_stream();
    bool                  testbuild_region();
    void                  postprocess_parameters();

    //db update/logging methods
    bool                  store_new();
    bool                  update_work_done(int increment_count);
    bool                  update_finished(string status);
    

  //internal variables and methods, should not be considered open API
  protected:
    EEDB::SPStream*                          _track_stream;
    EEDB::TrackRequest*                      _current_request;
    
    EEDB::ZDX::ZDXsegment*                   _request_build_segment();

    long                                     _build_zdxsegment(EEDB::ZDX::ZDXsegment* zseg);
    EEDB::SPStreams::FederatedSourceStream*  _superuser_federated_source_stream();
    void                                     _trackbuilder_setup_proxy_streams();
    bool                                     _access_check();
    

};

};  // Tools namespace

};  // EEDB namespace

#endif
