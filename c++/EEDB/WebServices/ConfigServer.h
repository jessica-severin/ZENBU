/* $Id: ConfigServer.h,v 1.31 2018/03/11 00:50:10 severin Exp $ */

/***

NAME - EEDB::WebServices::ConfigServer

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
ConfigServer is short hand for Signal-Process-Stream

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

#ifndef _EEDB_WEBSERVICES_CONFIGSERVER_H
#define _EEDB_WEBSERVICES_CONFIGSERVER_H

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
#include <EEDB/Configuration.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace WebServices {

class ConfigServer : public WebBase {
  public:  //global class level
    static const char*  class_name;

  public:
    ConfigServer();             // constructor
   ~ConfigServer();             // destructor
    void init();                // initialization method

    void   display_info();
    string display_desc();
    string display_contents();

    string xml_start();
    string xml_end();
    string simple_xml();
    string xml();

    bool    process_url_request();
    void    process_xml_parameters();
    void    show_api();

    EEDB::SPStreams::FederatedSourceStream*  source_stream();    

    void    show_config_xml();
    void    show_config_list();
    void    search_configs();
    void    register_config();
    void    show_user_last_config();
    void    delete_config_xml();
    void    move_config_collaboration();
  
    void    validate_uuid();
    void    show_fixed_id_editors();
    void    change_fixed_id_editor_mode();
    void    change_fixed_id_editor(string mode);

    EEDB::Configuration*          get_config_uuid(string uuid);
    EEDB::FeatureSource*          get_config_source(string collab_uuid, string configtype);
    vector<EEDB::Configuration*>  get_configs_search();

  //internal variables and methods, should not be considered open API
  protected:
    map< string, map<string, bool> >   _global_source_counts;  //[class][uuid]=bool
    map<string, EEDB::Collaboration*>  _peer_uuid_2_collaboration;
    char*                              _xml_text;
    rapidxml::xml_document<>*          _param_doc;
    void*                              _config_node;
    void*                              _svg_node;
  
    EEDB::Feature*        _get_config_basename();
    void                  _register_view_config();  
    void                  _register_track_config();
    void                  _register_script_config();
    void                  _register_user_annotation();
    void                  _register_reports_config();
    string                _create_date_string();
    void                  _print_config_xml(EEDB::Feature *feature);

};

};  // WebServices namespace

};  // EEDB namespace

#endif
