/* $Id: DBCache.h,v 1.8 2013/04/08 05:44:45 severin Exp $ */

/****
NAME - MQDB::DBCache

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


#ifndef _MQDB_DBCACHE_H
#define _MQDB_DBCACHE_H

#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <vector>

#include <MQDB/Database.h>
#include <MQDB/DBObject.h>

using namespace std;

namespace MQDB {
class Database;
class DBObject;


class DBCacheEntry {
  public:
    DBObject       *obj;
    DBCacheEntry   *next;
    DBCacheEntry   *prev;
    int            access_count;
    
    DBCacheEntry() { 
      obj=NULL;
      next=NULL;
      prev=NULL;
      access_count=0;
    }
    
    ~DBCacheEntry() {
      if(obj!=NULL) { obj->release(); }
    }
};

// global caching interface
class DBCache {
  public:
  
    static void  
    cache_resize(long unsigned int value) {
      if(value < 1) { value = 1; }
      _cache_size = value;
     
      //difficult to resize so flush cache
      if(_id_cache.size() > value) {
        DBCacheEntry *entry, *t_entry;
        entry = _front;
        while(entry!=NULL) {
          t_entry = entry;
          entry = entry->next;
          delete t_entry;
        }
        _id_cache.clear();
        _front = NULL;
        _back  = NULL;
      }
    }


    static void
    clear_cache() {
      map<string, DBCacheEntry*>::iterator  it;
      for(it = _id_cache.begin(); it != _id_cache.end(); it++) {
        DBCacheEntry  *entry = (*it).second;
        if(entry->obj != NULL) { entry->obj->release(); entry->obj = NULL; }
      }
      _id_cache.clear();
    }


    static DBObject*  
    check_cache(string fed_id) {
      //fed_id is in format <db_uuid>::<id>::<classname>
      if(_id_cache.find(fed_id) != _id_cache.end()) {
        DBCacheEntry *entry = _id_cache[fed_id];
        _move_entry_to_front(entry);
        return entry->obj;
      }
      return NULL;
    }


    static DBObject*  
    check_cache(MQDB::Database *db, long int id, const char* classname) {
      //fed_id is in format <db_uuid>::<id>::<classname>
      char buffer[64];
      string cacheid; 
      if(db == NULL) { return NULL; }
      if(db->uuid() == NULL) { return NULL; }
      cacheid = string(db->uuid()) + "::";
      snprintf(buffer, 62, "%ld", id);
      cacheid += buffer;
      if(classname != NULL) { cacheid += string(":::") + string(classname); }
      if(_id_cache.find(cacheid) != _id_cache.end()) {
        DBCacheEntry *entry = _id_cache[cacheid];
        _move_entry_to_front(entry);
        return entry->obj;
      }
      return NULL;
    }


    static void 
    add_to_cache(DBObject *obj) {
      if(obj == NULL) { return; }
      if(obj->database() == NULL) { return; }
      if(obj->database()->uuid() == NULL) { return; }
      
      string fed_id = obj->db_id();
      //fprintf(stderr, "add_to_cache[%s]\n", fed_id.c_str());
      
      if(_id_cache.find(fed_id) != _id_cache.end()) {
        DBCacheEntry *entry = _id_cache[fed_id];
        _move_entry_to_front(entry);
        return;
      }
      
      DBCacheEntry *entry = new DBCacheEntry();
      entry->obj = obj;
      obj->retain();
      
      _id_cache[fed_id] = entry;
      _move_entry_to_front(entry);
     
      if(_id_cache.size() > _cache_size) {
        //remove last entry
        string cacheid = _back->obj->db_id();
        _id_cache.erase(cacheid);
        DBCacheEntry  *e1 = _back->prev;
        delete _back;
        _back = e1;
        if(_back != NULL) { _back->next = NULL; }
      }
    }
    
    static void
    debug_cache() {
      fprintf(stderr, "debug DBCache::\n");
      DBCacheEntry* entry;
      entry = _front;
      int count =1;
      while(entry!=NULL) {
        if(entry->obj != NULL) {
          fprintf(stderr, "  entry[%d] = %s\n", count, entry->obj->db_id().c_str());
        } else {
          fprintf(stderr, "  entry[%d] = NULL\n", count);
        }
        entry = entry->next;
        count++;
      }
    }
    
    
  private:
    static void  
    _move_entry_to_front(DBCacheEntry* entry) {
      if(entry==NULL) { return; }
      if(entry == _front) { return; }
      
      if(_front==NULL) {
        _front = entry;
        _back  = entry;
        entry->prev = NULL;
        entry->next = NULL;
        return;
      }
      //from here down we have a _front and _back defined
      
      DBCacheEntry  *e1, *e2;
      e1 = entry->prev;
      e2 = entry->next;
      if(e1!=NULL) { e1->next = e2; }
      if(e2!=NULL) { e2->prev = e1; }
    
      if(_back == entry) {
        if(e2!=NULL)      { _back = e2; }
        else if(e1!=NULL) { _back = e1; }
      }
        
      entry->prev  = NULL;  //new front
      entry->next  = _front;
      _front->prev = entry;
      _front       = entry;
    }
    

    static map<string, DBCacheEntry*>  _id_cache;
    static long unsigned int           _cache_size;
    static DBCacheEntry*               _front;
    static DBCacheEntry*               _back;

};

};   //namespace

#endif 
