=head1 NAME - EEDB::Tools::OSCFileParser

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

package EEDB::Tools::OSCFileParser;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use Compress::Zlib;
use Digest::MD5;
use POSIX;
use POSIX qw(setsid);
use POSIX qw(:errno_h :fcntl_h);

use EEDB::Feature;
use EEDB::Expression;
use EEDB::Edge;
use EEDB::FeatureSource;
use EEDB::Experiment;

use MQdb::DBObject;
our @ISA = qw(MQdb::DBObject);

#################################################
# Class methods
#################################################

sub class { return "EEDB::Tools::OSCFileParser"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my %args = @_;
  $self->SUPER::init(@_);
  
  $self->{'debug'} = 0;
  $self->{'_sparse'} =1;

  $self->{'_default_data_type'} = "raw";

  $self->{'_inputfile'} = undef;
  $self->{'_ext_header'} = undef;
  $self->{'_input_file_ext'} = undef;

  $self->{'_platform'} = "";
  $self->{'_assembly_name'} = "";
  $self->{'_fsrc_name'} = "";
  $self->{'_fsrc_category'} = "";
  $self->{'_exp_prefix'} = "";
  $self->{'_allow_aliases'}  = 1;
  $self->{'_convert_eedbns'}  = 1;
  
  $self->{'_fsrc'} = undef;
  $self->{'_fsrc_cache'} = undef;
  $self->{'_header_cols'} = [];
  $self->{'_header_names'} = {};
  $self->{'_experiment_hash'} = {};
  $self->{'_variable_columns'} = [];
  $self->{'_expression_dataypes'} = {};
  $self->{'_header_data'} = "";
  $self->{'_header_metadataset'} = new EEDB::MetadataSet;
  $self->{'_datatype_metadataset'} = new EEDB::MetadataSet;

  $self->{'_do_mapnormalize'} = 0;
  $self->{'_has_genome-coordinate'} = 0;
  $self->{'_has_expression'} = 0;
  $self->{'_has_bed_blocks'}=0;
  $self->{'_has_subfeatures'}=0;

  $self->{'_one_line_one_expression_count'} = 0;
  $self->{'_default_mapcount'} = undef;
  $self->{'_coordinate_system'}= "0base";
  $self->{'_skip_metadata'} = 0;
  $self->{'_outputmode'}  = "";
  
  $self->{'_filter_datatypes'}   = undef;
  $self->{'_filter_experiments'} = undef;
  
  return $self;
}


=head2 init_from_file

  Description: read the header information from an OSCFile and convert into
               structured data objects
  Arg (1)    : $fullpath (string)  full path to the file to be read
  Returntype : instance of EEDB::Tools::OSCFileParser

=cut

sub init_from_file {
  my $self = shift;
  my $file = shift;
  my %options = @_;  #like sources=>[$fsrc1, $fsrc2,$fsrc3]

  $self->{'_platform'} = $options{'platform'} if(defined($options{'platform'}));
  $self->{'_skip_metadata'} = $options{'skip_metadata'} if(defined($options{'skip_metadata'}));
  $self->{'_assembly_name'} = $options{'genome'} if(defined($options{'genome'}));
  $self->{'_assembly_name'} = $options{'assembly'} if(defined($options{'assembly'}));
  $self->{'_convert_eedbns'} = $options{'eedbns'} if(defined($options{'eedbns'}));
  $self->{'_exp_prefix'} = $options{'experiment_name'} if(defined($options{'experiment_name'}));
  $self->{'_display_name'} = $options{'display_name'} if(defined($options{'display_name'}));
  $self->{'_description'} = $options{'description'} if(defined($options{'description'}));
  $self->{'_external_metadata'} = $options{'metadata'} if(defined($options{'metadata'}));
  $self->{'_score_as_expression'} = $options{'score_as_expression'} if($options{'score_as_expression'});
  $self->{'_one_line_one_expression_count'} = $options{'single_tagmap'} if($options{'single_tagmap'});
  $self->{'_default_mapcount'} = $options{'default_mapcount'} if($options{'default_mapcount'});

  unless($file =~ /^\//) {
    $file = getcwd ."/". $file;
  }
  $self->{'_inputfile'} = $file;

  printf("init_from_file [%s]\n", $file) if($self->{'debug'});

  
  #parse the header from the original input file
  unless($self->_parse_filename($file)) { return undef; }

  my $rtn;
  if($self->{'_input_file_ext'} and ($self->{'_input_file_ext'} eq "bed")) {
    $rtn = $self->_bed_header($file);
    if(!$self->{'_fsrc_category'}) { $self->{'_fsrc_category'} = "bed_region"; }
  } elsif($self->{'_input_file_ext'} and ($self->{'_input_file_ext'} eq "sam")) {
    $rtn = $self->_sam_header($file);
    if(!$self->{'_fsrc_category'}) { $self->{'_fsrc_category'} = "sam_region"; }
  } elsif($self->{'_input_file_ext'} and 
          (($self->{'_input_file_ext'} eq "gff") or ($self->{'_input_file_ext'} eq "gtf"))) {
    $rtn = $self->_gff_header($file);
    if(!$self->{'_fsrc_category'}) { $self->{'_fsrc_category'} = "sam_region"; }
  } elsif($self->{'_ext_header'}) {
    $rtn = $self->_read_header($self->{'_ext_header'});
  } else {
    $rtn = $self->_read_header($file);
  }
  unless($rtn) {
    #printf("error reading file : %s\n", $file);
    return undef;
  }

  $self->_create_featuresource;
  if($self->{'_has_subfeatures'}) { $self->block_source; } 
  if($self->{'_score_as_expression'}) {
    #get/create experiment with identical name to to feature_source
    $self->_register_datatype($self->{'_score_as_expression'});
    $self->_register_datatype('unity');
    my $exp = $self->_get_experiment($self->feature_source->name);
    $self->{'_score_experiment'} = $exp;
  }

  foreach my $colobj (@{$self->{'_header_cols'}}) {
    next unless($colobj->{'created_experiment'});
    my $experiment = $colobj->{'experiment'};
    $experiment->metadataset->merge_metadataset($self->{'_header_metadataset'});
  }

  if($self->{'debug'}) {
    foreach my $colobj (@{$self->{'_header_cols'}}) {
      my $len = 25-length($colobj->{'orig_colname'}); my $name = ""; while($len>0) {$len--; $name .=" ";}
      $name .= sprintf("%s => %s", $colobj->{'orig_colname'}, $colobj->{'colname'}); 
      $len = 55-length($name); while($len>0) {$len--; $name .=" ";}

      printf("   col[%3d] %10s %s", $colobj->{'colnum'}, $colobj->{'namespace'}, $name);
      if($colobj->{'namespace'} eq "expression") {
        printf(" %20s  %s", $colobj->{'datatype'}, $colobj->{'experiment'}->display_desc);
      }
      if($colobj->{'description'}) { printf(" :: %s", $colobj->{'description'}); }
      print("\n");
      if(($colobj->{'namespace'} eq "expression") and 
         ($self->{'_do_mapnormalize'}) and 
         (($colobj->{'datatype'} eq "raw") or ($colobj->{'datatype'} eq "tagcount")) and
         ($colobj->{'colname'} ne "eedb:mapcount")) {
        printf("%22s %s %20s  %s\n", "", $name, "singlemap_tagcnt", $colobj->{'experiment'}->display_desc);
        printf("%22s %s %20s  %s\n", "", $name, "singlemap_tpm", $colobj->{'experiment'}->display_desc);
        printf("%22s %s %20s  %s\n", "", $name, "mapnorm_tagcnt", $colobj->{'experiment'}->display_desc);
        printf("%22s %s %20s  %s\n", "", $name, "mapnorm_tpm", $colobj->{'experiment'}->display_desc);
      }
    }
    if($self->assembly_name) { printf("-- default genome : [%s]\n", $self->assembly_name); }
    if($self->{'_has_genome-coordinate'}) { printf("-- has %s genome-coordinate namespace\n", $self->{'_coordinate_system'}); }
    else { print("-- FAILED genome-coordinate namespace check\n"); }
    if($self->{'_has_subfeatures'}) { print("-- has block subfeature structure\n"); }
    if($self->{'_do_mapnormalize'}) { print("-- can perform simple map normalization\n"); }
    if($self->{'_has_expression'}) { print("-- expression data present\n"); }
    else { print("-- WARNING no expression data present\n"); }

  }  

  return $self;
}


=head2 assembly_name

  Description  : returns genome assembly name parsed from header
  Returntype   : string scalar

=cut

sub assembly_name {
  my $self = shift;
  return $self->{'_assembly_name'};
}

sub feature_source {
  my $self = shift;
  if(@_) {
    my $fsrc = shift;    
    if(defined($fsrc) && $fsrc->isa('EEDB::FeatureSource')) {
      $self->{'_fsrc'} = $fsrc;
      $self->{'_exp_prefix'} = $fsrc->name;
      if(defined($fsrc->database)) { $self->database($fsrc->database); }
    }
  }
  return $self->{'_fsrc'};
}

sub experiments {
  my $self = shift;
  if(@_) {
    #externaling setting the experiments
    foreach my $experiment (@_) {
      next unless(defined($experiment) && $experiment->isa('EEDB::Experiment'));
      #printf("set experiment [%s] : %s\n", $experiment->exp_accession, $experiment->display_desc);
      my $name = $experiment->exp_accession;
      $self->{'_experiment_hash'}->{$name} = $experiment;  
    }
  }
  my @exps = values %{$self->{'_experiment_hash'}};
  return \@exps;
}

sub expression_datatypes {
  my $self = shift;
  my @datatypes = sort(keys(%{$self->{'_expression_datatypes'}}));
  return \@datatypes; 
}

sub coordinate_system {
  my $self = shift;
  return $self->{'_coordinate_system'};
}

sub header_data {
  my $self = shift;
  return $self->{'_header_data'};
}

sub get_column_index_by_name {
  my $self = shift;
  my $name = shift;
  
  my $colobj = $self->{'_header_names'}->{$name};
  return undef unless($colobj);
  return $colobj->{'colnum'};
}

sub get_genomic_column_indexes {
  my $self = shift;
  my $chrom_idx  = $self->{"idx_chrom"};
  my $start_idx  = $self->{"idx_start"};
  my $end_idx    = $self->{"idx_end"};
  my $strand_idx = $self->{"idx_strand"};
  return ($chrom_idx, $start_idx, $end_idx, $strand_idx);
}

sub get_mapcount_index {
  my $self = shift;
  return $self->{'idx_mapcount'};
}

sub column_records {
  my $self = shift;
  #pseudo hash/object with these key-attributes
    #colname : 
    #orig_colname :
    #colnum :
    #namespace => enum(id, metadata, genomic, expression)
    #datatype         **only if expression
    #expname          **only if expression
    #total            **only if expression
    #singlemap_total  **only if expression and mapnormalize
    #mapnorm_total    **only if expression and mapnormalize
    #display_name     **only if expression
    #experiment       **only if expression
  return $self->{'_header_cols'};
}

sub input_file_ext {
  my $self = shift;
  if($self->{'_input_file_ext'}) { return $self->{'_input_file_ext'}; }
  return "";
}




#####################################################################
#
# override of EEDB::SPStream::SourceStream superclass methods
#
#####################################################################

sub display_desc {
  my $self = shift;
  my $str = sprintf("OSCFileParser [%s]\n", $self->{'_inputfile'});
  return $str;
}

sub display_contents {
  my $self = shift;
  my $str = sprintf("OSCFileParser\n");
  if($self->{'_has_genome-coordinate'}) { $str .= "  -- has genome-coordinate namespace\n"; }
  else { $str .= "  -- FAILED genome-coordinate namespace check\n"; }
  if($self->{'_do_mapnormalize'}) { $str .= "  -- can perform simple map normalization\n"; }

  $str .= sprintf("  infile   : %s\n", $self->{'_inputfile'});
  $str .= sprintf("  assembly : %s\n", $self->assembly_name);
  $str .= sprintf("  expID    : %s\n", $self->{'_exp_prefix'});
  $str .= sprintf("  fsrc_name: %s\n", $self->feature_source->name) if($self->feature_source);
  
  foreach my $colobj (@{$self->column_records}) {
    $str .= $self->_display_colobj($colobj);
  }
  return $str;
}


######################################################################
#
# internal methods for working with data from the file and
# converting into objects
#
######################################################################

=head2 convert_dataline_to_feature

  Description  : given the header structure, it will parse a single dataline 
                 from the file into objects (Feature, Metadata, Expression)
  Returntype   : EEDB::Feature object

=cut

sub convert_dataline_to_feature {
  my $self = shift;
  my $line = shift;
  
  #if($self->{'debug'}>2) { printf("convertLINE: %s\n", $line); }
  my $columns  = [split(/\t/, $line)];
  
  my $feature = new EEDB::Feature;
  if(defined($self->{'idx_fsrc_category'})) {
    my $category = $columns->[$self->{'idx_fsrc_category'}];
    $feature->feature_source($self->_get_category_featuresource($category));
  } else {
    $feature->feature_source($self->feature_source);
  }

  #makes sure to create all internal data structures so that lazyload is not triggered later
  $feature->metadataset; 
  $feature->expression_cache;
  $feature->edgeset;
  $feature->{'max_express'} = [];
  $feature->{'sum_express'} = [];

  #id/name setting
  if(defined($self->{'idx_fid'}))   { $feature->primary_id($columns->[$self->{'idx_fid'}]); }
  if(defined($self->{'idx_score'})) { $feature->significance($columns->[$self->{'idx_score'}]); }
  if(defined($self->{'idx_name'}))  { 
    $feature->primary_name($columns->[$self->{'idx_name'}]); 
    $feature->metadataset->add_tag_symbol("eedb:primary_name", $feature->primary_name);
  }
  
  my $chrom_idx  = $self->{"idx_chrom"};
  my $start_idx  = $self->{"idx_start"};
  my $end_idx    = $self->{"idx_end"};
  my $strand_idx = $self->{"idx_strand"};

  my $chrname="";
  if(defined($chrom_idx)) {
    $chrname = $columns->[$chrom_idx];
    if($chrname eq "*") { $chrname =""; }
  }
  if($chrname and defined($start_idx)) {
    #0base formats are 0 reference and eeDB is 1 referenced so I need to +1 to start
    #0base is not-inclusive, but eeDB is inclusive so I do NOT need to +1 to the end
    my $start = $columns->[$start_idx];
    if($self->{'_coordinate_system'} eq "0base") {
      $start += 1;
    }
    $feature->chrom_start($start);

    $feature->chrom_name($chrname);
    #if($self->database and $self->assembly_name) {
    #  my $chrom = EEDB::Chrom->fetch_by_name($self->database, $self->assembly_name, $chrname);
    #  if($chrom) { $feature->chrom($chrom); }
    #  $feature->database($self);
    #}

    if(defined($end_idx)) {
      $feature->chrom_end($columns->[$end_idx]);
    } elsif($self->{'idx_cigar'}) {
      $self->_convert_cigar_to_end_pos($feature, $columns);
    }
    
    if(defined($strand_idx)) {
      $feature->strand($columns->[$strand_idx]);
    } elsif($self->{'idx_sam_flag'}) {
      my $flags = int($columns->[$self->{'idx_sam_flag'}]);
      if(!defined($flags)) { $feature->strand(''); }
      else {
        if($flags & 0x0010) { $feature->strand('-'); }
        else { $feature->strand('+'); }
      }
    }
  }
  if($self->{'_outputmode'} eq 'simple_feature') { return $feature; }

  #convert subfeature if present
  
  if(($self->{'_outputmode'} eq 'subfeature') || ($self->{'_outputmode'} eq 'feature')) {
    if($self->{'_has_bed_blocks'}) {
      $self->_convert_bed_block_extensions($feature, $columns);
    }
    elsif($self->{'idx_cigar'}) {
      $self->_convert_cigar_to_subfeatures($feature, $columns);
    }
  }
  
  if($self->{'_outputmode'} eq 'subfeature') { return $feature; }

  #
  # metadata and expression section
  #
  my $mapcnt_idx = $self->{'idx_mapcount'};

  my $mapcount;
  if($mapcnt_idx) {
    $mapcount = $columns->[$mapcnt_idx];
    my $colobj = $self->{'_header_cols'}->[$mapcnt_idx];
    $self->_filter_check_add_expression($feature, $colobj->{'experiment'}, "mapcount", $mapcount);
  }

  if($self->{'_score_as_expression'} and $self->{'_score_experiment'} and defined($self->{'idx_score'})) {
    my $exp = $self->{'_score_experiment'};
    my $score = $columns->[$self->{'idx_score'}];
    $self->_filter_check_add_expression($feature, $exp, "unity", 1);
    $self->_filter_check_add_expression($feature, $exp, $self->{'_score_as_expression'}, $score);
  }
  
  foreach my $colobj (@{$self->{'_variable_columns'}}) {
    my $value = $columns->[$colobj->{'colnum'}]; 

    if(($self->{'_outputmode'} eq 'feature') && ($colobj->{'namespace'} eq 'metadata')) {
      $feature->metadataset->add_tag_data($colobj->{'colname'}, $value);
    }

    if(($colobj->{'namespace'} eq 'expression') and (!defined($mapcnt_idx) or ($colobj->{'colnum'} != $mapcnt_idx))) {
      if($self->{'_sparse'} and ($value == 0.0)) { next; }
  
      my $experiment      = $colobj->{'experiment'};
      if(defined($self->{'_filter_experiments'}) and !($self->{'_filter_experiments'}->{$experiment->db_id})) { next; }
      my $datatype        = $colobj->{'datatype'};
      
      #if($self->{'debug'}>2) {
      #  printf("\ncolnum   : %d\n", $colobj->{'colnum'});
      #  printf("colname  : %s\n", $colobj->{'colname'});
      #  printf("exp      : %s\n", $experiment);
      #  printf("expid    : %s\n", $experiment->id);
      #  printf("datatype : %s\n", $datatype);
      #  printf("value    : %s\n", $value);
      #}
      
      if($self->_filter_check_datatype($datatype)) {
        $feature->add_expression_data($experiment, $datatype, $value);
      }
      if($self->{'_do_mapnormalize'} and $mapcount and (($datatype eq "raw") or ($datatype eq "tagcount"))) {
        my $total_express   = $colobj->{'total'};
        my $singlemap_total = $colobj->{'singlemap_total'};      

        if($mapcount == 1) {
          if($self->_filter_check_datatype("singlemap_tagcnt")) {
            $feature->add_expression_data($experiment, "singlemap_tagcnt", $value);
          }
          if($singlemap_total and $singlemap_total>0 and $self->_filter_check_datatype("singlemap_tpm")) {
            $feature->add_expression_data($experiment, "singlemap_tpm", $value * 1000000.0 / $singlemap_total);
          }
        }
      
        if($self->_filter_check_datatype("mapnorm_tagcnt")) {
          $feature->add_expression_data($experiment, "mapnorm_tagcnt", $value / $mapcount);
        }
        if($total_express and $total_express>0 and $self->_filter_check_datatype("mapnorm_tpm")) {
          $feature->add_expression_data($experiment, "mapnorm_tpm", $value / $mapcount * 1000000.0 / $total_express);
        }
      }
    }
  }

  return $feature;
}


sub _filter_check_datatype {
  my $self = shift;
  my $datatype = shift;
  if(defined($self->{'_filter_datatypes'}) and !($self->{'_filter_datatypes'}->{$datatype})) { return 0; }
  return 1;
}
 
sub _filter_check_add_expression {
  my $self = shift;
  my $feature = shift;
  my $experiment = shift;
  my $datatype = shift;
  my $value = shift;

  if(defined($self->{'_filter_datatypes'}) and !($self->{'_filter_datatypes'}->{$datatype})) { return undef; }
  if(defined($self->{'_filter_experiments'}) and !($self->{'_filter_experiments'}->{$experiment->db_id})) { return undef; }
  
  $feature->add_expression_data($experiment, $datatype, $value);
  return $feature;
}


sub _convert_bed_block_extensions {
  my $self = shift;
  my $feature = shift;
  my $columns = shift; #array reference to data columns

  $feature->edgeset;
  
  my $blockCount_colobj  = $self->{'_header_names'}->{'eedb:bed_block_count'};
  my $blockSizes_colobj  = $self->{'_header_names'}->{'eedb:bed_block_sizes'};
  my $blockStarts_colobj = $self->{'_header_names'}->{'eedb:bed_block_starts'};
  my $thickStart_colobj  = $self->{'_header_names'}->{'eedb:bed_thickstart'};
  my $thickEnd_colobj    = $self->{'_header_names'}->{'eedb:bed_thickend'};
  
  #unless($blockCount_colobj and $blockSizes_colobj and $blockStarts_colobj) { return; }
  
  my $blockCount  = $columns->[$blockCount_colobj->{'colnum'}];
  my $blockSizes  = $columns->[$blockSizes_colobj->{'colnum'}];
  my $blockStarts = $columns->[$blockStarts_colobj->{'colnum'}];
    
  my $thickStart = $columns->[$thickStart_colobj->{'colnum'}] if($thickStart_colobj);
  my $thickEnd   = $columns->[$thickEnd_colobj->{'colnum'}]   if($thickEnd_colobj);  
  my @block_size_array = split(/,/, $blockSizes);
  my @block_start_array = split(/,/, $blockStarts);
  
  my $name   = $feature->primary_name;
  my $chrom  = $feature->chrom;
  my $start  = $feature->chrom_start;
  my $end    = $feature->chrom_end;
  my $strand = $feature->strand;


  if(defined($thickStart)) {
    #thinkStart is really the end of the 5'UTR region
    #feature->chrom_start is already on internal 1base eedb coordinate system
    #so do a 1base check for a zero-length thickstart
    #thickStart == start means 1base length so must the <
    if(($thickStart <= 0) or ($thickStart < $start)) { $thickStart = undef; }
  }
  if(defined($thickEnd) and ($thickEnd <= 0)) { $thickEnd = undef; }
  if(defined($thickEnd)) {
    if($self->{'_coordinate_system'} eq "0base") { $thickEnd += 1; }
    #now thinkEnd is on the internal 1base eedb coordinate system
    #so do a 1base check for a zero-length thickend
    if($thickEnd > $end) { $thickEnd = undef; }
  }

  my $edgeID    = $feature->primary_id;
  my $subfeatID = $feature->primary_id;

  for(my $i=0;  $i<$blockCount; $i++) {
    my $bstart = $block_start_array[$i];
    my $bsize  = $block_size_array[$i];
    
    my $subfeat = new EEDB::Feature;
    $subfeatID += 0.000001;
    $subfeat->database($self->database);
    $subfeat->primary_id($subfeatID);
    $subfeat->feature_source($self->block_source);
    $subfeat->primary_name($name . "_block". ($i+1));
    $subfeat->chrom($chrom);
    $subfeat->chrom_start($start + $bstart);
    $subfeat->chrom_end($start + $bstart + $bsize - 1);
    $subfeat->strand($strand);
    printf("  %s\n", $subfeat->display_desc) if($self->{'debug'}); 

    my $edge = new EEDB::Edge;
    $edgeID += 0.000001;
    $edge->database($self->database);
    $edge->primary_id($edgeID);
    $edge->edge_source($self->sublink_source);
    $edge->feature1($subfeat); #do not set feature2($feature) because it is a memmory leak
    $feature->edgeset->add_edge($edge);
    printf("          %s\n", $edge->display_desc) if($self->{'debug'}>2);
    
    if(defined($thickStart) and ($thickStart >= $subfeat->chrom_start)) {
      my $uend = $subfeat->chrom_end;
      if($thickStart < $uend) { $uend = $thickStart; }

      my $utr = new EEDB::Feature;
      $subfeatID += 0.000001;
      $utr->database($self->database);
      $utr->primary_id($subfeatID);
      $utr->chrom($chrom);
      $utr->chrom_start($subfeat->chrom_start);
      $utr->chrom_end($uend);
      $utr->strand($strand) if($strand);
      if($strand eq '-') { 
        $utr->feature_source($self->utr3_source); 
        $utr->primary_name($name . "_3utr") if($name);
      } else { 
        $utr->feature_source($self->utr5_source); 
        $utr->primary_name($name . "_5utr") if($name);
      }
      printf("  %s\n", $utr->display_desc) if($self->{'debug'}); 
      
      my $edge = new EEDB::Edge;
      $edgeID += 0.000001;
      $edge->database($self->database);
      $edge->primary_id($edgeID);
      $edge->edge_source($self->sublink_source);
      $edge->feature1($utr); #do not set feature2($feature) because it is a memmory leak
      $feature->edgeset->add_edge($edge);
      printf("          %s\n", $edge->display_desc) if($self->{'debug'}>2);        
    }
    if(defined($thickEnd) and ($thickEnd <= $subfeat->chrom_end)) {
      my $ustart = $subfeat->chrom_start;
      if($thickEnd > $ustart) { $ustart = $thickEnd; }

      my $utr = new EEDB::Feature;
      $subfeatID += 0.000001;
      $utr->database($self->database);
      $utr->primary_id($subfeatID);
      $utr->chrom($chrom);
      $utr->chrom_start($ustart);
      $utr->chrom_end($subfeat->chrom_end);
      $utr->strand($strand) if($strand);
      if($strand eq '-') { 
        $utr->feature_source($self->utr5_source); 
        $utr->primary_name($name . "_5utr") if($name);
      } else { 
        $utr->feature_source($self->utr3_source); 
        $utr->primary_name($name . "_3utr") if($name);
      }
      printf("  %s\n", $utr->display_desc) if($self->{'debug'}); 

      my $edge = new EEDB::Edge;
      $edgeID += 0.000001;
      $edge->database($self->database);
      $edge->primary_id($edgeID);
      $edge->edge_source($self->sublink_source);
      $edge->feature1($utr); #do not set feature2($feature) because it is a memmory leak
      $feature->edgeset->add_edge($edge);
      printf("          %s\n", $edge->display_desc) if($self->{'debug'}>2);        
    }
  }
}


sub _convert_cigar_to_end_pos {
  my $self = shift;
  my $feature = shift;
  my $columns = shift; 
  
  my $cigar = $columns->[$self->{'idx_cigar'}];
  unless($cigar) { return; }

  my $curr_pos = 0;
  while($cigar =~ m/([0-9]+)([MIDNSHP])/g) {
   my $len = $1;
   my $op = $2;
   ## M  Alignment match (can be a sequence match or mismatch)
   if($op eq 'M'){ $curr_pos += $len; }
   ## D  Deletion from the reference
   elsif ($op eq 'D') { $curr_pos += $len; }
   ## N  Skipped region from the reference
   elsif ($op eq 'N'){ $curr_pos += $len; }
  }
  $feature->chrom_end($feature->chrom_start + $curr_pos -1);
}


sub _convert_cigar_to_subfeatures {
  my $self = shift;
  my $feature = shift;
  my $columns = shift; 
  
  my $cigar = $columns->[$self->{'idx_cigar'}];
  unless($cigar) { return; }
    
  if($cigar =~ /H/) {
    #the file contains Hard Clipped sequences and therefore may 
    #contain `Multi-part alignments` that are not parsed well 
    #with this code
    return;
  }
  
  my $curr_pos = 0;
  my $curr_block_size = 0;
  my $bidx = 1;
  
  while($cigar =~ m/([0-9]+)([MIDNSHP])/g) {
    my $len = int($1);
    my $op = $2;

    if($op eq 'M') {
      ## M  Alignment match (can be a sequence match or mismatch)
      $curr_block_size += $len;
    }
    elsif($op eq 'D') {
      ## D  Deletion from the reference
      ## choice of either expanding block size, or creating new block

      $curr_block_size += $len;

      #$self->_create_subfeature($feature, $bidx, $curr_pos, $curr_block_size);
      #$bidx++;
      #$curr_pos += $curr_block_size + $len;
      #$curr_block_size = 0;
    }
    elsif($op eq 'N') {
      ## N  Skipped region from the reference
      $self->_create_subfeature($feature, $bidx, $curr_pos, $curr_block_size);
      $bidx++;
      $curr_pos += $curr_block_size + $len;
      $curr_block_size = 0;
    } 
    #elsif($op eq 'S') {
      ## S  Soft clip on the read (clipped sequence present in <seq>)
    #} elsif($op eq 'H') {
      ## H  Hard clip on the read (clipped sequence NOT present in <seq>)
    #} elsif ($op eq 'I') {
      ## I  Insertion to the reference
    #} elsif ($op eq 'P') {
      ## P  Padding (silent deletion from the padded reference sequence)
    #} else {
      #unrecognized cigar operator
    #}
  }
  if($curr_block_size>0) {
    $self->_create_subfeature($feature, $bidx, $curr_pos, $curr_block_size);
  }
  return;
}


sub _create_subfeature {
  my $self = shift;
  my $feature = shift;
  my $bidx = shift;
  my $bstart = shift;
  my $bsize = shift;
  
  my $name   = $feature->primary_name;
  my $start  = $feature->chrom_start;

  my $edgeID    = -1;
  my $subfeatID = -1;
  if($feature->id) {
    $edgeID    = int($feature->id);
    $subfeatID = int($feature->id);
  }
   
  my $subfeat = new EEDB::Feature;
  $subfeatID .= ".".$bidx;
  $subfeat->database($self->database);
  $subfeat->primary_id($subfeatID);
  $subfeat->feature_source($self->block_source);
  $subfeat->primary_name($name . "_block". $bidx);
  $subfeat->chrom($feature->chrom);
  $subfeat->chrom_start($start + $bstart);
  $subfeat->chrom_end($start + $bstart + $bsize - 1);
  $subfeat->strand($feature->strand);
#  printf("%s : [%s]\n", $subfeat->primary_name, $subfeat->chrom_location) if($self->{'debug'});

  my $edge = new EEDB::Edge;
  $edgeID .= ".".$bidx;
  $edge->database($self->database);
  $edge->primary_id($edgeID);
  $edge->edge_source($self->sublink_source);
  $edge->feature1($subfeat);  #do not set feature2($feature) because it is a memmory leak
  $feature->edgeset->add_edge($edge);
  #printf("          %s\n", $edge->display_desc) if($self->{'debug'}>2);
}


################################################
#
# experiment and source related section
#
################################################

sub calc_md5 {
  my $self = shift;
  my $file = shift;  #input file used to create this modified version with indexing
  
  if(!defined($self->{'_fsrc'})) { return undef; }
  unless(open(FILE, $file)) { return undef; }
  
  print("=== calc_md5\n");
  my $ctx = Digest::MD5->new;
  $ctx->addfile(*FILE);
  my $digest = $ctx->hexdigest;
  my $mdata = EEDB::Metadata->new("md5sum", $digest);
  close(FILE);
  $mdata->display_info if($self->{'debug'});

  $self->{'_fsrc'}->metadataset->add_metadata($mdata);
  return $mdata;
}


sub _read_header {
  my $self = shift;
  my $file = shift;

  printf("=== read_header [%s]\n", $file) if($self->{'debug'});
  
  my $line;
  $self->{'_header_data'} = "";
  my $gz = gzopen($file, "rb") ;
  if(!$gz) { return undef; }
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    $line =~ s/\cM//g;
    if($line eq "") { next; } #skip empty lines
    if($line =~ /^\#/) {
      $line = $self->_parse_OSCheader_metadata_line($line);
      if($line) { $self->{'_header_data'} .= $line . "\n"; }
      next;
    }
    #first line after # comments is the header line defining the column structure
    $line =~ s/\r//g;    
    last;
  }
  #$self->{'_header_metadataset'}->extract_keywords;  ## PROBABLY the best place if I want to do this anymore

  printf("LINE: %s\n", $line) if($self->{'debug'}>1);
  my @columns = split(/\t/, $line);
  $gz->gzclose;

  $self->_parse_column_names(@columns);

  #recreate the header-column line from the colobj structure
  my @colnames;
  foreach my $colobj (@{$self->{'_header_cols'}}) {
    push @colnames, $colobj->{'colname'};
  }
  $self->{'_header_data'} .= join("\t", @colnames); 
  $self->{'_header_data'} .= "\n";
  return 1;
}


sub _bed_header {
  my $self = shift;
  my $file = shift;
  
  printf("=== bed_header [%s]\n", $file) if($self->{'debug'});

  #chr1    134212714       134230065       NM_028778       0       +       134212806       134228958       0       7       335,121,152,66,120,133,2168,    0,8815,11559,11993,13820,14421,15183,

  #1. chrom - The name of the chromosome (e.g. chr3, chrY, chr2_random) or scaffold (e.g. scaffold10671).
  #2. chromStart - The starting position of the feature in the chromosome or scaffold. The first base in a chromosome is numbered 0.
  #3. chromEnd - The ending position of the feature in the chromosome or scaffold. The chromEnd base is not included in the display of the feature. For example, the first 100 bases of a chromosome are defined as chromStart=0, chromEnd=100, and span the bases numbered 0-99. 
  #4. name - Defines the name of the BED line. This label is displayed to the left of the BED line in the Genome Browser window when the track is open to full display mode or directly to the left of the item in pack mode.
  #5. score - A score between 0 and 1000. If the track line useScore attribute is set to 1 for this annotation data set, the score value will determine the level of gray in which this feature is displayed (higher numbers = darker gray).
  #6. strand - Defines the strand - either '+' or '-'.
  #7. thickStart - The starting position at which the feature is drawn thickly (for example, the start codon in gene displays).
  #8. thickEnd - The ending position at which the feature is drawn thickly (for example, the stop codon in gene displays).
  #9. itemRgb - An RGB value of the form R,G,B (e.g. 255,0,0). If the track line itemRgb attribute is set to "On", this RBG value will determine the display color of the data contained in this BED line. NOTE: It is recommended that a simple color scheme (eight colors or less) be used with this attribute to avoid overwhelming the color resources of the Genome Browser and your Internet browser.
  #10. blockCount - The number of blocks (exons) in the BED line.
  #11. blockSizes - A comma-separated list of the block sizes. The number of items in this list should correspond to blockCount.
  #12. blockStarts - A comma-separated list of block starts. All of the blockStart positions should be calculated relative to chromStart. The number of items in this list should correspond to blockCount. 

  $self->{'_header_data'} = "";
  $self->{'_header_data'} .= "##ParameterValue[filetype] = bed\n";
  $self->{'_header_data'} .= sprintf("##ParameterValue[genome] = %s\n", $self->assembly_name);

  if($self->{'_score_as_expression'}) {
    $self->{'_header_data'} .= sprintf("##ParameterValue[score_as_expression] = %s\n", $self->{'_score_as_expression'});
  }

  $self->{'_bed_format'} = "BED12";

  my $column_counts = {};
  my $line;
  my $line_count = 0;
  my $gz = gzopen($file, "rb") ;
  if($gz) { 
    while(($line_count<100) && (my $bytesread = $gz->gzreadline($line))) {
      chomp($line);
      if(!($line =~ /\w/)) { next; }
      $line_count++;
      if($line =~ /^track/) {
        $self->{'_header_data'} .= sprintf("##ParameterValue[bed_header] = %s\n", $line);
      } else {
        my @cols = split(/\s+/, $line);
        my $colcnt = scalar(@cols);
        if($colcnt!=3 && $colcnt!=6 && $colcnt!=12) {
          $self->{'_bed_format'} = "BED_unknown";
          return;
        }
        $column_counts->{$colcnt}++;
      }
    }
    $gz->gzclose;
  }
  if(($column_counts->{3} > $column_counts->{6}) && ($column_counts->{3} > $column_counts->{12})) {
    $self->{'_bed_format'} = "BED3";
  } elsif($column_counts->{6} > $column_counts->{12}) {
    $self->{'_bed_format'} = "BED6";
  } else {
    $self->{'_bed_format'} = "BED12";
  }
  
  my @columns = ("eedb:chrom", "eedb:start.0base", "eedb:end");

  if($self->{'_bed_format'} ne "BED3") {
    push @columns,("eedb:name", "eedb:score", "eedb:strand");
  }
  if($self->{'_bed_format'} eq "BED12") {
    push @columns,("eedb:bed_thickstart",
                   "eedb:bed_thickend",
                   "bed:itemRgb",
                   "eedb:bed_block_count",
                   "eedb:bed_block_sizes",
                   "eedb:bed_block_starts");
  }
                 
  $self->_parse_column_names(@columns);

  #bed format is 0 reference and eeDB is 1 referenced
  #because bed is not-inclusive, but eeDB is inclusive I do not need to +1 to the end
  #$start += 1;
  #$thickStart += 1;    

  #recreate the header-column line from the colobj structure
  my @colnames;
  foreach my $colobj (@{$self->{'_header_cols'}}) {
    push @colnames, $colobj->{'colname'};
  }
  $self->{'_header_data'} .= join("\t", @colnames); 
  $self->{'_header_data'} .= "\n";
  return 1;
}


sub _sam_header {
  my $self = shift;
  my $file = shift;
  
  printf("=== sam_header [%s]\n", $file) if($self->{'debug'});

  $self->{'_header_data'} = "";
  $self->{'_header_data'} .= "##ParameterValue[filetype] = sam\n";
  if($self->assembly_name) {
    $self->{'_header_data'} .= sprintf("##ParameterValue[genome] = %s\n", $self->assembly_name);
  }

  my $line;
  my $gz = gzopen($file, "rb") ;
  if($gz) { 
    while(my $bytesread = $gz->gzreadline($line)) {
      chomp($line);
      unless($line =~ /^@/) { last; }
      $self->{'_header_data'} .= sprintf("##ParameterValue[sam_header_line] = %s\n", $line);
      if($line =~ /^\@SQ/) { 
        ##ParameterValue[sam_header_line] = @SQ	SN:chr1	LN:197195432	AS:mm9	SP:Mus musculus
        if(!($self->{'_assembly_name'})) {
          if($line =~ /\s+AS:(\w*)/) {
            $self->{'_assembly_name'} = lc($1);
            $self->{'_header_data'} .= sprintf("##ParameterValue[genome] = %s\n", $self->assembly_name);
          } 
        }
      }
      if($line =~ /^\@RG/) { 
        ##ParameterValue[sam_header_line] = @RG	LB:CNhs10147	ID:CNhs10147
        if($line =~ /\s+LB:(\w*)/) {
          my $library_id = $1;
          if(!($self->{'_header_metadataset'}->has_metadata_like("osc_libID", $library_id))) {
            $self->{'_header_metadataset'}->add_tag_symbol("osc_libID", $library_id);
          } 
        }
        ##@RG	ID:NCig10007.nosampleid.CACTGA	BC:CACTGA	LB:NCig10007	PU:Illumina (GAIIx; Single-Read; 35base)	DT:2010-10-26 00:00:00	PL:OP-SOLEXA-nanoCAGE-Direct-v1.4
        # parse the barcode, first look for the BC: tag, if not parse out of the ID: tag
        if($line =~ /\s+BC:(\w*)/) {
          my $barcode = $1;
          if(!($self->{'_header_metadataset'}->has_metadata_like("osc:LSA_sample_barcode", $barcode))) {
            $self->{'_header_metadataset'}->add_tag_symbol("osc:LSA_sample_barcode", $barcode);
          } 
        } elsif($line =~ /\s+ID:(\S+)/) {
          my $fullID = $1;
          if(!($self->{'_header_metadataset'}->has_metadata_like("osc:LSA_full_ID", $fullID))) {
            $self->{'_header_metadataset'}->add_tag_symbol("osc:LSA_full_ID", $fullID);
          } 
          my $p1 = rindex $fullID, ".";
          if($p1) {
            $p1++; #move past '.'
            my $barcode = substr $fullID, $p1;
            if(!($self->{'_header_metadataset'}->has_metadata_like("osc:LSA_sample_barcode", $barcode))) {
              $self->{'_header_metadataset'}->add_tag_symbol("osc:LSA_sample_barcode", $barcode);
            } 
          }
        }
      }
    }
    $gz->gzclose;
  }

  my @columns = ("eedb:name",
                 "eedb:sam_flag",
                 "eedb:chrom",
                 "eedb:start.1base",
                 "eedb:score",     # SAM_MAPQ
                 "eedb:sam_cigar",
                 "SAM_MRNM",
                 "SAM_MPOS",
                 "SAM_ISIZE",
                 "eedb:seqread",
                 "SAM_QUAL",
                 "eedb:sam_opt"
                 );

  $self->_parse_column_names(@columns);

  #bed format is 0 reference and eeDB is 1 referenced
  #because bed is not-inclusive, but eeDB is inclusive I do not need to +1 to the end
  #$start += 1;
  #$thickStart += 1;    

  #recreate the header-column line from the colobj structure
  my @colnames;
  foreach my $colobj (@{$self->{'_header_cols'}}) {
    push @colnames, $colobj->{'colname'};
  }
  $self->{'_header_data'} .= join("\t", @colnames); 
  $self->{'_header_data'} .= "\n";
  return 1;
}


sub _gff_header {
  my $self = shift;
  my $file = shift;
  
  printf("=== gff_header [%s]\n", $file) if($self->{'debug'});

  $self->{'_header_data'} = "";
  $self->{'_header_data'} .= "##ParameterValue[filetype] = gff\n";
  $self->{'_header_data'} .= sprintf("##ParameterValue[genome] = %s\n", $self->assembly_name);

  #Fields are: <seqname> <source> <feature> <start> <end> <score> <strand> <frame> [attributes] [comments] 
  my @columns = ("eedb:chrom",
                 "eedb:name",
                 "eedb:fsrc_category",     #EEDB featuresource category is the same as the GFF feature_type
                 "eedb:start.1base",
                 "eedb:end",
                 "eedb:score",
                 "eedb:strand",
                 "GFF_frame",
                 "eedb:gff_attributes"
                 );

  $self->_parse_column_names(@columns);

  #recreate the header-column line from the colobj structure
  my @colnames;
  foreach my $colobj (@{$self->{'_header_cols'}}) {
    push @colnames, $colobj->{'colname'};
  }
  $self->{'_header_data'} .= join("\t", @colnames); 
  $self->{'_header_data'} .= "\n";
  return 1;
}


sub _parse_column_names {
  my $self = shift;
  my @columns = @_; #in order
  
  $self->{'_has_genome-coordinate'} = 0;
  $self->{'_do_mapnormalize'} = 0;
  $self->{'_has_expression'} = 0;
  $self->{'_has_raw_expression'} = 0;

  my $col_count = 0;

  foreach my $colname (@columns) {
    #printf("  ==col[%d]: %s\n", $col_count, $colname);
    
    #_create_colobj_by_name creates object and applies alias corrections
    my $colobj = $self->_create_colobj_by_name($colname);
    
    $colobj->{'colnum'} = $col_count;
    $colname = $colobj->{'colname'};  #may have been converted via aliases

    if($self->{'_skip_metadata'}) {  $colobj->{'namespace'} = ''; }
    else { $colobj->{'namespace'} = 'metadata'; }

    $self->{'_header_cols'}->[$col_count] = $colobj;

    # ID namespace
    if($colname eq "eedb:name")         { $colobj->{"namespace"} = "feature"; $self->{'idx_name'}=$col_count; }
    if($colname eq "id")                { $colobj->{"namespace"} = "feature"; $self->{'idx_name'}=$col_count; }
    if($colname eq "eedb:feature_id")   { $colobj->{"namespace"} = "feature"; $self->{'idx_fid'}=$col_count; }

    if($colname eq "eedb:score")        { $colobj->{"namespace"} = "feature"; $self->{'idx_score'}=$col_count; }
    if($colname eq "eedb:significance") { $colobj->{"namespace"} = "feature"; $self->{'idx_score'}=$col_count; }

    if($colname eq "eedb:fsrc_category"){ $colobj->{"namespace"} = "feature"; $self->{'idx_fsrc_category'}=$col_count; }
    if($colname eq "eedb:fsrc_id")      { $colobj->{"namespace"} = "feature"; $self->{'idx_fsrc_id'}=$col_count; }

    if($colname eq "eedb:sam_flag")     { $colobj->{"namespace"} = "metadata"; $self->{'idx_sam_flag'}=$col_count; }
    if($colname eq "eedb:sam_cigar")    { $colobj->{"namespace"} = "metadata"; $self->{'idx_cigar'}=$col_count; }
    if($colname eq "eedb:sam_opt")      { $colobj->{"namespace"} = "SAM"; $self->{'idx_sam_opt'}=$col_count; }

    if($colname eq "eedb:bed_block_count")  { $colobj->{"namespace"} = "genomic"; }
    if($colname eq "eedb:bed_block_sizes")  { $colobj->{"namespace"} = "genomic"; }
    if($colname eq "eedb:bed_block_starts") { $colobj->{"namespace"} = "genomic"; }
    if($colname eq "eedb:bed_thickstart")   { $colobj->{"namespace"} = "genomic"; }
    if($colname eq "eedb:bed_thickend")     { $colobj->{"namespace"} = "genomic"; }

    #if column is an expression column, prepare the experiments
    $self->_prepare_experiment_colobj($colobj);

    if(($colobj->{'namespace'} ne "genomic") and ($colobj->{'namespace'} ne "")) {
        push @{$self->{'_variable_columns'}}, $colobj;
    }    
    
    $col_count++;
  }

  #now that all columns are known, perform global (all column) post processing
  my $chrom_idx  = $self->get_column_index_by_name("eedb:chrom");
  my $start0_idx = $self->get_column_index_by_name("eedb:start.0base");
  my $start1_idx = $self->get_column_index_by_name("eedb:start.1base");
  my $end_idx    = $self->get_column_index_by_name("eedb:end");
  my $strand_idx = $self->get_column_index_by_name("eedb:strand");
  my $cigar_idx  = $self->{'idx_cigar'};
  my $genome_idx = $self->get_column_index_by_name("eedb:genome");
  unless((defined($genome_idx) or $self->assembly_name)) {
    print("ERROR genomic-coordinate namespace: must specify either ##ParameterValue[genome] or ##ColumnVariable[genome]\n");
  }
  unless(defined($start0_idx) or defined($start1_idx)) {
    print("ERROR genomic-coordinate namespace: must specify either column eedb:start.0base or eedb:start.1base\n");
  }
  unless(defined($chrom_idx)) {
    print("ERROR genomic-coordinate namespace: must specify column eedb:chrom\n");
  }
  unless(defined($end_idx) or defined($cigar_idx)) { 
    print("ERROR genomic-coordinate namespace: must specify column eedb:end or eedb:sam_cigar\n");
  }
  if((defined($genome_idx) or $self->assembly_name) and defined($chrom_idx) and 
     (defined($start0_idx) or defined($start1_idx)) and 
     (defined($end_idx) or defined($cigar_idx))) { 
    $self->{'_has_genome-coordinate'} = 1;
    my $colobjs = $self->{'_header_cols'};
    $colobjs->[$chrom_idx]->{'namespace'} = "genomic";  $self->{'idx_chrom'}=$chrom_idx;

    if(defined($end_idx)) { 
      $colobjs->[$end_idx]->{'namespace'} = "genomic";  $self->{'idx_end'}=$end_idx;
    }
    if(defined($start0_idx)) { 
      $colobjs->[$start0_idx]->{'namespace'} = "genomic";  
      $self->{'idx_start'}=$start0_idx;
      $self->{'_coordinate_system'}= "0base";
    } 
    elsif(defined($start1_idx)) { 
      $colobjs->[$start1_idx]->{'namespace'} = "genomic";  
      $self->{'idx_start'}=$start1_idx;
      $self->{'_coordinate_system'}= "1base";
    }
    
    if(defined($strand_idx)) { $colobjs->[$strand_idx]->{'namespace'} = "genomic";  $self->{'idx_strand'}=$strand_idx; }
    if(defined($genome_idx)) { $colobjs->[$genome_idx]->{'namespace'} = "genomic";  $self->{'idx_genome'}=$genome_idx; }
  }

  if(defined($self->{'idx_mapcount'}) and $self->{'_has_raw_expression'}) {
    print(" -- activate simple mapnormalization\n") if($self->{'debug'});
    $self->_register_datatype('mapcount');
    $self->_register_datatype('singlemap_tagcnt');
    $self->_register_datatype('singlemap_tpm');
    $self->_register_datatype('mapnorm_tagcnt');
    $self->_register_datatype('mapnorm_tpm');
    $self->{'_do_mapnormalize'}=1;
  }

  if($self->get_column_index_by_name("eedb:bed_block_count") and
     $self->get_column_index_by_name("eedb:bed_block_sizes") and
     $self->get_column_index_by_name("eedb:bed_block_starts")) {
    $self->{'_has_bed_blocks'}=1;
    $self->{'_has_subfeatures'}=1;
  }
  if(defined($self->{'idx_cigar'})) {
    $self->{'_has_subfeatures'}=1;
  }
}


sub _parse_filename {
  my $self = shift;
  my $file = shift;  

  return undef unless($file and (-e $file));
  
  printf("=== parse_filename [%s]\n", $file) if($self->{'debug'});

  $self->{'_inputfile'} = $file;

  $self->{'_input_dir'} = "./";
  my $ridx = rindex($file, "/");
  if($ridx) { 
    $self->{'_input_dir'} = substr($file, 0, $ridx);
    $file = substr($file, $ridx+1);
  }
  
  if($file =~ /(.+)\.gz$/) { $file = $1; }
  if(($file =~ /(.+)\.osc/) or ($file =~ /(.+)\.mapping/) or ($file =~ /(.+)\.tsv/)) {
    $file = $1;
  } elsif($file =~ /(.+)\.(\w+)$/) {
    $file = $1;
    $self->{'_input_file_ext'} = $2;
  }

  if(!($self->{'_exp_prefix'})) { $self->{'_exp_prefix'} = $file; }
  $self->{'_fsrc_name'}= $self->{'_exp_prefix'};

  if($self->{'debug'}) {
    printf("input_dir  : %s\n", $self->{'_input_dir'});
    printf("exp_prefix : %s\n", $self->{'_exp_prefix'});
    printf("file type  : %s\n", $self->{'_input_file_ext'}) if($self->{'_input_file_ext'});
  }
  
  #
  # check for external headers
  #
  my $ext_header = $self->{'_input_dir'} ."/". $file . ".oscheader";
  if(-e $ext_header) {
    printf(" -- use external header [%s]\n", $ext_header) if($self->{'debug'});
    $self->{'_ext_header'} = $ext_header;
  }
  $ext_header = $self->{'_inputfile'} .".header";
  if(-e $ext_header) {
    printf(" -- use external header [%s]\n", $ext_header) if($self->{'debug'});
    $self->{'_ext_header'} = $ext_header;
  }
  $ext_header = $self->{'_inputfile'} .".oscheader";
  if(-e $ext_header) {
    printf(" -- use external header [%s]\n", $ext_header) if($self->{'debug'});
    $self->{'_ext_header'} = $ext_header;
  }
  return $self;
}


sub _create_featuresource {
  my $self = shift;
  
  if($self->{'_fsrc_name'} and !defined($self->{'_fsrc'})) {
    if($self->{'_fsrc_name'} =~ /(.+)\:\:(.+)/) {
      $self->{'_fsrc_category'} = $1;
      $self->{'_fsrc_name'}     = $2;
    }
    my $fsrc = new EEDB::FeatureSource;
    $fsrc->name($self->{'_fsrc_name'});
    $fsrc->import_source($self->{'_inputfile'});
    $fsrc->import_date(scalar(gmtime()) . " GMT");
    $fsrc->is_active("y");
    $fsrc->is_visible("y");
    if($self->{'_external_metadata'}) {
      $fsrc->metadataset->merge_metadataset($self->{'_external_metadata'});
    }
    if($self->{'_fsrc_category'}) {
      $fsrc->category($self->{'_fsrc_category'});
      $fsrc->metadataset->add_tag_symbol("eedb:category", $self->{'_fsrc_category'});
    }
   #$fsrc->metadataset->add_tag_symbol("assembly_name", $self->{'_assembly_name'});
    $fsrc->metadataset->merge_metadataset($self->{'_header_metadataset'});
    $fsrc->metadataset->merge_metadataset($self->{'_datatype_metadataset'});
    $fsrc->metadataset->add_tag_data("osc_header", $self->{'_header_data'});
    $fsrc->metadataset->add_tag_symbol("eedb:assembly_name", $self->assembly_name);
    my $namesym = $fsrc->metadataset->add_tag_symbol("eedb:name", $fsrc->name);
    $fsrc->metadataset->merge_metadataset($namesym->extract_keywords);
    if($self->{'_display_name'}) { 
      $fsrc->metadataset->remove_metadata_like("eedb:display_name", undef);
      my $md1 = $fsrc->metadataset->add_tag_data("eedb:display_name", $self->{'_display_name'});
      $fsrc->metadataset->merge_metadataset($md1->extract_keywords);
    }
    if($self->{'_description'}) { 
      my $md1 = $fsrc->metadataset->add_tag_data("description", $self->{'_description'});
      $fsrc->metadataset->merge_metadataset($md1->extract_keywords);
    }

    if(defined($self->database)) { $fsrc->store($self->database); }
    $self->{'_fsrc'} = $fsrc;
  }
  $self->{'_fsrc'}->display_info if($self->{'debug'});
}


sub _get_experiment {
  my $self = shift;
  my $fullname = shift;
  
  my $experiment = $self->{'_experiment_hash'}->{$fullname};
  if(!$experiment) {
    #print("==create");
    $experiment = new EEDB::Experiment;
    $experiment->is_active('y');
    $experiment->exp_accession($fullname);
   #$experiment->series_name($self->{'_exp_prefix'}) if($self->{'_exp_prefix'});
    $experiment->platform($self->{'_platform'});
    $experiment->metadataset->add_tag_symbol("assembly_name", $self->{'_assembly_name'});
   #$experiment->metadataset->add_tag_data("osc_header", $self->{'_header_data'});
    $experiment->metadataset->merge_metadataset($self->{'_header_metadataset'});
    if($self->{'_external_metadata'}) {
      $experiment->metadataset->merge_metadataset($self->{'_external_metadata'});
    }
    if(!($experiment->metadataset->has_metadata_like("eedb:display_name")) and ($self->{'_display_name'})) {
      my $md1 = $experiment->metadataset->add_tag_data("eedb:display_name", $self->{'_display_name'});
      $experiment->metadataset->merge_metadataset($md1->extract_keywords);
    }
    if(!($experiment->metadataset->has_metadata_like("description")) and ($self->{'_description'})) {
      my $md1 = $experiment->metadataset->add_tag_data("description", $self->{'_description'});
      $experiment->metadataset->merge_metadataset($md1->extract_keywords);
    }

    my @keywords = split(/\s\-\_/, $fullname);
    foreach my $keyw (@keywords) {
      $experiment->metadataset->add_tag_symbol('keyword', $keyw);
    }
    $self->{'_experiment_hash'}->{$fullname} = $experiment;
    #$experiment->display_info if($self->{'debug'});

    if(defined($self->database)) { $experiment->store($self->database); }
  }
  $self->{'_has_expression'} = 1;
  return $experiment;
}


sub _get_category_featuresource {
  my $self = shift;
  my $category = shift; #optional
  
  if($self->{'_fsrc_name'} and ($self->{'_fsrc_name'} =~ /(.+)\:\:(.+)/)) {
    $category = $1;
    $self->{'_fsrc_name'} = $2;
  }
  if(!defined($category)) { $category = $self->{'_fsrc_category'}; }
  
  my $cache_id = $category . "::" . $self->{'_fsrc_name'};
  my $fsrc = $self->{'_fsrc_cache'}->{$cache_id};
  
  if(!defined($fsrc)) {
    $fsrc = new EEDB::FeatureSource;
    $fsrc->name($self->{'_fsrc_name'} ."_". $category);
    $fsrc->category($category);
    $fsrc->import_source($self->{'_inputfile'});
    $fsrc->is_active("y");
    $fsrc->is_visible("y");
   #$fsrc->metadataset->add_tag_symbol("assembly_name", $self->{'_assembly_name'});
    $fsrc->metadataset->merge_metadataset($self->{'_header_metadataset'});
    $fsrc->metadataset->merge_metadataset($self->{'_datatype_metadataset'});
   #$fsrc->metadataset->add_tag_data("osc_header", $self->{'_header_data'});
    $fsrc->metadataset->add_tag_symbol("eedb:category", $category);
    my $namesym = $fsrc->metadataset->add_tag_symbol("eedb:name", $fsrc->name);
    $fsrc->metadataset->merge_metadataset($namesym->extract_keywords);
    if($self->database) { $fsrc->store($self->database); }
    $self->{'_fsrc_cache'}->{$cache_id} = $fsrc;
    $fsrc->display_info if($self->{'debug'});
  }
  return $fsrc;
}

sub _register_datatype {
  my $self = shift;
  my $datatype = shift;
  $self->{'_expression_datatypes'}->{$datatype} = 1;
  $self->{'_header_metadataset'}->add_tag_symbol("eedb:expression_datatype", $datatype);
  return $self;
}


sub _create_colobj_by_name {
  my $self = shift;
  my $colname = shift;
  
  my $orig_colname = $colname;

  #rename adjustment for some legacy OSCFile namespaces
  if($self->{'_allow_aliases'}) {
    if($colname eq "subject")      { $colname = "chrom"; }
    if($colname eq "chromosome")   { $colname = "chrom"; }
    if($colname eq "start")        { $colname = "start.0base"; }
    if($colname eq "stop")         { $colname = "end"; }
    if($colname eq "ID")           { $colname = "id"; }
    if($colname eq "map_position") { $colname = "raw.mapcount"; }
    if($colname eq "raw.total")    { $colname = "ignore.total"; }
  }

  #eeDB additional namespace adjustments
  if($self->{'_convert_eedbns'}) {
    if($colname eq "id")           { $colname = "eedb:name"; }
    if($colname eq "name")         { $colname = "eedb:name"; }
    if($colname eq "sequence")     { $colname = "eedb:name"; }
    if($colname eq "score")        { $colname = "eedb:score"; }
    if($colname eq "significance") { $colname = "eedb:significance"; }
    if($colname eq "chrom")        { $colname = "eedb:chrom"; }
    if($colname eq "start.0base")  { $colname = "eedb:start.0base"; }
    if($colname eq "start.1base")  { $colname = "eedb:start.1base"; }
    if($colname eq "end")          { $colname = "eedb:end"; }
    if($colname eq "strand")       { $colname = "eedb:strand"; }
    if($colname eq "genome")       { $colname = "eedb:genome"; }
    if($colname eq "assembly")     { $colname = "eedb:genome"; }
    if($colname eq "raw.mapcount") { $colname = "eedb:mapcount"; }
    if($colname eq "category")     { $colname = "eedb:fsrc_category"; }

    if($colname eq "bed_block_count")  { $colname = "eedb:bed_block_count"; }
    if($colname eq "bed_block_sizes")  { $colname = "eedb:bed_block_sizes"; }
    if($colname eq "bed_block_starts") { $colname = "eedb:bed_block_starts"; }
    if($colname eq "bed_thickstart")   { $colname = "eedb:bed_thickstart"; }
    if($colname eq "bed_thickend")     { $colname = "eedb:bed_thickend"; }
  }
      

  my $colobj = $self->{'_header_names'}->{$colname};
  if($colobj) { return $colobj; }

  $colobj = {'colname'=>$colname, 
             'orig_colname' => $orig_colname,
             'namespace' => 'metadata'};
  $self->{'_header_names'}->{$colname} = $colobj;

  if($colname =~ /^ignore\.(.+)/) {
    $colobj->{"namespace"} = "";
  }
  return $colobj;  
}


sub _prepare_experiment_colobj {
  my $self = shift;
  my $colobj = shift;

  my $colname = $colobj->{'colname'};
  my $colnum  = $colobj->{'colnum'};

  #
  # expression namespace
  #
  my $datatype = $self->{'_default_data_type'};
  my $exp_name = undef;
  if($colname =~ /^norm\.(.+)/) {
    $datatype = 'norm';
    $exp_name = $1;
  }
  elsif($colname =~ /^raw\.(.+)/) {
    $datatype = 'raw';
    $exp_name = $1;
  }
  elsif($colname =~ /exp\.(\w+)\.(.+)/) {
    $datatype = $1;
    $exp_name = $2;
  }
  elsif($colname eq "eedb:mapcount") {
    $datatype = "mapcount";
    $exp_name="mapcount";
  }

  unless($exp_name) { return; }

  $colobj->{'namespace'} = "expression";
  $colobj->{'datatype'} = $datatype;
  $colobj->{'expname'} = $exp_name;
  $colobj->{'total'} = 0;
  $colobj->{'singlemap_total'} = 0;
  $colobj->{'mapnorm_total'} = 0;

  if(($datatype eq "raw") and ($exp_name ne "mapcount")) { $self->{'_has_raw_expression'} =1; }
  if(($datatype eq "tagcount") and ($exp_name ne "mapcount")) { $self->{'_has_raw_expression'} =1; }
  if(($datatype eq "mapcount") and !defined($self->{'idx_mapcount'})) { $self->{'idx_mapcount'}=$colnum; }

  $self->_register_datatype($datatype);

  my $fullname = $exp_name;
  $fullname =~ s/\s/_/g;
  if($self->{'_exp_prefix'} and (index($fullname, $self->{'_exp_prefix'})!=0)) { $fullname = $self->{'_exp_prefix'} .'_'. $fullname; }
  $colobj->{'display_name'} = $fullname;

  my $seriespoint = 0;
  if($self->{'_default_experiment_seriespoint'}) { $seriespoint = $self->{'_default_experiment_seriespoint'}; };


  my $experiment = $self->{'_experiment_hash'}->{$fullname};
  if($experiment) {
    $experiment->metadataset->add_tag_symbol("eedb:expression_datatype", $datatype);
    my $total_mdata = $experiment->metadataset->find_metadata($datatype . "_total", undef);
    if($total_mdata) { $colobj->{'total'} = $total_mdata->data; }
    my $single_mdata = $experiment->metadataset->find_metadata($datatype . "_singlemap_total", undef);
    if($single_mdata) { $colobj->{'singlemap_total'} = $single_mdata->data; }
    my $mapnorm_mdata = $experiment->metadataset->find_metadata($datatype . "_mapnorm_total", undef);
    if($mapnorm_mdata) { $colobj->{'mapnorm_total'} = $mapnorm_mdata->data; }
  } else {
    #print("==create");
    $experiment = $self->_get_experiment($fullname);
    $experiment->series_point($seriespoint);
    $experiment->metadataset->add_tag_symbol("expname", $exp_name);
    $experiment->metadataset->add_tag_symbol("eedb:expression_datatype", $datatype);
    $experiment->metadataset->add_tag_data("oscfile_colnum", $colnum);
    $experiment->metadataset->add_tag_data("col_desc", $colobj->{'description'}) if($colobj->{'description'});
    if($colobj->{'sampleID'}) {
      $experiment->metadataset->add_tag_symbol("osc_sampleID", $colobj->{'sampleID'});
    }
    $colobj->{'created_experiment'} = 1;
  }
  $colobj->{'experiment'} = $experiment;
  $self->{'_has_expression'} = 1;
}


sub _display_colobj {
  my $self = shift;
  my $colobj = shift;
  my $str = sprintf("  colobj[%s] %s\n", $colobj->{'colnum'}, $colobj->{'colname'});
  if($colobj->{'experiment'}) {
    $str .= "     ". $colobj->{'experiment'}->display_desc . "\n";
  }
  foreach my $key (keys(%$colobj)) {
    next if($key eq 'experiment');
    next if($key eq 'colnum');
    next if($key eq 'colname');
    $str .= sprintf("     %s => %s\n", $key, $colobj->{$key});
  }
  return $str;
}


sub _parse_OSCheader_metadata_line {
  my $self = shift;
  my $line = shift;
  
  unless($line =~ /^\#\#(.*)/) { return ""; }
  $line = $1;
  #print("parseheader :: ", $line, "\n");
  
  if($line =~ /ColumnVariable\[(.+)\]\s*\=\s*(.*)/) {
    my $colname = $1;
    my $desc = $2;
    my $colobj = $self->_create_colobj_by_name($colname);
    $colobj->{'description'} = $desc;
    $line = sprintf("##ColumnVariable[%s] = %s", $colobj->{'colname'}, $desc);
    return $line;
  }
  elsif($line =~ /ParameterValue\[(.+)\]\s*\=\s*(.*)/) {
    my $param_type  = $1;
    my $param_value = $2;

    if($self->{'_allow_aliases'}) {
      if($param_type eq "genome_assemblies") { $param_type = "genome_assembly"; }
      if($param_type eq "genome")            { $param_type = "genome_assembly"; }
    }

    if($param_type eq "genome_assembly") { 
      $self->{'_assembly_name'} = $param_value;  
      $self->{'_header_metadataset'}->add_tag_symbol("assembly_name", $self->{'_assembly_name'});
    }
    if($param_type eq "description") {
      if(!($self->{'_description'})) { $self->{'_description'} = $param_value; }
      return undef; #do not add to general metadata or output header
    }
    if($param_type eq "eedb:display_name") {
      if(!($self->{'_display_name'})) { $self->{'_display_name'} = $param_value; }
      return undef; #do not add to general metadata or output header
    }

    #next are un-official names useful for eeDB
    if($param_type eq "platform") { $param_type = "eedb:platform" };
    if($param_type eq "eedb:platform") {
      $self->{'_platform'} = $param_value; 
      $self->{'_header_metadataset'}->add_tag_symbol("eedb:platform",  $param_value);
      $line = sprintf("##ParameterValue[%s] = %s", $param_type, $param_value);
      return $line;
    }
    if($param_type eq "experiment_name") {
      $self->{'_exp_prefix'} = $param_value; 
    }
    if($param_type eq "experiment_prefix") {
      $self->{'_exp_prefix'} = $param_value; 
    }
    if($param_type eq "experiment_seriespoint") {
      $self->{'_default_experiment_seriespoint'} = $param_value; 
    }
    if($param_type eq "score_as_expression") {
      if(!defined($self->{'_score_as_expression'})) {
        $self->{'_score_as_expression'} = $param_value;
      }
      return $line;
    }
    if(($param_type =~ "oneline-onecount") or ($param_type eq "single_sequencetags")) {
      $self->{'_one_line_one_expression_count'} = 1;
      return undef;
    }
    if($param_type =~ "default_mapcount") {
      $self->{'_default_mapcount'} = $param_value;
      return undef;
    }

    $line = sprintf("##ParameterValue[%s] = %s", $param_type, $param_value);
    if($param_value =~ /\s/) {
      my $md = $self->{'_header_metadataset'}->add_tag_data($param_type, $param_value);
      $self->{'_header_metadataset'}->merge_metadataset($md->extract_keywords);
    } else {
      $self->{'_header_metadataset'}->add_tag_symbol($param_type, $param_value);
    }
    return $line;
  } elsif($line =~ /ExperimentMetadata/) {
    if($line =~ /^ExperimentMetadata\[(.+)\]\[(.+)\]\s*\=\s*(.*)/) {
      my $exp_name = $1;
      my $tag = $2;
      my $value = $3;
      my $fullname = $exp_name;
      $fullname =~ s/\s/_/g;
      if($self->{'_exp_prefix'} and (index($fullname, $self->{'_exp_prefix'})!=0)) { $fullname = $self->{'_exp_prefix'} .'_'. $fullname; }
      printf(STDERR "ExperimentMetadata exp=%s  tag=%s  val=%s/\n", $fullname, $tag, $value);
      my $experiment = $self->_get_experiment($fullname);
      if($tag and $value) {
	if($tag eq "eedb:display_name") { $experiment->metadataset->remove_metadata_like("eedb:display_name", undef); }
	if($tag eq "eedb:series_name")  { $experiment->series_name($value); return undef; }
	if($tag eq "eedb:series_point") { $experiment->series_point($value); return undef; }
	if($tag eq "description") { $experiment->metadataset->remove_metadata_like("description", undef); }
        my $md1 = $experiment->metadataset->add_tag_data($tag, $value);
        $experiment->metadataset->merge_metadataset($md1->extract_keywords);
      }
    }
    return undef;  #don't save it back out
  } elsif($line =~ /(.+)\s*\=\s*(.*)/) {
    my $tag = $1;
    my $value = $2;
    $tag =~ s/\s*$//g;
    $self->{'_header_metadataset'}->add_tag_data($tag, $value);
  }
  return "##" . $line;
}


sub calc_expression_totals {  
  my $self = shift;
  
  return unless($self->{'_inputfile'});

  printf("============== calc_expression_totals ==============\n") if($self->{'debug'});
  my $starttime = time();
  my $linecount=0;
  my $line;  

  #first clear the totals
  foreach my $colobj (@{$self->{'_variable_columns'}}) {
    next unless($colobj->{'namespace'} eq 'expression');
    $colobj->{'total'} = 0.0;
    $colobj->{'mapnorm_total'} = 0.0;
    $colobj->{'singlemap_total'} = 0.0;
  }

  my $mapcount_idx  = $self->{'idx_mapcount'};

  my $gz = gzopen($self->{'_inputfile'}, "rb") ;
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    next if($line =~ /^\#/);
    next if($line eq "");
    $linecount++;
    if($linecount == 1) { next; }
    $line =~ s/\r//g;
    
    my @columns = split(/\t/, $line);
    
    my $mapcount = undef;
    if($mapcount_idx) { $mapcount = $columns[$mapcount_idx]; }

    foreach my $colobj (@{$self->{'_variable_columns'}}) {
      next unless($colobj->{'namespace'} eq 'expression');
      my $value = $columns[$colobj->{'colnum'}]; 

      $colobj->{'total'} += $value;

      if(defined($mapcount) and ($mapcount > 0)) {
        $colobj->{'mapnorm_total'} += $value / $mapcount;
        if($mapcount == 1) { $colobj->{'singlemap_total'} += $value; }
      }
    }
    
    if($self->{'debug'} and ($linecount % 50000 == 0)) { 
      my $rate = $linecount / (time() - $starttime);
      printf(" calc_totals %10d (%1.2f x/sec)\n", $linecount, $rate); 
    }
  }
  $gz->gzclose;  
  
  foreach my $colobj (@{$self->{'_variable_columns'}}) {
    next unless($colobj->{'namespace'} eq 'expression');
    my $experiment = $colobj->{'experiment'};
    my $datatype = $colobj->{'datatype'};
    next unless($experiment);
        
    $experiment->metadataset->add_tag_data($datatype . "_total", $colobj->{'total'});
    if($mapcount_idx) {
      $experiment->metadataset->add_tag_data($datatype . "_mapnorm_total", $colobj->{'mapnorm_total'});    
      $experiment->metadataset->add_tag_data($datatype . "_singlemap_total", $colobj->{"singlemap_total"});
    }
  }

  if($self->{'debug'}) {
    $linecount--; #remove the header from the total count;
    my $total_time = time() - $starttime;
    my $rate = $linecount / $total_time;
    printf("TOTAL: %10d :: %1.3f min :: %1.2f x/sec\n", $linecount, $total_time/60.0, $rate);
  }
}     

##############################################################################
# dynamic fetch/creation of sources as needed 
# related to BED style subfeature blocks
#

sub sublink_source {
  my $self = shift;
  if(@_) {
    my $src = shift;    
    if(defined($src) && $src->isa('EEDB::EdgeSource')) { $self->{"subfeature_lsrc"} = $src; }
  }
  if($self->feature_source) {
    my $link_name = $self->feature_source->name . "_subfeature";
    if(!defined($self->{'subfeature_lsrc'}) and defined($self->database)) {
      $self->{'subfeature_lsrc'} = EEDB::EdgeSource->fetch_by_name($self->database, $link_name);
    }
    if(!defined($self->{'subfeature_lsrc'})) {
      $self->{'subfeature_lsrc'} = new EEDB::EdgeSource;
      $self->{'subfeature_lsrc'}->category("subfeature");
      $self->{'subfeature_lsrc'}->name($link_name);
      $self->{"subfeature_lsrc"}->is_active("y"); 
      $self->{"subfeature_lsrc"}->is_visible("y"); 
      $self->{"subfeature_lsrc"}->metadataset->add_tag_symbol("eedb:category", "subfeature");
      $self->{"subfeature_lsrc"}->metadataset->add_tag_symbol("eedb:name", $link_name);
      $self->{"subfeature_lsrc"}->metadataset->add_tag_data("name", $link_name);
      $self->{"subfeature_lsrc"}->metadataset->add_tag_symbol("eedb:assembly_name", $self->assembly_name);
      if($self->{'_external_metadata'}) {
        $self->{"subfeature_lsrc"}->metadataset->merge_metadataset($self->{'_external_metadata'});
      }
      if(defined($self->database)) { $self->{"subfeature_lsrc"}->store($self->database); }
      if($self->{'debug'}) {
        printf("Needed to create:: ");
        $self->{'subfeature_lsrc'}->display_info;
      }
    }
  }
  return $self->{'subfeature_lsrc'};
}


sub block_source {
  my $self = shift;
  if(@_) {
    my $src = shift;    
    if(defined($src) && $src->isa('EEDB::FeatureSource')) { $self->{"block_fsrc"} = $src; }
  }
  if($self->feature_source) {
    my $block_name = $self->feature_source->name . "_block";
    if(!defined($self->{"block_fsrc"}) and defined($self->database)) {
      $self->{"block_fsrc"} = EEDB::FeatureSource->fetch_by_category_name($self->database, "block", $self->feature_source->name."_block");
    }
    if(!defined($self->{"block_fsrc"}) and defined($self->database)) {
      $self->{"block_fsrc"} = EEDB::FeatureSource->fetch_by_category_name($self->database, "exon", $self->feature_source->name."_exon");
    }
    if(!defined($self->{"block_fsrc"})) {
      $self->{"block_fsrc"} = new EEDB::FeatureSource;
      $self->{"block_fsrc"}->category("block");
      $self->{"block_fsrc"}->name($block_name);
      $self->{"block_fsrc"}->import_source($self->{'_inputfile'}); 
      $self->{"block_fsrc"}->is_active("y"); 
      $self->{"block_fsrc"}->is_visible("y"); 
      $self->{"block_fsrc"}->metadataset->add_tag_symbol("eedb:category", "block");
      $self->{"block_fsrc"}->metadataset->add_tag_symbol("eedb:name", $block_name);
      $self->{"block_fsrc"}->metadataset->add_tag_data("name", $block_name);
      $self->{"block_fsrc"}->metadataset->add_tag_symbol("eedb:assembly_name", $self->assembly_name);
      if($self->{'_external_metadata'}) {
        $self->{"block_fsrc"}->metadataset->merge_metadataset($self->{'_external_metadata'});
      }
      if(defined($self->database)) { $self->{"block_fsrc"}->store($self->database); }
      if($self->{'debug'}) {
        printf("Needed to create:: ");
        $self->{"block_fsrc"}->display_info;
      }
    }
  }
  return $self->{"block_fsrc"};
}


sub utr3_source {
  my $self = shift;
  if(@_) {
    my $src = shift;    
    if(defined($src) && $src->isa('EEDB::FeatureSource')) { $self->{"utr3_fsrc"} = $src; }
  }
  if($self->feature_source) {
    my $utr3_name = $self->feature_source->name . "_3utr";
    if(!defined($self->{"utr3_fsrc"}) and defined($self->database)) {
      $self->{"utr3_fsrc"} = EEDB::FeatureSource->fetch_by_category_name($self->database, "3utr", $utr3_name);
    }
    if(!defined($self->{"utr3_fsrc"})) {
      $self->{"utr3_fsrc"} = new EEDB::FeatureSource;
      $self->{"utr3_fsrc"}->category("3utr");
      $self->{"utr3_fsrc"}->name($utr3_name);
      $self->{"utr3_fsrc"}->import_source($self->{'_inputfile'}); 
      $self->{"utr3_fsrc"}->is_active("y"); 
      $self->{"utr3_fsrc"}->is_visible("y"); 
      $self->{"utr3_fsrc"}->metadataset->add_tag_symbol("eedb:category", "3utr");
      $self->{"utr3_fsrc"}->metadataset->add_tag_symbol("eedb:name", $utr3_name);
      $self->{"utr3_fsrc"}->metadataset->add_tag_data("name", $utr3_name);
      $self->{"utr3_fsrc"}->metadataset->add_tag_symbol("eedb:assembly_name", $self->assembly_name);
      if($self->{'_external_metadata'}) {
        $self->{"utr3_fsrc"}->metadataset->merge_metadataset($self->{'_external_metadata'});
      }
      if(defined($self->database)) { $self->{"utr3_fsrc"}->store($self->database); }
      if($self->{'debug'}) {
        printf("Needed to create:: ");
        $self->{"utr3_fsrc"}->display_info;
      }
    }
  }
  return $self->{"utr3_fsrc"};
}


sub utr5_source {
  my $self = shift;
  if(@_) {
    my $src = shift;    
    if(defined($src) && $src->isa('EEDB::FeatureSource')) { $self->{"utr5_fsrc"} = $src; }
  }
  if($self->feature_source) {
    my $utr5_name = $self->feature_source->name . "_5utr";
    if(!defined($self->{"utr5_fsrc"}) and defined($self->database)) {
      $self->{"utr5_fsrc"} = EEDB::FeatureSource->fetch_by_category_name($self->database, "5utr", $utr5_name);
    }
    if(!defined($self->{"utr5_fsrc"}) and defined($self->database)) {
      $self->{"utr5_fsrc"} = new EEDB::FeatureSource;
      $self->{"utr5_fsrc"}->category("5utr");
      $self->{"utr5_fsrc"}->name($utr5_name);
      $self->{"utr5_fsrc"}->import_source($self->{'_inputfile'}); 
      $self->{"utr5_fsrc"}->is_active("y"); 
      $self->{"utr5_fsrc"}->is_visible("y"); 
      $self->{"utr5_fsrc"}->metadataset->add_tag_symbol("eedb:category", "5utr");
      $self->{"utr5_fsrc"}->metadataset->add_tag_symbol("eedb:name", $utr5_name);
      $self->{"utr5_fsrc"}->metadataset->add_tag_data("name", $utr5_name);
      $self->{"utr5_fsrc"}->metadataset->add_tag_symbol("eedb:assembly_name", $self->assembly_name);
      if($self->{'_external_metadata'}) {
        $self->{"utr5_fsrc"}->metadataset->merge_metadataset($self->{'_external_metadata'});
      }
      if(defined($self->database)) { $self->{"utr5_fsrc"}->store($self->database); }
      if($self->{'debug'}) {
        printf("Needed to create:: ");
        $self->{"utr5_fsrc"}->display_info;
      }
    }
  }
  return $self->{"utr5_fsrc"};
}


1;
