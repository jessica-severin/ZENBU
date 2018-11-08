#!/usr/bin/perl -w
BEGIN{
    unshift(@INC, "/eeDB/src/bioperl-1.5.2_102");
    unshift(@INC, "/eeDB/src/MappedQuery_0.958/lib");
    unshift(@INC, "/eeDB/src/ZENBU_1.307/lib");
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
use File::Temp;
use XML::TreePP;

use EEDB::Database;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Expression;
use EEDB::Experiment;
use EEDB::EdgeSet;
use EEDB::FeatureSet;
use EEDB::Tools::OSCTableGenerator;
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
use EEDB::SPStream::Proxy;
use EEDB::SPStream::Dummy;
use EEDB::User;
use EEDB::Collaboration;

my $SESSION_NAME = "CGISESSID";
my $connection_count = 0;

my $global_source_cache = {};

my @seed_urls;
my @seed_peers;

my $userDB_url = undef;
my $userDB  = undef;
my $default_asm = "";

my $start_date = localtime();
my $launch_time = time();

my $SERVER_NAME = undef;
my $WEB_URL     = undef;
parse_conf('eedb_server.conf');

init_db();

while (my $cgi = new CGI::Fast) {
  process_url_request($cgi);
  $connection_count++;

  # do global cleanup to prevent memory leaks

  EEDB::Experiment->set_cache_behaviour(0);
  EEDB::FeatureSource->set_cache_behaviour(0);
  EEDB::EdgeSource->set_cache_behaviour(0);
  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);

  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->free_source_stream;
  }

}

##########################

sub process_url_request {
  my $cgi = shift;

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
  EEDB::Experiment->set_cache_behaviour(1);
  EEDB::FeatureSource->set_cache_behaviour(1);
  EEDB::EdgeSource->set_cache_behaviour(1);

  my $self = {};
  $self->{'starttime'} = time()*1000;
  $self->{'cgi'} = $cgi;

  get_webservice_url($self);

  get_session_user($self);

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
  $self->{'source_outmode'} = 'simple_feature';

  my $xmlData = $cgi->param('POSTDATA');

  #
  # process the parameters from either the URL or POST
  #
  if($xmlData) { process_xml_parameters($self); } 
  else { process_url_parameters($self); }

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
      if($id =~ /(.+)::(.+):::(.+)/) {
        my $peer = $1;
        $self->{'peer_ids'}->{$peer} = 1;
	if(defined($3) and ($3 eq "Experiment")) { $self->{'source_outmode'} = "expression"; }
      }
    }
  }
  if($self->{'peers'}) {
    my @ids = split(",", $self->{'peers'});
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }


  ##### 
  # now process
  #

  # now the location processing
  if(defined($default_asm) and !defined($self->{'assembly_name'})) {
    $self->{'assembly_name'}=$default_asm;
  }

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

  if($self->{'mode'} eq 'express') { $self->{'source_outmode'} = "expression"; }
  if($self->{'submode'} eq "expression") { $self->{'source_outmode'} = "expression"; }
  if($self->{'source_outmode'} ne "expression") {
    if($self->{'submode'} eq "subfeature") { $self->{'source_outmode'} = "subfeature"; }
    if($self->{'submode'} eq "full_feature") { $self->{'source_outmode'} = "feature"; }
  }

  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));
  $self->{'assembly_name'}='hg18' unless(defined($self->{'assembly_name'}));

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


  if(defined($self->{'genome_scan'}) and ($self->{'genome_scan'} eq "genome")) {
    if($self->{'mode'} eq 'region') {
      if(scan_data_stream($self)) { return; }
    } 
    return show_fcgi($self, $cgi);
  }

  if(defined($self->{'chrom_name'})) {
    if($self->{'mode'} eq 'express') {
      return fetch_region_expression($self); 
    } elsif($self->{'mode'} eq 'region') {
      return fetch_region_features($self); 
    } elsif($self->{'mode'} eq 'objects') {
      return fetch_region_objects($self); 
    } elsif($self->{'mode'} eq 'region_stats') {
      return get_region_stats($self); 
    } 
  }

  show_fcgi($self, $cgi);
  #printf("ERROR : URL improperly formed\n");
}


sub process_url_parameters {
  my $self = shift;

  my $cgi = $self->{'cgi'};

  $self->{'assembly_name'} = $cgi->param('asm');
  $self->{'source'} = $cgi->param('source');
  $self->{'mode'} = $cgi->param('mode') if(defined($cgi->param('mode')));
  $self->{'format'} = $cgi->param('format');
  $self->{'flush'} = $cgi->param('flush');

  $self->{'id'} = $cgi->param('id') if(defined($cgi->param('id')));
  $self->{'window_width'} = $cgi->param('width') if(defined($cgi->param('width')));
  $self->{'span'} = $cgi->param('span') if(defined($cgi->param('span')));
  $self->{'expression_split'} = $cgi->param('strand_split') if(defined($cgi->param('strand_split')));
  $self->{'exptype'} = $cgi->param('exptype') if(defined($cgi->param('exptype')));
  $self->{'exptype'} = $cgi->param('datatype') if(defined($cgi->param('datatype')));
  $self->{'binning'} = $cgi->param('binning') if(defined($cgi->param('binning')));
  $self->{'submode'} = $cgi->param('submode') if(defined($cgi->param('submode')));
  $self->{'track_title'} = $cgi->param('track_title') if(defined($cgi->param('track_title')));
  $self->{'savefile'} = $cgi->param('savefile') if(defined($cgi->param('savefile')));
  $self->{'genome_scan'} = $cgi->param('genome_scan') if(defined($cgi->param('genome_scan')));

  $self->{'source_ids'} = $cgi->param('source_ids') if(defined($cgi->param('source_ids')));
  $self->{'peers'} = $cgi->param('peers') if(defined($cgi->param('peers')));

  $self->{'loc'} = $cgi->param('loc');
  $self->{'loc'} = $cgi->param('segment') if(defined($cgi->param('segment')));
  $self->{'chrom_name'} = $cgi->param('chrom') if(defined($cgi->param('chrom')));

  $self->{'fsrc_names'} = $cgi->param('fsrc_filters') if(defined($cgi->param('fsrc_filters')));
  $self->{'fsrc_names'} = $cgi->param('types') if(defined($cgi->param('types')));
  $self->{'fsrc_names'} = $cgi->param('sources') if(defined($cgi->param('sources')));

  $self->{'expfilter'} = $cgi->param('expfilter') if(defined($cgi->param('expfilter')));
  $self->{'expfilter'} = $cgi->param('exp_filter') if(defined($cgi->param('exp_filter')));
  $self->{'expfilter'} = $cgi->param('filter') if(defined($cgi->param('filter')));
}


sub process_xml_parameters {
  my $self = shift;

  my $cgi = $self->{'cgi'};

  my $xmlData = $cgi->param('POSTDATA');
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  if(!defined($tree)) { return; }
  if(!defined($tree->{"eeDB_region_query"})) { return; }

  $self->{'source_ids'} = $tree->{"eeDB_region_query"}->{'source_ids'} if($tree->{"eeDB_region_query"}->{'source_ids'});
  $self->{'peers'} = $tree->{"eeDB_region_query"}->{'peer_names'} if($tree->{"eeDB_region_query"}->{'peer_names'});
  $self->{'fsrc_names'} = $tree->{"eeDB_region_query"}->{'source_names'} if($tree->{"eeDB_region_query"}->{'source_names'});

  $self->{'assembly_name'} = $tree->{"eeDB_region_query"}->{'asm'} if($tree->{"eeDB_region_query"}->{'asm'});
  $self->{'chrom_name'} = $tree->{"eeDB_region_query"}->{'chrom'} if($tree->{"eeDB_region_query"}->{'chrom'});
  $self->{'loc'} = $tree->{"eeDB_region_query"}->{'loc'} if($tree->{"eeDB_region_query"}->{'loc'});

  $self->{'format'} = $tree->{"eeDB_region_query"}->{'format'} if($tree->{"eeDB_region_query"}->{'format'});
  $self->{'mode'} = $tree->{"eeDB_region_query"}->{'mode'} if($tree->{"eeDB_region_query"}->{'mode'});
  $self->{'submode'} = $tree->{"eeDB_region_query"}->{'submode'} if($tree->{"eeDB_region_query"}->{'submode'});
  $self->{'track_title'} = $tree->{"eeDB_region_query"}->{'track_title'} if($tree->{"eeDB_region_query"}->{'track_title'});
  $self->{'savefile'} = $tree->{"eeDB_region_query"}->{'savefile'} if($tree->{"eeDB_region_query"}->{'savefile'});
  $self->{'genome_scan'} = $tree->{"eeDB_region_query"}->{'genome_scan'} if($tree->{"eeDB_region_query"}->{'genome_scan'});

  $self->{'window_width'} = $tree->{"eeDB_region_query"}->{'display_width'} if($tree->{"eeDB_region_query"}->{'display_width'});
  $self->{'exptype'} = $tree->{"eeDB_region_query"}->{'exptype'} if($tree->{"eeDB_region_query"}->{'exptype'});
  $self->{'binning'} = $tree->{"eeDB_region_query"}->{'binning'} if($tree->{"eeDB_region_query"}->{'binning'});
  $self->{'expfilter'} = $tree->{"eeDB_region_query"}->{'expfilter'} if($tree->{"eeDB_region_query"}->{'expfilter'});

  if($tree->{"eeDB_region_query"}->{"zenbu_script"}) { build_processing_stream($self, $tree->{"eeDB_region_query"}); }
}


sub show_fcgi {
  my $self = shift;
  my $cgi = shift;

  my $id = $cgi->param("id"); 

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
  if($userDB) { printf("<br>user_db : %s\n",$userDB->url); }
  printf("<br>default assembly : %s\n", $self->{"assembly_name"});
  if($self->{'user_profile'}) {
    printf("<br>profile email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>profile openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
  }
  print hr;

  #if(defined($id)) { printf("<h2>id = %d</h2>\n", $id); }
  print("<table border=1 cellpadding=10><tr>");
  printf("<td>%d features in cache</td>", EEDB::Feature->get_cache_size);
  printf("<td>%d edges in cache</td>", EEDB::Edge->get_cache_size);
  print("</tr></table>");
  
  show_api($cgi);
  print end_html;
}

sub show_api {
  my $cgi = shift;
  
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

sub get_webservice_url {
  my $self = shift;

  my $serverName = $ENV{'SERVER_NAME'};
  my $httpHost = $ENV{'HTTP_HOST'};
  my $serverPort = $ENV{'SERVER_PORT'};
  my $docURI = $ENV{'DOCUMENT_URI'};
  my $requestURI = $ENV{'REQUEST_URI'};

  my $idx = index($requestURI, "/cgi/");
  if($idx>=0) { $requestURI = substr($requestURI, 0 , $idx); }

  if(!defined($SERVER_NAME)) { $SERVER_NAME = $serverName; }
  if(!defined($WEB_URL))     { $WEB_URL = "http://" .$serverName. $requestURI; }

  EEDB::Peer->current_web_url($WEB_URL);
}


#########################################################################################

sub init_db {
  if(scalar(@seed_peers)>0) { return; }

  foreach my $url (@seed_urls) {
    my $db = EEDB::Database->new_from_url($url);
    my $peer = EEDB::Peer->fetch_self($db);
    if($peer and $peer->test_is_valid) { push @seed_peers, $peer; }
    $db->disconnect;
  }

  if($userDB_url) {
    $userDB = EEDB::Database->new_from_url($userDB_url);
    unless($userDB->test_connection) { $userDB = undef; }
  }

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
}

sub disconnect_db {
  if($userDB) { $userDB->disconnect; }
  foreach my $peer (@seed_peers) {
    unless($peer) { next; }
    $peer->disconnect;
  }
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
        $userDB_url = $confPtr->{'user_db'};
        if($confPtr->{'session_name'}) { $SESSION_NAME = $confPtr->{'session_name'}; }
        if($confPtr->{'seeds'}) { @seed_urls = @{$confPtr->{'seeds'}}; }
      }
      if($confPtr->{TYPE} eq 'EEDB_ENV') {
        if($confPtr->{'EEDB_ROOT'}) { $ENV{EEDB_ROOT} = $confPtr->{'EEDB_ROOT'}; }
        if($confPtr->{'EEDB_USER_ROOTDIR'}) { $ENV{EEDB_USER_ROOTDIR} = $confPtr->{'EEDB_USER_ROOTDIR'}; }
      }
      if($confPtr->{TYPE} eq 'ZENBU_WEB') {
        if($confPtr->{'WEB_ROOT'}) { $WEB_URL = $confPtr->{'WEB_ROOT'}; }
        if($confPtr->{'SERVER_NAME'}) { $SERVER_NAME = $confPtr->{'SERVER_NAME'}; }
      }
      if($confPtr->{TYPE} eq 'REGION') {
        if(defined($confPtr->{'assembly'})) {
          $default_asm=$confPtr->{"assembly"};
        }
      }
    }
  }
}


sub get_session_user {
  my $self = shift;

  unless($self) { return; }

  $self->{'user_profile'}= undef;
  $self->{'session'} = undef;

  unless($userDB) { return; }

  my $cgi = $self->{'cgi'};
  unless($cgi) { return; }

  my $sid = $cgi->cookie($SESSION_NAME) || undef;
  unless($sid) { return; }

  my $dbh = $userDB->get_connection();
  unless($dbh) { return; }
      
  my $sql = "SELECT a_session FROM sessions WHERE id=?";
  my $sessionXML = $userDB->fetch_col_value($sql, $sid);
  unless($sessionXML) { return; }

  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($sessionXML);

  if(!defined($tree)) { return; }
  if(!defined($tree->{"zenbu_session"})) { return; }

  $self->{'session'} = {};
  $self->{'session'}->{'id'} = $sid;  
  
  unless($tree->{"zenbu_session"} =~ /HASH/) { return; }
  
  foreach my $key (keys(%{$tree->{'zenbu_session'}})) {
    my $value = $tree->{"zenbu_session"}->{$key};
    $self->{'session'}->{$key} = $value;
  }

  #now check session for user openID and get user
  my $openID = $self->{'session'}->{"eedb_validated_user_openid"};
  unless($openID) { return; }

  if($openID) {
    my $user = EEDB::User->fetch_by_openID($userDB, $openID);
    if($user) { $self->{'user_profile'}= $user; }
  }

  $userDB->disconnect;
}

#
####################################################
#


sub secured_federated_source_stream {
  my $self = shift;

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->allow_full_federation_search(0);
  $stream->clone_peers_on_build(1);

  if($self->{'user_profile'}) {
    my $user_reg = $self->{"user_profile"}->user_registry;
    if($user_reg) { $stream->add_seed_peers($user_reg); }
  }

  foreach my $peer (@seed_peers) {
    $stream->add_seed_peers($peer);
  }

  if($self->{'user_profile'}) {
    my $collaborations = $self->{'user_profile'}->member_collaborations;
    foreach my $collaboration (@{$collaborations}) {
      $stream->add_seed_peers($collaboration->group_registry);
    }
  }

  return $stream;
}


sub input_stream {
  my $self = shift;

  my $stream = secured_federated_source_stream($self);

  if(scalar(keys(%{$self->{'peer_ids'}}))>0) {
    $stream->add_peer_ids(keys(%{$self->{'peer_ids'}}));
  } else {
    # add dummy UUID to prevent full federation dump only allows 
    # query from specified peers and sources, otherwise returns nothing
    $stream->add_peer_ids("add09f3b-200c-468f-bfc7-67e3ac9e80ee");
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

  my $outmode = $self->{'source_outmode'};
  $stream->sourcestream_output($outmode);
  if($outmode eq "expression") {
    $stream->add_expression_datatype($self->{'exptype'});
  } 

  if(defined($self->{'_stream_processing'})) {
    $self->{'_stream_processing'}->{'tail'}->source_stream($stream);
    $stream = $self->{'_stream_processing'}->{'head'};
  }

  return $stream;
}


sub build_processing_stream {
  my $self = shift;
  my $tree = shift;
  
  $self->{'_stream_processing'} = undef;

  unless($tree->{"zenbu_script"}) { return undef; }
  $tree = $tree->{"zenbu_script"};
  if($tree =~ /ARRAY/) { return undef; }

  # parse the <stream_stack> into SPStream chain

  EEDB::SPStream::Proxy->clear_global_proxy_cache;
  my $stream_stack = $tree->{'stream_stack'};
  my ($head,$tail) = EEDB::SPStream->create_stream_from_xmltree($stream_stack);

  #
  # then parse the <datastream> into secured FederatedSourceStream
  # and replace the proxy elements in script with FederatedSourceStream

  my $datastreams = $tree->{'datastream'};
  if($datastreams) { 
    unless($datastreams =~ /ARRAY/) { $datastreams = [$datastreams]; }
    foreach my $datastream (@$datastreams) {
      my $source_ids = {};
      my $sources = $datastream->{'source'};
      unless($sources) { next; }
      unless($sources =~ /ARRAY/) { $sources = [$sources]; }
      foreach my $source (@$sources) {
        $source_ids->{$source->{'-id'}} = $source->{'-name'};
      }
      unless(scalar(keys(%$source_ids))>0) { next; }

      my $proxies = EEDB::SPStream::Proxy->get_proxies_by_name($datastream->{'-name'});
      foreach my $proxy (@$proxies) {
        my $stream = secured_federated_source_stream($self);

        if($datastream->{'-output'}) {
          $stream->sourcestream_output($datastream->{'-output'});
        }
        if($datastream->{'-exptype'}) {
          $stream->add_expression_datatype($datastream->{'-exptype'});
        }
        $stream->add_source_ids(keys(%$source_ids));

        $proxy->proxy_stream($stream);
      }
    }
  }

  if(defined($head) and defined($tail)) {
    $self->{'_stream_processing'} = {};
    $self->{'_stream_processing'}->{'head'} = $head;
    $self->{'_stream_processing'}->{'tail'} = $tail;
  }
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

  my $stream = input_stream($self);

  output_header($self, $stream);

  if($self->{'_stream_processing'} and ($self->{'format'} eq 'xml')) { 
    my $processing_xml = $self->{'_stream_processing'}->{'head'}->xml;
    printf("<stream_processing>%s</stream_processing>\n", $processing_xml);
  }

  if($self->{'format'} eq 'debug') { 
    printf("mode:%s  submode:%s\n", $self->{'mode'}, $self->{'submode'});
  }

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
    if($self->{'_stream_processing'}) { 
      my $processing_xml = $self->{'_stream_processing'}->{'head'}->xml;
      printf("<stream_processing>%s</stream_processing>\n", $processing_xml);
    }
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
  if($self->{'format'} eq 'xml') { print("</express_region>\n"); }
  
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

  my $stream = input_stream($self);

  output_header($self, $stream);

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

    if($object->class eq "Feature") {
      if(!defined($sources->{$object->feature_source->db_id})) {
        $sources->{$object->feature_source->db_id} = $object->feature_source;
      }
    }
    if($object->class eq "Expression") {
      my $f1 = $object->feature;
      if(!defined($sources->{$f1->feature_source->db_id})) {
        $sources->{$f1->feature_source->db_id} = $f1->feature_source;
      }
      if(!defined($sources->{$object->experiment->db_id})) {
        $sources->{$object->experiment->db_id} = $object->experiment;
      }
    }

    if($self->{'submode'} eq "full_feature") { 
      print($object->xml,"\n"); 
    } elsif($self->{'submode'} eq "subfeature") { 
      print($object->xml,"\n"); 
    } elsif($self->{'submode'} eq "expression") { 
      print($object->xml,"\n"); 
    } else { #default is simple_feature
      print($object->simple_xml,"\n");
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

  my $stream = input_stream($self);
  output_header($self, $stream);

  if($self->{'_stream_processing'} and ($self->{'format'} eq "xml")) { 
    my $processing_xml = $self->{'_stream_processing'}->{'head'}->xml;
    printf("<stream_processing>%s</stream_processing>\n", $processing_xml);
  }

  my $stream2 = new EEDB::SPStream::Expression2Feature;
  $stream2->source_stream($stream);
  $stream = $stream2;

  my $count=0;
  my @sources;
  foreach my $source (values(%{$self->{'known_sources'}})) {
    if($self->{'format'} =~ /^bed/) { $source->display_info; }
  }

  $stream->stream_by_named_region($assembly, $chrom_name, $start, $end);
  while(my $feature = $stream->next_in_stream) {
    $count++;
    if($self->{'format'} eq 'gff3') { print($feature->gff_description,"\n"); }
    if($self->{'format'} =~ /^bed/) { print($feature->bed_description($self->{'format'}),"\n"); }
    if($self->{'format'} eq "osc") { print($self->{'osctable_generator'}->osctable_feature_output($feature)); }
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


sub get_region_stats {
  my $self = shift;

  my $assembly = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};

  $self->{'source_outmode'} = 'simple_feature';
  my $stream = input_stream($self);

  output_header($self, $stream);

  #my $stream2 = new EEDB::SPStream::Expression2Feature;
  #$stream2->source_stream($stream);
  #$stream = $stream2;

  my $count=0;
  $stream->stream_by_named_region($assembly, $chrom_name, $start, $end);
  while(my $feature = $stream->next_in_stream) {
    $count++;
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
  my $stream = shift;
  
  my $window_width = $self->{'window_width'};
  my $assembly_name = $self->{'assembly_name'};
  my $chrom_name = $self->{'chrom_name'};
  my $start = $self->{'start'};
  my $end = $self->{'end'};
  my $span = $self->{'span'};
  my $height = $self->{'height'};
  my $filename = "gLyphs_data_export";

  if($self->{'track_title'}) { 
    $filename = $self->{'track_title'};
    $filename =~ s/\s/_/g;
  }


  if($self->{'format'} eq "osc") {
    if($self->{'savefile'} eq 'true') {
      print header(-type => "text/plain", -attachment=>$filename.".osc");
    } else {
      print header(-type => "text/plain");
    }
    my $osctable = new EEDB::Tools::OSCTableGenerator;
    $self->{'osctable_generator'} = $osctable;
    $osctable->source_stream($stream);
    $osctable->assembly_name($assembly_name);
    $osctable->export_subfeatures(0);
    if($self->{'exptype'}) { $osctable->add_expression_datatype($self->{'exptype'}); }
    print $osctable->generate_oscheader;
  }

  elsif($self->{'format'} =~ /^bed/) {
    if($self->{'savefile'} eq 'true') {
      print header(-type => "text/plain", -attachment=>$filename.".bed");
    } else {
      print header(-type => "text/plain");
    }

    printf("browser position %s %s:%d-%d\n", $assembly_name, $chrom_name, $start, $end);
    #printf("browser hide all\n");
    if($self->{'track_title'}) {
      printf("track name=\"%s\"\n", $self->{'track_title'});
    } else {
      printf("track name=\"eedb test track\"\n");
    }
    #printf("visibility=2\n");
  }

  elsif($self->{'format'} =~ /gff/) {
    if($self->{'savefile'} eq 'true') {
      print header(-type => "text/plain", -attachment=>$filename.".gff");
    } else {
      print header(-type => "text/plain");
    }
    #printf("browser position %s %s:%d-%d\n", $assembly_name, $chrom_name, $start, $end);
    #printf("browser hide all\n");
    #if($self->{'track_title'}) {
    #  printf("track name=\"%s\"\n", $self->{'track_title'});
    #} else {
    #  printf("track name=\"eedb test track\"\n");
    #}
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
    if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }
    if($self->{'error_log'}) { printf("<error_log>%s</error_log>\n", $self->{'error_log'}); }
  }

  elsif($self->{'format'} eq 'das') {
    print header(-type => "text/xml", -charset=> "UTF8");
    printf("<?xml version=\"1.0\" standalone=\"yes\"?>\n");
    printf("<!DOCTYPE DASGFF SYSTEM \"http://www.biodas.org/dtd/dasgff.dtd\">\n");
    printf("<DASGFF>\n");
    printf("<GFF version=\"1.0\" href=\"url\">\n");
    printf("<SEGMENT id=\"%d\" start=\"%d\" stop=\"%d\" type=\"%s\" version=\"%s\" label=\"%s\">\n",
	     $chrom_name, 
             $start, 
             $end, 
             "chromosome",
             $assembly_name, 
             $chrom_name);
  }

  elsif(($self->{'format'}  eq 'wig')) {
    if($self->{'savefile'} eq 'true') {
      print header(-type => "text/plain", -attachment=>$filename.".wig");
    } else {
      print header(-type => "text/plain");
    }

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

  #if(($self->{'format'} =~ /gff/) or ($self->{'format'} =~ /^bed/)) {
  #  printf("#processtime_sec: %1.3f\n", $total_time/1000.0);
  #  printf("#count: %d\n", $self->{'count'});
  #}

  if($self->{'format'} eq 'xml') {
    printf("<process_summary count=\"%d\" rawcount=\"%d\" processtime_sec=\"%1.3f\" />\n", $self->{'feature_count'}, $self->{'count'}, $total_time/1000.0);
    print("</region>\n");
  }
  if(($self->{'format'}  eq 'svg')) {
    print $self->{'svg'}->xmlify;
  }

  if($self->{'format'} eq 'das') {
    printf("</SEGMENT>\n");
    printf("</GFF>\n");
    printf("</DASGFF>\n");      
  }

  if(($self->{'format'}  eq 'wig')) {
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

  if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }

  my $stream = input_stream($self);

  my $exp_hash = {};
  my $peer_uuid_hash = {};
  my $in_total=0;

  my %options;
  $options{'class'} = "Experiment";
  $stream->stream_data_sources(%options);
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "Experiment");
    $in_total++;
    $exp_hash->{$source->db_id} = $source;
    my $peer = EEDB::Peer->check_global_peer_cache($source->peer_uuid);
    if($peer) { $peer_uuid_hash->{$peer->uuid} = $peer; }
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
  foreach my $peer (values(%{$peer_uuid_hash})) {
    if($peer) { print($peer->xml); }
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%{$self->{'known_sources'}})));
  printf("<peer known=\"%s\" count=\"%s\" />\n", scalar(@{EEDB::Peer->global_cached_peers}), scalar(keys(%{$peer_uuid_hash})));
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</experiments>\n");
}


sub show_peers {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<peers>\n");

  if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }

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

  if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }

  my $fsrc_hash = {};
  my $total_count=0;

  my $stream = input_stream($self);
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


#########################################################################################

sub scan_data_stream {
  my $self = shift;
  
  my $assembly = $self->{'assembly_name'};
  unless($assembly) { return undef; }

  $self->{'feature_count'} = 0;
  $self->{'count'} = 0;

  my $stream = input_stream($self);
  unless($stream) { return undef; }

  # get chroms available on this stream
  my $chroms = {};
  $stream->stream_chromosomes("asm" => $assembly);
  while(my $chrom = $stream->next_in_stream) {
    if(!defined($chroms->{$chrom->chrom_name})) {
      $chroms->{$chrom->chrom_name} = $chrom;
    } elsif($chrom->chrom_length > $chroms->{$chrom->chrom_name}->chrom_length) {
      $chroms->{$chrom->chrom_name} = $chrom;
    }
  }
  if(scalar(keys(%$chroms)) == 0) { return undef; }

  output_header($self, $stream);

  if($self->{'_stream_processing'} and ($self->{'format'} eq "xml")) { 
    my $processing_xml = $self->{'_stream_processing'}->{'head'}->xml;
    printf("<stream_processing>%s</stream_processing>\n", $processing_xml);
  }

  my $stream2 = new EEDB::SPStream::Expression2Feature;
  $stream2->source_stream($stream);
  $stream = $stream2;

  my $count=0;
  my @sources;
  foreach my $source (values(%{$self->{'known_sources'}})) {
    if($self->{'format'} =~ /^bed/) { $source->display_info; }
  }

  foreach my $chrom (sort{$a->chrom_length <=> $b->chrom_length} values(%$chroms)) {
    if($self->{'format'} eq "xml") { print($chrom->simple_xml,"\n"); }
    $stream->stream_by_named_region($assembly, $chrom->chrom_name); 

    while(my $feature = $stream->next_in_stream) {
      $count++;
      if($self->{'format'} eq 'gff3') { print($feature->gff_description,"\n"); }
      if($self->{'format'} =~ /^bed/) { print($feature->bed_description($self->{'format'}),"\n"); }
      if($self->{'format'} eq "osc") { print($self->{'osctable_generator'}->osctable_feature_output($feature)); }
      if($self->{'format'} eq 'das') { print($feature->dasgff_xml,"\n"); }
      if($self->{'format'} eq 'svg') { simple_feature_glyph($self, $feature, ($count % 30)); }
      if($self->{'format'} eq 'xml') {
        if($self->{'submode'} eq "subfeature") { xml_full_feature($feature); }
        else { print($feature->simple_xml,"\n"); }
      }
    }
  }
  $self->{'feature_count'} = $count;
  $self->{'count'} = $count;

  output_footer($self);
  return 1;
}

