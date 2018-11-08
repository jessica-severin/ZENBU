=head1 NAME - EEDB::SPStream::TopHits

=head1 DESCRIPTION

A simple signal procesor which is configured with a minimum expression value
and which will only pass expressions which are greater than that value

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

package EEDB::SPStream::TopHits;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::TopHits"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_tophit_queue'} = [];
  $self->{'_queue_tail'} = undef;
  $self->{'_queue_length'} = 25;
  return $self;
}

sub queue_length {
  my $self = shift;
  return $self->{'_queue_length'} = shift if(@_);
  return $self->{'_queue_length'};
}

sub get_top_queue {
  my $self = shift;
  return $self->{'_tophit_queue'};
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
  while(my $obj = $self->source_stream->next_in_stream) {
    if(scalar(@{$self->{'_tophit_queue'}}) <  $self->{'_queue_length'}) {
      my @queue = sort {compare_objects($a, $b)} (@{$self->{'_tophit_queue'}}, $obj);
      #printf("  new queue length %d\n", scalar(@queue));
      $self->{'_tophit_queue'} = \@queue;
      $self->{'_queue_tail'} = $self->{'_tophit_queue'}->[scalar(@{$self->{'_tophit_queue'}})-1];
      return 1;
    } else {
      if(compare_objects($self->{'_queue_tail'},$obj) > 0) {
        my @queue = sort {compare_objects($a, $b)} (@{$self->{'_tophit_queue'}}, $obj);
        pop @queue;
        $self->{'_tophit_queue'} = \@queue;
        $self->{'_queue_tail'} = $self->{'_tophit_queue'}->[scalar(@{$self->{'_tophit_queue'}})-1];
        return 1;
      }
    }
  }
  return undef;
}


sub compare_objects {
  my $obj1 = shift;
  my $obj2 = shift;
  
  unless(defined($obj1) and defined($obj2)) { return 0; }
  
  my $value1=0;
  my $value2=0;
  if($obj1->class eq "Expression") { $value1 = $obj1->value; }
  if($obj2->class eq "Expression") { $value2 = $obj2->value; }

  if($obj1->class eq "Feature") { $value1 = $obj1->significance; }
  if($obj2->class eq "Feature") { $value2 = $obj2->significance; }
  
  return $value2 <=> $value1;
}




#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("TopHits");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = "<spstream module=\"TopHits\" >";
  $str .= sprintf("<queue_length value=\"%d\"/>", $self->queue_length);
  return $str;
}


1;

