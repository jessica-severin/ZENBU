/* $Id: Job.h,v 1.9 2014/03/20 07:50:30 severin Exp $ */

/****
NAME - EEDB::JobQueue::Job

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

**************/


#ifndef _EEDB_JOBQUEUE_JOB_H
#define _EEDB_JOBQUEUE_JOB_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <iostream>
#include <string>
#include <vector>
#include <MQDB/Database.h>
#include <MQDB/MappedQuery.h>
#include <EEDB/User.h>

using namespace std;
using namespace MQDB;

namespace EEDB {
  
namespace JobQueue {

class Job : public MQDB::MappedQuery {
  public:  //global class level
    static const char*  class_name;

  public:
    Job();                  // constructor
    Job(EEDB::User *user);  // constructor
    Job(void *xml_node);    // constructor using a rapidxml node
   ~Job();                  // destructor
    void init();            // initialization method

    //get atribute
    EEDB::User*           user();
    EEDB::MetadataSet*    metadataset();
  
    string  status() { return _status; }
    string  display_name();
    string  description();
    string  genome_name();

    time_t  created() { return _created; }
    time_t  completed() { return _completed; }
    string  created_date_string();
    string  completed_date_string();

    //set attribute
    void    status(string value);

    //database methods
    bool    store();
    bool    store_metadata();
    bool    update_metadata();
  
    //
    // static member function each subclass must implement this code
    // replace the "<class*> obj = new <class>" line with subclass specific class type
    // must return as DBObject* cast
    //
    static DBObject* create(map<string, dynadata> &row_map, Database* db) {
      Job* obj = new EEDB::JobQueue::Job;
      obj->database(db);
      obj->init_from_row_map(row_map);
      return obj;
    }
    void  init_from_row_map(map<string, dynadata> &row_map);

    //
    // static member functions for object retrieval from database
    //
    static Job*               fetch_by_id(MQDB::Database *db, long int id);
    static vector<DBObject*>  fetch_all_by_user(EEDB::User *user);
  
  protected:
    EEDB::User*         _user;
    EEDB::MetadataSet   _metadataset;
    bool                _metadata_loaded;
    string              _status;
    time_t              _created;
    time_t              _completed;
    long                _user_id;
    long                _analysis_id;


  //internal API used for callback functions, should not be considered open API
  public:
    void   _xml(string &xml_buffer);
    string _display_desc();

};

};   //namespace JobQueue

};   //namespace EEDB

#endif 
