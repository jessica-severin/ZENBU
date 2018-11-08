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

var expressXMLHttp;
var eedbRegionCGI = eedbWebRoot + "/cgi/eedb_region.cgi";
var eedbEchoSvgCGI = eedbWebRoot + "/cgi/eedb_svgecho.cgi";
var express_sort_mode = 'name';
var newTrackID = 100;
var current_dragTrack;
var current_resizeTrack;
var currentSelectTrackID;
var eedbCurrentUser;
var maxActiveTrackXHRs = 9;
var colorSpaces = new Object();

var gLyphTrack_array = new Object();
var active_track_XHRs = new Object();
var pending_track_XHRs = new Object();
var gLyphsSourceCache = new Object();

var current_feature;

var current_region = new Object();
current_region.display_width = Math.floor(800);
current_region.asm = "hg18";
current_region.configname = "welcome to eeDB gLyphs";
current_region.desc = "";
current_region.exppanel_hide_deactive = false;
current_region.exppanel_active_on_top = false;
current_region.hide_zero_experiments = false;
current_region.exppanel_subscroll = true;
current_region.groupinfo_ranksum_display = false;
current_region.autosaveInterval = undefined;
current_region.genus = "";
current_region.species = "";
current_region.common_name = "";
current_region.flip_orientation = false;
current_region.auto_flip = false;
current_region.highlight_search = "";
current_region.active_track_exp_filter = undefined;
current_region.active_trackID = undefined;
current_region.init_search_term = undefined;


function Hash() {
  this.length = 0;
  this.items = new Array();
  for (var i = 0; i < arguments.length; i += 2) {
	if (typeof(arguments[i + 1]) != 'undefined') {
		this.items[arguments[i]] = arguments[i + 1];
		this.length++;
	}
  }

  this.removeItem = function(in_key) {
	var tmp_value;
	if (typeof(this.items[in_key]) != 'undefined') {
		this.length--;
		var tmp_value = this.items[in_key];
		delete this.items[in_key];
	}
	return tmp_value;
  }

  this.getItem = function(in_key) {
	return this.items[in_key];
  }

  this.setItem = function(in_key, in_value) {
	if (typeof(in_value) != 'undefined') {
		if (typeof(this.items[in_key]) == 'undefined') {
			this.length++;
		}
		this.items[in_key] = in_value;
	}
	return in_value;
  }

  this.hasItem = function(in_key) {
	return typeof(this.items[in_key]) != 'undefined';
  }
}


function getRegionLocation() {
  var chromloc = current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end;
  if(current_region.flip_orientation) { chromloc += "-"; } else { chromloc += "+"; }
  return chromloc;
}


function gLyphsChangeDhtmlHistoryLocation() {
  if(zenbu_embedded_view) { return; }
  var chromloc = getRegionLocation();
  var newurl = "#config="+current_region.configUUID +";loc="+chromloc
  if(current_region.active_track_exp_filter) {
    newurl +=";active_track_exp_filter="+current_region.active_track_exp_filter;
  }
  if(current_region.highlight_search) {
    newurl +=";highlight_search="+current_region.highlight_search;
  }
  dhtmlHistory.add(newurl);
}

 
//---------------------------------------------
//
// eeDB_search call back function section
//
//---------------------------------------------

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

  if(gLyphsParseLocation(str)) { 
    var charCode;
    if(e && e.which) charCode=e.which;
    else if(e) charCode = e.keyCode;
    if((charCode==13) || (e.button==0)) { 
      gLyphsInitLocation(str);
      reloadRegion(); 
      //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
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


function eedbSearchGlobalCalloutClick(id) {
  eedbClearSearchTooltip();
  //document.getElementById("searchResults").innerHTML="Searching...";
  current_feature = undefined;
  gLyphsLoadObjectInfo(id);
  gLyphsCenterOnFeature(current_feature);
  //eedbClearSearchResults("glyphsSearchBox1");
}

function singleSearchValue() { }


//----------------------------------------------
//
// global source load/cache system 
//
//----------------------------------------------


/*
function gLyphsCacheFullViewSources() {
  //loops on entire view, all tracks and consolidates into a single
  //sources query which is launched async at the start of the view
  
  var new_source_hash = new Object;
  var tracks_needing_refresh = new Object;
  var newIDS =false;

  for(var trackID in gLyphTrack_array){
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    if(!glyphTrack.experiments) { continue; }
  
    for(var sourceID in glyphTrack.experiments) {
      if(!glyphTrack.experiments[sourceID]) { glyphTrack.experiments[sourceID] = new Object(); }
      var source = glyphTrack.experiments[sourceID];
      if(source.classname) { continue; } //already loaded

      //if source is in cache, then parse copy for this track
      if(gLyphsSourceCache[sourceID]) { 
        var sourceDOM = gLyphsSourceCache[sourceID];
        if(!sourceDOM) { continue; }
        
        if(sourceID.indexOf(":::FeatureSource") != -1) {
          eedbParseFeatureSourceData(sourceDOM, source);
        }
        if(sourceID.indexOf(":::Experiment") != -1) {
          eedbParseExperimentData(sourceDOM, source);
          source.expname = source.name;
          source.value = 0;  //reset
          source.sense_value = 0;  //reset
          source.antisense_value = 0;  //reset
          source.sig_error = 1.0;
          source.exptype = "";  //reset
        }
      }
      //if did not parse then it is new id
      if(!source.classname) {
        new_source_hash[sourceID] = true;
        tracks_needing_refresh[trackID] = true;
        newIDS=true;
      }
    }
  }
  if(!newIDS) { return; }
  
  //consolidate into a single query
  var paramXML = "<zenbu_query><format>descxml</format><mode>sources</mode>\n";
  paramXML += "<source_ids>";
  for(var sourceID in new_source_hash) {
    paramXML += sourceID + ",";
  }
  paramXML += "</source_ids>\n";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp = GetXmlHttpObject();
  if(sourcesXMLHttp==null) { return; }
  current_region.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);  //async
  sourcesXMLHttp.onreadystatechange= gLyphsCacheViewSourcesResponse;
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  sourcesXMLHttp.send(paramXML);
}


function gLyphsCacheViewSourcesResponse() {
  var sourcesXMLHttp = current_region.sourcesXMLHttp;
  if(!sourcesXMLHttp) { return; }
  
  if(sourcesXMLHttp.responseXML == null) return;
  if(sourcesXMLHttp.readyState!=4) return;
  if(sourcesXMLHttp.status!=200) { return; }
  if(sourcesXMLHttp.responseXML == null) return;
  
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'gLyphsCacheViewSourcesResponse problem with XHR!';
    return;
  }
  
  var exps = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<exps.length; i++) {   
    var experimentDOM = exps[i];
    var id = experimentDOM.getAttribute("id");
    gLyphsSourceCache[id] = experimentDOM;
  }
  
  var fsrcs = xmlDoc.getElementsByTagName("featuresource");
  for(var i=0; i<fsrcs.length; i++) {
    var fsourceDOM = fsrcs[i];
    var id = fsourceDOM.getAttribute("id");
    gLyphsSourceCache[id] = fsourceDOM;
  }  
  
  //now loop through the tracks set up missing Experiments    
  for(var trackID in gLyphTrack_array){
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    if(!glyphTrack.experiments) { continue; }
    
    for(var sourceID in glyphTrack.experiments) {
      if(!glyphTrack.experiments[sourceID]) { glyphTrack.experiments[sourceID] = new Object(); }
      var source = glyphTrack.experiments[sourceID];
      if(source.classname) { continue; } //already loaded
      
      //if source is in cache, then parse copy for this track
      if(gLyphsSourceCache[sourceID]) { 
        var sourceDOM = gLyphsSourceCache[sourceID];
        if(!sourceDOM) { continue; }
        
        if(sourceID.indexOf(":::FeatureSource") != -1) {
          eedbParseFeatureSourceData(sourceDOM, source);
        }
        if(sourceID.indexOf(":::Experiment") != -1) {
          eedbParseExperimentData(sourceDOM, source);
          source.expname = source.name;
          source.value = 0;  //reset
          source.sense_value = 0;  //reset
          source.antisense_value = 0;  //reset
          source.sig_error = 1.0;
          source.exptype = "";  //reset
        }
      }
    }
  }

  //clear
  glyphTrack.sourcesXMLHttp = undefined;

  //lastly refresh the Experiment graph (active track)
  gLyphsDrawExpressionPanel();
}
*/


function gLyphsCacheSources(glyphTrack) {
  if(!glyphTrack) { return; }
  var id_hash = glyphTrack.experiments;
  if(!id_hash) { return; }
  
  var newIDS =false;
  var paramXML = "<zenbu_query><format>descxml</format><mode>sources</mode>\n";
  //var paramXML = "<zenbu_query><format>fullxml</format><mode>sources</mode>\n";
  //TODO: to get the color information I needed to use fullxml, but this is really impractical for all sources, need to rethink this
  if(glyphTrack.exp_name_mdkeys) {
    mdkeys = escapeXml(glyphTrack.exp_name_mdkeys);
    mdkeys = mdkeys.replace(/\n/g," ");
    mdkeys = mdkeys.replace(/\r/g," ");
    paramXML += "<mdkey_list>"+mdkeys+"</mdkey_list>";
  }
  paramXML += "<source_ids>";
  for(var sourceID in id_hash) {
    var source = id_hash[sourceID];
    if(!source) { continue; }
    if((glyphTrack.exp_name_mdkeys == "") && source.classname) { continue; } //if no extra mdkeys and already loaded then can skip

    if(source.proxy_id) { 
      source.orig_id = sourceID;
      sourceID = source.proxy_id; 
    }

    if(gLyphsSourceCache[sourceID]) { 
      var sourceDOM = gLyphsSourceCache[sourceID];
      if(!sourceDOM) { continue; }

      if(sourceID.indexOf(":::FeatureSource") != -1) {
        eedbParseFeatureSourceData(sourceDOM, source);
      }
      if(sourceID.indexOf(":::Experiment") != -1) {
        eedbParseExperimentData(sourceDOM, source);
        source.expname = source.name;
        source.value = 0;  //reset
        source.sense_value = 0;  //reset
        source.antisense_value = 0;  //reset
        source.sig_error = 1.0;
        source.exptype = "";  //reset
      }
    }
    if((glyphTrack.exp_name_mdkeys != "") || !source.classname) { 
      newIDS=true;
      paramXML += sourceID + ","; 
    }
  }
  paramXML += "</source_ids>\n";
  paramXML += "</zenbu_query>\n";
  if(!newIDS) { return; }

  var sourcesXMLHttp = GetXmlHttpObject();
  if(sourcesXMLHttp==null) { return; }
  glyphTrack.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);  //async
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { gLyphsCacheSourcesResponse(id); };}(glyphTrack.trackID);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  sourcesXMLHttp.send(paramXML);
}


function gLyphsCacheSourcesResponse(trackID) {
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  var id_hash = glyphTrack.experiments;
  if(!id_hash) { return; }
  
  var sourcesXMLHttp = glyphTrack.sourcesXMLHttp;
  if(!sourcesXMLHttp) { return; }

  if(sourcesXMLHttp.responseXML == null) return;
  if(sourcesXMLHttp.readyState!=4) return;
  if(sourcesXMLHttp.status!=200) { return; }
  if(sourcesXMLHttp.responseXML == null) return;
  
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'gLyphsCacheSourcesResponse problem with XHR!';
    return;
  }
    
  var exps = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<exps.length; i++) {   
    var experimentDOM = exps[i];
    var id = experimentDOM.getAttribute("id");
    gLyphsSourceCache[id] = experimentDOM;
  }
  
  var fsrcs = xmlDoc.getElementsByTagName("featuresource");
  for(var i=0; i<fsrcs.length; i++) {
    var fsourceDOM = fsrcs[i];
    var id = fsourceDOM.getAttribute("id");
    gLyphsSourceCache[id] = fsourceDOM;
  }  
  
  for(var sourceID in id_hash) {
    var source = id_hash[sourceID];
    if(!source) { continue; }
    if(source.proxy_id) { sourceID = source.proxy_id; }

    var sourceDOM = gLyphsSourceCache[sourceID];
    if(!sourceDOM) { continue; }

    if(sourceID.indexOf(":::FeatureSource") != -1) {
      eedbParseFeatureSourceData(sourceDOM, source);
    }
    if(sourceID.indexOf(":::Experiment") != -1) {
      eedbParseExperimentData(sourceDOM, source);
      source.expname = source.name;
      source.value = 0;  //reset
      source.sense_value = 0;  //reset
      source.antisense_value = 0;  //reset
      source.sig_error = 1.0;
      source.exptype = "";  //reset
    }
  }
  glyphTrack.sourcesXMLHttp = undefined;

  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(trackID);
  gLyphsDrawExpressionPanel();
}


//---------------------------------------------
//
// section to mananage the feature_info
// and XHR to get the feature DOM data
//
//---------------------------------------------

function gLyphsLoadObjectInfo(id) {
  if(current_feature && (current_feature.id == id)) {
    gLyphsDisplayFeatureInfo(current_feature);
    return false;
  }

  var object = eedbGetObject(id);
  if(!object) { return false; }

  if(object.classname == "Feature") {
    gLyphsProcessFeatureSelect(object);
  }
  if(object.classname == "Experiment") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "FeatureSource") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "Configuration") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "Assembly") {
    eedbDisplaySourceInfo(object);
  }
    
}

function gLyphsShowConfigDetailPanel(fid) {  
  var object = eedbGetObject(fid);
  if(!object) { return false; }  
  eedbDisplaySourceInfo(object);
}


function gLyphsProcessFeatureSelect(object) {
  if(!object) {
    if(current_feature) { 
      //clear selected feature
      current_feature = undefined;
      gLyphsDisplayFeatureInfo(); //clears panel
    }
    return; 
  }
  if(object.classname != "Feature") { return; }

  //check if metadata/fullload has heppened, if not do it
  eedbFullLoadObject(object.id, object);

  if(object.source_name == "eeDB_gLyphs_configs") {
    var configUUID = object.uuid;;
    if(configUUID) { 
      gLyphsInitViewConfigUUID(configUUID); 
      reloadRegion();
      //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
      gLyphsChangeDhtmlHistoryLocation();
      return 0;
    }
    /*
  } else if(object.source_name == "eeDB_gLyph_track_configs") {
    //rebuild to use configserver and track UUID to get XML
    var trackUUID = object.uuid;;
    if(trackUUID) {
      gLyphsLoadTrackConfigUUID(trackUUID); 
    } else {
      document.getElementById("message").innerHTML = "track-config ["+object.id+"] missing uuid";
    }
    return 0;
     */
  } else {
    if(current_feature == object) {
      gLyphsCenterOnFeature(current_feature);
    } else {
      current_feature = object;
      gLyphsDisplayFeatureInfo(object);
    }

    //need to rethink if I rebuild this differently
    //feature_express_probes = xmlDoc.getElementsByTagName("feature_express");
    //displayProbeInfo();  //old system not used anymore
    //current_express_probe = feature_express_probes[0];
    //current_express_probe = processFeatureExpressProbe(feature_express_probes[0]);

    gLyphsDrawExpressionPanel();
  }
  return 1;
}


function gLyphsTrackFeatureInfo(trackID, feature_idx) {
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  var obj = glyphTrack.feature_array[feature_idx];
  eedbDisplayTooltipObj(obj);
}


function gLyphsTrackExperimentInfo(trackID, expID) {
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }

  //change background highlight
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(!experiment.back_rect) { continue; }
    //experiment.back_rect.setAttributeNS(null, 'visibility', "hidden");
    if(experiment.id == expID) {
      //experiment.back_rect.setAttributeNS(null, 'visibility', "visible");
      experiment.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
      //experiment.back_rect.setAttributeNS(null, 'fill', "pink");
    } else {
      experiment.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }

  var experiment = glyphTrack.experiments[expID];
  if(!experiment) { return; }

  toolTipWidth=350;
  var tdiv, tspan, tinput, ta;
  var main_div = document.createElement('div');
  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "background-color:lavender; border:inset; border-width:2px; opacity:0.9;");

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = experiment.name;

  tdiv = main_div.appendChild(document.createElement('div'));
  if(experiment.platform) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = experiment.platform;
  }
  if(experiment.source_name) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = experiment.source_name;
  }
  if(experiment.category) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = experiment.category;
  }
  if(experiment.owner_identity) {
    //tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tspan.innerHTML = "created by: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = experiment.owner_identity;
  }

  if(experiment.description.length > 0) {
    //main_div.appendChild(document.createElement('hr'));
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "max-width:450px");
    tdiv.innerHTML = experiment.description;
  }

  if(glyphTrack.strandless) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "signal : " + experiment.value + " " + experiment.exptype;
  } else {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "sense signal : " + experiment.sense_value + " " + experiment.exptype;
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "anti-sense signal : " + experiment.antisense_value + " " + experiment.exptype;
  }


  /*
  main_div.appendChild(document.createElement('hr'));
  for(var tag in source.mdata) { //new common mdata[].array system
    if(tag=="description") { continue; }
    if(tag=="eedb:description") { continue; }
    if(tag=="eedb:category") { continue; }
    if(tag=="display_name") { continue; }
    if(tag=="eedb:display_name") { continue; }
    if(tag=="eedb:owner_nickname") { continue; }
    if(tag=="eedb:owner_OpenID") { continue; }

    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold;");
    tspan.innerHTML = tag + ": ";
    var value_array = source.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      if(idx1!=0) { 
        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.innerHTML = ", " 
      }

      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "color: rgb(105,105,105);");
      tspan.innerHTML = value;
    }
  }
  */

  //update the tooltip
  var tooltip = document.getElementById("toolTipLayer");
  tooltip.innerHTML = "";
  tooltip.appendChild(main_div);
  toolTipSTYLE.display='block';
}


function gLyphsTrackMDGroupInfo(trackID, mdgroupIdx, fullmode) {
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  if(!glyphTrack.experiment_mdgrouping) { return; }

  //change background highlight
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    if(!mdgroup.back_rect) { continue; }
    if(i == mdgroupIdx) {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    } else {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }

  var mdgroup = glyphTrack.experiment_mdgrouping[mdgroupIdx];
  if(!mdgroup) { return; }
  mdgroup.idx = mdgroupIdx;

  gLyphsTrackGroupInfo(trackID, mdgroup, fullmode, "mdgroup");
}


function gLyphsTrackRankSumInfo(trackID, mdgroupIdx, fullmode) {
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  if(!glyphTrack.ranksum_mdgroups) { return; }

  //change background highlight
  for(var i=0; i<glyphTrack.ranksum_mdgroups.length; i++) {
    var mdgroup = glyphTrack.ranksum_mdgroups[i];
    if(!mdgroup.back_rect) { continue; }
    if(i == mdgroupIdx) {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    } else {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }

  var mdgroup = glyphTrack.ranksum_mdgroups[mdgroupIdx];
  if(!mdgroup) { return; }

  gLyphsTrackGroupInfo(trackID, mdgroup, fullmode, "ranksum");
}


function gLyphsTrackGroupInfo(trackID, mdgroup, fullmode, paneltype) {
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  if(!mdgroup) { return; }

  toolTipWidth=350;
  var tdiv, tspan, tinput, ta;
  var main_div = document.createElement('div');
  main_div.setAttribute('style', "text-align:left; font-size:8pt; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "background-color:rgb(230,230,240); border:inset; border-width:2px; opacity:0.9;");

  if(fullmode) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");

    //group color
    if(paneltype=="mdgroup") { 
      tspan2 = tdiv.appendChild(document.createElement('span'));
      tspan2.setAttribute('style', "margin: 1px 4px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
      tspan2.innerHTML = "color:";
      var colorInput = tdiv.appendChild(document.createElement('input'));
      colorInput.setAttribute('style', "margin: 1px 8px 1px 0px;");
      colorInput.setAttribute('value', mdgroup.rgbcolor);
      colorInput.setAttribute('size', "7");
      colorInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'expMDGroupColor', this.value, "+mdgroup.idx+");");
      colorInput.color = new jscolor.color(colorInput);
      tdiv.appendChild(colorInput);
    }

    var a1 = tdiv.appendChild(document.createElement('a'));
    a1.setAttribute("target", "top");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "eedbSourceInfoEvent('close');return false");
    var img1 = a1.appendChild(document.createElement('img'));
    img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
    img1.setAttribute("width", "12");
    img1.setAttribute("height", "12");
    img1.setAttribute("alt","close");
  }

  //update the tooltip
  var tooltip = document.getElementById("toolTipLayer");
  tooltip.innerHTML = "";
  tooltip.appendChild(main_div);
  toolTipSTYLE.display='block';

  if(fullmode) {
    var info_div = document.getElementById("source_info");
    if(!info_div) { return; }

    var xpos, ypos;
    current_source = mdgroup;
    var e = window.event
    toolTipWidth=450;
    moveToMouseLoc(e);
    xpos = toolTipSTYLE.xpos;
    ypos = toolTipSTYLE.ypos;

    main_div.setAttribute('style', "text-align:left; font-size:8pt; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "background-color:rgb(230,230,240); border:inset; border-width:2px; "+
                                 "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

    info_div.innerHTML = "";
    info_div.appendChild(main_div);
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:10pt; font-weight: bold;");
  if(paneltype=="mdgroup") { tspan.innerHTML = mdgroup.mdvalue; }
  if(paneltype=="ranksum") { tspan.innerHTML = mdgroup.name; }

  if(fullmode && (paneltype=="ranksum")) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 0px 4px;");

    ttable  = tdiv.appendChild(document.createElement('table'));
    ttable.setAttribute('cellspacing', "0");
    ttable.setAttribute('style', "font-size:10px;");

    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    ttd.innerHTML = "display: ";

    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_display");
    tradio.setAttribute('value', "");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('ranksum_display', this.value);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "experiments in group";
    if(!current_region.groupinfo_ranksum_display) { tradio.setAttribute('checked', "checked"); }
    
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_display");
    tradio.setAttribute('value', "ranksum");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('ranksum_display', this.value);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "ranksum";
    if(current_region.groupinfo_ranksum_display) { tradio.setAttribute('checked', "checked"); }
  } 

  if(glyphTrack.strandless) {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(paneltype=="mdgroup") {
      tdiv.innerHTML = "signal : " + mdgroup.value.toFixed(3);
      tdiv.innerHTML += " +/- " + mdgroup.value_error.toFixed(3);
      tdiv.innerHTML += " " + glyphTrack.datatype;
    }
    if(paneltype=="ranksum") {
      tdiv.innerHTML = "z-score : " + mdgroup.value.toFixed(3);
    }
  } else {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(paneltype=="mdgroup") {
      tdiv.innerHTML = "sense signal : " + mdgroup.sense_value.toFixed(3);
      tdiv.innerHTML += " +/- " + mdgroup.sense_error.toFixed(3);
      tdiv.innerHTML += " " + glyphTrack.datatype;
    }
    if(paneltype=="ranksum") {
      tdiv.innerHTML = "sense z-score : " + mdgroup.sense_value.toFixed(3);
    }
    tdiv = main_div.appendChild(document.createElement('div'));
    if(paneltype=="mdgroup") {
      tdiv.innerHTML = "anti-sense signal : " + mdgroup.antisense_value.toFixed(3);
      tdiv.innerHTML += " +/- " + mdgroup.antisense_error.toFixed(3);
      tdiv.innerHTML += " " + glyphTrack.datatype;
    }
    if(paneltype=="ranksum") {
      tdiv.innerHTML = "anti-sense z-score : " + mdgroup.antisense_value.toFixed(3);
    }
  }

  if(fullmode && mdgroup.mdata_list) {
    var table = main_div.appendChild(document.createElement('table'));
    table.setAttribute('style', "font-size:8pt; padding: 0px 3px 0px 0px;");
    var tr = table.appendChild(document.createElement('tr'));
    tr.setAttribute('valign', "top");
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute('style', "font-size:8pt; font-weight:bold; padding: 0px 3px 0px 0px;");
    td.setAttribute('valign', "top");
    td.innerHTML = "mdata: ";
    td = tr.appendChild(document.createElement('td'));
    td.setAttribute('style', "font-size:8pt; padding: 0px 3px 0px 0px;");
    for(var j=0; j<mdgroup.mdata_list.length; j++) {
      var mdata = mdgroup.mdata_list[j];
      if(td.innerHTML != "") { td.innerHTML += "<br>"; }
      td.innerHTML += mdata.type + ":=" + mdata.value;
    }
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:8pt; padding: 0px 3px 0px 0px;");
  tspan.innerHTML = mdgroup.source_ids.length+" experiments";
   
  if(!fullmode) { return; }  

  var ranksum_div = main_div.appendChild(document.createElement('div'));
  ranksum_div.id = "panel_groupinfo_ranksum_div";
  ranksum_div.style.display = "none";

  if(paneltype=="ranksum") {
    var src_hash = new Object;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      src_hash[srcid] = true;
    }

    var sense_max = 0.0;
    var antisense_max = 0.0;
    var exp_array = new Array;
    for(var i=0; i<glyphTrack.experiment_array.length; i++) {
      var experiment = glyphTrack.experiment_array[i];
      //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
      if(experiment.hide) { continue; }
      exp_array.push(experiment);
      //calculate the max
      var value           = experiment.value;
      var sense_value     = experiment.sense_value;
      var antisense_value = experiment.antisense_value;

      if(glyphTrack.strandless) {
        if(value > sense_max) { sense_max = value; }
      } else {
        if(sense_value > sense_max)     { sense_max = sense_value; }
        if(antisense_value > antisense_max) { antisense_max = antisense_value; }
      }
    }

    //sense first
    var old_sortmode = express_sort_mode;
    express_sort_mode = "value_plus";
    exp_array.sort(gLyphs_express_sort_func);

    var sigwidth = 1;
    sigwidth = Math.floor(400.0 / exp_array.length);
    if(sigwidth < 1) { sigwidth = 1; }
    if(sigwidth >10) { sigwidth = 10; }
    //if(exp_array.length<150) { sigwidth = 3; }
    //if(exp_array.length<75) { sigwidth = 5; }

    tdiv = ranksum_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "padding: 0px 7px 3px 7px;");
    var svg = createSVG(exp_array.length*sigwidth, 120);
    tdiv.appendChild(svg);

    for(var j=0; j<exp_array.length; j++) {
      var experiment = exp_array[j];
      var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
      var sigheight = 1;
      if(sense_max>0) { sigheight = 100.0 * experiment.sense_value / sense_max; }
      if(sigheight < 1.0) { sigheight = 1.0; }
      rect.setAttributeNS(null, 'x', (j*sigwidth+1) +'px');
      //rect.setAttributeNS(null, 'y', 100 - 100.0 * experiment.sense_value / sense_max);
      rect.setAttributeNS(null, 'y', 100 - sigheight);
      rect.setAttributeNS(null, 'width', sigwidth + 'px');
      //rect.setAttributeNS(null, 'height', 100.0 * experiment.sense_value / sense_max);
      rect.setAttributeNS(null, 'height', sigheight);

      if(src_hash[experiment.id]) { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); } 
      else { rect.setAttributeNS(null, 'fill', "lightgray"); }
    } 
    //then antisense display
    if(!glyphTrack.strandless) {
      express_sort_mode = "value_minus";
      exp_array.sort(gLyphs_express_sort_func);

      tdiv = ranksum_div.appendChild(document.createElement('div'));
      tdiv.setAttribute('style', "padding: 0px 7px 3px 7px;");
      var svg = createSVG(exp_array.length*sigwidth, 120);
      tdiv.appendChild(svg);
      for(var j=0; j<exp_array.length; j++) {
        var experiment = exp_array[j];
        var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        var sigheight = 1;
        if(antisense_max>0) { sigheight = 100.0 * experiment.antisense_value / antisense_max; }
        if(sigheight < 1.0) { sigheight = 1.0; }
        rect.setAttributeNS(null, 'x', (j*sigwidth+1) +'px');
        //rect.setAttributeNS(null, 'y', 100 - 100.0 * experiment.antisense_value / antisense_max);
        rect.setAttributeNS(null, 'y', 100 - sigheight);
        rect.setAttributeNS(null, 'width', sigwidth + 'px');
        //rect.setAttributeNS(null, 'height', 100.0 * experiment.antisense_value / antisense_max);
        rect.setAttributeNS(null, 'height', sigheight);

        if(src_hash[experiment.id]) { rect.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); } 
        else { rect.setAttributeNS(null, 'fill', "lightgray"); }
      } 
    }

    //reset the sort_order mode 
    express_sort_mode = old_sortmode;
  } 

  //always make the experiment list view
    var exp_div = main_div.appendChild(document.createElement('div'));
    exp_div.id = "panel_groupinfo_exp_div";
    exp_div.style.display = "block";
    
    //show all experiments in the group
    var exp_array = new Array;
    var max_value=0;
    var max_text=0;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      if(experiment.hide) { continue; }
      //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
      //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
      if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
      exp_array.push(experiment);

      if(glyphTrack.strandless) {
        if(experiment.value > max_value) { max_value = experiment.value; }
      } else {
        if(experiment.sense_value > max_value)     { max_value = experiment.sense_value; }
        if(experiment.antisense_value > max_value) { max_value = experiment.antisense_value; }
      }
      if(experiment.name.length > max_text) { max_text = experiment.name.length; }
    }
    if(max_value==0) { max_value=1; } //avoid div-by-zero
    exp_array.sort(gLyphs_express_sort_func);

    tdiv = exp_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "padding: 0px 7px 3px 7px;");
    var svg = createSVG((max_text*8)+120, 12*exp_array.length);
    tdiv.appendChild(svg);

    max_text=0;
    for(var j=0; j<exp_array.length; j++) {
      var experiment = exp_array[j];

      var back_rect = document.createElementNS(svgNS,'rect');
      back_rect.setAttributeNS(null, 'x', '0px');
      back_rect.setAttributeNS(null, 'y', ((j*12)) +'px');
      back_rect.setAttributeNS(null, 'width', "100%");
      back_rect.setAttributeNS(null, 'height', '12px');
      back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
      if(!current_region.exportSVGconfig) {
        back_rect.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      experiment.back_rect = back_rect;
      svg.appendChild(back_rect);

      var text = document.createElementNS(svgNS,'text');
      text.setAttributeNS(null, 'x', '7px');
      text.setAttributeNS(null, 'y', (j*12+9) +'px');
      text.setAttributeNS(null, 'style', 'font-size:8pt; font-family:arial,helvetica,sans-serif; fill:black;');
      text.appendChild(document.createTextNode(experiment.name));
      if(!current_region.exportSVGconfig) {
        text.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        text.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      svg.appendChild(text);
      var bbox = text.getBBox();
      if(bbox.width > max_text) { max_text = bbox.width; }
    }
    svg.setAttributeNS(null, 'width', (max_text+120)+'px');

    for(var j=0; j<exp_array.length; j++) {
      var experiment = exp_array[j];
      if(glyphTrack.strandless) {
        var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        rect.setAttributeNS(null, 'x', (max_text+10) +'px');
        rect.setAttributeNS(null, 'y', (j*12+1) +'px');
        rect.setAttributeNS(null, 'width', 100.0 * experiment.value / max_value);
        rect.setAttributeNS(null, 'height', '10px');
        //rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
        if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
        else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }

        if(!current_region.exportSVGconfig) {
          rect.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
          rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
          rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
      } else {
        var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        rect.setAttributeNS(null, 'x', (max_text+10) +'px');
        rect.setAttributeNS(null, 'y', (j*12+1) +'px');
        rect.setAttributeNS(null, 'width', 100.0 * experiment.sense_value / max_value);
        rect.setAttributeNS(null, 'height', '5px');
        //rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
        if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
        else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }

        if(!current_region.exportSVGconfig) {
          rect.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
          rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
          rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }

        rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        rect.setAttributeNS(null, 'x', (max_text+10) +'px');
        rect.setAttributeNS(null, 'y', (j*12 +6) +'px');
        rect.setAttributeNS(null, 'width', 100.0 * experiment.antisense_value / max_value);
        rect.setAttributeNS(null, 'height', '5px');
        //rect.setAttributeNS(null, 'fill', glyphTrack.revStrandColor);
        if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
        else { rect.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); }

        if(!current_region.exportSVGconfig) {
          rect.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
          rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
          rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
      }
    }
  

  if(paneltype=="ranksum" && current_region.groupinfo_ranksum_display) { 
    exp_div.style.display = "none";
    ranksum_div.style.display = "block";
  } else { 
    exp_div.style.display = "block"; 
    ranksum_div.style.display = "none"; 
  }
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


function gLyphs_express_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(current_region.exppanel_active_on_top) {
    if(a.hide && !b.hide) { return 1; }
    if(!a.hide && b.hide) { return -1; }
  }

  var rtnval=0;
  if(express_sort_mode == 'name') {
    if(!a.expname && !b.expname) { return 0; }
    if(!a.expname) { return 1; }
    if(!b.expname) { return -1; }
    if(a.expname.toLowerCase() == b.expname.toLowerCase()) { return 0; }
    if(a.expname.toLowerCase() > b.expname.toLowerCase()) { return 1; }
    return -1;
  }
  else if(express_sort_mode == 'value_both') {
      var value_a = a.value;
      var value_b = b.value;
      rtnval = value_b - value_a;
  }
  else if(express_sort_mode == 'value_plus') {
      var value_a = a.sense_value;
      var value_b = b.sense_value;
      rtnval = value_b - value_a;
  }
  else if(express_sort_mode == 'value_minus') {
      var value_a = a.antisense_value;
      var value_b = b.antisense_value;
      rtnval = value_b - value_a;
  }
  else if(express_sort_mode == 'series') {
    var nameA = a.series_name;
    var nameB = b.series_name;

    var pointA = a.series_point;
    var pointB = b.series_point;

    var expA = a.exp_acc;
    var expB = b.exp_acc;

    if(nameA < nameB) { rtnval = -1; }
    else if(nameA > nameB) { rtnval = 1; }
    else {
      rtnval = pointA - pointB;
      if(pointA == pointB) { 
        if(expA > expB) { rtnval = 1; } else { rtnval = -1; }
      }
    }
  }       
  else if(express_sort_mode == 'point') {
    var nameA = a.series_name;
    var nameB = b.series_name;

    var pointA = a.series_point;
    var pointB = b.series_point;

    var expA = a.exp_acc;
    var expB = b.exp_acc;

    rtnval = pointA - pointB;
    if(pointA == pointB) { 
      if(nameA < nameB) { rtnval = -1; }
      else if(nameA > nameB) { rtnval = 1; }
      else {
        if(expA > expB) { rtnval = 1; } else { rtnval = -1; }
      }
    }
  }
  
  if(rtnval == 0) { // if same then use experiment.id to fix the sort order
    var expa = a.id;
    var expb = b.id;
    rtnval = expa - expb;
  }
  return rtnval;
}


function change_express_sort(mode) {
  if(mode=="norm") { mode="value_both"; }  //backward compat
  if(mode!="point" && mode!="series" && mode!="name" && mode!="value_both" && mode!="value_plus" && mode!="value_minus") { return; }
  express_sort_mode = mode;

  gLyphsDrawExpressionPanel();

  var glyphTrack = gLyphTrack_array[current_region.active_trackID];
  if(glyphTrack) {
    if(glyphTrack.glyphStyle == "experiment-heatmap") {
      gLyphsRenderTrack(glyphTrack);
    }
    gLyphsDrawTrack(current_region.active_trackID);
  }
}


function glyphs_reconfig_with_visible_experiments() {
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return; }

  var experiments = new Array;
  var source_ids = "";
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(experiment.hide) { continue; }
    experiments.push(experiment);
    if(source_ids != "") { source_ids += ","; }
    source_ids += experiment.id;
  }
  //document.getElementById("message").innerHTML = "remove unselected experiments : "+source_ids;

  glyphTrack.source_ids = source_ids;
  glyphTrack.experiments = new Object();;
  glyphTrack.experiment_array = new Array();
  glyphTrack.expfilter = "";
  glyphTrack.uuid = "";
  prepareTrackXHR(current_region.active_trackID);
  gLyphsAutosaveConfig();
}


function glyphs_reconfig_experiments(trackID, cmd) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }

  var experiments = glyphTrack.experiment_array;
  if(!experiments || experiments.length==0) { return; }

  //document.getElementById("message").innerHTML = "glyphs_reconfig_experiments : "+cmd;
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    if(cmd=="flip-active") { experiment.hide = !experiment.hide; }
    if(cmd=="deactivate-zeroexps") { 
      if(experiment.value==0) { experiment.hide = true; }
    }
  }
  //document.getElementById("message").innerHTML = "remove unselected experiments : "+source_ids;
  //prepareTrackXHR(trackID);
  //gLyphsAutosaveConfig();
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(trackID);
}


function gLyphsDrawExpressionPanel() {
  if(current_resizeTrack) { return; }

  if(!current_region.active_trackID) { 
    gLyphsDrawExperimentExpression();
    return; 
  }
  
  var glyphTrack = gLyphTrack_array[current_region.active_trackID];
  if(glyphTrack && glyphTrack.loading) { return; }

  if(glyphTrack.delay_experiment_draw) { return; }
    
  if(current_feature && (current_feature.trackID == current_region.active_trackID)) {
    processFeatureExpressExperiments(glyphTrack, current_feature);
  } else if(glyphTrack.has_expression) {  
    // track with expression (either feature/color or wiggle)
    processFeatureRegionExperiments(glyphTrack);
  }
  gLyphsDrawExperimentExpression();
  updateTitleBar();
}


//======================================================================================
//
// new experiment-expression panel interface
//
//======================================================================================

function gLyphsDrawExperimentExpression() { 
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }

  var glyphTrack = gLyphTrack_array[current_region.active_trackID];
  if(!glyphTrack) { return; }
    
  //maybe change to use just the track
  if(!glyphTrack.experiment_array || (glyphTrack.experiment_array.length==0))  {
    if(expframe) { expframe.setAttribute('style', "visibility:hidden;"); }
    return;
  }
  
  //reposition
  var xpos = expframe.getAttribute("xpos");
  var ypos = expframe.getAttribute("ypos");
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) {
    frame_width = current_region.display_width;
  }
    
  if(xpos && ypos) { //floating
    expframe.setAttribute('style', 
                          "width:"+frame_width+"px; z-index:50; padding: 2px 2px 2px 2px; "+
                          "background-color:rgb(245,245,250); border:inset; border-width:2px; "+
                          "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  } else { //attached at bottom
    expframe.setAttribute('style', 
                          "width:"+frame_width+"px; z-index:50; padding: 2px 2px 2px 2px; "+
                          "background-color:rgb(245,245,250); border:inset; border-width:2px; ");
  }
  
  //build display experiment list
  var total_exp_count=0;
  var unfilter_exp_count=0;
  var experiments = new Array;
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    total_exp_count++;
    if(!experiment.hide) { unfilter_exp_count++ }
    if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
    //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
    experiments.push(experiment);
  }
  
  //sub panels
  var auxdiv = document.getElementById("experiment_express_auxdiv");
  if(!auxdiv) {
    auxdiv = expframe.appendChild(document.createElement('div'));
    auxdiv.id = "experiment_express_auxdiv";
    auxdiv.setAttribute('style', "width:100%; position:relative;");
    gLyphsToggleExpressionSubpanel('none'); //build the sub-panels
  }
  gLyphsToggleExpressionSubpanel(); //refresh the sub-panels
  
  //header
  var headerdiv = document.getElementById("experiment_express_headerdiv");
  if(!headerdiv) {
    headerdiv = expframe.appendChild(document.createElement('div'));
    headerdiv.id = "experiment_express_headerdiv";
    headerdiv.setAttribute('style', "width:100%;");
  }  
  clearKids(headerdiv);
  var header_g = gLyphsExpressionPanelHeader();
  var svg = createSVG(frame_width, 30);
  svg.appendChild(header_g);
  headerdiv.appendChild(svg);

  //calc the text colors
  glyphTrack.posTextColor = "rgb(44,44,44)";
  glyphTrack.revTextColor = "rgb(44,44,44)";
  var cl1 = new RGBColor(glyphTrack.posStrandColor);
  if(cl1.ok) {
    var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
    if(Y<=0.28) { 
      //glyphTrack.posTextColor = "lightgray"; 
      //glyphTrack.posTextColor = "rgb(192, 192, 192)";
      glyphTrack.posTextColor = "rgb(230, 230, 230)";
    }
    //cl1.r = 255 - cl1.r;
    //cl1.g = 255 - cl1.g;
    //cl1.b = 255 - cl1.b;
    //glyphTrack.posTextColor = cl1.toRGB();
  }
  var cl2 = new RGBColor(glyphTrack.revStrandColor);
  if(cl2.ok) {
    var Y = 0.2126 * Math.pow(cl2.r/255.0,2.2)  +  0.7151 * Math.pow(cl2.g/255.0,2.2)  +  0.0721 * Math.pow(cl2.b/255.0,2.2);
    if(Y<=0.28) { 
      //glyphTrack.revTextColor = "lightgray"; 
      //glyphTrack.revTextColor = "rgb(192, 192, 192)";
      glyphTrack.revTextColor = "rgb(230, 230, 230)";
    }
    //cl2.r = 255 - cl2.r;
    //cl2.g = 255 - cl2.g;
    //cl2.b = 255 - cl2.b;
    //glyphTrack.revTextColor = cl2.toRGB();
  }
  
  //
  // content graph divs with optional internal scroll panel
  // 
  var graph_msgdiv = document.getElementById("express_panel_graph_msgdiv");
  if(!graph_msgdiv) {
    graph_msgdiv = expframe.appendChild(document.createElement('div'));
    graph_msgdiv.id = "express_panel_graph_msgdiv";
    graph_msgdiv.setAttribute('style', "width:100%; background-color:rgb(245,245,250); color:rgb(153,50,204); \
                              font-size:14px; font-weight:bold; font-family:arial,helvetica,sans-serif; \
                              margin: 7px 0px 0px 10px; display:none;");
  }
  
  var graphdiv = document.getElementById("experiment_express_graphdiv");
  if(!graphdiv) {
    graphdiv = expframe.appendChild(document.createElement('div'));
    graphdiv.id = "experiment_express_graphdiv";
    graphdiv.setAttribute('style', "width:100%; height:100px; background-color:rgb(245,245,250); "+
                          "min-height:100px; overflow-y:scroll; resize:vertical;");
  }
  clearKids(graphdiv);
  if(current_region.exppanel_subscroll) {
    graphdiv.setAttribute('style', "width:100%; height:500px; background-color:rgb(245,245,250); "+
                          "min-height:500px; overflow-y:scroll; resize:vertical;");
  } else {
    graphdiv.setAttribute('style', "width:100%; background-color:rgb(245,245,250);");
  }

  //render the graph in the different modes
  var graph_g1 = gLyphsRenderExpressionPanelGraph(glyphTrack);
  var graph_height = 12*experiments.length;
  if(glyphTrack.exppanelmode == "mdgroup") {
    if(glyphTrack.experiment_mdgrouping) { graph_height = 12*glyphTrack.experiment_mdgrouping.length; }
    else { graph_height = 0; }
  }
  if(glyphTrack.exppanelmode == "ranksum") { 
    //if(glyphTrack.experiment_ranksum_enrichment) { graph_height = 12*glyphTrack.experiment_ranksum_enrichment.length; }
    if(graph_g1.getAttribute('ranksum_graph_height')) {
      graph_height = parseFloat(graph_g1.getAttribute('ranksum_graph_height'));
    }
    //if(graph_height<100) { graph_height=100; }
  }
  var graph_width  = frame_width - 20;  
  var svg2 = createSVG(graph_width, graph_height);
  if(graph_g1) { svg2.appendChild(graph_g1); }
  graphdiv.appendChild(svg2);  
  
  //rebuild export if needed
  if(current_region.expression_subpanel_mode == "export")  { 
    var exportdiv = gLyphsExpressionPanelExportSubpanel();
    exportdiv.style.display = "block"; 
  }
}


function gLyphsExpressionPanelHeader() {  
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }

  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = current_region.display_width; }

  var header_g = document.getElementById("experiment_express_header");
  if(!header_g) {
    //var svg = createSVG(frame_width, 30);
    var header_g = document.createElementNS(svgNS,'g');
    header_g.id = "experiment_express_header";
    //svg.appendChild(header_g);
    //expframe.appendChild(svg);
  }

  //for now still bind to a single track or selected feature
  var glyphTrack = gLyphTrack_array[current_region.active_trackID];
  if(!glyphTrack) { return; }
  var strandless = glyphTrack.strandless;

  var total_exp_count=0;
  var unfilter_exp_count=0;
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    total_exp_count++;
    if(experiment.hide) { continue; } 
    //if(glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
    unfilter_exp_count++
  }
  
  var ss;
  var se; 
  if(current_feature && (current_feature.trackID == current_region.active_trackID)) {
    ss = current_feature.start;
    se = current_feature.end;
  } else {
    ss = current_region.start;
    se = current_region.end;
    if(glyphTrack.selection) { 
      ss = glyphTrack.selection.chrom_start;
      se = glyphTrack.selection.chrom_end;
    }
  }
  if(ss>se) { var t=ss; ss=se; se=t; }
  var len = se-ss+1;
  if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
  else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
    
  else { len += "bp"; }
  var subheading_text = current_region.chrom+" "+ss +".."+se+" ("+len+")"; 
  
  // title bar, controls, and headers  
  header_g.setAttributeNS(null, "font-size","8pt");
  header_g.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  clearKids(header_g);

  var clip1 = header_g.appendChild(document.createElementNS(svgNS,'clipPath'));
  clip1.id = "expexp_header_clip1";
  var cliprec1 = clip1.appendChild(document.createElementNS(svgNS,'rect'));
  cliprec1.setAttribute('x', '0px');
  cliprec1.setAttribute('y', '0px');
  cliprec1.setAttribute('width', (frame_width-295)+'px');
  cliprec1.setAttribute('height', '18px');
  
  // make a rectangle for the "title bar" 
  var title_g = header_g.appendChild(document.createElementNS(svgNS,'g'));
  if(!current_region.exportSVGconfig) {
    title_g.setAttributeNS(null, "onmousedown", "gLyphsExperimentGraphToggleDrag('start');");
    title_g.setAttributeNS(null, "onmouseup", "gLyphsExperimentGraphToggleDrag('stop');");
  }
  var titleBar = title_g.appendChild(document.createElementNS(svgNS,'rect'));
  titleBar.setAttributeNS(null, 'x', '0px');
  titleBar.setAttributeNS(null, 'y', '0px');
  titleBar.setAttributeNS(null, 'width',  (frame_width-100)+'px');
  titleBar.setAttributeNS(null, 'height', '18px');
  titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;');
  
  var titlepos = 8;
  if(!current_region.exportSVGconfig && expframe && expframe.getAttribute("xpos") && expframe.getAttribute("ypos")) {
    //floating
    var reattach = gLyphsCreateExperimentExpressReattachWidget();
    reattach.setAttributeNS(null, 'transform', "translate(5,3)");
    header_g.appendChild(reattach);
    titlepos +=17;
  }
  var heading = title_g.appendChild(document.createElementNS(svgNS,'text'));
  heading.setAttribute('clip-path', "url(#expexp_header_clip1)");
  heading.setAttributeNS(null, 'x', titlepos+"px");
  heading.setAttributeNS(null, 'y', '14px');
  heading.setAttributeNS(null, "font-weight","bold");
  heading.setAttributeNS(null, "font-size","12pt");
  heading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  if(current_feature && (current_feature.trackID == current_region.active_trackID)) {
   heading.appendChild(document.createTextNode(current_feature.name +" ~ "+glyphTrack.title));
  } else {
   heading.appendChild(document.createTextNode(glyphTrack.title));
  }
  
  var subheading = title_g.appendChild(document.createElementNS(svgNS,'text'));
  subheading.setAttributeNS(null, 'x', (frame_width-290)+'px');
  subheading.setAttributeNS(null, 'y', '12px');
  subheading.setAttributeNS(null, "font-size","8pt");
  subheading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  subheading.appendChild(document.createTextNode(subheading_text));
  
  //widgets
  var widgetBar = header_g.appendChild(document.createElementNS(svgNS,'rect'));
  widgetBar.setAttributeNS(null, 'x', (frame_width-100)+'px');
  widgetBar.setAttributeNS(null, 'y', '0px');
  widgetBar.setAttributeNS(null, 'width',  "100px");
  widgetBar.setAttributeNS(null, 'height', "18px");
  widgetBar.setAttributeNS(null, 'style', "fill: #D7D7D7;");
  //widgetBar.setAttributeNS(null, 'style', "fill: #07D7D7;");

  var groupwidget = gLyphsCreateExperimentExpressGroupingWidget();
  groupwidget.setAttributeNS(null, 'transform', "translate("+(frame_width-103)+",3)");
  header_g.appendChild(groupwidget);
  
  var filterwidget = gLyphsCreateExperimentExpressFilterWidget();
  filterwidget.setAttributeNS(null, 'transform', "translate("+(frame_width-65)+",3)");
  header_g.appendChild(filterwidget);
    
  var configwidget = gLyphsCreateExpressionPanelConfigWidget();
  configwidget.setAttributeNS(null, 'transform', "translate("+(frame_width-34)+",4)");
  header_g.appendChild(configwidget);
  
  var export1 = gLyphsCreateExperimentExpressExportWidget();
  export1.setAttributeNS(null, 'transform', "translate("+(frame_width-18)+",3)");
  header_g.appendChild(export1);
  
  //column headers experiment/mdata name - strand info line
  var nametitle = "experiment name ("+unfilter_exp_count+" / "+ total_exp_count + ")";
  if(glyphTrack.exppanelmode == "mdgroup") {
    nametitle = "metadata group ["+glyphTrack.mdgroupkey+"] ("+unfilter_exp_count+" / "+ total_exp_count + " exps)";
  }
  if(glyphTrack.exppanelmode == "ranksum") { 
    nametitle = "rank-sum enrichment ("+unfilter_exp_count+" / "+ total_exp_count + " exps)";
  }
  var head1 = document.createElementNS(svgNS,'text');
  head1.setAttributeNS(null, 'x', '4px');
  head1.setAttributeNS(null, 'y', '28px');
  head1.setAttributeNS(null, "font-size","8pt");
  head1.appendChild(document.createTextNode(nametitle));
  if(express_sort_mode == "name") {
    head1.setAttributeNS(null, "font-weight","bold");
  }
  if(!current_region.exportSVGconfig) {
    head1.setAttributeNS(null, "onclick", "change_express_sort('name');");
    head1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort experiment name',110);");
    head1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  header_g.appendChild(head1);
  
  
  if(!strandless) {
    var head1 = document.createElementNS(svgNS,'text');
    head1.setAttributeNS(null, 'x', (frame_width-280)+'px');
    head1.setAttributeNS(null, 'y', '28px');
    head1.setAttributeNS(null, 'text-anchor', "end");
    head1.setAttributeNS(null, "font-size","8pt");
    head1.appendChild(document.createTextNode("<- anti-sense strand"));
    if(express_sort_mode == "value_minus") {
      head1.setAttributeNS(null, "font-weight","bold");
      //head1.setAttributeNS(null, "style", "color:purple");
    }
    if(!current_region.exportSVGconfig) {
      head1.setAttributeNS(null, "onclick", "change_express_sort('value_minus');");
      head1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort anti-sense strand',100);");
      head1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head1);
    
    var head2 = document.createElementNS(svgNS,'text');
    head2.setAttributeNS(null, 'x', (frame_width-265)+'px');
    head2.setAttributeNS(null, 'y', '28px');
    head2.setAttributeNS(null, "font-size","8pt");
    head2.appendChild(document.createTextNode("<>"));
    if(express_sort_mode == "value_both") {
      head2.setAttributeNS(null, "font-weight","bold");
      head2.setAttributeNS(null, "font-size","10pt");
    }
    if(!current_region.exportSVGconfig) {
      head2.setAttributeNS(null, "onclick", "change_express_sort('value_both');");
      head2.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort both strands',90);");
      head2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head2);
    
    var head2 = document.createElementNS(svgNS,'text');
    head2.setAttributeNS(null, 'x', (frame_width-240)+'px');
    head2.setAttributeNS(null, 'y', '28px');
    head2.setAttributeNS(null, "font-size","8pt");
    head2.appendChild(document.createTextNode("sense strand ->"));
    if(express_sort_mode == "value_plus") {
      head2.setAttributeNS(null, "font-weight","bold");
      //head2.setAttributeNS(null, "style", "color:green");
    }
    if(!current_region.exportSVGconfig) {
      head2.setAttributeNS(null, "onclick", "change_express_sort('value_plus');");
      head2.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort sense strand',100);");
      head2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head2);
  } else {
    var head1 = document.createElementNS(svgNS,'text');
    head1.setAttributeNS(null, 'x', (frame_width-470)+'px');
    head1.setAttributeNS(null, 'y', '28px');
    head1.setAttributeNS(null, "font-size","8pt");
    head1.appendChild(document.createTextNode("strandless"));
    if((express_sort_mode == "value_both") || (express_sort_mode == "value_plus")) {
      head1.setAttributeNS(null, "font-weight","bold");
      //head1.setAttributeNS(null, "style", "color:blue");
    }
    if(!current_region.exportSVGconfig) {
      head1.setAttributeNS(null, "onclick", "change_express_sort('value_both');");
      head1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort strandless',80);");
      head1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head1);
  }
  return header_g;
}


function gLyphsRenderExpressionPanelGraph(glyphTrack) {
  var graph_g1;
  if(!glyphTrack) { 
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return graph_g1; }
  
  if(!glyphTrack.exppanelmode ||(glyphTrack.exppanelmode=="experiments")) { 
    //tranditional single track show expression
    graph_g1 = gLyphsExpressionPanelRenderExperimentMode(glyphTrack);
  }
  if(glyphTrack.exppanelmode == "mdgroup") { 
    //metadata key grouping mode
    graph_g1 = gLyphsExpressionPanelRenderMDGroupMode(glyphTrack);
  }
  if(glyphTrack.exppanelmode == "ranksum") { 
    graph_g1 = gLyphsExpressionPanelRankSumRender(glyphTrack);
  }
  return graph_g1;
}


function gLyphsExpressionPanelRenderExperimentMode(glyphTrack) { 
  //original method shows one line per experiment
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }  

  if(!glyphTrack) { 
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return; }

  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = current_region.display_width; }
  var graph_width  = frame_width - 20;
    
  //build display experiment list & calculate max_value for scaling
  var max_value = 0.0;
  var experiments = new Array;
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
    //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
    experiments.push(experiment);
    
    //calculate the max
    var value           = experiment.value;
    var sense_value     = experiment.sense_value;
    var antisense_value = experiment.antisense_value;
    
    if(glyphTrack.strandless) {
      if(value > max_value) { max_value = value; }
    } else {
      if(sense_value > max_value)     { max_value = sense_value; }
      if(antisense_value > max_value) { max_value = antisense_value; }
    }    
  }  
  var graph_height = 12*experiments.length;
  
  //pre-generate new dynamic names so they can be sorted
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    gLyphsExperimentName(glyphTrack, experiment);
  }
  experiments.sort(gLyphs_express_sort_func); //make sure it is sorted
    
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');

  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    
    //make background box
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((i*12)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', '12px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    //back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    //back_rect.setAttributeNS(null, 'visibility', "hidden");
    if(!current_region.exportSVGconfig) {
      back_rect.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
      back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
      back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    experiment.back_rect = back_rect;
    g2.appendChild(back_rect);

    //calculate the max
    var value           = experiment.value;
    var sense_value     = experiment.sense_value;
    var antisense_value = experiment.antisense_value;
        
    //draw the experiment names
    var hideGlyph = gLyphsCreateHideExperimentWidget(experiment, i);
    if(hideGlyph) { g2.appendChild(hideGlyph); }
    
    var exptype   = experiment.exptype;
    var expname   = experiment.expname;
    var expID     = experiment.id;
    var value     = experiment.value;
    var sig_error = experiment.sig_error;
    var hide      = experiment.hide;
    
    //ID magic to deal with proxy_id experiments
    var expID2 = expID;
    if(experiment.orig_id) { expID2 = experiment.orig_id; }
    
     // don't truncate the experiment names anymore
     //if(expname) {
     //var expname2 = expname.substring(0,41);
     //if(expname != expname2) { expname = expname2 +"..."; }
     //}
    if(expname == undefined) { expname = "loading names..."; }
    if(exptype) { expname += " ["+ exptype +"]"; }
    
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+9) +'px');
    if(!current_region.exportSVGconfig) {
      text.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +expID+ "\");");
      text.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + expID2+"\");");
      text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    if(experiment.hide) { text.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
    else { text.setAttributeNS(null, 'style', 'fill: black;'); }


    text.appendChild(document.createTextNode(expname));
    g2.appendChild(text);
  }
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g')); //parent for expression levels
  
  var g5a = g3.appendChild(document.createElementNS(svgNS,'g')); //bars -
  var g5b = g3.appendChild(document.createElementNS(svgNS,'g')); //bars +
  
  var g4a = g3.appendChild(document.createElementNS(svgNS,'g')); //text -
  var g4b = g3.appendChild(document.createElementNS(svgNS,'g')); //text +
  
  var scale = 0;
  if(max_value>0) { scale = 225.0 / max_value; }
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];

    var value           = experiment.value;
    var sense_value     = experiment.sense_value;
    var antisense_value = experiment.antisense_value;
    var sig_error       = experiment.sig_error;
    
    //if((sig_error < 0.01) || (sig_error >0.99)) ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
    //else ctx.fillStyle = "rgba(170, 170, 170, 0.5)";
    //ctx.fillRect (270, i*12+2, newvalue, 10);
    
    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', (graph_width-470)+'px');
      rect.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      //if((sig_error < 0.01) || (sig_error >0.99)) rect.setAttributeNS(null, 'fill', "rgb(123, 123, 240)");
      //else rect.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
      else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
      g5b.appendChild(rect);
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-460)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.setAttributeNS(null, 'style', 'fill:' + glyphTrack.posTextColor); 
      text1.appendChild(document.createTextNode(Math.round(value*1000.0)/1000.0));
      g4b.appendChild(text1);
      
      if(experiment.hide) { 
        rect.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
      if(!current_region.exportSVGconfig) {
        rect.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        text1.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', (graph_width-240)+'px');
      rect1.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      //if((sig_error < 0.01) || (sig_error >0.99)) rect1.setAttributeNS(null, 'fill', "rgb(57, 177, 58)");  //green
      //else rect1.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      if(glyphTrack.exppanel_use_rgbcolor) { rect1.setAttributeNS(null, 'fill', experiment.rgbcolor); }
      else { rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
      g5b.appendChild(rect1);
      
      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (graph_width-240-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      //if((sig_error < 0.01) || (sig_error >0.99)) rect2.setAttributeNS(null, 'fill', "rgb(177, 89, 178)");  //purple
      //else rect2.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      if(glyphTrack.exppanel_use_rgbcolor) { rect2.setAttributeNS(null, 'fill', experiment.rgbcolor); }
      else { rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); }
      g5a.appendChild(rect2);
            
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-235)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.appendChild(document.createTextNode(Math.round(sense_value*1000.0)/1000.0));
      //if(experiment.hide) { text1.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posTextColor); }
      text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posTextColor); 
      g4b.appendChild(text1);
      
      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', (graph_width-245)+'px');
      text2.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(antisense_value*1000.0)/1000.0));
      //if(experiment.hide) { text2.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revTextColor); }
      text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revTextColor);
      g4a.appendChild(text2);
      
      if(experiment.hide) { 
        rect1.setAttribute('style', "opacity:0.2");        
        rect2.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        text2.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        //text1.setAttribute('style', "opacity:0.2");        
        //text2.setAttribute('style', "opacity:0.2");        
      }
      if(!current_region.exportSVGconfig) {
        rect1.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        rect1.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        rect2.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        rect2.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        text1.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        text2.setAttributeNS(null, "onclick", "gLyphsLoadObjectInfo(\"" +experiment.id+ "\");");
        text2.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
    }
  }

  return g1;
}

function gLyphsExperimentName(glyphTrack, source) { 
  var name = undefined;
  if(!source) { return name; }

  if(source.name) { name = source.name; } //default

  if(!glyphTrack) { return name; }
  if(!glyphTrack.exp_name_mdkeys) { return name; }
  if(!source.mdata) { return name; }

  //finite state machine parser
  name = "";
  var mdkey = "";
  var state=1;
  var pos=0;
  while(state>0) {
    if(pos > glyphTrack.exp_name_mdkeys.length) { state=-1; break; }
    var c1 = glyphTrack.exp_name_mdkeys.charAt(pos);

    switch(state) {
      case(1): //mdkey
        if(c1==" " || c1=="\t" || c1=="\n" || c1=="," || c1=="\"") { 
          state=2;
        } else {
          mdkey += c1;
          pos++;
        }
        break;

      case(2): // add mdkey value to name
        //document.getElementById("message").innerHTML += "mdkey["+mdkey+"] ";
        if(mdkey && source.mdata[mdkey]) { 
          if(name) { name += " "; }
          name += source.mdata[mdkey]; 
        }
        mdkey = "";
        if(c1=="\"") { state=3; } else { state=1;}
        pos++;
        break;

      case(3): // quoted string
        if(c1=="\"") { 
          if(name) { name += " "; }
          name += mdkey; 
          mdkey = "";
          pos++;
          state = 1;
        } else {
          mdkey += c1;
          pos++;
        }
        break;

      default:
        state=-1;
        break;
    }
  }

  source.expname = name;
  return name;
}


function gLyphsExpressionPanelRenderMDGroupMode(glyphTrack) { 
  //original method shows one line per experiment
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return g1; }  
  
  if(!glyphTrack) { 
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return g1; }
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = current_region.display_width; }
  var graph_width  = frame_width - 20;
  
  if(!glyphTrack.experiment_mdgrouping) {
    gLyphsTrackFetchMetadataGrouping(current_region.active_trackID);  //async
  }
  
  if(!glyphTrack.experiment_mdgrouping || (glyphTrack.experiment_mdgrouping.length == 0)) { 
    return g1;
  }  
    
  //update the experiment_mdgrouping with current experiment_array values
  var max_value = 0.0;
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    mdgroup.value = 0;
    mdgroup.sense_value = 0;
    mdgroup.antisense_value = 0;
    mdgroup.value_total = 0;
    mdgroup.sense_total = 0;
    mdgroup.antisense_total = 0;
    
    if(mdgroup.source_ids.length==0) { continue; }
    
    var avgR=0, avgG=0, avgB=0, colorCnt=0;;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) {
        //document.getElementById("message").innerHTML += "noid["+srcid+"] ";
        continue;
      }
      if(experiment.hide) { continue; }
      //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
      //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
      if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }

      //calculate sums/mean
      mdgroup.value_total     += experiment.value;
      mdgroup.sense_total     += experiment.sense_value;
      mdgroup.antisense_total += experiment.antisense_value;

      if(experiment.rgbcolor) {
        //document.getElementById("message").innerHTML += " ["+experiment.rgbcolor+"] ";
        var cl2 = new RGBColor(experiment.rgbcolor);
        avgR += cl2.r;
        avgG += cl2.g;
        avgB += cl2.b;
        colorCnt++;
      }
    }
    mdgroup.value           = mdgroup.value_total / mdgroup.source_ids.length;
    mdgroup.sense_value     = mdgroup.sense_total / mdgroup.source_ids.length;
    mdgroup.antisense_value = mdgroup.antisense_total / mdgroup.source_ids.length;
        
    //calc error bar (stddev for now)
    mdgroup.value_error = 0;
    mdgroup.sense_error = 0;
    mdgroup.antisense_error = 0;
    if(mdgroup.source_ids.length>1) {
      for(var j=0; j<mdgroup.source_ids.length; j++) {
        var srcid = mdgroup.source_ids[j];
        var experiment = glyphTrack.experiments[srcid];
        if(!experiment) { continue; }
        if(experiment.hide) { continue; }
        //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
        //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }

        //calculate sums/mean
        mdgroup.value_error     += (experiment.value - mdgroup.value) * (experiment.value - mdgroup.value);
        mdgroup.sense_error     += (experiment.sense_value - mdgroup.sense_value) * (experiment.sense_value - mdgroup.sense_value);
        mdgroup.antisense_error += (experiment.antisense_value - mdgroup.antisense_value) * (experiment.antisense_value - mdgroup.antisense_value);
      }
      //sample standard deviation : sqrt (sum-of-squares / (n-1) )
      mdgroup.value_error     = Math.sqrt(mdgroup.value_error / (mdgroup.source_ids.length-1));
      mdgroup.sense_error     = Math.sqrt(mdgroup.sense_error / (mdgroup.source_ids.length-1));
      mdgroup.antisense_error = Math.sqrt(mdgroup.antisense_error / (mdgroup.source_ids.length-1));

      //standard error of the mean : stddev \ sqrt (n)
      if(glyphTrack.errorbar_type == "stderror") { 
        mdgroup.value_error     = mdgroup.value_error / Math.sqrt(mdgroup.source_ids.length);
        mdgroup.sense_error     = mdgroup.sense_error / Math.sqrt(mdgroup.source_ids.length);
        mdgroup.antisense_error = mdgroup.antisense_error / Math.sqrt(mdgroup.source_ids.length);
      }
    }

    //calc max
    if(glyphTrack.strandless) {
      if(mdgroup.value+mdgroup.value_error > max_value) { max_value = mdgroup.value+mdgroup.value_error; }
    } else {
      if(mdgroup.sense_value+mdgroup.sense_error > max_value)     { max_value = mdgroup.sense_value+mdgroup.sense_error; }
      if(mdgroup.antisense_value+mdgroup.antisense_error > max_value) { max_value = mdgroup.antisense_value+mdgroup.antisense_error; }
    }

    if(!mdgroup.rgbcolor && colorCnt>0) {
      //calculate the average color of all the experiments
      mdgroup.rgbcolor = "#FF00FF";
      avgR = parseInt(avgR / colorCnt);
      avgG = parseInt(avgG / colorCnt);
      avgB = parseInt(avgB / colorCnt);
      var color = new RGBColour(avgR, avgG, avgB);
      mdgroup.rgbcolor = color.getCSSHexadecimalRGB();
      document.getElementById("message").innerHTML += " ["+avgR +":"+avgG+":"+avgB+"]"+ mdgroup.rgbcolor;
    }
  }
    
  glyphTrack.experiment_mdgrouping.sort(gLyphs_exppanel_mdgroup_sort_func);
  clearKids(g1);

  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];

    //make background box
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((i*12)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', '12px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    if(!current_region.exportSVGconfig) {
      back_rect.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
      back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
      back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    mdgroup.back_rect = back_rect;
    g2.appendChild(back_rect);

    //draw the names
    var name ="";
    if(mdgroup.mdvalue) { name += mdgroup.mdvalue; }
    name += " ("+mdgroup.source_ids.length+" exps)";
        
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+9) +'px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    if(!current_region.exportSVGconfig) {
      text.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
      text.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
      text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    
    if(mdgroup.hide) { text.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
    else { text.setAttributeNS(null, 'style', 'fill: black;'); }

    text.appendChild(document.createTextNode(name));
    g2.appendChild(text);
  }
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g')); //parent for expression levels
  
  var g5a = g3.appendChild(document.createElementNS(svgNS,'g')); //bars -
  var g5b = g3.appendChild(document.createElementNS(svgNS,'g')); //bars +
  
  var g4a = g3.appendChild(document.createElementNS(svgNS,'g')); //text -
  var g4b = g3.appendChild(document.createElementNS(svgNS,'g')); //text +
  
  var scale = 0;
  if(max_value>0) { scale = 225.0 / max_value; }
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];

    var value           = mdgroup.value;
    var sense_value     = mdgroup.sense_value;
    var antisense_value = mdgroup.antisense_value;
        
    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', (graph_width-470)+'px');
      rect.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      //rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', mdgroup.rgbcolor); }
      else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }

      if(!current_region.exportSVGconfig) {
        rect.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect);

      if(mdgroup.value_error>0) {
        var error_width = mdgroup.value_error * 2*scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-470+(2*scale*value))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        if(!current_region.exportSVGconfig) {
          error1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
          error1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
          error1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
        g5b.appendChild(error1);
      }      

      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-460)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      var cl1 = new RGBColor(glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { if(mdgroup.rgbcolor) { cl1 = new RGBColor(mdgroup.rgbcolor); } else { cl1 = new RGBColor("black"); } }
      var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
      var textColor = "rgb(44,44,44);"; //or black
      if(Y<=0.28) { textColor = "rgb(230, 230, 230);"; }
      text1.setAttributeNS(null, 'style', 'fill: '+textColor); 
      text1.appendChild(document.createTextNode(Math.round(value*1000.0)/1000.0));
      if(!current_region.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      if(mdgroup.hide) { 
        rect.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', (graph_width-240)+'px');
      rect1.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      //rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { rect1.setAttributeNS(null, 'fill', mdgroup.rgbcolor); }
      else { rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }

      if(!current_region.exportSVGconfig) {
        rect1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect1);

      if(mdgroup.sense_error>0) {
        var error_width = mdgroup.sense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240+(sense_value * scale))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        if(!current_region.exportSVGconfig) {
          error1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
          error1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
          error1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
        g5b.appendChild(error1);
      }      
      
      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (graph_width-240-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      //rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { rect2.setAttributeNS(null, 'fill', mdgroup.rgbcolor); }
      else { rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); }

      if(!current_region.exportSVGconfig) {
        rect2.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect2.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5a.appendChild(rect2);
      
      if(mdgroup.antisense_error>0) {
        var error_width = mdgroup.antisense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240-width2)+" "+((i*12)+5.5)+
                            " h-"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        if(!current_region.exportSVGconfig) {
          error1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
          error1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
          error1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
        g5b.appendChild(error1);
      }      
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-235)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.appendChild(document.createTextNode(Math.round(sense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text1.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text1.setAttributeNS(null, 'style', 'fill: black;'); }
      var cl1 = new RGBColor(glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { if(mdgroup.rgbcolor) { cl1 = new RGBColor(mdgroup.rgbcolor); } else { cl1 = new RGBColor("black"); } }
      var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
      var textColor = "rgb(44,44,44);"; //or black
      if(Y<=0.28) { textColor = "rgb(230, 230, 230);"; }
      text1.setAttributeNS(null, 'style', 'fill:'+textColor); 
      if(!current_region.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', (graph_width-245)+'px');
      text2.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(antisense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text2.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text2.setAttributeNS(null, 'style', 'fill: black;'); }
      var cl1 = new RGBColor(glyphTrack.revStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { if(mdgroup.rgbcolor) { cl1 = new RGBColor(mdgroup.rgbcolor); } else { cl1 = new RGBColor("black"); } }
      var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
      var textColor = "rgb(44,44,44);"; //or black
      if(Y<=0.28) { textColor = "rgb(230, 230, 230);"; }
      text2.setAttributeNS(null, 'style', 'fill:'+textColor); 
      if(!current_region.exportSVGconfig) {
        text2.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text2.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4a.appendChild(text2);
      
      if(mdgroup.hide) { 
        rect1.setAttribute('style', "opacity:0.2");        
        rect2.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        text2.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    }
  }
  
  return g1;
}

function gLyphs_exppanel_mdgroup_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  var rtnval=0;
  if(express_sort_mode == 'name') {
    if(!a.mdvalue && !b.mdvalue) { return 0; }
    if(!a.mdvalue) { return 1; }
    if(!b.mdvalue) { return -1; }
    if(a.mdvalue.toLowerCase() == b.mdvalue.toLowerCase()) { return 0; }
    if(a.mdvalue.toLowerCase() > b.mdvalue.toLowerCase()) { return 1; }
    return -1;
  }
  else if(express_sort_mode == 'value_both') {
    var value_a = a.value;
    var value_b = b.value;
    rtnval = value_b - value_a;
  }
  else if(express_sort_mode == 'value_plus') {
    var value_a = a.sense_value;
    var value_b = b.sense_value;
    rtnval = value_b - value_a;
  }
  else if(express_sort_mode == 'value_minus') {
    var value_a = a.antisense_value;
    var value_b = b.antisense_value;
    rtnval = value_b - value_a;
  }
  return rtnval;
}

//---- express panel move, resize, attach tools -----------------------------------------------------------


function gLyphsCreateExperimentExpressReattachWidget() {
  var g1 = document.createElementNS(svgNS,'g');

  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '12px');
  rect.setAttributeNS(null, 'height', '12px');
  rect.setAttributeNS(null, 'style', 'fill: lightgray;  stroke: lightgray;');
  if(!current_region.exportSVGconfig) {
    rect.setAttributeNS(null, "onclick", "gLyphsReattachExpGraph();");
    rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"reattach panel\",80);");
    rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }

  var poly = document.createElementNS(svgNS,'polyline');
  poly.setAttributeNS(null, 'points', '10,0 12,2 5,9 5,12 0,12 0,7 3,7 10,0');
  //poly.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  poly.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray; fill:white;');
  if(!current_region.exportSVGconfig) {
    poly.setAttributeNS(null, "onclick", "gLyphsReattachExpGraph();");
    poly.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"reattach panel\",80);");
    poly.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(poly);

  return g1;
}


function gLyphsReattachExpGraph() {
  //reset the global events back
  document.onmousemove = moveToMouseLoc;
  document.onmouseup = endDrag;

  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }
  expframe.removeAttribute("xpos");
  expframe.removeAttribute("ypos");
  gLyphsDrawExperimentExpression();
  return false;
}


function gLyphsExperimentGraphToggleDrag(mode, e) {
  if (!e) var e = window.event
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { 
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    document.onmouseup   = endDrag;
    return; 
  }
  if(!expframe.getAttribute("xpos")) { expframe.setAttribute("xpos", 0); }
    
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  
  if(!expframe.getAttribute("is_moving") || (mode =='start')) { 
    expframe.setAttribute("is_moving", 1);
    document.onmousemove = experimentGraphMoveEvent;
    
    var offset = xpos - expframe.getAttribute("xpos");
    if(offset<30)  { offset=30;}
    if(offset>900) { offset=900; }
    expframe.setAttribute("move_offset", offset);
    experimentGraphMoveEvent(e);    
  } else {
    //stop moving
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    document.onmouseup = endDrag;
    
    if(ns4) toolTipSTYLE.visibility = "hidden";
    else toolTipSTYLE.display = "none";
    
    expframe.removeAttribute("is_moving");
    gLyphsExpressionPanelHeader();  //shows the reattach widget
  }
}


function experimentGraphMoveEvent(e) {
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }
  
  if(!expframe.getAttribute("is_moving")) { return; }
  
  moveToMouseLoc(e);
  
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  
  var offset = expframe.getAttribute("move_offset");
  
  //
  // now move the experiment frame
  //
  var xpos = (toolTipSTYLE.xpos - offset);
  var ypos = toolTipSTYLE.ypos - 15;
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = current_region.display_width; }
  
  expframe.setAttribute('xpos', xpos);
  expframe.setAttribute('ypos', ypos);
  expframe.setAttribute('style', 
                        "width:"+frame_width+"px; z-index:50; padding: 2px 2px 2px 2px; position:absolute; "+
                        "background-color:rgb(245,245,250); border:inset; border-width:2px; "+
                        "left:"+ xpos +"px; top:"+ ypos +"px;");
}


//----- subpanel tools ---------------------------------------------------------------------

function gLyphsToggleExpressionSubpanel(mode) {
  var filterdiv =  gLyphsExpressionPanelFilterSubpanel();
  if(!filterdiv) { return; }
  
  var groupingdiv = gLyphsExpressionPanelGroupingSubpanel();
  if(!groupingdiv) { return; }
  
  var configdiv = gLyphsExpressionPanelConfigSubpanel();
  if(!configdiv) { return; }

  var exportdiv = document.getElementById("experiment_express_export_subpanel");

  if(!mode) { return; }
  
  if(mode == current_region.expression_subpanel_mode) { mode = "none"; }
  current_region.expression_subpanel_mode = mode;  

  filterdiv.style.display   = "none";
  groupingdiv.style.display = "none";
  configdiv.style.display   = "none";
  if(exportdiv) { exportdiv.style.display = "none"; }
  
  if(mode == "filter")  { filterdiv.style.display = "block"; }
  if(mode == "group")   { groupingdiv.style.display = "block"; } 
  if(mode == "config")  { configdiv.style.display = "block"; } 
  if(mode == "export")  { 
    exportdiv = gLyphsExpressionPanelExportSubpanel();
    exportdiv.style.display = "block"; 
  }
}

//----- express panel filter tools ---------------------------------------------------------------------

function gLyphsCreateExperimentExpressFilterWidget() {
  var g1 = document.createElementNS(svgNS,'g');

  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  if(!current_region.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('filter');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"filter experiments\",90);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '25px');
  rect.setAttributeNS(null, 'height', '11px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  
  var txt1 = g1.appendChild(document.createElementNS(svgNS,'text'));
  txt1.setAttributeNS(null, 'x', '3px');
  txt1.setAttributeNS(null, 'y', '9px');
  txt1.setAttributeNS(null, "font-size","10px");
  txt1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  txt1.setAttributeNS(null, "font-weight", 'bold');
  txt1.setAttributeNS(null, 'style', 'fill: gray;');
  txt1.appendChild(document.createTextNode("FLT"));
  return g1;
}


function gLyphsExpressionPanelFilterSubpanel() {
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
  
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  
  var auxdiv = document.getElementById("experiment_express_auxdiv");
  if(!auxdiv) { return; }
  
  var filterdiv = document.getElementById("experiment_express_filter_panel");
  if(!filterdiv) { 
    filterdiv = document.createElement('div');
    auxdiv.insertBefore(filterdiv, auxdiv.firstChild);
    filterdiv.id = "experiment_express_filter_panel";
    filterdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:330px; display:none; opacity: 0.90; " +
                           "position:absolute; top:20px; right:10px;"
                           );      
  }
  clearKids(filterdiv);
  
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button;
  var trackID = current_region.active_trackID;

  //close button
  tdiv = filterdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = filterdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "experiment filters";
      
  var form1 = filterdiv.appendChild(document.createElement('form'));
  form1.setAttribute("onsubmit", "gLyphsApplyExpExpressFilterSearch(); return false;");
  tdiv = form1.appendChild(document.createElement('div'));
  var expInput = tdiv.appendChild(document.createElement('input'));
  expInput.setAttribute('style', "width:200px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  expInput.id = "expExp_search_inputID";
  expInput.setAttribute('type', "text");
  if(glyphTrack && glyphTrack.expfilter) {
    expInput.setAttribute('value', glyphTrack.expfilter);
  }
  
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "gLyphsApplyExpExpressFilterSearch(); return false;");
  button.innerHTML = "filter";

  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"clear filters\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "gLyphsClearExpExpressFilterSearch();");
  button.innerHTML = "clear";
  
  tdiv = filterdiv.appendChild(document.createElement('div'));
  tdiv.id = "experiment_express_filter_panel_msg";
  tdiv.setAttribute("style", "font-size:10px; margin-left:5px;");

  filterdiv.appendChild(document.createElement('hr'));

  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.id = "gLyphHideExpsCheckbox";
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(current_region.exppanel_hide_deactive) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('hide_deactive',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide deactivated experiments";

  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(current_region.exppanel_active_on_top) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('active_on_top',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "keep active experiments on top";
    
  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(current_region.hide_zero_experiments) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('hide_zero_experiments',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide experiments with zero signal";
  
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:25px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"invert the filtering\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "gLyphsInvertExperimentSelection('"+current_region.active_trackID+"');");
  button.innerHTML = "invert selection";
    
  filterdiv.appendChild(document.createElement('hr'));

  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin:0px 0px 5px 50px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute('onclick', "glyphs_reconfig_with_visible_experiments()");
  button.innerHTML = "reconfigure with active experiments";
  
  //tdiv2  = filterdiv.appendChild(document.createElement('div'));
  //button = tdiv2.appendChild(document.createElement("button"));
  //button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:65px; margin-top:3px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute('onclick', "glyphs_reconfig_experiments('"+trackID+"', 'deactivate-zeroexps')");
  //button.innerHTML = "deactivate empty experiments";

  return filterdiv;
}

//----- grouping subpanel ---------------------------------------------------------------------

function gLyphsCreateExperimentExpressGroupingWidget() {
  var g1 = document.createElementNS(svgNS,'g');
  
  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  if(!current_region.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('group');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"experiment grouping<br>and enrichment\",130);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '33px');
  rect.setAttributeNS(null, 'height', '11px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  
  var txt1 = g1.appendChild(document.createElementNS(svgNS,'text'));
  txt1.setAttributeNS(null, 'x', '3px');
  txt1.setAttributeNS(null, 'y', '9px');
  txt1.setAttributeNS(null, "font-size","10px");
  txt1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  txt1.setAttributeNS(null, "font-weight", 'bold');
  txt1.setAttributeNS(null, 'style', 'fill: gray;');
  txt1.appendChild(document.createTextNode("STAT"));
  return g1;
}


function gLyphsExpressionPanelGroupingSubpanel() {
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
  
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  
  var auxdiv = document.getElementById("experiment_express_auxdiv");
  if(!auxdiv) { return; }
  
  var groupingdiv = document.getElementById("experiment_express_grouping_subpanel");
  if(!groupingdiv) { 
    groupingdiv = document.createElement('div');
    auxdiv.insertBefore(groupingdiv, auxdiv.firstChild);
    groupingdiv.id = "experiment_express_grouping_subpanel";
    groupingdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:330px; display:none; opacity: 0.90; " +
                           "position:absolute; top:20px; right:10px;"
                           );      
  }
  clearKids(groupingdiv);
  
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button;
  var trackID = current_region.active_trackID;
  
  //close button
  tdiv = groupingdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = groupingdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "experiment grouping and enrichment";
  
  groupingdiv.appendChild(document.createElement('hr'));

  var select = groupingdiv.appendChild(document.createElement('select'));    
  select.setAttribute('style', "width:250px; margin-left:25px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  select.setAttributeNS(null, "onchange", "gLyphsExpressionPanelReconfigParam('exppanelmode', this.value);");
  var gcats = new Object;
  gcats['experiments'] = "no grouping";
  gcats['mdgroup'] = "metadata key grouping";
  gcats['ranksum'] = "rank-sum enrichment";
  for(var groupmode in gcats){
    var gcat_desc = gcats[groupmode];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", groupmode);
    if(glyphTrack && glyphTrack.exppanelmode == groupmode) { option.setAttribute("selected", "selected"); }
    option.innerHTML = gcat_desc;
  }
  
  if(!glyphTrack) { return; }

  if(glyphTrack.exppanelmode == "mdgroup") {
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:12px;");
    tdiv.innerHTML = "group by metadata key";
    
    var form1 = groupingdiv.appendChild(document.createElement('form'));
    //form1.setAttribute("onsubmit", "gLyphsTrackFetchMetadataGrouping(current_region.active_trackID); return false;");
    form1.setAttribute("onsubmit", "gLyphsExpressionPanelReconfigParam('mdgroup_input'); return false;");
    tdiv = form1.appendChild(document.createElement('div'));
    var expInput = tdiv.appendChild(document.createElement('input'));
    expInput.setAttribute('style', "width:200px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    expInput.id = "expExp_mdgroup_inputID";
    expInput.setAttribute('type', "text");
    if(glyphTrack && glyphTrack.mdgroupkey) {
      expInput.setAttribute('value', glyphTrack.mdgroupkey);
    }
    
    button = tdiv.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiment metadata and group\",100);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "group";
    
    /*
    button = tdiv.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"clear filters\",100);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //button.setAttribute("onclick", "gLyphsClearExpExpressFilterSearch();");
    button.innerHTML = "clear";
    */    

    ttable  = tdiv.appendChild(document.createElement('table'));
    ttable.setAttribute('cellspacing', "0");
    ttable.setAttribute('style', "font-size:10px;");

    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    ttd.innerHTML = "error bars: ";

    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "errorbar_type");
    tradio.setAttribute('value', "stddev");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('errorbar_type', this.value);");
    if(glyphTrack.errorbar_type == "stddev") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "sample standard deviation";
    
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "errorbar_type");
    tradio.setAttribute('value', "stderror");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('errorbar_type', this.value);");
    if(glyphTrack.errorbar_type == "stderror") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "standard error";
  }
  
  if(glyphTrack.exppanelmode == "ranksum") {
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px;");
    tdiv.innerHTML = "wilcoxon-mann-whitney rank-sum enrichment algorithm.<br>displays z-score returned by test.<br>for experiments with lots of metadata and tracks with many experiments, this statistical calculation can take over 30seconds to perform.";
        
    tdiv2  = groupingdiv.appendChild(document.createElement('div'));
    tinput = tdiv2.appendChild(document.createElement('input'));
    tinput.setAttribute('type', "checkbox");
    tinput.setAttribute("style", "margin-left: 5px;");
    if(current_region.exppanel_hide_deactive) { tinput.setAttribute('checked', "checked"); }
    tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('hide_deactive',this.checked)");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "hide deactivated metadata";

    groupingdiv.appendChild(document.createElement('hr'));

    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px;");
    tdiv.innerHTML = "limit search to specified metadata keys (space separated list)";
    
    var form1 = groupingdiv.appendChild(document.createElement('form'));
    form1.setAttribute("onsubmit", "gLyphsExpressionPanelReconfigParam('ranksum_mdkeys'); return false;");
    tdiv = form1.appendChild(document.createElement('div'));
    var expInput = tdiv.appendChild(document.createElement('input'));
    expInput.setAttribute('style', "width:180px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    expInput.id = "exppanel_ranksum_mdkey_focus_inputID";
    expInput.setAttribute('type', "text");
    if(glyphTrack && glyphTrack.ranksum_mdkeys) {
      expInput.setAttribute('value', glyphTrack.ranksum_mdkeys);
    }
    
    //button = tdiv.appendChild(document.createElement("button"));
    //button.setAttribute("style", "font-size:10px; padding: 1px 2px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiment metadata and group\",100);");
    //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //button.innerHTML = "apply";
    
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "margin-top:3px;");
    var form1 = tdiv.appendChild(document.createElement('form'));
    form1.setAttribute("onsubmit", "gLyphsExpressionPanelReconfigParam('ranksum_min_zscore'); return false;");
    tspan = form1.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:10px;");
    tspan.innerHTML = "min z-score: ";
    var expInput = form1.appendChild(document.createElement('input'));
    expInput.setAttribute('style', "width:30px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    expInput.id = "exppanel_ranksum_min_zscore_inputID";
    expInput.setAttribute('type', "text");
    if(glyphTrack && glyphTrack.ranksum_min_zscore) {
      expInput.setAttribute('value', glyphTrack.ranksum_min_zscore);
    }
        
    
    /*
    ttable  = groupingdiv.appendChild(document.createElement('table'));
    ttable.setAttribute('cellspacing', "0");
    ttable.setAttribute('style', "font-size:10px;");

    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_algo");
    tradio.setAttribute('value', "wilcoxon");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('ranksum_algo', this.value);");
    if(glyphTrack.ranksum_algo == "wilcoxon") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "Wilcoxon signed rank test";
    
    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_algo");
    tradio.setAttribute('value', "mannwhitney");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('ranksum_algo', this.value);");
    if(glyphTrack.ranksum_algo == "mannwhitney") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "Mann-Whitney U-test";
     */
    
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.id = "express_panel_ranksum_msg";
    tdiv.setAttribute("style", "font-size:10px; margin-left:5px;");    
  }
  
  return groupingdiv;
}


function gLyphsTrackFetchMetadataGrouping(trackID) {
  if(!trackID) { return false; }
  //document.getElementById("message").innerHTML += " gLyphsTrackFetchMetadataGrouping("+trackID+")";
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return false; }
    
  var graph_msgdiv = document.getElementById("express_panel_graph_msgdiv");
  if(graph_msgdiv) {
    graph_msgdiv.style.display = "block";
    graph_msgdiv.innerHTML = "";
  }
  
  if(!glyphTrack.mdgroupkey) {
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "please enter a metadata grouping key"; }
    return false;
  }
  
  //create empty array to prevent retrigger
  glyphTrack.experiment_mdgrouping = new Array;

  //OK rebuild this as a ws query outside of the generic search system
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>mdstats</mode><md_show_ids>true</md_show_ids>";
  paramXML += "<filter>"+glyphTrack.expfilter+"</filter>\n";
  paramXML += "<mdkey>"+glyphTrack.mdgroupkey+"</mdkey>\n";
  if(glyphTrack.peerName)   { paramXML += "<peer_names>"+glyphTrack.peerName+"</peer_names>\n"; }
  if(glyphTrack.sources)    { paramXML += "<source_names>"+glyphTrack.sources+"</source_names>\n"; }
  if(glyphTrack.source_ids) { paramXML += "<source_ids>"+ glyphTrack.source_ids +"</source_ids>\n"; }
  paramXML += "<registry_mode>all</registry_mode>\n";
  paramXML += "</zenbu_query>\n";
  
  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  glyphTrack.mdGroupXHR = xhr;
  if(graph_msgdiv) { graph_msgdiv.innerHTML = "searching for metadata grouping..."; }
  xhr.open("POST", eedbSearchCGI, true); //async
  xhr.onreadystatechange= function(id) { return function() { gLyphsTrackMdGroupingXMLResponse(id); };}(trackID);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
}


function gLyphsTrackMdGroupingXMLResponse(trackID) {
  //document.getElementById("message").innerHTML += " gLyphsTrackMdGroupingXMLResponse("+trackID+")";
  if(!trackID) { return false; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return false; }
  //if(!glyphTrack.experiments) { return; }

  var xhr = glyphTrack.mdGroupXHR;
  if(!xhr) { return; }
  
  var graph_msgdiv = document.getElementById("express_panel_graph_msgdiv");
  if(graph_msgdiv) {
    graph_msgdiv.style.display = "block";
    //graph_msgdiv.innerHTML = "parsing the metadata grouping...";
    graph_msgdiv.innerHTML = "";
  }
    
  if(xhr.readyState!=4) { return false; }
  if(xhr.status!=200) { return false; }
  if(xhr.responseXML == null) { if(graph_msgdiv) { graph_msgdiv.innerHTML = "problem with mdata group search"; } return false; }
  
  glyphTrack.experiment_mdgrouping = new Array;
  
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { if(graph_msgdiv) { graph_msgdiv.innerHTML = "problem with mdata group search"; } return false; }
  
  var mdkeyXML = xmlDoc.getElementsByTagName("mdkey");
  if(!mdkeyXML) { return false; }
  if(mdkeyXML.length == 0) { 
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "warning: no matching metadata key found"; }
    //gLyphsClearExpExpressFilterSearch();
    return false; 
  }

  for(var i=0; i<mdkeyXML.length; i++) {
    var mdkey = mdkeyXML[i].getAttribute("key");  
    var mdvalueXML = mdkeyXML[i].getElementsByTagName("mdvalue");
    for(var j=0; j<mdvalueXML.length; j++) {
      var mdvalue     = mdvalueXML[j].getAttribute("value"); 
      var sourceXML   = mdvalueXML[j].getElementsByTagName("datasource");
      
      var mdgroup = new Object;
      mdgroup.mdvalue = mdvalue;
      mdgroup.name    = mdvalue;
      mdgroup.source_ids = new Array;
      mdgroup.source_hash = new Object;
      mdgroup.hide = false;
      
      if(sourceXML && sourceXML.length>0) {
        for(var k=0; k<sourceXML.length; k++) {
          var srcID = sourceXML[k].getAttribute("id");
          if(!mdgroup.source_hash[srcID]) {
            mdgroup.source_hash[srcID] = true;
            mdgroup.source_ids.push(srcID);
          }
        }
      }
      glyphTrack.experiment_mdgrouping.push(mdgroup);
    }
  }

  //find all the sources not covered by the mdkey (outside)
  var ingroup = new Object;
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdg = glyphTrack.experiment_mdgrouping[i];
    for(var j=0; j<mdg.source_ids.length; j++) {
      var srcid = mdg.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      ingroup[srcid] = true;
    }
  }

  var mdgroup = new Object;
  mdgroup.mdvalue = "UNKNOWN - no metadata key";
  mdgroup.name = mdgroup.mdvalue
  mdgroup.source_ids = new Array;
  mdgroup.source_hash = new Object;
  mdgroup.hide = false;
  for(var expID in glyphTrack.experiments) {
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    if(ingroup[expID]) { continue; }
    if(!mdgroup.source_hash[expID]) {
      mdgroup.source_hash[expID] = true;
      mdgroup.source_ids.push(expID);
    }
  }
  if(mdgroup.source_ids.length > 0) { 
    glyphTrack.experiment_mdgrouping.push(mdgroup); 
  }
  
  if(graph_msgdiv) { 
    graph_msgdiv.style.display = "none";
    graph_msgdiv.innerHTML = "";
  }
  
  gLyphsDrawExperimentExpression();
  
  if(glyphTrack.glyphStyle == "split-signal") { 
    gLyphsRenderSplitSignalTrack(glyphTrack);
    //gLyphsDrawSplitSignalTrack(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
  
  glyphTrack.mdGroupXHR = undefined; //clear
  return true; //everything ok
}

//----- rank-sum enrichment calc and render ---------------------------------------------------------------------


function gLyphsExpressionPanelRankSumRender(glyphTrack) { 
  //will render into SVG the data that was precalculated 
  var g1 = document.createElementNS(svgNS,'g');
  g1.id = "exp_panel_ranksum_svg_g1";
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return g1; }  
  

  if(!glyphTrack) { 
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return g1; }
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = current_region.display_width; }
  var graph_width  = frame_width - 20;
  
  if(!glyphTrack.experiment_ranksum_enrichment) {
    gLyphsTrackCalcRankSumEnrichment(glyphTrack.trackID);  //async
  }
  
  if(glyphTrack.experiment_ranksum_enrichment.length == 0) { 
    return g1;
  }  

  //update the experiment_ranksum_enrichment with current experiment_array values
  var ranksum_mdgroups = new Array;
  var max_value = 0.0;
  for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
    var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
    if(current_region.exppanel_hide_deactive && mdgroup.hide) { continue; }
    
    //calc max
    if(glyphTrack.strandless) {
      if(Math.abs(mdgroup.value) < glyphTrack.ranksum_min_zscore) { continue; }
      if(Math.abs(mdgroup.value)+mdgroup.value_error > max_value) { max_value = Math.abs(mdgroup.value)+mdgroup.value_error; }
    } else {
      if((Math.abs(mdgroup.sense_value) < glyphTrack.ranksum_min_zscore) &&
         (Math.abs(mdgroup.antisense_value) < glyphTrack.ranksum_min_zscore)) { continue; }
      if(Math.abs(mdgroup.sense_value)+mdgroup.sense_error > max_value)     { max_value = Math.abs(mdgroup.sense_value)+mdgroup.sense_error; }
      if(Math.abs(mdgroup.antisense_value)+mdgroup.antisense_error > max_value) { max_value = Math.abs(mdgroup.antisense_value)+mdgroup.antisense_error; }
    }
    ranksum_mdgroups.push(mdgroup);
  }
  ranksum_mdgroups.sort(gLyphs_exppanel_mdgroup_sort_func);
  glyphTrack.ranksum_mdgroups = ranksum_mdgroups; 
  clearKids(g1);
  
  g1.setAttribute('ranksum_graph_height', 12 * ranksum_mdgroups.length);

  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var i=0; i<ranksum_mdgroups.length; i++) {
    var mdgroup = ranksum_mdgroups[i];
    
    //make background box
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((i*12)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', '12px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    if(!current_region.exportSVGconfig) {
      back_rect.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
      back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
      back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    mdgroup.back_rect = back_rect;
    g2.appendChild(back_rect);

    var hideGlyph = gLyphExpPanelHideMetadataWidget(mdgroup);
    if(hideGlyph) { 
      hideGlyph.setAttribute('transform', "translate(0,"+ ((i*12)) +")");
      g2.appendChild(hideGlyph); 
    }
          
    //if(!mdgroup.mdvalue) { mdgroup.mdvalue = "hmm problem..."; }
    var name = mdgroup.name;
    name += " ("+mdgroup.group_count+" exps)";
    
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+9) +'px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    if(!current_region.exportSVGconfig) {
      text.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
      text.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
      text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }

    if(mdgroup.hide) { text.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
    else { text.setAttributeNS(null, 'style', 'fill: black;'); }

    text.appendChild(document.createTextNode(name));
    g2.appendChild(text);
  }
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g')); //parent for expression levels
  
  var g5a = g3.appendChild(document.createElementNS(svgNS,'g')); //bars -
  var g5b = g3.appendChild(document.createElementNS(svgNS,'g')); //bars +
  
  var g4a = g3.appendChild(document.createElementNS(svgNS,'g')); //text -
  var g4b = g3.appendChild(document.createElementNS(svgNS,'g')); //text +
  
  //setup the inverse colors
  var posInvColor = glyphTrack.posTextColor;
  var revInvColor = glyphTrack.revTextColor;

  var scale = 0;
  if(max_value>0) { scale = 225.0 / max_value; }
  for(var i=0; i<ranksum_mdgroups.length; i++) {
    var mdgroup = ranksum_mdgroups[i];
    
    var value           = Math.abs(mdgroup.value);
    var sense_value     = Math.abs(mdgroup.sense_value);
    var antisense_value = Math.abs(mdgroup.antisense_value);

    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', (graph_width-470)+'px');
      rect.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(!current_region.exportSVGconfig) {
        rect.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect);
      
      if(mdgroup.value_error>0) {
        var error_width = mdgroup.value_error * 2*scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-470+(2*scale*value))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        g5b.appendChild(error1);
      }      
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-460)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.setAttributeNS(null, 'style', 'fill:' + glyphTrack.posTextColor); 
      text1.appendChild(document.createTextNode(Math.round(mdgroup.value*1000.0)/1000.0));
      if(!current_region.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      if(mdgroup.hide) { 
        rect.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', (graph_width-240)+'px');
      rect1.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(!current_region.exportSVGconfig) {
        rect1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect1);
      
      if(mdgroup.sense_error>0) {
        var error_width = mdgroup.sense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240+(sense_value * scale))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        g5b.appendChild(error1);
      }      
      
      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (graph_width-240-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor);
      if(!current_region.exportSVGconfig) {
        rect2.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect2.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5a.appendChild(rect2);
      
      if(mdgroup.antisense_error>0) {
        var error_width = mdgroup.antisense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240-width2)+" "+((i*12)+5.5)+
                            " h-"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        g5b.appendChild(error1);
      }      
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-235)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.appendChild(document.createTextNode(Math.round(mdgroup.sense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text1.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text1.setAttributeNS(null, 'style', 'fill: black;'); }
      //text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posTextColor); 
      text1.setAttributeNS(null, 'style', 'fill:'+posInvColor); 
      if(!current_region.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', (graph_width-245)+'px');
      text2.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(mdgroup.antisense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text2.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text2.setAttributeNS(null, 'style', 'fill: black;'); }
      //text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revTextColor); 
      text2.setAttributeNS(null, 'style', 'fill:'+revInvColor); 
      if(!current_region.exportSVGconfig) {
        text2.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text2.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4a.appendChild(text2);

      if(mdgroup.sense_value<0) {
        rect1.setAttributeNS(null, 'fill', posInvColor);
        text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posStrandColor); 
      }
      if(mdgroup.antisense_value<0) {
        rect2.setAttributeNS(null, 'fill', revInvColor);
        text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revStrandColor); 
      }

      
      if(mdgroup.hide) { 
        rect1.setAttribute('style', "opacity:0.2");        
        rect2.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        text2.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    }
  }
  
  return g1;
}


function gLyphExpPanelHideMetadataWidget(mdgroup) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');
  
  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;');
  if(!current_region.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "toggleHideMetadataType(\"" +mdgroup.mdkey+ "\");");
  }
  g1.appendChild(rect);
  
  if(mdgroup.hide) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    if(!current_region.exportSVGconfig) { 
      line.setAttributeNS(null, "onclick", "toggleHideMetadataType(\"" +mdgroup.mdkey+ "\");");
    }
    g1.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    if(!current_region.exportSVGconfig) { 
      circle.setAttributeNS(null, "onclick", "toggleHideMetadataType(\"" +mdgroup.mdkey+ "\");");
    }
    g1.appendChild(circle);
  }
  return g1;
}

function toggleHideMetadataType(mdkey) {
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return; }
  for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
    var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
    if(!mdgroup) { continue; }
    if(mdgroup.mdkey == mdkey) {
      mdgroup.hide = !(mdgroup.hide);
    }
  }
  gLyphsDrawExperimentExpression();    
}


function gLyphsTrackCalcRankSumEnrichment(trackID) {
  if(!trackID) { return false; }
  //document.getElementById("message").innerHTML += " gLyphsTrackCalcRankSumEnrichment("+trackID+")";
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return false; }
  if(!glyphTrack.experiments) { return false; }
  
  var graph_msgdiv = document.getElementById("express_panel_graph_msgdiv");
  if(graph_msgdiv) {
    graph_msgdiv.style.display = "block";
    graph_msgdiv.innerHTML = "calculating the rank-sum enrichment...";
  }
        
  //create empty array to prevent retrigger
  glyphTrack.experiment_ranksum_enrichment = new Array;
    
  //ws query to calc ranksum
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>mdranksum</mode><registry_mode>all</registry_mode>\n";
  paramXML += "<md_show_ids>true</md_show_ids>";
  paramXML += "<source_ids>";
  for(var expID in glyphTrack.experiments) {
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
    if(experiment.hide) { continue; }
    if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
    paramXML += expID + ",";
  }
  paramXML += "</source_ids>\n";
  if(glyphTrack.ranksum_mdkeys) {
    paramXML += "<mdkey_list>"+glyphTrack.ranksum_mdkeys+"</mdkey_list>\n";
  }
  
  //send the current expression panel result as a fake "feature" to perform the rank-sum analysis on
  var ss = current_region.start;
  var se = current_region.end;
  if(glyphTrack.selection) { 
    ss = glyphTrack.selection.chrom_start;
    se = glyphTrack.selection.chrom_end;
  }
  if(ss>se) { var t=ss; ss=se; se=t; }

  paramXML += "<ranksum_input>\n";
  if(glyphTrack.strandless) { 
    paramXML += "<feature start=\""+ss+"\" end=\""+se+"\" strand=\"\" >\n";
    paramXML += "<chrom chr=\""+current_region.chrom+"\" asm=\""+current_region.asm+"\" />\n";
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
      if(experiment.hide) { continue; }
      if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
      paramXML += "<expression datatype=\""+experiment.exptype+"\" value=\""+experiment.value+"\" experiment_id=\""+expID+"\" />\n";
    }
    paramXML += "</feature>\n";
  } else {
    paramXML += "<feature start=\""+ss+"\" end=\""+se+"\" strand=\"+\" >\n";
    paramXML += "<chrom chr=\""+current_region.chrom+"\" asm=\""+current_region.asm+"\" />\n";
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
      if(experiment.hide) { continue; }
      if(current_region.hide_zero_experiments && (experiment.sense_value==0)) { continue; }
      paramXML += "<expression datatype=\""+experiment.exptype+"\" value=\""+experiment.sense_value+"\" experiment_id=\""+expID+"\" />\n";
    }  
    paramXML += "</feature>\n";

    paramXML += "<feature start=\""+ss+"\" end=\""+se+"\" strand=\"-\" >\n";
    paramXML += "<chrom chr=\""+current_region.chrom+"\" asm=\""+current_region.asm+"\" />\n";
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      //if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
      if(experiment.hide) { continue; }
      if(current_region.hide_zero_experiments && (experiment.antisense_value==0)) { continue; }
      paramXML += "<expression datatype=\""+experiment.exptype+"\" value=\""+experiment.antisense_value+"\" experiment_id=\""+expID+"\" />\n";
    }  
    paramXML += "</feature>\n";
  }
  paramXML += "</ranksum_input>\n";

  paramXML += "</zenbu_query>\n";
  
  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  glyphTrack.mdGroupXHR = xhr;
  xhr.open("POST", eedbSearchCGI, true); //async
  //xhr.onreadystatechange= gLyphsTrackRankSumEnrichmentXMLResponse;
  xhr.onreadystatechange= function(id) { return function() { gLyphsTrackRankSumEnrichmentXMLResponse(id); };}(trackID);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
}


function gLyphsTrackRankSumEnrichmentXMLResponse(trackID) {
  if(!trackID) { return false; }
  //document.getElementById("message").innerHTML += " gLyphsTrackRankSumEnrichmentXMLResponse("+trackID+")";
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return false; }

  var xhr = glyphTrack.mdGroupXHR;
  if(!xhr) { return; }

  var graph_msgdiv = document.getElementById("express_panel_graph_msgdiv");

  //message in the panel
  if(graph_msgdiv) {
    graph_msgdiv.style.display = "block";
    graph_msgdiv.innerHTML = "calculating the rank-sum enrichment......"; 
  }
  
  if(xhr.readyState!=4) { return false; }
  if(xhr.status!=200) { return false; }
  if(xhr.responseXML == null) { 
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "problem1 with ranks-sum calculation"; }
    return false;
  }
  
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { 
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "problem2 with ranks-sum calculation"; }
    return false;
  }
  
  
  var featureXML = xmlDoc.getElementsByTagName("feature");
  if(!featureXML) { return false; }
  if(featureXML.length == 0) { 
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "problem3 with rank-sum calculation"; }
    return false;
  }
    
  if(graph_msgdiv) { graph_msgdiv.innerHTML += " ok1"; }
  glyphTrack.experiment_ranksum_enrichment = new Array;
  var mdgroup_hash = new Object; //to collect unique set between the + and - strand
  
  for(var i=0; i<featureXML.length; i++) {
    var strand = featureXML[i].getAttribute("strand");  
  
    //var mdgroupXML = featureXML[i].getElementsByTagName("mdvalue");
    var mdgroupXML = featureXML[i].getElementsByTagName("mdgroup");
    for(var j=0; j<mdgroupXML.length; j++) {
      var mdtype     = mdgroupXML[j].getAttribute("type"); 
      var mdvalue    = mdgroupXML[j].getAttribute("value"); 
      var ranksum    = parseFloat(mdgroupXML[j].getAttribute("group_ranksum"));
      var pvalue     = parseFloat(mdgroupXML[j].getAttribute("pvalue"));
      var grp_count  = parseFloat(mdgroupXML[j].getAttribute("group_count"));
      var sourceXML  = mdgroupXML[j].getElementsByTagName("datasource");
      var mdataXML   = mdgroupXML[j].getElementsByTagName("mdata");
      //if(mdgroupXML[j].firstChild) { mdvalue = mdgroupXML[j].firstChild.nodeValue; }

      var mdkeyval = mdtype + " " + mdvalue;
      var mdgroup = mdgroup_hash[mdkeyval];
      if(!mdgroup) {
        mdgroup = new Object;

        mdgroup.mdkey = mdtype;
        mdgroup.mdvalue = mdvalue;
        mdgroup.name = mdkeyval;        
        mdgroup.group_count = grp_count;

        mdgroup.value = 0;
        mdgroup.sense_value = 0;
        mdgroup.antisense_value = 0;
        mdgroup.value_total = 0;
        mdgroup.sense_total = 0;
        mdgroup.antisense_total = 0;
        mdgroup.value_error = 0;
        mdgroup.sense_error = 0;
        mdgroup.antisense_error = 0;
        mdgroup.hide = false;
        mdgroup_hash[mdkeyval] = mdgroup;
        mdgroup.source_ids = new Array;
        mdgroup.source_hash = new Object;
        mdgroup.mdata_list = new Array;

        if(mdataXML && mdataXML.length>0) {
          for(var k=0; k<mdataXML.length; k++) {
            var mdata = new Object;
            mdata.type  = mdataXML[k].getAttribute("type");
            mdata.value = mdataXML[k].firstChild.nodeValue;
            mdgroup.mdata_list.push(mdata);
          }
        }
      }
      
      if(strand == "+") {
        mdgroup.sense_value = pvalue;
        mdgroup.value += pvalue;
      } else if(strand == "-") {
        mdgroup.antisense_value = pvalue;
        mdgroup.value += pvalue;
      } else {
        mdgroup.value = pvalue;
      }

      if(sourceXML && sourceXML.length>0) {
        for(var k=0; k<sourceXML.length; k++) {
          var srcID = sourceXML[k].getAttribute("id");
          if(!mdgroup.source_hash[srcID]) {
            mdgroup.source_hash[srcID] = true;
            mdgroup.source_ids.push(srcID);
          }
        }
      }
    }
  }
  
  for(var mdkeyval in mdgroup_hash) {
    var mdgroup = mdgroup_hash[mdkeyval]
    glyphTrack.experiment_ranksum_enrichment.push(mdgroup);
  }
  
  if(graph_msgdiv) {
    graph_msgdiv.style.display = "none";
    graph_msgdiv.innerHTML = "";
  }

  gLyphsDrawExperimentExpression();

  if(glyphTrack.glyphStyle == "split-signal") { 
    gLyphsRenderSplitSignalTrack(glyphTrack);
    //gLyphsDrawSplitSignalTrack(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
  
  glyphTrack.mdGroupXHR = undefined; //clear
  return true; //everything ok
}


//----- config subpanel ---------------------------------------------------------------------

function gLyphsCreateExpressionPanelConfigWidget() {  
  var g1 = document.createElementNS(svgNS,'g');
  if(!current_region.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('config');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"configure expression panel\",120);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);
  var rg1 = document.createElementNS(svgNS,'radialGradient');
  rg1.setAttributeNS(null, 'id', 'grayRadialGradient');
  rg1.setAttributeNS(null, 'cx', '40%');
  rg1.setAttributeNS(null, 'cy', '40%');
  rg1.setAttributeNS(null, 'fx', '40%');
  rg1.setAttributeNS(null, 'fy', '40%');
  rg1.setAttributeNS(null, 'r',  '40%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'stop-opacity', '0');
  stop1.setAttributeNS(null, 'stop-color', 'rgb(180,180,180)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(100,100,100)');
  rg1.appendChild(stop2);
  
  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'style', 'stroke-width: 1px; stroke: url(#grayRadialGradient)');
  line.setAttributeNS(null, 'fill', 'url(#grayRadialGradient)');
  var points = '';
  for(var ang=0; ang<=28; ang++) {
    var radius = 5;
    if(ang % 4 == 2) { radius = 5; }
    if(ang % 4 == 3) { radius = 5; }
    if(ang % 4 == 0) { radius = 2.5; }
    if(ang % 4 == 1) { radius = 2.5; }
    var x = Math.cos(ang*2*Math.PI/28.0) *radius + 5;
    var y = Math.sin(ang*2*Math.PI/28.0) *radius + 5;
    points = points + x + "," + y + " ";
  }
  line.setAttributeNS(null, 'points', points);
  g1.appendChild(line);
  
  return g1;
}


function gLyphsExpressionPanelConfigSubpanel() {
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
  
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  
  var auxdiv = document.getElementById("experiment_express_auxdiv");
  if(!auxdiv) { return; }
  
  var configdiv = document.getElementById("experiment_express_config_subpanel");
  if(!configdiv) { 
    configdiv = document.createElement('div');
    auxdiv.insertBefore(configdiv, auxdiv.firstChild);
    configdiv.id = "experiment_express_config_subpanel";
    configdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                             "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                             "width:330px; display:none; opacity: 0.90; " +
                             "position:absolute; top:20px; right:10px;"
                             );      
  }
  clearKids(configdiv);
  
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;
  var trackID = current_region.active_trackID;
  
  //close button
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "general configuration";
  
  configdiv.appendChild(document.createElement('hr'));
      
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px;");
  tdiv.innerHTML = "experiment sort order";
  
  ttable  = configdiv.appendChild(document.createElement('table'));
  ttable.setAttribute('cellspacing', "0");
  ttable.setAttribute('style', "font-size:10px;");
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "name");
  tradio.setAttribute('onclick', "change_express_sort(this.value)");
  if(express_sort_mode == "name") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "name";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "value_plus");
  tradio.setAttribute('onclick', "change_express_sort(this.value)");
  if(express_sort_mode == "value_plus") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression (+ strand)";
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "point");
  tradio.setAttribute('onclick', "change_express_sort(this.value)");
  if(express_sort_mode == "point") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "series/time point";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "value_minus");
  tradio.setAttribute('onclick', "change_express_sort(this.value)");
  if(express_sort_mode == "value_minus") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression (- strand)";
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "series");
  tradio.setAttribute('onclick', "change_express_sort(this.value)");
  if(express_sort_mode == "series") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "series set";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "value_both");
  tradio.setAttribute('onclick', "change_express_sort(this.value)");
  if(express_sort_mode == "value_both") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression (both strands)";
    
  // display_name control
  configdiv.appendChild(document.createElement('hr'));
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  span2  = tdiv2.appendChild(document.createElement('span'));
  span2.innerHTML = "display name from metadata (keys):";

  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "gLyphsExpressionPanelReconfigParam('exp_name_mdkeys'); return false;");
  button.innerHTML = "accept";

  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "gLyphsExpressionPanelReconfigParam('exp_name_mdkeys_clear'); return false;");
  button.innerHTML = "reset";

  var text1 = configdiv.appendChild(document.createElement('textarea'));
  text1.setAttribute('rows', 3);
  text1.setAttribute('wrap', "off");
  text1.setAttribute('style', "width:315px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; resize:vertical; min-height:30px");
  text1.id = "expExp_name_mdkeys_inputID";
  text1.setAttribute('type', "text");
  if(glyphTrack && glyphTrack.exp_name_mdkeys ){
    //text1.setAttribute('value', glyphTrack.exp_name_mdkeys);
    text1.innerHTML = glyphTrack.exp_name_mdkeys;
  }

  // extra checks
  configdiv.appendChild(document.createElement('hr'));
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("style", "margin-left: 5px;");
  tcheck.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('subscroll', this.checked)");
  if(current_region.exppanel_subscroll) { tcheck.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "enable internal scroll panel";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("style", "margin-left: 5px;");
  tcheck.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('exprgbcolor', this.checked)");
  if(glyphTrack && glyphTrack.exppanel_use_rgbcolor) { tcheck.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "use experiment rgbColor";

  return configdiv;
}

//--- Expression panel export tools  -------------------------------------------------------------------

function gLyphsCreateExperimentExpressExportWidget() {
  var g1 = document.createElementNS(svgNS,'g');  
  if(!current_region.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('export');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"export data\",80);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");    
    //  poly.setAttributeNS(null, "onclick", "gLyphsExpGraphExportPanel();");
  }
  
  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '11px');
  rect.setAttributeNS(null, 'height', '11px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  //if(!current_region.exportSVGconfig) {
  //  rect.setAttributeNS(null, "onclick", "gLyphsExpGraphExportPanel();");
  //  rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"export data\",80);");
  //  rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  //}
  
  var poly = g1.appendChild(document.createElementNS(svgNS,'polygon'));
  poly.setAttributeNS(null, 'points', '4,2  7,2  7,5  9.5,5  5.5,9.5  1.5,5  4,5  4,2');
  //poly.setAttributeNS(null, 'fill', 'blue');
  poly.setAttributeNS(null, 'fill', 'gray');
  //if(!current_region.exportSVGconfig) {
  //  poly.setAttributeNS(null, "onclick", "gLyphsExpGraphExportPanel();");
  //  poly.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"export data\",80);");
  //  poly.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  //}
  g1.setAttributeNS(null, 'transform', "translate(" + (current_region.display_width-45) + ",0)");
  return g1;
}


function gLyphsExpressionPanelExportSubpanel() {
  var expframe = document.getElementById("experiment_express_frame");
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
  
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  
  var auxdiv = document.getElementById("experiment_express_auxdiv");
  if(!auxdiv) { return; }
  
  var exportdiv = document.getElementById("experiment_express_export_subpanel");
  if(!exportdiv) { 
    exportdiv = document.createElement('div');
    auxdiv.insertBefore(exportdiv, auxdiv.firstChild);
    exportdiv.id = "experiment_express_export_subpanel";
    exportdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:500px; display:none; " +
                           "position:absolute; top:20px; right:10px;"
                           );      
  
    var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;
    var trackID = current_region.active_trackID;
  }
  clearKids(exportdiv);
  
  //close button
  tdiv = exportdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = exportdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "export expression data";
  
  //----------
  var dataArea = exportdiv.appendChild(document.createElement('textarea'));
  dataArea.id = "experiment_express_export_data_area";
  dataArea.setAttribute('style', "resize:vertical; width:96%; margin: 3px 5px 3px 5px; font-size:10px; "+
                        "color:black; font-family:\"Courier New\", Courier, monospace;");
  dataArea.setAttribute('rows', 15);
  dataArea.setAttribute('wrap', "off");  

  //now fill in the data
  var experiments = new Array;
  glyphTrack.experiment_array.sort(gLyphs_express_sort_func);
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
    experiments.push(experiment);
  }
  
  dataArea.innerHTML = "experiment_name\tdatatype\t";
  if(glyphTrack.strandless) { dataArea.innerHTML += "strandless value\n"; }
  else { dataArea.innerHTML += "neg_strand_value\tpos_strand_value\n\n"; }
  
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    
    var dataline = experiment.expname + "\t" + experiment.exptype + "\t";
    
    var value           = experiments[i].value;
    var sense_value     = experiments[i].sense_value;
    var antisense_value = experiments[i].antisense_value;
    
    if(glyphTrack.strandless) { 
      dataline += Math.round(value*1000.0)/1000.0;
    } else {
      dataline += (Math.round(antisense_value*1000.0)/1000.0) + "\t" + (Math.round(sense_value*1000.0)/1000.0);
    }
    
    dataArea.innerHTML += dataline +"\n";
  }
  return exportdiv;
}


//--- expression panel control & manipulation functions  -------------------------------------------------------------------

function gLyphsApplyExpExpressFilterSearch() {
  var trackID = current_region.active_trackID;
  if(!trackID) { return false; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return false; }
  if(!glyphTrack.experiments) { return false; }

  var searchMsg = document.getElementById("experiment_express_filter_panel_msg");
  if(searchMsg) { searchMsg.innerHTML = ""; }
  
  var searchInput = document.getElementById("expExp_search_inputID");
  if(searchInput) {
    var expfilter = searchInput.value;  
    if(expfilter != glyphTrack.expfilter) {
      //gLyphsAutosaveConfig(); //don't autosave anymore with filter changes
      glyphTrack.expfilter = expfilter;
    }
  }
  return gLyphsSubmitExpExpressFilterSearch();
}


function gLyphsSubmitExpExpressFilterSearch() {
  var trackID = current_region.active_trackID;
  if(!trackID) { return false; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return false; }
  if(!glyphTrack.experiments) { return false; }

  if(!glyphTrack.expfilter) {
    gLyphsClearExpExpressFilterSearch();
    return false;
  }

  var searchMsg = document.getElementById("experiment_express_filter_panel_msg");
  if(searchMsg) { searchMsg.innerHTML = ""; }

  //OK rebuild this as a ws query outside of the generic search system
  var paramXML = "<zenbu_query>\n";
  paramXML += "<registry_mode>all</registry_mode>\n";

  if(glyphTrack.peerName)   { paramXML += "<peer_names>"+glyphTrack.peerName+"</peer_names>\n"; }
  if(glyphTrack.sources)    { paramXML += "<source_names>"+glyphTrack.sources+"</source_names>\n"; }
  if(glyphTrack.source_ids) { paramXML += "<source_ids>"+ glyphTrack.source_ids +"</source_ids>\n"; }
  paramXML += "<registry_mode>all</registry_mode>\n";
  paramXML += "<mode>experiments</mode><filter>"+glyphTrack.expfilter+"</filter><format>minxml</format>\n";
  paramXML += "</zenbu_query>\n";

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  current_region.expexpFilterXHR = xhr;
  if(searchMsg) { searchMsg.innerHTML = "searching for filter..."; }
  xhr.open("POST", eedbSearchCGI, true); //async
  xhr.onreadystatechange= gLyphsExpFilterSearchXMLResponse;
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
}


function gLyphsExpFilterSearchXMLResponse() {
  var xhr = current_region.expexpFilterXHR;
  if(!xhr) { return; }
  
  var searchMsg = document.getElementById("experiment_express_filter_panel_msg");
  if(searchMsg) { searchMsg.innerHTML = ""; }

  var trackID = current_region.active_trackID;
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  if(!glyphTrack.experiments) { return; }
  
  if(xhr.readyState!=4) { return false; }
  if(xhr.status!=200) { return false; }
  if(xhr.responseXML == null) { searchMsg.innerHTML = "problem with filter search"; return false; }

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { 
    if(searchMsg) { searchMsg.innerHTML = "problem with filter search"; }
    return false; 
  }

  var experimentXML = xmlDoc.getElementsByTagName("experiment");
  if(!experimentXML) { return false; }
  if(experimentXML.length == 0) { 
    gLyphsClearExpExpressFilterSearch();
    return false; 
  }
  //document.getElementById("message").innerHTML = "expexp search with ["+glyphTrack.expfilter+"] rtn " + experimentXML.length;

  //first reset all experiments to hidden
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = true; 
  }

  //then show the ones returned by the query
  for(var i=0; i<experimentXML.length; i++) {
    var expID = experimentXML[i].getAttribute("id");
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = false; 
  }
  //current_region.expexpFilterXHR = null;
  
  //gLyphsAutosaveConfig(); //might need to skip this autosave

  gLyphsDrawExperimentExpression();
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
  return true; //everything ok
}


function gLyphsClearExpExpressFilterSearch() {
  eedbClearSearchResults("expExp_search");
  document.getElementById("message").innerHTML = "";

  var trackID = current_region.active_trackID;
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }

  glyphTrack.expfilter = "";

  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = false;
  }
  //gLyphsAutosaveConfig(); //don't autosave with filter changes anymore
  gLyphsDrawExperimentExpression();
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function gLyphsInvertExperimentSelection(trackID) {
  eedbClearSearchResults("expExp_search");
  document.getElementById("message").innerHTML = "";
  
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  
  glyphTrack.expfilter = "";
  
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = !experiment.hide;
  }
  gLyphsAutosaveConfig();
  gLyphsDrawExperimentExpression();
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function gLyphsCreateHideExperimentWidget(experiment, row) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'transform', "translate(0,"+ ((row*12)) +")");

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;');
  if(!current_region.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "toggleExperimentHide(\"" +experiment.id+ "\");");
  }
  g1.appendChild(rect);

  if(experiment.hide) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    if(!current_region.exportSVGconfig) { 
      line.setAttributeNS(null, "onclick", "toggleExperimentHide(\"" +experiment.id+ "\");");
    }
    g1.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    if(!current_region.exportSVGconfig) { 
      circle.setAttributeNS(null, "onclick", "toggleExperimentHide(\"" +experiment.id+ "\");");
    }
    g1.appendChild(circle);
  }
  return g1;
}

function toggleExperimentHide(expID) {
  var glyphTrack;
  if(current_region.active_trackID) {
    glyphTrack = gLyphTrack_array[current_region.active_trackID];
  }
  if(!glyphTrack) { return; }
  var experiment = glyphTrack.experiments[expID];
  if(!experiment) { return; }
  experiment.hide = !(experiment.hide);
  gLyphsDrawExperimentExpression();

  glyphTrack.expfilter = ""; //no longer exactly matches the filtering
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(current_region.active_trackID);
}


function gLyphsExpressionPanelReconfigParam(param, value) {
  var glyphTrack = gLyphTrack_array[current_region.active_trackID];
  if(!glyphTrack) { return; }
  
  if(param == "hide_deactive") {
    current_region.exppanel_hide_deactive = value;
  }
  if(param == "active_on_top") {
    current_region.exppanel_active_on_top = value;
  }
  if(param == "hide_zero_experiments") {
    current_region.hide_zero_experiments = value;
  }
  if(param == "subscroll") {
    current_region.exppanel_subscroll = value;
  }
  if(param == "exprgbcolor") {
    glyphTrack.exppanel_use_rgbcolor = value;
  }
  if(param == "mdgroup_input") {
    var searchInput = document.getElementById("expExp_mdgroup_inputID");
    if(searchInput) {
      var mdgroupkey = searchInput.value;  
      glyphTrack.mdgroupkey = mdgroupkey;
      glyphTrack.experiment_mdgrouping = null;
    }
  }
  if(param == "exp_name_mdkeys") {
    var searchInput = document.getElementById("expExp_name_mdkeys_inputID");
    if(searchInput) {
      var mdkeys = searchInput.value;  
      glyphTrack.exp_name_mdkeys = mdkeys;
      gLyphsCacheSources(glyphTrack); //reload
      gLyphsAutosaveConfig(); 
    }
  }
  if(param == "exp_name_mdkeys_clear") {
    var searchInput = document.getElementById("expExp_name_mdkeys_inputID");
    searchInput.value = "";  
    searchInput.innerHTML = "";  
    glyphTrack.exp_name_mdkeys = "";
    gLyphsAutosaveConfig(); 
  }
  
  
  if(param == "errorbar_type") {
    glyphTrack.errorbar_type = value; 
  }
  if(param == "ranksum_display") {
    var ranksum_div = document.getElementById("panel_groupinfo_ranksum_div");
    var exp_div     = document.getElementById("panel_groupinfo_exp_div");

    if(value == "ranksum") {
      if(ranksum_div) { ranksum_div.style.display = "block"; }
      if(exp_div)     { exp_div.style.display     = "none"; }
      current_region.groupinfo_ranksum_display = true;
    } else {
      if(ranksum_div) { ranksum_div.style.display = "none"; }
      if(exp_div)     { exp_div.style.display     = "block"; }
      current_region.groupinfo_ranksum_display = false;
    }
  }
  if(param == "expfilter") {
    glyphTrack.expfilter = value; 
  }
  if(param == "exppanelmode") {
    if(value != glyphTrack.exppanelmode) { gLyphsAutosaveConfig(); }
    glyphTrack.exppanelmode = value;
  }
  if(param == "ranksum_mdkeys") {
    var searchInput = document.getElementById("exppanel_ranksum_mdkey_focus_inputID");
    if(searchInput) {
      var value2 = searchInput.value;
      if(value2 != glyphTrack.ranksum_mdkeys) { 
        gLyphsAutosaveConfig(); 
        glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
      }
      glyphTrack.ranksum_mdkeys = value2;
    }
  }
  if(param == "ranksum_min_zscore") {
    var searchInput = document.getElementById("exppanel_ranksum_min_zscore_inputID");
    if(searchInput) {
      var zscore = parseFloat(searchInput.value);
      if(zscore != glyphTrack.ranksum_min_zscore) { 
        gLyphsAutosaveConfig(); 
        glyphTrack.ranksum_min_zscore = zscore;
      }
    }
  }
    
  //gLyphsDrawExpressionPanel();
  gLyphsDrawExperimentExpression();
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function gLyphsRecalcTrackExpressionScaling(trackID) {
  //this function takes parameters of a track, its experiments
  // and scans the feature_array and recalculates the scaling factors

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  glyphTrack.max_express       = 0;
  glyphTrack.total_max_express = 0;
  glyphTrack.sense_max_express = 0;
  glyphTrack.anti_max_express  = 0;
  glyphTrack.max_express_element = 0;
  glyphTrack.max_score           = 0;

  if(glyphTrack.glyphStyle == "experiment-heatmap" || glyphTrack.glyphStyle == "1D-heatmap") {
    if(glyphTrack.track_height <1) { glyphTrack.track_height = 1; }
    if(glyphTrack.track_height >10) { glyphTrack.track_height = 10; }
  } else {
    if(glyphTrack.track_height <20) { glyphTrack.track_height = 20; }
    if(glyphTrack.track_height >500) { glyphTrack.track_height = 500; }
  }

  if(!glyphTrack.feature_array) { return; }

  // calculate the max bin size
  var max_express = 0.0;
  var total_max_express = 0.0;
  var sense_max_express = 0.0;
  var anti_max_express = 0.0;
  
  //now process the feature/expression values in selection   
  for(var i=0; i<glyphTrack.feature_array.length; i++) {
    var feature = glyphTrack.feature_array[i];

    feature.exp_total = 0;
    feature.exp_sense = 0;
    feature.exp_antisense = 0;    

    if(feature.score > glyphTrack.max_score) { glyphTrack.max_score = feature.score; }

    if(!feature.expression) { continue; }
    
    var total      = 0;
    var sense      = 0;
    var antisense  = 0;
    
    for(var j=0; j<feature.expression.length; j++) {
      var expression = feature.expression[j];
      var experiment = glyphTrack.experiments[expression.expID];
      if(experiment && experiment.hide) { continue; }
      if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }

      if(expression.total > glyphTrack.max_express_element) { glyphTrack.max_express_element = expression.total; }
      
      if(glyphTrack.glyphStyle == "xyplot") {
        if(Math.abs(expression.sense) > sense) { sense = Math.abs(expression.sense); }
        if(Math.abs(expression.antisense) > antisense) { antisense = Math.abs(expression.antisense); }
        if(Math.abs(expression.total) > total) { total = Math.abs(expression.total); }

        if(Math.abs(expression.sense) > Math.abs(feature.exp_sense)) { feature.exp_sense = expression.sense; }
        if(Math.abs(expression.antisense) > Math.abs(feature.exp_antisense)) { feature.exp_antisense = expression.antisense; }
        if(Math.abs(expression.total) > Math.abs(feature.exp_total)) { feature.exp_total = expression.total; }
      } 
      else if(glyphTrack.experiment_merge == "sum") {
        sense      += expression.sense;
        antisense  += expression.antisense;
        total      += expression.total;
      }
      else if(glyphTrack.experiment_merge == "mean") {
        sense      += expression.sense;
        antisense  += expression.antisense;
        total      += expression.total;
      }
      else if(glyphTrack.experiment_merge == "count") {
        sense      += expression.sense;
        antisense  += expression.antisense;
        total      += expression.total;
      }
      else if(glyphTrack.experiment_merge == "max") {
        if(expression.sense > sense) { sense = expression.sense; }
        if(expression.antisense > antisense) { antisense = expression.antisense; }
        if(expression.total > total) { total = expression.total; }
      }
      else if(glyphTrack.experiment_merge == "min") {
        if(j==0) {
          sense      = expression.sense;
          antisense  = expression.antisense;
          total      = expression.total;
        } else {
          if(expression.sense < sense) { sense = expression.sense; }
          if(expression.antisense < antisense) { antisense = expression.antisense; }
          if(expression.total < total) { total = expression.total; }
        }
      }
    }
    if((glyphTrack.glyphStyle != "xyplot") && 
       (glyphTrack.experiment_merge == "mean") && (feature.expression.length > 0)) {
      sense      /= glyphTrack.experiment_array.length;
      antisense  /= glyphTrack.experiment_array.length;
      total      /= glyphTrack.experiment_array.length; 
      //sense      /= feature.expression.length;
      //antisense  /= feature.expression.length;
      //total      /= feature.expression.length;
    }

    
    if(glyphTrack.logscale == 1) { 
      if(sense>0.0) { sense = Math.log(sense+1.0); }
      if(antisense>0.0) { antisense = Math.log(antisense+1.0); }
      if(total>0.0) { total = Math.log(total+1.0); }
    }
    if((sense==0.0) && (antisense==0.0) && (total>0.0)) {
      sense = total;
      antisense = total;
    }    
    if(sense > sense_max_express) { sense_max_express = sense; }
    if(antisense > anti_max_express) { anti_max_express = antisense; }
    if(total > total_max_express) { total_max_express = total; }
    
    if(glyphTrack.glyphStyle != "xyplot") {
      feature.exp_total = total;
      feature.exp_sense = sense;
      feature.exp_antisense = antisense;
    } 
  } //feature loop
  
  // final scaling corrections
  if((sense_max_express>0) || (anti_max_express>0)) {
    max_express = sense_max_express;
    if(anti_max_express > max_express) { max_express = anti_max_express; }
  } else {
    max_express       = total_max_express;
    sense_max_express = total_max_express;
    anti_max_express  = total_max_express;
  }
  if(glyphTrack.expscaling != "auto") {
    max_express = glyphTrack.expscaling;
    total_max_express = glyphTrack.expscaling;
  }
  
  glyphTrack.max_express       = max_express;
  glyphTrack.total_max_express = total_max_express;
  glyphTrack.sense_max_express = sense_max_express;
  glyphTrack.anti_max_express  = anti_max_express;
}


//=======================================================================================
// end of expression panel section
//=======================================================================================


function gLyphsChangeActiveTrack(trackID) {
  if(current_region.active_trackID == trackID) { return; }
  current_region.active_trackID = trackID;
  gLyphsProcessFeatureSelect(); //clear feature selection
  gLyphsDrawExpressionPanel(); 
  updateTitleBar();
}

//----------------------------------------------
// gLyphs generic section for working with
//  feature XML DOM
// and the <div id="feature_info"> element
//----------------------------------------------

function gLyphsCenterOnFeature(feature) {
  // feature is an XML DOM document which holds the feature data
  if(feature === undefined) { feature = current_feature; }
  if(feature === undefined) { return; }

  var start = feature.start;
  var end   = feature.end;
  var range = end-start;
  start -= Math.round(range*.25);
  end += Math.round(range*.25);
  
  if(!current_region) {
    current_region = new Object();
    current_region.display_width = Math.floor(800);
    current_region.asm = eedbDefaultAssembly;
  }

  if((current_region.asm == feature.asm) && 
     (current_region.chrom == feature.chrom) &&
     (current_region.start == start) &&
     (current_region.end == end)) { return; }

  gLyphsSetLocation(feature.asm, feature.chrom, start, end);

  //TODO: once I am certain this is working, I might expose this permanantly when selecting features and entering coordinates loc=
  if(current_region.auto_flip) {
    if(current_feature.strand == "-") { current_region.flip_orientation = true; }
    if(current_feature.strand == "+") { current_region.flip_orientation = false; }
  }

  reloadRegion();
  //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
  gLyphsChangeDhtmlHistoryLocation();
}


function gLyphsDisplayFeatureInfo(feature) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  eedbClearSearchTooltip();
  info_div.innerHTML = "";
  info_div.setAttribute('style', "");

  if(!feature) { return; }

  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";

  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos + 5;

  if(info_div.getAttribute("xpos_abs")) { xpos = Math.floor(info_div.getAttribute("xpos_abs")); }
  info_div.setAttribute("xpos", xpos);
  info_div.setAttribute("ypos", ypos);

  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

  var tdiv, tspan, tinput, ta;
  var main_div = info_div;
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "width:350px; z-index:120; padding: 3px 3px 3px 3px; "+
                                 "background-color:rgb(220,220,255); border:inset; border-width:2px; "+
                                 "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

  //titlebar area to capture move events
  var titlebar_div = main_div.appendChild(document.createElement('div'));
  if(!current_region.exportSVGconfig) {
    titlebar_div.setAttribute("onmousedown", "gLyphsFeatureInfoToggleDrag('start');");
    titlebar_div.setAttribute("onmouseup", "gLyphsFeatureInfoToggleDrag('stop');");
  }

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsFeatureInfoEvent('close');return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = feature.name;
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:9px; padding: 0px 0px 0px 3px;");
  tspan.innerHTML = feature.category +" : " + feature.source_name;

  if(feature.description.length > 0) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = feature.description;
  }
  if(feature.summary) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "margin-top:3px;");
    tdiv.innerHTML = feature.summary;
  }

  main_div.appendChild(document.createElement('p'));

  if(feature.gene_names && (feature.gene_names.length > 0)) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "alias: " + feature.gene_names;
  }

  if(feature.entrez_id || feature.omim_id) {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(feature.entrez_id) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "EntrezID:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "glyphs_entrez");
      ta.setAttribute("href", "http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene&amp;cmd=Retrieve&amp;dopt=full_report&amp;list_uids="+feature.entrez_id);
      ta.innerHTML = feature.entrez_id;
    }
    if(feature.omim_id) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "OMIM:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "glyphs_OMIM");
      ta.setAttribute("href", "http://www.ncbi.nlm.nih.gov/omim/"+ feature.omim_id);
      ta.innerHTML = feature.omim_id;
    }
  }
  if((feature.category == "mrna") || (feature.category == "refgene")) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "NCBI:";
    ta = tdiv.appendChild(document.createElement('a'));
    ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
    ta.setAttribute("target", "glyphs_ncbi");
    ta.setAttribute("href", "http://www.ncbi.nlm.nih.gov/nuccore/"+feature.name);
    ta.innerHTML = feature.name;
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "DDBJ:";
    ta = tdiv.appendChild(document.createElement('a'));
    ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
    ta.setAttribute("target", "glyphs_ddbj");
    ta.setAttribute("href", "http://getentry.ddbj.nig.ac.jp/search/get_entry?&accnumber="+feature.name);
    ta.innerHTML = feature.name;
    if(feature.taxon_id == "10090") {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "MGI:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "glyphs_mgijax");
      ta.setAttribute("href", "http://www.informatics.jax.org/javawi2/servlet/WIFetch?page=sequenceDetail&id="+feature.name);
      ta.innerHTML = feature.name;
    }
    if(feature.taxon_id == "9606") {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "NATsDB:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "glyphs_natsdb");
      ta.setAttribute("href", "http://natsdb.cbi.pku.edu.cn/nats_seq.php?species=hs&acc="+feature.name);
      ta.innerHTML = feature.name;
    }
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "location: ";
  if(feature.genloc) { tspan.innerHTML += feature.genloc + " :: "; }
  ta = tdiv.appendChild(document.createElement('a'));
  ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
  ta.setAttribute("href", "./");
  ta.innerHTML = feature.chromloc;

  var start = Math.floor(feature.start);
  var end   = Math.floor(feature.end);
  var range = end-start;
  start -= Math.round(range*.25);
  end += Math.round(range*.25);
  var chromloc = feature.chrom+":" + start +".."+end;
  ta.setAttribute("onclick", "gLyphsLoadLocation(\""+chromloc+"\"); return false");


  var ss = feature.start;
  var se = feature.end;
  if(ss>se) { var t=ss; ss=se; se=t; }
  var len = se-ss+1;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "("+len+")";


  //hyperlinks here
  if(feature.mdata && feature.mdata["zenbu:hyperlink"]) {
    var parser = new DOMParser();
    tdiv = main_div.appendChild(document.createElement('div'));
    var value_array = feature.mdata["zenbu:hyperlink"];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      var hyperlinkDoc = parser.parseFromString(value, "text/xml");
      if(hyperlinkDoc && hyperlinkDoc.documentElement && (hyperlinkDoc.documentElement.tagName == "a")) {
        var hyperlink = hyperlinkDoc.documentElement;
        var url = hyperlink.getAttribute("href");
        var name = hyperlink.firstChild.nodeValue;
        var title = "hyperlink";
        if(hyperlink.getAttribute("title"))  { title = hyperlink.getAttribute("title"); }
        if(hyperlink.getAttribute("prefix")) { title = hyperlink.getAttribute("prefix"); }
        if(!title) { tile = "hyperlink"; }

        var tdiv2 = tdiv.appendChild(document.createElement('div'));
        tspan = tdiv2.appendChild(document.createElement('span'));
        //tspan.innerHTML = "hyperlink: ";
        tspan.innerHTML = escape(title) + ": "; 

        var link1 = tdiv2.appendChild(document.createElement("a"));
        link1.setAttribute("target", "f5rb");
        link1.setAttribute("href", unescape(url));
        link1.innerHTML = escape(name);
      }
    }
  }

  //if(feature.description) { object_html += "<div>" + encodehtml(feature.description)+ "</div>"; }
  //if(feature.gene_names) { object_html += "<div>alias: " + feature.gene_names +"</div>"; }
  //if(feature.entrez_id) { object_html += "<div>EntrezID: " + feature.entrez_id +"</div>"; }
  //if(feature.maxexpress) { object_html += "<div>maxexpress: " + feature.maxexpress + "</div>"; }
  if(feature.score || feature.exp_total) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    if(feature.score) { tdiv.innerHTML = "score: " + feature.score; }
    if(feature.exp_total) { tdiv.innerHTML += "  exp_total: " + feature.exp_total.toFixed(2); }
  }

  //
  //if(maxexpress && (maxexpress.length > 0)) {
  //  object_html += "<div>maxexpress: ";
  //  var express = maxexpress[0].getElementsByTagName("signal-histogram");
  //  for(var i=0; i<express.length; i++) {
  //    var platform = express[i].getAttribute("platform");
  //    if(platform == 'Illumina microarray') { platform = "ILMN"; }
  //    object_html += platform + ":" + express[i].getAttribute("maxvalue") + " ";
  //  }
  //}

  if(feature.cytostain) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "cytostain: " + feature.cytostain;
  }

  if(current_region.has_sequence) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    var a1 = tdiv.appendChild(document.createElement('a'));
    a1.setAttribute("target", "top");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "gLyphsShowFeatureSequence(\"" + feature.id+ "\"); return false;");
    a1.innerHTML = "genome sequence";
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  tdiv.innerHTML = "<a target=\"_eedb_xml\" href=\""+eedbSearchCGI+"?format=fullxml;id="+feature.id+"\">xml</a>";

  eedbClearSearchTooltip();
}

function gLyphsFeatureInfoEvent(param, value) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  if(param == "close") {
    info_div.innerHTML = ""; 
    info_div.setAttribute('style', "");
    info_div.removeAttribute("xpos_abs"); //reset the offsets
  }
  current_feature = undefined;
  gLyphsDrawExpressionPanel();
}


function gLyphsShowFeatureSequence(id) {
  var feature = eedbGetObject(id);
  if(!feature) { return; }

  var strand = feature.strand;
  if(strand!="+" && strand!="-") {
    if(current_region.flip_orientation) { strand = "-"; } else { strand = "+"; }
  }

  gLyphsShowRegionSequence(current_region.chrom, feature.start, feature.end, strand, feature.name);
}


function gLyphsShowSelectionSequence(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(!glyphTrack.selection) { return; }

  var strand = "+";
  if(current_region.flip_orientation) { strand = "-"; }

  //need to make the floating info panel since this is now attached to the feature_info
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  eedbClearSearchTooltip();
  info_div.innerHTML = "";
  info_div.setAttribute('style', "");

  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";

  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos + 5;

  if(info_div.getAttribute("xpos_abs")) { xpos = Math.floor(info_div.getAttribute("xpos_abs")); }
  info_div.setAttribute("xpos", xpos);
  info_div.setAttribute("ypos", ypos);

  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

  var tdiv, tspan, tinput, ta;
  var main_div = info_div;
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "width:350px; z-index:120; padding: 3px 3px 3px 3px; "+
                                 "background-color:rgb(220,220,255); border:inset; border-width:2px; "+
                                 "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

  //titlebar area to capture move events
  var titlebar_div = main_div.appendChild(document.createElement('div'));
  if(!current_region.exportSVGconfig) {
    titlebar_div.setAttribute("onmousedown", "gLyphsFeatureInfoToggleDrag('start');");
    titlebar_div.setAttribute("onmouseup", "gLyphsFeatureInfoToggleDrag('stop');");
  }

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsFeatureInfoEvent('close');return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = "current selection genome sequence";

  gLyphsShowRegionSequence(glyphTrack.selection.chrom, 
                           glyphTrack.selection.chrom_start, glyphTrack.selection.chrom_end, strand);
}


function gLyphsShowRegionSequence(chrom, start, end, strand, name) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  var divFrame = document.getElementById("feature_info_sequence_div");
  if(divFrame) { //toggle if off
    info_div.removeChild(divFrame);
    return;
  }
  divFrame = info_div.appendChild(document.createElement('div'));
  divFrame.id = "feature_info_sequence_div";
  divFrame.setAttribute('style', "margin-top:5px;");

  var chromloc   = chrom +":" + start + ".." + end;

  var paramXML = "<zenbu_query><format>xml</format><mode>sequence</mode>\n";
  paramXML += "<source_ids>"+ current_region.chrom_id+"</source_ids>\n";
  paramXML += "<asm>"+current_region.asm+"</asm>\n";
  paramXML += "<loc>"+chromloc+"</loc>\n";
  paramXML += "<strand>"+strand+"</strand>\n";
  paramXML += "</zenbu_query>\n";

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
  if(!sequenceXML) { return; }
  if(sequenceXML.length == 0) { return; }

  var sequence = sequenceXML[0].firstChild.nodeValue;
  //document.getElementById("message").innerHTML = "feature seq : " + sequence;

  //
  // now display in popup panel
  //
  var tdiv, tspan, tinput;

  // title
  if(name) {
    tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:12px; font-weight: bold;");
    tdiv.innerHTML = name + " genome sequence";
  }

  // location
  tdiv = divFrame.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "location: ";
  //if(feature.genloc) { tspan.innerHTML += feature.genloc + " :: "; }
  tspan.innerHTML += current_region.asm +" "+ chromloc + strand;

  var len = end-start+1;
  if(len > 1000000) {
    len = Math.round(len/100000);
    len = len/10.0;
    len += "mb";
  }
  else if(len > 1000) {
    len = Math.round(len/100);
    len = len/10.0;
    len += "kb";
  }
  else { len += "bp"; }
  tspan.innerHTML += " ["+ len + "]";


  //sequence box
  var seqBox = divFrame.appendChild(document.createElement('textarea'));
  seqBox.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; resize: vertical;");
  seqBox.setAttribute('rows', 13);
  seqBox.setAttribute('value', current_region.desc);
  seqBox.innerHTML = sequence;
}


function gLyphsFeatureInfoToggleDrag(mode, e) {
  if (!e) var e = window.event
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }
  if(!info_div) {
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    document.onmouseup   = endDrag;
    return;
  }

  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  if(mode =='start') {
    info_div.setAttribute("is_moving", 1);
    document.onmousemove = gLyphsFeatureInfoMoveEvent;

    //set the relative starting x/y position within the panel
    var offX = xpos - Math.floor(info_div.getAttribute("xpos"));
    var offY = ypos - Math.floor(info_div.getAttribute("ypos"));
    info_div.setAttribute("move_offsetX", offX);
    info_div.setAttribute("move_offsetY", offY);
    gLyphsFeatureInfoMoveEvent(e);
  } else {
    if(info_div.getAttribute("is_moving")) { //stop moving 
      //reset the global events back
      document.onmousemove = moveToMouseLoc;
      document.onmouseup = endDrag;
      info_div.removeAttribute("is_moving");
    }
  }
}


function gLyphsFeatureInfoMoveEvent(e) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  if(!info_div.getAttribute("is_moving")) { return; }
  if(!e) e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  xpos = xpos - Math.floor(info_div.getAttribute("move_offsetX"));
  ypos = ypos - Math.floor(info_div.getAttribute("move_offsetY"));

//  info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  info_div.style.left = xpos + "px";
  info_div.style.top  = ypos + "px";

  info_div.setAttribute("xpos", xpos);
  info_div.setAttribute("ypos", ypos);

  info_div.setAttribute("xpos_abs", xpos);
}


//-------------------------------------------------------------------
//
// some controls for working with expression/experiment filters
//
//-------------------------------------------------------------------

function gLyphsChangeExpressRegionConfig(type, value, widget) {
  var need_to_reload = 0;

  //document.getElementById("message").innerHTML = "gLyphsChangeExpressRegionConfig: type["+type+"]  value["+value+"]";

  if(type =="dwidth") {
    var new_width = Math.floor(value);
    if(new_width < 640) { new_width=640; }
    if(new_width != current_region.display_width) { need_to_reload=1; }
    current_region.display_width = new_width;
    gLyphsInitParams.display_width = new_width;
  }

  if(need_to_reload == 1) { redrawRegion(true); }
}

function gLyphsToggleTrackHide(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  glyphTrack.hideTrack = !(glyphTrack.hideTrack);
  if(!glyphTrack.hideTrack && !glyphTrack.dataLoaded) { prepareTrackXHR(trackID); }
  else { gLyphsDrawTrack(trackID); }
}

//--------------------------------------------------------
//
//
//       EEDB gLyphs genomic visualization toolkit
//
//
//--------------------------------------------------------

function gLyphsInit() {
  if(!browserCompatibilityCheck()) {
    window.location ="../browser_upgrade.html";
  }
  eedbShowLogin();
  if(current_user && !current_user.email) { return; }

  // reset global current_collaboration
  current_collaboration.name = "private";
  current_collaboration.uuid = "private";
  current_collaboration.callOutFunction = null;

  gLyphsInitColorSpaces();

  eedbCurrentUser = eedbShowLogin();

  //document.getElementById("message").innerHTML = "gLyphsInit: ";
  dhtmlHistory.initialize();
  jscolor.init();

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var mainSearch = document.getElementById("glyphsSearchBox1");
  if(mainSearch) {
    mainSearch.default_message = "search for annotations (eg EGR1 or kinase) or set location (eg: chr19:36373808-36403118)";
    eedbClearSearchResults("glyphsSearchBox1");
  }

  var glyphset = document.getElementById("gLyphTrackSet");
  if(!glyphset) { return; }

  if(!current_region) {
    current_region = new Object();
    current_region.asm = eedbDefaultAssembly;
  }
  var dwidth = Math.floor(gLyphsInitParams.display_width);
  if(!dwidth) { dwidth = Math.floor(800); }
  gLyphsInitParams.display_width = dwidth;
  current_region.display_width = dwidth;
  glyphset.setAttribute("style", 'width: '+ (dwidth+10)+'px;');

  var initialURL = dhtmlHistory.getCurrentLocation();
  if(parseConfigFromURL(initialURL)) {
    reloadRegion();
    if(current_region.chrom) {
      //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
      gLyphsChangeDhtmlHistoryLocation();
    } else {
      dhtmlHistory.add("#config="+current_region.configUUID);
    }
  } else {
    if(gLyphsInitParams.uuid !== undefined) { 
      gLyphsInitViewConfigUUID(gLyphsInitParams.uuid); 
      if(gLyphsInitParams.loc) { gLyphsInitLocation(gLyphsInitParams.loc); }
      if(gLyphsInitParams.display_width) { current_region.display_width = gLyphsInitParams.display_width; }
      reloadRegion();
    } else {
      gLyphsTracksInit("gLyphTrackSet");
    }
    //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
    gLyphsChangeDhtmlHistoryLocation();
  }

  current_region.first_init = true;
  dhtmlHistory.addListener(gLyphsHandleHistoryChange);
  current_region.first_init = false;

  if(current_region.active_track_exp_filter) { gLyphsSubmitExpExpressFilterSearch(); }

  if(current_region.init_search_term) {
    eedbSetSearchInput("glyphsSearchBox1", current_region.init_search_term);
    var e = new Object;
    e.type = "click"; //fake a click event
    e.keyCode = 13;
    glyphsMainSearchInput('glyphsSearchBox1', "",e);
    current_region.init_search_term = undefined;
  }

}


function gLyphsTracksInit(gLyphTrackSetID) {

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var titlediv = document.getElementById("gLyphs_title");
  if(titlediv) { titlediv.innerHTML = encodehtml(current_region.configname); }

  //var glyphset = document.getElementById(gLyphTrackSetID);
  var glyphset = document.getElementById("gLyphTrackSet");
  if(!glyphset) { return; }
  //glyphset can contain init configuartion information

  if(!current_region) {
    current_region = new Object();
    current_region.asm = eedbDefaultAssembly;
  }
  var dwidth = Math.floor(glyphset.getAttribute("display_width"));
  if(!dwidth) { dwidth = Math.floor(800); }
  current_region.display_width = dwidth;
  glyphset.setAttribute("style", 'width: '+ (dwidth+10)+'px;');

  var trackDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<trackDivs.length; i++) {
    var trackDiv = trackDivs[i];
    if(!trackDiv) continue;
    trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

    var trackID = trackDiv.getAttribute("id");

    var title      = trackDiv.getAttribute("trackTitle");
    var sourceName = trackDiv.getAttribute("source");
    if(!title && sourceName) { title = sourceName; }

    var glyphTrack        = new Object;
    glyphTrack.trackID    = trackID;
    glyphTrack.trackDiv   = trackDiv;
    glyphTrack.hideTrack  = 0;
    glyphTrack.title      = title;
    glyphTrack.description  = "";
    glyphTrack.peerName   = trackDiv.getAttribute("peer");
    glyphTrack.sources    = sourceName;
    glyphTrack.source_ids = "";
    glyphTrack.uuid       = "";
    glyphTrack.hashkey    = "";
    glyphTrack.server     = trackDiv.getAttribute("server");
    glyphTrack.serverType = trackDiv.getAttribute("server_type");
    glyphTrack.glyphStyle = trackDiv.getAttribute("glyph");
    glyphTrack.exptype    = trackDiv.getAttribute("exptype"); //exptype is for data query
    glyphTrack.datatype   = glyphTrack.exptype; // datatype is for display
    glyphTrack.expfilter  = "";
    glyphTrack.exppanelmode = "experiments";
    glyphTrack.exppanel_use_rgbcolor = false;
    glyphTrack.mdgroupkey   = "";
    glyphTrack.exp_name_mdkeys = "";
    glyphTrack.errorbar_type   = "stddev";
    glyphTrack.ranksum_display = "";
    glyphTrack.maxlevels  = Math.floor(trackDiv.getAttribute("levels"));
    glyphTrack.exp_mincut = 0.0;
    glyphTrack.expscaling = "auto";
    glyphTrack.scale_min_signal = 0;
    glyphTrack.logscale   = 0;
    glyphTrack.noCache    = false;
    glyphTrack.noNameSearch = true;
    glyphTrack.backColor  = "#F6F6F6";
    glyphTrack.posStrandColor  = "#008000";
    glyphTrack.revStrandColor  = "#800080";
    glyphTrack.posTextColor = "black";
    glyphTrack.revTextColor = "black";
    glyphTrack.hidezeroexps = false;
    glyphTrack.overlap_mode = "5end";
    glyphTrack.binning    = "sum";
    glyphTrack.experiment_merge = "mean";
    glyphTrack.strandless = false;
    glyphTrack.has_expression  = false;
    glyphTrack.has_subfeatures = false;
    glyphTrack.source_outmode = "full_feature";
    glyphTrack.exprbin_strandless = false;
    glyphTrack.exprbin_subfeatures = false;
    glyphTrack.exprbin_binsize = "";

    gLyphTrack_array[trackID] = glyphTrack;
    gLyphsDrawTrack(trackID);
  }

  createAddTrackTool();

  //
  // first get defaults from the XHTML document
  //
  var loc = glyphset.getAttribute("loc");
  var fid = glyphset.getAttribute("feature");

  reloadRegion();
}


function gLyphsParseLocation(query) {
  var region = new Object();
  region.asm = eedbDefaultAssembly;
  region.chrom = "chr1";
  region.start = 1;
  region.end   = 1000;
  region.strand  = "+";

  if(current_region) {
    region.asm   = current_region.asm;
    region.chrom = current_region.chrom;
    region.start = current_region.start;
    region.end   = current_region.end;
    if(current_region.flip_orientation) { region.strand = "-"; }
  }
  //document.getElementById("message").innerHTML = "loc ["+query+"]";

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
    //document.getElementById("message").innerHTML += "use previous assembly["+current_region.asm+"]";
  }

  var mymatch = /^([\w-._]+)\:(\d+)\.\.(\d+)([+-]*)$/.exec(query);
  if(mymatch && (mymatch.length >= 4)) {
    //document.getElementById("message").innerHTML += " matches chr:start..end format";
    rtnval = true;
    region.chrom = mymatch[1];
    region.start = Math.floor(mymatch[2]);
    region.end   = Math.floor(mymatch[3]);
    if(mymatch.length==5) {
      if(mymatch[4] == "-") { current_region.flip_orientation = true; }
      if(mymatch[4] == "+") { current_region.flip_orientation = false; }
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
      if(mymatch[4] == "-") { current_region.flip_orientation = true; }
      if(mymatch[4] == "+") { current_region.flip_orientation = false; }
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
      if(current_region) {
        gwidth = current_region.end - current_region.start;
      }
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


function gLyphsInitLocation(query) {
  //this function takes a location string, parses it, and
  //then sets the location configuration.
  //It only sets configuration and does not execute a reload

  if(!current_region) {
    current_region = new Object();
    current_region.display_width = Math.floor(800);
    current_region.asm = eedbDefaultAssembly;
  }
  if(current_region.asm === undefined) { current_region.asm = eedbDefaultAssembly; }

  var region = gLyphsParseLocation(query);
  if(region) {
    gLyphsSetLocation(region.asm, region.chrom, region.start, region.end);
    document.getElementById('genome_region_div').style.display = 'block';
    eedbEmptySearchResults("glyphsSearchBox1");
    return true;
  }
  return false;
}


function gLyphsSetLocation(asm, chrom, start, end) {
  //set this as the current location. 
  //performs a chromosome region check to makes sure coordinates are valid
  //extends the html history to include the new location
  //only sets configuration, does not execute reload.

  if(start<1) { start = 1; }
  if(end<1) { end = 1; }

  //query for chrom information from the eeDB server if needed
  getChromInfo(asm, chrom);

  if((current_region.asm == asm) && (current_region.chrom == chrom) && (current_region.chrom_length>0)) {
    if(end > current_region.chrom_length) { end = current_region.chrom_length; }
    if(start > current_region.chrom_length) { start = current_region.chrom_length; }
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

  current_region.start = Math.floor(start);
  current_region.end   = Math.floor(end);
}


function gLyphsRecenterView(chrpos) {
  var width = current_region.end - current_region.start;
  var start = chrpos - width/2;
  var end = start + width;

  gLyphsSetLocation(current_region.asm, current_region.chrom, start, end);
  reloadRegion();
  //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
  gLyphsChangeDhtmlHistoryLocation();
}


function gLyphsLoadLocation(query) {
  //parse location and reload the view
  if(gLyphsParseLocation(query)) {
    gLyphsInitLocation(query);
    reloadRegion();
    //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
    gLyphsChangeDhtmlHistoryLocation();
  }
}


function getChromInfo(asm, chrom) {
  if((current_region.asm == asm) && (current_region.chrom == chrom)) { return; }

  //reset
  current_region.asm          = asm;
  current_region.chrom        = chrom;
  current_region.chrom_length = -1;
  current_region.chrom_id     = null;
  current_region.has_sequence = false;

  var url = eedbSearchCGI + "?mode=chrom&asm="+asm+";chrom="+chrom;
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
      current_region.chrom = chromXML.getAttribute('chr');
      current_region.chrom_length = Math.floor(chromXML.getAttribute('length'));
      current_region.chrom_id = chromXML.getAttribute('id');
      current_region.chrom = chromXML.getAttribute('chr');
      break;
    }
  }
  var xml_asm = xmlDoc.getElementsByTagName("assembly");
  if(xml_asm && (xml_asm.length>0) && ((xml_asm[0].getAttribute('asm') == asm) || (xml_asm[0].getAttribute('ucsc') == asm) || (xml_asm[0].getAttribute('ncbi') == asm) || (xml_asm[0].getAttribute('ncbi_acc') == asm))) { 
    if(xml_asm[0].getAttribute('seq') =="y") { current_region.has_sequence = true; }
    current_region.genus = xml_asm[0].getAttribute('genus');
    current_region.species = xml_asm[0].getAttribute('species');
    current_region.common_name = xml_asm[0].getAttribute('common_name');
    current_region.asm = xml_asm[0].getAttribute('asm');
    current_region.ucsc_asm = xml_asm[0].getAttribute('ucsc');
    current_region.ncbi_asm = xml_asm[0].getAttribute('ncbi');
    current_region.ncbi_asm_accn = xml_asm[0].getAttribute('ncbi_acc');
    current_region.release_date = xml_asm[0].getAttribute('release_date');
  }
  //update the genome desc
  var genomeDiv = document.getElementById("glyphs_genome_desc");
  if(genomeDiv) {
    genomeDiv.setAttribute("style", "font-family:arial,helvetica,sans-serif; font-size:12px; color:black;");
    genomeDiv.innerHTML="";
    var span1 = genomeDiv.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:3px; color:black;");
    span1.innerHTML = current_region.common_name +" "+ current_region.asm; 
    //if(current_region.ucsc_asm) { span1.innerHTML += " "+current_region.ucsc_asm; }
    if(current_region.ncbi_asm && current_region.ncbi_asm!=current_region.asm) { span1.innerHTML += " "+current_region.ncbi_asm; }
    if(current_region.ucsc_asm && current_region.ucsc_asm!=current_region.asm) { span1.innerHTML += " "+current_region.ucsc_asm; }
    //if(current_region.ncbi_asm_accn) { span1.innerHTML += " "+current_region.ncbi_asm_accn; }

    if(current_region.release_date) {
      span1 = genomeDiv.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:3px; color:black; ");
      span1.innerHTML = current_region.release_date;
    }
    if(current_region.genus) {
      span1 = genomeDiv.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:3px; color:black;");
      span1.innerHTML = "( "+current_region.genus + " " + current_region.species+" )";
    }
  }
}


function glyphsGetChromSequence() {
  current_region.genome_sequence  = null;

  if(!current_region.chrom_id) { return; }
  if((current_region.display_width / (current_region.end  - current_region.start)) < 5) { return; }

  var chromloc   = current_region.chrom +":" + current_region.start + ".." + current_region.end;

  var paramXML = "<zenbu_query><format>xml</format><mode>sequence</mode>\n";
  paramXML += "<source_ids>"+ current_region.chrom_id+"</source_ids>\n";
  paramXML += "<asm>"+current_region.asm+"</asm>\n";
  paramXML += "<loc>"+chromloc+"</loc>\n";
  paramXML += "</zenbu_query>\n";

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
    current_region.genome_sequence  =  sequenceXML[0].firstChild.nodeValue;
    //document.getElementById("message").innerHTML = "chromseq : " + current_region.genome_sequence;
  }
}


function parseConfigFromURL(urlConfig) {
  //this function takes URL address, parses for configuration UUID and
  //location, and then reconfigures the view.  But it does not execute a reload/redraw

  if(!urlConfig && zenbu_embedded_view) { return; }

  //document.getElementById("message").innerHTML += "parseConfigFromURL [" + urlConfig +"]";
  if(!urlConfig) { return gLyphsLastSessionConfig(); }

  //reset some variables
  current_region.highlight_search = "";
  current_region.init_search_term = "";
  current_region.active_track_exp_filter = "";

  var search_term;
  var params = urlConfig.split(";");
  var rtnval = false;
  for(var i=0; i<params.length; i++) {
    var param = params[i];
    //document.getElementById("message").innerHTML += " param[" + param +"]";
    var tagvalue = param.split("=");
    if(tagvalue.length != 2) { continue; }
    if(!rtnval && (tagvalue[0] == "config")) {
      gLyphsInitViewConfigUUID(tagvalue[1]);
      rtnval = true;
    }
    if(!rtnval && ((tagvalue[0] == "configbase") || (tagvalue[0] == "basename"))) {
      gLyphsInitConfigBasename(tagvalue[1]);
      rtnval = true;
    }
    if(tagvalue[0] == "loc") {
      gLyphsInitLocation(tagvalue[1]);
    }
    if(tagvalue[0] == "search") {
      current_region.init_search_term = tagvalue[1];
    }
    if(tagvalue[0] == "dwidth") {
      var dwidth = Math.floor(tagvalue[1]); 
      if(dwidth && !isNaN(dwidth)) { current_region.display_width = dwidth; }
    }
    if(tagvalue[0] == "active_track_exp_filter") {
      current_region.active_track_exp_filter = tagvalue[1];
      if(current_region.active_track_exp_filter && current_region.active_trackID) {
        glyphTrack = gLyphTrack_array[current_region.active_trackID];
        if(glyphTrack) {
          glyphTrack.expfilter = current_region.active_track_exp_filter;
        }
      }
    }
    if(tagvalue[0] == "highlight_search") {
      current_region.highlight_search = tagvalue[1];
    }
    //document.getElementById("message").innerHTML += " rtn="+rtnval;
  }
  //document.getElementById("message").innerHTML += " parseConfigFromURL="+rtnval;
  if(!rtnval) { rtnval = gLyphsLastSessionConfig(); }

  return rtnval;
}

function gLyphsHandleHistoryChange(newLocation, historyData) {
  if(zenbu_embedded_view) { return; }
  if(current_region.first_init) {
    current_region.first_init = false;
    return;
  }
  //document.getElementById("message").innerHTML += " gLyphsHandleHistoryChange["+newLocation+"]";
  eedbEmptySearchResults("glyphsSearchBox1");
  if(parseConfigFromURL(newLocation)) { 
    reloadRegion(); 
    if(current_region.active_track_exp_filter) { gLyphsSubmitExpExpressFilterSearch(); }
    if(current_region.init_search_term) {
      eedbSetSearchInput("glyphsSearchBox1", current_region.init_search_term);
      var e = new Object;
      e.type = "click"; //fake a click event
      e.keyCode = 13;
      glyphsMainSearchInput('glyphsSearchBox1', "",e);
      current_region.init_search_term = undefined;
    }
  }
}

function redrawRegion(reloadExpression) {
  var glyphset = document.getElementById("gLyphTrackSet");
  glyphset.setAttribute("style", 'width: '+ (current_region.display_width+10) +'px;');

  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    if((glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot") && reloadExpression) {
      gLyphsDrawTrack(trackID);
      prepareTrackXHR(trackID);
    } else {
      gLyphsRenderTrack(glyphTrack);
      gLyphsDrawTrack(trackID);
    }
  }
}


function gLyphsNavigationControls(glyphset) {
  if(!glyphset) { return; }
  var glyphsID = glyphset.id;

  var dwidth = current_region.display_width;
  glyphset.setAttribute("style", 'width: '+ (dwidth+10)+'px;');

  var navCtrls = document.getElementById(glyphsID + "_navigation_ctrls");
  if(!navCtrls) {
    navCtrls = document.createElement("div");
    navCtrls.id = glyphsID + "_navigation_ctrls";
    glyphset.insertBefore(navCtrls, glyphset.firstChild);

    navCtrls.innerHTML ="";

    //view load progress div
    var loadProgress = navCtrls.appendChild(document.createElement("div"));
    loadProgress.id = "gLyphs_load_progress_div";
    loadProgress.setAttribute("style", "margin-top:5px; margin-bottom:3px; font-size:12px; display:none; ");

    //location
    var locInfo = navCtrls.appendChild(document.createElement("div"));
    locInfo.id = "gLyphs_location_info";
    locInfo.setAttribute("style", "float:left; margin-top:5px; margin-bottom:3px; font-size:12px; ");
    locInfo.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    if(zenbu_embedded_view) {
      locInfo.setAttributeNS(null, "onclick", "zenbu_toggle_embedded_view();");
      locInfo.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"go to full view in ZENBU\",150);");
    } else {
      locInfo.setAttributeNS(null, "onclick", "gLyphsEditLocation();");
      locInfo.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"change location\",80);");
    }
 
    //move buttons
    var navCtrlRight = navCtrls.appendChild(document.createElement("div"));
    navCtrlRight.setAttribute("style", "float:right; margin-bottom:3px;");

    var span2 = navCtrlRight.appendChild(document.createElement("span"));
    span2.setAttribute("style", "margin-right:3px; margin-left:5px;");

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('ll')");
    button.innerHTML = "<<";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('l')");
    button.innerHTML = "<";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('r')");
    button.innerHTML = ">";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('rr')");
    button.innerHTML = ">>";

    //magnify buttons
    span2 = navCtrlRight.appendChild(document.createElement("span"));
    span2.setAttribute("style", "margin-left:7px;");

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 0.1)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "+10x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 0.2)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "+5x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 0.5)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom in\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "+2x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:5px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 2)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "-2x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 5)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "-5x";

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "margin-right:10px; font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:1px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('zoomfactor', 10)");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"zoom out\",50);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "-10x";

    //zoom level widget
    var zoomdiv = document.createElement("span");    
    //navCtrlRight.appendChild(zoomdiv);
    zoomdiv.setAttribute("style", "font-size:10px; font-weight:bold; padding: 1px 4px; background: #EEEEEE; margin-left:17px; margin-right:10px; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");

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
      var button = navCtrlRight.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "glyphsGlobalSettingsPanel();");
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"global view configuration settings\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "settings";

      // export view
      var button = navCtrlRight.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "configureExportSVG();");
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"export view to SVG image file\",80);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "export svg";
    }

    // save view
    /*
    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "gLyphsSaveConfig();");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"save view configuration to collaboration\",100);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "save view";
    */

    //reload
    /*
    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "regionChange('reload')");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"reload view\",80);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "reload";
    */

    var button = navCtrlRight.appendChild(document.createElement("button"));
    button.id = "zenbu_embed_toggle_button";
    button.setAttribute("style", "font-size:10px; padding: 1px 1px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
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
  }

  current_region.loc_desc = "";
  if(current_region.asm && current_region.chrom) {
    var asm    = current_region.asm;
    var chrom  = current_region.chrom;
    var start  = current_region.start;
    var end    = current_region.end;
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
    current_region.length_desc = "[len "+ len + " ]";
    
    var chromloc = chrom +" " + numberWithCommas(start) + "-" + numberWithCommas(end);
    if(current_region.flip_orientation) { chromloc += "-"; } else { chromloc += "+"; }
    //current_region.loc_desc = asm + ":: " + chromloc + "  [len "+ len + " ]";
    current_region.loc_desc = chromloc + "  [len "+ len + " ]";
  }

  if(document.getElementById("regionWidthText")) {
    document.getElementById("regionWidthText").setAttribute('value', dwidth);
  }

  var desc = current_region.loc_desc;
  if(current_region.trackline_chrpos) { desc += "<span style=\'font-size:8pt; color: orangered;\'> " +current_region.trackline_chrpos+ "</span>"; }
  if(document.getElementById("gLyphs_location_info")) {
    document.getElementById("gLyphs_location_info").innerHTML = desc;
  }

  //view loading progress
  var loadProgress = document.getElementById("gLyphs_load_progress_div");
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  var load_count =0;
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
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

function gLyphsEditLocation() {
  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;

  var chromloc = asm + "::" + chrom +":" + start + "-" + end;
  eedbSetSearchInput("glyphsSearchBox1", chromloc);
}


function zenbu_toggle_embedded_view() {
  //to toggle between full and embedded mode and to redirect to the ZENBU at RIKEN website
  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var chromloc = asm + "::" + chrom +":" + start + "-" + end;

  var url = eedbWebRoot + "/gLyphs/";
  if(!zenbu_embedded_view) { url +="index_embed.html"; }
  url += "#config=" + current_region.configUUID;
  url += ";loc=" + chromloc;
  if(window.top) { window.top.location= url; }
  else { window.location= url; }
}


function reloadRegion() {
  var glyphset = document.getElementById("gLyphTrackSet");

  gLyphsNavigationControls(glyphset);

  current_feature = undefined; //clear current feature

  var dwidth = current_region.display_width;
  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var len    = end-start+1;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }
  current_region.length_desc = "[len "+ len + " ]";

  //document.getElementById("message").innerHTML = "";

  eedbShowLogin();
  gLyphsDisplayFeatureInfo(); //clears

  if(document.getElementById("regionWidthText")) { 
    document.getElementById("regionWidthText").setAttribute('value', dwidth);
  }

  // clear out the old configs
  current_region.exportSVGconfig = undefined;
  current_region.saveconfig = undefined;
  if(document.getElementById("global_panel_layer")) { 
    document.getElementById("global_panel_layer").innerHTML ="";
  }

  var chromloc = chrom +":" + start + "-" + end;

  //current_region.loc_desc = asm + "::" + chromloc + "  [len "+ len + " ]";
  //if(document.getElementById("gLyphs_location_info")) { 
  //  document.getElementById("gLyphs_location_info").innerHTML = current_region.loc_desc;
  //}

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

  if(!current_region.view_config_loaded) {
    if(!eedbCurrentUser) {
      //if no configUUID then not a valid config or no access to it
      //assume it exists but user can not see it because they forgot to login
      gLyphsNoUserWarn("access this view configuration");
    } else {
      gLyphsGeneralWarn("This view configuration is not available.<br>"+ 
                        "It has either been deleted from the system, or you do not have privilege to access it.");
    }
  }
}


function prepareTrackXHR(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  //clear and prepare data containers
  glyphTrack.newconfig = undefined;
  glyphTrack.glyphs_array = new Array(); //clear the old feature objects

  //code to delay loading of data when tracks are compressed
  glyphTrack.dataLoaded = false;
  if(glyphTrack.hideTrack) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  //trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  gLyphsShowTrackLoading(trackID);

  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var chromloc = chrom +":" + start + ".." + end;

  var peerName   = glyphTrack.peerName;
  var sourceName = glyphTrack.sources;
  var source_ids = glyphTrack.source_ids;
  var server     = glyphTrack.server;
  var serverType = glyphTrack.serverType;
  var glyphStyle = glyphTrack.glyphStyle;
  var exptype    = glyphTrack.exptype;
  var overlap_mode = glyphTrack.overlap_mode;
  var binning      = glyphTrack.binning;

  var dwidth     = current_region.display_width;
    
  glyphTrack.has_subfeatures = false;
  glyphTrack.has_expression  = false;
  glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
  
  var format = "fullxml";
  var paramXML = "<zenbu_query>\n";
  if(glyphTrack.noCache | current_region.nocache) { paramXML += "<nocache/>\n"; }

  if(glyphTrack.title) { paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n"; }
  if(current_region.configUUID) { paramXML += "<view_uuid>"+ current_region.configUUID +"</view_uuid>\n"; }

  if(peerName) { paramXML += "<peer_names>"+peerName+"</peer_names>\n"; }
  if(source_ids) { paramXML += "<source_ids>"+source_ids+"</source_ids>\n"; }
  else {
    if(sourceName) { paramXML += "<source_names>"+sourceName+"</source_names>\n"; }
  }
  if(exptype) { paramXML += "<exptype>"+exptype+"</exptype>\n"; }
  if(glyphTrack.uuid) { paramXML += "<track_uuid>"+glyphTrack.uuid+"</track_uuid>\n"; }
  
  paramXML += "<asm>"+current_region.asm+"</asm>\n";
  if(glyphStyle && (glyphStyle=='cytoband')) { 
    paramXML += "<chrom>"+chrom+"</chrom>\n"; 
    glyphsGetChromSequence();
  } else { paramXML += "<loc>"+chromloc+"</loc>\n"; }

  paramXML += "<mode>region</mode>\n";
  paramXML += "<source_outmode>" + glyphTrack.source_outmode + "</source_outmode>\n";

  if(glyphTrack.exprbin_strandless)  { paramXML += "<strandless>true</strandless>\n"; }
  if(glyphTrack.exprbin_subfeatures) { paramXML += "<overlap_check_subfeatures>true</overlap_check_subfeatures>\n"; }

  paramXML += "<display_width>"+dwidth+"</display_width>\n";

  if(glyphTrack.exprbin_binsize) { paramXML += "<bin_size>"+ glyphTrack.exprbin_binsize +"</bin_size>\n"; }

  if(glyphTrack.spstream_mode == "expression") {
    paramXML += "<binning>"+binning+"</binning>\n";
    //paramXML += "<binning>sum</binning>\n";
    paramXML += "<overlap_mode>"+overlap_mode+"</overlap_mode>\n";
    if(!glyphTrack.script) {
      //switch back to the legacy default histogram binning
      paramXML += "<expression_binning>true</expression_binning>\n"; 
    }
  }

  if(glyphStyle && (glyphStyle=='centroid' || 
                    glyphStyle=='thick-arrow' || 
                    glyphStyle=='medium-arrow' || 
                    glyphStyle=='box' || 
                    glyphStyle=='arrow' || 
                    glyphStyle=='line' || 
                    glyphStyle=='exon' || 
                    glyphStyle=='medium-exon' || 
                    glyphStyle=='thin-exon' || 
                    glyphStyle=='utr' || 
                    glyphStyle=='thin'
                   )) { format = "xml"; }
  if(glyphTrack.colorMode == "signal") { format = "fullxml"; }
  if(glyphTrack.source_outmode == "full_feature") { format = "fullxml"; }
  if(glyphStyle && (glyphStyle=="signal-histogram" || glyphStyle=="1D-heatmap" || 
                    glyphStyle=="experiment-heatmap" || glyphStyle=="split-signal")) { 
    paramXML += "<expression_visualize/>\n";
  }

  if(glyphTrack.script) {
    //inserts direct script XML <zenbu_script> since it was parsed and
    //partially validated by the javascript
    paramXML += glyphTrack.script.spstreamXML;
    format = "fullxml";
  }
  paramXML += "<format>"+format+"</format>\n";
  paramXML += "</zenbu_query>\n";

  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:640px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);
  //return;

  if(pending_track_XHRs[trackID] != null) { 
    var xhrObj = pending_track_XHRs[trackID]; 
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    pending_track_XHRs[trackID] = null; 
    delete pending_track_XHRs[trackID]; 
  }

  var xhrObj        = new Object;
  xhrObj.trackID    = trackID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.asm        = current_region.asm;
  xhrObj.start      = current_region.start;
  xhrObj.end        = current_region.end;
  xhrObj.chrom      = current_region.chrom;
  xhrObj.paramXML   = paramXML;

  pending_track_XHRs[trackID] = xhrObj;

  glyphTrack.loading = true;
  glyphTrack.load_retry = 0;
  //document.getElementById("message").innerHTML += " prepare["+trackID+"]";

  setTimeout("glyphsSendPendingXHRs();", 30); //30msec
}



function glyphsSendPendingXHRs() {
  var glyphset = document.getElementById("gLyphTrackSet");
  gLyphsNavigationControls(glyphset);

  var pending_count =0;
  for(var trackID in pending_track_XHRs) { 
    if(active_track_XHRs[trackID] == null) { pending_count++; }
  }
  var active_count =0;
  for(var trackID in active_track_XHRs) { active_count++; }
  //document.getElementById("message").innerHTML = "pendingXHRs[" + pending_count + "]  activeXHRs[" + active_count + "]";
  if(pending_count==0) { 
    setTimeout("glyphsSendPendingXHRs();", 10000); //10 seconds
    return; 
  }

  if(active_count>=maxActiveTrackXHRs) { 
    setTimeout("glyphsSendPendingXHRs();", 1000); //1 second
    return; 
  }
  for(var trackID in pending_track_XHRs) { 
    if(active_track_XHRs[trackID] == null) { 
      var xhrObj = pending_track_XHRs[trackID]; 
      if(xhrObj.xhr != null) { xhrObj.xhr=null; }
      pending_track_XHRs[trackID] = null; 
      delete pending_track_XHRs[trackID]; 
      active_track_XHRs[trackID] = xhrObj;
      glyphsSendTrackXHR(xhrObj);
      active_count++;
    }
    if(active_count>=maxActiveTrackXHRs) { return; }
  }
}


function glyphsSendTrackXHR(xhrObj) {
  if(xhrObj == null) { return; }
  //document.getElementById("message").innerHTML += "  send[" + xhrObj.trackID + "]";

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  xhrObj.xhr = xhr;

  //funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { gLyphsXHResponseParseData(id); };}(xhrObj.trackID);

  xhr.open("POST", eedbRegionCGI, true);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", xhrObj.paramXML.length);
  //xhr.setRequestHeader("Content-encoding", "x-compress, x-gzip, gzip");
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(xhrObj.paramXML);
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
    redrawRegion(false);
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
    if(current_feature) {
      start = current_feature.start;
      end   = current_feature.end;
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

  gLyphsSetLocation(asm, chrom, start, end);

  reloadRegion();
  //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
  gLyphsChangeDhtmlHistoryLocation();
}


function gLyphsShowTrackLoading(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  if(!glyphTrack.trackDiv) { return; }

  if(current_region.hide_compacted_tracks && glyphTrack.hideTrack) { 
    clearKids(glyphTrack.trackDiv)
    glyphTrack.svg = undefined;
    glyphTrack.dataLoaded = false;
    return;
  }

  svg = createSVG(current_region.display_width+10, 13);
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 14;
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  svg.appendChild(glyphTrack.top_group);

  //rebuild view
  clearKids(glyphTrack.trackDiv)
  glyphTrack.trackDiv.appendChild(svg);
  gLyphsDrawHeading(glyphTrack);
  gLyphsCreateMoveBar(glyphTrack);

  if(glyphTrack.hideTrack) { return; }

  if(!svg) return;

  var trackmsg = document.getElementById("trackmsg_"+trackID);
  if(!trackmsg) {
    var trackmsg = svg.appendChild(document.createElementNS(svgNS,'text'));
    trackmsg.id = "trackmsg_"+trackID;
    trackmsg.setAttributeNS(null, 'x', (current_region.display_width-120)+'px');
    trackmsg.setAttributeNS(null, 'y', '9px');
    trackmsg.setAttributeNS(null, "font-size","10px");
    trackmsg.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    trackmsg.setAttributeNS(null, 'style', 'fill: red;');
  }
  clearKids(trackmsg);

  var textNode = document.createTextNode("track loading");
  if(glyphTrack.load_retry>0) {
    textNode = document.createTextNode("network error : track reload try " + glyphTrack.load_retry);
    trackmsg.setAttributeNS(null, 'x', (current_region.display_width-220)+'px');
  }
  if(glyphTrack.load_retry<0) {
    textNode = document.createTextNode("error: failed to load track");
    trackmsg.setAttributeNS(null, 'x', (current_region.display_width-180)+'px');
  }
  trackmsg.appendChild(textNode);
  
  var backRect = document.getElementById("backRect_"+trackID);
  if(backRect) {
    backRect.setAttributeNS(null, 'style', 'fill: #FFFAF0;');
  }
} 


function gLyphsTrackSecurityError(glyphTrack) {
  if(glyphTrack == null) { return; }
  
  clearKids(glyphTrack.trackDiv)
  var svg = createSVG(current_region.display_width+10, 13);
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 14;
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  svg.appendChild(glyphTrack.top_group);
  glyphTrack.trackDiv.appendChild(svg);
  gLyphsDrawHeading(glyphTrack);
  gLyphsCreateMoveBar(glyphTrack);

  var trackmsg = document.getElementById("trackmsg_"+ glyphTrack.trackID);
  if(!trackmsg) {
    var trackmsg = svg.appendChild(document.createElementNS(svgNS,'text'));
    trackmsg.id = "trackmsg_"+glyphTrack.trackID;
    trackmsg.setAttributeNS(null, 'x', (current_region.display_width/2)+'px');
    trackmsg.setAttributeNS(null, 'y', '9px');
    trackmsg.setAttributeNS(null, "font-size","10px");
    trackmsg.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    trackmsg.setAttributeNS(null, 'style', 'fill: red;');
  }
  clearKids(trackmsg);

  //var textNode = document.createTextNode("security access error");
  var textNode = document.createTextNode("data unavailable");
  trackmsg.appendChild(textNode);
}


function gLyphsXHResponseParseData(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var xhrObj = active_track_XHRs[trackID];
  if(xhrObj == null) {  
    //document.getElementById("message").innerHTML += trackID + ' no xhrObj';
    gLyphsDrawTrack(trackID);
    glyphTrack.loading = false;
    setTimeout("glyphsSendPendingXHRs();", 30); //30msec
    return; 
  }
  //these tests are to make sure the XHR has fully returned
  var xhr = xhrObj.xhr;
  if(xhr == null) { 
    //document.getElementById("message").innerHTML += trackID + ' no xhr ';
    return;
  }

  //document.getElementById("message").innerHTML += " ["+trackID + '-rs'+xhr.readyState+ "-st"+xhr.status + "]";
  if(xhr.readyState!=4) { return; }

  if(xhr.status>=500) { 
    //document.getElementById("message").innerHTML += '-ERROR:'+xhr.status;
    glyphTrack.load_retry++;
    if(glyphTrack.load_retry <=3) {
      glyphTrack.loading = true;
      gLyphsDrawTrack(trackID);
      glyphsSendTrackXHR(xhrObj); //resend/requeue the track
    } else {
      glyphTrack.load_retry = -1;
      gLyphsDrawTrack(trackID);
    }
    //glyphsSendPendingXHRs();
    //pending_track_XHRs[trackID] = null;
    //delete pending_track_XHRs[trackID];
    //active_track_XHRs[trackID] = xhrObj;
    //glyphsSendTrackXHR(xhrObj);
    return; 
  }

  if(xhr.status!=200) { return; }
  if(xhr.responseXML == null) { 
    //hmm this might be a true error condition.
    //status says 4 and 200 (meaning done) but no responseXML
    //document.getElementById("message").innerHTML += trackID + ' no responseXML ';
    glyphTrack.load_retry++;
    if(glyphTrack.load_retry <=3) {
      glyphTrack.loading = true;
      gLyphsDrawTrack(trackID);
      glyphsSendTrackXHR(xhrObj); //resend/requeue the track
    } else {
      glyphTrack.load_retry = -1;
      gLyphsDrawTrack(trackID);
    }
    return; 
  }

  
  //not the correct one
  if((xhrObj.asm != current_region.asm) ||
     (xhrObj.chrom != current_region.chrom) ||
     (xhrObj.start != current_region.start) ||
     (xhrObj.end != current_region.end)) { 
    xhrObj.xhr = null;
    active_track_XHRs[trackID] = null;
    delete active_track_XHRs[trackID];
    setTimeout("glyphsSendPendingXHRs();", 30); //30msec
    //document.getElementById("message").innerHTML += trackID + ' not matching ';
    return; 
  }
  

  //clear selection if it is out-of-region here
  if((glyphTrack.selection) && 
     ((current_region.chrom != glyphTrack.selection.chrom) ||
      (current_region.start > glyphTrack.selection.chrom_end) ||
      (current_region.end < glyphTrack.selection.chrom_start))) { glyphTrack.selection = null; }

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    //document.getElementById("message").innerHTML= 'Problem with central DB!';
    glyphTrack.load_retry++;
    if(glyphTrack.load_retry <=3) {
      glyphTrack.loading = true;
      gLyphsDrawTrack(trackID);
      glyphsSendTrackXHR(xhrObj); //resend/requeue the track
    } else {
      glyphTrack.load_retry = -1;
      gLyphsDrawTrack(trackID);
    }
    return;
  }
  //document.getElementById("message").innerHTML += ' draw:' + trackID;

  glyphTrack.loading = false;
  glyphTrack.dataLoaded = true;
  glyphTrack.load_retry = 0;

  gLyphsParseFeatureTrackData(glyphTrack, xhrObj);
  
  gLyphsRenderTrack(glyphTrack);

  //all information is now transfered into objects so
  //can delete XML and XHRs
  xhrObj.xhr = null;
  active_track_XHRs[trackID] = null;
  delete active_track_XHRs[trackID];
 
  gLyphsDrawTrack(trackID);
  if(current_region.active_trackID == trackID) { 
    gLyphsDrawExpressionPanel();
  }

  //see if there are anymore tracks pending to be sent
  setTimeout("glyphsSendPendingXHRs();", 30); //30msec
}


function gLyphsRenderTrack(glyphTrack) {
  if(glyphTrack == null) { return; }

  gLyphsRecalcTrackExpressionScaling(glyphTrack.trackID);
  
  if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot") { 
    gLyphsRenderExpressionTrack(glyphTrack);
  } else if(glyphTrack.glyphStyle == "split-signal") { 
    gLyphsRenderSplitSignalTrack(glyphTrack);
  } else {
    gLyphsRenderFeatureTrack(glyphTrack);
  }
}


function gLyphsDrawTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack.hideTrack && current_region.hide_compacted_tracks) {
    clearKids(glyphTrack.trackDiv)
    glyphTrack.svg = undefined;
    glyphTrack.dataLoaded = false;
    return;
  }

  if(glyphTrack && glyphTrack.loading) { 
    gLyphsShowTrackLoading(trackID);
    return; 
  }

  //clear the newconfig / reconfig
  glyphTrack.newconfig = undefined;

  if(glyphTrack.security_error) {
   gLyphsTrackSecurityError(glyphTrack);
   return;
  }

  if(glyphTrack.hideTrack || (glyphTrack.svg === undefined)) { 
    clearKids(glyphTrack.trackDiv)
    var svg = createSVG(current_region.display_width+10, 13);
    glyphTrack.svg = svg;
    glyphTrack.svg_height = 14;
    glyphTrack.top_group = document.createElementNS(svgNS,'g');
    svg.appendChild(glyphTrack.top_group);
    glyphTrack.trackDiv.appendChild(svg);
    gLyphsDrawHeading(glyphTrack);
    gLyphsCreateMoveBar(glyphTrack);
    return;
  }
  //document.getElementById("message").innerHTML += ' gLyphsDrawTrack ' + trackID;

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphStyle == "signal-histogram" || glyphStyle == "xyplot") { 
    gLyphsDrawExpressTrack(glyphTrack);
  } else if(glyphStyle == "split-signal") { 
    gLyphsDrawSplitSignalTrack(glyphTrack);
  } else {
    gLyphsDrawFeatureTrack(glyphTrack);
  }
  gLyphsCreateMoveBar(glyphTrack);
  //document.getElementById("message").innerHTML= 'finished gLyphsDrawTrack ' + trackID;
}

//------------------------
//
// feature tracks
//
//------------------------

function gLyphsParseFeatureTrackData(glyphTrack, xhrObj) {
  //this is the call back function after a new XHR has completed
  //which converts the XML into JSON objects so the XHR and XML
  //can deleted

  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;
  //document.getElementById("message").innerHTML += "  parseFeature["+xhrObj.trackID+"]";

  if(!glyphTrack.glyphs_array) { glyphTrack.glyphs_array = new Array(); }
  glyphTrack.glyphs_array = [];

  if(!glyphTrack.feature_array) { glyphTrack.feature_array = new Array(); }
  glyphTrack.feature_array = [];
  glyphTrack.total_obj_count = 0;


  if(!glyphTrack.experiments) { glyphTrack.experiments = new Object(); }
  glyphTrack.experiment_array = new Array();
  glyphTrack.datatypes   = new Object();
  
  glyphTrack.hashkey = "";
  var trackcache = xmlDoc.getElementsByTagName("track_cache");
  if(trackcache && trackcache.length>0) {
    glyphTrack.hashkey = trackcache[0].getAttribute("hashkey");
    /*
    if(glyphTrack.script) {
      var zscript = xmlDoc.getElementsByTagName("zenbu_script");
      if(zscript.length>0) {
        var serializer = new XMLSerializer();
        //glyphTrack.script.spstreamXML = serializer.serializeToString(zscript[0]);
      }
    }
    */
  }

  glyphTrack.security_error = "";
  var security_error = xmlDoc.getElementsByTagName("security_error");
  if(security_error && security_error.length>0) {
    glyphTrack.security_error = security_error[0].getAttribute("blocked");
    return;
  }

  // get the experiments for this track
  var exps = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<exps.length; i++) {
    var expID = exps[i].getAttribute("id");
    if(!glyphTrack.experiments[expID]) { 
      var source = new Object();
      eedbParseMetadata(exps[i], source);
      glyphTrack.experiments[expID] = source;
    }
  }

  // get the top features from the XML
  // TODO look into alternate method here. this will grab all features
  //  and then I need to figure out if it is top or not. maybe can use children()
  var xml_features = xmlDoc.getElementsByTagName("feature");
  var mode = "full";
  var dtype = "";
  var feat_idx=0;
  for(var i=0; i<xml_features.length; i++) {
    var featureXML = xml_features[i];
    if(featureXML.parentNode.tagName != "region") { continue; }
    var feature = null;;
    if(mode == "full") {
      feature = convertFullFeatureXML(featureXML);
    } else {
      feature = convertFeatureXML(featureXML);
    }
    if(feature) {
      feature.trackID = glyphTrack.trackID;
      feature.fidx = feat_idx++;
      glyphTrack.total_obj_count++;
      glyphTrack.feature_array.push(feature);
      if(feature.subfeatures) { 
        glyphTrack.has_subfeatures=true; 
        glyphTrack.total_obj_count += feature.subfeatures.length;
      }
      if(feature.expression)  { 
        glyphTrack.has_expression = true;
        glyphTrack.total_obj_count += feature.expression.length;
        for(var j=0; j<feature.expression.length; j++) {
          var expression = feature.expression[j];
          glyphTrack.datatypes[expression.datatype] = true;
          if(!glyphTrack.experiments[expression.expID]) { 
            glyphTrack.experiments[expression.expID] = new Object(); 
          }
          if(!dtype) { dtype = expression.datatype; }
        }        
      }
      //color mdata postprocess
      if(glyphTrack.color_mdkey!="bed:itemRgb") {
        if(feature.mdata[glyphTrack.color_mdkey]) {
          feature.color = feature.mdata[glyphTrack.color_mdkey];
        } else {
          feature.color = "black"; //specified mdkey, but not present so default to black
        }
      }
    }
  }  
  
  // get the experiments for this track
  /*
  var exps = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<exps.length; i++) {
    var expID = exps[i].getAttribute("id");
    if(!glyphTrack.experiments[expID]) { glyphTrack.experiments[expID] = new Object(); }
  }
  */
  gLyphsCacheSources(glyphTrack);  //original per-track source cache system
  
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    experiment.expname = experiment.name
    experiment.value = 0;
    experiment.sense_value = 0;
    experiment.antisense_value = 0;
    experiment.sig_error = 1.0;
    experiment.exptype = glyphTrack.datatype;
    glyphTrack.experiment_array.push(experiment);
  }
  
  if(glyphTrack.has_expression && (!glyphTrack.datatypes[glyphTrack.datatype])) { glyphTrack.datatype = dtype; }
}


function feature_score_sort_func(a,b) {
  if(b.score > a.score) { return 1; }
  if(b.score < a.score) { return -1; }
  return 0;
}
function feature_loc_sort_func(a,b) {
  if(a.start < b.start) { return -1; }
  if(a.start > b.start) { return 1; }
  if(a.end < b.end) { return -1; }
  if(a.end > b.end) { return 1; }
  return 0;
}

function gLyphsRenderFeatureTrack(glyphTrack) {
  //this function converts the feature_array into glyphs SVG objects
  // as part of this process it will determine the tracking levels
  if(glyphTrack.feature_array == null) { return; }  //not an feature track

  if(!glyphTrack.glyphs_array) { glyphTrack.glyphs_array = new Array(); }
  glyphTrack.glyphs_array = [];
  var glyphs_array = glyphTrack.glyphs_array;
  
  if(glyphTrack.colorMode == "signal") {
    //sort the feature_array based on inverted score prior to determining levels
    glyphTrack.feature_array.sort(feature_score_sort_func);
    for(var i=0; i<glyphTrack.feature_array.length; i++) {
      glyphTrack.feature_array[i].fidx = i;
    }
  } else {
    glyphTrack.feature_array.sort(feature_loc_sort_func);
    for(var i=0; i<glyphTrack.feature_array.length; i++) {
      glyphTrack.feature_array[i].fidx = i;
    }
  }
  var features = glyphTrack.feature_array;

  glyphTrack.strandless = false;
  if(glyphTrack.glyphStyle == "experiment-heatmap") {
    glyphTrack.strandless = true;
    processFeatureRegionExperiments(glyphTrack);

    glyphTrack.maxlevels=1;
    if(glyphTrack.experiment_array) {
      for(var i=0; i<glyphTrack.experiment_array.length; i++) {
        var experiment = glyphTrack.experiment_array[i];
        if(!experiment || experiment.hide) { continue; }
        //if(glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
        glyphTrack.maxlevels++;
      }
    }
  }
  
  // get the top features from the XML
  //TODO look into alternate method here. this will grab all features
  //and then I need to figure out if it is top or not. maybe can use children()
  for(var i=0; i<features.length; i++) {
    var feature = features[i];
    if(glyphTrack.has_expression && (feature.exp_total==0)) { continue; }
    var glyph = gLyphsDrawFeature(glyphTrack, feature, glyphTrack.glyphStyle);
    if(glyph) { glyphs_array.push(glyph); }
  }

  // then determine the levels
  var level_span = new Array();
  for(var i=0; i<glyphs_array.length; i++) {
    var glyph = glyphs_array[i];
    if(!glyph) { continue; }

    if(glyphTrack.glyphStyle == "cytoband") { 
      glyph.glyph_level = 0;
      continue;
    }
    if((glyphTrack.glyphStyle == "1D-heatmap") || (glyphTrack.glyphStyle == "experiment-heatmap")) { 
      glyph.glyph_level = 0;
      continue;
    }

    var fs = glyph.xfs;
    var fe = glyph.xfe;

    var level = -1;
    for(var j=0; j<level_span.length; j++) {
      var lend = level_span[j];
      if(fs > lend ) {
        level = j;
        break;
      }
    }
    if(level == -1) { level = level_span.length; }
    glyph.glyph_level = level;
    level_span[level] = fe+5;
  }
  if(glyphTrack.glyphStyle != "experiment-heatmap") {
    glyphTrack.maxlevels = level_span.length;
  }
}



function convertFeatureXML(featureXML) {
  var feature         = new Object;
  feature.classname   = "Feature";
  feature.name        = "";
  feature.description = "";

  if(featureXML.getAttribute('name')) { feature.name = featureXML.getAttribute('name'); }
  feature.id          = featureXML.getAttribute('id');
  feature.fsrc_id     = featureXML.getAttribute('fsrc_id');
  feature.source_name = featureXML.getAttribute('fsrc');
  feature.category    = featureXML.getAttribute('ctg');
  feature.start       = Math.floor(featureXML.getAttribute('start'));
  feature.end         = Math.floor(featureXML.getAttribute('end'));
  feature.strand      = featureXML.getAttribute('strand');
  //feature.score       = Math.abs(featureXML.getAttribute('sig'));
  feature.score       = parseFloat(featureXML.getAttribute('sig'));

  if(featureXML.getElementsByTagName("chrom")) {
    var xmlChrom = featureXML.getElementsByTagName("chrom")[0];
    if(xmlChrom) {
      feature.taxon_id     = xmlChrom.getAttribute("taxon_id");
      feature.asm          = xmlChrom.getAttribute("asm").toLowerCase();
      feature.chrom        = xmlChrom.getAttribute("chr");
    }
  }
  if(feature.chrom) {
    feature.chromloc = feature.asm.toLowerCase() +"::"+
                       feature.chrom+":"+ feature.start +".."+ feature.end+
                       feature.strand;
  } else {
    feature.chromloc = current_region.asm.toLowerCase() +"::"+ current_region.chrom+":"+
                       feature.start +".."+ feature.end + feature.strand;
  }

  if(featureXML.getAttribute('peer')) {
    feature.peer = featureXML.getAttribute('peer');
    feature.id   = peer + "::" + feature.id;
  }

  // feature_source
  var fsrc = featureXML.getElementsByTagName("featuresource");
  if(fsrc.length>0) {
    feature.fsrc_id   = fsrc[0].getAttribute('id');
    feature.source_name = fsrc[0].getAttribute('name');
    feature.category  = fsrc[0].getAttribute('category');
  }
  if(!feature.category) { feature.category = ""; }
  if(!feature.source_name) { feature.source_name = ""; }

  return feature;
}

function convertFullFeatureXML(featureXML) {
  var feature = convertFeatureXML(featureXML);

  //now the metadata, consolidate on same mdata[key] = array of values system
  eedbParseSimpleMetadata(featureXML, feature);

  if(feature.mdata["bed:itemRgb"]) {
    //maybe need to parse value to make sure it is valid
    var value1 = feature.mdata["bed:itemRgb"][0]
    var rgb_regex = /^(\d+)\,(\d+)\,(\d+)$/;
    if(rgb_regex.exec(value1)) {
      feature.color = "rgb("+value1+")";
    }
  }
  if(feature.mdata["cytostain"]) { feature.cytostain = feature.mdata["cytostain"][0]; }
  
  // now for loop on the sub features
  var subfeats = featureXML.getElementsByTagName("feature");
  if(subfeats && subfeats.length>0) {
    //document.getElementById("message").innerHTML += fname + " has " + (subfeats.length) +" subfs; ";
    var subfeatures_array = new Array();
    feature.subfeatures = subfeatures_array;
    for(var j=0; j<subfeats.length; j++) {
      var subfeatureXML = subfeats[j];
      var subf = convertFeatureXML(subfeatureXML);
      subfeatures_array.push(subf);
    }
  }
  
  // now the expression  
  var express = featureXML.getElementsByTagName("expression");
  for(var j=0; j<express.length; j++) {
    if(!feature.expression) { feature.expression = new Array(); }
    var expressXML = express[j];
    var expID = expressXML.getAttribute("experiment_id");
    
    expression = new Object();
    expression.expID      = expID;
    expression.datatype   = expressXML.getAttribute("datatype");
    expression.count      = 1;
    expression.dup        = 1;
    expression.sense      = 0;
    expression.antisense  = 0;
    expression.total      = 0;
    feature.expression.push(expression);

    if(expressXML.getAttribute("dup")) {
      expression.dup = parseFloat(expressXML.getAttribute("dup"));
    }
    
    var expressValue = parseFloat(expressXML.getAttribute("value"));

    if(express[j].getAttribute("count")) { expression.count = parseInt(express[j].getAttribute("count")); }
    if(feature.strand == "+") {
      expression.sense      = expressValue
      expression.total      = expressValue;
    }
    if(feature.strand == "-") {
      expression.antisense  = expressValue;
      expression.total      = expression.antisense;
    }
    if(feature.strand == " ") {
      expression.total      = expressValue;
      expression.sense      = expression.total;
    }
    /*
    if(glyphTrack.binning == "mean") {
      expression.sense     = expression.sense / expression.count;
      expression.antisense = expression.antisense / expression.count;
      expression.total     = expression.total / expression.count;
    }
     */
  }
  
  return feature;
}


function gLyphsDrawFeatureTrack(glyphTrack) {
  var trackDiv      = glyphTrack.trackDiv;
  var glyphStyle    = glyphTrack.glyphStyle;
  var glyphs_array  = glyphTrack.glyphs_array;
  //document.getElementById("message").innerHTML = 'gLyphsDrawFeatureTrack ' + glyphTrack.trackID + " "+glyphStyle;

  var maxlevels = glyphTrack.maxlevels;
  var levelHeight = 10;
  if(glyphStyle == "transcript") { levelHeight=8; }
  if(glyphStyle == "transcript2") { levelHeight=8; }
  if(glyphStyle == "box-scorethick") { levelHeight=11; }
  if(glyphStyle == "transcript-scorethick") { levelHeight=15; }
  if(glyphStyle == "thick-transcript") { levelHeight=6; }
  if(glyphStyle == "thin-transcript") { levelHeight=3; }
  if(glyphStyle == "thin-exon") { levelHeight=3; }
  if(glyphStyle == "medium-exon") { levelHeight=4; }
  if(glyphStyle == "1D-heatmap") { levelHeight=glyphTrack.track_height; maxlevels=2; }
  if(glyphStyle == "medium-arrow") { levelHeight=6; }
  if(glyphStyle == "exon") { levelHeight=6; }
  if(glyphStyle == "thick-box") { levelHeight=6; }
  if(glyphStyle == "probesetloc") { levelHeight=7; }
  if(glyphStyle == "thin") { levelHeight=3; }
  if(glyphStyle == "thin-box") { levelHeight=3; }
  if(glyphStyle == "seqalign") { levelHeight=8; }

  if(glyphStyle == "cytoband") { 
    levelHeight=34;
    glyphTrack.title = current_region.asm + " " + current_region.chrom +"  "+ 
                       current_region.start +".."+ current_region.end;
    if(current_region.flip_orientation) { glyphTrack.title += "-"; } else { glyphTrack.title += "+"; }
    glyphTrack.title += " " + current_region.length_desc;
    if((current_region.display_width / (current_region.end  - current_region.start)) > 5) {
      levelHeight = 45;
    }
  }
  if(glyphStyle == "experiment-heatmap") { 
    levelHeight=glyphTrack.track_height; 
    /*
    maxlevels=1;
    if(glyphTrack.experiment_array) { 
      for(var i=0; i<glyphTrack.experiment_array.length; i++) {
        var experiment = glyphTrack.experiment_array[i];
        if(!experiment || experiment.hide) { continue; }
        if(glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        maxlevels++;
      }
      maxlevels = glyphTrack.experiment_array.length +1; 
    }
    */
  }

  //if(glyphs_array.length > 100) { return; }

  //
  // clear and prep the SVG
  // to use bbox I need to attach to an SVG DOM tree
  // so a create e tmp svg of height 1
  // then I can move the tree over to the main view
  //
  var dwidth = current_region.display_width;
  var tmp_svg = createSVG(dwidth+10, 1); //offscreen basically, height does not matter
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  var g1 = document.createElementNS(svgNS,'g');
  var g_select = document.createElementNS(svgNS,'g');
  g1.appendChild(g_select);

  //
  // then generate the glyphs (without tracking)
  // to use bbox I need to attach to an SVG DOM tree
  // then I can move the tree over to the main view
  //
  //document.getElementById("message").innerHTML= 'track:' + sourceName + " fcnt: " + glyphs_array.length + " style:"+glyphStyle;
  for(var i=0; i<glyphs_array.length; i++) {
    var glyph = glyphs_array[i];
    if(glyph) { g1.appendChild(glyph); }
  }
  //SVG does live update with each element added so add the block at the end
  clearKids(trackDiv)
  trackDiv.appendChild(tmp_svg);
  tmp_svg.appendChild(g1);
  
  //
  // then determine the levels
  //
  /*
  var level_span = new Array();
  for(var i=0; i<glyphs_array.length; i++) {
    var glyph = glyphs_array[i];
    if(!glyph) { continue; }
    var bbox = glyph.getBBox();

    var fs = bbox.x;
    var fe = bbox.x + bbox.width;
    if(glyph.xfe > fe) { fe = glyph.xfe; }
    if(glyph.xfs < fs) { fs = glyph.xfs; }

    var level = -1;
    for(var j=0; j<level_span.length; j++) {
      var lend = level_span[j];
      if(fs > lend ) {
        level = j;
        break;
      }
    }
    if(level == -1) { level = level_span.length; }
    if(glyphStyle == "cytoband") { level = 0; } 
    glyph.glyph_level = level;
    level_span[level] = fe+5;
  }
  maxlevels = level_span.length;
  */
  if((glyphStyle == "cytoband") && maxlevels==0) { maxlevels=1; }

  //
  // then build the actual properly tracked view block
  //
  var svg = createSVG(dwidth+10, 14+(maxlevels*levelHeight));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 14+(maxlevels*levelHeight);
  trackDiv.removeChild(tmp_svg);
  trackDiv.appendChild(svg);

  // make a backing rectangle to capture the selection events
  if(!current_region.exportSVGconfig || glyphTrack.backColor) { 
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.id = "backRect_" + glyphTrack.trackID;
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '13px');
    backRect.setAttributeNS(null, 'width',  current_region.display_width+'px');
    backRect.setAttributeNS(null, 'height', (maxlevels*levelHeight)+'px');
    if(glyphTrack.backColor) { backRect.setAttributeNS(null, 'style', 'fill: '+glyphTrack.backColor+';'); }
    else { backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); }
    if(!current_region.exportSVGconfig) { 
      backRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmousemove", "eedbClearSearchTooltip();selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
    g_select.appendChild(backRect); 
  }

  var selectRect = document.createElementNS(svgNS,'rect');
  selectRect.setAttributeNS(null, 'x', '0px');
  selectRect.setAttributeNS(null, 'y', '13px');
  selectRect.setAttributeNS(null, 'width',  '0px');
  selectRect.setAttributeNS(null, 'height', (maxlevels*levelHeight)+'px');
  selectRect.setAttributeNS(null, 'style', 'fill: lightgray;');
  if(!current_region.exportSVGconfig) { 
    selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  g_select.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;

  // now the features
  for(var i=0; i<glyphs_array.length; i++) {
    var glyph = glyphs_array[i];
    if(!glyph) { continue; }
    var level   = glyph.glyph_level; 

    glyph.setAttributeNS(null, 'transform', "translate(0,"+ (2+level*levelHeight)+ ")");

    if(!current_region.exportSVGconfig) { 
      glyph.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
      glyph.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      //glyph.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+glyph.fid+"\");");
      glyph.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      if(glyph.fidx !== undefined) {
        glyph.setAttributeNS(null, "onmouseover", "gLyphsTrackFeatureInfo(\""+glyphTrack.trackID+"\", \""+(glyph.fidx)+"\");");
        glyph.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+glyph.fidx+"\");");
      } else if(glyph.fid) {
        glyph.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +(glyph.fid)+ "\");");
        glyph.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+glyph.fid+"\");"); 
      }
    }
  }

  var orig_title = glyphTrack.title;
  //if(glyphTrack.has_expression) { glyphTrack.title += " :: "+glyphTrack.datatype; }
  if(glyphTrack.has_expression) {
    var revVal = glyphTrack.anti_max_express.toFixed(2);
    if(revVal>1) { revVal = glyphTrack.anti_max_express.toFixed(1); }
    var fwdVal = glyphTrack.sense_max_express.toFixed(2);
    if(fwdVal>1) { fwdVal = glyphTrack.sense_max_express.toFixed(1); }

    if(Math.floor(glyphTrack.anti_max_express) == glyphTrack.anti_max_express) { revVal = glyphTrack.anti_max_express.toFixed(0); }
    if(Math.floor(glyphTrack.sense_max_express) == glyphTrack.sense_max_express) { fwdVal = glyphTrack.sense_max_express.toFixed(0); }

    var new_title = glyphTrack.title + " [rev:"+revVal+" fwd:"+fwdVal;
    if((glyphTrack.expscaling != "auto" || (glyphTrack.scale_min_signal!=0))) { 
      new_title += " scale:" + glyphTrack.scale_min_signal;; 
      new_title += " to " + glyphTrack.expscaling; 
    }
    if(glyphTrack.logscale==1) { new_title += " log"; }
    new_title += "]";
    new_title += " (" + glyphTrack.experiment_merge + ")";
    new_title += " " + glyphTrack.datatype;
    glyphTrack.title = new_title;
  }
  gLyphsDrawHeading(glyphTrack);
  glyphTrack.title = orig_title;

  if(glyphStyle == "cytoband") { 
    var glyph1 = gLyphsDrawCytoSpan();
    g1.appendChild(glyph1);
    var glyph2 = gLyphsDrawChromScale();
    g1.appendChild(glyph2);
    if(!current_region.exportSVGconfig) {
      glyph1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
      glyph1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      glyph1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      glyph2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
      glyph2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      glyph2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    }
    if(current_region.genome_sequence) {
      var glyph3 = gLyphsDrawChromSequence(glyphTrack);
      if(glyph3) { g1.appendChild(glyph3); }
    }
  }

  if(!current_region.exportSVGconfig) {
    var trackLine = document.createElementNS(svgNS,'rect');
    if(current_region.trackline_xpos) { trackLine.setAttributeNS(null, 'x', (current_region.trackline_xpos-2)+'px'); } 
    else { trackLine.setAttributeNS(null, 'x', '0px'); }
    trackLine.setAttributeNS(null, 'y', '11px');
    trackLine.setAttributeNS(null, 'width',  '1px');
    trackLine.setAttributeNS(null, 'height', (maxlevels*levelHeight + 2)+'px');
    trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
    trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    //trackLine.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    trackLine.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    g1.appendChild(trackLine);
    glyphTrack.trackLine = trackLine;
  }

  gLyphsDrawSelection(glyphTrack);

  tmp_svg.removeChild(g1);
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
  
  gLyphsDrawExpressionPanel();
}


function gLyphsDrawFeature(glyphTrack, feature, glyphStyle) {
  var dwidth     = current_region.display_width;
  var chrom      = current_region.chrom;
  var start      = current_region.start;
  var end        = current_region.end;
  var chromloc   = chrom +":" + start + ".." + end;

  if(!feature) { return null; }
  if(glyphStyle == "cytoband") { 
    //drawing whole chromosome
    start = 0;
    if(current_region.chrom_length>0) { end = current_region.chrom_length; }
  }

  var fname    = feature.name
  var fsrc_id  = feature.fsrc_id; 
  var category = feature.category; 
  var strand   = feature.strand; 
  var fs       = feature.start; 
  var fe       = feature.end; 
  var fid      = feature.id; 

  var xfs = dwidth*(fs-start-0.5)/(end-start); 
  var xfe = dwidth*(fe-start+0.5)/(end-start); 
  if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
  var len = xfe-xfs;
  var xc  = (xfe+xfs)/2;
  if(!strand) { strand = ""; }
  if((strand != "+") && (strand != "-")) { strand = ""; }
  if(strand =="-") {xpos = xfs;} else {xpos = xfe;}

  if(xfe < 0) { return undefined; }
  if(xfs > dwidth) { return undefined; }

  if(xfs<0) { xfs = 0; }
  if(xfe > current_region.display_width) { xfe = current_region.display_width; }

  feature.xfs = xfs;
  feature.xfe = xfe;
  feature.xc  = xc;

  var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
  if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
  //var color = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
  var color = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);

  var glyph = null;
  if(glyphStyle == "centroid") { glyph = gLyphsDrawCentroid(glyphTrack, feature); } 
  if(glyphStyle == "thick-arrow") { glyph = gLyphsDrawThickFlatArrow(xfs, xfe, strand); } 
  if(glyphStyle == "medium-arrow") { glyph = gLyphsDrawMediumArrow(xfs, xfe, strand); xfs -= 6; xfe += 6; } 
  if(glyphStyle == "arrow") { glyph = gLyphsDrawThickFlatArrow(xfs, xfe, strand); }
  //if(glyphStyle == "arrow") { glyph = gLyphsDrawArrow(xpos, strand); }
  if(glyphStyle == "cytoband") { glyph = gLyphsDrawCytoBand(xfs, xfe, feature); } 
  if(glyphStyle == "box") { glyph = gLyphsDrawBox(xfs, xfe, strand); } 
  if(glyphStyle == "subfeature") { glyph = gLyphsDrawBox(xfs, xfe, strand); } 
  if(glyphStyle == "intron") { glyph = gLyphsDrawIntron(xfs, xfe, strand); } 
  if(glyphStyle == "exon") { glyph = gLyphsDrawExon(xfs, xfe, strand); } 
  if(glyphStyle == "thick-box") { glyph = gLyphsDrawExon(xfs, xfe, strand); } 
  if(glyphStyle == "1D-heatmap") { glyph = gLyphsDrawExon(xfs, xfe, strand); } 
  if(glyphStyle == "thin-intron") { glyph = gLyphsDrawThinIntron(xfs, xfe, strand); } 
  if(glyphStyle == "thin-exon") { glyph = gLyphsDrawThinExon(xfs, xfe, strand); } 
  if(glyphStyle == "medium-exon") { glyph = gLyphsDrawMediumExon(xfs, xfe, strand); } 
  if(glyphStyle == "utr") { glyph = gLyphsDrawUTR(xfs, xfe, strand); } 
  if(glyphStyle == "medium-utr") { glyph = gLyphsDrawMediumUTR(xfs, xfe, strand); } 
  if(glyphStyle == "thin") { glyph = gLyphsDrawThin(xfs, xfe, strand); } 
  if(glyphStyle == "thin-box") { glyph = gLyphsDrawThin(xfs, xfe, strand); } 
  if(glyphStyle == "line") { glyph = gLyphsDrawLine(xfs, xfe, strand); } 
  if(glyphStyle == "seqtag") { glyph = gLyphsDrawSeqTag(xpos, strand, feature, glyphTrack); }
  if(glyphStyle == "seqalign") { glyph = gLyphsDrawSeqAlignment(glyphTrack, feature); }
  if(glyphStyle == "box-scorethick") { glyph = gLyphsDrawScoreThickBox(feature, glyphTrack); }
  if(glyphStyle == "experiment-heatmap") { glyph = gLyphsDrawExperimentHeatmap(feature, glyphTrack); }
  
  if(glyphStyle == "thin-transcript") { glyph = gLyphsDrawThinTranscript(glyphTrack, feature); }
  if(glyphStyle == "thick-transcript") { glyph = gLyphsDrawTranscript(glyphTrack, feature); }
  if(glyphStyle == "transcript") { glyph = gLyphsDrawTranscript(glyphTrack, feature); }
  if(glyphStyle == "transcript2") { glyph = gLyphsDrawTranscript2(glyphTrack, feature); }
  if(glyphStyle == "transcript-scorethick") { glyph = gLyphsDrawTranscriptScoreThick(glyphTrack, feature); }
  
  if(!glyph) { return glyph; }

  if(glyphStyle!="utr" && glyphStyle!="medium-utr" && glyphStyle!="experiment-heatmap" ) {
    if(glyphTrack.colorMode=="strand") {
      if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
        if(glyph.style.stroke) { glyph.style.stroke = glyphTrack.revStrandColor; }
        if(glyph.style.fill)   { glyph.style.fill   = glyphTrack.revStrandColor; }
      } else {
        if(glyph.style.stroke) { glyph.style.stroke = glyphTrack.posStrandColor; }
        if(glyph.style.fill)   { glyph.style.fill   = glyphTrack.posStrandColor; }
      }
    }
    if(glyphTrack.colorMode=="mdata") {
      if(feature.color) {
        if(glyph.style.stroke) { glyph.style.stroke = feature.color; }
        if(glyph.style.fill)   { glyph.style.fill   = feature.color; }
      }
    }
    if(glyphTrack.colorMode=="signal") {
      if(glyph.style.stroke) { glyph.style.stroke = color.getCSSHexadecimalRGB(); }
      if(glyph.style.fill) { glyph.style.fill = color.getCSSHexadecimalRGB(); }
    }

    if(current_region.highlight_search && feature) {
      if(feature.name.indexOf(current_region.highlight_search) == -1) {
      //if((feature.name.indexOf(current_region.highlight_search) == -1) && (feature.description.indexOf(current_region.highlight_search) == -1)) {
        if(glyph.style.stroke) { glyph.style.stroke = "lightgray"; }
        if(glyph.style.fill) { glyph.style.fill = "lightgray"; }
      } else {
        if(glyph.style.stroke) { glyph.style.stroke = "red"; }
        if(glyph.style.fill) { glyph.style.fill = "red"; }
      }
    }
  }

  if(glyph && fname &&
           ((glyphStyle == 'centroid') ||
            (glyphStyle == 'thick-arrow') || 
            (glyphStyle == 'box')  ||
            (glyphStyle == 'line')  ||
            (glyphStyle == 'transcript')  ||
            (glyphStyle == 'transcript2')  ||
	    (glyphStyle == "probesetloc"))) { 
    var text_pos = 0;
    var tobj = document.createElementNS(svgNS,'text');
    tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    var textWidth = 0;
    if(glyphStyle == "transcript" || glyphStyle=='probesetloc' || glyphStyle=='box' || glyphStyle == "transcript2") { 
      tobj.setAttributeNS(null, 'y', '16px');
      tobj.setAttributeNS(null, "font-size","9px"); 
      textWidth = 6 * fname.length;
    } else { 
      tobj.setAttributeNS(null, 'y', '18px');
      tobj.setAttributeNS(null, "font-size","10px"); 
      textWidth = 7 * fname.length;
    }

    if(current_region.flip_orientation) { 
      if(xfs>0) { 
        tobj.setAttributeNS(null, 'text-anchor', 'start' );
        text_pos = xfs-1;
        xfs = xfs -1 - textWidth;
      } else { 
        tobj.setAttributeNS(null, 'text-anchor', 'end' );
        text_pos = xfe+2
        xfe = xfe +2 + textWidth;
      }
    } else {
      if(xfs>0) { 
        tobj.setAttributeNS(null, 'text-anchor', 'end' );
        text_pos = xfs-1;
        xfs = xfs -1 - textWidth;
      } else { 
        tobj.setAttributeNS(null, 'text-anchor', 'start' );
        text_pos = xfe+2
        xfe = xfe +2 + textWidth;
      }
    }
    tobj.setAttributeNS(null, 'style', 'fill: black;');

    tobj.appendChild(document.createTextNode(fname));

    var gt1 = document.createElementNS(svgNS,'g');
    gt1.appendChild(tobj);
    if(current_region.flip_orientation) { //need to flip the text back  so it does not look like a mirror image
      //gt1.setAttributeNS(null, 'transform', "translate("+textWidth+", 0) scale(-1,1) translate(-"+text_pos+",0)");
      gt1.setAttributeNS(null, 'transform', "scale(-1,1) translate(-"+text_pos+",0)");
    } else {
      gt1.setAttributeNS(null, 'transform', "translate("+text_pos+",0)");
    }

    glyph.appendChild(gt1);
  }

  //simple hack to do the left-right flip_orientation to change whether pos strand is left-to-right or right-to-left
  if(current_region.flip_orientation) { 
    var g2 = document.createElementNS(svgNS,'g');
    g2.setAttributeNS(null, 'transform', "translate("+dwidth+", 0) scale(-1,1)");
    g2.appendChild(glyph);
    var g3 = document.createElementNS(svgNS,'g');
    g3.appendChild(g2);
    glyph = g3;
  }

  if(glyphStyle != 'seqtag') {
    glyph.xfs = xfs;
    glyph.xfe = xfe;
  }
  if(glyphStyle != "experiment-heatmap") {
    glyph.fid = fid;
    glyph.fidx = feature.fidx;
  }

  return glyph;
}


function getTrackFsrcColor(glyphTrack, srcID) {
  if(glyphTrack.sourceColorHash === undefined) {
    glyphTrack.sourceColorHash = new Object();
    glyphTrack.sourceColorCount = 0;
  }
  var srcColor = glyphTrack.sourceColorHash[srcID];
  if(srcColor === undefined) {
    var cnt = glyphTrack.sourceColorCount % 10;
    var colorArray = [ "Goldenrod", "Chocolate", "DeepSkyBlue", "DarkGreen", "SaddleBrown", "SteelBlue", "Brown", "blue", "DimGray", "SlateGray"];
    srcColor= colorArray[cnt];
    glyphTrack.sourceColorHash[srcID] = srcColor;
    glyphTrack.sourceColorCount += 1;
  }
  return srcColor;
}


function processFeatureExpressExperiments(glyphTrack, feature) {
  if(!feature.expression) { return null; }

  //reset experiments
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID]; 
    experiment.expname = experiment.name
    experiment.value = 0;  //reset
    experiment.sense_value = 0;  //reset
    experiment.antisense_value = 0;  //reset
    experiment.sig_error = 1.0;
    experiment.exptype = glyphTrack.datatype;
  }
    
  for(var j=0; j<feature.expression.length; j++) {
    var expression = feature.expression[j];
    var experiment = glyphTrack.experiments[expression.expID];
    if(!experiment) { continue; }
    if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }

    experiment.value           += expression.total;
    if(current_region.flip_orientation) {
      experiment.sense_value     += expression.antisense;
      experiment.antisense_value += expression.sense;
    } else {
      experiment.sense_value     += expression.sense;
      experiment.antisense_value += expression.antisense;
    }
  }
  glyphTrack.experiment_array.sort(gLyphs_express_sort_func);
} 


function processFeatureRegionExperiments(glyphTrack) {
  if(!glyphTrack) { return undefined; }
  if(!glyphTrack.has_expression) { return undefined; }
  
  var trackID      = glyphTrack.trackID;
  var selection    = glyphTrack.selection;
  
  //reset experiments
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID]; 
    experiment.expname = experiment.name
    experiment.value = 0;  //reset
    experiment.sense_value = 0;  //reset
    experiment.antisense_value = 0;  //reset
    experiment.sig_error = 1.0;
    experiment.exptype = glyphTrack.datatype;  //reset
  }

  if(!glyphTrack.feature_array) { return  undefined; }

  //now process the feature/expression values in selection   
  for(var i=0; i<glyphTrack.feature_array.length; i++) {
    var feature = glyphTrack.feature_array[i];
    if(selection) {
      var ss = selection.chrom_start;
      var se = selection.chrom_end;
      if(ss>se) { var t=ss; ss=se; se=t; }
      if(((feature.end < ss) || (feature.start > se))) { continue; }
    }
    if(!feature.expression) { continue; }
    for(var j=0; j<feature.expression.length; j++) {
      var expression = feature.expression[j];
      var experiment = glyphTrack.experiments[expression.expID];
      if(!experiment) { continue; }
      if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }

      var exp_sense = expression.sense;
      var exp_anti  = expression.antisense;
      if(current_region.flip_orientation) {
        exp_sense = expression.antisense;
        exp_anti  = expression.sense;
      }

      if(glyphTrack.binning == "min") {
        if(expression.total / expression.dup < experiment.value) { experiment.value = expression.total / expression.dup; }
        if(exp_sense / expression.dup < experiment.sense_value) { experiment.sense_value = exp_sense / expression.dup; }
        if(exp_anti / expression.dup < experiment.antisense_value) { experiment.antisense_value = exp_anti / expression.dup; }
      } else if(glyphTrack.binning == "max") {
        if(expression.total / expression.dup > experiment.value) { experiment.value = expression.total / expression.dup; }
        if(exp_sense / expression.dup > experiment.sense_value) { experiment.sense_value = exp_sense / expression.dup; }
        if(exp_anti / expression.dup > experiment.antisense_value) { experiment.antisense_value = exp_anti / expression.dup; }
      } else {
        experiment.value           += expression.total / expression.dup;
        experiment.sense_value     += exp_sense  / expression.dup;
        experiment.antisense_value += exp_anti  / expression.dup;
      }
    }
  }
  glyphTrack.experiment_array.sort(gLyphs_express_sort_func);
} 


//--------------------------------------
//
// expression tracks
//
//--------------------------------------


function gLyphsRenderExpressionTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = current_region.display_width;
    
  glyphTrack.expressLine1 = null;
  glyphTrack.expressLine2 = null;

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;
  
  //
  // then generate the expression glyphs
  //
  var height = (glyphTrack.track_height) / 2.0;
  var middle = 12+ Math.floor(height);
  if(glyphTrack.strandless) { middle = 12+glyphTrack.track_height; }
  
  var strkw = "1px";
  if(glyphTrack.glyphStyle == "xyplot") { strkw="3px"; }
  
  var expressLine1 = document.createElementNS(svgNS,'path');
  if(glyphTrack.strandless) {
    expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
  } else {
    expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
  }
  if(!current_region.exportSVGconfig) {
    expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  var expressLine2 = null;
  if(!glyphTrack.strandless) {
    expressLine2 = document.createElementNS(svgNS,'path');
    expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.revStrandColor+'; fill:'+glyphTrack.revStrandColor+";");
    if(!current_region.exportSVGconfig) {
      expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
  }

  glyphTrack.expressLine1 = expressLine1;
  glyphTrack.expressLine2 = expressLine2;
  
  var features = glyphTrack.feature_array;
  if(!features) { return; }
  //if(features.length == 0) { return; }

  var points1 = "";
  var points2 = "";
  for(var i=0; i<features.length; i++) {
    var feature = features[i];
    if(!feature) { continue; }
    
    //determine positioning
    var xfs = dwidth*(feature.start-current_region.start-0.5)/(current_region.end-current_region.start); 
    var xfe = dwidth*(feature.end-current_region.start+0.5)/(current_region.end-current_region.start); 

    if(xfe < 0) { continue; }
    if(xfs > dwidth) { continue; }
    if(xfs<0) { xfs = 0; }
    if(xfe > current_region.display_width) { xfe = current_region.display_width; }

    if(current_region.flip_orientation) {
      t_xfs = dwidth - xfe;
      t_xfe = dwidth - xfs;
      xfs = t_xfs;
      xfe = t_xfe;
    }
    
    var xpos;
    if(feature.strand == "+") {xpos = xfs;} else {xpos = xfe;}
    //xpos += 0.5; //a bit off pixel wise since I use a 1.5px width stroke
        
    var y_total = (height*2* feature.exp_total) / glyphTrack.total_max_express;
    if(y_total > height*2) { y_total = height*2; }
    
    var y_sense = (height * feature.exp_sense) / glyphTrack.max_express;
    if(y_sense > height)  { y_sense = height; }
    if(y_sense < -height) { y_sense = -height; }
    
    var y_anti = (height * feature.exp_antisense) / glyphTrack.max_express;
    if(y_anti > height)  { y_anti = height; }
    if(y_anti < -height) { y_anti = -height; }
    
    // 
    // render into expression line
    //
    if(glyphTrack.glyphStyle == "xyplot") {
      if(xfe-xfs<5) { xfe = xfs+5; }
      if(feature.exp_sense!=0) {
        points1 += " M"+(xfs.toFixed(1))+" "+ ((middle-y_sense).toFixed(1));
        points1 += " L"+(xfe+0.5)+" "+ ((middle-y_sense).toFixed(1));
      }
      if(feature.exp_antisense!=0) {
        points2 += " M"+(xfs.toFixed(1))+" "+ ((middle-y_anti).toFixed(1));
        points2 += " L"+(xfe+0.5)+" "+ ((middle-y_anti).toFixed(1));
      }      
    } else {
      if(glyphTrack.strandless) {
        if(y_total>0) {
          //points1 += " M"+xpos+" "+(middle)+" L"+xpos+" "+(middle-1-y_total);
          points1 += " M"+xfs+" "+(middle)+" L"+xfs+" "+(middle-1-y_total);
          points1 += " L"+xfe+" "+(middle-1-y_total)+" L"+xfe+" "+middle;
        }
      } else {
        if(y_sense>0) {
          if(current_region.flip_orientation) {
            //points1 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle-1-y_sense);
            points2 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle+1+y_sense);
            points2 += " L"+xfe+" "+(middle+1+y_sense)+" L"+xfe+" "+middle;
          } else {
            //points1 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle-1-y_sense);
            points1 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle-1-y_sense);
            points1 += " L"+xfe+" "+(middle-1-y_sense)+" L"+xfe+" "+middle;
          }
        }
        if(y_anti>0) {
          if(current_region.flip_orientation) {
            //points2 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle+1+y_anti);
            points1 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle-1-y_anti);
            points1 += " L"+xfe+" "+(middle-1-y_anti)+" L"+xfe+" "+middle;
          } else {
            //points2 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle+1+y_anti);
            points2 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle+1+y_anti);
            points2 += " L"+xfe+" "+(middle+1+y_anti)+" L"+xfe+" "+middle;
          }
        }
      }
    }
  }
  //document.getElementById("message").innerHTML = points1;
  
  if(points1) { expressLine1.setAttributeNS(null, 'd', points1+" Z"); }
  if(points2 && !glyphTrack.strandless) { 
    expressLine2.setAttributeNS(null, 'd', points2+" Z");    
  }  
}


function gLyphsDrawExpressTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = current_region.display_width;
  
  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }
    
  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;
  
  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var svg = createSVG(current_region.display_width+10, 13+(glyphTrack.track_height));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 13+(glyphTrack.track_height);
  trackDiv.appendChild(svg);
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  var g1 = document.createElementNS(svgNS,'g');
  
  // make a backing rectangle to capture the selection events
  if(!current_region.exportSVGconfig || glyphTrack.backColor) {
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.id = "backRect_" + glyphTrack.trackID;
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '13px');
    backRect.setAttributeNS(null, 'width',  current_region.display_width+'px');
    backRect.setAttributeNS(null, 'height', glyphTrack.track_height+'px');
    if(glyphTrack.backColor) { backRect.setAttributeNS(null, 'style', 'fill: '+glyphTrack.backColor+';'); }
    else { backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); }
    if(!current_region.exportSVGconfig) {
      backRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    g1.appendChild(backRect);
  }

  var selectRect = document.createElementNS(svgNS,'rect');
  selectRect.setAttributeNS(null, 'x', '0px');
  selectRect.setAttributeNS(null, 'y', '13px');
  selectRect.setAttributeNS(null, 'width',  '0px');
  selectRect.setAttributeNS(null, 'height', glyphTrack.track_height+'px');
  selectRect.setAttributeNS(null, 'style', 'fill: lightgray;');
  if(!current_region.exportSVGconfig) {
    selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;
  
  
  //
  // then the expression lines
  //
  var height = (glyphTrack.track_height) / 2.0;
  var middle = 12+ Math.floor(height);
  if(glyphTrack.strandless) { middle = 12+glyphTrack.track_height; }

  var expressLine1 = glyphTrack.expressLine1;
  var expressLine2 = glyphTrack.expressLine2;
  
  if(expressLine1) {
    g1.appendChild(expressLine1);
    if(!current_region.exportSVGconfig) {
      expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
  }
  if(expressLine2) {
    g1.appendChild(expressLine2);
    if(!current_region.exportSVGconfig) {
      expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");      
    }    
    var middleLine = g1.appendChild(document.createElementNS(svgNS,'polyline'));
    middleLine.setAttributeNS(null, 'style', 'stroke: darkgray; stroke-width: 1px');
    middleLine.setAttributeNS(null, 'points', "0,"+middle+" "+current_region.display_width+","+middle);
  }
  
  var minVal = glyphTrack.anti_max_express.toFixed(2);
  if(minVal>1) { minVal = glyphTrack.anti_max_express.toFixed(1); }
  var maxVal = glyphTrack.sense_max_express.toFixed(2);
  if(maxVal>1) { maxVal = glyphTrack.sense_max_express.toFixed(1); }
  var scaleVal = glyphTrack.max_express.toFixed(2);

  if(Math.floor(glyphTrack.anti_max_express) == glyphTrack.anti_max_express) { minVal = glyphTrack.anti_max_express.toFixed(0); }
  if(Math.floor(glyphTrack.sense_max_express) == glyphTrack.sense_max_express) { maxVal = glyphTrack.sense_max_express.toFixed(0); }
  if(Math.floor(glyphTrack.max_express) == glyphTrack.max_express) { scaleVal = glyphTrack.max_express.toFixed(0); }

  //scaleVal = Math.round(scaleVal / glyphTrack.experiment_array.length);
  
  new_title = title + " [rev:"+minVal+" fwd:"+maxVal+" scale:"+scaleVal;
  if(glyphTrack.expscaling != "auto") { new_title += " fixscale:" + glyphTrack.expscaling; }
  if(glyphTrack.logscale==1) { new_title += " log"; }
  new_title += "]";
  if(glyphTrack.has_expression) {
    new_title += " (" + glyphTrack.experiment_merge + ")";
    //new_title += " " + glyphTrack.overlap_mode;
  }
  new_title += " " + glyphTrack.datatype;
  
  glyphTrack.title = new_title;
  gLyphsDrawHeading(glyphTrack);
  glyphTrack.title = title;
  
  if(!current_region.exportSVGconfig) {
    var trackLine = document.createElementNS(svgNS,'rect');
    trackLine.setAttributeNS(null, 'x', '0px');
    trackLine.setAttributeNS(null, 'y', '13px');
    trackLine.setAttributeNS(null, 'width',  '1px');
    trackLine.setAttributeNS(null, 'height', glyphTrack.track_height+'px');
    trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
    trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    g1.appendChild(trackLine);
    glyphTrack.trackLine = trackLine;
  }
  
  gLyphsDrawSelection(glyphTrack);
  
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
  
  if(!current_region.active_trackID) { current_region.active_trackID = trackID; }
  gLyphsDrawExpressionPanel();
}


//----------------------------------------------
//
// multi-split signal track
//
//----------------------------------------------

function gLyphsRenderSplitSignalTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = current_region.display_width;
    
  //document.getElementById("message").innerHTML += " gLyphsRenderSplitSignalTrack";

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;

  var group_array = new Array;    
  if(glyphTrack.exppanelmode == "mdgroup") {
    if(!glyphTrack.experiment_mdgrouping) { 
      //document.getElementById("message").innerHTML += " no experiment_mdgrouping";
      gLyphsTrackFetchMetadataGrouping(trackID);  //async
    }
    for(var k=0; k<glyphTrack.experiment_mdgrouping.length; k++) {
      var mdgroup = glyphTrack.experiment_mdgrouping[k];
      if(!mdgroup) { continue; }
      group_array.push(mdgroup);
    }
  } else if(glyphTrack.exppanelmode == "ranksum") { 
    if(!glyphTrack.experiment_ranksum_enrichment) { return; }
    for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
      var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
      if(current_region.exppanel_hide_deactive && mdgroup.hide) { continue; }      
      if(glyphTrack.strandless) {
        if(Math.abs(mdgroup.value) < glyphTrack.ranksum_min_zscore) { continue; }
      } else {
        if((Math.abs(mdgroup.sense_value) < glyphTrack.ranksum_min_zscore) &&
           (Math.abs(mdgroup.antisense_value) < glyphTrack.ranksum_min_zscore)) { continue; }
      }
      group_array.push(mdgroup);
    }
  } else {
    if(!glyphTrack.experiment_array) { return; }
    for(var k=0; k<glyphTrack.experiment_array.length; k++) {
      var experiment = glyphTrack.experiment_array[k];
      if(!experiment) { continue; }
      if(current_region.exppanel_hide_deactive && experiment.hide) { continue; }      
      if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
      group_array.push(experiment);
    }    
  }
  //document.getElementById("message").innerHTML += " " + group_array.length;  
  
  glyphTrack.max_express       = 0;
  glyphTrack.total_max_express = 0;
  glyphTrack.sense_max_express = 0;
  glyphTrack.anti_max_express  = 0;
  
  //TODO: need to loop on the groups twice in order to calculate the correct scaling factor
  //and precalc the experiment_hash in each group
  var max_express = 0.0;
  var total_max_express = 0.0;
  var sense_max_express = 0.0;
  var anti_max_express = 0.0;
  for(var k=0; k<group_array.length; k++) {
    var expr_group = group_array[k];
    if(!expr_group) { continue; }
    if(expr_group.hide) {continue; }
    
    // make an experiment_hash for use later
    expr_group.experiment_count=0;
    expr_group.expr_hash = new Object;
    if(expr_group.classname == "Experiment") {
      expr_group.expr_hash[expr_group.id] = true;
      expr_group.experiment_count = 1;
    } else if(expr_group.source_ids) {    
      for(var j=0; j<expr_group.source_ids.length; j++) {
        var srcid = expr_group.source_ids[j];
        var experiment = glyphTrack.experiments[srcid];
        if(!experiment) { continue; }
        if(experiment.hide && current_region.exppanel_hide_deactive) { continue; }
        //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        //if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }  //this might not work here
        expr_group.expr_hash[experiment.id] = true;
        expr_group.experiment_count++;
      }
    }
    
    var features = glyphTrack.feature_array;
    if(!features) { continue; }
    
    for(var i=0; i<features.length; i++) {
      var feature = features[i];
      if(!feature) { continue; }
      if(!feature.expression) { continue; }
      
      // recalculate the grouped combined experiment expression for this feature
      var total      = 0;
      var sense      = 0;
      var antisense  = 0;
      
      for(var j=0; j<feature.expression.length; j++) {
        var expression = feature.expression[j];
        //check against the expr_group experiments to determine if 
        var experiment = expr_group.expr_hash[expression.expID];
        if(!experiment) { continue; }
        if(experiment.hide) { continue; }
        if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }
        
        if(expression.total > glyphTrack.max_express_element) { glyphTrack.max_express_element = expression.total; }
        
        if(glyphTrack.experiment_merge == "sum") {
          sense      += expression.sense;
          antisense  += expression.antisense;
          total      += expression.total;
        }
        else if(glyphTrack.experiment_merge == "mean") {
          sense      += expression.sense;
          antisense  += expression.antisense;
          total      += expression.total;
        }
        else if(glyphTrack.experiment_merge == "count") {
          sense      += expression.sense;
          antisense  += expression.antisense;
          total      += expression.total;
        }
        else if(glyphTrack.experiment_merge == "max") {
          if(expression.sense > sense) { sense = expression.sense; }
          if(expression.antisense > antisense) { antisense = expression.antisense; }
          if(expression.total > total) { total = expression.total; }
        }
        else if(glyphTrack.experiment_merge == "min") {
          if(j==0) {
            sense      = expression.sense;
            antisense  = expression.antisense;
            total      = expression.total;
          } else {
            if(expression.sense < sense) { sense = expression.sense; }
            if(expression.antisense < antisense) { antisense = expression.antisense; }
            if(expression.total < total) { total = expression.total; }
          }
        }
      }
      if((glyphTrack.experiment_merge == "mean") && (feature.expression.length > 0)) {
        sense      /= expr_group.experiment_count;
        antisense  /= expr_group.experiment_count;
        total      /= expr_group.experiment_count; 
      }
      if(glyphTrack.logscale == 1) { 
        if(sense>0.0) { sense = Math.log(sense+1.0); }
        if(antisense>0.0) { antisense = Math.log(antisense+1.0); }
        if(total>0.0) { total = Math.log(total+1.0); }
      }
      if((sense==0.0) && (antisense==0.0) && (total>0.0)) {
        sense = total;
        antisense = total;
      }
    
      if(sense > sense_max_express) { sense_max_express = sense; }
      if(antisense > anti_max_express) { anti_max_express = antisense; }
      if(total > total_max_express) { total_max_express = total; }
      
    } //feature loop
    
    // final scaling corrections
    if((sense_max_express>0) || (anti_max_express>0)) {
      max_express = sense_max_express;
      if(anti_max_express > max_express) { max_express = anti_max_express; }
    } else {
      max_express       = total_max_express;
      sense_max_express = total_max_express;
      anti_max_express  = total_max_express;
    }
    if(glyphTrack.expscaling != "auto") {
      max_express = glyphTrack.expscaling;
      total_max_express = glyphTrack.expscaling;
    }    
  }  //group_array loop
  glyphTrack.max_express       = max_express;
  glyphTrack.total_max_express = total_max_express;
  glyphTrack.sense_max_express = sense_max_express;
  glyphTrack.anti_max_express  = anti_max_express;
  
  //
  // second loop on each group to create signal graphs
  //
  for(var k=0; k<group_array.length; k++) {
    var expr_group = group_array[k];
    if(!expr_group) { continue; }
    if(expr_group.hide) {continue; }
    
    expr_group.expressLine1 = null;
    expr_group.expressLine2 = null;

    //
    // then generate the expression glyphs
    //
    var height = (glyphTrack.track_height) / 2.0;
    var middle = 12+ Math.floor(height);
    if(glyphTrack.strandless) { middle = 12+glyphTrack.track_height; }
    
    var strkw = "1px";
    var expressLine1 = document.createElementNS(svgNS,'path');
    if(glyphTrack.strandless) {
      //expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
      if(glyphTrack.exppanel_use_rgbcolor) { expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+expr_group.rgbcolor+'; fill:'+expr_group.rgbcolor+";"); } 
      else { expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";"); }
    } else {
      //expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
      if(glyphTrack.exppanel_use_rgbcolor) { expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+expr_group.rgbcolor+'; fill:'+expr_group.rgbcolor+";"); } 
      else { expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";"); }
    }
    if(!current_region.exportSVGconfig) {
      expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
    var expressLine2 = null;
    if(!glyphTrack.strandless) {
      expressLine2 = document.createElementNS(svgNS,'path');
      //expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.revStrandColor+'; fill:'+glyphTrack.revStrandColor+";");
      if(glyphTrack.exppanel_use_rgbcolor) { expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+expr_group.rgbcolor+'; fill:'+expr_group.rgbcolor+";"); } 
      else { expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.revStrandColor+'; fill:'+glyphTrack.revStrandColor+";"); }
      if(!current_region.exportSVGconfig) {
        expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
        expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
        expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
      }
    }
    
    expr_group.expressLine1 = expressLine1;
    expr_group.expressLine2 = expressLine2;
    
    var features = glyphTrack.feature_array;
    if(!features) { continue; }
    
    var points1 = "";
    var points2 = "";
    
    for(var i=0; i<features.length; i++) {
      var feature = features[i];
      if(!feature) { continue; }

      // recalculate the grouped combined experiment expression for this feature
      feature.exp_total = 0;
      feature.exp_sense = 0;
      feature.exp_antisense = 0;    
            
      if(feature.expression) {
        var total      = 0;
        var sense      = 0;
        var antisense  = 0;
        
        for(var j=0; j<feature.expression.length; j++) {
          var expression = feature.expression[j];
          //check against the expr_group experiments to determine if 
          var experiment = expr_group.expr_hash[expression.expID];
          if(!experiment) { continue; }
          if(experiment.hide) { continue; }
          if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }
          
          if(expression.total > glyphTrack.max_express_element) { glyphTrack.max_express_element = expression.total; }
          
          if(glyphTrack.experiment_merge == "sum") {
            sense      += expression.sense;
            antisense  += expression.antisense;
            total      += expression.total;
          }
          else if(glyphTrack.experiment_merge == "mean") {
            sense      += expression.sense;
            antisense  += expression.antisense;
            total      += expression.total;
          }
          else if(glyphTrack.experiment_merge == "count") {
            sense      += expression.sense;
            antisense  += expression.antisense;
            total      += expression.total;
          }
          else if(glyphTrack.experiment_merge == "max") {
            if(expression.sense > sense) { sense = expression.sense; }
            if(expression.antisense > antisense) { antisense = expression.antisense; }
            if(expression.total > total) { total = expression.total; }
          }
          else if(glyphTrack.experiment_merge == "min") {
            if(j==0) {
              sense      = expression.sense;
              antisense  = expression.antisense;
              total      = expression.total;
            } else {
              if(expression.sense < sense) { sense = expression.sense; }
              if(expression.antisense < antisense) { antisense = expression.antisense; }
              if(expression.total < total) { total = expression.total; }
            }
          }
        }
        if((glyphTrack.experiment_merge == "mean") && (feature.expression.length > 0)) {
          sense      /= expr_group.experiment_count;
          antisense  /= expr_group.experiment_count;
          total      /= expr_group.experiment_count; 
        }
        if(glyphTrack.logscale == 1) { 
          if(sense>0.0) { sense = Math.log(sense+1.0); }
          if(antisense>0.0) { antisense = Math.log(antisense+1.0); }
          if(total>0.0) { total = Math.log(total+1.0); }
        }
        if((sense==0.0) && (antisense==0.0) && (total>0.0)) {
          sense = total;
          antisense = total;
        }    
        
        feature.exp_total = total;
        feature.exp_sense = sense;
        feature.exp_antisense = antisense;          
      }
      
      //determine positioning
      var xfs = dwidth*(feature.start-current_region.start-0.5)/(current_region.end-current_region.start); 
      var xfe = dwidth*(feature.end-current_region.start+0.5)/(current_region.end-current_region.start); 
      
      if(xfe < 0) { continue; }
      if(xfs > dwidth) { continue; }
      if(xfs<0) { xfs = 0; }
      if(xfe > current_region.display_width) { xfe = current_region.display_width; }
      
      if(current_region.flip_orientation) {
        t_xfs = dwidth - xfe;
        t_xfe = dwidth - xfs;
        xfs = t_xfs;
        xfe = t_xfe;
      }
      
      var xpos;
      if(feature.strand == "+") {xpos = xfs;} else {xpos = xfe;}
      //xpos += 0.5; //a bit off pixel wise since I use a 1.5px width stroke
      
      var y_total = (height*2* feature.exp_total) / glyphTrack.total_max_express;
      if(y_total > height*2) { y_total = height*2; }
      
      var y_sense = (height * feature.exp_sense) / glyphTrack.max_express;
      if(y_sense > height)  { y_sense = height; }
      if(y_sense < -height) { y_sense = -height; }
      
      var y_anti = (height * feature.exp_antisense) / glyphTrack.max_express;
      if(y_anti > height)  { y_anti = height; }
      if(y_anti < -height) { y_anti = -height; }
      
      // 
      // render into expression line
      //
      if(glyphTrack.glyphStyle == "xyplot") {
        if(xfe-xfs<5) { xfe = xfs+5; }
        if(feature.exp_sense!=0) {
          points1 += " M"+(xfs.toFixed(1))+" "+ ((middle-y_sense).toFixed(1));
          points1 += " L"+(xfe+0.5)+" "+ ((middle-y_sense).toFixed(1));
        }
        if(feature.exp_antisense!=0) {
          points2 += " M"+(xfs.toFixed(1))+" "+ ((middle-y_anti).toFixed(1));
          points2 += " L"+(xfe+0.5)+" "+ ((middle-y_anti).toFixed(1));
        }      
      } else {
        if(glyphTrack.strandless) {
          if(y_total>0) {
            //points1 += " M"+xpos+" "+(middle)+" L"+xpos+" "+(middle-1-y_total);
            points1 += " M"+xfs+" "+(middle)+" L"+xfs+" "+(middle-1-y_total);
            points1 += " L"+xfe+" "+(middle-1-y_total)+" L"+xfe+" "+middle;
          }
        } else {
          if(y_sense>0) {
            if(current_region.flip_orientation) {
              //points1 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle-1-y_sense);
              points2 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle+1+y_sense);
              points2 += " L"+xfe+" "+(middle+1+y_sense)+" L"+xfe+" "+middle;
            } else {
              //points1 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle-1-y_sense);
              points1 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle-1-y_sense);
              points1 += " L"+xfe+" "+(middle-1-y_sense)+" L"+xfe+" "+middle;
            }
          }
          if(y_anti>0) {
            if(current_region.flip_orientation) {
              //points2 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle+1+y_anti);
              points1 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle-1-y_anti);
              points1 += " L"+xfe+" "+(middle-1-y_anti)+" L"+xfe+" "+middle;
            } else {
              //points2 += " M" +xpos+" "+(middle) +" L"+xpos+" "+(middle+1+y_anti);
              points2 += " M"+xfs+" "+(middle) +" L"+xfs+" "+(middle+1+y_anti);
              points2 += " L"+xfe+" "+(middle+1+y_anti)+" L"+xfe+" "+middle;
            }
          }
        }
      }
    }  //feature loop
    //document.getElementById("message").innerHTML = points1;
    
    if(points1) { expressLine1.setAttributeNS(null, 'd', points1+" Z"); }
    if(points2 && !glyphTrack.strandless) { 
      expressLine2.setAttributeNS(null, 'd', points2+" Z");    
    }  
  }
  //document.getElementById("message").innerHTML += " done";
}


function gLyphsDrawSplitSignalTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = current_region.display_width;
  
  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }
  
  //document.getElementById("message").innerHTML += " gLyphsDrawSplitSignalTrack";

  //this track style is dependant on the ExpressionPanel for sort order, so render first
  gLyphsDrawExpressionPanel();

  var group_array = new Array;    
  if(glyphTrack.exppanelmode == "mdgroup") {
    if(!glyphTrack.experiment_mdgrouping) { 
      //document.getElementById("message").innerHTML += "draw-no-mdgrouping";
      //gLyphsTrackFetchMetadataGrouping(trackID);  //async
      //gLyphsExpressionPanelRenderMDGroupMode(glyphTrack);
      return; 
    }
    //maybe need to sort here
    for(var k=0; k<glyphTrack.experiment_mdgrouping.length; k++) {
      var mdgroup = glyphTrack.experiment_mdgrouping[k];
      if(!mdgroup) { continue; }
      group_array.push(mdgroup);
    }
  } else if(glyphTrack.exppanelmode == "ranksum") { 
    if(!glyphTrack.experiment_ranksum_enrichment) { 
      //document.getElementById("message").innerHTML += " no ranksum_enrichment";
      return; 
    }
    //maybe need to sort here
    for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
      var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
      if(current_region.exppanel_hide_deactive && mdgroup.hide) { continue; }      
      if(glyphTrack.strandless) {
        if(Math.abs(mdgroup.value) < glyphTrack.ranksum_min_zscore) { continue; }
      } else {
        if((Math.abs(mdgroup.sense_value) < glyphTrack.ranksum_min_zscore) &&
           (Math.abs(mdgroup.antisense_value) < glyphTrack.ranksum_min_zscore)) { continue; }
      }
      group_array.push(mdgroup);
    }
  } else {
    if(!glyphTrack.experiment_array) { 
      //document.getElementById("message").innerHTML += " no experiment_array";
      return; 
    }
    //maybe need to sort here
    for(var k=0; k<glyphTrack.experiment_array.length; k++) {
      var experiment = glyphTrack.experiment_array[k];
      if(!experiment) { continue; }
      if(current_region.exppanel_hide_deactive && experiment.hide) { continue; }      
      if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
      group_array.push(experiment);
    }    
  }
  //document.getElementById("message").innerHTML += " groups=" + group_array.length;  

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;
  
  var group_height = height * group_array.length;
  
  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var svg = createSVG(current_region.display_width+10, 13+(group_height));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 13+(group_height);
  trackDiv.appendChild(svg);
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  var g1 = document.createElementNS(svgNS,'g');
  
  // make a backing rectangle to capture the selection events
  if(!current_region.exportSVGconfig || glyphTrack.backColor) {
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.id = "backRect_" + glyphTrack.trackID;
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '13px');
    backRect.setAttributeNS(null, 'width',  current_region.display_width+'px');
    backRect.setAttributeNS(null, 'height', group_height+'px');
    if(glyphTrack.backColor) { backRect.setAttributeNS(null, 'style', 'fill: '+glyphTrack.backColor+';'); }
    else { backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); }
    if(!current_region.exportSVGconfig) {
      backRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
      backRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    g1.appendChild(backRect);
  }
  
  var selectRect = document.createElementNS(svgNS,'rect');
  selectRect.setAttributeNS(null, 'x', '0px');
  selectRect.setAttributeNS(null, 'y', '13px');
  selectRect.setAttributeNS(null, 'width',  '0px');
  selectRect.setAttributeNS(null, 'height', group_height+'px');
  selectRect.setAttributeNS(null, 'style', 'fill: lightgray;');
  if(!current_region.exportSVGconfig) {
    selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;
  
  //
  // then the expression lines
  //
  //loop on each group to create signal graphs
  for(var k=0; k<group_array.length; k++) {
    var expr_group = group_array[k];
    if(!expr_group) { continue; }
    if(expr_group.hide) { continue; }
    
    // display a "title" for each group
    //var group_title = expr_group.name + " (" + expr_group.experiment_count + " exps)";
    var group_title = "";
    if(expr_group.expname) { group_title += expr_group.expname; } else { group_title = expr_group.name; }
    group_title += " (" + expr_group.experiment_count + " exps)";
    var text1 = document.createElementNS(svgNS,'text');
    text1.setAttributeNS(null, 'x', '20px');
    text1.setAttributeNS(null, 'y', ((glyphTrack.track_height*k)+20)+'px');
    text1.setAttributeNS(null, "font-size","10");
    text1.setAttributeNS(null, "fill", "black");
    text1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    if(!current_region.exportSVGconfig) {
      if(glyphTrack.exppanelmode == "mdgroup") { 
        text1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + k +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + k +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      } else if(glyphTrack.exppanelmode == "ranksum") { 
        text1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + k +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + k +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      } else {
      }
      text1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      text1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      text1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");      
    } 
    text1.appendChild(document.createTextNode(group_title));
    g1.appendChild(text1);
    
    //divide line
    var ypos = (glyphTrack.track_height*k) + 11;
    var groupLine = g1.appendChild(document.createElementNS(svgNS,'polyline'));
    groupLine.setAttributeNS(null, 'style', 'stroke: darkgray; stroke-width: 0.5px');
    groupLine.setAttributeNS(null, 'points', "0,"+ypos+" "+current_region.display_width+","+ypos);
    
    //now the expression lines
    var height = (glyphTrack.track_height) / 2.0;
    var middle = 12+ Math.floor(height);
    if(glyphTrack.strandless) { middle = 12+glyphTrack.track_height; }
    middle += (glyphTrack.track_height*k);
    
    var expressLine1 = expr_group.expressLine1;
    var expressLine2 = expr_group.expressLine2;

    if(expressLine1) {
      if(glyphTrack.exppanel_use_rgbcolor) { expressLine1.setAttributeNS(null, 'style', 'stroke-width:1px; stroke:'+expr_group.rgbcolor+'; fill:'+expr_group.rgbcolor+";"); }
      else { expressLine1.setAttributeNS(null, 'style', 'stroke-width:1px; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";"); }

      expressLine1.setAttributeNS(null, 'transform', "translate(0,"+(glyphTrack.track_height*k)+")");
      g1.appendChild(expressLine1);
      if(!current_region.exportSVGconfig) {
        expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
        expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
        expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
      }
    }
    if(expressLine2) {
      if(!glyphTrack.strandless) {
        if(glyphTrack.exppanel_use_rgbcolor) { expressLine2.setAttributeNS(null, 'style', 'stroke-width:1px; stroke:'+expr_group.rgbcolor+'; fill:'+expr_group.rgbcolor+";"); }
        else { expressLine2.setAttributeNS(null, 'style', 'stroke-width:1px; stroke:'+glyphTrack.revStrandColor+'; fill:'+glyphTrack.revStrandColor+";"); }
      }

      expressLine2.setAttributeNS(null, 'transform', "translate(0,"+(glyphTrack.track_height*k)+")");
      g1.appendChild(expressLine2);
      if(!current_region.exportSVGconfig) {
        expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
        expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
        expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");      
      }    
      var middleLine = g1.appendChild(document.createElementNS(svgNS,'polyline'));
      middleLine.setAttributeNS(null, 'style', 'stroke: darkgray; stroke-width: 1px');
      middleLine.setAttributeNS(null, 'points', "0,"+middle+" "+current_region.display_width+","+middle);
    }    
  }
  
  var minVal = glyphTrack.anti_max_express.toFixed(2);
  if(minVal>1) { minVal = glyphTrack.anti_max_express.toFixed(1); }
  var maxVal = glyphTrack.sense_max_express.toFixed(2);
  if(maxVal>1) { maxVal = glyphTrack.sense_max_express.toFixed(1); }
  var scaleVal = glyphTrack.max_express.toFixed(2);
  
  if(Math.floor(glyphTrack.anti_max_express) == glyphTrack.anti_max_express) { minVal = glyphTrack.anti_max_express.toFixed(0); }
  if(Math.floor(glyphTrack.sense_max_express) == glyphTrack.sense_max_express) { maxVal = glyphTrack.sense_max_express.toFixed(0); }
  if(Math.floor(glyphTrack.max_express) == glyphTrack.max_express) { scaleVal = glyphTrack.max_express.toFixed(0); }
  
  //scaleVal = Math.round(scaleVal / glyphTrack.experiment_array.length);
  
  new_title = title + " [rev:"+minVal+" fwd:"+maxVal+" scale:"+scaleVal;
  if(glyphTrack.expscaling != "auto") { new_title += " fixscale:" + glyphTrack.expscaling; }
  if(glyphTrack.logscale==1) { new_title += " log"; }
  new_title += "]";
  if(glyphTrack.has_expression) {
    new_title += " (" + glyphTrack.experiment_merge + ")";
    //new_title += " " + glyphTrack.overlap_mode;
  }
  new_title += " " + glyphTrack.datatype;
  
  glyphTrack.title = new_title;
  gLyphsDrawHeading(glyphTrack);
  glyphTrack.title = title;
  
  if(!current_region.exportSVGconfig) {
    var trackLine = document.createElementNS(svgNS,'rect');
    trackLine.setAttributeNS(null, 'x', '0px');
    trackLine.setAttributeNS(null, 'y', '13px');
    trackLine.setAttributeNS(null, 'width',  '1px');
    trackLine.setAttributeNS(null, 'height', group_height+'px');
    trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
    trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    g1.appendChild(trackLine);
    glyphTrack.trackLine = trackLine;
  }
  
  gLyphsDrawSelection(glyphTrack);
  
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
  
  if(!current_region.active_trackID) { current_region.active_trackID = trackID; }
}


//----------------------------------------------
//
// gLyphs toolbox methods. low level object 
// creation and manipulation
//
//----------------------------------------------

function createSVG(width, height) {
  var svg = document.createElementNS(svgNS,'svg');
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', height+'px');
  //svg.setAttributeNS(null, "xlink", "http://www.w3.org/1999/xlink");

  return svg;
}


function gLyphsDrawCentroid(glyphTrack, feature) {
  var color = "black";

  if(glyphTrack.colorMode=="signal") {
    var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
    if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
    //var tc = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
    var tc = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
    if(tc) { color = tc.getCSSHexadecimalRGB(); }
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) { color = feature.color; }
  }
  if(glyphTrack.colorMode=="strand") {
    if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(current_region.highlight_search && feature) {
    if(feature.name.indexOf(current_region.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }

  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', feature.xfs+',15 ' +feature.xfe+',15 ');
  block.setAttributeNS(null, 'style', 'stroke: '+color+'; stroke-width: 2px;');
  g2.appendChild(block);

  if(feature.xc>0 && feature.xc<current_region.display_width) {
    var arrow = document.createElementNS(svgNS,'polygon');
    arrow.setAttribute('style', 'fill: '+color+';');
    if(feature.strand == '+') {
      arrow.setAttributeNS(null, 'points', (feature.xc+5)+' 15,' +(feature.xc-5)+' 10,' +(feature.xc)+' 15,' +(feature.xc-5)+' 20');
    }
    if(feature.strand == '-') {
      arrow.setAttributeNS(null, 'points', (feature.xc-5)+' 15,' +(feature.xc+5)+' 10,' +(feature.xc)+' 15,' +(feature.xc+5)+' 20');
    }
    g2.appendChild(arrow);
  }
  return g2;
}


function gLyphsDrawThickArrow(start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }

  if(((strand == '+') || (strand == '')) && (end < current_region.display_width)) {
    end = end - 5;
    if(end<start) { end = start; }
    var arrow = document.createElementNS(svgNS,'polygon');
    arrow.setAttributeNS(null, 'points', (end+5)+' 15,' +(end-5)+' 10,' +(end-3)+' 15,' +(end-5)+' 20');
    g2.appendChild(arrow);
  }
  if(((strand == '-') || (strand == '')) && (start>0)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    start = start + 5;
    if(start>end) { start = end; }
    arrow.setAttributeNS(null, 'points', (start-5)+' 15,' +(start+5)+' 10,' +(start+3)+' 15,' +(start+5)+' 20');
    g2.appendChild(arrow);
  }

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+' 13,' +end+' 13,' +end+' 17,' +start+' 17');
  g2.appendChild(block);

  return g2;
}


function gLyphsDrawThickFlatArrow(start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }

  if(((strand == '+') || (strand == '')) && (end < current_region.display_width)) {
    end = end - 5;
    if(end<start) { end = start; }
    var arrow = document.createElementNS(svgNS,'polygon');
    arrow.setAttributeNS(null, 'points', (end+5)+' 15,' +(end-5)+' 10,' +(end-5)+' 15,' +(end-5)+' 20');
    g2.appendChild(arrow);
  }
  if(((strand == '-') || (strand == '')) && (start>0)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    start = start + 5;
    if(start>end) { start = end; }
    arrow.setAttributeNS(null, 'points', (start-5)+' 15,' +(start+5)+' 10,' +(start+5)+' 15,' +(start+5)+' 20');
    g2.appendChild(arrow);
  }

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+' 13,' +end+' 13,' +end+' 17,' +start+' 17');
  g2.appendChild(block);

  return g2;
}


function gLyphsDrawMediumArrow(start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }

  if(((strand == '+') || (strand == '')) && (end < current_region.display_width)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    end = end - 3;
    if(end<start) { end = start; }
    arrow.setAttributeNS(null, 'points', (end+3)+' 13,' +(end-3)+' 10,' +(end-3)+' 16');
    g2.appendChild(arrow);
  }
  if(((strand == '-') || (strand == '')) && (start>0)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    start = start + 3;
    if(start>end) { start = end; }
    arrow.setAttributeNS(null, 'points', (start-3)+' 13,' +(start+3)+' 10,' +(start+3)+' 16');
    g2.appendChild(arrow);
  }

  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 14.5,' +start+' 14.5');
  g2.appendChild(block);

  return g2;
}


function gLyphsDrawArrow(center, strand) {
  var arrow = document.createElementNS(svgNS,'polygon');
  if(strand == '-') {
    //arrow.setAttributeNS(null, 'points', (center-5)+' 15,' +(center+5)+' 10,' +(center)+' 15,' +(center+5)+' 20,' + (center-5)+' 15');
    //arrow.setAttributeNS(null, 'points', (center)+' 15,' +(center+10)+' 10,' +(center+5)+' 15,' +(center+10)+' 20,' + (center)+' 15');
    arrow.setAttributeNS(null, 'points', (center)+' 15,' +(center+10)+' 10,' +(center+10)+' 20,' + (center)+' 15');
  } else {
    //arrow.setAttributeNS(null, 'points', (center+5)+' 15,' +(center-5)+' 10,' +(center)+' 15,' +(center-5)+' 20,' + (center+5)+' 15');
    //arrow.setAttributeNS(null, 'points', (center)+' 15,' +(center-10)+' 10,' +(center-5)+' 15,' +(center-10)+' 20,' + (center)+' 15');
    arrow.setAttributeNS(null, 'points', (center)+' 15,' +(center-10)+' 10,' +(center-10)+' 20,' + (center)+' 15');
  }
  //if(strand == '') { arrow.setAttributeNS(null, 'points', (center+5)+' 15,' +(center)+' 12,' +(center-5)+' 15,' +(center)+' 18,' + (center+5)+' 15'); }

  if(strand == '+') { arrow.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { arrow.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '')  { arrow.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  return arrow;
}


function gLyphsDrawSeqTag(xpos, strand, feature, glyphTrack) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }

  var arrow = document.createElementNS(svgNS,'polygon');
  if(strand == '-') {
    arrow.setAttributeNS(null, 'points', (xpos)+' 15,' +(xpos+10)+' 10,' +(xpos+5)+' 15,' +(xpos+10)+' 20');
  } else {
    arrow.setAttributeNS(null, 'points', (xpos)+' 15,' +(xpos-10)+' 10,' +(xpos-5)+' 15,' +(xpos-10)+' 20');
  }
  g2.appendChild(arrow);

  var fsrc    = feature.source_name;
  var fsrc_id = feature.fsrc_id;
  var seqtag  = feature.name;
  var seqedit = "";
  var mdata = feature.mdata
  if(mdata["seqtag"])  { seqtag = mdata["seqtag"][0]; }
  if(mdata["sam:seq"]) { seqtag = mdata["sam:seq"][0]; }
  if(mdata["edit"])    { seqedit = mdata["edit"][0]; }

  var textWidth = 0;
  var srcColor = getTrackFsrcColor(glyphTrack, fsrc_id);

  var tobj = document.createElementNS(svgNS,'text');
  tobj.setAttributeNS(null, 'y', '16px');
  tobj.setAttributeNS(null, "font-size","9px");
  tobj.setAttributeNS(null, "font-family", 'monaco,andale-mono,courier');
  tobj.setAttributeNS(null, 'fill', "black");
  tobj.setAttributeNS(null, 'x', xpos);

  var t1 = document.createTextNode(seqtag);
  textWidth += seqtag.length;

  var tsp1 = document.createElementNS(svgNS,'tspan');
  tsp1.setAttributeNS(null, "fill", 'red');
  var t2 = document.createTextNode("["+ seqedit +"]");
  tsp1.appendChild(t2);
  textWidth += 2+seqedit.length;

  var tsp2 = document.createElementNS(svgNS,'tspan');
  tsp2.setAttributeNS(null, "fill", srcColor);
  tsp2.setAttributeNS(null, "font-size","9px");
  var t3 = document.createTextNode(fsrc);
  tsp2.appendChild(t3);
  textWidth += fsrc.length;
 
  if(strand == '+') { 
    tobj.setAttributeNS(null, 'text-anchor', 'start');
    tobj.appendChild(t1);
    tobj.appendChild(tsp1);
    tobj.appendChild(tsp2);
    g2.xfs = xpos;
    g2.xfe = xpos + (textWidth*9);
  } else { 
    tobj.setAttributeNS(null, 'text-anchor', 'end' );
    tobj.appendChild(tsp2);
    tobj.appendChild(tsp1);
    tobj.appendChild(t1);
    g2.xfs = xpos - (textWidth*9);
    g2.xfe = xpos;
  }

  g2.appendChild(tobj);

  return g2;
}


function gLyphsDrawBox(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 12.5,' +end+' 12.5,' +end+' 16.5,' +start+' 16.5');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  g2.appendChild(block);
  return g2;
}

function gLyphsDrawLine(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',13.5 ' +end+',13.5 ');
  if(strand == '') { block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.5px;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'stroke: green; stroke-width: 1.5px;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'stroke: purple; stroke-width: 1.5px;'); }
  g2.appendChild(block);
  return g2;
}


function gLyphsDrawIntron(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',13.5 ' +end+',13.5 ');
  block.setAttributeNS(null, 'style', 'stroke: red; stroke-width: 0.5px;');
  g2.appendChild(block);
  return g2;
}


function gLyphsDrawExon(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  //block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 15.5,' +start+' 15.5');
  block.setAttributeNS(null, 'points', start+' 11,' +end+' 11,' +end+' 16,' +start+' 16');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function gLyphsDrawMediumExon(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  //block.setAttributeNS(null, 'points', start+' 12,' +end+' 12,' +end+' 15,' +start+' 15');
  block.setAttributeNS(null, 'points', start+' 11.66,' +end+' 11.66,'+end+' 15.33,' +start+' 15.33');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function gLyphsDrawScoreThickBox(feature, glyphTrack) {
  var start = feature.xfs;
  var end = feature.xfe;
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var height = 10.0 * feature.score / glyphTrack.max_score + 1;
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',12.5 ' +end+',12.5 ');
  if(feature.strand == '') { block.setAttributeNS(null, 'style', 'stroke:dimgray; stroke-width:'+height+"px"); }
  if(feature.strand == '+') { block.setAttributeNS(null, 'style', 'stroke:green; stroke-width:'+height+"px"); }
  if(feature.strand == '-') { block.setAttributeNS(null, 'style', 'stroke:purple; stroke-width:'+height+"px"); }
  return block;
}

function gLyphsDrawExperimentHeatmap(feature, glyphTrack) {
  var start = feature.xfs;
  var end = feature.xfe;
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }

  if(!feature.expression) { return; }
  var experiments = glyphTrack.experiment_array;
  if(!experiments) { return; }

  var g2 = document.createElementNS(svgNS,'g');

  var level=0;
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    if(!experiment || experiment.hide) { continue; }
    //if(glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(current_region.hide_zero_experiments && (experiment.value==0)) { continue; }
    var expression = null;
    for(var j=0; j<feature.expression.length; j++) {
      var expr = feature.expression[j];
      if(!expr) { continue; }
      if(glyphTrack.datatype && (expr.datatype != glyphTrack.datatype)) { continue; }
      if(expr.expID == experiment.id) { expression=expr; break; } 
    }
    level++;
    if(!expression) { continue; }
    if(expression.total==0.0) { continue; }

    var cr = (expression.total -glyphTrack.scale_min_signal) / (glyphTrack.max_express_element - glyphTrack.scale_min_signal);
    if(cr<0.05) { continue; }
    //var color = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
    var color = gLyphsScoreColorSpace2(glyphTrack, cr);

    var block = document.createElementNS(svgNS,'rect');
    block.setAttributeNS(null, 'x', start);
    block.setAttributeNS(null, 'y', 9+(level * glyphTrack.track_height));
    block.setAttributeNS(null, 'width',  (end-start));
    block.setAttributeNS(null, 'height', glyphTrack.track_height);

    if(!current_region.exportSVGconfig) {
      var msg = experiment.name + "<br>"+expression.total;
      block.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('"+msg+"',300);");
      block.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }

    block.style.fill = color.getCSSHexadecimalRGB();
    //block.style.stroke = color.getCSSHexadecimalRGB();
    //block.setAttributeNS(null, 'style', 'fill:purple;');

    g2.appendChild(block);
  }

  //g2.fidx = feature.fidx;
  return g2;
}


//----- transcripts ------

function gLyphsDrawTranscript(glyphTrack, feature) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = current_region.display_width;
  var start      = current_region.start;
  var end        = current_region.end;
  
  var color = "black";  
  if(glyphTrack.colorMode=="signal") {
    var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
    if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
    //var tc = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
    var tc = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
    if(tc) { color = tc.getCSSHexadecimalRGB(); }
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) { color = feature.color; }
  }
  if(glyphTrack.colorMode=="strand") {
    if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(current_region.highlight_search && feature) {
    if(feature.name.indexOf(current_region.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }
  
  //feature group
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttribute('fill', 'none');
    
  //thin line
  var path1 = document.createElementNS(svgNS,'path');
  path1.setAttribute('d', 'M'+feature.xfs+' 13.5 L' +feature.xfe+' 13.5');
  path1.setAttribute('stroke', color);
  path1.setAttribute('stroke-width', '1.5px');
  g2.appendChild(path1);
  
  //subfeatures
  var subfeats = feature.subfeatures;
  if(subfeats) {
    var thickstart = feature.start;
    var thickend   = feature.end;
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      if(feature.strand == "+") {
        if((subfeature.category == "5utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
        if((subfeature.category == "3utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
      }
      if(feature.strand == "-") {
        if((subfeature.category == "3utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
        if((subfeature.category == "5utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
      }
    }
    
    var exon_path   = ""
    var intron_path = "";
    var utr_path = "";

    var CDS_mode = false;
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      if(subfeature.category == "CDS") { CDS_mode=true; break; }
    }

    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      
      var fs = subfeature.start; 
      var fe = subfeature.end;
      if((subfeature.category == "block") || (subfeature.category == "exon")) {
        if(CDS_mode) { continue; }
        if(thickstart == thickend) { continue; }
        if(fe < thickstart) { continue; }
        if(fs > thickend) { continue; }
        if(fs < thickstart) { fs = thickstart; }
        if(fe > thickend)   { fe = thickend; }
      }
      
      var xfs = dwidth*(fs-start-0.5)/(end-start); 
      var xfe = dwidth*(fe-start+0.5)/(end-start); 
      if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
      
      if((xfe>=0) && (xfs<dwidth)) {       
        if(xfs<0) { xfs = 0; }
        if(xfe > current_region.display_width) { xfe = current_region.display_width; }
        
        if(subfeature.category == "intron") { 
          intron_path += 'M'+xfs+' 13.5 L'+xfe+' 13.5 ';
        } else if((subfeature.category.match(/utr/)) || (subfeature.category.match(/UTR/))) { 
          utr_path += 'M'+xfs+' 13.5 L'+xfe+' 13.5 ';
        } else {
          exon_path += 'M'+xfs+' 13.5 L'+xfe+' 13.5 ';
        }
      }
    }
        
    if(exon_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      if(glyphTrack.glyphStyle=='thick-transcript')  { 
        path2.setAttribute('stroke-width', '5px');
      } else {
        path2.setAttribute('stroke-width', '7px');
      }
      path2.setAttribute('d', exon_path);
    }
    if(intron_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', "red");
      path2.setAttribute('stroke-width', '0.75px');
      path2.setAttribute('d', exon_path);
    }
    if(utr_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      path2.setAttribute('stroke-width', '3px');
      path2.setAttribute('d', utr_path);
    }
  }
  return g2;
}


function gLyphsDrawTranscript2(glyphTrack, feature) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = current_region.display_width;
  var start      = current_region.start;
  var end        = current_region.end;
  
  var color = "black";  
  if(glyphTrack.colorMode=="signal") {
    var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
    if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
    //var tc = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
    var tc = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
    if(tc) { color = tc.getCSSHexadecimalRGB(); }
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) { color = feature.color; }
  }
  if(glyphTrack.colorMode=="strand") {
    if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(current_region.highlight_search && feature) {
    if(feature.name.indexOf(current_region.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }
  
  //feature group
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttribute('fill', 'none');
    
  //thin line
  var path1 = document.createElementNS(svgNS,'path');
  path1.setAttribute('d', 'M'+feature.xfs+' 13.5 L' +feature.xfe+' 13.5');
  path1.setAttribute('stroke', color);
  path1.setAttribute('stroke-width', '1.5px');
  g2.appendChild(path1);
  
  //subfeatures
  var subfeats = feature.subfeatures;
  if(subfeats) {
    var exon_path   = ""
    var intron_path = "";
    var utr_path = "";
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      
      var fs = subfeature.start; 
      var fe = subfeature.end;
      
      var xfs = dwidth*(fs-start-0.5)/(end-start); 
      var xfe = dwidth*(fe-start+0.5)/(end-start); 
      if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
      
      if((xfe>=0) && (xfs<dwidth)) {       
        if(xfs<0) { xfs = 0; }
        if(xfe > current_region.display_width) { xfe = current_region.display_width; }
        
        if(subfeature.category == "intron") { 
          intron_path += 'M'+xfs+' 13.5 L'+xfe+' 13.5 ';
        } else if((subfeature.category.match(/utr/)) || (subfeature.category.match(/UTR/))) { 
          utr_path += 'M'+xfs+' 11 L'+xfe+' 11 L'+xfe+" 16 L"+xfs+" 16 Z";
        } else {
          exon_path += 'M'+xfs+' 13.5 L'+xfe+' 13.5 ';
        }
      }
    }

    if(exon_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      path2.setAttribute('stroke-width', '5px');
      path2.setAttribute('d', exon_path);
    }
    if(intron_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', "red");
      path2.setAttribute('stroke-width', '0.75px');
      path2.setAttribute('d', exon_path);
    }
    if(utr_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', "black");
      path2.setAttribute('stroke-width', '1.5px');
      path2.setAttribute('d', utr_path);
    }
  }
  return g2;
}


function gLyphsDrawThinTranscript(glyphTrack, feature) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = current_region.display_width;
  var start      = current_region.start;
  var end        = current_region.end;
  
  var color = "black";  
  if(glyphTrack.colorMode=="signal") {
    var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
    if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
    //var tc = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
    var tc = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
    if(tc) { color = tc.getCSSHexadecimalRGB(); }
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) { color = feature.color; }
  }
  if(glyphTrack.colorMode=="strand") {
    if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(current_region.highlight_search && feature) {
    if(feature.name.indexOf(current_region.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }
  
  //feature group
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttribute('fill', 'none');
  
  //thin line
  var path1 = document.createElementNS(svgNS,'path');
  path1.setAttribute('d', 'M'+feature.xfs+' 11.5 L' +feature.xfe+' 11.5');
  path1.setAttribute('stroke', color);
  path1.setAttribute('stroke-width', '0.75px');
  g2.appendChild(path1);
  
  //subfeatures
  var subfeats = feature.subfeatures;
  if(subfeats) {
    var exon_path   = ""
    var intron_path = "";
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      if(subfeature.category.match(/utr/)) { continue; }

      var fs = subfeature.start; 
      var fe = subfeature.end; 
      
      var xfs = dwidth*(fs-start-0.5)/(end-start); 
      var xfe = dwidth*(fe-start+0.5)/(end-start); 
      if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
      
      if((xfe>=0) && (xfs<dwidth)) {       
        if(xfs<0) { xfs = 0; }
        if(xfe > current_region.display_width) { xfe = current_region.display_width; }
        
        if(subfeature.category == "intron") { 
          intron_path += 'M'+xfs+' 11.5 L'+xfe+' 11.5 '
        } else {
          exon_path   += 'M'+xfs+' 11.5 L'+xfe+' 11.5 '
        }
      }
    }
    
    if(exon_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      path2.setAttribute('stroke-width', '2px');
      path2.setAttribute('d', exon_path);
    }
    if(intron_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', "red");
      path2.setAttribute('stroke-width', '0.5px');
      path2.setAttribute('d', exon_path);
    }
  }
  return g2;
}

function gLyphsDrawTranscriptScoreThick(glyphTrack, feature) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = current_region.display_width;
  var start      = current_region.start;
  var end        = current_region.end;

  var thickness = (10.0 * feature.score / glyphTrack.max_score) + 4;

  var color = "black";  
  if(glyphTrack.colorMode=="signal") {
    var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
    if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
    //var tc = gLyphsScoreColorSpace(glyphTrack.colorspace, cr);
    var tc = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
    if(tc) { color = tc.getCSSHexadecimalRGB(); }
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) { color = feature.color; }
  }
  if(glyphTrack.colorMode=="strand") {
    if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(current_region.highlight_search && feature) {
    if(feature.name.indexOf(current_region.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }
  
  //feature group
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttribute('fill', 'none');
    
  //thin line
  var path1 = document.createElementNS(svgNS,'path');
  path1.setAttribute('d', 'M'+feature.xfs+' 15.5 L' +feature.xfe+' 15.5');
  path1.setAttribute('stroke', color);
  path1.setAttribute('stroke-width', '1.5px');
  g2.appendChild(path1);
  
  //subfeatures
  var subfeats = feature.subfeatures;
  if(subfeats) {
    var thickstart = feature.start;
    var thickend   = feature.end;
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      if(feature.strand == "+") {
        if((subfeature.category == "5utr") && (subfeature.end > thickstart)) { thickstart = subfeature.end; }
        if((subfeature.category == "3utr") && (subfeature.start < thickend)) { thickend = subfeature.start; }
      }
      if(feature.strand == "-") {
        if((subfeature.category == "3utr") && (subfeature.end > thickstart)) { thickstart = subfeature.end; }
        if((subfeature.category == "5utr") && (subfeature.start < thickend)) { thickend = subfeature.start; }
      }
    }
    
    var exon_path   = ""
    var intron_path = "";
    var utr_path = "";
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      
      var fs = subfeature.start; 
      var fe = subfeature.end;
      if((subfeature.category == "block") || (subfeature.category == "exon")) {
        if(thickstart == thickend) { continue; }
        if(fe < thickstart) { continue; }
        if(fs > thickend) { continue; }
        if(fs < thickstart) { fs = thickstart; }
        if(fe > thickend)   { fe = thickend; }
      }
      
      var xfs = dwidth*(fs-start)/(end-start); 
      var xfe = dwidth*(fe-start+1)/(end-start); 
      if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
      
      if((xfe>=0) && (xfs<dwidth)) {       
        if(xfs<0) { xfs = 0; }
        if(xfe > current_region.display_width) { xfe = current_region.display_width; }
        
        if(subfeature.category == "intron") { 
          intron_path += 'M'+xfs+' 15.5 L'+xfe+' 15.5 ';
        } else if(subfeature.category.match(/utr/)) { 
          utr_path += 'M'+xfs+' 15.5 L'+xfe+' 15.5 ';
        } else {
          exon_path += 'M'+xfs+' 15.5 L'+xfe+' 15.5 ';
        }
      }
    }
        
    if(exon_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      path2.setAttribute('stroke-width', thickness+'px');
      path2.setAttribute('d', exon_path);
    }
    if(intron_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', "red");
      path2.setAttribute('stroke-width', '0.75px');
      path2.setAttribute('d', exon_path);
    }
    if(utr_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      path2.setAttribute('stroke-width', '3px');
      path2.setAttribute('d', utr_path);
    }
  }
  return g2;
}


//----- atomic glyph drawing functions  --------

function gLyphsDrawSeqAlignment(glyphTrack, feature) {
  if(!feature || !glyphTrack) { return null; }

  var showseq = true;
  if((current_region.display_width / (current_region.end  - current_region.start)) < 5) { 
    showseq = false;
  }
  
  var dwidth     = current_region.display_width;
  var start      = current_region.start;
  var end        = current_region.end;
  var length     = end-start;

  var seqtag  = feature.name;
  var cigar = "";
  var mdata = feature.mdata
  if(mdata["seqtag"])    { seqtag = mdata["seqtag"][0]; }
  if(mdata["sam:seq"])   { seqtag = mdata["sam:seq"][0]; }
  if(mdata["sam:cigar"]) { cigar  = mdata["sam:cigar"][0]; }
  if(cigar =="") {showseq = false; }
  
  var color = "black";  
  if(glyphTrack.colorMode=="signal") {
    var cr = (feature.score - glyphTrack.scale_min_signal) / (glyphTrack.max_score - glyphTrack.scale_min_signal);
    if(glyphTrack.has_expression) { cr = (feature.exp_total - glyphTrack.scale_min_signal) / (glyphTrack.total_max_express - glyphTrack.scale_min_signal); }
    var tc = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
    if(tc) { color = tc.getCSSHexadecimalRGB(); }
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) { color = feature.color; }
  }
  if(glyphTrack.colorMode=="strand") {
    if((!current_region.flip_orientation && (feature.strand == "-")) || (current_region.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(current_region.highlight_search && feature) {
    if(feature.name.indexOf(current_region.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }
  
  //feature group
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttribute('fill', 'none');
  
  //thin line
  var path1 = document.createElementNS(svgNS,'path');
  path1.setAttribute('d', 'M'+feature.xfs+' 11.5 L' +feature.xfe+' 11.5');
  path1.setAttribute('stroke', color);
  path1.setAttribute('stroke-width', '0.75px');
  g2.appendChild(path1);
  
  //subfeatures
  var subfeats = feature.subfeatures;
  if(subfeats ) {
    var exon_path   = ""
    var intron_path = "";
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      if(subfeature.category.match(/utr/)) { continue; }

      var fs = subfeature.start; 
      var fe = subfeature.end; 
      
      var xfs = dwidth*(fs-start-0.5)/(end-start); 
      var xfe = dwidth*(fe-start+0.5)/(end-start); 
      if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
      
      if((xfe>=0) && (xfs<dwidth)) {       
        if(xfs<0) { xfs = 0; }
        if(xfe > current_region.display_width) { xfe = current_region.display_width; }
        
        if(subfeature.category == "intron") { 
          intron_path += 'M'+xfs+' 11.5 L'+xfe+' 11.5 '
        } else {
          exon_path   += 'M'+xfs+' 11.5 L'+xfe+' 11.5 '
        }
      }
    }
    
    if(exon_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', color);
      if(showseq) { path2.setAttribute('stroke-width', '2px'); }
      else { path2.setAttribute('stroke-width', '4px'); }
      path2.setAttribute('d', exon_path);
    }
    if(intron_path) {
      var path2 = document.createElementNS(svgNS,'path');
      g2.appendChild(path2);
      path2.setAttribute('stroke', "red");
      path2.setAttribute('stroke-width', '0.5px');
      path2.setAttribute('d', exon_path);
    }
  }

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

  return g2;
}



//----- atomic glyph drawing functions  --------

function gLyphsDrawThinLine(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11.5 ' +end+',11.5 ');
  if(strand == '') { block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.2px;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'stroke: green; stroke-width: 1.2px;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'stroke: purple; stroke-width: 1.2px;'); }
  g2.appendChild(block);
  return g2;
}

function gLyphsDrawThinIntron(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11.5 ' +end+',11.5 ');
  block.setAttributeNS(null, 'style', 'stroke: red; stroke-width: 0.5px;');
  g2.appendChild(block);
  return g2;
}

function gLyphsDrawThinExon(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 10.5,' +end+' 10.5,' +end+' 12.5,' +start+' 12.5');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function gLyphsDrawUTR(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11,' +end+' 11,' +end+' 16,' +start+' 16');
  block.setAttributeNS(null, 'style', 'stroke: black; fill: none; stroke-width: 1.5px;');
  return block;
}

function gLyphsDrawMediumUTR(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 15.5,' +start+' 15.5');
  block.setAttributeNS(null, 'style', 'stroke: black; fill: none; stroke-width: 1.5px;');
  return block;
}

function gLyphsDrawCytoBand(start, end, feature) {
  var name   = feature.name
  var strand = feature.strand;

  var cytostain = "gneg";
  var textcolor = "white";
  if(feature.cytostain) { cytostain = feature.cytostain; }
  else {
    if(feature.strand == "+") { cytostain = "gpos50";} else { cytostain = "gneg"; }
  }

  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polygon');
  g2.appendChild(block);
  block.setAttributeNS(null, 'points', start+' 10,' +end+' 10,' +end+' 20,' +start+' 20');
  switch(cytostain) {
    case "gneg": block.setAttributeNS(null, 'style', 'fill: rgb(227,227,227);'); textcolor = "black"; break;

    case "gpos25":  block.setAttributeNS(null, 'style', 'fill: rgb(142,142,142);'); break;
    case "gpos33":  block.setAttributeNS(null, 'style', 'fill: rgb(123,123,123);'); break;
    case "gpos50":  block.setAttributeNS(null, 'style', 'fill: rgb(85,85,85);'); break;
    case "gpos66":  block.setAttributeNS(null, 'style', 'fill: rgb(67,67,67);'); break;
    case "gpos75":  block.setAttributeNS(null, 'style', 'fill: rgb(57,57,57);'); break;
    case "gpos":    block.setAttributeNS(null, 'style', 'fill: rgb(0,0,0);'); break;
    case "gpos100": block.setAttributeNS(null, 'style', 'fill: rgb(0,0,0);'); break;

    case "gvar":    block.setAttributeNS(null, 'style', 'fill: rgb(0,0,67);'); break;
    case "stalk":   block.setAttributeNS(null, 'style', 'fill: rgb(77,98,126);'); break;
    case "acen":    block.setAttributeNS(null, 'style', 'fill: rgb(150,50,50);'); break;

    default:        block.setAttributeNS(null, 'style', 'fill: rgb(0,0,0);'); break;
  }

  var tobj = document.createElementNS(svgNS,'text');
  tobj.setAttributeNS(null, 'x', '0px');
  tobj.setAttributeNS(null, 'y', '18px');
  tobj.setAttributeNS(null, "font-size","8px");
  tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  tobj.setAttributeNS(null, "fill", textcolor);
  var textNode = document.createTextNode(name);
  //var textNode = document.createTextNode(cytostain);
  tobj.appendChild(textNode);

  var gt1 = document.createElementNS(svgNS,'g');
  gt1.appendChild(tobj);
  if(current_region.flip_orientation) { //need to flip the text back  so it does not look like a mirror image
    tobj.setAttributeNS(null, 'text-anchor', 'end' );
    gt1.setAttributeNS(null, 'transform', "scale(-1,1) translate(-"+(1+start)+",0)");
  } else {
    tobj.setAttributeNS(null, 'text-anchor', 'start' );
    gt1.setAttributeNS(null, 'transform', "translate("+(1+start)+",0)");
  }

  g2.appendChild(gt1);

  //document.getElementById("message").innerHTML += " ;"+name; 
  return g2;
}


function gLyphsDrawCytoSpan() {
  var dwidth   = current_region.display_width;
  var fs       = current_region.start;
  var fe       = current_region.end;
  var start    = 0;
  var end      = current_region.chrom_length;

  var xfs = dwidth*(fs-start)/(end-start); 
  var xfe = dwidth*(fe-start)/(end-start); 

  if(current_region.flip_orientation) { 
    var t_xfs = dwidth - xfe;
    var t_xfe = dwidth - xfs;
    xfs = t_xfs;
    xfe = t_xfe;
  }

  var g2 = document.createElementNS(svgNS,'g');
  if(end) {
    var block = document.createElementNS(svgNS,'polygon');
    block.setAttributeNS(null, 'points', xfs+' 11,' +xfe+' 11,' +xfe+' 23,' +xfs+' 23');
    block.setAttributeNS(null, 'style', 'stroke:red; fill: none; stroke-width: 1.5px;');
    g2.appendChild(block);
  }
  return g2;
} 


function gLyphsDrawChromScale() {
  var dwidth   = current_region.display_width;
  var start    = current_region.start;
  var end      = current_region.end;
  var length   = end-start;
  var majorTick = Math.pow(10, Math.floor((Math.log(length / (dwidth/100))/Math.log(10)) + 0.5));
  var numTicks = length / majorTick;
  if(numTicks<3) { numTicks *= 2; majorTick /= 2; }
  if(numTicks>10) { numTicks /= 5; majorTick *= 5; }
  var minorTick = majorTick / 10;

  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', '0,30 ' +dwidth+',30 ');
  block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1px;');
  g2.appendChild(block);

  for(x=0; x<numTicks*10; x++) {
    var pos  = (Math.floor(start/minorTick +  0.5) + x)*minorTick;
    var mpos = Math.floor(pos/majorTick)*majorTick;
    var xfs  = dwidth*(pos-start)/(end-start); 
    if(current_region.flip_orientation) { xfs = dwidth-xfs; }

    var block = document.createElementNS(svgNS,'polyline');
    if(pos == mpos) {
      block.setAttributeNS(null, 'points', xfs + ',23 ' + xfs+',37 ');
      block.setAttributeNS(null, 'style', 'stroke: black; stroke-width: 1px;');
      g2.appendChild(block);

      var tobj = document.createElementNS(svgNS,'text');
      tobj.setAttributeNS(null, 'x',  xfs +'px');
      tobj.setAttributeNS(null, 'y', '45px');
      tobj.setAttributeNS(null, "font-size","10px");
      tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');

      var textNode = document.createTextNode(pos);
      tobj.appendChild(textNode);
      g2.appendChild(tobj);
    } else {
      block.setAttributeNS(null, 'points', xfs + ',27 ' + xfs+',33 ');
      block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1px;');
      g2.appendChild(block);
    }
  }
  return g2;
} 


function gLyphsDrawChromSequence(glyphTrack) {
  if(!current_region.genome_sequence) { return null; }
  if((current_region.display_width / (current_region.end  - current_region.start)) < 5) { return null; }

  var dwidth   = current_region.display_width;
  var start    = current_region.start;
  var end      = current_region.end;
  var length   = end-start;

  var g2 = document.createElementNS(svgNS,'g');

  for(x=0; x<length; x++) {
    var pos  = (Math.floor(start +  0.5) + x);
    var xfs  = dwidth*(pos-start)/length; 

    if(current_region.flip_orientation) { xfs = dwidth-xfs; }

    var tobj = document.createElementNS(svgNS,'text');
    tobj.setAttributeNS(null, 'x',  (xfs-3) +'px');
    tobj.setAttributeNS(null, 'y', '55px');
    tobj.setAttributeNS(null, "font-size","10px");
    tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    tobj.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    tobj.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    tobj.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");

    var base = current_region.genome_sequence.charAt(x)
    if(current_region.flip_orientation) { base = complement_base(base); }
    var textNode = document.createTextNode(base);
    tobj.appendChild(textNode);
    g2.appendChild(tobj);
  }
  return g2;
} 


function gLyphsDrawHeading(glyphTrack) {

  if(!glyphTrack.top_group) { return; }

  // make a rectangle for a "title bar" for each track
  var titleBar = document.createElementNS(svgNS,'rect');
  titleBar.setAttributeNS(null, 'x', '0px');
  titleBar.setAttributeNS(null, 'y', '0px');
  titleBar.setAttributeNS(null, 'width',  current_region.display_width+10+'px');
  titleBar.setAttributeNS(null, 'height', '11px');
  if(glyphTrack.trackID == current_region.active_trackID) { titleBar.setAttributeNS(null, 'style', 'fill: #DECAAF;'); } 
  else { titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;'); }
  if(!current_region.exportSVGconfig) { 
    titleBar.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
    titleBar.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");gLyphsChangeActiveTrack('" +glyphTrack.trackID+ "');");
    titleBar.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  }
  if((current_region.exportSVGconfig === undefined) || !current_region.exportSVGconfig.hide_titlebar) { 
    glyphTrack.top_group.appendChild(titleBar);
    glyphTrack.titleBar = titleBar;
  }

  createHideTrackWidget(glyphTrack);

  if(!zenbu_embedded_view) {
    createCloseTrackWidget(glyphTrack);
    createConfigTrackWidget(glyphTrack);
    createDuplicateTrackWidget(glyphTrack);
    createDownloadWidget(glyphTrack);
  }

  //
  // and now the title
  //
  var g2 = document.createElementNS(svgNS,'g');
  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }
  var is_filtered = 0;
  if(glyphTrack.expfilter) { is_filtered = 1; }
  if(glyphTrack.experiments) {
    for(var expID in glyphTrack.experiments){
      var experiment = glyphTrack.experiments[expID];
      if(experiment.hide) { is_filtered = 1; }
    }
  }
  if(is_filtered && glyphTrack.expfilter) { title += " FILTERED [" + glyphTrack.expfilter +"]"; }


  var obj = document.createElementNS(svgNS,'text');
  obj.setAttributeNS(null, 'x', '20px');
  obj.setAttributeNS(null, 'y', '9px');
  obj.setAttributeNS(null, "font-size","10");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  if(!current_region.exportSVGconfig) { 
    obj.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
    obj.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");gLyphsChangeActiveTrack('" +glyphTrack.trackID+ "');");
    obj.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  }
  obj.appendChild(document.createTextNode(title));
  g2.appendChild(obj);

  glyphTrack.top_group.appendChild(g2);
}


function gLyphsDrawSelection(glyphTrack) {
  var selection  = glyphTrack.selection;
  if(!selection) { return; }
  var selectRect = glyphTrack.selectRect;
  if(!selectRect) { return; }

  if(!selection.chrom_start || !selection.chrom_end) { return; }

  var dwidth = current_region.display_width;
  var start  = current_region.start;
  var end    = current_region.end;
  var fs     = selection.chrom_start;
  var fe     = selection.chrom_end;
  if(fs>fe) { var t=fs; fs=fe; fe=t; }

  var xfs   = dwidth*(fs-start-0.5)/(end-start);
  var xfe   = dwidth*(fe-start+0.5)/(end-start);
  var width = xfe-xfs+1;

  if(current_region.flip_orientation) { 
    t_xfs = dwidth-xfe; 
    t_xfe = dwidth-xfs; 
    xfs = t_xfs;
    xfe = t_xfe;
  }
  
  selection.xmiddle = 10 + (xfe + xfs)/2;

  selectRect.setAttributeNS(null, 'x', xfs+'px');
  selectRect.setAttributeNS(null, 'width',  width+'px');
  if(!current_region.exportSVGconfig) { 
    //TODO: show popup of the selection location
    var msg = "selection "+(fe-fs+1)+"bp<br>"+current_region.chrom+" "+fs+".."+fe;
    selectRect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\""+msg+"\",170);");
    selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  createMagnifyRegionWidget(glyphTrack);
  createSelectionSequenceWidget(glyphTrack);
  createAnnotationWidget(glyphTrack);  //remove annotate feature for now
}


function gLyphsDrawThin(start, end, strand) {
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11 ' +end+',11 ');
  if(strand == '+') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: purple;'); }
  if(strand == '') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: dimgray;'); }
  return block;
}

function gLyphsDrawBar(pos, height, middle, strand) {
  //$g1->rectangle( x=>$x, width=>1, y=>(64-$y_up), height=>$y_up, style => { stroke=>'green', fill=>'green' } );
  //$g1->rectangle( x=>$x, width=>1, y=>65, height=>$y_down, style => { stroke=>'purple', fill=>'purple' } );

  var bar = document.createElementNS(svgNS,'rect');
  bar.setAttributeNS(null, 'x',      pos+'px');
  bar.setAttributeNS(null, 'width', '1px');
  bar.setAttributeNS(null, 'height', height+'px');
  if(strand == '+') { 
    bar.setAttributeNS(null, 'y', (middle-1-height)+'px');
    bar.setAttributeNS(null, 'style', 'fill: green;  stroke: green;'); 
  }
  if(strand == '-') { 
    bar.setAttributeNS(null, 'y', middle + 'px');
    bar.setAttributeNS(null, 'style', 'fill: purple; stroke: purple;'); 
  }
  if(strand == '') { 
    bar.setAttributeNS(null, 'y', (middle-1-height)+'px');
    bar.setAttributeNS(null, 'style', 'fill: rgb(0,0,230); stroke: blue;'); 
  }
  return bar;
}


function gLyphsInitColorSpaces() {
  colorSpaces = new Object();

  //first the brewer palette colors
  var brewer_palette = {"Spectral":  {3: ['rgb(252,141,89)', 'rgb(255,255,191)', 'rgb(153,213,148)'], 4: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(171,221,164)', 'rgb(43,131,186)'], 5: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(255,255,191)', 'rgb(171,221,164)', 'rgb(43,131,186)'], 6: ['rgb(213,62,79)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(230,245,152)', 'rgb(153,213,148)', 'rgb(50,136,189)'], 7: ['rgb(213,62,79)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(230,245,152)', 'rgb(153,213,148)', 'rgb(50,136,189)'], 8: ['rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)'], 9: ['rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)'], 10: ['rgb(158,1,66)', 'rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)', 'rgb(94,79,162)'], 11: ['rgb(158,1,66)', 'rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)', 'rgb(94,79,162)'], 'type': 'div'} ,
"RdYlGn":  {3: ['rgb(252,141,89)', 'rgb(255,255,191)', 'rgb(145,207,96)'], 4: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(166,217,106)', 'rgb(26,150,65)'], 5: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(255,255,191)', 'rgb(166,217,106)', 'rgb(26,150,65)'], 6: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(217,239,139)', 'rgb(145,207,96)', 'rgb(26,152,80)'], 7: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(217,239,139)', 'rgb(145,207,96)', 'rgb(26,152,80)'], 8: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)'], 9: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)'], 10: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)', 'rgb(0,104,55)'], 11: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)', 'rgb(0,104,55)'], 'type': 'div'} ,
"RdBu":  {3: ['rgb(239,138,98)', 'rgb(247,247,247)', 'rgb(103,169,207)'], 4: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(146,197,222)', 'rgb(5,113,176)'], 5: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(247,247,247)', 'rgb(146,197,222)', 'rgb(5,113,176)'], 6: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(209,229,240)', 'rgb(103,169,207)', 'rgb(33,102,172)'], 7: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(247,247,247)', 'rgb(209,229,240)', 'rgb(103,169,207)', 'rgb(33,102,172)'], 8: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)'], 9: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(247,247,247)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)'], 10: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)', 'rgb(5,48,97)'], 11: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(247,247,247)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)', 'rgb(5,48,97)'], 'type': 'div'} ,
"PiYG":  {3: ['rgb(233,163,201)', 'rgb(247,247,247)', 'rgb(161,215,106)'], 4: ['rgb(208,28,139)', 'rgb(241,182,218)', 'rgb(184,225,134)', 'rgb(77,172,38)'], 5: ['rgb(208,28,139)', 'rgb(241,182,218)', 'rgb(247,247,247)', 'rgb(184,225,134)', 'rgb(77,172,38)'], 6: ['rgb(197,27,125)', 'rgb(233,163,201)', 'rgb(253,224,239)', 'rgb(230,245,208)', 'rgb(161,215,106)', 'rgb(77,146,33)'], 7: ['rgb(197,27,125)', 'rgb(233,163,201)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(230,245,208)', 'rgb(161,215,106)', 'rgb(77,146,33)'], 8: ['rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)'], 9: ['rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)'], 10: ['rgb(142,1,82)', 'rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)', 'rgb(39,100,25)'], 11: ['rgb(142,1,82)', 'rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)', 'rgb(39,100,25)'], 'type': 'div'} ,
"PRGn":  {3: ['rgb(175,141,195)', 'rgb(247,247,247)', 'rgb(127,191,123)'], 4: ['rgb(123,50,148)', 'rgb(194,165,207)', 'rgb(166,219,160)', 'rgb(0,136,55)'], 5: ['rgb(123,50,148)', 'rgb(194,165,207)', 'rgb(247,247,247)', 'rgb(166,219,160)', 'rgb(0,136,55)'], 6: ['rgb(118,42,131)', 'rgb(175,141,195)', 'rgb(231,212,232)', 'rgb(217,240,211)', 'rgb(127,191,123)', 'rgb(27,120,55)'], 7: ['rgb(118,42,131)', 'rgb(175,141,195)', 'rgb(231,212,232)', 'rgb(247,247,247)', 'rgb(217,240,211)', 'rgb(127,191,123)', 'rgb(27,120,55)'], 8: ['rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)'], 9: ['rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(247,247,247)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)'], 10: ['rgb(64,0,75)', 'rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)', 'rgb(0,68,27)'], 11: ['rgb(64,0,75)', 'rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(247,247,247)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)', 'rgb(0,68,27)'], 'type': 'div'} ,
"RdYlBu":  {3: ['rgb(252,141,89)', 'rgb(255,255,191)', 'rgb(145,191,219)'], 4: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(171,217,233)', 'rgb(44,123,182)'], 5: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(255,255,191)', 'rgb(171,217,233)', 'rgb(44,123,182)'], 6: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,144)', 'rgb(224,243,248)', 'rgb(145,191,219)', 'rgb(69,117,180)'], 7: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,144)', 'rgb(255,255,191)', 'rgb(224,243,248)', 'rgb(145,191,219)', 'rgb(69,117,180)'], 8: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)'], 9: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(255,255,191)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)'], 10: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)', 'rgb(49,54,149)'], 11: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(255,255,191)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)', 'rgb(49,54,149)'], 'type': 'div'} ,
"BrBG":  {3: ['rgb(216,179,101)', 'rgb(245,245,245)', 'rgb(90,180,172)'], 4: ['rgb(166,97,26)', 'rgb(223,194,125)', 'rgb(128,205,193)', 'rgb(1,133,113)'], 5: ['rgb(166,97,26)', 'rgb(223,194,125)', 'rgb(245,245,245)', 'rgb(128,205,193)', 'rgb(1,133,113)'], 6: ['rgb(140,81,10)', 'rgb(216,179,101)', 'rgb(246,232,195)', 'rgb(199,234,229)', 'rgb(90,180,172)', 'rgb(1,102,94)'], 7: ['rgb(140,81,10)', 'rgb(216,179,101)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(90,180,172)', 'rgb(1,102,94)'], 8: ['rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)'], 9: ['rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)'], 10: ['rgb(84,48,5)', 'rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)', 'rgb(0,60,48)'], 11: ['rgb(84,48,5)', 'rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)', 'rgb(0,60,48)'], 'type': 'div'} ,
"RdGy":  {3: ['rgb(239,138,98)', 'rgb(255,255,255)', 'rgb(153,153,153)'], 4: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(186,186,186)', 'rgb(64,64,64)'], 5: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(255,255,255)', 'rgb(186,186,186)', 'rgb(64,64,64)'], 6: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(224,224,224)', 'rgb(153,153,153)', 'rgb(77,77,77)'], 7: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(255,255,255)', 'rgb(224,224,224)', 'rgb(153,153,153)', 'rgb(77,77,77)'], 8: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)'], 9: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(255,255,255)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)'], 10: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)', 'rgb(26,26,26)'], 11: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(255,255,255)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)', 'rgb(26,26,26)'], 'type': 'div'} ,
"PuOr":  {3: ['rgb(241,163,64)', 'rgb(247,247,247)', 'rgb(153,142,195)'], 4: ['rgb(230,97,1)', 'rgb(253,184,99)', 'rgb(178,171,210)', 'rgb(94,60,153)'], 5: ['rgb(230,97,1)', 'rgb(253,184,99)', 'rgb(247,247,247)', 'rgb(178,171,210)', 'rgb(94,60,153)'], 6: ['rgb(179,88,6)', 'rgb(241,163,64)', 'rgb(254,224,182)', 'rgb(216,218,235)', 'rgb(153,142,195)', 'rgb(84,39,136)'], 7: ['rgb(179,88,6)', 'rgb(241,163,64)', 'rgb(254,224,182)', 'rgb(247,247,247)', 'rgb(216,218,235)', 'rgb(153,142,195)', 'rgb(84,39,136)'], 8: ['rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)'], 9: ['rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(247,247,247)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)'], 10: ['rgb(127,59,8)', 'rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)', 'rgb(45,0,75)'], 11: ['rgb(127,59,8)', 'rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(247,247,247)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)', 'rgb(45,0,75)'], 'type': 'div'} ,

"Set2":  {3: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)'], 4: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)'], 5: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)'], 6: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)', 'rgb(255,217,47)'], 7: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)', 'rgb(255,217,47)', 'rgb(229,196,148)'], 8: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)', 'rgb(255,217,47)', 'rgb(229,196,148)', 'rgb(179,179,179)'], 'type': 'qual'} ,
"Accent":  {3: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)'], 4: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)'], 5: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)'], 6: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)', 'rgb(240,2,127)'], 7: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)', 'rgb(240,2,127)', 'rgb(191,91,23)'], 8: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)', 'rgb(240,2,127)', 'rgb(191,91,23)', 'rgb(102,102,102)'], 'type': 'qual'} ,
"Set1":  {3: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)'], 4: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)'], 5: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)'], 6: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)'], 7: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)'], 8: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)', 'rgb(247,129,191)'], 9: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)', 'rgb(247,129,191)', 'rgb(153,153,153)'], 'type': 'qual'} ,
"Set3":  {3: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)'], 4: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)'], 5: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)'], 6: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)'], 7: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)'], 8: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)'], 9: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)'], 10: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)', 'rgb(188,128,189)'], 11: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)', 'rgb(188,128,189)', 'rgb(204,235,197)'], 12: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)', 'rgb(188,128,189)', 'rgb(204,235,197)', 'rgb(255,237,111)'], 'type': 'qual'} ,
"Dark2":  {3: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)'], 4: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)'], 5: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)'], 6: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)', 'rgb(230,171,2)'], 7: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)', 'rgb(230,171,2)', 'rgb(166,118,29)'], 8: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)', 'rgb(230,171,2)', 'rgb(166,118,29)', 'rgb(102,102,102)'], 'type': 'qual'} ,
"Paired":  {3: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)'], 4: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)'], 5: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)'], 6: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)'], 7: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)'], 8: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)'], 9: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)'], 10: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)'], 11: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)', 'rgb(255,255,153)'], 12: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)', 'rgb(255,255,153)', 'rgb(177,89,40)'], 'type': 'qual'} ,
"Pastel2":  {3: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)'], 4: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)'], 5: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)'], 6: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)', 'rgb(255,242,174)'], 7: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)', 'rgb(255,242,174)', 'rgb(241,226,204)'], 8: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)', 'rgb(255,242,174)', 'rgb(241,226,204)', 'rgb(204,204,204)'], 'type': 'qual'} ,
"Pastel1":  {3: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)'], 4: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)'], 5: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)'], 6: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)'], 7: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)', 'rgb(229,216,189)'], 8: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)', 'rgb(229,216,189)', 'rgb(253,218,236)'], 9: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)', 'rgb(229,216,189)', 'rgb(253,218,236)', 'rgb(242,242,242)'], 'type': 'qual'} ,

"OrRd":  {3: ['rgb(254,232,200)', 'rgb(253,187,132)', 'rgb(227,74,51)'], 4: ['rgb(254,240,217)', 'rgb(253,204,138)', 'rgb(252,141,89)', 'rgb(215,48,31)'], 5: ['rgb(254,240,217)', 'rgb(253,204,138)', 'rgb(252,141,89)', 'rgb(227,74,51)', 'rgb(179,0,0)'], 6: ['rgb(254,240,217)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(227,74,51)', 'rgb(179,0,0)'], 7: ['rgb(254,240,217)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(239,101,72)', 'rgb(215,48,31)', 'rgb(153,0,0)'], 8: ['rgb(255,247,236)', 'rgb(254,232,200)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(239,101,72)', 'rgb(215,48,31)', 'rgb(153,0,0)'], 9: ['rgb(255,247,236)', 'rgb(254,232,200)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(239,101,72)', 'rgb(215,48,31)', 'rgb(179,0,0)', 'rgb(127,0,0)'], 'type': 'seq'} ,
"PuBu":  {3: ['rgb(236,231,242)', 'rgb(166,189,219)', 'rgb(43,140,190)'], 4: ['rgb(241,238,246)', 'rgb(189,201,225)', 'rgb(116,169,207)', 'rgb(5,112,176)'], 5: ['rgb(241,238,246)', 'rgb(189,201,225)', 'rgb(116,169,207)', 'rgb(43,140,190)', 'rgb(4,90,141)'], 6: ['rgb(241,238,246)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(43,140,190)', 'rgb(4,90,141)'], 7: ['rgb(241,238,246)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(54,144,192)', 'rgb(5,112,176)', 'rgb(3,78,123)'], 8: ['rgb(255,247,251)', 'rgb(236,231,242)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(54,144,192)', 'rgb(5,112,176)', 'rgb(3,78,123)'], 9: ['rgb(255,247,251)', 'rgb(236,231,242)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(54,144,192)', 'rgb(5,112,176)', 'rgb(4,90,141)', 'rgb(2,56,88)'], 'type': 'seq'} ,
"BuPu":  {3: ['rgb(224,236,244)', 'rgb(158,188,218)', 'rgb(136,86,167)'], 4: ['rgb(237,248,251)', 'rgb(179,205,227)', 'rgb(140,150,198)', 'rgb(136,65,157)'], 5: ['rgb(237,248,251)', 'rgb(179,205,227)', 'rgb(140,150,198)', 'rgb(136,86,167)', 'rgb(129,15,124)'], 6: ['rgb(237,248,251)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(136,86,167)', 'rgb(129,15,124)'], 7: ['rgb(237,248,251)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(140,107,177)', 'rgb(136,65,157)', 'rgb(110,1,107)'], 8: ['rgb(247,252,253)', 'rgb(224,236,244)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(140,107,177)', 'rgb(136,65,157)', 'rgb(110,1,107)'], 9: ['rgb(247,252,253)', 'rgb(224,236,244)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(140,107,177)', 'rgb(136,65,157)', 'rgb(129,15,124)', 'rgb(77,0,75)'], 'type': 'seq'} ,
"Oranges":  {3: ['rgb(254,230,206)', 'rgb(253,174,107)', 'rgb(230,85,13)'], 4: ['rgb(254,237,222)', 'rgb(253,190,133)', 'rgb(253,141,60)', 'rgb(217,71,1)'], 5: ['rgb(254,237,222)', 'rgb(253,190,133)', 'rgb(253,141,60)', 'rgb(230,85,13)', 'rgb(166,54,3)'], 6: ['rgb(254,237,222)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(230,85,13)', 'rgb(166,54,3)'], 7: ['rgb(254,237,222)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(241,105,19)', 'rgb(217,72,1)', 'rgb(140,45,4)'], 8: ['rgb(255,245,235)', 'rgb(254,230,206)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(241,105,19)', 'rgb(217,72,1)', 'rgb(140,45,4)'], 9: ['rgb(255,245,235)', 'rgb(254,230,206)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(241,105,19)', 'rgb(217,72,1)', 'rgb(166,54,3)', 'rgb(127,39,4)'], 'type': 'seq'} ,
"BuGn":  {3: ['rgb(229,245,249)', 'rgb(153,216,201)', 'rgb(44,162,95)'], 4: ['rgb(237,248,251)', 'rgb(178,226,226)', 'rgb(102,194,164)', 'rgb(35,139,69)'], 5: ['rgb(237,248,251)', 'rgb(178,226,226)', 'rgb(102,194,164)', 'rgb(44,162,95)', 'rgb(0,109,44)'], 6: ['rgb(237,248,251)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(44,162,95)', 'rgb(0,109,44)'], 7: ['rgb(237,248,251)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(65,174,118)', 'rgb(35,139,69)', 'rgb(0,88,36)'], 8: ['rgb(247,252,253)', 'rgb(229,245,249)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(65,174,118)', 'rgb(35,139,69)', 'rgb(0,88,36)'], 9: ['rgb(247,252,253)', 'rgb(229,245,249)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(65,174,118)', 'rgb(35,139,69)', 'rgb(0,109,44)', 'rgb(0,68,27)'], 'type': 'seq'} ,
"YlOrBr":  {3: ['rgb(255,247,188)', 'rgb(254,196,79)', 'rgb(217,95,14)'], 4: ['rgb(255,255,212)', 'rgb(254,217,142)', 'rgb(254,153,41)', 'rgb(204,76,2)'], 5: ['rgb(255,255,212)', 'rgb(254,217,142)', 'rgb(254,153,41)', 'rgb(217,95,14)', 'rgb(153,52,4)'], 6: ['rgb(255,255,212)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(217,95,14)', 'rgb(153,52,4)'], 7: ['rgb(255,255,212)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(236,112,20)', 'rgb(204,76,2)', 'rgb(140,45,4)'], 8: ['rgb(255,255,229)', 'rgb(255,247,188)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(236,112,20)', 'rgb(204,76,2)', 'rgb(140,45,4)'], 9: ['rgb(255,255,229)', 'rgb(255,247,188)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(236,112,20)', 'rgb(204,76,2)', 'rgb(153,52,4)', 'rgb(102,37,6)'], 'type': 'seq'} ,
"YlGn":  {3: ['rgb(247,252,185)', 'rgb(173,221,142)', 'rgb(49,163,84)'], 4: ['rgb(255,255,204)', 'rgb(194,230,153)', 'rgb(120,198,121)', 'rgb(35,132,67)'], 5: ['rgb(255,255,204)', 'rgb(194,230,153)', 'rgb(120,198,121)', 'rgb(49,163,84)', 'rgb(0,104,55)'], 6: ['rgb(255,255,204)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(49,163,84)', 'rgb(0,104,55)'], 7: ['rgb(255,255,204)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,90,50)'], 8: ['rgb(255,255,229)', 'rgb(247,252,185)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,90,50)'], 9: ['rgb(255,255,229)', 'rgb(247,252,185)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,104,55)', 'rgb(0,69,41)'], 'type': 'seq'} ,
"Reds":  {3: ['rgb(254,224,210)', 'rgb(252,146,114)', 'rgb(222,45,38)'], 4: ['rgb(254,229,217)', 'rgb(252,174,145)', 'rgb(251,106,74)', 'rgb(203,24,29)'], 5: ['rgb(254,229,217)', 'rgb(252,174,145)', 'rgb(251,106,74)', 'rgb(222,45,38)', 'rgb(165,15,21)'], 6: ['rgb(254,229,217)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(222,45,38)', 'rgb(165,15,21)'], 7: ['rgb(254,229,217)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(153,0,13)'], 8: ['rgb(255,245,240)', 'rgb(254,224,210)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(153,0,13)'], 9: ['rgb(255,245,240)', 'rgb(254,224,210)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(165,15,21)', 'rgb(103,0,13)'], 'type': 'seq'} ,
"RdPu":  {3: ['rgb(253,224,221)', 'rgb(250,159,181)', 'rgb(197,27,138)'], 4: ['rgb(254,235,226)', 'rgb(251,180,185)', 'rgb(247,104,161)', 'rgb(174,1,126)'], 5: ['rgb(254,235,226)', 'rgb(251,180,185)', 'rgb(247,104,161)', 'rgb(197,27,138)', 'rgb(122,1,119)'], 6: ['rgb(254,235,226)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(197,27,138)', 'rgb(122,1,119)'], 7: ['rgb(254,235,226)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(221,52,151)', 'rgb(174,1,126)', 'rgb(122,1,119)'], 8: ['rgb(255,247,243)', 'rgb(253,224,221)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(221,52,151)', 'rgb(174,1,126)', 'rgb(122,1,119)'], 9: ['rgb(255,247,243)', 'rgb(253,224,221)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(221,52,151)', 'rgb(174,1,126)', 'rgb(122,1,119)', 'rgb(73,0,106)'], 'type': 'seq'} ,
"Greens":  {3: ['rgb(229,245,224)', 'rgb(161,217,155)', 'rgb(49,163,84)'], 4: ['rgb(237,248,233)', 'rgb(186,228,179)', 'rgb(116,196,118)', 'rgb(35,139,69)'], 5: ['rgb(237,248,233)', 'rgb(186,228,179)', 'rgb(116,196,118)', 'rgb(49,163,84)', 'rgb(0,109,44)'], 6: ['rgb(237,248,233)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(49,163,84)', 'rgb(0,109,44)'], 7: ['rgb(237,248,233)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(65,171,93)', 'rgb(35,139,69)', 'rgb(0,90,50)'], 8: ['rgb(247,252,245)', 'rgb(229,245,224)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(65,171,93)', 'rgb(35,139,69)', 'rgb(0,90,50)'], 9: ['rgb(247,252,245)', 'rgb(229,245,224)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(65,171,93)', 'rgb(35,139,69)', 'rgb(0,109,44)', 'rgb(0,68,27)'], 'type': 'seq'} ,
"YlGnBu":  {3: ['rgb(237,248,177)', 'rgb(127,205,187)', 'rgb(44,127,184)'], 4: ['rgb(255,255,204)', 'rgb(161,218,180)', 'rgb(65,182,196)', 'rgb(34,94,168)'], 5: ['rgb(255,255,204)', 'rgb(161,218,180)', 'rgb(65,182,196)', 'rgb(44,127,184)', 'rgb(37,52,148)'], 6: ['rgb(255,255,204)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(44,127,184)', 'rgb(37,52,148)'], 7: ['rgb(255,255,204)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(29,145,192)', 'rgb(34,94,168)', 'rgb(12,44,132)'], 8: ['rgb(255,255,217)', 'rgb(237,248,177)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(29,145,192)', 'rgb(34,94,168)', 'rgb(12,44,132)'], 9: ['rgb(255,255,217)', 'rgb(237,248,177)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(29,145,192)', 'rgb(34,94,168)', 'rgb(37,52,148)', 'rgb(8,29,88)'], 'type': 'seq'} ,
"Purples":  {3: ['rgb(239,237,245)', 'rgb(188,189,220)', 'rgb(117,107,177)'], 4: ['rgb(242,240,247)', 'rgb(203,201,226)', 'rgb(158,154,200)', 'rgb(106,81,163)'], 5: ['rgb(242,240,247)', 'rgb(203,201,226)', 'rgb(158,154,200)', 'rgb(117,107,177)', 'rgb(84,39,143)'], 6: ['rgb(242,240,247)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(117,107,177)', 'rgb(84,39,143)'], 7: ['rgb(242,240,247)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(128,125,186)', 'rgb(106,81,163)', 'rgb(74,20,134)'], 8: ['rgb(252,251,253)', 'rgb(239,237,245)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(128,125,186)', 'rgb(106,81,163)', 'rgb(74,20,134)'], 9: ['rgb(252,251,253)', 'rgb(239,237,245)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(128,125,186)', 'rgb(106,81,163)', 'rgb(84,39,143)', 'rgb(63,0,125)'], 'type': 'seq'} ,
"GnBu":  {3: ['rgb(224,243,219)', 'rgb(168,221,181)', 'rgb(67,162,202)'], 4: ['rgb(240,249,232)', 'rgb(186,228,188)', 'rgb(123,204,196)', 'rgb(43,140,190)'], 5: ['rgb(240,249,232)', 'rgb(186,228,188)', 'rgb(123,204,196)', 'rgb(67,162,202)', 'rgb(8,104,172)'], 6: ['rgb(240,249,232)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(67,162,202)', 'rgb(8,104,172)'], 7: ['rgb(240,249,232)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(78,179,211)', 'rgb(43,140,190)', 'rgb(8,88,158)'], 8: ['rgb(247,252,240)', 'rgb(224,243,219)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(78,179,211)', 'rgb(43,140,190)', 'rgb(8,88,158)'], 9: ['rgb(247,252,240)', 'rgb(224,243,219)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(78,179,211)', 'rgb(43,140,190)', 'rgb(8,104,172)', 'rgb(8,64,129)'], 'type': 'seq'} ,
"Greys":  {3: ['rgb(240,240,240)', 'rgb(189,189,189)', 'rgb(99,99,99)'], 4: ['rgb(247,247,247)', 'rgb(204,204,204)', 'rgb(150,150,150)', 'rgb(82,82,82)'], 5: ['rgb(247,247,247)', 'rgb(204,204,204)', 'rgb(150,150,150)', 'rgb(99,99,99)', 'rgb(37,37,37)'], 6: ['rgb(247,247,247)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(99,99,99)', 'rgb(37,37,37)'], 7: ['rgb(247,247,247)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(115,115,115)', 'rgb(82,82,82)', 'rgb(37,37,37)'], 8: ['rgb(255,255,255)', 'rgb(240,240,240)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(115,115,115)', 'rgb(82,82,82)', 'rgb(37,37,37)'], 9: ['rgb(255,255,255)', 'rgb(240,240,240)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(115,115,115)', 'rgb(82,82,82)', 'rgb(37,37,37)', 'rgb(0,0,0)'], 'type': 'seq'} ,
"YlOrRd":  {3: ['rgb(255,237,160)', 'rgb(254,178,76)', 'rgb(240,59,32)'], 4: ['rgb(255,255,178)', 'rgb(254,204,92)', 'rgb(253,141,60)', 'rgb(227,26,28)'], 5: ['rgb(255,255,178)', 'rgb(254,204,92)', 'rgb(253,141,60)', 'rgb(240,59,32)', 'rgb(189,0,38)'], 6: ['rgb(255,255,178)', 'rgb(254,217,118)', 'rgb(254,178,76)', 'rgb(253,141,60)', 'rgb(240,59,32)', 'rgb(189,0,38)'], 7: ['rgb(255,255,178)', 'rgb(254,217,118)', 'rgb(254,178,76)', 'rgb(253,141,60)', 'rgb(252,78,42)', 'rgb(227,26,28)', 'rgb(177,0,38)'], 8: ['rgb(255,255,204)', 'rgb(255,237,160)', 'rgb(254,217,118)', 'rgb(254,178,76)', 'rgb(253,141,60)', 'rgb(252,78,42)', 'rgb(227,26,28)', 'rgb(177,0,38)'], 'type': 'seq'} ,
"PuRd":  {3: ['rgb(231,225,239)', 'rgb(201,148,199)', 'rgb(221,28,119)'], 4: ['rgb(241,238,246)', 'rgb(215,181,216)', 'rgb(223,101,176)', 'rgb(206,18,86)'], 5: ['rgb(241,238,246)', 'rgb(215,181,216)', 'rgb(223,101,176)', 'rgb(221,28,119)', 'rgb(152,0,67)'], 6: ['rgb(241,238,246)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(221,28,119)', 'rgb(152,0,67)'], 7: ['rgb(241,238,246)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(231,41,138)', 'rgb(206,18,86)', 'rgb(145,0,63)'], 8: ['rgb(247,244,249)', 'rgb(231,225,239)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(231,41,138)', 'rgb(206,18,86)', 'rgb(145,0,63)'], 9: ['rgb(247,244,249)', 'rgb(231,225,239)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(231,41,138)', 'rgb(206,18,86)', 'rgb(152,0,67)', 'rgb(103,0,31)'], 'type': 'seq'} ,
"Blues":  {3: ['rgb(222,235,247)', 'rgb(158,202,225)', 'rgb(49,130,189)'], 4: ['rgb(239,243,255)', 'rgb(189,215,231)', 'rgb(107,174,214)', 'rgb(33,113,181)'], 5: ['rgb(239,243,255)', 'rgb(189,215,231)', 'rgb(107,174,214)', 'rgb(49,130,189)', 'rgb(8,81,156)'], 6: ['rgb(239,243,255)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(49,130,189)', 'rgb(8,81,156)'], 7: ['rgb(239,243,255)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(66,146,198)', 'rgb(33,113,181)', 'rgb(8,69,148)'], 8: ['rgb(247,251,255)', 'rgb(222,235,247)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(66,146,198)', 'rgb(33,113,181)', 'rgb(8,69,148)'], 9: ['rgb(247,251,255)', 'rgb(222,235,247)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(66,146,198)', 'rgb(33,113,181)', 'rgb(8,81,156)', 'rgb(8,48,107)'], 'type': 'seq'} ,
"PuBuGn":  {3: ['rgb(236,226,240)', 'rgb(166,189,219)', 'rgb(28,144,153)'], 4: ['rgb(246,239,247)', 'rgb(189,201,225)', 'rgb(103,169,207)', 'rgb(2,129,138)'], 5: ['rgb(246,239,247)', 'rgb(189,201,225)', 'rgb(103,169,207)', 'rgb(28,144,153)', 'rgb(1,108,89)'], 6: ['rgb(246,239,247)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(28,144,153)', 'rgb(1,108,89)'], 7: ['rgb(246,239,247)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(54,144,192)', 'rgb(2,129,138)', 'rgb(1,100,80)'], 8: ['rgb(255,247,251)', 'rgb(236,226,240)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(54,144,192)', 'rgb(2,129,138)', 'rgb(1,100,80)'], 9: ['rgb(255,247,251)', 'rgb(236,226,240)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(54,144,192)', 'rgb(2,129,138)', 'rgb(1,108,89)', 'rgb(1,70,54)'], 'type': 'seq'} 
};

  for(var bpname in brewer_palette) {
    var bp1 = brewer_palette[bpname];
    var bptype = bp1["type"];
    if(bptype == "seq")  { bptype = "brewer-sequential"; }
    if(bptype == "qual") { bptype = "brewer-qualitative"; }
    if(bptype == "div")  { bptype = "brewer-diverging"; }
    for(var bpdepth in bp1) {
      if(bpdepth == "type") { continue; }
      var bpcolor = new Object();
      bpcolor.name = bpname + "_bp_" + bpdepth;
      bpcolor.discrete = true;
      bpcolor.colorcat = bptype;
      bpcolor.bpdepth = bpdepth;
      bpcolor.colors = new Array();
      //transfer colors
      var bp_rgbs = bp1[bpdepth];
      for(var j=0; j<bp_rgbs.length; j++) {
        var rgb1 = bp_rgbs[j];
        rgb1 = rgb1.replace("rgb(", "");
        rgb1 = rgb1.replace(")", "");
        var rgb2 = rgb1.split(",");
        //if(bpname == "PuBuGn" && bpdepth=="9") { document.getElementById("message").innerHTML += " "+rgb1; } 
        bpcolor.colors.push(new RGBColour(rgb2[0], rgb2[1], rgb2[2]));   //orange
      }

      colorSpaces[bpcolor.name] = bpcolor;
    }
  }

  // strandcolor
  var tcolor = new Object();
  tcolor.name = "sense-color";
  tcolor.discrete = false;
  tcolor.colorcat = "zenbu-spectrum";
  tcolor.bpdepth = "";
  tcolor.log = false;
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
  tcolor.colors.push(new RGBColour(0, 0, 0));       //black
  colorSpaces[tcolor.name] = tcolor;

  // fire1
  var fire1 = new Object();
  fire1.name = "fire1";
  fire1.discrete = false;
  fire1.colorcat = "zenbu-spectrum";
  fire1.bpdepth = "";
  fire1.colors = new Array();
  fire1.colors.push(new RGBColour(220, 220, 220)); //gray
  fire1.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  fire1.colors.push(new RGBColour(255, 153, 0));   //orange
  fire1.colors.push(new RGBColour(255, 0, 0));     //red
  colorSpaces[fire1.name] = fire1;

  // fire2
  var fire2 = new Object();
  fire2.name = "fire2";
  fire2.discrete = false;
  fire2.colorcat = "zenbu-spectrum";
  fire2.bpdepth = "";
  fire2.colors = new Array();
  fire2.colors.push(new RGBColour(220, 220, 220)); //gray
  fire2.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  fire2.colors.push(new RGBColour(255, 153, 0));   //orange
  fire2.colors.push(new RGBColour(255, 0, 0));     //red
  fire2.colors.push(new RGBColour(70, 0, 0));     //black-red
  colorSpaces[fire2.name] = fire2;

  // fire3
  var fire3 = new Object();
  fire3.name = "fire3";
  fire3.discrete = false;
  fire3.colorcat = "zenbu-spectrum";
  fire3.bpdepth = "";
  fire3.colors = new Array();
  fire3.colors.push(new RGBColour(0, 0, 0));       //black
  fire3.colors.push(new RGBColour(255, 0, 0));     //red
  fire3.colors.push(new RGBColour(255, 153, 0));   //orange
  fire3.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  fire3.colors.push(new RGBColour(220, 220, 220)); //gray
  colorSpaces[fire3.name] = fire3;

  // rainbow
  var rainbow = new Object();
  rainbow.name = "rainbow";
  rainbow.discrete = false;
  rainbow.colorcat = "zenbu-spectrum";
  rainbow.bpdepth = "";
  rainbow.colors = new Array();
  rainbow.colors.push(new RGBColour(255, 0, 255));   //purple
  rainbow.colors.push(new RGBColour(0, 0, 200));     //blue
  rainbow.colors.push(new RGBColour(0, 255, 255));   //cyan
  rainbow.colors.push(new RGBColour(0, 220, 0));     //green
  rainbow.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  rainbow.colors.push(new RGBColour(255, 153, 0));   //orange
  rainbow.colors.push(new RGBColour(255, 0, 0));     //red
  colorSpaces[rainbow.name] = rainbow;

  // rainbow2
  var rainbow = new Object();
  rainbow.name = "rainbow2";
  rainbow.discrete = false;
  rainbow.colorcat = "zenbu-spectrum";
  rainbow.bpdepth = "";
  rainbow.colors = new Array();
  rainbow.colors.push(new RGBColour(255, 0, 0));     //red
  rainbow.colors.push(new RGBColour(255, 153, 0));   //orange
  rainbow.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  rainbow.colors.push(new RGBColour(0, 220, 0));     //green
  rainbow.colors.push(new RGBColour(0, 255, 255));   //cyan
  rainbow.colors.push(new RGBColour(0, 0, 200));     //blue
  rainbow.colors.push(new RGBColour(255, 0, 255));   //purple
  colorSpaces[rainbow.name] = rainbow;

  // chakra
  var rainbow = new Object();
  rainbow.name = "chakra";
  rainbow.discrete = false;
  rainbow.colorcat = "zenbu-spectrum";
  rainbow.bpdepth = "";
  rainbow.colors = new Array();
  rainbow.colors.push(new RGBColour(220, 20, 60));   //red crimson
  rainbow.colors.push(new RGBColour(255, 153, 0));   //orange
  //rainbow.colors.push(new RGBColour(255, 255, 51));  //yellow 
  rainbow.colors.push(new RGBColour(255, 215, 0));  //gold 
  rainbow.colors.push(new RGBColour(0, 200, 0));     //green
  rainbow.colors.push(new RGBColour(30, 144, 255));  //dodger blue
  rainbow.colors.push(new RGBColour(112, 0, 195));    //indigo
  rainbow.colors.push(new RGBColour(218, 112, 214)); //violet/orchid
  colorSpaces[rainbow.name] = rainbow;

  // middle-heat
  var spec = new Object();
  spec.name = "middle-heat";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  colorSpaces[spec.name] = spec;

  // gray1
  var gray1 = new Object();
  gray1.name = "gray1";
  gray1.discrete = false;
  gray1.colorcat = "zenbu-spectrum";
  gray1.bpdepth = "";
  gray1.colors = new Array();
  gray1.colors.push(new RGBColour(220, 220, 220)); //gray
  gray1.colors.push(new RGBColour(0, 0, 0));       //black
  colorSpaces[gray1.name] = gray1;

  // blue1
  var blue1 = new Object();
  blue1.name = "blue1";
  blue1.discrete = false;
  blue1.colorcat = "zenbu-spectrum";
  blue1.bpdepth = "";
  blue1.colors = new Array();
  blue1.colors.push(new RGBColour(240, 240, 240)); //gray
  blue1.colors.push(new RGBColour(0, 0, 245));     //blue
  colorSpaces[blue1.name] = blue1;

  // blue2
  var blue2 = new Object();
  blue2.name = "blue2";
  blue2.discrete = false;
  blue2.colorcat = "zenbu-spectrum";
  blue2.bpdepth = "";
  blue2.log = true;
  blue2.colors = new Array();
  blue2.colors.push(new RGBColour(240, 240, 240)); //gray
  blue2.colors.push(new RGBColour(0, 0, 245));     //blue
  colorSpaces[blue2.name] = blue2;

  // pink1
  var pink1 = new Object();
  pink1.name = "pink1";
  pink1.discrete = false;
  pink1.colorcat = "zenbu-spectrum";
  pink1.bpdepth = "";
  pink1.colors = new Array();
  pink1.colors.push(new RGBColour(255, 230, 255));  //pale pink
  pink1.colors.push(new RGBColour(255, 20, 147));   //deep pink
  colorSpaces[pink1.name] = pink1;

  // orange1
  var orange1 = new Object();
  orange1.name = "orange1";
  orange1.discrete = false;
  orange1.colorcat = "zenbu-spectrum";
  orange1.bpdepth = "";
  orange1.colors = new Array();
  orange1.colors.push(new RGBColour(240, 240, 240)); //gray
  orange1.colors.push(new RGBColour(255, 100, 0));   //orange
  colorSpaces[orange1.name] = orange1;

  // orange2
  var orange2 = new Object();
  orange2.name = "orange2";
  orange2.discrete = false;
  orange2.colorcat = "zenbu-spectrum";
  orange2.bpdepth = "";
  orange2.log = true;
  orange2.colors = new Array();
  orange2.colors.push(new RGBColour(240, 240, 240)); //gray
  orange2.colors.push(new RGBColour(255, 100, 0));   //orange
  colorSpaces[orange2.name] = orange2;
}


function gLyphsScoreColorSpace(colorname, score, discrete, logscale) {
  //score is from 0.0 to 1.0
  // function returns an RGBColour object
  if(score < 0)   { score = 0; }
  if(score > 1.0) { score = 1.0; }

  var colorSpc = colorSpaces[colorname];
  if(!colorSpc) { return new RGBColour(0, 0, 0); } //return black if name error

  //document.getElementById("message").innerHTML= "colorspace: " + colorSpc.colors.length;
  if(colorSpc.log) { logscale = true; }
  if(logscale) {
    score = Math.log(score*100 + 1) / Math.log(100+1);
  }

  if(colorSpc.discrete) { discrete = true; }
  if(discrete) { 
    var ci = score * (colorSpc.colors.length);
    var idx = Math.floor(ci);
    if(idx == colorSpc.colors.length) { idx = colorSpc.colors.length - 1; }
    var color1 = colorSpc.colors[idx];
    if(!color1) { return new RGBColour(0, 0, 0); }
    return color1
  }

  var ci = score * (colorSpc.colors.length - 1);
  var idx = Math.floor(ci);
  var cr = ci - idx;
  //document.getElementById("message").innerHTML += "ci: " + ci;
  //document.getElementById("message").innerHTML += " ["+score+"] "+idx;

  var color1 = colorSpc.colors[idx];
  var color2 = colorSpc.colors[idx+1];
  if(!color1) { return new RGBColour(0, 0, 0); }
  if(!color2) { return color1; }

  if(discrete) { if(cr<=0.5) {return color1;} else {return color2;} }

  var c1 = color1.getRGB();
  var c2 = color2.getRGB();
 
  var r  = c1.r + cr * (c2.r - c1.r);
  var g  = c1.g + cr * (c2.g - c1.g);
  var b  = c1.b + cr * (c2.b - c1.b);

  var color = new RGBColour(r, g, b);
  return color;
}

function gLyphsScoreColorSpace2(glyphTrack, score, strand) {
  var colorspace = glyphTrack.colorspace;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.colorspace !== undefined)) { colorspace = glyphTrack.newconfig.colorspace; }
  if(!colorspace) { colorspace = "fire1"; }

  var discrete = glyphTrack.colorspace_discrete;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.colorspace_discrete !== undefined)) { discrete = glyphTrack.newconfig.colorspace_discrete; }
  if(!discrete) { discrete = colorSpaces[colorspace].discrete; }

  var logscale = glyphTrack.logscale;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.logscale !== undefined)) { logscale = glyphTrack.newconfig.logscale; }

  //if in "sense-color" mode need to get the current posStrandColor and make new spectrum
  if(colorspace == "sense-color") {
    var tcolor = colorSpaces[colorspace];
    if((!current_region.flip_orientation && (strand == "-")) || (current_region.flip_orientation && (strand == "+"))) {
      //anti-sense colors
      var cl2 = new RGBColor(glyphTrack.revStrandColor);
      if(glyphTrack.newconfig && glyphTrack.newconfig.revStrandColor) { cl2 = new RGBColor(glyphTrack.newconfig.revStrandColor); }
      tcolor.colors[1] = new RGBColour(cl2.r, cl2.g, cl2.b);
    } else {
      //sense colors
      var cl1 = new RGBColor(glyphTrack.posStrandColor);
      if(glyphTrack.newconfig && glyphTrack.newconfig.posStrandColor) { cl1 = new RGBColor(glyphTrack.newconfig.posStrandColor); }
      tcolor.colors[1] = new RGBColour(cl1.r, cl1.g, cl1.b);
    }
  }

  return gLyphsScoreColorSpace(colorspace, score, discrete, logscale);
}


function gLyphsMakeColorGradient(glyphTrack) {
  var len = 47;

  var colorspace = glyphTrack.colorspace;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.colorspace !== undefined)) { colorspace = glyphTrack.newconfig.colorspace; }
  if(!colorspace) { colorspace = "fire1"; }

  var discrete = glyphTrack.colorspace_discrete;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.colorspace_discrete !== undefined)) { discrete = glyphTrack.newconfig.colorspace_discrete; }
  if(!discrete) { discrete = colorSpaces[colorspace].discrete; }

  var logscale = glyphTrack.logscale;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.logscale !== undefined)) { logscale = glyphTrack.newconfig.logscale; }

  //if in "sense-color" mode need to get the current posStrandColor and make new spectrum
  if(colorspace == "sense-color") {
    var tcolor = colorSpaces[colorspace];

    //sense and anti-sense colors
    tcolor.colors = new Array();
    tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
    var cl1 = new RGBColor(glyphTrack.posStrandColor);
    if(glyphTrack.newconfig && glyphTrack.newconfig.posStrandColor) { cl1 = new RGBColor(glyphTrack.newconfig.posStrandColor); }
    tcolor.colors.push(new RGBColour(cl1.r, cl1.g, cl1.b)); //sense color

    //anti-sense colors
    tcolor.colors2 = new Array();
    tcolor.colors2.push(new RGBColour(240, 240, 240)); //gray
    var cl2 = new RGBColor(glyphTrack.revStrandColor);
    if(glyphTrack.newconfig && glyphTrack.newconfig.revStrandColor) { cl2 = new RGBColor(glyphTrack.newconfig.revStrandColor); }
    tcolor.colors2.push(new RGBColour(cl2.r, cl2.g, cl2.b));
  }

  var span1 = document.createElement('span');
  span1.setAttribute("style", "margin: 0px 0px 0px 10px;");
  for (var i = 0; i <= len; ++i) {
    var score = i / len;
    var color = gLyphsScoreColorSpace(colorspace, score, discrete, logscale);
    var font1 = span1.appendChild(document.createElement('font'));
    font1.setAttribute("color", color.getCSSHexadecimalRGB());
    font1.innerHTML ="&#9608;";
  }
  return span1;
} 


function gLyphsColorSpaceOptions(glyphTrack) {
  var div1 = document.createElement('div');

  var span1 = div1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "margin: 0px 0px 0px 7px;");
  span1.appendChild(document.createTextNode("color options:"));

  var colorspace = glyphTrack.colorspace;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.colorspace !== undefined)) { colorspace = glyphTrack.newconfig.colorspace; }
  if(!colorspace) { 
    colorspace = "fire1";
    glyphTrack.newconfig.colorspace = "fire1";
  }
  var colorcat = "zenbu-spectrum";
  var colordepth = "";
  if(colorspace.match(/_bp_/)) { 
    var colorSpc = colorSpaces[colorspace];
    if(colorSpc) {
      colorcat = colorSpc.colorcat;

      var idx1 = colorspace.indexOf('_bp_');
      if(idx1 > 0) { colordepth = colorspace.substr(idx1+4); }
    }
  }
  var discrete = glyphTrack.colorspace_discrete;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.colorspace_discrete !== undefined)) { discrete = glyphTrack.newconfig.colorspace_discrete; }
  if(!discrete) { discrete = colorSpaces[colorspace].discrete; }

  //first colorspace_category
  var select = div1.appendChild(document.createElement('select'));    
  select.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'colorspace_category', this.value);");
  var ccats = ["brewer-sequential", "brewer-diverging", "brewer-qualitative", "zenbu-spectrum"];
  for(var i=0; i<ccats.length; i++) {
    var ccat = ccats[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", ccat);
    if(ccat == colorcat) { option.setAttribute("selected", "selected"); }
    option.innerHTML = ccat;
  }

  //second color depth for brewer palettes
  var span2 = div1.appendChild(document.createElement('span'));
  if(colorcat == "zenbu-spectrum") { span2.setAttribute("style", "display:none"); }
  var select = span2.appendChild(document.createElement('select'));
  select.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'colorspace_depth', this.value);");
  var cdepths = ['3','4','5','6','7','8','9','10','11','12'];
  for(var i=0; i<cdepths.length; i++) {
    var cdepth = cdepths[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", cdepth);
    if(cdepth == colordepth) { option.setAttribute("selected", "selected"); }
    option.innerHTML = cdepth;
  }

  //third the actual colorspace name
  var select = div1.appendChild(document.createElement('select'));    
  select.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'colorspace', this.value);");
  for(var csname in colorSpaces){
    var colorSpc = colorSpaces[csname];
    if(colorSpc.colorcat != colorcat) { continue; }
    if(colorSpc.bpdepth != colordepth) { continue; }
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", csname);
    if(csname == colorspace) { option.setAttribute("selected", "selected"); }

    var dname = csname;
    var idx1 = dname.indexOf('_bp_');
    if(idx1 > 0) { dname = dname.substr(0, idx1); }
    option.innerHTML = dname;
  }

  //next line draw the color spectrum
  var div2 = div1.appendChild(document.createElement('div'));
  div2.appendChild(gLyphsMakeColorGradient(glyphTrack));

  var logscale = glyphTrack.logscale;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.logscale !== undefined)) { logscale = glyphTrack.newconfig.logscale; }

  var span2 = div2.appendChild(document.createElement('span'));
  var logCheck = span2.appendChild(document.createElement('input'));
  logCheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  logCheck.setAttribute('type', "checkbox");
  if(logscale) { logCheck.setAttribute('checked', "checked"); }
  logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'colorspace_logscale', this.checked);");
  var span1 = span2.appendChild(document.createElement('span'));
  span1.innerHTML = "log scale";

  //a scaling value input
  var div2 = div1.appendChild(document.createElement('div'));
  div2.setAttribute('style', "margin: 0px 1px 0px 7px;");
  var span4 = div2.appendChild(document.createElement('span'));
  //span4.setAttribute('style', "margin-left: 3px;");
  span4.innerHTML = "min signal: ";
  var levelInput = div2.appendChild(document.createElement('input'));
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  levelInput.setAttribute('size', "5");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', glyphTrack.scale_min_signal);
  levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'scale_min_signal', this.value);");
  
  var span4 = div2.appendChild(document.createElement('span'));
  span4.setAttribute('style', "margin-left: 3px;");
  span4.innerHTML = "max signal: ";
  var levelInput = div2.appendChild(document.createElement('input'));
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  levelInput.setAttribute('size', "5");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', glyphTrack.expscaling);
  levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'expscaling', this.value);");

  var span2 = div2.appendChild(document.createElement('span'));
  span2.setAttribute('style', "margin: 1px 2px 1px 3px;");
  span2.innerHTML = "experiment merge:";
  div2.appendChild(createExperimentMergeSelect(glyphTrack.trackID));

  return div1;
}


function gLyphsColorMdataOptions(glyphTrack) {
  if(!glyphTrack) { return; }
  var div1 = document.createElement('div');

  var color_mdkey = glyphTrack.color_mdkey;
  if(glyphTrack.newconfig.color_mdkey !== undefined) {  color_mdkey = glyphTrack.newconfig.color_mdkey; }
  
  //----------------
  var colorSourceDiv = div1.appendChild(document.createElement('div'));
  colorSourceDiv.setAttribute('style', "margin: 0px 0px 0px 7px;");
  colorSourceDiv.appendChild(document.createTextNode("feature mdata key:"));
  
  var sourceRadio1 = colorSourceDiv.appendChild(document.createElement('input'));
  sourceRadio1.setAttribute("type", "radio");
  sourceRadio1.setAttribute("id", trackID + "_colormdkey_radio1");
  sourceRadio1.setAttribute("name", trackID + "_colormdatakey");
  sourceRadio1.setAttribute("value", "bed:itemRgb");
  sourceRadio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'color_mdkey', this.value);");
  if(color_mdkey == "bed:itemRgb") { sourceRadio1.setAttribute('checked', "checked"); }
  tspan = colorSourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "bed:itemRgb";
  
  var sourceRadio2 = colorSourceDiv.appendChild(document.createElement('input'));
  sourceRadio2.setAttribute("type", "radio");
  sourceRadio2.setAttribute("id", trackID + "_colormdkey_radio2");
  sourceRadio2.setAttribute("name", trackID + "_colormdatakey");
  sourceRadio2.setAttribute("value", "mdkey");
  sourceRadio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'color_mdkey', '');");
  if(color_mdkey != "bed:itemRgb") { sourceRadio2.setAttribute('checked', "checked"); }
  tspan = colorSourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "mdata key";
  
  var mdKeyInput = colorSourceDiv.appendChild(document.createElement('input'));
  mdKeyInput.setAttribute("id", trackID + "_color_mdkey_input");
  mdKeyInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  mdKeyInput.setAttribute('size', "25");
  mdKeyInput.setAttribute('type', "text");
  mdKeyInput.setAttribute('value', color_mdkey);
  mdKeyInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'color_mdkey', this.value);");
  
  return div1;
}

//---------------------------------------------------------
//
// widget creation section
// use svg and events to create "widgets" inside the tracks
// to allow users to manipulate the tracks
//
//---------------------------------------------------------

function createAddTrackTool() {
  if(zenbu_embedded_view) { return; }
  var glyphset = document.getElementById("gLyphTrackSet");

  var div = document.createElement('div');
  div.setAttribute("align","left");
  div.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  div.id = "glyphTrack" + (newTrackID++);

  var svg = createSVG(300, 25);
  div.appendChild(svg);

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
  var g3 = document.createElementNS(svgNS,'g');
  svg.appendChild(g3);
  var polyback2 = document.createElementNS(svgNS,'polygon');
  polyback2.setAttributeNS(null, 'points', '0,0 130,0 130,14 65,21 0,14');
  polyback2.setAttributeNS(null, 'style', 'fill:url(#purpLinearGradient)');
  polyback2.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g3.appendChild(polyback2);

  var circle2 = document.createElementNS(svgNS,'circle');
  circle2.setAttributeNS(null, 'cx', '8px');
  circle2.setAttributeNS(null, 'cy', '8px');
  circle2.setAttributeNS(null, 'r',  '5px');
  circle2.setAttributeNS(null, 'fill', 'lightgray');
  circle2.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g3.appendChild(circle2);

  var line2 = document.createElementNS(svgNS,'path');
  line2.setAttributeNS(null, 'd', 'M4.5 8 L11.5 8 M8 4.5 L8 11.5 ');
  line2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: darkslateblue;');
  line2.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g3.appendChild(line2);

  var label2 = document.createElementNS(svgNS,'text');
  label2.setAttributeNS(null, 'x', '20px');
  label2.setAttributeNS(null, 'y', '11px');
  label2.setAttributeNS(null, "font-size","10");
  label2.setAttributeNS(null, "fill", "black");
  label2.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label2.setAttributeNS(null, "font-weight", 'bold');
  label2.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  label2.appendChild(document.createTextNode("create custom track"));
  g3.appendChild(label2);

  
  //
  // add predefined track
  //
  var g3 = document.createElementNS(svgNS,'g');
  svg.appendChild(g3);
  var polyback2 = document.createElementNS(svgNS,'polygon');
  polyback2.setAttributeNS(null, 'points', '0,0 130,0 130,14 65,21 0,14');
  polyback2.setAttributeNS(null, 'style', 'fill:url(#purpLinearGradient)');
  polyback2.setAttributeNS(null, "onclick", "gLyphsPredefinedTracksPanel();");
  g3.appendChild(polyback2);
  
  var circle2 = document.createElementNS(svgNS,'circle');
  circle2.setAttributeNS(null, 'cx', '8px');
  circle2.setAttributeNS(null, 'cy', '8px');
  circle2.setAttributeNS(null, 'r',  '5px');
  circle2.setAttributeNS(null, 'fill', 'lightgray');
  circle2.setAttributeNS(null, "onclick", "gLyphsPredefinedTracksPanel();");
  g3.appendChild(circle2);
  
  var line2 = document.createElementNS(svgNS,'path');
  line2.setAttributeNS(null, 'd', 'M4.5 8 L11.5 8 M8 4.5 L8 11.5 ');
  line2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: darkslateblue;');
  line2.setAttributeNS(null, "onclick", "gLyphsPredefinedTracksPanel();");
  g3.appendChild(line2);
  
  var label2 = document.createElementNS(svgNS,'text');
  label2.setAttributeNS(null, 'x', '20px');
  label2.setAttributeNS(null, 'y', '11px');
  label2.setAttributeNS(null, "font-size","10");
  label2.setAttributeNS(null, "fill", "black");
  label2.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label2.setAttributeNS(null, "font-weight", 'bold');
  label2.setAttributeNS(null, "onclick", "gLyphsPredefinedTracksPanel();");
  label2.appendChild(document.createTextNode("add predefined tracks"));
  g3.appendChild(label2);
  g3.setAttributeNS(null, 'transform', "translate(170, 0)");
  
  glyphset.appendChild(div);

  return div;
}


function createHideTrackWidget(glyphTrack) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '10px');
  rect.setAttributeNS(null, 'height', '10px');
  rect.setAttributeNS(null, 'style', 'fill: white;  fill-opacity: 0.0;');

  if(!current_region.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "gLyphsToggleTrackHide(\"" +glyphTrack.trackID+ "\");");
    if(glyphTrack.hideTrack) { rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"expand track\",80);"); }
    else { rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"compact track\",80);"); }
    rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(rect);

  if(glyphTrack.hideTrack) {
    var arrow = document.createElementNS(svgNS,'path');
    arrow.setAttributeNS(null, 'd', 'M3 1 L3 9 L7 5 Z');
    arrow.setAttributeNS(null, 'style', 'stroke: rgb(170,170,170); fill: rgb(170,170,170);');
    if(!current_region.exportSVGconfig) { 
      arrow.setAttributeNS(null, "onclick", "gLyphsToggleTrackHide(\"" +glyphTrack.trackID+ "\");");
      arrow.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"expand track\",80);");
      arrow.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    g1.appendChild(arrow);
  } else {
    var arrow = document.createElementNS(svgNS,'path');
    arrow.setAttributeNS(null, 'd', 'M1 3 L9 3 L5 7 Z');
    arrow.setAttributeNS(null, 'style', 'stroke: rgb(100,100,100); fill: rgb(100,100,100);');
    if(!current_region.exportSVGconfig) {
      arrow.setAttributeNS(null, "onclick", "gLyphsToggleTrackHide(\"" +glyphTrack.trackID+ "\");");
      arrow.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"compact track\",80);");
      arrow.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    g1.appendChild(arrow);
  }
  g1.setAttributeNS(null, 'transform', "translate(9, 0)");
  glyphTrack.top_group.appendChild(g1);
}


function createCloseTrackWidget(glyphTrack) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  var trackID = glyphTrack.trackID;

  var g1 = document.createElementNS(svgNS,'g');

  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);
  var rg1 = document.createElementNS(svgNS,'radialGradient');
  rg1.setAttributeNS(null, 'id', 'redRadialGradient');
  rg1.setAttributeNS(null, 'cx', '30%');
  rg1.setAttributeNS(null, 'cy', '30%');
  rg1.setAttributeNS(null, 'fx', '30%');
  rg1.setAttributeNS(null, 'fy', '30%');
  rg1.setAttributeNS(null, 'r',  '50%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'stop-opacity', '0');
  //stop1.setAttributeNS(null, 'stop-color', 'rgb(255,100,100)');
  stop1.setAttributeNS(null, 'stop-color', 'rgb(100,100,100)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  //stop2.setAttributeNS(null, 'stop-color', 'rgb(250,0,30)');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(150,150,150)');
  rg1.appendChild(stop2);

  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', '4.5px');
  circle.setAttributeNS(null, 'cy', '5.5px');
  circle.setAttributeNS(null, 'r',  '5px');
  circle.setAttributeNS(null, 'fill', 'url(#redRadialGradient)');
  if(!current_region.exportSVGconfig) { 
    circle.setAttributeNS(null, "onclick", "removeTrack(\"" + trackID + "\");");
    circle.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"delete track\",80);");
    circle.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  }
  g1.appendChild(circle);

  var line = document.createElementNS(svgNS,'path');
  //line.setAttributeNS(null, 'points', '1.5,2.5  7.5,8.5  4.5,5.5  7.5,2.5  1.5,8.5  4.5,5.5');
  //line.setAttributeNS(null, 'd', 'M1.5 2.5 L7.5 8.5 M1.5 8.5 L7.5 2.5 ');
  //line.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: rgb(50,50,50);');
  line.setAttributeNS(null, 'd', 'M2 3 L7 8 M2 8 L7 3 ');
  line.setAttribute('stroke', "rgb(50,50,50)");
  line.setAttribute('stroke-width', '1.5px');
  if(!current_region.exportSVGconfig) { 
    line.setAttributeNS(null, "onclick", "removeTrack(\"" + trackID + "\");");
    line.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"delete track\",80);");
    line.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(line);

  g1.setAttributeNS(null, 'transform', "translate(" + current_region.display_width + ",0)");
  glyphTrack.top_group.appendChild(g1);
}


function createDuplicateTrackWidget(glyphTrack) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  if(glyphTrack.glyphStyle == "cytoband") { return; }

  var g1 = document.createElementNS(svgNS,'g');

  var rect1 = document.createElementNS(svgNS,'rect');
  rect1.setAttributeNS(null, 'x', '0');
  rect1.setAttributeNS(null, 'y', '0');
  rect1.setAttributeNS(null, 'width', '7');
  rect1.setAttributeNS(null, 'height', '5');
  //rect1.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  rect1.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray; fill:white;');
  if(!current_region.exportSVGconfig) { 
    rect1.setAttributeNS(null, "onclick", "gLyphsDuplicateTrack(\"" + glyphTrack.trackID + "\");");
    rect1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"duplicate track\",80);");
    rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(rect1);

  var rect2 = document.createElementNS(svgNS,'rect');
  rect2.setAttributeNS(null, 'x', '3');
  rect2.setAttributeNS(null, 'y', '3');
  rect2.setAttributeNS(null, 'width', '7');
  rect2.setAttributeNS(null, 'height', '5');
  //rect2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  rect2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray; fill:white;');
  if(!current_region.exportSVGconfig) { 
    rect2.setAttributeNS(null, "onclick", "gLyphsDuplicateTrack(\"" + glyphTrack.trackID + "\");");
    rect2.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"duplicate track\",80);");
    rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(rect2);

  g1.setAttributeNS(null, 'transform', "translate(" + (current_region.display_width-30) + ",2)");
  glyphTrack.top_group.appendChild(g1);
}


function createDownloadWidget(glyphTrack) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  if(glyphTrack.glyphStyle == "cytoband") { return; }
  var trackID = glyphTrack.trackID;

  var g1 = document.createElementNS(svgNS,'g');

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0.5px');
  rect.setAttributeNS(null, 'width',  '11px');
  rect.setAttributeNS(null, 'height', '10px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  if(!current_region.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "gLyphsDownloadTrackPanel(\"" + trackID + "\");");
    rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"download data\",80);");
    rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(rect);

  var poly = document.createElementNS(svgNS,'polygon');
  poly.setAttributeNS(null, 'points', '4,2  7,2  7,5  9.5,5  5.5,9.5  1.5,5  4,5  4,2');
  //poly.setAttributeNS(null, 'fill', 'blue');
  poly.setAttributeNS(null, 'fill', 'gray');
  if(!current_region.exportSVGconfig) { 
    poly.setAttributeNS(null, "onclick", "gLyphsDownloadTrackPanel(\"" + trackID + "\");");
    poly.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"download data\",80);");
    poly.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(poly);

  g1.setAttributeNS(null, 'transform', "translate(" + (current_region.display_width-45) + ",0)");
  glyphTrack.top_group.appendChild(g1);
}



function gLyphsCreateMoveBar(glyphTrack) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_sidebar) { return; }

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphStyle == "signal-histogram") { }

  //uses the full svg document and creates a full height move bar
  var svg = glyphTrack.svg;
  if(!svg) { return; }
  var height = parseInt(svg.getAttributeNS(null, 'height'));

  var add_resize = false;
  if((glyphStyle == "signal-histogram" || glyphStyle == "xyplot") && (height>20)) { add_resize=true; }

  var g1 = document.createElementNS(svgNS,'g');
  glyphTrack.top_group.appendChild(g1);

  var rect1 = g1.appendChild(document.createElementNS(svgNS,'rect'));
  rect1.setAttributeNS(null, 'x', '0');
  rect1.setAttributeNS(null, 'y', '1');
  rect1.setAttributeNS(null, 'width', '7');
  if(add_resize) {
    rect1.setAttributeNS(null, 'height', height-10);
  } else {
    rect1.setAttributeNS(null, 'height', height-3);
  }
  rect1.setAttributeNS(null, 'style', 'fill: gray; stroke-width:1px; stroke:black;');
  if(!current_region.exportSVGconfig) { 
    rect1.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
    rect1.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");");
    rect1.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  }

  if(add_resize) {
    rect1 = g1.appendChild(document.createElementNS(svgNS,'rect'));
    rect1.setAttributeNS(null, 'x', '0');
    rect1.setAttributeNS(null, 'y', height-9);
    rect1.setAttributeNS(null, 'width', '7');
    rect1.setAttributeNS(null, 'height', '7');
    rect1.setAttributeNS(null, 'style', 'fill: dimgray; stroke-width:1px; stroke:black;');
    if(!current_region.exportSVGconfig) { 
      rect1.setAttributeNS(null, "onmousedown", "gLyphsResizeTrack(\"" + glyphTrack.trackID + "\");");
      rect1.setAttributeNS(null, "onmouseover", "this.style.cursor='ns-resize';");
    }
  }
}


function createMagnifyRegionWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }

  var g1 = document.createElementNS(svgNS,'g');
  g1.id = glyphTrack.trackID + "_magnifyWidgetID";

  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);
  var rg1 = document.createElementNS(svgNS,'radialGradient');
  rg1.setAttributeNS(null, 'id', 'blueRadialGradient');
  rg1.setAttributeNS(null, 'cx', '30%');
  rg1.setAttributeNS(null, 'cy', '30%');
  rg1.setAttributeNS(null, 'fx', '30%');
  rg1.setAttributeNS(null, 'fy', '30%');
  rg1.setAttributeNS(null, 'r',  '50%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'stop-opacity', '0');
  //stop1.setAttributeNS(null, 'stop-color', 'rgb(100,100,255)');
  stop1.setAttributeNS(null, 'stop-color', 'rgb(100,100,100)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  //stop2.setAttributeNS(null, 'stop-color', 'rgb(50,50,250)');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(50,50,50)');
  rg1.appendChild(stop2);

  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', '0px');
  circle.setAttributeNS(null, 'cy', '4px');
  circle.setAttributeNS(null, 'r',  '3.5px');
  circle.setAttributeNS(null, 'fill', 'url(#blueRadialGradient)');
  circle.setAttributeNS(null, 'stroke', 'gray');
  if(!current_region.exportSVGconfig) {
    circle.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  }
  g1.appendChild(circle);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'points', '3,6.5 8,11');
  line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray;');
  if(!current_region.exportSVGconfig) {
    line.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  }
  g1.appendChild(line);

  if(!current_region.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  }

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.selection.xmiddle-5) + ",0)");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"magnify genomic region to selection\",115);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  glyphTrack.top_group.appendChild(g1);
}


function createAnnotationWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }
  if(!current_user || !current_user.email) { return; }

  var g1 = document.createElementNS(svgNS,'g');
  g1.id = glyphTrack.trackID + "_annotationWidgetID";
  g1.setAttributeNS(null, "onclick", "glyphsUserAnnotationPanel(\""+ glyphTrack.trackID+"\");");

  var circle = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle.setAttributeNS(null, 'cx', '23px');
  circle.setAttributeNS(null, 'cy', '5px');
  circle.setAttributeNS(null, 'r',  '4.5px');
  circle.setAttributeNS(null, 'fill', '#E0E0E0');
  circle.setAttributeNS(null, 'stroke', 'gray');
  circle.setAttributeNS(null, "onclick", "glyphsUserAnnotationPanel(\""+ glyphTrack.trackID+"\");");

  var obj = g1.appendChild(document.createElementNS(svgNS,'text'));
  obj.setAttributeNS(null, 'x', '20.5px');
  obj.setAttributeNS(null, 'y', '8px');
  obj.setAttributeNS(null, "font-size","8");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  obj.appendChild(document.createTextNode("A"));

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.selection.xmiddle+6) + ",0)");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"create user annotation feature of selection\",115);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  glyphTrack.top_group.appendChild(g1);
}


function createSelectionSequenceWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }

  var g1 = document.createElementNS(svgNS,'g');
  if(!current_region.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsShowSelectionSequence(\""+ glyphTrack.trackID+"\");");
  }
  var circle = g1.appendChild(document.createElementNS(svgNS,'rect'));
  circle.setAttributeNS(null, 'x', '0px');
  circle.setAttributeNS(null, 'y', '1px');
  circle.setAttributeNS(null, 'width',  '16px');
  circle.setAttributeNS(null, 'height', '8px');
  //circle.setAttributeNS(null, 'fill', 'yellow');
  circle.setAttributeNS(null, 'fill', '#F6F6F6');
  circle.setAttributeNS(null, 'stroke', 'gray');
  if(!current_region.exportSVGconfig) {
    circle.setAttributeNS(null, "onclick", "gLyphsShowSelectionSequence(\""+ glyphTrack.trackID+"\");");
  }

  var obj = g1.appendChild(document.createElementNS(svgNS,'text'));
  obj.setAttributeNS(null, 'x', '3px');
  obj.setAttributeNS(null, 'y', '7px');
  obj.setAttributeNS(null, "font-size","7");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  obj.appendChild(document.createTextNode("seq"));
  if(!current_region.exportSVGconfig) {
    obj.setAttributeNS(null, "onclick", "gLyphsShowSelectionSequence(\""+ glyphTrack.trackID+"\");");
  }

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.selection.xmiddle+5) + ",0)");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"get genome sequence of selection\",115);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  glyphTrack.top_group.appendChild(g1);
}


function createConfigTrackWidget(glyphTrack) {
  if(current_region.exportSVGconfig && current_region.exportSVGconfig.hide_widgets) { return; }

  var g1 = document.createElementNS(svgNS,'g');

  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);
  var rg1 = document.createElementNS(svgNS,'radialGradient');
  rg1.setAttributeNS(null, 'id', 'grayRadialGradient');
  rg1.setAttributeNS(null, 'cx', '40%');
  rg1.setAttributeNS(null, 'cy', '40%');
  rg1.setAttributeNS(null, 'fx', '40%');
  rg1.setAttributeNS(null, 'fy', '40%');
  rg1.setAttributeNS(null, 'r',  '40%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'stop-opacity', '0');
  stop1.setAttributeNS(null, 'stop-color', 'rgb(180,180,180)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(100,100,100)');
  rg1.appendChild(stop2);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'style', 'stroke-width: 1px; stroke: url(#grayRadialGradient)');
  line.setAttributeNS(null, 'fill', 'url(#grayRadialGradient)');
  if(!current_region.exportSVGconfig) {
    line.setAttributeNS(null, "onclick", "gLyphsReconfigureTrackPanel(\"" + glyphTrack.trackID + "\");");
    line.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"configure track\",80);");
    line.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  var points = '';
  for(var ang=0; ang<=28; ang++) {
    var radius = 5;
    if(ang % 4 == 2) { radius = 5; }
    if(ang % 4 == 3) { radius = 5; }
    if(ang % 4 == 0) { radius = 2.5; }
    if(ang % 4 == 1) { radius = 2.5; }
    var x = Math.cos(ang*2*Math.PI/28.0) *radius + 5;
    var y = Math.sin(ang*2*Math.PI/28.0) *radius + 5;
    points = points + x + "," + y + " ";
  }
  line.setAttributeNS(null, 'points', points);
  g1.appendChild(line);

  g1.setAttributeNS(null, 'transform', "translate(" + (current_region.display_width-15) + ",1)");
  glyphTrack.top_group.appendChild(g1);
}

//---------------------------------------------------------------
//
//
// Configuration export and initialization
//
// 
//---------------------------------------------------------------

function gLyphsNoUserWarn(message) {
  var main_div = document.getElementById("global_panel_layer");
  if(!main_div) { return; }

  var e = window.event
  moveToMouseLoc(e);
  var ypos = toolTipSTYLE.ypos-35;
  if(ypos < 100) { ypos = 100; }

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                            +"z-index:1; opacity: 0.95; "
                            +"left:" + ((winW/2)-200) +"px; "
                            +"top:"+ypos+"px; "
                            +"width:400px;"
                             );
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Warning: Not logged into the ZENBU system";

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsSaveConfigParam('cancel'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top:10px; font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "In order to "+message+", you must first log into ZENBU.";
  //tspan.innerHTML += "<br>Please go to the <a href=\"../user/#section=profile\">User profile section</a> and either create a profile or login with a previous profile.";
  eedbLoginAction("login");
}


function gLyphsGeneralWarn(message) {
  var main_div = document.getElementById("global_panel_layer");
  if(!main_div) { return; }

  var e = window.event
  moveToMouseLoc(e);
  var ypos = toolTipSTYLE.ypos-35;
  if(ypos < 100) { ypos = 100; }

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                            +"z-index:1; opacity: 0.95; "
                            +"left:" + ((winW/2)-200) +"px; "
                            +"top:"+ypos+"px; "
                            +"width:400px;"
                             );
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Warning:";

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsSaveConfigParam('cancel'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top:10px; font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = message;
}


function gLyphsSaveConfig() {
  var saveConfigDiv = document.getElementById("global_panel_layer");
  if(!saveConfigDiv) { return; }
  
  eedbCurrentUser = eedbShowLogin();
  if(!eedbCurrentUser) {
    gLyphsNoUserWarn("save a view configuration");
    return;
  }

  if(current_region.saveconfig == undefined) { 
    current_region.saveconfig = new Object;
    current_region.saveconfig.desc  = current_region.desc;
    current_region.saveconfig.name  = current_region.configname;
  }

  //var mymatch = /^temporary\.(.+)$/.exec(current_region.saveconfig.name);
  var mymatch = /(.+) \(modified\)$/.exec(current_region.saveconfig.name);
  if(mymatch && (mymatch.length == 2)) {
    current_region.saveconfig.name = mymatch[1];
  }
  mymatch = /^(.+)\.(\d+)$/.exec(current_region.saveconfig.name);
  if(mymatch && (mymatch.length == 3)) {
    current_region.saveconfig.name =  mymatch[1] + "." + (parseInt(mymatch[2])+1);
  } else {
    current_region.saveconfig.name += ".1";
  }

  //clear/reset previous autosave 
  if(current_region.autosaveInterval) {
    window.clearInterval(current_region.autosaveInterval);
    current_region.autosaveInterval = undefined;
  }
  current_region.modified = false;
  current_region.saveConfigXHR = undefined;

  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos + 10;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            //+"left:" + ((winW/2)-250) +"px; top:200px; "
                            +"left:"+(xpos-350)+"px; top:"+(ypos)+"px; "
                            +"width:350px; z-index:90;"
                             );
  var tdiv, tspan, tinput;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsSaveConfigParam('cancel'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");


  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Save view configuration";
  divFrame.appendChild(tdiv)

  //----------
  var userDiv = divFrame.appendChild(document.createElement('div'));
  userDiv.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  var userSpan = userDiv.appendChild(document.createElement('span'));
  userSpan.setAttribute('style', "padding:0px 0px 0px 0px;");
  userSpan.innerHTML = "user:";
  var name_span = userDiv.appendChild(document.createElement('span'));
  name_span.setAttribute("style", "padding:0px 0px 0px 10px; font-weight:bold; color:rgb(94,115,153);");
  name_span.innerHTML = "guest";
  if(eedbCurrentUser) { 
    if(eedbCurrentUser.nickname) { name_span.innerHTML = eedbCurrentUser.nickname; }
    else { name_span.innerHTML = eedbCurrentUser.openID; }
  }

  var div1 = divFrame.appendChild(document.createElement('div'));
  var collabWidget = eedbCollaborationSelectWidget();
  div1.appendChild(collabWidget);

  //----------
  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
  var span0 = document.createElement('span');
  span0.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "configuration name:";
  div1.appendChild(span0);
  var titleInput = document.createElement('input');
  titleInput.setAttribute('style', "width:200px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', current_region.saveconfig.name);
  titleInput.setAttribute("onkeyup", "gLyphsSaveConfigParam('name', this.value);");
  div1.appendChild(titleInput);

  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute('value', current_region.saveconfig.desc);
  descInput.innerHTML = current_region.saveconfig.desc;
  descInput.setAttribute("onkeyup", "gLyphsSaveConfigParam('desc', this.value);");
  divFrame.appendChild(descInput);


  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "gLyphsSaveConfigParam('cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save view");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "gLyphsSaveConfigParam('accept');");
  divFrame.appendChild(button2);

  saveConfigDiv.innerHTML ="";
  saveConfigDiv.appendChild(divFrame);
}


function gLyphsSaveConfigParam(param, value) {
  var saveConfigDiv = document.getElementById("global_panel_layer");
  if(!saveConfigDiv) { return; }

  var saveconfig = current_region.saveconfig;
  if(saveconfig === undefined) { 
    if(saveConfigDiv) { saveConfigDiv.innerHTML =""; }
    return;
  }

  if(param == "name") { saveconfig.name = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  if(param == "cancel") {
    saveConfigDiv.innerHTML ="";
    current_region.saveconfig = undefined;
    current_region.modified = false;
    current_region.saveConfigXHR = undefined;
  }

  if(param == "accept") {
    current_region.saveConfigXHR = undefined;
    gLyphsUploadViewConfigXML();
    saveConfigDiv.innerHTML ="";
  }
}


function gLyphsAutosaveConfig() {
  //delay the autosave to allow user to do many manipulations without stalling
  if(!current_region.autosaveInterval) {
    //current_region.autosaveInterval = setInterval("gLyphsSendAutosaveConfig();", 10000); //10 seconds
    current_region.autosaveInterval = setInterval("gLyphsSendAutosaveConfig();", 3000); //3 seconds
  }
  current_region.modified = true;
}


function gLyphsSendAutosaveConfig() {
  var saveconfig = new Object;
  current_region.saveconfig = saveconfig;
  saveconfig.name     = "tempsave";
  saveconfig.desc     = current_region.desc;
  saveconfig.autosave = true;

  var mymatch = /^temporary\.(.+)/.exec(current_region.configname);
  if(mymatch && (mymatch.length == 2)) {
    current_region.configname = mymatch[1];
  }
  mymatch = /^modified\.(.+)/.exec(current_region.configname);
  if(mymatch && (mymatch.length == 2)) {
    current_region.configname = mymatch[1];
  }
  mymatch = /(.+) \(modified\)$/.exec(current_region.configname);
  if(mymatch && (mymatch.length == 2)) {
    current_region.configname = mymatch[1];
  }
  saveconfig.name = current_region.configname + " (modified)";

  /*
  //mymatch = /^temporary\.(.+)$/.exec(current_region.configname);
  mymatch = /(.+) \(modified\)$/.exec(current_region.configname);
  if(mymatch && (mymatch.length == 2)) {
    saveconfig.name = current_region.configname;
  } else {
    saveconfig.name = current_region.configname + " (modified)";
  }
   */

  gLyphsUploadViewConfigXML();

  if(current_region.autosaveInterval) {
    window.clearInterval(current_region.autosaveInterval);
    current_region.autosaveInterval = undefined;
  }
}


function gLyphsGenerateViewConfigDOM() {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = current_region.saveconfig;

  var config = doc.createElement("eeDBgLyphsConfig");
  doc.appendChild(config);

  var collab = config.appendChild(doc.createElement("collaboration"));
  collab.setAttribute("uuid", current_collaboration.uuid);
  collab.setAttribute("name", current_collaboration.name);
  
  if(saveconfig.autosave) {
    var autosave = doc.createElement("autoconfig");
    autosave.setAttribute("value", "public");
    config.appendChild(autosave);
  }

  var summary = doc.createElement("summary");
  if(saveconfig.name) { summary.setAttribute("name", saveconfig.name); }
  if(eedbCurrentUser) { 
    summary.setAttribute("user", eedbCurrentUser.nickname); 
    summary.setAttribute("creator_openID", eedbCurrentUser.openID); 
  }
  if(saveconfig.desc) { summary.setAttribute("desc", saveconfig.desc); }
  config.appendChild(summary);

  var loc = doc.createElement("region");
  loc.setAttribute("asm",    current_region.asm);
  loc.setAttribute("chrom",  current_region.chrom);
  loc.setAttribute("start",  current_region.start);
  loc.setAttribute("end",    current_region.end);
  config.appendChild(loc);

  var settings = doc.createElement("settings");
  settings.setAttribute("dwidth", current_region.display_width);
  if(current_region.hide_compacted_tracks) { settings.setAttribute("hide_compacted", "true"); }
  if(current_region.exppanel_hide_deactive) { settings.setAttribute("exppanel_hide_deactive", "true"); }
  if(current_region.exppanel_active_on_top) { settings.setAttribute("exppanel_active_on_top", "true"); }
  if(current_region.exppanel_subscroll) { settings.setAttribute("exppanel_subscroll", "true"); }
  if(current_region.flip_orientation) { settings.setAttribute("flip_orientation", "true"); }
  config.appendChild(settings);

  var expexp = doc.createElement("experiment_expression");
  expexp.setAttribute("exp_sort", express_sort_mode);
  config.appendChild(expexp);

  if(current_feature) { 
    var feat = doc.createElement("feature");
    //if(current_feature.getAttribute("peer")) {
    //  feat.setAttribute("peer", current_feature.getAttribute("peer"));
    //}
    feat.setAttribute("id",   current_feature.id);
    feat.setAttribute("name", current_feature.name);
    config.appendChild(feat);
  }  

  var tracks = doc.createElement("gLyphTracks");
  tracks.setAttribute("next_trackID", newTrackID);
  config.appendChild(tracks);

  var glyphset = document.getElementById("gLyphTrackSet");
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    
    var trackDOM = glyphsGenerateTrackDOM(glyphTrack);
    tracks.appendChild(trackDOM);
  }

  return doc;
}


function gLyphsUploadViewConfigXML() {
  if(current_region.saveConfigXHR) {
    //a save already in operation. flag for resave when finished
    current_region.modified = true;
    return;
  }
  if(!current_region.saveconfig) { return; }

  //zenbu2.6
  var configDOM = gLyphsGenerateViewConfigDOM();

  var serializer = new XMLSerializer();
  var configXML  = serializer.serializeToString(configDOM);

  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = configXML.indexOf("<eeDBgLyphsConfig>");
  if(idx1 > 0) { configXML = configXML.substr(idx1); }

  var saveconfig = current_region.saveconfig;
  current_region.view_config = undefined; //clear old config object since it is not valid anymore

  //build the zenbu_query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode>\n";
  if(saveconfig.name) { paramXML += "<configname>"+ encodehtml(saveconfig.name) + "</configname>"; }
  if(saveconfig.desc) { paramXML += "<description>"+ encodehtml(saveconfig.desc) + "</description>"; }

  if(saveconfig.autosave) {
    paramXML += "<autosave>true</autosave>\n";
  } else {
    paramXML += "<collaboration_uuid>"+ current_collaboration.uuid +"</collaboration_uuid>\n";

    current_region.exportSVGconfig = new Object;
    current_region.exportSVGconfig.title = current_region.configname;
    current_region.exportSVGconfig.savefile = false;
    current_region.exportSVGconfig.hide_widgets = false;
    current_region.exportSVGconfig.hide_sidebar = false;
    current_region.exportSVGconfig.hide_titlebar = false;
    current_region.exportSVGconfig.hide_experiment_graph = true;
    current_region.exportSVGconfig.hide_compacted_tracks = true;

    var svgXML = generateSvgXML();
    paramXML += "<svgXML>" + svgXML + "</svgXML>";

    current_region.exportSVGconfig = undefined;
  }

  paramXML += "<configXML>" + configXML + "</configXML>";
  paramXML += "</zenbu_query>\n";

  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);
  //return;

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  current_region.saveConfigXHR = configXHR;

  configXHR.open("POST",eedbConfigCGI, true); //async
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  configXHR.onreadystatechange= gLyphsUploadViewConfigXMLResponse;
  //configXHR.setRequestHeader("Content-length", paramXML.length);
  //configXHR.setRequestHeader("Connection", "close");
  configXHR.send(paramXML);
  current_region.modified = false;
}


function gLyphsUploadViewConfigXMLResponse() {
  var configXHR = current_region.saveConfigXHR;
  if(!configXHR) { return; }

  //might need to be careful here
  if(configXHR.readyState!=4) { return; }
  if(configXHR.responseXML == null) { return; }
  if(configXHR.status!=200) { return; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null) { return null; }

  // parse result back to get uuid and adjust view
  current_region.configUUID = "";
  if(xmlDoc.getElementsByTagName("configuration")) {
    var configXML = xmlDoc.getElementsByTagName("configuration")[0];
    current_region.view_config = eedbParseConfigurationData(configXML);
    if(current_region.view_config) {
      current_region.configUUID = current_region.view_config.uuid;
    }
  }

  if(current_region.configUUID) {
    //dhtmlHistory.add("#config="+uuid);
    //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
    gLyphsChangeDhtmlHistoryLocation();

    current_region.desc           = current_region.saveconfig.desc;
    current_region.configname     = current_region.saveconfig.name;
    current_region.config_creator = "guest";
    if(eedbCurrentUser) { 
      if(eedbCurrentUser.nickname) { current_region.config_creator = eedbCurrentUser.nickname; }
      if(eedbCurrentUser.openID)   { current_region.config_creator = eedbCurrentUser.openID; }
    }
    gLyphsShowConfigInfo();
  }
  
  current_region.saveConfigXHR = undefined;
  if(current_region.modified) { //do it again
    gLyphsUploadViewConfigXML();
  } else {
    current_region.saveconfig = undefined;
  }
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

  if(!config) { return false; }
  if(!config.uuid) {
    current_region.view_config_loaded = false;
    return false;
  }
  //
  // clean it all out, probably should put in a global init method
  //
  current_feature = undefined;
  eedbDefaultAssembly = undefined;
  current_dragTrack = undefined;
  currentSelectTrackID =undefined;
  gLyphTrack_array = new Object();
  active_track_XHRs = new Object();
  pending_track_XHRs = new Object();
  express_sort_mode = 'name';
  newTrackID = 100;

  current_region = new Object();
  current_region.display_width = gLyphsInitParams.display_width;
  current_region.asm = "hg18";
  current_region.configname = "eeDB gLyphs";
  current_region.desc = "";
  current_region.exppanel_hide_deactive = false;
  current_region.exppanel_active_on_top = false;
  current_region.exppanel_subscroll = false;
  current_region.flip_orientation = false;
  current_region.highlight_search = "";

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
      if(settings.getAttribute("exppanel_hide_deactive") == "true") {
        current_region.exppanel_hide_deactive = true;
      } else {
        current_region.exppanel_hide_deactive = false;
      }
      if(settings.getAttribute("exppanel_active_on_top") == "true") {
        current_region.exppanel_active_on_top = true;
      } else {
        current_region.exppanel_active_on_top = false;
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
    }
  }

  //--------------------------------
  eedbEmptySearchResults("glyphsSearchBox1");

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

  var expexps = configDOM.getElementsByTagName("experiment_expression");
  if(expexps && (expexps.length>0)) {
    var expexp = expexps[0];
    change_express_sort(expexp.getAttribute("exp_sort"));
  }


  var glyphset = document.getElementById("gLyphTrackSet");
  clearKids(glyphset);

  var trackset = configDOM.getElementsByTagName("gLyphTracks");
  if(!trackset) { return false; }

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];

    var glyphTrack = gLyphsCreateTrackFromTrackDOM(trackDOM);
    gLyphTrack_array[glyphTrack.trackID] = glyphTrack;
    glyphset.appendChild(glyphTrack.trackDiv);

    gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
  }
  createAddTrackTool();
  
  if(configDOM.getElementsByTagName("region")) {
    var region = configDOM.getElementsByTagName("region")[0];
    if(region) {
      gLyphsSetLocation(region.getAttribute("asm"),
                        region.getAttribute("chrom"),
                        parseInt(region.getAttribute("start")),
                        parseInt(region.getAttribute("end")));
    }
  }

  gLyphsInitSearchFromTracks();

  return true;;
}


function gLyphsShowConfigInfo() {
  var titlediv = document.getElementById("gLyphs_title");
  var genomeDiv = document.getElementById("glyphs_genome_desc");
  if(!titlediv) { return; }

  //titlediv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
  titlediv.innerHTML="";
  var link1 = titlediv.appendChild(document.createElement("a"));
  link1.setAttribute("href", "./#config=" +current_region.configUUID);
  if((/^temporary\./.test(current_region.configname)) || 
     (/^modified\./.test(current_region.configname)) ||
     (/\(modified\)$/.test(current_region.configname))) {
    link1.setAttribute("style", "color:rgb(136,0,0);");
  } else {
    link1.setAttribute("style", "color:black;");
  }
  link1.innerHTML = encodehtml(current_region.configname);
  // save view button
  var button = titlediv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "gLyphsSaveConfig();");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"save view configuration to collaboration\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.innerHTML = "save view";


  var descdiv = document.getElementById("gLyphs_description");
  descdiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descdiv.innerHTML = "";

  var div1 = descdiv.appendChild(document.createElement("div"));
  div1.innerHTML = encodehtml(current_region.desc);

  var div2 = descdiv.appendChild(document.createElement("div"));
  div2.setAttribute("style", "font-size:10px;");
  if(current_region.config_creator) {
    var span1 = div2.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:10px;");
    span1.innerHTML = "created by: "+ encodehtml(current_region.config_creator);
  }
  if(current_region.config_createdate) {
    var span1 = div2.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:10px;");
    span1.innerHTML = encodehtml(current_region.config_createdate) +" GMT";
  }
  var span1 = div2.appendChild(document.createElement("span"));
  span1.setAttribute("style", "margin-left:10px;");
  span1.innerHTML = "collaboration: ";
  if(current_region.view_config  && current_region.view_config.collaboration) {
    if(current_region.view_config.type == "AUTOSAVE") {
      span1.innerHTML += "(temp)";
    } else {
      span1.innerHTML += current_region.view_config.collaboration.name;
    }
  } else {
    span1.innerHTML += "NA";
  }


  if(!genomeDiv) {
    genomeDiv = document.createElement("div");
    genomeDiv.id = "glyphs_genome_desc";
    genomeDiv.setAttribute("style", "font-size:14px;");
  }
  descdiv.appendChild(genomeDiv);
}


function gLyphsLastSessionConfig() {
  if(zenbu_embedded_view) { return; }
  current_region.view_config_loaded = false;
  var url = eedbConfigCGI + "?mode=last_session";
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

//---------------------------------------------------------------
//
// track configuration / save
// 
//---------------------------------------------------------------


function glyphsSaveTrackConfig(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  eedbCurrentUser = eedbShowLogin();
  if(!eedbCurrentUser) {
    gLyphsNoUserWarn("save a track configuration");
    return;
  }

  glyphTrack.glyphsSaveTrackConfig = new Object;
  glyphTrack.glyphsSaveTrackConfig.title = glyphTrack.title;
  glyphTrack.glyphsSaveTrackConfig.desc = glyphTrack.description;

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var svg = glyphTrack.svg;
  if(!svg) return;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos-300) +"px; "
                            +"width:350px;"
                             );

  var tdiv, tspan, tinput;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Save gLyphs Track";
  divFrame.appendChild(tdiv)

  //----------
  var userDiv = divFrame.appendChild(document.createElement('div'));
  userDiv.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  var userSpan = userDiv.appendChild(document.createElement('span'));
  userSpan.setAttribute('style', "padding:0px 0px 0px 0px;");
  userSpan.innerHTML = "user:";
  var name_span = userDiv.appendChild(document.createElement('span'));
  name_span.setAttribute("style", "padding:0px 0px 0px 10px; font-weight:bold; color:rgb(94,115,153);");
  name_span.innerHTML = "guest";
  if(eedbCurrentUser) {
    if(eedbCurrentUser.nickname) { name_span.innerHTML = eedbCurrentUser.nickname; }
    else { name_span.innerHTML = eedbCurrentUser.openID; }
  }

  var div1 = divFrame.appendChild(document.createElement('div'));
  var collabWidget = eedbCollaborationSelectWidget();
  div1.appendChild(collabWidget);

  //----------
  tdiv = document.createElement('div');
  tspan = document.createElement('span');
  tspan.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML = "track name:";
  tdiv.appendChild(tspan);
  var tinput = document.createElement('input');
  tinput.setAttribute('style', "width:200px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  tinput.setAttribute('type', "text");
  tinput.setAttribute('value', glyphTrack.title);
  tinput.setAttribute("onkeyup", "glyphsSaveTrackConfigParam(\""+ trackID+"\", 'title', this.value);");
  tdiv.appendChild(tinput);
  divFrame.appendChild(tdiv)

  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute("onkeyup", "glyphsSaveTrackConfigParam(\""+ trackID+"\", 'desc', this.value);");
  divFrame.appendChild(descInput);
  if(glyphTrack.description) {
    descInput.setAttribute('value', glyphTrack.description);
    descInput.innerHTML = glyphTrack.description;
  }


  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "glyphsSaveTrackConfigParam(\""+ trackID+"\", 'cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save track config");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "glyphsSaveTrackConfigParam(\""+ trackID+"\", 'accept');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
  glyphTrack.glyphsSaveTrackConfig.interface = divFrame;
}


function glyphsSaveTrackConfigParam(trackID, param, value) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var saveconfig = glyphTrack.glyphsSaveTrackConfig;
  if(saveconfig === undefined) { return; }
  var saveConfigDiv = glyphTrack.glyphsSaveTrackConfig.interface;

  if(param == "title") { saveconfig.title = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  if(param == "cancel") {
    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.glyphsSaveTrackConfig = undefined;
  }

  if(param == "accept") {
    var configDOM = gLyphsGenerateTrackConfigDOM(trackID);
    var uuid = gLyphsUploadTrackConfigXML(glyphTrack, configDOM);

    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.glyphsSaveTrackConfig = undefined;
    glyphTrack.uuid = uuid;
    gLyphsDrawTrack(trackID);
  }
}


function glyphsGenerateTrackDOM(track) {
  var doc = document.implementation.createDocument("", "", null);

  var trackDOM = doc.createElement("gLyphTrack");
  if(current_region.active_trackID == track.trackID) { trackDOM.setAttribute("active_track", "true"); }
  trackDOM.setAttribute("title", track.title);
  trackDOM.setAttribute("glyphStyle", track.glyphStyle);
  if(track.uuid) { trackDOM.setAttribute("uuid", track.uuid); }
  if(track.peerName) { trackDOM.setAttribute("peerName", track.peerName); }
  if(track.sources) { trackDOM.setAttribute("sources", track.sources); }
  if(track.source_ids) { 
    trackDOM.setAttribute("source_ids", track.source_ids); 
    //var source_ids = trackDOM.appendChild(doc.createElement('source_ids'));
    //source_ids.appendChild(doc.createTextNode(track.source_ids));
  }
  if(track.hideTrack) { trackDOM.setAttribute("hide", 1); }
  if(track.exptype) { trackDOM.setAttribute("exptype", track.exptype); }
  if(track.datatype) { trackDOM.setAttribute("datatype", track.datatype); }
  if(track.colorMode) { trackDOM.setAttribute("colorMode", track.colorMode); }
  if(track.colorspace) { trackDOM.setAttribute("colorspace", track.colorspace); }
  if(track.colorMode == "signal") { trackDOM.setAttribute("scorecolor", track.colorspace); } //backward compatible when scorecolor was a bool toggle and the colorspace, now is separate colorMode colorspace
  if(track.color_mdkey) { trackDOM.setAttribute("color_mdkey", track.color_mdkey); }
  if(track.noCache) { trackDOM.setAttribute("nocache", track.noCache); }
  if(track.noNameSearch) { trackDOM.setAttribute("noNameSearch", track.noNameSearch); }
  if(track.backColor) { trackDOM.setAttribute("backColor", track.backColor); }
  if(track.posStrandColor) { trackDOM.setAttribute("posStrandColor", track.posStrandColor); }
  if(track.revStrandColor) { trackDOM.setAttribute("revStrandColor", track.revStrandColor); }
  if(track.source_outmode) { trackDOM.setAttribute("source_outmode", track.source_outmode); }
  if(track.hidezeroexps) { trackDOM.setAttribute("hidezeroexps", track.hidezeroexps); }
  if(track.expfilter) { trackDOM.setAttribute("expfilter", track.expfilter); }
  if(track.exppanelmode) { trackDOM.setAttribute("exppanelmode", track.exppanelmode); }
  if(track.mdgroupkey) { trackDOM.setAttribute("mdgroupkey", track.mdgroupkey); }  
  if(track.errorbar_type) { trackDOM.setAttribute("errorbar_type", track.errorbar_type); }  
  if(track.ranksum_display) { trackDOM.setAttribute("ranksum_display", track.ranksum_display); }  
  if(track.ranksum_mdkeys) { trackDOM.setAttribute("ranksum_mdkeys", track.ranksum_mdkeys); }  
  if(track.ranksum_min_zscore) { trackDOM.setAttribute("ranksum_min_zscore", track.ranksum_min_zscore); }  
  if(track.hashkey) { trackDOM.setAttribute("trackcache_hashkey", track.hashkey); }
  if(track.logscale) { trackDOM.setAttribute("logscale", track.logscale); }
  if(track.track_height) { trackDOM.setAttribute("height", track.track_height); }
  if(track.experiment_merge) { trackDOM.setAttribute("experiment_merge", track.experiment_merge); }
  if(track.exppanel_use_rgbcolor) { trackDOM.setAttribute("exppanel_use_rgbcolor", "true"); }

  if(track.expscaling) { trackDOM.setAttribute("expscaling", track.expscaling); }
  if(track.strandless) { trackDOM.setAttribute("strandless", track.strandless); }
  if(track.scale_min_signal) { trackDOM.setAttribute("scale_min_signal", track.scale_min_signal); }

  if(track.experiments) {
    for(var expID in track.experiments){
      var experiment = track.experiments[expID];
      var exp = doc.createElement("gLyphTrackExp");
      exp.setAttribute("id", experiment.id);
      if(experiment.hide) { exp.setAttribute("hide", experiment.hide); }
      trackDOM.appendChild(exp);
    }
  }
  if(track.description) {
    var desc = trackDOM.appendChild(doc.createElement("description"));
    desc.appendChild(doc.createTextNode(track.description));
  }
  if(track.exp_name_mdkeys) { 
    var mdkeys = trackDOM.appendChild(doc.createElement("exp_name_mdkeys"));
    mdkeys.appendChild(doc.createTextNode(track.exp_name_mdkeys));
  }
  if(track.script) {
    var spstreamDOM = gLyphsParseStreamProcssingXML(track.script.spstreamXML);
    if(spstreamDOM) {
      var script_root = spstreamDOM.documentElement;
      script_root.setAttribute("name", track.script.name);
      if(track.script.uuid) { script_root.setAttribute("uuid", track.script.uuid); }
      if(track.script.desc) { script_root.setAttribute("desc", track.script.desc); }
      trackDOM.appendChild(script_root);
    }
  }
  if(track.selection) {
    trackDOM.setAttribute("select_asm", track.selection.asm);
    trackDOM.setAttribute("select_chrom", track.selection.chrom);
    trackDOM.setAttribute("select_start", track.selection.chrom_start);
    trackDOM.setAttribute("select_end", track.selection.chrom_end);
  }
  
  if(track.spstream_mode == "expression") {
    var expressDOM = doc.createElement("expression_binning");
    trackDOM.appendChild(expressDOM);
    if(track.overlap_mode) { expressDOM.setAttribute("overlap_mode", track.overlap_mode); }
    if(track.binning) { expressDOM.setAttribute("binning", track.binning); }
    if(track.exprbin_strandless) { expressDOM.setAttribute("strandless", track.exprbin_strandless); }
    if(track.exprbin_subfeatures) { expressDOM.setAttribute("subfeatures", track.exprbin_subfeatures); }
    if(track.exprbin_binsize) { expressDOM.setAttribute("binsize", track.exprbin_binsize); }
  }  
  
  track.trackDOM = trackDOM;
  return trackDOM;
}


function gLyphsCreateTrackFromTrackDOM(trackDOM) {
  //create trackdiv and glyphTrack objects and configure them

  var trackID = "glyphTrack" + (newTrackID++);
  
  var trackDiv = document.createElement('div');
  trackDiv.setAttribute("align","left");
  trackDiv.setAttribute("style", "background-color: transparent; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  trackDiv.id = trackID;
  trackDiv.setAttribute("class","gLyphTrack");

  var glyphTrack        = new Object;
  glyphTrack.trackID    = trackID;
  glyphTrack.trackDiv   = trackDiv;
  glyphTrack.hideTrack  = !!trackDOM.getAttribute("hide"); //forces it into a boolean
  glyphTrack.title      = trackDOM.getAttribute("title");
  glyphTrack.glyphStyle = trackDOM.getAttribute("glyphStyle");
  glyphTrack.strandless = false;
  glyphTrack.binning    = "sum";
  glyphTrack.experiment_merge = "mean";
  glyphTrack.overlap_mode = "5end";
  glyphTrack.noCache    = false;
  glyphTrack.noNameSearch = false;
  glyphTrack.backColor  = "#F6F6F6";
  glyphTrack.posStrandColor  = "#008000";
  glyphTrack.revStrandColor  = "#800080";
  glyphTrack.posTextColor    = "black";
  glyphTrack.revTextColor    = "black";
  glyphTrack.colorMode       = "strand";
  glyphTrack.color_mdkey     = "bed:itemRgb";
  glyphTrack.source_outmode  = "";
  glyphTrack.hidezeroexps = false;
  glyphTrack.spstream_mode = "none";
  glyphTrack.exprbin_strandless = false;
  glyphTrack.exprbin_subfeatures = false;
  glyphTrack.exprbin_binsize = "";
  glyphTrack.expfilter = "";
  glyphTrack.exppanelmode = "experiments";
  glyphTrack.exppanel_use_rgbcolor = false;
  glyphTrack.exp_name_mdkeys = "";
  glyphTrack.mdgroupkey = "";
  glyphTrack.errorbar_type = "stddev";
  glyphTrack.ranksum_display = "";
  glyphTrack.ranksum_mdkeys = "";
  glyphTrack.ranksum_min_zscore = "";
  glyphTrack.description = ""
  glyphTrack.uuid = ""

  //fix old glyphStyle
  if(glyphTrack.glyphStyle == "express") { glyphTrack.glyphStyle = "signal-histogram"; }
  if(glyphTrack.glyphStyle == "spectrum") { glyphTrack.glyphStyle = "1D-heatmap"; }
  if(glyphTrack.glyphStyle == "singletrack") {  glyphTrack.glyphStyle = "1D-heatmap"; }
  if(glyphTrack.glyphStyle == "line") { glyphTrack.glyphStyle = "centroid"; }
  if(glyphTrack.glyphStyle == "thin") { glyphTrack.glyphStyle = "thin-box"; }
  if(glyphTrack.glyphStyle == "medium-exon") { glyphTrack.glyphStyle = "thin-box"; }
  if(glyphTrack.glyphStyle == "thin-exon") { glyphTrack.glyphStyle = "thin-box"; }
  if(glyphTrack.glyphStyle == "exon") { glyphTrack.glyphStyle = "thick-box"; }
  if(glyphTrack.glyphStyle == "utr") { glyphTrack.glyphStyle = "thick-box"; }
  if(glyphTrack.glyphStyle == "scorethick") { glyphTrack.glyphStyle = "box-scorethick"; }


  var source_ids = trackDOM.getElementsByTagName("source_ids");
  if(source_ids && source_ids.length>0) { glyphTrack.source_ids = source_ids[0].firstChild.nodeValue; }

  if(trackDOM.getAttribute("peerName")) { glyphTrack.peerName = trackDOM.getAttribute("peerName"); }
  if(trackDOM.getAttribute("sources")) { glyphTrack.sources = trackDOM.getAttribute("sources"); }
  if(trackDOM.getAttribute("source_ids")) { glyphTrack.source_ids = trackDOM.getAttribute("source_ids"); }
  if(trackDOM.getAttribute("uuid")) { glyphTrack.uuid = trackDOM.getAttribute("uuid"); }

  if(trackDOM.getAttribute("active_track") == "true") { current_region.active_trackID = glyphTrack.trackID; }

  if(trackDOM.getAttribute("nocache") == "true") { glyphTrack.noCache = true; }
  if(trackDOM.getAttribute("noNameSearch") == "true") { glyphTrack.noNameSearch = true; }
  if(trackDOM.getAttribute("backColor")) { glyphTrack.backColor = trackDOM.getAttribute("backColor"); }
  if(trackDOM.getAttribute("posStrandColor")) { glyphTrack.posStrandColor = trackDOM.getAttribute("posStrandColor"); }
  if(trackDOM.getAttribute("revStrandColor")) { glyphTrack.revStrandColor = trackDOM.getAttribute("revStrandColor"); }
  if(trackDOM.getAttribute("revStrandColor")) { glyphTrack.revStrandColor = trackDOM.getAttribute("revStrandColor"); }
  if(trackDOM.getAttribute("colorspace")) { glyphTrack.colorspace = trackDOM.getAttribute("colorspace"); }
  if(trackDOM.getAttribute("hidezeroexps") == "true") { glyphTrack.hidezeroexps = true; }
  if(trackDOM.getAttribute("submode")) { glyphTrack.overlap_mode = trackDOM.getAttribute("submode"); }
  if(trackDOM.getAttribute("overlap_mode")) { glyphTrack.overlap_mode = trackDOM.getAttribute("overlap_mode"); }
  if(trackDOM.getAttribute("binning")) { glyphTrack.binning = trackDOM.getAttribute("binning"); }
  if(trackDOM.getAttribute("experiment_merge")) { glyphTrack.experiment_merge = trackDOM.getAttribute("experiment_merge"); }
  if(trackDOM.getAttribute("datatype")) { glyphTrack.datatype = trackDOM.getAttribute("datatype"); }
  if(trackDOM.getAttribute("expfilter")) { glyphTrack.expfilter = trackDOM.getAttribute("expfilter"); }
  if(trackDOM.getAttribute("exppanelmode")) { glyphTrack.exppanelmode = trackDOM.getAttribute("exppanelmode"); }
  if(trackDOM.getAttribute("mdgroupkey")) { glyphTrack.mdgroupkey = trackDOM.getAttribute("mdgroupkey"); }
  if(trackDOM.getAttribute("errorbar_type")) { glyphTrack.errorbar_type = trackDOM.getAttribute("errorbar_type"); }
  if(trackDOM.getAttribute("ranksum_display")) { glyphTrack.ranksum_display = trackDOM.getAttribute("ranksum_display"); }
  if(trackDOM.getAttribute("ranksum_min_zscore")) { glyphTrack.ranksum_min_zscore = trackDOM.getAttribute("ranksum_min_zscore"); }
  if(trackDOM.getAttribute("ranksum_mdkeys")) { glyphTrack.ranksum_mdkeys = trackDOM.getAttribute("ranksum_mdkeys"); }
  if(trackDOM.getAttribute("exppanel_use_rgbcolor") == "true") { glyphTrack.exppanel_use_rgbcolor = true; }
  if(trackDOM.getAttribute("exptype")) { 
    glyphTrack.exptype = trackDOM.getAttribute("exptype"); 
    if(!glyphTrack.datatype) { glyphTrack.datatype = glyphTrack.exptype; }
  }

  if(trackDOM.getAttribute("scorecolor")) { //for backward compatability
    glyphTrack.colorMode = "signal";
    glyphTrack.colorspace = trackDOM.getAttribute("scorecolor"); 
    if(glyphTrack.colorspace == "sense-color") { gLyphsMakeColorGradient(glyphTrack); }
  }
  if(trackDOM.getAttribute("colorMode")) { glyphTrack.colorMode = trackDOM.getAttribute("colorMode"); }
  if(trackDOM.getAttribute("color_mdkey")) { glyphTrack.color_mdkey = trackDOM.getAttribute("color_mdkey"); }
  
  if(trackDOM.getAttribute("select_start")) { 
    glyphTrack.selection = new Object;
    glyphTrack.selection.asm         = trackDOM.getAttribute("select_asm");
    glyphTrack.selection.chrom       = trackDOM.getAttribute("select_chrom");
    glyphTrack.selection.chrom_start = trackDOM.getAttribute("select_start");
    glyphTrack.selection.chrom_end   = trackDOM.getAttribute("select_end");
    glyphTrack.selection.active = "no";
  }
    
  if(trackDOM.getAttribute("logscale"))   { glyphTrack.logscale = Math.floor(trackDOM.getAttribute("logscale")); }
  
  glyphTrack.maxlevels  = 100;
  glyphTrack.track_height = 100;
  if(trackDOM.getAttribute("maxlevels")) {
    glyphTrack.track_height  = Math.floor(trackDOM.getAttribute("maxlevels"));
  }
  if(trackDOM.getAttribute("height")) {
    glyphTrack.track_height  = Math.floor(trackDOM.getAttribute("height"));
  }
  glyphTrack.expscaling = "auto";
  if(trackDOM.getAttribute("expscaling")) {
    glyphTrack.expscaling  = parseFloat(trackDOM.getAttribute("expscaling"));
    if(isNaN(glyphTrack.expscaling) || (glyphTrack.expscaling==0)) { glyphTrack.expscaling = "auto"; }                                        
  }
  glyphTrack.scale_min_signal = 0;
  if(trackDOM.getAttribute("scale_min_signal")) {
    glyphTrack.scale_min_signal  = parseFloat(trackDOM.getAttribute("scale_min_signal"));
    if(isNaN(glyphTrack.scale_min_signal)) { glyphTrack.scale_min_signal = 0; }                                        
  }
  if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "split-signal") {
    if(trackDOM.getAttribute("strandless") == "true") { glyphTrack.strandless = true; }
    glyphTrack.experiments = new Object();
  }

  if(glyphTrack.glyphStyle == "1D-heatmap" ||
     glyphTrack.glyphStyle == "experiment-heatmap") {
    glyphTrack.colorMode = "signal";
    if(!glyphTrack.colorspace) {
      glyphTrack.colorspace = "fire1";
    }
    if(glyphTrack.track_height > 10) { glyphTrack.track_height = 3; } //not properly set
  } 
  
  var desc = trackDOM.getElementsByTagName("description")[0];
  if(desc) {
    glyphTrack.description = desc.firstChild.nodeValue;
  }
  var mdkeys = trackDOM.getElementsByTagName("exp_name_mdkeys")[0];
  if(mdkeys) {
    glyphTrack.exp_name_mdkeys = mdkeys.firstChild.nodeValue;
  }

  var exps = trackDOM.getElementsByTagName("gLyphTrackExp");
  for(var j=0; j<exps.length; j++) {
    var expID = exps[j].getAttribute("id");
    if(!glyphTrack.experiments) { glyphTrack.experiments = new Object(); }
    var experiment = glyphTrack.experiments[expID];
    if(experiment === undefined) {
      experiment               = new Object;
      experiment.id            = expID;
      experiment.exptype       = '';
      experiment.value         = 0.0;
      experiment.sig_error     = 1.0;
      experiment.hide          = !!exps[j].getAttribute("hide");
      glyphTrack.experiments[expID] = experiment;
    }
  }

  //stream processing
  var processing = trackDOM.getElementsByTagName("zenbu_script")[0];
  if(processing) {
    var serializer = new XMLSerializer();
    glyphTrack.script = new Object;
    glyphTrack.spstream_mode = "custom";
    if(processing.getAttribute("name")) { 
      glyphTrack.script.name = processing.getAttribute("name"); 
    }
    if(processing.getAttribute("uuid")) { 
      glyphTrack.script.uuid = processing.getAttribute("uuid"); 
      glyphTrack.spstream_mode = "predefined";
    }
    if(processing.getAttribute("desc")) { 
      glyphTrack.script.desc = processing.getAttribute("desc"); 
    }
    processing.removeAttribute("name");
    processing.removeAttribute("uuid");
    processing.removeAttribute("desc");
    glyphTrack.script.spstreamXML = serializer.serializeToString(processing);
  }

  if(!glyphTrack.script && (glyphTrack.glyphStyle == "signal-histogram" || 
                            glyphTrack.glyphStyle == "split-signal" ||
                            glyphTrack.glyphStyle == "1D-heatmap" ||
                            glyphTrack.glyphStyle == "experiment-heatmap")) {     
    glyphTrack.spstream_mode = "expression";
  }

  //expression_binning
  var expressbinDOM = trackDOM.getElementsByTagName("expression_binning")[0];
  if(expressbinDOM) {
    glyphTrack.spstream_mode = "expression";
    if(expressbinDOM.getAttribute("overlap_mode")) { glyphTrack.overlap_mode = expressbinDOM.getAttribute("overlap_mode"); }
    if(expressbinDOM.getAttribute("binning")) { glyphTrack.binning = expressbinDOM.getAttribute("binning"); }
    if(expressbinDOM.getAttribute("strandless")) { glyphTrack.exprbin_strandless = expressbinDOM.getAttribute("strandless"); }
    if(expressbinDOM.getAttribute("subfeatures")) { glyphTrack.exprbin_subfeatures = expressbinDOM.getAttribute("subfeatures"); }
    if(expressbinDOM.getAttribute("binsize")) { glyphTrack.exprbin_binsize = expressbinDOM.getAttribute("binsize"); }
  }
  
  if(trackDOM.getAttribute("source_outmode")) { 
    glyphTrack.source_outmode = trackDOM.getAttribute("source_outmode");
    if(glyphTrack.source_outmode == "feature") { glyphTrack.source_outmode = "full_feature"; }
  } 

  if(!glyphTrack.source_outmode) {
    //for legacy support
    glyphTrack.source_outmode  = "simple_feature";
    
    if(glyphTrack.glyphStyle=='express') { glyphTrack.source_outmode = "expression"; }
    if(glyphTrack.glyphStyle=='signal-histogram' || glyphTrack.glyphStyle == "split-signal") { glyphTrack.source_outmode = "expression"; }
    if(glyphTrack.glyphStyle=='xyplot') { glyphTrack.source_outmode = "full_feature"; }
    
    if(glyphTrack.glyphStyle=='transcript' || 
       glyphTrack.glyphStyle=='probesetloc' || 
       glyphTrack.glyphStyle=='thin-transcript' || 
       glyphTrack.glyphStyle=='thick-transcript') { glyphTrack.source_outmode = "subfeature"; }
    
    if(glyphTrack.spstream_mode == "expression") { glyphTrack.source_outmode = "expression"; }

    if(glyphTrack.glyphStyle=='1D-heatmap' ||
       glyphTrack.glyphStyle=='experiment-heatmap' || 
       glyphTrack.glyphStyle=='seqtag') { glyphTrack.source_outmode = "full_feature"; }
    
    if(glyphTrack.colorMode=="signal" || glyphTrack.script) { glyphTrack.source_outmode = "full_feature"; }
  }

  //special code to patch configs from <2.5 into the 2.5+ logic
  //  older configs allow for script + default-express binning to be appended after the script.
  //  2.5 does not. so these old configs must be patched
  if(glyphTrack.script &&
      (glyphTrack.glyphStyle == "signal-histogram" ||
       glyphTrack.glyphStyle == "1D-heatmap" ||
       glyphTrack.glyphStyle == "split-signal" ||
       glyphTrack.glyphStyle == "experiment-heatmap") &&
      trackDOM.getAttribute("binning") &&
      (trackDOM.getAttribute("submode") || trackDOM.getAttribute("overlap_mode")) ) {
    //run the patch
    gLyphsPatchOldBinningPlusScript(glyphTrack, trackDOM);
  }
       
  return glyphTrack;
}


function gLyphsGenerateTrackConfigDOM(trackID) {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return undefined; }

  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = glyphTrack.glyphsSaveTrackConfig;

  var config = doc.createElement("eeDBgLyphsTrackConfig");
  doc.appendChild(config);

  var collab = config.appendChild(doc.createElement("collaboration"));
  collab.setAttribute("uuid", current_collaboration.uuid);
  collab.setAttribute("name", current_collaboration.name);
  
  if(!saveconfig.desc) { saveconfig.desc = ""; }

  var summary = doc.createElement("summary");
  summary.setAttribute("title", saveconfig.title);
  if(eedbCurrentUser) { summary.setAttribute("creator_openID", eedbCurrentUser.openID); }
  summary.setAttribute("desc", saveconfig.desc);
  summary.setAttribute("asm", current_region.asm);
  config.appendChild(summary);

  var trackDOM = glyphsGenerateTrackDOM(glyphTrack);
  config.appendChild(trackDOM);

  return doc;
}


function gLyphsUploadTrackConfigXML(glyphTrack, configDOM) {
  var serializer = new XMLSerializer();
  var xml = serializer.serializeToString(configDOM);

  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = xml.indexOf("<eeDBgLyphsTrackConfig>");
  if(idx1 > 0) { xml = xml.substr(idx1); }

  //zenbu2.6
  var saveconfig = glyphTrack.glyphsSaveTrackConfig;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode>\n";
  if(saveconfig.title) { paramXML += "<configname>"+ encodehtml(saveconfig.title) + "</configname>"; }
  if(saveconfig.desc) { paramXML += "<description>"+ encodehtml(saveconfig.desc) + "</description>"; }

  paramXML += "<collaboration_uuid>"+ current_collaboration.uuid +"</collaboration_uuid>\n";

  paramXML += "<configXML>" + xml + "</configXML>";
  paramXML += "</zenbu_query>\n";

  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);
  //return;

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }

  configXHR.open("POST",eedbConfigCGI,false); //synchronous, wait until returns
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //configXHR.setRequestHeader("Content-length", paramXML.length);
  //configXHR.setRequestHeader("Connection", "close");
  configXHR.send(paramXML);

  if(configXHR.readyState!=4) return "";
  if(configXHR.responseXML == null) return "";
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null)  return "";

  var saveConfig = xmlDoc.getElementsByTagName("configXML")[0];
  if(!saveConfig) { return ""; }
  uuid = saveConfig.getAttribute("uuid");
  return uuid;
}


function gLyphsLoadTrackConfigUUID(trackUUID) {
  //given a trackUUID(config), queries the config_server for full XML info.
  //if available, then it parses the XML and reconfigures the view
  //return value is true/false depending on success of reconfig

  var url = eedbConfigCGI + "?uuid=" + trackUUID;
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

  return gLyphsLoadTrackConfig(xmlDoc);
}


function gLyphsLoadTrackConfig(configDOM) {
  //--------------------------------
  eedbEmptySearchResults("glyphsSearchBox1");

  //document.getElementById("message").innerHTML = "gLyphsLoadTrackConfig";

  var glyphset = document.getElementById("gLyphTrackSet");
  var newtrack_div = glyphset.lastChild;

  var uuid = "";
  if(configDOM.getElementsByTagName("trackUUID")) { 
    var trackUUID = configDOM.getElementsByTagName("trackUUID");
    if(trackUUID && trackUUID.length>0) { uuid = trackUUID[0].firstChild.nodeValue; }
  }
  if(configDOM.getAttribute("uuid")) { uuid = configDOM.getAttribute("uuid"); }

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  if(!tracks) { return false; }
  if(tracks.length == 0) { return false; }
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];
    
    var glyphTrack = gLyphsCreateTrackFromTrackDOM(trackDOM);
    glyphTrack.hideTrack  = false;
    if(!glyphTrack.uuid && uuid) { glyphTrack.uuid = uuid; }

    gLyphTrack_array[glyphTrack.trackID] = glyphTrack;
    glyphset.insertBefore(glyphTrack.trackDiv, newtrack_div);

    eedbAddSearchTrack("glyphsSearchBox1", glyphTrack.source_ids, glyphTrack.title);

    gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
    prepareTrackXHR(glyphTrack.trackID);
  }
  //gLyphsAutosaveConfig();

  return;

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
    var glyphset = document.getElementById("gLyphTrackSet");
    var newtrack_div = glyphset.lastChild;
  }

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];

    var glyphTrack = gLyphsCreateTrackFromTrackDOM(trackDOM);
    glyphTrack.hideTrack  = false;
    //replace sources with those from templage
    glyphTrack.source_ids     = template.source_ids;
    glyphTrack.exptype        = template.exptype;
    glyphTrack.source_outmode = template.source_outmode;
    
    //retitle the track
    glyphTrack.title = template.title + " " + glyphTrack.title;

    //add into view
    gLyphTrack_array[glyphTrack.trackID] = glyphTrack;

    if(!dexMode) {
      glyphset.insertBefore(glyphTrack.trackDiv, newtrack_div);
      gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
      prepareTrackXHR(glyphTrack.trackID);
    }
  }
  
  removeTrack(template.trackID); //removing the template track
  if(!dexMode) { 
    gLyphsInitSearchFromTracks();
    gLyphsAutosaveConfig();
  }
  return true;
}

//
//======================================================================================
//

function gLyphsInitSearchFromTracks() {
  var searchSetID ="glyphsSearchBox1";

  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  clearKids(searchset);

  var searchID = eedbAddSearchTrack(searchSetID, "eeDB_gLyphs_configs", "view configs");
  var searchTrack = eedbSearchGetSearchTrack(searchID, searchSetID);
  if(searchTrack) { searchTrack.callOutFunction = gLyphsLoadSearchView; }

  var glyphset = document.getElementById("gLyphTrackSet");
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    if(glyphTrack.noNameSearch) { continue; }
    if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot") { continue; }
    if(glyphTrack.glyphStyle == "split-signal") { continue; }
    if(glyphTrack.glyphStyle == "cytoband") { continue; }
    if(!glyphTrack.source_ids) { continue; }
    //for now only modern tracks with source_ids will be allowed

    eedbAddSearchTrack(searchSetID, glyphTrack.source_ids, glyphTrack.title);
  }
}


function gLyphsLoadSearchView(searchID, uuid, state) {
  //document.getElementById("message").innerHTML = "load view[" +uuid+"]";
  gLyphsInitViewConfigUUID(uuid);
  //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
  gLyphsChangeDhtmlHistoryLocation();
  reloadRegion();
}


function gLyphsPatchOldBinningPlusScript(glyphTrack, trackDOM) {
  //special code to patch configs from <2.5 into the 2.5+ logic
  //  older configs allow for script + default-express binning to be appended after the script.
  //  2.5 does not. so these old configs must be patched
  if(!glyphTrack) { return; }
  if(!glyphTrack.script) { return; }
  if(!trackDOM) { return; }
  
  var processingDOM = trackDOM.getElementsByTagName("zenbu_script")[0];
  if(!processingDOM) { return; }

  //get the epxress-binning params
  if(trackDOM.getAttribute("submode"))      { glyphTrack.overlap_mode = trackDOM.getAttribute("submode"); }
  if(trackDOM.getAttribute("overlap_mode")) { glyphTrack.overlap_mode = trackDOM.getAttribute("overlap_mode"); }
  if(trackDOM.getAttribute("binning"))      { glyphTrack.binning = trackDOM.getAttribute("binning"); }

  processingDOM.removeAttribute("name");
  processingDOM.removeAttribute("uuid");
  processingDOM.removeAttribute("desc");

  //document.getElementById("message").innerHTML += "scriptpatch[" + glyphTrack.title + " " + glyphTrack.overlap_mode+ " " +glyphTrack.binning+"] ";

  //generate the replacement TemplateCluster/FeatureEmitter code

  var doc = trackDOM.ownerDocument

  var feature_emitter = doc.createElement("spstream");
  feature_emitter.setAttribute("module", "FeatureEmitter");
  var p1 = feature_emitter.appendChild(doc.createElement("fixed_grid"));
  p1.appendChild(doc.createTextNode("true"));
  var p2 = feature_emitter.appendChild(doc.createElement("both_strands"));
  if(glyphTrack.strandless) { 
    p2.appendChild(doc.createTextNode("false"));
  } else { 
    p2.appendChild(doc.createTextNode("true"));
  }

  var tcluster = doc.createElement("spstream");
  tcluster.setAttribute("module", "TemplateCluster");
  var p3 = tcluster.appendChild(doc.createElement("overlap_mode"));
  p3.appendChild(doc.createTextNode(glyphTrack.overlap_mode));
  var p4 = tcluster.appendChild(doc.createElement("expression_mode"));
  p4.appendChild(doc.createTextNode(glyphTrack.binning));
  var ss = tcluster.appendChild(doc.createElement("side_stream"));
  ss.appendChild(feature_emitter);

  var streamstack = processingDOM.getElementsByTagName("stream_stack")[0];
  if(streamstack) {
    var spstreams = streamstack.getElementsByTagName("spstream");
    if(spstreams.length == 0) { streamstack.appendChild(tcluster); }
    else {
      streamstack.insertBefore(tcluster, spstreams[0]);
    }
  }

  var streamqueue = processingDOM.getElementsByTagName("stream_queue")[0];
  if(streamqueue) {
    streamstack.appendChild(tcluster);
  }
  var streamqueue = processingDOM.getElementsByTagName("stream_processing")[0];
  if(streamqueue) {
    streamstack.appendChild(tcluster);
  }

  //generate XML string for new modified script
  var serializer = new XMLSerializer();
  var xmlStr = serializer.serializeToString(processingDOM);
  xmlStr = xmlStr.replace(/></g,">\n\t<");
  glyphTrack.script.spstreamXML = xmlStr;
  
  //finish cleanup
  glyphTrack.spstream_mode = "custom";
  glyphTrack.overlap_mode  = "";
  //glyphTrack.binning       = ""; 
}


//---------------------------------------------------------------
//
// script configuration / save
// 
//---------------------------------------------------------------


function gLyphsParseStreamProcssingXML(spstreamXML) {
  if(!spstreamXML) { return undefined; }

  var parser = new DOMParser();
  var spstreamDOM = parser.parseFromString(spstreamXML, "text/xml");
  if(!spstreamDOM) { return undefined; }
  if(!spstreamDOM.documentElement) { return undefined; }
  if(spstreamDOM.documentElement.tagName != "zenbu_script") { return undefined; }

  return spstreamDOM;
}


function glyphsSaveScriptConfig(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  eedbCurrentUser = eedbShowLogin();
  if(!eedbCurrentUser) {
    gLyphsNoUserWarn("save a script");
    return;
  }

  glyphTrack.saveScriptConfig = new Object;
  var saveconfig = glyphTrack.saveScriptConfig;

  var script = glyphTrack.script;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.script !== undefined)) { script = glyphTrack.newconfig.script; }
  if(script) {
    saveconfig.name  = script.name;
    saveconfig.desc  = script.desc;
  }
  if(!saveconfig.name) { saveconfig.name  = glyphTrack.title; }
  if(!saveconfig.desc) { saveconfig.desc  = ""; }


  var mymatch = /^modified\.(.+)$/.exec(saveconfig.name);
  if(mymatch && (mymatch.length == 2)) {
    saveconfig.name = mymatch[1];
  }
  mymatch = /^(.+)\.(\d+)$/.exec(saveconfig.name);
  if(mymatch && (mymatch.length == 3)) {
    saveconfig.name =  mymatch[1] + "." + (parseInt(mymatch[2])+1);
  } else {
    saveconfig.name += ".1";
  }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var svg = glyphTrack.svg;
  if(!svg) return;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos-300) +"px; "
                            +"width:350px;"
                             );

  var tdiv, tspan, tinput;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Save ZENBU stream processing script";
  divFrame.appendChild(tdiv)

  //----------
  var userDiv = divFrame.appendChild(document.createElement('div'));
  userDiv.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  var userSpan = userDiv.appendChild(document.createElement('span'));
  userSpan.setAttribute('style', "padding:0px 0px 0px 0px;");
  userSpan.innerHTML = "user:";
  var name_span = userDiv.appendChild(document.createElement('span'));
  name_span.setAttribute("style", "padding:0px 0px 0px 10px; font-weight:bold; color:rgb(94,115,153);");
  name_span.innerHTML = "guest";
  if(eedbCurrentUser) {
    if(eedbCurrentUser.nickname) { name_span.innerHTML = eedbCurrentUser.nickname; }
    else { name_span.innerHTML = eedbCurrentUser.openID; }
  }

  var div1 = divFrame.appendChild(document.createElement('div'));
  var collabWidget = eedbCollaborationSelectWidget();
  div1.appendChild(collabWidget);

  //----------
  tdiv = document.createElement('div');
  tspan = document.createElement('span');
  tspan.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML = "script name:";
  tdiv.appendChild(tspan);
  var tinput = document.createElement('input');
  tinput.setAttribute('style', "width:200px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  tinput.setAttribute('type', "text");
  tinput.setAttribute('value', saveconfig.name);
  tinput.setAttribute("onkeyup", "glyphsSaveScriptConfigParam(\""+ trackID+"\", 'name', this.value);");
  tdiv.appendChild(tinput);
  divFrame.appendChild(tdiv)

  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute('value', saveconfig.desc);
  descInput.innerHTML = saveconfig.desc;
  descInput.setAttribute("onkeyup", "glyphsSaveScriptConfigParam(\""+ trackID+"\", 'desc', this.value);");
  divFrame.appendChild(descInput);


  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "glyphsSaveScriptConfigParam(\""+ trackID+"\", 'cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save script");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "glyphsSaveScriptConfigParam(\""+ trackID+"\", 'accept');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
  glyphTrack.saveScriptConfig.interface = divFrame;
}


function glyphsSaveScriptConfigParam(trackID, param, value) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var saveconfig = glyphTrack.saveScriptConfig;
  if(saveconfig === undefined) { return; }
  var saveConfigDiv = glyphTrack.saveScriptConfig.interface;

  if(param == "name") { saveconfig.name = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  if(param == "cancel") {
    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.saveScriptConfig = undefined;
  }

  if(param == "accept") {
    var configDOM = glyphsGenerateScriptConfigDOM(trackID);
    var uuid = glyphsUploadScriptConfigXML(glyphTrack, configDOM);
    if(!glyphTrack.script) { glyphTrack.script = new Object; }
    if(uuid) {
      glyphTrack.script.uuid  = uuid;
      glyphTrack.script.name  = saveconfig.name;
      glyphTrack.script.desc  = saveconfig.desc;
    }

    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.saveScriptConfig = undefined;
    gLyphsDrawTrack(trackID);
    if(uuid) { gLyphsAutosaveConfig(); }
  }
}


function glyphsGenerateScriptConfigDOM(trackID) {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return undefined; }

  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = glyphTrack.saveScriptConfig;

  var config = doc.createElement("ZENBU_script_config");
  doc.appendChild(config);

  var collab = config.appendChild(doc.createElement("collaboration"));
  collab.setAttribute("uuid", current_collaboration.uuid);
  collab.setAttribute("name", current_collaboration.name);
  
  if(!saveconfig.desc) { saveconfig.desc = ""; }

  var summary = doc.createElement("summary");
  if(saveconfig.name) { summary.setAttribute("name", saveconfig.name); }
  if(eedbCurrentUser) {
    summary.setAttribute("user", eedbCurrentUser.nickname);
    summary.setAttribute("creator_openID", eedbCurrentUser.openID);
  }
  if(saveconfig.desc) { summary.setAttribute("desc", saveconfig.desc); }
  config.appendChild(summary);

  var script = glyphTrack.script;
  if(glyphTrack.newconfig && (glyphTrack.newconfig.script !== undefined)) { script = glyphTrack.newconfig.script; }
  if(script) {
    var spstreamDOM = gLyphsParseStreamProcssingXML(script.spstreamXML);
    if(spstreamDOM) {
      config.appendChild(spstreamDOM.documentElement);
    }
  }    
  return doc;
}


function glyphsUploadScriptConfigXML(glyphTrack, configDOM) {
  var serializer = new XMLSerializer();
  var xml = serializer.serializeToString(configDOM);

  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = xml.indexOf("<ZENBU_script_config>");
  if(idx1 > 0) { xml = xml.substr(idx1); }


  //zenbu2.6
  var saveconfig = glyphTrack.saveScriptConfig;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode>\n";
  if(saveconfig.name) { paramXML += "<configname>"+ encodehtml(saveconfig.name) + "</configname>"; }
  if(saveconfig.desc) { paramXML += "<description>"+ encodehtml(saveconfig.desc) + "</description>"; }

  paramXML += "<collaboration_uuid>"+ current_collaboration.uuid +"</collaboration_uuid>\n";

  paramXML += "<configXML>" + xml + "</configXML>";
  paramXML += "</zenbu_query>\n";

  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);
  //return;

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }

  configXHR.open("POST",eedbConfigCGI,false); //synchronous, wait until returns
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //configXHR.setRequestHeader("Content-length", paramXML.length);
  //configXHR.setRequestHeader("Connection", "close");
  configXHR.send(paramXML);

  if(configXHR.readyState!=4) { return null; }
  if(configXHR.responseXML == null) { return null; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null)  { return null; }

  var uuid = null;
  if(xmlDoc.getElementsByTagName("configXML")) {
    var saveConfig = xmlDoc.getElementsByTagName("configXML")[0];
    if(!saveConfig) { return null; }
    uuid = saveConfig.getAttribute("uuid");
  }
  return uuid;
}


function glyphsLoadScriptConfig(trackID, configUUID) {
  //for loading a predefined script into the interface
  //given a configUUID, queries the config_server for full XML info.
  //if available, then it parses the XML and reconfigures the view
  //return value is true/false depending on success of reconfig

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return undefined; }

  var url = eedbConfigCGI + "?format=configXML;uuid=" + configUUID;
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

  //OK go ahead and load the script
  if(xmlDoc.tagName != "ZENBU_script_config") { return undefined; }

  var processing = xmlDoc.getElementsByTagName("zenbu_script")[0];
  if(!processing) { return false; }

  var serializer = new XMLSerializer();

  var script = new Object;
  script.uuid = configUUID;
  script.spstreamXML = "";

  var summary = xmlDoc.getElementsByTagName("summary")[0];
  if(summary) {
    script.name = summary.getAttribute("name");
    script.desc = summary.getAttribute("desc");
  }
  if(!script.name) { script.name=""; }
  if(!script.desc) { script.desc=""; }

  processing.removeAttribute("name");
  processing.removeAttribute("uuid");
  processing.removeAttribute("desc");
  script.spstreamXML = serializer.serializeToString(processing);

  glyphTrack.newconfig.script = script;

  // new defaults section which will load track-config defaults when loading a predefined script
  // into the interface
  var defaults = xmlDoc.getElementsByTagName("track_defaults")[0];
  if(defaults) {
    if(defaults.getAttribute("scorecolor") !== undefined) {
      if(defaults.getAttribute("scorecolor") == "") {  
        reconfigTrackParam(trackID, "scorecolor", false);
      } else {
        reconfigTrackParam(trackID, "scorecolor", true);
        reconfigTrackParam(trackID, "colorspace", defaults.getAttribute("scorecolor"));
      }
    }

    if(defaults.getAttribute("glyphStyle")) { reconfigTrackParam(trackID, "glyphStyle", defaults.getAttribute("glyphStyle")); }
    if(defaults.getAttribute("backColor") !== undefined) { reconfigTrackParam(trackID, "backColor", defaults.getAttribute("backColor")); }
    if(defaults.getAttribute("posStrandColor") !== undefined) { reconfigTrackParam(trackID, "posStrandColor", defaults.getAttribute("posStrandColor")); }
    if(defaults.getAttribute("revStrandColor") !== undefined) { reconfigTrackParam(trackID, "revStrandColor", defaults.getAttribute("revStrandColor")); }

    if(defaults.getAttribute("hidezeroexps") == "true") { reconfigTrackParam(trackID, "hidezeroexps", true); }
    if(defaults.getAttribute("hidezeroexps") == "false") { reconfigTrackParam(trackID, "hidezeroexps", false); }

    //below are not tested to see if the reconfig panel updates correctly
    if(defaults.getAttribute("exptype")) { reconfigTrackParam(trackID, "exptype", defaults.getAttribute("exptype")); }
    if(defaults.getAttribute("datatype")) { reconfigTrackParam(trackID, "datatype", defaults.getAttribute("datatype")); }
    if(defaults.getAttribute("source_outmode")) { reconfigTrackParam(trackID, "source_outmode", defaults.getAttribute("source_outmode")); }

    if(defaults.getAttribute("height")) { 
      reconfigTrackParam(trackID, "height", defaults.getAttribute("height")); 
      var heightInput = document.getElementById(trackID + "_trackHeightInput");
      if(heightInput) { heightInput.value = defaults.getAttribute("height"); } 
    }
    if(defaults.getAttribute("expscaling")) { reconfigTrackParam(trackID, "expscaling", defaults.getAttribute("expscaling")); }

    if(defaults.getAttribute("strandless") == "true") { reconfigTrackParam(trackID, "strandless", true); }
    if(defaults.getAttribute("strandless") == "false") { reconfigTrackParam(trackID, "strandless", false); }

    if(defaults.getAttribute("logscale") == "true") { reconfigTrackParam(trackID, "logscale", true); }
    if(defaults.getAttribute("logscale") == "false") { reconfigTrackParam(trackID, "logscale", false); }

    /*
    if(defaults.getAttribute("nocache") == "true") { glyphTrack.noCache = true; }
    if(defaults.getAttribute("datatype")) { glyphTrack.datatype = defaults.getAttribute("datatype"); }
    if(defaults.getAttribute("exptype")) {
      glyphTrack.exptype = defaults.getAttribute("exptype");
      if(!glyphTrack.datatype) { glyphTrack.datatype = glyphTrack.exptype; }
    }
    if(defaults.getAttribute("height")) { glyphTrack.track_height  = Math.floor(defaults.getAttribute("height")); }
    if(defaults.getAttribute("source_outmode")) { glyphTrack.source_outmode = defaults.getAttribute("source_outmode"); }
    */

    //refresh the panel
    createGlyphstyleSelect(glyphTrack);
  }

  reconfigureStreamParams(trackID);
}


//---------------------------------------------------------------
//
// user annotaton section
// 
//---------------------------------------------------------------


function glyphsUserAnnotationPanel(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  if(glyphTrack.selection == null) { return; }

  glyphTrack.userAnnotate = new Object;
  var saveconfig = glyphTrack.userAnnotate;
  if(!saveconfig.name) { saveconfig.name  = "annotation"; }
  if(!saveconfig.desc) { saveconfig.desc  = glyphTrack.title; }


  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var svg = glyphTrack.svg;
  if(!svg) return;

  var selection = glyphTrack.selection;
  var chromLoc = current_region.asm +" "+ current_region.chrom +":"+ selection.chrom_start +".."+ selection.chrom_end;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos-300) +"px; "
                            +"width:350px;"
                             );

  var tdiv, tspan, tinput;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "ZENBU user annotation";
  divFrame.appendChild(tdiv)


  //----------
  var userDiv = divFrame.appendChild(document.createElement('div'));
  userDiv.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  var userSpan = userDiv.appendChild(document.createElement('span'));
  userSpan.setAttribute('style', "padding:0px 0px 0px 0px;");
  userSpan.innerHTML = "user:";
  var name_span = userDiv.appendChild(document.createElement('span'));
  name_span.setAttribute("style", "padding:0px 0px 0px 10px; font-weight:bold; color:rgb(94,115,153);");
  name_span.innerHTML = "guest";
  if(eedbCurrentUser) {
    if(eedbCurrentUser.nickname) { name_span.innerHTML = eedbCurrentUser.nickname; }
    else { name_span.innerHTML = eedbCurrentUser.openID; }
  }

  //----------
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "location:  ";
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "padding:0px 0px 0px 10px; font-weight:bold; color:rgb(0,153,115);");
  tspan.innerHTML = chromLoc;

  //----------
  var div1 = divFrame.appendChild(document.createElement('div'));
  var collabWidget = eedbCollaborationSelectWidget();
  div1.appendChild(collabWidget);

  //----------
  tdiv = divFrame.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML = "name:";
  var tinput = tdiv.appendChild(document.createElement('input'));
  tinput.setAttribute('style', "width:200px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  tinput.setAttribute('type', "text");
  tinput.setAttribute('value', saveconfig.name);
  tinput.setAttribute("onkeyup", "glyphsUserAnnotationParam(\""+ trackID+"\", 'name', this.value);");

  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute('value', saveconfig.desc);
  descInput.innerHTML = saveconfig.desc;
  descInput.setAttribute("onkeyup", "glyphsUserAnnotationParam(\""+ trackID+"\", 'desc', this.value);");
  divFrame.appendChild(descInput);


  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "glyphsUserAnnotationParam(\""+ trackID+"\", 'cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save annotation");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "glyphsUserAnnotationParam(\""+ trackID+"\", 'accept');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
  glyphTrack.userAnnotate.interface = divFrame;
}


function glyphsUserAnnotationParam(trackID, param, value) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var saveconfig = glyphTrack.userAnnotate;
  if(saveconfig === undefined) { return; }
  var saveConfigDiv = glyphTrack.userAnnotate.interface;

  if(param == "name") { saveconfig.name = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  if(param == "cancel") {
    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.userAnnotate = undefined;
    gLyphsDrawTrack(trackID);
  }

  if(param == "accept") {
    var configDOM = glyphsGenerateUserAnnotationDOM(trackID);
    glyphsUploadUserAnnotationXML(glyphTrack, configDOM);
    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.userAnnotate = undefined;
    gLyphsDrawTrack(trackID);
  }
}


function glyphsGenerateUserAnnotationDOM(trackID) {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return undefined; }

  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = glyphTrack.userAnnotate;

  if(!saveconfig.desc) { saveconfig.desc = ""; }

  var config = doc.createElement("ZENBU_user_annotation");
  doc.appendChild(config);

  var collab = config.appendChild(doc.createElement("collaboration"));
  collab.setAttribute("uuid", current_collaboration.uuid);
  collab.setAttribute("name", current_collaboration.name);
  
  var loc = doc.createElement("region");
  loc.setAttribute("asm",    current_region.asm);
  loc.setAttribute("chrom",  current_region.chrom);
  loc.setAttribute("start",  glyphTrack.selection.chrom_start);
  loc.setAttribute("end",    glyphTrack.selection.chrom_end);
  config.appendChild(loc);


  var summary = config.appendChild(doc.createElement("summary"));
  if(saveconfig.name) { summary.setAttribute("name", saveconfig.name); }
  if(saveconfig.desc) { summary.setAttribute("desc", saveconfig.desc); }

  return doc;
}


function glyphsUploadUserAnnotationXML(glyphTrack, configDOM) {
  var serializer = new XMLSerializer();
  var xml = serializer.serializeToString(configDOM);

  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = xml.indexOf("<ZENBU_user_annotation>");
  if(idx1 > 0) { xml = xml.substr(idx1); }

  //zenbu2.6
  var saveconfig = glyphTrack.userAnnotate;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode>\n";
  if(saveconfig.name) { paramXML += "<configname>"+ encodehtml(saveconfig.name) + "</configname>"; }
  if(saveconfig.desc) { paramXML += "<description>"+ encodehtml(saveconfig.desc) + "</description>"; }

  paramXML += "<collaboration_uuid>"+ current_collaboration.uuid +"</collaboration_uuid>\n";

  paramXML += "<configXML>" + xml + "</configXML>";
  paramXML += "</zenbu_query>\n";

  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);
  //return;

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }

  configXHR.open("POST",eedbConfigCGI,false); //synchronous, wait until returns
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //configXHR.setRequestHeader("Content-length", paramXML.length);
  //configXHR.setRequestHeader("Connection", "close");
  configXHR.send(paramXML);

  if(configXHR.readyState!=4) { return null; }
  if(configXHR.responseXML == null) { return null; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null)  { return null; }

  var uuid = null;
  if(xmlDoc.getElementsByTagName("configXML")) {
    var saveConfig = xmlDoc.getElementsByTagName("configXML")[0];
    if(!saveConfig) { return null; }
    uuid = saveConfig.getAttribute("uuid");
  }
  return uuid;
}



//----------------------------------------------------
// 
// visualization save/print to SVG
//
//----------------------------------------------------

function configureExportSVG() {
  var saveDiv = document.getElementById("global_panel_layer");
  if(saveDiv === undefined) { return; }
  if(!saveDiv) { return; }
  
  if(current_region.exportSVGconfig == undefined) { 
    current_region.exportSVGconfig = new Object;
    current_region.exportSVGconfig.title = current_region.configname;
    current_region.exportSVGconfig.savefile = false;
    current_region.exportSVGconfig.hide_widgets = false;
    current_region.exportSVGconfig.savefile = false;
    current_region.exportSVGconfig.hide_sidebar = false;
    current_region.exportSVGconfig.hide_titlebar = false;
    current_region.exportSVGconfig.hide_experiment_graph = false;
    current_region.exportSVGconfig.hide_compacted_tracks = false;
  }
  var exportConfig = current_region.exportSVGconfig;

  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos + 10;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                                +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                                //+"left:" + ((winW/2)-250) +"px; top:" + (toolTipSTYLE.ypos+10) +"px; "
                                +"left:"+(xpos-350)+"px; top:"+(ypos)+"px; "
                                +"width:350px; z-index:90; "
                             );
  var tdiv, tdiv2, tspan1, tspan2, tinput, tcheck;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "exportSVGConfigParam('svg-cancel'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");


  //title
  tdiv = document.createElement('h3');
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
  if(exportConfig.hide_widgets) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "exportSVGConfigParam('widgets', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide widgets";

  tdiv2 = tdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig.savefile) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "exportSVGConfigParam('savefile', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "save to file";

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig.hide_sidebar) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "exportSVGConfigParam('sidebar', this.checked);");
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide track sidebars";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig.hide_titlebar) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "exportSVGConfigParam('titlebar', this.checked);");
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide title bar";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig.hide_experiment_graph) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "exportSVGConfigParam('experiments', this.checked);");
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide experiment/expression graph";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(exportConfig.hide_compacted_tracks) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "exportSVGConfigParam('compacted_tracks', this.checked);");
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide compacted tracks";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "exportSVGConfigParam('svg-cancel','');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "export svg");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "exportSVGConfigParam('svg-accept','');");
  divFrame.appendChild(button2);

  saveDiv.innerHTML = "";
  saveDiv.appendChild(divFrame);
}


function exportSVGConfigParam(param, value) {
  var exportDiv = document.getElementById("global_panel_layer");
  if(exportDiv === undefined) { return; }
  if(!exportDiv) { return; }

  var exportSVGconfig = current_region.exportSVGconfig;
  if(exportSVGconfig === undefined) { 
    exportDiv.innerHTML ="";
    return;
  }

  if(param == "widgets") { exportSVGconfig.hide_widgets = value; }
  if(param == "savefile") { exportSVGconfig.savefile = value; }
  if(param == "sidebar") { exportSVGconfig.hide_sidebar = value; }
  if(param == "titlebar") { exportSVGconfig.hide_titlebar = value; }
  if(param == "experiments") { exportSVGconfig.hide_experiment_graph = value; }
  if(param == "compacted_tracks") { exportSVGconfig.hide_compacted_tracks = value; }

  if(param == "name") { exportSVGconfig.name = value; }
  if(param == "desc")  { exportSVGconfig.desc = value; }
  if(param == "svg-cancel") {
    exportDiv.innerHTML ="";
    current_region.exportSVGconfig = undefined;
    redrawRegion(false); //need to redraw everything in case user caused track to draw without events while panel was open
  }

  if(param == "svg-accept") {
    exportDiv.innerHTML ="";
    gLyphsPostSVG();
  }
}


function gLyphsPostSVG() {
  var saveDiv = document.getElementById("global_panel_layer");
  if(!saveDiv) { return; }
  saveDiv.innerHTML = "";

  var savefile = current_region.exportSVGconfig.savefile;

  var xml = generateSvgXML();

  var form = saveDiv.appendChild(document.createElement('form'));
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
  input1.setAttribute("value", current_region.configname);

  var input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "description");
  input1.setAttribute("value", current_region.desc);

  input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "savefile");
  input1.setAttribute("value", savefile);

  input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "svg");
  input1.setAttribute("value", xml);

  form.submit();
}


function generateSvgXML() {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  if(!current_region.exportSVGconfig) { 
    current_region.exportSVGconfig = new Object;
    current_region.exportSVGconfig.title = current_region.configname;
    current_region.exportSVGconfig.savefile = false;
  }

  var serializer = new XMLSerializer();

  var text = "";
  //var text = "<?xml version=\"1.0\" standalone=\"no\"?>\n";
  //text += "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
  //text += "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"100%\" width=\""+ (current_region.display_width+30) +"\" >\n";
  text += "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"100%\" width=\"100%\" >\n";

  var export_g1 = document.createElementNS(svgNS,'g');

  var exp_g1;
  if(!current_region.exportSVGconfig.hide_experiment_graph) { 
    var exp_g1 = document.createElementNS(svgNS,'g');
    
    var header_g = gLyphsExpressionPanelHeader();
    exp_g1.appendChild(header_g);
    
    var graph_g1 = gLyphsRenderExpressionPanelGraph();
    graph_g1.setAttributeNS(svgNS, 'transform', "translate(0,30)");
    exp_g1.appendChild(graph_g1);
  }

  var track_ypos = 0;

  var glyphset = document.getElementById("gLyphTrackSet");
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    if(glyphTrack.hideTrack && current_region.exportSVGconfig.hide_compacted_tracks) { continue; }

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
    gLyphsDrawExperimentExpression();
    exp_g1.setAttributeNS(null, 'transform', "translate(10,"+ track_ypos  + ")");
    //exp_g1.setAttributeNS(null, "x", "10px");
    //exp_g1.setAttributeNS(null, "y", track_ypos + "px");
    //text += serializer.serializeToString(exp_g1);
  }

  text += serializer.serializeToString(export_g1);

  text += "</svg>\n";

  //remove the exportSVGconfig and redraw the interactive view
  current_region.exportSVGconfig = undefined;
  redrawRegion(false);

  return text;
}


//----------------------------------------------------
// 
// global settings panel
//
//----------------------------------------------------

function glyphsGlobalSettingsPanel() {
  var globalLayer = document.getElementById("global_panel_layer");
  if(!globalLayer) { return; }
  if(globalLayer === undefined) { return; }
  
  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos + 10;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                                +"border:inset; border-width:1px; padding: 3px 3px 10px 3px; "
                                //+"left:" + ((winW/2)-250) +"px; top:" + (toolTipSTYLE.ypos+10) +"px; "
                                +"left:"+(xpos-350)+"px; top:"+(ypos)+"px; "
                                +"width:350px; z-index:90; "
                             );
  var tdiv, tdiv2, tspan1, tspan2, tinput, tcheck;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "glyphsChangeGlobalSetting('close'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");


  //title
  tdiv = document.createElement('h3');
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
  widthInput.setAttribute("type", "text");
  widthInput.setAttribute("size", "5");
  widthInput.setAttribute("style", "font-size:10px;");
  widthInput.setAttribute("value", current_region.display_width);
  //widthInput.setAttribute("onkeydown", "if(event.keyCode==13) { gLyphsChangeExpressRegionConfig('dwidth', this.value, this)}");
  widthInput.setAttribute("onkeydown", "if(event.keyCode==13) { glyphsChangeGlobalSetting('dwidth', this.value)}");

  //----------
  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(current_region.hide_compacted_tracks) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "glyphsChangeGlobalSetting('compacted_tracks', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide compacted tracks";

  //----------
  tdiv2 = leftdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(current_region.flip_orientation) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "glyphsChangeGlobalSetting('flip_orientation', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "flip strand orientation";

  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(current_region.auto_flip) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "glyphsChangeGlobalSetting('auto_flip', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "auto flip to centered feature";

  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(current_region.nocache) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "glyphsChangeGlobalSetting('nocache', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "global no caching";

  //feature highligh search
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:100%; margin:3px 0px 0px 7px; font-size:10px;");
  var span1 = tdiv.appendChild(document.createElement("span"));
  span1.setAttribute("style", "font-size:10px;");
  span1.innerHTML = "feature highlight search: ";
  var widthInput = tdiv.appendChild(document.createElement("input"));
  widthInput.setAttribute("type", "text");
  widthInput.setAttribute("size", "30");
  widthInput.setAttribute("style", "font-size:10px;");
  widthInput.setAttribute("value", current_region.highlight_search);
  widthInput.setAttribute("onkeydown", "if(event.keyCode==13) { glyphsChangeGlobalSetting('highlight_search', this.value)}");

  //-------
  /*
  tdiv2 = leftdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  //if(exportConfig.hide_sidebar) { tcheck.setAttribute('checked', "checked"); }
  //tcheck.setAttribute("onclick", "exportSVGConfigParam('sidebar', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "test 1";

  tdiv2 = rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  //if(exportConfig.hide_sidebar) { tcheck.setAttribute('checked', "checked"); }
  //tcheck.setAttribute("onclick", "exportSVGConfigParam('sidebar', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "test 3";
  */

  //------------------------------------------
  globalLayer.innerHTML = "";
  globalLayer.appendChild(divFrame);
}


function glyphsChangeGlobalSetting(param, value) {
  var globalLayer = document.getElementById("global_panel_layer");
  if(globalLayer === undefined) { return; }
  if(!globalLayer) { return; }

  var need_to_reload = false;

  if(param =="dwidth") {
    var new_width = Math.floor(value);
    if(new_width < 640) { new_width=640; }
    if(new_width != current_region.display_width) { need_to_reload = true; }
    current_region.display_width = new_width;
    gLyphsInitParams.display_width = new_width;
  }
  if(param =="compacted_tracks") {
    current_region.hide_compacted_tracks = value;
    need_to_reload = true;    
  }
  if(param =="flip_orientation") {
    current_region.flip_orientation = value;
    need_to_reload = true;    
    gLyphsChangeDhtmlHistoryLocation();
  }
  if(param =="auto_flip") {
    current_region.auto_flip = value;
  }
  if(param =="nocache") {
    current_region.nocache = value;
  }
  if(param =="highlight_search") {
    current_region.highlight_search = value;
    gLyphsChangeDhtmlHistoryLocation();
    redrawRegion(false);
  }

  if(param == "close") { globalLayer.innerHTML =""; }

  if(need_to_reload) { reloadRegion(); }
}


//----------------------------------------------------
// 
//
// track interactive configuration tool section
//
//
//----------------------------------------------------


function zenbuNewTrack() {
  var glyphTrack        = new Object;
  glyphTrack.hideTrack  = 0;
  glyphTrack.title      = "";
  glyphTrack.description = "";
  glyphTrack.default_exptype = "raw";
  glyphTrack.exptype    = "";
  glyphTrack.datatype   = "";
  glyphTrack.expfilter  = "";
  glyphTrack.exppanelmode = "experiments";
  glyphTrack.exppanel_use_rgbcolor = false;
  glyphTrack.mdgroupkey   = "";
  glyphTrack.exp_name_mdkeys = "";
  glyphTrack.errorbar_type  = "stddev";
  glyphTrack.ranksum_display  = "";
  glyphTrack.logscale   = 0;
  glyphTrack.noCache    = false;
  glyphTrack.noNameSearch = true;
  glyphTrack.colorMode = "strand";
  glyphTrack.color_mdkey = "bed:itemRgb";
  glyphTrack.backColor  = "#F6F6F6";
  glyphTrack.posStrandColor  = "#008000";
  glyphTrack.revStrandColor  = "#800080";
  glyphTrack.posTextColor    = "black";
  glyphTrack.revTextColor    = "black";
  glyphTrack.source_outmode  = "full_feature";
  glyphTrack.strandless = false;
  glyphTrack.overlap_mode    = "5end";
  glyphTrack.binning    = "sum";
  glyphTrack.experiment_merge = "mean";
  glyphTrack.maxlevels  = 100;
  glyphTrack.track_height  = 100;
  glyphTrack.expscaling = "auto";
  glyphTrack.scale_min_signal = 0;
  glyphTrack.exp_mincut = 0.0;
  glyphTrack.exprbin_strandless = false;
  glyphTrack.exprbin_subfeatures = false;
  glyphTrack.exprbin_binsize = "";
  glyphTrack.createMode  = "single";

  //just some test config for now
  glyphTrack.sources     = "";
  glyphTrack.source_ids  = "";
  glyphTrack.peerName    = "";
  glyphTrack.glyphStyle  = "thick-arrow";
  glyphTrack.uuid        = "";
  glyphTrack.hashkey     = "";
  glyphTrack.has_expression  = false;
  glyphTrack.has_subfeatures = false;

  return glyphTrack;
}


function addNewTrack(trackID) {
  //the purpose of this method is to convert the "add track" div
  //into a new glyphTrack, create the glyphTrack object
  //and setup the track for configuration

  var trackDiv = document.getElementById(trackID);
  if(!trackDiv) { return; }

  trackDiv.setAttribute("class", "gLyphTrack");

  var glyphTrack = zenbuNewTrack();
  glyphTrack.trackID  = trackID;
  glyphTrack.trackDiv = trackDiv;

  gLyphTrack_array[trackID] = glyphTrack;

  configureNewTrack(trackID);

  //create new div at end and make it the "add" button
  createAddTrackTool();
}


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


function configureNewTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
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
  a1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'cancel-new'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  var d1 = trackDiv.appendChild(document.createElement('div'));
  d1.setAttribute("style", "float:right; margin-right:6px; font-size:9px; font-family:arial,helvetica,sans-serif; color:orange; ");
  d1.innerHTML = trackID;

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
  span1 = modeSpan.appendChild(new Element('span'));
  if(glyphTrack.createMode == "single") {
    span1.setAttribute("style", spanstyle+"color:black; border-bottom: 1px solid #806060; background-color:rgb(245,234,213); ");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Views');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'createMode', 'single');");
  } else {
    span1.setAttribute("style", spanstyle+"background-color:rgb(245,222,179); color:#6E6E6E;");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'out');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'createMode', 'single');");
  }
  span1.innerHTML = "single track mode";

  span1 = modeSpan.appendChild(new Element('span'));
  span1.setAttribute("style", "border-right: 2px solid #806060; padding:5px 0px 5px 0px; line-height:2em; ");
  span1.innerHTML = "";

  //----------
  span1 = modeSpan.appendChild(new Element('span'));
  if(glyphTrack.createMode == "trackset") {
    span1.setAttribute("style", spanstyle+"color:black; border-bottom: 1px solid #806060; background-color:rgb(245,234,213); ");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'selected');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'createMode', 'trackset');");
  } else {
    span1.setAttribute("style", spanstyle+"background-color:rgb(245,222,179); color:#6E6E6E;");
    span1.setAttribute("onMouseOver", "gLyphsMenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "gLyphsMenuHover(this, 'out');");
    span1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'createMode', 'trackset');");
  }
  span1.innerHTML = "track-set mode";

  //---------
  trackDiv.appendChild(document.createElement('hr'));

  //
  //---------------------------------------------------------------------------------
  //
  var sourceSearchDiv = document.createElement('div');
  sourceSearchDiv.id = trackID + "_sources_search_div";
  trackDiv.appendChild(sourceSearchDiv);
  if(glyphTrack.dexMode) {
    gLyphsTrackBuildSourcesInfoDiv(trackID);
  } else {
    gLyphsTrackBuildSourcesSearchDiv(trackID);
  }
  
  //
  //---------------------------------------------------------------------------------
  //
  if(glyphTrack.createMode == "single") {
    var streamDiv = document.createElement('div');
    streamDiv.id = trackID + "_streamprocessDiv";
    trackDiv.appendChild(streamDiv);
    buildStreamProcessDiv(trackID);

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
    titleInput.id = trackID + "_newtrack_title";
    titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', glyphTrack.title);
    titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");

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
    modeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'tracksetUUID', this.value);");
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
    titleInput.id = trackID + "_newtrack_title";
    titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', glyphTrack.title);
    titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");

  }

  //---------------------------------------------------------------------------------
  //
  // and the cancel/accept buttons
  //
  trackDiv.appendChild(document.createElement('hr'));

  var button = document.createElement('input');
  button.setAttribute("type", "button");
  button.setAttribute('style', "float:right; margin: 0px 14px 0px 0px");
  button.setAttribute("value", "accept configuration");
  button.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-new');");
  trackDiv.appendChild(button);

  var button = document.createElement('input');
  button.setAttribute("type", "button");
  button.setAttribute("value", "cancel");
  button.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'cancel-new');");
  trackDiv.appendChild(button);

  //eedbClearSearchResults(expSearchSet.id); 
}


function buildStreamProcessDiv(trackID) {
  //for public release, this is not ready yet

  var streamDiv = document.getElementById(trackID + "_streamprocessDiv");
  if(!streamDiv) { return; }
  streamDiv.innerHTML = "";

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  streamDiv.appendChild(document.createElement('hr'));

  //help
  helpdiv = streamDiv.appendChild(document.createElement('div'));
  helpdiv.setAttribute("style", "float:right; margin-right:3px; padding:0px 3px 0px 3px; font-size:10px; color:#505050; background-color:#D0D0D0;");
  helpdiv.setAttribute("onclick", "zenbuRedirect('http://fantom.gsc.riken.jp/zenbu/wiki/index.php/Data_Stream_Processing');");
  helpdiv.setAttribute("onmouseover", "eedbMessageTooltip('need help with scripted processing?<br>check out the wiki pages',180);");
  helpdiv.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  helpdiv.innerHTML = "?";

  var labelStreamProcess = streamDiv.appendChild(document.createElement('div'));
  labelStreamProcess.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelStreamProcess.innerHTML ="Stream Processing script";

  var span1 = document.createElement('span');
  span1.innerHTML = "select processing mode: ";
  streamDiv.appendChild(span1);

  streamDiv.appendChild(buildStreamSelect(trackID));

  var streamParamsDiv = document.createElement('div');
  streamParamsDiv.id = trackID + "_spstreamParamsDiv";
  streamDiv.appendChild(streamParamsDiv);

  reconfigureStreamParams(trackID);
}


function buildStreamSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var streamSelect = document.createElement('select');
  streamSelect.id = trackID + "_streamProcessSelect";
  streamSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'spstream', this.value);");

  var spstream_mode = glyphTrack.spstream_mode;
  if(glyphTrack.newconfig.spstream_mode) { spstream_mode = glyphTrack.newconfig.spstream_mode; }

  var option;
  option = document.createElement('option');
  option.setAttribute("value", "none");
  option.innerHTML = "none";
  streamSelect.appendChild(option);

  option = document.createElement('option');
  option.setAttribute("value", "predefined");
  option.innerHTML = "predefined script";
  streamSelect.appendChild(option);
  if(spstream_mode == "predefined") { 
    option.setAttribute("selected", "selected");
  }

  option = document.createElement('option');
  option.setAttribute("value", "expression");
  option.innerHTML = "expression binning script (gui)";
  streamSelect.appendChild(option);
  if(spstream_mode == "expression") {
    option.setAttribute("selected", "selected");
  }

  option = document.createElement('option');
  option.setAttribute("value", "custom");
  option.innerHTML = "custom XML script";
  streamSelect.appendChild(option);
  if(spstream_mode == "custom") { 
    option.setAttribute("selected", "selected");
  }

  return streamSelect;
}


function peer_sort_func(a,b) {
  var name1 = a.getAttribute("alias").toUpperCase();
  var name2 = b.getAttribute("alias").toUpperCase();
  return (name2 < name1) - (name1 < name2);
}


function reconfigTrackParam(trackID, param, value, altvalue) {
  //document.getElementById("message").innerHTML= "reconfig: " + trackID + ":: "+ param + "="+value;
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack.newconfig === undefined) {
    glyphTrack.newconfig = new Object;
  }
  var newconfig = glyphTrack.newconfig;

  if(param == "createMode") {
    glyphTrack.createMode = value;
    configureNewTrack(trackID);
    return;
  }
  if(param == "tracksetUUID") {  glyphTrack.tracksetUUID = value; }

  if(param == "overlap_mode") {  newconfig.overlap_mode = value; }
  if(param == "binning") {  newconfig.binning = value; }
  if(param == "experiment_merge") {  newconfig.experiment_merge = value; }
  if(param == "title") {  
    if(!value) { value = ""; }
    newconfig.title = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
  }
  if(param == "description") {  newconfig.description = value; }
  if(param == "exptype") {  newconfig.exptype = value; }
  if(param == "expfilter") {  newconfig.expfilter = value; }
  if(param == "datatype") {  newconfig.datatype = value; }
  if(param == "backColor") {  
    if(!value) { value = "#F6F6F6"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    newconfig.backColor = value; 
  }
  if(param == "posStrandColor") {  
    if(!value) { value = "#008000"; }
    if(value && (value.charAt(0) != "#")) { value = "#"+value; }
    newconfig.posStrandColor = value; 
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "revStrandColor") {  
    if(!value) { value = "#800080"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    newconfig.revStrandColor = value; 
  }
  if(param == "expMDGroupColor") {  
    if(!value) { value = "#008000"; }
    if(value && (value.charAt(0) != "#")) { value = "#"+value; }
    var mdgroup = glyphTrack.experiment_mdgrouping[altvalue];
    if(mdgroup) { 
      mdgroup.rgbcolor = value; 
      gLyphsDrawExperimentExpression();
      gLyphsDrawTrack(trackID);
    }
  }
  if(param == "source_outmode") {  newconfig.source_outmode = value; }
  if(param == "hidezeroexps") { 
    if(value) { newconfig.hidezeroexps=true; }
    else { newconfig.hidezeroexps = false; }
    createGlyphstyleSelect(glyphTrack);
  }

  if(param == "spstream") {  
    if(value == "predefined-clear") {
      newconfig.spstream_mode = glyphTrack.spstream_mode; 
      newconfig.script = null;
      newconfig.spstream_changed = true;
      reconfigureStreamParams(trackID);
      return;
    }
    if(newconfig.spstream_mode != value) {
      newconfig.spstream_mode = value; 
      newconfig.spstream_changed = true;
      if(newconfig.spstream_mode == "none") { 
        newconfig.script = null
      }
      if(newconfig.spstream_mode == "expression") { 
        newconfig.script = null
      }
      if(newconfig.spstream_mode == "predefined") { 
        newconfig.script = null
      }
      if((newconfig.spstream_mode == "custom") && !newconfig.script) { 
        newconfig.script = new Object;
        newconfig.script.name = "user defined";
        newconfig.script.desc = "";
        newconfig.script.spstreamXML = 
          "<zenbu_script>\n"+
          "  <datastream name=\"xxxx\" output=\"simple_feature\">\n"+
          "    <source id=\"uuid::num::class\" name=\"nice name\"/>\n"+
          "    <source id=\"uuid::num::class\" name=\"nice name\"/>\n"+
          "  </datastream>\n"+
          "  <stream_processing>\n"+
          "    <spstream module=\"something\"></spstream>\n"+
          "    <spstream module=\"something\">\n"+
          "      <side_stream><spstream module=\"EEDB::SPStream::Proxy\" name=\"xxxx\"/></side_stream>\n"+
          "    </spstream>\n"+
          "  </stream_processing>\n"+
          "</zenbu_script>\n";
        var reconfig_div = document.getElementById(trackID+"_reconfigure_divframe");
        if(reconfig_div) { 
          reconfig_div.style.width="500px";
          reconfig_div.style.left= (current_region.display_width-500)+"px";
        }
      }
      reconfigureStreamParams(trackID);
    }
  }
  if(param == "spstream_configxml") { 
    //when user is directly entering script text (custom modifying)
    newconfig.script.spstreamXML = value;
    newconfig.script.uuid = null;
    newconfig.spstream_changed = true;
  }
  if(param == "exprbin_strandless") { 
    newconfig.exprbin_strandless = value;
  }
  if(param == "exprbin_subfeatures") { 
    newconfig.exprbin_subfeatures = value;
  }
  if(param == "exprbin_binsize") { 
    newconfig.exprbin_binsize = value;
  }
  if(param == "exprbin_editxml") { 
    //searchButton.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'spstream', 'custom');");
    newconfig.spstream_mode = "custom";
    newconfig.spstream_changed = true;

    var overlap_mode = glyphTrack.overlap_mode;
    if(glyphTrack.newconfig && glyphTrack.newconfig.overlap_mode) { overlap_mode = glyphTrack.newconfig.overlap_mode; }

    var binning = glyphTrack.binning;
    if(glyphTrack.newconfig && glyphTrack.newconfig.binning) { binning = glyphTrack.newconfig.binning; }

    var binsize = glyphTrack.exprbin_binsize;
    if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_binsize) { binsize = glyphTrack.newconfig.exprbin_binsize; }

    var strandless = glyphTrack.exprbin_strandless;
    if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_strandless) { strandless = glyphTrack.newconfig.exprbin_strandless; }

    var subfeatures = glyphTrack.exprbin_subfeatures;
    if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_subfeatures) { subfeatures = glyphTrack.newconfig.exprbin_subfeatures; }

    newconfig.script = new Object;
    newconfig.script.name = "expression binning";
    newconfig.script.desc = "";
    newconfig.script.spstreamXML =  "<zenbu_script>\n";
    newconfig.script.spstreamXML += "\t<stream_processing>\n";
    newconfig.script.spstreamXML += "\t\t<spstream module=\"TemplateCluster\">\n";
    newconfig.script.spstreamXML += "\t\t\t<overlap_mode>"+overlap_mode+"</overlap_mode>\n";
    newconfig.script.spstreamXML += "\t\t\t<expression_mode>"+binning+"</expression_mode>\n";

    if(strandless) { newconfig.script.spstreamXML += "\t\t\t<ignore_strand>true</ignore_strand>\n"; } 
    else { newconfig.script.spstreamXML += "\t\t\t<ignore_strand>false</ignore_strand>\n"; }

    if(subfeatures) { newconfig.script.spstreamXML += "\t\t\t<overlap_subfeatures>true</overlap_subfeatures>\n"; } 
    else { newconfig.script.spstreamXML += "\t\t\t<overlap_subfeatures>false</overlap_subfeatures>\n"; }

    newconfig.script.spstreamXML += "\t\t\t<side_stream>\n\t\t\t\t<spstream module=\"FeatureEmitter\">\n\t\t\t\t\t<fixed_grid>true</fixed_grid>\n";
    if(binsize) { newconfig.script.spstreamXML += "\t\t\t\t\t<width>"+binsize+"</width>\n" }

    if(strandless) { newconfig.script.spstreamXML += "\t\t\t\t\t<both_strands>false</both_strands>\n"; } 
    else { newconfig.script.spstreamXML += "\t\t\t\t\t<both_strands>true</both_strands>\n"; } 

    newconfig.script.spstreamXML += "\t\t\t\t</spstream>\n";
    newconfig.script.spstreamXML += "\t\t\t</side_stream>\n";
    newconfig.script.spstreamXML += "\t\t</spstream>\n";
    newconfig.script.spstreamXML += "\t</stream_processing>\n";
    newconfig.script.spstreamXML += "</zenbu_script>\n";
    var reconfig_div = document.getElementById(trackID+"_reconfigure_divframe");
    if(reconfig_div) { 
      reconfig_div.style.width="500px";
      reconfig_div.style.left= (current_region.display_width-500)+"px";
    }
    reconfigureStreamParams(trackID);
  }

  if(param == "colorMode") {  
    newconfig.colorMode = value;
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "color_mdkey") {
    newconfig.color_mdkey = value;
    var input1 = document.getElementById(trackID + "_color_mdkey_input");
    var radio2 = document.getElementById(trackID + "_colormdkey_radio2");
    input1.setAttribute('value', value);
    if(value == "bed:itemRgb") { createGlyphstyleSelect(glyphTrack); }
    else { radio2.setAttribute('checked', "checked"); }
  }
  if(param == "scorecolor") {
    newconfig.colorMode = "signal";
    newconfig.scorecolor = value;
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "colorspace") {  
    newconfig.colorspace = value;
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "colorspace_discrete") {  
    newconfig.colorMode = "signal";
    newconfig.colorspace_discrete = value;
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "colorspace_category") {  
    newconfig.colorspace_category = value;
    if(value == "brewer-sequential") {
      newconfig.colorspace = "BuGn_bp_7";
    }
    if(value == "brewer-diverging") {
      newconfig.colorspace = "BrBG_bp_7";
    }
    if(value == "brewer-qualitative") {
      newconfig.colorspace = "Accent_bp_7";
    }
    if(value == "zenbu-spectrum") { 
      newconfig.colorspace = "fire1";
    }
    var colorspec = colorSpaces[newconfig.colorspace];
    newconfig.colorspace_discrete = colorspec.discrete;

    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "colorspace_depth") {  
    //modify the color
    var csname = newconfig.colorspace;
    if(!csname) { 
      csname = glyphTrack.colorspace; 
      newconfig.colorspace = csname;
    }
    var colorspec = colorSpaces[csname];
    var idx1 = csname.indexOf('_bp_');
    if(idx1 > 0) { 
      csname = csname.substr(0, idx1+4); 
      csname += value
      if(colorSpaces[csname]) { newconfig.colorspace = csname; }
      else {
        for(var cn in colorSpaces){
          var cspc2 = colorSpaces[cn];
          if(cspc2.colorcat != colorspec.colorcat) { continue; }
          if(cspc2.bpdepth != value) { continue; }
          newconfig.colorspace = cn;
          break;
        }
      }
    }
    var colorspec = colorSpaces[newconfig.colorspace];
    newconfig.colorspace_discrete = colorspec.discrete;
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "colorspace_logscale") {
    if(value) { newconfig.logscale=1; }
    else { newconfig.logscale = 0; }
    createGlyphstyleSelect(glyphTrack);
  }

  if(param == "glyphStyle") { 
    newconfig.glyphStyle = value; 
    var streamSelect   = document.getElementById(trackID + "_streamProcessSelect");
    var spstream_mode = glyphTrack.spstream_mode;
    if(glyphTrack.newconfig.spstream_mode) { spstream_mode = glyphTrack.newconfig.spstream_mode; }
    
    var colorcheck1 = document.getElementById(trackID + "_glyphselect_scorecolor_check");
    if(value == "experiment-heatmap" || value == "1D-heatmap") { 
      newconfig.colorMode = "signal";
      newconfig.hidezeroexps = true;
      newconfig.track_height = 3;
      if(colorcheck1) { 
        colorcheck1.setAttribute('checked', "checked");
        colorcheck1.setAttribute('disabled', "disabled");
      }
    }
    else if(value == "xyplot" || value == "signal-histogram" || value == "split-signal") { 
      newconfig.colorMode = "strand";  //reset to default 
      if(colorcheck1) { 
        colorcheck1.setAttribute('checked', "");
        colorcheck1.setAttribute('disabled', "disabled");
      }
    }
    else {
      if(colorcheck1) { colorcheck1.removeAttribute('disabled', "disabled"); }
    }
    
    createDatatypeSelect(trackID);
    if(spstream_mode == "none" && (value == "signal-histogram" || value == "split-signal" || value == "experiment-heatmap" || value == "1D-heatmap")) {
      if(streamSelect) { streamSelect.value = "expression"; }
      newconfig.spstream_mode = "expression";
      newconfig.spstream_changed = true;
      newconfig.script = null
      newconfig.exprbin_strandless = false;
      newconfig.exprbin_subfeatures = false;
      if(value == "experiment-heatmap" || value == "1D-heatmap") {
        newconfig.exprbin_strandless = true;
        newconfig.exprbin_subfeatures = true;
        newconfig.overlap_mode = "height";
      }
      reconfigureStreamParams(trackID);
      needReload=1; 
    }
    createGlyphstyleSelect(glyphTrack);  //refresh
  }

  if(param == "sourcemode") {
    //document.getElementById("message").innerHTML += "reconfig: " + trackID + ":: "+ param + "="+value;
    newconfig.sourcemode = value;
    //var searchTrack = document.getElementById(trackID + "_newtrack_expsearch1");
    //if(searchTrack) {
    //  //searchTrack.setAttribute('mode', value);
    //  //searchTrack.setAttribute('searchTitle', "eeDB " + value);
    //}
  }

  if(param == "height") {  
    newconfig.track_height = Math.floor(value);
    glyphStyle = glyphTrack.glyphStyle;
    if(newconfig.glyphStyle) { glyphStyle = newconfig.glyphStyle; }
    if(glyphStyle == "experiment-heatmap" || glyphStyle == "1D-heatmap") {
      if(newconfig.track_height <1) { newconfig.track_height = 1; } 
      if(newconfig.track_height >10) { newconfig.track_height = 10; } 
    } else {
      if(newconfig.track_height <20) { newconfig.track_height = 20; } 
      if(newconfig.track_height >500) { newconfig.track_height = 500; } 
    }
  }
  if(param == "expscaling") {  
    newconfig.expscaling = parseFloat(value); 
    if(isNaN(newconfig.expscaling) || (newconfig.expscaling==0)) { newconfig.expscaling = "auto"; } 
  }
  if(param == "scale_min_signal") {  
    newconfig.scale_min_signal = parseFloat(value); 
    if(isNaN(newconfig.scale_min_signal)) { newconfig.scale_min_signal = 0; } 
  }
  if(param == "mincutoff") {  
    newconfig.exp_mincut = parseFloat(value); 
  }
  if(param == "logscale") { 
    if(value) { newconfig.logscale=1; }
    else { newconfig.logscale = 0; }
  }
  if(param == "noCache") { 
    if(value) { newconfig.noCache=true; }
    else { newconfig.noCache = false; }
  }
  if(param == "noNameSearch") { 
    if(value) { newconfig.noNameSearch=true; }
    else { newconfig.noNameSearch = false; }
  }
  if(param == "strandless") {
    if(value) { newconfig.strandless=true; }
    else { newconfig.strandless = false; }
    var strandlessCheck = document.getElementById(trackID + "_strandlessVisualCheck");
    if(strandlessCheck) { strandlessCheck.checked = newconfig.strandless; }
  }
  if(param == "species_search") { newconfig.species_search = value; }
  if(param == "source_search_mode") { newconfig.source_search_mode = value; }

  if(param == "accept-new") {
    var source_ids = "";
    var searchTrack1 = eedb_searchTracks[trackID + "_newtrack_expsearch1"];
    if(searchTrack1) { 
      for (var fid in searchTrack1.selected_hash) {
        var obj = searchTrack1.selected_hash[fid];
        if(!obj.state) {continue;}
        source_ids += fid +",";
      }
    }
    var searchTrack2 = eedb_searchTracks[trackID + "_newtrack_expsearch2"];
    if(searchTrack2) { 
      for (var fid in searchTrack2.selected_hash) {
        var obj = searchTrack2.selected_hash[fid];
        if(!obj.state) {continue;}
        source_ids += fid +",";
      }
    }
    if(source_ids !="") { glyphTrack.source_ids = source_ids; }

    //done with search tracks do delete them
    eedbSearchDeleteSearchTrack(trackID + "_newtrack_expsearch1");
    eedbSearchDeleteSearchTrack(trackID + "_newtrack_expsearch2");

    glyphTrack.trackDiv.setAttribute("style", "background-color: transparent; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

    if(glyphTrack.newconfig) {
      var newconfig = glyphTrack.newconfig;
      if(newconfig.source_ids !== undefined) { glyphTrack.source_ids = newconfig.source_ids; }
      if(newconfig.glyphStyle !== undefined) { glyphTrack.glyphStyle = newconfig.glyphStyle; }
      if(newconfig.logscale !== undefined) { glyphTrack.logscale = newconfig.logscale; }
      if(newconfig.noCache !== undefined) { glyphTrack.noCache = newconfig.noCache; }
      if(newconfig.noNameSearch !== undefined) { glyphTrack.noNameSearch = newconfig.noNameSearch; }
      if(newconfig.backColor !== undefined) { glyphTrack.backColor = newconfig.backColor; }
      if(newconfig.posStrandColor !== undefined) { glyphTrack.posStrandColor = newconfig.posStrandColor; }
      if(newconfig.revStrandColor !== undefined) { glyphTrack.revStrandColor = newconfig.revStrandColor; }
      if(newconfig.source_outmode !== undefined) { glyphTrack.source_outmode = newconfig.source_outmode; }
      if(newconfig.strandless !== undefined) { glyphTrack.strandless = newconfig.strandless; }
      if(newconfig.exprbin_strandless !== undefined) { glyphTrack.exprbin_strandless = newconfig.exprbin_strandless; }
      if(newconfig.exprbin_subfeatures !== undefined) { glyphTrack.exprbin_subfeatures = newconfig.exprbin_subfeatures; }
      if(newconfig.exprbin_binsize !== undefined) { glyphTrack.exprbin_binsize = newconfig.exprbin_binsize; }
      if(newconfig.overlap_mode !== undefined) { glyphTrack.overlap_mode = newconfig.overlap_mode; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; }
      if(newconfig.experiment_merge !== undefined) { glyphTrack.experiment_merge = newconfig.experiment_merge; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.description !== undefined) { glyphTrack.description = newconfig.description; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; }
      if(newconfig.datatype !== undefined) { glyphTrack.datatype = newconfig.datatype; }
      if(newconfig.track_height !== undefined) { glyphTrack.track_height = newconfig.track_height; }
      if(newconfig.expscaling !== undefined) { glyphTrack.expscaling = newconfig.expscaling; }
      if(newconfig.scale_min_signal !== undefined) { glyphTrack.scale_min_signal = newconfig.scale_min_signal; }
      if(newconfig.exp_mincut !== undefined) { glyphTrack.exp_mincut = newconfig.exp_mincut; }
      if(newconfig.colorMode !== undefined) { glyphTrack.colorMode = newconfig.colorMode; }
      if(newconfig.colorspace !== undefined) { glyphTrack.colorspace = newconfig.colorspace; }
      if(newconfig.color_mdkey !== undefined) { glyphTrack.color_mdkey = newconfig.color_mdkey; }
      if(newconfig.hidezeroexps !== undefined) { glyphTrack.hidezeroexps = newconfig.hidezeroexps; }

      if(newconfig.spstream_mode !== undefined) { glyphTrack.spstream_mode = newconfig.spstream_mode; }
              
      if(newconfig.spstream_changed) {
        //document.getElementById("message").innerHTML = "script changed";
        if(glyphTrack.spstream_mode == "none") { glyphTrack.script = null; }
        if(glyphTrack.spstream_mode == "expression") { glyphTrack.script = null; }
        if(glyphTrack.spstream_mode == "predefined") { glyphTrack.script = newconfig.script; }
        if(glyphTrack.spstream_mode == "custom") {
          var spstreamDOM = gLyphsParseStreamProcssingXML(newconfig.script.spstreamXML);
          if(spstreamDOM) {
            glyphTrack.script = newconfig.script;
          }
        }
      }      
    }

    //
    // set some defaults if they are not configured
    //
    if(glyphTrack.title == "") { glyphTrack.title = glyphTrack.sources; }

    if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot" || glyphTrack.glyphStyle == "split-signal") {
      //document.getElementById("message").innerHTML = "new express track so set some defaults";
      if(glyphTrack.exptype === undefined)   { glyphTrack.datatype = glyphTrack.exptype = glyphTrack.default_exptype; }
      if(glyphTrack.track_height === undefined) { glyphTrack.track_height = 100; }
      if(glyphTrack.expsscaling === undefined) { glyphTrack.expscaling = "auto"; }
    }
    if(glyphTrack.glyphStyle == "xyplot") { glyphTrack.strandless = false; }

    //finish
    glyphTrack.newconfig = undefined;
    clearKids(glyphTrack.trackDiv);

    if(glyphTrack.createMode == "trackset") {
      gLyphsAppendTracksViaTrackSet(glyphTrack);
    }

    if(glyphTrack.dexMode) {
      glyphTrack.dex_callout(trackID, "accept-new");
      return;
    }

    if(glyphTrack.createMode == "single") {
      gLyphsInitSearchFromTracks();
      gLyphsAutosaveConfig();
      gLyphsDrawTrack(trackID);
      prepareTrackXHR(trackID);
    }
  }

  if(param == "cancel-new") {
    if(glyphTrack.dexMode) {
      glyphTrack.dex_callout(trackID, "cancel-new");
      return;
    }
    //done with search tracks do delete them
    eedbSearchDeleteSearchTrack(trackID + "_newtrack_expsearch1");
    eedbSearchDeleteSearchTrack(trackID + "_newtrack_expsearch2");

    removeTrack(trackID);
    //createAddTrackTool();
  }

  if(param == "cancel-reconfig") {
    glyphTrack.newconfig = undefined;
    gLyphsDrawTrack(trackID);
  }

  if(param == "accept-reconfig") {
    var needReload=0;
    if(glyphTrack.newconfig) {
      var newconfig = glyphTrack.newconfig;
      if((newconfig.glyphStyle !== undefined) && ( glyphTrack.glyphStyle != newconfig.glyphStyle))  {
        //if((glyphTrack.glyphStyle=="signal-histogram") || (newconfig.glyphStyle=="signal-histogram")) { needReload=1; }
        glyphTrack.glyphStyle = newconfig.glyphStyle; 
      }
      if(newconfig.logscale !== undefined) { glyphTrack.logscale = newconfig.logscale; }
      if(newconfig.noCache !== undefined) { glyphTrack.noCache = newconfig.noCache; needReload=2; }
      if(newconfig.noNameSearch !== undefined) { glyphTrack.noNameSearch = newconfig.noNameSearch; }
      if(newconfig.backColor !== undefined) { glyphTrack.backColor = newconfig.backColor; }
      if(newconfig.posStrandColor !== undefined) { glyphTrack.posStrandColor = newconfig.posStrandColor; }
      if(newconfig.revStrandColor !== undefined) { glyphTrack.revStrandColor = newconfig.revStrandColor; }
      if(newconfig.source_outmode !== undefined) { glyphTrack.source_outmode = newconfig.source_outmode; needReload=1; }
      if(newconfig.strandless !== undefined) { glyphTrack.strandless = newconfig.strandless; }
      if(newconfig.exprbin_strandless !== undefined) { glyphTrack.exprbin_strandless = newconfig.exprbin_strandless; needReload=1; }
      if(newconfig.exprbin_subfeatures !== undefined) { glyphTrack.exprbin_subfeatures = newconfig.exprbin_subfeatures; needReload=1; }
      if(newconfig.exprbin_binsize !== undefined) { glyphTrack.exprbin_binsize = newconfig.exprbin_binsize; needReload=1; }
      if(newconfig.overlap_mode !== undefined) { glyphTrack.overlap_mode = newconfig.overlap_mode; needReload=1; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; needReload=1; }
      if(newconfig.experiment_merge !== undefined) { glyphTrack.experiment_merge = newconfig.experiment_merge; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.description !== undefined) { glyphTrack.description = newconfig.description; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; needReload=1; }
      if(newconfig.datatype !== undefined) { glyphTrack.datatype = newconfig.datatype; }
      if(newconfig.track_height !== undefined) { glyphTrack.track_height = newconfig.track_height; }
      if(newconfig.expscaling !== undefined) { glyphTrack.expscaling = newconfig.expscaling; }
      if(newconfig.scale_min_signal !== undefined) { glyphTrack.scale_min_signal = newconfig.scale_min_signal; }
      if(newconfig.exp_mincut !== undefined) { glyphTrack.exp_mincut = newconfig.exp_mincut; }
      if(newconfig.colorMode !== undefined) { glyphTrack.colorMode = newconfig.colorMode; if(newconfig.colorMode=="signal") { needReload=1; } }
      if(newconfig.colorspace !== undefined) { glyphTrack.colorspace = newconfig.colorspace; }
      if(newconfig.color_mdkey !== undefined) { glyphTrack.color_mdkey = newconfig.color_mdkey; }
      if(newconfig.hidezeroexps !== undefined) { glyphTrack.hidezeroexps = newconfig.hidezeroexps; }
      if(newconfig.spstream_mode !== undefined) { glyphTrack.spstream_mode = newconfig.spstream_mode; }

      if(newconfig.spstream_changed) {
        needReload=1;
        //document.getElementById("message").innerHTML = "script changed";
        if(glyphTrack.spstream_mode == "none") { glyphTrack.script = null; }
        if(glyphTrack.spstream_mode == "expression") { glyphTrack.script = null; }
        if(glyphTrack.spstream_mode == "predefined") { glyphTrack.script = newconfig.script; }
        if(glyphTrack.spstream_mode == "custom") {
          var spstreamDOM = gLyphsParseStreamProcssingXML(newconfig.script.spstreamXML);
          if(spstreamDOM) {
            //document.getElementById("message").innerHTML += " new custom script parsed OK";
              /*
              var script = new Object;
              script.name = "";
              script.desc = "";
              if(glyphTrack.script) { 
                script.name = glyphTrack.script.name;
                var mymatch = /^modified\.(.+)$/.exec(script.name);
                if(!mymatch || (mymatch.length != 2)) {
                  script.name = "modified."+glyphTrack.script.name;
                }
                script.desc = glyphTrack.script.desc;
              }
              */
            glyphTrack.script = newconfig.script;
          }
        }
      }
      if(glyphTrack.glyphStyle == "xyplot") { glyphTrack.strandless = false; }
    }
    
    //check if anything changed
    var new_atr_count = 0;
    for(e in glyphTrack.newconfig) { new_atr_count++; }
    if(glyphTrack.uuid && (new_atr_count > 0)) {
      //something changed so shared tracj uuid nolonger valid
      glyphTrack.parent_uuid = glyphTrack.uuid;
      glyphTrack.uuid = undefined
    }
    glyphTrack.newconfig = undefined;

    if(!glyphTrack.has_subfeatures && (glyphTrack.glyphStyle=='transcript' || glyphTrack.glyphStyle=='probesetloc' || 
                                       glyphTrack.glyphStyle=='thin-transcript' || glyphTrack.glyphStyle=='thick-transcript')) {
      needReload = 1;
    }

    if(needReload == 1) { glyphTrack.uuid = undefined; }
    if(needReload >=1) { 
      //glyphTrack.experiments = undefined;
      if(glyphTrack.trackDiv) {
        var reconfig_div = document.getElementById(trackID+"_reconfigure_divframe");
        if(reconfig_div) { glyphTrack.trackDiv.removeChild(reconfig_div); }
      }
      gLyphsShowTrackLoading(trackID);
      prepareTrackXHR(trackID);
    } else {
      //recalculate the data transforms and then redraw
      gLyphsRenderTrack(glyphTrack);
      gLyphsDrawTrack(trackID);
    }
    gLyphsInitSearchFromTracks();
    gLyphsAutosaveConfig();
  }
  
  //--------------------------------------------------------
  // download params

  if(param == "download-format") { 
    glyphTrack.download.format = value;
    gLyphsDownloadOptions(glyphTrack);
  }
  
  if(param == "download-savefile") { glyphTrack.download.savefile = value; }
  if(param == "download-mode") { 
    glyphTrack.download.mode = value; 
    gLyphsDownloadRegionBuildStats(trackID);
  }
  if(param == "download-subfeatures") { glyphTrack.download.subfeatures = value; }
  if(param == "download-feature-metadata") { glyphTrack.download.feature_metadata = value; }
  if(param == "download-experiment-metadata") { glyphTrack.download.experiment_metadata = value; }
  if(param == "download-osc-metadata") { glyphTrack.download.osc_metadata = value; }
  
  if(param == "download-location") { 
    var radio = document.getElementById(trackID + "_DownloadMode_location");
    if(radio) { radio.setAttribute("checked", "checked"); }
    glyphTrack.download.mode     = "location";
    glyphTrack.download.location = value; 
    gLyphsDownloadRegionBuildStats(trackID);
  }

  if(param == "cancel-download") {
    glyphTrack.newconfig = undefined;
    glyphTrack.download  = undefined;
    gLyphsDrawTrack(trackID);
  }

  if(param == "accept-download") {
    glyphsPostDownloadRequest(trackID);
    glyphTrack.newconfig = undefined;
    glyphTrack.download  = undefined;
    gLyphsDrawTrack(trackID);
  }
}


//--------------------------------------------------------
//
// StreamProcessing configuration input section
//   current version is limited/hard coded, but
//   future can by dynamic (provided by server)
//
//--------------------------------------------------------

function reconfigureStreamParams(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var paramDiv = document.getElementById(trackID + "_spstreamParamsDiv");
  if(!paramDiv) { return; }
  paramDiv.innerHTML = ""; //empty
  glyphTrack.spstream_config = new Object;

  var saveButton = document.getElementById(glyphTrack.trackID + "_saveScriptButton");
  if(saveButton) { saveButton.setAttribute("disabled", "disabled"); }

  var spstream_mode = glyphTrack.spstream_mode;
  if(glyphTrack.newconfig.spstream_mode) { spstream_mode = glyphTrack.newconfig.spstream_mode; }

  var streamSelect = document.getElementById(trackID + "_streamProcessSelect");
  if(streamSelect) { streamSelect.value = spstream_mode; }

  if(spstream_mode == "expression") { createStreamParams_expression(glyphTrack, paramDiv); }
  if(spstream_mode == "custom") { createStreamParams_custom(glyphTrack, paramDiv); }
  if(spstream_mode == "predefined") { createStreamParams_predefined(glyphTrack, paramDiv); }
}


function createStreamParams_custom(glyphTrack, paramDiv) {
  var saveButton = document.getElementById(glyphTrack.trackID + "_saveScriptButton");
  if(saveButton) { saveButton.removeAttribute("disabled"); }

  var script = glyphTrack.script;
  if(glyphTrack.newconfig.spstream_changed) {
    script = glyphTrack.newconfig.script;
  }

  //----------
  var configInput = paramDiv.appendChild(document.createElement('textarea'));
  configInput.setAttribute('style', "width:96%; margin-top:3px; margin-bottom:3px; margin-left:1%; font-size:10px; font-family:arial,helvetica,sans-serif;");
  configInput.setAttribute('wrap', "off");
  configInput.setAttribute('rows', 15);
  configInput.setAttribute("onkeyup",  "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_configxml', this.value);");
  configInput.setAttribute("onclick",  "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_configxml', this.value);");
  configInput.setAttribute("onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_configxml', this.value);");
  configInput.value = script.spstreamXML;
}


function createStreamParams_predefined(glyphTrack, paramDiv) {
  var trackID = glyphTrack.trackID;
  var script = glyphTrack.script;
  if(glyphTrack.newconfig.spstream_changed) {
    script = glyphTrack.newconfig.script; 
  }

  if(script) {
    //predefined script is already loaded so display

    var info_table = paramDiv.appendChild(document.createElement('table'));
    info_table.setAttribute('style', "margin: 2px 1px 2px 7px; ");
    info_table.setAttribute('cellspacing', "0px");
    info_table.setAttribute('cellpadding', "0px");

    var tr = info_table.appendChild(document.createElement('tr'));
    var td = tr.appendChild(document.createElement('td'));
    td.innerHTML = "name: ";
    td = tr.appendChild(document.createElement('td'));
    td.setAttribute('style', "color:blue;");
    td.innerHTML = script.name;

    td = tr.appendChild(document.createElement('td'));
    td.setAttribute("rowspan", "2");
    td.setAttribute("valign", "top");
    var searchButton = td.appendChild(document.createElement('input'));
    searchButton.setAttribute("type", "button");
    searchButton.setAttribute("value", "edit script");
    searchButton.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'spstream', 'custom');");

    var searchButton = td.appendChild(document.createElement('input'));
    searchButton.setAttribute("type", "button");
    searchButton.setAttribute("value", "replace");
    searchButton.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'spstream', 'predefined-clear');");

    if(script.desc) {
      tr = info_table.appendChild(document.createElement('tr'));
      tr.setAttribute('valign', "top");
      td = tr.appendChild(document.createElement('td'));
      td.innerHTML = "description: ";
      td = tr.appendChild(document.createElement('td'));
      td.innerHTML = script.desc;
    }

    if(script.uuid) {
      tr = info_table.appendChild(document.createElement('tr'));
      tr.setAttribute('valign', "top");
      td = tr.appendChild(document.createElement('td'));
      td.innerHTML = "script uuid: ";
      td = tr.appendChild(document.createElement('td'));
      td.setAttribute("style", "color:orange; ");
      td.innerHTML = script.uuid;
    }
  } else {
    //search interface to allow changing the predefined script
    var predefScriptDiv = paramDiv.appendChild(document.createElement('form'));
    predefScriptDiv.setAttribute('style', "margin-top: 5px;");
    predefScriptDiv.setAttribute("onsubmit", "gLyphsTrackSearchScripts(\""+trackID+"\", \"search\"); return false;");
    
    var span1 = predefScriptDiv.appendChild(document.createElement('span'));
    span1.innerHTML = "Search scripts:";
    span1.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    
    var sourceInput = predefScriptDiv.appendChild(document.createElement('input'));
    sourceInput.id = trackID + "_script_search_inputID";
    sourceInput.setAttribute('style', "margin: 1px 3px 3px 3px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    sourceInput.setAttribute('size', "40");
    sourceInput.setAttribute('type', "text");
    
    var searchButton = predefScriptDiv.appendChild(document.createElement('input'));
    searchButton.setAttribute("style", "font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    searchButton.setAttribute("type", "button");
    searchButton.setAttribute("value", "search");
    searchButton.setAttribute("onclick", "gLyphsTrackSearchScripts(\""+trackID+"\", \"search\");");
    
    var clearButton = predefScriptDiv.appendChild(document.createElement('input'));
    clearButton.setAttribute("style", "font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    clearButton.setAttribute("type", "button");
    clearButton.setAttribute("value", "clear");
    clearButton.setAttribute("onclick", "gLyphsTrackSearchScripts(\""+trackID+"\", \"clear\");");
    
    var searchAllButton = predefScriptDiv.appendChild(document.createElement('input'));
    searchAllButton.setAttribute("style", "font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    searchAllButton.setAttribute("type", "button");
    searchAllButton.setAttribute("value", "show all");  
    searchAllButton.setAttribute("onclick", "gLyphsTrackSearchScripts(\""+trackID+"\", \"all\");");
    
    var scriptsDiv = predefScriptDiv.appendChild(document.createElement('div'));
    scriptsDiv.id = trackID + "_script_search_div";
    scriptsDiv.setAttribute('style', "margin: 1px 3px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    scriptsDiv.innerHTML = "please enter search term";  
  }
}


function createStreamParams_expression(glyphTrack, paramDiv) {
  var saveButton = document.getElementById(glyphTrack.trackID + "_saveScriptButton");
  if(saveButton) { saveButton.setAttribute("disabled", "disabled"); }

  /*
  var configInput = document.createElement('textarea');
  configInput.setAttribute('style', "width:96%; margin-top:3px; margin-bottom:3px; margin-left:1%; font-size:10px; font-family:arial,helvetica,sans-serif;");
  configInput.setAttribute('wrap', "off");
  configInput.setAttribute('rows', 15);
  configInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_configxml', this.value);");
  if(glyphTrack.newconfig.script) { configInput.value = glyphTrack.newconfig.script.spstreamXML; }
  else { configInput.value = glyphTrack.script.spstreamXML; }
  paramDiv.appendChild(configInput);
  */

  //----------
  // if "signal-histogram" track there are other options
  var expressOptDiv = paramDiv.appendChild(document.createElement('div'));
  expressOptDiv.setAttribute('style', "padding: 3px 0px 1px 4px");

  //----------
  var div3 = expressOptDiv.appendChild(document.createElement('div'));

  var span7 = div3.appendChild(document.createElement('span'));
  span7.setAttribute('style', "margin:1px 1px 1px 0px;");
  span7.innerHTML = "overlap mode:";
  var overlapmodeSelect = div3.appendChild(createOverlapmodeSelect(glyphTrack.trackID));

  var span2 = div3.appendChild(document.createElement('span'));
  span2.setAttribute('style', "margin: 1px 1px 1px 5px;");
  span2.innerHTML = "expression binning:";
  var binningSelect = div3.appendChild(createBinningSelect(glyphTrack.trackID));

  //----------
  var exprbin_strandless = glyphTrack.exprbin_strandless
  if(glyphTrack.newconfig.exprbin_strandless !== undefined) { exprbin_strandless = glyphTrack.newconfig.exprbin_strandless; }
  div3 = expressOptDiv.appendChild(document.createElement('div'));
  div3.setAttribute('style', "margin:3px 0px 3px 0px;");
  var strandlessCheck = div3.appendChild(document.createElement('input'));
  strandlessCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  strandlessCheck.setAttribute('type', "checkbox");
  if(exprbin_strandless) { strandlessCheck.setAttribute('checked', "checked"); }
  strandlessCheck.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_strandless', this.checked);");
  var span1 = div3.appendChild(document.createElement('span'));
  span1.innerHTML = "process strandless";

  var exprbin_subfeatures = glyphTrack.exprbin_subfeatures
  if(glyphTrack.newconfig.exprbin_subfeatures !== undefined) { exprbin_subfeatures = glyphTrack.newconfig.exprbin_subfeatures; }
  var subfeatCheck = div3.appendChild(document.createElement('input'));
  subfeatCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  subfeatCheck.setAttribute('type', "checkbox");
  if(exprbin_subfeatures) { subfeatCheck.setAttribute('checked', "checked"); }
  subfeatCheck.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_subfeatures', this.checked);");
  var span1 = div3.appendChild(document.createElement('span'));
  span1.innerHTML = "omit gaps (introns)";

  var tspan2 = div3.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "margin: 1px 4px 1px 30px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  tspan2.innerHTML = "fixed bin size:";
  var binsizeInput = div3.appendChild(document.createElement('input'));
  binsizeInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  binsizeInput.setAttribute('type', "text");
  binsizeInput.setAttribute('size', "10");
  binsizeInput.setAttribute('value', glyphTrack.exprbin_binsize);
  binsizeInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_binsize', this.value);");
  binsizeInput.setAttribute("onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_binsize', this.value);");

  var editButton = div3.appendChild(document.createElement('input'));
  editButton.setAttribute("style", "float:right; font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  editButton.setAttribute("type", "button");
  editButton.setAttribute("value", "edit script");
  editButton.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_editxml', '');");
}



//--------------------------------------------------------
//
// track re-configuration control panel section
//
//--------------------------------------------------------

function gLyphsReconfigureTrackPanel(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(!glyphTrack.svg) { return; }

  zenbuReconfigureTrackPanel(glyphTrack);
}


function zenbuReconfigureTrackPanel(glyphTrack) {
  if(!glyphTrack) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
  trackID = glyphTrack.trackID;

  if(glyphTrack.newconfig !== undefined) { return; }
  glyphTrack.newconfig = new Object;
  if(glyphTrack.script) {
    //always clone the script into newconfig
    glyphTrack.newconfig.script = Object.clone(glyphTrack.script);
  } 

  var divFrame = document.createElement('div');
  divFrame.id = trackID+"_reconfigure_divframe";
  divFrame.setAttribute('style', "position:absolute; background-color:PaleGreen; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"font-size:10px; font-family:arial,helvetica,sans-serif; "
                            +"left:"+(current_region.display_width-500)+"px;"
                            +"top:" + toolTipSTYLE.ypos +"px; "
                            +"width:500px;"
                             );

  var tdiv, tspan, tlabel;

  //----------
  var fsrc_count =0;
  var exp_count = 0;
  if(glyphTrack.sources && glyphTrack.sources.length>0) {
    var src_array = glyphTrack.sources.split(",");
    fsrc_count += src_array.length;
  }
  var srcs = ""+glyphTrack.source_ids;
  var src_array = srcs.split(",");
  var src_regex = /^(.+)\:\:(\d+)\:\:\:(.+)$/;
  for(var i=0; i<src_array.length; i++) {
    var src = src_array[i];
    var mymatch = src_regex.exec(src);
    if(mymatch && (mymatch.length == 4)) {
      if(mymatch[3] == "Experiment") { exp_count++; }
      if(mymatch[3] == "FeatureSource") { fsrc_count++; }
    }
  }

  //close button
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 0px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'cancel-reconfig'); return false; ");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //wiki help
  helpdiv = divFrame.appendChild(document.createElement('div'));
  helpdiv.setAttribute("style", "float:right; margin-right:3px; padding:0px 3px 0px 3px; font-size:10px; color:#505050; background-color:#D0D0D0;");
  helpdiv.setAttribute("onclick", "zenbuRedirect('http://fantom.gsc.riken.jp/zenbu/wiki/index.php/Configuring_Tracks');");
  helpdiv.setAttribute("onmouseover", "eedbMessageTooltip('need help with reconfiguring?<br>check out the wiki pages',180);");
  helpdiv.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  helpdiv.innerHTML = "?";




  //----------  Description div
  //
  var infoDiv = divFrame.appendChild(document.createElement('div'));

  if(glyphTrack.uuid) {
    var div1 = infoDiv.appendChild(document.createElement('div'));
    div1.setAttribute("style", "float:right; margin-right:6px; font-size:9px; font-family:arial,helvetica,sans-serif; ");
    var span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "color:black; ");
    span1.innerHTML = "shared track: ";
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "color:orange; ");
    span1.innerHTML = glyphTrack.uuid;
  }
  tdiv = infoDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  var span0 = tdiv.appendChild(document.createElement('span'));
  span0.innerHTML ="Track information: ";
  var span0 = tdiv.appendChild(document.createElement('span'));
  span0.setAttribute('style', "font-size:9px; font-weight:normal; font-family:arial,helvetica,sans-serif; fill:gray; ");
  span0.innerHTML  = trackID;

  if(glyphTrack.hashkey) {
    var div1 = infoDiv.appendChild(document.createElement('div'));
    div1.setAttribute("style", "float:right; margin-right:1px; font-size:9px; font-family:arial,helvetica,sans-serif; ");
    var span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "color:black; ");
    span1.innerHTML = "cache hashkey: ";
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "color:orange; ");
    span1.innerHTML = glyphTrack.hashkey;
  }
  tdiv = infoDiv.appendChild(document.createElement('div'));
  var span0 = tdiv.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin: 0px 1px 3px 3px; font-size:12px; font-family:arial,helvetica,sans-serif; vertical-align:top; ");
  span0.innerHTML = "title:"; 
  var titleInput = tdiv.appendChild(document.createElement('input'));
  titleInput.setAttribute('style', "width:90%; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', glyphTrack.title);
  titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
  titleInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");

  tdiv = infoDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-left:3px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tdiv.innerHTML = "description:";

  var descInput = infoDiv.appendChild(document.createElement('textarea'));
  descInput.setAttribute('style', "min-width:480px; max-width:480px; min-height:30px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 3);
  descInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'description', this.value);");
  descInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'description', this.value);");
  if(glyphTrack.description) { 
    descInput.setAttribute("value", glyphTrack.description); 
    descInput.innerHTML = glyphTrack.description; 
  }

  infoDiv.appendChild(document.createElement('hr'));


  //----------  Data sources
  //
  var sourcesDiv = divFrame.appendChild(document.createElement('div'));

  var tdiv2 = sourcesDiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var check1 = tdiv2.appendChild(document.createElement('input'));
  check1.setAttribute('style', "margin: 1px 1px 1px 10px;");
  check1.setAttribute('type', "checkbox");
  if(glyphTrack.noCache) { check1.setAttribute('checked', "checked"); }
  check1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'noCache', this.checked);");
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute("style", "color:gray;");
  span1.innerHTML = "no caching";

  var tdiv2 = sourcesDiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var check1 = tdiv2.appendChild(document.createElement('input'));
  check1.setAttribute('style', "margin: 1px 1px 1px 10px;");
  check1.setAttribute('type', "checkbox");
  if(glyphTrack.noNameSearch) { check1.setAttribute('checked', "checked"); }
  check1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'noNameSearch', this.checked);");
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute("style", "color:gray;");
  span1.innerHTML = "no name searching";


  tspan = sourcesDiv.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  tspan.innerHTML ="Data sources: ";

  //---
  tdiv = sourcesDiv.appendChild(document.createElement('div'));

  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif;");
  var src_msg = "data sources: ";
  if(fsrc_count>0) { src_msg += "feature_sources["+fsrc_count+"]  "; }
  if(exp_count>0)  { src_msg += "experiments["+exp_count+"]"; } 
  tspan.innerHTML = src_msg;

  //var button1 = tdiv.appendChild(document.createElement('input'));
  //button1.setAttribute("type", "button");
  //button1.setAttribute("value", "edit sources");
  //button1.setAttribute("style", "font-size:9px; margin: 0px 4px 4px 4px;");
  //button1.setAttribute("onclick", "gLyphsTrackEditSources(\""+ trackID+"\");");
  
  //---
  tdiv = sourcesDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top: 1px;");
  
  var tdiv2 = tdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var link1 = tdiv2.appendChild(document.createElement("a"));
  link1.setAttribute("href", "./#config=" +current_region.configUUID);
  link1.setAttribute("style", "color:gray;");
  link1.setAttribute("onclick", "glyphsTrackDatastreamXMLPanel(\""+ trackID+"\"); return false;");
  link1.innerHTML = "datastream xml";  
  
  var outmodeSelect = createSourceOutmodeSelect(trackID);
  if(outmodeSelect) { 
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:10px; font-size:9px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "feature mode: "; 
    tdiv.appendChild(outmodeSelect); 
  }

  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) { 
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:20px; font-size:9px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "expression datatype:"; 
    tdiv.appendChild(datatypeSelect); 
  }
    

  //
  //---------- Scripting
  //
  var streamDiv = divFrame.appendChild(document.createElement('div'));
  streamDiv.id = trackID + "_streamprocessDiv";

  //
  //---------- Visualization
  //
  divFrame.appendChild(document.createElement('hr'));
  //wiki help
  helpdiv = divFrame.appendChild(document.createElement('div'));
  helpdiv.setAttribute("style", "float:right; margin-right:3px; padding:0px 3px 0px 3px; font-size:10px; color:#505050; background-color:#D0D0D0;");
  helpdiv.setAttribute("onclick", "zenbuRedirect('http://fantom.gsc.riken.jp/zenbu/wiki/index.php/Track_visualization_styles');");
  helpdiv.setAttribute("onmouseover", "eedbMessageTooltip('need help with visualization options?<br>check out the wiki pages',180);");
  helpdiv.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  helpdiv.innerHTML = "?";

  var visualizeDiv = divFrame.appendChild(document.createElement('div'));
  tspan = visualizeDiv.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  tspan.innerHTML ="Visualization: ";

  /*
  var div1 = divFrame.appendChild(document.createElement('div'));
  var span0 = div1.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin: 0px 1px 3px 3px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "title:"; 
  var titleInput = div1.appendChild(document.createElement('input'));
  titleInput.setAttribute('style', "width:90%; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', glyphTrack.title);
  titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
  titleInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
  */

  //----------
  var glyphSelect = createGlyphstyleSelect(glyphTrack);
  divFrame.appendChild(glyphSelect);

  //
  //----------  buttons
  //
  divFrame.appendChild(document.createElement('hr'));
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'cancel-reconfig');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "accept config");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-reconfig');");
  divFrame.appendChild(button2);

  var button3 = document.createElement('input');
  button3.setAttribute("type", "button");
  button3.setAttribute("value", "share track");
  button3.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button3.setAttribute("onclick", "glyphsSaveTrackConfig(\""+ trackID+"\");");
  divFrame.appendChild(button3);
  if(glyphTrack.uuid) { 
    button3.setAttribute("disabled", "disabled"); 
    button3.setAttribute("value", "track already shared");
  }

  var button4 = document.createElement('input');
  button4.id = trackID + "_saveScriptButton";
  button4.setAttribute("type", "button");
  button4.setAttribute("value", "save script");
  button4.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button4.setAttribute("disabled", "disabled");
  button4.setAttribute("onclick", "glyphsSaveScriptConfig(\""+ trackID+"\");");
  divFrame.appendChild(button4);

  //----------
  trackDiv.appendChild(divFrame);
  buildStreamProcessDiv(trackID);
}


function createGlyphstyleSelect(glyphTrack) {
  //var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  var trackID = glyphTrack.trackID;

  var colorMode = glyphTrack.colorMode;
  if(glyphTrack.newconfig.colorMode !== undefined) {  colorMode = glyphTrack.newconfig.colorMode; }

  var hidezeroexps = glyphTrack.hidezeroexps;
  if(glyphTrack.newconfig.hidezeroexps !== undefined) { hidezeroexps = glyphTrack.newconfig.hidezeroexps; }

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphTrack.newconfig.glyphStyle !== undefined) { glyphStyle = glyphTrack.newconfig.glyphStyle; }

  var div1         = document.getElementById(trackID + "_glyphselectDiv");
  var glyphSelect  = document.getElementById(trackID + "_glyphselect");
  var colorOptions = document.getElementById(trackID + "_glyphselect_color_options");
  var colorModeDiv = document.getElementById(trackID + "_colormode_div");
  var colorRadio1  = document.getElementById(trackID + "_colormode_radio1");
  var colorRadio2  = document.getElementById(trackID + "_colormode_radio2");
  var colorRadio3  = document.getElementById(trackID + "_colormode_radio3");
  var zeroexpCheck = document.getElementById(trackID + "_glyphselect_hidezeroexps_check");
  var expressOptDiv  = document.getElementById(trackID + "_extendedExpressOptions");
  var expressOpts2  = document.getElementById(trackID + "_expressOptions2");
  var dtypeSelect    = document.getElementById(trackID + "_glyphselect_datatype");
  var strandColorDiv = document.getElementById(trackID + "_glyphselect_strand_colors");

  if(!div1) {
    div1 = document.createElement('div');
    div1.id = trackID + "_glyphselectDiv";
    div1.setAttribute("style", "margin:2px 0px 2px 0px;");

    var span2 = div1.appendChild(document.createElement('span'));
    span2.innerHTML = "visualization style: ";

    glyphSelect = div1.appendChild(document.createElement('select'));
    glyphSelect.id = trackID + "_glyphselect";
    glyphSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'glyphStyle', this.value);");
    
    //-------- display datatype
    dtypeSelect = div1.appendChild(document.createElement('span'));
    dtypeSelect.id = trackID + "_glyphselect_datatype";
    dtypeSelect.setAttribute("style", "margin:1px 0px 0px 3px; float:right;");

    //-------- expression options
    expressOptDiv = div1.appendChild(document.createElement('div'));
    expressOptDiv.id = trackID + "_extendedExpressOptions";
    expressOptDiv.setAttribute('style', "padding: 3px 0px 1px 7px; display:block");
    //----------
    //var div3 = expressOptDiv.appendChild(document.createElement('div'));
    var span3 = expressOptDiv.appendChild(document.createElement('span'));
    span3.innerHTML = "track height: ";
    var levelInput = expressOptDiv.appendChild(document.createElement('input'));
    levelInput.id = trackID + "_trackHeightInput";
    levelInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    levelInput.setAttribute('size', "5");
    levelInput.setAttribute('type', "text");
    levelInput.setAttribute('value', glyphTrack.track_height);
    levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'height', this.value);");
    
    //--------------
    expressOpts2 = expressOptDiv.appendChild(document.createElement('span'));
    expressOpts2.id = trackID + "_expressOptions2";
    expressOpts2.setAttribute('style', "display:inline");

    var span3 = expressOpts2.appendChild(document.createElement('span'));
    var logCheck = span3.appendChild(document.createElement('input'));
    logCheck.setAttribute('style', "margin: 1px 2px 1px 10px;");
    logCheck.setAttribute('type', "checkbox");
    if(glyphTrack.logscale == 1) { logCheck.setAttribute('checked', "checked"); }
    logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'logscale', this.checked);");
    var span1 = span3.appendChild(document.createElement('span'));
    span1.innerHTML = "log scale";
    
    var strandlessCheck = span3.appendChild(document.createElement('input'));
    strandlessCheck.id = trackID + "_strandlessVisualCheck";
    strandlessCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
    strandlessCheck.setAttribute('type', "checkbox");
    if(glyphTrack.strandless) { strandlessCheck.setAttribute('checked', "checked"); }
    strandlessCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'strandless', this.checked);");
    var span1 = span3.appendChild(document.createElement('span'));
    span1.innerHTML = "strandless";
    
    var div3 = expressOpts2.appendChild(document.createElement('div'));
    var span4 = div3.appendChild(document.createElement('span'));
    //span4.setAttribute('style', "margin-left: 3px;");
    span4.innerHTML = "signal scale: ";
    var levelInput = div3.appendChild(document.createElement('input'));
    levelInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    levelInput.setAttribute('size', "5");
    levelInput.setAttribute('type', "text");
    levelInput.setAttribute('value', glyphTrack.expscaling);
    levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'expscaling', this.value);");
    
    var span2 = div3.appendChild(document.createElement('span'));
    span2.setAttribute('style', "margin: 1px 2px 1px 5px;");
    span2.innerHTML = "experiment merge:";
    var binningSelect = div3.appendChild(createExperimentMergeSelect(glyphTrack.trackID));
    //--- end expressOptDiv

    /*
    colorCheck = div1.appendChild(document.createElement('input'));
    colorCheck.id = trackID + "_glyphselect_scorecolor_check";
    colorCheck.setAttribute('style', "margin: 0px 3px 0px 15px;");
    colorCheck.setAttribute('type', "checkbox");
    colorCheck.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'scorecolor', this.checked);");
    div1.appendChild(document.createTextNode("color on signal"));
    if(glyphTrack.glyphStyle == "1D-heatmap" || glyphTrack.glyphStyle == "experiment-heatmap" || 
       glyphTrack.glyphStyle == "xyplot" || glyphTrack.glyphStyle == "signal-histogram" ||
       glyphTrack.glyphStyle == "split-signal") {
      colorCheck.setAttribute('disabled', "disabled");
    }
    */

    //-------- color mode
    colorModeDiv = div1.appendChild(document.createElement('div'));
    colorModeDiv.setAttribute("id", trackID + "_colormode_div");
    colorModeDiv.appendChild(document.createTextNode("color on:"));

    colorRadio1 = colorModeDiv.appendChild(document.createElement('input'));
    colorRadio1.setAttribute("type", "radio");
    colorRadio1.setAttribute("id", trackID + "_colormode_radio1");
    colorRadio1.setAttribute("name", trackID + "_colormode");
    colorRadio1.setAttribute("value", "strand");
    colorRadio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'colorMode', this.value);");
    tspan = colorModeDiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "strand";

    colorRadio2 = colorModeDiv.appendChild(document.createElement('input'));
    colorRadio2.setAttribute("type", "radio");
    colorRadio2.setAttribute("id", trackID + "_colormode_radio2");
    colorRadio2.setAttribute("name", trackID + "_colormode");
    colorRadio2.setAttribute("value", "signal");
    colorRadio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'colorMode', this.value);");
    tspan = colorModeDiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "signal";

    colorRadio3 = colorModeDiv.appendChild(document.createElement('input'));
    colorRadio3.setAttribute("type", "radio");
    colorRadio3.setAttribute("id", trackID + "_colormode_radio3");
    colorRadio3.setAttribute("name", trackID + "_colormode");
    colorRadio3.setAttribute("value", "mdata");
    colorRadio3.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'colorMode', this.value);");
    tspan = colorModeDiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "metadata";
    //bed:itemRgb
    
    /*
    zeroexpCheck = div1.appendChild(document.createElement('input'));
    zeroexpCheck.id = trackID + "_glyphselect_hidezeroexps_check";
    zeroexpCheck.setAttribute('style', "margin: 0px 3px 0px 15px;");
    zeroexpCheck.setAttribute('type', "checkbox");
    zeroexpCheck.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'hidezeroexps', this.checked);");
    div1.appendChild(document.createTextNode("hide empty experiments"));
    */
    
    //---------- color options
    colorOptions = div1.appendChild(document.createElement('div'));
    colorOptions.id = trackID + "_glyphselect_color_options";
    colorOptions.setAttribute('style', "margin: 1px 0px 1px 1px;");

    //---------- strand colors
    strandColorDiv = div1.appendChild(document.createElement('div'));
    strandColorDiv.id = trackID + "_glyphselect_strand_colors";

    strandColorDiv.setAttribute('style', "margin-top:2px;");
    tspan2 = strandColorDiv.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "sense color:";
    var colorInput = strandColorDiv.appendChild(document.createElement('input'));
    colorInput.setAttribute('value', glyphTrack.posStrandColor);
    colorInput.setAttribute('size', "7");
    colorInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'posStrandColor', this.value);");
    colorInput.color = new jscolor.color(colorInput);
    strandColorDiv.appendChild(colorInput);
    
    tspan2 = strandColorDiv.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 3px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "anti-sense color:";
    var colorInput = strandColorDiv.appendChild(document.createElement('input'));
    colorInput.setAttribute('value', glyphTrack.revStrandColor);
    colorInput.setAttribute('size', "7");
    colorInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'revStrandColor', this.value);");
    colorInput.color = new jscolor.color(colorInput);
    strandColorDiv.appendChild(colorInput);
    
    tspan2 = strandColorDiv.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 30px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "background color:";
    var backColorInput = strandColorDiv.appendChild(document.createElement('input'));
    backColorInput.setAttribute('value', glyphTrack.backColor);
    backColorInput.setAttribute('size', "7");
    backColorInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'backColor', this.value);");
    backColorInput.color = new jscolor.color(backColorInput);
    strandColorDiv.appendChild(backColorInput);

  }
  glyphSelect.innerHTML = "";

  var styles = new Array;
  styles.push("signal-histogram", "split-signal", "xyplot", "1D-heatmap", "experiment-heatmap");
  styles.push("thick-arrow", "medium-arrow", "arrow", "centroid");
  styles.push("transcript", "transcript2", "thick-transcript", "thin-transcript");
  styles.push("box", "thick-box", "thin-box");
  styles.push("cytoband");
  //styles.push("box", "line", "exon", "medium-exon", "thin-exon", "utr","thin");
  //styles.push("probesetloc", "seqtag", "scorethick");
  styles.push("box-scorethick", "transcript-scorethick");
  styles.push("seqalign");

  for(var i=0; i<styles.length; i++) {
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", styles[i]);
    if(styles[i] == glyphStyle) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = styles[i];
    glyphSelect.appendChild(option);
  }

  if(colorMode == "strand") { colorRadio1.checked = "checked"; }
  if(colorMode == "signal") { colorRadio2.checked = "checked"; }
  if(colorMode == "mdata")  { colorRadio3.checked = "checked"; }
  //if(zeroexpCheck) {
  //  if(hidezeroexps) { zeroexpCheck.checked = true; }
  //  else { zeroexpCheck.checked = false; }
  //}
  if(colorOptions) {
    if(colorMode == "signal") {
      colorOptions.style.display = 'block';
      colorOptions.innerHTML = "";
      colorOptions.appendChild(gLyphsColorSpaceOptions(glyphTrack));
    } else if(colorMode == "mdata") {
      colorOptions.style.display = 'block';
      colorOptions.innerHTML = "";
      colorOptions.appendChild(gLyphsColorMdataOptions(glyphTrack));
    } else {
      colorOptions.style.display = 'none';
    }
  }

  if(glyphStyle == "signal-histogram" || glyphStyle == "xyplot" || glyphStyle == "split-signal") {
    expressOptDiv.style.display = "block";
    expressOpts2.style.display = "inline";
    colorModeDiv.style.display  = "none";
  } else if(glyphStyle == "experiment-heatmap" || glyphStyle == "1D-heatmap") {
    expressOptDiv.style.display = "block";
    expressOpts2.style.display = "none";
    colorModeDiv.style.display  = "none";
  } else {
    expressOptDiv.style.display = "none";
    colorModeDiv.style.display  = "block";
  }

  // display datatype
  dtypeSelect.style.display = 'none';
  if(glyphTrack.datatypes) {
    dtypeSelect.innerHTML = "";
    var sortedTypes = new Array();
    for(var dtype in glyphTrack.datatypes) { sortedTypes.push(dtype); }
    sortedTypes.sort();
    if(sortedTypes.length>0) {
      dtypeSelect.style.display = 'inline';
      tspan2 = dtypeSelect.appendChild(document.createElement('span'));
      tspan2.innerHTML = "display datatype:";
      
      var datatypeSelect = dtypeSelect.appendChild(document.createElement('select'));
      datatypeSelect.setAttribute('name', "datatype");
      datatypeSelect.setAttribute('style', "margin: 1px 4px 1px 4px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
      datatypeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'datatype', this.value);");
      datatypeSelect.innerHTML = ""; //to clear old content
      
      for(var i=0; i<sortedTypes.length; i++) {
        var dtype = sortedTypes[i];
        var option = datatypeSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", dtype);
        if(dtype == glyphTrack.datatype) { option.setAttribute("selected", "selected"); }
        option.innerHTML = dtype;
      }
    }
  }
  
  return div1;
}


function createOverlapmodeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var overlapmodeSelect = document.createElement('select');
  overlapmodeSelect.setAttribute('name', "submode");
  overlapmodeSelect.setAttribute('style', "margin: 1px 4px 1px 4px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  overlapmodeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'overlap_mode', this.value);");

  var overlap_mode = glyphTrack.overlap_mode;
  if(glyphTrack.newconfig && glyphTrack.newconfig.overlap_mode) { overlap_mode = glyphTrack.newconfig.overlap_mode; }

  var opt = document.createElement('option');
  opt.setAttribute('value', '5end');
  opt.innerHTML="5\' end";
  if(overlap_mode =="5end") { opt.setAttribute("selected", "selected"); }
  overlapmodeSelect.appendChild(opt);

  opt = document.createElement('option');
  opt.setAttribute('value', '3end');
  opt.innerHTML="3\' end";
  if(overlap_mode =="3end") { opt.setAttribute("selected", "selected"); }
  overlapmodeSelect.appendChild(opt);

  opt = document.createElement('option');
  opt.setAttribute('value', 'area');
  opt.innerHTML="area under curve";
  if(overlap_mode =="area") { opt.setAttribute("selected", "selected"); }
  overlapmodeSelect.appendChild(opt);

  opt = document.createElement('option');
  opt.setAttribute('value', 'height');
  opt.innerHTML="height";
  if(overlap_mode =="height") { opt.setAttribute("selected", "selected"); }
  overlapmodeSelect.appendChild(opt);


  return overlapmodeSelect;
}


function createDatatypeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return null; }

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) { 
    datatypeSelect = document.createElement('select');
    datatypeSelect.setAttribute('name', "datatype");
    datatypeSelect.setAttribute('style', "margin: 1px 4px 1px 4px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    datatypeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'exptype', this.value);");
    datatypeSelect.id = trackID + "_datatypeSelect";
  }
  datatypeSelect.innerHTML = ""; //to clear old content

  var source_ids = "";
  if(glyphTrack.source_ids) { source_ids = glyphTrack.source_ids; }
  if(glyphTrack.newconfig.source_ids) { source_ids = glyphTrack.newconfig.source_ids; }
  
  if(source_ids == "") { return datatypeSelect; }

  datatypeSelect.setAttribute('disabled', "disabled");
  if(glyphTrack.exptype) {
    var option = datatypeSelect.appendChild(document.createElement('option'));
    option.setAttribute("selected", "selected");
    option.innerHTML = glyphTrack.exptype;
  }

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>expression_datatypes</mode>\n";
  paramXML += "<source_ids>"+ source_ids +"</source_ids>\n"; 
  paramXML += "</zenbu_query>\n";

  var datatypeXHR=GetXmlHttpObject();
  if(datatypeXHR==null) {
    alert ("Your browser does not support AJAX!");
    return datatypeSelect;
  }
  glyphTrack.datatypeXHR = datatypeXHR;
  datatypeXHR.onreadystatechange= function(id) { return function() { displayDatatypeSelect(id); };}(trackID);

  datatypeXHR.open("POST", eedbSearchCGI, true);
  datatypeXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //datatypeXHR.setRequestHeader("Content-length", paramXML.length);
  //datatypeXHR.setRequestHeader("Connection", "close");
  datatypeXHR.send(paramXML);

  return datatypeSelect;
}


function displayDatatypeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return null; }

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) {  return; } 

  if(!glyphTrack.datatypeXHR) { return; }

  if(glyphTrack.datatypeXHR.readyState!=4) return null;
  if(glyphTrack.datatypeXHR.responseXML == null) return null;
  var xmlDoc=glyphTrack.datatypeXHR.responseXML.documentElement;
  if(xmlDoc==null)  return null;

  datatypeSelect.innerHTML = ""; //to clear old content
  datatypeSelect.removeAttribute("disabled");
  //document.getElementById("message").innerHTML = "";

  //var option = document.createElement('option');
  //option.setAttribute("value", "");
  //option.innerHTML = "no datatype filter";
  //datatypeSelect.appendChild(option);

  var exptype = glyphTrack.exptype;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exptype) { exptype = glyphTrack.newconfig.exptype; }

  var types = xmlDoc.getElementsByTagName("datatype");
  var sortedTypes = new Array();
  var selectOK = false;
  var defaultType = "";
  //document.getElementById("message").innerHTML = "dataypes: ";
  for(var i=0; i<types.length; i++) {
    sortedTypes.push(types[i]);
    var type = types[i].getAttribute("type");
    if(type == exptype) { selectOK = true; }
    //document.getElementById("message").innerHTML += "["+type+"]";

    if(type == "tpm") { defaultType=type; }
    if((type == "mapnorm_tpm") && (defaultType!="tpm")) { defaultType=type; }
    if((type == "mapnorm_tagcnt") && (defaultType!="mapnorm_tpm") && (defaultType!="tpm")) { defaultType=type; }

    if((type == "raw") && !defaultType) { defaultType=type; }
    if((type == "tagcount") && !defaultType) { defaultType=type; }
    if((type == "tagcnt") && !defaultType) { defaultType=type; }
  }
  if(!defaultType && (types.length>0)) { defaultType = types[0].getAttribute("type"); }
  glyphTrack.default_exptype = defaultType;

  sortedTypes.sort(datatype_sort_func);
  if(!selectOK || !exptype) { 
    //document.getElementById("message").innerHTML += " :: change default ["+defaultType+"]";
    exptype = defaultType;
    if(glyphTrack.newconfig) { glyphTrack.newconfig.exptype = exptype; }
  }

  for(var i=0; i<sortedTypes.length; i++) {
    var typeDOM = sortedTypes[i];
    var type = typeDOM.getAttribute("type");
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", type);
    if(type == exptype) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = type;
    datatypeSelect.appendChild(option);
  }

  return datatypeSelect;
}

function datatype_sort_func(a,b) {
  var name1 = a.getAttribute("type").toUpperCase();
  var name2 = b.getAttribute("type").toUpperCase();
  return (name2 < name1) - (name1 < name2);
}



function createBinningSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var binningSelect = document.createElement('select');
  binningSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'binning', this.value);");
  binningSelect.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; ");

  var valueArray = new Array("sum", "mean", "max", "min", "count");
  for(var i=0; i<valueArray.length; i++) {
    var binning = valueArray[i];

    var option = document.createElement('option');
    option.setAttributeNS(null, "value", binning);
    if(binning == glyphTrack.binning) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = binning;
    binningSelect.appendChild(option);
  }
  return binningSelect;
}


function createExperimentMergeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var binningSelect = document.createElement('select');
  binningSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'experiment_merge', this.value);");
  binningSelect.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; ");
  
  var valueArray = new Array("sum", "mean", "max");
  for(var i=0; i<valueArray.length; i++) {
    var binning = valueArray[i];
    
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", binning);
    if(binning == glyphTrack.experiment_merge) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = binning;
    binningSelect.appendChild(option);
  }
  return binningSelect;
}


function createSourceOutmodeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var outmodeSelect = document.createElement('select');
  outmodeSelect.id = trackID + "_source_outmode_select";
  outmodeSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'source_outmode', this.value);");
  outmodeSelect.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; ");
  
  var valueArray = new Array("full_feature", "simple_feature", "subfeature", "expression", "skip_metadata", "skip_expression");
  for(var i=0; i<valueArray.length; i++) {
    var source_outmode = valueArray[i];
    
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", source_outmode);
    if(source_outmode == glyphTrack.source_outmode) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = source_outmode;
    outmodeSelect.appendChild(option);
  }
  return outmodeSelect;
}


//
//--------------------------------------------------------
//

function glyphsTrackDatastreamXMLPanel(trackID) {
  //a simple pop-up style panel to make it easy to get the <datastream> XML 
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) { return; }
    
  var dstream_panel = document.getElementById(trackID + "_datastream_xml_panel");
  if(!dstream_panel) {
    dstream_panel = trackDiv.appendChild(document.createElement('div'));
    dstream_panel.id = trackID + "_datastream_xml_panel";
    dstream_panel.style.display = 'none';
  }
  
  var e = window.event
  toolTipWidth=450;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos+10;
  var ypos = toolTipSTYLE.ypos + 10;
  
  dstream_panel.innerHTML = "";
  dstream_panel.setAttribute('style', "position:absolute; background-color:#CAFBDA; text-align:left; "
                         +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                         +"left:"+(xpos-450)+"px; "
                         +"top:"+(ypos)+"px; "
                         +"width:450px;"
                         );
  dstream_panel.style.display = 'block';
  
  var tdiv, tspan, tinput;
  
  tdiv = dstream_panel.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "glyphsTrackDatastreamXMLPanelClose(\""+trackID+"\");return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //make sure the source information is loaded into sources_hash
  gLyphsTrackFetchSourcesInfo(trackID);

  tspan = dstream_panel.appendChild(document.createElement('div'));
  tspan.setAttribute("style", "font-size:12px; margin:5px 0px 3px 10px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  tspan.innerHTML ="Track datastream XML";
  
  
  //----------
  var dataArea = dstream_panel.appendChild(document.createElement('textarea'));
  dataArea.setAttribute('style', "min-width:430px; max-width:430px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  dataArea.setAttribute('rows', 10);
  dataArea.setAttribute('wrap', "off"); 
  
  var sourceTxt = "<datastream name=\"" + trackID+"\" output=\""+ glyphTrack.source_outmode+"\" ";
  if(glyphTrack.exptype)  { sourceTxt += "datatype=\""+ glyphTrack.exptype+"\" "; }
  sourceTxt += " >\n";

  for(var srcID in glyphTrack.sources_hash) {
    var source = glyphTrack.sources_hash[srcID];
    if(!source) { continue; }
    if(!source.id) { continue; }
    
    sourceTxt += "   <source ";
    if(source.name)     { sourceTxt += "name=\""+source.name+"\" "; }
    if(source.platform) { sourceTxt += "platform=\""+source.platform+"\" "; }
    if(source.category) { sourceTxt += "category=\""+source.category+"\" "; }
    if(source.id)       { sourceTxt += "id=\""+source.id+"\" "; }
    sourceTxt += "/>\n";
  }
  sourceTxt += "</datastream>\n";  

  dataArea.innerHTML = sourceTxt
}


function glyphsTrackDatastreamXMLPanelClose(trackID) {
  var dstream_panel = document.getElementById(trackID + "_datastream_xml_panel");
  if(!dstream_panel) { return; }
  dstream_panel.style.display = 'none';
}



//--------------------------------------------------------
//
// download data from track control panel section
//
//--------------------------------------------------------


function gLyphsDownloadTrackPanel(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  if(!glyphTrack.svg) { return; }

  if(glyphTrack.newconfig !== undefined) { return; }
  glyphTrack.newconfig = new Object;
  if(glyphTrack.script) {
    glyphTrack.newconfig.spstream_mode = "custom";
  }
  
  glyphTrack.download = new Object;
  glyphTrack.download.format = "osc";
  glyphTrack.download.savefile = false;
  glyphTrack.download.mode = "visible";
  glyphTrack.download.subfeatures = "none";
  glyphTrack.download.feature_metadata = false;
  glyphTrack.download.experiment_metadata = false;
  glyphTrack.download.osc_metadata = false;  
  glyphTrack.download.location = current_region.chrom +":" + current_region.start + ".." + current_region.end;

  var divFrame = document.createElement('div');
  divFrame.id = trackID+"_download_divframe";
  divFrame.setAttribute('style', "position:absolute; background-color:PaleTurquoise; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"font-size:10px; font-family:arial,helvetica,sans-serif; "
			    +"left:"+(current_region.display_width-370)+"px;"
                            +"top:" + toolTipSTYLE.ypos +"px; "
			    +"width:370px;"
                             );
  trackDiv.appendChild(divFrame);

  var tdiv, tdiv2, tspan, tlabel;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'cancel-download');return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");


  //----------
  var fsrc_count =0;
  var exp_count = 0;
  if(glyphTrack.sources && glyphTrack.sources.length>0) {
    var src_array = glyphTrack.sources.split(",");
    fsrc_count += src_array.length;
  }
  var srcs = ""+glyphTrack.source_ids;
  var src_array = srcs.split(",");
  var src_regex = /^(.+)\:\:(\d+)\:\:\:(.+)$/;
  for(var i=0; i<src_array.length; i++) {
    var src = src_array[i];
    var mymatch = src_regex.exec(src);
    if(mymatch && (mymatch.length == 4)) {
      if(mymatch[3] == "Experiment") { exp_count++; }
      if(mymatch[3] == "FeatureSource") { fsrc_count++; }
    }
  }

  //----------
  trackTypeDiv = divFrame.appendChild(document.createElement('div'));
  tspan = trackTypeDiv.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  tspan.innerHTML ="Download Track data: ";

  //----------
  tdiv = divFrame.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif;");
  var src_msg = "data sources: ";
  if(fsrc_count>0) { src_msg += "feature_sources["+fsrc_count+"]  "; }
  if(exp_count>0)  { src_msg += "experiments["+exp_count+"]"; } 
  tspan.innerHTML = src_msg;

  //----------
  tdiv = divFrame.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin-right:3px;");
  tspan.innerHTML = "region:";

  if(glyphTrack.selection != null) { 
    var radio2 = tdiv.appendChild(document.createElement('input'));
    radio2.setAttribute("type", "radio");
    radio2.setAttribute("name", trackID + "_DownloadMode");
    radio2.setAttribute("value", "selection");
    radio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-mode', this.value);");
    radio2.setAttribute('checked', "checked");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "selection";
    glyphTrack.download.mode = "selection";
  }

  var radio1 = tdiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", trackID + "_DownloadMode");
  radio1.setAttribute("value", "visible");
  radio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-mode', this.value);");
  if(glyphTrack.selection == null) { radio1.setAttribute('checked', "checked"); }
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "visible region";

  var radio3 = tdiv.appendChild(document.createElement('input'));
  radio3.setAttribute("type", "radio");
  radio3.setAttribute("name", trackID + "_DownloadMode");
  radio3.setAttribute("value", "genome");
  radio3.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-mode', this.value);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "whole genome";


  //----------
  tdiv = divFrame.appendChild(document.createElement('div'));
  var radio3 = tdiv.appendChild(document.createElement('input'));
  radio3.id = trackID + "_DownloadMode_location";
  radio3.setAttribute("style", "margin-left:40px;");
  radio3.setAttribute("type", "radio");
  radio3.setAttribute("name", trackID + "_DownloadMode");
  radio3.setAttribute("value", "location");
  radio3.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-mode', this.value);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "location:";

  var input1 = tdiv.appendChild(document.createElement('input'));
  input1.setAttribute('style', "width:200px; margin: 1px 1px 1px 3px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  input1.setAttribute('type', "text");
  input1.setAttribute('value', glyphTrack.download.location);
  //input1.setAttribute("onfocus", "reconfigTrackParam(\""+ trackID+"\", 'download-location', this.value);");
  //input1.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'download-location', this.value);");
  input1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-location', this.value);");

  //----------
  var dyn_binsize = divFrame.appendChild(document.createElement('div'));
  dyn_binsize.id = trackID + "_download_dyn_binsize";

  //----------
  var build_stats = divFrame.appendChild(document.createElement('div'));
  build_stats.id = trackID + "_download_buildstats";

  //
  //----------
  //
  var download_ctrls = divFrame.appendChild(document.createElement('div'));
  download_ctrls.id = trackID + "_download_ctrls";
  //download_ctrls.style.display = "block";
  download_ctrls.style.display = "none";

  download_ctrls.appendChild(document.createElement('hr'));

  tdiv = download_ctrls.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin: 2px 0px 2px 0px;");
  tspan = createDownloadFormatSelect(trackID);
  tdiv.appendChild(tspan);

  var tcheck = tdiv.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 3px 0px 24px;");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'download-savefile', this.checked);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "save to file";

  //----------
  var download_options = download_ctrls.appendChild(document.createElement('div'));
  download_options.setAttribute('style', "margin: 2px 0px 2px 0px;");
  download_options.id = trackID + "_download_options";
  download_options.style.display = 'none';

  //----------
  var button2 = download_ctrls.appendChild(document.createElement('input'));
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "download data");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-download');");

  //-------------------------------------------
  gLyphsDownloadOptions(glyphTrack);
  gLyphsDownloadRegionBuildStats(trackID);
}


function createDownloadFormatSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var span1 = document.createElement('span');
  span1.setAttribute("style", "margin:2px 0px 2px 0px;");

  var span2 = document.createElement('span');
  span2.innerHTML = "download format: ";
  span1.appendChild(span2);

  var formatSelect = span1.appendChild(document.createElement('select'));
  formatSelect.id = trackID + "_download_format_select";
  formatSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-format', this.value);");
  formatSelect.innerHTML = "";

  var formats = new Object;
  formats["osc"] = "osc table";
  formats["bed12"] = "bed12";
  formats["bed6"] = "bed6";
  formats["bed3"] = "bed3";
  formats["gff"] = "gff";
  //formats["wig"] = "wig";
  formats["fullxml"] = "zenbu xml";
  formats["das"] = "das xml";
  for(var format in formats) {
    var desc = formats[format];
    var option = formatSelect.appendChild(document.createElement('option'));
    option.setAttributeNS(null, "value", format);
    if(format == glyphTrack.download.format) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = desc;
  }
  return span1;
}


function gLyphsDownloadOptions(glyphTrack) {
  if(!glyphTrack) { return; }
  
  var trackID = glyphTrack.trackID;
  
  var download_options = document.getElementById(trackID + "_download_options");
  if(!download_options) { return; }

  download_options.style.display = 'none';

  if(!glyphTrack.download) { return; }
  
  if(glyphTrack.download.format == "osc") {
    download_options.innerHTML = "";
    download_options.style.display = "block";

    //-----
    var tdiv = download_options.appendChild(document.createElement('div'));
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "subfeatures: ";

    var radio1 = tdiv.appendChild(document.createElement('input'));
    radio1.setAttribute("style", "margin-left:7px;");
    radio1.setAttribute("type", "radio");
    radio1.setAttribute("name", trackID + "_DownloadSubfeatureRadio");
    radio1.setAttribute("value", "none");
    radio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-subfeatures', this.value);");
    if(glyphTrack.download.subfeatures == "none") { radio1.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "none";

    var radio2 = tdiv.appendChild(document.createElement('input'));
    radio2.setAttribute("style", "margin-left:7px;");
    radio2.setAttribute("type", "radio");
    radio2.setAttribute("name", trackID + "_DownloadSubfeatureRadio");
    radio2.setAttribute("value", "bed");
    radio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-subfeatures', this.value);");
    if(glyphTrack.download.subfeatures == "bed") { radio2.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "bed12 blocks";

    var radio3 = tdiv.appendChild(document.createElement('input'));
    radio3.setAttribute("style", "margin-left:7px;");
    radio3.setAttribute("type", "radio");
    radio3.setAttribute("name", trackID + "_DownloadSubfeatureRadio");
    radio3.setAttribute("value", "cigar");
    radio3.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'download-subfeatures', this.value);");
    if(glyphTrack.download.subfeatures == "cigar") { radio3.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "zenbu cigar";

    //-----
    tdiv = download_options.appendChild(document.createElement('div'));
    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'download-feature-metadata', this.checked);");
    if(glyphTrack.download.feature_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "feature metadata";

    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'download-experiment-metadata', this.checked);");
    if(glyphTrack.download.experiment_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "experiment metadata";
    
    //-----
    tdiv = download_options.appendChild(document.createElement('div'));
    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'download-osc-metadata', this.checked);");
    if(glyphTrack.download.osc_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "oscheader metadata (skip for excel)";
  }
}


function glyphsPostDownloadRequest(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  //trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  glyphTrack.newconfig = undefined;

  gLyphsShowTrackLoading(trackID);

  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var chromloc = chrom +":" + start + ".." + end;

  var dwidth     = current_region.display_width;
  
  var url = eedbRegionCGI;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<format>"+glyphTrack.download.format+"</format>\n";
  paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n";
  paramXML += "<view_uuid>"+ current_region.configUUID +"</view_uuid>\n";

  paramXML += "<export_subfeatures>"+glyphTrack.download.subfeatures+"</export_subfeatures>\n";
  paramXML += "<export_feature_metadata>"+glyphTrack.download.feature_metadata+"</export_feature_metadata>\n";
  paramXML += "<export_experiment_metadata>"+glyphTrack.download.experiment_metadata+"</export_experiment_metadata>\n";
  paramXML += "<export_osc_metadata>"+glyphTrack.download.osc_metadata+"</export_osc_metadata>\n";

  paramXML += "<asm>"+current_region.asm+"</asm>\n";

  if(glyphTrack.download.mode == "selection") {
    var ss = glyphTrack.selection.chrom_start;
    var se = glyphTrack.selection.chrom_end;
    if(ss>se) { var t=ss; ss=se; se=t; }
    chromloc = chrom +":" + ss + ".." + se;
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "visible") {
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "genome") {
    paramXML += "<genome_scan>genome</genome_scan>\n";
  }
  if(glyphTrack.download.mode == "location") {
    paramXML += "<loc>"+glyphTrack.download.location+"</loc>\n";
  }

  if(glyphTrack.download.savefile) { paramXML += "<savefile>true</savefile>\n"; }

  paramXML += "<mode>region</mode>\n";
  paramXML += "<output_datatype>" + glyphTrack.datatype + "</output_datatype>\n";

  paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";

  paramXML += "</zenbu_query>\n";
  
  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:640px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);
  //return;


  var form = trackDiv.appendChild(document.createElement('form'));
  form.setAttribute("method", "POST");
  form.setAttribute("target", "glyphs_download_data");
  form.setAttribute("action", eedbRegionCGI);
  form.setAttribute("enctype", "application/x-www-form-urlencoded");

  var input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "POSTDATA");
  input1.setAttribute("value", paramXML);

  form.submit();
}


function gLyphsDownloadRegionBuildStats(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
   
  var build_stats = document.getElementById(trackID + "_download_buildstats");
  if(!build_stats) return;  

  var download_ctrls = document.getElementById(trackID + "_download_ctrls");
  if(download_ctrls) { download_ctrls.style.display = "none"; }

  var dynbin_div = document.getElementById(trackID + "_download_dyn_binsize");
  if(dynbin_div) { dynbin_div.style.display = "none"; }

  //eedbCurrentUser = eedbShowLogin();

  build_stats.innerHTML ="";

  //if(!glyphTrack.hashkey) { 
  //  build_stats.setAttribute("style", "color:red; ");
  //  build_stats.innerHTML = "unable to access download at this time";
  //  return;
  //}

  build_stats.setAttribute('style', "margin: 2px 0px 2px 0px; color:black; ");
  tspan = build_stats.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML ="region build status: ";

  var stats_msg = build_stats.appendChild(document.createElement('span'));
  stats_msg.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; color:DarkOrchid;");
  stats_msg.innerHTML ="checking...";

  var div1 = build_stats.appendChild(document.createElement('div'));
  div1.setAttribute("style", "margin-left:6px; font-size:9px; font-family:arial,helvetica,sans-serif; ");
  var hashkey_span = div1.appendChild(document.createElement('span'));
  hashkey_span.setAttribute("style", "color:orange; ");
  if(glyphTrack.hashkey) {
    hashkey_span.innerHTML = glyphTrack.hashkey;
  }

  var asm      = current_region.asm;
  var chrom    = current_region.chrom;
  var start    = current_region.start;
  var end      = current_region.end;
  var chromloc = chrom +":" + start + ".." + end;
  var dwidth   = current_region.display_width;
  
  var paramXML = "<zenbu_query><format>xml</format><mode>trackcache_stats</mode>\n";
  
  if(glyphTrack.hashkey && !glyphTrack.loading) { 
    paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";
  } else {
    if(glyphTrack.peerName) { paramXML += "<peer_names>"+glyphTrack.peerName+"</peer_names>\n"; }
    if(glyphTrack.source_ids) { paramXML += "<source_ids>"+glyphTrack.source_ids+"</source_ids>\n"; }
    else {
      if(glyphTrack.sources) { paramXML += "<source_names>"+glyphTrack.sources+"</source_names>\n"; }
    }
    if(glyphTrack.exptype) { paramXML += "<exptype>"+glyphTrack.exptype+"</exptype>\n"; }
    if(glyphTrack.uuid) { paramXML += "<track_uuid>"+glyphTrack.uuid+"</track_uuid>\n"; }
  
    paramXML += "<source_outmode>" + glyphTrack.source_outmode + "</source_outmode>\n";

    if(glyphTrack.exprbin_strandless)  { paramXML += "<strandless>true</strandless>\n"; }
    if(glyphTrack.exprbin_subfeatures) { paramXML += "<overlap_check_subfeatures>true</overlap_check_subfeatures>\n"; }

    paramXML += "<display_width>"+current_region.display_width+"</display_width>\n";

    if(glyphTrack.exprbin_binsize) { paramXML += "<bin_size>"+ glyphTrack.exprbin_binsize +"</bin_size>\n"; }

    if(glyphTrack.spstream_mode == "expression") {
      paramXML += "<binning>"+glyphTrack.binning+"</binning>\n";
      paramXML += "<binning>sum</binning>\n";
      paramXML += "<overlap_mode>"+glyphTrack.overlap_mode+"</overlap_mode>\n";
      if(!glyphTrack.script) {
        //switch back to the legacy default histogram binning
        paramXML += "<expression_binning>true</expression_binning>\n"; 
      }
    }

    var glyphStyle = glyphTrack.glyphStyle;
    if(glyphStyle && (glyphStyle=="signal-histogram" || glyphStyle=="split-signal" || glyphStyle=="1D-heatmap" || glyphStyle=="experiment-heatmap")) { 
      paramXML += "<expression_visualize/>\n";
    }

    if(glyphTrack.script) {
      //inserts direct script XML <zenbu_script> since it was parsed and
      //partially validated by the javascript
      paramXML += glyphTrack.script.spstreamXML;
    }
  }

  paramXML += "<asm>"+current_region.asm+"</asm>\n";
  
  if(glyphTrack.download.mode == "selection") {
    var ss = glyphTrack.selection.chrom_start;
    var se = glyphTrack.selection.chrom_end;
    if(ss>se) { var t=ss; ss=se; se=t; }
    chromloc = chrom +":" + ss + ".." + se;
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "visible") {
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "location") {
    paramXML += "<loc>"+glyphTrack.download.location+"</loc>\n";
  }
  paramXML += "</zenbu_query>\n";
  
  var buildstatsXMLHttp=GetXmlHttpObject();
  if(buildstatsXMLHttp==null) { stats_msg.innerHTML = "unable o calculate"; return; }

  glyphTrack.buildstatsXMLHttp = buildstatsXMLHttp;
  
  buildstatsXMLHttp.onreadystatechange= function(id) { return function() { gLyphsDownloadRegionBuildStatsResponse(id); };}(trackID);
  buildstatsXMLHttp.open("POST", eedbRegionCGI, true);  //async
  buildstatsXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //buildstatsXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //buildstatsXMLHttp.setRequestHeader("Connection", "close");
  buildstatsXMLHttp.send(paramXML);
}
  

function gLyphsDownloadRegionBuildStatsResponse(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  
  var buildstatsXMLHttp = glyphTrack.buildstatsXMLHttp;
  if(!buildstatsXMLHttp) { return; }

  var trackDiv = glyphTrack.trackDiv;
  var build_stats = document.getElementById(trackID + "_download_buildstats");
  var download_ctrls = document.getElementById(trackID + "_download_ctrls");
  var dynbin_div = document.getElementById(trackID + "_download_dyn_binsize");

  build_stats.innerHTML ="";

  build_stats.setAttribute('style', "margin: 2px 0px 2px 0px; color:black; ");
  tspan = build_stats.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML ="region build status: ";

  var stats_msg = build_stats.appendChild(document.createElement('span'));
  stats_msg.id = trackID + "_download_buildstats_msg";
  stats_msg.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; color:DarkOrchid;");
  stats_msg.innerHTML ="checking...";

  var div1 = build_stats.appendChild(document.createElement('div'));
  div1.setAttribute("style", "margin-left:6px; font-size:9px; font-family:arial,helvetica,sans-serif; ");
  var hashkey_span = div1.appendChild(document.createElement('span'));
  hashkey_span.setAttribute("style", "color:orange; ");
  if(glyphTrack.hashkey) {
    hashkey_span.innerHTML = glyphTrack.hashkey;
  }

  //-----------------------
  // response
  var asm      = current_region.asm;
  if(buildstatsXMLHttp.responseXML == null) { stats_msg.innerHTML = "checking..."; return; }
  if(buildstatsXMLHttp.readyState!=4) { stats_msg.innerHTML = "checking..."; return; }
  if(buildstatsXMLHttp.status!=200) { stats_msg.innerHTML = "checking..."; return; }
  if(buildstatsXMLHttp.responseXML == null) { stats_msg.innerHTML = "checking..."; return; }
  
  var xmlDoc=buildstatsXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
  
  var configXML = xmlDoc.getElementsByTagName("gLyphTrack");
  if(configXML && configXML.length>0) {
    var dyn_binsize = configXML[0].getAttribute("global_bin_size");
    if(dyn_binsize) {
      dynbin_div.innerHTML = "";
      dynbin_div.style.display = "block";
      dynbin_div.setAttribute('style', "margin: 2px 0px 2px 0px; color:black; ");
      tspan = dynbin_div.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
      tspan.innerHTML = "dynamic binning resolution (bp): ";
      tspan = dynbin_div.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "font-size:10px; font-weight:bold; font-family:arial,helvetica,sans-serif; color:DarkOrchid;");
      tspan.innerHTML = dyn_binsize;
    }
  }

  //<build_stats percent="2.216749" numsegs="812" built="18" claimed="1" unbuilt="793"/>
  var statsXML = xmlDoc.getElementsByTagName("build_stats");
  if(!statsXML || statsXML.length == 0) { stats_msg.innerHTML = "unable to calculate"; return; }

  if(!glyphTrack.hashkey || glyphTrack.loading) {
    var cacheXML = xmlDoc.getElementsByTagName("track_cache");
    if(cacheXML) {
      glyphTrack.hashkey = cacheXML[0].getAttribute("hashkey");
      hashkey_span.innerHTML = glyphTrack.hashkey;
    }
  }

  var requestXML = xmlDoc.getElementsByTagName("track_request");
  
  var stats = statsXML[0];

  var numsegs = Math.floor(stats.getAttribute("numsegs"));
  var built   = Math.floor(stats.getAttribute("built"));
  var claimed = Math.floor(stats.getAttribute("claimed"));
  var unbuilt = Math.floor(stats.getAttribute("unbuilt"));
  var buildtime = Math.round(stats.getAttribute("build_min"))+1;

  stats_msg.innerHTML = "";
  if(numsegs>0) {
    if(numsegs == built) {
      stats_msg.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; color:green;");
      stats_msg.innerHTML = "ready for download";
      if(download_ctrls.style) { download_ctrls.style.display = "block"; }
    } else {
      stats_msg.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; color:red;");
      stats_msg.innerHTML = stats.getAttribute("percent") +"%";
      if(buildtime>90) {
        buildtime = Math.round(buildtime / 6)/10;
        stats_msg.innerHTML += " (" +buildtime+" hours)";
      } else {
        stats_msg.innerHTML += " (" +buildtime+" min)";
      }
      if(claimed>0) { stats_msg.innerHTML += " build in progress"; }

      //TODO user login version of interface
      if(eedbCurrentUser) {
        if(requestXML.length>0) {
          // request already sent please wait
          var tdiv = build_stats.appendChild(document.createElement('div'));
          tdiv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
          tdiv.innerHTML = "Your build request is pending. Please check the progress % and wait until it has completed building.";
        } else {
          var button2 = build_stats.appendChild(document.createElement('input'));
          button2.setAttribute("type", "button");
          button2.setAttribute("value", "send build request");
          button2.setAttribute('style', "margin:5px 0px 2px 30px;");
          button2.setAttribute("onclick", "gLyphsDownloadRequestBuild(\""+ trackID+"\");");
          var tdiv = build_stats.appendChild(document.createElement('div'));
          tdiv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
          tdiv.innerHTML = "this will send a prioritized request to build this region. All your download build requests are logged and available in your user profile section. This download-build request will run in the background so you do not need to keep this panel open nor do you need to keep the browser open.";
        }
      } 
      else {
        //no user logged in so give email option and anonymous option
        if(claimed>0) { 
          var tdiv = build_stats.appendChild(document.createElement('div'));
          tdiv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
          tdiv.innerHTML = "this track download region is currently building in the background. Download will become available once the building has completed.";
          tdiv.innerHTML += "<p>Please check the progress % and wait until it has completed building. You do not need to keep this panel open nor do you need to keep the browser open. You can come back here and check the progress at anytime.";
        } else {
          var button2 = build_stats.appendChild(document.createElement('input'));
          button2.setAttribute("type", "button");
          button2.setAttribute("value", "prioritize build");
          button2.setAttribute('style', "margin:2px 0px 2px 20px;");
          button2.setAttribute("onclick", "gLyphsDownloadRequestBuild(\""+ trackID+"\");");
          var tdiv = build_stats.appendChild(document.createElement('div'));
          tdiv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
          tdiv.innerHTML = "this will send an anonymous request to build this region. The background track building processes will try to prioritize this above other requests. ";
          //tdiv.innerHTML += "The user will not receive feedback when it is completed. ";
          //tdiv.innerHTML += "<p>If you would like to receive a notification email, please login with your user profile.";
          tdiv.innerHTML += "<p>Please come back here and check the progress % and wait until it has completed building. You do not need to keep this panel open nor do you need to keep the browser open.";
        }
      }

      //for refreshing the view
      var milliseconds = new Date().getTime();
      var next_refresh = Math.floor(build_stats.getAttribute("next_refresh"));
      if(next_refresh <= milliseconds) {
        build_stats.setAttribute("next_refresh", milliseconds+20000);
        var cmd = "gLyphsDownloadRegionBuildStats(\""+trackID+"\");"
        setTimeout(cmd, 20000); //20 seconds
      }
    }
  } else {
    stats_msg.innerHTML = "unable to calculate";
  }

  glyphTrack.buildstatsXMLHttp = undefined;
}


function gLyphsDownloadRequestBuild(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
   
  if(!glyphTrack.hashkey) { return; }

  var asm      = current_region.asm;
  var chrom    = current_region.chrom;
  var start    = current_region.start;
  var end      = current_region.end;
  var chromloc = chrom +":" + start + ".." + end;
  var dwidth   = current_region.display_width;
  
  var paramXML = "<zenbu_query><format>xml</format><mode>request_build</mode>\n";
  paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";
  paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n";
  paramXML += "<view_uuid>"+ current_region.configUUID +"</view_uuid>\n";
  paramXML += "<asm>"+current_region.asm+"</asm>\n";
  
  if(glyphTrack.download.mode == "selection") {
    var ss = glyphTrack.selection.chrom_start;
    var se = glyphTrack.selection.chrom_end;
    if(ss>se) { var t=ss; ss=se; se=t; }
    chromloc = chrom +":" + ss + ".." + se;
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "visible") {
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  if(glyphTrack.download.mode == "location") {
    paramXML += "<loc>"+glyphTrack.download.location+"</loc>\n";
  }
  paramXML += "</zenbu_query>\n";
  
  var buildstatsXMLHttp=GetXmlHttpObject();
  if(buildstatsXMLHttp==null) { return; }
  
  buildstatsXMLHttp.open("POST", eedbRegionCGI, false);  //synchronous
  buildstatsXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //buildstatsXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //buildstatsXMLHttp.setRequestHeader("Connection", "close");
  buildstatsXMLHttp.send(paramXML);
  
  if(buildstatsXMLHttp.responseXML == null) { return; }
  if(buildstatsXMLHttp.readyState!=4) { return; }
  if(buildstatsXMLHttp.status!=200) { return; }

  gLyphsDownloadRegionBuildStats(trackID);
}


//---------------------------------------------------------------
//
// track tool callback functions for moving, closing, zooming
//
//---------------------------------------------------------------

function removeTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var glyphset = document.getElementById("gLyphTrackSet");
  if(glyphset) { glyphset.removeChild(trackDiv); }

  if(glyphTrack.trackID == current_region.active_trackID) {
    current_region.active_trackID = undefined;
  }

  gLyphTrack_array[trackID] = null;
  active_track_XHRs[trackID] = null;
  pending_track_XHRs[trackID] = null;
  delete gLyphTrack_array[trackID];
  delete active_track_XHRs[trackID];
  delete pending_track_XHRs[trackID];

  gLyphsDrawExpressionPanel();
  //displayProbeInfo();  //old system not used anymore
  gLyphsAutosaveConfig();
}

function endDrag() {
  //document.getElementById("message").innerHTML += "global end drag ";
  moveTrack("enddrag");
  current_dragTrack = null;

  if(current_resizeTrack) {
    document.onmousemove = moveToMouseLoc;
    current_resizeTrack.resize = null;
    var trackID = current_resizeTrack.trackID;
    current_resizeTrack = null;

    gLyphsDrawTrack(trackID);
    gLyphsAutosaveConfig();
  }

  document.body.style.cursor = 'default';

  selectTrackRegion("enddrag", currentSelectTrackID);
  return false;
}


function moveTrack(mode, trackID) {

  updateTrackingLine(trackID);

  if(mode=="enddrag") {
    //document.getElementById("message").innerHTML += "end move track: " + current_dragTrack.trackID;
    current_dragTrack = null;
    if(ns4) toolTipSTYLE.visibility = "hidden";
    else toolTipSTYLE.display = "none";
  }

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var glyphset = document.getElementById("gLyphTrackSet");
  if(!glyphset) { return; }

  if(mode=="startdrag") {
    current_dragTrack = glyphTrack;
    document.onmouseup = endDrag;
  }
  if(current_dragTrack == null) { return; }

  //document.getElementById("message").innerHTML= "move track: " + current_dragTrack.trackID+  "  to: "+ trackID + " :: "+ mode;

  //
  // draw a tooltip to show that the track is moving
  //
  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "background-color:lightgray; border:inset; border-width:1px; padding: 3px 3px 3px 3px;\">";

  object_html += "moving track: " + current_dragTrack.title;
  object_html += "</div>";

  toolTipSTYLE.left = (toolTipSTYLE.xpos+10) +'px';
  toolTipSTYLE.top = (toolTipSTYLE.ypos) +'px';

  if(ns4) {
    toolTipSTYLE.document.write(object_html);
    toolTipSTYLE.document.close();
    toolTipSTYLE.visibility = "visible";
  }
  if(ns6) {
    document.getElementById("toolTipLayer").innerHTML = object_html;
    toolTipSTYLE.display='block'
  }
  if(ie4) {
    document.all("toolTipLayer").innerHTML=object_html;
    toolTipSTYLE.display='block'
  }


  if(current_dragTrack.trackID == trackID) { return; };

  var currentDrag_index;
  var targetTrack_index;
  var trackDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<trackDivs.length; i++) {
    var trackDiv = trackDivs[i];
    if(!trackDiv) continue;
    var divTrackID = trackDiv.getAttribute("id");
    if(divTrackID == trackID) { targetTrack_index = i; }
    if(divTrackID == current_dragTrack.trackID) { currentDrag_index = i; }
  }
  
  if(targetTrack_index < currentDrag_index) {
    var target_div = trackDivs[targetTrack_index];
    if(target_div) { glyphset.insertBefore(current_dragTrack.trackDiv, target_div); }
    gLyphsAutosaveConfig();
  }
  if(targetTrack_index > currentDrag_index) {
    var target_div = trackDivs[targetTrack_index];
    if(target_div) { glyphset.insertBefore(current_dragTrack.trackDiv, target_div.nextSibling); }
    gLyphsAutosaveConfig();
  }
}


function gLyphsResizeTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack && glyphTrack.loading) { return; }

  current_resizeTrack = glyphTrack;
  glyphTrack.resize = new Object;  //an object to hold start,end,svg elements
  glyphTrack.resize.ystart = toolTipSTYLE.ypos; 
  glyphTrack.resize.start_height = glyphTrack.track_height;

  document.onmouseup = endDrag;
  document.onmousemove = gLyphsTrackResizeMoveEvent;
}


function gLyphsTrackResizeMoveEvent(e) {
  if(!current_resizeTrack) { return; }
  if(current_resizeTrack.resize == null) { return; }
  
  var glyphTrack = current_resizeTrack;

  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  var height = (ypos - glyphTrack.resize.ystart) + glyphTrack.resize.start_height;
  if(height<20) { height = 20; }
  glyphTrack.track_height = height;

  //recalculate the data transforms and then redraw
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function selectTrackRegion(mode, trackID, featureID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack && glyphTrack.loading) { return; }

  updateTrackingLine(trackID);

  if(mode=="startdrag") {
    gLyphsChangeActiveTrack(trackID);

    glyphTrack.selection = new Object;  //an object to hold start,end,svg elements
    glyphTrack.selection.asm = current_region.asm;
    glyphTrack.selection.chrom = current_region.chrom;

    //document.getElementById("message").innerHTML = "total_obj_count = " + glyphTrack.total_obj_count;
    if(glyphTrack.has_expression && glyphTrack.experiment_array && (glyphTrack.experiment_array.length > 100)) { glyphTrack.delay_experiment_draw = true; }
    //if(glyphTrack.total_obj_count > 10000) { glyphTrack.delay_experiment_draw = true; }

    document.onmouseup = endDrag;
    var node  = glyphTrack.trackDiv;
    var offset = 10; //translation of svg
    while(node != null) {
      offset += node.offsetLeft;
      node = node.offsetParent;
    }
    glyphTrack.selection.offset = offset;
    currentSelectTrackID = trackID;
  }
  if(glyphTrack.selection == null) { return; }
  if((mode=="drag") && (glyphTrack.selection.active == "no")) { return; }

  var xpos   = toolTipSTYLE.xpos - glyphTrack.mouse_offset - 1;
  var start  = current_region.start;
  var end    = current_region.end;
  var dwidth = current_region.display_width;
  var chrpos = Math.floor(start + (xpos*(end-start)/dwidth));
  if(current_region.flip_orientation) { 
    chrpos = Math.floor(start + (1 - xpos/dwidth)*(end-start));
  }
  xpos = (chrpos-start)*dwidth/(end-start); //snap back to single-base resolution

  if(mode=="enddrag") {
    glyphTrack.selection.xend = xpos;
    glyphTrack.selection.chrom_end = chrpos;
    glyphTrack.selection.active = "no";
    glyphTrack.delay_experiment_draw = false;
    glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
    currentSelectTrackID = null;
    if(glyphTrack.selection.xend == glyphTrack.selection.xstart) {
      //single point click so no selection
      glyphTrack.selection = null;
      if(featureID !== undefined) {
        eedbClearSearchTooltip();
        var fidx = Math.floor(featureID);
        if(fidx == featureID) {
          var obj = glyphTrack.feature_array[fidx];
          gLyphsProcessFeatureSelect(obj);
        } else {
          gLyphsLoadObjectInfo(featureID);
        }
      } else {
        //single point click not on feature will recenter
        if(glyphTrack.last_select_point == chrpos) {      
          gLyphsRecenterView(chrpos);
          glyphTrack.last_select_point = -1;    
        } else {
          glyphTrack.last_select_point = chrpos;    
        }
        if(current_feature) { 
          gLyphsProcessFeatureSelect(); //clear feature selection
        }
      }
    }
    else if(glyphTrack.selection.chrom_start>glyphTrack.selection.chrom_end) { 
      var t=glyphTrack.selection.chrom_start; 
      glyphTrack.selection.chrom_start=glyphTrack.selection.chrom_end; 
      glyphTrack.selection.chrom_end=t; 
    }
    if(!featureID && current_feature) {
      gLyphsProcessFeatureSelect(); //clear feature selection
    }
  }

  if(mode=="startdrag") {
    glyphTrack.selection.xstart      = xpos;
    glyphTrack.selection.xend        = xpos;
    glyphTrack.selection.chrom_start = chrpos;
    glyphTrack.selection.chrom_end   = chrpos;
  }
  if(mode=="drag") {
    glyphTrack.selection.xend      = xpos;
    glyphTrack.selection.chrom_end = chrpos;
  }
  //var msg = "select x:" + glyphTrack.selection.xstart + "  y:"+ glyphTrack.selection.xend;
  //document.getElementById("message").innerHTML = msg;

  //if(glyphTrack.glyphStyle == "signal-histogram") { gLyphsDrawTrack(trackID); } 
  //else { gLyphsDrawSelection(glyphTrack); }
  gLyphsDrawTrack(trackID);
  updateTrackingLine(trackID);
}


function magnifyToSelection(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  if(glyphTrack.selection == null) { return; }
 
  var selection = glyphTrack.selection;
  gLyphsSetLocation(current_region.asm, current_region.chrom, selection.chrom_start, selection.chrom_end);
  glyphTrack.selection = null;

  eedbEmptySearchResults("glyphsSearchBox1");
  reloadRegion();
  //dhtmlHistory.add("#config="+current_region.configUUID +";loc="+current_region.asm+"::"+current_region.chrom+":"+current_region.start+".."+current_region.end);
  gLyphsChangeDhtmlHistoryLocation();
}


function updateTrackingLine(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(!glyphTrack.mouse_offset) {
    var node  = glyphTrack.trackDiv;
    var offset = 10; //translation of svg
    while(node != null) {
      offset += node.offsetLeft;
      node = node.offsetParent;
    }
    glyphTrack.mouse_offset = offset;
  }

  var e = window.event
  moveToMouseLoc(e);

  var xpos   = toolTipSTYLE.xpos - glyphTrack.mouse_offset - 2;
  var start  = current_region.start;
  var end    = current_region.end;
  var dwidth = current_region.display_width;
  var chrpos = Math.floor(start + (xpos*(end-start)/dwidth));
  if(current_region.flip_orientation) { 
    chrpos = Math.floor(start + (1 - xpos/dwidth)*(end-start));
  }
  xpos = (chrpos-start)*dwidth/(end-start); //snap back to single-base resolution
  if(isNaN(xpos)) { return; }

  if(current_region.flip_orientation) { xpos = dwidth-xpos; }
  
  current_region.trackline_xpos   = xpos;
  current_region.trackline_chrpos = chrpos;

  //document.getElementById("message").innerHTML = "trackline x:"+xpos + "  chrpos:"+chrpos;
  var desc = current_region.loc_desc;
  desc += "<span style=\'font-size:8pt; color: orangered;\'> " +chrpos+ "</span>";
  if(document.getElementById("gLyphs_location_info")) {
    document.getElementById("gLyphs_location_info").innerHTML = desc;
  }

  //loop through all the tracks and update
  for(var id in gLyphTrack_array){
    var glyphTrack = gLyphTrack_array[id];
    if(glyphTrack.trackLine) {
      glyphTrack.trackLine.setAttributeNS(null, 'x', (current_region.trackline_xpos)+'px');
    }
  }
}


function updateTitleBar() {
  for(var id in gLyphTrack_array){
    var glyphTrack = gLyphTrack_array[id];
    if(glyphTrack.titleBar) {
      if(glyphTrack.trackID == current_region.active_trackID) {
        glyphTrack.titleBar.setAttributeNS(null, 'style', 'fill: #DECAAF;'); 
      } else {
        glyphTrack.titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;'); 
      }
    }
  }
}


function gLyphsDuplicateTrack(trackID) {
  var glyphset = document.getElementById("gLyphTrackSet");

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var trackID2 = "glyphTrack" + (newTrackID++);
  //document.getElementById("message").innerHTML += "duplicate track " + trackID + "=>" + trackID2; 

  var newDiv = document.createElement('div');
  newDiv.setAttribute("align","left");
  newDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  newDiv.setAttribute("class", "gLyphTrack");
  newDiv.setAttribute("id", trackID2);
  glyphset.insertBefore(newDiv, trackDiv);

  var glyphTrack2 = Object.clone(glyphTrack);
  glyphTrack2.trackID  = trackID2;
  glyphTrack2.trackDiv = newDiv;
  glyphTrack2.svg      = createSVG(current_region.display_width+10, 13);
  glyphTrack2.glyphs_array = [];

  glyphTrack2.experiments = new Object;
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    glyphTrack2.experiments[experiment.id] = Object.clone(experiment);
  }

  gLyphTrack_array[trackID2] = glyphTrack2;

  gLyphsRenderTrack(glyphTrack2);

  gLyphsDrawTrack(trackID2);  //this creates empty tracks with the "loading" tag

  prepareTrackXHR(trackID2);
  gLyphsAutosaveConfig();
}


//---------------------------------------------------------------------------
//
// predefined scripts query/view/selection section
//
//---------------------------------------------------------------------------

function gLyphsTrackSearchScripts(trackID, cmd) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
    
  var scriptsDiv = document.getElementById(trackID + "_script_search_div");
  if(scriptsDiv == null) { return; }
    
  glyphTrack.predef_scripts = new Array();

  if(cmd == "clear") {
    scriptsDiv.innerHTML = "please enter search term";
    return;
  }
  
  if(cmd == "search") {
    var seachInput = document.getElementById(trackID + "_script_search_inputID");
    var filter = "";
    if(seachInput) { filter = seachInput.value; }
    gLyphsFetchPredefinedScripts(trackID, filter);
  }

  if(cmd == "all") {
    gLyphsFetchPredefinedScripts(trackID, "");
  }  
}


function gLyphsFetchPredefinedScripts(trackID, filter) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var scriptsDiv = document.getElementById(trackID + "_script_search_div");
  if(scriptsDiv == null) { return; }
  scriptsDiv.innerHTML = 'loading scripts...';
    
  var scripts_array = glyphTrack.predef_scripts;

  var scriptsXMLHttp=GetXmlHttpObject();
  var url = eedbConfigCGI+"?configtype=script;mode=search;format=simplexml";
  if(filter != "") { url += ";filter=" + filter; }
  
  scriptsXMLHttp.open("GET",url,false); //synchronous
  scriptsXMLHttp.send(null);
  
  if(scriptsXMLHttp.responseXML == null) return;
  if(scriptsXMLHttp.readyState!=4) return;
  if(scriptsXMLHttp.status!=200) { return; }
  if(scriptsXMLHttp.responseXML == null) return;
  
  var xmlDoc=scriptsXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
    
  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");
    
    script = new Object;
    script.uuid = uuid;
    script.selected = false;
    scripts_array.push(script);
    eedbParseConfigurationData(xmlConfig, script);
  }
  
  //show scripts
  gLyphsShowScripts(trackID);
}


function gLyphsShowScripts(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var scriptsDiv = document.getElementById(trackID + "_script_search_div");
  if(scriptsDiv == null) { return; }
  scriptsDiv.innerHTML = "";
    
  var scripts_array = glyphTrack.predef_scripts;
  if(!scripts_array) { return; }
  scripts_array.sort(gLyphs_configs_sort_func);  
  
  var div1 = scriptsDiv.appendChild(document.createElement('div'));
  div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");
  
  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('script name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
    
  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<scripts_array.length; i++) {
    var script = scripts_array[i];
    
    var tr = tbody.appendChild(new Element('tr'));
    
    if(i%2 == 0) { tr.setAttribute("style", "background-color:rgb(204,230,204);"); } 
    else         { tr.setAttribute("style", "background-color:rgb(224,245,224);"); } 
        
    var td1 = tr.appendChild(document.createElement('td'));
    var a1 = td1.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "glyphsLoadScriptConfig(\""+trackID+"\",\"" +script.uuid+ "\"); return false;");
    a1.innerHTML = script.name;

    tr.appendChild(new Element('td').update(encodehtml(script.description)));
  }
  
  if(scripts_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update("no scripts available"));
    tr.appendChild(new Element('td'));
  }
}


function gLyphs_configs_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  var an = String(a.name).toUpperCase();
  var bn = String(b.name).toUpperCase();
  if(an < bn) { return -1; }
  if(an > bn) { return 1; }  
  
  return 0;
}


//---------------------------------------------------------------------------
//
// new track config sources query/view/selection section
//
//---------------------------------------------------------------------------

function gLyphsTrackBuildSourcesSearchDiv(trackID) {  
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var sourceSearchDiv = document.getElementById(trackID + "_sources_search_div");
  if(sourceSearchDiv == null) { return; }
  
  //----------
  var sourceDiv = sourceSearchDiv.appendChild(document.createElement('div'));
  var labelSources = sourceDiv.appendChild(document.createElement('span'));
  labelSources.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelSources.innerHTML ="Data sources";
  
  var speciesSpan = sourceDiv.appendChild(document.createElement('span'));
  var speciesCheck = document.createElement('input');
  speciesCheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  speciesCheck.setAttribute('type', "checkbox");
  speciesCheck.setAttribute("checked", "checked");
  speciesCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'species_search', this.checked);");
  speciesSpan.appendChild(speciesCheck);
  var speciesLabel = document.createElement('span');
  speciesLabel.innerHTML = "restrict search to current species/assembly";
  speciesSpan.appendChild(speciesLabel);
  
  var span1 = sourceDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "margin-left:30px; ");
  span1.innerHTML = "data source type:"
  var sourceSelect = sourceDiv.appendChild(document.createElement('select'));
  sourceSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'source_search_mode', this.value);");
  sourceSelect.setAttribute("style", "margin-left:3px; ");

  var option;
  option = sourceSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "all");
  option.innerHTML = "all data sources";

  option = sourceSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "experiments");
  option.innerHTML = "only experiments";

  option = sourceSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "feature_sources");
  option.innerHTML = "only feature sources";

  //-
  var span1 = sourceDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "margin-left:15px;");
  current_collaboration.name = "all";
  current_collaboration.uuid = "all";
  var collabWidget = eedbCollaborationSelectWidget("filter_search");
  span1.appendChild(collabWidget);


  //----------
  var sourceSearchForm = sourceSearchDiv.appendChild(document.createElement('form'));
  sourceSearchForm.setAttribute('style', "margin-top: 5px;");
  sourceSearchForm.setAttribute("onsubmit", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'search'); return false;");

  var expSpan = sourceSearchForm.appendChild(document.createElement('span'));
  expSpan.innerHTML = "Search data sources:";
  expSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin-right:3px;");
  
  var sourceInput = sourceSearchForm.appendChild(document.createElement('input'));
  sourceInput.id = trackID + "_sources_search_inputID";
  sourceInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  sourceInput.setAttribute('size', "90");
  sourceInput.setAttribute('type', "text");

  var searchButton = sourceSearchForm.appendChild(document.createElement('input'));
  searchButton.setAttribute('style', "margin-left: 3px;");
  searchButton.setAttribute("type", "button");
  searchButton.setAttribute("value", "search");
  searchButton.setAttribute("onclick", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'search');");
  
  var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
  clearButton.setAttribute("type", "button");
  clearButton.setAttribute("value", "clear");
  clearButton.setAttribute("onclick", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'clear');");

  var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
  clearButton.setAttribute("type", "button");
  clearButton.setAttribute("value", "refresh");
  clearButton.setAttribute("onclick", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'refresh');");
  
  //-------------
  var sourceResultDiv = sourceSearchForm.appendChild(document.createElement('div'));
  sourceResultDiv.id = trackID + "_sources_search_result_div";  
  sourceResultDiv.setAttribute('style', "margin: 1px 3px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  sourceResultDiv.innerHTML = "please enter search term";  
  
  //-------------
  tdiv = sourceSearchDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top: 1px;");
  
  var outmodeSelect = createSourceOutmodeSelect(trackID);
  if(outmodeSelect) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:10px; font-size:9px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "feature mode: ";
    tdiv.appendChild(outmodeSelect);
  }
  
  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:20px; font-size:9px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "expression datatype:";
    tdiv.appendChild(datatypeSelect);
  }  
}  


function gLyphsTrackBuildSourcesInfoDiv(trackID) {  
  //for DEX-mode where we just display source information
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var sourceSearchDiv = document.getElementById(trackID + "_sources_search_div");
  if(sourceSearchDiv == null) { return; }
  
  //----------
  var fsrc_count =0;
  var exp_count = 0;
  var srcs = ""+glyphTrack.source_ids;
  var src_array = srcs.split(",");
  var src_regex = /^(.+)\:\:(\d+)\:\:\:(.+)$/;
  for(var i=0; i<src_array.length; i++) {
    var src = src_array[i];
    var mymatch = src_regex.exec(src);
    if(mymatch && (mymatch.length == 4)) {
      if(mymatch[3] == "Experiment") { exp_count++; }
      if(mymatch[3] == "FeatureSource") { fsrc_count++; }
    }
  }

  //----------
  var sourcesDiv = sourceSearchDiv.appendChild(document.createElement('div'));

  var tdiv2 = sourcesDiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var check1 = tdiv2.appendChild(document.createElement('input'));
  check1.setAttribute('style', "margin: 1px 1px 1px 10px;");
  check1.setAttribute('type', "checkbox");
  if(glyphTrack.noCache) { check1.setAttribute('checked', "checked"); }
  check1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'noCache', this.checked);");
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute("style", "color:gray;");
  span1.innerHTML = "no caching";

  var tdiv2 = sourcesDiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var check1 = tdiv2.appendChild(document.createElement('input'));
  check1.setAttribute('style', "margin: 1px 1px 1px 10px;");
  check1.setAttribute('type', "checkbox");
  if(glyphTrack.noNameSearch) { check1.setAttribute('checked', "checked"); }
  check1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'noNameSearch', this.checked);");
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute("style", "color:gray;");
  span1.innerHTML = "no name searching";


  tspan = sourcesDiv.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  tspan.innerHTML ="Data sources: ";

  //---
  tdiv = sourcesDiv.appendChild(document.createElement('div'));

  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif;");
  var src_msg = "data sources: ";
  if(fsrc_count>0) { src_msg += "feature_sources["+fsrc_count+"]  "; }
  if(exp_count>0)  { src_msg += "experiments["+exp_count+"]"; }
  tspan.innerHTML = src_msg;

  //---
  tdiv = sourcesDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top: 1px;");

  var tdiv2 = tdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var link1 = tdiv2.appendChild(document.createElement("a"));
  link1.setAttribute("href", "./#config=" +current_region.configUUID);
  link1.setAttribute("style", "color:gray;");
  link1.setAttribute("onclick", "glyphsTrackDatastreamXMLPanel(\""+ trackID+"\"); return false;");
  link1.innerHTML = "datastream xml";

  var outmodeSelect = createSourceOutmodeSelect(trackID);
  if(outmodeSelect) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:10px; font-size:9px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "feature mode: ";
    tdiv.appendChild(outmodeSelect);
  }

  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:20px; font-size:9px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "expression datatype:";
    tdiv.appendChild(datatypeSelect);
  }
}



function gLyphsTrackSearchSourcesCmd(trackID, cmd) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  var sourceResultDiv = document.getElementById(trackID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  
  var seachInput = document.getElementById(trackID + "_sources_search_inputID");
  if(seachInput == null) { return; }
  
  if(!glyphTrack.newconfig) { glyphTrack.newconfig = new Object; }
  
  if(cmd == "clear") {
    seachInput.value ="";
    glyphTrack.newconfig.sources_hash = new Object;
    gLyphsTrackShowSourcesSearch(trackID);
  }

  if(cmd == "refresh") {
    seachInput.value ="";
    gLyphsTrackSubmitSearchSources(trackID, "");    
  }
  
  if(cmd == "search") {
    var filter = "";
    if(seachInput) { filter = seachInput.value; }
    //sourceResultDiv.innerHTML = "search now with [" + filter + "]";
    if(!filter) { filter =" "; }
    gLyphsTrackSubmitSearchSources(trackID, filter);    
  }  
}


function gLyphsTrackSubmitSearchSources(trackID, filter) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
    
  var sourceResultDiv = document.getElementById(trackID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "searching data sources...";
  
  if(!glyphTrack.newconfig.sources_hash) { 
    glyphTrack.newconfig.sources_hash = new Object;
  }
  
  //clear unselected sources from hash
  var sources_hash = new Object;
  for(var srcid in glyphTrack.newconfig.sources_hash) {
    var source = glyphTrack.newconfig.sources_hash[srcid];
    if(source && source.selected) { 
      sources_hash[srcid] = source;
    }
  }
  glyphTrack.newconfig.sources_hash = sources_hash;

  //TODO: remove leading spaces for source search filter to prevent full search
  
  if(filter == "") {
    //only show the selected sources
    gLyphsTrackShowSourcesSearch(trackID);
    return;
  }
  
  var paramXML = "<zenbu_query><format>descxml</format>\n";

  if(glyphTrack.newconfig.source_search_mode == "experiments") { 
    paramXML += "<mode>experiments</mode>";
  } else if(glyphTrack.newconfig.source_search_mode == "feature_sources") { 
    paramXML += "<mode>feature_sources</mode>";
  } else {
    paramXML += "<mode>sources</mode>";
  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";

  if(glyphTrack.newconfig.species_search) { filter = filter+" "+current_region.asm }
  paramXML += "<filter>" + filter + "</filter>";

  paramXML += "</zenbu_query>\n";

  var sourcesXMLHttp=GetXmlHttpObject();
  glyphTrack.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { gLyphsTrackParseSourceSearch(id); };}(trackID);
  sourcesXMLHttp.open("POST", eedbSearchFCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);  
}


function gLyphsTrackParseSourceSearch(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var sourcesXMLHttp = glyphTrack.sourcesXMLHttp;
  if(sourcesXMLHttp == null) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  if(sourcesXMLHttp.readyState!=4) { return; }
  if(sourcesXMLHttp.status!=200) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    gLyphsTrackShowSourcesSearch(trackID);
    return;
  }
  
  var sources_hash = glyphTrack.newconfig.sources_hash;

  var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<xmlExperiments.length; i++) {
    var xmlSource = xmlExperiments[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {      
      source = new Object;
      eedbParseExperimentData(xmlSource, source);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<xmlFeatureSources.length; i++) {
    var xmlSource = xmlFeatureSources[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {      
      source = new Object;
      eedbParseFeatureSourceData(xmlSource, source);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  glyphTrack.sourcesXMLHttp = undefined;
  
  //show sources
  gLyphsTrackShowSourcesSearch(trackID);  
}


function gLyphsTrackUpdateCountsSourcesSearch(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var sources_hash = glyphTrack.newconfig.sources_hash;
  if(sources_hash == null) { return; }

  var sourceCountDiv = document.getElementById(trackID + "_sources_search_count_div");
  if(sourceCountDiv == null) { return; }
  sourceCountDiv.innerHTML = "";

  var total_count = 0;
  var select_count = 0;
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    total_count++;
    if(source.selected) { select_count++; }
  }

  if(total_count>0) {
    if(select_count == total_count) {
      sourceCountDiv.innerHTML = select_count + " data sources selected";
    } else {
      sourceCountDiv.innerHTML = "selected " + select_count + " of " +total_count+" data sources";
    }

    var a1 = sourceCountDiv.appendChild(document.createElement('a'));
    a1.setAttribute("target", "top");
    a1.setAttribute("href", "./");
    a1.setAttribute("style", "margin-left: 10px; font-size:12px;");
    a1.setAttribute("onclick", "gLyphsTrackSelectSource(\""+trackID+"\", 'all'); return false;");
    a1.innerHTML = "select all";
  }
}


function gLyphsTrackShowSourcesSearch(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var sourceResultDiv = document.getElementById(trackID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }

  if(!glyphTrack.newconfig.sources_hash) { 
    glyphTrack.newconfig.sources_hash = new Object;
  }  
  var sources_array = new Array();
  var sources_hash = glyphTrack.newconfig.sources_hash;
  
  var select_count = 0;
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) { select_count++; }
    sources_array.push(source);
  }
  sources_array.sort(gLyphs_sources_sort_func);  

  sourceResultDiv.innerHTML = "";

  //------------
  var sourceCountDiv = sourceResultDiv.appendChild(document.createElement('div'));
  sourceCountDiv.id = trackID + "_sources_search_count_div";
  gLyphsTrackUpdateCountsSourcesSearch(trackID);

  //----------
  var div1 = sourceResultDiv.appendChild(document.createElement('div'));
  div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");

  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update(''));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('source name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('source type'));
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<sources_array.length; i++) {
    var source = sources_array[i];
    
    var tr = tbody.appendChild(new Element('tr'));
    
    if(i%2 == 0) { tr.setAttribute("style", "background-color:rgb(204,230,204);"); } 
    else         { tr.setAttribute("style", "background-color:rgb(224,245,224);"); } 

    //checkbox
    var td1 = tr.appendChild(document.createElement('td'));
    var checkbox = td1.appendChild(new Element('input'));
    checkbox.setAttribute("type", "checkbox");
    if(source.selected) { checkbox.setAttribute("checked", "checked"); }
    checkbox.setAttribute("onclick", "gLyphsTrackSelectSource(\""+trackID+"\", \"" +source.id+ "\", this.checked);");
        
    //name
    var td2 = tr.appendChild(document.createElement('td'));
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "gLyphsLoadObjectInfo(\""+source.id+"\"); return false;");
    a1.innerHTML = source.name;
    
    //description
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.description;

    //class type
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.classname;
  }
  
  if(sources_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.setAttribute("style", "background-color:rgb(204,230,204);");
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("colspan", "4");
    td.innerHTML = "no data sources selected, please enter search term";
  }
}


function gLyphsTrackSelectSource(trackID, srcID, mode) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  
  if(!glyphTrack.newconfig) { return; }
  if(!glyphTrack.newconfig.sources_hash) { return; }
  
  var sources_hash = glyphTrack.newconfig.sources_hash;

  if(srcID == "all") {
    for(var srcid in sources_hash) {
      var source = sources_hash[srcid];
      if(source) { source.selected = true; }
    }
    gLyphsTrackShowSourcesSearch(trackID);
  } else { 
    var source = sources_hash[srcID];
    if(source) {
      if(mode) { source.selected = true; }
      else     { source.selected = false; }
      gLyphsTrackUpdateCountsSourcesSearch(trackID);
    }
  }

  //generate the source_id list
  if(!glyphTrack.newconfig.title) { glyphTrack.newconfig.title = ""; }
  var title = glyphTrack.newconfig.title;
  glyphTrack.newconfig.title = title.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces

  glyphTrack.newconfig.source_ids = "";
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) {
      if(glyphTrack.newconfig.source_ids) {
        glyphTrack.newconfig.source_ids += ",";
      }
      glyphTrack.newconfig.source_ids += source.id;
      if(glyphTrack.newconfig.title == "") {
        glyphTrack.newconfig.title = source.name;
      }
    }
  }
  var titleInput = document.getElementById(trackID + "_newtrack_title");
  if(titleInput) {
    titleInput.value = glyphTrack.newconfig.title;
  }

  createDatatypeSelect(trackID); //refresh
}


function gLyphs_sources_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  var an = String(a.name).toUpperCase();
  var bn = String(b.name).toUpperCase();
  if(an < bn) { return -1; }
  if(an > bn) { return 1; }  
  
  return 0;
}


//-------------------------------------------------------------
//
// new (2.5+) interface for adding predefined tracks to a view
// similar to the way UCSC and gbrowse do it in order to give 
// a familiar and simple interface for novice users.
//
//-------------------------------------------------------------

function gLyphsPredefinedTracksPanel() {
  var genome_region_div = document.getElementById("genome_region_div");
  if(genome_region_div === undefined) { return; }
  
  var predef_track_div = document.getElementById("glyphs_predef_track_panel");
  if(predef_track_div) { return; }  //already visible
   
  current_collaboration.callOutFunction = function() { gLyphsReloadPredefinedTracks(); }
  current_collaboration.name = "all";
  current_collaboration.uuid = "all";

  var e = window.event
  moveToMouseLoc(e);
  var top_pos = toolTipSTYLE.ypos-400;
  if(top_pos< 180) { top_pos=180;}
  
  predef_track_div = genome_region_div.appendChild(document.createElement('div'));
  predef_track_div.id = "glyphs_predef_track_panel";
  predef_track_div.setAttribute('style', "position:absolute; background-color:#f0f0f7; text-align:left; "+
                                "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                                "z-index:1; width:800px; height:400px; "+
                                "left:" + ((winW/2)-400) +"px; "+
                                "top:" + top_pos +"px; "
                               );
  predef_track_div.innerHTML = "";
  
  // title
  var div1 = predef_track_div.appendChild(document.createElement('div'));
  div1.setAttribute("style", "font-weight:bold; font-size:16px; margin-top:5px; ");
  div1.innerHTML = "Add predefined tracks to view";
  
  // close button
  var a1 = div1.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "gLyphsClosePredefinedTracksPanel();return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");
  
  
  //search interface to allow filtering of predefined tracks
  var predefSearchForm = predef_track_div.appendChild(document.createElement('form'));
  predefSearchForm.setAttribute('style', "margin-top: 5px;");
  predefSearchForm.setAttribute("onsubmit", "gLyphsSearchPredefTracks('search'); return false;");
  
  var searchTable = predefSearchForm.appendChild(document.createElement('table'));
  var tr1 = searchTable.appendChild(document.createElement('tr'));

  var td1 = tr1.appendChild(document.createElement('td'));
  var span1 = td1.appendChild(document.createElement('span'));
  span1.innerHTML = "Search tracks:";
  span1.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  
  td1 = tr1.appendChild(document.createElement('td'));
  var sourceInput = td1.appendChild(document.createElement('input'));
  sourceInput.id = "glyphs_predef_track_search_inputID";
  sourceInput.setAttribute('style', "margin: 1px 3px 3px 3px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  sourceInput.setAttribute('size', "40");
  sourceInput.setAttribute('type', "text");
  
  td1 = tr1.appendChild(document.createElement('td'));
  var searchButton = td1.appendChild(document.createElement('input'));
  searchButton.setAttribute("type", "button");
  searchButton.setAttribute("value", "search");
  searchButton.setAttribute("onclick", "gLyphsSearchPredefTracks('search');");
  
  td1 = tr1.appendChild(document.createElement('td'));
  var clearButton = td1.appendChild(document.createElement('input'));
  clearButton.setAttribute("type", "button");
  clearButton.setAttribute("value", "clear");
  clearButton.setAttribute("onclick", "gLyphsSearchPredefTracks('clear');");
    
  td1 = tr1.appendChild(document.createElement('td'));
  var collabWidget = eedbCollaborationSelectWidget("config_search");
  td1.appendChild(collabWidget);
    
  
  //predef track search results table
  var tracksDiv = predef_track_div.appendChild(document.createElement('div'));
  tracksDiv.id = "glyphs_predef_track_search_div";
  //tracksDiv.setAttribute('style', "margin: 5px 5px 5px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; \
  //                       border:1px black solid; background-color:snow; overflow:auto; width:790px; height:300px;");
  //tracksDiv.innerHTML = "loading predefined tracks list...";  
  
  
  var button = predef_track_div.appendChild(document.createElement('input'));
  button.setAttribute("type", "button");
  button.setAttribute("style", "width:200px;");
  button.setAttribute("value", "add tracks");
  button.setAttribute("onclick", "gLyphsAddSelectedPredefinedTracks();");

  //query for all tracks and display
  gLyphsShowPredefTracks();
  gLyphsReloadPredefinedTracks();

  sourceInput.focus();
}


function gLyphsClosePredefinedTracksPanel() {
  var genome_region_div = document.getElementById("genome_region_div");
  if(!genome_region_div) { return; }
  var predef_track_div = document.getElementById("glyphs_predef_track_panel");
  if(!predef_track_div) { return; }
  
  genome_region_div.removeChild(predef_track_div);
  
  current_region.predef_tracks_array = null;
  current_region.predef_tracks_hash  = null;
}


function gLyphsSearchPredefTracks(cmd) {
  var tracksDiv = document.getElementById("glyphs_predef_track_search_div");
  if(tracksDiv == null) { return; }
  
  var seachInput = document.getElementById("glyphs_predef_track_search_inputID");
  if(cmd == "clear" && seachInput) { seachInput.value =""; }
  
  gLyphsReloadPredefinedTracks();
}


function gLyphsReloadPredefinedTracks() {
  var tracksDiv = document.getElementById("glyphs_predef_track_search_div");
  if(tracksDiv == null) { return; }

  current_region.predef_tracks_array = null;
  current_region.predef_tracks_hash  = null;

  gLyphsShowPredefTracks(); //shows the loading message

  var seachInput = document.getElementById("glyphs_predef_track_search_inputID");
  var filter = "";
  if(seachInput) { filter = seachInput.value; }

  var paramXML = "<zenbu_query><format>simplexml</format><mode>search</mode>";
  paramXML += "<configtype>track</configtype>";
  paramXML += "<sort>create_date</sort><sort_order>desc</sort_order>";
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "<filter>"
  if(current_region.asm) { paramXML += current_region.asm + " "; }
  if(filter != "") { paramXML += filter; }
  paramXML += "</filter>"
  paramXML += "</zenbu_query>";

  var predefTracksXMLHttp=GetXmlHttpObject();
  if(predefTracksXMLHttp==null) { return; }
  current_region.predef_XHR = predefTracksXMLHttp;

  predefTracksXMLHttp.open("POST", eedbConfigCGI, true);  //async
  predefTracksXMLHttp.onreadystatechange= gLyphsParsePredefinedTracksResponse;
  predefTracksXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  predefTracksXMLHttp.send(paramXML);
}


function gLyphsParsePredefinedTracksResponse() {
  var predefTracksXMLHttp = current_region.predef_XHR;
  if(!predefTracksXMLHttp) return;
  if(predefTracksXMLHttp.responseXML == null) return;
  if(predefTracksXMLHttp.readyState!=4) return;
  if(predefTracksXMLHttp.status!=200) { return; }
  if(predefTracksXMLHttp.responseXML == null) return;
  
  var xmlDoc=predefTracksXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }

  //clear old list of predef tracks
  current_region.predef_tracks_array = new Array();   
  current_region.predef_tracks_hash  = new Object;
  
  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");
    if(!uuid) { continue; }
    
    var config = current_region.predef_tracks_hash[uuid];
    if(!config) {
      var config = new Object;
      config.uuid = uuid;
      config.selected = false;
      current_region.predef_tracks_hash[uuid] = config;
    }
    eedbParseConfigurationData(xmlConfig, config);
    current_region.predef_tracks_array.push(config);
  }  

  current_region.predef_XHR = null;
  gLyphsShowPredefTracks();
}


function gLyphsShowPredefTracks() {
  var tracksDiv = document.getElementById("glyphs_predef_track_search_div");
  if(tracksDiv == null) { return; }
  tracksDiv.innerHTML = "";
  
  tracks_array = current_region.predef_tracks_array;
  if(!tracks_array) { 
    tracksDiv.setAttribute('style', "margin: 5px 5px 5px 5px; font-size:14px; font-family:arial,helvetica,sans-serif; \
                            padding: 10px 10px 10px 10px; \
                            border:1px black solid; background-color:snow; overflow:auto; width:790px; height:300px;");
    tracksDiv.innerHTML = "loading predefined tracks list...";  
    return; 
  }
  tracksDiv.setAttribute('style', "margin: 5px 5px 5px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; \
                         border:1px black solid; background-color:snow; overflow:auto; width:790px; height:300px;");
  
  // display as table
  var my_table = tracksDiv.appendChild(document.createElement("table"));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('add'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('track name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('create date'));
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<tracks_array.length; i++) {
    var config = tracks_array[i];
    
    var tr = tbody.appendChild(new Element('tr'));
    
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    var td1 = tr.appendChild(document.createElement('td'));
    var checkbox = td1.appendChild(new Element('input'));
    checkbox.setAttribute("type", "checkbox");
    if(config.selected) { checkbox.setAttribute("checked", "checked"); }
    //checkbox.setAttribute("style", "background-color:BurlyWood; margin:0px 3px 0px 3px; font-size:10px;");
    checkbox.setAttribute("onclick", "gLyphsSelectPredefinedTrack(\"" +config.uuid+ "\", this.checked);");
    
    td1 = tr.appendChild(document.createElement('td'));
    var a1 = td1.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    var cfgID = config.uuid + ":::Config";
    a1.setAttribute("onclick", "gLyphsLoadObjectInfo(\"" +cfgID+ "\"); return false;");
    a1.innerHTML = config.name;
    
    tr.appendChild(new Element('td').update(encodehtml(config.description)));
    
    //create data/owner cell
    var td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(config.author) { 
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = config.author;
    }
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = config.create_date;
    
  }
  
  if(tracks_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td').update("no predefined tracks found"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }
}


function gLyphsSelectPredefinedTrack(uuid, state) {
  var config = current_region.predef_tracks_hash[uuid];
  if(!config) { return; }
  if(state) { config.selected = true; } 
  else { config.selected = false; }
}


function gLyphsAddSelectedPredefinedTracks() {
  tracks_hash = current_region.predef_tracks_hash;
  if(!tracks_hash) {
    gLyphsClosePredefinedTracksPanel();
    return; 
  }

  for(var uuid in tracks_hash) {
    var config = tracks_hash[uuid];
    if(config && config.selected) { gLyphsLoadTrackConfigUUID(uuid); }
  }  
  gLyphsAutosaveConfig();
  gLyphsClosePredefinedTracksPanel();
}



//-------------------------------------------------------------
//
// new (2.5+) interface for editing/adding sources to a track
// based on the new predefined track code.
// can eventually be used for creating new tracks
//
//-------------------------------------------------------------
  
function gLyphsTrackEditSources(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
  
  var e = window.event
  moveToMouseLoc(e);
  var top_pos = toolTipSTYLE.ypos-400;
  if(top_pos< 180) { top_pos=180;}
  
  var editSrcDiv = document.getElementById(trackID + "_edit_sources_div");
  if(editSrcDiv == null) {   
    editSrcDiv = trackDiv.appendChild(document.createElement('div'));
    editSrcDiv.id = trackID+"_edit_sources_div";
    editSrcDiv.setAttribute('style', "position:absolute; background-color:PaleGreen; text-align:left; "
                             +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                             +"font-size:10px; font-family:arial,helvetica,sans-serif; "
                             +"left:"+(toolTipSTYLE.xpos-500)+"px;"
                             +"top:" + toolTipSTYLE.ypos +"px; "
                             +"width:450px; height:250px;"
                            );    
  }  
  editSrcDiv.innerHTML = "";
  
  var tdiv, tspan, tlabel;
  
  // title
  var div1 = editSrcDiv.appendChild(document.createElement('div'));
  div1.setAttribute("style", "font-weight:bold; font-size:12px; margin-top:5px; ");
  div1.innerHTML = "Edit track data sources:";
  
  // close button
  var a1 = div1.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsCloseTrackEditSourcesPanel(\""+trackID+"\");return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
    
  //predef track search results table
  var srcTableDiv = editSrcDiv.appendChild(document.createElement('div'));
  srcTableDiv.id = "glyphs_predef_track_search_div";
  srcTableDiv.id = trackID+"_editsrc_table_div";
  srcTableDiv.setAttribute('style', "margin: 5px 5px 5px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; \
                         border:1px black solid; background-color:snow; overflow:auto; width:440px; height:200px;");
  //srcTableDiv.innerHTML = "loading track sources info...";  
  
  
  /*
   //search interface to allow filtering of predefined tracks
   var predefSearchForm = editSrcDiv.appendChild(document.createElement('form'));
   predefSearchForm.setAttribute('style', "margin-top: 5px;");
   predefSearchForm.setAttribute("onsubmit", "gLyphsSearchPredefTracks('search');");
   
   var searchTable = predefSearchForm.appendChild(document.createElement('table'));
   var tr1 = searchTable.appendChild(document.createElement('tr'));
   
   var td1 = tr1.appendChild(document.createElement('td'));
   var span1 = td1.appendChild(document.createElement('span'));
   span1.innerHTML = "Search tracks:";
   span1.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
   
   td1 = tr1.appendChild(document.createElement('td'));
   var sourceInput = td1.appendChild(document.createElement('input'));
   sourceInput.id = "glyphs_predef_track_search_inputID";
   sourceInput.setAttribute('style', "margin: 1px 3px 3px 3px; font-size:12px; font-family:arial,helvetica,sans-serif;");
   sourceInput.setAttribute('size', "40");
   sourceInput.setAttribute('type', "text");
   
   td1 = tr1.appendChild(document.createElement('td'));
   var searchButton = td1.appendChild(document.createElement('input'));
   searchButton.setAttribute("type", "button");
   searchButton.setAttribute("value", "search");
   searchButton.setAttribute("onclick", "gLyphsSearchPredefTracks('search');");
   
   td1 = tr1.appendChild(document.createElement('td'));
   var clearButton = td1.appendChild(document.createElement('input'));
   clearButton.setAttribute("type", "button");
   clearButton.setAttribute("value", "clear");
   clearButton.setAttribute("onclick", "gLyphsSearchPredefTracks('clear');");
   
   td1 = tr1.appendChild(document.createElement('td'));
   var collabWidget = eedbCollaborationSelectWidget("filter_search");
   td1.appendChild(collabWidget);
   */
  
  //query current source_ids for security and information
  gLyphsTrackReloadSourceEditPanel(trackID);
}


function gLyphsCloseTrackEditSourcesPanel(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var editSrcDiv = document.getElementById(trackID + "_edit_sources_div");
  if(!editSrcDiv) { return; }
  
  trackDiv.removeChild(editSrcDiv);
}


function gLyphsTrackReloadSourceEditPanel(trackID) {
  gLyphsTrackFetchSourcesInfo(trackID);
  gLyphsTrackShowEditSources(trackID);
}


function gLyphsTrackFetchSourcesInfo(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
    
  var srcTableDiv = document.getElementById(trackID + "_editsrc_table_div");
  if(srcTableDiv) {
    srcTableDiv.innerHTML = "loading track sources info...";
  }

  if(!glyphTrack.sources_hash) { glyphTrack.sources_hash = new Object(); }  
  
  var load_source_ids = "";
  var source_ids = glyphTrack.source_ids;
  var ids = source_ids.split(/[\s\,]/);
  for(var i=0; i<ids.length; i++) {
    var srcID = ids[i];
    if(!srcID) { continue; }
    var source = glyphTrack.sources_hash[srcID];
    if(!source) {
      var source = new Object;
      source.uuid = srcID;
      source.selected = false;
      glyphTrack.sources_hash[srcID] = source;
    }
    if(!source.name) {
      if(load_source_ids) { load_source_ids += ","; }
      load_source_ids += srcID;
    }
  }
  if(!load_source_ids) { return; }
  
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>sources</mode><format>descxml</format><collab>all</collab>\n";
  paramXML += "<source_ids>"+ load_source_ids +"</source_ids>\n"; 
  paramXML += "</zenbu_query>\n";
  
  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbSearchCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  if(xhr.responseXML == null) return;
  if(xhr.readyState!=4) return;
  if(xhr.status!=200) { return; }
  if(xhr.responseXML == null) return;
  
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
  
  var experiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<experiments.length; i++) {
    var sourceDOM = experiments[i];
    var srcID = sourceDOM.getAttribute("id");
    if(!srcID) { continue; }
    
    var source = glyphTrack.sources_hash[srcID];
    if(!source) {
      var source = new Object;
      source.uuid = srcID;
      glyphTrack.sources_hash[srcID] = source;
    }
    source.selected = true;
    eedbParseExperimentData(sourceDOM, source);
  }    

  var featuresources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<featuresources.length; i++) {
    var sourceDOM = featuresources[i];
    var srcID = sourceDOM.getAttribute("id");
    if(!srcID) { continue; }
    
    var source = glyphTrack.sources_hash[srcID];
    if(!source) {
      var source = new Object;
      source.uuid = srcID;
      glyphTrack.sources_hash[srcID] = source;
    }
    source.selected = true;
    eedbParseFeatureSourceData(sourceDOM, source);
  }
}


function gLyphsTrackShowEditSources(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
  
  var srcTableDiv = document.getElementById(trackID + "_editsrc_table_div");
  if(!srcTableDiv) { return; }

  sources_array = new Array;
  for(var srcID in glyphTrack.sources_hash) {
    var source = glyphTrack.sources_hash[srcID];
    sources_array.push(source);
  }  
  sources_array.sort(gLyphs_configs_sort_func);  
  
  srcTableDiv.innerHTML = "";  

  // display as table
  var my_table = srcTableDiv.appendChild(document.createElement("table"));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('selected'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('source name'));
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<sources_array.length; i++) {
    var source = sources_array[i];
    
    var tr = tbody.appendChild(new Element('tr'));
    
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 
    
    var td1 = tr.appendChild(document.createElement('td'));
    var checkbox = td1.appendChild(new Element('input'));
    checkbox.setAttribute("type", "checkbox");
    if(source.selected) { checkbox.setAttribute("checked", "checked"); }
    //checkbox.setAttribute("style", "background-color:BurlyWood; margin:0px 3px 0px 3px; font-size:10px;");
    //checkbox.setAttribute("onclick", "gLyphsSelectPredefinedTrack(\"" +source.uuid+ "\", this.checked);");
    
    td1 = tr.appendChild(document.createElement('td'));
    var a1 = td1.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "gLyphsLoadObjectInfo(\"" +source.id+ "\"); return false;");
    a1.innerHTML = source.name;
    
    //tr.appendChild(new Element('td').update(encodehtml(source.description)));
     
    /*
    //create data/owner cell
    var td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(source.author) { 
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = source.author;
    }
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = source.create_date;
     */
    
  }
  
  if(sources_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td').update("no predefined tracks found"));
  }
}


/*
function gLyphsSelectPredefinedTrack(uuid, state) {
  var config = current_region.predef_tracks_hash[uuid];
  if(!config) { return; }
  if(state) { config.selected = true; } 
  else { config.selected = false; }
}


function gLyphsAddSelectedPredefinedTracks() {
  tracks_hash = current_region.predef_tracks_hash;
  if(!tracks_hash) {
    gLyphsClosePredefinedTracksPanel();
    return; 
  }
  
  for(var uuid in tracks_hash) {
    var config = tracks_hash[uuid];
    if(config && config.selected) { gLyphsLoadTrackConfigUUID(uuid); }
  }  
  gLyphsAutosaveConfig();
  gLyphsClosePredefinedTracksPanel();
}

*/

