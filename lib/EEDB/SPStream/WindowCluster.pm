=head1 NAME - EEDB::SPStream::WindowCluster

=head1 DESCRIPTION

simple SPStream module which implements the gridded window cluster
that is the same algorithm used by the expression wiggle web services

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

package EEDB::SPStream::WindowCluster;

use strict;

use Data::UUID;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::WindowCluster"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_strand'} = undef;

  $self->{'_span'} = 1; 
  $self->{'_window_offset'} = 0; 

  $self->{'_use_feature_score'} = 0; 
  $self->{'spatial_binning'} = '5end';
  
  $self->{'_window_buffer'} = []; 
  $self->{'_experiments'} = {};

  my $ug    = new Data::UUID;
  my $uuid  = $ug->create();
  $self->{'_temp_uuid'} = $ug->to_string($uuid);
  $self->{'_temp_feature_idx'} = 1;

  $self->{'_fsrc'} = EEDB::FeatureSource->create_from_name("cluster::window_cluster");
  $self->{'_fsrc'}->peer_uuid($self->{'_temp_uuid'});
  $self->{'_fsrc'}->is_active('y');
  $self->{'_fsrc'}->is_visible('y');

  return $self;
}

sub window_span {
  my $self = shift;
  if(@_) {
    my $span = floor(shift);
    if($span>1000000) { $span=1000000; }
    if($span<1)       { $span=1; }
    $self->{'_span'} = $span;
  }
  return $self->{'_span'};
}

sub window_offset {
  my $self = shift;
  if(@_) { $self->{'_window_offset'} = floor(shift); }
  my $offset = $self->{'_window_offset'} % $self->{'_span'};
  return $offset
}




#################################################
#
# override method for subclasses which will
# do all the work
#
#################################################


sub next_in_stream {
  my $self = shift;
  
  my $window = $self->{'_window_buffer'}->[0];
  while(!defined($window) && (scalar(@{$self->{'_window_buffer'}})>0)) {
    shift @{$self->{'_window_buffer'}};
    $window = $self->{'_window_buffer'}->[0];
  }  
  if(defined($window) && ($window->{'finished'})) {
    shift @{$self->{'_window_buffer'}};
    return $self->convert_window2feature($window);
  }
  
  if(defined($self->source_stream)) {
    while(my $obj = $self->source_stream->next_in_stream) {
      if(($obj->class ne 'Expression') and ($obj->class ne "Feature")) {
        #other object classes are just passed through this module
        return $obj;
      }

      my $window = $self->process_feature($obj);
      if($window) { 
        return $self->convert_window2feature($window);
      }
    }
  }
  
  # input stream is empty so empty out the buffer
  my $window = $self->{'_window_buffer'}->[0];
  while(!defined($window) && (scalar(@{$self->{'_window_buffer'}})>0)) {
    shift @{$self->{'_window_buffer'}};
    $window = $self->{'_window_buffer'}->[0];
  }  
  if(defined($window)) {
    shift @{$self->{'_window_buffer'}};
    return $self->convert_window2feature($window);
  }
    
  return undef;
}


sub _reset_stream {
  my $self = shift;
  $self->{'_window_buffer'}= [];
  $self->{'_obj_count'} = 0;
  $self->{'_experiments'} = {};
  return undef;
}


#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("WindowCluster");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = $self->SUPER::xml_start."\n";
  $str .= sprintf("<window_span value=\"%s\"/>", $self->window_span);
  $str .= sprintf("<window_offset value=\"%s\"/>", $self->window_offset);
  return $str;
}

sub _init_from_xmltree {
  my $self = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  unless($xmlTree->{'-module'} eq "EEDB::SPStream::WindowCluster") { return undef; }  
  if($xmlTree->{'window_span'}) {
    $self->window_span($xmlTree->{'window_span'}->{'-value'});
  }
  if($xmlTree->{'window_offset'}) {
    $self->window_offset($xmlTree->{'window_offset'}->{'-value'});
  }
  return $self;
}

#############################################################################


sub process_feature {
  my $self = shift;
  my $obj = shift;  #either Feature or Expression

  if($obj->class eq 'Expression') {
    $self->collate_expression($obj);
  }
  if($obj->class eq "Feature") {
    if($self->{'_use_feature_score'}) {
      $self->collate_expression($obj);
    } else {
      $obj->expression_cache; #does lazy load if not already in memory
      my $exp_array = $obj->get_expression_array;
      foreach my $expr (@$exp_array) { $self->collate_expression($obj); }
    }
  }

  my $len = scalar(@{$self->{'_window_buffer'}});
  for(my $i=0; $i<$len; $i++) {
    my $win = $self->{'_window_buffer'}->[$i];
    if(defined($win)) {
      if($win->{'end'} < $obj->chrom_start) { $win->{'finished'} = 1; }
    }
  }
  if($self->{'_window_buffer'}->[0]->{'finished'}) {
    my $win = shift @{$self->{'_window_buffer'}};
    return $win;
  }
  return undef;
}


sub collate_expression {
  my $self = shift;
  my $obj = shift;

  if(!defined($obj)) { return; }
  $self->{'_obj_count'}++;
  
  my $span    = $self->window_span;
  my $offset  = $self->window_offset;
  my $windows = $self->{'_window_buffer'};

  my $feature = undef;
  my $tval = 0.0;
  my $expID = undef;
  
  if($obj->class eq 'Feature') { 
    $feature = $obj;
    $tval = $feature->score;
    if(!defined($tval) || ($tval==0)) { $tval=1; }
  } else { #Expression
    $feature = $obj->feature;
    if(!defined($obj->experiment)) { return; }
    if($obj->experiment->is_active ne "y") { return; }
    $expID = $obj->experiment->db_id;      
    unless($self->{'_experiments'}->{$expID}) { 
      $self->{'_experiments'}->{$expID} = $obj->experiment; 
    }
  }
  
  if(!defined($feature)) { return; }
  if($feature->feature_source->is_active ne 'y') { return; }
  #if($feature->feature_source->is_visible ne 'y') { return; }
  if($tval == 0.0) { return; }

  my $express_val = $tval;

  my $win_start = floor(($feature->chrom_start - $offset) / $span);
  my $win_end   = floor(($feature->chrom_end - $offset) / $span);
  #my $win_start = floor($feature->chrom_start / $span);
  #my $win_end   = floor($feature->chrom_end / $span);
  my $numbins = $win_end - $win_start+1;
  if($self->{'spatial_binning'} eq "5end") {
    $numbins=1;
    if($feature->strand eq "-") { $win_start = $win_end; } #just use the end
    else { $win_end = $win_start; } #just use the start 
  }
  if($self->{'spatial_binning'} eq "3end") {
    $numbins=1;
    if($feature->strand eq "-") { $win_end = $win_start; } #just use the start
    else { $win_start = $win_end; } #just use the end 
  }
  if($self->{'spatial_binning'} eq "area") { $tval = $tval / $numbins; } 
  my $strand = $feature->strand;

  #printf("%d - %d :: %s\n", $win_start, $win_end, $feature->chrom_location);
  #if($self->{'format'} eq 'debug') {  print($express->xml); }

  if($strand eq "") { $strand = "+"; }
  
  if(!defined($windows->[0])) {
    my $window = {};
    $window->{'start'} = ($win_start * $span) + $offset;
    $window->{'end'} = $window->{'start'} + $span - 1;
    $window->{'chrom'} = $feature->chrom;
    $window->{'all'} = 0;
    $window->{'count'} = 0;
    $window->{'+'} = 0;
    $window->{'+count'} = 0;
    $window->{'-'} = 0;
    $window->{'-count'} = 0;
    $window->{'exps'} = {};
    $windows->[0] = $window;
  }
  my $start = $windows->[0]->{'start'};

  for(my $x = $win_start; $x<=$win_end; $x++) {
    my $win_idx = $x - $start;
    my $window = $windows->[$win_idx];
    if(!defined($window)) {
      $window = {};
      $window->{'start'} = ($x * $span) + $offset;
      $window->{'end'} = $window->{'start'} + $span - 1;
      $window->{'chrom'} = $feature->chrom;
      $window->{'all'} = 0;
      $window->{'count'} = 0;
      $window->{'+'} = 0;
      $window->{'+count'} = 0;
      $window->{'-'} = 0;
      $window->{'-count'} = 0;
      $window->{'exps'} = {};
      $windows->[$win_idx] = $window;
    }

    $window->{'all'} += $tval;
    $window->{$strand} += $tval; 
    $window->{'count'}++; 
    $window->{$strand."count"}++; 

    unless(defined($window->{'exps'}->{$expID})) { 
      $window->{'exps'}->{$expID} = {'all'=>0, '+'=>0, '-'=>0}; 
    }
    my $winExp = $window->{'exps'}->{$expID}; 
    $winExp->{'all'} += $tval;
    $winExp->{$strand} += $tval;
    
    if($express_val > 0.0) {
      $winExp->{'count'}++; 
      $winExp->{$strand."count"}++; 

      if($self->{'binning'} eq "min") {
        if(!defined($window->{'min'}) or 
           ($window->{'min'} > $express_val)) { $window->{'min'} = $express_val; } 
        if(!defined($window->{$strand.'min'}) or 
           ($window->{$strand.'min'} > $express_val)) { $window->{$strand.'min'} = $express_val; } 

        if(!defined($winExp->{'min'}) or 
           ($winExp->{'min'} > $express_val)) { $winExp->{'min'} = $express_val; } 
        if(!defined($winExp->{$strand.'min'}) or 
           ($winExp->{$strand.'min'} > $express_val)) { $winExp->{$strand.'min'} = $express_val; } 
      }
      if($self->{'binning'} eq "max") {
        if(!defined($window->{'max'}) or 
           ($window->{'max'} < $express_val)) { $window->{'max'} = $express_val; } 
        if(!defined($window->{$strand.'max'}) or 
           ($window->{$strand.'max'} < $express_val)) { $window->{$strand.'max'} = $express_val; } 

        if(!defined($winExp->{'max'}) or 
           ($winExp->{'max'} < $express_val)) { $winExp->{'max'} = $express_val; } 
        if(!defined($winExp->{$strand.'max'}) or 
           ($winExp->{$strand.'max'} < $express_val)) { $winExp->{$strand.'max'} = $express_val; } 
      }
    }
  }
}


sub convert_window2feature {
  my $self = shift;
  my $window = shift;
  
  my $bbox = new EEDB::Feature;
  $bbox->peer_uuid($self->{'_temp_uuid'});
  $bbox->primary_id(($self->{'_temp_feature_idx'})++);
  $bbox->feature_source($self->{'_fsrc'});
  $bbox->chrom($window->{'chrom'});
  $bbox->chrom_start($window->{'start'});
  $bbox->chrom_end($window->{'end'});
  $bbox->strand("");

  printf("<expressbin bin=\"%d\" start=\"%d\" ", $win, $start + floor(($win*$span) + 0.5));
  if($self->{'binning'} eq "max") {
    printf("total=\"%1.11f\" ", $window->{'max'});
    printf("sense=\"%1.11f\" ", $window->{'+max'});
    printf("antisense=\"%1.11f\" >\n", $window->{'-max'});
  } elsif($self->{'binning'} eq "min") {
    printf("total=\"%1.11f\" ", $window->{'min'});
    printf("sense=\"%1.11f\" ", $window->{'+min'});
    printf("antisense=\"%1.11f\" >\n", $window->{'-min'});
  } elsif($self->{'binning'} eq "count") {
    printf("total=\"%1.11f\" ", $window->{'count'});
    printf("sense=\"%1.11f\" ", $window->{'+count'});
    printf("antisense=\"%1.11f\" >\n", $window->{'-count'});
  } elsif($self->{'binning'} eq "mean") {
    printf("total=\"%1.11f\" ", ($window->{'all'} / $window->{'count'}));
    if($window->{'+count'} > 0) {
      printf("sense=\"%1.11f\" ", ($window->{'+'} / $window->{'+count'}));
    } else { printf("sense=\"0.0\" "); }
    if($window->{'-count'}>0) {
      printf("antisense=\"%1.11f\" >\n", ($window->{'-'} / $window->{'-count'}));
    } else { printf("antisense=\"0.0\" >\n"); }
  } else {
    printf("total=\"%1.11f\" ", $window->{'all'});
    printf("sense=\"%1.11f\" ", $window->{'+'});
    printf("antisense=\"%1.11f\" >\n", $window->{'-'});
  }

  foreach my $expID (sort {$a cmp $b} keys(%{$window})) {
    #printf("<exp id=\"%s\" />\n", $expID);
    my $exp = $self->{'_experiments'}->{$expID};
    next unless($exp);
    next unless($window->{$expID});
    print("<exp_express ");
    printf("exp_id=\"%s\" ", $exp->db_id) if($exp->db_id);
    printf("datatype=\"%s\" ", $self->{'exptype'});
    
    if($self->{'binning'} eq "max") {
      printf("total=\"%1.11g\" ", $window->{$expID}->{'max'});
      printf("sense=\"%1.11g\" ", $window->{$expID}->{'+max'});
      printf("antisense=\"%1.11g\" ", $window->{$expID}->{'-max'});
    } elsif($self->{'binning'} eq "min") {
      printf("total=\"%1.11g\" ", $window->{$expID}->{'min'});
      printf("sense=\"%1.11g\" ", $window->{$expID}->{'+min'});
      printf("antisense=\"%1.11g\" ", $window->{$expID}->{'-min'});
    } elsif($self->{'binning'} eq "count") {
      printf("total=\"%1.11f\" ", $window->{$expID}->{'count'});
      printf("sense=\"%1.11g\" ", $window->{$expID}->{'+count'});
      printf("antisense=\"%1.11g\" ", $window->{$expID}->{'-count'});
    } elsif($self->{'binning'} eq "mean") {
      printf("total=\"%1.11f\" ", $window->{$expID}->{'all'});
      printf("sense=\"%1.11g\" ", $window->{$expID}->{'+'});
      printf("antisense=\"%1.11g\" ", $window->{$expID}->{'-'});
      printf("total_count=\"%d\" ", $window->{$expID}->{'count'});
      printf("sense_count=\"%d\" ", $window->{$expID}->{'+count'});
      printf("antisense_count=\"%d\" ", $window->{$expID}->{'-count'});

      #if($window->{$expID}->{'+count'} > 0) {
      #  printf("sense=\"%1.11g\" ", ($window->{$expID}->{'+'} / $window->{$expID}->{'+count'}));
      #} else { printf("sense=\"0.0\" "); }
      #if($window->{$expID}->{'-count'}>0) {
      #  printf("antisense=\"%1.11g\" ", ($window->{$expID}->{'-'} / $window->{$expID}->{'-count'}));
      #} else { printf("antisense=\"0.0\" "); }
    } else {
      printf("total=\"%1.11f\" ", $window->{$expID}->{'all'});
      printf("sense=\"%1.11g\" ", $window->{$expID}->{'+'});
      printf("antisense=\"%1.11g\" ", $window->{$expID}->{'-'});
     # printf("sense_count=\"%d\" ", $window->{$expID}->{'+count'});
     # printf("antisense_count=\"%d\" ", $window->{$expID}->{'-count'});
     # printf("sense_min=\"%1.11g\" ", $window->{$expID}->{'+min'});
     # printf("sense_max=\"%1.11g\" ", $window->{$expID}->{'+max'});
     # printf("antisense_min=\"%1.11g\" ", $window->{$expID}->{'-min'});
     # printf("antisense_max=\"%1.11g\" ", $window->{$expID}->{'-max'});
    }
    print("/>\n");
  }
}


1;

