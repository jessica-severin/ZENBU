/*  $Id: Assembly.cpp,v 1.61 2017/02/09 07:37:53 severin Exp $ */

/*******

NAME - EEDB::Assembly

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
#include <strings.h>
#include <string>
#include <stdarg.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/Assembly.h>
#include <EEDB/Chrom.h>
#include <sqlite3.h>
#include <EEDB/SPStreams/RemoteServerStream.h>  //for curl


using namespace std;
using namespace MQDB;

size_t rss_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp);

const char*  EEDB::Taxon::class_name = "Taxon";
const char*  EEDB::Assembly::class_name = "Assembly";
map<long, EEDB::Taxon*>  EEDB::Taxon::global_ncbi_taxonid_cache;
map<string, EEDB::Assembly*>  EEDB::Assembly::_global_assembly_cache;

void _eedb_taxon_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) {
  ((EEDB::Taxon*)obj)->_xml(xml_buffer);
}
void _eedb_taxon_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::Taxon*)obj;
}

void _eedb_assembly_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::Assembly*)obj;
}
void _eedb_assembly_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Assembly*)obj)->_xml(xml_buffer);
}
void _eedb_assembly_simple_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Assembly*)obj)->_simple_xml(xml_buffer);
}
void _eedb_assembly_mdata_xml_func(MQDB::DBObject *obj, string &xml_buffer, map<string,bool> tags) {
  ((EEDB::Assembly*)obj)->_mdata_xml(xml_buffer, tags);
}
string _eedb_assembly_display_desc_func(MQDB::DBObject *obj) {
  return ((EEDB::Assembly*)obj)->_display_desc();
}

EEDB::Taxon::Taxon() {
  init();
}

EEDB::Taxon::~Taxon() {
  if(_database) {
    _database->release();
    _database = NULL;
  }
}

void EEDB::Taxon::init() {
  EEDB::DataSource::init();
  _classname                 = EEDB::Taxon::class_name;
  _funcptr_delete            = _eedb_taxon_delete_func;
  _funcptr_xml               = _eedb_taxon_simple_xml_func;
  _funcptr_simple_xml        = _eedb_taxon_simple_xml_func;
  _taxon_id                  = -1;
}
void  EEDB::Taxon::taxon_id(int id) {
  _taxon_id = id;
  _xml_cache.clear();
}
string  EEDB::Taxon::genus() {
  return _genus;
}
string  EEDB::Taxon::species() {
  return _species;
}
string  EEDB::Taxon::common_name() {
  return _common_name;
}
string  EEDB::Taxon::classification() {
  return _classification;
}
void EEDB::Taxon::_xml(string &xml_buffer) {
  char buffer[2048];
  
  snprintf(buffer, 2040, "<taxon taxon_id=\"%d\" ", taxon_id());
  xml_buffer = buffer;
  
  if(!_genus.empty()) { xml_buffer +="genus=\""+_genus+"\" "; }
  if(!_species.empty()) { xml_buffer +="species=\""+_species+"\" "; }
  if(!_common_name.empty()) { xml_buffer +="common_name=\""+_common_name+"\" "; }
  if(!_classification.empty()) { xml_buffer +="classification=\""+_classification+"\" "; }
  xml_buffer.append(">");
  
  EEDB::MetadataSet *mdset = metadataset();
  if(mdset!=NULL) { mdset->xml(xml_buffer); }
  
  xml_buffer.append("</taxon>\n");
}

bool EEDB::Taxon::fetch_NCBI_taxonomy_info() {
  if(_taxon_id<0) { return false; }
  
  if(global_ncbi_taxonid_cache.find(_taxon_id) != global_ncbi_taxonid_cache.end()) {
    EEDB::Taxon *taxon = global_ncbi_taxonid_cache[_taxon_id];
    _genus = taxon->genus();
    _species = taxon->species();
    _classification = taxon->classification();
    _common_name = taxon->common_name();
    return true;
  }
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return false; }
  
  struct RSS_curl_buffer  chunk;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  string url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=taxonomy&retmode=xml&id="+l_to_string(_taxon_id);
  fprintf(stderr, "POST [%s]\n", url.c_str());
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  //curl_easy_setopt(curl, CURLOPT_POSTFIELDS, paramXML.c_str());
  //curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, paramXML.length());
  
  struct curl_slist *slist = NULL;
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl);
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<TaxaSet");
  if(!start_ptr) { free(chunk.memory); return false; }
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; }
  
  rapidxml::xml_node<> *taxnode = root_node->first_node("Taxon");
  if(!taxnode) { return false; }
  
  rapidxml::xml_node<> *node = taxnode->first_node("TaxId");
  long txid = strtol(node->value(),NULL, 10);
  if(txid != _taxon_id) {
    //fprintf(stderr, "taxon_id does not match\n");
    return false;
  }
  
  EEDB::Taxon *taxon = new EEDB::Taxon();
  taxon->taxon_id(_taxon_id);

  node = taxnode->first_node("ScientificName");
  if(node && node->value()) {
    //printf("ScientificName [%s]\n", node->value());
    string gs = node->value();
    size_t strpos = gs.find(" ");
    if(strpos!=string::npos) {
      taxon->_genus = gs.substr(0,strpos);
      while(gs[strpos] == ' ') {strpos++; }
      taxon->_species = gs.substr(strpos);
    } else { return false; }
  } else { return false; }
  
  node = taxnode->first_node("Lineage");
  if(node && node->value()) {
    taxon->_classification = node->value();
    //printf("Lineage [%s]\n", node->value());
  }
  
  rapidxml::xml_node<> *node2 = taxnode->first_node("OtherNames");
  if(node2) {
    node = node2->first_node("GenbankCommonName");
    if(node && node->value()) {
      taxon->_common_name = node->value();
      //printf("GenbankCommonName [%s]\n", node->value());
    }
    node = node2->first_node("CommonName");
    if(node && node->value()) {
      //printf("CommonName [%s]\n", node->value());
    }
  }
  
  free(chunk.memory);
  _xml_cache.clear();
  
  _genus = taxon->genus();
  _species = taxon->species();
  _classification = taxon->classification();
  _common_name = taxon->common_name();
  global_ncbi_taxonid_cache[_taxon_id] = taxon;

  return true;
}


//==========================================================================


EEDB::Assembly::Assembly() {
  init();
}

EEDB::Assembly::~Assembly() {
  if(_database) {
    _database->release();
    _database = NULL;
  }  
}

void EEDB::Assembly::init() {
  MQDB::MappedQuery::init();
  _classname                 = EEDB::Assembly::class_name;
  _funcptr_delete            = _eedb_assembly_delete_func;
  _funcptr_display_desc      = _eedb_assembly_display_desc_func;
  _funcptr_xml               = _eedb_assembly_xml_func;
  _funcptr_simple_xml        = _eedb_assembly_simple_xml_func;
  _funcptr_mdata_xml         = _eedb_assembly_mdata_xml_func;
  _taxon_id                  = -1;
  _release_date              = 0;
  _sequence_loaded           = false;
  _last_chrom                = NULL;
}


////////////////////////////////////////////////////
//
// getter/setter methods of data which is stored in database
//
////////////////////////////////////////////////////


string  EEDB::Assembly::assembly_name() {
  if(!_assembly_name.empty()) { return _assembly_name; }
  if(!_ucsc_name.empty()) { return _ucsc_name; }
  if(!_ncbi_name.empty()) { return _ncbi_name; }
  return "";
}

string  EEDB::Assembly::release_date_string() { 
  string str;
  if(_release_date>0) {
    time_t t_update = _release_date;
    struct tm  *t_tm = localtime(&t_update);

    char buff[50] = {0};
    strftime(buff,50,"%Y-%b-%d",t_tm);
    str = buff;
    /*
    char *ct_value = ctime(&t_update);
    if(ct_value != NULL) {
      int len = strlen(ct_value);
      if(len>0) {
        ct_value[len-1] = '\0';
        str = ct_value;
      }
    }
    */
  }
  return str;
}

/*
string  EEDB::Assembly::genus() {
  return _genus;
} 
string  EEDB::Assembly::species() {
  return _species;
} 
string  EEDB::Assembly::common_name() {
  return _common_name;
} 
*/

// set methods

void  EEDB::Assembly::assembly_name(string value) {
  _assembly_name = value;
  _xml_cache.clear();
} 

/*
void  EEDB::Assembly::taxon_id(int id) {
  _taxon_id = id;
  _xml_cache.clear();
}
*/

void  EEDB::Assembly::ncbi_version(string value) {
  _ncbi_name = value;
  _xml_cache.clear();
}

void  EEDB::Assembly::ncbi_assembly_accession(string value) {
  _ncbi_assembly_acc = value;
  _xml_cache.clear();
}

void  EEDB::Assembly::ucsc_name(string value) {
  _ucsc_name = value;
  _xml_cache.clear();
}

void  EEDB::Assembly::release_date(time_t value) {
  _release_date = value;
  _xml_cache.clear();
}

void  EEDB::Assembly::sequence_loaded(bool value) {
  _sequence_loaded = value;
  _xml_cache.clear();
}

////////////////////////////////////////////////////////////////

EEDB::Chrom*  EEDB::Assembly::get_chrom(string chrom_name) {
  if(chrom_name.empty()) { return NULL; }
  if(_last_chrom!=NULL and (_last_chrom->chrom_name() == chrom_name)) { return _last_chrom; }
  
  if(_chroms_map.empty() && (_database!=NULL)) {
    get_chroms();
  }

  if(_chroms_map.find(chrom_name) != _chroms_map.end()) { 
    _last_chrom = _chroms_map[chrom_name];
    return _last_chrom;
  }
  
  //missing so make it
  EEDB::Chrom  *chrom = new EEDB::Chrom();
  chrom->assembly(this);
  chrom->chrom_name(chrom_name);
  //printf("make chrom %s %s\n", assembly_name().c_str(), chrom_name);
  _chroms_map[chrom_name] = chrom;
  _last_chrom = chrom;
  return chrom;
}


void  EEDB::Assembly::all_chroms(vector<EEDB::Chrom*> &chroms) {  
  if(_chroms_map.empty() && (_database!=NULL)) {
    //printf("assembly [%s] load all chroms\n", assembly_name().c_str());
    vector<DBObject*> chrs = EEDB::Chrom::fetch_all_by_assembly(this);
    for(unsigned int i=0; i<chrs.size(); i++) {
      EEDB::Chrom *chrom = (EEDB::Chrom*)(chrs[i]);
      _chroms_map[chrom->chrom_name()] = chrom;
      if(!chrom->ncbi_chrom_name().empty()) { _chroms_map[chrom->ncbi_chrom_name()] = chrom; }
      if(!chrom->ncbi_accession().empty()) { _chroms_map[chrom->ncbi_accession()] = chrom; }
      if(!chrom->refseq_accession().empty()) { _chroms_map[chrom->refseq_accession()] = chrom; }
      if(!chrom->chrom_name_alt1().empty()) { _chroms_map[chrom->chrom_name_alt1()] = chrom; }
    }
  }
  map<string, EEDB::Chrom*>::iterator it1;
  for(it1=_chroms_map.begin(); it1!=_chroms_map.end(); it1++) {
    chroms.push_back((*it1).second);
  }
}


vector<EEDB::Chrom*>  EEDB::Assembly::get_chroms() {
  vector<EEDB::Chrom*> chroms;
  all_chroms(chroms);
  return chroms;
}


void  EEDB::Assembly::add_chrom(EEDB::Chrom* chrom) {
  if(!chrom) { return; }
  if(_chroms_map.find(chrom->chrom_name()) != _chroms_map.end()) { return; }
  chrom->retain();
  _chroms_map[chrom->chrom_name()] = chrom;
  if(!chrom->ncbi_chrom_name().empty()) { _chroms_map[chrom->ncbi_chrom_name()] = chrom; }
  if(!chrom->ncbi_accession().empty()) { _chroms_map[chrom->ncbi_accession()] = chrom; }
  if(!chrom->refseq_accession().empty()) { _chroms_map[chrom->refseq_accession()] = chrom; }
  if(!chrom->chrom_name_alt1().empty()) { _chroms_map[chrom->chrom_name_alt1()] = chrom; }
}


/**********************************************/


string EEDB::Assembly::_display_desc() {
  char buffer[2048];
  snprintf(buffer, 2040, "Assembly-%d-%s-%s-%s",
           _taxon_id,
           _ncbi_assembly_acc.c_str(),
           _ncbi_name.c_str(),
           _ucsc_name.c_str());
  return buffer;
}


void EEDB::Assembly::_xml_start(string &xml_buffer) {
  char buffer[2048];
  
  snprintf(buffer, 2040, "<assembly taxon_id=\"%d\" ", taxon_id());
  xml_buffer = buffer;
  xml_buffer +="asm=\""+assembly_name()+"\" ";

  if(!db_id().empty()) {xml_buffer +="id=\""+db_id()+"\" "; }
  if(!ncbi_version().empty()) {xml_buffer +="ncbi=\""+ncbi_version()+"\" "; }
  if(!_ncbi_assembly_acc.empty()) { xml_buffer +="ncbi_acc=\""+_ncbi_assembly_acc+"\" "; }
  if(!ucsc_name().empty()) {xml_buffer +="ucsc=\""+ucsc_name()+"\" "; }
  
  if(sequence_loaded()) { xml_buffer.append("seq=\"y\" "); }
  
  if(!_genus.empty()) { xml_buffer +="genus=\""+_genus+"\" "; }
  if(!_species.empty()) { xml_buffer +="species=\""+_species+"\" "; }
  if(!_common_name.empty()) { xml_buffer +="common_name=\""+_common_name+"\" "; }
  if(!_classification.empty()) { xml_buffer +="classification=\""+_classification+"\" "; }

  if(_release_date>0) {
    xml_buffer +="release_date=\""+release_date_string()+"\" ";
    snprintf(buffer, 2040, "release_timestamp=\"%ld\" ", _release_date);
    xml_buffer.append(buffer);
  }
  if(_create_date>0) {
    xml_buffer += "create_date=\""+ create_date_string() +"\" ";
    snprintf(buffer, 2040, "create_timestamp=\"%ld\" ", _create_date);
    xml_buffer.append(buffer);
  }

  xml_buffer.append(">");
}

void EEDB::Assembly::_simple_xml(string &xml_buffer) {
  _xml_start(xml_buffer);
  xml_buffer.append("</assembly>\n");
}

void EEDB::Assembly::_xml(string &xml_buffer) {
  if(_xml_cache.empty()) {
    _xml_start(_xml_cache);

    EEDB::MetadataSet *mdset = metadataset();
    if(mdset!=NULL) { mdset->xml(_xml_cache); }

    _xml_cache.append("</assembly>\n");
  }
  xml_buffer.append(_xml_cache);
}

void EEDB::Assembly::_mdata_xml(string &xml_buffer, map<string,bool> mdtags) {
  _xml_start(xml_buffer);

  vector<EEDB::Metadata*> mdlist = metadataset()->all_metadata_with_tags(mdtags);
  vector<EEDB::Metadata*>::iterator it1;
  for(it1=mdlist.begin(); it1!=mdlist.end(); it1++) {
    (*it1)->xml(xml_buffer);
  }
  
  xml_buffer.append("</assembly>\n");
}


EEDB::Assembly::Assembly(void *xml_node) {
  //constructor using a rapidxml node
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  rapidxml::xml_attribute<> *attr;
  
  if((attr = root_node->first_attribute("id"))) {
    _db_id.clear();
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(attr->value(), uuid, objID, objClass);
    _primary_db_id = objID;
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    if(peer) { _peer_uuid = peer->uuid(); }
    else { _db_id = attr->value(); } //store federatedID, if peer is set later, it will be recalculated
  }

  if((attr = root_node->first_attribute("taxon_id"))) { _taxon_id = strtol(attr->value(), NULL, 10); }
  if((attr = root_node->first_attribute("ncbi")))     { _ncbi_name = attr->value(); }
  if((attr = root_node->first_attribute("ncbi_acc"))) { _ncbi_assembly_acc = attr->value(); }
  if((attr = root_node->first_attribute("ucsc")))     { _ucsc_name = attr->value(); }
  if((attr = root_node->first_attribute("asm")))      { _assembly_name = attr->value(); }

  if((attr = root_node->first_attribute("genus")))       { _genus = attr->value(); }
  if((attr = root_node->first_attribute("species")))     { _species = attr->value(); }
  if((attr = root_node->first_attribute("common_name"))) { _common_name = attr->value(); }
  
  if((attr = root_node->first_attribute("classification"))) { _classification = attr->value(); }
 
  if((attr = root_node->first_attribute("seq"))) {
    if(string("y") == attr->value()) { _sequence_loaded = true; }
  }
  
  if((attr = root_node->first_attribute("release_timestamp"))) {
    _release_date = strtol(attr->value(), NULL, 10);
  }
  if((attr = root_node->first_attribute("create_timestamp"))) {
    _create_date = strtol(attr->value(), NULL, 10);
  }

  //metadata
  if((node = root_node->first_node("mdata")) != NULL) {
    while(node) {
      EEDB::Metadata *mdata = new EEDB::Metadata(node);
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

  //migrate primary attributes to metadata to allow searching
  EEDB::MetadataSet *mdset= metadataset();
  mdset->add_metadata("eedb:assembly_name", assembly_name());
  mdset->add_metadata("ncbi_name", ncbi_version());
  mdset->add_metadata("ncbi_accession", _ncbi_assembly_acc);
  mdset->add_metadata("ucsc_name", ucsc_name());
  
  mdset->add_metadata("taxon_id", l_to_string(taxon_id()));
  mdset->add_metadata("genus", _genus);
  mdset->add_metadata("species", _species);
  mdset->add_metadata("common_name", _common_name);
  mdset->add_metadata("release_date", release_date_string());
  mdset->add_metadata("classification", _classification);
  
  _metadataset.remove_duplicates();
  
  _xml_cache.clear();
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// DBObject override methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::Assembly::check_exists_db(MQDB::Database *db) {
  if(db==NULL) { return false; }
  
  //old version but does not match the fetch_by_name logic, so chaged
  //$sql = "select assembly_id from assembly WHERE taxon_id=? AND ncbi_version=? AND ucsc_name=?";
  //my $dbID = $self->database->fetch_col_value($sql, $self->taxon_id, $self->ncbi_version, $self->ucsc_name);

  dynadata value = db->fetch_col_value("SELECT assembly_id FROM assembly WHERE ncbi_version=? OR ucsc_name=?",
                                       "ss", _ncbi_name.c_str(), _ucsc_name.c_str());
  if(value.type != MQDB::INT) { return false; }
  
  _primary_db_id = value.i_int;
  database(db);
  return true;
}


bool EEDB::Assembly::store(MQDB::Database *db) {
  if(db==NULL) { return false; }
  if(check_exists_db(db)) { return true; }
  
  db->do_sql("INSERT ignore INTO assembly (taxon_id, assembly_name, ncbi_version, ncbi_assembly_acc, ucsc_name, release_date) \
             VALUES(?,?,?,?,?,?)", "dsssss",
             _taxon_id, _assembly_name.c_str(), _ncbi_name.c_str(), _ncbi_assembly_acc.c_str(), _ucsc_name.c_str(), release_date_string().c_str());

  db->do_sql("INSERT ignore INTO taxon (taxon_id, genus, species, common_name, classification) \
             VALUES(?,?,?,?,?)", "dssss",
             _taxon_id, _genus.c_str(), _species.c_str(), _common_name.c_str(), _classification.c_str());
  
  return check_exists_db(db);  //checks the database and sets the id
}


void  EEDB::Assembly::init_from_row_map(map<string, dynadata> &row_map) {
  _primary_db_id   = row_map["assembly_id"].i_int;
  _taxon_id        = row_map["taxon_id"].i_int;
  _ncbi_name       = row_map["ncbi_version"].i_string;
  _ucsc_name       = row_map["ucsc_name"].i_string;

  if(row_map["assembly_name"].type == MQDB::STRING) {
    _assembly_name = row_map["assembly_name"].i_string;
  }
  if(row_map["ncbi_assembly_acc"].type == MQDB::STRING) {
    _ncbi_assembly_acc = row_map["ncbi_assembly_acc"].i_string;
  }
  if(row_map["genus"].type == MQDB::STRING) {
    _genus = row_map["genus"].i_string;
  }
  if(row_map["species"].type == MQDB::STRING) {
    _species = row_map["species"].i_string;
  }
  if(row_map["common_name"].type == MQDB::STRING) {
    _common_name = row_map["common_name"].i_string;
  }
  if(row_map["classification"].type == MQDB::STRING) {
    _classification = row_map["classification"].i_string;
  }
  if(row_map["release_date"].type == MQDB::STRING) {
    string date_string = row_map["release_date"].i_string;
    _release_date = MQDB::seconds_from_epoch(date_string);
  }
  if(row_map["release_date"].type == MQDB::TIMESTAMP) {
    _release_date = row_map["release_date"].i_timestamp;
  }

  if(row_map["sequence_loaded"].i_string == string("y")) { _sequence_loaded=true;} else { _sequence_loaded=false; }
  
  if(row_map["extern_db_url"].type == MQDB::STRING) {
    string url = row_map["extern_db_url"].i_string;
    std::size_t pos = url.find("?id=");
    string id1;
    if(pos!=std::string::npos) {
      id1 = url.substr(pos+4);
      url.resize(pos);
    }
    MQDB::Database *db = new MQDB::Database(url);
    if(db) {
      //swap the query database with the external db_url
      _database = db;
      if(!id1.empty()) { _primary_db_id = strtol(id1.c_str(), NULL, 10); }
    }
  }
  
  //migrate primary attributes to metadata to allow searching
  EEDB::MetadataSet *mdset= metadataset();
  mdset->add_metadata("eedb:assembly_name", assembly_name());
  mdset->add_metadata("ncbi_name", ncbi_version());
  mdset->add_metadata("ncbi_accession", _ncbi_assembly_acc);
  mdset->add_metadata("ucsc_name", ucsc_name());

  mdset->add_metadata("taxon_id", l_to_string(taxon_id()));
  mdset->add_metadata("genus", _genus);
  mdset->add_metadata("species", _species);
  mdset->add_metadata("common_name", _common_name);
  mdset->add_metadata("release_date", release_date_string());
  mdset->add_metadata("classification", _classification);
  mdset->add_metadata("import_date", create_date_string());
  
  mdset->remove_duplicates();
  
  _xml_cache.clear();
}


EEDB::Assembly* EEDB::Assembly::fetch_by_id(MQDB::Database *db, long int id) {
  Assembly* obj = (Assembly*) MQDB::DBCache::check_cache(db, id, "Assembly");
  if(obj!=NULL) { obj->retain(); return obj; }
  
  const char *sql = "SELECT * FROM assembly LEFT JOIN taxon USING(taxon_id) WHERE assembly_id=?";
  obj = (Assembly*)MQDB::fetch_single(EEDB::Assembly::create, db, sql, "d", id);
  
  MQDB::DBCache::add_to_cache(obj);
  return obj;
}


EEDB::Assembly*  EEDB::Assembly::fetch_by_name(MQDB::Database *db, string name) {
  const char *sql = "SELECT * FROM assembly LEFT JOIN taxon USING(taxon_id) WHERE ncbi_version like ? or ucsc_name like ?";
  return (EEDB::Assembly*) MQDB::fetch_single(EEDB::Assembly::create, db, sql, 
                                              "ss", name.c_str(), name.c_str());
}


vector<DBObject*> EEDB::Assembly::fetch_all(MQDB::Database *db) {
  const char *sql = "SELECT * FROM assembly LEFT JOIN taxon USING(taxon_id)";
  return MQDB::fetch_multiple(EEDB::Assembly::create, db, sql, "");
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// NCBI webservice methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


vector<EEDB::Assembly*>  EEDB::Assembly::fetch_from_NCBI_by_search(string search_term) {
  //static class-level funtion
  //ex: GCF_000001895.5 or rn6 or rat
  vector<EEDB::Assembly*>  assembly_array;
  if(search_term.empty()) { return assembly_array; }
  
  rapidxml::xml_document<>       doc;
  rapidxml::xml_node<>           *root_node;
  
  CURL *curl = curl_easy_init();
  if(!curl) { return assembly_array; }
  
  struct RSS_curl_buffer  chunk;
  struct curl_slist *slist = NULL;
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  //http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=assembly&term=canfam3
  //string url = "http://www.ncbi.nlm.nih.gov/assembly/"+acc_id+"?report=xml&format=text";
  string url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=assembly&term=" + search_term;
  fprintf(stderr, "POST [%s]\n", url.c_str());
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  if(!slist) { return assembly_array; }
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl); //deletes curl
  
  //fprintf(stderr, "%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<eSearchResult");
  if(!start_ptr) { free(chunk.memory); return assembly_array; }
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return assembly_array; }
  
  rapidxml::xml_node<> *node1 = root_node->first_node("IdList");
  if(!node1) { free(chunk.memory); return assembly_array; }

  string id_list;
  rapidxml::xml_node<> *IDnode = node1->first_node("Id");
  while(IDnode) {
    //long assembly_id = strtol(IDnode->value(),NULL, 10);
    //fprintf(stderr, "NCBI assemblyID = %ld\n", assembly_id);
    id_list += string(IDnode->value()) + ",";
    IDnode = IDnode->next_sibling("Id");
  }
  if(id_list.empty()) { return assembly_array; }
  
  curl = curl_easy_init();
  if(!curl) { return assembly_array; }
  
  free(chunk.memory);
  bzero(chunk.memory, sizeof(chunk.memory));
  chunk.memory = NULL;  // will be grown as needed
  chunk.size = 0;    // no data at this point
  chunk.alloc_size = 0;    // no data at this point
  
  // query to get summary information
  //http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=assembly&retmode=xml&id=317138
  url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=assembly&retmode=xml&id=" + id_list;
  fprintf(stderr, "POST [%s]\n", url.c_str());
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POST, 1);
  
  slist = curl_slist_append(NULL, "Content-Type: text/xml; charset=utf-8"); // or whatever charset your XML is really using...
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, rss_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  curl_easy_perform(curl);
  if(slist) { curl_slist_free_all(slist); }
  curl_easy_cleanup(curl);
  
  //fprintf(stderr, "%s\n", chunk.memory);
  start_ptr = strstr(chunk.memory, "<eSummaryResult");
  if(!start_ptr) { free(chunk.memory); return assembly_array; }
  
  //parsing the FtpSite is difficult, so get directly from chunk.memory before XML parsing
  string ftp_path;
  char* p1 = strstr(chunk.memory, "<FtpPath type=\"RefSeq");
  if(p1) {
    p1 = strstr(p1, ">");
    p1+=1;
    char* p2 = index(p1, '<');
    ftp_path = p1;
    ftp_path.resize(p2-p1);
    //fprintf(stderr, "RefSeq path [%s]\n", ftp_path.c_str());
  }
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return assembly_array; }
  
  node1 = root_node->first_node("DocumentSummarySet");
  if(!node1) { return assembly_array; }
  rapidxml::xml_node<> *node2 = node1->first_node("DocumentSummary");
  while(node2) {
    /*
     <AssemblyName>CanFam3.1</AssemblyName>
     <UCSCName>canFam3</UCSCName>
     <Taxid>9615</Taxid>
     <AssemblyAccession>GCF_000002285.3</AssemblyAccession>
     <AsmReleaseDate>2011/11/03 00:00</AsmReleaseDate>
     */
    rapidxml::xml_node<> *accNode      = node2->first_node("AssemblyAccession");
    rapidxml::xml_node<> *ncbiNameNode = node2->first_node("AssemblyName");
    rapidxml::xml_node<> *ucscNameNode = node2->first_node("UCSCName");
    rapidxml::xml_node<> *taxNode      = node2->first_node("Taxid");
    rapidxml::xml_node<> *dateNode     = node2->first_node("AsmReleaseDate");
    
    if(!taxNode) { continue; }
    //if(!accNode || !taxNode || !ncbiNameNode || !ucscNameNode) { continue; }
    
    EEDB::Assembly* assembly = new EEDB::Assembly();
    EEDB::MetadataSet *mdset = assembly->metadataset();
    if(accNode)      { assembly->ncbi_assembly_accession(accNode->value()); }
    if(ncbiNameNode) { assembly->ncbi_version(ncbiNameNode->value()); }
    if(ucscNameNode) { assembly->ucsc_name(ucscNameNode->value()); }
    
    if(dateNode) {
      string date_string = dateNode->value();
      assembly->release_date(MQDB::seconds_from_epoch(date_string));
      mdset->add_tag_data("AsmReleaseDate", date_string);
    }
    
    long txid = strtol(taxNode->value(),NULL, 10);
    assembly->taxon_id(txid);
    assembly->fetch_NCBI_taxonomy_info();
    
    //extra metadata
    rapidxml::xml_node<> *node3;
    if((node3 = node2->first_node("EnsemblName"))) { mdset->add_tag_data("EnsemblName", node3->value()); }
    if((node3 = node2->first_node("RsUid"))) { mdset->add_tag_data("RsUid", node3->value()); }
    if((node3 = node2->first_node("GbUid"))) { mdset->add_tag_data("GbUid", node3->value()); }
    if((node3 = node2->first_node("BioSampleAccn"))) { mdset->add_tag_data("BioSampleAccn", node3->value()); }
    if((node3 = node2->first_node("BioSampleId"))) { mdset->add_tag_data("BioSampleId", node3->value()); }
    if((node3 = node2->first_node("AsmUpdateDate"))) { mdset->add_tag_data("AsmUpdateDate", node3->value()); }
    if((node3 = node2->first_node("LastUpdateDate"))) { mdset->add_tag_data("LastUpdateDate", node3->value()); }
    if((node3 = node2->first_node("SubmitterOrganization"))) { mdset->add_tag_data("SubmitterOrganization", node3->value()); }
    if((node3 = node2->first_node("Synonym"))) {
      node3 = node3->first_node();
      while(node3) {
        mdset->add_tag_data(string("Synonym_")+node3->name(), node3->value());
        node3 = node3->next_sibling();
      }
    }
    //if(!ftp_path.empty()) { mdset->add_tag_data(string("FtpPath_RefSeq"), ftp_path); }
    if((node3 = node2->first_node("FtpPath_GenBank"))) { mdset->add_tag_data("FtpPath_GenBank", node3->value()); }
    if((node3 = node2->first_node("FtpPath_RefSeq"))) { mdset->add_tag_data("FtpPath_RefSeq", node3->value()); }
    if((node3 = node2->first_node("FtpPath_Assembly_rpt"))) { mdset->add_tag_data("FtpPath_Assembly_rpt", node3->value()); }
    if((node3 = node2->first_node("FtpPath_Stats_rpt"))) { mdset->add_tag_data("FtpPath_Stats_rpt", node3->value()); }
    if((node3 = node2->first_node("FtpPath_Regions_rpt"))) { mdset->add_tag_data("FtpPath_Regions_rpt", node3->value()); }
    assembly_array.push_back(assembly);
    node2 = node2->next_sibling("DocumentSummary");
  }

  free(chunk.memory);
  return assembly_array;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// global assembly cache, can be accessed from anywhere in the code
// webservices need to fill cache, no automatic systems, to maintain security
//
//////////////////////////////////////////////////////////////////////////////////////////////////

EEDB::Assembly*  EEDB::Assembly::cache_get_assembly(string name) {
  if(EEDB::Assembly::_global_assembly_cache.find(name) == EEDB::Assembly::_global_assembly_cache.end()) { return NULL; }
  return EEDB::Assembly::_global_assembly_cache[name];
}

void EEDB::Assembly::_named_add_to_assembly_cache(string name, EEDB::Assembly* assembly) {
  if(assembly == NULL) { return; }
  if(name.empty()) { return; }
  if(EEDB::Assembly::_global_assembly_cache.find(name) == EEDB::Assembly::_global_assembly_cache.end()) {
    assembly->retain();
    EEDB::Assembly::_global_assembly_cache[name] = assembly;
  }
}

void EEDB::Assembly::add_to_assembly_cache(EEDB::Assembly* assembly) {
  if(assembly == NULL) { return; }
  EEDB::Assembly::_named_add_to_assembly_cache(assembly->assembly_name(), assembly);
  EEDB::Assembly::_named_add_to_assembly_cache(assembly->ncbi_version(), assembly);
  EEDB::Assembly::_named_add_to_assembly_cache(assembly->ncbi_assembly_accession(), assembly);
  EEDB::Assembly::_named_add_to_assembly_cache(assembly->ucsc_name(), assembly);
}

void EEDB::Assembly::clear_assembly_cache() {
  map<string, EEDB::Assembly*>::iterator  it;
  for(it = EEDB::Assembly::_global_assembly_cache.begin(); it != EEDB::Assembly::_global_assembly_cache.end(); it++) {
    if((*it).second != NULL) { (*it).second->release(); }
  }
  EEDB::Assembly::_global_assembly_cache.clear();
}


