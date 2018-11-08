/* $Id: LSArchiveImport.cpp,v 1.26 2013/04/08 07:32:28 severin Exp $ */

/***

NAME - EEDB::Tools::LSArchiveImport

SYNOPSIS

DESCRIPTION

 A tool to encapsulate the double resort buffer concept when needing to 
 modify the feature stream which might result in a change in sort order
 
CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
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

***/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <curl/curl.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Tools/LSArchiveImport.h>


using namespace std;
using namespace MQDB;

const char*  EEDB::Tools::LSArchiveImport::class_name = "EEDB::Tools::LSArchiveImport";

//function prototypes
void _tools_lsarchiveimport_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::Tools::LSArchiveImport*)obj;
}
void _tools_lsarchiveimport_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::Tools::LSArchiveImport*)obj)->_xml(xml_buffer);
}
string _tools_lsarchiveimport_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::Tools::LSArchiveImport*)obj)->_display_desc();
}


EEDB::Tools::LSArchiveImport::LSArchiveImport() {
  init();
}

EEDB::Tools::LSArchiveImport::~LSArchiveImport() {
  /* we're done with libcurl, so clean it up */ 
  curl_global_cleanup();
}

void EEDB::Tools::LSArchiveImport::init() {
  MQDB::DBObject::init();
  _classname                 = EEDB::Tools::LSArchiveImport::class_name;
  _funcptr_delete            = _tools_lsarchiveimport_delete_func;
  _funcptr_xml               = _tools_lsarchiveimport_xml_func;
  _funcptr_simple_xml        = _tools_lsarchiveimport_xml_func;
  _funcptr_display_desc      = _tools_lsarchiveimport_display_desc_func;
  
  gettimeofday(&_starttime, NULL);
    
  curl_global_init(CURL_GLOBAL_ALL);  
}


string EEDB::Tools::LSArchiveImport::_display_desc() {
  string str = "LSArchiveImport";
  return str;
}

void EEDB::Tools::LSArchiveImport::_xml(string &xml_buffer) {
  xml_buffer.append("<LSArchiveImport>");
  xml_buffer.append("</LSArchiveImport>\n");
}

////////////////////////////////////////////////////////////////////////////
//
// libcurl callback code 
//
////////////////////////////////////////////////////////////////////////////

struct LSA_curl_buffer {
  char *memory;
  size_t size;
};

static size_t _lsa_curl_writeMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp) {
  size_t realsize = size * nmemb;
  struct LSA_curl_buffer *mem = (struct LSA_curl_buffer *)userp;
  
   mem->memory = (char*)realloc(mem->memory, mem->size + realsize + 1);
   if (mem->memory == NULL) {
     // out of memory!
     fprintf(stderr, "not enough memory (realloc returned NULL)\n");
     exit(EXIT_FAILURE);
   }
   
   memcpy(&(mem->memory[mem->size]), contents, realsize);
   mem->size += realsize;
   mem->memory[mem->size] = 0;
  return realsize;
}


////////////////////////////////////////////////////////////////////////////
//
// new XML webservice based mathods 
//
////////////////////////////////////////////////////////////////////////////




bool  EEDB::Tools::LSArchiveImport::sync_metadata_for_datasource(EEDB::DataSource *source) {
  CURL *curl;
  CURLcode res;
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  struct LSA_curl_buffer    chunk;
  EEDB::Metadata            *md;  

  if(!source) { return false; }
  //$experiment->display_info;  
  EEDB::MetadataSet  *mdset = source->metadataset();
  
  // clean up old metadata
  mdset->remove_metadata_like("osc_header", "");
  mdset->remove_metadata_like("keyword", "");

  string library_id, barcode, sample_id;

  // find experiment library_id
  md = mdset->find_metadata("osc:LSA_library_id", "");
  if(!md) { md = mdset->find_metadata("osc:LSArchive_library_osc_lib_id", ""); }
  if(!md) { md = mdset->find_metadata("osc_libID", ""); }
  if(!md) {
    fprintf(stderr, "LSArchive sync: experiment [%s] does not have LSA libraryID\n", source->name().c_str());
    return false;
  }
  library_id = md->data();  
  //if($library_id =~ /(.+)_revision/) { $library_id = $1; }
  if(!mdset->has_metadata_like("osc:LSA_library_id", "")) {
    mdset->add_tag_symbol("osc:LSA_library_id", library_id);
  }
  
  // find experiment barcode
  md = mdset->find_metadata("osc:LSA_sample_barcode", "");
  if(md && (md->data() != "nobarcode")) { barcode = md->data(); }

  //find experiment sample_id
  md = mdset->find_metadata("osc:LSA_sample_id", "");
  if(md && (md->data() != "nosampleid")) { sample_id = md->data(); }

  // alternate is to extract from osc:LSA_full_ID: CNhs14334.12248-129H7.nobarcode
     
  /*
  if($self->{'debug'}>1) {
    printf("\nimport metadata from LSA with query libraryID [%s] :: %s", $library_id, $libID_md->display_desc);
    if($sample_id)  { printf("   sample[%s] :: %s", $sample_id, $sampleID_md->display_desc); }
    if($barcode)    { printf("   barcode[%s] :: %s", $barcode, $barcode_md->display_desc); }
    print("\n");
  }  
  if($self->{'debug'}>2) { print($experiment->display_contents); }
  */
  
  //
  // libcurl to fetch from LSArchive and find matching entry
  //
  chunk.memory = (char*)malloc(1);  /* will be grown as needed */ 
  chunk.size = 0;    /* no data at this point */ 
  string url = "http://osc-internal.gsc.riken.jp/ls-archive/exportFull.jsp?filter=true&approved=1&rejected=0&onHold=0&exportType=xml&libraryId=" + library_id; 
  //string url = "http://lsa-portal:8080/ls-archive/exportFull.jsp?filter=true&approved=1&rejected=0&onHold=0&exportType=xml&libraryId=" + library_id; 
  printf("URL: %s\n", url.c_str());
  
  curl = curl_easy_init();
  if(!curl) { return false; }
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _lsa_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  res = curl_easy_perform(curl);
  curl_easy_cleanup(curl);
  
  char *start_ptr = strstr(chunk.memory, "<LS-Archive");
  if(!start_ptr) { free(chunk.memory); return false; } 
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return false; } 
  
  rapidxml::xml_node<> *entry = root_node->first_node("entry");
  while(entry) {
    bool match = true;
    node = entry->first_node("LSArchive_library_osc_lib_id");
    if(!node || (library_id != node->value())) { match = false; }

    node = entry->first_node("LSArchive_sample_osc_sample_id");
    if(node && !sample_id.empty() && (sample_id != node->value())) { match = false; }

    node = entry->first_node("LSArchive_BARCODE_SEQUENCE");
    if(node && !barcode.empty() && (barcode != node->value())) { match = false; }
    
    if(match) {
      _parse_lsa_sample_xml(source, entry);
      _transfer_all_lsa_sample_xml(source, entry);
      source->metadataset()->remove_duplicates();
    }
    entry = entry->next_sibling("entry");
  }  
  free(chunk.memory);
  return true;
  
  
  /*
  //remove any OSCtable header related metadata
  mdset->remove_metadata_like("FileFormat");
  mdset->remove_metadata_like("chrom", "chromosome");
  mdset->remove_metadata_like("chrom_sequence", "sequence from chromosome");
  mdset->remove_metadata_like("edit", "mismatch/insertion/deletion status");
  mdset->remove_metadata_like("end", "end position of mapping");
  mdset->remove_metadata_like("id", "query ID/sequence");
  mdset->remove_metadata_like("map_position", "number of locations tag mapped to");
  //  mdset->remove_metadata_like("raw.2824-68E3-ACA]:"THP-1 LOT PPI, tube_31");
  //  mdset->remove_metadata_like("   Metadata(23) [raw.2824-68E3-GAT]:"THP-1 LOT PPI, tube_31");
  mdset->remove_metadata_like("raw.total", "tag total count");
  mdset->remove_metadata_like("ribosomal_sequence_accessions");
  mdset->remove_metadata_like("start.0base");
  mdset->remove_metadata_like("strand");
   */
  
  /*
  //
  // remap the raw "expname" to "osc:LSA_sample_id"
  //
  my $sample_id = "";
  my $barcode = "";
  
  unless(mdset->find_metadata('osc:LSA_sample_id')) {
    if(my $md1 = mdset->find_metadata('osc:LSArchive_sample_osc_sample_id')) {
      mdset->add_tag_symbol("osc:LSA_sample_id", $md1->data);
    } elsif(my $md2 = mdset->find_metadata('expname')) {
      if($md2->data =~ /(\w+)-(\w+)-(\w+)/) {
        $sample_id = $1."-".$2;
        $barcode   = $3;
      } elsif($md2->data =~ /(\w+)-(\w+)/) {
        $sample_id = $1."-".$2;
      }
      if((my $idx1 = index($sample_id, $library_id))>=0) { 
        my $old = $sample_id;
        substr($sample_id, $idx1, length($library_id), "");
        if($self->{'debug'}) { printf("change sample [%s] to [%s]\n", $old, $sample_id); }
      }
      if($sample_id) { mdset->add_tag_symbol("osc:LSA_sample_id", $sample_id); }
      if($barcode)   { mdset->add_tag_symbol("osc:LSA_sample_barcode", $barcode); }
    }
  }
  
  my $match_count=0;
  my $LSA_experiment = undef;
  my $lsa_experiments = $self->get_experiments_by_libraryID($library_id);
  foreach my $lsa_exp (@$lsa_experiments) {
    //if($metadata) { print($experiment->display_contents,"\n"); }
    my $libID_md    = $lsa_exp->metadataset->find_metadata("osc:LSArchive_library_osc_lib_id");
    my $sampleID_md = $lsa_exp->metadataset->find_metadata("osc:LSArchive_sample_osc_sample_id");
    my $barcode_md  = $lsa_exp->metadataset->find_metadata("osc:LSArchive_BARCODE_SEQUENCE");
    
    //printf("%s :: ", $lsa_exp->display_name); printf("[%s] ", $libID_md->data); printf("[%s] ", $sampleID_md->data); printf("[%s]\n", $barcode_md->data);
    
    if($library_id) {
      if($self->{'debug'}>1) { printf("  checking library_id [%s]\n", $library_id); }
      if(!$libID_md) { next; }
      if($libID_md->data ne $library_id) { next; }
    }
    if($self->{'debug'}>1) { printf("    check: %s\n", $lsa_exp->display_desc); }
    if($sample_id) {
      if($self->{'debug'}>1) { printf("  checking sample_id [%s]\n", $sample_id); }
      if(!$sampleID_md) { next; }
      if($sampleID_md->data ne $sample_id) { next; }
      if($self->{'debug'}>1) { print("     sampleID match\n"); }
    }
    if($barcode) {
      if($self->{'debug'}>1) { printf("  checking barcode [%s]\n", $barcode); }
      if(!$barcode_md) { next; }
      if($barcode_md->data ne $barcode) { next; }
      if($self->{'debug'}>1) { print("     barcode match\n"); }
    }
    
    $LSA_experiment = $lsa_exp;
    $match_count++;
  }
  if($self->{'debug'}>1) { printf("%d matches found\n", $match_count); }
  if(!defined($LSA_experiment) or ($match_count > 1)) { 
    if($self->{'debug'}) {
      printf("FAILED match %d : libraryID [%s]", $match_count, $library_id);
      if($sample_id)  { printf("   sample[%s]", $sample_id); }
      if($barcode)    { printf("   barcode[%s]", $barcode); }
      printf("  eeDB::[%s] %s", $experiment->db_id, $experiment->display_name);
      print("\n");
    }
    return undef; 
  }
  
  //printf("FOUND MATCH\n%s\n", $LSA_experiment->display_desc);
  //printf("MERGE\n");
  
  $experiment->metadataset->merge_metadataset($LSA_experiment->metadataset);
  unless($experiment->platform) { $experiment->platform($LSA_experiment->platform); }
  //$experiment->display_name($experiment->exp_accession ." ".  $LSA_experiment->display_name);
  $experiment->display_name($LSA_experiment->display_name);
  
  //print($experiment->display_contents);
  return $experiment;
  */
}


vector<EEDB::Experiment*>  EEDB::Tools::LSArchiveImport::get_experiments_by_libraryID(string libID) {
  CURL *curl;
  CURLcode res;
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node;
  struct LSA_curl_buffer    chunk;
  vector<EEDB::Experiment*> experiments;
  
  chunk.memory = (char*)malloc(1);  /* will be grown as needed */ 
  chunk.size = 0;    /* no data at this point */ 
  
  string url = "http://osc-internal.gsc.riken.jp/ls-archive/exportFull.jsp?filter=true&approved=1&rejected=0&onHold=0&exportType=xml&libraryId=" + libID; 
  printf("URL: %s\n", url.c_str());
  
  curl = curl_easy_init();
  if(!curl) { return experiments; }
  
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _lsa_curl_writeMemoryCallback);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  res = curl_easy_perform(curl);
  curl_easy_cleanup(curl);
  
  char *start_ptr = strstr(chunk.memory, "<LS-Archive");
  if(!start_ptr) { free(chunk.memory); return experiments; } 

  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(!root_node) { free(chunk.memory); return experiments; } 

  rapidxml::xml_node<> *entry = root_node->first_node("entry");
  while(entry) {    
    node = entry->first_node("LSArchive_library_osc_lib_id");
    if(node) { 
      if(libID == node->value()) {
        printf("LSArchive_library_osc_lib_id = %s\n", node->value()); 
        EEDB::Experiment*  experiment = new EEDB::Experiment();
        _parse_lsa_sample_xml(experiment, entry);
        experiments.push_back(experiment);
      }
    }
    entry = entry->next_sibling("entry");
  }  
  free(chunk.memory);
  return experiments;
}


////////////////////////////////////////////////////////////////////////////
//
// internal support methods 
//
////////////////////////////////////////////////////////////////////////////

void  EEDB::Tools::LSArchiveImport::_transfer_all_lsa_sample_xml(EEDB::DataSource *source, void *xml_node) {
  if(!source) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(!source) { return; }
  if(!xml_node) { return; }

  EEDB::MetadataSet  *mdset = source->metadataset();
  node = root_node->first_node();
  while(node) {
    _direct_transfer_mdata(mdset, node);
    node = node->next_sibling();
  }  

  source->metadataset()->remove_duplicates();
}


EEDB::Metadata*  EEDB::Tools::LSArchiveImport::_direct_transfer_mdata(EEDB::MetadataSet *mdset, void *xml_node) {
  rapidxml::xml_node<>      *node = (rapidxml::xml_node<>*)xml_node;  
  if(!mdset) { return NULL; }
  if(!node) { return NULL; }
  if(!node->value()) { return NULL; }
  if(strlen(node->value())==0) { return NULL; }
  
  EEDB::Metadata  *md    = NULL;
  string          newtag = string("osc:") + node->name();

  if(EEDB::Symbol::is_symbol(node->value())) {
    md = mdset->add_tag_symbol(newtag, node->value());
  } else {
    md = mdset->add_tag_data(newtag, node->value());
    md->extract_keywords(mdset);
  }
  return md;  
}


void  EEDB::Tools::LSArchiveImport::_parse_lsa_sample_xml(EEDB::DataSource *source, void *xml_node) {
  if(!source) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
  
  if(!source) { return; }
  if(!xml_node) { return; }
  
  //if(root_node->first_node("LSArchive_application_customer_id")) {
  //  fprintf(stderr, "  !!commercial LSArchive application, do not import\n");
  //  return;
  //}
  
  //foreach my $key (keys(%$sample)) { printf("[%s] => %s\n", $key, $sample->{$key}); }
  
  
  EEDB::Metadata *libID_md       = _transfer_mdata(source, xml_node, "LSArchive_library_osc_lib_id");    //ex: O63-DA
  //EEDB::Metadata *sampleID_md    = _transfer_mdata(source, xml_node, "LSArchive_sample_osc_sample_id");  //ex: 2816-67B9
  EEDB::Metadata *barcode_md     = _transfer_mdata(source, xml_node, "LSArchive_BARCODE_SEQUENCE");
  EEDB::Metadata *sample_name_md = _transfer_mdata(source, xml_node, "LSArchive_sample_sample_name");
  
  EEDB::Metadata *md1      = _transfer_mdata(source, xml_node, "LSArchive_osc_lib_id_sample_id");
  EEDB::Metadata *md2      = _transfer_mdata(source, xml_node, "LSArchive_application_experiment_description");
  //EEDB::Metadata *md3      = _transfer_mdata(source, xml_node, "LSArchive_BARCODE_NAME");
  
  string name;
  if(sample_name_md) { name += sample_name_md->data() + " : "; }
  if(barcode_md)     { name += barcode_md->data(); }
  if(libID_md)       { name += " " + libID_md->data(); }
  //if($sampleID_md)    { $name .= " ". $sampleID_md->data; }
  
  if(md1) { 
    //if(barcode_md) { $experiment->exp_accession($md1->data ."_". $barcode_md->data); }
    //else { $experiment->exp_accession($md1->data); }
    //$name.=$md1->data . " "; 
  }
  //if($md3 and ($md3->data ne "Null")) { $name.= " ".$md3->data; }
  source->display_name(name);
  
  if(md2 and (md2->data() != "Null")) { 
    if(!(source->metadataset()->has_metadata_like("description", ""))) {
      source->metadataset()->add_tag_data("description", md2->data()); 
    }
  }
    
  node = root_node->first_node("LSArchive_application_public_application_id");
  if(node) { 
    source->metadataset()->add_tag_symbol("osc:LSID", string("LSID") + node->value());
  }
  
  if(source->classname() == EEDB::Experiment::class_name) {
    //platform
    EEDB::Experiment *experiment = (EEDB::Experiment*)source;
    EEDB::Metadata *md7 = _transfer_mdata(source, xml_node, "LSArchive_library_library_type_name");
    EEDB::Metadata *md8 = _transfer_mdata(source, xml_node, "LSArchive_library_sequencer_type_name");
    string platform;
    if(md7) { platform = md7->data(); }
    if(md8) { 
      if(!platform.empty()) { platform += " "; }
      platform += md8->data();
    }
    if(!platform.empty()) { experiment->platform(platform); }
  }
   
  _transfer_mdata(source, xml_node, "LSArchive_application_public_application_id", "osc:LSA_application_id");
  _transfer_mdata(source, xml_node, "Librarian_rna_sample_taxonomy_id", "osc:taxonID");
  
  source->metadataset()->remove_duplicates();
  
  //mdset->extract_keywords;
  //print($experiment->display_contents) if($experiment);
}


EEDB::Metadata*  EEDB::Tools::LSArchiveImport::_transfer_mdata(EEDB::DataSource *source, void *xml_node, string tag) {
  string newtag = "osc:" + tag;
  return _transfer_mdata(source, xml_node, tag, newtag);
}


EEDB::Metadata*  EEDB::Tools::LSArchiveImport::_transfer_mdata(EEDB::DataSource *source, void *xml_node, string tag, string newtag) {
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_node<>      *node;
    
  if(!source) { return NULL; }
  node = root_node->first_node(tag.c_str());
  if(!node) { return NULL; }
  if(!node->value()) { return NULL; }
  if(strlen(node->value())==0) { return NULL; }

  EEDB::Metadata     *md = NULL;
  EEDB::MetadataSet  *mdset = source->metadataset();

  if(EEDB::Symbol::is_symbol(node->value())) {
    md = mdset->add_tag_symbol(newtag, node->value());
  } else {
    md = mdset->add_tag_data(newtag, node->value());
    md->extract_keywords(mdset);
  }
  return md;  
}



////////////////////////////////////////////////////////////////////////////
//
// tests
//
////////////////////////////////////////////////////////////////////////////


void EEDB::Tools::LSArchiveImport::test_curl() {  
  CURL *curl;
  CURLcode res;
  
  struct LSA_curl_buffer chunk;
  chunk.memory = (char*)malloc(1);  /* will be grown as needed by the realloc above */ 
  chunk.size = 0;    /* no data at this point */ 
  
  string library_id = "CNhs13709";
  string url = "http://osc-internal.gsc.riken.jp/ls-archive/exportFull.jsp?filter=true&approved=1&rejected=0&onHold=0&exportType=xml&libraryId=" + library_id; 
  printf("URL: %s\n", url.c_str());
  
  curl = curl_easy_init();
  if(!curl) { return; }
  
  // URL
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  
  /* send all data to this function  */ 
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, _lsa_curl_writeMemoryCallback);
  
  /* we pass ourself to the callback function */ 
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
  
  /* some servers don't like requests that are made without a user-agent
   field, so we provide one */ 
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");
  
  /* get it! */ 
  res = curl_easy_perform(curl);
  
  /* cleanup curl stuff */ 
  curl_easy_cleanup(curl);
  
  /*
   * Now, our chunk.memory points to a memory block that is chunk.size
   * bytes big and contains the remote file.
   *
   * Do something nice with it!
   *
   * You should be aware of the fact that at this point we might have an
   * allocated data block, and nothing has yet deallocated that data. So when
   * you're done with it, you should free() it as a nice application.
   */ 
  printf("%lu bytes retrieved\n", (long)chunk.size);  
  
  printf("%s\n", chunk.memory);
  char *start_ptr = strstr(chunk.memory, "<LS-Archive");
  
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *node, *root_node;
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(start_ptr);
  
  root_node = doc.first_node();
  if(root_node) { printf("root node OK\n"); }
  printf("root node %s\n", root_node->name());
  
  //if(root_node->name() != string("LS-Archive")) { 
  //  free(chunk.memory);
  //  return; 
  //}
  
  rapidxml::xml_node<> *entry = root_node->first_node("entry");
  while(entry) {
    printf("entry\n");
    
    node = entry->first_node("LSArchive_library_osc_lib_id");
    if(node) { printf("LSArchive_library_osc_lib_id = %s\n", node->value()); }
    
    entry = entry->next_sibling("entry");
  }  
  
  free(chunk.memory);
}


