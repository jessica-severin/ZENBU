/* $Id: Proxy.cpp,v 1.6 2013/04/08 07:39:12 severin Exp $ */

/***

NAME - EEDB::SPStreams::Proxy

SYNOPSIS

DESCRIPTION

a simple SPStream which does nothing but acts as a unique place holder in a script
which can be reconstructed from XML.  scripting system will then replace Proxies
with FederatedSource streams which have gone through security checks for user data access.

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


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/Proxy.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::Proxy::class_name = "EEDB::SPStreams::Proxy";

//function prototypes
void _spstream_proxy_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::Proxy*)obj;
}
void _spstream_proxy_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::Proxy*)obj)->_xml(xml_buffer);
}
void _spstream_proxy_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::Proxy*)node)->_reset_stream_node();
}
void _spstream_proxy_get_proxies_by_name(EEDB::SPStream* node, string proxy_name, vector<EEDB::SPStream*> &proxies) {
  EEDB::SPStreams::Proxy  *proxy = (EEDB::SPStreams::Proxy*)node;
  if(proxy==NULL) { return; }
  if(proxy->proxy_name() == proxy_name) {
    proxies.push_back(node);
  }
}


EEDB::SPStreams::Proxy::Proxy() {
  init();
}

EEDB::SPStreams::Proxy::~Proxy() {
}

void EEDB::SPStreams::Proxy::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::Proxy::class_name;
  _module_name               = "Proxy";

  _funcptr_delete            = _spstream_proxy_delete_func;
  _funcptr_xml               = _spstream_proxy_xml_func;
  _funcptr_simple_xml        = _spstream_proxy_xml_func;

  //function pointer code
  _funcptr_get_proxies_by_name                = _spstream_proxy_get_proxies_by_name;
  _funcptr_reset_stream_node                  = _spstream_proxy_reset_stream_node_func;

  //variables
  _proxy_uuid   = uuid_hexstring();
  _proxy_stream = NULL;
}


////////////////////////////////////////////////////////////////////////////

string  EEDB::SPStreams::Proxy::proxy_name() {
  /*
  if(@_ and (!defined($self->{'_proxy_name'}))) {
    my $name = shift;
    $self->{'_proxy_name'} = $name;
    $__riken_EEDB_spstream_proxy_global_name_cache->{$self->{'_proxy_name'}}->{$self->{'_proxy_uuid'}} = 1;
  }
  */
  return _proxy_name;
}


/*** proxy_stream
  Description: set the redirected source stream 
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none
***/

void  EEDB::SPStreams::Proxy::proxy_stream(EEDB::SPStream* stream) {
  if(!stream) { return; }
  /*
  unless(defined($stream) && ($stream->isa('EEDB::SPStream') or $stream->isa('MQdb::DBStream'))) {
    print(STDERR "ERROR:: side_stream() param must be a EEDB::SPStream or MQdb::DBStream");
    return undef;
  }
  if($stream eq $self) {
    printf(STDERR "ERROR: can not set source_stream() to itself");
    return undef;
  }
  */
  _proxy_stream = stream;
}


/*
sub display_desc {
  my $self = shift;
  my $str = sprintf("Proxy[%s] %s", $self->name, $self->{'_proxy_uuid'});
  return $str;
}
*/

void EEDB::SPStreams::Proxy::_reset_stream_node() {
  _source_stream = _proxy_stream;
}


/*****************************************************************************************/

void EEDB::SPStreams::Proxy::_xml(string &xml_buffer) {

  xml_buffer.append("<spstream module=\"");
  xml_buffer.append(_module_name);
  xml_buffer.append("\" name=\"");
  xml_buffer.append(proxy_name());
  xml_buffer.append("\">");
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::Proxy::Proxy(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }

  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  rapidxml::xml_attribute<> *attr;
  
  if(string(root_node->name()) != "spstream") { return; }
  
  if((attr = root_node->first_attribute("name"))) {
    _proxy_name = attr->value();
  }
}


/*
sub init {
  my $self = shift;

  $self->{'_retain_count'} = 1;
  $self->{'_proxy_name'} = undef;

  # internal UUID
  my $ug    = new Data::UUID;
  my $uuid  = $ug->create_b64();
  chomp($uuid);
  $uuid =~ s/=//g;
  $uuid =~ s/\+/\-/g;
  $uuid =~ s/\//_/g;
  $self->{'_proxy_uuid'} = $uuid;
  $__riken_EEDB_spstream_proxy_global_uuid_cache->{$uuid} = $self;
  
  return $self;
}

sub retain {
  my $self = shift;
  $self->{'_retain_count'}++;
}

sub release {
  my $self  = shift;
  $self->{'_retain_count'}--;
  if($self->{'_retain_count'} >0) { return; }

  #printf("Proxy destroy : %s\n", $self->{'_proxy_uuid'});
  #remove from global caches
  delete $__riken_EEDB_spstream_proxy_global_uuid_cache->{$self->{'_proxy_uuid'}};
  
  my $thash = $__riken_EEDB_spstream_proxy_global_name_cache->{$self->{'_proxy_name'}};
  if($thash) { delete $thash->{$self->{'_proxy_uuid'}}; }
  return undef;
}

sub DESTROY {
  my $self = shift;
  $self->{'_retain_count'} = 0;
  $self->release;
}

*/

