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
  $self->{'id_list'} = $cgi->param('ids');
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

  if(defined($self->{'mode'}) and ($self->{'mode'} eq 'alter_metadata')) {
    $self->{'metadata_cmds'} = $cgi->param('cmds') if(defined($cgi->param('cmds'))); 
  }

  if(defined($self->{'id'})) {
    $self->{'mode'} = "object";
  }

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

  if(defined($self->{'id_list'})) {
    $self->{'mode'} = 'objects';
    $self->{'ids_array'} = [];
    my @ids = split /,/, $self->{'id_list'};
    foreach my $id (@ids) {
      if($id =~ /(.+)::(.+):::(.+)/) { 
        $self->{'peer_ids'}->{$1} = 1; 
        push @{$self->{'ids_array'}}, $id; 
        if(($3 eq "FeatureSource") or ($3 eq "Experiment") or ($3 eq "EdgeSource")) {
          $self->{'filter_ids'}->{$id} = 1;
        }
      }
      elsif($id =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; push @{$self->{'ids_array'}}, $id; }
    }
  }

  $self->{'limit'}=1000 unless(defined($self->{'limit'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));
  if(!defined($self->{'mode'})) { $self->{'mode'} = ''; }

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

  if($self->{'mode'} eq 'status') {
    show_status($self);
  } elsif($self->{'mode'} eq 'peers') {
    show_peers($self);
  } elsif($self->{'mode'} eq 'chrom') {
    show_chromosomes($self);
  } elsif($self->{'mode'} eq 'objects') {
    show_objects($self);
  } elsif($self->{'mode'} eq 'alter_metadata') {
    alter_metadata($self);
  } elsif($self->{'mode'} eq 'object') {
    get_singlenode($self);
  } else {
    show_fcgi($self);
  }

  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->disconnect;
    $peer->uncache_stream_sources;
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
  print p("eedb_object.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>hostname : %s\n",$hostname);
  printf("<br>server_name : %s\n",$SERVER_NAME);
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
  EEDB::Experiment->set_cache_behaviour(0);
  EEDB::FeatureSource->set_cache_behaviour(0);
  EEDB::EdgeSource->set_cache_behaviour(0);
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


sub show_objects {
  my $self = shift;
  
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<objects>\n");

  my $total = 0;
  my $result_count = 0;

  if(defined($self->{'ids_array'}) and (scalar(@{$self->{'ids_array'}}))) {
    my $stream = input_stream($self);
    foreach my $id (@{$self->{'ids_array'}}) {
      my $obj = $stream->fetch_object_by_id($id);
      unless($obj) { next; }
      if($obj->class eq "FeatureSource") {
        next if($obj->is_active ne 'y');
        next if($obj->is_visible ne 'y');
      }
      if($obj->class eq "EdgeSource") {
        next if($obj->is_active ne 'y');
        next if($obj->is_visible ne 'y');
      }
      if($obj->class eq "Experiment") {
        next if($obj->is_active ne 'y');
      }
      if($obj->class eq "Feature") {
        next unless($obj->feature_source);
        next if($obj->feature_source->is_active ne 'y');
        next if($obj->feature_source->is_visible ne 'y');
      }
      $result_count++;
      if($self->{'format'} eq 'fullxml') { print($obj->xml); }
      else { print($obj->simple_xml); }
    }
  }
  printf("<result_count total=\"%s\" expected=\"%s\" />\n", $result_count, $total);

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</objects>\n");
}


#########################################################################################


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

sub _peer_sort {
  return ($a->federation_depth <=> $b->federation_depth) || ($a->alias cmp $b->alias);
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


sub alter_metadata() {
  my $self = shift;

  unless($self->{'user_profile'}) { show_fcgi($self); return; }
  unless($self->{'id'}) { show_fcgi($self); return; }
  unless($self->{'metadata_cmds'}) { show_fcgi($self); return; }

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<alter_metadata_object>\n");
  print($self->{'user_profile'}->simple_xml);

  #printf("<query_id>%s</query_id>\n", $self->{'id'});
  printf("<cmds>%s</cmds>\n", $self->{'metadata_cmds'});

  my $stream = input_stream($self);
  my $object = $stream->fetch_object_by_id($self->{'id'});
  unless($object and (($object->class eq "Experiment") or ($object->class eq "FeatureSource"))) { 
    printf("</alter_metadata_object>\n"); $stream->disconnect; return; 
  }

  my $peer = EEDB::Peer->check_global_peer_cache($object->peer_uuid);
  if($peer) { print($peer->xml);  }
  
  #do commands here
  if($self->{'user_profile'}->openID ne $object->owner_openid) {
    printf("<note>not owner, can not delete metadata</note>\n");
  }
  
  #parse commands
  #execute commands

  print($object->xml);

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  EEDB::Feature->get_cache_size,
                  EEDB::Edge->get_cache_size);

  printf("</alter_metadata_object>\n");
  $stream->disconnect;
}



