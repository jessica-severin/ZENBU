=head1 NAME - EEDB::SPStream::SimpleDifferentialExpression

=head1 DESCRIPTION

a simple "differential expression" analysis module.
Uses a simple sum-of-squares metric to scale variance 
of a set of experiments on a feature.

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

package EEDB::SPStream::SimpleDifferentialExpression;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::SimpleDifferentialExpression"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'mode'} = "sumofsquares";
  $self->{'_setA_experiment_hash'} = {};
  $self->{'_setB_experiment_hash'} = {};
  return $self;
}

sub setA_add_experiment {
  my ($self, $experiment) = @_;
  return unless(defined($experiment));
  unless($experiment->isa('EEDB::Experiment')) {
    die('setA_add_experiment param must be a EEDB::Experiment');
  }
  $self->{'_setA_experiment_hash'}->{$experiment->db_id} = $experiment;
  return $self;
}  

sub setB_add_experiment {
  my ($self, $experiment) = @_;
  return unless(defined($experiment));
  unless($experiment->isa('EEDB::Experiment')) {
    die('setB_add_experiment param must be a EEDB::Experiment');
  }
  $self->{'_setB_experiment_hash'}->{$experiment->db_id} = $experiment;
  return $self;
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

  my $feature = $self->source_stream->next_in_stream;
  if(!defined($feature)) { return undef; }

  if($self->{'mode'} eq "sumofsquares") {
    $self->feature_sumofsquares($feature);
  } else {
    $self->process_feature($feature);
  }
  return $feature;
}


sub process_feature {
  my $self = shift;
  my $feature = shift;

  $feature->expression_cache; #does lazy load if not already in memory
  my $exp_array = $feature->get_expression_array;
  my $sum_setA = 0.0;
  my $sum_setB = 0.0;
  foreach my $expr (@$exp_array) {
    my $experiment = $expr->experiment;
    if(defined($self->{'_setA_experiment_hash'}->{$experiment->db_id})) {
      $sum_setA += $expr->value;
    }
    if(defined($self->{'_setB_experiment_hash'}->{$experiment->db_id})) {
      $sum_setB += $expr->value;
    }
  }
  my $diff = abs($sum_setA - $sum_setB);
  $feature->significance($diff);
  return $feature;
}


sub feature_sumofsquares {
  my $self = shift;
  my $feature = shift;

  $feature->expression_cache; #does lazy load if not already in memory
  my $exp_array = $feature->get_expression_array;
  my $ss = 0.0;
  if(scalar(@$exp_array)) {
    my $sum = 0.0;
    foreach my $expr (@$exp_array) { $sum += $expr->value; }
    my $mean = $sum / scalar(@$exp_array);
    foreach my $expr (@$exp_array) { 
      $ss += ($expr->value - $mean) * ($expr->value - $mean);
    }
  }
  $feature->significance($ss);
  return $feature;
}

#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("SimpleDifferentialExpression");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = "<spstream module=\"SimpleDifferentialExpression\" >";
  return $str;
}


1;

