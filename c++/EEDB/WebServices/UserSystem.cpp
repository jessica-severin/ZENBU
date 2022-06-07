/* $Id: UserSystem.cpp,v 1.125 2022/04/08 02:03:18 severin Exp $ */

/***

NAME - EEDB::SPStreams::UserSystem

SYNOPSIS

DESCRIPTION

Specific subclass of WebBase which handles the user and collaboration subsystem

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
#include <curl/curl.h>
#include <openssl/hmac.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
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
#include <EEDB/Configuration.h>
#include <EEDB/Expression.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/Proxy.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/TrackRequest.h>
#include <EEDB/TrackCache.h>
#include <EEDB/WebServices/UserSystem.h>
#include <EEDB/SPStreams/RemoteServerStream.h>

#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 

using namespace std;
using namespace MQDB;

const char* EEDB::WebServices::UserSystem::class_name = "EEDB::WebServices::UserSystem";

EEDB::WebServices::UserSystem::UserSystem() {
  init();
}

EEDB::WebServices::UserSystem::~UserSystem() {
}

void _eedb_web_usersystem_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::WebServices::UserSystem*)obj;
}

void EEDB::WebServices::UserSystem::init() {
  EEDB::WebServices::WebBase::init();
  _classname      = EEDB::WebServices::UserSystem::class_name;
  _funcptr_delete = _eedb_web_usersystem_delete_func;
  
}

////////////////////////////////////////////////////////////////////////////////////////


bool EEDB::WebServices::UserSystem::process_url_request() {
  init_service_request();
  
  //reinitialize variables
  _parameters["mode"]   = "info";
  _parameters["format"] = "xml";
  
  get_url_parameters();  //from super class

  get_post_data();
  if(!_post_data.empty()) { process_xml_parameters(); }
  
  postprocess_parameters();

  return execute_request();
}


bool EEDB::WebServices::UserSystem::execute_request() {
  if(EEDB::WebServices::WebBase::execute_request()) { return true; }

  if(_curated_collaboration) {
    _curated_collaboration->validate_user(_user_profile);
  }
  
  if(_parameters.find("last_url") != _parameters.end()) {
    _session_data["last_url"] = _parameters["last_url"];
    save_session();
  }

  if(_parameters["mode"] == "user") {
    show_user();
  } else if(_parameters["mode"] == "update-profile") {
    update_profile();
  } else if(_parameters["mode"] == "password_login") {
    password_login();
  } else if(_parameters["mode"] == "logout") {
    logout();    
  } else if(_parameters["mode"] == "reset") {
    reset_session();    
  } else if(_parameters["mode"] == "create_group") {
    create_collaboration();
  } else if(_parameters["mode"] == "collaborations") {
    show_collaborations();
  } else if(_parameters["mode"] == "downloads") {
    show_downloads();
  } else if(_parameters["mode"] == "ignore_collaboration") {
    ignore_collaboration();
  } else if(_parameters["mode"] == "accept_request") {
    accept_collaboration_request();
  } else if(_parameters["mode"] == "reject_request") {
    reject_collaboration_request();
  } else if(_parameters["mode"] == "collaboration_remove_user") {
    collaboration_remove_user();
  } else if(_parameters["mode"] == "collaboration_make_admin_user") {
    collaboration_make_admin_user();
  } else if(_parameters["mode"] == "collaboration_revoke_admin_user") {
    collaboration_revoke_admin_user();
  } else if(_parameters["mode"] == "collaboration_make_public") {
    collaboration_make_public(true);
  } else if(_parameters["mode"] == "collaboration_revoke_public") {
    collaboration_make_public(false);
  } else if(_parameters["mode"] == "invite_user") {
    invite_user_to_collaboration();
  } else if(_parameters["mode"] == "accept_invitation") {
    accept_collaboration_invitation();
  } else if(_parameters["mode"] == "sharedb") {
    share_uploaded_database();
  } else if(_parameters["mode"] == "unsharedb") {
    unshare_uploaded_database();
  } else if(_parameters["mode"] == "upgrade_user_dbs") {
    upgrade_user_uploads();
  } else if(_parameters["mode"] == "edit_metadata") {
    edit_objects_metadata();
  } else if(_parameters["mode"] == "search_edit_metadata") {
    source_search_edit_metadata();
  } else if(_parameters["mode"] == "create_user") {
    create_user();
  } else if(_parameters["mode"] == "reset_password") {
    reset_password();
  } else if(_parameters["mode"] == "validate") {
    receive_validation();
  } else if(_parameters["mode"] == "send_validation") {
    send_validation_email();
  } else if(_parameters["mode"] == "forgot_password") {
    send_password_reset_email();
  } else if(_parameters["mode"] == "generate_hmac") {
    generate_hmac();
  } else if(_parameters["mode"] == "redirect_last_url") {
    redirect_to_last_url();
  } else if(_parameters["mode"] == "redirect_login") {
    redirect_to_user_profile();
  } else {
    return false;
  }
  
  /*
  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->disconnect;
  }
  */
    
  return true;
}


void EEDB::WebServices::UserSystem::show_api() {
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

  printf("Content-type: text/html\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<!DOCTYPE html  PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n");

  printf("<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-US\" xml:lang=\"en-US\">\n");
  printf("<head>\n");
  printf("<title>ZENBU Fast CGI object server</title>\n");
  printf("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf8\" />\n");
  printf("</head>\n");
  printf("<body>\n");

  printf("<h1>CGI object server (c++)</h1>\n");
  printf("<p>eedb_user.cgi\n");
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
  }
  
  if(!_session_data["id"].empty()) {
    printf("<p><b>session</b>");
    map<string, string>::iterator  it;
    for(it = _session_data.begin(); it != _session_data.end(); it++) {
      if((*it).first.empty()) { continue; }
      if((*it).second.empty()) { continue; }
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
  
  /*
  print h2("Access interface methods");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>loc=[location]</td><td>does genome location search and returns all features overlapping region. default output mode=region_gff<br>loc is format: chr17:75427837..75427870</td></tr>\n");
  print("<tr><td>segment=[location]</td><td>same as loc=... </td></tr>\n");
  print("<tr><td>types=[source,source,...]</td><td>limits results to a specific set of sources. multiple sources are separated by commas. used in both region and expression modes. if not set, all sources are used.</td></tr>\n");
  print("<tr><td>expfilter=[experiment,experiment,...]</td><td>limits results to a specific set of experiments. multiple experiments are allow and separated by commas. used in expression mode. if not set, all expression from all linked experiments in the region are used, otherwise the expression is filtered for specific experiments.</td></tr>\n");
  print("<tr><td>exptype=[type]</td><td>sets the expression data type. there are muiltiple expression types for each expression/experiment eg(raw, norm, tpm, detect). if not set, all expression data types are returned or used in calculations. the expression data types are not a fixed vocabulary and depend on the data in the EEDB server.</td></tr>\n");
  print("<tr><td>binning=[mode]</td><td>sets the expression binning mode [sum, mean, max, min, stddev]. when multiple expression value overlap the same binning region, this is the method for combining them. default [sum]</td></tr>\n");
  print("<tr><td>asm=[assembly name]</td><td>change the assembly. for example (hg18 mm9 rn4...)</td></tr>\n");

  print("<tr><td>format=[xml,gff2,gff3,bed,das,wig]</td><td>changes the output format of the result. XML is an EEDB/ZENBU defined XML format, while
GFF2, GFF3, and BED are common formats.  XML is supported in all access modes, but GFF2, GFF3, and BED are only available in direct feauture access modes. Default format is BED.</td></tr>\n");
  print("<tr><td>width=[number]</td><td>set the display width for svg drawing</td></tr>\n");
  print("<tr><td>strand_split=[0,1]</td><td>in expression mode, toggles whether the expression is split for each strand or combined</td></tr>\n");
  print("</table>\n");

  print h2("Control modes");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>mode=region</td><td>Returns features in region in specified format</td></tr>\n");
  print("<tr><td>mode=express</td><td>Returns features in region as expression profile (wig or svg formats)</td></tr>\n");
  print("<tr><td>submode=[submode]</td><td> available submodes:area, 5end, 3end, subfeature. 'area,5end,3end' are used for expression and 'subfeature' is used in region</td></tr>\n");
  print("</table>\n");
  */


  printf("</body>\n");
  printf("</html>\n");
}


void EEDB::WebServices::UserSystem::process_xml_parameters() {
  int   xml_len  = _post_data.size();
  char* xml_text = (char*)malloc(xml_len+1);
  memset(xml_text, 0, xml_len+1);
  memcpy(xml_text, _post_data.c_str(), xml_len);  
  //printf("%s\n", _post_data.c_str());
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(xml_text);
  } catch(rapidxml::parse_error &e) {
    free(xml_text);
    return;
  }

  root_node = doc.first_node();
  if(!root_node) { free(xml_text); return; }

  string root_name = root_node->name();
  boost::algorithm::to_lower(root_name);
  if((root_name != string("eedb_user_params")) and (root_name != string("zenbu_query"))) { free(xml_text); return; }
  
  if((node = root_node->first_node("format")) != NULL) { _parameters["format"] = node->value(); }
  if((node = root_node->first_node("mode")) != NULL) { _parameters["mode"] = node->value(); }
  if((node = root_node->first_node("submode")) != NULL) { _parameters["submode"] = node->value(); }

  if((node = root_node->first_node("email")) != NULL) { _parameters["profile_email"] = node->value(); }
  if((node = root_node->first_node("profile_email")) != NULL) { _parameters["profile_email"] = node->value(); }
  if((node = root_node->first_node("nickname")) != NULL) { _parameters["profile_nickname"] = node->value(); }
  if((node = root_node->first_node("profile_nickname")) != NULL) { _parameters["profile_nickname"] = node->value(); }
  if((node = root_node->first_node("valid_code")) != NULL) { _parameters["valid_code"] = node->value(); }
  if((node = root_node->first_node("set_hmac")) != NULL) { _parameters["profile_hmac"] = node->value(); }
  if((node = root_node->first_node("password")) != NULL) { _parameters["password"] = node->value(); }
  if((node = root_node->first_node("newpass1")) != NULL) { _parameters["newpass1"] = node->value(); }
  if((node = root_node->first_node("newpass2")) != NULL) { _parameters["newpass2"] = node->value(); }

  if((node = root_node->first_node("user_identity")) != NULL) { _parameters["user_identity"] = node->value(); }
  if((node = root_node->first_node("collaboration_uuid")) != NULL) { _parameters["collaboration_uuid"] = node->value(); }

  if((node = root_node->first_node("sharedb")) != NULL) { _parameters["sharedb"] = node->value(); }
  if((node = root_node->first_node("unsharedb")) != NULL) { _parameters["unsharedb"] = node->value(); }
  
  if((node = root_node->first_node("ids")) != NULL) { _parameters["ids"] = node->value(); }
  if((node = root_node->first_node("source_ids")) != NULL) { _parameters["source_ids"] = node->value(); }
  if((node = root_node->first_node("peers")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("peer_names")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("source_names")) != NULL) { _parameters["source_names"] = node->value(); }
  if((node = root_node->first_node("registry_mode")) != NULL) { _parameters["registry_mode"] = node->value(); }
    
  if((node = root_node->first_node("limit")) != NULL) { _parameters["limit"] = node->value(); }
  if((node = root_node->first_node("name")) != NULL) { _parameters["name"] = node->value(); }

  if((node = root_node->first_node("filter")) != NULL) { _parameters["filter"] = node->value(); }

  if((node = root_node->first_node("display_name")) != NULL) { _parameters["display_name"] = node->value(); }
  if((node = root_node->first_node("description")) != NULL) { _parameters["description"] = node->value(); }

  if((node = root_node->first_node("mdata_edit_commands")) != NULL) { parse_metadata_edit_commands(node); }

  if((node = root_node->first_node("last_url")) != NULL) { _parameters["last_url"] = node->value();  }

  if((node = root_node->first_node("authenticate")) != NULL) { hmac_authorize_user(); }

  free(xml_text);
}


void  EEDB::WebServices::UserSystem::postprocess_parameters() {
  //call superclass method
  EEDB::WebServices::WebBase::postprocess_parameters();

  //first convert aliased paramter names to official internal name
  if(_parameters.find("email") != _parameters.end())         { _parameters["profile_email"] = _parameters["email"]; }
  if(_parameters.find("nickname") != _parameters.end())      { _parameters["profile_nickname"] = _parameters["nickname"]; }

  //set defaults if they were not defined
  if(_parameters.find("mode") == _parameters.end())           { _parameters["mode"] = "user"; }
  if(_parameters.find("format") == _parameters.end())         { _parameters["format"] = "xml"; }
  
  if(_parameters.find("sharedb") != _parameters.end()) {
    _parameters["mode"] ="sharedb";
    _parameters["sharedb_uuid"] = _parameters["sharedb"];
  }
  if(_parameters.find("unsharedb") != _parameters.end()) {
    _parameters["mode"] ="unsharedb";
    _parameters["sharedb_uuid"] = _parameters["unsharedb"];
  }
  if(_parameters.find("valid_code") != _parameters.end()) {
    _parameters["mode"] ="validate";
  }
  
}


void  EEDB::WebServices::UserSystem::parse_metadata_edit_commands(void *xml_node) {
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node, *subnode;
  rapidxml::xml_attribute<> *attr;
    
  if(root_node == NULL) { return; }
  
  long count=0;
  //first get the source_ids which we will later use to configure FederatedSourceStream
  for(node=root_node->first_node("edit"); node; node=node->next_sibling("edit")) {
    EEDB::mdedit_t edit_cmd;
    if((attr = node->first_attribute("mode")))   { edit_cmd.mode = attr->value(); }
    if((attr = node->first_attribute("tag")))    { edit_cmd.tag = attr->value(); }
    if((attr = node->first_attribute("id")))     { edit_cmd.db_id = attr->value(); }
    if((attr = node->first_attribute("filter"))) { edit_cmd.obj_filter = attr->value(); }
    
    //must specify either id or filter search term for specificity
    if(edit_cmd.db_id.empty() && edit_cmd.obj_filter.empty()) { continue; }
    
    if(edit_cmd.mode == "change") {
      if((subnode = node->first_node("old")))  { edit_cmd.oldvalue = subnode->value(); }
      if((subnode = node->first_node("new")))  { edit_cmd.newvalue = subnode->value(); }
      //if(edit_cmd.oldvalue.empty()) { continue; } //changed logic, now an empty oldvalue allows for replacing all, like a delete all of tag and add a single new
    } else {
      edit_cmd.newvalue = node->value();
      if(edit_cmd.tag == "zenbu:hyperlink") {
        if((subnode = node->first_node("a")))  { 
          if((attr = subnode->first_attribute("href"))) { 
            edit_cmd.newvalue = "<a target=\"top\" href=\"" + string(attr->value()) +"\">"+subnode->value() +"</a>";
          }
        }
      }      
    }
    
    //post filters to avoid bad commands
    if(edit_cmd.tag.empty()) { continue; }
    if(edit_cmd.tag == "eedb:name") { continue; }
    
    if(edit_cmd.tag == "eedb:assembly_name") { continue; }
    if(edit_cmd.tag == "assembly_name") { continue; }
    if(edit_cmd.tag == "genome_assembly") { continue; }
    
    if(edit_cmd.tag == "uuid") { continue; }
    if(edit_cmd.tag == "eedb:owner_nickname") { continue; }
    if(edit_cmd.tag == "eedb:owner_OpenID") { continue; }
    if(edit_cmd.tag == "eedb:owner_email") { continue; }
    if(edit_cmd.tag == "configXML") { continue; }
    if(edit_cmd.tag == "eedb:configXML") { continue; }
        
    if(!edit_cmd.db_id.empty()) {
      _mdata_edit_commands[edit_cmd.db_id].push_back(edit_cmd);
    }
    if(!edit_cmd.obj_filter.empty()) {
      _mdata_edit_commands[edit_cmd.obj_filter].push_back(edit_cmd);
    }
    count++;
  }  
  fprintf(stderr, "UserSystem::parse_metadata_edit_commands %ld total cmds, %ld unique ID/filters\n", count, _mdata_edit_commands.size());
}


/*****************************************************************************
*
* request processing methods
*
*****************************************************************************/


void EEDB::WebServices::UserSystem::show_user() {  
  printf("Content-type: text/xml\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  printf("<user>\n");
  
  if(_user_profile) { printf("%s", _user_profile->xml().c_str()); } 
  
  if(!_processing_error.empty()) { printf("<ERROR>%s</ERROR>\n", _processing_error.c_str()); }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user>\n");
}


void  EEDB::WebServices::UserSystem::reset_session() {
  //first clear old session of login
  _session_data["eedb_validated_user_openid"].clear();
  _session_data["zenbu_login_user_identity"].clear();
  save_session();
  
  //then create a new session
  delete_session();
  save_session();

  printf("Content-type: text/html\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("Location: %s/user/#section=profile\r\n", _web_url.c_str());
  printf("\r\n");
  
  //"Set-Cookie:cookie_name=cookie_value"  
  /*
   if($self->{'session'}) {
   my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
   print $cgi->redirect(-uri=> ($WEB_URL."/user/#section=mydata"), -cookie=>$cookie);
   } else {
   print $cgi->redirect(-uri=> ($WEB_URL."/user/#section=mydata"));
   }
   */
}


void EEDB::WebServices::UserSystem::password_login() {
  //first clear old session of login
  _session_data["eedb_validated_user_openid"].clear();
  _session_data["zenbu_login_user_identity"].clear();
  _user_profile = NULL;
  save_session();

  if((_parameters.find("profile_email") != _parameters.end()) and (_parameters.find("password") != _parameters.end())) { 
    string user_ident  = _parameters["profile_email"];
    string passwd_hash = sha512(_parameters["password"]);
    EEDB::User *user = EEDB::User::fetch_by_email(_userDB, user_ident);
    if(user && user->validate_password_hash(passwd_hash)) {
      _user_profile = user;
      _session_data["zenbu_login_user_identity"] = user->email_identity();
      save_session();
    }
  }

  //then create a new session
  //delete_session();
  //save_session();

  printf("Content-type: text/xml\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user>\n");
  
  if(!_session_data["id"].empty()) {
    printf("<session>");
    map<string, string>::iterator  it;
    for(it = _session_data.begin(); it != _session_data.end(); it++) {
      if((*it).first.empty()) { continue; }
      if((*it).second.empty()) { continue; }
      printf("<%s>%s</%s>", (*it).first.c_str(), (*it).second.c_str(), (*it).first.c_str());
    }
    printf("</session>");
  }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user>\n");
}


void EEDB::WebServices::UserSystem::logout() {
  //first clear old session of login
  _session_data["eedb_validated_user_openid"].clear();
  _session_data["zenbu_login_user_identity"].clear();
  save_session();

  //then create a new session
  delete_session();
  save_session();

  printf("Content-type: text/xml\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user>\n");
  
  if(!_session_data["id"].empty()) {
    printf("<session>");
    map<string, string>::iterator  it;
    for(it = _session_data.begin(); it != _session_data.end(); it++) {
      if((*it).first.empty()) { continue; }
      if((*it).second.empty()) { continue; }
      printf("<%s>%s</%s>", (*it).first.c_str(), (*it).second.c_str(), (*it).first.c_str());
    }
    printf("</session>");
  }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user>\n");
}


void  EEDB::WebServices::UserSystem::redirect_to_last_url() {
  printf("Content-type: text/html\r\n");
  string url = _web_url + "/user/#section=profile";  
  if(!_session_data["id"].empty()) { 
    printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); 
    string last_url = _session_data["last_url"];
    if(!last_url.empty()) { 
      url = last_url; 
      fprintf(stderr, "redirect_to_last_url [%s]\n", last_url.c_str());
    }
  }
  printf("Location: %s\r\n", url.c_str());
  printf("\r\n");  
}


void  EEDB::WebServices::UserSystem::redirect_to_user_profile() {
  printf("Content-type: text/html\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("Location: %s/user/#section=profile\r\n", _web_url.c_str());
  printf("\r\n");  
}


/*****************************************************************************
*
* profile update
*
*****************************************************************************/

void EEDB::WebServices::UserSystem::update_profile() {  
  if(!_user_profile) { return show_user(); }

  bool update=false;

  /*
  if((_parameters.find("profile_email") != _parameters.end()) and
     (_parameters["profile_email"] != _user_profile->email_identity())) {
    _user_profile->email_identity(_parameters["profile_email"]);
    update=true;
  }
  */
  
  if((_parameters.find("profile_nickname") != _parameters.end()) and
     (_parameters["profile_nickname"] != _user_profile->nickname())) {
    _user_profile->nickname(_parameters["profile_nickname"]);
    update=true;
  }
  if((_parameters.find("profile_hmac") != _parameters.end()) and
     (_parameters["profile_hmac"] != _user_profile->hmac_secretkey()) and
     (_parameters["profile_hmac"].length() > 32)) {
    _user_profile->hmac_secretkey(_parameters["profile_hmac"]);
    update=true;
  }

  if(update) { _user_profile->update(); }

  update_config_sources();

  show_user();
}


void EEDB::WebServices::UserSystem::generate_hmac() {
  if(!_user_profile) { return show_user(); }
  _user_profile->generate_hmac_secretkey();
  show_user();
}



/*****************************************************************************
 *
 * new email based methods
 *
 *****************************************************************************/

void  EEDB::WebServices::UserSystem::create_user() {
  if(_user_profile) { 
    _user_profile->release();
    _user_profile = NULL;
    _session_data["eedb_validated_user_openid"].clear();
    _session_data["zenbu_login_user_identity"].clear();
    save_session();
  }

  if((_parameters.find("profile_email") == _parameters.end()) ||
     _parameters["profile_email"].empty()) { 
    _processing_error = "no_email";
    return show_user(); 
  }
  
  string email = _parameters["profile_email"];
  EEDB::User *user = EEDB::User::fetch_by_email(_userDB, email);
  if(user) {
    user->release();
    _processing_error = "email_exists";
    return show_user();
  }

  _user_profile = EEDB::User::create_new_profile(_userDB, email);
  send_validation_email();
}


void  EEDB::WebServices::UserSystem::reset_password() {
  if(!_user_profile || _user_profile->email_identity().empty()) { 
    _processing_error = "no_profile";
    return show_user(); 
  }

  string pass1 = _parameters["newpass1"];
  string pass2 = _parameters["newpass2"];
  if(pass1.length() <3) {
    _processing_error = "password_too_short";
    return show_user(); 
  }
  if(pass1 != pass2) {
    _processing_error = "password_not_match";
    return show_user(); 
  }

  //score password
  double score = 0;    
  // award every unique letter until 5 repetitions
  map<char, int> letters;
  for(unsigned i=0; i<pass1.length(); i++) {
    letters[pass1[i]] = (letters[pass1[i]] || 0) + 1;
    score += 5.0 / letters[pass1[i]];
  }
  // bonus points for mixing it up
  /*
  var variations = {
  digits: /\d/.test(pass),
  lower: /[a-z]/.test(pass),
  upper: /[A-Z]/.test(pass),
  nonWords: /\W/.test(pass),
  }
  variationCount = 0;
  for (var check in variations) {
    variationCount += (variations[check] == true) ? 1 : 0;
  }
  score += (variationCount - 1) * 10;
  */

  //OK do reset
  string passwd_hash = sha512(pass1);
  const char* sql = "UPDATE user SET password_hash=? WHERE user_id=?";
  _user_profile->database()->do_sql(sql, "sd", passwd_hash.c_str(), _user_profile->primary_id());
  
  //send email telling user their password was reset  
  string email = _user_profile->email_identity();
  string msg ="Hello " +_user_profile->nickname()+"\n\n";
  msg += "You have have just successfully changed your password for your account ["+email+"] on the ZENBU system at "+ _web_url +"\n";
  msg += "\nIf you did not just reset your password, please go to ZENBU and request a new default password\n";
  msg += "\n\n";
  //fprintf(stderr, "%s\n", msg.c_str());
  
  string subj = "ZENBU -- user account password changed";
  send_email(email,subj,  msg);
    
  return show_user();
}



void  EEDB::WebServices::UserSystem::send_validation_email() {
  //for users who have logged in via OpenID, have a profile, 
  //but do not have a valid email identity yet
  //fprintf(stderr, "send_validation_email\n");
  
  if(!_user_profile) { 
    _processing_error = "no_profile";
    return show_user(); 
  }
  if((_parameters.find("profile_email") == _parameters.end()) ||
     _parameters["profile_email"].empty()) { 
    _processing_error = "no_email";
    return show_user(); 
  }
  
  string email = _parameters["profile_email"];

  //make sha256 hash from hard to duplicate message
  string msg = _server_name + _web_url + _web_uuid;
  msg += MQDB::uuid_b64string();
  msg += _parameters["profile_email"];
  string validcode = sha256(msg);  //sha512()

  //add the validation into the userDB
  const char* sql = "DELETE FROM user_email_validation WHERE user_id=?";
  _user_profile->database()->do_sql(sql, "d", _user_profile->primary_id());
  sql = "INSERT INTO user_email_validation (email, validation_code, user_id) VALUES(?,?,?)";
  _user_profile->database()->do_sql(sql, "ssd", email.c_str(), validcode.c_str(), _user_profile->primary_id());
  
  msg ="Welcome to ZENBU " +_parameters["profile_nickname"]+"\n\n";
  msg += "You have requested this email address <"+email+"> to be validated as your ZENBU user account\n\n"; 
  msg += "To complete the email verification, please click the following link\n";
  msg += _web_url + "/cgi/eedb_user.cgi?profile_email="+email+";valid_code="+validcode;
  msg += "\n\n";
  msg += "After validation, you will be asked set your password\n\n";
  
  string subj = "ZENBU -- user account email confirmation";
  send_email(email,subj,  msg);
  
  //
  // display XML return status
  //
  printf("Content-type: text/xml\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user_validation>\n");
  if(_user_profile) { printf("%s", _user_profile->xml().c_str()); } 
  printf("<status>send_validation_email</status>\n");
  printf("<email>%s</email>\n", email.c_str());
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user_validation>\n");
}


void  EEDB::WebServices::UserSystem::send_password_reset_email() {
  //for users who have logged in via OpenID, have a profile, 
  //but do not have a valid email identity yet
  //fprintf(stderr, "send_validation_email\n");
  
  if((_parameters.find("profile_email") == _parameters.end()) ||
     _parameters["profile_email"].empty()) { 
    _processing_error = "no_email";
    return show_user(); 
  }

  string email = _parameters["profile_email"];
  EEDB::User *user = EEDB::User::fetch_by_email(_userDB, email);
  if(!user) {
    user->release();
    _processing_error = "user not found";
    return show_user();
  }

  //make sha256 hash from hard to duplicate message
  string msg = _server_name + _web_url + _web_uuid;
  msg += MQDB::uuid_b64string();
  msg += _parameters["profile_email"];
  string validcode = sha256(msg);  //sha512()
  validcode.resize(24);
    
  //add the validation into the userDB
  const char* sql = "DELETE FROM user_email_validation WHERE user_id=?";
  user->database()->do_sql(sql, "d", user->primary_id());
  sql = "INSERT INTO user_email_validation (email, validation_code, user_id) VALUES(?,?,?)";
  user->database()->do_sql(sql, "ssd", email.c_str(), validcode.c_str(), user->primary_id());

  msg ="\n\nHello ZENBU user " +_parameters["profile_nickname"]+"\n";
  msg += "You have requested to reset the password for your account with email address <"+email+">.\n\n"; 
  msg += "To complete the password reset, please click the following link\n";
  msg += _web_url + "/cgi/eedb_user.cgi?profile_email="+email+";valid_code="+validcode;
  msg += "\n\n";
  //msg += "To complete the password reset, please enter this validation code into the password reset panel\n";
  msg += "OR enter this validation code into the password reset panel\n";
  msg += "\t"+validcode+"\n";
  msg += "\n\n";
  msg += "If you did not request a password reset, please just ignore this email.\n\n";
  
  //msg += "After validation you can login either by your previous OpenID(s) or with the following credentials\n";
  //msg += "   email address : " + email + "\n";
  //msg += "   password      : " + passwd + "\n";
  //msg += "You can change your new default password later after you have signed into ZENBU\n\n";
  //fprintf(stderr, "%s\n", msg.c_str());
  
  string subj = "ZENBU -- user account password reset";
  send_email(email,subj,  msg);
  
  //
  // display XML return status
  //
  printf("Content-type: text/xml\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user_validation>\n");
  if(user) { printf("%s", user->xml().c_str()); } 
  printf("<status>send_validation_email</status>\n");
  printf("<email>%s</email>\n", email.c_str());
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user_validation>\n");
  
}


void  EEDB::WebServices::UserSystem::send_invitation_email(EEDB::User *invited_user, string collab_name) {
  //for sending invitation from one user to another
  //OR for creating new account without login
  if(!_userDB) { return; }
  
  if(!_user_profile) { 
    _processing_error = "no_profile";
    return show_user(); 
  }
  if(!invited_user) { 
    _processing_error = "no user to invite";
    return show_user(); 
  }
  
  //make sha256 hash from hard to duplicate message
  string msg = _server_name + _web_url + _web_uuid;
  msg += MQDB::uuid_b64string();
  msg += _parameters["profile_email"];
  string validcode = sha256(msg);  //sha512()
  
  //add the validation into the userDB
  const char* sql = "DELETE FROM user_email_validation WHERE user_id=?";
  _userDB->do_sql(sql, "d", invited_user->primary_id());
  sql = "INSERT INTO user_email_validation (email, validation_code, user_id) VALUES(?,?,?)";
  _userDB->do_sql(sql, "ssd", invited_user->email_identity().c_str(), validcode.c_str(), invited_user->primary_id());
  
  msg ="\n\nDear collaborator\n\n";
  msg += _user_profile->nickname() + "<"+ _user_profile->email_identity() + "> ";
  msg += " has invited you to join their collaboration ["+collab_name+"] on ZENBU "+ _web_url;
  msg += " to share data and visualizations.\n\n";
  msg += "Please click the link below in order to create a new account on ZENBU and to access the collaboration\n";
  msg += _web_url + "/cgi/eedb_user.cgi?profile_email="+invited_user->email_identity()+";valid_code="+validcode;
  fprintf(stderr, "%s\n", msg.c_str());
  
  string subj = "You are invited to join ZENBU by " + _user_profile->email_identity();
  send_email(invited_user->email_identity(), subj, msg); 
  
  
  //
  // display XML return status
  //
  printf("Content-type: text/xml\r\n");
  if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user_validation>\n");
  if(_user_profile) { printf("%s", _user_profile->xml().c_str()); } 
  printf("<status>send_validation_email</status>\n");
  printf("<email>%s</email>\n", _user_profile->email_identity().c_str());
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user_validation>\n");  
}


void EEDB::WebServices::UserSystem::receive_validation() {  
  map<string, dynadata>   row_map;
  void                    *stmt;
  fprintf(stderr, "UserSystem::receive_validation\n");

  //printf("Content-type: text/xml\r\n");
  //if(!_session_data["id"].empty()) { printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str()); }
  //printf("\r\n");
  //printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  //printf("<user_validation>\n");
  
  if(_parameters.find("valid_code") == _parameters.end()) {
    //printf("<status>no_validation_code</status>\n");
    //printf("</user_validation>\n");
    _processing_error ="no_validation_code";
    fprintf(stderr, "no_validation_code\n");
    redirect_to_user_profile();
    return; 
  }
    
  //FIRST -- get the validation record
  string sql ="SELECT * FROM user_email_validation WHERE validation_code='"+_parameters["valid_code"]+"'";
  //WHERE (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(create_time)) < 60*60*24 
  stmt = _userDB->prepare_fetch_sql(sql.c_str());
  if(!_userDB->fetch_next_row_map(stmt, row_map)) {
    _processing_error ="no_validation_code";
    fprintf(stderr, "no_validation_code\n");
    redirect_to_user_profile();
    return; 
  }
  _userDB->finalize_stmt(stmt);

  string email = row_map["email"].i_string;
  long int user_id = -1;
  if(row_map["user_id"].type == MQDB::INT) { user_id = row_map["user_id"].i_int; }
  fprintf(stderr, "validation code [%s] user_id %ld\n", _parameters["valid_code"].c_str(), user_id);

  if(email.empty()) {
    fprintf(stderr, "no email with validation error\n");
    //printf("<status>validation_expired</status>\n");
    //printf("</user_validation>\n");
    _processing_error ="validation_expired";
    redirect_to_user_profile();
    return; 
  }
  fprintf(stderr, "OK start working...\n");

  //
  // most common situation, not logged in and validating new account or resetting password
  //
  if(!_user_profile &&
     _session_data["eedb_validated_user_openid"].empty() &&
     (_parameters["profile_email"] == email)) {
    EEDB::User *user = EEDB::User::fetch_by_id(_userDB, user_id);
    if(user) {
      if(user->email_identity().empty() && user->openIDs().empty()) {
        fprintf(stderr, "looks like an empty new user\n");
        user->set_valid_email(email);
      }
      _user_profile = user;
      _session_data["zenbu_login_user_identity"] = email;
      save_session();

      _userDB->do_sql("DELETE FROM user_email_validation WHERE user_id=?", "d", user_id);

      _userDB->do_sql("UPDATE user SET password_hash ='' WHERE user_id=?", "d", user_id);

      //if(_user_profile) { printf("%s", _user_profile->xml().c_str()); }   
      redirect_to_user_profile();
    }
    return;    
  } 

  //
  // ALL the crazy business logic for different states of OpenID accounts and merging
  //

  //see if this email exists in another user
  EEDB::User *email_user = EEDB::User::fetch_by_email(_userDB, email);

  if(_user_profile && !_user_profile->email_identity().empty() && (_user_profile->email_identity() != email)) {
    //difficult, user is validating a different email than previous valid-email
    //either we need to add an alternate email to current user
    //OR we should logout the current user and login as other user
    //printf("<note>user has valid email and does not match validation info, logout current user</note>\n");

    fprintf(stderr, "not match current user email\n");
    //for now we logout the current user
    _user_profile->release();
    _user_profile = NULL;
    _session_data["eedb_validated_user_openid"].clear();
    _session_data["zenbu_login_user_identity"].clear();
    save_session();    
  }
    
  if(_user_profile) {
    if(_user_profile->email_identity() == email) {
      //printf("<status>no_change</status>\n");
    }
    else if(_user_profile->email_identity().empty() && (_user_profile->primary_id() == user_id)) {
      //printf("<status>set_valid_email</status>\n");
      //can simply set this email for the current users since it is valid
      if(email_user) {
        EEDB::User* user2 = EEDB::User::merge_user_profiles(_user_profile, email_user);
        _user_profile = user2;
        _session_data["zenbu_login_user_identity"] = email;
        save_session();
      } else {
        _user_profile->set_valid_email(email);
        _user_profile->update_upload_ownership();
      }
    }
    else if((_user_profile->email_identity() != email) && (_user_profile->primary_id() == user_id)) {
      //printf("<status>error</status>\n");
      //printf("<note>something odd, user_id matches, but a different email</note>\n");
      _processing_error ="something odd, user_id matches, but a different email";
    }
    else if(_user_profile->primary_id() != user_id) {
      //printf("<status>warning</status>\n");
      //printf("<note>different user, different openID and user_id does not matches</note>\n");
      _processing_error ="different user, different openID and user_id does not matches";
    } else {
      //printf("<status>error</status>\n");
      //printf("<note>fall through logic so strange state</note>\n");
      _processing_error ="fall through logic so very strange state";
    }
  }

  if(!_user_profile) {
    _processing_error ="user not currently logged in via openID, can not validate";
    fprintf(stderr, "%s\n", _processing_error.c_str());
  }
  
  if(_user_profile) { printf("%s", _user_profile->xml().c_str()); }   
  
  /*
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user_validation>\n");
  */
  redirect_to_user_profile();
}
  
/*****************************************************************************
*
* collaboration management
*
*****************************************************************************/

void EEDB::WebServices::UserSystem::create_collaboration() {  
  if(!_user_profile) { return show_user(); }
  
  EEDB::Collaboration *collaboration = new EEDB::Collaboration();
  
  string uuid = MQDB::uuid_b64string();
  boost::algorithm::replace_all(uuid, "-", "__");
  collaboration->group_uuid(uuid);
  
  collaboration->display_name(_parameters["display_name"]);
  collaboration->member_status("OWNER");
  collaboration->owner(_user_profile);

  EEDB::MetadataSet *mdset = collaboration->metadataset();
  if(_parameters.find("description") != _parameters.end()) {
    mdset->add_tag_data("description", _parameters["description"]);
  }
  //mdset->add_tag_data("eedb:owner_OpenID", _user_profile->openID());
  mdset->extract_keywords();
  
  //store_new will also create registry for collaboration
  collaboration->store_new(_user_profile->database());
  
  //add the creator of the Collaboration also to its list of members
  const char* sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,?)";
  _user_profile->database()->do_sql(sql, "dds", collaboration->primary_id(), _user_profile->primary_id(), "ADMIN");
  
  _parameters["collaboration_uuid"] = collaboration->group_uuid();
  show_collaborations();  
}


void EEDB::WebServices::UserSystem::show_collaborations() {  
  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  
  printf("<collaborations>\n");

  if(_user_profile) { 
    printf("%s", _user_profile->simple_xml().c_str()); 
  }

  map<string, EEDB::Collaboration*> collab_hash;
  
  if(_curated_collaboration && 
     (_curated_collaboration->member_status()=="MEMBER" || _curated_collaboration->member_status()=="ADMIN" || _parameters["submode"] == "searchable") &&
     ((_parameters.find("collaboration_uuid") == _parameters.end()) or (_parameters["collaboration_uuid"] == "curated"))) { 
    if(collab_hash.find(_curated_collaboration->group_uuid()) == collab_hash.end()) {
      collab_hash[_curated_collaboration->group_uuid()] = _curated_collaboration;
    }    
  }
  
  if(_public_collaboration &&
     ((_parameters.find("collaboration_uuid") == _parameters.end()) or (_parameters["collaboration_uuid"] == "public"))) { 
    if(collab_hash.find(_public_collaboration->group_uuid()) == collab_hash.end()) {
      collab_hash[_public_collaboration->group_uuid()] = _public_collaboration;
    }    
  }
  
  //OpenToPublic collaborations
  vector<MQDB::DBObject*>  open_collabs = EEDB::Collaboration::fetch_all_public(_userDB, _user_profile);
  vector<MQDB::DBObject*>::iterator  opc_it;
  for(opc_it = open_collabs.begin(); opc_it != open_collabs.end(); opc_it++) {
    EEDB::Collaboration *collab = (EEDB::Collaboration*)(*opc_it);
    if(collab_hash.find(collab->group_uuid()) == collab_hash.end()) {
      collab_hash[collab->group_uuid()] = collab;
    }    
  }

  if(_user_profile) { 
    vector<DBObject*> collaborations;
    if(_parameters["submode"] == "member" || _parameters["submode"] == "searchable") {
      collaborations = EEDB::Collaboration::fetch_all_by_user_member(_user_profile);
    } else {
      collaborations = EEDB::Collaboration::fetch_all_by_user(_user_profile);
    }
    for(unsigned int i=0; i<collaborations.size(); i++) {
      EEDB::Collaboration *collab = (EEDB::Collaboration*)collaborations[i];
      if((_parameters.find("collaboration_uuid") != _parameters.end()) and
         (_parameters["collaboration_uuid"] != collab->group_uuid())) { continue; }
      if(collab_hash.find(collab->group_uuid()) == collab_hash.end()) {
        collab_hash[collab->group_uuid()] = collab;
      }      
    }
  }
  
  //then the remote servers
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer->source_stream()->classname() == EEDB::SPStreams::RemoteServerStream::class_name) {
      EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      vector<EEDB::Collaboration*> tc_array = rstream->fetch_collaborations(_user_profile);
      for(unsigned i=0; i<tc_array.size(); i++) {
        EEDB::Collaboration *collaboration = (EEDB::Collaboration*)tc_array[i];
        if((_parameters.find("collaboration_uuid") != _parameters.end()) and
           (_parameters["collaboration_uuid"] != collaboration->group_uuid())) { continue; }
        if(collaboration->group_uuid() == "private") { continue; }
        if(collaboration->group_uuid() == "curated") { continue; }
        if(collaboration->group_uuid() == "public") { continue; }
        if(collab_hash.find(collaboration->group_uuid()) == collab_hash.end()) {
          collab_hash[collaboration->group_uuid()] = collaboration;
        }        
      }    
    }
  }  
  
  //display
  map<string, EEDB::Collaboration*>::iterator collab_it;
  for(collab_it=collab_hash.begin(); collab_it!=collab_hash.end(); collab_it++) {
    EEDB::Collaboration *collaboration = (*collab_it).second;
    if((_parameters.find("collaboration_uuid") != _parameters.end()) and
       (_parameters["collaboration_uuid"] != collaboration->group_uuid())) { continue; }
    if((_parameters["submode"] != "searchable") and (collaboration->member_status() != "MEMBER" && collaboration->member_status() != "OWNER" && collaboration->member_status() != "ADMIN"))  { continue; }
    if(_parameters["format_mode"] == "simplexml") {
      printf("%s", collaboration->simple_xml().c_str());
    } else if(_parameters["format_mode"] == "minxml") {
      printf("%s", collaboration->min_xml().c_str());
    } else if(_parameters["format_mode"] == "descxml") {
      printf("%s", collaboration->desc_xml().c_str());
    } else { 
      printf("%s", collaboration->xml().c_str()); 
    }
  }
  
  struct timeval endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</collaborations>\n");
}


void EEDB::WebServices::UserSystem::ignore_collaboration() {  
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->ignore_collaboration(_user_profile);
  }  
  show_collaborations();
}

void EEDB::WebServices::UserSystem::collaboration_make_public(bool value) {  
  //must be owner of collaboration in order to accept a user's collaboration request
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->make_public(value);
  }  
  show_collaborations();  
}


void EEDB::WebServices::UserSystem::accept_collaboration_request() {  
  //must be owner of collaboration in order to accept a user's collaboration request
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    if(!collaboration->accept_user_request_to_collaboration(_parameters["user_identity"])) {
      fprintf(stderr, "UserSystem::accept_collaboration_request permission error: [%s] [%s] from [%s]\n", 
        _parameters["collaboration_uuid"].c_str(), _parameters["user_identity"].c_str(), _user_profile->email_identity().c_str());
    }
  }  
  show_collaborations();  
}


void EEDB::WebServices::UserSystem::reject_collaboration_request() {
  //must be owner of collaboration in order to reject a user's collaboration request
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->reject_user_request_to_collaboration(_parameters["user_identity"]);
  }  
  show_collaborations();
}


void EEDB::WebServices::UserSystem::collaboration_remove_user() {
  //must be owner of collaboration in order to remove a user from a collaboration
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->remove_user_from_collaboration(_parameters["user_identity"]);
  }  
  show_collaborations();
}


void EEDB::WebServices::UserSystem::collaboration_make_admin_user() {
  //must be owner of collaboration in order to remove a user from a collaboration
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->make_user_administrator(_parameters["user_identity"]);
  }
  show_collaborations();
}


void EEDB::WebServices::UserSystem::collaboration_revoke_admin_user() {
  //must be owner of collaboration in order to remove a user from a collaboration
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->revoke_user_administrator(_parameters["user_identity"]);
  }
  show_collaborations();
}


void EEDB::WebServices::UserSystem::invite_user_to_collaboration() {  
  //must be owner of collaboration in order to invite a user to your collaboration
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(!collaboration) {
    _processing_error ="error fetching collaboration";
    return show_user();
  }
  
  //need to find user, then insert an invitation
  /*
  EEDB::User *user = EEDB::User::fetch_by_email(_userDB, _parameters["user_identity"]);
  if(!user) { 
    _processing_error ="no matching user [" + _parameters["user_identity"] + "]";
    return show_user();
  }
  */
        
  if(collaboration->add_user_to_collaboration(_parameters["user_identity"])) {
    fprintf(stderr, "add_user_to_collaboration success\n");
    EEDB::User *user = EEDB::User::fetch_by_email(_userDB, _parameters["user_identity"]);
    if(!user) { user = EEDB::User::fetch_by_openID(_userDB, _parameters["user_identity"]); }
    if(user) {
      string msg ="\n\nHello ZENBU collaborator "+user->nickname()+"\n\n";
      msg += "ZENBU user ";
      msg += _user_profile->nickname() + "<"+ _user_profile->email_identity() + "> ";
      msg += " has added you to their collaboration ["+collaboration->display_name() +"] on ZENBU  at "+ _web_url;
      msg += " to share data and visualizations.\n\n";
      msg += "Please click the link see your new collaboration\n";
      msg += _web_url + "/user/#section=collaborations";
      fprintf(stderr, "%s\n", msg.c_str());

      string subj = "You are now member of ZENBU collaboration '"+collaboration->display_name()+"'";
      send_email(user->email_identity(), subj, msg);
    }
  } else {
    //user not in system: create user account, add to collaboration and send email
    EEDB::User *user = EEDB::User::fetch_by_email(_userDB, _parameters["user_identity"]);
    if(!user) {
      user = EEDB::User::create_new_profile(_userDB, _parameters["user_identity"]);
    }
    if(collaboration->add_user_to_collaboration(_parameters["user_identity"])) {
      send_invitation_email(user, collaboration->display_name());
      return;
    } else {
      _processing_error ="error adding newly created user to collaboration";
    }
  }
  show_user();
}


void EEDB::WebServices::UserSystem::accept_collaboration_invitation() {  
  if(!_user_profile) { return show_user(); }
  EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  if(collaboration) {
    collaboration->accept_invitation_to_collaboration(_user_profile);
  }  
  show_collaborations();
}


void EEDB::WebServices::UserSystem::share_uploaded_database() {
  //fprintf(stderr, "share_uploaded_database\n");
  if(!_user_profile) {
    _processing_error ="no login profile";
    return show_user(); 
  }

  //user_registry is MINE-and-only-mine mini-federation. 
  //so all data in there is something I have uploaded and are responsible for

  EEDB::Peer *user_reg = _user_profile->user_registry();
  if(!user_reg) {
   _processing_error ="no user profile registry";
   return show_user();
  }
  
  //
  // next get the collaboration we are sharing into
  //
  EEDB::Collaboration *collaboration = NULL;
  if(_parameters["collaboration_uuid"] == "public") {
    collaboration = _public_collaboration;
  } else if(_parameters["collaboration_uuid"] == "curated") {
    collaboration = _curated_collaboration;
  } else {
    collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  }
  
  if(!collaboration) {
    _processing_error ="collaboration ["+ _parameters["collaboration_uuid"] +"] not found";
    return show_user();
  }
  
  if(!((collaboration->member_status() == "MEMBER") or (collaboration->member_status() == "OWNER") or (collaboration->member_status() == "ADMIN"))) {
    _processing_error ="not a member of collaboration, so unable to share data with it";
    return show_user();
  }

  //
  // next see if I am the owner of all of the database/peer that I am trying to share
  //
  EEDB::SPStreams::FederatedSourceStream *stream = new EEDB::SPStreams::FederatedSourceStream;
  stream->add_seed_peer(user_reg);   //only search in my user registry (my uploads)

  map<string, EEDB::Peer*>           share_peer_uuids;
  map<string, EEDB::Peer*>::iterator it_peer;

  if(_parameters.find("sharedb_uuid") != _parameters.end()) {
    string sharedb_uuid = _parameters["sharedb_uuid"];  //might be uuid, or DataSource style
    string uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(sharedb_uuid, uuid, objID, objClass);
    if(uuid.empty()) { uuid = sharedb_uuid; }
    share_peer_uuids[uuid] = NULL;
    stream->add_peer_id_filter(uuid);  //only search for requested sharedb peer
  }
  
  if(!_filter_peer_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_peer_ids.begin(); it2 != _filter_peer_ids.end(); it2++) {
      share_peer_uuids[(*it2).first] = NULL;
      stream->add_peer_id_filter((*it2).first);
    }
  }
  
  if(!_filter_source_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
      string uuid, objClass;
      long int objID;
      MQDB::unparse_dbid((*it2).first, uuid, objID, objClass);
      if(!uuid.empty()) {
        share_peer_uuids[uuid] = NULL;
        stream->add_peer_id_filter(uuid);
      }
    }
  }

  //next stream the peers based on the filters set above and check against requested peer/sources
  stream->stream_peers();
  while(EEDB::Peer *peer = (EEDB::Peer*)stream->next_in_stream()) {
    if(share_peer_uuids[peer->uuid()] == NULL) {
      share_peer_uuids[peer->uuid()] = peer;
    }
  }

  //last loop on these peers and process the sharing and collect errors
  
  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  
  printf("<share_uploaded_database>\n");

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  printf("%s\n", collaboration->simple_xml().c_str());

  for(it_peer=share_peer_uuids.begin(); it_peer!=share_peer_uuids.end(); it_peer++) {
    EEDB::Peer* peer = it_peer->second;
    if(!peer) {
      _processing_error +="unable to find database["+(it_peer->first) + "]; ";
      continue;
    }
    string error = collaboration->share_peer_database(peer);
    if(error.empty()) {
      printf("<share>%s</share>\n", peer->xml().c_str());
    } else {
      _processing_error += error + "; ";
    }
  }
  
  if(!_processing_error.empty()) { printf("<ERROR>%s</ERROR>\n", _processing_error.c_str()); }

  struct timeval  endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</share_uploaded_database>\n");
}


void EEDB::WebServices::UserSystem::unshare_uploaded_database() {
  //fprintf(stderr, "unshare_uploaded_database\n");
  if(!_user_profile) {
    _processing_error ="no login profile";
    return show_user(); 
  }
  
  //
  // first see if the database/peer we are trying to share is something I have the 
  // privelidge to share
  //
  string sharedb_uuid = _parameters["sharedb_uuid"];  //might be uuid, or FeatureSource style
  string uuid, objClass;
  long int objID;  
  MQDB::unparse_dbid(sharedb_uuid, uuid, objID, objClass);
  if(uuid.empty()) { uuid = sharedb_uuid; }
  
  //user_registry is MINE-and-only-mine mini-federation. 
  //so all data in there is something I have uploaded and are responsible for
  
  EEDB::Peer *user_reg = _user_profile->user_registry();
  if(!user_reg) {
    _processing_error ="no user profile registry";
    return show_user();
  }
  
  EEDB::SPStreams::FederatedSourceStream *stream = new EEDB::SPStreams::FederatedSourceStream;
  stream->add_seed_peer(user_reg);
  stream->add_peer_id_filter(uuid);  //only search for requested sharedb peer
  
  
  EEDB::Peer *sharedb_peer = NULL;
  stream->stream_peers();
  while((sharedb_peer = (EEDB::Peer*)stream->next_in_stream())) {
    if(sharedb_peer->uuid() == uuid) { break; }
  }
  if(!sharedb_peer or (sharedb_peer->uuid() != uuid)) {
    _processing_error ="unable to find uploaded database";
    return show_user();
  }
  //fprintf(stderr, "unsharedb %s\n", sharedb_peer->xml().c_str());
  
  //
  // next get the collaboration we are trying to unshare from 
  //
  EEDB::Collaboration *collaboration = NULL;
  
  if(_parameters["collaboration_uuid"] == "public") {
    collaboration = _public_collaboration;
  } else if(_parameters["collaboration_uuid"] == "curated") {
    collaboration = _curated_collaboration;
  } else {
    collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, _parameters["collaboration_uuid"]);
  }
  
  if(!collaboration) {
    _processing_error ="collaboration ["+ _parameters["collaboration_uuid"] +"] not found";
    return show_user();
  }
  
  if(!((collaboration->member_status() == "MEMBER") or (collaboration->member_status() == "OWNER") or (collaboration->member_status() == "ADMIN"))) {
    _processing_error ="not a member of collaboration, so unable to share data with it";
    return show_user();
  }
  //fprintf(stderr, "%s\n", collaboration->simple_xml().c_str());
  
  string error = collaboration->unlink_shared_peer(sharedb_peer);
  if(!error.empty()) {
    _processing_error = error;
    return show_user();
  }
  

  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  
  printf("<unshare_uploaded_database>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  printf("<unshare>%s</unshare>\n", sharedb_peer->xml().c_str());
  printf("%s\n", collaboration->xml().c_str());
  
  struct timeval  endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</unshare_uploaded_database>\n");
}


void EEDB::WebServices::UserSystem::update_config_sources() {  
  /*
  if(!defined($self->{'user_profile'})) { return; }
  my $user_reg = $self->{"user_profile"}->user_registry;
  unless($user_reg) { return; }

  my $regDB = $user_reg->peer_database;

  EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_autoconfigs", $regDB);

  my $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_configs", $regDB);
  $fsrc->metadataset->add_tag_data("eedb:display_name", "user private gLyphs configs");
  $fsrc->store_metadata;

  $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyph_track_configs", $regDB);
  $fsrc->metadataset->add_tag_data("eedb:display_name", "user private track configs");
  $fsrc->store_metadata;

  $fsrc = EEDB::FeatureSource->create_from_name("config::ZENBU_script_configs", $regDB);
  $fsrc->metadataset->add_tag_data("eedb:display_name", "user private scripts");
  $fsrc->store_metadata;
  */
}


void EEDB::WebServices::UserSystem::upgrade_user_uploads() {
  if(!_user_profile) {
    _processing_error ="no login profile";
    return show_user(); 
  }
  EEDB::Peer *user_reg = _user_profile->user_registry();
  if(!user_reg) {
    _processing_error ="no user profile registry";
    return show_user();
  }
  
  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<upgrade_user_uploads>\n");  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  
  
  EEDB::SPStreams::FederatedSourceStream *stream = new EEDB::SPStreams::FederatedSourceStream;
  stream->add_seed_peer(user_reg);  

  if(!_filter_peer_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_peer_ids.begin(); it2 != _filter_peer_ids.end(); it2++) {
      stream->add_peer_id_filter((*it2).first);
    }
  }
  
  stream->stream_peers();
  int upgrade_count=0;
  int total_peer_count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(!(peer->is_valid())) { continue; /*printf("not valid\n");*/ }
    total_peer_count++;
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) { 
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(oscdb->oscdb_version() == 1) {
        printf("<upgrade>");
        printf("%s\n", peer->xml().c_str());
        if(!oscdb->upgrade_db()) { printf("<note>problem with upgrade</note></upgrade>"); continue; }
                                          
        EEDB::FeatureSource *fsrc = oscdb->oscfileparser()->primary_feature_source();
        if(fsrc) {
          vector<EEDB::Metadata*> metadata = fsrc->metadataset()->find_all_metadata_like("eedb:shared_in_collaboration", "");
          for(unsigned int i=0; i<metadata.size(); i++) {
            string collab_uuid = metadata[i]->data();
            EEDB::Collaboration *collaboration = EEDB::Collaboration::fetch_by_uuid(_user_profile, collab_uuid);
            if(collaboration) {
              //collaboration->metadataset()->add_tag_symbol("eedb:sharedb_peer_uuid", peer->uuid());
              //collaboration->store_metadata();
              printf("%s", collaboration->simple_xml().c_str());
            }            
          }
        }
        upgrade_count++; 
        printf("</upgrade>");
      }
    }
  }  
  printf("<upgrade_stats total_peers=\"%d\" upgraded=\"%d\" />", total_peer_count, upgrade_count);
  
  struct timeval  endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</upgrade_user_uploads>\n");
}


// -------------------------------------------------------------------


void EEDB::WebServices::UserSystem::edit_objects_metadata() {
  //works from a list of specified objects to edit (via _filter_ids_array)
  if(!_user_profile) {
    _processing_error ="no login profile";
    return show_user(); 
  }
  if(_filter_ids_array.empty()) {
    _processing_error ="must specify specific objects to edit";
    return show_user(); 
  }  

  EEDB::SPStream  *stream = source_stream();
  int object_count=0;
  
  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<edit_metadata>\n");  
  printf("%s", _user_profile->simple_xml().c_str());
  
  printf("<edited_objects>\n");
  vector<string>::iterator  it;
  for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
    
    MQDB::DBObject *obj = NULL;
    if((*it).find("::") != string::npos) {
      obj = stream->fetch_object_by_id(*it);
    } else {
      obj = EEDB::Configuration::fetch_by_uuid(_userDB, *it, _user_profile);
    }
    if(obj==NULL) { continue; }
  
    if(apply_mdata_edit_commands(obj, _mdata_edit_commands[*it])) {
      save_mdata_edits(obj);
      object_count++;
      printf("%s", obj->xml().c_str());
    }
  }
  printf("</edited_objects>\n");
  
  struct timeval  endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" count=\"%d\" />\n", runtime, object_count);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</edit_metadata>\n");
}


void EEDB::WebServices::UserSystem::source_search_edit_metadata() {
  //works by streaming sources (opt filters) and then applying edits based on matches (id or filter)
  struct timeval  endtime, time_diff;
  double runtime;

  if(!_user_profile) {
    _processing_error ="no login profile";
    return show_user(); 
  }  
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  fprintf(stderr, "UserSystem::source_search_edit_metadata start at %1.3f msec\n", runtime);

  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<edit_metadata>\n");  
  printf("%s", _user_profile->simple_xml().c_str());
  
  _collaboration_filter = "private";
  EEDB::SPStream  *stream = source_stream();
  long edit_count=0;
  
  string source_mode ="";
  if(_parameters["submode"] == string("feature_sources")) { source_mode = "FeatureSource"; }
  if(_parameters["submode"] == string("experiments")) { source_mode = "Experiment"; }
  
  if(_parameters.find("filter") != _parameters.end()) {
    printf("<filter>%s</filter>\n",html_escape(_parameters["filter"]).c_str());
    stream->stream_data_sources(source_mode, _parameters["filter"]);
  } else {
    stream->stream_data_sources(source_mode);
  }
  
  printf("<edited_objects>\n");

  map<string, EEDB::Peer*>            saveable_peers;
  map<string, EEDB::Peer*>::iterator  peer_it;

  long search_count=0;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    search_count++;
    if(!source->peer_uuid()) { 
      //something wrong or a 'proxy' source
      fprintf(stderr, "UserSystem: source without peer_uuid - source_search_edit_metadata\n");
      continue;
    }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }
    
    //check peer is valid
    if(!source->peer_uuid()) { continue; }
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { continue; }
    if(!(peer->is_valid())) { continue; }

    //check ownership & mdset
    if(!_user_profile->match(source->owner_identity())) { continue; }
    source->clear_xml_caches();
    EEDB::MetadataSet* mdset = source->metadataset();
    if(!mdset) { 
      fprintf(stderr, "UserSystem: mdedit error -no mdset [%s]\n", source->db_id().c_str());
      continue;
    }

    //find matching filter
    bool  modified = false;
    map<string, vector<mdedit_t> >::iterator  it2;
    vector<mdedit_t>::iterator                mdedit;
    for(it2 = _mdata_edit_commands.begin(); it2 != _mdata_edit_commands.end(); it2++) {
      if(mdset->check_by_filter_logic((*it2).first)) {
        fprintf(stderr, "UserSystem: source [%s] match filter [%s]\n", source->display_name().c_str(), (*it2).first.c_str());
        //apply commands here
        if(apply_mdata_edit_commands(source, _mdata_edit_commands[(*it2).first])) { modified = true; }
      }
    }
 
    if(modified) {
      //save changes here
      edit_count++;
      printf("%s", source->xml().c_str()); //output XML returned
      //check for SourceStream mysql/sqlite objects, otherwise collate peers
      if((peer->driver() == "mysql") || (peer->driver() == "sqlite")) {
        if(source->classname() == EEDB::FeatureSource::class_name) {
          EEDB::FeatureSource* fsrc = (EEDB::FeatureSource*)source;
          MQDB::Database *db = fsrc->database();
          if(db && (db->user() != "zenbu_admin")) { //reset password
            db->disconnect();
            db->user("zenbu_admin");
            db->password(_user_admin_password);
          }
          fsrc->update_metadata();
        }
        if(source->classname() == EEDB::EdgeSource::class_name) {
          //((EEDB::EdgeSource*)obj)->update_metadata();
        }
        if(source->classname() == EEDB::Experiment::class_name) {
          EEDB::Experiment* exp = (EEDB::Experiment*)source;
          MQDB::Database *db = exp->database();
          if(db && (db->user() != "zenbu_admin")) { //reset password
            db->disconnect();
            db->user("zenbu_admin");
            db->password(_user_admin_password);
          }
          exp->update_metadata();
        }
      } else {
        saveable_peers[uuid] = peer;
      } 
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double stream_runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  fprintf(stderr, "UserSystem::source_search_edit_metadata after streaming %1.3f sec\n", stream_runtime);

  fprintf(stderr, "UserSystem::source_search_edit_metadata %ld peers to save\n", saveable_peers.size());
  for(peer_it = saveable_peers.begin(); peer_it != saveable_peers.end(); peer_it++) {
    if((*peer_it).first.empty()) { continue; }
    if(!(*peer_it).second) { continue; }
    
    EEDB::SPStreams::SourceStream *sourcestream = (*peer_it).second->source_stream();
    fprintf(stderr, "UserSystem: mdedit save %s\n", (*peer_it).second->simple_xml().c_str());
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(!oscdb->save_xmldb()) { fprintf(stderr, "OSCDB save error\n"); }
    }
    else if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
      if(!bamdb->save_xmldb()) { fprintf(stderr, "BAMDB save error\n"); }
    }
    else if(sourcestream->classname() == EEDB::ZDX::ZDXstream::class_name) {
      EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)sourcestream;
      if(!zdxstream->write_source_section()) { fprintf(stderr, "ZDXDB save error\n"); }
    }
  }
  
  printf("</edited_objects>\n");

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;

  fprintf(stderr, "UserSystem::source_search_edit_metadata %ld sources, %ld edited : %1.3f msec\n", search_count, edit_count, runtime);
  
  printf("<process_summary processtime_sec=\"%1.6f\" stream_runtime=\"%1.3f\" count=\"%ld\" />\n", runtime, stream_runtime, edit_count);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</edit_metadata>\n");
}


bool EEDB::WebServices::UserSystem::apply_mdata_edit_commands(MQDB::DBObject *obj, vector<mdedit_t> &cmds) {
  if(obj==NULL) { return false; }
  if(cmds.empty()) { return false; }

  EEDB::DataSource    *source  = NULL;
  EEDB::Feature       *feature = NULL;
  EEDB::Configuration *config  = NULL;
  string               obj_id = obj->db_id();
  
  if(obj->classname() == EEDB::Feature::class_name)       { feature = (EEDB::Feature*)obj; }
  if(obj->classname() == EEDB::FeatureSource::class_name) { source = (EEDB::DataSource*)obj; }
  if(obj->classname() == EEDB::EdgeSource::class_name)    { source = (EEDB::DataSource*)obj; }
  if(obj->classname() == EEDB::Experiment::class_name)    { source = (EEDB::DataSource*)obj; }
  if(obj->classname() == EEDB::Configuration::class_name) { config = (EEDB::Configuration*)obj; obj_id = config->uuid(); }
  
  EEDB::MetadataSet* mdset = NULL;
  
  if(source) {
    if(!_user_profile->match(source->owner_identity())) { return false; }
    source->clear_xml_caches();
    mdset = source->metadataset();
  }
  /*
  if(feature) {
    //only specific feature metadata editing will be allowed, like configurations
    EEDB::Metadata *md = feature->metadataset()->find_metadata("eedb:owner_OpenID", "");
    if(!md or (md->data() != _user_profile->openID())) { return false; }
    mdset = feature->metadataset();
  }
  */
  if(config) {
    if(!_user_profile->match(config->owner())) { return false; }
    mdset = config->metadataset();
  }   
  if(!mdset) { 
    fprintf(stderr, "FAILED apply_mdata_edit_commands [%s]\n", obj->db_id().c_str());
    return false; 
  }
  
  vector<mdedit_t>::iterator  mdedit;
  //first check if at least one of the commands applies to this object
  bool editable = false;
  for(mdedit = cmds.begin(); mdedit != cmds.end(); mdedit++) {
    if(!mdedit->db_id.empty()) {
      if(mdedit->db_id != obj_id) { 
        //fprintf(stderr, "[%s] != [%s]\n", mdedit->db_id.c_str(), obj_id.c_str());
        continue; 
      }
    }
    if(!mdedit->obj_filter.empty()) {
      if(!mdset->check_by_filter_logic(mdedit->obj_filter)) { continue; }
    }
    editable = true;
    break;
  }
  if(!editable) { return false; }

  //fprintf(stderr, "apply_mdata_edit_commands [%s]\n", obj_id.c_str());
  for(mdedit = cmds.begin(); mdedit != cmds.end(); mdedit++) {
    if(!mdedit->db_id.empty()) {
      if(mdedit->db_id != obj_id) { continue; }
      //fprintf(stderr, "id-match ");
    }
    if(!mdedit->obj_filter.empty()) {
      if(!mdset->check_by_filter_logic(mdedit->obj_filter)) { continue; }
      //fprintf(stderr, "filter[%s] ", mdedit->obj_filter.c_str());
    }
    //fprintf(stderr, "mdedit +%s+ (%s) [%s] [%s] -- %s\n", 
    //        mdedit->mode.c_str(), mdedit->tag.c_str(), mdedit->newvalue.c_str(), mdedit->oldvalue.c_str(),
    //        obj_id.c_str());
    
    if(mdedit->mode == "add") {
      mdset->add_tag_data(mdedit->tag, mdedit->newvalue);
    }
    
    if(mdedit->mode == "delete") {
      mdset->remove_metadata_like(mdedit->tag, mdedit->newvalue);
    }
    
    if(mdedit->mode == "change") {
      if(mdedit->tag == "description") { 
        mdset->remove_metadata_like(mdedit->tag, ""); 
      } else { 
        mdset->remove_metadata_like(mdedit->tag, mdedit->oldvalue); 
      }
      mdset->add_tag_data(mdedit->tag, mdedit->newvalue);
    }
  }
  
  //always rebuild the keywords
  mdset->remove_metadata_like("keyword", ""); 
  mdset->extract_keywords();
  
  //maybe apply some general cleanup here for old tags    
  mdset->remove_duplicates();
  
  //done
  //fprintf(stderr, "%s", obj->xml().c_str());
  return true;
}


void EEDB::WebServices::UserSystem::save_mdata_edits(MQDB::DBObject *obj) {
  //several if statements here
  //first is it an XMLdb database or a MQDB database
  //then what is the class and how do we record changes
  if(!obj) { return; }
  
  if(obj->classname() == EEDB::Configuration::class_name) { 
    EEDB::Configuration* config = (EEDB::Configuration*)obj; 
    //printf("%s", config->xml().c_str());
    config->update_metadata();
    return;
  }
  
  if(!obj->peer_uuid()) { return; }
  string uuid = obj->peer_uuid();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(!peer) { return; }
  
  if(!(peer->is_valid())) { 
    fprintf(stderr, "save_mdata_edits peer %s not valid\n", uuid.c_str());
    return;
  }
    
  EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
  if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
    if(oscdb->save_xmldb()) { return; }
  }
  else if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
    if(bamdb->save_xmldb()) { return; }
  }
  else if(sourcestream->classname() == EEDB::ZDX::ZDXstream::class_name) {
    EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)sourcestream;
    if(zdxstream->write_source_section()) { return; }
  }
  else if(sourcestream->classname() == EEDB::SPStreams::SourceStream::class_name) {  
    if(obj->classname() == EEDB::Feature::class_name) {
      EEDB::Feature *feature = (EEDB::Feature*)obj;
      MQDB::Database *db = feature->database();
      if(db && (db->user() != "zenbu_admin")) { //reset password
        db->disconnect();
        db->user("zenbu_admin");
        db->password(_user_admin_password);
      }
      feature->update_metadata();
    }
    if(obj->classname() == EEDB::FeatureSource::class_name) {
      EEDB::FeatureSource* source = (EEDB::FeatureSource*)obj;
      MQDB::Database *db = source->database();
      if(db && (db->user() != "zenbu_admin")) { //reset password
        db->disconnect();
        db->user("zenbu_admin");
        db->password(_user_admin_password);
      }
      source->update_metadata();
    }
    if(obj->classname() == EEDB::EdgeSource::class_name) {
      //((EEDB::EdgeSource*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::Experiment::class_name) {
      EEDB::Experiment* source = (EEDB::Experiment*)obj;
      MQDB::Database *db = source->database();
      if(db && (db->user() != "zenbu_admin")) { //reset password
        db->disconnect();
        db->user("zenbu_admin");
        db->password(_user_admin_password);
      }
      source->update_metadata();
    }
  }
    
}


void EEDB::WebServices::UserSystem::show_downloads() {  
  printf("Content-type: text/xml; charset=utf-8\r\n");
  printf("Set-Cookie: %s=%s; SameSite=Lax; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  
  printf("<user_downloads>\n");
  
  if(_user_profile) { 
    printf("%s", _user_profile->simple_xml().c_str()); 
  
    vector<DBObject*> requests = EEDB::TrackRequest::fetch_by_user(_user_profile);
    for(unsigned i=0; i<requests.size(); i++) {
      EEDB::TrackRequest *req = (EEDB::TrackRequest*)requests[i];
      printf("%s", req->xml().c_str());
    }
  }
  
  struct timeval endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user_downloads>\n");
}




