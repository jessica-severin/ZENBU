/* $Id: zenbu_upload.cpp,v 1.19 2016/09/16 03:24:08 severin Exp $ */

/****
 
 NAME
 
 zdxtools - DESCRIPTION of Object
 
 DESCRIPTION
 
 zdxtools is a ZENBU system command line tool to access and process data both
 remotely on ZENBU federation servers and locally with ZDX file databases.
 The API is designed to both enable ZENBU advanced features, but also to provide
 a backward compatibility to samtools and bedtools so that zdxtools can be a "drop in"
 replacement for these other tools.
 
 CONTACT
 
 Jessica Severin <jessica.severin@gmail.com>
 
 LICENSE
 
 * Software License Agreement (BSD License)
 * MappedQueryDB [MQDB] toolkit
 * copyright (c) 2006-2009 Jessica Severin
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin nor the
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

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string>
#include <iostream>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <sys/types.h>

#include <pwd.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>

#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <MQDB/DBStream.h>
#include <EEDB/Assembly.h>
#include <EEDB/Chrom.h>
#include <EEDB/Metadata.h>
#include <EEDB/Symbol.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/Datatype.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Peer.h>
#include <EEDB/Feature.h>
#include <EEDB/JobQueue/Job.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/Tools/RemoteUserTool.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/WebServices/UploadServer.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

vector<EEDB::mdedit_t>         _mdata_edit_commands;
map<string,string>             _parameters;
EEDB::User                     *_user_profile=NULL;
long                           _login_retry_count = 0;

map<string, EEDB::WebServices::UploadFile*>   _upload_file_list;


void  usage();
bool  get_cmdline_user();
bool  verify_remote_user();

bool  list_uploads();
bool  list_collaborations();
void  show_upload_queue();

bool  upload_file_prep();
bool  upload_file_send(string orig_filename);
bool  bulk_upload_filelist();

bool  delete_upload();
bool  share_upload(string source_id);

void append_metadata_edit_command(string id_filter, string mode, string tag, string newvalue, string oldvalue);
bool send_mdata_edit_commands();
bool read_mdedit_file();
void show_mdedit_commands();

int main(int argc, char *argv[]) {

  //seed random with usec of current time
  struct timeval  starttime;
  gettimeofday(&starttime, NULL);
  srand(starttime.tv_usec);

  if(argc==1) { usage(); }

  _parameters["mode"] = "";

  for(int argi=1; argi<argc; argi++) {
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    
    vector<string> argvals;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      argvals.push_back(argv[argi]);
    }
    
    if(arg == "-help")   { usage(); }
    if(arg == "-ids") {
      string ids;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        ids += " "+ argvals[j];
      }
      _parameters["ids"] += ids;
    }

    if(arg == "-list")          { _parameters["mode"] = "list_uploads"; continue; }
    if(arg == "-queue")         { _parameters["mode"] = "show_queue"; continue; }
    if(arg == "-collabs")       { _parameters["mode"] = "list_collaborations"; continue; }

    if(arg == "-singletag_exp") { 
      if(argvals.empty()) {
        _parameters["singletagmap_expression"] = "tagcount";
      } else {
        _parameters["singletagmap_expression"] = argvals[0];
      }
      continue;
    }
    if(arg == "-allow_duplicates") { _parameters["check_duplicates"] = "false"; continue; }
    
    if(argvals.empty()) {
      fprintf(stderr, "ERROR: option %s needs parameters\n\n", arg.c_str());
      usage();
    }
      
    if(arg == "-file")          { _parameters["mode"] = "upload"; _parameters["_input_file"] = argvals[0]; }
    if(arg == "-f")             { _parameters["mode"] = "upload"; _parameters["_input_file"] = argvals[0]; }
    if(arg == "-filelist")      { _parameters["mode"] = "uploadlist"; _parameters["_input_filelist"] = argvals[0]; }
    
    if(arg == "-url")           { _parameters["_url"] = argvals[0]; }
    
    if(arg == "-assembly")      { _parameters["assembly"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["assembly"] = argvals[0]; }
    if(arg == "-asmb")          { _parameters["assembly"] = argvals[0]; }
    if(arg == "-assembly_name") { _parameters["assembly"] = argvals[0]; }

    if(arg == "-name")          { _parameters["display_name"] = argvals[0]; }
    if(arg == "-displayname")   { _parameters["display_name"] = argvals[0]; }
    if(arg == "-display_name")  { _parameters["display_name"] = argvals[0]; }
    
    if(arg == "-description")   { _parameters["description"] = argvals[0]; }
    if(arg == "-desc")          { _parameters["description"] = argvals[0]; }
    if(arg == "-gff_mdata")     { _parameters["gff_mdata"] = argvals[0]; }

    if(arg == "-filter")        { _parameters["filter"] = argvals[0]; }

    if(arg == "-platform")      { _parameters["platform"] = argvals[0]; }
    if(arg == "-score_express") { _parameters["bedscore_expression"] = argvals[0]; }
    if(arg == "-score_exp")     { _parameters["bedscore_expression"] = argvals[0]; }
    if(arg == "-format")        { _parameters["format"] = argvals[0]; }

    if(arg == "-share")         { _parameters["_collab_uuid"] = argvals[0]; }
    if(arg == "-collab_uuid")   { _parameters["_collab_uuid"] = argvals[0]; }
    if(arg == "-collab_filter") { _parameters["_collab_filter"] = argvals[0]; }

    if(arg == "-delete")        { _parameters["mode"] = "delete"; _parameters["_delete_id"] = argvals[0]; }
    
    //metadata interface
    //if(arg == "-mdata") { //adding metadata
    //  _parameters["mode"] = "mdedit";
    //  string tag   = argvals[0];
    //  string value = argvals[1];
    //  append_metadata_edit_command("add", tag, value, "");
    //}
    if(arg == "-mdedit") {
      if(argvals.size() < 2) {
        fprintf(stderr, "ERROR -mdedit must specify at least 2 paramters <id/filter> and <cmd>\n\n");
        usage();
      }
      _parameters["mode"] = "mdedit";
      string id_filter = argvals[0];
      string cmd       = argvals[1];
    
      if(cmd == "add") {
        if(argvals.size() ==4) {
          string tag   = argvals[2];
          string value = argvals[3];
          append_metadata_edit_command(id_filter, "add", tag, value, "");
        } else {
          fprintf(stderr, "ERROR -mdedit add must specify 2 additional parameters\n\n");
          usage();
        }
      }
      if(cmd == "delete") {
        if(argvals.size() ==3) {
          string tag   = argvals[2];
          append_metadata_edit_command(id_filter, "delete", tag, "", "");
        } else if(argvals.size() ==4) {
          string tag   = argvals[2];
          string value = argvals[3];
          append_metadata_edit_command(id_filter, "delete", tag, value, "");
        } else {
          fprintf(stderr, "ERROR -mdedit delete must specify either 1 or 2 additional parameters\n\n");
          usage();
        }
      }
      if(cmd == "change") {
        if(argvals.size() ==4) {
          string tag   = argvals[2];
          string value = argvals[3];
          append_metadata_edit_command(id_filter, "change", tag, value, "");
        } else if(argvals.size() ==5) {
          string tag   = argvals[2];
          string value = argvals[3];
          string oldvalue = argvals[4];
          append_metadata_edit_command(id_filter, "change", tag, value, oldvalue);
        } else {
          fprintf(stderr, "ERROR -mdedit change must specify either 2 or 3 additional parameters\n\n");
          usage();
        }
      }        
      if(cmd == "extract_keywords") {
        append_metadata_edit_command(id_filter, "extract_keywords", "keyword", " ", " ");
      }        
    }
    
    if(arg == "-mdfile") {
      _parameters["_mdedit_file"] = argvals[0];
      read_mdedit_file();
    }      
  }
  
  
  if(_parameters.find("_url") == _parameters.end()) {
    printf("\nERROR: must specify -url to remote ZENBU system\n\n");
    usage(); 
  }
  
  get_cmdline_user();
  if(!_user_profile) {
    printf("\nERROR: unable to read your ~/.zenbu/id_hmac file to identify your login identify. Please create file according to documentation.\nhttps://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/Data_loading#Bulk_command-line_upload_of_datafiles\n\n");
    usage();
  }

  bool login_ok = verify_remote_user();
  while(!login_ok && _login_retry_count<3) {
    _login_retry_count++;
    printf("\nERROR: unable to login to remote server [%s] as user [%s] -- try %ld\n",
           _parameters["_url"].c_str(), _user_profile->email_identity().c_str(), _login_retry_count);
    sleep(_login_retry_count * 2);
    login_ok = verify_remote_user();
  }
  if(!login_ok) { usage(); }

  if(_parameters["mode"] == "upload") {
    if(!upload_file_prep()) { usage(); }
    if(!upload_file_send(_parameters["_input_file"])) { usage(); }
  } else if(_parameters["mode"] == "uploadlist") {
    if(!bulk_upload_filelist()) { usage(); }
  } else if(_parameters["mode"] == "list_uploads") {
    list_uploads();
  } else if(_parameters["mode"] == "list_collaborations") {
    list_collaborations();
  } else if(_parameters["mode"] == "show_queue") {
    show_upload_queue();
  } else if(_parameters["mode"] == "delete") {    
    if(!delete_upload()) { usage(); }
  } else if(_parameters["mode"] == "mdedit") {    
    if(!send_mdata_edit_commands()) { usage(); }
  } else {
    usage();
  }

  exit(1);
}



void usage() {
  printf("zenbu_upload [options]\n");
  printf("  -help                         : print this help\n");
  printf("  -url <url>                    : http url for specified ZENBU server\n");
  printf("  -collabs                      : show list of my collaborations\n");
  printf("    -format <type>              : display format for listing collaborations (list, detail, xml, simplexml)\n");
  printf("  -queue                        : show list of users pending upload queue\n");
  printf("  -list                         : show list of previous uploads\n");
  printf("    -filter <keywords>          : filter upload list\n");
  printf("    -collab_filter <uuid>       : filter list for specific collaboration. Will show all data from all collaborators not just your contribution.\n");
  printf("    -share <collab_uuid>        : share listed data to specified collaboration\n");
  printf("    -format <type>              : display format for list/collabs/queue (list, detail, xml, simplexml)\n");
  printf("  -file <path>                  : upload file to your account on specified server\n");
  printf("    -assembly <genome name>     : genome assembly name for coordinate space of upload\n");
  printf("    -name <text>                : display name for upload data source(s)\n");
  printf("    -desc <text>                : description for upload data source(s)\n");
  printf("    -gff_mdata <text>           : metadata to associate with upload. In GFF attribute format like -gff_mdata \"tag1=value1;tag2=long value with spaces;tag3=value2\"\n");
  printf("    -platform <text>            : platform metadata for upload data source(s)\n");
  printf("    -score_exp <datatype>       : use bed score column as expression value with <datatype>\n");
  printf("    -singletag_exp <datatype>   : each line of file gets expression value of 1 with <datatype>: default 'tagcount'\n");
  printf("    -collab_uuid <uuid>         : share this uploaded data to specified collaboration\n");
  printf("    -allow_duplicates           : do not perform the duplicate-uploads checks\n");
  printf("  -filelist <control_file>      : bulk upload files. In control_file give fullpath list of files to upload. Takes same additional params as -file\n");
  printf("  -delete <safename/uuid>       : delete uploaded file via either the unique safe filename or peer_uuid\n");
  printf("  -mdedit <id/filter> <cmd> ... : edit metadata of specified source via id or search filter eg: \"encode rnaseq\"\n");
  printf("                                  <cmd> options are listed below with additional parameter options\n");
  printf("    add <tag> <value>              : add metadata eg: -mdedit <..> add eedb:display_name \"some description\"\n");
  printf("    delete <tag>                   : delete all metadata with <tag>\n");
  printf("    delete <tag> <value-filter>    : delete all metadata with <tag> and search-like <value>\n");
  printf("    change <tag> <newvalue>        : change all metadata with <tag> to have new value\n");
  printf("    change <tag> <newval> <filter> : change all metadata with <tag> and matching value-filter to <new-value>\n");
  printf("    extract_keywords               : delete all previous keywords and rebuild from other metadata\n");
  printf("  -mdfile <path>                : ability to specify a block of mdedit commands in a single control file\n");  
  printf("                                  file is tab-separated columns following the same logic as the -mdedit cmdline option\n");
  printf("                                  <id/filter> -tab- <cmd> -tab- <optional columns depending on cmd>\n");
  printf("zenbu_upload v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


////////////////////////////////////////////////////////////////////////////
//
// libcurl callback code 
//
////////////////////////////////////////////////////////////////////////////

static size_t _rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp) {
  size_t realsize = size * nmemb;
  struct RSS_curl_buffer *mem = (struct RSS_curl_buffer *)userp;
  //fprintf(stderr, "_rss_curl_writeMemoryCallback %ld\n", realsize);
  
  if(mem->size + realsize + 1 >= mem->alloc_size) {
    mem->alloc_size += realsize + 2*1024*1024;
    mem->memory = (char*)realloc(mem->memory, mem->alloc_size);
    //fprintf(stderr, "realloc %ld\n", mem->alloc_size);
  }
  if(mem->memory == NULL) {
    // out of memory!
    fprintf(stderr, "curl not enough memory (realloc returned NULL)\n");
    exit(EXIT_FAILURE);
  }
  
  memcpy(&(mem->memory[mem->size]), contents, realsize);
  mem->size += realsize;
  mem->memory[mem->size] = 0;
  return realsize;
}


////////////////////////////////////////////////////////////////////////////
//
// user query methods
//
////////////////////////////////////////////////////////////////////////////


bool  get_cmdline_user() {
  //reads ~/.zenbu/id_hmac to get hmac authentication secret
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  
  if(_user_profile) { return true; }
  struct passwd *pw = getpwuid(getuid());
  string path = pw->pw_dir;
  path += "/.zenbu/id_hmac";
  fildes = open(path.c_str(), O_RDONLY, 0x700);
  if(fildes<0) { return false; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  //printf("config file %lld bytes long\n", (long long)cfg_len);
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  char* email = strtok(config_text, " \t\n");
  char* secret = strtok(NULL, " \t\n");
  
  //printf("[%s] -> [%s]\n", email, secret);
  
  _user_profile = new EEDB::User();
  if(email)  { _user_profile->email_address(email); }
  if(secret) { _user_profile->hmac_secretkey(secret); }
  
  free(config_text);
  close(fildes);
  
  return true;
}


bool  verify_remote_user() {
  //collaborations user is member/owner of
  //might also need to cache peers, but for now try to do without caching
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>user</mode>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_user.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<user");
  if(!start_ptr) { free(chunk.memory); return false; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
  
  rapidxml::xml_node<> *node = root_node->first_node("eedb_user");
  EEDB::User *user = NULL;
  if(node) {   
    user = new EEDB::User(node);
  }
  if(!user) { return false; }
  
  //fprintf(stderr, "%s\n", user->xml().c_str());
  
  free(chunk.memory);
  doc.clear();
  
  return true;
}


////////////////////////////////////////////////////////////////////////////
//
// upload methods
//
////////////////////////////////////////////////////////////////////////////


bool  upload_file_prep() {  
  if(!_user_profile) { return false; }
  
  //
  //check file, get file size
  //
  if(_parameters.find("_input_file") == _parameters.end()) {
    printf("\nERROR: must specify -file to upload\n\n");
  }
  int fildes = open(_parameters["_input_file"].c_str(), O_RDONLY, 0x700);
  if(fildes<0) { 
    fprintf(stderr, "ERROR: unable to open file [%s]\n", _parameters["_input_file"].c_str());
    return false; 
  }
  //fprintf(stderr, "file [%s] ", _parameters["_input_file"].c_str());
  off_t file_len = lseek(fildes, 0, SEEK_END);
  if(file_len > 1024*1024) {
    printf("%1.3f MBytes long\n", (double)file_len/1024.0/1024.0);
  } else if (file_len > 1024) {
    printf("%1.3f KBytes long\n", (double)file_len/1024.0);
  } else {
    printf("%lld bytes long\n", (long long)file_len);
  }
  lseek(fildes, 0, SEEK_SET);
  close(fildes);
  
  //
  //phase1 send metadata information and get safe-filename 
  //
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>uploadprep</mode>";
  paramXML += "<upload_file ";
  paramXML += "filename=\""+html_escape(_parameters["_input_file"])+"\">";
  if(_parameters.find("gff_mdata") != _parameters.end()) { 
    paramXML += "<gff_mdata>"+_parameters["gff_mdata"]+"</gff_mdata>"; 
  }
  paramXML += "</upload_file>";

  if(_parameters.find("display_name") != _parameters.end()) { 
    paramXML += "<display_name>"+_parameters["display_name"]+"</display_name>"; 
  }
  if(_parameters.find("description") != _parameters.end()) { 
    paramXML += "<description>"+_parameters["description"]+"</description>";
  }
  if(_parameters.find("assembly") != _parameters.end()) { 
    paramXML += "<assembly>"+_parameters["assembly"]+"</assembly>";
  }
  if(_parameters.find("platform") != _parameters.end()) { 
    paramXML += "<platform>"+_parameters["platform"]+"</platform>";
  }
  if(_parameters.find("bedscore_expression") != _parameters.end()) { 
    paramXML += "<bedscore_expression>"+_parameters["bedscore_expression"]+"</bedscore_expression>";
    paramXML += "<datatype>"+_parameters["bedscore_expression"]+"</datatype>";
  }  
  if(_parameters.find("singletagmap_expression") != _parameters.end()) { 
    paramXML += "<singletagmap_expression>"+_parameters["singletagmap_expression"]+"</singletagmap_expression>";
    paramXML += "<datatype>"+_parameters["singletagmap_expression"]+"</datatype>";
  }  

  if(_parameters["check_duplicates"] != "false") {
    paramXML += "<check_duplicates>true</check_duplicates>";
  }
  
  if(_parameters.find("_collab_uuid") != _parameters.end()) { 
    paramXML += "<collaboration_uuid>"+_parameters["_collab_uuid"]+"</collaboration_uuid>";  
  }
  //metadata
  if(!_mdata_edit_commands.empty()) {
    paramXML += "<mdata_commands>";
    vector<EEDB::mdedit_t>::iterator  edit_cmd;
    for(edit_cmd = _mdata_edit_commands.begin(); edit_cmd != _mdata_edit_commands.end(); edit_cmd++) {
      paramXML += "<edit mode=\"" + edit_cmd->mode +"\"";
      if(!edit_cmd->tag.empty()) { 
        paramXML += " tag=\"" + html_escape(edit_cmd->tag) +"\""; 
      }
      paramXML += ">";
      if(edit_cmd->mode == "change") {
        if(!edit_cmd->oldvalue.empty()) { paramXML += "<old>" + html_escape(edit_cmd->oldvalue) +"</old>"; }
        if(!edit_cmd->newvalue.empty()) { paramXML += "<new>" + html_escape(edit_cmd->newvalue) +"</new>"; }        
      } else {
        if(!edit_cmd->newvalue.empty()) { paramXML += html_escape(edit_cmd->newvalue); }
      }
      paramXML += "</edit>";        
    }
    paramXML += "</mdata_commands>";  
  }
  
  paramXML += "</zenbu_query>";  
  fprintf(stderr, "POSTi---\n%s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_upload.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<upload");
  if(!start_ptr) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;

  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 

  rapidxml::xml_node<> *errornode = root_node->first_node("upload_error");
  if(errornode) {
    fprintf(stderr, "ERROR: %s\n", errornode->value());
    return false;
  }

  /*
  rapidxml::xml_node<> *node = root_node->first_node("safe_file");
  if(!node) {
    fprintf(stderr, "ERROR: upload prep did not return a unique safe file id\n");
    return false;
  }
  
  string safe_file = node->value();
  fprintf(stderr, "upload_unique_name[%s]\n", safe_file.c_str());  
  free(chunk.memory);
  doc.clear();
  
  _parameters["_safe_filename"] = safe_file;
   */
  
  rapidxml::xml_node<> *node = root_node->first_node("upload_file");
  if(!node) {
    fprintf(stderr, "ERROR: upload prep did not return any files to upload. maybe all duplicates\n");
    return true;
  }
  
  while(node) {
    EEDB::WebServices::UploadFile *upload_file = new EEDB::WebServices::UploadFile(node);;
    if(upload_file) {
      _upload_file_list[upload_file->orig_filename] = upload_file;
    }
    node = node->next_sibling("upload_file");
  }
  fprintf(stderr, "PREP returned %ld safenames (avoiding reload) for actual upload\n", _upload_file_list.size());

  return true;
}


bool  bulk_upload_filelist() {
  if(!_user_profile) { return false; }
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  //
  //check file, get file size
  //
  if(_parameters.find("_input_filelist") == _parameters.end()) {
    printf("\nERROR: must specify -filelist to upload\n\n");
  }
  gzFile gz = gzopen(_parameters["_input_filelist"].c_str(), "r");
  if(!gz) {
    fprintf(stderr, "ERROR: unable to open file [%s]\n", _parameters["_input_filelist"].c_str());
    return false;
  }
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  //
  //phase1 send metadata information and get safe-filenames
  //
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>uploadprep</mode>";
  
  //default parameters to apply to all files
  if(_parameters.find("display_name") != _parameters.end()) {
    paramXML += "<display_name>"+_parameters["display_name"]+"</display_name>";
  }
  if(_parameters.find("description") != _parameters.end()) {
    paramXML += "<description>"+_parameters["description"]+"</description>";
  }
  if(_parameters.find("assembly") != _parameters.end()) {
    paramXML += "<assembly>"+_parameters["assembly"]+"</assembly>";
  }
  if(_parameters.find("platform") != _parameters.end()) {
    paramXML += "<platform>"+_parameters["platform"]+"</platform>";
  }
  if(_parameters.find("bedscore_expression") != _parameters.end()) {
    paramXML += "<bedscore_expression>"+_parameters["bedscore_expression"]+"</bedscore_expression>";
    paramXML += "<datatype>"+_parameters["bedscore_expression"]+"</datatype>";
  }
  if(_parameters.find("singletagmap_expression") != _parameters.end()) {
    paramXML += "<singletagmap_expression>"+_parameters["singletagmap_expression"]+"</singletagmap_expression>";
    paramXML += "<datatype>"+_parameters["singletagmap_expression"]+"</datatype>";
  }
  paramXML += "<check_duplicates>true</check_duplicates>";
  if(_parameters.find("_collab_uuid") != _parameters.end()) {
    paramXML += "<collaboration_uuid>"+_parameters["_collab_uuid"]+"</collaboration_uuid>";
  }
  
  //
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }
    //if(_data_buffer[strlen(_data_buffer)-1] == '\n') { _data_buffer[strlen(_data_buffer)-1] = '\0'; }
    long colnum=1;
    string filename, display_name, description, gff_mdata;
    char *tok, *line=_data_buffer;
    while((tok = strsep(&line, "\t\n")) != NULL) {
      switch(colnum) {
        case 1: filename = tok; break;
        case 2: display_name = tok; break;
        case 3: description = tok; break;
        case 4: gff_mdata = tok; break;
        default: break;
      }
      colnum++;
    }
    if(filename.empty()) { continue; }
    paramXML += "<upload_file ";
    paramXML += "filename=\""+html_escape(filename)+"\" ";
    if(!display_name.empty()) { paramXML += "display_name=\""+html_escape(display_name)+"\" "; }
    if(!description.empty())  { paramXML += "description=\""+html_escape(description)+"\" "; }
    paramXML += ">";
    if(!gff_mdata.empty())    { paramXML += "<gff_mdata>"+html_escape(gff_mdata)+"</gff_mdata>"; }
    paramXML += "</upload_file>\n";
  }
  
  paramXML += "</zenbu_query>";
  fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  free(_data_buffer);
  gzclose(gz); //close input file
  
  string url = _parameters["_url"] + "/cgi/eedb_upload.cgi";
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str());
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length());
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(),
                                 (const unsigned char*)key.c_str(), key.length(),
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl);
  
  fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<upload");
  if(!start_ptr) {
    free(chunk.memory);
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false;
  }
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) {
    free(chunk.memory);
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false;
  }
  
  rapidxml::xml_node<> *errornode = root_node->first_node("upload_error");
  if(errornode) {
    fprintf(stderr, "ERROR: %s\n", errornode->value());
    return false;
  }
  
  rapidxml::xml_node<> *node = root_node->first_node("upload_file");
  if(!node) {
    fprintf(stderr, "upload prep did not return any files to upload. maybe all duplicates. no new uploads\n");
    return true;
  }
  
  while(node) {
    EEDB::WebServices::UploadFile *upload_file = new EEDB::WebServices::UploadFile(node);;
    if(upload_file) {
      _upload_file_list[upload_file->orig_filename] = upload_file;
    }
    node = node->next_sibling("upload_file");
  }
  fprintf(stderr, "PREP returned %ld safenames (avoiding reload) for actual upload\n", _upload_file_list.size());
  
  map<string, EEDB::WebServices::UploadFile*>::iterator it1;
  long count=1;
  for(it1=_upload_file_list.begin(); it1!=_upload_file_list.end(); it1++) {
    fprintf(stderr, "SEND %ld orig:[%s] zenbu:[%s]\n", count++, it1->second->orig_filename.c_str(), it1->second->safename.c_str());
    upload_file_send(it1->second->orig_filename);
  }

  return true;
}


bool  upload_file_send(string input_file) {
  struct timeval      starttime,endtime,difftime;  
  if(!_user_profile) { return false; }
  
  //_parameters["_input_file"]
  EEDB::WebServices::UploadFile *ufile = _upload_file_list[input_file];
  if(!ufile) { return true; }
  string safe_filename = ufile->safename;
  
  //get file size
  int fildes = open(input_file.c_str(), O_RDONLY, 0x700);
  if(fildes<0) { 
    fprintf(stderr, "ERROR: unable to open file [%s]\n", input_file.c_str());
    return false; 
  }
  off_t file_len = lseek(fildes, 0, SEEK_END);
  close(fildes);

  gettimeofday(&starttime, NULL);
  fprintf(stderr, "SEND orig:[%s] zenbu:[%s] : ", ufile->orig_filename.c_str(), ufile->safename.c_str());
  if(file_len > 1024*1024) {
    printf("%1.3f MBytes long\n", (double)file_len/1024.0/1024.0);
  } else if (file_len > 1024) {
    printf("%1.3f KBytes long\n", (double)file_len/1024.0);
  } else {
    printf("%lld bytes long\n", (long long)file_len);
  }

  //
  //phase2 send file content
  //
  FILE *fd = fopen(input_file.c_str(), "rb");
  if(!fd) {
    fprintf(stderr, "ERROR: can not open file for sending\n");
  }
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string url = _parameters["_url"] + "/cgi/eedb_upload.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_UPLOAD, 1); 
  curl_easy_setopt(curl, CURLOPT_READDATA, (void*)fd); 
  curl_easy_setopt(curl, CURLOPT_INFILESIZE_LARGE, (curl_off_t)file_len); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(slist, "Content-Type:application/octet-stream");

  //HTTP_X_ZENBU_UPLOAD
  string safe_creds = string("x-zenbu-upload:") + safe_filename;
  slist = curl_slist_append(slist, safe_creds.c_str());  

  //HTTP_X_ZENBU_USER_EMAIL
  string email_creds = string("x-zenbu-user-email:") + _user_profile->email_identity();
  slist = curl_slist_append(slist, email_creds.c_str());  

  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)safe_filename.c_str(),
                                 safe_filename.length(),
                                 NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    //fprintf(stderr,"signature [%s]\n", res_hexstring);
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  char *start_ptr = strstr(chunk.memory, "<upload");
  if(!start_ptr) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply when sending file content\n");
    return false; 
  } 
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  double duration = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
  fprintf(stderr, "  sent in %1.6f sec : %1.3f kb/sec\n", duration, file_len/1024.0/duration);

  return true;
}    



////////////////////////////////////////////////////////////////////////////
//
// list methods
//
////////////////////////////////////////////////////////////////////////////


bool list_uploads() {
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "list"; }
  
  map<string, EEDB::Peer*>                peer_map;
  map<string, vector<EEDB::DataSource*> > my_uploads;
  //map<string, long>                  peer_source_count;
  long exp_count=0;
  long fsrc_count=0;
  
  EEDB::SPStreams::FederatedSourceStream *stream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::Peer *seed = EEDB::Peer::new_from_url(_parameters["_url"]);
  if(!seed or !seed->is_valid()) {
    printf("\nERROR: problem connecting to remote url [%s]\n\n", _parameters["_url"].c_str());
    return false;
  }
  stream->add_seed_peer(seed);

  EEDB::SPStreams::RemoteServerStream::set_current_user(_user_profile);
  if(_parameters.find("_collab_filter") != _parameters.end()) {
    EEDB::SPStreams::RemoteServerStream::set_collaboration_filter(_parameters["_collab_filter"]);
  } else {
    EEDB::SPStreams::RemoteServerStream::set_collaboration_filter("private");
  }

  // peers
  stream->stream_peers();
  while(MQDB::DBObject* obj = stream->next_in_stream()) { 
    if(!obj) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(!(peer->is_valid())) { continue; }
    peer_map[peer->uuid()] = peer;
    my_uploads[peer->uuid()].clear();
    //peer_source_count[peer->uuid()] = 0;
  }  
  //printf("%ld peers\n", my_uploads.size());  
  
  // sources  
  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources("", _parameters["filter"]);
  } else {
    stream->stream_data_sources("");
  }
  while(MQDB::DBObject* obj = stream->next_in_stream()) {
    if(obj->classname() == EEDB::Peer::class_name) { 
      EEDB::Peer *peer = (EEDB::Peer*)obj;
      peer_map[peer->uuid()] = peer;
      continue; 
    }
    
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(obj->db_id(), uuid, objID, objClass);
    //printf("        uuid: %s\n", uuid.c_str());
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    
    //peer_source_count[uuid]++;
    
    EEDB::DataSource* source = (EEDB::DataSource*)obj;
    if(obj->classname() == EEDB::Experiment::class_name) { exp_count++; }
    if(obj->classname() == EEDB::FeatureSource::class_name) { fsrc_count++; }

    //if(obj->primary_id() == 1) {
    my_uploads[uuid].push_back(source);
  }
  
  // show
  printf("-------------\n");
  long upload_count=0;

  map<string, vector<EEDB::DataSource*> >::iterator it1;
  for(it1 = my_uploads.begin(); it1!=my_uploads.end(); it1++) {
    string                    uuid = (*it1).first;
    vector<EEDB::DataSource*> sources = (*it1).second;
    if(sources.empty()) { continue; }
    upload_count++;
    
    if(_parameters["format"] == "list") {
      printf("%30s [%s] (%ld sources) ::: %s\n", 
             uuid.c_str(),
             sources[0]->display_name().c_str(),
             sources.size(),
             sources[0]->description().c_str() );
    } else if(_parameters["format"] == "detail") {
      printf("-------------\n");
      printf("        uuid: %s\n", uuid.c_str());
      printf("        name: %s\n", sources[0]->display_name().c_str());
      printf(" description: %s\n", sources[0]->description().c_str());
      printf(" sources    : %ld\n", sources.size());
    } else {
      //show all sources
      vector<EEDB::DataSource*>::iterator it2;
      for(it2 = sources.begin(); it2!=sources.end(); it2++) {
        EEDB::DataSource* source = (*it2);
        if(_parameters["format"] == "xml") {
          printf("%s\n", source->xml().c_str());
        }
        else if((_parameters["format"] == "simplexml") || (_parameters["format"] == "simple_xml")) {
          printf("%s", source->simple_xml().c_str());
        }
      }
    }
    
    //collaboration sharing for peer uuid
    if(_parameters.find("_collab_uuid") != _parameters.end()) {
      if(share_upload(sources[0]->db_id())) {
        printf("  shared to collaboration [%s]\n", _parameters["_collab_uuid"].c_str());
      }
    }

  }
  printf("-------------\n");
  printf("%ld uploads --- %ld featuresources --- %ld experiments --- [%ld total sources]\n", upload_count, fsrc_count, exp_count, fsrc_count+exp_count);
  stream->disconnect();  
  return true;
}


bool list_collaborations() {
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "list"; }

  //collaborations user is member/owner of
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>collaborations</mode>";  
  paramXML += "<format>xml</format>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_user.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<collaborations");
  if(!start_ptr) { free(chunk.memory); return false; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
  
  long collab_count=0;
  long total_share=0;
  rapidxml::xml_node<> *node = NULL;
  if((node = root_node->first_node("collaboration")) != NULL) { 
    while(node) {
      EEDB::Collaboration *collab = new EEDB::Collaboration(node);;
      if(collab) {
        collab_count++;
        long share_count = collab->shared_data_peers().size();
        total_share += share_count;

        if(_parameters["format"] == "xml") {
          printf("%s\n", collab->xml().c_str());
        }
        else if((_parameters["format"] == "simplexml") || (_parameters["format"] == "simple_xml")) {
          printf("%s", collab->simple_xml().c_str());
        }
        else if(_parameters["format"] == "detail") {
          printf("-------------\n");
          printf("        uuid: %s\n", collab->group_uuid().c_str());
          printf("        name: %s\n", collab->display_name().c_str());
          printf("      status: %s\n", collab->member_status().c_str());
          printf(" description: %s\n", collab->description().c_str());
          printf(" shared data: %ld\n", share_count);
        } else {
          printf("%30s [%s] :: %ld shared uploads\n", collab->group_uuid().c_str(), collab->display_name().c_str(), share_count);
        }        
      }
      node = node->next_sibling("collaboration");
    }    
  } 
  printf("%ld collaborations --- [%ld total shared uploads]\n", collab_count, total_share);
  
  free(chunk.memory);
  doc.clear();
  return true;
}


void show_upload_queue() {
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "list"; }
  
  //collaborations user is member/owner of
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  paramXML += "<mode>queuestatus</mode>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_upload.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<upload_queue");
  if(!start_ptr) { free(chunk.memory); return; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return; } 
  
  long job_count=0;
  long total_share=0;
  rapidxml::xml_node<> *node = NULL;
  if((node = root_node->first_node("job")) != NULL) { 
    while(node) {
      EEDB::JobQueue::Job *job = new EEDB::JobQueue::Job(node);
      if(job) {
        job_count++;
        EEDB::Metadata *md;
        
        if(_parameters["format"] == "xml") {
          printf("%s\n", job->xml().c_str());
        }
        else if((_parameters["format"] == "simplexml") || (_parameters["format"] == "simple_xml")) {
          printf("%s", job->simple_xml().c_str());
        }
        else if(_parameters["format"] == "detail") {
          printf("-------------\n");
          printf("      status: %s\n", job->status().c_str());
          printf("        name: %s\n", job->display_name().c_str());
          printf(" description: %s\n", job->description().c_str());
          printf("      genome: %s\n", job->genome_name().c_str());
          printf(" upload date: %s\n", job->created_date_string().c_str());
        } else {
          printf("%7s : %40s : %s : %s\n", 
                 job->status().c_str(),
                 job->display_name().c_str(), 
                 job->genome_name().c_str(),
                 job->created_date_string().c_str());
        }        
      }
      node = node->next_sibling("job");
    }    
  } 
  printf("%ld active upload jobs\n", job_count);
  
  free(chunk.memory);
  doc.clear();
  
}


////////////////////////////////////////////////////////////////////////////
//
// delete & share methods
//
////////////////////////////////////////////////////////////////////////////


bool  share_upload(string source_id) {
  if(_parameters.find("_collab_uuid") == _parameters.end()) { return false; }              
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>sharedb</mode>";
  paramXML += "<sharedb>"+ source_id +"</sharedb>";  
  paramXML += "<collaboration_uuid>"+_parameters["_collab_uuid"]+"</collaboration_uuid>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_user.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<share_uploaded_database");
  if(!start_ptr) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 
  
  /*
  rapidxml::xml_node<> *errornode = root_node->first_node("upload_error");
  if(errornode) {
    fprintf(stderr, "ERROR: %s\n", errornode->value());
    return false;
  }
  
  rapidxml::xml_node<> *node = root_node->first_node("deleted");
  if(node) {
    rapidxml::xml_node<> *node2 = node->first_node("peer");
    if(node2) {
      EEDB::Peer *peer = EEDB::Peer::new_from_xml(node2);
      if(peer) { printf("deleted :: %s\n", peer->xml().c_str()); }
    }
  }
  */
  
  free(chunk.memory);
  doc.clear();
  return true;
}


bool  delete_upload() {
  if(!_user_profile) { return false; }
  
  //
  //check file, get file size
  //
  if(_parameters.find("_delete_id") == _parameters.end()) {
    printf("\nERROR: must specify -delete id/name of upload\n\n");
    return false;
  }

  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>delete</mode>";
  paramXML += "<deletedb>"+_parameters["_delete_id"]+"</deletedb>";  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_upload.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<upload");
  if(!start_ptr) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 
  
  rapidxml::xml_node<> *errornode = root_node->first_node("upload_error");
  if(errornode) {
    fprintf(stderr, "ERROR: %s\n", errornode->value());
    return false;
  }

  rapidxml::xml_node<> *node = root_node->first_node("deleted");
  if(node) {
    rapidxml::xml_node<> *node2 = node->first_node("peer");
    if(node2) {
      EEDB::Peer *peer = EEDB::Peer::new_from_xml(node2);
      if(peer) { printf("deleted :: %s\n", peer->xml().c_str()); }
    }
  }
  
  free(chunk.memory);
  doc.clear();
  
  return true;
}


//-------------------------------------------------------------------
//
// metadata editing section
//
//-------------------------------------------------------------------

void append_metadata_edit_command(string id_filter, string mode, string tag, string newvalue, string oldvalue) {  
  //first get the source_ids which we will later use to configure FederatedSourceStream
  
  if(mode.empty()) { return; }
  if(tag.empty() and newvalue.empty()) { return; }
  
  EEDB::mdedit_t edit_cmd;
  edit_cmd.mode = mode;
  edit_cmd.tag  = tag;
  
  //determine if id_filter is id or filter
  string uuid, objClass;
  long int objID;  
  MQDB::unparse_dbid(id_filter, uuid, objID, objClass);
  if(uuid.empty()) {
    edit_cmd.obj_filter = id_filter;
  } else {
    edit_cmd.db_id = id_filter;
  }  
  
  if(edit_cmd.mode == "change") {
    edit_cmd.oldvalue = oldvalue;
    edit_cmd.newvalue = newvalue;
  } else {
    edit_cmd.newvalue = newvalue;
  }
  
  //post filters to avoid bad commands
  if(edit_cmd.tag.empty()) { return; }
  //if(edit_cmd.tag == "eedb:name") { return; }  //might need this
  
  if(edit_cmd.tag == "eedb:assembly_name") { return; }
  if(edit_cmd.tag == "assembly_name") { return; }
  if(edit_cmd.tag == "genome_assembly") { return; }
  
  if(edit_cmd.tag == "uuid") { return; }
  if(edit_cmd.tag == "eedb:owner_nickname") { return; }
  if(edit_cmd.tag == "eedb:owner_OpenID") { return; }
  if(edit_cmd.tag == "eedb:owner_email") { return; }
  if(edit_cmd.tag == "configXML") { return; }
  if(edit_cmd.tag == "eedb:configXML") { return; }
  
  _mdata_edit_commands.push_back(edit_cmd);
}


bool send_mdata_edit_commands() {
  if(!_user_profile) { return false; }
  if(_mdata_edit_commands.empty()) { return true; } //nothing to do
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;       // no data at this point
  chunk.alloc_size = 0; // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(_user_profile) {
    paramXML += "<authenticate><email>"+ _user_profile->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }  
  
  paramXML += "<mode>search_edit_metadata</mode>";
  
  if(_parameters.find("filter") != _parameters.end()) {
    paramXML += "<filter>" + _parameters["filter"] + "</filter>";
  }
  
  paramXML += "<mdata_edit_commands>";
  vector<EEDB::mdedit_t>::iterator  edit_cmd;
  for(edit_cmd = _mdata_edit_commands.begin(); edit_cmd != _mdata_edit_commands.end(); edit_cmd++) {
    paramXML += "<edit mode=\"" + edit_cmd->mode +"\"";
    if(!edit_cmd->db_id.empty()) {
      paramXML += " id=\"" + html_escape(edit_cmd->db_id) +"\""; 
    }
    if(!edit_cmd->obj_filter.empty()) {
      paramXML += " filter=\"" + html_escape(edit_cmd->obj_filter) +"\""; 
    }
    if(!edit_cmd->tag.empty()) { 
      paramXML += " tag=\"" + html_escape(edit_cmd->tag) +"\""; 
    }
    paramXML += ">";
    if(edit_cmd->mode == "change") {
      if(!edit_cmd->oldvalue.empty()) { paramXML += "<old>" + html_escape(edit_cmd->oldvalue) +"</old>"; }
      if(!edit_cmd->newvalue.empty()) { paramXML += "<new>" + html_escape(edit_cmd->newvalue) +"</new>"; }        
    } else {
      if(!edit_cmd->newvalue.empty()) { paramXML += html_escape(edit_cmd->newvalue); }
    }
    paramXML += "</edit>";        
  }
  paramXML += "</mdata_edit_commands>";
  
  paramXML += "</zenbu_query>";
  
  fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _parameters["_url"] + "/cgi/eedb_user.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(_user_profile) {
    string key = _user_profile->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  fprintf(stderr, "returned-----\n%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<edit_metadata");
  if(!start_ptr) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { 
    free(chunk.memory); 
    fprintf(stderr, "ERROR: malformed webservice reply\n");
    return false; 
  } 

  /*
  rapidxml::xml_node<> *errornode = root_node->first_node("upload_error");
  if(errornode) {
    fprintf(stderr, "ERROR: %s\n", errornode->value());
    return false;
  }
  
  rapidxml::xml_node<> *node = root_node->first_node("deleted");
  if(node) {
    rapidxml::xml_node<> *node2 = node->first_node("peer");
    if(node2) {
      EEDB::Peer *peer = EEDB::Peer::new_from_xml(node2);
      if(peer) { printf("deleted :: %s\n", peer->xml().c_str()); }
    }
  }
  */

  doc.clear();
  free(chunk.memory);
  
  return true;
}


bool read_mdedit_file() {
  //
  //check file, get file size
  //
  if(_parameters.find("_mdedit_file") == _parameters.end()) {
    printf("\nERROR: must specify -mdfile <path>\n\n");
    return false;
  }
  
  int fildes = open(_parameters["_mdedit_file"].c_str(), O_RDONLY, 0x700);
  if(fildes<0) { 
    fprintf(stderr, "ERROR: unable to open file [%s]\n", _parameters["_mdedit_file"].c_str());
    return false; 
  }
  off_t file_len = lseek(fildes, 0, SEEK_END);
  lseek(fildes, 0, SEEK_SET);
  
  char* mdedit_text = (char*)malloc(file_len+1);
  memset(mdedit_text, 0, file_len+1);
  read(fildes, mdedit_text, file_len);
  //printf("config:::%s\n=========\n", mdedit_text);
  close(fildes);

  char *p1 = mdedit_text;
  char *cline = mdedit_text;
  int count=1;
  while(p1 - mdedit_text < file_len) {
    cline = p1;
    while((p1 - mdedit_text < file_len) && (*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; } 
    if(*p1 != '\0') { 
      *p1 = '\0';  //null terminate the line
    }
    p1++;
    //printf("[%d] %s\n", count++, cline);

    char *tok = strtok(cline, "\t");
    vector<string> argvals;
    while(tok!=NULL) {
      argvals.push_back(tok);
      tok = strtok(NULL, "\t");
    }
    
    string id_filter = argvals[0];
    string cmd       = argvals[1];
    
    if(cmd == "add") {
      if(argvals.size() ==4) {
        string tag   = argvals[2];
        string value = argvals[3];
        append_metadata_edit_command(id_filter, "add", tag, value, "");
      } else {
        fprintf(stderr, "ERROR -mdedit add must specify 2 additional parameters\n\n");
        usage();
      }
    }
    if(cmd == "delete") {
      if(argvals.size() ==3) {
        string tag   = argvals[2];
        append_metadata_edit_command(id_filter, "delete", tag, "", "");
      } else if(argvals.size() ==4) {
        string tag   = argvals[2];
        string value = argvals[3];
        append_metadata_edit_command(id_filter, "delete", tag, value, "");
      } else {
        fprintf(stderr, "ERROR -mdedit delete must specify either 1 or 2 additional parameters\n\n");
        usage();
      }
    }
    if(cmd == "change") {
      if(argvals.size() ==4) {
        string tag   = argvals[2];
        string value = argvals[3];
        append_metadata_edit_command(id_filter, "change", tag, value, "");
      } else if(argvals.size() ==5) {
        string tag   = argvals[2];
        string value = argvals[3];
        string oldvalue = argvals[4];
        append_metadata_edit_command(id_filter, "change", tag, value, oldvalue);
      } else {
        fprintf(stderr, "ERROR -mdedit change must specify either 2 or 3 additional parameters\n\n");
        usage();
      }
    }        
    if(cmd == "extract_keywords") {
      append_metadata_edit_command(id_filter, "extract_keywords", "keyword", " ", " ");
    }
  }
  //printf("generated %d commands\n", _mdata_edit_commands.size());
  
  _parameters["mode"] = "mdedit";
  return true;
}


void show_mdedit_commands() {
  //show commands
  vector<EEDB::mdedit_t>::iterator  edit_cmd;
  for(edit_cmd = _mdata_edit_commands.begin(); edit_cmd != _mdata_edit_commands.end(); edit_cmd++) {
    string paramXML = "<edit mode=\"" + edit_cmd->mode +"\"";
    if(!edit_cmd->db_id.empty()) {
      paramXML += " id=\"" + html_escape(edit_cmd->db_id) +"\""; 
    }
    if(!edit_cmd->obj_filter.empty()) {
      paramXML += " filter=\"" + html_escape(edit_cmd->obj_filter) +"\""; 
    }
    if(!edit_cmd->tag.empty()) { 
      paramXML += " tag=\"" + html_escape(edit_cmd->tag) +"\""; 
    }
    paramXML += ">";
    if(edit_cmd->mode == "change") {
      if(!edit_cmd->oldvalue.empty()) { paramXML += "<old>" + html_escape(edit_cmd->oldvalue) +"</old>"; }
      if(!edit_cmd->newvalue.empty()) { paramXML += "<new>" + html_escape(edit_cmd->newvalue) +"</new>"; }        
    } else {
      if(!edit_cmd->newvalue.empty()) { paramXML += html_escape(edit_cmd->newvalue); }
    }
    paramXML += "</edit>";
    printf("%s\n", paramXML.c_str());
  }  
}


