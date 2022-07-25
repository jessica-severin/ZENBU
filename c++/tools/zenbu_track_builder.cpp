/* $Id: zenbu_track_builder.cpp,v 1.76 2022/07/08 03:21:43 severin Exp $ */

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
#include <rapidxml_print.hpp>  //rapidxml must be include before boost
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
#include <EEDB/TrackRequest.h>
#include <EEDB/Tools/TrackCacheBuilder.h>
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>


#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>        _parameters;
double                    _load_limit = 0.9;

void usage();

string exec_cmd(const char *cmd);
void zdx_read_sources();
void build_trackcache();
void show_zdx_status();
void access_check_trackcache(string hashkey);
void repair_trackcache(string hashkey);
bool check_overload();
//void clear_rogue_claims();
void show_claims();
void get_worker_stats();
void show_zdx_buildstats();
void trackcache_buildstats(EEDB::TrackCache* trackcache);
void trackcache_segment_stats(ZDXdb* zdxdb);
void repair_segments(ZDXdb* zdxdb);
void show_zdx_region();

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
    
    if(arg == "-debug")         { _parameters["debug"] = "true"; }
    if(arg == "-mode")          { _parameters["mode"] = argvals[0]; }

    if(arg == "-file")          { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-f")             { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-hashkey")       { _parameters["hashkey"] = argvals[0]; }
    if(arg == "-buildtime")     { _parameters["buildtime"] = argvals[0]; }
    if(arg == "-loadlimit")     { _load_limit = strtod(argvals[0].c_str(), NULL); }
    if(arg == "-force")         { _parameters["forcerun"] = "true"; }

    if(arg == "-reqid")         { _parameters["reqid"] = argvals[0]; }
    
    if(arg == "-assembly")      { _parameters["asmb"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["asmb"] = argvals[0]; }
    if(arg == "-asmb")          { _parameters["asmb"] = argvals[0]; }
    if(arg == "-assembly_name") { _parameters["asmb"] = argvals[0]; }
    if(arg == "-chr")           { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom")         { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom_name")    { _parameters["chrom"] = argvals[0]; }
    if(arg == "-start")         { _parameters["start"] = argvals[0]; }
    if(arg == "-end")           { _parameters["end"] = argvals[0]; }

    if(arg == "-region")        { _parameters["mode"] = "region"; _parameters["chrom_loc"] = argvals[0]; }

    if(arg == "-sources")       { _parameters["mode"] = "sources"; }
    if(arg == "-fullsources")   { _parameters["mode"] = "sources"; _parameters["format"] = "fullxml";}
    if(arg == "-experiments")   { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-fsrc")          { _parameters["mode"] = "sources"; _parameters["source"] = "FeatureSource"; }
    if(arg == "-chroms")        { _parameters["mode"] = "chroms"; }
    if(arg == "-repair")        { _parameters["mode"] = "repair"; }
    if(arg == "-check")         { _parameters["mode"] = "check"; }
    if(arg == "-resetclaims")   { _parameters["mode"] = "resetclaims"; }
    if(arg == "-format")        { _parameters["format"] = argvals[0]; }
    if(arg == "-filter")        { _parameters["filter"] = argvals[0]; }
    
    if(arg == "-status")        { _parameters["mode"] = "zdxstatus"; }
    if(arg == "-fullstatus")    { _parameters["mode"] = "zdxstatus"; _parameters["show"] = "true"; }
    if(arg == "-segstatus")     { _parameters["mode"] = "zdxstatus"; _parameters["segstatus"] = "true"; }
    if(arg == "-showclaims")    { _parameters["mode"] = "showclaims"; }
    if(arg == "-buildstats")    { _parameters["mode"] = "buildstats"; }

    if(arg == "-repairsegs")    { _parameters["mode"] = "zdxstatus"; _parameters["repairsegs"] = "true"; }

    if(arg == "-build")         { _parameters["mode"] = "build_track"; }
    if(arg == "-test")          { _parameters["mode"] = "build_track"; _parameters["testbuild"] = "true"; }
    if(arg == "-configXML")     { _parameters["mode"] = "zdxstatus"; _parameters["configXML"] = "true"; }

    if(arg == "-export_subfeatures")           { _parameters["export_subfeatures"] = "true"; }
    if(arg == "-export_experiment_metadata")   { _parameters["export_experiment_metadata"] = "true"; }
    if(arg == "-export_osc_metadata")          { _parameters["export_osc_metadata"] = "true"; }
    if(arg == "-export_feature_metadata")      { _parameters["export_feature_metadata"] = "true"; }
    if(arg == "-exptype")                      { _parameters["exptype"] = argvals[0]; }
  }

  if(_parameters.find("mode") == _parameters.end() && 
     (_parameters.find("hashkey") != _parameters.end() ||
      _parameters.find("reqid") != _parameters.end())) {
     _parameters["mode"] = "build_track"; 
  }
  
  //execute the mode
  if(_parameters["mode"] == "sources") {
    zdx_read_sources();
  }
  if(_parameters["mode"] == "build_track") {
    build_trackcache();
  }
  if(_parameters["mode"] == "zdxstatus") {
    show_zdx_status();
  }
  if(_parameters["mode"] == "check") {
    access_check_trackcache(_parameters["hashkey"]);
  }
  if(_parameters["mode"] == "repair") {
    repair_trackcache(_parameters["hashkey"]);
  }
  if(_parameters["mode"] == "resetclaims") {
    //clear_rogue_claims();
    show_claims();
  }
  if(_parameters["mode"] == "showclaims") {
    show_claims();
  }
  if(_parameters["mode"] == "buildstats") {
    show_zdx_buildstats();
  }
  if(_parameters["mode"] == "region") {
    show_zdx_region();
  }
  
  
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_track_builder [options]\n");
  printf("  -help                     : printf(this help\n");
  printf("  -file <path>              : path to a ZDX file\n");
  printf("  -hashkey <hashkey>        : trackcache to build via hashkey\n");
  printf("  -reqid <db_id>            : build specific request by database id (adminstrator)\n");
  printf("  -status                   : display build status of track\n");
  printf("  -fullstatus               : display build status of track with details of segments\n");
  printf("  -buildstats               : display details on zdx segment build statistics\n");
  printf("  -segstatus                : display details on every zdx segment\n");
  printf("  -configXML                : display track configuration XML\n");
  printf("  -sources                  : display sources/peers cached in the track\n");
  printf("  -fullsources              : display full configXML, sources, peers information in the track\n");
  printf("  -build                    : autobuild track cache segments upto buildtime\n");
  printf("  -buildtime                : max build time for autobuilding (default 3min)\n");
  printf("  -loadlimit                : max percent of system track builders are allowed to use (default 0.9)\n");
  printf("  -showclaims               : display all trackcache which have active worker/claims\n");
  printf("  -resetclaims              : clear 'rougue' claims for failed workers\n");
  printf("  -repair                   : repair a trackcache, build segments and load missing sources\n");
  printf("  -region <chrom_loc>       : make region query into cache/zdx-file\n");
  printf("    -export_subfeatures      : region query output subfeatures\n");
  printf("    -export_experiment_metadata : region query output experiment metadata in OSC header\n");
  printf("    -export_osc_metadata     : region query output osc metadata\n");
  printf("    -export_feature_metadata : region query output feature metadata\n");
  printf("  -format <type>            : display output in : fullxml, simplexml, gff, bed, osc\n");
  printf("zenbu_track_builder v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


/////////////////////////////////////////////////////////////////////////////////////////////////
//
// main functions
//
/////////////////////////////////////////////////////////////////////////////////////////////////


void zdx_read_sources() {
  struct timeval                        starttime,endtime,difftime;
  
  printf("\n=== read_sources ====\n");
  
  EEDB::TrackCache*     trackcache = NULL;
  EEDB::ZDX::ZDXstream* zdxstream  = NULL;
  ZDXdb*                zdxdb      = NULL;
  
  if(_parameters.find("hashkey") != _parameters.end()) {
    EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
    trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
    trackbuilder->init_service_request();
    trackbuilder->init_from_track_cache(_parameters["hashkey"]);
    trackbuilder->postprocess_parameters();
    
    trackcache = trackbuilder->track_cache();
    if(!trackcache) { return; }
    
    zdxstream = trackcache->zdxstream();
    zdxdb = zdxstream->zdxdb();
    
    //string configXML = trackcache->track_configxml();
    //printf("%s\n", configXML.c_str());
  }
  else if(_parameters.find("_input_file") != _parameters.end()) {  
    zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);
    zdxdb = zdxstream->zdxdb();
  }
  
  if(!zdxstream || !zdxdb) { return; }
  
    
  gettimeofday(&starttime, NULL);
  
  //peers
  long peer_count=0;
  zdxstream->stream_peers();
  while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    peer_count++;
    printf("%s\n", peer->xml().c_str());
  }

  //DataSources
  long source_count=0;
  zdxstream->stream_data_sources(_parameters["source"], _parameters["filter"]);
  while(EEDB::DataSource *source = (EEDB::DataSource*)zdxstream->next_in_stream()) {
    if(source->classname() == EEDB::Assembly::class_name) { continue; }
    if(_parameters["format"] == "fullxml") {
      printf("%s", source->xml().c_str());
    } else {
      printf("%s", source->simple_xml().c_str());
    }
    source_count++;
  }
  
  //genomes
  long genome_count=0;
  zdxstream->stream_chromosomes("", "");
  while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
    if(obj->classname() == EEDB::Assembly::class_name) {
      EEDB::Assembly *asmb = (EEDB::Assembly*)obj;
      printf("%s", asmb->xml().c_str());
      genome_count++;
      if(_parameters["format"] == "fullxml") {
        vector<EEDB::Chrom*> chroms = asmb->get_chroms();
        printf("[%s] %ld chroms\n", asmb->assembly_name().c_str(), chroms.size());
        for(unsigned int j=0; j<chroms.size(); j++) {
          EEDB::Chrom *chrom = chroms[j];
          printf("   %s\n", chrom->xml().c_str());
        }
      }
    }
  }

  if((_parameters["format"] == "fullxml") && trackcache) {
    string configXML = trackcache->track_configxml();
    printf("%s\n", configXML.c_str());
  }


  printf("%ld peers\n", peer_count);
  printf("%ld genomes\n", genome_count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  if(difftime.tv_sec ==0) {
    printf("%ld sources in %1.6f msec \n", source_count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  } else {
    printf("%ld sources in %1.6f sec \n", source_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  }
}


void build_trackcache() {
  if(check_overload()) { return; }

  struct timeval      starttime,endtime,difftime;  
  char buffer[2048];
  gettimeofday(&starttime, NULL);  

  bool testbuild = false;
  if(_parameters.find("testbuild")!=_parameters.end()) { testbuild=true; }

  gettimeofday(&starttime, NULL);  

  EEDB::TrackRequest *request = NULL;
  // get Track TrackCacheBuilder/
  EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
  trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");

  if(_parameters.find("reqid")!=_parameters.end()) {
    long reqid = strtol(_parameters["reqid"].c_str(), NULL, 10);
    EEDB::TrackRequest *trackreq = EEDB::TrackRequest::fetch_by_id(trackbuilder->userDB(), reqid);
    if(trackreq) {
      printf("%s\n", trackreq->xml().c_str());
      trackbuilder->init_from_track_cache(trackreq->track_hashkey());
      trackbuilder->set_parameter("reqid", _parameters["reqid"]);
    }
  } else if(_parameters.find("hashkey")!=_parameters.end()) {
    trackbuilder->init_from_track_cache(_parameters["hashkey"]);
  } else {
    string hashkey = EEDB::TrackCache::best_build_hashkey(trackbuilder->userDB());
    if(hashkey.empty()) { return; }
    fprintf(stderr, "best hashkey [%s]\n", hashkey.c_str());
    trackbuilder->init_from_track_cache(hashkey);
  }

  if(_parameters.find("chrom")!=_parameters.end()) {
    trackbuilder->set_parameter("chrom_name", _parameters["chrom"]);
  }
  if(_parameters.find("asmb")!=_parameters.end()) {
    trackbuilder->set_parameter("assembly_name", _parameters["asmb"]);
  }
  if(_parameters.find("start")!=_parameters.end()) {
    trackbuilder->set_parameter("chrom_start", _parameters["start"]);
  }
  if(_parameters.find("end")!=_parameters.end()) {
    trackbuilder->set_parameter("chrom_end", _parameters["end"]);
  }

  if(_parameters.find("buildtime")!=_parameters.end()) {
    trackbuilder->set_parameter("max_track_build_seconds", _parameters["buildtime"]);
  }
  trackbuilder->postprocess_parameters();

  EEDB::TrackCache*     trackcache = trackbuilder->track_cache();
  if(!trackcache) { 
    printf("error problem with track cache\n");
    return;
  }
  if(testbuild) { fprintf(stderr, "trackcache fetched\n"); }

  EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
  ZDXdb*                zdxdb = zdxstream->zdxdb();
  if(testbuild) { fprintf(stderr, "have stream\n"); }

  if(!testbuild) {
    double  completed = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, false);
    if(completed == 1.0) {
      printf("track cache [%s] completed\n", trackcache->track_hashkey().c_str());
      trackcache->update_buildstats(0, 0.0);
      return;
    }
  }

  if(!trackbuilder->security_check()) {
    printf("security error with track cache [%s]\n", trackcache->track_hashkey().c_str());
    return;
  }
  if(testbuild) { fprintf(stderr, "security ok\n"); }

  // test if we need to rebuild the sources
  zdxstream->stream_data_sources();  //forces a reload if needed
  if(zdxstream->next_in_stream() == NULL) {
    //no sources on the stream so rebuild
    trackbuilder->build_trackcache_sources();
  }
 
  //string configXML = trackcache->track_configxml();
  //printf("%s\n", configXML.c_str());
  
  printf("=== build_trackcache %s\n", trackcache->track_hashkey().c_str());

  if(testbuild) {
    trackbuilder->testbuild_region();
  } else {
    trackbuilder->autobuild_track_cache();
  }
  
  trackbuilder->disconnect();  
}


void access_check_trackcache(string hashkey) {
  printf("=== access_check_trackcache [%s]\n", hashkey.c_str());
  struct timeval      starttime,endtime,difftime;  
  
  // get Track TrackCacheBuilder
  EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
  trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
  trackbuilder->init_from_track_cache(hashkey);
  
  EEDB::TrackCache*     trackcache = trackbuilder->track_cache();
  EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
  ZDXdb*                zdxdb = zdxstream->zdxdb();
  
  if(!trackbuilder->security_check()) {
    printf("ERROR: missing data sources in track_cache [%s]\n", trackcache->track_hashkey().c_str());
  }

  zdxdb->disconnect();
  trackbuilder->disconnect();  
}



void repair_trackcache(string hashkey) {
  printf("=== repair_trackcache [%s]\n", hashkey.c_str());
  struct timeval      starttime,endtime,difftime;  
  
  // get Track TrackCacheBuilder
  EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
  trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
  trackbuilder->init_from_track_cache(hashkey);
  
  EEDB::TrackCache*     trackcache = trackbuilder->track_cache();
  EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
  ZDXdb*                zdxdb = zdxstream->zdxdb();
  
  if(!trackbuilder->security_check()) {
    printf("security error with track cache [%s]\n", trackcache->track_hashkey().c_str());
    return;
  }

  trackbuilder->build_trackcache_sources();

  if(_parameters.find("configXML") != _parameters.end()) {
    string configXML = trackcache->track_configxml();
    printf("%s\n", configXML.c_str());

    EEDB::SPStream *stream = trackbuilder->trackbuilder_stream();
    printf("======\n%s\n", stream->xml().c_str());
  }
  
  zdxdb->disconnect();
  trackbuilder->disconnect();  
}


void repair_segments(ZDXdb* zdxdb) {
  char                 buffer[2048];  
  if(!zdxdb) { return; }
  
  printf("=== repair_segments [%65s]\n", zdxdb->path().c_str());
  
  // get chroms
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  //printf("trackcache_segment_stats %ld chroms\n", chroms.size());
  
  bool debug=false;
  if(_parameters["debug"] == "true") { debug=true; }
  //now process each chrom
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    
    EEDB::Chrom *chrom = (*chr_it);
    EEDB::ZDX::ZDXsegment* segment = EEDB::ZDX::ZDXsegment::fetch(zdxdb, chrom->assembly_name(), chrom->chrom_name(), -1);
    if(!segment) { continue; }
    
    //printf("segment_stats [%s] %ld\n", chrom->fullname().c_str(), segment->segment_size());
    long count=0;
    while(segment) {
      if(debug) {
        printf("%30s %10ld .. %10ld",  chrom->fullname().c_str(), segment->chrom_start(), segment->chrom_end());
        printf(" [%5ld]", count++);
      }

      if(!segment->is_built()) { 
        if(debug) { printf(" not built\n"); }
        EEDB::ZDX::ZDXsegment* seg = segment->next_segment();
        segment->release();
        segment = seg;
        continue;
      }

      segment->extend_chrom_end(-1);  //reset to start+segment_size

      //stream features from segment and update chrom_end
      segment->stream_region(-1, -1);
      EEDB::Feature *feature = (EEDB::Feature*)segment->next_in_stream();
      while(feature) {
        if(feature->chrom_end() > segment->chrom_end()) {
          if(debug) { printf(" EXTEND %ld", feature->chrom_end()); }
          segment->extend_chrom_end(feature->chrom_end());
        }
        feature->release();
        feature = (EEDB::Feature*)segment->next_in_stream();
      }
      if(debug) { printf("\n"); }
      
      EEDB::ZDX::ZDXsegment* seg = segment->next_segment();
      segment->release();
      segment = seg;
    }
  }

  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    EEDB::Chrom *chrom = (*chr_it);
    chrom->release();
  }
  
  zdxdb->disconnect();
}


//////////////////////////////////////////////////////////////////////////////////////


void show_zdx_status() {
  //find an claimed segment and clear them
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);  
  
  fprintf(stderr, "== show_zdx_status\n");
  
  EEDB::TrackCache*           trackcache = NULL;
  vector<EEDB::TrackCache*>   trackcache_array;
  long                        numsegs, numbuilt, numclaimed;
  
  bool show=false;
  if(_parameters.find("show") != _parameters.end()) { show=true; }

  if(_parameters.find("_input_file") != _parameters.end()) {  
    string name = _parameters["_input_file"];
    EEDB::ZDX::ZDXstream* zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);
    if(!zdxstream) {
      fprintf(stderr, "ERROR with track cache [%s]\n", _parameters["_input_file"].c_str());
      return;
    }
    ZDXdb* zdxdb = zdxstream->zdxdb();

    long numsegs, numbuilt, numclaimed, seg_start;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);
    long unbuilt= numsegs-numbuilt-numclaimed;
    double comp = 0;
    if(numsegs>0) { comp = 100.0 * (double)numbuilt / (double)numsegs; }
  
    if(_parameters.find("segstatus") != _parameters.end()) {
      trackcache_segment_stats(zdxdb);
    }
    if(_parameters.find("repairsegs") != _parameters.end()) {
      repair_segments(zdxdb);
    }
    
    double completed = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, show);

    printf("[%65s] %8.3f%% completed  %7ld segs %7ld remaining, [ %ld building ]\n", 
           name.c_str(), completed*100.0, numsegs, numsegs-numbuilt, numclaimed);  
    return;
  }


  if(_parameters.find("hashkey") != _parameters.end()) {
    EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
    trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
    trackbuilder->init_from_track_cache(_parameters["hashkey"]);

    EEDB::TrackCache* trackcache = trackbuilder->track_cache();
    if(!trackcache) { return; }
    trackcache_array.push_back(trackcache);;
  }
  else { 
    EEDB::WebServices::WebBase  *webservice = new EEDB::WebServices::WebBase();
    webservice->parse_config_file("/etc/zenbu/zenbu.conf");
    vector<DBObject*> tracks = EEDB::TrackCache::fetch_all(webservice->userDB());
    for(unsigned i=0; i<tracks.size(); i++) {
      EEDB::TrackCache* trackcache = (EEDB::TrackCache*)tracks[i];
      if(!trackcache) { continue; }
      if(!trackcache->cache_file_exists()) { continue; }
      trackcache_array.push_back(trackcache);;
    }
    printf("%d track caches\n", (int)trackcache_array.size());
  }

  for(unsigned i=0; i<trackcache_array.size(); i++) {
    EEDB::TrackCache* trackcache = trackcache_array[i];

    EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
    if(!zdxstream) { continue; }
    ZDXdb* zdxdb = zdxstream->zdxdb();
    if(!zdxdb) { continue; }

    string hashkey = trackcache->track_hashkey();

    long numsegs, numbuilt, numclaimed, seg_start;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);
    if(numsegs==0) {
      repair_trackcache(hashkey);
      EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);
    }
    
    if(_parameters.find("configXML") != _parameters.end()) {
      string configXML = trackcache->track_configxml();
      printf("-------\n%s\n-------\n", configXML.c_str());

      //use rapidxml to parse and prettyprint
      int   xml_len  = configXML.size();
      char* xml_text = (char*)malloc(xml_len+1);
      memset(xml_text, 0, xml_len+1);
      memcpy(xml_text, configXML.c_str(), xml_len);  
      rapidxml::xml_document<>  doc;
      doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(xml_text);
      rapidxml::print(std::cout, doc, 0);   //Print to stream using print function, specifying printing flags. 0 means default printing flags
      printf("-------\n");
      free(xml_text);
    }
    if(_parameters.find("segstatus") != _parameters.end()) {
      trackcache_segment_stats(zdxdb);
    }
    if(_parameters.find("repairsegs") != _parameters.end()) {
      repair_segments(zdxdb);
    }
    
    double completed = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, show);
    if(show) { printf("%s\n", zdxdb->path().c_str()); }

    printf("[%65s] %8.3f%% completed  %7ld segs %7ld remaining, [ %ld building ]\n", 
           hashkey.c_str(), completed*100.0, numsegs, numsegs-numbuilt, numclaimed);  

    trackcache->update_buildstats(0, 0.0);
    printf("\n");
    zdxdb->disconnect();
  }
}


//====================================================================

void trackcache_segment_stats(ZDXdb* zdxdb) {
  char                 buffer[2048];  
  if(!zdxdb) { return; }
  
  printf("=== trackcache_segment_stats [%65s]\n", zdxdb->path().c_str());

  // get chroms
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  //printf("trackcache_segment_stats %ld chroms\n", chroms.size());
  
  long numsegs = 0;
  long numbuilt = 0;
  double total_buildtime = 0;;
  double min_buildtime   = -1;
  double max_buildtime   = 0;;
  double real_starttime  = -1;
  double real_endtime    = -1;
  map<string, long> host_segcount;

  //now process each chrom
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    
    EEDB::Chrom *chrom = (*chr_it);
    EEDB::ZDX::ZDXsegment* segment = EEDB::ZDX::ZDXsegment::fetch(zdxdb, chrom->assembly_name(), chrom->chrom_name(), -1);
    if(!segment) { continue; }
    
    //printf("segment_stats [%s] %ld\n", chrom->fullname().c_str(), segment->segment_size());
    long count=0;
    while(segment) {
      numsegs++;
      //printf("  %s\n", segment->xml().c_str());
      printf("%s %10ld .. %10ld",  chrom->fullname().c_str(), segment->chrom_start(), segment->chrom_end());

      printf(" [seg %ld]", count++);
      //printf(" [%lld]", (long long)segments[seg].znode);
       
      if(segment->is_built()) { 
        printf(" built ");         
        numbuilt++;
        long feat_count=0;
        long chunk_count=0;
        segment->stream_region(-1, -1);
        while(MQDB::DBObject *obj = segment->next_in_stream()) {
          if(obj->classname() == EEDB::Feature::class_name) { feat_count++; }
          if(obj->classname() == EEDB::ChromChunk::class_name) { chunk_count++; }
          obj->release();
        }
        if(feat_count>0) { printf(" [%ld features] ", feat_count); }
        if(chunk_count>0) { printf(" [%ld chromchunks] ", chunk_count); }
      }
      else if(segment->is_claimed()) { printf(" claim "); }
      else { printf(" ----- "); }
      
      printf("\n");
      
      segment->znode_stats();

      //build time stats
      if(segment->is_built()) { 
        string hostname = segment->builder_host();
        pid_t pid = segment->builder_pid();
        double buildtime = segment->build_time_msec();
        time_t tm = (time_t)segment->build_starttime();
        printf("  build %s  pid=%d -- %7.3fmsec -- start %s", hostname.c_str(), pid, buildtime, ctime(&tm));
        if(host_segcount.find(hostname) == host_segcount.end()) { host_segcount[hostname] = 0; }
        host_segcount[hostname] += 1;

        total_buildtime += buildtime;
        if(buildtime>max_buildtime) { max_buildtime = buildtime; }
        if(min_buildtime<0 || buildtime<min_buildtime) { min_buildtime = buildtime; }

        if(real_starttime<0 || segment->build_starttime() < real_starttime) { real_starttime = segment->build_starttime(); }
        if(real_endtime<0 || segment->build_endtime() > real_endtime) { real_endtime = segment->build_endtime(); }
      }
      
      EEDB::ZDX::ZDXsegment* seg = segment->next_segment();
      segment->release();
      segment = seg;
    }
  }

  printf("build summary : %ld / %ld segments built\n", numbuilt, numsegs);  
  printf("  average %1.2fmsec, min %1.2fmsec, max avg %1.2fmsec\n", total_buildtime/numbuilt, min_buildtime, max_buildtime);

  if(total_buildtime>3600000.0) {
    printf("  %1.3f hours total buildtime\n", total_buildtime/3600000.0); 
  } else if(total_buildtime>60000.0) {
    printf("  %1.3f minutes total buildtime\n", total_buildtime/60000.0); 
  } else {
    printf("  %1.3f sec total buildtime\n", total_buildtime/1000.0); 
  }
  time_t rs = (time_t)real_starttime;
  time_t re = (time_t)real_endtime;
  printf("    start  : %s", ctime(&rs));
  printf("    finish : %s", ctime(&re));
  printf("    %1.3f sec\n", real_endtime-real_starttime);

  map<string, long>::iterator it;
  for(it=host_segcount.begin(); it!=host_segcount.end(); it++) {
    printf("  host [%s] -- %ld segs\n", (*it).first.c_str(), (*it).second);
  }
  zdxdb->disconnect();
}


//////////////////////////////////////////////////////////////////////////////////////


void show_zdx_buildstats() {
  //find an claimed segment and clear them
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);  
  
  //fprintf(stderr, "== show_zdx_buildstats\n");
  
  EEDB::TrackCache*           trackcache = NULL;
  vector<EEDB::TrackCache*>   trackcache_array;
  long                        numsegs, numbuilt, numclaimed;
  
  bool show=false;
  if(_parameters.find("show") != _parameters.end()) { show=true; }
  
  if(_parameters.find("_input_file") != _parameters.end()) {  
    string name = _parameters["_input_file"];
    EEDB::ZDX::ZDXstream* zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);
    if(!zdxstream) {
      fprintf(stderr, "ERROR with track cache [%s]\n", _parameters["_input_file"].c_str());
      return;
    }
    ZDXdb* zdxdb = zdxstream->zdxdb();
    
    long numsegs, numbuilt, numclaimed, seg_start;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);
    long unbuilt= numsegs-numbuilt-numclaimed;
    double comp = 0;
    if(numsegs>0) { comp = 100.0 * (double)numbuilt / (double)numsegs; }
    
    double completed = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, show);
    
    printf("[%65s] %8.3f%% completed  %7ld segs %7ld remaining, [ %ld building ]\n", 
           name.c_str(), completed*100.0, numsegs, numsegs-numbuilt, numclaimed);  
    return;
  }
  
  
  if(_parameters.find("hashkey") != _parameters.end()) {
    EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
    trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
    trackbuilder->init_from_track_cache(_parameters["hashkey"]);
    
    EEDB::TrackCache* trackcache = trackbuilder->track_cache();
    if(!trackcache) { return; }
    trackcache_array.push_back(trackcache);;
  }
  else { 
    EEDB::WebServices::WebBase  *webservice = new EEDB::WebServices::WebBase();
    webservice->parse_config_file("/etc/zenbu/zenbu.conf");
    vector<DBObject*> tracks = EEDB::TrackCache::fetch_all(webservice->userDB());
    for(unsigned i=0; i<tracks.size(); i++) {
      EEDB::TrackCache* trackcache = (EEDB::TrackCache*)tracks[i];
      if(!trackcache) { continue; }
      if(!trackcache->cache_file_exists()) { continue; }
      trackcache_array.push_back(trackcache);;
    }
    printf("%d track caches\n", (int)trackcache_array.size());
  }
  
  for(unsigned i=0; i<trackcache_array.size(); i++) {
    EEDB::TrackCache* trackcache = trackcache_array[i];
    trackcache_buildstats(trackcache);
  }
}


void trackcache_buildstats(EEDB::TrackCache* trackcache) {
  char  buffer[2048];
  
  if(!trackcache) { return; }
  
  EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
  if(!zdxstream) { return; }
  ZDXdb* zdxdb = zdxstream->zdxdb();
  if(!zdxdb) { return; }

  string hashkey = trackcache->track_hashkey();
  fprintf(stderr, "== buildstats [%s]\n", hashkey.c_str());

  long numsegs, numbuilt, numclaimed, seg_start;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);

  
  double completed = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, false);
  printf("%s\n", zdxdb->path().c_str());
  
  printf("[%65s] %8.3f%% completed  %7ld segs %7ld remaining, [ %ld building ]\n", 
         hashkey.c_str(), completed*100.0, numsegs, numsegs-numbuilt, numclaimed);  
  
  numsegs = 0;
  numbuilt = 0;

  double total_buildtime = 0;;
  double min_buildtime   = -1;
  double max_buildtime   = 0;;
  double real_starttime  = -1;
  double real_endtime    = -1;
  map<string, long> host_segcount;
  
  // get chroms
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  //fprintf(stderr,"trackcache_buildstats %ld chroms\n", chroms.size());
    
  //now process each chrom
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    
    EEDB::Chrom *chrom = (*chr_it);
    string last_feature_id;
    fprintf(stderr,"buildstats [%s]\n", chrom->fullname().c_str());
    
    EEDB::ZDX::ZDXsegment* segment = EEDB::ZDX::ZDXsegment::fetch(zdxdb, chrom->assembly_name(), chrom->chrom_name(), -1);
    while(segment) {
      numsegs++;
      //printf("  %s\n", segment->xml().c_str());
      if(segment->is_built()) { 
        numbuilt++; 
        string hostname = segment->builder_host();
        pid_t pid = segment->builder_pid();
        double buildtime = segment->build_time_msec();
        printf("  %s:%s %ld..%ld -- %s  pid=%d", segment->assembly_name().c_str(),  segment->chrom_name().c_str(), segment->chrom_start(), segment->chrom_start(), hostname.c_str(), pid);
        time_t tm = (time_t)segment->build_starttime();
        printf(" %7.3fmsec -- %s", buildtime, ctime(&tm));
        if(host_segcount.find(hostname) == host_segcount.end()) { host_segcount[hostname] = 0; }
        host_segcount[hostname] += 1;

        total_buildtime += buildtime;
        if(buildtime>max_buildtime) { max_buildtime = buildtime; }
        if(min_buildtime<0 || buildtime<min_buildtime) { min_buildtime = buildtime; }

        if(real_starttime<0 || segment->build_starttime() < real_starttime) { real_starttime = segment->build_starttime(); }
        if(real_endtime<0 || segment->build_endtime() > real_endtime) { real_endtime = segment->build_endtime(); }
      }
      
      EEDB::ZDX::ZDXsegment* seg = segment->next_segment();
      segment->release();
      segment = seg;
    }
  }
  printf("[%65s] %ld / %ld segments\n", hashkey.c_str(), numbuilt, numsegs);  
  printf("  %1.2fmsec min, %1.2fmsec max, %1.2fmsec mean\n", min_buildtime, max_buildtime, total_buildtime/numbuilt);

  if(total_buildtime>3600000.0) {
    printf("  %1.3f hours total buildtime\n", total_buildtime/3600000.0); 
  } else if(total_buildtime>60000.0) {
    printf("  %1.3f minutes total buildtime\n", total_buildtime/60000.0); 
  } else {
    printf("  %1.3f sec total buildtime\n", total_buildtime/1000.0); 
  }

  map<string, long>::iterator it;
  for(it=host_segcount.begin(); it!=host_segcount.end(); it++) {
    printf(" %s -- %ld segs\n", (*it).first.c_str(), (*it).second);
  }
  printf("realtime %1.2f to %1.2f -- %1.3f sec\n", real_starttime, real_endtime, real_endtime-real_starttime);

  zdxdb->disconnect();
}


void show_zdx_region() {
  //find an claimed segment and clear them
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);  
  
  //fprintf(stderr, "== show_zdx_region\n");
  EEDB::ZDX::ZDXstream* zdxstream  = NULL;

  string         assembly_name, chrom_name;
  long           start, end;
  string         format = "xml";

  if(_parameters.find("format") != _parameters.end())  { format = _parameters["format"]; }
  if(format.find("gff") != string::npos) { format = "gff"; }
  if(format.find("bed") != string::npos) { format = "bed"; }
 
  if(_parameters.find("chrom_loc") != _parameters.end()) { 
    string chrom_loc = _parameters["chrom_loc"];
    size_t   p1;
    if((p1 = chrom_loc.find("::")) != string::npos) {
      assembly_name = chrom_loc.substr(0,p1);
      chrom_loc = chrom_loc.substr(p1+2);
      fprintf(stderr, "loc[%s]\n", chrom_loc.c_str());
    }
    if((p1 = chrom_loc.find(":")) != string::npos) {
      chrom_name = chrom_loc.substr(0,p1);
      string tstr = chrom_loc.substr(p1+1);
      if((p1 = tstr.find("..")) != string::npos) {
        start = strtol(tstr.substr(0,p1).c_str(), NULL, 10);
        end   = strtol(tstr.substr(p1+2).c_str(), NULL, 10);
      }
      else if((p1 = tstr.find("-")) != string::npos) {
        start = strtol(tstr.substr(0,p1).c_str(), NULL, 10);
        end   = strtol(tstr.substr(p1+1).c_str(), NULL, 10);
      }
    }
  }

  if(_parameters.find("asmb") != _parameters.end())  { assembly_name = _parameters["asmb"]; }
  if(_parameters.find("chrom") != _parameters.end()) { chrom_name = _parameters["chrom"]; }
  if(_parameters.find("start") != _parameters.end()) { start = strtol(_parameters["start"].c_str(), NULL, 10); }
  if(_parameters.find("end") != _parameters.end())   { end = strtol(_parameters["end"].c_str(), NULL, 10); }
  
  if(_parameters.find("_input_file") != _parameters.end()) {  
    string name = _parameters["_input_file"];
    zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);
    if(!zdxstream) {
      fprintf(stderr, "ERROR with track cache [%s]\n", _parameters["_input_file"].c_str());
      return;
    }
  }
  if(_parameters.find("hashkey") != _parameters.end()) {
    EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();  
    trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
    trackbuilder->init_from_track_cache(_parameters["hashkey"]);
    
    EEDB::TrackCache* trackcache = trackbuilder->track_cache();
    if(!trackcache) { return; }
    zdxstream = trackcache->zdxstream();
  }

  if(!zdxstream) {
    fprintf(stderr, "ERROR did not get zdxstream\n");
    return;
  }

  fprintf(stderr, "== show_zdx_region asm[%s] %s:%ld..%ld\n", assembly_name.c_str(), chrom_name.c_str(), start, end);
  string _output_buffer;

  EEDB::Tools::OSCTableGenerator* _osctable_generator = new EEDB::Tools::OSCTableGenerator;
  _osctable_generator->source_stream(zdxstream);
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
  if(format == "osc" && (_osctable_generator!=NULL))  { 
    _output_buffer.append(_osctable_generator->generate_oscheader());
  }

  long   total_count=0;
  zdxstream->stream_by_named_region(assembly_name, chrom_name, start, end);
  while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
    EEDB::Feature    *feature = NULL;
    EEDB::Expression *expression = NULL;
    if(obj->classname() == EEDB::Feature::class_name) { feature = (EEDB::Feature*)obj; }
    if(feature == NULL) { obj->release(); continue; }

    feature->metadataset()->remove_metadata_like("keyword","");
     
    if(format == "bed") {
      _output_buffer += feature->bed_description(_parameters["format"]) + "\n";
    }
    
    if(format == "gff") { 
      bool show_mdata = false;
      if(_parameters["export_feature_metadata"] == "true") { show_mdata = true; }
      _output_buffer += feature->gff_description(show_mdata) + "\n"; 
    }

    if(format == "osc" && (_osctable_generator!=NULL))  { 
      _output_buffer += _osctable_generator->osctable_feature_output(feature) + "\n"; 
    }
    if(format == "das")  { _output_buffer += feature->dasgff_xml(); }
    if(format == "xml")  { 
      if(total_count==1) { feature->chrom()->simple_xml(_output_buffer); }
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
    total_count++;
    obj->release();

    printf("%s", _output_buffer.c_str());
    _output_buffer.clear();
  }

  printf("%s", _output_buffer.c_str());
  _output_buffer.clear();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  double runtime  = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;

  if(difftime.tv_sec ==0) {
    fprintf(stderr, "%ld features  %1.3f msec  %1.2f obj/sec\n", total_count, runtime*1000.0, (total_count/runtime));
  } else {
    fprintf(stderr, "%ld features  %1.3f sec  %1.2f obj/sec\n", total_count, runtime, (total_count/runtime));
  }

}


//////////////////////////////////////////////////////////////////////////////////////

/*
void clear_rogue_claims() {
  //find an claimed segment and clear them
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);  

  fprintf(stderr, "== clear_rogue_claims\n");

  EEDB::ZDX::ZDXstream* zdxstream  = NULL;
  vector<EEDB::TrackCache*>   trackcache_array;

  if(_parameters.find("_input_file") != _parameters.end()) {
    zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);
    ZDXdb* zdxdb = zdxstream->zdxdb();
    EEDB::ZDX::ZDXsegment::reset_failed_claims(zdxdb);
    zdxdb->disconnect();
    return;
  }

  if(_parameters.find("hashkey") != _parameters.end()) {
    EEDB::Tools::TrackCacheBuilder  *trackbuilder = new EEDB::Tools::TrackCacheBuilder();
    trackbuilder->parse_config_file("/etc/zenbu/zenbu.conf");
    trackbuilder->init_service_request();
    trackbuilder->init_from_track_cache(_parameters["hashkey"]);
    trackbuilder->postprocess_parameters();

    EEDB::TrackCache* trackcache = trackbuilder->track_cache();
    if(!trackcache) { return; }
    trackcache_array.push_back(trackcache);;
  }
  else { 
    EEDB::WebServices::WebBase  *webservice = new EEDB::WebServices::WebBase();
    webservice->parse_config_file("/etc/zenbu/zenbu.conf");
    vector<DBObject*> tracks = EEDB::TrackCache::fetch_all(webservice->userDB());
    for(unsigned i=0; i<tracks.size(); i++) {
      EEDB::TrackCache* trackcache = (EEDB::TrackCache*)tracks[i];
      if(!trackcache) { continue; }
      if(!trackcache->cache_file_exists()) { continue; }
      trackcache_array.push_back(trackcache);;
    }
  }

  fprintf(stderr, "have %ld track caches\n", trackcache_array.size());
  for(unsigned i=0; i<trackcache_array.size(); i++) {
    EEDB::TrackCache* trackcache = trackcache_array[i];

    EEDB::ZDX::ZDXstream* zdxstream = trackcache->zdxstream();
    if(!zdxstream) { continue; }
    ZDXdb* zdxdb = zdxstream->zdxdb();
    if(!zdxdb) { continue; }

    EEDB::ZDX::ZDXsegment::reset_failed_claims(zdxdb);
    zdxdb->disconnect();
  }
}
*/

bool trackcache_access_sort_func(EEDB::TrackCache *a, EEDB::TrackCache *b) { 
  // < function
  if(a == NULL) { return false; }  //real < NULL 
  if(b == NULL) { return true; }  //a not NULL, but b is NULL

  if(a->last_access() > b->last_access()) { return true;}
  else { return false; }
}

void show_claims() {
  //find an claimed segment and clear them
  struct timeval      starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);  

  bool debug=false;
  if(_parameters["debug"] == "true") { debug=true; }

  char host[1024], strbuf[2048];
  bzero(host, 1024);
  gethostname(host, 1024);

  if(_parameters["mode"] == "resetclaims") { fprintf(stderr, "== show_reset_claims\n"); }
  else { fprintf(stderr, "== show_claims\n"); }

  EEDB::WebServices::WebBase  *webservice = new EEDB::WebServices::WebBase();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");

  list<EEDB::TrackCache*>           track_caches;
  list<EEDB::TrackCache*>::iterator tc_it;

  if(_parameters.find("hashkey") != _parameters.end()) {
    EEDB::TrackCache *trackcache = EEDB::TrackCache::fetch_by_hashkey(webservice->userDB(), _parameters["hashkey"]);
    if(trackcache) { track_caches.push_back(trackcache); }
  }
  else { 
    vector<DBObject*> tracks = EEDB::TrackCache::fetch_all(webservice->userDB());
    for(unsigned i=0; i<tracks.size(); i++) {
      EEDB::TrackCache* trackcache = (EEDB::TrackCache*)tracks[i];
      if(!trackcache) { continue; }
      if(!trackcache->cache_file_exists()) { continue; }
      track_caches.push_back(trackcache);
    }
    printf("%d track caches\n", (int)track_caches.size());
  }
  track_caches.sort(trackcache_access_sort_func);
  //fprintf(stderr, "after sort\n");

  for(tc_it=track_caches.begin(); tc_it!=track_caches.end(); tc_it++) {
    EEDB::TrackCache*     trackcache = (*tc_it);
    EEDB::ZDX::ZDXstream* zdxstream  = trackcache->zdxstream();
    ZDXdb*                zdxdb = zdxstream->zdxdb();

    long numsegs, numbuilt, numclaimed, seg_start;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);
    long unbuilt = numsegs-numbuilt-numclaimed;
    double comp = 0;
    if(numsegs>0) { comp = 100.0 * (double)numbuilt / (double)numsegs; }

    //printf("track cache [%65s] [ %ld building ] %s -- %ld\n", trackcache->track_hashkey().c_str(), numclaimed, zdxdb->path().c_str(), trackcache->last_access());

    if(!debug) {
      if(numsegs == 0) { zdxdb->disconnect(); continue; }
      if(numclaimed == 0) { zdxdb->disconnect(); continue; }
    }

    printf("track cache [%65s] [ %2ld building %7.3fsec] %7.3f%%  %5ld / %5ld segs %s\n", 
           trackcache->track_hashkey().c_str(), 
           numclaimed, trackcache->segment_buildtime(),
           comp, numbuilt, numsegs, 
           zdxdb->path().c_str());

    vector<EEDB::ZDX::ZDXsegment*> claim_segs = EEDB::ZDX::ZDXsegment::fetch_claimed_segments(zdxdb);
    for(unsigned j=0; j<claim_segs.size(); j++) {
      EEDB::ZDX::ZDXsegment* zseg = claim_segs[j];
      printf("  seg %s pid:%d :: %s %s:%ld..%ld",
        zseg->builder_host().c_str(), zseg->builder_pid(),
        zseg->assembly_name().c_str(), zseg->chrom_name().c_str(), zseg->chrom_start(), zseg->chrom_end());
      
      if(zseg->builder_host() != host) {
        printf("\t -- host does not match, can't check process");
      } else {
        printf("\t -- host matches");
        //check PID against ps aux
        sprintf(strbuf, "ps aux | grep zenbu_track_builder | grep -v grep | grep %d | wc -l", zseg->builder_pid());
        string str3 = exec_result(strbuf);
        long builders = strtol(str3.c_str(), NULL, 10);
        if(builders >= 1) { printf("\t -- running"); }

        //if PID not found then reset this segment
        if(builders == 0) {
          printf("\t -- process lost");
          if(_parameters["mode"] == "resetclaims") {
            printf("\t -- RESET");
            zseg->clear_claim();
          }
        }
      }
      printf("\n");
    }
    zdxdb->disconnect();
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
  if(_parameters.find("forcerun") != _parameters.end()) { return false; }

  string str1 = exec_cmd("grep 'model name' /proc/cpuinfo | wc -l");
  if(str1.empty()) { return false; } //can not calculate so just run 
  long proc_count = strtol(str1.c_str(), NULL, 10);
  if(proc_count<=0) { return false; }

  string str2 = exec_cmd("cat /proc/loadavg | cut -f1 -d' '");
  if(str2.empty()) { return false; } //can not calculate so just run 
  double loadavg = strtod(str2.c_str(), NULL);

  string str3 = exec_cmd("ps aux | grep zenbu_track_builder | grep -v grep|wc -l");
  long builders = strtol(str3.c_str(), NULL, 10);
  
  if(loadavg/proc_count > _load_limit) { 
    fprintf(stderr, "system overload\n");
    return true; 
  }

  if((double)builders / proc_count > _load_limit) {
    fprintf(stderr, "system overload %ld builders running now\n", builders);
    return true;
  }

  return false;  //no worries
}

/*
 starting thinking about some purge code which will analyze the stats in the track_cache table
 to decide if a cache can be deleted. Idea is to generate a metric based on build-time, access-cout, last-access
 
 select * from 
    (select *, bmetric/tmetric purge_metric from 
        (select *, 
                seg_buildtime* percent_complete * 2*log(hit_count+1) bmetric, 
                (UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(last_access))/60/60/24/7 tmetric from track_cache)t)t2
 
 select * from 
    (select *, bmetric/tmetric purge_metric from 
        (select *, 
                seg_buildtime* percent_complete * 2*log(hit_count+1) bmetric, 
                (UNIX_TIMESTAMP(NOW())-UNIX_TIMESTAMP(last_access))/60/60/24/7 tmetric 
         from track_cache 
         where percent_complete>0)t 
     where tmetric>1.0)t2 
  where purge_metric<1  order by purge_metric;
*/


//////////////////////////////////////////////////////////////////////////////////////


void get_worker_stats() {
  //test of appropriate data to track workers and failures

  char host[1024];
  bzero(host, 1024);
  gethostname(host, 1024);
  printf("zenbu_track_builder host [%s]\n", host);
}

