#!/usr/bin/perl -w

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

my $connection_count = 0;

my $start_date = localtime();
my $launch_time = time();

while (my $cgi = new CGI::Fast) {
  process_url_request($cgi);
  $connection_count++;
}

##########################

sub process_url_request {
  my $cgi = shift;

  my $self = {};
  $self->{'starttime'} = time()*1000;
  $self->{'mode'} = '';

  $self->{'cgi'} = $cgi;
  process_url_parameters($self);

  if($self->{'mode'} eq "draw_svg") {
    if(echo_data($self)) { return; }
  }
  show_fcgi($self, $cgi);
}


sub process_url_parameters {
  my $self = shift;

  my $cgi = $self->{'cgi'};

  $self->{'mode'} = $cgi->param('mode') if(defined($cgi->param('mode')));
  $self->{'svg_doc'} = $cgi->param('svg') if(defined($cgi->param('svg')));

  $self->{'title'} = $cgi->param('title') if(defined($cgi->param('title')));
  $self->{'description'} = $cgi->param('description') if(defined($cgi->param('description')));
  $self->{'savefile'} = $cgi->param('savefile') if(defined($cgi->param('savefile')));
}


sub show_fcgi {
  my $self = shift;
  my $cgi = shift;

  my $id = $cgi->param("id"); 

  my $uptime = time()-$launch_time;
  my $uphours = floor($uptime / 3600);
  my $upmins = ($uptime - ($uphours*3600)) / 60.0;

  print header;
  print start_html("EdgeExpressDB webservice");
  print h1("eeDB CGI server (perl)");
  print p("eedb_svgecho.cgi<br>\n");
  printf("<p>server launched on: %s Tokyo time\n", $start_date);
  printf("<br>uptime %d hours % 1.3f mins ", $uphours, $upmins);
  print "<br>Invocation number ",b($connection_count);
  print " PID ",b($$);
  my $hostname = `hostname`;
  printf("<br>host : %s\n",$hostname);
  print hr;

  print end_html;
}


#########################################################################################

sub echo_data {
  my $self = shift;

  my $cgi = $self->{'cgi'};
  unless($self->{'svg_doc'}) { return undef; }

  my $tpp = XML::TreePP->new();
  my $tree = $tpp->parse($self->{'svg_doc'});
  unless($tree) { return undef; }
  unless($tree->{'svg'}) { return undef; }


  if($self->{'savefile'} eq 'true') {
    my $filename = $self->{'title'};
    if(!$filename) { $filename = "gLyphs_svg_export.svg"; }
    else {
      $filename =~ s/\s+/_/g;
      $filename .= ".svg";
    }
    print header(-type => "text/xml", -charset=> "UTF8", -attachment=>$filename);
  } else {
    print header(-type => "text/xml", -charset=> "UTF8");
  }
  print "<?xml version=\"1.0\" standalone=\"no\"?>\n";
  print "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
  print($self->{'svg_doc'});

  return 1;
}


