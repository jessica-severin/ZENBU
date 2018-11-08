// $Id: DBObject.h,v 1.37 2016/05/13 08:50:31 severin Exp $

/***
NAME

MQDB::DBObject - DESCRIPTION of Object

SYNOPSIS

Root class for all objects in MappedQuery toolkit

DESCRIPTION

Root object for toolkit and all derived subclasses. 
All objects in the MappedQuery structure are designed to 
be persisted in a database. Here database is a more broad
term and can be considered any object persistance systems.
Currently the toolkit works with SQL based systems but 
object databases or custom storage engines are possible.
Provides base common methods used by all objects. 

AUTHOR

Contact Jessica Severin: jessica.severin@gmail.com

LICENSE

 * Software License Agreement (BSD License)
 * MappedQueryDB [MQDB] toolkit
 * copyright (c) 2006-2013 Jessica Severin
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin nor the
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

The rest of the documentation details each of the object methods. 
Internal methods are usually preceded with a _

***/

#ifndef _MQDB_DBOBJECT_H
#define _MQDB_DBOBJECT_H


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <boost/algorithm/string/replace.hpp>
#include <MQDB/Database.h>


using namespace std;

namespace MQDB {

  void   parse_federated_id(string fid, string &uuid, long int &objID, string &objClass);

class DBObject {
  public:  //global class level
    static const char*  class_name;
    
  public:
    DBObject();                 // constructor
   ~DBObject();                 // destructor

    void         init();        // initialization method which subclasses can extend
    DBObject*    copy();        // Shallow copy which copies all base attributes of object 
                                //   to new instance of same class

    void         retain();
    void         release();
    long int     retain_count() { return _retain_count; }

    //get methods
    const char*  classname(); 
    Database*    database();
    long int     primary_id();
    string       id(); //primary_id as string
    const char*  peer_uuid();
    const char*  root_uuid();
    string       db_id();

    //set methods
    void         database(Database* db);
    void         primary_id(long int id);
    void         peer_uuid(const char* uuid);
    void         root_uuid(const char* uuid);
    void         db_id(string id);
    
    string       display_desc();
    void         display_info();

    void         xml(string &xml_buffer);
    void         simple_xml(string &xml_buffer);
    void         mdata_xml(string &xml_buffer, map<string,bool> mdtags);
    string       xml();
    string       simple_xml();
    string       mdata_xml(map<string,bool> mdtags);


  protected:
    MQDB::Database  *_database;
    long int         _primary_db_id;  // internal 32bit integer for object
    string           _db_id;
    const char*      _peer_uuid;
    const char*      _root_uuid;
    const char*      _classname;
    long int         _retain_count;
    
    void             (*_funcptr_delete)(MQDB::DBObject* obj);
    string           (*_funcptr_display_desc)(MQDB::DBObject* obj);
    void             (*_funcptr_xml)(MQDB::DBObject* obj, string &xml_buffer);
    void             (*_funcptr_simple_xml)(MQDB::DBObject* obj, string &xml_buffer);
    void             (*_funcptr_mdata_xml)(MQDB::DBObject* obj, string &xml_buffer, map<string,bool> mdtags);
  
  public:  //for callback
    string           _display_desc();


};

};   //namespace


/* classname()

  Description: fixed string symbol for this class. Must be implemented 
               for each subclass and each subclass within toolkit 
               should return a unique name. used by global  methods.
  Returntype : string
  Exceptions : error if subclass does not redefine

*/

/* database()

  Description: the MQDB::Database where this object is permanently persisted to.
               Here database is any object persistance system.
  Returntype : MQDB::Database
  Exceptions : die if invalid setter value type is provided 

*/

/* primary_id

  Description: the unique identifier for this object within database.
  Returntype : scalar or UNDEF
  Exceptions : none

*/

/* id

  Description: the unique identifier for this object within database.
               Returns empty string if not persisted.
  Returntype : scalar or ''
  Exceptions : none

*/

/* db_id

  Description: the worldwide unique identifier for this object.
               A URL-like combination of database, class, and id
  Returntype : string or undef if database is not defined
  Exceptions : none

*/


/* peer_uuid

  Description: the worldwide unique identifier for the peer/database where this object resides.
              db_id is combination of peer_uuid and primary_id
  Returntype : UUID string or undef
  Exceptions : none

*/

/* display_desc

  Description: general purpose debugging method that returns a nice
               human readable description of the object instance contents.
               Each subclass should implement and return a nice string.
  Returntype : string scalar 
  Exceptions : none

*/

/* display_info

  Description: convenience method which prints the display_desc string
               with a carriage return to STDOUT. useful for debugging.
  Returntype : none
  Exceptions : none

*/


/* xml

  Description: every object in system should be persistable in XML format.
               returns an XML description of the object and all child objects.
               Each subclass must implement and return a proper XML string.
               Best if one implements xml_start() and xml_end() and use here.
  Returntype : string scalar 
  Exceptions : none 
  Default    : default is a simple xml_start + xml_end 

*/


/* xml_start

  Description: every object in system should be persistable in XML format.
               returns an XML description of the object and all child objects.
               Each subclass should OVERRIDE this method and return a proper XML string.
               xml_start is the primary XML start tag
  Example    : return sprintf("<feature id='%d' name='%d' ..... >", $id, $name....);
  Returntype : string scalar 
  Exceptions : none 

*/

/* xml_end

  Description: every object in system should be persistable in XML format.
               returns an XML description of the object and all child objects.
               Each subclass should OVERRIDE this method and return a proper XML string.
               xml_end is the primary XML end tag 
  Example    : return "</feature>";
  Returntype : string scalar 
  Exceptions : none 

*/

/* simple_xml

  Description: short hand for xml_start() . xml_end()
               Can be used when only the primary XML start tag and attributes are needed
               No need to override if xml_start() and xml_end() are implemented
  Returntype : string scalar 
  Exceptions : none

*/


#endif

