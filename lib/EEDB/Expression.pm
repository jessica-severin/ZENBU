# $Id: Expression.pm,v 1.80 2009/11/10 09:45:41 severin Exp $
=head1 NAME - EEDB::Expression

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

The rest of the documentation details each of the object methods. 

=cut

my $__riken_EEDB_expression_global_datatype_cache = {};
my $__riken_EEDB_expression_global_last_feature = undef;

$VERSION = 0.953;

package EEDB::Expression;

use strict;
use Time::HiRes qw(time gettimeofday tv_interval);

use EEDB::Feature;
use EEDB::Experiment;

use MQdb::MappedQuery;
our @ISA = qw(MQdb::MappedQuery);

#################################################
# Class methods
#################################################

sub class { return "Expression"; }

#################################################
# Instance methods
#################################################

sub init {
  my $self = shift;
  $self->SUPER::init;
  
  $self->{'type'}=undef;
  $self->{'value'}=0.0;
  $self->{'sig_error'}=1.0;
  
  return $self;
}

sub database {
  my $self = shift;
  if(defined($self->{'feature'}) and @_) { $self->{'feature'}->database(@_); }
  return $self->SUPER::database(@_);
}

##########################
#
# getter/setter methods of data which is stored in database
#
##########################

=head2 feature

  Description  : simple getter/setter method for the Feature of this Expression
                 it will lazy load from the database as needed.
  Parameter[1] : <optional> of type EEDB::Feature. if specififed it will set the feature
  Returntype   : EEDB::Feature instance
  Exceptions   : none

=cut

sub feature {
  my $self = shift;
  if(@_) {
    my $feature = shift;
    if(defined($feature) && !($feature->isa('EEDB::Feature'))) {
      die('ERROR : feature param must be a EEDB::Feature');
    }
    $self->{'feature'} = $feature;
    return $feature;
  }
  
  #lazy load from database if possible
  if(!defined($self->{'feature'}) and 
     defined($self->database) and 
     defined($self->{'_feature_id'}))
  {
    #printf("LAZY LOAD feature_id=%d\n", $self->{'_feature_id'});
    my $feature = EEDB::Feature->fetch_by_id($self->database, $self->{'_feature_id'});
    if(defined($feature)) { $self->{'feature'} = $feature; }
  }

  return $self->{'feature'};
}

=head2 experiment

  Description  : simple getter/setter method for the Experiment of this Expression
                 it will lazy load from the database as needed.
  Parameter[1] : <optional> of type EEDB::Experiment. if specififed it will set the experiment
  Returntype   : EEDB::Experiment instance
  Exceptions   : none

=cut

sub experiment {
  my $self = shift;
  if(@_) {
    my $experiment = shift;
    unless(defined($experiment) && $experiment->isa('EEDB::Experiment')) {
      die('experiment param must be a EEDB::Experiment');
    }
    $self->{'experiment'} = $experiment;
  }
  
  #lazy load from database if possible
  if(!defined($self->{'experiment'}) and 
     defined($self->database) and 
     defined($self->{'_experiment_id'}))
  {
    #printf("LAZY LOAD experiment_id=%d\n", $self->{'_experiment_id'});
    my $experiment = EEDB::Experiment->fetch_by_id($self->database, $self->{'_experiment_id'});
    if(defined($experiment)) { $self->{'experiment'} = $experiment; }
  }

  return $self->{'experiment'};
}

=head2 type

  Description: instance variable set/get for the expression data type.
  Returntype : float scalar

=cut

sub type { 
  my $self = shift;
  return $self->{'type'} = shift if(@_);
  if(!defined($self->{'type'}) and defined($self->{'_datatype_id'})) { 
    $self->{'type'}  = EEDB::Expression->_get_expression_datatype($self->database, $self->{'_datatype_id'});
  }
  if(defined($self->{'type'})) {  return $self->{'type'}; }
  else { return ''; }
}

=head2 value

  Description: instance variable set/get for 
               the actual expression measurement value
  Returntype : float scalar

=cut

sub value {
  my $self = shift;
  return $self->{'value'} = shift if(@_);
  $self->{'value'}=0.0 unless(defined($self->{'value'}));
  return $self->{'value'};
}

=head2 sig_error

  Description: instance variable set/get for significance,
               or error or variance of the expression
  Returntype : float scalar

=cut

sub sig_error {
  my $self = shift;
  return $self->{'sig_error'} = shift if(@_);
  $self->{'sig_error'}=1.0 unless(defined($self->{'sig_error'}));
  return $self->{'sig_error'};
}


##################
# redirect methods to work with Expression objects as if they are Feature objects
# since each expression object only has one feature this works
# but only implement read access
#

=head2 chrom_location

  Description: forward to $self->feature->chrom_location
  Returntype :string scalar

=cut

sub chrom_location {
  my $self = shift;
  return $self->feature->chrom_location;
}

=head2 chrom_name

  Description: forward to $self->feature->chrom_name
  Returntype :string scalar

=cut

sub chrom_name {
  my $self = shift;
  return $self->feature->chrom_name;
}

=head2 chrom_id

  Description: forward to $self->feature->chrom_id
  Returntype : scalar

=cut

sub chrom_id {
  my $self = shift;
  return $self->feature->chrom_id;
}

=head2 chrom

  Description: forward to $self->feature->chrom
  Returntype : EEDB::Chrom instance

=cut

sub chrom {
  my $self = shift;
  return $self->feature->chrom;
}

=head2 chrom_start

  Description: forward to $self->feature->chrom_start
               allows for re-setting the value which is useful 
               when doing stream processing
  Returntype : scalar

=cut

sub chrom_start {
  my $self = shift;
  return $self->feature->chrom_start(@_);
}

=head2 chrom_end

  Description: forward to $self->feature->chrom_end
               allows for re-setting the value which is useful 
               when doing stream processing
  Returntype : scalar

=cut

sub chrom_end {
  my $self = shift;
  return $self->feature->chrom_end(@_);
}

=head2 strand

  Description: forward to $self->feature->strand
  Returntype : string scalar "+" or "-" or ""

=cut

sub strand {
  my $self = shift;
  return $self->feature->strand;
}

=head2 primary_name

  Description: forward to $self->feature->primary_name
  Returntype : string scalar

=cut

sub primary_name {
  my $self = shift;
  return $self->feature->primary_name;
}

=head2 temp_metadataset

  Description: creates local, temporary MetadataSet which is not
               connected to the database.  This can be used for 
               working with temporary data during processing.
  Returntype : an EEDB::MetadataSet instance
  Exceptions : none 

=cut

sub temp_metadataset {
  my $self = shift;
  if(!defined($self->{'temp_metadataset'})) {
    $self->{'temp_metadataset'} = new EEDB::MetadataSet;
  }
  return $self->{'temp_metadataset'};
}

##################

sub display_desc {
  my $self = shift;
  my $str = sprintf("Expression(%s)", $self->id);
  
  if($self->feature) {
    $str .= sprintf(" %s[%s] %s <=>", $self->feature->primary_name, $self->feature->id, $self->feature->chrom_location);
  }
  $str .= sprintf(" %s[%s] : [%s | %1.7f value | %1.5f sigerr]", 
                  $self->experiment->display_name,
                  $self->experiment->db_id,
                  $self->type,
                  $self->value,
                  $self->sig_error);
  return $str;
}

sub display_contents {
  my $self = shift;
  return $self->display_desc . "\n";
}

sub xml {
  my $self = shift;
  
  my $str = $self->xml_start;

  if($self->feature) { $str .= $self->feature->simple_xml; }

  $str .= $self->xml_end;
  return $str;
}

sub xml_start {
  my $self = shift;

  my $str = sprintf("<expression type=\"%s\" value=\"%f\" sig_error=\"%f\" ",
                    $self->type,
                    $self->value,
                    $self->sig_error);
  $str .= sprintf("feature_id=\"%s\" ", $self->feature->db_id) if($self->feature);
  if($self->experiment) {
    $str .= sprintf("platform=\"%s\" ", $self->experiment->platform) if($self->experiment->platform);
    $str .= sprintf("experiment_id=\"%s\" ", $self->experiment->db_id) if($self->experiment->db_id);
    $str .= sprintf("exp_name=\"%s\" ", $self->experiment->display_name) if($self->experiment->display_name);
    $str .= sprintf("series_name=\"%s\" ", $self->experiment->series_name) if($self->experiment->series_name);
    $str .= sprintf("series_point=\"%s\" ", $self->experiment->series_point) if(defined($self->experiment->series_point));
  }
  $str .= ">";
  return $str;
}

sub xml_end {
  my $self = shift;
  return "</expression>";
}

sub new_from_xmltree {
  my $class = shift;
  my $xmlTree = shift;  #a hash/array tree generated by XML::TreePP
  
  my $self = new $class;

  $self->type($xmlTree->{'-type'}) if($xmlTree->{'-type'});
  $self->value($xmlTree->{'-value'}) if($xmlTree->{'-value'});
  $self->sig_error($xmlTree->{'-sig_error'}) if($xmlTree->{'-sig_error'});
  
  if($xmlTree->{'-experiment_id'}) {
    my $exp = EEDB::Experiment->new_from_xmltree($xmlTree);
    $exp->db_id($xmlTree->{'-experiment_id'});
    $self->experiment($exp);
  }
  if($xmlTree->{'-feature_id'}) {
    $self->{'_feature_id'} = $xmlTree->{'-feature_id'};
  }
  if(my $featxml = $xmlTree->{'feature'}) {
    if($featxml =~ /ARRAY/) { $featxml = $featxml->[0]; }
    my $obj = EEDB::Feature->new_from_xmltree($featxml);
    $self->feature($obj);
  }
  
  return $self;
}



#################################################
#
# DBObject override methods
#
#################################################

sub store {
  my $self = shift;
  my $db   = shift;
  
  if($db) { $self->database($db); }
  my $dbh = $self->database->get_connection;  
  my $sql = "INSERT ignore INTO expression ".
             "(experiment_id, feature_id, type, value, sig_error) ".
             "VALUES(?,?,?,?,?)";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->experiment->id,
                $self->feature->id,
                $self->type,
                $self->value,
                $self->sig_error
                );  
  my $dbID = $dbh->last_insert_id(undef, undef, qw(expression expression_id));
  $sth->finish;
  if(!$dbID) {
    $dbID = $self->fetch_col_value(
         $db,
         "select expression_id from expression where experiment_id=? and feature_id=?",
         $self->experiment->id,
         $self->feature->id);
    
  }
  $self->primary_id($dbID);

  return $self;
}


##### DBObject instance override methods #####

sub mapRow {
  my $self = shift;
  my $rowHash = shift;
  my $dbh = shift;

  $self->{'_primary_db_id'}  = $rowHash->{'expression_id'};
  $self->{'type'}            = $rowHash->{'datatype'} if(defined($rowHash->{'datatype'}));
  $self->{'value'}           = $rowHash->{'value'};
  $self->{'sig_error'}       = $rowHash->{'sig_error'};
   
  $self->{'_feature_id'}     = $rowHash->{'feature_id'};
  $self->{'_experiment_id'}  = $rowHash->{'experiment_id'};
  $self->{'_datatype_id'}    = $rowHash->{'datatype_id'}; 

  if($rowHash->{'feature_source_id'}) {
    # incorporate the Expression2Feature code concepts so that it tracks 
    # the previous feature in the stream and shares the object among
    # all the expression for it. Since the sort always sort expressions 
    # within a given feature together, it is easy to group them
    if(defined($__riken_EEDB_expression_global_last_feature) and
       ($__riken_EEDB_expression_global_last_feature->id eq $rowHash->{'feature_id'})) {
      $self->{'feature'} = $__riken_EEDB_expression_global_last_feature;
    } else {
      #create feature now
      my $feature = EEDB::Feature->new();
      $feature->mapRow($rowHash);
      $feature->database($self->database) if($self->database);
      $self->{'feature'} = $feature;
      $__riken_EEDB_expression_global_last_feature = $feature; 
    }    
  }    
  return $self;
}


##### public class methods for fetching by utilizing DBObject framework methods #####

sub fetch_by_id {
  my $class = shift;
  my $db = shift;
  my $id = shift;

  $__riken_EEDB_expression_global_last_feature = undef; 
  my $sql = "SELECT * FROM expression WHERE expression_id=?";
  return $class->fetch_single($db, $sql, $id);
}


sub fetch_by_feature_experiment_type {
  #must specify all since this will return a unique Expression object
  my $class = shift;
  my $feature = shift; #Feature object
  my $experiment = shift; #Experiment object
  my $type = shift;
  
  $__riken_EEDB_expression_global_last_feature = undef; 
  unless(defined($feature) && $feature->isa('EEDB::Feature')) {
    die('ERROR : fetch_by_feature_experiment_type param[1] must be a EEDB::Feature');
  }
  unless(defined($experiment) && $experiment->isa('EEDB::Experiment')) {
    die('ERROR : fetch_by_feature_experiment_type param[2] must be a EEDB::Experiment');
  }
  unless(defined($type)) {
    die('ERROR : fetch_by_feature_experiment_type param[3] must be a defined scalar');
  }

  my $datatype_id = $class->_fetch_expression_datatype_id($feature->database, $type);
  if(!$datatype_id) { return undef; }
  
  my $sql = "SELECT * FROM expression e ".
            "WHERE experiment_id=? and feature_id=? and e.datatype_id=?";
  return $class->fetch_single($feature->database, $sql, $experiment->id, $feature->id, $datatype_id);
}


sub fetch_all_by_feature_experiment {
  my $class = shift;
  my $feature = shift; #Feature object
  my $experiment = shift; #Experiment object

  $__riken_EEDB_expression_global_last_feature = undef; 
  unless(defined($feature) && $feature->isa('EEDB::Feature')) {
    die('ERROR : fetch_by_feature_experiment_type param[1] must be a EEDB::Feature');
  }
  unless(defined($experiment) && $experiment->isa('EEDB::Experiment')) {
    die('ERROR : fetch_by_feature_experiment_type param[2] must be a EEDB::Experiment');
  }
  my $sql = "SELECT * FROM expression ".
            "WHERE experiment_id=? and feature_id=?";
  return $class->fetch_multiple($feature->database, $sql, $experiment->id, $feature->id);
}

sub fetch_all_by_feature {
  my $class = shift;
  my $feature = shift; #Feature object
  my $type = shift; #optional type

  $__riken_EEDB_expression_global_last_feature = undef; 
  my $sql = "SELECT * FROM expression e WHERE feature_id=?";
  if(defined($type)) { 
    my $datatype_id = $class->_fetch_expression_datatype_id($feature->database, $type);
    if(!$datatype_id) { return []; }
    $sql .=" AND datatype_id=" . $datatype_id; 
  }

  return $class->fetch_multiple($feature->database, $sql, $feature->id);
}

sub fetch_all_by_experiment {
  my $class = shift;
  my $experiment = shift; #Experiment object
  
  $__riken_EEDB_expression_global_last_feature = undef; 
  my $sql = "SELECT * FROM expression WHERE experiment_id=?";
  return $class->fetch_multiple($experiment->database, $sql, $experiment->id);
}

sub fetch_all_feature_expression_by_named_region {
  my $class = shift;
  
  $__riken_EEDB_expression_global_last_feature = undef; 
  my $stream = EEDB::Expression->stream_by_named_region(@_);
  return $stream->as_array;
}

###############################################################################################
#
# streaming API section
#
###############################################################################################


=head2 stream_all

  Description: stream all expression (with feature) out of database 
               with a given set of source, experiment and datatype filters
  Arg (1)    : $database (EEDB::Database)
  Arg (2...) : hash named filter parameters. 
                 datatypes=>["tpm","raw"], 
                 sources=>[$fsrc1, $fsrc2,$fsrc3],  instances of EEDB::FeatureSource
                 experiments=>[$exp1, $exp2]  instances of EEDB::Experiment
  Returntype : a DBStream instance
  Exceptions : none 

=cut

sub stream_all {
  my $class = shift;
  my $db = shift;  #database
  my %options = @_;  #like datatypes=>["tpm","raw"], sources=>[$esrc1, $esrc2,$esrc3], experiments=>[exp1]
    
  $__riken_EEDB_expression_global_last_feature = undef; 
  return [] unless($db);

  my @types = @{$options{'datatypes'}} if($options{'datatypes'});
  my @sources = @{$options{'sources'}} if($options{'sources'});
  my @experiments = @{$options{'experiments'}} if($options{'experiments'});
  
  my @fsrc_ids;
  my @exp_ids;
  my @type_ids;
  foreach my $source (@sources) {
    next unless($source);
    if($source->class eq 'FeatureSource') { push @fsrc_ids, $source->id; }
  }
  foreach my $exp (@experiments) {
    next unless($exp);
    if($exp->class eq 'Experiment') { push @exp_ids, $exp->id; }
  }
  foreach my $type (@types) {
    my $datatype_id = $class->_fetch_expression_datatype_id($db, $type);
    if($datatype_id) { push @type_ids, $datatype_id; }
  }
 
  my $sql = "SELECT * FROM feature f JOIN expression fe using(feature_id) WHERE 1=1 ";
  if(@fsrc_ids) { $sql .= sprintf(" AND feature_source_id in(%s) ", join(',', @fsrc_ids)); }
  if(@exp_ids) { $sql .= sprintf(" AND experiment_id in (%s) ", join(',', @exp_ids)); }
  if(@type_ids) { $sql .= sprintf(" AND datatype_id in (%s) ", join(',', @type_ids)); }
  $sql .= " ORDER BY chrom_id, chrom_start, chrom_end, fe.feature_id, experiment_id, datatype_id";
  #print($sql, "\n");
  return $class->stream_multiple($db, $sql);
}

=head2 stream_by_chrom

  Description: stream all expression (with feature) on a specific EEDB::Chrom
               with a given set of source, experiment and datatype filters
  Arg (1)    : $chrom (EEDB::Chrom object with database)
  Arg (2...) : hash named filter parameters. 
                 datatypes=>["tpm","raw"], 
                 sources=>[$fsrc1, $fsrc2,$fsrc3],  instances of EEDB::FeatureSource
                 experiments=>[$exp1, $exp2]  instances of EEDB::Experiment
  Returntype : a DBStream instance
  Exceptions : none 

=cut

sub stream_by_chrom {
  my $class = shift;
  my $chrom = shift;  #Chrom object with database
  my %options = @_;   #like datatypes=>["tpm","raw"], sources=>[$esrc1, $esrc2,$esrc3], experiments=>[exp1]
  
  $__riken_EEDB_expression_global_last_feature = undef; 
  return undef unless($chrom and $chrom->database);
  my $db = $chrom->database;
  
  my @types = @{$options{'datatypes'}} if($options{'datatypes'});
  my @sources = @{$options{'sources'}} if($options{'sources'});
  my @experiments = @{$options{'experiments'}} if($options{'experiments'});
  
  my @fsrc_ids;
  my @exp_ids;
  my @type_ids;
  foreach my $source (@sources) {
    next unless($source);
    if($source->class eq 'FeatureSource') { push @fsrc_ids, $source->id; }
  }
  foreach my $exp (@experiments) {
    next unless($exp);
    if($exp->class eq 'Experiment') { push @exp_ids, $exp->id; }
  }
  foreach my $type (@types) {
    my $datatype_id = $class->_fetch_expression_datatype_id($db, $type);
    if($datatype_id) { push @type_ids, $datatype_id; }
  }
  
  my $sql = sprintf("SELECT * FROM feature f ".
                    "JOIN expression fe using(feature_id) ".
                    "WHERE chrom_id=%d", $chrom->id);
  if(@fsrc_ids) { $sql .= sprintf(" AND feature_source_id in(%s) ", join(',', @fsrc_ids)); }
  if(@exp_ids) { $sql .= sprintf(" AND experiment_id in (%s) ", join(',', @exp_ids)); }
  if(@type_ids) { $sql .= sprintf(" AND datatype_id in (%s) ", join(',', @type_ids)); }
  $sql .= " ORDER BY chrom_start, chrom_end, fe.feature_id, experiment_id, datatype_id";
  #print($sql, "\n");
  return $class->stream_multiple($db, $sql);
}

=head2 stream_by_named_region

  Description: stream all expression (with feature) from a specific region on a genome
               with a given set of source, experiment and datatype filters
  Arg (1)    : $database (EEDB::Database)
  Arg (2)    : $assembly_name (string)
  Arg (3)    : $chrom_name (string)
  Arg (4)    : $chrom_start (integer)
  Arg (5)    : $chrom_end (integer)
  Arg (6...) : hash named filter parameters. 
                 datatypes=>["tpm","raw"], 
                 sources=>[$fsrc1, $fsrc2,$fsrc3],  instances of EEDB::FeatureSource
                 experiments=>[$exp1, $exp2]  instances of EEDB::Experiment
  Returntype : a DBStream instance
  Exceptions : none 

=cut

sub stream_by_named_region {
  #returns an array of Expression objects, but the Feature object has been prebuilt, 
  #so a lazy-load does not need to occur
  my $class = shift;
  my $db = shift;
  my $assembly_name = shift;
  my $chrom_name = shift;
  my $chrom_start = shift;
  my $chrom_end = shift;
  my %options = @_;  #like datatypes=>["tpm","raw"], sources=>[$esrc1, $esrc2,$esrc3], experiments=>[exp1]

  $__riken_EEDB_expression_global_last_feature = undef; 
  my @types = @{$options{'datatypes'}} if($options{'datatypes'});
  my @sources = @{$options{'sources'}} if($options{'sources'});
  my @experiments = @{$options{'experiments'}} if($options{'experiments'});
  
  my @fsrc_ids;
  my @exp_ids;
  my @type_ids;
  foreach my $source (@sources) {
    next unless($source);
    if($source->class eq 'FeatureSource') { push @fsrc_ids, $source->id; }
  }
  foreach my $exp (@experiments) {
    next unless($exp);
    if($exp->class eq 'Experiment') { push @exp_ids, $exp->id; }
  }
  foreach my $type (@types) {
    my $datatype_id = $class->_fetch_expression_datatype_id($db, $type);
    if($datatype_id) { push @type_ids, $datatype_id; }
  }

  #printf("fetch_all_named_region %s : %d .. %d\n", $chrom_name, $chrom_start, $chrom_end);
  my $chrom = EEDB::Chrom->fetch_by_name($db, $assembly_name, $chrom_name);
  unless($chrom) { 
    #no matching chrom so return an empty DBStream object;
    return new MQdb::DBStream; 
  }
  my @chunk_ids;
  if(defined($chrom_start) and defined($chrom_end)) {  
    my $chunks = EEDB::ChromChunk->fetch_all_named_region($db, $assembly_name, $chrom_name, $chrom_start, $chrom_end);
    return [] unless(defined($chunks) and scalar(@$chunks)>0);
    foreach my $chunk (@$chunks) { push @chunk_ids, $chunk->id; }  
  }

  my $sql="";
  if((scalar(@chunk_ids)>0) and (scalar(@chunk_ids) < 10)) {
    $sql = "SELECT * from ";
    $sql .=  "(SELECT f.* FROM feature f JOIN ".
                "(select distinct feature_id FROM feature_2_chunk ".
                " WHERE chrom_chunk_id in (". join(",", @chunk_ids). ")".
                ")fc using(feature_id)".
                "WHERE chrom_start <= ". $chrom_end ." AND chrom_end >= ". $chrom_start . " ";
    $sql .=     "AND feature_source_id in(" . join(',', @fsrc_ids) . ") " if(@fsrc_ids);
    $sql .=  ")f ";
    $sql .=  "JOIN expression using(feature_id) ";
    $sql .=  "WHERE 1=1";
    if(@fsrc_ids) { $sql .= sprintf(" AND feature_source_id in(%s) ", join(',', @fsrc_ids)); }
    if(@exp_ids) { $sql .= sprintf(" AND experiment_id in (%s) ", join(',', @exp_ids)); }
    if(@type_ids) { $sql .= sprintf(" AND datatype_id in (%s) ", join(',', @type_ids)); }
  } else {
    $sql = "SELECT * from feature f JOIN expression using(feature_id) ";
    $sql .= "WHERE chrom_id =" . $chrom->id; 
    if(defined($chrom_start) and defined($chrom_end)) { 
      $sql .= " AND chrom_start <= ". $chrom_end ." AND chrom_end >= ". $chrom_start; 
    }
    if(@type_ids) { $sql .= " AND datatype_id in (". join(',',@type_ids) .") "; }
    if(@fsrc_ids) { $sql .= " AND feature_source_id in(". join(',',@fsrc_ids) .") "; }
    if(@exp_ids)  { $sql .= " AND experiment_id in (". join(',',@exp_ids) .") "; }
  }

  $sql .= " ORDER BY chrom_start, chrom_end, f.feature_id, experiment_id, datatype_id";
  
  #print($sql, "\n");
  return $class->stream_multiple($db, $sql);
}

#################### methods to work with the expression_datatype dictionary ###############

sub _fetch_expression_datatype_id {
  my $class = shift;
  my $db = shift;
  my $datatype = shift;
  
  if(!defined($__riken_EEDB_expression_global_datatype_cache->{$db . $datatype})) {  
    my $type_id = $db->fetch_col_value("SELECT datatype_id FROM expression_datatype WHERE datatype=?", $datatype);
    if($type_id) { $__riken_EEDB_expression_global_datatype_cache->{$db . $datatype} = $type_id; }
  }  
  return $__riken_EEDB_expression_global_datatype_cache->{$db . $datatype};
}

sub _storeget_expression_datatype_id {
  my $class = shift;
  my $db = shift;
  my $datatype = shift;
  
  if(!defined($__riken_EEDB_expression_global_datatype_cache->{$db . $datatype})) {  
  
    $db->execute_sql("INSERT ignore INTO expression_datatype (datatype) VALUES (?)", $datatype);
    #printf("datatype_id cache miss, store it [%s]\n", $datatype);
    
    my $type_id = $db->fetch_col_value("SELECT datatype_id FROM expression_datatype WHERE datatype=?", $datatype);
    if($type_id) { $__riken_EEDB_expression_global_datatype_cache->{$db . $datatype} = $type_id; }

  }  
  return $__riken_EEDB_expression_global_datatype_cache->{$db . $datatype};
}

sub get_all_expression_datatypes {
  my $class = shift;
  my $db = shift;  

  my $dbc = $db->get_connection;
  my $sth = $dbc->prepare("SELECT datatype_id, datatype FROM expression_datatype");
  $sth->execute();
  my @types;
  while(my ($type_id, $datatype) = $sth->fetchrow_array) {
    $__riken_EEDB_expression_global_datatype_cache->{$db . $datatype} = $type_id;
    $__riken_EEDB_expression_global_datatype_cache->{$db .'__'. $type_id} = $datatype;
    push @types, EEDB::Symbol->new("eedb:expression_datatype", $datatype);
  }
  return \@types;
}

sub _get_expression_datatype {
  my $class = shift;
  my $db = shift;  
  my $type_id = shift;

  my $datatype = $__riken_EEDB_expression_global_datatype_cache->{$db .'__'. $type_id};
  if(!$datatype) {
    EEDB::Expression->get_all_expression_datatypes($db);
  }
  return $__riken_EEDB_expression_global_datatype_cache->{$db .'__'. $type_id};
}

1;

