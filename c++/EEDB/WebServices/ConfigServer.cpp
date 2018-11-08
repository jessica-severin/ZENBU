/* $Id: ConfigServer.cpp,v 1.123 2016/09/16 07:01:23 severin Exp $ */

/***

NAME - EEDB::SPStreams::ConfigServer

SYNOPSIS

DESCRIPTION

Specific subclass of WebBase which is focused on caching metadata from sources
in order to provide fast keyword logic searching

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


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
#include <sys/types.h>
#include <sys/mman.h>
//#include <yaml.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <rapidxml_print.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/Peer.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Chrom.h>
#include <EEDB/Feature.h>
#include <EEDB/Edge.h>
#include <EEDB/Expression.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/WebServices/ConfigServer.h>

#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 


using namespace std;
using namespace MQDB;

const char*               EEDB::WebServices::ConfigServer::class_name = "EEDB::WebServices::ConfigServer";

EEDB::WebServices::ConfigServer::ConfigServer() {
  init();
}

EEDB::WebServices::ConfigServer::~ConfigServer() {
  if(_xml_text) { free(_xml_text); }  
}

void _eedb_web_configserver_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::WebServices::ConfigServer*)obj;
}

void EEDB::WebServices::ConfigServer::init() {
  EEDB::WebServices::WebBase::init();
  _classname      = EEDB::WebServices::ConfigServer::class_name;
  _funcptr_delete = _eedb_web_configserver_delete_func;
  
  _xml_text = NULL;
  _param_doc = NULL;
  _config_node = NULL;
  _svg_node = NULL;
}

////////////////////////////////////////////////////////////////////////////////////////


void EEDB::WebServices::ConfigServer::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::WebServices::ConfigServer::display_desc() {
  string xml = "ConfigServer[";
  xml += _classname;
  xml += "]";
  return xml;
}

string EEDB::WebServices::ConfigServer::display_contents() {
  return display_desc();
}

string EEDB::WebServices::ConfigServer::xml_start() {
  string xml = "<webservice>";
  return xml;
}

string EEDB::WebServices::ConfigServer::xml_end() {
  return "</webservice>";
}

string EEDB::WebServices::ConfigServer::simple_xml() {
  return xml_start() + xml_end();
}

string EEDB::WebServices::ConfigServer::xml() {
  string xml = xml_start();
  xml += xml_end();
  return xml;
}


////////////////////////////////////////////////////////////////////////////

bool EEDB::WebServices::ConfigServer::process_url_request() {
  EEDB::WebServices::WebBase::init_service_request();
    
  EEDB::WebServices::WebBase::get_url_parameters();  //from super class
  
  get_post_data();
  if(!_post_data.empty()) { process_xml_parameters(); }

  //post process parameters
  EEDB::WebServices::WebBase::postprocess_parameters();

  if((_parameters.find("name")!=_parameters.end()) && (_parameters.find("mode")==_parameters.end())) { 
    _parameters["mode"] = "search"; 
    _parameters["filter"] = _parameters["name"]; 
  }
  if(_parameters.find("search")!=_parameters.end()) { 
    _parameters["mode"] = "search"; 
  }

  if(_parameters.find("uuid")!=_parameters.end()) { 
    if((_parameters["mode"] != "delete") && (_parameters["mode"] != "create_trackcache") &&
        (_parameters["mode"] != "moveconfig")) { _parameters["mode"] = "config"; }
  }
  if(_parameters.find("basename")!=_parameters.end()) { 
    _parameters["mode"] = "config";
  }

  if(_parameters.find("config_uuid")!=_parameters.end()) { 
    _parameters["mode"] = "config";
    _parameters["uuid"] = _parameters["config_uuid"]; 
  }

  if(_parameters.find("configtype")!=_parameters.end()) { 
    string cfg = _parameters["configtype"];
    _parameters["configtype"].clear();
     
    if(cfg == "view")   { cfg = "eeDB_gLyphs_configs"; }
    if(cfg == "glyphs") { cfg = "eeDB_gLyphs_configs"; }
    if(cfg == "gLyphs") { cfg = "eeDB_gLyphs_configs"; }
    if(cfg == "track")  { cfg = "eeDB_gLyph_track_configs"; }
    if(cfg == "script") { cfg = "ZENBU_script_configs"; }
    
    if((cfg == "eeDB_gLyphs_configs") or (cfg == "eeDB_gLyph_track_configs") or 
       (cfg == "ZENBU_script_configs") or (cfg == "ZENBU_user_annotations")) {
      _parameters["configtype"] = cfg;
    }
  }
  
  if(_parameters.find("sort")==_parameters.end()) { 
    _parameters["sort"] = "access";
    _parameters["sort_order"] = "desc";
  }

  ////////////////////////// 
  // now process
  //

  if(_parameters["mode"] == string("search")) {
    search_configs();
  } else if(_parameters["mode"] == string("config")) {
    show_config_xml();
  } else if(_parameters["mode"] == string("configs")) {
    show_config_list();
  } else if(_parameters["mode"] == string("last_session")) {
    show_user_last_config();
  } else if(_parameters["mode"] == string("delete")) {
    delete_config_xml();
  } else if(_parameters["mode"] == string("moveconfig")) {
    move_config_collaboration();
  } else if(_parameters["mode"] == string("saveconfig")) {
    register_config();
  } else {
    return EEDB::WebServices::WebBase::execute_request();
  }

  return true;
}


void EEDB::WebServices::ConfigServer::process_xml_parameters() {
  int   xml_len  = _post_data.size();
  
  if(_xml_text) { free(_xml_text); _xml_text=NULL; }  
  if(_param_doc) { free(_param_doc); _param_doc=NULL; }  
  
  _xml_text = (char*)malloc(xml_len+1);
  memset(_xml_text, 0, xml_len+1);
  memcpy(_xml_text, _post_data.c_str(), xml_len);  
  //printf("%s\n", _post_data.c_str());
  
  rapidxml::xml_node<>      *node, *root_node;
  _param_doc = new rapidxml::xml_document<>;
  try {
    _param_doc->parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(_xml_text);
  } catch(rapidxml::parse_error &e) {
    free(_xml_text); _xml_text=NULL;
    return;
  }

  root_node = _param_doc->first_node();
  if(!root_node) { free(_xml_text); _xml_text=NULL; return; }

  string root_name = root_node->name();
  boost::algorithm::to_lower(root_name);  

  if(root_name != string("zenbu_query")) { free(_xml_text); return; }
  
  if((node = root_node->first_node("uuid")) != NULL) { _parameters["uuid"] = node->value(); }
  if((node = root_node->first_node("uuid_list")) != NULL) { _parameters["uuid_list"] = node->value(); }

  if((node = root_node->first_node("peer_names")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("source_names")) != NULL) { _parameters["source_names"] = node->value(); }
  if((node = root_node->first_node("registry_mode")) != NULL) { _parameters["registry_mode"] = node->value(); }

  if((node = root_node->first_node("format")) != NULL) { _parameters["format"] = node->value(); }
  if((node = root_node->first_node("mode")) != NULL) { _parameters["mode"] = node->value(); }
  if((node = root_node->first_node("submode")) != NULL) { _parameters["submode"] = node->value(); }
  if((node = root_node->first_node("configtype")) != NULL) { _parameters["configtype"] = node->value(); }
  if((node = root_node->first_node("sort")) != NULL) { _parameters["sort"] = node->value(); }
  if((node = root_node->first_node("sort_order")) != NULL) { _parameters["sort_order"] = node->value(); }

  if((node = root_node->first_node("expfilter")) != NULL) { _parameters["filter"] = node->value(); }
  if((node = root_node->first_node("filter")) != NULL) { _parameters["filter"] = node->value(); }
  if((node = root_node->first_node("limit")) != NULL) { _parameters["limit"] = node->value(); }
  if((node = root_node->first_node("name")) != NULL) { _parameters["name"] = node->value(); }
  if((node = root_node->first_node("search")) != NULL) { _parameters["filter"] = node->value(); }

  if((node = root_node->first_node("collab")) != NULL) { _collaboration_filter = node->value(); }
  if((node = root_node->first_node("collaboration")) != NULL) { _collaboration_filter = node->value(); }
  if((node = root_node->first_node("collaboration_uuid")) != NULL) { _parameters["collaboration_uuid"] = node->value(); }

  if((node = root_node->first_node("configname")) != NULL) { _parameters["configname"] = node->value(); }
  if((node = root_node->first_node("description")) != NULL) { _parameters["description"] = node->value(); }
  if((node = root_node->first_node("configXML")) != NULL) { _config_node = node->first_node(); }
  if((node = root_node->first_node("svgXML")) != NULL) { _svg_node = node->first_node(); }  

  if((node = root_node->first_node("authenticate")) != NULL) { hmac_authorize_user(); }
}


void EEDB::WebServices::ConfigServer::show_api() {
  struct timeval       endtime, time_diff;

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_launch_time, &time_diff);
  double   uptime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  long int uphours = (long int)floor(uptime/3600);
  double   upmins  = (uptime - (uphours*3600)) / 60.0;
  
  /*
  my $cookie = $cgi->cookie($SESSION_NAME => $self->{"session"}->id);
  printf $cgi->header(-cookie=>$cookie, -type => "text/html", -charset=> "UTF8");
  */

  printf("Content-type: text/html\r\n\r\n");
  printf("<!DOCTYPE html  PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n");

  printf("<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-US\" xml:lang=\"en-US\">\n");
  printf("<head>\n");
  printf("<title>ZENBU Fast CGI object server</title>\n");
  printf("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf8\" />\n");
  printf("</head>\n");
  printf("<body>\n");

  printf("<h1>Fast CGI object server (c++)</h1>\n");
  printf("<p>eedb_search2.fcgi\n");
  printf("<p>server launched on: %s JST\n", ctime(&(_launch_time.tv_sec)));
  printf("<br>uptime %ld hours % 1.3f mins ", uphours, upmins);
  printf("<br>Invocation number <b>%ld</b>",_connection_count);
  printf(" PID <b>%d</b>\n", getpid());
  
  printf("<br>host : %s\n",_server_name.c_str());
  printf("<br>web_url : %s\n",_web_url.c_str());
  //printf("<br>URL parms : %s\n",_requestParams.c_str());
  if(_userDB) { printf("<br>user_db : %s\n",_userDB->url().c_str()); }
  if(_user_profile) {
    printf("<br>profile email : <b>%s</b>\n",_user_profile->email_identity().c_str());
    printf("<br>profile uuid  : <b>%s</b>\n",_user_profile->uuid().c_str());
    //printf("<br>profile openID : <b>%s</b>\n",_user_profile->openID().c_str());
  }
  
  if(!_session_data.empty()) {
    printf("<p><b>session</b>");
    map<string, string>::iterator  it;
    for(it = _session_data.begin(); it != _session_data.end(); it++) {
      printf("<br>  [%s] = %s\n", (*it).first.c_str(), (*it).second.c_str());
    }
  }

  printf("<table border=1 cellpadding=10><tr>");
  printf("<td>%d knowns peers</td>", EEDB::Peer::global_cache_size());
  //printf("<td>%d cached sources</td>", scalar(keys(%{$global_source_cache})));
  printf("</tr></table>");
  

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<p>processtime_sec : %1.6f\n", total_time);
  printf("<hr/>\n");

  printf("</body>\n");
  printf("</html>\n");
}


////////////////////////////////////////////////////////////////////////////


EEDB::FeatureSource*  EEDB::WebServices::ConfigServer::get_config_source(string collab_uuid, string configtype) {
  //new code which uses specific collaboration targeting for saving configs

  EEDB::Collaboration *collaboration = get_collaboration(collab_uuid);
  if(!collaboration) { return NULL; }
  
  EEDB::Peer *peer = collaboration->group_registry();
  if(!peer) { return NULL; }

  MQDB::Database *db = peer->peer_database();
  if(!db) { return NULL; }
  
  EEDB::FeatureSource *config_source = EEDB::FeatureSource::fetch_by_category_name(db, "config", configtype);
  peer->disconnect();

  if(!config_source) { return NULL; }
  if(config_source->category() != "config") { return NULL; }
  if(config_source->name() != configtype) { return NULL; }
  
  return config_source;
}


/*****************************************************************************
*
* configuration searching section
*
*****************************************************************************/

void  EEDB::WebServices::ConfigServer::show_config_xml() {
  printf("Content-type: text/xml\r\n\r\n");

  EEDB::Configuration *config = NULL;
  
  if(_parameters.find("uuid")!=_parameters.end()) {
    config = get_config_uuid(_parameters["uuid"]); 
  }
  //if(_parameters.find("basename")!=_parameters.end()) { 
  //  config = _get_config_basename(); 
  //}
  
  if(!config) {
    printf("<configuration>not found</configuration>\n");
    return;
  }

  config->update_usage();

  string          configXML = config->configXML();
  EEDB::Metadata *date_md   = config->metadataset()->find_metadata("date", "");

  if(configXML.empty()) {
    printf("<configuration>not found</configuration>\n");
    return;
  }

  if(configXML.find("</eeDBgLyphsConfig>")!=string::npos) {
    _session_data["last_view_config"] = config->uuid();
    save_session();
  }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;

  if(_parameters["format"] == "configXML") {
    size_t t_pos = configXML.find("</eeDBgLyphsConfig>");
    if(t_pos!=string::npos) {
      string data = configXML.substr(0, t_pos);
      printf("%s\n", data.c_str());
      if(date_md!=NULL) { printf("<create_date>%s</create_date>\n", date_md->data().c_str()); }
      printf("<configUUID>%s</configUUID>\n", config->uuid().c_str());
      printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
      printf("</eeDBgLyphsConfig>");
      return;
    }

    t_pos = configXML.find("</eeDBgLyphsTrackConfig>");
    if(t_pos!=string::npos) {
      string data = configXML.substr(0, t_pos);
      printf("%s\n", data.c_str());
      if(date_md!=NULL) { printf("<create_date>%s</create_date>\n", date_md->data().c_str()); }
      printf("<trackUUID>%s</trackUUID>\n", config->uuid().c_str());
      printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
      printf("</eeDBgLyphsTrackConfig>");
      return;
    }

    //other configs just as is
    printf("%s\n", configXML.c_str());
  }
  else {
    printf("%s\n", config->xml().c_str());  
  }
}


EEDB::Configuration*  EEDB::WebServices::ConfigServer::get_config_uuid(string uuid) {
  if(uuid.empty()) { return NULL; }

  EEDB::Configuration* config = NULL;
  if(_userDB) {
    config = EEDB::Configuration::fetch_by_uuid(_userDB, uuid, _user_profile);
    if(config) { return config; }
  }

  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer->source_stream()->classname() == EEDB::SPStreams::RemoteServerStream::class_name) {
      EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      config = rstream->fetch_config_by_uuid(_user_profile, uuid);
      if(config) { return config; }
    }
  }
  return NULL;
}


/*
 TODO: rethink the basename/named-config subsystem
 
EEDB::Feature*  EEDB::WebServices::ConfigServer::_get_config_basename() {
  string basename = _parameters["basename"];

  EEDB::SPStream  *stream = source_stream();
  EEDB::Feature   *feature = NULL;
  time_t          best_timestamp=0;

  stream->stream_features_by_metadata_search(basename);
  while(EEDB::Feature *obj = (EEDB::Feature*)stream->next_in_stream()) {
    if(!obj->feature_source()->is_active()) { obj->release(); continue; }
    if(!obj->feature_source()->is_visible()) { obj->release(); continue; }
    if(obj->feature_source()->category() != "config") { obj->release(); continue; }
    if(!obj->metadataset()->has_metadata_like("configXML", "")) { obj->release(); continue; }
    if(!obj->metadataset()->has_metadata_like("uuid", "")) { obj->release(); continue; }
    if(obj->primary_name().find(basename) != 0) { obj->release(); continue; };
   
    EEDB::Metadata *date_md = obj->metadataset()->find_metadata("date", "");
    if(date_md == NULL) { obj->release(); continue; }
    string time_str = date_md->data();
    time_t  obj_timestamp = MQDB::seconds_from_epoch(time_str);
    if(obj_timestamp==0) { obj->release(); continue; }

    if((best_timestamp==0) or (obj_timestamp > best_timestamp)) {
      feature=obj;
      best_timestamp = obj_timestamp;
    }
  }
  stream->disconnect();
  return feature;
}
*/


void EEDB::WebServices::ConfigServer::show_user_last_config() {
  _parameters["uuid"] = "";

  if(_session_data.find("last_view_config") != _session_data.end()) {
    _parameters["uuid"] = _session_data["last_view_config"];
    show_config_xml();
  }
  else if(_user_profile) {
    EEDB::Metadata *md = _user_profile->metadataset()->find_metadata("eedb:last_glyphs_config", "");
    if(md) { _parameters["uuid"] = md->data(); }
    show_config_xml();
  } else {
    printf("Content-type: text/xml\r\n\r\n");
    printf("<eeDBgLyphsConfig></eeDBgLyphsConfig>\n");
  }
}



bool _config_name_asc_sort_func (EEDB::Configuration *a, EEDB::Configuration *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (boost::to_upper_copy(a->display_name()) < boost::to_upper_copy(b->display_name()));
}
bool _config_name_desc_sort_func (EEDB::Configuration *a, EEDB::Configuration *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (boost::to_upper_copy(a->display_name()) > boost::to_upper_copy(b->display_name()));
}
bool _config_createdate_asc_sort_func (EEDB::Configuration *a, EEDB::Configuration *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (a->create_date() < b->create_date());   
}
bool _config_createdate_desc_sort_func (EEDB::Configuration *a, EEDB::Configuration *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (a->create_date() > b->create_date()); 
}
bool _config_access_asc_sort_func (EEDB::Configuration *a, EEDB::Configuration *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (a->access_count() < b->access_count()); 
}
bool _config_access_desc_sort_func (EEDB::Configuration *a, EEDB::Configuration *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (a->access_count() > b->access_count()); 
}


vector<EEDB::Configuration*>  EEDB::WebServices::ConfigServer::get_configs_search() {  
  vector<EEDB::Configuration*> configs;
  if(_parameters["configtype"].empty()) { return configs; }
  if(!_userDB) { return configs; }
    
  string filter = _parameters["filter"];
  //int    limit  = strtol(_parameters["limit"].c_str(), NULL, 10);
  
  string config_type = _parameters["configtype"];  
  if(config_type == "eeDB_gLyphs_configs")      { config_type = "VIEW"; }
  if(config_type == "eeDB_gLyph_track_configs") { config_type = "TRACK"; }
  if(config_type == "ZENBU_script_configs")     { config_type = "SCRIPT"; }
  if(config_type == "eeDB_gLyphs_autoconfigs")  { config_type = "AUTOSAVE"; }
  
  //userDB search
  vector<DBObject*> t_array = EEDB::Configuration::fetch_by_metadata_search(_userDB, config_type, _user_profile, filter);
  for(unsigned i=0; i<t_array.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)t_array[i];
    if((_collaboration_filter == "private") && (config->collaboration() != NULL)) { continue; }
    if(_collaboration_filter != "all" && _collaboration_filter != "private") {
      if(!config->collaboration()) { continue; }
      string collab_uuid = config->collaboration()->group_uuid();
      if(collab_uuid != _collaboration_filter) { continue; }
    }
    configs.push_back(config);
  }

  //then the remote servers
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer->source_stream()->classname() == EEDB::SPStreams::RemoteServerStream::class_name) {
      EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      vector<EEDB::Configuration*> tc_array = rstream->fetch_configs_by_metadata_search(config_type, _user_profile, filter, _collaboration_filter, _parameters["sort"], _parameters["sort_order"]);

      for(unsigned i=0; i<tc_array.size(); i++) {
        EEDB::Configuration *config = (EEDB::Configuration*)tc_array[i];

        if((_collaboration_filter == "private") && (config->collaboration() != NULL)) { continue; }
        if(_collaboration_filter != "all" && _collaboration_filter != "private") {
          if(!config->collaboration()) { continue; }
          string collab_uuid = config->collaboration()->group_uuid();
          if(collab_uuid != _collaboration_filter) { continue; }
        }        
        configs.push_back(config);
      }    
    }
  }
  
  //sort  
  if(_parameters["sort"] == "name") {
    if(_parameters["sort_order"] == "desc") {
      sort(configs.begin(), configs.end(), _config_name_desc_sort_func);
    } else {
      sort(configs.begin(), configs.end(), _config_name_asc_sort_func);
    }
  }
  if(_parameters["sort"] == "create_date") {
    if(_parameters["sort_order"] == "desc") {
      sort(configs.begin(), configs.end(), _config_createdate_desc_sort_func);
    } else {
      sort(configs.begin(), configs.end(), _config_createdate_asc_sort_func);
    }
  }
  if(_parameters["sort"] == "access") {
    if(_parameters["sort_order"] == "desc") {
      sort(configs.begin(), configs.end(), _config_access_desc_sort_func);
    } else {
      sort(configs.begin(), configs.end(), _config_access_asc_sort_func);
    }
  }
  
  return configs;
}


void EEDB::WebServices::ConfigServer::search_configs() {  
  printf("Content-type: text/xml\r\n\r\n");
  printf("<results>\n");
  
  if(!_userDB) { printf("</results>\n"); return; }
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  
  string filter = _parameters["filter"];
  int    limit  = strtol(_parameters["limit"].c_str(), NULL, 10);
  if(!filter.empty()) { printf("<query value=\"%s\" />\n", filter.c_str()); }
  
  string config_type = _parameters["configtype"];  
  if(config_type == "eeDB_gLyphs_configs")      { config_type = "VIEW"; }
  if(config_type == "eeDB_gLyph_track_configs") { config_type = "TRACK"; }
  if(config_type == "ZENBU_script_configs")     { config_type = "SCRIPT"; }
  if(config_type == "eeDB_gLyphs_autoconfigs")  { config_type = "AUTOSAVE"; }
  
  int total_configs  = 0;
  int filter_count   = 0;
  
  vector<DBObject*> t_array = EEDB::Configuration::fetch_by_metadata_search(_userDB, config_type, _user_profile, filter);
  vector<EEDB::Configuration*> configs;
  for(unsigned i=0; i<t_array.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)t_array[i];
    configs.push_back(config);
  }
  //then the remote servers
  EEDB::SPStreams::RemoteServerStream::set_stream_output("descxml"); //hack for now
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer->source_stream()->classname() == EEDB::SPStreams::RemoteServerStream::class_name) {
      EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      vector<EEDB::Configuration*> tc_array = rstream->fetch_configs_by_metadata_search(config_type, _user_profile, filter, _collaboration_filter, _parameters["sort"], _parameters["sort_order"]);
      for(unsigned i=0; i<tc_array.size(); i++) {
        configs.push_back(tc_array[i]);
      }    
    }
  }
  
  
  if(_parameters["sort"] == "name") {
    if(_parameters["sort_order"] == "desc") {
      sort(configs.begin(), configs.end(), _config_name_desc_sort_func);
    } else {
      sort(configs.begin(), configs.end(), _config_name_asc_sort_func);
    }
  }
  if(_parameters["sort"] == "create_date") {
    if(_parameters["sort_order"] == "desc") {
      sort(configs.begin(), configs.end(), _config_createdate_desc_sort_func);
    } else {
      sort(configs.begin(), configs.end(), _config_createdate_asc_sort_func);
    }
  }
  if(_parameters["sort"] == "access") {
    if(_parameters["sort_order"] == "desc") {
      sort(configs.begin(), configs.end(), _config_access_desc_sort_func);
    } else {
      sort(configs.begin(), configs.end(), _config_access_asc_sort_func);
    }
  }    

  for(unsigned i=0; i<configs.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)configs[i];
    total_configs++;
        
    if((_collaboration_filter == "private") && (config->collaboration() != NULL)) { continue; }
    if(_collaboration_filter != "all" && _collaboration_filter != "private") {
      if(!config->collaboration()) { continue; }
      string collab_uuid = config->collaboration()->group_uuid();
      if(collab_uuid != _collaboration_filter) { continue; }
    }
    
    if((limit==0) or (filter_count <= limit)) {
      filter_count++;
      
      if(_parameters["format_mode"] == "minxml") {
        printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%d\" create_date=\"%s\">", 
               config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
        if(config->collaboration()) { printf("%s", config->collaboration()->min_xml().c_str()); }
        else { printf("<collaboration name=\"private\" uuid=\"private\" />"); }
        printf("</configuration>\n");
      }
      else if(_parameters["format_mode"] == "descxml") {
        printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%d\" create_date=\"%s\">\n",    
               config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
        printf("<mdata type=\"eedb:display_name\">%s</mdata>\n", html_escape(config->display_name()).c_str());
        printf("<mdata type=\"description\">%s</mdata>\n", html_escape(config->description()).c_str());
        printf("</configuration>\n");
      }
      else if(_parameters["format"] == "search") { 
        printf("<match desc=\"%s\" feature_id=\"%s\" type=\"%s\" />\n", 
               html_escape(config->display_name()).c_str(), 
               html_escape(config->uuid()).c_str(), 
               config->config_type().c_str());
      } 
      else if(_parameters["format_mode"] == "fullxml") { 
        printf("%s", config->xml().c_str());
      }
      else {
        printf("%s", config->simple_xml().c_str());
      }
    }
  }
  
  printf("<result_count total=\"%d\" filtered=\"%d\" />\n", total_configs, filter_count);
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;  
  printf("<process_summary processtime_msec=\"%1.3f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  
  printf("</results>\n");
}


void EEDB::WebServices::ConfigServer::show_config_list() {  
  printf("Content-type: text/xml\r\n\r\n");
  printf("<configuration_list>\n");
  
  if(!_userDB) { printf("</results>\n"); return; }
  
  string uuid_list = _parameters["uuid_list"];
  if(uuid_list.empty()) { printf("</results>\n"); return; }

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  
  int total_configs  = 0;
  int filter_count   = 0;

  //fetch the configs from local and remote servers
  vector<EEDB::Configuration*> configs;
  vector<DBObject*> t_array = EEDB::Configuration::fetch_by_uuid_list(_userDB, _user_profile, uuid_list);
  for(unsigned i=0; i<t_array.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)t_array[i];
    configs.push_back(config);
  }
  //then the remote servers
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer->source_stream()->classname() == EEDB::SPStreams::RemoteServerStream::class_name) {
      EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      vector<EEDB::Configuration*> tc_array = rstream->fetch_configs_by_uuid_list(_user_profile, uuid_list);
      for(unsigned i=0; i<tc_array.size(); i++) {
        configs.push_back(tc_array[i]);
      }    
    }
  }
  
  for(unsigned i=0; i<configs.size(); i++) {
    EEDB::Configuration *config = (EEDB::Configuration*)configs[i];
    total_configs++;
    
    if((_collaboration_filter == "private") && (config->collaboration() != NULL)) { continue; }
    if(_collaboration_filter != "all" && _collaboration_filter != "private") {
      if(!config->collaboration()) { continue; }
      string collab_uuid = config->collaboration()->group_uuid();
      if(collab_uuid != _collaboration_filter) { continue; }
    }
    
    filter_count++;
    
    if(_parameters["format_mode"] == "minxml") {
      printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%d\" create_date=\"%s\" />\n", 
             config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
    }
    else if(_parameters["format_mode"] == "descxml") {
      printf("<configuration uuid=\"%s\" type=\"%s\" access_count=\"%d\" create_date=\"%s\">\n",    
             config->uuid().c_str(), config->config_type().c_str(), config->access_count(), config->create_date_string().c_str());
      printf("<mdata type=\"eedb:display_name\">%s</mdata>\n", html_escape(config->display_name()).c_str());
      printf("<mdata type=\"description\">%s</mdata>\n", html_escape(config->description()).c_str());
      printf("</configuration>\n");
    }
    else if(_parameters["format"] == "search") { 
      printf("<match desc=\"%s\" feature_id=\"%s\" type=\"%s\" />\n", 
             html_escape(config->display_name()).c_str(), 
             html_escape(config->uuid()).c_str(), 
             config->config_type().c_str());
    } 
    else if(_parameters["format_mode"] == "fullxml") { 
      printf("%s", config->xml().c_str());
    }
    else {
      printf("%s", config->simple_xml().c_str());
    }
  }
  
  printf("<result_count total=\"%d\" filtered=\"%d\" />\n", total_configs, filter_count);
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;  
  printf("<process_summary processtime_msec=\"%1.3f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  
  printf("</configuration_list>\n");
}



/*****************************************************************************
 *
 * configuration manipulation section
 *
 *****************************************************************************/


void  EEDB::WebServices::ConfigServer::delete_config_xml() {
  printf("Content-type: text/xml\r\n\r\n");
  printf("<delete_config>\n");

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); }
  else { printf("error: user must login</delete_config>\n"); return; }


  EEDB::Configuration *config = NULL;  
  if(_parameters.find("uuid")!=_parameters.end()) {
    config = get_config_uuid(_parameters["uuid"]); 
  }
  
  if(!config) { printf("error: config not found</delete_config>\n"); return; }
  if(!config->owner()) { printf("error: config malformed - no owner</delete_config>\n"); return; }

  if(config->uuid() != _parameters["uuid"]) {
    printf("error: config not found</delete_config>\n");
    return;
  }
  if(!config->owner()->match(_user_profile)) {
    printf("error: not owner of config</delete_config>\n");
    return;
  }

  if(!config->delete_from_db()) {
    printf("error: failed to delete</delete_config>\n");
    return;
  }

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<configUUID>%s</configUUID>\n", config->uuid().c_str());
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</delete_config>\n");
}


/////////////////////////////////////////////////////////////////////////////////


void  EEDB::WebServices::ConfigServer::move_config_collaboration() {
  printf("Content-type: text/xml\r\n\r\n");
  printf("<move_config>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); }
  else { printf("error: user must login</move_config>\n"); return; }
  
  EEDB::Configuration *config = NULL;  
  if(_parameters.find("uuid")!=_parameters.end()) {
    config = get_config_uuid(_parameters["uuid"]);
  }
  
  if(!config) { printf("error: config not found</move_config>\n"); return; }
    
  if(!config->owner() or (!config->owner()->match(_user_profile))) {
    printf("error: not owner of config</move_config>\n");
    return;
  }
    
  EEDB::Collaboration *collaboration = NULL;
  if(_parameters["collaboration_uuid"] != "private") {
    collaboration = get_collaboration(_parameters["collaboration_uuid"]);
  }
  config->link_to_collaboration(collaboration);
  
  printf("<configUUID>%s</configUUID>\n", config->uuid().c_str());
  printf("<configtype>%s</configtype>\n", config->config_type().c_str());
  printf("<dest>");
  if(collaboration) { printf("%s", collaboration->simple_xml().c_str()); }
  printf("</dest>\n");
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</move_config>\n");
}



/*****************************************************************************
*
* configuration registration section
*
*****************************************************************************/

void  EEDB::WebServices::ConfigServer::register_config() {  
  printf("Content-type: text/xml\r\n\r\n");
  printf("<config_upload>\n");
  
  rapidxml::xml_node<> *root_node = (rapidxml::xml_node<>*)_config_node;
  if(root_node) {
    if(root_node->name() == string("eeDBgLyphsConfig"))      { _register_view_config(); }
    if(root_node->name() == string("eeDBgLyphsTrackConfig")) { _register_track_config(); }
    if(root_node->name() == string("ZENBU_script_config"))   { _register_script_config(); }
    if(root_node->name() == string("ZENBU_user_annotation")) { _register_user_annotation(); }
  } else {
    printf("<error>no configXML node</error>\n");
  }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  
  printf("</config_upload>\n");
}



void  EEDB::WebServices::ConfigServer::_register_view_config() {
  if(!_param_doc || !_config_node) { return; }
  rapidxml::xml_document<>  *doc = (rapidxml::xml_document<>*)_param_doc;
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)_config_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  //
  // parse the XML, expand it and rebuild it
  //

  EEDB::Configuration *config = new EEDB::Configuration;
  config->config_type("VIEW");

  EEDB::Collaboration *collaboration = NULL;
  
  if((node = root_node->first_node("autoconfig")) != NULL) {
    config->config_type("AUTOSAVE");
  } else if((node = root_node->first_node("collaboration")) != NULL) {
    if((attr = node->first_attribute("uuid"))) {
      collaboration = get_collaboration(attr->value());
    }
  }
  
  string view_uuid = MQDB::uuid_b64string();
  config->uuid(view_uuid); 

  EEDB::MetadataSet  *mdset = config->metadataset();
  EEDB::Metadata     *md;
  
  mdset->add_tag_symbol("uuid", view_uuid);
  if(_user_profile) {
    config->owner(_user_profile);
    mdset->add_tag_symbol("eedb:owner_email", _user_profile->email_identity());
  }
  
  if((node = root_node->first_node("summary")) != NULL) {
    if((attr = node->first_attribute("name"))) {
      //mdset->add_tag_data("configname", attr->value());
      md = mdset->add_tag_data("eedb:display_name", attr->value());
    }

    if((attr = node->first_attribute("desc"))) {
      md = mdset->add_tag_data("description", attr->value());
    }
  }
  
  if((node = root_node->first_node("region")) != NULL) {
    string region = "<region ";

    if((attr = node->first_attribute("asm"))) {
      mdset->add_tag_symbol("eedb:assembly_name", attr->value());
      region += string("asm=\"") + attr->value() +"\" ";
    }
    
    if((attr = node->first_attribute("chrom"))) {
      region += string("chrom=\"") + attr->value() +"\" ";
    }
    if((attr = node->first_attribute("start"))) {
      region += string("start=\"") + attr->value() +"\" ";
    }
    if((attr = node->first_attribute("end"))) {
      region += string("end=\"") + attr->value() +"\" ";
    }
    if((attr = node->first_attribute("dwidth"))) {
      region += string("dwidth=\"") + attr->value() +"\" ";
    }
    region += "></region>";
    mdset->add_tag_data("eedb:region", region);
  }
  
  //- remove the deprecated <feature> section
  if((node = root_node->first_node("feature")) != NULL) {
    root_node->remove_node(node); 
  }

  //- remove the deprecated <eedbSearchTracks> section
  if((node = root_node->first_node("eedbSearchTracks")) != NULL) {
    root_node->remove_node(node); 
  }

  //- process the gLyphTracks / gLyphTrack section upgrade format as needed
  rapidxml::xml_node<> *tracks_root = root_node->first_node("gLyphTracks");
  if(tracks_root) {
    rapidxml::xml_node<> *track_node = tracks_root->first_node("gLyphTrack");
    while(track_node) {
      string track_title;
      if((attr = track_node->first_attribute("title"))) { track_title = attr->value(); }
      /*
      if(attr = track_node->first_attribute("source_ids")) {
        //move source_ids from attribute to subnode
        char *source_ids = doc->allocate_string(attr->value());  // Allocate string and copy source_ids into it        
        track_node->remove_attribute(attr);
        rapidxml::xml_node<> *src_node = doc->allocate_node(rapidxml::node_element, "source_ids", source_ids);
        track_node->append_node(src_node);
      }
      */
      track_node = track_node->next_sibling("gLyphTrack");
    }
  }
    
  //- add the configUUID
  node = doc->allocate_node(rapidxml::node_element, "configUUID", view_uuid.c_str());
  root_node->append_node(node);
  
  md = mdset->add_tag_data("date", _create_date_string());

  //if(getenv("SERVER_NAME")) { mdset->add_tag_data("Server_Name", getenv("SERVER_NAME")); }
  //if(getenv("HTTP_HOST")) { mdset->add_tag_data("Http_Host", getenv("HTTP_HOST")); }
  //if(getenv("SERVER_PORT")) { mdset->add_tag_data("Server_Port", getenv("SERVER_PORT")); }
  //if(getenv("SERVER_SOFTWARE")) { mdset->add_tag_data("Server_Software", getenv("SERVER_SOFTWARE")); }
  //if(getenv("SERVER_PROTOCOL")) { mdset->add_tag_data("Server_Protocol", getenv("SERVER_PROTOCOL")); }
  //if(getenv("GATEWAY_INTERFACE")) { mdset->add_tag_data("CGI_Revision", getenv("GATEWAY_INTERFACE")); }
  //if(getenv("HTTP_USER_AGENT")) { mdset->add_tag_data("browser", getenv("HTTP_USER_AGENT")); }
  //if(getenv("REMOTE_ADDR")) { mdset->add_tag_data("REMOTE_ADDR", getenv("REMOTE_ADDR")); }
  //if(getenv("HTTP_REFERER")) { mdset->add_tag_data("HTTP_REFERER", getenv("HTTP_REFERER")); }

  //reconstruct the configXML string
  std::string out_string;
  rapidxml::print(std::back_inserter(out_string), *root_node, 0);
  mdset->add_tag_data("configXML", out_string);
  
  mdset->remove_duplicates();
  mdset->extract_keywords();

  config->store(_userDB);

  if(collaboration) {
    config->link_to_collaboration(collaboration); 
  }
  
  //now increment usage and update user last_config
  config->update_usage();
  _session_data["last_view_config"] = config->uuid();
  save_session();
  
  //send result back
  printf("<configXML uuid=\"%s\" />\n", view_uuid.c_str());
  printf("%s\n", config->xml().c_str());
}


/////////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::WebServices::ConfigServer::_register_track_config() {
  if(!_param_doc || !_config_node) { return; }
  rapidxml::xml_document<>  *doc = (rapidxml::xml_document<>*)_param_doc;
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)_config_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  EEDB::Configuration *config = new EEDB::Configuration;
  config->config_type("TRACK");
  
  EEDB::Collaboration *collaboration = NULL;
  
  if((node = root_node->first_node("collaboration")) != NULL) {
    if((attr = node->first_attribute("uuid"))) {
      collaboration = get_collaboration(attr->value());
    }
  }
  
  string uuid = MQDB::uuid_b64string();
  config->uuid(uuid); 
  
  EEDB::MetadataSet  *mdset = config->metadataset();
  EEDB::Metadata     *md;

  if(_user_profile) { 
    config->owner(_user_profile); 
    mdset->add_tag_symbol("eedb:owner_email", _user_profile->email_identity());
  }
  
  mdset->add_tag_symbol("uuid", uuid);
  if((node = root_node->first_node("summary")) != NULL) {
    if((attr = node->first_attribute("title"))) {
      md = mdset->add_tag_data("eedb:display_name", attr->value());
    }

    if((attr = node->first_attribute("desc"))) {
      md = mdset->add_tag_data("description", attr->value());
    }

    if((attr = node->first_attribute("asm"))) {
      mdset->add_tag_symbol("eedb:assembly_name", attr->value());
    }
  }
  
  md = mdset->add_tag_data("date", _create_date_string());

  //if(getenv("SERVER_NAME")) { mdset->add_tag_data("Server_Name", getenv("SERVER_NAME")); }
  //if(getenv("HTTP_HOST")) { mdset->add_tag_data("Http_Host", getenv("HTTP_HOST")); }
  //if(getenv("SERVER_PORT")) { mdset->add_tag_data("Server_Port", getenv("SERVER_PORT")); }
  //if(getenv("SERVER_SOFTWARE")) { mdset->add_tag_data("Server_Software", getenv("SERVER_SOFTWARE")); }
  //if(getenv("SERVER_PROTOCOL")) { mdset->add_tag_data("Server_Protocol", getenv("SERVER_PROTOCOL")); }
  //if(getenv("GATEWAY_INTERFACE")) { mdset->add_tag_data("CGI_Revision", getenv("GATEWAY_INTERFACE")); }
  //if(getenv("HTTP_USER_AGENT")) { mdset->add_tag_data("browser", getenv("HTTP_USER_AGENT")); }
  //if(getenv("REMOTE_ADDR")) { mdset->add_tag_data("REMOTE_ADDR", getenv("REMOTE_ADDR")); }
  //if(getenv("HTTP_REFERER")) { mdset->add_tag_data("HTTP_REFERER", getenv("HTTP_REFERER")); }


  //- process the gLyphTracks / gLyphTrack section upgrade format as needed
  rapidxml::xml_node<> *track_node = root_node->first_node("gLyphTrack");
  if(track_node) {
    //remove any old uuid attribute of the gLyphTrack
    attr = track_node->first_attribute("uuid");
    if(attr)  { track_node->remove_attribute(attr); }

    //add in the new one just created
    attr = doc->allocate_attribute("uuid", uuid.c_str());
    track_node->append_attribute(attr);

    /* maybe later convert source_ids attributes into nodes
    if(attr = track_node->first_attribute("source_ids")) {
      //move source_ids from attribute to subnode
      char *source_ids = doc->allocate_string(attr->value());  // Allocate string and copy source_ids into it        
      track_node->remove_attribute(attr);
       rapidxml::xml_node<> *src_node = doc->allocate_node(rapidxml::node_element, "source_ids", source_ids);
       track_node->append_node(src_node);
    }
    */
  }
  
  //- add the configUUID
  node = doc->allocate_node(rapidxml::node_element, "configUUID", uuid.c_str());
  root_node->append_node(node);
  

  //reconstruct the configXML string
  std::string out_string;
  rapidxml::print(std::back_inserter(out_string), *root_node, 0);
  mdset->add_tag_data("configXML", out_string);

  mdset->remove_duplicates();
  mdset->extract_keywords();

  config->store(_userDB);
  if(collaboration) { config->link_to_collaboration(collaboration); }
  
  //send result back
  printf("<configXML uuid=\"%s\" />\n", uuid.c_str());
}


/////////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::WebServices::ConfigServer::_register_script_config() {
  if(!_param_doc || !_config_node) { return; }
  rapidxml::xml_document<>  *doc = (rapidxml::xml_document<>*)_param_doc;
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)_config_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  

  EEDB::Configuration *config = new EEDB::Configuration;
  config->config_type("SCRIPT");
  
  EEDB::Collaboration *collaboration = NULL;
  
  if((node = root_node->first_node("collaboration")) != NULL) {
    if((attr = node->first_attribute("uuid"))) {
      collaboration = get_collaboration(attr->value());
    }
  }
  
  string uuid = MQDB::uuid_b64string();
  config->uuid(uuid); 
  
  EEDB::MetadataSet  *mdset = config->metadataset();
  EEDB::Metadata     *md;

  if(_user_profile) { 
    config->owner(_user_profile); 
    mdset->add_tag_symbol("eedb:owner_email", _user_profile->email_identity());
  }
  
  mdset->add_tag_symbol("uuid", uuid);
  if((node = root_node->first_node("summary")) != NULL) {
    if((attr = node->first_attribute("name"))) {
      md = mdset->add_tag_data("eedb:display_name", attr->value());
    }

    if((attr = node->first_attribute("desc"))) {
      md = mdset->add_tag_data("description", attr->value());
    }
  }

  md = mdset->add_tag_data("date", _create_date_string());

  //if(getenv("SERVER_NAME")) { mdset->add_tag_data("Server_Name", getenv("SERVER_NAME")); }
  //if(getenv("HTTP_HOST")) { mdset->add_tag_data("Http_Host", getenv("HTTP_HOST")); }
  //if(getenv("SERVER_PORT")) { mdset->add_tag_data("Server_Port", getenv("SERVER_PORT")); }
  //if(getenv("SERVER_SOFTWARE")) { mdset->add_tag_data("Server_Software", getenv("SERVER_SOFTWARE")); }
  //if(getenv("SERVER_PROTOCOL")) { mdset->add_tag_data("Server_Protocol", getenv("SERVER_PROTOCOL")); }
  //if(getenv("GATEWAY_INTERFACE")) { mdset->add_tag_data("CGI_Revision", getenv("GATEWAY_INTERFACE")); }
  //if(getenv("HTTP_USER_AGENT")) { mdset->add_tag_data("browser", getenv("HTTP_USER_AGENT")); }
  //if(getenv("REMOTE_ADDR")) { mdset->add_tag_data("REMOTE_ADDR", getenv("REMOTE_ADDR")); }
  //if(getenv("HTTP_REFERER")) { mdset->add_tag_data("HTTP_REFERER", getenv("HTTP_REFERER")); }

  
  //- add the configUUID
  node = doc->allocate_node(rapidxml::node_element, "configUUID", uuid.c_str());
  root_node->append_node(node);
  
  //reconstruct the configXML string
  std::string out_string;
  rapidxml::print(std::back_inserter(out_string), *root_node, 0);
  mdset->add_tag_data("configXML", out_string);
  
  mdset->remove_duplicates();
  mdset->extract_keywords();

  config->store(_userDB);
  if(collaboration) { config->link_to_collaboration(collaboration); }

  //send result back
  printf("<configXML uuid=\"%s\" />\n", uuid.c_str());
}


string  EEDB::WebServices::ConfigServer::_create_date_string() {
  time_t t_date = time(NULL);
  string t_string = ctime(&t_date);
  t_string.resize(t_string.size()-1); //remove \n
  return t_string;
}


/*****************************************************************************
 *
 * user annotation subsystem
 *
 *****************************************************************************/

void  EEDB::WebServices::ConfigServer::_register_user_annotation() {
  if(!_param_doc || !_config_node) { return; }
  //rapidxml::xml_document<>  *doc = (rapidxml::xml_document<>*)_param_doc;
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)_config_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  EEDB::FeatureSource *config_source = NULL;
  if((node = root_node->first_node("collaboration")) != NULL) {
    if((attr = node->first_attribute("uuid"))) {
      config_source = get_config_source(attr->value(), "ZENBU_user_annotations");
    }
  }  
  if(!config_source) { 
    printf("<note>problem getting source</note>\n");
    return; 
  }
  // have specific config_source to save into now
  
  MQDB::Database *db = config_source->database();
  db->disconnect();
  db->user("zenbu_admin");
  db->password(_user_admin_password);

  EEDB::Feature *feature = EEDB::Feature::realloc();
  feature->feature_source(config_source);
  EEDB::MetadataSet  *mdset = feature->metadataset();
  EEDB::Metadata     *md;

  if(_user_profile) {
    //mdset->add_tag_data("eedb:owner_OpenID",   _user_profile->openID());
    mdset->add_tag_data("eedb:owner_uuid",   _user_profile->uuid());
    mdset->add_tag_data("eedb:owner_email",   _user_profile->email_identity());
    mdset->add_tag_data("eedb:owner_nickname", _user_profile->nickname());
  }
  
  if((node = root_node->first_node("summary")) != NULL) {
    if((attr = node->first_attribute("name"))) {
      feature->primary_name(attr->value());

      md = new EEDB::Metadata("keywords", attr->value());
      md->extract_keywords(mdset);
      md->release();
    }

    if((attr = node->first_attribute("desc"))) {
      md = mdset->add_tag_data("description", attr->value());
    }
  }
  
  if((node = root_node->first_node("region")) != NULL) {
    EEDB::Chrom    *chrom = NULL;
    EEDB::Assembly *assembly = NULL;

    if((attr = node->first_attribute("asm"))) {
      mdset->add_tag_symbol("eedb:assembly_name", attr->value());
      
      assembly = EEDB::Assembly::fetch_by_name(db, attr->value());
      if(!assembly) {
        assembly = new EEDB::Assembly;
        assembly->ncbi_version(attr->value());
        assembly->ucsc_name(attr->value());
        assembly->store(db);
      }

      if((attr = node->first_attribute("chrom"))) {
        chrom = EEDB::Chrom::fetch_by_assembly_chrname(assembly, attr->value());
        if(!chrom) {
          chrom = new EEDB::Chrom;
          chrom->chrom_name(attr->value());
          chrom->assembly(assembly);
          chrom->store(db);
        }    
      }
    }
    if(chrom) {
      feature->chrom(chrom);
      long int start = strtol(node->first_attribute("start")->value(), NULL, 10);
      long int end   = strtol(node->first_attribute("end")->value(), NULL, 10);
      feature->chrom_start(start);
      feature->chrom_end(end);
    }
  }
  mdset->add_tag_data("date", _create_date_string());
  
  if(getenv("HTTP_USER_AGENT")) { mdset->add_tag_data("browser", getenv("HTTP_USER_AGENT")); }
  if(getenv("REMOTE_ADDR")) { mdset->add_tag_data("REMOTE_ADDR", getenv("REMOTE_ADDR")); }

  mdset->remove_duplicates();
  mdset->extract_keywords();

  feature->store(db);

  //send result back
  printf("<feature id=\"%s\" />\n", feature->db_id().c_str());
}

