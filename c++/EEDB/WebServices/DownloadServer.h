/* $Id: DownloadServer.h,v 1.1 2016/06/07 07:11:49 severin Exp $ */

/***

NAME - EEDB::WebServices::DownloadServer

SYNOPSIS

DESCRIPTION

Abstract superclass for all stream signal-processing modules. 
DownloadServer is short hand for Signal-Process-Stream

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

#ifndef _EEDB_WEBSERVICES_DOWNLOADSERVER_H
#define _EEDB_WEBSERVICES_DOWNLOADSERVER_H

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

using namespace std;
using namespace MQDB;

namespace EEDB {

namespace WebServices {

class DownloadServer : public WebBase {
  public:  //global class level
    static const char*  class_name;

  public:
    DownloadServer();             // constructor
   ~DownloadServer();             // destructor
    void init();            // initialization method

    void   display_info();
    string display_desc();
    string display_contents();

    string xml_start();
    string xml_end();
    string simple_xml();
    string xml();

    bool    process_url_request();
    void    show_api();

    void    process_xml_parameters();
    void    postprocess_parameters();
    bool    execute_request();

    void    download_single_file();
  
  //internal variables and methods, should not be considered open API
  protected:
    map< string, map<string, bool> >   _global_source_counts;  //[class][uuid]=bool
    map<string,bool>                   _desc_xml_tags;

};

};  // WebServices namespace

};  // EEDB namespace

#endif
