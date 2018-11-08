#!/usr/bin/perl -w
BEGIN{
    unshift(@INC, "/zenbu/src/bioperl-1.5.2_102");
    unshift(@INC, "/zenbu/src/MappedQuery_0.958/lib");
    unshift(@INC, "/zenbu/src/ZENBU_2.201/lib");
}

use CGI qw(:standard);
use CGI::Carp qw(warningsToBrowser fatalsToBrowser);

use File::Spec;
use File::Basename;

use strict;
use Getopt::Long;
use Switch;
use Time::HiRes qw(time gettimeofday tv_interval);
use POSIX qw(ceil floor);
use XML::TreePP;

use EEDB::Database;
use EEDB::User;
use EEDB::SPStream::OSCFileDB;
use EEDB::SPStream::FederatedSourceStream;

my @seed_urls;
my @seed_peers;

my $userDB_url = undef;
my $userDB  = undef;

my $SESSION_NAME = "CGISESSID";


my $start_date = localtime();
my $launch_time = time();
my $connection_count = 0;

my $SERVER_NAME = undef;
my $WEB_URL     = undef;
parse_conf('eedb_server.conf');

my $self = {};
$self->{'starttime'} = time()*1000;
$self->{'platform'}  = "user_undefined";

get_webservice_url($self);

#
# initialize database, CGI, Session
#
my $cgi = new CGI;
$self->{'cgi'} = $cgi; 

init_db();

process_url_request($self);

exit 0;


##########################

sub process_url_request {
  my $self = shift;

  get_session_user($self);

  my $cgi     = $self->{'cgi'};

  $self->{'mode'} = $cgi->param('mode');
  $self->{'format'} = $cgi->param('format');

  if(defined($cgi->param('upload_file'))) {
    $self->{'mode'} ='upload';
    $self->{'upload_file'} = $cgi->param('upload_file');
    $self->{'display_name'} = $cgi->param('display_name');
    $self->{'description'} = $cgi->param('description');
    if($cgi->param('assembly')) { $self->{'assembly'} = $cgi->param('assembly'); }
    if($cgi->param('platform')) { $self->{'platform'} = $cgi->param('platform'); }
    if($cgi->param('datatype')) { $self->{'datatype'} = $cgi->param('datatype'); }
    if($cgi->param('bedscore_expression')) { $self->{'bedscore_expression'} = $cgi->param('bedscore_expression'); }
    if($cgi->param('singletagmap_expression')) { $self->{'singletagmap_expression'} = $cgi->param('singletagmap_expression'); }
  }

  $self->{'mode'} ='info' unless(defined($self->{'mode'}));
  $self->{'format'}='xml' unless(defined($self->{'format'}));

  ##### 
  # now process
  #
  if($self->{'mode'} eq "upload") {
    upload_data($self);
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
  print p("eedb_upload.cgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  if($userDB) { printf("<br>user_db : %s\n",$userDB->url); }

  if($self->{'user_profile'}) {
    printf("<br>profile email : <b>%s</b>\n",$self->{'user_profile'}->email_address);
    printf("<br>profile openID : <b>%s</b>\n",$self->{'user_profile'}->openID);
  }
  print hr;

  print $cgi->end_html;
}


#########################################################################################


sub init_db {
  if(scalar(@seed_peers)>0) { return; }

  foreach my $url (@seed_urls) {
    my $db = EEDB::Database->new_from_url($url);
    my $peer = EEDB::Peer->fetch_self($db);
    if($peer) { push @seed_peers, $peer; }
  }

  if($userDB_url) {
    $userDB = EEDB::Database->new_from_url($userDB_url);
  }

  EEDB::Feature->set_cache_behaviour(0);
  EEDB::Edge->set_cache_behaviour(0);
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

sub escape_xml {
  my $data = shift;
  $data =~ s/\&/&amp;/g;
  $data =~ s/\"/&quot;/g; #\"
  $data =~ s/\</&lt;/g;
  $data =~ s/\>/&gt;/g;
  return $data;
}

#########################################################################################

####################################################################
#
# upload data section
#
####################################################################

sub upload_data {
  my $self = shift;

  $self->{'safe_upload_filename'} = "";
  $self->{'upload_linecount'} = 0;

  if(!defined($self->{'user_profile'})) { 
    $self->{'upload_error'} ="no login profile";
    #return show_upload_status($self); 
    return redirect_to_mydata($self); 
  }

  my $cgi = $self->{'cgi'};

  my $metadataset = new EEDB::MetadataSet;
  $metadataset->add_tag_symbol("keyword", "uploaded_data");

  my $tiny ="";
  my @seed = split(//, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  for(my $x=0; $x<6; $x++) { $tiny .= $seed[int(rand(62))]; }

  my $safe_filename_characters = "a-zA-Z0-9_.-";
  my $filename = $self->{'upload_file'};
  my $extension = "";
  #extract extension
  if((my $p2=rindex($filename, ".gz")) != -1) {
    $extension = substr($filename, $p2);
    $filename = substr($filename, 0, $p2);
  }
  if((my $p2=rindex($filename, ".")) != -1) {
    $extension = substr($filename, $p2) . $extension;
    $filename = substr($filename, 0, $p2);
  }    
  $filename .= "_".$tiny . $extension;
  $filename =~ tr/ /_/;  
  $filename =~ s/[^$safe_filename_characters]//g;
  $self->{'safe_upload_filename'} = $filename;

  my $upload_dir = $self->{'user_profile'}->user_directory;
  $filename = $upload_dir ."/". $filename;
  printf(STDERR "upload to safename [%s]\n", $filename);

  my $linecount=0;
  my $upload_filehandle = $cgi->upload("upload_file");

  if(!open(UPLOADFILE, ">$filename" )) { redirect_to_mydata($self); }
  binmode UPLOADFILE;  
  while ( <$upload_filehandle> )  {
    $linecount++;  
    print UPLOADFILE;
  }  
  close UPLOADFILE;
  $self->{'upload_linecount'} = $linecount;

  #uses samtools to convert BAM to SAM and to apply a -q quality cutoff filter
  #replaces $file with new sam file
  if($filename =~ /\.bam/) { $filename = preprocess_bam_file($self, $filename); }

  #next write out the xml control file
  my $xmlfile = write_upload_xmlinfo($self, $filename);
  
  #queue up the job for processing
  my $job_input = "<job><input_file>".$xmlfile."</input_file></job>";
  my $sql = "INSERT INTO job (user_id, parameters) VALUES(?,?)";
  $userDB->execute_sql($sql, $self->{'user_profile'}->primary_id, $job_input);

  #show_upload_status($self);
  redirect_to_mydata($self); 
}


sub  write_upload_xmlinfo {
  my $self     = shift;
  my $filename = shift;

  my $extension = "";
  my $input_file = $filename;
  
  #extract extension
  if((my $p2=rindex($filename, ".gz")) != -1) {
    $filename = substr($filename, 0, $p2);
  }
  if((my $p2=rindex($filename, ".")) != -1) {
    $extension = substr($filename, $p2+1);
    $filename = substr($filename, 0, $p2);
  }    
  $filename .= ".xml";
  
  printf(STDERR "write xml configuration [%s]\n", $filename);
  
  if(!open(XMLFILE, ">$filename")) { return undef; }
  
  printf(XMLFILE "<oscfile>\n");
  printf(XMLFILE "  <parameters>\n");
  
  printf(XMLFILE "    <input_file>%s</input_file>\n", $input_file);
  printf(XMLFILE "    <filetype>%s</filetype>\n", $extension);
    
  if($self->{'display_name'})            { printf(XMLFILE "    <display_name>%s</display_name>\n", $self->{'display_name'}); }
  if($self->{'description'})             { printf(XMLFILE "    <description>%s</description>\n", $self->{'description'}); }
  if($self->{'assembly'})                { printf(XMLFILE "    <genome_assembly>%s</genome_assembly>\n", $self->{'assembly'}); }
  if($self->{'platform'})                { printf(XMLFILE "    <platform>%s</platform>\n", $self->{'platform'}); }
  if($self->{"bedscore_expression"})     { printf(XMLFILE "    <score_as_expression>%s</score_as_expression>\n", $self->{'datatype'}); }
  if($self->{"singletagmap_expression"}) { printf(XMLFILE "    <singletagmap_expression>%s</singletagmap_expression>\n", $self->{"singletagmap_expression"}); }
  
  printf(XMLFILE  "  </parameters>\n");
  printf(XMLFILE  "</oscfile>\n");
  close XMLFILE;
  return $filename;
}


sub show_upload_status {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->header(-cookie=>$cookie, -type => "text/xml", -charset=> "UTF8");
  } else {
    print $cgi->header(-type => "text/xml", -charset=> "UTF8");
  }  
  printf("<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>\n");
  printf("<upload>\n");

  if($self->{'user_profile'}) { print($self->{'user_profile'}->simple_xml); }
  if($self->{'display_name'}) { printf("<display_name>%s</display_name>\n", $self->{'display_name'}); }
  if($self->{'description'}) { printf("<description>%s</description>\n", $self->{'description'}); }
  if($self->{'assembly'}) { printf("<assembly>%s</assembly>\n", $self->{'assembly'}); }
  if($self->{'platform'}) { printf("<platform>%s</platform>\n", $self->{'platform'}); }
  if($self->{'bedscore_expression'}) { printf("<bedscore_expression>%s</bedscore_expression>\n", $self->{'datatype'}); }

  if($self->{'upload_file'}) {
    printf("<original_file>%s</original_file>\n", $self->{'upload_file'});
    printf("<safe_file>%s</safe_file>\n", $self->{'safe_upload_filename'});
    printf("<line_count>%d</line_count>\n", $self->{'upload_linecount'});
  }

  if($self->{'upload_error'}) { printf("<upload_ERROR>%s</upload_ERROR>\n", $self->{'upload_error'}); }

  my $total_time = (time()*1000) - $self->{'starttime'};
  printf("<process_summary processtime_sec=\"%1.3f\" />\n", $total_time/1000.0);

  printf("</upload>\n");
}


sub redirect_to_mydata {
  my $self = shift;

  if($self->{'session'}) {
    my $cookie = $cgi->cookie($SESSION_NAME => $self->{'session'}->{'id'});
    print $cgi->redirect(-uri=> ($WEB_URL."/user/#section=mydata"), -cookie=>$cookie);
  } else {
    print $cgi->redirect(-uri=> ($WEB_URL."/user/#section=mydata"));
  }
}


sub preprocess_bam_file {
  my $self = shift;
  my $file = shift;

  printf(STDERR "bam file : [%s]\n", $file);
  my $builddir = "/tmp";

  my $samfile = $file;
  #if((my $p2=rindex($file, "/")) != -1) {
  #  my $basename = substr($file, $p2);
  #  printf("  file basename [%s]\n", $basename);
  #  $samfile = $builddir . $basename . ".sam";
  #}
  if($samfile =~ /(.*)\.bam/) { $samfile = $1; }
  $samfile .= ".sam";
  printf(STDERR "  prepare sam file [%s]\n", $samfile);

  my $cmd = "/usr/bin/samtools view -h -q 10 $file > $samfile";
  printf(STDERR "%s\n", $cmd);
  system($cmd);
  $cmd = "rm $file";
  printf(STDERR "%s\n", $cmd);
  system($cmd);
  return $samfile;
}

