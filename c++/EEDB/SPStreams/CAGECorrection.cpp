/* $Id: CAGECorrection.cpp,v 1.2 2018/11/16 06:53:41 severin Exp $ */

/***

NAME - EEDB::SPStreams::CAGECorrection

SYNOPSIS

DESCRIPTION

 Performs corrections on CAGE alignments like removal of G-additions
 
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


#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <string>
#include <stdarg.h>
#include <rapidxml.hpp>  //rapidxml must be include before boost
#include <boost/algorithm/string.hpp>
#include <EEDB/Experiment.h>
#include <EEDB/Feature.h>
#include <EEDB/Expression.h>
#include <EEDB/Symbol.h>
#include <EEDB/SPStream.h>
#include <EEDB/SPStreams/CAGECorrection.h>

using namespace std;
using namespace MQDB;

const char*  EEDB::SPStreams::CAGECorrection::class_name = "EEDB::SPStreams::CAGECorrection";

//function prototypes
void _spstream_CAGECorrection_delete_func(MQDB::DBObject *obj) { 
  delete (EEDB::SPStreams::CAGECorrection*)obj;
}
MQDB::DBObject* _spstream_CAGECorrection_next_in_stream_func(EEDB::SPStream* node) {
  return ((EEDB::SPStreams::CAGECorrection*)node)->_next_in_stream();
}
void _spstream_CAGECorrection_xml_func(MQDB::DBObject *obj, string &xml_buffer) { 
  ((EEDB::SPStreams::CAGECorrection*)obj)->_xml(xml_buffer);
}
string _spstream_CAGECorrection_display_desc_func(MQDB::DBObject *obj) { 
  return ((EEDB::SPStreams::CAGECorrection*)obj)->_display_desc();
}
void _spstream_CAGECorrection_reset_stream_node_func(EEDB::SPStream* node) {
  ((EEDB::SPStreams::CAGECorrection*)node)->_reset_stream_node();
}
bool _spstream_CAGECorrection_stream_by_named_region_func(EEDB::SPStream* node, string assembly_name, string chrom_name, long int start, long int end) {
  return ((EEDB::SPStreams::CAGECorrection*)node)->_stream_by_named_region(assembly_name, chrom_name, start, end);
}


EEDB::SPStreams::CAGECorrection::CAGECorrection() {
  init();
}

EEDB::SPStreams::CAGECorrection::~CAGECorrection() {
}

void EEDB::SPStreams::CAGECorrection::init() {
  EEDB::SPStream::init();
  _classname                 = EEDB::SPStreams::CAGECorrection::class_name;
  _module_name               = "CAGECorrection";
  _funcptr_delete            = _spstream_CAGECorrection_delete_func;
  _funcptr_xml               = _spstream_CAGECorrection_xml_func;
  _funcptr_simple_xml        = _spstream_CAGECorrection_xml_func;
  _funcptr_display_desc      = _spstream_CAGECorrection_display_desc_func;

  //function pointer code
  _funcptr_next_in_stream           = _spstream_CAGECorrection_next_in_stream_func;
  _funcptr_reset_stream_node        = _spstream_CAGECorrection_reset_stream_node_func;
  _funcptr_stream_by_named_region   = _spstream_CAGECorrection_stream_by_named_region_func;

  //attribute variables
  _region_start        = -1;
  _region_end          = -1;
  
  _feature_buffer.unique_features(false);
  _feature_buffer.match_category(false);
  _feature_buffer.match_source(false);
  _feature_buffer.expression_mode(CL_NONE);

}


////////////////////////////////////////////////////////////////////////////
//
//  creation from XML section
//
////////////////////////////////////////////////////////////////////////////

void EEDB::SPStreams::CAGECorrection::_xml(string &xml_buffer) {
  _xml_start(xml_buffer);  //from SPStream superclass
  _xml_end(xml_buffer);  //from superclass
}


EEDB::SPStreams::CAGECorrection::CAGECorrection(void *xml_node) {
  //constructor using a rapidxml <spstream> description
  init();
  if(xml_node==NULL) { return; }
  
  rapidxml::xml_node<>      *root_node = (rapidxml::xml_node<>*)xml_node;
  //rapidxml::xml_node<>      *node;

  if(string(root_node->name()) != "spstream") { return; }
}

string EEDB::SPStreams::CAGECorrection::_display_desc() {
  return "CAGECorrection";
}

////////////////////////////////////////////////////////////////////////////
//
// callback methods
//
////////////////////////////////////////////////////////////////////////////


MQDB::DBObject* EEDB::SPStreams::CAGECorrection::_next_in_stream() {
  MQDB::DBObject *obj;
  
  EEDB::Feature *feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }
  
  if(_source_stream!=NULL) {
    while((obj = _source_stream->next_in_stream()) != NULL) {
      
      //non-feature\expression objects are just passed through this module
      if(obj->classname() != EEDB::Feature::class_name) {
        return obj;
      }
      
      _process_feature((EEDB::Feature*)obj);
      
      feature = _feature_buffer.next_completed_feature();
      if(feature) { return feature; }
    }
  }
  
  // input stream is empty so move all _subfeature_buffer into _completed_subfeatures
  _feature_buffer.transfer_all_to_completed();
  
  // return next completed feature if available
  feature = _feature_buffer.next_completed_feature();
  if(feature) { return feature; }
  return NULL;
}


void EEDB::SPStreams::CAGECorrection::_reset_stream_node() {
  _feature_buffer.reset();
  _region_start        = -1;
  _region_end          = -1;
}


bool EEDB::SPStreams::CAGECorrection::_stream_by_named_region(string assembly_name, string chrom_name, long int start, long int end) {
  _region_start = start;
  _region_end   = end;
  //fprintf(stderr,"FilterSubfeatures::_stream_by_named_region %s %d .. %d\n", chrom_name.c_str(), start,_region_end);
  return EEDB::SPStream::_stream_by_named_region(assembly_name, chrom_name, start, end);
}



/////////////////////////////////////////////////////////////
//
// _process_feature algorithm section
//
/////////////////////////////////////////////////////////////

//CigarOp code from https://stackoverflow.com/questions/27055520/how-to-split-a-string-and-get-i-want-in-c
struct  CigarOp {
    char op;   //!< CIGAR operation type (MIDNSHPX=)
    int size; //!< CIGAR operation length (number of bases)
    static int parse(const char* s,vector<CigarOp>& v) {
      char* p=(char*)(s);
      while(*p!=0) {
        char* endptr;
        CigarOp c;

        if(!isdigit(*p)) return -1;
        c.size =strtol(p,&endptr,10);
        if(c.size<=0) return -1;
        p=endptr;

        c.op = *p;
        if(!isalpha(c.op)) return -1;
        ++p;

        //if(!isdigit(*p)) return -1;
        //c.size =strtol(p,&endptr,10);
        //if(c.size<=0) return -1;
        //p=endptr;
        v.push_back(c);
      }
      return 0;      
    }
    static string tostring(vector<CigarOp>& v) {
      string cigar_str;
      char buf[256];
      for(unsigned j=0; j<v.size(); j++) {
        sprintf(buf, "%d%c", v[j].size, v[j].op);
        cigar_str += buf;
      }
      return cigar_str; 
    }

};
    

void EEDB::SPStreams::CAGECorrection::_process_feature(EEDB::Feature* feature) {
  //final post processing of subfeat prior to returning
  if(feature==NULL) { return; }
  
  // check if we are finished with features on the head of the _feature_buffer
  _feature_buffer.transfer_completed(feature->chrom_start());

  EEDB::Metadata *seqMD   = feature->metadataset()->find_metadata("sam:seq", "");
  EEDB::Metadata *cigarMD = feature->metadataset()->find_metadata("sam:cigar", "");
  if(!seqMD || !cigarMD || seqMD->data().empty() || cigarMD->data().empty()) { 
    _feature_buffer.insert_feature(feature);
    return; 
  }
  
  //TODO: this is a simple version where it just looks for a G on the 5' end
  //should also implement options for comparing to genome sequence, if double G and several others
  
  //split cigar into cigarops
  //fprintf(stderr, "cigar:[%s]  seq[%s] loc:%s\n", cigarMD->data().c_str(), seqMD->data().c_str(), feature->chrom_location().c_str());
  vector<CigarOp> cigar;
  if(CigarOp::parse(cigarMD->data().c_str(),cigar)!=0) {
    //fprintf(stderr, "problem with CigarOp::parse\n");
    _feature_buffer.insert_feature(feature);
    return;
  }
  //for(size_t i=0;i< cigar.size();++i) {
  //  cout << cigar[i].op << ":" << cigar[i].size << endl;
  //}

  vector<EEDB::Feature*> subfeats = feature->subfeatures();
    
  if((feature->strand() == '+') && (tolower(seqMD->data()[0]) == 'g')) {
    //fprintf(stderr, "alignment (+) seq has front G : %s\n", seqMD->data().c_str());
    if(cigar.front().op == 'S') { //already softclipped so no need
      //fprintf(stderr, "cigar already softclipped so don't do anything\n");
    } else {
      for(unsigned k=0; k<subfeats.size(); k++) {
        EEDB::Feature *sub1 = subfeats[k];
        if(sub1->chrom_start() == feature->chrom_start()) {
          sub1->chrom_start(sub1->chrom_start()+1);
        }
      }
      feature->chrom_start(feature->chrom_start()+1);

      //modify first cigarOp to be shorter
      cigar.front().size = cigar.front().size-1;

      //pre-pend the softclip cigarop
      CigarOp newOp;
      newOp.op = 'S';
      newOp.size = 1;
      std::vector<CigarOp>::iterator it = cigar.begin();
      cigar.insert(it, newOp);
      
      //rebuild the full cigar string and update the metadata
      string cigar_str = CigarOp::tostring(cigar);
      cigarMD->data(cigar_str);
      //fprintf(stderr, "modified cigar[%s] loc:%s\n", cigar_str.c_str(), feature->chrom_location().c_str());
    }
  }
  
  char last_base = seqMD->data()[seqMD->data().length()-1];
  if((feature->strand() == '-') && (tolower(last_base) == 'c')) {
    //fprintf(stderr, "alignment (-) seq has last C : %s\n", seqMD->data().c_str());

    if(cigar.back().op != 'S') {
      for(unsigned k=0; k<subfeats.size(); k++) {
        EEDB::Feature *sub1 = subfeats[k];
        if(sub1->chrom_end() == feature->chrom_end()) {
          sub1->chrom_end(sub1->chrom_end()-1);
        }
      }
      feature->chrom_end(feature->chrom_end()-1);

      //modify last cigarOp to be shorter      
      cigar.back().size = cigar.back().size-1;
      
      //append the softclip cigarop
      CigarOp newOp;
      newOp.op = 'S';
      newOp.size = 1;
      cigar.push_back(newOp);
      
      //rebuild the full cigar string and update the metadata
      string cigar_str = CigarOp::tostring(cigar);
      //fprintf(stderr, "modified cigar[%s] loc:%s\n", cigar_str.c_str(), feature->chrom_location().c_str());
      cigarMD->data(cigar_str);
    } else {
      //fprintf(stderr, "cigar already softclipped at end so don't do anything\n");
    }
  }

  _feature_buffer.insert_feature(feature);
  
  /* cigar/sequence align code from glyphs
  //sequence
  if(showseq) {
    //TODO: use expanded cigar to allow for in/del/mismatch and gaps
    var mymatch = cigar.split(/([0-9]+)([MIDNSHPX=])/);
    var cig_pos = 0;
    var ciglen = 0;
    var cigop = "";
    var insert_len=0;
    var insert_pos=-1;
   
    //document.getElementById("message").innerHTML += " ("+cigar+")["; 
    if(cig_pos+3 < mymatch.length) {
      ciglen = parseInt(mymatch[cig_pos+1]);
      cigop  = mymatch[cig_pos+2];
      cig_pos += 3;
    }
    //document.getElementById("message").innerHTML += " {"+ciglen+"-"+cigop+"}"; 
    var feat_start = feature.start;
    if(cigop == "S") {
      //softclip start means we need to shift the starting base
      feat_start -= ciglen;
    }

    var seqlen = seqtag.length;
    var pos  = Math.floor(feat_start +  0.5);
    for(x=0; x<seqlen; x++) {
      if(ciglen<=0) {
        if(cig_pos+3 < mymatch.length) {
          ciglen = parseInt(mymatch[cig_pos+1]);
          cigop  = mymatch[cig_pos+2];
          cig_pos += 3;
        }
      }
      if(cigop == "D") { pos += ciglen; ciglen=0; }
      if(cigop == "N") { pos += ciglen; ciglen=0; }
      if(cigop == "I") { 
        //have the base overwrite, or maybe place it midway
        if(insert_pos<0) { insert_length = ciglen; insert_pos=pos; }
        pos = insert_pos + (insert_length - ciglen + 1) / (insert_length+1);
      } else if(insert_pos >=0) { 
        pos = insert_pos;
        insert_pos = -1;
        insert_length = 0; 
      }

      var xfs  = dwidth*(pos - current_region.start)/length; 
      pos++;

      var tobj = document.createElementNS(svgNS,'text');
      //tobj.setAttributeNS(null, 'x',  (xfs-3) +'px');
      tobj.setAttributeNS(null, 'x',  '0px');
      tobj.setAttributeNS(null, 'y', '18px');
      tobj.setAttributeNS(null, "font-size","8px");
      tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
      tobj.setAttributeNS(null, "fill", 'black');

      var base = seqtag.charAt(x);

      if(current_region.genome_sequence) { //check against genome sequence for mismatches
        var refbase = current_region.genome_sequence.charAt(pos-start-1)
        if(base.toLowerCase() != refbase.toLowerCase()) { 
          tobj.setAttributeNS(null, "fill", 'red'); 
        }
      }
      if(cigop=="S") { //softclip
        tobj.setAttributeNS(null, "fill", 'gray'); 
        base = base.toLowerCase();
      }
      if(cigop=="X") { //mismatch
        tobj.setAttributeNS(null, "fill", 'red'); 
      }
      if(cigop=="I") { //insert
        tobj.setAttributeNS(null, "fill", 'red'); 
      }

      var gt1 = document.createElementNS(svgNS,'g');
      gt1.appendChild(tobj);
      if(current_region.flip_orientation) { //need to flip the text back  so it does not look like a mirror image
        base = complement_base(base);
        tobj.setAttributeNS(null, 'text-anchor', 'end' );
        gt1.setAttributeNS(null, 'transform', "scale(-1,1) translate("+(-1*(xfs-3))+",0)");
      } else {
        tobj.setAttributeNS(null, 'text-anchor', 'start' );
        gt1.setAttributeNS(null, 'transform', "translate("+(xfs-3)+",0)");
      }

      var textNode = document.createTextNode(base);
      tobj.appendChild(textNode);
      //g2.appendChild(tobj);
      g2.appendChild(gt1);

      ciglen--;
    }
    //document.getElementById("message").innerHTML += "]"; 
  }
  */
  
  /*
   * code from Charles and Nicolas pairedbam2bed
   * https://github.com/Population-Transcriptomics/pairedBamToBed12/blob/pairedbamtobed12/src/pairedBamToBed12/pairedBamToBed12.cpp 
  void SimpleGCorrection(const BamAlignment& bam1, const BamAlignment& bam2, const string strand, 
                         unsigned int& alignmentStart, unsigned int& alignmentEnd,
                         vector<int>& blockLengths, vector<int>& blockStarts) {
       string md;
       if ( (strand == "+") & (FirstBase(bam1) == "G") )  {
           bam1.GetTag("MD", md);
           md = md.substr(0,2);
           if (md == "0A" || md == "0C" || md == "0T")
               CutOneLeft(alignmentStart, blockLengths, blockStarts);
       }
       if ( (strand == "-") & (LastBase(bam2) == "C") ) {
           bam2.GetTag("MD", md);
           md = md.substr(md.length() -2, 2);
           if (md == "A0" || md == "G0" || md == "T0")
               CutOneRight(alignmentEnd, blockLengths);
       }
  }

  string FirstBase(const BamAlignment& bam) {return bam.QueryBases.substr(0,1);}

  string LastBase( const BamAlignment& bam) {return bam.QueryBases.substr(bam.QueryBases.length() -1, 1);}

  void CutOneLeft( unsigned int& alignmentStart, vector<int>& blockLengths, vector<int>& blockStarts) {
       alignmentStart = alignmentStart +1;
       blockLengths.front() = blockLengths.front() - 1;
       for(unsigned int i=0; i < blockStarts.size(); i++)
           blockStarts[i]--;
       blockStarts.front() = 0;
  }

  void CutOneRight(unsigned int& alignmentEnd, vector<int>& blockLengths) {
       alignmentEnd = alignmentEnd -1;
       blockLengths.back() = blockLengths.back() -1;
  }
  */
  
}




