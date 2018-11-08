#!/usr/bin/perl -w
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
use File::Temp;

use JMS::Database;
use JMS::MappedQuery;
use RIKEN::YHlab::TagAS::Feature;

use GraphViz;

  my $g = GraphViz->new();

  $g->add_node('London');
  $g->add_node('Paris', label => 'City of\nlurve');
  $g->add_node('New York');

  $g->add_edge('London' => 'Paris');
  $g->add_edge('London' => 'New York', label => 'Far');
  $g->add_edge('Paris' => 'London');

  #print header;
  #print start_html("EdgeExpressDB graphviz tester");

  print header(-type => "application/xhtml+xml", -charset=> "UTF8");
  print $g->as_svg;

  #print end_html;

