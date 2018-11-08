/* $Id: OSCFileDB.cpp,v 1.260 2016/09/16 06:58:41 severin Exp $ */

/***

NAME - EEDB::SPStreams::OSCFileDB

SYNOPSIS

DESCRIPTION

Converts a MQDB::Database API interface into the SPStream SourceStream API.
Allows data to be streamed into a federated query via the SPStream API.

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
#include <zlib.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Datatype.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/Peer.h>
#include <EEDB/ChromChunk.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/StreamBuffer.h>
#include <EEDB/SPStreams/OSCFileDB.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::OSCFileDB::class_name = "EEDB::SPStreams::OSCFileDB";

#define READ_BUFSIZE    8192

typedef struct {
  long long int  offset;       //8 byte int
  long int       line_length;  //4 byte int
} rowindex_t;

typedef struct  {
  long long int  offset;       //8 byte int
  long long int  chromnum;     //8 byte int
  long long int  start;        //8 byte int
  long long int  end;          //8 byte int
} chunkindex_t;

typedef struct  {
  long long int  offset;        //8 byte int
  long long int  chromnum;      //8 byte int
  long long int  chrom_length;  //8 byte int
  char           name[256];     //256 bytes
} chromindex_t;

typedef struct {
  char           magickey[8];
  long long int  chrom_section_offset;  //8 byte int
  long long int  numchroms;             //8 byte int
  long long int  chunk_size;            //8 byte int
} cidx_header_t;


//function prototypes
MQDB::DBObject* _spstream_oscfiledb_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::OSCFileDB*)node)->_next_in_stream();
}

MQDB::DBObject* _spstream_oscfiledb_fetch_object_by_id_func(EEDB::SPStream* node, string fid) {
  return ((EEDB::SPStreams::OSCFileDB*)node)->_fetch_object_by_id(fid);
}

void _spstream_oscfiledb_stream_clear_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_stream_clear();
}

void _spstream_oscfiledb_stream_peers_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_stream_peers();
}

void _spstream_oscfiledb_disconnect_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_disconnect();
}

void _spstream_oscfiledb_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_reset_stream_node();
}

bool _spstream_oscfiledb_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::OSCFileDB*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}

void _spstream_oscfiledb_stream_features_by_metadata_search_func(EEDB::SPStream* node, map<string,string> &options);

void _spstream_oscfiledb_stream_chromosomes_func(EEDB::SPStream* node, string assembly_name, string chrom_name) {
  //do nothing
}
void _spstream_oscfiledb_stream_data_sources_func(EEDB::SPStream* node, string classname, string filter_logic) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_stream_data_sources(classname, filter_logic);
}
void _spstream_oscfiledb_get_dependent_datasource_ids_func(EEDB::SPStream* node, map<string,bool> &source_ids) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_get_dependent_datasource_ids(source_ids);
}
void _spstream_oscfiledb_reload_stream_data_sources_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::OSCFileDB*)node)->_reload_stream_data_sources();
}
void _spstream_oscfiledb_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::OSCFileDB*)obj;
}
string _spstream_oscfiledb_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::OSCFileDB*)obj)->_display_desc();
}


EEDB::SPStreams::OSCFileDB::OSCFileDB() {
  init();
}

EEDB::SPStreams::OSCFileDB::~OSCFileDB() {
  if(_database != NULL) {
    _database->release();
    _database = NULL;
  }
  if(_data_buffer != NULL) {
    free(_data_buffer);
    _data_buffer = NULL;
  }
  if(_ridx_fd != -1) {
    close(_ridx_fd);
    _ridx_fd = -1;
  } 
  if(_cidx_fd != -1) {
    close(_cidx_fd);
    _cidx_fd = -1;
  } 
  if(_data_fd != -1) {
    close(_data_fd);
    _data_fd = -1;
  }
}


void EEDB::SPStreams::OSCFileDB::init() {
  EEDB::SPStreams::SourceStream::init();
  _classname                 = EEDB::SPStreams::OSCFileDB::class_name;
  _module_name               = "OSCFileDB";
  _funcptr_delete            = _spstream_oscfiledb_delete_func;
  _funcptr_display_desc      = _spstream_oscfiledb_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream                     = _spstream_oscfiledb_next_in_stream_func;
  _funcptr_fetch_object_by_id                 = _spstream_oscfiledb_fetch_object_by_id_func;
  _funcptr_disconnect                         = _spstream_oscfiledb_disconnect_func;
  _funcptr_stream_clear                       = _spstream_oscfiledb_stream_clear_func;
  _funcptr_stream_by_named_region             = _spstream_oscfiledb_stream_by_named_region_func;
//_funcptr_stream_features_by_metadata_search = _spstream_oscfiledb_stream_features_by_metadata_search_func;
  _funcptr_stream_data_sources                = _spstream_oscfiledb_stream_data_sources_func;
  _funcptr_get_dependent_datasource_ids       = _spstream_oscfiledb_get_dependent_datasource_ids_func;
  _funcptr_reload_stream_data_sources         = _spstream_oscfiledb_reload_stream_data_sources_func;
  _funcptr_stream_chromosomes                 = _spstream_oscfiledb_stream_chromosomes_func;
  _funcptr_stream_peers                       = _spstream_oscfiledb_stream_peers_func;
  _funcptr_reset_stream_node                  = _spstream_oscfiledb_reset_stream_node_func;


  //attribute variables
  _database  = NULL;
  _self_peer = NULL;
  _peer_uuid = NULL;
  _oscfileparser      = NULL;
  _parser_initialized = false;
  _outmode            = FULL_FEATURE;

  _stream_chrom.clear();
  _stream_start        = -1;
  _stream_end          = -1;
  _stream_next_feature = NULL;
    
  _ridx_fd = -1;
  _cidx_fd = -1;
  _data_fd = -1;
  _data_buffer = NULL;
  _data_line_ptr = NULL;
  _data_line_end = NULL;
  _data_bufend = NULL;
  _data_current_seek_pos = 0;
  _data_buffer_size = READ_BUFSIZE*2; //grow as needed up to a 10MB before we fail
  
  _chunk_size = 20000; //20 kilobase (default)
  _version = 0;  //1=oscheader/sqlite version, 2=xml/cidx version
  _modify_time = 0;

  /*
  $self->{'_do_store'} = 1;
  $self->{'_platform'} = "SEQ";
  $self->{'_stream_next_active'} = 0;
  $self->{'debug'} = 0;
  $self->{'_expression_buffer'} = [];
  $self->{'_featuresource_filter_OK'} = 1;
  $self->{'_fsrc'} = undef;
  */
}

string EEDB::SPStreams::OSCFileDB::_display_desc() {
  string str = "OSCFileDB [";
  if(_self_peer) { str += _self_peer->xml(); }
  else if(_database != NULL) { str += _database->full_url(); }
  str += "]";
  return str;
}

/*
string EEDB::SPStreams::OSCFileDB::display_contents() {
  return display_desc();
}
*/

//////////////////////////////////////////////////////////////////////////////////////////////////
//
// connection and initializatio methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////

bool EEDB::SPStreams::OSCFileDB::_init_from_url(string url) {
  string t_driver, t_dbname, t_conn, t_params, t_path;
  string t_hostport, t_userpass;
  size_t  p1;
  struct stat stbuf;
  
  init();
  if(url.empty()) { return false; }

  p1 = url.find("://");
  if(p1==string::npos) { return false; }
  
  t_driver = boost::algorithm::to_lower_copy(url.substr(0, p1));
  t_dbname = url.substr(p1+3);
  if(t_driver != string("oscdb")) { return false; }
  //cout << "db_url=" << url << "\n";

  //do directory exists test
  if(stat(t_dbname.c_str(), &stbuf) == -1) { return false; }
  
  //set _oscdb_dir and test if we can connect to internal sqlite database
  _oscdb_dir = t_dbname;

  struct stat statbuf;
  string path = _oscdb_dir + "/oscdb.xml";
  if(stat(path.c_str(), &statbuf) == 0) {
    _version = 2;
    _modify_time = statbuf.st_mtime;
    return true;
  }
  path = _oscdb_dir + "/oscdb.sqlite";
  if(stat(path.c_str(), &statbuf) == 0) {
    _version = 1;
    _modify_time = statbuf.st_mtime;
    return true;
  }
  return false;
}


MQDB::Database* EEDB::SPStreams::OSCFileDB::database() {
  if(_database != NULL) { return _database; }

  if(_oscdb_dir.empty()) { return NULL; }
  string path = _oscdb_dir + "/oscdb.sqlite";
  string t_url = "sqlite://" + path;
  //if(_debug>0) { fprintf(stderr, "connect supportdb [%s]\n", t_url.c_str());
  struct stat statbuf;
  if(stat(path.c_str(), &statbuf) != 0) { return NULL; }
  
  MQDB::Database *db = new MQDB::Database(t_url);
  if(db == NULL) { return NULL; }
    
  if(!(db->get_connection())) { 
    db->disconnect(); 
    delete db;
    return NULL; 
  }
  _database  = db;
  return _database;
}  


EEDB::Tools::OSCFileParser*  EEDB::SPStreams::OSCFileDB::oscfileparser() {
  if(_parser_initialized) { return _oscfileparser; }

  //OK initiailize the parser for first time
  _parser_initialized = true;
  _oscfileparser = new EEDB::Tools::OSCFileParser();

  if(_version == 1) { _init_from_sqlite(); }
  if(_version == 2) { _init_from_xmldb(); }

  return _oscfileparser;
}


void  EEDB::SPStreams::OSCFileDB::_init_from_xmldb() {
  // ZENBU 2.xxx version OSCDB which uses XML database internally
  // initialize the OSCParser from XML and then transfer up into OSCDB
  string path = _oscdb_dir + "/oscdb.xml";
  oscfileparser()->init_from_xml_file(path);

  // default assembly (generate internally from the "genome_assembly" parameter
  oscfileparser()->default_assembly();
  
  // peer
  if(_self_peer != NULL) { oscfileparser()->set_peer(_self_peer); }
  else { _self_peer = oscfileparser()->peer(); }
  if(_self_peer) { _peer_uuid = _self_peer->uuid(); }
  _database = NULL;

  // sources
  _sources_cache.clear(); //clear old cache    
  vector<EEDB::DataSource*>  sources = oscfileparser()->datasources();
  for(unsigned int i=0; i<sources.size(); i++) {
    EEDB::DataSource  *source = sources[i];
    if(source == NULL) { continue; }
    if(source->classname() == EEDB::FeatureSource::class_name) {
      EEDB::FeatureSource *fsrc = (EEDB::FeatureSource*)source;
      if((fsrc->category() == "block") ||
         (fsrc->category() == "3utr") ||
         (fsrc->category() == "5utr")) {
        fsrc->is_visible(false);
      }         
    }

    //if(_self_peer) { source->peer_uuid(_self_peer->uuid()); }
    
    EEDB::Metadata* md1 = source->metadataset()->find_metadata("zenbu:proxy_id","");
    if(md1) { 
      EEDB::DataSource* ds1 = EEDB::DataSource::sources_cache_get(md1->data());
      if(ds1) {
        //fprintf(stderr, "found real source, copy metadata over to proxy\n");
        source->metadataset()->merge_metadataset(ds1->metadataset());
      }      
      source->db_id(md1->data()); 
      source->metadataset()->remove_metadata_like("keyword","");
    } else {
      if(_self_peer) {
        if(source->peer_uuid() && (source->peer_uuid() != _self_peer->uuid())) {
          fprintf(stderr, "WARN: oscdb parser source peer_uuid different from oscdb\n");
        }
        source->peer_uuid(_self_peer->uuid()); 
      }
    }
    
    string fid = source->db_id();
    _sources_cache[fid] = source;
  }
  _sources_cache_loaded = true;
}


void  EEDB::SPStreams::OSCFileDB::_init_from_sqlite() {
  // ZENBU 1.xxx version with oscheader and sqlite database
  if(!database()) { return; }

  if(peer() == NULL) { return; }
  oscfileparser()->set_peer(_self_peer);

  /*
  // fetch peer from sqlite database
  const char *sql = "SELECT * FROM peer WHERE is_self=1";
  Peer* peer = (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, _database, sql, "s", _database->alias().c_str());
  if(peer) { 
    _self_peer = peer;
    _peer_uuid = peer->uuid();
    _database->uuid(_peer_uuid);
    oscfileparser()->set_peer(peer);
  }
  */

  //first load sources and transfer into parser
  EEDB::SPStreams::SourceStream::_reload_stream_data_sources();
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(source->classname() == EEDB::FeatureSource::class_name) {
      EEDB::FeatureSource *fsrc = (EEDB::FeatureSource*)source;
      if((fsrc->category() == "block") ||
         (fsrc->category() == "3utr") ||
         (fsrc->category() == "5utr")) {
        fsrc->is_visible(false);
      }         
    }    
    oscfileparser()->set_datasource(source);
  }

  //then init from oscheader (or later oscdb xml)
  string path = _oscdb_dir + "/oscdb.oscheader";
  oscfileparser()->init_from_oscheader_file(path);

  //then setup assembly
  string asm_name = oscfileparser()->default_assembly_name();
  EEDB::Assembly *assembly = EEDB::Assembly::fetch_by_name(_database, asm_name);
  oscfileparser()->set_assembly(assembly);
  oscfileparser()->default_assembly();  //to make sure it is set

  _database->disconnect();
}


bool  EEDB::SPStreams::OSCFileDB::_connect_to_files() {
  //if(_ridx_fd == -1) {
  //  string path = _oscdb_dir + "/oscdb.ridx";
  //  _ridx_fd = open(path.c_str(), O_RDONLY, 0x755);
  //  if(_ridx_fd == -1) { fprintf(stderr, "oscdb can't open ridx file [%s]\n", path.c_str()); }
  //} 
  if(_data_fd == -1) {
    string path = _oscdb_dir + "/oscdb.oscdata";
    _data_fd = open(path.c_str(), O_RDONLY, 0x755);
    if(_data_fd == -1) { 
      fprintf(stderr, "oscdb can't open oscdata file [%s]\n", path.c_str()); 
      throw("oscdb error oscdata file");
      return false;
    }
  }

  if(_data_buffer == NULL) {
    _data_buffer = (char*)malloc(_data_buffer_size);
    bzero(_data_buffer, _data_buffer_size);
    _data_bufend = _data_buffer; // points at the end of buffer, \0 added by strncat()
    _data_line_ptr = NULL;
    _data_line_end = NULL;
  }

  if(_data_fd != -1) { return true;} else { return false; }
}


void  EEDB::SPStreams::OSCFileDB::_close_files() {
  if(_ridx_fd != -1) {
    close(_ridx_fd);
    _ridx_fd = -1;
  } 
  if(_cidx_fd != -1) {
    close(_cidx_fd);
    _cidx_fd = -1;
  } 
  if(_data_fd != -1) {
    close(_data_fd);
    _data_fd = -1;
  }
}


bool  EEDB::SPStreams::OSCFileDB::_prepare_data_file(string path) {
  //general purpose initializer for streaming lines from any data file
  //allows for reuse of _prepare_next_line and buffer structures.
  _data_line_ptr = NULL;
  _data_line_end = NULL;
  _data_bufend   = NULL;

  if(path.empty()) { return false; }
  if(_data_fd != -1) {
    close(_data_fd);
    _data_fd = -1;
  }

  _data_fd = open(path.c_str(), O_RDONLY, 0x755);
  if(_data_fd == -1) { 
    fprintf(stderr, "oscdb can't open file [%s]\n", path.c_str()); 
    throw("oscdb error file");
    return false; 
  }

  if(_data_buffer == NULL) {
    _data_buffer = (char*)malloc(_data_buffer_size);
  }
  bzero(_data_buffer, _data_buffer_size);
  _data_bufend = _data_buffer; //buffer empty so bufend is the beginning and \0

  //
  // prepare the buffers
  //
  _data_current_seek_pos = lseek(_data_fd, 0, SEEK_SET);
  
  return _prepare_next_line();
}



//
//////////////////////////////////////////////////////////////////////////////////////////////////
//

/***** fetch_object_by_id
  Description: fetch single object from oscdb datafile
  Arg (1)    : $id (federatedID <uuid>::id:::<class>)
*****/

MQDB::DBObject* EEDB::SPStreams::OSCFileDB::_fetch_object_by_id(string fid) {
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
}


//////////////////////////////////////////////////////////////////////////////////////////////////

/***** stream_peers
  Description: stream all known peers from database
*****/

void EEDB::SPStreams::OSCFileDB::_stream_peers() {
  if(peer() ==NULL) { return; }
  
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  source_stream(streambuffer);
  _self_peer->retain();
  streambuffer->add_object(_self_peer);
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

MQDB::DBObject* EEDB::SPStreams::OSCFileDB::_next_in_stream() {
  MQDB::DBObject *obj = NULL;
  
  //_source_stream is a Buffer for sources,chroms....
  if(_source_stream != NULL) {
    MQDB::DBObject *obj = _source_stream->next_in_stream();
    //if no more objects then clear the source_stream()
    if(obj == NULL) { 
      _source_stream->release();
      _source_stream = NULL;
      //_disconnect();
      _close_files();
    }
    return obj;
  }
  
  //data file section
  if(_stream_next_feature == NULL) { return NULL; } 
  obj = _stream_next_feature;
  
  _prepare_next_line();
  _stream_next_feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, _outmode, _expression_datatypes, _filter_exp_ids);
  if(_stream_next_feature != NULL) {
    _stream_next_feature->peer_uuid(peer_uuid());
    if((_stream_next_feature->chrom_name() != _stream_chrom) or 
       ((_stream_end > 0) and (_stream_next_feature->chrom_start() > _stream_end))) {
      //we are done streaming
      _stream_next_feature->release();
      _stream_next_feature = NULL;
    }
  }

  //check fsrc filter ids if needed
  while(!_fsrc_filter_ids.empty() && _stream_next_feature && (_fsrc_filter_ids.find(_stream_next_feature->feature_source()->primary_id()) == _fsrc_filter_ids.end())) { 
    _prepare_next_line();
    _stream_next_feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, _outmode, _expression_datatypes, _filter_exp_ids);
    if(_stream_next_feature != NULL) {
      _stream_next_feature->peer_uuid(peer_uuid());
      if((_stream_next_feature->chrom_name() != _stream_chrom) or 
         ((_stream_end > 0) and (_stream_next_feature->chrom_start() > _stream_end))) {
        //we are done streaming
        _stream_next_feature->release();
        _stream_next_feature = NULL;
      }
    }
  }
  if(obj==NULL) { _close_files(); }

  return obj;
}


/***** disconnect
  Description: disconnects handle from database, but retains object and 
               all information so that it can be reconnected again 
               at a later time.
*****/

void  EEDB::SPStreams::OSCFileDB::_disconnect() {
  if(_database != NULL) { _database->disconnect(); }
  
  if(_ridx_fd != -1) {
    close(_ridx_fd);
    _ridx_fd = -1;
  } 
  if(_cidx_fd != -1) {
    close(_cidx_fd);
    _cidx_fd = -1;
  } 
  if(_data_fd != -1) {
    close(_data_fd);
    _data_fd = -1;
  }
  if(_data_buffer != NULL) {
    free(_data_buffer);
    _data_buffer = NULL;
  }
  if(_stream_next_feature) {
    _stream_next_feature->release();
    _stream_next_feature = NULL;
  }
  
  _data_line_ptr = NULL;
  _data_line_end = NULL;
  _data_bufend = NULL;
  _stream_chrom.clear();

  //$self->{'_stream_next_active'} = 0;
  _disconnect_count++;
}


/***** stream_clear
  Description: re-initialize the stream-stack back to a clear/empty state
*****/

void EEDB::SPStreams::OSCFileDB::_stream_clear() {
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;
  _disconnect();
}

/***** reset_stream_node
  Description: re-initialize this stream node prior to reconfiguring stream
*****/

void EEDB::SPStreams::OSCFileDB::_reset_stream_node() {
  if(_source_stream != NULL) { _source_stream->release(); }
  _source_stream = NULL;

  oscfileparser();  //make sure it is initialized now
  
  _data_line_ptr = NULL;
  _data_line_end = NULL;
  _stream_chrom.clear();
  _stream_start  = -1;
  _stream_end    = -1;
  if(_stream_next_feature) { _stream_next_feature->release(); }
  _stream_next_feature = NULL;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// old perl API
//
////////////////////////////////////////////////////////////////////////////////////////////////////////


/***** assembly_name

  Description  : simple getter/setter method for the Assembly of this Chrom
  Parameter[1] : string scalar. if specififed it will set the assembly name
  Returntype   : string scalar
  Exceptions   : none

*****/

string EEDB::SPStreams::OSCFileDB::assembly_name() {
  oscfileparser();
  return oscfileparser()->default_assembly_name();
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// override of EEDB::SPStream::SourceStream superclass methods
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


EEDB::Peer* EEDB::SPStreams::OSCFileDB::peer() { 
  if(_self_peer != NULL) { return _self_peer; }

  if(_version == 1) {
    // ZENBU 1.xxx version with oscheader and sqlite database
    if(!database()) { return NULL; }

    // fetch peer from sqlite database
    const char *sql = "SELECT * FROM peer WHERE is_self=1";
    Peer* peer = (EEDB::Peer*) MQDB::fetch_single(EEDB::Peer::create, _database, sql, "s", _database->alias().c_str());
    if(peer) { 
      _self_peer = peer;
      _peer_uuid = peer->uuid();
      _database->uuid(_peer_uuid);
    }
    _database->disconnect();
  }
  if(_version == 2) {
    _peer_from_xml_file();
  }
  return _self_peer;
}

const char* EEDB::SPStreams::OSCFileDB::peer_uuid() { //override from DBObject
  peer();
  return _peer_uuid;
}

void EEDB::SPStreams::OSCFileDB::peer(EEDB::Peer *peer) {
  if(peer==NULL) { return; }
  _self_peer = peer;
  _peer_uuid = peer->uuid();
  if(_database) { _database->uuid(_peer_uuid); }
}


bool EEDB::SPStreams::OSCFileDB::_peer_from_xml_file() {
  int                      fildes;
  off_t                    cfg_len;
  char*                    config_text;
  rapidxml::xml_document<> doc;
  rapidxml::xml_node<>     *root_node, *section_node;

  string path = _oscdb_dir + "/oscdb.xml";
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
  if(!root_node) { return false; }
  if(root_node->name() != string("oscfile")) { return false; }

  // peers section
  section_node = root_node->first_node("peer");
  if(section_node) { 
    EEDB::Peer *peer = EEDB::Peer::new_from_xml(section_node);
    if(peer) { 
      _self_peer = peer;
      _peer_uuid = peer->uuid();
    }
  }
  
  free(config_text);
  return true;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  source streaming section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


void EEDB::SPStreams::OSCFileDB::_stream_data_sources(string classname, string filter_logic) {
  if(!_source_is_active) { return; }
  
  // first check if we need to reload
  _reload_stream_data_sources();
    
  EEDB::SPStreams::StreamBuffer *streambuffer = new EEDB::SPStreams::StreamBuffer();
  _source_stream = streambuffer;
  
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }
    if(!classname.empty() and (source->classname() != classname)) { continue; }
    if(!source->peer_uuid()) { continue; }  //something wrong or a 'proxy' source

    if(!filter_logic.empty()) {
      EEDB::MetadataSet  *mdset = source->metadataset();
      if((mdset != NULL) and (!(mdset->check_by_filter_logic(filter_logic)))) { continue; }
    }
    
    if(_stream_is_datasource_filtered) {
      if(!_filter_source_ids[source->db_id()]) { continue; }
    }
    
    source->retain();
    streambuffer->add_object(source);
  }
  if(_database) { _database->disconnect(); }
}


void EEDB::SPStreams::OSCFileDB::_get_dependent_datasource_ids(map<string, bool> &source_ids) {
  if(!_source_is_active) { return; }
  
  // first check if we need to reload
  _reload_stream_data_sources();
    
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    if(source == NULL) { continue; }
    if(!source->is_active()) { continue; }
    if(!source->is_visible()) { continue; }

    //EEDB::Metadata* md1 = source->metadataset()->find_metadata("zenbu:proxy_id","");
    //if(md1) { source_ids[md1->data()] = true; }  //all sources inside oscdb
    source_ids[source->db_id()] = true;  //all sources inside oscdb
  }
  if(_database) { _database->disconnect(); }
}


void EEDB::SPStreams::OSCFileDB::_reload_stream_data_sources() {
  // first check if we need to reload
  //fprintf(stderr," OSCFileDB::_reload_stream_data_sources [%s] stat files\n", _peer_uuid);
  struct stat statbuf;
  string path;
  if(_version==1) { path = _oscdb_dir + "/oscdb.sqlite"; }
  if(_version==2) { path = _oscdb_dir + "/oscdb.xml"; }
  if(stat(path.c_str(), &statbuf) == 0) {
    if(_modify_time != statbuf.st_mtime) { 
      _modify_time = statbuf.st_mtime;

      fprintf(stderr, "OSCFileDB::_reload_stream_data_sources [%s]\n", _peer_uuid);
      _parser_initialized = false;
      _sources_cache_loaded = false;
      _sources_cache.clear();  //clear old cache
      
      //reinitialize the oscfileparser, rebuild the sources cache
      oscfileparser();
    }
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Feature/Expression section 
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

long long int  EEDB::SPStreams::OSCFileDB::_get_datarow_offset(long int obj_id) {
  rowindex_t rowindex;

  //obj_id is in feature_id space (1 based)
  if(_ridx_fd == -1) {
    string path = _oscdb_dir + "/oscdb.ridx";
    _ridx_fd = open(path.c_str(), O_RDONLY, 0x755);
    if(_ridx_fd == -1) { 
      fprintf(stderr, "oscdb can't open ridx file [%s]\n", path.c_str()); 
      throw("oscdb error ridx file");
      return -1; //error
    }
  }

  lseek( _ridx_fd, ((obj_id-1)*12), SEEK_SET );
  int read_bytes = read(_ridx_fd, &rowindex, 12);

  //then close _ridx_fd until needed again
  close(_ridx_fd);
  _ridx_fd = -1;

  //printf("fetch object[%ld] :: offset[%lld]   len[%ld]\n", obj_id, rowindex.offset, rowindex.line_length);

  if(read_bytes != 12) { return -1; }
  return rowindex.offset;
}


bool  EEDB::SPStreams::OSCFileDB::_seek_to_datarow(long int obj_id) {
  //obj_id is in feature_id space (1 based)
  if(!_connect_to_files()) { return false; }

  // this is a reset operation
  bzero(_data_buffer, _data_buffer_size);
  _data_bufend = _data_buffer;  //reset so buffer is empty and bufend is the beginning and \0
  _data_line_ptr = NULL;
  _data_line_end = NULL;  

  long long int  offset = _get_datarow_offset(obj_id);
  if(offset < 0) { return false; }

  _data_current_seek_pos = lseek( _data_fd, offset, SEEK_SET );
    
  return _prepare_next_line();
}


bool  EEDB::SPStreams::OSCFileDB::_prepare_next_line() {
  //check if next line is contained in buffer, if not move buffer forward

  char  *p1;
  if((_data_line_ptr != NULL) && (_data_line_end != NULL)) {    
    if(_data_line_end < _data_bufend) {
      _data_current_seek_pos += (_data_line_end - _data_line_ptr + 1);
      p1=_data_line_end + 1;    
      //first check for empty lines multiple \n or \r in a row
      while((*p1 == '\n') || (*p1 == '\r')) { p1++; }
      _data_line_ptr = p1; //start of new line
      while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; } 
      if(*p1 != '\0') { 
        *p1 = '\0';  //null terminate the line
        _data_line_end = p1;  // points at the \0 which terminates this line
        //printf("next line :: %s\n", _data_line_ptr);
        return true;  //everything OK
      }
    }    
    //fprintf(stderr, "\nTRUNCATED _data_buffer (%ld chars)----\n%s\n", strlen(_data_line_ptr), _data_line_ptr);
    //fprintf(stderr, "TRUNCATED _data_buffer %ld chars\n", strlen(_data_line_ptr));
    //fprintf(stderr, "  seekpos %lld\n", _data_current_seek_pos);
    
    // we ran off the _data_buffer or we are done
    //  so we need to shift the rest of the buffer to the beginning 
    //  and then read more of the file
    strcpy(_data_buffer, _data_line_ptr); //the end over with \0 char, very efficient
    //printf("new buffer start :: [%s]\n", _data_buffer);
  }
  
  //either buffer is empty or we have a truncated line and need to extend
  _data_line_ptr = NULL;
  _data_line_end = NULL;

  p1=_data_buffer;
  while(*p1 != '\0') { p1++; } 
  _data_bufend = p1;
  
  while(true) {
    //first check if buffer is big enough to read another READ_BUFSIZE chuck
    if(_data_bufend - _data_buffer +READ_BUFSIZE +3 > _data_buffer_size) {
      _data_buffer_size += READ_BUFSIZE*2;
      fprintf(stderr, "need to grow _data_buffer to %lld\n", _data_buffer_size);
      _data_buffer = (char*)realloc(_data_buffer, _data_buffer_size);
      p1=_data_buffer;
      while(*p1 != '\0') { p1++; }
      _data_bufend = p1;
    }
    if(_data_buffer_size > 10*1024*1024) {
      fprintf(stderr, "_data_buffer_size grew beyond >10MB so probably something wrong with the file so fail out\n");
      return false;
    }

    int readCount = read(_data_fd, p1, READ_BUFSIZE);
    if(readCount<=0) { break; }
    //printf("read start [%s]\n", p1);
    
    p1[readCount] = '\0';
    _data_bufend = p1 + readCount;
    //fprintf(stderr, "after read (%ld chars)----\n%s\n", strlen(_data_buffer), _data_buffer);
    //fprintf(stderr, "after read %ld chars\n", strlen(_data_buffer));

    //prepare next line pointers now
    p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; } 
    if((*p1 == '\n') || (*p1 == '\r')) { break; } //found a good line
  }
  if((*p1 != '\n') && (*p1 != '\r')) { return false; } //not a good line
     
  //OK we have a clean line which starts at the beginning of the buffer
  *p1 = '\0';  //null terminate the line
  _data_line_ptr = _data_buffer;
  _data_line_end = p1;  // points at the \0 which terminates this line  
  //fprintf(stderr, "next line :: %s\n", _data_line_ptr);
  return true;
}


EEDB::Feature*  EEDB::SPStreams::OSCFileDB::_fetch_feature_by_id(long int feature_id) {
  //reconnect if needed
  if(!_connect_to_files()) { return NULL; }
  if(!_seek_to_datarow(feature_id)) { return NULL; }

  oscfileparser();  //initialize if not already

  //convert between _sourcestream_output string and oscparser outmode enum
  t_outputmode outmode = FULL_FEATURE;
  if(_sourcestream_output == "subfeature") { outmode = SUBFEATURE; }
  if(_sourcestream_output == "simple_feature") { outmode = SIMPLE_FEATURE; }
  if(_sourcestream_output == "feature") { outmode = FULL_FEATURE; }
  if(_sourcestream_output == "express") { outmode = FULL_FEATURE; }
  if(_sourcestream_output == "edge") { outmode = SIMPLE_FEATURE; }
  
  EEDB::Feature* feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, outmode, _expression_datatypes, _filter_exp_ids);
  
  // NULL the pointers so no further streaming happens
  _data_line_ptr = NULL;
  _data_line_end = NULL;
  
  if(feature==NULL) { return NULL; }
  
  feature->peer_uuid(peer_uuid());
  return feature;
}


void EEDB::SPStreams::OSCFileDB::test_stream() {
  struct timeval    starttime,endtime,difftime;
  double            mbytes, rate;

  gettimeofday(&starttime, NULL);

  oscfileparser();  //initialize if not already

  string header = oscfileparser()->oscheader();
  printf("%s\n", header.c_str());
  oscfileparser()->display_info();

  //convert between _sourcestream_output string and oscparser outmode enum
  t_outputmode outmode = FULL_FEATURE;
  if(_sourcestream_output == "subfeature") { outmode = SUBFEATURE; }
  if(_sourcestream_output == "simple_feature") { outmode = SIMPLE_FEATURE; }
  if(_sourcestream_output == "feature") { outmode = FULL_FEATURE; }
  if(_sourcestream_output == "express") { outmode = FULL_FEATURE; }
  if(_sourcestream_output == "edge") { outmode = SIMPLE_FEATURE; }
  
  gettimeofday(&starttime, NULL);
  long int count=0;
  _seek_to_datarow(1);
  while(_prepare_next_line()) {
    count++;
    EEDB::Feature* feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, outmode, _expression_datatypes, _filter_exp_ids);
    if(!feature) { 
      fprintf(stderr, "error with line [%s]\n", oscfileparser()->output_current_dataline().c_str());
    } else { 
      feature->release(); 
    }
    
    if(count % 100000 == 0) {
      mbytes = ((double)_data_current_seek_pos/(1024.0*1024.0));
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("%10ld features  %13.2f obj/sec", count, rate);
      rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      printf("  %13.3f mbytes/sec\n", rate);
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  printf("%10ld features  %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  printf("%1.6f obj/sec\n", rate);
}




bool  EEDB::SPStreams::OSCFileDB::_stream_by_named_region(
            string assembly_name, string chrom_name, long int start, long int end) {

  if(!_source_is_active) { return true; }
  if(!_connect_to_files()) { return false; }

  //fprintf(stderr, "OSCFileDB::_stream_by_named_region [%s] %s :: %s : %ld .. %ld\n", peer_uuid(), assembly_name.c_str(), chrom_name.c_str(), start, end);
  //fprintf(stderr, "%s\n", _oscdb_dir.c_str());
  //printf("  outmode = [%s]\n", _sourcestream_output.c_str());

  oscfileparser();  //initialize if not already

  if(this->assembly_name() != assembly_name) { return true; }  //wrong assembly so return empty stream

  //convert between _sourcestream_output string and oscparser output datatype enum
  _outmode = FULL_FEATURE;
  if(_sourcestream_output == "subfeature")       { _outmode = SUBFEATURE; }
  if(_sourcestream_output == "simple_feature")   { _outmode = SIMPLE_FEATURE; }
  if(_sourcestream_output == "feature")          { _outmode = FULL_FEATURE; }
  if(_sourcestream_output == "express")          { _outmode = FULL_FEATURE; }
  if(_sourcestream_output == "edge")             { _outmode = SIMPLE_FEATURE; }
  if(_sourcestream_output == "simple_express")   { _outmode = SIMPLE_EXPRESSION; }
  if(_sourcestream_output == "skip_metadata")    { _outmode = SKIPMETADATA; }
  if(_sourcestream_output == "skip_expression")  { _outmode = SKIPEXPRESSION; }
  
  _stream_chrom = chrom_name;
  if(start>0) { _stream_start = start; }
  if(end>0)   { _stream_end   = end; }
  
  //switch between cidx and sqlite modes
  //not indexing is non-fatal (return true is ok). usually means query is out of range
  if(_version==1) {
    if(!_region_index_sqlite(assembly_name, chrom_name, start, end)) { _close_files(); return true; }
  } 
  if(_version==2) {
    if(!_region_index_cidx(assembly_name, chrom_name, start, end)) { _close_files(); return true; }
  }
  
  int skip_count=0;
  
  //setup fsrc and exp filters  
  _fsrc_filter_ids.clear();
  _exp_filter_ids.clear();
  for(map<string, bool>::iterator it = _filter_source_ids.begin(); it != _filter_source_ids.end(); it++) {
    string fid = (*it).first;
    string uuid, objClass;
    long int objID;
    unparse_eedb_id(fid, uuid, objID, objClass);
    if(uuid.empty()) { continue; }
    if(objClass == string("FeatureSource")) { _fsrc_filter_ids[objID]=true; }
    if(objClass == string("Experiment"))    { _exp_filter_ids[objID]=true; }
  }

  //skip ahead in the stream to first valid feature
  _stream_next_feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, _outmode, _expression_datatypes, _filter_exp_ids);

  if(!_stream_next_feature) { _close_files(); return true; }
  if((_stream_end>0) && (_stream_next_feature->chrom_start() > _stream_end)) {
    _stream_next_feature->release();
    _stream_next_feature = NULL;
    _close_files();
    return true;
  }

  _stream_next_feature->peer_uuid(peer_uuid());
  //fprintf(stderr, "indexed feature : %s", _stream_next_feature->simple_xml().c_str());

  while((_stream_next_feature != NULL) and (_stream_next_feature->chrom_name() == chrom_name) and (_stream_next_feature->chrom_end() < _stream_start)) {
    //_stream_next_feature->peer_uuid(peer_uuid());
    //printf("skip over feature\n%s", _stream_next_feature->simple_xml().c_str());
    skip_count++;
    _stream_next_feature->release();

    _prepare_next_line();
    _stream_next_feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, _outmode, _expression_datatypes, _filter_exp_ids);
  }
  if(!_stream_next_feature) { 
    //fprintf(stderr, "no vaid next_feature so just end\n");
    return true; 
  }

  //check fsrc filter ids if needed
  while(!_fsrc_filter_ids.empty() && _stream_next_feature && (_fsrc_filter_ids.find(_stream_next_feature->feature_source()->primary_id()) == _fsrc_filter_ids.end())) {
    //next_feature failed the _fsrc_filter_id test so move to next feature
    _prepare_next_line();
    _stream_next_feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, _outmode, _expression_datatypes, _filter_exp_ids);
    if(_stream_next_feature != NULL) {
      _stream_next_feature->peer_uuid(peer_uuid());
      if((_stream_next_feature->chrom_name() != _stream_chrom) or
         ((_stream_end > 0) and (_stream_next_feature->chrom_start() > _stream_end))) {
        //we are done streaming
        _stream_next_feature->release();
        _stream_next_feature = NULL;
      }
    }
  }

  //fprintf(stderr, "skipped %d features\n", skip_count);
  //fprintf(stderr, "first valid feature : %s\n", _stream_next_feature->simple_xml().c_str());
  return true;
}


bool  EEDB::SPStreams::OSCFileDB::_region_index_sqlite(string assembly_name, string chrom_name, long int start, long int end) {
  
  if(database()==NULL) { return false; }
  
  EEDB::Chrom *chrom = EEDB::Chrom::fetch_by_name(_database, assembly_name, chrom_name);
  if(!chrom) { return false; }
  
  //search internal sqlite database for chrom/chunk-offset information
  //chunk offsets are stored in features with metadata in current version
  _stream_chrom = chrom->chrom_name();
  if(start>0) { _stream_start = start; }
  if(end>0)   { _stream_end   = end; }
  
  EEDB::ChromChunk *start_chunk = EEDB::ChromChunk::fetch_first_for_region_start(_database, assembly_name, chrom_name, start);
  if(start_chunk==NULL) { _database->disconnect(); return false; }
  //start_chunk->display_info();
  
  char strbuf[2048];
  snprintf(strbuf, 2040, "chunk%ld", start_chunk->primary_id());
  
  const char* sql = "SELECT data FROM feature JOIN feature_2_metadata using(feature_id) \
  JOIN metadata using(metadata_id) WHERE primary_name = ? and data_type=\"oscdb_fid\" limit 1";
  dynadata val = _database->fetch_col_value(sql, "s", strbuf);
  if(val.type == MQDB::UNDEF) { _database->disconnect(); return false; }
  long int start_fid = strtol(val.i_string.c_str(), NULL, 10);
  _database->disconnect(); 
  
  _seek_to_datarow(start_fid);  
  if(_data_line_ptr==NULL) { return false; } //problem;
  return true;  
}


bool  EEDB::SPStreams::OSCFileDB::_region_index_cidx(string assembly_name, string chrom_name, long int start, long int end) {
  //struct timeval    starttime,endtime,difftime;
  //double            mbytes, rate, runtime;
  chromindex_t      *current_chrom = NULL;
  chunkindex_t      chunkindex;
  cidx_header_t     cidx_header;
  
  //fprintf(stderr, "_region_index_cidx  %s :: %s : %ld .. %ld\n", assembly_name.c_str(), chrom_name.c_str(), start, end);
  //gettimeofday(&starttime, NULL);
  
  if(_cidx_fd == -1) {
    string cidx_path = _oscdb_dir + "/oscdb.cidx";
    _cidx_fd = open(cidx_path.c_str(), O_RDONLY, 0644);
    if(_cidx_fd == -1) { 
      fprintf(stderr, "oscdb can't open cidx file [%s]\n", cidx_path.c_str()); 
      throw("oscdb error cidx file");
      return false; //error
    }
    
    //read header and cache chromosome on first load
    if(_chrom_indexes.empty()) {
      if(read(_cidx_fd, &cidx_header, sizeof(cidx_header)) != sizeof(cidx_header)) { 
        close(_cidx_fd);
        _cidx_fd = -1;
        return false; 
      }
      //fprintf(stderr, "read cidx header\n");
      //fprintf(stderr, "  numchroms = %lld\n", cidx_header.numchroms);
      //fprintf(stderr, "  chunk_size = %lld\n", cidx_header.chunk_size);
      //fprintf(stderr, "  chrom_offset = %lld\n", cidx_header.chrom_section_offset);
      //fprintf(stderr, "  sizeof(off_t) = %ld\n", sizeof(off_t));
    
      _chunk_size = cidx_header.chunk_size;
    
      lseek( _cidx_fd, cidx_header.chrom_section_offset, SEEK_SET );
      for(int i=0; i<cidx_header.numchroms; i++) {
        chromindex_t *tchrom = (chromindex_t*)malloc(sizeof(chromindex_t));
        bzero(tchrom, sizeof(chromindex_t));
        read(_cidx_fd, tchrom, sizeof(chromindex_t));
        _chrom_indexes.push_back(tchrom);
      }
    }
  }

  // reset data buffers and pointers to new data line
  bzero(_data_buffer, _data_buffer_size);
  _data_bufend = _data_buffer; //reset so bufend is the beginning of buffer and \0
  _data_line_ptr = NULL;
  _data_line_end = NULL;
  
  // get chunk, seek into data file, and prepare line buffers
  for(unsigned int i=0; i<_chrom_indexes.size(); i++) {
    chromindex_t *tchrom = (chromindex_t *)_chrom_indexes[i];
    //fprintf(stderr, "chrom [%lld] offset=%lld : [%s]\n", tchrom->chromnum, tchrom->offset, tchrom->name);
    if(chrom_name == tchrom->name) { current_chrom=tchrom; break; }
  }
  if(!current_chrom) { 
    close(_cidx_fd);
    _cidx_fd = -1;
    return false; 
  }
  //fprintf(stderr, "current_chrom [%lld] offset=%lld : [%s] length=%lld\n", current_chrom->chromnum, current_chrom->offset, current_chrom->name, current_chrom->chrom_length);
  long int      chunknum = start / _chunk_size;
  long long int offset = current_chrom->offset + (chunknum * sizeof(chunkindex_t));
  //fprintf(stderr, "chunknum=%ld  offset=%lld\n", chunknum, offset);

  lseek( _cidx_fd, offset, SEEK_SET );
  bzero(&chunkindex, sizeof(chunkindex_t));
  read(_cidx_fd, &chunkindex, sizeof(chunkindex_t));
  //fprintf(stderr, "  chunk %lld [%lld] %lld .. %lld\n", chunkindex.offset, chunkindex.chromnum, chunkindex.start, chunkindex.end);
  if((chunkindex.chromnum != current_chrom->chromnum) || (chunkindex.start != chunknum * _chunk_size + 1)) {
    //fprintf(stderr, "ERROR reading chunkindex -- not match\n");
    //fprintf(stderr, "  current_chrom [%lld] offset=%lld : [%s] length=%lld\n", current_chrom->chromnum, current_chrom->offset, current_chrom->name, current_chrom->chrom_length);
    //fprintf(stderr, "  chunk %lld [%lld] %lld .. %lld\n", chunkindex.offset, chunkindex.chromnum, chunkindex.start, chunkindex.end);
    close(_cidx_fd);
    _cidx_fd = -1;
    return false;
  }

  _data_current_seek_pos = lseek( _data_fd, chunkindex.offset, SEEK_SET );
  //fprintf(stderr, "chunk seek %lld\n", _data_current_seek_pos);

  // fill the buffer and get ready for processing
  bool rtn = _prepare_next_line();
  close(_cidx_fd);
  _cidx_fd = -1;
  return rtn;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  internal methods for building .oscdb structure
//  section for sorting the OSCdb file and building the indexes
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

void  EEDB::SPStreams::OSCFileDB::set_parameter(string tag, string value) {
  if(tag.empty()) { return; }
  if(value.empty()) { return; }

  //convert aliases to official names
  if(tag == "genome_assemblies")    { tag = "genome_assembly"; }
  if(tag == "genome")               { tag = "genome_assembly"; }
  if(tag == "assembly_name")        { tag = "genome_assembly"; }
  if(tag == "assembly")             { tag = "genome_assembly"; }
  if(tag == "platform")             { tag = "eedb:platform"; }

  if(tag == "oneline-onecount")         { tag = "_singletagmap_expression"; }
  if(tag == "single_sequencetags")      { tag = "_singletagmap_expression"; }
  if(tag == "singletagmap_expression")  { tag = "_singletagmap_expression"; }

  if(tag == "build_dir")            { tag = "_build_dir"; }
  if(tag == "deploy_dir")           { tag = "_deploy_dir"; }
  
  //do not allow later parameters to over-write previous parameters
  if(_parameters.find(tag) != _parameters.end()) { return; }

  _parameters[tag] = value;
}


string  EEDB::SPStreams::OSCFileDB::error_message() {
  //error message is set if there is a detected problem during creating
  return _error_msg;
}

/***** create_db_for_file

  Description: convert an OSCFile into an OSCFileDB by sorting, indexing and
               building a support eeDB database.  creates a directory xxxx.oscdb
               which can be referenced with eeDB URL like
                  oscdb:///root/full/path/to/library123.oscdb
  Arg (1)    : $fullpath (string)  full path to the file to be read
  Returntype : <string> url for this new database

*****/

string  EEDB::SPStreams::OSCFileDB::create_db_for_file(string filepath) {
  //unless(filepath =~ /^\//) { filepath = getcwd ."/". filepath; }
  _parameters["_inputfile"] = filepath;
  
  if(!_create_oscdb_dir()) { 
    _error_msg = "filesystem error: unable to create new oscdir";
    return "";   //empty meaning failed
  }  

  //initialize oscfileparser
  map<string,string>::iterator    p_it;
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    oscfileparser()->set_parameter((*p_it).first, (*p_it).second);
  }  
  if(!oscfileparser()->init_from_file(filepath)) { 
    _error_msg="unable to parse file format"; 
    return ""; 
  }  
  if(!oscfileparser()->default_assembly()) { //to make sure it is initialized
    _error_msg="no genome_assembly is defined"; 
    return "";
  }
  if(!oscfileparser()->primary_feature_source()) { //to make sure it is initialized
    _error_msg="problem creating oscfile primary_feature_source"; 
    return "";
  }

  int chrom_idx, start_idx, end_idx, strand_idx; 
  oscfileparser()->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
  if(chrom_idx== -1 || start_idx==-1) {
    _error_msg="malformed file: does not defined chrom or chrom_start columns"; 
    return "";
  }

  oscfileparser()->peer()->alias(_parameters["_build_filename"]);
  _parser_initialized = true;

  //chrom subdivide, sort, recombine so there is a single file 
  //in the proper sort order so it can properly indexed by chrom and chrom_chunk 
  string datapath = oscfileparser()->get_parameter("_inputfile");
  if(!_sort_input_file(datapath)) { 
    _error_msg +=" failed to parse and sort"; 
    return "";
  }  
  
  //now create indexes
  if(!_build_indexes()) { 
    _error_msg += " internal error in datafile, unable to parse/index"; 
    return ""; 
  }
  
  //last step write out the XML setup
  string xml_path = _oscdb_dir + "/oscdb.xml";
  int xmlfd = open(xml_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  if(xmlfd == -1) { 
    fprintf(stderr, "filessystem error: can't open oscdb.xml file [%s]\n", xml_path.c_str()); 
    return ""; //error
  }
  string xml_buffer;  
  oscfileparser()->xml(xml_buffer);
  write(xmlfd, xml_buffer.c_str(), xml_buffer.size());
  close(xmlfd);
  
  _copy_self_to_deploy_dir();  //performs copy if needed, resets _oscdb_dir variable
  
  // copy the peer created in the parser into the oscdb so it can
  // be used directly after building
  peer(oscfileparser()->peer());

  string oscdb_url = "oscdb://" + _oscdb_dir;
  return oscdb_url;
}


bool  EEDB::SPStreams::OSCFileDB::upgrade_db() {
  //code to convert version1 (oscheader/sqlite) oscdb into
  //  version2 (xml, cidx) oscdb
  
  //initialize oscfileparser if not already
  oscfileparser();

  if(_version == 2) { return false; } //already upgraded

  string owner_ident = oscfileparser()->primary_feature_source()->owner_identity();
  if(owner_ident.empty()) { 
    EEDB::Metadata *md = oscfileparser()->primary_feature_source()->metadataset()->find_metadata("eedb:owner_OpenID", "");
    if(md) { owner_ident = md->data(); }
  }
  
  //now create indexes
  if(!_build_indexes()) { return false; }
  
  //make sure sources are cached with metadata, and clean up
  stream_data_sources("", "  "); //non-empty filter to trigger metadata load
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    source->owner_identity(owner_ident);
    source->metadataset()->remove_metadata_like("osc_header","");
    source->metadataset()->remove_metadata_like("eedb:owner_OpenID","");
    source->metadataset()->remove_metadata_like("eedb:owner_nickname","");
    source->metadataset()->remove_metadata_like("eedb:owner_email","");
    source->metadataset()->remove_metadata_like("eedb:owner_uuid","");
  }

  //last step write out the XML database
  return _save_xml();
}


bool  EEDB::SPStreams::OSCFileDB::save_xmldb() {
  //initialize oscfileparser if not already
  oscfileparser();
  
  if(_version == 1) { //first need to upgrade to version2 system
    if(!_build_indexes()) { return false; }
  }
  
  oscfileparser();
  string owner_ident = oscfileparser()->primary_feature_source()->owner_identity();

  //make sure sources are cached with metadata, and clean up
  stream_data_sources("", "  "); //non-empty filter to trigger metadata load
  map<string, EEDB::DataSource*>::iterator it;
  for(it = _sources_cache.begin(); it != _sources_cache.end(); it++) {
    EEDB::DataSource* source = (*it).second;
    source->peer_uuid(peer()->uuid());  //reset uuid to keep in sync
    source->metadataset()->remove_metadata_like("osc_header","");
    source->metadataset()->remove_metadata_like("eedb:owner_OpenID","");
    source->metadataset()->remove_metadata_like("eedb:owner_nickname","");
    source->metadataset()->remove_metadata_like("eedb:owner_email","");
    source->metadataset()->remove_metadata_like("eedb:owner_uuid","");
    if(!owner_ident.empty()) { source->owner_identity(owner_ident); }
  }

  //version the old XML database
  string xml_path = _oscdb_dir + "/oscdb.xml";
  struct stat statbuf;
  string tpath = xml_path+".orig";
  if(stat(tpath.c_str(), &statbuf) != 0) {
    //does not exist
    string cmd = "cp "+xml_path+" "+tpath;
    system(cmd.c_str());
  }
  tpath = xml_path+".bck";
  string cmd = "cp "+xml_path+" "+tpath;
  //fprintf(stderr, "%s", cmd.c_str());
  system(cmd.c_str());
  
  //last step write out the new XML database
  return _save_xml();
}


bool  EEDB::SPStreams::OSCFileDB::_save_xml() {
  //write out the XML setup
  oscfileparser()->clear_parameter("filetype");
  string xml_path = _oscdb_dir + "/oscdb.xml";
  int xmlfd = open(xml_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  if(xmlfd == -1) { 
    fprintf(stderr, "oscdb can't open xml file [%s]\n", xml_path.c_str()); 
    return false; //error
  }
  string xml_buffer;
  oscfileparser()->xml(xml_buffer);
  write(xmlfd, xml_buffer.c_str(), xml_buffer.size());
  close(xmlfd);
  
  return true;
}


bool  EEDB::SPStreams::OSCFileDB::_create_oscdb_dir() {
  _oscdb_dir.clear();
  _parameters["_input_dir"].clear();

  string filepath = _parameters["_inputfile"];
  if(filepath.empty()) { return false; }

  size_t ridx = filepath.rfind("/");
  if(ridx!=string::npos) {
    _parameters["_input_dir"] = filepath.substr(0,ridx);
    filepath = filepath.substr(ridx+1);
  }
  
  string extension;    
  size_t strpos = filepath.rfind(".gz");
  if(strpos!=string::npos) { filepath.resize(strpos); }
  strpos = filepath.rfind(".");
  if(strpos!=string::npos) {
    extension = filepath.substr(strpos+1);
    filepath.resize(strpos);
  }
  _parameters["_build_filename"] = filepath;
  
  if(_parameters.find("_build_dir") != _parameters.end()) { 
    //should also check to make sure the build_dir exists with a stat()
    _oscdb_dir = _parameters["_build_dir"] +"/"+ filepath + ".oscdb";
  } else if(!_parameters["_input_dir"].empty()) {
    _oscdb_dir = _parameters["_input_dir"] +"/"+ filepath + ".oscdb";
  } else {
    _oscdb_dir = filepath + ".oscdb";
  }
  if(mkdir(_oscdb_dir.c_str(), 0000755)== -1) {
    if(errno != EEXIST) { return false; }  //already existing is OK, otherwise error
  }
  return true;  
}


bool  EEDB::SPStreams::OSCFileDB::_sort_input_file(string path) {
  //
  // read the input file and subdivide into separate chromosomes
  //
  struct timeval    starttime,endtime,difftime;
  double            mbytes, rate, runtime;
  t_outputmode      outmode = SIMPLE_FEATURE;
  map<string, int>  chrom_outfiles;
  string            linebuffer;
  char              buffer[8192];
  long long int     feature_id=1;
  map<string, EEDB::Chrom*>  chroms;

  if(path.empty()) { return false; }
  fprintf(stderr,"_sort_input_file [%s]\n", path.c_str());

  gzFile gz = gzopen(path.c_str(), "rb");
  if(!gz) { return false; }  //failed to open
  
  //prepare the reading buffer, need extra big for verbose oscheader lines
  if(_data_buffer != NULL) {
    free(_data_buffer);
    _data_buffer = NULL;
  }

  long long buflen = 10*1024*1024; //10MB
  _data_buffer = (char*)malloc(buflen);
  bzero(_data_buffer, buflen);
  
  string filetype  = oscfileparser()->get_parameter("filetype");

  //first I need to split the file on chromosome since the unix sort does not allow
  //mixing of alpha and numerical sorting on different columns
  string workdir = _oscdb_dir + "/workdir/";
  if(mkdir(workdir.c_str(), 0000755)== -1) {
    if(errno != EEXIST) { return false; }  //already existing is OK, otherwise error
  }

  oscfileparser()->set_parameter("_skip_ignore_on_output", "true");

  gettimeofday(&starttime, NULL);
  long int count=0;
  long last_update=starttime.tv_sec;
  string tline;
  while(gzgets(gz, _data_buffer, buflen) != NULL) {
    if(_data_buffer[0] == '#') { continue; }

    if(filetype == "osc") { 
      if(_data_buffer[0] == '#') { continue; }
      if(count==0) { //first non-parameter/comment line is the header columns line
        count++;
        fprintf(stderr, "_sort_input_file -- oscheader [%s]\n", _data_buffer);
        continue;
      }
    }
    if(filetype == "bed") { 
      if(strncmp(_data_buffer, "track ", 6) == 0) { continue; }
      if(strncmp(_data_buffer, "browser ", 8) == 0) { continue; }
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
    EEDB::Feature* feature = oscfileparser()->convert_dataline_to_feature(_data_buffer, outmode, _expression_datatypes, _filter_exp_ids);
    if(!feature) { 
      snprintf(buffer, 8190, "datafile error, unable to parse line %ld --[", count);
      _error_msg = buffer + tline + "]";
      return false;
    }
    linebuffer = oscfileparser()->output_current_dataline();
    
    string chrname = "unmapped";
    if(feature->chrom()) { 
      chrname = feature->chrom()->chrom_name();
      if(chrname == "*") { chrname = "unmapped"; } 
    }

    if(filetype == "sam") { 
      //need to prepend chrom_end, strand to the beginning of the SAM line
      snprintf(buffer, 8190, "%ld\t%c\t", feature->chrom_end(), feature->strand());
      linebuffer = buffer + linebuffer;
    }

    if(feature->chrom_end() > feature->chrom()->chrom_length()) {
      feature->chrom()->chrom_length(feature->chrom_end());
    }
       
    int chrfd=0;
    if(chrom_outfiles.find(chrname) == chrom_outfiles.end()) {
      //create chrom outfile
      string tpath = workdir + chrname;
      //fprintf(stderr, "create chr_outfile [%s]\n", tpath.c_str());
      chrfd = open(tpath.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
      chrom_outfiles[chrname] = chrfd;
      chroms[chrname] = feature->chrom();
    } else {
      chrfd = chrom_outfiles[chrname];
    }
    write(chrfd, linebuffer.c_str(), linebuffer.length());
    
    feature->release();

    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 3) {
      last_update = endtime.tv_sec;
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
    }
  }
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld features  %13.2f obj/sec\n", count, rate);
    
  //close files
  gzclose(gz);
  map<string, int>::iterator chr_it;
  for(chr_it=chrom_outfiles.begin(); chr_it!=chrom_outfiles.end(); chr_it++) {
    close((*chr_it).second);
    //maybe do something else here since we know all the chromosomes in the file now
  }
  //close the input file?
  close(_data_fd);
  _data_fd = -1;


  //
  // sort the chrom files now and merge into oscdb.oscdata
  // since the column order is not fixed I need to calculate these numbers
  // sort order should be [start,end,strand] and sort command is 1based
  //
  oscfileparser()->remove_ignore_columns();

  //get chromosome indexes from the parser
  int chrom_idx, start_idx, end_idx, strand_idx; 
  oscfileparser()->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
  if(filetype == "sam") { 
    end_idx = 0;
    strand_idx = 1;
    chrom_idx += 2;
    start_idx += 2; 
  }
  
  string sort_cmd;
  snprintf(buffer, 8190, "sort -n -k%d ", start_idx+1);
  sort_cmd = buffer;
  if(end_idx != -1) { 
    snprintf(buffer, 8190, "-k%d ", end_idx+1);
    sort_cmd += buffer;
  }
  if(strand_idx != -1) { 
    snprintf(buffer, 8190, "-k%d ", strand_idx+1);
    sort_cmd += buffer;
  }
    
  string oscdb_file = _oscdb_dir + "/oscdb.oscdata";
  unlink(oscdb_file.c_str());  
  int oscdb_fd = open(oscdb_file.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);

  //sort chromosomes by chrom_length for merging
  list<EEDB::Chrom*>                  chrom_list;
  list<EEDB::Chrom*>::iterator        chr_it3;
  map<string, EEDB::Chrom*>::iterator chr_it2;
  
  for(chr_it2=chroms.begin(); chr_it2!=chroms.end(); chr_it2++) {
    chrom_list.push_back((*chr_it2).second);
  }
  chrom_list.sort(chrom_length_sort_func);
  
  for(chr_it3=chrom_list.begin(); chr_it3!=chrom_list.end(); chr_it3++) {
    (*chr_it3)->display_info();
    
    string chrfile     = workdir + (*chr_it3)->chrom_name();
    string sortchrfile = chrfile+".sort";

    string cmd = sort_cmd;
    cmd += chrfile +" > " + sortchrfile;
    system(cmd.c_str());
    
    //concat into main file
    char readbuf[65535];
    FILE *chrfp = fopen(sortchrfile.c_str(), "r");
    while(fgets(readbuf, 65530, chrfp) != NULL) {
      //add an internal feature_id to the object-line
      snprintf(buffer, 8190, "%lld\t", feature_id++);
      linebuffer = buffer;
      
      if(_parameters.find("_singletagmap_expression") != _parameters.end()) { 
        //new system will allow TPM normalization of tagcount/raw columns without a mapcount column
        //will assume mapcount=1 if if is not specified.
        //places it between the feature_id (column1) and everything else
        linebuffer += "1\t";
      }
      
      linebuffer += readbuf;
      
      write(oscdb_fd, linebuffer.c_str(), linebuffer.length());
    }
    fclose(chrfp);
    
    unlink(chrfile.c_str());
    unlink(sortchrfile.c_str());    
  }
  rmdir(workdir.c_str());
  
  //rebuiild the oscfileparser to match the oscdb.oscdata file
  //prepend in reverse order mapcount, tagcount, feature_id to get (id,tagcount,mapcount)
  if(_parameters.find("_singletagmap_expression") != _parameters.end()) { 
    string exp_name = oscfileparser()->primary_feature_source()->name(); //"test_expname";
    oscfileparser()->prepend_column("exp.tagcount." + exp_name);
  }
  oscfileparser()->prepend_column("eedb:feature_id");
  oscfileparser()->postprocess_columns();
  oscfileparser()->reset_to_oscdb();  //oscdb is always TAB separated, and changes filetype
  

  mbytes = ((double)_data_current_seek_pos/(1024.0*1024.0));
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;

  rate = (double)count / runtime;
  fprintf(stderr, "finished sorting input file -- %ld objects\n", count);
  fprintf(stderr, "  %1.6f msec\n", runtime*1000.0);
  fprintf(stderr, "  %1.3f Mbytes\n", mbytes);
  if(rate>1000000.0) {
    fprintf(stderr, "  %1.3f mega objs/sec\n", rate/1000000.0); 
  } else if(rate>2000.0) {
    fprintf(stderr, "  %1.3f kilo objs/sec\n", rate/1000.0); 
  } else {
    fprintf(stderr, "  %1.3f objs/sec\n", rate); 
  }
  fprintf(stderr, "  %1.3f mbytes/sec\n", mbytes/runtime); 

  return true;
}


bool  EEDB::SPStreams::OSCFileDB::_build_indexes() {
  struct timeval    starttime,endtime,difftime;
  double            mbytes, rate;
  t_outputmode      outmode = SIMPLE_FEATURE;
  char              buffer[8192];
  EEDB::Chrom       *current_chrom = NULL;
  char              ridx_buffer[9000], *ridx_bufend;
  char              cidx_buffer[9000], *cidx_bufend;
  rowindex_t        rowindex;
  chunkindex_t      chunkindex;
  cidx_header_t     cidx_header;
  vector<void*>     chroms;  //pointers to malloced chunkindex_t records

  if(_ridx_fd != -1) { close(_ridx_fd); }
  if(_cidx_fd != -1) { close(_cidx_fd); }
  string ridx_path = _oscdb_dir + "/oscdb.ridx";
  _ridx_fd = open(ridx_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  if(_ridx_fd == -1) { 
    fprintf(stderr, "oscdb can't open ridx file [%s]\n", ridx_path.c_str()); 
    return false; //error
  }
  string cidx_path = _oscdb_dir + "/oscdb.cidx";
  _cidx_fd = open(cidx_path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
  if(_cidx_fd == -1) { 
    fprintf(stderr, "oscdb can't open cidx file [%s]\n", cidx_path.c_str()); 
    return false; //error
  }

  fprintf(stderr, "build_indexes\n");
  //printf("sizeof(chunkindex_t) = %ld\n", sizeof(chunkindex_t));
  //printf("sizeof(rowindex_t) = %ld\n", sizeof(rowindex_t));
  
  ridx_bufend = ridx_buffer;
  cidx_bufend = cidx_buffer;
  _chunk_size = 20000; //20 kilobase
  
  //open input file and prepare reading buffers
  string oscdb_file = _oscdb_dir + "/oscdb.oscdata";
  if(!_prepare_data_file(oscdb_file)) { return false; }
  
  // write out cidx header area
  bzero(cidx_buffer, 9000);
  memcpy(cidx_buffer, "ZCIDX001", 8);  //magic key
  write(_cidx_fd, cidx_buffer, 2048);

  vector<EEDB::Tools::OSC_column*>  exp_columns = oscfileparser()->get_expression_columns();
  EEDB::Tools::OSC_column          *mapcount_column = NULL;
  for(unsigned int i=0; i<exp_columns.size(); i++) {
    exp_columns[i]->express_total   = 0.0;
    exp_columns[i]->singlemap_total = 0.0;
    exp_columns[i]->mapnorm_total   = 0.0;
    if(exp_columns[i]->datatype == EEDB::Datatype::get_type("mapcount")) {
      fprintf(stderr, "has mapcount column [%d] : perform mapnormalization\n", exp_columns[i]->colnum);
      mapcount_column = exp_columns[i];
    }
  }

  //
  // single pass: chunk indexing, row indexing, expression totaling, name indexing
  //
  gettimeofday(&starttime, NULL);
  long last_update=starttime.tv_sec;
  long long int count=0;
  chunkindex.offset = -1;
  while(_data_line_ptr != NULL) {
    count++;
    rowindex.offset       = _data_current_seek_pos; //8 byte int
    rowindex.line_length  = _data_line_end - _data_line_ptr + 1; //4 byte int
    //fprintf(stderr,"  ridx [%lld] %lld %ld\n", count, rowindex.offset, rowindex.line_length);
    
    EEDB::Feature* feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, outmode, _expression_datatypes, _filter_exp_ids);
    if(!feature) { 
      _error_msg="datafile error, unable to parse line --- " + oscfileparser()->output_current_dataline();
      return false;
    }
    //if(count<10) { printf("%s\n", feature->xml().c_str()); }
    
    if(current_chrom != feature->chrom()) {
      //changed chromosome

      //finish last chromosome, flush cidx_buffer
      if(cidx_bufend > cidx_buffer) {
        write(_cidx_fd, cidx_buffer, cidx_bufend - cidx_buffer);
        bzero(cidx_buffer, 9000);
        cidx_bufend = cidx_buffer;
      }
      
      //prepare next chromosome
      EEDB::Chrom *chrom = feature->chrom();
      current_chrom = chrom;
      //printf("changed chroms to %s", chrom->xml().c_str());
      
      chromindex_t *tchrom = (chromindex_t*)malloc(sizeof(chromindex_t));
      bzero(tchrom, sizeof(chromindex_t));
      tchrom->offset       = lseek(_cidx_fd, 0, SEEK_CUR);
      tchrom->chromnum     = chroms.size();
      tchrom->chrom_length = chrom->chrom_length();
      strncpy(tchrom->name, chrom->chrom_name().c_str(), 255); 
      chroms.push_back(tchrom);

      //create first chunk of new chromosome
      chunkindex.offset   = _data_current_seek_pos;  //points at first feature in/after chunk
      chunkindex.start    = 1; //zenbu is 1base
      chunkindex.end      = _chunk_size;
      chunkindex.chromnum = tchrom->chromnum;
      memcpy(cidx_bufend, &chunkindex, sizeof(chunkindex_t));
      cidx_bufend += sizeof(chunkindex_t);
      //printf("  chunk %lld %lld .. %lld [feature %s]\n", chunkindex.offset, chunkindex.start, chunkindex.end, feature->chrom_location().c_str());
    }
    
    while(feature->chrom_end() >= chunkindex.end) {
      //move chunk forward
      chunkindex.offset   = _data_current_seek_pos;  //points at first feature in/after chunk
      chunkindex.start    += _chunk_size;
      chunkindex.end      = chunkindex.start + _chunk_size -1;
      memcpy(cidx_bufend, &chunkindex, sizeof(chunkindex_t));
      cidx_bufend += sizeof(chunkindex_t);
      //printf("  chunk %lld %ld .. %ld [feature %s]\n", chunkindex.offset, chunkindex.start, chunkindex.end, feature->chrom_location().c_str());

      if(cidx_bufend - cidx_buffer > 8192) {
        write(_cidx_fd, cidx_buffer, cidx_bufend - cidx_buffer);
        bzero(cidx_buffer, 9000);
        cidx_bufend = cidx_buffer;
      }
    }
    
    // ridx
    memcpy(ridx_bufend, &rowindex, 12);
    ridx_bufend += 12;

    //flush buffers
    if(ridx_bufend - ridx_buffer > 8192) {
      write(_ridx_fd, ridx_buffer, ridx_bufend - ridx_buffer);
      bzero(ridx_buffer, 9000);
      ridx_bufend = ridx_buffer;
    }
    if(cidx_bufend - cidx_buffer > 8192) {
      write(_cidx_fd, cidx_buffer, cidx_bufend - cidx_buffer);
      bzero(cidx_buffer, 9000);
      cidx_bufend = cidx_buffer;
    }
    
    // calculate the total expression for each expression column
    for(unsigned int i=0; i<exp_columns.size(); i++) {
      if(exp_columns[i]->data == NULL) { continue; }
      double exp_value = strtod(exp_columns[i]->data, NULL);
      exp_columns[i]->express_total += exp_value;
      
      if(mapcount_column!=NULL) {
        long int mapcount = strtol(mapcount_column->data, NULL, 10);
        if(mapcount>0) {
          if(mapcount == 1) {
            exp_columns[i]->singlemap_total += exp_value;
          } else {
            exp_columns[i]->mapnorm_total += exp_value;            
          }
        }
      }
    }

    feature->release();
    
    gettimeofday(&endtime, NULL);
    if(endtime.tv_sec > last_update + 1) {
      last_update = endtime.tv_sec;
      mbytes = ((double)_data_current_seek_pos/(1024.0*1024.0));
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10lld features  %13.2f obj/sec", count, rate);
      rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "  %13.3f mbytes/sec", rate);
      fprintf(stderr, "  [%lld %ld]\n", rowindex.offset, rowindex.line_length);

    }
    
    _prepare_next_line();
  }
  gettimeofday(&endtime, NULL);
  last_update = endtime.tv_sec;
  mbytes = ((double)_data_current_seek_pos/(1024.0*1024.0));
  timersub(&endtime, &starttime, &difftime);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10lld features  %13.2f obj/sec", count, rate);
  rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "  %13.3f mbytes/sec", rate);
  fprintf(stderr, "  [%lld %ld]\n", rowindex.offset, rowindex.line_length);  
  
  //set total feature_count
  oscfileparser()->primary_feature_source()->feature_count(count);
  
  //write out remaining of output buffers
  if(ridx_bufend > ridx_buffer) { write(_ridx_fd, ridx_buffer, ridx_bufend - ridx_buffer); }
  if(cidx_bufend > cidx_buffer) { write(_cidx_fd, cidx_buffer, cidx_bufend - cidx_buffer); }
  
  //
  // now store the chromosome starts offset section and overwrite header
  //
  memcpy(cidx_header.magickey, "ZCIDX001", 8);  //magic key
  cidx_header.chrom_section_offset = lseek(_cidx_fd, 0, SEEK_CUR);
  cidx_header.numchroms = chroms.size();
  cidx_header.chunk_size = _chunk_size;

  for(unsigned int i=0; i<chroms.size(); i++) {
    chromindex_t *tchrom = (chromindex_t*)chroms[i];
    write(_cidx_fd, tchrom, sizeof(chromindex_t));
    free(tchrom);
  }
  
  lseek(_cidx_fd, 0, SEEK_SET);  //move back to beginning to overwrite header
  write(_cidx_fd, &cidx_header, sizeof(cidx_header));  
  
  //close index and data files
  close(_data_fd);  _data_fd = -1;
  close(_ridx_fd);  _ridx_fd = -1;
  close(_cidx_fd);  _cidx_fd = -1;
  
  
  //transfer expression column totals into the experiment metadata
  for(unsigned int i=0; i<exp_columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = exp_columns[i];
    if(colobj->datatype == NULL) { continue; }
    if(colobj->experiment == NULL) { continue; }
    
    colobj->experiment->add_datatype(colobj->datatype); //to be safe

    snprintf(buffer, 2040, "%f", colobj->express_total);
    EEDB::Metadata *md = colobj->experiment->metadataset()->add_tag_data(colobj->datatype->type() + "_total", buffer);
    fprintf(stderr, "%s\n", md->xml().c_str());

    string dtype = colobj->datatype->type();
    if((dtype == "raw") || (dtype.find("count")!=std::string::npos)) {
      dtype += "_pm";
      colobj->experiment->add_datatype(EEDB::Datatype::get_type(dtype));
      //if(colobj->datatype->type() == "tagcount") { colobj->experiment->add_datatype(EEDB::Datatype::get_type("tpm")); }
    }
    
    if(mapcount_column!=NULL) {
      snprintf(buffer, 2040, "%f", colobj->mapnorm_total);
      md = colobj->experiment->metadataset()->add_tag_data(colobj->datatype->type() + "_mapnorm_total", buffer);    

      snprintf(buffer, 2040, "%f", colobj->singlemap_total);
      md = colobj->experiment->metadataset()->add_tag_data(colobj->datatype->type() + "_singlemap_total", buffer);
    }
    colobj->experiment->metadataset()->remove_duplicates();
  }
  
  return true;
}


bool  EEDB::SPStreams::OSCFileDB::build_feature_md_index() {
  //used for retro-fitting the oscdb_fmd.sqlite after oscdb was loaded
  struct timeval    starttime,endtime,difftime;
  double            mbytes, rate;
  t_outputmode      outmode = FULL_FEATURE;
  
  printf("===== build_feature_md_index\n");
  if(_oscdb_dir.empty()) { return false; }
  
  string path = _oscdb_dir + "/oscdb_fmd.sqlite";
  string t_url = "sqlite://" + path;
  //fprintf(stderr, "connect supportdb [%s]\n", t_url.c_str());
  struct stat statbuf;
  if(stat(path.c_str(), &statbuf) != 0) { 
    MQDB::Database *db = new MQDB::Database(t_url);
    if(db == NULL) { printf("problem1\n"); return false; }
    //fprintf(stderr,"OK create database tables [%s]\n", t_url.c_str());

    db->do_sql("CREATE TABLE symbol ( symbol_id integer PRIMARY KEY AUTOINCREMENT, sym_type char(32) default NULL, sym_value char(255) default NULL, UNIQUE (sym_type,sym_value));");
    db->do_sql("CREATE INDEX symbol_type on symbol (sym_type);");
    db->do_sql("CREATE INDEX symbol_value on symbol (sym_value);");

    db->do_sql("CREATE TABLE feature_2_symbol ( feature_id integer default NULL, symbol_id integer default NULL);");
    db->do_sql("CREATE INDEX f2s_fid on feature_2_symbol(feature_id);");
    db->do_sql("CREATE INDEX f2s_sid on feature_2_symbol(symbol_id);");

    //db->do_sql("CREATE TABLE metadata ( metadata_id integer PRIMARY KEY AUTOINCREMENT, data_type varchar(255) default NULL, data mediumtext );");
    //db->do_sql("CREATE INDEX metadata_type on metadata (data_type);");
    //db->do_sql("CREATE INDEX metadata_data on metadata (data);");

    //db->do_sql("CREATE TABLE feature_2_metadata ( feature_id integer default NULL, metadata_id integer default NULL);");
    //db->do_sql("CREATE INDEX f2m_fid on feature_2_metadata (feature_id);");
    //db->do_sql("CREATE INDEX f2m_mid on feature_2_metadata (metadata_id);");
  }
  
  MQDB::Database *db = new MQDB::Database(t_url);
  if(db == NULL) { return false; }

  if(!(db->get_connection())) { 
    db->disconnect(); 
    delete db;
    return false; 
  }
  _feature_md_sqlite = db;  
  
  //open input file and prepare reading buffers
  string oscdb_file = _oscdb_dir + "/oscdb.oscdata";
  if(!_prepare_data_file(oscdb_file)) { return false; }
    
  //
  // single pass: stream features, build sqlite name indexing
  //
  db->do_sql("BEGIN TRANSACTION;");
  gettimeofday(&starttime, NULL);
  double last_update = (double)starttime.tv_sec + ((double)starttime.tv_usec)/1000000.0;
  long long int count=0;
  while(_data_line_ptr != NULL) {
    count++;
    
    EEDB::Feature* feature = oscfileparser()->convert_dataline_to_feature(_data_line_ptr, outmode, _expression_datatypes, _filter_exp_ids);
    if(!feature) { 
      _error_msg="datafile error, unable to parse line --- " + oscfileparser()->output_current_dataline();
      return false;
    }
    //printf("\n%s", feature->simple_xml().c_str());
    //if(count<10) { printf("%s\n", feature->xml().c_str()); }

    //expand metadata, extract keywords and store into _feature_md_sqlite
    EEDB::MetadataSet* mdset = feature->metadataset();
    mdset->add_tag_data("eedb:display_name", feature->primary_name());
    mdset->extract_keywords();

    vector<EEDB::Metadata*> mdlist = mdset->metadata_list();
    for(unsigned int i=0; i<mdlist.size(); i++) {
      EEDB::Metadata *md = mdlist[i];
      if(md->classname() != EEDB::Symbol::class_name) { continue; }
      if(md->type() != "keyword") { continue; }
      EEDB::Symbol *sym = (EEDB::Symbol*)md;
      if(!sym->check_exists_db(db)) { 
        db->do_sql("INSERT ignore INTO symbol (sym_type, sym_value) VALUES(?,?)", "ss", sym->type().c_str(), sym->data().c_str());
        sym->check_exists_db(db);
      }
      db->do_sql("INSERT ignore INTO feature_2_symbol (feature_id, symbol_id) VALUES(?,?)", "dd", feature->primary_id(), sym->primary_id());
    }

    feature->release();

    gettimeofday(&endtime, NULL);
    double nowtime = (double)endtime.tv_sec + ((double)endtime.tv_usec)/1000000.0;
    if(nowtime > last_update + 0.5) {
      db->do_sql("END TRANSACTION;");
      db->do_sql("BEGIN TRANSACTION;");
      last_update = nowtime;
      mbytes = ((double)_data_current_seek_pos/(1024.0*1024.0));
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10lld features  %13.2f obj/sec", count, rate);
      rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "  %13.3f mbytes/sec", rate);      
      fprintf(stderr, "\n");      
    }
    
    _prepare_next_line();
  }
  db->do_sql("END TRANSACTION;");

  gettimeofday(&endtime, NULL);
  mbytes = ((double)_data_current_seek_pos/(1024.0*1024.0));
  timersub(&endtime, &starttime, &difftime);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10lld features  %13.2f obj/sec", count, rate);
  rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "  %13.3f mbytes/sec\n", rate);

  _feature_md_sqlite->disconnect(); 
  return true;
}


void  EEDB::SPStreams::OSCFileDB::_copy_self_to_deploy_dir() {
  //performs copy if needed, resets _oscdb_dir variable

  if(_parameters.find("_deploy_dir") == _parameters.end()) { return; }
  if(_parameters.find("_build_dir")  == _parameters.end()) { return; }

  string oscdir    = _oscdb_dir;
  string deploydir = _parameters["_deploy_dir"];

  size_t ridx = oscdir.rfind("/");
  if(ridx!=string::npos) {
    deploydir += oscdir.substr(ridx);
  }
  fprintf(stderr, "copy oscdb from [%s]\n to [%s]\n", oscdir.c_str(), deploydir.c_str());
          
  //
  // copy to new location: deploydir may be remote scp format
  //
  string cmd;
  ridx = deploydir.find(":");
  if(ridx != string::npos) {
    string host  = deploydir.substr(0, ridx);
    string fname = deploydir.substr(ridx);
    fprintf(stderr, "copy oscdb back to remote location host[%s] file[%s]\n", host.c_str(), fname.c_str());
    cmd = "scp -rp " + oscdir + " "+ deploydir;
    deploydir = fname;
  } else {
    cmd = "cp -rp " + oscdir + " "+ deploydir;
  }
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());

  /*  new code does not need to rebuild internal peer since it only records uuid (no location)
   
  // change internal oscdb_dir to new location
  _oscdb_dir = $deploydir ."/". $oscdb_name;
  my $dburl = "oscdb://" . _oscdb_dir;

  //if I can not re-establish connection to new location I have to stop here
  unless($self->database()) { return undef; }

  $self->database()->execute_sql("DELETE from peer"); //clear old "selfs"

  // build internal peer
  my $peer = new EEDB::Peer;
  $peer->create_uuid;
  $peer->alias($oscdb_name);
  $peer->db_url($dburl);
  $peer->store($self->database());

  $self->database()->execute_sql("UPDATE peer SET is_self=1 WHERE uuid=?", $peer->uuid);
  $self->{'_peer'} = $peer;
  */

  // now old version in _build_dir
  cmd = "rm "+ oscdir+"/oscdb.*; rmdir "+ oscdir;
  fprintf(stderr, "%s\n", cmd.c_str());
  system(cmd.c_str());

  _oscdb_dir = deploydir;
}


bool  EEDB::SPStreams::OSCFileDB::repair() {
  //not fully tested
  // first check if we need to reload
  if(!_connect_to_files()) { return false; }  
  _reload_stream_data_sources();
  
  enum { OK, REINDEX, PATCH } repair_mode;
  repair_mode = OK;
  
  vector<EEDB::Tools::OSC_column*>  exp_columns = oscfileparser()->get_expression_columns();
  for(unsigned int i=0; i<exp_columns.size(); i++) {
    EEDB::Tools::OSC_column *colobj = exp_columns[i];
    if(colobj->datatype == NULL) { continue; }
    if(colobj->experiment == NULL) { continue; }
    
    if((!colobj->experiment->metadataset()->find_metadata(colobj->datatype->type() + "_total", "")) || (colobj->express_total>0)) {
      repair_mode = REINDEX;
    }
     
    string dtype = colobj->datatype->type() + "_pm";
    if((repair_mode == OK) && (!colobj->experiment->has_datatype(dtype))) {
      //make sure the _pm datatypes are present      
      colobj->experiment->add_datatype(EEDB::Datatype::get_type(dtype));
      repair_mode = PATCH;
    }
    //maybe remove the keywords
    //colobj->experiment->metadataset()->remove_duplicates();
  }
    
  if(_database) { _database->disconnect(); }

  switch(repair_mode) {
    case PATCH:
      fprintf(stderr, "OSCFileDB::repair [%s] -- patch\n", _peer_uuid);
      if(!_save_xml()) { return false; }
      break;
    case REINDEX:
      fprintf(stderr, "OSCFileDB::repair [%s] -- reindex\n", _peer_uuid);
      if(!_build_indexes()) { return false; }
      break;
    case OK:
      break;
  }
  return true;
}


long  EEDB::SPStreams::OSCFileDB::source_file_size() {
  long file_size = 0;
  if(!_connect_to_files()) { return -1; }

  file_size = lseek(_data_fd, 0, SEEK_END);
  lseek(_data_fd, 0, SEEK_SET); //reset back to beginning

  _close_files();
  return file_size;
}


string  EEDB::SPStreams::OSCFileDB::source_md5sum() {
  if(!_connect_to_files()) { return ""; }
  //make sure oscfileparser and primary_feature_source are initialized
  if(!oscfileparser()) { return ""; }
  EEDB::FeatureSource *primary_source = oscfileparser()->primary_feature_source();
  if(!primary_source) { return ""; }

  EEDB::Metadata  *mdata = primary_source->metadataset()->find_metadata("zenbu:source_md5sum", "");
  if(mdata) {
    return mdata->data();
  }

  string file = _oscdb_dir + "/oscdb.oscdata";
  string cmd = "md5sum "+ file;
  string str1 = exec_result(cmd);
  if(str1.empty()) { return ""; } //can not calculate so just run 
  //fprintf(stderr, "md5sum return : [%s]\n", str1.c_str());

  std::size_t p1 = str1.find(" ");
  if(p1!=std::string::npos) { str1.resize(p1); }
  //fprintf(stderr, "md5sum [%s]\n", str1.c_str());

  //store into primary_feature_source
  primary_source->metadataset()->add_tag_data("zenbu:source_md5sum", str1);
  save_xmldb();

  return str1;
}

