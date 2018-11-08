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
use Data::UUID;
use Date::Parse;

use File::Temp;

use EEDB::Database;
use MQdb::MappedQuery;
use EEDB::Feature;
use EEDB::Symbol;
use XML::TreePP;

use EEDB::SPStream::FederatedSourceStream;
use EEDB::User;
use EEDB::Collaboration;

my $SESSION_NAME = "CGISESSID";

my $connection_count = 0;

my @seed_urls;
my @seed_peers;

my $userDB_url = undef;
my $userDB  = undef;
my $default_asm = "";

my $start_date = localtime();
my $launch_time = time();

#open(LOGFILE, ">>", "/tmp/eeDB_config.log");

my $SERVER_NAME = undef;
my $WEB_URL     = undef;
parse_conf('eedb_server.conf');

init_db();

while (my $fcgi = new CGI::Fast) {
  process_url_request($fcgi);
  $connection_count++;
  disconnect_db();
}

##########################

sub process_url_request {
  my $cgi = shift;

  my $self = {};
  $self->{'cgi'} = $cgi;
  $self->{'starttime'} = time()*1000;

  get_webservice_url($self);

  get_session_user($self);

  $self->{'format'} = $cgi->param('format') if(defined($cgi->param('format')));
  $self->{'uuid'} = $cgi->param('uuid') if(defined($cgi->param('uuid')));
  $self->{'basename'} = lc($cgi->param('本成')) if(defined($cgi->param('本成')));
  $self->{'basename'} = lc($cgi->param('basename')) if(defined($cgi->param('basename')));
  $self->{'configtype'} = $cgi->param('configtype') if(defined($cgi->param('configtype')));
  $self->{'search'} = $cgi->param('search') if(defined($cgi->param('search')));
  $self->{'mode'} = $cgi->param('mode');
  $self->{'registry_mode'} = {"public"=>1, "private"=>1, "shared"=>1};
  $self->{'id'} = $cgi->param('id');
  $self->{'peer_ids'} = {};

  if(defined($cgi->param('search'))) {
    $self->{'mode'} = "search";
    $self->{'search'} = $cgi->param('search');
  }

  if(defined($self->{'configtype'})) {
    my $cfg = $self->{'configtype'};
    $self->{'configtype'} = undef;
    if($cfg eq "view") { $cfg = "eeDB_gLyphs_configs"; }
    if(lc($cfg) eq "glyphs") { $cfg = "eeDB_gLyphs_configs"; }
    if($cfg eq "track") { $cfg = "eeDB_gLyph_track_configs"; }
    if($cfg eq "script") { $cfg = "ZENBU_script_configs"; }
    if(($cfg eq "eeDB_gLyphs_configs") or ($cfg eq "eeDB_gLyph_track_configs") or ($cfg eq "ZENBU_script_configs")) {
      $self->{'configtype'} = $cfg;
    }
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
  if(!defined($self->{'mode'})) { $self->{'mode'}=""; }
  if(!defined($self->{'format'})) { $self->{'format'}=""; }

  # now the location processing
  if(defined($default_asm) and !defined($self->{'assembly_name'})) {
    $self->{'assembly_name'}=$default_asm;
  }

  if(defined($self->{'id'})) {
    if($self->{'id'} =~ /(.+)::(.+):::/) { $self->{'peer_ids'}->{$1} = 1; }
    elsif($self->{'id'} =~ /(.+)::(.+)/) { $self->{'peer_ids'}->{$1} = 1; }
  }

  if($self->{'mode'} eq 'feature_sources') {
    return show_feature_sources($self);
  } elsif($self->{'mode'} eq 'peers') {
    return show_peers($self);
  } elsif($self->{'mode'} eq 'last_session') {
    return get_user_last_config($self);
  } elsif(($self->{'mode'} eq "search") and defined($self->{'configtype'})) { 
    return search_configs($self);
  }

  if(defined($self->{'id'})) {
    return get_singlenode($self);
  } elsif(defined($self->{'uuid'})) {
    return get_configXML($self);
  } elsif(defined($self->{'basename'})) {
    return get_basename_configXML($self);
  } else {
    my $xmlData = $cgi->param('POSTDATA');
    if($xmlData) { return register_config($self); }
 }
 show_fcgi($self);
}


sub show_fcgi {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  my $id = $cgi->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  print header;
  print start_html("EdgeExpressDB Fast CGI object server");
  print h1("Fast CGI object server (perl)");
  print p("eedb_config_server.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  if($self->{'user_profile'}) {
    printf("<br>profile email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>profile openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
  }
  print hr;

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
  print("<tr><td>uuid=[number]</td><td>directly access a configXML feature by its UUID</td></tr>\n");
  print("<tr><td>id=[eedbID]</td><td>directly access a Feature by it's eeDB federated ID.</td></tr>\n");
  print("</table>\n");

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


sub escape_xml {
  my $data = shift;
  if($data) {
    $data =~ s/\&/&amp;/g;
    $data =~ s/\"/&quot;/g; #\"
    $data =~ s/\</&lt;/g;
    $data =~ s/\>/&gt;/g;
    return $data;
  } else { return ""; }
}

#
####################################################
#

sub register_config {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  
  #printf (LOGFILE "\n=======  %s\n", scalar(gmtime()));

  my $xmlData = $cgi->param('POSTDATA');

  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  print("<config_upload>\n");

  if($tree->{"eeDBgLyphsConfig"}) { register_glyph_config($self); }
  if($tree->{"eeDBgLyphsTrackConfig"}) { register_track_config($self); }
  if($tree->{"ZENBU_script_config"}) { register_script_config($self); }

  print("</config_upload>\n");
}


sub register_glyph_config {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  
  #
  # parse the XML, expand it and rebuild it
  #
  my $xmlData = $cgi->param('POSTDATA');
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  my $configRoot = $tree->{"eeDBgLyphsConfig"};
  my $config_source = undef;

  #$self->{'registry_mode'} = {};  #clear
  if(my $autoconfig = $configRoot->{'autoconfig'}->{'-value'}) {
    #get mode
    $self->{'registry_mode'} = {};  #clear
    if($autoconfig eq "private") { $self->{'registry_mode'}->{'private'}=1; }
    else { $self->{'registry_mode'}->{'public'}=1; }
    my $stream = input_stream($self);
    $stream->stream_data_sources('class'=>"FeatureSource");
    while(my $source = $stream->next_in_stream) {
      unless($source->class eq "FeatureSource") { next; }
      unless($source->category eq "config") { next; }
      if($source->name eq "eeDB_gLyphs_autoconfigs") {
        $config_source = $source;
	last;
      }
    }
    $stream->disconnect;
  } else {
    if($configRoot->{'config_registry'}) { 
      my $src_id = $configRoot->{'config_registry'}->{'-source_id'};
      if($src_id) { 
        my $stream = input_stream($self);
        $config_source = $stream->fetch_object_by_id($src_id);
        $stream->disconnect;
      }
    }
  }
  unless($config_source) { return; }

  my $db = $config_source->database;
  $db->disconnect;
  $db->user('zenbu_admin');
  $db->password('zenbu_admin');

  my $feature = new EEDB::Feature;
  $feature->feature_source($config_source);

  my $name = $configRoot->{'summary'}->{'-name'};
  $feature->primary_name($name);

  if($self->{'user_profile'}) {
    $feature->add_data("eedb:owner_OpenID", $self->{'user_profile'}->openID);
    $feature->add_data("eedb:owner_nickname", $self->{'user_profile'}->nickname);
  } elsif($tree->{'summary'}->{'-user'}) {
    $feature->add_data("gLyph_user", $configRoot->{'summary'}->{'-user'});
  }
  
  my $md1 = $feature->add_data("script_name", $tree->{'summary'}->{'-name'});
  $feature->metadataset->merge_metadataset($md1->extract_keywords);

  my $md = $feature->add_data("configname", $name);
  $feature->metadataset->merge_metadataset($md->extract_keywords);

  $md = $feature->add_data("title", $configRoot->{'summary'}->{'-title'});
  $feature->metadataset->merge_metadataset($md->extract_keywords);

  my $mdata = $feature->add_data("description", $configRoot->{'summary'}->{'-desc'});
  $feature->metadataset->merge_metadataset($mdata->extract_keywords);

  my $region = $configRoot->{'region'};
  $feature->add_symbol("eedb:assembly_name", $region->{'-asm'});

  my $assembly = EEDB::Assembly->fetch_by_name($db, $region->{"-asm"});
  unless($assembly) {
    $assembly = new EEDB::Assembly;
    $assembly->ncbi_version($region->{"-asm"});
    $assembly->ucsc_name($region->{"-asm"});
    $assembly->taxon_id("");
    $assembly->store($db);
  }
  my $chrom = EEDB::Chrom->fetch_by_name($db, $region->{"-asm"}, $region->{"-chrom"});
  unless($chrom) {
    $chrom = new EEDB::Chrom;
    $chrom->chrom_name($region->{"-chrom"});
    $chrom->assembly($assembly);
    $chrom->store($db);
  }
  $feature->chrom($chrom);
  $feature->chrom_start($region->{'-start'});
  $feature->chrom_end($region->{'-end'});

  my $ug    = new Data::UUID;
  my $uuid  = $ug->create_b64();
  chomp($uuid);
  $uuid =~ s/=//g;
  $uuid =~ s/\+/\-/g;
  $uuid =~ s/\//_/g;
  $feature->add_symbol("uuid", $uuid); 

  $feature->add_data("date", scalar(gmtime()));
  $feature->add_data("Server_Name", $ENV{'SERVER_NAME'});
  $feature->add_data("Server_Port", $ENV{'SERVER_PORT'});
  $feature->add_data("Server_Software", $ENV{'SERVER_SOFTWARE'});
  $feature->add_data("Server_Protocol", $ENV{'SERVER_PROTOCOL'});
  $feature->add_data("CGI_Revision", $ENV{'GATEWAY_INTERFACE'});
  $feature->add_data("browser", $ENV{'HTTP_USER_AGENT'});
  $feature->add_data("REMOTE_ADDR", $ENV{'REMOTE_ADDR'});
  #$feature->add_data("HTTP_REFERER", $ENV{'HTTP_REFERER'});

  $feature->add_data("configXML", $xmlData);

  $feature->store($db);

  #printf (LOGFILE $feature->display_contents);

  if($self->{'user_profile'}) {
    my $md = $self->{'user_profile'}->metadataset->find_metadata("eedb:last_glyphs_config");
    if($md) {
      $md->data($uuid);
      $md->update;
    } else {
      $self->{'user_profile'}->metadataset->add_tag_data("eedb:last_glyphs_config", $uuid);
      $self->{'user_profile'}->store_metadata;
    }
  }
  
  #send result back
  printf("<configXML id=\"%s\" uuid=\"%s\" />\n", $feature->db_id, $uuid);
}

sub register_track_config {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  
  my $xmlData = $cgi->param('POSTDATA');

  #
  # parse the XML, expand it and rebuild it
  #
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  unless($tree->{"eeDBgLyphsTrackConfig"}) { return; }
  $tree = $tree->{"eeDBgLyphsTrackConfig"};

  unless($tree->{'config_registry'}) { return; }
  my $src_id = $tree->{'config_registry'}->{'-source_id'};
  unless($src_id) { return; }

  my $stream = input_stream($self);
  my $config_source = $stream->fetch_object_by_id($src_id);
  unless($config_source) { return; }

  my $db = $config_source->database;
  $db->disconnect;
  $db->user('zenbu_admin');
  $db->password('zenbu_admin');

  my $feature = new EEDB::Feature;
  $feature->feature_source($config_source);


  my $name = $tree->{'summary'}->{'-title'};
  $feature->primary_name($name);

  if($self->{'user_profile'}) {
    $feature->add_data("eedb:owner_OpenID", $self->{'user_profile'}->openID);
    $feature->add_data("eedb:owner_nickname", $self->{'user_profile'}->nickname);
  } elsif($tree->{'summary'}->{'-user'}) {
    $feature->add_data("gLyph_user", $tree->{'summary'}->{'-user'});
  }
  
  my $md1 = $feature->add_data("title", $tree->{'summary'}->{'-title'});
  $feature->metadataset->merge_metadataset($md1->extract_keywords);

  my $mdata = $feature->add_data("description", $tree->{'summary'}->{'-desc'});
  $feature->metadataset->merge_metadataset($mdata->extract_keywords);

  if($tree->{'summary'}->{'-asm'}) {
    $feature->add_symbol("assembly_name", lc($tree->{'summary'}->{'-asm'}));
  }

  my $ug    = new Data::UUID;
  my $uuid  = $ug->create_b64();
  chomp($uuid);
  $uuid =~ s/=//g;
  $uuid =~ s/\+/\-/g;
  $uuid =~ s/\//_/g;
  $feature->add_symbol("uuid", $uuid);


  $feature->add_data("date", scalar(gmtime()));
  $feature->add_data("Server_Name", $ENV{'SERVER_NAME'});
  $feature->add_data("Server_Port", $ENV{'SERVER_PORT'});
  $feature->add_data("Server_Software", $ENV{'SERVER_SOFTWARE'});
  $feature->add_data("Server_Protocol", $ENV{'SERVER_PROTOCOL'});
  $feature->add_data("CGI_Revision", $ENV{'GATEWAY_INTERFACE'});
  $feature->add_data("browser", $ENV{'HTTP_USER_AGENT'});
  $feature->add_data("REMOTE_ADDR", $ENV{'REMOTE_ADDR'});
  #$feature->add_data("HTTP_REFERER", $ENV{'HTTP_REFERER'});

  $feature->add_data("configXML", $xmlData);

  $feature->store($db);
  $db->disconnect;

  #printf (LOGFILE $feature->display_contents);
  
  #send result back
  printf("<configXML id=\"%s\" uuid=\"%s\" />\n", $feature->db_id, $uuid);
}


sub register_script_config {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  
  my $xmlData = $cgi->param('POSTDATA');

  #
  # parse the XML, expand it and rebuild it
  #
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  unless($tree->{"ZENBU_script_config"}) { return; }
  $tree = $tree->{"ZENBU_script_config"};

  unless($tree->{'config_registry'}) { return; }
  my $src_id = $tree->{'config_registry'}->{'-source_id'};
  unless($src_id) { return; }

  my $stream = input_stream($self);
  my $config_source = $stream->fetch_object_by_id($src_id);
  unless($config_source) { return; }

  my $db = $config_source->database;
  $db->disconnect;
  $db->user('zenbu_admin');
  $db->password('zenbu_admin');

  my $feature = new EEDB::Feature;
  $feature->feature_source($config_source);


  my $name = $tree->{'summary'}->{'-name'};
  $feature->primary_name($name);

  if($self->{'user_profile'}) {
    $feature->add_data("eedb:owner_OpenID", $self->{'user_profile'}->openID);
    $feature->add_data("eedb:owner_nickname", $self->{'user_profile'}->nickname);
  } elsif($tree->{'summary'}->{'-user'}) {
    $feature->add_data("gLyph_user", $tree->{'summary'}->{'-user'});
  }
  
  my $md1 = $feature->add_data("script_name", $tree->{'summary'}->{'-name'});
  $feature->metadataset->merge_metadataset($md1->extract_keywords);

  my $mdata = $feature->add_data("description", $tree->{'summary'}->{'-desc'});
  $feature->metadataset->merge_metadataset($mdata->extract_keywords);

  my $ug    = new Data::UUID;
  my $uuid  = $ug->create_b64();
  chomp($uuid);
  $uuid =~ s/=//g;
  $uuid =~ s/\+/\-/g;
  $uuid =~ s/\//_/g;
  $feature->add_symbol("uuid", $uuid);


  $feature->add_data("date", scalar(gmtime()));
  $feature->add_data("Server_Name", $ENV{'SERVER_NAME'});
  $feature->add_data("Server_Port", $ENV{'SERVER_PORT'});
  $feature->add_data("Server_Software", $ENV{'SERVER_SOFTWARE'});
  $feature->add_data("Server_Protocol", $ENV{'SERVER_PROTOCOL'});
  $feature->add_data("CGI_Revision", $ENV{'GATEWAY_INTERFACE'});
  $feature->add_data("browser", $ENV{'HTTP_USER_AGENT'});
  $feature->add_data("REMOTE_ADDR", $ENV{'REMOTE_ADDR'});
  #$feature->add_data("HTTP_REFERER", $ENV{'HTTP_REFERER'});

  $feature->add_data("configXML", $xmlData);

  $feature->store($db);
  $db->disconnect;

  #printf (LOGFILE $feature->display_contents);
  
  #send result back
  printf("<configXML id=\"%s\" uuid=\"%s\" />\n", $feature->db_id, $uuid);
}


#################################################################################
#
# basic access methods
#
#################################################################################

sub input_stream {
  my $self = shift;

  my $stream = new EEDB::SPStream::FederatedSourceStream;
  $stream->{'_peer_search_depth'} = 9;

  my $regmode = $self->{'registry_mode'};
  if($regmode->{"public"}) {
    foreach my $peer (@seed_peers) {
      $stream->add_seed_peers($peer);
      $stream->add_peer_ids($peer->uuid);
    }
  }

  if($self->{'user_profile'}) {
    if($regmode->{"private"}) {
      if($self->{"user_profile"}->user_registry) {
        my $peer = $self->{"user_profile"}->user_registry;
        if($peer) {
          $stream->add_seed_peers($peer);
          $stream->add_peer_ids($peer->uuid);
        }
      }
    }

    if($regmode->{"shared"}) {
      my $collaborations = $self->{'user_profile'}->member_collaborations;
      foreach my $collaboration (@{$collaborations}) {
        my $peer = $collaboration->group_registry;
        if($peer) {
          $stream->add_seed_peers($peer);
          $stream->add_peer_ids($peer->uuid);
	  $peer->disconnect;
        }
      }
    }
    $userDB->disconnect;
  }

  if(scalar(keys(%{$self->{'peer_ids'}}))>0) {
    $stream->add_peer_ids(keys(%{$self->{'peer_ids'}}));
  }

  return $stream;
}


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



sub get_configXML {
  my $self = shift;

  my $stream = input_stream($self);

  $stream->stream_features_by_metadata_search('keyword_list' => $self->{'uuid'});

  my ($feature, $uuid_md);
  while($feature = $stream->next_in_stream) {
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    next if($feature->feature_source->category ne "config");
    $uuid_md = $feature->metadataset->find_metadata("uuid");
    unless($uuid_md) { next; }
    if($self->{'uuid'} ne $uuid_md->data) { next; }
    last;
  }
  show_feature_config_xml($self, $feature);
  $stream->disconnect;
}


sub get_basename_configXML {
  my $self = shift;

  unless($self->{'basename'}) { return show_empty_config($self); }
  unless($self->{'configtype'}) { return show_empty_config($self); }

  my $stream = input_stream($self);
  $stream->stream_features_by_metadata_search('keyword_list' => $self->{'basename'});

  my $best_feature = undef;
  my $best_date = undef;
  while(my $feature = $stream->next_in_stream) {
    next unless($feature);
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    next if($feature->feature_source->category ne "config");
    next unless($feature->feature_source->name eq $self->{'configtype'});
    next unless(lc($feature->primary_name) =~ /^$self->{'basename'}/);
    my $uuid_md = $feature->metadataset->find_metadata("uuid");
    unless($uuid_md) { next; }

    my $date_md = $feature->metadataset->find_metadata("date");
    unless($date_md) { next; }

    if(!$best_feature) { 
      $best_feature = $feature; 
      $best_date = $date_md;
    }
    elsif(str2time($date_md->data) > str2time($best_date->data)) {
      $best_feature = $feature;
      $best_date = $date_md;
    }
  }
  show_feature_config_xml($self, $best_feature);
  $stream->disconnect;
}


sub show_feature_config_xml {
  my $self = shift;
  my $feature = shift;

  unless($feature) { return show_empty_config($self); }
  my $configXML = $feature->metadataset->find_metadata("configXML");
  unless($configXML) { return show_empty_config($self); }

  my $uuid_md = $feature->metadataset->find_metadata("uuid");
  unless($uuid_md) { return show_empty_config($self); }
  my $date_md = $feature->metadataset->find_metadata("date");

  my $total_time = (time()*1000) - $self->{'starttime'};
  my $data = $configXML->data;
  if($data =~ s/\<\/eeDBgLyphsConfig\>//g) {
    if($date_md) { $data .= "<create_date>" . $date_md->data . "</create_date>\n"; }
    if(!($data =~ /configUUID/)) {
      $data .= "<configUUID>" . $uuid_md->data . "</configUUID>\n";
    }
    $data .= "<config_eeid>" . $feature->db_id . "</config_eeid>\n";
    $data .= sprintf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
    $data .= "</eeDBgLyphsConfig>";
  }
  if($data =~ s/\<\/eeDBgLyphsTrackConfig\>//g) {
    if($date_md) { $data .= "<create_date>" . $date_md->data . "</create_date>\n"; }
    if(!($data =~ /configUUID/)) {
      $data .= "<trackUUID>" . $uuid_md->data . "</trackUUID>\n";
    }
    $data .= "<config_eeid>" . $feature->db_id . "</config_eeid>\n";
    $data .= sprintf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
    $data .= "</eeDBgLyphsTrackConfig>";
  }
  print header(-type => "text/xml", -charset=> "UTF8");
  print($data);

  eval {
    my $db = $feature->database;
    #reset password
    $db->disconnect;
    #$db->user("severin");
    #$db->password("sevjes753");
    $db->user("zenbu_admin");
    $db->password("zenbu_admin");
    $db->do_sql("update feature set significance=significance+1 where feature_id=" . $feature->id);
    $db->disconnect;
  };

  if($self->{'user_profile'}) {
    my $uuid = $self->{'uuid'};
    my $md = $self->{'user_profile'}->metadataset->find_metadata("eedb:last_glyphs_config");
    if($md) {
      $md->data($uuid);
      $md->update;
    } else {
      $self->{'user_profile'}->metadataset->add_tag_data("eedb:last_glyphs_config", $uuid);
      $self->{'user_profile'}->store_metadata;
    }
  }

  return;
}


sub get_user_last_config {
  my $self = shift;

  $self->{'uuid'} = "";
  if($self->{'user_profile'}) { 
    my $md = $self->{'user_profile'}->metadataset->find_metadata("eedb:last_glyphs_config");
    if($md) { $self->{'uuid'} = $md->data; }
  }
  if($self->{'uuid'}) {
    return get_configXML($self);
  } else {
    show_empty_config($self);
  }
}


sub show_empty_config {
  print header(-type => "text/xml", -charset=> "UTF8");
  print("<eeDBgLyphsConfig></eeDBgLyphsConfig>\n");
}


sub search_configs {
  my $self = shift;

  my $stream = input_stream($self);

  print header(-type => "text/xml", -charset=> "UTF8");
  if($self->{'format'} eq "feature") { print("<features>\n"); }
  else { print("<results>\n"); }

  printf("<query value=\"%s\" />\n", escape_xml($self->{'search'}));

  my $peer_uuid_hash = {};
  my $fsrc_hash = {};
  my $total = 0;
  $stream->stream_data_sources('class'=>'FeatureSource');
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "FeatureSource");
    next unless($source->name eq $self->{'configtype'});

    my $peer = EEDB::Peer->check_global_peer_cache($source->peer_uuid);
    if($peer) { $peer_uuid_hash->{$peer->uuid} = $peer; }
    $fsrc_hash->{$source->db_id} = $source;
  }
  my @fsrcs = values (%{$fsrc_hash});
  print("<sources>\n");
  foreach my $source (@fsrcs) { 
    print($source->simple_xml); 
    $stream->add_source_ids($source->db_id);
    $total += $source->get_feature_count;
  }
  print("</sources>\n");

  my @peers = values (%{$peer_uuid_hash});
  printf("<peers count=\"%d\">\n", scalar(@peers));
  foreach my $peer (@peers) { print($peer->xml); }
  print("</peers>\n");


  if($self->{'search'}) {
    $stream->stream_features_by_metadata_search('filter' => $self->{'search'});
  } else {
    $stream->sourcestream_output("simple_feature");
    $stream->stream_all;
  }
  my $filter_count=0;
  while(my $feature = $stream->next_in_stream) {
    next unless($feature);
    next unless($feature->feature_source);
    next if($feature->feature_source->is_active ne 'y');
    next if($feature->feature_source->is_visible ne 'y');
    next unless($feature->feature_source->name eq $self->{'configtype'});

    my $uuid_md = $feature->metadataset->find_metadata("uuid");
    #unless($uuid_md) { next; }

    if($self->{'format'} eq "feature") {
      print($feature->xml_start);
      if($uuid_md) { print($uuid_md->xml); }
      print($feature->xml_end);
    } elsif($self->{'format'} eq "minxml") {
      printf("<feature id=\"%s\" sig=\"%1.5f\"/>\n", $feature->db_id(), $feature->significance());
    } else {
      # display search results
      printf("<match desc=\"%s\" ", escape_xml($feature->primary_name));
      printf("feature_id=\"%s\" ", $feature->db_id);
      printf("type=\"%s\" ", escape_xml($feature->feature_source->category));
      printf("fsrc=\"%s\" ", escape_xml($feature->feature_source->name));
      if($uuid_md) { printf("uuid=\"%s\" ", $uuid_md->data); }
      print(" />\n");
    }
    $filter_count++;
  }
  if($filter_count > $total) { $total = $filter_count; }

  printf("<result_count method=\"logic\" total=\"%d\" expected=\"%d\" match_count=\"%d\" filtered=\"%d\" />\n",
          $total, $total, $filter_count, $filter_count);
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);

  if($self->{'format'} eq "feature") { print("</features>\n"); }
  else { print("</results>\n"); }
  $stream->disconnect;
}


###############################################################################################

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
    next unless($peer->test_is_valid);
    push @peers, $peer;
  }

  printf("<stats count=\"%d\" />\n", scalar(@peers));
  foreach my $peer (sort _peer_sort @peers) {
    print($peer->xml);
    $peer->disconnect;
  }
  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</peers>\n");
  $stream->disconnect;
}
sub _peer_sort {
  return ($a->federation_depth <=> $b->federation_depth) || ($a->alias cmp $b->alias);
}


sub show_feature_sources {
  my $self = shift;

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<feature_sources>\n");

  if($self->{'user_profile'}) { printf($self->{'user_profile'}->simple_xml); }

  my $peer_uuid_hash = {};
  my $fsrc_hash = {};
  my $stream = input_stream($self);
  $stream->stream_data_sources('class'=>'FeatureSource');
  while(my $source = $stream->next_in_stream) {
    next unless($source->class eq "FeatureSource");
    if($self->{'configtype'} and ($source->name ne $self->{'configtype'})) { next; }

    my $peer = EEDB::Peer->check_global_peer_cache($source->peer_uuid);
    if($peer) { $peer_uuid_hash->{$peer->uuid} = $peer; }
    $fsrc_hash->{$source->db_id} = $source;
  }
  my @fsrcs = values (%{$fsrc_hash});

  printf("<result_count method=\"feature_sources\" total=\"%s\" />\n", scalar(@fsrcs));
  foreach my $fsrc (sort _feature_source_sort @fsrcs) {
    print($fsrc->xml);
  }
  foreach my $peer (values(%{$peer_uuid_hash})) {
    if($peer) { print($peer->xml); }
  }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" />\n", $connection_count, $$);
  printf("</feature_sources>\n");
  $stream->disconnect;
}
sub _feature_source_sort {
  return ($a->category cmp $b->category) || ($a->name cmp $b->name);
}



