/* $Id: zenbu_common.cpp,v 1.1 2016/02/01 07:01:02 severin Exp $ */

/***

NAME - EEDB::SPStreams::UserSystem

SYNOPSIS

DESCRIPTION

Specific subclass of WebBase which handles the user and collaboration subsystem

CONTACT

Jessica Severin <severin@gsc.riken.jp>

LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2013 Jessica Severin RIKEN OSC
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Jessica Severin RIKEN OSC nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

***/


#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <curl/curl.h>
#include <openssl/hmac.h>
#include <boost/algorithm/string.hpp>
#include <MQDB/MappedQuery.h>
#include <EEDB/WebServices/zenbu_common.h>

using namespace std;

string     _smtp_server_url;
string     _smtp_server_user;
string     _smtp_server_passwd;
string     _smtp_from;


void  send_email(string email, string subject, string message) {   
  CURL *curl;
  CURLcode res;
  struct curl_slist *recipients = NULL;
  
  /* this becomes the envelope forward-path */ 
  string email_to = "<" + email +">";
  //fprintf(stderr, "about to mail %s\n", email_to.c_str());
  
  curl = curl_easy_init();
  if(!curl) { return; }
  
  /* this is the URL for your mailserver - you can also use an smtps:// URL
   * here */ 
  curl_easy_setopt(curl, CURLOPT_URL, _smtp_server_url.c_str());
  
  /* In this example, we'll start with a plain text connection, and upgrade
   * to Transport Layer Security (TLS) using the STARTTLS command. Be careful
   * of using CURLUSESSL_TRY here, because if TLS upgrade fails, the transfer
   * will continue anyway - see the security discussion in the libcurl
   * tutorial for more details. */ 
  curl_easy_setopt(curl, CURLOPT_USE_SSL, (long)CURLUSESSL_TRY);
  
  /* If your server doesn't have a valid certificate, then you can disable
   * part of the Transport Layer Security protection by setting the
   * CURLOPT_SSL_VERIFYPEER and CURLOPT_SSL_VERIFYHOST options to 0 (false).
   *   curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
   *   curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
   * That is, in general, a bad idea. It is still better than sending your
   * authentication details in plain text though.
   * Instead, you should get the issuer certificate (or the host certificate
   * if the certificate is self-signed) and add it to the set of certificates
   * that are known to libcurl using CURLOPT_CAINFO and/or CURLOPT_CAPATH. See
   * docs/SSLCERTS for more information.
   */ 
  //curl_easy_setopt(curl, CURLOPT_CAINFO, "/path/to/certificate.pem");
  
  /* A common reason for requiring transport security is to protect
   * authentication details (user names and passwords) from being "snooped"
   * on the network. Here is how the user name and password are provided: */ 
  if(!_smtp_server_user.empty()) {
    curl_easy_setopt(curl, CURLOPT_USERNAME, _smtp_server_user.c_str());
    curl_easy_setopt(curl, CURLOPT_PASSWORD, _smtp_server_passwd.c_str());
  } else {
    //curl_easy_setopt(curl, CURLOPT_VERBOSE, "1");
    curl_easy_setopt(curl, CURLOPT_UPLOAD, 1L);
  } 
  
  /* Note that this option isn't strictly required, omitting it will result in
   * libcurl will sent the MAIL FROM command with no sender data. All
   * autoresponses should have an empty reverse-path, and should be directed
   * to the address in the reverse-path which triggered them. Otherwise, they
   * could cause an endless loop. See RFC 5321 Section 4.5.5 for more details.
   */ 
  /* value for envelope reverse-path */ 
  //static const char *from = "<zenbu@riken.jp>";
  //curl_easy_setopt(curl, CURLOPT_MAIL_FROM, from);
  curl_easy_setopt(curl, CURLOPT_MAIL_FROM, _smtp_from.c_str());
  
  /* Note that the CURLOPT_MAIL_RCPT takes a list, not a char array.  */ 
  recipients = curl_slist_append(recipients, email_to.c_str());
  curl_easy_setopt(curl, CURLOPT_MAIL_RCPT, recipients);
  
  /* You provide the payload (headers and the body of the message) as the
   * "data" element. There are two choices, either:
   * - provide a callback function and specify the function name using the
   * CURLOPT_READFUNCTION option; or
   * - just provide a FILE pointer that can be used to read the data from.
   * The easiest case is just to read from standard input, (which is available
   * as a FILE pointer) as shown here.
   */ 
  string tpath = "/tmp/emsg_" + MQDB::uuid_b64string();
  FILE *msgfp = fopen(tpath.c_str(), "w");
  fprintf(msgfp, "To: %s\n", email.c_str());
  fprintf(msgfp, "From: %s\n", _smtp_from.c_str());
  fprintf(msgfp, "Subject: %s\n", subject.c_str());
  fprintf(msgfp, "%s", message.c_str());
  fclose(msgfp);

  msgfp = fopen(tpath.c_str(), "r");
  curl_easy_setopt(curl, CURLOPT_READDATA, msgfp);
  
  /* send the message (including headers) */ 
  //fprintf(stderr, "curl_easy_perform\n");
  res = curl_easy_perform(curl);
  /* Check for errors */ 
  if(res != CURLE_OK)
    fprintf(stderr, "curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
  
  /* free the list of recipients */ 
  curl_slist_free_all(recipients);
  
  /* curl won't send the QUIT command until you call cleanup, so you should be
   * able to re-use this connection for additional messages (setting
   * CURLOPT_MAIL_FROM and CURLOPT_MAIL_RCPT as required, and calling
   * curl_easy_perform() again. It may not be a good idea to keep the
   * connection open for a very long time though (more than a few minutes may
   * result in the server timing out the connection), and you do want to clean
   * up in the end.
   */ 
  curl_easy_cleanup(curl);
}


