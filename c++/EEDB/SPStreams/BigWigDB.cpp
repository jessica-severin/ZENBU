/* $Id: BigWigDB.cpp,v 1.3 2026/08/26 04:11:50 severin Exp $ */

/***

NAME - EEDB::SPStreams::BigWigDB

SYNOPSIS

DESCRIPTION

 Rebuild of the BigWigDB code.
 using the low-level API of samtools-lib '-lBigWig' for directly reading bigwig files.
 Uses the native parsing and cigar/strand parsing derived from OSCFileParser 
 
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
#include <sys/stat.h>
#include <sys/types.h>
#include <fcntl.h>
#include <sys/time.h>
#include <zlib.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <bigWig.h>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>

#include <EEDB/SPStreams/BigWigDB.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::BigWigDB::class_name = "EEDB::SPStreams::BigWigDB";
bool         EEDB::SPStreams::BigWigDB::_libbigwig_bwInit = false; //bwInit can only be called once in program globally

#define READ_BUFSIZE    8192
#define BUFSIZE         8192*3


//function prototypes
MQDB::DBObject* _spstream_bigwigdb_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::BigWigDB*)node)->_next_in_stream();
}
MQDB::DBObject* _spstream_bigwigdb_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::BigWigDB*)node)->_fetch_object_by_id(fid);
}
void _spstream_bigwigdb_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BigWigDB*)node)->_stream_clear();
}
void _spstream_bigwigdb_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BigWigDB*)node)->_disconnect();
}
void _spstream_bigwigdb_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BigWigDB*)node)->_reset_stream_node();
}
void _spstream_bigwigdb_delete_func(MQDB::DBObject *obj) {
  delete (EEDB::SPStreams::BigWigDB*)obj;
}
string _spstream_bigwigdb_display_desc_func(MQDB::DBObject *obj) {
  return ((EEDB::SPStreams::BigWigDB*)obj)->_display_desc();
}
void _spstream_bigwigdb_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::BigWigDB*)node)->_reload_stream_data_sources();
}
void _spstream_bigwigdb_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::BigWigDB*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_bigwigdb_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  ((EEDB::SPStreams::BigWigDB*)node)->_get_dependent_datasource_ids(source_ids);
}
bool _spstream_bigwigdb_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::BigWigDB*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}
void _spstream_bigwigdb_stream_features_by_metadata_search_func(EEDB::SPStream* node, string search_logic) {
  //TODO? don't know if samtools provides this functionality
}


EEDB::SPStreams::BigWigDB::BigWigDB() {
  init();
}

EEDB::SPStreams::BigWigDB::~BigWigDB() {
  if(_database != NULL) {
    _database->release();
    _database = NULL;
  }
}


void EEDB::SPStreams::BigWigDB::init() {
  EEDB::SPStreams::ZenDB::init();
  _classname                 = EEDB::SPStreams::BigWigDB::class_name;
  _module_name               = "BigWigDB";
  _db_type                   = "bigwigdb";

  _funcptr_delete            = _spstream_bigwigdb_delete_func;
  _funcptr_display_desc      = _spstream_bigwigdb_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_bigwigdb_next_in_stream_func;
  _funcptr_disconnect                         = _spstream_bigwigdb_disconnect_func;
  _funcptr_stream_clear                       = _spstream_bigwigdb_stream_clear_func;
  _funcptr_reload_stream_data_sources         = _spstream_bigwigdb_reload_stream_data_sources_func;

  _funcptr_stream_data_sources                = _spstream_bigwigdb_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_bigwigdb_get_dependent_datasource_ids_func;
  //_funcptr_stream_peers                       = _spstream_zendb_stream_peers_func;
  //_funcptr_stream_chromosomes                 = _spstream_zendb_stream_chromosomes_func;
  _funcptr_reset_stream_node                  = _spstream_bigwigdb_reset_stream_node_func;
  _funcptr_fetch_object_by_id                 = _spstream_bigwigdb_fetch_object_by_id_func;
  _funcptr_stream_by_named_region             = _spstream_bigwigdb_stream_by_named_region_func;
  _funcptr_stream_features_by_metadata_search = _spstream_bigwigdb_stream_features_by_metadata_search_func;

  //attribute variables
  //_samlib_fp = NULL;
  _bw_fp = NULL;
  _bw_iter = NULL;
  _bw_iter_idx = 0;
  
  _region_set = false;
  _parameters["_bigwig_loc"] = "link";
  _primary_experiment = NULL;
  _add_expression = true;
  _add_subfeatures = false;
  _add_metadata = false;
  _datatype = EEDB::Datatype::get_type("score");
  _bigwig_strand = ' '; //default to strandless
  //fprintf(stderr, "BigWigDB init\n");
}

string EEDB::SPStreams::BigWigDB::_display_desc() {
  string str = "BigWigDB [";
  if(_self_peer) { str += _self_peer->xml(); }
  else if(_database != NULL) { str += _database->full_url(); }
  str += "]";
  return str;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
//
// creation and building new BigWigDB
//
//////////////////////////////////////////////////////////////////////////////////////////////////

string  EEDB::SPStreams::BigWigDB::create_new(string filepath) {
  //if(_verbose) { 
    fprintf(stderr, "BigWigDB::create_new [%s]\n", filepath.c_str()); 
  //}

  EEDB::SPStreams::ZenDB::_create_new(filepath);

  // decide how original bigwig file is located
  bool bigwig_ok = false;
  string newpath = _zendb_dir+"/"+_db_type+".bigwig";
  struct stat statbuf; 

  if((stat(newpath.c_str(), &statbuf) == 0) &&  ((statbuf.st_mode & S_IFMT) == S_IFREG)) {
    if(_verbose) { fprintf(stderr, "bigwigdb internal bigwig file exists. delete and rebuild\n"); }
    unlink(newpath.c_str());
    //_parameters["_bigwig_loc"] = "ok";
    //bigwig_ok=true;
  }

  if(_parameters["_bigwig_loc"] == "link") {
    if(link(filepath.c_str(), newpath.c_str()) == 0) {
      if(_verbose) { fprintf(stderr, "hard link to %s\n", newpath.c_str()); }
      bigwig_ok=true;
    } else {
      if(_verbose) { fprintf(stderr, "hard link failed, perform copy\n"); }
      _parameters["_bigwig_loc"] = "copy";
    }
  }

  if(_parameters["_bigwig_loc"] == "symlink") {
    if(symlink(filepath.c_str(), newpath.c_str()) == 0) {
      if(_verbose) { fprintf(stderr, "symbolic link to %s\n", newpath.c_str()); }
      bigwig_ok=true;
    } else {
      if(_verbose) { fprintf(stderr, "soft link failed, perform copy\n"); }
      _parameters["_bigwig_loc"] = "copy";
    }
  }

  if(_parameters["_bigwig_loc"] == "copy") {
    string cmd = "cp "+filepath + " " + newpath;
    if(_verbose) { fprintf(stderr, "%s\n", cmd.c_str()); }
    if(system(cmd.c_str()) == 0) {
      if(_verbose) { fprintf(stderr, "copy to %s\n", newpath.c_str()); }
      bigwig_ok=true;
    } else {
      if(_verbose) { fprintf(stderr, "copy failed\n"); }
    }
  }
  if(!bigwig_ok) {
    fprintf(stderr, "problem moving bigwig into bigwigdb %s\n", newpath.c_str());
    return "ERROR problem moving bigwig into bigwigdb";
  }
  
  //else {
    //leave BIGWIG file in original location
    //this option is for network-disk environments where hardlinks 
    //fprintf(stderr, "used shared location %s\n", filepath.c_str());    
  //}
  _parameters["bigwig_path"] = newpath;
  
  if(_parameters.find("genome_assembly")==_parameters.end()) {
    fprintf(stderr, "warning genome_assembly not set\n");
    return "ERROR genome assembly not set";
  }
    
  //read the bigwig header and set metadata from header into featuresource
  if(!_read_bigwig_header()) {
    return _parameters["_parse_error"];
  }

  //create primary featuresource with metadata
  _primary_featuresource();
  _primary_source->name(_parameters["_filename"]);
  _primary_source->category("bigwig");  
  EEDB::MetadataSet *mdset = _primary_source->metadataset();
  EEDB::Metadata *md;

  mdset->add_tag_data("input_filename", _parameters["_filename"]);
  mdset->add_tag_symbol("eedb:assembly_name", _parameters["genome_assembly"]);
  //if(_parameters.find("bigwig:strand")!=_parameters.end()) {
  //  mdset->add_tag_symbol("bigwig:strand", _parameters["bigwig:strand"]);
  //}

  map<string,string>::iterator    p_it;
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    
    if(((*p_it).first == "eedb:display_name") or ((*p_it).first == "display_name")) {
      if(mdset->has_metadata_like("eedb:display_name", "")) { continue; }
      mdset->add_tag_data("eedb:display_name", (*p_it).second);
      continue;
    }
    
    if(((*p_it).first == "eedb:description") or ((*p_it).first == "description")) {
      if(mdset->has_metadata_like("description", "")) { continue; }
      if(mdset->has_metadata_like("eedb:description", "")) { continue; }
      mdset->add_tag_data("description", (*p_it).second);
      continue;
    }    

    //add everything else
    mdset->add_tag_data((*p_it).first, (*p_it).second);
  }
  if(!mdset->has_metadata_like("eedb:display_name", "")) { 
    mdset->add_tag_data("eedb:display_name", _parameters["_filename"]);
  }

  md = mdset->find_metadata("gff_mdata", "");
  if(md) { mdset->add_from_gff_attributes(md->data()); }
  
  mdset->remove_duplicates();

  //create primary experiment
  _primary_experiment = _create_experiment();  
  if(_parameters.find("score_as_expression") != _parameters.end()) {
    _primary_experiment->add_datatype(EEDB::Datatype::get_type(_parameters["score_as_expression"]));
  } else {
    _primary_experiment->add_datatype(EEDB::Datatype::get_type("score"));
  }

  if(_parameters.find("eedb:platform")!=_parameters.end()) {
    _primary_experiment->platform(_parameters["eedb:platform"]);
    _primary_experiment->metadataset()->add_tag_data("eedb:platform", _parameters["eedb:platform"]);
  } else {
    md = mdset->find_metadata("sam:platform_unit", "");
    if(md) {
      _primary_experiment->platform(md->data());
    }
  }
  _initialized = true;

  if(_verbose) {
    fprintf(stderr, "%s\n", _primary_experiment->xml().c_str());
  }

  //save final version of XML
  _save_xml();
  
  //copy to deploy directory
  _copy_self_to_deploy_dir();  
  
  string url = _db_type+"://" + _zendb_dir;
  return url;
}


// bool  EEDB::SPStreams::BigWigDB::_read_bigwig_info() {
//   string cmd;
//   //first check for valid header
//   cmd = "bigWigInfo " + _zendb_dir+"/"+_db_type + ".bigwig";
//   //fprintf(stderr, "%s\n", cmd.c_str());
//   
//   _primary_featuresource();
//   EEDB::MetadataSet *mdset = _primary_source->metadataset();
//   
//   FILE* fp = popen(cmd.c_str(), "r");
//   if(!fp) { 
//     _parameters["_parse_error"] = "ERROR unable to read BIGWIG header";
//     return false; 
//   }
// 
//   /*
//     version: 4
//     isCompressed: yes
//     isSwapped: 0
//     primaryDataSize: 1,594,517,958
//     primaryIndexSize: 4,792,004
//     zoomLevels: 9
//     chromCount: 22
//     basesCovered: 2,875,001,522
//     mean: 0.031672
//     min: 0.000000
//     max: 17.658899
//     std: 0.184404
//    */
//   
//   assembly();
//   
//   char buffer[8192];
//   while(!feof(fp) && (fgets(buffer, 8192, fp)!=NULL)) {
//     //convert into into metadata
//     //fprintf(stderr, "line: %s", buffer);
//     //map<string, string> info_hash;    
//     char* tok1 = strtok(buffer, ":\n\r");
//     char* tok2 = strtok(NULL, ":\n\r");
//     if(tok1!=NULL) {
//       while(*tok2==' ' && *tok2!='\0') { tok2++; } 
//       fprintf(stderr, "bigWigInfo [%s] = [%s]\n", tok1, tok2);
//       //info_hash[tok1] = tok2;
//       mdset->add_tag_data("bigwig:" + string(tok1), tok2);
//     }    
//   }
//   pclose(fp);  
//   _save_xml();
// 
//   return true;
// }


bool  EEDB::SPStreams::BigWigDB::_read_bigwig_header() {
  //version using libBigWig.h

  string path = _zendb_dir+"/"+_db_type + ".bigwig";
  //fprintf(stderr, "%s\n", cmd.c_str());
  
  _primary_featuresource();
  EEDB::MetadataSet *mdset = _primary_source->metadataset();

  bigWigFile_t *bwfp = NULL;
  //Initialize enough space to hold 128KiB (1<<17) of data at a time
  // if(bwInit(1<<17) != 0) {
  //   fprintf(stderr, "Received an error in bwInit\n");
  //   return false;
  // }
  if(!EEDB::SPStreams::BigWigDB::_libbigwig_bwInit) {
    EEDB::SPStreams::BigWigDB::_libbigwig_bwInit = true;
    //Initialize enough space to hold 128KiB (1<<17) of data at a time
    if(bwInit(1<<17) != 0) {
      fprintf(stderr, "Received an error in bwInit\n");
      return false;
    }    
  }

  //Open the local/remote file
  bwfp = bwOpen(path.c_str(), NULL, "r");
  if(!bwfp) {
    fprintf(stderr, "bwOpen : error occured while opening %s\n", path.c_str());
    return false;
  }
  
  bigWigHdr_t *hdr = bwfp->hdr; /**<The file header.*/

  char buffer[8192];
  sprintf(buffer, "%d", hdr->version);
  mdset->add_tag_data("bigwig:version", buffer);

  sprintf(buffer, "%ld", bwfp->cl->nKeys);
  mdset->add_tag_data("bigwig:chromCount", buffer);

  if(hdr->bufSize >0) { mdset->add_tag_data("bigwig:isCompressed", "yes"); }
  else { mdset->add_tag_data("bigwig:isCompressed", "no"); }
  sprintf(buffer, "%d", hdr->bufSize);
  mdset->add_tag_data("bigwig:bufSize", buffer);

  //nLevels
  sprintf(buffer, "%d", hdr->nLevels);
  mdset->add_tag_data("bigwig:zoomLevels", buffer);
  
  //nBasesCovered
  sprintf(buffer, "%ld", hdr->nBasesCovered);
  mdset->add_tag_data("bigwig:basesCovered", buffer);
  
  // double minVal; /**<The minimum value in the file.*/
  sprintf(buffer, "%f", hdr->minVal);
  mdset->add_tag_data("bigwig:min", buffer);

  // double maxVal; /**<The maximum value in the file.*/
  sprintf(buffer, "%f", hdr->maxVal);
  mdset->add_tag_data("bigwig:max", buffer);

  // double sumData; /**<The sum of all values in the file.*/
  sprintf(buffer, "%f", hdr->sumData);
  mdset->add_tag_data("bigwig:sumData", buffer);

  //printf("mean: %f\n", sum.sumData/sum.validCount);
  sprintf(buffer, "%f", hdr->sumData / hdr->nBasesCovered);
  mdset->add_tag_data("bigwig:mean", buffer);
  
  // double sumSquared; /**<The sum of the squared values in the file.*/
  sprintf(buffer, "%f", hdr->sumSquared);
  mdset->add_tag_data("bigwig:sumSquared", buffer);

  // printf("std: %f\n", calcStdFromSums(sum.sumData, sum.sumSquares, sum.validCount));
  uint64_t n = hdr->nBasesCovered;
  double var = hdr->sumSquared - (hdr->sumData * hdr->sumData) / n;
  var /= (hdr->nBasesCovered - 1);
  double std = sqrt(var);
  sprintf(buffer, "%f", std);
  mdset->add_tag_data("bigwig:std", buffer);
  sprintf(buffer, "%f", var);
  mdset->add_tag_data("bigwig:var", buffer);

  //printLabelAndLongNumber("primaryDataSize", bwf->unzoomedIndexOffset - bwf->unzoomedDataOffset);
  uint64_t dataSize = hdr->indexOffset - hdr->dataOffset;
  sprintf(buffer, "%ld", dataSize);
  mdset->add_tag_data("bigwig:primaryDataSize", buffer);

  // if (bwf->levelList != NULL) {
  //   long long indexEnd = bwf->levelList->dataOffset;
  //   printLabelAndLongNumber("primaryIndexSize", indexEnd - bwf->unzoomedIndexOffset);
  // }
  uint64_t indexEnd = hdr->zoomHdrs->dataOffset[0];
  uint64_t indexSize = indexEnd - hdr->indexOffset;
  sprintf(buffer, "%ld", indexSize);
  mdset->add_tag_data("bigwig:primaryIndexSize", buffer);
  
  /*  example from bigWigInfo command
  version: 4
  isCompressed: yes
  isSwapped: 0
  primaryDataSize: 1,594,517,958
  primaryIndexSize: 4,792,004
  zoomLevels: 9
  chromCount: 22
  basesCovered: 2,875,001,522
  mean: 0.031672
  min: 0.000000
  max: 17.658899
  std: 0.184404
  */

  bwClose(bwfp);
  //bwCleanup();  //should only call on program exit

  return true;
}


void libbigwig_test(string path) {
  bigWigFile_t *fp = NULL;
  bwOverlappingIntervals_t *intervals = NULL;
  double *stats = NULL;

  //Initialize enough space to hold 128KiB (1<<17) of data at a time
  if(bwInit(1<<17) != 0) {
    fprintf(stderr, "Received an error in bwInit\n");
    return;
  }

  //Open the local/remote file
  fp = bwOpen(path.c_str(), NULL, "r");
  if(!fp) {
      fprintf(stderr, "An error occured while opening %s\n", path.c_str());
      return;
  }

  // typedef struct {
  //   uint32_t l; /**<Number of intervals held*/
  //   uint32_t m; /**<Maximum number of values/intervals the struct can hold*/
  //   uint32_t *start; /**<The start positions (0-based half open)*/
  //   uint32_t *end; /**<The end positions (0-based half open)*/
  //   float *value; /**<The value associated with each position*/
  // } bwOverlappingIntervals_t;

  //Get values in a range (0-based, half open) without NAs
  intervals = bwGetValues(fp, "chr1", 10000000, 10000100, 0);
  bwDestroyOverlappingIntervals(intervals); //Free allocated memory

  //Get values in a range (0-based, half open) with NAs
  intervals = bwGetValues(fp, "chr1", 10000000, 10000100, 1);
  bwDestroyOverlappingIntervals(intervals); //Free allocated memory

  //Get the full intervals that overlap
  intervals = bwGetOverlappingIntervals(fp, "chr1", 10000000, 10000100);
  bwDestroyOverlappingIntervals(intervals);

  //Get an example statistic - standard deviation
  //We want ~4 bins in the range
  stats = bwStats(fp, "chr1", 10000000, 10000100, 4, dev);
  if(stats) {
      printf("chr1:10000000-10000100 std. dev.: %f %f %f %f\n", stats[0], stats[1], stats[2], stats[3]);
      free(stats);
  }

  bwClose(fp);
  bwCleanup();
  return;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
//
// connection and initialization methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////


EEDB::SPStreams::BigWigDB*  EEDB::SPStreams::BigWigDB::new_from_url(string url) {
  EEDB::SPStreams::BigWigDB*   bigwigdb = new EEDB::SPStreams::BigWigDB();
  if(!bigwigdb->_init_from_url(url)) {
    delete bigwigdb;
    return NULL;
  }
  return bigwigdb;
}


bool EEDB::SPStreams::BigWigDB::_init_from_url(string url) {

  //cout << url << endl;

  if(!EEDB::SPStreams::ZenDB::_init_from_url(url)) { return false; }

  peer();

  //determine of using an internal or external bigwig file
  struct stat statbuf; 
  string path = _zendb_dir + "/"+_db_type+".bigwig";
  if(stat(path.c_str(), &statbuf) == 0) {
    _parameters["bigwig_path"] = path;
    //fprintf(stderr, "BigWigDB using internal bigwig file [%s]\n", path.c_str());
    return true;
  }

  //cout << _parameters["bigwig_path"] << endl;

  // otherwise check bigwig_path variable and stat file
  // and check file access ability of file with file stat
  path = _parameters["bigwig_path"];

  if (boost::starts_with(path,"ftp://")) {
	  fprintf(stderr, "BigWigDB using ftp remote bigwig file [%s]\n", path.c_str());
	  return true;
  } else if(stat(path.c_str(), &statbuf) == 0) {
    //fprintf(stderr, "BigWigDB using remote bigwig file [%s]\n", path.c_str());
    return true;
  }
  
  return false;
}


bool  EEDB::SPStreams::BigWigDB::_init_from_xmldb() {
  // ZENBU 2.xxx version all use XML database internally  
  string                    path = _zendb_dir + "/"+_db_type+".xml";
  int                       fildes;
  off_t                     cfg_len;
  char*                     config_text;
  rapidxml::xml_document<>  doc;
  rapidxml::xml_node<>      *node, *root_node, *section_node;
  
  if(_initialized) { return true; }  

  peer();
  
  //fprintf(stderr,"BigWigDB::_init_from_xmldb [%s]\n", path.c_str());
  fildes = open(path.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return false; } //error
  
  cfg_len = lseek(fildes, 0, SEEK_END);  
  lseek(fildes, 0, SEEK_SET);
  
  config_text = (char*)malloc(cfg_len+1);
  memset(config_text, 0, cfg_len+1);
  read(fildes, config_text, cfg_len);
  close(fildes);
  
  doc.parse<rapidxml::parse_declaration_node | rapidxml::parse_no_data_nodes>(config_text);
  root_node = doc.first_node();
  if((root_node->name() != string("zendb")) and (root_node->name() != string("oscfile"))) { return false; }
  
  // parameters section
  /*
  section_node = root_node->first_node("parameters");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(string(node->name()) == "input_file") { _parameters["_inputfile"] = node->value(); } 
      else { _parameters[node->name()] = node->value(); }
      node = node->next_sibling();
    }
  }
  */
  
  // sources section
  _bigwig_strand = ' ';
  section_node = root_node->first_node("sources");
  if(section_node) { 
    node = section_node->first_node();
    while(node) {
      if(strcmp(node->name(), "experiment")==0) {
        EEDB::Experiment *exp = new EEDB::Experiment(node, _load_source_metadata);
        if(_self_peer) { exp->peer_uuid(_self_peer->uuid()); }
        exp->metadataset()->remove_metadata_like("keyword", "");
        exp->metadataset()->remove_duplicates();
        EEDB::Metadata *mdata = exp->metadataset()->find_metadata("bigwig:strand", "");
        if(mdata) {
          if(mdata->data() == "forward") { _bigwig_strand = '+'; }
          if(mdata->data() == "reverse") { _bigwig_strand = '-'; }
        }
        _add_datasource(exp);
        _primary_experiment = exp;
        exp->release();
      }
      if(strcmp(node->name(), "featuresource")==0) {
        EEDB::FeatureSource *fsrc = new EEDB::FeatureSource(node);
        fsrc->is_visible(false);
        fsrc->is_active(true);
        if(_self_peer) { fsrc->peer_uuid(_self_peer->uuid()); }
        fsrc->metadataset()->remove_metadata_like("keyword", "");
        fsrc->metadataset()->remove_duplicates();
        _add_datasource(fsrc);
        //this hides the FeatureSource on the source streams and security checks
        //but still maintains the current class design
        //in prep for future 3.0 release which only will use DataSource, may break some configs though
        if(fsrc->primary_id() == 1) { 
          _primary_source = fsrc;
          fsrc->retain();
        }
        fsrc->release();
      }
      node = node->next_sibling();
    }
  }
  free(config_text);

  // post processing    
  assembly();  //generate if parameter is set

  //transfer the create date to experiment (patch)
  if(_primary_source && _primary_experiment) {
    _primary_experiment->create_date(_primary_source->create_date());
  }
    
  _database = NULL;
  
  if(!_sources_cache.empty()) { _sources_cache_loaded = true; }
  _initialized = true;
  return true;
}


//
//////////////////////////////////////////////////////////////////////////////////////////////////
//

MQDB::DBObject* EEDB::SPStreams::BigWigDB::_fetch_object_by_id(string fid) {
  if(peer_uuid() == NULL) { return NULL; }

  string uuid;
  string objClass="Feature";
  long int objID = -1;

  unparse_eedb_id(fid, uuid, objID, objClass);

  if(uuid.empty()) { return NULL; }
  if(uuid != string(_peer_uuid)) { return NULL; }
  
  if(objClass == "Feature") { return _fetch_feature_by_id(objID); }
  else { 
    // first check if we need to reload sources
    _reload_stream_data_sources(); 
    return _sources_cache[fid]; 
  }
  return NULL;
}


EEDB::Feature*  EEDB::SPStreams::BigWigDB::_fetch_feature_by_id(long int feature_id) {
  //Not available with bigwig
  return NULL;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  source streaming section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::BigWigDB::_stream_data_sources(string classname, string filter_logic) {
  if(!_source_is_active) { return; }
  
  // first check if we need to reload
  _reload_stream_data_sources();
  
  //then call the superclass method
  EEDB::SPStreams::SourceStream::_stream_data_sources(classname, filter_logic);
}


void EEDB::SPStreams::BigWigDB::_get_dependent_datasource_ids(map<string,bool> &source_ids) {
  if(!_source_is_active) { return; }
  
  _reload_stream_data_sources();  //internal method not superclass and function redirect
  
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }
    
    if(_stream_is_datasource_filtered) {
      if(!_filter_source_ids[source->db_id()]) { continue; }
    }
    
    source_ids[source->db_id()] = true;
  }
  if(_database) { _database->disconnect(); }
}


void EEDB::SPStreams::BigWigDB::_reload_stream_data_sources() {
  // first check if we need to reload
  //fprintf(stderr," BigWigDB::_reload_stream_data_sources [%s]\n", _peer_uuid);
  struct stat statbuf;
  string path;
  if(_version==1) { path = _zendb_dir + "/"+_db_type+".sqlite"; }
  if(_version==2) { path = _zendb_dir + "/"+_db_type+".xml"; }
  if(stat(path.c_str(), &statbuf) == 0) {
    if(_modify_time != statbuf.st_mtime) { 
      _modify_time = statbuf.st_mtime;
      fprintf(stderr, "%s _reload_stream_data_sources [%s]\n", _db_type.c_str(), _peer_uuid);
      _initialized = false;
      _sources_cache_loaded = false;
      _sources_cache.clear();  //clear old cache
      _init_from_xmldb();      
    }
  }
}


//
////////////////////////////////////////////////////////////////////////////////////////////////////////
//

/***** next_in_stream

  Description: since this is a source, it needs to override this method and 
               do appropriate business logic to control the stream.
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

*****/

MQDB::DBObject* EEDB::SPStreams::BigWigDB::_next_in_stream() {
  //_source_stream is a Buffer for sources,chroms....
  if(_source_stream != NULL) {
    MQDB::DBObject *obj = _source_stream->next_in_stream();
    //if no more objects then clear the source_stream()
    if(obj == NULL) { 
      _source_stream->release();
      _source_stream = NULL;
      _disconnect();
    }
    return obj;
  }

  if(_region_set) {
    EEDB::Feature *feature = _next_feature();
    if(!feature) {
      //fprintf(stderr, "BigWigDB (%ld) finished\n", (long)this);
      _region_set = false;
      _disconnect();
    }
    return feature;
  }
  return NULL;  
}


/***** stream_clear
  Description: re-initialize the stream-stack back to a clear/empty state
*****/

void EEDB::SPStreams::BigWigDB::_stream_clear() {
  //fprintf(stderr, "BigWigDB::_stream_clear (%ld)\n", (long)this);
  _disconnect();
}

/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::BigWigDB::_reset_stream_node() {
  //fprintf(stderr, "BigWigDB::_reset_stream_node (%ld)\n", (long)this);
  EEDB::SPStreams::SourceStream::_reset_stream_node();
  _init_from_xmldb();  //make sure it is initialized now  
  _region_set        = false;
  _region_start      = -1;
  _region_end        = -1;
  _region_chrom_name = "";
  if(_bw_fp) {
    bwClose(_bw_fp);
    _bw_fp = NULL;
  }
}


void EEDB::SPStreams::BigWigDB::_disconnect() {
  struct timeval    starttime,endtime,difftime;
  gettimeofday(&starttime, NULL);
  EEDB::SPStreams::ZenDB::_disconnect();
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  if(_bw_fp) {
    bwClose(_bw_fp);
    _bw_fp = NULL;
  }
  _region_set        = false;
  _region_start      = -1;
  _region_end        = -1;
  _region_chrom_name = "";

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  //fprintf(stderr, "BigWigDB::_disconnect (%ld) %1.6f sec\n", (long)this, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
}


bool  EEDB::SPStreams::BigWigDB::_stream_by_named_region(string asm_name, string chrom_name, long int start, long int end) {
  //fprintf(stderr,"BigWigDB::_stream_by_named_region [%s] %s %s %ld .. %ld\n", peer_uuid(), asm_name.c_str(), chrom_name.c_str(), start, end);
  _region_set     = false;
  _region_start   = -1;
  _region_end     = -1;
  _region_chrom_name = "";

  if(!_source_is_active) { return true; }
  
  //initialize if not already
  if(!experiment()) { return false; }  //some error
  
  //check assembly
  if(asm_name != assembly()->assembly_name()) { return true; }  //if wrong assembly then return empty stream
  
  if(!EEDB::SPStreams::BigWigDB::_libbigwig_bwInit) {
    fprintf(stderr, "bwInit NEED TO INIT ONCE, first time now\n");
    EEDB::SPStreams::BigWigDB::_libbigwig_bwInit = true;
    //Initialize enough space to hold 128KiB (1<<17) of data at a time
    if(bwInit(1<<17) != 0) {
      fprintf(stderr, "Received an error in bwInit\n");
      return false;
    }    
  }

  _add_expression = false;
  if((_sourcestream_output == "feature") ||
     (_sourcestream_output == "express") ||
     (_sourcestream_output == "simple_express") ||
     (_sourcestream_output == "skip_subfeatures") ||
     (_sourcestream_output == "skip_metadata")) { 
    _add_expression = true; 
  }
  _add_subfeatures = false;
  if((_sourcestream_output == "feature") ||
     (_sourcestream_output == "express") ||
     (_sourcestream_output == "subfeature") ||
     (_sourcestream_output == "skip_expression") ||
     (_sourcestream_output == "skip_metadata")) { 
    _add_subfeatures = true;
  }
  _add_metadata = false;
  if((_sourcestream_output == "feature") ||
     (_sourcestream_output == "skip_expression") ||
     (_sourcestream_output == "skip_subfeatures")) {
    _add_metadata = true;
  }
  
  if(start < 1) { start = 1; }
  _region_set        = true;
  _region_start      = start;
  _region_end        = end;
  _region_chrom_name = chrom_name;
  //fprintf(stderr, "bigwigdb region %s start=%ld  end=%ld\n", chrom_name.c_str(), _region_start, _region_end);
  
  string file = _zendb_dir+"/"+_db_type + ".bigwig";
  if(!_bw_fp) { _bw_fp = bwOpen(file.c_str(), NULL, "r"); }
  if (!_bw_fp) {
    fprintf(stderr, "Fail to open BIGWIG file %s\n", file.c_str());
    return false;
  } else {
    fprintf(stderr, "SUCCESS bwOpen : %s\n", file.c_str());
  }
  
  string chrom_loc = chrom_name+":";
  if(_region_end == -1) { 
    char buf1[256];
    sprintf(buf1, "%ld", _region_start);
    chrom_loc += buf1;
  } else {
    char buf1[256];
    sprintf(buf1, "%ld-%ld", _region_start, _region_end);
    chrom_loc += buf1;
  }
  
  //int chrom_ref, tbeg, tend;
  // bigwig_parse_region(_samlib_fp->header, chrom_loc.c_str(), &chrom_ref, &tbeg, &tend); // parse the region
  // if(chrom_ref < 0) {
  //   fprintf(stderr, "samlib Invalid region %s [%s] [%s]\n", chrom_loc.c_str(), _peer_uuid, _zendb_dir.c_str());
  //   samclose(_samlib_fp);
  //   _samlib_fp = NULL;
  //   _region_set     = false;
  //   _region_start   = -1;
  //   _region_end     = -1;
  //   return true; //return true because this region chrom_ref is not known, never fails for beg/end out ot range
  //   //treat as if it is an empty region, rather than a fail condition
  // }
  //fprintf(stderr, "samlib loc[%s] => %d %d %d\n", chrom_loc.c_str(), chrom_ref, tbeg, tend);
  
  // bigwig_index_t *idx = bigwig_index_load(file.c_str()); // load BIGWIG index
  // if(idx == 0) {
  //   fprintf(stderr, "samlib BAM indexing file [%s] is not available\n", file.c_str());
  //   samclose(_samlib_fp);
  //   _samlib_fp = NULL;
  //   return false;
  // }
  // _samlib_iter = bigwig_iter_query(idx, chrom_ref, tbeg, tend);
  // bigwig_index_destroy(idx);  //only need the index open to start the bigwig_iter
  //
  // _samlib_bigwig_align = bigwig_init1();
  
  //bigWig use 0base while zenbu uses 1base internally so use start-1
  //_bw_iter = bwOverlappingIntervalsIterator(_bw_fp, chrom_name.c_str(), _region_start-1, _region_end, uint32_t blocksPerIteration);
  _bw_iter = bwOverlappingIntervalsIterator(_bw_fp, chrom_name.c_str(), _region_start-1, _region_end, 1);
  if(!_bw_iter) {
    //bwClose(_bw_fp);
    //_bw_fp = NULL;
    _bw_iter           = NULL;
    _region_set        = false;
    _region_start      = -1;
    _region_end        = -1;
    _region_chrom_name = "";
    return false;
  }

  fprintf(stderr, "I have a valid starting _bw_iter\n");
  //_show_current_bw_iter();
  _bw_iter_idx = 0;
  return true;
}


EEDB::Feature* EEDB::SPStreams::BigWigDB::_next_feature() {
  if(!_region_set) return NULL;

  //fprintf(stderr, "BigWigDB::_next_feature\n");
  
  EEDB::Feature *feature = NULL;
  while(1) {
    if(feature) { //clean up from previous loop
      feature->release();
      feature=NULL;
    }
    
    //libBigWig mode
    if(!_bw_fp) return NULL;
    if(!_bw_iter) return NULL;
    if(_bw_iter->data == NULL) {
      fprintf(stderr, "_bw_iter->data is NULL so end iteration\n");
      bwIteratorDestroy(_bw_iter);
      _bw_iter = NULL;
      _bw_iter_idx = 0;
      return NULL;
    }
    
    //fprintf(stderr, "BigWigDB::_next_feature _bw_iter_idx=%d l=%d blocksPerIteration=%d\n", _bw_iter_idx, _bw_iter->intervals->l, _bw_iter->blocksPerIteration);

    if(_bw_iter_idx >= _bw_iter->intervals->l) {
      fprintf(stderr, "reach max intervals in current iterator : l=%d \t idx=%d \t blocksPerIteration=%d\n",
              _bw_iter->intervals->l, _bw_iter_idx, _bw_iter->blocksPerIteration);
      
      _bw_iter = bwIteratorNext(_bw_iter);
      if(_bw_iter == NULL) {
        fprintf(stderr, "bwIteratorNext returned NULL\n");
        _bw_iter = NULL;
        _bw_iter_idx = 0;
        return NULL;
      }
      
      //_show_current_bw_iter();
      _bw_iter_idx = 0; //reset idx for start of next interval block
      continue; //continue back to start of loop to perform the valid checks on iterator
    }
            
    //feature = convert_align_to_feature(_samlib_bigwig_align, _samlib_fp);
    //EEDB::Feature*      convert_wig_interval_to_feature(bwOverlappingIntervals_t *intervals, uint32_t idx, string chrom_name);
    feature = convert_wig_interval_to_feature(_bw_iter->intervals, _bw_iter_idx, _region_chrom_name);
    _bw_iter_idx++;
    
    if(!feature) { 
      fprintf(stderr,"convert_wig_interval_to_feature NULL feature\n");
      return NULL;
    }
    if(!feature->chrom()) { 
      fprintf(stderr,"SKIP features without chrom\n");
      continue; 
    }
    if(feature->chrom_end() < _region_start) {
      fprintf(stderr,"SKIP pre-start : f.end=%ld  r.start=%ld\n", feature->chrom_end(), _region_start);
      continue;
    }
    //if(_add_expression && _primary_experiment && feature->expression_array().empty()) {
    //  //supposed to have expression, but no expression added -> so it should be filtered out
    //  continue;
    //}
        
    //everything is ok so break
    break;
  }
  
  if(!feature) { return NULL; }
  if((_region_end!=-1) and (feature->chrom_start() > _region_end)) {
    fprintf(stderr,"STOP post-end : f.start=%ld  r.end=%ld\n", feature->chrom_start(), _region_end);
    feature->release(); 
    feature=NULL;
  }
  return feature;
}


EEDB::Feature*  EEDB::SPStreams::BigWigDB::convert_wig_interval_to_feature(bwOverlappingIntervals_t *intervals, uint32_t idx, string chrom_name) {  
  if(intervals==NULL) { return NULL; }
  if(idx >= intervals->l) {
    fprintf(stderr, "convert_wig_interval_to_feature idx > l (Number of intervals held) : idx=%d  l=%d\n", idx, intervals->l);
    return NULL;
  }

  uint32_t  start = intervals->start[idx];  //The start positions (0-based half open)
  uint32_t  end   = intervals->end[idx];    //The end positions (0-based half open)
  float     value = intervals->value[idx];  //The value associated with each position
  
  //fprintf(stderr, "wig interval s=%d  e=%d  v=%f\n", start, end, value);

  EEDB::Feature *feature = EEDB::Feature::realloc();

  //create all internal data structures so that lazyload is not triggered later
  feature->metadataset();
  feature->load_expression();
  feature->subfeatures();

  // set attributes
  //feature->primary_id(al->Bin);  // BAM (standard) index bin number for this alignment.
  //feature->primary_name(bigwig_get_qname(al));
  feature->feature_source(_primary_source);
  feature->significance(value);
  feature->chrom_start(start+1);  // position (0-based) where wig interval starts
  feature->chrom_end(end);  // position (0-based) where alignment ends

  //chrom
  if(assembly()) { // chr
    EEDB::Chrom *chrom = assembly()->get_chrom(_region_chrom_name);
    feature->chrom(chrom);
    //TODO: manage multiple assemblies?
  }

  //strand
  feature->strand(_bigwig_strand);

  //expression
  if(_add_expression && _primary_experiment) {
    // if(_expression_datatypes.find("tagcount") != _expression_datatypes.end()) {
    //   feature->add_expression(_primary_experiment, EEDB::Datatype::get_type("tagcount"), 1.0);
    // }
    feature->add_expression(_primary_experiment, _datatype, value);
  }

  return feature;
}

void EEDB::SPStreams::BigWigDB::_show_current_bw_iter() {
  if(!_bw_iter) { return; }
  printf("current _bw_iter :: %lld\n", (long long)_bw_iter);
  printf("  tid = %d\n", _bw_iter->tid);
  printf("  start = %d\n", _bw_iter->start);
  printf("  end = %d\n", _bw_iter->end);
  printf("  offset = %ld\n", _bw_iter->offset);
  printf("  blocksPerIteration = %d\n", _bw_iter->blocksPerIteration);
  printf("  blocks = %lld\n", (long long) _bw_iter->blocks);
  printf("  intervals = %lld\n", (long long) _bw_iter->intervals);
  printf("  entries = %lld\n", (long long) _bw_iter->entries);
  printf("  data = %lld\n", (long long) _bw_iter->data);  
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// methods for building and loading new BAM file into BigWigDB
//
////////////////////////////////////////////////////////////////////////////////////////////////////////

EEDB::Experiment*  EEDB::SPStreams::BigWigDB::experiment() {
  if(_primary_experiment) { return _primary_experiment; }
  
  _init_from_xmldb();

  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(source->classname() != EEDB::Experiment::class_name) { continue; }
    _primary_experiment = (EEDB::Experiment*)source;
    
    //with bigWig there is only one value and one datatype, so grab first one
    map<string, Datatype*> dtypes = _primary_experiment->expression_datatypes();
    _datatype = dtypes.begin()->second;

    break;
  }

  return _primary_experiment;
}


long EEDB::SPStreams::BigWigDB::source_file_size() {
  if(!experiment()) { return -1; }
  EEDB::Metadata  *mdata = experiment()->metadataset()->find_metadata("zenbu:source_file_size", "");
  if(mdata) {  
    long val = strtol(mdata->data().c_str(), NULL, 10);
    return val;
  }

  string file = _zendb_dir+"/"+_db_type + ".bigwig";
  int fildes = open(file.c_str(), O_RDONLY, 0x755);
  if(fildes<0) { return -1; } //error

  long file_size = lseek(fildes, 0, SEEK_END);
  close(fildes);

  string str1 = l_to_string(file_size);
  experiment()->metadataset()->add_tag_data("zenbu:source_file_size", str1);
  save_xmldb();

  return file_size;
}


string EEDB::SPStreams::BigWigDB::source_md5sum() {
  if(!experiment()) { return ""; }
  EEDB::Metadata  *mdata = experiment()->metadataset()->find_metadata("zenbu:source_md5sum", "");
  if(mdata) {  
    return mdata->data();
  }

  string file = _zendb_dir+"/"+_db_type + ".bigwig";
  string cmd = "md5sum "+ file;
  string str1 = exec_result(cmd);
  if(str1.empty()) { return ""; } //can not calculate so just run 
  //fprintf(stderr, "md5sum return : [%s]\n", str1.c_str());

  std::size_t p1 = str1.find(" ");
  if(p1!=std::string::npos) { str1.resize(p1); }
  //fprintf(stderr, "md5sum [%s]\n", str1.c_str());

  //store into experiment
  experiment()->metadataset()->add_tag_data("zenbu:source_md5sum", str1);
  save_xmldb();

  return str1;
}


bool EEDB::SPStreams::BigWigDB::path_to_bigwig_file(string &path, string &filename) {
  if(!experiment()) { return false; }

  path = _zendb_dir+"/"+_db_type + ".bigwig";
  struct stat statbuf; 
  if(stat(path.c_str(), &statbuf) == -1) {
    path = "";
    //fprintf(stderr, "bigwigdb internal bigwig does not exist\n");
    return false;
  }

  EEDB::Metadata *md1 = experiment()->metadataset()->find_metadata("orig_filename", "");
  //EEDB::Metadata *md2 = experiment()->metadataset()->find_metadata("input_filename", "");
  EEDB::Metadata *md3 = experiment()->metadataset()->find_metadata("upload_unique_name", "");
  EEDB::Metadata *md4 = experiment()->metadataset()->find_metadata("original_filename", ""); //older upload system
  //fprintf(stderr, "bigwig path ok1\n");

  if(md1) {
    //orig_filename: new system where this is the name of the original file prior to upload. Usually a full path
    //so just use this but remove the full path
    string tname = md1->data();
    //fprintf(stderr, "orig_filename [%s]\n", tname.c_str());
    std::size_t p1 = tname.rfind("/");
    if(p1!=std::string::npos) { tname = tname.substr(p1+1); }
    //fprintf(stderr, "name from orig_filename [%s]\n", tname.c_str());
    filename = tname;
  } else
  if(md4 || md3) {
    //original_filename or upload_unique_name. means same thing. 
    //the orignal filename with a uuid appended with __ after name and before .bigwig
    string tname;
    if(md3) { tname = md3->data(); }
    if(md4) { tname = md4->data(); }
    //fprintf(stderr, "upload_unique_name [%s]\n", tname.c_str());
    std::size_t p1 = tname.rfind("/");
    if(p1!=std::string::npos) { tname = tname.substr(p1+1); }
    p1 = tname.rfind("__");
    if(p1!=std::string::npos) { tname.resize(p1); }
    tname += ".bigwig";
    //fprintf(stderr, "name from upload_unique_name [%s]\n", tname.c_str());
    filename = tname;
  } else {
    //use the pathname of this BigWigDB
    string tname = _zendb_dir;
    //fprintf(stderr, "name from bigwigdb path [%s]\n", tname.c_str());
    std::size_t p1 = tname.rfind("/");
    if(p1!=std::string::npos) { tname = tname.substr(p1+1); }
    p1 = tname.rfind("__");
    if(p1!=std::string::npos) { tname.resize(p1); }
    p1 = tname.rfind(".bigwigdb");
    if(p1!=std::string::npos) { tname.resize(p1); }
    tname += ".bigwig";
    //fprintf(stderr, "name from bigwigdb path [%s]\n", tname.c_str());
    filename = tname;
  }

  return true;
}

