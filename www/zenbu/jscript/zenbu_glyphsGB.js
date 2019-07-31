// ZENBU eedb_gLyphs.js
//
// Contact : Jessica Severin <severin@gsc.riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
// * ZENBU eedb_gLyphs.js
// * copyright (c) 2007-2010 Jessica Severin RIKEN OSC
// * All rights reserved.
// * Redistribution and use in source and binary forms, with or without
// * modification, are permitted provided that the following conditions are met:
// *     * Redistributions of source code must retain the above copyright
// *       notice, this list of conditions and the following disclaimer.
// *     * Redistributions in binary form must reproduce the above copyright
// *       notice, this list of conditions and the following disclaimer in the
// *       documentation and/or other materials provided with the distribution.
// *     * Neither the name of Jessica Severin RIKEN OSC nor the
// *       names of its contributors may be used to endorse or promote products
// *       derived from this software without specific prior written permission.
// *
// * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
// * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// * DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS BE LIABLE FOR ANY
// * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

var eedbEchoSvgCGI = eedbWebRoot + "/cgi/eedb_svgecho.cgi";


//----------------------------------------------
//
// ZenbuGenomeBrowser  
//
//----------------------------------------------

function ZenbuGenomeBrowser(main_div) {
  this.uuid = zenbuGenerateUUID();
  console.log("new ZenbuGenomeBrowser : "+this.uuid);

  this.display_width = Math.floor(800);
  this.asm = "hg38";
  this.genus = "";
  this.species = "";
  this.common_name = "";

  if(gLyphsInitParams) {
    if(Math.floor(gLyphsInitParams.display_width)) { this.display_width = Math.floor(gLyphsInitParams.display_width); }
    if(gLyphsInitParams.asm) { this.asm = gLyphsInitParams.asm; }
  }

  this.configname = "welcome to ZENBU genome browser";
  this.desc = "";
  this.view_config = null;
  this.config_createdate = "";
  this.config_creator = "";
  this.view_config_loaded = false;

  this.nocache = false;
  this.share_exp_panel = true;
  this.exppanel_subscroll = false;
  this.express_sort_mode = 'name';
  this.flip_orientation = false;
  this.auto_flip = false;
  this.highlight_search = "";
  this.exppanel_active_on_top = false;
  this.groupinfo_ranksum_display = false;
  this.autosaveInterval = undefined;
  this.active_track_exp_filter = undefined;
  this.active_trackID = undefined;
  this.init_search_term = undefined;
  this.hide_compacted_tracks = true;
  this.selected_feature = undefined;

  this.tracks_hash = new Object();
  this.tracks_array = new Array();

  if(main_div) { this.main_div = main_div; }
  else { this.main_div = document.createElement('div'); }
  this.main_div.innerHTML="";
  this.gLyphTrackSet = this.main_div.appendChild(document.createElement('div'));
  this.expPanelFrame = this.main_div.appendChild(document.createElement('div'));

  gLyphsSearchInterface(this);
  //eedbEmptySearchResults(this.searchSetID);
  
  //class methods
  this.regionLocation    = gLyphsGB_regionLocation;
  this.activeTrack       = gLyphsGB_activeTrack;
  this.selectedFeature   = gLyphsGB_selectedFeature;
}


function gLyphsGB_regionLocation() {
  var chromloc = this.asm+"::"+this.chrom+":"+this.start+".."+this.end;
  if(this.flip_orientation) { chromloc += "-"; } else { chromloc += "+"; }
  return chromloc;
}

function gLyphsGB_activeTrack() {
  if(!this.active_trackID) { return null; }
  var activeTrack = glyphsTrack_global_track_hash[this.active_trackID];
  return activeTrack;
}

function gLyphsGB_selectedFeature() {
  var activeTrack = this.activeTrack();
  if(!activeTrack) { return null; }
  return activeTrack.selected_feature;
}

//---------------------------------------------
//
// and XHR to get the feature DOM data
//
//---------------------------------------------


function gLyphsProcessFeatureSelect(glyphsGB, object) {
  if(!object) {
    if(glyphsGB.selected_feature) { 
      //clear selected feature
      glyphsGB.selected_feature = undefined;
      zenbuDisplayFeatureInfo(); //clears panel
    }
    return; 
  }
  if(object.classname != "Feature") { return; }

  //check if metadata/fullload has heppened, if not do it
  if(object.id && !object.full_load) { object.request_full_load = true; }

  if(object.source_name == "eeDB_gLyphs_configs") {
    var configUUID = object.uuid;;
    if(configUUID) { 
      gLyphsInitViewConfigUUID(configUUID); 
      gLyphsReloadRegion(glyphsGB);
      gLyphsChangeDhtmlHistoryLocation();
      return 0;
    }
  } else {
    if(glyphsGB.selected_feature == object) {
      gLyphsCenterOnFeature(glyphsGB, glyphsGB.selected_feature);
    } else {
      glyphsGB.selected_feature = object;
      //if(object.strand!="+" && object.strand!="-") {
      //  if(current_region.flip_orientation) { object.strand = "-"; } else { object.strand = "+"; }
      //}
      zenbuDisplayFeatureInfo(object);
    }

    //need to rethink if I rebuild this differently
    //feature_express_probes = xmlDoc.getElementsByTagName("feature_express");
    //displayProbeInfo();  //old system not used anymore
    //current_express_probe = feature_express_probes[0];
    //current_express_probe = processFeatureExpressProbe(feature_express_probes[0]);

    gLyphsDrawExpressionPanel(glyphsGB);
  }
  return 1;
}


/*
function processFeatureExpressProbe(probeXML) {
  if(!probeXML) { return undefined; }

  var expExpress = new Object;

  var heading_text = probeXML.getAttribute("probe_title");
  if(!heading_text) {
    heading_text = "expression";
    var feature = probeXML.getElementsByTagName("feature")[0];
    if(feature) {
      var fsource = feature.getElementsByTagName("featuresource")[0];
      heading_text = "[" + fsource.getAttribute("name") + "]   " + feature.getAttribute("name");
    }
    var region = probeXML.getElementsByTagName("express_region")[0];
    if(region) {
      var asm    = region.getAttribute("asm");
      var chrom  = region.getAttribute("chrom");
      var start  = region.getAttribute("start");
      var end    = region.getAttribute("end");
      heading_text = "region: "+ asm + " " +chrom+ ":" +start+ ".." +end;
    }
  }
  expExpress.heading_text     = heading_text;
  expExpress.experiment_array = new Array;
  expExpress.experiments      = new Object;

  var express = probeXML.getElementsByTagName("expression");
  var max_value = 0;
  for(var i=0; i<express.length; i++) {
    var experiment = new Object;

    experiment.exptype   = express[i].getAttribute("type");
    experiment.expname   = express[i].getAttribute("exp_name");
    experiment.id        = express[i].getAttribute("experiment_id");
    experiment.value     = parseFloat(express[i].getAttribute("value"));
    experiment.sig_error = parseFloat(express[i].getAttribute("sig_error"));

    expExpress.experiments[experiment.id] = experiment;
    expExpress.experiment_array.push(experiment);

    if(experiment.value > max_value) max_value = experiment.value;
  }
  expExpress.max_value = max_value;
  return expExpress;
} 
*/



//=======================================================================================
// end of expression panel section
//=======================================================================================


function gLyphsChangeActiveTrack(glyphTrack) {
  if(!glyphTrack) { return; }
  if(!glyphTrack.glyphsGB) { return; }
  if(glyphTrack.trackID == glyphTrack.glyphsGB.active_trackID) { //no change
    glyphTrack.expPanelActive = true;
    if(!glyphTrack.glyphsGB.share_exp_panel) { glyphsExpPanelDraw(glyphTrack); }
    return;
  }
  //console.log("gLyphsChangeActiveTrack "+glyphTrack.trackID);
  
  glyphTrack.glyphsGB.active_trackID = glyphTrack.trackID;
  glyphTrack.expPanelActive = true;

  gLyphsProcessFeatureSelect(glyphTrack.glyphsGB); //clear feature selection
  gLyphsUpdateTrackTitleBars(glyphTrack.glyphsGB);
  gLyphsDrawExpressionPanel(glyphTrack.glyphsGB); 
}


function gLyphsUpdateTrackTitleBars(glyphsGB) {
  //glyphsGB.tracks_hash[trackID2] = glyphTrack2;
  for(var trackID in glyphsGB.tracks_hash){
    var glyphTrack = glyphsGB.tracks_hash[trackID];
    
    if(glyphsGB.share_exp_panel) { glyphTrack.expPanelActive = false; }
    if(glyphTrack.trackID == glyphTrack.glyphsGB.active_trackID) { glyphTrack.expPanelActive = true; }
    
    if(glyphTrack.titleBar) {
      if(glyphTrack.trackID == glyphTrack.glyphsGB.active_trackID) {
        glyphTrack.titleBar.setAttributeNS(null, 'style', 'fill: #DECAAF;'); 
      } else {
        glyphTrack.titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;'); 
      }
    }
  }
}

//----------------------------------------------
// gLyphs generic section for working with
//  feature XML DOM
//----------------------------------------------

function gLyphsCenterOnFeature(glyphsGB, feature) {
  if(!glyphsGB) { return; }
  if(feature === undefined) { feature = glyphsGB.selected_feature; }
  if(feature === undefined) { return; }

  var start = feature.start;
  var end   = feature.end;
  var range = end-start;
  start -= Math.round(range*.25);
  end += Math.round(range*.25);
  
  if((glyphsGB.asm == feature.asm) && 
     (glyphsGB.chrom == feature.chrom) &&
     (glyphsGB.start == start) &&
     (glyphsGB.end == end)) { return; }

  gLyphsSetLocation(glyphsGB, feature.asm, feature.chrom, start, end);

  if(glyphsGB.auto_flip) {
    if(feature.strand == "-") { glyphsGB.flip_orientation = true; }
    if(feature.strand == "+") { glyphsGB.flip_orientation = false; }
  }

  gLyphsReloadRegion(glyphsGB);
  gLyphsChangeDhtmlHistoryLocation();
}


//--------------------------------------------------------
//
//
//       EEDB gLyphs genomic visualization toolkit
//
//
//--------------------------------------------------------


function gLyphsParseLocation(query, glyphsGB) {
  var region = new Object();
  region.asm = "undef";
  region.chrom = "chr1";
  region.start = 1;
  region.end   = 1000;
  region.strand  = "+";

  if(glyphsGB) {
    region.asm   = glyphsGB.asm;
    region.chrom = glyphsGB.chrom;
    region.start = glyphsGB.start;
    region.end   = glyphsGB.end;
    if(glyphsGB.flip_orientation) { region.strand = "-"; }
  }
  console.log("gLyphsParseLocation ["+query+"]");

  var rtnval = false;

  //first remove leading and trailing spaces
  var match1 = /^(\s*)(.+)(\s*)$/.exec(query);
  if(match1 && (match1.length == 4)) { 
    query = match1[2]; 
    //document.getElementById("message").innerHTML += " trimspace["+query+"]";
  }

  //look for assembly is <asm>:: pattern
  var asm_match = /^([\w-._]+)\:\:(.+)$/.exec(query);
  if(asm_match && (asm_match.length == 3)) {
    region.asm = asm_match[1];
    query = asm_match[2];
    //document.getElementById("message").innerHTML += " assembly["+region.asm+"]";
  } else {
    //document.getElementById("message").innerHTML += "use previous assembly["+glyphsGB.asm+"]";
  }

  var mymatch = /^([\w-._]+)\:(\d+)\.\.(\d+)([+-]*)$/.exec(query);
  if(mymatch && (mymatch.length >= 4)) {
    //document.getElementById("message").innerHTML += " matches chr:start..end format";
    rtnval = true;
    region.chrom = mymatch[1];
    region.start = Math.floor(mymatch[2]);
    region.end   = Math.floor(mymatch[3]);
    if(mymatch.length==5) {
      if(mymatch[4] == "-") { region.strand = "-"; }
      if(mymatch[4] == "+") { region.strand = "+"; }
    }
    query = "";
    //document.getElementById("message").innerHTML += " chrom["+region.chrom+"]";
    //document.getElementById("message").innerHTML += " start["+region.start+"]";
    //document.getElementById("message").innerHTML += " end["+region.end+"]";
  }

  var mymatch = /^([\w-._]+)\:(\d+)\-(\d+)([+-]*)$/.exec(query);
  if(mymatch && (mymatch.length >= 4)) {
    //document.getElementById("message").innerHTML += " matches chr:start-end format";
    rtnval = true;
    region.chrom = mymatch[1];
    region.start = Math.floor(mymatch[2]);
    region.end   = Math.floor(mymatch[3]);
    if(mymatch.length==5) {
      if(mymatch[4] == "-") { region.strand = "-"; }
      if(mymatch[4] == "+") { region.strand = "+"; }
    }
    query = "";
  }

  var mymatch = /^([\w-._]+)\:$/.exec(query);
  if(mymatch && (mymatch.length >= 2)) {
    //document.getElementById("message").innerHTML += " matches chr: format";
    rtnval = true;
    region.chrom = mymatch[1];
    query = "";
    //document.getElementById("message").innerHTML += " chrom["+region.chrom+"]";
  }

  var mymatch = /chr(\w+)/.exec(query);
  if(!rtnval && mymatch && (mymatch.length == 2)) {
    //document.getElementById("message").innerHTML = "loc ["+query+"]";
    var toks = query.split(/[\s\:\.\-]/);
    var num1, num2;
    for(var i=0; i<toks.length; i++) {
      var tok = toks[i];
      if(!tok) { continue; }
      //document.getElementById("message").innerHTML += " ["+tok+"]";

      var match2 = /^chr(\w+)/.exec(tok);
      if(match2 && match2.length==2) {
        region.chrom = "chr"+match2[1];
        rtnval=true;
      }
      if(/\,/.test(tok)) { tok = tok.replace(/\,/g, ""); }
      if(/^(\d+)$/.test(tok)) {
        if(num1 === undefined) { num1 = Math.floor(tok); }
        else { num2 = Math.floor(tok); }
      }
    }
    if(num1 !== undefined) { 
      region.start = num1;
      var gwidth = 100;
      if(glyphsGB) { gwidth = glyphsGB.end - glyphsGB.start; }
      if(gwidth < 100) { gwidth = 100; }
      if(num2 !== undefined) { region.end = num2; }
      else { 
        gwidth = Math.floor(gwidth /2);
        region.start = num1 - gwidth; 
        region.end   = num1 + gwidth; 
      }
    }
  }

  if(region.end<region.start) {
    var t = region.start;
    region.start = region.end;
    region.end = t;
  }

  if(rtnval) { 
    //document.getElementById("message").innerHTML += " loc-match ["+region.asm+"::"+region.chrom+":"+region.start+".."+region.end+"]";
    return region; 
  }
  return undefined;
}


function gLyphsInitLocation(glyphsGB, query) {
  //this function takes a location string, parses it, and
  //then sets the location configuration.
  //It only sets configuration and does not execute a reload
  if(!glyphsGB) { return false; }
  var region = gLyphsParseLocation(query, glyphsGB);
  if(region) {
    gLyphsSetLocation(glyphsGB, region.asm, region.chrom, region.start, region.end, region.strand);
    glyphsGB.main_div.style.display = 'block';
    eedbEmptySearchResults(glyphsGB.searchSetID);
    return true;
  }
  return false;
}


function gLyphsSetLocation(glyphsGB, asm, chrom, start, end, strand) {
  if(!glyphsGB) { return; }
  //set this as the current location. 
  //performs a chromosome region check to makes sure coordinates are valid
  //extends the html history to include the new location
  //only sets configuration, does not execute reload.

  if(start<1) { start = 1; }
  if(end<1) { end = 1; }

  //query for chrom information from the eeDB server if needed
  glyphsGetChromInfo(glyphsGB, asm, chrom);

  if((glyphsGB.asm == asm) && (glyphsGB.chrom == chrom) && (glyphsGB.chrom_length>0)) {
    if(end > glyphsGB.chrom_length) { end = glyphsGB.chrom_length; }
    if(start > glyphsGB.chrom_length) { start = glyphsGB.chrom_length; }
  }

  if(end<start) {
    var t = start;
    start = end;
    end = t;
  }       
  if(end-start < 99) { 
    start = Math.floor(start - (100-end+start)/2);
    if(start<1) { start = 1; }
    end = start + 99; 
  }

  glyphsGB.start = Math.floor(start);
  glyphsGB.end   = Math.floor(end);
  
  if(strand == "-") { glyphsGB.flip_orientation = true; }
  if(strand == "+") { glyphsGB.flip_orientation = false; }
}


function gLyphsRecenterView(glyphsGB, chrpos) {
  var width = glyphsGB.end - glyphsGB.start;
  var start = chrpos - width/2;
  var end = start + width;

  gLyphsSetLocation(glyphsGB, glyphsGB.asm, glyphsGB.chrom, start, end);
  gLyphsReloadRegion(glyphsGB);
  gLyphsChangeDhtmlHistoryLocation();
}


function gLyphsLoadLocation(glyphsGB, chromloc) {
  //parse location and reload the view
  if(gLyphsInitLocation(glyphsGB, chromloc)) {
    gLyphsReloadRegion(glyphsGB);
    gLyphsChangeDhtmlHistoryLocation();
  }
}


function glyphsGetChromInfo(glyphsGB, asm, chrom) {
  if(!glyphsGB) { return; }
  if((glyphsGB.asm == asm) && (glyphsGB.chrom == chrom)) { return; }

  //reset
  glyphsGB.asm          = asm;
  glyphsGB.chrom        = chrom;
  glyphsGB.chrom_length = -1;
  glyphsGB.chrom_id     = null;
  glyphsGB.has_sequence = false;

  var url = eedbSearchFCGI + "?mode=chrom&asm="+asm+";chrom="+chrom;
  var chromXMLHttp=GetXmlHttpObject();
  if(chromXMLHttp==null) { return; }

  chromXMLHttp.open("GET",url,false); //synchronous
  chromXMLHttp.send(null);

  if(chromXMLHttp.responseXML == null) return;
  if(chromXMLHttp.readyState!=4) return;
  if(chromXMLHttp.status!=200) { return; }
  if(chromXMLHttp.responseXML == null) return;

  var xmlDoc=chromXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    //document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
  if(xmlDoc.getElementsByTagName("chrom")) {
    var xml_chroms = xmlDoc.getElementsByTagName("chrom");
    for(var i=0; i<xml_chroms.length; i++) {
      var chromXML = xml_chroms[i];
      if((chromXML.getAttribute('chr') != chrom)  && (chromXML.getAttribute('ncbi_chrom_acc') != chrom) && (chromXML.getAttribute('ncbi_chrom_name') != chrom) && (chromXML.getAttribute('refseq_chrom_acc') != chrom) && (chromXML.getAttribute('chrom_name_alt1') != chrom)) { continue; }
      //if((chromXML.getAttribute('asm') != asm)  && (chromXML.getAttribute('ucsc_asm') != asm) && (chromXML.getAttribute('ncbi_asm') != asm)) { continue; }
      glyphsGB.chrom = chromXML.getAttribute('chr');
      glyphsGB.chrom_length = Math.floor(chromXML.getAttribute('length'));
      glyphsGB.chrom_id = chromXML.getAttribute('id');
      glyphsGB.chrom = chromXML.getAttribute('chr');
      break;
    }
  }
  var xml_asm = xmlDoc.getElementsByTagName("assembly");
  if(xml_asm && (xml_asm.length>0) && ((xml_asm[0].getAttribute('asm').toLowerCase() == asm.toLowerCase()) || (xml_asm[0].getAttribute('ucsc').toLowerCase() == asm.toLowerCase()) || (xml_asm[0].getAttribute('ncbi').toLowerCase() == asm.toLowerCase()) || (xml_asm[0].getAttribute('ncbi_acc').toLowerCase() == asm.toLowerCase()))) { 
    if(xml_asm[0].getAttribute('seq') =="y") { glyphsGB.has_sequence = true; }
    glyphsGB.genus = xml_asm[0].getAttribute('genus');
    glyphsGB.species = xml_asm[0].getAttribute('species');
    glyphsGB.common_name = xml_asm[0].getAttribute('common_name');
    glyphsGB.asm = xml_asm[0].getAttribute('asm');
    glyphsGB.ucsc_asm = xml_asm[0].getAttribute('ucsc');
    glyphsGB.ncbi_asm = xml_asm[0].getAttribute('ncbi');
    glyphsGB.ncbi_asm_accn = xml_asm[0].getAttribute('ncbi_acc');
    glyphsGB.release_date = xml_asm[0].getAttribute('release_date');
  }
  //update the genome desc
  var genomeDiv = document.getElementById("glyphs_genome_desc");
  if(genomeDiv) {
    genomeDiv.setAttribute("style", "font-family:arial,helvetica,sans-serif; font-size:12px; color:black;");
    genomeDiv.innerHTML="";
    var span1 = genomeDiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:3px; color:black;");
    span1.innerHTML = glyphsGB.common_name +" "+ glyphsGB.asm; 
    //if(glyphsGB.ucsc_asm) { span1.innerHTML += " "+glyphsGB.ucsc_asm; }
    if(glyphsGB.ncbi_asm && glyphsGB.ncbi_asm!=glyphsGB.asm) { span1.innerHTML += " "+glyphsGB.ncbi_asm; }
    if(glyphsGB.ucsc_asm && glyphsGB.ucsc_asm!=glyphsGB.asm) { span1.innerHTML += " "+glyphsGB.ucsc_asm; }
    //if(glyphsGB.ncbi_asm_accn) { span1.innerHTML += " "+glyphsGB.ncbi_asm_accn; }

    if(glyphsGB.release_date) {
      span1 = genomeDiv.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:3px; color:black; ");
      span1.innerHTML = glyphsGB.release_date;
    }
    if(glyphsGB.genus) {
      span1 = genomeDiv.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:3px; color:black;");
      span1.innerHTML = "( "+glyphsGB.genus + " " + glyphsGB.species+" )";
    }
  }
}


function glyphsGetChromSequence(glyphsGB) {
  glyphsGB.genome_sequence  = null;

  if(!glyphsGB.chrom_id) { return; }
  if((glyphsGB.display_width / (glyphsGB.end  - glyphsGB.start)) < 5) { return; }

  var chromloc   = glyphsGB.chrom +":" + glyphsGB.start + ".." + glyphsGB.end;

  var paramXML = "<zenbu_query><format>xml</format><mode>sequence</mode>";
  paramXML += "<source_ids>"+ glyphsGB.chrom_id+"</source_ids>";
  paramXML += "<asm>"+glyphsGB.asm+"</asm>";
  paramXML += "<loc>"+chromloc+"</loc>";
  paramXML += "</zenbu_query>";
  //console.log(paramXML);
  
  var chromXMLHttp=GetXmlHttpObject();
  if(chromXMLHttp==null) { return; }

  chromXMLHttp.open("POST", eedbRegionCGI, false);  //synchronous
  chromXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //chromXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //chromXMLHttp.setRequestHeader("Connection", "close");
  chromXMLHttp.send(paramXML);

  if(chromXMLHttp.responseXML == null) return;
  if(chromXMLHttp.readyState!=4) return;
  if(chromXMLHttp.status!=200) { return; }
  if(chromXMLHttp.responseXML == null) return;

  var xmlDoc=chromXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }

  var sequenceXML = xmlDoc.getElementsByTagName("sequence");
  if(sequenceXML && sequenceXML.length > 0) {
    glyphsGB.genome_sequence  =  sequenceXML[0].firstChild.nodeValue;
    //document.getElementById("message").innerHTML = "chromseq : " + glyphsGB.genome_sequence;
  }
}


function gLyphsRedrawRegion(glyphsGB) {
  if(!glyphsGB) { return; }
  if(!glyphsGB.gLyphTrackSet) { return; }
  var glyphset = glyphsGB.gLyphTrackSet;
  glyphset.setAttribute("style", 'width: '+ (glyphsGB.display_width+10) +'px;');

  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = glyphsTrack_global_track_hash[trackID];
    if(!glyphTrack) { continue; }
    gLyphsRenderTrack(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
}


function glyphsNavigationControls(glyphsGB) {
  if(!glyphsGB) { return; }
  if(!glyphsGB.main_div) { return; }

  if(zenbu_embedded_view && !zenbu_embedded_navigation) { return; }

  if(!glyphsGB.navCtrls) {
    glyphsGB.navCtrls = document.createElement('div');
    if(glyphsGB.gLyphTrackSet) {
      glyphsGB.main_div.insertBefore(glyphsGB.navCtrls, glyphsGB.gLyphTrackSet);
    } else {
      glyphsGB.main_div.appendChild(glyphsGB.navCtrls);
    }
  }
 
  var dwidth = glyphsGB.display_width;
  if(glyphsGB.gLyphTrackSet) { glyphsGB.gLyphTrackSet.setAttribute("style", 'width: '+ (dwidth+10)+'px;'); }
  glyphsGB.navCtrls.setAttribute("style", 'width: '+ (dwidth+10)+'px;');

  var navCtrls = glyphsGB.navCtrls;  
  navCtrls.innerHTML ="";

    //view load progress div
    var loadProgress = navCtrls.appendChild(document.createElement("div"));
    loadProgress.id = "gLyphs_load_progress_div";
    loadProgress.setAttribute("style", "margin-top:5px; margin-bottom:3px; font-size:12px; display:none; ");

    //location
    var locInfo = navCtrls.appendChild(document.createElement("div"));
    locInfo.setAttribute("style", "float:left; margin-top:5px; margin-bottom:3px; font-size:12px; ");
    locInfo.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    if(zenbu_embedded_view) {
      locInfo.setAttributeNS(null, "onclick", "zenbu_toggle_embedded_view();");
      locInfo.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"go to full view in ZENBU\",150);");
    } else {
      locInfo.onclick = function() { glyphsEditLocation(glyphsGB); }
      locInfo.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"change location\",80);");
    }
    glyphsGB.gLyphs_location_info = locInfo;
 
    //move buttons
    var navCtrlRight = navCtrls.appendChild(document.createElement("div"));
    navCtrlRight.setAttribute("style", "float:right; margin-bottom:3px;");

    var span2 = navCtrlRight.appendChild(document.createElement("span"));
    span2.setAttribute("style", "margin-right:3px; margin-left:5px;");

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('ll')");
    button.innerHTML = "<<";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('l')");
    button.innerHTML = "<";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('r')");
    button.innerHTML = ">";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('rr')");
    button.innerHTML = ">>";

    //magnify buttons
    span2 = navCtrlRight.appendChild(document.createElement("span"));
    span2.setAttribute("style", "margin-left:7px;");

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 0.1)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "+10x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 0.2)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "+5x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 0.5)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "+2x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:5px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 2)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "-2x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 5)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "-5x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "margin-right:10px; font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 10)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "-10x";

    //zoom level widget
    var zoomdiv = document.createElement("span");    
    //navCtrlRight.appendChild(zoomdiv);
    zoomdiv.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; background: #EEEEEE; margin-left:17px; margin-right:10px;  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:2px;");
    span1.setAttribute("onclick", "regionChange('zoomfactor', 0.5)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in 2x\",80);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "-";

    //----
    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 1)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"100bp\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 500)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"500bp\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 1000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"1kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 3000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"3kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 5000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"5kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 10000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"10kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 50000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"50kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 100000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"100kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 500000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"500kb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 1000000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"1mb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 5000000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"5mb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 10000000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"10mb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:1px; margin-right:1px;");
    span1.setAttribute("onclick", "regionChange('zoomlevel', 50000000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"50mb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("onclick", "regionChange('zoomlevel', 100000000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"100mb\",50);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("onclick", "regionChange('zoomlevel', 10000000000)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"chromosome\",80);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "|";
    //----

    var span1 = zoomdiv.appendChild(document.createElement("span"));
    span1.setAttribute("onclick", "regionChange('zoomfactor', 2.0)");
    span1.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out 2x\",80);");
    span1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    span1.innerHTML = "+";

    if(!zenbu_embedded_view) {
      // settings
      var button = navCtrlRight.appendChild(document.createElement("input"));
      button.type = "button";
      button.className = "slimbutton";
      button.onclick = function() { gLyphsGlobalSettingsPanel(glyphsGB); }
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"global view configuration settings\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "settings";
      button.value = "settings";

      // export view
      var button = navCtrlRight.appendChild(document.createElement("input"));
      button.type = "button";
      button.className = "slimbutton";
      button.onclick = function() { configureExportSVG(glyphsGB); }
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"export view to SVG image file\",80);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "export svg";
      button.value = "export svg";
    }

    // save view
    /*
    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "gLyphsSaveConfig();");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"save view configuration to collaboration\",100);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "save view";
    */

    //reload
    /*
    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('reload')");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"reload view\",80);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "reload";
    */

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.id = "zenbu_embed_toggle_button";
    button.setAttribute("style", "font-size:10px; padding: 1px 1px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "zenbu_toggle_embedded_view();");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    if(zenbu_embedded_view) { 
      button.innerHTML = "E"; 
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"switch to full ZENBU\",100);");
    } else { 
      button.innerHTML = "F";
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"switch to embedded ZENBU\",100);");
    }

    var img1 = navCtrlRight.appendChild(document.createElement("img"));
    img1.setAttribute("src", eedbWebRoot+"/images/reload.png");
    img1.setAttribute("style", "margin-bottom:-3px; margin-left:5px");
    img1.setAttribute("onclick", "regionChange('reload')");
    img1.setAttribute("onmouseover", "eedbMessageTooltip(\"reload view\",80);");
    img1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  

  glyphsGB.loc_desc = "";
  if(glyphsGB.asm && glyphsGB.chrom) {
    var asm    = glyphsGB.asm;
    var chrom  = glyphsGB.chrom;
    var start  = glyphsGB.start;
    var end    = glyphsGB.end;
    var len    = end-start+1;
    if(len > 1000000) { 
      //len = (len/1000000);
      len = Math.round(len/100000);
      len = len/10.0;
      len += "mb"; 
    }
    else if(len > 1000) { 
      //len = len/1000; 
      len = Math.round(len/100); 
      len = len/10.0;
      len += "kb";
    }
    else { len += "bp"; }
    glyphsGB.length_desc = "[len "+ len + " ]";
    
    var chromloc = chrom +" " + numberWithCommas(start) + "-" + numberWithCommas(end);
    if(glyphsGB.flip_orientation) { chromloc += "-"; } else { chromloc += "+"; }
    //glyphsGB.loc_desc = asm + ":: " + chromloc + "  [len "+ len + " ]";
    glyphsGB.loc_desc = chromloc + "  [len "+ len + " ]";
  }

  if(document.getElementById("regionWidthText")) {
    document.getElementById("regionWidthText").setAttribute('value', dwidth);
  }

  var desc = glyphsGB.loc_desc;
  if(glyphsGB.trackline_chrpos) { desc += "<span style=\'font-size:8pt; color: orangered;\'> " +glyphsGB.trackline_chrpos+ "</span>"; }
  if(glyphsGB.gLyphs_location_info) { 
    glyphsGB.gLyphs_location_info.innerHTML = desc;
  }

  gLyphsUpdateLoadingProgress(glyphsGB);
}


function gLyphsUpdateLoadingProgress(glyphsGB) {
  if(!glyphsGB) { return; }
  var glyphset = glyphsGB.gLyphTrackSet;

  //view loading progress
  var loadProgress = document.getElementById("gLyphs_load_progress_div");
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  var load_count =0;
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = glyphsGB.tracks_hash[trackID];
    if(!glyphTrack) { continue; }
    //gLyphsShowTrackLoading(trackID);
    if(!glyphTrack.hideTrack && !glyphTrack.dataLoaded) { load_count++; }
  }
  if(load_count>0 && !zenbu_embedded_view) {
    loadProgress.setAttribute("style", "margin-top:5px; margin-bottom:3px; font-size:12px; display:block; font-weight:bold; color:#F06330; font-size:14px; text-align:center; ");
    loadProgress.innerHTML = load_count+" of "+gLyphDivs.length+" tracks still loading";
  } else {
    loadProgress.setAttribute("style", "margin-top:5px; margin-bottom:3px; font-size:12px; display:none; ");
    loadProgress.innerHTML = "";
  }
}


function glyphsEditLocation(glyphsGB) {
  var asm    = glyphsGB.asm;
  var chrom  = glyphsGB.chrom;
  var start  = glyphsGB.start;
  var end    = glyphsGB.end;

  var chromloc = asm + "::" + chrom +":" + start + "-" + end;
  eedbSetSearchInput(glyphsGB.searchSetID, chromloc);
}


function gLyphsReloadRegion(glyphsGB) {
  var glyphset = glyphsGB.gLyphTrackSet;

  glyphsNavigationControls(glyphsGB);

  glyphsGB.selected_feature = undefined; //clear current feature

  var dwidth = glyphsGB.display_width;
  var asm    = glyphsGB.asm;
  var chrom  = glyphsGB.chrom;
  var start  = glyphsGB.start;
  var end    = glyphsGB.end;
  var len    = end-start+1;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }
  glyphsGB.length_desc = "[len "+ len + " ]";

  //document.getElementById("message").innerHTML = "";

  eedbShowLogin();
  zenbuDisplayFeatureInfo(); //clears

  if(document.getElementById("regionWidthText")) { 
    document.getElementById("regionWidthText").setAttribute('value', dwidth);
  }

  glyphsGetChromSequence(glyphsGB);

  // clear out the old configs
  glyphsGB.exportSVGconfig = undefined;
  glyphsGB.saveconfig = undefined;
  if(document.getElementById("global_panel_layer")) { 
    document.getElementById("global_panel_layer").innerHTML ="";
  }

  var chromloc = chrom +":" + start + "-" + end;

  glyphset.setAttribute("style", 'width: '+ (dwidth+10)+'px;');

  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    gLyphsShowTrackLoading(trackID);
  }
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    prepareTrackXHR(trackID);
  }

  if(!glyphsGB.view_config_loaded) {
    if(!current_user) {
      //if no configUUID then not a valid config or no access to it
      //assume it exists but user can not see it because they forgot to login
      gLyphsNoUserWarn("access this view configuration");
    } else {
      gLyphsGeneralWarn("This view configuration is not available.<br>"+ 
                        "It has either been deleted from the system, or you do not have privilege to access it.");
    }
  }
}


function regionChange(mode, value) {
  var asm   = current_region.asm;
  var chrom = current_region.chrom;
  var start = current_region.start;
  var end   = current_region.end;
  var range = end-start+1;
  var center = Math.round( (end+start)/2 );

  if(mode == 'redraw') {
    document.getElementById("message").innerHTML= "redraw view";
    var starttime = new Date();
    gLyphsRedrawRegion(current_region);
    var endtime = new Date();
    var runtime = (endtime.getTime() - starttime.getTime());
    document.getElementById("message").innerHTML= "total redraw time " +(runtime)+"msec";
    return;
  }
  if(mode == 'zoomfactor') {
    var offset = (range * value)/2.0;
    start = center - offset;
    end   = center + offset;
  }
  if(mode == 'zoomlevel') {
    var offset = Math.round(value/2.0);
    start = center - offset;
    end   = center + offset-1;
  }
  if(mode == '-') {
    start -= Math.round(range*0.25);
    end   += Math.round(range*0.25);
  }
  if(mode == '--') {
    start -= Math.round(range*2);
    end   += Math.round(range*2);
  }
  if(mode == '---') {
    start -= Math.round(range*4.5);
    end   += Math.round(range*4.5);
  }
  if(mode == '+') {
    start += Math.round(range/6);
    end   -= Math.round(range/6);
  }
  if(mode == '++') {
    start += Math.round(range*.4);
    end   -= Math.round(range*.4);
  }
  if(mode == '+++') {
    start += Math.round(range*.45);
    end   -= Math.round(range*.45);
  }
  if(mode == 'r') {
    start += Math.round(range*.1);
    end   += Math.round(range*.1);
  }
  if(mode == 'rr') {
    start += Math.round(range*.5);
    end   += Math.round(range*.5);
  }
  if(mode == 'l') {
    start -= Math.round(range*.1);
    end   -= Math.round(range*.1);
  }
  if(mode == 'll') {
    start -= Math.round(range*.5);
    end   -= Math.round(range*.5);
  }
  if(mode == 'reset') {
    if(current_region.selected_feature) {
      start = current_region.selected_feature.start;
      end   = current_region.selected_feature.end;
      var range = end-start;
      start -= Math.round(range*.25);
      end += Math.round(range*.25);
    }
  }
  if(mode == 'reload') {
    //coming from user interface click
    //kill all currently running track queries so they are forced to reload
    active_track_XHRs = new Object();
  }

  gLyphsSetLocation(current_region, asm, chrom, start, end);

  gLyphsReloadRegion(current_region);
  gLyphsChangeDhtmlHistoryLocation();
}


//---------------------------------------------------------
//
// widget creation section
// use svg and events to create "widgets" inside the tracks
// to allow users to manipulate the tracks
//
//---------------------------------------------------------

function createAddTrackTool(glyphsGB) {
  if(zenbu_embedded_view) { return; }
  var glyphset = glyphsGB.gLyphTrackSet;
  if(!glyphset) { return null; }

  var div_id = "glyphTrack_add_track_div_"+(glyphsGB.uuid);
  var add_track_div = document.getElementById(div_id);
  if(add_track_div) { return add_track_div; }

  var add_track_div = document.createElement('div');
  add_track_div.setAttribute("align","left");
  add_track_div.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  add_track_div.id = div_id;
  glyphset.appendChild(add_track_div);

  var svg = createSVG(300, 25);
  add_track_div.appendChild(svg);

  var defs = document.createElementNS(svgNS,'defs');
  var rg1 = document.createElementNS(svgNS,'linearGradient');
  rg1.setAttributeNS(null, 'id', 'purpLinearGradient');
  rg1.setAttributeNS(null, 'x1', '0%');
  rg1.setAttributeNS(null, 'y1', '0%');
  rg1.setAttributeNS(null, 'x2', '0%');
  rg1.setAttributeNS(null, 'y2', '100%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'style', 'stop-opacity:1; stop-color:rgb(200,200,255);');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'style', 'stop-opacity:1; stop-color:slateblue;');
  rg1.appendChild(stop2);
  svg.appendChild(defs);

  //
  // new track config
  //
  var g3 = svg.appendChild(document.createElementNS(svgNS,'g'));
  g3.onclick = function() { gLyphsAddCustomTrack(glyphsGB); }
  g3.setAttribute("onmouseover", "eedbMessageTooltip('create new custom track',150);");
  g3.setAttribute("onmouseout", "eedbClearSearchTooltip();");

  var polyback2 = document.createElementNS(svgNS,'polygon');
  polyback2.setAttributeNS(null, 'points', '0,0 130,0 130,14 65,21 0,14');
  polyback2.setAttributeNS(null, 'style', 'fill:url(#purpLinearGradient)');
  g3.appendChild(polyback2);

  var circle2 = document.createElementNS(svgNS,'circle');
  circle2.setAttributeNS(null, 'cx', '8px');
  circle2.setAttributeNS(null, 'cy', '8px');
  circle2.setAttributeNS(null, 'r',  '5px');
  circle2.setAttributeNS(null, 'fill', 'lightgray');
  g3.appendChild(circle2);

  var line2 = document.createElementNS(svgNS,'path');
  line2.setAttributeNS(null, 'd', 'M4.5 8 L11.5 8 M8 4.5 L8 11.5 ');
  line2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: darkslateblue;');
  g3.appendChild(line2);

  var label2 = document.createElementNS(svgNS,'text');
  label2.setAttributeNS(null, 'x', '20px');
  label2.setAttributeNS(null, 'y', '11px');
  label2.setAttributeNS(null, "font-size","10");
  label2.setAttributeNS(null, "fill", "black");
  label2.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label2.setAttributeNS(null, "font-weight", 'bold');
  label2.appendChild(document.createTextNode("create custom track"));
  g3.appendChild(label2);

  
  //
  // add predefined track
  //
  var g3 = svg.appendChild(document.createElementNS(svgNS,'g'));
  g3.onclick = function() { gLyphsPredefinedTracksPanel(glyphsGB); }
  g3.setAttribute("onmouseover", "eedbMessageTooltip('add predefined tracks to view',150);");
  g3.setAttribute("onmouseout", "eedbClearSearchTooltip();");

  var polyback2 = document.createElementNS(svgNS,'polygon');
  polyback2.setAttributeNS(null, 'points', '0,0 130,0 130,14 65,21 0,14');
  polyback2.setAttributeNS(null, 'style', 'fill:url(#purpLinearGradient)');
  g3.appendChild(polyback2);
  
  var circle2 = document.createElementNS(svgNS,'circle');
  circle2.setAttributeNS(null, 'cx', '8px');
  circle2.setAttributeNS(null, 'cy', '8px');
  circle2.setAttributeNS(null, 'r',  '5px');
  circle2.setAttributeNS(null, 'fill', 'lightgray');
  g3.appendChild(circle2);
  
  var line2 = document.createElementNS(svgNS,'path');
  line2.setAttributeNS(null, 'd', 'M4.5 8 L11.5 8 M8 4.5 L8 11.5 ');
  line2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: darkslateblue;');
  g3.appendChild(line2);
  
  var label2 = document.createElementNS(svgNS,'text');
  label2.setAttributeNS(null, 'x', '20px');
  label2.setAttributeNS(null, 'y', '11px');
  label2.setAttributeNS(null, "font-size","10");
  label2.setAttributeNS(null, "fill", "black");
  label2.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label2.setAttributeNS(null, "font-weight", 'bold');
  label2.appendChild(document.createTextNode("add predefined tracks"));
  g3.appendChild(label2);
  g3.setAttributeNS(null, 'transform', "translate(170, 0)");
  
  return add_track_div;
}


//---------------------------------------------------------------
//
//
// Configuration export and initialization
//
// 
//---------------------------------------------------------------


function gLyphsGB_configDOM(glyphsGB) {
  if(!glyphsGB) { return null; }
  
  var doc = document.implementation.createDocument("", "", null);

  var gbDOM = doc.createElement("eeDBgLyphsConfig");  

  var loc = doc.createElement("region");
  loc.setAttribute("asm",    glyphsGB.asm);
  loc.setAttribute("chrom",  glyphsGB.chrom);
  loc.setAttribute("start",  glyphsGB.start);
  loc.setAttribute("end",    glyphsGB.end);
  gbDOM.appendChild(loc);

  var settings = doc.createElement("settings");
  settings.setAttribute("dwidth", glyphsGB.display_width);
  if(glyphsGB.hide_compacted_tracks) { settings.setAttribute("hide_compacted", "true"); }
  if(!glyphsGB.share_exp_panel) { settings.setAttribute("share_exp_panel", "false"); }
  if(glyphsGB.exppanel_subscroll) { settings.setAttribute("exppanel_subscroll", "true"); }
  if(glyphsGB.flip_orientation) { settings.setAttribute("flip_orientation", "true"); }
  if(glyphsGB.nocache) { settings.setAttribute("global_nocache", "true"); }
  gbDOM.appendChild(settings);

  if(glyphsGB.selected_feature) { 
    var feat = doc.createElement("feature");
    //if(glyphsGB.selected_feature.getAttribute("peer")) {
    //  feat.setAttribute("peer", glyphsGB.selected_feature.getAttribute("peer"));
    //}
    feat.setAttribute("id",   glyphsGB.selected_feature.id);
    feat.setAttribute("name", glyphsGB.selected_feature.name);
    gbDOM.appendChild(feat);
  }  

  var tracks = doc.createElement("gLyphTracks");
  tracks.setAttribute("next_trackID", newTrackID);
  gbDOM.appendChild(tracks);

  var glyphset = glyphsGB.gLyphTrackSet;
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = glyphsGB.tracks_hash[trackID];
    if(!glyphTrack) { continue; }
    
    var trackDOM = glyphsGenerateTrackDOM(glyphTrack);
    tracks.appendChild(trackDOM);
  }

  return gbDOM;
}


function gLyphsInitViewConfigUUID(configUUID) {
  //given a configUUID, queries the config_server for full XML info.
  //if available, then it parses the XML and reconfigures the view
  //return value is true/false depending on success of reconfig

  if(current_region.configUUID == configUUID) { return true; }
  current_region.configUUID = configUUID; //make sure to set to we can reload if it fails

  var id = configUUID + ":::Config";
  var config = eedbFetchObject(id);
  if(!gLyphsInitFromViewConfig(config)) { return false; }

  return true;
}


function gLyphsInitConfigBasename(basename) {
  var url = eedbConfigCGI + "?configtype=view;basename=" + basename;
  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  configXHR.open("GET",url,false); //synchronous, wait until returns
  configXHR.send(null);
  if(configXHR.readyState!=4) { return false; }
  if(configXHR.responseXML == null) { return false; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null) { return false; }

  if(xmlDoc.tagName != "configuration") { return false; }
  var config = eedbParseConfigurationData(xmlDoc);

  if(!gLyphsInitFromViewConfig(config)) { return false; }

  return true;
}


function gLyphsInitFromViewConfig(config) {
  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var main_div = document.getElementById("genome_region_div");  //TODO: need to change this to dynamic eventually
  if(!main_div) { return; }

  if(!config) { return false; }
  if(!config.uuid) {
    current_region.view_config_loaded = false;
    return false;
  }
  console.log("gLyphsInitFromViewConfig "+config.uuid);

  //
  // make a new clean genomeBrowser and then init
  //
  current_region = new ZenbuGenomeBrowser(main_div);

  current_dragTrack = undefined;
  currentSelectTrackID =undefined;
  
  //active_track_XHRs = new Object();
  //pending_track_XHRs = new Object();
  //newTrackID = 100;

  //current_region = new Object();
  //current_region.selected_feature = undefined;
  //current_region.display_width = gLyphsInitParams.display_width;
  //current_region.asm = "hg18";
  //current_region.configname = "eeDB gLyphs";
  //current_region.desc = "";
  //current_region.exppanel_subscroll = false;
  //current_region.express_sort_mode = 'name';
  //current_region.flip_orientation = false;
  //current_region.highlight_search = "";
  //current_region.tracks_hash = new Object();
  //main_div.innerHTML="";
  //current_region.main_div = main_div;
  //current_region.gLyphTrackSet = main_div.appendChild(document.createElement('div'));
  //current_region.expPanelFrame = main_div.appendChild(document.createElement('div'));
  //gLyphsSearchInterface(current_region);
  
  if(config.uuid) { 
    current_region.configUUID = config.uuid;
  } else {
    //if no configUUID then not a valid config
    current_region.view_config_loaded = false;
    //gLyphsNoUserWarn("access this view configuration");
    return false;
  }

  var configDOM = config.configDOM;
  if(!configDOM) {
    current_region.view_config_loaded = false;
    return false;
  }

  if(configDOM.getElementsByTagName("settings")) {
    var settings = configDOM.getElementsByTagName("settings")[0];
    if(settings) {
      if(settings.getAttribute("dwidth")) {
        current_region.display_width = parseInt(settings.getAttribute("dwidth"));
      }
      if(settings.getAttribute("hide_compacted") == "true") {
        current_region.hide_compacted_tracks = true;
      } else {
        current_region.hide_compacted_tracks = false;
      }
      if(settings.getAttribute("share_exp_panel") == "false") { //default is true
        current_region.share_exp_panel = false;
      }
      if(settings.getAttribute("exppanel_subscroll") == "true") {
        current_region.exppanel_subscroll = true;
      } else {
        current_region.exppanel_subscroll = false;
      }
      if(settings.getAttribute("flip_orientation") == "true") {
        current_region.flip_orientation = true;
      } else {
        current_region.flip_orientation = false;
      }
      if(settings.getAttribute("global_nocache") == "true") {
        current_region.nocache = true;
      } else {
        current_region.nocache = false;
      }
    }
  }

  //--------------------------------
  eedbEmptySearchResults(current_region.searchSetID);

  current_region.view_config_loaded = true;
  current_region.view_config = config;;
  current_region.config_createdate = config.create_date;
  current_region.configname = config.name;
  current_region.desc = config.description;
  if(config.author) {
    current_region.config_creator = config.author;
  } else {
    current_region.config_creator = config.owner_openID;
  }
  gLyphsShowConfigInfo();

  //
  // now parse the actual configDOM for tracks and sources
  // 
  var features = configDOM.getElementsByTagName("feature");
  if(features && (features.length>0)) {
    var featureXML = features[0];
    var fid   = featureXML.getAttribute("id");
    var peer  = featureXML.getAttribute("peer");
    if(peer) { fid = peer +"::"+ fid; }
    //gLyphsLoadObjectInfo(fid);
  }

  //old system where the expression panel sort mode was a global variable, now need to set per-track
  //if view was saved with old style, now need to set per track.
  var global_express_sort_mode = null;
  var expexps = configDOM.getElementsByTagName("experiment_expression");
  if(expexps && (expexps.length>0)) {
    var expexp = expexps[0];
    global_express_sort_mode = expexp.getAttribute("exp_sort");
    console.log("config has global_express_sort_mode: "+global_express_sort_mode);
  }

  var glyphset = current_region.gLyphTrackSet;
  clearKids(glyphset);

  var trackset = configDOM.getElementsByTagName("gLyphTracks");
  if(!trackset) { return false; }

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];

    var glyphTrack = gLyphsCreateTrackFromTrackDOM(trackDOM, current_region);
    if(!glyphTrack) { continue; }
    //if(global_express_sort_mode && (!glyphTrack.express_sort_mode)) { 
    //TODO: maybe only apply to the active track to mimic the old system behaviour
    //  glyphTrack.express_sort_mode = global_express_sort_mode; 
    //}
    current_region.tracks_hash[glyphTrack.trackID] = glyphTrack;
    glyphset.appendChild(glyphTrack.trackDiv);

    gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
  }
  createAddTrackTool(current_region);
  
  if(configDOM.getElementsByTagName("region")) {
    var region = configDOM.getElementsByTagName("region")[0];
    if(region) {
      gLyphsSetLocation(current_region, region.getAttribute("asm"),
                        region.getAttribute("chrom"),
                        parseInt(region.getAttribute("start")),
                        parseInt(region.getAttribute("end")));
    }
  }

  gLyphsInitSearchFromTracks(current_region);

  return true;;
}



//
//======================================================================================
//

function gLyphsAppendTracksViaTrackSet(template) {
  if(!template) { return false; }
  if(!template.source_ids) { return false; }
  var dexMode = template.dexMode;
  
  var id = template.tracksetUUID + ":::Config";

  var config = eedbFetchObject(id);
  if(!config) { return false; }
  var configDOM = config.configDOM;
  if(!configDOM) { return false; }

  //--------------------------------
  // now parse the actual configDOM for tracks and sources
  if(!dexMode) {
    var glyphset = current_region.gLyphTrackSet;
    var newtrack_div = glyphset.lastChild;
  }

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];

    var glyphTrack = gLyphsCreateTrackFromTrackDOM(trackDOM, current_region);
    if(!glyphTrack) { continue; }
    glyphTrack.hideTrack  = false;
    //replace sources with those from templage
    glyphTrack.source_ids     = template.source_ids;
    glyphTrack.exptype        = template.exptype;
    glyphTrack.source_outmode = template.source_outmode;
    
    //retitle the track
    glyphTrack.title = template.title + " " + glyphTrack.title;

    //add into view
    current_region.tracks_hash[glyphTrack.trackID] = glyphTrack;

    if(!dexMode) {
      glyphset.insertBefore(glyphTrack.trackDiv, newtrack_div);
      gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
      prepareTrackXHR(glyphTrack.trackID);
    }
  }
  
  removeTrack(template.trackID); //removing the template track
  if(!dexMode) { 
    gLyphsInitSearchFromTracks(current_region);
    gLyphsAutosaveConfig();
  }
  return true;
}

//
//======================================================================================
//

function gLyphsSearchInterface(glyphsGB) {
  if(zenbu_embedded_view) { return; }
  if(!glyphsGB) { return; }
  if(!glyphsGB.main_div) { return; }
  
  if(!glyphsGB.searchFrame) { 
    glyphsGB.searchFrame = document.createElement('div');
    if(glyphsGB.main_div.firstChild) {
      glyphsGB.main_div.insertBefore(glyphsGB.searchFrame, glyphsGB.main_div.firstChild);
    } else {
      glyphsGB.main_div.appendChild(glyphsGB.searchFrame);
    }
  }
  
  var searchFrame = glyphsGB.searchFrame;
  glyphsGB.searchSetID = glyphsGB.uuid+"_searchset";
  searchFrame.innerHTML = "";
  
  var form = searchFrame.appendChild(document.createElement('form'));
  form.setAttribute("onsubmit", "return false;");

  var span1 = form.appendChild(document.createElement('span'));
  span1.setAttribute("onclick", "eedbClearSearchResults('"+glyphsGB.searchSetID+"')");
  
  var searchInput = form.appendChild(document.createElement("input"));
  searchInput.id = glyphsGB.searchSetID+"_inputID";
  searchInput.type = "text";
  searchInput.className = "sliminput";
  searchInput.autocomplete = "off";
  searchInput.setAttribute("onkeyup", "glyphsMainSearchInput('"+glyphsGB.searchSetID+"', this.value, event)");

  var buttonSpan = form.appendChild(document.createElement('span'));
  var button1 = buttonSpan.appendChild(document.createElement('input'));
  button1.type = "button";
  button1.className = "slimbutton";
  button1.value = "search";
  button1.setAttribute("onclick", "glyphsMainSearchInput('"+glyphsGB.searchSetID+"', '', event)");

  var button2 = buttonSpan.appendChild(document.createElement('input'));
  button2.type = "button";
  button2.className = "slimbutton";
  button2.value = "clear";
  button2.setAttribute("onclick", "eedbClearSearchResults('"+glyphsGB.searchSetID+"')");
  
  var searchSet = searchFrame.appendChild(document.createElement("div"));
  searchSet.id = glyphsGB.searchSetID;
  searchSet.default_message = "search for annotations (eg EGR1 or kinase) or set location (eg: chr19:36373808-36403118)";

  var msgDiv = searchSet.appendChild(document.createElement("div"));
  msgDiv.id = glyphsGB.searchSetID+"_messageID";
  
  //set width
  var buttonsRect = buttonSpan.getBoundingClientRect();
  console.log("search buttons width: "+buttonsRect.width);
  console.log("search_input width: "+(glyphsGB.display_width - buttonsRect.width));
  searchInput.style.width = ((glyphsGB.display_width - buttonsRect.width)*0.80) +"px"; //glyphsGB.display_width;
  searchInput.style.margin = "0px 0px 5px 0px";
  
  eedbClearSearchResults(glyphsGB.searchSetID);
}


function gLyphsInitSearchFromTracks(glyphsGB) {
  if(!glyphsGB) { return; }
  var searchSetID = glyphsGB.searchSetID;

  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  clearKids(searchset);

  var glyphset = glyphsGB.gLyphTrackSet;
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = glyphsGB.tracks_hash[trackID];
    if(!glyphTrack) { continue; }
    if(glyphTrack.noNameSearch) { continue; }
    if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot") { continue; }
    if(glyphTrack.glyphStyle == "split-signal") { continue; }
    if(glyphTrack.glyphStyle == "cytoband") { continue; }
    if(!glyphTrack.source_ids) { continue; }
    //for now only modern tracks with source_ids will be allowed

    var searchTrack = eedbAddSearchTrack(searchSetID, glyphTrack.source_ids, glyphTrack.title);
    if(searchTrack) {
      searchTrack.glyphsGB = glyphTrack.glyphsGB;
      searchTrack.trackID = glyphTrack.trackID;
      searchTrack.callOutFunction = gLyphsMainSearchResponse; 
    }
  }
}


function gLyphsMainSearchResponse(searchID, objID, mode) {
  var searchTrack = eedbSearchGetSearchTrack(searchID);
  if(!searchTrack) { return; }
  var glyphsGB = searchTrack.glyphsGB;
  console.log("gLyphsMainSearchResponse "+searchTrack.trackID+" fid:"+objID);
  eedbClearSearchTooltip();

  var object = eedbGetObject(objID); //uses searchCache first
  if(!object) { return; }

  //eedbClearSearchResults(searchTrack.searchSetID);
  if(object.classname == "Feature") {
    console.log("selected feature "+object.name+" "+object.chromloc);
    current_region.selected_feature = object;
    gLyphsCenterOnFeature(glyphsGB, object);
  }
}


function glyphsMainSearchInput(searchSetID, str, e) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  
  var searchInput = document.getElementById(searchSetID + "_inputID");
  if(searchInput.show_default_message) { return; }

  if(!str) {
    if(searchInput) { str = searchInput.value; }
  }
  str = trim_string(str);
  if(!str) {
    eedbClearSearchResults(searchSetID);
    return;
  }

  if(gLyphsParseLocation(str, current_region)) { 
    var charCode;
    if(e && e.which) charCode=e.which;
    else if(e) charCode = e.keyCode;
    if((charCode==13) || (e.button==0)) { 
      gLyphsInitLocation(current_region, str);
      gLyphsReloadRegion(current_region); 
      gLyphsChangeDhtmlHistoryLocation();
    }
    eedbEmptySearchResults(searchSetID);
    return;
  }

  eedbEmptySearchResults(searchSetID);

  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");
  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];
    searchDiv.exact_match_autoclick = false;
    if(current_region.init_search_term) { searchDiv.exact_match_autoclick = true; }
    eedbSearchSpecificDB(searchSetID, str, e, searchDiv);
  }
}

function eedbSearchGlobalCalloutClick(id) {}
function singleSearchValue() { }



//----------------------------------------------------
// 
// visualization save/print to SVG
//
//----------------------------------------------------

function configureExportSVG(glyphsGB) {  
  if(!glyphsGB) { return; }
  if(!glyphsGB.navCtrls) { return; }
  
  var divFrame = glyphsGB.settings_panel;
  if(!divFrame) { 
    divFrame = document.createElement('div'); 
    glyphsGB.settings_panel = divFrame;
  }
  glyphsGB.navCtrls.appendChild(glyphsGB.settings_panel);
  
  var navRect = glyphsGB.navCtrls.getBoundingClientRect();
    
  divFrame.setAttribute('style', "position:absolute; text-align:left; padding: 3px 3px 3px 3px; " 
                                +"background-color:rgb(235,235,240); "  
                                +"border:2px solid #808080; border-radius: 4px; "
                                +"left:"+(navRect.left+glyphsGB.display_width-370)+"px; "
                                +"top:"+(navRect.top+20)+"px; "
                                +"width:350px; z-index:90; "
                             );
  divFrame.innerHTML = "";
  var tdiv, tdiv2, tspan1, tspan2, tinput, tcheck;

  var exportConfig = glyphsGB.exportSVGconfig;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.onclick = function() { exportSVGConfigParam(glyphsGB, 'svg-cancel'); return false; }
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //title
  tdiv = document.createElement('div');
  tdiv.style = "font-weight:bold; font-size:14px; padding: 5px 0px 5px 0px;"
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Export view as SVG image";
  divFrame.appendChild(tdiv);

  //----------
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv2 = tdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "float:left; width:200px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig && exportConfig.hide_widgets) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { exportSVGConfigParam(glyphsGB, 'widgets', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide widgets";

  tdiv2 = tdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig && exportConfig.savefile) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { exportSVGConfigParam(glyphsGB, 'savefile', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "save to file";

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig && exportConfig.hide_sidebar) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { exportSVGConfigParam(glyphsGB, 'sidebar', this.checked); }
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide track sidebars";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig && exportConfig.hide_titlebar) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { exportSVGConfigParam(glyphsGB, 'titlebar', this.checked); }
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide title bar";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig && exportConfig.hide_experiment_graph) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { exportSVGConfigParam(glyphsGB, 'experiments', this.checked); }
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide experiment/expression graph";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig && exportConfig.hide_compacted_tracks) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { exportSVGConfigParam(glyphsGB, 'compacted_tracks', this.checked); }
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide compacted tracks";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.type = "button";
  button1.className = "medbutton";
  button1.value = "cancel";
  button1.style.float = "left"; 
  button1.onclick = function() { exportSVGConfigParam(glyphsGB, 'svg-cancel'); }
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.type = "button";
  button2.className = "medbutton";
  button2.value = "export svg";
  button2.style.float = "right"; 
  button2.onclick = function() { exportSVGConfigParam(glyphsGB, 'svg-accept'); }
  divFrame.appendChild(button2);
}


function exportSVGConfigParam(glyphsGB, param, value) {
  if(!glyphsGB) { return; }

  if(param == "svg-cancel") {
    if(glyphsGB.settings_panel && glyphsGB.navCtrls) {
      glyphsGB.navCtrls.removeChild(glyphsGB.settings_panel);
      glyphsGB.settings_panel = null;
    }
    if(glyphsGB.exportSVGconfig) {
      //need to redraw everything in case user caused track to draw without events while panel was open
      console.log("glyphsGB.exportSVGconfig so need to clear and redraw");
      glyphsGB.exportSVGconfig = undefined;
      gLyphsRedrawRegion(glyphsGB);
    }
    return;
  }
  
  if(glyphsGB.exportSVGconfig == undefined) {
    glyphsGB.exportSVGconfig = new Object;
    glyphsGB.exportSVGconfig.title = glyphsGB.configname;
    glyphsGB.exportSVGconfig.savefile = false;
    glyphsGB.exportSVGconfig.hide_widgets = false;
    glyphsGB.exportSVGconfig.savefile = false;
    glyphsGB.exportSVGconfig.hide_sidebar = false;
    glyphsGB.exportSVGconfig.hide_titlebar = false;
    glyphsGB.exportSVGconfig.hide_experiment_graph = false;
    glyphsGB.exportSVGconfig.hide_compacted_tracks = false;
  }
  var exportSVGconfig = glyphsGB.exportSVGconfig;

  if(param == "widgets") { exportSVGconfig.hide_widgets = value; }
  if(param == "savefile") { exportSVGconfig.savefile = value; }
  if(param == "sidebar") { exportSVGconfig.hide_sidebar = value; }
  if(param == "titlebar") { exportSVGconfig.hide_titlebar = value; }
  if(param == "experiments") { exportSVGconfig.hide_experiment_graph = value; }
  if(param == "compacted_tracks") { exportSVGconfig.hide_compacted_tracks = value; }

  if(param == "name") { exportSVGconfig.name = value; }
  if(param == "desc")  { exportSVGconfig.desc = value; }

  if(param == "svg-accept") {
    gLyphsPostSVG(glyphsGB);
  }
}


function gLyphsPostSVG(glyphsGB) {
  if(!glyphsGB) { return; }
  if(!glyphsGB.settings_panel) { return; }
  if(!glyphsGB.exportSVGconfig) { return; }

  var savefile = glyphsGB.exportSVGconfig.savefile;

  var xml = generateSvgXML(glyphsGB);

  glyphsGB.settings_panel.innerHTML = "";
  var form = glyphsGB.settings_panel.appendChild(document.createElement('form'));
  form.setAttribute("method", "POST");
  form.setAttribute("target", "glyphs_svg_export");
  form.setAttribute("action", eedbEchoSvgCGI);
  form.setAttribute("enctype", "multipart/form-data");

  var input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "mode");
  input1.setAttribute("value", "draw_svg");

  var input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "title");
  input1.setAttribute("value", glyphsGB.configname);

  var input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "description");
  input1.setAttribute("value", glyphsGB.desc);

  input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "savefile");
  input1.setAttribute("value", savefile);

  input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "svg");
  input1.setAttribute("value", xml);

  form.submit();

  glyphsGB.navCtrls.removeChild(glyphsGB.settings_panel);
  glyphsGB.settings_panel = null;
}


function generateSvgXML(glyphsGB) {
  if(!glyphsGB) { return null; }
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  if(!glyphsGB.exportSVGconfig) { 
    glyphsGB.exportSVGconfig = new Object;
    glyphsGB.exportSVGconfig.title = glyphsGB.configname;
    glyphsGB.exportSVGconfig.savefile = false;
  }

  var serializer = new XMLSerializer();

  var text = "";
  //var text = "<?xml version=\"1.0\" standalone=\"no\"?>\n";
  //text += "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
  //text += "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"100%\" width=\""+ (glyphsGB.display_width+30) +"\" >\n";
  text += "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"100%\" width=\"100%\" >\n";

  var activeTrack = glyphsTrack_global_track_hash[glyphsGB.active_trackID];

  var export_g1 = document.createElementNS(svgNS,'g');

  var exp_g1;
  if(!glyphsGB.exportSVGconfig.hide_experiment_graph) { 
    var exp_g1 = document.createElementNS(svgNS,'g');
    
    var header_g = gLyphsExpressionPanelHeader(activeTrack);
    exp_g1.appendChild(header_g);
    
    var graph_g1 = gLyphsRenderExpressionPanelGraph(activeTrack);
    graph_g1.setAttributeNS(svgNS, 'transform', "translate(0,30)");
    exp_g1.appendChild(graph_g1);
  }

  var track_ypos = 0;

  var glyphset = glyphsGB.gLyphTrackSet;
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = glyphsGB.tracks_hash[trackID];
    if(!glyphTrack) { continue; }
    if(glyphTrack.hideTrack && glyphsGB.exportSVGconfig.hide_compacted_tracks) { continue; }

    gLyphsRenderTrack(glyphTrack);
    gLyphsDrawTrack(glyphTrack.trackID);

    var track_g1 = glyphTrack.top_group;
    if(track_g1) { 
      export_g1.appendChild(track_g1);

      track_g1.setAttributeNS(null, 'transform', "translate(10,"+ track_ypos  + ")");
      track_ypos += 1+ glyphTrack.svg_height;
    }
  }
  if(exp_g1) {
    export_g1.appendChild(exp_g1);
    gLyphsDrawExpressionPanel(glyphsGB);
    //gLyphsDrawExperimentExpression();
    exp_g1.setAttributeNS(null, 'transform', "translate(10,"+ track_ypos  + ")");
    //exp_g1.setAttributeNS(null, "x", "10px");
    //exp_g1.setAttributeNS(null, "y", track_ypos + "px");
    //text += serializer.serializeToString(exp_g1);
  }

  text += serializer.serializeToString(export_g1);

  text += "</svg>\n";

  //remove the exportSVGconfig and redraw the interactive view
  glyphsGB.exportSVGconfig = undefined;
  gLyphsRedrawRegion(glyphsGB);

  return text;
}


//----------------------------------------------------
// 
// global settings panel
//
//----------------------------------------------------

function gLyphsGlobalSettingsPanel(glyphsGB) {
  if(!glyphsGB) { return; }
  
  var divFrame = glyphsGB.settings_panel;
  if(!divFrame) { 
    divFrame = document.createElement('div'); 
    glyphsGB.settings_panel = divFrame;
  }
  glyphsGB.navCtrls.appendChild(glyphsGB.settings_panel);

  var navRect = glyphsGB.navCtrls.getBoundingClientRect();

  divFrame.setAttribute('style', "position:absolute; text-align:left; padding: 3px 3px 10px 3px; " 
                                + "background-color:rgb(235,235,240); "  
                                + "border:2px solid #808080; border-radius: 4px; "
                                +"left:"+(navRect.left+glyphsGB.display_width-430)+"px; "
                                +"top:"+(navRect.top+20)+"px; "
                                +"width:350px; z-index:90; "
                             );
  divFrame.innerHTML = "";
  var tdiv, tdiv2, tspan1, tspan2, tinput, tcheck;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.onclick = function() { gLyphsChangeGlobalSetting(glyphsGB, 'close'); return false; }
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");


  //title
  tdiv = document.createElement('div');
  tdiv.style = "font-weight:bold; font-size:14px; padding: 5px 0px 5px 0px;"
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "ZENBU genome browser settings";
  divFrame.appendChild(tdiv);

  var leftdiv = divFrame.appendChild(document.createElement('div'));
  leftdiv.setAttribute('style', "float:left; width:170px;");

  var rightdiv = divFrame.appendChild(document.createElement('div'));

  //display width
  tdiv = leftdiv.appendChild(document.createElement('div'));
  var span1 = tdiv.appendChild(document.createElement("span"));
  span1.setAttribute("style", "margin-left:7px; font-size:10px;");
  span1.innerHTML = "display width:";
  var widthInput = tdiv.appendChild(document.createElement("input"));
  widthInput.id = "regionWidthText";
  widthInput.className = "sliminput";
  widthInput.setAttribute("type", "text");
  widthInput.setAttribute("size", "5");
  widthInput.setAttribute("style", "font-size:10px;");
  widthInput.setAttribute("value", glyphsGB.display_width);
  widthInput.onkeyup = function(evt) { 
    //console.log("width onkeyup value["+(this.value)+"]");
    //console.log("event.keyCode :"+(evt.keyCode));
    if(evt.keyCode==13) { gLyphsChangeGlobalSetting(glyphsGB, 'dwidth', this.value); } 
  }

  //----------
  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(glyphsGB.hide_compacted_tracks) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { gLyphsChangeGlobalSetting(glyphsGB, 'compacted_tracks', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide compacted tracks";

  //----------
  tdiv2 = leftdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(glyphsGB.flip_orientation) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { gLyphsChangeGlobalSetting(glyphsGB, 'flip_orientation', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "flip strand orientation";

  tdiv2 = leftdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(glyphsGB.share_exp_panel) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { gLyphsChangeGlobalSetting(glyphsGB, 'share_exp_panel', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "share experiment panel";

  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(glyphsGB.auto_flip) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { gLyphsChangeGlobalSetting(glyphsGB, 'auto_flip', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "auto flip to centered feature";

  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(glyphsGB.nocache) { tcheck.setAttribute('checked', "checked"); }
  tcheck.onclick = function() { gLyphsChangeGlobalSetting(glyphsGB, 'nocache', this.checked); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "global no caching";

  //feature highligh search
  divFrame.appendChild(document.createElement('p')); //to break up the left:float

  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:100%; margin:3px 0px 0px 7px; font-size:10px;");
  var span1 = tdiv.appendChild(document.createElement("span"));
  span1.setAttribute("style", "font-size:10px;");
  span1.innerHTML = "feature highlight search: ";
  var widthInput = tdiv.appendChild(document.createElement("input"));
  widthInput.className = "sliminput";
  widthInput.setAttribute("type", "text");
  widthInput.setAttribute("style", "font-size:10px; width:180px;");
  widthInput.setAttribute("value", glyphsGB.highlight_search);
  widthInput.onkeyup = function(evt) {
    if(evt.keyCode==13) { gLyphsChangeGlobalSetting(glyphsGB, 'highlight_search', this.value); }
  }
}


function gLyphsChangeGlobalSetting(glyphsGB, param, value) {
  if(!glyphsGB) { return; }
  
  var need_to_reload = false;

  if(param =="dwidth") {
    var new_width = Math.floor(value);
    if(new_width < 640) { new_width=640; }
    if(new_width != glyphsGB.display_width) { need_to_reload = true; }
    glyphsGB.display_width = new_width;
    gLyphsInitParams.display_width = new_width;
    gLyphsSearchInterface(glyphsGB);
  }
  if(param =="compacted_tracks") {
    glyphsGB.hide_compacted_tracks = value;
    need_to_reload = true;    
  }
  if(param =="flip_orientation") {
    glyphsGB.flip_orientation = value;
    need_to_reload = true;    
    gLyphsChangeDhtmlHistoryLocation();
  }
  if(param =="auto_flip") {
    glyphsGB.auto_flip = value;
  }
  if(param =="nocache") {
    glyphsGB.nocache = value;
  }
  if(param =="highlight_search") {
    glyphsGB.highlight_search = value;
    gLyphsChangeDhtmlHistoryLocation();
    gLyphsRedrawRegion(glyphsGB);
  }
  if(param =="share_exp_panel") {
    glyphsGB.share_exp_panel = value;
    if(value) { 
      glyphsGB.expPanelFrame.style.display = "block";
      //hide the track specific expPanel
      for(var trackID in glyphsGB.tracks_hash) {
        var glyphTrack = glyphsGB.tracks_hash[trackID];
        if(!glyphTrack) { continue; }
        if(glyphTrack.expPanelActive && glyphTrack.exp_panel_frame) {
          glyphTrack.exp_panel_frame.style.display = "none";
        }
        glyphTrack.expPanelActive = false;
      }  
      gLyphsUpdateTrackTitleBars(glyphsGB);
    }
    else { glyphsGB.expPanelFrame.style.display = "none"; }
  }

  if(param == "close") { 
    if(glyphsGB.settings_panel && glyphsGB.navCtrls) {
      glyphsGB.navCtrls.removeChild(glyphsGB.settings_panel);
      glyphsGB.settings_panel = null;
    }
  }

  if(need_to_reload) { gLyphsReloadRegion(glyphsGB); }
}


//----------------------------------------------------
// 
//
// track interactive configuration tool section
//
//
//----------------------------------------------------


function gLyphsAddCustomTrack(glyphsGB) {
  //the purpose of this method is to convert the "add track" div
  //into a new glyphTrack, create the glyphTrack object
  //and setup the track for configuration

  console.log("gLyphsAddCustomTrack");
  //var trackDiv = document.getElementById(trackID);
  //if(!trackDiv) { return; }
  //trackDiv.setAttribute("class", "gLyphTrack");

  var glyphTrack = new ZenbuGlyphsTrack(glyphsGB);
  glyphsGB.tracks_hash[glyphTrack.trackID] = glyphTrack;
  glyphTrack.title = "new track "+glyphTrack.trackID;

  //glyphTrack.trackDiv.innerHTML = "<h3>this is a new track, is it working?</h3>";
  
  //configureNewTrack(glyphTrack);

  createAddTrackTool(glyphsGB); //probably don't need but just in case
  var add_track_div = document.getElementById("glyphTrack_add_track_div_"+(glyphsGB.uuid));

  //insert new trackDiv before the"add" button div
  glyphsGB.gLyphTrackSet.insertBefore(glyphTrack.trackDiv, add_track_div);
  
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
  gLyphsTrackToggleSubpanel(glyphTrack.trackID, 'reconfig');
  gLyphsChangeActiveTrack(glyphTrack);
}


/*
function gLyphsMenuHover(item, mode) {
  var spanstyle = "line-height:2em; padding:5px 10px 5px 10px; ";
  var bckimg    = " background-image:url("+eedbWebRoot+"/images/subnav_bg.gif); ";

  if(mode == "in") {
    item.setAttribute("style", spanstyle + "background-color:rgb(245,222,179); color:black;");
  }
  if(mode == "out") {
    item.setAttribute("style", spanstyle + "background-color:rgb(245,222,179); color:#6E6E6E;");
  }
  if(mode == "selected") {
    item.setAttribute("style", spanstyle + "color:black; border-bottom: 1px solid #806060; background-color:rgb(245,234,213); ");
  }
}
*/
/*
function configureNewTrack(glyphTrack) {
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  glyphTrack.newconfig = new Object;
  glyphTrack.newconfig.species_search = true;
  glyphTrack.newconfig.spstream_mode  = "none";

  trackDiv.setAttribute("style", "background-color: wheat; padding:5px 5px 5px 5px; margin-top:3px;");

  clearKids(trackDiv);

  glyphTrack.sourceHash = new Object();

  var tdiv, tdiv2, tspan, tlabel;

  //close button
  tdiv = trackDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'cancel-new'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  var d1 = trackDiv.appendChild(document.createElement('div'));
  d1.setAttribute("style", "float:right; margin-right:6px; font-size:9px; font-family:arial,helvetica,sans-serif; color:orange; ");
  d1.innerHTML = glyphTrack.trackID;

  var tdiv = trackDiv.appendChild(document.createElement('div'));
  var p1 = tdiv.appendChild(document.createElement('span'));
  p1.setAttribute("style", "font-size:16px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  p1.innerHTML ="configure custom track";

  //------ modes
  var spanstyle = "line-height:2em; padding:5px 10px 5px 10px; ";
  var bckimg    = " background-image:url("+eedbWebRoot+"/images/subnav_bg.gif); ";

  var modeSpan = tdiv.appendChild(document.createElement('span'));
  modeSpan.setAttribute('style', "margin: 4px 0px 5px 10px; background-repeat:repeat-x; white-space:nowrap; "+
                        "line-height:2em; color:#FFFFFF; font-weight:bold; "+
                        "font-family:Verdana, Arial, Helvitica, sans-serif; text-decoration:none; font-size:10px;");

  //----------
  span1 = modeSpan.appendChild(document.createElement('span'));
  if(glyphTrack.createMode == "single") {
    span1.setAttribute("style", spanstyle+"color:black; border-bottom: 1px solid #806060; background-color:rgb(245,234,213); ");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Views');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'createMode', 'single');");
  } else {
    span1.setAttribute("style", spanstyle+"background-color:rgb(245,222,179); color:#6E6E6E;");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'out');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'createMode', 'single');");
  }
  span1.innerHTML = "single track mode";

  span1 = modeSpan.appendChild(document.createElement('span'));
  span1.setAttribute("style", "border-right: 2px solid #806060; padding:5px 0px 5px 0px; line-height:2em; ");
  span1.innerHTML = "";

  //----------
  span1 = modeSpan.appendChild(document.createElement('span'));
  if(glyphTrack.createMode == "trackset") {
    span1.setAttribute("style", spanstyle+"color:black; border-bottom: 1px solid #806060; background-color:rgb(245,234,213); ");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'createMode', 'trackset');");
  } else {
    span1.setAttribute("style", spanstyle+"background-color:rgb(245,222,179); color:#6E6E6E;");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'out');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'createMode', 'trackset');");
  }
  span1.innerHTML = "track-set mode";

  //---------
  trackDiv.appendChild(document.createElement('hr'));

  //
  //---------------------------------------------------------------------------------
  //
  var sourceSearchDiv = document.createElement('div');
  sourceSearchDiv.id = glyphTrack.trackID + "_sources_search_div";
  trackDiv.appendChild(sourceSearchDiv);
  if(glyphTrack.dexMode) {
    gLyphsTrackBuildSourcesInfoDiv(glyphTrack.trackID);
  } else {
    gLyphsTrackBuildSourcesSearchDiv(glyphTrack.trackID);
  }
  
  //
  //---------------------------------------------------------------------------------
  //
  if(glyphTrack.createMode == "single") {
    var streamDiv = document.createElement('div');
    streamDiv.id = glyphTrack.trackID + "_streamprocessDiv";
    trackDiv.appendChild(streamDiv);
    buildStreamProcessDiv(glyphTrack);

    //---------------------------------------------------------------------------------
    trackDiv.appendChild(document.createElement('hr'));
    var labelVisual = document.createElement('div');
    labelVisual.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
    labelVisual.innerHTML ="Visualization";
    trackDiv.appendChild(labelVisual);

    //----------
    var div1 = trackDiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "title:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id = glyphTrack.trackID + "_newtrack_title";
    titleInput.className = "sliminput";
    titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', glyphTrack.title);
    titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'title', this.value);");

    //
    // glyphStyle
    //
    var glyphSelect = createGlyphstyleSelect(glyphTrack);
    trackDiv.appendChild(glyphSelect);
    
  } else { //trackset mode
    //---------------------------------------------------------------------------------
    trackDiv.appendChild(document.createElement('hr'));
    var label = trackDiv.appendChild(document.createElement('div'));
    label.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
    label.innerHTML ="TrackSet easy-config";

    var desc = trackDiv.appendChild(document.createElement('div'));
    desc.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan = desc.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "font-weight:bold;");
    tspan.innerHTML = "Trackset mode "
    tspan = desc.appendChild(document.createElement('span'));
    tspan.innerHTML = "is designed to make it easy to visualize and process your data in different ways to explore different aspects of your experiments. "+
                      "First select a collection/pool of experimental data which you have previously uploaded by searching and selectiong in the ";
    tspan = desc.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "font-weight:bold;");
    tspan.innerHTML = "Data sources "
    tspan = desc.appendChild(document.createElement('span'));
    tspan.innerHTML = "section above. Then select the type of experiments which these represent from the pulldown below. Push ";
    tspan = desc.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "font-weight:bold;");
    tspan.innerHTML = "<accept config> "
    tspan = desc.appendChild(document.createElement('span'));
    tspan.innerHTML = "at the bottom and ZENBU will configure multiple tracks. Afterwards, you can modify the tracks using the track reconfiguration panel";

    var tracksetDiv = trackDiv.appendChild(document.createElement('div'));
    tracksetDiv.setAttribute("style", "margin-top:10px; ");
    var span1 = tracksetDiv.appendChild(document.createElement('span'));
    span1.setAttribute("style", "margin-left:30px; ");
    span1.innerHTML = "trackset experimental data type :"
    var modeSelect = tracksetDiv.appendChild(document.createElement('select'));
    modeSelect.className = "dropdown";
    modeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'tracksetUUID', this.value);");
    modeSelect.setAttribute("style", "margin-left:3px; ");

    var option;
    for(var tsName in gLyphsTrackSetDefs) {
      var uuid = gLyphsTrackSetDefs[tsName];
      option = modeSelect.appendChild(document.createElement('option'));
      option.setAttribute("value", uuid);
      option.innerHTML = tsName;
      if(!glyphTrack.tracksetUUID) { 
	glyphTrack.tracksetUUID = uuid; 
        option.setAttribute("selected", "selected");
      }
    }

    //----------
    var div1 = trackDiv.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin-top:5px;");
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "track title prefix:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id = glyphTrack.trackID + "_newtrack_title";
    titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', glyphTrack.title);
    titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'title', this.value);");

  }

  //---------------------------------------------------------------------------------
  //
  // and the cancel/accept buttons
  //
  trackDiv.appendChild(document.createElement('hr'));

  var button = document.createElement('input');
  button.type = "button";
  button.className = "largebutton";
  button.setAttribute('style', "float:right; margin: 0px 14px 0px 0px:");
  button.setAttribute("value", "accept configuration");
  button.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'accept-new');");
  trackDiv.appendChild(button);

  var button = document.createElement('input');
  button.type = "button";
  button.className = "largebutton";
  button.setAttribute("value", "cancel");
  button.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'cancel-new');");
  trackDiv.appendChild(button);

  //eedbClearSearchResults(expSearchSet.id); 
}
*/

//-------------------------------------------------------------
//
// new (2.5+) interface for adding predefined tracks to a view
// similar to the way UCSC and gbrowse do it in order to give 
// a familiar and simple interface for novice users.
//
//-------------------------------------------------------------

function gLyphsPredefinedTracksPanel(glyphsGB) {
  if(!glyphsGB) { return; }
  
  var main_div = glyphsGB.main_div;
  var mainRect = glyphsGB.gLyphTrackSet.getBoundingClientRect();

  var top_pos = mainRect.bottom+window.scrollY-450;
  if(top_pos< 150) { top_pos=150;}
  
  var predef_track_div = glyphsGB.predefined_tracks_panel;
  if(!predef_track_div) {
    predef_track_div = main_div.appendChild(document.createElement('div'));
    glyphsGB.predefined_tracks_panel = predef_track_div;
  }
  predef_track_div.setAttribute('style', "position:absolute; text-align:left; padding: 3px 7px 3px 7px; "+
                                //"background-color:#f0f0f7; border:inset; border-width:3px;  "+
                                "background-color:rgb(235,235,240); "+
                                "border:2px solid #808080; border-radius: 4px; "+
                                "z-index:1; width:800px; "+
                                "left:" + (mainRect.left+250) +"px; "+
                                "top:" + top_pos +"px; "
                               );
  predef_track_div.innerHTML = "";

  // close button
  var img1 = predef_track_div.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");
  img1.onclick = function() { gLyphsClosePredefinedTracksPanel(glyphsGB); }
  
  // title
  var div1 = predef_track_div.appendChild(document.createElement('div'));
  div1.setAttribute("style", "font-weight:bold; font-size:16px; margin-top:5px; ");
  div1.innerHTML = "Add predefined tracks to view";
    
  var tdiv = predef_track_div.appendChild(document.createElement('div'));
  tdiv.style.float = "right";
  var collabWidget = glyphsGB.collabWidget;
  if(!collabWidget) {
    collabWidget = eedbCollaborationPulldown("filter_search", glyphsGB.uuid);
    glyphsGB.collabWidget = collabWidget;
  }
  tdiv.appendChild(collabWidget);
  collabWidget.collaboration_uuid = "all";
  collabWidget.collaboration_name = "all";
  collabWidget.callOutFunction = function() { gLyphsReloadPredefinedTracks(glyphsGB); }
  eedbCollaborationPulldown("filter_search", glyphsGB.uuid); //refresh

  //search interface to allow filtering of predefined tracks
  var tdiv = predef_track_div.appendChild(document.createElement('div'));
  var predefSearchForm = tdiv.appendChild(document.createElement('form'));
  predefSearchForm.setAttribute('style', "margin-top: 5px;");
  predefSearchForm.setAttribute("onsubmit", "return false;");

  var searchTable = predefSearchForm.appendChild(document.createElement('table'));
  var tr1 = searchTable.appendChild(document.createElement('tr'));

  var td1 = tr1.appendChild(document.createElement('td'));
  var span1 = td1.appendChild(document.createElement('span'));
  span1.innerHTML = "Search tracks:";
  span1.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  
  td1 = tr1.appendChild(document.createElement('td'));
  var searchInput = td1.appendChild(document.createElement('input'));
  searchInput.id = "glyphs_predef_track_search_inputID"; //used for autocomplete
  searchInput.type = "text";
  searchInput.className = "sliminput";
  searchInput.style = "margin: 1px 0px 3px 3px; font-size:12px; font-family:arial,helvetica,sans-serif; width:350px;";
  searchInput.onkeyup = function(evt) { 
    if(evt.keyCode==13) { gLyphsSearchPredefTracks(glyphsGB, 'search'); } 
  }
  glyphsGB.predefinedSearchInput = searchInput;

  td1 = tr1.appendChild(document.createElement('td'));
  var searchButton = td1.appendChild(document.createElement('input'));
  searchButton.type = "button";
  searchButton.className = "slimbutton";
  searchButton.value = "search";
  searchButton.onclick = function() { gLyphsSearchPredefTracks(glyphsGB, 'search'); }
  
  td1 = tr1.appendChild(document.createElement('td'));
  var clearButton = td1.appendChild(document.createElement('input'));
  clearButton.type = "button";
  clearButton.className = "slimbutton";
  clearButton.value = "clear";
  clearButton.onclick = function() { gLyphsSearchPredefTracks(glyphsGB, 'clear'); }
    
  //predef track search results table
  var tracksDiv = predef_track_div.appendChild(document.createElement('div'));
  glyphsGB.predefinedTracks_results_div = tracksDiv;
  
  var button = predef_track_div.appendChild(document.createElement('input'));
  button.type = "button";
  button.className = "largebutton";
  button.setAttribute("style", "width:200px;");
  button.setAttribute("value", "add tracks");
  button.onclick = function() { gLyphsAddSelectedPredefinedTracks(glyphsGB); }

  //query for all tracks and display
  gLyphsShowPredefTracks(glyphsGB);
  gLyphsReloadPredefinedTracks(glyphsGB);

  searchInput.focus();
}


function gLyphsClosePredefinedTracksPanel(glyphsGB) {
  if(!glyphsGB) { return; }
  var main_div = glyphsGB.main_div;
  if(!main_div) { return; }
  
  var predefined_tracks_panel = glyphsGB.predefined_tracks_panel;
  if(!predefined_tracks_panel) { return; }
  
  main_div.removeChild(predefined_tracks_panel);

  glyphsGB.predefined_tracks_panel = null;
  glyphsGB.predef_tracks_array = null;
  glyphsGB.predef_tracks_hash  = null;
}


function gLyphsSearchPredefTracks(glyphsGB, cmd) {
  if(!glyphsGB) { return; }
  
  var seachInput = glyphsGB.predefinedSearchInput;
  if(cmd == "clear" && seachInput) { seachInput.value =""; }
  
  gLyphsReloadPredefinedTracks(glyphsGB);
}


function gLyphsReloadPredefinedTracks(glyphsGB) {
  if(!glyphsGB) { return; }

  glyphsGB.predef_tracks_array = null;
  glyphsGB.predef_tracks_hash  = null;

  gLyphsShowPredefTracks(glyphsGB); //shows the loading message

  var seachInput = glyphsGB.predefinedSearchInput;
  var filter = "";
  if(seachInput) { filter = seachInput.value; }

  var paramXML = "<zenbu_query><format>simplexml</format><mode>search</mode>";
  paramXML += "<configtype>track</configtype>";
  paramXML += "<sort>create_date</sort><sort_order>desc</sort_order>";
  if(glyphsGB.collabWidget) { 
    paramXML += "<collab>" + glyphsGB.collabWidget.collaboration_uuid + "</collab>"; 
  }
  paramXML += "<filter>"
  if(glyphsGB.asm) { paramXML += glyphsGB.asm + " "; }
  if(filter != "") { paramXML += filter; }
  paramXML += "</filter>"
  paramXML += "</zenbu_query>";

  var predefTracksXMLHttp=GetXmlHttpObject();
  if(predefTracksXMLHttp==null) { return; }
  glyphsGB.predef_XHR = predefTracksXMLHttp;

  predefTracksXMLHttp.open("POST", eedbConfigCGI, true);  //async
  predefTracksXMLHttp.onreadystatechange= function() { gLyphsParsePredefinedTracksResponse(glyphsGB); }
  predefTracksXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  predefTracksXMLHttp.send(paramXML);
  console.log(paramXML);
}


function gLyphsParsePredefinedTracksResponse(glyphsGB) {
  if(!glyphsGB) { return; }
  
  var predefTracksXMLHttp = glyphsGB.predef_XHR;
  if(!predefTracksXMLHttp) return;
  if(predefTracksXMLHttp.responseXML == null) return;
  if(predefTracksXMLHttp.readyState!=4) return;
  if(predefTracksXMLHttp.status!=200) { return; }
  if(predefTracksXMLHttp.responseXML == null) return;
  
  var xmlDoc=predefTracksXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    console.log('predefTracksXMLHttp no xmlDoc');
    return;
  }

  //clear old list of predef tracks
  glyphsGB.predef_tracks_array = new Array();   
  glyphsGB.predef_tracks_hash  = new Object;
  
  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");
    if(!uuid) { continue; }
    
    var config = glyphsGB.predef_tracks_hash[uuid];
    if(!config) {
      var config = new Object;
      config.uuid = uuid;
      config.selected = false;
      glyphsGB.predef_tracks_hash[uuid] = config;
    }
    eedbParseConfigurationData(xmlConfig, config);
    glyphsGB.predef_tracks_array.push(config);
  }  

  glyphsGB.predef_XHR = null;
  gLyphsShowPredefTracks(glyphsGB);
}


function gLyphsShowPredefTracks(glyphsGB) {
  if(!glyphsGB) { return; }
  var tracksDiv = glyphsGB.predefinedTracks_results_div;
  if(tracksDiv == null) { return; }
  tracksDiv.innerHTML = "";
  
  console.log("gLyphsShowPredefTracks "+glyphsGB.uuid);
  
  tracks_array = glyphsGB.predef_tracks_array;
  if(!tracks_array) { 
    tracksDiv.setAttribute('style', "margin: 5px 5px 5px 3px; font-size:10px; font-family:arial,helvetica,sans-serif; \
                            border:1px black solid; background-color:snow; overflow:auto; width:790px; height:300px;");
    var tdiv = tracksDiv.appendChild(document.createElement("div"));
    tdiv.style = "padding:10px; font-size:12px; font-weight:bold";
    tdiv.innerHTML = "loading predefined tracks list...";  
    return; 
  }
  tracksDiv.setAttribute('style', "margin: 5px 5px 5px 3px; font-size:10px; font-family:arial,helvetica,sans-serif; \
                         border:1px black solid; background-color:snow; overflow:auto; width:790px; height:300px;");
  
  // display as table
  var my_table = tracksDiv.appendChild(document.createElement("table"));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(document.createElement('thead')).appendChild(document.createElement('tr'));
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'add';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'track name';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'description';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'create date';
  
  var tbody = my_table.appendChild(document.createElement('tbody'));
  for(i=0; i<tracks_array.length; i++) {
    var config = tracks_array[i];
    
    var tr = tbody.appendChild(document.createElement('tr'));
    
    if(i%2 == 0) { tr.className = "odd"; } 
    else { tr.className = 'even'; } 

    var td1 = tr.appendChild(document.createElement('td'));
    var checkbox = td1.appendChild(document.createElement('input'));
    checkbox.setAttribute("type", "checkbox");
    if(config.selected) { checkbox.setAttribute("checked", "checked"); }
    checkbox.onclick = function(uuid) { return function() { gLyphsSelectPredefinedTrack(glyphsGB, uuid); };}(config.uuid);

    td1 = tr.appendChild(document.createElement('td'));
    var a1 = td1.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    var cfgID = config.uuid + ":::Config";
    a1.setAttribute("onclick", "eedbFetchAndDisplaySourceInfo(\"" +cfgID+ "\"); return false;");
    a1.innerHTML = config.name;
    
    tr.appendChild(document.createElement('td')).innerHTML = encodehtml(config.description);
    
    //create data/owner cell
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(config.author) { 
      var tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = config.author;
    }
    var tdiv = td.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = config.create_date;
    
  }
  
  if(tracks_array.length == 0) {
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.className = 'odd';
    tr.appendChild(document.createElement('td'));
    tr.appendChild(document.createElement('td')).innerHTML = "no predefined tracks found";
    tr.appendChild(document.createElement('td'));
    tr.appendChild(document.createElement('td'));
  }
}


function gLyphsSelectPredefinedTrack(glyphsGB, uuid) {
  var config = glyphsGB.predef_tracks_hash[uuid];
  if(!config) { return; }
  config.selected = !(config.selected); //toggle
  console.log("gLyphsSelectPredefinedTrack "+(config.selected)+" "+config.name);
  gLyphsShowPredefTracks(glyphsGB); //redraw to be safe
}


function gLyphsAddSelectedPredefinedTracks(glyphsGB) {
  tracks_hash = glyphsGB.predef_tracks_hash;
  if(!tracks_hash) {
    gLyphsClosePredefinedTracksPanel(glyphsGB);
    return; 
  }
  for(var uuid in tracks_hash) {
    var config = tracks_hash[uuid];
    if(config && config.selected) { gLyphsLoadTrackConfigUUID(glyphsGB, uuid); }
  }  
  gLyphsAutosaveConfig();
  gLyphsClosePredefinedTracksPanel(glyphsGB);
}


