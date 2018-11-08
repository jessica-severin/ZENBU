#!/usr/local/bin/perl -w
BEGIN{
    unshift(@INC, "/usr/local/bioperl/bioperl-1.5.2_102");
    unshift(@INC, "/home/severin/src/MappedQuery/lib");
    unshift(@INC, "/home/severin/src/EdgeExpressDB/lib");
#    unshift(@INC, "/eeDB/src/EdgeExpressDB_1.206/lib");
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

use EEDB::Database;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Expression;
use EEDB::Experiment;
use EEDB::EdgeSet;
use EEDB::FeatureSet;
use EEDB::SPStream::SourceStream;
use EEDB::SPStream::MultiSourceStream;


my $connection_count = 0;

my $eeDB = undef;
my $eeDB_url = undef;

my $global_source_cache = {};
my $global_source_counts = {"Experiment"=>0, "FeatureSource"=>0, "ExpressionDatatype"=>0 };

my $start_date = localtime();
my $launch_time = time();

while (my $fcgi_session = new CGI::Fast) {
  process_url_request($fcgi_session);
  $connection_count++;
}

##########################

sub process_url_request {
  my $fcgi_session = shift;

  my $self = {};
  $self->{'starttime'} = time()*1000;

  $self->{'known_sources'} = {};
  $self->{'apply_source_filter'} = 0;
  $self->{'filter_ids'} = {};
  $self->{'peer_ids'} = {};

  $self->{'fcgi_session'} = $fcgi_session;
  $self->{'id'} = $fcgi_session->param('id');
  $self->{'peer_name'} = $fcgi_session->param('peer');
  $self->{'limit'} = $fcgi_session->param('limit');
  $self->{'ensfilter'} = $fcgi_session->param('ensfilter');
  $self->{'name'} = $fcgi_session->param('name');
  $self->{'source'} = $fcgi_session->param('source');
  $self->{'mode'} = $fcgi_session->param('mode');
  $self->{'format'} = $fcgi_session->param('format');
  $self->{'savefile'} = $fcgi_session->param('save');
  $self->{'id_list'} = $fcgi_session->param('ids');
  $self->{'name_list'} = $fcgi_session->param('names');
##$self->{'flush'} = $fcgi_session->param('flush');
  $self->{'reload_sources'} = $fcgi_session->param('refresh');
  $self->{'assembly_name'} = $fcgi_session->param('asm');
  $self->{'chrom_name'} = $fcgi_session->param('chrom');

  $self->{'source_names'} = $fcgi_session->param('source_names') if(defined($fcgi_session->param('source_names')));
  $self->{'source_names'} = $fcgi_session->param('types') if(defined($fcgi_session->param('types'))); 
  $self->{'source_names'} = $fcgi_session->param('sources') if(defined($fcgi_session->param('sources'))); 

  $self->{'expfilter'} = $fcgi_session->param('expfilter') if(defined($fcgi_session->param('expfilter')));
  $self->{'expfilter'} = $fcgi_session->param('exp_filter') if(defined($fcgi_session->param('exp_filter'))); 
  $self->{'expfilter'} = $fcgi_session->param('filter') if(defined($fcgi_session->param('filter'))); 

  if(defined($fcgi_session->param('peers'))) {
    my @ids = split(",", $fcgi_session->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }

  if(defined($self->{'source_names'})) {
    $self->{'apply_source_filter'} = 1;
    $self->{'sourcename_hash'}={};
    my @names = split /,/, $self->{'source_names'};
    foreach my $name (@names) {
      $self->{'sourcename_hash'}->{$name}=1;
    }
  }

  if(defined($self->{'name'}) and !defined($self->{'source'})) {
    $self->{'source'} = 'primaryname';
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'feature'; }
  }
  if(defined($fcgi_session->param('search'))) {
    $self->{'mode'} = 'search';
    $self->{'name'} = $fcgi_session->param('search');
  }

  $self->{'mode'} ='feature' unless(defined($self->{'mode'}));
  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'limit'}=1000 unless(defined($self->{'limit'}));
  $self->{'ensfilter'}=1 unless(defined($self->{'ensfilter'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; }
    elsif($self->{'id'} =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; }
  }

  $self->{'source_ids'} = $fcgi_session->param('source_ids') if(defined($fcgi_session->param('source_ids')));
  if(defined($fcgi_session->param('peers'))) {
    my @ids = split(",", $fcgi_session->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
  }

  #########
  # pre-process some parameters
  #
  if($self->{'expfilter'}) {
    $self->{'apply_source_filter'} = 1;
    if($self->{'format'} eq 'debug') {  printf("apply filter :: [%s]\n", $self->{'expfilter'}); }
  }

  if($self->{'source_ids'}) {
    $self->{'apply_source_filter'} = 1;
    my @ids = split /,/, $self->{'source_ids'};
    foreach my $id (@ids) {
      $id =~ s/\s//g;
      next unless($id);
      $self->{'filter_ids'}->{$id} = 1;
      if($id =~ /(.+)::(.+):::/) {
        my $peer = $1;
        $self->{'peer_ids'}->{$peer} = 1;
      }
    }
  }


  ##### 
  # now process
  #
  if(!defined($eeDB)) {
    init_db($self);
  } 
  if(defined($self->{'flush'})) {
    EEDB::Feature->set_cache_behaviour(0);
    EEDB::Edge->set_cache_behaviour(0);
  }
  if(defined($self->{'reload_sources'})) {
    my $stream = input_stream($self);
    $stream->reload_stream_data_sources();
  }

  if(defined($self->{'name'}) and ($self->{'mode'} eq 'search')) {
    search_feature($self);
    return;
  }

  if($self->{'mode'} eq 'feature_sources') {
    show_feature_sources($self);
  } elsif($self->{'mode'} eq 'edge_sources') {
    show_edge_sources($self);
  } elsif($self->{'mode'} eq 'experiments') {
    show_experiments($self);
  } elsif($self->{'mode'} eq 'peers') {
    show_peers($self);
  } elsif($self->{'mode'} eq 'expression_datatypes') {
    show_expression_datatypes($self);
  } elsif($self->{'mode'} eq 'sources') {
    show_all_sources($self);
  } elsif($self->{'mode'} eq 'chrom') {
    show_chromosomes($self);
  } elsif(defined($self->{'id'})) {
    #elsif($self->{'mode'} eq 'express') { export_feature_expression($self); }
    get_singlenode($self);
  } else {
    show_fcgi($fcgi_session);
    #printf("ERROR : URL improperly formed\n");
  }

  foreach my $peer (@{EEDB::Peer->all_cached_peers}) {
    next unless($peer);
    next unless($peer->test_peer_database_is_valid);
    $peer->peer_database->disconnect;
  }
  $eeDB->disconnect;
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
  print p("eedb_object.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  printf("<br>dburl : %s\n",$eeDB->url);
  print hr;

  #if(defined($id)) { printf("<h2>id = %d</h2>\n", $id); }
  print("<table border=1 cellpadding=10><tr>");
  printf("<td>%d knowns peers</td>", scalar(@{EEDB::Peer->all_cached_peers}));
  printf("<td>%d cached sources</td>", scalar(keys(%{$global_source_cache})));
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
  print("<tr><td>id=[federatedID]</td><td>directly access any object in federation. fedID format is [peer_uuid]::[id]:::[class]</td></tr>\n");
  print("<tr><td>name=[string]</td><td>does search on feature's primary name, returns first occurance. \n");
  print("since primary name is not required to be unique in database, this method is only useful for debugging and is not guaranteed\n");
  print("to be rebust or reproducible for data modes.</td></tr>\n");
  print("<tr><td>search=[name]</td><td>does a metadata search for all matching features and returns compact list in XML</td></tr>\n");
  print("<tr><td>types=[source,source,...]</td><td>used in combination with name=, search=, and loc= access methods to restrict search. Both single or multiple type lists are available.</td></tr>\n");
  print("</table>\n");

  print h2("Output formats");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>format=[xml,gff2,gff3,bed,tsv]</td><td>changes the output format of the result. XML is an EdgeExpress defined XML format, while
GFF2, GFF3, and BED are common formats.  XML is supported in all access modes, but GFF2, GFF3, and BED are only available in direct feauture access modes. TSV (tab-separated-values) is only available in a few modes. Default format is XML.</td></tr>\n");
  print("</table>\n");

  print h2("Output modes");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>mode=feature_sources</td><td>returns XML of all available Feature sources. types= filter is available</td></tr>\n");
  print("<tr><td>mode=edge_sources</td><td>returns XML of all available Edge sources. types= filter is available</td></tr>\n");
  print("<tr><td>mode=experiments</td><td>returns XML of all available Experiments. types= filter is available</td></tr>\n");
  print("<tr><td>mode=expression_datatypes</td><td>returns XML of all available Expression datatypes</td></tr>\n");
  print("<tr><td>mode=peers</td><td>returns XML of all connected peers in the peer-peer database federation</td></tr>\n");
  print("</table>\n");

}

#########################################################################################


sub init_db {
  my $self = shift;
  parse_conf('eedb_server.conf');

  $eeDB = EEDB::Database->new_from_url($eeDB_url);

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
}

sub parse_conf {
  my $conf_file = shift;

  #printf("parse_conf file : %s\n", $conf_file);
  if($conf_file and (-e $conf_file)) {
    #read configuration file from disk
    my $conf_list = do($conf_file);
    #printf("confarray:: %s\n", $conf_list);

    foreach my $confPtr (@$conf_list) {
      #printf("type : %s\n", $confPtr->{TYPE});
      if($confPtr->{TYPE} eq 'EEDB_URL') {
        $eeDB_url = $confPtr->{'url'};
      }
    }
  }
}


#
####################################################
#

sub get_peers {
  my $self = shift;

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(\d+)(.*)/) { $self->{'peer_name'} = $1; }
  }

  my %peers;
  if(defined($self->{'peer_name'}) or scalar(keys(%{$self->{'peer_ids'}}))>0) {
    my $peer = find_peer($self, $self->{'peer_name'});
    if($peer and $peer->test_is_valid) { $peers{$peer->uuid} = $peer; }
    foreach my $uuid (keys(%{$self->{'peer_ids'}})) {
      my $peer = find_peer($self, $uuid);
      if($peer and $peer->test_is_valid) { $peers{$peer->uuid} = $peer; }
    }
  } else {
    find_peer($self, "");
    foreach my $peer (@{EEDB::Peer->all_cached_peers}) {
      if($peer and $peer->test_is_valid) { $peers{$peer->uuid} = $peer; }
    }
  }

  my @ps = values(%peers);
  return \@ps;
}


sub get_peers_known_sources {
  my $self = shift;

  my @peers = @{get_peers($self)};

  #
  # first make sure sources are cached
  # 
  foreach my $peer (@peers) {
    next unless($peer);
    next unless($peer->source_stream);
    $peer->source_stream->clear_all_filters;
    my $cache = $peer->source_stream->cache_sources;
    foreach my $source (values(%$cache)) {
      next unless(defined($source));
      unless($global_source_cache->{$source->db_id}) {
        $global_source_cache->{$source->db_id} = 1;
        $global_source_counts->{$source->class} += 1;
      }
    }
  }


  #
  # calculate the known_sources from these peers
  #
  $self->{'known_sources'} = {}; #clear
  my %options;
  if(defined($self->{'expfilter'}))             { $options{'filter'} = $self->{'expfilter'}; }
  if($self->{'mode'} eq "experiments")          { $options{'class'} = "Experiment"; } 
  if($self->{'mode'} eq "feature_sources")      { $options{'class'} = "FeatureSource"; } 
  if($self->{'mode'} eq "edge_sources")         { $options{'class'} = "EdgeSource"; } 
  if($self->{'mode'} eq "expression_datatypes") { $options{'class'} = "ExpressionDatatype"; } 

  my @filter_ids = keys(%{$self->{'filter_ids'}});
  if(scalar(@filter_ids) > 0) {
    $options{'source_ids'} = \@filter_ids;
  }

  #gets peers and run through filtered sources
  foreach my $peer (@peers) {
    next unless($peer);
    my $stream = $peer->source_stream;
    next unless($stream);
  
    $stream->stream_data_sources(%options);
    while(my $source = $stream->next_in_stream) {
      $self->{'known_sources'}->{$source->db_id} = $source;
    }
  }

  return \@peers;
}


sub find_peer {
  my $self = shift;
  my $uuid = shift;

  my $peer = EEDB::Peer->check_peer_cache($uuid);
  unless($peer) {
    my $start_peer = EEDB::Peer->fetch_self($eeDB);
    $peer = $start_peer->find_peer($uuid, 3);
  }
  return $peer;
}

#
#########################################################
#

sub input_stream {
  my $self = shift;

  return source_filtered_stream($self);
}

sub unfiltered_stream {
  my $self = shift;

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(\d+)(.*)/) { $self->{'peer_name'} = $1; }
  }

  my @peers = @{get_peers($self)};
  my $web_urls = {};
  
  my $stream = undef;
  if(scalar(@peers)==1) {
    $stream = $peers[0]->source_stream;
    $stream->clear_all_filters;
  } else {
    $stream = new EEDB::SPStream::MultiSourceStream;
    foreach my $peer (@peers) {
      my $stream1 = $peer->source_stream;
      next unless($stream1);
      $stream1->clear_all_filters;
      $stream->add_sourcestream($stream1);

      #if($stream1->class eq "EEDB::SPStream::EEWebXMLStream") {
      #  unless($web_urls->{$stream1->url}) {
      #    $web_urls->{$stream1->url} = 1;
      #    $stream1->peer(undef);
      #    $stream->add_sourcestream($stream1);
      #  }
      #} else {
      #  $stream->add_sourcestream($stream1);
      #}
    }
  }
  return $stream;
}

sub source_filtered_stream {
  my $self = shift;

  my $stream = unfiltered_stream($self);

  my %options;
  if(defined($self->{'expfilter'})) { $options{'filter'} = $self->{'expfilter'}; }
  if(defined($self->{'source_ids'})) { $options{'source_ids'} = $self->{'source_ids'}; }
  if(defined($self->{'source_names'})) { $options{'filter_sourcenames'} = $self->{'sourcename_hash'}; }

  $stream->stream_data_sources(%options);

  $self->{'known_sources'} = {};
  while(my $source = $stream->next_in_stream) {
    next unless(defined($source));
    $self->{'known_sources'}->{$source->db_id} = $source;
    unless($global_source_cache->{$source->db_id}) {
      $global_source_cache->{$source->db_id} = 1;
      $global_source_counts->{$source->class} += 1;
    }
  }
  
  if($self->{'apply_source_filter'}) {
    my @filter_sources = values(%{$self->{'known_sources'}});
    foreach my $source (@filter_sources) {
      $stream->add_source_filter($source);
    }
  }
  return $stream;
}


#########################################################################################

sub escape_xml {
  my $data = shift;
  $data =~ s/\&/&amp;/g;
  $data =~ s/\"/&quot;/g; #\"
  $data =~ s/\</&lt;/g;
  $data =~ s/\>/&gt;/g;
  return $data;
}

#########################################################################################

sub export_feature_expression {
  my $self = shift;

  my $starttime = time()*1000;

  my $stream = input_stream($self);
  my $feature = $stream->fetch_object_by_id($self->{'id'});
  unless($feature) {
    show_fcgi($self->{'fcgi_session'});
    return;
  } 
  #if(($self->{'format'} =~ /gff/) or ($self->{'format'} eq 'tsv')) { 
  if(($self->{'format'} eq 'tsv')) { 
    if($self->{'savefile'}) { 
      my $filename = $feature->primary_name . "_expression." . $self->{'format'};
      print header(-type => "text/plain", -attachment=>$filename);
    } else {
      print header(-type => "text/plain");
    }
  } elsif($self->{'format'} eq 'xml') { 
    if($self->{'savefile'}) { 
      my $filename = $feature->primary_name . "_expression.xml";
      print header(-type => "text/xml", -charset=> "UTF8", -attachment=>$filename);
    } else {
      print header(-type => "text/xml", -charset=> "UTF8");
    }
    printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    printf("<features>\n");
    if($self->{"peerDB"}) { print($self->{"peerDB"}->xml); }
  } else {
    show_fcgi($self->{'fcgi_session'});
  }


  #
  #first the primary feature
  #
  if($self->{'format'} eq 'tsv') { 
    export_expression_tsv($self, $feature, $feature); 
  } elsif($self->{'format'} eq 'gff2') { 
    print($feature->gff_description, "\n");
  } else { 
    unless(show_expression_xml($self, $feature)) {
      print($feature->xml);
    }
  }

  my $edges = $feature->left_edges->edges;
  my @sort_edges;
  if($feature->strand eq "+") {
    @sort_edges = sort {(($a->edge_source->name cmp $b->edge_source->name) or ($a->feature1->chrom_start <=> $b->feature1->chrom_start))} @$edges;
  } else {
    @sort_edges = sort {(($a->edge_source->name cmp $b->edge_source->name) or ($b->feature1->chrom_start <=> $a->feature1->chrom_start))} @$edges;
  }

  foreach my $edge (@sort_edges) {
    next unless($edge->edge_source->is_active);
    if($self->{'format'} eq 'tsv') { export_expression_tsv($self, $edge->feature1, $feature); }
    else { show_expression_xml($self, $edge->feature1, $edge); }
  }

  if($self->{'format'} eq 'xml') { 
    my $total_time = (time()*1000) - $starttime;
    printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
    printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  EEDB::Feature->get_cache_size,
                  EEDB::Edge->get_cache_size);
    printf("</features>\n"); 
  }
}


sub export_expression_tsv {
  my $self = shift;
  my $feature = shift;
  my $gene = shift;

  my $express = EEDB::Expression->fetch_all_by_feature($feature);
  my $experiment = undef;
  my @exps;
  printf("\n%s\t%s\t%s\t%s",  "platform", "gene", "promoter", "library");
  foreach my $fexp (sort {(($a->experiment->platform cmp $b->experiment->platform) ||
                           ($a->experiment->series_name cmp $b->experiment->series_name) ||
                           ($a->experiment->series_point <=> $b->experiment->series_point)) } @$express) {
    if(!defined($experiment)) { $experiment = $fexp->experiment; }
    if(($experiment->platform ne $fexp->experiment->platform) or ($experiment->series_name ne $fexp->experiment->series_name)) { last; }
    printf("\t%shr", $fexp->experiment->series_point);
  }

  $experiment = undef;
  foreach my $fexp (sort {(($a->experiment->platform cmp $b->experiment->platform) ||
                           ($a->experiment->series_name cmp $b->experiment->series_name) ||
                           ($a->experiment->series_point <=> $b->experiment->series_point)) } @$express) {
    my $changed = 0;
    if(!defined($experiment)) { $changed = 1; }
    else {
      if($experiment->platform ne $fexp->experiment->platform) { $changed=1; }
      if($experiment->series_name ne $fexp->experiment->series_name) { $changed=1; }
    }
    
    if($changed) { 
      printf("\n%s\t%s\t%s\t%s\t", 
           $fexp->experiment->platform,
           $gene->primary_name,
           $feature->primary_name,
           $fexp->experiment->series_name);
    }
    printf("%f\t", $fexp->value);
    $experiment = $fexp->experiment;
  }
}


sub show_expression_xml {
  my $self = shift;
  my $feature = shift;
  my $edge = shift;

  return undef unless($feature);
  my $expcache = $feature->expression_cache;
  return undef unless($expcache);
  my @express = values(%{$expcache});

  print("<feature_express>\n");
  if($edge) { print($edge->simple_xml); }
  print($feature->xml);

  foreach my $fexp (sort {$a->experiment->id <=> $b->experiment->id} @express) {
    next unless($fexp->experiment->is_active eq "y");
    print($fexp->simple_xml);
  }
  print("</feature_express>\n");
  return 1;
}


#########################################################################################


sub get_singlenode {
  my $self = shift;

  my $stream = input_stream($self);
  my $feature = $stream->fetch_object_by_id($self->{'id'});

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<objects query_id='%s'>\n", $self->{'id'});
  print("<stream>", $stream->xml, "</stream>");
  if($feature) { print($feature->xml); }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  EEDB::Feature->get_cache_size,
                  EEDB::Edge->get_cache_size);

  printf("</objects>\n");
  $stream->disconnect;
}

#########################################################################################


sub search_feature {
  my $self = shift;
  
  my $starttime = time()*1000;

  my $name = $self->{'name'};

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<results>\n");
  if(defined($name)) { printf("<query value=\"%s\" />\n", $name); }

  my @peers = @{get_peers($self)};
  printf("<peers count=\"%d\" >\n", scalar(@peers));
  foreach my $peer (@peers) {
    next unless($peer);
    next unless($peer->test_peer_database_is_valid);
    print($peer->xml);
  }
  print("</peers>\n");

  my $result_count = 0;  #undefined
  my $like_count = 0;  #undefined
  my $search_method = "like";

  my $stream = input_stream($self);

  if(!defined($name) or (length($name)<2)) {
    $result_count = -1;
    $search_method = "error";
  } else {
    if($name =~ /\s/) {
      $stream->stream_features_by_metadata_search('filter' => $name);
      $search_method = "filter_logic";
    } else {
      $stream->stream_features_by_metadata_search('keyword_list' => $name);
    }
  }

  my $filter_count=0;
  while(my $feature = $stream->next_in_stream) { 
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    $result_count++;
    if($result_count<=$self->{'limit'}) {
      $filter_count++;
      printf("<match desc=\"%s\"  feature_id=\"%s\" type=\"%s\" fsrc=\"%s\" />\n", 
             escape_xml($feature->primary_name), 
             $feature->db_id, 
             $feature->feature_source->category,
             $feature->feature_source->name);
    }
  }
  $like_count = $result_count;

  printf("<result_count method=\"%s\" like_count=\"%d\" total=\"%s\" filtered=\"%s\" />\n", 
          $search_method, $like_count, $result_count, $filter_count);

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</results>\n");
}


sub show_all_sources {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<sources>\n");

  my $total_count=0;
  my @peers = @{get_peers_known_sources($self)};
  foreach my $source (values(%{$self->{'known_sources'}})) {
    $total_count++;
    if($self->{'format'} eq 'fullxml') { print($source->xml); }
    else { print($source->simple_xml); }
  }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary total_features='%d' processtime_sec=\"%1.3f\" />\n", $total_count, $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</sources>\n");
}


sub show_feature_sources {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<feature_sources>\n");

  my @peers = @{get_peers_known_sources($self)};

  my $fsrc_hash = {};
  my $total_count = $global_source_counts->{"FeatureSource"};
  unless($total_count) { $total_count=1; }

  foreach my $source (values(%{$self->{'known_sources'}})) {
    next unless($source->class eq "FeatureSource");
    $fsrc_hash->{$source->db_id} = $source;
  }
  my @fsrcs = values (%{$fsrc_hash});

  #print("<stream>", $stream->xml, "</stream>");
  #if(defined($self->{'expfilter'})) {
  #  printf("<filter>%s</filter>\n", $self->{'expfilter'});
  #}
  printf("<result_count method=\"feature_sources\" total=\"%s\" filtered=\"%s\" />\n", $total_count, scalar(@fsrcs));
  foreach my $fsrc (@fsrcs) {
    if($self->{'format'} eq 'fullxml') { print($fsrc->xml); }
    else { print($fsrc->simple_xml); }
    $total_count += $fsrc->feature_count;
  }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary total_features='%d' processtime_sec=\"%1.3f\" />\n", $total_count, $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</feature_sources>\n");
}


sub show_edge_sources {
  my $self = shift;

  my $stream = input_stream($self);

  my $src_hash = {};
  $stream->stream_data_sources;
  while (my $source = $stream->next_in_stream) {
    next unless($source->is_active eq 'y');
    next unless($source->class eq "EdgeSource");
    next if(defined($self->{'sourcename_hash'}) and !($self->{'sourcename_hash'}->{$source->name}));
    $src_hash->{$source->db_id} = $source;
  }
  my @sources = values (%{$src_hash});

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  printf("<edge_sources>\n");
  foreach my $source (@sources) {
    print($source->xml);
  }
  printf("</edge_sources>\n");
  $stream->disconnect;
}


sub show_experiments {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<experiments>\n");

  my @peers = @{get_peers_known_sources($self)};

  my $exp_hash = {};
  my $peer_uuid_hash = {};
  foreach my $source (values(%{$self->{'known_sources'}})) {
    next unless($source->class eq "Experiment");
    $exp_hash->{$source->db_id} = $source;
    $peer_uuid_hash->{$source->peer_uuid} = 1;
  }
  my $total_count = $global_source_counts->{"Experiment"};
  unless($total_count) { $total_count=1; }

  my @experiments = values (%{$exp_hash});

  if(defined($self->{'expfilter'})) {
    printf("<filter>%s</filter>\n", $self->{'expfilter'});
  }
  printf("<result_count method=\"experiments\" total=\"%s\" filtered=\"%s\" />\n", $total_count, scalar(@experiments));

  foreach my $exp (@experiments) {
    if($self->{'format'} eq 'fullxml') { print($exp->xml); }
    else { print($exp->simple_xml); }
  }
  foreach my $uuid (keys(%{$peer_uuid_hash})) {
    my $peer = EEDB::Peer->check_peer_cache($uuid);
    if($peer) { print($peer->xml); }
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%{$self->{'known_sources'}})));
  printf("<peer known=\"%s\" count=\"%s\" />\n", scalar(@{EEDB::Peer->all_cached_peers}), scalar(keys(%{$peer_uuid_hash})));
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</experiments>\n");
}


sub show_peers {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<peers>\n");

  my @peers = @{get_peers($self)};
  printf("<stats count=\"%d\" />\n", scalar(@peers));
  foreach my $peer (@peers) {
    next unless($peer);
    next unless($peer->test_is_valid);

    #if($self->{'peer_name'} and (($self->{'peer_name'} ne $peer->uuid) and ($self->{'peer_name'} ne $peer->alias))) { next; }
    print($peer->xml);
    if($peer->test_peer_database_is_valid) { $peer->peer_database->disconnect; }
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%$global_source_cache)));
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</peers>\n");
}


sub show_expression_datatypes {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");

  printf("<expression_datatypes>\n");
  my @peers = @{get_peers_known_sources($self)};
  my $unq_types = {};
  foreach my $source (values(%{$self->{'known_sources'}})) {
    next unless($source->is_active eq 'y');
    next unless($source->class eq "ExpressionDatatype");
    #if($self->{'peer_name'} and ($self->{'peer_name'} ne $source->peer_uuid)) { next; }
    $unq_types->{$source->datatype} = 1;
  }
  foreach my $datatype (sort keys(%{$unq_types})) {
    printf("<datatype type=\"%s\"></datatype>\n", $datatype);
  }
  printf("</expression_datatypes>\n");
}


sub show_chromosomes {
  my $self = shift;

  my @chroms;
  if($self->{'assembly_name'}) {
    if($self->{'chrom_name'}) {
      my $chrom = EEDB::Chrom->fetch_by_name($eeDB, $self->{'assembly_name'}, $self->{'chrom_name'});
      @chroms = ($chrom);
    } else {
      @chroms = @{EEDB::Chrom->fetch_all_by_assembly_name($eeDB, $self->{'assembly_name'})};
    }
  }

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<chroms>\n");

  foreach my $chrom (@chroms) {
    if(!defined($chrom)) { next; }
    print($chrom->xml);
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%$global_source_cache)));
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</chroms>\n");
}

