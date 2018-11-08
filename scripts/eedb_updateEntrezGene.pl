#!/usr/local/bin/perl -w

=head1 NAME - eedb_updateEntrezGene.pl

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

use Bio::SeqIO;
use Bio::SimpleAlign;
use Bio::AlignIO;
use File::Temp;

use EEDB::Database;
use MQdb::MappedQuery;

use EEDB::FeatureSource;
use EEDB::EdgeSource;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Assembly;
use EEDB::Chrom;
use EEDB::ExpressionSource;
use EEDB::Expression;
use EEDB::MetadataSet;

no warnings 'redefine';
$| = 1;

my $help;
my $passwd = '';

my $assembly_name = undef;
my $url = undef;
my $gff_file = undef;
my $deprecate_file = undef;
my $brief_file = undef;
my $summary_file = undef;
my $fsrc_name = undef;
my $debug = 0;
my $store = 1;

GetOptions( 
    'url:s'        =>  \$url,
    'debug:s'      =>  \$debug,
    '-v'           =>  \$debug,
    'assembly:s'   =>  \$assembly_name,
    'fsrc:s'       =>  \$fsrc_name,
    'gff:s'        =>  \$gff_file,
    'deprecate:s'  =>  \$deprecate_file,
    'brief:s'      =>  \$brief_file,
    'summary:s'    =>  \$summary_file,
    'pass:s'       =>  \$passwd,
    'nostore'      =>  \$store,
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
my $entrez_source = EEDB::FeatureSource->fetch_by_category_name($eeDB, "Entrez_gene", $fsrc_name);
my $deprecate_source = EEDB::FeatureSource->fetch_by_category_name($eeDB, "Entrez_gene_old", "deprecated_entrez_gene");

unless($assembly) { printf("error fetching assembly [%s]\n\n", $assembly_name); usage(); }
unless($entrez_source) { printf("error Entrez feature_source [%s]\n\n", $fsrc_name); usage(); }

printf("============\n");
$assembly->display_info;
$entrez_source->display_info;
$deprecate_source->display_info;
printf("============\n");

if(defined($gff_file)) {
  update_gff_features();
} 
elsif(defined($deprecate_file)) {
  deprecate_genes();
} 
elsif(defined($brief_file)) {
  update_from_entrez_brief();
} 
elsif(defined($summary_file)) {
  update_from_entrez_summary();
}
else { 
  printf("ERROR: must specify a data file to use for update\n\n");
  usage(); 
}

exit(1);

#########################################################################################

sub usage {
  print "eedb_updateEntrezGene.pl [options]\n";
  print "  -help              : print this help\n";
  print "  -url <url>         : URL to database\n";
  print "  -assembly <name>   : name of species/assembly (eg hg18 or mm9)\n";
  print "  -fsrc <name>       : name of entrez gene FeatureSource to load into\n";
  print "  -file <path>       : path to entrez gff data\n";
  print "  -summary <path>    : path to entrez 'summary' data dump file\n";
  print "  -brief <path>      : path to entrez 'brief' data dump file\n";
  print "  -deprecate <file>  : path to list of deprecated entrezIDs\n";
  print "eedb_updateEntrezGene.pl v1.0\n";
  
  exit(1);  
}

sub update_gff_features {
  
  my $linecount=0;
  open FILE, $gff_file;
  foreach my $line (<FILE>) {
    chomp($line);
    $line =~ s/\r//g;
    #chr15   Entrez  100132798       94471593        94671413        .       -       .       protein-coding
    my ($chr, $source, $entrezID, $start, $end, $thing1, $strand, $thing2, $biotype) = split(/\t/, $line);
    #printf("=====\n$line\n");
    if($start>$end) {
      my $t=$start;
      $start = $end;
      $end = $t;
    }
    if($strand eq 'UNKNOWN') { $strand =''; }

    my $chrom = EEDB::Chrom->fetch_by_name_assembly_id($eeDB, $chr, $assembly->id);
    my ($feature) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB, $entrez_source, $entrezID, 'EntrezID')};    
    if($feature) {
      #$chrom->display_info;
      my $old_loc = $feature->chrom_location;
      if($chrom) {
        $feature->chrom($chrom);
        $feature->chrom_start($start);
        $feature->chrom_end($end);
        $feature->strand($strand);
      }
      $feature->store_symbol('Entrez_type', $biotype);
      if($old_loc ne $feature->chrom_location) {
        $feature->update_location();
        my $fstr = sprintf("Feature(%s) %s %17s", $feature->id, $biotype, $feature->primary_name);
        printf("UPDATE LOC  :: %60s :: %s => %s\n", $fstr, $old_loc, $feature->chrom_location);
      }
    } else {
      my $feature = new EEDB::Feature;
      $feature->feature_source($entrez_source);
      $feature->chrom($chrom);
      $feature->chrom_start($start);
      $feature->chrom_end($end);
      $feature->strand($strand);
      $feature->primary_name($entrezID); #use the EntrezID for now

      $feature->add_symbol("EntrezID", $entrezID);

      ##$feature->store($eeDB);
      printf("NEW         ::  %s\n", $feature->display_desc);
    }
  }
}



sub deprecate_genes {

  my $linecount=0;
  open FILE, $deprecate_file;
  foreach my $line (<FILE>) {
    chomp($line);
    $line =~ s/\r//g;
    #TFh0001 chr13   31870545        31870687
    #Accession       chr     start   stop    strand  entrezID
    #AA000990        chr8    86245171        86245567        -       85444

    my ($entrezID) = split(/\t/, $line);
    #printf("=====\n$line\n");

    my ($entrez_feature) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB, $entrez_source, $entrezID, 'EntrezID')};    

    if(defined($entrez_feature) and ($entrez_feature->feature_source->id != $deprecate_source->id)) {
      deprecate_feature($entrez_feature);
    }
  }
}


sub deprecate_feature {
  my $feature = shift;
  
  return unless($feature);
  printf("DEPRECATE ::  %s\n", $feature->simple_display_desc);
  $eeDB->execute_sql("UPDATE feature SET feature_source_id=? WHERE feature_id=?", $deprecate_source->id, $feature->id);
  
  $feature = EEDB::Feature->fetch_by_id($eeDB, $feature->id);
  printf("    %s\n", $feature->simple_display_desc);  
}


#the brief is very basic, only really two useful bits of data, name and entrezID
# but a good way to make sure the 'list' is updated
# can be filled in later using the slower XML or ASN.1 method
sub update_from_entrez_brief {

  my $linecount=0;
  my $file_entrez = {};
  open FILE, $brief_file;
  foreach my $line (<FILE>) {
    chomp($line);
    $line =~ s/\r//g;
    #TFh0001 chr13   31870545        31870687
    next unless($line =~ /(\d+)\:\s+(\S*)(.+)\[GeneID\: (\d+)\]/);
    my $gene_count = $1;
    my $name = $2;
    my $entrezID = $4;
    $file_entrez->{$entrezID} = $name;
     
    printf("%7d ", $gene_count);
    my ($entrez_feature) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB, $entrez_source, $entrezID, 'EntrezID')};    
    if($entrez_feature) {
      if($entrez_feature->primary_name ne $name) {
        printf("NAME CHANGE :: %s=>%s : %s\n", $entrez_feature->primary_name, $name, $entrez_feature->simple_display_desc);
        #first make sure old name is in the symbol set 
        $entrez_feature->store_symbol('EntrezGene', $entrez_feature->primary_name);
        #then change primary_name
        $entrez_feature->store_symbol('EntrezGene', $name);
        $entrez_feature->primary_name($name);
        $entrez_feature->update_location();
      } else {
        printf("EXISTS      ::  %s\n", $entrez_feature->simple_display_desc);
      }
    } else {
      $entrez_feature = new EEDB::Feature;
      $entrez_feature->feature_source($entrez_source);
      $entrez_feature->primary_name($name);
      $entrez_feature->significance(0.0);
      $entrez_feature->add_symbol("EntrezID", $entrezID);
      $entrez_feature->add_symbol('EntrezGene', $name);

      $entrez_feature->store($eeDB);

      printf("NEW         ::  %s\n", $entrez_feature->display_desc);
    }
  }
  
  # now prune out those not in this list
  my $all_entrez = EEDB::Feature->fetch_all_by_source($eeDB, $entrez_source);
  printf("====\n%d genes in database\n", scalar(@$all_entrez));
  printf("%d genes in file\n", scalar(keys(%$file_entrez)));
  foreach my $feature (@$all_entrez) {
    my $entrez_sym = $feature->find_symbol('EntrezID');
    if(!defined($file_entrez->{$entrez_sym->[1]})) {
      printf("DEPRECATE ::  %s\n", $feature->display_desc);
    }
  }
}


sub update_from_entrez_summary {
  my $genecount=0;
  my $file_entrez = {};
  my $state = 0;
  my $locmove_count=0;
  
  my $unk_chrom = EEDB::Chrom->fetch_by_name_assembly_id($eeDB, 'unknown', $assembly->id);

  my $current_name = undef;
  my $current = {};
  my ($new_feature, $mdataset);
  #my $new_feature = new EEDB::Feature;
  #my $mdataset = new EEDB::MetadataSet;
  #my $mdataset = $new_feature->symbol_set;
  
  open FILE, $summary_file;
  
  my $line = <FILE>;
  $line =~ s/[\n\r]//g if(defined($line));

  while($state != -999) {
  
    if(!defined($line)) {
      if(defined($current->{'entrez_id'})) { $state = 3; } 
      else { $state = -999; }
    }

    #else { printf("state(%d) LINE:: %s\n", $state, $line); }

    switch($state) {
      case 0 { 
        #initial state no data in cache, waiting for trigger line
        if($line =~ /^(\d+)\:\s+(\S*)/) {
          #printf("\nfound start of record\n");
          $current = {};
          #$mdataset = new EEDB::MetadataSet;
          $new_feature = new EEDB::Feature;
          $new_feature->feature_source($entrez_source);
          $new_feature->chrom($unk_chrom);
          $mdataset = $new_feature->metadataset;
          
          $new_feature->primary_name($2);
          $mdataset->add_tag_symbol('EntrezGene', $2); 
          $current->{'name'} = $2;
          $current->{'record_num'} = $1;
          $current->{'chrom_start'} = -1;
          $current->{'chrom_end'} = -1;
          $current->{'strand'} = '';
          $state =1;
        }
        $line = <FILE>;
        $line =~ s/[\n\r]//g if(defined($line));
      }
      
      case 1 {
        #first line after the record head is a description line, sometimes with tag, sometimes no tag:
        $line =~ s/^\s*//g; #remove any leading space
        
        #but sometimes is is 'sort of' tagged
        if($line =~ /Official Symbol\s+(\S+).+Name\:\s+(.+)/) {
          $current->{'description'} = $2;
          #$mdataset->add_tag_symbol('description', $2); 
          $mdataset->add_tag_data('description', $2);
        } else {
          $current->{'description'} = $line;
          #$mdataset->add_tag_symbol('description', $line); 
          $mdataset->add_tag_data('description', $line);
        }
        $line = <FILE>;
        $line =~ s/[\n\r]//g if(defined($line));
        $state =2;
      }
      
      case 2 { 
        #inside a record need to parse each line into structure
        if($line =~ /^(\d+)\:\s+(\S*)/) { #hit the start of next record
          $state = 3;
        }
        else {
          if($line =~ /\s+Chromosome\:\s+([\dXYxyM]+)/) { 
            $current->{'chrom_name'} = 'chr'.$1; 
          }
          if($line =~ /Mitochondrion\:\s+(.*)/) { 
            $current->{'chrom_name'} = 'chrM';
          }
          if($line =~ /Location\:\s+(\S+)/) { 
            $current->{'cyto_loc'} = $1; 
            $mdataset->add_tag_symbol('GeneticLoc', $1); 
          }
          if($line =~ /\s+GeneID\:\s+(\d+)/) { 
            $current->{'entrez_id'} = $1; 
            $mdataset->add_tag_symbol('EntrezID', $1); 
          }
          if($line =~ /\s+MIM\:\s+(\d+)/) { 
            $current->{'omim'} = $1; 
            $mdataset->add_tag_symbol('OMIM', $1); 
          }
          if($line =~ /\s+Other Aliases\:\s+(.*)/) { 
            #Other Aliases: RP11-175B12.2, LOC731996
            my @aliases = split /[,;]/, $1;
            foreach my $alias (@aliases) {
              $alias =~ s/^\s*//g; #remove any leading space
              $current->{'aliases'}->{$alias} = 1;
              $mdataset->add_tag_symbol('Entrez_synonym', $alias); 
            }
          }
          if($line =~ /\s+Other Designations\:\s+(.*)/) { 
            #Other Designations: Avian myelocytomatosis viral (v-myc) oncogene homolog like 1; v-myc avian myelocytomatosis viral oncogene homolog-like 1
            #Other Designations: OTTHUMP00000018434
            my @designations = split /;/, $1;
            foreach my $desc (@designations) {
              $desc =~ s/^\s*//g; #remove any leading space
              push @{$current->{'other_desc'}}, $desc;
              #$mdataset->add_tag_symbol('alt_description', $desc); 
              $mdataset->add_tag_data('alt_description', $desc); 
            }
          }
          if($line =~ /\s+Annotation\:\s+(.*)/) {
            if(defined($current->{'full_loc'})) {
              #printf("ERROR: %s has multiple locations %s %s\n", $current->{'name'}, $1, $current->{'full_loc'});
              $current->{'alt_locs'}->{$1} = 1;
              $current->{'alt_locs'}->{$current->{'full_loc'}} = 1;
            }
            $current->{'full_loc'} = $1; 
            #$mdataset->add_tag_symbol('entrez_location', $1); 
            $mdataset->add_tag_data('entrez_location', $1); 

            #Chromosome 10NC_000010.9 (123227845..123347962, complement)
            if($current->{'full_loc'} =~ /(\d+)\.\.(\d+)/) {
              $current->{'chrom_start'} = $1;
              $current->{'chrom_end'} = $2;
              $current->{'strand'} = '+';
              $new_feature->chrom_start($1);
              $new_feature->chrom_end($2);
              $new_feature->strand('+');
            }
            if($current->{'full_loc'} =~ /complement/) {
              $current->{'strand'} = '-';
              $new_feature->strand('-');
            }
          }
          
          $line = <FILE>;
          $line =~ s/[\n\r]//g if(defined($line));
        }
      }
        
      case 3 { 
        #convert the structured data into database updates
        if(defined($current->{'cyto_loc'}) and !defined($current->{'chrom_name'})) {
          #NCBI gave us a cytochrome location but not a chromosome, so parse the chrom out
          if($current->{'cyto_loc'} =~ /^([XY\d]+)\s*$/) {
            $current->{'chrom_name'} = 'chr' . $1;
          }
          if($current->{'cyto_loc'} =~ /([XY\d]+)[pq]*/) {
            $current->{'chrom_name'} = 'chr' . $1;
          }
        }
        if($current->{'chrom_name'}) {
          my $chrom = EEDB::Chrom->fetch_by_name_assembly_id($eeDB, $current->{'chrom_name'}, $assembly->id);
          if($chrom) { 
            $new_feature->chrom($chrom);
          } else {
            #create the chromosome;
            my $chrom = new EEDB::Chrom;
            $chrom->chrom_name($current->{'chrom_name'});
            $chrom->assembly($assembly);
            $chrom->chrom_type('chromosome');
            $chrom->store($eeDB);
            printf("need to create chromosome :: %s", $chrom->display_desc);
          }
        }
        $mdataset->remove_duplicates;
        
        if($debug>1) {
          printf("\nupdate entrez record\n");
          printf("  recordnum:   [%s]\n", $current->{'record_num'});
          printf("  entrez_id:   [%s]\n", $current->{'entrez_id'});
          printf("  name:        [%s]\n", $current->{'name'});
          printf("  cyto_loc:    [%s]\n", $current->{'cyto_loc'}) if(defined($current->{'cyto_loc'}));
          printf("  full_loc:    [%s]\n", $current->{'full_loc'}) if(defined($current->{'full_loc'}));
          printf("  chrom:       [%s]\n", $current->{'chrom_name'}) if(defined($current->{'chrom_name'}));
          printf("  start:       [%s]\n", $current->{'chrom_start'}) if(defined($current->{'chrom_start'}));
          printf("  end:         [%s]\n", $current->{'chrom_end'}) if(defined($current->{'chrom_end'}));
          printf("  strand:      [%s]\n", $current->{'strand'}) if(defined($current->{'strand'}));
          printf("  OMIM:        [%s]\n", $current->{'omim'}) if(defined($current->{'omim'}));
          printf("  desc:        [%s]\n", $current->{'description'}) if(defined($current->{'description'}));
          if(defined($current->{'aliases'})) {
            foreach my $alias (keys(%{$current->{'aliases'}})) {
              printf("  alias:       [%s]\n", $alias);
            }
          }
          if(defined($current->{'aliases'})) {
            foreach my $desc (@{$current->{'other_desc'}}) {
              printf("  other_desc:  [%s]\n", $desc);
            }
          }
        }

        # now do the database checks and updates
        $genecount++;
        #printf("%7d ", $current->{'record_num'});
        my ($entrez_feature) = @{EEDB::Feature->fetch_all_by_source_symbol($eeDB, $entrez_source, $current->{'entrez_id'}, 'EntrezID')};    
        if($entrez_feature) {
          if($debug>2) { printf("%s", $entrez_feature->display_contents); }

          #do the location/name checks        
          if(defined($current->{'alt_locs'})) {
            printf("              MULTIPLE_LOCS: ");
            my $maxexpress = $entrez_feature->max_expression;            
            foreach my $mexp (@$maxexpress) {
              printf ("%s:%1.3f  ", $mexp->[0], $mexp->[1]);
            }
            printf(":: %s\n", $entrez_feature->simple_display_desc);
          }
          if($entrez_feature->primary_name ne $current->{'name'}) {
            printf("[%s]NAME CHANGE     :: %s => %s\n", $current->{'record_num'}, $entrez_feature->simple_display_desc, $current->{'name'});
            #first make sure old name is in the symbol set 
            #$entrez_feature->store_symbol('EntrezGene', $entrez_feature->primary_name);
            #then change primary_name
            #$entrez_feature->store_symbol('EntrezGene', $current->{'name'});
            $entrez_feature->primary_name($current->{'name'});
            $entrez_feature->update_location();
          } else {            
            #check for location change
            #if(defined($current->{'chrom_name'}) and
            #   (($entrez_feature->strand ne $current->{'strand'}) or
            #    ($entrez_feature->chrom_start ne $current->{'chrom_start'}) or
            #    ($entrez_feature->chrom_end ne $current->{'chrom_end'}) or
            #    ($entrez_feature->chrom_name ne $current->{'chrom_name'}))) {
            if($entrez_feature->chrom_location ne $new_feature->chrom_location) {
              if(($entrez_feature->strand eq $new_feature->strand) and $entrez_feature->check_overlap($new_feature)) {
                printf("[%s]WIGGLE          ::  %s => %s\n", $current->{'record_num'}, $entrez_feature->simple_display_desc, $new_feature->chrom_location);
                $entrez_feature->chrom_start($new_feature->chrom_start);
                $entrez_feature->chrom_end($new_feature->chrom_end);
                $entrez_feature->update_location();
                #printf("   after update: %s\n", $entrez_feature->simple_display_desc);
                $locmove_count++;
              } elsif(($entrez_feature->chrom->id eq $unk_chrom->id) or ($entrez_feature->chrom_start eq -1)) {
                printf("[%s]NEW MAP         ::  %s => %s\n", $current->{'record_num'}, $entrez_feature->simple_display_desc, $new_feature->chrom_location);
                $entrez_feature->chrom($new_feature->chrom);
                $entrez_feature->chrom_start($new_feature->chrom_start);
                $entrez_feature->chrom_end($new_feature->chrom_end);
                $entrez_feature->strand($new_feature->strand);
                $entrez_feature->update_location();
                #printf("   after update: %s\n", $entrez_feature->simple_display_desc);
                $locmove_count++;
              } elsif(($new_feature->chrom->id eq $unk_chrom->id) or ($new_feature->chrom_start eq -1)) {
                #printf("[%s]ignore unmaps   ::  %s => %s\n", $current->{'record_num'}, $entrez_feature->simple_display_desc, $new_feature->chrom_location);
              } else {
                printf("[%s]BIG MOVE        ::  %s => %s", $current->{'record_num'}, $entrez_feature->simple_display_desc, $new_feature->chrom_location);

                $entrez_feature->chrom($new_feature->chrom);
                $entrez_feature->chrom_start($new_feature->chrom_start);
                $entrez_feature->chrom_end($new_feature->chrom_end);
                $entrez_feature->strand($new_feature->strand);
                $locmove_count++;

                my $maxexpress = $entrez_feature->max_expression;
                if($maxexpress) {
                  printf("   max_express: ");    
                  foreach my $mexp (@$maxexpress) {
                    printf ("%s:%1.3f  ", $mexp->[0], $mexp->[1]);
                  }
                } else {
                  #no expression information on this gene so big movements don't matter
                  $entrez_feature->update_location();
                  print("\n  DO UPDATE!!!");
                }
                print("\n");
                #printf("       after update: %s\n", $entrez_feature->simple_display_desc);
              }
            } else {
              if($debug > 0) { printf("[%s]OK              ::  %s\n", $current->{'record_num'}, $entrez_feature->simple_display_desc); }
            }
          }

          #do the metadata check, merge in the new metadata into existing set
          if($debug>0) { printf("                =>  %s\n", $entrez_feature->simple_display_desc); }
          my $mds = $entrez_feature->metadataset;
          $mds->add_metadata(@{$new_feature->metadataset->metadata_list});
          $mds->remove_duplicates;
          my $mdata_list = $entrez_feature->metadataset->metadata_list;
          foreach my $mdata (@$mdata_list) {
            if(!defined($mdata->primary_id)) { 
              # this is a newly loaded metadata so it needs storage and linking
              $mdata->store($eeDB);
              $mdata->store_link_to_feature($entrez_feature);
              printf("  store/link %s\n", $mdata->display_contents);
            }
          }
          if($debug>1) {
            printf("=== after metadata store\n");
            printf("%s", $mds->display_contents);
          }

        } else {
          $new_feature->store($eeDB);
          printf("[%s]NEW             ::  %s\n", $current->{'record_num'}, $new_feature->simple_display_desc);
          my $mdata_list = $new_feature->metadataset->metadata_list;
          foreach my $mdata (@$mdata_list) {
            if(!defined($mdata->primary_id)) { 
              # this is a newly loaded metadata so it needs storage and linking
              $mdata->store($eeDB);
              $mdata->store_link_to_feature($new_feature);
              printf("  store/link %s\n", $mdata->display_contents);
            }
          }
        }


        #clear the old structure
        $current = {};
        $mdataset = undef;
        $state = 0;
        if(!defined($line)) { $state = -999; }
      }
      
    }
  }
  printf("MOVED stats : %d / %d = %1.2f%%\n", $locmove_count, $genecount, 100.0*$locmove_count/$genecount);
}


