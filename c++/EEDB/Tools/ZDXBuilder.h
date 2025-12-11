/* $Id: ZDXBuilder.h,v 1.1 2025/12/09 07:12:59 severin Exp $ */

/***

NAME - EEDB::Tools::ZDXBuilder

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
RegionServer is short hand for Signal-Process-Stream

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

#ifndef _EEDB_TOOLS_ZDXBUILDER_H
#define _EEDB_TOOLS_ZDXBUILDER_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <EEDB/SPStream.h>
#include <EEDB/User.h>
#include <EEDB/Feature.h>
#include <EEDB/Tools/OSCFileParser.h>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
  
namespace Tools {

  class ZDXBuilder : public MQDB::DBObject {
  
  public:  //global class level
    static const char*  class_name;

  public:
    ZDXBuilder();      // constructor
    ~ZDXBuilder();     // destructor
    void init();       // initialization method

    void             set_parameter(string tag, string value);
    void             set_assembly(EEDB::Assembly* assembly);
    EEDB::Assembly*  assembly();

    //ZDX loading methods
    EEDB::Peer*      create_zdx_for_file(string filepath);

    //genome loading methods
    EEDB::Peer*      _load_osc_file();     //create ZDX from tab text feature file (bed, osc, gff, sam..)
    EEDB::Peer*      _load_new_genome();   //create new genome from fasta file or directory


  //internal variables, should not be considered open API
  protected:
  
    string      _build_output_filename();
    bool        _fasta_create_chromosomes(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name);
    bool        _chromosome_chunk_fasta(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name);
    bool        _create_chunk(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Chrom *chrom, long chr_start, long chr_end, string seq);

    void            _sync_entrez_gene_from_webservice(MQDB::Database *entrezDB, long entrezID);
    EEDB::Feature*  _extract_entrez_gene_from_summaryXML(rapidxml::xml_node<> *summaryXMLnode);
    void            _add_matching_loc_hist_XML_to_feature(rapidxml::xml_node<> *locXML, EEDB::Feature* feature);
    EEDB::Feature*  _dbcompare_update_newfeature(EEDB::Feature * feature);

    
    
    
  //internal variables and methods, should not be considered open API
  protected:
    EEDB::ZDX::ZDXsegment*                   _request_build_segment();
    long                                     _build_zdxsegment(EEDB::ZDX::ZDXsegment* zseg);
    
    map<string,string>       _parameters;
    unsigned long            _chunk_size;
    unsigned long            _chunk_overlap;
    bool                     _gff_virtual_parents;
    EEDB::Assembly*          _default_assembly;

};

};  // Tools namespace

};  // EEDB namespace

#endif
