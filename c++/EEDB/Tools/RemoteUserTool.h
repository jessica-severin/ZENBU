
/* $Id: RemoteUserTool.h,v 1.2 2013/04/02 08:01:22 severin Exp $ */

/***

NAME - Tools::RemoteUserTool

SYNOPSIS

DESCRIPTION

 Collection of methods to interact in a remote manner with a ZENBU user system using the
 HMAC authentication protocol. Provides access to all the user manipluations WS API functions
 - upload file
 - delete file
 - edit metadata
 - share data with collaboration
 - list user uploaded data
 
CONTACT

Jessica Severin <severin@gsc.riken.jp> <jessica.severin@gmail.com>

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

#ifndef _EEDB_TOOLS_REMOTEUSERTOOL_H
#define _EEDB_TOOLS_REMOTEUSERTOOL_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>
#include <EEDB/DataSource.h>
#include <EEDB/SPStream.h>
#include <EEDB/Collaboration.h>

using namespace std;
using namespace MQDB;

namespace EEDB {

class Peer;  //forward declaration to avoid include circle

namespace Tools {

  class RemoteUserTool : public MQDB::DBObject {
  public:  //global class level
    static const char*  class_name;

  public:
    RemoteUserTool();           // constructor
   ~RemoteUserTool();           // destructor
    void init();                // initialization method

    static EEDB::Tools::RemoteUserTool*  new_from_url(string url);  //url of remote ZENBU to interact with
  
    void   display_info();
    string display_desc();
    string display_contents();

    //configuration methods
    void         server_url(string url);
    EEDB::User*  current_user();
    void         set_user(EEDB::User* user);

    void         set_peer_uuids(string peers);

    bool                          verify_remote_user();
    vector<EEDB::Collaboration*>  fetch_user_collaborations(); //collaborations user is member/owner of
    EEDB::SPStream*               stream_uploaded_data_sources(string classname, string filter_logic);

  private:
    string                       _server_url;
    EEDB::Peer*                  _web_peer;
    EEDB::User*                  _user;
    string                       _peers_filter;


  //used for callback functions, should not be considered open API
  public:
    void               _xml(string &xml_buffer);
    bool               _init_remote_server();  
    bool               _get_cmdline_user();

};

};   //namespace Tools

};   //namespace EEDB


#endif
