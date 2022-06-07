/* $Id: MetaSearch.cpp,v 1.100 2020/10/02 10:41:22 severin Exp $ */

/***

NAME - EEDB::SPStreams::MetaSearch

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
#include <sys/stat.h>
#include <sys/types.h>
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
#include <EEDB/WebServices/MetaSearch.h>
#include <EEDB/Tools/OSCFileParser.h>

#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 


using namespace std;
using namespace MQDB;

const char*               EEDB::WebServices::MetaSearch::class_name = "EEDB::WebServices::MetaSearch";

EEDB::WebServices::MetaSearch::MetaSearch() {
  init();
}

EEDB::WebServices::MetaSearch::~MetaSearch() {
}

void _eedb_web_metasearch_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::WebServices::MetaSearch*)obj;
}

void EEDB::WebServices::MetaSearch::init() {
  EEDB::WebServices::WebBase::init();
  _classname      = EEDB::WebServices::MetaSearch::class_name;
  _funcptr_delete = _eedb_web_metasearch_delete_func;
}

////////////////////////////////////////////////////////////////////////////////////////


void EEDB::WebServices::MetaSearch::display_info() {
  printf("%s\n", display_desc().c_str());
}

string EEDB::WebServices::MetaSearch::display_desc() {
  string xml = "MetaSearch[";
  xml += _classname;
  xml += "]";
  return xml;
}

string EEDB::WebServices::MetaSearch::display_contents() {
  return display_desc();
}

string EEDB::WebServices::MetaSearch::xml_start() {
  string xml = "<webservice>";
  return xml;
}

string EEDB::WebServices::MetaSearch::xml_end() {
  return "</webservice>";
}

string EEDB::WebServices::MetaSearch::simple_xml() {
  return xml_start() + xml_end();
}

string EEDB::WebServices::MetaSearch::xml() {
  string xml = xml_start();
  xml += xml_end();
  return xml;
}


////////////////////////////////////////////////////////////////////////////

bool EEDB::WebServices::MetaSearch::process_url_request() {
  if(EEDB::WebServices::WebBase::process_url_request()) { return true; }

  get_post_data();
  if(!_post_data.empty()) { process_xml_parameters(); }

  postprocess_parameters();

  return execute_request();
}


void  EEDB::WebServices::MetaSearch::postprocess_parameters() {
  //call superclass method
  EEDB::WebServices::WebBase::postprocess_parameters();
    
  if((_parameters.find("name")!=_parameters.end()) && (_parameters.find("mode")==_parameters.end())) { 
    _parameters["mode"] = "search"; 
  }
  if(_parameters.find("search")!=_parameters.end()) { 
    _parameters["mode"] = "search"; 
    _parameters["name"] = _parameters["search"]; 
  }
  if(_parameters.find("skip_no_location")!=_parameters.end()) { 
    if(_parameters["skip_no_location"] != "true") { _parameters["skip_no_location"].clear(); }
  }

  if(_parameters.find("sourcetype") != _parameters.end()) {
    string type = _parameters["sourcetype"];
    if(type != "FeatureSource" && type != "Experiment") { type = ""; }
    _parameters["sourcetype"] = type;
  }
  
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
        _filter_mdkeys[mdkey] = true;
        _desc_xml_tags[mdkey] = true;
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
  //setup _feature_id_hash for edge system
  if(_parameters.find("feature_ids")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["feature_ids"].size()+2);
    strcpy(buf, _parameters["feature_ids"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        string dbid = p1;
        string uuid, objClass;
        long int objID;
        MQDB::unparse_dbid(dbid, uuid, objID, objClass);
        if(objClass == "Feature") {
          _feature_id_hash[dbid] = NULL;
          _filter_peer_ids[uuid] = true;
        }
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }
  
}


bool  EEDB::WebServices::MetaSearch::execute_request() {
  //call superclass method
  if(EEDB::WebServices::WebBase::execute_request()) { return true; }

  if(_parameters["mode"] == string("search")) {
    search_feature();
  } else if(_parameters["mode"] == string("feature_sources")) {
    show_datasources();
  } else if(_parameters["mode"] == string("features")) {
    show_features();
  } else if(_parameters["mode"] == string("edge_sources")) {
    show_datasources();
  } else if(_parameters["mode"] == string("experiments")) {
    show_datasources();
  } else if(_parameters["mode"] == string("expression_datatypes")) {
    show_expression_datatypes();
  } else if(_parameters["mode"] == string("sources")) {
    show_datasources();
  } else if(_parameters["mode"] == string("edges")) {
    show_edges();
  } else if(_parameters["mode"] == string("mdstats")) {
    show_source_metadata_stats();
  } else if(_parameters["mode"] == string("mdranksum")) {
    show_ranksum_stats();
  } else {
    return false;
  }

  return true;
}



void EEDB::WebServices::MetaSearch::process_xml_parameters() {
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
  if((node = root_node->first_node("source_names")) != NULL) { _parameters["source_names"] = node->value(); }
  if((node = root_node->first_node("id")) != NULL) { _parameters["id"] = node->value(); }
  if((node = root_node->first_node("feature_ids")) != NULL) { _parameters["feature_ids"] = node->value(); }
  if((node = root_node->first_node("edge_search_depth")) != NULL) { _parameters["edge_search_depth"] = node->value(); }

  if((node = root_node->first_node("collab")) != NULL)        { _parameters["collab"] = node->value(); }
  if((node = root_node->first_node("collaboration")) != NULL) { _parameters["collaboration"] = node->value(); }
  
  if((node = root_node->first_node("format")) != NULL) { _parameters["format"] = node->value(); }
  if((node = root_node->first_node("format_mode")) != NULL) { _parameters["format_mode"] = node->value(); }
  if((node = root_node->first_node("mode")) != NULL) { _parameters["mode"] = node->value(); }
  if((node = root_node->first_node("submode")) != NULL) { _parameters["submode"] = node->value(); }
  if((node = root_node->first_node("mdkey")) != NULL) { _parameters["mdkey"] = node->value(); }
  if((node = root_node->first_node("mdkey_list")) != NULL) { _parameters["mdkey_list"] = node->value(); }
  if((node = root_node->first_node("md_show_ids")) != NULL) { _parameters["md_show_ids"] = node->value(); }
  if((node = root_node->first_node("sourcetype")) != NULL) { _parameters["sourcetype"] = node->value(); }

  if((node = root_node->first_node("expfilter")) != NULL) { _parameters["filter"] = node->value(); }
  if((node = root_node->first_node("filter")) != NULL) { _parameters["filter"] = node->value(); }
  if((node = root_node->first_node("limit")) != NULL) { _parameters["limit"] = node->value(); }
  if((node = root_node->first_node("name")) != NULL) { _parameters["name"] = node->value(); }
  if((node = root_node->first_node("skip_no_location")) != NULL) { _parameters["skip_no_location"] = node->value(); }

  if((node = root_node->first_node("assembly_name")) != NULL) { _parameters["assembly_name"] = node->value(); }
  if((node = root_node->first_node("chrom_name")) != NULL) { _parameters["chrom_name"] = node->value(); }

  if((node = root_node->first_node("authenticate")) != NULL) { hmac_authorize_user(); }

  if((node = root_node->first_node("include_matching")) != NULL) {
    _parameters["filter_include_matching"] = "true";
    rapidxml::xml_node<> *mdnode = node->first_node("mdkeys");
    if(mdnode) { _parameters["filter_include_matching_by_mdkeys"] = mdnode->value(); }
    rapidxml::xml_node<> *pfnode = node->first_node("post_filter");
    if(pfnode) { _parameters["filter_include_matching_post_filter"] = pfnode->value(); }
  }

  if((node = root_node->first_node("ranksum_input")) != NULL) {
    rapidxml::xml_node<> *fnode = node->first_node("feature");
    while(fnode) {
      EEDB::Feature *feature = EEDB::Feature::realloc();
      if(feature->init_from_xml(fnode)) { 
        rapidxml::xml_node<> *node3 = fnode->first_node("chrom");
        if(node3) { 
          EEDB::Chrom *chrom = new EEDB::Chrom(node3); 
          feature->chrom(chrom);
        }
        _ranksum_input.push_back(feature);
      }      
      fnode = fnode->next_sibling("feature");
    }  
  }

  free(xml_text);
}


void EEDB::WebServices::MetaSearch::show_api() {
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

  //parameters
  if(!_parameters.empty()) {
    printf("<h3>Parameters</h3>\n");
    map<string,string>::iterator it1;
    for(it1=_parameters.begin(); it1!=_parameters.end(); it1++) {
      if((*it1).first.empty() || (*it1).second.empty()) { continue; }
      printf("%s = [%s]<br>\n", (*it1).first.c_str(), (*it1).second.c_str());
    }
  }
  if(!_collaboration_filter.empty()) {
    printf("collaboration_filter : %s<br>\n", _collaboration_filter.c_str());
  }
  if(!_filter_peer_ids.empty()) {
    printf("<p><b>filter_peer_ids</b>\n");
    map<string, bool>::iterator  it2;
    for(it2 = _filter_peer_ids.begin(); it2 != _filter_peer_ids.end(); it2++) {
      printf("<br>%s\n", (*it2).first.c_str());
    }
  }
  if(!_filter_source_ids.empty()) {
    printf("<p><b>filter_source_ids</b>\n");
    map<string, bool>::iterator  it2;
    for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) {
      printf("<br>%s\n", (*it2).first.c_str());
    }
  }
  if(!_filter_source_names.empty()) {
    printf("<p><b>filter_source_names</b>\n");
    for(unsigned int i=0; i<_filter_source_names.size(); i++) {
      printf("<br>%s\n", _filter_source_names[i].c_str());
    }
  }
  if(!_filter_ids_array.empty()) {
    printf("<p><b>filter_ids_array</b>\n");
    vector<string>::iterator  it;
    for(it = _filter_ids_array.begin(); it != _filter_ids_array.end(); it++) {
      printf("<br>%s\n", (*it).c_str());
    }
  }

  printf("</body>\n");
  printf("</html>\n");
}


////////////////////////////////////////////////////////////////////////////

/*

#!/usr/bin/perl -w
BEGIN{
    unshift(@INC, "/eeDB/src/bioperl-1.5.2_102");
    unshift(@INC, "/eeDB/src/MappedQuery_0.958/lib");
    unshift(@INC, "/eeDB/src/ZENBU_1.305/lib");
}

use CGI qw(:standard);
use CGI::Carp qw(warningsToBrowser fatalsToBrowser);
use CGI::Fast qw(:standard);

use strict;
use Getopt::Long;
use Data::Dumper;
use Switch;
use Time::HiRes qw(time gettimeofday tv_interval);
use POSIX qw(ceil floor);
use File::Temp;
use XML::TreePP;

use EEDB::Database;
use EEDB::User;
use EEDB::Collaboration;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Expression;
use EEDB::Experiment;
use EEDB::EdgeSet;
use EEDB::FeatureSet;
use EEDB::SPStream::SourceStream;
use EEDB::SPStream::MultiSourceStream;
use EEDB::SPStream::FederatedSourceStream;


my $SESSION_NAME = "CGISESSID";
my $connection_count = 0;

my @seed_urls;
my @seed_peers;

my $userDB_url = undef;
my $userDB  = undef;

my $global_source_cache = {};
my $global_source_counts = {"Experiment"=>0, "FeatureSource"=>0, "ExpressionDatatype"=>0 };

my $start_date = localtime();
my $launch_time = time();

my $SERVER_NAME = undef;
my $WEB_URL     = undef;
parse_conf('eedb_server.conf');

init_db();

while (my $cgi = new CGI::Fast) {
  process_url_request($cgi);
  $connection_count++;
  disconnect_db();
}

##########################

sub process_url_request {
  my $cgi = shift;

  my $self = {};
  $self->{'starttime'} = time()*1000;
  $self->{'cgi'} = $cgi;

  get_webservice_url($self);

  get_session_user($self);

  $self->{'known_sources'} = {};
  $self->{'apply_source_filter'} = 0;
  $self->{'filter_ids'} = {};
  $self->{'peer_ids'} = {};
  $self->{'registry_mode'} = "full";

  $self->{'id'} = $cgi->param('id');
  $self->{'limit'} = $cgi->param('limit');
  $self->{'name'} = $cgi->param('name');
  $self->{'source'} = $cgi->param('source');
  $self->{'mode'} = $cgi->param('mode');
  $self->{'format'} = $cgi->param('format');
  $self->{'savefile'} = $cgi->param('save');
  $self->{'id_list'} = $cgi->param('ids');
  $self->{'name_list'} = $cgi->param('names');
  $self->{'assembly_name'} = $cgi->param('asm');
  $self->{'chrom_name'} = $cgi->param('chrom');
  $self->{'source_outmode'} = 'simple_feature';

  if(defined($cgi->param('reload')) and ($cgi->param('reload') eq "ce818eaf70485e496")) {
    $self->{'reload_sources'} = 1; 
  }

  if(defined($cgi->param('registry_mode'))) {
    my $regmode = $cgi->param('registry_mode');
    if(($regmode eq "full") or ($regmode eq "private") or ($regmode eq "shared") or ($regmode eq "public")) {
      $self->{'registry_mode'} = $regmode;
    }
  }

  $self->{'source_names'} = $cgi->param('source_names') if(defined($cgi->param('source_names')));
  $self->{'source_names'} = $cgi->param('types') if(defined($cgi->param('types'))); 
  $self->{'source_names'} = $cgi->param('sources') if(defined($cgi->param('sources'))); 

  $self->{'source_categories'} = $cgi->param('categories') if(defined($cgi->param('categories'))); 

  $self->{'srcfilter'} = $cgi->param('expfilter') if(defined($cgi->param('expfilter')));
  $self->{'srcfilter'} = $cgi->param('exp_filter') if(defined($cgi->param('exp_filter'))); 
  $self->{'srcfilter'} = $cgi->param('filter') if(defined($cgi->param('filter'))); 

  if(defined($cgi->param('peer'))) {
    $self->{'peer_ids'}->{$cgi->param('peer')}=1;
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }

  if(defined($cgi->param('peers'))) {
    my @ids = split(",", $cgi->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }

  if(defined($self->{'source_names'})) {
    $self->{'apply_source_filter'} = 1;
    $self->{'filter_sourcenames'}={};
    my @names = split /,/, $self->{'source_names'};
    foreach my $name (@names) {
      $self->{'filter_sourcenames'}->{$name}=1;
    }
  }
  if(defined($self->{'source_categories'})) {
    $self->{'apply_source_filter'} = 1;
    $self->{'source_category_hash'}={};
    my @names = split /,/, $self->{'source_categories'};
    foreach my $name (@names) {
      $self->{'source_category_hash'}->{$name}=1;
    }
  }

  if(defined($self->{'name'}) and !defined($self->{'source'})) {
    $self->{'source'} = 'primaryname';
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'feature'; }
  }
  if(defined($cgi->param('search'))) {
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'search'; }
    $self->{'name'} = $cgi->param('search');
  }
  if(defined($self->{'id_list'})) {
    $self->{'mode'} = 'features';
    $self->{'ids_array'} = [];
    my @ids = split /,/, $self->{'id_list'};
    foreach my $id (@ids) {
      if($id =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; push @{$self->{'ids_array'}}, $id; }
      elsif($id =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; push @{$self->{'ids_array'}}, $id; }
    }
  }

  $self->{'mode'} ='' unless(defined($self->{'mode'}));
  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'limit'}=1000 unless(defined($self->{'limit'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; }
    elsif($self->{'id'} =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; }
  }

  $self->{'source_ids'} = $cgi->param('source_ids') if(defined($cgi->param('source_ids')));
  if(defined($cgi->param('peers'))) {
    my @ids = split(",", $cgi->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
  }

  #########
  # pre-process some parameters
  #
  if($self->{'srcfilter'}) {
    $self->{'apply_source_filter'} = 1;
    if($self->{'format'} eq 'debug') {  printf("apply filter :: [%s]\n", $self->{'srcfilter'}); }
  }

  if($self->{'source_ids'}) {
    $self->{'apply_source_filter'} = 1;
    my @ids = split /,/, $self->{'source_ids'};
    foreach my $id (@ids) {
      $id =~ s/\s//g;
      next unless($id);
      $self->{'filter_ids'}->{$id} = 1;
      if($id =~ /(.+)::(.+):::/) {
        my $peer = $1;
        $self->{'peer_ids'}->{$peer} = 1;
      }
    }
  }


  ##### 
  # now process
  #
  if(defined($self->{'reload_sources'})) {
    show_peers($self);
    return;
  }

  if(defined($self->{'name'}) and ($self->{'mode'} eq 'search')) {
    search_feature($self);
    return;
  }

  if($self->{'mode'} eq 'status') {
    show_status($self);
  } elsif($self->{'mode'} eq 'feature_sources') {
    show_feature_sources($self);
  } elsif($self->{'mode'} eq 'features') {
    show_feature_list($self);
  } elsif($self->{'mode'} eq 'edge_sources') {
    show_edge_sources($self);
  } elsif($self->{'mode'} eq 'experiments') {
    show_experiments($self);
  } elsif($self->{'mode'} eq 'peers') {
    show_peers($self);
  } elsif($self->{'mode'} eq "collaborations") {
    show_collaborations($self);
  } elsif($self->{'mode'} eq 'expression_datatypes') {
    show_expression_datatypes($self);
  } elsif($self->{'mode'} eq 'sources') {
    show_datasources($self);
  } elsif($self->{'mode'} eq 'chrom') {
    show_chromosomes($self);
  } elsif(defined($self->{'id'})) {
    #elsif($self->{'mode'} eq 'express') { export_feature_expression($self); }
    get_singlenode($self);
  } else {
    show_fcgi($self);
    #printf("ERROR : URL improperly formed\n");
  }

  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->disconnect;
  }
}


sub show_fcgi {
  my $self = shift;
  my $cgi = $self->{'cgi'};

  my $id = $cgi->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/html", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/html", -charset=> "UTF8");
  }
  print start_html("ZENBU Fast CGI object server");
  print h1("Fast CGI object server (perl)");
  print p("eedb_search.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>hostname : %s\n",$hostname);
  printf("<br>server_root : %s\n",$SERVER_NAME);
  printf("<br>web_url : %s\n",$WEB_URL);
  if($userDB) { printf("<br>user_db : %s\n",$userDB->url); }
  if($self->{'user_profile'}) {
    printf("<br>profile email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>profile openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<br>processtime_sec : %1.3f\n", $total_time/1000.0);
  print hr;

  #if(defined($id)) { printf("<h2>id = %d</h2>\n", $id); }
  print("<table border=1 cellpadding=10><tr>");
  printf("<td>%d knowns peers</td>", scalar(@{EEDB::Peer->global_cached_peers}));
  printf("<td>%d cached sources</td>", scalar(keys(%{$global_source_cache})));
  print("</tr></table>");
  
  show_api($cgi);
  print end_html;
}

sub show_api {
  my $cgi = shift;
  
  print hr;
  print h2("Object access methods");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>id=[federatedID]</td><td>directly access any object in federation. fedID format is [peer_uuid]::[id]:::[class]</td></tr>\n");
  print("<tr><td>name=[string]</td><td>does search on feature's primary name, returns first occurance. \n");
  print("since primary name is not required to be unique in database, this method is only useful for debugging and is not guaranteed\n");
  print("to be rebust or reproducible for data modes.</td></tr>\n");
  print("<tr><td>search=[name]</td><td>does a metadata search for all matching features and returns compact list in XML</td></tr>\n");
  print("<tr><td>sources=[source_name,source_name,...]</td><td>used in combination with name=, and search= methods to restrict search. Both single or multiple type lists are available.</td></tr>\n");
  print("<tr><td>peers=[peer_uuid, peer_alias,...]</td><td>used to restrict query to a specific set of peers. Can be used in combination with all modes.</td></tr>\n");
  print("<tr><td>source_ids=[fedID, fedID,...]</td><td>used to restrict query to a specific set of sources. Can be used in combination with all modes.</td></tr>\n");
  print("</table>\n");

  print h2("Output formats");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>format=[xml,gff2,gff3,bed,tsv]</td><td>changes the output format of the result. XML is an EEDB/ZENBU defined XML format, while
GFF2, GFF3, and BED are common formats.  XML is supported in all access modes, but GFF2, GFF3, and BED are only available in direct feauture access modes. TSV (tab-separated-values) is only available in a few modes. Default format is XML.</td></tr>\n");
  print("</table>\n");

  print h2("Output modes");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>mode=feature_sources</td><td>returns XML of all available Feature sources. types= filter is available</td></tr>\n");
  print("<tr><td>mode=edge_sources</td><td>returns XML of all available Edge sources. types= filter is available</td></tr>\n");
  print("<tr><td>mode=experiments</td><td>returns XML of all available Experiments. types= filter is available</td></tr>\n");
  print("<tr><td>mode=expression_datatypes</td><td>returns XML of all available Expression datatypes</td></tr>\n");
  print("<tr><td>mode=peers</td><td>returns XML of all connected peers in the peer-peer database federation</td></tr>\n");
  print("</table>\n");

}
*/

////////////////////////////////////////////////////////////////////////////


void EEDB::WebServices::MetaSearch::search_feature() {  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<results>\n");

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  string filter = _parameters["name"];
  int limit  = strtol(_parameters["limit"].c_str(), NULL, 10);
  if(!filter.empty()) { printf("<query value=\"%s\" />\n", filter.c_str()); }

  EEDB::SPStream  *stream = source_stream();

  int total_features = 0;
  int result_count = 0;
  int filter_count = 0;

  printf("<sources>\n");
  stream->stream_data_sources("FeatureSource");
  while(EEDB::FeatureSource *source = (EEDB::FeatureSource*)stream->next_in_stream()) {
    if(source->classname() != EEDB::FeatureSource::class_name) { continue; }
    total_features += source->feature_count();
    print_object_xml(source);
  }
  stream->stream_peers();
  while(MQDB::DBObject* obj = stream->next_in_stream()) {
    printf("%s\n", obj->xml().c_str());
  }
  printf("</sources>\n");
  if(total_features < 0) { total_features=0; }

  stream->stream_features_by_metadata_search(filter);
  while(EEDB::Feature *obj = (EEDB::Feature*)stream->next_in_stream()) {
    if((_parameters["skip_no_location"] == "true") and obj->chrom_start()== -1) { continue; }
    result_count++;
    if((limit <=0) or (result_count <= limit)) {
      filter_count++;
      if(_parameters["format_mode"]  == "fullxml") {
        printf("%s",obj->xml().c_str());
      } else if(_parameters["format_mode"]  == "simplexml") {
        printf("%s",obj->simple_xml().c_str());
      } else {
        printf("<match desc=\"%s\"  feature_id=\"%s\" type=\"%s\" fsrc=\"%s\" />\n", 
               html_escape(obj->primary_name()).c_str(), 
               obj->db_id().c_str(), 
               obj->feature_source()->category().c_str(),
               obj->feature_source()->name().c_str());
      }
    }
  }
  
  printf("<result_count match_count=\"%d\" total=\"%d\" filtered=\"%d\" />\n", 
          result_count, total_features, filter_count);

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</results>\n");    
}



void EEDB::WebServices::MetaSearch::show_datasources() {  
  printf("Content-type: text/xml; charset=UTF-8\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<sources>\n");

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  EEDB::SPStreams::FederatedSourceStream  *stream = source_stream();

  if(_parameters["submode"] == "dependent") { 
    map<string, bool> dep_ids;
    stream->get_dependent_datasource_ids(dep_ids);
    fprintf(stderr, "returned %ld dependent_source_ids\n", dep_ids.size());
    map<string, bool>::iterator it1;
    for(it1=dep_ids.begin(); it1!=dep_ids.end(); it1++) {
      stream->add_source_id_filter((*it1).first);
    }
  }

  string source_mode ="";
  if(_parameters["mode"] == string("feature_sources")) { source_mode = "FeatureSource"; }
  if(_parameters["mode"] == string("experiments")) { source_mode = "Experiment"; }
  if(_parameters["mode"] == string("edge_sources")) { source_mode = "EdgeSource"; }

  if(_parameters.find("filter") != _parameters.end()) {
    printf("<filter>%s</filter>\n",html_escape(_parameters["filter"]).c_str());
    //stream->stream_data_sources(source_mode, _parameters["filter"]);
    stream->stream_data_sources(source_mode);  //new code will perform filtering here
  } else {
    stream->stream_data_sources(source_mode);
  }
  
  map<string, bool>             matching_mdtags;
  map<string, EEDB::Metadata*>  matching_mdata;
  if(_parameters.find("filter_include_matching_by_mdkeys")!=_parameters.end()) {
    char* buf = (char*)malloc(_parameters["filter_include_matching_by_mdkeys"].size()+2);
    strcpy(buf, _parameters["filter_include_matching_by_mdkeys"].c_str());
    char *p1 = strtok(buf, ", \t");
    while(p1!=NULL) {
      if(strlen(p1) > 0) {
        string mdkey = p1;
        matching_mdtags[mdkey] = true;
      }
      p1 = strtok(NULL, ", \t");
    }
    free(buf);
  }

  vector<EEDB::DataSource*>   t_sources;
  vector<EEDB::DataSource*>   all_sources;
  map<string, EEDB::Peer*>    t_peers;

  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source
    
    if((source->classname() != EEDB::FeatureSource::class_name) &&
       (source->classname() != EEDB::Experiment::class_name) &&
       (source->classname() != EEDB::EdgeSource::class_name) &&
       (source->classname() != EEDB::Assembly::class_name)) { continue; }

    all_sources.push_back(source);

    if(source->classname() == EEDB::FeatureSource::class_name) {
      _global_source_counts["FeatureSource"][source->db_id()] = true;
    }
    if(source->classname() == EEDB::Experiment::class_name) {
      _global_source_counts["Experiment"][source->db_id()] = true;
    }
    if(source->classname() == EEDB::EdgeSource::class_name) {
      _global_source_counts["EdgeSource"][source->db_id()] = true;
    }
    if(source->classname() == EEDB::Assembly::class_name) {
      _global_source_counts["Assembly"][source->db_id()] = true;
    }

    //perform primary filter
    if(_parameters.find("filter") != _parameters.end()) {
      EEDB::MetadataSet  *mdset = source->metadataset();
      if((mdset != NULL) and (!(mdset->check_by_filter_logic(_parameters["filter"])))) { continue; }
    }
    
    //collect the set of Mdata for secondary match-search
    if(!matching_mdtags.empty()) {
      vector<EEDB::Metadata*> t_md = source->metadataset()->all_metadata_with_tags(matching_mdtags);
      for(unsigned k=0; k<t_md.size(); k++) {
        string keyval = t_md[k]->type() + t_md[k]->data();
        matching_mdata[keyval] = t_md[k];
      }
    }
      
    t_sources.push_back(source);
    
    if(source->peer_uuid()) {
      string uuid = source->peer_uuid();
      EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
      if(peer) { t_peers[uuid] = peer; }    
    }
  }
  
  if(!matching_mdata.empty()) {
    //found matching metadata to perform secondary search of matching/control datasources
    fprintf(stderr, "perform secondary match/control group search with metadata\n");
    map<string, EEDB::Metadata*>::iterator it_md;
    for(it_md = matching_mdata.begin(); it_md !=matching_mdata.end(); it_md++) {
      fprintf(stderr, "  match with %s\n", (*it_md).second->simple_xml().c_str());
    }
    for(unsigned k=0; k<all_sources.size(); k++) {
      EEDB::DataSource *source = all_sources[k];
      EEDB::MetadataSet  *mdset = source->metadataset();
      if(!mdset) { continue; }

      if(_parameters.find("filter_include_matching_post_filter")!=_parameters.end()) {
        if(!mdset->check_by_filter_logic(_parameters["filter_include_matching_post_filter"])) { continue; }
      }
      
      bool include_match = false;
      for(it_md = matching_mdata.begin(); it_md !=matching_mdata.end(); it_md++) {
        if(mdset->has_metadata_like((*it_md).second->type(), (*it_md).second->data())) {
          include_match = true;
          break;
        }
      }
      if(include_match) {
        t_sources.push_back(source);
        
        if(source->peer_uuid()) {
          string uuid = source->peer_uuid();
          EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
          if(peer) { t_peers[uuid] = peer; }
        }
      }
    }
  }

  long int total_count = 0;
  total_count += _global_source_counts["Experiment"].size();
  total_count += _global_source_counts["FeatureSource"].size();
  total_count += _global_source_counts["EdgeSource"].size();
  total_count += _global_source_counts["Assembly"].size();

  printf("<result_count method=\"sources\" total=\"%ld\" filtered=\"%ld\" peers=\"%ld\"/>\n", 
      total_count, t_sources.size(), t_peers.size());

  for(unsigned int i=0; i< t_sources.size(); i++) {
    EEDB::DataSource *source = t_sources[i];
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }

    string xml_buffer;    
    if(_parameters["format_mode"]  == "fullxml") {
      source->xml(xml_buffer);
    } else if(_parameters["format_mode"]  == "minxml") {
      //printf("<object id=\"%s\"/>\n", source->db_id().c_str());    
      if(source->classname() == EEDB::Experiment::class_name) {
        EEDB::Experiment *exp = (EEDB::Experiment*)source;
        printf("<experiment id=\"%s\" platform=\"%s\" name=\"%s\" create_timestamp=\"%ld\"/>\n", exp->db_id().c_str(), exp->platform().c_str(), html_escape(source->display_name()).c_str(), source->create_date());
      }
      if(source->classname() == EEDB::FeatureSource::class_name) {
        printf("<featuresource id=\"%s\" name=\"%s\" create_timestamp=\"%ld\"/>\n", source->db_id().c_str(), html_escape(source->display_name()).c_str(), source->create_date());
      }
      if(source->classname() == EEDB::EdgeSource::class_name) {
        printf("<edgesource id=\"%s\" name=\"%s\" create_timestamp=\"%ld\"/>\n", source->db_id().c_str(), html_escape(source->display_name()).c_str(), source->create_date());
      }
      if(source->classname() == EEDB::Assembly::class_name) {
        ((EEDB::Assembly*)source)->simple_xml(xml_buffer);
      }
    } else if(_parameters["format_mode"]  == "descxml") {
      source->mdata_xml(xml_buffer, _desc_xml_tags);
      /*
      if(source->classname() == EEDB::FeatureSource::class_name) {
        ((EEDB::FeatureSource*)source)->desc_xml(xml_buffer);
      }      
      if(source->classname() == EEDB::Experiment::class_name) {
        ((EEDB::Experiment*)source)->desc_xml(xml_buffer);
      }
      if(source->classname() == EEDB::Assembly::class_name) {
        ((EEDB::Assembly*)source)->xml(xml_buffer);
      }
       */
    } else {
      source->simple_xml(xml_buffer);
    }
    if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); }
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


bool _feature_source_sort_func (EEDB::FeatureSource *a, EEDB::FeatureSource *b) { 
  // < function
  if(a == NULL) { return false; }  //real < NULL 
  if(b == NULL) { return true; }  //a not NULL, but b is NULL

  if(!(a->category().empty()) and b->category().empty()) { return true; }
  if(a->category().empty() and !(b->category().empty())) { return false; }

  if(a->category() < b->category()) { return true; }
  if(a->category() > b->category()) { return false; }

  if(a->name() < b->name()) { return true; }
  return false;
}


void EEDB::WebServices::MetaSearch::show_expression_datatypes() {  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<expression_datatypes>\n");

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 

  map<string, EEDB::Datatype*>  all_datatypes;

  EEDB::SPStream  *stream = source_stream();

  stream->stream_data_sources();
  while(MQDB::DBObject *source = stream->next_in_stream()) {

    map<string, EEDB::Datatype*> datatypes;
    if(source->classname() == EEDB::Experiment::class_name) {
      datatypes = ((EEDB::Experiment*)source)->expression_datatypes();
    }
    if(source->classname() == EEDB::FeatureSource::class_name) {
      datatypes = ((EEDB::FeatureSource*)source)->expression_datatypes();
    }

    map<string, EEDB::Datatype*>::iterator it;
    for(it=datatypes.begin(); it!=datatypes.end(); it++) {
      all_datatypes[(*it).first] = (*it).second;
    }
  }

  map<string, EEDB::Datatype*>::iterator  it2;
  for(it2=all_datatypes.begin(); it2!=all_datatypes.end(); it2++) {
    printf("%s", (*it2).second->xml().c_str());
  }

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</expression_datatypes>\n");  
}


void  EEDB::WebServices::MetaSearch::show_source_metadata_stats() {  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<source_metadata>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  
  EEDB::SPStream  *stream = source_stream();
  
  string filter;
  string sourcetype = _parameters["sourcetype"];  
  if(_parameters.find("filter") != _parameters.end()) {
    filter = _parameters["filter"];
    printf("<filter>%s</filter>\n",html_escape(_parameters["filter"]).c_str());
    stream->stream_data_sources(sourcetype, _parameters["filter"]);
  } else {
    stream->stream_data_sources(sourcetype);
  }
    
  map<string, map<string, bool> >  mdata_keys;                 // [key][source_id] = bool
  map<string, map<string, map<string, bool> > >  mdata_values; // [key][value][source_id] = bool
  
  bool  show_values = false;
  if(_parameters["submode"] == "values") { show_values=true; }

  bool matching_values = false;
  vector<string> filter_tokens;
  if(_parameters["submode"] == "matching_values") { 
    show_values=true; 
    matching_values = true;
    if(!filter.empty()) {
      char* filter_str = (char*)malloc(filter.length()+1);
      strcpy(filter_str, filter.c_str());
      //fprintf(stderr, "split filter [%s]\n", filter_str);
      char* tok = strtok(filter_str, " \t()!");
      while(tok) {
        if(string("and") == tok) { tok = strtok(NULL, " \t()!"); continue; }
        if(string("or") == tok)  { tok = strtok(NULL, " \t()!"); continue; }
        fprintf(stderr, "filter tok [%s]\n", tok);
        filter_tokens.push_back(tok);
        
        tok = strtok(NULL, " \t()!");
      }
      free(filter_str);
    }
  }

  bool md_show_ids = false;
  if(_parameters.find("md_show_ids") != _parameters.end()) {
    if(_parameters["md_show_ids"] == "true") { md_show_ids=true; }
  }

  string  mdkey;
  if(_parameters.find("mdkey") != _parameters.end()) { 
    mdkey = _parameters["mdkey"];
    show_values=true;
  }

  if(filter.empty()) { matching_values = false; }

  //if(filter.empty() && mdkey.empty()) {
  //  show_values=false;
  //  matching_values = false;
  //}

  long sources_count=0;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    source->metadataset()->remove_duplicates();
    sources_count++;

    vector<EEDB::Metadata*> mdlist = source->metadataset()->metadata_list();
    for(unsigned int i=0; i<mdlist.size(); i++) {
      EEDB::Metadata *md = mdlist[i];
      string key = md->type();
      if(!mdkey.empty() && (key!=mdkey)) { continue; }
      
      string value = md->data();
      boost::algorithm::to_lower(value);
    
      if(matching_values && !filter.empty()) {
        bool ok = false;
        for(unsigned j=0; j<filter_tokens.size(); j++) {
          string fval = filter_tokens[j];

          size_t p1 = fval.find(":=");
          if(p1!=string::npos) { 
            string k1 = fval.substr(0, p1);
            string v1 = fval.substr(p1+2);
            if(key != k1) { continue; }
            fval = v1;
          }
          boost::algorithm::to_lower(fval);
          
          if(value.find(fval)!=string::npos) { ok=true; break; } 
        }
        if(!ok) { continue; }
      }

      mdata_keys[key][source->db_id()] = true;
      mdata_values[key][md->data()][source->db_id()] = true;

    }    
  }
  printf("<result_count filtered=\"%ld\" />\n", sources_count);
  
  map<string, map<string, bool> >::iterator  it1;
  map<string, map<string, bool> >::iterator  it2;
  map<string, bool>::iterator                it3;

  for(it1 = mdata_keys.begin(); it1 != mdata_keys.end(); it1++) {
    string key       = (*it1).first.c_str();
    if(key=="keyword") { continue; }

    long src_count   = (*it1).second.size();
    long value_count = mdata_values[key].size();
    
    printf("<mdkey key=\"%s\" source_count=\"%ld\" value_count=\"%ld\">\n", key.c_str(), src_count, value_count);
    if(show_values && (key!="keyword")) {
      for(it2 = mdata_values[key].begin(); it2 != mdata_values[key].end(); it2++) {
        long src_count2 = (*it2).second.size();
        printf("<mdvalue source_count=\"%ld\" value=\"%s\">", src_count2, html_escape((*it2).first).c_str());
        if(md_show_ids) {
          for(it3 = (*it2).second.begin(); it3 != (*it2).second.end(); it3++) {
            printf("<datasource id=\"%s\"/>", (*it3).first.c_str());
          }
        }
        printf("</mdvalue>\n");
      }
    }
    printf("</mdkey>\n");
  }  
  
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</source_metadata>\n");    
}

//=================================================================
//
// ranksum enrichment analysis for the ExpressionPanel
//
//=================================================================

bool _expression_rank_sort_func (EEDB::Expression *a, EEDB::Expression *b) { 
  // < function
  if(a == NULL) { return false; }  //real < NULL 
  if(b == NULL) { return true; }  //a not NULL, but b is NULL
    
  if(a->value() < b->value()) { return true; }
  if(a->value() > b->value()) { return false; }
  
  return false;
}


void  EEDB::WebServices::MetaSearch::show_ranksum_stats() {  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<ranksum_stats>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); } 
  
  EEDB::SPStream  *stream = source_stream();
  
  string filter;
  string sourcetype = _parameters["sourcetype"];  
  if(_parameters.find("filter") != _parameters.end()) {
    filter = _parameters["filter"];
    printf("<filter>%s</filter>\n",html_escape(_parameters["filter"]).c_str());
    stream->stream_data_sources(sourcetype, _parameters["filter"]);
  } else {
    stream->stream_data_sources(sourcetype);
  }
  
  bool md_show_ids = false;
  if(_parameters.find("md_show_ids") != _parameters.end()) {
    if(_parameters["md_show_ids"] == "true") { md_show_ids=true; }
  }
  
  
  map<string, EEDB::Metadata*>    keyval_mdata;       // [key::value] = mdata
  map<string, double>             keyval_enrichment;  // [key::value] = double pvalue stat
  map<string, map<string, bool> > keyval_experiment;  // [key::value][expid] = mdata present in experiment
  
  long sources_count=0;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    source->metadataset()->remove_duplicates();
    sources_count++;
    vector<EEDB::Metadata*> mdlist = source->metadataset()->metadata_list();
    for(unsigned int i=0; i<mdlist.size(); i++) {
      EEDB::Metadata *md = mdlist[i];
      string key = md->type();
      if(key=="keyword") { continue; }
      if(!_filter_mdkeys.empty() && (_filter_mdkeys.find(key)==_filter_mdkeys.end())) { continue; }
      
      string value = md->data();      
      //boost::algorithm::to_lower(value);
      
      string keyval = key+"::"+value;            
      keyval_mdata[keyval] = md;
      keyval_enrichment[keyval] = 0;
      keyval_experiment[keyval][source->db_id()] = true;
      
      EEDB::DataSource::add_to_sources_cache(source);
    }    
  }
  printf("<input_data experiments=\"%ld\" mdkeyvals=\"%ld\" />\n", sources_count, keyval_mdata.size());
  
  vector<EEDB::Feature*>::iterator           it1;
  for(it1 = _ranksum_input.begin(); it1 != _ranksum_input.end(); it1++) {
    EEDB::Feature* feature = (*it1);
    
    printf("<feature start=\"%ld\" end=\"%ld\" strand=\"%c\">\n", 
           feature->chrom_start(), feature->chrom_end(), feature->strand());
    printf("%s\n", feature->chrom()->xml().c_str());
    
    //calculate the expression rank first and reuse
    vector<EEDB::Expression*>  exp_array = feature->expression_array();
    std::sort(exp_array.begin(), exp_array.end(), _expression_rank_sort_func);
    unsigned pos=0;
    while(pos<exp_array.size()) {
      exp_array[pos]->sig_error(pos+1);
      
      unsigned pos2 = pos;
      double sumrank=pos+1;
      while((pos2+1<exp_array.size()) && 
            (exp_array[pos]->value() == exp_array[pos2+1]->value())) {
        sumrank += (pos2+1)+1;
        pos2++;
      }
      if(pos != pos2) {  //duplicates
        sumrank = sumrank / (pos2-pos+1);
        for(unsigned i=pos; i<=pos2; i++) {
          exp_array[i]->sig_error(sumrank);
        }
        pos = pos2;
      }
      pos++;
    }
    //rank stored in the ->sig_error()
    
    //create unique experiment-groups based on id-list
    //loop on each metadata and generate a unique id-list to hash into a group
    class MDGroup {
      public:
      string                src_id_key;
      map<string,bool>      exp_id_hash;
      list<EEDB::Metadata*> mdata_list;
    };
    //map<string, mdgroup_t*>  mdgroup_hash;
    //map<string, MDGroup*>  mdgroup_hash;
    map<string, void*>  mdgroup_hash;
    map<string, EEDB::Metadata*>::iterator  md_it1;
    fprintf(stderr, "ranksum %ld keyval_metadata\n", keyval_mdata.size());
    for(md_it1 = keyval_mdata.begin(); md_it1 != keyval_mdata.end(); md_it1++) {
      EEDB::Metadata *mdata  = (*md_it1).second;
      string          keyval = (*md_it1).first;

      map<string, map<string, bool> >::iterator it7;
      it7 = keyval_experiment.find(keyval);

      list<string> src_ids;
      for(unsigned pos=0; pos<exp_array.size(); pos++) {
        EEDB::Expression *expr = exp_array[pos];
        if((*it7).second[expr->experiment_dbid()]) {
          src_ids.push_back(expr->experiment_dbid());
        }
      }
      src_ids.sort();
      
      //make unique src_id_key
      string src_id_key;
      list<string>::iterator s_it;
      for(s_it=src_ids.begin(); s_it!=src_ids.end(); s_it++) {
        src_id_key += (*s_it);
      }
      //create mdgroup if missing or add new metadata if exists
      if(mdgroup_hash.find(src_id_key) == mdgroup_hash.end()) {
        //first time
        MDGroup *mdgroup = new MDGroup();
        mdgroup->src_id_key = src_id_key;
        mdgroup->exp_id_hash = (*it7).second;
        mdgroup->mdata_list.push_back(mdata);
        mdgroup_hash[src_id_key] = mdgroup;
      } else {
        //append
        MDGroup *mdgroup = (MDGroup*)mdgroup_hash[src_id_key];
        mdgroup->mdata_list.push_back(mdata);
      }  
    }
    fprintf(stderr, "ranksum %ld src_id_keys\n", mdgroup_hash.size());
    
    //loop on each mdgroup, foreach mdgroup check all expression/experiments to match
    //calc rank-sum statistic for each metadata
    //map<string, EEDB::Metadata*>::iterator  md_it1;
    long mdcount=0;
    map<string, void*>::iterator mdg_it;
    //for(md_it1 = keyval_mdata.begin(); md_it1 != keyval_mdata.end(); md_it1++) {
    for(mdg_it = mdgroup_hash.begin(); mdg_it != mdgroup_hash.end(); mdg_it++) {
      MDGroup *mdgroup = (MDGroup*)((*mdg_it).second);
      EEDB::Metadata *mdata  = mdgroup->mdata_list.front();
      
      //EEDB::Metadata *mdata  = (*md_it1).second;
      //string          keyval = (*md_it1).first;

      //map<string, map<string, bool> >::iterator it7;
      //it7 = keyval_experiment.find(keyval);

      long group_count = 0;
      long other_count = 0;
      //calculate the ranksums
      double group_sum=0.0, other_sum=0.0, totalRank=0.0;
      double group_mean=0.0, other_mean=0.0;
      string source_ids;
      for(unsigned pos=0; pos<exp_array.size(); pos++) {
        EEDB::Expression *expr = exp_array[pos];

        //if((*it7).second[expr->experiment_dbid()]) {
        if(mdgroup->exp_id_hash[expr->experiment_dbid()]) {
          group_sum += expr->sig_error();
          group_count++;
          //group_mean += log(expr->value());
          group_mean += expr->value();
          source_ids += "<datasource id=\"" + expr->experiment_dbid() + "\"/>";
        } else {
          other_sum += expr->sig_error();
          other_count++;
          //other_mean += log(expr->value());
          other_mean += expr->value();
        }
        totalRank += expr->sig_error();
      }
      if(group_count < 2) { continue; } //need at least 2 experiments
      if(other_count < 2) { continue; } //need at least 2 experiments in out-group      
      
      group_mean /= group_count;
      other_mean /= other_count;
      
      //TODO: need to do the table lookup for when sample sizes are small
      
      //calc the wilcoxon-mann-whitney u-test
      //redo from https://epilab.ich.ucl.ac.uk/coursematerial/statistics/non_parametric/wilcox_mann_whitney.html
      
      double n1 = group_count;
      double n2 = other_count;
      
      double u1 = group_sum - ((n1 * (n1+1)) / 2.0);
      //double u2 = other_sum - ((n2 * (n2+1)) / 2.0);
     
      //double Uobt= 0.0;
      //if(u1<u2) { Uobt = u1; } else { Uobt = u2; }
      double Uobt= u1;  //if I want to preserve the directionality, just use U1
      
      double oa = sqrt(n1*n2*(n1+n2+1)/12);

      double zscore = (Uobt -  (n1 * n2 / 2)) / oa;

      /*
      if(group_count < other_count) {
        na = group_count;
        wa = group_sum;
        nb = other_count;
      } else {
        na = other_count;
        wa = other_sum;
        nb = group_count;
      }
      
      double ua = na * (na + nb + 1) / 2;
      double oa = sqrt(na*nb*(na+nb+1)/12);
      
      double zscore = (wa-ua) / oa;
      */
      
      //TODO need to do table lookup for when either n1 or n2 is less than 20
      
      //TODO: need to do zscore to pvalue calc/lookup
      double pvalue = zscore;

      if((zscore>1.2) || (zscore < -1.2)) {
        mdcount++; 
        //printf("<mdvalue type=\"%s\" value=\"%s\" other_count=\"%ld\" group_count=\"%ld\" other_ranksum=\"%f\" group_ranksum=\"%f\" zscore=\"%f\" pvalue=\"%f\" >", 
        printf("<mdgroup type=\"%s\" value=\"%s\" other_count=\"%ld\" group_count=\"%ld\" other_ranksum=\"%f\" group_ranksum=\"%f\" zscore=\"%f\" pvalue=\"%f\" >", 
               html_escape(mdata->type()).c_str(), 
               html_escape(mdata->data()).c_str(), 
               other_count, group_count, other_sum, group_sum, zscore, pvalue);
        if(md_show_ids) { printf("%s", source_ids.c_str()); }

        list<EEDB::Metadata*>::iterator s_it;
        for(s_it=mdgroup->mdata_list.begin(); s_it!=mdgroup->mdata_list.end(); s_it++) {
          printf("%s", (*s_it)->xml().c_str());
        }
        printf("</mdgroup>\n");                                      
        //printf("</mdvalue>\n");                                      
      }
      //double pvalue = group_sum / totalRank;
      //if(pvalue > 0.1) { continue; }
      
      
      /*
       EEDB::MetadataSet *mdset = experiment->metadataset();
       if(mdset->find_metadata(mdata->type(), mdata->data())) {
       keyval_enrichment[keyval]++;
       }
       */
    }
    printf("<note>%ld mdata larger ranksum</note>\n", mdcount);
    
    //TODO: show significant/sorted/best enriched metadata as result
    //too many to return everything
    
    //show result
    /*
    for(unsigned pos=0; pos<exp_array.size(); pos++) {
      EEDB::Expression *expr = exp_array[pos];
      EEDB::Experiment *experiment = expr->experiment();
      if(!experiment) {
        printf("<problem id=\"%s\"/>\n", expr->experiment_dbid().c_str());
      } else {
        printf("<expression value=\"%1.7f\" rank=\"%f\" expid=\"%s\" />", 
               expr->value(), expr->sig_error(), expr->experiment()->db_id().c_str());
      }
    }
    */
    
    printf("</feature>\n");
  }

  /*
  
  for(it1 = mdata_keys.begin(); it1 != mdata_keys.end(); it1++) {
    string key       = (*it1).first.c_str();
    if(key=="keyword") { continue; }
    
    long src_count   = (*it1).second.size();
    long value_count = mdata_values[key].size();
    
    printf("<mdkey key=\"%s\" source_count=\"%ld\" value_count=\"%ld\">\n", key.c_str(), src_count, value_count);
    for(it2 = mdata_values[key].begin(); it2 != mdata_values[key].end(); it2++) {
      long src_count2 = (*it2).second.size();
      string source_ids;
      for(it3 = (*it2).second.begin(); it3 != (*it2).second.end(); it3++) {
        if(!source_ids.empty()) { source_ids += ","; }
        source_ids += (*it3).first;
      }
      printf("<mdvalue source_count=\"%ld\" value=\"%s\">", src_count2, html_escape((*it2).first).c_str());
      printf("<source_ids>%s</source_ids>", source_ids.c_str());
      printf("</mdvalue>\n");
    }
    printf("</mdkey>\n");
  }  
  */
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</ranksum_stats>\n");    
}


//=================================================================
//
// Edges
//

void EEDB::WebServices::MetaSearch::show_edges() {
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<edges>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); }
  
  long int edge_count = 0;
  long input_feature_count = 0;
  struct timeval endtime, time_diff;

  map<string, EEDB::Feature*>::iterator   it1;
  
  //gettimeofday(&endtime, NULL); timersub(&endtime, &_starttime, &time_diff);
  //printf("===== before source_stream() %1.6f msec \n", (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0);

  EEDB::SPStreams::FederatedSourceStream  *stream = source_stream();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  //fprintf(stderr, "\nMetaSearch::show_edges get stream (%ld starting features) %1.6f sec\n", _feature_id_hash.size(), total_time);
  
  bool src_ids_changed = false;
  if(!_filter_source_ids.empty()) {
    //fprintf(stderr, "starting with %ld sources\n", _filter_source_ids.size());
    //map<string, bool>::iterator  it2;
    //for(it2 = _filter_source_ids.begin(); it2 != _filter_source_ids.end(); it2++) { fprintf(stderr, "%s\n", (*it2).first.c_str()); }
    stream->stream_data_sources("EdgeSource");
    while(EEDB::EdgeSource *source = (EEDB::EdgeSource*)stream->next_in_stream()) {
      if(source->classname() != EEDB::EdgeSource::class_name) { continue; }
      //if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source
      //fprintf(stderr, "%s\n", source->simple_xml().c_str());
      if(_filter_source_ids.find(source->feature_source1_dbid())==_filter_source_ids.end()) {
        _filter_source_ids[source->feature_source1_dbid()] = true;
        src_ids_changed = true;
        fprintf(stderr, "add edge fsrcs %s\n", source->feature_source1_dbid().c_str());
      }
      if(_filter_source_ids.find(source->feature_source2_dbid())==_filter_source_ids.end()) {
        _filter_source_ids[source->feature_source2_dbid()] = true;;
        src_ids_changed = true;
        fprintf(stderr, "add edge fsrcs %s\n", source->feature_source2_dbid().c_str());
      }
    }
  }

  if(src_ids_changed) { //rebuild stream in case there are new peers added
    stream = source_stream(); 
    gettimeofday(&endtime, NULL); timersub(&endtime, &_starttime, &time_diff);
    //printf("===== after rebuild source_stream() %1.6f msec \n", (double)time_diff.tv_sec*1000.0 + ((double)time_diff.tv_usec)/1000.0);
  }

  if(!_filter_source_ids.empty()) {
    stream->stream_data_sources();
    while(EEDB::EdgeSource *source = (EEDB::EdgeSource*)stream->next_in_stream()) {
      if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source
      printf("%s", source->xml().c_str());
    }
  }
  //fprintf(stderr, "now %ld sources in filter\n", _filter_source_ids.size());

  input_feature_count = _feature_id_hash.size();
  printf("<note>input %ld feature_ids</note>\n", _feature_id_hash.size());

  long deep_loop=1;
  if(_parameters.find("edge_search_depth")!=_parameters.end()) { 
    deep_loop = strtol(_parameters["edge_search_depth"].c_str(), NULL, 10);
    if(deep_loop<1) { deep_loop = 1; }
  }
  if(input_feature_count==0) { deep_loop=1; }
  fprintf(stderr, "starting deep_loop = %ld\n", deep_loop);
  
  string xml_buffer;
  while(deep_loop>0) {
    //printf("<note>deep loop %ld</note>\n", deep_loop);
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &_starttime, &time_diff);
    double   total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
    fprintf(stderr,"\nshow_edges loop %ld: input %ld feature_ids  %1.3fsecs\n", deep_loop, _feature_id_hash.size(), total_time);
    
    //pre-fetch features we know
    //if(!stream->fetch_features(_feature_id_hash)) {
    //  fprintf(stderr, "show_edges: failed to pre-fetch features\n");
    //}
    
    //gettimeofday(&endtime, NULL);
    //timersub(&endtime, &_starttime, &time_diff);
    //total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
    //fprintf(stderr, "\nMetaSearch::show_edges before stream edges %1.6f sec\n\n", total_time);

    bool features_changed = false;
    stream->stream_edges(_feature_id_hash, _parameters["filter"]);

    //gettimeofday(&endtime, NULL);
    //timersub(&endtime, &_starttime, &time_diff);
    //total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
    //fprintf(stderr, "\nMetaSearch::show_edges after stream_edges() setup %1.6f sec\n\n", total_time);

    while(EEDB::Edge *edge = (EEDB::Edge*)stream->next_in_stream()) {
      if(!edge) { continue; }
      
      if(deep_loop ==1) { 
        //printf("%s", edge->simple_xml().c_str());
        if(_parameters["format"] == "xml") {
          if(_parameters["format_mode"]  == "fullxml") {
            edge->xml(xml_buffer);
          } else if(_parameters["format_mode"]  == "descxml") {
            //edge->mdata_xml(xml_buffer, _desc_xml_tags);
            edge->simple_xml(xml_buffer);
          } else {
            edge->simple_xml(xml_buffer);
          }
          //if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }
        }
        edge_count++;
      }
      
      //if edges include new features, add to the _feature_id_hash
      if(_feature_id_hash.find(edge->feature1_dbid()) == _feature_id_hash.end()) {
        //fprintf(stderr, "add edge feature %s\n", edge->feature1_dbid().c_str());
        _feature_id_hash[edge->feature1_dbid()] = NULL;
        features_changed = true;
      }
      if(_feature_id_hash.find(edge->feature2_dbid()) == _feature_id_hash.end()) {
        //fprintf(stderr, "add edge feature %s\n", edge->feature2_dbid().c_str());
        _feature_id_hash[edge->feature2_dbid()] = NULL;
        features_changed = true;
      }

      string fsrcid1 = edge->edge_source()->feature_source1_dbid();
      string fsrcid2 = edge->edge_source()->feature_source2_dbid();
      if(_filter_source_ids.find(fsrcid1) == _filter_source_ids.end()) {
        //fprintf(stderr, "add filter_source %s\n", fsrcid1.c_str());
        _filter_source_ids[fsrcid1] = true;
      }
      if(_filter_source_ids.find(fsrcid2) == _filter_source_ids.end()) {
        //fprintf(stderr, "add filter_source %s\n", fsrcid2.c_str());
        _filter_source_ids[fsrcid2] = true;
      }

      edge->release();
    }
    if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }

    //rebuild stream in case there are new peers added
    _filter_peer_ids.clear(); //clear the peer_ids and only rely on the source_ids
    stream = source_stream(); 
    deep_loop--;
    if(!features_changed && deep_loop>1) { 
      deep_loop = 1; 
      fprintf(stderr, "features didn't change, so loop 1 more time to output edges\n");
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  //fprintf(stderr, "\nMetaSearch::show_edges after deep_loop output edges %1.6f sec\n\n", total_time);

  //get remaining features which were found by the edges
  if(!stream->fetch_features(_feature_id_hash)) {
    fprintf(stderr, "MetaSearch::show_edges failed to post-fetch features\n");
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  //fprintf(stderr, "MetaSearch::show_edges after post-fetch remaining %ld features %1.6f sec\n", _feature_id_hash.size(), total_time);

  unsigned feature_fail_count = 0;
  for(it1=_feature_id_hash.begin(); it1!=_feature_id_hash.end(); it1++) {
    EEDB::Feature *feature = (*it1).second;
    if(feature) {
      //printf("%s", feature->simple_xml().c_str());
      if(_parameters["format"]  == "xml") {
        if(_parameters["format_mode"]  == "fullxml") {
          feature->xml(xml_buffer);
        } else if(_parameters["format_mode"]  == "descxml") {
          feature->mdata_xml(xml_buffer, _desc_xml_tags);
        } else {
          feature->simple_xml(xml_buffer);
        }
        //if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }
      }
    } else {
      feature_fail_count++;
      printf("<note>%s :: feature failed to fetch</note>\n", (*it1).first.c_str());
    }
  }
  if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }
  if(feature_fail_count>0) { fprintf(stderr, "MetaSearch::show_edges failed to fetch %d features\n", feature_fail_count); }
  
  printf("<result_count input_features=\"%ld\" connected_features=\"%ld\" edges=\"%ld\" />\n", input_feature_count, _feature_id_hash.size(), edge_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  fprintf(stderr, "MetaSearch::show_edges finished total time %1.6f\n", runtime);

  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</edges>\n");
}

//=================================================================

void EEDB::WebServices::MetaSearch::show_features() {
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<features>\n");
  
  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); }
  
  struct timeval endtime, time_diff;
  map<string, EEDB::Feature*>::iterator   it1;
  
  EEDB::Tools::OSCFileParser::sparse_expression(false);

  EEDB::SPStreams::FederatedSourceStream  *stream = source_stream();

  if(!_filter_source_ids.empty()) {
    stream->stream_data_sources();
    while(EEDB::EdgeSource *source = (EEDB::EdgeSource*)stream->next_in_stream()) {
      if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source
      printf("%s", source->xml().c_str());
    }
  }
  //fprintf(stderr, "now %ld sources in filter\n", _filter_source_ids.size());

  long input_feature_count = _feature_id_hash.size();
  long output_feature_count = 0;
  printf("<note>input %ld feature_ids</note>\n", _feature_id_hash.size());

  string xml_buffer;
  if(!_feature_id_hash.empty()) {
    if(!stream->fetch_features(_feature_id_hash)) {
      fprintf(stderr, "show_features: failed to pre-fetch features\n");
    }
    
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &_starttime, &time_diff);
    double total_time  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
    fprintf(stderr, "show_features fetch by feature_id_hash %1.6f\n", total_time);

    unsigned feature_fail_count = 0;
    for(it1=_feature_id_hash.begin(); it1!=_feature_id_hash.end(); it1++) {
      EEDB::Feature *feature = (*it1).second;
      if(feature) {
        output_feature_count++;
        //printf("%s", feature->simple_xml().c_str());
        if(_parameters["format_mode"]  == "fullxml") {
          feature->xml(xml_buffer);
        } else if(_parameters["format_mode"]  == "descxml") {
          feature->mdata_xml(xml_buffer, _desc_xml_tags);
        } else {
          feature->simple_xml(xml_buffer);
        }
        if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }
      } else {
        feature_fail_count++;
        //printf("<note>%s :: not fetched</note>\n", (*it1).first.c_str());
      }
    }
    if(feature_fail_count>0) { fprintf(stderr, "failed to fetch %d features\n", feature_fail_count); }
  }
  else if(!_filter_source_ids.empty()) {
    //stream all features for specified sources
    stream->stream_all_features();
    while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) {
      if(!feature->peer_uuid()) { feature->release(); continue; }  //something wrong or a 'proxy' source
      if(feature->classname() != EEDB::Feature::class_name) { feature->release(); continue; }

      //perform primary filter
      if(_parameters.find("filter") != _parameters.end()) {
        EEDB::MetadataSet  *mdset = feature->metadataset();
        if((mdset != NULL) and (!(mdset->check_by_filter_logic(_parameters["filter"])))) { continue; }
      }

      output_feature_count++;
      //printf("%s", feature->simple_xml().c_str());
      if(_parameters["format_mode"]  == "fullxml") {
        feature->xml(xml_buffer);
      } else if(_parameters["format_mode"]  == "descxml") {
        feature->mdata_xml(xml_buffer, _desc_xml_tags);
      } else {
        feature->simple_xml(xml_buffer);
      }
      if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }
      feature->release();
    }
    if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); xml_buffer.clear(); }
  }
  
  printf("<result_count input_features=\"%ld\" output_features=\"%ld\" />\n", input_feature_count, output_feature_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  fprintf(stderr, "show_features finished total time %1.6f\n", runtime);

  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</features>\n");
  EEDB::Tools::OSCFileParser::sparse_expression(true);
}


/*
void EEDB::WebServices::MetaSearch::show_features() {  
  printf("Content-type: text/xml\r\n");
  printf("Access-Control-Allow-Origin: *\r\n");
  printf("Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Content-Disposition, Accept\r\n");
  printf("\r\n");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<features>\n");

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<features>\n");

  my $stream = input_stream($self);

  my @peers;
  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) {
    next unless($peer);
    next unless($peer->is_valid);  #maybe redundant since this mays be done inside the SourceStream
    push @peers, $peer;
  }

  printf("<peers count=\"%d\" >\n", scalar(@peers));
  foreach my $peer (@peers) { print($peer->xml); }
  print("</peers>\n");


  my $outmode = "simple_feature";
  #if($self->{'submode'} eq "subfeature") { $outmode = "subfeature"; }
  #if($self->{'mode'} eq 'express') { $outmode = "expression"; }
  #if($self->{'submode'} eq "expression") { $outmode = "expression"; }
  #if($self->{'submode'} eq "full_feature") { $outmode = "feature"; }
  $stream->sourcestream_output($outmode);

  my $total = 0;
  my $result_count = 0;

  if(defined($self->{'ids_array'})) {
    my $stream2 = new EEDB::SPStream::StreamBuffer;
    foreach my $id (@{$self->{'ids_array'}}) {
      my $obj = $stream->fetch_object_by_id($id);
      $stream2->add_objects($obj);
    }
    $stream = $stream2;
  } else {
    printf("<sources>\n");
    $stream->stream_data_sources('class'=>'FeatureSource');
    while (my $source = $stream->next_in_stream) {
      next unless($source->is_active eq 'y');
      next unless($source->class eq "FeatureSource");
      print($source->simple_xml);
      $total += $source->feature_count;
    }
    printf("</sources>\n");
  }

  my $name = $self->{'name'};
  if(defined($name) and (length($name)>2)) {
    if($name =~ /\s/) {
      $stream->stream_features_by_metadata_search('filter' => $name);
    } else {
      $stream->stream_features_by_metadata_search('keyword_list' => $name);
    }
  } else {
    $stream->stream_all();
  }

  while(my $feature = $stream->next_in_stream) { 
    next unless($feature->feature_source);
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    $result_count++;
    if($self->{'format'} eq 'fullxml') { print($feature->xml); }
    else { print($feature->simple_xml); }
  }
  printf("<result_count total=\"%s\" expected=\"%s\" />\n", $result_count, $total);

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</features>\n");
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;

  //printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%$global_source_cache)));
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</features>\n");
}
*/
