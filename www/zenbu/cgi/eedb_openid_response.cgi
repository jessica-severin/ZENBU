#!/usr/bin/perl
BEGIN{
    unshift(@INC, "/usr/share/zenbu/src/ZENBU/lib");
}

use warnings;
use strict;
use Net::OpenID::Consumer;
use LWP::UserAgent;
use CGI qw(:standard);

use File::Spec;
use Cache::File;
use Cache::Memory;
use XML::TreePP;
use Time::HiRes qw(time gettimeofday tv_interval);
use POSIX qw(ceil floor);

use EEDB::Database;
use EEDB::User;

my $userDB_url = undef;
my $userDB  = undef;

my $SESSION_NAME = "CGISESSID";

my $SERVER_NAME = undef;
my $WEB_URL     = undef;

init_config('server_config');
init_db();

my $self = {};
$self->{'starttime'} = time()*1000;
my $cgi = new CGI;
$self->{'cgi'} = $cgi;

get_webservice_url($self);

get_session($self);
#unless($self->{'session'}) { reset_session(); }

my $uuid = $self->{'session'}->{"EEDB_openID_secret"};
#unless($uuid) { reset_session(); }

my $cache = Cache::File->new( cache_root => File::Spec->tmpdir.'/eedb_webcache');

my $csr = Net::OpenID::Consumer->new (
     cache => $cache, 
     # The root of our URL.
     required_root => $WEB_URL,
     # Our password.
     consumer_secret => $uuid,
     # Where to get the information from.
     args  => $cgi,
 );

$csr->handle_server_response (
     not_openid => \&not_openid,
     setup_required => sub {
     #setup_needed => sub {
         my $setup_url = shift;
         #print "You need to do something <a href='$setup_url'>here</a>.";
	 print "Location: $setup_url\n\n";
     },
     cancelled => \&canceled_login, 
     verified => sub { 
       my $vident = shift;
       verified_indent_2_eedb_user($self, $vident);
     },
     error => \&handle_errors,
 );

exit 0;

# Handle errors, suggest possible causes of the error.

sub handle_errors {
  my ($err) = @_;

  my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
  print $cgi->header(-cookie=>$cookie);
  print $cgi->start_html();
  print "<h1>eedb_openid_response.cgi</h1>\n";
  print "<b>Error: $err</b>. \n";
  if($err eq 'server_not_allowed') {
    print "You may have gone to an http: server and come back from an https: server. This happens with \"myopenid.com\"\n";
  } elsif ($err eq 'naive_verify_failed_return') {
    print 'Oops! Did you reload this page?';
  }
  print $cgi->end_html();
}

sub not_openid {
  my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
  print $cgi->header(-cookie=>$cookie);
  print $cgi->start_html();
  print "<h1>eedb_openid_response.cgi</h1>\n";
  print "That's not an OpenID message. Did you just type in the URL?";
  print $cgi->end_html();
}

sub canceled_login {
  my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
  print $cgi->header(-cookie=>$cookie);
  print $cgi->start_html();
  print "<h1>eedb_openid_response.cgi</h1>\n";
  print 'You cancelled your login.\n';
  print $cgi->end_html();
}

sub no_session_error {
  my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
  print $cgi->header(-cookie=>$cookie);
  print $cgi->start_html();
  my $sid = $cgi->cookie($SESSION_NAME) || undef;
  print "<h1>eedb_openid_response.cgi</h1>\n";
  print 'unable to find session.';
  printf("<br>SESSION_NAME [%s]\n", $SESSION_NAME);
  printf("<br>id [%s]\n", $sid);
  print $cgi->end_html();
}


#####################################################
#
# eeDB user profile negotiation
#
#####################################################


sub init_db {
  if($userDB_url) {
    $userDB = EEDB::Database->new_from_url($userDB_url);
  }

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
}


sub init_config {
  my $path = shift;
  #new redirect file. contains a single line with path to actual config file
  #which should be somewhere outside of the apache web paths to protect passwords
  if(!open(FILE1, "$path" )) { return }
  my $config_xml_path = <FILE1>;
  chomp($config_xml_path);
  close FILE1;
  return parse_config_xmlfile($config_xml_path);
}

sub parse_config_xmlfile {
  my $xmlpath = shift;
  if(!$xmlpath or !(-e $xmlpath)) { return; }
  #printf(STDERR "parse_config_xmlfile [%s]\n", $xmlpath);

  my $tpp = XML::TreePP->new();
  my $xmlTree;
  eval {
    $xmlTree = $tpp->parsefile($xmlpath);
  };
  if($@) {
    printf(STDERR "$@\n");
    return;
  }
  unless($xmlTree and $xmlTree->{'zenbu_server_config'}) { return; }
  #print "TREE::" , $tree, "\n";

  my $root_node = $xmlTree->{'zenbu_server_config'};
  my $node;

  $node = $root_node->{'session_name'};
  if($node) { $SESSION_NAME = $node; }
  
  $node = $root_node->{'user_db'};
  if($node) { $userDB_url = $node; }
  
  $node = $root_node->{'eedb_root'};
  if($node) { $ENV{EEDB_ROOT} = $node; }

  $node = $root_node->{'eedb_user_rootdir'};
  if($node) { $ENV{EEDB_USER_ROOTDIR} = $node; }
  
  $node = $root_node->{'web_root'};
  if($node) { $WEB_URL = $node; }
  
  $node = $root_node->{'web_root'};
  if($node) { $SERVER_NAME = $node; }

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


sub get_session {
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
  #my $openID = $self->{'session'}->{"eedb_validated_user_openid"};
  #unless($openID) { return; }

  #if($openID) {
  #  my $user = EEDB::User->fetch_by_openID($userDB, $openID);
  #  if($user) { $self->{'user_profile'}= $user; }
  #}

  $userDB->disconnect;
}


sub save_session {
  my $self = shift;

  unless($self) { return; }
  unless($userDB) { return; }
  unless($self->{'session'}) { return; }

  my $dbh = $userDB->get_connection();
  unless($dbh) { return; }
  
  unless($self->{'session'}->{'id'}) {
    #create new session
    my $ug    = new Data::UUID;
    my $uuid  = $ug->create_b64();
    $uuid =~ s/=//g;
    $uuid =~ s/\+/\-/g;
    $uuid =~ s/\//_/g;
    $self->{'session'}->{'id'} = $uuid;
    $self->{'session'}->{'SESSION_CTIME'} = floor(time());
    
    my $sql = "INSERT into sessions(id) values(?)";
    $userDB->execute_sql($sql, $uuid);
  }

  $self->{'session'}->{'SESSION_ATIME'} = floor(time());

  #generate XML
  my $sessionXML = "<zenbu_session>";
  foreach my $key (keys(%{$self->{'session'}})) {
    my $value = $self->{'session'}->{$key};
    unless($value and $key) { next; }
    $sessionXML .= sprintf("<%s>%s</%s>", $key, $value, $key);
  }
  $sessionXML .= "</zenbu_session>";
  
  #update sessions table
  my $sql = "UPDATE sessions SET a_session=? WHERE id=?";
  $userDB->execute_sql($sql, $sessionXML, $self->{'session'}->{'id'});
  $userDB->disconnect;
}



#####################################################

sub verified_indent_2_eedb_user {
  my $self = shift;
  my $vident = shift;

  $self->{'user_profile'}= undef;
  $self->{'session'}->{"eedb_validated_user_openid"} = "";

  unless($userDB) { return redirect_to_login($self); }

  my $user = EEDB::User->create_new_profile($vident, $userDB);
  if($user) {
    $self->{'user_profile'}= $user;
    $self->{'session'}->{"eedb_validated_user_openid"} = $vident->url;

    my $sreg = $vident->extension_fields('http://openid.net/extensions/sreg/1.1');
    if($sreg) {
      if($sreg->{'email'}) { 
        printf(STDERR  "openid sreg EMAIL[%s]\n", $sreg->{'email'});
      }
      #if($sreg->{'fullname'}) { $user->metadataset->add_tag_symbol('openid:fullname', $sreg->{'fullname'}); }
      #if($sreg->{'nickname'}) { $user->metadataset->add_tag_symbol('openid:nickname', $sreg->{'nickname'}); }
      #if($sreg->{'country'}) { $user->metadataset->add_tag_symbol('openid:country', $sreg->{'country'}); }
      #if($sreg->{'language'}) { $user->metadataset->add_tag_symbol('openid:language', $sreg->{'language'}); }
      ##if($sreg->{'timezone'}) { $user->metadataset->add_tag_symbol('openid:timezone', $sreg->{'timezone'}); }
      #if($sreg->{'gender'}) { $user->metadataset->add_tag_symbol('openid:gender', $sreg->{'gender'}); }
      #if($sreg->{'dob'}) { $user->metadataset->add_tag_symbol('openid:dob', $sreg->{'dob'}); }
    }

  }
  $self->{'session'}->{"EEDB_openID_secret"} = "";
  save_session($self);

  #show_user($self);
  redirect_to_login($self);
}


sub old_verified_indent_2_eedb_user {
  my $self = shift;
  my $vident = shift;

  my $openID = $vident->url;

  $self->{'user_profile'}= undef;
  $self->{'session'}->{"eedb_validated_user_openid"} = "";

  unless($userDB) { return undef; }

  my $user = EEDB::User->fetch_by_openID($userDB, $openID);

  if($user) {
    $self->{'session'}->{"eedb_validated_user_openid"} = $openID;
  } else {
    $user = new EEDB::User;
    $user->openID($openID);

   ##$user->metadataset->add_tag_symbol('test', 'hello world');
   ##my $sreg = $vident->extension_fields('http://openid.net/srv/ax/1.0');
   #my $sreg = $vident->extension_fields('http://openid.net/extensions/sreg/1.1');
   #foreach my $regkey (keys(%$sreg)) {
   #  $user->metadataset->add_tag_symbol('openid:'.$regkey, $sreg->{$regkey});
   #}

   my $sreg = $vident->extension_fields('http://openid.net/extensions/sreg/1.1');
   if($sreg->{'email'}) { $user->email_address($sreg->{'email'}); }
   if($sreg->{'fullname'}) { $user->metadataset->add_tag_symbol('openid:fullname', $sreg->{'fullname'}); }
   if($sreg->{'nickname'}) { $user->metadataset->add_tag_symbol('openid:nickname', $sreg->{'nickname'}); }
   if($sreg->{'country'}) { $user->metadataset->add_tag_symbol('openid:country', $sreg->{'country'}); }
   if($sreg->{'language'}) { $user->metadataset->add_tag_symbol('openid:language', $sreg->{'language'}); }
   if($sreg->{'timezone'}) { $user->metadataset->add_tag_symbol('openid:timezone', $sreg->{'timezone'}); }
   if($sreg->{'gender'}) { $user->metadataset->add_tag_symbol('openid:gender', $sreg->{'gender'}); }
   if($sreg->{'dob'}) { $user->metadataset->add_tag_symbol('openid:dob', $sreg->{'dob'}); }

   #
   # UUID and user-registry
   #

   my $ug    = new Data::UUID;
   my $uuid  = $ug->to_string($ug->create());
   $user->metadataset->add_tag_data('uuid', $uuid);

   ## create user registry here

   $user->store($userDB);
  }
  $self->{'user_profile'}= $user;
  $self->{'session'}->{"eedb_validated_user_openid"} = $openID;

  redirect_to_login($self);
}


sub show_user {
  my $self = shift;
  my $cgi = $self->{'cgi'};

  if($self->{'session'}) {
    #$self->{'session'}->flush();
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/html", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/html", -charset=> "UTF8");
  }  
  print $cgi->start_html("eeDB openID new user");
  print $cgi->h1("eeDB user profile");

  print $cgi->hr;
  if($self->{'session'}) {
    printf("<br>eedb_validated_user_openid : <b>%s</b>\n",
       $self->{'session'}->{"eedb_validated_user_openid"});
  }
  print $cgi->hr;
  if($self->{'user_profile'}) {
    printf("<br>user_email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>user_openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
    printf("<br>%s", $self->{'user_profile'}->display_desc);
    printf("<br>%s", $self->{'user_profile'}->metadataset->display_contents);
  }
  print $cgi->hr;

  print $cgi->end_html;
}


sub redirect_to_login {
  my $self = shift;

  if($self->{'session'}) {
    my $last_url = $self->{'session'}->{"last_url"};
    if(!$last_url) { $last_url = $WEB_URL."/"; }
    #$self->{'session'}->flush();
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->redirect(-uri=> ($last_url), -cookie=>$cookie);
  } else {
    print $cgi->redirect(-uri=> ($WEB_URL."/user"));
  }
}


sub reset_session() {
  print $cgi->redirect(-uri=> ($WEB_URL."/cgi/eedb_user.cgi?mode=reset"));
}

