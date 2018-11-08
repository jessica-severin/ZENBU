=head1 NAME - EEDB::SPStream::OSCFileDB

=head1 SYNOPSIS

=head1 DESCRIPTION

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

$VERSION = 0.953;

package EEDB::SPStream::OSCFileDB;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);
use Compress::Zlib;
use Digest::MD5;
use POSIX;
use POSIX qw(setsid);
use POSIX qw(:errno_h :fcntl_h);

use EEDB::Feature;
use EEDB::Edge;
use EEDB::Expression;
use EEDB::Tools::MultiLoader;
use EEDB::Tools::OSCFileParser;
use EEDB::SPStream::Feature2Expression;
use EEDB::SPStream::StreamBuffer;

use MQdb::Database;
use EEDB::SPStream::SourceStream;
our @ISA = qw(EEDB::SPStream::SourceStream MQdb::Database);

#################################################
# Class methods
#################################################

sub class { return "EEDB::SPStream::OSCFileDB"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  my %args = @_;
  $self->SUPER::init(@_);
  
  $self->{'_do_store'} = 1;
  $self->{'_platform'} = "SEQ";
  $self->{'_stream_next_active'} = 0;
  $self->{'debug'} = 0;
  $self->{'_expression_buffer'} = [];
  $self->{'_featuresource_filter_OK'} = 1;
  $self->{'_fsrc'} = undef;
  $self->{'_supportdb'} = undef;
  
  return $self;
}

=head2 create_db_for_file

  Description: convert an OSCFile into an OSCFileDB by sorting, indexing and
               building a support eeDB database.  creates a directory xxxx.oscdb
               which can be referenced with eeDB URL like
                  oscdb:///root/full/path/to/library123.oscdb
  Arg (1)    : $fullpath (string)  full path to the file to be read
  Returntype : <string> url for this new database

=cut

sub create_db_for_file {
  my $self = shift;
  my $file = shift;
  my %options = @_;  #like sources=>[$fsrc1, $fsrc2,$fsrc3]

  $self->{'_do_store'} = $options{'store'} if($options{'store'});
  $self->{'_platform'} = $options{'platform'} if($options{'platform'});
  $self->{'_deploy_dir'} = $options{'deploy_dir'} if($options{'deploy_dir'});
  $self->{'_build_dir'} = $options{'build_dir'} if($options{'build_dir'});
  $self->{'_input_filehandle'} = $options{'filehandle'} if($options{'filehandle'});
  $self->{'_metadata'} = $options{'metadata'} if($options{'metadata'});
  $self->{'_user'} = $options{'user'} if($options{'user'});

  unless($file =~ /^\//) {
    $file = getcwd ."/". $file;
  }
  $self->{'inputfile'} = $file;

  if($self->{'debug'}) { printf("create_db_for_file [%s]\n", $file); }
  
  $options{'eedbns'} = 1; #always turn on

  unless($self->_create_oscdb_dir) { return undef; }
  unless($self->_create_supportdb) { return undef; }

  my $oscfile = EEDB::Tools::OSCFileParser->new;
  $oscfile->{'debug'} = $self->{'debug'};
  $oscfile->init_from_file($file, %options);
  #$oscfile->calc_md5($file);
  $self->{'_oscfileparser'} = $oscfile;

  ########
  #store FeatureSource
  $self->{'_fsrc'} = $oscfile->feature_source;
  if($self->{'_user'}) { $self->{'_fsrc'}->owner_openid($self->{'_user'}->openID); }
  if($self->{'_do_store'}) { $self->{'_fsrc'}->store($self->supportdb); }
  else { $self->{'_fsrc'}->primary_id(-1); }
  print($self->{'_fsrc'}->display_contents) if($self->{'debug'}>1);
  $self->{'_fsrc'}->display_info if($self->{'debug'}==1);

  ########
  #now set the database of the oscparser for dynamic experiment and subfeature source creation
  $oscfile->database($self->supportdb);

  ########
  #split header out into separate file and add the feature_id column
  #depending on settings, may create experiments, add columns
  $self->_create_internal_header;

  ########
  # chrom subdivide, sort, recombine so there is a single file 
  # in the proper sort order so it can properly indexed by chrom and chrom_chunk 
  # expands columns if needed, merges into oscdata
  unless($self->_sort_input_file()) { return undef; }  

  ########
  # after completed rebuild the oscparser based on the internal oscheader
  $self->{'_oscfileparser'} = undef;
  $oscfile = $self->oscfileparser();
  $oscfile->database($self->supportdb);


  #########
  # store Experiments other experiments
  foreach my $exp (@{$oscfile->experiments}) {
    if($self->{'_user'}) { $exp->owner_openid($self->{'_user'}->openID); }
    if($self->{'_do_store'}) { $exp->store($self->supportdb); }
    else { $exp->primary_id(-1); }
    print($exp->display_contents) if($self->{'debug'}>1);
    $exp->display_info if($self->{'debug'}==1);
  }

  #store expression datatypes
  my $datatypes = $oscfile->expression_datatypes;
  foreach my $dtype (@$datatypes) {
    EEDB::Expression->_storeget_expression_datatype_id($self->supportdb, $dtype) if($self->{'_do_store'});
  }

  #########
  # now can build index and calculate totals for tpm
  unless($self->_index_scan_oscdb()) { return undef; }

  if($self->{'_deploy_dir'}) {  $self->_copy_self_to_deploy_dir(); }

  return "oscdb://" . $self->{'oscdb_dir'};
}


=head2 assembly_name

  Description  : simple getter/setter method for the Assembly of this Chrom
  Parameter[1] : string scalar. if specififed it will set the assembly name
  Returntype   : string scalar
  Exceptions   : none

=cut

sub assembly_name {
  my $self = shift;
  my $oscfile = $self->oscfileparser;
  return "" unless($oscfile);
  return $oscfile->assembly_name;
}


=head2 assembly

  Description  : returns Assembly of file as EEDB::Assembly object
  Returntype   : EEDB::Assembly

=cut

sub assembly {
  my $self = shift;
  unless($self->{'_assembly'}) {
    my $db = $self->supportdb;
    if($db and $self->assembly_name) {
      $self->{'_assembly'} = EEDB::Assembly->fetch_by_name($db, $self->assembly_name);
    }
  }
  return $self->{'_assembly'};
}

=head2 supportdb

  Description  : reference to the sqlite database used in parallel for 
                 support (chroms, chunks, sources, metadata)
  Returntype   : MQdb::Database

=cut

sub supportdb {
  my $self = shift;
  unless($self->{'_supportdb'}) {
    my $url = "sqlite://" . $self->{'oscdb_dir'} ."/oscdb.sqlite";
    printf("connect supportdb [%s]\n", $url) if($self->{'debug'});
    my $db = EEDB::Database->new_from_url($url);
    $self->{'_supportdb'} = $db;
    my $peer = EEDB::Peer->fetch_self($db);
    if($peer) { $db->uuid($peer->uuid); }
    
    if((my $p2=rindex($self->{'oscdb_dir'}, "/")) != -1) {
      my $alias = substr($self->{'oscdb_dir'}, $p2+1);
      $self->alias($alias);
    }
  }
  return $self->{'_supportdb'};
}  


################################################
#
# override of MQdb::Database superclass methods
#
################################################

sub new_from_url {
  my $class = shift;
  my $url = shift;
    
  my $self = $class->new;
  return $self->init_from_url($url, @_);
}


sub init_from_url {
  my $self = shift;
  my $url = shift;

  my %options;
  if(@_) { %options = @_; } #like password=>"mypass", debug=>2
  
  my $pass = undef;
  my $driver = 'oscdb';
  my $dbname = undef;
  my $path = '';
  my ($p, $p2, $p3);

  if($options{'password'}) { $pass = $options{'password'}; }
  if($options{'debug'}) { $self->{'debug'} = $options{'debug'}; }
  if($options{'class'}) { $self->sourcestream_output($options{'class'}); }

  #print("FETCH $url\n");

  $p = index($url, "://");
  return undef if($p == -1);
  $driver = substr($url, 0, $p);
  $url    = substr($url, $p+3, length($url));

  #print ("db_url=$url\n");
  $p = index($url, "/");
  return undef if($p == -1);

  my $conn   = substr($url, 0, $p);
  $dbname    = substr($url, $p+1, length($url));
  my $params = undef;
  if(($p2=index($dbname, ";")) != -1) {
    $params = substr($dbname, $p2+1, length($dbname));
    $dbname = substr($dbname, 0, $p2);
  }
  $dbname = "/". $dbname;
  
  $self->{'oscdb_dir'} = $dbname;
  unless(-d $self->{'oscdb_dir'}) { return undef; }
 
  $self->{'_uuid'}     = ''; 
  $self->{'_driver'}   = $driver;
  $self->{'_database'} = $dbname;

  my $db = $self->supportdb;
  unless($db) { return undef; }

  #initialize the peer and UUID
  $self->peer;

  #OSCFileDB is a "one source" database system
  $self->{'_fsrc'} = EEDB::FeatureSource->fetch_by_id($self->database, 1);
  
  $self->supportdb->disconnect;

  return $self;
}


sub oscfileparser {
  my $self = shift;

  if($self->{'_oscfileparser'}) { return $self->{'_oscfileparser'}; }
  unless($self->{'oscdb_dir'}) { return undef; }
  
  my $oscdb_file = $self->{'oscdb_dir'} . "/oscdb.oscdata";
  
  my $exps = EEDB::Experiment->fetch_all($self->database);
  foreach my $exp (@$exps) { $exp->metadataset; }
  
  my $oscfileparser = EEDB::Tools::OSCFileParser->new;
  $oscfileparser->{'debug'} = $self->{'debug'};
  $oscfileparser->feature_source($self->{'_fsrc'});  
  $oscfileparser->experiments(@$exps);  
  $oscfileparser->init_from_file($oscdb_file, 'eedbns'=>1);
  $self->{'_oscfileparser'} = $oscfileparser;
  
  my ($chrom_idx, $start_idx, $end_idx, $strand_idx) = $oscfileparser->get_genomic_column_indexes;
  $self->{"idx_chrom"}  = $chrom_idx;
  $self->{"idx_start"}  = $start_idx;
  $self->{"idx_end"}    = $end_idx;
  $self->{"idx_strand"} = $strand_idx;
  if($oscfileparser->coordinate_system eq "0base") { $self->{'_0base'}=1; } else { $self->{'_0base'}=0; }

  $self->database->disconnect;
  return $self->{'_oscfileparser'};
}


sub get_connection {
  #redirect all sql queries into the embedded sqlite database
  my $self = shift;
  my $db = $self->supportdb;

  unless($self->{'ridx_fd'}) {
    my $ridx_path = $self->{'oscdb_dir'} ."/oscdb.ridx";
    $self->{'ridx_fd'} = POSIX::open($ridx_path, &POSIX::O_RDONLY );
  } 
  unless($self->{'data_fd'}) {
    my $oscdb_file = $self->{'oscdb_dir'} . "/oscdb.oscdata";
    $self->{'data_fd'} = POSIX::open($oscdb_file, &POSIX::O_RDONLY );
  }
  if($db){ return $db->get_connection; }
  return undef;
}


sub test_connection {
  my $self = shift;

  unless($self) { return 0; }
  if($self->{'_tested_valid'}) {
    my $oscdb_file = $self->{'oscdb_dir'} . "/oscdb.oscdata";
    if(-e $oscdb_file) { return 1; }
    return 0;
  }

  $self->{'_tested_valid'} = 0;
  unless(-d $self->{'oscdb_dir'}) { return 0; }
  my $path = $self->{'oscdb_dir'} . "/oscdb.oscdata";
  my $fd = POSIX::open($path, &POSIX::O_RDONLY );
  if(!$fd) { return 0; }
  POSIX::close($fd);
  my $db = $self->supportdb;
  unless($db and $db->test_connection) { return 0; }
  $self->{'_tested_valid'} = 1;
  return $self->{'_tested_valid'};
}


=head2 execute_sql

  Description    : executes SQL statement with external parameters and placeholders
  Example        : $db->execute_sql("insert into table1(id, value) values(?,?)", $id, $value);
  Parameter[1]   : sql statement string
  Parameter[2..] : optional parameters for the SQL statement
  Returntype     : none
  Exceptions     : none

=cut

sub execute_sql {
  my $self = shift;
  my $sql = shift;
  my @params = @_;
  
  $sql =~ s/INSERT ignore/INSERT or ignore/g;
  my $dbc = $self->get_connection;  
  my $sth = $dbc->prepare($sql);
  eval { $sth->execute(@params); };
  if($@) {
    printf(STDERR "ERROR with query: %s\n", $sql);
    printf(STDERR "          params: ");
    foreach my $param (@params) { printf(STDERR "'%s'  ", $param); }
    print(STDERR "\n");
  }
  $sth->finish;
}


=head2 do_sql

  Description    : executes SQL statement with "do" and no external parameters
  Example        : $db->do_sql("insert into table1(id, value) values(null,'hello world');");
  Parameter      : sql statement string with no external parameters
  Returntype     : none
  Exceptions     : none

=cut

sub do_sql {
  my $self = shift;
  my $sql = shift;
  
  $sql =~ s/INSERT ignore/INSERT or ignore/g;
  if(uc($sql) =~ /^UNLOCK TABLES/) { $sql = "END TRANSACTION;"; }
  if(uc($sql) =~ /^LOCK TABLE/) { $sql = "BEGIN TRANSACTION;"; }
    
  my $dbc = $self->get_connection;  
  if(!($dbc->do($sql))) {
    printf(STDERR "WARNING with query: %s\n", $sql);
    #die;
  }
}

=head2 disconnect

  Description: disconnects handle from database, but retains object and 
               all information so that it can be reconnected again 
               at a later time.
  Returntype : none
  Exceptions : none

=cut

sub disconnect {
  my $self = shift;
  
  if($self->{'ridx_fd'}) {
    POSIX::close($self->{'ridx_fd'});
    $self->{'ridx_fd'} = undef;
  } 
  if($self->{'data_fd'}) {
    POSIX::close($self->{'data_fd'});
    $self->{'data_fd'} = undef;
  }
  if($self->{'_supportdb'}) {
    $self->{'_supportdb'}->disconnect();
  }
  $self->{'_disconnect_count'}++;
  $self->{'_stream_next_active'} = 0;
  return $self;
}


#####################################################################
#
# override of EEDB::SPStream::SourceStream superclass methods
#
#####################################################################


#
# can reuse these superclass methods
#
sub add_expression_datatype {
  my $self = shift;
  $self->SUPER::add_expression_datatype(@_);
  return $self->_setup_filters;
}
sub add_feature_source {
  my $self = shift;
  $self->SUPER::add_feature_source(@_);
  $self->{'_featuresource_filter_OK'} = 0;
  return $self->_setup_filters;
}
sub add_named_feature_source {
  my $self = shift;
  $self->SUPER::add_named_feature_source(@_);
  $self->{'_featuresource_filter_OK'} = 0;
  return $self->_setup_filters;
}
sub add_experiment {
  my $self = shift;
  #if some experiment is set, even if it is not present, then the filter
  #should be turned on
  unless($self->{'_experiment_array'}) { $self->{'_experiment_array'} = []; }
  $self->SUPER::add_experiment(@_);
  return $self->_setup_filters;
}
sub add_named_experiments {
  my $self = shift;
  #if some experiment is set, even if it is not present, then the filter
  #should be turned on
  unless($self->{'_experiment_array'}) { $self->{'_experiment_array'} = []; }
  $self->SUPER::add_named_experiments(@_);
  return $self->_setup_filters;
}
sub clear_all_filters {
  my $self = shift;
  $self->SUPER::clear_all_filters();
  $self->_setup_filters;
  return $self;
}

sub peer { 
  my $self = shift;
  if($self->{'_peer'}) { return $self->{'_peer'}; }
  if($self->supportdb) {
    $self->{'_peer'} = EEDB::Peer->fetch_self($self->supportdb);
    unless($self->{'_peer'}) {
      $self->{'_peer'} = EEDB::Peer->create_self_peer_for_db($self);
    }
    $self->{'_uuid'} = $self->{'_peer'}->uuid;
    $self->supportdb->uuid($self->{'_uuid'});
  }
  return $self->{'_peer'};
}

sub database { my $self=shift; return $self->supportdb; }
sub uuid { my $self= shift; return $self->peer->uuid; }

sub display_desc {
  my $self = shift;
  my $str = sprintf("EEDB::OSCFileDB [%s]", $self->full_url);
  return $str;
}

############################################################
#
#
#
############################################################

sub _fetch_feature_by_id {
  my $self = shift;
  my $id = shift;

  if($id =~ /(.+)::(\d+)/) {
    my $peerUUID = $1;
    $id = $2;
    if($peerUUID ne $self->uuid) { return undef; }
  }
  
  $self->get_connection; #reconnect if needed
  unless($self->{'ridx_fd'} and $self->{'data_fd'}) { return undef; }

  #printf("fetch object[%d] :: ", $id);
  my $off_t = POSIX::lseek( $self->{'ridx_fd'}, (($id-1)*12), &POSIX::SEEK_SET );  
  my $buf;
  my $bytes = POSIX::read($self->{'ridx_fd'}, $buf, 12);
  if($bytes != 12) { return undef; }
  my ($offset,$len) = unpack("QV", $buf);
  #printf("  offset[%d]   len[%d]\n", $offset, $len);
  
  POSIX::lseek( $self->{'data_fd'}, $offset, &POSIX::SEEK_SET );
  $bytes = POSIX::read($self->{'data_fd'}, $buf, $len);
  if($bytes != $len) { return undef; }

  my $idx = index($buf, "\n");
  my $line = substr($buf, 0, $idx);
  #print($line, "\n");

  my $oscfileparser = $self->oscfileparser;
  return undef unless($oscfileparser);

  my $feature = $oscfileparser->convert_dataline_to_feature($line);
  if(!defined($feature)) { return undef; }
  
  my $chrom = EEDB::Chrom->fetch_by_assembly_chrname($self->assembly, $feature->chrom_name);
  $feature->chrom($chrom) if($chrom);
  $feature->database($self);
  if($oscfileparser->{'_has_subfeatures'}) { $feature->_set_subfeature_chrom; }
  $self->{'_stream_next_active'} = 0;
  #$feature->display_info;
  return $feature;
}

=head2 fetch_object_by_id

  Description: fetch single object from database
  Arg (1)    : $id (federatedID <uuid>::id:::<class>)
  Returntype : EEDB::Feature
  Exceptions : none 

=cut

sub fetch_object_by_id {
  my $self = shift;
  my $id = shift;

  my $objClass="Feature";
  my $peerUUID="";
  my $objID=$id;
  
  if($id =~ /(.+)::(\d+):::(.+)/) {
    $peerUUID = $1;
    $objID = $2;
    $objClass = $3;
  }
  elsif($id =~ /(.+)::(\d+)/) {
    $peerUUID = $1;
    $objID = $2;
  }
  if($peerUUID and $self->uuid and ($peerUUID ne $self->uuid)) { return undef; }

  if($objClass eq "Feature") { return $self->_fetch_feature_by_id($objID); }
  if($objClass eq "Experiment") { return EEDB::Experiment->fetch_by_id($self->supportdb, $objID); }
  if($objClass eq "FeatureSource") { return EEDB::FeatureSource->fetch_by_id($self->supportdb, $objID); }

  return undef;
}


=head2 stream_by_named_region

  Description: setup streaming of all expression (with feature) from a specific region on a genome
               with a given set of source, experiment and datatype filters
  Arg (1)    : $assembly_name (string)
  Arg (2)    : $chrom_name (string)
  Arg (3)    : $chrom_start (integer)
  Arg (4)    : $chrom_end (integer)
  Returntype : $self
  Exceptions : none 

=cut

sub stream_by_named_region {
  my $self = shift;
  my $assembly_name = shift;
  my $chrom_name = shift;
  my $chrom_start = shift;
  my $chrom_end = shift;

  $self->oscfileparser; #make sure it is initialized before reset
  $self->_reset_stream; #reset and reconnect
  my $db = $self->supportdb;
  
  if($self->{'debug'}>1) {
    if($chrom_start) {
      printf("fetch_all_named_region %s::%s:%d..%d\n", $assembly_name, $chrom_name, $chrom_start, $chrom_end);
    } else {
      printf("fetch_all_named_region %s::%s\n", $assembly_name, $chrom_name);
    }
  }

  my $asm = EEDB::Assembly->fetch_by_name($db, $assembly_name);
  if(!defined($asm)) { return undef; }
  my $chrom = EEDB::Chrom->fetch_by_assembly_chrname($asm, $chrom_name);
  if(!defined($chrom)) { return undef; }
  $self->{'_stream_chrom'} = $chrom;
  if($self->{'debug'}>1) { $chrom->display_info; }

  if(defined($chrom_start) and defined($chrom_end)) {  
    if(defined($chrom_start)) { $self->{'_stream_start'} = $chrom_start; }
    if(defined($chrom_end))   { $self->{'_stream_end'}   = $chrom_end; }

    my $chunks = EEDB::ChromChunk->fetch_all_by_chrom_range($chrom, $chrom_start, $chrom_end);
    if($chunks and scalar(@$chunks)) {
      #foreach my $chunk (@$chunks) { $chunk->display_info; }
      my $start_chunk = $chunks->[0];
      #printf("START:: %s\n", $start_chunk->display_desc);
      my ($chunk_feature) = @{EEDB::Feature->fetch_all_by_primary_name($db, "chunk".($start_chunk->id), $self->{'_fsrc'})};
      if($chunk_feature) { 
        #$chunk_feature->display_info; 
        my $offset_fid_mdata = $chunk_feature->metadataset->find_metadata("oscdb_fid", undef);
        if($offset_fid_mdata) {
          #printf("offset_fid = %s\n", $offset_fid_mdata->data);
          $self->_seek_to_datarow($offset_fid_mdata->data);
        }
      }
    }
  } else {
    #do a chromosome scan
    #printf("do chromosome scan chromID %d \n", $chrom->id);
    my ($chrom_feature) = @{EEDB::Feature->fetch_all_by_primary_name($db, "chrom".($chrom->id), $self->{'_fsrc'})};
    if($chrom_feature) { 
      #$chrom_feature->display_info; 
      my $offset_fid_mdata = $chrom_feature->metadataset->find_metadata("oscdb_fid", undef);
      if($offset_fid_mdata) {
        #printf("offset_fid = %s\n", $offset_fid_mdata->data);
        $self->_seek_to_datarow($offset_fid_mdata->data);
      }
    }
  }
  $self->{'_stream_next_active'} = 1;
  return $self;
}


=head2 stream_by_chrom

  Description: stream all expression (with feature) on a specific EEDB::Chrom
               with a given set of source, experiment and datatype filters
  Arg (1)    : $chrom (EEDB::Chrom object with database)
  Arg (2...) : hash named filter parameters. 
                 datatypes=>["tpm","raw"], 
                 sources=>[$fsrc1, $fsrc2,$fsrc3],  instances of EEDB::FeatureSource
                 experiments=>[$exp1, $exp2]  instances of EEDB::Experiment
  Returntype : $self
  Exceptions : none 

=cut

sub stream_by_chrom {
  my $self = shift;
  my $chrom = shift;  #Chrom object with database

  return $self->stream_by_named_region($chrom->assembly->ucsc_name, $chrom->chrom_name, undef, undef);
}


=head2 stream_all

  Description: stream all features (with metadata and expression) out of database 
               with a given set of source, experiment and datatype filters
  Returntype : $self
  Exceptions : none 

=cut

sub stream_all {
  my $self = shift;

  $self->oscfileparser; #make sure it is initialized before reset
  $self->_reset_stream;
  unless($self->{'ridx_fd'} and $self->{'data_fd'}) { return undef; }
  POSIX::lseek( $self->{'ridx_fd'}, 0, &POSIX::SEEK_SET ); 
  POSIX::lseek( $self->{'data_fd'}, 0, &POSIX::SEEK_SET );
  $self->{'_stream_next_active'}=1;
  return $self
}

=head2 stream_features_by_metadata_search

  Description: currently this method is not support by OSCFileDB.
  Returntype : undef
  Exceptions : none 

=cut

sub stream_features_by_metadata_search() {
  return undef;
}


=head2 next_in_stream

  Description: will fetch next object in stream which was setup by 
               one of the stream_by_xxxx methods
  Returntype : instance of either EEDB::Feature or EEDB::Expression depending on mode
  Exceptions : none

=cut

sub next_in_stream {
  my $self = shift;
  
  #redirect mode into the sqlite database as SourceStream 
  if($self->{'_source_stream'}) {
    my $obj = $self->{'_source_stream'}->next_in_stream;
    if($obj) { return $obj; }
    else { 
      $self->{'_source_stream'}=undef; 
      $self->{'_stream_next_active'}=0;
      $self->disconnect;
      return undef;
    }
  }

  #file index mode
  unless($self->{'ridx_fd'} and $self->{'data_fd'}) { return undef; }
  unless($self->{'_featuresource_filter_OK'}) { return undef; }

  my $obj = undef;

  if($self->{'_stream_next_active'}) {
    if(($self->sourcestream_output eq "feature") or 
       ($self->sourcestream_output eq "simple_feature") or
       ($self->sourcestream_output eq "subfeature")) { 
      $obj = $self->_next_feature_in_stream; 
    }
    if($self->sourcestream_output eq "express") {
      while(scalar(@{$self->{'_expression_buffer'}}) == 0) {
        unless($self->{'_stream_next_active'}) { last; }
        my $feature = $self->_next_feature_in_stream;
        if(!defined($feature)) { last; }

        my $exp_array = $feature->get_expression_array;
        foreach my $expr (@$exp_array) {
          push @{$self->{'_expression_buffer'}}, $expr;
          #invert relation so the expression needs to have the feature now
          $expr->feature($feature); 
        }
        $feature->empty_expression_cache; #to prevent memory leak
      }
      $obj = shift @{$self->{'_expression_buffer'}};
    }  
  }
  return $obj if($obj);
  
  while(!defined($obj) and @{$self->{'_assembly_stream_chroms'}}) {
    my $chrom = shift @{$self->{'_assembly_stream_chroms'}};
    printf("reset chrom:: %s\n", $chrom->display_desc) if($self->{'debug'});
    $self->stream_by_chrom($chrom);
    $obj = $self->next_in_stream;
  }
  
  if(!defined($obj)) { $self->disconnect; }
  return $obj;
}


sub _next_feature_in_stream {
  my $self = shift;

  my $oscfileparser = $self->oscfileparser;
  return undef unless($oscfileparser);

  while(1) {
    unless($self->{'_stream_next_active'}) { return undef; }
  
    my $buf;
    my $bytes = POSIX::read($self->{'ridx_fd'}, $buf, 12);
    if($bytes != 12) { return undef; }
    my ($offset,$len) = unpack("QV", $buf);
    #printf("  offset[%d]   len[%d]\n", $offset, $len);
    
    $bytes = POSIX::read($self->{'data_fd'}, $buf, $len);
    if($bytes != $len) { return undef; }
    my $idx = index($buf, "\n");
    my $line = substr($buf, 0, $idx);
    #print($line, "\n");
    
    if($self->_region_filter_line($line)) {
      my $feature = $oscfileparser->convert_dataline_to_feature($line);
      if($self->{'_stream_chrom'}) { 
        $feature->chrom($self->{'_stream_chrom'}); 
      } else {
        my $chrom = EEDB::Chrom->fetch_by_assembly_chrname($self->assembly, $feature->chrom_name);
        $feature->chrom($chrom) if($chrom);
      }
      $feature->database($self);
      $feature->_set_subfeature_chrom; #this is safe to call any time since the Feature will not lazy load
      return $feature;
    }
  }
  return undef;
}


sub _seek_to_datarow {
  my $self = shift;
  my $rid = shift;
  
  unless($self->{'ridx_fd'} and $self->{'data_fd'}) { return undef; }

  #printf("fetch object[%d] :: ", $fid);
  my $buf;
  my $off_t = POSIX::lseek( $self->{'ridx_fd'}, (($rid-1)*12), &POSIX::SEEK_SET );  
  my $bytes = POSIX::read($self->{'ridx_fd'}, $buf, 12);
  if($bytes != 12) { return undef; }
  my ($offset,$len) = unpack("QV", $buf);
  #printf("  offset[%d]   len[%d]\n", $offset, $len);
  
  POSIX::lseek( $self->{'data_fd'}, $offset, &POSIX::SEEK_SET );

  #then reset the ridx
  POSIX::lseek( $self->{'ridx_fd'}, (($rid-1)*12), &POSIX::SEEK_SET );
  $self->{'_stream_next_active'} = 0;
  return 1;
}


######################################################################
#
#  internal methods for building .oscdb structure
#  section for sorting the OSCdb file and building the indexes
#
######################################################################

sub _create_oscdb_dir {
  my $self = shift;

  my $file = $self->{'inputfile'};
  unless($file) { return undef; }
  
  my $ridx = rindex($file, "/");
  if($ridx) { 
    $self->{'_input_dir'} = substr($file, 0, $ridx);
    $file = substr($file, $ridx+1);
  }
  if($file =~ /(.+)\.gz$/) { $file = $1; }
  if($file =~ /(.+)\.(\w+)$/) { $file = $1; }
  my $fsrc_name = $file;
  
  unless($self->{'_build_dir'} and (-d $self->{'_build_dir'})) {    
    my $file = $self->{'inputfile'};
    my $ridx = rindex($file, "/");
    if($ridx) { 
      $self->{'_build_dir'} = substr($file, 0, $ridx);
    } else { return undef; }
  }

  $self->{'oscdb_dir'} = $self->{'_build_dir'} . "/". $fsrc_name . ".oscdb";
  mkdir($self->{'oscdb_dir'});
  unless(-d $self->{'oscdb_dir'}) { return undef; }
  
  return $self;
}


sub _create_supportdb {
  my $self = shift;
  
  if($self->{'debug'}) { printf("=== create_supportdb\n"); }
  my $dbpath = $self->{'oscdb_dir'} ."/". "oscdb.sqlite";
  my $template = $ENV{'EEDB_ROOT'} . "/sql/eedb_template.sqlite";

  unless(-e $template) {
    printf(STDERR "ERROR: EEDB_ROOT [%s] not setup, missing file [%s]\n", $ENV{'EEDB_ROOT'}, $template);
    die;
  }
  my $cmd = "cp " . $template ." ". $dbpath;
  if($self->{'debug'}) { printf("%s\n", $cmd); }
  system($cmd);
  chmod 0666, $dbpath;

  my $eeDB = $self->supportdb;
  
  return $self;
}


sub _create_internal_header {
  my $self = shift;

  my $oscfileparser = $self->oscfileparser;
  return undef unless($oscfileparser);
  my $header_data = $oscfileparser->header_data;
  
  open(HEADERFILE, ">". $self->{'oscdb_dir'} . "/oscdb.oscheader");

  my $linecount=0;
  my @header_lines = split(/\n/, $header_data);
  foreach my $line (@header_lines) {
    if($line =~ /^\#/) {
      print HEADERFILE $line, "\n";
      next;
    }
    next if($line eq "");

    print HEADERFILE "##ColumnVariable[eedb:feature_id] = unique ID for each feature/row in file\n";

    my @columns = ();
    push @columns, "eedb:feature_id";

    # build new column line
    if($oscfileparser->{'_input_file_ext'} and ($oscfileparser->{'_input_file_ext'} eq "sam")) {
      push @columns,  ("eedb:end", "eedb:strand");
    }

    if($oscfileparser->{'_one_line_one_expression_count'}) {
      my $colname = "exp.tagcount.";
      if($oscfileparser->{'_exp_prefix'}) { $colname .= $oscfileparser->{'_exp_prefix'}; }
      else { $colname .= "experiment"; } 
      my $colobj = $oscfileparser->_create_colobj_by_name($colname);
      $colobj->{'colnum'} = scalar(@columns);
      $oscfileparser->_prepare_experiment_colobj($colobj);
      if($oscfileparser->{'_description'}) { 
        $colobj->{'description'} = $oscfileparser->{'_description'};
      } else {
        $colobj->{'description'} = "single sequence tags, no redundancy compression, tagcount=1 for every tag";
      }
      printf HEADERFILE "##ColumnVariable[%s] = %s\n", $colname, $colobj->{'description'};
      push @columns, $colname;
      $self->{'_one_line_one_expression_count'} = $oscfileparser->{'_one_line_one_expression_count'};
    }
    if($oscfileparser->{'_default_mapcount'}) {
      my $colname = "exp.mapcount.";
      if($oscfileparser->{'_exp_prefix'}) { $colname .= $oscfileparser->{'_exp_prefix'}; }
      else { $colname .= "experiment"; } 
      my $colobj = $oscfileparser->_create_colobj_by_name($colname);
      $colobj->{'colnum'} = scalar(@columns);
      $oscfileparser->_prepare_experiment_colobj($colobj);
      $colobj->{'description'} = "multi-map count";
      printf HEADERFILE "##ColumnVariable[%s] = %s\n", $colname, $colobj->{'description'};
      push @columns, $colname;
      $self->{'_default_mapcount'} = $oscfileparser->{'_default_mapcount'};
    }

    print HEADERFILE join("\t", @columns);
    print HEADERFILE "\t";
    print HEADERFILE $line."\n";
  }
  close(HEADERFILE);
  return $self;
}


sub _sort_input_file {
  my $self = shift;

  my $eeDB = $self->supportdb;
  my $oscfileparser = $self->oscfileparser;
  $oscfileparser->{'_outputmode'} = 'simple_feature';

  #first I need to split the file on chromosome since the unix sort does not allow
  #mixing of alpha and numerical sorting on different columns
  
  my $workdir = $self->{'oscdb_dir'} . "/workdir/";
  if($self->{'debug'}) { printf("=== sort_osc_file workdir [%s]\n", $workdir); }
  mkdir($workdir);
    
  my $starttime = time();
  my $linecount=0;
  my $line;
  my $chrom_files = {};
  my $chrom_maxend = {};
  my $add_singletagcount = $self->{'_one_line_one_expression_count'};
  my $add_mapcount       = $self->{'_default_mapcount'};

  my ($chrom_idx, $start_idx, $end_idx, $strand_idx) = $oscfileparser->get_genomic_column_indexes;
  unless(defined($chrom_idx) and defined($start_idx)) { 
    print(STDERR "ERROR:: OSCFileDB creation, genomic-coordinates column are not defined\n");
    return undef;
  }

  my $file_ext="";
  my $bed_type = "";
  if($oscfileparser->input_file_ext() eq "bed") { 
    $file_ext="bed"; 
    $bed_type = $oscfileparser->{'_bed_format'};
    if($bed_type eq "BED_unknown") { 
      print(STDERR "ERROR:: OSCFileDB creation, unknown BED number of columns\n");
      return undef; 
    }
  }
  if($oscfileparser->input_file_ext() eq "sam") { 
    $file_ext="sam"; 
    $end_idx = 0;
    $strand_idx = 1;
    $chrom_idx += 2;
    $start_idx += 2; 
    if($add_singletagcount) { $chrom_idx++; $start_idx++; }
    if($add_mapcount) { $chrom_idx++; $start_idx++; }
  } else {
    if($add_singletagcount) { $chrom_idx++; $start_idx++; $end_idx++; }
    if($add_mapcount) { $chrom_idx++; $start_idx++; $end_idx++; }
  }

  #if at least one comment line is provided, 
  #then it is expected to also have a column header line
  my $has_internal_header = 0;
  
  my $gz;
  if($self->{'_input_filehandle'}) {
    $gz = gzopen($self->{'_input_filehandle'}, "rb") ;
  } else {
    $gz = gzopen($self->{'inputfile'}, "rb") ;
  }
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    next if($line eq "");
    next if($line =~ /^\@/);

    # since this is the first time reading from the external file
    # there is a chance the file has extra control characters which can mess up the parsing
    #   removee potentially present windows \r (\M) characters
    $line =~ s/\cM//g;
    $line =~ s/\r//g;

    if($line =~ /^\#/) {
      $has_internal_header = 1;
      next;
    }
    $linecount++;

    if(($file_ext eq "bed") and ($line =~ /^track/) and ($linecount == 1)) { next; } 
    if($has_internal_header and ($linecount == 1)) { next; }

    my @columns = ();
    if($file_ext eq "bed") {
      @columns = split(/\s/, $line);
      if(($bed_type eq "BED3") and (scalar(@columns) != 3)) { next; }
      if(($bed_type eq "BED6") and (scalar(@columns) != 6)) { next; }
      if(($bed_type eq "BED12") and (scalar(@columns) != 12)) { next; }
    } else {
      @columns = split(/\t/, $line);
    }

    #preprend in reverse order
    if($add_mapcount)       { unshift @columns, $add_mapcount; }
    if($add_singletagcount) { unshift @columns, 1; }

    if($file_ext eq "sam") {
      my $feature = $oscfileparser->convert_dataline_to_feature($line);
      unshift @columns, $feature->chrom_end, $feature->strand;
    }

    my $chrname = $columns[$chrom_idx];
    if(($file_ext eq "sam") and ($chrname eq "*")) { $chrname = "unmapped"; } 

    my $chrend = $columns[$start_idx];
    if(defined($end_idx)) { $chrend  = $columns[$end_idx]; }
    if(!($chrom_maxend->{$chrname})) { $chrom_maxend->{$chrname} = $chrend; }
    if($chrom_maxend->{$chrname} < $chrend) { $chrom_maxend->{$chrname} = $chrend; }
        
    my $chrfd = $chrom_files->{$chrname};
    if(!defined($chrfd)) {
      $chrfd = POSIX::open($workdir.$chrname, O_CREAT | O_WRONLY, 0644);
      $chrom_files->{$chrname} = $chrfd;
      my $chrom = EEDB::Chrom->fetch_by_name($eeDB, $self->assembly_name, $chrname);
      unless($chrom) {
        $chrom = new EEDB::Chrom;
        $chrom->chrom_name($chrname);
        $chrom->assembly($self->assembly);
        $chrom->chrom_type('chromosome');
        $chrom->store($eeDB);
        if($self->{'debug'}) { printf("need to create chromosome :: %s\n", $chrom->display_desc); }
      }
    }
    
    #replace $line with standardized output version  
    $line = join("\t", @columns) . "\n";
    my $bytes = length($line);
    $bytes = POSIX::write($chrfd, $line, $bytes);
 
    if(($self->{'debug'}) and ($linecount % 50000 == 0)) { 
      my $rate = $linecount / (time() - $starttime);
      printf("divide_chr %10d (%1.2f x/sec)\n", $linecount, $rate); 
    }
  }
  $gz->gzclose;
  foreach my $chrfd (values(%{$chrom_files})) { POSIX::close($chrfd); }
  
  my $oscdb_file = $self->{'oscdb_dir'} . "/oscdb.oscdata";
  unlink($oscdb_file);
  
  my $oscdb_fd = POSIX::open($oscdb_file, O_CREAT | O_WRONLY, 0644);
  my $feature_id = 1;

  my $sort_cmd = sprintf("sort -n -k%d ", $start_idx+1);
  $sort_cmd .= sprintf("-k%d ", $end_idx+1) if(defined($end_idx));
  $sort_cmd .= sprintf("-k%d ", $strand_idx+1) if(defined($strand_idx));
  
  if($self->{'debug'}) {
    printf("\ngenomic sort chrom[%d] start[%d]\n", $chrom_idx, $start_idx);
    printf(" end[%d]", $end_idx) if(defined($end_idx));
    printf(" strand[%d]", $strand_idx) if(defined($strand_idx));
    print("\n");
  }

  $starttime = time();  #reset timer
  my $chroms = EEDB::Chrom->fetch_all_by_assembly_name($eeDB, $self->assembly_name);
  foreach my $chrom (@$chroms) {
    my $chrfile = $workdir. $chrom->chrom_name;
    if($self->{'debug'}) { printf("sort_chrom [%s]\n", $chrom->chrom_name); }
    unless(-e $chrfile) { next; }

    # since the column order is not fixed I need to calculate these numbers
    # sort order should be [start,end,strand] and sort command is 1based
    #my $cmd = "sort -k4 -k5 -k3 -n " . $chrfile ." > ". $chrfile. ".sort";
    my $cmd = $sort_cmd;
    $cmd .= $chrfile." > ".$chrfile.".sort";
    #printf("  %s\n", $cmd);
    system($cmd);
    
    #concat into main file
    my $gz = gzopen($chrfile.".sort", "rb") ;
    if($gz) {
      while(my $bytesread = $gz->gzreadline($line)) {
        #add an internal feature_id to the object-line
        $line = sprintf("%d\t", $feature_id++) . $line;
        my $bytes = length($line);
        $bytes = POSIX::write($oscdb_fd, $line, $bytes);

        if(($self->{'debug'}) and ($feature_id % 50000 == 0)) { 
          my $rate = $feature_id / (time() - $starttime);
          printf("  merge %10d (%1.2f x/sec)\n", $feature_id, $rate); 
        }
      }
      $gz->gzclose;
    }
    
    unlink($chrfile);
    unlink($chrfile .".sort");
    
    if($chrom->chrom_length < $chrom_maxend->{$chrom->chrom_name}) { 
      $chrom->chrom_length($chrom_maxend->{$chrom->chrom_name});
      $chrom->update;
      $chrom->create_chunks();
    }
  }

  if($self->{'debug'}) {
    my $total_time = time() - $starttime;
    my $rate = $feature_id / (time() - $starttime);
    printf("  merge %10d (%1.2f x/sec) :: %1.3f min FINISH\n", $feature_id, $rate, $total_time/60.0); 
  }

  rmdir($workdir);
  POSIX::close($oscdb_fd);
  
  $self->{'oscdb_file'} = $oscdb_file;
  return $self;
}


sub _index_scan_oscdb {  
  my $self = shift;

  # simple routine loops through the file calculating the total tag counts
  # to be used in TPM calculations
  # also builds the indexes for the chrom_chunks into the oscdb file

  my $eeDB = $self->supportdb;
  my $file = $self->{'oscdb_file'};
  return undef unless($file);

  #osc fileparser has been rebuilt on the internal header
  # so all columns are now on the proper indexes
  my $oscfileparser = $self->oscfileparser;

  my $multiLoad = new EEDB::Tools::MultiLoader;
  $multiLoad->database($eeDB);
  $multiLoad->do_store($self->{"_do_store"});

  my $ridx_path = $self->{'oscdb_dir'} ."/oscdb.ridx";
  my $ridx_fd = POSIX::open($ridx_path, O_CREAT | O_WRONLY, 0644);
  
  my ($chrom_idx, $start_idx, $end_idx, $strand_idx) = $oscfileparser->get_genomic_column_indexes;
  my $mapcnt_idx = $oscfileparser->get_mapcount_index;

  my @expresscols;
  foreach my $colobj (@{$oscfileparser->column_records}) {
    next unless($colobj->{'namespace'} eq 'expression');
    push @expresscols, $colobj;
  }

  $oscfileparser->{'debug'} = undef;

  if($self->{'debug'}) { printf("============== index_scan_oscdb ==============\n"); }
  my $starttime = time();
  my $linecount=0;
  my $line;
  my $last_chrname = "";
  my $last_line = undef;
  my @chunks;
  my $current_chunk = undef;
  my $gz = gzopen($file, "rb");
  my $offset = $gz->gztell();
  while(my $bytesread = $gz->gzreadline($line)) {
    chomp($line);
    $linecount++;
    $line =~ s/\r//g;
        
    my @columns  = split(/\t/, $line);

    my $feature_id = $columns[0];  #always the first column
    my $chrname    = $columns[$chrom_idx];
    my $start      = $columns[$start_idx];
    my $end        = $columns[$end_idx];

    if(defined($oscfileparser->{'idx_fsrc_category'})) {
      my $category = $columns[$oscfileparser->{'idx_fsrc_category'}];
      $oscfileparser->_get_category_featuresource($category);
    }

    #OSC format is 0 reference and eeDB is 1 referenced I need to +1 to start
    #OSC is not-inclusive, but eeDB is inclusive so I do NOT need to +1 to the end
    $start += 1;
    
    if($chrname ne $last_chrname) {
      $last_chrname = $chrname;

      @chunks = @{EEDB::ChromChunk->fetch_all_named_region($eeDB, $self->assembly_name, $chrname, undef, undef)};
      if($self->{'debug'}) { printf("==change chroms %s [%d chunks]\n",$chrname, scalar(@chunks)); }

      my $chrom = EEDB::Chrom->fetch_by_name($eeDB, $self->assembly_name, $chrname);
      my $feature = $self->_register_chrom_offset($chrom, $offset, $feature_id);
      if($feature) { $multiLoad->store_feature($feature); }

      $current_chunk = shift @chunks;
      $feature = $self->_register_chunk_offset($current_chunk, $offset, $feature_id);
      if($feature) { $multiLoad->store_feature($feature); }

      #printf("%s\n%s\n", $last_line, $line);
    }

    while($current_chunk and ($start > $current_chunk->chrom_end)) {
      if($self->{'debug'}>1) {
        my ($last_fid, @last_cols)  = split(/\t/, $last_line);
        my $last_chr   = $last_cols[$chrom_idx];
        my $last_start = $last_cols[$start_idx];
        my $last_end   = $last_cols[$end_idx];
        printf("\nchunk-skip: fid[%s] %s:%d..%d => fid[%s] %s:%d..%d\n", 
               $last_fid, $last_chr, $last_start, $last_end,
               $feature_id, $chrname, $start, $end, );
      }
      $current_chunk = shift @chunks;
      if($current_chunk) {
        #$current_chunk->display_info;
        my $feature = $self->_register_chunk_offset($current_chunk, $offset, $feature_id);
        if($feature) { 
          $multiLoad->store_feature($feature); 
          $feature->display_info if($self->{'debug'}>1);
        }
      }
    }
    
    my $next_chunk = $chunks[0];    
    if($next_chunk and ($start >= $next_chunk->chrom_start)) {
      if($self->{'debug'}>1) {
        my ($last_fid, @last_cols)  = split(/\t/, $last_line);
        my $last_chr   = $last_cols[$chrom_idx];
        my $last_start = $last_cols[$start_idx];
        my $last_end   = $last_cols[$end_idx];

        printf("\nchunk-change: fid[%s] %s:%d..%d => fid[%s] %s:%d..%d\n", 
               $last_fid, $last_chr, $last_start, $last_end,
               $feature_id, $chrname, $start, $end, );
      }
      $current_chunk = shift @chunks;
      my $feature = $self->_register_chunk_offset($current_chunk, $offset, $feature_id);
      if($feature) { 
        $multiLoad->store_feature($feature); 
        $feature->display_info if($self->{'debug'}>1);
      }
    }

    # build the ridx  (little-endian unsigned 32bit int)
    POSIX::write($ridx_fd, pack("QV", $offset, $bytesread), 12);

    #
    # calculate the total expression for each expression column
    # in order to get a total tag count to do proper TPM calculations
    #
    my $mapcount = $columns[$mapcnt_idx] if($mapcnt_idx);
    foreach my $colobj (@expresscols) {
      my $value = $columns[$colobj->{'colnum'}]; 
      $colobj->{'total'} += $value;
      if(defined($mapcount) and ($mapcount > 0)) {
        $colobj->{'mapnorm_total'} += $value / $mapcount;
        if($mapcount == 1) { $colobj->{'singlemap_total'} += $value; }
      }
    }
   
    if(($self->{'debug'})  and ($linecount % 10000 == 0)) { 
      my $rate = $linecount / (time() - $starttime);
      printf("index_scan %10d (%1.2f x/sec)\n", $linecount, $rate); 
    }
    $last_line = $line;
    $offset = $gz->gztell();        
  }
  $gz->gzclose;
  $multiLoad->flush_buffers;
  POSIX::close($ridx_fd);

  foreach my $colobj (@expresscols) {
    my $experiment = $colobj->{'experiment'};
    my $datatype = $colobj->{'datatype'};
    next unless($experiment);
        
    $experiment->metadataset->add_tag_data($datatype . "_total", $colobj->{'total'});
    if($mapcnt_idx) {
      $experiment->metadataset->add_tag_data($datatype . "_mapnorm_total", $colobj->{'mapnorm_total'});    
      $experiment->metadataset->add_tag_data($datatype . "_singlemap_total", $colobj->{"singlemap_total"});
      $experiment->metadataset->add_tag_symbol("eedb:expression_datatype", "singlemap_tagcnt");
      $experiment->metadataset->add_tag_symbol("eedb:expression_datatype", "singlemap_tpm");
      $experiment->metadataset->add_tag_symbol("eedb:expression_datatype", "mapnorm_tagcnt");
      $experiment->metadataset->add_tag_symbol("eedb:expression_datatype", "mapnorm_tpm");
    }
    $experiment->store_metadata if($self->{'_do_store'});

    if($self->{'debug'}) { 
      $experiment->display_info;
      printf("    %1.2f total\n", $colobj->{'total'});
      if($mapcnt_idx) {
        printf("    %1.2f total mapnorm expression\n", $colobj->{"mapnorm_total"});
        printf("    %1.2f total singlemap expression\n", $colobj->{"singlemap_total"});
        if($colobj->{'mapnorm_total'} > 0) {
          printf("  %1.3f%% singlemap\n", 100* $colobj->{"singlemap_total"}/ $colobj->{'mapnorm_total'});
        } else {
          printf("  100%% singlemap\n");
        }
      }
    }
  }

  #update the total feature count in FeatureSource
  $self->{'_fsrc'}->feature_count($linecount);
  $self->{'_fsrc'}->update_feature_count;

  if($self->{'debug'}) {
    my $total_time = time() - $starttime;
    my $rate = $linecount / $total_time;
    printf("index_scan %10d (%1.2f x/sec) :: %1.3f min FINISH\n", $linecount, $rate, $total_time/60.0);
  }
  return $self;
}     

sub _register_chrom_offset {
  my $self = shift;
  my $chrom = shift;
  my $offset = shift;
  my $feature_id = shift;
  
  return undef unless($chrom);
  
  my $eeDB = $self->supportdb;

  my $feature = new EEDB::Feature;
  $feature->feature_source($self->{'_fsrc'});
  $feature->primary_name("chrom".($chrom->id));
  $feature->chrom($chrom);
  $feature->chrom_start(0);
  $feature->chrom_end(0);
  $feature->metadataset->add_tag_data("oscdb_offset", $offset);
  $feature->metadataset->add_tag_data("oscdb_fid", $feature_id);
  $feature->significance($offset);
  return $feature;
}

sub _register_chunk_offset {
  my $self = shift;
  my $chunk = shift;
  my $offset = shift;
  my $feature_id = shift;
  
  return undef unless($chunk);
  
  my $eeDB = $self->supportdb;

  my $feature = new EEDB::Feature;
  $feature->feature_source($self->{'_fsrc'});
  $feature->primary_name("chunk".($chunk->id));
  $feature->chrom($chunk->chrom);
  $feature->chrom_start($chunk->chrom_start);
  $feature->chrom_end($chunk->chrom_end);
  $feature->metadataset->add_tag_data("oscdb_offset", $offset);
  $feature->metadataset->add_tag_data("oscdb_fid", $feature_id);
  $feature->significance($offset);
  return $feature;
}


sub _calc_md5 {
  my $self = shift;

  if(!defined($self->{'_fsrc'})) { return undef; }

  my $file = $self->{'oscdb_dir'} . "/oscdb.oscdata";
  $self->{'data_fd'} = POSIX::open($file, &POSIX::O_RDONLY );

  unless(open(FILE, $file)) { return undef; }
  
  my $ctx = Digest::MD5->new;
  $ctx->addfile(*FILE);
  my $digest = $ctx->hexdigest;
  my $mdata = EEDB::Metadata->new("md5sum", $digest);
  close(FILE);
  $self->{'_fsrc'}->metadataset->add_metadata($mdata);
  return $mdata;
}


sub _copy_self_to_deploy_dir {
  my $self = shift;

  unless($self->{'_deploy_dir'}) { return undef;}

  #
  # first disconnect all existing connections to working version
  #
  $self->disconnect;
  $self->{'_supportdb'} = undef;
  $self->{'_assembly'} = undef;
  $self->{'_peer'}= undef;

  my $old_oscdb_dir = $self->{'oscdb_dir'};
  my $deploydir = $self->{'_deploy_dir'};

  my $oscdb_name = $self->{'oscdb_dir'};
  if((my $p2=rindex($self->{'oscdb_dir'}, "/")) != -1) {
    $oscdb_name = substr($self->{'oscdb_dir'}, $p2+1);
  }

  #
  # copy to new location: deploydir may be remote scp format
  #
  my $cmd;
  if($deploydir =~ /(.+)\:(.+)/) {
    printf("copy oscdb back to remote location\n   host : %s\n   file : %s\n", $1,$2);
    $cmd = "scp -rp " . $old_oscdb_dir . " ". $deploydir;
    $deploydir = $2;
  } else {
    $cmd = "cp -rp " . $old_oscdb_dir . " ". $deploydir;
  }
  #print(STDERR $cmd, "\n");
  system($cmd);

  # change internal oscdb_dir to new location
  $self->{'oscdb_dir'} = $deploydir ."/". $oscdb_name;
  my $dburl = "oscdb://" . $self->{'oscdb_dir'};

  #if I can not re-establish connection to new location I have to stop here
  unless($self->supportdb) { return undef; }

  $self->supportdb->execute_sql("DELETE from peer"); #clear old "selfs"

  # build internal peer
  my $peer = new EEDB::Peer;
  $peer->create_uuid;
  $peer->alias($oscdb_name);
  $peer->db_url($dburl);
  $peer->store($self->supportdb);

  $self->supportdb->execute_sql("UPDATE peer SET is_self=1 WHERE uuid=?", $peer->uuid);
  $self->{'_peer'} = $peer;

  # now delete old self
  $cmd = sprintf("rm %s/oscdb.*; rmdir %s", $old_oscdb_dir, $old_oscdb_dir);
  #print(STDERR "$cmd\n");
  system($cmd);

  return $dburl;
}




######################################################################
#
# internal methods for working with data from the file and
# converting into objects
#
######################################################################

sub _region_filter_line {
  my $self = shift;
  my $line = shift;

  # 1 => feature passes filter and can be returned
  # 0 => feature outside filter and must check next

  unless($self->{'_stream_chrom'}) { return 1; } #no stream region filtering active so OK

  my @columns  = split(/\t/, $line);

  my $chrname = $columns[$self->{"idx_chrom"}];
  my $start = $columns[$self->{"idx_start"}];
  my $end = $columns[$self->{"idx_end"}];

  if($self->{'_0base'}) { $start += 1; }

  #doing a region query;
  if($chrname ne $self->{'_stream_chrom'}->chrom_name) {
    print("hit end of chrom\n") if($self->{'debug'});
    $self->{'_stream_next_active'}=0;
    return 0;
  }
  if(defined($self->{'_stream_start'}) and defined($self->{'_stream_end'})) {
    if($end < $self->{'_stream_start'}) { 
      #printf("SKIP: %s\n", $feature->display_desc);
      return 0; 
    }
    if($start > $self->{'_stream_end'}) { 
      $self->{'_stream_next_active'}=0;
      return 0;
    }
  }
  return 1;
}


sub _reset_stream {
  my $self = shift;
  $self->{'_stream_next_active'} = 0;
  $self->{'_stream_chrom'} = undef;
  $self->{'_stream_start'} = undef;
  $self->{'_stream_end'} = undef;
  if($self->{'_oscfileparser'}) {
    $self->oscfileparser->{'_outputmode'} = $self->{'_sourcestream_output'};
  }
  $self->get_connection;
  return $self;
}


sub _setup_filters {
  my $self = shift;
  
  my $filter_experiments = undef;
  my $filter_datatypes = undef;
  
  if($self->{'_featuresource_array'}) {
    $self->{'_featuresource_filter_OK'} = 0;
    foreach my $fsrc (@{$self->{'_featuresource_array'}}) {
      if($fsrc->db_id eq $self->{'_fsrc'}->db_id) {
        $self->{'_featuresource_filter_OK'} = 1;
      }
    }
  }
  if($self->{'_experiment_array'}) {
    $filter_experiments = {};
    foreach my $exp (@{$self->{'_experiment_array'}}) {
      if($exp->class eq 'Experiment') { $filter_experiments->{$exp->db_id} = 1; }
    }
  }
  if($self->{'_expression_datatype_array'}) {
    $filter_datatypes = {};
    my $db = $self->supportdb;
    foreach my $type (@{$self->{'_expression_datatype_array'}}) {
      my $datatype_id = EEDB::Expression->_fetch_expression_datatype_id($db, $type);
      if($datatype_id) { $filter_datatypes->{$type} = 1; }
    }
    $db->disconnect;
  }
  
  if($self->oscfileparser) {
    $self->oscfileparser->{'_filter_datatypes'} = $filter_datatypes;
    $self->oscfileparser->{'_filter_experiments'} = $filter_experiments;
  }
  
  return $self;
}


#
# XML section
#

# xml_start() exactly same as superclass EEDB::SPStream::SourceStream

sub xml {
  my $self = shift;
  my $str = $self->xml_start() . $self->xml_end();
  return $str;
}

#does not implement _init_from_xmltree() since this consitutes a security leak

1;
