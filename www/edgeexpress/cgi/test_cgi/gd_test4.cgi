#!/usr/local/bin/perl -w    

use CGI ':standard';
use GD::Graph::bars;
use GD::Simple; 

my $img = GD::Simple->new(640, 40); 

$img->fgcolor('black');
$img->bgcolor('white'); 

$img->moveTo(0,5);
for(my $x=1; $x<640; $x+=2) {
  my $y = int(rand(30));
  $img->lineTo($x, $y);
}
    

print "Content-type: image/png\n\n";
print $img->png;
