=head1 NAME - EEDB::SPStream::OverlapCluster

=head1 DESCRIPTION

a signal-processing-stream implementaion of the FANTOM3-style window based clustering
Since the algorithm just uses local infomation, one can implement in a very direct way
using storted streams.  This SPStream requires a positionally sorted stream of features
or expression objects. And it will return a stream of Features possibly with expressions
attached to them

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

package EEDB::SPStream::OverlapCluster;

use strict;

use Data::UUID;
use POSIX qw(ceil floor);

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::OverlapCluster"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_strand'} = undef;
  $self->{'_cluster'} = {};
  $self->{'_distance'} = 0; #means no additional window buffering
  $self->{'_overlap_mode'} = "area";
  $self->{'_ignore_strand'} = 0;

  $self->{'_cluster_buffer'}= [];

  my $ug    = new Data::UUID;
  my $uuid  = $ug->create();
  $self->{'_temp_uuid'} = $ug->to_string($uuid);
  $self->{'_temp_feature_idx'} = 1;

  $self->{'fsrc'} = EEDB::FeatureSource->create_from_name("cluster::dynamic_cluster");
  $self->{'fsrc'}->is_active('y');
  $self->{'fsrc'}->is_visible('y');

  return $self;
}

sub distance {
  my $self = shift;
  if(@_) {
    my $dist = floor(shift);
    if($dist < 0) { $dist = 0; }
    $self->{'_distance'} = $dist;
  }
  return $self->{'_distance'};
}

sub overlap_mode {
  my $self = shift;
  return $self->{'_overlap_mode'} = shift if(@_);
  return $self->{'_overlap_mode'};
}

sub ignore_strand {
  my $self = shift;
  return $self->{'_ignore_strand'} = shift if(@_);
  return $self->{'_ignore_strand'};
}

#############################################################
#
# override method for subclasses which will do all the work
#
#############################################################

sub next_in_stream {
  my $self = shift;
  
  if(defined($self->source_stream)) {
    while(my $obj = $self->source_stream->next_in_stream) {
      if(($obj->class ne 'Expression') and ($obj->class ne "Feature")) {
        #other object classes are just passed through this module
        return $obj;
      }

      my $cluster = $self->process_feature($obj);
      if($cluster) { return $cluster; }
    }
  }
  
  # input stream is empty so empty out the buffer
  my $cluster = shift @{$self->{'_cluster_buffer'}};
  if($cluster) {
    $self->calc_cluster_significance($cluster);
    return $cluster; 
  }
    
  return undef;
}

sub _reset_stream {
  my $self = shift;
  $self->{'_cluster_buffer'}= [];
  return undef;
}


#
#################################################
#

sub process_feature {
  my $self = shift;
  my $obj = shift;

  if(!defined($obj)) { return undef; }

  #
  # first see if we are done the cluster on the head of the buffer
  #
  my $finished_cluster = undef;
  my $cluster = $self->{'_cluster_buffer'}->[0];
  if($cluster and ($cluster->chrom_end < $obj->chrom_start - $self->{'_distance'})) { 
    # cluster < unmodified obj start, 
    # no chance of further overlaps so done with this cluster
    $finished_cluster = shift @{$self->{'_cluster_buffer'}};
  }

  #
  # process the overlaps in the buffer
  #
  my @touched_clusters;
  my @other_clusters;
  foreach $cluster (@{$self->{'_cluster_buffer'}}) {
    if(!($self->ignore_strand) and ($cluster->strand ne "") and ($obj->strand ne $cluster->strand)) { 
      push @other_clusters, $cluster;
      next; 
    }

    if($self->overlap_check($cluster, $obj)) { 
      push @touched_clusters, $cluster;
    } else {
      push @other_clusters, $cluster;
    }
  }

  #
  # if no clusters were tocuhed then create new cluster
  # and sort new cluster into buffer
  #
  if(scalar(@touched_clusters) == 0) {
    my $new_cluster  = $self->create_new_cluster($obj);
    push @{$self->{'_cluster_buffer'}}, $new_cluster;
    #printf STDERR "buffer %d size\n", scalar(@{$self->{'_cluster_buffer'}});
    foreach my $c1 (@{$self->{'_cluster_buffer'}}) {
      #printf STDERR "  buffer: %s\n", $c1->display_desc();
    }
    my @sortedarray = sort cluster_sort_func @{$self->{'_cluster_buffer'}};
    #printf STDERR "after sort\n";
    $self->{'_cluster_buffer'} = [@sortedarray];
  } 
  else {
    #
    # >= 1 cluster was touched, first one in array becomes master
    #
    my $cluster1 = shift @touched_clusters;
    #printf STDERR "touched %s\n", $cluster->display_desc;
    $self->extend_cluster($cluster1, $obj);
    $self->cluster_merge_expression($cluster1, $obj);

    #remaining touched clusters now need to be merged into the master
    foreach my $cluster2 (@touched_clusters) {
      if($cluster2->chrom_start < $cluster1->chrom_start) { $cluster1->chrom_start($cluster2->chrom_start); }
      if($cluster2->chrom_end > $cluster->chrom_end) { $cluster1->chrom_end($cluster2->chrom_end); }
      $self->cluster_merge_expression($cluster1, $cluster2);
    }

    # rebuild the sorted _cluster_buffer
    push @other_clusters, $cluster1;
    my @sortedarray = sort cluster_sort_func @other_clusters;
    $self->{'_cluster_buffer'} = \@sortedarray;
  }

  if($finished_cluster) {
    $self->calc_cluster_significance($finished_cluster);
    #printf STDERR "finished %s\n", $finished_cluster->display_desc;
    return $finished_cluster; 
  }

  return undef;
}


sub cluster_sort_func {
  # ORDER BY chrom_start, chrom_end
  if($a->chrom_start < $b->chrom_start) { return -1; }
  if($a->chrom_start > $b->chrom_start) { return 1; }

  if($a->chrom_end < $b->chrom_end) { return -1; }
  if($a->chrom_end > $b->chrom_end) { return 1; }

  return 0; # same, equals
}


sub modified_ends {
  my $self = shift;
  my $obj = shift;

  my $obj_start = $obj->chrom_start;
  my $obj_end   = $obj->chrom_end;
  if($self->overlap_mode eq "5end") {
    if($obj->strand eq "+") { $obj_end   = $obj_start; }
    if($obj->strand eq "-") { $obj_start = $obj_end; }
  }
  if($self->overlap_mode eq "3end") {
    if($obj->strand eq "+") { $obj_start = $obj_end; }
    if($obj->strand eq "-") { $obj_end   = $obj_start; }
  }
  return ($obj_start, $obj_end);
}


sub overlap_check {
  my $self = shift;
  my $cluster = shift;
  my $obj = shift;

  #printf STDERR "overlap_check\n";
  #printf STDERR "  cluster %s\n", $cluster->chrom_location;
  #printf STDERR "  obj %s\n", $obj->chrom_location;

  my ($obj_start, $obj_end) = $self->modified_ends($obj);
  #printf STDERR "  mod_ends %d %d\n", $obj_start, $obj_end;

  if(($obj_start <= $cluster->chrom_end  + $self->{'_distance'}) and
     ($obj_end   >= $cluster->chrom_start - $self->{'_distance'})) { return 1; } 
  
  #printf STDERR "  0\n";
  return 0;  #they do not overlap
}


sub create_new_cluster {
  my $self = shift;
  my $obj = shift; 

  my ($obj_start, $obj_end) = $self->modified_ends($obj);

  my $cluster = new EEDB::Feature;
  $cluster->peer_uuid($self->{'_temp_uuid'});
  $cluster->primary_id(($self->{'_temp_feature_idx'})++);
  $cluster->feature_source($self->{'fsrc'});
  $cluster->chrom($obj->chrom);
  $cluster->chrom_start($obj_start);
  $cluster->chrom_end($obj_end);
  if($self->ignore_strand) {
    $cluster->strand(""); #strandless
  } else { 
    $cluster->strand($obj->strand);
  }
  if($obj->class eq "Expression") {
    $cluster->add_expression_data($obj->experiment, $obj->type, $obj->value);
  }
  if($obj->class eq "Feature") {
    my $exps = $obj->get_expression_array();
    foreach my $express (@{$exps}) {
      $cluster->add_expression_data($express->experiment, $express->type, $express->value);
    }
  }
  #$cluster->metadataset->merge_metadataset($obj->metadataset);
  #printf STDERR "create %s\n", $cluster->display_desc;
  return $cluster;
}


sub extend_cluster {
  my $self  = shift;
  my $cluster  = shift;
  my $obj = shift;

  my ($obj_start, $obj_end) = $self->modified_ends($obj);

  if($obj_start < $cluster->chrom_start) {
    $cluster->chrom_start($obj_start);
  }
  if($obj_end > $cluster->chrom_end) {
    $cluster->chrom_end($obj_end);
  }
}


sub cluster_merge_expression {
  my $self  = shift;
  my $cluster  = shift;
  my $obj = shift;  #can be either object from stream or another cluster

  my @expression;
  if($obj->class eq "Expression") { push @expression, $obj; }
  if($obj->class eq "Feature") {
    @expression = @{$obj->get_expression_array()};
  }
  foreach my $express (@expression) {
    my $experiment = $express->experiment;
    my $expr = $cluster->get_expression($experiment, $express->type);
    if($expr) {
      $expr->value($expr->value + $express->value);
    } else {
      $cluster->add_expression_data($experiment, $express->type, $express->value);
    }
  }
}


sub calc_cluster_significance {
  my $self = shift;
  my $cluster = shift;
  
  my $significance = 0;
  foreach my $express (@{$cluster->get_expression_array}) {
    $significance += $express->value;
    #if($express->value > $significance) { $significance = $express->value; }
  }
  $cluster->significance($significance);
  my $name = "cluster_" . $cluster->chrom_name ."_". $cluster->chrom_start . $cluster->strand;;
  $cluster->primary_name($name);
  return $cluster; 
}


#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("OverlapCluster");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = sprintf("<spstream module=\"%s\">", $self->class);
  $str .= sprintf("<distance value=\"%f\"/>", $self->distance);
  $str .= sprintf("<overlap_mode value=\"%s\"/>", $self->overlap_mode) if(defined($self->overlap_mode));
  if($self->ignore_strand()) { $str .= "<ignore_strand value='1'/>\n"; }
  return $str;
}

sub _init_from_xmltree {
  my $self = shift;
  my $xmlTree = shift;  #a hash tree generated by XML::TreePP
  
  unless($xmlTree->{'-module'} eq "EEDB::SPStream::OverlapCluster") { return undef; }  
  if($xmlTree->{'distance'}) {
    $self->distance($xmlTree->{'distance'}->{'-value'});
  }
  if($xmlTree->{'overlap_mode'}) {
    $self->overlap_mode($xmlTree->{'overlap_mode'}->{'-value'});
  }
  if($xmlTree->{'ignore_strand'}) { 
    $self->ignore_strand($xmlTree->{'ignore_strand'}->{'-value'}); 
  }
  return $self;
}


1;

