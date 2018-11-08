#include <stdio.h>
#include <string>
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
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/RegionServer.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;
using namespace BamTools;

void test_bamdb_build();
void test_bamdb_access();
void test_bamdb_in_peer();

int main() {
  struct timeval   starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  srand(time(NULL));

  test_bamdb_build();
  test_bamdb_access();
  //test_bamdb_in_peer();
}


//----------------------------------------------------------------------------------------


void test_bamdb_build() {
  struct timeval   starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  
  //string path ="/some/path/to/a/bam/file/BLAHBLAH.bam";
  string path = "/cygdrive/c/Users/jayson/workspace/gcc/bamtools_api/BAM Test Files/SRhi10034.3939-67D8.ATCACG.bam";

  EEDB::SPStreams::BAMDB *bamdb = new EEDB::SPStreams::BAMDB();
  //bamdb->set_parameter("build_dir","/tmp/");
  //bamdb->set_parameter("deploy_dir", _user_profile->user_directory());

  //bamdb->set_parameter("assembly", "hg19");
  //bamdb->set_parameter("display_name", "hg19");
  //bamdb->set_parameter("description", "hg19");
  
  cout << "Checking " << path << endl;
  string dbpath = bamdb->create_new(path);
}


//----------------------------------------------------------------------------------------

void test_region(EEDB::SPStream *stream, string assembly_name, string chrom_name, long int start, long int end, bool show) {
	  printf("---- region\n");
	  cout << "    " << assembly_name << " " << chrom_name << " " << start << ".." << end << endl;

	  long int count=0;
	  stream->stream_by_named_region(assembly_name, chrom_name, start, end);
	  while(MQDB::DBObject *obj = stream->next_in_stream()) {
	    count++;
	    if (show) cout << obj->xml();
	  }
	  printf("  %ld features\n", count);
}

void test_bamdb_access() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);

  //string dbpath = "bamdb:///Users/severin/data2/OSC/dRNA_20081028_lSLTU2.bamdb";
  string dbpath = "bamdb:///cygdrive/c/Users/jayson/workspace/gcc/bamtools_api/BAM Test Files/SRhi10034.3939-67D8.ATCACG.bamdb";

  cout << "Opening " << dbpath << endl << endl;
  EEDB::SPStreams::BAMDB *bamdb = EEDB::SPStreams::BAMDB::new_from_url(dbpath);

  if(bamdb == NULL) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
    printf("unable to connect to [%s]\n", dbpath.c_str());
    return;
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  bamdb->set_sourcestream_output("express");
  bamdb->add_expression_datatype_filter(EEDB::Datatype::get_type("tagcount"));

  EEDB::SPStream *stream = bamdb;  //BAMDB is subclass of SPStream
  /*
  printf("---- peers\n");
  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    cout << obj->xml() << endl;; 
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  printf("---- sources\n");
  stream->stream_data_sources();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    cout << obj->simple_xml();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  printf("---- chromosomes\n");
  stream->stream_chromosomes("hg18", "");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    cout << obj->simple_xml();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("---- direct feature access\n");
  EEDB::Feature *feature = bamdb->_fetch_feature_by_id(100);
  if(feature) { printf("%s\n", feature->xml().c_str()); }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */

  test_region(stream,"dm3", "chr2L", 1000, 1000, true);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  test_region(stream,"dm3", "chr2L", 10000, 20000, false);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  test_region(stream,"dm3", "chrX", 10000, 20000, false);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  test_region(stream,"hg18", "chr2L", 127817994, 127913245, false);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("  %1.6f msec \n\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  cout << "end test" << endl;
}

void test_bamdb_in_peer() {
  //
  /////////////////////////////////////////////////////////
  //
  
  /*
   int count = 0;  
   printf("test_oscdb_peer\n");
   dbpath = "bamdb:///Users/severin/data2/OSC/dRNA_20081028_lSLTU2.bamdb";  
   gettimeofday(&starttime, NULL);
   
   EEDB::Peer *peer = EEDB::Peer::new_from_url(dbpath);
   if(peer == NULL) {
   printf("unable to connect to [%s]\n", dbpath.c_str());
   return;
   }  
   gettimeofday(&endtime, NULL);
   timersub(&endtime, &starttime, &difftime);
   printf("after new %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
   
   EEDB::SPStreams::SourceStream *stream = peer->source_stream();
   ((EEDB::SPStreams::BAMDB*)stream)->oscfileparser();
   //printf("%s\n", stream->xml().c_str());
   gettimeofday(&endtime, NULL);
   timersub(&endtime, &starttime, &difftime);
   printf("after source_stream %1.6f msec\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
   
   
   //test region query and new cidx
   count=0;
   stream->stream_by_named_region("hg18", "chr19", 54853066, 54862509);
   gettimeofday(&endtime, NULL);
   timersub(&endtime, &starttime, &difftime);
   printf("region setup %1.6f msec\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
   
   while(MQDB::DBObject *obj = stream->next_in_stream()) {
   //cout << peer->xml() << endl; 
   count++;
   }
   gettimeofday(&endtime, NULL);
   timersub(&endtime, &starttime, &difftime);
   printf("%d features in %1.6f msec\n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
   
   
   gettimeofday(&endtime, NULL);
   timersub(&endtime, &starttime, &difftime);
   printf("total %1.6f msec\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
   */
  
}


