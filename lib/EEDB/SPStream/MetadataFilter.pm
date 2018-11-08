=head1 NAME - EEDB::SPStream::MetadataFilter

=head1 DESCRIPTION

A simple signal procesor which is configured with a metadata tag / value pair
and a `has` flag. Tag or value are optional
Only passes features which have/have_not the tag, the value or the tag/value pair

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>
Nicolas Bertin <nbertin@gsc.riken.jp>

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

package EEDB::SPStream::MetadataFilter;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::MetadataFilter"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_tag'} = undef;
  $self->{'_value'} = undef;
  $self->{'_has'} = 1;
  return $self;
}


sub tag {
  my $self = shift;
  return $self->{'_tag'} = shift if(@_);
  return $self->{'_tag'};
}

sub value {
  my $self = shift;
  return $self->{'_value'} = shift if(@_);
  return $self->{'_value'};
}

sub has{
  my $self = shift;
  return $self->{'_has'};
}

sub with_metadata{
  my $self = shift;
  $self->{'_has'} = 1;
}

sub without_metadata {
  my $self = shift;
  $self->{'_has'} = 0;
}

#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################

sub next_in_stream {
  my $self = shift;
  if(!defined($self->source_stream)) { return undef; }
  while(my $feature = $self->source_stream->next_in_stream) {
    if(defined($self->tag) or defined($self->value)){
      if (    (($self->has == 1) and  defined($feature->metadataset->find_metadata($self->tag, $self->value)))
	   or (($self->has == 0) and !defined($feature->metadataset->find_metadata($self->tag, $self->value))) ){
	return $feature;
      }
    }
    else{
      return $feature;
    }
  }
  return undef;
}

#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("MetadataFilter");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = "<spstream module=\"MetadataFilter\" >";
  if(defined($self->tag) or defined($self->value)){
    $str .= "<metadata";
    $str .=  sprintf(" tag=\"%s\"/",  $self->tag) if(defined($self->tag));
    $str .=  sprintf(" value=\"%s\"/",  $self->value) if(defined($self->value));
    $str .=  sprintf(" has=\"%s\"/>", $self->has);
  }
  return $str;
}


1;

