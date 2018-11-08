#!/usr/bin/perl -wT
BEGIN{
    my $ROOT = '/data/www/html/nw2006/edgedb/cgi/src';
    unshift(@INC, "$ROOT/bioperl/bioperl-1.5.2-RC3");
    unshift(@INC, "$ROOT/CPAN-JMS");;
    unshift(@INC, "$ROOT/riken_gsc/TagAS/modules");
    unshift(@INC, "$ROOT/ensembl/ensembl_main/ensembl/modules");
}

use strict;
use CGI qw(:standard);
use CGI::Carp qw(warningsToBrowser fatalsToBrowser);

use strict;
use warnings;
use Getopt::Long;
use Data::Dumper;
use Switch;
use Time::HiRes qw(time gettimeofday tv_interval);

use Bio::SeqIO;
use Bio::SimpleAlign;
use Bio::AlignIO;
use File::Temp;

use JMS::Database;
use JMS::MappedQuery;
use EEDB::Feature;
use EEDB::FeatureLink;

my $known  = 0;
my $sqlite = 0;
my $rnaDB;

my $feature_id = param('id');
my $id_list = param('ids');
my $name_list = param('names');
my $format = param('format');


$rnaDB = JMS::Database->new(
				'-host'=>'localhost', 
				'-port'=>'3306', 
				'-user'=>'read', 
				'-password'=>'read', 
				'-database'=>'f4_goi'); 

EEDB::Feature->set_cache_behaviour(1);

my $connection_count = 0;
  
fetch_edges();

exit(1);
#########################################################################################

sub fetch_edges {
  my $starttime = time()*1000;

  print header(-type => "text/plain", -charset=> "UTF8");
  my $feature_hash = {};

  my $feature = EEDB::Feature->fetch_by_id($rnaDB, $feature_id);

  my $edges = [];
  if($feature_id) {
    $edges = EEDB::FeatureLink->fetch_all_visible_with_feature_id($rnaDB, $feature_id);
  } elsif($id_list) {
    $edges = EEDB::FeatureLink->fetch_all_visible_with_feature_id_list($rnaDB, $id_list);
  } elsif($name_list) {
    my $entrez_source = EEDB::FeatureSource->fetch_by_category_name($rnaDB, "Entrez_gene", "Entrez_gene");
    my @names = split(/,/, $name_list);
    my @ids;
    foreach my $name (@names) {
      my $t_features = EEDB::Feature->fetch_all_by_primary_name($rnaDB, $name);
      foreach my $tfeat (@$t_features) {
        next unless($tfeat->feature_source->is_visible eq 'y');
        next unless($tfeat->feature_source->is_active eq 'y');
        push @ids, $tfeat->id;
      }
    }
    $id_list = join(',', @ids);
    $edges = EEDB::FeatureLink->fetch_all_visible_with_feature_id_list($rnaDB, $id_list);
  }
  
  #compress edges
  my $edge_hash = {};
  foreach my $edge (@{$edges}) {
    my $key = $edge->feature1_id ."_". $edge->feature2_id;
    my $lid = $edge->edge_source->id;
    if(($lid==4) || ($lid==11) || ($lid==47) || ($lid==36)) { 
      push @{$edge_hash->{$key}}, $edge;
    } else {
      print_edges($edge, $edge);
    }
  }

  foreach my $edges (values(%$edge_hash)) {
    my $edge = $edges->[0];
    print_edges($edge, @{$edges});
  }
   
}


sub print_edges {
  my $refedge = shift;
  my @supporting = @_;

  printf("%s\t%s\t",
          $refedge->left_feature->primary_name,
          $refedge->right_feature->primary_name,
          );
  my $uqsrc = {};
  foreach my $edge (@supporting) {
    $uqsrc->{source_alias($edge)} = 1;
  }
  printf("%s\t", join('_', sort(keys(%$uqsrc))));
  foreach my $edge (@supporting) {
    printf("%s_%1.3f,", source_alias($edge), $edge->weight);
  }
  print("\n");
}

sub source_alias {
  my $edge = shift;
  if($edge->edge_source->id == 11) { return 'ChIP'; }
  elsif($edge->edge_source->id == 47) { return 'pub'; }
  elsif($edge->edge_source->id == 40) { return 'siRNA'; }
  elsif($edge->edge_source->id == 36) { return 'CAGEtf'; }
  else { return $edge->edge_source->name; }
}


