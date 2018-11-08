#!/usr/bin/perl -w
BEGIN{
    unshift(@INC, "/usr/share/zenbu/src/ZENBU/lib");
}

use CGI qw(:standard);
use CGI::Carp qw(warningsToBrowser fatalsToBrowser);
use CGI::Fast qw(:standard);

use File::Spec;
use Net::OpenID::Consumer;
use Data::UUID;
use Cache::File;
use Cache::Memory;
use File::Basename;

use strict;
use Getopt::Long;
use Switch;
use Time::HiRes qw(time gettimeofday tv_interval);
use POSIX qw(ceil floor);
use XML::TreePP;

use MQdb::Database;
use EEDB::User;
use EEDB::Peer;

my $userDB_url = undef;
my $userDB  = undef;

my $SESSION_NAME = "CGISESSID";

my $start_date = localtime();
my $launch_time = time();
my $connection_count = 0;

my $SERVER_NAME = undef;
my $WEB_URL     = undef;
init_config('server_config');
init_db();

while (my $cgi = new CGI::Fast) {
  process_url_request($cgi);
  $connection_count++;

  #EEDB::Peer->set_cache_behaviour(0);
  EEDB::Experiment->set_cache_behaviour(0);
  EEDB::FeatureSource->set_cache_behaviour(0);
  EEDB::EdgeSource->set_cache_behaviour(0);

  disconnect_db();
}

exit 0;


##########################

sub process_url_request {
  my $cgi = shift;

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
  #EEDB::Peer->set_cache_behaviour(1);
  EEDB::Experiment->set_cache_behaviour(1);
  EEDB::FeatureSource->set_cache_behaviour(1);
  EEDB::EdgeSource->set_cache_behaviour(1);

  my $self = {};
  $self->{'starttime'} = time()*1000;
  $self->{'cgi'} = $cgi;

  get_webservice_url($self);

  get_session_user($self);
  unless($self->{'session'}) { no_session_error($self); exit; }

  #process parameters
  if($cgi->param('POSTDATA')) { process_xml_parameters($self); }
  else { process_url_parameters($self); }

  #set defaults if not set
  $self->{'mode'} ='info' unless(defined($self->{'mode'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));

  ##### 
  # now process
  #
  if(defined($self->{'user_query'})) { 
    user_login($self);
    return print $self->{'cgi'}->redirect ("../user#error=". $self->{'login_error'});
  }

  if($self->{'mode'} eq "user") {
    show_user($self);
  } elsif($self->{'mode'} eq "logout") {
    logout($self);
  } else {
    show_fcgi($self);
  }

  foreach my $peer (@{EEDB::Peer->global_cached_peers}) {
    next unless($peer);
    $peer->disconnect;
  }
}


sub show_fcgi {
  my $self = shift;
  my $cgi = $self->{'cgi'};

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/html", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/html", -charset=> "UTF8");
  }
  print $cgi->start_html("eeDB CGI user server");
  print h1("CGI user login server(perl)");
  print p("eedb_user.cgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  printf("<br>web_url : %s\n",$WEB_URL);
  if($userDB) { printf("<br>user_db : %s\n",$userDB->url); }
  if($self->{'user_query'}) { printf("<br>query: %s\n", $self->{'user_query'}); }
  if($self->{'user_profile'}) {
    printf("<br>profile email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>profile openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
  }
  print hr;
  if($self->{'session'}) {
    printf("<p><b>session</b>");
    foreach my $key (keys(%{$self->{'session'}})) {
      my $value = $self->{'session'}->{$key};
      printf("<br>  [%s] = %s\n", $key, $value);
    }
  }


  print $cgi->end_html;
}


sub process_url_parameters {
  my $self = shift;

  my $cgi = $self->{'cgi'};

  $self->{'mode'} = $cgi->param('mode');
  $self->{'submode'} = $cgi->param('submode');
  $self->{'format'} = $cgi->param('format');

  $self->{'user_query'} = $cgi->param('user_query') if(defined($cgi->param('user_query')));
  $self->{'profile_email'} = $cgi->param('email') if(defined($cgi->param('email')));
  $self->{'profile_nickname'} = $cgi->param('nickname') if(defined($cgi->param('nickname')));

  $self->{'collaboration_uuid'} = $cgi->param('collaboration_uuid') if(defined($cgi->param('collaboration_uuid')));

  $self->{'mode'} ='info' unless(defined($self->{'mode'}));

  if($self->{'mode'} eq "create_group") {
    $self->{'display_name'} = $cgi->param('display_name');
    $self->{'description'} = $cgi->param('description');
    $self->{'public_announce'} = $cgi->param('public_announce');
  }

  if($self->{'mode'} eq "accept_request") {
    $self->{'requester_openid'} = $cgi->param('user');
  }

  if($self->{'mode'} eq "reject_request") {
    $self->{'requester_openid'} = $cgi->param('user');
  }

  if(defined($cgi->param('sharedb'))) {
    $self->{'mode'} ='sharedb';
    $self->{'db_uuid'} = $cgi->param('sharedb');
  }
}


sub process_xml_parameters {
  my $self = shift;

  my $cgi = $self->{'cgi'};

  my $xmlData = $cgi->param('POSTDATA');
  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($xmlData);

  if(!defined($tree)) { return; }
  if(!defined($tree->{"eedb_user_params"})) { return; }

  $self->{'mode'} = $tree->{"eedb_user_params"}->{'mode'} if($tree->{"eedb_user_params"}->{'mode'});
  $self->{'format'} = $tree->{"eedb_user_params"}->{'format'} if($tree->{"eedb_user_params"}->{'format'});

  $self->{'user_query'} = $tree->{"eedb_user_params"}->{'user_query'} if($tree->{"eedb_user_params"}->{'user_query'});
  $self->{'profile_email'} = $tree->{"eedb_user_params"}->{'email'} if($tree->{"eedb_user_params"}->{'email'});
  $self->{'profile_nickname'} = $tree->{"eedb_user_params"}->{'nickname'} if($tree->{"eedb_user_params"}->{'nickname'});

  $self->{'collaboration_uuid'} = $tree->{"eedb_user_params"}->{'collaboration_uuid'} if($tree->{"eedb_user_params"}->{'collaboration_uuid'});

  if(($self->{'mode'} eq "accept_request") or ($self->{'mode'} eq "reject_request")) {
    $self->{'requester_openid'} = $tree->{"eedb_user_params"}->{'user_openid'} if($tree->{"eedb_user_params"}->{'user_openid'});
  }

  if($self->{'mode'} eq "invite_user") {
    $self->{'invited_openID'} = $tree->{"eedb_user_params"}->{'user_openid'} if($tree->{"eedb_user_params"}->{'user_openid'});
  }

  if($self->{'mode'} eq "create_group") {
    $self->{'display_name'} = $tree->{"eedb_user_params"}->{'display_name'} if($tree->{"eedb_user_params"}->{'display_name'});
    $self->{'description'} = $tree->{"eedb_user_params"}->{'description'} if($tree->{"eedb_user_params"}->{'description'});
    $self->{'public_announce'} = $tree->{"eedb_user_params"}->{'public_announce'} if($tree->{"eedb_user_params"}->{'public_announce'});
  }
  if($self->{'mode'} eq "sharedb") {
    $self->{'db_uuid'} = $tree->{"eedb_user_params"}->{'sharedb'} if($tree->{"eedb_user_params"}->{'sharedb'});
  }
}



#########################################################################################


sub init_db {
  if($userDB_url) {
    $userDB = MQdb::Database->new_from_url($userDB_url);
    EEDB::Peer->fetch_self($userDB);
  }

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
}

sub disconnect_db {
  if($userDB) { $userDB->disconnect; }
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


sub user_login {
  my $self = shift;

  printf(STDERR "attempt user login [%s]\n", $self->{'user_query'});
  $self->{'user_profile'}= undef;
  
  unless($self->{'session'}) { $self->{'session'} = {}; }

  $self->{'session'}->{"eedb_validated_user_openid"} = "";

  unless($self->{'user_query'}) { return; }
  unless($userDB) { return }

  my $email = undef;
  my $openID = undef;
  if($self->{'user_query'} =~ /\@/) { 
    $email = $self->{'user_query'}; 
    printf(STDERR "appears to be email query\n");
  } else { 
    $openID = $self->{'user_query'}; 
    printf(STDERR "appears to be OpenID query\n");
  }


  if($openID) {
    send_openid_request($self, $openID);
    #fall though means error
    $self->{'login_error'} = "[ ". $openID. " ] not openID service provider or unknown user account. Please use one of openID providers above";
  } elsif($email) {
    send_email_request($self, $email);
    #fall though means error
    $self->{'login_error'} = "no profile for email [ " . $email ." ] please create profile with one of the openID providers above";
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

  #see if session is over 1 week, logout and make new session
  my $uptime = 60*60*24*14;
  if($self->{'session'}->{'SESSION_CTIME'}) {
    $uptime = time() - floor($self->{'session'}->{'SESSION_CTIME'});
  }
  if($uptime > 60*60*24*7) {
    $self->{'session'}->{'id'} = "";
    $self->{'session'}->{'eedb_validated_user_openid'} = "";
    save_session($self);
    return;
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

sub show_user {
  my $self = shift;

  my $cgi = $self->{'cgi'};

  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user>\n");

  if($self->{'user_profile'}) { print($self->{'user_profile'}->xml); }

  if($self->{'process_error'}) { printf("<ERROR>%s</ERROR>\n", $self->{'process_error'}); }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</user>\n");
}

sub logout {
  my $self = shift;
  my $cgi = $self->{'cgi'};

  if($self->{'session'}) {
    
    $self->{'session'}->{"eedb_validated_user_openid"} = "";
    save_session($self);
    
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<user>\n");

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</user>\n");
}


sub send_openid_request {
  my $self = shift;
  my $openid = shift;

  if($openid =~ /myopenid.com/) {
    if(!($openid =~ /:\/\//)) { $openid = "https://" . $openid; }
    elsif ($openid =~ /http:\/\/(.*)/) {
      $openid = "https://" . $1 ;
    }
  }
  my $cgi = $self->{'cgi'};

  my $ug    = new Data::UUID;
  my $uuid  = $ug->to_string($ug->create());
  $self->{'session'}->{"EEDB_openID_secret"} = $uuid;
  save_session($self);

  my $cache = Cache::File->new( cache_root => File::Spec->tmpdir.'/eedb_webcache');

  my $csr = Net::OpenID::Consumer->new (
     # The user agent which sends the openid off to the server.
     ua    => LWP::UserAgent->new,
     cache => $cache,
     # Who we are.
     required_root => $WEB_URL,
     # Our password.
     consumer_secret => $uuid,
     debug           => 1, 
  );
  my $claimed_id = $csr->claimed_identity($openid);
  if($claimed_id) {
    $claimed_id->set_extension_args("http://openid.net/extensions/sreg/1.1", {
          required => "email"});
    #      optional => "namePerson,namePerson/friendly"});
    #$claimed_id->set_extension_args('http://openid.net/extensions/sreg/1.1', {
    #        required => 'email',
    #        optional => 'fullname,nickname,country,language,timezone,gender,dob'});
    my $check_url = $claimed_id->check_url (
       delayed_return => 1,
       # The place we go back to.
       return_to  => ($WEB_URL .'/cgi/eedb_openid_response.cgi'),
       # Having this simplifies the login process.
       trust_root => $WEB_URL,
    );
    # Automatically redirect the user to the endpoint.
    print $cgi->redirect ($check_url);
    return 1;
  } else {
    printf(STDERR "unable to get claimed_id for OpenID\n");
  }
  return undef;
}


sub send_email_request {
  my $self = shift;
  my $email = shift;

  unless($email =~ /(.+)\@(.+)/) { return; }
  my $user_name = $1;
  my $email_host = $2;

  my ($user) = @{EEDB::User->fetch_all_by_email($userDB, $email)};
  if($user) { 
    printf(STDERR "found user for email[%s], send OpenID [%s]\n", $email, $user->openID);
    return send_openid_request($self, $user->openID); 
  }

  my $openID ="";
  if(($email_host eq "google.com") or ($email_host eq "gmail.com")) {
    $openID = "http://www.google.com/profiles/" . $user_name;
  }
  if($email_host eq "yahoo.com") { $openID = "http://me.yahoo.com"; }
  if($email_host eq "yahoo.co.jp") { $openID = "http://yahoo.co.jp"; }

  unless(send_openid_request($self, $openID)) {
    if(($email_host eq "google.com") or ($email_host eq "gmail.com")) {
      print $self->{'cgi'}->redirect("http://www.google.com/profiles/me");
      return;
    }
  }
}

sub no_session_error {
  my $self = shift;
  my $cgi = $self->{'cgi'};

  #create new session and send cookie to user's browser
  $self->{'session'} = {};
  save_session($self);

  my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
  print $cgi->redirect(-uri => "../user#error=needed to reset your session, please try to login again", -cookie => $cookie);
  return;
}


