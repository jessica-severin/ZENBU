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

var zenbu_embedded_view = false;
var current_region = new Object();
/*
var current_region = new Object();
current_region.display_width = Math.floor(800);
current_region.asm = "hg18";
current_region.configname = "welcome to eeDB gLyphs";
current_region.desc = "";
current_region.exppanel_active_on_top = false;
current_region.express_sort_mode = 'name';
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
current_region.selected_feature = undefined;
*/

function gLyphsInit() {
  if(!browserCompatibilityCheck()) {
    window.location ="../browser_upgrade.html";
  }
  //zenbuGeneralWarn("Due to server room power maintenance at the RIKEN Yokohama campus, all ZENBU webservers will be shutdown from Aug 17 17:00 JST to Aug 21 20:00 JST.<br>"+
  //                 "We appologize for the inconvenience to ZENBU users, but we will restore services as soon as possible.");

  eedbShowLogin();
  //if(current_user && !current_user.email) { return; }

  // reset global current_collaboration
  current_collaboration.name = "private";
  current_collaboration.uuid = "private";
  current_collaboration.callOutFunction = null;

  //gLyphsInitColorSpaces();
  zenbuInitColorSpaces();

  //document.getElementById("message").innerHTML = "gLyphsInit: ";
  jscolor.init();

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var main_div = document.getElementById("genome_region_div");  //TODO: need to change this to dynamic eventually
  if(!main_div) { return; }

  current_region = new ZenbuGenomeBrowser(main_div);
  /*
  if(!current_region) {
    current_region = new Object();
    current_region.display_width = Math.floor(800);
    current_region.asm = "hg18";
    current_region.configname = "welcome to eeDB gLyphs";
    current_region.desc = "";
    current_region.exppanel_active_on_top = false;
    current_region.express_sort_mode = 'name';
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
  }

  var main_div = document.getElementById("genome_region_div");  //TODO: need to change this to dynamic eventually
  if(!main_div) { return; }
  current_region.main_div = main_div;
  main_div.innerHTML="";
  current_region.gLyphTrackSet = main_div.appendChild(document.createElement('div'));
  current_region.expPanelFrame = main_div.appendChild(document.createElement('div'));

  gLyphsSearchInterface(current_region);

  current_region.tracks_hash = new Object();

  current_region.uuid = zenbuGenerateUUID();
  console.log("glyphsGB.uuid generate = "+current_region.uuid);
  
  var dwidth = Math.floor(gLyphsInitParams.display_width);
  if(!dwidth) { dwidth = Math.floor(800); }
  gLyphsInitParams.display_width = dwidth;
  current_region.display_width = dwidth;
  current_region.gLyphTrackSet.setAttribute("style", 'width: '+ (dwidth+10)+'px;');
  */
  
  var feature_info = document.getElementById("feature_info");
  if(feature_info) {
    feature_info.locationCallOutFunction = function(chromloc) {
      console.log("feature_info.locationCallOutFunction with "+chromloc);
      gLyphsLoadLocation(current_region, chromloc);
    }
  }

  if(parseConfigFromURL(window.location.href)) {
    gLyphsReloadRegion(current_region);
    gLyphsChangeDhtmlHistoryLocation();
  } else {
    if(gLyphsInitParams.uuid !== undefined) { 
      gLyphsInitViewConfigUUID(gLyphsInitParams.uuid); 
      if(gLyphsInitParams.loc) { gLyphsInitLocation(current_region, gLyphsInitParams.loc); }
      if(gLyphsInitParams.display_width) { current_region.display_width = gLyphsInitParams.display_width; }
      gLyphsReloadRegion(current_region);
    } else {
      //gLyphsTracksInit(current_region); //old system which init from html div definitions
    }
    gLyphsChangeDhtmlHistoryLocation();
  }

  current_region.first_init = true;
  window.addEventListener("hashchange", gLyphsHandleHistoryChange, false);
  current_region.first_init = false;

  if(current_region.active_track_exp_filter) { 
    var activeTrack = glyphsTrack_global_track_hash[current_region.active_trackID];
    gLyphsSubmitExpExpressFilterSearch(activeTrack);
  }

  if(current_region.init_search_term) {
    eedbSetSearchInput(current_region.searchSetID, current_region.init_search_term);
    var e = new Object;
    e.type = "click"; //fake a click event
    e.keyCode = 13;
    glyphsMainSearchInput(current_region.searchSetID, "",e);
    current_region.init_search_term = undefined;
  }
}


function gLyphsChangeDhtmlHistoryLocation() {
  if(zenbu_embedded_view) { return; }
  var chromloc = current_region.regionLocation();
  var newurl = "#config="+current_region.configUUID +";loc="+chromloc
  if(current_region.active_track_exp_filter) {
    newurl +=";active_track_exp_filter="+current_region.active_track_exp_filter;
  }
  if(current_region.highlight_search) {
    newurl +=";highlight_search="+current_region.highlight_search;
  }
  console.log("gLyphsChangeDhtmlHistoryLocation url:"+newurl);
  window.history.pushState({}, "", newurl);
}

 
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

  for(var trackID in current_region.tracks_hash){
    var glyphTrack = current_region.tracks_hash[trackID];
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
  for(var trackID in current_region.tracks_hash){
    var glyphTrack = current_region.tracks_hash[trackID];
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
  gLyphsDrawExpressionPanel(current_region);
}
*/


//---------------------------------------------
//
// and XHR to get the feature DOM data
//
//---------------------------------------------
/*
function gLyphsLoadObjectInfo(id) {
  if(current_region.selected_feature && (current_region.selected_feature.id == id)) {
    gLyphsDisplayFeatureInfo(current_region.selected_feature);
    return false;
  }

  var object = eedbGetObject(id);
  if(!object) { return false; }

  if(object.classname == "Feature") {
    gLyphsProcessFeatureSelect(current_region, object);
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
*/

/*
function gLyphsShowConfigDetailPanel(fid) {  
  var object = eedbGetObject(fid);
  if(!object) { return false; }  
  eedbDisplaySourceInfo(object);
}
*/

/*
function gLyphsLoadSearchView(searchID, uuid, state) {
  //document.getElementById("message").innerHTML = "load view[" +uuid+"]";
  gLyphsInitViewConfigUUID(uuid);
  gLyphsChangeDhtmlHistoryLocation();
  gLyphsReloadRegion(current_region);
}
*/

//--------------------------------------------------------
//
//
//       EEDB gLyphs genomic visualization toolkit
//
//
//--------------------------------------------------------

/*
function gLyphsTracksInit() {
  //old deprecated code which would initialization a view based on html definition of divs with class "gLyphTrack"
  //leave here for historical purposes. Was used initially to boot-strap the first version of zenbu

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var titlediv = document.getElementById("gLyphs_title");
  if(titlediv) { titlediv.innerHTML = encodehtml(current_region.configname); }

  if(!current_region.gLyphTrackSet) { return; }
  var glyphset = current_region.gLyphTrackSet;
  //glyphset can contain init configuartion information

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
    glyphTrack.exp_filter_incl_matching = false;
    glyphTrack.exp_matching_mdkey = "";
    glyphTrack.exp_matching_post_filter = "";
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
    glyphTrack.hide_zero = false;
    glyphTrack.hide_deactive_exps = false;
    glyphTrack.active_on_top = false;
    glyphTrack.express_sort_mode = "name";
    glyphTrack.express_sort_reverse = false;
    glyphTrack.overlap_mode = "5end";
    glyphTrack.binning    = "sum";
    glyphTrack.experiment_merge = "mean";
    glyphTrack.strandless = false;
    glyphTrack.has_expression  = false;
    glyphTrack.has_subfeatures = false;
    glyphTrack.source_outmode = "full_feature";
    glyphTrack.exprbin_strandless = false;
    glyphTrack.exprbin_add_count = false;
    glyphTrack.exprbin_subfeatures = false;
    glyphTrack.exprbin_binsize = "";
    glyphTrack.whole_chrom_scale = false;

    glyphsTrack_global_track_hash[trackID] = glyphTrack;
    gLyphsDrawTrack(trackID);
  }

  createAddTrackTool();

  //
  // first get defaults from the XHTML document
  //
  var loc = glyphset.getAttribute("loc");
  var fid = glyphset.getAttribute("feature");

  gLyphsReloadRegion(current_region);
}
*/

function parseConfigFromURL(urlConfig) {
  //this function takes URL address, parses for configuration UUID and
  //location, and then reconfigures the view.  But it does not execute a reload/redraw

  if(!urlConfig && zenbu_embedded_view) { return; }
  console.log("parseConfigFromURL ["+urlConfig+"]")

  //document.getElementById("message").innerHTML += "parseConfigFromURL [" + urlConfig +"]";
  if(!urlConfig) { return gLyphsLastSessionConfig(); }

  //reset some variables
  if(current_region) {
    current_region.highlight_search = "";
    current_region.init_search_term = "";
    current_region.active_track_exp_filter = "";
  }
  //console.log("window.location.href: "+window.location.href);
  //console.log("window.location.hostname: "+window.location.hostname);
  //console.log("window.location.pathname: "+window.location.pathname);
  //console.log("window.location.protocol: "+window.location.protocol);
  //console.log("window.location.port: "+window.location.port);
  
  var p1 = urlConfig.indexOf(window.location.pathname);
  if(p1>=0) {
    var p2 = p1 + window.location.pathname.length;
    //console.log("found pathname at "+p1+".."+p2);
    var url_params = urlConfig.substring(p2);
    //console.log("new url_params "+ url_params);
    urlConfig = url_params;
  }
  if(urlConfig.charAt(0) == "#") {
    //console.log("remove leading #");
    urlConfig = urlConfig.substring(1);
  }

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
      gLyphsInitLocation(current_region, tagvalue[1]);
    }
    if(tagvalue[0] == "search") {
      current_region.init_search_term = tagvalue[1];
    }
    if(tagvalue[0] == "dwidth") {
      var dwidth = Math.floor(tagvalue[1]); 
      if(dwidth && !isNaN(dwidth)) { current_region.display_width = dwidth; }
    }
    if(tagvalue[0] == "active_track_exp_filter") {
      current_region.active_track_exp_filter =  decodeURI(tagvalue[1]);
      console.log("active_track_exp_filter [" + current_region.active_track_exp_filter + "]");
      if(current_region.active_track_exp_filter && current_region.active_trackID) {
        glyphTrack = glyphsTrack_global_track_hash[current_region.active_trackID];
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

function gLyphsHandleHistoryChange() {
  if(zenbu_embedded_view) { return; }
  if(current_region.first_init) {
    current_region.first_init = false;
    return;
  }
  //document.getElementById("message").innerHTML += " gLyphsHandleHistoryChange["+window.location.href+"]";
  eedbEmptySearchResults(current_region.searchSetID);
  if(parseConfigFromURL(window.location.href)) { 
    gLyphsReloadRegion(current_region); 
    if(current_region.active_track_exp_filter) { 
      var activeTrack = glyphsTrack_global_track_hash[current_region.active_trackID];
      gLyphsSubmitExpExpressFilterSearch(activeTrack);
    }
    if(current_region.init_search_term) {
      eedbSetSearchInput(current_region.searchSetID, current_region.init_search_term);
      var e = new Object;
      e.type = "click"; //fake a click event
      e.keyCode = 13;
      glyphsMainSearchInput(current_region.searchSetID, "",e);
      current_region.init_search_term = undefined;
    }
  }
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
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
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
  var main_div = document.getElementById("message");
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
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
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
  
  eedbShowLogin();
  if(!current_user) {
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
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
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
  if(current_user) { 
    if(current_user.nickname) { name_span.innerHTML = current_user.nickname; }
    else { name_span.innerHTML = current_user.openID; }
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
  button1.className = "medbutton";
  button1.style.float = "left";
  button1.setAttribute("onclick", "gLyphsSaveConfigParam('cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save view");
  button2.className = "medbutton";
  button2.style.float = "right";
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

  //var config = doc.createElement("eeDBgLyphsConfig");
  var config = gLyphsGB_configDOM(current_region);
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
  if(current_user) { 
    summary.setAttribute("user", current_user.nickname); 
    summary.setAttribute("creator_openID", current_user.openID); 
  }
  if(saveconfig.desc) { summary.setAttribute("desc", saveconfig.desc); }
  config.appendChild(summary);

  /*
  var loc = doc.createElement("region");
  loc.setAttribute("asm",    current_region.asm);
  loc.setAttribute("chrom",  current_region.chrom);
  loc.setAttribute("start",  current_region.start);
  loc.setAttribute("end",    current_region.end);
  config.appendChild(loc);

  var settings = doc.createElement("settings");
  settings.setAttribute("dwidth", current_region.display_width);
  if(current_region.hide_compacted_tracks) { settings.setAttribute("hide_compacted", "true"); }
  if(!current_region.share_exp_panel) { settings.setAttribute("share_exp_panel", "false"); }
  if(current_region.exppanel_subscroll) { settings.setAttribute("exppanel_subscroll", "true"); }
  if(current_region.flip_orientation) { settings.setAttribute("flip_orientation", "true"); }
  if(current_region.nocache) { settings.setAttribute("global_nocache", "true"); }
  config.appendChild(settings);

  if(current_region.selected_feature) { 
    var feat = doc.createElement("feature");
    //if(current_region.selected_feature.getAttribute("peer")) {
    //  feat.setAttribute("peer", current_region.selected_feature.getAttribute("peer"));
    //}
    feat.setAttribute("id",   current_region.selected_feature.id);
    feat.setAttribute("name", current_region.selected_feature.name);
    config.appendChild(feat);
  }  

  var tracks = doc.createElement("gLyphTracks");
  tracks.setAttribute("next_trackID", newTrackID);
  config.appendChild(tracks);

  var glyphset = current_region.gLyphTrackSet;
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = current_region.tracks_hash[trackID];
    if(!glyphTrack) { continue; }
    
    var trackDOM = glyphsGenerateTrackDOM(glyphTrack);
    tracks.appendChild(trackDOM);
  }
  */
  
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
    gLyphsChangeDhtmlHistoryLocation();

    current_region.desc           = current_region.saveconfig.desc;
    current_region.configname     = current_region.saveconfig.name;
    current_region.config_creator = "guest";
    if(current_user) { 
      if(current_user.nickname) { current_region.config_creator = current_user.nickname; }
      if(current_user.openID)   { current_region.config_creator = current_user.openID; }
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
  var button = titlediv.appendChild(document.createElement("input"));
  button.setAttribute("type", "button");
  button.className = "medbutton";
  button.style.marginLeft = "15px";
  button.setAttribute("onclick", "gLyphsSaveConfig();");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"save view configuration\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.innerHTML = "save view";
  button.setAttribute("value", "save view");


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




