#!/usr/bin/perl -w 
BEGIN{
    unshift(@INC, "/zenbu/src/MappedQuery/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.302/lib");
}

=head1 NAME - eedb_create_instance.pl

=head1 SYNOPSIS

=head1 DESCRIPTION

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

  * Software License Agreement (BSD License)
  * EdgeExpressDB [eeDB] system
  * copyright (c) 2007-2009 Jessica Severin RIKEN OSC
  * All rights reserved.
  * Redistribution and use in source and binary forms, with or without
  * modification, are permitted provided that the following conditions are met:
  *     * Redistributions of source code must retain the above copyright
  *       notice, this list of conditions and the following disclaimer.
  *     * Redistributions in binary form must reproduce the above copyright
  *       notice, this list of conditions and the following disclaimer in the
  *       documentation and/or other materials provided with the distribution.
  *     * Neither the name of Jessica Severin RIKEN OSC nor the
  *       names of its contributors may be used to endorse or promote products
  *       derived from this software without specific prior written permission.
  *
  * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
  * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  * DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS BE LIABLE FOR ANY
  * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

=head1 APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

=cut

use strict;
use warnings;
use Getopt::Long;
use Data::Dumper;
use Switch;

use File::Temp;
use Compress::Zlib;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::Database;
use MQdb::MappedQuery;

use EEDB::FeatureSource;
use EEDB::EdgeSource;
use EEDB::Feature;
use EEDB::Edge;
use EEDB::Experiment;
use EEDB::Expression;
use EEDB::Tools::MultiLoader;

no warnings 'redefine';
$| = 1;

my $help;

my $url = undef;
my $store = 0;
my $debug = 0;
my $recreate_peer = 0;

my $eedb_root     = $ENV{EEDB_ROOT};
my $eedb_webroot  = $ENV{EEDB_WEBROOT};
my $eedb_registry = $ENV{EEDB_REGISTRY};


GetOptions( 
            'url:s'          =>  \$url,
            'webroot:s'      =>  \$eedb_webroot,
            'registry:s'     =>  \$eedb_registry,
            'newpeer'        =>  \$recreate_peer,
            'v'              =>  \$debug,
            'debug:s'        =>  \$debug,
            'help'           =>  \$help
            );


if ($help) { usage(); }

if(!$url) {
  printf("ERROR: must specify -url for the eeDB instance to be created\n\n");
  usage(); 
}

my $eeDB = EEDB::Database->new_from_url($url);


my $dbc=undef;
eval { $dbc = $eeDB->get_connection; };
if($dbc) { 
  printf("WARNING: eeDB instance [%s] already exists!!\n\n", $url);
} else {
  $eeDB = create_new_db_instance();
}

my $registryPeer = undef;
if($eedb_registry) {
  my $db = EEDB::Database->new_from_url($eedb_registry, 'password'=>$eeDB->password);
  if($db) {
    $registryPeer = EEDB::Peer->fetch_self($db);
    if($registryPeer) { print($registryPeer->xml); }
  }
}

if($eeDB) {
  $eeDB->display_info;
  my $weburl = $eedb_webroot;
  unless($weburl) { $weburl=""; }

  printf("\n==============\n");
  my $peer;
  if($recreate_peer) { 
    $peer = recreate_peer($eeDB, $weburl); 
  } else {
    $peer = EEDB::Peer->create_self_peer_for_db($eeDB, $weburl);
  }
  print($peer->xml, "\n");

  
  #now register into eedb_registry
  if($eedb_registry) {
    my $registryDB = EEDB::Database->new_from_url($eedb_registry, 'password'=>$eeDB->password);
    my $reg_peer = $peer->copy;
    $reg_peer->database(undef);
    $reg_peer->store($registryDB);
  }
}

exit(1);

#########################################################################################

sub usage {
  print "eedb_create_instance.pl [options]\n";
  print "  -help               : print this help\n";
  print "  -url <url>          : URL to source database\n";
  print "  -webroot <url>      : web URL for primary webservice using this instance eg http://myhost/eeDB/\n";
  print "  -registry <url>     : eeDB URL registry instance\n";
  print "  -newpeer            : recreate the internal peer with new UUID\n";
  print "  -v                  : simple debugging output\n";
  print "  -debug <level>      : extended debugging output (eg -debug 3)\n";
  print "eedb_create_instance.pl v1.0\n";
  
  exit(1);  
}

#########################################################################################


sub create_new_db_instance {

  unless($eeDB and ($eeDB->driver eq "mysql")) {
    print("ERROR: currently only support for automatic creation of eeDB-mysql instances\n\n");
    usage;
  }
  
  my $new_dbname = $eeDB->dbname;

  printf("target URL : %s\n", $eeDB->full_url);
  printf("new database [%s]\n", $new_dbname);
  
  my $mysqlDB = EEDB::Database->new(
    '-user'     => $eeDB->user,
    '-password' => $eeDB->password,
    '-host'     => $eeDB->host,
    '-port'     => $eeDB->port,
    '-dbname'   => "mysql");
    
  printf("root eedb : %s\n", $mysqlDB->full_url);
  my $dbc2=undef;
  eval { $dbc2 = $mysqlDB->get_connection; };
  if(!$dbc2) { 
    printf("ERROR: connecting to MYSQL database\n\n");
    usage(); 
  }
  
  printf("create new database [%s]\n", $new_dbname);
  $mysqlDB->do_sql("create database ". $new_dbname);
  
  my $mysqlcmd = sprintf("mysql -h %s -P %s -u%s -p%s %s ", 
                    $eeDB->host,
                    $eeDB->port,
                    $eeDB->user,
                    $eeDB->password,
                    $eeDB->dbname);
  my $cmd1 = $mysqlcmd . " < " . $eedb_root."/sql/schema.sql";
  my $cmd2 = $mysqlcmd . " < " . $eedb_root."/sql/assembly_chrom_data.sql";

  print($cmd1);
  system($cmd1);
  
  print($cmd2);
  system($cmd2);
                          
  return $eeDB;
}


sub recreate_peer {
  my $db = shift; #required
  my $web_url = shift; #optional
  
  return undef unless($db);

  my $peer = EEDB::Peer->fetch_self_from_url($db->url);
  if($peer) {
    printf("old peer : %s\n", $peer->xml);
  }

  $peer = new EEDB::Peer;
  $peer->create_uuid;
  $peer->alias($db->alias);
  $peer->db_url($db->url);
  if($web_url) { $peer->web_url($web_url); }

  if($db->driver eq 'oscdb') { $db = $db->database; }

  $peer->store($db);
  $db->execute_sql("UPDATE peer SET is_self=0"); #clears old "selfs"
  $db->execute_sql("UPDATE peer SET is_self=1 WHERE uuid=?", $peer->uuid);

  printf("new peer : %s\n", $peer->xml);

  return $peer;
}


1;
