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
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/RenameExperiments.h>
#include <EEDB/SPStreams/StreamTKs.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/RegionServer.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

void test_region(vector<EEDB::Peer*> seedpeers);

bool  count_only=false;
long  upgrade_max = 0;


int main(int argc, char *argv[]) {
  MQDB::Database  *db;
  int             loop=10000;
  map<string, dynadata>::iterator it;
  int count;
  struct timeval   starttime,endtime,difftime;
  DBObject         *tobj;
  int                     idx;
  vector<EEDB::Peer*>     seedpeers;

  
  gettimeofday(&starttime, NULL);
  srand(time(NULL));

  printf("Program name: %s\n", argv[0]);
  
  for(int argi=1; argi<argc; argi++) {
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    if(arg == "-count") { count_only=true; }
    if((arg == "-limit") || (arg == "-max")) { 
      argi++;
      if(argi<argc) {  
        upgrade_max = strtol(argv[argi], NULL, 10);
      }
    }
  }

  test_region(seedpeers);

  exit(1);
}

//
//
////////////////////////////////////////////////////////////////////////////////////////////
//
//


void test_region(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::RegionServer      *webservice = new EEDB::WebServices::RegionServer();

  gettimeofday(&starttime, NULL);

  //printf("\n== test_streamtks\n");
  webservice->parse_config_file("/var/www/html/zenbu/cgi/eedb_server_config.xml");
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  //printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

   // public annotation sets as of 30May 12
// <featuresource id="0CC994F8-1B6B-49D7-A9EB-D894563A4621::1:::FeatureSource" category="bed_region" name="UCSC lincRNATranscript hg19 20120112"
// <featuresource id="C908CF01-9671-4D19-AB1E-653764EBF641::1:::FeatureSource" category="bed_region" name="UCSC Hinv70Coding hg19 20120112"
// <featuresource id="C1EC6A71-CA03-429B-9E69-1A3F74A82531::1:::FeatureSource" category="bed_region" name="UCSC Hinv70NonCoding hg19 20120112"
// <featuresource id="DB07A641-ED01-4AE9-BF9C-52D9491D129D::1:::FeatureSource" category="bed_region" name="UCSC GencodeCompV10 hg19 20120112" 
// <featuresource id="7698CD75-905F-4DE1-AA9F-D7C3E2116466::1:::FeatureSource" category="bed_region" name="UCSC GencodePseudoV10 hg19 20120112"
// <featuresource id="7AC9271F-3DF1-4CA8-9435-E8816B2812EE::1:::FeatureSource" category="bed_region" name="UCSC knownGene hg19 20120112"
// <featuresource id="65C8E57C-9334-4CDB-8447-25FD7F916916::1:::FeatureSource" category="bed_region" name="UCSC RefSeq hg19 20120112" 
   // cuffmerge set as of 30May 12
// <featuresource id="96FB0177-F5D7-41D7-B86B-9BDFB8680C70::1:::FeatureSource" category="bed_region" name="cuffmerge complete assembly"
  // sources as of 30May 12
// string post_data ="<zenbu_query> <source_ids>0CC994F8-1B6B-49D7-A9EB-D894563A4621::1:::FeatureSource,C908CF01-9671-4D19-AB1E-653764EBF641::1:::FeatureSource,C1EC6A71-CA03-429B-9E69-1A3F74A82531::1:::FeatureSource,DB07A641-ED01-4AE9-BF9C-52D9491D129D::1:::FeatureSource,7698CD75-905F-4DE1-AA9F-D7C3E2116466::1:::FeatureSource,7AC9271F-3DF1-4CA8-9435-E8816B2812EE::1:::FeatureSource,65C8E57C-9334-4CDB-8447-25FD7F916916::1:::FeatureSource,96FB0177-F5D7-41D7-B86B-9BDFB8680C70::1:::FeatureSource</source_ids><format>xml</format></zenbu_query>";


   // public annotation sets as of 04 Jul 12
// <featuresource id="DB07A641-ED01-4AE9-BF9C-52D9491D129D::1:::FeatureSource" category="bed_region" name="UCSC GencodeCompV10 hg19 20120112" 
// <featuresource id="7698CD75-905F-4DE1-AA9F-D7C3E2116466::1:::FeatureSource" category="bed_region" name="UCSC GencodePseudoV10 hg19 20120112"
// <featuresource id="7AC9271F-3DF1-4CA8-9435-E8816B2812EE::1:::FeatureSource" category="bed_region" name="UCSC knownGene hg19 20120112"
// <featuresource id="65C8E57C-9334-4CDB-8447-25FD7F916916::1:::FeatureSource" category="bed_region" name="UCSC RefSeq hg19 20120112" 
// <featuresource id="0CC994F8-1B6B-49D7-A9EB-D894563A4621::1:::FeatureSource" category="bed_region" name="UCSC lincRNATranscript hg19 20120112"
// <featuresource id="933C2A49-5450-40EE-8730-0BB1745E5505::1:::FeatureSource" category="bed_region" name="UCSC Hinv70Coding hg19 20120112 no pHIT" 
// <featuresource id="2C53DBBB-3BBB-4DFB-A067-53EBF2237A72::1:::FeatureSource" category="bed_region" name="UCSC Hinv70NonCoding hg19 20120112 no pHIT"
// <featuresource id="5B79342F-1D7B-4AF2-9FB5-A37C4C9F39D4::1:::FeatureSource" category="bed_region" name="UCSC Hinv70PseudoGene hg19 20120112 no pHIT"
   // cuffmerge set as of 04 Jul 12
// <featuresource id="A60C75F9-6865-42F7-9E12-3D543A7B9C3B::1:::FeatureSource" category="bed_region" name="merged cufflinks trinity assembly" create_date="Wed Jul  4 00:25:27 2012" create_timestamp="1341329127" feature_count="2353632" owner_openid="https://www.google.com/accounts/o8/id?id=AItOawljVFjkd_iRESFmjbfNswLsyYZh3jogkAY"></featuresource> 
  string post_data ="<zenbu_query> <source_ids>DB07A641-ED01-4AE9-BF9C-52D9491D129D::1:::FeatureSource,7698CD75-905F-4DE1-AA9F-D7C3E2116466::1:::FeatureSource,7AC9271F-3DF1-4CA8-9435-E8816B2812EE::1:::FeatureSource,65C8E57C-9334-4CDB-8447-25FD7F916916::1:::FeatureSource,0CC994F8-1B6B-49D7-A9EB-D894563A4621::1:::FeatureSource,933C2A49-5450-40EE-8730-0BB1745E5505::1:::FeatureSource,2C53DBBB-3BBB-4DFB-A067-53EBF2237A72::1:::FeatureSource,5B79342F-1D7B-4AF2-9FB5-A37C4C9F39D4::1:::FeatureSource,A60C75F9-6865-42F7-9E12-3D543A7B9C3B::1:::FeatureSource</source_ids><format>xml</format></zenbu_query>";

  webservice->init_service_request();

  webservice->set_post_data(post_data);

  webservice->process_xml_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  //printf("  after process_xml_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  //printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  /*
  EEDB::SPStreams::FeatureEmitter *emitter = new EEDB::SPStreams::FeatureEmitter;
  //emitter->fixed_grid(true);
  emitter->overlap(0);
  emitter->both_strands(false);
  emitter->width(9.9);

  EEDB::SPStreams::TemplateCluster *cluster = new EEDB::SPStreams::TemplateCluster;
  cluster->side_stream(emitter);
  cluster->source_stream(fstream);
  cluster->ignore_strand(false);
  cluster->skip_empty_templates(true);
  cluster->expression_mode(EEDB::CL_SUM);
  cluster->overlap_mode("5end");
  */

  EEDB::SPStream *stream = webservice->source_stream();
 

  EEDB::SPStreams::StreamTKs *mod1 = new EEDB::SPStreams::StreamTKs;
  mod1->source_stream(stream);
  stream = mod1;
  //stream->display_info();

  //stream = fstream;

  /*
  printf("  -- peers\n");
  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    cout << obj->xml() << endl;; 
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("  -- sources\n");
  stream->stream_data_sources();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    cout << obj->simple_xml();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */
 
  //printf("  -- chromosomes\n");
  // get chroms available on this stream
  list<EEDB::Chrom*>           chroms;
  list<EEDB::Chrom*>::iterator chr_it;

  EEDB::SPStreams::FederatedSourceStream  *fstream = webservice->secured_federated_source_stream();
  fstream->set_peer_search_depth(1); //only search the seeds
  fstream->allow_full_federation_search(true);
  fstream->stream_chromosomes("hg19", "");
  while(MQDB::DBObject *obj = fstream->next_in_stream()) { 
    if(!obj) { continue; }
    if(obj->classname() != EEDB::Chrom::class_name) { continue; }
    EEDB::Chrom *chrom = (EEDB::Chrom*)obj;
    chroms.push_back(chrom);
  }
  chroms.sort(chrom_length_sort_func);
  fstream->release();
  //fprintf(stderr,"scan_data_stream %d chroms\n", chroms.size());

  
  //printf("  -- region\n");
  long int count=0;
  EEDB::Feature* feature;

  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    EEDB::Chrom *chrom = (*chr_it);
    //if(chrom->chrom_name() != "chr19") { continue; }
    //cout << chrom->fullname() << "\n";
    stream->disconnect();
    stream->stream_by_named_region("hg19",chrom->chrom_name(), -1, -1);
    //stream->stream_by_named_region("hg19", "chr19", 50130523, 50201436);
    while(MQDB::DBObject *obj = stream->next_in_stream()) {
      count++;
      if(obj->classname() == EEDB::Feature::class_name) { 
        feature = (EEDB::Feature*) obj;
        //cout << "TK:";
        //cout << feature->primary_name();
        //cout << "\n";
        //printf("TK : %s %s\n", feature->primary_name().c_str(), feature->bed_description("bed12").c_str());
        vector<EEDB::Metadata*> mdlist = feature->metadataset()->metadata_list();
        for(int i=0; i<mdlist.size(); i++) {
          //printf("  metadata : %s", mdlist[i]->xml().c_str());
          printf("%s\t%s\t%s\n", mdlist[i]->data().c_str(), feature->primary_name().c_str(), feature->bed_description("bed12").c_str());
          //printf("%s\n", feature->bed_description("bed12").c_str());
        } 
        //cout << "\n";
      }
      obj->release();
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  //printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  

  webservice->disconnect();
}


