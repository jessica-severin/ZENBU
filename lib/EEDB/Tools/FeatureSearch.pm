=head1 NAME - EEDB::FeatureSearch

=head1 SYNOPSIS

=head1 DESCRIPTION

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

package EEDB::FeatureSearch;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::FeatureSet;
our @ISA = qw(EEDB::FeatureSet);

#################################################
# Class methods
#################################################

sub class { return "FeatureSearch"; }

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

sub search_term {
  my $self = shift;
  return $self->{'search_term'} = shift if(@_);
  $self->{'search_term'}='' unless(defined($self->{'search_term'}));
  return $self->{'search_term'};
}

sub like_count {
  my $self = shift;
  return $self->{'like_count'} = shift if(@_);
  $self->{'like_count'}='' unless(defined($self->{'like_count'}));
  return $self->{'like_count'};
}

sub exact_count {
  my $self = shift;
  return $self->{'exact_count'} = shift if(@_);
  $self->{'exact_count'}='' unless(defined($self->{'exact_count'}));
  return $self->{'exact_count'};
}

sub prefilter_count {
  my $self = shift;
  return $self->{'prefilter_count'} = shift if(@_);
  $self->{'prefilter_count'}='' unless(defined($self->{'prefilter_count'}));
  return $self->{'prefilter_count'};
}

sub search_method {
  my $self = shift;
  return $self->{'search_method'} = shift if(@_);
  $self->{'search_method'}='like' unless(defined($self->{'search_method'}));
  return $self->{'search_method'};
}

sub filter_count {
  my $self = shift;
  return $self->SUPER::count;
}


################

sub display_desc {
  my $self = shift;
  my $str = sprintf("FeatureSearch(%s) [%s] %d features (%d exact, %d like, %d prefilter)",
           $self->id, 
           $self->search_term,
           $self->filter_count,
           $self->exact_count, 
           $self->like_count, 
           $self->prefilter_count
           );  
  return $str;
}

################################################################


sub search_features {
  my $class = shift;
  my $db = shift;  
  my $search_name = shift;
  my %args = @_;
  
  return undef unless(defined($db) and defined($search_name));
  
  my $self = $class->new();

  $self->database($db);
  $self->search_term($search_name);

  my $feature_list =[];
  my $prefilter_count = -1;  #undefined
  my $like_count = -1;  #undefined
  my $exact_count = -1;  #undefined
  my $search_method = "exact";
  my $limit = 1000;
  my $ensfilter=1;

  $limit = $args{limit} if(defined($args{limit}));
  $ensfilter = $args{ensfilter} if(defined($args{ensfilter}));
  
  if(!defined($search_name) or (length($search_name)<2)) {
    $prefilter_count = -1;
    $search_method = "error";
  } else {
    $like_count = EEDB::Feature->get_count_symbol_search($db, $search_name ."%");
    $exact_count = EEDB::Feature->get_count_symbol_search($db, $search_name);
    $search_method = "count_like";
    if($like_count<$limit) {
      $feature_list= EEDB::Feature->fetch_all_symbol_search($db, $search_name, undef, 100);
      $prefilter_count = scalar(@$feature_list);
      $search_method = "like";
    } else {
      $search_method = "exact_count";
      $prefilter_count = $exact_count;
      if($exact_count>0 and $exact_count<$limit) {
        $feature_list= EEDB::Feature->fetch_all_by_source_symbol($db, undef, $search_name);
        $prefilter_count = scalar(@$feature_list);
        $search_method = "exact";
      } else {
        $prefilter_count = $like_count;
        $search_method = "count_like";
      }
    }
  }
  my $filter_count=0;
  foreach my $feature (sort {($a->primary_name cmp $b->primary_name)} @$feature_list) {
    next if($ensfilter and ($feature->feature_source->name =~ /Ensembl/));
    next if($feature->feature_source->is_active ne 'y');
    $self->add_feature($feature);
    $filter_count++;
  }
  if($filter_count == 0) {
    foreach my $feature (sort {($a->primary_name cmp $b->primary_name)} @$feature_list) {
      $self->add_feature($feature);
    }
  }
  
  $self->search_method($search_method);
  $self->exact_count($exact_count);
  $self->like_count($like_count);
  $self->prefilter_count($prefilter_count);
  
  return $self;
}


sub xml {
  my $self = shift;

  my $str = "<results>\n";
  $str .= sprintf("<query value=\"%s\" />\n", $self->search_term);

  my $features = $self->features;
  foreach my $feature (sort {($a->primary_name cmp $b->primary_name)} @$features) {
    printf("<match desc=\"%s\"  feature_id=\"%s\" type=\"%s\" />", $feature->primary_name, $feature->id, $feature->feature_source->category);
  }

  $str .= sprintf("<prefilter_count method=\"%s\" exact_count=\"%d\" like_count=\"%d\" total=\"%s\" filtered=\"%s\" />\n", 
                  $self->search_method, 
                  $self->exact_count, 
                  $self->like_count, 
                  $self->prefilter_count, 
                  $self->filter_count);
  $str .= printf("</results>\n");

  return $str;
}

1;

