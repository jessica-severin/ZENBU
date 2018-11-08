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
use Data::UUID;

use File::Temp;

use EEDB::Database;
use MQdb::MappedQuery;
use EEDB::Feature;
use EEDB::Symbol;
use XML::TreePP;

my $connection_count = 0;
my $total_edge_count = 0;

my $eeDB = undef;
my $eeDB_url = "mysql://severin:sevjes753\@osc-mysql.gsc.riken.jp/eeDB_LSA_registry"; 

my $start_date = localtime();
my $launch_time = time();

open(LOGFILE, ">>", "/tmp/eeDB_config.log");

while (my $fcgi_session = new CGI::Fast) {
  process_url_request($fcgi_session);
  $connection_count++;
}

##########################

sub process_url_request {
  my $session = shift;

  my $self = {};
  $self->{'session'} = $session;
  $self->{'uuid'} = $session->param('uuid');
  $self->{'id'} = $session->param('id');
  $self->{'peer_name'} = $session->param('peer');
  $self->{'search'} = $session->param('search');

  if(!defined($eeDB)) { init_db($self); } 

  if(defined($self->{'id'})) {
    return get_singlenode($self);
  } elsif(defined($self->{'uuid'})) {
    return get_configXML($self);
  } else {
    my $xmlData = $session->param('POSTDATA');
    if($xmlData) { return register_config($self); }
 }
 show_fcgi($self);
}


sub show_fcgi {
  my $self = shift;

  my $fcgi_session = $self->{'session'};
  my $id = $fcgi_session->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  print header;
  print start_html("EdgeExpressDB Fast CGI object server");
  print h1("Fast CGI object server (perl)");
  print p("eedb_region.fcgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  printf("<br>dburl : %s\n",$eeDB->url);
  print hr;

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
  print("<tr><td>uuid=[number]</td><td>directly access a configXML feature by its UUID</td></tr>\n");
  print("<tr><td>id=[eedbID]</td><td>directly access a Feature by it's eeDB federated ID.</td></tr>\n");
  print("<tr><td>search=[keyword]</td><td>does a metadata search for all matching features and returns compact list in XML</td></tr>\n");
  print("</table>\n");

}

#########################################################################################

sub init_db {
  my $self = shift;
  
  #parse_conf($self, 'eedb_configserver.conf');

  $eeDB = EEDB::Database->new_from_url($eeDB_url);

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

sub register_config {
  my $self = shift;

  my $session = $self->{'session'};
  
  printf (LOGFILE "\n=======  %s\n", scalar(gmtime()));

  my $xmlData = $session->param('POSTDATA');

  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  if($tree->{"eeDBgLyphsConfig"}) { register_glyph_config($self); }
  if($tree->{"eeDBgLyphsTrackConfig"}) { register_track_config($self); }
}


sub register_glyph_config {
  my $self = shift;

  my $session = $self->{'session'};
  
  my $xmlData = $session->param('POSTDATA');

  my $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_configs", $eeDB);

  my $feature = new EEDB::Feature;
  $feature->feature_source($fsrc);

  #
  # parse the XML, expand it and rebuild it
  #
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  my $name = $tree->{"eeDBgLyphsConfig"}->{'summary'}->{'-name'};
  $feature->primary_name($name);
  $feature->add_symbol("configname", $name);
  $feature->add_symbol("gLyph_user", $tree->{"eeDBgLyphsConfig"}->{'summary'}->{'-user'});
  $feature->add_data("title", $tree->{"eeDBgLyphsConfig"}->{'summary'}->{'-title'});

  my $mdata = $feature->add_data("description", $tree->{"eeDBgLyphsConfig"}->{'summary'}->{'-desc'});
  $feature->metadataset->merge_metadataset($mdata->extract_keywords);

  my $region = $tree->{"eeDBgLyphsConfig"}->{'region'};
  my $chrom = EEDB::Chrom->fetch_by_name($eeDB, $region->{"-asm"}, $region->{"-chrom"});
  $feature->chrom($chrom);
  $feature->chrom_start($region->{'-start'});
  $feature->chrom_end($region->{'-end'});

  my $ug    = new Data::UUID;
  my $uuid  = $ug->create();
  $feature->add_symbol("uuid", $ug->to_string($uuid)); 


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

  $feature->store($eeDB);

  printf (LOGFILE $feature->display_contents);
  
  #send result back
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  print("<config_upload>\n");
  printf("<configXML id=\"%s\" uuid=\"%s\" />\n", $feature->id, $ug->to_string($uuid));
  print("</config_upload>\n");

  #print $xmlData;
  #self->{'id'} = $feature->id;
  # get_singlenode();
  #printf (LOGFILE "returned the feature as a single node\n");

}

sub register_track_config {
  my $self = shift;

  my $session = $self->{'session'};
  
  my $xmlData = $session->param('POSTDATA');

  my $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyph_track_configs", $eeDB);

  my $feature = new EEDB::Feature;
  $feature->feature_source($fsrc);

  #
  # parse the XML, expand it and rebuild it
  #
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  unless($tree->{"eeDBgLyphsTrackConfig"}) { return; }
  $tree = $tree->{"eeDBgLyphsTrackConfig"};

  my $name = $tree->{'summary'}->{'-title'};
  $feature->primary_name($name);
  $feature->add_symbol("gLyph_user", $tree->{'summary'}->{'-user'});
  
  my $md1 = $feature->add_data("title", $tree->{'summary'}->{'-title'});
  $feature->metadataset->merge_metadataset($md1->extract_keywords);

  my $mdata = $feature->add_data("description", $tree->{'summary'}->{'-desc'});
  $feature->metadataset->merge_metadataset($mdata->extract_keywords);

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

  $feature->store($eeDB);

  printf (LOGFILE $feature->display_contents);
  
  #send result back
  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  print("<config_upload>\n");
  printf("<configXML id=\"%s\" />\n", $feature->db_id);
  print("</config_upload>\n");
}


#################################################################################
#
# basic access methods
#
#################################################################################

sub get_peer_feature {
  my $self= shift;
  my $db = $eeDB;
  my $fid = $self->{'id'};
  if($self->{'id'} =~ /(.+)::(\d+)/) {
    $self->{'peer_name'} = $1;
    $fid = $2;
  }
  if($self->{'peer_name'}) {
    my $peer = EEDB::Peer->fetch_by_name($eeDB, $self->{'peer_name'});
    if($peer and $peer->peer_database) {
      $db= $peer->peer_database;
      if($db->url eq $eeDB->url) { $db = $eeDB; }
      $self->{"peerDB"} = $peer;
    }
  }
  return EEDB::Feature->fetch_by_id($db, $fid);
}


sub get_singlenode {
  my $self = shift;

  my $starttime = time()*1000;
  my $feature = get_peer_feature($self);
  unless($feature) {
    show_fcgi($self);
    return;
  }

  print header(-type => "text/xml", -charset=> "UTF8");
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<features>\n");
  if($self->{"peerDB"}) { print($self->{"peerDB"}->xml); }
  else{ print($feature->database->xml); }
  print($feature->xml);

  my $total_time = (time()*1000) - $starttime;
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);
  printf("<fastcgi invocation=\"%d\" pid=\"%s\" fcache=\"%d\" ecache=\"%d\" />\n",
                  $connection_count, $$,
                  EEDB::Feature->get_cache_size,
                  EEDB::Edge->get_cache_size);

  printf("</features>\n");
}


sub get_configXML {
  my $self = shift;

  my $starttime = time()*1000;

  my ($symbol) = @{EEDB::Symbol->fetch_all_by_name($eeDB, $self->{"uuid"}, "uuid")};
  unless($symbol) {  return show_fcgi($self); }

  my $fsrc = EEDB::FeatureSource->create_from_name("config::eeDB_gLyphs_configs", $eeDB);
  unless($fsrc) {  return show_fcgi($self); }

  my ($feature) = @{EEDB::Feature->fetch_all_with_symbols($eeDB, $fsrc, $symbol)};
  unless($feature) {  return show_fcgi($self); }

  $eeDB->do_sql("update feature set significance=significance+1 where feature_id=" . $feature->id);

  my $configXML = $feature->metadataset->find_metadata("configXML");
  unless($configXML) {  return show_fcgi($self); }

  print header(-type => "text/xml", -charset=> "UTF8");
  print($configXML->data);

  return;
}



