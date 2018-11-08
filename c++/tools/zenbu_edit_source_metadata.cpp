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
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/WebServices/MetaSearch.h>
#include <EEDB/WebServices/UserSystem.h>

#include <math.h>
#include <sys/time.h>

using namespace std;
using namespace MQDB;

vector<EEDB::mdedit_t>    _mdata_edit_commands;
map<string,string>        _parameters;
bool                      _save_edits;
string                    _owner_identity;

void edit_source_metadata(EEDB::SPStream *stream);
void append_metadata_edit_command(string mode, string tag, string newvalue, string oldvalue);
void apply_mdata_edit_commands(EEDB::MetadataSet *mdset);
bool save_mdata_edits(MQDB::DBObject *obj);
void usage();

int main(int argc, char *argv[]) {
  _save_edits = false;
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
    if(arg == "-openid") { _owner_identity = argvals[0]; }
    if(arg == "-store")  { _save_edits=true; }
    if(arg == "-save")   { _save_edits=true; }
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
    if(arg == "-add") {
      string tag   = argvals[0];
      string value = argvals[1];
      append_metadata_edit_command("add", tag, value, "");
    }
    if(arg == "-delete") {
      string tag   = argvals[0];
      if(argvals.size() >=2) {
        string value = argvals[1];
        append_metadata_edit_command("delete", tag, value, "");
      } else {
        append_metadata_edit_command("delete", tag, "", "");
      }
    }
    if(arg == "-changeall") {
      string tag   = argvals[0];
      string value = argvals[1];
      append_metadata_edit_command("change", tag, value, "");
    }
    if(arg == "-change") {
      string tag   = argvals[0];
      string value = argvals[1];
      string oldvalue = argvals[2];
      append_metadata_edit_command("change", tag, value, oldvalue);
    }        
    if(arg == "-kw") {
      append_metadata_edit_command("extract_keywords", "keyword", " ", " ");
    }        
  }
  
  EEDB::SPStream *stream = NULL;

  if(_parameters.find("db_url") != _parameters.end()) {
    EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["db_url"]);
    if(!peer) {
      printf("\nERROR: unable to connect to peer [%s]!!\n\n", _parameters["db_url"].c_str());
      usage(); 
    }
    EEDB::Peer::add_to_cache(peer);
    stream = peer->source_stream();
  } else {
    EEDB::WebServices::MetaSearch  *webservice = new EEDB::WebServices::MetaSearch();
    webservice->parse_config_file("/etc/zenbu/zenbu.conf");
    webservice->init_service_request();
    map<string,string>::iterator param;  
    for(param = _parameters.begin(); param != _parameters.end(); param++) {
      webservice->set_parameter((*param).first, (*param).second);
    }
    webservice->postprocess_parameters();
    stream = webservice->source_stream();    
  }
  
  edit_source_metadata(stream);
  
  exit(1);
}


void usage() {
  printf("zenbu_edit_source_metadata [options]\n");
  printf("  #tool is for sysadmin server maintenance editing of metadata\n");
  printf("  #this will be deprecated in the future, since this functionality is now provided to users via zenbu_upload\n");
  printf("  -help                 : print this help\n");
  printf("  -url <url>            : URL to specific source database\n");
  printf("  -ids <id,..>          : list of fedID of Experiment/FeatureSource to edit\n");
  printf("  -peers <uuid,..>      : list of peer UUIDs to edit all sources of these peers\n");
  printf("  -search <phrase>      : search federation for sources matching search phrase\n");
  printf("  -show                 : display metadata of object after editing\n");
  printf("  -store                : store modifications back into database\n");
  printf("  -openid <value>       : change the owner openid for sources\n");
  printf("  -add <tag> <value>    : add metadata in specified sources. eg: -add eedb:display_name \"some description\"\n");
  printf("  -delete <tag>         : delete all metadata with <tag> in specified sources. eg: -delete \"eedb:display_name\"\n");
  printf("  -delete <tag> <value> : delete specific metadata with <tag> <value>\n");
  printf("  -kw                   : delete all keywords and perform new keyword extraction\n");
  printf("zenbu_edit_source_metadata v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  exit(1);  
}


void edit_source_metadata(EEDB::SPStream *stream) {
  struct timeval                        starttime,endtime,difftime;

  if(!stream) { return; }
  
  printf("\n====== edit_source_metadata == \n");
  gettimeofday(&starttime, NULL);
  
  long peer_count=0;
  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    peer_count++;
  }
  printf("%ld peers\n", peer_count);

  
  if(_parameters.find("filter") != _parameters.end()) {
    stream->stream_data_sources("", _parameters["filter"]);
  } else {
    stream->stream_data_sources("");
  }
  
  int edit_count=0;
  vector<EEDB::DataSource*> _objects;
  map<string, EEDB::Peer*>  peers;
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    string uuid = source->peer_uuid();
    //printf("[%s]\n", uuid.c_str());
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(!peer) { continue; }

    _objects.push_back(source);

    //if(!_owner_identity.empty()) { source->owner_openid(_owner_identity); }

    //now apply edits and collect peers for saving
    apply_mdata_edit_commands(source->metadataset());
    edit_count++;
    
    if(source->classname() == EEDB::FeatureSource::class_name) {
      ((EEDB::FeatureSource*)source)->parse_metadata_into_attributes();
    }
    if(source->classname() == EEDB::Experiment::class_name) {
      ((EEDB::Experiment*)source)->parse_metadata_into_attributes();
    }

    
    EEDB::SPStreams::SourceStream *sourcestream = peer->source_stream();
    if((sourcestream->classname() == EEDB::SPStreams::OSCFileDB::class_name) ||
       (sourcestream->classname() == EEDB::SPStreams::BAMDB::class_name)) {
      //oscdb bamdb need to collate peers to secondary save
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
      if(_save_edits) { 
        printf("save bamdb edits\n");
        bamdb->save_xmldb(); 
      }  //automatically upgrades if needed
    }
    //printf("%s", source->xml().c_str());
  }


  for(unsigned int j=0; j<_objects.size(); j++) {
    EEDB::DataSource *source = _objects[j];
    printf("%s", source->xml().c_str());
  }
  
  printf("%d total objects\n", object_count);
  printf("%d edited\n", edit_count);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%1.6f msec \n", (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
}

// -------------------------------------------------------------------

void append_metadata_edit_command(string mode, string tag, string newvalue, string oldvalue) {  
  //first get the source_ids which we will later use to configure FederatedSourceStream

  if(mode.empty()) { return; }
  if(tag.empty() and newvalue.empty()) { return; }
  
  EEDB::mdedit_t edit_cmd;
  edit_cmd.mode = mode;
  edit_cmd.tag  = tag;
  
  if(edit_cmd.mode == "change") {
    edit_cmd.oldvalue = oldvalue;
    edit_cmd.newvalue = newvalue;
  } else {
    edit_cmd.newvalue = newvalue;
  }
  
  //post filters to avoid bad commands
  if(edit_cmd.tag.empty()) { return; }
  if(edit_cmd.tag == "eedb:name") { return; }
  
  if(edit_cmd.tag == "eedb:assembly_name") { return; }
  if(edit_cmd.tag == "assembly_name") { return; }
  if(edit_cmd.tag == "genome_assembly") { return; }
  
  if(edit_cmd.tag == "uuid") { return; }
  if(edit_cmd.tag == "eedb:owner_nickname") { return; }
  if(edit_cmd.tag == "eedb:owner_OpenID") { return; }
  if(edit_cmd.tag == "configXML") { return; }
  if(edit_cmd.tag == "eedb:configXML") { return; }
  
  _mdata_edit_commands.push_back(edit_cmd);
}


void apply_mdata_edit_commands(EEDB::MetadataSet *mdset) {
  if(!mdset) { return; }
  EEDB::Metadata *md;
  
  vector<EEDB::mdedit_t>::iterator  mdedit;
  for(mdedit = _mdata_edit_commands.begin(); mdedit != _mdata_edit_commands.end(); mdedit++) {    
    fprintf(stderr, "mdedit +%s+ (%s) [%s] [%s]\n", mdedit->mode.c_str(), mdedit->tag.c_str(), mdedit->newvalue.c_str(), mdedit->oldvalue.c_str());
    
    if(mdedit->mode == "add") {
      if(EEDB::Symbol::is_symbol(mdedit->newvalue)) {
        mdset->add_tag_symbol(mdedit->tag, mdedit->newvalue);
      } else {
        EEDB::Metadata *md = mdset->add_tag_data(mdedit->tag, mdedit->newvalue);
        md->extract_keywords(mdset);
      }
    }
    
    if(mdedit->mode == "delete") {
      if(mdedit->newvalue.empty()) {
        mdset->remove_metadata_like(mdedit->tag, "");
      } else {
        md = mdset->find_metadata(mdedit->tag, mdedit->newvalue);
        if(md) { mdset->remove_metadata(md); }
      }
    }
    
    if(mdedit->mode == "change") {
      md = mdset->find_metadata(mdedit->tag, mdedit->newvalue);
      mdset->remove_metadata_like(mdedit->tag, mdedit->oldvalue);
      EEDB::Metadata *md = mdset->add_tag_data(mdedit->tag, mdedit->newvalue);
      md->extract_keywords(mdset);
    }
    if(mdedit->mode == "extract_keywords") {
      mdset->remove_metadata_like("keyword", "");
      mdset->extract_keywords();
    }
  }
  
  //maybe apply some general cleanup here for old tags  
  
  mdset->remove_duplicates();
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

/*************************************************************************/
 

/*
 
 no warnings 'redefine';
 $| = 1;
 
 my $self = {};
 
 my $help;
 my $passwd = '';
 my $store = 0;
 my $obj_id = undef;
 my $assembly = 'hg18';
 my $format = 'content';
 my $region_loc = undef;
 
 $self->{'starttime'} = time();
 $self->{'depth'} = 4;
 $self->{'debug'} = 1;
 
 my $url = $ENV{EEDB_REGISTRY};
 if(!$url) { $url = "mysql://read:read\@osc-mysql.gsc.riken.jp/eeDB_LSA_registry"; }
 
 GetOptions( 
 'id:s'         =>  \($self->{'ids'}),
 'ids:s'        =>  \($self->{'ids'}),
 'peers:s'      =>  \($self->{'peer_uuids'}),
 'depth:s'      =>  \($self->{'depth'}),
 'full'         =>  \($self->{'full_update'}),
 'search'       =>  \($self->{'search_filter'}),
 'add:s'        =>  \($self->{'add_metadata'}),
 'show'         =>  \($self->{'show'}),
 'delete_tag:s' =>  \($self->{'delete_metadata_tag'}),
 'debug:s'      =>  \($self->{'debug'}),
 'help'         =>  \$help,
 'store'        =>  \$store
 );
 
 if ($help) { usage(); }
 
 my $regPeer  = EEDB::Peer->fetch_self_from_url($url);
 my $regDB    = $regPeer->peer_database;
 $regPeer->display_info;
 
 unless($regDB) { 
 printf("ERROR: connecting to database\n\n");
 usage(); 
 }
 
 unless($self->{'add_metadata'} or $self->{'show'} or $self->{'delete_metadata'} or $self->{'delete_metadata_tag'}) {
 printf("ERROR: please specify add metadata edit option [-show -add -delete -delete_tag]\n\n");
 usage(); 
 }
 
 edit_metadata();
 
 exit(1);
 #########################################################################################
 
 sub edit_metadata {
 my $LSA = new EEDB::Tools::LSArchiveImport;
 $LSA->{'debug'} = $self->{'debug'};
 
 my $stream = new EEDB::SPStream::FederatedSourceStream;
 $stream->allow_full_federation_search(0); 
 $stream->add_seed_peers($regPeer);
 
 #if($self->{'full_update'}  || $self->{'search_filter'}) { 
 #  print("### stream ALL peers from federation\n");
 #  $stream->allow_full_federation_search(1); 
 #}
 #if($self->{'search_filter'}) { $stream->source_keyword_search($self->{'search_filter'}); }
 
 if($self->{'peer_uuids'}) {
 my @ids = split(/,/, $self->{'peer_uuids'});
 $stream->add_peer_ids(@ids);
 }
 if($self->{'ids'}) {
 my @ids = split(/,/, $self->{'ids'});
 $stream->add_source_ids(@ids);
 }
 
 $stream->stream_peers();
 my $count=0;
 while(my $p2 = $stream->next_in_stream) {
 #printf("%s", $p2->xml);
 $count++;
 }
 if($count ==0) { return undef; }
 
 printf("streamed %d peers\n", $count);
 
 $count=0;
 my $fail_count=0;
 my $stream_count=0;
 my %options;
 #$options{'class'} = "Experiment";
 $stream->stream_data_sources(%options);
 while(my $obj = $stream->next_in_stream) {
 if($obj->class eq "ExpressionDatatype") { next; }
 
 my $objDB = $obj->database;
 $objDB->disconnect();
 $objDB->user("zenbu_admin");
 $objDB->password("zenbu_admin");
 
 #next unless($obj->class eq "Experiment");
 $stream_count++;
 
 #TODO option to delete/replace not just append
 if(defined($self->{'delete_metadata_tag'})) {
 my $mds = $obj->metadataset->find_all_metadata_like($self->{'delete_metadata_tag'}, undef);
 foreach my $mdata (@$mds) {
 printf("deleting metadata : %s\n", $mdata->display_desc);
 if($store) { $mdata->unlink_from_object($obj); }
 $obj->metadataset->remove_metadata($mdata);
 }
 }
 
 
 if($self->{'add_metadata'}) {
 my $md_tag   = "keyword";
 my $md_value = $self->{'add_metadata'};
 if($self->{'add_metadata'} =~ /([\w:]+)\=(.+)/) {
 $md_tag   = $1;
 $md_value = $2;
 }
 printf("add metadata [%s] : [%s]\n", $md_tag, $md_value);
 my $md1 = $obj->metadataset->add_tag_data($md_tag, $md_value);
 $obj->metadataset->merge_metadataset($md1->extract_keywords);
 }
 
 if($self->{'show'}) { printf("%s\n", $obj->display_contents); }
 my $mdata_list = $obj->metadataset->metadata_list;
 foreach my $mdata (@$mdata_list) {
 if(!defined($mdata->primary_id)) { 
 if($self->{'debug'} > 2) { printf("  new metadata : %s\n", $mdata->display_desc); }
 }
 }
 
 if($store) {
 $obj->store_metadata;
 $obj->update;
 }
 $count++;
 }
 #if($count>0) { last; }
 
 printf("%d objects altered\n", $count);
 }
 */
