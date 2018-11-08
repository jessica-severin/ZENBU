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


 //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
 //  //seedpeers.push_back(regpeer);
 //  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite"));
 //  seedpeers.push_back(EEDB::Peer::new_from_url("mysql://read:read@localhost:3306/eedb_vbox_registry"));
 //  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_vbox_local_registry.sqlite"));
 //  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB_intweb1/dbs/fantom5_release009/eedb_fantom5_release009_registry.sqlite"));
 //  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/fantom5_release009/eedb_fantom5_release009_registry.sqlite"));
 //  EEDB::Peer  *regpeer = seedpeers.front();
 //
 //
 //
 //     <seed>mysql://read:read@osc-mysql.gsc.riken.jp:3306/eeDB_public_configs</seed>
 //     <seed>mysql://read:read@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry</seed>
 //    <seed>sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite</seed>
 //   <seed>mysql://read:read@osc-mysql.gsc.riken.jp:3306/eeDB_core</seed>
 //    <seed>mysql://read:read@osc-mysql.gsc.riken.jp:3306/eeDB_hg19_core</seed>
 //    <seed>mysql://read:read@osc-mysql.gsc.riken.jp:3306/eeDB_zv8_zebrafish</seed>
 //    <seed>mysql://read:read@fantom46.gsc.riken.jp:3306/eeDB_rheMac2_core</seed>
 //   <seed>mysql://read:read@fantom46.gsc.riken.jp:3306/eeDB_rheMacMulLas_core</seed>
 //   <seed>mysql://read:read@fantom46.gsc.riken.jp:3306/eeDB_galGal4_core</seed>
 //
 //
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

  printf("\n== test_region_server\n");
  webservice->parse_config_file("/var/www/html/zenbu/cgi/eedb_server_config.xml");
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

//  string post_data ="<zenbu_query> <source_ids>51AD6440-FBFE-11DD-8787-5096FEFA0F18::1:::FeatureSource,</source_ids> <asm>mm9</asm> <loc>chr7:1..52259514</loc> <format>xml</format><submode>subfeature</submode> </zenbu_query>";
  string post_data ="<zenbu_query> <source_ids>8117DCE2-E2EE-11DE-84F5-5D06B265C018::10:::Experiment,</source_ids><mode>experiments</mode></zenbu_query>";
  webservice->init_service_request();

  webservice->set_post_data(post_data);

  webservice->process_xml_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after process_xml_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->execute_request();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after execute_request %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


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
 

  EEDB::SPStreams::RenameExperiments *mod1 = new EEDB::SPStreams::RenameExperiments;
  mod1->source_stream(stream);
  mod1->add_prefix_tag("","osc:LSA_sample_id");
  stream = mod1;


  stream->display_info();

  //stream = fstream;

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

  
  /*
  printf("  -- region\n");
  printf("    hg18  chr11  127817994..127913245\n");
  long int count=0;
  //stream->stream_by_named_region("mm9", "chr2", 35102076, 35167412);
  stream->stream_by_named_region("hg18", "chr11", 127817994, 127913245);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    count++;
    //cout << obj->xml();
  }
  printf("%ld features\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */

  webservice->disconnect();
}


