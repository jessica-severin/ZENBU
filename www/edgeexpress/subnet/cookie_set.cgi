#!/usr/bin/perl -w

use CGI;

$query = new CGI;

$cookie = $query->cookie(-name=>'MY_COOKIE',
			 -value=>'BEST_COOKIE=chocolatechip',
			 -expires=>'+4h',
			 -path=>'/');

print $query->header(-cookie=>$cookie);

#--------------------------------------------------#
#  4. Give the page a title and a simple header.   #
#     (Not really needed in this simple example.)  #
#--------------------------------------------------#

print $query->start_html('My cookie-set.cgi program');
print $query->h3('The cookie has been set');


#-------------------------#
#  5. End the HTML page.  #
#-------------------------#

print $query->end_html;
