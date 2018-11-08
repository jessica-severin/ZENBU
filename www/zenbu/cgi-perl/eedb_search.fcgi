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
use EEDB::User;
use EEDB::Collaboration;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Expression;
use EEDB::Experiment;
use EEDB::EdgeSet;
use EEDB::FeatureSet;
use EEDB::SPStream::SourceStream;
use EEDB::SPStream::MultiSourceStream;
use EEDB::SPStream::FederatedSourceStream;


my $SESSION_NAME = "CGISESSID";
my $connection_count = 0;

my @seed_urls;
my @seed_peers;

my $userDB_url = undef;
my $userDB  = undef;

my $global_source_cache = {};
my $global_source_counts = {"Experiment"=>0, "FeatureSource"=>0, "ExpressionDatatype"=>0 };

my $start_date = localtime();
my $launch_time = time();

my $SERVER_NAME = undef;
my $WEB_URL     = undef;
parse_conf('eedb_server.conf');

init_db();

while (my $cgi = new CGI::Fast) {
  process_url_request($cgi);
  $connection_count++;
  disconnect_db();
}

##########################

sub process_url_request {
  my $cgi = shift;

  my $self = {};
  $self->{'starttime'} = time()*1000;
  $self->{'cgi'} = $cgi;

  get_webservice_url($self);

  get_session_user($self);

  $self->{'known_sources'} = {};
  $self->{'apply_source_filter'} = 0;
  $self->{'filter_ids'} = {};
  $self->{'peer_ids'} = {};
  $self->{'registry_mode'} = {"public"=>1, "private"=>1, "shared"=>1};

  $self->{'id'} = $cgi->param('id');
  $self->{'limit'} = $cgi->param('limit');
  $self->{'name'} = $cgi->param('name');
  $self->{'source'} = $cgi->param('source');
  $self->{'mode'} = $cgi->param('mode');
  $self->{'format'} = $cgi->param('format');
  $self->{'savefile'} = $cgi->param('save');
  $self->{'id_list'} = $cgi->param('ids');
  $self->{'name_list'} = $cgi->param('names');
  $self->{'assembly_name'} = $cgi->param('asm');
  $self->{'chrom_name'} = $cgi->param('chrom');
  $self->{'source_outmode'} = 'simple_feature';

  if(defined($cgi->param('reload')) and ($cgi->param('reload') eq "ce818eaf70485e496")) {
    $self->{'reload_sources'} = 1; 
  }

  if(defined($cgi->param('registry_mode'))) {
    $self->{'registry_mode'} = {};
    my @modes = split(/,/, $cgi->param('registry_mode'));
    foreach my $regmode (@modes) {
      if($regmode eq "full") {
        $self->{'registry_mode'} = {"public"=>1, "private"=>1, "shared"=>1};
      }
      if(($regmode eq "private") or ($regmode eq "shared") or ($regmode eq "public")) {
        $self->{'registry_mode'}->{$regmode} = 1;
      }
    }
  }

  $self->{'source_names'} = $cgi->param('source_names') if(defined($cgi->param('source_names')));
  $self->{'source_names'} = $cgi->param('types') if(defined($cgi->param('types'))); 
  $self->{'source_names'} = $cgi->param('sources') if(defined($cgi->param('sources'))); 

  $self->{'source_categories'} = $cgi->param('categories') if(defined($cgi->param('categories'))); 

  $self->{'srcfilter'} = $cgi->param('expfilter') if(defined($cgi->param('expfilter')));
  $self->{'srcfilter'} = $cgi->param('exp_filter') if(defined($cgi->param('exp_filter'))); 
  $self->{'srcfilter'} = $cgi->param('filter') if(defined($cgi->param('filter'))); 

  if(defined($cgi->param('peer'))) {
    $self->{'peer_ids'}->{$cgi->param('peer')}=1;
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }

  if(defined($cgi->param('peers'))) {
    my @ids = split(",", $cgi->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'peers'; }
  }

  if(defined($self->{'source_names'})) {
    $self->{'apply_source_filter'} = 1;
    $self->{'filter_sourcenames'}={};
    my @names = split /,/, $self->{'source_names'};
    foreach my $name (@names) {
      $self->{'filter_sourcenames'}->{$name}=1;
    }
  }
  if(defined($self->{'source_categories'})) {
    $self->{'apply_source_filter'} = 1;
    $self->{'source_category_hash'}={};
    my @names = split /,/, $self->{'source_categories'};
    foreach my $name (@names) {
      $self->{'source_category_hash'}->{$name}=1;
    }
  }

  if(defined($self->{'name'}) and !defined($self->{'source'})) {
    $self->{'source'} = 'primaryname';
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'feature'; }
  }
  if(defined($cgi->param('search'))) {
    if(!defined($self->{'mode'})) { $self->{'mode'} = 'search'; }
    $self->{'name'} = $cgi->param('search');
  }
  if(defined($self->{'id_list'})) {
    $self->{'mode'} = 'features';
    $self->{'ids_array'} = [];
    my @ids = split /,/, $self->{'id_list'};
    foreach my $id (@ids) {
      if($id =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; push @{$self->{'ids_array'}}, $id; }
      elsif($id =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; push @{$self->{'ids_array'}}, $id; }
    }
  }

  $self->{'mode'} ='' unless(defined($self->{'mode'}));
  $self->{'savefile'} ='' unless(defined($self->{'savefile'}));
  $self->{'limit'}=1000 unless(defined($self->{'limit'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; }
    elsif($self->{'id'} =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; }
  }

  $self->{'source_ids'} = $cgi->param('source_ids') if(defined($cgi->param('source_ids')));
  if(defined($cgi->param('peers'))) {
    my @ids = split(",", $cgi->param('peers'));
    foreach my $id (@ids) { $self->{'peer_ids'}->{$id}=1; }
  }

  #########
  # pre-process some parameters
  #
  if($self->{'srcfilter'}) {
    $self->{'apply_source_filter'} = 1;
    if($self->{'format'} eq 'debug') {  printf("apply filter :: [%s]\n", $self->{'srcfilter'}); }
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
  if(defined($self->{'reload_sources'})) {
    show_peers($self);
    return;
  }

  if(defined($self->{'name'}) and ($self->{'mode'} eq 'search')) {
    search_feature($self);
    return;
  }

  if($self->{'mode'} eq 'status') {
    show_status($self);
  } elsif($self->{'mode'} eq 'feature_sources') {
    show_feature_sources($self);
  } elsif($self->{'mode'} eq 'features') {
    show_feature_list($self);
  } elsif($self->{'mode'} eq 'edge_sources') {
    show_edge_sources($self);
  } elsif($self->{'mode'} eq 'experiments') {
    show_experiments($self);
  } elsif($self->{'mode'} eq 'peers') {
    show_peers($self);
  } elsif($self->{'mode'} eq "collaborations") {
    show_collaborations($self);
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
    show_fcgi($self);
    #printf("ERROR : URL improperly formed\n");
  }

  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->disconnect;
  }
}


sub show_fcgi {
  my $self = shift;
  my $cgi = $self->{'cgi'};

  my $id = $cgi->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/html", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/html", -charset=> "UTF8");
  }
  print start_html("EdgeExpressDB Fast CGI object server");
  print h1("Fast CGI object server (perl)");
  print p("eedb_search.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>hostname : %s\n",$hostname);
  printf("<br>server_root : %s\n",$SERVER_NAME);
  printf("<br>web_url : %s\n",$WEB_URL);
  if($userDB) { printf("<br>user_db : %s\n",$userDB->url); }
  if($self->{'user_profile'}) {
    printf("<br>profile email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>profile openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<br>processtime_sec : %1.3f\n", $total_time/1000.0);
  print hr;

  #if(defined($id)) { printf("<h2>id = %d</h2>\n", $id); }
  print("<table border=1 cellpadding=10><tr>");
  printf("<td>%d knowns peers</td>", scalar(@{EEDB::Peer->global_cached_peers}));
  printf("<td>%d cached sources</td>", scalar(keys(%{$global_source_cache})));
  print("</tr></table>");
  
  show_api($cgi);
  print end_html;
}

sub show_api {
  my $cgi = shift;
  
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
  print("<tr><td>sources=[source_name,source_name,...]</td><td>used in combination with name=, and search= methods to restrict search. Both single or multiple type lists are available.</td></tr>\n");
  print("<tr><td>peers=[peer_uuid, peer_alias,...]</td><td>used to restrict query to a specific set of peers. Can be used in combination with all modes.</td></tr>\n");
  print("<tr><td>source_ids=[fedID, fedID,...]</td><td>used to restrict query to a specific set of sources. Can be used in combination with all modes.</td></tr>\n");
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


sub show_status {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<eedb_status>\n");

  printf("<version>1.307</version>\n");

  print("<registry_seeds>\n");
  foreach my $peer (@seed_peers) {
    print($peer->xml);
  }
  print("</registry_seeds>\n");

  printf("<web_url>%s</web_url>\n",$WEB_URL);

  printf("<cache_stats peers=\"%s\" sources=\"%s\" />\n", scalar(@{EEDB::Peer->global_cached_peers}), scalar(keys(%$global_source_cache)));

  if($self->{'user_profile'}) { print($self->{'user_profile'}->simple_xml); } 

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</eedb_status>\n");
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


sub input_stream {
  my $self = shift;

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->{'_peer_search_depth'} = 9;

  if($self->{'registry_mode'}->{"public"}) {
    foreach my $peer (@seed_peers) {
      $stream->add_seed_peers($peer);
    }
  }

  if($self->{'user_profile'}) {
    if($self->{'registry_mode'}->{"private"}) {
      if($self->{"user_profile"}->user_registry) {
        $stream->add_seed_peers($self->{"user_profile"}->user_registry);
      }
    }

    if($self->{'registry_mode'}->{"shared"}) {
      my $collaborations = $self->{'user_profile'}->member_collaborations;
      foreach my $collaboration (@{$collaborations}) {
        $stream->add_seed_peers($collaboration->group_registry);
      }
    }
    $userDB->disconnect;
  }

  if(scalar(keys(%{$self->{'peer_ids'}}))>0) {
    $stream->add_peer_ids(keys(%{$self->{'peer_ids'}}));
  }
  if($self->{'filter_ids'}) {
    $stream->add_source_ids(keys(%{$self->{'filter_ids'}}));
  }
  if($self->{'filter_sourcenames'}) {
    $stream->add_source_names(keys(%{$self->{'filter_sourcenames'}}));
  }
  #if(defined($self->{'srcfilter'})) {
  #  $stream->set_experiment_keyword_filter($self->{'srcfilter'});
  #}

  #my $outmode = $self->{'source_outmode'};
  #$stream->sourcestream_output($outmode);
  #if($outmode eq "expression") { $stream->add_expression_datatype($self->{'exptype'}); }

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
    show_fcgi($self);
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
    show_fcgi($self);
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
  my $object = $stream->fetch_object_by_id($self->{'id'});

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<objects query_id='%s'>\n", $self->{'id'});

  if($object) { 
    my $peer = EEDB::Peer->check_global_peer_cache($object->peer_uuid);
    if($peer) { print($peer->xml);  }
    print($object->xml); 
  }

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
  
  my $name = $self->{'name'};

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<results>\n");
  if(defined($name)) { printf("<query value=\"%s\" />\n", $name); }

  my $stream = input_stream($self);

  my $result_count = 0;  #undefined
  my $like_count = 0;  #undefined
  my $search_method = "like";
  my $peer_uuid_hash = {};

  my $total = 0;
  printf("<sources>\n");
  $stream->stream_data_sources('class'=>'FeatureSource');
  while (my $source = $stream->next_in_stream) {
    next unless($source->is_active eq 'y');
    next unless($source->class eq "FeatureSource");
    print($source->simple_xml);
    $total += $source->feature_count;

    my $peer = EEDB::Peer->check_global_peer_cache($source->peer_uuid);
    if($peer) { $peer_uuid_hash->{$peer->uuid} = $peer; }
  }
  printf("</sources>\n");

  printf("<peers count=\"%d\" >\n", scalar(keys(%$peer_uuid_hash)));
  foreach my $peer (values(%{$peer_uuid_hash})) {
    if($peer) { print($peer->xml); }
  }
  print("</peers>\n");

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

  printf("<result_count method=\"%s\" match_count=\"%d\" total=\"%s\" filtered=\"%s\" />\n", 
          $search_method, $result_count, $total, $filter_count);

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</results>\n");
}


sub show_all_sources {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<sources>\n");

  my $total_count=0;
  my $stream = input_stream($self);
  $stream->stream_data_sources();
  while(my $source = $stream->next_in_stream) {
    $total_count++;
    if($self->{'format'} eq 'fullxml') { print($source->xml); }
    else { print($source->simple_xml); }
  }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary total_features='%d' processtime_sec=\"%1.3f\" />\n", $total_count, $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</sources>\n");
}


sub _feature_source_sort {
  return ($a->category cmp $b->category) ||
         ($a->name cmp $b->name);
}

sub show_feature_sources {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<feature_sources>\n");

  if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }

  my %options;
  $options{'class'} = "FeatureSource";
  if(defined($self->{'srcfilter'})) { $options{'filter'} = $self->{'srcfilter'}; }
  if(defined($self->{'filter_sourcenames'})) { $options{'filter_sourcenames'} = $self->{'filter_sourcenames'}; }

  my $peer_uuid_hash = {};
  my $fsrc_hash = {};

  my $stream = input_stream($self);
  $stream->stream_data_sources(%options);
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "FeatureSource");
    if($self->{'source_category_hash'}) {
      unless($self->{'source_category_hash'}->{$source->category}) { next; }
    }

    my $peer = EEDB::Peer->check_global_peer_cache($source->peer_uuid);
    if($peer) { $peer_uuid_hash->{$peer->uuid} = $peer; }
    $fsrc_hash->{$source->db_id} = $source;

    unless($global_source_cache->{$source->db_id}) {
      $global_source_cache->{$source->db_id} = 1;
      $global_source_counts->{$source->class} += 1;
    }
  }
  my @fsrcs = values (%{$fsrc_hash});
  my $total_count = $global_source_counts->{"FeatureSource"};
  unless($total_count) { $total_count=1; }

  #print("<stream>", $stream->xml, "</stream>");
  #if(defined($self->{'srcfilter'})) {
  #  printf("<filter>%s</filter>\n", $self->{'srcfilter'});
  #}
  printf("<result_count method=\"feature_sources\" total=\"%s\" filtered=\"%s\" />\n", $total_count, scalar(@fsrcs));
  my $total_feature_count =0;
  foreach my $fsrc (sort _feature_source_sort @fsrcs) {
    if($self->{'format'} eq 'fullxml') { print($fsrc->xml); }
    else { print($fsrc->simple_xml); }
    $total_feature_count += $fsrc->feature_count;
  }
  foreach my $peer (values(%{$peer_uuid_hash})) {
    if($peer) { print($peer->xml); }
  }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary total_features='%d' processtime_sec=\"%1.3f\" />\n", $total_feature_count, $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</feature_sources>\n");
}


sub show_edge_sources {
  my $self = shift;

  my $stream = input_stream($self);

  my %options;
  $options{'class'} = "EdgeSource";
  if(defined($self->{'srcfilter'})) { $options{'filter'} = $self->{'srcfilter'}; }

  my $src_hash = {};
  $stream->stream_data_sources(%options);
  while (my $source = $stream->next_in_stream) {
    next unless($source->is_active eq 'y');
    next unless($source->class eq "EdgeSource");
    next if(defined($self->{'filter_sourcenames'}) and !($self->{'filter_sourcenames'}->{$source->name}));
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


sub _experiment_sort {
  return ($a->platform cmp $b->platform) ||
         ($a->display_name cmp $b->display_name);
}

sub show_experiments {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<experiments>\n");

  if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }

  my $stream = input_stream($self);

  my $exp_hash = {};
  my $peer_uuid_hash = {};

  my %options;
  $options{'class'} = "Experiment";
  if(defined($self->{'srcfilter'})) { $options{'filter'} = $self->{'srcfilter'}; }

  $stream->stream_data_sources(%options);
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "Experiment");
    $exp_hash->{$source->db_id} = $source;
    if($self->{'format'} ne 'minxml') { 
      my $peer = EEDB::Peer->check_global_peer_cache($source->peer_uuid);
      if($peer) { $peer_uuid_hash->{$peer->uuid} = $peer; }
    }

    unless($global_source_cache->{$source->db_id}) {
      $global_source_cache->{$source->db_id} = 1;
      $global_source_counts->{$source->class} += 1;
    }
  }
  my @experiments = values (%{$exp_hash});
  my $total_count = $global_source_counts->{"Experiment"};
  unless($total_count) { $total_count=1; }


  if(defined($self->{'srcfilter'})) {
    printf("<filter>%s</filter>\n", $self->{'srcfilter'});
  }
  printf("<result_count method=\"experiments\" total=\"%s\" filtered=\"%s\" />\n", $total_count, scalar(@experiments));

  foreach my $exp (sort _experiment_sort @experiments) {
    if($self->{'format'} eq 'fullxml') { print($exp->xml); }
    if($self->{'format'} eq 'minxml') { 
      printf("<experiment id=\"%s\" platform=\"%s\" />\n", $exp->db_id, $exp->platform);
    } else { print($exp->simple_xml); }
  }
  foreach my $peer (values(%{$peer_uuid_hash})) {
    if($peer) { print($peer->xml); }
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" loaded_sources=\"%s\"/>\n", $total_time/1000.0, scalar(keys(%$global_source_cache)));
  printf("<peer_stats known=\"%s\" count=\"%s\" />\n", scalar(@{EEDB::Peer->global_cached_peers}), scalar(keys(%{$peer_uuid_hash})));
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</experiments>\n");
}


sub _peer_sort {
  return ($a->federation_depth <=> $b->federation_depth) ||
         ($a->alias cmp $b->alias);
}


sub show_peers {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<peers>\n");

  if($self->{'user_profile'}) { print($self->{'user_profile'}->simple_xml); } 

  my @peers;
  my $stream = input_stream($self);
  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) { 
    next unless($peer);
    if($self->{'reload_sources'}) { 
      $peer->free_source_stream;
      $peer->retest_is_valid; 
    }
    next unless($peer->test_is_valid);
    push @peers, $peer;
  }

  printf("<stats count=\"%d\" />\n", scalar(@peers));
  foreach my $peer (sort _peer_sort @peers) {
    print($peer->xml);
    $peer->disconnect;
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

  my $unq_types = {};

  my $stream = input_stream($self);
  $stream->stream_data_sources();
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "ExpressionDatatype");
    $unq_types->{$source->datatype} = 1;
  }

  printf("<expression_datatypes>\n");
  foreach my $datatype (sort keys(%{$unq_types})) {
    printf("<datatype type=\"%s\"></datatype>\n", $datatype);
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("</expression_datatypes>\n");
}


sub show_chromosomes {
  my $self = shift;

  my @chroms;
  if($self->{'assembly_name'}) {
    if($self->{'chrom_name'}) {
      #my $chrom = EEDB::Chrom->fetch_by_name($eeDB, $self->{'assembly_name'}, $self->{'chrom_name'});
      #@chroms = ($chrom);
    } else {
      #@chroms = @{EEDB::Chrom->fetch_all_by_assembly_name($eeDB, $self->{'assembly_name'})};
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


sub show_feature_list {
  my $self = shift;
  
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<features>\n");

  my $stream = input_stream($self);

  my @peers;
  $stream->stream_peers();
  while(my $peer = $stream->next_in_stream) {
    next unless($peer);
    next unless($peer->test_is_valid);  #maybe redundant since this mays be done inside the SourceStream
    push @peers, $peer;
  }

  printf("<peers count=\"%d\" >\n", scalar(@peers));
  foreach my $peer (@peers) { print($peer->xml); }
  print("</peers>\n");


  my $outmode = "simple_feature";
  #if($self->{'submode'} eq "subfeature") { $outmode = "subfeature"; }
  #if($self->{'mode'} eq 'express') { $outmode = "expression"; }
  #if($self->{'submode'} eq "expression") { $outmode = "expression"; }
  #if($self->{'submode'} eq "full_feature") { $outmode = "feature"; }
  $stream->sourcestream_output($outmode);

  my $total = 0;
  my $result_count = 0;

  if(defined($self->{'ids_array'})) {
    my $stream2 = new EEDB::SPStream::StreamBuffer;
    foreach my $id (@{$self->{'ids_array'}}) {
      my $obj = $stream->fetch_object_by_id($id);
      $stream2->add_objects($obj);
    }
    $stream = $stream2;
  } else {
    printf("<sources>\n");
    $stream->stream_data_sources('class'=>'FeatureSource');
    while (my $source = $stream->next_in_stream) {
      next unless($source->is_active eq 'y');
      next unless($source->class eq "FeatureSource");
      print($source->simple_xml);
      $total += $source->feature_count;
    }
    printf("</sources>\n");
  }

  my $name = $self->{'name'};
  if(defined($name) and (length($name)>2)) {
    if($name =~ /\s/) {
      $stream->stream_features_by_metadata_search('filter' => $name);
    } else {
      $stream->stream_features_by_metadata_search('keyword_list' => $name);
    }
  } else {
    $stream->stream_all();
  }

  while(my $feature = $stream->next_in_stream) { 
    next unless($feature->feature_source);
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    $result_count++;
    if($self->{'format'} eq 'fullxml') { print($feature->xml); }
    else { print($feature->simple_xml); }
  }
  printf("<result_count total=\"%s\" expected=\"%s\" />\n", $result_count, $total);

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</features>\n");
}


sub show_collaborations {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<collaborations>\n");

  if(defined($self->{'user_profile'})) {
    print($self->{'user_profile'}->simple_xml);

    my $collaborations = $self->{'user_profile'}->member_collaborations;
    foreach my $collaboration (@{$collaborations}) {
      my $str = $collaboration->xml_start;
      if($collaboration->{'_member_status'} eq "owner") {
        $str .= "\n". $collaboration->metadataset->xml;
        my $requests = $collaboration->pending_user_requests;
        if(scalar(@$requests)>0) {
          $str .= sprintf("<user_requests count=\"%d\" >", scalar(@$requests));
          foreach my $user (@$requests) { $str .= $user->simple_xml; }
          $str .= "</user_requests>\n";
        }
      } else {
        my $descMD = $collaboration->metadataset->find_metadata("description", undef);
        if($descMD) { $str .= $descMD->xml; }
      }

      #my $mdstats = $collaboration->group_registry_stats;
      #$str .= $mdstats->xml;

      $str .= $collaboration->xml_end;
      print($str);
    }
  }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</collaborations>\n");
}


