/* $Id: LSArchiveImport.h,v 1.6 2013/04/08 07:32:28 severin Exp $ */

/***

NAME - EEDB::SPStreams::LSArchiveImport

SYNOPSIS

DESCRIPTION

 
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

#ifndef _EEDB_TOOLS_LSARCHIVEIMPORT
#define _EEDB_TOOLS_LSARCHIVEIMPORT

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/Experiment.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace Tools {
  
  
class LSArchiveImport : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;
  
  public:
    LSArchiveImport();                // constructor
    LSArchiveImport(void *xml_node);  // constructor using a rapidxml description
   ~LSArchiveImport();                // destructor
    void init();                      // initialization method
  
    bool                         sync_metadata_for_datasource(EEDB::DataSource *source);
    vector<EEDB::Experiment*>    get_experiments_by_libraryID(string libID);
  
    void test_curl();
                  
  protected:
    struct timeval     _starttime;
    void               _parse_lsa_sample_xml(EEDB::DataSource *source, void *xml_node);
    EEDB::Metadata*    _transfer_mdata(EEDB::DataSource *source, void *xml_node, string tag);
    EEDB::Metadata*    _transfer_mdata(EEDB::DataSource *source, void *xml_node, string tag, string newtag);
    void               _transfer_all_lsa_sample_xml(EEDB::DataSource *source, void *xml_node);
    EEDB::Metadata*    _direct_transfer_mdata(EEDB::MetadataSet *mdset, void *xml_node);

  public:  //used for callback functions, should not be considered open API
    void            _xml(string &xml_buffer);
    string          _display_desc();

};

};   //namespace SPStreams

};   //namespace EEDB


#endif
