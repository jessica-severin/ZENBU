=head1 NAME - EEDB::Tools::GraphEdges

=head1 SYNOPSIS

=head1 DESCRIPTION

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

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

=head1 APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

=cut


$VERSION = 0.953;

package EEDB::Tools::GraphEdges;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use GraphViz;

use EEDB::Feature;
use EEDB::Edge;

use MQdb::DBObject;
our @ISA = qw(MQdb::DBObject);

#################################################
# Class methods
#################################################

sub class { return "GraphEdges"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my %args = @_;
  $self->SUPER::init(@_);
  
  return $self;
}


##################

sub edge_set {
  my ($self, $set) = @_;
  if($set) {
    unless(defined($set) && $set->isa('EEDB::EdgeSet')) {
      die('edge_set param must be a EEDB::EdgeSet');
    }
    $self->{'edge_set'} = $set;
  }
  return $self->{'edge_set'};
}


###############################################

# GraphViz section
#

sub graph_it {
  my $self = shift;
  
  my $edges = $self->edges;
  my $features = $self->feature_set->features;

  my $graph = GraphViz->new();

  #
  # Nodes first
  #
  foreach my $feature (@$features) {
    $graph->add_node($feature->primary_name);
  }

  #compress edges
  my $edge_hash = {};
  foreach my $edge (@{$edges}) {
    my $key = $edge->feature1_id ."_". $edge->feature2_id;
    my $lid = $edge->edge_source->id;
    next if($lid == 38); #Entrez_TFmatrix_L2anti_Entrez
    next if($lid == 20); #miRNA_pre2mature

    if(($lid==4) || ($lid==11) || ($lid==47) || ($lid==36)) { 
      push @{$edge_hash->{$key}}, $edge;
    } else {
      $self->graphviz_add_edge($graph, $edge);
    }
  }

  foreach my $edges (values(%$edge_hash)) {
    my $edge = $edges->[0];
    $self->graphviz_add_edge($graph, $edge);
  }

  #print header(-type => "application/xhtml+xml", -charset=> "UTF8");
  #print $graph->as_svg;
  return $graph
}


sub graphviz_add_edge {
  my $self = shift;
  my $graph = shift;
  my $edge = shift;
  
  my $style = 'solid';
  my $color = 'black';
  my $dir = 'forward';

  if($edge->edge_source->classification eq 'Experimental') { $color = 'gray'; }

  if($edge->edge_source->classification eq 'Published') { $color = 'gold'; $style="dashed"; }
  if($edge->edge_source->name eq 'ChIP_chip') { $color = 'green'; }
  if($edge->edge_source->name eq 'PPI') { $color = 'purple'; $dir="none"; }
  if($edge->edge_source->name eq 'siRNA_perturbation') { $color = 'red';  $style="solid";}
  if($edge->edge_source->name eq 'pre-miRNA_perturbation') { $color = 'red';  $style="dashed";}

  $graph->add_edge($edge->left_feature->primary_name => $edge->right_feature->primary_name,
                color => $color,
                dir => $dir,
                style => $style);
}

1;

