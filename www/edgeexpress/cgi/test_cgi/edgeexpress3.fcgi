#!/usr/bin/perl -w
BEGIN{
    my $ROOT = '/usr/local';
    unshift(@INC, "$ROOT/bioperl/bioperl-1.5.2_102");
    unshift(@INC, "$ROOT/src/CPAN-JMS");;
    unshift(@INC, "$ROOT/src/TagAS2/modules");
    unshift(@INC, "$ROOT/src/ensembl/ensembl_main/ensembl/modules");
}

use CGI qw(:standard);
use CGI::Carp qw(warningsToBrowser fatalsToBrowser);
use CGI::Fast qw(:standard);

use strict;
use Getopt::Long;
use Data::Dumper;
use Switch;
use Time::HiRes qw(time gettimeofday tv_interval);
use POSIX qw(ceil floor);

use Bio::SeqIO;
use Bio::SimpleAlign;
use Bio::AlignIO;
use File::Temp;

use JMS::Database;
use JMS::MappedQuery;
use RIKEN::YHlab::TagAS::Feature;
use RIKEN::YHlab::TagAS::FeatureLink;
use RIKEN::YHlab::TagAS::FeatureExpression;
use RIKEN::YHlab::TagAS::LinkSet;
use RIKEN::YHlab::TagAS::FeatureSet;

my $connection_count = 0;
my $total_edge_count = 0;

my $eeDB = undef;
my ($gene_tfbs_lset, $tfbs_l2_lset, $l2_l3_lset, $l3_gene_lset, $trans_gene_lset);

my $entrez_source = undef;
my $tfmatrix_source = undef;
my $L2_source = undef;

my $gene_tfbs_source = undef;
my $tfbs_l2_source = undef;
my $l2_l3_source = undef;
my $l3_gene_source = undef;
my $trans_gene_source = undef;
my $mirbase_source = undef;

my $start_date = localtime();
my $launch_time = time();

while (my $fcgi_session = new CGI::Fast) {
  process_url_request($fcgi_session);
  $connection_count++;
}

##########################

sub process_url_request {
  my $fcgi_session = shift;

  $total_edge_count = 0;

  my $self = {};
  $self->{'feature_id'} = $fcgi_session->param('id');
  $self->{'edge_id'} = $fcgi_session->param('eid');
  $self->{'limit'} = $fcgi_session->param('limit');
  $self->{'ensfilter'} = $fcgi_session->param('ensfilter');
  $self->{'name'} = $fcgi_session->param('name');
  $self->{'source'} = $fcgi_session->param('source');
  $self->{'mode'} = $fcgi_session->param('mode');
  $self->{'savefile'} = $fcgi_session->param('save');
  $self->{'id_list'} = $fcgi_session->param('ids');
  $self->{'name_list'} = $fcgi_session->param('names');
  $self->{'cache'} = $fcgi_session->param('cache');
  $self->{'flush'} = $fcgi_session->param('flush');
  $self->{'loc'} = $fcgi_session->param('loc');
  $self->{'fsrc_filters'} = $fcgi_session->param('fsrc');

  if($self->{'fsrc_filters'}) {
    my @names = split /,/, $self->{'fsrc_filters'};
    foreach my $fsrc (@names) {
      $self->{'fsrc_hash'}->{$fsrc}=1;
    }
  }

  if(defined($fcgi_session->param('entrez_id'))) {
    $self->{'source'} = 'entrez_id';
    $self->{'name'} = $fcgi_session->param('entrez_id');
  }
  if(defined($fcgi_session->param('mat_mirna'))) {
    $self->{'source'} = 'mat_mirna';
    $self->{'name'} = $fcgi_session->param('mat_mirna');
  }
  if(defined($fcgi_session->param('pre_mirna'))) {
    $self->{'source'} = 'pre_mirna';
    $self->{'name'} = $fcgi_session->param('pre_mirna');
  }
  if(defined($fcgi_session->param('L2'))) {
    $self->{'source'} = 'L2';
    $self->{'name'} = $fcgi_session->param('L2');
  }
  if(defined($fcgi_session->param('L3'))) {
    $self->{'source'} = 'L3';
    $self->{'name'} = $fcgi_session->param('L3');
  }
  if(defined($self->{'name'}) and !defined($self->{'source'})) {
    $self->{'source'} = 'primaryname';
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'feature'; }
  }
  if(defined($self->{'loc'}) and !defined($self->{'mode'})) {
    $self->{'mode'} = 'region_gff';
  }
  if(defined($fcgi_session->param('search'))) {
    $self->{'mode'} = 'search';
    $self->{'name'} = $fcgi_session->param('search');
  }

  $self->{'mode'} ='edgeexpress' unless(defined($self->{'mode'}));
  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'limit'}=1000 unless(defined($self->{'limit'}));
  $self->{'ensfilter'}=1 unless(defined($self->{'ensfilter'}));


  ##### 
  # now process
  #
  if(!defined($eeDB)) {
    init_db($self);
  } 
  if(defined($self->{'flush'})) {
    RIKEN::YHlab::TagAS::Feature->set_cache_behaviour(0);
    RIKEN::YHlab::TagAS::Feature->set_cache_behaviour(1);
    RIKEN::YHlab::TagAS::FeatureLink->set_cache_behaviour(0);
    RIKEN::YHlab::TagAS::FeatureLink->set_cache_behaviour(1);
    RIKEN::YHlab::TagAS::FeatureLinkSource->set_cache_behaviour(0);
    RIKEN::YHlab::TagAS::FeatureLinkSource->set_cache_behaviour(1);
    RIKEN::YHlab::TagAS::FeatureSource->set_cache_behaviour(0);
    RIKEN::YHlab::TagAS::FeatureSource->set_cache_behaviour(1);
    $gene_tfbs_lset = undef;
    $tfbs_l2_lset = undef;
    $l2_l3_lset = undef;
    $l3_gene_lset = undef;
    $trans_gene_lset = undef;

    $entrez_source = undef;
    $tfmatrix_source = undef;
    $L2_source = undef;
    $mirbase_source = undef;

    $gene_tfbs_source = undef;
    $tfbs_l2_source = undef;
    $l2_l3_source = undef;
    $l3_gene_source = undef;
    $trans_gene_source = undef;
  }
  if(defined($self->{'cache'})) {
    cache_all_features($self);
    #cache_linksets($self);
  }

  if(defined($self->{'name'}) and ($self->{'mode'} eq 'search')) {
    search_feature($self);
    return;
  }
  if(defined($self->{'name'}) and !defined($self->{'feature_id'})) {
    get_id_from_name($self);
    if(!defined($self->{'feature_id'})) {
      search_feature($self);
      return;
    }
  }

  if($self->{'mode'} eq 'network') { 
    fetch_network($self); 
  } elsif(defined($self->{'loc'})) {
    fetch_named_region($self); 
  } elsif(defined($self->{'feature_id'})) {
    if($self->{'mode'} eq 'edgeexpress') { fetch_eedb_feature($self); }
    elsif(($self->{'mode'} eq 'express_xml') or ($self->{'mode'} eq 'express_tsv')) { 
      export_feature_expression($self);
    }
    elsif($self->{'mode'} eq 'edges') { fetch_edges($self); }
    elsif($self->{'mode'} eq 'genemodel') { get_genemodel($self); }
    elsif($self->{'mode'} eq 'feature') { get_singlenode($self); }
    else { show_fcgi($fcgi_session); }
  } elsif(defined($self->{'edge_id'})) {
    fetch_edges($self);
  } elsif(defined($self->{'fsrc_hash'})) {
    fetch_feature_source($self);
  } else {
    show_fcgi($fcgi_session);
    #printf("ERROR : URL improperly formed\n");
  }
}


sub show_fcgi {
  my $fcgi_session = shift;

  my $id = $fcgi_session->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  print header;
  print start_html("EdgeExpressDB Fast CGI object server");
  print h1("Fast CGI object server (perl)");
  print p("edgeexpress.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  print hr;

  #if(defined($id)) { printf("<h2>id = %d</h2>\n", $id); }
  print("<table border=1 cellpadding=10><tr>");
  printf("<td>%d features in cache</td>", RIKEN::YHlab::TagAS::Feature->get_cache_size);
  printf("<td>%d links in cache</td>", RIKEN::YHlab::TagAS::FeatureLink->get_cache_size);
  print("</tr></table>");
  
  show_api($fcgi_session);
  print end_html;
}

sub show_api {
  my $fcgi_session = shift;
  
  print hr;
  print h2("Object access methods");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>id=[number]</td><td>directly access a 'feature' by it's internal id.  useful for linking between subsystems</td></tr>\n");
  print("<tr><td>eid=[number]</td><td>directly access an 'edge' by it's internal id.  useful for linking between subsystems</td></tr>\n");
  print("<tr><td>name=[string]</td><td>does search on feature's primary name, returns first occurance. \n");
  print("since primary name is not required to be unique in database, this method is only useful for debugging and is not guaranteed\n");
  print("to be rebust or reproducible for data modes.</td></tr>\n");
  print("<tr><td>search=[name]</td><td>does a metadata search for all matching features and returns compact list in XML</td></tr>\n");
  print("<tr><td>loc=[location]</td><td>does genome location search and returns all features overlapping region. default output mode=region_gff<br>loc is format: chr17:75427837..75427870</td></tr>\n");
  print("</table>\n");

  print h2("Output modes");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>mode=edgeexpress</td><td>[default] returns center feature with FANTOM4 edge information</td></tr>\n");
  print("<tr><td>mode=feature</td><td>returns feature(s) with metadata in eeDB xml format</td></tr>\n");
  print("<tr><td>mode=genemodel</td><td>returns feature(s) with metadata in eeDB xml format, \n");
  print("if node has 'transcript' or 'promoter' edges coming in, then these are also exported</td></tr>\n");
  print("<tr><td>mode=edges</td><td>works only with single feature access, returns all incoming and outgoing edges to the node in XML</td></tr>\n");
  print("<tr><td>mode=express_tsv</td><td>returns normalized expression for center feature and 'expression features'</td></tr>\n");
  print("<tr><td>mode=express_xml</td><td>returns full XML expression for center feature and 'expression features'</td></tr>\n");
  print("<tr><td>mode=region_gff</td><td>must be paired with loc=xxx. returns GFF3 output of features in region</td></tr>\n");
  print("<tr><td>mode=region_xml</td><td>must be paired with loc=xxx. returns XML output of fetures in region</td></tr>\n");
  print("</table>\n");

  print h2("options");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>fsrc_filters=[source,source]</td><td>use feature source names to filter loc=xxx results</td></tr>\n");
  print("</table>\n");
}

#########################################################################################

sub fetch_eedb_feature {
  my $self = shift;

  my $feature = RIKEN::YHlab::TagAS::Feature->fetch_by_id($eeDB, $self->{'feature_id'});
  unless($feature->feature_source->is_active) {
    print header;
    print start_html("EdgeExpressDB Fast CGI object server");
    printf ("<h3>feature id=%d is not active</h3>", $feature->id);
    print end_html;
    return;
  }

  if($self->{'mode'} eq 'edgeexpress') {
    if($self->{'savefile'} eq 'true') {
      my $filename = $feature->primary_name . ".xml";
      print header(-type => "text/xml", -charset=> "UTF-8", -attachment=>$filename);
    } else {
      print header(-type => "text/xml", -charset=> "UTF-8");
    }   
  } else {
    print header(-type => "text/plain");
  }
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  my $starttime = time()*1000;
  printf("<EEDB>\n");

  display_full_feature($self, $feature);

  show_TFBS_prediction_edges($self, $feature);


  my $promoter_center = 0;
  #if($feature->feature_source->category =~ "promoter") { $promoter_center =1; }
  if($feature->feature_source->category =~ "matrix") { $promoter_center =1; }

  my @gene2gene_edges = ();
  my @mirna_edges = ();
  my @protein_edges = ();
  my @experiment_edges = ();
  my @chip_edges = ();
  my @perturbation_edges = ();
  my $incoming_shortcuts = {};

  #my $edges = RIKEN::YHlab::TagAS::FeatureLink->fetch_all_visible_with_feature_id($eeDB, $self->{'feature_id'});
  my $edges = $feature->all_links->links;
  foreach my $edge (@{$edges}) {

    next unless($edge->link_source->is_active);
    next unless($edge->link_source->is_visible);

    next unless($edge->left_feature);
    next unless($edge->right_feature);

    my ($dir, $neighbor) = $edge->get_neighbor($feature);

    #store the income Entrez_TFmatrix_L2_Entrez shortcuts in a hash
    #but don't actually display yet
    if(($dir eq "link_from") and 
       ((($edge->link_source->id >= 36) and ($edge->link_source->id <= 39)) or ($edge->link_source->id == 44) or ($edge->link_source->id == 45))) {
      my $sym = $edge->metadataset->find_metadata("CAGE_promoter", undef);
      next unless($sym);
      if(!defined($incoming_shortcuts->{$sym->data})) {
        $incoming_shortcuts->{$sym->data} = [$edge];
      } else {
        push @{$incoming_shortcuts->{$sym->data}}, $edge;
      }
      next;
    }
    #skip Entrez_TFBS_L3_Entrez edges coming into this feature
    next if(($edge->link_source->id == 24) and ($dir eq "link_from"));

    #skip the december shortcuts for now
    next if(($edge->link_source->id >= 35) and ($edge->link_source->id <= 39));

    #skip the non-best shortcuts
    next if(($edge->link_source->id == 36) and ($edge->link_type ne 'best'));

    #skip the (38) Entrez_TFmatrix_L2anti_Entrez shortcut going out
    next if(($edge->link_source->id == 38) and ($dir eq 'link_to'));

    if($edge->link_type eq "PP") {
      push @protein_edges, $edge;
    } elsif($edge->link_source->name eq "ChIP_chip") {
      push @chip_edges, $edge;
    } elsif($edge->link_source->name =~ /perturbation/) {
      push @perturbation_edges, $edge;
    } elsif($edge->link_source->classification eq "Experimental") {
      push @experiment_edges, $edge;
    } elsif(($edge->link_source->id == 46) ||
            ($neighbor->feature_source->id == 30) ||
            ($neighbor->feature_source->id == 45) ||
            ($neighbor->feature_source->id == 46)) {
      push @mirna_edges, $edge;
    } elsif($neighbor->feature_source->category =~ "gene") { 
      push @gene2gene_edges, $edge;
    } else {
      push @gene2gene_edges, $edge;
    }
  }

  #
  # other edges by each class
  #
  printf("<miRNA_edges count=\"%d\" >\n", scalar(@mirna_edges));
  foreach my $edge (sort {($b->weight <=> $a->weight) || ($a->id <=> $b->id)} @mirna_edges) {
    show_edge($feature, $edge);
  }
  printf("</miRNA_edges>\n");

  printf("<ppi_edges count=\"%d\" >\n", scalar(@protein_edges));
  foreach my $edge (sort {($b->weight <=> $a->weight) || ($a->id <=> $b->id)} @protein_edges) {
    show_edge($feature, $edge);
  }
  printf("</ppi_edges>\n");

  printf("<experiment_edges count=\"%d\" >\n", scalar(@experiment_edges));
  foreach my $edge (sort {($b->weight <=> $a->weight) || ($a->id <=> $b->id)} @experiment_edges) {
    show_edge($feature, $edge);
  }
  printf("</experiment_edges>\n");

  printf("<chipchip_edges count=\"%d\" >\n", scalar(@chip_edges));
  foreach my $edge (sort {($b->weight <=> $a->weight) || ($a->id <=> $b->id)} @chip_edges) {
    show_edge($feature, $edge);
  }
  printf("</chipchip_edges>\n");

  printf("<perturbation_edges count=\"%d\" >\n", scalar(@perturbation_edges));
  foreach my $edge (sort {($b->weight <=> $a->weight) || ($a->id <=> $b->id)} @perturbation_edges) {
    show_edge($feature, $edge);
  }
  printf("</perturbation_edges>\n");

  printf("<gene2gene_edges count=\"%d\" >\n", scalar(@gene2gene_edges));
  foreach my $edge (sort {($b->weight <=> $a->weight) || ($a->left_feature->primary_name cmp $b->left_feature->primary_name)} @gene2gene_edges) {
    show_edge($feature, $edge);
  }
  printf("</gene2gene_edges>\n");


  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary edge_count=\"%d\" processtime_sec=\"%1.3f\" />\n", $total_edge_count, $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n", 
                  $connection_count, $$,
                  RIKEN::YHlab::TagAS::Feature->get_cache_size,
                  RIKEN::YHlab::TagAS::FeatureLink->get_cache_size);
  printf("</EEDB>\n");
}

sub show_edge {
  my $feature = shift;
  my $edge = shift;
  
  $total_edge_count++;

  my ($dir, $neighbor) = $edge->get_neighbor($feature);
  if($edge->link_type eq "PP") { $dir="link"; }

  printf("<$dir feature_id=\"%d\" name=\"%s\" weight=\"%1.3f\" source=\"%s\" evidence_code=\"%s\" loc=\"%s:%d-%d\" ",
               $neighbor->id,
               $neighbor->primary_name,
               $edge->weight,
               $edge->link_source->name,
               $edge->link_source->classification,
               $neighbor->chrom_name,
               $neighbor->chrom_start,
               $neighbor->chrom_end
               );
  if(($edge->link_type ne '') and ($edge->link_type ne 'best')) {
    printf(" type=\"%s\"  ", $edge->link_type);
  }

  my @pubmed;
  if(lc($edge->link_type) eq 'published') {
    my @symbols = @{$edge->metadataset->metadata_list};
    foreach my $symbol (@symbols) {
      if($symbol->type eq 'PubmedID') { push @pubmed, $symbol->data; }
    }
  }
  if(scalar(@pubmed) > 0) {
    printf("pubmed=\"%s\" ", join(',', @pubmed));
  }

  my $sym = $edge->metadataset->find_metadata("CAGE_promoter", undef);
  if($sym) { printf("promoter=\"%s\" ", $sym->data); }

  $sym = $edge->metadataset->find_metadata("CAGE_L3_promoter", undef);
  if($sym) { printf("L3promoter=\"%s\" ", $sym->data); }

  $sym = $edge->metadataset->find_metadata("TFmatrix", undef);
  if($sym) { printf("tfmatrix=\"%s\" ", $sym->data); }

  printf(" />\n");

}

sub cache_all_features {
  my $self = shift;
  
  print header;
  print start_html("edgeexpress.fcgi");
  print
      p("really initialize the edgeexpress.fcgi caches"),
      "Invocation number ",b($connection_count),
      " PID ",b($$),".",
      hr;

  RIKEN::YHlab::TagAS::Feature->set_cache_behaviour(1);

  my $time1 = time();
  my $time2 = time();
  my $new_fetch_count=0;

  printf("<br>start fetch: %d features in cache\n", RIKEN::YHlab::TagAS::Feature->get_cache_size);
  my $starttime = time();

  if(!defined($entrez_source)) {
    $time2 = time();
    $entrez_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "gene", "Entrez_gene");
    printf("<br><br>%s\n", $entrez_source->display_desc);
    my $gf = RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $entrez_source);
    $new_fetch_count += scalar(@$gf);
    printf("<br>fetched %d in %1.3f secs :: %d in cache\n", scalar(@$gf),  (time() - $time2), RIKEN::YHlab::TagAS::Feature->get_cache_size);
  }

  if(!defined($tfmatrix_source)) {
    $time2 = time();
    $tfmatrix_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "TFBS_matrix", "TFBS_matrix_may08");
    printf("<br><br>%s\n", $tfmatrix_source->display_desc);
    my $mf = RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $tfmatrix_source);
    $new_fetch_count += scalar(@$mf);
    printf("<br>fetched %d in %1.3f secs :: %d in cache\n", scalar(@$mf),  (time() - $time2), RIKEN::YHlab::TagAS::Feature->get_cache_size);
  }

  if(!defined($L2_source)) {
    $time2 = time();
    $L2_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "L2_promoter", "CAGE_L2_promoter_april08");
    printf("<br><br>%s\n", $L2_source->display_desc);
    my $lf = RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $L2_source);
    $new_fetch_count += scalar(@$lf);
    printf("<br>fetched %d in %1.3f secs :: %d in cache\n", scalar(@$lf),  (time() - $time2), RIKEN::YHlab::TagAS::Feature->get_cache_size);
  }

  if(!defined($mirbase_source)) {
    $time2 = time();
    $mirbase_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "miRBase", "miRBase_pre");
    printf("<br><br>%s\n", $mirbase_source->display_desc);
    my $mf = RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $mirbase_source);  
    $new_fetch_count += scalar(@$mf);
    printf("<br>fetched %d in %1.3f secs :: %d in cache\n", scalar(@$mf),  (time() - $time2), RIKEN::YHlab::TagAS::Feature->get_cache_size);
  }


  printf("<br><br>TOTAL fetched %d in %1.3f secs :: %d in cache\n", $new_fetch_count,  (time() - $starttime), RIKEN::YHlab::TagAS::Feature->get_cache_size);
  printf("<br>total feature cache load time :: %1.3f secs\n<hr>", (time() - $time1));
  print end_html;
}

sub init_db {
  my $self = shift;
  
  $eeDB = JMS::Database->new( '-host'=>'fantom40.gsc.riken.jp',
                               '-port'=>'3306',
                               '-user'=>'read',
                               '-password'=>'read',
                               '-database'=>'f4_goi');

  RIKEN::YHlab::TagAS::Feature->set_cache_behaviour(1);
  RIKEN::YHlab::TagAS::FeatureLink->set_cache_behaviour(1);
}


sub get_id_from_name {
  my $self = shift;

  return unless(defined($self->{'name'}));

  ## print header;
  ## print start_html("EdgeExpressDB Fast CGI object server");
  ## printf("<h2>doing name lookup</h2>");
  ## printf("<br>name = (%s)<br>\n", $self->{'name'});
  
  my $fsource =undef;
  my $features = [];
  if(uc($self->{'source'}) eq 'L2') {
    $fsource = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "L2_promoter", "CAGE_L2_promoter_april2008");
    ## $fsource->display_info;
    $features = RIKEN::YHlab::TagAS::Feature->fetch_all_by_primary_name($eeDB, $self->{'name'}, $fsource);
  }
  elsif(uc($self->{'source'}) eq 'L3') {
    $fsource = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "L3_promoter", "CAGE_L3_promoter_april2008");
    ## $fsource->display_info;
    $features = RIKEN::YHlab::TagAS::Feature->fetch_all_by_primary_name($eeDB, $self->{'name'}, $fsource);
  }
  elsif(lc($self->{'source'}) eq 'entrez_id') {
    $fsource = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "gene", "Entrez_gene");
    ## $fsource->display_info;
    $features = RIKEN::YHlab::TagAS::Feature->fetch_all_by_source_symbol($eeDB, $fsource, $self->{'name'}, 'EntrezID');
  }
  elsif(lc($self->{'source'}) eq 'mat_mirna') {
    $fsource = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "miRBase", "miRBase_mature");
    ## $fsource->display_info;
    $features = RIKEN::YHlab::TagAS::Feature->fetch_all_by_primary_name($eeDB, $self->{'name'}, $fsource);
  }
  elsif(lc($self->{'source'}) eq 'pre_mirna') {
    $fsource = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "miRBase", "miRBase_pre");
    ## $fsource->display_info;
    $features = RIKEN::YHlab::TagAS::Feature->fetch_all_by_primary_name($eeDB, $self->{'name'}, $fsource);
  }
  elsif(lc($self->{'source'}) eq 'primaryname') {
    $features = RIKEN::YHlab::TagAS::Feature->fetch_all_by_primary_name($eeDB, $self->{'name'});
  }
  
  my $count=0;
  my $the_feature = undef;
  foreach my $feature (@$features) {
    next if(defined($fsource) and ($feature->feature_source->id != $fsource->id));
    next unless($feature->feature_source->is_active eq 'y');
    next unless($feature->feature_source->is_visible eq 'y');
    next if(defined($self->{'fsrc_hash'}) and !($self->{'fsrc_hash'}->{$feature->feature_source->name}));
    $count++;
    $the_feature = $feature;
  }
  if($count==1 and defined($the_feature)) {
    #printf("<br>"); $the_feature->display_info;
    $self->{'feature_id'} = $the_feature->id;
  }

  ## print end_html;
}

#########################################################################################

sub export_feature_expression {
  my $self = shift;

  my $starttime = time()*1000;

  my $feature = RIKEN::YHlab::TagAS::Feature->fetch_by_id($eeDB, $self->{'feature_id'});
  if($self->{'mode'} eq 'express_tsv') { 
    if($self->{'savefile'}) { 
      my $filename = $feature->primary_name . "_expression.tsv";
      print header(-type => "text/plain", -attachment=>$filename);
    } else {
      print header(-type => "text/plain");
    }
  } else {
    if($self->{'savefile'}) { 
      my $filename = $feature->primary_name . "_expression.xml";
      print header(-type => "text/xml", -charset=> "UTF8", -attachment=>$filename);
    } else {
      print header(-type => "text/xml", -charset=> "UTF8");
    }
    printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    printf("<features>\n");
  }

  #
  #first the primary feature
  #
  if($self->{'mode'} eq 'express_tsv') { 
    export_expression_tsv($self, $feature, $feature); 
  } else { 
    if($feature->feature_source->category eq 'gene') {
      printf("<genemodel>\n");
      display_full_feature($self, $feature);
      printf("</genemodel>\n");
    } else { 
      unless(show_expression_xml($self, $feature)) {
        print($feature->xml);
      };
    }
  }

  my $edges = $feature->left_links->links;
  my @sort_edges;
  if($feature->strand eq "+") {
    @sort_edges = sort {(($a->link_source->name cmp $b->link_source->name) or ($a->left_feature->chrom_start <=> $b->left_feature->chrom_start))} @$edges;
  } else {
    @sort_edges = sort {(($a->link_source->name cmp $b->link_source->name) or ($b->left_feature->chrom_start <=> $a->left_feature->chrom_start))} @$edges;
  }

  foreach my $edge (@sort_edges) {
    next unless($edge->link_source->is_active);
    if($self->{'mode'} eq 'express_tsv') { export_expression_tsv($self, $edge->left_feature, $feature); }
    else { show_expression_xml($self, $edge->left_feature, $edge); }
  }

  if($self->{'mode'} ne 'express_tsv') { 
    my $total_time = (time()*1000) - $starttime;
    printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
    printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  RIKEN::YHlab::TagAS::Feature->get_cache_size,
                  RIKEN::YHlab::TagAS::FeatureLink->get_cache_size);
    printf("</features>\n"); 
  }
}


sub export_expression_tsv {
  my $self = shift;
  my $feature = shift;
  my $gene = shift;

  my $express = RIKEN::YHlab::TagAS::FeatureExpression->fetch_all_by_feature_id($eeDB, $feature->id);
  my $experiment = undef;
  my @exps;
  printf("\n%s\t%s\t%s\t%s",  "platform", "gene", "promoter", "library");
  foreach my $fexp (sort {(($a->experiment->platform cmp $b->experiment->platform) ||
                           ($a->experiment->library_name cmp $b->experiment->library_name) ||
                           ($a->experiment->time_point_hr <=> $b->experiment->time_point_hr)) } @$express) {
    if(!defined($experiment)) { $experiment = $fexp->experiment; }
    if(($experiment->platform ne $fexp->experiment->platform) or ($experiment->library_name ne $fexp->experiment->library_name)) { last; }
    printf("\t%shr", $fexp->experiment->time_point_hr);
  }

  $experiment = undef;
  foreach my $fexp (sort {(($a->experiment->platform cmp $b->experiment->platform) ||
                           ($a->experiment->library_name cmp $b->experiment->library_name) ||
                           ($a->experiment->time_point_hr <=> $b->experiment->time_point_hr)) } @$express) {
    my $changed = 0;
    if(!defined($experiment)) { $changed = 1; }
    else {
      if($experiment->platform ne $fexp->experiment->platform) { $changed=1; }
      if($experiment->library_name ne $fexp->experiment->library_name) { $changed=1; }
    }
    
    if($changed) { 
      printf("\n%s\t%s\t%s\t%s\t", 
           $fexp->experiment->platform,
           $gene->primary_name,
           $feature->primary_name,
           $fexp->experiment->library_name);
    }
    printf("%f\t", $fexp->norm_express);
    $experiment = $fexp->experiment;
  }
}


sub show_expression_xml {
  my $self = shift;
  my $feature = shift;
  my $edge = shift;

  return undef unless($feature);
  my $express = RIKEN::YHlab::TagAS::FeatureExpression->fetch_all_by_feature_id($eeDB, $feature->id);
  return undef unless(scalar(@$express)>0);

  print("<feature_express>\n");
  if($edge) { print($edge->simple_xml); }
  print($feature->xml);

  foreach my $fexp (sort {$a->experiment->id <=> $b->experiment->id} @$express) {
    print($fexp->simple_xml);
  }
  print("</feature_express>\n");
  return 1;
}


#########################################################################################

sub fetch_edges {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<edges>\n");

  my $lset = new RIKEN::YHlab::TagAS::LinkSet;
  if($self->{'edge_id'}) {
    my $edge = RIKEN::YHlab::TagAS::FeatureLink->fetch_by_id($eeDB, $self->{'edge_id'});
    $lset->add_link($edge);
  } else {
    my $feature = RIKEN::YHlab::TagAS::Feature->fetch_by_id($eeDB, $self->{'feature_id'});
    $lset = $feature->all_links;
  }

  my $count=0;
  foreach my $edge (@{$lset->links}) {
    next unless($edge->link_source->is_visible);
    $count++;
    print($edge->xml);
  }
  printf("<edgecount prefilter=\"%d\" cnt=\"%d\" />\n", $lset->count, $count);
  printf("</edges>\n");
}

#########################################################################################

sub fetch_network {
  my $self = shift;

  my $starttime = time()*1000;
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  printf("<network>\n");
  my $feature_hash = {};

  printf("<edges>\n");
  my $feature = RIKEN::YHlab::TagAS::Feature->fetch_by_id($eeDB, $self->{'feature_id'});

  my $edges = [];
  if($feature) {
    $edges = RIKEN::YHlab::TagAS::FeatureLink->fetch_all_visible_with_feature_id($eeDB, $feature->id);
  } elsif($self->{'id_list'}) {
    printf("<id_list>%s</id_list>\n", $self->{'id_list'});
    $edges = RIKEN::YHlab::TagAS::FeatureLink->fetch_all_visible_with_feature_id_list($eeDB, $self->{'id_list'});
  } elsif($self->{'name_list'}) {
    my $entrez_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "Entrez_gene", "Entrez_gene");
    my @names = split(/,/, $self->{'name_list'});
    my @ids;
    foreach my $name (@names) {
      my ($feature) = @{RIKEN::YHlab::TagAS::Feature->fetch_all_by_primary_name($eeDB, $name, $entrez_source)};
      if($feature) { push @ids, $feature->id; }
    }
    my $id_list = join(',', @ids);
    printf("<name_list>%s</name_list>\n", $self->{'name_list'});
    printf("<id_list>%s</id_list>\n", $id_list);
    $edges = RIKEN::YHlab::TagAS::FeatureLink->fetch_all_visible_with_feature_id_list($eeDB, $id_list);
  }

  printf("<edgecount cnt=\"%d\" />\n", scalar(@$edges));
  foreach my $edge (@{$edges}) {
    $feature_hash->{$edge->feature1_id} = $edge->left_feature;
    $feature_hash->{$edge->feature2_id} = $edge->right_feature;
    simple_edge_xml($edge);
  }
  printf("</edges>\n");

  printf("<nodes count=\"%s\">\n", scalar(values(%$feature_hash)));
  foreach my $feature (values(%$feature_hash)) {
    print($feature->xml);
  }
  printf("</nodes>\n");

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  RIKEN::YHlab::TagAS::Feature->get_cache_size,
                  RIKEN::YHlab::TagAS::FeatureLink->get_cache_size);

  printf("</network>\n");
}


sub simple_edge_xml {
  my $edge = shift;

  printf("<edge f1id=\"%s\" f2id=\"%s\" dir=\"%s\" weight=\"%1.3f\" source=\"%s\" evidence_code=\"%s\" subtype=\"%s\" edge_id=\"%d\"",
               $edge->feature1_id,
               $edge->feature2_id,
               $edge->direction,
               $edge->weight,
               $edge->link_source->name,
               $edge->link_source->classification,
               $edge->link_type,
	       $edge->id,
               );

  my $syms = $edge->metadataset->metadata_list;
  foreach my $symbol (@$syms) {
    printf(" %s=\"%s\"", $symbol->type, $symbol->data);
  }
  printf("/>\n");
}

#########################################################################################

sub get_genemodel {
  my $self = shift;

  my $starttime = time()*1000;
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  my $feature = RIKEN::YHlab::TagAS::Feature->fetch_by_id($eeDB, $self->{'feature_id'});

  printf("<features>\n");
  printf("<genemodel>\n");
  display_full_feature($self, $feature);
  printf("</genemodel>\n");

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  RIKEN::YHlab::TagAS::Feature->get_cache_size,
                  RIKEN::YHlab::TagAS::FeatureLink->get_cache_size);

  printf("</features>\n");
}

sub get_singlenode {
  my $self = shift;

  my $starttime = time()*1000;
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  my $feature = RIKEN::YHlab::TagAS::Feature->fetch_by_id($eeDB, $self->{'feature_id'});

  printf("<features>\n");
  print($feature->xml);

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  RIKEN::YHlab::TagAS::Feature->get_cache_size,
                  RIKEN::YHlab::TagAS::FeatureLink->get_cache_size);

  printf("</features>\n");
}

#########################################################################################

sub display_full_feature {
  my $self = shift;
  my $feature = shift;

  load_sources();
  #cache_linksets($self);

  print($feature->xml);

  #my $trans_set = $trans_gene_lset->find_links_with_feature2($feature);
  #my $trans_set = get_transcripts_for_gene($self, $feature);
  my $trans_set = $feature->left_links->extract_linksource($trans_gene_source);

  if($trans_set->count > 0) {
    printf("<transcripts>\n");
    foreach my $tedge (sort {(($a->left_feature->chrom_start <=> $b->left_feature->chrom_start) ||
                              ($a->left_feature->chrom_end <=> $b->left_feature->chrom_end))
                            } @{$trans_set->links}) {
      print("   ", $tedge->left_feature->simple_xml);
    }
    printf("</transcripts>\n");
  }
  
  #my $l3set = $l3_gene_lset->find_links_with_feature2($feature);
  #my $l3set = $feature->left_links->extract_linksource($l3_gene_source);
  my $l3set = new RIKEN::YHlab::TagAS::LinkSet;
  foreach my $tedge (@{$feature->left_links->links}) {
    next unless($tedge->link_source->is_visible);
    next unless($tedge->left_feature->feature_source->category eq 'L3_promoter');
    $l3set->add_link($tedge);
  }

  if($l3set->count > 0) {
    printf("<promoters>\n");
    my @sorted_p_edges;
    if($feature->strand eq "+") {
      @sorted_p_edges = sort {($a->left_feature->chrom_start <=> $b->left_feature->chrom_start)} @{$l3set->links};
    } else {
      @sorted_p_edges = sort {($b->left_feature->chrom_start <=> $a->left_feature->chrom_start)} @{$l3set->links};
    }
    foreach my $tedge (@sorted_p_edges) {
      expand_l3_promoter($self, $tedge);
    }
    printf("</promoters>\n");
  }
}


sub expand_l3_promoter {
  my $self = shift;
  my $l3_edge = shift;
  my $l3 = $l3_edge->left_feature;

##  <promoter_from_edges name="L2_chr12_-_46585076" feature_id="8698262" type="L2_promoter" weight="0.000" source="L2_promoter_Entrez_v3" evidence_code="Predicted" loc="chr12:46585054-46585092" L3promoter="L3_chr12_-_46585045">
## <link_from feature_id="5538672" name="ZNF384" weight="6.353" source="Entrez_TFmatrix_L2_Entrez" evidence_code="Predicted" loc="chr12:6645904-6668930" promoter="L2_chr12_-_46585076" tfmatrix="M00734"/>

  ##my $l2set = $l2_l3_lset->find_links_with_feature2($l3);
  my $l2set = $l3->left_links->extract_linksource($l2_l3_source);

  my @sorted_p_edges;
  if($l3_edge->right_feature->strand eq "+") {
    @sorted_p_edges = sort {($a->left_feature->chrom_start <=> $b->left_feature->chrom_start)} @{$l2set->links};
  } else {
    @sorted_p_edges = sort {($b->left_feature->chrom_start <=> $a->left_feature->chrom_start)} @{$l2set->links};
  }
  foreach my $l2link (@sorted_p_edges) {
    my $l2 = $l2link->left_feature;
    printf("    <promoter_from_edges L3promoter=\"%s\" name=\"%s\" feature_id=\"%d\" type=\"%s\" source=\"%s\" evidence_code=\"Predicted\" loc=\"%s\" >\n",
		    $l3->primary_name,
                    $l2->primary_name,
                    $l2->id,
                    $l2->feature_source->category,
                    $l2->feature_source->name,
                    $l2->chrom_location);

    ##my $tfbs1_set = $tfbs_l2_lset->find_links_with_feature2($l2);
    ##my $tfbs1_set = get_TFBS_for_L2($self, $l2);
    my $tfbs1_set = $l2->left_links->extract_linksource($tfbs_l2_source);

    foreach my $tfbs1_link (sort {$b->weight <=> $a->weight} @{$tfbs1_set->links}) {
      my $tfbs = $tfbs1_link->left_feature;
      #print($tfbs->simple_xml);
      ##my $tfbs2_set = $gene_tfbs_lset->find_links_with_feature2($tfbs);
      my $tfbs2_set = $tfbs->left_links->extract_linksource($gene_tfbs_source);

      foreach my $tfbs2_link (@{$tfbs2_set->links}) {
        my $tf_gene = $tfbs2_link->left_feature;
    
        printf("      <link_from feature_id=\"%d\" name=\"%s\" weight=\"%1.3f\" source=\"%s\" evidence_code=\"Predicted\" loc=\"%s\" tfmatrix=\"%s\" />\n",
               $tf_gene->id,
               $tf_gene->primary_name,
               $tfbs1_link->weight,
             ##  "Entrez_TFBS_promoter",
               $tfbs2_link->link_source->alias,
               $tf_gene->chrom_location,
               $tfbs->primary_name
               );

      }
      if($tfbs2_set->count == 0) { #orphan matrix
        printf("      <link_from feature_id=\"%d\" name=\"%s\" weight=\"%1.3f\" type=\"matrix\" source=\"%s\" evidence_code=\"Predicted\" loc=\"%s\" tfmatrix=\"%s\" />\n",
               $tfbs->id,
               $tfbs->primary_name,
               $tfbs1_link->weight,
               $tfbs1_link->link_source->alias,
               $tfbs->chrom_location,
               $tfbs->primary_name
               );
      }
    }
    printf("    </promoter_from_edges>\n"); #L2
  }
}


sub expand_l3_promoter_pure {
  my $self = shift;
  my $l3_edge = shift;
  my $l3 = $l3_edge->left_feature;
  printf("  <feature id=\"%d\" category=\"%s\" source=\"%s\" loc=\"%s\" chr=\"%s\" start=\"%d\" end=\"%d\" strand=\"%s\" name=\"%s\">\n",
                    $l3->id,
                    $l3->feature_source->category,
                    $l3->feature_source->name,
                    $l3->chrom_location,
                    $l3->chrom_name,
                    $l3->chrom_start,
                    $l3->chrom_end,
                    $l3->strand,
                    $l3->primary_name);

  my $l2set = $l2_l3_lset->find_links_with_feature2($l3);
  my @sorted_p_edges;
  if($l3_edge->right_feature->strand eq "+") {
    @sorted_p_edges = sort {($a->left_feature->chrom_start <=> $b->left_feature->chrom_start)} @{$l2set->links};
  } else {
    @sorted_p_edges = sort {($b->left_feature->chrom_start <=> $a->left_feature->chrom_start)} @{$l2set->links};
  }
  foreach my $l2link (@sorted_p_edges) {
    my $l2 = $l2link->left_feature;
    printf("    <feature id=\"%d\" category=\"%s\" source=\"%s\" loc=\"%s\" chr=\"%s\" start=\"%d\" end=\"%d\" strand=\"%s\" name=\"%s\">\n",
                    $l2->id,
                    $l2->feature_source->category,
                    $l2->feature_source->name,
                    $l2->chrom_location,
                    $l2->chrom_name,
                    $l2->chrom_start,
                    $l2->chrom_end,
                    $l2->strand,
                    $l2->primary_name);

    my $tfbs1_set = $tfbs_l2_lset->find_links_with_feature2($l2);
    #my $tfbs1_set = get_TFBS_for_L2($self, $l2);
    foreach my $tfbs1_link (sort {$b->weight <=> $a->weight} @{$tfbs1_set->links}) {
      #print($tfbs1_link->left_feature->simple_xml);
      my $tfbs2_set = $gene_tfbs_lset->find_links_with_feature2($tfbs1_link->left_feature);
      foreach my $tfbs2_link (@{$tfbs2_set->links}) {
        my $tf_gene = $tfbs2_link->left_feature;
        my $matrix = $tfbs2_link->right_feature;
    
        printf("      <link_from feature_id=\"%d\" name=\"%s\" weight=\"%1.3f\" source=\"%s\" evidence_code=\"Predicted\" loc=\"%s\" tfmatrix=\"%s\" />\n",
               $tf_gene->id,
               $tf_gene->primary_name,
               $tfbs1_link->weight,
             ##  "Entrez_TFBS_promoter",
               $tfbs2_link->link_source->alias,
               $tf_gene->chrom_location,
               $matrix->primary_name
               );

      }
    }
    printf("    </feature>\n"); #L2
  }
  printf("  </feature>\n"); #L3
}


sub show_TFBS_prediction_edges {
  my $self = shift;
  my $feature = shift;  #center feature
  

  # basic flow is gene->TFBS_matrix->L2->L3->gene
  # so the linkset order is
  #   $gene_tfbs_lset->find_links_with_feature1($feature);
  #   $tfbs_l2_lset->find_links_with_feature1($tfbs);
  #   $l2_l3_lset->find_links_with_feature1($l2);
  #   $l3_gene_lset->find_links_with_feature1($l3);

  my $time2 = time();
  my $count=0;
  my $edge_hash = {};

  ## my $tfset = $gene_tfbs_lset->find_links_with_feature1($feature);
  my $tfset = $feature->right_links->extract_linksource($gene_tfbs_source);
  foreach my $edge1 (@{$tfset->links}) {
    my $tfbs = $edge1->right_feature;
    ## my $l2set = $tfbs_l2_lset->find_links_with_feature1($edge1->right_feature);
    my $l2set = $tfbs->right_links->extract_linksource($tfbs_l2_source);
    foreach my $edge2 (@{$l2set->links}) {
      my $l2 = $edge2->right_feature;
      ## my $l3set = $l2_l3_lset->find_links_with_feature1($edge2->right_feature);
      my $l3set = $l2->right_links->extract_linksource($l2_l3_source);
      foreach my $edge3 (@{$l3set->links}) {
        my $l3 = $edge3->right_feature;
        ## my $geneset = $l3_gene_lset->find_links_with_feature1($edge3->right_feature);
        my $geneset = $l3->right_links->extract_linksource($l3_gene_source);
        foreach my $edge4 (@{$geneset->links}) {
          my $gene2 = $edge4->right_feature;
          my $edgeset = {'weight'=>$edge2->weight, 'edge2' => $edge2, 'edge4'=>$edge4};

          my $old_set = $edge_hash->{$gene2->id};
          if(!defined($old_set)) { $edge_hash->{$gene2->id} = $edgeset; }
          elsif(abs($edge2->weight) > abs($old_set->{'weight'})) {
            $edge_hash->{$gene2->id} = $edgeset;
          }

        }
      }
    }
  }
  my $runtime1 = time() - $time2;

  printf("<tfbs_predictions count=\"%d\" >\n", scalar(keys(%$edge_hash)));
  #foreach my $edgeset (sort{($a->{'edge4'}->feature2_id <=> $b->{'edge4'}->feature2_id)} values(%$edge_hash)) {

  foreach my $edgeset (sort{($b->{'weight'} <=> $a->{'weight'})} values(%$edge_hash)) {
    my $edge2 = $edgeset->{'edge2'};
    my $edge4 = $edgeset->{'edge4'};
    my $gene2 = $edge4->right_feature;

    ## <link_to feature_id="5551590" name="C18orf1" weight="3.429" 
    ##     source="Entrez_TFmatrix_L2_Entrez" evidence_code="Predicted" 
    ##     loc="chr18:13208795-13642753" promoter="L2_chr18_+_13454979" tfmatrix="M00649"/>
    printf("<link_to feature_id=\"%d\" name=\"%s\" weight=\"%1.3f\" source=\"%s\" evidence_code=\"%s\" loc=\"%s\" ",
               $gene2->id,
               $gene2->primary_name,
               $edge2->weight, #the tfbs->L2 edge is the one with the important weight
               "Entrez_TFmatrix_L2_L3_Entrez_may08",
               "Predicted",
               $gene2->chrom_location,
               );
    printf("tfmatrix=\"%s\" ", $edge2->left_feature->primary_name);
    printf("promoter=\"%s\" ", $edge2->right_feature->primary_name);
    printf("L3promoter=\"%s\" ", $edge4->left_feature->primary_name); 
    print("/>");
  }
  printf("<stats time1=\"%1.3f sec\"  time2=\"%1.3f secs\" />\n", $runtime1, (time() - $time2));
  printf("</tfbs_predictions>\n");
}


sub get_TFBS_for_L2 {
  my $self = shift;
  my $l2 = shift;
  
  my $tfbs1_set = $tfbs_l2_lset->find_links_with_feature2($l2);
  if($tfbs1_set->count == 0) {
    my $promoter_edges = RIKEN::YHlab::TagAS::FeatureLink->fetch_all_to_feature_id($eeDB, $l2->id, $tfbs_l2_source->id);
    $tfbs1_set->add_links($promoter_edges);
  }
  return $tfbs1_set;
}

sub get_transcripts_for_gene {
  my $self = shift;
  my $gene = shift;
  
  my $trans_set = $trans_gene_lset->find_links_with_feature2($gene);
  if($trans_set->count == 0) {
    my $edges = RIKEN::YHlab::TagAS::FeatureLink->fetch_all_to_feature_id($eeDB, $gene->id, $trans_gene_source->id);
    $trans_set->add_links($edges);
  }
  return $trans_set;
}


sub load_sources {
  if(!defined($entrez_source)) {
    $entrez_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "Entrez_gene", "Entrez_gene");
    #$entrez_source->display_info;
  }

  if(!defined($tfmatrix_source)) {
    $tfmatrix_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "TFBS_matrix", "TFBS_matrix_may08");
    #$tfmatrix_source->display_info;
  }

  if(!defined($L2_source)) {
    $L2_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "L2_promoter", "CAGE_L2_promoter_april08");
    #$L2_source->display_info;
  }

  if(!defined($gene_tfbs_source)) {
    $gene_tfbs_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "Entrez_TFmatrix_may08");
    #$gene_tfbs_source->display_info;
  }
  if(!defined($tfbs_l2_source)) {
    $tfbs_l2_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "TFmatrix_L2_may08");
    #$tfbs_l2_source->display_info;
  }
  if(!defined($l2_l3_source)) {
    $l2_l3_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "L2_to_L3_april08");
    #$l2_l3_source->display_info;
  }
  if(!defined($l3_gene_source)) {
    $l3_gene_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "L3_promoter_Entrez_08May16_EvN");
    #$l3_gene_source->display_info;
  }
  if(!defined($trans_gene_source)) {
    $trans_gene_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "Entrez_transcript2gene");
    #$trans_gene_source->display_info;
  }
}

sub cache_linksets {
  my $self = shift;

  my $time2;

  if(!defined($entrez_source)) {
    $time2 = time();
    $entrez_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "Entrez_gene", "Entrez_gene");
    printf("%s", $entrez_source->xml);
    RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $entrez_source);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($tfmatrix_source)) {
    $time2 = time();
    $tfmatrix_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "TFBS_matrix", "TFBS_matrix_may08");
    printf("%s", $tfmatrix_source->xml);
    RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $tfmatrix_source);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($L2_source)) {
    $time2 = time();
    $L2_source = RIKEN::YHlab::TagAS::FeatureSource->fetch_by_category_name($eeDB, "L2_promoter", "CAGE_L2_promoter_april08");
    printf("%s", $L2_source->xml);
    RIKEN::YHlab::TagAS::Feature->fetch_all_by_source($eeDB, $L2_source);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($gene_tfbs_lset)) {
    $time2 = time();
    $gene_tfbs_lset = RIKEN::YHlab::TagAS::LinkSet->new(db=>$eeDB, lsname=>'Entrez_TFmatrix_may08');
    printf("%s", $gene_tfbs_lset->simple_xml);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($tfbs_l2_lset)) {
    $time2 = time();
    $tfbs_l2_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "TFmatrix_L2_may08");
    #$tfbs_l2_lset = RIKEN::YHlab::TagAS::LinkSet->new();
    $tfbs_l2_lset = RIKEN::YHlab::TagAS::LinkSet->new(db=>$eeDB, lsname=>'TFmatrix_L2_may08');
    $tfbs_l2_lset->name('TFmatrix_to_L2');
    print($tfbs_l2_source->xml);
    print($tfbs_l2_lset->simple_xml);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($l2_l3_lset)) {
    $time2 = time();
    $l2_l3_lset = RIKEN::YHlab::TagAS::LinkSet->new(db=>$eeDB, lsname=>'L2_to_L3_april08');
    print($l2_l3_lset->simple_xml);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($l3_gene_lset)) {
    $time2 = time();
    $l3_gene_lset = RIKEN::YHlab::TagAS::LinkSet->new(db=>$eeDB, lsname=>'L3_promoter_Entrez_08May16_EvN');
    print($l3_gene_lset->simple_xml);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }

  if(!defined($trans_gene_lset)) {
    $time2 = time();
    $trans_gene_source = RIKEN::YHlab::TagAS::FeatureLinkSource->fetch_by_name($eeDB, "Entrez_transcript2gene");
    $trans_gene_lset = RIKEN::YHlab::TagAS::LinkSet->new();
    $trans_gene_lset->name('Entrez_transcript2gene');
    print($trans_gene_source->xml);
    print($trans_gene_lset->simple_xml);
    printf("<time>%1.3f secs</time>\n", (time() - $time2));
  }
}

#
####################################################
#

sub fetch_named_region {
  my $self = shift;

  my $starttime = time()*1000;
  my $assembly = 'hg18';
  my ($chrom_name, $start, $end);
  my $fsrc_hash = {};
  
  if($self->{'fsrc_filters'}) {
    my @names = split /,/, $self->{'fsrc_filters'};
    foreach my $fsrc (@names) {
      $fsrc_hash->{$fsrc}=1;
    }
  }

  if($self->{'loc'} =~ /(.*)\:(.*)\.\.(.*)/) {
    $chrom_name = $1;
    $start = $2;
    $end = $3;
  }
  my $chunks   = RIKEN::YHlab::TagAS::ChromChunk->fetch_all_named_region($eeDB, $assembly, $chrom_name, $start, $end);
  my $features = RIKEN::YHlab::TagAS::Feature->fetch_all_named_region($eeDB, $assembly, $chrom_name, $start, $end);
  my $count=0;
  return unless(scalar(@$features)>0);
  my $chrom = $features->[0]->chrom;

  if($self->{'mode'} eq 'region_gff') {
    print header(-type => "text/plain");
    foreach my $feature (@{$features}) {
      next if($feature->feature_source->is_active ne 'y');
      next unless($feature->feature_source->is_visible eq 'y');
      next if(defined($self->{'fsrc_filters'}) and !($fsrc_hash->{$feature->feature_source->name}));
      $count++;
      print($feature->gff_description,"\n");
    }
    my $total_time = (time()*1000) - $starttime;
    printf("#processtime_sec: %1.3f\n", $total_time/1000.0);
    printf("#count: %d\n", $count);
  }
  elsif($self->{'mode'} eq 'region_xml') {
    print header(-type => "text/xml", -charset=> "UTF8");
    printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    print("<features>\n");
    foreach my $feature (@{$features}) {
      next if($feature->feature_source->is_active ne 'y');
      next unless($feature->feature_source->is_visible eq 'y');
      $count++;
      print($feature->xml);
    }
    my $total_time = (time()*1000) - $starttime;
    printf("<process_summary count=\"%d\" processtime_sec=\"%1.3f\" />\n", $count, $total_time/1000.0);
    print("</features>\n");
  }

  elsif($self->{'mode'} eq 'das') {
    print header(-type => "text/xml", -charset=> "UTF8");
    printf("<?xml version=\"1.0\" standalone=\"yes\"?>\n");
    printf("<!DOCTYPE DASGFF SYSTEM \"http://www.biodas.org/dtd/dasgff.dtd\">\n");
    printf("<DASGFF>\n");
    printf("<GFF version=\"1.0\" href=\"url\">\n");
    printf("<SEGMENT id=\"%d\" start=\"%d\" stop=\"%d\" type=\"%s\" version=\"%s\" label=\"%s\">\n",
             $chrom->id, 
             $start, 
             $end, 
             $chrom->chrom_type,
             $chrom->assembly->ucsc_name, 
             $chrom->chrom_name);

    foreach my $feature (@{$features}) {
      next if($feature->feature_source->is_active ne 'y');
      next unless($feature->feature_source->is_visible eq 'y');
      $count++;
      print($feature->dasgff_xml,"\n");
    }

    printf("</SEGMENT>\n");
    printf("</GFF>\n");
    printf("</DASGFF>\n");      
  }
}

#
####################################################
#


sub search_feature {
  my $self = shift;
  
  my $starttime = time()*1000;

  my $name = $self->{'name'};

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  my $feature_list =[];
  my $result_count = -1;  #undefined
  my $like_count = -1;  #undefined
  my $exact_count = -1;  #undefined
  my $search_method = "exact";

  printf("<results>\n");
  if(defined($name)) { printf("<query value=\"%s\" />\n", $name); }

  if(!defined($name) or (length($name)<2)) {
    $result_count = -1;
    $search_method = "error";
  } else {
    $like_count = RIKEN::YHlab::TagAS::Feature->get_count_symbol_search($eeDB, $name ."%");
    $exact_count = RIKEN::YHlab::TagAS::Feature->get_count_symbol_search($eeDB, $name);
    $search_method = "count_like";
    if($like_count<$self->{'limit'}) {
      $feature_list= RIKEN::YHlab::TagAS::Feature->fetch_all_symbol_search($eeDB, undef, $name, undef, 100);
      $result_count = scalar(@$feature_list);
      $search_method = "like";
    } else {
      $search_method = "exact_count";
      $result_count = $exact_count;
      if($exact_count>0 and $exact_count<$self->{'limit'}) {
        $feature_list= RIKEN::YHlab::TagAS::Feature->fetch_all_by_source_symbol($eeDB, undef, $name);
        $result_count = scalar(@$feature_list);
        $search_method = "exact";
      } else {
        $result_count = $like_count;
        $search_method = "count_like";
      }
    }
  }
  my $filter_count=0;
  foreach my $feature (sort {($a->primary_name cmp $b->primary_name)} @$feature_list) {
    next if($self->{'ensfilter'} and ($feature->feature_source->name =~ /Ensembl/));
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    printf("<match desc=\"%s\"  feature_id=\"%s\" type=\"%s\" fsrc=\"%s\" />", 
           $feature->primary_name, $feature->id, 
           $feature->feature_source->category,
           $feature->feature_source->name);
    $filter_count++;
  }
  if($filter_count == 0) {
    foreach my $feature (sort {($a->primary_name cmp $b->primary_name)} @$feature_list) {
      printf("<match desc=\"%s\"  feature_id=\"%s\" type=\"%s\" fsrc=\"%s\" />", 
           $feature->primary_name, $feature->id, 
	   $feature->feature_source->category,
	   $feature->feature_source->name);
    }
  }
  printf("<result_count method=\"%s\" exact_count=\"%d\" like_count=\"%d\" total=\"%s\" filtered=\"%s\" />\n", 
          $search_method, $exact_count, $like_count, $result_count, $filter_count);

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</results>\n");
}


sub fetch_feature_source {
  my $self = shift;

  my $starttime = time()*1000;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  printf("<features>\n");
  foreach my $fsrc (keys(%{$self->{'fsrc_hash'}})) {
    my $fset = RIKEN::YHlab::TagAS::FeatureSet->new(db=>$eeDB, fsrc=>$fsrc);
    my $features = $fset->features;
    foreach my $feat (@$features) {
      printf("%s", $feat->simple_xml);
    }
  }

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("</features>\n");

}

