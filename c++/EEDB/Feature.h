/* $Id: Feature.h,v 1.73 2016/08/09 05:33:07 severin Exp $ */

/***

NAME - EEDB::Feature

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

***/

#ifndef _EEDB_FEATURE_H
#define _EEDB_FEATURE_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/FeatureSource.h>
#include <EEDB/Chrom.h>
#include <EEDB/MetadataSet.h>
#include <EEDB/EdgeSet.h>
#include <EEDB/Expression.h>
#include <EEDB/SPStreams/StreamBuffer.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

typedef enum {CL_NONE, CL_SUM, CL_MIN, CL_MAX, CL_COUNT, CL_MEAN} t_collate_express_mode;

class Feature : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Feature();                // constructor
   ~Feature();                // destructor
    void init();              // initialization method
    void clear();             // clears edges, subfeatures, expression, metadata

    bool init_from_xml(void *xml_node);  // using a rapidxml node

    bool operator==(EEDB::Feature& b);
    bool operator!=(EEDB::Feature& b);
    bool operator<(EEDB::Feature& b);
    bool overlaps(EEDB::Feature *b);
    bool overlaps(EEDB::Feature *b, long int distance);
    bool subfeature_overlap_check(EEDB::Feature *b);
    bool subfeature_overlap_check(EEDB::Feature *b, map<string,bool> &subfeat_categories);
    bool subfeature_overlap_check(EEDB::Feature *b, map<string,bool> &subfeat_categories, long int distance);
    bool subfeatures_match(EEDB::Feature *b);

    //get atributes
    EEDB::FeatureSource*  feature_source();
    EEDB::Chrom*          chrom();
    EEDB::MetadataSet*    metadataset();
  //EEDB::EdgeSet*        edgeset();  //currently not used, but may eventually come back

    string               primary_name();
    string               assembly_name();
    string               chrom_name();
    long int             chrom_start();
    long int             chrom_end();
    char                 strand();
    
    string               chrom_location();
    double               significance();
    time_t               last_update();
    long int             chrom_id();

    void                        load_expression();  //trigger lazy load of expression
    vector<EEDB::Expression*>   expression_array();
    void                        empty_expression_array();
    bool                        build_expression_hash();    //builds hash if not already built
    void                        rebuild_expression_hash();  //rebuild internal expression hash if experiment/datatypes changed
    EEDB::Expression*           get_expression(EEDB::Experiment *experiment, EEDB::Datatype *datatype);
    EEDB::Expression*           find_expression(EEDB::Experiment *experiment, EEDB::Datatype *datatype);
    void                        add_expression(EEDB::Experiment *experiment, EEDB::Datatype *datatype, double value);
    void                        add_expression(EEDB::Expression *expression);
    void                        copy_expression(EEDB::Expression *expression);
    bool                        collate_expression(EEDB::Feature *feat2, t_collate_express_mode cmode);
    void                        calc_significance(t_collate_express_mode cmode);

    vector<EEDB::Feature*>      subfeatures();
    void                        add_subfeature(EEDB::Feature* subfeat);
    void                        clear_subfeatures();
    void                        remove_duplicate_subfeatures();
    void                        overlap_merge_subfeatures();
    void                        create_subfeature(EEDB::FeatureSource *source, long bstart, long bsize, long bidx);
    void                        create_cigar_subfeatures(EEDB::FeatureSource *source, string cigar);

    //set atributes
    void                 feature_source(EEDB::FeatureSource* obj);
    void                 chrom(EEDB::Chrom* obj);
    void                 primary_name(string value) { _primary_name = value; }
    void                 chrom_name(string value) { _chrom_name = value; }
    void                 chrom_start(long int value);
    void                 chrom_end(long int value);
    void                 strand(char value);
    void                 significance(double value) { _significance = value; }
    void                 last_update(time_t value) { _last_update = value; }


    //display / output
    string   display_contents();
    string   gff_description(bool show_metadata);
    string   bed_description(string format);
    string   category_cigar();  //zenbu cigar
    string   dasgff_xml();
    void     fullxml(string &xml_buffer);
    void     xml_interchange(string &xml_buffer, int level); //special XML for zenbu-2-zenbu interchange

    //database methods
    bool store(MQDB::Database *db);
    bool store_metadata();
    bool update_metadata();
    bool update_location();

    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db);
    void             init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static Feature*           fetch_by_id(MQDB::Database *db, long int id);
    static vector<DBObject*>  fetch_all_by_sources(MQDB::Database *db, vector<long int> &fsrc_ids);
    static vector<DBObject*>  fetch_all_by_source(EEDB::FeatureSource* source);
    static long int           get_count_symbol_search(MQDB::Database *db, string value, string type);
    static vector<DBObject*>  fetch_all_with_keywords(MQDB::Database *db, vector<long int> &fsrc_ids, vector<string> &keywords);
    static vector<DBObject*>  fetch_all_by_primary_name(MQDB::Database *db, vector<long int> &fsrc_ids, string name);
    static vector<DBObject*>  fetch_all_by_source_symbol(EEDB::FeatureSource* source, string sym_type, string sym_value);

    static void               stream_by_named_region(MQDB::DBStream *dbstream, vector<long int> &fsrc_ids, 
                                              string assembly_name, string chrom_name, long int chrom_start, long int chrom_end);
    static void               stream_by_named_region(MQDB::DBStream *dbstream, vector<long int> &fsrc_ids,
                                              vector<long int> &exp_ids, vector<string> &datatypes,
                                              string assembly_name, string chrom_name, long int chrom_start, long int chrom_end);  
    static void               fetch_by_region(MQDB::Database *db, EEDB::SPStreams::StreamBuffer *stream,
                                              vector<long int> &fsrc_ids, vector<long int> &exp_ids, vector<string> &datatypes, 
                                              string assembly_name, string chrom_name, long int chrom_start, long int chrom_end);
  
  public:  
    //memory management system to reuse object memory
    //use instead of new
    //eg:    EEDB::Feature *obj = EEDB::Feature::realloc();  //to 'new'
    //       obj->release();  //to 'delete' 
    static EEDB::Feature*  realloc();
    static void            realloc(EEDB::Feature *obj);  

  protected:
    EEDB::FeatureSource*       _feature_source;
    EEDB::Chrom*               _chrom;

    EEDB::MetadataSet          _metadataset;
    EEDB::EdgeSet              _edgeset;
    vector<EEDB::Expression*>  _expression_array;
    vector<EEDB::Feature*>     _subfeature_array;
    map<string, EEDB::Expression*> _expression_hash; //experiment_id+datatype string key

    string                     _primary_name;
    string                     _chrom_name;
    time_t                     _last_update;  //timestamp (unix time)
    long int                   _chrom_start;
    long int                   _chrom_end;
    double                     _significance;
    char                       _strand;
    long int                   _feature_source_id;
    long int                   _chrom_id;
    bool                       _metadata_loaded;
    bool                       _subfeatures_loaded;
    bool                       _subfeatures_sorted;
    bool                       _expression_loaded;
  
    void                       _load_subfeatures();

  private:
    static vector<EEDB::Feature*>    _realloc_feature_array;
    static int                       _realloc_idx;

    
  public: //for callback functions
    void   _dealloc();  //to fake delete    
    void   _xml(string &xml_buffer);
    void   _simple_xml(string &xml_buffer);
    void   _xml_start(string &xml_buffer);
    void   _xml_end(string &xml_buffer);
    void   _xml_subfeatures(string &xml_buffer);
    void   _xml_expression(string &xml_buffer);
    string _display_desc();


};

  
class FeatureLink  {
  public:
    EEDB::Feature    *feature;
    FeatureLink      *next;
    FeatureLink      *prev;
    
    FeatureLink();  //constructor  
    ~FeatureLink(); // destructor
};
  
};   //namespace

#endif

