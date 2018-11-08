/* $Id: WebBase.h,v 1.63 2016/06/20 06:34:28 severin Exp $ */

/***

NAME - EEDB::WebBase

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
WebBase is short hand for Signal-Process-Stream

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

#ifndef _EEDB_WEBSERVICES_WEBBASE_H
#define _EEDB_WEBSERVICES_WEBBASE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <EEDB/SPStream.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/WebServices/zenbu_common.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace WebServices {

class WebBase : public MQDB::DBObject {
  public:  //global class level
    static const char*         zenbu_version;
    static map<string,string>  global_parameters;
    static const char*         class_name;

  public:
    WebBase();             // constructor
   ~WebBase();             // destructor
    void init();           // initialization method

    void display_info();
    string display_desc();
    string display_contents();

    string xml_start();
    string xml_end();
    string simple_xml();
    string xml();

    bool init_config(string path);
    bool parse_config_file(string path);
    bool process_url_request();
    void disconnect();

    void                 init_service_request();
    void                 get_url_parameters();
    void                 get_post_data();
    void                 postprocess_parameters();
    bool                 execute_request();
    bool                 connect_userDB();

    EEDB::SPStreams::FederatedSourceStream*  source_stream();    
    EEDB::SPStreams::FederatedSourceStream*  secured_federated_source_stream();
    EEDB::SPStreams::FederatedSourceStream*  superuser_federated_source_stream();

    void                                     set_federation_seeds(EEDB::SPStream*  spstream);

    EEDB::Assembly*  find_assembly(string assembly_name);

    void get_webservice_url();
    void get_session_user();
    void save_session();
    void delete_session();
  
    void hmac_authorize_user();

    void show_api();
    void show_status();
    void show_peers();
    void show_single_object();
    void show_objects();
    void show_chromosomes();
    void show_system_load();
  
    bool print_object_xml(MQDB::DBObject *obj);
  
    // for tools
    MQDB::Database*       userDB();
    EEDB::Collaboration*  public_collaboration();
    EEDB::Collaboration*  curated_collaboration();
    EEDB::Collaboration*  get_collaboration(string uuid);
  
    vector<EEDB::Peer*>   seed_peers();
    EEDB::Peer*           autosave_peer();

    //used for debugging
    void set_post_data(string value);  
    void set_parameter(string tag, string value);
    void set_user_profile(EEDB::User* user);
  
    bool   check_overload(double load_limit);

  //internal variables and methods, should not be considered open API
  protected:
    map<string,string>   _parameters;
    string               _session_name;
    map<string,string>   _session_data;
    string               _post_data;
    string               _server_name;
    string               _web_url;
    string               _web_uuid;
    long int             _connection_count;
    int                  _peer_search_depth;
    string               _default_genome;

    string               _userDB_url;
    MQDB::Database*      _userDB;
    string               _user_admin_password;
    EEDB::User*          _user_profile;
    EEDB::Collaboration* _public_collaboration;
    EEDB::Collaboration* _curated_collaboration;
    EEDB::Peer*          _autosave_peer;

    struct timeval       _launch_time;
    struct timeval       _starttime;

    vector<EEDB::Peer*>  _seed_peers;
    vector<string>       _seed_urls;
    vector<string>       _local_mirror_urls;
    string               _collaboration_filter;

    map<string, bool>    _filter_source_ids;
    map<string, bool>    _filter_peer_ids;
    vector<string>       _filter_source_names;
    vector<string>       _filter_ids_array;
    
    map<string, EEDB::Peer*>   _known_remote_peers;

    EEDB::SPStreams::FederatedSourceStream*  _source_stream;

    //my $global_source_cache = {};
    //my $global_source_counts = {"Experiment"=>0, "FeatureSource"=>0, "ExpressionDatatype"=>0 };

    void                 init_db();


};

};  // WebServices namespace

};  // EEDB namespace

#endif
