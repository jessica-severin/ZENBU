=head1 NAME - EEDB::Tools::OSCTableGenerator

=head1 DESCRIPTION

OSCTableGenerator takes information from a stream and then features 
to generate OSCtable formated output

=head1 AUTHOR

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

package EEDB::Tools::OSCTableGenerator;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::Feature;
use EEDB::Edge;

use MQdb::DBObject;
our @ISA = qw(MQdb::DBObject);

#################################################
# Class methods
#################################################

sub class { return "OSCTableGenerator"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my %args = @_;
  $self->SUPER::init(@_);
  
  $self->{'_export_metadata'} = 0;
  $self->{'_export_subfeatures'} = 0;
  $self->{'_source_stream'} = undef;
  $self->{'_expression_datatype_array'} = [];
  $self->{'_experiments'} = [];
  $self->{'_assembly_name'} = "";
  
  return $self;
}

=head2 source_stream

  Description: set the input or source stream feeding objects into this level of the stream stack.
  Returntype : either an MQdb::DBStream or subclass of EEDB::SPStream object or undef if not set
  Exceptions : none 

=cut

sub source_stream {
  my $self = shift;
  if(@_) {
    my $stream = shift;
    if(defined($stream)) {
      #unless($stream->isa('EEDB::SPStream') or $stream->isa('MQdb::DBStream')) {
      #  warn("ERROR:: source_stream() param must be a EEDB::SPStream or MQdb::DBStream");
      #  return undef;
      #}
      if($stream eq $self) {
        warn("ERROR: can not set source_stream() to itself");
        return undef;
      }
    }
    $self->{'_source_stream'} = $stream;
  }
  return $self->{'_source_stream'};
}


sub add_expression_datatype {
  my ($self, $datatype) = @_;
  return unless(defined($datatype));
  push @{$self->{'_expression_datatype_array'}}, $datatype;
  return $self;
}


sub export_subfeatures {
  my $self = shift;

  return $self->{'_export_subfeatures'} = shift if(@_);
  return $self->{'_export_subfeatures'};  
}

sub assembly_name {
  my $self = shift;

  return $self->{'_assembly_name'} = shift if(@_);
  return $self->{'_assembly_name'};  
}


#######################################
#
# oscheader section
#
#######################################


sub generate_oscheader {
  my $self = shift;

  my $stream = $self->{'_source_stream'};
  my @datatypes = @{$self->{'_expression_datatype_array'}};
  
  $self->{'_experiments'} = {};
  $stream->stream_data_sources('class' => "Experiment");
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "Experiment");
    unless(defined($self->{'_experiments'}->{$source->db_id})) {
      $self->{'_experiments'}->{$source->db_id} = $source;
    }
  }

  my @exps = sort({$a->display_name cmp $b->display_name} values(%{$self->{'_experiments'}}));

  #
  # make some sort of OSCtable header now
  #
  my $header = "";
  $header .= "##ParameterValue[filetype] = osc\n";
  $header .= sprintf("##ParameterValue[genome] = %s\n", $self->{'_assembly_name'});

  $header .= "##ColumnVariable[eedb:chrom] = chromosome name\n";
  $header .= "##ColumnVariable[eedb:start.0base] = chromosome start in 0base coordinate system\n";
  $header .= "##ColumnVariable[eedb:end] = chromosome end\n";
  $header .= "##ColumnVariable[eedb:strand] = chromosome strand\n";
  $header .= "##ColumnVariable[eedb:score] = score or significance of the feature\n";
  if($self->{'_export_metadata'}) {
    $header .= "##ColumnVariable[EntrezGene] = EntrezGene\n";
    $header .= "##ColumnVariable[EntrezID] = tEntrezID\n";
    $header .= "##ColumnVariable[Entrez_synonyms] = Entrez_synonyms\n";
  }
  ##ColumnVariable[id] = identifier of the cluster
  foreach my $experiment (@exps) {
    foreach my $type (@datatypes) {
      my $id = "exp." . $type . "." . $experiment->display_name;
      $header .= sprintf("##ColumnVariable[%s] = %s %s\n",
             $id, $type,
             $experiment->exp_accession);
	     #$experiment->metadataset->gff_description);

      $header .= sprintf("##ExperimentMetadata[%s][eedb:display_name] = %s\n", 
             $experiment->display_name, $experiment->display_name);
      my $mdata_list = $experiment->metadataset->metadata_list;
      foreach my $mdata (@$mdata_list) {
        if($mdata->type eq "keyword") { next; }
	$header .= sprintf("##ExperimentMetadata[%s][%s] = %s\n",
	     $experiment->display_name,
	     $mdata->type,
	     $mdata->data);
      }
    }
  }

  #now the column header line like BED12
  $header .= "eedb:chrom\teedb:start.0base\teedb:end\teedb:name\teedb:score\teedb:strand";

  if($self->{'_export_subfeatures'}) {
    $header .= "\teedb:bed_thickstart\teedb:bed_thickend\tbed:itemRgb\teedb:bed_block_count\teedb:bed_block_sizes\teedb:bed_block_starts";
  }
  
  if($self->{'_export_metadata'}) {
    $header .= "\tEntrezGene\tEntrezID\tEntrez_synonyms";
    $header .= "\tdescription";
  }
  foreach my $experiment (@exps) {
    foreach my $type (@datatypes) {
      my $id = "exp." . $type . "." . $experiment->display_name;
      $header .= "\t".$id;
    }
  }
  $header .= "\n";

  return $header;
}


#######################################
#
# generate osctable version of feature line
#
#######################################

sub osctable_feature_output {
  my $self = shift;
  my $feature = shift;

  my $stream = $self->{'_source_stream'};
  my @datatypes = @{$self->{'_expression_datatype_array'}};
  my @exps = sort({$a->display_name cmp $b->display_name} values(%{$self->{'_experiments'}}));

  #my $str = sprintf("%s", $feature->primary_name); 
  #$str .= sprintf("\t%s\t%d\t%d\t%s", $feature->chrom_name, $feature->chrom_start, $feature->chrom_end, $feature->strand);

  my $str ="";
  if($self->{'_export_subfeatures'}) {
    $str = $feature->bed_description("BED12");
  } else {
    $str = $feature->bed_description("BED6");
  }

  if($self->{'_export_metadata'}) {
    $str .= osctable_feature_metadata($self, $feature);
  }

  foreach my $experiment (@exps) {
    foreach my $type (@datatypes) {
      my $express = $feature->get_expression($experiment, $type);
      if($express and defined($express->value)) {
        $str .= sprintf("\t%f", $express->value);
      } else {
        $str .= "\t0.0";
      }
    }
  }
  $str .= "\n";
    
  return $str;
}


#######################################
#
# Metadata and Symbols
#
#######################################


sub osctable_feature_metadata {
  my $self = shift;
  my $feature = shift;

  my $str = "";

  my $entrezGene =""; 
  my $md1 = $feature->metadataset->find_metadata("EntrezGene");
  if($md1) { $entrezGene = $md1->data; }
  $str .= sprintf("\t%s", $entrezGene);
 
  my $entrezID = "";
  my $md2 = $feature->metadataset->find_metadata("EntrezID");
  if($md2) { $entrezID = $md2->data; };
  $str .= sprintf("\t%s", $entrezID);

  my $md3 = $feature->metadataset->find_all_metadata_like("Entrez_synonym");
  my $syns="";
  foreach my $mdata (@$md3) {
    if($syns) { $syns .= ","; }
    $syns .= $mdata->data;
  }
  $str .= sprintf("\t%s", $syns);

  my $desc = "";
  my $md4 = $feature->metadataset->find_metadata("description", undef);
  if($md4) { $desc = $md4->data; }
  $str .= sprintf("\t%s", $desc);

  return $str;
}



1;

