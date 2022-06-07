#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
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
#include <EEDB/SPStreams/SiteFinder.h>
#include <EEDB/SPStreams/DemultiplexSource.h>
#include <EEDB/SPStreams/AppendExpression.h>
#include <EEDB/SPStreams/PairReads.h>
#include <EEDB/SPStreams/EdgeLengthFilter.h>

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

void test_assembly();
void test_chrom();
void test_metadata(MQDB::Database *db);
void test_symbol(MQDB::Database *db);
void test_mdset(MQDB::Database *db);
void test_leaks(MQDB::Database *db);
void test_leaks2(MQDB::Database *db);
void direct_db_test(Database *db);
void direct_maprow_test(Database *db);
void test_object();
void test_rand_chrom(MQDB::Database *db);
void test_featuresource(MQDB::Database *db);
void test_experiment(MQDB::Database *db);
void test_dbstream(Database *db);
void test_dbstream2(Database *db);
void test_uuid();
string uuid_b64string(boost::uuids::uuid const& u);
void test_peer();
void test_peers(Database *db);
void test_peers2(Database *db);
void test_peers3();
void test_spstream();
void test_sourcestream(Database *db);
void test_multistream(Database *db);
void test_federatedstream(EEDB::Peer *regpeer);
void test_experiment_stream(vector<EEDB::Peer*> seedpeers);
void test_stream_object();
void test_dbcache();
void test_feature_meta_stream(vector<EEDB::Peer*> seedpeers);
void test_oscparser();
void test_oscparser2();
void test_oscdb_peer();
void test_realloc();
void fix_source_metadata(vector<EEDB::Peer*> seedpeers);

void test_extended_fedsource(vector<EEDB::Peer*> seedpeers);
void test_feature_metadata_search(vector<EEDB::Peer*> seedpeers);
void test_datatype();
void test_datatype2(vector<EEDB::Peer*> seedpeers);
void test_symbol_save(vector<EEDB::Peer*> seedpeers);
void test_feature_save(vector<EEDB::Peer*> seedpeers);
void test_metadata2(MQDB::Database *db);
void test_region(vector<EEDB::Peer*> seedpeers);
void test_region2(vector<EEDB::Peer*> seedpeers);
void test_oscdb();
void test_oscdb2();
void test_oscdb3();
void test_oscdb4();
void test_oscdb5(vector<EEDB::Peer*> seedpeers);
void test_region_server();
void test_region_server2();
void test_region_server3();
void test_search_server();
void upgrade_oscdbs(vector<EEDB::Peer*> seedpeers);
void upgrade_oscdbs_v2();
void test_lsarchive();
void test_paraclu();
void test_upload_server();
void test_remote_server1();
void zdx_write_test1();
void zdx_write_test2();
void zdx_write_test3();
void zdx_write_test4();
bool gff_write_zdx_test();
void zdx_read_test1();
void zdx_read_test2();
void zdx_read_test3();
void zdx_read_test4();
void trackcache_test1();
void region_server_test7();
void region_server_test8b();
void region_server_test_overlapmerge();
void test_proc_memory();
void test_hmac();
void malloc_test();
void test_validation_email();
void test_oscdb_feature_mdata_index();
void test_collab_convert();
void test_mann_whitney();
void migrate_f5zenbu_public();
void merge_f5zenbu_users();
void relocate_peer(EEDB::Peer *peer, string db_url);
void migrate_f5_mdata();
void test_ncbi_genome_load();
void migrate_f5_sRNA_data();
void check_view_collaboration_security_sharing();
void check_duplicate_uploads();
void fantom6_bam_links();
bool zdx_patch_assembly();
void test_site_finder();
void test_fetch_features();
void test_load_GO_obo();
bool test_edge_oscfile_build();
bool test_edge_oscfile_read();
bool test_edge_oscfile_read2();
void test_assembly_ncbi_fetch_info();
bool test_demux_single_cell();
bool test_append_expression();
void test_region_download();
void test_region_server_track_cache(); 
void test_metasearch_server();
void test_pair_reads();

EEDB::User* get_cmdline_user();

map<string,string>  _parameters;

int main() {
  MQDB::Database  *db;
  dynadata  value;
  int             loop=10000;
  int             chrom_id;
  map<string, dynadata> row_map;
  map<string, dynadata>::iterator it;
  int count;
  struct timeval   starttime,endtime,difftime;
  DBObject         *tobj;
  EEDB::Assembly   *assembly;
  EEDB::Chrom      *chrom;
  vector<MQDB::DBObject*> assemblies;
  vector<MQDB::DBObject*> chroms;
  int                     idx;
  void                    *stmt;
  vector<EEDB::Peer*>     seedpeers;

  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///zenbu/dbs/zenbu_main_registry.sqlite"));
  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_fantom46_registry2.sqlite"));

  //test_pair_reads(); exit(0);
  //region_server_test_overlapmerge(); exit(0);

  test_metasearch_server(); exit(0);

  //test_region_server_track_cache(); exit(0);

  //test_region_download(); exit(0);

  //test_append_expression(); exit(0);

  //test_demux_single_cell(); exit(0);

  //test_assembly_ncbi_fetch_info(); exit(0);

  //test_edge_oscfile_build();
  //test_edge_oscfile_read();
  //test_edge_oscfile_read2();
  //exit(0);

  //test_load_GO_obo(); exit(0);

  //test_fetch_features(); exit(0);

  //test_site_finder(); exit(0);

  //zdx_patch_assembly(); exit(0);

  test_region_server3(); exit(0);

  //fantom6_bam_links(); exit(0);

  //check_duplicate_uploads(); exit(0);

  //check_view_collaboration_security_sharing(); exit(0);

  region_server_test_overlapmerge(); exit(0);

  migrate_f5_sRNA_data(); exit(0);

  //test_peers3(); exit(0);

  test_ncbi_genome_load(); exit(0);

  migrate_f5_mdata(); exit(0);

  merge_f5zenbu_users(); exit(0);

  migrate_f5zenbu_public(); exit(0);

  test_mann_whitney(); exit(0);
  
  //test_region(seedpeers); exit(0);
  //test_oscdb_feature_mdata_index();
  //test_proc_memory(); exit(0);
  region_server_test8b(); exit(0);
  
  //test_collab_convert(); exit(0);
  //test_validation_email(); exit(0);
  //malloc_test(); exit(1);
  //test_hmac();
  //region_server_test8(); exit(0);
  //region_server_test7();
  //trackcache_test1();
  //test_remote_server1(); exit(0);
  //zdx_write_test2();
  //zdx_write_test3();
  //zdx_write_test4();
  //gff_write_zdx_test();
  //zdx_read_test1();
  //zdx_read_test2();
  //zdx_read_test3();
  //zdx_read_test4();
  //test_lsarchive();
  //test_paraclu();
  //test_lsarchive();
  //exit(0);
  
  //test_uuid();
  /*
  EEDB::Metadata *md = new EEDB::Metadata("test", "something here & here < this but > :\"that\"");
  cout << md->xml();
  exit(1);
  */

//  printf("EEDB::Assembly::global_should_cache = %d\n", EEDB::Assembly::global_should_cache);
  gettimeofday(&starttime, NULL);

  srand(time(NULL));

  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //seedpeers.push_back(regpeer);
  //seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite"));
  //seedpeers.push_back(EEDB::Peer::new_from_url("mysql://read:read@@localhost:3306/eedb_vbox_registry"));
  //seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_vbox_local_registry.sqlite"));
  //seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB_intweb1/dbs/fantom5_release009/eedb_fantom5_release009_registry.sqlite"));
  //seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/fantom5_release009/eedb_fantom5_release009_registry.sqlite"));

  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///zenbu/dbs/zenbu_main_registry.sqlite"));
  seedpeers.push_back(EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_fantom46_registry2.sqlite"));

  EEDB::Peer  *regpeer = seedpeers.front();


  //db = new MQDB::Database("sqlite:///disk3/zenbu/dbs/Mouse_Embryoid_Body_RNAseq_exonic.oscdb/oscdb.sqlite");
  //db = new MQDB::Database("mysql://read:read@@localhost:3306/eedb_vbox_registry");
  //db = new MQDB::Database("sqlite:///Users/severin/data/oscdb/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.sqlite");
  //db = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_fantom3");
  db = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_core");
  //db = new MQDB::Database("sqlite:///Users/severin/data/oscdb/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.sqlite");
  //db = new MQDB::Database("sqlite:///Users/severin/data2/oscdbs/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.sqlite");
  //db = new MQDB::Database("sqlite:///disk2/zenbu/users/TuX8Mgpw3xGkRSW1iEZYiQ/hg19_refGene_20100202_0yjAfr.oscdb/oscdb.sqlite");
  //db = new MQDB::Database("sqlite:///Volumes/HD-HSU2/data/oscdbs/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.sqlite");

  db->uuid("9bc1e9f8-8a31-11df-a042-080027935aac");
  printf("%s\n", db->xml().c_str());
  if(db->get_connection()) { printf("looks good!\n"); }

  //test_oscdb(); exit(1);

  //test_oscparser();
  //test_oscdb_peer();

  //upgrade_oscdbs_v2();
  //upgrade_oscdbs(seedpeers);
  //test_region_server();
  //test_search_server();
  //test_upload_server();
  //test_region_server2();

  //test_oscdb2();
  //test_oscdb3();
  //test_oscdb4();
  //test_oscdb5(seedpeers);

  //test_region2(seedpeers); exit(0);
  test_region(seedpeers); exit(0);
  //test_metadata2(db);
  //test_feature_save(seedpeers);
  //test_symbol_save(seedpeers);

  //fix_source_metadata(seedpeers); exit(0);

  //test_object();
  //test_oscparser2(); 
  //test_oscparser();
  //test_experiment_stream(seedpeers); 
  //exit(0);

  //test_datatype2(seedpeers);
  //test_datatype();
  //test_dbstream2(db);
  //test_feature_metadata_search(seedpeers);
  //test_extended_fedsource(seedpeers);
  exit(0);

  test_stream_object();
  test_federatedstream(regpeer); 
  test_experiment_stream(seedpeers); 
  test_feature_meta_stream(seedpeers);
  exit(0);

  //test_rand_chrom(db);

  //value = db->fetch_col_value("select taxon_id from assembly where ucsc_name='hg18';");
  //printf("%s\n", value.display_desc().c_str());
  //exit(1);

  //test_object();
  //test_metadata(db);
  //test_symbol(db);
  //exit(1);

  //test_dbcache(); exit(0);

  //test_stream_object(); exit(0);

  //test_multistream(db); 

  test_federatedstream(regpeer); exit(0);

  test_multistream(db); exit(0);
  test_peer(); exit(0);
  
  test_spstream();
  test_peers2(db);
  exit(1);

  test_sourcestream(db);

  exit(1);
  test_experiment(db);

  //test_peers(db);
  //direct_db_test(db);

  //test_assembly();
  //test_chrom();

  //direct_maprow_test(db);

  //test_metadata(db);
  //test_symbol(db);
  //test_mdset(db);

  test_object();

  test_featuresource(db);
  test_experiment(db);

  //test_dbstream(db);

  /*
  while(loop-- > 0) {
    chrom_id = random() % 243;
    value = db->fetch_col_value("select chrom_name from chrom where chrom_id=?;", "d", chrom_id);
    if(value.type != MQDB::UNDEF) {
      printf("%s\n", value.display_desc().c_str());
    }
  }
  */
  sleep(10000);
}



void test_assembly() {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  int                      loop=1;
  EEDB::Assembly           *assembly;
  vector<MQDB::DBObject*>  assemblies;
  time_t                   tmp_time = time(NULL);

  MQDB::Database *db1 = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_core");
  MQDB::Database *db = new MQDB::Database("mysql://severin:severin@@osc-mysql.gsc.riken.jp:3306/eeDB_jms_test5");

  EEDB::Assembly *asm1 = EEDB::Assembly::fetch_by_id(db1, 16);
  asm1->display_info();

  asm1->store(db);

  printf("== Assembly::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    assemblies = EEDB::Assembly::fetch_all(db);
    for(idx=0; idx<assemblies.size(); idx++) {
      assemblies[idx]->display_info();
      count++;
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

}


void test_chrom() {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  int                      loop=1;
  EEDB::Chrom              *chrom;
  vector<MQDB::DBObject*>  chroms;

  MQDB::Database *db1 = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_core");
  MQDB::Database *db = new MQDB::Database("mysql://severin:severin@@osc-mysql.gsc.riken.jp:3306/eeDB_jms_test5");

  EEDB::Chrom *chr1 = EEDB::Chrom::fetch_by_id(db1, 200);
  chr1->display_info();

  chr1->assembly()->store(db);
  chr1->store(db);

  printf("== Chrom::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    chroms = EEDB::Chrom::fetch_all(db);
    for(idx=0; idx<chroms.size(); idx++) {
      chrom = (EEDB::Chrom*)chroms[idx];
      chrom->display_info();
      count++;
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}



void test_rand_chrom(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      id, count, loop=1000000;
  EEDB::Chrom              *chrom;

  printf("== Chrom rand-test == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    id = (random() % 243)+1;
    chrom = EEDB::Chrom::fetch_by_id(db, id);
    if(chrom!=NULL) { count++; }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}



void test_leaks(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  EEDB::Chrom              *chrom;
  vector<MQDB::DBObject*>  chroms;

  printf("== Chrom::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(1){
    chroms = EEDB::Chrom::fetch_all(db);
    for(idx=0; idx<chroms.size(); idx++) {
      chrom = (EEDB::Chrom*)chroms[idx];
      count++;
      chrom->release();
      //delete chrom;
    }
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
    printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  }
}


void test_leaks2(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  EEDB::Assembly           *assembly;
  vector<EEDB::Assembly*>  assemblies;

  gettimeofday(&starttime, NULL);
  count=0;
  while(1){
    idx = random() % 5;
    assembly = EEDB::Assembly::fetch_by_id(db, 1);
    count++;
    assembly->release();
    if(count % 10000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
    }
  }
}



void direct_db_test(Database *db) {
  struct timeval                  starttime,endtime,difftime;
  int                             count, idx;
  int                             loop=1;
  void                            *stmt;
  map<string, dynadata>           row_map;
  map<string, dynadata>::iterator it;

  printf("== direct database == \n");
  db = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_core");
  db->uuid("9bc1e9f8-8a31-11df-a042-080027935aac");

  printf("%s\n", db->xml().c_str());
  if(db->get_connection()) { printf("looks good!\n"); }

  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    //stmt = db->prepare_fetch_sql("select * from chrom order by chrom_length limit 3;");

    //stmt = db->prepare_fetch_sql("select * from assembly join chrom using (assembly_id) where ucsc_name like 'hg%';");
    //stmt = db->prepare_fetch_sql("select * from chrom_chunk join chrom using (chrom_id);");
    //stmt = db->prepare_fetch_sql("select * from chrom order by chrom_length limit 3;");
    //stmt = db->prepare_fetch_sql("select * from chrom_chunk;");

    stmt = db->prepare_fetch_sql("select * from chrom join assembly using(assembly_id) order by chrom_length ;");

    //stmt = db->prepare_fetch_sql("select * from assembly");
    //stmt = db->prepare_fetch_sql("SELECT * FROM assembly WHERE ucsc_name like ?", "s", "hg18");
    //stmt = db->prepare_fetch_sql("SELECT * FROM assembly WHERE ucsc_name like ?", "s", "hg18");
    //stmt = db->prepare_fetch_sql("SELECT * FROM assembly WHERE ncbi_version like ? or ucsc_name like ?", "ss", "hg18", "mm9");
    //stmt = db->prepare_fetch_sql("SELECT * FROM feature limit 3");



    while(db->fetch_next_row_map(stmt, row_map)) {
      count++;

      // show content:
      printf("row\n");
      for ( it=row_map.begin() ; it != row_map.end(); it++ ) {
        printf("  [%s]  = %s\n", (*it).first.c_str(), (*it).second.display_desc().c_str());
      }
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  exit(1);
}


void direct_maprow_test(Database *db) {
  struct timeval                  starttime,endtime,difftime;
  int                             count, idx;
  int                             loop=100;
  void                            *stmt;
  map<string, dynadata>           row_map;
  map<string, dynadata>::iterator it;

  printf("== direct map_row query == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    //stmt = db->prepare_fetch_sql("select * from assembly join chrom using (assembly_id) where ucsc_name like 'hg%';");
    //stmt = db->prepare_fetch_sql("select * from chrom_chunk join chrom using (chrom_id);");
    //stmt = db->prepare_fetch_sql("select * from chrom order by chrom_length;");
    //stmt = db->prepare_fetch_sql("select * from chrom_chunk;");
    stmt = db->prepare_fetch_sql("select * from chrom join assembly using(assembly_id) order by chrom_length;");
    while(db->fetch_next_row_map(stmt, row_map)) {
      count++;

      /*
      // show content:
      printf("row\n");
      for ( it=row_map.begin() ; it != row_map.end(); it++ ) {
        printf("  [%s]  = %s\n", (*it).first.c_str(), (*it).second.display_desc().c_str());
      }
      */
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_metadata(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  int                      loop=100;
  EEDB::Metadata           *data;
  vector<MQDB::DBObject*>  mdata;

  db = new MQDB::Database("sqlite:///disk3/zenbu/dbs/Mouse_Embryoid_Body_RNAseq_exonic.oscdb/oscdb.sqlite");
  printf("\n== Metadata::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    mdata = EEDB::Metadata::fetch_all(db);
    for(idx=0; idx<mdata.size(); idx++) {
      data = (EEDB::Metadata*)mdata[idx];
      //data->display_info();
      count++;
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_metadata2(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  int                      loop=100;
  EEDB::Metadata           *md;
  EEDB::MetadataSet        *mdset = new EEDB::MetadataSet;

  md = mdset->add_tag_data("desc", "this is a test of keyword extraction CBX4 CBX7.1 norm_tag-count CBX5/7 (when this works)  \"tag count\" <norm&raw>");
  printf("%s\n", mdset->xml().c_str());
  md->extract_keywords(mdset);
  printf("-- after keyword extraction\n");
  printf("%s\n", mdset->xml().c_str());

}



void test_object() {
  struct timeval      starttime,endtime,difftime;
  int                 count;
  int                loop=10000000;
  string             type = "tagcount";
  EEDB::Datatype     *datatype = EEDB::Datatype::get_type("tagcount");
  EEDB::Experiment   *experiment = new EEDB::Experiment;

  printf("\n== Object new/delete test == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    EEDB::Feature *obj = new EEDB::Feature;
    EEDB::MetadataSet *mds = obj->metadataset();
    obj->add_expression(experiment, datatype, 123.0);
    count++;
    delete obj;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));


  printf("\n== Object realloc test == \n");
  loop=10000000;
  count=0;
  gettimeofday(&starttime, NULL);
  while(loop-- > 0) {
    EEDB::Feature *obj = EEDB::Feature::realloc();
    EEDB::MetadataSet *mds = obj->metadataset();
    obj->add_expression(experiment, datatype, 123.0);
    count++;
    obj->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_symbol(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count=0, idx;
  int                      loop=1;
  EEDB::Symbol           *data;
  vector<MQDB::DBObject*>  mdata;

  db = new MQDB::Database("sqlite:///disk3/zenbu/dbs/Mouse_Embryoid_Body_RNAseq_exonic.oscdb/oscdb.sqlite");
  printf("\n== Symbol::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    printf("%ld symbols\n", EEDB::Symbol::get_count_symbol_search(db, "hg19"));
    //mdata = EEDB::Symbol::fetch_all_symbol_search(db, "hg19");
    mdata = EEDB::Symbol::fetch_all(db);
    for(idx=0; idx<mdata.size(); idx++) {
      data = (EEDB::Symbol*)mdata[idx];
      printf("%s", data->xml().c_str());
      count++;
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_mdset(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  int                      loop=100;
  EEDB::MetadataSet        *mdset;
  EEDB::Metadata           *data;
  vector<MQDB::DBObject*>  mdata;

  printf("\n== Metadataset == \n");
  gettimeofday(&starttime, NULL);

  count=0;
  while(loop-- > 0) {
    mdset = new EEDB::MetadataSet;

    mdata = EEDB::Symbol::fetch_all(db);
    mdset->add_metadata(mdata);
    mdata = EEDB::Symbol::fetch_all(db);
    mdset->add_metadata(mdata);
    mdata = EEDB::Symbol::fetch_all(db);
    mdset->add_metadata(mdata);
    mdata = EEDB::Symbol::fetch_all(db);
    mdset->add_metadata(mdata);

    //mdata = EEDB::Metadata::fetch_all(db);
    //mdset->add_metadata(mdata);

    mdset->add_tag_symbol("keyword", "hg19");
    count += mdset->size();

    mdset->remove_duplicates();
    mdset->remove_duplicates();
    mdset->release();
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_featuresource(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx;
  int                      loop=1;
  vector<MQDB::DBObject*>  fsrcs;

  printf("\n== FeatureSource::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  string xml_buffer;
  while(loop-- > 0) {
    fsrcs = EEDB::FeatureSource::fetch_all(db);
    printf("after fetch_all\n");
    for(idx=0; idx<fsrcs.size(); idx++) {
      EEDB::FeatureSource *source = (EEDB::FeatureSource*)fsrcs[idx];
      source->xml(xml_buffer);
      printf("%s", xml_buffer.c_str());
      xml_buffer.clear();
      printf("\n====\n%s", source->display_contents().c_str());
      count++;
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_experiment(MQDB::Database *db) {
  struct timeval           starttime,endtime,difftime;
  int                      count, idx, mdcount;
  double                   mdbytes;
  int                      loop=10000;
  vector<MQDB::DBObject*>  sources;

  printf("\n== Experiment::fetch_all == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  mdcount=0;
  mdbytes=0;
  while(loop-- > 0) {
    db->disconnect();
    sources = EEDB::Experiment::fetch_all(db);
    for(idx=0; idx<sources.size(); idx++) {
      EEDB::Experiment *source = (EEDB::Experiment*)sources[idx];

      source->metadataset();
      mdcount += source->metadataset()->size();
      mdbytes += source->metadataset()->data_size();

      //printf("%s", source->xml().c_str());
      //source->metadataset();
      //source->metadataset();
      //printf("%s", source->xml().c_str());
      //printf("\n====\n%s", source->display_contents().c_str());
      count++;
      source->release();
    }
  }
  mdbytes /= 1024.0*1024.0;
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  printf("%1.3f md/sec\n", mdcount /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  printf("[%1.3f] %1.3f mbytes/sec\n",mdbytes,  mdbytes /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_dbstream(Database *db) {
  struct timeval                  starttime,endtime,difftime;
  int                             count, idx;
  int                             loop=1;
  MQDB::DBStream*                 stream;
  EEDB::Experiment*               source;
  MQDB::DBObject*                 obj;

  printf("== dbstream test == \n");
  gettimeofday(&starttime, NULL);
  count=0;
  while(loop-- > 0) {
    stream = new MQDB::DBStream;
    stream->database(db);
    stream->class_create(EEDB::Experiment::create);
    stream->prepare_sql("select * from experiment");
    while((obj = stream->next_in_stream())) {
      count++;
      source = (EEDB::Experiment*) obj;
      //printf("%s", source->simple_xml().c_str());
      printf("%s", source->xml().c_str());
      //printf("\n====\n%s", source->display_contents().c_str());
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}

void test_peer() {
  struct timeval                  starttime,endtime,difftime;

  printf("== peer test == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  EEDB::Peer  *peer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  if(!peer) { printf("trouble with connecting\n"); return; }
  
  cout << "registry peer : " << peer->xml();
  cout << "   " << peer->peer_database()->xml();
  if(peer->source_stream()) { printf("OK source_stream\n"); }
  else { printf("hmmm problem with source_stream\n"); }
  
  peer->disconnect();
  if(!(peer->retest_is_valid())) { printf("hmm trouble with retest\n"); }
  
}

void test_peers(Database *db) {
  struct timeval                  starttime,endtime,difftime;
  int                             count, idx;
  int                             loop=1;
  vector<MQDB::DBObject*>         peers;
  map<string, EEDB::Peer*>            uuid_peers;
  map<string, EEDB::Peer*>::iterator  it;

  printf("\n== peer test == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  //EEDB::Peer  *regpeer = new EEDB::Peer("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_fantom3");
  //EEDB::Peer  *regpeer = new EEDB::Peer("mysql://read:read@@localhost:3306/eedb_vbox_registry");
  //EEDB::Peer  *regpeer = new EEDB::Peer("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = new EEDB::Peer("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = new EEDB::Peer("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite");
  EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  if(regpeer) {
    cout << "registry peer : " << regpeer->xml();
    cout << "   " << regpeer->peer_database()->xml();
    if(regpeer->source_stream()) { printf("OK source_stream\n"); }
    else { printf("hmmm problem with source_stream\n"); }
    regpeer->source_stream()->stream_peers();
  }
  printf("done with registry\n");

  printf("===== all_network_peers\n");
  gettimeofday(&starttime, NULL);
  regpeer->all_network_peers(7, uuid_peers);
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    cout << (*it).second->xml();
    (*it).second->xml();
  }
  printf("%d peers\n", (int)uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  count=0;
  while(loop-- > 0) {
    peers = EEDB::Peer::fetch_all(db);
    for(idx=0; idx<peers.size(); idx++) {
      EEDB::Peer *peer = (EEDB::Peer*)peers[idx];
      peer->is_valid();

      //peer->xml();
      cout << peer->xml();
      EEDB::SPStreams::SourceStream  *source = peer->source_stream();
      if(source != NULL) { source->display_info(); }

      /*
      EEDB::Database *db = peer->peer_database();
      if(db) { 
        cout << "   " << db->full_url() << endl; 
        cout << "   " << db->url() << endl; 
        cout << "   " << db->public_url() << endl; 
      }
      */
      peer->is_valid();
      //if(peer->test_is_valid()) { cout << "   PEER is valid\n"; }
      //printf("\n====\n%s", source->display_contents().c_str());
      count++;
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));


  string uuid = "51AD6440-FBFE-11DD-8787-5096FEFA0F18";
  printf("==== search uuid[%s]\n", uuid.c_str());
  gettimeofday(&starttime, NULL);
  EEDB::Peer *peer = regpeer->find_peer(uuid, 7);
  if(peer!=NULL) { printf("  found: %s", peer->xml().c_str()); }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  gettimeofday(&starttime, NULL);
  peer = regpeer->find_peer(uuid, 7);
  if(peer!=NULL) { printf("  found: %s", peer->xml().c_str()); }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("===== all_network_peers\n");
  gettimeofday(&starttime, NULL);
  regpeer->all_network_peers(7, uuid_peers);
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    cout << (*it).second->xml();
    (*it).second->xml();
  }
  printf("%d peers\n", (int)uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_uuid() {
  //boost::uuids::uuid dns_namespace_uuid; // initialize to {6ba7b810-9dad-11d1-80b4-00c04fd430c8}
  //boost::uuids::name_generator gen(dns_namespace_uuid);
  //boost::uuids::uuid u = gen("boost.org");
  //boost::uuids::uuid u = gen("boost.org");


  //boost::uuids::uuid u = boost::uuids::uuid(boost::uuids::random_generator()());
  //uuid_b64string(u);

  printf("%s\n", MQDB::uuid_b64string().c_str());
  string uuid = MQDB::uuid_hexstring();
  printf("%s\n", uuid.c_str());

  exit(0);
}


string uuid_b64string(boost::uuids::uuid const& u) {
  char b64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  char str[23];
  boost::uuids::uuid::const_iterator i_data;
  std::size_t i=0;
  string b64string;
  unsigned int   b64a, b64b, b64c, b64d;
  unsigned long int   val64;
  unsigned char  bytes[18];

  memset(bytes, 0, 18);
  memset(str, 0, 23);
  for(i_data = u.begin(); i_data!=u.end(); ++i_data, ++i) {
    bytes[i] = static_cast<unsigned char>(*i_data);
    //printf("%d [%d]\n", i, bytes[i]);
  }
  for(i=0; i<=5; i++) {
    val64 = bytes[i*3] + bytes[(i*3)+1]*256 + bytes[(i*3)+2]*256*256;
    b64a = val64 & 63;
    b64b = (val64/64) & 63;
    b64c = (val64/64/64) & 63;
    b64d = (val64/64/64/64) & 63;
    //printf("%d %ld [%d %d %d %d]\n", i, val64, b64a, b64b, b64c, b64d);

    str[i*4] = b64[b64a];
    if(i<5) {
      str[(i*4)+1] = b64[b64b];
      str[(i*4)+2] = b64[b64c];
      str[(i*4)+3] = b64[b64d];
    } else {
      if(b64b>0) { str[(i*4)+1] = b64[b64b]; }
    }
  }

  b64string = str;
  printf("%s\n", b64string.c_str());
  return b64string;
}


void test_spstream() {
  struct timeval                  starttime,endtime,difftime;
  int                             count, idx;
  int                             loop=30000000;
  vector<MQDB::DBObject*>         peers;
  MQDB::DBObject                  *obj;

  printf("== stream test == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  count=0;
  EEDB::SPStream   *stream = new EEDB::SPStream;
  EEDB::SPStreams::Dummy  *stream2 = new EEDB::SPStreams::Dummy;
  stream->source_stream(stream2);

    stream->disconnect();
    stream->disconnect();
    stream->stream_clear();
    stream->stream_by_named_region("hg18", "chr3", 123456, 73435563463);
    //stream->stream_by_named_region("hg18", "chr3", -1, -1);
    //stream->stream_features_by_metadata_search(options);
    stream->stream_data_sources();
    stream->stream_chromosomes("hg18", "");
    stream->stream_peers();
    stream->reload_stream_data_sources();
    stream->reset_stream_node();

  long int count2=0;
  while(loop-- > 0) {
    obj = stream->next_in_stream();
    //obj = stream->fetch_object_by_id("googoog");

      /*
      EEDB::Database *db = peer->peer_database();
      if(db) {
        cout << "   " << db->full_url() << endl;
        cout << "   " << db->url() << endl;
        cout << "   " << db->public_url() << endl;
      }
      */
      //peer->test_is_valid();
      //if(peer->test_is_valid()) { cout << "   PEER is valid\n"; }
      //printf("\n====\n%s", source->display_contents().c_str());
      count++;
      if(obj!=NULL) { 
        count2++; 
        obj->release(); 
      }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%ld objects\n", count2);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  //sleep(10000);
  //exit(1);

}


void test_sourcestream(Database *db) {
  struct timeval                  starttime,endtime,difftime;
  int                             count=0, idx;
  int                             loop=1;
  EEDB::DataSource*               source;
  MQDB::DBObject*                 obj;
  EEDB::SPStreams::SourceStream   *stream;


  printf("== source stream test == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  EEDB::Peer  *peer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_fantom3");
  if(peer ==NULL) { return; }
  cout << peer->xml();
  stream = peer->source_stream();
  if(stream!=NULL) { printf("OK source_stream\n"); }
  else { printf("hmmm problem with source_stream\n"); }

  /*
  stream->stream_data_sources();
  stream->reload_stream_data_sources();
  map<string, EEDB::DataSource*> sources_cache = stream->data_sources_cache();
  map<string, EEDB::DataSource*>::iterator it;

  for(it = sources_cache.begin(); it != sources_cache.end(); it++) {
    source = (*it).second;
    if(source->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)source)->xml(); }
    if(source->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)source)->xml(); }
    if(source->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)source)->xml(); }
  }
  count = sources_cache.size();
  */

  stream->stream_data_sources("FeatureSource", "liver");
  while((obj = stream->next_in_stream())) {
    count++;
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->xml(); }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_peers2(Database *db) {
  struct timeval                      starttime,endtime,difftime;
  int                                 count, idx;
  int                                 loop=1;
  double                              runtime;
  vector<MQDB::DBObject*>             peers;
  map<string, EEDB::Peer*>            uuid_peers;
  map<string, EEDB::Peer*>::iterator  it;

  printf("== peer test == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite");
  EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  if(regpeer==NULL) { printf("cannot connect to registry\n"); return; }

  cout << "registry peer : " << regpeer->xml();
  cout << "   " << regpeer->peer_database()->xml();
  if(regpeer->source_stream()) { printf("OK source_stream\n"); }
  else { printf("hmmm problem with source_stream\n"); }
  regpeer->source_stream()->stream_peers();
  printf("done with registry\n");

  printf("===== all_network_peers\n");
  gettimeofday(&starttime, NULL);
  regpeer->all_network_peers(7, uuid_peers);
  printf("after search\n");
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    cout << (*it).second->xml();
  }
  printf("%d peers\n", (int)uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  runtime = (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0;
  if(runtime < 1000.0) {
    printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  } else {
    printf("%1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  }


  const char* uuids[] = {"DEA59E82-A39E-11DF-AFE2-8748230DA12C","3C31351E-A509-11DF-82D2-A4D395ED9DB2","42FCB56E-A4F8-11DF-B461-5ECBA6DCCBD4","C8C5B5F4-A509-11DF-850F-F566230DA12C","367A5E0A-A4F7-11DF-9626-9C507C4384B9","CB859DE4-A39D-11DF-9B68-DC327C4384B9","6745FF08-A4F7-11DF-B6AB-D665230DA12C","5F7E28B6-A3A0-11DF-BFBE-343132A70D4D","C71BA524-A509-11DF-8562-27E43B930397","01310FB4-A4F7-11DF-BA40-31264348AA26","14D308FE-A3A0-11DF-B59C-383132A70D4D","D6BFAF96-A4F7-11DF-A35C-8E277E91A064","E4B9369E-A4F7-11DF-AF02-08E33B930397","E6E09A16-A4F7-11DF-A865-9411EA258974","E945757A-A514-11DF-B1F9-2A547C4384B9","40EA19BA-A50C-11DF-A000-229DB7AEB8CC","C4435CF0-A510-11DF-A3EC-65B94DD6F9F8","6B1BAED8-A511-11DF-B8E1-8BCEA6DCCBD4","47C62C80-A514-11DF-96E9-E5D595ED9DB2","30A0216E-A514-11DF-AB95-28BA4DD6F9F8","9CB1A152-A514-11DF-90CF-E5E53B930397","FE78BA96-A510-11DF-AEB2-CB284348AA26","64F5BB0E-A514-11DF-8AD3-C32A7E91A064","3A686006-A39F-11DF-8ECC-333132A70D4D","B5001FFA-A509-11DF-8640-B6B74DD6F9F8","CD1AC5FA-A508-11DF-94A7-1A274348AA26","F481E38C-A510-11DF-9A92-52537C4384B9","1DA23226-A511-11DF-BFA8-362A7E91A064","116E68EA-A515-11DF-A0E1-9A15EA258974","139F87B8-A50E-11DF-8445-DD13EA258974","9188BEBE-A50F-11DF-ACC3-B714EA258974","90680080-A514-11DF-AC25-28547C4384B9","25C63A14-A3A0-11DF-AB2B-8648230DA12C","862BD3AE-A509-11DF-A7C1-CECCA6DCCBD4","7BAD7D9E-A511-11DF-9B6F-8ACEA6DCCBD4","C2D29EFE-A514-11DF-AD5D-A2294348AA26","C3080AA8-A514-11DF-A454-4FCFA6DCCBD4","81E28050-A50D-11DF-ADAE-E8CF31A70D4D","1385DE80-A50E-11DF-AFDF-6ED495ED9DB2","13A4CFDE-A50E-11DF-A91B-F5274348AA26","94D259AE-A3AC-11DF-91F4-517FB7AEB8CC","07849ABA-A511-11DF-BAF9-BDD031A70D4D","C30D3064-A514-11DF-8C03-94D131A70D4D","EB701A80-A514-11DF-AC58-A3294348AA26","415CB58C-A50D-11DF-AC43-7BB84DD6F9F8","DDC4859A-A39F-11DF-98C1-EAADA6DCCBD4","E9EDCF20-A4F8-11DF-A583-7EB64DD6F9F8","0D19B248-A3A0-11DF-B59E-EC327C4384B9","2707383A-A4F7-11DF-B279-D765230DA12C","A446B0D4-A509-11DF-93E7-B4B74DD6F9F8","506836FE-A509-11DF-9B50-77287E91A064","69DE58FA-A4F7-11DF-9D83-2A9BB7AEB8CC","F8BAB090-A511-11DF-9348-58E53B930397","362B356E-A515-11DF-A0FD-3469230DA12C","A737D8A2-A4F7-11DF-97FB-07E33B930397","E941BF20-A514-11DF-BBAB-9915EA258974","AAF9EBCE-A394-11DF-BF2F-C3A33B930397","0DE9D762-A39F-11DF-A7FC-E5327C4384B9","5B0838F4-A39F-11DF-AA8A-8848230DA12C","57DD56B4-A4F8-11DF-90BF-33D295ED9DB2","B501BA5E-A509-11DF-9798-A2D395ED9DB2","A65CAE3E-A39F-11DF-84D4-2F3132A70D4D","DF765CC8-A508-11DF-8B5B-CFCCA6DCCBD4","91DBED90-A510-11DF-B73A-0A9EB7AEB8CC","7255E3A0-A514-11DF-94D3-E6D595ED9DB2","8CEEA6AA-A3AE-11DF-88A8-547FB7AEB8CC","CAF667B6-A508-11DF-9B35-599CB7AEB8CC","5CA8AB36-A39E-11DF-9942-E8ADA6DCCBD4","1BC5579E-A511-11DF-AFEF-0ED595ED9DB2","AA299BFA-A514-11DF-98A4-95D131A70D4D","0DE3690C-A509-11DF-80D4-0CCF31A70D4D","CA793F18-A4F7-11DF-B682-23CE31A70D4D","A42C6B7A-A509-11DF-AFD7-8D517C4384B9","AD0FACBC-A508-11DF-94F9-5A9CB7AEB8CC","1C99123A-A509-11DF-856D-C712EA258974","3F0E8F18-A4F8-11DF-9430-31D295ED9DB2","6BE9604E-A3A4-11DF-A07D-557FB7AEB8CC","0844E7AC-A4F8-11DF-85EB-5DCBA6DCCBD4","7CA4FB9A-A508-11DF-A541-C812EA258974","83B174EA-A50D-11DF-BB2A-77527C4384B9","33F5CB00-A511-11DF-A312-7068230DA12C","11A43C9E-A511-11DF-AB57-66B94DD6F9F8","6B1D43A6-A511-11DF-8849-7168230DA12C","35EEE47A-A514-11DF-BAD4-CC9EB7AEB8CC","171BD220-A50E-11DF-86A7-F6274348AA26","4CEC3FD0-A50D-11DF-AC23-8667230DA12C","F6BBC300-A50D-11DF-BF7D-DC13EA258974","4ED294B6-A50D-11DF-80A7-A0CDA6DCCBD4","1386DCE0-A50E-11DF-98EB-E2CF31A70D4D","F6EE2886-A50D-11DF-AC44-7B527C4384B9","221B0F58-A511-11DF-8940-0B9EB7AEB8CC","171CF786-A50E-11DF-B195-5D297E91A064","CFA93B9E-A50D-11DF-9845-B8E43B930397","F6FF0AC0-A50D-11DF-8D1B-5B297E91A064"};

  int uuid_count = sizeof(uuids)/sizeof(const char*);
  printf("==== search uuids [cnt=%d]\n", uuid_count);
  gettimeofday(&starttime, NULL);
  uuid_peers.clear();
  for(int i=0; i<uuid_count; i++) {
    uuid_peers[uuids[i]] = NULL;
  }
  if(regpeer->find_peers(uuid_peers, 10)) { printf("cool found everything\n"); }
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    EEDB::Peer *peer = (*it).second;
    if(peer == NULL) { continue; }
    //cout << peer->xml();
    EEDB::SPStream *stream = peer->source_stream(); 
    if(stream==NULL) { continue; }
    stream->stream_data_sources("Experiment");
    while(MQDB::DBObject *obj = stream->next_in_stream()) {
      if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
      if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
      if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  runtime = (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0;
  if(runtime < 1000.0) {
    printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  } else {
    printf("%1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  }
}


void test_multistream(Database *db) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::MultiMergeStream     *mmerge = new EEDB::SPStreams::MultiMergeStream;
  EEDB::SPStream                        *stream = NULL;
  string                                filter;

  // this test builds a MultiMergeStream and reuses it for various tests

  //filter = "I87-DB";
  filter = "(brain and !cortex) or (liver gw)";

  printf("== peer test == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@localhost:3306/eedb_vbox_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_vbox_local_registry.sqlite");

  if(regpeer) {
    cout << "registry peer : " << regpeer->xml();
    cout << "   " << regpeer->peer_database()->xml();
    if(regpeer->source_stream()) { printf("OK source_stream\n"); }
    else { printf("hmmm problem with source_stream\n"); }
    //regpeer->source_stream()->stream_peers();
    regpeer->retest_is_valid();
    regpeer->retest_is_valid();
    regpeer->retest_is_valid();
    regpeer->retest_is_valid();
  }
  printf("done with registry init\n");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //EEDB::Peer *peer = regpeer->find_peer("C957FFA2-F8AF-11DD-99B1-B083FEFA0F18", 7);
  //if(peer) { mmerge->add_sourcestream(peer->source_stream()); }

  count=0;
  printf("\n===== all_network_peers\n");
  gettimeofday(&starttime, NULL);
  regpeer->all_network_peers(7, uuid_peers);
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    EEDB::Peer *peer = (*it).second;
    //cout << peer->xml();
    mmerge->add_sourcestream(peer->source_stream());
  }
  printf("%d peers\n", (int)uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  stream = mmerge;
  
  printf("\n===== stream all experiments\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_data_sources("Experiment");
  //stream->stream_data_sources("Experiment", "(brain and !cortex) or (liver gw)");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    /*
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    */
    count++;
  }
  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  printf("\n===== stream all feature_sources\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_data_sources("FeatureSource");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    /*
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    */
    count++;
  }
  printf("%d feature_sources\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  printf("\n===== stream filtered experiments\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_data_sources("Experiment", filter);
  //stream->stream_data_sources("Experiment");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    /*
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    */
    count++;
  }
  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("===== stream filtered experiments again\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_data_sources("Experiment", filter);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    /*
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    */
    count++;
  }
  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  sleep(1000);
}


void test_federatedstream(EEDB::Peer *regpeer) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;

  //
  // this test builds a MultiMergeStream and reuses it for various tests
  //

  printf("\n====== test_federatedstream == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_public_configs");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@localhost:3306/eedb_vbox_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_vbox_local_registry.sqlite");

  if(regpeer) {
    cout << "  registry peer : " << regpeer->xml();
    cout << "  " << regpeer->peer_database()->xml();
    if(regpeer->source_stream()) { printf("OK source_stream\n"); }
    else { printf("hmmm problem with source_stream\n"); }
    //regpeer->source_stream()->stream_peers();
    regpeer->retest_is_valid();
    regpeer->retest_is_valid();
    regpeer->retest_is_valid();
    regpeer->retest_is_valid();
    fstream->add_seed_peer(regpeer);
  }
  printf("done with registry init\n");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  /*
  //MQDB::Database *userdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@@localhost:3306/eedb_vbox_users");
  MQDB::Database *userdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@@osc-mysql.gsc.riken.jp:3306/eeDB_zenbu_login");
  user = EEDB::User::fetch_by_openID(userdb, "https://id.mixi.jp/28555316");
  if(user) {
    cout << user->xml();
    if(user->user_registry()) {
      fstream->add_seed_peer(user->user_registry());
    }

    vector<MQDB::DBObject*>            collaborations = user->member_collaborations();
    vector<MQDB::DBObject*>::iterator  it2;
    for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
      EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
      fstream->add_seed_peer(collab->group_registry());
    }
  }
  */

  fstream->set_peer_search_depth(7);
  stream = fstream;

  /*
  count=0;
  printf("  -- all_network_peers\n");
  regpeer->all_network_peers(7, uuid_peers);
  for(it = uuid_peers.begin(); it != uuid_peers.end(); it++) {
    EEDB::Peer *peer = (*it).second;
    peer->test_is_valid();
    cout << peer->xml();
  }
  printf("%d peers\n", (int)uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */


  count=0;
  printf("  -- stream all peers\n");
  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    //cout << peer->xml();
    count++;
  }
  printf("%d peers\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  

  /*
  printf("\n===== stream one peer\n");
  count=0;
  //fstream->add_peer_id_filter("E74B4642-700C-11DF-A2D6-D21C252AEFD0");
  fstream->add_peer_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331");
  //fstream->add_peer_id_filter("E74B4642-700C-11DF-A2D6-D21C252AEFD0");
  //fstream->add_peer_id_filter("134BD34A-416B-11DF-A9FC-D0839060A881");
  //fstream->add_peer_id_filter("0780F42E-8AB7-11DF-9715-C264FC50288E");
  //fstream->add_peer_id_filter("FFCB9E80-067E-11DF-B8A9-173DCF25AF61");

  string source_ids="8251C406-772D-11DE-8196-3953F616D049::1:::FeatureSource,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::1:::FeatureSource,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::1:::FeatureSource,8251C406-772D-11DE-8196-3953F616D049::3:::Experiment,8251C406-772D-11DE-8196-3953F616D049::5:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::4:::Experiment,8251C406-772D-11DE-8196-3953F616D049::9:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::8:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::8:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::3:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::1:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::5:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::10:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::7:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::3:::Experiment,8251C406-772D-11DE-8196-3953F616D049::4:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::9:::Experiment,8251C406-772D-11DE-8196-3953F616D049::2:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::7:::Experiment,8251C406-772D-11DE-8196-3953F616D049::11:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::6:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::2:::Experiment,8251C406-772D-11DE-8196-3953F616D049::10:::Experiment,8251C406-772D-11DE-8196-3953F616D049::1:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::4:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::9:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::2:::Experiment,8251C406-772D-11DE-8196-3953F616D049::6:::Experiment,94F8FB24-772D-11DE-B1E1-6ACE4D75E38D::5:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::10:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::1:::Experiment,7FA2D560-772D-11DE-BA5D-75E1CF384AFC::6:::Experiment,8251C406-772D-11DE-8196-3953F616D049::8:::Experiment";
  char* buf = (char*)malloc(source_ids.size()+2);
  strcpy(buf, source_ids.c_str());
  char *p1 = strtok(buf, ", \t");
  while(p1!=NULL) {
    if(strlen(p1) > 0) {
      fstream->add_source_id_filter(p1);
    }
    p1 = strtok(NULL, ", \t");
  }
  free(buf);


  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    cout << peer->xml();
    count++;
  }
  printf("%d peers\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */
  

  printf("  -- stream all experiments - no meta\n");
  count=0;
  stream->stream_data_sources("Experiment");

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec after stream_data_sources() setup\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    //if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
    //if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
    //if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    count++;
  }
  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  /*
  printf("  === stream all feature_sources\n");
  count=0;
  stream->stream_data_sources("FeatureSource");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    //if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->simple_xml(); }
    //if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->simple_xml(); }
    //if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->simple_xml(); }
    count++;
  }
  printf("%d feature_sources\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */


  //filter = "I87-DB";
  filter = "(brain and !cortex) or (liver gw)";
  //filter = "fantom4 cage";

  printf("  -- stream filtered experiments\n");
  count=0;
  stream->stream_data_sources("Experiment", filter);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec after stream_data_sources() setup\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  string xml_buffer;
  xml_buffer.reserve(100000);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    obj->simple_xml(xml_buffer);
    cout << xml_buffer;
    xml_buffer.clear();
    count++;
  }
  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_experiment_stream(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;
  vector<EEDB::Peer*>::iterator         seed_it;

  //
  // this test builds a MultiMergeStream and reuses it for various tests
  //

  printf("\n====== test_experiment_stream == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  printf("done with registry init\n");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  stream = fstream;

  //filter = "I87-DB";
  //filter = "(brain and !cortex) or (liver gw)";
  filter = "fantom3 !brain !cortex !liver";
  //filter = "fantom4 cage";

  printf("  === stream filtered experiments [%s]\n", filter.c_str());
  filter ="fantom3"; count=0;
  stream->stream_data_sources("Experiment", filter);
  while(MQDB::DBObject *obj = stream->next_in_stream()) { count++; }
  printf("%d FANTOM3 experiments\n", count);

  filter ="fantom3 !brain"; count=0;
  stream->stream_data_sources("Experiment", filter);
  while(MQDB::DBObject *obj = stream->next_in_stream()) { count++; }
  printf("%d FANTOM3 !brain experiments\n", count);


  filter = "fantom3 !brain !cortex !liver !hippocampus"; count=0;
  stream->stream_data_sources("Experiment", filter);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
     cout << obj->simple_xml();
    count++;
  }
  printf("%d full filter experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_stream_object() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;

  printf("== test_stream_object == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@localhost:3306/eedb_vbox_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_vbox_local_registry.sqlite");

  //MQDB::Database *userdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@@localhost:3306/eedb_vbox_users");
  MQDB::Database *userdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@@osc-mysql.gsc.riken.jp:3306/eeDB_zenbu_login");
  user = EEDB::User::fetch_by_openID(userdb, "https://id.mixi.jp/28555316");
  if(user) {
    cout << user->xml();
    if(user->user_registry()) {
      fstream->add_seed_peer(user->user_registry());
    }

    vector<MQDB::DBObject*>            collaborations = user->member_collaborations();
    vector<MQDB::DBObject*>::iterator  it2;

    for(it2 = collaborations.begin(); it2 != collaborations.end(); it2++) {
      EEDB::Collaboration *collab = (EEDB::Collaboration*)(*it2);
      cout << collab->xml();
      fstream->add_seed_peer(collab->group_registry());
    }
  }

  //last put in the public registry
  if(regpeer) {
    cout << "registry peer : " << regpeer->xml();
    cout << "   " << regpeer->peer_database()->xml();
    fstream->add_seed_peer(regpeer);
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  userdb->disconnect();
  stream = fstream;


  printf("\n===== object\n");
  gettimeofday(&starttime, NULL);
  string fid ="72DA22E8-B95F-48B8-B7E3-3698E820E331::3:::Experiment";
  //string fid ="C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::24892376";
  //string fid ="72DA22E8-B95F-48B8-B7E3-3698E820E331::10379148"; //F4 CAGE L1 promoter with expression
  MQDB::DBObject *obj = stream->fetch_object_by_id(fid);
  if(obj) { 
    printf("returned an object\n");
    //string uuid = obj->peer_uuid();
    //EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    //if(peer) { printf("%s\n", peer->xml().c_str());  }
    if(obj->classname() == EEDB:: Feature::class_name) { 
      cout << ((EEDB::Feature*)obj)->xml();
      ((EEDB::Feature*)obj)->display_info(); 
      cout << ((EEDB::Feature*)obj)->display_contents();
    }
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->xml(); }

    obj->release();
  }
  stream->disconnect();  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("\n===== object again\n");
  gettimeofday(&starttime, NULL);
  obj = stream->fetch_object_by_id(fid);
  if(obj) { 
    if(obj->classname() == EEDB:: Feature::class_name) { 
      //cout << ((EEDB::Feature*)obj)->xml();
    }
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->xml(); }

    obj->release();
  }
  stream->disconnect();  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

}


void test_dbcache() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;

  printf("== test_dbcache == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");

  EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_LSA_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eeDB_OSC_registry2.sqlite");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("mysql://read:read@@localhost:3306/eedb_vbox_registry");
  //EEDB::Peer  *regpeer = EEDB::Peer::new_from_url("sqlite:///eeDB/dbs/eedb_vbox_local_registry.sqlite");

  if(regpeer) {
    cout << "registry peer : " << regpeer->xml();
    fstream->add_seed_peer(regpeer);
  }
  fstream->set_peer_search_depth(7);
  stream = fstream;

  MQDB::DBCache::cache_resize(4);
  MQDB::DBCache::debug_cache();

  gettimeofday(&starttime, NULL);
  //string fid ="72DA22E8-B95F-48B8-B7E3-3698E820E331::3:::Experiment";
  //string fid ="C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::24892376";
  string fid ="72DA22E8-B95F-48B8-B7E3-3698E820E331::10379148"; //F4 CAGE L1 promoter with expression
  MQDB::DBObject *obj = stream->fetch_object_by_id(fid);
  MQDB::DBCache::debug_cache();
  if(obj) { 
    printf("returned an object\n");
    //if(obj->classname() == EEDB:: Feature::class_name) { cout << ((EEDB::Feature*)obj)->xml(); }
    if(obj->classname() == EEDB:: Experiment::class_name) { cout << ((EEDB::Experiment*)obj)->xml(); }
    if(obj->classname() == EEDB::FeatureSource::class_name) { cout << ((EEDB::FeatureSource*)obj)->xml(); }
    if(obj->classname() == EEDB:: EdgeSource::class_name) { cout << ((EEDB::EdgeSource*)obj)->xml(); }

    obj->release();
  }
  MQDB::DBCache::debug_cache();
  stream->disconnect();  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_feature_meta_stream(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;
  vector<EEDB::Peer*>::iterator         seed_it;

  //
  // this test builds a MultiMergeStream and reuses it for various tests
  //

  printf("\n====== test_experiment_stream == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  fstream->add_source_id_filter("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::31:::FeatureSource");

  printf("done with registry init\n");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  stream = fstream;

  //filter = "I87-DB";
  filter = "(brain and !cortex) or (liver gw)";
  //filter = "fantom4 cage";

  printf("  === stream filtered sources\n");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  stream->stream_data_sources("FeatureSource");

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec after stream_data_sources() setup\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    count++;
  }
  printf("%d sources\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_oscparser() {
  //string path ="/Users/severin/data2/ucsc_table_dumps/hg18_refgene_2009jan15.bed.gz";
  //string path ="/Users/severin/data2/OSC/carsten/G29and30_5and3_all.bed";
  //string path ="/Users/severin/data2/OSC/carsten/G29and30_5and3_test.bed";
  //string path  = "/eeDB/dbs/research/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.oscheader";
  //string path2 = "/eeDB/dbs/research/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.oscdata";
  //string path ="/Users/severin/hg18_all_mrna_2009jan15___Ev89YozUFV5gn5njH_MPLC.xml";
  //string path ="/Users/severin/data2/OSC/dRNA_20081028_lSLTU2.xml";

  //EEDB::Tools::OSCFileParser *oscp = new EEDB::Tools::OSCFileParser();
  //oscp->set_parameter("genome_assembly", "hg18");
  //oscp->set_parameter("score_as_expression", "tagcount");
  //oscp->set_parameter("platform", "Illumina_shortRNA");
  //oscp->set_parameter("_fsrc_name", "G29and30_5and3_all");
  //oscp->init_from_bed_file(path);
  //oscp->init_from_xml_file(path);

  
  EEDB::SPStreams::OSCFileDB *oscdb;
  EEDB::Tools::OSCFileParser *oscp;

  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  string path ="/Users/severin/data2/OSC/dRNA_20081028_lSLTU2.xml";
  oscdb = new EEDB::SPStreams::OSCFileDB();
  //oscdb->set_parameter("build_dir","/tmp/");
  string oscpath = oscdb->create_db_for_file(path);
  //oscp = oscdb->oscfileparser();
  
  
  //string oscpath = "oscdb:///Users/severin/data2/OSC/dRNA_20081028_lSLTU2.oscdb";
  oscdb = EEDB::SPStreams::OSCFileDB::new_from_url(oscpath);
  if(oscdb == NULL) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
    printf("unable to connect to [%s]\n", oscpath.c_str());
    return;
  }
  oscp = oscdb->oscfileparser();
  //printf("%s", oscp->xml().c_str());

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  oscdb->set_sourcestream_output("express");
  oscdb->add_expression_datatype_filter(EEDB::Datatype::get_type("tagcount"));

  EEDB::Feature *feature = oscdb->_fetch_feature_by_id(140193);
  if(feature) { printf("%s\n", feature->xml().c_str()); }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  //
  /////////////////////////////////////////////////////////
  //
  
    
  /*
  int id=1;
  EEDB::Feature *feature = oscdb->_fetch_feature_by_id(id);
  while(feature) {
    id++;
    feature = oscdb->_fetch_feature_by_id(id);
    if(feature->primary_id() != id) { printf("error id fetch\n"); exit(1); }
  }
  */


  /*
  string header = oscp->oscheader();
  printf("%s\n", header.c_str());

  oscp->display_info();

  printf("%s", oscp->xml().c_str());
  */

  //oscp->test_scan_file(path2);
  printf("%s\n", oscpath.c_str());
}


void test_oscparser2() {
  //EEDB::Peer  *peer = EEDB::Peer::new_from_url("oscdb:///Users/severin/data/oscdb/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb");
  //EEDB::Peer  *peer = EEDB::Peer::new_from_url("oscdb:///eeDB/dbs/research/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb");
  EEDB::Peer  *peer = EEDB::Peer::new_from_url("oscdb:///intweb1_eedb/dbs/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb");
  printf("%s", peer->xml().c_str());

  EEDB::SPStreams::OSCFileDB  *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
  printf("%s\n", oscdb->xml().c_str());

  EEDB::Tools::OSCFileParser *oscp = oscdb->oscfileparser();

  string header = oscp->oscheader();
  printf("%s\n", header.c_str());

  oscp->display_info();

  //string path2 = "/eeDB/dbs/research/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.oscdata";
  //string path2 = "/Users/severin/data/oscdb/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.oscdata";
  string path2 = "/intweb1_eedb/dbs/Mouse_Embryonic_Stem_Cell_RNAseq_exonic_signal.oscdb/oscdb.oscdata";
  oscp->test_scan_file(path2);
}


void test_oscdb_peer() {
  EEDB::SPStreams::OSCFileDB *oscdb;
  EEDB::Tools::OSCFileParser *oscp;
  int count = 0;
  
  printf("test_oscdb_peer\n");
  string oscpath = "oscdb:///Users/severin/data2/OSC/dRNA_20081028_lSLTU2.oscdb";

  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);
  
  EEDB::Peer *peer = EEDB::Peer::new_from_url(oscpath);
  if(peer == NULL) {
    printf("unable to connect to [%s]\n", oscpath.c_str());
    return;
  }  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("after new %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  EEDB::SPStreams::SourceStream *stream = peer->source_stream();
  ((EEDB::SPStreams::OSCFileDB*)stream)->oscfileparser();
  //printf("%s\n", stream->xml().c_str());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("after source_stream %1.6f msec\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  /*
  stream->stream_peers();
  while(EEDB::Peer *peer = (EEDB::Peer*)stream->next_in_stream()) {
    cout << peer->xml() << endl; 
    count++;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d peers in %1.6f msec\n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  count=0;
  string filter = "drna";
  //stream->stream_data_sources();
  //stream->stream_data_sources("Experiment");
  //stream->stream_data_sources("FeatureSource");
  stream->stream_data_sources("Experiment", filter);
  
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    cout << source->xml() << endl;; 
    count++;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d sources in %1.6f msec\n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */
  
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
  
}


void fix_source_metadata(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  vector<EEDB::Peer*>::iterator         seed_it;

  printf("\n====== fix_source_metadata == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  stream = fstream;

  printf("  === stream sources\n");
  stream->stream_data_sources();

  count=0;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    vector<EEDB::Metadata*> mdlist = source->metadataset()->metadata_list();
    bool bad=false;
    //cout << source->simple_xml();
    for(int i=0; i<mdlist.size(); i++) {
      if(mdlist[i]->classname() != string("Symbol")) { continue; }
      if(mdlist[i]->data().find_first_of("\"&<>") !=string::npos) {
        printf("BAD metadata : %s", mdlist[i]->xml().c_str());
	bad=true;
      }
    }
    if(bad) { 
      cout << source->simple_xml() << endl;; 
    }
    count++;
  }
  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_extended_fedsource(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;
  vector<EEDB::Peer*>::iterator         seed_it;

  //
  // this test builds a MultiMergeStream and reuses it for various tests
  //

  //like this query
  //http://osc-intweb1.gsc.riken.jp/zenbu2_dev/cgi/eedb_search.fcgi?peer=C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA;mode=feature_sources;limit=1000;sources=Entrez_gene_hg18;

  printf("\n====== test_extended_fedsource == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  fstream->add_peer_id_filter("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA");
  fstream->add_peer_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331");

  /*
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::10:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::11:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::12:::Experiment"); 
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::13:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::14:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::15:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::16:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::17:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::18:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::19:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::20:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::3:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::4:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::5:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::6:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::7:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::8:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::9:::Experiment");


  fstream->add_source_name_filter("Entrez_gene_hg18");
  fstream->set_experiment_searchlogic_filter("riken1");
  */

  stream = fstream;


  printf("  === stream sources\n");
  count=0;
  stream->stream_peers();
  while(EEDB::Peer *peer = (EEDB::Peer*)stream->next_in_stream()) {
    cout << peer->xml() << endl; 
    count++;
  }
  printf("%d peers\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec after stream_peers()\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  count=0;
  stream->stream_data_sources();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    cout << obj->simple_xml();
    count++;
  }
  printf("%d sources\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_feature_metadata_search(vector<EEDB::Peer*> seedpeers) {
  struct timeval                         starttime,endtime,difftime;
  int                                    count;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                         *stream = NULL;

  //
  // this test builds a MultiMergeStream and reuses it for various tests
  //

  //like this query
  //http://osc-intweb1.gsc.riken.jp/zenbu2_dev/cgi/eedb_search.fcgi?peer=C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA;mode=search;limit=1000;name=cbx;sources=Entrez_gene_hg18;

  printf("\n====== test_extended_fedsource == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  vector<EEDB::Peer*>::iterator         seed_it;
  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  fstream->add_peer_id_filter("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA");
  fstream->add_source_name_filter("Entrez_gene_hg18");
  stream = fstream;

  //string filter = "cbx chromo";
  string filter = "(tumor necrosis factor) or (cbx chromo)";

  printf("  === stream\n");
  count=0;
  stream->stream_peers();
  while(EEDB::Peer *peer = (EEDB::Peer*)stream->next_in_stream()) {
    cout << peer->xml() << endl; 
    count++;
  }
  printf("%d peers\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec after stream_peers()\n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_features_by_metadata_search(filter);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    cout << obj->simple_xml();
    count++;
  }
  printf("%d features\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_dbstream2(Database *db) {
  struct timeval                  starttime,endtime,difftime;
  int                             count, idx;
  int                             loop=1000;
  MQDB::DBStream*                 stream;
  MQDB::DBObject*                 obj;

  printf("== dbstream test == \n");
  gettimeofday(&starttime, NULL);
  count=0;

  const char *sql = "SELECT * FROM feature_2_symbol join symbol using(symbol_id) where feature_id = ?";
  long int id = 5800483;
  stream = MQDB::stream_multiple(EEDB::Symbol::create, db, sql, "d", id);
  while((obj = stream->next_in_stream())) {
    count++;
    printf("%s", obj->xml().c_str());
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_datatype() {
  struct timeval      starttime,endtime,difftime;

  EEDB::Peer  *peer = EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_fantom3");
  cout << peer->xml() << endl;

  MQDB::Database *db = peer->peer_database();
  cout << db->url() << endl;

  printf("\n== source datatype testing == \n");
  gettimeofday(&starttime, NULL);

  EEDB::SPStream  *stream = peer->source_stream();

  map<string, EEDB::Datatype*>  all_datatypes;
  int                           count=0;
  stream->stream_data_sources("Experiment");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    count++;
    //cout << source->xml();

    map<string, EEDB::Datatype*> datatypes;
    map<string, EEDB::Datatype*>::iterator it1;

    datatypes = source->expression_datatypes();

    for(it1=datatypes.begin(); it1!=datatypes.end(); it1++) {
      all_datatypes[(*it1).first] = (*it1).second; 
    }

    source->release();
  }

  printf("--- all datatypes\n");
  map<string, EEDB::Datatype*>::iterator  it2;
  for(it2=all_datatypes.begin(); it2!=all_datatypes.end(); it2++) {
    cout<< (*it2).second->xml();
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%d in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_datatype2(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;
  vector<EEDB::Peer*>::iterator         seed_it;

  printf("\n====== test experiment datatypes == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  stream = fstream;

  map<string, EEDB::Datatype*>  all_datatypes;
  int count=0;
  stream->stream_data_sources();
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    count++;
    //cout << source->simple_xml();

    map<string, EEDB::Datatype*> datatypes;
    map<string, EEDB::Datatype*>::iterator it1;

    datatypes = source->expression_datatypes();

    for(it1=datatypes.begin(); it1!=datatypes.end(); it1++) {
      all_datatypes[(*it1).first] = (*it1).second;
    }

    source->release();
  }

  printf("--- all datatypes\n");
  map<string, EEDB::Datatype*>::iterator  it2;
  for(it2=all_datatypes.begin(); it2!=all_datatypes.end(); it2++) {
    cout<< (*it2).second->xml();
  }

  printf("%d experiments\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}



void test_symbol_save(vector<EEDB::Peer*> seedpeers) {
  struct timeval                          starttime,endtime,difftime;
  EEDB::SPStreams::FederatedSourceStream  *stream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::User                              *user;
  vector<EEDB::Peer*>::iterator           seed_it;

  //EEDB::Peer  *peer = EEDB::Peer::new_from_url("mysql://severin:severin@@osc-mysql.gsc.riken.jp:3306/eeDB_jms_test5");
  //MQDB::Database  *db = peer->peer_database();
  //MQDB::Database  *db = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_core");
  //MQDB::Database  *db = new MQDB::Database("mysql://severin:severin@@osc-mysql.gsc.riken.jp:3306/eeDB_jms_test5");

  MQDB::Database  *db = new MQDB::Database("sqlite:///Users/severin/src/rikenOSC/ZENBU/c++/eedb_testdb.sqlite");
  cout << db->xml();

  db->disconnect();
  db->user("severin");
  db->password("severin");

  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  stream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    stream->add_seed_peer(*seed_it);
  }

  string id = "72DA22E8-B95F-48B8-B7E3-3698E820E331::6:::Experiment";
  EEDB::Experiment *obj = (EEDB::Experiment*)stream->fetch_object_by_id(id);
  cout << obj->xml();

  gettimeofday(&starttime, NULL);

  obj->store(db);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  cout << obj->xml();

  //---------

  id = "72DA22E8-B95F-48B8-B7E3-3698E820E331::31:::FeatureSource";
  EEDB::FeatureSource *fsrc = (EEDB::FeatureSource*)stream->fetch_object_by_id(id);
  cout << fsrc->xml();

  gettimeofday(&starttime, NULL);
  fsrc->store(db);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  cout << fsrc->xml();

  //---------

  EEDB::Symbol *sym = new EEDB::Symbol("EntrezGene", "CBX1");
  sym->display_info();
  sym->check_exists_db(db);
  sym->display_info();
  sym->store(db);
  sym->display_info();

  EEDB::Metadata *md = new EEDB::Metadata("EntrezGene", "CBX4");
  md->display_info();
  md->check_exists_db(db);
  md->display_info();
  md->store(db);
  md->display_info();

}


void test_feature_save(vector<EEDB::Peer*> seedpeers) {
  struct timeval                          starttime,endtime,difftime;
  EEDB::SPStreams::FederatedSourceStream  *stream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::User                              *user;
  vector<EEDB::Peer*>::iterator           seed_it;

  EEDB::Peer  *peer = EEDB::Peer::new_from_url("mysql://severin:severin@@osc-mysql.gsc.riken.jp:3306/eeDB_jms_test5");
  MQDB::Database  *db = peer->peer_database();

  //MQDB::Database  *db = new MQDB::Database("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_core");
  //MQDB::Database  *db = new MQDB::Database("mysql://severin:severin@@osc-mysql.gsc.riken.jp:3306/eeDB_jms_test5");
  //MQDB::Database  *db = new MQDB::Database("sqlite:///Users/severin/src/rikenOSC/ZENBU/c++/eedb_testdb.sqlite");
  cout << db->xml();

  db->disconnect();
  db->user("severin");
  db->password("severin");

  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  stream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    stream->add_seed_peer(*seed_it);
  }

  string id = "C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::5541409";
  EEDB::Feature *obj = (EEDB::Feature*)stream->fetch_object_by_id(id);
  cout << obj->xml();

  gettimeofday(&starttime, NULL);

  obj->feature_source()->store(db);
  obj->store(db);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  cout << obj->xml();
}


void test_region(vector<EEDB::Peer*> seedpeers) {
  /*
  <zenbu_query>
  <source_ids>C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::82:::FeatureSource,C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::91:::FeatureSource,C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::59:::FeatureSource,2ACDA3DC-0704-11DF-8E68-ECCE0B50B70F::5:::FeatureSource,CC9536FC-405D-11DF-9869-91394B1E0442::9:::FeatureSource,</source_ids>
  <asm>hg18</asm>
  <loc>chr19:54853066..54862509</loc>
  <format>xml</format><submode>subfeature</submode>
  </zenbu_query>
  */
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = fstream;
  vector<EEDB::Peer*>::iterator         seed_it;

  printf("\n====== test region stream == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  //fstream->set_sourcestream_output("feature");
  //fstream->set_sourcestream_output("full_feature");
  fstream->set_sourcestream_output("full_feature");
  //fstream->set_sourcestream_output("expression");
  //fstream->set_sourcestream_output("skip_metadata");
  //fstream->set_sourcestream_output("simple_feature");
  fstream->add_expression_datatype_filter(EEDB::Datatype::get_type("tpm"));

  //fstream->add_source_id_filter("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::82:::FeatureSource");
  //fstream->add_source_id_filter("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::91:::FeatureSource");
  //fstream->add_source_id_filter("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::59:::FeatureSource");
  //fstream->add_source_id_filter("2ACDA3DC-0704-11DF-8E68-ECCE0B50B70F::5:::FeatureSource");
  //fstream->add_source_id_filter("CC9536FC-405D-11DF-9869-91394B1E0442::9:::FeatureSource");
  //
  fstream->add_source_id_filter("1B075EE8-620E-4DE1-B005-54C5D20B5875::2:::Experiment");

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

  
  printf("  -- region\n");
  long int count=0;
  //stream->stream_by_named_region("hg18", "chr19", 54853066, 54862509);
  //stream->stream_by_named_region("hg18", "chr19", -1, 54862509);
  //stream->stream_by_named_region("hg18", "chr19", 54853066, -1);
  stream->stream_by_named_region("hg19", "chr7", -1, -1);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    count++;
    //cout << obj->simple_xml();
    if(count % 300000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%10ld features  %1.6f obj/sec\n", count, rate);
      printf("%s\n", obj->xml().c_str());
    }
    obj->release();
  }

  printf("%ld features\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}


void test_region2(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = fstream;
  vector<EEDB::Peer*>::iterator         seed_it;

  printf("\n====== test region stream == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  fstream->set_sourcestream_output("expression");
  //fstream->add_expression_datatype_filter("tpm_ex_ribo");
  //fstream->add_expression_datatype_filter("norm");
  fstream->add_expression_datatype_filter(EEDB::Datatype::get_type("norm"));


  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::3:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::6:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::4:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::7:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::5:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::8:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::9:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::12:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::10:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::13:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::11:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::14:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::15:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::18:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::16:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::19:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::17:::Experiment");
  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::20:::Experiment");

  fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::41:::FeatureSource");    //level1
  //fstream->add_source_id_filter("72DA22E8-B95F-48B8-B7E3-3698E820E331::49:::FeatureSource");  //level3

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

  stream = emitter;
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
}


void test_oscdb2() {
  struct timeval                        starttime,endtime,difftime;

  string dirname = "/eeDB/dbs/research/nbertin/FANTOM5/human.primary_cell.hCAGE/";
  //string dirname = "/eeDB/dbs/helicos_pipeline_hashimoto/";
  DIR *dp = opendir(dirname.c_str());
  struct dirent *d;
  while((d = readdir(dp)) != NULL) {
    string path = string("oscdb://") + dirname + d->d_name;
    printf("%s\n", path.c_str());
    EEDB::Peer  *peer = EEDB::Peer::new_from_url(path.c_str());
    if(peer==NULL) { continue; }
    EEDB::SPStreams::OSCFileDB  *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();

    EEDB::Tools::OSCFileParser *oscp = oscdb->oscfileparser();
    //string header = oscp->oscheader();
    //printf("%s\n", header.c_str());
    oscp->display_info();

    oscdb->test_stream();
    peer->disconnect();
  }
  closedir(dp);
}


void test_oscdb() {
  struct timeval                        starttime,endtime,difftime;

  EEDB::Peer  *peer = EEDB::Peer::new_from_url("oscdb:///zenbu/users/hOg5uv153xG1PgVgiU35hg/GencodeV10_-_collated_expression_ENCODE_caltech_Wold-lab_RNAseq_28RPKM29_zTzPkW.oscdb");

  printf("%s\n", peer->xml().c_str());

  EEDB::SPStreams::OSCFileDB  *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
  EEDB::SPStream  *stream = oscdb;

  printf(" -- sources\n");
  long int count =0;
  stream->stream_data_sources();
  while(MQDB::DBObject *obj = oscdb->next_in_stream()) {
    cout << obj->simple_xml();
    count++;
  }
  printf("%ld sources\n", count);

  EEDB::Tools::OSCFileParser *oscp = oscdb->oscfileparser();
  string header = oscp->oscheader();
  printf("%s\n", header.c_str());
  oscp->display_info();

  oscdb->set_sourcestream_output("full_feature");

  srand(time(NULL));
  long int start, end;
  start = 12345*(rand()%1023);
  end = start + rand() %1023;

  gettimeofday(&starttime, NULL);
  count=0;

  stream->stream_by_named_region("hg19", "chr8", 128746973, 128755020);

  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    count++;
    cout << obj->xml();
    //obj->display_info();
    obj->release();
    if(count % 1000000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%10ld features  %1.6f obj/sec\n", count, rate);
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("total %10ld features  %1.6f msec  ", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.6f obj/sec\n", rate);
}


void test_oscdb3() {
  struct timeval                        starttime,endtime,difftime;

  printf("\n== test_oscdb3 :: linear peer streaming, no merge\n");
  vector<EEDB::Peer*>  peers;
  peers.push_back(EEDB::Peer::new_from_url("oscdb:///Users/severin/data2/oscdbs/CNhs10501.oscdb"));
  peers.push_back(EEDB::Peer::new_from_url("oscdb:///Users/severin/data2/oscdbs/CNhs10502.oscdb"));
  peers.push_back(EEDB::Peer::new_from_url("oscdb:///Users/severin/data2/oscdbs/CNhs10503.oscdb"));


  long int count=0;
  double   mbytes=0;
  gettimeofday(&starttime, NULL);
  for(int i=0; i<peers.size(); i++) {
    EEDB::Peer*  peer = peers[i];
    peer->display_info();
    EEDB::SPStreams::OSCFileDB  *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
    oscdb->set_sourcestream_output("express");

    //EEDB::Tools::OSCFileParser *oscp = oscdb->oscfileparser();
    //string header = oscp->oscheader();
    //printf("%s\n", header.c_str());
    //oscp->display_info();

    EEDB::SPStream *stream = oscdb;
    oscdb->stream_by_named_region("mm9", "chr2", -1, -1);

    double seek_start = oscdb->current_seek_pos();
    while(MQDB::DBObject *obj = stream->next_in_stream()) {
      count++;
      //cout << obj->simple_xml();
      //obj->display_info();
      obj->release();
      if(count % 200000 == 0) {
        gettimeofday(&endtime, NULL);
        timersub(&endtime, &starttime, &difftime);
        double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
        printf("%10ld features  %13.2f obj/sec\n", count, rate);
      }
    }
    mbytes += ((double)(oscdb->current_seek_pos() - seek_start)/(1024.0*1024.0));
    peer->disconnect();
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("total %10ld features  %1.6f msec  ", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("  %13.3f obj/sec", rate);
  rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("  %13.3f mbytes/sec\n", rate);
}


void test_oscdb4() {
  struct timeval                        starttime,endtime,difftime;

  printf("\n== test_oscdb4 with MultiMerge\n");
  vector<EEDB::Peer*>  peers;
  //peers.push_back(EEDB::Peer::new_from_url("oscdb:///Users/severin/data2/oscdbs/CNhs10501.oscdb"));
  //peers.push_back(EEDB::Peer::new_from_url("oscdb:///Users/severin/data2/oscdbs/CNhs10502.oscdb"));
  //peers.push_back(EEDB::Peer::new_from_url("oscdb:///Users/severin/data2/oscdbs/CNhs10503.oscdb"));

  //string dirname = "/eeDB/dbs/helicos_pipeline_hashimoto/";

  peers.push_back(EEDB::Peer::new_from_url("oscdb:///eeDB/dbs/helicos_pipeline_hashimoto/CNhs10501.oscdb"));
  peers.push_back(EEDB::Peer::new_from_url("oscdb:///eeDB/dbs/helicos_pipeline_hashimoto/CNhs10502.oscdb"));
  peers.push_back(EEDB::Peer::new_from_url("oscdb:///eeDB/dbs/helicos_pipeline_hashimoto/CNhs10503.oscdb"));

  EEDB::SPStreams::MultiMergeStream     *mmerge = new EEDB::SPStreams::MultiMergeStream;
  for(int i=0; i<peers.size(); i++) {
    EEDB::Peer*  peer = peers[i];
    mmerge->add_sourcestream(peer->source_stream());
  }
  EEDB::SPStream *stream = mmerge;

  long int count=0;
  gettimeofday(&starttime, NULL);
  stream->stream_by_named_region("mm9", "chr2", -1, -1);
  //stream->stream_by_named_region("mm9", "chr2", 35102076, 35167412);
  //stream->stream_by_named_region("mm9", "chr7", 52251732, 52259514);

  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    count++;
    //cout << obj->simple_xml();
    //obj->display_info();
    obj->release();
    if(count % 200000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%10ld features  %13.2f obj/sec\n", count, rate);
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("total %10ld features  %1.6f msec  ", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("  %13.3f obj/sec\n", rate);
}


void test_oscdb5(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  long int                              count;
  string                                filter;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  vector<EEDB::Peer*>::iterator         seed_it;

  seedpeers.clear();
  seedpeers.push_back(EEDB::Peer::new_from_url("mysql://read:read@@osc-mysql.gsc.riken.jp:3306/eeDB_marina_test"));

  printf("\n== test_oscdb5 with 86 experiments\n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);
  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  stream = fstream;

  filter = "helicos fantom5 mm9";

  printf("  --- stream filtered experiments [%s]\n", filter.c_str());
  stream->stream_data_sources("Experiment", filter);
  vector<string>  src_ids;
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    obj->display_info();
    src_ids.push_back(obj->db_id());
  }
  printf("%ld FANTOM5 mm9 experiments\n", src_ids.size());
  for(int i=0; i<src_ids.size(); i++) {
    fstream->add_source_id_filter(src_ids[i]);
  }

  count=0;
  stream->stream_data_sources("Experiment");
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    count++;
  }
  printf("%ld FANTOM5 mm9 experiments\n", count);

  gettimeofday(&starttime, NULL);

  //stream->stream_by_named_region("mm9", "chr2", -1, -1);
  //stream->stream_by_named_region("mm9", "chr2", 35102076, 35167412);
  //stream->stream_by_named_region("mm9", "chr6", 29474085, 29489965);
  //stream->stream_by_named_region("mm9", "chr7", 52251732, 52259514);
  //stream->stream_by_named_region("mm9", "chr7", 52216713, 52294533);
  //stream->stream_by_named_region("mm9", "chr7", 51866523, 52644723);
  //stream->stream_by_named_region("mm9", "chr7", 51866523, 52644723);
  stream->stream_by_named_region("mm9", "chr7", 51000000, 53000000);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("setup %1.6f sec\n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);

  count=0;
  gettimeofday(&starttime, NULL);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    count++;
    //cout << obj->simple_xml();
    //obj->display_info();
    obj->release();
    if(count % 200000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%10ld features  %13.2f obj/sec\n", count, rate);
    }
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("total %10ld features  %1.6f sec  ", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("  %13.3f obj/sec\n", rate);
}




void test_region_server() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::RegionServer      *webservice = new EEDB::WebServices::RegionServer();

  gettimeofday(&starttime, NULL);

  printf("\n== test_region_server\n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  //webservice->parse_config_file("/eeDB_intweb1/dbs/fantom5_release009/eedb_server_config.xml");
  //webservice->parse_config_file("/eeDB/dbs/fantom5_release009/eedb_server_config.xml");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  //string post_data ="<zenbu_query> <source_ids>F5714B68-7B9B-11E0-854E-BD5F7C4C5968::1:::Experiment,F6449964-7B9B-11E0-8719-C35F7C4C5968::1:::Experiment,E28D67DE-7B9B-11E0-ACE5-2C5F7C4C5968::1:::Experiment,2B8F9CC2-7B9C-11E0-A3D5-67617C4C5968::1:::Experiment,DF85B17C-7B9B-11E0-894F-145F7C4C5968::1:::Experiment,D38C5862-7B9B-11E0-9629-AB5E7C4C5968::1:::Experiment,DC3E3B06-7B9B-11E0-8EF0-FC5E7C4C5968::1:::Experiment,DC8BC984-7B9B-11E0-870D-FE5E7C4C5968::1:::Experiment,DCEB4FDA-7B9B-11E0-9FB7-005F7C4C5968::1:::Experiment,E15660A0-7B9B-11E0-9439-225F7C4C5968::1:::Experiment,BE7C4AEA-7B9B-11E0-A0F6-1F5E7C4C5968::1:::Experiment,DD48DF38-7B9B-11E0-BA52-025F7C4C5968::1:::Experiment,F850DE48-7B9B-11E0-8D90-D35F7C4C5968::1:::Experiment,DDCB038C-7B9B-11E0-8A35-065F7C4C5968::1:::Experiment,D8974434-7B9B-11E0-B031-CB5E7C4C5968::1:::Experiment,DFC86A26-7B9B-11E0-B170-165F7C4C5968::1:::Experiment,E198CC10-7B9B-11E0-B4D7-245F7C4C5968::1:::Experiment,DE078870-7B9B-11E0-9E84-085F7C4C5968::1:::Experiment,E213D1D0-7B9B-11E0-910C-285F7C4C5968::1:::Experiment,2AA29968-7B9C-11E0-88AB-63617C4C5968::1:::Experiment,E007894A-7B9B-11E0-92AF-185F7C4C5968::1:::Experiment,DB3EC540-7B9B-11E0-BDA8-F65E7C4C5968::1:::Experiment,2C0488FC-7B9C-11E0-9E4A-69617C4C5968::1:::Experiment,E04C0430-7B9B-11E0-BA03-1A5F7C4C5968::1:::Experiment,E320D6C2-7B9B-11E0-8CFA-305F7C4C5968::1:::Experiment,FAED10AE-7B9B-11E0-89BB-EB5F7C4C5968::1:::Experiment,F815432E-7B9B-11E0-9C6E-D15F7C4C5968::1:::Experiment,30F5F8A0-7B9C-11E0-A75F-7F617C4C5968::1:::Experiment,E250D72E-7B9B-11E0-8A6D-2A5F7C4C5968::1:::Experiment,F8C62540-7B9B-11E0-B6B2-D75F7C4C5968::1:::Experiment,E367811C-7B9B-11E0-B848-325F7C4C5968::1:::Experiment,DEBDE1E2-7B9B-11E0-A6F9-0E5F7C4C5968::1:::Experiment,FBA11446-7B9B-11E0-B6B7-F15F7C4C5968::1:::Experiment,FAAFF9EE-7B9B-11E0-BB06-E95F7C4C5968::1:::Experiment,2B1490C2-7B9C-11E0-8426-65617C4C5968::1:::Experiment,29676CB8-7B9C-11E0-A034-5D617C4C5968::1:::Experiment,DAB8F8A2-7B9B-11E0-994D-F25E7C4C5968::1:::Experiment,F6EF11D2-7B9B-11E0-B06D-C95F7C4C5968::1:::Experiment,DA112EB0-7B9B-11E0-B811-EA5E7C4C5968::1:::Experiment,DA683066-7B9B-11E0-AC01-EE5E7C4C5968::1:::Experiment,DB979E68-7B9B-11E0-A853-F85E7C4C5968::1:::Experiment,E1111E5A-7B9B-11E0-AF04-205F7C4C5968::1:::Experiment,DE40DD82-7B9B-11E0-BBDE-0A5F7C4C5968::1:::Experiment,F88A0B46-7B9B-11E0-B9F2-D55F7C4C5968::1:::Experiment,DEFA733C-7B9B-11E0-AE8B-105F7C4C5968::1:::Experiment,E40723B6-7B9B-11E0-BAF3-365F7C4C5968::1:::Experiment,FBF0F772-7B9B-11E0-8313-F35F7C4C5968::1:::Experiment,28525A68-7B9C-11E0-A5E4-53617C4C5968::1:::Experiment,E2CCD19E-7B9B-11E0-ACAE-2E5F7C4C5968::1:::Experiment,29C2462E-7B9C-11E0-A6D8-5F617C4C5968::1:::Experiment,DE7CD2EC-7B9B-11E0-A1EC-0C5F7C4C5968::1:::Experiment,FC2C2612-7B9B-11E0-BD5C-F55F7C4C5968::1:::Experiment,F5CBB3F0-7B9B-11E0-8956-BF5F7C4C5968::1:::Experiment,F90143F0-7B9B-11E0-8645-DA5F7C4C5968::1:::Experiment,FCA81862-7B9B-11E0-A3F3-F95F7C4C5968::1:::Experiment,FCEED2B6-7B9B-11E0-BD27-FB5F7C4C5968::1:::Experiment,E4463C68-7B9B-11E0-B347-385F7C4C5968::1:::Experiment,E48B6982-7B9B-11E0-97E9-3A5F7C4C5968::1:::Experiment,D9906848-7B9B-11E0-AE99-E15E7C4C5968::1:::Experiment,BF65233C-7B9B-11E0-A7AD-235E7C4C5968::1:::Experiment,DAFF48E8-7B9B-11E0-95DB-F45E7C4C5968::1:::Experiment,DBED0E7A-7B9B-11E0-9F56-FA5E7C4C5968::1:::Experiment,FD2CA38E-7B9B-11E0-945E-FD5F7C4C5968::1:::Experiment,E0CE54DA-7B9B-11E0-9FDF-1E5F7C4C5968::1:::Experiment,FD65F396-7B9B-11E0-AF55-FF5F7C4C5968::1:::Experiment,E537710A-7B9B-11E0-AFA6-3D5F7C4C5968::1:::Experiment,D8D70074-7B9B-11E0-B259-CD5E7C4C5968::1:::Experiment,FDA32874-7B9B-11E0-A329-01607C4C5968::1:::Experiment,27DF6CCE-7B9C-11E0-93D5-4F617C4C5968::1:::Experiment,FDDD0616-7B9B-11E0-9528-03607C4C5968::1:::Experiment,DF3921EA-7B9B-11E0-BD16-125F7C4C5968::1:::Experiment,FE144658-7B9B-11E0-AE7E-05607C4C5968::1:::Experiment,E08D5E4E-7B9B-11E0-9905-1C5F7C4C5968::1:::Experiment,FE4B4D6A-7B9B-11E0-822F-09607C4C5968::1:::Experiment,F9797046-7B9B-11E0-A96E-DE5F7C4C5968::1:::Experiment,FE846FFA-7B9B-11E0-88E4-0B607C4C5968::1:::Experiment,FEBAB8D0-7B9B-11E0-93E5-0D607C4C5968::1:::Experiment,FEF9338A-7B9B-11E0-A4EC-0F607C4C5968::1:::Experiment,D9161746-7B9B-11E0-B1BF-CF5E7C4C5968::1:::Experiment,F9B26040-7B9B-11E0-9F52-E05F7C4C5968::1:::Experiment,FF2D94EA-7B9B-11E0-9E9B-11607C4C5968::1:::Experiment,C0522FB0-7B9B-11E0-B707-275E7C4C5968::1:::Experiment,D9CD019A-7B9B-11E0-9582-E35E7C4C5968::1:::Experiment,2E401474-7B9C-11E0-AED9-73617C4C5968::1:::Experiment,2CD95884-7B9C-11E0-9641-6D617C4C5968::1:::Experiment,2D5038DC-7B9C-11E0-B3A3-6F617C4C5968::1:::Experiment,2DC6E84C-7B9C-11E0-B9F4-71617C4C5968::1:::Experiment,FB273946-7B9B-11E0-A8D3-ED5F7C4C5968::1:::Experiment,FB60FA0A-7B9B-11E0-AF26-EF5F7C4C5968::1:::Experiment,34FB36E0-7B9C-11E0-9500-91617C4C5968::1:::Experiment,1EB4DEAE-7B9C-11E0-8C31-07617C4C5968::1:::Experiment,22FB03A8-7B9C-11E0-AA1A-27617C4C5968::1:::Experiment,D56F2092-7B9B-11E0-A189-BA5E7C4C5968::1:::Experiment,1F535098-7B9C-11E0-BA80-0B617C4C5968::1:::Experiment,CDA863AA-7B9B-11E0-BB35-885E7C4C5968::1:::Experiment,CDEE6B98-7B9B-11E0-86B6-8A5E7C4C5968::1:::Experiment,CE31CD34-7B9B-11E0-B8DA-8D5E7C4C5968::1:::Experiment,C1A6BB42-7B9B-11E0-85B1-2D5E7C4C5968::1:::Experiment,43EBACCA-7B9C-11E0-9EC3-FF617C4C5968::1:::Experiment,D3477E90-7B9B-11E0-9150-A95E7C4C5968::1:::Experiment,D5344594-7B9B-11E0-8439-B75E7C4C5968::1:::Experiment,3E119620-7B9C-11E0-9AE2-C9617C4C5968::1:::Experiment,3410C1D2-7B9C-11E0-A230-8D617C4C5968::1:::Experiment,D47DDAF2-7B9B-11E0-BEA4-B15E7C4C5968::1:::Experiment,D4F7153E-7B9B-11E0-B226-B55E7C4C5968::1:::Experiment,D6700D30-7B9B-11E0-958C-C35E7C4C5968::1:::Experiment,C2050D14-7B9B-11E0-822C-2F5E7C4C5968::1:::Experiment,3E4705C6-7B9C-11E0-B75A-CB617C4C5968::1:::Experiment,C258452E-7B9B-11E0-BDF6-315E7C4C5968::1:::Experiment,44C7AEF0-7B9C-11E0-95ED-05627C4C5968::1:::Experiment,454607BE-7B9C-11E0-B5BD-07627C4C5968::1:::Experiment,D2C167CE-7B9B-11E0-91DE-A55E7C4C5968::1:::Experiment,43B4ED0C-7B9C-11E0-9213-FD617C4C5968::1:::Experiment,3B7D3518-7B9C-11E0-9DF3-B3617C4C5968::1:::Experiment,446917BE-7B9C-11E0-89C4-03627C4C5968::1:::Experiment,24C29FAC-7B9C-11E0-A336-33617C4C5968::1:::Experiment,24FDE8E6-7B9C-11E0-98CE-35617C4C5968::1:::Experiment,C2A7DFDA-7B9B-11E0-B99E-335E7C4C5968::1:::Experiment,23316CA4-7B9C-11E0-BB86-29617C4C5968::1:::Experiment,D4055F96-7B9B-11E0-8A61-AD5E7C4C5968::1:::Experiment,30837AD2-7B9C-11E0-9F17-7D617C4C5968::1:::Experiment,1E51BDA6-7B9C-11E0-B430-05617C4C5968::1:::Experiment,CF06B490-7B9B-11E0-AF8C-935E7C4C5968::1:::Experiment,3AFC76C6-7B9C-11E0-ABE1-AF617C4C5968::1:::Experiment,228E4FCE-7B9C-11E0-BEDC-23617C4C5968::1:::Experiment,D30C6BC0-7B9B-11E0-A43A-A75E7C4C5968::1:::Experiment,C2F91C92-7B9B-11E0-A7D2-355E7C4C5968::1:::Experiment,44218674-7B9C-11E0-8A00-01627C4C5968::1:::Experiment,41BDFCDC-7B9C-11E0-A0EE-EB617C4C5968::1:::Experiment,F52145DC-7B9B-11E0-B0D9-BB5F7C4C5968::1:::Experiment,F4E8B492-7B9B-11E0-9843-B95F7C4C5968::1:::Experiment,F3F5D79A-7B9B-11E0-9ACA-B15F7C4C5968::1:::Experiment,CBF12D3A-7B9B-11E0-9DC5-795E7C4C5968::1:::Experiment,4187C928-7B9C-11E0-907F-E9617C4C5968::1:::Experiment,39F818C0-7B9C-11E0-96F2-A9617C4C5968::1:::Experiment,00F345B8-7B9C-11E0-8D28-21607C4C5968::1:::Experiment,CBAF3F9C-7B9B-11E0-BB1C-775E7C4C5968::1:::Experiment,F46E5BF2-7B9B-11E0-8A8B-B55F7C4C5968::1:::Experiment,F4338D9C-7B9B-11E0-999A-B35F7C4C5968::1:::Experiment,364DCB66-7B9C-11E0-93DF-97617C4C5968::1:::Experiment,36B88D5C-7B9C-11E0-BDE8-99617C4C5968::1:::Experiment,371BDB50-7B9C-11E0-A718-9B617C4C5968::1:::Experiment,1DF26932-7B9C-11E0-AD74-03617C4C5968::1:::Experiment,3BB5FA9C-7B9C-11E0-9769-B5617C4C5968::1:::Experiment,D4BAFEDC-7B9B-11E0-9327-B35E7C4C5968::1:::Experiment,D5F12B14-7B9B-11E0-9394-BE5E7C4C5968::1:::Experiment,1D3EC72E-7B9C-11E0-9E34-FF607C4C5968::1:::Experiment,C3460228-7B9B-11E0-BBB0-395E7C4C5968::1:::Experiment,CF607868-7B9B-11E0-9A7E-955E7C4C5968::1:::Experiment,3E7F6452-7B9C-11E0-A4C4-CD617C4C5968::1:::Experiment,CB48DB12-7B9B-11E0-9652-755E7C4C5968::1:::Experiment,207B6726-7B9C-11E0-92B6-11617C4C5968::1:::Experiment,D1CCD254-7B9B-11E0-8418-9F5E7C4C5968::1:::Experiment,3862A750-7B9C-11E0-8E03-A1617C4C5968::1:::Experiment,24303F68-7B9C-11E0-B7D2-2F617C4C5968::1:::Experiment,38C60C1E-7B9C-11E0-A296-A3617C4C5968::1:::Experiment,D7B984AA-7B9B-11E0-A35A-C55E7C4C5968::1:::Experiment,0B93E4DC-7B9C-11E0-8397-9D607C4C5968::1:::Experiment,1D93D4EE-7B9C-11E0-99B7-01617C4C5968::1:::Experiment,D01F33C0-7B9B-11E0-A582-9B5E7C4C5968::1:::Experiment,398AACE0-7B9C-11E0-A6F4-A7617C4C5968::1:::Experiment,C3961858-7B9B-11E0-88AD-3B5E7C4C5968::1:::Experiment,3D9A2DD8-7B9C-11E0-BEF4-C5617C4C5968::1:::Experiment,3DD83826-7B9C-11E0-8B7B-C7617C4C5968::1:::Experiment,CCF20A24-7B9B-11E0-9D4A-825E7C4C5968::1:::Experiment,3A6738D6-7B9C-11E0-8777-AB617C4C5968::1:::Experiment,CABA811E-7B9B-11E0-8C7A-735E7C4C5968::1:::Experiment,C3DD27AC-7B9B-11E0-AE4A-3D5E7C4C5968::1:::Experiment,CCAF4AAE-7B9B-11E0-9319-805E7C4C5968::1:::Experiment,21E428A0-7B9C-11E0-B24A-1D617C4C5968::1:::Experiment,437D4EB0-7B9C-11E0-95C0-FB617C4C5968::1:::Experiment,4347E84C-7B9C-11E0-9FCF-F9617C4C5968::1:::Experiment,32BE60FA-7B9C-11E0-BAD4-87617C4C5968::1:::Experiment,33346994-7B9C-11E0-AD5A-89617C4C5968::1:::Experiment,33A4B546-7B9C-11E0-83D0-8B617C4C5968::1:::Experiment,3C2BB84A-7B9C-11E0-91EE-B9617C4C5968::1:::Experiment,C4688FD6-7B9B-11E0-9121-415E7C4C5968::1:::Experiment,45BBC67A-7B9C-11E0-8F85-09627C4C5968::1:::Experiment,216B9AC0-7B9C-11E0-B641-17617C4C5968::1:::Experiment,CEC65D1E-7B9B-11E0-9C1E-915E7C4C5968::1:::Experiment,C4A6AA28-7B9B-11E0-B457-435E7C4C5968::1:::Experiment,429F26D0-7B9C-11E0-9A1E-F3617C4C5968::1:::Experiment,2F9DEA6C-7B9C-11E0-99E3-79617C4C5968::1:::Experiment,43102876-7B9C-11E0-B53E-F7617C4C5968::1:::Experiment,CFE169FA-7B9B-11E0-81B9-995E7C4C5968::1:::Experiment,D10968D2-7B9B-11E0-A9F5-9D5E7C4C5968::1:::Experiment,C9EB8DA0-7B9B-11E0-8CBD-715E7C4C5968::1:::Experiment,22C490C0-7B9C-11E0-A0F5-25617C4C5968::1:::Experiment,1F96B7F2-7B9C-11E0-854A-0D617C4C5968::1:::Experiment,324C44AC-7B9C-11E0-8778-85617C4C5968::1:::Experiment,3C67E7C0-7B9C-11E0-88CC-BB617C4C5968::1:::Experiment,2107173A-7B9C-11E0-84BD-15617C4C5968::1:::Experiment,356B0362-7B9C-11E0-9606-93617C4C5968::1:::Experiment,21ABF9B2-7B9C-11E0-9924-19617C4C5968::1:::Experiment,2376C858-7B9C-11E0-952E-2B617C4C5968::1:::Experiment,3AB9936A-7B9C-11E0-BE7C-AD617C4C5968::1:::Experiment,3CA07356-7B9C-11E0-965B-BD617C4C5968::1:::Experiment,D5ABA5BC-7B9B-11E0-9F72-BC5E7C4C5968::1:::Experiment,C9864E7C-7B9B-11E0-ADD3-6F5E7C4C5968::1:::Experiment,42D94784-7B9C-11E0-8CED-F5617C4C5968::1:::Experiment,422E052C-7B9C-11E0-85B3-EF617C4C5968::1:::Experiment,C92C3A90-7B9B-11E0-A768-6D5E7C4C5968::1:::Experiment,D8191370-7B9B-11E0-8E45-C75E7C4C5968::1:::Experiment,247F940A-7B9C-11E0-B5A9-31617C4C5968::1:::Experiment,31DC4918-7B9C-11E0-8F93-83617C4C5968::1:::Experiment,2256057E-7B9C-11E0-8707-21617C4C5968::1:::Experiment,25363E44-7B9C-11E0-B637-37617C4C5968::1:::Experiment,C4F67F08-7B9B-11E0-A588-455E7C4C5968::1:::Experiment,3D5F056E-7B9C-11E0-95DC-C3617C4C5968::1:::Experiment,3169C0D2-7B9C-11E0-A58F-81617C4C5968::1:::Experiment,D24095E0-7B9B-11E0-9068-A15E7C4C5968::1:::Experiment,C8E618E4-7B9B-11E0-B169-6A5E7C4C5968::1:::Experiment,C89D7AD0-7B9B-11E0-A9DD-685E7C4C5968::1:::Experiment,41F8CECA-7B9C-11E0-8459-ED617C4C5968::1:::Experiment,46AAD026-7B9C-11E0-A11F-0F627C4C5968::1:::Experiment,471D3C74-7B9C-11E0-AB43-11627C4C5968::1:::Experiment,C531952A-7B9B-11E0-A8E5-475E7C4C5968::1:::Experiment,C85FA872-7B9B-11E0-B62D-665E7C4C5968::1:::Experiment,C7E1EB08-7B9B-11E0-870C-615E7C4C5968::1:::Experiment,1BAD50E2-7B9C-11E0-A398-F7607C4C5968::1:::Experiment,C5732508-7B9B-11E0-ADE6-4B5E7C4C5968::1:::Experiment,2029C7AE-7B9C-11E0-A937-0F617C4C5968::1:::Experiment,411F4222-7B9C-11E0-9B69-E5617C4C5968::1:::Experiment,CFA00302-7B9B-11E0-BAFD-975E7C4C5968::1:::Experiment,20CDC1E2-7B9C-11E0-B2AD-13617C4C5968::1:::Experiment,C75BE846-7B9B-11E0-A805-5D5E7C4C5968::1:::Experiment,2F2AD43C-7B9C-11E0-AF97-77617C4C5968::1:::Experiment,0B24BEC2-7B9C-11E0-9141-99607C4C5968::1:::Experiment,1C895420-7B9C-11E0-88FB-FB607C4C5968::1:::Experiment,3B3E19D2-7B9C-11E0-9A01-B1617C4C5968::1:::Experiment,D85A9E1C-7B9B-11E0-9FC8-C95E7C4C5968::1:::Experiment,C5B07A02-7B9B-11E0-9E58-4D5E7C4C5968::1:::Experiment,40E9BBDE-7B9C-11E0-BE0F-E3617C4C5968::1:::Experiment,426485AC-7B9C-11E0-9EA1-F1617C4C5968::1:::Experiment,40B58788-7B9C-11E0-8BD5-E1617C4C5968::1:::Experiment,37F9BE20-7B9C-11E0-938F-9F617C4C5968::1:::Experiment,23CD5FA6-7B9C-11E0-A0F4-2D617C4C5968::1:::Experiment,C5EE4E7C-7B9B-11E0-84E0-4F5E7C4C5968::1:::Experiment,407F6234-7B9C-11E0-8B7A-DF617C4C5968::1:::Experiment,378BCEE2-7B9C-11E0-A3EE-9D617C4C5968::1:::Experiment,3D1E34EE-7B9C-11E0-A6C3-C1617C4C5968::1:::Experiment,462F60B2-7B9C-11E0-BC2B-0D627C4C5968::1:::Experiment,3EEF440C-7B9C-11E0-B4F2-D1617C4C5968::1:::Experiment,C62B5EB6-7B9B-11E0-9C8A-515E7C4C5968::1:::Experiment,CC72F91E-7B9B-11E0-9ECE-7E5E7C4C5968::1:::Experiment,D44339B0-7B9B-11E0-BC46-AF5E7C4C5968::1:::Experiment,1F056A86-7B9C-11E0-805C-09617C4C5968::1:::Experiment,3BF220C6-7B9C-11E0-8F90-B7617C4C5968::1:::Experiment,3923D22C-7B9C-11E0-9D3F-A5617C4C5968::1:::Experiment,4047F9B6-7B9C-11E0-A127-DD617C4C5968::1:::Experiment,1C0B4832-7B9C-11E0-A2E1-F9607C4C5968::1:::Experiment,C79C9792-7B9B-11E0-8B12-5F5E7C4C5968::1:::Experiment,348659EC-7B9C-11E0-B801-8F617C4C5968::1:::Experiment,C669BA76-7B9B-11E0-8CA5-545E7C4C5968::1:::Experiment,40139BBC-7B9C-11E0-979C-DB617C4C5968::1:::Experiment,C6A6105C-7B9B-11E0-9E71-575E7C4C5968::1:::Experiment,CC36160C-7B9B-11E0-A7E6-7C5E7C4C5968::1:::Experiment,C6E17B56-7B9B-11E0-9CC5-595E7C4C5968::1:::Experiment,3FDBC46C-7B9C-11E0-9676-D9617C4C5968::1:::Experiment,3FA4A536-7B9C-11E0-AA0A-D7617C4C5968::1:::Experiment,CD2CDE24-7B9B-11E0-AE81-845E7C4C5968::1:::Experiment,C7213624-7B9B-11E0-9575-5B5E7C4C5968::1:::Experiment,3F68979E-7B9C-11E0-AFBD-D5617C4C5968::1:::Experiment,D280AF7C-7B9B-11E0-97CF-A35E7C4C5968::1:::Experiment,3F2BA17C-7B9C-11E0-83DF-D3617C4C5968::1:::Experiment,2EB4E812-7B9C-11E0-9F75-75617C4C5968::1:::Experiment,3EB8344E-7B9C-11E0-8362-CF617C4C5968::1:::Experiment,</source_ids><exptype>tpm</exptype> <asm>hg19</asm> <loc>chr21:1..34963714</loc> <display_width>970</display_width> <format>xml</format><mode>express</mode> <submode>5end</submode> <binning>sum</binning> </zenbu_query>";


  //string post_data ="<zenbu_query> <source_ids>4E4B47C8-8ADC-11DE-9CBB-FC970F2F5F45::1:::Experiment,4DD01D5A-8ADC-11DE-ACC9-81675D9B1252::1:::Experiment,576F4A8E-8ADC-11DE-B14E-AE778D4862AD::1:::Experiment,55BBA4F8-8ADC-11DE-B957-D811B6AEF512::1:::Experiment,</source_ids> <exptype>raw</exptype> <asm>hg18</asm> <loc>chr11:127624515..128106724</loc> <display_width>970</display_width> <format>xml</format><mode>region</mode> <submode>5end</submode><binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <source_ids>B8AD8E88-DB3F-11DE-8090-94DE46B56B58::1:::Experiment,21D8ECD0-DB41-11DE-A484-B9E07D1FBB02::1:::Experiment,</source_ids> <exptype>tagcount</exptype> <asm>mm9</asm> <loc>chr7:52251732..52259514</loc> <display_width>970</display_width> <format>xml</format><mode>peers</mode> <submode>area</submode> <binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <source_ids>D30C6BC0-7B9B-11E0-A43A-A75E7C4C5968::1:::Experiment,0C088F44-7B9C-11E0-83A3-A1607C4C5968::1:::Experiment,</source_ids> <exptype>tagcount</exptype> <asm>mm9</asm> <loc>chr7:52251732..52259514</loc> <display_width>970</display_width> <format>xml</format><mode>sources</mode> <submode>area</submode> <binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <peers>D30C6BC0-7B9B-11E0-A43A-A75E7C4C5968,0C088F44-7B9C-11E0-83A3-A1607C4C5968</peers> <exptype>tagcount</exptype> <asm>mm9</asm> <loc>chr7:52251732..52259514</loc> <display_width>970</display_width> <format>xml</format><mode>experiments</mode> <submode>area</submode> <binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <mode>experiments</mode> <filter>liver</filter>  </zenbu_query>";
  //string post_data ="<zenbu_query> <mode>peers</mode> </zenbu_query>";
  //string post_data ="<zenbu_query> <source_ids>51AD6440-FBFE-11DD-8787-5096FEFA0F18::1:::FeatureSource,</source_ids> <asm>mm9</asm> <loc>chr7:1..52259514</loc> <format>xml</format><submode>subfeature</submode> </zenbu_query>";

  //string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids>A5F85330-4C1B-4CA8-B482-5E8CBA6130B7::2:::Experiment,F3A8BD1A-AD3F-4EA3-B112-12D1332B5DD9::2:::Experiment,00021F1F-5F40-4863-8AA7-6DB1E569B38B::2:::Experiment,59212D84-2984-429B-9036-D43F499B7DAA::2:::Experiment,7FC93C7E-9F5F-4590-B9AA-1838B5B6C55A::2:::Experiment,B717B140-BD4A-44C7-A226-33F579704E0E::2:::Experiment,FD94F3E8-7234-4909-B4A4-B7AC3447F678::2:::Experiment,1A89D6B8-2778-4C44-A663-15AFD7B000A2::2:::Experiment,0199F68D-E5F3-485C-972B-323763A37DE0::2:::Experiment,34211259-D87B-440E-BECD-1F8C4A5A54EB::2:::Experiment,7502C766-64AA-4D8C-A17B-93FA0611A2F2::2:::Experiment,5F0E17E4-A74C-4E16-A7B3-E683C25750B0::2:::Experiment,E4AE44FA-473A-4D14-BFB4-6C47901CA35C::2:::Experiment,05124BA4-DC78-4804-B7E9-F210904DE781::2:::Experiment,E5BEED86-8DFE-4230-87C7-5C7735CC5244::2:::Experiment,0629BDAB-4E15-4466-9660-3F506621CE55::2:::Experiment,6BEECEBD-9138-4A2F-B81E-D424E0916661::2:::Experiment,5D773BF7-ECFD-4231-B53E-6ED907AAFD43::2:::Experiment,E664EE1F-D4C7-4370-8437-69028E4697FC::2:::Experiment,C9101F25-F2FF-452A-8E95-BB5B1F38CF3C::2:::Experiment,7C678D63-167D-4536-A5A4-EB6CEB022D5D::2:::Experiment,853D2AFE-F05C-4AED-A4E6-6464FCEED988::2:::Experiment,D952281B-1611-459B-A857-9E01D7F69758::2:::Experiment,A1D3B764-6211-47F6-A258-CAF239E1DFC9::2:::Experiment,BA1C474C-572B-4F4F-B367-C8178451A00F::2:::Experiment,BCC77EC3-0FA9-477E-BA7D-CEA2E72B12E2::2:::Experiment,D8E2ABDF-721D-4953-83E4-886D1867142D::2:::Experiment,931FAC83-BD00-466C-8EE3-D44C83AD9215::2:::Experiment,4DD18FD2-754A-4FC1-8D70-12E88E07281B::2:::Experiment,1F01D4D9-FD49-4374-8984-8964D9A9B8FB::2:::Experiment,EE7EB8B7-E641-498D-8183-7C741ED80B34::2:::Experiment,CB76C062-030A-4A04-9EF4-5BE4C1D11A28::2:::Experiment,EAE804A1-86D7-4537-953F-A3EC137B7B46::2:::Experiment,AE5AA02C-6A7A-4CE7-96FB-86C80959F62E::2:::Experiment,26D35D25-1F06-4473-B0A9-27D04426BD4F::2:::Experiment,EB7B3602-A779-4BF1-BA94-9248D142F310::2:::Experiment,0612BF87-B2F6-4166-B60C-46999C2A828A::2:::Experiment,F6368473-BAB6-4520-A78C-D2DBEBD599BD::2:::Experiment,DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment,A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment,2B8C7302-9679-4657-AB0E-5C91D3A12B4B::2:::Experiment,3D94AD6B-B7B5-44D5-B329-8120838588AB::2:::Experiment,9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment,BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment,E84D2D47-D4DE-471F-8EFA-3C0012CA1742::2:::Experiment,CA430572-1E0D-4E59-A50B-2E1D33336646::2:::Experiment,904A696A-62EC-4665-85B9-4F92DDFA9814::2:::Experiment,8EB257B8-6B26-4DB7-8470-07A708EC7CEF::2:::Experiment,6AC0554F-64A7-4B0C-BFD9-824A54C31D4D::2:::Experiment,EE7EE934-90E7-4280-ABEA-481421F6FD1A::2:::Experiment,A80763D0-F12C-449D-AFEA-288BEBE55C4A::2:::Experiment,74E98401-90F9-4FE4-B534-2AC4D3955753::2:::Experiment,6E61D1C3-F7FB-4633-8C48-ACBD3C47A74F::2:::Experiment,7C1D1E05-4DF3-48FB-9BDD-4965EC272211::2:::Experiment,7B4915C2-513D-44F7-A306-311719B2ADB4::2:::Experiment,AD886517-A1ED-452D-B852-6017329EFB01::2:::Experiment,25370A81-3434-4D14-9563-BB795348A212::2:::Experiment,E91C1BE8-9881-4ED5-B5BF-419F3683FEED::2:::Experiment,86C4F0C1-0659-4EE1-B4A5-0710F6142677::2:::Experiment,E062A46C-A201-4D70-8AB3-4105B6298CF4::2:::Experiment,17969D6E-894B-4291-8C29-E57800DAC5ED::2:::Experiment,9DECC724-7666-4389-BC39-35CE6CAC3961::2:::Experiment,A00E05EC-988E-4C2F-A397-227497CB9A41::2:::Experiment,A4ACC567-A1EC-4310-9F77-0751E8E6151B::2:::Experiment,41AA5D08-27DC-4586-8A50-66CCBAFD6921::2:::Experiment,3B7FE8C4-E35E-4246-8D53-C8FB1EBC1DB3::2:::Experiment,161A1F01-4A6B-40D7-98B5-014B7A79C846::2:::Experiment,DBE4BB64-155F-4CAD-B8EB-A3A4F352847B::2:::Experiment,F59B5046-5174-4F37-B96D-0FBCA6CF2DC1::2:::Experiment,8F4BD7BF-7A65-4D0C-B4B1-DA4B6C61A3CF::2:::Experiment,E77F8C14-651E-4BE8-8B85-875C999F406A::2:::Experiment,484F4AE3-A603-429B-8D7E-D0F68B0392BC::2:::Experiment,40194D90-A36B-4EB6-9666-DE6512EA3FB7::2:::Experiment,CA1C39D7-B6BA-411F-82D6-06FE180F3C6E::2:::Experiment,74484EA5-3A70-4B68-9CCD-5C98C7F34D5D::2:::Experiment,0F4B496B-AC75-4F57-9A3C-ADF6B9C0A213::2:::Experiment,2827CF37-7C87-485C-A9E8-B5C228720086::2:::Experiment,DEBB6DDB-1FAA-4DAF-9B16-3F55A522613F::2:::Experiment,117CAB08-8C50-4E97-94BC-EAAE28E1873F::2:::Experiment,B0234A44-E461-4EB2-9D4D-77A9EED174CC::2:::Experiment,7A26A4EF-6795-4A67-9AFE-528496FBF33A::2:::Experiment,13974F62-7921-47CC-8F84-39D91B760CE7::2:::Experiment,EA10084B-5558-4016-B4DD-20F766C2151E::2:::Experiment,B5CB824A-44CF-47A4-8FB8-946B984502E9::2:::Experiment,DB3BFA29-A676-4ACC-A9A0-238885D64C2A::2:::Experiment,BE9C01E0-8CDC-4D3D-B5B3-57E2C6F8EC65::2:::Experiment,B12403FB-E2A0-4E2E-B74C-30E83CC88B5C::2:::Experiment,BB18537E-51B6-4089-93D2-8086D325A32E::2:::Experiment,486054DE-8322-40C6-B030-F6D11BAB58D9::2:::Experiment,AF85841B-5575-431F-99B2-F39097E00CBE::2:::Experiment,F6AF3B90-CB84-423D-9E5B-674E8426DFEC::2:::Experiment,B74AA690-4651-4F10-BDF8-E0F3AC892EF1::2:::Experiment,539983EE-0346-4649-AC57-7EDF6A13677C::2:::Experiment,7308E890-31AD-497F-A6CF-17F11CED3A34::2:::Experiment,</source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"TemplateCluster\"> <overlap_mode>height</overlap_mode> <expression_mode>sum</expression_mode> <ignore_strand>true</ignore_strand> <overlap_subfeatures>true</overlap_subfeatures> <side_stream> <spstream module=\"Proxy\" name=\"gencode\"/> </side_stream> </spstream> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids> E4AE44FA-473A-4D14-BFB4-6C47901CA35C::2:::Experiment </source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"TemplateCluster\"> <overlap_mode>height</overlap_mode> <expression_mode>sum</expression_mode> <ignore_strand>true</ignore_strand> <overlap_subfeatures>true</overlap_subfeatures> <side_stream> <spstream module=\"Proxy\" name=\"gencode\"/> </side_stream> </spstream> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//  string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids>DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment, A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment, 2B8C7302-9679-4657-AB0E-5C91D3A12B4B::2:::Experiment, 3D94AD6B-B7B5-44D5-B329-8120838588AB::2:::Experiment, 9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment, BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment, E84D2D47-D4DE-471F-8EFA-3C0012CA1742::2:::Experiment, CA430572-1E0D-4E59-A50B-2E1D33336646::2:::Experiment, </source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"TemplateCluster\"> <overlap_mode>height</overlap_mode> <expression_mode>sum</expression_mode> <ignore_strand>true</ignore_strand> <overlap_subfeatures>true</overlap_subfeatures> <side_stream> <spstream module=\"Proxy\" name=\"gencode\"/> </side_stream> </spstream> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids> E4AE44FA-473A-4D14-BFB4-6C47901CA35C::2:::Experiment </source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"DevNull\"/> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//trail3 test with devnull
//string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids> E4AE44FA-473A-4D14-BFB4-6C47901CA35C::2:::Experiment,13974F62-7921-47CC-8F84-39D91B760CE7::2:::Experiment,EB7B3602-A779-4BF1-BA94-9248D142F310::2:::Experiment </source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"DevNull\"/> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids> DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment, A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment, 2B8C7302-9679-4657-AB0E-5C91D3A12B4B::2:::Experiment, 3D94AD6B-B7B5-44D5-B329-8120838588AB::2:::Experiment, 9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment, BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment, E84D2D47-D4DE-471F-8EFA-3C0012CA1742::2:::Experiment, CA430572-1E0D-4E59-A50B-2E1D33336646::2:::Experiment, </source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"DevNull\"/> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//string post_data =" <zenbu_query> <nocache/> <format>osc</format><source_ids>A5F85330-4C1B-4CA8-B482-5E8CBA6130B7::2:::Experiment,F3A8BD1A-AD3F-4EA3-B112-12D1332B5DD9::2:::Experiment,00021F1F-5F40-4863-8AA7-6DB1E569B38B::2:::Experiment,59212D84-2984-429B-9036-D43F499B7DAA::2:::Experiment,7FC93C7E-9F5F-4590-B9AA-1838B5B6C55A::2:::Experiment,B717B140-BD4A-44C7-A226-33F579704E0E::2:::Experiment,FD94F3E8-7234-4909-B4A4-B7AC3447F678::2:::Experiment,1A89D6B8-2778-4C44-A663-15AFD7B000A2::2:::Experiment,0199F68D-E5F3-485C-972B-323763A37DE0::2:::Experiment,34211259-D87B-440E-BECD-1F8C4A5A54EB::2:::Experiment,7502C766-64AA-4D8C-A17B-93FA0611A2F2::2:::Experiment,5F0E17E4-A74C-4E16-A7B3-E683C25750B0::2:::Experiment,E4AE44FA-473A-4D14-BFB4-6C47901CA35C::2:::Experiment,05124BA4-DC78-4804-B7E9-F210904DE781::2:::Experiment,E5BEED86-8DFE-4230-87C7-5C7735CC5244::2:::Experiment,0629BDAB-4E15-4466-9660-3F506621CE55::2:::Experiment,6BEECEBD-9138-4A2F-B81E-D424E0916661::2:::Experiment,5D773BF7-ECFD-4231-B53E-6ED907AAFD43::2:::Experiment,E664EE1F-D4C7-4370-8437-69028E4697FC::2:::Experiment,C9101F25-F2FF-452A-8E95-BB5B1F38CF3C::2:::Experiment,7C678D63-167D-4536-A5A4-EB6CEB022D5D::2:::Experiment,853D2AFE-F05C-4AED-A4E6-6464FCEED988::2:::Experiment,D952281B-1611-459B-A857-9E01D7F69758::2:::Experiment,A1D3B764-6211-47F6-A258-CAF239E1DFC9::2:::Experiment,BA1C474C-572B-4F4F-B367-C8178451A00F::2:::Experiment,BCC77EC3-0FA9-477E-BA7D-CEA2E72B12E2::2:::Experiment,D8E2ABDF-721D-4953-83E4-886D1867142D::2:::Experiment,931FAC83-BD00-466C-8EE3-D44C83AD9215::2:::Experiment,4DD18FD2-754A-4FC1-8D70-12E88E07281B::2:::Experiment,1F01D4D9-FD49-4374-8984-8964D9A9B8FB::2:::Experiment,EE7EB8B7-E641-498D-8183-7C741ED80B34::2:::Experiment,CB76C062-030A-4A04-9EF4-5BE4C1D11A28::2:::Experiment,EAE804A1-86D7-4537-953F-A3EC137B7B46::2:::Experiment,AE5AA02C-6A7A-4CE7-96FB-86C80959F62E::2:::Experiment,26D35D25-1F06-4473-B0A9-27D04426BD4F::2:::Experiment,EB7B3602-A779-4BF1-BA94-9248D142F310::2:::Experiment,0612BF87-B2F6-4166-B60C-46999C2A828A::2:::Experiment,F6368473-BAB6-4520-A78C-D2DBEBD599BD::2:::Experiment,DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment,A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment,2B8C7302-9679-4657-AB0E-5C91D3A12B4B::2:::Experiment,3D94AD6B-B7B5-44D5-B329-8120838588AB::2:::Experiment,9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment,BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment,E84D2D47-D4DE-471F-8EFA-3C0012CA1742::2:::Experiment,CA430572-1E0D-4E59-A50B-2E1D33336646::2:::Experiment,904A696A-62EC-4665-85B9-4F92DDFA9814::2:::Experiment,8EB257B8-6B26-4DB7-8470-07A708EC7CEF::2:::Experiment,6AC0554F-64A7-4B0C-BFD9-824A54C31D4D::2:::Experiment,EE7EE934-90E7-4280-ABEA-481421F6FD1A::2:::Experiment,A80763D0-F12C-449D-AFEA-288BEBE55C4A::2:::Experiment,74E98401-90F9-4FE4-B534-2AC4D3955753::2:::Experiment,6E61D1C3-F7FB-4633-8C48-ACBD3C47A74F::2:::Experiment,7C1D1E05-4DF3-48FB-9BDD-4965EC272211::2:::Experiment,7B4915C2-513D-44F7-A306-311719B2ADB4::2:::Experiment,AD886517-A1ED-452D-B852-6017329EFB01::2:::Experiment,25370A81-3434-4D14-9563-BB795348A212::2:::Experiment,E91C1BE8-9881-4ED5-B5BF-419F3683FEED::2:::Experiment,86C4F0C1-0659-4EE1-B4A5-0710F6142677::2:::Experiment,E062A46C-A201-4D70-8AB3-4105B6298CF4::2:::Experiment,17969D6E-894B-4291-8C29-E57800DAC5ED::2:::Experiment,9DECC724-7666-4389-BC39-35CE6CAC3961::2:::Experiment,A00E05EC-988E-4C2F-A397-227497CB9A41::2:::Experiment,A4ACC567-A1EC-4310-9F77-0751E8E6151B::2:::Experiment,41AA5D08-27DC-4586-8A50-66CCBAFD6921::2:::Experiment,3B7FE8C4-E35E-4246-8D53-C8FB1EBC1DB3::2:::Experiment,161A1F01-4A6B-40D7-98B5-014B7A79C846::2:::Experiment,DBE4BB64-155F-4CAD-B8EB-A3A4F352847B::2:::Experiment,F59B5046-5174-4F37-B96D-0FBCA6CF2DC1::2:::Experiment,8F4BD7BF-7A65-4D0C-B4B1-DA4B6C61A3CF::2:::Experiment,E77F8C14-651E-4BE8-8B85-875C999F406A::2:::Experiment,484F4AE3-A603-429B-8D7E-D0F68B0392BC::2:::Experiment,40194D90-A36B-4EB6-9666-DE6512EA3FB7::2:::Experiment,CA1C39D7-B6BA-411F-82D6-06FE180F3C6E::2:::Experiment,74484EA5-3A70-4B68-9CCD-5C98C7F34D5D::2:::Experiment,0F4B496B-AC75-4F57-9A3C-ADF6B9C0A213::2:::Experiment,2827CF37-7C87-485C-A9E8-B5C228720086::2:::Experiment,DEBB6DDB-1FAA-4DAF-9B16-3F55A522613F::2:::Experiment,117CAB08-8C50-4E97-94BC-EAAE28E1873F::2:::Experiment,B0234A44-E461-4EB2-9D4D-77A9EED174CC::2:::Experiment,7A26A4EF-6795-4A67-9AFE-528496FBF33A::2:::Experiment,13974F62-7921-47CC-8F84-39D91B760CE7::2:::Experiment,EA10084B-5558-4016-B4DD-20F766C2151E::2:::Experiment,B5CB824A-44CF-47A4-8FB8-946B984502E9::2:::Experiment,DB3BFA29-A676-4ACC-A9A0-238885D64C2A::2:::Experiment,BE9C01E0-8CDC-4D3D-B5B3-57E2C6F8EC65::2:::Experiment,B12403FB-E2A0-4E2E-B74C-30E83CC88B5C::2:::Experiment,BB18537E-51B6-4089-93D2-8086D325A32E::2:::Experiment,486054DE-8322-40C6-B030-F6D11BAB58D9::2:::Experiment,AF85841B-5575-431F-99B2-F39097E00CBE::2:::Experiment,F6AF3B90-CB84-423D-9E5B-674E8426DFEC::2:::Experiment,B74AA690-4651-4F10-BDF8-E0F3AC892EF1::2:::Experiment,539983EE-0346-4649-AC57-7EDF6A13677C::2:::Experiment,7308E890-31AD-497F-A6CF-17F11CED3A34::2:::Experiment,</source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <mode>region</mode><submode>subfeature</submode> <zenbu_script> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <datastream name=\"gencode\"> <source id=\"84EB16E9-A039-4F51-B2D3-0516F2944547::1:::FeatureSource\" name=\"UCSC gencode V11 March 2012\" /> </datastream> <stream_stack> <spstream module=\"DevNull\"/> </stream_stack> </zenbu_script> <loc2>chr8:128746973..128755020</loc2> <genome_scan>genome</genome_scan> </zenbu_query>";

//string post_data =" <zenbu_query> <source_ids>D71B7748-1450-4C62-92CB-7E913AB12899::19:::FeatureSource,</source_ids> <asm>hg19</asm> <loc>chr8:128746973..128755020</loc> <submode>subfeature</submode> <zenbu_script> <stream_stack> <spstream module=\"StreamTKs\"></spstream> </stream_stack> </zenbu_script><format>fullxml</format></zenbu_query>";

//string post_data ="<zenbu_query> <nocache/> <source_ids>A80763D0-F12C-449D-AFEA-288BEBE55C4A::2:::Experiment</source_ids> <exptype>tagcount</exptype> <asm>hg19</asm> <loc>chr8:128746973..128755020</loc> <display_width>970</display_width> <bin_size>8.295876288659795</bin_size> <mode>region</mode><expression_binning>true</expression_binning> <source_outmode>feature</source_outmode> <binning>sum</binning> <format>xml</format> </zenbu_query>";

string post_data ="<zenbu_query> <source_ids>38457C09-2792-41AB-85A7-DF8E2D2B827A::1:::FeatureSource,</source_ids> <asm>hg19</asm> <loc>chr8:128746973..128755020</loc> <mode>region</mode> <source_outmode>full_feature</source_outmode> <display_width>970</display_width> <bin_size>8.295876288659795</bin_size> <format>fullxml</format> </zenbu_query>";

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

  webservice->disconnect();
  //sleep(100);
}


void upgrade_oscdbs(vector<EEDB::Peer*> seedpeers) {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstream = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;
  EEDB::User                            *user;
  vector<EEDB::Peer*>::iterator         seed_it;

  printf("\n====== upgrade_oscdb == \n");
  gettimeofday(&starttime, NULL);
  EEDB::Peer::set_current_web_url("http://fantom.gsc.riken.jp/zenbu");
  fstream->set_peer_search_depth(7);

  for(seed_it = seedpeers.begin(); seed_it != seedpeers.end(); seed_it++) {
    fstream->add_seed_peer(*seed_it);
  }
  //fstream->add_peer_id_filter("21D8ECD0-DB41-11DE-A484-B9E07D1FBB02");
  //fstream->add_peer_id_filter("B8AD8E88-DB3F-11DE-8090-94DE46B56B58");
  stream = fstream;

  stream->stream_peers();
  count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    printf("%s\n", peer->xml().c_str());
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) { 
      printf("OK OSCDB\n");
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      oscdb->upgrade_db();
      count++;
    }
  }
  printf("%d peers\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void test_search_server() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  gettimeofday(&starttime, NULL);

  printf("\n== test_search_server\n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  //webservice->parse_config_file("/eeDB_intweb1/dbs/fantom5_release009/eedb_server_config.xml");
  //webservice->parse_config_file("/eeDB/dbs/fantom5_release009/eedb_server_config.xml");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  //string post_data ="<zenbu_query> <source_ids>4E4B47C8-8ADC-11DE-9CBB-FC970F2F5F45::1:::Experiment,4DD01D5A-8ADC-11DE-ACC9-81675D9B1252::1:::Experiment,576F4A8E-8ADC-11DE-B14E-AE778D4862AD::1:::Experiment,55BBA4F8-8ADC-11DE-B957-D811B6AEF512::1:::Experiment,</source_ids> <exptype>raw</exptype> <asm>hg18</asm> <loc>chr11:127624515..128106724</loc> <display_width>970</display_width> <format>xml</format><mode>region</mode> <submode>5end</submode><binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <source_ids>B8AD8E88-DB3F-11DE-8090-94DE46B56B58::1:::Experiment,21D8ECD0-DB41-11DE-A484-B9E07D1FBB02::1:::Experiment,</source_ids> <exptype>tagcount</exptype> <asm>mm9</asm> <loc>chr7:52251732..52259514</loc> <display_width>970</display_width> <format>xml</format><mode>peers</mode> <submode>area</submode> <binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <source_ids>D30C6BC0-7B9B-11E0-A43A-A75E7C4C5968::1:::Experiment,0C088F44-7B9C-11E0-83A3-A1607C4C5968::1:::Experiment,</source_ids> <exptype>tagcount</exptype> <asm>mm9</asm> <loc>chr7:52251732..52259514</loc> <display_width>970</display_width> <format>xml</format><mode>sources</mode> <submode>area</submode> <binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <peers>D30C6BC0-7B9B-11E0-A43A-A75E7C4C5968,0C088F44-7B9C-11E0-83A3-A1607C4C5968</peers> <exptype>tagcount</exptype> <asm>mm9</asm> <loc>chr7:52251732..52259514</loc> <display_width>970</display_width> <format>xml</format><mode>experiments</mode> <submode>area</submode> <binning>sum</binning> </zenbu_query>";

  //string post_data ="<zenbu_query> <mode>experiments</mode> <filter>CNhs10739</filter>  </zenbu_query>";
  //string post_data ="<zenbu_query> <mode>experiments</mode> <filter>fubar</filter>  </zenbu_query>";
  //string post_data ="<zenbu_query> <mode>feature_sources</mode> <filter>fubar</filter>  </zenbu_query>";
  //string post_data ="<zenbu_query> <mode>peers</mode> </zenbu_query>";
  string post_data ="<zenbu_query> <peers>430C6217-FA66-473C-8411-ED8DF0AFAE9E</peers><mode>sources</mode> </zenbu_query>";

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

  webservice->disconnect();
}


void upgrade_oscdbs_v2() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  printf("\n====== upgrade_oscdb == \n");
  gettimeofday(&starttime, NULL);

  webservice->parse_config_file("/zenbu/server_config/active_config.xml");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->init_service_request();
  string post_data ="<zenbu_query> <peers>6C9A5EFA-B74C-11E0-A5FE-F77B07DE6BB6</peers><mode>peers</mode> </zenbu_query>";
  webservice->set_post_data(post_data);
  webservice->process_xml_parameters();
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  stream = webservice->source_stream();

  stream->stream_peers();
  int upgrade_count=0;
  int upgradable=0;
  int total_peer_count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(!(peer->is_valid())) { printf("not valid\n"); }
    total_peer_count++;
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) { 
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(oscdb->oscdb_version() == 1) {
        //if(peer->db_url().find("fantom5")!=string::npos) { continue; }
        upgradable++;
        //if(peer->db_url().find("UPDATE_011_TSC_Balwierz_hg19")!=string::npos) {
          //printf("  UPGRADE\n");
          if(upgrade_count<50) { 
            printf("%s\n", peer->xml().c_str());
            oscdb->upgrade_db(); 
            upgrade_count++; 
          }
        //}
      }
      /*
      if(peer->db_url().find("eeDB/dbs/genas_autoload")!=string::npos) {
        printf("%s\n", peer->xml().c_str());
        if(oscdb->upgrade_db()) { upgrade_count++; }
      }
      */
    }
  }
  printf("%d total peers\n", total_peer_count);
  printf("%d upgradable\n", upgradable);
  printf("%d upgraded\n", upgrade_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  sleep(100);
}


void test_lsarchive() {
  EEDB::Tools::LSArchiveImport *lsa = new EEDB::Tools::LSArchiveImport();
  
  lsa->test_curl();
  vector<EEDB::Experiment*> exps = lsa->get_experiments_by_libraryID("CNhs13700");
  printf("retuned %d exps\n", (int)exps.size());

}


void test_paraclu() {
  struct timeval                  starttime,endtime,difftime;
  
  //http://osc-zenbu.gsc.riken.jp/zenbu2/gLyphs/#config=nZ1NGYElGBDqzm05B9XGND;loc=hg19::chr5:70221779..70249865
  
  
  EEDB::Peer  *peer = EEDB::Peer::new_from_url("bamdb:///eeDB/dbs/CThi10060.3959-67E4.GAT.bamdb");
  if(!peer) { printf("trouble with connecting\n"); return; }

  printf("%s\n", peer->xml().c_str());
  if(!(peer->retest_is_valid())) { printf("trouble with retest\n"); }

  EEDB::SPStreams::SourceStream  *sstream = peer->source_stream();
  if(!sstream) { printf("problem with source_stream\n"); return; }  

  sstream->add_expression_datatype_filter(EEDB::Datatype::get_type("tagcount"));

  EEDB::SPStream *stream = sstream;
 
    
  EEDB::SPStreams::FeatureEmitter *emitter = new EEDB::SPStreams::FeatureEmitter;
  emitter->fixed_grid(true);
  emitter->overlap(0);
  emitter->both_strands(true);
  emitter->width(1);
  
  EEDB::SPStreams::TemplateCluster *cluster = new EEDB::SPStreams::TemplateCluster;
  cluster->side_stream(emitter);
  cluster->source_stream(stream);
  cluster->ignore_strand(false);
  cluster->skip_empty_templates(true);
  cluster->expression_mode(EEDB::CL_SUM);
  cluster->overlap_mode("5end");
  stream = cluster;
  
  /*
  EEDB::SPStreams::CalcFeatureSignificance *fsig = new EEDB::SPStreams::CalcFeatureSignificance;
  fsig->source_stream(stream);
  fsig->expression_mode(EEDB::CL_SUM);
  stream = fsig;
  */
  
  EEDB::SPStreams::Paraclu *paraclu = new EEDB::SPStreams::Paraclu;
  paraclu->source_stream(stream);
  paraclu->min_stability(0.5);
  paraclu->min_value(10);
  paraclu->max_cluster_length(20);
  stream = paraclu;

  EEDB::SPStreams::CalcFeatureSignificance *featsig = new EEDB::SPStreams::CalcFeatureSignificance;
  featsig->source_stream(stream);
  stream = featsig;

  EEDB::SPStreams::NeighborCutoff *neighborcut = new EEDB::SPStreams::NeighborCutoff;
  neighborcut->source_stream(stream);
  neighborcut->min_ratio(50);
  neighborcut->neighbor_distance(100);
  stream = neighborcut;
  
  
  gettimeofday(&starttime, NULL);
  long int count=0;
  //stream->stream_by_named_region("hg19", "chr5", 70221779, 70249865);
  //stream->stream_by_named_region("hg19", "chr5", 71615676, 71616385);
  //stream->stream_by_named_region("hg19", "chr5", 76113812, 76115754);
  //stream->stream_by_named_region("hg19", "chr5", 76114720, 76115054);
  stream->stream_by_named_region("hg19", "chr11", 65267983, 65268292);

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


void test_upload_server() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::UploadServer      *webservice = new EEDB::WebServices::UploadServer();

  gettimeofday(&starttime, NULL);

  printf("\n== test_upload_server\n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  //webservice->parse_config_file("/eeDB_intweb1/dbs/fantom5_release009/eedb_server_config.xml");
  //webservice->parse_config_file("/eeDB/dbs/fantom5_release009/eedb_server_config.xml");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //string post_data ="<zenbu_query> <mode>queuestatus</mode> </zenbu_query>";
  //string post_data ="<zenbu_query> <mode>peers</mode> </zenbu_query>";

  webservice->init_service_request();

  //webservice->set_post_data(post_data);
  //webservice->process_xml_parameters();
  //gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  //printf("  after process_xml_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->set_parameter("mode", "queuestatus");
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->execute_request();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after execute_request %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->disconnect();
  //sleep(100);
}

void test_region_server2() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::RegionServer      *webservice = new EEDB::WebServices::RegionServer();

  gettimeofday(&starttime, NULL);

  printf("\n== test_region_server\n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  //webservice->parse_config_file("/eeDB_intweb1/dbs/fantom5_release009/eedb_server_config.xml");
  //webservice->parse_config_file("/eeDB/dbs/fantom5_release009/eedb_server_config.xml");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  string configXML ="<eeDBgLyphsTrackConfig> <collaboration uuid=\"public\" name=\"public - RIKEN FANTOM external\"/> <summary title=\"ENCODE caltech Wold-lab RNAseq - heatmap\" creator_openID=\"https://id.mixi.jp/28555316\" desc=\"the ENCODE Wold-lab RNAseq dataset visualized in expression heatmap style. all 94 RNAseq experiments\" asm=\"hg19\"/> <gLyphTrack title=\"ENCODE caltech Wold-lab RNAseq - heatmap\" glyphStyle=\"experiment-heatmap\" uuid=\"Ight5_0yGNsjVSV_tzYI4\" source_ids=\"A5F85330-4C1B-4CA8-B482-5E8CBA6130B7::2:::Experiment,F3A8BD1A-AD3F-4EA3-B112-12D1332B5DD9::2:::Experiment,00021F1F-5F40-4863-8AA7-6DB1E569B38B::2:::Experiment,59212D84-2984-429B-9036-D43F499B7DAA::2:::Experiment,7FC93C7E-9F5F-4590-B9AA-1838B5B6C55A::2:::Experiment,B717B140-BD4A-44C7-A226-33F579704E0E::2:::Experiment,FD94F3E8-7234-4909-B4A4-B7AC3447F678::2:::Experiment,1A89D6B8-2778-4C44-A663-15AFD7B000A2::2:::Experiment,0199F68D-E5F3-485C-972B-323763A37DE0::2:::Experiment,34211259-D87B-440E-BECD-1F8C4A5A54EB::2:::Experiment,7502C766-64AA-4D8C-A17B-93FA0611A2F2::2:::Experiment,5F0E17E4-A74C-4E16-A7B3-E683C25750B0::2:::Experiment,E4AE44FA-473A-4D14-BFB4-6C47901CA35C::2:::Experiment,05124BA4-DC78-4804-B7E9-F210904DE781::2:::Experiment,E5BEED86-8DFE-4230-87C7-5C7735CC5244::2:::Experiment,0629BDAB-4E15-4466-9660-3F506621CE55::2:::Experiment,6BEECEBD-9138-4A2F-B81E-D424E0916661::2:::Experiment,5D773BF7-ECFD-4231-B53E-6ED907AAFD43::2:::Experiment,E664EE1F-D4C7-4370-8437-69028E4697FC::2:::Experiment,C9101F25-F2FF-452A-8E95-BB5B1F38CF3C::2:::Experiment,7C678D63-167D-4536-A5A4-EB6CEB022D5D::2:::Experiment,853D2AFE-F05C-4AED-A4E6-6464FCEED988::2:::Experiment,D952281B-1611-459B-A857-9E01D7F69758::2:::Experiment,A1D3B764-6211-47F6-A258-CAF239E1DFC9::2:::Experiment,BA1C474C-572B-4F4F-B367-C8178451A00F::2:::Experiment,BCC77EC3-0FA9-477E-BA7D-CEA2E72B12E2::2:::Experiment,D8E2ABDF-721D-4953-83E4-886D1867142D::2:::Experiment,931FAC83-BD00-466C-8EE3-D44C83AD9215::2:::Experiment,4DD18FD2-754A-4FC1-8D70-12E88E07281B::2:::Experiment,1F01D4D9-FD49-4374-8984-8964D9A9B8FB::2:::Experiment,EE7EB8B7-E641-498D-8183-7C741ED80B34::2:::Experiment,CB76C062-030A-4A04-9EF4-5BE4C1D11A28::2:::Experiment,EAE804A1-86D7-4537-953F-A3EC137B7B46::2:::Experiment,AE5AA02C-6A7A-4CE7-96FB-86C80959F62E::2:::Experiment,26D35D25-1F06-4473-B0A9-27D04426BD4F::2:::Experiment,EB7B3602-A779-4BF1-BA94-9248D142F310::2:::Experiment,0612BF87-B2F6-4166-B60C-46999C2A828A::2:::Experiment,F6368473-BAB6-4520-A78C-D2DBEBD599BD::2:::Experiment,DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment,A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment,2B8C7302-9679-4657-AB0E-5C91D3A12B4B::2:::Experiment,3D94AD6B-B7B5-44D5-B329-8120838588AB::2:::Experiment,9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment,BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment,E84D2D47-D4DE-471F-8EFA-3C0012CA1742::2:::Experiment,CA430572-1E0D-4E59-A50B-2E1D33336646::2:::Experiment,904A696A-62EC-4665-85B9-4F92DDFA9814::2:::Experiment,8EB257B8-6B26-4DB7-8470-07A708EC7CEF::2:::Experiment,6AC0554F-64A7-4B0C-BFD9-824A54C31D4D::2:::Experiment,EE7EE934-90E7-4280-ABEA-481421F6FD1A::2:::Experiment,A80763D0-F12C-449D-AFEA-288BEBE55C4A::2:::Experiment,74E98401-90F9-4FE4-B534-2AC4D3955753::2:::Experiment,6E61D1C3-F7FB-4633-8C48-ACBD3C47A74F::2:::Experiment,7C1D1E05-4DF3-48FB-9BDD-4965EC272211::2:::Experiment,7B4915C2-513D-44F7-A306-311719B2ADB4::2:::Experiment,AD886517-A1ED-452D-B852-6017329EFB01::2:::Experiment,25370A81-3434-4D14-9563-BB795348A212::2:::Experiment,E91C1BE8-9881-4ED5-B5BF-419F3683FEED::2:::Experiment,86C4F0C1-0659-4EE1-B4A5-0710F6142677::2:::Experiment,E062A46C-A201-4D70-8AB3-4105B6298CF4::2:::Experiment,17969D6E-894B-4291-8C29-E57800DAC5ED::2:::Experiment,9DECC724-7666-4389-BC39-35CE6CAC3961::2:::Experiment,A00E05EC-988E-4C2F-A397-227497CB9A41::2:::Experiment,A4ACC567-A1EC-4310-9F77-0751E8E6151B::2:::Experiment,41AA5D08-27DC-4586-8A50-66CCBAFD6921::2:::Experiment,3B7FE8C4-E35E-4246-8D53-C8FB1EBC1DB3::2:::Experiment,161A1F01-4A6B-40D7-98B5-014B7A79C846::2:::Experiment,DBE4BB64-155F-4CAD-B8EB-A3A4F352847B::2:::Experiment,F59B5046-5174-4F37-B96D-0FBCA6CF2DC1::2:::Experiment,8F4BD7BF-7A65-4D0C-B4B1-DA4B6C61A3CF::2:::Experiment,E77F8C14-651E-4BE8-8B85-875C999F406A::2:::Experiment,484F4AE3-A603-429B-8D7E-D0F68B0392BC::2:::Experiment,40194D90-A36B-4EB6-9666-DE6512EA3FB7::2:::Experiment,CA1C39D7-B6BA-411F-82D6-06FE180F3C6E::2:::Experiment,74484EA5-3A70-4B68-9CCD-5C98C7F34D5D::2:::Experiment,0F4B496B-AC75-4F57-9A3C-ADF6B9C0A213::2:::Experiment,2827CF37-7C87-485C-A9E8-B5C228720086::2:::Experiment,DEBB6DDB-1FAA-4DAF-9B16-3F55A522613F::2:::Experiment,117CAB08-8C50-4E97-94BC-EAAE28E1873F::2:::Experiment,B0234A44-E461-4EB2-9D4D-77A9EED174CC::2:::Experiment,7A26A4EF-6795-4A67-9AFE-528496FBF33A::2:::Experiment,13974F62-7921-47CC-8F84-39D91B760CE7::2:::Experiment,EA10084B-5558-4016-B4DD-20F766C2151E::2:::Experiment,B5CB824A-44CF-47A4-8FB8-946B984502E9::2:::Experiment,DB3BFA29-A676-4ACC-A9A0-238885D64C2A::2:::Experiment,BE9C01E0-8CDC-4D3D-B5B3-57E2C6F8EC65::2:::Experiment,B12403FB-E2A0-4E2E-B74C-30E83CC88B5C::2:::Experiment,BB18537E-51B6-4089-93D2-8086D325A32E::2:::Experiment,486054DE-8322-40C6-B030-F6D11BAB58D9::2:::Experiment,AF85841B-5575-431F-99B2-F39097E00CBE::2:::Experiment,F6AF3B90-CB84-423D-9E5B-674E8426DFEC::2:::Experiment,B74AA690-4651-4F10-BDF8-E0F3AC892EF1::2:::Experiment,539983EE-0346-4649-AC57-7EDF6A13677C::2:::Experiment,7308E890-31AD-497F-A6CF-17F11CED3A34::2:::Experiment,\" exptype=\"tagcount\" datatype=\"tagcount\" submode=\"height\" scorecolor=\"fire3\" backColor=\"black\" hidezeroexps=\"true\"> <zenbu_script name=\"modified.modified.\"> <parameters> <source_outmode>skip_metadata</source_outmode> <skip_default_expression_binning>true</skip_default_expression_binning> </parameters> <stream_stack> <spstream module=\"TemplateCluster\"> <overlap_mode>height</overlap_mode> <expression_mode>sum</expression_mode> <overlap_subfeatures>true</overlap_subfeatures> <ignore_strand>true</ignore_strand> <side_stream> <spstream module=\"FeatureEmitter\"> <num_per_region>970</num_per_region> <fixed_grid>true</fixed_grid> <both_strands>false</both_strands> </spstream> </side_stream> </spstream> </stream_stack> </zenbu_script> </gLyphTrack> </eeDBgLyphsTrackConfig>";

  webservice->init_from_track_configXML(configXML);

  webservice->disconnect();
  //sleep(100);
}


void zdx_write_test1() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  //webservice->parse_config_file("/eeDB_intweb1/dbs/fantom5_release009/eedb_server_config.xml");


  long count=0;

  gettimeofday(&starttime, NULL);

  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new("test1.zdx");

  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_service_request();
  string post_data ="<zenbu_query> <format>xml</format><mode>experiments</mode> <filter>wold rnaseq</filter></zenbu_query>";
  webservice->set_post_data(post_data);
  webservice->process_xml_parameters();
  webservice->postprocess_parameters();

  stream = webservice->source_stream();
  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("Experiment", "wold rnaseq");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    //printf("%s\n", source->simple_xml().c_str());
    zdxstream->add_datasource(source);
    count++;

    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      t_peers[uuid] = peer; 
      zdxstream->add_peer(peer);
    }
  }
  printf("%ld sources\n", count);

  count=0;
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    //printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);
  zdxstream->write_source_section();


  // now stream region into features into ZDX

  //hg19::chr8:128746973-128755020


  zdxstream->release();

}

void zdx_write_test2() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();

  printf("\n== zdx_write_test2\n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_from_track_cache("73-OSH6MGFXqRrjECSrEw");

  stream = webservice->source_stream();

  long count=0;

  gettimeofday(&starttime, NULL);

  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new("test1.zdx");

  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("Experiment", "wold rnaseq");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    //printf("%s\n", source->simple_xml().c_str());
    zdxstream->add_datasource(source);
    count++;

    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      t_peers[uuid] = peer; 
      zdxstream->add_peer(peer);
    }
  }
  printf("%ld sources\n", count);

  count=0;
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    //printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);
  zdxstream->write_source_section();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //
  // do chrom testing
  //
  EEDB::SPStreams::RemoteServerStream *rstream = EEDB::SPStreams::RemoteServerStream::new_from_url("http://fantom.gsc.riken.jp/zenbu/");
  if(!rstream) { return; }
  
  printf("have remote connection\n");
  
  rstream->stream_chromosomes("hg19", "chr7");
  while(MQDB::DBObject *obj = rstream->next_in_stream()) { 
    if(!obj) { continue; }
    if(obj->classname() != EEDB::Chrom::class_name) { continue; }
    EEDB::Chrom* chrom = (EEDB::Chrom*)obj;
    printf("create chrom [%s]\n", chrom->xml().c_str());
    zdxstream->create_chrom(chrom);
    obj->release();
  }
  

  //
  // now stream region into features into ZDX
  //
  //hg19::chr8:128746973-128755020

  count=0;
  gettimeofday(&starttime, NULL);
  printf("stream region hg19 chr8 128746973 128755020\n");
  stream = webservice->region_stream();
  
  stream->stream_by_named_region("hg19", "chr8", 128746973, 128755020);
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
    EEDB::Feature *feature= (EEDB::Feature*)obj; 
    count++;

    //zdxstream->add_datasource(source);

    //feature->xml(_output_buffer);

    //printf("%s\n", feature->xml().c_str()); 

    //feature->_xml_start(_output_buffer);
    //feature->_xml_subfeatures(_output_buffer);
    //feature->_xml_end(_output_buffer);
    obj->release();
  }
  printf("done with region\n");
  
  zdxstream->release();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void zdx_read_test1() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  long count=0;

  printf("\n=== zdx_read_test1 ====\n");
  
  count=0;

  gettimeofday(&starttime, NULL);
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open("test1.zdx");
  stream = zdxstream;

  printf("== read back peers\n");
  count=0;
  stream->stream_peers();
  printf("after stream setup\n");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    //printf("%s\n", peer->simple_xml().c_str());
    count++;
  }
  printf("%ld peers\n", count);

  printf("== read back sources\n");
  count=0;
  stream->stream_data_sources();
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    //printf("%s\n", source->xml().c_str());
    count++;
  }
  printf("%ld sources\n", count);

  printf("== read chroms\n");
  ZDX::ZDXdb *zdxdb = ZDX::ZDXdb::open_zdx("test1.zdx");
  EEDB::ZDX::ZDXsegment *segment = new EEDB::ZDX::ZDXsegment(zdxdb);
  segment->show_chrom_segments();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("== read features\n");
  EEDB::SPStreams::RemoteServerStream *rstream = EEDB::SPStreams::RemoteServerStream::new_from_url("http://fantom.gsc.riken.jp/zenbu/");
  EEDB::Chrom *chrom = NULL;
  rstream->stream_chromosomes("hg19", "chr8");
  while(MQDB::DBObject *obj = rstream->next_in_stream()) {
    if(!obj) { continue; }
    if(obj->classname() != EEDB::Chrom::class_name) { continue; }
    chrom = (EEDB::Chrom*)obj;
    break;
  }
  printf("%s\n", chrom->xml().c_str());
  segment = EEDB::ZDX::ZDXsegment::new_at_position(zdxdb, chrom, 128746973);
  printf("%s\n", segment->xml().c_str());

  gettimeofday(&starttime, NULL);
  count=0;
  segment->stream_region(-1, -1); //all in segment
  //segment->stream_features(128746973, 128755020);
  while(EEDB::Feature *feature = (EEDB::Feature*)segment->next_in_stream()) {
    if(!feature) { continue; }
    //printf("%s\n", feature->xml().c_str());
    count++;
    feature->release();
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_remote_server1() {
  EEDB::SPStreams::RemoteServerStream *stream = EEDB::SPStreams::RemoteServerStream::new_from_url("http://f5-gb.gsc.riken.jp/zenbudev/");
  if(!stream) { return; }
  printf("have remote connection\n");
  
  EEDB::User* user = get_cmdline_user();
  stream->set_current_user(user);

  /*
  stream->stream_chromosomes("hg19", "chr1");
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    if(!obj) { continue; }
    printf("%s\n", obj->xml().c_str());
    obj->release();
  }
  stream->stream_chromosomes("hg19", "");
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    if(!obj) { continue; }
    printf("%s\n", obj->xml().c_str());
    obj->release();
  }
  */
  
  long count=0;
  stream->stream_peers();
  while(EEDB::Peer *peer = (EEDB::Peer*)stream->next_in_stream()) { 
    if(!peer) { continue; }
    if(peer->classname() != EEDB::Peer::class_name) { continue; }
    //printf("%s\n", peer->xml().c_str());
    peer->release();
    count++;
  }
  fprintf(stderr, "%ld peers\n", count);

  printf("\n===== object\n");
  //string fid ="B1880D44-F935-11DF-82E8-6158894DF986::4212631";
  //string fid ="181CB97E-01FC-4C02-8FB6-657AFAC0BBE7::2:::Experiment";
  //string fid ="181CB97E-01FC-4C02-8FB6-657AFAC0BBE7::1:::FeatureSource";
  string fid ="0FD68EDF-0F22-4B35-9FD6-8D53AC4B8FEF::2:::Experiment"; //private
  MQDB::DBObject *obj = stream->fetch_object_by_id(fid);
  if(obj) {
    printf("%s", obj->xml().c_str());
    obj->release();
  }

  printf("\n===== chroms\n");
  stream->stream_chromosomes("hg19", "");
  //stream->stream_chromosomes("hg19", "chr13");
  //stream->stream_chromosomes("", "");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(!obj) { continue; }
    printf("%s\n", obj->xml().c_str());
  }

  printf("\n===== sources\n");
  count=0;
  //stream->stream_data_sources("", "blackbriar");
  stream->stream_data_sources("Experiment", "fantom");
  //stream->stream_data_sources("FeatureSource", "fantom3");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    //printf("%s\n", obj->xml().c_str());
    obj->release();
    count++;
  }
  fprintf(stderr, "%ld sources\n", count);
  
  sleep(100000);
  stream->disconnect();
}



void zdx_write_test3() {
  struct timeval      starttime,endtime,difftime;
  long                count=0;
  
  printf("\n== zdx_write_test3\n");
  
  gettimeofday(&starttime, NULL);
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new("test1.zdx");
  ZDX::ZDXdb *zdxdb = ZDX::ZDXdb::open_zdx("test1.zdx");

  //
  // do chrom testing
  //
  EEDB::SPStreams::RemoteServerStream *rstream = EEDB::SPStreams::RemoteServerStream::new_from_url("http://fantom.gsc.riken.jp/zenbu/");
  if(!rstream) { return; }
  printf("have remote connection\n");
  
  vector<EEDB::Chrom*>       chroms;
  map<string, EEDB::Chrom*>  chrom_hash;

  rstream->stream_chromosomes("hg19", "");
  while(MQDB::DBObject *obj = rstream->next_in_stream()) { 
    if(!obj) { continue; }
    if(obj->classname() != EEDB::Chrom::class_name) { continue; }
    EEDB::Chrom* chrom = (EEDB::Chrom*)obj;
    chroms.push_back(chrom);
    chrom_hash[chrom->chrom_name()] = chrom;
  }
  

  printf("need to create %ld chroms\n", chroms.size());
  srand(time(NULL));
  count=0;
  for(int x=0; x<chroms.size(); x++) {
    EEDB::Chrom *chrom = chroms[x];
    if(chrom) {
      //printf("create %s", chrom->xml().c_str());
      if(zdxstream->create_chrom(chrom) != -1) { count++; }
    }
  }
  printf("created %ld chroms\n", count);

  //
  // get Track RegionServer
  //
  EEDB::WebServices::RegionServer  *regionserver = new EEDB::WebServices::RegionServer();  
  regionserver->parse_config_file("/zenbu/server_config/active_config.xml");
  regionserver->init_from_track_cache("faJQXaWBBNkgwH5tPgBLWB");
  regionserver->track_cache();

  string configXML = regionserver->generate_configXML();
  string hashkey   = MQDB::sha256(configXML);

  printf("%s\n", configXML.c_str());
  printf("hashkey [%s] %ld\n", hashkey.c_str(), (long)hashkey.length());

  EEDB::WebServices::RegionServer  *regionserver2 = new EEDB::WebServices::RegionServer();  
  regionserver2->parse_config_file("/zenbu/server_config/active_config.xml");
  regionserver2->init_from_track_configXML(configXML);

  string configXML2 = regionserver2->generate_configXML();
  hashkey   = MQDB::sha256(configXML2);

  printf("\n%s\n", configXML2.c_str());
  printf("hashkey [%s] %ld\n", hashkey.c_str(), (long)hashkey.length());

  if(configXML != configXML2) { printf("damn not equal\n"); }
  
  
  EEDB::SPStream   *track_stream = regionserver2->source_stream();
  
  printf("-- write track sources --\n");
  count=0;
  track_stream->stream_data_sources();
  while(EEDB::DataSource *source = (EEDB::DataSource*)track_stream->next_in_stream()) {
    //printf("%s\n", source->simple_xml().c_str());
    zdxstream->add_datasource(source);
    count++;
    
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) {
      zdxstream->add_peer(peer);
    }
  }
  zdxstream->write_source_section();
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld sources in %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  printf("--- write segment features ---\n");
  printf("build region hg19 chr8 128746973 128755020\n");
  //hg19::chr8:128746973-128755020

  track_stream = regionserver2->region_stream();

  count=0;
  gettimeofday(&starttime, NULL);
  EEDB::Chrom *chrom = chrom_hash["chr8"];
  //long pos = 1;
  long pos = 128746973;
  //while(pos<=146364022) {
  while(pos<=128755020) {
    EEDB::ZDX::ZDXsegment *zseg = zdxstream->claim_build_segment(chrom, pos);
    if(!zseg) { break; }
    printf("have segment %s\n", zseg->xml().c_str());

    string xmlbuf;
    //track_stream->stream_by_named_region("hg19","chr8", 128746973, 128755020);
    track_stream->stream_by_named_region(zseg->assembly_name(), zseg->chrom_name(), zseg->chrom_start(), zseg->chrom_end());
    while(MQDB::DBObject *obj = track_stream->next_in_stream()) {
      if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
      EEDB::Feature *feature= (EEDB::Feature*)obj; 
      count++;

      //if(!feature->build_expression_hash()) { printf("has previous express hash\n"); }
      zseg->add_sorted_feature(feature);

      if(feature->chrom_start() <= 128750863 and feature->chrom_end() >= 128750863) {
        printf("%s\n", feature->xml().c_str());

        xmlbuf.clear();
        feature->xml_interchange(xmlbuf, 1);
        printf("%ld\n%s\n", xmlbuf.size(), xmlbuf.c_str()); 
      }

      /*
      xmlbuf.clear();
      feature->xml(xmlbuf); 
      printf("%ld\n%s\n", xmlbuf.size(), xmlbuf.c_str()); 
     

      xmlbuf.clear();
      feature->xml_interchange(xmlbuf, 1);
      printf("%ld\n%s\n", xmlbuf.size(), xmlbuf.c_str()); 
      */

      //feature->_xml_start(_output_buffer);
      //feature->_xml_subfeatures(_output_buffer);
      //feature->_xml_end(_output_buffer);
      if(count % 100 == 0) {
        gettimeofday(&endtime, NULL);
        timersub(&endtime, &starttime, &difftime);
        double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
        printf("%10ld features  %1.6f obj/sec\n", count, rate);
      }

      obj->release();
    }
    printf("done with region segment\n");
    zseg->write_segment_features(); //flush remaining features

    pos = zseg->chrom_end()+1;
  }

  zdxstream->release();
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void zdx_write_test4() {
  struct timeval      starttime,endtime,difftime;
  long                count=0;
  gettimeofday(&starttime, NULL);
  
  printf("\n== zdx_write_test4\n");
  
  char dirbuf[2048];
  getcwd(dirbuf, 2048);
  string path = string(dirbuf) + "/test4.zdx";
  printf("%s\n", path.c_str());
  
  EEDB::ZDX::ZDXstream *zdxstream;
  EEDB::Peer* peer1;
  
  zdxstream = EEDB::ZDX::ZDXstream::open(path);
  if(!zdxstream) {
    zdxstream = EEDB::ZDX::ZDXstream::create_new(path);
    peer1 = zdxstream->self_peer();
    printf("%s\n", peer1->xml().c_str());
    zdxstream->release();
    zdxstream = EEDB::ZDX::ZDXstream::open(path);
  }

  peer1 = zdxstream->self_peer();
  printf("%s\n", peer1->xml().c_str());
  zdxstream->release();
  
  string url = string("zdx://") + path;
  printf("Load from URL :: %s\n", url.c_str());
  EEDB::Peer* peer2 = EEDB::Peer::new_from_url(url);
  printf("%s\n", peer2->xml().c_str());
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


bool gff_write_zdx_test() {
  struct timeval      starttime,endtime,difftime;
  long                count=0;
  char                strbuffer[8192];
  string              _error_msg;

  map<string, EEDB::Datatype*> datatypes;
  map<string, bool>            sourceid_filter;
  
  gettimeofday(&starttime, NULL);
  
  fprintf(stderr, "\n== gff_write_zdx_test\n");

  //fake the input/output parameters
  char dirbuf[2048];
  getcwd(dirbuf, 2048);
  string path = string(dirbuf) + "/test4.zdx";
  fprintf(stderr, "%s\n", path.c_str());
  
  //string inpath = "/Volumes/HD-HSU2/data/gencode/gencode.v19.annotation.gtf.gz";
  string inpath = string(dirbuf) + "/gencode.v19.annotation_chr7.gtf";
  string genome = "hg19";
  //boost::algorithm::to_lower(genome);
  
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);

  //first count lines of input file to adjust segment size
  gzFile gz = gzopen(inpath.c_str(), "rb");
  if(!gz) {
    fprintf(stderr, "failed to gzopen input file\n");
    return false;
  }
  count=0;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }
    count++;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "input file %ld lines in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);

  //create the ZDX file
  gettimeofday(&starttime, NULL); //reset timer
  EEDB::ZDX::ZDXstream *zdxstream;
  EEDB::Peer* peer1;
  
  zdxstream = EEDB::ZDX::ZDXstream::create_new(path);
  peer1 = zdxstream->self_peer();
  fprintf(stderr, "%s\n", peer1->xml().c_str());
  //TODO: adjust segment_size if needed
  
  //create the genome chromosomes in the ZDX
  ZDXdb* zdxdb = zdxstream->zdxdb();
  long numchroms =  EEDB::ZDX::ZDXsegment::num_chroms(zdxdb);
  if(numchroms == 0) { 
    //
    // make sure all the chrom and segments are built
    //
    fprintf(stderr, "build zdx chroms [%s] ... ", genome.c_str());
    EEDB::WebServices::RegionServer *webservice = new EEDB::WebServices::RegionServer();
    webservice->parse_config_file("/zenbu/server_config/active_config.xml");
    webservice->init_service_request();
    webservice->postprocess_parameters();
        
    EEDB::Assembly *assembly = webservice->find_assembly(genome);
    if(assembly) {
      vector<EEDB::Chrom*> chroms;
      assembly->all_chroms(chroms);
      for(unsigned int j=0; j<chroms.size(); j++) {
        EEDB::Chrom *chrom = chroms[j];
        if(chrom->chrom_length() < 1) { continue; }
        zdxstream->create_chrom(chrom);
      }
    } else {
      fprintf(stderr, "failed to get assembly and make ZDX chroms\n");
    }
    
    numchroms =  EEDB::ZDX::ZDXsegment::num_chroms(zdxdb);
    fprintf(stderr, "zdx loaded %ld chroms\n", numchroms);
  }
  
  
  //
  // OscFileParser based parsing
  //
  EEDB::Tools::OSCFileParser *oscparser = new EEDB::Tools::OSCFileParser();
  oscparser->set_parameter("assembly", genome);

  //start the parsing
  if(!oscparser->init_from_file(inpath)) { 
    _error_msg+="unable to parse file format. ";
  }  
  if(!oscparser->default_assembly()) { //to make sure it is initialized
    _error_msg+="no genome_assembly is defined. ";
  }
  if(!oscparser->primary_feature_source()) { //to make sure it is initialized
    _error_msg+="problem creating oscfile primary_feature_source. ";
  }
  
  int chrom_idx, start_idx, end_idx, strand_idx; 
  oscparser->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
  if(chrom_idx== -1 || start_idx==-1) {
    _error_msg+="malformed file: does not defined chrom or chrom_start columns. "; 
  }
  
  if(!_error_msg.empty()) {
    fprintf(stderr, "%s\n", _error_msg.c_str());
  }
  string filetype  = oscparser->get_parameter("filetype");
  fprintf(stderr, "parsing [%s] filetype\n", filetype.c_str());

  oscparser->set_parameter("_skip_ignore_on_output", "true");  //not sure if I need
  
  //reading of file and line parsing  
  gzrewind(gz);
  EEDB::ZDX::ZDXsegment* zseg = NULL;

  string current_chromname;
  count=0;
  long last_update=starttime.tv_sec;
  string tline;
  EEDB::Feature *current_feature=NULL;
  string  current_parent_id;
  map<string,long> category_count;

  long feature_id=1;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }
    
    if(filetype == "osc") { 
      if(count==0) { //first non-parameter/comment line is the header columns line
        count++;
        fprintf(stderr, "_sort_input_file -- oscheader [%s]\n", _data_buffer);
        continue;
      }
    }
    count++;
    tline = _data_buffer; //tmp copy for error message. not efficient but no other nice way
    
    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    if(_data_buffer == p1) {
      //empty line
      continue;
    }
        
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    EEDB::Feature* feature = oscparser->convert_dataline_to_feature(_data_buffer, EEDB::FULL_FEATURE, datatypes, sourceid_filter);
    if(!feature) { 
      snprintf(strbuffer, 8190, "datafile error, unable to parse line %ld --[", count);
      _error_msg = strbuffer + tline + "]";
      return false;
    }
    
    string chrname = "unmapped";
    if(feature->chrom()) { 
      chrname = feature->chrom()->chrom_name();
      if(chrname == "*") { chrname = "unmapped"; } 
    }
    if(current_chromname != chrname) {
      current_chromname = chrname;
      fprintf(stderr, "changed to chrom [%s]\n", current_chromname.c_str());
    }

    string category = feature->feature_source()->category();
    category_count[category]++;
    
    //TODO: GFF based sub-feature consolidation
    if((filetype == "gff") || (filetype == "gff3") || (filetype == "gff2") || (filetype == "gtf")) { 
      if(!current_feature) { current_feature = feature; }
      EEDB::Metadata* md1 = feature->metadataset()->find_metadata("transcript_id","");
      if(md1) { 
        if(current_parent_id != md1->data()) {
          current_parent_id = md1->data();
          current_feature = feature;
          current_feature->primary_name(md1->data());
        } else {
          //printf("add subfeature %s\n", feature->simple_xml().c_str());
          current_feature->add_subfeature(feature);
          continue;
        }
      }
    }
    feature->primary_id(feature_id++);
    //printf("%s", feature->xml().c_str());
    
    //TODO: write into ZDX
    if(!zseg 
       || (zseg->assembly_name() != feature->chrom()->assembly_name()) 
       || (zseg->chrom_name() != feature->chrom()->chrom_name())
       || (feature->chrom_start() > zseg->chrom_end())
       || (feature->chrom_start() < zseg->chrom_start())
       ) {
      if(zseg) {
        //write the old zsegment
        zseg->write_segment_features();
        zseg->release();
      }
      zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, feature->chrom()->assembly_name(), feature->chrom()->chrom_name(), feature->chrom_start());
      zseg->reclaim_for_appending();
      //fprintf(stderr, "changed ZDXsegment %s\n", zseg->xml().c_str());
    }
    if(zseg) {
      zseg->add_unsorted_feature(feature);
    } else { fprintf(stderr, "failed to fetch zseg\n"); }
    
    feature->release();
    
    //show an progress update every 3 seconds
    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 3) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
    }
  }

  //finish the last zsegment
  if(zseg) { zseg->write_segment_features(); } //write the old zsegment

  gzclose(gz); //close input file

  //TODO: maybe reload each zsegment, sort, and rebuild
  
  //TODO: go through all the segments and make sure all the empty ones are "filled" in as completed
    
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));  
  fprintf(stderr, "%ld output features\n", feature_id-1);
 

  map<string,long>::iterator it1;
  for(it1=category_count.begin(); it1!=category_count.end(); it1++) {
    printf("%s :: %ld\n", it1->first.c_str(), (*it1).second);
  } 


  //test : reopen the zdx file and check at least the total counts 
  gettimeofday(&starttime, NULL); //reset timer
  count=0;
  zdxstream->stream_by_named_region("hg19", "chr7", -1, -1);
  while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
    EEDB::Feature    *feature = NULL;
    EEDB::Expression *expression = NULL;
    if(obj->classname() == EEDB::Feature::class_name) { feature = (EEDB::Feature*)obj; }
    if(obj->classname() == EEDB::Expression::class_name) { 
      feature    = ((EEDB::Expression*)obj)->feature(); 
      expression = (EEDB::Expression*)obj; 
    }
    if(feature == NULL) { obj->release(); printf("oops\n"); continue; }
    count++;
    obj->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "zdx read %ld features in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);


  free(_data_buffer);
  zdxstream->release();
  return true;
}


void zdx_read_test2() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  long count=0;

  printf("\n=== zdx_read_test1 ====\n");
  
  count=0;

  gettimeofday(&starttime, NULL);
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open("test1.zdx");
  stream = zdxstream;

  printf("== read back peers\n");
  count=0;
  stream->stream_peers();
  printf("after stream setup\n");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    //printf("%s\n", peer->simple_xml().c_str());
    count++;
  }
  printf("%ld peers\n", count);

  printf("== read back sources\n");
  count=0;
  stream->stream_data_sources();
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    //printf("%s\n", source->xml().c_str());
    count++;
  }
  printf("%ld sources\n", count);

  printf("== read chroms\n");
  ZDX::ZDXdb *zdxdb = ZDX::ZDXdb::open_zdx("test1.zdx");
  EEDB::ZDX::ZDXsegment *segment = new EEDB::ZDX::ZDXsegment(zdxdb);
  segment->show_chrom_segments();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  printf("== read features\n");
  gettimeofday(&starttime, NULL);
  count=0;
  //zdxstream->stream_by_named_region("hg19", "chr8", 128746973, 128755020); //all in segment
  zdxstream->stream_by_named_region("hg19", "chr8", -1, -1); //all in segment
  while(EEDB::Feature *feature = (EEDB::Feature*)zdxstream->next_in_stream()) { 
    if(!feature) { continue; }
 
    if(feature->chrom_start() <= 128750863 and feature->chrom_end() >= 128750863) {
      printf("%s\n", feature->xml().c_str());
    }
    count++;
    feature->release();
    

    if(count%100000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
    }
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  sleep(1000);
}


void zdx_read_test3() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  printf("\n=== zdx_read_test3 ====\n");
  long count=0;
  int64_t size=0;
  gettimeofday(&starttime, NULL);
  ZDX::ZDXdb *zdxdb = ZDX::ZDXdb::open_zdx("test1.zdx");
  EEDB::ZDX::ZDXsegment* segment = EEDB::ZDX::ZDXsegment::fetch(zdxdb, "hg19", "chr8", -1);
  while(segment) {
    printf("%s\n", segment->xml().c_str());
    long s1 = segment->test_next_znode();
    while(s1>0) {
      size += s1;
      s1 = segment->test_next_znode();
    }
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    printf("%1.3f MB/sec\n", (size/1024.0/1024.0) /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

    EEDB::ZDX::ZDXsegment* seg = segment->next_segment();
    segment->release();
    segment = seg;
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  printf("%1.3f MB/sec\n", (size/1024.0/1024.0) /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  sleep(100);
}



void trackcache_test1() {  
  struct timeval      starttime,endtime,difftime;  
  long                count=0;  

  printf("\n== trackcache_test1\n");  
  gettimeofday(&starttime, NULL);  

  //
  // get Track RegionServer
  //
  EEDB::WebServices::RegionServer  *regionserver = new EEDB::WebServices::RegionServer();
  regionserver->parse_config_file("/zenbu/server_config/active_config.xml");
  
  string configXML ="<eeDBgLyphsTrackConfig> <collaboration uuid=\"private\" name=\"private\"/> <summary title=\"GencodeV10 - collated expression ENCODE caltech Wold-lab RNAseq (RPKM)\" creator_openID=\"https://id.mixi.jp/28555316\" desc=\"test of a track with data sources, reversed stream_queue and side stream with multiple modules\" asm=\"hg19\"/> <gLyphTrack title=\"GencodeV10 - collated expression ENCODE caltech Wold-lab RNAseq (RPKM)\" glyphStyle=\"transcript\" source_ids=\"EB7B3602-A779-4BF1-BA94-9248D142F310::2:::Experiment,BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment,26D35D25-1F06-4473-B0A9-27D04426BD4F::2:::Experiment,9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment,E77F8C14-651E-4BE8-8B85-875C999F406A::2:::Experiment,B0234A44-E461-4EB2-9D4D-77A9EED174CC::2:::Experiment,BB18537E-51B6-4089-93D2-8086D325A32E::2:::Experiment,B12403FB-E2A0-4E2E-B74C-30E83CC88B5C::2:::Experiment,74E98401-90F9-4FE4-B534-2AC4D3955753::2:::Experiment,E5BEED86-8DFE-4230-87C7-5C7735CC5244::2:::Experiment,7A26A4EF-6795-4A67-9AFE-528496FBF33A::2:::Experiment,484F4AE3-A603-429B-8D7E-D0F68B0392BC::2:::Experiment,7FC93C7E-9F5F-4590-B9AA-1838B5B6C55A::2:::Experiment,117CAB08-8C50-4E97-94BC-EAAE28E1873F::2:::Experiment,A80763D0-F12C-449D-AFEA-288BEBE55C4A::2:::Experiment,B717B140-BD4A-44C7-A226-33F579704E0E::2:::Experiment,A00E05EC-988E-4C2F-A397-227497CB9A41::2:::Experiment,7502C766-64AA-4D8C-A17B-93FA0611A2F2::2:::Experiment,A4ACC567-A1EC-4310-9F77-0751E8E6151B::2:::Experiment,0629BDAB-4E15-4466-9660-3F506621CE55::2:::Experiment,F6AF3B90-CB84-423D-9E5B-674E8426DFEC::2:::Experiment,7B4915C2-513D-44F7-A306-311719B2ADB4::2:::Experiment,5F0E17E4-A74C-4E16-A7B3-E683C25750B0::2:::Experiment,6BEECEBD-9138-4A2F-B81E-D424E0916661::2:::Experiment,AD886517-A1ED-452D-B852-6017329EFB01::2:::Experiment,B74AA690-4651-4F10-BDF8-E0F3AC892EF1::2:::Experiment,74484EA5-3A70-4B68-9CCD-5C98C7F34D5D::2:::Experiment,BA1C474C-572B-4F4F-B367-C8178451A00F::2:::Experiment,BCC77EC3-0FA9-477E-BA7D-CEA2E72B12E2::2:::Experiment,D8E2ABDF-721D-4953-83E4-886D1867142D::2:::Experiment,931FAC83-BD00-466C-8EE3-D44C83AD9215::2:::Experiment,0F4B496B-AC75-4F57-9A3C-ADF6B9C0A213::2:::Experiment,0199F68D-E5F3-485C-972B-323763A37DE0::2:::Experiment,A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment,E062A46C-A201-4D70-8AB3-4105B6298CF4::2:::Experiment,DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment,DBE4BB64-155F-4CAD-B8EB-A3A4F352847B::2:::Experiment,DB3BFA29-A676-4ACC-A9A0-238885D64C2A::2:::Experiment,A5F85330-4C1B-4CA8-B482-5E8CBA6130B7::2:::Experiment,161A1F01-4A6B-40D7-98B5-014B7A79C846::2:::Experiment,904A696A-62EC-4665-85B9-4F92DDFA9814::2:::Experiment,8EB257B8-6B26-4DB7-8470-07A708EC7CEF::2:::Experiment,86C4F0C1-0659-4EE1-B4A5-0710F6142677::2:::Experiment,853D2AFE-F05C-4AED-A4E6-6464FCEED988::2:::Experiment,F3A8BD1A-AD3F-4EA3-B112-12D1332B5DD9::2:::Experiment,7C678D63-167D-4536-A5A4-EB6CEB022D5D::2:::Experiment,EAE804A1-86D7-4537-953F-A3EC137B7B46::2:::Experiment\" exptype=\"tagcount\" datatype=\"tagcount_rpkm\" scorecolor=\"fire1\" source_outmode=\"skip_metadata\"> <zenbu_script name=\"modified.GencodeV10 expression\" desc=\"Uses GencodeV10 transcripts as template for expression collation. Only collates expression for primary signal which falls on exons of GencodeV10 transcript models.\"> <datastream name=\"gencode\"> <source id=\"D71B7748-1450-4C62-92CB-7E913AB12899::19:::FeatureSource\"/> </datastream> <stream_queue> <spstream module=\"TemplateCluster\"> <overlap_mode>height</overlap_mode> <skip_empty_templates>false</skip_empty_templates> <expression_mode>sum</expression_mode> <overlap_subfeatures>true</overlap_subfeatures> <ignore_strand>true</ignore_strand> <side_stream> <spstream module=\"EEDB::SPStream::Proxy\" name=\"gencode\"/> <spstream module=\"MakeStrandless\"/> </side_stream> </spstream> <spstream module=\"NormalizeRPKM\"/> <spstream module=\"CalcFeatureSignificance\"/> </stream_queue> </zenbu_script> </gLyphTrack> <create_date>Thu Jun 14 20:59:47 2012</create_date> <trackUUID>XyUyANC7HV_tGBM1mBTeqD</trackUUID> <config_eeid>BA3E77B4-79FD-11DF-B53E-0560894DF986::114</config_eeid> <process_summary processtime_sec=\"0.559447\"/> </eeDBgLyphsTrackConfig>";

  //string configXML ="<eeDBgLyphsTrackConfig> <collaboration uuid=\"private\" name=\"private\"/> <summary title=\"GencodeV10 - collated expression ENCODE caltech Wold-lab RNAseq (RPKM)\" creator_openID=\"https://id.mixi.jp/28555316\" desc=\"test of a track with data sources, reversed stream_queue and side stream with multiple modules\" asm=\"hg19\"/> <gLyphTrack title=\"GencodeV10 - collated expression ENCODE caltech Wold-lab RNAseq (RPKM)\" glyphStyle=\"transcript\" source_ids=\"EB7B3602-A779-4BF1-BA94-9248D142F310::2:::Experiment,BEFE3F0D-7437-4920-9805-036196CDE147::2:::Experiment,26D35D25-1F06-4473-B0A9-27D04426BD4F::2:::Experiment,9505E849-BF67-4266-AD31-5D387654BE12::2:::Experiment,E77F8C14-651E-4BE8-8B85-875C999F406A::2:::Experiment,B0234A44-E461-4EB2-9D4D-77A9EED174CC::2:::Experiment,BB18537E-51B6-4089-93D2-8086D325A32E::2:::Experiment,B12403FB-E2A0-4E2E-B74C-30E83CC88B5C::2:::Experiment,74E98401-90F9-4FE4-B534-2AC4D3955753::2:::Experiment,E5BEED86-8DFE-4230-87C7-5C7735CC5244::2:::Experiment,7A26A4EF-6795-4A67-9AFE-528496FBF33A::2:::Experiment,484F4AE3-A603-429B-8D7E-D0F68B0392BC::2:::Experiment,7FC93C7E-9F5F-4590-B9AA-1838B5B6C55A::2:::Experiment,117CAB08-8C50-4E97-94BC-EAAE28E1873F::2:::Experiment,A80763D0-F12C-449D-AFEA-288BEBE55C4A::2:::Experiment,B717B140-BD4A-44C7-A226-33F579704E0E::2:::Experiment,A00E05EC-988E-4C2F-A397-227497CB9A41::2:::Experiment,7502C766-64AA-4D8C-A17B-93FA0611A2F2::2:::Experiment,A4ACC567-A1EC-4310-9F77-0751E8E6151B::2:::Experiment,0629BDAB-4E15-4466-9660-3F506621CE55::2:::Experiment,F6AF3B90-CB84-423D-9E5B-674E8426DFEC::2:::Experiment,7B4915C2-513D-44F7-A306-311719B2ADB4::2:::Experiment,5F0E17E4-A74C-4E16-A7B3-E683C25750B0::2:::Experiment,6BEECEBD-9138-4A2F-B81E-D424E0916661::2:::Experiment,AD886517-A1ED-452D-B852-6017329EFB01::2:::Experiment,B74AA690-4651-4F10-BDF8-E0F3AC892EF1::2:::Experiment,74484EA5-3A70-4B68-9CCD-5C98C7F34D5D::2:::Experiment,BA1C474C-572B-4F4F-B367-C8178451A00F::2:::Experiment,BCC77EC3-0FA9-477E-BA7D-CEA2E72B12E2::2:::Experiment,D8E2ABDF-721D-4953-83E4-886D1867142D::2:::Experiment,931FAC83-BD00-466C-8EE3-D44C83AD9215::2:::Experiment,0F4B496B-AC75-4F57-9A3C-ADF6B9C0A213::2:::Experiment,0199F68D-E5F3-485C-972B-323763A37DE0::2:::Experiment,A652B729-3BDD-4A29-9320-EABA999213F8::2:::Experiment,E062A46C-A201-4D70-8AB3-4105B6298CF4::2:::Experiment,DD730F53-EB60-4795-ACC8-D9C059113DAC::2:::Experiment,DBE4BB64-155F-4CAD-B8EB-A3A4F352847B::2:::Experiment,DB3BFA29-A676-4ACC-A9A0-238885D64C2A::2:::Experiment,A5F85330-4C1B-4CA8-B482-5E8CBA6130B7::2:::Experiment,161A1F01-4A6B-40D7-98B5-014B7A79C846::2:::Experiment,904A696A-62EC-4665-85B9-4F92DDFA9814::2:::Experiment,8EB257B8-6B26-4DB7-8470-07A708EC7CEF::2:::Experiment,86C4F0C1-0659-4EE1-B4A5-0710F6142677::2:::Experiment,853D2AFE-F05C-4AED-A4E6-6464FCEED988::2:::Experiment,F3A8BD1A-AD3F-4EA3-B112-12D1332B5DD9::2:::Experiment,7C678D63-167D-4536-A5A4-EB6CEB022D5D::2:::Experiment,EAE804A1-86D7-4537-953F-A3EC137B7B46::2:::Experiment\" exptype=\"tagcount\" datatype=\"tagcount_rpkm\" scorecolor=\"fire1\" source_outmode=\"skip_metadata\"> <zenbu_script name=\"modified.GencodeV10 expression\" desc=\"Uses GencodeV10 transcripts as template for expression collation. Only collates expression for primary signal which falls on exons of GencodeV10 transcript models.\"> <datastream name=\"gencode\"> <source id=\"D71B7748-1450-4C62-92CB-7E913AB12899::19:::FeatureSource\"/> </datastream> <stream_stack> <spstream module=\"CalcFeatureSignificance\"/> <spstream module=\"NormalizeRPKM\"/> <spstream module=\"TemplateCluster\"> <overlap_mode>height</overlap_mode> <skip_empty_templates>false</skip_empty_templates> <expression_mode>sum</expression_mode> <overlap_subfeatures>true</overlap_subfeatures> <ignore_strand>true</ignore_strand> <side_stream> <spstream module=\"MakeStrandless\"/> <spstream module=\"EEDB::SPStream::Proxy\" name=\"gencode\"/> </side_stream> </spstream> </stream_stack> </zenbu_script> </gLyphTrack> <create_date>Thu Jun 14 20:59:47 2012</create_date> <trackUUID>XyUyANC7HV_tGBM1mBTeqD</trackUUID> <config_eeid>BA3E77B4-79FD-11DF-B53E-0560894DF986::114</config_eeid> <process_summary processtime_sec=\"0.559447\"/> </eeDBgLyphsTrackConfig>";

  regionserver->init_from_track_configXML(configXML);

  string configXML1 = regionserver->generate_configXML();
  string hashkey   = MQDB::sha256(configXML1);

  printf("%s\n", configXML1.c_str());
  printf("hashkey [%s] %ld\n", hashkey.c_str(), (long)hashkey.length());

  printf("\n===================\n\n");
  EEDB::WebServices::RegionServer  *regionserver2 = new EEDB::WebServices::RegionServer();
  regionserver2->parse_config_file("/zenbu/server_config/active_config.xml");
  regionserver2->init_from_track_configXML(configXML1);

  string configXML2 = regionserver2->generate_configXML();
  hashkey   = MQDB::sha256(configXML2);

  printf("\n%s\n", configXML2.c_str());
  printf("hashkey [%s] %ld\n", hashkey.c_str(), (long)hashkey.length());

  if(configXML1 != configXML2) { printf("damn not equal\n"); }

  return;
}


void region_server_test7() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();

  printf("\n== region_server_test7\n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_service_request();
  webservice->set_parameter("trackcache", "6b8f969795495a5eaf681fe545db2f1d8a55a123685e273138d9c5dff8dd6f6c");
  webservice->set_parameter("mode", "sources");
  webservice->postprocess_parameters();

  string configXML = webservice->generate_configXML();
  printf("%s\n", configXML.c_str());

  stream = webservice->region_stream();

  long count=0;
  gettimeofday(&starttime, NULL);

  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    //printf("%s\n", source->simple_xml().c_str());
    count++;

    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      t_peers[uuid] = peer; 
    }
  }
  printf("%ld sources\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void zdx_read_test4() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  printf("\n=== zdx_read_test4 ====\n");
  long count=0;
  int64_t size=0;
  gettimeofday(&starttime, NULL);
  //EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open("/zenbu/region_cache/trackcache_0/ztc_133b.zdx");
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open("/zenbu/region_cache/trackcache_0/ztc_133.zdx");
  ZDXdb *zdxdb = zdxstream->zdxdb();

  zdxstream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)zdxstream->next_in_stream()) {
    printf("%s", source->simple_xml().c_str());
    count++;
  }
  printf("%ld sources\n", count);

  count=0;
  zdxstream->stream_by_named_region("hg19", "chr17", 46139546, 46186749);
  //hg19::chr17:46139546-46186749
  while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
    count++;
    //cout << obj->simple_xml();
  }

  printf("%ld features\n", count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void region_server_test_overlapmerge() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();
  
  printf("\n== region_server_test_overlapmerge \n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  //EEDB::User* user = get_cmdline_user();
  //webservice->set_user_profile(user);
  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->set_parameter("nocache", "true");
  //webservice->set_parameter("trackcache", "4648f555a7359c7878257fb71c241d4de0dbdba456422656a77cc9555489745");
  //webservice->set_parameter("trackcache", "d2c93d5c893dfccb4ea14f3a1e421fb22ed60342fd688e2254a166fff8369c");
  //webservice->set_parameter("trackcache", "7c122b483a54f6ad1fac7da2d499fc1a929819eb4d7af2521c4eb55a91456d88");
  //webservice->set_parameter("trackcache", "846c11907e9058cc56d5ed4ca33a72cb9368f5de41774bf82d6b21fb01dcd");
  //webservice->set_parameter("trackcache", "517a741104560b76222c23d9597f98746be3ceae4f8730138f86bd9f1744dd");
  //webservice->set_parameter("trackcache", "18521b89986124dd590dff04d422f142e5863bfe0d46734b56f973dfd859d");
  //webservice->set_parameter("trackcache", "e31b3e759c4fe1d2c9f24fce4d0ad17437a97e437d5c2df424ef27ed637ee");
  //webservice->set_parameter("trackcache", "8512a745c163e379e132c13c95c3911bbbbc2dd836ffc7c776133d9acd1d9");
  //webservice->set_parameter("trackcache", "f2d8d2952ee4585c8d64ad1c433f27ed2c09f723ed7fa801b85f03de4fa70ff");
  webservice->set_parameter("trackcache", "c343ba8f69d070446bacc8a15ae24584b8957b5e2d15900fd69df2834ee269c");
  webservice->set_parameter("mode", "sources");
  webservice->postprocess_parameters();
  
  string configXML = webservice->generate_configXML();
  printf("%s\n", configXML.c_str());

  //EEDB::TrackCache* track_cache = webservice->track_cache(); //generates or fetches based on region config
  //printf("%s\n", track_cache->track_configxml().c_str());
  
  stream = webservice->region_stream();

  EEDB::SPStreams::OverlapMerge *merge = new EEDB::SPStreams::OverlapMerge();
  merge->distance(100);
  merge->ignore_strand(true);
  merge->expression_mode(EEDB::CL_SUM);
  merge->overlap_check_subfeatures(false);
  merge->merge_subfeatures(false);
  merge->source_stream(stream);
  stream = merge;

  stream->stream_clear();
  printf("%s\n", stream->xml().c_str());

  //EEDB::TrackCache* track_cache = webservice->track_cache(); //generates or fetches based on region config
  //printf("%s\n", track_cache->track_configxml().c_str());
  
  long count=0;
  gettimeofday(&starttime, NULL);
  
  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->simple_xml().c_str());
    count++;
    
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      t_peers[uuid] = peer; 
    }
  }
  printf("%ld sources\n", count);
  
  count=0;
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));


  //phase2 open-end read test
  printf("== read features\n");

  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_clear();
  //stream->stream_by_named_region("mm9", "chr7", 52236168, 52275078); //till end of chrom
  //stream->stream_by_named_region("mm9", "chr7", 52236168, -1); //till end of chrom
  //stream->stream_by_named_region("mm9", "chr7", -1, -1); //till end of chrom

  //stream->stream_by_named_region("hg38","chr4", 52712033, 52714559);
  //stream->stream_by_named_region("hg19", "chr19", 50161252, 50170707);
  //stream->stream_by_named_region("hg19","chr19", 36377615, 36399522);
  //stream->stream_by_named_region("hg38","chr14", 58297691, 58298845);
  //stream->stream_by_named_region("hg38","chr11", 65495585,65508646);
  stream->stream_by_named_region("hg38","chr8", 56433341, 56436864);
  //printf("region hg38::chr11:65495585-65508646\n");
  
  while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) { 
    if(!feature) { continue; }
    
    printf("%s\t%s\n", feature->chrom_location().c_str(), feature->primary_name().c_str());
    //printf("%s\n", feature->bed_description("bed6").c_str());
    //printf("%s\n", feature->xml().c_str());

    //feature->load_expression();
    //if(feature->chrom_start() <= 128750863 and feature->chrom_end() >= 128750863) {
    //  printf("%s\n", feature->xml().c_str());
    //}
    count++;    
    
    if(count%1000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec [%ld obj]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0), count);
    }
    feature->release();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_proc_memory() {
  struct timeval starttime,endtime,difftime;

  long count=0;
  gettimeofday(&starttime, NULL);

  try {
    while(count<1000000) {
      count++;    
    
      malloc(10024);
      double vm_usage, resident_set;
      MQDB::process_mem_usage(vm_usage, resident_set);
      if(resident_set > 512*1024) {
        //512MB
        fprintf(stderr, "self immolate, %f MB memory usage\n", resident_set/1024.0);
        throw(1);
      }

      if(count%1000 == 0) {
        gettimeofday(&endtime, NULL);
        timersub(&endtime, &starttime, &difftime);
        //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
        printf("%1.3f obj/sec [%ld obj] [%f usage :: %f resident]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0), count, vm_usage, resident_set);
      }
    }
  }
  catch (int e) {
    cout << "An exception occurred. Exception Nr. " << e << endl;
  }


  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  double rate = count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", rate, count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void region_server_test8b() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();
  
  printf("\n== region_server_test8 \n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_service_request();
  webservice->set_parameter("trackcache", "e31b3e759c4fe1d2c9f24fce4d0ad17437a97e437d5c2df424ef27ed637ee");
  webservice->set_parameter("mode", "sources");
  webservice->postprocess_parameters();
  
  string configXML = webservice->generate_configXML();
  printf("%s\n", configXML.c_str());
  
  stream = webservice->region_stream();
  
  stream->stream_clear();
  
  long count=0;
  gettimeofday(&starttime, NULL);
  
  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->simple_xml().c_str());
    count++;
    
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      t_peers[uuid] = peer; 
    }
  }
  printf("%ld sources\n", count);
  
  count=0;
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));


  //phase2 open-end read test
  printf("== read features\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_clear();
  stream->stream_by_named_region("mm9", "chr7", 52236168, -1); //till end of chrom

  
  while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) { 
    if(!feature) { continue; }
    
    //if(feature->chrom_start() <= 128750863 and feature->chrom_end() >= 128750863) {
    //  printf("%s\n", feature->xml().c_str());
    //}
    count++;    
    
    if(count%1000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
    }
    feature->release();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_hmac() {
  //first try to generate nice secret-key

  string message;
  for(unsigned i=0; i<10; i++) { message += uuid_hexstring(); }
  printf("message = [%s]\n", message.c_str());
  //string secret = sha512(message);
  string secret = sha256(message);
  printf("hmac_secretkey = [%s]\n", secret.c_str());
}


EEDB::User* get_cmdline_user() {
  //reads ~/.zenbu/id_hmac to get hmac authentication secret
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  
  struct passwd *pw = getpwuid(getuid());
  string path = pw->pw_dir;
  path += "/.zenbu/id_hmac";
  fildes = open(path.c_str(), O_RDONLY, 0x700);
  if(fildes<0) { return NULL; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);
  printf("config file %lld bytes long\n", (long long)cfg_len);
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  char* openID = strtok(config_text, " \t\n");
  char* secret = strtok(NULL, " \t\n");
  
  printf("[%s] -> [%s]\n", openID, secret);
  
  EEDB::User* user = new EEDB::User();
  if(openID) { user->add_openID(openID); }
  if(secret) { user->hmac_secretkey(secret); }
  
  free(config_text);
  close(fildes);
  return user;
}


void malloc_test() {
  char* ptr=NULL;
  long  size=0;
  for(int i=0; i<100; i++) {
    for(int j=0; j<100; j++) {
      size += 2*1024*1024;
      ptr = (char*)realloc(ptr, size);
      memset(ptr, 1, size);
    }
    printf("have big buffer\n");
    sleep(5);
    free(ptr);
    ptr = NULL;
    size=0;
    printf("freed big buffer\n");
    sleep(5);
  }
}


void test_validation_email() {
  fprintf(stderr, "test_validation_email\n");
  EEDB::WebServices::UserSystem*  webservice = new EEDB::WebServices::UserSystem();
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_service_request();

  //fake user login
  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_openID(userdb, "https://id.mixi.jp/28555316");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  //webservice->set_parameter("profile_email", "alistair.forrest@@gmail.com");
  //webservice->set_parameter("profile_email", "jessica.severin@@gmail.com");
  webservice->set_parameter("profile_email", "severin@@gsc.riken.jp");
  webservice->set_parameter("nickname", "jessica");
  webservice->postprocess_parameters();

  //webservice->send_validation_email();
  //webservice->send_invitation_email();
}


void test_oscdb_feature_mdata_index() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  EEDB::User* user = get_cmdline_user();

  printf("\n====== test_oscdb_feature_mdata_index == \n");
  gettimeofday(&starttime, NULL);
  
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->set_user_profile(user);
  
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    printf("  param[%s] = [%s]\n", (*param).first.c_str(), (*param).second.c_str());
    webservice->set_parameter((*param).first, (*param).second);
  }
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  stream = webservice->source_stream();
  
  stream->stream_peers();
  while(MQDB::DBObject* obj = stream->next_in_stream()) {
    printf("%s\n", obj->xml().c_str());
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}



void test_collab_convert() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();

  printf("\n== test_collab_convert \n");
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_service_request();

  //EEDB::User* user = get_cmdline_user();
  //webservice->set_user_profile(user);
  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);


  vector<MQDB::DBObject*> collabs;
  vector<MQDB::DBObject*>::iterator it_collab;

  char  inbuf[2048];
  while(true) {
    MQDB::DBCache::clear_cache();

    printf("enter collaboration_id: ");
    fgets(inbuf, 2048, stdin);
    long collab_id = atoi(inbuf);
    if(collab_id==0) { printf("goodbye\n"); return; }
    printf("you selected id %ld\n", collab_id);
    
    //collabs = EEDB::Collaboration::fetch_all(userdb);
    //collabs.push_back(EEDB::Collaboration::fetch_by_id(userdb, 57));
  
    //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_id(userdb, 155);
    //for(it_collab=collabs.begin(); it_collab!=collabs.end(); it_collab++) {

    //EEDB::Collaboration* collab = (EEDB::Collaboration*)(*it_collab);
    
    EEDB::Collaboration* collab = EEDB::Collaboration::fetch_by_id(userdb, collab_id);
  
    fprintf(stderr, "\n==========================\n");
    fprintf(stderr, "%s\n", collab->xml().c_str());

    EEDB::Peer *collabReg1 = collab->group_registry();
    if(!collabReg1) { fprintf(stderr, "could not fetch collab peer\n"); continue; }
    EEDB::SPStream *stream1 = collabReg1->source_stream();
    MQDB::Database *db1 = collabReg1->peer_database();
    if(db1->driver() == string("sqlite")) {
      printf("already sqlite -- %s\n", collabReg1->xml().c_str());
      continue;
    }
    fprintf(stderr, "%s\n", collab->metadataset()->xml().c_str());

    vector<EEDB::Peer*> transfer_peers;
    fprintf(stderr,"===== orig reg peers ====\n");
    stream1->stream_peers();
    while(MQDB::DBObject* obj = stream1->next_in_stream()) {
      EEDB::Peer *p2 = (EEDB::Peer*)obj;
      if(p2->driver() == "mysql") {
        printf("SKIP!!!! %s\n", obj->xml().c_str());
        continue;
      }
      //printf("%s\n", obj->xml().c_str());
      transfer_peers.push_back(p2);
    }
    fprintf(stderr, "%d peers to transfer\n", transfer_peers.size());
    fprintf(stderr,"=========================\n");

    EEDB::Peer *collabReg2 = collab->create_sqlite_registry();
    MQDB::Database *db2 = collabReg2->peer_database();
    fprintf(stderr, "%s\n", db2->xml().c_str());
  
    //TODO loop on the peers and save into db2
    long copy_cnt=0;
    vector<EEDB::Peer*>::iterator it1;
    fprintf(stderr,"=== save into seqlite ===\n");
    for(it1=transfer_peers.begin(); it1!=transfer_peers.end(); it1++) {
      EEDB::Peer *p3 = *it1;
      if(!p3->retest_is_valid()) {
        printf("NOT VALID --- %s\n", p3->xml().c_str());
        continue;
      }
      p3->store(db2);
      printf("COPIED --- %s\n", p3->xml().c_str());
      copy_cnt++;
    }
    fprintf(stderr, "%d peers copied\n", copy_cnt);
    fprintf(stderr,"=========================\n");

    printf("OK to switch registry to sqlite? ");
    fgets(inbuf, 2048, stdin);
    if(inbuf[0] == 'y') {
      printf("  flipping registry to sqlite\n");

      const char *sql = "update collaboration_2_metadata join metadata using(metadata_id ) set data_type=\"group_mysql_registry\" where data_type =\"group_registry\" and collaboration_id =?";
      fprintf(stderr, "%s %ld\n", sql, collab->primary_id());
      userdb->do_sql(sql, "d", collab->primary_id());

      sql = "update collaboration_2_metadata join metadata using(metadata_id ) set data_type=\"group_registry\" where data_type =\"group_sqlite_registry\" and collaboration_id =?";
      fprintf(stderr, "%s %ld\n", sql, collab->primary_id());
      userdb->do_sql(sql, "d", collab->primary_id());
    }
    
  }
}


void test_mann_whitney() {
  struct timeval      starttime,endtime,difftime;
  long                count=0;
  
  printf("\n== test_mann_whitney\n");
  
  gettimeofday(&starttime, NULL);

  //
  // get Track RegionServer
  //
  EEDB::WebServices::RegionServer  *regionserver = new EEDB::WebServices::RegionServer();  
  regionserver->parse_config_file("/etc/zenbu/zenbu.conf");
  regionserver->init_service_request();
  regionserver->init_from_track_cache("25ae618f802731d916e310b37bee6a4f486f932f6b46fb22e6a9d43b6d21355");
  //regionserver->set_parameter("nocache", "true");

  MQDB::Database *userdb = regionserver->userDB();
  printf("%s\n", userdb->xml().c_str());
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  regionserver->set_user_profile(user);

  regionserver->postprocess_parameters(); //must do after all init and setting of user

  EEDB::TrackCache *trackcache = regionserver->track_cache();
  printf("%s\n", trackcache->track_configxml().c_str());
  printf("hashkey [%s]\n", trackcache->track_hashkey().c_str());

  EEDB::SPStream   *track_stream = regionserver->region_stream();

  //append the mann whitney module
  EEDB::SPStreams::MannWhitneyRanksum* mannwhit = new EEDB::SPStreams::MannWhitneyRanksum();
  //mannwhit->set_min_zscore(2.327);
  mannwhit->set_experiment_filter("run_no:=1");
  mannwhit->source_stream(track_stream);
  track_stream = mannwhit;
  //mannwhit->loadprep_experiment_metadata();
  //printf("%s\n", mannwhit->mdgroup_xml().c_str());
  
  printf("-- sources --\n");
  count=0;
  //track_stream->stream_data_sources();
  track_stream->stream_data_sources("Experiment", "run_no:=1");
  while(EEDB::DataSource *source = (EEDB::DataSource*)track_stream->next_in_stream()) {
    //printf("%s\n", source->simple_xml().c_str());
    count++;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld sources in %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  printf("-- features --\n");
  count=0;
  printf("%s\n", track_stream->xml().c_str());
//  track_stream = regionserver->region_stream();
  //track_stream->stream_by_named_region("hg38", "chr17", 61397503, 61411859);
  track_stream->stream_by_named_region("hg38", "chr17", -1, -1);

  //hg38::chr17:61397503-61411859
  while(MQDB::DBObject *obj = track_stream->next_in_stream()) {
    if(obj->classname() != EEDB::Feature::class_name) { obj->release(); continue; }
    EEDB::Feature *feature= (EEDB::Feature*)obj; 
    count++;
    //printf("%s\n", feature->xml().c_str());

    //TODO: collate/count the different significant mdata to try to find larger patterns

    if(count % 100 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      double rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%10ld features  %1.6f obj/sec\n", count, rate);
    }

    obj->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void migrate_f5zenbu_public() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>              uuid_peers_f5;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstreamf5 = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;

  EEDB::Peer::set_cache_behaviour(false);

  printf("\n====== migrate_f5zenbu_public == \n");
  gettimeofday(&starttime, NULL);

  //first make sure we have the collaboration registry
  string reg_url ="sqlite:///zenbu/users/UJ10dh3mHxXmPKNIYQmid/group_registry.sqlite";
  EEDB::Peer* f5collab_reg = EEDB::Peer::new_from_url(reg_url);
  if(!f5collab_reg or !(f5collab_reg->is_valid())) {
    printf("\nERROR: unable to connect to registry [%s]!!\n\n", reg_url.c_str());
    return;
  }
  //MQDB::Database *registry_db = new MQDB::Database(reg_url);
  MQDB::Database *registry_db = f5collab_reg->peer_database();
  if((registry_db==NULL) or !(registry_db->get_connection())) { 
    printf("\nERROR: unable to connect to registry database [%s]!!\n\n", reg_url.c_str());
    return;
  }
  printf("registry::\n   %s\n", f5collab_reg->xml().c_str());
  //registry_db->disconnect();


  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();

  //webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  //EEDB::User* user = get_cmdline_user();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters(); //must do after all init and setting of user

  EEDB::SPStream* stream1 = webservice->source_stream();

  count=0;
  printf("  -- stream main zenbu peers\n");
  stream1->stream_peers();
  while(MQDB::DBObject *obj = stream1->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    //cout << peer->xml();
    peer->retain();
    uuid_peers[peer->uuid()] = peer;
    count++;
  }
  printf("%d main peers %d\n", count, uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  printf("  -- stream fantom5 zenbu peers\n");
  fstreamf5->set_peer_search_depth(7);
  EEDB::Peer  *f5regpeer = EEDB::Peer::new_from_url("http://f5-zenbu.gsc.riken.jp/zenbu/");
  if(f5regpeer) {
    printf("%s\n", f5regpeer->xml().c_str());
    fstreamf5->add_seed_peer(f5regpeer);
  }
  fstreamf5->stream_peers();
  while(MQDB::DBObject *obj = fstreamf5->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    //cout << peer->xml();
    peer->retain();
    uuid_peers_f5[peer->uuid()] = peer;
    count++;
  }
  printf("%d f5 peers %d\n", count, uuid_peers_f5.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //
  // now compare lists for missing peers
  //
  map<string,long>  peer_types;
  map<string,long>  peer_dirs;
  map<string,long>::iterator it2;

  count=0;
  for(it=uuid_peers_f5.begin(); it!=uuid_peers_f5.end(); it++) {
    EEDB::Peer *peer2 = (*it).second;
    if(uuid_peers.find((*it).first) == uuid_peers.end()) {
      printf("missing [%s] -- %s\n", (*it).first.c_str(), (*it).second->alias().c_str());
      count++;

      string f5url = peer2->alias();
      size_t p1 = f5url.find("://");
      string t_driver;
      if(p1!=string::npos) { 
        t_driver = boost::algorithm::to_lower_copy(f5url.substr(0, p1)); 
        peer_types[t_driver]++;

        string path1 = f5url.substr(p1+3);
        if(t_driver == "http" || t_driver=="zenbu") {
        } else if(t_driver == "mysql" || t_driver=="sqlite") {
          peer_dirs[f5url]++;
        } else {
          string path1 = f5url.substr(p1+3);
          p1 = path1.rfind("/");
          string path2 = path1.substr(0,p1);
          string path3 = path1.substr(p1+1);
          printf("  [%s] [%s] [%s]\n", t_driver.c_str(), path2.c_str(), path3.c_str());
          peer_dirs[path2]++;

          //do the local test and link
          EEDB::Peer* lpeer = EEDB::Peer::new_from_url(f5url);
          if(lpeer && lpeer->is_valid() && ((*it).first == string(lpeer->uuid()))) {
            printf("  found LOCAL version -- %s\n", lpeer->xml().c_str());

            if(lpeer->db_url().empty()) {
              printf("  WOAH! db_url is not defined, relocate to where it should be\n");
              relocate_peer(lpeer, f5url);
              printf("  -- %s\n", lpeer->xml().c_str());
            }

            lpeer->store(registry_db);
            //printf("connected\n");
            //sleep(10);
          }
        }
      }
    }
  } 
  printf("%d missing peers need to copy/link\n", count);
  printf("-- types\n");
  for(it2=peer_types.begin(); it2!=peer_types.end(); it2++) {
    printf("  %s - %ld\n", (*it2).first.c_str(), (*it2).second);
  }
  printf("-- dirs\n");
  for(it2=peer_dirs.begin(); it2!=peer_dirs.end(); it2++) {
    printf("  %s - %ld\n", (*it2).first.c_str(), (*it2).second);
  }

}


void relocate_peer(EEDB::Peer *peer, string db_url) {
  if(!peer) { return; }
  if(!peer->is_valid()) { return; }

  peer->db_url(db_url);

  if(peer->driver() == "oscdb") {
    printf("%s\n", peer->xml().c_str());
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)peer->source_stream();
    EEDB::Peer* oscpeer = oscdb->peer();
    if(oscpeer->db_url() != db_url) {
      printf("relocate  %s\n", oscpeer->xml().c_str());
      oscpeer->db_url(db_url);
      oscdb->save_xmldb();
      printf("  %s\n", oscpeer->xml().c_str());
    }
  } else if(peer->driver() == "bamdb") {
    printf("%s\n", peer->xml().c_str());
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)peer->source_stream();
    EEDB::Peer* bampeer = bamdb->peer();
    printf("relocate  %s\n", bampeer->xml().c_str());
    bampeer->db_url(db_url);
    bamdb->save_xmldb();
    printf("  %s\n", bampeer->xml().c_str());
  }   
  else if(peer->driver() == "zdx") {    
    EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)peer->source_stream();
    EEDB::Peer* zdxpeer = zdxstream->self_peer();
    printf("%s\n", zdxpeer->xml().c_str());
    zdxpeer->db_url(db_url);
    zdxstream->write_source_section();
    zdxpeer = zdxstream->self_peer();
    printf("%s\n", zdxpeer->xml().c_str());
  }   
}

void test_peers3() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, vector<EEDB::Peer*> >       port_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStreams::FederatedSourceStream *fstreamf5 = new EEDB::SPStreams::FederatedSourceStream;
  EEDB::SPStream                        *stream = NULL;

  EEDB::Peer::set_cache_behaviour(false);

  printf("\n====== test_peers3 == \n");
  gettimeofday(&starttime, NULL);

  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  //EEDB::User* user = get_cmdline_user();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  printf("%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters(); //must do after all init and setting of user

  EEDB::SPStream* stream1 = webservice->source_stream();

  count=0;
  printf("  -- stream main zenbu peers\n");
  stream1->stream_peers();
  while(MQDB::DBObject *obj = stream1->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    peer->retain();
    if((peer->db_url().find("fantom46") !=string::npos) || (peer->db_url().find("f5-gbdb") !=string::npos)) {
      printf("%s\n", peer->xml().c_str());
      string db1 = peer->peer_database()->host() +":"+ l_to_string(peer->peer_database()->port());
      port_peers[db1].push_back(peer);
    }
    uuid_peers[peer->uuid()] = peer;
    count++;
  }
  printf("%d main peers %d\n", count, uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  map<string, vector<EEDB::Peer*> >::iterator it3;
  for(it3=port_peers.begin(); it3!=port_peers.end(); it3++) {
    printf("  %s - %ld\n", (*it3).first.c_str(), (*it3).second.size());
    vector<EEDB::Peer*>::iterator it4;
    for(it4=(*it3).second.begin(); it4!=(*it3).second.end(); it4++) {
      printf("    %s\n", (*it4)->peer_database()->dbname().c_str());
    }
    printf("\n");
  }
}


void merge_f5zenbu_users() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, EEDB::User*>              main_users;
  map<string, EEDB::User*>              f5_users;
  map<string, EEDB::User*>::iterator    it;

  EEDB::Peer::set_cache_behaviour(false);

  printf("\n====== merge_f5zenbu_users == \n");
  gettimeofday(&starttime, NULL);


  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();

  //webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  //EEDB::User* user = get_cmdline_user();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);
  webservice->postprocess_parameters(); //must do after all init and setting of user
  if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  MQDB::Database *f5userdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@f5-gbdb.gsc.riken.jp:3306/eedb_fantom5_zenbu_users");
  if(f5userdb) { printf("%s\n", f5userdb->xml().c_str()); }

  count=0;
  printf("  -- fetch main zenbu users\n");
  vector<DBObject*> user_array = EEDB::User::fetch_all(userdb);
  vector<DBObject*>::iterator u1;
  for(u1=user_array.begin(); u1!=user_array.end(); u1++) {
    EEDB::User *user = (EEDB::User*)(*u1);;
    count++;
    if(user->email_identity().empty()) { continue; }
    //cout << peer->xml();
    user->retain();
    main_users[user->email_identity()] = user;
  }
  printf("%d main users with email %d\n", count, main_users.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);


  printf("  -- fetch fantom5 zenbu users\n");
  count=0;
  user_array = EEDB::User::fetch_all(f5userdb);
  for(u1=user_array.begin(); u1!=user_array.end(); u1++) {
    count++;
    EEDB::User *user = (EEDB::User*)(*u1);;
    if(user->email_identity().empty()) { continue; }
    //cout << peer->xml();
    user->retain();
    f5_users[user->email_identity()] = user;
  }
  printf("%d fantom5 users with email %d\n", count, f5_users.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //
  // now compare lists for missing peers
  //
  map<string,long>  peer_types;
  map<string,long>  peer_dirs;
  map<string,long>::iterator it2;

  count=0;
  for(it=f5_users.begin(); it!=f5_users.end(); it++) {
    EEDB::User *user1 = (*it).second;
    if(!user1) { continue; }
  //  if(user1->email_identity() !="chungchau.hon@riken.jp") { continue; }
    fprintf(stderr, "\nf5 user :: [%s]%s\n", user1->uuid().c_str(), user1->email_identity().c_str());

    if(!user1->user_registry()) { fprintf(stderr, "  problem with registry\n"); continue; }
    MQDB::Database* f5_ureg = user1->user_registry()->peer_database();
    fprintf(stderr, "  %s\n", f5_ureg->full_url().c_str());

    //check if we have a matching user
    if(main_users.find((*it).first) == main_users.end()) {
      printf("  MISSING from main zenbu\n");
      continue;
    }
    EEDB::User *user2 = main_users[(*it).first];
    fprintf(stderr, "  found matching user [%s]%s\n", user2->uuid().c_str(), user2->email_identity().c_str());
    
    //first get the uploaded peers already in user's main account
    map<string, EEDB::Peer*> user_uploads;
    MQDB::Database *registry_db = user2->user_registry()->peer_database();
    vector<DBObject*> peer_array2 = EEDB::Peer::fetch_all(registry_db);
    vector<DBObject*>::iterator p2;
    for(p2=peer_array2.begin(); p2!=peer_array2.end(); p2++) {
      EEDB::Peer* peer2 = (EEDB::Peer*)(*p2);
      if(!peer2) { continue; }
      if(!peer2->is_valid()) { continue; }
      peer2->retain();
      user_uploads[peer2->uuid()] = peer2;
    }
    fprintf(stderr, "  %ld main uploaded peers\n", user_uploads.size());


    //then check the f5 user peers and link into main user's registry
    map<string, EEDB::Peer*> f5_user_uploads;
    vector<DBObject*> peer_array1 = EEDB::Peer::fetch_all(f5_ureg);
    fprintf(stderr, "  %ld uploaded peers in F5 registry\n", peer_array1.size());
    vector<DBObject*>::iterator p1;
    for(p1=peer_array1.begin(); p1!=peer_array1.end(); p1++) {
      EEDB::Peer* peer3 = (EEDB::Peer*)(*p1);
      if(!peer3) { continue; }
      if(peer3->db_url() == user1->user_registry()->db_url()) { continue; }

      if(!peer3->is_valid()) { 
        fprintf(stderr, "  failed test :: %s\n", peer3->xml().c_str());
        continue; 
      }

      if(user_uploads.find(peer3->uuid()) != user_uploads.end()) {
        fprintf(stderr, "   already linked [%s]\n", peer3->uuid());
        continue;
      }

      //EEDB::Peer* lpeer = EEDB::Peer::new_from_url(peer3->db_url());
      //if(lpeer && lpeer->is_valid() && ((*it).first == string(lpeer->uuid()))) {
      //  printf("  found LOCAL version -- %s\n", lpeer->xml().c_str());
      //  if(lpeer->db_url().empty()) {
      //    printf("  WOAH! db_url is not defined, relocate to where it should be\n");
          //relocate_peer(lpeer, f5url);
          //printf("  -- %s\n", lpeer->xml().c_str());
      //  }
      //}

      peer3->retain();
      f5_user_uploads[peer3->uuid()] = peer3;
      fprintf(stderr, "   LINK %s\n", peer3->xml().c_str());

      peer3->store(registry_db);
    }
    fprintf(stderr, "  %ld uploaded peers transfered\n", f5_user_uploads.size());
    if(f5_user_uploads.empty()) { continue; }

  }
}


void migrate_f5_mdata() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, string>                   library_ids;
  map<string, EEDB::Experiment*>        ctss_experiments;
  map<string, EEDB::Experiment*>        remap_experiments;

  //EEDB::Peer::set_cache_behaviour(false);

  printf("\n====== migrate_f5_mdata == \n");
  gettimeofday(&starttime, NULL);

  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();

  //webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  //EEDB::User* user = get_cmdline_user();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters(); //must do after all init and setting of user
  if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  EEDB::SPStream* stream = webservice->source_stream();

  //count=0;
  //stream->stream_peers();
  //while(MQDB::DBObject *obj = stream->next_in_stream()) {
  //  EEDB::Peer *peer = (EEDB::Peer*)obj;
  //  count++;
  //}
  //fprintf(stderr, "%ld peers\n", count);

  printf("  -- fantom5 ctss experiments\n");
  stream->stream_data_sources("Experiment", "fantom5 ctss mm9");
  while(EEDB::Experiment *source = (EEDB::Experiment*)stream->next_in_stream()) {
    if(source->classname() != EEDB:: Experiment::class_name) { fprintf(stderr, "non-experiment\n"); continue; }
    if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source
    
    EEDB::Metadata *libMD = source->metadataset()->find_metadata("osc:LSA_library_id" ,"");
    EEDB::Metadata *sampleMD = source->metadataset()->find_metadata("osc:LSA_sample_id", "");
    if(!libMD) { fprintf(stderr, "missing osc:LSA_library_id [%s]\n", source->display_name().c_str()); continue; }
    if(!sampleMD) { fprintf(stderr, "missing osc:LSA_sample_id [%s]\n", source->display_name().c_str()); continue; }
    
    if(ctss_experiments.find(libMD->data()) != ctss_experiments.end()) {
      fprintf(stderr, "warn duplicate libraryID [%s] %s\n", libMD->data().c_str(), source->display_name().c_str());
    }

    ctss_experiments[libMD->data()] = source;
  }
  fprintf(stderr, "returned %ld ctss_experiments\n", ctss_experiments.size());

  //printf("  -- fantom5 remap hg38 experiments\n");
  printf("  -- fantom5 remap mm10 experiments\n");
  stream->stream_data_sources("Experiment", "fantom5 remap mm10");
  while(EEDB::Experiment *source = (EEDB::Experiment*)stream->next_in_stream()) {
    if(source->classname() != EEDB:: Experiment::class_name) { fprintf(stderr, "non-experiment\n"); continue; }
    if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source
    
    EEDB::Metadata *origMD = source->metadataset()->find_metadata("orig_filename" ,"");
    if(!origMD) { fprintf(stderr, "missing orig_filename [%s]\n", source->display_name().c_str()); continue; }
    
    if(remap_experiments.find(origMD->data()) != remap_experiments.end()) {
      fprintf(stderr, "warn duplicate orig_filename [%s] %s\n", origMD->data().c_str(), source->display_name().c_str());
      fprintf(stderr, "   %s\n", remap_experiments[origMD->data()]->simple_xml().c_str());
      fprintf(stderr, "   %s\n", source->simple_xml().c_str());
    }

    remap_experiments[origMD->data()] = source;
  }
  fprintf(stderr, "returned %ld remap_experiments\n", remap_experiments.size());

  count=0;
  printf("  -- read experiment IDs from file\n");
  //string infile = "/home/severin/f5-remap-hg38-load-files2";
  string infile = "/home/severin/f5-remap-mm10-load-files2";
  gzFile gz = gzopen(infile.c_str(), "r");
  if(!gz) {
    fprintf(stderr, "ERROR: unable to open file [%s]\n", infile.c_str());
    return;
  }
  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  count =0;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }
    count++;
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
    //CNhs10650.10043-101F7.hg38
    std::size_t p1 = filename.find("CNhs");
    string libID = filename.substr(p1);
    //p1 = libID.find(".hg38");
    p1 = libID.find(".mm10");
    libID.resize(p1);
    p1 = libID.find(".");
    string rnaID = libID.substr(p1+1);
    libID.resize(p1);
    //fprintf(stderr, "[%s] [%s]  %s\n", libID.c_str(), rnaID.c_str(), filename.c_str());
    library_ids[libID] = filename;
    
    if(ctss_experiments.find(libID) == ctss_experiments.end()) {
      fprintf(stderr, "WARN unable to find old ctss experiment [%s]\n", libID.c_str());
      continue;
    }
    if(remap_experiments.find(filename) == remap_experiments.end()) {
      fprintf(stderr, "WARN unable to find new remap experiment [%s]\n", filename.c_str());
      continue;
    }

    //TODO: merge the metadata from the old experiment to the new experiment
    EEDB::Experiment *ctss_exp  = ctss_experiments[libID];
    EEDB::Experiment *remap_exp = remap_experiments[filename];

    fprintf(stderr, "%5ld %s\n", count, libID.c_str());
    fprintf(stderr, "      %s\n", filename.c_str());
    fprintf(stderr, "      new name [%s]\n", ctss_exp->display_name().c_str());
    //fprintf(stderr, "=======\n%s", ctss_exp->xml().c_str());

    EEDB::MetadataSet *mdset2 = remap_exp->metadataset();
    mdset2->remove_metadata_like("display_name", "");
    mdset2->remove_metadata_like("eedb:display_name", "");
    remap_exp->display_name(ctss_exp->display_name());
    remap_exp->clear_xml_caches();
    //fprintf(stderr, "=======merge into\n%s==========\n", remap_exp->xml().c_str());

    vector<EEDB::Metadata*> data = ctss_exp->metadataset()->metadata_list();
    for(unsigned int i=0; i<data.size(); i++) {
      EEDB::Metadata *mdata = (EEDB::Metadata*)data[i];
      if(mdata->type() == "keyword") { continue; }
      bool ok = false;
      /*
      if(mdata->type() == "keyword") { continue; }
      if(mdata->type() == "assembly_name") { continue; }
      if(mdata->type() == "eedb:assembly_name") { continue; }
      if(mdata->type() == "genome_assembly") { continue; }
      if(mdata->type() == "expname") { continue; }
      if(mdata->type() == "description") { continue; }
      if(mdata->type() == "norm_rle") { continue; }
      if(mdata->type().find("_total") != std::string::npos) { continue; }
      if(mdata->type().find("tpm") != std::string::npos) { continue; }
      if(mdata->type().find("tagcount") != std::string::npos) { continue; }
      */
      if(mdata->type().find("FF:") != std::string::npos) { ok=true; }
      if(mdata->type().find("FF_ont:") != std::string::npos) { ok=true; }
      if(mdata->type().find("DOID:") != std::string::npos) { ok=true; }
      if(mdata->type().find("osc:LSA") != std::string::npos) { ok=true; }
      if(mdata->type().find("rna_") != std::string::npos) { ok=true; }
      if(mdata->type().find("sample_") != std::string::npos) { ok=true; }
      if(mdata->type().find("CL:") != std::string::npos) { ok=true; }
      if(mdata->type().find("EFO:") != std::string::npos) { ok=true; }
      if(mdata->type().find("UBERON:") != std::string::npos) { ok=true; }
      if(mdata->type().find("phase_freeze") != std::string::npos) { ok=true; }
      if(mdata->type().find("id:") != std::string::npos) { ok=true; }
      if(mdata->type().find("genas:") != std::string::npos) { ok=true; }
      if(mdata->type().find("PATO:") != std::string::npos) { ok=true; }
      if(mdata->type().find("PR:") != std::string::npos) { ok=true; }
      if(mdata->type().find("display_name") != std::string::npos) { ok=true; }

      if(mdata->type() == "CL") { ok=true; }
      if(mdata->type() == "DOID") { ok=true; }
      if(mdata->type() == "EFO") { ok=true; }
      if(mdata->type() == "FF") { ok=true; }
      if(mdata->type() == "UBERON") { ok=true; }
      if(mdata->type() == "datafreeze_phase") { ok=true; }
      if(mdata->type() == "id") { ok=true; }

      if(ok) {
        mdata->retain();
        mdset2->add_metadata(mdata);
        //printf("add  [%s]\n", mdata->type().c_str());
      } else {
        //printf("skip [%s]\n", mdata->type().c_str());
      }
    }
    mdset2->remove_duplicates();
    //mdset2->extract_keywords();
    remap_exp->clear_xml_caches();
    //fprintf(stderr, "=======final\n%s==========\n", remap_exp->xml().c_str());

    //save the new metadata
    string uuid = remap_exp->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { 
      fprintf(stderr, "NO peer for source %s\n", remap_exp->display_name().c_str());
      continue;
    }
    
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    //fprintf(stderr, "      save %s\n", peer->simple_xml().c_str());
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      fprintf(stderr, "NOT BAMDB\n");
      //EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      //if(!oscdb->save_xmldb()) { fprintf(stderr, "OSCDB save error\n"); }
    }
    else if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
      if(!bamdb->save_xmldb()) { fprintf(stderr, "BAMDB save error\n"); }
    }
    else if(sourcestream->classname() == EEDB::ZDX::ZDXstream::class_name) {
      fprintf(stderr, "NOT BAMDB\n");
      //EEDB::ZDX::ZDXstream *zdxstream = (EEDB::ZDX::ZDXstream*)sourcestream;
      //if(!zdxstream->write_source_section()) { fprintf(stderr, "ZDXDB save error\n"); }
    }
    else {
      fprintf(stderr, "NOT BAMDB\n");
    }

  }
  free(_data_buffer);
  gzclose(gz); //close input file
  fprintf(stderr, "read %ld lines, %ld library IDs\n", count, library_ids.size());
}


void test_ncbi_genome_load() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, string>                   library_ids;
  map<string, EEDB::Experiment*>        ctss_experiments;
  map<string, EEDB::Experiment*>        remap_experiments;

  printf("\n====== test_ncbi_genome_load == \n");
  gettimeofday(&starttime, NULL);

  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();

  //webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  //EEDB::User* user = get_cmdline_user();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters(); //must do after all init and setting of user
  if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  EEDB::JobQueue::UploadFile *uploader = new EEDB::JobQueue::UploadFile();
  uploader->userDB(userdb);

  EEDB::Peer*  peer = NULL;
  //EEDB::Peer*  peer = uploader->load_genome_from_NCBI(ncbi_acc);
  //peer = uploader->load_genome_from_NCBI("canFam3");
  //peer = uploader->load_genome_from_NCBI("rn6");
  //peer = uploader->load_genome_from_NCBI("felCat8");

  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("canfam3");
  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("rattus");
  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("homo");

  MQDB::Database *gdb = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@fantom46.gsc.riken.jp:3306/zenbu_genome_9544_GCF_000772875_2_Mmul_801_rheMac8");

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
        assembly_array[j]->store(gdb);
        //assembly_array[j]->taxon()->store(gdb);
        //peer = uploader->load_genome_from_NCBI(assembly_array[j]->ncbi_assembly_accession());
      }
    }
  }
  printf("%d assemblies returned\n", assembly_array.size());

  //peer = uploader->load_genome_from_NCBI("canFam3");
  //peer = uploader->load_genome_from_NCBI("rn6");
}


void migrate_f5_sRNA_data() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStream                        *stream = NULL;

  EEDB::Peer::set_cache_behaviour(true);

  printf("\n====== migrate_f5_sRNA_data == \n");
  gettimeofday(&starttime, NULL);

  //first make sure we have the collaboration registry
  string reg_url ="sqlite:///zenbu/users/ulVB_hCSJtcl__n0I0BrgfB/group_registry.sqlite";
  EEDB::Peer* f5_sRNA_collab_peer = EEDB::Peer::new_from_url(reg_url);
  if(!f5_sRNA_collab_peer or !(f5_sRNA_collab_peer->is_valid())) {
    printf("\nERROR: unable to connect to registry [%s]!!\n\n", reg_url.c_str());
    return;
  }
  //MQDB::Database *f5_sRNA_reg = new MQDB::Database(reg_url);
  MQDB::Database *f5_sRNA_reg = f5_sRNA_collab_peer->peer_database();
  if((f5_sRNA_reg==NULL) or !(f5_sRNA_reg->get_connection())) { 
    printf("\nERROR: unable to connect to registry database [%s]!!\n\n", reg_url.c_str());
    return;
  }
  printf("collab_peer:\n   %s\n", f5_sRNA_collab_peer->xml().c_str());
  printf("collab_db  :\n   %s\n", f5_sRNA_reg->xml().c_str());
  //f5_sRNA_reg->disconnect();


  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();

  //webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  //EEDB::User* user = get_cmdline_user();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters(); //must do after all init and setting of user

  EEDB::SPStream* stream1 = webservice->source_stream();

  count=0;
  printf("  -- stream main zenbu sRNA sources\n");
  stream1->stream_data_sources("Experiment", "SRhi");
  while(MQDB::DBObject *obj = stream1->next_in_stream()) {
    //fprintf(stderr, "%s\n", obj->simple_xml().c_str());

    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(obj->db_id(), uuid, objID, objClass);
    //fprintf(stderr, "%s\n", uuid.c_str());
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      peer->retain();
      uuid_peers[peer->uuid()] = peer;
      count++;
      peer->store(f5_sRNA_reg);
      fprintf(stderr, "%s\n", peer->xml().c_str());
    }
  }
  printf("%d main peers %d\n", count, uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  /*
  count=0;
  for(it=uuid_peers.begin(); it!=uuid_peers.end(); it++) {
    EEDB::Peer *peer2 = (*it).second;
    peer2->store(f5_sRNA_reg);
  } 
  */
}


void check_view_collaboration_security_sharing() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStream                        *stream = NULL;

  string user_email  = "chungchau.hon@riken.jp";
  string config_uuid = "kcVlG5I9FVhibHeT721x3";
  //string collab_uuid = "DP1qIjlVLZxlKScQfjWgkB"; //CAT
  //string collab_uuid = "UJ10dh3mHxXmPKNIYQmid"; //FANTOM5 unplublished

  EEDB::Peer::set_cache_behaviour(true);

  printf("\n====== check_view_collaboration_security_sharing == \n");
  gettimeofday(&starttime, NULL);

  EEDB::WebServices::WebBase*   webservice = new EEDB::WebServices::WebBase();

  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());

  EEDB::User *user = EEDB::User::fetch_by_email(userdb, user_email);
  if(user) {
    fprintf(stderr, "%s\n", user->xml().c_str());
    webservice->set_user_profile(user);
  }
  webservice->postprocess_parameters(); //must do after all init and setting of user

  //first we need to get the view
  EEDB::Configuration* config = EEDB::Configuration::fetch_by_uuid(userdb, config_uuid);
  if(!config) { 
    fprintf(stderr, "unable to fetch config [%s]\n", config_uuid.c_str());
    return;
  }
  fprintf(stderr, "%s\n", config->simple_xml().c_str());

  //then we need to get the collaboration to check security against
  //option1: use the collaboration that the config is saved into
  EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, config->collaboration()->group_uuid());
  //option2: specify the collaboration
  //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, collab_uuid);
  if(!collab) { 
    printf("can not find collaboration [%s]\n", config->collaboration()->group_uuid().c_str());
    return;
  }
  fprintf(stderr, "%s\n", collab->xml().c_str());

  EEDB::Peer* collab_peer = collab->group_registry();
  if(!collab_peer or !(collab_peer->is_valid())) {
    printf("\nERROR: unable to connect to collaboration registry!\n");
    return;
  }
  //MQDB::Database *f5_sRNA_reg = new MQDB::Database(reg_url);
  MQDB::Database *collab_db = collab_peer->peer_database();
  if((collab_db==NULL) or !(collab_db->get_connection())) { 
    printf("\nERROR: unable to connect to registry database!\n");
    return;
  }
  fprintf(stderr, "%s\n", collab->xml().c_str());
  printf("collab_peer:   %s\n", collab_peer->xml().c_str());
  printf("collab_db  :   %s\n", collab_db->xml().c_str());
  //f5_sRNA_reg->disconnect();

  /*  for later this is example sharing code
      fprintf(stderr, "share to collaboration [%s] : %s\n", collaboration->group_uuid().c_str(), collaboration->display_name().c_str());
      if((collaboration->member_status() == "MEMBER") or (collaboration->member_status() == "owner")) {
        string error = collaboration->share_peer_database(upload_peer);
        if(!error.empty()) {
          fprintf(stderr, "collab_share_error: %s\n", error.c_str());
        }
      }
    }      
*/

  //get sources out of view
  map<string, bool> srcid_hash;
  string configXML = config->configXML();
  //printf("%s\n", configXML.c_str());
  char* cfg_str = (char*)configXML.c_str();
  char *p1, *p2;
  long track_cnt=1;
  /*
  p1 = strstr(cfg_str, "<gLyphTrack ");
  while(p1) {
    p2 = strstr(p1, "</gLyphTrack>");
    string trackCfg = p1;
    trackCfg.resize(p2-p1+13);
    p1 = strstr(p2, "<gLyphTrack ");
    printf("%d :: %s-----------\n", track_cnt++, trackCfg.substr(0,130).c_str());
    printf("==================\n%s\n==================\n", trackCfg.c_str());
    std::size_t  p3 = trackCfg.find("source_ids=");
    while(p3!=std::string::npos) {
      std::size_t  p4 = trackCfg.find("\" ", p3);
      string srcids = trackCfg.substr(p3, p4-p3+1);
      printf("=====%s=====\n", srcids.c_str());
      p3 = trackCfg.find("source_id", p4);
    }
    sleep(5);
  }
  */
  std::size_t  p3 = configXML.find("source_id");
  while(p3!=std::string::npos) {
    std::size_t  p4 = configXML.find("\"", p3);
    std::size_t  p5 = configXML.find("\"", p4+1);
    //string srcids = configXML.substr(p3, p5-p3+1);
    string srcids = configXML.substr(p4+1, p5-p4-1);
    //printf("=====%ld==%s=====\n", track_cnt++,srcids.c_str());

    char* buffer = (char*)malloc(srcids.size()+10);
    strcpy(buffer, srcids.c_str());
    char* tok = strtok(buffer, ",");
    while(tok) {
      //printf("   =%s=\n", tok);
      srcid_hash[tok]++;

      string   uuid, objClass;
      long int objID;
      MQDB::unparse_dbid(tok, uuid, objID, objClass);
      //fprintf(stderr, "%s\n", uuid.c_str());
      uuid_peers[uuid] = NULL;

      tok = strtok(NULL, ",");
    }
    free(buffer);

    p3 = configXML.find("source_id", p5);
    //sleep(1);
  }
  printf("%d unique sources in view\n", srcid_hash.size());
  printf("%d peers in view\n", uuid_peers.size());


  //compare against sources available on public streams plus just this collaboration
  webservice->set_parameter("collab", "public");
  //webservice->set_parameter("collab", "all");
  webservice->postprocess_parameters(); //must do after all init and setting of user

  EEDB::SPStreams::FederatedSourceStream *collab_stream = webservice->source_stream();
  collab_stream->clone_peers_on_build(false);
  collab_stream->allow_full_federation_search(true);
  collab_stream->set_peer_search_depth(128);

  collab_stream->add_seed_peer(collab_peer); //now add in this collab to the previous public

  //reset the peers
  for(it=uuid_peers.begin(); it!=uuid_peers.end(); it++) {
    (*it).second = NULL;
  } 

  collab_stream->stream_peers();
  while(MQDB::DBObject *obj = collab_stream->next_in_stream()) {
    if(obj->classname() != EEDB::Peer::class_name) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    if(uuid_peers.find(peer->uuid()) != uuid_peers.end()) {
      peer->retain();
      uuid_peers[peer->uuid()] = peer;
    }
  }
  count=0;
  for(it=uuid_peers.begin(); it!=uuid_peers.end(); it++) {
    EEDB::Peer *peer2 = (*it).second;
    if(peer2==NULL) { count++; }
  } 
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld unshared peers after checking collaboration in %1.6f msec\n\n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  if(count==0) {
    printf("everything OK, nothing to do\n");
    return;
  }

  //TODO: report the missing/deleted and then share. GUI will ask user to decide if to share or not save view
  //compare against _superuser_federated_source_stream() like from TrackBuilder to check if sources were deleted
  printf("check against superuser stream for unshared source and for any deleted sources\n");
  count=0;
  long share_count=0;
  map<string, EEDB::Peer*>  need_to_share;
  EEDB::SPStreams::FederatedSourceStream *superuser_stream = webservice->superuser_federated_source_stream();
  superuser_stream->clone_peers_on_build(false);
  superuser_stream->allow_full_federation_search(true);
  superuser_stream->set_peer_search_depth(128);
  superuser_stream->stream_peers();
  while(MQDB::DBObject *obj = superuser_stream->next_in_stream()) {
    if(obj->classname() != EEDB::Peer::class_name) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    count++;
    if(uuid_peers.find(peer->uuid()) != uuid_peers.end()) {
      if(uuid_peers[peer->uuid()] == NULL) {
        peer->retain();
        uuid_peers[peer->uuid()] = peer;
        need_to_share[peer->uuid()] = peer;
        //TODO: check that this user can share it (is owner)
        //TODO: share this missing one into collab

        //string error = collab->share_peer_database(peer);
        //if(!error.empty()) {
        //  fprintf(stderr, "collab_share_error: %s\n", error.c_str());
        //}

        //quick and dirty way
        //peer->store(collab_db);
        share_count++;
      }
    }
  }
  printf("%d %ld peers shared with collab, %ld total peers in system\n", share_count, need_to_share.size(), count);

  //check for peers not found on superuser stream, still NULL, these are deleted
  count=0;
  for(it=uuid_peers.begin(); it!=uuid_peers.end(); it++) {
    EEDB::Peer *peer2 = (*it).second;
    if(peer2==NULL) { count++; }
  } 
  printf("check for deletion: %ld deleted sources\n", count);
  if(count>0) {
    printf("PROBLEM!! there are deleted datasources in your view\n");
    return;
  }

  printf("sharing %ld peers now\n", need_to_share.size());
  for(it=need_to_share.begin(); it!=need_to_share.end(); it++) {
    EEDB::Peer *peer2 = (*it).second;
    if(peer2==NULL) { printf("PROBLEM should not be NULL\n"); }
    //TODO: check that this user can share it (is owner)
    //TODO: share this missing one into collab

    //string error = collab->share_peer_database(peer);
    //if(!error.empty()) {
    //  fprintf(stderr, "collab_share_error: %s\n", error.c_str());
    //}

    //quick and dirty way
    printf("%s\n", peer2->xml().c_str());
    //peer2->store(collab_db);
  } 

  /*
  count=0;
  printf("  -- stream main zenbu sRNA sources\n");
  stream1->stream_data_sources("Experiment", "SRhi");
  while(MQDB::DBObject *obj = stream1->next_in_stream()) {
    //fprintf(stderr, "%s\n", obj->simple_xml().c_str());

    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(obj->db_id(), uuid, objID, objClass);
    //fprintf(stderr, "%s\n", uuid.c_str());
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      peer->retain();
      uuid_peers[peer->uuid()] = peer;
      count++;
      peer->store(f5_sRNA_reg);
      fprintf(stderr, "%s\n", peer->xml().c_str());
    }
  }
  printf("%d main peers %d\n", count, uuid_peers.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  */
}


void check_duplicate_uploads() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;
  EEDB::SPStream                        *stream = NULL;

  string user_email  = "jessica.severin@gmail.com";
  //string user_email  = "kouno@gsc.riken.jp";
//  string user_email  = "plessy@riken.jp";
  //string user_email  = "stephane.poulain@riken.jp";
  //string user_email  = "nicolas.bertin@gmail.com";
  //string user_email  = "chungchau.hon@riken.jp";

  EEDB::Peer::set_cache_behaviour(true);

  printf("\n====== check_duplicate_uploads == \n");
  gettimeofday(&starttime, NULL);

  EEDB::WebServices::WebBase*   webservice = new EEDB::WebServices::WebBase();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());

  EEDB::User *user = EEDB::User::fetch_by_email(userdb, user_email);
  if(user) {
    printf("%s\n", user->xml().c_str());
    webservice->set_user_profile(user);
  }
  //webservice->set_parameter("collab", "public");
  webservice->set_parameter("collab", "private");
  webservice->postprocess_parameters(); //must do after all init and setting of user

  map<long, vector<EEDB::Peer*> >  filesize_peer_hash;
  map<long, vector<EEDB::Peer*> >::iterator it2;
  map<string, vector<EEDB::Peer*> >  md5_peer_hash;
  map<string, vector<EEDB::Peer*> >::iterator it3;

  count=0;
  long stream_count=0;

  //EEDB::SPStreams::FederatedSourceStream *superuser_stream = webservice->superuser_federated_source_stream();
  EEDB::SPStreams::FederatedSourceStream *superuser_stream = webservice->source_stream();

  //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, "UJ10dh3mHxXmPKNIYQmid"); //FANTOM5 unpublished
  //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, "3h0ShblUA52inMCGOqf4DB"); //nano-fluidigm
  /*
  EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, "Dkt_SJTeGRUj5Vfk__GxDI"); //fantom6
  if(collab) {
    printf("%s\n", collab->xml().c_str());
    EEDB::Peer* collab_peer = collab->group_registry();
    printf("collab_peer:   %s\n", collab_peer->xml().c_str());
    superuser_stream->add_seed_peer(collab_peer); //now add in this collab to the previous public
  }
  */

  superuser_stream->clone_peers_on_build(false);
  superuser_stream->allow_full_federation_search(true);
  superuser_stream->set_peer_search_depth(128);

  superuser_stream->stream_peers();
  while(MQDB::DBObject *obj = superuser_stream->next_in_stream()) {
    stream_count++;
    if(obj->classname() != EEDB::Peer::class_name) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;

    long file_size = peer->source_file_size();
    //printf("%ld : %s\n", file_size, peer->xml().c_str());
    if(file_size <=0) { continue; }

    filesize_peer_hash[file_size].push_back(peer);
    count++;
  }

  printf("%d objects on stream\n", stream_count);
  printf("%d peers with file_size\n", count);
  printf("%d different file sizes\n", filesize_peer_hash.size());

  //reprocess these putative duplicates with md5sum. md5sum is slow the first time it is exectured so best to do in two phases
  printf("==processing for md5sum duplication\n");
  count=0;
  for(it2=filesize_peer_hash.begin(); it2!=filesize_peer_hash.end(); it2++) {
    if((*it2).second.size() <= 1) { continue; }
    count += (*it2).second.size();
  } 
  printf("%d total peers to reanalyzed for md5sum duplication\n\n", count);

  count=0;
  for(it2=filesize_peer_hash.begin(); it2!=filesize_peer_hash.end(); it2++) {
    if((*it2).second.size() <= 1) { continue; }
    for(unsigned j=0; j< (*it2).second.size(); j++) {
      EEDB::Peer *peer = (*it2).second[j];
      printf("  %s\n", peer->xml().c_str());
      string md5 = peer->source_md5sum();
      if(md5.empty()) { printf("problem with md5sum\n"); }
      md5_peer_hash[md5].push_back(peer);
      printf("  md5sum [%s]\n", md5.c_str());
      count++;
    }
  } 
  printf("%d total peers reanalyzed for md5sum duplication\n\n", count);

  count=0;
  long total_savings = 0;
  double avg_size=0;
  for(it3=md5_peer_hash.begin(); it3!=md5_peer_hash.end(); it3++) {
    if((*it3).second.size() <= 1) { continue; }
    count++;
    long file_size = 0;
    printf("%d : md5 %s : %d peers\n", count, (*it3).first.c_str(), (*it3).second.size());
    for(unsigned j=0; j< (*it3).second.size(); j++) {
      EEDB::Peer *peer = (*it3).second[j];
      file_size = peer->source_file_size();
      printf("  %s\n", peer->xml().c_str());
    }
    avg_size += file_size;
    printf("  filesize %1.3fMB\n", file_size/1024.0/1024);
    total_savings += file_size * ((*it3).second.size()-1);
  } 
  avg_size = avg_size / filesize_peer_hash.size();
  printf("%d objects on stream\n", stream_count);
  printf("%d different file sizes\n", filesize_peer_hash.size());
  printf("%d true md5 duplicates\n", count);
  printf("%1.3f MB average size\n", avg_size/1024.0/1024);
  printf("total savings if all duplicates deleted : %1.3f GB\n", total_savings/1024.0/1024.0/1024);
}


void fantom6_bam_links() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count;
  map<string, EEDB::Peer*>              uuid_peers;
  map<string, EEDB::Peer*>::iterator    it;

  string user_email  = "jessica.severin@gmail.com";
  //string user_email  = "kouno@gsc.riken.jp";
//  string user_email  = "plessy@riken.jp";
  //string user_email  = "stephane.poulain@riken.jp";
  //string user_email  = "nicolas.bertin@gmail.com";
  //string user_email  = "chungchau.hon@riken.jp";

  EEDB::Peer::set_cache_behaviour(true);

  printf("\n====== check_duplicate_uploads == \n");
  gettimeofday(&starttime, NULL);

  EEDB::WebServices::WebBase*   webservice = new EEDB::WebServices::WebBase();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());

  EEDB::User *user = EEDB::User::fetch_by_email(userdb, user_email);
  if(user) {
    printf("%s\n", user->xml().c_str());
    webservice->set_user_profile(user);
  }
  //webservice->set_parameter("collab", "public");
  webservice->set_parameter("collab", "Dkt_SJTeGRUj5Vfk__GxDI");
//  webservice->set_parameter("peers", "A6C1BE7E-34A4-4FEF-AF65-4C17E694E734");
  webservice->postprocess_parameters(); //must do after all init and setting of user

  map<long, vector<EEDB::Peer*> >  filesize_peer_hash;
  map<long, vector<EEDB::Peer*> >::iterator it2;
  map<string, vector<EEDB::Peer*> >  md5_peer_hash;
  map<string, vector<EEDB::Peer*> >::iterator it3;

  count=0;
  long stream_count=0;

  //EEDB::SPStreams::FederatedSourceStream *stream = webservice->superuser_federated_source_stream();
  EEDB::SPStreams::FederatedSourceStream *stream = webservice->source_stream();

  //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, "UJ10dh3mHxXmPKNIYQmid"); //FANTOM5 unpublished
  //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, "3h0ShblUA52inMCGOqf4DB"); //nano-fluidigm

  //EEDB::Collaboration *collab = EEDB::Collaboration::fetch_by_uuid(userdb, "Dkt_SJTeGRUj5Vfk__GxDI"); //fantom6
  //if(collab) {
  //  printf("%s\n", collab->xml().c_str());
  //  EEDB::Peer* collab_peer = collab->group_registry();
  //  printf("collab_peer:   %s\n", collab_peer->xml().c_str());
  //  stream->add_seed_peer(collab_peer); //now add in this collab to the previous public
  //}

  stream->clone_peers_on_build(false);
  stream->allow_full_federation_search(true);
  stream->set_peer_search_depth(128);

  stream->stream_peers();
  count=0;
  printf("file_name\tzenbu_uuid\tfilesize\tzenbu_md5sum\tlsa_monogdb_md5sum\n");
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    if(obj->classname() != EEDB::Peer::class_name) { continue; }
    EEDB::Peer *peer = (EEDB::Peer*)obj;

    EEDB::SPStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() != EEDB::SPStreams::BAMDB::class_name) { continue; }

    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
    stream_count++;

    long file_size = peer->source_file_size();
    if(file_size <=0) { continue; }
    string md5 = peer->source_md5sum();

    string bam_path;
    string bam_filename;
    bamdb->path_to_bam_file(bam_path, bam_filename); //returns the paths and filename in the parameters
    count++;

    EEDB::Experiment *experiment = bamdb->experiment();
    if(!experiment->metadataset()->has_metadata_like("orig_filename","")) {
      experiment->metadataset()->add_metadata("orig_filename", bam_filename);
    }

    string lsa_md5;
    EEDB::Metadata  *lsa_md5_md = experiment->metadataset()->find_metadata("lsa_file_info.bam_file_md5sum", "");
    if(lsa_md5_md) { lsa_md5 = lsa_md5_md->data(); }

    printf("%d\t%s\t%s\t%ld\t%s\t%s", count,bam_filename.c_str(), peer->uuid(), file_size, md5.c_str(), lsa_md5.c_str());
    if(md5 == lsa_md5) { printf("\tmd5_match"); } else { printf("\tmd5_mismatch"); }
    printf("\n");
  }
}

void test_region_server3() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::RegionServer      *webservice = new EEDB::WebServices::RegionServer();

  gettimeofday(&starttime, NULL);

  printf("\n== test_region_server3\n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  //webservice->parse_config_file("/eeDB_intweb1/dbs/fantom5_release009/eedb_server_config.xml");
  //webservice->parse_config_file("/eeDB/dbs/fantom5_release009/eedb_server_config.xml");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

//string post_data ="<zenbu_query><trackcache>9e229d1bf9e3281d908346abd07b8487c12f7960cea7967b918d3fdcdc7bfe</trackcache><track_title>FANTOM5 CAGE phase 1and2 human tracks pooled (q20 filtered TPM, hg38)</track_title> <view_uuid>m31gAA3yJtRuEfYuLigxEC</view_uuid> <exptype>q20_tpm</exptype> <asm>hg38</asm> <loc>chr10:102431883..102439529</loc> <mode>region</mode> <source_outmode>full_feature</source_outmode> <display_width>970</display_width> <expression_visualize/> <format>fullxml</format> </zenbu_query>";
  
  //string post_data="<zenbu_query><source_ids>022103AD-BAB6-4161-8F39-0709BD891706::5:::Experiment,022103AD-BAB6-4161-8F39-0709BD891706::1:::FeatureSource</source_ids><exptype>tagcount</exptype><asm>oDI_i69-2</asm><loc>scaffold_1:1..73656</loc><mode>region</mode><source_outmode>full_feature</source_outmode><format>fullxml</format></zenbu_query>";

  string post_data="<zenbu_query> <nocache/> <track_title>new track glyphTrack114</track_title> <view_uuid>7TKh83KoANDuXTYvJwZrtC</view_uuid> <source_ids>2BAD492C-F893-43F5-A34C-3C523AE055F0::2:::Experiment</source_ids> <exptype>tagcount</exptype> <asm>hg38</asm> <loc>chr6:74635185..74636822</loc> <mode>region</mode> <source_outmode>full_feature</source_outmode> <display_width>970</display_width> <format>fullxml</format> </zenbu_query>";

  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  //EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@riken.jp");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

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

  webservice->disconnect();
  //sleep(100);
}


bool zdx_patch_assembly() {
  struct timeval      starttime,endtime,difftime;
  long                count=0;
  char                strbuffer[8192];
  string              _error_msg;
  MQDB::DBObject*                 obj;

  fprintf(stderr, "\n== zdx_patch_assembly\n");

  //open the ZDX file
  gettimeofday(&starttime, NULL); //reset timer
  const char *path = "/zenbu/users/zenbu_genome-9031-NCBI-GCF_000002315.4-Gallus_gallus-5.0/assembly.zdx";
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open(path);
  EEDB::Peer* peer1 = zdxstream->self_peer();
  fprintf(stderr, "%s\n", peer1->xml().c_str());
  
  ZDXdb* zdxdb = zdxstream->zdxdb();
  long numchroms =  EEDB::ZDX::ZDXsegment::num_chroms(zdxdb);
  fprintf(stderr, "zdx loaded %ld chroms\n", numchroms);
  if(zdxstream->genome_sequence_loaded()) { fprintf(stderr, "genome_sequence_loaded\n"); }
  zdxstream->reload_stream_data_sources();

  zdxstream->stream_data_sources("Assembly", "");
  while((obj = zdxstream->next_in_stream())) {
    if(obj->classname() != EEDB::Assembly::class_name) { continue; }
    EEDB::Assembly *assembly = (EEDB::Assembly*)obj;
    if(assembly->assembly_name() != "Gallus_gallus-5.0") { continue; }
    assembly->assembly_name("galGal5");
    assembly->ucsc_name("galGal5");
    assembly->metadataset()->remove_metadata_like("ucsc_name","");
    assembly->metadataset()->add_metadata("ucsc_name","galGal5");
    fprintf(stderr, "%s\n", assembly->xml().c_str());
  }

  zdxstream->write_source_section();

  zdxstream->release();
  return true;
}


void test_site_finder() {
  struct timeval                        starttime,endtime,difftime;
  double                                last_update = 0.0;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();
  
  printf("\n== test_site_finder \n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  //EEDB::User* user = get_cmdline_user();
  //webservice->set_user_profile(user);
  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->set_parameter("nocache", "true");
  webservice->set_parameter("trackcache", "4648f555a7359c7878257fb71c241d4de0dbdba456422656a77cc9555489745");
  webservice->set_parameter("mode", "sources");
  webservice->postprocess_parameters();
  
  EEDB::Assembly *asmb1 = webservice->find_assembly("hg38");
  printf("%s\n", asmb1->xml().c_str());

  EEDB::Assembly *asmb2 = EEDB::Assembly::cache_get_assembly("hg38");
  if(!asmb2) { fprintf(stderr, "unable to get assembly from cache\n"); }
  else { printf("%s\n", asmb2->xml().c_str()); }


  stream = webservice->region_stream();

  EEDB::SPStreams::SiteFinder *sitef = new EEDB::SPStreams::SiteFinder();
  //sitef->iupac_sequence("GAATTC");
  sitef->iupac_sequence("NNNNNNNNNNNNNNNNNNNNNGG");
  //sitef->ignore_strand(false);
  //sitef->expression_mode(EEDB::CL_SUM);
  //sitef->overlap_check_subfeatures(true);
  //sitef->merge_subfeatures(false);
  sitef->source_stream(stream);
  stream = sitef;

  stream->stream_clear();
  printf("%s\n", stream->xml().c_str());

  //EEDB::TrackCache* track_cache = webservice->track_cache(); //generates or fetches based on region config
  //printf("%s\n", track_cache->track_configxml().c_str());
  
  long count=0;
  gettimeofday(&starttime, NULL);
  
  /*
  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->simple_xml().c_str());
    count++;
    
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { 
      t_peers[uuid] = peer; 
    }
  }
  printf("%ld sources\n", count);
  
  count=0;
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.3f obj/sec\n\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  */


  //phase2 open-end read test
  printf("== read features\n");

  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_clear();
  //stream->stream_by_named_region("hg38","chr22", 30968161, 30971268);
  //stream->stream_by_named_region("hg38","chr22", 30968161, -1);
  stream->stream_by_named_region("hg38","chr22", -1, -1);
  printf("region hg38::chr22:30968161-30971268\n");
  
  while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) { 
    if(!feature) { continue; }
    
    //printf("%s\n", feature->xml().c_str());
    count++;    
    
    //if(count%5000 == 0) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    double runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
    //if(count%5000 == 0) {
    if(runtime > last_update + 2.0) {
      //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec [%ld obj]\n", count / runtime, count);
      last_update = runtime;
    }
    feature->release();
  }
  
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_fetch_features() {
  struct timeval                        starttime,endtime,difftime;
  double                                last_update = 0.0;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  
  printf("\n== test_fetch_features \n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  //webservice->set_parameter("peers", "CCFED83C-F889-43DC-BA41-7843FCB90095");
  webservice->set_parameter("source_ids", "A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::1:::FeatureSource, CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::14:::EdgeSource");

  webservice->postprocess_parameters();
  
  EEDB::Assembly *asmb1 = webservice->find_assembly("hg38");
  printf("%s\n", asmb1->xml().c_str());

  EEDB::Assembly *asmb2 = EEDB::Assembly::cache_get_assembly("hg38");
  if(!asmb2) { fprintf(stderr, "unable to get assembly from cache\n"); }
  else { printf("%s\n", asmb2->xml().c_str()); }

  stream = webservice->source_stream();

  stream->stream_clear();
  printf("%s\n", stream->xml().c_str());

  
  printf("== read features\n");
  long count=0;
  gettimeofday(&starttime, NULL);

  map<string, EEDB::Feature*> fid_hash;
  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::238424"] = NULL;
  //fid_hash["238424,7AA26B8D-8634-45A4-8F74-DF3E04B3456A::15516"] = NULL;  //entrez gene
  //fid_hash["7AA26B8D-8634-45A4-8F74-DF3E04B3456A::9123"] = NULL; //Dancr entrez
  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124121"] = NULL;
  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124811"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124812"] = NULL;
  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124813"] = NULL;
  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124814"] = NULL;
  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124815"] = NULL;

  //CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::10:::EdgeSource;
  //feature_ids=CCFED83C-F889-43DC-BA41-7843FCB90095::238424,7AA26B8D-8634-45A4-8F74-DF3E04B3456A::15516


  if(!stream->fetch_features(fid_hash)) {
    printf("failed to fetch\n");
  }
  count = fid_hash.size();

  map<string, EEDB::Feature*>::iterator it1;

  for(it1=fid_hash.begin(); it1!=fid_hash.end(); it1++) {
    EEDB::Feature *feature = (*it1).second;
    if(feature) {
      fprintf(stderr, "%s :: %s %s\n", (*it1).first.c_str(), feature->primary_name().c_str(), feature->chrom_location().c_str());
    } else {
      fprintf(stderr, "%s :: not fetched\n", (*it1).first.c_str());
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch initial features %1.6f sec\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  gettimeofday(&starttime, NULL);
  long edge_count = 0;
  stream->stream_edges(fid_hash, "");
  while(EEDB::Edge *edge = (EEDB::Edge*)stream->next_in_stream()) { 
    if(!edge) { continue; }
    
    //printf("%s", edge->simple_xml().c_str());
    edge_count++;    

    //if edges include new features, add to the fid_hash
    if(fid_hash.find(edge->feature1_dbid()) == fid_hash.end()) {
      //fprintf(stderr, "add edge feature %s\n", edge->feature1_dbid().c_str());
      fid_hash[edge->feature1_dbid()] = NULL;
    }
    if(fid_hash.find(edge->feature2_dbid()) == fid_hash.end()) {
      //fprintf(stderr, "add edge feature %s\n", edge->feature2_dbid().c_str());
      fid_hash[edge->feature2_dbid()] = NULL;
    }
    edge->release();
  }
  printf("streamed %ld edges for query of %ld features\n", edge_count, count);
  printf("need to fetch %ld features for nodes\n", fid_hash.size());
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch edges in %1.6f sec\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  gettimeofday(&starttime, NULL);
  //get remaining features which were found by the edges
  if(!stream->fetch_features(fid_hash)) {
    printf("<note>failed to post-fetch features</note>\n");
  }
  printf("after fetch fid_hash\n");
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch connected features in %1.6f sec\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  for(it1=fid_hash.begin(); it1!=fid_hash.end(); it1++) {
    EEDB::Feature *feature = (*it1).second;
    if(feature) {
      feature->metadataset();
      //printf("%s  \t  %s\n", feature->primary_name().c_str(), feature->db_id().c_str());
    } else {
      printf("<note>%s :: not fetched</note>\n", (*it1).first.c_str());
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch connected features in %1.6f sec\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));


  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  /*
  //round two
  count=0;
  //gettimeofday(&starttime, NULL);
  fprintf(stderr, "round2\n");
  stream->stream_edges(fid_hash, "");
  fprintf(stderr, " after stream_edges\n");
  while(EEDB::Edge *edge = (EEDB::Edge*)stream->next_in_stream()) { 
    if(!edge) { continue; }
    
    //printf("%s", edge->simple_xml().c_str());
    count++;    

    //if edges include new features, add to the fid_hash
    if(fid_hash.find(edge->feature1_dbid()) == fid_hash.end()) {
   //   fprintf(stderr, "add edge feature %s\n", edge->feature1_dbid().c_str());
      fid_hash[edge->feature1_dbid()] = NULL;
    }
    if(fid_hash.find(edge->feature2_dbid()) == fid_hash.end()) {
  //    fprintf(stderr, "add edge feature %s\n", edge->feature2_dbid().c_str());
      fid_hash[edge->feature2_dbid()] = NULL;
    }
    edge->release();
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  */

  /*
  //round three
  count=0;
  //gettimeofday(&starttime, NULL);
  stream->stream_edges(fid_hash, "");
  while(EEDB::Edge *edge = (EEDB::Edge*)stream->next_in_stream()) { 
    if(!edge) { continue; }
    
    //printf("%s", edge->simple_xml().c_str());
    count++;    

    //if edges include new features, add to the fid_hash
    if(fid_hash.find(edge->feature1_dbid()) == fid_hash.end()) {
 //     fprintf(stderr, "add edge feature %s\n", edge->feature1_dbid().c_str());
      fid_hash[edge->feature1_dbid()] = NULL;
    }
    if(fid_hash.find(edge->feature2_dbid()) == fid_hash.end()) {
//      fprintf(stderr, "add edge feature %s\n", edge->feature2_dbid().c_str());
      fid_hash[edge->feature2_dbid()] = NULL;
    }
    edge->release();
  }
  */
    
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_load_GO_obo() {
  struct timeval                        starttime,endtime,difftime;
  int                                   count, idx;
  int                                   loop=1;
  string                                filter;
  vector<MQDB::DBObject*>               peers;
  map<string, string>                   library_ids;
  map<string, EEDB::Experiment*>        ctss_experiments;
  map<string, EEDB::Experiment*>        remap_experiments;

  printf("\n====== test_load_GO_obo == \n");
  gettimeofday(&starttime, NULL);

  //EEDB::WebServices::UserSystem*   webservice = new EEDB::WebServices::UserSystem();
  //EEDB::WebServices::RegionServer* regionserver = new EEDB::WebServices::RegionServer();
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters(); //must do after all init and setting of user
  if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  EEDB::Peer*  peer = NULL;
  //EEDB::Peer*  peer = uploader->load_genome_from_NCBI(ncbi_acc);
  //peer = uploader->load_genome_from_NCBI("canFam3");
  //peer = uploader->load_genome_from_NCBI("rn6");
  //peer = uploader->load_genome_from_NCBI("felCat8");

  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("canfam3");
  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("rattus");
  //vector<EEDB::Assembly*> assembly_array = EEDB::Assembly::fetch_from_NCBI_by_search("homo");

  //./zenbu_sql_load_oscfile -file ~/data/fantom6/F6_CAT/F6_CAT.gene.linkage2.osc  -assembly hg38 -edgesource CCFED83C-F889-43DC-BA41-7843FCB90095::10:::EdgeSource -edges -url "mysql://zenbu_admin:zenbu_admin@zenbu:3308/zenbu_fantom6"

  //MQDB::Database *f6db = new MQDB::Database("mysql://zenbu_admin:zenbu_admin@zenbu.gsc.riken.jp:3308/zenbu_fantom6");
  EEDB::Peer* f6_peer = EEDB::Peer::new_from_url("mysql://zenbu_admin:zenbu_admin@zenbu.gsc.riken.jp:3308/zenbu_fantom6");
  printf("%s\n", f6_peer->xml().c_str());
  MQDB::Database *f6db = f6_peer->peer_database();
  f6db->disconnect();
  f6db->user("zenbu_admin");
  f6db->password("zenbu_admin");
  printf("%s\n", f6db->xml().c_str());

  string infile = "/home/severin/data/fantom6/go.obo";

  //make the GO feature source
  EEDB::FeatureSource *fsource = new EEDB::FeatureSource();
  fsource->name("Gene Ontology Terms : releases/2017-06-16");  
  fsource->category("GO:Term");
  fsource->create_date(time(NULL));
  fsource->owner_identity("jessica.severin@gmail.com");
  fsource->import_source("http://www.geneontology.org/");
  fsource->is_active(true);
  fsource->is_visible(true);
  fsource->metadataset()->add_metadata("description", "Gene Ontology Terms 2017-06-16. The GO defines concepts/classes used to describe gene function, and relationships between these concepts. It classifies functions along three aspects: molecular function,  cellular component, biological process.");
  printf("%s\n", fsource->xml().c_str());
  fsource->store(f6db);

  EEDB::EdgeSource *esource = new EEDB::EdgeSource();
  esource->name("Gene Ontology edges : releases/2017-06-16");  
  esource->category("");
  esource->create_date(time(NULL));
  esource->owner_identity("jessica.severin@gmail.com");
  esource->is_active(true);
  esource->is_visible(true);
  esource->metadataset()->add_metadata("description", "Gene Ontology graph edges 2017-06-16. The GO defines concepts/classes used to describe gene function, and relationships between these concepts. It classifies functions along three aspects: molecular function,  cellular component, biological process.");
  esource->metadataset()->add_metadata("import_source", "http://www.geneontology.org/");
  esource->feature_source1(fsource);
  esource->feature_source2(fsource);
  printf("%s\n", esource->xml().c_str());
  esource->store(f6db);

  long long buflen = 10*1024*1024; //10MB
  char*  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);

  //first count lines of input file to adjust segment size
  gzFile gz = gzopen(infile.c_str(), "rb");
  if(!gz) {
    fprintf(stderr, "failed to gzopen input file\n");
    return;
  }
  count=0;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }
    count++;
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  fprintf(stderr, "input file %ld lines in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  gzrewind(gz);

  map<string, EEDB::Feature*>  go_terms;
  EEDB::Feature *feature = NULL;
  count =0;
  long line_count=0;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    line_count++;

    if(_data_buffer[0] == '#') { continue; }
    if(strlen(_data_buffer) == 0) { continue; }

    char *t1 = _data_buffer + strlen(_data_buffer);;
    while((*t1 == '\n') || (*t1 == '\r') || (*t1 == '\0')) {
      *t1 = '\0';
      t1--;
    }
    if(strlen(_data_buffer) == 0) { continue; }
    //printf("line %ld :: %s\n", line_count, _data_buffer);


    if(_data_buffer[0] == '[') { 
      count++;
      if(feature) {
        if(feature->metadataset()->has_metadata_like("GO:is_obsolete", "true")) {
          //printf("!!!!!OBSOLETE!!!!!!!!!!!!!!!!!\n");
        } else {
          //store into hash
          //printf("%ld :: %s\n", count, feature->xml().c_str());
          EEDB::Metadata *md1 = feature->metadataset()->find_metadata("GO:id", "");
          feature->primary_name(md1->data());
          go_terms[md1->data()] = feature;
        }
        //feature->release();
        feature = NULL;
        //if(count>10) { return; }
      }
      char *s1 = index(_data_buffer, ']');
      if(s1) { *s1 = '\0'; }
      string type = _data_buffer +1;
      //printf("new element type [%s]\n", type.c_str());

      if(type == "Term") {
        feature = new EEDB::Feature();
        feature->feature_source(fsource);
        feature->metadataset()->add_metadata("GO:stanza_type", type);
      }
    }

    if(!feature) { continue; }

    char *s1 = index(_data_buffer, ':');
    if(!s1) { continue; }
    *s1 = '\0';
    string tag = string("GO:") + _data_buffer;
    char* value = s1 + 1;
    while((*value == ' ') || (*value == '\t')) { value++; } //eat leading whitespace
    string val2 = value;
    boost::algorithm::replace_all(val2, "\"", "");
    //printf("tag [%s]  value[%s]\n", tag.c_str(), value);
    feature->metadataset()->add_metadata(tag, val2);
    if(tag == "GO:id") { feature->primary_name(val2); }


    /*
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
    //CNhs10650.10043-101F7.hg38
    std::size_t p1 = filename.find("CNhs");
    string libID = filename.substr(p1);
    //p1 = libID.find(".hg38");
    p1 = libID.find(".mm10");
    libID.resize(p1);
    p1 = libID.find(".");
    string rnaID = libID.substr(p1+1);
    libID.resize(p1);
    //fprintf(stderr, "[%s] [%s]  %s\n", libID.c_str(), rnaID.c_str(), filename.c_str());
    library_ids[libID] = filename;

    if(ctss_experiments.find(libID) == ctss_experiments.end()) {
      fprintf(stderr, "WARN unable to find old ctss experiment [%s]\n", libID.c_str());
      continue;
    }
    if(remap_experiments.find(filename) == remap_experiments.end()) {
      fprintf(stderr, "WARN unable to find new remap experiment [%s]\n", filename.c_str());
      continue;
    }

    //TODO: merge the metadata from the old experiment to the new experiment
    EEDB::Experiment *ctss_exp  = ctss_experiments[libID];
    EEDB::Experiment *remap_exp = remap_experiments[filename];
    */
  }
  printf("%ld TERMS found\n", count);
  printf("%ld TERMS loaded into hash\n", go_terms.size());
  sleep(2);

  //Term stoage loop
  count=1;
  map<string, EEDB::Feature*>::iterator  go_it;
  for(go_it=go_terms.begin(); go_it!=go_terms.end(); go_it++) {
    EEDB::Feature *feature = (*go_it).second;
    string goID = feature->primary_name();
    EEDB::Feature *f2 = EEDB::Feature::fetch_by_source_primary_name(fsource, goID);
    if(f2) {
      (*go_it).second->release();
      (*go_it).second = f2;
      feature = f2;
      printf("%s already loaded [%s]\n", goID.c_str(), feature->db_id().c_str());
    }
    else {
      feature->store(f6db);
      printf("%ld :: %s\n", count++, feature->xml().c_str());
    }
    //printf("%ld :: %s\n", count++, feature->xml().c_str());
    //if(count>5) { return; }
  }

  //edge creation loop
  map<string, EEDB::Edge*>            go_edges;
  map<string, EEDB::Edge*>::iterator  e_it;

  count=0;
  for(go_it=go_terms.begin(); go_it!=go_terms.end(); go_it++) {
    EEDB::Feature *feature = (*go_it).second;
    string goID = feature->primary_name();
    //string goID = "GO:2001275";
    //feature = go_terms[goID];

    vector<EEDB::Metadata*> mdlist = feature->metadataset()->metadata_list();
    for(unsigned j=0; j<mdlist.size(); j++) {
      EEDB::Metadata *md1 = mdlist[j];
      if(!md1) { continue; }

      if((md1->type() != "GO:is_a") && (md1->type() != "GO:intersection_of") && (md1->type() != "GO:relationship")) { continue; }
 
      printf("make edge for %s", md1->xml().c_str());

      EEDB::Edge *edge = NULL;

      string go2id;
      string comment;
      string type = "";

      if(md1->type() == "GO:is_a")            { type = "is_a"; }
      if(md1->type() == "GO:intersection_of") { type = "intersection_of"; }
      if(md1->type() == "GO:relationship")    { type = "relationship"; }
      //if(md1->type() == "GO:is_a")            { edge->add_edgeweight(esource, "is_a", 0.0); }
      //if(md1->type() == "GO:intersection_of") { edge->add_edgeweight(esource, "intersection_of", 0.0); }
      //if(md1->type() == "GO:relationship")    { edge->add_edgeweight(esource, "relationship", 0.0); }

      string data = md1->data();
      std::size_t p2 = data.find('!');
      if(p2!=std::string::npos) {
        comment = data.substr(p2);
        while((comment[0] == '!') || (comment[0] == ' ')) {
          comment.erase(0,1);
          go2id = data.substr(0,p2);
        }
      }
      p2 = go2id.find("GO:");
      if(p2!=std::string::npos && p2!=0) {
        type = go2id.substr(0,p2);
        go2id.erase(0,p2);
      }
      boost::algorithm::replace_all(go2id, " ", "");
      boost::algorithm::replace_all(type, " ", "");

      //printf("link to : [%s]\n", go2id.c_str());
      //printf("comment : [%s]\n", comment.c_str());
      //printf("type    : [%s]\n", type.c_str());

      EEDB::Feature *feature2 = go_terms[go2id];
      if(!feature2) {
        printf("  ERROR could not find go_term [%s]\n", go2id.c_str());
        continue;
      }

      bool show_merge=false;
      string edge_key = feature->db_id() + feature2->db_id();
      if(go_edges.find(edge_key) != go_edges.end()) {
        printf("  found previous edge [%s -- %s] so add types and mdata to it (total so far %d)\n", goID.c_str(), go2id.c_str(), go_edges.size());
        edge = go_edges[edge_key];
        show_merge = true;
        //printf("%s\n", edge->xml().c_str());
      } else {
        edge = new EEDB::Edge();
        edge->edge_source(esource);
        edge->feature1(feature);
        edge->feature2(feature2);
        go_edges[edge_key] = edge;
      }
      edge->add_edgeweight(esource, type, 0.0);
      //edge->metadataset()->add_metadata("comment", comment);

      //if(show_merge) { printf("%s\n", edge->xml().c_str());  sleep(1); }
      count++;
    }
    //if(count>=10) { return; }
  }

  printf("made %d edges\n", go_edges.size());

  //edge stoage loop
  count=1;
  for(e_it=go_edges.begin(); e_it!=go_edges.end(); e_it++) {
    EEDB::Edge *edge = (*e_it).second;
    printf("%s\n", edge->xml().c_str());

    edge->store(f6db);

    //string goID = feature->primary_name();
    //EEDB::Feature *f2 = EEDB::Feature::fetch_by_source_primary_name(fsource, goID);
    //if(f2) {
    //  (*go_it).second->release();
    //  (*go_it).second = f2;
     // feature = f2;
      //printf("%s already loaded [%s]\n", goID.c_str(), feature->db_id().c_str());
    //}
    //else {
    //  feature->store(f6db);
    //  printf("%ld :: %s\n", count++, feature->xml().c_str());
    //}
    //printf("%ld :: %s\n", count++, feature->xml().c_str());
    //if(count>5) { return; }
  }

  return;
}


bool test_edge_oscfile_build() {
  /*
  <parameters>
    <orig_filename>gencode.v23.annotation.gff3.gz</orig_filename>
    <input_file>/zenbu/users/hOg5uv153xG1PgVgiU35hg/gencode.v23.annotation_WwGjHy.gff3.gz</input_file>
    <filetype>gff3</filetype>
    <display_name>gencode.v23.annotation test code</display_name>
    <description>gencode.v23.annotation</description>
    <genome_assembly>hg38</genome_assembly>
  </parameters>

  ./zenbu_sql_load_oscfile -edges -file ~/data/fantom6/DE/HDF_ASO_nAnT-iCAGE_DE_oligo_single_annot_DESeq2_edges_trimmed.osc  -assembly hg38 -featuresource1 CCFED83C-F889-43DC-BA41-7843FCB90095::7:::FeatureSource -featuresource2 A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::1:::FeatureSource -url mysql://read:read@zenbu.gsc.riken.jp:3308/zenbu_fantom6

  */

  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);

  EEDB::SPStreams::OSCFileDB *oscdb = new EEDB::SPStreams::OSCFileDB();

  //oscdb->set_parameter("orig_filename", "");
  //oscdb->set_parameter("filetype", "osc");
  //oscdb->set_parameter("display_name", "");
  //oscdb->set_parameter("description", "");
  //oscdb->set_parameter("genome_assembly", "");
  //oscdb->set_parameter("build_dir","/tmp/");
  //oscdb->set_parameter("deploy_dir", _user_profile->user_directory());
  //oscdb->set_parameter("input_file", "");
  oscdb->set_parameter("owner_identity", "jessica.severin@gmail.com");

  //string input_file = "/home/severin/data/fantom6/DE/de_merge_20170818_strong_v3b.osc";
  string input_file = "/home/severin/data/fantom6/DE/HDF_ASO_nAnT-iCAGE_DE_oligo_single_annot_DESeq2_edges_trimmed_20170818.osc";
  //string input_file = "/home/severin/data/fantom6/DE/HDF_ASO_nAnT-iCAGE_DE_oligo_single_annot_DESeq2_edges_trimmed.osc";

  oscdb->set_parameter("featuresource1", "CCFED83C-F889-43DC-BA41-7843FCB90095::7:::FeatureSource");
  oscdb->set_parameter("featuresource2", "A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::1:::FeatureSource");
    
  string oscpath = oscdb->create_db_for_file(input_file);
  if(oscpath.empty()) {
    //something went wrong
    fprintf(stderr,"BUILD ERROR [%s]\n", oscdb->error_message().c_str());
    return false;
  }
  fprintf(stderr, "new oscdb url [%s]\n", oscpath.c_str());
    
  //registry new oscdb peer into user registry
  //EEDB::Peer *user_reg = _current_job->user()->user_registry();
  EEDB::Peer *oscdb_peer = oscdb->peer();
  oscdb_peer->db_url(oscpath);  //set peer db_url to full URL location
  fprintf(stderr, "%s\n", oscdb_peer->xml().c_str());
  //oscdb_peer->store(user_reg->peer_database());

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("total build time %1.6f sec \n\n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);

  oscdb->release();
}


bool test_edge_oscfile_read() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);

  //string oscpath = "oscdb:///home/severin/data/fantom6/DE/de_merge_20170818_strong_v3b.oscdb";
  //string oscpath = "oscdb:///home/severin/data/fantom6/DE/HDF_ASO_nAnT-iCAGE_DE_oligo_single_annot_DESeq2_edges_trimmed_20170818.oscdb";
  string oscpath = "oscdb:///home/severin/data/fantom6/DE/HDF_ASO_nAnT-iCAGE_DE_oligo_single_annot_DESeq2_edges_trimmed.oscdb";

  fprintf(stderr, "test read edge oscdb===\n");
  gettimeofday(&starttime, NULL);
  EEDB::SPStreams::OSCFileDB *oscdb = EEDB::SPStreams::OSCFileDB::new_from_url(oscpath);
  if(oscdb == NULL) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
    printf("unable to connect to [%s]\n", oscpath.c_str());
    return false;;
  }
  //oscdb->oscfileparser();
  oscdb->oscfileparser()->display_info();

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("connect %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //oscp = oscdb->oscfileparser();
  //oscdb->oscfileparser()->display_info();
  //printf("%s", oscp->xml().c_str());

  gettimeofday(&starttime, NULL);
  EEDB::Edge *edge = oscdb->_fetch_edge_by_id(1234);
  if(edge) { printf("%s\n", edge->xml().c_str()); }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch single edge by id %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //
  // stream_edges test
  //
  fprintf(stderr, "\n======= test stream_edges\n");
  gettimeofday(&starttime, NULL);
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);
  webservice->set_parameter("source_ids", "A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::1:::FeatureSource, CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::14:::EdgeSource");
  webservice->postprocess_parameters(); //must do after all init and setting of user
  if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  EEDB::SPStream *stream = webservice->source_stream();
  stream->stream_clear();

  map<string, EEDB::Feature*> fid_hash;
  map<string, EEDB::Feature*>::iterator it1;

  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124121"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124811"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124812"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124813"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124814"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124815"] = NULL;

  //fid_hash["A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::36095"] = NULL;

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("setup %1.6f sec\n\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  gettimeofday(&starttime, NULL);
  if(!stream->fetch_features(fid_hash)) {
    fprintf(stderr, "failed to fetch\n");
  }
  long count = fid_hash.size();

  for(it1=fid_hash.begin(); it1!=fid_hash.end(); it1++) {
    EEDB::Feature *feature = (*it1).second;
    if(feature) {
      fprintf(stderr, "%s :: %s %s\n", (*it1).first.c_str(), feature->primary_name().c_str(), feature->chrom_location().c_str());
    } else {
      fprintf(stderr, "%s :: not fetched\n", (*it1).first.c_str());
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch initial features %1.6f sec\n\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  gettimeofday(&starttime, NULL);
  oscdb->stream_edges(fid_hash, "");

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("stream_edges %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  return true;
}


bool test_edge_oscfile_read2() {
  struct timeval           starttime,endtime,difftime;  
  gettimeofday(&starttime, NULL);

  //
  // stream_edges test
  //
  fprintf(stderr, "\n======= test stream_edges2\n");
  gettimeofday(&starttime, NULL);
  EEDB::WebServices::MetaSearch*   webservice = new EEDB::WebServices::MetaSearch();
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  printf("%s\n", userdb->xml().c_str());
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);
  //webservice->set_parameter("source_ids", "A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::1:::FeatureSource, CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::14:::EdgeSource");
//<zenbu_query><format>fullxml</format><mode>edges</mode><source_ids>
  webservice->set_parameter("mode", "edges");
  webservice->set_parameter("format", "none");
  webservice->set_parameter("source_ids", "6F90A065-4234-4C36-93D4-546878DEF3CB::1:::EdgeSource");
  webservice->set_parameter("feature_ids", "CCFED83C-F889-43DC-BA41-7843FCB90095::124079,7AA26B8D-8634-45A4-8F74-DF3E04B3456A::4959,CCFED83C-F889-43DC-BA41-7843FCB90095::124079,CCFED83C-F889-43DC-BA41-7843FCB90095::124516,CCFED83C-F889-43DC-BA41-7843FCB90095::124517,CCFED83C-F889-43DC-BA41-7843FCB90095::124518,CCFED83C-F889-43DC-BA41-7843FCB90095::124519,CCFED83C-F889-43DC-BA41-7843FCB90095::124520,CCFED83C-F889-43DC-BA41-7843FCB90095::124521,CCFED83C-F889-43DC-BA41-7843FCB90095::124522,CCFED83C-F889-43DC-BA41-7843FCB90095::124523,CCFED83C-F889-43DC-BA41-7843FCB90095::124524,CCFED83C-F889-43DC-BA41-7843FCB90095::124525,CCFED83C-F889-43DC-BA41-7843FCB90095::225212");

  webservice->postprocess_parameters(); //must do after all init and setting of user
  if(userdb) { printf("%s\n", userdb->xml().c_str()); }

  /*
  EEDB::SPStream *stream = webservice->source_stream();
  stream->stream_clear();

  map<string, EEDB::Feature*> fid_hash;
  map<string, EEDB::Feature*>::iterator it1;

  //fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124121"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124811"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124812"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124813"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124814"] = NULL;
  fid_hash["CCFED83C-F889-43DC-BA41-7843FCB90095::124815"] = NULL;

  //fid_hash["A59C9253-FCD1-48D3-AB8C-75810F7D5AD0::36095"] = NULL;

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("setup %1.6f sec\n\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));

  gettimeofday(&starttime, NULL);
  if(!stream->fetch_features(fid_hash)) {
    fprintf(stderr, "failed to fetch\n");
  }
  long count = fid_hash.size();

  for(it1=fid_hash.begin(); it1!=fid_hash.end(); it1++) {
    EEDB::Feature *feature = (*it1).second;
    if(feature) {
      fprintf(stderr, "%s :: %s %s\n", (*it1).first.c_str(), feature->primary_name().c_str(), feature->chrom_location().c_str());
    } else {
      fprintf(stderr, "%s :: not fetched\n", (*it1).first.c_str());
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("fetch initial features %1.6f sec\n\n", ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
  */

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("stream_edges2 prior to show_edges %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->show_edges();

  //gettimeofday(&starttime, NULL);
  //oscdb->stream_edges(fid_hash, "");

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("stream_edges2 %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  return true;
}


void test_assembly_ncbi_fetch_info() {
  struct timeval                        starttime,endtime,difftime;
  double                                last_update = 0.0;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  
  printf("\n== test_assembly_ncbi_fetch_info \n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->postprocess_parameters();
  
  EEDB::Assembly *asmb1 = webservice->find_assembly("hg38");
  printf("%s\n", asmb1->xml().c_str());


  asmb1->fetch_NCBI_taxonomy_info();
  printf("%s\n", asmb1->xml().c_str());
}



bool test_demux_single_cell() {
  //
  // testing the new DemultiplexSource module for CellID and single-cell 10x type data
  //
  fprintf(stderr, "\n======= test_demux_single_cell\n");

  struct timeval                        starttime,endtime,difftime;
  double                                last_update = 0.0;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();
  
  printf("\n== test_site_finder \n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->set_parameter("nocache", "true");
  webservice->set_parameter("trackcache", "999d13c8789cab542734afac48e6c6fb73c866977534ca09d1ac76d18cb2b3");
  webservice->set_parameter("mode", "sources");
  webservice->postprocess_parameters();
  
  EEDB::Assembly *asmb1 = webservice->find_assembly("hg19");
  printf("%s\n", asmb1->xml().c_str());

  EEDB::Assembly *asmb2 = EEDB::Assembly::cache_get_assembly("hg19");
  if(!asmb2) { fprintf(stderr, "unable to get assembly from cache\n"); }
  else { printf("%s\n", asmb2->xml().c_str()); }


  stream = webservice->region_stream();

  EEDB::SPStreams::DemultiplexSource *demux = new EEDB::SPStreams::DemultiplexSource();
  demux->set_demux_source_mode("experiment");
  demux->add_demux_mdata_keys("eedb:name");
  demux->source_stream(stream);
  stream = demux;

  stream->stream_clear();
  printf("%s\n", stream->xml().c_str());

  long count=0;
  gettimeofday(&starttime, NULL);
  
  //phase2 open-end read test
  printf("== read features\n");

  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_clear();
  stream->stream_by_named_region("hg19","chr19", 50161252, 50170707);
  printf("region hg19::chr19:50161252-50170707\n");
  
  while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) { 
    if(!feature) { continue; }
    
    printf("%s", feature->xml().c_str());
    count++;    
    
    //if(count%5000 == 0) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    double runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
    //if(count%5000 == 0) {
    if(runtime > last_update + 2.0) {
      //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec [%ld obj]\n", count / runtime, count);
      last_update = runtime;
    }
    feature->release();
  }

  printf("\n============= stream sources and peers last\n");
  map<string, EEDB::Peer*>    t_peers;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->xml().c_str());
    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { t_peers[uuid] = peer; }
  }
  printf("%ld sources\n", count);
  
  count=0;
  map<string, EEDB::Peer*>::iterator  it2;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


bool test_append_expression() {
  //
  // testing the new AppendExpression module to dynamic creation of experiment mirroring FeatureSource and adding expression on demand
  //
  fprintf(stderr, "\n======= test_append_expression\n");

  struct timeval                        starttime,endtime,difftime;
  double                                last_update = 0.0;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();
  
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->set_parameter("nocache", "true");
  webservice->set_parameter("source_ids", "8A1AA381-1E01-42EC-8BB8-D0295606EA53::1:::FeatureSource");
  webservice->postprocess_parameters();
  
  stream = webservice->region_stream();

  EEDB::SPStreams::AppendExpression *addExpr = new EEDB::SPStreams::AppendExpression();
  addExpr->source_stream(stream);
  stream = addExpr;

  stream->stream_clear();
  printf("%s\n", stream->xml().c_str());

  long count=0;
  gettimeofday(&starttime, NULL);
  
  map<string, EEDB::Peer*>    t_peers;
  map<string, EEDB::Peer*>::iterator  it2;
  /*
  printf("\n============= initial stream sources and peers\n");
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->xml().c_str());
    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { t_peers[uuid] = peer; }
  }
  printf("%ld sources\n", count);
  
  count=0;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);
  */


  printf("== read features\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_clear();
  //stream->stream_by_named_region("hg38","chr19", 49657992,49667452);
  stream->stream_by_named_region("hg38","chr19", 49663677, 49664097);
  printf("region hg38::chr19:49657992-49667452\n");
  
  while(EEDB::Feature *feature = (EEDB::Feature*)stream->next_in_stream()) { 
    if(!feature) { continue; }
    
    printf("%s", feature->xml().c_str());
    count++;    
    
    //if(count%5000 == 0) {
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    double runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
    //if(count%5000 == 0) {
    if(runtime > last_update + 2.0) {
      //printf("%ld in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      //printf("%1.3f obj/sec [%ld obj]\n", count / runtime, count);
      last_update = runtime;
    }
    feature->release();
  }

  printf("\n============= end stream sources and peers\n");
  t_peers.clear();;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->xml().c_str());
    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { t_peers[uuid] = peer; }
  }
  printf("%ld sources\n", count);
  
  count=0;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}


void test_region_download() {
  struct timeval                        starttime,endtime,difftime;

  gettimeofday(&starttime, NULL);

/*
  var paramXML = "<zenbu_query>\n";
  paramXML += "<format>"+glyphTrack.download.format+"</format>\n";
  paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n";
  paramXML += "<view_uuid>"+ current_region.configUUID +"</view_uuid>\n";

  paramXML += "<export_subfeatures>"+glyphTrack.download.subfeatures+"</export_subfeatures>\n";
  paramXML += "<export_feature_metadata>"+glyphTrack.download.feature_metadata+"</export_feature_metadata>\n";
  paramXML += "<export_experiment_metadata>"+glyphTrack.download.experiment_metadata+"</export_experiment_metadata>\n";
  paramXML += "<export_osc_metadata>"+glyphTrack.download.osc_metadata+"</export_osc_metadata>\n";

  paramXML += "<asm>"+current_region.asm+"</asm>\n";

  if(glyphTrack.download.mode == "selection") {
    var ss = glyphTrack.selection.chrom_start;
    var se = glyphTrack.selection.chrom_end;
    if(ss>se) { var t=ss; ss=se; se=t; }
    chromloc = chrom +":" + ss + ".." + se;
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "visible") {
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "genome") {
    paramXML += "<genome_scan>genome</genome_scan>\n";
  }
  if(glyphTrack.download.mode == "location") {
    paramXML += "<loc>"+glyphTrack.download.location+"</loc>\n";
  }

  if(glyphTrack.download.savefile) { paramXML += "<savefile>true</savefile>\n"; }

  paramXML += "<mode>region</mode>\n";
  paramXML += "<output_datatype>" + glyphTrack.datatype + "</output_datatype>\n";

  paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";

  paramXML += "</zenbu_query>\n";

*/

  printf("\n== test_region_download\n");
  EEDB::WebServices::RegionServer  *regionserver = new EEDB::WebServices::RegionServer();
  regionserver->parse_config_file("/etc/zenbu/zenbu.conf");

  regionserver->set_parameter("format", "osc");
  regionserver->set_parameter("asm", "hg19");
  regionserver->set_parameter("genome_scan", "genome");
  regionserver->set_parameter("mode", "genome_scan");
  regionserver->set_parameter("trackcache", "1417873d1527dbf2c5d2903021d5942a79e94671ca3d677181b6d02de37c88");
  regionserver->set_parameter("export_subfeatures", "bed");
  regionserver->set_parameter("export_feature_metadata", "true");
  regionserver->set_parameter("export_experiment_metadata", "true");
  regionserver->set_parameter("export_osc_metadata", "true");
  regionserver->set_parameter("/output_datatype", "q20_tpm");
  regionserver->postprocess_parameters();

  //regionserver->init_from_track_cache("1417873d1527dbf2c5d2903021d5942a79e94671ca3d677181b6d02de37c88");

  regionserver->track_cache();

  string configXML = regionserver->generate_configXML();
  string hashkey   = MQDB::sha256(configXML);

  printf("%s\n", configXML.c_str());
  printf("hashkey [%s] %ld\n", hashkey.c_str(), (long)hashkey.length());

  regionserver->execute_request();

}


void test_region_server_track_cache() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::RegionServer      *webservice = new EEDB::WebServices::RegionServer();

  gettimeofday(&starttime, NULL);

  printf("\n== test_region_server_track_cache\n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //string post_data ="<zenbu_query><format>xml</format><mode>trackcache_stats</mode> <trackcache>b272d26b139e39fa7a6311f8a45315788c638806663cba82416b8ca92e</trackcache> <asm>hg19</asm> <loc>chr19:36393243..36395276</loc> </zenbu_query>";
  string post_data = "<zenbu_query><track_title>Encode Gingeras CSHL LongRnaSeq (Gm12878, Hela, Nhek)</track_title> <view_uuid>5i8orqlTG1xiw_rAzXbuCC</view_uuid> <source_ids>B63DA9C2-0EA1-4709-B97D-6745DCDC3577::2:::Experiment,2E16B476-7037-4FE3-B35A-E7292502B3A1::2:::Experiment,C50C982C-2CD0-4906-AD48-BC6B2DDA9619::2:::Experiment,D0BDD2B4-48B0-4F0B-B342-5E967A70635F::2:::Experiment,91BBFC61-B9B5-4F9B-BCCD-A5052E369E68::2:::Experiment,629F301B-E6AA-4126-9EBF-C2468A42B97B::2:::Experiment,8D591B95-35BA-4B89-B01A-3FDD3040B399::2:::Experiment,84AF666B-1C18-41DE-B427-22E54CF8DDC2::2:::Experiment,12EFE3C7-CBA9-49A7-8E2F-EB152D7787EF::2:::Experiment,B55245CF-1EF9-4760-87C5-74ABF1E82739::2:::Experiment,2D1AB7DA-D910-4F18-93F3-F40C930006C6::2:::Experiment,26515F23-8A26-46FF-ADE2-356A07BA1C62::2:::Experiment,E9478399-23BD-45C6-BE5A-D7B3765C3432::2:::Experiment,EF6D9D5C-35BA-4BE4-96E7-CF3F0C198822::2:::Experiment</source_ids> <exptype>q20_tpm</exptype> <asm>hg19</asm> <loc>chr19:36377615..36399522</loc> <mode>region</mode> <source_outmode>full_feature</source_outmode> <overlap_check_subfeatures>true</overlap_check_subfeatures> <display_width>970</display_width> <binning>sum</binning> <overlap_mode>height</overlap_mode> <expression_binning>true</expression_binning> <expression_visualize/> <format>fullxml</format> </zenbu_query>";

  webservice->init_service_request();

  //reinitialize variables
  //_stream_processing_head  = NULL;
  //_stream_processing_tail  = NULL;
  //_region_start            = -1;
  //_region_end              = -1;
  //_display_width           = 640;
  //_total_count             = 0;
  //_raw_count               = 0;

  webservice->get_url_parameters();  //from super class

  webservice->set_post_data(post_data);

  webservice->process_xml_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after process_xml_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->show_api();

  EEDB::TrackCache *cache = webservice->track_cache();
  printf("hashkey = %s\n", cache->track_hashkey().c_str());
  printf("%s\n", cache->track_configxml().c_str());

  webservice->execute_request();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after execute_request %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->disconnect();
  //sleep(100);

  //get_post_data();
  //if(!_post_data.empty()) { process_xml_parameters(); }
  //postprocess_parameters();
  //return execute_request();
}


void test_metasearch_server() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::WebServices::MetaSearch*        webservice = new EEDB::WebServices::MetaSearch();

  gettimeofday(&starttime, NULL);

  printf("\n== test_metasearch_server\n");
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");

  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  //string post_data = "<zenbu_query><source_ids>6161A5A0-9C9B-45C0-AF19-662D472957AF::1:::FeatureSource,0C4920B6-7DE3-11DF-A02D-2B55894DF986::1:::Experiment,1A4CD8F6-7DE3-11DF-A8B9-3155894DF986::1:::Experiment,B1880D44-F935-11DF-82E8-6158894DF986::15:::FeatureSource</source_ids><mode>sources</mode><format>fullxml</format> </zenbu_query>";
  //string post_data = "<zenbu_query><format>none</format><mode>edges</mode><source_ids>0F8CC110-BF72-4052-A02F-444F45104BF5::1:::EdgeSource</source_ids><edge_search_depth>3</edge_search_depth><filter>clusterID:=HeLa.cluster_0303</filter></zenbu_query>";
  //string post_data = "<zenbu_query><format>none</format><mode>edges</mode><source_ids>0F8CC110-BF72-4052-A02F-444F45104BF5::1:::EdgeSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource</source_ids><edge_search_depth>3</edge_search_depth><filter>clusterID:=HeLa.cluster_0303</filter></zenbu_query>";

  //string post_data = "<zenbu_query><format>none</format><mode>edges</mode><source_ids>0F8CC110-BF72-4052-A02F-444F45104BF5::1:::EdgeSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource</source_ids><edge_search_depth>3</edge_search_depth><feature_ids>94A72C6D-1627-48BF-BEA5-3C4621DE1493::103387</feature_ids><filter>hela</filter></zenbu_query>";
  //string post_data = "<zenbu_query><format>none</format><mode>edges</mode><source_ids>0F8CC110-BF72-4052-A02F-444F45104BF5::1:::EdgeSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource</source_ids><edge_search_depth>7</edge_search_depth><feature_ids>94A72C6D-1627-48BF-BEA5-3C4621DE1493::277442</feature_ids><filter>hela</filter></zenbu_query>";
  //string post_data = "<zenbu_query><format>none</format><mode>edges</mode><source_ids>0F8CC110-BF72-4052-A02F-444F45104BF5::1:::EdgeSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource</source_ids><edge_search_depth>7</edge_search_depth><feature_ids>94A72C6D-1627-48BF-BEA5-3C4621DE1493::277442</feature_ids></zenbu_query>";
  //string post_data = "<zenbu_query><format>none</format><mode>edges</mode><source_ids>0F8CC110-BF72-4052-A02F-444F45104BF5::1:::EdgeSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource,94A72C6D-1627-48BF-BEA5-3C4621DE1493::1:::FeatureSource</source_ids><edge_search_depth>3</edge_search_depth><filter>clusterID:=HeLa.cluster_0008</filter></zenbu_query>";
  string post_data = "<zenbu_query><format>fullxml</format><mode>edges</mode><source_ids>4119C49D-2845-4884-BEC2-C2BFFE41F124::1:::EdgeSource</source_ids><edge_search_depth>1</edge_search_depth><feature_ids>58DE432F-B927-4228-8660-0AA3F5617FD2::18496,B1D08850-F335-4EE5-8869-AE75205C2090::178162,B1D08850-F335-4EE5-8869-AE75205C2090::178183,B1D08850-F335-4EE5-8869-AE75205C2090::178196,B1D08850-F335-4EE5-8869-AE75205C2090::178241,B1D08850-F335-4EE5-8869-AE75205C2090::178273,B1D08850-F335-4EE5-8869-AE75205C2090::178279,B1D08850-F335-4EE5-8869-AE75205C2090::178290,B1D08850-F335-4EE5-8869-AE75205C2090::178304,B1D08850-F335-4EE5-8869-AE75205C2090::178314,B1D08850-F335-4EE5-8869-AE75205C2090::178402,B1D08850-F335-4EE5-8869-AE75205C2090::178422,B1D08850-F335-4EE5-8869-AE75205C2090::178429,B1D08850-F335-4EE5-8869-AE75205C2090::178438,B1D08850-F335-4EE5-8869-AE75205C2090::178455,B1D08850-F335-4EE5-8869-AE75205C2090::178467,B1D08850-F335-4EE5-8869-AE75205C2090::178495,B1D08850-F335-4EE5-8869-AE75205C2090::178624</feature_ids><filter>clusterID:=HeLa.cluster_1579</filter></zenbu_query>";


  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  //reinitialize variables
  //_stream_processing_head  = NULL;
  //_stream_processing_tail  = NULL;
  //_region_start            = -1;
  //_region_end              = -1;
  //_display_width           = 640;
  //_total_count             = 0;
  //_raw_count               = 0;

  webservice->get_url_parameters();  //from super class

  webservice->set_post_data(post_data);

  webservice->process_xml_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after process_xml_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->show_api();

  webservice->execute_request();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("===== finished (after execute_request) %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);

  webservice->disconnect();
}


void test_pair_reads() {
  //
  // testing the new AppendExpression module to dynamic creation of experiment mirroring FeatureSource and adding expression on demand
  //
  fprintf(stderr, "\n======= test_pair_reads\n");

  struct timeval                        starttime,endtime,difftime;
  double                                last_update = 0.0;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::RegionServer       *webservice = new EEDB::WebServices::RegionServer();
  
  webservice->parse_config_file("/etc/zenbu/zenbu.conf");
  webservice->init_service_request();

  MQDB::Database *userdb = webservice->userDB();
  EEDB::User *user = EEDB::User::fetch_by_email(userdb, "jessica.severin@gmail.com");
  fprintf(stderr, "%s\n", user->xml().c_str());
  webservice->set_user_profile(user);

  webservice->set_parameter("nocache", "true");
  //webservice->set_parameter("source_ids", "2BAD492C-F893-43F5-A34C-3C523AE055F0::2:::Experiment");
  //webservice->set_parameter("source_ids", "AA0594B7-E15D-4139-819D-C479F2EB3EF4::2:::Experiment,8B0BD37C-555B-4AC1-B5E8-862FF50750DA::2:::Experiment,BE86E563-AC9B-40E9-97CE-7F52CF69883C::2:::Experiment"); //iPSC HiC bams
  webservice->set_parameter("source_ids", "AA0594B7-E15D-4139-819D-C479F2EB3EF4::2:::Experiment"); //just 1 iPSC HiC bams
  webservice->set_parameter("exptype", "tagcount");
  //webservice->set_parameter("source_outmode", "full_feature");
  //webservice->set_parameter("source_outmode", "simple_express");
  webservice->set_parameter("source_outmode", "skip_subfeatures");
  webservice->set_parameter("asm", "hg38");
  //webservice->set_parameter("genome_assembly", "hg38");
  //webservice->set_parameter("format", "fullxml");

  webservice->postprocess_parameters();
  
  stream = webservice->region_stream();

  EEDB::SPStreams::PairReads *mod = new EEDB::SPStreams::PairReads();
  mod->source_stream(stream);
  mod->output_unpaired(false);
  mod->sam_md_checks(true);
  //mod->distance(30000);
  //mod->distance(100000);
  //mod->distance(400000);
  //mod->distance(10000);
  stream = mod;

  //EEDB::SPStreams::EdgeLengthFilter *mod2 = new EEDB::SPStreams::EdgeLengthFilter();
  //mod2->source_stream(stream);
  //mod2->min_length(310000);
  //stream = mod2;

  EEDB::SPStreams::FeatureEmitter *emitter = new EEDB::SPStreams::FeatureEmitter;
  emitter->fixed_grid(true);
  emitter->overlap(0);
  emitter->both_strands(false);
  emitter->width(20000);

  EEDB::SPStreams::TemplateCluster *cluster = new EEDB::SPStreams::TemplateCluster;
  cluster->side_stream(emitter);
  cluster->source_stream(stream);
  cluster->ignore_strand(true);
  cluster->skip_empty_templates(true);
  cluster->expression_mode(EEDB::CL_SUM);
  cluster->overlap_mode("5end");
  cluster->overlap_distance(0);
  //cluster->prescan_distance(100000);
  stream = cluster;


  printf("%s\n", stream->xml().c_str());

  long count=0;
  gettimeofday(&starttime, NULL);
  
  map<string, EEDB::Peer*>    t_peers;
  map<string, EEDB::Peer*>::iterator  it2;

  /*
  printf("\n============= initial stream sources and peers\n");
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->xml().c_str());
    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { t_peers[uuid] = peer; }
  }
  printf("%ld sources\n", count);
  
  count=0;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  printf("%ld peers\n", count);
  */

  printf("== read objects\n");
  gettimeofday(&starttime, NULL);
  count=0;
  stream->stream_clear();
  //printf("region hg38::chr6:74635185-74636822\n");
  //stream->stream_by_named_region("hg38", "chr6", 74635185, 74636822);
  //stream->stream_by_named_region("hg38", "chr8", 56073820, 56073919); //SNORD54
  //stream->stream_by_named_region("hg38", "chr8", 56439509, 56448179); //PENK
  //stream->stream_by_named_region("hg38", "chr8", 56073820, 56448179); //SNORD54 - PENK
  //stream->stream_by_named_region("hg38", "chr8", 56400000, 56470000); //PENK plus extra
  //stream->stream_by_named_region("hg38", "chr8", 90000000, -1); //mem leak test
  stream->stream_by_named_region("hg38", "chr8", 56063574, 56993862); //SNORD54, PENK cluster1213, 930kb
  //printf("after stream_by_named_region\n");
  
  long obj_count=0;
  while(MQDB::DBObject *obj = stream->next_in_stream()) { 
    if(!obj) { continue; }
    
    //printf("%s", obj->xml().c_str());
    obj_count++;    

    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    double runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;

    EEDB::Edge  *edge = NULL;
    string       loc;
    if(obj->classname() == EEDB::Edge::class_name) { 
      edge = (EEDB::Edge*)obj;
      loc = edge->feature1()->chrom_location().c_str();
    }
    if(obj->classname() == EEDB::Feature::class_name) { 
      loc = ((EEDB::Feature*)obj)->chrom_location().c_str();
    }

    if(edge) {
      //string xml; 
      //edge->fullxml(xml);
      //printf("%s", xml.c_str());

        /* printf("edge dir[%c] %ld..%ld (%ld bp) [%s] :: %s <=> %s\n", 
           edge->direction(), edge->chrom_start(), edge->chrom_end(),
           edge->chrom_end() - edge->chrom_start() +1,
           edge->feature1()->primary_name().c_str(), 
           edge->feature1()->chrom_location().c_str(), edge->feature2()->chrom_location().c_str());
        */
    }

    
    if(runtime > last_update + 2.0) {
      //printf("%ld in %1.6f sec \n", obj_count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%1.3f obj/sec [%ld obj] %s\n", obj_count / runtime, obj_count, loc.c_str());
      last_update = runtime;
    }

    obj->release();
  }

  //printf("\n============= end stream sources and peers\n");
  t_peers.clear();;
  count=0;
  stream->stream_data_sources("");
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    printf("%s", source->xml().c_str());
    count++;
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { t_peers[uuid] = peer; }
  }
  //printf("%ld sources\n", count);
  
  count=0;
  for(it2 = t_peers.begin(); it2 != t_peers.end(); it2++) {
    printf("%s\n", (*it2).second->xml().c_str());
    count++;
  }  
  //printf("%ld peers\n", count);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.3f obj/sec [%ld obj in %1.6f sec]\n", obj_count /((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0),
                                                   obj_count , ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0));
}

