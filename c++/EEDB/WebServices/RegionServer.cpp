/* $Id: RegionServer.cpp,v 1.258 2016/10/28 08:40:18 severin Exp $ */

/***

NAME - EEDB::SPStreams::RegionServer

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
#include <EEDB/TrackCache.h>
#include <EEDB/TrackRequest.h>
#include <EEDB/Configuration.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/Proxy.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/WebServices/RegionServer.h>
#include <EEDB/ZDX/ZDXsegment.h>

using namespace std;
using namespace MQDB;

void check_over_memory();  //from TrackCacheBuilder

///////////////////////////////////////////////////////////////////////////////
//
// helper functions
//
//////////////////////////////////////////////////////////////////////////////


bool check_script_for_dynamic_emitter(EEDB::SPStream* spstream) {
  if(spstream == NULL) { return false; }

  //check for end points
  if(spstream->classname() == EEDB::SPStreams::FederatedSourceStream::class_name) { return false; }
  if(spstream->classname() == EEDB::SPStreams::SourceStream::class_name) { return false; }
  if(spstream->classname() == EEDB::SPStreams::StreamBuffer::class_name) { return false; }
  
  //check for feature emitter
  if(spstream->classname() == EEDB::SPStreams::FeatureEmitter::class_name) { 
    EEDB::SPStreams::FeatureEmitter *emitter = (EEDB::SPStreams::FeatureEmitter*) spstream;
    if(emitter->dynamic()) { return true;}
    else { return false; }  //also and end-point
  }  
  
  if(spstream->source_stream()) {
    EEDB::SPStream* source_stream = spstream->source_stream();
    if(check_script_for_dynamic_emitter(source_stream)) { return true; } //recurse
  }
  
  if(spstream->side_stream()) {
    EEDB::SPStream* side_stream = spstream->side_stream();
    if(check_script_for_dynamic_emitter(side_stream)) { return true; } //recurse
  }
  return false;
}


void check_script_for_proxy_datasources(EEDB::SPStream* spstream, map<string,bool> &proxy_hash) {
  if(spstream == NULL) { return; }
  
  //check for end points
  if(spstream->classname() == EEDB::SPStreams::FederatedSourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::SourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::StreamBuffer::class_name) { return; }
  
  //check for feature emitter
  if(spstream->classname() == EEDB::SPStreams::Proxy::class_name) { 
    EEDB::SPStreams::Proxy *proxy = (EEDB::SPStreams::Proxy*) spstream;
    proxy_hash[proxy->proxy_name()] = true;
    //fprintf(stderr, "found proxy name [%s]\n", proxy->proxy_name().c_str());
  }  
  
  if(spstream->source_stream()) {
    EEDB::SPStream* source_stream = spstream->source_stream();
    check_script_for_proxy_datasources(source_stream, proxy_hash);
  }
  
  if(spstream->side_stream()) {
    EEDB::SPStream* side_stream = spstream->side_stream();
    check_script_for_proxy_datasources(side_stream, proxy_hash);
  }
}


///////////////////////////////////////////////////////////////////////////////
//
// TrackDef
//
//////////////////////////////////////////////////////////////////////////////
 
const char*  EEDB::TrackDef::class_name = "EEDB::TrackDef";

EEDB::TrackDef::TrackDef() {
  init();
}

EEDB::TrackDef::~TrackDef() {
}

void EEDB::TrackDef::init() {
  MQDB::DBObject::init();
  _classname  = EEDB::TrackDef::class_name;  
}

///////////////////////////////////////////////////////////////////////////////
//
// RegionServer
//
///////////////////////////////////////////////////////////////////////////////

const char* EEDB::WebServices::RegionServer::class_name = "EEDB::WebServices::RegionServer";

EEDB::WebServices::RegionServer::RegionServer() {
  init();
}

EEDB::WebServices::RegionServer::~RegionServer() {
}

void _eedb_web_regionserver_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::WebServices::RegionServer*)obj;
}

void EEDB::WebServices::RegionServer::init() {
  EEDB::WebServices::MetaSearch::init();
  _classname      = EEDB::WebServices::RegionServer::class_name;
  _funcptr_delete = _eedb_web_regionserver_delete_func;
  
  _stream_processing_head  = NULL;
  _stream_processing_tail  = NULL;
  _raw_objcounter          = NULL;
  _region_start            = -1;
  _region_end              = -1;
  _display_width           = 640;
  _total_count             = 0;
  _raw_count               = 0;
  _config_server           = NULL;
  _track_cache             = NULL;
  _source_stream           = NULL;
  _feature_limit_count     = -1;
  
  EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist = false; //reset
}

////////////////////////////////////////////////////////////////////////////////////////


bool EEDB::WebServices::RegionServer::process_url_request() {
  init_service_request();
  
  //reinitialize variables
  _stream_processing_head  = NULL;
  _stream_processing_tail  = NULL;
  _region_start            = -1;
  _region_end              = -1;
  _display_width           = 640;
  _total_count             = 0;
  _raw_count               = 0;

  get_url_parameters();  //from super class

  get_post_data();
  if(!_post_data.empty()) { process_xml_parameters(); }
  
  postprocess_parameters();

  return execute_request();
}


bool EEDB::WebServices::RegionServer::execute_request() {
  if(_parameters["mode"] == string("debug")) {
    show_debug();
  } else if(_parameters["mode"] == string("source_stream")) {
    show_source_stream();
  } else if(_parameters["mode"] == string("region")) {
    show_region_features();
  } else if(_parameters["mode"] == string("region_stats")) {
    show_region_stats();
  } else if(_parameters["mode"] == string("trackcache_stats")) {
    show_trackcache_stats();
  } else if(_parameters["mode"] == string("securitycheck")) {
    show_securecheck();
  } else if(_parameters["mode"] == string("request_build")) {
    request_trackcache_build();
  } else if(_parameters["mode"] == string("sendzdx")) {
    send_trackcache_zdx();
  } else if(_parameters["mode"] == string("trackcache_list")) {
    show_trackcache_list();
  } else if(_parameters["mode"] == string("sequence")) {
    show_region_sequence();
  } else if(_parameters["mode"] == string("genome_scan")) {
    genome_download();
  } else if(_parameters["mode"] == string("sources")) {
    show_datasources();
  } else if(EEDB::WebServices::MetaSearch::execute_request()) { 
    return true; 
  } else {
    return false;
  }
  return true;
}



void EEDB::WebServices::RegionServer::show_api() {
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
  printf("<title>ZENBU CGI region server</title>\n");
  printf("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf8\" />\n");
  printf("</head>\n");
  printf("<body>\n");

  printf("<h1>ZENBU cgi region server (c++)</h1>\n");
  printf("<p>eedb_region.cgi\n");
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
  
  //parameters
  if(!_parameters.empty()) {
    printf("<h3>Parameters</h3>\n");
    map<string,string>::iterator it1;
    for(it1=_parameters.begin(); it1!=_parameters.end(); it1++) {
      if((*it1).first.empty() || (*it1).second.empty()) { continue; }
      printf("%s = [%s]<br>", (*it1).first.c_str(), (*it1).second.c_str());
    }
    printf("<hr/>\n");
  }

  printf("<h2>Access interface methods</h2>\n");
  printf("<table cellpadding =3 width=100%%>\n");
  printf("<tr><td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  printf("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  printf("<tr><td>loc=[location]</td><td>does genome location search and returns all features overlapping region. default output mode=region_gff<br>loc is format: chr17:75427837..75427870</td></tr>\n");
  printf("<tr><td>segment=[location]</td><td>same as loc=... </td></tr>\n");
  printf("<tr><td>types=[source,source,...]</td><td>limits results to a specific set of sources. multiple sources are separated by commas. used in both region and expression modes. if not set, all sources are used.</td></tr>\n");
  printf("<tr><td>expfilter=[experiment,experiment,...]</td><td>limits results to a specific set of experiments. multiple experiments are allow and separated by commas. used in expression mode. if not set, all expression from all linked experiments in the region are used, otherwise the expression is filtered for specific experiments.</td></tr>\n");
  printf("<tr><td>exptype=[type]</td><td>sets the expression data type. there are muiltiple expression types for each expression/experiment eg(raw, norm, tpm, detect). if not set, all expression data types are returned or used in calculations. the expression data types are not a fixed vocabulary and depend on the data in the EEDB server.</td></tr>\n");
  printf("<tr><td>binning=[mode]</td><td>sets the expression binning mode [sum, mean, max, min, stddev]. when multiple expression value overlap the same binning region, this is the method for combining them. default [sum]</td></tr>\n");
  printf("<tr><td>asm=[assembly name]</td><td>change the assembly. for example (hg18 mm9 rn4...)</td></tr>\n");

  printf("<tr><td>format=[xml,gff2,gff3,bed,das,wig]</td><td>changes the output format of the result. XML is an EEDB/ZENBU defined XML format, while GFF2, GFF3, and BED are common formats.  XML is supported in all access modes, but GFF2, GFF3, and BED are only available in direct feauture access modes. Default format is BED.</td></tr>\n");
  printf("<tr><td>width=[number]</td><td>set the display width for svg drawing</td></tr>\n");
  printf("<tr><td>strand_split=[0,1]</td><td>in expression mode, toggles whether the expression is split for each strand or combined</td></tr>\n");
  printf("</table>\n");

  printf("<h2>Control modes</h2>");
  printf("<table cellpadding =3 width=100%%>\n");
  printf("<tr><td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  printf("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  printf("<tr><td>mode=region</td><td>Returns features in region in specified format</td></tr>\n");
  printf("<tr><td>mode=express</td><td>Returns features in region as expression profile (wig or svg formats)</td></tr>\n");
  printf("<tr><td>submode=[submode]</td><td> available submodes:area, 5end, 3end, subfeature. 'area,5end,3end' are used for expression and 'subfeature' is used in region</td></tr>\n");
  printf("</table>\n");


  printf("</body>\n");
  printf("</html>\n");
}



void EEDB::WebServices::RegionServer::process_xml_parameters() {

  EEDB::WebServices::MetaSearch::process_xml_parameters();

  int   xml_len  = _post_data.size();
  char* xml_text = (char*)malloc(xml_len+1);
  memset(xml_text, 0, xml_len+1);
  memcpy(xml_text, _post_data.c_str(), xml_len);  
  //fprintf(stderr, "%s\n", _post_data.c_str());
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  rapidxml::xml_attribute<> *attr;
  
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
  
  //reset some defaults
  _parameters["mode"] = "region";
  _parameters["source_outmode"] = "";
  _parameters["submode"] = "simple_feature";
  
  if((node = root_node->first_node("authenticate")) != NULL) { hmac_authorize_user(); }

  if((node = root_node->first_node("peers")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("peer_names")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("source_ids")) != NULL) { _parameters["source_ids"] = node->value(); }
  if((node = root_node->first_node("source_names")) != NULL) { _parameters["source_names"] = node->value(); }
  if((node = root_node->first_node("track_uuid")) != NULL) { _parameters["track_uuid"] = node->value(); }
  if((node = root_node->first_node("trackcache")) != NULL) { _parameters["trackcache"] = node->value(); }
  if((node = root_node->first_node("cache_hashkeys")) != NULL) { _parameters["cache_hashkeys"] = node->value(); }
  if((node = root_node->first_node("logdownload")) != NULL) { _parameters["logdownload"] = "true"; }  
  if((node = root_node->first_node("view_uuid")) != NULL) { _parameters["view_uuid"] = node->value(); }  
  if((node = root_node->first_node("anonymous")) != NULL) { _parameters["anonymous"] = "true"; }  
  
  if((node = root_node->first_node("asm")) != NULL) { _parameters["assembly_name"] = node->value(); }
  if((node = root_node->first_node("chrom")) != NULL) { _parameters["chrom_name"] = node->value(); }
  if((node = root_node->first_node("chrom_name")) != NULL) { _parameters["chrom_name"] = node->value(); }
  if((node = root_node->first_node("chrom_start")) != NULL) { _parameters["chrom_start"] = node->value(); }
  if((node = root_node->first_node("chrom_end")) != NULL) { _parameters["chrom_end"] = node->value(); }
  if((node = root_node->first_node("loc")) != NULL) { _parameters["loc"] = node->value(); }
  if((node = root_node->first_node("strand")) != NULL) { _parameters["strand"] = node->value(); }

  if((node = root_node->first_node("display_width")) != NULL) { _parameters["display_width"] = node->value(); }
  if((node = root_node->first_node("bin_size")) != NULL) { _parameters["bin_size"] = node->value(); }
  if((node = root_node->first_node("skip_default_expression_binning")) != NULL) { _parameters["skip_default_expression_binning"] = node->value(); }
  if((node = root_node->first_node("format")) != NULL) { _parameters["format"] = node->value(); }
  if((node = root_node->first_node("format_mode")) != NULL) { _parameters["format_mode"] = node->value(); }
  if((node = root_node->first_node("mode")) != NULL) { _parameters["mode"] = node->value(); }
  if((node = root_node->first_node("submode")) != NULL) { _parameters["submode"] = node->value(); }
  if((node = root_node->first_node("overlap_mode")) != NULL) { _parameters["overlap_mode"] = node->value(); }
  if((node = root_node->first_node("nocache")) != NULL) { _parameters["nocache"] = node->value(); }
  if((node = root_node->first_node("source_outmode")) != NULL) { _parameters["source_outmode"] = node->value(); }
  if((node = root_node->first_node("expression_visualize")) != NULL) { _parameters["expression_visualize"] ="true"; }
  if((node = root_node->first_node("feature_limit_count")) != NULL) { _parameters["feature_limit_count"] = node->value(); }
  if((node = root_node->first_node("feature_restream")) != NULL) { _parameters["feature_restream"] = "true"; }
  
  if((node = root_node->first_node("track_title")) != NULL) { _parameters["track_title"] = node->value(); }
  if((node = root_node->first_node("savefile")) != NULL) { _parameters["savefile"] = node->value(); }
  if((node = root_node->first_node("genome_scan")) != NULL) { _parameters["mode"] = "genome_scan"; }

  if((node = root_node->first_node("exptype")) != NULL) { _parameters["exptype"] = node->value(); }
  if((node = root_node->first_node("output_datatype")) != NULL) { _parameters["output_datatype"] = node->value(); }
  if((node = root_node->first_node("binning")) != NULL) { _parameters["binning"] = node->value(); }
  if((node = root_node->first_node("filter")) != NULL) { _parameters["filter"] = node->value(); }
  if((node = root_node->first_node("expfilter")) != NULL) { _parameters["filter"] = node->value(); }
  if((node = root_node->first_node("strandless")) != NULL) { _parameters["strandless"] = node->value(); }
  if((node = root_node->first_node("overlap_check_subfeatures")) != NULL) { _parameters["overlap_check_subfeatures"] = node->value(); }

  if((node = root_node->first_node("export_subfeatures")) != NULL) { _parameters["export_subfeatures"] = node->value(); }
  if((node = root_node->first_node("export_feature_metadata")) != NULL) { _parameters["export_feature_metadata"] = node->value(); }
  if((node = root_node->first_node("export_experiment_metadata")) != NULL) { _parameters["export_experiment_metadata"] = node->value(); }
  if((node = root_node->first_node("export_osc_metadata")) != NULL) { _parameters["export_osc_metadata"] = node->value(); }

  for(node = root_node->first_node("source"); node; node = node->next_sibling("source")) {
    if((attr = node->first_attribute("id"))) { 
      string id = attr->value();
      _filter_source_ids[id] = true;
      size_t p2;
      if((p2 = id.find("::")) != string::npos) {
        string uuid = id.substr(0, p2);
        _filter_peer_ids[uuid] = true;
      }
    }
  }
  
  if((node = root_node->first_node("expression_binning")) != NULL) { 
    _parameters["expression_binning"] = "true"; 
    if((attr = node->first_attribute("overlap_mode"))) { _parameters["overlap_mode"] = attr->value(); }
    if((attr = node->first_attribute("binning"))) { _parameters["binning"] = attr->value(); }
    if((attr = node->first_attribute("strandless"))) { _parameters["strandless"] = attr->value(); }
    if((attr = node->first_attribute("binsize"))) { _parameters["bin_size"] = attr->value(); }
    if((attr = node->first_attribute("bin_size"))) { _parameters["bin_size"] = attr->value(); }
    if((attr = node->first_attribute("subfeatures"))) { _parameters["overlap_check_subfeatures"] = attr->value(); }
    
    if(_parameters.find("bin_size") == _parameters.end()) {
      //uses a dynamic feature emitter later
      EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist = true;
    }
  }
    
  if((node = root_node->first_node("zenbu_script")) != NULL) { parse_processing_stream(node); }
  
  free(xml_text);
}


void  EEDB::WebServices::RegionServer::postprocess_parameters() {
  if(_parameters.find("trackcache") != _parameters.end()) {
    init_from_track_cache(_parameters["trackcache"]);
  }
  
  //call superclass method
  EEDB::WebServices::MetaSearch::postprocess_parameters();
  
  //first convert aliased paramter names to official internal name
  if(_parameters.find("datatype") != _parameters.end())     { _parameters["exptype"] = _parameters["datatype"]; }
  if(_parameters.find("segment") != _parameters.end())      { _parameters["loc"] = _parameters["segment"]; }
  if(_parameters.find("chrom") != _parameters.end())        { _parameters["chrom_name"] = _parameters["chrom"]; }
  if(_parameters.find("window_width") != _parameters.end()) { _parameters["display_width"] = _parameters["window_width"]; }


  //set defaults if they were not defined
  if(_parameters.find("binning") == _parameters.end())        { _parameters["binning"] = "sum"; }
  if(_parameters.find("mode") == _parameters.end())           { _parameters["mode"] = "region"; }
  if(_parameters.find("overlap_mode") == _parameters.end())   { _parameters["overlap_mode"] = "area"; }
  if(_parameters.find("format") == _parameters.end())         { _parameters["format"] = "xml"; }

  if(_parameters.find("assembly_name") == _parameters.end()) {
    if(!_default_genome.empty()) { _parameters["assembly_name"] = _default_genome; }
  }

  EEDB::WebServices::MetaSearch::postprocess_parameters();

  if(_parameters["format"] == "wig") { _parameters["mode"] = "express"; }
  if(_parameters.find("assembly_name") == _parameters.end()) { _parameters["assembly_name"] = "hg18"; }

  if(_parameters.find("display_width") != _parameters.end()) { 
    _display_width = strtol(_parameters["display_width"].c_str(), NULL, 10);
  }
  if(_display_width < 10) { _display_width = 10; }

  size_t   p1;
  if((p1 = _parameters["mode"].find("express_")) != string::npos) {
    string tstr = _parameters["mode"].substr(p1+8);
    _parameters["overlap_mode"] = tstr;
    _parameters["mode"] = "express";
  }

  if(_parameters.find("loc") != _parameters.end()) {
    _parameters["chrom_name"] = _parameters["loc"];
    if((p1 = _parameters["loc"].find(":")) != string::npos) {
      _parameters["chrom_name"] = _parameters["loc"].substr(0,p1);
      string tstr = _parameters["loc"].substr(p1+1);
      if((p1 = tstr.find("..")) != string::npos) {
        _parameters["chrom_start"] = tstr.substr(0,p1);
        _parameters["chrom_end"]   = tstr.substr(p1+2);
      }
    }
  }

  if(_parameters.find("chrom_start") != _parameters.end()) { 
    _region_start = strtol(_parameters["chrom_start"].c_str(), NULL, 10);
  }
  if(_parameters.find("chrom_end") != _parameters.end()) { 
    _region_end = strtol(_parameters["chrom_end"].c_str(), NULL, 10);
  }
  if(_parameters.find("feature_limit_count") != _parameters.end()) { 
    _feature_limit_count = strtol(_parameters["feature_limit_count"].c_str(), NULL, 10);
    fprintf(stderr, "feature_limit_count %ld\n", _feature_limit_count);
  }
  
  //if source_outmode was not set in query then apply old default behaviours
  if(_parameters["source_outmode"].empty()) { 
    _parameters["source_outmode"] = "simple_feature"; 
    if(_parameters["mode"] == "express") { _parameters["source_outmode"] = "expression"; }
    if(_parameters["submode"] == "expression") { _parameters["source_outmode"] = "expression"; }
    if(_parameters["source_outmode"] != "expression") {
      if(_parameters["submode"] == "subfeature")   { _parameters["source_outmode"] = "subfeature"; }
      if(_parameters["submode"] == "full_feature") { _parameters["source_outmode"] = "feature"; }
    }
  }

  if(_parameters.find("script_source_outmode") != _parameters.end()) {
    _parameters["source_outmode"] = _parameters["script_source_outmode"];
  }

  if(_parameters.find("skip_default_expression_binning")!=_parameters.end()) { 
    _parameters["expression_binning"] = "false";
  }  
  
  //set some of the global parameters
  if(_parameters.find("display_width") != _parameters.end()) { 
    EEDB::WebServices::WebBase::global_parameters["display_width"] = _parameters["display_width"];
  }
  
  if(EEDB::WebServices::WebBase::global_parameters.find("global_bin_size") == EEDB::WebServices::WebBase::global_parameters.end()) { 
    if(_parameters.find("bin_size") != _parameters.end()) { 
      EEDB::WebServices::WebBase::global_parameters["global_bin_size"] = _parameters["bin_size"];
    }
  }
  
  //lastly check the processing script for proxies and replace with FederatedSourceStreams
  _proxy_setup_processing_stream();

  //do magik related to dynamic FeatureEmitters embedded into scripts
  if(EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist && _region_start>0 &&
      (EEDB::WebServices::WebBase::global_parameters.find("global_bin_size") == EEDB::WebServices::WebBase::global_parameters.end())) { 
    double span = (double)(_region_end - _region_start) / (double)_display_width;
    double orig_span = span;
    
    if(span <= 1.0)                  { span = 1.0; }
    if(span > 1.0 and span < 7.0)    { span = 3.0; }
    if(span >= 7.0 and span < 15.0)  { span = 10.0; }
    if(span >= 15.0 and span < 64.0) { span = 32.0; }
    if(span >= 64.0 and span < 500)  { span = 128.0; }
    if(span >= 500 and span < 2500)  { span = 1000.0; }
    if(span >= 2500 and span < 10000)  { span = 5000.0; }
    if(span >= 10000 and span < 50000) { span = 10000.0; }
    if(span >= 50000)                  { span = 50000.0; }
    
    fprintf(stderr, "TrackCache reset dynamic global_bin_size %1.3f (%1.3f)\n", span, orig_span);
    
    char  buffer[2048];
    snprintf(buffer, 2040,"%d", (int)span);
    EEDB::WebServices::WebBase::global_parameters.erase("display_width");
    EEDB::WebServices::WebBase::global_parameters["global_bin_size"] = buffer;
  }

  /*
  map<string, string>::iterator  it;
  for(it = _parameters.begin(); it != _parameters.end(); it++) {
    fprintf(stderr, "parameter [%s] = %s\n", (*it).first.c_str(), (*it).second.c_str());
  }
   */
}


bool  EEDB::WebServices::RegionServer::init_from_track_cache(string track_hashkey) {
  //fprintf(stderr, "init_from_track_cache [%s]\n", track_uuid.c_str());
  if(!_userDB) { return false; }
  
  _track_cache = EEDB::TrackCache::fetch_by_hashkey(_userDB, track_hashkey);
  if(!_track_cache) { return false; }
  
  EEDB::Metadata *md = _track_cache->metadataset()->find_metadata("configXML", "");
  if(!md) { return false; }
  
  bool rtn = init_from_track_configXML(md->data());
  //fprintf(stderr,"sources_ids=[%s]\n", _parameters["source_ids"].c_str());
  return rtn;
}
  

bool  EEDB::WebServices::RegionServer::init_from_track_configXML(string configXML) {
  //fprintf(stderr, "init_from_track_configXML : %s\n\n\n", configXML.c_str());
  
  EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist = false; //reset

  if(configXML.empty()) { return false; }
  
  int   xml_len  = configXML.size();
  char* xml_text = (char*)malloc(xml_len+1);
  memset(xml_text, 0, xml_len+1);
  memcpy(xml_text, configXML.c_str(), xml_len);  
  //fprintf(stderr, "%s\n", xml_text);
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *node2, *root_node, *track_node;
  rapidxml::xml_attribute<> *attr;
  
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(xml_text);
  } catch(rapidxml::parse_error &e) {
    free(xml_text);
    return false;
  }
  
  root_node = doc.first_node();
  if(!root_node) { free(xml_text); return false; }
  
  string root_name = root_node->name();
  boost::algorithm::to_lower(root_name);
  if((root_name != string("eedbglyphstrackconfig")) &&
     (root_name != string("zconfigxml"))) { free(xml_text); return false; }
  
  //fprintf(stderr, "OK we have a track config\n");

  //some additional defaults
  _parameters["binning"]         = "sum";
  _parameters["overlap_mode"]    = "5end";
  
  if((track_node = root_node->first_node("gLyphTrack")) != NULL) { 
    if((node2 = track_node->first_node("source_ids"))) { 
      _parameters["source_ids"] = node2->value();
    }
    
    for(node2 = track_node->first_node("source"); node2; node2 = node2->next_sibling("source")) {
      if((attr = node2->first_attribute("id"))) {
        if(!_parameters["source_ids"].empty()) { _parameters["source_ids"] += ","; }
        _parameters["source_ids"] += attr->value();
      }
    }
    
    if((attr = track_node->first_attribute("title"))) { _parameters["track_title"] = attr->value(); }
    if((attr = track_node->first_attribute("track_title"))) { _parameters["track_title"] = attr->value(); }
    if((attr = track_node->first_attribute("format"))) { _parameters["format"] = attr->value(); }
    if((attr = track_node->first_attribute("format_mode"))) { _parameters["format_mode"] = attr->value(); }
    if((attr = track_node->first_attribute("glyphStyle"))) { _parameters["glyphStyle"] = attr->value(); }
    if((attr = track_node->first_attribute("uuid"))) { _parameters["track_uuid"] = attr->value(); }
    if((attr = track_node->first_attribute("track_uuid"))) { _parameters["track_uuid"] = attr->value(); }

    if((attr = track_node->first_attribute("scorecolor"))) { _parameters["scorecolor"] = attr->value(); }
    if((attr = track_node->first_attribute("backColor"))) { _parameters["backColor"] = attr->value(); }
    if((attr = track_node->first_attribute("hidezeroexps"))) { _parameters["hidezeroexps"] = attr->value(); }
    if((attr = track_node->first_attribute("exptype"))) { _parameters["exptype"] = attr->value(); }
    if((attr = track_node->first_attribute("datatype"))) { _parameters["datatype"] = attr->value(); }
    if((attr = track_node->first_attribute("hide"))) { _parameters["hide"] = attr->value(); }
    if((attr = track_node->first_attribute("nocache"))) { _parameters["nocache"] = attr->value(); }
    if((attr = track_node->first_attribute("mode"))) { _parameters["mode"] = attr->value(); }
    if((attr = track_node->first_attribute("submode"))) { _parameters["submode"] = attr->value(); }

    if((attr = track_node->first_attribute("peerName"))) { _parameters["peers"] = attr->value(); }
    if((attr = track_node->first_attribute("peers"))) { _parameters["peers"] = attr->value(); }
    if((attr = track_node->first_attribute("peer_names"))) { _parameters["peers"] = attr->value(); }
    
    if((attr = track_node->first_attribute("sources"))) { _parameters["sources"] = attr->value(); }
    if((attr = track_node->first_attribute("source_ids"))) { _parameters["source_ids"] = attr->value(); }
    if((attr = track_node->first_attribute("source_names"))) { _parameters["source_names"] = attr->value(); }
    if((attr = track_node->first_attribute("source_outmode"))) { _parameters["source_outmode"] = attr->value(); }

    if((attr = track_node->first_attribute("expfilter"))) { _parameters["filter"] = attr->value(); }
    if((attr = track_node->first_attribute("filter"))) { _parameters["filter"] = attr->value(); }
    if((attr = track_node->first_attribute("logscale"))) { _parameters["logscale"] = attr->value(); }
    if((attr = track_node->first_attribute("height"))) { _parameters["height"] = attr->value(); }
    if((attr = track_node->first_attribute("maxlevels"))) { _parameters["height"] = attr->value(); }
    if((attr = track_node->first_attribute("expscaling"))) { _parameters["expscaling"] = attr->value(); }
    if((attr = track_node->first_attribute("strandless"))) { _parameters["strandless"] = attr->value(); }
    if((attr = track_node->first_attribute("overlap_mode"))) { _parameters["overlap_mode"] = attr->value(); }
    if((attr = track_node->first_attribute("binning"))) { _parameters["binning"] = attr->value(); }
    if((attr = track_node->first_attribute("skip_default_expression_binning"))) { _parameters["skip_default_expression_binning"] = attr->value(); }

    if((attr = track_node->first_attribute("display_width"))) { _parameters["display_width"] = attr->value(); }
    if((attr = track_node->first_attribute("global_bin_size"))) { _parameters["global_bin_size"] = attr->value(); }
    if((attr = track_node->first_attribute("asm"))) { _parameters["assembly_name"] = attr->value(); }
    if((attr = track_node->first_attribute("assembly_name"))) { _parameters["assembly_name"] = attr->value(); }
    if((attr = track_node->first_attribute("chrom"))) { _parameters["chrom_name"] = attr->value(); }
    if((attr = track_node->first_attribute("chrom_name"))) { _parameters["chrom_name"] = attr->value(); }
    if((attr = track_node->first_attribute("loc"))) { _parameters["loc"] = attr->value(); }

    //config for _append_expression_histogram_binning paramters
    if((node2 = track_node->first_node("expression_binning"))) { 
      _parameters["expression_binning"] = "true";
      if((attr = node2->first_attribute("overlap_mode"))) { _parameters["overlap_mode"] = attr->value(); }
      if((attr = node2->first_attribute("binning"))) { _parameters["binning"] = attr->value(); }
      if((attr = node2->first_attribute("strandless"))) { _parameters["strandless"] = attr->value(); }
      if((attr = node2->first_attribute("binsize"))) { _parameters["bin_size"] = attr->value(); }
      if((attr = node2->first_attribute("bin_size"))) { _parameters["bin_size"] = attr->value(); }
      if((attr = node2->first_attribute("subfeatures"))) { _parameters["overlap_check_subfeatures"] = attr->value(); }
    }
    
    if((node = track_node->first_node("zenbu_script")) != NULL) { parse_processing_stream(node); }
  }
  
  if(_parameters.find("global_bin_size") != _parameters.end()) { 
    EEDB::WebServices::WebBase::global_parameters["global_bin_size"] = _parameters["global_bin_size"];
  }
  
  //if format and source_outmode are not set, parse glyphStyle logic
  string glyphStyle = _parameters["glyphStyle"];
  if(!glyphStyle.empty()) {
    if(_parameters.find("source_outmode")==_parameters.end()) {
      _parameters["source_outmode"]  = "simple_feature";
      //parse glyphStyle into source_outmode if not explicit
      if(glyphStyle=="express") { _parameters["source_outmode"] = "expression"; }
      
      if(glyphStyle=="transcript" || 
         glyphStyle=="probesetloc" || 
         glyphStyle=="thin-transcript" || 
         glyphStyle=="thick-transcript") { _parameters["source_outmode"] = "subfeature"; }
      
      if(glyphStyle=="singletrack" ||
         glyphStyle=="spectrum" ||
         glyphStyle=="experiment-heatmap" || 
         glyphStyle=="seqtag") { _parameters["source_outmode"] = "full_feature"; }
      
      if(_stream_processing_head != NULL) { _parameters["source_outmode"] = "full_feature"; }
    }
  
    if(_parameters.find("format")==_parameters.end()) {
      _parameters["format"] = "fullxml";
      
      if(glyphStyle=="centroid" ||
         glyphStyle=="thick-arrow" ||
         glyphStyle=="medium-arrow" ||
         glyphStyle=="box" ||
         glyphStyle=="arrow" ||
         glyphStyle=="line" ||
         glyphStyle=="exon" ||
         glyphStyle=="medium-exon" ||
         glyphStyle=="thin-exon" ||
         glyphStyle=="utr" ||
         glyphStyle=="thin" ||
         glyphStyle=="cytoband") { _parameters["format"] = "xml"; }
    }
  }
  
  free(xml_text);    

  return true;
}


/*****************************************************************************
 *
 * scripting section
 *
 *****************************************************************************/


void  EEDB::WebServices::RegionServer::parse_processing_stream(void *xml_node) {
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;

  //printf("RegionServer::parse_processing_stream\n");
  _stream_processing_head  = NULL;
  _stream_processing_tail  = NULL;

  if(root_node == NULL) { return; }

  // first parse any control parameters
  rapidxml::xml_node<> *param_node = root_node->first_node("parameters");
  if(param_node) {
    for(node = param_node->first_node(); node; node = node->next_sibling()) {
      string type = node->name();
      if(type == "source_outmode") { type = "script_source_outmode"; }
      if(type == "format") { continue; }
      if(type == "mode") { continue; }
      _parameters[type] = string(node->value());
    }
  }

  // parse the <stream_stack> into SPStream object chain
  rapidxml::xml_node<> *module_stream = NULL;
  
  if((node=root_node->first_node("stream_stack")))   { module_stream = node; }
  if((node=root_node->first_node("stream_queue")))   { module_stream = node; }
  if((node=root_node->first_node("stream_processing"))) { module_stream = node; }
  
  if(!module_stream) { return; }
  EEDB::SPStream::create_stream_from_xml(module_stream, _stream_processing_head, _stream_processing_tail);

  if((_stream_processing_head == NULL) || (_stream_processing_tail == NULL)) {
    _stream_processing_head  = NULL;
    _stream_processing_tail  = NULL;
    return;
  }
  
  if(string(module_stream->name()) == "stream_stack") {
    //need to reverse this
    //printf("need to reverse because a stream_stack\n");
    EEDB::SPStream *nhead = _stream_processing_tail;
    EEDB::SPStream *ntail = _stream_processing_head;
    _stream_processing_head = _stream_processing_head->reverse_stream(NULL);
    if(_stream_processing_head != nhead) {
      //printf("hmm something wrong...\n");
    }
    _stream_processing_tail = ntail;
  }

  // parse the datasources for later use in proxy replacement
  rapidxml::xml_node<>  *datastream;
  for(datastream=root_node->first_node("datastream"); datastream; datastream=datastream->next_sibling("datastream")) {
    attr = datastream->first_attribute("name");
    if(!attr) { continue; }
    EEDB::TrackDef *track = new EEDB::TrackDef();
    track->name = attr->value();
    _processing_datastreams[track->name] = track;

    attr = datastream->first_attribute("track_uuid");
    if(attr) {
      track->track_uuid = attr->value();
      vector<string> ids = _get_track_uuid_datasource_ids(attr->value());
      for(unsigned int j=0; j<ids.size(); j++) {
        track->source_ids[ids[j]] = true;
      }
    }
  
    //first get the source_ids which we will later use to configure FederatedSourceStream
    for(node=datastream->first_node("source"); node; node=node->next_sibling("source")) {
      if((attr = node->first_attribute("id"))) {
        track->source_ids[attr->value()] = true;
      }
    }
    
    if((attr = datastream->first_attribute("datatype"))) {
      track->expression_datatype = attr->value();
    }
    if((attr = datastream->first_attribute("exptype"))) {
      track->expression_datatype = attr->value();
    }

    if((attr = datastream->first_attribute("source_outmode"))) {
      track->source_outmode = attr->value();
    }
    if((attr = datastream->first_attribute("output"))) {
      track->source_outmode = attr->value();
    }
  }
}


vector<string>  EEDB::WebServices::RegionServer::_get_track_uuid_datasource_ids(string track_uuid) {
  vector<string> source_ids;
  
  if(_config_server == NULL) {
    _config_server = new EEDB::WebServices::ConfigServer();
    if(!_config_server->parse_config_file(_parameters["webservice_config_file"])) { return source_ids; }
    _config_server->init_service_request();
    _config_server->postprocess_parameters();
  }

  string trackConfigXML;
  EEDB::Configuration *config = _config_server->get_config_uuid(track_uuid);
  if(config) {
    if(config->config_type() == "TRACK") { 
      EEDB::Metadata *md = config->metadataset()->find_metadata("configXML", "");
      if(md) { trackConfigXML = md->data(); }
    }
    config->release();
  }

  if(!trackConfigXML.empty()) {
    int   xml_len  = trackConfigXML.size();
    char* xml_text = (char*)malloc(xml_len+1);
    memset(xml_text, 0, xml_len+1);
    memcpy(xml_text, trackConfigXML.c_str(), xml_len);  
    
    rapidxml::xml_document<>  doc;
    rapidxml::xml_node<>      *node, *root_node, *node2;
    rapidxml::xml_attribute<> *attr;
    
    try {
      doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(xml_text);
    } catch(rapidxml::parse_error &e) {
      free(xml_text); return source_ids;
    }
    
    root_node = doc.first_node();
    if(!root_node) { free(xml_text); return source_ids; }
    
    string root_name = root_node->name();
    boost::algorithm::to_lower(root_name);
    if(root_name != string("eedbglyphstrackconfig")) { free(xml_text); return source_ids; }

    if((node = root_node->first_node("gLyphTrack")) != NULL) { 
      if((attr = node->first_attribute("source_ids"))) { 
        char *ptr, *ids = attr->value();
        while((ptr = strsep(&ids, ", \t")) != NULL) {
          if(*ptr== '\0') { continue; }
          if(*ptr== '\n') { continue; }
          source_ids.push_back(ptr);
        }
      }
      if((node2 = node->first_node("source_ids"))) { 
        char *ptr, *ids = node2->value();
        while((ptr = strsep(&ids, ", \t")) != NULL) {
          if(*ptr== '\0') { continue; }
          if(*ptr== '\n') { continue; }
          source_ids.push_back(ptr);
        }
      }
      for(node2 = node->first_node("source"); node2; node2 = node2->next_sibling("source")) {
        if((attr = node2->first_attribute("id"))) { source_ids.push_back(attr->value()); }
      }      
    }
    free(xml_text);    
  }
  return source_ids;
}


void  EEDB::WebServices::RegionServer::_proxy_setup_processing_stream() {
  if((_stream_processing_head == NULL) || (_stream_processing_tail == NULL)) { return; }
  if(_processing_datastreams.empty()) { return; }
  
  map<string, EEDB::TrackDef*>::iterator   datasrc;
  for(datasrc=_processing_datastreams.begin(); datasrc!=_processing_datastreams.end(); datasrc++) {
    EEDB::TrackDef*   track = (*datasrc).second;

    //next get proxies in the processing stream and replace them
    vector<EEDB::SPStream*>            proxies;
    vector<EEDB::SPStream*>::iterator  it1;
    _stream_processing_head->get_proxies_by_name(track->name, proxies);
    
    for(it1=proxies.begin(); it1!=proxies.end(); it1++) {
      EEDB::SPStreams::Proxy  *proxy = (EEDB::SPStreams::Proxy*)(*it1);
      
      if(proxy->proxy_stream() == NULL) {
        EEDB::SPStreams::FederatedSourceStream *fstream = secured_federated_source_stream();

        map<string, bool>::iterator it2;
        for(it2 = track->source_ids.begin(); it2 != track->source_ids.end(); it2++) {
          fstream->add_source_id_filter((*it2).first);
        }

        if(!track->source_outmode.empty()) { 
          fstream->set_sourcestream_output(track->source_outmode);
        }
        if(!track->expression_datatype.empty()) { 
          fstream->add_expression_datatype_filter(EEDB::Datatype::get_type(track->expression_datatype));
        }
        
        proxy->proxy_stream(fstream);
      }
    }
  }
}


void  EEDB::WebServices::RegionServer::_cachepoint_setup_processing_stream(EEDB::SPStream*  spstream) {
  if(spstream == NULL) { return; }
  if(_parameters.find("nocache")!=_parameters.end()) { return; }

  //check for end points
  if(spstream->classname() == EEDB::SPStreams::FederatedSourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::SourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::StreamBuffer::class_name) { return; }

  //fprintf(stderr, "_cachepoint_setup_processing_stream %ld [%s]\n", (long)spstream, spstream->classname());

  if(spstream->source_stream()) {
    EEDB::SPStream* source_stream = spstream->source_stream();
    EEDB::SPStreams::CachePoint* cache_point = _check_cachepoint(spstream->source_stream());
    if(cache_point) {
      //found a cachepoint, insert between this node and its source
      spstream->source_stream(cache_point);
    }
    _cachepoint_setup_processing_stream(source_stream); //recurse
  }

  if(spstream->side_stream()) {
    EEDB::SPStream* side_stream = spstream->side_stream();
    EEDB::SPStreams::CachePoint* cache_point = _check_cachepoint(spstream->side_stream());
    if(cache_point) {
      //found a cachepoint, insert between this node and its source
      spstream->side_stream(cache_point);
    }
    _cachepoint_setup_processing_stream(side_stream); //recurse
  }
}


EEDB::SPStreams::CachePoint* EEDB::WebServices::RegionServer::_check_cachepoint(EEDB::SPStream* spstream) {
  if(spstream == NULL) { return NULL; }
  
  //check for TrackCache
  string configXML = _generate_configXML(spstream);
  string hashkey   = MQDB::sha256(configXML);
  //fprintf(stderr, "  _check_cachepoint [%s]\n", hashkey.c_str());
  //fprintf(stderr, "====\n%s\n====\n", configXML.c_str());
  EEDB::TrackCache* tcache = EEDB::TrackCache::fetch_by_hashkey(_userDB, hashkey);
  if(!tcache) { return NULL; }
  
  fprintf(stderr, "found CachePoint [%s] -- %s\n", hashkey.c_str(), spstream->classname());

  EEDB::SPStreams::CachePoint* cachepoint = new EEDB::SPStreams::CachePoint();
  cachepoint->track_cache(tcache);
  cachepoint->source_stream(spstream);
  return cachepoint;
}


//========================================================
//
// remote TrackCache check/create/sync code
//
//========================================================

void  EEDB::WebServices::RegionServer::_remote_trackcache_setup() {
  if(_known_remote_peers.empty()) { return; }
  //fprintf(stderr, "RegionServer::_remote_trackcache_setup :: %ld remote peers in this track\n", _known_remote_peers.size());
  
  //recursive cache_point check to get all intermediate hashkeys
  map<string,bool>             hashkeys;
  map<string, bool>::iterator  it1;

  _get_all_cachpoint_hashkeys(_stream_processing_head, hashkeys);
  if(hashkeys.empty()) { return; }
  //fprintf(stderr, "collected %ld cachepoint hashkeys\n", hashkeys.size());

  string hashkey_list;
  for(it1 = hashkeys.begin(); it1!=hashkeys.end(); it1++) {
    string hashkey = (*it1).first;
    if(!hashkey_list.empty()) { hashkey_list += ","; }
    hashkey_list += hashkey;
  }
  
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = _known_remote_peers.begin(); it2!=_known_remote_peers.end(); it2++) {
    EEDB::Peer* peer = (*it2).second;
    EEDB::SPStreams::RemoteServerStream *rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
    rstream->set_userDB(_userDB);
    //fprintf(stderr, "remote-server %s\n", rstream->xml().c_str());
    rstream->mirror_remote_trackcaches(hashkey_list);
  }
}

void  EEDB::WebServices::RegionServer::_get_all_cachpoint_hashkeys(EEDB::SPStream*  spstream, map<string,bool>& hashkeys) {
  //if(spstream) { fprintf(stderr, "_get_all_cachpoint_hashkeys %ld [%s]\n", (long)spstream, spstream->classname()); }
  //else { fprintf(stderr, "_get_all_cachpoint_hashkeys NULL script\n"); }
  string configXML = _generate_configXML(spstream);
  string hashkey   = MQDB::sha256(configXML);
  
  EEDB::TrackCache* tcache = EEDB::TrackCache::fetch_by_hashkey(_userDB, hashkey);
  if(tcache && tcache->is_remote()) {
    //already exists locally and is already identified as remote
    //fprintf(stderr, "hashkey [%s] already in local db\n", hashkey.c_str());
    tcache->release();
  } else {
    //fprintf(stderr, "hashkey [%s] novel\n", hashkey.c_str());
    hashkeys[hashkey]=true;
  }
  
  //check for end points
  if(spstream == NULL) { return; }
  if(spstream->classname() == EEDB::SPStreams::FederatedSourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::SourceStream::class_name) { return; }
  if(spstream->classname() == EEDB::SPStreams::StreamBuffer::class_name) { return; }
  
  if(spstream->source_stream()) {
    EEDB::SPStream* source_stream = spstream->source_stream();
    _get_all_cachpoint_hashkeys(source_stream, hashkeys); //recurse
  }
  
  if(spstream->side_stream()) {
    EEDB::SPStream* side_stream = spstream->side_stream();
    _get_all_cachpoint_hashkeys(side_stream, hashkeys); //recurse
  }
}


void  EEDB::WebServices::RegionServer::show_trackcache_list() {
  //for sending TrackCache info from primary server to mirroring-server
  _parameters["format"] = "xml";
  _output_header(NULL);
  
  map<string, bool>            hashkeys;
  map<string, bool>::iterator  it1;
  
  if(_parameters.find("cache_hashkeys")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["cache_hashkeys"].size()+2);
    strcpy(buf, _parameters["cache_hashkeys"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        hashkeys[p1] = true;
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  for(it1 = hashkeys.begin(); it1!=hashkeys.end(); it1++) {
    string hashkey = (*it1).first;
    
    EEDB::TrackCache* tcache = EEDB::TrackCache::fetch_by_hashkey(_userDB, hashkey);
    if(tcache and tcache->remote_server_url().empty()) {
      tcache->xml(_output_buffer);
      tcache->release();
    }
  }
  
  _output_footer();
}



////////////////////////////////////////////////////////////////////////////


EEDB::SPStream*  EEDB::WebServices::RegionServer::_append_expression_histogram_binning(EEDB::SPStream *stream) {
  if(!stream) { return stream; }
      
  /*
  double span = (double)(_region_end - _region_start) / (double)_display_width; 
  if(_parameters.find("bin_size")!=_parameters.end()) {
    span = strtod(_parameters["bin_size"].c_str(), NULL);
    //fprintf(stderr, "input span %1.13f\n", span);
  }
  
  if(_parameters["format"] == "wig") {
    span = floor(span + 0.5);
    if(span<1) { span=1; }
    if(span>300) { span=300; }
  }
   */
    
  //
  // use FeatureEmitter and TemplateCluster to create the expression histogram binning
  //
  EEDB::SPStreams::FeatureEmitter *emitter = new EEDB::SPStreams::FeatureEmitter;
  emitter->overlap(0);
  emitter->fixed_grid(true);
  emitter->both_strands(true);
  if(_parameters.find("bin_size") != _parameters.end()) {
    double width = strtod(_parameters["bin_size"].c_str(), NULL);
    emitter->width(width);
    fprintf(stderr, "_append_expression_histogram_binning fixed bin_size %1.13f\n", width);
  } else {
    emitter->dynamic(true);  //uses global display_width or global binning
    fprintf(stderr, "_append_expression_histogram_binning dynamic width\n");
  }

  
  EEDB::SPStreams::TemplateCluster *cluster = new EEDB::SPStreams::TemplateCluster;
  cluster->side_stream(emitter);
  cluster->source_stream(stream);
  cluster->ignore_strand(false);
  cluster->skip_empty_templates(true);
  cluster->overlap_mode(_parameters["overlap_mode"]);
  if(_parameters["binning"] == "sum")   { cluster->expression_mode(CL_SUM); }
  if(_parameters["binning"] == "mean")  { cluster->expression_mode(CL_SUM); }
  if(_parameters["binning"] == "min")   { cluster->expression_mode(CL_MIN); }
  if(_parameters["binning"] == "max")   { cluster->expression_mode(CL_MAX); }
  if(_parameters["binning"] == "count") { cluster->expression_mode(CL_COUNT); }
  
  if(_parameters["strandless"] == "true") {
    emitter->both_strands(false);
    cluster->ignore_strand(true);
  }
  
  if(_parameters["overlap_check_subfeatures"] == "true") {
    cluster->overlap_check_subfeatures(true);
  }

  stream = cluster;
  return stream;
}


////////////////////////////////////////////////////////////////////////////


EEDB::SPStream*  EEDB::WebServices::RegionServer::region_stream() {
  vector<EEDB::Peer*>::iterator      it;
  EEDB::SPStreams::FederatedSourceStream  *fstream;
  EEDB::SPStream                          *stream;
  
  fstream = EEDB::WebServices::WebBase::source_stream();
  fstream->allow_full_federation_search(false);
  fstream->set_sourcestream_output(_parameters["source_outmode"]);

  //public sharing collaboration is linked if user is logged in
  //but for region queries its data should always be available
  if(_public_collaboration) {
    fstream->add_seed_peer(_public_collaboration->group_registry());
  }
  
  stream  = fstream;

  if(_parameters.find("filter") != _parameters.end()) {
    //go back to old method. prebuild the stream up to this point
    //  stream experiments at this point based on filter
    //  and then replace the source filters with new ones
    vector<EEDB::Experiment*>     t_experiments;
    
    fstream->stream_data_sources("Experiment", _parameters["filter"]);
    while(MQDB::DBObject *obj = fstream->next_in_stream()) {
      if(obj->classname() != EEDB::Experiment::class_name) { continue; }
      t_experiments.push_back((EEDB::Experiment*)obj);
    }
    if(t_experiments.empty()) {
      //nothing matches so need empty stream
      fstream->release();
      stream = new EEDB::SPStream();
      return stream;
    } else {
      fstream->clear_source_filters();
      for(unsigned int i=0; i<t_experiments.size(); i++) {
        fstream->add_source_id_filter(t_experiments[i]->db_id());
      }
    }
  }

  if(_parameters.find("exptype") != _parameters.end()) {
    fstream->add_expression_datatype_filter(EEDB::Datatype::get_type(_parameters["exptype"]));
  }

  //do outmode here (no API currently for this, need to add API into FederatedSourceStream,...)
  //  maybe need to reorgnize. currently only used by OSCFileParser but need to migrate up
  //  t_outputmode outputmode


  //add the raw-object-counter here before the script
  if(_raw_objcounter) {  _raw_objcounter->release(); }
  _raw_objcounter = new EEDB::SPStreams::ObjectCount;
  _raw_objcounter->debug(false);
  _raw_objcounter->source_stream(stream);
  stream = _raw_objcounter;


  //append the script last
  if(_stream_processing_head != NULL) {
    _stream_processing_tail->source_stream(stream);
    stream = _stream_processing_head;
  }

  if(_parameters["expression_binning"] == "true") { 
    stream = _append_expression_histogram_binning(stream);
  }
  
  return stream;
}


/*****************************************************************************
*
* request processing methods
*
*****************************************************************************/


void EEDB::WebServices::RegionServer::show_debug() {  
  printf("Content-type: text/xml\r\n\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  
  printf("<region_debug>\n");
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  printf("<parameters>\n");
  map<string,string>::iterator  it1;
  for(it1 = _parameters.begin(); it1 != _parameters.end(); it1++) {
    printf("<param tag=\"%s\">%s</param>\n", (*it1).first.c_str(), (*it1).second.c_str());
  }
  printf("</parameters>\n");
  
  printf("<region asm=\"%s\" chrom=\"%s\" start=\"%ld\" end=\"%ld\" display_width=\"%ld\" />\n",
    _parameters["assembly_name"].c_str(), _parameters["chrom_name"].c_str(),
    _region_start, _region_end, _display_width);

  EEDB::SPStream* stream = region_stream();

  int peer_count = 0;
  int source_count = 0;

  //show sources and peers
  printf("<peers>\n");
  stream->stream_peers();
  while(MQDB::DBObject* obj = stream->next_in_stream()) {
    printf("%s\n", obj->xml().c_str());
    peer_count++;
  }
  printf("</peers>\n");
  
  printf("<sources>\n");
  stream->stream_data_sources();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    printf("%s\n", obj->simple_xml().c_str());
    source_count++;
  }
  printf("</sources>\n");

  printf("<result_count peers=\"%d\" sources=\"%d\" />\n", peer_count, source_count);

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</region_debug>\n");
}



/*****************************************************************************/

void  EEDB::WebServices::RegionServer::show_region_features() {  
  string   assembly = _parameters["assembly_name"];
  string   chrom_name = _parameters["chrom_name"];
  
  // perform security check and return error if data is not 100% available
  if(!security_check()) { return; }

  _remote_trackcache_setup();  //ok but needs more testing/tuning v2.7.3
  _cachepoint_setup_processing_stream(_stream_processing_head);

  if(_trackcache_show_region()) { return; }

  //something failed with the TrackCache so revert back to direct-calc
  _direct_show_region();
}


void  EEDB::WebServices::RegionServer::_direct_show_region() {  
  char                 buffer[2048];
  string               assembly = _parameters["assembly_name"];
  string               chrom_name = _parameters["chrom_name"];
  map<string, bool>    dep_ids;

  EEDB::SPStream* stream = region_stream();
  check_over_memory();

  if(_parameters["expression_visualize"] == "true") {
    _parameters["overlap_mode"] = "height";
    _parameters["binning"] = "sum";
    _parameters["strandless"] = "true";
    //stream = _append_expression_histogram_binning(stream);
  }
    
  _output_header(stream);

  _total_count = 0;
  _raw_count     = 0;

  //stream data sources to make sure they are cached with metadata
  stream->stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)stream->next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
    if(source) { dep_ids[source->db_id()] = true; }
  }

  if(_parameters["format"] == "xml") { 

    snprintf(buffer, 2040,"<params expression_datatype=\"%s\" source_outmode=\"%s\" />\n", 
             _parameters["exptype"].c_str(), _parameters["source_outmode"].c_str());
    _output_buffer.append(buffer);
    if(_stream_processing_head != NULL) { 
      string processing_xml = _stream_processing_head->xml();
      _output_buffer += "<stream_processing>"+processing_xml+"</stream_processing>\n";
    }    

    if(_track_cache) {
      _track_cache->log_location(_user_profile, assembly, chrom_name, _region_start, _region_end);
      _track_cache->xml(_output_buffer);
    }
  }
  check_over_memory();

  string format = _parameters["format"];
  if(format.find("gff") != string::npos) { format = "gff"; }
  if(format.find("bed") != string::npos) { format = "bed"; }
  //fprintf(stderr, "RegionServer::show_region_features outmode[%s] format[%s] mode[%s]\n", _parameters["source_outmode"].c_str(), _parameters["format"].c_str(), _parameters["format_mode"].c_str());

  bool trim_starts=false;
  if(_parameters["feature_restream"] == "true") { trim_starts=true; }

  string last_feature_id;
  long   last_feature_start = -1;
  stream->stream_by_named_region(assembly, chrom_name, _region_start, _region_end);
  bool show_chrom=true;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
    EEDB::Feature *feature= (EEDB::Feature*)obj; 

    if(trim_starts && (feature->chrom_start() < _region_start)) {
      //fprintf(stderr, "feature_restream from %ld, feature %ld trimmed\n", _region_start, feature->chrom_start());
      feature->release();
      continue;
    }
    if(last_feature_start == -1) { last_feature_start = feature->chrom_start(); }

    if((_feature_limit_count>0) && (_total_count>=_feature_limit_count)) {
      fprintf(stderr, "overlimit %ld :: %ld -- %ld\n", _total_count, _feature_limit_count, feature->chrom_start());
      if(feature->chrom_start() != last_feature_start) {
        fprintf(stderr, "restream_start %ld\n", feature->chrom_start());
        snprintf(buffer, 2040, "<restream restart_pos=\"%ld\" limit=\"%ld\" />\n", feature->chrom_start(), _feature_limit_count);
        _output_buffer.append(buffer);
        break;
      }
    }

    //collate all the dependant sources
    EEDB::FeatureSource *fsrc;
    if(feature->feature_source()) {
      fsrc = feature->feature_source();
      if(fsrc) { dep_ids[fsrc->db_id()] = true; }
    }
    vector<EEDB::Feature*> subfeatures = feature->subfeatures();
    for(unsigned int i=0; i<subfeatures.size(); i++) { 
      fsrc = subfeatures[i]->feature_source();
      if(fsrc) { dep_ids[fsrc->db_id()] = true; }
    }
    vector<EEDB::Expression*> expression = feature->expression_array();
    for(unsigned int i=0; i<expression.size(); i++) {
      EEDB::Experiment *exp = expression[i]->experiment();
      if(exp) { dep_ids[exp->db_id()] = true; }
    }


    if(format == "bed") { 
      _output_buffer += feature->bed_description(_parameters["format"]) + "\n";
    }

    if(_parameters["format"] == "wig") {
      //snprintf(buffer, 2040,"%d\t%1.3f\n", $start + floor(($win*$span) + 0.5), $windows->{$win}->{'all'});
    }
    
    if(format == "gff") { _output_buffer += feature->gff_description(false) + "\n"; }
    if(format == "osc" && (_osctable_generator!=NULL))  { 
      _output_buffer += _osctable_generator->osctable_feature_output(feature) + "\n";
    }
    if(format == "das")  { _output_buffer += feature->dasgff_xml() + "\n"; }
    if(format == "xml")  { 
      if(show_chrom && (feature->chrom())) { 
        show_chrom=false;
        feature->chrom()->simple_xml(_output_buffer); 
      }
      if(_parameters["format_mode"] == "fullxml") { 
        feature->xml(_output_buffer);
      } else if(_parameters["submode"] == "simple_feature") { 
        feature->simple_xml(_output_buffer); 
      } else if(_parameters["submode"] == "subfeature") { 
        feature->_xml_start(_output_buffer);
        feature->_xml_subfeatures(_output_buffer);
        feature->_xml_end(_output_buffer);
      } else { 
        feature->xml(_output_buffer);
      }
    }
    _total_count++;
    if(_total_count<10) { check_over_memory(); }
    if(_total_count % 100 == 0) { check_over_memory(); }

    last_feature_start = feature->chrom_start();
    last_feature_id = feature->db_id();

    obj->release();
    _output_buffer_send(true);
  }
  _raw_count = _raw_objcounter->count();
  stream->stream_clear();

  //add all the sources and dependant sources that appeared in the features that streamed
  if(_parameters["format"] == "xml") {
    //fprintf(stderr, "show_region_features -- %ld dependent sources\n", dep_ids.size());
    EEDB::SPStreams::FederatedSourceStream  *fstream = secured_federated_source_stream();
    fstream->clone_peers_on_build(false);
    map<string, bool>::iterator it1;
    for(it1=dep_ids.begin(); it1!=dep_ids.end(); it1++) {
      fstream->add_source_id_filter((*it1).first);
      //fprintf(stderr, "dependent %s\n", (*it1).first.c_str());
    }

    _output_buffer += "<sources>\n";
    if(_parameters.find("filter")!=_parameters.end()) { _output_buffer += "<filter>"+_parameters["filter"]+"</filter>\n"; }
    long int experiment_count=0, fsrc_count=0;
    fstream->stream_data_sources();
    while(EEDB::DataSource *source = (EEDB::DataSource*)fstream->next_in_stream()) {
      //source->simple_xml(_output_buffer);
      EEDB::DataSource::add_to_sources_cache(source);
      if(source->classname() == EEDB::FeatureSource::class_name) {
        fsrc_count++;
        //((EEDB::FeatureSource*)source)->desc_xml(_output_buffer);
      }
      if(source->classname() == EEDB::Experiment::class_name) {
        experiment_count++;
        //((EEDB::Experiment*)source)->desc_xml(_output_buffer);
      }
      source->mdata_xml(_output_buffer, _desc_xml_tags);
    }
    if(experiment_count>0 || fsrc_count>0) {
      snprintf(buffer, 2040, "<result_count experiments=\"%ld\" featuresources=\"%ld\" />\n", experiment_count, fsrc_count);
      _output_buffer.append(buffer);
    }
    _output_buffer += "</sources>\n";

    //_output_buffer += "<peers>\n";
    //fstream->stream_peers();
    //while(MQDB::DBObject* obj = fstream->next_in_stream()) { obj->xml(_output_buffer); }
    //_output_buffer += ("</peers>\n");

    fstream->release();
  }

  _output_footer();
}

     
bool  EEDB::WebServices::RegionServer::_trackcache_show_region() {  
  char                 buffer[2048];
  string               assembly = _parameters["assembly_name"];
  string               chrom_name = _parameters["chrom_name"];

  if(!track_cache()) { return false; }

  if(_track_cache->is_remote()) {
    if(!_track_cache->remote_sync_region(assembly, chrom_name, _region_start, _region_end, _user_profile)) {
      //failed to sync so return false to allow for remote-direct streaming and local processing
      //temporary solution until the 3.0 rebuilt CachePoint/Remote system is ready
      return false;
    }
  }

  if(!check_track_cache(assembly, chrom_name, _region_start, _region_end)) { return false; }
    
  EEDB::ZDX::ZDXstream  *stream = _track_cache->zdxstream();

  _track_cache->log_location(_user_profile, assembly, chrom_name, _region_start, _region_end);

  /*
  if(_parameters["logdownload"] == "true") { 
    long numsegs, numbuilt, numclaimed;
    ZDXdb* zdxdb = stream->zdxdb();
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly, chrom_name, _region_start, _region_end,
                                       numsegs, numbuilt, numclaimed);
    
    EEDB::TrackRequest* buildrequest = new EEDB::TrackRequest();
    buildrequest->assembly_name(assembly);
    if(_user_profile) { buildrequest->user_id(_user_profile->primary_id()); }
    buildrequest->chrom_name(chrom_name); 
    buildrequest->chrom_start(_region_start);
    buildrequest->chrom_end(_region_end);
    buildrequest->num_segs(numsegs);
    buildrequest->unbuilt(numsegs-numbuilt-numclaimed);
    buildrequest->track_name(_parameters["track_title"]);
    buildrequest->view_uuid(_parameters["view_uuid"]);
    buildrequest->store(_track_cache);
  }
  */
  
  if(_parameters["expression_visualize"] == "true") { 
    _parameters["overlap_mode"] = "height";
    _parameters["binning"] = "sum";
    //_parameters["strandless"] = "true";
    //stream = _append_expression_histogram_binning(stream);
  }

  //make sure all sources are cached for lazyload later
  stream->stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)stream->next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
  }  
  
  _output_header(stream);

  _total_count = 0;
  _raw_count     = 0;
  
  if(_parameters["format"] == "xml") { 
    snprintf(buffer, 2040,"<params expression_datatype=\"%s\" source_outmode=\"%s\" />\n", 
             _parameters["exptype"].c_str(), _parameters["source_outmode"].c_str());
    _output_buffer.append(buffer);

    _track_cache->xml(_output_buffer);
    if(_track_cache->is_remote()) { _output_buffer.append("<remote_sync>ok</remote_sync>\n"); }

    //_output_buffer += "<trackcache>" + _track_cache->track_hashkey() + "</trackcache>\n";
    //if(_stream_processing_head != NULL) { 
    //  string processing_xml = _stream_processing_head->xml();
    //  _output_buffer += "<stream_processing>"+processing_xml+"</stream_processing>\n";
    //}
    
    //stream has already been filtered so just request sources
    _output_buffer += "<sources>\n";
    if(_parameters.find("filter")!=_parameters.end()) { _output_buffer += "<filter>"+_parameters["filter"]+"</filter>\n"; }
    stream->stream_data_sources();
    long int experiment_count=0, fsrc_count=0;
    while(EEDB::DataSource* source = (EEDB::DataSource*)stream->next_in_stream()) {
      source->simple_xml(_output_buffer);
      EEDB::DataSource::add_to_sources_cache(source);
      if(source->classname() == EEDB::FeatureSource::class_name) { fsrc_count++; }
      if(source->classname() == EEDB::Experiment::class_name) { experiment_count++; }      
    }    
    if(experiment_count>0 || fsrc_count>0) {
      snprintf(buffer, 2040, "<result_count experiments=\"%ld\" featuresources=\"%ld\" />\n", experiment_count, fsrc_count);
      _output_buffer.append(buffer);
    }
    _output_buffer += "</sources>\n";
  }

  string format = _parameters["format"];
  if(format.find("gff") != string::npos) { format = "gff"; }
  if(format.find("bed") != string::npos) { format = "bed"; }
  //fprintf(stderr, "RegionServer::show_region_features outmode[%s] format[%s] mode[%s]\n", _parameters["source_outmode"].c_str(), _parameters["format"].c_str(), _parameters["format_mode"].c_str());
  
  bool trim_starts=false;
  if(_parameters["feature_restream"] == "true") { trim_starts=true; }

  string last_feature_id;
  long   last_feature_start = -1;

  stream->stream_by_named_region(assembly, chrom_name, _region_start, _region_end);
  bool show_chrom=true;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
    EEDB::Feature *feature= (EEDB::Feature*)obj; 

    if(trim_starts && (feature->chrom_start() < _region_start)) {
      //fprintf(stderr, "feature_restream from %ld, feature %ld trimmed\n", _region_start, feature->chrom_start());
      feature->release();
      continue;
    }
    if(last_feature_start == -1) { last_feature_start = feature->chrom_start(); }

    if((_feature_limit_count>0) && (_total_count>=_feature_limit_count)) {
      fprintf(stderr, "overlimit %ld :: %ld - %ld\n", _total_count, _feature_limit_count, feature->chrom_start());
      if(feature->chrom_start() != last_feature_start) {
        fprintf(stderr, "restream_start %ld\n", feature->chrom_start());
        snprintf(buffer, 2040, "<restream restart_pos=\"%ld\" limit=\"%ld\" trackcache=\"yes\" />\n", feature->chrom_start(), _feature_limit_count);
        _output_buffer.append(buffer);
        break;
      }
    }
    
    if(format == "bed") { 
      _output_buffer += feature->bed_description(_parameters["format"]) + "\n";
    }
    
    if(_parameters["format"] == "wig") {
      //snprintf(buffer, 2040,"%d\t%1.3f\n", $start + floor(($win*$span) + 0.5), $windows->{$win}->{'all'});
    }
    
    if(format == "gff") { _output_buffer += feature->gff_description(false) + "\n"; }
    if(format == "osc" && (_osctable_generator!=NULL))  { 
      _output_buffer += _osctable_generator->osctable_feature_output(feature) + "\n";
    }
    if(format == "das")  { _output_buffer += feature->dasgff_xml() + "\n"; }
    if(format == "xml")  { 
      if(show_chrom && (feature->chrom())) { 
        show_chrom=false;
        feature->chrom()->simple_xml(_output_buffer); 
      }
      if(_parameters["format_mode"] == "fullxml") { 
        feature->xml(_output_buffer);
      } else if(_parameters["submode"] == "simple_feature") { 
        feature->simple_xml(_output_buffer); 
      } else if(_parameters["submode"] == "subfeature") { 
        feature->_xml_start(_output_buffer);
        feature->_xml_subfeatures(_output_buffer);
        feature->_xml_end(_output_buffer);
      } else { 
        feature->xml(_output_buffer);
      }
    }
    _total_count++;
    last_feature_start = feature->chrom_start();
    last_feature_id = feature->db_id();
    obj->release();
    _output_buffer_send(true);
  }
  if(_raw_objcounter) { _raw_count = _raw_objcounter->count(); }
  
  _output_footer();
  return true;
}


void  EEDB::WebServices::RegionServer::send_trackcache_zdx() {
  printf("Content-type: text/plain\r\n\r\n");
  //printf("Content-type: application/octet-stream\r\n\r\n");  
  
  track_cache();
  if(!_track_cache or !(_track_cache->zdxstream())) {
    printf("ERROR:no_trackcache\n");
    return; 
  }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  ZDXdb* zdxdb = zdxstream->zdxdb();
  
  if(!security_check()) { //adds at least 100msec to process
    printf("ERROR:security_failed\n");
    return; 
  }
  
  //
  // loop through the zsegments for this region
  //  
  string   assembly_name = _parameters["assembly_name"];
  string   chrom_name    = _parameters["chrom_name"];
  long start = _region_start;
  if(start < 1) { start = 1; }

  EEDB::ZDX::ZDXsegment* zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, assembly_name, chrom_name, start);
  if(!zseg) {
    printf("ERROR:zseg_location_error\n");
    return; 
  }
  while(zseg) {
    if((_region_end>0) and (zseg->chrom_start()>_region_end)) { 
      zseg->release();
      zseg = NULL;
      break;
    }
    if(zseg->is_built()) {
      zseg->binary_sync_send(stdout);
    }    
    EEDB::ZDX::ZDXsegment *t_zseg = zseg->next_segment();
    zseg->release();
    zseg = t_zseg;
  }
}


/*****************************************************************************/


void  EEDB::WebServices::RegionServer::show_region_stats() {  
  string               assembly = _parameters["assembly_name"];
  string               chrom_name = _parameters["chrom_name"];

  _parameters["source_outmode"] = "simple_feature";

  EEDB::SPStream* stream = region_stream();
  _output_header(stream);

  _total_count = 0;
  stream->stream_by_named_region(assembly, chrom_name, _region_start, _region_end);
  while(stream->next_in_stream()) {
    _total_count++;
  }
  _raw_count = _total_count;

  _output_footer();
}


/*****************************************************************************/


void EEDB::WebServices::RegionServer::show_source_stream() {
  //used for debugging and stream coordination, shows XML description of current stream setup
  printf("Content-type: text/xml\r\n\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<stream>\n");

  EEDB::SPStream* stream = region_stream();

  printf("%s", stream->xml().c_str());

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</stream>\n");
}


/*****************************************************************************/


void EEDB::WebServices::RegionServer::show_region_sequence() {
  //used for debugging and stream coordination, shows XML description of current stream setup
  printf("Content-type: text/xml\r\n\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  string assembly_name = _parameters["assembly_name"];
  string chrom_name    = _parameters["chrom_name"];
  string strand        = _parameters["strand"];
  if(strand!="+" and strand!="-") { strand = "+"; }

  printf("<genome_sequence asm=\"%s\" chrom=\"%s\" start=\"%ld\" end=\"%ld\" strand=\"%s\" len=\"%ld\" >\n",
      assembly_name.c_str(), chrom_name.c_str(),
      _region_start, _region_end, strand.c_str(), _region_end-_region_start+1);

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  EEDB::Chrom     *chrom = NULL;
  EEDB::Assembly *assembly = find_assembly(assembly_name);
  if(assembly) {
    printf("%s", assembly->xml().c_str());
    chrom = assembly->get_chrom(chrom_name.c_str());
  }

  if(chrom) {
    printf("%s", chrom->xml().c_str());
    string sequence;
    string uuid;
    string objClass="Feature";
    long int objID = -1;      
    parse_federated_id(chrom->db_id(), uuid, objID, objClass);
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { printf("%s\n", peer->xml().c_str()); }
    if(peer!=NULL && peer->is_remote()) {
      //fprintf(stderr, "need to get remote region sequence from peer %s\n", peer->xml().c_str());
      EEDB::SPStreams::RemoteServerStream* rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      sequence = rstream->fetch_region_sequence(_user_profile,assembly_name, chrom_name, _region_start, _region_end, strand);
    } else {
      sequence = chrom->get_subsequence(_region_start, _region_end, strand);
    }
    if(!sequence.empty()) {
      printf("<sequence length=\"%ld\">%s</sequence>\n", sequence.size(), sequence.c_str());
    }
  }

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</genome_sequence>\n");
}


/*****************************************************************************/


void EEDB::WebServices::RegionServer::show_datasources() {  
  printf("Content-type: text/xml\r\n\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  printf("<sources>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  
  EEDB::SPStream  *stream = region_stream();

  if(_track_cache) {
    printf("<trackcache>%s</trackcache>\n", _track_cache->track_hashkey().c_str());
  }
  
  if(_parameters.find("filter") != _parameters.end()) {
    printf("<filter>%s</filter>\n",html_escape(_parameters["filter"]).c_str());
    stream->stream_data_sources("", _parameters["filter"]);
  } else {
    stream->stream_data_sources("");
  }
  
  if(_stream_processing_head != NULL) { 
    string configXML = generate_configXML();
    printf("%s\n", configXML.c_str());
  }
  
  vector<EEDB::DataSource*>   t_sources;
  map<string, EEDB::Peer*>    t_peers;
  _global_source_counts.clear();
  
  while(EEDB::DataSource *obj = (EEDB::DataSource*)stream->next_in_stream()) {
    t_sources.push_back(obj);

    if(obj->classname() == EEDB::FeatureSource::class_name) { 
      _global_source_counts["FeatureSource"][obj->db_id()] = true;
    }
    if(obj->classname() == EEDB::Experiment::class_name) { 
      _global_source_counts["Experiment"][obj->db_id()] = true;
    }
    if(obj->classname() == EEDB::EdgeSource::class_name) { 
      _global_source_counts["EdgeSource"][obj->db_id()] = true;
    }
    
    if(obj->peer_uuid()) { 
      string uuid = obj->peer_uuid();
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { t_peers[uuid] = peer; }
    }
  }
  
  long int total_count = 0;
  total_count += _global_source_counts["Experiment"].size();
  total_count += _global_source_counts["FeatureSource"].size();
  total_count += _global_source_counts["EdgeSource"].size();
  
  printf("<result_count method=\"sources\" total=\"%ld\" experiments=\"%ld\" featuresources=\"%ld\" peers=\"%ld\"/>\n", 
         total_count, 
         _global_source_counts["Experiment"].size(), 
         _global_source_counts["FeatureSource"].size(), 
         t_peers.size());


  for(unsigned int i=0; i< t_sources.size(); i++) {
    print_object_xml(t_sources[i]);
  }
  
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
  }  
  
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</sources>\n");
}


/*****************************************************************************/


void EEDB::WebServices::RegionServer::genome_download() {
  char                 buffer[2048];
  string               assembly_name = _parameters["assembly_name"];
  struct timeval       endtime, time_diff;
  
  if(!track_cache()) { 
    _output_header(NULL);
    _output_footer();
    return;
  }
  
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) {
    _output_header(NULL);
    _output_footer();
    return;
  }
  ZDXdb* zdxdb = zdxstream->zdxdb();

  long numsegs, numbuilt, numclaimed, seg_start;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, "", -1, -1,
                                     numsegs, numbuilt, numclaimed, seg_start);
  if(numsegs != numbuilt) {
    show_trackcache_stats();
    return;
  }
  _track_cache->log_location(_user_profile, assembly_name, "", -1, -1);
    
  _total_count = 0;
  _raw_count = 0;

  string format = _parameters["format"];
  if(format.find("gff") != string::npos) { format = "gff"; }
  if(format.find("bed") != string::npos) { format = "bed"; }
  
  
  // get chroms
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  fprintf(stderr,"genome_download %ld chroms\n", chroms.size());

  //make sure all sources are cached for lazyload later
  zdxstream->stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)zdxstream->next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
  }    
  
  //now stream each chrom out
  _output_header(zdxstream);

  if(format == "xml") { 
    snprintf(buffer, 2040,"<note>%ld chroms to scan</note>\n", chroms.size()); 
    _output_buffer.append(buffer);
    if(_stream_processing_head != NULL) { 
      string processing_xml = _stream_processing_head->xml();
      _output_buffer += "<stream_processing>"+processing_xml+"</stream_processing>\n";
    }
  }
    
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {

    _output_buffer_send(false); //forces a flush output

    EEDB::Chrom *chrom = (*chr_it);
    string last_feature_id;
    //fprintf(stderr,"genome_download [%s]\n", chrom->fullname().c_str());

    zdxstream->stream_by_named_region(assembly_name, chrom->chrom_name(), -1, -1);
    while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
      EEDB::Feature    *feature = NULL;
      EEDB::Expression *expression = NULL;
      if(obj->classname() == EEDB::Feature::class_name) { feature = (EEDB::Feature*)obj; }
      if(obj->classname() == EEDB::Expression::class_name) { 
        feature    = ((EEDB::Expression*)obj)->feature(); 
        expression = (EEDB::Expression*)obj; 
      }
      if(feature == NULL) { obj->release(); continue; }
      if((expression !=NULL) and (expression->value()==0.0) and (format=="gff" or format=="bed")) { obj->release(); continue; }
      
      if(format == "bed") {
        if(expression!=NULL) { _output_buffer += expression->bed_description(_parameters["format"]) + "\n"; } 
        else { _output_buffer += feature->bed_description(_parameters["format"]) + "\n"; }
      }
      if(expression!=NULL and (last_feature_id == feature->db_id())) { obj->release(); continue; }
      
      if(format == "gff") { _output_buffer += feature->gff_description(false) + "\n"; }
      if(format == "osc" && (_osctable_generator!=NULL))  { 
        _output_buffer += _osctable_generator->osctable_feature_output(feature) + "\n"; 
      }
      if(format == "das")  { _output_buffer += feature->dasgff_xml(); }
      if(format == "xml")  { 
        if(_total_count==1) { feature->chrom()->simple_xml(_output_buffer); }
        if(_parameters["submode"] == "simple_feature") { 
          feature->simple_xml(_output_buffer); 
        } else if(_parameters["submode"] == "subfeature") { 
          feature->_xml_start(_output_buffer);
          feature->_xml_subfeatures(_output_buffer);
          feature->_xml_end(_output_buffer);
        } else { 
          feature->xml(_output_buffer);
        }
      }
      _total_count++;
      last_feature_id = feature->db_id();
      obj->release();
      _output_buffer_send(true);
    }

    gettimeofday(&endtime, NULL);
    timersub(&endtime, &_starttime, &time_diff);
    double runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
    fprintf(stderr, "%s :: %1.2f obj/sec  %ld \n", chrom->fullname().c_str(), (_total_count/runtime), _total_count);
  }
  _output_buffer_send(false); //forces a flush output
    
  _output_footer();
}



/*****************************************************************************
*
* helper methods
*
*****************************************************************************/


void  EEDB::WebServices::RegionServer::_output_header(EEDB::SPStream* stream) {
  string filename = "gLyphs_data_export";
  string assembly_name = _parameters["assembly_name"];
  string chrom_name    = _parameters["chrom_name"];

  if(_parameters.find("track_title") != _parameters.end()) { 
    filename = _parameters["track_title"];
    boost::algorithm::replace_all(filename, " ", "_");
    boost::algorithm::replace_all(filename, ",", "");
    boost::algorithm::replace_all(filename, ";", "");
    boost::algorithm::replace_all(filename, ":", "");
    boost::algorithm::replace_all(filename, "#", "");
    boost::algorithm::replace_all(filename, "@", "");
    boost::algorithm::replace_all(filename, "+", "");
    boost::algorithm::replace_all(filename, "=", "");
    boost::algorithm::replace_all(filename, "\%", "");
    boost::algorithm::replace_all(filename, "&", "");
    boost::algorithm::replace_all(filename, "{", "");
    boost::algorithm::replace_all(filename, "}", "");
    boost::algorithm::replace_all(filename, "\\", "");
    boost::algorithm::replace_all(filename, "/", "");
    boost::algorithm::replace_all(filename, "\?", "");
    boost::algorithm::replace_all(filename, "$", "");
    boost::algorithm::replace_all(filename, "!", "");
    boost::algorithm::replace_all(filename, "*", "");
    boost::algorithm::replace_all(filename, "<", "");
    boost::algorithm::replace_all(filename, ">", "");
    boost::algorithm::replace_all(filename, "\'", "");
    boost::algorithm::replace_all(filename, "`", "");
    boost::algorithm::replace_all(filename, "\"", "");
  }

  char buffer[2048];
  _output_buffer.clear();

  if(_parameters["format"] == "osc") {
    if(_parameters["savefile"] == "true") {
      printf("Content-type: text/plain\r\n");
      printf("Content-Disposition: attachment; filename=%s.osc;\r\n", filename.c_str());
    } else {
      printf("Content-type: text/plain\r\n");
    }
    //printf("Content-Encoding: gzip\r\n");
    printf("\r\n");

    _osctable_generator = new EEDB::Tools::OSCTableGenerator;
    _osctable_generator->source_stream(stream);
    _osctable_generator->assembly_name(assembly_name);

    _osctable_generator->export_subfeatures("");
    if(_parameters.find("export_subfeatures") != _parameters.end()) { _osctable_generator->export_subfeatures(_parameters["export_subfeatures"]); }

    _osctable_generator->export_experiment_metadata(false);
    if(_parameters["export_experiment_metadata"] == "true") { _osctable_generator->export_experiment_metadata(true); }

    _osctable_generator->export_header_metadata(true);
    if(_parameters["export_osc_metadata"] == "false") { _osctable_generator->export_header_metadata(false); }

    _osctable_generator->export_feature_metadata(false);
    if(_parameters["export_feature_metadata"] == "true") { _osctable_generator->export_feature_metadata(true); }

    if(_parameters.find("output_datatype") != _parameters.end()) {
      _osctable_generator->add_expression_datatype(EEDB::Datatype::get_type(_parameters["output_datatype"]));
    }
    else if(_parameters.find("exptype") != _parameters.end()) {
      _osctable_generator->add_expression_datatype(EEDB::Datatype::get_type(_parameters["exptype"]));
    }
    
    _output_buffer.append(_osctable_generator->generate_oscheader());
    _output_buffer_send(false); //force a flush
  }
  
  else if(_parameters["format"].find("bed") == 0) {

    if(_parameters["savefile"] == "true") {
      printf("Content-type: text/plain\r\n");
      printf("Content-Disposition: attachment; filename=%s.bed;\r\n", filename.c_str());
    } else {
      printf("Content-type: text/plain\r\n");
    }
    //printf("Content-Encoding: gzip\r\n");
    printf("\r\n");

    /*
    snprintf(buffer, 2040, "browser position %s %s:%ld-%ld\n", assembly_name.c_str(), chrom_name.c_str(), _region_start, _region_end);
    _output_buffer.append(buffer);
    //_output_buffer.append("browser hide all\n");
    if(_parameters.find("track_title") != _parameters.end()) { 
      _output_buffer += "track name=\""+_parameters["track_title"]+"\"\n";
    } else {
      _output_buffer.append("track name=\"eedb test track\"\n");
    }
    //_output_buffer.append("visibility=2\n");
    */
  }

  else if(_parameters["format"].find("gff") == 0) {
    if(_parameters["savefile"] == "true") {
      printf("Content-type: text/plain\r\n");
      printf("Content-Disposition: attachment; filename=%s.gff;\r\n", filename.c_str());
    } else {
      printf("Content-type: text/plain\r\n");
    }
    //printf("Content-Encoding: gzip\r\n");
    printf("\r\n");
    /*
    #_output_buffer.append("browser position %s %s:%d-%d\n", $assembly_name, $chrom_name, $start, $end);
    #_output_buffer.append("browser hide all\n");
    #if($self->{'track_title'}) {
    #  _output_buffer.append("track name=\"%s\"\n", $self->{'track_title'});
    #} else {
    #  _output_buffer.append("track name=\"eedb test track\"\n");
    #}
    #_output_buffer.append("visibility=2\n");
    */
  }

  else if(_parameters["format"] == "xml") {
    if(_parameters["savefile"] == "true") {
      printf("Content-type: text/plain\r\n");
      printf("Content-Disposition: attachment; filename=%s.xml;\r\n", filename.c_str());
      //printf("Content-Encoding: gzip\r\n");
      printf("\r\n");
    } else {
      printf("Content-type: text/xml\r\n");
      //printf("Content-Encoding: gzip\r\n");
      printf("\r\n");
      printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    }

    snprintf(buffer, 2040, "<region asm=\"%s\" chrom=\"%s\" win_width=\"%ld\" start=\"%ld\" end=\"%ld\" len=\"%ld\" >\n",
      _parameters["assembly_name"].c_str(), _parameters["chrom_name"].c_str(), _display_width,
      _region_start, _region_end, _region_end-_region_start+1);
    _output_buffer.append(buffer);

    if(_user_profile) { _output_buffer.append(_user_profile->simple_xml()); } 
    //if($self->{'error_log'}) { _output_buffer.append("<error_log>%s</error_log>\n", $self->{'error_log'}); }
    snprintf(buffer, 2040,"<note>%d peer_ids, %d source_ids</note>\n", (int)_filter_peer_ids.size(), (int)_filter_source_ids.size());
    _output_buffer.append(buffer);

    struct timeval  endtime, time_diff;
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &_starttime, &time_diff);
    double   runtime  = (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0;
    snprintf(buffer, 2040,"<processtime msec=\"%1.6f\">init setup</processtime>\n", runtime);
    _output_buffer.append(buffer);
  }
  
  else if(_parameters["format"] == "das") {
    if(_parameters["savefile"] == "true") {
      printf("Content-type: text/plain\r\n");
      printf("Content-Disposition: attachment; filename=%s.xml;\r\n", filename.c_str());
      //printf("Content-Encoding: gzip\r\n");
      printf("\r\n");
    } else {
      printf("Content-type: text/xml\r\n");
      //printf("Content-Encoding: gzip\r\n");
      printf("\r\n");
      printf("<\?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"\?>\n");
    }
    _output_buffer.append("<!DOCTYPE DASGFF SYSTEM \"http://www.biodas.org/dtd/dasgff.dtd\">\n");
    _output_buffer.append("<DASGFF>\n");
    _output_buffer.append("<GFF version=\"1.0\" href=\"url\">\n");
    snprintf(buffer, 2040,"<SEGMENT id=\"%s\" start=\"%ld\" stop=\"%ld\" type=\"%s\" version=\"%s\" label=\"%s\">\n",
             _parameters["chrom_name"].c_str(), 
             _region_start, _region_end,
             "chromosome",
             _parameters["assembly_name"].c_str(), 
             _parameters["chrom_name"].c_str());
    _output_buffer.append(buffer);
  }

  else if(_parameters["format"]  == "wig") {
    if(_parameters["savefile"] == "true") {
      printf("Content-type: text/plain\r\n");
      printf("Content-Disposition: attachment; filename=%s.wig;\r\n", filename.c_str());
    } else {
      printf("Content-type: text/plain\r\n\r\n");
    }
    /*
    _output_buffer.append("browser position %s:%d-%d\n",  $chrom_name, $start, $end);
    _output_buffer.append("browser hide all\n");
    _output_buffer.append("browser pack refGene encodeRegions\n");
    _output_buffer.append("browser dense gap assembly rmsk mrna est\n");
    _output_buffer.append("browser full altGraph\n");

    _output_buffer.append("track type=wiggle_0 name=\"CAGE_L1\" description=\"variableStep format\" ");
    #_output_buffer.append("visibility=full autoScale=off viewLimits=0.0:25.0 color=0,255,0 ");
    _output_buffer.append("visibility=full color=0,255,0 ");
    _output_buffer.append("priority=10\n");
    _output_buffer.append("variableStep chrom=%s span=%d\n", $chrom_name, $span);
    _output_buffer.append("#params start=%s  end=%s  reg_len=%d  win_width=%s\n", $start, $end, $end-$start, _display_width);
    */
  } 
  else {
    printf("Content-type: text/plain\r\n\r\n");
  }
  
  _output_buffer_send(true);
}


void  EEDB::WebServices::RegionServer::_output_footer() {
  char                 buffer[2048];
  struct timeval       endtime, time_diff;
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  
  if(_parameters["format"] == "xml") {
    //fprintf(stderr, "<process_summary processtime_sec=\"%1.6f\" count=\"%ld\" rawcount=\"%ld\"/>\n", runtime, _total_count, _raw_count);
    if(runtime < 1.0) {
      snprintf(buffer, 2040,"<process_summary processtime_msec=\"%1.6f\" count=\"%ld\" rawcount=\"%ld\"/>\n", runtime*1000.0, _total_count, _raw_count);
    } else {
      snprintf(buffer, 2040,"<process_summary processtime_sec=\"%1.6f\" count=\"%ld\" rawcount=\"%ld\"/>\n", runtime, _total_count, _raw_count);
    }

    _output_buffer.append(buffer);
    snprintf(buffer, 2040,"<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
    _output_buffer.append(buffer);
    _output_buffer.append("</region>\n");
  }
  
  if(_parameters["format"] == "das") {
    _output_buffer.append("</SEGMENT>\n");
    _output_buffer.append("</GFF>\n");
    _output_buffer.append("</DASGFF>\n");      
  }

  if((_parameters["format"] == "wig")) {
    //fprintf(stderr, "wig processtime_sec: %1.3f   count: %ld\n", runtime, _total_count);
  }
  
  if((_parameters["format"].find("bed") != string::npos) or (_parameters["format"] == "osc")) { 
    //maybe also output for GFF
    //fprintf(stderr,"bed processtime_sec: %1.6f   raw_count: %ld   processed_count: %ld\n", runtime, _raw_count, _total_count);
  }

  _output_buffer_send(false); //forces a flush output
  

  fprintf(stderr,"region processtime_sec: %1.6f   raw_count: %ld   processed_count: %ld\n", runtime, _raw_count, _total_count);
}


void  EEDB::WebServices::RegionServer::_output_buffer_send(bool check) {
  if(check && _output_buffer.size() < 100000) { return; }
  
  printf("%s", _output_buffer.c_str());
  fflush(stdout);

  _output_buffer.clear();
}


/*****************************************************************************
 *
 * TrackCache configXML methods
 *
 *****************************************************************************/


string  EEDB::WebServices::RegionServer::generate_configXML() {
  return _generate_configXML(_stream_processing_head);
}

string  EEDB::WebServices::RegionServer::_generate_configXML(EEDB::SPStream* script_stream) {
  //do not allow older style peer/name style of defining tracks
  //if(_filter_source_ids.empty()) { return ""; }
  
  //need to recurse the stream (since used for cachepoint) and check for both
  //  dynamic-emitters and to collect the actual proxy datasources in use
  
  string configXML = "<ZConfigXML><gLyphTrack";
  
  //first attributes of the gLyphTrack
  if(_parameters.find("source_outmode")!=_parameters.end()) {    
    configXML += " source_outmode=\"" + _parameters["source_outmode"] +"\"";
  }
  if(_parameters.find("exptype")!=_parameters.end()) {
    configXML += " exptype=\"" + _parameters["exptype"] +"\"";
  }
  if(_parameters.find("filter")!=_parameters.end()) {   
    configXML += " filter=\"" + _parameters["filter"] +"\"";
  }
  if(_parameters.find("assembly_name")!=_parameters.end()) {    
    configXML += " assembly_name=\"" + _parameters["assembly_name"] +"\"";
  }
  
  //if(EEDB::SPStreams::FeatureEmitter::dynamic_emitters_exist) {
  if(check_script_for_dynamic_emitter(script_stream) ||
     ((_parameters["expression_binning"] == "true") && (_parameters.find("bin_size") == _parameters.end()))) {
    if(EEDB::WebServices::WebBase::global_parameters.find("global_bin_size")!=EEDB::WebServices::WebBase::global_parameters.end()) {    
      configXML += " global_bin_size=\"" + EEDB::WebServices::WebBase::global_parameters["global_bin_size"] +"\"";
    }
  }
  configXML += " >";
  
  //source_ids
  vector<string> _sorted_source_ids;
  map<string, bool>::iterator  it2;
  for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
    _sorted_source_ids.push_back((*it2).first);
  }
  sort(_sorted_source_ids.begin(), _sorted_source_ids.end());
  configXML += "<source_ids>";
  for(unsigned int i=0; i<_sorted_source_ids.size(); i++) {
    if(i>0) { configXML += ","; }
    configXML += _sorted_source_ids[i];
  }
  configXML += "</source_ids>";
  
  //zenbu_script
  if(script_stream != NULL) { 
    configXML += "<zenbu_script>";
    
    //TODO: new check for proxies within script-stream
    map<string, bool> proxy_hash;
    check_script_for_proxy_datasources(script_stream, proxy_hash);

    //datasources of script
    map<string, EEDB::TrackDef*>::iterator   datasrc;
    for(datasrc=_processing_datastreams.begin(); datasrc!=_processing_datastreams.end(); datasrc++) {
      EEDB::TrackDef*   track = (*datasrc).second;
      if(proxy_hash.find(track->name) == proxy_hash.end()) {
        //fprintf(stderr, "datastream [%s] not found\n", track->name.c_str());
        continue;
      }
      configXML += "<datastream name=\"" + track->name +"\"";
      if(!track->source_outmode.empty()) { configXML += " source_outmode=\"" + track->source_outmode +"\""; }
      if(!track->expression_datatype.empty()) { configXML += " datatype=\"" + track->expression_datatype +"\""; }         
      //if(!track.track_uuid.empty()) { configXML += " track_uuid=\"" + track->track_uuid +"\""; }
      configXML +=">";

      map<string, bool>::iterator it2;
      for(it2 = track->source_ids.begin(); it2 != track->source_ids.end(); it2++) {
        configXML += "<source id=\"" + (*it2).first +"\"/>";
      }
      configXML += "</datastream>";
    }
    
    // stream processing modules
    configXML += "<stream_processing>";
    string processing_xml = script_stream->xml();
    configXML += processing_xml;
    configXML += "</stream_processing></zenbu_script>";    
  }
  
  //expression_binning
  if(_parameters["expression_binning"] == "true") { 
    configXML += "<expression_binning";
    if(_parameters.find("overlap_mode")!=_parameters.end()) {
      configXML += " overlap_mode=\"" + _parameters["overlap_mode"] +"\"";
    }
    if(_parameters.find("binning")!=_parameters.end()) {
      configXML += " binning=\"" + _parameters["binning"] +"\"";
    }
    if(_parameters.find("strandless")!=_parameters.end()) {
      configXML += " strandless=\"" + _parameters["strandless"] +"\"";
    }
    if(_parameters.find("bin_size")!=_parameters.end()) {
      configXML += " bin_size=\"" + _parameters["bin_size"] +"\"";
    }
    if(_parameters.find("overlap_check_subfeatures")!=_parameters.end()) {
      configXML += " subfeatures=\"" + _parameters["overlap_check_subfeatures"] +"\"";
    }    
    configXML += " />";
  }
  
  //finish
  configXML += "</gLyphTrack></ZConfigXML>";
  return configXML;
}


EEDB::TrackCache*  EEDB::WebServices::RegionServer::track_cache() {
  //this method is used from the context of a configured RegionServer
  //and use that configuration [configXML] to find/create a TrackCache
  //fprintf(stderr, "RegionServer::track_cache\n");
  if(!_userDB) { return NULL; }
  if(_track_cache) { return _track_cache; }
  if(_filter_source_ids.empty()) { return NULL; }

  string configXML = generate_configXML();
  string hashkey   = MQDB::sha256(configXML);

  //fprintf(stderr, "%s\n", configXML.c_str());
  //fprintf(stderr, "hashkey [%s]\n", hashkey.c_str());
  
  //_track_cache = EEDB::TrackCache::fetch_by_configXML(_userDB, configXML);
  _track_cache = EEDB::TrackCache::fetch_by_hashkey(_userDB, hashkey);
  if(_track_cache) { 
    if(!_track_cache->cache_file_exists()) {
      _build_trackcache_chroms();
    }
    return _track_cache; 
  }

  //does not exist so create one based on this configXML definition
  _track_cache = new EEDB::TrackCache();
  _track_cache->track_configxml(configXML);
  
  if(_parameters.find("track_title") != _parameters.end()) { 
    _track_cache->metadataset()->add_tag_data("track_title", _parameters["track_title"]);
  }
  if(_parameters.find("assembly_name") != _parameters.end()) { 
    _track_cache->metadataset()->add_tag_data("assembly_name", _parameters["assembly_name"]);
  }
  if(_parameters.find("track_uuid") != _parameters.end()) { 
    _track_cache->metadataset()->add_tag_symbol("track_uuid", _parameters["track_uuid"]);
  }

  //store trackcache
  if(!_track_cache->store(_userDB)) {
    fprintf(stderr, "error: failed to store track cache\n");
    _track_cache->release();
    _track_cache = NULL;
    return NULL;
  }

  _build_trackcache_chroms();

  return _track_cache;
}  


bool  EEDB::WebServices::RegionServer::check_track_cache(string assembly_name, string chrom_name, long start, long end) {
  //this is the method used at query time to see if TrackCache is built
  if(!track_cache()) { return false; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }

  //changed logic to create cache and allow history_log 
  //BUT but do not fetch from TrackCache and do not log a build_request
  if(_parameters.find("nocache")!=_parameters.end()) { return false; }

  if(zdxstream->is_built(assembly_name, chrom_name, start, end)) { 
    return true; 
  }
  
  // log a 'guest' track_request for this region
  //fprintf(stderr, "request build track_cache [%s] [%s] %ld %ld\n", assembly_name.c_str(), chrom_name.c_str(), start, end);
    
  ZDXdb* zdxdb = zdxstream->zdxdb();
  long numsegs, numbuilt, numclaimed, unbuilt, seg_start;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, chrom_name, start, end,
                                     numsegs, numbuilt, numclaimed, seg_start);
  
  if(numsegs==0) {
    //trackcache not properly built so create chroms
    _build_trackcache_chroms();
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, chrom_name, start, end,
                                       numsegs, numbuilt, numclaimed, seg_start);
  }

  unbuilt = numsegs-numbuilt-numclaimed;
  if(unbuilt>0) {  
    EEDB::TrackRequest* buildrequest = new EEDB::TrackRequest();
    buildrequest->assembly_name(assembly_name);
    buildrequest->chrom_name(chrom_name); 
    buildrequest->chrom_start(start);
    buildrequest->chrom_end(end);
    buildrequest->num_segs(numsegs);
    buildrequest->unbuilt(numsegs-numbuilt-numclaimed);
    buildrequest->track_name(_parameters["track_title"]);
    buildrequest->view_uuid(_parameters["view_uuid"]);
    
    buildrequest->store(_track_cache);
  }
  
  return false;
}
 

bool EEDB::WebServices::RegionServer::security_check() {  
  map<string, bool>     source_hash;
  char                  buffer[2048];
  
  long int ok_count    = secure_access_check(source_hash);
  long int total_count = source_hash.size();
  
  if(ok_count == total_count) { return true; }

  //
  // security error, output error messages so that it can terminate
  //
  _output_header(NULL);

  snprintf(buffer, 2040, "<security_error total=\"%ld\" blocked=\"%ld\"  accessible=\"%ld\" />\n", 
           source_hash.size(), (source_hash.size() - ok_count), ok_count);
  _output_buffer.append(buffer);

  map<string, bool>::iterator  it1;
  for(it1 = source_hash.begin(); it1 != source_hash.end(); it1++) {
    if(!(*it1).second) { 
      _output_buffer += "<blocked id=\"" + (*it1).first +"\"/>\n"; 
    }
  }
  
  _total_count = 0;
  _raw_count   = 0;
  _output_footer();
    
  return false;
}


long int  EEDB::WebServices::RegionServer::secure_access_check(map<string, bool> &source_hash) {
  //fill source_hash with query source_ids, returns with their access state
  
  //get ids from both _filter_source_ids and _filter_ids_array for checking
  if(!_filter_ids_array.empty()) {
    vector<string>::iterator  it;
    for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
      source_hash[(*it)] = false;
    }
  }
  if(!_filter_source_ids.empty()) {
    map<string, bool>::iterator  it2;
    for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
      source_hash[(*it2).first] = false;
    }
  }
  
  //get sources from scripted <datastream>
  if(!_processing_datastreams.empty()) {
    map<string, EEDB::TrackDef*>::iterator  it1;
    for(it1=_processing_datastreams.begin(); it1!=_processing_datastreams.end(); it1++) {
      EEDB::TrackDef*   track = (*it1).second;
      
      map<string, bool>::iterator it2;
      for(it2 = track->source_ids.begin(); it2 != track->source_ids.end(); it2++) {
        source_hash[(*it2).first] = false;
      }    
    }
  }
  
  if(source_hash.empty()) { return 0; }
  
  EEDB::SPStreams::FederatedSourceStream *fstream = secured_federated_source_stream();
  fstream->set_peer_search_depth(_peer_search_depth);
  fstream->allow_full_federation_search(false);
  fstream->clone_peers_on_build(false);
  
  long int                 access_count=0;
  map<string, EEDB::Peer*> uuid_peers;

  map<string, bool>::iterator  it1;
  for(it1 = source_hash.begin(); it1 != source_hash.end(); it1++) {
    (*it1).second = false;

    string srcid = (*it1).first;
    size_t p1 = srcid.find("::");
    if(p1 != string::npos) {
      string uuid = srcid.substr(0, p1);
      uuid_peers[uuid] = NULL;
      //fprintf(stderr, "security check [%s] peer[%s]\n", (*it1).first.c_str(), uuid.c_str());
    }
  }  
  if(uuid_peers.empty()) { return 0; }
  
  fstream->get_peers(uuid_peers);

  for(it1 = source_hash.begin(); it1 != source_hash.end(); it1++) {
    string srcid = (*it1).first;
    size_t p1 = srcid.find("::");
    if(p1 != string::npos) {
      string uuid = srcid.substr(0, p1);
      if(uuid_peers[uuid] != NULL) { 
        (*it1).second = true;
        access_count++; 
      } else {
        fprintf(stderr, "security failed [%s]\n", (*it1).first.c_str());
      }
    }
  }
  
  //pull out the remote peers
  _known_remote_peers.clear();
  map<string, EEDB::Peer*>::iterator  it3;
  for(it3 = uuid_peers.begin(); it3 != uuid_peers.end(); it3++) {
    string uuid = (*it3).first;
    EEDB::Peer* peer = (*it3).second;
    if(!peer) { continue; }
    if(peer->is_remote()) {
      EEDB::SPStreams::RemoteServerStream* rstream = (EEDB::SPStreams::RemoteServerStream*)peer->source_stream();
      rstream->set_userDB(_userDB);
      EEDB::Peer* rpeer = rstream->master_peer();
      if(rpeer && (_known_remote_peers.find(rpeer->uuid()) == _known_remote_peers.end())) {
        _known_remote_peers[rpeer->uuid()] = rpeer;
        //fprintf(stderr, "remote peer %s\n", rpeer->simple_xml().c_str());
      }
    }
  }    

  return access_count;
}


void EEDB::WebServices::RegionServer::show_securecheck() {  
  struct timeval        endtime, time_diff;
  double                runtime;
  map<string, bool>     source_hash;
    
  long int ok_count    = secure_access_check(source_hash);
  long int total_count = source_hash.size();

  printf("Content-type: text/xml\r\n\r\n");
  //printf header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<secure_check>\n");
  
  printf("<status total=\"%ld\" blocked=\"%ld\"  accessible=\"%ld\" />\n", total_count, (total_count - ok_count), ok_count);
  
  map<string, bool>::iterator  it1;
  for(it1 = source_hash.begin(); it1 != source_hash.end(); it1++) {
    if(!(*it1).second) { printf("<blocked id=\"%s\"/>\n", (*it1).first.c_str()); }
  }
  for(it1 = source_hash.begin(); it1 != source_hash.end(); it1++) {
    if((*it1).second) { printf("<accessible id=\"%s\"/>\n", (*it1).first.c_str()); }
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  runtime  = (double)time_diff.tv_sec/1000.0 + ((double)time_diff.tv_usec)/1000.0;
  
  printf("<process_summary processtime_msec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</secure_check>\n");
}


//----------------------------------------------------
//
// autobuild background system
//

bool  EEDB::WebServices::RegionServer::_build_trackcache_chroms() {
  if(_parameters.find("assembly_name") == _parameters.end()) { return false; }
  
  if(!track_cache()) { return false; }
  EEDB::ZDX::ZDXstream  *zdxstream = _track_cache->zdxstream();
  if(!zdxstream) { return false; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!zdxdb) { return false; }

  long numchroms =  EEDB::ZDX::ZDXsegment::num_chroms(zdxdb);
  if(numchroms > 0) { return true; }

  //
  // make sure all the chrom and segments are built
  //
  string asmb = _parameters["assembly_name"];
  boost::algorithm::to_lower(asmb);
  fprintf(stderr, "build trackcache chroms [%s] ... ", asmb.c_str());

  EEDB::Assembly *assembly = find_assembly(asmb);
  if(assembly) {
    vector<EEDB::Chrom*> chroms;
    assembly->all_chroms(chroms);
    for(unsigned int j=0; j<chroms.size(); j++) {
      EEDB::Chrom *chrom = chroms[j];
      if(chrom->chrom_length() < 1) { continue; }
      zdxstream->create_chrom(chrom);
    }
  }

  numchroms =  EEDB::ZDX::ZDXsegment::num_chroms(zdxdb);
  fprintf(stderr, " %ld chroms\n", numchroms);
  return true;  
}


void  EEDB::WebServices::RegionServer::show_trackcache_stats() {  
  string   assembly_name = _parameters["assembly_name"];
  string   chrom_name    = _parameters["chrom_name"];
  char     buffer[2048];
  
  _parameters["format"] = "xml";
  _output_header(NULL);

  if(track_cache() && _track_cache->zdxstream()) {
    _build_trackcache_chroms(); //make sure all are predefined
    
    ZDXdb* zdxdb = _track_cache->zdxstream()->zdxdb();

    _track_cache->xml(_output_buffer);
         
    long numsegs, numbuilt, numclaimed, seg_start;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, chrom_name, _region_start, _region_end,
                                       numsegs, numbuilt, numclaimed, seg_start);
    
    double seg_buildtime = _track_cache->segment_buildtime();
    long unbuilt= numsegs-numbuilt-numclaimed;

    double cpu_minutes = (seg_buildtime/60.0)*(numsegs-numbuilt);
    double buildtime = cpu_minutes;
    if(numclaimed >0) { buildtime /= numclaimed; }
    
    double comp = 0;
    if(numsegs>0) { comp = 100.0 * (double)numbuilt / (double)numsegs; }
    snprintf(buffer, 2040,"<build_stats percent=\"%f\"", comp);
    _output_buffer += buffer;
    
    snprintf(buffer, 2040," numsegs=\"%ld\" built=\"%ld\" claimed=\"%ld\" unbuilt=\"%ld\" seg_start=\"%ld\"", 
             numsegs, numbuilt, numclaimed, unbuilt, seg_start);
    _output_buffer += buffer;

    snprintf(buffer, 2040," cpu_minutes=\"%f\" build_min=\"%f\"", cpu_minutes, buildtime);
    _output_buffer += buffer;
    
    _output_buffer += " />\n";


    if(_user_profile) {
      vector<DBObject*> requests = EEDB::TrackRequest::fetch_by_user(_user_profile);
      for(unsigned i=0; i<requests.size(); i++) {
        EEDB::TrackRequest *req = (EEDB::TrackRequest*)requests[i];
        if(req->track_cache_id() != _track_cache->primary_id()) { continue; }
        if(req->assembly_name()!=assembly_name) { continue; }
        if(req->chrom_name()!=chrom_name) { continue; }
        if(req->chrom_start()!=_region_start) { continue; }
        if(req->chrom_end()!=_region_end) { continue; }
        req->xml(_output_buffer);
      }
    }
  }

  _output_footer();
}


void  EEDB::WebServices::RegionServer::request_trackcache_build() {  
  string   assembly_name = _parameters["assembly_name"];
  string   chrom_name    = _parameters["chrom_name"];
  char     buffer[2048];
  
  _parameters["format"] = "xml";
  _output_header(NULL);
  
  if(_user_profile) { _output_buffer += _user_profile->simple_xml(); } 

  if(track_cache() && _track_cache->zdxstream()) {
    ZDXdb* zdxdb = _track_cache->zdxstream()->zdxdb();
    
    _track_cache->xml(_output_buffer);
        
    long numsegs, numbuilt, numclaimed, unbuilt, seg_start;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, chrom_name, _region_start, _region_end,
                                       numsegs, numbuilt, numclaimed, seg_start);
    unbuilt = numsegs-numbuilt-numclaimed;
    if(unbuilt>0 && !_parameters["track_title"].empty()) {
      EEDB::TrackRequest* buildrequest = new EEDB::TrackRequest();
      buildrequest->assembly_name(assembly_name);
      if(_user_profile && (_parameters["anonymous"] != "true")) { buildrequest->user_id(_user_profile->primary_id()); }
      buildrequest->chrom_name(chrom_name); 
      buildrequest->chrom_start(_region_start);
      buildrequest->chrom_end(_region_end);
      buildrequest->num_segs(numsegs);
      buildrequest->unbuilt(numsegs-numbuilt-numclaimed);
      buildrequest->send_email("y");
      buildrequest->track_name(_parameters["track_title"]);
      buildrequest->view_uuid(_parameters["view_uuid"]);

      buildrequest->store(_track_cache);
    }
        
    double comp = 0;
    if(numsegs>0) { comp = 100.0 * (double)numbuilt / (double)numsegs; }
    snprintf(buffer, 2040,"<build_stats percent=\"%f\"", comp);
    _output_buffer += buffer;
    snprintf(buffer, 2040," numsegs=\"%ld\" built=\"%ld\" claimed=\"%ld\" unbuilt=\"%ld\"", 
             numsegs, numbuilt, numclaimed, numsegs-numbuilt-numclaimed);
    _output_buffer += buffer;
    _output_buffer += " />\n";
  }
  
  _output_footer();
}



bool EEDB::WebServices::RegionServer::_check_overload(double load_limit) {
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
  
  //string str5 = exec_result("ps aux | grep eedb_region.cgi | grep -v grep|wc -l");
  //long region_queries = strtol(str5.c_str(), NULL, 10);

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

