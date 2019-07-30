/* $Id: WebBase.cpp,v 1.223 2019/07/30 09:57:29 severin Exp $ */

/***

NAME - EEDB::SPStream

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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
#include <openssl/hmac.h>
//#include <yaml.h>
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
#include <EEDB/Expression.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/SPStreams/CachePoint.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/WebServices/MetaSearch.h>

#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 


using namespace std;
using namespace MQDB;

const char*     EEDB::WebServices::WebBase::class_name = "EEDB::WebServices::WebBase";

const char*     EEDB::WebServices::WebBase::zenbu_version = "3.0.0";

map<string,string>  EEDB::WebServices::WebBase::global_parameters;


string  unescape_parameter(string data) {
  string t_data = data;
  boost::algorithm::replace_all(t_data, "%20", " ");
  //boost::algorithm::replace_all(t_data, "%3A", ":");
  //boost::algorithm::replace_all(t_data, "%2F", "/");
  //boost::algorithm::replace_all(t_data, "%3F", "?");
  //boost::algorithm::replace_all(t_data, "%3D", "=");
  //boost::algorithm::replace_all(t_data, "%26", "&");
  //boost::algorithm::replace_all(t_data, "%25", "%");  
  return t_data;
}


/*
void check_over_memory() {
  double vm_usage, resident_set;
  MQDB::process_mem_usage(vm_usage, resident_set);
  //fprintf(stderr, "process_mem_usage %1.3fMB res\n", resident_set/1024.0);
  if(resident_set > 4*1024*1024) { //4GB
    fprintf(stderr, "self destruct, using %f MB memory\n", resident_set/1024.0);
    throw(17);
  }
}
*/


EEDB::WebServices::WebBase::WebBase() {
  init();
}

EEDB::WebServices::WebBase::~WebBase() {
  disconnect();
  if(_source_stream != NULL) { _source_stream->release(); }
}

void _eedb_webbase_delete_func(MQDB::DBObject *obj) { 
  if(obj) { delete (EEDB::WebServices::WebBase*)obj; }
}

void EEDB::WebServices::WebBase::init() {
  MQDB::DBObject::init();
  _classname      = EEDB::WebServices::WebBase::class_name;
  _funcptr_delete = _eedb_webbase_delete_func;

  gettimeofday(&_launch_time, NULL);
  _connection_count = 0;
  _session_name = "CGISESSID";
  _userDB  = NULL;
  _user_profile = NULL;
  _user_admin_password = "zenbu_admin";
  _peer_search_depth = 9;
  _public_collaboration = NULL;
  _curated_collaboration = NULL;
  _collaboration_filter = "all";
  _source_stream = NULL;
  _autobuild_cache_on_region_query = false;;
  _cross_domain_access_origins = "";
}

////////////////////////////////////////////////////////////////////////////////////////


void EEDB::WebServices::WebBase::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::WebServices::WebBase::display_desc() {
  string xml = "WebBase[";
  xml += _classname;
  xml += "]";
  return xml;
}

string EEDB::WebServices::WebBase::display_contents() {
  return display_desc();
}

string EEDB::WebServices::WebBase::xml_start() {
  string xml = "<webservice>";
  return xml;
}

string EEDB::WebServices::WebBase::xml_end() {
  return "</webservice>";
}

string EEDB::WebServices::WebBase::simple_xml() {
  return xml_start() + xml_end();
}

/***** xml

  Description: returns an XML description of this instance of SPStream and 
               then calls the source_stream to get its XML effectively creating a 
               signal-processing stack until it reaches an EEDB::WebServices::WebBase::SourceStream.
               Each subclass must implement a proper xml_start().
               The superclass xml_end() will work in all cases. No need to override this method.
  Returntype : string scalar 
  Exceptions : none 
  Default    : default is a simple xml_start + xml_end 

*****/

string EEDB::WebServices::WebBase::xml() {
  string xml = xml_start();
  //if(_source_stream  != NULL) {
  //  xml += _source_stream->xml();
  //}
  xml += xml_end();
  return xml;
}


////////////////////////////////////////////////////////////////////////////


void  EEDB::WebServices::WebBase::get_post_data() {
  long long  readCount=0;
  char       *readbuf;
  int        readBufSize = 8192;
  size_t     p2;
  
  readbuf = (char*)malloc(readBufSize + 10);

  while(!feof(stdin)) {
    memset(readbuf, 0, readBufSize + 10);
    readCount = (int)fread(readbuf, 1, readBufSize, stdin);
    _post_data.append(readbuf);
  }
  
  free(readbuf);

  if((p2=_post_data.find("POSTDATA=")) == 0) {
    string tstr = _post_data.substr(9);
    MQDB::urldecode(tstr);
    _post_data = tstr;
    //fprintf(stderr, "received POSTDATA : %s\n", tstr.c_str());
  }
  return;
}


void EEDB::WebServices::WebBase::set_post_data(string value) {
  //used for debugging
  _post_data.clear();
  _post_data = value;
}


void EEDB::WebServices::WebBase::set_parameter(string tag, string value) {
  //used for debugging
  _parameters[tag] = value;
}

void EEDB::WebServices::WebBase::set_user_profile(EEDB::User* user) {
  //used for debugging
  _user_profile = user;
  EEDB::SPStreams::RemoteServerStream::set_current_user(_user_profile);
  EEDB::SPStreams::CachePoint::set_current_user(_user_profile);
}

void EEDB::WebServices::WebBase::init_service_request() {
  gettimeofday(&_starttime, NULL);
  _connection_count++;

  //first need to clear all parameters from last request
  _parameters.clear();
  _post_data.clear();
  _filter_source_ids.clear();
  _filter_peer_ids.clear();
  _filter_source_names.clear();
  _filter_ids_array.clear();

  MQDB::DBCache::clear_cache();
  
  connect_userDB(); //tests connection to userDB, reconnects if lost

  //get new parameters
  get_webservice_url();  
  get_session_user();
  
  //set default values
  _collaboration_filter = "all";
  _parameters["source_outmode"] = "simple_feature";
}


bool  EEDB::WebServices::WebBase::process_url_request() {
  init_service_request();

  get_url_parameters();

  postprocess_parameters();

  return execute_request();
}


bool  EEDB::WebServices::WebBase::execute_request() {
  ////////////////////////// 
  // now process request
  //

  if(_parameters["reload_sources"] == string("ce818eaf70485e496")) {
    show_peers();
    return true;
  }

  if(_parameters["mode"] == string("status")) {
    show_status();
  } else if(_parameters["mode"] == string("sysload")) {    
    show_system_load();
  } else if(_parameters["mode"] == string("peers")) {
    show_peers();
  } else if((_parameters["mode"] == string("chrom")) || (_parameters["mode"] == string("genome"))) {
    show_chromosomes();
  } else if(_parameters["mode"] == string("objects")) {
    show_objects();
  } else if(_parameters["mode"] == string("object")) {
    show_single_object();
  } else {
    //do not know what to do
    return false;
  }

  return true;
}


void EEDB::WebServices::WebBase::get_url_parameters() {
  if(!getenv("QUERY_STRING")) { return; }
  
  string t_params = getenv("QUERY_STRING");
  size_t  p2, p3;
  
  if(t_params.empty()) { return; }

  while(!t_params.empty()) {
    string t_token = t_params;
    if((p2=t_params.find_first_of("&;")) != string::npos) {
      t_token  = t_params.substr(0, p2);
      t_params = t_params.substr(p2+1);
    } else { t_params.clear(); }
    
    if((p3=t_token.find("=")) != string::npos) {
      string tag   = t_token.substr(0, p3);
      string value = unescape_parameter(t_token.substr(p3+1));
      //string value = t_token.substr(p3+1);
      _parameters[tag] = value;
    }
  }
}


void  EEDB::WebServices::WebBase::postprocess_parameters() {
  //first convert aliased paramter names to official internal name
  if(_parameters.find("asm") != _parameters.end())        { _parameters["assembly_name"] = _parameters["asm"]; }
  if(_parameters.find("width") != _parameters.end())      { _parameters["window_width"] = _parameters["width"]; }
  if(_parameters.find("datatype") != _parameters.end())   { _parameters["exptype"] = _parameters["datatype"]; }
  if(_parameters.find("segment") != _parameters.end())    { _parameters["loc"] = _parameters["segment"]; }
  if(_parameters.find("chrom") != _parameters.end())      { _parameters["chrom_name"] = _parameters["chrom"]; }
  if(_parameters.find("reload") != _parameters.end())     { _parameters["reload_sources"] = _parameters["reload"]; }
  if(_parameters.find("peer_names") != _parameters.end()) { _parameters["peers"] = _parameters["peer_names"]; }

  if(_parameters.find("types") != _parameters.end())        { _parameters["fsource_names"] =  _parameters["types"]; }
  if(_parameters.find("sources") != _parameters.end())      { _parameters["fsource_names"] =  _parameters["sources"]; }
  if(_parameters.find("source_names") != _parameters.end()) { _parameters["fsource_names"] =  _parameters["source_names"]; }

  if(_parameters.find("srcfilter") != _parameters.end())  { _parameters["filter"]    =  _parameters["srcfilter"]; }
  if(_parameters.find("expfilter") != _parameters.end())  { _parameters["filter"]    =  _parameters["expfilter"]; }
  if(_parameters.find("exp_filter") != _parameters.end()) { _parameters["filter"]    =  _parameters["exp_filter"]; }

  if(_parameters.find("collab") != _parameters.end())        { _collaboration_filter    =  _parameters["collab"]; }
  if(_parameters.find("collaboration") != _parameters.end()) { _collaboration_filter    =  _parameters["collaboration"]; }
  
  if(_parameters.find("ids") != _parameters.end())        { _parameters["id_list"] =  _parameters["ids"]; }  

  if(_parameters.find("depth") != _parameters.end()) { 
    _peer_search_depth = strtol(_parameters["depth"].c_str(), NULL, 10);
    if(_peer_search_depth < 1) { _peer_search_depth = 1; }
  }

  //$self->{'fsrc_names'} = $cgi->param('fsrc_filters') if(defined($cgi->param('fsrc_filters')));
  //$self->{'fsrc_names'} = $cgi->param('types') if(defined($cgi->param('types')));
  //$self->{'fsrc_names'} = $cgi->param('sources') if(defined($cgi->param('sources')));  
  
  if(_parameters.find("peer")!=_parameters.end()) {
    _filter_peer_ids[_parameters["peer"]] = true;
    if(_parameters.find("mode")==_parameters.end()) { _parameters["mode"] = "peers"; }
  }

  if(_parameters.find("peers")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["peers"].size()+2);
    strcpy(buf, _parameters["peers"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) { _filter_peer_ids[p1] = true; }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
    if(_parameters.find("mode")==_parameters.end()) { _parameters["mode"] = "peers"; }
  }
  
  if(_parameters.find("id")!=_parameters.end()) {
    string id = _parameters["id"];
    size_t p1;
    if((p1 = id.find("::")) != string::npos) {
      string uuid = id.substr(0, p1);
      _filter_peer_ids[uuid] = true;
    }
  }
  
  if(_parameters.find("source_ids")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["source_ids"].size()+2);
    strcpy(buf, _parameters["source_ids"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        _filter_source_ids[p1] = true;
        string id = p1;
        size_t p2;
        if((p2 = id.find("::")) != string::npos) {
          string uuid = id.substr(0, p2);
          _filter_peer_ids[uuid] = true;
        }
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }

  //setup _filter_ids_array
  if(_parameters.find("id_list")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["id_list"].size()+2);
    strcpy(buf, _parameters["id_list"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        string id = p1;
        _filter_ids_array.push_back(id);
        size_t p2;
        if((p2 = id.find("::")) != string::npos) {
          string uuid = id.substr(0, p2);
          _filter_peer_ids[uuid] = true;
        }
        //if(($3 eq "FeatureSource") or ($3 eq "Experiment") or ($3 eq "EdgeSource")) {
        //  $self->{'filter_ids'}->{$id} = 1;
        //}
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
    if(_parameters.find("mode")==_parameters.end()) { _parameters["mode"] = "objects"; }
  }
  

  //setup _filter_source_names 
  if(_parameters.find("fsource_names")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["fsource_names"].size()+2);
    strcpy(buf, _parameters["fsource_names"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        string id = p1;
        _filter_source_names.push_back(id);
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  

  if((_parameters.find("id")!=_parameters.end()) && (_parameters.find("mode")==_parameters.end())) { 
    _parameters["mode"] = "object"; 
  }
  if(_parameters.find("format")==_parameters.end()) { 
    _parameters["format"] = "xml";
  }
  if(_parameters.find("format") != _parameters.end()) { 
    if(_parameters["format"].find("xml") != string::npos) {
      //format is a type of xml
      if(_parameters["format"] != "xml") {
        _parameters["format_mode"] = _parameters["format"];
        _parameters["format"] = "xml";
      }
    }
  }  
  if(_parameters.find("format_mode") != _parameters.end()) { 
    if(_parameters["format_mode"].find("xml") != string::npos) {
      _parameters["format"] = "xml";
      EEDB::SPStreams::RemoteServerStream::set_stream_output(_parameters["format_mode"]);
    }
  }
  
  if(_parameters["mode"] == string("feature")) { _parameters["mode"] = "object"; }
}


void EEDB::WebServices::WebBase::show_api() {
  struct timeval       endtime, time_diff;

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_launch_time, &time_diff);
  double   uptime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  long int uphours = (long int)floor(uptime/3600);
  double   upmins  = (uptime - (uphours*3600)) / 60.0;
  
  /*
  my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->id);
  printf $cgi->header(-cookie=>$cookie, -type => "text/html", -charset=> "UTF8");
  */

  printf("Content-type: text/html\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<!DOCTYPE html  PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n");

  printf("<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-US\" xml:lang=\"en-US\">\n");
  printf("<head>\n");
  printf("<title>ZENBU Fast CGI object server</title>\n");
  printf("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf8\" />\n");
  printf("</head>\n");
  printf("<body>\n");

  printf("<h1>ZENBU Fast CGI object server (c++)</h1>\n");
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
    //printf("<br>profile openIDs : <b>%s</b>\n",_user_profile->openIDs().c_str());
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
  

  /*  
  printf hr;
  printf h2("Object access methods");
  printf("<table cellpadding =3 width=100%>\n");
  printf("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  printf("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  printf("<tr><td>id=[federatedID]</td><td>directly access any object in federation. fedID format is [peer_uuid]::[id]:::[class]</td></tr>\n");
  printf("<tr><td>sources=[source_name,source_name,...]</td><td>used in combination with name=, and search= methods to restrict search. Both single or multiple type lists are available.</td></tr>\n");
  printf("<tr><td>peers=[peer_uuid, peer_alias,...]</td><td>used to restrict query to a specific set of peers. Can be used in combination with all modes.</td></tr>\n");
  printf("<tr><td>source_ids=[fedID, fedID,...]</td><td>used to restrict query to a specific set of sources. Can be used in combination with all modes.</td></tr>\n");
  printf("</table>\n");

  printf h2("Output formats");
  printf("<table cellpadding =3 width=100%>\n");
  printf("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  printf("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  printf("<tr><td>format=[xml,gff2,gff3,bed,tsv]</td><td>changes the output format of the result. XML is an EEDB/ZENBU defined XML format, while
GFF2, GFF3, and BED are common formats.  XML is supported in all access modes, but GFF2, GFF3, and BED are only available in direct feauture access modes. TSV (tab-separated-values) is only available in a few modes. Default format is XML.</td></tr>\n");
  printf("</table>\n");

  printf h2("Output modes");
  printf("<table cellpadding =3 width=100%>\n");
  printf("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  printf("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  printf("<tr><td>mode=feature_sources</td><td>returns XML of all available Feature sources. types= filter is available</td></tr>\n");
  printf("<tr><td>mode=edge_sources</td><td>returns XML of all available Edge sources. types= filter is available</td></tr>\n");
  printf("<tr><td>mode=experiments</td><td>returns XML of all available Experiments. types= filter is available</td></tr>\n");
  printf("<tr><td>mode=expression_datatypes</td><td>returns XML of all available Expression datatypes</td></tr>\n");
  printf("<tr><td>mode=peers</td><td>returns XML of all connected peers in the peer-peer database federation</td></tr>\n");
  printf("</table>\n");
  */
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<p>processtime_sec : %1.6f\n", total_time);
  printf("<hr/>\n");

  printf("</body>\n");
  printf("</html>\n");
}


void EEDB::WebServices::WebBase::show_status() {
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;

  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<zenbu_status>\n");

  printf("<version>%s</version>\n", zenbu_version);
  printf("<current_timestamp>%ld</current_timestamp>", _starttime.tv_sec);

  printf("<registry_seeds>\n");
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer) { printf("%s", peer->xml().c_str()); }
  }  
  printf("</registry_seeds>\n");

  printf("<web_url>%s</web_url>\n",_web_url.c_str());
  printf("<web_uuid>%s</web_uuid>\n",_web_uuid.c_str());

  //printf("<cache_stats peers=\"%s\" sources=\"%s\" />\n", scalar(@{EEDB::Peer->global_cached_peers}), scalar(keys(%$global_source_cache)));

  if(_user_profile) { printf("%s\n", _user_profile->simple_xml().c_str()); } 

  printf("<process_summary processtime_sec=\"%1.3f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</zenbu_status>\n");
}



////////////////////////////////////////////////////////////////////////////

bool EEDB::WebServices::WebBase::init_config(string path) {
  //new redirect file. contains a single line with path to actual config file
  //which should be somewhere outside of the apache web paths to protect passwords
  FILE *fp = fopen(path.c_str(), "r");
  if(fp) {
    char buffer[1024];
    fgets(buffer, 1020, fp);
    char* p1 = strstr(buffer, "\n");
    if(p1) { *p1= '\0'; }
    fclose(fp);
    return parse_config_file(buffer);
  }
  return false;
}


bool EEDB::WebServices::WebBase::parse_config_file(string path) {
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *node, *root_node;

  using namespace MQDB;
  
  //fprintf(stderr, "=== read config [%s]\n", path.c_str());
  //open config file, mmap into memory then copy into config_text
  fildes = open(path.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return false; } //error
  _parameters["webservice_config_file"] = path;
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  //printf("config file %lld bytes long\n", (long long)cfg_len);
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  //fprintf(stderr, "config:::%s\n=========\n", config_text);
  
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  } catch(rapidxml::parse_error &e) {
    free(config_text);
    return false;
  }

  root_node = doc.first_node();
  if(root_node->name() != string("zenbu_server_config")) { return false; }

  node = root_node->first_node("eedb_root");
  if(node) { setenv("EEDB_ROOT", node->value(), 1); }
  
  node = root_node->first_node("eedb_user_rootdir");
  if(node) { setenv("EEDB_USER_ROOTDIR", node->value(), 1); }
  
  node = root_node->first_node("user_db");
  if(node) { _userDB_url = node->value(); }

  node = root_node->first_node("user_admin_password");
  if(node) { _user_admin_password = node->value(); }
  
  node = root_node->first_node("session_name");
  if(node) { _session_name = node->value(); }
  
  node = root_node->first_node("default_genome");
  if(node) { _default_genome = node->value(); }

  node = root_node->first_node("web_root");
  if(node) { _web_url = node->value(); }

  node = root_node->first_node("web_uuid");
  if(node) { _web_uuid = node->value(); }

  node = root_node->first_node("server_name");
  if(node) { _server_name = node->value(); }

  node = root_node->first_node("cache_dir");
  if(node) { EEDB::TrackCache::cache_dir = node->value(); }

  node = root_node->first_node("smtp_server");
  if(node) { _smtp_server_url = node->value(); }
  node = root_node->first_node("smtp_user");
  if(node) { _smtp_server_user = node->value(); }
  node = root_node->first_node("smtp_password");
  if(node) { _smtp_server_passwd = node->value(); }
  node = root_node->first_node("smtp_from");
  if(node) { _smtp_from = node->value(); }

  node = root_node->first_node("autobuild_cache_on_region_query");
  if(node && (node->value()==string("true"))) { _autobuild_cache_on_region_query = true; }

  node = root_node->first_node("cross_domain_access_origins");
  if(node) { _cross_domain_access_origins = node->value(); }
  
  //seed peers
  rapidxml::xml_node<> *seed_root = root_node->first_node("federation_seeds");
  if(seed_root) {
    node = seed_root->first_node("seed");
    while(node) {
      _seed_urls.push_back(node->value());
      node = node->next_sibling("seed");
    }
    node = seed_root->first_node("local_mirror");
    while(node) {
      _local_mirror_urls.push_back(node->value());
      node = node->next_sibling("local_mirror");
    }    
  }

  //now config environment variables
  get_webservice_url();
  
  //then configure databases
  init_db();
  
  //public general use collaboration
  _public_collaboration = EEDB::Collaboration::fetch_by_uuid(_userDB, "public");
  if(!_public_collaboration) { 
    rapidxml::xml_node<> *public_collab = root_node->first_node("public_collaboration");
    if(public_collab) { 
      _public_collaboration = new EEDB::Collaboration();
      //TODO: what about not setting the owner?
      //_public_collaboration->owner_identity("public");
      _public_collaboration->open_to_public("y");
      _public_collaboration->group_uuid("public");
      _public_collaboration->primary_id(-1);
      
      node = public_collab->first_node("name");
      if(node) { _public_collaboration->display_name(node->value()); }
      
      node = public_collab->first_node("description");
      if(node) { _public_collaboration->metadataset()->add_tag_data("description", node->value()); }

      node = public_collab->first_node("database");
      if(node) { _public_collaboration->metadataset()->add_tag_data("group_registry", node->value()); }
      _public_collaboration->store_new(_userDB);
    }
  }
  if(_public_collaboration) { _public_collaboration->member_status("MEMBER"); }

  //curated collaboration
  rapidxml::xml_node<> *curated_collab = root_node->first_node("curated_collaboration");
  if(curated_collab) { 
    _curated_collaboration = EEDB::Collaboration::fetch_by_uuid(_userDB, "curated");
    if(!_curated_collaboration) { 
      _curated_collaboration = new EEDB::Collaboration();
      _curated_collaboration->member_status("not_member");
      //TODO: what about not setting the owner?
      //_curated_collaboration->owner_identity("curators");
      _curated_collaboration->open_to_public("y");
      _curated_collaboration->group_uuid("curated");
      _curated_collaboration->primary_id(-1);
      
      node = curated_collab->first_node("name");
      if(node) { _curated_collaboration->display_name(node->value()); }
      
      node = curated_collab->first_node("description");
      if(node) { _curated_collaboration->metadataset()->add_tag_data("description", node->value()); }
      
      node = curated_collab->first_node("database");
      if(node) { _curated_collaboration->metadataset()->add_tag_data("group_registry", node->value()); }
      
      _curated_collaboration->store_new(_userDB);
    
      //curation users
      rapidxml::xml_node<> *curators = curated_collab->first_node("curators");
      if(curators) {
        node = curators->first_node("user");
        while(node) {
          EEDB::User *user = EEDB::User::fetch_by_email(_userDB, node->value());
          if(user) {
            if(_curated_collaboration->database()) {
              const char *sql = "INSERT ignore INTO collaboration_2_user (collaboration_id, user_id, member_status) VALUES(?,?,?)";
              _curated_collaboration->database()->do_sql(sql, "dds", _curated_collaboration->primary_id(), user->primary_id(), "ADMIN");
            }
            //_curated_collaboration->add_user_member(user, "ADMIN");
          }
          node = node->next_sibling("user");
        }
      }
    }
  }
  
  free(config_text);
    
  return true;
}


void EEDB::WebServices::WebBase::init_db() {
  //first load all the local_mirror Peers into the global peer_cache
  //so that they are used over the original-remote peer
  EEDB::SPStreams::FederatedSourceStream  *fstream = new EEDB::SPStreams::FederatedSourceStream();
  fstream->set_peer_search_depth(_peer_search_depth);
  for(unsigned int i=0; i<_local_mirror_urls.size(); i++) {
    string url = _local_mirror_urls[i];
    EEDB::Peer *peer = EEDB::Peer::new_from_url(url);
    if(peer && peer->is_valid()) {
      fstream->add_seed_peer(peer);
    }
  }
  fstream->stream_peers();
  while(fstream->next_in_stream()) { }
  fstream->disconnect();
  fstream->release();

  _known_remote_peers.clear();

  //next setup the global seeds
  for(unsigned int i=0; i<_seed_urls.size(); i++) {
    string  url = _seed_urls[i];
    
    //try to configure
    EEDB::Peer* peer = EEDB::Peer::new_from_url(url);
    if(peer) {
      _seed_peers.push_back(peer); 
      if((peer->driver() == "http") or (peer->driver() == "zenbu")) {
        _known_remote_peers[peer->uuid()] = peer;
        //fprintf(stderr, "remote peer %s\n", peer->simple_xml().c_str());
      }
      peer->disconnect();
    } else {
      fprintf(stderr, "failed to init seed [%s]\n", url.c_str());
    }
  }
  
  connect_userDB();
}


bool EEDB::WebServices::WebBase::connect_userDB() {
  if(_userDB && _userDB->get_connection()) { return true; }
  if(_userDB_url.empty()) { return false; }
 
  if(!_userDB) {
    MQDB::Database *db = new MQDB::Database(_userDB_url);
    if(!db) { return false; }
    db->user("zenbu_admin");
    db->password(_user_admin_password);
    _userDB = db;
  }

  if(!_userDB->get_connection()) { return false; }

  dynadata value = _userDB->fetch_col_value("SELECT uuid FROM peer WHERE is_self=1");
  if(value.type == MQDB::STRING) { 
    char* uuid = (char*)malloc(value.i_string.length() + 3);
    strcpy(uuid, value.i_string.c_str());
    _userDB->uuid(uuid);
  }
  EEDB::SPStreams::CachePoint::set_userDB(_userDB);

  return true;
}


void EEDB::WebServices::WebBase::get_webservice_url() {
  string serverName, httpHost, serverPort, docURI, requestURI, scriptName;

  if(getenv("SERVER_NAME")) { serverName = getenv("SERVER_NAME"); }
  if(getenv("HTTP_HOST")) { httpHost = getenv("HTTP_HOST"); }
  if(getenv("SERVER_PORT")) { serverPort = getenv("SERVER_PORT"); }
  if(getenv("DOCUMENT_URI")) { docURI = getenv("DOCUMENT_URI"); }
  if(getenv("REQUEST_URI")) { requestURI = getenv("REQUEST_URI"); }
  if(getenv("SCRIPT_NAME")) { scriptName = getenv("SCRIPT_NAME"); }

  size_t p1 = scriptName.find("/cgi");
  if(p1!=string::npos) { scriptName = scriptName.substr(0,p1); }

  if(!serverName.empty()) { 
    if(_server_name.empty()) { _server_name = serverName; }
    if(_web_url.empty())     { _web_url = string("http://") + serverName + scriptName; }
  }

  EEDB::Peer::set_current_web_url(_web_url);
}


void EEDB::WebServices::WebBase::disconnect() {
  if(_userDB) { 
    _userDB->disconnect(); 
    //fprintf(stderr, "userDB %ld %s disconnect %ld times\n", (long)_userDB, _userDB->full_url().c_str(), _userDB->disconnect_count());
  }

  if(_source_stream != NULL) { 
    _source_stream->disconnect();
    _source_stream->release(); 
    _source_stream = NULL;
  }
  
  vector<EEDB::Peer*>::iterator  it;
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(peer) { peer->disconnect(); }
  }
  /*
  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->disconnect;
    $peer->uncache_stream_sources;
  }
  */  
}


void EEDB::WebServices::WebBase::get_session_user() {
  size_t  p2, p3, p4;
  string  cookie;

  _session_data.clear();
  _user_profile= NULL;
  EEDB::SPStreams::RemoteServerStream::set_current_user(NULL);
  EEDB::SPStreams::CachePoint::set_current_user(NULL);

  if(getenv("HTTP_COOKIE")) { cookie = getenv("HTTP_COOKIE"); }
  while(!cookie.empty()) {
    string t_token = cookie;
    if((p2=cookie.find(";")) != string::npos) {
      t_token  = cookie.substr(0, p2);
      cookie = cookie.substr(p2+1);
    } else { cookie.clear(); }
    
    if((p3=t_token.find("=")) != string::npos) {
      string tag   = t_token.substr(0, p3);
      string value = t_token.substr(p3+1);
      
      p4 = tag.find_first_not_of(" \t\n\r");
      if(p4!=string::npos and p4!=0) { tag = tag.substr(p4); }

      if(tag == _session_name) {
        _session_data["id"] = value;
      }
    }
  }
  if(!_userDB) { return; }
  if(!_userDB->get_connection()) { return; }
  if(_session_data["id"].empty()) {
    save_session();
    return;
  }
    
  const char *sql = "SELECT a_session FROM sessions WHERE id=?";
  dynadata sessionXML = _userDB->fetch_col_value(sql, "s", _session_data["id"].c_str());
  if(sessionXML.i_string.empty()) { 
    //no session so create one
    delete_session();
    save_session();
    return;
  }

  //
  // parse XML session 
  //
  int   xml_len      = sessionXML.i_string.size();
  char* session_text = (char*)malloc(xml_len+1);
  memset(session_text, 0, xml_len+1);
  memcpy(session_text, sessionXML.i_string.c_str(), xml_len);
  //fprintf(stderr, "session:::%s\n=========\n", session_text);  
  
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *node, *root_node;
  
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(session_text);
  } catch(rapidxml::parse_error &e) {
    free(session_text);
    return;
  }

  root_node = doc.first_node();
  if(!root_node) { return; }
  if(root_node->name() != string("zenbu_session")) { return; }

  //session is simple 1 layer tag/value schema
  node = root_node->first_node();
  while(node) {
    _session_data[node->name()] = node->value();
    node = node->next_sibling();
  }
  free(session_text);

  //update the last_access time for this session
  _userDB->do_sql("update sessions set last_access = NOW() WHERE id=?", "s", _session_data["id"].c_str());

  //remove old sessions
  //mysql> delete  from sessions where last_access < DATE_SUB(NOW(), INTERVAL 1 DAY) and a_session not like "%zenbu_login_user_identity%" ;

  //see if session is over 1 week, logout and make new session
  /*
  my $uptime = 60*60*24*14;
  if($self->{'session'}->{'SESSION_CTIME'}) {
    $uptime = time() - floor($self->{'session'}->{'SESSION_CTIME'});
  }
  if($uptime > 60*60*24*7) {
    $self->{'session'}->{'id'} = "";
    $self->{'session'}->{'eedb_validated_user_openid'} = "";
    save_session($self);
    return;
  }
  */

  //now check session for user openID and get user
  if(!_session_data["zenbu_login_user_identity"].empty()) {
    string user_ident = _session_data["zenbu_login_user_identity"];
    EEDB::User *user = EEDB::User::fetch_by_email(_userDB, user_ident);
    if(user) { 
      _user_profile = user; 
      EEDB::SPStreams::RemoteServerStream::set_current_user(_user_profile);
      EEDB::SPStreams::CachePoint::set_current_user(_user_profile);
    }
  }
  else if(!_session_data["eedb_validated_user_openid"].empty()) {
    string openID = _session_data["eedb_validated_user_openid"];
    EEDB::User *user = EEDB::User::fetch_by_openID(_userDB, openID);
    if(user) { 
      _user_profile = user; 
      EEDB::SPStreams::RemoteServerStream::set_current_user(_user_profile);
      EEDB::SPStreams::CachePoint::set_current_user(_user_profile);
    }
  }
}


void EEDB::WebServices::WebBase::delete_session() {
  if(!_userDB) { return; }
  if(_session_data["id"].empty()) { return; }
    
   _userDB->do_sql("DELETE from sessions WHERE id=?", "s", _session_data["id"].c_str());
  _session_data["id"].clear();
  //keep rest of session data intact
}
  
  
void EEDB::WebServices::WebBase::save_session() {
  if(!_userDB) { return; }
    
  char buffer[2048];

  if(!_session_data["SESSION_ATIME"].empty()) {
    long int atime = strtol(_session_data["SESSION_ATIME"].c_str(), NULL, 10);  
    long int ctime = strtol(_session_data["SESSION_CTIME"].c_str(), NULL, 10);
    if(atime - ctime > 60*60*24*7) {  // one week expiration
      delete_session();
    }
  }
  
  
  if(_session_data["id"].empty()) {
    //create new session
    string uuid = MQDB::uuid_b64string();
    _session_data["id"] = uuid;
    snprintf(buffer, 2040, "%ld", (long int)time(NULL)); 
    _session_data["SESSION_CTIME"] = buffer;
    _userDB->do_sql("INSERT into sessions(id) values(?)", "s", uuid.c_str());
  }
  
  snprintf(buffer, 2040, "%ld", (long int)time(NULL)); 
  _session_data["SESSION_ATIME"] = buffer;
  
  //generate XML
  string sessionXML = "<zenbu_session>";
  map<string, string>::iterator  it;
  for(it = _session_data.begin(); it != _session_data.end(); it++) {
    if((*it).first.empty()) { continue; }
    if((*it).second.empty()) { continue; }
    //snprintf(buffer, 2040, "<%s>%s</%s>", (*it).first.c_str(), (*it).second.c_str(), (*it).first.c_str());
    //sessionXML += buffer;
    sessionXML += "<" + (*it).first + ">";
    sessionXML += (*it).second;
    sessionXML += "</" + (*it).first + ">";
  }
  sessionXML += "</zenbu_session>";
  
  //update sessions table
  _userDB->do_sql("UPDATE sessions SET a_session=? WHERE id=?", "ss", 
                  sessionXML.c_str(), _session_data["id"].c_str());
}


void EEDB::WebServices::WebBase::hmac_authorize_user() {
  if(_user_profile) { return; }  //if user defined from session use that
  if(_post_data.empty()) { return; }  //only works with POST requests
  if(!_userDB) { return; }

  EEDB::SPStreams::RemoteServerStream::set_current_user(NULL);
  EEDB::SPStreams::CachePoint::set_current_user(NULL);

  int   xml_len  = _post_data.size();
  char* xml_text = (char*)malloc(xml_len+1);
  memset(xml_text, 0, xml_len+1);
  memcpy(xml_text, _post_data.c_str(), xml_len);  
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node, *auth_node;
  
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
  if(root_name != string("zenbu_query")) { free(xml_text); return; }
  if((auth_node = root_node->first_node("authenticate")) == NULL) { free(xml_text); return; }
  
  string  openID, email;
  time_t  expire_time=0;
  
  if((node = auth_node->first_node("openID")) != NULL) { openID = node->value(); }
  if((node = auth_node->first_node("email")) != NULL) { email = node->value(); }
  if((node = auth_node->first_node("expires")) != NULL) { 
    expire_time = strtol(node->value(), NULL, 10);
  }
  free(xml_text);
  
  //fprintf(stderr, "HMAC auth openID[%s] expire[%ld]\n", openID.c_str(), expire_time);
  string signature;
  if(getenv("HTTP_X_ZENBU_MAGIC")) { signature = getenv("HTTP_X_ZENBU_MAGIC"); }
  //fprintf(stderr, "signature[%s]\n", signature.c_str());

  EEDB::User *user1 = NULL;
  if(!email.empty())       { user1 = EEDB::User::fetch_by_email(_userDB, email); }
  else if(!openID.empty()) { user1 = EEDB::User::fetch_by_openID(_userDB, openID); }
  
  if(!user1) { 
    //fprintf(stderr, "could not find user\n");
    return; 
  }
  string key = user1->hmac_secretkey();
    
  unsigned int md_len;
  unsigned char* result = HMAC(EVP_sha256(), 
                               (const unsigned char*)key.c_str(), key.length(), 
                               (const unsigned char*)_post_data.c_str(), _post_data.length(), NULL, &md_len);
  static char res_hexstring[64]; //expect 32 so this is safe
  bzero(res_hexstring, 64);
  for(unsigned i = 0; i < md_len; i++) {
    sprintf(&(res_hexstring[i * 2]), "%02x", result[i]);
  }
  //fprintf(stderr, "hmac [%s]\n", res_hexstring);

  if(signature != res_hexstring) {
    fprintf(stderr, "ZENBU hmac authorization error: signatures did not match\n");
    user1->release();
    return;
  }

  //AUTHENTICATED
  _user_profile = user1;
  EEDB::SPStreams::RemoteServerStream::set_current_user(_user_profile);
  EEDB::SPStreams::CachePoint::set_current_user(_user_profile);
  fprintf(stderr, "ZENBU hmac authenticated %s", _user_profile->simple_xml().c_str());
}

//
////////////////////////////////////////////////////////////////////////////
//

MQDB::Database*  EEDB::WebServices::WebBase::userDB() {
  connect_userDB();
  return _userDB;
}

EEDB::Collaboration*  EEDB::WebServices::WebBase::public_collaboration() {
  return _public_collaboration;
}

EEDB::Collaboration*  EEDB::WebServices::WebBase::curated_collaboration() {
  return _curated_collaboration;
}

vector<EEDB::Peer*>  EEDB::WebServices::WebBase::seed_peers() {
  return _seed_peers;
}


EEDB::Collaboration*  EEDB::WebServices::WebBase::get_collaboration(string collab_uuid) {
  //new code for specific collaboration targeting for saving configs / sharing data
  EEDB::Collaboration *collaboration = NULL;
  if(collab_uuid=="private") {
    if(_user_profile) { 
      collaboration = _user_profile->private_collaboration(); 
    }
  }
  else if(collab_uuid=="public") {
    if(_public_collaboration) { 
      collaboration = _public_collaboration;
    }    
  }
  else if(collab_uuid == "curated") {
    if(_curated_collaboration && _user_profile) {
      if(_curated_collaboration->validate_user(_user_profile)) {
        collaboration = _curated_collaboration;
      }
    }    
  } else {    
    if(_user_profile) { 
      vector<MQDB::DBObject*>            collaborations;
      vector<MQDB::DBObject*>::iterator  it2;
      collaborations = _user_profile->member_collaborations();
      for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
        EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
        if(collab->group_uuid() == collab_uuid) {
          collaboration = collab;
        }
      }
    }
  }
  return collaboration;
}


//
////////////////////////////////////////////////////////////////////////////
//


/***** source_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or NULL if not set
  Exceptions : none 

*****/

EEDB::SPStreams::FederatedSourceStream*  EEDB::WebServices::WebBase::source_stream() {
  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *stream;
  
  if(_source_stream != NULL) { 
    _source_stream->disconnect();
    _source_stream->release(); 
    _source_stream = NULL;
  }
  
  stream = new EEDB::SPStreams::FederatedSourceStream();
  stream->set_peer_search_depth(_peer_search_depth);
  
  //
  // FIRST setup the seed peers
  //
  if(_curated_collaboration && (_collaboration_filter=="all" || _collaboration_filter=="curated" || _collaboration_filter=="public")) {
    stream->add_seed_peer(_curated_collaboration->group_registry());
  }
  
  if(_public_collaboration && (_collaboration_filter=="all" || _collaboration_filter=="public")) {
    //public sharing collaboration is now always allowed for data sharing and searching
    stream->add_seed_peer(_public_collaboration->group_registry());
  }
  
  //OpenToPublic collaborations
  vector<MQDB::DBObject*>  open_collabs = EEDB::Collaboration::fetch_all_public(_userDB, _user_profile);
  vector<MQDB::DBObject*>::iterator  opc_it;
  for(opc_it = open_collabs.begin(); opc_it != open_collabs.end(); opc_it++) {
    EEDB::Collaboration *collab = (EEDB::Collaboration*)(*opc_it);
    if(_collaboration_filter=="all" || _collaboration_filter=="public" || (collab->group_uuid() == _collaboration_filter)) {
      stream->add_seed_peer(collab->group_registry());
    }
  }

  if(_user_profile) { 
    if(_collaboration_filter=="all" || _collaboration_filter=="private") {
      if(_user_profile->user_registry()) {
        stream->add_seed_peer(_user_profile->user_registry());
      }
    }
    
    if(_collaboration_filter=="all" || (_collaboration_filter!="private" && _collaboration_filter!="public")) {
      vector<MQDB::DBObject*>            collaborations;
      vector<MQDB::DBObject*>::iterator  it2;
      collaborations = _user_profile->member_collaborations();
      for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
        EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
        if(_collaboration_filter=="all" || (collab->group_uuid() == _collaboration_filter)) {
          stream->add_seed_peer(collab->group_registry());
        }
      }
    }
  }
    
  if(_collaboration_filter=="all") {
    for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
      stream->add_seed_peer((*it));
    }
  }

  if(!_collaboration_filter.empty()) {
    map<string, EEDB::Peer*>::iterator it2;
    for(it2 = _known_remote_peers.begin(); it2 != _known_remote_peers.end(); it2++) {
      stream->add_seed_peer((*it2).second);
    }
    EEDB::SPStreams::RemoteServerStream::set_collaboration_filter(_collaboration_filter);
  }


  //
  // NEXT setup filters
  //
  if(!_filter_peer_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_peer_ids.begin(); it2 != _filter_peer_ids.end(); it2++) {
      stream->add_peer_id_filter((*it2).first);
    }
  }

  if(!_filter_source_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
      stream->add_source_id_filter((*it2).first);
    }
  }

  if(!_filter_source_names.empty()) {
    map<string, bool>::iterator  it2;
    for(unsigned int i=0; i<_filter_source_names.size(); i++) {
      stream->add_source_name_filter(_filter_source_names[i]);
    }
  }
  
  if(!_filter_ids_array.empty()) {
    vector<string>::iterator  it;
    for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
      stream->add_object_id_filter(*it);
    }
  }
  
  _source_stream = stream;
  return stream;
}


EEDB::SPStreams::FederatedSourceStream* EEDB::WebServices::WebBase::secured_federated_source_stream() {
  //this is used by alternate processes to get another handle on the stream data. Used mainly in scripts.
  
  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *stream;
  
  stream = new EEDB::SPStreams::FederatedSourceStream();
  stream->set_peer_search_depth(_peer_search_depth);
  stream->allow_full_federation_search(false);
  stream->clone_peers_on_build(true);
  
  //first the local seeds
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(_known_remote_peers.find(peer->uuid()) == _known_remote_peers.end()) {
      stream->add_seed_peer(peer);
    }
  }

  //next private
  if(_user_profile) {
    if(_user_profile->user_registry()) {
      stream->add_seed_peer(_user_profile->user_registry());
    }
  }
  
  if(_curated_collaboration) {
    stream->add_seed_peer(_curated_collaboration->group_registry());
  }
  if(_public_collaboration) {
    stream->add_seed_peer(_public_collaboration->group_registry());
  }
    
  //OpenToPublic collaborations
  vector<MQDB::DBObject*>  open_collabs = EEDB::Collaboration::fetch_all_public(_userDB, _user_profile);
  vector<MQDB::DBObject*>::iterator  opc_it;
  for(opc_it = open_collabs.begin(); opc_it != open_collabs.end(); opc_it++) {
    EEDB::Collaboration *collab = (EEDB::Collaboration*)(*opc_it);
    stream->add_seed_peer(collab->group_registry());
  }

  //then collaboration
  if(_user_profile) {
    vector<MQDB::DBObject*>            collaborations;
    vector<MQDB::DBObject*>::iterator  it2;
    
    collaborations = _user_profile->member_collaborations();
    for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
      EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
      stream->add_seed_peer(collab->group_registry());
    }
  }

  //last the remote peers
  map<string, EEDB::Peer*>::iterator it2;
  for(it2 = _known_remote_peers.begin(); it2 != _known_remote_peers.end(); it2++) {
    stream->add_seed_peer((*it2).second);
  }
  
  return stream;
}


EEDB::SPStreams::FederatedSourceStream*  EEDB::WebServices::WebBase::superuser_federated_source_stream() {  
  //access all users and collaborations in system
  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *fstream;
  
  fstream = new EEDB::SPStreams::FederatedSourceStream();
  fstream->set_peer_search_depth(_peer_search_depth);
  fstream->allow_full_federation_search(false);
  fstream->clone_peers_on_build(false);

  //seeds
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    fstream->add_seed_peer((*it));
  }
  
  if(_public_collaboration) {
    fstream->add_seed_peer(_public_collaboration->group_registry());
  }
  if(_curated_collaboration) {
    fstream->add_seed_peer(_curated_collaboration->group_registry());
  }
  
  //all user registries
  vector<DBObject*> all_users = EEDB::User::fetch_all(_userDB);
  for(unsigned i=0; i<all_users.size(); i++) {
    EEDB::User* user = (EEDB::User*)all_users[i];
    if(user->user_registry()) {
      fstream->add_seed_peer(user->user_registry());
    }
  }

  //all collaboration registries
  vector<DBObject*> all_collabs = EEDB::Collaboration::fetch_all(_userDB);
  for(unsigned i=0; i<all_collabs.size(); i++) {
    EEDB::Collaboration* collab = (EEDB::Collaboration*)all_collabs[i];
    if(collab->group_registry()) {
      fstream->add_seed_peer(collab->group_registry());
    }
  }
  
  return fstream;
}


void  EEDB::WebServices::WebBase::set_federation_seeds(EEDB::SPStream*  spstream) {
  if(spstream == NULL) { return; }
  
  if(spstream->classname() == EEDB::SPStreams::SourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::StreamBuffer::class_name) { return; }
  
  //walking back up now
  if(spstream->classname() == EEDB::SPStreams::FederatedSourceStream::class_name) {
    fprintf(stderr, "set_federation_seeds %ld [%s]\n", (long)spstream, spstream->classname());
    EEDB::SPStreams::FederatedSourceStream  *fstream = (EEDB::SPStreams::FederatedSourceStream*)spstream;
    
    fstream->set_peer_search_depth(_peer_search_depth);
    fstream->allow_full_federation_search(false);
    fstream->clone_peers_on_build(true);
    
    //first clear any previous seed settings
    fstream->clear_seed_peers();
    
    //next the local seeds
    vector<EEDB::Peer*>::iterator  it;
    for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
      EEDB::Peer* peer = (*it);
      if(_known_remote_peers.find(peer->uuid()) == _known_remote_peers.end()) {
        fstream->add_seed_peer(peer);
      }
    }
    
    //next private
    if(_user_profile) {
      if(_user_profile->user_registry()) {
        fstream->add_seed_peer(_user_profile->user_registry());
      }
    }
    
    if(_curated_collaboration) {
      fstream->add_seed_peer(_curated_collaboration->group_registry());
    }
    if(_public_collaboration) {
      fstream->add_seed_peer(_public_collaboration->group_registry());
    }
    
    //OpenToPublic collaborations
    vector<MQDB::DBObject*>  open_collabs = EEDB::Collaboration::fetch_all_public(_userDB, _user_profile);
    vector<MQDB::DBObject*>::iterator  opc_it;
    for(opc_it = open_collabs.begin(); opc_it != open_collabs.end(); opc_it++) {
      EEDB::Collaboration *collab = (EEDB::Collaboration*)(*opc_it);
      fstream->add_seed_peer(collab->group_registry());
    }
    
    //then collaboration
    if(_user_profile) {
      vector<MQDB::DBObject*>            collaborations;
      vector<MQDB::DBObject*>::iterator  it2;
      
      collaborations = _user_profile->member_collaborations();
      for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
        EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
        fstream->add_seed_peer(collab->group_registry());
      }
    }
    
    //last the remote peers
    map<string, EEDB::Peer*>::iterator it2;
    for(it2 = _known_remote_peers.begin(); it2 != _known_remote_peers.end(); it2++) {
      fstream->add_seed_peer((*it2).second);
    }    
    return;
  }
  
  //recurse down
  if(spstream->source_stream()) {
    EEDB::SPStream* source_stream = spstream->source_stream();
    set_federation_seeds(source_stream); //recurse
  }
  
  if(spstream->side_stream()) {
    EEDB::SPStream* side_stream = spstream->side_stream();
    set_federation_seeds(side_stream); //recurse
  }
}


void  EEDB::WebServices::WebBase::set_superuser_federation_seeds(EEDB::SPStream*  spstream) {
  if(spstream == NULL) { return; }
  
  if(spstream->classname() == EEDB::SPStreams::SourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::StreamBuffer::class_name) { return; }
  
  //walking back up now
  if(spstream->classname() == EEDB::SPStreams::FederatedSourceStream::class_name) {
    fprintf(stderr, "set_superuser_federation_seeds %ld [%s]\n", (long)spstream, spstream->classname());
    EEDB::SPStreams::FederatedSourceStream  *fstream = (EEDB::SPStreams::FederatedSourceStream*)spstream;
    
    fstream->set_peer_search_depth(_peer_search_depth);
    fstream->allow_full_federation_search(false);
    fstream->clone_peers_on_build(true);
    
    //first clear any previous seed settings
    fstream->clear_seed_peers();
    
    //next the local seeds
    vector<EEDB::Peer*>::iterator  it;
    for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
      EEDB::Peer* peer = (*it);
      if(_known_remote_peers.find(peer->uuid()) == _known_remote_peers.end()) {
        fstream->add_seed_peer(peer);
      }
    }
    
    if(_curated_collaboration) {
      fstream->add_seed_peer(_curated_collaboration->group_registry());
    }
    if(_public_collaboration) {
      fstream->add_seed_peer(_public_collaboration->group_registry());
    }
    
    //all user registries
    vector<DBObject*> all_users = EEDB::User::fetch_all(_userDB);
    for(unsigned i=0; i<all_users.size(); i++) {
      EEDB::User* user = (EEDB::User*)all_users[i];
      if(user->user_registry()) {
        fstream->add_seed_peer(user->user_registry());
      }
    }
    
    //all collaboration registries
    vector<DBObject*> all_collabs = EEDB::Collaboration::fetch_all(_userDB);
    for(unsigned i=0; i<all_collabs.size(); i++) {
      EEDB::Collaboration* collab = (EEDB::Collaboration*)all_collabs[i];
      if(collab->group_registry()) {
        fstream->add_seed_peer(collab->group_registry());
      }
    }
    
    //last the remote peers
    map<string, EEDB::Peer*>::iterator it2;
    for(it2 = _known_remote_peers.begin(); it2 != _known_remote_peers.end(); it2++) {
      fstream->add_seed_peer((*it2).second);
    }
    return;
  }
  
  //recurse down
  if(spstream->source_stream()) {
    EEDB::SPStream* source_stream = spstream->source_stream();
    set_superuser_federation_seeds(source_stream); //recurse
  }
  
  if(spstream->side_stream()) {
    EEDB::SPStream* side_stream = spstream->side_stream();
    set_superuser_federation_seeds(side_stream); //recurse
  }
}


//helper function
EEDB::Assembly*  _peer_find_assembly(EEDB::Peer* peer, string assembly_name) {
  if(!peer) { return NULL; }
  if(!peer->is_valid()) { return NULL; }
  EEDB::Assembly *assembly = NULL;
  EEDB::SPStream *stream = peer->source_stream();
  stream->stream_chromosomes(assembly_name, "");
  while((assembly = (EEDB::Assembly*)stream->next_in_stream())) {
    if(assembly->classname() != EEDB::Assembly::class_name) { continue; }
    if(!assembly->sequence_loaded()) { continue; }
    if((boost::algorithm::to_lower_copy(assembly->assembly_name()) != assembly_name) and
       (boost::algorithm::to_lower_copy(assembly->ncbi_version()) != assembly_name) and
       (boost::algorithm::to_lower_copy(assembly->ncbi_assembly_accession()) != assembly_name) and
       (boost::algorithm::to_lower_copy(assembly->ucsc_name()) != assembly_name)) { continue; }
    EEDB::Assembly::add_to_assembly_cache(assembly);
    return assembly; //found it
  }
  return NULL;
}


EEDB::Assembly*  _registry_find_assembly(EEDB::Peer* peer, string assembly_name) {
  if(!peer) { return NULL; }
  EEDB::Assembly *assembly = NULL;
  EEDB::SPStream *stream = peer->source_stream();
  stream->stream_peers();
  while(EEDB::Peer *peer2  = (EEDB::Peer*)stream->next_in_stream()) {
    if(peer2->uuid() == peer->uuid()) { continue; }
    if(peer2->driver() == string("oscdb")) { continue; }
    if(peer2->driver() == string("bamdb")) { continue; }
    assembly = _peer_find_assembly(peer2, assembly_name);
    if(assembly) { 
      EEDB::Assembly::add_to_assembly_cache(assembly);
      return assembly; 
    }
  }
  return NULL;
}


EEDB::Assembly* EEDB::WebServices::WebBase::find_assembly(string assembly_name) {
  vector<EEDB::Peer*>::iterator      it;
  
  boost::algorithm::to_lower(assembly_name);

  EEDB::Assembly *assembly=NULL;

  //first the local seeds
  for(it = _seed_peers.begin(); it != _seed_peers.end(); it++) {
    EEDB::Peer* peer = (*it);
    if(_known_remote_peers.find(peer->uuid()) == _known_remote_peers.end()) {
      //might be as a seed
      assembly = _peer_find_assembly(peer, assembly_name);
      if(assembly) { return assembly; }
      //or seed might be a registry and the assmebly db is one level down
      assembly = _registry_find_assembly(peer, assembly_name);
      if(assembly) { return assembly; }
    }
  }

  //next private
  if(_user_profile) {
    assembly = _registry_find_assembly(_user_profile->user_registry(), assembly_name);
    if(assembly) { return assembly; }
  }
  
  if(_curated_collaboration) {
    assembly = _registry_find_assembly(_curated_collaboration->group_registry(), assembly_name);
    if(assembly) { return assembly; }
  }
  if(_public_collaboration) {
    assembly = _registry_find_assembly(_public_collaboration->group_registry(), assembly_name);
    if(assembly) { return assembly; }
  }
    
  //then user's collaboration
  if(_user_profile) {
    vector<MQDB::DBObject*>            collaborations;
    vector<MQDB::DBObject*>::iterator  it2;
    
    collaborations = _user_profile->member_collaborations();
    for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
      EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
      assembly = _registry_find_assembly(collab->group_registry(), assembly_name);
      if(assembly) { return assembly; }
    }
  }

  //last the remote peers
  map<string, EEDB::Peer*>::iterator it2;
  for(it2 = _known_remote_peers.begin(); it2 != _known_remote_peers.end(); it2++) {
    EEDB::Peer *peer = (*it2).second;
    assembly = _peer_find_assembly(peer, assembly_name);
    if(assembly) { return assembly; }
  }
  
  return NULL;
}


//
///////////////////////////////////////////////////////////////////////////////////////////
//


bool  EEDB::WebServices::WebBase::print_object_xml(MQDB::DBObject *obj) {
  if(obj==NULL) { return false; }

  string  xml_buffer;
  xml_buffer.reserve(100000);  

  if(obj->classname() == EEDB::FeatureSource::class_name) { 
    EEDB::FeatureSource *fsrc = (EEDB::FeatureSource*)obj;
    if(!fsrc->is_active()) { return false; }
    if(!fsrc->is_visible()) { return false; }
    fsrc->metadataset()->remove_metadata_like("keyword", "");
  }
  if(obj->classname() == EEDB::EdgeSource::class_name) { 
    if(!((EEDB::EdgeSource*)obj)->is_active()) { return false; }
    if(!((EEDB::EdgeSource*)obj)->is_visible()) { return false; }
  }
  if(obj->classname() == EEDB::Experiment::class_name) { 
    EEDB::Experiment *exp = (EEDB::Experiment*)obj;
    if(!exp->is_active()) { return false; }
    exp->metadataset()->remove_metadata_like("keyword", "");
  }
  if(obj->classname() == EEDB::Feature::class_name) { 
    EEDB::Feature *feature = (EEDB::Feature*)obj;

    if(feature->feature_source() == NULL) { return false; }
    if(!feature->feature_source()->is_active()) { return false; }
    if(!feature->feature_source()->is_visible()) { return false; }
    feature->metadataset()->remove_metadata_like("keyword", "");
  }
  
  if(_parameters["format_mode"]  == "fullxml") {
    obj->xml(xml_buffer);
    printf("%s\n", xml_buffer.c_str());    
  } else if(_parameters["format_mode"]  == "minxml") {
    printf("<object id=\"%s\"/>\n", obj->db_id().c_str());    
  } else {
    obj->simple_xml(xml_buffer);
    printf("%s\n", xml_buffer.c_str());
  }
  return true;
}


void EEDB::WebServices::WebBase::show_single_object() {
  MQDB::DBObject        *obj;
  EEDB::SPStreams::FederatedSourceStream  *stream;
  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<objects query_id='%s'>\n", _parameters["id"].c_str());
  //printf("<params format=\"%s\" format_mode=\"%s\" />\n", _parameters["format"].c_str(), _parameters["format_mode"].c_str());

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  EEDB::Tools::OSCFileParser::sparse_expression(false);

  stream = source_stream();
  
  obj = stream->fetch_object_by_id(_parameters["id"]);
  if(obj) { 
    if(obj->peer_uuid()) {
      string uuid = obj->peer_uuid();
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { printf("%s\n", peer->xml().c_str()); }
      print_object_xml(obj);
    }
  }
  stream->disconnect();  
    
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;

  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</objects>\n");
  EEDB::Tools::OSCFileParser::sparse_expression(true);
}


void EEDB::WebServices::WebBase::show_objects() {
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<objects>\n");

  long int                  total = 0;
  long int                  result_count = 0;
  vector<string>::iterator  it;

  EEDB::Tools::OSCFileParser::sparse_expression(false);

  EEDB::SPStreams::FederatedSourceStream *stream = source_stream();
    
  for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
    MQDB::DBObject *obj = stream->fetch_object_by_id(*it);
    if(print_object_xml(obj)) { result_count++; }      
  }
  printf("<result_count total=\"%ld\" expected=\"%ld\" />\n", result_count, total);
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;

  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</objects>\n");
  EEDB::Tools::OSCFileParser::sparse_expression(true);
}


bool _peer_sort_func (EEDB::Peer *a, EEDB::Peer *b) { 
  if(a == NULL) { return true; }
  if(b == NULL) { return false; }
  return (*a < *b); 
}


void EEDB::WebServices::WebBase::show_peers() {
  MQDB::DBObject        *obj;
  vector<EEDB::Peer*>   peers;
  string                output_xml;
  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<peers>\n");
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  bool                      only_remote = false;
  map<string, EEDB::Peer*>  remote_peers;
  if(_parameters["remote_peers"] == "true") { only_remote=true; }
  
  EEDB::SPStreams::FederatedSourceStream *stream = source_stream();
    
  stream->stream_peers();
  while((obj = stream->next_in_stream())) { 
    if(!obj) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(_parameters["reload_sources"] == string("ce818eaf70485e496")) {
      peer->free_source_stream();
      peer->retest_is_valid(); 
    }
    if(!(peer->is_valid())) { continue; }
 
    if(!only_remote) { peers.push_back(peer); }
    
    if(only_remote && peer->is_remote()) {
      EEDB::SPStreams::RemoteServerStream* rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      EEDB::Peer* rpeer = rstream->master_peer();
      if(rpeer && (remote_peers.find(rpeer->uuid()) == remote_peers.end())) {
        remote_peers[rpeer->uuid()] = rpeer;
        //fprintf(stderr, "remote peer %s\n", rpeer->simple_xml().c_str());
      }
    }
  }
  if(only_remote) {
    map<string, EEDB::Peer*>::iterator it2;
    for(it2=remote_peers.begin(); it2!=remote_peers.end(); it2++) {
      EEDB::Peer* peer = (*it2).second;
      peers.push_back(peer);
    }
  }
  
  printf("<stats count=\"%d\" />\n", (int)peers.size());

  //sort peer array here
  sort(peers.begin(), peers.end(), _peer_sort_func);

  vector<EEDB::Peer*>::iterator  it;
  for(it = peers.begin(); it != peers.end(); it++) {
    (*it)->xml(output_xml);
    (*it)->disconnect();
  }
  printf("%s", output_xml.c_str());

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;

  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</peers>\n");
}



void EEDB::WebServices::WebBase::show_chromosomes() {  
  MQDB::DBObject        *obj;
  int                   count=0;
  struct timeval        endtime, time_diff;
  double                runtime;

  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  //printf header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<chroms>\n");
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  string assembly_name = _parameters["assembly_name"];
  string chrom_name    = _parameters["chrom_name"];

  if(assembly_name.empty()) { //either want to show from peers, or a global list
    EEDB::SPStreams::FederatedSourceStream *stream = source_stream();
    stream->set_peer_search_depth(2); //only search the seeds

    stream->stream_chromosomes(assembly_name, chrom_name);
    while((obj = stream->next_in_stream())) { 
      if(!obj) { continue; }
      count++;
      printf("%s", obj->xml().c_str());
    }

    if(count==0) {
      //none found so do again with no peer filters
      _filter_peer_ids.clear();
      stream = source_stream();
      stream->set_peer_search_depth(1); //only search the seeds
      stream->stream_chromosomes(assembly_name, chrom_name);
      while((obj = stream->next_in_stream())) { 
        if(!obj) { continue; }
        printf("%s", obj->xml().c_str());
      }
    }
  } else {
    EEDB::Assembly *assembly = find_assembly(assembly_name);
    if(assembly) {
      printf("%s", assembly->xml().c_str());

      string uuid, objClass;
      long int objID = -1;
      parse_federated_id(assembly->db_id(), uuid, objID, objClass);
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { printf("%s\n", peer->xml().c_str()); }
 
      if(!chrom_name.empty()) {
        EEDB::Chrom* chrom = assembly->get_chrom(chrom_name.c_str());
        if(chrom) {
          printf("%s", chrom->xml().c_str());
        }
      } else {
        //all chromosomes
        vector<EEDB::Chrom*> chroms;
        assembly->all_chroms(chroms);
        for(unsigned int j=0; j<chroms.size(); j++) {
          EEDB::Chrom *chrom = chroms[j];
          printf("%s", chrom->xml().c_str());
        }
      }
    }
  }
 
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;

  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</chroms>\n");
}


//================================================================
//
// load checking
//
//================================================================

bool EEDB::WebServices::WebBase::check_overload(double load_limit) {
  if(_parameters.find("forcerun") != _parameters.end()) { return false; }
  
  string str1 = exec_result("grep 'model name' /proc/cpuinfo | wc -l");
  if(str1.empty()) { return false; } //can not calculate so just run 
  long proc_count = strtol(str1.c_str(), NULL, 10);
  if(proc_count<=0) { return false; }
  
  string str2 = exec_result("cat /proc/loadavg | cut -f1 -d' '");
  if(str2.empty()) { return false; } //can not calculate so just run 
  double loadavg = strtod(str2.c_str(), NULL);
  
  string str3 = exec_result("ps aux | grep zenbu_track_builder | grep -v grep|wc -l");
  long builders = strtol(str3.c_str(), NULL, 10);
  
  string str4 = exec_result("ps aux | grep zenbu_job_runner | grep -v grep|wc -l");
  long jobrunners = strtol(str4.c_str(), NULL, 10);

  if(loadavg/proc_count > load_limit) { 
    fprintf(stderr, "system overload\n");
    return true; 
  }
  
  if((double)builders / proc_count > load_limit) {
    fprintf(stderr, "system overload %ld trackbuilders running now\n", builders);
    return true;
  }
  
  long builder_max = (long)floor((proc_count * 0.3) + 0.5);
  if(builder_max<1) { builder_max=1; }
  if(jobrunners > builder_max) {
    fprintf(stderr, "system overload %ld job_runners now\n", builders);
    return true;
  }
  
  return false;  //no worries
}


void EEDB::WebServices::WebBase::show_system_load() {
  struct timeval       endtime, time_diff;
  
  long proc_count = 0;  
  string str1 = exec_result("grep 'model name' /proc/cpuinfo | wc -l");
  if(!str1.empty()) { proc_count = strtol(str1.c_str(), NULL, 10); }
  
  double loadavg = 0.0;
  string str2 = exec_result("cat /proc/loadavg | cut -f1 -d' '");
  if(!str2.empty()) { loadavg = strtod(str2.c_str(), NULL); }
  double proc_load = loadavg/proc_count;
  
  string str3 = exec_result("ps aux | grep zenbu_track_builder | grep -v grep|wc -l");
  long builders = strtol(str3.c_str(), NULL, 10);
  
  string str4 = exec_result("ps aux | grep zenbu_job_runner | grep -v grep|wc -l");
  long jobrunners = strtol(str4.c_str(), NULL, 10);

  string str5 = exec_result("ps aux | grep eedb_region.cgi | grep -v grep|wc -l");
  long region_queries = strtol(str5.c_str(), NULL, 10);

  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<zenbu_system_load>\n");
  
  printf("<version>%s</version>\n", zenbu_version);
  printf("<current_timestamp>%ld</current_timestamp>", _starttime.tv_sec);  
  printf("<web_url>%s</web_url>\n",_web_url.c_str());
  printf("<web_uuid>%s</web_uuid>\n",_web_uuid.c_str());
    
  //printf("<proc_load>%1.4f</proc_load>\n",proc_load);
  //printf("<cpu_count>%ld</cpu_count>\n",proc_count);
  //printf("<total_system_load>%1.4f</total_system_load>\n",loadavg);

  //printf("<track_builders>%ld</track_builders>\n",builders);
  //printf("<job_runners>%ld</job_runners>\n",jobrunners);
  //printf("<region_queries>%ld</region_queries>\n",region_queries);

  printf("<cpu_status health=\"%1.4f\" cpu_count=\"%ld\" total_system_load=\"%1.4f\"></cpu_status>\n", proc_load, proc_count, loadavg);
  printf("<running_processes track_builders=\"%ld\" job_runners=\"%ld\" region_queries=\"%ld\"></running_processes>\n", builders, jobrunners, region_queries);

  
  if(_userDB) {
    printf("<track_access_stats>\n");
    vector<dynadata>   row_vector;
    const char *sql = "SELECT FROM_UNIXTIME(timeseg) timeseg, count(*) request_count, count(distinct user_id) user_count \
                       FROM (select *, round(UNIX_TIMESTAMP(access_time)/60/60/24)*60*60*24 timeseg \
                             FROM track_cache_history where (UNIX_TIMESTAMP() - UNIX_TIMESTAMP(access_time)) <60*60*24*31)t \
                       GROUP BY timeseg";
    void *stmt = _userDB->prepare_fetch_sql(sql, "");
    while(_userDB->fetch_next_row_vector(stmt, row_vector)) {
      string time_str;
      time_t t_update = row_vector[0].i_timestamp;
      char *ct_value = ctime(&t_update);
      if(ct_value != NULL) {
        int len = strlen(ct_value);
        if(len>0) {
          ct_value[len-1] = '\0';
          time_str = ct_value;
        }
      }

      printf("<access_stats date=\"%s\" count=\"%lld\" user_count=\"%lld\"></access_stats>\n",
             time_str.c_str(), row_vector[1].i_int64, row_vector[2].i_int64);
      //printf("<req_stats>\n");
      //for(unsigned j=0; j<row_vector.size(); j++) {
      //  printf("<data name=\"%s\" type=\"%ld\" />\n", row_vector[j].colname.c_str(), (long)(row_vector[j].type));
      //}
      //printf("</req_stats>\n");
    }
    printf("</track_access_stats>\n");
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</zenbu_system_load>\n");
}


