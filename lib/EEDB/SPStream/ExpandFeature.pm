=head1 NAME - EEDB::SPStream::ExpandFeature

=head1 DESCRIPTION

a simple signal-processing-stream tools which modifies the feature stream
to expand the size of features based on strand and upstream/downstream distances.
This is useful as a pre-processing step prior to overlap analysis.

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

package EEDB::SPStream::ExpandFeature;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::ExpandFeature"; }


#################################################
# 
# initialization and configuration methods
#
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);

  $self->{'_database'} = undef;
  $self->{'expand_mode'} = "neighbor";

  $self->{'upstream_distance'} = 0;
  $self->{'downstream_distance'} = 0;

  $self->{'current_feature'} = undef;
  $self->{'next_feature'} = undef;
  $self->{'previous_feature'} = undef;
  
  $self->{'debug'} = 0;
  
  return $self;
}


sub set_simple_expand {
  my $self = shift;
  $self->{'expand_mode'} = "simple";
}

sub upstream_distance {
  my $self = shift;
  return $self->{'upstream_distance'} = shift if(@_);
  if(!defined($self->{'upstream_distance'})) { $self->{'upstream_distance'} = 0; }
  return $self->{'upstream_distance'};
}

sub downstream_distance {
  my $self = shift;
  return $self->{'downstream_distance'} = shift if(@_);
  if(!defined($self->{'downstream_distance'})) { $self->{'downstream_distance'} = 0; }
  return $self->{'downstream_distance'};
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

  if(!defined($self->{"next_feature"})) { #first time so preload (or end and doesn't matter)
    my $obj = $self->source_stream->next_in_stream;
    if($obj and ($obj->class ne "Feature")) { return $obj; }
    $self->{"next_feature"} = $obj;
    $self->{'_input_stream_count'}++ if($self->{"next_feature"});
  } 
  
  my $obj = $self->source_stream->next_in_stream;
  if($obj and ($obj->class ne "Feature")) { return $obj; }
  
  $self->{"previous_feature"} = $self->{"current_feature"};
  $self->{"current_feature"} = $self->{"next_feature"};
  $self->{"next_feature"} = $obj;
  $self->{'_input_stream_count'}++ if($self->{"next_feature"});
  
  if(!defined($self->{"current_feature"})) { return undef; } #done
  
  my $f1_start = $self->{"current_feature"}->chrom_start;
  my $f1_end   = $self->{"current_feature"}->chrom_end;
  my $f2_start = $self->{"next_feature"}->chrom_start if($self->{"next_feature"});
  my $f2_end   = $self->{"next_feature"}->chrom_end if($self->{"next_feature"});
  
  if($self->{'debug'}) {
    printf("\nFeature(%s) %s %s -- ", 
           $self->{"current_feature"}->id, 
           $self->{"current_feature"}->primary_name, 
           $self->{"current_feature"}->chrom_location) ;
    printf("Feature(%s) %s %s", 
           $self->{"next_feature"}->id, 
           $self->{"next_feature"}->primary_name, 
           $self->{"next_feature"}->chrom_location) if($self->{"next_feature"});
    print("\n");
  }
  
  if($self->{'expand_mode'} eq "simple") {
    $self->simple_expand_feature();
  } else {
    $self->neighbor_check_expand();
  }
  printf("  %d..%d => %s\n", $f1_start, $f1_end, $self->{"current_feature"}->chrom_location) if($self->{'debug'});
  printf("  %d..%d => %s\n", $f2_start, $f2_end, $self->{"next_feature"}->chrom_location) if($self->{'debug'} and $self->{"next_feature"});

  return $self->{"current_feature"};
}

#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("ExpandFeature");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = "<spstream module=\"ExpandFeature\" >";
  $str .= sprintf("<upstream_distance value=\"%f\"/>", $self->upstream_distance); 
  $str .= sprintf("<downstream_distance value=\"%f\"/>", $self->downstream_distance); 
  return $str;
}

#################################################
#
# internal methods
#
#################################################

sub simple_expand_feature {
  my $self = shift;
  
  my $feature = $self->{"current_feature"};
  unless($feature) { return; }
  if($feature->chrom_start < 0) { return; } #unmapped
  
  my $mod_start = $feature->chrom_start;
  my $mod_end   = $feature->chrom_end;

  if($feature->strand eq '+') { 
    $mod_start -= $self->upstream_distance;
    $mod_end   += $self->downstream_distance;
  } elsif ($feature->strand eq '-') { 
    $mod_start -= $self->downstream_distance;
    $mod_end   += $self->upstream_distance;
  }
  #if not on strand then does not modify
  
  if($mod_start<1) { $mod_start = 1; }
  
  if($self->{'debug'}) {
    printf("%s %s => %d..%d\n", $feature->simple_display_desc, $feature->chrom_location, $mod_start, $mod_end);
  }
  $feature->chrom_start($mod_start);
  $feature->chrom_end($mod_end);
  return $feature;
}



sub neighbor_check_expand {
  my $self = shift;

  my $prev_feature = $self->{"previous_feature"};
  my $feature = $self->{"current_feature"};
  my $next_feature = $self->{"next_feature"};

  if(!defined($feature)) { return; }

  #features without position (no chrom or with -1..-1) can not be expanded
  if(!defined($feature->chrom)) { return; }
  if($feature->chrom_start < 0) { return; }
  
  #very first feature of chromosome so can easily expand feature->chrom_start
  if(!defined($prev_feature) or ($prev_feature->chrom_name ne $feature->chrom_name)) {
    my $mod_start = $feature->chrom_start;
    if($feature->strand eq '+') { $mod_start -= $self->upstream_distance; } 
    if($feature->strand eq '-') { $mod_start -= $self->downstream_distance; }
    if($mod_start<1) { $mod_start = 1; } #1-based chromosome coordinates
    $feature->chrom_start($mod_start);
    print("  first feature\n") if($self->{'debug'});
  }

  if(!defined($next_feature) or ($feature->chrom_name ne $next_feature->chrom_name)) {
    #no feature2 or changing chromosomes so just expand the end of feature
    my $mod_end = $feature->chrom_end;
    if($feature->strand eq '+') { $mod_end += $self->downstream_distance; } 
    if($feature->strand eq '-') { $mod_end += $self->upstream_distance; }
    #probably should do a check against the length of the chromosome, but not critical
    $feature->chrom_end($mod_end);
    print("  last feature\n") if($self->{'debug'});
    return; #no more checking needed
  } 
  
  # we know have both a feature and next_feature on same chromosome so can do checks
  # rest of work is done in the region between feature and next_feature
  # we modify feature->chrom_end and next_feature->chrom_start now

  if($feature->chrom_end >= $next_feature->chrom_start) {
    #features overlap so can not do any expansion
    print("  f1->end >= f2->start\n") if($self->{'debug'});
    return;
  }

  my $f1_end   = $feature->chrom_end;
  my $f2_start = $next_feature->chrom_start;

  if($feature->strand eq '+') { $f1_end += $self->downstream_distance; }
  if($feature->strand eq '-') { $f1_end += $self->upstream_distance; }
  if($next_feature->strand eq '+') { $f2_start -= $self->upstream_distance; }
  if($next_feature->strand eq '-') { $f2_start -= $self->downstream_distance; }

  if($f1_end < $f2_start) {
    #expansion has no problem, go ahead and do it    
    $feature->chrom_end($f1_end);
    $next_feature->chrom_start($f2_start);
    print("  easy expand f1->end AND f2->start\n") if($self->{'debug'});
    return;
  }
  
  # the expansion needs to be contracted
  # expanded f1_end >= f2_start
  
  my $f1_expand = $f1_end - $feature->chrom_end;
  my $f2_expand = $next_feature->chrom_start - $f2_start;
  my $distance = $next_feature->chrom_start - $feature->chrom_end -1;
  my $contract = $distance/($f1_expand + $f2_expand);
  
  my $newf1_expand = $f1_expand * $contract;
  my $newf2_expand = $f2_expand * $contract;
  
  if($self->{'debug'}) {
    print("  COMPLEX\n");
    printf("     distance between before expansion %d\n", $distance);
    printf("     f1_expand = %d\n", $f1_expand);
    printf("     f2_expand = %d\n", $f2_expand);
    printf("     target_expand = %d\n", $f1_expand + $f2_expand);
    printf("     contract = %f\n", $contract);
    printf("     newf1_expand = %d\n", $newf1_expand);
    printf("     newf2_expand = %d\n", $newf2_expand);
  }
    
  $feature->chrom_end($feature->chrom_end + $newf1_expand);
  $next_feature->chrom_start($feature->chrom_end+1);
  #$next_feature->chrom_start($next_feature->chrom_start - $newf2_expand);
  
  return;
}


1;

