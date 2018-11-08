#include <stdio.h>
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <unistd.h>
#include <sys/types.h>
#include <pwd.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
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
#include <EEDB/Configuration.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
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

void usage();
void create_encode_description();
void create_encode_name();
void encode_mdata_prep();
bool save_mdata_edits(MQDB::DBObject *obj);
void test_oscdb_feature_mdata_index();
void test_user_merge();


bool                        _count_only=false;
long                        _upgrade_max = 0;
long                        _upgrade_count = 0;
EEDB::WebServices::WebBase* _webservice;
map<string,string>          _parameters;
string                      _owner_openid;
bool                        _save_edits = false;
map<string,bool>            _desc_xml_tags;



int main(int argc, char *argv[]) {
  int             loop=10000;
  int count;
  struct timeval   starttime,endtime,difftime;
  DBObject         *tobj;
  void                    *stmt;
  
  gettimeofday(&starttime, NULL);
  srand(time(NULL));

  _desc_xml_tags["description"] = true;
  _desc_xml_tags["eedb:assembly_name"] = true;
  _desc_xml_tags["assembly_name"] = true;
  _desc_xml_tags["eedb:display_name"] = true;
  _desc_xml_tags["zenbu:proxy_id"] = true;
  _desc_xml_tags["date"] = true;
  _desc_xml_tags["create_date"] = true;

  _webservice = new EEDB::WebServices::WebBase();
  _webservice->parse_config_file("/var/www/html/zenbu/cgi/eedb_server_config.xml");
  
  for(int argi=1; argi<argc; argi++) {
    
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];
    
    vector<string> argvals;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      argvals.push_back(argv[argi]);
    }
    
    if(arg == "-help")      { usage(); }
    if(arg == "-openid")    { _owner_openid = argvals[0]; }
    if(arg == "-store")     { _save_edits=true; }
    if(arg == "-save")      { _save_edits=true; }
    if(arg == "-count")     { _count_only=true; }
    if(arg == "-mode")      { _parameters["mode"] = argvals[0]; }
    if(arg == "-format")    { _parameters["format"] = argvals[0]; }
    if(arg == "-sources")   { _parameters["mode"] = "sources"; }
    if(arg == "-show")      { _parameters["submode"] = "show"; }
    if(arg == "-uuid")      { _parameters["uuid"] = argvals[0]; }
    
    if(arg == "-oscdb")     { _parameters["mode"] = "oscdb"; }
    if(arg == "-bamdb")     { _parameters["mode"] = "bamdb"; }
    if(arg == "-configs")   { _parameters["mode"] = "configs"; }
    
    if(arg == "-limit")     { _upgrade_max = strtol(argv[argi], NULL, 10); }
    if(arg == "-max")       { _upgrade_max = strtol(argv[argi], NULL, 10); }

    if(arg == "-configtype")   { 
      string cfg = argvals[0];       
      if(cfg == "view")     { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "glyphs")   { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "gLyphs")   { _parameters["configtype"] = "eeDB_gLyphs_configs"; }
      if(cfg == "track")    { _parameters["configtype"] = "eeDB_gLyph_track_configs"; }
      if(cfg == "script")   { _parameters["configtype"] = "ZENBU_script_configs"; }
      if(cfg == "autosave") { _parameters["configtype"] = "eeDB_gLyphs_autoconfigs"; }      
    }
    if(arg == "-search") { _parameters["filter"] = argvals[0]; }
    if(arg == "-filter") { _parameters["filter"] = argvals[0]; }
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
        if(!tstr.empty()) { tstr += " "; }
        tstr += argvals[j];
      }
      _parameters["peers"] += tstr;
    }
  }
  
  if(_parameters["mode"] == "") { usage(); }
  if(_parameters["mode"] == "encodemd") { encode_mdata_prep(); } 
  if(_parameters["mode"] == "encodename") { create_encode_name(); } 
  if(_parameters["mode"] == "encodedesc") { create_encode_description(); } 
  if(_parameters["mode"] == "featmd") { test_oscdb_feature_mdata_index(); }
  if(_parameters["mode"] == "usermerge") { test_user_merge(); }

  exit(1);
}

void usage() {
  printf("zenbu_test2 [options]\n");
  printf("  -help                 : print this help\n");
  printf("  -oscdb                : upgrade OSCDB from v1 (sqlite) to v2 (xml) based\n");
  printf("  -bamdb                : upgrade BAMDB to include q20_tpm\n");
  printf("  -configs              : upgrade configuration system to userDB centralized system\n");
  printf("  -peers <uuid...>      : set peer filter for stream\n");
  printf("  -search <phrase>      : search federation for sources matching search phrase\n");
  printf("  -configtype <type>    : only upgrade configurations of configtype (view, track, script, autosave)\n");
  printf("  -show                 : display metadata of object after editing\n");
  printf("  -store                : store modifications back into database\n");
  printf("zenbu_test2 v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
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


//
//
////////////////////////////////////////////////////////////////////////////////////////////
//
//

void encode_mdata_prep() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  
  printf("\n====== encode_mdata_prep == \n");
  gettimeofday(&starttime, NULL);
  

  //first get the encode master list
  map<string, string>  encode_master;
  char readbuf[65535];
  FILE *encfp = fopen("all_encode_file_list.txt", "r");
  while(fgets(readbuf, 65530, encfp) != NULL) {
    string linebuffer = readbuf;
    
    char *p1 = strchr(readbuf, '\t');
    if(!p1) { printf("problem line\n"); continue; }
    *p1 = '\0';
    string name = readbuf;
    string encode_tags = p1+1;
    boost::algorithm::replace_all(encode_tags, "\n", "");


    //printf("[%s] => [%s]\n", name.c_str(), encode_tags.c_str());
    encode_master[name] = encode_tags;

    /*
    wgEncodeAffyRnaChipFiltTransfragsKeratinocyteCytosolLongnonpolya.broadPeak.gz   project=wgEncode; grant=Gingeras; lab=Affy; composite=wgEncodeAffyRnaChip; dataType=RnaChip; view=FiltTransfrags; cell=NHEK; localization=cytosol; rnaExtract=longNonPolyA; origAssembly=hg18; dataVersion=ENCODE July 2009 Freeze; dccAccession=wgEncodeEH000020; dateSubmitted=2009-05-27; dateUnrestricted=2010-02-27; subId=2121; tableName=wgEncodeAffyRnaChipFiltTransfragsKeratinocyteCytosolLongnonpolya; type=broadPeak; md5sum=c46d346e80f589a89ee12ca04a09962b; size=9.1M
    */
  }
  fclose(encfp);
    

  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    webservice->set_parameter((*param).first, (*param).second);
  }
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  stream = webservice->source_stream();
  
  _parameters["filter"] += " encode";
  printf("search filter [%s]\n", _parameters["filter"].c_str());

  stream->stream_data_sources("Experiment", _parameters["filter"]);

  long search_count=0;
  int edit_count=0;
  vector<EEDB::DataSource*> _objects;
  map<string, EEDB::Peer*>  peers;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { continue; }
    
    search_count++;

    if(source->metadataset()->has_metadata_like("enc:dataVersion","") &&
       source->metadataset()->has_metadata_like("enc:datatype_dataGroup","") &&
       source->metadataset()->has_metadata_like("enc:datatype_description","") &&
       source->metadataset()->has_metadata_like("enc:datatype_label","")) {
      //printf("[%s] :: OK encode metadata\n", source->display_name().c_str());
      continue;
    }

    string newname, oldname = source->display_name();;
    string orig_filename;

    EEDB::Metadata* mdata = source->metadataset()->find_metadata("original_filename","");
    if(mdata) { orig_filename = mdata->data(); }
    if(orig_filename.empty() && (source->display_name().find("narrowPeak") != string::npos)) {
      orig_filename = source->display_name() + ".gz";
    }

    if(orig_filename.empty()) {
      //printf("[%s] :: MISSING original_filename\n", source->display_name().c_str());
      continue;
    }
    if(encode_master.find(orig_filename) == encode_master.end()) {
      //printf("[%s] :: MISSING encode master reference [%s]\n", source->display_name().c_str(), orig_filename.c_str());
    }

    //change it
    _objects.push_back(source);
    edit_count++;
    //printf("%s\t%s\n", source->db_id().c_str(), orig_filename.c_str());
    printf("%s\t%s\t%s\n", source->db_id().c_str(), orig_filename.c_str(), encode_master[orig_filename].c_str());


    /*
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      //oscdb so need to collate peers to secondary save
      peers[uuid] = peer;
    } else {
      //older mysql/sqlite based source so can save right now
      if(_save_edits) { save_mdata_edits(source); }
    }
    */
  }
  
  
  /*
  map<string, EEDB::Peer* >::iterator peer;
  for(peer=peers.begin(); peer!=peers.end(); peer++) {
    EEDB::SPStreams::SourceStream *sourcestream = (*peer).second->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(_save_edits) { oscdb->save_xmldb(); }  //automatically upgrades if needed
    }
    if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
      if(_save_edits) { bamdb->save_xmldb(); }  //automatically upgrades if needed
    }
    //printf("%s", source->xml().c_str());
  }
  */
  
  printf("%ld searched objects\n", search_count);
  printf("%d need mdata\n", edit_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}



void create_encode_name() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  
  printf("\n====== create_encode_name == \n");
  gettimeofday(&starttime, NULL);
  
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    webservice->set_parameter((*param).first, (*param).second);
  }
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  stream = webservice->source_stream();
  
  _parameters["filter"] += " encode";
  printf("search filter [%s]\n", _parameters["filter"].c_str());

  stream->stream_data_sources("Experiment", _parameters["filter"]);

  long search_count=0;
  int edit_count=0;
  vector<EEDB::DataSource*> _objects;
  map<string, EEDB::Peer*>  peers;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { continue; }
    
    search_count++;
    printf("[%s] :: ", source->display_name().c_str());

    if(!source->metadataset()->has_metadata_like("enc:dataVersion","") ||
       !source->metadataset()->has_metadata_like("enc:datatype_dataGroup","") ||
       !source->metadataset()->has_metadata_like("enc:datatype_description","") ||
       !source->metadataset()->has_metadata_like("enc:datatype_label","")) {
      printf("MISSING encode metadata\n", source->display_name().c_str());
      continue;
    }

    string newname, oldname = source->display_name();;

    //if(oldname.find(".bam") == string::npos) {
    //  printf("[%s] :: already converted name\n", oldname.c_str());
    //  continue;
    //}

    //
    // now create pretty description from other metadata
    //
    boost::algorithm::replace_all(oldname, " ", "");
    char cptr[2] = " ";
    char *buffer = (char*)malloc(oldname.size() + 10);
    strcpy(buffer, oldname.c_str());
    for(unsigned i=0; i<oldname.size(); i++) {
      if(i>4 && isalpha(buffer[i]) && (buffer[i] == toupper(buffer[i]))) { newname += " "; }
      cptr[0] = buffer[i];
      newname.append(cptr);
    }
    free(buffer);
    boost::algorithm::replace_all(newname, ".bam", "");
    boost::algorithm::replace_all(newname, " Rna Seq", "RnaSeq");
    boost::algorithm::replace_all(newname, "wgEncode", "Encode");

    if(source->display_name() == newname) {
      printf("already converted name\n");
      continue;
    }

    //change it
    _objects.push_back(source);

    if(!_owner_openid.empty()) { source->owner_identity(_owner_openid); }

    printf("newname [%s]\n", newname.c_str());
    source->metadataset()->remove_metadata_like("eedb:display_name", "");
    source->metadataset()->add_tag_data("eedb:display_name", newname);
    source->display_name(newname);
    edit_count++;
    
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      //oscdb so need to collate peers to secondary save
      peers[uuid] = peer;
    } else {
      //older mysql/sqlite based source so can save right now
      if(_save_edits) { save_mdata_edits(source); }
    }
  }
  int object_count= _objects.size();
  
  
  map<string, EEDB::Peer* >::iterator peer;
  for(peer=peers.begin(); peer!=peers.end(); peer++) {
    EEDB::SPStreams::SourceStream *sourcestream = (*peer).second->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(_save_edits) { oscdb->save_xmldb(); }  //automatically upgrades if needed
    }
    if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
      if(_save_edits) { bamdb->save_xmldb(); }  //automatically upgrades if needed
    }
    //printf("%s", source->xml().c_str());
  }
  
  
  for(unsigned int j=0; j<_objects.size(); j++) {
    EEDB::DataSource *source = _objects[j];
    string xml_buffer;
    if(_parameters["format"]  == "fullxml") {
      source->xml(xml_buffer);
    } else if(_parameters["format"]  == "minxml") {
      printf("<object id=\"%s\"/>\n", source->db_id().c_str());    
    } else if(_parameters["format"]  == "descxml") {
      //if(source->classname() == EEDB::FeatureSource::class_name) { 
      //  ((EEDB::FeatureSource*)source)->desc_xml(xml_buffer);
      //}      
      //if(source->classname() == EEDB::Experiment::class_name) {
      //  ((EEDB::Experiment*)source)->desc_xml(xml_buffer);
      //}
      source->mdata_xml(xml_buffer, _desc_xml_tags);
    } else {
      source->simple_xml(xml_buffer);
    }
    //if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); }
  }
  
  printf("%ld searched objects\n", search_count);
  printf("%d total objects\n", object_count);
  printf("%d edited\n", edit_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


void create_encode_description() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();
  
  printf("\n====== create_encode_description == \n");
  gettimeofday(&starttime, NULL);
  
  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after parse webserver config %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  webservice->init_service_request();
  map<string,string>::iterator param;  
  for(param = _parameters.begin(); param != _parameters.end(); param++) {
    webservice->set_parameter((*param).first, (*param).second);
  }
  webservice->postprocess_parameters();
  gettimeofday(&endtime, NULL); timersub(&endtime, &starttime, &difftime);
  printf("  after postprocess_parameters %1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  
  stream = webservice->source_stream();
  
  _parameters["filter"] += " encode";
  printf("search filter [%s]\n", _parameters["filter"].c_str());

  stream->stream_data_sources("Experiment", _parameters["filter"]);

  long search_count=0;
  int edit_count=0;
  vector<EEDB::DataSource*> _objects;
  map<string, EEDB::Peer*>  peers;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    string uuid = source->peer_uuid();
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { continue; }

    search_count++;

    if(!source->metadataset()->has_metadata_like("enc:dataVersion","") || 
       !source->metadataset()->has_metadata_like("enc:datatype_dataGroup","") ||
       !source->metadataset()->has_metadata_like("enc:datatype_description","") ||
       !source->metadataset()->has_metadata_like("enc:datatype_label","")) {
      printf("[%s] :: MISSING encode metadata\n", source->display_name().c_str());
      continue;
    }

    _objects.push_back(source);
    
    if(!_owner_openid.empty()) {
      source->owner_identity(_owner_openid);
    }
    
    //
    // now create pretty description from other metadata
    //
    printf("[%s] :: ", source->display_name().c_str());
    //source->metadataset()->remove_metadata_like("description", "");
    //source->metadataset()->remove_metadata_like("eedb:description", "");
    
    string description;
    vector<EEDB::Metadata*> mdlist = source->metadataset()->metadata_list();
    for(unsigned int i=0; i<mdlist.size(); i++) {
      EEDB::Metadata *md = mdlist[i];
      if(md->type() == "keyword") { continue; }
      if(md->type() == "osc_header") { continue; }
      if(md->type() == "enc:grant_description") { continue; }
      if(md->type() == "description") { continue; }
      if(md->type() == "eedb:description") { continue; }
  
      if(md->type().find("desc") != string::npos) {
        //printf("  %s\n", md->xml().c_str());
        description += md->data() + ". ";
      }
    }
    if(source->description() == description) {
      printf("SAME description no change\n");
      continue;
    }

    //OK change it
    printf("new description [%s]\n", description.c_str());

    source->metadataset()->remove_metadata_like("description", "");
    source->metadataset()->remove_metadata_like("eedb:description", "");

    source->metadataset()->add_tag_data("description", description);
    edit_count++;
    
    if(source->classname() == EEDB::FeatureSource::class_name) {
      ((EEDB::FeatureSource*)source)->parse_metadata_into_attributes();
    }
    if(source->classname() == EEDB::Experiment::class_name) {
      ((EEDB::Experiment*)source)->parse_metadata_into_attributes();
    }
    
    
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      //oscdb so need to collate peers to secondary save
      peers[uuid] = peer;
    } else {
      //older mysql/sqlite based source so can save right now
      if(_save_edits) { save_mdata_edits(source); }
      printf("===SAVE EDITS\n");
    }
  }
  int object_count= _objects.size();
  
  
  map<string, EEDB::Peer* >::iterator peer;
  for(peer=peers.begin(); peer!=peers.end(); peer++) {
    EEDB::SPStreams::SourceStream *sourcestream = (*peer).second->source_stream();
    if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
      EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
      if(_save_edits) { oscdb->save_xmldb(); }  //automatically upgrades if needed
    }
    if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
      EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
      if(_save_edits) { bamdb->save_xmldb(); }  //automatically upgrades if needed
    }
    //printf("%s", source->xml().c_str());
  }
  
  
  for(unsigned int j=0; j<_objects.size(); j++) {
    EEDB::DataSource *source = _objects[j];
    string xml_buffer;
    if(_parameters["format"]  == "fullxml") {
      source->xml(xml_buffer);
    } else if(_parameters["format"]  == "minxml") {
      printf("<object id=\"%s\"/>\n", source->db_id().c_str());    
    } else if(_parameters["format"]  == "descxml") {
      //if(source->classname() == EEDB::FeatureSource::class_name) { 
      //  ((EEDB::FeatureSource*)source)->desc_xml(xml_buffer);
      //}      
      //if(source->classname() == EEDB::Experiment::class_name) {
      //  ((EEDB::Experiment*)source)->desc_xml(xml_buffer);
      //}
      source->mdata_xml(xml_buffer, _desc_xml_tags);
    } else {
      source->simple_xml(xml_buffer);
    }
    //if(!xml_buffer.empty()) { printf("%s\n", xml_buffer.c_str()); }
  }
  
  printf("%ld searched objects\n", search_count);
  printf("%d total objects\n", object_count);
  printf("%d edited\n", edit_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}


bool save_mdata_edits(MQDB::DBObject *obj) {
  //several if statements here
  //first is it an XMLdb database or a MQDB database
  //then what is the class and how do we record changes
  if(!obj) { return false; }
  
  string uuid = obj->peer_uuid();
  EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
  if(!peer) { return false; }
  
  if(!(peer->is_valid())) { return false; /*printf("not valid\n");*/ }
  EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
  if(sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) {
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;    
    if(oscdb->save_xmldb()) { return true; } //upgrades if needed
  }
  else if(sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name) {
    EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)sourcestream;
    if(_save_edits) { bamdb->save_xmldb(); }  //automatically upgrades if needed
  }
  else if(sourcestream->classname() == EEDB::SPStreams::SourceStream::class_name) {  
    if(obj->classname() == EEDB::Feature::class_name) {
      ((EEDB::Feature*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::FeatureSource::class_name) {
      ((EEDB::FeatureSource*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::EdgeSource::class_name) {
      //((EEDB::EdgeSource*)obj)->update_metadata();
    }
    if(obj->classname() == EEDB::Experiment::class_name) {
      ((EEDB::Experiment*)obj)->update_metadata();
    }
  }
  return true;
}

void test_oscdb_feature_mdata_index() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  gettimeofday(&starttime, NULL);

  printf("\n====== test_oscdb_feature_mdata_index == \n");
  gettimeofday(&starttime, NULL);

  webservice->parse_config_file("/var/www/html/zenbu/cgi/eedb_server_config.xml");
  webservice->init_service_request();

  //TODO: fake user login
  MQDB::Database *userdb = webservice->userDB();
  if(!_owner_openid.empty()) {
    EEDB::User *user = EEDB::User::fetch_by_openID(userdb, _owner_openid);
    fprintf(stderr, "%s\n", user->xml().c_str());
    webservice->set_user_profile(user);
  }

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
    EEDB::SPStream *sourcestream = ((EEDB::Peer*)obj)->source_stream();
    if(!sourcestream) { continue; }
    if(sourcestream->classname() != EEDB::SPStreams::OSCFileDB::class_name) { continue; }
    printf("%s\n", obj->xml().c_str());
    EEDB::SPStreams::OSCFileDB *oscdb = (EEDB::SPStreams::OSCFileDB*)sourcestream;
    oscdb->build_feature_md_index();
  }

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}



void test_user_merge() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  EEDB::WebServices::MetaSearch         *webservice = new EEDB::WebServices::MetaSearch();

  gettimeofday(&starttime, NULL);

  printf("\n====== test_user_merge == \n");
  gettimeofday(&starttime, NULL);

  webservice->parse_config_file("/zenbu/server_config/active_config.xml");
  webservice->init_service_request();

  //TODO: fake user login
  MQDB::Database *userDB = webservice->userDB();
  EEDB::User *user1 = EEDB::User::fetch_by_id(userDB, 161);
  EEDB::User *user2 = EEDB::User::fetch_by_id(userDB, 202);

  fprintf(stderr, "%s\n", user1->xml().c_str());
  fprintf(stderr, "%s\n", user2->xml().c_str());

  EEDB::User *user3 = EEDB::User::merge_user_profiles(user1, user2);
  fprintf(stderr, "%s\n", user3->xml().c_str());

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f sec \n", (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}

