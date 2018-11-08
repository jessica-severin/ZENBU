/* $Id: RegionServer.h,v 1.56 2015/02/05 05:58:21 severin Exp $ */

/***

NAME - EEDB::WebServices::RegionServer

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

#ifndef _EEDB_WEBSERVICES_REGIONSERVER_H
#define _EEDB_WEBSERVICES_REGIONSERVER_H

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
#include <EEDB/WebServices/MetaSearch.h>
#include <EEDB/WebServices/ConfigServer.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/Tools/OSCTableGenerator.h>
#include <EEDB/SPStreams/ObjectCount.h>
#include <EEDB/SPStreams/CachePoint.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

  class TrackDef : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;
    
  public:  
    TrackDef();        // constructor
    ~TrackDef();       // destructor
    void init();       // initialization method
    
    string               name;
    string               track_uuid;
    map<string, bool>    source_ids;
    string               source_outmode;
    string               expression_datatype;
  };
  
  
namespace WebServices {

  class RegionServer : public MetaSearch {
  
  public:  //global class level
    static const char*  class_name;

  public:
    RegionServer();           // constructor
   ~RegionServer();           // destructor
    void init();              // initialization method

    bool    init_from_track_configXML(string configXML);
    bool    init_from_track_cache(string track_uuid);

    bool                                     process_url_request();
    void                                     show_api();

    void                                     process_xml_parameters();
    void                                     postprocess_parameters();
    void                                     parse_processing_stream(void *xml_node);
    bool                                     execute_request();

    EEDB::SPStream*                          region_stream();
    
    void                                     show_debug();
    void                                     show_source_stream();
    void                                     show_region_features();
    void                                     show_region_stats();
    void                                     show_region_sequence();
    void                                     genome_download();
    void                                     show_datasources();
    void                                     show_trackcache_stats();
    void                                     request_trackcache_build();
    void                                     show_securecheck();
    void                                     send_trackcache_zdx();
    void                                     show_trackcache_list();

    string                                   generate_configXML();
    EEDB::TrackCache*                        track_cache(); //generates or fetches based on region config
    
    bool                                     check_track_cache(string assembly_name, string chrom_name, long start, long end);
    bool                                     security_check();
    long                                     secure_access_check(map<string, bool> &source_hash);


  //internal variables and methods, should not be considered open API
  protected:
    map< string, map<string, bool> >   _global_source_counts;  //[class][uuid]=bool
    void                               _search_configs();
    EEDB::SPStream*                    _stream_processing_head;
    EEDB::SPStream*                    _stream_processing_tail;
    long int                           _region_start;
    long int                           _region_end;
    long int                           _display_width;
    long int                           _total_count, _raw_count;  //for output stats
    EEDB::Tools::OSCTableGenerator*    _osctable_generator;
    EEDB::SPStreams::ObjectCount*      _raw_objcounter;
    string                             _output_buffer;
    EEDB::TrackCache*                  _track_cache;
    long int                           _feature_limit_count;

    void                               _output_header(EEDB::SPStream* stream);
    void                               _output_footer();
    void                               _output_buffer_send(bool check);

    
    map<string, EEDB::TrackDef*>       _processing_datastreams;
    void                               _proxy_setup_processing_stream();
    vector<string>                     _get_track_uuid_datasource_ids(string track_uuid);
    EEDB::SPStream*                    _append_expression_histogram_binning(EEDB::SPStream *stream);
    void                               _direct_show_region();
    bool                               _trackcache_show_region();
    bool                               _build_trackcache_chroms();
    string                             _generate_configXML(EEDB::SPStream* script_stream);

    void                               _cachepoint_setup_processing_stream(EEDB::SPStream* spstream);
    EEDB::SPStreams::CachePoint*       _check_cachepoint(EEDB::SPStream* spstream);
    
    void                               _remote_trackcache_setup();
    void                               _get_all_cachpoint_hashkeys(EEDB::SPStream*  spstream, map<string,bool>& hashkeys);

    bool                               _check_overload(double load_limit);

    ConfigServer*                      _config_server;

};

};  // WebServices namespace

};  // EEDB namespace

#endif
