#!/usr/local/bin/perl -w
BEGIN{
    unshift(@INC, "/usr/local/bioperl/bioperl-1.5.2_102");
    unshift(@INC, "/home/severin/src/MappedQuery/lib");
    unshift(@INC, "/home/severin/src/EdgeExpressDB/lib");
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
use EEDB::SPStream::CutoffFilter;
use EEDB::SPStream::OverlapCluster;
use EEDB::SPStream::Expression2Feature;
use EEDB::SPStream::Feature2Expression;
use EEDB::SPStream::OverlapFilter;
use EEDB::SPStream::TemplateCluster;
use EEDB::SPStream::SourceStream;
use EEDB::SPStream::MergeStreams;
use EEDB::SPStream::OSCFileDB;
use EEDB::SPStream::MultiSourceStream;
use EEDB::SPStream::FederatedSourceStream;
use EEDB::SPStream::ExpandFeature;

my $connection_count = 0;

my $global_source_cache = {};

my $eeDB = undef;
my $eeDB_url = undef;

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

  $self->{'exptype'} = '';
  $self->{'mode'} = 'genescan';
  $self->{'submode'} = 'full_feature';
  $self->{'assembly_name'} = "";

  $self->{'fcgi_session'} = $fcgi_session;
  $self->{'assembly_name'} = $fcgi_session->param('asm');
  $self->{'source'} = $fcgi_session->param('source');
  $self->{'mode'} = $fcgi_session->param('mode') if(defined($fcgi_session->param('mode')));
  $self->{'format'} = $fcgi_session->param('format');

  $self->{'id'} = $fcgi_session->param('id') if(defined($fcgi_session->param('id'))); 
  $self->{'exptype'} = $fcgi_session->param('exptype') if(defined($fcgi_session->param('exptype'))); 
  $self->{'exptype'} = $fcgi_session->param('datatype') if(defined($fcgi_session->param('datatype'))); 
  $self->{'submode'} = $fcgi_session->param('submode') if(defined($fcgi_session->param('submode'))); 

  $self->{'source_ids'} = $fcgi_session->param('source_ids') if(defined($fcgi_session->param('source_ids'))); 
  if(defined($fcgi_session->param('peers'))) {
    my @ids = split(",", $fcgi_session->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }

  $self->{'loc'} = $fcgi_session->param('loc');
  $self->{'loc'} = $fcgi_session->param('segment') if(defined($fcgi_session->param('segment'))); 
  $self->{'chrom_name'} = $fcgi_session->param('chrom') if(defined($fcgi_session->param('chrom')));

  $self->{'fsrc_names'} = $fcgi_session->param('fsrc_filters') if(defined($fcgi_session->param('fsrc_filters')));
  $self->{'fsrc_names'} = $fcgi_session->param('types') if(defined($fcgi_session->param('types'))); 
  $self->{'fsrc_names'} = $fcgi_session->param('sources') if(defined($fcgi_session->param('sources'))); 

  $self->{'expfilter'} = $fcgi_session->param('expfilter') if(defined($fcgi_session->param('expfilter'))); 
  $self->{'expfilter'} = $fcgi_session->param('exp_filter') if(defined($fcgi_session->param('exp_filter')));
  $self->{'expfilter'} = $fcgi_session->param('filter') if(defined($fcgi_session->param('filter')));

  my $xmlData = $fcgi_session->param('POSTDATA');

  #########
  # pre-process some parameters
  #
  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)^::(.+)/) { $self->{'peer_name'} = $1; }
  }

  if($self->{'expfilter'}) {
    $self->{'apply_source_filter'} = 1;
    if($self->{'format'} eq 'debug') {  printf("apply filter :: [%s]\n", $self->{'expfilter'}); }
  }

  if($self->{'fsrc_names'}) {
    $self->{'apply_source_filter'} = 1;
    my @names = split /,/, $self->{'fsrc_names'};
    foreach my $name (@names) {
      $self->{'filter_sourcenames'}->{$name} = 1;
    }
  }
  if($self->{'source_ids'}) {
    $self->{'apply_source_filter'} = 1;
    $self->{'source_ids'} =~ s/\s//g;  #remove any whitespace
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

  #first init
  if(!defined($eeDB)) { init_db($self); } 

  # now the location processing
  if(defined($self->{'loc'}) and ($self->{'loc'} =~ /(.*)\:(.*)\.\.(.*)/)) {
    $self->{'chrom_name'} = $1;
    $self->{'start'} = $2;
    $self->{'end'} = $3;
  }

  $self->{'mode'} ='scan' unless(defined($self->{'mode'}));
  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));

  if($self->{'mode'} eq "peers") {
    return show_peers($self);
  }
  if($self->{'mode'} eq "feature_sources") {
    return show_feature_sources($self);
  }
  if($self->{'mode'} eq "experiments") {
    return show_experiments($self);
  }
  if($self->{'mode'} eq "source_stream") {
    return show_source_stream($self);
  }
  if(defined($self->{'id'})) {
    return get_singlenode($self);
  }

  if(scan_data_stream($self)) { return; }

  show_fcgi($self, $fcgi_session);
  #printf("ERROR : URL improperly formed\n");
}


sub show_fcgi {
  my $self = shift;
  my $fcgi_session = shift;

  my $id = $fcgi_session->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  print header;
  print start_html("EdgeExpressDB CGI object server");
  print h1("CGI object server (perl)");
  print p("eedb_scan.cgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  printf("<br>dburl : %s\n",$eeDB->url);
  printf("<br>default assembly : %s\n", $self->{"assembly_name"});
  print hr;

  #if(defined($id)) { printf("<h2>id = %d</h2>\n", $id); }
  print("<table border=1 cellpadding=10><tr>");
  printf("<td>%d features in cache</td>", EEDB::Feature->get_cache_size);
  printf("<td>%d edges in cache</td>", EEDB::Edge->get_cache_size);
  print("</tr></table>");
  
  show_api($fcgi_session);
  print end_html;
}

sub show_api {
  my $fcgi_session = shift;
  
  print hr;
  print h2("Access interface methods");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>loc=[location]</td><td>does genome location search and returns all features overlapping region. default output mode=region_gff<br>loc is format: chr17:75427837..75427870</td></tr>\n");
  print("<tr><td>segment=[location]</td><td>same as loc=... </td></tr>\n");
  print("<tr><td>types=[source,source,...]</td><td>limits results to a specific set of sources. multiple sources are separated by commas. used in both region and expression modes. if not set, all sources are used.</td></tr>\n");
  print("<tr><td>expfilter=[experiment,experiment,...]</td><td>limits results to a specific set of experiments. multiple experiments are allow and separated by commas. used in expression mode. if not set, all expression from all linked experiments in the region are used, otherwise the expression is filtered for specific experiments.</td></tr>\n");
  print("<tr><td>exptype=[type]</td><td>sets the expression data type. there are muiltiple expression types for each expression/experiment eg(raw, norm, tpm, detect). if not set, all expression data types are returned or used in calculations. the expression data types are not a fixed vocabulary and depend on the data in the EEDB server.</td></tr>\n");
  print("<tr><td>asm=[assembly name]</td><td>change the assembly. for example (hg18 mm9 rn4...)</td></tr>\n");

  print("<tr><td>format=[xml,tsv]</td><td>changes the output format of the result. XML is an EdgeExpress defined XML format, while TSV is a tab separated variable format. Default format is XML.</td></tr>\n");
  print("</table>\n");

  print h2("Control modes");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>mode=genescan</td><td>performs a simple expression scan for top expressed genes</td></tr>\n");
  print("<tr><td>submode=[submode]</td><td> available submodes:full_feature, subfeature.</td></tr>\n");
  print("</table>\n");

}

#########################################################################################

sub init_db {
  my $self = shift;
  parse_conf($self, 'eedb_server.conf');

  $eeDB = EEDB::Database->new_from_url($eeDB_url);
  $self->{"start_peer"} = EEDB::Peer->fetch_self($eeDB);

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
}

sub parse_conf {
  my $self = shift;
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
      if($confPtr->{TYPE} eq 'REGION') {
        if(defined($confPtr->{'assembly'}) and !defined($self->{'assembly_name'})) {
          $self->{'assembly_name'}=$confPtr->{"assembly"};
        }
      }
    }
  }
}


#
####################################################
#


sub input_stream {
  my $self = shift;

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->add_seed_peers($self->{"start_peer"});
  return undef;

  my $configOK=undef;
  if(scalar(keys(%{$self->{'peer_ids'}}))>0) {
    $stream->add_peer_ids(keys(%{$self->{'peer_ids'}}));
    $configOK = 1;
  }
  if($self->{'filter_ids'}) {
    $stream->add_source_ids(keys(%{$self->{'filter_ids'}}));
    $configOK = 1;
  }
  if($self->{'filter_sourcenames'}) { 
    $stream->add_source_names(keys(%{$self->{'filter_sourcenames'}}));
    $configOK = 1;
  }
  if(defined($self->{'expfilter'})) {
    $stream->set_experiment_keyword_filter($self->{'expfilter'});
    $configOK = 1;
  } 
  unless($configOK) { return undef; }

  my $outmode = "simple_feature";
  if($self->{'submode'} eq "subfeature") { $outmode = "subfeature"; }
  if($self->{'mode'} eq 'express') { $outmode = "expression"; }
  if($self->{'submode'} eq "expression") { $outmode = "expression"; }
  if($self->{'submode'} eq "full_feature") { $outmode = "feature"; }
  $stream->sourcestream_output($outmode);
  if($outmode eq "expression") {
    $stream->add_expression_datatype($self->{'exptype'});
  } 

  return $stream;
}

#
################################################
#

sub scan_data_stream {
  my $self = shift;
  
  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  $self->{'feature_count'} = 0;
  $self->{'count'} = 0;

  my $stream = input_stream($self);
  unless($stream) { return undef; }

  output_header($self);

  my $stream2 = new EEDB::SPStream::Feature2Expression;
  $stream2->source_stream($stream);
  $stream = $stream2;


  #
  # inject the scan/processing code in here
  #

  scan_top_entrez_gene($self, $stream);

  output_footer($self);
  return 1;
}



sub scan_top_entrez_gene {
  my $self = shift;
  my $stream1 = shift;
  
  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  printf("=========== scan_top_entrez_gene\n");
  my $total_count=0;
  my $starttime = time();

  #
  # use the Entrez genes as template to collect/sum expression
  #
  my $side_source = new EEDB::SPStream::FederatedSourceStream;
  $side_source->add_seed_peers($self->{"start_peer"});
  $side_source->add_source_ids("C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::31:::FeatureSource",
                               "4969BC8C-CDB0-11DE-BDF2-E17F10D659DE::1:::FeatureSource",
			       "C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::47:::FeatureSource",
			       "C9A7628C-B1CC-4B93-9E55-E7D99A12B7AA::50:::FeatureSource"
                              );

  my $side_expand  = new EEDB::SPStream::ExpandFeature();
  $side_expand->source_stream($side_source);
  $side_expand->upstream_distance(500);
  #$side_expand->downstream_distance(300);
  #$side_expand->{'expand_mode'} = "neighbor";

  my $stream2  = new EEDB::SPStream::TemplateCluster();
  $stream2->source_stream($stream1);
  $stream2->template_stream($side_expand);

  #
  # collect the top most expressed genes
  # combines a mix of large expression and large variance from mean
  #
  my $stream3  = new EEDB::SPStream::TopHits();
  $stream3->source_stream($stream2);
  $stream3->queue_length(200);

  my $stream = $stream3;

  print("<spstream_stack>\n");
  print($stream->xml);
  print("</spstream_stack>\n");

  $stream->stream_chromosomes("asm" => $assembly);
  while(my $chrom = $stream->next_in_stream) {
    print($chrom->xml);

    $stream->stream_by_named_region($assembly, $chrom->chrom_name); 

    while(my $obj = $stream->next_in_stream) {
      $total_count++;
    }
  }
  my $queue = $stream3->get_top_queue;
  my $count=1;
  foreach my $obj (@$queue){
    #printf(" %3d:  %s %1.3f %s\n", $count++, $obj->primary_name, $obj->significance, $obj->chrom_location);
    print($obj->xml);
  }

  printf("<note>total stream count %d</note>\n", $total_count);
}


#
################################################
#

sub fetch_region_objects {
  my $self = shift;

  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  output_header($self);

  my $stream = input_stream($self);

  my $sources = {};

  my $count=0;
  $stream->stream_by_named_region($assembly, $chrom_name, $start, $end);
  while(my $object = $stream->next_in_stream) {
    $count++;
    if($count==1) { 
      if($object->class eq "Feature") { print($object->chrom->simple_xml,"\n"); }
      if($object->class eq "Expression") { print($object->feature->chrom->simple_xml,"\n"); }
    }
    if($self->{'submode'} eq "full_feature") { 
      print($object->xml,"\n"); 
      $sources->{$object->feature_source->db_id} = $object->feature_source;
    } elsif($self->{'submode'} eq "subfeature") { 
      print($object->xml,"\n"); 
      $sources->{$object->feature_source->db_id} = $object->feature_source;
    } elsif($self->{'submode'} eq "expression") { 
      print($object->xml,"\n"); 
      $sources->{$object->experiment->db_id} = $object->experiment;
      $sources->{$object->feature->feature_source->db_id} = $object->feature->feature_source;
    } else { #default is simple_feature
      print($object->simple_xml,"\n");
      $sources->{$object->feature_source->db_id} = $object->feature_source;
    }
  }
  $self->{'feature_count'} = $count;
  $self->{'count'} = $count;
  
  foreach my $source (values(%{$sources})) {
    print($source->simple_xml);
  }

  output_footer($self);
}


sub output_header {
  my $self = shift;
  
  my $assembly_name = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};
  my $height = $self->{'height'};

  if($self->{'format'} eq 'tsv') {
    print header(-type => "text/plain");
  }

  elsif($self->{'format'} eq 'xml') {
    print header(-type => "text/xml", -charset=> "UTF8");
    printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    print("<data_stream_scan>\n");
    printf("<region asm=\"%s\" ", $assembly_name);
    if(defined($chrom_name)) { printf(" chrom=\"%s\" ", $chrom_name); }
    if(defined($start) and defined($end)) {
      printf("start=\"%d\" end=\"%d\" len=\"%d\" ", $start, $end, $end-$start);
    }
    print(" />\n");
  }

  else {
    print header(-type => "text/plain");
  }
}


sub output_footer {
  my $self = shift;

  my $total_time = (time()*1000) - $self->{'starttime'};

  if(($self->{'format'} =~ /gff/) or ($self->{'format'} eq 'bed')) {
    printf("#processtime_sec: %1.3f\n", $total_time/1000.0);
    printf("#count: %d\n", $self->{'count'});
  }
  elsif($self->{'format'} eq 'xml') {
    printf("<process_summary count=\"%d\" rawcount=\"%d\" processtime_sec=\"%1.3f\" />\n", $self->{'feature_count'}, $self->{'count'}, $total_time/1000.0);
    print("</data_stream_scan>\n");
  }
  elsif(($self->{'format'}  eq 'svg')) {
    print $self->{'svg'}->xmlify;
  }

  elsif($self->{'format'} eq 'das') {
    printf("</SEGMENT>\n");
    printf("</GFF>\n");
    printf("</DASGFF>\n");      
  }

  elsif(($self->{'format'}  eq 'wig')) {
    printf("#processtime_sec: %1.3f\n", $total_time/1000.0);
    printf("#count: %d\n", $self->{'feature_count'});
  }
}


#
####################################################
#

sub show_source_stream {
  my $self = shift;

  my $stream = input_stream($self);
  unless($stream) { return; }

  my $xmlData = "<stream>\n" . $stream->xml . "</stream>\n";
  #$stream = new EEDB::SPStream->create_stream_from_xmlconfig($xmlData);

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  print("<stream>\n");
  print($stream->xml);
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  print("</stream>\n");
}


sub show_experiments {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<experiments>\n");

  my $exp_hash = {};
  my $peer_uuid_hash = {};
  my $in_total=0;

  my $stream = input_stream();
  unless($stream) { return; }

  my %options;
  $options{'class'} = "Experiment";
  $stream->stream_data_sources(%options);
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "Experiment");
    $in_total++;
    $exp_hash->{$source->db_id} = $source;
    $peer_uuid_hash->{$source->database->uuid} = 1;
  }

  my @experiments = values (%{$exp_hash});

  if(defined($self->{'expfilter'})) {
    printf("<filter>%s</filter>\n", $self->{'expfilter'});
  }
  printf("<result_count method=\"experiments\" total=\"%s\" filtered=\"%s\" />\n", scalar(keys(%{$global_source_cache})), scalar(@experiments));

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

  my $stream = input_stream($self);
  unless($stream) { return; }

  $stream->stream_peers();
  my $count=0;
  while(my $p2 = $stream->next_in_stream) { $count++; }
  printf("<stats count=\"%d\" />\n", $count);

  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) { 
    next unless($peer);
    print($peer->xml);
    #$peer->peer_database->disconnect;
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%{$self->{'known_sources'}})));
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</peers>\n");
}


sub show_feature_sources {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<feature_sources>\n");

  my $fsrc_hash = {};
  my $total_count=0;

  my $stream = input_stream();
  unless($stream) { return; }

  my %options;
  $options{'class'} = "FeatureSource";
  $stream->stream_data_sources(%options);
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "FeatureSource");
    $total_count++;
    $fsrc_hash->{$source->db_id} = $source;
  }
  my @fsrcs = values (%{$fsrc_hash});

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


sub get_singlenode {
  my $self = shift;

  my $stream = input_stream($self);
  unless($stream) { return; }

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

