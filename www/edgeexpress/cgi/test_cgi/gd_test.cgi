#!/usr/local/bin/perl -w    

use CGI ':standard';
use GD::Graph::bars;
use GD::Simple; 

my $img = GD::Simple->new(640, 480); 

    $img->fgcolor('black');
    $img->bgcolor('yellow'); 

    $img->rectangle(10, 10, 50, 50);
    
    $img->moveTo(200,100);
    $img->ellipse(50, 50); 

    $img->moveTo(10,180);
    $img->string('This is very simple');

print "Content-type: image/png\n\n";
print $img->png;
