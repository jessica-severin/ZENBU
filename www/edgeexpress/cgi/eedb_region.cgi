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

  $self->{'window_width'} = 640;
  $self->{'expression_split'} = 1;
  $self->{'exptype'} = '';
  $self->{'binning'} = 'sum';
  $self->{'mode'} = 'region';
  $self->{'submode'} = 'area';
  $self->{'test_spstream'} = undef;

  $self->{'fcgi_session'} = $fcgi_session;
  $self->{'assembly_name'} = $fcgi_session->param('asm');
  $self->{'source'} = $fcgi_session->param('source');
  $self->{'mode'} = $fcgi_session->param('mode') if(defined($fcgi_session->param('mode')));
  $self->{'format'} = $fcgi_session->param('format');
  $self->{'flush'} = $fcgi_session->param('flush');

  $self->{'id'} = $fcgi_session->param('id') if(defined($fcgi_session->param('id'))); 
  $self->{'window_width'} = $fcgi_session->param('width') if(defined($fcgi_session->param('width'))); 
  $self->{'span'} = $fcgi_session->param('span') if(defined($fcgi_session->param('span'))); 
  $self->{'expression_split'} = $fcgi_session->param('strand_split') if(defined($fcgi_session->param('strand_split'))); 
  $self->{'exptype'} = $fcgi_session->param('exptype') if(defined($fcgi_session->param('exptype'))); 
  $self->{'exptype'} = $fcgi_session->param('datatype') if(defined($fcgi_session->param('datatype'))); 
  $self->{'binning'} = $fcgi_session->param('binning') if(defined($fcgi_session->param('binning'))); 
  $self->{'submode'} = $fcgi_session->param('submode') if(defined($fcgi_session->param('submode'))); 
  $self->{'test_spstream'} = $fcgi_session->param('spstream') if(defined($fcgi_session->param('spstream'))); 

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

  if(defined($self->{'format'}) and ($self->{'format'} eq 'wig')) {
    $self->{'mode'} = 'express';
  }
  if($self->{'mode'} =~ /express_(.*)/) {
    $self->{'mode'} = 'express';
    $self->{'submode'} = $1;
  }


  $self->{'mode'} ='region' unless(defined($self->{'mode'}));
  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'format'}='bed' unless(defined($self->{'format'}));
  $self->{'assembly_name'}='hg18' unless(defined($self->{'assembly_name'}));
  $self->{'assembly_name'}=$self->{'assembly_name'};

  $self->{'window_width'} = 640 unless(defined($self->{'window_width'}));
  $self->{'window_width'} = 200 if($self->{'window_width'} < 200);

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


  if(defined($self->{'chrom_name'})) {
    if($self->{'mode'} eq 'express') {
      return fetch_region_expression($self); 
    } elsif($self->{'mode'} eq 'region') {
      return fetch_region_features($self); 
    } elsif($self->{'mode'} eq 'objects') {
      return fetch_region_objects($self); 
    } 
  }

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
  print start_html("EdgeExpressDB Fast CGI object server");
  print h1("Fast CGI object server (perl)");
  print p("eedb_region.cgi<br>\n");
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
  print("<tr><td>binning=[mode]</td><td>sets the expression binning mode [sum, mean, max, min, stddev]. when multiple expression value overlap the same binning region, this is the method for combining them. default [sum]</td></tr>\n");
  print("<tr><td>asm=[assembly name]</td><td>change the assembly. for example (hg18 mm9 rn4...)</td></tr>\n");

  print("<tr><td>format=[xml,gff2,gff3,bed,das,wig,svg]</td><td>changes the output format of the result. XML is an EdgeExpress defined XML format, while
GFF2, GFF3, and BED are common formats.  XML is supported in all access modes, but GFF2, GFF3, and BED are only available in direct feauture access modes. Default format is BED.</td></tr>\n");
  print("<tr><td>width=[number]</td><td>set the display width for svg drawing</td></tr>\n");
  print("<tr><td>strand_split=[0,1]</td><td>in expression mode, toggles whether the expression is split for each strand or combined</td></tr>\n");
  print("</table>\n");

  print h2("Control modes");
  print("<table cellpadding =3 width=100%>\n");
  print("<tr><td width=20% style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">cgi parameter</td>\n");
  print("<td style=\"border-bottom-color:#990000;border-bottom-width:2px;border-bottom-style:solid;font-weight:bold;\">description</td></tr>\n");
  print("<tr><td>mode=region</td><td>Returns features in region in specified format</td></tr>\n");
  print("<tr><td>mode=express</td><td>Returns features in region as expression profile (wig or svg formats)</td></tr>\n");
  print("<tr><td>submode=[submode]</td><td> available submodes:area, 5end, 3end, subfeature. 'area,5end,3end' are used for expression and 'subfeature' is used in region</td></tr>\n");
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

  if(scalar(keys(%{$self->{'peer_ids'}}))>0) {
    $stream->add_peer_ids(keys(%{$self->{'peer_ids'}}));
  }
  if($self->{'filter_ids'}) {
    $stream->add_source_ids(keys(%{$self->{'filter_ids'}}));
  }
  if($self->{'filter_sourcenames'}) { 
    $stream->add_source_names(keys(%{$self->{'filter_sourcenames'}}));
  }
  if(defined($self->{'expfilter'})) {
    $stream->set_experiment_keyword_filter($self->{'expfilter'});
  } 

  my $outmode = "simple_feature";
  if($self->{'submode'} eq "subfeature") { $outmode = "subfeature"; }
  if($self->{'mode'} eq 'express') { $outmode = "expression"; }
  if($self->{'submode'} eq "expression") { $outmode = "expression"; }
  if($self->{'submode'} eq "full_feature") { $outmode = "feature"; }
  $stream->sourcestream_output($outmode);
  if($outmode eq "expression") {
    $stream->add_expression_datatype($self->{'exptype'});
  } 

  if(defined($self->{'test_spstream'}) and ($self->{'test_spstream'} eq "overlapcluster")) {
    $stream = spstream_cluster_test($self, $stream);
  }

  return $stream;
}

sub spstream_cluster_test {
  my $self = shift;
  my $stream1 = shift;

  my $stream2a = new EEDB::SPStream::Feature2Expression;
  $stream2a->source_stream($stream1);

  my $stream3  = new EEDB::SPStream::OverlapCluster();
  $stream3->distance(20);
  $stream3->overlap_mode("5end");
  #$stream3->overlap_mode("area");
  $stream3->source_stream($stream2a);

  my $stream4  = new EEDB::SPStream::CutoffFilter();
  $stream4->min_cutoff(15.0);
  $stream4->source_stream($stream3);

  return $stream4;
}

sub user_stream_process {
  my $self = shift;
  my $stream1 = shift;

  #expand the XML into a stream
  #inject here

  return $stream1;
}

#
################################################
#

sub fetch_region_expression {
  my $self = shift;
  
  #$self->{'starttime'} = time()*1000;

  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  my $window_width = $self->{'window_width'};

  if(!defined($self->{'span'})) {
    my $span = ($end - $start) / $window_width; 
    if($self->{'format'}  eq 'wig') {
      $span = floor($span + 0.5);
      $span=300 if($span>300);
      $span=1 if($span<1);
    }
    $self->{'span'} = $span;
  }

  my $span = $self->{'span'};
  $self->{'height'} = 120;
  $self->{'feature_count'} = 0;
  $self->{'count'} = 0;

  output_header($self);

  if($self->{'format'} eq 'debug') { 
    printf("mode:%s  submode:%s\n", $self->{'mode'}, $self->{'submode'});
  }

  my $stream = input_stream($self);

  my $stream2 = new EEDB::SPStream::Feature2Expression;
  $stream2->source_stream($stream);
  $stream = $stream2;

  my $experiment_expression = {};
  my $experiments = {};

  my $windows={};

  $stream->stream_by_named_region($assembly, $chrom_name, $start, $end); 
  while(my $express = $stream->next_in_stream) {
    $self->{'count'}++;
    my $feature = $express->feature;
    my $expID = $express->experiment->db_id;      
    my $tval = $express->value; 

    next unless($express->experiment->is_active eq "y");
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    next if($tval == 0.0);

    unless($experiments->{$expID}) { $experiments->{$expID} = $express->experiment; }

    #collect all the expression in this region and organize by experiment
    $experiment_expression->{$expID} += $express->value; 

    $self->{'feature_count'}++;
    my $win_start = floor(($feature->chrom_start - $start) / $span);
    my $win_end   = floor(($feature->chrom_end - $start) / $span);
    my $numbins = $win_end - $win_start+1;
    if($self->{'submode'} eq "5end") {
      $numbins=1;
      if($feature->strand eq "-") { $win_start = $win_end; } #just use the end
      else { $win_end = $win_start; } #just use the start 
    }
    if($self->{'submode'} eq "3end") {
      $numbins=1;
      if($feature->strand eq "-") { $win_end = $win_start; } #just use the start
      else { $win_start = $win_end; } #just use the end 
    }
    if($self->{'submode'} eq "area") { $tval = $express->value / $numbins; } 
    my $strand = $feature->strand;

    #printf("%d - %d :: %s\n", $win_start, $win_end, $feature->chrom_location);
    #if($self->{'format'} eq 'debug') {  print($express->xml); }

    if($strand eq "") { $strand = "+"; }

    for(my $x = $win_start; $x<=$win_end; $x++) {

      unless(defined($windows->{$x})) {
        $windows->{$x}->{'all'} = 0;
        $windows->{$x}->{'+'} = 0;
        $windows->{$x}->{'-'} = 0;
      }
      $windows->{$x}->{'all'} += $tval;
      $windows->{$x}->{$strand} += $tval; 
      $windows->{$x}->{'count'}++; 
      $windows->{$x}->{$strand."count"}++; 

      unless(defined($windows->{$x}->{$expID})) { 
        $windows->{$x}->{$expID} = {'all'=>0, '+'=>0, '-'=>0}; 
      }
      my $winExp = $windows->{$x}->{$expID}; 
      $windows->{$x}->{$expID}->{'all'} += $tval;
      $windows->{$x}->{$expID}->{$strand} += $tval;
      
      if($express->value > 0.0) {
        $winExp->{'count'}++; 
        $winExp->{$strand."count"}++; 

        if($self->{'binning'} eq "min") {
          if(!defined($windows->{$x}->{'min'}) or 
             ($windows->{$x}->{'min'} > $express->value)) { $windows->{$x}->{'min'} = $express->value; } 
          if(!defined($windows->{$x}->{$strand.'min'}) or 
             ($windows->{$x}->{$strand.'min'} > $express->value)) { $windows->{$x}->{$strand.'min'} = $express->value; } 

          if(!defined($winExp->{'min'}) or 
             ($winExp->{'min'} > $express->value)) { $winExp->{'min'} = $express->value; } 
          if(!defined($winExp->{$strand.'min'}) or 
             ($winExp->{$strand.'min'} > $express->value)) { $winExp->{$strand.'min'} = $express->value; } 
        }
        if($self->{'binning'} eq "max") {
          if(!defined($windows->{$x}->{'max'}) or 
             ($windows->{$x}->{'max'} < $express->value)) { $windows->{$x}->{'max'} = $express->value; } 
          if(!defined($windows->{$x}->{$strand.'max'}) or 
             ($windows->{$x}->{$strand.'max'} < $express->value)) { $windows->{$x}->{$strand.'max'} = $express->value; } 

          if(!defined($winExp->{'max'}) or 
             ($winExp->{'max'} < $express->value)) { $winExp->{'max'} = $express->value; } 
          if(!defined($winExp->{$strand.'max'}) or 
             ($winExp->{$strand.'max'} < $express->value)) { $winExp->{$strand.'max'} = $express->value; } 
        }
      }
    }
  }  #end streaming expression into windows

  if($self->{'format'} eq 'xml') {
    printf("<params expression_type=\"%s\" submode=\"%s\" />",  $self->{'exptype'}, $self->{'submode'});
    if($self->{'sources'}) {
      print("<sources>\n");
      foreach my $source (@{$self->{'sources'}}) { print($source->simple_xml); }
      print("</sources>\n");
    }
    printf("<experiments count=\"%s\">\n", scalar(keys(%$experiments)));
    if(defined($self->{'expfilter'})) { printf("<filter>%s</filter>\n", $self->{'expfilter'}); }
    foreach my $experiment (values(%$experiments)) {
      next unless($experiment);
      print($experiment->simple_xml);
    }
    print("</experiments>\n");
    #printf("<stream>%s</stream>\n", $stream->xml);
    printf("<express_region asm=\"%s\" chrom=\"%s\" start=\"%d\" end=\"%d\" len=\"%d\" win_width=\"%d\" binspan=\"%1.3f\" >", 
            $self->{'assembly_name'}, $chrom_name, $start, $end, 
            $end-$start, 
            $self->{'window_width'},
            $self->{'span'});

  }

  foreach my $win (sort {$a <=> $b} keys(%$windows)) {
    if($self->{'format'}  eq 'wig') {
      printf("%d\t%1.3f\n", $start + floor(($win*$span) + 0.5), $windows->{$win}->{'all'});
    } elsif($self->{'format'}  eq 'xml') {
      printf("<expressbin bin=\"%d\" start=\"%d\" ", $win, $start + floor(($win*$span) + 0.5));
      if($self->{'binning'} eq "max") {
        printf("total=\"%1.11f\" ", $windows->{$win}->{'max'});
        printf("sense=\"%1.11f\" ", $windows->{$win}->{'+max'});
        printf("antisense=\"%1.11f\" >\n", $windows->{$win}->{'-max'});
      } elsif($self->{'binning'} eq "min") {
        printf("total=\"%1.11f\" ", $windows->{$win}->{'min'});
        printf("sense=\"%1.11f\" ", $windows->{$win}->{'+min'});
        printf("antisense=\"%1.11f\" >\n", $windows->{$win}->{'-min'});
      } elsif($self->{'binning'} eq "count") {
        printf("total=\"%1.11f\" ", $windows->{$win}->{'count'});
        printf("sense=\"%1.11f\" ", $windows->{$win}->{'+count'});
        printf("antisense=\"%1.11f\" >\n", $windows->{$win}->{'-count'});
      } elsif($self->{'binning'} eq "mean") {
        printf("total=\"%1.11f\" ", ($windows->{$win}->{'all'} / $windows->{$win}->{'count'}));
        if($windows->{$win}->{'+count'} > 0) {
          printf("sense=\"%1.11f\" ", ($windows->{$win}->{'+'} / $windows->{$win}->{'+count'}));
        } else { printf("sense=\"0.0\" "); }
        if($windows->{$win}->{'-count'}>0) {
          printf("antisense=\"%1.11f\" >\n", ($windows->{$win}->{'-'} / $windows->{$win}->{'-count'}));
        } else { printf("antisense=\"0.0\" >\n"); }
      } else {
        printf("total=\"%1.11f\" ", $windows->{$win}->{'all'});
        printf("sense=\"%1.11f\" ", $windows->{$win}->{'+'});
        printf("antisense=\"%1.11f\" >\n", $windows->{$win}->{'-'});
      }

      foreach my $expID (sort {$a cmp $b} keys(%{$windows->{$win}})) {
        #printf("<exp id=\"%s\" />\n", $expID);
        my $exp = $experiments->{$expID};
        next unless($exp);
        next unless($windows->{$win}->{$expID});
        print("<exp_express ");
        printf("exp_id=\"%s\" ", $exp->db_id) if($exp->db_id);
        printf("datatype=\"%s\" ", $self->{'exptype'});
        
        if($self->{'binning'} eq "max") {
	  printf("total=\"%1.11g\" ", $windows->{$win}->{$expID}->{'max'});
          printf("sense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+max'});
          printf("antisense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-max'});
        } elsif($self->{'binning'} eq "min") {
          printf("total=\"%1.11g\" ", $windows->{$win}->{$expID}->{'min'});
          printf("sense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+min'});
          printf("antisense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-min'});
        } elsif($self->{'binning'} eq "count") {
          printf("total=\"%1.11f\" ", $windows->{$win}->{$expID}->{'count'});
          printf("sense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+count'});
          printf("antisense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-count'});
        } elsif($self->{'binning'} eq "mean") {
          printf("total=\"%1.11f\" ", $windows->{$win}->{$expID}->{'all'});
          printf("sense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+'});
          printf("antisense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-'});
          printf("total_count=\"%d\" ", $windows->{$win}->{$expID}->{'count'});
          printf("sense_count=\"%d\" ", $windows->{$win}->{$expID}->{'+count'});
          printf("antisense_count=\"%d\" ", $windows->{$win}->{$expID}->{'-count'});

          #if($windows->{$win}->{$expID}->{'+count'} > 0) {
          #  printf("sense=\"%1.11g\" ", ($windows->{$win}->{$expID}->{'+'} / $windows->{$win}->{$expID}->{'+count'}));
          #} else { printf("sense=\"0.0\" "); }
          #if($windows->{$win}->{$expID}->{'-count'}>0) {
          #  printf("antisense=\"%1.11g\" ", ($windows->{$win}->{$expID}->{'-'} / $windows->{$win}->{$expID}->{'-count'}));
          #} else { printf("antisense=\"0.0\" "); }
        } else {
	  printf("total=\"%1.11f\" ", $windows->{$win}->{$expID}->{'all'});
          printf("sense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+'});
          printf("antisense=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-'});
         # printf("sense_count=\"%d\" ", $windows->{$win}->{$expID}->{'+count'});
         # printf("antisense_count=\"%d\" ", $windows->{$win}->{$expID}->{'-count'});
         # printf("sense_min=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+min'});
         # printf("sense_max=\"%1.11g\" ", $windows->{$win}->{$expID}->{'+max'});
         # printf("antisense_min=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-min'});
         # printf("antisense_max=\"%1.11g\" ", $windows->{$win}->{$expID}->{'-max'});
        }
        print("/>\n");
      }
      print("</expressbin>\n");
    }
  }
  print("</express_region>\n");
  
  output_footer($self);
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

  #if($self->{'submode'} eq "expression") { 
  #  $stream->sourcestream_output("expression");
  #  if($self->{'exptype'}) {
  #    $stream->add_expression_datatype($self->{'exptype'});
  #  }
  #} elsif($self->{'submode'} eq "full_feature") { 
  #  $stream->sourcestream_output("feature");
  #} elsif($self->{'submode'} eq "subfeature") { 
  #  $stream->sourcestream_output("subfeature");
  #} else {
  #  $stream->sourcestream_output("simple_feature");
  #}

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


sub fetch_region_features {
  my $self = shift;

#  $self->{'starttime'} = time()*1000;
  
  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  output_header($self);

  my $stream = input_stream($self);

  my $stream2 = new EEDB::SPStream::Expression2Feature;
  $stream2->source_stream($stream);
  $stream = $stream2;

  my $count=0;
  my @sources;
  foreach my $source (values(%{$self->{'known_sources'}})) {
    if($self->{'format'} eq 'bed') { $source->display_info; }
  }

  $stream->stream_by_named_region($assembly, $chrom_name, $start, $end);
  while(my $feature = $stream->next_in_stream) {
    $count++;
    if($self->{'format'} eq 'gff3') { print($feature->gff_description,"\n"); }
    if($self->{'format'} eq 'bed') { print($feature->bed_description,"\n"); }
    if($self->{'format'} eq 'das') { print($feature->dasgff_xml,"\n"); }
    if($self->{'format'} eq 'svg') { simple_feature_glyph($self, $feature, ($count % 30)); }
    if($self->{'format'} eq 'xml') { 
      if($count==1) { print($feature->chrom->simple_xml,"\n"); }
      if($self->{'submode'} eq "subfeature") { xml_full_feature($feature); } 
      else { print($feature->simple_xml,"\n"); }
    }
  }
  $self->{'feature_count'} = $count;
  $self->{'count'} = $count;

  output_footer($self);
}

sub xml_full_feature {
  my $feature = shift;

  my $edges = $feature->edgeset->extract_category("subfeature")->edges;
  print($feature->xml_start);
  if(scalar(@$edges)) {
    print("\n  <subfeatures>\n");
    foreach my $edge (sort {(($a->feature1->chrom_start <=> $b->feature1->chrom_start) ||
                              ($a->feature1->chrom_end <=> $b->feature1->chrom_end))
                            } @{$edges}) {
      print("    ", $edge->feature1->simple_xml);
    }
    print("  </subfeatures>\n");
  }
  print($feature->xml_end);
}


sub output_header {
  my $self = shift;
  
  my $window_width = $self->{'window_width'};
  my $assembly_name = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};
  my $span = $self->{'span'};
  my $height = $self->{'height'};

  if(($self->{'format'} =~ /gff/) or ($self->{'format'} eq 'bed')) {
    print header(-type => "text/plain");
    printf("browser position %s %s:%d-%d\n", $assembly_name, $chrom_name, $start, $end);
    #printf("browser hide all\n");
    printf("track name=\"eedb test track\"\n");
    #printf("visibility=2\n");
  }

  elsif($self->{'format'} eq 'xml') {
    print header(-type => "text/xml", -charset=> "UTF8");
    printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
    printf("<region asm=\"%s\" chrom=\"%s\" win_width=\"%d\" ", $assembly_name, $chrom_name, $self->{'window_width'});
    if(defined($start) and defined($end)) {
      printf("start=\"%d\" end=\"%d\" len=\"%d\" ", $start, $end, $end-$start);
    }
    print(">\n");
  }

  elsif($self->{'format'} eq 'das') {
    print header(-type => "text/xml", -charset=> "UTF8");
    printf("<?xml version=\"1.0\" standalone=\"yes\"?>\n");
    printf("<!DOCTYPE DASGFF SYSTEM \"http://www.biodas.org/dtd/dasgff.dtd\">\n");
    printf("<DASGFF>\n");
    printf("<GFF version=\"1.0\" href=\"url\">\n");
    my $chrom = EEDB::Chrom->fetch_by_name($eeDB, $assembly_name, $chrom_name);
    if($chrom) { 
      printf("<SEGMENT id=\"%d\" start=\"%d\" stop=\"%d\" type=\"%s\" version=\"%s\" label=\"%s\">\n",
             $chrom->id, 
             $start, 
             $end, 
             $chrom->chrom_type,
             $chrom->assembly->ucsc_name, 
             $chrom->chrom_name);
    }
  }

  elsif(($self->{'format'}  eq 'wig')) {
    print header(-type => "text/plain");

    printf("browser position %s:%d-%d\n",  $chrom_name, $start, $end);
    print("browser hide all\n");
    print("browser pack refGene encodeRegions\n");
    print("browser dense gap assembly rmsk mrna est\n");
    print("browser full altGraph\n");

    print("track type=wiggle_0 name=\"CAGE_L1\" description=\"variableStep format\" ");
    #print("visibility=full autoScale=off viewLimits=0.0:25.0 color=0,255,0 ");
    print("visibility=full color=0,255,0 ");
    print("priority=10\n");
    printf("variableStep chrom=%s span=%d\n", $chrom_name, $span);
    printf("#params start=%s  end=%s  reg_len=%d  win_width=%s\n", $start, $end, $end-$start, $self->{'window_width'});
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
    print("</region>\n");
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


sub determine_levels {
  my $self = shift;
  my $features = shift;

  my $levels = 0;
  foreach my $feature (@{$features}) {
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    #next if(defined($src_hash) and !($src_hash->{$feature->feature_source->name}));
  }
}


sub simple_feature_glyph {
  my $self = shift;
  my $feature = shift;
  my $level = shift;

  my $start = floor(($feature->chrom_start - $self->{'start'}) / $self->{'svg_scale'});
  my $width = floor(($feature->chrom_end - $feature->chrom_start) / $self->{'svg_scale'});
  $width=1 if($width<1);
  $self->{'svg_g1'}->rectangle( x=>$start, y=>$level*3, width=>$width, height=>1 );
}


sub show_source_stream {
  my $self = shift;

  my $stream = input_stream($self);

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

#
####################################################
#

sub show_experiments {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<experiments>\n");

  my $exp_hash = {};
  my $peer_uuid_hash = {};
  my $in_total=0;

  my $stream = input_stream();
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

