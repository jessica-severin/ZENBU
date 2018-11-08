#!/usr/local/bin/perl -w    

use strict;
use CGI ':standard';
use GD::Simple; 


     GD::Simple->class('GD::SVG');

     my $img = GD::Simple->new(500,500);
     $img->bgcolor('white');
     $img->fgcolor('blue');

    $img->rectangle(10, 10, 50, 50);
    
    $img->moveTo(200,100);
    $img->ellipse(50, 50); 

    $img->moveTo(10,180);
    $img->string('This is very simple');


print header(-type => "image/svg+xml", -charset=> "UTF8");
print $img->svg;
