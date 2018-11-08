/* $Id: UploadFile.h,v 1.12 2017/02/09 07:37:53 severin Exp $ */

/***

NAME - EEDB::JobQueue::UploadFile

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
UploadFile is short hand for Signal-Process-Stream

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

#ifndef _EEDB_JOBQUEUE_UPLOADFILE_H
#define _EEDB_JOBQUEUE_UPLOADFILE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <MQDB/Database.h>
#include <MQDB/DBObject.h>
#include <EEDB/SPStream.h>
#include <EEDB/User.h>
#include <EEDB/Feature.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/OSCFileDB.h>
#include <EEDB/JobQueue/Job.h>
#include <EEDB/ZDX/ZDXstream.h>
#include <EEDB/ZDX/ZDXsegment.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace JobQueue {

class UploadFile : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    UploadFile();           // constructor
   ~UploadFile();           // destructor
    void init();            // initialization method

    void        userDB(MQDB::Database *db);
  
    bool        process_upload_job(long job_id);
    bool        read_upload_xmlinfo(string xmlpath);
  
    void        set_parameter(string tag, string value);

    //ZDX loading methods
    EEDB::Peer*      load_into_zdx();

    //genome loading methods
    EEDB::Peer*      load_into_new_genome();       //create new genome
    EEDB::Peer*      load_into_existing_genome();  //appends new chromosomes
    EEDB::Peer*      load_genome_from_NCBI(string ncbi_acc);  //create new genome via download from NCBI
    bool             load_entrez_genes_from_NCBI(ZDXdb* zdxdb, MQDB::Database *entrezDB, string assembly_name);
    bool             load_ncbi_chrom_sequence(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly);


  //internal variables, should not be considered open API
  protected:
    map<string,string>       _upload_parameters;
    EEDB::JobQueue::Job*     _current_job;
    MQDB::Database*          _userDB;
    unsigned long            _chunk_size;
    unsigned long            _chunk_overlap;
    vector<long>             _entrez_gene_id_buffer;
    EEDB::Assembly*          _entrez_assembly;
    EEDB::FeatureSource*     _entrez_source;
    long                     _entrez_locmove_count;
    bool                     _gff_virtual_parents;

  
    string      _upload_output_name();
    bool        _fasta_create_chromosomes(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name);
    bool        _chromosome_chunk_fasta(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Assembly *assembly, string path, bool use_header_name);
    bool        _create_chunk(EEDB::ZDX::ZDXstream *zdxstream, EEDB::Chrom *chrom, long chr_start, long chr_end, string seq);

    void            _sync_entrez_gene_from_webservice(MQDB::Database *entrezDB, long entrezID);
    EEDB::Feature*  _extract_entrez_gene_from_summaryXML(rapidxml::xml_node<> *summaryXMLnode);
    void            _add_matching_loc_hist_XML_to_feature(rapidxml::xml_node<> *locXML, EEDB::Feature* feature);
    EEDB::Feature*  _dbcompare_update_newfeature(EEDB::Feature * feature);

  
};

};  // JobQueue namespace

};  // EEDB namespace

#endif
