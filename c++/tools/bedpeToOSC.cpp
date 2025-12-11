/* $Id: bedpeToOSC.cpp,v 1.7 2025/12/11 06:20:12 severin Exp $ */

/*
 * this tool converts bedpe files into ZENBU node/edge OSC files. 
 * 
 * BEDPE standard columns
 *  1: chrom1 - The name of the chromosome on which the first end of the feature exists.
 *  2: start1 - The zero-based starting position of the first end of the feature on chrom1.
 *  3: end1 - The one-based ending position of the first end of the feature on chrom1.
 *  4: chrom2 - The name of the chromosome on which the second end of the feature exists.
 *  5: start2 - The zero-based starting position of the second end of the feature on chrom2.
 *  6: end2 - The one-based ending position of the second end of the feature on chrom2.
 *  7: name - Defines the name of the BEDPE feature.
 *  8: score - The UCSC definition requires that a BED score range from 0 to 1000, inclusive. 
 *  9: strand1 - Defines the strand for the first end of the feature. Either ‘+’ or ‘-‘.
 *  10: strand2 - Defines the strand for the second end of the feature. Either ‘+’ or ‘-‘.
 *  11: Any number of additional, user-defined fields

example: 
for FILE in `ls -Sr *merge*v1c*.bedpe`; do  echo $FILE; bedpeToOSC $FILE -auxlabels MAPQ_RNA,MAPQ_DNA,CIGAR_RNA,CIGAR_DNA Source_gene_ID_RNA,Source_gene_name_RNA,  Type_source_gene_RNA, 25kb_bin_ID_DNA  intron_exon  RNA_read_split_over_exon_intron_junction  ewt.p.value   ewt.FDR  ewt.log10_pvalue  ewt.log10_FDR; done

 * 
 */
#include <locale.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <iostream>
#include <sstream>
#include <math.h>
#include <sys/time.h>
#include <sys/dir.h>
#include <zlib.h>
#include <regex>
#include <openssl/sha.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <rapidxml_print.hpp>  //rapidxml must be include before boost
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>
#include <boost/algorithm/string/case_conv.hpp>
#include <boost/algorithm/string/replace.hpp>

#include <math.h>
#include <sys/time.h>

using namespace std;

long             _verbose = 0;  //level 0= nothing higher numbers is more verbose
string           version = "1.0";

map<string,string>     _parameters;

string                _output_name;
string                _suffix; //option suffix to allow versioning of output file
vector<string>        _aux_labels;
string                _bedpe_file;
vector<string>        _header = {"chrom1", "start1", "end1", "chrom2", "start2", "end2", "name", "score", "strand1", "strand2"};
vector<string>        _aux_header;
  
void   usage();
void   parse_aux_labels();
void   convert_bedpe_file();
void   show_cols_objs(map<string,string> *cols_obj);

int main(int argc, char *argv[]) {
  
  setlocale(LC_NUMERIC, "");

  vector<string> valid_args = {"-f", "-file", "-help", "-h", "-suffix", "-output", "-auxlabels"};

  for(int argi=1; argi<argc; argi++) {
    if(argi==1 && argv[argi][0] != '-') { _bedpe_file = argv[argi]; }
    if(argv[argi][0] != '-') { continue; }
    string arg = argv[argi];

    if(std::find(valid_args.begin(), valid_args.end(), arg) == valid_args.end() ){
      fprintf(stderr, "ERROR: unknown option %s\n\n", arg.c_str());
      usage();
    }

    vector<string> argvals;
    while((argi+1<argc) and (argv[argi+1][0] != '-')) {
      argi++;
      argvals.push_back(argv[argi]);
    }

    //first options without args
    if(arg == "-help" || arg == "-h") { usage(); }
    
    //then options with args
    if(argvals.empty()) {
      fprintf(stderr, "ERROR: option %s needs parameters\n\n", arg.c_str());
      usage();
    }

    if(arg == "-f" || arg=="-file") { _bedpe_file = argvals[0]; }
    if(arg == "-output") { _output_name = argvals[0]; }
    if(arg == "-suffix") { _suffix = argvals[0]; }
    if(arg == "-auxlabels") { _aux_labels = argvals; }
  }
  
  parse_aux_labels();
  
  vector<string>::iterator   it1;
  printf("header columns\n");
  long count=0;
  for(it1=_header.begin(); it1!=_header.end(); it1++) {
    count++;
    printf("  %ld : %s\n", count, it1->c_str());
  }
  
  convert_bedpe_file();  //if only 1 column then just a gene name filter, if cols 1,2 then both gene filter and gene2gene filter
  
  exit(1);
}


//==============================================================================
//

void usage() {
  printf("bedpeToOSC file.bedpe [options] \n");
  printf(" tool to convert bedpe files into ZENBU OSC node/edge files\n");
  printf("  -help                 : show this help\n");
  printf("  -file <path>          : alternate way to specifc the path of bedpe file\n");
  printf("  -output <name>        : file name prefix for node/edge output files\n");
  printf("  -suffix <name>        : optional suffix for versioning of output files\n");
  printf("  -auxlabels <string>   : comma or tab separated list of header labels for the user defined columns\n");
  printf("bedpeToOSC v%s\n", version.c_str());
  
  exit(1);  
}


void parse_aux_labels() {
  //_aux labels can be either comma/tab separated string or given as multiple parameters on the command line (vector)
  if(_aux_labels.empty()) { return; }
  
  vector<string>::iterator   it1;
  char*  data_buffer = (char*)malloc(24576);  // 24 kilobytes
  bzero(data_buffer, 24576);

  long count=0;
  for(it1=_aux_labels.begin(); it1!=_aux_labels.end(); it1++) {
    //printf("parse_aux_labels :  %s\n", it1->c_str());
    strcpy(data_buffer, it1->c_str());
    char* tok = strtok(data_buffer, ",\t");
    while(tok) {
      count++;
      //printf("   %ld : %s\n", count, tok);
      _header.push_back(tok);
      _aux_header.push_back(tok);
      tok = strtok(NULL, ",\t");
    }
  }  
  free(data_buffer);  
}


void convert_bedpe_file() {  
  if(_bedpe_file.empty()) {
    fprintf(stderr, "ERROR: no bedpe file\n\n");
    usage();
  }
  
  printf("convert_bedpe_file : %s\n", _bedpe_file.c_str());
  
  string prefix = _bedpe_file;
  if(!_output_name.empty()) { prefix = _output_name; }
  
  std::size_t found = prefix.rfind(".bedpe");
  if(found!=std::string::npos) { prefix.erase(found,string::npos); }

  if(!_suffix.empty()) { prefix += _suffix; }
  printf("output_prefix [%s]\n", prefix.c_str());
  
  string node_path = prefix + "_nodes.osc";
  string edge_path = prefix + "_edges.osc";
  
  FILE* node_fp = fopen(node_path.c_str(), "w");
  FILE* edge_fp = fopen(edge_path.c_str(), "w");
  
  fprintf(node_fp, "nodeID\teedb:chrom\teedb:start.0base\teedb:end\teedb:strand\teedb:name\teedb:score\tbedpend");
  vector<string>::iterator   it1;
  //for(it1 = _aux_header.begin(); it1 != _aux_header.end(); it1++) {
  //  fprintf(node_fp, "\t%s", it1->c_str());
  //}
  fprintf(node_fp, "\n");

  fprintf(edge_fp, "edgef1.nodeID\tedgef2.nodeID\tedge_dir\tewt.score");
  for(it1 = _aux_header.begin(); it1 != _aux_header.end(); it1++) {
    fprintf(edge_fp, "\t%s", it1->c_str());
  }
  fprintf(edge_fp, "\n");


  struct timeval    starttime,endtime,difftime;
  double            rate, runtime;
  long              node_id=0;
  
  gzFile gz = gzopen(_bedpe_file.c_str(), "rb");
  if(!gz) { return; }

  char*  data_buffer = (char*)malloc(24576);  // 24 kilobytes
  bzero(data_buffer, 24576);
  
  gettimeofday(&starttime, NULL);
  long int count=0;
  while(gzgets(gz, data_buffer, 24576) != NULL) {
    count++;
    if(data_buffer[0] == '#') { continue; }
    
    char *p1=data_buffer;
    while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
    *p1 = '\0';  //null terminate line if \n or \r
    
    //first convert line/data_buffer into cols_obj (tab delimited)
    map <string,string> cols_obj;
    long col_idx=0;
    char* tok = strtok(data_buffer, "\t");
    while(tok) {
      if(strcmp(tok, "__na")==0) { tok[0] = '\0'; }
      if(strcmp(tok, "N/A")==0) { tok[0] = '\0'; }
      cols_obj[_header[col_idx]] = tok;
      tok = strtok(NULL, "\t");
      col_idx++;
    }

    long node1_id = ++node_id;
    long node2_id = ++node_id;
    long start1 = strtol(cols_obj["start1"].c_str(), NULL, 10);
    long start2 = strtol(cols_obj["start2"].c_str(), NULL, 10);
    long end1 = strtol(cols_obj["end1"].c_str(), NULL, 10);
    long end2 = strtol(cols_obj["end2"].c_str(), NULL, 10);

    //output node1 
    fprintf(node_fp, "n%ld\t%s\t%s\t%s\t%s\t%s\t%s\tpe1\n",
                node1_id, cols_obj["chrom1"].c_str(), cols_obj["start1"].c_str(), cols_obj["end1"].c_str(),
                cols_obj["strand1"].c_str(), cols_obj["name"].c_str(), cols_obj["score"].c_str());
    // //for(it1 = _aux_header.begin(); it1 != _aux_header.end(); it1++) {
    // //  fprintf(node_fp, "\t%s", cols_obj[*it1].c_str());
    // //}
    // fprintf(node_fp, "\n");

    //output node2
    fprintf(node_fp, "n%ld\t%s\t%s\t%s\t%s\t%s\t%s\tpe2\n",
                node2_id, cols_obj["chrom2"].c_str(), cols_obj["start2"].c_str(), cols_obj["end2"].c_str(),
                cols_obj["strand2"].c_str(), cols_obj["name"].c_str(), cols_obj["score"].c_str());
    // //for(it1 = _aux_header.begin(); it1 != _aux_header.end(); it1++) {
    // //  fprintf(node_fp, "\t%s", cols_obj[*it1].c_str());
    // //}
    // fprintf(node_fp, "\n");
    
    //output edge
    char edge_dir = '=';
    if(cols_obj["chrom1"]==cols_obj["chrom2"]) {
      if(start1 < start2) { edge_dir = '+'; }
      if(start2 < start1) { edge_dir = '-'; }
    }
    fprintf(edge_fp, "n%ld\tn%ld\t%c\t%s", node1_id, node2_id, edge_dir, cols_obj["score"].c_str());
    for(it1 = _aux_header.begin(); it1 != _aux_header.end(); it1++) {
      fprintf(edge_fp, "\t%s", cols_obj[*it1].c_str());
    }
    fprintf(edge_fp, "\n");
    
    if(count % 100000 == 0) {
      gettimeofday(&endtime, NULL);
      timersub(&endtime, &starttime, &difftime);
      runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
      rate = (double)count / runtime;
      fprintf(stderr, "%10ld :: %1.3f sec  :  %13.2f obj/sec\n", count, runtime, rate);
    }

  }
    
  free(data_buffer);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
  long minutes = floor(runtime/60.0);
  double secs  = runtime - (minutes*60.0);
  rate = (double)count / runtime;
  fprintf(stderr, "FINISHED convert_bedpe_file %ld rows :: %ld min %1.3f sec  :  %1.2f obj/sec\n", count, minutes, secs, rate);
  gzclose(gz);
  fclose(edge_fp);
  fclose(node_fp);
}



// void filter_nodes() {
//   //performs filtering on _bellerophon.nodes.osc.gz file
//   if(_output_name.empty()) { return; }
// 
//   struct timeval    starttime,endtime,difftime;
//   double            rate, runtime;
// 
//   string f3 = _output_name + "_bellerophon.nodes.osc.gz";
//   printf("filter_nodes %s : start\n", f3.c_str());
//   gzFile gz = gzopen(f3.c_str(), "rb");
//   if(!gz) {
//     string f3 = _output_name + "_bellerophon.nodes.osc";
//     printf("filter_nodes %s : start\n", f3.c_str());
//     gz = gzopen(f3.c_str(), "rb");
//   }
//   
//   if(!gz) {
//     fprintf(stderr, "failed to open NODES file : %s\n", f3.c_str());
//     return;
//   }
// 
//   char*  data_buffer = (char*)malloc(24576);  // 24 kilobytes
//   bzero(data_buffer, 24576);
//   
//   gettimeofday(&starttime, NULL);
//   long count=0;
//   long output_count = 0;
//   vector<string>  header_cols;
//   while(gzgets(gz, data_buffer, 24576) != NULL) {
//     if(data_buffer[0] == '#') { continue; }
//     count++;
// 
//     char *p1=data_buffer;
//     while((*p1 != '\0') && (*p1 != '\n') && (*p1 != '\r')) { p1++; }
//     *p1 = '\0';  //null terminate line if \n or \r
// 
//     string line = data_buffer; //cache for output
//     if(count==1) {
//       printf("read header\n");
//       char* tok = strtok(data_buffer, "\t");
//       while(tok) {
//         header_cols.push_back(tok);
//         tok = strtok(NULL, "\t");
//       }
//       continue;
//     }
//     //printf("%ld\t%s\n", count, data_buffer);
//     
//     //first convert line/data_buffer into cols_obj (tab delimited)
//     map <string,string> cols_obj;
//     long col_idx=0;
//     char* tok = strtok(data_buffer, "\t");
//     while(tok) {
//       if(strcmp(tok, "__na")==0) { tok[0] = '\0'; }
//       cols_obj[header_cols[col_idx]] = tok;
//       tok = strtok(NULL, "\t");
//       col_idx++;
//     }
//     
//     //check annotation column
//     //annotation : srpRNA:7SLRNA:W:100, protein_coding:ZNF425:E:100, misc_RNA:RN7SL521P:E:100
//     strcpy(data_buffer, cols_obj["annotation"].c_str());
//     printf("annotation : %s\n", data_buffer);
//     char *str1, *str2, *token, *subtoken;
//     char *saveptr1, *saveptr2;
//     str1 = data_buffer;
// //     for(int j = 1; ; j++, str1 = NULL) {
// //       token = strtok_r(str1, ", ", &saveptr1);
// //       if(token == NULL) break;
// //       printf("%d: %s\n", j, token);
// //       for(str2 = token; ; str2 = NULL) {
// //         subtoken = strtok_r(str2, ":", &saveptr2);
// //         if(subtoken == NULL) break;
// //         printf(" --> %s\n", subtoken);
// //       }
// //     }
// 
//     token = strtok_r(str1, ",", &saveptr1);
//     while(token) {
//       printf("  tok : %s\n", token);
//       str2 = token;
//       subtoken = strtok_r(str2, ":", &saveptr2);
//       while(subtoken) {
//         printf("    subtoken :  %s\n", subtoken);
//         subtoken = strtok_r(NULL, ":", &saveptr2);
//         if(subtoken == NULL) break;
//       }
//       token = strtok_r(NULL, ",", &saveptr1);
//     }
//              
//     if(count % 1000000 == 0) {
//       gettimeofday(&endtime, NULL);
//       timersub(&endtime, &starttime, &difftime);
//       runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
//       rate = (double)count / runtime;
//       fprintf(stderr, "%10ld :: %1.3f sec  :  %13.2f obj/sec\n", count, runtime, rate);
//       show_cols_objs(&cols_obj);
//     }
// 
//   }
//     
//   free(data_buffer);
// 
//   gettimeofday(&endtime, NULL);
//   timersub(&endtime, &starttime, &difftime);
//   runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;
//   long minutes = floor(runtime/60.0);
//   double secs  = runtime - (minutes*60.0);
//   rate = (double)count / runtime;
//   fprintf(stderr, "FINISHED filter_nodes %ld in (%ld out) :: %ld min %1.3f sec  :  %13.2f obj/sec\n", count, output_count, minutes, secs, rate);
//   gzclose(gz);
// }


void show_cols_objs(map<string,string> *cols_obj) {
  map<string,string>::iterator  it1;
  for(it1 = cols_obj->begin(); it1 != cols_obj->end(); it1++) {
    printf("\t%25s : %s\n", it1->first.c_str(), it1->second.c_str());
  }
}
