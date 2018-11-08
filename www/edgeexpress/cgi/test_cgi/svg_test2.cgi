#!/usr/local/bin/perl -w    
use CGI ':standard';
use SVG;

my $svg= SVG->new(width=>640,height=>40);

# use explicit element constructor to generate a group element
my $y=$svg->group( id=>'group_y', style => { stroke=>'red', fill=>'green' });

my $xv=[];
my $yv=[];
for(my $x=1; $x<640; $x+=2) {
  my $y = int(rand(30));
  push @$xv, $x;
  push @$yv, $y
}

$points = $y->get_path( x=>$xv, y=>$yv, -type=>'polyline', -closed=>'true'); #specify that the polyline is closed.
my $tag = $y->polyline ( %$points, id=>'pline_1', style=>{ 'fill-opacity'=>0, 'stroke-color'=>'rgb(250,123,23)' });

# now render the SVG object, implicitly use svg namespace
print header(-type => "image/svg+xml", -charset=> "UTF8");
print $svg->xmlify;

