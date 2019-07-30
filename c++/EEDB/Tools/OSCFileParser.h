/* $Id: OSCFileParser.h,v 1.58 2019/02/07 07:19:15 severin Exp $ */

/***

NAME - EEDB::Tools::OSCFileParser

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
SPStream is short hand for Signal-Process-Stream

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

#ifndef _EEDB_TOOLS_OSCFILEPARSER_H
#define _EEDB_TOOLS_OSCFILEPARSER_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/DBObject.h>
#include <EEDB/Peer.h>
#include <EEDB/Assembly.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/EdgeSource.h>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Datatype.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

typedef enum {SIMPLE_FEATURE, SIMPLE_EXPRESSION, SUBFEATURE, SKIPMETADATA, SKIPEXPRESSION, FULL_FEATURE } t_outputmode;

namespace Tools {

typedef enum {IGNORE, FEATURE, GENOMIC, METADATA, EXPRESSION, EDGE } t_oscnamespace;

typedef enum { UNDEF, BASE0, BASE1, EDGES } t_coordinates;

class OSC_column {
  public:
    OSC_column();               // constructor
   ~OSC_column();               // destructor

   string       display_desc();
   void         xml(string &xml_buffer);
   void         init_from_xmlnode(void *xml_node); // rapidxml node

   int                colnum;
   char*              data;
   string             colname;
   t_oscnamespace     oscnamespace;
   string             orig_colname;
   string             description;
   EEDB::Experiment*  experiment;
   EEDB::Datatype*    datatype;
   string             expname;
   double             express_total;
   double             singlemap_total;
   double             mapnorm_total;
   
   string osc_namespace() {
     switch(oscnamespace) {
       case IGNORE:      return "ignore";
       case FEATURE:     return "feature";
       case GENOMIC:     return "genomic";
       case METADATA:    return "metadata";
       case EXPRESSION:  return "expression";
       case EDGE      :  return "edge";
       default:          return "";
     }
   }
};

class OSCFileParser : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

  public:
    OSCFileParser();             // constructor
   ~OSCFileParser();             // destructor
    void init();                 // initialization method
  
    void     set_parameter(string tag, string value);  //external configuration
    void     clear_parameter(string tag);              //OSCDB building
    void     set_datasource(EEDB::DataSource* source); //external setup
    void     set_assembly(EEDB::Assembly* assembly);   //external setup
    void     set_peer(EEDB::Peer* peer);               //external setup

    string   get_parameter(string tag);

    bool     init_from_file(string path);
    bool     init_from_oscheader_file(string path);
    bool     init_from_bed_file(string path);
    bool     init_from_sam_file(string path);
    bool     init_from_gff_file(string path);
    bool     init_from_xml_file(string path);

    static void  load_source_metadata(bool value) { _load_source_metadata = value; }
    static void  sparse_expression(bool value) { _sparse_expression = value; }
    static void  sparse_metadata(bool value) { _sparse_metadata = value; }

    EEDB::Feature*             convert_dataline_to_feature(char* line, 
                                                        t_outputmode outputmode,
                                                        map<string, EEDB::Datatype*> &datatypes,
                                                        map<string, bool> &sourceid_filter
                                                       );
    EEDB::Edge*                convert_dataline_to_edge(char* line);
    EEDB::Edge*                convert_segmented_columns_to_edge();
    string                     output_current_dataline();
    
    void                       display_info();
    string                     display_desc();
    string                     error_message();
    
    string                     oscheader();  //generates oscheader data for configuration
    string                     default_assembly_name();
    EEDB::Assembly*            default_assembly();
    EEDB::FeatureSource*       primary_feature_source();
    EEDB::EdgeSource*          primary_edge_source();
    EEDB::Peer*                peer() { return _peer; }
    vector<EEDB::DataSource*>  datasources() { return _data_sources; }
    t_coordinates              coordinate_system() { return _coordinate_system; }
    
    void                       get_genomic_column_indexes(int &chrom_idx, int &start_idx, int &end_idx, int &strand_idx);
    vector<OSC_column*>        get_expression_columns();
    void                       postprocess_columns();
    void                       append_column(string column_name);
    void                       prepend_column(string column_name);
    void                       remove_ignore_columns();
    void                       reset_to_oscdb();

    string                     sort_input_file();

    EEDB::EdgeSource*          get_edgesource(string category);

    //low level interface for external object creation
    bool                       segment_line(char* line); //for external parsing
    vector<OSC_column>*        columns();
  

  //internal variables and methods, should not be considered open API
  private:
    vector<EEDB::DataSource*>               _data_sources;
    map<string, EEDB::DataSource*>          _sources_cache;
    EEDB::FeatureSource*                    _primary_feature_source;
    EEDB::EdgeSource*                       _primary_edge_source;
    map<string, EEDB::FeatureSource*>       _category_featuresources;
    map<string, EEDB::EdgeSource*>          _category_edgesources;
    EEDB::EdgeSource*                       _subfeature_edgesource;
    EEDB::Assembly*                         _default_assembly;
    map<string, EEDB::Assembly*>            _assemblies;
    EEDB::Peer*                             _peer;
    int                                     _create_source_id;
    
    map<string,string>               _parameters;
    map<string,string>               _column_descriptions;
    vector<OSC_column>               _columns;
    enum { OSCTAB, OSCSPACE }        _segment_mode;
    t_coordinates                    _coordinate_system;
    static bool                      _sparse_expression;
    static bool                      _sparse_metadata;
    static bool                      _load_source_metadata;

    int                              _idx_asm, _idx_chrom, _idx_start, _idx_end, _idx_strand;
    int                              _idx_name, _idx_fid, _idx_score, _idx_fsrc_category, _idx_fsrc_id;
    int                              _idx_mapcount, _idx_demux_fsrc, _idx_demux_exp;
    int                              _idx_bed_block_count, _idx_bed_block_sizes, _idx_bed_block_starts;
    int                              _idx_bed_thickstart, _idx_bed_thickend;
    int                              _idx_sam_flag, _idx_cigar, _idx_sam_opt;
    int                              _idx_ctg_cigar, _idx_gff_attributes;
    int                              _idx_edge_f1, _idx_edge_f2;

    void                             _parse_column_names(vector<string> &columns);
    void                             _process_column(OSC_column *colobj);
    void                             _convert_column_name_aliases(OSC_column *colobj);
    void                             _get_experiment(OSC_column *colobj);
    void                             _parse_OSCheader_metadata_line(char* line);
    void                             _parse_OSCheader_experiment_metadata(char* line);
    void                             _transfer_parameters_to_source(EEDB::DataSource* source);
    EEDB::FeatureSource*             _get_category_featuresource(string category);
    EEDB::Chrom*                     _get_chrom(const char* chrom_name);
    EEDB::Chrom*                     _get_chrom(const char* asm_name, const char* chrom_name);
    EEDB::EdgeSource*                _sublink_source();

    
    bool    _convert_bed_block_extensions(EEDB::Feature *feature);
    void    _convert_cigar_to_end_pos(EEDB::Feature *feature);
    void    _convert_cigar_to_subfeatures(EEDB::Feature *feature);
    void    _convert_category_cigar_to_subfeatures(EEDB::Feature *feature);
    void    _convert_gff_attributes(EEDB::Feature *feature);

  //used for callback functions, should not be considered open API
  public:    
    void    _xml(string &xml_buffer);
    bool    _segment_line(char* line); //for external parsing

  
  //for testing and debug
  public:
    void                    test_scan_file(string path);
    int _debug_level;

};

};   //namespace Tools

};   //namespace EEDB


#endif
