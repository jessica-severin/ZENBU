=head1 NAME - EEDB::Tools::LSArchiveImport

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

package EEDB::Tools::LSArchiveImport;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use XML::TreePP;
use LWP::UserAgent;

use EEDB::Database;
use EEDB::Experiment;
use EEDB::FeatureSource;
use EEDB::Feature;

use MQdb::DBObject;
our @ISA = qw(MQdb::DBObject);

#################################################
# Class methods
#################################################

sub class { return "LSArchiveImport"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my %args = @_;
  $self->SUPER::init(@_);
  $self->{'starttime'} = time()*1000;
  $self->{'depth'} = 3;  
  $self->{'debug'} = 0;  
  return $self;
}

##################################################################
#
# new XML webservice based mathods
#
##################################################################

sub sync_metadata_for_experiment {
  my $self = shift;
  my $experiment = shift;
  
  unless($experiment) { return undef; }
  my $mds = $experiment->metadataset;

  #$experiment->display_info;
  
  my $library_id = undef;
  my $libID_md = $mds->find_metadata('osc:LSA_library_id');
  unless($libID_md) { $libID_md = $mds->find_metadata('osc:LSArchive_library_osc_lib_id'); }
  if($libID_md) { 
    $library_id = $libID_md->data;
  } else {
    $libID_md = $mds->find_metadata('osc_libID');
    if($libID_md) {
      $library_id = $libID_md->data;
      if($library_id =~ /(.+)_revision/) { $library_id = $1; }
    }
  }
  unless($library_id) {
    if($self->{'debug'}>1) { printf("warning: experiment does not have OSC libraryID\n"); }
    return undef;
  }
  unless($mds->find_metadata('osc:LSA_library_id')) {
    $mds->add_tag_symbol("osc:LSA_library_id", $library_id);
  }
  
  ##first clean up old metadata
  $mds->remove_metadata_like('osc_header');
  $mds->remove_metadata_like('keyword');

  #remove any OSCtable header related metadata
  $mds->remove_metadata_like("FileFormat");
  $mds->remove_metadata_like("chrom", "chromosome");
  $mds->remove_metadata_like("chrom_sequence", "sequence from chromosome");
  $mds->remove_metadata_like("edit", "mismatch/insertion/deletion status");
  $mds->remove_metadata_like("end", "end position of mapping");
  $mds->remove_metadata_like("id", "query ID/sequence");
  $mds->remove_metadata_like("map_position", "number of locations tag mapped to");
#  $mds->remove_metadata_like("raw.2824-68E3-ACA]:"THP-1 LOT PPI, tube_31");
#  $mds->remove_metadata_like("   Metadata(23) [raw.2824-68E3-GAT]:"THP-1 LOT PPI, tube_31");
  $mds->remove_metadata_like("raw.total", "tag total count");
  $mds->remove_metadata_like("ribosomal_sequence_accessions");
  $mds->remove_metadata_like("start.0base");
  $mds->remove_metadata_like("strand");

  #
  # remap the raw "expname" to "osc:LSA_sample_id"
  #
  my $sample_id = "";
  my $barcode = "";

  unless($mds->find_metadata('osc:LSA_sample_id')) {
    if(my $md1 = $mds->find_metadata('osc:LSArchive_sample_osc_sample_id')) {
      $mds->add_tag_symbol("osc:LSA_sample_id", $md1->data);
    } elsif(my $md2 = $mds->find_metadata('expname')) {
      if($md2->data =~ /(\w+)-(\w+)-(\w+)/) {
        $sample_id = $1."-".$2;
        $barcode   = $3;
      } elsif($md2->data =~ /(\w+)-(\w+)/) {
        $sample_id = $1."-".$2;
      }
      if((my $idx1 = index($sample_id, $library_id))>=0) { 
	my $old = $sample_id;
        substr($sample_id, $idx1, length($library_id), "");
	if($self->{'debug'}) { printf("change sample [%s] to [%s]\n", $old, $sample_id); }
      }
      if($sample_id) { $mds->add_tag_symbol("osc:LSA_sample_id", $sample_id); }
      if($barcode)   { $mds->add_tag_symbol("osc:LSA_sample_barcode", $barcode); }
    }
  }
  my $sampleID_md  = $mds->find_metadata('osc:LSA_sample_id');
  if($sampleID_md) {
    $sample_id = $sampleID_md->data;
  } else {
    if($self->{'debug'}>2) { printf("warning: experiment does not have OSC LSA_sample_id\n"); }
  }

  #
  # sync barcode
  #
  my $barcode_md  = $mds->find_metadata('osc:LSA_sample_barcode');
  if($barcode_md) {
    $barcode = $barcode_md->data;
  } else {
    if($self->{'debug'}>2) { printf("warning: experiment does not have OSC LSA_sample_barcode\n"); }
  }

  if($self->{'debug'}>1) {
    printf("\nimport metadata from LSA with query libraryID [%s] :: %s", $library_id, $libID_md->display_desc);
    if($sample_id)  { printf("   sample[%s] :: %s", $sample_id, $sampleID_md->display_desc); }
    if($barcode)    { printf("   barcode[%s] :: %s", $barcode, $barcode_md->display_desc); }
    print("\n");
  }

  if($self->{'debug'}>2) { print($experiment->display_contents); }

  my $match_count=0;
  my $LSA_experiment = undef;
  my $lsa_experiments = $self->get_experiments_by_libraryID($library_id);
  foreach my $lsa_exp (@$lsa_experiments) {
    #if($metadata) { print($experiment->display_contents,"\n"); }
    my $libID_md    = $lsa_exp->metadataset->find_metadata("osc:LSArchive_library_osc_lib_id");
    my $sampleID_md = $lsa_exp->metadataset->find_metadata("osc:LSArchive_sample_osc_sample_id");
    my $barcode_md  = $lsa_exp->metadataset->find_metadata("osc:LSArchive_BARCODE_SEQUENCE");

    #printf("%s :: ", $lsa_exp->display_name); printf("[%s] ", $libID_md->data); printf("[%s] ", $sampleID_md->data); printf("[%s]\n", $barcode_md->data);

    if($library_id) {
      if(!$libID_md) { next; }
      if($self->{'debug'}>1) { printf("  checking library_id [%s] against LSArchive record [%s]\n", $library_id, $libID_md->data); }
      if($libID_md->data ne $library_id) { next; }
      if($self->{'debug'}>1) { printf("     libraryID match\n"); }
    }
    if($self->{'debug'}>1) { printf("    check LSArchive: %s\n", $lsa_exp->display_desc); }
    if($sample_id) {
      if($self->{'debug'}>1) { printf("  checking sample_id [%s]\n", $sample_id); }
      if(!$sampleID_md) { next; }
      if($sampleID_md->data ne $sample_id) { next; }
      if($self->{'debug'}>1) { print("     sampleID match\n"); }
    }
    if($barcode) {
      if($self->{'debug'}>1) { printf("  checking barcode [%s]\n", $barcode); }
      if(!$barcode_md) { next; }
      if($barcode_md->data ne $barcode) { next; }
      if($self->{'debug'}>1) { print("     barcode match\n"); }
    }
    if($self->{'debug'}>1) { print("     found matching experiments\n"); }

    $LSA_experiment = $lsa_exp;
    $match_count++;
  }
  if($self->{'debug'}>1) { printf("%d matches found\n", $match_count); }
  if(!defined($LSA_experiment) or ($match_count > 1)) { 
    if($self->{'debug'}) {
      printf("FAILED match %d : libraryID [%s]", $match_count, $library_id);
      if($sample_id)  { printf("   sample[%s]", $sample_id); }
      if($barcode)    { printf("   barcode[%s]", $barcode); }
      printf("  eeDB::[%s] %s", $experiment->db_id, $experiment->display_name);
      print("\n");
    }

    #if(!defined($LSA_experiment)) { return undef;  }
    return undef;
  }

  if($self->{'debug'} > 3) {
    printf("FOUND MATCH\n%s\n", $LSA_experiment->display_desc);
    printf("MERGE\n");
  }

  $experiment->metadataset->merge_metadataset($LSA_experiment->metadataset);
  unless($experiment->platform) { $experiment->platform($LSA_experiment->platform); }
  #$experiment->display_name($experiment->exp_accession ." ".  $LSA_experiment->display_name);
  $experiment->display_name($LSA_experiment->display_name);

  #print($experiment->display_contents);
  return $experiment;
}


sub get_experiments_by_libraryID {
  my $self = shift;
  my $library_id = shift;

  my $experiments = $self->import_metadata_for_library($library_id);
  #foreach my $experiment (@$experiments) {
  #  #if($metadata) { print($experiment->display_contents,"\n"); }
  #  print($experiment->display_desc,"\n");
  #}
  return $experiments;
}


sub get_experiment_by_library_sample_barcode {
  my $self = shift;
  my $library_id = shift;
  my $sample_id = shift;
  my $barcode = shift;

  my $match_count=0;
  my $LSA_experiment = undef;
  my $lsa_experiments = $self->get_experiments_by_libraryID($library_id);
  foreach my $lsa_exp (@$lsa_experiments) {
    #if($metadata) { print($experiment->display_contents,"\n"); }
    my $libID_md    = $lsa_exp->metadataset->find_metadata("osc:LSArchive_library_osc_lib_id");
    my $sampleID_md = $lsa_exp->metadataset->find_metadata("osc:LSArchive_sample_osc_sample_id");
    my $barcode_md  = $lsa_exp->metadataset->find_metadata("osc:LSArchive_BARCODE_SEQUENCE");
    
    #printf("%s :: ", $lsa_exp->display_name); printf("[%s] ", $libID_md->data); printf("[%s] ", $sampleID_md->data); printf("[%s]\n", $barcode_md->data);
    
    if($library_id) {
      if(!$libID_md) { next; }
      if($self->{'debug'}>1) { printf("  checking library_id [%s] against LSArchive record [%s]\n", $library_id, $libID_md->data); }
      if($libID_md->data ne $library_id) { next; }
      if($self->{'debug'}>1) { printf("     libraryID match\n"); }
    }
    if($self->{'debug'}>1) { printf("    check LSArchive: %s\n", $lsa_exp->display_desc); }
    if($sample_id) {
      if($self->{'debug'}>1) { printf("  checking sample_id [%s]\n", $sample_id); }
      if(!$sampleID_md) { next; }
      if($sampleID_md->data ne $sample_id) { next; }
      if($self->{'debug'}>1) { print("     sampleID match\n"); }
    }
    if($barcode) {
      if($self->{'debug'}>1) { printf("  checking barcode [%s]\n", $barcode); }
      if(!$barcode_md) { next; }
      if($barcode_md->data ne $barcode) { next; }
      if($self->{'debug'}>1) { print("     barcode match\n"); }
    }
    if($self->{'debug'}>1) { print("     found matching experiments\n"); }
    
    $LSA_experiment = $lsa_exp;
    $match_count++;
  }
  if($self->{'debug'}>1) { printf("%d matches found\n", $match_count); }
  if(!defined($LSA_experiment) or ($match_count > 1)) { 
    if($self->{'debug'}) {
      printf("FAILED match %d : libraryID [%s]", $match_count, $library_id);
      if($sample_id)  { printf("   sample[%s]", $sample_id); }
      if($barcode)    { printf("   barcode[%s]", $barcode); }
      print("\n");
    }
    return undef;
  }
  return $LSA_experiment;
}


sub import_metadata_for_library {
  my $self = shift;
  my $library_id = shift;

  return [] unless($library_id);
  
  my $url = "http://osc-internal.gsc.riken.jp/ls-archive/exportFull.jsp?filter=true&approved=1&rejected=0&".
            "onHold=0&exportType=xml&libraryId=" . $library_id; 
  if($self->{'debug'}>2) { printf("URL: %s\n", $url); }

  my $tpp = XML::TreePP->new();
  
  my $ua = LWP::UserAgent->new();
  $ua->timeout( 60 );
  $ua->env_proxy;
  my $response = $ua->get($url);
  if($response->is_success) {
    #print $response->decoded_content;  # or whatever
    #print "\n";
  } else {
    print("failed to do get XML\n");
    return [];
  }
       
  my $tree = $tpp->parsehttp( GET => $url );
  #print "TREE::" , $tree, "\n";

  unless($tree->{'LS-Archive'}) {
    #print("ERROR no LS-Archive top tag\n");
    return [];
  }
  
  my @experiments;
  my $sample_records = $tree->{'LS-Archive'}->{'entry'};;
  unless($sample_records) { return []; }
  if($sample_records =~ /ARRAY/) { 
    for my $sample (@{$sample_records}) {
      my $experiment = $self->parse_lsa_sample_xml($sample);
      next unless($experiment);
      if($experiment->metadataset()->has_metadata_like("osc:LSArchive_library_osc_lib_id", $library_id)) {
        push @experiments, $experiment;
      }
    }
  } else { 
    my $experiment = $self->parse_lsa_sample_xml($sample_records);
    if($experiment) { 
      if($experiment->metadataset()->has_metadata_like("osc:LSArchive_library_osc_lib_id", $library_id)) {
        push @experiments, $experiment;
      }
    }
  }
  return \@experiments;
}


sub parse_lsa_sample_xml {
  my $self = shift;
  my $sample = shift;
  
  if($sample->{"LSArchive_application_customer_id"}) {
    #print("!!!!commercial application so do not import\n");
    return undef;
  }
  #foreach my $key (keys(%$sample)) { printf("[%s] => %s\n", $key, $sample->{$key}); }

  my $experiment = new EEDB::Experiment;
  my $mdata = $experiment->metadataset;
  
  my $libID_md       = sample_get_symbol($mdata, $sample, "LSArchive_library_osc_lib_id");    #ex: O63-DA
  my $sampleID_md    = sample_get_symbol($mdata, $sample, "LSArchive_sample_osc_sample_id");  #ex: 2816-67B9
  my $barcode_md     = sample_get_mdata ($mdata, $sample, "LSArchive_BARCODE_SEQUENCE");
  my $sample_name_md = sample_get_mdata($mdata, $sample, "LSArchive_sample_sample_name");
  
  my $md1      = sample_get_symbol($mdata, $sample, "LSArchive_osc_lib_id_sample_id");
  my $md2      = sample_get_mdata ($mdata, $sample, "LSArchive_application_experiment_description");
  my $md3      = sample_get_mdata ($mdata, $sample, "LSArchive_BARCODE_NAME");

  sample_get_mdata ($mdata, $sample, "LSArchive_barcode_barcode_sequence");
  sample_get_mdata ($mdata, $sample, "LSArchive_library_sample_barcode_desc");
  sample_get_mdata ($mdata, $sample, "LSArchive_barcode_barcode_name");

  my $name ="";
  if($sample_name_md) { $name .= $sample_name_md->data . " : "; }
  if($barcode_md)     { $name .= $barcode_md->data; }
  if($libID_md)       { $name .= " ". $libID_md->data; }
 #if($sampleID_md)    { $name .= " ". $sampleID_md->data; }
  
  if($md1) { 
    if($barcode_md) { $experiment->exp_accession($md1->data ."_". $barcode_md->data); }
    else { $experiment->exp_accession($md1->data); }
    #$name.=$md1->data . " "; 
  }
  #if($md3 and ($md3->data ne "Null")) { $name.= " ".$md3->data; }
  $experiment->display_name($name);

  if($md2 and ($md2->data ne "Null")) { 
    if(!($mdata->has_metadata_like("description"))) {
      $mdata->add_tag_data("description", $md2->data); 
    }
  }

  my $md7 = sample_get_mdata($mdata, $sample, "LSArchive_library_library_type_name");
  my $md8 = sample_get_mdata($mdata, $sample, "LSArchive_library_sequencer_type_name");
  my $platform = "";
  if($md7) { $platform .= $md7->data; }
  if($md8) { 
    if($platform ne "") { $platform .= " "; }
    $platform .= $md8->data;
  }
  if($platform) { 
    $experiment->platform($platform); 
    my $md = $mdata->add_tag_data("eedb:platform", $platform);
    $mdata->merge_metadataset($md->extract_keywords);
  }

  sample_get_symbol($mdata, $sample, "LSArchive_application_public_application_id");
  sample_get_symbol($mdata, $sample, "LSArchive_application_public_application_id", "osc:LSA_application_id");
  
  sample_get_symbol($mdata, $sample, "LSArchive_sample_cell_type", "cell_type");
  sample_get_symbol($mdata, $sample, "LSArchive_sample_cell_line", "cell_line");

  sample_get_mdata($mdata, $sample, "LSArchive_application_investigation_title");
  sample_get_mdata($mdata, $sample, "LSArchive_application_experiment_description");
  sample_get_mdata($mdata, $sample, "LSArchive_application_application_type");
  sample_get_mdata($mdata, $sample, "LSArchive_application_project_no");
  sample_get_mdata($mdata, $sample, "LSArchive_library_run_size");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_organism");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_strain");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_tissue_type");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_sex");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_developmental_stage");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_cell_type");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_cell_line");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_collaboration");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_experiment_condition");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_sample_treatment");
  sample_get_mdata($mdata, $sample, "LSArchive_sample_sample_comment");
  sample_get_mdata($mdata, $sample, "LSArchive_barcode_barcode_name");
  

  sample_get_symbol($mdata, $sample, "Librarian_rna_sample_taxonomy_id", "osc:taxonID");

  sample_get_symbol($mdata, $sample, "Librarian_osc_lib_id_sample_id");
  sample_get_symbol($mdata, $sample, "Librarian_rna_sample_taxonomy_id");
  sample_get_symbol($mdata, $sample, "Librarian_cdna_second_sample_lib_id");
  sample_get_symbol($mdata, $sample, "Librarian_cdna_second_sample_sublib_id");

  sample_get_mdata($mdata, $sample, "Librarian_cdna_second_sample_cdna_sample_type_name");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_second_sample_primer_name");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_primer_name");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_tag1_name");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_tag1_sequence");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_tag1_seq_type");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_tag2_name");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_tag2_sequence");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_tag2_seq_type");
  sample_get_mdata($mdata, $sample, "Librarian_cdna_first_sample_having_gtail");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_strain_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_taxonomy_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_tissue_type");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_tissue_public_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_dev_stage_category_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_dev_stage_dev_stage_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_cell_type_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_collaboration_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_collaborator_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_collaborator_contact_email");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_collaborator_contact_member_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_collaborator_contact_addr");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_sex_type_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_condition_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_sample_treatment");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_comment");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_tube_extract_method_name");
  sample_get_mdata($mdata, $sample, "Librarian_rna_sample_tube_extract_type_name>whole cell");
  
  #$mdata->extract_keywords;
  #print($experiment->display_contents) if($experiment);
  return $experiment;
}

sub sample_get_mdata {
  my $mdataset = shift;
  my $sample = shift;
  my $tag    = shift;
  my $newtag = shift; #optional undef 
  
  my $value = $sample->{$tag};
  #my $value = $sample->{$tag}->{'#text'};
  if(!defined($newtag)) { $newtag = "osc:".$tag; }
  my $mdata;
  if($value) { 
    $mdata = $mdataset->add_tag_data($newtag, $value); 
    $mdataset->merge_metadataset($mdata->extract_keywords); #always extract keywords
  }
  return $mdata;
}

sub sample_get_symbol {
  my $mdataset = shift;
  my $sample = shift;
  my $tag    = shift;
  my $newtag = shift;
  
  if(!defined($newtag)) { $newtag = "osc:".$tag; }
  #my $value = $sample->{$tag}->{'#text'};
  my $value = $sample->{$tag};
  my $mdata;
  if($value) { $mdata=$mdataset->add_tag_symbol($newtag, $value); }
  return $mdata;
}


sub unique_metadata_by_type {
  my $feature   = shift; #Feature object
  my $new_mdata = shift; #Metadata object

  return unless($new_mdata);
  
  my $mds      = $feature->metadataset;
  my $entrezID = $mds->find_metadata('EntrezID');
  my $alt_type = "alt_" . $new_mdata->type;

  my $old_mdata_array = $mds->find_all_metadata_like($new_mdata->type);
  foreach my $mdata (@$old_mdata_array) {
    if(($mdata->type eq $new_mdata->type) and ($mdata->data ne $new_mdata->data)) {
      printf("[%s] UNLINK OLD MDATA:: %s -> %s\n", $entrezID->data,
            $feature->primary_name,
            $mdata->display_contents);
      $mds->add_tag_data($alt_type, $mdata->data);  #put the data back but with new alt type            
      $mds->remove_metadata($mdata);
      $mdata->unlink_from_feature($feature);
    }
  }
}


1;


