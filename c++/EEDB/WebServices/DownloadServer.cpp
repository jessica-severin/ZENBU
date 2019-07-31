/* $Id: DownloadServer.cpp,v 1.3 2019/07/31 06:59:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::DownloadServer

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
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/time.h>
#include <sys/mman.h>
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
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/WebServices/DownloadServer.h>

#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 


using namespace std;
using namespace MQDB;

const char*               EEDB::WebServices::DownloadServer::class_name = "EEDB::WebServices::DownloadServer";

EEDB::WebServices::DownloadServer::DownloadServer() {
  init();
}

EEDB::WebServices::DownloadServer::~DownloadServer() {
}

void _eedb_web_download_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::WebServices::DownloadServer*)obj;
}

void EEDB::WebServices::DownloadServer::init() {
  EEDB::WebServices::WebBase::init();
  _classname      = EEDB::WebServices::DownloadServer::class_name;
  _funcptr_delete = _eedb_web_download_delete_func;
}

////////////////////////////////////////////////////////////////////////////////////////


void EEDB::WebServices::DownloadServer::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::WebServices::DownloadServer::display_desc() {
  string xml = "DownloadServer[";
  xml += _classname;
  xml += "]";
  return xml;
}

string EEDB::WebServices::DownloadServer::display_contents() {
  return display_desc();
}

string EEDB::WebServices::DownloadServer::xml_start() {
  string xml = "<webservice>";
  return xml;
}

string EEDB::WebServices::DownloadServer::xml_end() {
  return "</webservice>";
}

string EEDB::WebServices::DownloadServer::simple_xml() {
  return xml_start() + xml_end();
}

string EEDB::WebServices::DownloadServer::xml() {
  string xml = xml_start();
  xml += xml_end();
  return xml;
}


////////////////////////////////////////////////////////////////////////////

bool EEDB::WebServices::DownloadServer::process_url_request() {
  init_service_request();
  
  get_url_parameters();

  get_post_data();
  if(!_post_data.empty()) { process_xml_parameters(); }

  postprocess_parameters();

  return execute_request();
}


void  EEDB::WebServices::DownloadServer::postprocess_parameters() {
  //call superclass method
  EEDB::WebServices::WebBase::postprocess_parameters();
  
  _desc_xml_tags["description"] = true;
  _desc_xml_tags["eedb:assembly_name"] = true;
  _desc_xml_tags["assembly_name"] = true;
  _desc_xml_tags["eedb:display_name"] = true;
  _desc_xml_tags["zenbu:proxy_id"] = true;
  _desc_xml_tags["date"] = true;
  _desc_xml_tags["create_date"] = true;
  
  if(_parameters.find("mdkey_list")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["mdkey_list"].size()+2);
    strcpy(buf, _parameters["mdkey_list"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        string mdkey = p1;
        _desc_xml_tags[mdkey] = true;
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  if(_parameters.find("peer")!=_parameters.end()) {
    _filter_peer_ids[_parameters["peer"]] = true;
    _parameters["mode"] = "download";
  }
  
  if(_parameters.find("id")!=_parameters.end()) {
    _parameters["mode"] = "download";
    string id = _parameters["id"];
    size_t p1;
    if((p1 = id.find("::")) != string::npos) {
      string uuid = id.substr(0, p1);
      _filter_peer_ids[uuid] = true;
      _parameters["peer"] = uuid;
    }
  }
}


bool  EEDB::WebServices::DownloadServer::execute_request() {
  //call superclass method
  if(EEDB::WebServices::WebBase::execute_request()) { return true; }

  if(_parameters["mode"] == string("download")) {
    download_single_file();
  } else {
    return false;
  }

  return true;
}


void EEDB::WebServices::DownloadServer::process_xml_parameters() {
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
  if(root_name != string("zenbu_query")) { free(xml_text); return; }
  
  if((node = root_node->first_node("source_ids")) != NULL) { _parameters["source_ids"] = node->value(); }
  if((node = root_node->first_node("peers")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("peer_names")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("id")) != NULL) { _parameters["id"] = node->value(); }
  
  if((node = root_node->first_node("format")) != NULL) { _parameters["format"] = node->value(); }
  if((node = root_node->first_node("format_mode")) != NULL) { _parameters["format_mode"] = node->value(); }
  if((node = root_node->first_node("mode")) != NULL) { _parameters["mode"] = node->value(); }
  if((node = root_node->first_node("submode")) != NULL) { _parameters["submode"] = node->value(); }
  if((node = root_node->first_node("mdkey_list")) != NULL) { _parameters["mdkey_list"] = node->value(); }

  if((node = root_node->first_node("filter")) != NULL) { _parameters["filter"] = node->value(); }

  if((node = root_node->first_node("authenticate")) != NULL) { hmac_authorize_user(); }

  free(xml_text);
}


void EEDB::WebServices::DownloadServer::show_api() {
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

  printf("Content-type: text/html\r\n\r\n");
  printf("<!DOCTYPE html  PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n");

  printf("<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-US\" xml:lang=\"en-US\">\n");
  printf("<head>\n");
  printf("<title>ZENBU Fast CGI object server</title>\n");
  printf("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf8\" />\n");
  printf("</head>\n");
  printf("<body>\n");

  printf("<h1>Fast CGI object server (c++)</h1>\n");
  printf("<p>eedb_search.fcgi\n");
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

bool _downloadserver_test_file(string path) {
  struct stat statbuf;
  if(path.empty()) { return false; }
  printf("<note>test file @[%s]</note>\n", path.c_str());
  if(stat(path.c_str(), &statbuf) == 0) { return true; }
  return false;
}


void EEDB::WebServices::DownloadServer::download_single_file() {
  MQDB::DBObject        *obj;
  EEDB::SPStreams::FederatedSourceStream  *stream;
  
  if(_parameters["format"].empty()) { _parameters["format"] = "xml"; }

  //if(_parameters["format"]=="file") {
    //printf("Content-type: text/plain\r\n");
    //printf("Content-type: application/octet-stream\r\n");
    //printf("Content-Disposition: attachment; filename=%s.osc;\r\n", filename.c_str());
  //}
  if(_parameters["format"]=="html") {
    printf("Content-type: text/html\r\n\r\n");
  }
  else if(_parameters["format"]=="xml") {
    printf("Content-type: text/xml\r\n\r\n");
    printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    printf("<download query_id='%s'>\n", _parameters["id"].c_str());
    //printf("<params format=\"%s\" format_mode=\"%s\" />\n", _parameters["format"].c_str(), _parameters["format_mode"].c_str());
    if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); }
  }
  
  stream = source_stream();
  
  EEDB::Peer *peer=NULL;
  obj = stream->fetch_object_by_id(_parameters["id"]);
  if(obj) {
    print_object_xml(obj);
    if(obj->peer_uuid()) {
      string uuid = obj->peer_uuid();
      peer = EEDB::Peer::check_cache(uuid);
    }
  }
  if(!peer && (_parameters.find("peer") != _parameters.end())) {
    peer = EEDB::Peer::check_cache(_parameters["peer"]);
    if(!peer) {
      stream->stream_peers();
      while(EEDB::Peer *peer2  = (EEDB::Peer*)stream->next_in_stream()) {
        if(peer2->uuid() == _parameters["peer"]) {
          peer = peer2;
          break;
        }
      }
    }
  }
  stream->disconnect();

  //with most uploads usually the file is the same name as the final db
  // CNhi10639_150925_SN556_0354_BC7VG6ACXX_NoIndex_L005_R1_001.F6-001-RNA-012-03F02-9B0F.GCT.10003__5FKmpq8eNhxs_A6RB78bpD.bam
  // CNhi10639_150925_SN556_0354_BC7VG6ACXX_NoIndex_L005_R1_001.F6-001-RNA-012-03F02-9B0F.GCT.10003__5FKmpq8eNhxs_A6RB78bpD.bamdb/
  //so initially can try to find the upload file by modifying the path to the peer db and doing lstat

  
  string  local_path;
  string  filename;
  long    filesize = 0;
  string  md5sum;
  EEDB::DataSource* primary_source = NULL;
  if(peer) {
    if(_parameters["format"]=="xml") { printf("%s\n", peer->xml().c_str()); }
    //printf("<note>have the peer, now get the primary source and find the original uploaded file</note>\n");
    
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      //printf("<note>peer is OSCFileDB</note>\n");
      EEDB::Tools::OSCFileParser *oscfp = oscdb->oscfileparser();
      if(oscfp) {
        primary_source = oscfp->primary_feature_source();
      }
    }
    else if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
      //printf("<note>peer is BAMDB</note>\n");
      primary_source = bamdb->experiment();
      bamdb->path_to_bam_file(local_path, filename);
      filesize = bamdb->source_file_size();
      md5sum = bamdb->source_md5sum();
      //printf("%s\n", primary_source->xml().c_str());
    }
    else if(sourcestream->classname() == EEDB::ZDX::ZDXstream::class_name) {
      //EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)sourcestream;
      //printf("<note>peer is ZDX</note>\n");
    }
  }
  
  if(_parameters["format"]=="xml") {
    printf("<local_path>%s</local_path>\n", local_path.c_str());
    printf("<filename>%s</filename>\n", filename.c_str());
    printf("<filesize>%ld</filesize>\n", filesize);
    printf("<md5sum>%s</md5sum>\n", md5sum.c_str());
    if(primary_source) { printf("%s\n", primary_source->xml().c_str()); }

    struct timeval       endtime, time_diff;
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &_starttime, &time_diff);
    double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
  
    printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
    printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
    printf("</download>\n");
    return;
  }

  if(_parameters["format"]=="html") {
    printf("<html><body>\n");
    printf("<h1>ZENBU download request</h1>\n");

    if(primary_source) { 
      printf("<p><b>datasource name : %s</b>\n", primary_source->display_name().c_str());
      printf("<br>desciption: %s\n", primary_source->description().c_str());
    }

    printf("<p>filename : %s\n", filename.c_str());
    printf("<br>filesize : %ld\n", filesize);
    printf("<br>md5sum   : %s\n", md5sum.c_str());

    if(peer) {
      printf("<p>click <a href=\"%s/cgi/eedb_download.cgi?format=file;peer=%s\">here</a> to download file\n", _web_url.c_str(),peer->uuid());;
    }

    printf("</body></html>\n");
    return;
  }
  
  if(_parameters["format"]=="file") {
    if(!peer) {
      printf("Content-type: text/html\r\n\r\n");
      printf("<html><body><h3>File not accessible</h3>You may not have security access to download this file.<br>Please check that you are logged in and that you are accessing the correct file</body></html>\n");
      return;
    }

    //printf("Content-type: text/plain\r\n");
    printf("Content-type: application/octet-stream\r\n");
    printf("Content-Disposition: attachment; filename=%s; size=%ld;\r\n", filename.c_str(), filesize);
    printf("\r\n");

    //read BAM file and write out to stdout
    int fildes = open(local_path.c_str(), O_RDONLY, 0x755);
    if(fildes<0) { return; } //error
    long buffer_size = 1024*1024; //1MB
    char *data_buffer = (char*)malloc(buffer_size+8);
    bzero(data_buffer, buffer_size);
    long readsize = read(fildes, data_buffer, buffer_size);
    while(readsize > 0) {
      fwrite(data_buffer, readsize, 1, stdout);
      readsize = read(fildes, data_buffer, buffer_size);
    }
    close(fildes);
  }
  
}


