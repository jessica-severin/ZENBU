# $Id: StreamBuffer.pm,v 1.3 2009/11/09 08:50:04 severin Exp $
=head1 NAME - EEDB::SPStream::StreamBuffer

=head1 DESCRIPTION

a simple SPStream which has an internal buffer. allows for external filling of buffer
or to fill from the source_stream();

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

package EEDB::SPStream::StreamBuffer;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::StreamBuffer"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_object_buffer'} = [];
  $self->{'_buffer_size'}=undef;
  return $self;
}


sub add_objects {
  my $self = shift;
  my @objs = @_;
  push @{$self->{'_object_buffer'}}, @objs;
}

#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################

sub next_in_stream {
  my $self = shift;

  if(scalar(@{$self->{'_object_buffer'}}) == 0) {
    if(defined($self->source_stream) and $self->{'_buffer_size'}) { 
      for(my $i=0; $i<$self->{'_buffer_size'}; $i++) {
        my $obj = $self->source_stream->next_in_stream;
        if(!defined($obj)) { $self->add_objects($obj); }
      }
    }
  }  
  my $obj = shift @{$self->{'_object_buffer'}};
  return $obj;
}


#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("StreamBuffer");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = "<spstream module=\"StreamBuffer\" >";
  return $str;
}


1;

