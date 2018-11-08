/* $Id: MetadataSet.h,v 1.17 2016/05/13 08:53:49 severin Exp $ */

/***

NAME - EEDB::MetadataSet

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

#ifndef _EEDB_METADATASET_H
#define _EEDB_METADATASET_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/Metadata.h>
#include <EEDB/Symbol.h>

using namespace std;
using namespace MQDB;

namespace EEDB {


class MetadataSet : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

  public:
    MetadataSet();            // constructor
   ~MetadataSet();            // destructor
    void init();              // initialization method
    void init_from_xml(void *xml_node); // init using a rapidxml parent node

    MetadataSet* copy();

    void display_info();
    string display_desc();
    string display_contents();

    string gff_description();  //returns metadataset as GFF 'attributes' formated string
    void   xml_nokeywords(string &xml_buffer);

    bool store(MQDB::Database *db);

    void merge_metadataset(MetadataSet *mdset); 

    void add_metadata(vector<DBObject*> data);
    void add_metadata(vector<EEDB::Metadata*> data);
    void add_metadata(Metadata* data);
    void add_from_gff_attributes(string gff_attrib);  //parse metadata from GFF attributes style string
    void remove_metadata(vector<EEDB::Metadata*> data);
    void remove_metadata(EEDB::Metadata* data);
    void remove_metadata_like(string tag, string value);


    Symbol*   add_tag_symbol(string tag, string value);
    Metadata* add_tag_data(string tag, string data);
    Metadata* add_metadata(string tag, string value); //smart method decides if Symbol or Metadata

    void    remove_duplicates();
    void    extract_keywords();
    void    clear();
    void    extract_mdkeys(map<string, bool> &mdkey_hash);


    // list access methods
    int                count();
    int                size();
    int                data_size();
    vector<Metadata*>  metadata_list();


    // search methods
    Metadata*         find_metadata(string tag, string value);
    vector<Metadata*> find_all_metadata_like(string tag, string value);
    bool              has_metadata_like(string tag, string value);
    bool              check_by_filter_logic(string filter);
    vector<Metadata*> all_metadata_with_tags(map<string,bool> tags);

    /*****
      convert_bad_symbols

      Description  : Symbol is a special subclass of metadata which is supposed to be keyword-like
                     Symbols should have no whitespace and should be short enough to fit in the table
                     This method will double check the metadata and any improper Symbol is 
                     converted into EEDB::Metadata and unlinked from database.
                     This is useful when mirroring data or prior to bulk loading.
      Returntype   : $self
      Exceptions   : none
    *****/
    void convert_bad_symbols();

  protected:
    vector<Metadata*>     _metadata;

  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);

};

};   //namespace

#endif
