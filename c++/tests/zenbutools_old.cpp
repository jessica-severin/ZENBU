/* $Id: zenbutools_old.cpp,v 1.1 2014/03/12 07:38:15 severin Exp $ */

/****
 
 NAME
 
 zdxtools - DESCRIPTION of Object
 
 DESCRIPTION
 
 zdxtools is a ZENBU system command line tool to access and process data both
 remotely on ZENBU federation servers and locally with ZDX file databases.
 The API is designed to both enable ZENBU advanced features, but also to provide
 a backward compatibility to samtools and bedtools so that zdxtools can be a "drop in"
 replacement for these other tools.
 
 CONTACT
 
 Jessica Severin <jessica.severin@gmail.com>
 
 LICENSE
 
 * Software License Agreement (BSD License)
 * MappedQueryDB [MQDB] toolkit
 * copyright (c) 2006-2009 Jessica Severin
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin nor the
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
#include <string>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
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
#include <EEDB/Feature.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Dummy.h>
#include <EEDB/SPStreams/SourceStream.h>
#include <EEDB/SPStreams/MultiMergeStream.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/FeatureEmitter.h>
#include <EEDB/SPStreams/TemplateCluster.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/SPStreams/BAMDB.h>
#include <EEDB/SPStreams/RemoteServerStream.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/Tools/RemoteUserTool.h>
#include <EEDB/User.h>
#include <EEDB/Collaboration.h>
#include <EEDB/Feature.h>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>
#include <EEDB/WebServices/WebBase.h>

#include <math.h>
#include <sys/time.h>

#define BUFSIZE         8192*3

using namespace std;
using namespace MQDB;

map<string,string>        _parameters;

void usage();

void zdx_read_test3();
void zdx_read_sources();
void update_bamdb_q20();
void zdx_load_from_osc();
void zdx_export();

void user_list_uploads();

int main(int argc, char *argv[]) {
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
    if(arg == "-ids") {
      string ids;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        ids += " "+ argvals[j];
      }
      _parameters["ids"] += ids;
    }

    if(arg == "-peers") {
      string peers;
      for(unsigned int j=0; j<argvals.size(); j++) { 
        if(!peers.empty()) { peers += ","; }
        peers += argvals[j];
      }
      _parameters["peers"] += peers;
    }
    
    if(arg == "-mode")          { _parameters["mode"] = argvals[0]; }

    if(arg == "-file")          { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-f")             { _parameters["_input_file"] = argvals[0]; }
    if(arg == "-out")           { _parameters["_output_file"] = argvals[0]; }

    if(arg == "-url")           { _parameters["_url"] = argvals[0]; }

    if(arg == "-tmpdir")        { _parameters["_build_dir"] = argvals[0]; }
    if(arg == "-builddir")      { _parameters["_build_dir"] = argvals[0]; }
    if(arg == "-keywords")      { _parameters["keywords"] = argvals[0]; }
    if(arg == "-display_name")  { _parameters["display_name"] = argvals[0]; }
    if(arg == "-description")   { _parameters["description"] = argvals[0]; }
    if(arg == "-platform")      { _parameters["platform"] = argvals[0]; }
    if(arg == "-ignore_int_asm"){ _parameters["ignore_internal_assembly"] = "true"; }
    if(arg == "-score_express") { _parameters["score_as_expression"] = argvals[0]; }
    if(arg == "-test")          { _parameters["test_stream"] = "true"; }
    if(arg == "-owner_openid")  { _parameters["owner_openid"] = argvals[0]; }        
    if(arg == "-single_tagmap") { _parameters["singletagmap_expression"] = "true"; }
    if(arg == "-buildtime")     { _parameters["buildtime"] = argvals[0]; }

    if(arg == "-score_express") { _parameters["score_as_expression"] = argvals[0]; }    
    if(arg == "-single_tagmap") { _parameters["singletagmap_expression"] = "true"; }

    if(arg == "-assembly")      { _parameters["genome_assembly"] = argvals[0]; }
    if(arg == "-asm")           { _parameters["genome_assembly"] = argvals[0]; }
    if(arg == "-asmb")          { _parameters["genome_assembly"] = argvals[0]; }
    if(arg == "-chr")           { _parameters["chrom"] = argvals[0]; }
    if(arg == "-chrom")         { _parameters["chrom"] = argvals[0]; }
    if(arg == "-start")         { _parameters["start"] = argvals[0]; }
    if(arg == "-end")           { _parameters["end"] = argvals[0]; }

    if(arg == "-sources")       { _parameters["mode"] = "sources"; }
    if(arg == "-experiments")   { _parameters["mode"] = "sources"; _parameters["source"] = "Experiment"; }
    if(arg == "-fsrc")          { _parameters["mode"] = "sources"; _parameters["source"] = "FeatureSource"; }
    if(arg == "-chroms")        { _parameters["mode"] = "chroms"; }
    if(arg == "-format")        { _parameters["format"] = argvals[0]; }
    if(arg == "-filter")        { _parameters["filter"] = argvals[0]; }
    
    if(arg == "-show")         { _parameters["show"] = "true"; }


    if(arg == "-user") { 
      if(argvals[0] == "list") {
        _parameters["mode"] = "list_uploads";

        string filter;
        for(unsigned int j=1; j<argvals.size(); j++) { 
          filter += " "+ argvals[j];
        }
        _parameters["filter"] += filter;
      }
    }

  }
  
  
  if(_parameters["mode"] == "sources") {
    zdx_read_sources();
  }
  if(_parameters["mode"] == "load") {
    zdx_load_from_osc();
  }
  if(_parameters["mode"] == "bamdb_q20") {
    update_bamdb_q20();
  }
  if(_parameters["mode"] == "list_uploads") {
    user_list_uploads();
  }
  if(_parameters["mode"] == "export") {
    zdx_export();
  }
  
  exit(1);
}


/*****************************************************************
 *
 */

void usage() {
  printf("zenbutools [options]\n");
  printf("  -help                     : print this help\n");
  printf("  -file <path>              : path to a ZDX file\n");
  printf("zenbutools v%s\n", EEDB::WebServices::WebBase::zenbu_version);
  
  exit(1);  
}


/////////////////////////////////////////////////////////////////////////////////////////////////
//
// main functions
//
/////////////////////////////////////////////////////////////////////////////////////////////////


void zdx_read_sources() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  long count=0;
  
  printf("\n=== zdx_read_sources ====\n");
  
  count=0;
  
  gettimeofday(&starttime, NULL);
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);
  stream = zdxstream;
  
  count=0;
  stream->stream_peers();
  while(MQDB::DBObject *obj = stream->next_in_stream()) {
    EEDB::Peer *peer = (EEDB::Peer*)obj;
    count++;
  }
  printf("%ld peers\n", count);
  
  count=0;
  stream->stream_data_sources(_parameters["source"], _parameters["filter"]);
  while(EEDB::DataSource *source = (EEDB::DataSource*)stream->next_in_stream()) {
    if(_parameters["format"] == "fullxml") {
      printf("%s\n", source->xml().c_str());
    } else {
      printf("%s", source->simple_xml().c_str());
    }
    count++;
  }    
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  if(difftime.tv_sec ==0) {
    printf("%ld sources in %1.6f msec \n", count, (double)difftime.tv_sec*1000.0 + ((double)difftime.tv_usec)/1000.0);
  } else {
    printf("%ld sources in %1.6f sec \n", count, (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  }
}


void zdx_export() {
  struct timeval       starttime,endtime,difftime;
  EEDB::SPStream       *stream = NULL;
  char                 buffer[2048];
  string               assembly_name = _parameters["assembly_name"];
  
  gettimeofday(&starttime, NULL);
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::open(_parameters["_input_file"]);  
  ZDXdb* zdxdb = zdxstream->zdxdb();
  
  long numsegs, numbuilt, numclaimed;
  EEDB::ZDX::ZDXsegment::build_stats(zdxdb, assembly_name, "", -1, -1, numsegs, numbuilt, numclaimed);
  long unbuilt= numsegs-numbuilt-numclaimed;
  fprintf(stderr, " numsegs=\"%ld\" built=\"%ld\" claimed=\"%ld\" unbuilt=\"%ld\"", numsegs, numbuilt, numclaimed, unbuilt);
  
  long total_count = 0;
  long raw_count = 0;
  
  string format = _parameters["format"];
  if(format.find("gff") != string::npos) { format = "gff"; }
  if(format.find("bed") != string::npos) { format = "bed"; }
  
  // get chroms
  vector<EEDB::Chrom*> chroms = EEDB::ZDX::ZDXsegment::fetch_all_chroms(zdxdb);
  sort(chroms.begin(), chroms.end(), chrom_length_sort_func);
  fprintf(stderr,"zdx_export %ld chroms\n", chroms.size());
  
  //make sure all sources are cached for lazyload later
  zdxstream->stream_data_sources();
  while(EEDB::DataSource* source = (EEDB::DataSource*)zdxstream->next_in_stream()) {
    EEDB::DataSource::add_to_sources_cache(source);
  }    
  
  string output_buffer;
  
  //now stream each chrom out    
  vector<EEDB::Chrom*>::iterator chr_it;
  for(chr_it=chroms.begin(); chr_it!=chroms.end(); chr_it++) {
    
    if(!output_buffer.empty()) {
      printf("%s", output_buffer.c_str());
      output_buffer.clear();
    }
    
    EEDB::Chrom *chrom = (*chr_it);
    string last_feature_id;
    //fprintf(stderr,"zdx_export [%s] [%s]\n", chrom->assembly_name().c_str(), chrom->chrom_name().c_str());
    
    zdxstream->stream_by_named_region(chrom->assembly_name(), chrom->chrom_name(), -1, -1);
    while(MQDB::DBObject *obj = zdxstream->next_in_stream()) {
      EEDB::Feature    *feature = NULL;
      EEDB::Expression *expression = NULL;
      if(obj->classname() == EEDB::Feature::class_name) { feature = (EEDB::Feature*)obj; }
      if(obj->classname() == EEDB::Expression::class_name) { 
        feature    = ((EEDB::Expression*)obj)->feature(); 
        expression = (EEDB::Expression*)obj; 
      }
      if(feature == NULL) { obj->release(); continue; }
      if((expression !=NULL) and (expression->value()==0.0) and (format=="gff" or format=="bed")) { obj->release(); continue; }
      
      if(format == "bed") {
        if(expression!=NULL) { output_buffer += expression->bed_description(_parameters["format"]) + "\n"; } 
        else { output_buffer += feature->bed_description(_parameters["format"]) + "\n"; }
      }
      if(expression!=NULL and (last_feature_id == feature->db_id())) { obj->release(); continue; }
      
      if(format == "gff") { output_buffer += feature->gff_description(false) + "\n"; }
      //if(format == "osc" && (_osctable_generator!=NULL))  { 
      //  output_buffer += _osctable_generator->osctable_feature_output(feature) + "\n"; 
      //}
      if(format == "das")  { output_buffer += feature->dasgff_xml(); }
      if(format == "xml")  { 
        if(total_count==1) { feature->chrom()->simple_xml(output_buffer); }
        if(_parameters["submode"] == "simple_feature") { 
          feature->simple_xml(output_buffer); 
        } else if(_parameters["submode"] == "subfeature") { 
          feature->_xml_start(output_buffer);
          feature->_xml_subfeatures(output_buffer);
          feature->_xml_end(output_buffer);
        } else { 
          feature->xml(output_buffer);
        }
      }
      total_count++;
      last_feature_id = feature->db_id();
      obj->release();

      if(!output_buffer.empty()) {
        printf("%s", output_buffer.c_str());
        output_buffer.clear();
      }
    }
    
    gettimeofday(&endtime, NULL);
    timersub(&endtime, &starttime, &difftime);
    double runtime  = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
    fprintf(stderr, "%s :: %1.2f obj/sec  %ld \n", chrom->fullname().c_str(), (total_count/runtime), total_count);
  }
  
  if(!output_buffer.empty()) {
    printf("%s", output_buffer.c_str());
    output_buffer.clear();
  }
}


/////////////////////////////////////////////////////////////////////////////////////////////////


void zdx_load_from_osc() {
  struct timeval            starttime,endtime,difftime;  
  double                    mbytes, rate, runtime;
  EEDB::t_outputmode        outmode = EEDB::FULL_FEATURE;
  char                      buffer[8192];
  map<string, EEDB::Chrom*> chroms;
  long int                      count=0;
  map<string, EEDB::Datatype*>  datatypes;
  map<string, bool>             sourceid_filter;
  
  gettimeofday(&starttime, NULL);
  
  string input_file = _parameters["_input_file"];
  if(input_file.empty()) {
    fprintf(stderr, "ERROR: no specified input file\n\n");
    usage();    
  }
    
  //initialize oscfileparser
  EEDB::Tools::OSCFileParser  *parser = new EEDB::Tools::OSCFileParser();
  map<string,string>::iterator    p_it;
  for(p_it=_parameters.begin(); p_it!=_parameters.end(); p_it++) {
    if((*p_it).first[0] == '_') { continue; }
    parser->set_parameter((*p_it).first, (*p_it).second);
  }
  if(!parser->init_from_file(input_file)) { 
    fprintf(stderr, "ERROR: unable to parse oscfile header\n\n"); 
    usage();    
  }  
  if(!parser->default_assembly()) { //to make sure it is initialized
    fprintf(stderr, "ERROR: genome_assembly is undefined\n\n"); 
    usage();    
  }
  if(!parser->primary_feature_source()) { //to make sure it is initialized
    fprintf(stderr, "ERROR: problem creating oscfile primary_feature_source\n\n"); 
    usage();    
  }
  int chrom_idx, start_idx, end_idx, strand_idx; 
  parser->get_genomic_column_indexes(chrom_idx, start_idx, end_idx, strand_idx);
  if(chrom_idx== -1 || start_idx==-1) {
    fprintf(stderr, "ERROR: oscfile header does not defined chrom or chrom_start columns\n\n"); 
    usage();    
  }
  
  parser->sort_input_file();
  
  
  // create zdx file
  string output_file = _parameters["_output_file"];
  if(output_file.empty()) { output_file = "test1.zdx"; }
  EEDB::ZDX::ZDXstream *zdxstream = EEDB::ZDX::ZDXstream::create_new(output_file.c_str());
  if(!zdxstream) {
    fprintf(stderr, "ERROR: could not make output zdx file\n\n"); 
    usage();    
  }
      
  //get chromsomes and segment zdx
  string genome = parser->default_assembly()->assembly_name();
  fprintf(stderr, "genome[%s]\n", genome.c_str());
  EEDB::SPStreams::RemoteServerStream *rstream = EEDB::SPStreams::RemoteServerStream::new_from_url("http://fantom.gsc.riken.jp/zenbu/");
  if(!rstream) {
    fprintf(stderr, "ERROR: unable to connect to remote zenbu to get genome stats\n\n"); 
    usage();
  }
  printf("have remote connection\n");
  rstream->stream_chromosomes(genome, "");
  while(MQDB::DBObject *obj = rstream->next_in_stream()) { 
    if(!obj) { continue; }
    if(obj->classname() != EEDB::Chrom::class_name) { continue; }
    EEDB::Chrom* chrom = (EEDB::Chrom*)obj;
    printf("create chrom [%s]\n", chrom->xml().c_str());
    zdxstream->create_chrom(chrom);
    obj->release();
  }
  
  // read the input file and load into a ZDX file
  gzFile gz = gzopen(input_file.c_str(), "rb");
  if(!gz) {     
    fprintf(stderr, "ERROR: failed to open input file\n\n"); 
    usage();
  }
  
  char* _data_buffer = (char*)malloc(BUFSIZE);  // 24 kilobytes
  bzero(_data_buffer, BUFSIZE);
  
  string filetype  = parser->get_parameter("filetype");

  //
  // input file is sorted so can load into consecutive zsegments
  //
  
  EEDB::ZDX::ZDXsegment* zseg = NULL;
  ZDXdb* zdxdb = zdxstream->zdxdb();

  gettimeofday(&starttime, NULL);
  while(gzgets(gz, _data_buffer, BUFSIZE) != NULL) {  //get one line to <cr>
    if(filetype == "osc") { 
      if(_data_buffer[0] == '#') { continue; }
      if(count==0) { //first non-parameter/comment line is the header columns line
        count++;
        continue;
      }
    }
    count++;
    
    char *p1=_data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    
    //fprintf(stderr, "convert_dataline [%s]\n", _data_buffer);
    EEDB::Feature* feature = parser->convert_dataline_to_feature(_data_buffer, outmode, datatypes, sourceid_filter);
    if(!feature) { //unable to parse the line
      continue; 
    }
    feature->primary_id(count);
    
    if(feature->chrom() == NULL) {
      feature->release();
      continue;
    }
    //fprintf(stderr, "%s\n", feature->chrom_location().c_str());
    
    if(zseg!=NULL && 
       (feature->chrom_name() != zseg->chrom_name() ||
        feature->chrom_start() < zseg->chrom_start() || 
        feature->chrom_start() > zseg->chrom_end())) {
      //finished with zseg
      fprintf(stderr, "finish segment %s\n", zseg->xml().c_str());
      zseg->write_segment_features(); //flush remaining features and unclaim
      zseg->release();
      zseg = NULL;
    }

    if(zseg==NULL) {
      zseg = EEDB::ZDX::ZDXsegment::fetch(zdxdb, genome, feature->chrom()->chrom_name(), feature->chrom_start());
    }
    if(!zseg) {
      fprintf(stderr, "ERROR not able to fetch zsegment [%s::%s:%ld]\n", genome.c_str(), feature->chrom()->chrom_name().c_str(), feature->chrom_start());
      feature->release();
      continue;      
    }
    zseg->claim_segment();
      
    feature->chrom(zseg->chrom());
    
    zseg->add_sorted_feature(feature);    
    
    feature->release();
    
    if(count % 1000 == 0) {
      mbytes = ((double)gztell(gz)) / (1024.0*1024.0);
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "%10ld features  %13.2f obj/sec", count, rate);
      rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
      fprintf(stderr, "  %13.3f mbytes/sec\n", rate);
    }
  }
  if(zseg) {
    fprintf(stderr, "finish segment\n");
    zseg->write_segment_features(); //flush remaining features and unclaim
    zseg->release();
    zseg = NULL;    
  }
  
  mbytes = ((double)gztell(gz)) / (1024.0*1024.0);
  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  rate = (double)count / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "%10ld features  %13.2f obj/sec", count, rate);
  rate = (double)mbytes / ((double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0);
  fprintf(stderr, "  %13.3f mbytes/sec\n", rate);

  
  //after finished all sources are defined
  zdxstream->add_peer(parser->peer());

  vector<EEDB::DataSource*> sources = parser->datasources();
  for(unsigned i=0; i<sources.size(); i++) {
    zdxstream->add_datasource(sources[i]);
  }
  zdxstream->write_source_section();

  //close files
  gzclose(gz);
  zdxstream->release();
}

//
//
//////////////////////////////////////////////////////////////////////////////////////
//
//

void zdx_read_test3() {
  struct timeval                        starttime,endtime,difftime;
  EEDB::SPStream                        *stream = NULL;
  
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

void update_bamdb_q20() {
  if(_parameters.find("db_url") == _parameters.end()) {
    printf("\nERROR: must specify -url for the peer\n");
    return usage();
  }

  EEDB::Peer *peer = EEDB::Peer::new_from_url(_parameters["db_url"]);
  if(!peer) {
    printf("\nERROR: unable to connect to peer [%s]!!\n\n", _parameters["db_url"].c_str());
    return usage();
  }
  if(peer->driver() != "bamdb") {
    printf("\nERROR: q20_tpm update only available for bamdb\n\n");
    return usage();
  }

  printf("db_url [%s]\n", peer->db_url().c_str());

  EEDB::SPStreams::BAMDB *bamdb = (EEDB::SPStreams::BAMDB*)(peer->source_stream());
  long long q20_total = bamdb->calc_q20_count();
  fprintf(stderr, "_calc_q20_count  %lld\n", q20_total);

}



/////////////////////////////////////////////////////////////////////////////////////////////////////////////


void user_list_uploads() {
  string url = _parameters["_url"];
  string filter = _parameters["filter"];

  printf("user_list_uploads [%s]\n", url.c_str());
  if(url.empty()) { return; }
  if(!filter.empty()) { printf("  filter[%s]\n", filter.c_str()); }

  EEDB::Tools::RemoteUserTool *zremote = EEDB::Tools::RemoteUserTool::new_from_url(url);
  if(!zremote) { return; }
  
  if(!zremote->verify_remote_user()) {
    fprintf(stderr, "uable to connect to %s with user authentication\n", url.c_str());
    return;
  }
  fprintf(stderr, "remote user is OK\n");
  
  if(_parameters.find("format") == _parameters.end()) { _parameters["format"] = "list"; }
  
  if(_parameters.find("peers") != _parameters.end()) { 
    zremote->set_peer_uuids(_parameters["peers"]);
  }
  
  long peer_count=0;
  long exp_count=0;
  long fsrc_count=0;
  
  EEDB::SPStream *stream = zremote->stream_uploaded_data_sources("", filter);
  while(MQDB::DBObject* obj = stream->next_in_stream()) {
    if(obj->classname() == EEDB::Peer::class_name) { peer_count++; continue; }
    
    string   uuid, objClass;
    long int objID;
    MQDB::unparse_dbid(obj->db_id(), uuid, objID, objClass);
    //printf("        uuid: %s\n", uuid.c_str());
    EEDB::Peer *peer = EEDB::Peer::check_cache(uuid);
    
    
    EEDB::DataSource* source = (EEDB::DataSource*)obj;
    if(obj->classname() == EEDB::Experiment::class_name) { exp_count++; }
    if(obj->classname() == EEDB::FeatureSource::class_name) { fsrc_count++; }
    
    if(_parameters["format"] == "xml") {
      printf("%s\n", source->xml().c_str());
    }
    if(_parameters["format"] == "list") {
      printf("%60s   %s\n", obj->db_id().c_str(),source->display_name().c_str());
    }
    if(_parameters["format"] == "detail") {
      printf("-------\n");
      printf("       db_id: %s\n", obj->db_id().c_str());
      printf("        name: %s\n", source->display_name().c_str());
      printf(" description: %s\n", source->description().c_str());
      if(peer) { printf("    peer: %s\n", peer->db_url().c_str()); }
    }

    source->release();
  }
  fprintf(stderr, "%ld peers --- %ld featuresources --- %ld experiments\n", peer_count, fsrc_count, exp_count);
  stream->disconnect();  
}


