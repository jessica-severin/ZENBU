/*  $Id: TrackCache.cpp,v 1.82 2016/08/11 06:17:38 severin Exp $ */

/*******

NAME - EEDB::TrackCache

SYNOPSIS

DESCRIPTION

CONTACT

  Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * ZENBU [EEDB] system
 * copyright (c) 2007-2013 Jessica Severin RIKEN OSC
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin RIKEN OSC nor the
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

******/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <sys/stat.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <rapidxml_print.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/TrackCache.h>
#include <EEDB/TrackRequest.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/Chrom.h>
#include <sqlite3.h>
#include <stdarg.h>

using namespace std;
using namespace MQDB;


//////////////////////////////////////////////////////////////////////////////////////

const char*  EEDB::TrackCache::class_name = "EEDB::TrackCache";
string       EEDB::TrackCache::cache_dir;

void _eedb_track_cache_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::TrackCache*)obj;
}
void _eedb_track_cache_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::TrackCache*)obj)->_xml(xml_buffer);
}
void _eedb_track_cache_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::TrackCache*)obj)->_simple_xml(xml_buffer);
}
string _eedb_track_cache_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::TrackCache*)obj)->_display_desc();
}

EEDB::TrackCache::TrackCache() {
  init();
}

EEDB::TrackCache::~TrackCache() {
}


void EEDB::TrackCache::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::TrackCache::class_name;
  
  _funcptr_delete            = _eedb_track_cache_delete_func;
  _funcptr_display_desc      = _eedb_track_cache_display_desc_func;
  _funcptr_xml               = _eedb_track_cache_xml_func;
  _funcptr_simple_xml        = _eedb_track_cache_simple_xml_func;
  _metadata_loaded           = false;
  _last_access = 0;
  _hit_count = 1;
  _percent_complete = 0.0;
  _broken = false;
  _seg_buildtime = 1.0;
  _zdxstream = NULL;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////


EEDB::MetadataSet*   EEDB::TrackCache::metadataset() {
  if(!_metadata_loaded) {
    _metadata_loaded = true;
    if(_database != NULL) {      
      vector<DBObject*> mdata = EEDB::Metadata::fetch_all_by_track_cache_id(_database, _primary_db_id);
      _metadataset.add_metadata(mdata);
    }
    //$self->{'metadataset'}->remove_duplicates;
  }
  return &_metadataset;
}

string    EEDB::TrackCache::last_access_date_string() { 
  string str;
  if(_last_access>0) {
    time_t t_update = _last_access;
    char *ct_value = ctime(&t_update);
    if(ct_value != NULL) {
      int len = strlen(ct_value);
      if(len>0) {
        ct_value[len-1] = '\0';
        str = ct_value;
      }
    }
  }
  return str;
}


void  EEDB::TrackCache::track_configxml(string configXML) {
  if(configXML.empty()) { return; }
  metadataset()->add_tag_data("configXML", configXML);
  _track_hashkey   = MQDB::sha256(configXML);
}

string  EEDB::TrackCache::track_configxml() {
  EEDB::Metadata *configXML = metadataset()->find_metadata("configXML", "");
  if(configXML) { return configXML->data(); }
  return "";
}


////////////////////////////////////////////////////////////////



string EEDB::TrackCache::_display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "TrackCache(db %ld ) %s", 
    _primary_db_id, 
    last_access_date_string().c_str());
  return buffer;
}


void EEDB::TrackCache::_xml(string &xml_buffer) {
  char buffer[2048];

  xml_buffer.append("<track_cache hashkey=\"" + _track_hashkey +"\" ");
  xml_buffer.append("last_access=\"" + last_access_date_string() +"\" ");
  
  snprintf(buffer, 2040, "hit_count=\"%ld\" ", _hit_count);
  xml_buffer.append(buffer);
  
  snprintf(buffer, 2040, "percent_complete=\"%1.3f\" ", _percent_complete);
  xml_buffer.append(buffer);

  xml_buffer.append(">");

  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }
  
  xml_buffer.append("</track_cache>\n");
}


void EEDB::TrackCache::_simple_xml(string &xml_buffer) {
  char buffer[2048];
  
  xml_buffer.append("<track_cache hashkey=\"" + _track_hashkey +"\" ");
  xml_buffer.append("last_access=\"" + last_access_date_string() +"\" ");
  
  snprintf(buffer, 2040, "hit_count=\"%ld\" ", _hit_count);
  xml_buffer.append(buffer);
  
  snprintf(buffer, 2040, "percent_complete=\"%1.3f\" ", _percent_complete);
  xml_buffer.append(buffer);
  
  xml_buffer.append(">");
  xml_buffer.append("</track_cache>\n");
}


EEDB::TrackCache::TrackCache(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node, *node2;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "track_cache") { return; }
  
  if((attr = root_node->first_attribute("hashkey")))      { _track_hashkey = attr->value(); }
    
  if((attr = root_node->first_attribute("last_access"))) {
    string date_string = attr->value();
    _last_access = MQDB::seconds_from_epoch(date_string);
  }
  
  if((attr = root_node->first_attribute("hit_count"))) {
    _hit_count = strtol(attr->value(), NULL, 10); 
  }
  if((attr = root_node->first_attribute("percent_complete"))) {
    _percent_complete = strtod(attr->value(), NULL);; 
  }
  
  //
  // metadata
  //
  metadataset();
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
      if(mdata->type() == "configXML") {
        node2 = node->first_node(); 
        // Print to string using output iterator
        string buffer;
        rapidxml::print(back_inserter(buffer), *node2, 0);
        mdata->release();
        mdata = new EEDB::Metadata("configXML", buffer);
      }
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("mdata");
    }    
  }
  if((node = root_node->first_node("symbol")) != NULL) {
    while(node) {
      EEDB::Symbol *mdata = new EEDB::Symbol(node);
      _metadataset.add_metadata(mdata);
      node = node->next_sibling("symbol");
    }    
  }
  _metadata_loaded = true;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// class level MQDB style fetch methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


void  EEDB::TrackCache::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id      = row_map["track_cache_id"].i_int;
  _track_hashkey      = row_map["hashkey"].i_string;
  _remote_server_url  = row_map["remote_url"].i_string;
  _hit_count          = row_map["hit_count"].i_int;
  _percent_complete   = row_map["percent_complete"].i_double;
  _cache_file         = row_map["cache_file"].i_string;
  _seg_buildtime      = row_map["seg_buildtime"].i_double;

  if(row_map["broken"].i_string == string("y"))  { _broken=true;} else { _broken=false; }

  if(row_map["last_access"].type == MQDB::STRING) {
    string date_string = row_map["last_access"].i_string;
    _last_access = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["last_access"].type == MQDB::TIMESTAMP) {
    _last_access = row_map["last_access"].i_timestamp;
  }
}


EEDB::TrackCache*  EEDB::TrackCache::fetch_by_id(MQDB::Database *db, long int id) {  
  const char *sql = "SELECT * FROM track_cache WHERE track_cache_id=?";
  return (EEDB::TrackCache*) MQDB::fetch_single(EEDB::TrackCache::create, db, sql, "d", id);
}


EEDB::TrackCache*  EEDB::TrackCache::fetch_by_hashkey(MQDB::Database *db, string hashkey) {
  const char *sql = "SELECT * FROM track_cache WHERE hashkey=?";
  EEDB::TrackCache *track_cache = (EEDB::TrackCache*) MQDB::fetch_single(EEDB::TrackCache::create, db, sql, "s", hashkey.c_str());
  return track_cache;
}


vector<DBObject*>  EEDB::TrackCache::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM track_cache";
  return MQDB::fetch_multiple(EEDB::TrackCache::create, db, sql, "");
}


bool  EEDB::TrackCache::log_location(EEDB::User *user, string asmb, string chrom, long start, long end) {
  if(_database==NULL) { return false; }
  const char *sql = "UPDATE track_cache SET hit_count=hit_count+1 where track_cache_id=?";
  _database->do_sql(sql, "d", _primary_db_id);
  
  long user_id = -1;
  if(user) { user_id = user->primary_id(); }
  sql = "INSERT INTO track_cache_history (track_cache_id,user_id,assembly,chrom,start,end) VALUES(?,?,?,?,?,?)";
  _database->do_sql(sql, "ddssdd", _primary_db_id, user_id, asmb.c_str(), chrom.c_str(), start, end);
  return true;
}


string  EEDB::TrackCache::best_build_hashkey(MQDB::Database *db) {
  //part of the auto-building machinery. This operation picks a track_cache from the database based on a combination of
  //track_request and then falling back to 'unbuilt but accessed recently'
  if(db==NULL) { return ""; }

  //first check the TrackRequests for pending requests
  string hashkey = EEDB::TrackRequest::best_build_hashkey(db);
  if(!hashkey.empty()) { return hashkey; }

  //otherwise pick a random track cache to build if no requests are pending
  /*
  const char *sql = "SELECT hashkey FROM track_cache WHERE broken!='y' AND percent_complete!=100 \
                     AND ((percent_complete>33 and seg_buildtime<3 and hit_count>10) or \
                          (percent_complete>95 and seg_buildtime<7) or \
                          (seg_buildtime<1 and seg_buildtime>0 and hit_count>100)) \
                     ORDER BY seg_buildtime*rand() asc limit 1";
  dynadata value = db->fetch_col_value(sql, "");
  if(value.type == MQDB::STRING) { return value.i_string; }
  */
  //for now disable the background build of unrequested tracks 2.8.2
  
  return "";
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// MappedQuery storage methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::TrackCache::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  db->do_sql("INSERT ignore INTO track_cache(hashkey,remote_url) VALUES(?,?)", "ss", _track_hashkey.c_str(), _remote_server_url.c_str());
  
  if(db->last_insert_id() < 0) { return false; }
  
  _primary_db_id = db->last_insert_id();
  database(db);
  _peer_uuid = NULL;
  _db_id.clear();
  
  //now do the symbols and metadata  
  return store_metadata();
}


bool EEDB::TrackCache::store_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  vector<EEDB::Metadata*> mdlist = metadataset()->metadata_list();
  for(unsigned int i=0; i<mdlist.size(); i++) {
    EEDB::Metadata *md = mdlist[i];
    if(md->classname() == EEDB::Metadata::class_name) {
      if(!md->check_exists_db(db)) { md->store(db); }
      md->store_link_to_track_cache(this);
    }
  }
  return true;
}


bool EEDB::TrackCache::update_metadata() {
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();
  
  //unlink all old metadata
  db->do_sql("DELETE FROM track_cache_2_metadata WHERE track_cache_id=?", "d", primary_id());
  
  //store again
  store_metadata();
  return true;
}


bool  EEDB::TrackCache::update_buildstats(long numsegsbuilt, double buildtime) {
  //input is number of segments just completed and total time to build them
  
  if(database() == NULL) { return false; }
  if(primary_id() == -1) { return false; }
  
  MQDB::Database *db = database();

  zdxstream();
  if(!_zdxstream) { return false; }  
  ZDXdb* zdxdb = _zdxstream->zdxdb();  

  //fprintf(stderr, "update_buildstats  %ld segs in %1.3f sec [%1.2f]\n", numsegsbuilt, buildtime, buildtime/numsegsbuilt);
  
  _percent_complete = EEDB::ZDX::ZDXsegment::calc_percent_completed(zdxdb, false) * 100.0;
  
  long numsegs, numbuilt, numclaimed, seg_start;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, "", "", -1, -1, numsegs, numbuilt, numclaimed, seg_start);

  dynadata value = db->fetch_col_value("SELECT seg_buildtime FROM track_cache WHERE track_cache_id=?", "d", _primary_db_id);
  if(value.type == MQDB::DOUBLE) { _seg_buildtime = value.i_double; }

  long old_built= numbuilt-numsegsbuilt;
  if(old_built<0) { old_built=0; }

  double total_time = _seg_buildtime * old_built;
  total_time += buildtime;
  if(total_time>0 and numbuilt>0) { _seg_buildtime = total_time / numbuilt; }
  fprintf(stderr, "update_buildstats [%s] %1.3f%% seg_buildtime %1.3f sec\n", _track_hashkey.c_str(), _percent_complete, _seg_buildtime);
    
  const char *sql = "UPDATE track_cache SET percent_complete=?, seg_buildtime=? WHERE track_cache_id=?";
  db->do_sql(sql, "ffd", _percent_complete, _seg_buildtime, primary_id());
  
  //update or remove build requests depending on build progress
  vector<DBObject*> requests = EEDB::TrackRequest::fetch_all(this);
  for(unsigned i=0; i<requests.size(); i++) {
    EEDB::TrackRequest *request = (EEDB::TrackRequest*)requests[i];
    long numsegs, numbuilt, numclaimed;
    EEDB::ZDX::ZDXsegment::build_stats(zdxdb, request->assembly_name(), request->chrom_name(), 
                                       request->chrom_start(), request->chrom_end(),
                                       numsegs, numbuilt, numclaimed, seg_start);
    long unbuilt = numsegs-numbuilt-numclaimed;
    if(request->user_id() == -1 && unbuilt==0) { request->delete_from_db(); } 
    else { request->update_unbuilt(unbuilt); }
  }
  
  return true;
}


void  EEDB::TrackCache::update_broken(bool value) {
  if(database() == NULL) { return; }
  if(primary_id() == -1) { return; }
  
  _broken = value;
  MQDB::Database *db = database();
  const char* brk = " ";
  if(_broken) { brk = "y"; }
  
  db->do_sql("UPDATE track_cache SET broken=? WHERE track_cache_id=?", "sd", brk, primary_id());
}


void  EEDB::TrackCache::update_remote_url(string url) {
  if(database() == NULL) { return; }
  if(primary_id() == -1) { return; }
  
  _remote_server_url = url;
  MQDB::Database *db = database();
  
  db->do_sql("UPDATE track_cache SET remote_url=? WHERE track_cache_id=?", "sd", _remote_server_url.c_str(), primary_id());
}

/*********************************************************************
 *
 * cache database manipulation
 *
 */


bool  EEDB::TrackCache::cache_file_exists() {
  if(_cache_file.empty()) { return false; }
  
  struct stat statbuf;
  if(stat(_cache_file.c_str(), &statbuf) != 0) {
    //does not exist
    return false;
  }
  return true;  
}


EEDB::ZDX::ZDXstream*  EEDB::TrackCache::zdxstream() {
  if(_zdxstream) { return _zdxstream;}
  
  if(!_cache_file.empty()) {
    _zdxstream = EEDB::ZDX::ZDXstream::open(_cache_file);
    if(_zdxstream) { return _zdxstream; }
  }
  
  //_cache_file not defined or not pointing at a valid ZDX file/db
  _cache_file.clear();
  _zdxstream = NULL;

  if(database() == NULL) { return NULL; }
  if(primary_id() == -1) { return NULL; }
  if(_track_hashkey.empty()) { return NULL; }
  
  string configXML = track_configxml();
  if(configXML.empty()) { return NULL; }

  //create dir/path to ZDX for this trackcache
  char buffer[2048];
  snprintf(buffer, 2040, "/trackcache_%ld", ((long)floor(_primary_db_id/1000))*1000);
  string tdir = EEDB::TrackCache::cache_dir + buffer;
  if(mkdir(tdir.c_str(), 0775)== -1) {
    if(errno != EEXIST) { return NULL; }  //already existing is OK, otherwise error
  }
  snprintf(buffer, 2040, "/ztc_%ld.zdx", _primary_db_id);
  string path = tdir + buffer;
  
  //fprintf(stderr, "create new track cache [%s]\n", path.c_str());
  _cache_file = path;
  
  MQDB::Database *db = database();  
  const char *sql = "UPDATE track_cache SET cache_file=? WHERE track_cache_id=?";
  db->do_sql(sql, "sd", _cache_file.c_str(), primary_id());


  _zdxstream = EEDB::ZDX::ZDXstream::create_new(_cache_file);
  return _zdxstream;  
}


EEDB::ZDX::ZDXsegment*  EEDB::TrackCache::request_build_segment(string assembly_name, string chrom_name, long start, long end) {
  //smart method which finds an unbuilt segment region
  //fprintf(stderr, "request_build_segment\n");
  
  zdxstream();
  if(!_zdxstream) { return NULL; }
  
  ZDXdb* zdxdb = _zdxstream->zdxdb();  

  // mode0 direct request
  if(!chrom_name.empty()) {
    EEDB::ZDX::ZDXsegment *zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, assembly_name, chrom_name, start, end);
    return zseg;
  }
  
  //
  // mode1 smart checking of track_request
  //
  EEDB::TrackRequest *request = EEDB::TrackRequest::fetch_best(this);
  if(request) {
    EEDB::ZDX::ZDXsegment *zseg = EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, request->assembly_name(), request->chrom_name(), request->chrom_start(), request->chrom_end());
    if(zseg) { return zseg; }
  }  
  
  //
  // mode2 smart checking of track_cache_history
  //
  // TODO:
  
  //
  // mode3 random chrom/pos
  //
  //return EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, assembly_name, chrom_name, start, end);
  return EEDB::ZDX::ZDXsegment::unbuilt_segment(zdxdb, assembly_name, chrom_name, 1, -1);
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// Remote sync methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


bool  EEDB::TrackCache::is_remote() {
  if(!_remote_server_url.empty()) { return true; }
  return false;
}


bool  EEDB::TrackCache::remote_sync_segment(string assembly, string chrom_name, long chrom_pos, EEDB::User* user) {
  if(_remote_server_url.empty()) { return false; }
  zdxstream();
  if(!_zdxstream) { return false; }  
  ZDXdb* zdxdb = _zdxstream->zdxdb();  
  if(!zdxdb) { return false; }
  
  EEDB::ZDX::ZDXsegment* zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, assembly, chrom_name, chrom_pos);
  if(!zseg) { return false; }
  if(zseg->is_built()) { return true; }

  if(!zseg->claim_segment()) { return false; }

  return remote_sync_segment(zseg, user);
}


bool  EEDB::TrackCache::remote_sync_segment(EEDB::ZDX::ZDXsegment* zseg, EEDB::User* user) {
  if(!zseg) { return false; }
  //fprintf(stderr, "EEDB::TrackCache::remote_sync_segment %s\n", zseg->xml().c_str());
  if(!zseg->is_claimed()) { return false; }
  
  string  assembly   = zseg->assembly_name();
  string  chrom_name = zseg->chrom_name();
  long    chrom_pos  = zseg->chrom_start();
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  //http://f5-gb.gsc.riken.jp/zenbudev/cgi/eedb_region.cgi?mode=sendzdx;trackcache=bbbedb74b619efd43f84584dd475aa4a84fbbfd8d361bc064e95d3e57cf71a;asm=hg19;chrom_name=chr5;chrom_start=137800224
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(user) {
    paramXML += "<authenticate><email>"+ user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  paramXML += "<mode>sendzdx</mode>";
  paramXML += "<trackcache>"+ track_hashkey() +"</trackcache>";  
  paramXML += "<asm>"+ assembly +"</asm>";  
  paramXML += "<chrom_name>"+ chrom_name +"</chrom_name>";  
  char buffer[2048];
  snprintf(buffer, 2040,"<chrom_start>%ld</chrom_start>", chrom_pos);
  paramXML += buffer;
  snprintf(buffer, 2040,"<chrom_end>%ld</chrom_end>", chrom_pos);
  paramXML += buffer;  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _remote_server_url + "/cgi/eedb_region.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(user) {
    string key = user->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //parse the returned blob into zsegment znodes
  bool rtn = zseg->binary_sync_receive(chunk.memory, chunk.size);
  free(chunk.memory);
  return rtn;
}

  
bool  EEDB::TrackCache::remote_sync_region(string assembly_name, string chrom_name, long int start, long int end, EEDB::User* user) {    
  if(_remote_server_url.empty()) { return false; }
  zdxstream();
  if(!_zdxstream) { return false; }  
  ZDXdb* zdxdb = _zdxstream->zdxdb();  
  if(!zdxdb) { return false; }
  
  //First check if region is already built
  long numsegs, numbuilt, numclaimed, unbuilt, seg_start;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, chrom_name, start, end,
                                     numsegs, numbuilt, numclaimed, seg_start);
  if(numbuilt == numsegs) { 
    //fprintf(stderr, "TrackCache::remote_sync_region already synced\n");
    return true;
  }
  
  //
  // Start with a single eedb_region.cgi "build_request" query which will create remote track cache if needed, 
  // makes sure that it will build if it is not ready, and sends back build_status of the region
  //
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string paramXML = "<zenbu_query>";
  if(user) {
    paramXML += "<authenticate><email>"+ user->email_identity() +"</email>";
    struct timeval  expiretime;
    gettimeofday(&expiretime, NULL); //set to 5min in the future
    long  value = expiretime.tv_sec+300;
    paramXML += "<expires>" +l_to_string(value) + "</expires>";
    paramXML += "</authenticate>";
  }
  
  //paramXML += "<mode>request_build</mode>";
  paramXML += "<mode>trackcache_stats</mode>";
  paramXML += "<anonymous>true</anonymous>";
  paramXML += "<format>xml</format>";
  
  paramXML += "<trackcache>"+ _track_hashkey +"</trackcache>\n";
  
  paramXML += "<asm>"+assembly_name+"</asm>";
  paramXML += "<chrom>"+chrom_name+"</chrom>";
  paramXML += "<chrom_start>"+l_to_string(start)+"</chrom_start>";
  paramXML += "<chrom_end>"+l_to_string(end)+"</chrom_end>";
  
  paramXML += "</zenbu_query>";  
  //fprintf(stderr, "POST: %s\n", paramXML.c_str());
  
  string url = _remote_server_url + "/cgi/eedb_region.cgi";  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str()); 
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length()); 
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(user) {
    string key = user->hmac_secretkey();
    unsigned int md_len;
    unsigned char* result = HMAC(EVP_sha256(), 
                                 (const unsigned char*)key.c_str(), key.length(), 
                                 (const unsigned char*)paramXML.c_str(), paramXML.length(), NULL, &md_len);
    static char res_hexstring[64]; //expect 32 so this is safe
    bzero(res_hexstring, 64);
    for(unsigned i = 0; i < md_len; i++) { sprintf(&(res_hexstring[i * 2]), "%02x", result[i]); }
    
    string credentials = string("x-zenbu-magic: ") + res_hexstring;
    slist = curl_slist_append(slist, credentials.c_str());
  }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist); 
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl); 
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); 
  
  //
  // parse the results
  //
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<region");
  if(!start_ptr) { free(chunk.memory); return false; } 
    
  rapidxml::xml_document<>   doc;
  rapidxml::xml_node<>       *root_node, *node;
  rapidxml::xml_attribute<>  *attr;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
    
  //check that it is build and ready for streaming or ZDX sync
  numsegs=0; numbuilt=0; numclaimed=0; unbuilt=0;
  node = root_node->first_node("build_stats");
  if(node) {
    if((attr = node->first_attribute("numsegs"))) {
      numsegs = strtol(attr->value(), NULL, 10); 
    }
    if((attr = node->first_attribute("built"))) {
      numbuilt = strtol(attr->value(), NULL, 10); 
    }
    if((attr = node->first_attribute("claimed"))) {
      numclaimed = strtol(attr->value(), NULL, 10); 
    }
    if((attr = node->first_attribute("unbuilt"))) {
      unbuilt = strtol(attr->value(), NULL, 10); 
    }
    if((attr = node->first_attribute("seg_start"))) {
      start = strtol(attr->value(), NULL, 10); 
    }
  }  
  //cleanup xml parsing
  free(chunk.memory);
  doc.clear();

  fprintf(stderr, "remote trackcache stats [%s] n=%ld b=%ld c=%ld u=%ld\n", _track_hashkey.c_str(), numsegs,numbuilt,numclaimed,unbuilt);
  if(numsegs<=0 || (numsegs!=numbuilt) || (unbuilt>0)) {
    fprintf(stderr, "TrackCache::remote_sync_region -- remote track cache not built, can not sync at this time\n");	     
    return false;
  } else {
    //fprintf(stderr, "TrackCache::remote_sync_region -- YEAH track cache is ready for remote sync\n");	     
  }
  
  //
  // loop through the zsegments for this region and make sure they are syncronized
  //
  if(start < 1) { start = 1; }
  
  bool rtn_ok = true;
  EEDB::ZDX::ZDXsegment *zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, assembly_name, chrom_name, start);
  if(!zseg) { 
    fprintf(stderr, "error fetching zsegment %s %s %ld\n", assembly_name.c_str(), chrom_name.c_str(), start);
    rtn_ok = false;
  }
  
  while(zseg) {
    if((end>0) and (zseg->chrom_start()>end)) { 
      zseg->release();
      zseg = NULL;
      break;
    }
    
    if(!zseg->is_built()) {
      if(zseg->claim_segment()) {
        if(!remote_sync_segment(zseg, user)) {
          fprintf(stderr, "ERROR: could not sync segment of remote track cache\n");
          rtn_ok = false;
          zseg->clear_claim();
        }
      }
    }
    
    EEDB::ZDX::ZDXsegment *t_zseg = zseg->next_segment();
    zseg->release();
    zseg = t_zseg;
  }
  
  return rtn_ok;
}




