/* $Id: UploadServer.h,v 1.18 2021/04/06 09:59:58 severin Exp $ */

/***

NAME - EEDB::WebServices::UploadServer

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
UploadServer is short hand for Signal-Process-Stream

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

#ifndef _EEDB_WEBSERVICES_UPLOADSERVER_H
#define _EEDB_WEBSERVICES_UPLOADSERVER_H

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
#include <EEDB/WebServices/WebBase.h>
#include <EEDB/SPStreams/FederatedSourceStream.h>
#include <EEDB/SPStreams/OSCFileDB.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace WebServices {

  class UploadFile {
  public:
    string orig_filename; //original name from the remote host
    string safebasename;
    string file_format;
    string file_uuid;
    string safename;  //safebasename with file extension (with gz if present)
    string safepath;  //safename in the userdir
    string xmlpath;

    string             display_name;
    string             description;
    string             gff_mdata;

    UploadFile();
    UploadFile(void *xml_node);   // constructor using a rapidxml node

    string  xml();
  };
  
  
class UploadServer : public WebBase {
  public:  //global class level
    static const char*  class_name;

  public:
    UploadServer();           // constructor
   ~UploadServer();           // destructor
    void init();              // initialization method

    bool        process_url_request();
    void        show_api();

    void        process_xml_parameters();
    void        postprocess_parameters();
    void        parse_processing_stream(void *xml_node);
    void        parse_metadata_commands(void *xml_node);
    bool        execute_request();

    EEDB::SPStreams::FederatedSourceStream*  source_stream();    

    void        show_user();
    void        show_upload_status();
    void        show_queue_status();
    void        clear_failed_jobs();
    void        clear_blocked_jobs();
    void        redirect_to_mydata();
  
    void        delete_uploaded_database();

    void        prepare_file_upload(); //step1 of upload
    void        receive_file_data();   //step2 of upload
  
    //internal methods, but can be used to control this class like a tool
    void        prevent_duplicate_uploads();
    string      prepare_safeupload_file(string orig_filename);
    string      write_upload_xmlinfo(string orig_filename);
    void        queue_upload(string orig_filename);

  
  //internal variables, should not be considered open API
  protected:
    map< string, map<string, bool> >   _global_source_counts;  //[class][uuid]=bool
    string                             _safe_upload_filename;
    long int                           _upload_linecount;
    map<string,string>                 _upload_parameters;
    vector<mdedit_t>                   _mdata_edit_commands;
    map<string, UploadFile >           _upload_file_list;  //map from orig_filename to safe_name,filetype..
    map<string, long>                  _previous_upload_origfiles;
  
  
};

};  // WebServices namespace

};  // EEDB namespace

#endif
