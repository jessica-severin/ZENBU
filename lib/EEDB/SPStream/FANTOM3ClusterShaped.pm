=head1 NAME - EEDB::SPStream::FANTOM3ClusterShaped

=head1 DESCRIPTION

extension of Jessica''s EEDB::SPStream::FANTOM3Cluster that also add the cluster_shape as a metadata

EEDB::SPStream::FANTOM3Cluster DESCRIPTION
a signal-processing-stream implementaion of the FANTOM3-style window based clustering
Since the algorithm just uses local infomation, one can implement in a very direct way
using storted streams.  This SPStream requires a positionally sorted stream of features
or expression objects. And it will return a stream of Features possibly with expressions
attached to them

Extension DESCRIPTION
All the attributes of the original  EEDB::SPStream::FANTOM3Cluster are retained
(in particular associated expression that are the cumulative sum of the expression
of the underlying data).

The default _overlap_mode and _distance values are those of FANTOM3 (`5end` and `20` respectively).

Along with FANTOM3-style window based clustering, the expression profile of the underlying
data is classified in a similiar  FANTOM3-style fashion that is :
   - the cluster is assigned to the SP (SinglePeak) class if:
        * the distance between the 25th and 75th tag density percentile is less than 4bp
   - the cluster is assigned to the PB (BroadWithDominatPeak) class if:
        * it is not SP
        * the ratio between the 1st and 2nd tag peak > 2
   - the cluster is assigned to the MU (Multimodal) class if:
        * it is not PB (and therefore not SP)
        * there is at least one consecutive 5th percentile pair with a distance exceeding 10bp
   - the cluster is assigned to the BR (Broad) class if:
        * it is not assigned to any other classes

The cluster class is stored as a `cluster_shape` metadata to be cross compatible with eeDB_neurocage
and enable the use of SPStream::MetadataFilter.pm

WARNING
No safety check that sensible expression_datatype choice or relevant experiment are made here
and should be dealt with the input stream creation.
All the experiments provided will be used to create a unique profile per cluster


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

package EEDB::SPStream::FANTOM3ClusterShaped;

use strict;

use EEDB::SPStream;
our @ISA = qw(EEDB::SPStream);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::FANTOM3ClusterShaped"; }


#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my @args = @_;
  $self->SUPER::init(@args);
  $self->{'_strand'} = undef;
  $self->{'_cluster'} = {};
  $self->{'_distance'} = 20;
  $self->{'_overlap_mode'} = "5end";

  $self->{'fsrc'} = EEDB::FeatureSource->create_from_name("cluster::dynamic_cluster");
  $self->{'fsrc'}->is_active('y');
  $self->{'fsrc'}->is_visible('y');

  return $self;
}

sub distance {
  my $self = shift;
  return $self->{'_distance'} = shift if(@_);
  return $self->{'_distance'};
}

sub overlap_mode {
  my $self = shift;
  return $self->{'_overlap_mode'} = shift if(@_);
  return $self->{'_overlap_mode'};
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

  while(my $feature = $self->_next_input_stream) {
    if($self->overlap_mode eq "5end") {
      if($feature->strand eq "+") { $feature->chrom_end($feature->chrom_start); }
      if($feature->strand eq "-") { $feature->chrom_start($feature->chrom_end); }
    }

    # I need to check all strands since the output stream
    # needs to maintain the sorted state, only
    # if there is a cluster, and it does not overlap, I need to push it out
    foreach my $strand (keys(%{$self->{'_cluster'}})) {
      if(defined($self->{'_cluster'}->{$strand})) {
        my $bbox = $self->{'_cluster'}->{$strand};
        if($bbox->check_overlap($feature, $self->distance) == 0) {
          $self->{'_cluster'}->{$strand} = undef;
          $self->{'_current_feature'} = $feature;

	  ## compute the class shape and associated the relevant metadata
	  my $class = _profile_to_class(_expression_profile($bbox));
	  $bbox->metadataset->add_tag_data('cluster_shape', $class);

          return $bbox;
        }
      }
    }

    my $bbox = $self->{'_cluster'}->{$feature->strand};
    if(!defined($bbox)) {
      $bbox = $self->_create_bbox($feature);
      $self->{'_cluster'}->{$feature->strand} = $bbox;
      next;
    }

    if($self->_overlap_expand($bbox, $feature) == 0) {

      ## compute the class shape and associated the relevant metadata
      my $class = _profile_to_class(_expression_profile($bbox));
      $bbox->metadataset->add_tag_data('cluster_shape', $class);

      # then new feature is outside the previous cluster
      # first hold onto the old since I need to stream this out
      my $cluster = $bbox;

      # create the next one to build and expand
      $bbox = $self->_create_bbox($feature);
      $self->{'_cluster'}->{$feature->strand} = $bbox;

      #now stream out the cluster
      return $cluster;
    }
  }

  #
  # OK input feature stream is empty, but need to push the
  # remaining clusters out
  #
  foreach my $strand (keys(%{$self->{'_cluster'}})) {
    if(defined($self->{'_cluster'}->{$strand})) {
      my $cluster = $self->{'_cluster'}->{$strand};
      $self->{'_cluster'}->{$strand} = undef;

      ## compute the class shape and associated the relevant metadata
      my $class = _profile_to_class(_expression_profile($cluster));
      $cluster->metadataset->add_tag_data('cluster_shape', $class);
      return $cluster;
    }
  }

  #OK really have run out of data
  return undef;
}


sub _next_input_stream {
  my $self = shift;
  if(defined($self->{'_current_feature'})) {
    my $feature = $self->{'_current_feature'};
    $self->{'_current_feature'} = undef;
    return $feature;
  }
  return $self->source_stream->next_in_stream;
}


sub _create_bbox {
  my $self = shift;
  my $other = shift;

  my $bbox = new EEDB::Feature;
  $bbox->feature_source($self->{'fsrc'});
  $bbox->chrom($other->chrom);
  $bbox->chrom_start($other->chrom_start);
  $bbox->chrom_end($other->chrom_end);
  $bbox->strand($other->strand);
  if($other->class eq "Expression") {
    $bbox->add_expression_data($other->experiment, $other->type, $other->value);
    _append_expression_profile($bbox, $other);
  }
  return $bbox;
}


sub _overlap_expand {
  my $self  = shift;
  my $bbox  = shift;
  my $other = shift;

  if($bbox->check_overlap($other, $self->distance)) {
    if($other->chrom_start < $bbox->chrom_start) {
      $bbox->chrom_start($other->chrom_start);
    }
    if($other->chrom_end > $bbox->chrom_end) {
      $bbox->chrom_end($other->chrom_end);
    }

    if($other->class eq "Expression") {
      my $experiment = $other->experiment;
      my $expr = $bbox->get_expression($experiment, $other->type);
      if($expr) {
        $expr->value($expr->value + $other->value);
      } else {
        $bbox->add_expression_data($experiment, $other->type, $other->value);
      }
      _append_expression_profile($bbox, $other);
    }
    return 1;
  }
  return 0;
}


sub _expression_profile{
  my ($self, $profile) = @_;
  $self->{'_expression_profile'} = $profile if ($profile);
  return $self->{'_expression_profile'};
}


sub _append_expression_profile{
  my $self = shift;
  my $other = shift;
  for (my $i = $other->chrom_start; $i <= $other->chrom_end; $i++){
  #for (my $i = $other->chrom_start - $self->chrom_start; $i <= $other->chrom_end - $self->chrom_start; $i++){
    $self->{'_expression_profile'}{$i} += $other->value;
  }
  return 1;
}

sub _profile_to_class{
  my $profile = shift;
  #my $debug = 0;

  my %profile;
  my $cumsum = 0;
  foreach (keys %$profile){ $cumsum += $profile->{$_};
                            $profile{$_}{exp} = $profile->{$_};
			    $profile{$_}{cumsum} = $cumsum; }
  foreach (keys %profile){ $profile{$_}{cumperc} = $profile{$_}{cumsum} / $cumsum }

  #if ($debug > 2){
  #  print "\t", join("|", $_, sprintf("%.1f",$profile{$_}{exp}),
  #                            sprintf("%.1f",$profile{$_}{cumsum}),
  #                            sprintf("%d",$profile{$_}{cumperc}*100)
  #                  ) foreach (sort {$a<=>$b} keys %profile);
  #  print "\n";
  #}

  ## a TC is assigned to the BR (Broad) class if it is not assigned to any other classes
  my $cluster_class = 'BR';

  ## a TC is assigned to the SP (SinglePeak) class if the distance between the 25th and 75th tag density percentile is less than 4bp
  my $first_quarter_pos = 0;
  my $last_quarter_pos = 0;
  ## scan thru l1 along their position (in the l2) and therefore also cumperc asc
  foreach (sort {$profile{$a}{cumperc} <=> $profile{$b}{cumperc}} keys %profile){
    $first_quarter_pos = $_ if (($first_quarter_pos == 0) and ($profile{$_}{cumperc} >= 0.25));
    $last_quarter_pos = $_  if (($last_quarter_pos == 0)  and ($profile{$_}{cumperc} >= 0.75));
    #print join("\t", 'SP quarter_pos', $_, $first_quarter_pos, $last_quarter_pos), "\n" if ($debug > 2);
  }
  my $first_to_last_quarter_dist = abs($last_quarter_pos - $first_quarter_pos);
  #print "\t", join("\t", 'SP quarter_pos', $first_to_last_quarter_dist), "\n" if ($debug > 2);
  if ($first_to_last_quarter_dist <= 4){
    $cluster_class= 'SP';
  }
  ## if the ratio between the 1st and 2nd tag peak > 2 and the TC is not SP than it is assigned to the PB (BroadWithDominatPeak) class
  else {
    my @sorted_pos = sort {$profile{$b}{exp} <=> $profile{$a}{exp}} keys %profile;
    my $first_to_second_pic_ratio = $profile{$sorted_pos[0]}{exp} / $profile{$sorted_pos[1]}{exp};
    #print join("\t", 'PB pic_ratio', join("|", @sorted_pos), $first_to_second_pic_ratio), "\n" if ($debug > 2);
    if ($first_to_second_pic_ratio > 2 ){
      $cluster_class= 'PB';
    }
    ## if the TC is not SP nor PB and there is at least one consecutive 5th percentile pair with a distance exceeding 10bp
    ## the TC is assigned to the MU (Multimodal) class
    else{
      my $last_pos;
      my $last_fifth_percentile_idx;
      foreach (sort {$profile{$a}{cumperc} <=> $profile{$b}{cumperc}} keys %profile){
	$last_pos = $_ unless($last_pos);
	$last_fifth_percentile_idx = int($profile{$_}{cumperc} *20 ) unless ($last_fifth_percentile_idx);
	my $fifth_percentile_idx = int($profile{$_}{cumperc} *20 );
	#print join("\t", 'MU', $last_pos, $last_fifth_percentile_idx, $_, $profile{$_}{cumperc},$fifth_percentile_idx ), "\n" if ($debug > 2);
	if ($fifth_percentile_idx != $last_fifth_percentile_idx){
	  if (abs($last_pos - $_) > 10){
	    #print join("\t", 'MU' , $last_pos, $_), "\n" if ($debug > 2);
	    $cluster_class = 'MU';
	  }
	  $last_fifth_percentile_idx = $fifth_percentile_idx;
	  $last_pos = $_;
	}
      }
    }
  }
  #print "summary ", join(" ", $cluster_class, scalar keys %profile, join("|", values %$profile)), "\n" if ($debug);
  #print "\n\n" if ($debug > 2);
  return $cluster_class;
}

#
#################################################
#

sub display_desc {
  my $self = shift;
  my $str = sprintf("FANTOM3ClusterShaped");
  return $str;
}

sub xml_start {
  my $self = shift;
  my $str = "<spstream module=\"FANTOM3ClusterShaped\" >";
  return $str;
}

#################################################
#

sub SP_shape_symbol {
  my $self = shift;
  if(!defined($self->{'SP_shape_symbol'})) {
    my $sym = new EEDB::Symbol("cluster_shape", "SP");
    $sym->store($self->database) if($self->{'store'});
    $self->{'SP_shape_symbol'} = $sym;
  }
  return $self->{'SP_shape_symbol'};
}

1;

