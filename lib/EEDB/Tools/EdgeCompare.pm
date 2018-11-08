=head1 NAME - EEDB::Tools::EdgeCompare

=head1 SYNOPSIS

=head1 DESCRIPTION

This is a processing class.  Take two FeatureSource with features on chromosomes, streams both of them
and does a merge-sort-like comparison.  Uses a call-out function to allow the user to 'do things' 
with the feature pairs.

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

$VERSION = 0.953;

package EEDB::Tools::EdgeCompare;

use strict;
use EEDB::FeatureSource;
use EEDB::Feature;
use Time::HiRes qw(time gettimeofday tv_interval);

use MQdb::DBObject;
our @ISA = qw(MQdb::DBObject);

#################################################
# Class methods
#################################################

sub class { return "EEDB::Tools::EdgeCompare"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  $self->{'edge_source'} = undef;
  $self->{'compare_mode'} = 'overlap';  #other is 'within'
  $self->{'upstream_distance'} = 0;
  $self->{'downstream_distance'} = 0;

  $self->{'current_chrom_name'}= undef;
  $self->{'current_stream'}= undef;
  $self->{'edge2_buffer'}= [];
  $self->{'stream_edge_end'}= 'f1';
  
  $self->{'debug'} = 0;
  
  return $self;
}


##########################
#
# getter/setter methods of data which is stored in database
#
##########################

sub edge_source {
  my ($self, $source) = @_;
  if($source) {
    unless(defined($source) && $source->isa('EEDB::EdgeSource')) {
      die('edge_source param must be a EEDB::FeatureSource');
    }
    $self->{'edge_source'} = $source;
  }  
  return $self->{'edge_source'};
}

sub edge_join_end {
  my $self = shift;
  return $self->{'stream_edge_end'} = shift if(@_);
  $self->{'stream_edge_end'}='f1' unless(defined($self->{'stream_edge_end'}));
  if(($self->{'stream_edge_end'} ne 'f1') and ($self->{'stream_edge_end'} ne 'f2')) { $self->{'stream_edge_end'}='f1'; }
  return $self->{'stream_edge_end'};
}


sub edge_join_function {  #call back function
  my $self = shift;
  if(@_) { $self->{'edge_join_function'} = shift; }
  return $self->{'edge_join_function'};
}


sub display_desc {
  #override superclass method
  my $self = shift;
  return sprintf("EdgeCompare %s [%s]", 
    $self->edge_source->name,
    $self->overlap_mode);
}


###############################################################

# The input feature is expected to come in as a chrom_start sorted list
# all on the same chromosome, when the input stream changes chrom
# then the processing stream will also change
sub stream_process_edge {
  my $self = shift;
  my $edge1 = shift;
  my $edge1_end = shift;  #f1 or f2
  
  unless($self->edge_source and defined($self->edge_source->database)) {
    die("ERROR:: must set edge_source for EdgeCompare to work\n");
  }
  
  my $edge2_end = $self->edge_join_end;
  
  printf("\nEDGE1: %s %s<>%s\n", $edge1_end, $edge1->feature1_id, $edge1->feature2_id) if($self->{'debug'}>1);

  if(!defined($self->{'current_stream'}) or !scalar(@{$self->{'edge2_buffer'}})) {
    printf("\n===== reset stream\n") if($self->{'debug'});
    $self->{'current_stream'} = EEDB::Edge->stream_all_by_source($self->edge_source, $self->edge_join_end);
    
    #
    # scan up stream2 until we join to $edge1
    #
    my $edge2 = $self->{'current_stream'}->next_in_stream;
    return unless($edge2);
    
    while($edge2 and ($self->edge_join_check($edge2, $edge2_end, $edge1, $edge1_end) == -1)) {
      #E2 is less than E1 so move forward
      printf("  E2: %s %s<>%s :: before, move stream2 forward\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id) if($self->{'debug'}>1);
      $edge2 = $self->{'current_stream'}->next_in_stream;
    }
    return unless($edge2);

    printf("  E2: %s %s<>%s :: init\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id) if($self->{'debug'});
    $self->{'edge2_buffer'}= [$edge2];
  }
  
  my $edge2_buffer = $self->{'edge2_buffer'};
 
  #
  # do work on the head of the buffer
  #
  my $edge2 = $edge2_buffer->[0];
  while($edge2 and ($self->edge_join_check($edge2, $edge2_end, $edge1, $edge1_end) == -1)) {
    #E2 is before E1 so so trim the head
    printf("  E2: %s %s<>%s :: buffer head trim\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id) if($self->{'debug'}>1);
    shift @$edge2_buffer;
    $edge2 = $edge2_buffer->[0];
    if(!$edge2) {
      $edge2 = $self->{'current_stream'}->next_in_stream;    
      push @$edge2_buffer, $edge2 if($edge2);
    }
  }
    

  #
  # need to make sure buffer goes beyond the current $edge1
  #
  $edge2  = undef;
  if(@$edge2_buffer) { $edge2 = $edge2_buffer->[scalar(@$edge2_buffer)-1]; }
  while($edge2 and ($self->edge_join_check($edge2, $edge2_end, $edge1, $edge1_end) != 1)) {
    #keep going
    $edge2 = $self->{'current_stream'}->next_in_stream;
    if($edge2) {
      printf("  E2: %s %s<>%s :: buffer tail extend\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id) if($self->{'debug'}>1);
      push @$edge2_buffer, $edge2;
    }
  }


  if($self->{'debug'}) {
    printf(" EDGE1: %s %s<>%s\n", $edge1_end, $edge1->feature1_id, $edge1->feature2_id);
    foreach my $edge2 (@$edge2_buffer) {
      next unless(defined($edge2));
      printf("      buffer E2: %s %s<>%s\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id);
    }
  }
  
  return unless($edge2_buffer->[0]);

  #
  # now the real loop and call outs
  #

  my $does_overlap =0;
  foreach $edge2 (@$edge2_buffer) {
    next unless(defined($edge2));
    if($self->edge_join_check($edge2, $edge2_end, $edge1, $edge1_end) == 0) {
      #OK real overlap here
      printf(" edge_join_check E2: %s %s<>%s :: OK do call out\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id) if($self->{'debug'});
      $does_overlap=1;
      #call out here
      if($self->edge_join_function) {
        $self->edge_join_function->($edge1, $edge2);
      }
    } else {
      printf(" edge_join_check E2: %s %s<>%s :: nope\n", $edge2_end, $edge2->feature1_id, $edge2->feature2_id) if($self->{'debug'});
    }
  }
  
}



sub edge_join_check {
  my $self = shift;
  my $edge1 = shift;
  my $edge1_end = shift;
  my $edge2 = shift;
  my $edge2_end = shift;

  return -999 unless($edge1 and $edge2); #stop
  
  # -1 means edge1_end < edge2_end
  #  1 means edge1_end > edge2_end
  #  0 means matching ends
  
  my $e1_fid = $edge1->feature1_id;
  if($edge1_end eq 'f2') {$e1_fid = $edge1->feature2_id; }
  
  my $e2_fid = $edge2->feature1_id;
  if($edge2_end eq 'f2') {$e2_fid = $edge2->feature2_id; }

  if($e1_fid > $e2_fid)  { return  1; } 
  elsif($e1_fid < $e2_fid)  { return  -1; }
  elsif($e1_fid == $e2_fid)  { return  0; }
  return -999;  #hmm something is off
}


1;

