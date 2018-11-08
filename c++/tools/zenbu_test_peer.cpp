#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>

#include <EEDB/Peer.h>
#include <EEDB/Feature.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/WebServices/WebBase.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

map<string,string>        _parameters;

void test_peer_access(EEDB::Peer *peer);
void test_object(EEDB::SPStream *stream, string fid);
void test_region(EEDB::SPStream *stream, string assembly_name, string chrom_name, long int start, long int end, bool show);
void usage();


int main(int argc, char *argv[]) { 
  srand(time(NULL));
  
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
    if(arg == "-url")    { _parameters["db_url"] = argvals[0]; }
    if(arg == "-search") { _parameters["filter"] = argvals[0]; }
    if(arg == "-ids") {
      string ids;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        ids += " "+ argvals[j];
      }
      _parameters["ids"] += ids;
    }
    if(arg == "-peers") { 
      string tstr;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        tstr += " "+argvals[j];
      }
      _parameters["peers"] += tstr;
    }
  }
  
  if(_parameters.find("db_url") == _parameters.end()) {
    printf("\nERROR: must specify -url for the peer\n");
    usage(); 
  }
  EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["db_url"]);
  if(!peer) {
    printf("\nERROR: unable to connect to peer [%s]!!\n\n", _parameters["db_url"].c_str());
    usage(); 
  }
  printf("db_url [%s]\n", peer->db_url().c_str());
  
  test_peer_access(peer);
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbu_test_peer [options]\n");
  printf("  -help                     : printf(this help\n");
  printf("  -url <db_url>             : ZENBU URL to peer\n");
  printf("zenbu_test_peer v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


//----------------------------------------------------------------------------------------

void test_peer_access(EEDB::Peer *peer) {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  EEDB::SPStreams::SourceStream *stream = peer->source_stream();
  
  printf("---- peers\n");
  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    printf("%s\n", obj->xml().c_str());
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  printf("---- chromosomes\n");
  gettimeofday(&starttime, NULL);
  stream->stream_chromosomes("hg18", "");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    printf("%s\n", obj->simple_xml().c_str());
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  
  printf("---- sources\n");
  gettimeofday(&starttime, NULL);
  stream->stream_data_sources();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    printf("%s\n", obj->xml().c_str());
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  
  printf("---- direct object access\n");
  gettimeofday(&starttime, NULL);
  test_object(stream, string(peer->uuid()) + "::1:::FeatureSource");
  test_object(stream, string(peer->uuid()) + "::2:::Experiment");
  test_object(stream, string(peer->uuid()) + "::1");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  printf("---- region queries\n");
  string asm_name;
  if(peer->driver() == "bamdb") {
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)stream;
    asm_name = bamdb->assembly_name();
  }
  if(peer->driver() == "oscdb") {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)stream;
    asm_name = oscdb->assembly_name();
  }
  printf("  genome [%s]\n", asm_name.c_str());
  //stream->set_sourcestream_output("express");
  //stream->add_expression_datatype_filter(EEDB::Datatype::get_type("tagcount"));
  
  test_region(stream, asm_name, "chr2", 1000, 1000, true);
  
  test_region(stream, asm_name , "chr2", 10000, 20000, false);
  
  test_region(stream, asm_name , "chrX", 10000, 20000, false);
  
  test_region(stream, asm_name, "chr7", 127817994, 127913245, false);

  test_region(stream, asm_name, "chr3", -1, 1000000, false);

  test_region(stream, asm_name, "chr3", -1, 127817994, false);

  test_region(stream, asm_name, "chr3", 180670879, -1, false);

  test_region(stream, asm_name, "chr3", 127913245, -1, false);

  test_region(stream, asm_name, "chr3", -1, -1, false);

  test_region(stream, "hg19", "chr11",65263055,65276116, false);
  
}

void test_region(EEDB::SPStream *stream, string assembly_name, string chrom_name, long int start, long int end, bool show) {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  printf("  -- region\n");
  cout << assembly_name << " " << chrom_name << " " << start << ".." << end << endl;
  
  long int count=0;
  stream->stream_by_named_region(assembly_name, chrom_name, start, end);
  while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) {
    count++;
    if(count % 100000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      printf("%ld in %1.6f sec  ", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec   ", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
      printf("%s %s\n", feature->primary_name().c_str(), feature->chrom_location().c_str());
    }
    feature->release();
  }
  printf("  %ld features\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_object(EEDB::SPStream *stream, string fid) {
  printf("test [%s]\n", fid.c_str());
  MQDB::DBObject* feature = stream->fetch_object_by_id(fid);
  if(feature) { printf("%s\n", feature->simple_xml().c_str()); }
  else { printf("not available\n\n"); }
}
