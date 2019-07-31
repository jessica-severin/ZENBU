/* $Id: UploadServer.cpp,v 1.53 2019/07/31 06:59:15 severin Exp $ */

/***

NAME - EEDB::SPStreams::UploadServer

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
#include <EEDB/Expression.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/JobQueue/Job.h>
#include <EEDB/WebServices/UploadServer.h>

#include "fcgi_stdio.h"  //must be include after everything since it replaces printf 


using namespace std;
using namespace MQDB;

const char*               EEDB::WebServices::UploadServer::class_name = "EEDB::WebServices::UploadServer";

EEDB::WebServices::UploadServer::UploadServer() {
  init();
}

EEDB::WebServices::UploadServer::~UploadServer() {
}

void _eedb_web_upload_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::WebServices::UploadServer*)obj;
}

void EEDB::WebServices::UploadServer::init() {
  EEDB::WebServices::WebBase::init();
  _classname      = EEDB::WebServices::UploadServer::class_name;
  _funcptr_delete = _eedb_web_upload_delete_func;
  
  _upload_linecount = 0;
  _upload_file_list.clear();
}

////////////////////////////////////////////////////////////////////////////

bool EEDB::WebServices::UploadServer::process_url_request() {
  //reinitialize internal variables
  init_service_request();
  _safe_upload_filename.clear();
  _upload_linecount = 0;

  if(getenv("HTTP_X_ZENBU_UPLOAD")) {
    receive_file_data();
    return true;
  }
  
  //parse parameters
  get_url_parameters();

  //string content_length = getenv("");
  if(getenv("HTTP_HOST"))         { _parameters["HTTP_HOST"] = getenv("HTTP_HOST"); }
  if(getenv("SERVER_PORT"))       { _parameters["SERVER_PORT"] = getenv("SERVER_PORT"); }
  if(getenv("HTTP_USER_AGENT"))   { _parameters["HTTP_USER_AGENT"] = getenv("HTTP_USER_AGENT"); }
  if(getenv("REMOTE_ADDR"))       { _parameters["REMOTE_ADDR"] = getenv("REMOTE_ADDR"); }

  
  get_post_data();
  if(!_post_data.empty()) { process_xml_parameters(); }
  
  //then re-run the post processing
  postprocess_parameters();
  
  return execute_request();
}


bool EEDB::WebServices::UploadServer::execute_request() {
  ////////////////////////// 
  // now execute request
  //
  /*
  if(defined($self->{'genome_scan'}) and ($self->{'genome_scan'} == "genome")) {
    if(_parameters["mode"] == 'region') {
      if(scan_data_stream($self)) { return; }
    } 
    return show_fcgi($self, $cgi);
  }
  */

  if(_parameters["mode"] == string("user")) {
    show_user();
  } else if(_parameters["mode"] == string("info")) {
    show_upload_status();
  } else if(_parameters["mode"] == string("uploadprep")) {
    prepare_file_upload();
  } else if(_parameters["mode"] == string("queuestatus")) {
    show_queue_status();
  } else if(_parameters["mode"] == string("clear_failed_jobs")) {
    clear_failed_jobs();
  } else if(_parameters["mode"] == string("delete")) {
    delete_uploaded_database();
  } else if(_parameters["mode"] == string("redirect")) {
    redirect_to_mydata();
  } else {
    return false;
  }
  
  //foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
  //  next unless($peer);
  //  $peer->disconnect;
  //}
  
  return true;
}



void EEDB::WebServices::UploadServer::show_api() {
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

  printf("<h1>CGI object server (c++)</h1>\n");
  printf("<p>eedb_upload.cgi\n");
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
    printf("<br>profile uuid : <b>%s</b>\n",_user_profile->uuid().c_str());
    //printf("<br>profile openID : <b>%s</b>\n",_user_profile->openID().c_str());
  }
  
  if(!_session_data.empty()) {
    printf("<p><b>session</b>");
    map<string, string>::iterator  it;
    for(it = _session_data.begin(); it != _session_data.end(); it++) {
      printf("<br>  [%s] = %s\n", (*it).first.c_str(), (*it).second.c_str());
    }
  }

  if(!_parameters.empty()) {
    printf("<p><b>parameters</b>");
    map<string, string>::iterator  it;
    for(it = _parameters.begin(); it != _parameters.end(); it++) {
      printf("<br>  [%s] = %s\n", (*it).first.c_str(), (*it).second.c_str());
    }
  }

  printf("<table border=1 cellpadding=10><tr>");
  printf("<td>%d knowns peers</td>", EEDB::Peer::global_cache_size());
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


void EEDB::WebServices::UploadServer::process_xml_parameters() {
  int   xml_len  = _post_data.size();
  char* xml_text = (char*)malloc(xml_len+1);
  memset(xml_text, 0, xml_len+1);
  memcpy(xml_text, _post_data.c_str(), xml_len);  
  //printf("%s\n", _post_data.c_str());
  
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *node2, *root_node;
  rapidxml::xml_attribute<> *attr;
  
  try {
    doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(xml_text);
  }
  catch (const std::exception& e) {
    fprintf(stderr, "catch xml parse error\n");
    free(xml_text);
    return;
  }

  root_node = doc.first_node();
  if(!root_node) { free(xml_text); return; }

  string root_name = root_node->name();
  boost::algorithm::to_lower(root_name);
  if(root_name != string("zenbu_query")) { free(xml_text); return; }
  
  //reset some defaults
  _parameters["mode"] = "";

  if((node = root_node->first_node("authenticate")) != NULL) { hmac_authorize_user(); }

  if((node = root_node->first_node("peer_names")) != NULL) { _parameters["peers"] = node->value(); }
  if((node = root_node->first_node("source_ids")) != NULL) { _parameters["source_ids"] = node->value(); }
  if((node = root_node->first_node("source_names")) != NULL) { _parameters["source_names"] = node->value(); }
  
  if((node = root_node->first_node("format")) != NULL) { _parameters["format"] = node->value(); }
  if((node = root_node->first_node("mode")) != NULL) { _parameters["mode"] = node->value(); }
  if((node = root_node->first_node("submode")) != NULL) { _parameters["submode"] = node->value(); }
  if((node = root_node->first_node("exptype")) != NULL) { _parameters["exptype"] = node->value(); }
  if((node = root_node->first_node("deletedb")) != NULL) { _parameters["deletedb"] = node->value(); }

  //if((node = root_node->first_node("zenbu_script")) != NULL) { parse_processing_stream(node); }

  if((node = root_node->first_node("display_name")) != NULL) { _parameters["display_name"] = node->value(); }
  if((node = root_node->first_node("description")) != NULL) { _parameters["description"] = node->value(); }
  if((node = root_node->first_node("assembly")) != NULL) { _parameters["assembly"] = node->value(); }
  if((node = root_node->first_node("platform")) != NULL) { _parameters["platform"] = node->value(); }
  if((node = root_node->first_node("datatype")) != NULL) { _parameters["datatype"] = node->value(); }
  if((node = root_node->first_node("bedscore_expression")) != NULL) { _parameters["bedscore_expression"] = node->value(); }
  if((node = root_node->first_node("singletagmap_expression")) != NULL) { _parameters["singletagmap_expression"] = node->value(); }
  if((node = root_node->first_node("collaboration_uuid")) != NULL) { _parameters["collaboration_uuid"] = node->value(); }
  if((node = root_node->first_node("check_duplicates")) != NULL) { _parameters["check_duplicates"] = node->value(); }

  for(node=root_node->first_node("upload_file"); node; node=node->next_sibling("upload_file")) {
    string inpath = node->value();
    if((attr = node->first_attribute("filename"))) { inpath = attr->value(); }
    //fprintf(stderr, "upload_file [%s]\n", inpath.c_str());
    _upload_file_list[inpath].orig_filename = inpath;
    if((attr = node->first_attribute("display_name"))) { _upload_file_list[inpath].display_name = attr->value(); }
    if((attr = node->first_attribute("description")))  { _upload_file_list[inpath].description = attr->value(); }

    if((attr = node->first_attribute("gff_mdata")))    { _upload_file_list[inpath].gff_mdata = attr->value(); }
    else if((node2 = node->first_node("gff_mdata")) != NULL) { _upload_file_list[inpath].gff_mdata = node2->value(); }
  }
  
  if((node = root_node->first_node("mdata_commands")) != NULL) { parse_metadata_commands(node); }

  free(xml_text);
}


void  EEDB::WebServices::UploadServer::postprocess_parameters() {
  if(_parameters.find("datatype") != _parameters.end())    { _parameters["exptype"] = _parameters["datatype"]; }

  if(_parameters.find("deletedb") != _parameters.end()) {
    _parameters["mode"] = "delete"; 
    _parameters["delete_db_uuid"] = _parameters["deletedb"];
  }

  //set defaults if they were not defined
  if(_parameters.find("format") == _parameters.end())         { _parameters["format"] = "xml"; }

  EEDB::WebServices::WebBase::postprocess_parameters();
}


void  EEDB::WebServices::UploadServer::parse_metadata_commands(void *xml_node) {
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node, *subnode;
  rapidxml::xml_attribute<> *attr;
  
  if(root_node == NULL) { return; }
  
  //first get the source_ids which we will later use to configure FederatedSourceStream
  for(node=root_node->first_node("edit"); node; node=node->next_sibling("edit")) {
    EEDB::mdedit_t edit_cmd;
    if((attr = node->first_attribute("mode"))) { edit_cmd.mode = attr->value(); }
    if((attr = node->first_attribute("tag")))  { edit_cmd.tag = attr->value(); }
    
    if(edit_cmd.mode == "change") {
      if((subnode = node->first_node("old")))  { edit_cmd.oldvalue = subnode->value(); }
      if((subnode = node->first_node("new")))  { edit_cmd.newvalue = subnode->value(); }
      if(edit_cmd.oldvalue.empty()) { continue; }
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
    //if(edit_cmd.tag == "eedb:name") { continue; }
    
    if(edit_cmd.tag == "eedb:assembly_name") { continue; }
    if(edit_cmd.tag == "assembly_name") { continue; }
    if(edit_cmd.tag == "genome_assembly") { continue; }
    
    if(edit_cmd.tag == "uuid") { continue; }
    if(edit_cmd.tag == "eedb:owner_nickname") { continue; }
    if(edit_cmd.tag == "eedb:owner_OpenID") { continue; }
    if(edit_cmd.tag == "eedb:owner_email") { continue; }
    if(edit_cmd.tag == "configXML") { continue; }
    if(edit_cmd.tag == "eedb:configXML") { continue; }
    
    _mdata_edit_commands.push_back(edit_cmd);
  }  
}


////////////////////////////////////////////////////////////////////////////

/*
void get_nextline(string &linebuffer, long int &count) {
  linebuffer.clear();
  char  c1;
  while(!feof(stdin)) {
    c1 = fgetc(stdin);
    count++;
    if((c1 != '\r') && (c1 != '\n')) { linebuffer += c1; }
    if(c1 == '\n') { break; }
  }
  //fprintf(stderr, "linebuffer [%s]\n", linebuffer.c_str()); 
}


void  EEDB::WebServices::UploadServer::get_form_data() {
  long int   totalReadCount=0;
  string     boundary, binboundary;
  string     linebuffer;
  long int   state=0;
  long int   filebytes=0;
  string     name, value, filename;
  string     local_filename;
  char       binbuffer[8096];
  int        binbufcount=0;
  FILE       *outfp = NULL;
  const char *b0, *b1, *b2;
  char       c1;

  while(!feof(stdin)) {
    switch(state) {
      case 0: //initializing file, first line is the boundary
        get_nextline(boundary, totalReadCount);
        binboundary = "\r\n" + boundary;
        state=2;
        fprintf(stderr, "boundary [%s]\n", boundary.c_str());
        break;

      case 1: //look for boundary lines
        get_nextline(linebuffer, totalReadCount);
        if(linebuffer.find(boundary) != string::npos) {
          state=2;
        }
        break;

      case 2: //just passed a boundary line so look for "Content-Disposition:"
        get_nextline(linebuffer, totalReadCount);
        if(linebuffer.empty()) { break; } //empty line, stay here and read another line
        if(linebuffer.find("Content-Disposition:") != string::npos) {
          fprintf(stderr, "!!!!! %s\n", linebuffer.c_str());
          state=3;
        }
        break;

      case 3: //parse Content-Disposition: line
        name.clear();
        value.clear();
        filename.clear();
        size_t p1,p2;
        if((p1 = linebuffer.find("name=")) != string::npos) {
          p1 += 5;
          if((p2 = linebuffer.find(";", p1)) != string::npos) {
            name = linebuffer.substr(p1, (p2-p1));
          } else {          
            name = linebuffer.substr(p1);
          }
          boost::algorithm::replace_all(name, "\"", "");
          //fprintf(stderr, "name=[%s]\n", name.c_str());
        }
        if((p1 = linebuffer.find("filename=")) != string::npos) {
          p1 += 9;
          if((p2 = linebuffer.find(";", p1)) != string::npos) {
            filename = linebuffer.substr(p1, (p2-p1));
          } else {          
            filename = linebuffer.substr(p1);
          }
          boost::algorithm::replace_all(filename, "\"", "");
          fprintf(stderr, "filename=[%s]\n", name.c_str());
          state=8; 
          break;
        }        
        state=4;
        break;
        
      case 4: //check for "Content-Type" after "Content-Disposition:" for upload_file
        get_nextline(linebuffer, totalReadCount);
        if(linebuffer.find("Content-Type:") != string::npos) {
          fprintf(stderr, "!!!!! %s\n", linebuffer.c_str());
          if(linebuffer.find("octet-stream") != string::npos) { state=7; }
          else if(linebuffer.find("application/x-gzip") != string::npos)  { state=7; }
          else { state=1; } //don't know so skip until next boundary
          fgetc(stdin); // think this is an \r
          fgetc(stdin);  // \n character after the Content-Type line

        } else {
          //no Content-Type so read as multi-line plain text
          value += linebuffer;
          state=5;
        }
        break;
        
      case 5: //read plain text (no Content-type) multi line value until next boundary lines
        get_nextline(linebuffer, totalReadCount);
        if(linebuffer.find(boundary) != string::npos) {
          if(!name.empty()) { 
            fprintf(stderr, "name=[%s] value=[%s]\n", name.c_str(), value.c_str()); 
            _parameters[name] = value;
          }
          state=9;
        } else {
          if(!value.empty()) { value += "\n"; }
          value += linebuffer;
        }
        break;

      case 7: //binary file (octet-stream or x-gzip upload_file)
        linebuffer.clear();
        if(filename.empty()) { state=1; break; }
        if(outfp==NULL) { state=1; break; }

        fprintf(stderr, "about to read binary upload_file[%s]\n", filename.c_str());
        fprintf(stderr, "file start position %ld\n", totalReadCount);
        //file transfered raw "as-is" so just dump it out
                
        b0 = b1 = binboundary.c_str();
        b2 = b1 + binboundary.length()-1;
        
        bzero(binbuffer, 8096);    
        binbufcount=0;    

        c1 = fgetc(stdin);
        totalReadCount++;
        while(!feof(stdin)) {
          //c1 = fgetc(stdin);
          //totalReadCount++;

          if(c1 == *b1) {  //possible boundary match
            binbuffer[binbufcount++] = c1;  //keep incase it doesn't fully match            
            if(b1<b2) { 
	      b1++; 
              c1 = fgetc(stdin);
              totalReadCount++;
            } else if(b1==b2) {
              //found boundary match, finished with file
              fprintf(stderr, "found boundary match %ld\n", totalReadCount);
              fprintf(stderr, "  [%s] %d\n", binbuffer, binbufcount);
              if(outfp!=NULL) { fclose(outfp); outfp=NULL; }
              //_parameters["upload_file"] = filename;
              state=9;
              break;
            }
          }
          else {  //failed boundary check
            //first write out characters in buffer
            if(binbufcount>0) {
              //started partial match but failed so need to write the buffer out
              //fprintf(stderr, "partial boundary match %ld\n", totalReadCount);
              fwrite(binbuffer, 1, binbufcount, outfp);
              filebytes += binbufcount;
              bzero(binbuffer, binbufcount);
              binbufcount=0;    
              b1 = b0;  //reset
            } else {
              //write out current character
              filebytes++;
              fputc(c1, outfp);
              c1 = fgetc(stdin);
              totalReadCount++;
            }
          }
        }
        break;


      case 8:  //uploading a file so prepare a safe local file
        local_filename = prepare_safeupload_file(filename);
        fprintf(stderr, "local_filename=[%s]\n", local_filename.c_str());
        if(outfp!=NULL) { fclose(outfp); outfp=NULL; }
        outfp = fopen(local_filename.c_str(), "w");
        state=4;
        break;
        
      case 9:  //check for end boundary line, if then do finalization before next boundary init
        if(linebuffer == boundary + "--") {
          fprintf(stderr, "finished boundary [%s]\n", linebuffer.c_str());
          queue_upload(local_filename);
          state=0;
        }
        else { 
          //normal boundary line so continue processing
          state=2;
        }


        break;

      default:
        //something strange just move forward
        get_nextline(linebuffer, totalReadCount);
        break;        
    }
  }  
  fprintf(stderr, "boundary [%s]\n", boundary.c_str());
  fprintf(stderr, "filebytes : %ld bytes\n", filebytes);
  fprintf(stderr, "received FORMDATA : %ld bytes\n", totalReadCount);

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  fprintf(stderr, "processtime_sec=%1.6f\n", runtime);
  return;
}
*/


/*
void  EEDB::WebServices::UploadServer::get_post_zenbu_query() {
  //special POSTDATA reader which scans input for </zenbu_query> to terminate reading
  //actual file content will follow the </zenbu_query>
  long long  readCount=0;
  size_t     p2;
  const char *target = "</zenbu_query>";
  int        target_len = strlen(target);
  int        tp1=0;
  
  _post_data.clear();
  
  char c1 = fgetc(stdin);
  while(c1 != EOF) {
    readCount++;
    _post_data += c1;
    if(c1 == target[tp1]) {
      tp1++;
      if(tp1 == target_len) { 
        fprintf(stderr, "found zenbu_query end-tag\n");
        break; 
      }
    } else {
      tp1=0; //reset
    }
    c1 = fgetc(stdin);
  }
  fprintf(stderr, "received POSTDATA : %s\n", _post_data.c_str());
  
  if((p2=_post_data.find("POSTDATA=")) == 0) {
    string tstr = _post_data.substr(p2+9);
    MQDB::urldecode(tstr);
    _post_data = tstr;
    fprintf(stderr, "trimmed POSTDATA : %s\n", tstr.c_str());
  }
  return;
}


void  EEDB::WebServices::UploadServer::save_post_upload_filedata(string filepath) {
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
*/


////////////////////////////////////////////////////////////////////////////

/*
EEDB::SPStreams::FederatedSourceStream* EEDB::WebServices::UploadServer::source_stream() {
  //add additional peer filtering so that only top level databases are searched
  //might not be used any more....
  
  EEDB::SPStreams::FederatedSourceStream *stream;
  stream = (EEDB::SPStreams::FederatedSourceStream*)EEDB::WebServices::WebBase::source_stream();

  //if(_user_profile) {
  //  if(_user_profile->user_registry() && (_collaboration_filter=="all" || _collaboration_filter="private")) {
  //    stream->add_peer_id_filter(_user_profile->user_registry()->uuid());
  //  }
  //     
  //  if(_registry_mode["shared"]) {
  //    vector<MQDB::DBObject*> collaborations;
  //    collaborations = _user_profile->member_collaborations();
  //    for(unsigned int i=0; i<collaborations.size(); i++) {
  //      EEDB::Collaboration *collab = (EEDB::Collaboration*)(collaborations[i]);
  //      stream->add_peer_id_filter(collab->group_registry()->uuid());
  //    }
  // }
  //  _userDB->disconnect();
  //}

  for(unsigned int i=0; i<_seed_peers.size(); i++) {
    stream->add_peer_id_filter(_seed_peers[i]->uuid());
  }

  return stream;
}
*/

//////////////////////////////////////////////////////////////////////////////////////
//
// 
//
//////////////////////////////////////////////////////////////////////////////////////


void  EEDB::WebServices::UploadServer::show_user() {
  printf("Content-type: text/xml\r\n\r\n");
  /*
  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }  
  */
  //printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user>\n");

  if(_user_profile) { printf("%s", _user_profile->xml().c_str()); }

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</user>\n");
}


void  EEDB::WebServices::UploadServer::show_upload_status() {
  printf("Content-type: text/xml\r\n\r\n");
  /*
  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }  
  */
  //printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<upload>\n");

  if(_user_profile) { printf("%s", _user_profile->simple_xml().c_str()); }

  if(_parameters.find("display_name") != _parameters.end()) { printf("<display_name>%s</display_name>\n", _parameters["display_name"].c_str()); }
  if(_parameters.find("description") != _parameters.end()) { printf("<description>%s</description>\n", _parameters["description"].c_str()); }
  if(_parameters.find("assembly") != _parameters.end()) { printf("<assembly>%s</assembly>\n", _parameters["assembly"].c_str()); }
  if(_parameters.find("platform") != _parameters.end()) { printf("<platform>%s</platform>\n", _parameters["platform"].c_str()); }
  if(_parameters.find("bedscore_expression") != _parameters.end()) { printf("<bedscore_expression>%s</bedscore_expression>\n", _parameters["datatype"].c_str()); }
  if(_parameters.find("delete_db_uuid") != _parameters.end()) { printf("<delete_db_uuid>%s</delete_db_uuid>\n", _parameters["delete_db_uuid"].c_str()); }
  if(_parameters.find("_upload_filetype") != _parameters.end()) { printf("<filetype>%s</filetype>\n", _parameters["_upload_filetype"].c_str()); }

  //now all the orig_filename -> safename return info
  //map<string, vector<string> >::iterator it1;
  map<string, UploadFile>::iterator it1;
  for(it1=_upload_file_list.begin(); it1!=_upload_file_list.end(); it1++) {
    //string orig_filename = it1->first;
    //string safebasename  = it1->second[1];
    //string file_format   = it1->second[2];
    //string file_uuid     = it1->second[3];
    //string safename      = it1->second[4];  //safebasename with file extension (with gz if present)
    //string safepath      = it1->second[5];  //safename in the userdir
    //string xmlpath       = it1->second[6];
    printf("%s",it1->second.xml().c_str());
  }
  //need backward compatible for old zenbu_upload. if one then also return old style XML
  if(_upload_file_list.size()==1) {
    it1=_upload_file_list.begin();
    printf("<original_file>%s</original_file>\n", it1->second.orig_filename.c_str());
    printf("<line_count>%ld</line_count>\n", _upload_linecount);
    printf("<safe_file>%s</safe_file>\n", it1->second.safename.c_str());
  }
  
  if(!_upload_file_list.empty()) {
    printf("<upload_prep_stats count='%ld'/>\n", _upload_file_list.size());
  }
  if(_parameters.find("upload_error") != _parameters.end()) { printf("<upload_error>%s</upload_error>\n", _parameters["upload_error"].c_str()); }

  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</upload>\n");
}


void  EEDB::WebServices::UploadServer::show_queue_status() {
  printf("Content-type: text/xml\r\n\r\n");
  /*
   if($self->{'session'}) {
   my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
   print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
   } else {
   print $cgi->header(-type => "text/xml", -charset=> "UTF8");
   }  
   */
  //printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<upload_queue>\n");
  
  if(_user_profile) { 
    printf("%s", _user_profile->simple_xml().c_str()); 
    
    vector<DBObject*> jobs = EEDB::JobQueue::Job::fetch_all_by_user(_user_profile);
    for(unsigned int i=0; i<jobs.size(); i++) {
      EEDB::JobQueue::Job *job = (EEDB::JobQueue::Job*)jobs[i];
      if(_parameters["format_mode"] == "simplexml") {
        printf("%s", job->simple_xml().c_str());
      } else { 
        printf("%s", job->xml().c_str()); 
      }
    }
  }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</upload_queue>\n");
}


void  EEDB::WebServices::UploadServer::redirect_to_mydata() {
  printf("Content-type: text/html\r\n");
  printf("Set-Cookie: %s=%s; Path=/\r\n", _session_name.c_str(), _session_data["id"].c_str());
  printf("Location: %s/user/#section=uploads\r\n", _web_url.c_str());
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


void  EEDB::WebServices::UploadServer::clear_failed_jobs() {
  printf("Content-type: text/xml\r\n\r\n");
  /*
   if($self->{'session'}) {
   my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
   print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
   } else {
   print $cgi->header(-type => "text/xml", -charset=> "UTF8");
   }  
   */
  //printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<upload_queue>\n");
  printf("<clear_failed_jobs>true</clear_failed_jobs>\n");
  
  if(_user_profile) { 
    printf("%s", _user_profile->simple_xml().c_str()); 
    
    vector<DBObject*> jobs = EEDB::JobQueue::Job::fetch_all_by_user(_user_profile);
    for(unsigned int i=0; i<jobs.size(); i++) {
      EEDB::JobQueue::Job *job = (EEDB::JobQueue::Job*)jobs[i];
      if(job->status() != "FAILED") { continue; }
      if(_parameters["format_mode"] == "simplexml") {
        printf("%s", job->simple_xml().c_str());
      } else { 
        printf("%s", job->xml().c_str()); 
      }
    }
    
    const char* sql ="update job set starttime=0 where status='FAILED' and (UNIX_TIMESTAMP()-UNIX_TIMESTAMP(starttime))/(24*60*60)<=1.0 and user_id=?";
    _userDB->do_sql(sql, "d", _user_profile->primary_id());

  }
  
  struct timeval       endtime, time_diff;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &_starttime, &time_diff);
  double   runtime  = (double)time_diff.tv_sec + ((double)time_diff.tv_usec)/1000000.0;
  printf("<process_summary processtime_sec=\"%1.6f\" />\n", runtime);
  printf("<fastcgi invocation=\"%ld\" pid=\"%d\" />\n", _connection_count, getpid());
  printf("</upload_queue>\n");
}



///////////////////////////////////////////////////////


void  EEDB::WebServices::UploadServer::delete_uploaded_database() {
  if(!_user_profile) { 
    _parameters["upload_error"] = "no login profile";
    return show_upload_status();
  }
  
  if(_parameters.find("delete_db_uuid") == _parameters.end()) {
    _parameters["upload_error"] = "no database UUID specified";
    return show_upload_status();
  }
  
  EEDB::Peer *user_reg = _user_profile->user_registry();
  if(!user_reg) {
    _parameters["upload_error"] = "no user profile registry";
    return show_upload_status(); 
  }

  string uuid;
  string objClass="Feature";
  long int objID = -1;
  EEDB::Peer *peer=NULL;

  //first try to find as if peer uuid
  EEDB::SPStreams::FederatedSourceStream *stream = new EEDB::SPStreams::FederatedSourceStream;
  stream->add_seed_peer(user_reg);
  
  stream->unparse_eedb_id(_parameters["delete_db_uuid"], uuid, objID, objClass);
  if(uuid.empty()) { uuid = _parameters["delete_db_uuid"]; }

  //stream->add_peer_id_filter(user_reg->uuid());
  //stream->add_peer_id_filter(uuid);
  stream->stream_peers();
  while((peer = (EEDB::Peer*)stream->next_in_stream())) {
    if(peer->uuid() == uuid) { break; }
  }
  
  if(!peer) {
    //try as "upload_unique_name"
    stream->release();
    stream = new EEDB::SPStreams::FederatedSourceStream;
    stream->add_seed_peer(user_reg);    
    stream->stream_data_sources("", _parameters["delete_db_uuid"]);
    while(MQDB::DBObject *obj = stream->next_in_stream()) {
      EEDB::DataSource *source = (EEDB::DataSource*)obj;
      EEDB::Metadata *md = source->metadataset()->find_metadata("upload_unique_name", _parameters["delete_db_uuid"]);
      if(md && (md->data() == _parameters["delete_db_uuid"])) {
        string fid = source->db_id();
        stream->unparse_eedb_id(fid, uuid, objID, objClass);
        if(!uuid.empty()) { 
          peer = EEDB::Peer::check_cache(uuid);
          break;
        }
      }
    }
  }
  
  
  if(!peer) { 
    _parameters["upload_error"] = "unable to find peer database";
    return show_upload_status(); 
  }

  _parameters["upload_error"] = "going to delete peer " + peer->simple_xml();
  string peer_xml = peer->xml();

  string error = _user_profile->delete_uploaded_peer(peer);
  if(!error.empty()) {
    _parameters["upload_error"] = error;
    return show_upload_status(); 
  }

  
  /*
  my $cgi = $self->{'cgi'};
  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }
  */

  printf("Content-type: text/xml\r\n\r\n");
  //printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<upload>\n");
  printf("<deleted>%s</deleted>\n", peer_xml.c_str());
  printf("</upload>\n");
}


//////////////////////////////////////////////////////////////////////////////////
//
//  new upload (non-form) based methods
//
//////////////////////////////////////////////////////////////////////////////////


void  EEDB::WebServices::UploadServer::prevent_duplicate_uploads() {
  //check the _upload_file_list original_filename against previous upload jobs from this user with the same original_file
  if(!_userDB) { return; }
  if(!_user_profile) { return; }
  if(_parameters["check_duplicates"] != "true") { return; }
  
  if(_previous_upload_origfiles.empty()) {
    //need to load the list of previous uploaded orig_filenames
    //EEDB::SPStreams::FederatedSourceStream *stream = EEDB::WebServices::WebBase::source_stream();
    EEDB::SPStreams::FederatedSourceStream *stream = new EEDB::SPStreams::FederatedSourceStream();
    stream->set_peer_search_depth(10);
    stream->add_seed_peer(_user_profile->user_registry());
    
    stream->stream_data_sources();
    while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
      //if(source->classname() != EEDB::FeatureSource::class_name) { continue; }
      vector<Metadata*> mdlist = source->metadataset()->find_all_metadata_like("orig_filename", "");
      for(unsigned j=0; j<mdlist.size(); j++) {
        _previous_upload_origfiles[mdlist[j]->data()]++;
      }
    }
    fprintf(stderr, "loaded %ld previous_upload_origfiles\n", _previous_upload_origfiles.size());
  }

  map<string, long>::iterator it3;
  for(it3=_previous_upload_origfiles.begin(); it3!=_previous_upload_origfiles.end(); it3++) {
    if((*it3).second > 1) {
      fprintf(stderr, "%s duplicate origfile uploads [%s] %ld\n",
            _user_profile->email_identity().c_str(), (*it3).first.c_str(), (*it3).second);
    }
  }
  
  
  map<string, UploadFile>::iterator it1, it2;
  it1=_upload_file_list.begin();
  while(it1!=_upload_file_list.end()) {
    string orig_filename = it1->first;
    it2 = it1;
    it1++;
    
    //first check for files which are really loaded in the system as DataSources
    if(_previous_upload_origfiles.find(orig_filename) != _previous_upload_origfiles.end()) {
      //found duplicate so remove it2
      _upload_file_list.erase(it2);
      continue;
    }
    
    //next check if it might be in the process of running
    //fprintf(stderr, "local_filename=[%s]\n", local_filename.c_str());
    const char* sql = "SELECT job_id FROM job join job_2_metadata using(job_id) join metadata using(metadata_id) \
                       WHERE user_id=? and status in ('READY', 'RUN') and data_type ='original_file' \
                             and created > DATE_SUB(NOW(), INTERVAL 4 HOUR) and data=?";
    dynadata value = _userDB->fetch_col_value(sql, "ds",  _user_profile->primary_id(), orig_filename.c_str());
    if(value.type == MQDB::INT) {
      //found duplicate so remove it2
      _upload_file_list.erase(it2);
    }
  }
  fprintf(stderr, "new uploads after duplicate check %ld\n",_upload_file_list.size());
}


void  EEDB::WebServices::UploadServer::prepare_file_upload() {
  //minimum is user + valid registry + filename + assembly
  if(!_user_profile) { 
    _parameters["upload_error"] = "no user profile";
    return show_upload_status();
  }  
  EEDB::Peer *user_reg = _user_profile->user_registry();
  if(!user_reg) {
    _parameters["upload_error"] = "no user profile registry";
    return show_upload_status(); 
  }

  if(_parameters.find("assembly") == _parameters.end()) {
    _parameters["upload_error"] = "no assembly/genome specified";
    return show_upload_status();
  }
  
  if(_upload_file_list.empty()) {
    _parameters["upload_error"] = "no upload file names specified";
    return show_upload_status();
  }
  
  //might provide this as a toggle option
  prevent_duplicate_uploads();
  
  map<string, UploadFile>::iterator it1;
  for(it1=_upload_file_list.begin(); it1!=_upload_file_list.end(); it1++) {
    string local_filename = prepare_safeupload_file(it1->first);
    //fprintf(stderr, "local_filename=[%s]\n", local_filename.c_str());

    //write out XML job file and a BLOCKED job entry for each upload_file
    write_upload_xmlinfo(it1->first);
    queue_upload(it1->first);
  }

  show_upload_status();
}


void  EEDB::WebServices::UploadServer::receive_file_data() {
  if(!_userDB) {
    _parameters["upload_error"] = "no userDB";
    return show_upload_status(); 
  }
  
  _safe_upload_filename = getenv("HTTP_X_ZENBU_UPLOAD");
  //fprintf(stderr, "safename [%s]\n", _safe_upload_filename.c_str());
  
  EEDB::SPStreams::RemoteServerStream::set_current_user(NULL);  
  string signature;
  if(getenv("HTTP_X_ZENBU_MAGIC")) { signature = getenv("HTTP_X_ZENBU_MAGIC"); }
  string email;
  if(getenv("HTTP_X_ZENBU_USER_EMAIL")) { email = getenv("HTTP_X_ZENBU_USER_EMAIL"); }
  //fprintf(stderr, "signature[%s]\n", signature.c_str());
  //fprintf(stderr, "user email[%s]\n", email.c_str());
  
  EEDB::User *user1 = EEDB::User::fetch_by_email(_userDB, email);
  if(!user1) { 
    _parameters["upload_error"] = "no user profile";
    return show_upload_status();
  }
  string key = user1->hmac_secretkey();
  
  unsigned int md_len;
  unsigned char* result = HMAC(EVP_sha256(), 
                               (const unsigned char*)key.c_str(), key.length(), 
                               (const unsigned char*)_safe_upload_filename.c_str(), _safe_upload_filename.length(), NULL, &md_len);
  static char res_hexstring[64]; //expect 32 so this is safe
  bzero(res_hexstring, 64);
  for(unsigned i = 0; i < md_len; i++) {
    sprintf(&(res_hexstring[i * 2]), "%02x", result[i]);
  }
  //fprintf(stderr, "hmac [%s]\n", res_hexstring);
  
  if(signature != res_hexstring) {
    user1->release();
    //fprintf(stderr, "ZENBU upload hmac authorization error: signatures did not match\n");
    _parameters["upload_error"] = "upload hmac authorization error: signatures did not match";
    return show_upload_status();
  }
  
  //AUTHENTICATED
  _user_profile = user1;
  EEDB::SPStreams::RemoteServerStream::set_current_user(_user_profile);
  fprintf(stderr, "ZENBU upload hmac authenticated %s [%s]", _user_profile->email_identity().c_str(), _safe_upload_filename.c_str());
  
  //
  //write post content to safe-filename
  //
  char  *readbuf = (char*)malloc(8192+10);  
  string safepath = _user_profile->user_directory() +"/";
  safepath += _safe_upload_filename;
  //fprintf(stderr, "write file [%s]\n", safepath.c_str());  
  
  FILE *outfp = fopen(safepath.c_str(), "w");
  while(!feof(stdin)) {
    memset(readbuf, 0, 8192+10);
    long long readCount = (int)fread(readbuf, 1, 8192, stdin);
    fwrite(readbuf, 1, readCount, outfp);
  }
  free(readbuf);
  fclose(outfp);
  
  //unblock the job
  const char *sql = "SELECT job_id FROM job JOIN job_2_metadata using(job_id) JOIN metadata using(metadata_id) \
                     WHERE status='BLOCKED' and data_type='safe_file' and data=? limit 1";
  dynadata jobXML = _userDB->fetch_col_value(sql, "s", _safe_upload_filename.c_str());
  if(jobXML.i_int == -1) { 
    _parameters["upload_error"] = "unable to find matching job";
    return show_upload_status(); 
  }
  long job_id = jobXML.i_int;
  
  sql = "UPDATE job SET status='READY', created=NOW() WHERE job_id=?";
  _userDB->do_sql(sql, "d", job_id);
  
  //done
  show_upload_status();
}


//////////////////////////////////////////////////////////////////////////////////
//
//  upload file base functions
//
//////////////////////////////////////////////////////////////////////////////////


string  EEDB::WebServices::UploadServer::prepare_safeupload_file(string filename) {
  //make a unique safe filename for the server side
  string file_format;
  string input_file = filename;
  
  boost::algorithm::replace_all(filename, " ", "_");

  //extract file_format  
  bool has_gz=false;
  size_t strpos = filename.rfind(".gz");
  if(strpos!=string::npos) { 
    has_gz=true;
    filename.resize(strpos);
  }
  strpos = filename.rfind(".");
  if(strpos!=string::npos) {
    file_format = filename.substr(strpos+1);
    filename.resize(strpos);
  }
  //maybe do a check for valid file extensions
  //if((ext=="bed") || (ext=="sam") || (ext=="osc") ||
  //   (ext=="bam") || (ext=="gff") || (ext=="gff2") || (ext=="gtf")) {
  //  userview.upload.file_format = ext.toUpperCase();
  //}
  _parameters["_upload_filetype"] = file_format;
  
  //get file name 
  strpos = filename.rfind("\\");
  if(strpos!=string::npos) { filename = filename.substr(strpos+1); }
  strpos = filename.rfind("/");
  if(strpos!=string::npos) { filename = filename.substr(strpos+1); }

  //now make a display/description from the filename if needed
  string pretty_name = filename;  
  boost::algorithm::replace_all(pretty_name, "_", " ");  
  boost::algorithm::replace_all(pretty_name, "\"", "");  
  boost::algorithm::replace_all(pretty_name, "\'", "");
  if(_upload_file_list[input_file].display_name.empty()) {
    if(_parameters.find("display_name") != _parameters.end()) {
      _upload_file_list[input_file].display_name = _parameters["display_name"];
    } else {
      _upload_file_list[input_file].display_name = pretty_name;
    }
  }
  if(_upload_file_list[input_file].description.empty()) {
    if(_parameters.find("description") != _parameters.end()) {
      _upload_file_list[input_file].description =  _parameters["description"];
    } else {
      _upload_file_list[input_file].description = pretty_name;
    }
  }

  //make the safe filename
  string safename;
  for(unsigned i = 0; i < filename.length(); i++) {
    char c1 = filename[i];
    if(isalnum(c1) || (c1=='_') || (c1=='-') || (c1=='.')) {
      safename += c1;
    }
  }
  boost::algorithm::replace_all(safename, "__", "_");  

  string uuid = MQDB::uuid_b64string();
  safename += "__" + uuid;
  
  _upload_file_list[input_file].safebasename = safename;
  _upload_file_list[input_file].file_format = file_format;
  _upload_file_list[input_file].file_uuid = uuid;

  _safe_upload_filename = safename + "." + file_format;
  if(has_gz) { _safe_upload_filename += ".gz"; }
  fprintf(stderr, "safe name [%s]\n", _safe_upload_filename.c_str());

  string upload_dir = _user_profile->user_directory();
  filename = upload_dir +"/"+ _safe_upload_filename;

  _upload_file_list[input_file].safename = _safe_upload_filename;
  _upload_file_list[input_file].safepath = filename;

  return filename;
}


string  EEDB::WebServices::UploadServer::write_upload_xmlinfo(string orig_filename) {
  FILE  *xmlfp;
  
  string safebasename  = _upload_file_list[orig_filename].safebasename;
  string file_format   = _upload_file_list[orig_filename].file_format;
  string file_uuid     = _upload_file_list[orig_filename].file_uuid;
  string safename      = _upload_file_list[orig_filename].safename;  //safebasename with file extension (with gz if present)
  string safepath      = _upload_file_list[orig_filename].safepath;  //safename in the userdir
  
  string xmlpath = _user_profile->user_directory() +"/";
  xmlpath += safebasename;
  xmlpath += ".xml";
  fprintf(stderr, "write xml configuration [%s]\n", xmlpath.c_str());
  _upload_file_list[orig_filename].xmlpath = xmlpath;

  
  xmlfp = fopen(xmlpath.c_str(), "w");
  fprintf(xmlfp, "<oscfile>\n");
  fprintf(xmlfp, "  <parameters>\n");
  
  //fprintf(xmlfp, "    <orig_filename>%s</orig_filename>\n", _parameters["upload_file"].c_str());
  fprintf(xmlfp, "    <orig_filename>%s</orig_filename>\n", orig_filename.c_str());
  fprintf(xmlfp, "    <input_file>%s</input_file>\n", safepath.c_str());
  fprintf(xmlfp, "    <filetype>%s</filetype>\n", file_format.c_str());
  fprintf(xmlfp, "    <upload_unique_name>%s</upload_unique_name>\n", safename.c_str());
 
  if(!_upload_file_list[orig_filename].display_name.empty()) {
    fprintf(xmlfp,"    <display_name>%s</display_name>\n", _upload_file_list[orig_filename].display_name.c_str());
  }
  if(!_upload_file_list[orig_filename].description.empty()) {
    fprintf(xmlfp,"    <description>%s</description>\n", _upload_file_list[orig_filename].description.c_str());
  }
  if(!_upload_file_list[orig_filename].gff_mdata.empty()) {
    fprintf(xmlfp,"    <gff_mdata>%s</gff_mdata>\n", _upload_file_list[orig_filename].gff_mdata.c_str());
  }
  
  if(_parameters.find("assembly") != _parameters.end()) { fprintf(xmlfp,"    <genome_assembly>%s</genome_assembly>\n", _parameters["assembly"].c_str()); }
  if(_parameters.find("platform") != _parameters.end()) { fprintf(xmlfp,"    <platform>%s</platform>\n", _parameters["platform"].c_str()); }
  if(_parameters.find("bedscore_expression") != _parameters.end()) { fprintf(xmlfp,"    <score_as_expression>%s</score_as_expression>\n", _parameters["datatype"].c_str()); }
  if(_parameters.find("singletagmap_expression") != _parameters.end()) { fprintf(xmlfp,"    <singletagmap_expression>%s</singletagmap_expression>\n", _parameters["singletagmap_expression"].c_str()); }
  if(_parameters.find("collaboration_uuid") != _parameters.end()) { fprintf(xmlfp,"    <collaboration_uuid>%s</collaboration_uuid>\n", _parameters["collaboration_uuid"].c_str()); }

  fprintf(xmlfp, "  </parameters>\n");
  fprintf(xmlfp, "</oscfile>\n");
  fclose(xmlfp);
  return xmlpath;
}


void  EEDB::WebServices::UploadServer::queue_upload(string orig_filename) {
  if(!_user_profile) { return; }

  string xmlpath     = _upload_file_list[orig_filename].xmlpath;
  string safename    = _upload_file_list[orig_filename].safename;
  string file_format = _upload_file_list[orig_filename].file_format;

  EEDB::JobQueue::Job *job = new EEDB::JobQueue::Job(_user_profile);
  job->status("BLOCKED"); //block until file content is sent in step2
  
  EEDB::MetadataSet *mdset = job->metadataset();
  mdset->add_tag_data("xmlpath", xmlpath);
  mdset->add_tag_data("original_file", orig_filename);
  mdset->add_tag_data("safe_file", safename);
  mdset->add_tag_data("file_format", file_format);
  if(!_upload_file_list[orig_filename].display_name.empty()) { mdset->add_tag_data("display_name", _upload_file_list[orig_filename].display_name); }
  if(!_upload_file_list[orig_filename].description.empty()) { mdset->add_tag_data("description", _upload_file_list[orig_filename].description); }
  
  if(_parameters.find("assembly") != _parameters.end()) { mdset->add_tag_data("assembly", _parameters["assembly"]); }
  if(_parameters.find("platform") != _parameters.end()) { mdset->add_tag_data("platform", _parameters["platform"]); }
  job->store();
}


//////////////////////////////////////////////////////////////////////////////////
//
//  UploadFile methods
//
//////////////////////////////////////////////////////////////////////////////////

EEDB::WebServices::UploadFile::UploadFile() {
}

EEDB::WebServices::UploadFile::UploadFile(void *xml_node) {
  //constructor using a rapidxml node
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(string(root_node->name()) != "upload_file") { return; }  
  if((node = root_node->first_node("original_file")) != NULL) { orig_filename = node->value(); }
  if((node = root_node->first_node("safe_file")) != NULL)     { safename = node->value(); }
  if((node = root_node->first_node("safebasename")) != NULL)  { safebasename = node->value(); }
  if((node = root_node->first_node("file_format")) != NULL)   { file_format = node->value(); }
  if((node = root_node->first_node("file_uuid")) != NULL)     { file_uuid = node->value(); }
  if((node = root_node->first_node("safepath")) != NULL)      { safepath = node->value(); }
  if((node = root_node->first_node("xmlpath")) != NULL)       { xmlpath = node->value(); }
}

string  EEDB::WebServices::UploadFile::xml() {
  string xml_buffer;
  xml_buffer += "<upload_file>\n";
  xml_buffer += "<original_file>"+orig_filename+"</original_file>\n";
  xml_buffer += "<safe_file>"+safename+"</safe_file>\n";
  xml_buffer += "<safebasename>"+safebasename+"</safebasename>\n";
  xml_buffer += "<file_format>"+file_format+"</file_format>\n";
  xml_buffer += "<file_uuid>"+file_uuid+"</file_uuid>\n";
  xml_buffer += "<safepath>"+safepath+"</safepath>\n";
  xml_buffer += "<xmlpath>"+xmlpath+"</xmlpath>\n";
  xml_buffer += "</upload_file>\n";
  return xml_buffer;
}


