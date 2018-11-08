/* $Id: zenbu_ncbi_genome_load.cpp,v 1.1 2016/10/12 07:10:07 severin Exp $ */

/****
 
 NAME
 
 zenbu_ncbi_genome_load - DESCRIPTION of Object
 
 DESCRIPTION

 tool to access the NCBI webservices to provide a completely automated method of
 searching for an loading genomes into ZENBU. uses new ZDX databases along with 
 sqlite to store as files rather than rely on a mysql databases like the previous perl code 
 
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
#include <rapidxml_print.hpp>  //rapidxml must be include before boost
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>
#include <boost/algorithm/string.hpp>

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
#include <EEDB/Feature.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/Paraclu.h>
#include <EEDB/SPStreams/NeighborCutoff.h>
#include <EEDB/SPStreams/CalcFeatureSignificance.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/SPStreams/MannWhitneyRanksum.h>
#include <EEDB/SPStreams/OverlapMerge.h>

#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/Tools/LSArchiveImport.h>
#include <EEDB/WebServices/RegionServer.h>
#include <EEDB/WebServices/UploadServer.h>
#include <EEDB/WebServices/UserSystem.h>

#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>

#include <EEDB/JobQueue/UploadFile.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>               _parameters;
double                           _load_limit = 0.9;
EEDB::User*                      _user_profile=NULL;
EEDB::WebServices::MetaSearch*   _webservice;


void        usage();
bool        get_cmdline_user();
void        ncbi_genome_load();

int main(int argc, char *argv[]) {

  //seed random with usec of current time
  struct timeval  starttime;
  gettimeofday(&starttime, NULL);
  srand(starttime.tv_usec);

  if(argc==1) { usage(); }

  _webservice = new EEDB::WebServices::MetaSearch();
  _webservice->parse_config_file("/etc/zenbu/zenbudev_config.xml");
  _webservice->init_service_request();

  get_cmdline_user();
  if(!_user_profile) {
    printf("\nERROR: unable to read your ~/.zenbu/id_hmac file to identify your login identify. Please create file according to documentation.\nhttps://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/Data_loading#Bulk_command-line_upload_of_datafiles\n\n");
    usage();
  }

  for(int argi=1; argi<argc; argi++) {
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    
    vector<string> argvals;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      argvals.push_back(argv[argi]);
    }
    
    if(arg == "-help")   { usage(); }
    if(arg == "-debug")         { _parameters["debug"] = "true"; }
    if(arg == "-mode")          { _parameters["mode"] = argvals[0]; }
    if(arg == "-i")             { _parameters["mode"] = "load_genome"; }
    if(arg == "-search")        { 
      _parameters["mode"] = "load_genome";
      _parameters["search"] = argvals[0];
    }

    if(arg == "-name_mode")     { _parameters["name_mode"] = argvals[0]; }
  }

  
  //execute the mode
  if(_parameters["mode"] == "load_genome") {
    ncbi_genome_load(); 
  }
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_ncbi_genome_load [options]\n");
  printf("  -help                     : printf(this help\n");
  printf("  -name_mode <value>        : ucsc, ncbi, or ensembl naming convention\n");
}


void ncbi_genome_load() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, string>                   library_ids;
  map<string, EEDB::Experiment*>        ctss_experiments;
  map<string, EEDB::Experiment*>        remap_experiments;

  printf("\n====== ncbi_genome_load == \n");
  gettimeofday(&starttime, NULL);
  printf("name_mode [%s]\n", _parameters["name_mode"].c_str());

  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  //EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();

  //webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  //webservice->parse_config_file("/etc/zenbu/zenbudev_config.xml");
  //webservice->init_service_request();

  MQDB::Database *userdb = _webservice->userDB();
  //printf("%s\n", userdb->xml().c_str());

  //fprintf(stderr, "%s\n", _user_profile->xml().c_str());
  //_webservice->set_user_profile(_user_profile);

  _webservice->postprocess_parameters(); //must do after all init and setting of user
  //if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  EEDB::JobQueue::UploadFile *uploader = new EEDB::JobQueue::UploadFile();
  uploader->userDB(userdb);
  //uploader->set_parameter("genome_name_mode", "ensembl");
  uploader->set_parameter("genome_name_mode", _parameters["name_mode"]);

  EEDB::Peer*  peer = NULL;
  //EEDB::Peer*  peer = uploader->load_genome_from_NCBI(ncbi_acc);
  //peer = uploader->load_genome_from_NCBI("canFam3");
  //peer = uploader->load_genome_from_NCBI("rn6");
  //peer = uploader->load_genome_from_NCBI("felCat8");

  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("canfam3");
  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("rattus");
  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("homo");

  //MQDB::Database *gdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@fantom46.gsc.riken.jp:3306/zenbu_genome_9544_GCF_000772875_2_Mmul_801_rheMac8");

  vector<EEDB::Assembly*> assembly_array;
  printf("enter genome search> ");
  char buffer[1024];
  if(fgets(buffer, 1024 , stdin) != NULL) {
    char* p1 = index(buffer, '\n');
    if(p1 != NULL) { *p1 = '\0'; }
    vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search(buffer);
    for(int j=0; j<assembly_array.size(); j++) {
      printf("%s\n", assembly_array[j]->xml().c_str());
      //if(assembly_array[j]->ucsc_name().empty()) { continue; }
      printf("load this genome? ");
      if((fgets(buffer, 1024 , stdin) != NULL) && (buffer[0] == 'y')) {
        //assembly_array[j]->store(gdb);
        //assembly_array[j]->taxon()->store(gdb);
        peer = uploader->load_genome_from_NCBI(assembly_array[j]->ncbi_assembly_accession());
      }
    }
  }
  printf("%d assemblies returned\n", assembly_array.size());

  //peer = uploader->load_genome_from_NCBI("canFam3");
  //peer = uploader->load_genome_from_NCBI("rn6");
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

  MQDB::Database *userdb = _webservice->userDB();
  printf("%s\n", userdb->xml().c_str());

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

  string email = strtok(config_text, " \t\n");
  string secret = strtok(NULL, " \t\n");

  free(config_text);
  close(fildes);

  printf("user [%s] -> [%s]\n", email.c_str(), secret.c_str());

  //_user_profile = new EEDB::User();
  //if(email)  { _user_profile->email_address(email); }
  //if(secret) { _user_profile->hmac_secretkey(secret); }

  EEDB::User *user = EEDB::User::fetch_by_email(userdb, email);
  if(user && user->hmac_secretkey() == secret) {
    _user_profile = user;
    fprintf(stderr, "%s\n", user->xml().c_str());
    _webservice->set_user_profile(_user_profile);
    return true;
  }

  return false;
}


