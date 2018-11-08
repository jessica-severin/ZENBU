=head1 NAME - EEDB::SPStream::Proxy

=head1 DESCRIPTION

A simple signal procesor which is configured with a strand and then 
only passes features which match that strand

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2009 Jessica Severin RIKEN OSC
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

=head1 APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

=cut

my $__riken_EEDB_spstream_proxy_global_name_cache = {};
my $__riken_EEDB_spstream_proxy_global_uuid_cache = {};

package EEDB::SPStream::Proxy;

use strict;
use Data::UUID;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::Proxy"; }

sub active_proxy_count {
  return scalar(values(%$__riken_EEDB_spstream_proxy_global_uuid_cache));
}

sub get_proxies_by_name {
  my $class = shift;
  my $name = shift;

  unless($name) { return []; }
  my $thash = $__riken_EEDB_spstream_proxy_global_name_cache->{$name};
  if($thash) {
    my @uuids = keys(%$thash);
    my @proxies;
    foreach my $uuid (@uuids) {
      my $proxy = $__riken_EEDB_spstream_proxy_global_uuid_cache->{$uuid};
      if($proxy) { push @proxies, $proxy; }
    }
    return \@proxies;
  }
  return [];
}

sub clear_global_proxy_cache {
  $__riken_EEDB_spstream_proxy_global_name_cache = {};
  $__riken_EEDB_spstream_proxy_global_uuid_cache = {};
}

#################################################
# Instance methods
#################################################

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


#################################################

sub name {
  my $self = shift;
  
  if(@_ and (!defined($self->{'_proxy_name'}))) {
    my $name = shift;
    $self->{'_proxy_name'} = $name;
    $__riken_EEDB_spstream_proxy_global_name_cache->{$self->{'_proxy_name'}}->{$self->{'_proxy_uuid'}} = 1;
  }
  return $self->{'_proxy_name'};
}


=head2 proxy_stream

  Description: set the redirected source stream 
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none

=cut

sub proxy_stream {
  my $self = shift;
  if(@_) {
    my $stream = shift;
    unless(defined($stream) && ($stream->isa('EEDB::SPStream') or $stream->isa('MQdb::DBStream'))) {
      print(STDERR "ERROR:: side_stream() param must be a EEDB::SPStream or MQdb::DBStream");
      return undef;
    }
    if($stream eq $self) {
      printf(STDERR "ERROR: can not set source_stream() to itself");
      return undef;
    }
    $self->{'_source_stream'} = $stream;
  }
  return $self->{'_source_stream'};
}


sub source_stream {
  my $self = shift;
  return $self->{'_source_stream'};
}


##################################
#
# override methods which should not reconfigure proxy stream

sub add_source_filter {
  my $self = shift;
  return undef;
}

sub add_expression_datatype {
  my $self = shift;
  return undef;
}

sub sourcestream_output {
  my $self = shift;
  return undef;
}

sub clear_all_filters {
  my $self = shift;
  return undef;
}





#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################


sub display_desc {
  my $self = shift;
  my $str = sprintf("Proxy[%s] %s", $self->name, $self->{'_proxy_uuid'});
  return $str;
}

sub xml {
  my $self = shift;
  my $str = $self->xml_start() . $self->xml_end();
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = sprintf("<spstream module=\"%s\" name=\"%s\">", $self->class, $self->name);
  return $str;
}

sub _init_from_xmltree {
  my $self = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  unless($xmlTree->{'-module'} eq "EEDB::SPStream::Proxy") { return undef; }  
  $self->name($xmlTree->{'-name'});
  return $self;
}



1;

