=head1 NAME - ZENBU

=head1 SYNOPSIS

=head1 DESCRIPTION
 
 base module for entire API/toolkit for easy include and versioning

=head1 CONTACT

Jessica Severin <severin@gsc.riken.jp>

=head1 LICENSE

 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * copyright (c) 2007-2009 Jessica Severin RIKEN OSC
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

=head1 APPENDIX

The rest of the documentation details each of the object methods. Internal methods are usually preceded with a _

=cut

$VERSION = 2.10;

package ZENBU;

use strict;
use EEDB::Assembly;
use EEDB::Chrom;
use EEDB::ChromChunk;
use EEDB::Collaboration;
use EEDB::Database;
use EEDB::Edge;
use EEDB::EdgeSet;
use EEDB::EdgeSource;
use EEDB::Experiment;
use EEDB::Expression;
use EEDB::ExpressionDatatype;
use EEDB::Feature;
use EEDB::FeatureSet;
use EEDB::FeatureSource;
use EEDB::Metadata;
use EEDB::MetadataSet;
use EEDB::ObjectCache;
use EEDB::Peer;
use EEDB::SPStream.pm;
use EEDB::Symbol.pm;
use EEDB::User.pm;
use EEDB::JobQueue::Job.pm;

#drwxrwxr-x  35 severin  staff   1190  6 26  2013 SPStream/
#drwxrwxr-x  16 severin  staff    544  6 28  2013 Tools/

1;

