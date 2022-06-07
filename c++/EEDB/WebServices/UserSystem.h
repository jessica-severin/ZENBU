/* $Id: UserSystem.h,v 1.28 2021/01/22 06:02:24 severin Exp $ */

/***

NAME - EEDB::WebServices::UserSystem

SYNOPSIS

DESCRIPTION

Specific subclass of WebBase which handles the user and collaboration subsystem

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

#ifndef _EEDB_WEBSERVICES_USERSYSTEM_H
#define _EEDB_WEBSERVICES_USERSYSTEM_H

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

using namespace std;
using namespace MQDB;

namespace EEDB {
  
namespace WebServices {
  
class UserSystem : public WebBase {
  public:  //global class level
    static const char*  class_name;

  public:
    UserSystem();           // constructor
   ~UserSystem();           // destructor
    void init();            // initialization method

    bool                   process_url_request();
    void                   show_api();

    void                   process_xml_parameters();
    void                   postprocess_parameters();
    void                   parse_metadata_edit_commands(void *xml_node);

    bool                   execute_request();
    
    void                   show_user();
    void                   redirect_to_user_profile();
    void                   redirect_to_last_url();
    void                   password_login();
    void                   logout();
    void                   reset_session();
    void                   update_profile();
    void                   create_user();
    void                   reset_password();
    void                   create_collaboration();
    void                   show_collaborations();
    void                   ignore_collaboration();
    void                   accept_collaboration_request();
    void                   reject_collaboration_request();
    void                   collaboration_remove_user();
    void                   collaboration_make_admin_user();
    void                   collaboration_revoke_admin_user();
    void                   collaboration_make_public(bool value);
    void                   invite_user_to_collaboration();
    void                   accept_collaboration_invitation();
    void                   share_uploaded_database();
    void                   unshare_uploaded_database();
    void                   update_config_sources();
    void                   upgrade_user_uploads();
    void                   edit_objects_metadata();
    void                   source_search_edit_metadata();
    bool                   apply_mdata_edit_commands(MQDB::DBObject *obj, vector<mdedit_t> &cmds);
    void                   save_mdata_edits(MQDB::DBObject *obj);
    void                   show_downloads();

    void                   send_validation_email();
    void                   send_password_reset_email();
    void                   send_invitation_email(EEDB::User *invited_user, string collab_name);
    void                   receive_validation();
    void                   generate_hmac();


  //internal variables and methods, should not be considered open API
  protected:
    string                 _processing_error;

    map<string, vector<mdedit_t> >   _mdata_edit_commands;  //hash the ID/filter into list of commands
};

};  // WebServices namespace

};  // EEDB namespace

#endif
