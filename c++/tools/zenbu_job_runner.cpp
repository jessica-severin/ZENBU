/* $Id: zenbu_job_runner.cpp,v 1.16 2016/08/29 05:56:51 severin Exp $ */

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
#include <string>
#include <iostream>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
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
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/JobQueue/Job.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/JobQueue/UploadFile.h>


#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>          _parameters;
EEDB::WebServices::WebBase  *webservice;

void usage();

string exec_cmd(const char *cmd);
void  run_job_from_queue();
void  run_job_id(long jobid);
bool  check_overload();
void  get_worker_stats();

int main(int argc, char *argv[]) {

  //seed random with usec of current time
  struct timeval  starttime;
  gettimeofday(&starttime, NULL);
  srand(starttime.tv_usec);

  get_worker_stats();

  if(argc==1) { usage(); }

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
    
    if(arg == "-mode")          { _parameters["mode"] = argvals[0]; }

    if(arg == "-file")          { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-f")             { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-hashkey")       { _parameters["hashkey"] = argvals[0]; }
    if(arg == "-buildtime")     { _parameters["buildtime"] = argvals[0]; }
    if(arg == "-jobid")         { _parameters["jobid"] = argvals[0]; _parameters["mode"] = "jobid"; }
    
    if(arg == "-assembly")      { _parameters["asmb"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["asmb"] = argvals[0]; }
    if(arg == "-asmb")          { _parameters["asmb"] = argvals[0]; }
    if(arg == "-assembly_name") { _parameters["asmb"] = argvals[0]; }
    if(arg == "-chr")           { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom")         { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom_name")    { _parameters["chrom"] = argvals[0]; }
    if(arg == "-start")         { _parameters["start"] = argvals[0]; }
    if(arg == "-end")           { _parameters["end"] = argvals[0]; }

    if(arg == "-sources")       { _parameters["mode"] = "sources"; }
    if(arg == "-experiments")   { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-fsrc")          { _parameters["mode"] = "sources"; _parameters["source"] = "FeatureSource"; }
    if(arg == "-chroms")        { _parameters["mode"] = "chroms"; }
    if(arg == "-repair")        { _parameters["mode"] = "repair"; }
    if(arg == "-resetclaims")   { _parameters["mode"] = "resetclaims"; }
    if(arg == "-format")        { _parameters["format"] = argvals[0]; }
    if(arg == "-filter")        { _parameters["filter"] = argvals[0]; }
    
    if(arg == "-status")        { _parameters["mode"] = "zdxstatus"; }
    if(arg == "-fullstatus")    { _parameters["mode"] = "zdxstatus"; _parameters["show"] = "true"; }
    if(arg == "-showclaims")    { _parameters["mode"] = "showclaims"; }

    if(arg == "-run")           { _parameters["mode"] = "run_job"; }
  }

  webservice = new EEDB::WebServices::WebBase();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  
  //execute the mode
  if(_parameters["mode"] == "run_job") {
    run_job_from_queue();
  } else if(_parameters["mode"] == "jobid") {
    long jobid = strtol(_parameters["jobid"] .c_str(), NULL, 10);
    run_job_id(jobid);
  } else {
    usage();
  }
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_job_runner [options]\n");
  printf("  -help                     : printf(this help\n");
  printf("  -run                      : autorun next job from queue system\n");
  printf("  -jobid <db_id>            : run specified job by database id (adminstrator)\n");
  printf("zenbu_job_runner v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


/////////////////////////////////////////////////////////////////////////////////////////////////
//
// main functions
//
/////////////////////////////////////////////////////////////////////////////////////////////////


void  run_job_from_queue() {
  if(check_overload()) { return; }
  
  MQDB::Database *userDB = webservice->userDB();
  if(!userDB) { return; }
  
  string claim_uuid = uuid_hexstring();
  
  char host[1024];
  bzero(host, 1024);
  gethostname(host, 1024);
  
  pid_t pid = getpid();

  //for now first-come-first-serve logic
  const char *sql = "UPDATE job SET job_claim=?, status='CLAIMED' WHERE job_claim='' and status='READY' ORDER BY job_id LIMIT 1";
  userDB->do_sql(sql, "sd", claim_uuid.c_str());
  
  sql = "SELECT job_id FROM job WHERE job_claim=? and status='CLAIMED' ORDER BY job_id limit 1";
  dynadata jobXML = userDB->fetch_col_value(sql, "s", claim_uuid.c_str());
  if(jobXML.i_int == -1) { 
    //no job claimed
    return; 
  }
  long job_id = jobXML.i_int;
  
  sql = "UPDATE job SET status='RUN', host=?, process_id=? WHERE job_id=?";
  userDB->do_sql(sql, "sdd", host, pid, job_id);
  
  bool rtn=false;
  try {
    //for now it hardcodes the file upload jobs, but will change eventually
    EEDB::JobQueue::UploadFile *uploader = new EEDB::JobQueue::UploadFile();
    uploader->userDB(userDB);
    
    rtn = uploader->process_upload_job(job_id);
  }
  catch (int e) {
    rtn = false;
    //cout << "An exception occurred. Exception Nr. " << e << endl;
  }
  
  
  if(rtn) {
    sql = "UPDATE job SET status='DONE', completed=NOW() WHERE job_id=?";
    userDB->do_sql(sql, "d", job_id);
  } else {
    sql = "UPDATE job SET status='FAILED', completed=NOW() WHERE job_id=?";
    userDB->do_sql(sql, "d", job_id);
  }
  
}


void  run_job_id(long job_id) {  
  MQDB::Database *userDB = webservice->userDB();
  if(!userDB) { return; }
  
  string claim_uuid = uuid_hexstring();
  
  char host[1024];
  bzero(host, 1024);
  gethostname(host, 1024);
  
  pid_t pid = getpid();

  //forces job to reset and run
  const char *sql = "UPDATE job SET job_claim=?, status='RUN', host=?, process_id=? WHERE job_id=?";
  userDB->do_sql(sql, "ssdd", claim_uuid.c_str(), host, pid, job_id);
    
  bool rtn=false;
  try {
    //for now it hardcodes the file upload jobs, but will change eventually
    EEDB::JobQueue::UploadFile *uploader = new EEDB::JobQueue::UploadFile();
    uploader->userDB(userDB);
    
    rtn = uploader->process_upload_job(job_id);
  }
  catch (int e) {
    rtn = false;
    //cout << "An exception occurred. Exception Nr. " << e << endl;
  }
  
  
  if(rtn) {
    sql = "UPDATE job SET status='DONE', completed=NOW() WHERE job_id=?";
    userDB->do_sql(sql, "d", job_id);
  } else {
    sql = "UPDATE job SET status='FAILED' WHERE job_id=?";
    userDB->do_sql(sql, "d", job_id);
  }
  
}


//////////////////////////////////////////////////////////////////////////////////////


std::string exec_cmd(const char* cmd) {
    FILE* pipe = popen(cmd, "r");
    if (!pipe) return "ERROR";
    char buffer[128];
    std::string result = "";
    while(!feof(pipe)) {
      if(fgets(buffer, 128, pipe) != NULL) { result += buffer; }
    }
    pclose(pipe);
    return result;
}


bool check_overload() {
  string str1 = exec_cmd("grep 'model name' /proc/cpuinfo | wc -l");
  if(str1.empty()) { return false; } //can not calculate so just run 
  long proc_count = strtol(str1.c_str(), NULL, 10);
  if(proc_count<=0) { return false; }

  string str2 = exec_cmd("cat /proc/loadavg | cut -f1 -d' '");
  if(str2.empty()) { return false; } //can not calculate so just run 
  double loadavg = strtod(str2.c_str(), NULL);

  string str3 = exec_cmd("ps aux | grep zenbu_job_runner | grep -v grep|wc -l");
  long builders = strtol(str3.c_str(), NULL, 10);
  
  if(loadavg/proc_count > 1.0) { 
    fprintf(stderr, "system overload\n");
    return true; 
  }

  long builder_max = (long)floor((proc_count * 0.3) + 0.5);
  if(builder_max<1) { builder_max=1; }
  if(builders > builder_max) {
    fprintf(stderr, "system overload %ld job_runners now\n", builders);
    return true;
  }

  return false;  //no worries
}


//////////////////////////////////////////////////////////////////////////////////////


void get_worker_stats() {
  //test of appropriate data to track workers and failures

  char host[1024];
  bzero(host, 1024);
  gethostname(host, 1024);
  printf("zenbu_job_runner host [%s]\n", host);
}
