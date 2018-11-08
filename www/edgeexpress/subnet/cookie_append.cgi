#!/usr/bin/perl -w
#
#  PROGRAM:	cookie-get.cgi
#
#  PURPOSE:	Demonstrate how to GET a cookie through a Perl/CGI program
#		using the CGI.pm module.
#
#  Copyright DevDaily Interactive, Inc., 1998. All Rights Reserved.
#

#------------------------------#
#  1. Create a new CGI object  #
#------------------------------#

use CGI;
$query = new CGI;

#--------------------------------------------------------------#
#  2. Create the HTTP header and print the doctype statement.  #
#--------------------------------------------------------------#

print $query->header;


#----------------------------------------------------#
#  3. Start the HTML doc, and give the page a title  #
#----------------------------------------------------#

print $query->start_html('My cookie-get.cgi program');


#----------------------------------------------------------------------#
#  4. Retrieve the cookie. Do this by using the cookie method without  #
#     the -value parameter.                                            #
#----------------------------------------------------------------------#


print $query->h3('The cookie is ...');
$theCookie = $query->cookie('MY_COOKIE');

print "

    \n"; print $theCookie; print "

\n";



#-------------------------#
#  5. End the HTML page.  #
#-------------------------#

print $query->end_html;
