#!/usr/bin/perl -w 
BEGIN{
    unshift(@INC, "/zenbu/src/ZENBU_2.11.3/lib");
}

=head1 NAME - eedb_sync_entrezgene.pl 

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

use strict;
use warnings;
use Getopt::Long;
use Data::Dumper;
use Switch;
use File::Temp;

use XML::TreePP;

use EEDB::Database;
use MQdb::MappedQuery;

use EEDB::Feature;
use EEDB::FeatureSource;
use EEDB::Edge;
use EEDB::EdgeSource;
use EEDB::Assembly;
use EEDB::Chrom;
use EEDB::Expression;
use EEDB::MetadataSet;
use EEDB::Tools::MultiLoader;

no warnings 'redefine';
$| = 1;

my $help;
my $passwd = '';

my $assembly_name = undef;
my $url = undef;
my $skip_deprecate = undef;
my $skip_update = undef;
my $skip_new = undef;
my $fsrc_name = undef;
my $debug = 0;
my $nostore = 0;

my $genecount=0;
my $locmove_count=0;
my $entrez_id=undef;

GetOptions( 
    'url:s'        =>  \$url,
    'entrezID:s'   =>  \$entrez_id,
    'debug:s'      =>  \$debug,
    'v'            =>  \$debug,
    'assembly:s'   =>  \$assembly_name,
    'asm:s'        =>  \$assembly_name,
    'skip_new'     =>  \$skip_new,
    'skip_deprecate' =>  \$skip_deprecate,
    'skip_update'  =>  \$skip_update,
    'pass:s'       =>  \$passwd,
    'nostore'      =>  \$nostore,
    'help'         =>  \$help
    );


if ($help) { usage(); }
#unless($gff_file and (-e $gff_file)) { usage(); }

my $eeDB = undef;
if($url) { $eeDB = EEDB::Database->new_from_url($url); } 
unless($eeDB) {
  printf("ERROR: connection to database\n\n");
  usage(); 
}

my $assembly = EEDB::Assembly->fetch_by_name($eeDB, $assembly_name);
unless($assembly) { printf("error fetching assembly [%s]\n\n", $assembly_name); usage(); }

$fsrc_name = "Entrez_gene_" . $assembly->ucsc_name;
my $entrez_source = EEDB::FeatureSource->fetch_by_category_name($eeDB, "gene", $fsrc_name);
unless($entrez_source) {
  $entrez_source = new EEDB::FeatureSource;
  $entrez_source->category("gene");
  $entrez_source->name($fsrc_name);
  $entrez_source->import_source("NCBI Entrez Gene");
  $entrez_source->is_active("y");
  $entrez_source->is_visible("y");
  $entrez_source->metadataset->add_tag_data("import_url", "http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene");
  unless($nostore) { $entrez_source->store($eeDB); }
  printf("Needed to create:: %s\n", $entrez_source->display_desc);
}
unless($entrez_source) { printf("error Entrez feature_source [%s]\n\n", $fsrc_name); usage(); }

#my $deprecate_source = EEDB::FeatureSource->fetch_by_category_name($eeDB, "gene", "deprecated_entrez_gene");
#unless($deprecate_source) {
#  $deprecate_source = new EEDB::FeatureSource;
#  $deprecate_source->category("gene");
#  $deprecate_source->name("deprecated_entrez_gene");
#  $deprecate_source->import_source("NCBI Entrez Gene");
#  $deprecate_source->metadataset->add_tag_data("import_url", "http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene");
#  $deprecate_source->store($eeDB);
#  printf("Needed to create:: %s\n", $deprecate_source->display_desc);
#}
#unless($deprecate_source) { printf("error making [deprecated_entrez_gene] feature_source\n\n"); usage(); }


printf("============\n");
printf("eeDB:: %s\n", $eeDB->url);
$assembly->display_info;
$entrez_source->display_info;
#$deprecate_source->display_info;
printf("============\n");

if(defined($entrez_id)) {
  fetch_gene_from_webservice($entrez_id);
} else {
  update_from_webservice();
}
#fetch_gene_from_webservice(100128520); #19
#100128520

fetch_gene_from_webservice();#flush

printf("MOVED stats : %d / %d = %1.2f%%\n", $locmove_count, $genecount, 100.0*$locmove_count/$genecount);

exit(1);

#########################################################################################

sub usage {
  print "eedb_sync_entrezgene.pl [options]\n";
  print "  -help              : print this help\n";
  print "  -url <url>         : URL to database\n";
  print "  -assembly <name>   : name of species/assembly (eg hg18 or mm9)\n";
  print "  -entrezID <id>     : synchronize specific entrez gene\n";
  print "  -skip_new          : do not load new genes since last update\n";
  print "  -skip_update       : do not perform the update process on previously loaded genes\n";
  print "  -skip_deprecate    : do not perform the update process on deprecated genes\n";
  print "  -nostore           : perform dry run without storing changes in database\n";
  print "eedb_sync_entrezgene.pl v1.1\n";

  exit(1);
}


##################################################################
#
# new XML webservice based mathods
#
##################################################################

sub update_from_webservice {
  my $url = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?".
            "db=gene&retmax=300000";
  $url .= sprintf("&term=%d[taxid]%%20AND%%20gene_all[filter]", $assembly->taxon_id);
  #$url .= sprintf("&term=%s%%20AND%%20gene_all[filter]", $assembly->ncbi_assembly_acc());
  printf("URL: %s\n", $url);
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parsehttp( GET => $url );
  #print $tree, "\n";

  my $search_count = $tree->{'eSearchResult'}->{'Count'};
  printf("search returned %d genes\n", $search_count);
  my $id_list = $tree->{'eSearchResult'}->{'IdList'}->{'Id'};
  #printf("idList %s\n", $id_list);

  my $geneIDs =[];
  if($id_list =~ /ARRAY/) { $geneIDs = $id_list; } 
  else { $geneIDs = [$id_list]; }

  #should maybe do something here to filter the list 
  #into:: new, deprecated, and update
  my $sql = "select sym_value from symbol join feature_2_symbol using (symbol_id) ".
     "JOIN feature using(feature_id) ".
     "WHERE sym_type='EntrezID' AND feature_source_id=? ORDER BY last_update";
  my $loadedEntrezIDs = MQdb::MappedQuery->fetch_col_array($eeDB, $sql, $entrez_source->id);
  my $eIDhash = {};
  my $newCount=0;
  my $updateCount=0; 
  my $deprecateCount=0;

  foreach my $geneID (@$loadedEntrezIDs) { $eIDhash->{$geneID}='dbonly'; }
  foreach my $geneID (@$id_list) {
    if($eIDhash->{$geneID} and ($eIDhash->{$geneID} eq 'dbonly')) { 
      $updateCount++; 
      $eIDhash->{$geneID}='update'; 
    }
    else { $newCount++; $eIDhash->{$geneID}='new'; }
  }
  for my $geneID (keys(%$eIDhash)) {
    $deprecateCount++ if($eIDhash->{$geneID} eq 'dbonly');
  }
  printf("%d new genes to add\n", $newCount);
  printf("%d genes to update check\n", $updateCount);
  printf("%d genes to deprecate\n", $deprecateCount);
  sleep(5);
      
  #first add new genes
  unless($skip_new) {
    for my $geneID (keys(%$eIDhash)) {
      next unless($eIDhash->{$geneID} eq 'new');
      fetch_gene_from_webservice($geneID);
    }
  }
  fetch_gene_from_webservice();  #flushes the buffer
  
  #then the updates
  unless($skip_update) {
    foreach my $geneID (@$loadedEntrezIDs) { 
      #printf("%s ", $geneID);
      #for my $geneID (keys(%$eIDhash)) {
      next unless($eIDhash->{$geneID} eq 'update');
      fetch_gene_from_webservice($geneID);
    }
  }
  fetch_gene_from_webservice();  #flushes the buffer
  
  #last deprecate
  unless($skip_deprecate) {
    for my $geneID (keys(%$eIDhash)) {
      next unless($eIDhash->{$geneID} eq 'dbonly');
      #deprecate_geneID($geneID);
      fetch_gene_from_webservice($geneID);
    }
  }
  
  fetch_gene_from_webservice();  #flushes the buffer  
}


my @gene_id_buffer;
sub fetch_gene_from_webservice {
  my $geneID = shift;
  if(defined($geneID)) { 
    $genecount++;
    #printf("geneID: %d\n", $geneID);
    push @gene_id_buffer, $geneID; 
    return if(scalar(@gene_id_buffer) < 300);
  }
  return unless(scalar(@gene_id_buffer) >0);
  printf("go to NCBI and get %d genes\n", scalar(@gene_id_buffer));

  my $url = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?".
             "db=gene&retmode=text";
  $url .= sprintf("&id=%s", join(",", @gene_id_buffer));
  printf("URL: %s\n", $url);
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parsehttp( GET => $url );

  my $summaries = $tree->{'eSummaryResult'}->{'DocumentSummarySet'}->{'DocumentSummary'};
  #printf("summaries %s\n", $summaries);

  if($eeDB->driver eq "sqlite") { $eeDB->do_sql("BEGIN"); }
  if($summaries =~ /ARRAY/) { 
    foreach my $summaryXML (@$summaries) {
      extract_gene_summaryXML($summaryXML);
    }
  } else {
    extract_gene_summaryXML($summaries);
  }
  if($eeDB->driver eq "sqlite") { $eeDB->do_sql("COMMIT"); }

  #done now so clear out the buffer
  @gene_id_buffer = ();
}


sub extract_gene_summaryXML {
  my $summaryXML = shift;

  #first create a new feature for this data
  #then compare it to the database and do diffs/updates
  #and record the changes

  my $geneID = $summaryXML->{"-uid"};

  my $new_feature = new EEDB::Feature;
  $new_feature->feature_source($entrez_source);
  $new_feature->significance(0.0);
  my $mdataset = $new_feature->metadataset;
  $mdataset->add_tag_symbol("EntrezID", $geneID);
  
  #need to combine the description and organism name into a nice description
  my $desc = undef;
  my $organism =undef;
  
  foreach my $type (keys %$summaryXML) {
    my $value = $summaryXML->{$type};
    next unless($value);
    if($debug gt "1") { printf("key[%s] %s\n", $type, $value); }
    #print("==\n");
    #foreach my $key(keys(%$item)) { printf("key[%s] %s\n", $key, $item->{$key}); }
    if($type eq "Name") {
      $new_feature->primary_name($value);
      $mdataset->add_tag_symbol('EntrezGene', $value); 
    } 
    elsif($type eq "Description") {
      #$mdataset->add_tag_data("description", $value);
      $desc = $value;
    }
    #elsif($type eq "Organism") {
      #$mdataset->add_tag_data("description", $value);
    #  $organism = $value;
    #}
    elsif($type eq "MapLocation") {
      $mdataset->add_tag_symbol('GeneticLoc', $value); 
    }
    elsif($type eq "Summary") {
      my $mdata = $mdataset->add_tag_data('Summary', $value);
      #$mdataset->merge_metadataset($mdata->extract_keywords);
    }
    elsif($type eq "Mim") {
      my $mims = $value->{"int"};
      if($mims =~ /ARRAY/) {
        foreach my $mim (@$mims) {
          $mdataset->add_tag_symbol('OMIM', $mim);
        }
      } else {
        #foreach my $key(keys(%$mims)) { printf("key[%s] %s\n", $key, $mims->{$key}); }
        $mdataset->add_tag_symbol('OMIM', $mims);
      }
    }
    elsif($type eq "OtherAliases") {
      my @aliases = split /,/, $value;
      foreach my $alias (@aliases) {
        $alias =~ s/^\s*//g; #remove any leading space
        $mdataset->add_tag_symbol('Entrez_synonym', $alias); 
      }
    }
    elsif($type eq "OtherDesignations") {
      my @aliases = split /\|/, $value;
      foreach my $alias (@aliases) {
        $alias =~ s/^\s*//g; #remove any leading space
        my $mdata = $mdataset->add_tag_data('alt_description', $alias); 
        #$mdataset->merge_metadataset($mdata->extract_keywords);
      }
    }
    elsif($type eq "LocationHist") {
      add_matching_loc_hist_XML_to_feature($new_feature, $value);
    }    
    #elsif($type eq "GenomicInfo") { add_matching_genomic_info_XML_to_feature($new_feature, $value); }    
    elsif($type =~ /^Nomenclature/) {
      $mdataset->add_tag_symbol($type, $value);
    }
  }
  if($desc) { #there should only be one description for a gene
    if($organism) { $desc .= " [" . $organism . "]"; } 
    my $mdata = $mdataset->add_tag_data("description", $desc);
    #$mdataset->merge_metadataset($mdata->extract_keywords);
  }
  if($debug) { printf("new_feature before update ====\n%s\n===========\n", $new_feature->simple_xml()); }

  $new_feature = dbcompare_update_newfeature($new_feature);
  #print($new_feature->xml());
}


sub add_matching_loc_hist_XML_to_feature {
  #parsing the LocationHist/LocationHistType for matching assembly/chrom
  #to get correct location
  if($debug) { printf("====== add_matching_loc_hist_XML_to_feature ======\n"); }
  my $feature = shift;
  my $locXML = shift;
  return undef unless($locXML);
  
  my @locs_array;
  my $locs = $locXML->{"LocationHistType"};
  if($locs =~ /ARRAY/) { @locs_array = @$locs; } 
  else { push @locs_array, $locs; }
  
  #printf("has %ld LocationHistType entries\n", scalar(@locs_array));
  
  foreach my $locHistXML (@locs_array) {
    #print("check_loc_history==\n");
    #<AnnotationRelease>105</AnnotationRelease>
    #<AssemblyAccVer>GCF_000001895.5</AssemblyAccVer>
    #<ChrAccVer>NC_005117.4</ChrAccVer>
    #<ChrStart>27657902</ChrStart>
    #<ChrStop>27660100</ChrStop>

    my $asmAccVer = $locHistXML->{"AssemblyAccVer"};
    my $chrAccVer = $locHistXML->{"ChrAccVer"};
    my $chrStart = $locHistXML->{"ChrStart"} + 1;
    my $chrStop = $locHistXML->{"ChrStop"} + 1;

    if($debug) { printf("asm[%s] chrAcc[[%s] start[%ld] stop[%ld]\n", $asmAccVer, $chrAccVer, $chrStart, $chrStop); }

    #printf("check $asmAccVer assembly [%s]\n", $assembly->ncbi_assembly_acc());
    if($assembly->ncbi_assembly_acc() ne $asmAccVer) { next; }
    if($debug) { printf("found LocationHistType for requested assembly [%s]\n", $assembly->ncbi_assembly_acc()); }
    
    my $chrom = EEDB::Chrom->fetch_by_chrom_acc_assembly_id($eeDB,$chrAccVer,$assembly->id);
    if($chrom) {
      if($debug) { printf("  found matching ncbi_chrom_acc\n"); }
      $feature->chrom($chrom);
      $feature->chrom_start($chrStart);
      $feature->chrom_end($chrStop);
    } else {
      #if($debug) { printf("did not find a matching ncbi asembly [$chrAccVer] chrom[$chrAccVer] record\n"); }
    }
  }
  if(!$feature->chrom()) {
    if($debug) { printf("WARN!! did not find a matching ncbi asembly/chrom record\n"); }
    return undef;
  }
  
  #post process
  $feature->strand("+");
  my $complement="";
  if($feature->chrom_start > $feature->chrom_end) {
    if($debug) { printf("flip strand because start>end\n"); }
    my $t = $feature->chrom_start;
    $feature->chrom_start($feature->chrom_end);
    $feature->chrom_end($t);
    $feature->strand("-");
    $complement = ", complement";
  }
  
  my $full_loc = sprintf("Chromosome %s, %s %s (%d..%d%s)", 
                        $feature->chrom()->chrom_name(),
                        $assembly->ncbi_assembly_acc(),
                        $feature->chrom()->ncbi_chrom_acc(),
                        $feature->chrom_start,
                        $feature->chrom_end,
                        $complement);
  $feature->metadataset->add_tag_data('entrez_location', $full_loc);
  #printf("%s\n", $full_loc);
  if($debug) { printf("%s\n====== END add_matching_loc_hist_XML_to_feature ======\n", $feature->simple_xml()); }
  return $feature;
}


sub add_matching_genomic_info_XML_to_feature {
  #parsing the LocationHist/LocationHistType for matching assembly/chrom
  #to get correct location
  if($debug) { printf("add_matching_genomic_info_XML_to_feature\n"); }
  my $feature = shift;
  my $locXML = shift;
  return undef unless($locXML);
  
  my @locs_array;
  my $locs = $locXML->{"GenomicInfoType"};
  if($locs =~ /ARRAY/) { @locs_array = @$locs; } 
  else { push @locs_array, $locs; }
  
  #printf("has %ld LocationHistType entries\n", scalar(@locs_array));
  
  foreach my $locHistXML (@locs_array) {
    #print("check_loc_history==\n");
    #<AnnotationRelease>105</AnnotationRelease>
    #<AssemblyAccVer>GCF_000001895.5</AssemblyAccVer>
    #<ChrAccVer>NC_005117.4</ChrAccVer>
    #<ChrStart>27657902</ChrStart>
    #<ChrStop>27660100</ChrStop>

    my $chrAccVer = $locHistXML->{"ChrAccVer"};
    my $chrStart = $locHistXML->{"ChrStart"};
    my $chrStop = $locHistXML->{"ChrStop"};

    my $chrom = EEDB::Chrom->fetch_by_chrom_acc_assembly_id($eeDB,$chrAccVer,$assembly->id);
    if($chrom) {
      if($debug) { printf("found matching ncbi_chrom_acc [$chrAccVer]\n"); }
      $feature->chrom($chrom);
      $feature->chrom_start($chrStart);
      $feature->chrom_end($chrStop);
    } else {
      if($debug) { printf("did not find a matching ncbi chrom[$chrAccVer] record\n"); }
    }
  }
  if(!$feature->chrom()) {
    #printf("did not find a matching ncbi asembly/chrom record\n");
    return undef;
  }
  
  #post process
  $feature->strand("+");
  my $complement="";
  if($feature->chrom_start > $feature->chrom_end) {
    my $t = $feature->chrom_start;
    $feature->chrom_start($feature->chrom_end);
    $feature->chrom_end($t);
    $feature->strand("-");
    $complement = ", complement";
  }
  
  my $full_loc = sprintf("Chromosome %s, %s %s (%d..%d%s)", 
                        $feature->chrom()->chrom_name(),
                        $assembly->ncbi_assembly_acc(),
                        $feature->chrom()->ncbi_chrom_acc(),
                        $feature->chrom_start,
                        $feature->chrom_end,
                        $complement);
  $feature->metadataset->add_tag_data('entrez_location', $full_loc);
  #printf("%s\n", $full_loc);
  return $feature;
}


sub dbcompare_update_newfeature {
  if($debug) { printf("===\ndbcompare_update_newfeature ==========\n"); }
  my $new_feature = shift;
  $new_feature->metadataset->remove_duplicates;
  my $changed=0;

  my $entrezID = $new_feature->metadataset->find_metadata('EntrezID');

  my ($entrez_feature) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB,
                             $entrez_source, $entrezID->data, 'EntrezID')};
  unless($entrez_feature) {
    #unless($new_feature->chrom_location()) { 
    #  printf("[%9s] NEW-SKIP_no_loc:: %30s : %33s : %s\n", $entrezID->data, $new_feature->primary_name(), $new_feature->chrom_location(), $new_feature->db_id());
    #  return $new_feature;
    #}
    unless($nostore) { $new_feature->store($eeDB); }
    $changed=1;
    #printf("[%s] NEW:: %s\n", $entrezID->data, $new_feature->simple_display_desc);
    printf("[%9s] NEW:: %30s : %33s : %s\n", $entrezID->data, $new_feature->primary_name(), $new_feature->chrom_location(), $new_feature->db_id());
    return $new_feature;
  }

  if($debug gt "2") { 
    print("=== old feature before update check ===\n"); 
    printf("%s", $entrez_feature->display_contents); 
  }
  
  #
  # do the name checks 
  #
  if($entrez_feature->primary_name ne $new_feature->primary_name) {
    printf("[%s] NAME CHANGE:: %s => %s\n", $entrezID->data,
            $entrez_feature->primary_name,
            $new_feature->primary_name);
    $changed=1;
    #change the old name in the symbol set (remove EntrezGene, add Entrez_synonym)
    my $syms = $entrez_feature->metadataset->find_all_metadata_like('EntrezGene');
    foreach my $nameSym (@$syms) { 
      if($new_feature->primary_name ne $nameSym->data) {
        printf("[%s] UNLINK MDATA:: %s\n", $entrezID->data, $nameSym->display_contents);
        unless($nostore) { $nameSym->unlink_from_feature($entrez_feature); }
      }
    }
    $entrez_feature->metadataset->add_tag_symbol('Entrez_synonym', $entrez_feature->primary_name);
    #then change primary_name.  additional metadata will happen below
    $entrez_feature->primary_name($new_feature->primary_name);
  }

  #
  # do the location checks now
  #
  if($entrez_feature->chrom_location ne $new_feature->chrom_location) {
    if(($entrez_feature->strand eq $new_feature->strand) and 
       $entrez_feature->check_overlap($new_feature)) {
      printf("[%s] MAP WIGGLE::  %s => %s\n", $entrezID->data, 
             $entrez_feature->simple_display_desc, $new_feature->chrom_location);
      $entrez_feature->chrom_start($new_feature->chrom_start);
      $entrez_feature->chrom_end($new_feature->chrom_end);
      $locmove_count++;
      $changed=1;
    } elsif(!defined($entrez_feature->chrom) or ($entrez_feature->chrom_start eq -1)) {
      printf("[%s] NEW MAP::  %s => %s\n", $entrezID->data, 
             $entrez_feature->simple_display_desc, $new_feature->chrom_location);
      $entrez_feature->chrom($new_feature->chrom);
      $entrez_feature->chrom_start($new_feature->chrom_start);
      $entrez_feature->chrom_end($new_feature->chrom_end);
      $entrez_feature->strand($new_feature->strand);
      $locmove_count++;
      $changed=1;
    } else {
      my $move_desc = sprintf("%s [%s] MAP BIG MOVE::  %s => %s", localtime(time()),
             $entrezID->data, 
             $entrez_feature->chrom_location, $new_feature->chrom_location);
      printf("%s :: %s\n", $move_desc, $entrez_feature->display_desc);
      $entrez_feature->metadataset->add_tag_data('big_move', $move_desc);

      $entrez_feature->chrom($new_feature->chrom);
      $entrez_feature->chrom_start($new_feature->chrom_start);
      $entrez_feature->chrom_end($new_feature->chrom_end);
      $entrez_feature->strand($new_feature->strand);
      $locmove_count++;
      $changed=1;
    }
  }

  if($changed) { #primary_name or location has changed
    unless($nostore) { $entrez_feature->update_location(); }
  }

  #
  # do the metadata check, merge in the new metadata into existing set
  #
  my $mds = $entrez_feature->metadataset;

  #special processing of description and entrez_location metadata since there should only be one of each
  my $mdata = $new_feature->metadataset->find_metadata('description');
  unique_metadata_by_type($entrez_feature, $mdata);

  $mdata = $new_feature->metadataset->find_metadata('entrez_location');
  unique_metadata_by_type($entrez_feature, $mdata);

  #my $newmd = $new_feature->metadataset->find_metadata('description');
  #my $old_desc_array = $mds->find_all_metadata_like('description');
  #foreach my $mdata (@$old_desc_array) {
  #  if(($mdata->type eq $newmd->type) and ($mdata->data ne $newmd->data)) {
  #    printf("[%s] UNLINK OLD MDATA:: %s -> %s\n", $entrezID->data,
  #          $entrez_feature->primary_name,
  #          $mdata->display_contents);
  #    $mds->add_tag_data("alt_description", $mdata->data);
  #    $mds->remove_metadata($mdata);
  #    $mdata->unlink_from_feature($entrez_feature);
  #  }
  #}
  
  #the rest can be standard procedure
  $mds->add_metadata(@{$new_feature->metadataset->metadata_list});
  $mds->remove_duplicates;
  my $mdata_list = $entrez_feature->metadataset->metadata_list;
  foreach my $mdata (@$mdata_list) {
    if(!defined($mdata->primary_id)) { 
      # this is a newly loaded metadata so it needs storage and linking
      unless($nostore) {
        if(!$mdata->check_exists_db($eeDB)) { #not turned on by default but what this behaviour here
          $mdata->store($eeDB);
        }
        $mdata->store_link_to_feature($entrez_feature);
      }
      $changed=1;
      printf("[%s] ADD MDATA:: %s -> %s\n", $entrezID->data,
            $entrez_feature->primary_name,
            $mdata->display_contents);
    }
  }
  #maybe I should also deprecate metadata too.
  #the problem is that if any other source adds metadata to EntrezGene
  #then that data will be flushed here.
  #depends on how strict we want to be about "mirroring data" from unique providers

  if($debug) {
    if($changed) {
      printf("=== after UPDATE change ===\n");
      printf("%s", $entrez_feature->display_contents);
      printf("===========================\n");
    } else {
      printf("[%s] OK::  %s\n", $entrezID->data, $entrez_feature->simple_display_desc) if($debug>1);
    }
  }
  return $entrez_feature;
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
      unless($nostore) { $mdata->unlink_from_feature($feature); }
    }
  }
}


#sub deprecate_geneID {
#  my $geneID = shift;
#
#  my ($feature) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB,
#                  $entrez_source, $geneID, 'EntrezID')};
#  return unless($feature);
#  printf("DEPRECATE ::  entrezID %d [%s] %s\n", $geneID, $feature->primary_name(), $feature->chrom_location());
#  $eeDB->execute_sql("UPDATE feature SET feature_source_id=? WHERE feature_id=?",
#                     $deprecate_source->id, $feature->id);
#
#  #this is just to check it
#  #$feature = EEDB::Feature->fetch_by_id($eeDB, $feature->id);
#  #printf("    %s\n", $feature->simple_display_desc);  
#  #exit;
#}

