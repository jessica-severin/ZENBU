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
var newTrackID = 100;
var current_dragTrack;
var current_resizeTrack;
var currentSelectTrackID;
var maxActiveTrackXHRs = 7;
var colorSpaces = new Object();

var glyphsTrack_global_track_hash = new Object();
var active_track_XHRs = new Object();
var pending_track_XHRs = new Object();
var gLyphsSourceCache = new Object();


function ZenbuGlyphsTrack(glyphsGB, trackID) {
  if(!trackID) { trackID = "glyphTrack" + (newTrackID++); }

  this.element_type = "glyphsTrack";
  this.trackID = trackID;
  this.elementID = trackID;
  this.datasource_mode = "feature";
  this.glyphsGB  = glyphsGB;
  this.expPanelActive = false;
  this.hideTrack  = 0;
  this.title      = "";
  this.description = "";
  this.display_width = 800;
  this.default_exptype = "raw";
  this.exptype    = "";
  this.datatype   = "";
  this.expfilter  = "";
  this.exp_filter_incl_matching = false;
  this.exp_matching_mdkey = "";
  this.exp_matching_post_filter = "";
  this.exppanelmode = "experiments";
  this.exppanel_use_rgbcolor = false;
  this.mdgroupkey   = "";
  this.exp_name_mdkeys = "";
  this.errorbar_type  = "stddev";
  this.logscale   = 0;
  this.noCache    = false;
  this.noNameSearch = true;
  this.colorMode = "strand";
  this.featureSortMode = "position";
  this.color_mdkey = "bed:itemRgb";
  this.signal_user_color = "#0000FF";
  this.scale_invert = false;
  this.backColor  = "#F6F6F6";
  this.posStrandColor  = "#008000";
  this.revStrandColor  = "#800080";
  this.posTextColor    = "black";
  this.revTextColor    = "black";
  this.source_outmode  = "full_feature";
  this.strandless = false;
  this.overlap_mode    = "5end";
  this.binning    = "sum";
  this.experiment_merge = "mean";
  this.maxlevels  = 0;
  this.track_height  = 100;
  this.scale_max_signal = "auto";
  this.scale_min_signal = "auto";
  this.exp_mincut = 0.0;
  this.spstream_mode = "none";
  this.exprbin_strandless = false;
  this.exprbin_add_count = false;
  this.exprbin_subfeatures = false;
  this.exprbin_flipstrand = false;
  this.exprbin_binsize = "";
  this.createMode  = "single";
  this.whole_chrom_scale  = false;
  this.xyplot_fill = false;
  
  this.active_on_top = false;
  this.express_sort_mode = "name";
  this.express_sort_reverse = false;
  this.hide_zero = false;
  this.hide_deactive_exps = false;
  this.active_on_top = false;
  this.ranksum_display = "";
  this.ranksum_mdkeys = "";
  this.ranksum_min_zscore = "";

  this.sources     = "";
  this.source_ids  = "";
  this.peerName    = "";
  this.glyphStyle  = "thick-arrow";
  this.uuid        = "";
  this.hashkey     = "";
  this.has_expression  = false;
  this.has_subfeatures = false;
  this.selected_feature = null;
  this.search_select_filter = "";
  
  var trackDiv = document.createElement('div');
  trackDiv.setAttribute("align","left");
  trackDiv.setAttribute("style", "background-color: transparent; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  trackDiv.id = trackID;
  trackDiv.setAttribute("class","gLyphTrack");
  this.trackDiv   = trackDiv;

  //this.trackDiv   = trackDiv;
  //this.hideTrack  = !!trackDOM.getAttribute("hide"); //forces it into a boolean
  //this.title      = trackDOM.getAttribute("title");
  //this.glyphStyle = trackDOM.getAttribute("glyphStyle");
  //this.noNameSearch = false;
  //this.source_outmode  = "";
  
  this.feature_array = [];
  this.edge_array = [];
  this.experiments = new Object();
  this.datasources = new Object();
  this.datatypes = new Object();
  this.experiment_array = new Array();

  //class functions
  this.displayWidth = gLyphsTrack_displayWidth;
  this.expPanelFrame = gLyphsTrack_expPanelFrame;
  
  //link into global cache and into GB
  glyphsTrack_global_track_hash[this.trackID] = this;
  glyphsGB.tracks_hash[this.trackID] = this;

  glyphTrackAddDatatypeColumn(this, "name", "name", true, "mdata");
  glyphTrackAddDatatypeColumn(this, "category", "category", true, "mdata");
  glyphTrackAddDatatypeColumn(this, "location_string", "location", false, "mdata");

  return this;
}


function gLyphsTrack_displayWidth() {
  if(this.glyphsGB) { return this.glyphsGB.display_width; }
  return this.display_width;
}


function gLyphsTrack_expPanelFrame() {  
  if(this.glyphsGB && this.glyphsGB.expPanelFrame && this.glyphsGB.share_exp_panel) { 
    this.glyphsGB.expPanelFrame.style.display = "block";
    return this.glyphsGB.expPanelFrame;
  }
  if(!this.exp_panel_frame) { this.exp_panel_frame = document.createElement('div'); }
  if(this.expPanelActive) {
    this.trackDiv.appendChild(this.exp_panel_frame);
  }
  return this.exp_panel_frame;
}

//==========================================================================

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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
    //console.log('gLyphsCacheSourcesResponse problem with XHR!');
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
}


/* new code to determine blocked experiments and then provide interfaces to remove or share depending on user status, still under-development */
function gLyphsSecurityQuery(glyphTrack) {
  if(!glyphTrack) { return; }
  var id_hash = glyphTrack.experiments;
  if(!id_hash) { return; }
  
  var paramXML = "<zenbu_query><mode>securitycheck</mode>\n";
  if(glyphTrack.peerName) { paramXML += "<peer_names>"+glyphTrack.peerName+"</peer_names>\n"; }
  if(glyphTrack.source_ids) { paramXML += "<source_ids>"+glyphTrack.source_ids+"</source_ids>\n"; }
  else { if(glyphTrack.sources) { paramXML += "<source_names>"+glyphTrack.sources+"</source_names>\n"; } }
  paramXML += "</zenbu_query>\n";

  var securityXMLHttp = GetXmlHttpObject();
  if(securityXMLHttp==null) { return; }
  glyphTrack.securityXMLHttp = securityXMLHttp;
  
  securityXMLHttp.open("POST", eedbRegionCGI, true);  //async
  securityXMLHttp.onreadystatechange= function(id) { return function() { gLyphsSecurityQueryResponse(id); };}(glyphTrack.trackID);
  securityXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  securityXMLHttp.send(paramXML);
}


function gLyphsSecurityQueryResponse(trackID) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  var id_hash = glyphTrack.experiments;
  if(!id_hash) { return; }
  
  var securityXMLHttp = glyphTrack.securityXMLHttp;
  if(!securityXMLHttp) { return; }

  if(securityXMLHttp.responseXML == null) return;
  if(securityXMLHttp.readyState!=4) return;
  if(securityXMLHttp.status!=200) { return; }
  if(securityXMLHttp.responseXML == null) return;
  
  var xmlDoc=securityXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    //console.log('gLyphsSecurityQueryResponse problem with XHR!');
    return;
  }
    
  /*
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
  */
  glyphTrack.securityXMLHttp = undefined;

  //gLyphsRenderTrack(glyphTrack);
  //gLyphsDrawTrack(trackID);
  //gLyphsDrawExpressionPanel(glyphTrack.glyphsGB);
}


function gLyphsTrackFeatureInfo(trackID, feature_idx) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  var obj = glyphTrack.feature_array[feature_idx];
  eedbDisplayTooltipObj(obj);
}


function gLyphsTrack_sort_experiment_expression(glyphTrack, experiment_array, sort_mode) {

  var name_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;
    if(!a.expname && !b.expname) { return 0; }
    if(!a.expname) { return 1; }
    if(!b.expname) { return -1; }
    if(a.expname.toLowerCase() == b.expname.toLowerCase()) { return 0; }
    
    if(a.expname.toLowerCase() > b.expname.toLowerCase()) { rtnval = 1; }
    if(a.expname.toLowerCase() < b.expname.toLowerCase()) { rtnval = -1; }
    
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }

  var mdvalue_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;
    if(!a.mdvalue && !b.mdvalue) { return 0; }
    if(!a.mdvalue) { return 1; }
    if(!b.mdvalue) { return -1; }
    if(a.mdvalue.toLowerCase() == b.mdvalue.toLowerCase()) { return 0; }
    
    if(a.mdvalue.toLowerCase() > b.mdvalue.toLowerCase()) { rtnval = 1; }
    if(a.mdvalue.toLowerCase() < b.mdvalue.toLowerCase()) { rtnval = -1; }
    
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }

  var value_both_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;

    var value_a = a.value;
    var value_b = b.value;
    rtnval = value_b - value_a;
    if(rtnval == 0) { // if same then use experiment.id to fix the sort order
      var expa = a.id;
      var expb = b.id;
      rtnval = expa - expb;
    }
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }
  
  var value_plus_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;
   
    var a_sense = a.sense_value;
    var b_sense = b.sense_value;
    var a_anti  = a.antisense_value;
    var b_anti  = b.antisense_value;
    if(a_sense != b_sense) { rtnval = b_sense - a_sense; }
    else { rtnval = b_anti - a_anti; }

    if(rtnval == 0) { // if same then use experiment.id to fix the sort order
      var expa = a.id;
      var expb = b.id;
      rtnval = expa - expb;
    }
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }

  var value_minus_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;
    
    var a_sense = a.sense_value;
    var b_sense = b.sense_value;
    var a_anti  = a.antisense_value;
    var b_anti  = b.antisense_value;
    if(a_anti != b_anti) { rtnval = b_anti - a_anti; }
    else { rtnval = b_sense - a_sense; }

    if(rtnval == 0) { // if same then use experiment.id to fix the sort order
      var expa = a.id;
      var expb = b.id;
      rtnval = expa - expb;
    }
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }

  var series_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;
    
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
    if(rtnval == 0) { // if same then use experiment.id to fix the sort order
      var expa = a.id;
      var expb = b.id;
      rtnval = expa - expb;
    }
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }

  
  var point_func = function(a,b) {
    if(!a) { return 1; }
    if(!b) { return -1; }    
    if(glyphTrack.active_on_top) {
      if(a.hide && !b.hide) { return 1; }
      if(!a.hide && b.hide) { return -1; }
    }
    var rtnval = 0;
    
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

    if(rtnval == 0) { // if same then use experiment.id to fix the sort order
      var expa = a.id;
      var expb = b.id;
      rtnval = expa - expb;
    }
    if(glyphTrack.express_sort_reverse) { rtnval = -rtnval; }
    return rtnval;
  }

  switch(sort_mode) {
    case "name":        experiment_array.sort(name_func); break;
    case "mdvalue":     experiment_array.sort(mdvalue_func); break;
    case "value_both":  experiment_array.sort(value_both_func); break;
    case "value_plus":  experiment_array.sort(value_plus_func); break;
    case "value_minus": experiment_array.sort(value_minus_func); break;
    case "series":      experiment_array.sort(series_func); break;
    case "point":       experiment_array.sort(point_func); break;
    default: experiment_array.sort(name_func); break;
  }
}


function gLyphsTrack_reconfig_with_visible_experiments(trackID) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  //console.log("remove unselected experiments : "+source_ids);

  glyphTrack.source_ids = source_ids;
  glyphTrack.experiments = new Object();;
  glyphTrack.experiment_array = new Array();
  glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
  glyphTrack.experiment_mdgrouping = null; //clear this so it recalcs
  glyphTrack.checked_missing_mdata = false; //so it reloads
  glyphTrack.expfilter = "";
  glyphTrack.uuid = "";
  prepareTrackXHR(trackID);
  glyphTrack.glyphsGB.autosave();
}


function glyphs_reconfig_experiments(trackID, cmd) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }

  var experiments = glyphTrack.experiment_array;
  if(!experiments || experiments.length==0) { return; }

  //console.log("glyphs_reconfig_experiments : "+cmd);
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    if(cmd=="flip-active") { experiment.hide = !experiment.hide; }
    if(cmd=="deactivate-zeroexps") { 
      if(experiment.value==0) { experiment.hide = true; }
    }
  }
  //console.log("remove unselected experiments : "+source_ids);
  //prepareTrackXHR(trackID);
  //glyphTrack.glyphsGB.autosave();
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(trackID);
}


/*
function gLyphsTrackFetchMetadataGrouping(trackID) {
  if(!trackID) { return false; }
  //console.log(" gLyphsTrackFetchMetadataGrouping("+trackID+")");
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }
    
  var graph_msgdiv = null;
  if(glyphTrack.expPanelFrame) { graph_msgdiv = glyphTrack.expPanelFrame.graph_msgdiv; }
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
  //paramXML += "<filter>"+glyphTrack.expfilter+"</filter>\n";
  paramXML += "<mdkey>"+glyphTrack.mdgroupkey+"</mdkey>\n";
  paramXML += "<mdkey_list>"+glyphTrack.mdgroupkey+"</mdkey_list>\n";
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
  //console.log(" gLyphsTrackMdGroupingXMLResponse("+trackID+")");
  if(!trackID) { return false; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }
  //if(!glyphTrack.experiments) { return; }

  var xhr = glyphTrack.mdGroupXHR;
  if(!xhr) { return; }
  
  var graph_msgdiv = null;
  if(glyphTrack.expPanelFrame) { graph_msgdiv = glyphTrack.expPanelFrame.graph_msgdiv; }
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
      mdgroup.source_count = 0;
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
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      ingroup[srcid] = true;
      if(!(glyphTrack.hide_zero && (experiment.value==0)) &&
         !(experiment.hide)) { mdgroup.source_count++; }
    }
  }

  var mdgroup = new Object;
  mdgroup.mdvalue = "UNKNOWN - no metadata key";
  mdgroup.name = mdgroup.mdvalue
  mdgroup.source_ids = new Array;
  mdgroup.source_hash = new Object;
  mdgroup.source_count = 0;
  mdgroup.hide = false;
  for(var expID in glyphTrack.experiments) {
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    if(ingroup[expID]) { continue; }
    if(!mdgroup.source_hash[expID]) {
      mdgroup.source_hash[expID] = true;
      mdgroup.source_ids.push(expID);
      if(!(glyphTrack.hide_zero && (experiment.value==0)) &&
         !(experiment.hide)) { mdgroup.source_count++; }
    }
  }
  if(mdgroup.source_ids.length > 0) { 
    glyphTrack.experiment_mdgrouping.push(mdgroup); 
  }
  
  if(graph_msgdiv) { 
    graph_msgdiv.style.display = "none";
    graph_msgdiv.innerHTML = "";
  }
  
  glyphsExpPanelDraw();
  
  if(glyphTrack.glyphStyle == "split-signal") { 
    gLyphsRenderSplitSignalTrack(glyphTrack);
    //gLyphsDrawSplitSignalTrack(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
  
  glyphTrack.mdGroupXHR = undefined; //clear
  return true; //everything ok
}
*/


//---- new version which moves mdgroup calculation into javascript
function gLyphsTrackCalcMetadataGrouping(trackID) {
  if(!trackID) { return false; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }
  
  var starttime = new Date();

  var graph_msgdiv = null;
  if(glyphTrack.expPanelFrame()) { graph_msgdiv = glyphTrack.expPanelFrame().graph_msgdiv; }
  if(graph_msgdiv) {
    graph_msgdiv.style.display = "block";
    graph_msgdiv.innerHTML = "";
  }
  
  if(!glyphTrack.mdgroupkey) {
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "please enter a metadata grouping key(s)"; }
    return false;
  }
  if(!glyphTrack.experiment_array) { 
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "track has no experiments, can't perform metadata grouping"; }
    return false;
  }

  //need to make sure the mdgrouping mdata has been loaded
  if(glyphTrack.checked_missing_mdata!=2) {
    if(graph_msgdiv) { graph_msgdiv.innerHTML = "loading missing grouping metadata..."; }
    gLyphsTrackSourcesMissingMetadataLoad(glyphTrack, glyphTrack.mdgroupkey); //async
    return;
  }
  
  console.log("gLyphsTrackCalcMetadataGrouping "+trackID);
  //clear and rebuild
  if(!glyphTrack.experiment_mdgrouping) { glyphTrack.experiment_mdgrouping = new Array; }


  var mdgroupkey = glyphTrack.mdgroupkey;
  var group_mdkey_array = new Array();
  var toks = mdgroupkey.split(/[\s\t, ]/);
  for(var i=0; i<toks.length; i++) {
    var tok = toks[i];
    if(!tok) { continue; }
    group_mdkey_array.push(tok);
  }
  //console.log("mdgroupkey ["+glyphTrack.mdgroupkey+"]split into "+group_mdkey_array.length+" keys");

  //main loop -- for each experiment determine mdgroup value and assign to group

  for(var k=0; k<glyphTrack.experiment_array.length; k++) {
    var experiment = glyphTrack.experiment_array[k];
    if(!experiment) { continue; }
    //if(glyphTrack.hide_deactive_exps && experiment.hide) { continue; }
    //if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
    //if(experiment.parent_source) { console.log("experiment "+experiment.id+" is subsource: parent objID:"+experiment.parent_source.id); }

    //need to create composite mdvalue and then assign experiment to correct mdgroup

    var composite_mdvalue = ""; //for this experiment;
    for(var j=0; j<group_mdkey_array.length; j++) {
      var mdkey = group_mdkey_array[j];

      if(experiment.mdata && experiment.mdata[mdkey]) { 
        var value_array = experiment.mdata[mdkey];
        for(var idx3=0; idx3<value_array.length; idx3++) {
          var value = value_array[idx3];
          if(composite_mdvalue) { composite_mdvalue += " "; }
          composite_mdvalue += mdkey+": "+value;
        }

      //else if(experiment.parent_source && experiment.parent_source.mdata[mdkey]) {
      ////did not find key within subsource and has parent with mdkey
      //var value_array = experiment.parent_source.mdata[mdkey];
      //for(var idx3=0; idx3<value_array.length; idx3++) {
      //  var value = value_array[idx3];
      //  if(composite_mdvalue) { composite_mdvalue += " "; }
      //  composite_mdvalue += value;
      //}

      }
    }
    //console.log("experiment "+experiment.id+" composite_mdvalue["+composite_mdvalue+"]");
    if(!composite_mdvalue) { continue; }

    var mdgroup = null;
    for(var idx4=0; idx4<glyphTrack.experiment_mdgrouping.length; idx4++) {
      var mdg2 = glyphTrack.experiment_mdgrouping[idx4];
      if(mdg2.mdvalue == composite_mdvalue) {
        mdgroup = mdg2;
        break;
      }
    }
    if(!mdgroup) {
      //console.log("create new mdgroup ["+composite_mdvalue+"]");
      mdgroup = new Object;
      mdgroup.id      = composite_mdvalue;
      mdgroup.mdvalue = composite_mdvalue;
      mdgroup.name    = composite_mdvalue;
      mdgroup.source_ids = new Array;
      mdgroup.source_hash = new Object;
      mdgroup.source_count = 0;
      mdgroup.hide = false;
      glyphTrack.experiment_mdgrouping.push(mdgroup);
    }
      
    if(!mdgroup.source_hash[experiment.id]) {
      mdgroup.source_hash[experiment.id] = true;
      mdgroup.source_ids.push(experiment.id);
    }
  }
  
  //post-processing loops

  //UNKNOWN group: always recalculate the source_ids. those not in the ingroup become UNKNOWN
  var unkGroup = null;
  for(var idx4=0; idx4<glyphTrack.experiment_mdgrouping.length; idx4++) {
    var mdg2 = glyphTrack.experiment_mdgrouping[idx4];
    if(mdg2.mdvalue == "UNKNOWN - no metadata key") {
      unkGroup = mdg2;
      break;
    }
  }
  if(!unkGroup) {
    console.log("create UNKNOWN mdgroup");
    unkGroup = new Object;
    unkGroup.mdvalue = "UNKNOWN - no metadata key";
    unkGroup.name = "UNKNOWN - no metadata key";
    unkGroup.id   = unkGroup.mdvalue
    unkGroup.hide = false;
    glyphTrack.experiment_mdgrouping.push(unkGroup);
  }
  unkGroup.source_ids = new Array;
  unkGroup.source_hash = new Object;
  unkGroup.source_count = 0;

  //find all the sources not covered by the mdkey (outside)
  //ingroup = all the sources IN mdgroups
  var ingroup = new Object;
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      ingroup[srcid] = true;
      //if(!(glyphTrack.hide_zero && (experiment.value==0)) && !(experiment.hide)) { mdgroup.source_count++; }
    }
  }

  for(var expID in glyphTrack.experiments) {
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    if(ingroup[expID]) { continue; }
    if(!unkGroup.source_hash[expID]) {
      unkGroup.source_hash[expID] = true;
      unkGroup.source_ids.push(expID);
      //if(!(glyphTrack.hide_zero && (experiment.value==0)) && !(experiment.hide)) { unkGroup.source_count++; }
    }
  }
  //if(unkGroup.source_ids.length > 0) { glyphTrack.experiment_mdgrouping.push(unkGroup); }

  gLyphsTrackCalcMetadataGroupingValues(glyphTrack);

  if(graph_msgdiv) { 
    graph_msgdiv.style.display = "none";
    graph_msgdiv.innerHTML = "";
  }
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("gLyphsTrackCalcMetadataGrouping("+glyphTrack.trackID+") groups:"+(glyphTrack.experiment_mdgrouping.length)+" "+(runtime)+"msec");

  return true; //everything ok
}


function gLyphsTrackCalcMetadataGroupingValues(glyphTrack) {
  if(!glyphTrack) { return; }
  if(!glyphTrack.experiments) { return; }
  if(!glyphTrack.experiment_mdgrouping) { return; }
  var starttime = new Date();

  //update the experiment_mdgrouping with current experiment_array values
  var max_value = 0.0;
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    mdgroup.value = 0;
    mdgroup.sense_value = 0;
    mdgroup.sense_error = 0;
    mdgroup.antisense_value = 0;
    mdgroup.antisense_error = 0;
    mdgroup.value_total = 0;
    mdgroup.sense_total = 0;
    mdgroup.antisense_total = 0;
    mdgroup.source_count = 0;
    
    var avgR=0, avgG=0, avgB=0, colorCnt=0;;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) {
        //console.log("noid["+srcid+"] ");
        continue;
      }
      //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
      //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
      if(experiment.hide) { continue; }
      if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }

      //calculate sums/mean
      mdgroup.value_total     += experiment.value;
      mdgroup.sense_total     += experiment.sense_value;
      mdgroup.antisense_total += experiment.antisense_value;
      mdgroup.id              = experiment.id; //assign at least one experiment.id to the mdgroup
      mdgroup.source_count++;

      if(experiment.rgbcolor) {
        //console.log(" ["+experiment.rgbcolor+"] ");
        var cl2 = new RGBColor(experiment.rgbcolor);
        avgR += cl2.r;
        avgG += cl2.g;
        avgB += cl2.b;
        colorCnt++;
      }
    }
    if(mdgroup.source_count==0) { continue; }

    mdgroup.value           = mdgroup.value_total / mdgroup.source_count;
    mdgroup.sense_value     = mdgroup.sense_total / mdgroup.source_count;
    mdgroup.antisense_value = mdgroup.antisense_total / mdgroup.source_count;
    
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
        //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
        //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }

        //calculate sums/mean
        mdgroup.value_error     += (experiment.value - mdgroup.value) * (experiment.value - mdgroup.value);
        mdgroup.sense_error     += (experiment.sense_value - mdgroup.sense_value) * (experiment.sense_value - mdgroup.sense_value);
        mdgroup.antisense_error += (experiment.antisense_value - mdgroup.antisense_value) * (experiment.antisense_value - mdgroup.antisense_value);
      }
      //sample standard deviation : sqrt (sum-of-squares / (n-1) )
      mdgroup.value_error     = Math.sqrt(mdgroup.value_error / (mdgroup.source_count-1));
      mdgroup.sense_error     = Math.sqrt(mdgroup.sense_error / (mdgroup.source_count-1));
      mdgroup.antisense_error = Math.sqrt(mdgroup.antisense_error / (mdgroup.source_count-1));

      //standard error of the mean : stddev \ sqrt (n)
      if(glyphTrack.errorbar_type == "stderror") { 
        mdgroup.value_error     = mdgroup.value_error / Math.sqrt(mdgroup.source_count);
        mdgroup.sense_error     = mdgroup.sense_error / Math.sqrt(mdgroup.source_count);
        mdgroup.antisense_error = mdgroup.antisense_error / Math.sqrt(mdgroup.source_count);
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
      //console.log(" ["+avgR +":"+avgG+":"+avgB+"]"+ mdgroup.rgbcolor);
    }
  }
  glyphTrack.mdgroup_max_value = max_value;

  gLyphsTrack_sort_experiment_expression(glyphTrack, glyphTrack.experiment_mdgrouping, glyphTrack.express_sort_mode);

  //var endtime = new Date();
  //var runtime = (endtime.getTime() - starttime.getTime());
  //console.log("gLyphsTrackCalcMetadataGroupingValues("+glyphTrack.trackID+") "+(runtime)+"msec");
}


function gLyphsTrackSourcesMissingMetadataLoad(glyphTrack, mdkeys) {
  if(!glyphTrack) { return; }
  if(!mdkeys) { return; }
  if(!glyphTrack.experiment_array) { return; }
  if(glyphTrack.experiment_array.length ==0) { return; }

  if(glyphTrack.checked_missing_mdata) { return; }

  var mdkey_array = new Array();
  var toks = mdkeys.split(/[\s\t, ]/);
  for(var i=0; i<toks.length; i++) {
    var tok = toks[i];
    if(!tok) { continue; }
    mdkey_array.push(tok);
  }
  console.log("gLyphsTrackSourcesMissingMetadataLoad "+glyphTrack.trackID+" exps.count="+glyphTrack.experiment_array.length+" mdkeys ["+mdkeys+"]split into "+mdkey_array.length+" keys");

  //first perform logic to find experiments missing mdkey and which need to load necessary mdata
  var expID_hash = new Object();
  for(var k=0; k<glyphTrack.experiment_array.length; k++) {
    var experiment = glyphTrack.experiment_array[k];
    if(!experiment) { continue; }
    if(experiment.full_load) { continue; }
    if(glyphTrack.hide_deactive_exps && experiment.hide) { continue; }
    if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
    //if(experiment.parent_source) { console.log("experiment "+experiment.id+" is subsource: parent objID:"+experiment.parent_source.id); }

    var exp_ok=true;
    if(experiment.mdata) { 
      for(var j=0; j<mdkey_array.length; j++) {
        var mdkey = mdkey_array[j];
        var key_ok=false; //find in either my mdata or my parent mdata
        if(experiment.mdata[mdkey]) { key_ok=true; }
        //if(experiment.parent_source && experiment.parent_source.mdata[mdkey]) { key_ok=true; }
        if(!key_ok) { //if any key missing then exp needs reload
          exp_ok=false; 
          //console.log("experiment "+experiment.id+" missing group key ["+mdkey+"]");
        }
      }
    } else {  //no experiment.mdata so definitely need to load
      exp_ok=false;
    }
    if(!exp_ok) {
      //console.log("experiment "+experiment.id+" missing group keys");
      if(experiment.parent_source) {
        if(!experiment.parent_source.full_load) { 
          expID_hash[experiment.parent_source.id] = true; 
          //console.log("experiment "+experiment.parent_source.id+" will load metadata");
        }
        else { console.log("parent "+experiment.parent_source.id+" already full_load so skip"); }
      }
      else { 
        if(!(experiment.objID =~ /s/)) {
          //console.log("experiment "+experiment.id+" will load metadata");
          expID_hash[experiment.id] = true; 
        } else {
          //console.log("experiment "+experiment.id+" is dynamic subsource, can't load metadata");
        }
      }
    }
  }
  if(!expID_hash) { 
    glyphTrack.checked_missing_mdata = 2;
    return;
  } 

  var descxml_source_ids ="";
  var id_count=0;
  for(var expID in expID_hash) {
    if(!glyphTrack.experiments[expID]) {
      console.log("glyphTrack does not have experiment "+expID);
      continue;
    }
    id_count++;
    if(descxml_source_ids) { descxml_source_ids += ","; }
    descxml_source_ids += expID;
  }
  //console.log(id_count+" experiments missing mdkeys["+mdkeys+"] : "+descxml_source_ids);
  if(!descxml_source_ids) {
    glyphTrack.checked_missing_mdata = 2;
    return;
  }

  //send descxml/fullxml request to get metadata if needed
  //dang the GET url can be too long and fails. need to go back to POST

  var sourcesXMLHttp = GetXmlHttpObject();
  if(sourcesXMLHttp==null) { return; }
  glyphTrack.sourcesXMLHttp = sourcesXMLHttp;
  sourcesXMLHttp.do_full_load = false;

  //var url = eedbSearchFCGI + "?mode=sources;source_ids="+descxml_source_ids+";";
  //if(id_count>10) { url += "format=descxml;mdkey_list="+ glyphTrack.mdgroupkey; }
  //else { url += "format=fullxml"; do_full_load=true;}
  //console.log(url);
  //sourcesXMLHttp.open("GET",url,false); //synchronous, wait until returns
  //sourcesXMLHttp.send(null);
  //gLyphsTrackSourcesMissingMetadataXMLResponse(glyphTrack.trackID);

  var paramXML = "<zenbu_query><mode>sources</mode>";
  paramXML += "<source_ids>"+descxml_source_ids+"</source_ids>";
  if(id_count>10) { paramXML += "<format>descxml</format><mdkey_list>"+mdkeys+"</mdkey_list>"; }
  else { paramXML += "<format>fullxml</format>"; sourcesXMLHttp.do_full_load=true;}
  paramXML += "</zenbu_query>";
  //console.log(paramXML);

  glyphTrack.checked_missing_mdata = 1; //1 == sending data
  
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);  //async
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { gLyphsTrackSourcesMissingMetadataXMLResponse(id); };}(glyphTrack.trackID);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  sourcesXMLHttp.send(paramXML);
}


function gLyphsTrackSourcesMissingMetadataXMLResponse(trackID) {
  if(!trackID) { return false; }
  console.log("gLyphsTrackSourcesMissingMetadataXMLResponse("+trackID+")");
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }

  var sourcesXMLHttp = glyphTrack.sourcesXMLHttp;
  if(!sourcesXMLHttp) { return; }

  if(sourcesXMLHttp.readyState!=4) { return false; }
  if(sourcesXMLHttp.responseXML == null) { return false; }
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return false; }
  //console.log("got xmldoc for source-mdata-update");

  glyphTrack.checked_missing_mdata = 2; //2 == query returned data

  if(xmlDoc.tagName != "sources") { return false; }
  //console.log("xmldoc tagName == sources");

  var sources_children = xmlDoc.childNodes;
  for (var i = 0; i < sources_children.length; i++) {
    var sourceDOM = sources_children[i]
    if(!sourceDOM.tagName) { continue; }
    //console.log("child tagName ["+sourceDOM.tagName+"]");

    //if(sourceDOM.tagName == "featuresource") {
    //  var srcID = sourceDOM.getAttribute("id");
    //  var source = glyphTrack.experiments[srcID];
    //  if(!source) {
    //    var source = new Object;
    //    source.uuid = srcID;
    //  }
    //  eedbParseFeatureSourceData(sourceDOM, source);
    //}

    if(sourceDOM.tagName == "experiment") {
      var expID = sourceDOM.getAttribute("id");
      var source = glyphTrack.experiments[expID];
      if(source) {
        //console.log("read full mdata "+expID);
        eedbParseExperimentData(sourceDOM, source);
        if(sourcesXMLHttp.do_full_load) { source.full_load = true; }
      } else {
        console.log("problem query returned "+expID+" not in known sources");
      }
      //maybe migrate new mdata down to subsources
      //if(source.subsources) {
      //  for(var subID in source.subsources) {
      //    var subsource = source.subsources[subID];
      //  }
      //}
    }
  }

  //possibly danger of infinite loop, but glyphTrack.checked_missing_mdata should protect against this
  glyphTrack.experiment_mdgrouping = null;
  gLyphsTrackCalcMetadataGrouping(glyphTrack.trackID);
  glyphsExpPanelDraw(glyphTrack);  //draw if active
  if(glyphTrack.glyphStyle == "split-signal") {
    gLyphsRenderSplitSignalTrack(glyphTrack);
    //gLyphsDrawSplitSignalTrack(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
  if(glyphTrack.glyphStyle == "experiment-heatmap") { 
    gLyphsTrack_render_experiment_heatmap(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
}


function gLyphsTrackCalcRankSumEnrichment(trackID) {
  if(!trackID) { return false; }
  //console.log(" gLyphsTrackCalcRankSumEnrichment("+trackID+")");
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }
  if(!glyphTrack.experiments) { return false; }
  
  var graph_msgdiv = null;
  if(glyphTrack.expPanelFrame()) { graph_msgdiv = glyphTrack.expPanelFrame().graph_msgdiv; }
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
    //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
    if(experiment.hide) { continue; }
    if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
    paramXML += expID + ",";
  }
  paramXML += "</source_ids>\n";
  if(glyphTrack.ranksum_mdkeys) {
    paramXML += "<mdkey_list>"+glyphTrack.ranksum_mdkeys+"</mdkey_list>\n";
  }
  
  //send the current expression panel result as a fake "feature" to perform the rank-sum analysis on
  var ss = glyphTrack.glyphsGB.start;
  var se = glyphTrack.glyphsGB.end;
  if(glyphTrack.selection) { 
    ss = glyphTrack.selection.chrom_start;
    se = glyphTrack.selection.chrom_end;
  }
  if(ss>se) { var t=ss; ss=se; se=t; }

  paramXML += "<ranksum_input>\n";
  if(glyphTrack.strandless) { 
    paramXML += "<feature start=\""+ss+"\" end=\""+se+"\" strand=\"\" >\n";
    paramXML += "<chrom chr=\""+glyphTrack.glyphsGB.chrom+"\" asm=\""+glyphTrack.glyphsGB.asm+"\" />\n";
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
      if(experiment.hide) { continue; }
      if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
      paramXML += "<expression datatype=\""+experiment.exptype+"\" value=\""+experiment.value+"\" experiment_id=\""+expID+"\" />\n";
    }
    paramXML += "</feature>\n";
  } else {
    paramXML += "<feature start=\""+ss+"\" end=\""+se+"\" strand=\"+\" >\n";
    paramXML += "<chrom chr=\""+glyphTrack.glyphsGB.chrom+"\" asm=\""+glyphTrack.glyphsGB.asm+"\" />\n";
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
      if(experiment.hide) { continue; }
      if(glyphTrack.hide_zero && (experiment.sense_value==0)) { continue; }
      paramXML += "<expression datatype=\""+experiment.exptype+"\" value=\""+experiment.sense_value+"\" experiment_id=\""+expID+"\" />\n";
    }  
    paramXML += "</feature>\n";

    paramXML += "<feature start=\""+ss+"\" end=\""+se+"\" strand=\"-\" >\n";
    paramXML += "<chrom chr=\""+glyphTrack.glyphsGB.chrom+"\" asm=\""+glyphTrack.glyphsGB.asm+"\" />\n";
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
      if(experiment.hide) { continue; }
      if(glyphTrack.hide_zero && (experiment.antisense_value==0)) { continue; }
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
  //console.log(" gLyphsTrackRankSumEnrichmentXMLResponse("+trackID+")");
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }

  var xhr = glyphTrack.mdGroupXHR;
  if(!xhr) { return; }

  var graph_msgdiv = null;
  if(glyphTrack.expPanelFrame()) { graph_msgdiv = glyphTrack.expPanelFrame().graph_msgdiv; }

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

  glyphsExpPanelDraw(glyphTrack);

  if(glyphTrack.glyphStyle == "split-signal") { 
    gLyphsRenderSplitSignalTrack(glyphTrack);
    //gLyphsDrawSplitSignalTrack(glyphTrack);
    gLyphsDrawTrack(trackID);
  }
  
  glyphTrack.mdGroupXHR = undefined; //clear
  return true; //everything ok
}


function gLyphsRecalcTrackExpressionScaling(trackID) {
  //this function takes parameters of a track, its experiments
  // and scans the feature_array and recalculates the scaling factors

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  glyphTrack.max_express       = 0;
  glyphTrack.total_max_express = 0;
  glyphTrack.sense_max_express = 0;
  glyphTrack.anti_max_express  = 0;
  glyphTrack.max_express_element = 0;
  glyphTrack.max_score           = 0;
  glyphTrack.min_score           = 0;

  if(glyphTrack.glyphStyle == "experiment-heatmap") {
    if(glyphTrack.track_height <1) { glyphTrack.track_height = 1; }
    if(glyphTrack.track_height >50) { glyphTrack.track_height = 50; }
  } else if(glyphTrack.glyphStyle == "1D-heatmap") {
    if(glyphTrack.track_height <5) { glyphTrack.track_height = 5; }
    if(glyphTrack.track_height >200) { glyphTrack.track_height = 200; }
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

    if(glyphTrack.max_score==0 && glyphTrack.min_score==0) {
      glyphTrack.min_score = feature.score;
      glyphTrack.max_score = feature.score;
    }
    if(feature.score > glyphTrack.max_score) { glyphTrack.max_score = feature.score; }
    if(feature.score < glyphTrack.min_score) { glyphTrack.min_score = feature.score; }

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
  if(glyphTrack.scale_max_signal != "auto") {
    max_express = glyphTrack.scale_max_signal;
    total_max_express = glyphTrack.scale_max_signal;
  }
  
  glyphTrack.max_express       = max_express;
  glyphTrack.total_max_express = total_max_express;
  glyphTrack.sense_max_express = sense_max_express;
  glyphTrack.anti_max_express  = anti_max_express;
}


function gLyphsToggleTrackHide(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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


function reloadTrack(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  gLyphsShowTrackLoading(trackID);
  prepareTrackXHR(trackID);
}


function prepareTrackXHR(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  //clear and prepare data containers
  glyphTrack.newconfig = undefined;
  glyphTrack.glyphs_array = new Array(); //clear the old feature objects

  if(!glyphTrack.source_ids) {
    glyphTrack.dataLoaded = true;
    glyphTrack.maxlevels  = 0;
    gLyphsDrawTrack(trackID);
    gLyphsUpdateLoadingProgress(glyphTrack.glyphsGB);
    return;
  }

  //code to delay loading of data when tracks are compressed
  glyphTrack.dataLoaded = false;
  if(glyphTrack.hideTrack) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  //trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  gLyphsShowTrackLoading(trackID);

  var asm    = glyphTrack.glyphsGB.asm;
  var chrom  = glyphTrack.glyphsGB.chrom;
  var start  = glyphTrack.glyphsGB.start;
  var end    = glyphTrack.glyphsGB.end;
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

  var dwidth     = glyphTrack.glyphsGB.display_width;
    
  glyphTrack.has_subfeatures = false;
  glyphTrack.has_expression  = false;
  glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
  
  var format = "fullxml";
  var paramXML = "<zenbu_query>\n";
  if(glyphTrack.noCache | glyphTrack.glyphsGB.nocache) { paramXML += "<nocache/>\n"; }

  if(glyphTrack.title) { paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n"; }
  if(glyphTrack.glyphsGB.configUUID) { paramXML += "<view_uuid>"+ glyphTrack.glyphsGB.configUUID +"</view_uuid>\n"; }

  if(peerName) { paramXML += "<peer_names>"+peerName+"</peer_names>\n"; }
  if(source_ids) { paramXML += "<source_ids>"+source_ids+"</source_ids>\n"; }
  else {
    if(sourceName) { paramXML += "<source_names>"+sourceName+"</source_names>\n"; }
  }
  if(exptype && exptype!="-") { paramXML += "<exptype>"+exptype+"</exptype>\n"; }
  if(glyphTrack.uuid) { paramXML += "<track_uuid>"+glyphTrack.uuid+"</track_uuid>\n"; }
  
  paramXML += "<asm>"+glyphTrack.glyphsGB.asm+"</asm>\n";
  if(glyphStyle && (glyphStyle=='cytoband')) { 
    paramXML += "<chrom>"+chrom+"</chrom>\n"; 
  } 
  else if(glyphTrack.whole_chrom_scale) {
    if(glyphTrack.glyphsGB.chrom_length>0) { end = glyphTrack.glyphsGB.chrom_length; }
    else { end = 1000000000; }
    chromloc = chrom +":1.."+end;
    paramXML += "<loc>"+chromloc+"</loc>\n";
  }
  else { paramXML += "<loc>"+chromloc+"</loc>\n"; }

  paramXML += "<mode>region</mode>\n";
  paramXML += "<source_outmode>" + glyphTrack.source_outmode + "</source_outmode>\n";
  paramXML += "<display_width>"+dwidth+"</display_width>\n";

  //if(glyphTrack.exprbin_strandless)  { paramXML += "<strandless>true</strandless>\n"; }
  //if(glyphTrack.exprbin_add_count)   { paramXML += "<add_count_expression>true</add_count_expression>\n"; }
  //if(glyphTrack.exprbin_subfeatures) { paramXML += "<overlap_check_subfeatures>true</overlap_check_subfeatures>\n"; }
  //if(glyphTrack.exprbin_flipstrand)  { paramXML += "<flip_strand>true</flip_strand>\n"; }
  //if(glyphTrack.exprbin_binsize) { paramXML += "<bin_size>"+ glyphTrack.exprbin_binsize +"</bin_size>\n"; }

  if(glyphTrack.spstream_mode == "expression") {
    paramXML += glyphsTrack_expressionConfigXML(glyphTrack);
    //     paramXML += "<binning>"+binning+"</binning>\n";
    //     //paramXML += "<binning>sum</binning>\n";
    //     paramXML += "<overlap_mode>"+overlap_mode+"</overlap_mode>\n";
    //     if(!glyphTrack.script) {
    //       //switch back to the legacy default histogram binning
    //       paramXML += "<expression_binning>true</expression_binning>\n"; 
    //     }
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
  //console.log(paramXML);
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
  xhrObj.asm        = glyphTrack.glyphsGB.asm;
  xhrObj.start      = glyphTrack.glyphsGB.start;
  xhrObj.end        = glyphTrack.glyphsGB.end;
  xhrObj.chrom      = glyphTrack.glyphsGB.chrom;
  xhrObj.paramXML   = paramXML;

  pending_track_XHRs[trackID] = xhrObj;

  glyphTrack.loading = true;
  glyphTrack.load_retry = 0;
  //console.log(" prepare["+trackID+"]");

  setTimeout("glyphsSendPendingXHRs();", 30); //30msec
}


function glyphsSendPendingXHRs() {
  var glyphsGB_hash = new Object(); //hash for updating load status

  var pending_count =0;
  for(var trackID in pending_track_XHRs) { 
    if(active_track_XHRs[trackID] == null) { pending_count++; }
    var glyphTrack = glyphsTrack_global_track_hash[trackID];
    if(glyphTrack && glyphTrack.glyphsGB) { glyphsGB_hash[glyphTrack.glyphsGB.uuid] = glyphTrack.glyphsGB; }
  }
  var active_count =0;
  for(var trackID in active_track_XHRs) { 
    active_count++;
    var glyphTrack = glyphsTrack_global_track_hash[trackID];
    if(glyphTrack && glyphTrack.glyphsGB) { glyphsGB_hash[glyphTrack.glyphsGB.uuid] = glyphTrack.glyphsGB; }
  }
  for(var gb_uuid in glyphsGB_hash) { 
    gLyphsUpdateLoadingProgress(glyphsGB_hash[gb_uuid]); 
  }

  //console.log("pendingXHRs[" + pending_count + "]  activeXHRs[" + active_count + "]");
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
  //console.log("  send[" + xhrObj.trackID + "]");

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


function gLyphsShowTrackLoading(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  if(!glyphTrack.trackDiv) { return; }

  if(glyphTrack.glyphsGB.hide_compacted_tracks && glyphTrack.hideTrack) { 
    clearKids(glyphTrack.trackDiv)
    glyphTrack.svg = undefined;
    glyphTrack.dataLoaded = false;
    return;
  }

  svg = createSVG(glyphTrack.glyphsGB.display_width+10, 13);
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
    trackmsg.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.display_width-120)+'px');
    trackmsg.setAttributeNS(null, 'y', '9px');
    trackmsg.setAttributeNS(null, "font-size","10px");
    trackmsg.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    trackmsg.setAttributeNS(null, 'style', 'fill: red;');
  }
  clearKids(trackmsg);

  var textNode = document.createTextNode("track loading");
  if(glyphTrack.load_retry>0) {
    textNode = document.createTextNode("network error : track reload try " + glyphTrack.load_retry);
    trackmsg.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.display_width-220)+'px');
  }
  if(glyphTrack.load_retry<0) {
    textNode = document.createTextNode("error: failed to load track");
    trackmsg.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.display_width-180)+'px');
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
  var svg = createSVG(glyphTrack.glyphsGB.display_width+10, 13);
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
    trackmsg.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.display_width/2)+'px');
    trackmsg.setAttributeNS(null, 'y', '9px');
    trackmsg.setAttributeNS(null, "font-size","10px");
    trackmsg.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    trackmsg.setAttributeNS(null, 'style', 'fill: red;');
  }
  clearKids(trackmsg);

  //var textNode = document.createTextNode("security access error");
  var textNode = document.createTextNode("data unavailable: " + glyphTrack.security_error + " blocked");
  trackmsg.appendChild(textNode);
}


function gLyphsXHResponseParseData(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  //console.log("XHR response track "+ trackID);

  var xhrObj = active_track_XHRs[trackID];
  if(xhrObj == null) {  
    //console.log(trackID + ' no xhrObj');
    gLyphsDrawTrack(trackID);
    glyphTrack.loading = false;
    setTimeout("glyphsSendPendingXHRs();", 30); //30msec
    return; 
  }
  //these tests are to make sure the XHR has fully returned
  var xhr = xhrObj.xhr;
  if(xhr == null) { 
    //console.log(trackID + ' no xhr ');
    return;
  }
  //console.log("XHR response "+ trackID + " readyState="+xhr.readyState + "  status="+xhr.status);

  //console.log(" ["+trackID + '-rs'+xhr.readyState+ "-st"+xhr.status + "]");
  if(xhr.readyState!=4) { return; }
  //console.log("XHR response "+ trackID + " readyState="+xhr.readyState + "  status="+xhr.status);

  /*
  if(xhr.status>=500) { 
    console.log("track "+ trackID+ " failed status >= 500");
    //console.log('-ERROR:'+xhr.status);
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
  */

  if(xhr.status!=200) { return; }
  if(xhr.responseXML == null) { 
    console.log("track "+ trackID+ " failed responseXML is null");
    //hmm this might be a true error condition.
    //status says 4 and 200 (meaning done) but no responseXML
    //console.log(trackID + ' no responseXML ');
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
  if((xhrObj.asm != glyphTrack.glyphsGB.asm) ||
     (xhrObj.chrom != glyphTrack.glyphsGB.chrom) ||
     (xhrObj.start != glyphTrack.glyphsGB.start) ||
     (xhrObj.end != glyphTrack.glyphsGB.end)) { 
    xhrObj.xhr = null;
    active_track_XHRs[trackID] = null;
    delete active_track_XHRs[trackID];
    setTimeout("glyphsSendPendingXHRs();", 30); //30msec
    //console.log(trackID + ' not matching ');
    return; 
  }
  

  //clear selection if it is out-of-region here
  if(glyphTrack.selection && (glyphTrack.glyphsGB.chrom != glyphTrack.selection.chrom)) {
    glyphTrack.selection = null; 
  }
  if(glyphTrack.selection && !glyphTrack.whole_chrom_scale &&
     ((glyphTrack.glyphsGB.start > glyphTrack.selection.chrom_end) ||
      (glyphTrack.glyphsGB.end < glyphTrack.selection.chrom_start))) { glyphTrack.selection = null; }

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    //console.log('Problem with central DB!');
    console.log("track "+ trackID+ " failed xmlDoc is null");
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
  //console.log(' draw:' + trackID);

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
  if(glyphTrack.glyphsGB.active_trackID == trackID) { 
    gLyphsDrawExpressionPanel(glyphTrack.glyphsGB);
  }

  gLyphsUpdateLoadingProgress(glyphTrack.glyphsGB);

  //see if there are anymore tracks pending to be sent
  setTimeout("glyphsSendPendingXHRs();", 30); //30msec
}


function gLyphsRenderTrack(glyphTrack) {
  if(glyphTrack == null) { return; }

  gLyphsRecalcTrackExpressionScaling(glyphTrack.trackID);
  
  //if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot") { 
  if(glyphTrack.glyphStyle == "signal-histogram") { 
    gLyphsRenderExpressionTrack(glyphTrack);
  } else if(glyphTrack.glyphStyle == "xyplot") {
    gLyphsTrack_render_xyplot(glyphTrack);
  } else if(glyphTrack.glyphStyle == "arc") {
    gLyphsTrack_render_arc(glyphTrack);
  } else if(glyphTrack.glyphStyle == "split-signal") { 
    gLyphsRenderSplitSignalTrack(glyphTrack);
  } else if((glyphTrack.glyphStyle == "experiment-heatmap") || (glyphTrack.glyphStyle == "1D-heatmap")) { 
    gLyphsTrack_render_experiment_heatmap(glyphTrack);
  } else {
    gLyphsRenderFeatureTrack(glyphTrack);
  }
}


function gLyphsDrawTrack(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack.hideTrack && glyphTrack.glyphsGB.hide_compacted_tracks) {
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
    var svg = createSVG(glyphTrack.glyphsGB.display_width+10, 13);
    glyphTrack.svg = svg;
    glyphTrack.svg_height = 14;
    glyphTrack.top_group = document.createElementNS(svgNS,'g');
    svg.appendChild(glyphTrack.top_group);
    glyphTrack.trackDiv.appendChild(svg);
    gLyphsDrawHeading(glyphTrack);
    gLyphsCreateMoveBar(glyphTrack);
    return;
  }
  //console.log(' gLyphsDrawTrack ' + trackID);

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphStyle == "signal-histogram" || glyphStyle == "xyplot" || glyphStyle == "arc") { 
    gLyphsDrawExpressTrack(glyphTrack);
  } else if(glyphStyle == "split-signal") { 
    gLyphsDrawSplitSignalTrack(glyphTrack);
  } else if((glyphStyle == "experiment-heatmap") || (glyphStyle == "1D-heatmap")) { 
    gLyphsDrawExpressTrack(glyphTrack);
  } else {
    gLyphsDrawFeatureTrack(glyphTrack);
  }
  gLyphsCreateMoveBar(glyphTrack);
  //console.log('finished gLyphsDrawTrack ' + trackID);
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
  //console.log("gLyphsParseFeatureTrackData[ "+glyphTrack.trackID+" "+xhrObj.trackID+"]");

  if(!glyphTrack.glyphs_array) { glyphTrack.glyphs_array = new Array(); }
  glyphTrack.glyphs_array = [];

  if(!glyphTrack.feature_array) { glyphTrack.feature_array = new Array(); }
  glyphTrack.feature_array = [];
  glyphTrack.features = new Object();
  glyphTrack.total_obj_count = 0;

  if(!glyphTrack.edge_array) { glyphTrack.edge_array = new Array(); }
  glyphTrack.edge_array = [];

  if(!glyphTrack.experiments) { glyphTrack.experiments = new Object(); }
  if(!glyphTrack.datasources) { glyphTrack.datasources = new Object(); }
  if(!glyphTrack.datatypes)   { glyphTrack.datatypes = new Object(); }
  glyphTrack.experiment_array = new Array();
  
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

  //var cnt=0;
  //for(var expID in glyphTrack.experiments){ cnt++; }
  //console.log("gLyphsParseFeatureTrackData ["+glyphTrack.trackID+"] "+cnt +" experiment ids (before parsing)");

  glyphTrack.security_error = "";
  var security_error = xmlDoc.getElementsByTagName("security_error");
  if(security_error && security_error.length>0) {
    glyphTrack.security_error = security_error[0].getAttribute("blocked");
    /* new code not finished
    //TODO: deactivate the blocked experiments
    gLyphsCacheSources(glyphTrack);  //original per-track source cache system
    var blocked = xmlDoc.getElementsByTagName("blocked");
    glyphTrack.blocked_sources = new Object();
    for(var i=0; i<blocked.length; i++) {
      var expID = blocked[i].getAttribute("id");
      glyphTrack.blocked_sources[expID] = true;
    }
    */
    return;
  }

  // get the experiments for this track
  glyphTrack.datasource_mode = "feature"; //reset
  var sources_node = xmlDoc.getElementsByTagName("sources");
  if(sources_node && sources_node.length>0) {
    sources_node = sources_node[0];
    var sources_children = sources_node.childNodes;
    //console.log("found sources block. has "+sources_children.length+" children");
    for (var i = 0; i < sources_children.length; i++) {
      var sourceDOM = sources_children[i]

      if(sourceDOM.tagName == "featuresource") {
        var srcID = sourceDOM.getAttribute("id");
        var source = glyphTrack.datasources[srcID];
        if(!source) {
          var source = new Object;
          source.uuid = srcID;
          glyphTrack.datasources[srcID] = source;
        }
        eedbParseFeatureSourceData(sourceDOM, source);
      }
      if(sourceDOM.tagName == "edgesource") {
        var srcID = sourceDOM.getAttribute("id");
        var source = glyphTrack.datasources[srcID];
        if(!source) {
          var source = new Object;
          source.uuid = srcID;
          glyphTrack.datasources[srcID] = source;
        }
        eedbParseEdgeSourceXML(sourceDOM, source);
        glyphTrack.datasource_mode = "edge";
      }
      if(sourceDOM.tagName == "experiment") {
        var expID = sourceDOM.getAttribute("id");
        //console.log("parse top level experiment "+expID);
        var source = glyphTrack.experiments[expID];
        if(!source) {
          source = new Object();
          source.id = expID;
          eedbParseExperimentData(sourceDOM, source);
          //eedbParseMetadata(sourceDOM, source);
          source.mdata_loaded = false;
          glyphTrack.experiments[expID] = source;
        } else {
          //console.log("gLyphsParseFeatureTrackData "+glyphTrack.trackID+" exp "+expID+" already exists");
          eedbParseExperimentData(sourceDOM, source);
          //eedbParseMetadata(sourceDOM, source);
        }
        glyphTrack.datasources[expID] = source;
        //subsource logic: move subsources up to the track.experiments, overwrite as needed since these can be generated dynamically and change based on location 
        if(source.subsources) {
          var sub_id_count=0;
          for(var subID in source.subsources) {
            var subsource = source.subsources[subID];
            glyphTrack.experiments[subID] = subsource;
            sub_id_count++;
          }
          //console.log("experiment "+expID+" has "+sub_id_count+" subsources");
        }
      }
    }
  }

  //var cnt=0;
  //for(var expID in glyphTrack.experiments){ cnt++; }
  //console.log("gLyphsParseFeatureTrackData ["+glyphTrack.trackID+"] "+cnt +" experiment ids (before loading features)");

  if(glyphTrack.search_select_filter) { console.log("parse feature data with search_select_filter ["+glyphTrack.search_select_filter+"]"); }
  // get the top features from the XML
  // TODO look into alternate method here. this will grab all features
  //  and then I need to figure out if it is top or not. maybe can use children()
  var xml_features = xmlDoc.getElementsByTagName("feature");
  glyphTrack.strandless = true; //new dynamic code to decide if data is strandless or not
  var mode = "full";
  var dtype = "";
  var feat_idx=0;
  for(var i=0; i<xml_features.length; i++) {
    var featureXML = xml_features[i];
    if(featureXML.parentNode.tagName != "region") { continue; }
    var feature = null;;
    if(mode == "full") {
      feature = convertFullFeatureXML(glyphTrack, featureXML);
      if(glyphTrack.source_outmode == "full_feature") { feature.full_load=true; }
    } else {
      feature = convertFeatureXML(glyphTrack, featureXML);
    }
    if(feature) {
      feature.trackID = glyphTrack.trackID;
      feature.fidx = feat_idx++;
      feature.filter_valid = true;
      feature.search_match = false;
      glyphTrack.total_obj_count++;
      glyphTrack.feature_array.push(feature);
      if(feature.id) { glyphTrack.features[feature.id] = feature; }

      if(feature.subfeatures) { 
        glyphTrack.has_subfeatures=true; 
        glyphTrack.total_obj_count += feature.subfeatures.length;
      }
      if(feature.expression)  { 
        glyphTrack.has_expression = true;
        glyphTrack.total_obj_count += feature.expression.length;
        for(var j=0; j<feature.expression.length; j++) {
          var expression = feature.expression[j];
          //glyphTrackAddDatatypeColumn(glyphTrack, expression.datatype, expression.datatype, true, "signal");
          var dtype_col = glyphTrackAddDatatypeColumn(glyphTrack, expression.datatype, expression.datatype, true, "signal");
          dtype_col.col_type = "signal";
          if(!glyphTrack.experiments[expression.expID]) { 
            glyphTrack.experiments[expression.expID] = new Object(); 
          }
          if(!dtype) { dtype = expression.datatype; }
        }        
      }
      //color mdata postprocess
      if(glyphTrack.color_mdkey!="bed:itemRgb") {
        if(feature.mdata[glyphTrack.color_mdkey]) {
          feature.color = feature.mdata[glyphTrack.color_mdkey][0];
        } else {
          feature.color = "black"; //specified mdkey, but not present so default to black
        }
      }
      
      if(glyphTrack.search_select_filter) {
        gLyphsTrackSearchTestObject(glyphTrack, feature);
      }
      else if(glyphTrack.glyphsGB.selected_feature) {
        if(glyphTrack.glyphsGB.selected_feature.id == feature.id) {
          console.log(glyphTrack.trackID+" found matching selected_feature to glyphsGB "+glyphTrack.glyphsGB.selected_feature.id);
          glyphTrack.selected_feature = feature;
          feature.search_selected = true;
        }
      }
      else if(glyphTrack.selected_feature && (glyphTrack.selected_feature.id == feature.id)) {
        console.log(glyphTrack.trackID+" found matching selected_feature to glyphsTrack");
        glyphTrack.selected_feature = feature;
        feature.search_selected = true;
      }
      if(feature.strand=="+" || feature.strand=="-") { glyphTrack.strandless=false; }
    }
  }
  //glyphTrack.search_select_filter = ""; //clear search_select_filter after used
  if(glyphTrack.feature_array.length==0) { glyphTrack.strandless=false; }
  //console.log("gLyphsParseFeatureTrackData ["+glyphTrack.trackID+"]read "+glyphTrack.feature_array.length +" features");
  
  //read the edges
  var children = xmlDoc.childNodes;
  var first_edge=true;
  for (var i = 0; i < children.length; i++) {
    var childDOM = children[i]
    if(!childDOM.tagName) { continue; }
    //console.log("child tagName ["+childDOM.tagName+"]");
    if(childDOM.tagName != "edge") { continue; }
    var edge = eedbParseEdgeXML(childDOM);
    if(!edge) { continue; }
    
    if(first_edge) {
      glyphTrackAddDatatypeColumn(glyphTrack, "f1.name", "name", true);
      glyphTrackAddDatatypeColumn(glyphTrack, "f1.category", "category", false);
      glyphTrackAddDatatypeColumn(glyphTrack, "f1.source_name", "source_name", false);
      glyphTrackAddDatatypeColumn(glyphTrack, "f1.location_link", "location", false);
      glyphTrackAddDatatypeColumn(glyphTrack, "f1.location_string", "location", false);
      
      glyphTrackAddDatatypeColumn(glyphTrack, "f2.name", "name", true);
      glyphTrackAddDatatypeColumn(glyphTrack, "f2.category", "category", false);
      glyphTrackAddDatatypeColumn(glyphTrack, "f2.source_name", "source_name", false);
      glyphTrackAddDatatypeColumn(glyphTrack, "f2.location_link", "location", false);
      glyphTrackAddDatatypeColumn(glyphTrack, "f2.location_string", "location", false);
      first_edge=false;
    }
  
    glyphTrack.edge_array.push(edge);
    edge.trackID = glyphTrack.trackID;
    edge.filter_valid = true;
    edge.search_match = false;
    //connect datasource and features
    if(glyphTrack.datasources[edge.source_id]) { 
      edge.source = glyphTrack.datasources[edge.source_id];
    }
    if(glyphTrack.features[edge.feature1_id]) { 
      edge.feature1 = glyphTrack.features[edge.feature1_id];
      edge.feature1.f1_edge_count++;
      for(var tag in edge.feature1.mdata) { //new common mdata[].array system
        if(tag=="keyword") { continue; }
        if(tag=="eedb:display_name") { continue; }
        var dtype = "f1."+tag;
        var t_col = glyphTrackAddDatatypeColumn(glyphTrack, dtype, tag);
      }
      //feature1.expression.data_types
      if(edge.feature1.expression) {
        for(var eidx=0; eidx<edge.feature1.expression.length; eidx++) {
          var expr = edge.feature1.expression[eidx];
          if(!expr) { continue; }
          if(!expr.datatype) { continue; }
          var dtype = "f1."+expr.datatype;
          var dtype_col = glyphTrackAddDatatypeColumn(glyphTrack, dtype, expr.datatype, false);
          dtype_col.col_type = "signal";
          if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
            dtype_col.min_val = expr.total;
            dtype_col.max_val = expr.total;
          }
          if(expr.total < dtype_col.min_val) { dtype_col.min_val = expr.total; }
          if(expr.total > dtype_col.max_val) { dtype_col.max_val = expr.total; }
        }
      }
    }
    if(glyphTrack.features[edge.feature2_id]) { 
      edge.feature2 = glyphTrack.features[edge.feature2_id];
      edge.feature2.f2_edge_count++;
      //console.log("connect edge.feature2 ["+edge.feature2_id+"] name["+edge.feature2.name+"]");
      for(var tag in edge.feature2.mdata) { //new common mdata[].array system
        if(tag=="keyword") { continue; }
        if(tag=="eedb:display_name") { continue; }
        var dtype = "f2."+tag;
        var t_col = glyphTrackAddDatatypeColumn(glyphTrack, dtype, tag);
      }
      //feature2.expression.data_types
      if(edge.feature2.expression) {
        for(var eidx=0; eidx<edge.feature2.expression.length; eidx++) {
          var expr = edge.feature2.expression[eidx];
          if(!expr) { continue; }
          if(!expr.datatype) { continue; }
          var dtype = "f2."+expr.datatype;
          var dtype_col = glyphTrackAddDatatypeColumn(glyphTrack, dtype, expr.datatype, false);
          dtype_col.col_type = "signal";
          if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
            dtype_col.min_val = expr.total;
            dtype_col.max_val = expr.total;
          }
          if(expr.total < dtype_col.min_val) { dtype_col.min_val = expr.total; }
          if(expr.total > dtype_col.max_val) { dtype_col.max_val = expr.total; }
        }
      }
    }
    
    for(var dtype in edge.weights) {
      var weights = edge.weights[dtype];
      if(!weights) { continue; }
      var dtype_col = glyphTrackAddDatatypeColumn(glyphTrack, dtype, dtype, true);
      dtype_col.col_type = "weight";
      if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
        dtype_col.min_val = weights[0].weight;
        dtype_col.max_val = weights[0].weight;
      }
      for(var j=0; j<weights.length; j++) {
        var w1 = weights[j].weight;
        if(w1 < dtype_col.min_val) { dtype_col.min_val = w1; }
        if(w1 > dtype_col.max_val) { dtype_col.max_val = w1; }
      }
    }

    glyphTrack.edge_array.push(edge);
  }
  
  if(glyphTrack.edge_array.length >0) { glyphTrack.datasource_mode = "edge"; }
  console.log("gLyphsParseFeatureTrackData ["+glyphTrack.trackID+"] "+glyphTrack.feature_array.length +" features; "+ glyphTrack.edge_array.length +" edges");

  // get the experiments for this track
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
  
  //track total sums
  glyphTrack.express_total_sense_sum = 0;
  glyphTrack.express_total_antisense_sum = 0;

  if(glyphTrack.has_expression && (!glyphTrack.datatypes[glyphTrack.datatype])) { glyphTrack.datatype = dtype; }
}


function glyphTrackAddDatatypeColumn(glyphTrack, dtype, title, visible, col_type) {
  if(!glyphTrack) { return; }
  
  if(!glyphTrack.dtype_columns) { glyphTrack.dtype_columns = new Array; }
  if(!glyphTrack.datatypes) { glyphTrack.datatypes = new Object(); }

  var dtype_col = glyphTrack.datatypes[dtype];
  if(!dtype_col) {
    dtype_col = new Object;
    dtype_col.datatype = dtype;
    if(title) { dtype_col.title = title; }
    else { dtype_col.title = dtype; }
    dtype_col.colnum = glyphTrack.dtype_columns.length + 1;
    dtype_col.signal_order = glyphTrack.dtype_columns.length + 1;
    dtype_col.col_type = "mdata";
    if(col_type) { dtype_col.col_type = col_type; }
    dtype_col.visible = false;
    dtype_col.user_modifiable = false;    
    dtype_col.filtered = false;
    dtype_col.filter_abs = false;
    dtype_col.filter_min = "min";
    dtype_col.filter_max = "max";
    dtype_col.min_val = 0;
    dtype_col.max_val = 0;
    dtype_col.highlight_color = "";  //default is #EBEBEB" but leave empty unless different from default
    
    if(visible) { dtype_col.visible = true; }

    glyphTrack.datatypes[dtype] = dtype_col;
    glyphTrack.dtype_columns.push(dtype_col);
  }
  dtype_col.dtype_valid = true;
  return dtype_col;
}

/*
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
function feature_reverse_loc_sort_func(a,b) {
  if(a.end < b.end) { return 1; }
  if(a.end > b.end) { return -1; }
  if(a.start < b.start) { return 1; }
  if(a.start > b.start) { return -1; }
  return 0;
}
*/

function gLyphsRenderFeatureTrack(glyphTrack) {
  //this function converts the feature_array into glyphs SVG objects
  // as part of this process it will determine the tracking levels
  if(glyphTrack.feature_array == null) { return; }  //not an feature track

  if(!glyphTrack.glyphs_array) { glyphTrack.glyphs_array = new Array(); }
  glyphTrack.glyphs_array = [];
  var glyphs_array = glyphTrack.glyphs_array;
  
  if(glyphTrack.selected_feature) {
    if((glyphTrack.selected_feature.chrom != glyphTrack.glyphsGB.chrom) ||
       (glyphTrack.selected_feature.start > glyphTrack.glyphsGB.end) ||
       (glyphTrack.selected_feature.end < glyphTrack.glyphsGB.start)) {
      console.log(glyphTrack.trackID+" selected_feature "+(glyphTrack.selected_feature.id)+" ["+glyphTrack.selected_feature.name+"] off screen so unselect");
      glyphTrack.selected_feature = null;
      glyphTrack.search_select_filter = "";
    }
  }

  if((glyphTrack.colorMode == "signal") && (glyphTrack.featureSortMode=="signal")) {
    //sort the feature_array based on inverted score prior to determining levels
    glyphTrack.feature_array.sort(feature_score_sort_func);
    if(glyphTrack.scale_invert) { glyphTrack.feature_array.reverse(); }
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

  /*
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
        if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
        glyphTrack.maxlevels++;
      }
    }
  }
  */
  
  // get the top features from the XML
  //TODO look into alternate method here. this will grab all features
  //and then I need to figure out if it is top or not. maybe can use children()
  for(var i=0; i<features.length; i++) {
    var feature = features[i];
    //if(glyphTrack.has_expression && (feature.exp_total==0)) { continue; }
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



function convertFeatureXML(glyphTrack, featureXML) {
  var feature = eedbParseFeatureData(featureXML);  //from eedb_search.js
  if(!feature.chromloc && !feature.chrom) {
    feature.chromloc = glyphTrack.glyphsGB.asm.toLowerCase() +"::"+ glyphTrack.glyphsGB.chrom+":"+
                       feature.start +".."+ feature.end + feature.strand;
  }
  /*
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
    feature.chromloc = glyphTrack.glyphsGB.asm.toLowerCase() +"::"+ glyphTrack.glyphsGB.chrom+":"+
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
  */
  return feature;
}


function convertFullFeatureXML(glyphTrack, featureXML) {
  var feature = convertFeatureXML(glyphTrack, featureXML);

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
    //console.log(fname + " has " + (subfeats.length) +" subfs; ");
    var subfeatures_array = new Array();
    feature.subfeatures = subfeatures_array;
    for(var j=0; j<subfeats.length; j++) {
      var subfeatureXML = subfeats[j];
      var subf = convertFeatureXML(glyphTrack, subfeatureXML);
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

  for(var tag in feature.mdata) { //new common mdata[].array system
    glyphTrackAddDatatypeColumn(glyphTrack, tag, tag, true, "mdata");
  }
  
  return feature;
}


function gLyphsDrawFeatureTrack(glyphTrack) {
  var trackDiv      = glyphTrack.trackDiv;
  var glyphStyle    = glyphTrack.glyphStyle;
  var glyphs_array  = glyphTrack.glyphs_array;
  //console.log('gLyphsDrawFeatureTrack ' + glyphTrack.trackID + " "+glyphStyle);

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
  if(glyphStyle == "1D-heatmap") { levelHeight=glyphTrack.track_height; maxlevels=1; }
  if(glyphStyle == "medium-arrow") { levelHeight=6; }
  if(glyphStyle == "thin-arrow") { levelHeight=4; }
  if(glyphStyle == "exon") { levelHeight=6; }
  if(glyphStyle == "thick-box") { levelHeight=6; }
  if(glyphStyle == "probesetloc") { levelHeight=7; }
  if(glyphStyle == "thin") { levelHeight=3; }
  if(glyphStyle == "thin-box") { levelHeight=3; }
  if(glyphStyle == "seqalign") { levelHeight=8; }

  if(glyphStyle == "cytoband") { 
    levelHeight=34;
    glyphTrack.title = glyphTrack.glyphsGB.asm + " " + glyphTrack.glyphsGB.chrom +"  "+ 
                       glyphTrack.glyphsGB.start +".."+ glyphTrack.glyphsGB.end;
    if(glyphTrack.glyphsGB.flip_orientation) { glyphTrack.title += "-"; } else { glyphTrack.title += "+"; }
    glyphTrack.title += " " + glyphTrack.glyphsGB.length_desc;
    if((glyphTrack.glyphsGB.display_width / (glyphTrack.glyphsGB.end  - glyphTrack.glyphsGB.start)) > 5) {
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
  var dwidth = glyphTrack.glyphsGB.display_width;
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
  //console.log('track:' + sourceName + " fcnt: " + glyphs_array.length + " style:"+glyphStyle);
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
  if(!glyphTrack.glyphsGB.exportSVGconfig || glyphTrack.backColor) { 
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.id = "backRect_" + glyphTrack.trackID;
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '13px');
    backRect.setAttributeNS(null, 'width',  glyphTrack.glyphsGB.display_width+'px');
    backRect.setAttributeNS(null, 'height', (maxlevels*levelHeight)+'px');
    if(glyphTrack.backColor) { 
      backRect.setAttributeNS(null, 'style', 'fill: '+glyphTrack.backColor+';'); 
      if(glyphTrack.selected_feature) {
        //opacity*original + (1-opacity)*background = resulting pixel
        var rgb = new RGBColor(glyphTrack.backColor);
        var alpha = 0.8;
        rgb.r = alpha*rgb.r + (1-alpha)*220.0;
        rgb.g = alpha*rgb.g + (1-alpha)*220.0;
        rgb.b = alpha*rgb.b + (1-alpha)*220.0;
        colour = new RGBColour(rgb.r, rgb.g, rgb.b);
        backRect.style.fill = colour.getCSSHexadecimalRGB();
      }
    } else { 
      backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); 
    }
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
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
  selectRect.setAttributeNS(null, 'style', 'fill: rgba(150,150,150,0.4);');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  //g_select.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;

  // now the features
  for(var i=0; i<glyphs_array.length; i++) {
    var glyph = glyphs_array[i];
    if(!glyph) { continue; }
    var level   = glyph.glyph_level; 

    glyph.setAttributeNS(null, 'transform', "translate(0,"+ (2+level*levelHeight)+ ")");

    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
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
    var totalVal = glyphTrack.total_max_express.toFixed(2);
    if(totalVal>1) { totalVal = glyphTrack.total_max_express.toFixed(1); }

    if(Math.floor(revVal) == revVal) { revVal = Math.floor(revVal).toFixed(0); }
    if(Math.floor(fwdVal) == fwdVal) { fwdVal = Math.floor(fwdVal).toFixed(0); }
    if(Math.floor(totalVal) == totalVal) { totalVal = Math.floor(totalVal).toFixed(0); }

    var new_title = glyphTrack.title + " [rev:"+revVal+" fwd:"+fwdVal;
    if(glyphTrack.glyphStyle=="1D-heatmap") {
      new_title = glyphTrack.title + " [max:"+totalVal;
    }
    if((glyphTrack.scale_max_signal != "auto" || (glyphTrack.scale_min_signal!="auto"))) { 
      new_title += " scale:" + glyphTrack.scale_min_signal;; 
      new_title += " to " + glyphTrack.scale_max_signal; 
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
    var glyph1 = gLyphsDrawCytoSpan(glyphTrack, 23);
    g1.appendChild(glyph1);
    var glyph2 = gLyphsDrawChromScale(glyphTrack);
    g1.appendChild(glyph2);
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      glyph1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
      glyph1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      glyph1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      glyph2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
      glyph2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      glyph2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    }
    if(glyphTrack.glyphsGB.genome_sequence) {
      var glyph3 = gLyphsDrawChromSequence(glyphTrack);
      if(glyph3) { g1.appendChild(glyph3); }
    }
  }

  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    var trackLine = document.createElementNS(svgNS,'rect');
    trackLine.setAttributeNS(null, 'x', '0px');
    trackLine.setAttributeNS(null, 'y', '11px');
    trackLine.setAttributeNS(null, 'width',  '1px');
    trackLine.setAttributeNS(null, 'height', (maxlevels*levelHeight + 2)+'px');
    trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
    trackLine.setAttributeNS(null, 'opacity', "1");
    trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    //trackLine.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    trackLine.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    g1.appendChild(trackLine);
    glyphTrack.trackLine = trackLine;
    if(glyphTrack.glyphsGB.trackline_xpos) { trackLine.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.trackline_xpos)+'px'); } 
    if(glyphTrack.is_moving) { trackLine.setAttributeNS(null, 'opacity', "0"); }
  }

  g1.appendChild(selectRect);
  gLyphsDrawSelection(glyphTrack);

  tmp_svg.removeChild(g1);
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
  
  glyphsExpPanelRecalcAndDraw(glyphTrack);
  gLyphsDrawSelection(glyphTrack);
}


function gLyphsDrawFeature(glyphTrack, feature, glyphStyle) {
  var dwidth     = glyphTrack.glyphsGB.display_width;
  var chrom      = glyphTrack.glyphsGB.chrom;
  var start      = glyphTrack.glyphsGB.start;
  var end        = glyphTrack.glyphsGB.end;
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { end = glyphTrack.glyphsGB.chrom_length; }
  }
  var chromloc   = chrom +":" + start + ".." + end;

  if(!feature) { return null; }
  if(glyphStyle == "cytoband") { 
    //drawing whole chromosome
    start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { end = glyphTrack.glyphsGB.chrom_length; }
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
  if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }

  feature.xfs = xfs;
  feature.xfe = xfe;
  feature.xc  = xc;

  var colour = gLyphsTrackFeatureColour(glyphTrack, feature);

  var glyph = null;
  if(glyphStyle == "centroid") { glyph = gLyphsDrawCentroid(glyphTrack, feature, colour); } 
  if(glyphStyle == "thick-arrow") { glyph = gLyphsDrawThickFlatArrow(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "medium-arrow") { glyph = gLyphsDrawMediumArrow(glyphTrack, xfs, xfe, strand); xfs -= 6; xfe += 6; } 
  if(glyphStyle == "thin-arrow") { glyph = gLyphsDrawThinArrow(glyphTrack, feature, colour); }
  if(glyphStyle == "arrow") { glyph = gLyphsDrawThickFlatArrow(glyphTrack, xfs, xfe, strand); }
  //if(glyphStyle == "arrow") { glyph = gLyphsDrawArrow(xpos, strand); }
  if(glyphStyle == "cytoband") { glyph = gLyphsDrawCytoBand(glyphTrack, xfs, xfe, feature); } 
  if(glyphStyle == "box") { glyph = gLyphsDrawBox(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "subfeature") { glyph = gLyphsDrawBox(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "intron") { glyph = gLyphsDrawIntron(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "exon") { glyph = gLyphsDrawExon(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "thick-box") { glyph = gLyphsDrawExon(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "1D-heatmap") { glyph = gLyphsDrawExon(glyphTrack, xfs, xfe, strand, glyphTrack.track_height); } 
  if(glyphStyle == "thin-intron") { glyph = gLyphsDrawThinIntron(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "thin-exon") { glyph = gLyphsDrawThinExon(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "medium-exon") { glyph = gLyphsDrawMediumExon(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "utr") { glyph = gLyphsDrawUTR(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "medium-utr") { glyph = gLyphsDrawMediumUTR(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "thin") { glyph = gLyphsDrawThin(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "thin-box") { glyph = gLyphsDrawThin(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "line") { glyph = gLyphsDrawLine(glyphTrack, xfs, xfe, strand); } 
  if(glyphStyle == "seqtag") { glyph = gLyphsDrawSeqTag(glyphTrack, xpos, strand, feature); }
  if(glyphStyle == "seqalign") { glyph = gLyphsDrawSeqAlignment(glyphTrack, feature); }
  if(glyphStyle == "box-scorethick") { glyph = gLyphsDrawScoreThickBox(glyphTrack, feature); }
  if(glyphStyle == "experiment-heatmap") { glyph = gLyphsDrawExperimentHeatmap(glyphTrack, feature); }
  if(glyphStyle == "thin-transcript") { glyph = gLyphsDrawThinTranscript(glyphTrack, feature, colour); }
  if(glyphStyle == "thick-transcript") { glyph = gLyphsDrawTranscript(glyphTrack, feature, colour); }
  if(glyphStyle == "transcript") { glyph = gLyphsDrawTranscript(glyphTrack, feature, colour); }
  if(glyphStyle == "transcript2") { glyph = gLyphsDrawTranscript2(glyphTrack, feature, colour); }
  if(glyphStyle == "transcript-scorethick") { glyph = gLyphsDrawTranscriptScoreThick(glyphTrack, feature, colour); }
  
  if(!glyph) { return glyph; }

  if(glyphStyle!="utr" && glyphStyle!="medium-utr" && glyphStyle!="experiment-heatmap" ) {
    if(glyph.style.stroke) { glyph.style.stroke = colour.getCSSHexadecimalRGB(); }
    if(glyph.style.fill) { glyph.style.fill = colour.getCSSHexadecimalRGB(); }
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

    if(glyphTrack.glyphsGB.flip_orientation) { 
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
    if(glyphTrack.glyphsGB.flip_orientation) { //need to flip the text back  so it does not look like a mirror image
      //gt1.setAttributeNS(null, 'transform', "translate("+textWidth+", 0) scale(-1,1) translate(-"+text_pos+",0)");
      gt1.setAttributeNS(null, 'transform', "scale(-1,1) translate(-"+text_pos+",0)");
    } else {
      gt1.setAttributeNS(null, 'transform', "translate("+text_pos+",0)");
    }

    glyph.appendChild(gt1);
  }

  //simple hack to do the left-right flip_orientation to change whether pos strand is left-to-right or right-to-left
  if(glyphTrack.glyphsGB.flip_orientation) { 
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


function gLyphsTrackFeatureColour(glyphTrack, feature) {
  var colour = new RGBColour(0,0,0); //black 
  if(!glyphTrack) { return colour; }
  if(!feature) { return colour; }
  
  if(glyphTrack.colorMode=="signal") {
    var cr = 0;
    if(feature.score && glyphTrack.max_score) {
      var min = glyphTrack.min_score;
      var max = glyphTrack.max_score;
      if(glyphTrack.scale_min_signal != "auto") { min = glyphTrack.scale_min_signal; }
      if(glyphTrack.scale_max_signal != "auto") { max = glyphTrack.scale_max_signal; }      
      cr = (feature.score - min) / (max - min);
    }
    if(glyphTrack.has_expression && glyphTrack.total_max_express) { 
      var min = 0;
      var max = glyphTrack.total_max_express;
      if(glyphTrack.scale_min_signal != "auto") { min = glyphTrack.scale_min_signal; }
      if(glyphTrack.scale_max_signal != "auto") { max = glyphTrack.scale_max_signal; }      
      cr = (feature.exp_total - min) / (max - min); 
    }
    colour = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
  }
  if(glyphTrack.colorMode=="mdata") {
    if(feature.color) {
      var cl1 = new RGBColor(feature.color);
      colour = new RGBColour(cl1.r, cl1.g, cl1.b);
    }
  }
  if(glyphTrack.colorMode=="strand") {
    var color = glyphTrack.posStrandColor;
    if((!glyphTrack.glyphsGB.flip_orientation && (feature.strand == "-")) || 
       (glyphTrack.glyphsGB.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    }
    var cl1 = new RGBColor(color);
    colour = new RGBColour(cl1.r, cl1.g, cl1.b);
  }
  if(glyphTrack.glyphsGB.highlight_search && feature) {
    if(feature.name.indexOf(glyphTrack.glyphsGB.highlight_search) == -1) { colour = new RGBColour(211,211,211); } //lightgray 
    else { colour = new RGBColour(255,0,0); } //red
  }
  if(glyphTrack.selected_feature && (glyphTrack.glyphStyle!="1D-heatmap")) {
    if((glyphTrack.selected_feature.fidx !== undefined) && (glyphTrack.selected_feature.fidx == feature.fidx)) { 
      colour = new RGBColour(255,0,136); //slightly red deeppink
    } else if(glyphTrack.selected_feature.id && (glyphTrack.selected_feature.id == feature.id)) { 
      //colour = new RGBColour(255,0,225,0.5);
      //colour = new RGBColour(255,0,0); //red
      //colour = new RGBColour(255,20,147); //deeppink
      colour = new RGBColour(255,0,136); //slightly red deeppink
      //colour = new RGBColour(255,0,80); //deeppink
    } else if(feature.search_selected) { 
      colour = new RGBColour(255,0,136); //slightly red deeppink
    } else {
      //var hsl = colour.getHSL();
      //hsl.l = 100-((100 - hsl.l)*0.33);
      //hsl.s = hsl.s*0.5;
      //colour = new HSLColour(hsl.h, hsl.s, hsl.l);
      var rgb = colour.getRGB();
      var alpha = 0.5;
      //opacity*original + (1-opacity)*background = resulting pixel
      rgb.r = alpha*rgb.r + (1-alpha)*220.0;
      rgb.g = alpha*rgb.g + (1-alpha)*220.0;
      rgb.b = alpha*rgb.b + (1-alpha)*220.0;
      colour = new RGBColour(rgb.r, rgb.g, rgb.b);
    }
  }
  return colour;
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

  //track total sums
  glyphTrack.express_total_sense_sum = 0;
  glyphTrack.express_total_antisense_sum = 0;

  for(var j=0; j<feature.expression.length; j++) {
    var expression = feature.expression[j];
    var experiment = glyphTrack.experiments[expression.expID];
    if(!experiment) { continue; }
    if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }

    experiment.value           += expression.total;
    if(glyphTrack.glyphsGB.flip_orientation) {
      experiment.sense_value     += expression.antisense;
      experiment.antisense_value += expression.sense;
    } else {
      experiment.sense_value     += expression.sense;
      experiment.antisense_value += expression.antisense;
    }
  }
  
  gLyphsTrack_sort_experiment_expression(glyphTrack, glyphTrack.experiment_array, glyphTrack.express_sort_mode);
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

  //track total sums
  glyphTrack.express_total_sense_sum = 0;
  glyphTrack.express_total_antisense_sum = 0;

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
      if(glyphTrack.glyphsGB.flip_orientation) {
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

  for(var k=0; k<glyphTrack.experiment_array.length; k++) {
    var experiment = glyphTrack.experiment_array[k];
    if(!experiment) { continue; }
    if(experiment.hide) { continue; }

    glyphTrack.express_total_sense_sum += experiment.sense_value;
    glyphTrack.express_total_antisense_sum += experiment.antisense_value;
  }
  
  gLyphsTrack_sort_experiment_expression(glyphTrack, glyphTrack.experiment_array, glyphTrack.express_sort_mode);
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
  var dwidth      = glyphTrack.glyphsGB.display_width;
    
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
  
  var expressLine1 = document.createElementNS(svgNS,'path');
  if(glyphTrack.strandless) {
    expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
  } else {
    expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
  }
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  var expressLine2 = null;
  if(!glyphTrack.strandless) {
    expressLine2 = document.createElementNS(svgNS,'path');
    expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.revStrandColor+'; fill:'+glyphTrack.revStrandColor+";");
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
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

  var region_start = glyphTrack.glyphsGB.start; 
  var region_end   = glyphTrack.glyphsGB.end; 
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    region_start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { region_end = glyphTrack.glyphsGB.chrom_length; }
  }

  var points1 = "";
  var points2 = "";
  for(var i=0; i<features.length; i++) {
    var feature = features[i];
    if(!feature) { continue; }
    
    //determine positioning
    var xfs = dwidth*(feature.start-region_start-0.5)/(region_end-region_start); 
    var xfe = dwidth*(feature.end-region_start+0.5)/(region_end-region_start); 

    if(xfe < 0) { continue; }
    if(xfs > dwidth) { continue; }
    if(xfs<0) { xfs = 0; }
    if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }

    if(glyphTrack.glyphsGB.flip_orientation) {
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
    if(glyphTrack.strandless) {
      if(y_total>0) {
        //points1 += " M"+xpos+" "+(middle)+" L"+xpos+" "+(middle-1-y_total);
        points1 += " M"+xfs+" "+(middle)+" L"+xfs+" "+(middle-1-y_total);
        points1 += " L"+xfe+" "+(middle-1-y_total)+" L"+xfe+" "+middle;
      }
    } else {
      if(y_sense>0) {
        if(glyphTrack.glyphsGB.flip_orientation) {
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
        if(glyphTrack.glyphsGB.flip_orientation) {
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
  //console.log(points1);
  
  if(points1) { expressLine1.setAttributeNS(null, 'd', points1+" Z"); }
  if(points2 && !glyphTrack.strandless) { 
    expressLine2.setAttributeNS(null, 'd', points2+" Z");    
  }  
}


function gLyphsTrack_render_xyplot(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = glyphTrack.glyphsGB.display_width;
    
  glyphTrack.expressLine1 = null;
  glyphTrack.expressLine2 = null;
  if(glyphTrack.glyphStyle != "xyplot") { return; }

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;
  
  //
  // then generate the expression glyphs
  //
  var height = (glyphTrack.track_height) / 2.0;
  var middle = 12+ Math.floor(height);
  
  var strkw = "1px";
  
  var expressLine1 = document.createElementNS(svgNS,'g');
  if(glyphTrack.strandless) {
    expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
  } else {
    expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.posStrandColor+'; fill:'+glyphTrack.posStrandColor+";");
  }
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  var expressLine2 = null;
  if(!glyphTrack.strandless) {
    expressLine2 = document.createElementNS(svgNS,'g');
    expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+'; stroke:'+glyphTrack.revStrandColor+'; fill:'+glyphTrack.revStrandColor+";");
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
  }
  if(glyphTrack.xyplot_fill) {
    expressLine1.style.opacity = "0.75";
    expressLine1.style.strokeWidth = "1px";
    if(expressLine2) {
      expressLine2.style.opacity = "0.75";
      expressLine2.style.strokeWidth = "1px";
    }
  }

  glyphTrack.expressLine1 = expressLine1;
  glyphTrack.expressLine2 = expressLine2;
  
  var features = glyphTrack.feature_array;
  if(!features) { return; }
  //if(features.length == 0) { return; }

  var region_start = glyphTrack.glyphsGB.start; 
  var region_end   = glyphTrack.glyphsGB.end; 
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    region_start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { region_end = glyphTrack.glyphsGB.chrom_length; }
  }

  var points1 = "";
  var points2 = "";
  for(var i=0; i<features.length; i++) {
    var feature = features[i];
    if(!feature) { continue; }
    
    //determine positioning
    var xfs = dwidth*(feature.start-region_start)/(region_end-region_start); 
    var xfe = dwidth*(feature.end-region_start)/(region_end-region_start); 

    if(xfe < 0) { continue; }
    if(xfs > dwidth) { continue; }
    if(xfs<0) { xfs = 0; }
    if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }

    if(glyphTrack.glyphsGB.flip_orientation) {
      t_xfs = dwidth - xfe;
      t_xfe = dwidth - xfs;
      xfs = t_xfs;
      xfe = t_xfe;
    }
    
    var xpos;
    if(feature.strand == "+") {xpos = xfs;} else {xpos = xfe;}
        
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
    if(xfe-xfs<1) { xfe = xfs+1; }
    if(feature.exp_sense!=0) {
      var t_path = document.createElementNS(svgNS,'path');
      var points = "";
      points += " M"+(xfs.toFixed(1))+" "+ ((middle-y_sense).toFixed(1));
      points += " L"+(xfe)+" "+ ((middle-y_sense).toFixed(1));
      if(glyphTrack.xyplot_fill) {
          var mid = middle;
          if(y_sense<0) { mid += 1; } else { mid -= 1; }
          points += " L"+(xfe)+" "+mid;
          points += " L"+xfs+" "+mid + " Z";
      }
      t_path.setAttribute('d', points);
      if(glyphTrack.colorMode=="signal") {
        var min = -(glyphTrack.max_express);
        var max = glyphTrack.max_express;
        cr = (feature.exp_sense - min) / (max - min); 
        colour = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
        t_path.style.stroke = colour.getCSSHexadecimalRGB();
        t_path.style.fill = colour.getCSSHexadecimalRGB();
      }
      expressLine1.appendChild(t_path);
      
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        var msg = glyphTrack.glyphsGB.chrom+" "+feature.start+".."+feature.end;
        msg += "<br>signal : "+ feature.exp_sense;
        t_path.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\""+msg+"\",190);");
        t_path.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
    }
    if((feature.exp_antisense!=0) && (!glyphTrack.strandless)) {
      var t_path = document.createElementNS(svgNS,'path');
      var points = "";
      points += " M"+(xfs.toFixed(1))+" "+ ((middle-y_anti).toFixed(1));
      points += " L"+(xfe)+" "+ ((middle-y_anti).toFixed(1));
      if(glyphTrack.xyplot_fill) {
          var mid = middle;
          if(y_anti<0) { mid += 1; } else { mid -= 1; }
          points += " L"+(xfe)+" "+mid;
          points += " L"+xfs+" "+mid + " Z";
      }
      t_path.setAttributeNS(null, 'd', points);
      if(glyphTrack.colorMode=="signal") {
        var min = -(glyphTrack.max_express);
        var max = glyphTrack.max_express;
        cr = (feature.exp_antisense - min) / (max - min); 
        colour = gLyphsScoreColorSpace2(glyphTrack, cr, feature.strand);
        t_path.style.stroke = colour.getCSSHexadecimalRGB();
        t_path.style.fill = colour.getCSSHexadecimalRGB();
      }
      expressLine2.appendChild(t_path);

      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        var msg = glyphTrack.glyphsGB.chrom+" "+feature.start+".."+feature.end;
        msg += "<br>signal antisense: "+ feature.exp_antisense;
        t_path.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\""+msg+"\",190);");
        t_path.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
    }
  }
}


function gLyphsTrack_render_arc(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = glyphTrack.glyphsGB.display_width;
    
  glyphTrack.expressLine1 = null;
  glyphTrack.expressLine2 = null;
  if(glyphTrack.glyphStyle != "arc") { return; }

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;
  
  var middle = 12+ Math.floor(glyphTrack.track_height / 2.0);
  if(glyphTrack.strandless) { middle = 12+glyphTrack.track_height; }
  
  var strkw = "1px";
  
  var expressLine1 = document.createElementNS(svgNS,'g');
  expressLine1.setAttributeNS(null, 'style', 'stroke-width:'+strkw+";");
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  var expressLine2 = null;
  if(!glyphTrack.strandless) {
    expressLine2 = document.createElementNS(svgNS,'g');
    expressLine2.setAttributeNS(null, 'style', 'stroke-width:'+strkw+";");
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
  }
  if(glyphTrack.xyplot_fill) {
    expressLine1.style.opacity = "0.75";
    expressLine1.style.strokeWidth = "1px";
    if(expressLine2) {
      expressLine2.style.opacity = "0.75";
      expressLine2.style.strokeWidth = "1px";
    }
  }

  glyphTrack.expressLine1 = expressLine1;
  glyphTrack.expressLine2 = expressLine2;
  
  var obj_array = []
  obj_array = glyphTrack.feature_array;
  //if(features.length == 0) { return; }
  if(glyphTrack.datasource_mode=="edge") {
    obj_array = glyphTrack.edge_array;
    for(var i=0; i<obj_array.length; i++) {
      var edge = obj_array[i];
      if(!edge) { continue; }
      var f1 = edge.feature1;
      var f2 = edge.feature2;
      if(f1) { edge.start = (f1.start + f1.end) / 2; }
      if(f2) { edge.end = (f2.start + f2.end) / 2; }
    }
  }

  if(!obj_array) { return; }

  var region_start = glyphTrack.glyphsGB.start; 
  var region_end   = glyphTrack.glyphsGB.end; 
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    region_start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { region_end = glyphTrack.glyphsGB.chrom_length; }
  }
  
  //precalc xfs, xfe, xfm, arc_height
  var max_arc_height = 1;
  for(var i=0; i<obj_array.length; i++) {
    var feature = obj_array[i];
    if(!feature) { continue; }
    
    var xfs = dwidth*(feature.start-region_start)/(region_end-region_start); 
    var xfe = dwidth*(feature.end-region_start)/(region_end-region_start); 

    if(glyphTrack.glyphsGB.flip_orientation) {
      t_xfs = dwidth - xfe;
      t_xfe = dwidth - xfs;
      xfs = t_xfs;
      xfe = t_xfe;
    }
    if(xfe-xfs<0.5) { xfe = xfs+0.5; } //at least 0.5 pixels wide
    feature.xfs = xfs;
    feature.xfe = xfe;
    feature.xfm = (xfe + xfs) / 2.0;
       
    var arc_height = (xfe - xfs)/2.0;
    if(arc_height > height) { arc_height = height; }
    if(arc_height < 5) { arc_height = 5; }    
    if(arc_height > max_arc_height) { max_arc_height = arc_height; }
    feature.arc_height = arc_height;
  }
    
  for(var i=0; i<obj_array.length; i++) {
    var feature = obj_array[i];
    if(!feature) { continue; }
    
    var xfs = feature.xfs;
    var xfe = feature.xfe;
    var xfm = feature.xfm;
    var arc_height = feature.arc_height * (height / max_arc_height);
    if(glyphTrack.strandless) { arc_height = arc_height*2.0; }
  
    if(xfe < 0) { continue; }
    if(xfs > dwidth) { continue; }
       
    var colour = gLyphsTrackFeatureColour(glyphTrack, feature);

    // render into expression lines
    if(feature.strand != "-") {
      var t_path = document.createElementNS(svgNS,'path');
      t_path.style.stroke = colour.getCSSHexadecimalRGB();
      var points = " M "+(xfs.toFixed(1))+" "+ (middle).toFixed(1);
      points    += " Q "+(xfm)+" "+(middle-arc_height)+" "+(xfe.toFixed(1))+" "+ (middle).toFixed(1);
      if(glyphTrack.xyplot_fill) { 
        points += " Z"; 
        t_path.style.fill = colour.getCSSHexadecimalRGB(); 
      } else { 
        points += " Q "+(xfm)+" "+(middle-arc_height)+" "+(xfs.toFixed(1))+" "+ (middle).toFixed(1); 
        t_path.style.fill = "rgba(255,255,225,0)";
      }
      t_path.setAttribute('d', points);
      expressLine1.appendChild(t_path);
      
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        t_path.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
        t_path.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        t_path.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
        if(feature.fidx !== undefined) {
          t_path.setAttributeNS(null, "onmouseover", "gLyphsTrackFeatureInfo(\""+glyphTrack.trackID+"\", \""+(feature.fidx)+"\");");
          t_path.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+feature.fidx+"\");");
        } else if((feature.classname == "Feature") && feature.id) {
          t_path.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +(feature.id)+ "\");");
          t_path.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+feature.id+"\");"); 
//         } else if(feature.classname == "Edge") {
//           //if(feature.eidx) {
//           //  t_path.setAttributeNS(null, "onmouseover", "gLyphsTrackEdgeInfo(\""+glyphTrack.trackID+"\", \""+(feature.eidx)+"\");");
//           //}
//           t_path.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+feature.id+"\");"); 
        } else {
          t_path.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\");"); 
        }
      }
    }
    if((feature.strand == "-") && (!glyphTrack.strandless)) {
      var t_path = document.createElementNS(svgNS,'path');
      var points = " M"+(xfs.toFixed(1))+" "+ (middle).toFixed(1);
      points    += " Q "+(xfm)+" "+(middle+arc_height)+" "+(xfe)+" "+ (middle).toFixed(1);
      //if(glyphTrack.xyplot_fill) { points += " Z"; }
      t_path.setAttributeNS(null, 'd', points);
      t_path.style.stroke = colour.getCSSHexadecimalRGB();
      t_path.style.fill = "rgba(255,255,225,0)";
      expressLine2.appendChild(t_path);

      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        t_path.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" +glyphTrack.trackID+"\");");
        t_path.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        t_path.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
        if(feature.fidx !== undefined) {
          t_path.setAttributeNS(null, "onmouseover", "gLyphsTrackFeatureInfo(\""+glyphTrack.trackID+"\", \""+(feature.fidx)+"\");");
          t_path.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+feature.fidx+"\");");
        } else if(feature.id) {
          t_path.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +(feature.id)+ "\");");
          t_path.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \""+glyphTrack.trackID+"\", \""+feature.id+"\");"); 
        }
      }
    }
  }
}


function gLyphsTrack_render_experiment_heatmap(glyphTrack) {
  if(!glyphTrack) { return; }
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = glyphTrack.glyphsGB.display_width;
  
  var starttime = new Date();

  glyphTrack.expressLine1 = null;
  glyphTrack.expressLine2 = null;
  //if(glyphTrack.glyphStyle != "experiment-heatmap") { return; }

  var height = glyphTrack.track_height;
  if(!height) { height = 3; }
  if(height < 1) { height = 1; }
  glyphTrack.track_height = height;
  
  var features = glyphTrack.feature_array;
  if(!features) { return; }

  //need to precalc the experiment.value to make the grouping work, but without selection
//   var selection = glyphTrack.selection;
//   glyphTrack.selection = null;
   processFeatureRegionExperiments(glyphTrack);
//   glyphTrack.selection = selection;

  var exp_group_array = [];
  if(glyphTrack.glyphStyle == "1D-heatmap") {
    var expr_group = new Object;
    expr_group.mdvalue = "all experiments";
    expr_group.name = expr_group.mdvalue
    expr_group.experiment_hash = new Object;
    expr_group.experiment_count = 0;
    expr_group.hide = false;
    for(var expID in glyphTrack.experiments) {
      var experiment = glyphTrack.experiments[expID];
      if(!experiment) { continue; }
      if(experiment.hide) { continue; }
      if(!expr_group.experiment_hash[expID]) {
        expr_group.experiment_hash[expID] = experiment;
        expr_group.experiment_count++;
      }
    }
    exp_group_array = [expr_group];
    console.log("gLyphsTrack_render_experiment_heatmap("+glyphTrack.trackID+") 1D-heatmap with "+expr_group.experiment_count+" experiments");
  } else {
    exp_group_array = gLyphsTrackCalcExperimentGroupArray(glyphTrack);
  }
  console.log("gLyphsTrack_render_experiment_heatmap("+glyphTrack.trackID+") "+(exp_group_array.length)+" exp_groups, "+(features.length)+" features");
  glyphTrack.experiment_group_array = exp_group_array;

  glyphTrack.maxlevels=0;
  for(var i=0; i<exp_group_array.length; i++) {
    var expr_group = exp_group_array[i];
    if(!expr_group || expr_group.hide) { continue; }
    //if(glyphTrack.hide_zero && (expr_group.value==0)) { continue; }
    glyphTrack.maxlevels++;
  }
  glyphTrack.heatmap_height = (glyphTrack.maxlevels * glyphTrack.track_height);
  
  console.log("gLyphsTrack_render_experiment_heatmap("+glyphTrack.trackID+") maxlevels="+glyphTrack.maxlevels+" heatmap_height="+glyphTrack.heatmap_height);
  
  var region_start = glyphTrack.glyphsGB.start; 
  var region_end   = glyphTrack.glyphsGB.end; 
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    region_start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { region_end = glyphTrack.glyphsGB.chrom_length; }
  }

  var expressLine1 = document.createElementNS(svgNS,'g');
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  }
  glyphTrack.expressLine1 = expressLine1;
  
  var bar_height = glyphTrack.track_height;
  if(!glyphTrack.strandless) { bar_height /= 2; }
  if(!glyphTrack.strandless &&(glyphTrack.track_height>=12)) { bar_height = bar_height-0.5; }
  var level=0;
  for(var exp_idx=0; exp_idx<exp_group_array.length; exp_idx++) {
    var expr_group = exp_group_array[exp_idx];
    if(!expr_group || expr_group.hide) { continue; }
    //if(glyphTrack.hide_zero && (expr_group.value==0)) { continue; }

    expr_group.heatmap_group = document.createElementNS(svgNS,'g');
    expressLine1.appendChild(expr_group.heatmap_group);

    var level_y = 13+(level * glyphTrack.track_height);
    expr_group.heatmap_group.setAttribute("transform", "translate(0,"+level_y+")");
    //console.log("experiment_heatmap level:"+level+"  exp:"+expr_group.name);    
    level++;
    
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '0px');
    backRect.setAttributeNS(null, 'width',  glyphTrack.glyphsGB.display_width+'px');
    backRect.setAttributeNS(null, 'height', glyphTrack.track_height+'px');
    backRect.setAttributeNS(null, 'style', 'fill: rgba(255,255,255,0);'); //completely transparent
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      var msg = expr_group.name;
      backRect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('"+msg+"'); gLyphsTrackHighlightExperimentID(\""+glyphTrack.trackID+"\", \""+(expr_group.id)+"\");");
      backRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip(); gLyphsTrackHighlightExperimentID('"+glyphTrack.trackID+"');");
    }
    expr_group.heatmapBackRect = backRect;
    //expr_group.heatmap_group.appendChild(backRect);

    if(!glyphTrack.strandless &&(glyphTrack.track_height>=12)) {
      var middleLine = document.createElementNS(svgNS,'polyline');
      middleLine.setAttributeNS(null, 'style', 'stroke: darkgray; stroke-width: 1px');
      middleLine.setAttributeNS(null, 'points', "0,"+(bar_height+0.5)+" "+glyphTrack.glyphsGB.display_width+","+(bar_height+0.5));
      expr_group.heatmap_group.appendChild(middleLine);
    }
    
    //share backRect to the group experiments for gLyphsTrackHighlightExperimentID()
    if(expr_group.source_ids) { 
      for(var src_idx=0; src_idx<expr_group.source_ids.length; src_idx++) {
        var srcid = expr_group.source_ids[src_idx];
        var experiment = glyphTrack.experiments[srcid];
        if(!experiment) { continue; }
        experiment.heatmapBackRect = backRect;
      }
    }
    
    var min = 0;
    var max_total   = glyphTrack.total_max_express;
    var max_express = glyphTrack.max_express;
    if(glyphTrack.scale_min_signal != "auto") { 
      min = glyphTrack.scale_min_signal; 
    }
    if(glyphTrack.scale_max_signal != "auto") { 
      max_total   = glyphTrack.scale_max_signal; 
      max_express = glyphTrack.scale_max_signal; 
    }

    for(var feat_idx=0; feat_idx<features.length; feat_idx++) {
      var feature = features[feat_idx];
      if(!feature) { continue; }
      if(!feature.expression) { continue; }
      
      var xfs = dwidth*(feature.start-region_start-0.5)/(region_end-region_start); 
      var xfe = dwidth*(feature.end-region_start+0.5)/(region_end-region_start); 
      var xfw = (xfe-xfs);
      if(xfw<1) { xfw=1; }
      //if(xfs<0) { xfs = 0; }
      //if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }

      var total      = 0;
      var sense      = 0;
      var antisense  = 0;
      for(var j=0; j<feature.expression.length; j++) {
        var expression = feature.expression[j];
        if(!expr_group.experiment_hash && (expression.expID == expr_group.id)) { total = expression.total; break; }
                
        //check against the expr_group experiments to determine if 
        if(!expr_group.experiment_hash) { continue; }
        var experiment = expr_group.experiment_hash[expression.expID];
        if(!experiment) { continue; }
        if(experiment.hide) { continue; }
        if(glyphTrack.datatype && (expression.datatype != glyphTrack.datatype)) { continue; }
                
        //console.log("feature xfs="+xfs+"  xfe="+xfe+ "found matching experiment "+experiment.name+" in group "+expr_group.name);
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
          if(expression.total!=0.0 && (total==0 || (expression.total < total))) { total = expression.total; }
          if(expression.sense!=0.0 && (sense==0 || (expression.sense < sense))) { sense = expression.sense; }
          if(expression.antisense!=0.0 && (antisense==0 || (expression.antisense < antisense))) { antisense = expression.antisense; }
        }
      }
      if((glyphTrack.experiment_merge == "mean") && (expr_group.experiment_count > 0)) {
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

      if(feature.exp_total==0.0) { continue; }

      //from signal-histogram for reference
      //var y_total = (height*2* feature.exp_total) / glyphTrack.total_max_express;
      //var y_sense = (height * feature.exp_sense) / glyphTrack.max_express;
      //var y_anti = (height * feature.exp_antisense) / glyphTrack.max_express;
      
      //old experiment-heatmap use direct feature single expression matching experiment logic and glyphTrack.max_express_element;

      var cr_total = (feature.exp_total - min) / (max_total - min);
      var cr_sense = (feature.exp_sense - min) / (max_express - min);     
      var cr_anti  = (feature.exp_antisense - min) / (max_express - min);
    
      var cr = cr_total;
      if(!glyphTrack.strandless) { cr=cr_sense; }
      if(cr>=0.05) { //was 0.05
        var colour = gLyphsScoreColorSpace2(glyphTrack, cr);
        var block = document.createElementNS(svgNS,'rect');
        block.setAttribute('x', xfs);
        block.setAttribute('y', 0);
        block.setAttribute('width', xfw);
        block.setAttribute('height', bar_height);
        block.style.fill = colour.getCSSHexadecimalRGB();
        expr_group.heatmap_group.appendChild(block);
        // if(!glyphTrack.glyphsGB.exportSVGconfig) {
        //   var msg = expr_group.name + "<br>"+feature.exp_total;
        //   block.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('"+msg+"',300); \
        //       gLyphsTrackHighlightExperimentID(\""+glyphTrack.trackID+"\", \""+(expr_group.id)+"\");");
        //   block.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        // }
      }
      if(!glyphTrack.strandless) { 
        if(cr_anti>=0.05) { //was 0.05
          var colour = gLyphsScoreColorSpace2(glyphTrack, cr_anti);
          var block = document.createElementNS(svgNS,'rect');
          block.setAttribute('x', xfs);
          block.setAttribute('y', glyphTrack.track_height - bar_height);
          block.setAttribute('width', xfw);
          block.setAttribute('height', bar_height);
          block.style.fill = colour.getCSSHexadecimalRGB();
          expr_group.heatmap_group.appendChild(block);
        }
      }
    }    
    expr_group.heatmap_group.appendChild(backRect); //on top to create overlay dim
  } //exp_group_array loop
    
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("gLyphsTrack_render_experiment_heatmap("+glyphTrack.trackID+") "+(runtime)+"msec");
}


function gLyphsTrackHighlightExperimentID(trackID, expID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  if(!glyphTrack.experiment_array) { return; }
  if(!expID) { 
    gLyphsTrackHighlightExperiment(glyphTrack, null);
    return;
  }
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(!experiment) { continue; }
    if(experiment.id == expID) { gLyphsTrackHighlightExperiment(glyphTrack, experiment); }
  }
}

function gLyphsTrackHighlightExperiment(glyphTrack, experiment) {
  if(!glyphTrack) { return; }
  glyphTrack.highlight_experiment = experiment;

  var experiments = glyphTrack.experiment_array;
  if(!experiments) { return; }

  //first reset all
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    if(experiment.heatmapBackRect) {
      experiment.heatmapBackRect.setAttributeNS(null, 'style', 'fill: rgba(255,255,255,0);'); //reset to transparent
    }
    if(experiment.back_rect) { //from expPanel
      experiment.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
    if(experiment.mdgroup_back_rect) { //from expPanel
      experiment.mdgroup_back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }
  //then highlight
  if(glyphTrack.highlight_experiment) {
    if(glyphTrack.highlight_experiment.heatmapBackRect) {
      glyphTrack.highlight_experiment.heatmapBackRect.setAttributeNS(null, 'style', 'fill: rgba(220,220,220,0.33);');
    }
    if(glyphTrack.highlight_experiment.back_rect) { //from expPanel
      glyphTrack.highlight_experiment.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    }
    if(glyphTrack.highlight_experiment.mdgroup_back_rect) { //from expPanel
      glyphTrack.highlight_experiment.mdgroup_back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    }
  }
}


function gLyphsDrawExpressTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = glyphTrack.glyphsGB.display_width;
  
  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }
    
  var track_height = glyphTrack.track_height;
  if(!track_height) { track_height = 10; }
  if(glyphTrack.glyphStyle=="signal-histogram" && track_height < 20) { track_height = 20; }
  glyphTrack.track_height = track_height;
  if(glyphTrack.glyphStyle=="experiment-heatmap") { track_height = glyphTrack.heatmap_height; }
  
  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var svg = createSVG(glyphTrack.glyphsGB.display_width+10, 13+(track_height));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 13+(track_height);
  trackDiv.appendChild(svg);
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  var g1 = document.createElementNS(svgNS,'g');
  
  // make a backing rectangle to capture the selection events
  if(!glyphTrack.glyphsGB.exportSVGconfig || glyphTrack.backColor) {
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.id = "backRect_" + glyphTrack.trackID;
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '13px');
    backRect.setAttributeNS(null, 'width',  glyphTrack.glyphsGB.display_width+'px');
    backRect.setAttributeNS(null, 'height', track_height+'px');
    if(glyphTrack.backColor) { backRect.setAttributeNS(null, 'style', 'fill: '+glyphTrack.backColor+';'); }
    else { backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); }
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
  selectRect.setAttributeNS(null, 'height', track_height+'px');
  selectRect.setAttributeNS(null, 'style', 'fill: rgba(150,150,150,0.4);');
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  glyphTrack.selectRect = selectRect;
  
  
  //
  // then the expression lines
  //
  var middle = 12+ Math.floor(track_height / 2.0);
  if(glyphTrack.strandless) { middle = 12+track_height; }

  var expressLine1 = glyphTrack.expressLine1;
  var expressLine2 = glyphTrack.expressLine2;
  
  if(expressLine1) {
    g1.appendChild(expressLine1);
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      expressLine1.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine1.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine1.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    }
  }
  if(expressLine2) {
    g1.appendChild(expressLine2);
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
      expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");      
    }
    if(glyphTrack.glyphStyle!="experiment-heatmap") {
      var middleLine = g1.appendChild(document.createElementNS(svgNS,'polyline'));
      middleLine.setAttributeNS(null, 'style', 'stroke: darkgray; stroke-width: 1px');
      middleLine.setAttributeNS(null, 'points', "0,"+middle+" "+glyphTrack.glyphsGB.display_width+","+middle);
    }
  }
  
  var revVal = glyphTrack.anti_max_express.toFixed(3);
  if(revVal>2) { revVal = glyphTrack.anti_max_express.toFixed(2); }
  if(revVal>10) { revVal = glyphTrack.anti_max_express.toFixed(1); }
  if(Math.floor(revVal) == revVal) { revVal = Math.floor(revVal).toFixed(0); }
  
  var fwdVal = glyphTrack.sense_max_express.toFixed(3);
  if(fwdVal>2) { fwdVal = glyphTrack.sense_max_express.toFixed(2); }
  if(fwdVal>10) { fwdVal = glyphTrack.sense_max_express.toFixed(1); }
  if(Math.floor(fwdVal) == fwdVal) { fwdVal = Math.floor(fwdVal).toFixed(0); }

  new_title = title + " [rev:"+revVal+" fwd:"+fwdVal;

  if(glyphTrack.strandless) {
    var maxVal = glyphTrack.total_max_express.toFixed(3);
    if(maxVal>2) { maxVal = glyphTrack.total_max_express.toFixed(2); }
    if(maxVal>10) { maxVal = glyphTrack.total_max_express.toFixed(1); }
    if(Math.floor(maxVal) == maxVal) { maxVal = Math.floor(maxVal).toFixed(0); }
    new_title = title + " [max:"+maxVal;
  }
  
  //var scaleVal = glyphTrack.max_express.toFixed(2);
  //if(Math.floor(scaleVal) == scaleVal) { scaleVal = Math.floor(scaleVal).toFixed(0); }
  //scaleVal = Math.round(scaleVal / glyphTrack.experiment_array.length);
  
  //if((glyphTrack.max_express!=glyphTrack.anti_max_express) && (glyphTrack.max_express!=glyphTrack.sense_max_express)) {  
  //  new_title += " scale:"+scaleVal;
  //}
  if(glyphTrack.scale_max_signal != "auto") { new_title += " fixscale:" + glyphTrack.scale_max_signal; }
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
  
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    var trackLine = document.createElementNS(svgNS,'rect');
    trackLine.setAttributeNS(null, 'x', '0px');
    trackLine.setAttributeNS(null, 'y', '13px');
    trackLine.setAttributeNS(null, 'width',  '1px');
    trackLine.setAttributeNS(null, 'height', track_height+'px');
    trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
    trackLine.setAttributeNS(null, 'opacity', "1");
    trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    trackLine.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    g1.appendChild(trackLine);
    glyphTrack.trackLine = trackLine;
    if(glyphTrack.glyphsGB.trackline_xpos) { trackLine.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.trackline_xpos)+'px'); }
    if(glyphTrack.is_moving) { trackLine.setAttributeNS(null, 'opacity', "0"); }
  }
  
  if(glyphTrack.whole_chrom_scale) {
    var glyph1 = gLyphsDrawCytoSpan(glyphTrack, glyphTrack.track_height+13);
    g1.appendChild(glyph1);
  }

  g1.appendChild(selectRect);
  gLyphsDrawSelection(glyphTrack);
  
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
  
  glyphsExpPanelRecalcAndDraw(glyphTrack);
  gLyphsDrawSelection(glyphTrack);
}


//----------------------------------------------
//
// multi-split signal track
//
//----------------------------------------------

function gLyphsTrackCalcExperimentGroupArray(glyphTrack) {
  //used for split-signal and experiment-heatmap
  var group_array = new Array;    

  if(!glyphTrack) { return group_array; }

  var trackID     = glyphTrack.trackID;
    
  console.log("gLyphsTrackCalcExperimentGroupArray "+trackID);

  if(glyphTrack.exppanelmode == "mdgroup") {
    gLyphsTrackCalcMetadataGrouping(trackID); //new logic so I can safely call alwys, but I also must now to update with dynamic subsource
    if(glyphTrack.experiment_mdgrouping) { 
      console.log("gLyphsTrackCalcExperimentGroupArray "+trackID+" experiment_mdgrouping length = "+(glyphTrack.experiment_mdgrouping.length));
      for(var k=0; k<glyphTrack.experiment_mdgrouping.length; k++) {
        var mdgroup = glyphTrack.experiment_mdgrouping[k];
        if(!mdgroup) { continue; }
        if(mdgroup.source_count==0) { continue; }
        group_array.push(mdgroup);
      }
    }
  } else if(glyphTrack.exppanelmode == "ranksum") { 
    if(!glyphTrack.experiment_ranksum_enrichment) { return group_array; }
    for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
      var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
      if(glyphTrack.hide_deactive_exps && mdgroup.hide) { continue; }      
      if(glyphTrack.strandless) {
        if(Math.abs(mdgroup.value) < glyphTrack.ranksum_min_zscore) { continue; }
      } else {
        if((Math.abs(mdgroup.sense_value) < glyphTrack.ranksum_min_zscore) &&
           (Math.abs(mdgroup.antisense_value) < glyphTrack.ranksum_min_zscore)) { continue; }
      }
      group_array.push(mdgroup);
    }
  } else {
    if(!glyphTrack.experiment_array) { return group_array; }
    for(var k=0; k<glyphTrack.experiment_array.length; k++) {
      var experiment = glyphTrack.experiment_array[k];
      if(!experiment) { continue; }
      if(glyphTrack.hide_deactive_exps && experiment.hide) { continue; }      
      if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
      group_array.push(experiment);
    }    
  }
  console.log("group_array.length = " + group_array.length);  
  
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
    expr_group.experiment_hash = new Object;
    if(expr_group.classname == "Experiment") {
      expr_group.experiment_hash[expr_group.id] = expr_group;
      expr_group.experiment_count = 1;
    } else if(expr_group.source_ids) {    
      for(var j=0; j<expr_group.source_ids.length; j++) {
        var srcid = expr_group.source_ids[j];
        var experiment = glyphTrack.experiments[srcid];
        if(!experiment) { continue; }
        if(experiment.hide) { continue; }
        if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
        //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        //if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }  //this might not work here
        expr_group.experiment_hash[experiment.id] = experiment;
        expr_group.experiment_count++;
      }
    }
    
    var features = glyphTrack.feature_array;
    if(!features || features.length==0) { continue; }
    
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
        var experiment = expr_group.experiment_hash[expression.expID];
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
      
      feature.exp_total = total;
      feature.exp_sense = sense;
      feature.exp_antisense = antisense;      
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
    if(glyphTrack.scale_max_signal != "auto") {
      max_express = glyphTrack.scale_max_signal;
      total_max_express = glyphTrack.scale_max_signal;
    }    
  }  //group_array loop
  glyphTrack.max_express       = max_express;
  glyphTrack.total_max_express = total_max_express;
  glyphTrack.sense_max_express = sense_max_express;
  glyphTrack.anti_max_express  = anti_max_express;
  
  return group_array;
}


function gLyphsRenderSplitSignalTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = glyphTrack.glyphsGB.display_width;
    
  //console.log("gLyphsRenderSplitSignalTrack");

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;

  var region_start = glyphTrack.glyphsGB.start;
  var region_end   = glyphTrack.glyphsGB.end;
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    region_start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { region_end = glyphTrack.glyphsGB.chrom_length; }
  }
  
  var group_array = gLyphsTrackCalcExperimentGroupArray(glyphTrack);

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
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
          var experiment = expr_group.experiment_hash[expression.expID];
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
      var xfs = dwidth*(feature.start-region_start-0.5)/(region_end-region_start); 
      var xfe = dwidth*(feature.end-region_start+0.5)/(region_end-region_start); 
      
      if(xfe < 0) { continue; }
      if(xfs > dwidth) { continue; }
      if(xfs<0) { xfs = 0; }
      if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }
      
      if(glyphTrack.glyphsGB.flip_orientation) {
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
            if(glyphTrack.glyphsGB.flip_orientation) {
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
            if(glyphTrack.glyphsGB.flip_orientation) {
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
    //console.log(points1);
    
    if(points1) { expressLine1.setAttributeNS(null, 'd', points1+" Z"); }
    if(points2 && !glyphTrack.strandless) { 
      expressLine2.setAttributeNS(null, 'd', points2+" Z");    
    }  
  }
  console.log("gLyphsRenderSplitSignalTrack done");
}


function gLyphsDrawSplitSignalTrack(glyphTrack) {
  var trackDiv    = glyphTrack.trackDiv;
  var glyphStyle  = glyphTrack.glyphStyle;
  var trackID     = glyphTrack.trackID;
  var dwidth      = glyphTrack.glyphsGB.display_width;
  
  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }
  
  //console.log(" gLyphsDrawSplitSignalTrack");

  //this track style is dependant on the ExpressionPanel for sort order, so render first
  glyphsExpPanelRecalcAndDraw(glyphTrack);

  var group_array = new Array;    
  if(glyphTrack.exppanelmode == "mdgroup") {
    if(!glyphTrack.experiment_mdgrouping) { 
      gLyphsTrackCalcMetadataGrouping(trackID);
      if(!glyphTrack.experiment_mdgrouping) { return; } //failed to calc
    }
    gLyphsTrackCalcMetadataGroupingValues(glyphTrack); //recalc values and sorts
    for(var k=0; k<glyphTrack.experiment_mdgrouping.length; k++) {
      var mdgroup = glyphTrack.experiment_mdgrouping[k];
      if(!mdgroup) { continue; }
      if(mdgroup.source_count==0) { continue; }
      group_array.push(mdgroup);
    }
  } else if(glyphTrack.exppanelmode == "ranksum") { 
    if(!glyphTrack.experiment_ranksum_enrichment) { 
      //console.log(" no ranksum_enrichment");
      return; 
    }
    //maybe need to sort here
    for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
      var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
      if(glyphTrack.hide_deactive_exps && mdgroup.hide) { continue; }      
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
      //console.log(" no experiment_array");
      return; 
    }
    //maybe need to sort here
    for(var k=0; k<glyphTrack.experiment_array.length; k++) {
      var experiment = glyphTrack.experiment_array[k];
      if(!experiment) { continue; }
      if(glyphTrack.hide_deactive_exps && experiment.hide) { continue; }      
      if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
      group_array.push(experiment);
    }    
  }
  //console.log(" groups=" + group_array.length);  

  var height = glyphTrack.track_height;
  if(!height || height < 20) { height = 20; }
  glyphTrack.track_height = height;
  
  var group_height = height * group_array.length;
  
  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var svg = createSVG(glyphTrack.glyphsGB.display_width+10, 13+(group_height));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 13+(group_height);
  trackDiv.appendChild(svg);
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  var g1 = document.createElementNS(svgNS,'g');
  
  // make a backing rectangle to capture the selection events
  if(!glyphTrack.glyphsGB.exportSVGconfig || glyphTrack.backColor) {
    var backRect = document.createElementNS(svgNS,'rect');
    backRect.id = "backRect_" + glyphTrack.trackID;
    backRect.setAttributeNS(null, 'x', '0px');
    backRect.setAttributeNS(null, 'y', '13px');
    backRect.setAttributeNS(null, 'width',  glyphTrack.glyphsGB.display_width+'px');
    backRect.setAttributeNS(null, 'height', group_height+'px');
    if(glyphTrack.backColor) { backRect.setAttributeNS(null, 'style', 'fill: '+glyphTrack.backColor+';'); }
    else { backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); }
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
  selectRect.setAttributeNS(null, 'style', 'fill: rgba(150,150,150,0.4);');
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
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
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      if(glyphTrack.exppanelmode == "mdgroup") { 
        text1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
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
    groupLine.setAttributeNS(null, 'points', "0,"+ypos+" "+glyphTrack.glyphsGB.display_width+","+ypos);
    
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
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        expressLine2.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
        expressLine2.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
        expressLine2.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");      
      }    
      var middleLine = g1.appendChild(document.createElementNS(svgNS,'polyline'));
      middleLine.setAttributeNS(null, 'style', 'stroke: darkgray; stroke-width: 1px');
      middleLine.setAttributeNS(null, 'points', "0,"+middle+" "+glyphTrack.glyphsGB.display_width+","+middle);
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
  if(glyphTrack.scale_max_signal != "auto") { new_title += " fixscale:" + glyphTrack.scale_max_signal; }
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
  
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
  
  g1.appendChild(selectRect);
  gLyphsDrawSelection(glyphTrack);
  
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
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


function gLyphsDrawCentroid(glyphTrack, feature, colour) {
  var color = "black";
  if(colour) { color = colour.getCSSHexadecimalRGB(); }
 
  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', feature.xfs+',15 ' +feature.xfe+',15 ');
  block.setAttributeNS(null, 'style', 'stroke: '+color+'; stroke-width: 2px;');
  g2.appendChild(block);

  if(feature.xc>0 && feature.xc<glyphTrack.glyphsGB.display_width) {
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


/*
function gLyphsDrawThickArrow(start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }

  if(((strand == '+') || (strand == '')) && (end < glyphTrack.glyphsGB.display_width)) {
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
*/

function gLyphsDrawThickFlatArrow(glyphTrack, start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }

  if(((strand == '+') || (strand == '')) && (end < glyphTrack.glyphsGB.display_width)) {
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


function gLyphsDrawMediumArrow(glyphTrack, start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }

  if(((strand == '+') || (strand == '')) && (end < glyphTrack.glyphsGB.display_width)) {
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


function gLyphsDrawThinArrow(glyphTrack, feature, colour) {
  if(!feature || !glyphTrack) { return null; }
  
  var color = "black";
  if(colour) { color = colour.getCSSHexadecimalRGB(); }

  //feature group
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttribute('fill', 'none');
  
  //arrow head
  var xfs = feature.xfs;
  var xfe = feature.xfe;
  var strand = feature.strand;
  if(((strand == '+') || (strand == '')) && (xfe < glyphTrack.glyphsGB.display_width)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    xfe = xfe - 3;
    if(xfe<xfs) { xfe = xfs; }
    arrow.setAttributeNS(null, 'points', (xfe+3)+' 12,' +(xfe-3)+' 10,' +(xfe-3)+' 14');
    arrow.setAttribute('fill', color);
    g2.appendChild(arrow);
  }
  if(((strand == '-') || (strand == '')) && (xfs>0)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    xfs = xfs + 3;
    if(xfs>xfe) { xfs = xfe; }
    arrow.setAttributeNS(null, 'points', (xfs-3)+' 12,' +(xfs+3)+' 10,' +(xfs+3)+' 14');
    arrow.setAttribute('fill', color);
    g2.appendChild(arrow);
  }

  //thin line
  var path1 = document.createElementNS(svgNS,'path');
  path1.setAttribute('d', 'M'+xfs+' 12 L' +xfe+' 12');
  path1.setAttribute('stroke', color);
  path1.setAttribute('stroke-width', '1.5px');
  g2.appendChild(path1);

  return g2;
}

/*
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
*/


function gLyphsDrawSeqTag(glyphTrack, xpos, strand, feature) {
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


function gLyphsDrawBox(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 12.5,' +end+' 12.5,' +end+' 16.5,' +start+' 16.5');
  if(strand == '')  { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  g2.appendChild(block);
  return g2;
}

function gLyphsDrawLine(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',13.5 ' +end+',13.5 ');
  if(strand == '')  { g2.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.5px;'); }
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'stroke: green; stroke-width: 1.5px;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'stroke: purple; stroke-width: 1.5px;'); }
  g2.appendChild(block);
  return g2;
}


function gLyphsDrawIntron(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',13.5 ' +end+',13.5 ');
  block.setAttributeNS(null, 'style', 'stroke: red; stroke-width: 0.5px;');
  g2.appendChild(block);
  return g2;
}


function gLyphsDrawExon(glyphTrack, start, end, strand, height) {
  if(!height || height < 5) { height=5; }
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  //block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 15.5,' +start+' 15.5');
  //block.setAttributeNS(null, 'points', start+' 11,' +end+' 11,' +end+' 16,' +start+' 16');
  block.setAttribute('points', start+' 11,' +end+' 11,' +end+' '+(11+height)+',' +start+' '+(11+height));
  if(strand == '')  { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function gLyphsDrawMediumExon(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  //block.setAttributeNS(null, 'points', start+' 12,' +end+' 12,' +end+' 15,' +start+' 15');
  block.setAttributeNS(null, 'points', start+' 11.66,' +end+' 11.66,'+end+' 15.33,' +start+' 15.33');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function gLyphsDrawScoreThickBox(glyphTrack, feature) {
  var start = feature.xfs;
  var end = feature.xfe;
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var height = 10.0 * feature.score / glyphTrack.max_score + 1;
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',12.5 ' +end+',12.5 ');
  if(feature.strand == '') { block.setAttributeNS(null, 'style', 'stroke:dimgray; stroke-width:'+height+"px"); }
  if(feature.strand == '+') { block.setAttributeNS(null, 'style', 'stroke:green; stroke-width:'+height+"px"); }
  if(feature.strand == '-') { block.setAttributeNS(null, 'style', 'stroke:purple; stroke-width:'+height+"px"); }
  return block;
}

//old method, will deprecated and replaced with gLyphsTrack_render_experiment_heatmap
function gLyphsDrawExperimentHeatmap(glyphTrack, feature) {
  var start = feature.xfs;
  var end = feature.xfe;
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }

  if(!feature.expression) { return; }
  var experiments = glyphTrack.experiment_array;
  if(!experiments) { return; }

  var g2 = document.createElementNS(svgNS,'g');

  var level=0;
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    if(!experiment || experiment.hide) { continue; }
    //if(glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
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

    var min = 0;
    var max = glyphTrack.max_express_element;
    if(glyphTrack.scale_min_signal != "auto") { min = glyphTrack.scale_min_signal; }
    if(glyphTrack.scale_max_signal != "auto") { max = glyphTrack.scale_max_signal; }      
    var cr = (expression.total - min) / (max - min);
    //var cr = (expression.total -glyphTrack.scale_min_signal) / (glyphTrack.max_express_element - glyphTrack.scale_min_signal);
    if(cr<0.05) { continue; }
    var color = gLyphsScoreColorSpace2(glyphTrack, cr);

    var block = document.createElementNS(svgNS,'rect');
    block.setAttributeNS(null, 'x', start);
    block.setAttributeNS(null, 'y', 9+(level * glyphTrack.track_height));
    block.setAttributeNS(null, 'width',  (end-start));
    block.setAttributeNS(null, 'height', glyphTrack.track_height);

    if(!glyphTrack.glyphsGB.exportSVGconfig) {
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

function gLyphsDrawTranscript(glyphTrack, feature, colour) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = glyphTrack.glyphsGB.display_width;
  var start      = glyphTrack.glyphsGB.start;
  var end        = glyphTrack.glyphsGB.end;
    
  var color = "black";
  if(colour) { color = colour.getCSSHexadecimalRGB(); }

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
        if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }
        
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
      path2.setAttribute('d', intron_path);
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


function gLyphsDrawTranscript2(glyphTrack, feature, colour) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = glyphTrack.glyphsGB.display_width;
  var start      = glyphTrack.glyphsGB.start;
  var end        = glyphTrack.glyphsGB.end;
  
  var color = "black";
  if(colour) { color = colour.getCSSHexadecimalRGB(); }

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
        if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }
        
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


function gLyphsDrawThinTranscript(glyphTrack, feature, colour) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = glyphTrack.glyphsGB.display_width;
  var start      = glyphTrack.glyphsGB.start;
  var end        = glyphTrack.glyphsGB.end;
  
  var color = "black";
  if(colour) { color = colour.getCSSHexadecimalRGB(); }

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
        if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }
        
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

function gLyphsDrawTranscriptScoreThick(glyphTrack, feature, colour) {
  if(!feature || !glyphTrack) { return null; }
  
  var dwidth     = glyphTrack.glyphsGB.display_width;
  var start      = glyphTrack.glyphsGB.start;
  var end        = glyphTrack.glyphsGB.end;

  var thickness = (10.0 * feature.score / glyphTrack.max_score) + 4;

  var color = "black";
  if(colour) { color = colour.getCSSHexadecimalRGB(); }

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
        if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }
        
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
  if((glyphTrack.glyphsGB.display_width / (glyphTrack.glyphsGB.end  - glyphTrack.glyphsGB.start)) < 5) { 
    showseq = false;
  }
  
  var dwidth     = glyphTrack.glyphsGB.display_width;
  var start      = glyphTrack.glyphsGB.start;
  var end        = glyphTrack.glyphsGB.end;
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
    if((!glyphTrack.glyphsGB.flip_orientation && (feature.strand == "-")) || (glyphTrack.glyphsGB.flip_orientation && (feature.strand == "+"))) {
      color = glyphTrack.revStrandColor;
    } else {
      color = glyphTrack.posStrandColor;
    }
  }
  if(glyphTrack.glyphsGB.highlight_search && feature) {
    if(feature.name.indexOf(glyphTrack.glyphsGB.highlight_search) == -1) { color = "lightgray"; } 
    else { color = "red"; }
  }
  if(glyphTrack.selected_feature && (glyphTrack.selected_feature.id == feature.id)) {
    color = "rgba(255,0,225,0.5)";
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
        if(xfe > glyphTrack.glyphsGB.display_width) { xfe = glyphTrack.glyphsGB.display_width; }
        
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
   
    //console.log(" ("+cigar+")["); 
    if(cig_pos+3 < mymatch.length) {
      ciglen = parseInt(mymatch[cig_pos+1]);
      cigop  = mymatch[cig_pos+2];
      cig_pos += 3;
    }
    //console.log(" {"+ciglen+"-"+cigop+"}"); 
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

      var xfs  = dwidth*(pos - glyphTrack.glyphsGB.start)/length; 
      pos++;

      var tobj = document.createElementNS(svgNS,'text');
      //tobj.setAttributeNS(null, 'x',  (xfs-3) +'px');
      tobj.setAttributeNS(null, 'x',  '0px');
      tobj.setAttributeNS(null, 'y', '18px');
      tobj.setAttributeNS(null, "font-size","8px");
      tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
      tobj.setAttributeNS(null, "fill", 'black');

      var base = seqtag.charAt(x);

      if(glyphTrack.glyphsGB.genome_sequence) { //check against genome sequence for mismatches
        var refbase = glyphTrack.glyphsGB.genome_sequence.charAt(pos-start-1)
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
      if(glyphTrack.glyphsGB.flip_orientation) { //need to flip the text back  so it does not look like a mirror image
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
    //console.log("]"); 
  }

  return g2;
}



//----- atomic glyph drawing functions  --------
/*
function gLyphsDrawThinLine(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11.5 ' +end+',11.5 ');
  if(strand == '')  { g2.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.2px;'); }
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'stroke: green; stroke-width: 1.2px;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'stroke: purple; stroke-width: 1.2px;'); }
  g2.appendChild(block);
  return g2;
}
*/

function gLyphsDrawThinIntron(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11.5 ' +end+',11.5 ');
  block.setAttributeNS(null, 'style', 'stroke: red; stroke-width: 0.5px;');
  g2.appendChild(block);
  return g2;
}

function gLyphsDrawThinExon(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 10.5,' +end+' 10.5,' +end+' 12.5,' +start+' 12.5');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function gLyphsDrawUTR(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11,' +end+' 11,' +end+' 16,' +start+' 16');
  block.setAttributeNS(null, 'style', 'stroke: black; fill: none; stroke-width: 1.5px;');
  return block;
}

function gLyphsDrawMediumUTR(glyphTrack, start, end, strand) {
  if(start<0) { start = 0; }
  if(end > glyphTrack.glyphsGB.display_width) { end = glyphTrack.glyphsGB.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 15.5,' +start+' 15.5');
  block.setAttributeNS(null, 'style', 'stroke: black; fill: none; stroke-width: 1.5px;');
  return block;
}

function gLyphsDrawCytoBand(glyphTrack, start, end, feature) {
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
  if(glyphTrack.glyphsGB.flip_orientation) { //need to flip the text back  so it does not look like a mirror image
    tobj.setAttributeNS(null, 'text-anchor', 'end' );
    gt1.setAttributeNS(null, 'transform', "scale(-1,1) translate(-"+(1+start)+",0)");
  } else {
    tobj.setAttributeNS(null, 'text-anchor', 'start' );
    gt1.setAttributeNS(null, 'transform', "translate("+(1+start)+",0)");
  }

  g2.appendChild(gt1);

  //console.log(" ;"+name); 
  return g2;
}


function gLyphsDrawCytoSpan(glyphTrack, track_height) {
  var dwidth   = glyphTrack.glyphsGB.display_width;
  var fs       = glyphTrack.glyphsGB.start;
  var fe       = glyphTrack.glyphsGB.end;
  var start    = 0;
  var end      = glyphTrack.glyphsGB.chrom_length;

  var xfs = dwidth*(fs-start)/(end-start); 
  var xfe = dwidth*(fe-start)/(end-start); 

  if(glyphTrack.glyphsGB.flip_orientation) { 
    var t_xfs = dwidth - xfe;
    var t_xfe = dwidth - xfs;
    xfs = t_xfs;
    xfe = t_xfe;
  }

  var g2 = document.createElementNS(svgNS,'g');
  if(end) {
    var block = document.createElementNS(svgNS,'polygon');
    //block.setAttributeNS(null, 'points', xfs+' 11,' +xfe+' 11,' +xfe+' 23,' +xfs+' 23');
    block.setAttributeNS(null, 'points', xfs+' 11,' +xfe+' 11,' +xfe+' '+track_height+',' +xfs+' '+track_height);
    block.setAttributeNS(null, 'style', 'stroke:red; fill: none; stroke-width: 1.5px;');
    g2.appendChild(block);
  }
  return g2;
} 


function gLyphsDrawChromScale(glyphTrack) {
  var dwidth   = glyphTrack.glyphsGB.display_width;
  var start    = glyphTrack.glyphsGB.start;
  var end      = glyphTrack.glyphsGB.end;
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
    if(glyphTrack.glyphsGB.flip_orientation) { xfs = dwidth-xfs; }

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
  if(!glyphTrack.glyphsGB.genome_sequence) { return null; }
  if((glyphTrack.glyphsGB.display_width / (glyphTrack.glyphsGB.end  - glyphTrack.glyphsGB.start)) < 5) { return null; }

  var dwidth   = glyphTrack.glyphsGB.display_width;
  var start    = glyphTrack.glyphsGB.start;
  var end      = glyphTrack.glyphsGB.end;
  var length   = end-start;

  var g2 = document.createElementNS(svgNS,'g');

  for(x=0; x<length; x++) {
    var pos  = (Math.floor(start +  0.5) + x);
    var xfs  = dwidth*(pos-start)/length; 

    if(glyphTrack.glyphsGB.flip_orientation) { xfs = dwidth-xfs; }

    var tobj = document.createElementNS(svgNS,'text');
    tobj.setAttributeNS(null, 'x',  (xfs-3) +'px');
    tobj.setAttributeNS(null, 'y', '55px');
    tobj.setAttributeNS(null, "font-size","10px");
    tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    tobj.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    tobj.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    tobj.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");

    var base = glyphTrack.glyphsGB.genome_sequence.charAt(x)
    if(glyphTrack.glyphsGB.flip_orientation) { base = complement_base(base); }
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
  titleBar.setAttributeNS(null, 'width',  glyphTrack.glyphsGB.display_width+10+'px');
  titleBar.setAttributeNS(null, 'height', '11px');
  if(glyphTrack.trackID == glyphTrack.glyphsGB.active_trackID) { titleBar.setAttributeNS(null, 'style', 'fill: #DECAAF;'); } 
  else { titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;'); }
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    titleBar.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
    titleBar.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");");
    titleBar.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  }
  if((glyphTrack.glyphsGB.exportSVGconfig === undefined) || !glyphTrack.glyphsGB.exportSVGconfig.hide_titlebar) { 
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
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    obj.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
    obj.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");");
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
  if(selection.chrom_start == selection.chrom_end) { return; }

  var dwidth = glyphTrack.glyphsGB.display_width;
  var start  = glyphTrack.glyphsGB.start;
  var end    = glyphTrack.glyphsGB.end;
  var fs     = selection.chrom_start;
  var fe     = selection.chrom_end;
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { end = glyphTrack.glyphsGB.chrom_length; }
  }

  if(fs>fe) { var t=fs; fs=fe; fe=t; }

  var xfs   = dwidth*(fs-start-0.5)/(end-start);
  var xfe   = dwidth*(fe-start+0.5)/(end-start);
  var width = xfe-xfs+1;

  if(glyphTrack.glyphsGB.flip_orientation) { 
    t_xfs = dwidth-xfe; 
    t_xfe = dwidth-xfs; 
    xfs = t_xfs;
    xfe = t_xfe;
  }
  
  selection.xmiddle = 10 + (xfe + xfs)/2;

  selectRect.setAttributeNS(null, 'x', xfs+'px');
  selectRect.setAttributeNS(null, 'width',  width+'px');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    //show popup of the selection location
    var len = fe-fs+1;
    if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
    else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
    else { len += "bp"; }
    var msg = "selection "+len+"<br>"+glyphTrack.glyphsGB.chrom+" "+fs+".."+fe;
    msg += "<br>express total sense: "+ glyphTrack.express_total_sense_sum.toFixed(3);
    msg += "<br>express total antisense: "+ glyphTrack.express_total_antisense_sum.toFixed(3);
    selectRect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\""+msg+"\",190);");
    selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  createMagnifyRegionWidget(glyphTrack);
  createSelectionSequenceWidget(glyphTrack);
  createAnnotationWidget(glyphTrack);  //remove annotate feature for now
}


function gLyphsDrawThin(glyphTrack, start, end, strand) {
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

/*
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
        //if(bpname == "PuBuGn" && bpdepth=="9") { console.log(" "+rgb1); } 
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

  // middle-heat2
  var spec = new Object();
  spec.name = "middle-heat2";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  colorSpaces[spec.name] = spec;

  // divergent1
  var spec = new Object();
  spec.name = "divergent1";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(15, 199, 255));  //dark cyan
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(255, 0, 0));     //red
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

  //console.log("colorspace: " + colorSpc.colors.length);
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
  //console.log("ci: " + ci);
  //console.log(" ["+score+"] "+idx);

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
*/

function gLyphsScoreColorSpace2(glyphTrack, score, strand) {
  //score should be 0.0 to 1.0
  var colorspace = glyphTrack.colorspace;
  if(!colorspace) { colorspace = "fire1"; }

  var discrete = glyphTrack.colorspace_discrete;
  if(!discrete) { discrete = zenbuColorSpaces[colorspace].discrete; }

  var logscale = glyphTrack.logscale;
  if(glyphTrack.glyphStyle=="experiment-heatmap") { logscale=false; } //now calculated in score
  var invert = glyphTrack.scale_invert;

  //if in "sense-color" mode need to get the current posStrandColor and make new spectrum
  if(colorspace == "user-color") {
    zenbuColorSpaceSetUserColor(glyphTrack.signal_user_color);
  }
  if(colorspace == "sense-color") {
    var tcolor = colorSpaces[colorspace];
    if((!glyphTrack.glyphsGB.flip_orientation && (strand == "-")) || (glyphTrack.glyphsGB.flip_orientation && (strand == "+"))) {
      //anti-sense colors
      zenbuColorSpaceSetSenseColor(glyphTrack.revStrandColor);
    } else {
      //sense colors
      zenbuColorSpaceSetSenseColor(glyphTrack.posStrandColor);
    }
  }

  var color = zenbuScoreColorSpace(colorspace, score, discrete, logscale, invert); //leave discrete false
  return color;
}


/*
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
*/

function gLyphsColorSpaceOptions(glyphTrack) {
  var div1 = document.createElement('div');

  //add a color spectrum picker
  var uniqID = glyphTrack.trackID+"_signalCSI";
  var signalCSI = glyphTrack.signalCSI;
  if(!signalCSI) {
    signalCSI = zenbuColorSpaceInterface(uniqID);
    signalCSI.trackID = glyphTrack.trackID;
    signalCSI.colorspace = glyphTrack.colorspace;
    signalCSI.enableScaling = false;  //true
    signalCSI.gradientSegLen = 55;
    signalCSI.min_signal = glyphTrack.scale_min_signal;
    signalCSI.max_signal = glyphTrack.scale_max_signal;
    signalCSI.logscale = glyphTrack.logscale;        
    signalCSI.invert = glyphTrack.scale_invert;
    if(glyphTrack.signal_user_color) { signalCSI.single_color = glyphTrack.signal_user_color; }
    signalCSI.callOutFunction = gLyphsTrackSignalCSSIUpdate;
    signalCSI.style.marginLeft = "7px";
    glyphTrack.signalCSI = signalCSI;
  }
  zenbuColorSpaceSetSenseColor(glyphTrack.posStrandColor);
  
  zenbuColorSpaceInterfaceUpdate(uniqID);
  div1.appendChild(signalCSI);

  /*

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
  select.className = "dropdown";
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
  select.className = "dropdown";
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
  select.className = "dropdown";
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
  */
  
  //a scaling value input
  var div2 = div1.appendChild(document.createElement('div'));
  div2.setAttribute('style', "margin: 3px 1px 0px 7px;");
  var span4 = div2.appendChild(document.createElement('span'));
  //span4.setAttribute('style', "margin-left: 3px;");
  span4.innerHTML = "min signal: ";
  var minInput = div2.appendChild(document.createElement('input'));
  minInput.className = "sliminput";
  minInput.setAttribute('size', "5");
  minInput.setAttribute('type', "text");
  minInput.setAttribute('value', glyphTrack.scale_min_signal);
  minInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'scale_min_signal', this.value);");
  minInput.setAttribute("onmouseover", "eedbMessageTooltip('min signal: "+(glyphTrack.min_score)+"',130);");
  minInput.setAttribute("onmouseout", "eedbClearSearchTooltip();");

  var span4 = div2.appendChild(document.createElement('span'));
  span4.setAttribute('style', "margin-left: 3px;");
  span4.innerHTML = "max signal: ";
  var maxInput = div2.appendChild(document.createElement('input'));
  maxInput.className = "sliminput";
  maxInput.setAttribute('size', "5");
  maxInput.setAttribute('type', "text");
  maxInput.setAttribute('value', glyphTrack.scale_max_signal);
  maxInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'scale_max_signal', this.value);");
  maxInput.setAttribute("onmouseover", "eedbMessageTooltip('max signal: "+(glyphTrack.max_score)+"',130);");
  maxInput.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  if(glyphTrack.has_expression && glyphTrack.total_max_express) { 
    minInput.setAttribute("onmouseover", "eedbMessageTooltip('min signal: 0',130);");
    maxInput.setAttribute("onmouseover", "eedbMessageTooltip('max signal: "+(glyphTrack.total_max_express)+"',130);");
  }
  
  var span2 = div2.appendChild(document.createElement('span'));
  span2.setAttribute('style', "margin: 1px 2px 1px 3px;");
  span2.innerHTML = "experiment merge:";
  div2.appendChild(createExperimentMergeSelect(glyphTrack.trackID));

  return div1;
}


function gLyphsTrackSignalCSSIUpdate(uniqID, mode, param, value, altvalue) {
  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];
  if(zenbuCSI == null) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[zenbuCSI.trackID];
  if(glyphTrack == null) { return; }

  console.log("gLyphsTrackSignalCSSIUpdate "+uniqID+" "+glyphTrack.trackID+" mode:"+mode);
  reconfigTrackParam(glyphTrack.trackID, 'refresh');
}


function gLyphsColorMdataOptions(glyphTrack) {
  if(!glyphTrack) { return; }
  var div1 = document.createElement('div');

  var color_mdkey = glyphTrack.color_mdkey;
  if(glyphTrack.newconfig && glyphTrack.newconfig.color_mdkey !== undefined) {  color_mdkey = glyphTrack.newconfig.color_mdkey; }
  
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
  mdKeyInput.className = "sliminput";
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

function createHideTrackWidget(glyphTrack) {
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '10px');
  rect.setAttributeNS(null, 'height', '10px');
  rect.setAttributeNS(null, 'style', 'fill: white;  fill-opacity: 0.0;');

  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
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
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
      arrow.setAttributeNS(null, "onclick", "gLyphsToggleTrackHide(\"" +glyphTrack.trackID+ "\");");
      arrow.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"expand track\",80);");
      arrow.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    g1.appendChild(arrow);
  } else {
    var arrow = document.createElementNS(svgNS,'path');
    arrow.setAttributeNS(null, 'd', 'M1 3 L9 3 L5 7 Z');
    arrow.setAttributeNS(null, 'style', 'stroke: rgb(100,100,100); fill: rgb(100,100,100);');
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
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
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
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
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
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
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    line.setAttributeNS(null, "onclick", "removeTrack(\"" + trackID + "\");");
    line.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"delete track\",80);");
    line.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(line);

  g1.setAttributeNS(null, 'transform', "translate(" + glyphTrack.glyphsGB.display_width + ",0)");
  glyphTrack.top_group.appendChild(g1);
}


function createDuplicateTrackWidget(glyphTrack) {
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
  //if(glyphTrack.glyphStyle == "cytoband") { return; }

  var g1 = document.createElementNS(svgNS,'g');

  var rect1 = document.createElementNS(svgNS,'rect');
  rect1.setAttributeNS(null, 'x', '0');
  rect1.setAttributeNS(null, 'y', '0');
  rect1.setAttributeNS(null, 'width', '7');
  rect1.setAttributeNS(null, 'height', '5');
  //rect1.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  rect1.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray; fill:white;');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
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
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    rect2.setAttributeNS(null, "onclick", "gLyphsDuplicateTrack(\"" + glyphTrack.trackID + "\");");
    rect2.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"duplicate track\",80);");
    rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(rect2);

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.glyphsGB.display_width-30) + ",2)");
  glyphTrack.top_group.appendChild(g1);
}


function createDownloadWidget(glyphTrack) {
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
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
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "gLyphsTrackToggleSubpanel(\"" + trackID + "\", 'download');");
    rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"download data\",80);");
    rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(rect);

  var poly = document.createElementNS(svgNS,'polygon');
  poly.setAttributeNS(null, 'points', '4,2  7,2  7,5  9.5,5  5.5,9.5  1.5,5  4,5  4,2');
  //poly.setAttributeNS(null, 'fill', 'blue');
  poly.setAttributeNS(null, 'fill', 'gray');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    poly.setAttributeNS(null, "onclick", "gLyphsTrackToggleSubpanel(\"" + trackID + "\", 'download');");
    poly.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"download data\",80);");
    poly.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(poly);

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.glyphsGB.display_width-45) + ",0)");
  glyphTrack.top_group.appendChild(g1);
}



function gLyphsCreateMoveBar(glyphTrack) {
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_sidebar) { return; }

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphStyle == "signal-histogram") { }

  //uses the full svg document and creates a full height move bar
  var svg = glyphTrack.svg;
  if(!svg) { return; }
  var height = parseInt(svg.getAttributeNS(null, 'height'));

  var add_resize = false;
  if((glyphStyle=="signal-histogram" || glyphStyle=="xyplot" || glyphStyle=="arc" || glyphStyle=="1D-heatmap") && 
     (height>20)) { add_resize=true; }

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
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
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
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
      rect1.setAttributeNS(null, "onmousedown", "gLyphsResizeTrack(\"" + glyphTrack.trackID + "\");");
      rect1.setAttributeNS(null, "onmouseover", "this.style.cursor='ns-resize';");
    }
  }
}


function createMagnifyRegionWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }

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
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    circle.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  }
  g1.appendChild(circle);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'points', '3,6.5 8,11');
  line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray;');
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    line.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  }
  g1.appendChild(line);

  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  }

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.selection.xmiddle-5) + ",0)");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"magnify genomic region to selection\",115);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  glyphTrack.top_group.appendChild(g1);
}


function createAnnotationWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
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
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }

  var g1 = document.createElementNS(svgNS,'g');
  var circle = g1.appendChild(document.createElementNS(svgNS,'rect'));
  circle.setAttributeNS(null, 'x', '0px');
  circle.setAttributeNS(null, 'y', '1px');
  circle.setAttributeNS(null, 'width',  '16px');
  circle.setAttributeNS(null, 'height', '8px');
  circle.setAttributeNS(null, 'fill', '#F6F6F6');
  circle.setAttributeNS(null, 'stroke', 'gray');

  var obj = g1.appendChild(document.createElementNS(svgNS,'text'));
  obj.setAttributeNS(null, 'x', '3px');
  obj.setAttributeNS(null, 'y', '7px');
  obj.setAttributeNS(null, "font-size","7");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  obj.appendChild(document.createTextNode("seq"));

  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsTrackShowSelectionSequence(\""+ glyphTrack.trackID+"\");");
    g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.selection.xmiddle+5) + ",0)");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"get genome sequence of selection\",115);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  glyphTrack.top_group.appendChild(g1);
}


function gLyphsTrackShowSelectionSequence(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  if(!glyphTrack.selection) { 
    console.log("no selection so clear info panel");
    zenbuFeatureInfoEvent('close');
    return; 
  }
  console.log("gLyphsTrackShowSelectionSequence "+trackID);
  
  var strand = "+";
  if(glyphTrack.glyphsGB.flip_orientation) { strand = "-"; }

  eedbClearSearchTooltip();

  var feature = new Object;
  feature.asm = glyphTrack.glyphsGB.asm;
  feature.chrom = glyphTrack.selection.chrom;
  feature.start = glyphTrack.selection.chrom_start;
  feature.end = glyphTrack.selection.chrom_end;
  feature.strand = strand;
  feature.name = "current selection genome sequence";
  //feature.id = zenbuGenerateUUID();
  //feature.chrom_id = glyphTrack.glyphsGB.chrom_id;
  //feature.description = "";
  
  zenbuDisplayFeatureInfo(feature);
  zenbuFeatureInfoShowSequence(true);
}


function createConfigTrackWidget(glyphTrack) {
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }

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
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    line.setAttributeNS(null, "onclick", "gLyphsTrackToggleSubpanel(\"" + glyphTrack.trackID + "\", 'reconfig');");
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

  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.glyphsGB.display_width-15) + ",1)");
  glyphTrack.top_group.appendChild(g1);
}


//---------------------------------------------------------------
//
// track configuration / save
// 
//---------------------------------------------------------------


function glyphsSaveTrackConfig(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  eedbShowLogin();
  if(!current_user) {
    zenbuGeneralWarn("In order to save a track configuration, you must first log into ZENBU.", "Warning: Not logged into the ZENBU system");
    eedbLoginAction("login");
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
  if(current_user) {
    if(current_user.nickname) { name_span.innerHTML = current_user.nickname; }
    else { name_span.innerHTML = current_user.openID; }
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
  button1.className = "medbutton";
  button1.style.float = "left";
  button1.setAttribute("onclick", "glyphsSaveTrackConfigParam(\""+ trackID+"\", 'cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save track config");
  button2.className = "medbutton";
  button2.style.float = "right";
  button2.setAttribute("onclick", "glyphsSaveTrackConfigParam(\""+ trackID+"\", 'accept');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
  glyphTrack.glyphsSaveTrackConfig.interface = divFrame;
}


function glyphsSaveTrackConfigParam(trackID, param, value) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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


function glyphsTrack_expressionConfigXML(glyphTrack) {
  if(!glyphTrack) { return ""; }
  if(glyphTrack.spstream_mode != "expression") { return ""; }

  var overlap_mode = glyphTrack.overlap_mode;
  if(glyphTrack.newconfig && glyphTrack.newconfig.overlap_mode) { overlap_mode = glyphTrack.newconfig.overlap_mode; }

  var binning = glyphTrack.binning;
  if(glyphTrack.newconfig && glyphTrack.newconfig.binning) { binning = glyphTrack.newconfig.binning; }

  var binsize = glyphTrack.exprbin_binsize;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_binsize) { binsize = glyphTrack.newconfig.exprbin_binsize; }

  var strandless = glyphTrack.exprbin_strandless;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_strandless) { strandless = glyphTrack.newconfig.exprbin_strandless; }

  var add_count = glyphTrack.exprbin_add_count;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_add_count) { add_count = glyphTrack.newconfig.exprbin_add_count; }

  var subfeatures = glyphTrack.exprbin_subfeatures;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_subfeatures) { subfeatures = glyphTrack.newconfig.exprbin_subfeatures; }

  var flipstrand = glyphTrack.exprbin_flipstrand;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_flipstrand) { flipstrand = glyphTrack.newconfig.exprbin_flipstrand; }

  var spstreamXML = "<zenbu_script>\n";
  spstreamXML += "\t<stream_processing>\n";
  if(add_count) {
    spstreamXML += "\t\t<spstream module=\"AppendExpression\"/>\n";
  }
  if(flipstrand) {
    spstreamXML += "\t\t<spstream module=\"FlipStrand\"/>\n";
  }
  spstreamXML += "\t\t<spstream module=\"TemplateCluster\">\n";
  spstreamXML += "\t\t\t<overlap_mode>"+overlap_mode+"</overlap_mode>\n";
  spstreamXML += "\t\t\t<expression_mode>"+binning+"</expression_mode>\n";

  if(strandless) { spstreamXML += "\t\t\t<ignore_strand>true</ignore_strand>\n"; } 
  else { spstreamXML += "\t\t\t<ignore_strand>false</ignore_strand>\n"; }

  if(subfeatures) { spstreamXML += "\t\t\t<overlap_subfeatures>true</overlap_subfeatures>\n"; } 
  else { spstreamXML += "\t\t\t<overlap_subfeatures>false</overlap_subfeatures>\n"; }

  spstreamXML += "\t\t\t<side_stream>\n\t\t\t\t<spstream module=\"FeatureEmitter\">\n\t\t\t\t\t<fixed_grid>true</fixed_grid>\n";
  if(binsize) { spstreamXML += "\t\t\t\t\t<width>"+binsize+"</width>\n" }

  if(strandless) { spstreamXML += "\t\t\t\t\t<both_strands>false</both_strands>\n"; } 
  else { spstreamXML += "\t\t\t\t\t<both_strands>true</both_strands>\n"; } 

  spstreamXML += "\t\t\t\t</spstream>\n";
  spstreamXML += "\t\t\t</side_stream>\n";
  spstreamXML += "\t\t</spstream>\n";
  spstreamXML += "\t</stream_processing>\n";
  spstreamXML += "</zenbu_script>\n";

  return spstreamXML;
}


function glyphsGenerateTrackDOM(glyphTrack) {
  var doc = document.implementation.createDocument("", "", null);

  var trackDOM = doc.createElement("gLyphTrack");
  if(!glyphTrack) { return trackDOM; }
  
  if(glyphTrack.glyphsGB.active_trackID == glyphTrack.trackID) { trackDOM.setAttribute("active_track", "true"); }
  if(glyphTrack.expPanelActive) { trackDOM.setAttribute("expPanelActive", "true"); }
  trackDOM.setAttribute("title", glyphTrack.title);
  trackDOM.setAttribute("glyphStyle", glyphTrack.glyphStyle);
  if(glyphTrack.uuid) { trackDOM.setAttribute("uuid", glyphTrack.uuid); }
  if(glyphTrack.peerName) { trackDOM.setAttribute("peerName", glyphTrack.peerName); }
  if(glyphTrack.sources) { trackDOM.setAttribute("sources", glyphTrack.sources); }
  if(glyphTrack.source_ids) { 
    trackDOM.setAttribute("source_ids", glyphTrack.source_ids); 
    //var source_ids = trackDOM.appendChild(doc.createElement('source_ids'));
    //source_ids.appendChild(doc.createTextNode(glyphTrack.source_ids));
  }
  if(glyphTrack.hideTrack) { trackDOM.setAttribute("hide", 1); }
  if(glyphTrack.exptype) { trackDOM.setAttribute("exptype", glyphTrack.exptype); }
  if(glyphTrack.datatype) { trackDOM.setAttribute("datatype", glyphTrack.datatype); }
  if(glyphTrack.colorMode) { trackDOM.setAttribute("colorMode", glyphTrack.colorMode); }
  if(glyphTrack.featureSortMode) { trackDOM.setAttribute("featureSortMode", glyphTrack.featureSortMode); }
  if(glyphTrack.colorspace) { trackDOM.setAttribute("colorspace", glyphTrack.colorspace); }
  if(glyphTrack.colorMode == "signal") { trackDOM.setAttribute("scorecolor", glyphTrack.colorspace); } //backward compatible when scorecolor was a bool toggle and the colorspace, now is separate colorMode colorspace
  if(glyphTrack.signal_user_color) { trackDOM.setAttribute("signal_user_color", glyphTrack.signal_user_color); }
  if(glyphTrack.scale_invert) { trackDOM.setAttribute("scale_invert", glyphTrack.scale_invert); }
  if(glyphTrack.color_mdkey) { trackDOM.setAttribute("color_mdkey", glyphTrack.color_mdkey); }
  if(glyphTrack.noCache) { trackDOM.setAttribute("nocache", glyphTrack.noCache); }
  if(glyphTrack.noNameSearch) { trackDOM.setAttribute("noNameSearch", glyphTrack.noNameSearch); }
  if(glyphTrack.backColor) { trackDOM.setAttribute("backColor", glyphTrack.backColor); }
  if(glyphTrack.posStrandColor) { trackDOM.setAttribute("posStrandColor", glyphTrack.posStrandColor); }
  if(glyphTrack.revStrandColor) { trackDOM.setAttribute("revStrandColor", glyphTrack.revStrandColor); }
  if(glyphTrack.source_outmode) { trackDOM.setAttribute("source_outmode", glyphTrack.source_outmode); }
  if(glyphTrack.hide_zero) { trackDOM.setAttribute("hide_zero", glyphTrack.hide_zero); }
  if(glyphTrack.hide_deactive_exps) { trackDOM.setAttribute("hide_deactive_exps", glyphTrack.hide_deactive_exps); }
  if(glyphTrack.active_on_top) { trackDOM.setAttribute("active_on_top", glyphTrack.active_on_top); }
  if(glyphTrack.express_sort_mode) { trackDOM.setAttribute("express_sort_mode", glyphTrack.express_sort_mode); }
  if(glyphTrack.expfilter) { trackDOM.setAttribute("expfilter", glyphTrack.expfilter); }
  if(glyphTrack.exp_filter_incl_matching) { trackDOM.setAttribute("exp_filter_incl_matching", "true"); }
  if(glyphTrack.exp_matching_mdkey) { trackDOM.setAttribute("exp_matching_mdkey", glyphTrack.exp_matching_mdkey); }
  if(glyphTrack.exp_matching_post_filter) { trackDOM.setAttribute("exp_matching_post_filter", glyphTrack.exp_matching_post_filter); }
  if(glyphTrack.exppanelmode) { trackDOM.setAttribute("exppanelmode", glyphTrack.exppanelmode); }
  if(glyphTrack.mdgroupkey) { trackDOM.setAttribute("mdgroupkey", glyphTrack.mdgroupkey); }  
  if(glyphTrack.errorbar_type) { trackDOM.setAttribute("errorbar_type", glyphTrack.errorbar_type); }  
  if(glyphTrack.ranksum_display) { trackDOM.setAttribute("ranksum_display", glyphTrack.ranksum_display); }  
  if(glyphTrack.ranksum_mdkeys) { trackDOM.setAttribute("ranksum_mdkeys", glyphTrack.ranksum_mdkeys); }  
  if(glyphTrack.ranksum_min_zscore) { trackDOM.setAttribute("ranksum_min_zscore", glyphTrack.ranksum_min_zscore); }  
  if(glyphTrack.hashkey) { trackDOM.setAttribute("trackcache_hashkey", glyphTrack.hashkey); }
  if(glyphTrack.logscale) { trackDOM.setAttribute("logscale", glyphTrack.logscale); }
  if(glyphTrack.track_height) { trackDOM.setAttribute("height", glyphTrack.track_height); }
  if(glyphTrack.experiment_merge) { trackDOM.setAttribute("experiment_merge", glyphTrack.experiment_merge); }
  if(glyphTrack.exppanel_use_rgbcolor) { trackDOM.setAttribute("exppanel_use_rgbcolor", "true"); }
  if(glyphTrack.whole_chrom_scale) { trackDOM.setAttribute("whole_chrom_scale", "true"); }
  if(glyphTrack.xyplot_fill) { trackDOM.setAttribute("xyplot_fill", "true"); }

  //if(glyphTrack.expscaling) { trackDOM.setAttribute("expscaling", glyphTrack.expscaling); }
  //if(glyphTrack.strandless) { trackDOM.setAttribute("strandless", glyphTrack.strandless); }
  if(glyphTrack.scale_min_signal) { trackDOM.setAttribute("scale_min_signal", glyphTrack.scale_min_signal); }
  if(glyphTrack.scale_max_signal) { trackDOM.setAttribute("scale_max_signal", glyphTrack.scale_max_signal); }

  if(glyphTrack.experiments) {
    for(var expID in glyphTrack.experiments){
      var experiment = glyphTrack.experiments[expID];
      var exp = doc.createElement("gLyphTrackExp");
      exp.setAttribute("id", experiment.id);
      if(experiment.hide) { exp.setAttribute("hide", experiment.hide); }
      trackDOM.appendChild(exp);
    }
  }
  if(glyphTrack.description) {
    var desc = trackDOM.appendChild(doc.createElement("description"));
    desc.appendChild(doc.createTextNode(glyphTrack.description));
  }
  if(glyphTrack.mdgroupkey) { 
    var mdkeys = trackDOM.appendChild(doc.createElement("mdgroup_mdkeys"));
    mdkeys.appendChild(doc.createTextNode(glyphTrack.mdgroupkey));
  }
  if(glyphTrack.exp_name_mdkeys) { 
    var mdkeys = trackDOM.appendChild(doc.createElement("exp_name_mdkeys"));
    mdkeys.appendChild(doc.createTextNode(glyphTrack.exp_name_mdkeys));
  }
  if(glyphTrack.script) {
    var spstreamDOM = gLyphsParseStreamProcssingXML(glyphTrack.script.spstreamXML);
    if(spstreamDOM) {
      var script_root = spstreamDOM.documentElement;
      script_root.setAttribute("name", glyphTrack.script.name);
      if(glyphTrack.script.uuid) { script_root.setAttribute("uuid", glyphTrack.script.uuid); }
      if(glyphTrack.script.desc) { script_root.setAttribute("desc", glyphTrack.script.desc); }
      trackDOM.appendChild(script_root);
    }
  }
  if(glyphTrack.selection) {
    trackDOM.setAttribute("select_asm", glyphTrack.selection.asm);
    trackDOM.setAttribute("select_chrom", glyphTrack.selection.chrom);
    trackDOM.setAttribute("select_start", glyphTrack.selection.chrom_start);
    trackDOM.setAttribute("select_end", glyphTrack.selection.chrom_end);
  }
  if(glyphTrack.selected_feature) { 
    console.log("generate featureDOM for selected_feature");
    var selectedDOM = doc.createElement("selected_feature");
    selectedDOM.setAttribute("id", glyphTrack.selected_feature.id);
    trackDOM.appendChild(selectedDOM);
    var featureDOM = eedbGenerateFeatureDOM(glyphTrack.selected_feature);
    selectedDOM.appendChild(featureDOM);
  }  

  if(glyphTrack.spstream_mode == "expression") {
    var expressDOM = doc.createElement("expression_binning");
    trackDOM.appendChild(expressDOM);
    if(glyphTrack.overlap_mode) { expressDOM.setAttribute("overlap_mode", glyphTrack.overlap_mode); }
    if(glyphTrack.binning) { expressDOM.setAttribute("binning", glyphTrack.binning); }
    if(glyphTrack.exprbin_strandless) { expressDOM.setAttribute("strandless", glyphTrack.exprbin_strandless); }
    if(glyphTrack.exprbin_add_count) { expressDOM.setAttribute("add_count", glyphTrack.exprbin_add_count); }
    if(glyphTrack.exprbin_subfeatures) { expressDOM.setAttribute("subfeatures", glyphTrack.exprbin_subfeatures); }
    if(glyphTrack.exprbin_flipstrand) { expressDOM.setAttribute("flipstrand", glyphTrack.exprbin_flipstrand); }
    if(glyphTrack.exprbin_binsize) { expressDOM.setAttribute("binsize", glyphTrack.exprbin_binsize); }
  }  
  
  glyphTrack.trackDOM = trackDOM;
  return trackDOM;
}


function gLyphsCreateTrackFromTrackDOM(trackDOM, glyphsGB) {
  //create trackdiv and glyphTrack objects and configure them
  if(!glyphsGB) { return null; }

  var glyphTrack = new ZenbuGlyphsTrack(glyphsGB);
  glyphTrack.hideTrack  = !!trackDOM.getAttribute("hide"); //forces it into a boolean
  glyphTrack.title      = trackDOM.getAttribute("title");
  glyphTrack.glyphStyle = trackDOM.getAttribute("glyphStyle");
  glyphTrack.noNameSearch = false;
  glyphTrack.source_outmode  = "";

  /*  
  //var trackID = "glyphTrack" + (newTrackID++);
  //var trackDiv = document.createElement('div');
  //trackDiv.setAttribute("align","left");
  //trackDiv.setAttribute("style", "background-color: transparent; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  //trackDiv.id = trackID;
  //trackDiv.setAttribute("class","gLyphTrack");
  //var glyphTrack = new ZenbuGlyphsTrack(glyphsGB, trackID);
  //glyphTrack.trackDiv   = trackDiv;

  var glyphTrack        = new Object;
  glyphTrack.trackID    = trackID;
  glyphTrack.glyphsGB   = glyphsGB;  
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
  glyphTrack.featureSortMode = "signal";
  glyphTrack.color_mdkey     = "bed:itemRgb";
  glyphTrack.signal_user_color = "#0000FF";
  glyphTrack.scale_invert = false;
  glyphTrack.source_outmode  = "";
  glyphTrack.hide_zero = false;
  glyphTrack.hide_deactive_exps = false;
  glyphTrack.active_on_top = false;
  glyphTrack.express_sort_mode = "name";
  glyphTrack.express_sort_reverse = false;
  glyphTrack.spstream_mode = "none";
  glyphTrack.exprbin_strandless = false;
  glyphTrack.exprbin_add_count = false;
  glyphTrack.exprbin_subfeatures = false;
  glyphTrack.exprbin_binsize = "";
  glyphTrack.expfilter = "";
  glyphTrack.exp_filter_incl_matching = false;
  glyphTrack.exp_matching_mdkey = "";
  glyphTrack.exp_matching_post_filter = "";
  glyphTrack.exppanelmode = "experiments";
  glyphTrack.exppanel_use_rgbcolor = false;
  glyphTrack.whole_chrom_scale = false;
  glyphTrack.exp_name_mdkeys = "";
  glyphTrack.mdgroupkey = "";
  glyphTrack.errorbar_type = "stddev";
  glyphTrack.ranksum_display = "";
  glyphTrack.ranksum_mdkeys = "";
  glyphTrack.ranksum_min_zscore = "";
  glyphTrack.description = ""
  glyphTrack.uuid = ""
  */

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

  if(trackDOM.getAttribute("active_track") == "true") { glyphTrack.glyphsGB.active_trackID = glyphTrack.trackID; }
  if(trackDOM.getAttribute("expPanelActive") == "true") { glyphTrack.expPanelActive = true; }
  
  if(trackDOM.getAttribute("nocache") == "true") { glyphTrack.noCache = true; }
  if(trackDOM.getAttribute("noNameSearch") == "true") { glyphTrack.noNameSearch = true; }
  if(trackDOM.getAttribute("backColor")) { 
    glyphTrack.backColor = trackDOM.getAttribute("backColor");
    if(glyphTrack.backColor.charAt(0) != "#") { 
      console.log(glyphTrack.trackID+" named backcolor: "+glyphTrack.backColor);
      var cl1 = new RGBColor(glyphTrack.backColor);
      var colour = new RGBColour(cl1.r, cl1.g, cl1.b);
      glyphTrack.backColor = colour.getCSSHexadecimalRGB();
      console.log(glyphTrack.trackID+" new backcolor: "+glyphTrack.backColor);
    }
  }
  if(trackDOM.getAttribute("posStrandColor")) { glyphTrack.posStrandColor = trackDOM.getAttribute("posStrandColor"); }
  if(trackDOM.getAttribute("revStrandColor")) { glyphTrack.revStrandColor = trackDOM.getAttribute("revStrandColor"); }
  if(trackDOM.getAttribute("revStrandColor")) { glyphTrack.revStrandColor = trackDOM.getAttribute("revStrandColor"); }
  if(trackDOM.getAttribute("colorspace")) { glyphTrack.colorspace = trackDOM.getAttribute("colorspace"); }
  if(trackDOM.getAttribute("whole_chrom_scale") == "true") { glyphTrack.whole_chrom_scale = true; }
  if(trackDOM.getAttribute("xyplot_fill") == "true") { glyphTrack.xyplot_fill = true; }
  if(trackDOM.getAttribute("hide_zero") == "true") { glyphTrack.hide_zero = true; }
  if(trackDOM.getAttribute("hide_deactive_exps") == "true") { glyphTrack.hide_deactive_exps = true; }
  if(trackDOM.getAttribute("active_on_top") == "true") { glyphTrack.active_on_top = true; }
  if(trackDOM.getAttribute("express_sort_mode")) { glyphTrack.express_sort_mode = trackDOM.getAttribute("express_sort_mode"); }
  if(trackDOM.getAttribute("submode")) { glyphTrack.overlap_mode = trackDOM.getAttribute("submode"); }
  if(trackDOM.getAttribute("overlap_mode")) { glyphTrack.overlap_mode = trackDOM.getAttribute("overlap_mode"); }
  if(trackDOM.getAttribute("binning")) { glyphTrack.binning = trackDOM.getAttribute("binning"); }
  if(trackDOM.getAttribute("experiment_merge")) { glyphTrack.experiment_merge = trackDOM.getAttribute("experiment_merge"); }
  if(trackDOM.getAttribute("datatype")) { glyphTrack.datatype = trackDOM.getAttribute("datatype"); }
  if(trackDOM.getAttribute("expfilter")) { glyphTrack.expfilter = trackDOM.getAttribute("expfilter"); }
  if(trackDOM.getAttribute("exp_filter_incl_matching") == "true") { glyphTrack.exp_filter_incl_matching = true; }
  if(trackDOM.getAttribute("exp_matching_mdkey")) { glyphTrack.exp_matching_mdkey = trackDOM.getAttribute("exp_matching_mdkey"); }
  if(trackDOM.getAttribute("exp_matching_post_filter")) { glyphTrack.exp_matching_post_filter = trackDOM.getAttribute("exp_matching_post_filter"); }
  if(trackDOM.getAttribute("exppanelmode")) { 
    glyphTrack.exppanelmode = trackDOM.getAttribute("exppanelmode"); 
    if(glyphTrack.exppanelmode == "mdgroup" && (glyphTrack.express_sort_mode=="name")) { glyphTrack.express_sort_mode = "mdvalue"; } 
  }
  if(trackDOM.getAttribute("mdgroupkey")) { glyphTrack.mdgroupkey = trackDOM.getAttribute("mdgroupkey"); }
  if(trackDOM.getAttribute("errorbar_type")) { glyphTrack.errorbar_type = trackDOM.getAttribute("errorbar_type"); }
  if(trackDOM.getAttribute("ranksum_display")) { glyphTrack.ranksum_display = trackDOM.getAttribute("ranksum_display"); }
  if(trackDOM.getAttribute("ranksum_min_zscore")) { glyphTrack.ranksum_min_zscore = trackDOM.getAttribute("ranksum_min_zscore"); }
  if(trackDOM.getAttribute("ranksum_mdkeys")) { glyphTrack.ranksum_mdkeys = trackDOM.getAttribute("ranksum_mdkeys"); }
  if(trackDOM.getAttribute("exppanel_use_rgbcolor") == "true") { glyphTrack.exppanel_use_rgbcolor = true; }
  //if(trackDOM.getAttribute("strandless") == "true") { glyphTrack.strandless = true; }

  if(trackDOM.getAttribute("exptype")) { 
    glyphTrack.exptype = trackDOM.getAttribute("exptype"); 
    if(!glyphTrack.datatype) { glyphTrack.datatype = glyphTrack.exptype; }
  }

  if(trackDOM.getAttribute("scorecolor")) { //for backward compatability
    glyphTrack.colorMode = "signal";
    glyphTrack.colorspace = trackDOM.getAttribute("scorecolor"); 
    //if(glyphTrack.colorspace == "sense-color") { gLyphsMakeColorGradient(glyphTrack); }
  }
  if(trackDOM.getAttribute("colorMode")) { glyphTrack.colorMode = trackDOM.getAttribute("colorMode"); }
  if(trackDOM.getAttribute("featureSortMode")) { glyphTrack.featureSortMode = trackDOM.getAttribute("featureSortMode"); }
  if(trackDOM.getAttribute("color_mdkey")) { glyphTrack.color_mdkey = trackDOM.getAttribute("color_mdkey"); }
  if(trackDOM.getAttribute("signal_user_color")) { glyphTrack.signal_user_color = trackDOM.getAttribute("signal_user_color"); }
  if(trackDOM.getAttribute("scale_invert")) { glyphTrack.scale_invert = trackDOM.getAttribute("scale_invert"); }
  
  if(trackDOM.getAttribute("select_start")) { 
    glyphTrack.selection = new Object;
    glyphTrack.selection.asm         = trackDOM.getAttribute("select_asm");
    glyphTrack.selection.chrom       = trackDOM.getAttribute("select_chrom");
    glyphTrack.selection.chrom_start = trackDOM.getAttribute("select_start");
    glyphTrack.selection.chrom_end   = trackDOM.getAttribute("select_end");
    glyphTrack.selection.active = "no";
  }
    
  if(trackDOM.getAttribute("logscale"))   { glyphTrack.logscale = Math.floor(trackDOM.getAttribute("logscale")); }
  
  glyphTrack.maxlevels  = 0;
  glyphTrack.track_height = 100;
  if(trackDOM.getAttribute("maxlevels")) {
    glyphTrack.track_height  = Math.floor(trackDOM.getAttribute("maxlevels"));
  }
  if(trackDOM.getAttribute("height")) {
    glyphTrack.track_height  = Math.floor(trackDOM.getAttribute("height"));
  }
  glyphTrack.scale_max_signal = "auto";
  if(trackDOM.getAttribute("expscaling")) {
    glyphTrack.scale_max_signal  = parseFloat(trackDOM.getAttribute("expscaling"));
    if(isNaN(glyphTrack.scale_max_signal) || (glyphTrack.scale_max_signal==0)) { glyphTrack.scale_max_signal = "auto"; }                                        
  }
  if(trackDOM.getAttribute("scale_max_signal")) {
    glyphTrack.scale_max_signal  = parseFloat(trackDOM.getAttribute("scale_max_signal"));
    if(isNaN(glyphTrack.scale_max_signal) || (glyphTrack.scale_max_signal==0)) { glyphTrack.scale_max_signal = "auto"; }                                        
  }
  glyphTrack.scale_min_signal = "auto";
  if(trackDOM.getAttribute("scale_min_signal")) {
    glyphTrack.scale_min_signal  = parseFloat(trackDOM.getAttribute("scale_min_signal"));
    if(isNaN(glyphTrack.scale_min_signal)) { glyphTrack.scale_min_signal = "auto"; }                                        
  }
  if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "split-signal") {
    glyphTrack.experiments = new Object();
  }

  if(glyphTrack.glyphStyle == "1D-heatmap" || glyphTrack.glyphStyle == "experiment-heatmap") {
    glyphTrack.colorMode = "signal";
    if(!glyphTrack.colorspace) {
      glyphTrack.colorspace = "fire1";
    }
  } 
  if((glyphTrack.glyphStyle == "experiment-heatmap") && glyphTrack.track_height > 50) { 
    glyphTrack.track_height = 3; //not properly set in config
  }
  
  var selectedDOM = trackDOM.getElementsByTagName("selected_feature")[0];
  if(selectedDOM) {
    var featureID = selectedDOM.getAttribute("id");
    console.log("trackDOM selected_feature.id = " + featureID);
    var featureDOM = selectedDOM.getElementsByTagName("feature")[0];
    if(featureDOM) {
      var feature = eedbParseFeatureData(featureDOM);
      if(feature) { glyphTrack.selected_feature = feature; }
    }
  }
          
  var desc = trackDOM.getElementsByTagName("description")[0];
  if(desc) {
    glyphTrack.description = desc.firstChild.nodeValue;
  }
  var mdkeys = trackDOM.getElementsByTagName("exp_name_mdkeys")[0];
  if(mdkeys) {
    glyphTrack.exp_name_mdkeys = mdkeys.firstChild.nodeValue;
  }
  var group_mdkeys = trackDOM.getElementsByTagName("mdgroup_mdkeys")[0];
  if(group_mdkeys) {
    glyphTrack.mdgroupkey = group_mdkeys.firstChild.nodeValue;
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
    if(expressbinDOM.getAttribute("add_count")) { glyphTrack.exprbin_add_count = expressbinDOM.getAttribute("add_count"); }
    if(expressbinDOM.getAttribute("subfeatures")) { glyphTrack.exprbin_subfeatures = expressbinDOM.getAttribute("subfeatures"); }
    if(expressbinDOM.getAttribute("flipstrand")) { glyphTrack.exprbin_flipstrand = expressbinDOM.getAttribute("flipstrand"); }
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

  //insert into global hash to easily lookup via trackID
  glyphsTrack_global_track_hash[glyphTrack.trackID] = glyphTrack;

  //add into the glyphsGB set of tracks
  glyphTrack.glyphsGB.tracks_hash[glyphTrack.trackID] = glyphTrack;

  return glyphTrack;
}


function gLyphsGenerateTrackConfigDOM(trackID) {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  if(current_user) { summary.setAttribute("creator_openID", current_user.openID); }
  summary.setAttribute("desc", saveconfig.desc);
  summary.setAttribute("asm", glyphTrack.glyphsGB.asm);
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
  //console.log(paramXML);
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

//although gLyphsLoadTrackConfigUUID & gLyphsLoadTrackConfig are currently specifically for the add predefined track
//related code, I will leave here so that I can convert these to initFromConfigUUID like methods

function gLyphsLoadTrackConfigUUID(glyphsGB, trackUUID) {
  if(!glyphsGB) { return; }
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

  return gLyphsLoadTrackConfig(glyphsGB, xmlDoc);
}


function gLyphsLoadTrackConfig(glyphsGB, configDOM) {
  if(!glyphsGB) { return; }
  //--------------------------------
  gLyphsEmptySearchResults(glyphsGB);

  //console.log("gLyphsLoadTrackConfig");

  var glyphset = glyphsGB.gLyphTrackSet;
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
    
    var glyphTrack = gLyphsCreateTrackFromTrackDOM(trackDOM, glyphsGB);
    if(!glyphTrack) { continue; }
    glyphTrack.hideTrack  = false;
    if(!glyphTrack.uuid && uuid) { glyphTrack.uuid = uuid; }

    glyphsTrack_global_track_hash[glyphTrack.trackID] = glyphTrack;
    glyphset.insertBefore(glyphTrack.trackDiv, newtrack_div);

    gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
    prepareTrackXHR(glyphTrack.trackID);
  }
  //glyphTrack.glyphsGB.autosave();

  return;

}

//
//======================================================================================
//


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

  //console.log("scriptpatch[" + glyphTrack.title + " " + glyphTrack.overlap_mode+ " " +glyphTrack.binning+"] ");

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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  current_user = eedbShowLogin();
  if(!current_user) {
    zenbuGeneralWarn("In order to save a script, you must first log into ZENBU.", "Warning: Not logged into the ZENBU system");
    eedbLoginAction("login");
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
  if(current_user) {
    if(current_user.nickname) { name_span.innerHTML = current_user.nickname; }
    else { name_span.innerHTML = current_user.openID; }
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
  button1.className = "medbutton";
  button1.style.float = "left";
  button1.setAttribute("onclick", "glyphsSaveScriptConfigParam(\""+ trackID+"\", 'cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save script");
  button2.className = "medbutton";
  button2.style.float = "right";
  button2.setAttribute("onclick", "glyphsSaveScriptConfigParam(\""+ trackID+"\", 'accept');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
  glyphTrack.saveScriptConfig.interface = divFrame;
}


function glyphsSaveScriptConfigParam(trackID, param, value) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
    if(uuid) { glyphTrack.glyphsGB.autosave(); }
  }
}


function glyphsGenerateScriptConfigDOM(trackID) {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  if(current_user) {
    summary.setAttribute("user", current_user.nickname);
    summary.setAttribute("creator_openID", current_user.openID);
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
  //console.log(paramXML);
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

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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

    if(defaults.getAttribute("hide_zero") == "true") { reconfigTrackParam(trackID, "hide_zero", true); }
    if(defaults.getAttribute("hide_zero") == "false") { reconfigTrackParam(trackID, "hide_zero", false); }

    //below are not tested to see if the reconfig panel updates correctly
    if(defaults.getAttribute("exptype")) { reconfigTrackParam(trackID, "exptype", defaults.getAttribute("exptype")); }
    if(defaults.getAttribute("datatype")) { reconfigTrackParam(trackID, "datatype", defaults.getAttribute("datatype")); }
    if(defaults.getAttribute("source_outmode")) { reconfigTrackParam(trackID, "source_outmode", defaults.getAttribute("source_outmode")); }

    if(defaults.getAttribute("height")) { 
      reconfigTrackParam(trackID, "height", defaults.getAttribute("height")); 
      var heightInput = document.getElementById(trackID + "_trackHeightInput");
      if(heightInput) { heightInput.value = defaults.getAttribute("height"); } 
    }
    if(defaults.getAttribute("expscaling")) { reconfigTrackParam(trackID, "scale_max_signal", defaults.getAttribute("expscaling")); }
    if(defaults.getAttribute("scale_max_signal")) { 
      reconfigTrackParam(trackID, "scale_max_signal", defaults.getAttribute("scale_max_signal")); }

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

  reconfigureStreamParams(glyphTrack);
}


//---------------------------------------------------------------
//
// user annotaton section
// 
//---------------------------------------------------------------


function glyphsUserAnnotationPanel(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var chromLoc = glyphTrack.glyphsGB.asm +" "+ glyphTrack.glyphsGB.chrom +":"+ selection.chrom_start +".."+ selection.chrom_end;

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
  if(current_user) {
    if(current_user.nickname) { name_span.innerHTML = current_user.nickname; }
    else { name_span.innerHTML = current_user.openID; }
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  loc.setAttribute("asm",    glyphTrack.glyphsGB.asm);
  loc.setAttribute("chrom",  glyphTrack.glyphsGB.chrom);
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
  //console.log(paramXML);
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
//
// track interactive configuration tool section
//
//
//----------------------------------------------------


function buildStreamProcessDiv(glyphTrack) {
  //for public release, this is not ready yet
  if(glyphTrack == null) { return; }
  var trackID = glyphTrack.trackID;
  
  var streamDiv = document.getElementById(trackID + "_streamprocessDiv");
  if(!streamDiv) { return; }
  streamDiv.innerHTML = "";

  streamDiv.appendChild(document.createElement('hr'));

  //help
  helpdiv = streamDiv.appendChild(document.createElement('div'));
  helpdiv.setAttribute("style", "float:right; margin-right:3px; padding:0px 3px 0px 3px; font-size:10px; color:#505050; background-color:#D0D0D0;");
  helpdiv.setAttribute("onclick", "zenbuRedirect('https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/Data_Stream_Processing');");
  helpdiv.setAttribute("onmouseover", "eedbMessageTooltip('need help with scripted processing?<br>check out the wiki pages',180);");
  helpdiv.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  helpdiv.innerHTML = "?";

  var labelStreamProcess = streamDiv.appendChild(document.createElement('div'));
  labelStreamProcess.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelStreamProcess.innerHTML ="Stream Processing script";

  var span1 = document.createElement('span');
  span1.innerHTML = "select processing mode: ";
  streamDiv.appendChild(span1);

  streamDiv.appendChild(buildStreamSelect(glyphTrack));

  var streamParamsDiv = document.createElement('div');
  streamParamsDiv.id = trackID + "_spstreamParamsDiv";
  streamDiv.appendChild(streamParamsDiv);

  reconfigureStreamParams(glyphTrack);
}


function buildStreamSelect(glyphTrack) {
  if(glyphTrack == null) { return; }
  var trackID = glyphTrack.trackID;

  var streamSelect = document.createElement('select');
  streamSelect.id = trackID + "_streamProcessSelect";
  streamSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'spstream', this.value);");
  streamSelect.className = "dropdown";
  streamSelect.style.fontSize = "14px";


  var spstream_mode = glyphTrack.spstream_mode;
  if(glyphTrack.newconfig && glyphTrack.newconfig.spstream_mode) { spstream_mode = glyphTrack.newconfig.spstream_mode; }

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
  console.log("reconfigTrackParam: " + trackID + ":: "+ param + " = "+value);
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  if(param == "express_sort_mode") {
    if(value=="norm") { value="value_both"; }  //backward compat
    if(glyphTrack.express_sort_mode == value) {  //same value so change direction
      glyphTrack.express_sort_reverse = !glyphTrack.express_sort_reverse;
    } else {
      glyphTrack.express_sort_mode = value;
      glyphTrack.express_sort_reverse = false;
    }
    if(glyphTrack.glyphStyle == "experiment-heatmap") {
      gLyphsRenderTrack(glyphTrack);
    }
    gLyphsDrawTrack(glyphTrack.trackID);
    return;
  }

  //-------
  
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
  if(param == "whole_chrom_scale") {  newconfig.whole_chrom_scale = value; }
  if(param == "xyplot_fill") {  newconfig.xyplot_fill = value; }
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
      glyphsExpPanelDraw(glyphTrack);
      gLyphsDrawTrack(trackID);
    }
  }
  if(param == "source_outmode") {  newconfig.source_outmode = value; }
  if(param == "source_ids") {  
    newconfig.source_ids = value;
  }
  if(param == "hide_zero") { 
    if(value) { newconfig.hide_zero=true; }
    else { newconfig.hide_zero = false; }
    createGlyphstyleSelect(glyphTrack);
  }

  if(param == "spstream") {  
    if(value == "predefined-clear") {
      newconfig.spstream_mode = glyphTrack.spstream_mode; 
      newconfig.script = null;
      newconfig.spstream_changed = true;
      reconfigureStreamParams(glyphTrack);
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
        if(glyphTrack.script) {
          newconfig.script = zenbu_object_clone(glyphTrack.script);
        } else {
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
            reconfig_div.style.left= (glyphTrack.glyphsGB.display_width-500)+"px";
          }
        }
      }
      reconfigureStreamParams(glyphTrack);
    }
  }
  if(param == "spstream_configxml") { 
    //when user is directly entering script text (custom modifying)
    if(glyphTrack.script && !newconfig.script) {
      newconfig.script = zenbu_object_clone(glyphTrack.script);
    }
    newconfig.script.spstreamXML = value;
    newconfig.script.uuid = null;
    newconfig.spstream_changed = true;
  }
  if(param == "exprbin_strandless") { 
    newconfig.exprbin_strandless = value;
  }
  if(param == "exprbin_add_count") { 
    newconfig.exprbin_add_count = value;
  }
  if(param == "exprbin_subfeatures") { 
    newconfig.exprbin_subfeatures = value;
  }
  if(param == "exprbin_flipstrand") { 
    newconfig.exprbin_flipstrand = value;
  }
  if(param == "exprbin_binsize") { 
    newconfig.exprbin_binsize = value;
  }
  if(param == "exprbin_editxml") { 
    //searchButton.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'spstream', 'custom');");
    newconfig.spstream_mode = "custom";
    newconfig.spstream_changed = true;

    newconfig.script = new Object;
    newconfig.script.name = "expression binning";
    newconfig.script.desc = "";
    newconfig.script.spstreamXML = glyphsTrack_expressionConfigXML(glyphTrack);

    var reconfig_div = document.getElementById(trackID+"_reconfigure_divframe");
    if(reconfig_div) { 
      reconfig_div.style.width="500px";
      reconfig_div.style.left= (glyphTrack.glyphsGB.display_width-500)+"px";
    }
    reconfigureStreamParams(glyphTrack);
  }

  if(param == "colorMode") {  
    newconfig.colorMode = value;
    glyphTrack.signalCSI = null;
    createGlyphstyleSelect(glyphTrack);
  }
  if(param == "featureSortMode") {  
    newconfig.featureSortMode = value;
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
      //newconfig.hide_zero = true;
      //newconfig.track_height = 3;
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
      newconfig.exprbin_add_count = false;
      newconfig.exprbin_subfeatures = false;
      if(value == "experiment-heatmap" || value == "1D-heatmap") {
        newconfig.exprbin_strandless = true;
        newconfig.exprbin_subfeatures = true;
        newconfig.overlap_mode = "height";
      }
      reconfigureStreamParams(glyphTrack);
      needReload=1; 
    }
    createGlyphstyleSelect(glyphTrack);  //refresh
  }

  if(param == "sourcemode") {
    //console.log("reconfig: " + trackID + ":: "+ param + "="+value);
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
    if(glyphStyle == "experiment-heatmap") {
      if(newconfig.track_height <1) { newconfig.track_height = 1; } 
      if(newconfig.track_height >50) { newconfig.track_height = 50; } 
    } else if(glyphStyle == "1D-heatmap") {
      if(newconfig.track_height <3) { newconfig.track_height = 3; } 
      if(newconfig.track_height >200) { newconfig.track_height = 200; }       
    } else {
      if(newconfig.track_height <20) { newconfig.track_height = 20; } 
      if(newconfig.track_height >500) { newconfig.track_height = 500; } 
    }
  }
  if(param == "scale_max_signal") {  
    newconfig.scale_max_signal = parseFloat(value); 
    if(isNaN(newconfig.scale_max_signal) || (newconfig.scale_max_signal==0)) { newconfig.scale_max_signal = "auto"; } 
  }
  if(param == "scale_min_signal") {  
    newconfig.scale_min_signal = parseFloat(value); 
    if(isNaN(newconfig.scale_min_signal)) { newconfig.scale_min_signal = "auto"; } 
    else {
      if(newconfig.scale_min_signal < glyphTrack.min_signal) {
        console.log("trying to set scale_min_signal to "+newconfig.scale_min_signal+" while min_signal="+glyphTrack.min_signal);
        newconfig.scale_min_signal = "auto";
      }
    }
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
      //if(newconfig.strandless !== undefined) { glyphTrack.strandless = newconfig.strandless; }
      if(newconfig.exprbin_strandless !== undefined) { glyphTrack.exprbin_strandless = newconfig.exprbin_strandless; }
      if(newconfig.exprbin_add_count !== undefined) { glyphTrack.exprbin_add_count = newconfig.exprbin_add_count; }
      if(newconfig.exprbin_subfeatures !== undefined) { glyphTrack.exprbin_subfeatures = newconfig.exprbin_subfeatures; }
      if(newconfig.exprbin_flipstrand !== undefined) { glyphTrack.exprbin_flipstrand = newconfig.exprbin_flipstrand; }
      if(newconfig.exprbin_binsize !== undefined) { glyphTrack.exprbin_binsize = newconfig.exprbin_binsize; }
      if(newconfig.overlap_mode !== undefined) { glyphTrack.overlap_mode = newconfig.overlap_mode; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; }
      if(newconfig.whole_chrom_scale !== undefined) { glyphTrack.whole_chrom_scale = newconfig.whole_chrom_scale; }
      if(newconfig.xyplot_fill !== undefined) { glyphTrack.xyplot_fill = newconfig.xyplot_fill; }
      if(newconfig.experiment_merge !== undefined) { glyphTrack.experiment_merge = newconfig.experiment_merge; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.description !== undefined) { glyphTrack.description = newconfig.description; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; }
      if(newconfig.datatype !== undefined) { glyphTrack.datatype = newconfig.datatype; }
      if(newconfig.track_height !== undefined) { glyphTrack.track_height = newconfig.track_height; }
      if(newconfig.scale_max_signal !== undefined) { glyphTrack.scale_max_signal = newconfig.scale_max_signal; }
      if(newconfig.scale_min_signal !== undefined) { glyphTrack.scale_min_signal = newconfig.scale_min_signal; }
      if(newconfig.exp_mincut !== undefined) { glyphTrack.exp_mincut = newconfig.exp_mincut; }
      if(newconfig.colorMode !== undefined) { glyphTrack.colorMode = newconfig.colorMode; }
      if(newconfig.featureSortMode !== undefined) { glyphTrack.featureSortMode = newconfig.featureSortMode; }
      if(newconfig.colorspace !== undefined) { glyphTrack.colorspace = newconfig.colorspace; }
      if(newconfig.color_mdkey !== undefined) { glyphTrack.color_mdkey = newconfig.color_mdkey; }
      if(newconfig.hide_zero !== undefined) { glyphTrack.hide_zero = newconfig.hide_zero; }

      if(newconfig.spstream_mode !== undefined) { glyphTrack.spstream_mode = newconfig.spstream_mode; }
              
      if(newconfig.spstream_changed) {
        //console.log("script changed");
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

    if(glyphTrack.glyphStyle == "signal-histogram" || glyphTrack.glyphStyle == "xyplot" || 
       glyphTrack.glyphStyle == "split-signal" || glyphTrack.glyphStyle == "arc") {
      //console.log("new express track so set some defaults");
      if(glyphTrack.exptype === undefined)   { glyphTrack.datatype = glyphTrack.exptype = glyphTrack.default_exptype; }
      if(glyphTrack.track_height === undefined) { glyphTrack.track_height = 100; }
      if(glyphTrack.expsscaling === undefined) { glyphTrack.scale_max_signal = "auto"; }
    }
    //if(glyphTrack.glyphStyle == "xyplot") { glyphTrack.strandless = false; }

    //finish
    glyphTrack.newconfig = undefined;
    clearKids(glyphTrack.trackDiv);

    if(glyphTrack.createMode == "trackset") {
      gLyphsAppendTracksViaTrackSet(glyphTrack.glyphsGB, glyphTrack);
    }

    if(glyphTrack.dexMode) {
      glyphTrack.dex_callout(trackID, "accept-new");
      return;
    }

    if(glyphTrack.createMode == "single") {
      glyphTrack.glyphsGB.autosave();
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
    //if(glyphTrack.signalCSI) { glyphTrack.signalCSI.newconfig = new Object(); } //clear
    //zenbuColorSpaceSetUserColor(glyphTrack.signal_user_color);
    glyphTrack.newconfig = undefined;
    glyphTrack.DSI.newconfig = new Object;
    gLyphsTrackToggleSubpanel(glyphTrack.trackID, 'none');
    //gLyphsDrawTrack(trackID);
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
      if(newconfig.source_ids !== undefined) { glyphTrack.source_ids = newconfig.source_ids; needReload=1; }
      //if(newconfig.strandless !== undefined) { glyphTrack.strandless = newconfig.strandless; }
      if(newconfig.exprbin_strandless !== undefined) { glyphTrack.exprbin_strandless = newconfig.exprbin_strandless; needReload=1; }
      if(newconfig.exprbin_add_count !== undefined) { glyphTrack.exprbin_add_count = newconfig.exprbin_add_count; needReload=1; }
      if(newconfig.exprbin_subfeatures !== undefined) { glyphTrack.exprbin_subfeatures = newconfig.exprbin_subfeatures; needReload=1; }
      if(newconfig.exprbin_flipstrand !== undefined) { glyphTrack.exprbin_flipstrand = newconfig.exprbin_flipstrand; needReload=1; }
      if(newconfig.exprbin_binsize !== undefined) { glyphTrack.exprbin_binsize = newconfig.exprbin_binsize; needReload=1; }
      if(newconfig.overlap_mode !== undefined) { glyphTrack.overlap_mode = newconfig.overlap_mode; needReload=1; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; needReload=1; }
      if(newconfig.whole_chrom_scale !== undefined) { glyphTrack.whole_chrom_scale = newconfig.whole_chrom_scale; needReload=1; }
      if(newconfig.xyplot_fill !== undefined) { glyphTrack.xyplot_fill = newconfig.xyplot_fill; }
      if(newconfig.experiment_merge !== undefined) { glyphTrack.experiment_merge = newconfig.experiment_merge; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.description !== undefined) { glyphTrack.description = newconfig.description; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; needReload=1; }
      if(newconfig.datatype !== undefined) { glyphTrack.datatype = newconfig.datatype; }
      if(newconfig.track_height !== undefined) { glyphTrack.track_height = newconfig.track_height; }
      if(newconfig.scale_max_signal !== undefined) { glyphTrack.scale_max_signal = newconfig.scale_max_signal; }
      if(newconfig.scale_min_signal !== undefined) { glyphTrack.scale_min_signal = newconfig.scale_min_signal; }
      if(newconfig.exp_mincut !== undefined) { glyphTrack.exp_mincut = newconfig.exp_mincut; }
      if(newconfig.colorMode !== undefined) { glyphTrack.colorMode = newconfig.colorMode; if(newconfig.colorMode=="signal") { needReload=1; } }
      if(newconfig.featureSortMode !== undefined) { glyphTrack.featureSortMode = newconfig.featureSortMode; }
      if(newconfig.colorspace !== undefined) { glyphTrack.colorspace = newconfig.colorspace; }
      if(newconfig.color_mdkey !== undefined) { glyphTrack.color_mdkey = newconfig.color_mdkey; }
      if(newconfig.hide_zero !== undefined) { glyphTrack.hide_zero = newconfig.hide_zero; }
      if(newconfig.spstream_mode !== undefined) { glyphTrack.spstream_mode = newconfig.spstream_mode; }

      if(glyphTrack.signalCSI) {
        if(glyphTrack.signalCSI.newconfig.colorspace != undefined) { glyphTrack.colorspace = glyphTrack.signalCSI.newconfig.colorspace; }
        if(glyphTrack.signalCSI.newconfig.single_color != undefined) { 
          glyphTrack.signal_user_color = glyphTrack.signalCSI.newconfig.single_color; 
        }
        if(glyphTrack.signalCSI.newconfig.min_signal != undefined) { glyphTrack.scale_min_signal = glyphTrack.signalCSI.newconfig.min_signal; }
        if(glyphTrack.signalCSI.newconfig.max_signal != undefined) { glyphTrack.scale_max_signal = glyphTrack.signalCSI.newconfig.max_signal; }
        if(glyphTrack.signalCSI.newconfig.logscale != undefined)   { glyphTrack.logscale = glyphTrack.signalCSI.newconfig.logscale; }
        if(glyphTrack.signalCSI.newconfig.invert != undefined)     { glyphTrack.scale_invert = glyphTrack.signalCSI.newconfig.invert; }
        glyphTrack.signalCSI = null; //clear
      }
      if(glyphTrack.DSI) {
        //if(glyphTrack.DSI.newconfig.source_ids && (glyphTrack.source_ids != glyphTrack.DSI.newconfig.source_ids)) { 
        if(glyphTrack.DSI.newconfig.source_ids && glyphTrack.source_ids) { 
          console.log("glyphTrack.DSI has source_ids to clear exp/mdata and recalc");
          glyphTrack.source_ids = glyphTrack.DSI.newconfig.source_ids; 
          glyphTrack.experiments = new Object();;
          glyphTrack.experiment_array = new Array();
          glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
          glyphTrack.experiment_mdgrouping = null; //clear this so it recalcs
          glyphTrack.checked_missing_mdata = false; //so it reloads
          glyphTrack.expfilter = "";
          glyphTrack.uuid = "";
          glyphTrack.DSI.newconfig = new Object;
          console.log(glyphTrack.trackID+" new source_ids:"+glyphTrack.source_ids);
          //prepareTrackXHR(trackID);
          needReload=1;           
        }
      }

      if(newconfig.spstream_changed) {
        needReload=1;
        //console.log("script changed");
        if(glyphTrack.spstream_mode == "none") { glyphTrack.script = null; }
        if(glyphTrack.spstream_mode == "expression") { glyphTrack.script = null; }
        if(glyphTrack.spstream_mode == "predefined") { glyphTrack.script = newconfig.script; }
        if(glyphTrack.spstream_mode == "custom") {
          var spstreamDOM = gLyphsParseStreamProcssingXML(newconfig.script.spstreamXML);
          if(spstreamDOM) {
            //console.log(" new custom script parsed OK");
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
      //if(glyphTrack.glyphStyle == "xyplot") { glyphTrack.strandless = false; }
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
    
    gLyphsTrackToggleSubpanel(trackID, 'none');

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
    glyphTrack.glyphsGB.autosave();
  }
  
  if(glyphTrack.subpanelMode == "reconfig") {
    //toogle the cancel/accept buttons
    var cancelButton = document.getElementById(trackID + "_cancelConfigButton");
    var acceptButton = document.getElementById(trackID + "_acceptConfigButton");
    if(cancelButton) { cancelButton.removeAttribute("disabled"); }
    if(acceptButton) { acceptButton.removeAttribute("disabled"); }
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

  if(param == "accept-download") {
    glyphsPostDownloadRequest(trackID);
    gLyphsTrackToggleSubpanel(trackID, 'none');
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

function reconfigureStreamParams(glyphTrack) {
  if(glyphTrack == null) { return; }
  var trackID = glyphTrack.trackID;

  var paramDiv = document.getElementById(trackID + "_spstreamParamsDiv");
  if(!paramDiv) { return; }
  paramDiv.innerHTML = ""; //empty
  glyphTrack.spstream_config = new Object;

  var saveButton = document.getElementById(trackID + "_saveScriptButton");
  if(saveButton) { saveButton.setAttribute("disabled", "disabled"); }

  var spstream_mode = glyphTrack.spstream_mode;
  if(glyphTrack.newconfig && glyphTrack.newconfig.spstream_mode) { spstream_mode = glyphTrack.newconfig.spstream_mode; }

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
  if(glyphTrack.newconfig && glyphTrack.newconfig.spstream_changed) {
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
  if(glyphTrack.newconfig && glyphTrack.newconfig.spstream_changed) {
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
    searchButton.className = "medbutton";
    searchButton.setAttribute("value", "edit script");
    searchButton.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'spstream', 'custom');");

    var searchButton = td.appendChild(document.createElement('input'));
    searchButton.setAttribute("type", "button");
    searchButton.className = "medbutton";
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
    sourceInput.className = "sliminput";
    sourceInput.style.width = "250px";
    sourceInput.setAttribute('type', "text");
    
    var searchButton = predefScriptDiv.appendChild(document.createElement('input'));
    searchButton.className = "slimbutton";
    searchButton.setAttribute("type", "button");
    searchButton.setAttribute("value", "search");
    searchButton.setAttribute("onclick", "gLyphsTrackSearchScripts(\""+trackID+"\", \"search\");");
    
    var clearButton = predefScriptDiv.appendChild(document.createElement('input'));
    clearButton.className = "slimbutton";
    clearButton.setAttribute("type", "button");
    clearButton.setAttribute("value", "clear");
    clearButton.setAttribute("onclick", "gLyphsTrackSearchScripts(\""+trackID+"\", \"clear\");");
    
    var searchAllButton = predefScriptDiv.appendChild(document.createElement('input'));
    searchAllButton.className = "slimbutton";
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

  var tspan = div3.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin: 1px 1px 1px 5px;");
  var exprbin_add_count = glyphTrack.exprbin_add_count
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_add_count !== undefined) { 
    exprbin_add_count = glyphTrack.newconfig.exprbin_add_count; }
  var addCountCheck = div3.appendChild(document.createElement('input'));
  addCountCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  addCountCheck.setAttribute('type', "checkbox");
  if(exprbin_add_count) { addCountCheck.setAttribute('checked', "checked"); }
  addCountCheck.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_add_count', this.checked);");
  tspan = div3.appendChild(document.createElement('span'));
  tspan.innerHTML = "add count as expression";

  //----------
  var exprbin_strandless = glyphTrack.exprbin_strandless
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_strandless !== undefined) { 
    exprbin_strandless = glyphTrack.newconfig.exprbin_strandless; }
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
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_subfeatures !== undefined) { 
    exprbin_subfeatures = glyphTrack.newconfig.exprbin_subfeatures; }
  var subfeatCheck = div3.appendChild(document.createElement('input'));
  subfeatCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  subfeatCheck.setAttribute('type', "checkbox");
  if(exprbin_subfeatures) { subfeatCheck.setAttribute('checked', "checked"); }
  subfeatCheck.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_subfeatures', this.checked);");
  var span1 = div3.appendChild(document.createElement('span'));
  span1.innerHTML = "omit gaps (introns)";

  var exprbin_flipstrand = glyphTrack.exprbin_flipstrand
  if(glyphTrack.newconfig && glyphTrack.newconfig.exprbin_flipstrand !== undefined) { 
    exprbin_flipstrand = glyphTrack.newconfig.exprbin_flipstrand;
  }
  var flipstrandCheck = div3.appendChild(document.createElement('input'));
  flipstrandCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  flipstrandCheck.setAttribute('type', "checkbox");
  if(exprbin_flipstrand) { flipstrandCheck.setAttribute('checked', "checked"); }
  flipstrandCheck.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_flipstrand', this.checked);");
  var span1 = div3.appendChild(document.createElement('span'));
  span1.innerHTML = "flip strand";

  var tspan2 = div3.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "margin: 1px 0px 1px 20px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  tspan2.innerHTML = "fixed bin size:";
  var binsizeInput = div3.appendChild(document.createElement('input'));
  binsizeInput.className = "sliminput";
  binsizeInput.style.width = "40px";
  binsizeInput.setAttribute('type', "text");
  binsizeInput.setAttribute('value', glyphTrack.exprbin_binsize);
  binsizeInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_binsize', this.value);");
  binsizeInput.setAttribute("onchange", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_binsize', this.value);");

  var editButton = div3.appendChild(document.createElement('input'));
  editButton.setAttribute("type", "button");
  editButton.className = "slimbutton";
  editButton.style.float = "right";
  editButton.setAttribute("value", "edit as script");
  editButton.setAttribute("onclick", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'exprbin_editxml', '');");
}



//--------------------------------------------------------
//
// track re-configuration control panel section
//
//--------------------------------------------------------

function gLyphsTrackToggleSubpanel(trackID, mode) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
  if(!glyphTrack.svg) { return; }

  if(!glyphTrack.subpanel_div) {
    glyphTrack.subpanel_div = document.createElement('div');
  }
  trackDiv.appendChild(glyphTrack.subpanel_div);
  glyphTrack.subpanel_div.innerHTML = "";

  if((mode=="none") || (mode == glyphTrack.subpanelMode)) {
    //same so toggle off;
    if(glyphTrack.signalCSI) { glyphTrack.signalCSI.newconfig = new Object(); } //clear
    if(glyphTrack.signal_user_color) { zenbuColorSpaceSetUserColor(glyphTrack.signal_user_color); }
    glyphTrack.subpanelMode = "none";
    glyphTrack.newconfig = undefined;
    glyphTrack.download = undefined;
    return;
  }
  glyphTrack.subpanelMode = mode;
  
  if(mode == "reconfig") {
    zenbuReconfigureTrackPanel(glyphTrack);
  }
  if(mode == "download") {
    gLyphsDownloadTrackPanel(glyphTrack);
  }
}


function zenbuReconfigureTrackPanel(glyphTrack) {
  if(!glyphTrack) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
  trackID = glyphTrack.trackID;

  if(!glyphTrack.subpanel_div) { glyphTrack.subpanel_div = document.createElement('div'); }
  trackDiv.appendChild(glyphTrack.subpanel_div);
  glyphTrack.subpanel_div.innerHTML = "";

  var trackRect = glyphTrack.trackDiv.getBoundingClientRect();  

  //glyphTrack.newconfig = new Object;
  //if(glyphTrack.script) {
  //  //always clone the script into newconfig
  //  glyphTrack.newconfig.script = Object.clone(glyphTrack.script);
  //} 
  
  var divFrame = document.createElement('div');
  divFrame.id = trackID+"_reconfigure_divframe";
  divFrame.setAttribute('style', "position:absolute; text-align:left; "  
                            //PaleGreen, 245,245,250  152,232,250  181,241,255
                            +"background-color:rgb(235,235,240); padding: 5px 5px 5px 5px; "
                            +"border:2px solid #808080; border-radius: 4px; "
                            //+"border:inset; border-width:1px; "
                            +"font-size:10px; font-family:arial,helvetica,sans-serif; "
                            +"left:"+(trackRect.right + window.scrollX - 515) +"px; "
                            +"top:"+(trackRect.top + window.scrollY+12)+"px; "
                            +"width:500px;"
                             );
  glyphTrack.subpanel_div.appendChild(divFrame);
  glyphTrack.reconfig_div = divFrame;

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
  //a1.setAttribute("onclick", "gLyphsTrackToggleSubpanel(\"" + trackID + "\", 'none'); return false;");

  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //wiki help
  helpdiv = divFrame.appendChild(document.createElement('div'));
  helpdiv.setAttribute("style", "float:right; margin-right:3px; padding:0px 3px 0px 3px; font-size:10px; color:#505050; background-color:#D0D0D0;");
  helpdiv.setAttribute("onclick", "zenbuRedirect('https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/Configuring_Tracks');");
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

  //tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif;");
  //var src_msg = "data sources: ";
  //if(fsrc_count>0) { src_msg += "feature_sources["+fsrc_count+"]  "; }
  //if(exp_count>0)  { src_msg += "experiments["+exp_count+"]"; } 
  //tspan.innerHTML = src_msg;
    
  if(!glyphTrack.DSI) {
    glyphTrack.DSI = zenbuDatasourceInterface();
  }
  glyphTrack.DSI.newconfig = new Object;
  glyphTrack.DSI.trackID = glyphTrack.trackID;
  glyphTrack.DSI.allowChangeDatasourceMode = false;
  glyphTrack.DSI.enableResultFilter = false;
  glyphTrack.DSI.allowMultipleSelect = true;
  glyphTrack.DSI.datasource_mode = "all_data";
  glyphTrack.DSI.style.marginLeft = "5px";
  glyphTrack.DSI.style.marginRight = "5px";  
  glyphTrack.DSI.main_div = glyphTrack.trackDiv;
  glyphTrack.DSI.config_subpanel = glyphTrack.reconfig_div;
  glyphTrack.DSI.source_ids = glyphTrack.source_ids;
  glyphTrack.DSI.collaboration_filter = "all"; //might change to a save state
  glyphTrack.DSI.species_filter = glyphTrack.glyphsGB.asm;
  glyphTrack.DSI.edit_datasource_query = false;  //start up not in edit mode
  if(!glyphTrack.DSI.source_ids) { 
    glyphTrack.DSI.edit_datasource_query = true; 
    glyphTrack.reconfig_div.style.left = (trackRect.right + window.scrollX - 765) +"px; ";
  }
  tdiv.appendChild(glyphTrack.DSI);
  glyphTrack.DSI.updateCallOutFunction = gLyphsTrackDSIUpdate;  
  zenbuDatasourceInterfaceUpdate(glyphTrack.DSI.id);

  
  /* new code not finished
  //TODO: security error message and reconfigure button
  if(glyphTrack.security_error) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif; color:red; margin-left:10px;");
    tspan.innerHTML = glyphTrack.security_error + " blocked";

    //for(var expID in glyphTrack.experiments) {
    //  var experiment = glyphTrack.experiments[expID];
    //  if(!experiment) { continue; }
    //  if(glyphTrack.blocked_sources[expID]) { experiment.hide = true; } else { experiment.hide = false; }
    //}

    //button = tdiv.appendChild(document.createElement("input"));
    //button.setAttribute("type", "button");
    //button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //button.setAttribute('onclick', "gLyphsTrack_reconfig_with_visible_experiments()");
    //button.setAttribute('value', "reconfigure without blocked");
    //button.setAttribute('value', "reconfigure");
    //button.innerHTML = "reconfigure without blocked";
  }
  */

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
  link1.setAttribute("href", "./#config=" +glyphTrack.glyphsGB.configUUID);
  link1.setAttribute("style", "color:gray;");
  link1.setAttribute("onclick", "gLyphsTrackDatastreamXMLPanel(\""+ trackID+"\"); return false;");
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
    tspan.innerHTML = "source datatype:"; 
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
  helpdiv.setAttribute("onclick", "zenbuRedirect('https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/Track_visualization_styles');");
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

  var button2 = document.createElement('input');
  button2.id = trackID + "_acceptConfigButton";
  button2.type = "button";
  button2.value = "accept";
  button2.className = "medbutton";
  button2.style.float = "right";
  button2.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-reconfig');");
  if(!glyphTrack.newconfig) { button2.setAttribute("disabled", "disabled"); }
  divFrame.appendChild(button2);

  var button1 = document.createElement('input');
  button1.id = trackID + "_cancelConfigButton";
  button1.type = "button";
  button1.value = "discard changes";
  button1.className = "medbutton";
  button1.style.float = "right";
  button1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'cancel-reconfig');");
  //button1.setAttribute("onclick", "gLyphsTrackToggleSubpanel(\"" + trackID + "\", 'none');");
  if(!glyphTrack.newconfig) { button1.setAttribute("disabled", "disabled"); }
  divFrame.appendChild(button1);
  
  //--
  
  var button5 = document.createElement('input');
  button5.type = "button";
  button5.value = "reload";
  button5.className = "medbutton";
  button5.style.float = "left";
  button5.setAttribute("onclick", "reloadTrack(\""+ trackID+"\");");
  divFrame.appendChild(button5);

  var button3 = document.createElement('input');
  button3.type = "button";
  button3.value = "share track";
  button3.className = "medbutton";
  button3.style.float = "left";
  button3.setAttribute("onclick", "glyphsSaveTrackConfig(\""+ trackID+"\");");
  divFrame.appendChild(button3);
  if(glyphTrack.uuid) { 
    button3.setAttribute("disabled", "disabled"); 
    button3.setAttribute("value", "track shared");
  }

  var button4 = document.createElement('input');
  button4.id = trackID + "_saveScriptButton";
  button4.type = "button";
  button4.value = "save script";
  button4.className = "medbutton";
  button4.style.float = "left";
  button4.setAttribute("disabled", "disabled");
  button4.setAttribute("onclick", "glyphsSaveScriptConfig(\""+ trackID+"\");");
  divFrame.appendChild(button4);


  //----------
  buildStreamProcessDiv(glyphTrack);

  //scroll page if need to show full panel
  var doc_bottom = document.documentElement.clientHeight + window.scrollY; //visible bottom of page
  var panelRect = glyphTrack.reconfig_div.getBoundingClientRect();  
  if(panelRect.top < 0) {
    //console.log("top is off screen to scroll down");
    window.scrollTo(0, panelRect.top+window.scrollY);
  }
  if(panelRect.bottom+window.scrollY >= doc_bottom) {
    //console.log("bottom is off screen to scroll up");
    var new_scroll = window.scrollY + 5 +(panelRect.bottom+window.scrollY - doc_bottom);
    window.scrollTo(0, new_scroll);
  }
}


function gLyphsTrackDSIUpdate(uniqID, mode) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(zenbuDSI == null) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[zenbuDSI.trackID];
  if(glyphTrack == null) { return; }

  console.log("gLyphsTrackDSIUpdate "+uniqID+" "+glyphTrack.trackID+" mode:"+mode);

  if(mode=="select_source") {
    reconfigTrackParam(glyphTrack.trackID, 'source_ids', zenbuDSI.newconfig.source_ids);
    createDatatypeSelect(glyphTrack.trackID); //refresh
  } else {
    reconfigTrackParam(glyphTrack.trackID, 'refresh');
  }
}


function createGlyphstyleSelect(glyphTrack) {
  //var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  var trackID = glyphTrack.trackID;
  //console.log("createGlyphstyleSelect "+trackID);

  var colorMode = glyphTrack.colorMode;
  if(glyphTrack.newconfig && glyphTrack.newconfig.colorMode !== undefined) {  colorMode = glyphTrack.newconfig.colorMode; }

  var featureSortMode = glyphTrack.featureSortMode;
  if(glyphTrack.newconfig && glyphTrack.newconfig.featureSortMode !== undefined) {  featureSortMode = glyphTrack.newconfig.featureSortMode; }

  var hide_zero = glyphTrack.hide_zero;
  if(glyphTrack.newconfig && glyphTrack.newconfig.hide_zero !== undefined) { hide_zero = glyphTrack.newconfig.hide_zero; }

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphTrack.newconfig && glyphTrack.newconfig.glyphStyle !== undefined) { glyphStyle = glyphTrack.newconfig.glyphStyle; }

  var div1         = document.getElementById(trackID + "_glyphselectDiv");
  var glyphSelect  = document.getElementById(trackID + "_glyphselect");
  var colorOptions = document.getElementById(trackID + "_glyphselect_color_options");
  var colorModeDiv = document.getElementById(trackID + "_colormode_div");
  var colorRadio1  = document.getElementById(trackID + "_colormode_radio1");
  var colorRadio2  = document.getElementById(trackID + "_colormode_radio2");
  var colorRadio3  = document.getElementById(trackID + "_colormode_radio3");
  var featSortRadio1  = document.getElementById(trackID + "_featsortmode_radio1");
  var featSortRadio2  = document.getElementById(trackID + "_featsortmode_radio2");
  var zeroexpCheck = document.getElementById(trackID + "_glyphselect_hidezeroexps_check");
  var expressOptDiv  = document.getElementById(trackID + "_extendedExpressOptions");
  var expressOpts2  = document.getElementById(trackID + "_expressOptions2");
  var dtypeSelect    = document.getElementById(trackID + "_glyphselect_datatype");
  var strandColorDiv = document.getElementById(trackID + "_glyphselect_strand_colors");  
  //var strandlessOpt = document.getElementById(trackID + "_strandlessOption");
  var fillOpt       = document.getElementById(trackID + "_fillOption");
  var featSortModeSpan = document.getElementById(trackID + "_featSortModeSpan");

  if(!div1) {
    div1 = document.createElement('div');
    div1.id = trackID + "_glyphselectDiv";
    div1.setAttribute("style", "margin:2px 0px 2px 0px;");

    var span2 = div1.appendChild(document.createElement('span'));
    span2.innerHTML = "visualization style: ";

    glyphSelect = div1.appendChild(document.createElement('select'));
    glyphSelect.id = trackID + "_glyphselect";
    glyphSelect.className = "dropdown";
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
    levelInput.className = "sliminput";
    levelInput.setAttribute('size', "5");
    levelInput.setAttribute('type', "text");
    levelInput.setAttribute('value', glyphTrack.track_height);
    levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'height', this.value);");
    
    //----- whole chromosome zoom-out scale like cytoband
    var wholeChromCheck = expressOptDiv.appendChild(document.createElement('input'));
    wholeChromCheck.style = "margin: 1px 2px 1px 10px;";
    wholeChromCheck.type = "checkbox";
    if(glyphTrack.whole_chrom_scale) { wholeChromCheck.setAttribute('checked', "checked"); }
    wholeChromCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'whole_chrom_scale', this.checked);");
    var span1 = expressOptDiv.appendChild(document.createElement('span'));
    span1.innerHTML = "chromosome zoom out";

    // var strandlessOpt = expressOptDiv.appendChild(document.createElement('span'));
    // strandlessOpt.id = trackID + "_strandlessOption";
    // strandlessOpt.style.display = "none";
    // var strandlessCheck = strandlessOpt.appendChild(document.createElement('input'));
    // strandlessCheck.id = trackID + "_strandlessVisualCheck";
    // strandlessCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
    // strandlessCheck.setAttribute('type', "checkbox");
    // if(glyphTrack.strandless) { strandlessCheck.setAttribute('checked', "checked"); }
    // strandlessCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'strandless', this.checked);");
    // var span1 = strandlessOpt.appendChild(document.createElement('span'));
    // span1.innerHTML = "strandless";
    
    var fillOpt = expressOptDiv.appendChild(document.createElement('span'));
    fillOpt.id = trackID + "_fillOption";
    fillOpt.style.display = "none";
    var fillinCheck = fillOpt.appendChild(document.createElement('input'));
    fillinCheck.style = "margin: 1px 2px 1px 10px;";
    fillinCheck.type = "checkbox";
    if(glyphTrack.xyplot_fill) { fillinCheck.setAttribute('checked', "checked"); }
    fillinCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'xyplot_fill', this.checked);");
    var span1 = fillOpt.appendChild(document.createElement('span'));
    span1.innerHTML = "height fill";

    //--------------
    expressOpts2 = expressOptDiv.appendChild(document.createElement('div'));
    expressOpts2.id = trackID + "_expressOptions2";
    expressOpts2.setAttribute('style', "display:block");
    
    //----
    /*
    var span4 = expressOpts2.appendChild(document.createElement('span'));
    span4.innerHTML = "min signal: ";
    var levelInput = expressOpts2.appendChild(document.createElement('input'));
    levelInput.className = "sliminput";
    levelInput.setAttribute('size', "5");
    levelInput.setAttribute('type', "text");
    levelInput.setAttribute('value', glyphTrack.scale_min_signal);
    levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'scale_min_signal', this.value);");
    levelInput.setAttribute("onmouseover", "eedbMessageTooltip('min_signal: "+(glyphTrack.min_signal)+"',150);");
    levelInput.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    */
    var span4 = expressOpts2.appendChild(document.createElement('span'));
    //span4.setAttribute('style', "margin-left: 3px;");
    span4.innerHTML = "max signal: ";
    var levelInput = expressOpts2.appendChild(document.createElement('input'));
    levelInput.className = "sliminput";
    levelInput.setAttribute('size', "5");
    levelInput.setAttribute('type', "text");
    levelInput.setAttribute('value', glyphTrack.scale_max_signal);
    levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'scale_max_signal', this.value);");
    levelInput.setAttribute("onmouseover", "eedbMessageTooltip('max signal: "+(glyphTrack.max_express)+"',150);");
    levelInput.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    
    var span2 = expressOpts2.appendChild(document.createElement('span'));
    span2.setAttribute('style', "margin: 1px 2px 1px 5px;");
    span2.innerHTML = "experiment merge:";
    var binningSelect = expressOpts2.appendChild(createExperimentMergeSelect(glyphTrack.trackID));
    
    var span3 = expressOpts2.appendChild(document.createElement('span'));
    var logCheck = span3.appendChild(document.createElement('input'));
    logCheck.setAttribute('style', "margin: 1px 2px 1px 10px;");
    logCheck.setAttribute('type', "checkbox");
    if(glyphTrack.logscale == 1) { logCheck.setAttribute('checked', "checked"); }
    logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'logscale', this.checked);");
    var span1 = span3.appendChild(document.createElement('span'));
    span1.innerHTML = "log scale";

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
    

    //-------- feature sort order mode
    featSortModeSpan = colorModeDiv.appendChild(document.createElement('span'));
    featSortModeSpan.id = trackID + "_featSortModeSpan";
    featSortModeSpan.style.marginLeft = "25px";
    featSortModeSpan.appendChild(document.createTextNode("feature sort order:"));

    featSortRadio1 = featSortModeSpan.appendChild(document.createElement('input'));
    featSortRadio1.setAttribute("type", "radio");
    featSortRadio1.setAttribute("id", trackID + "_featsortmode_radio1");
    featSortRadio1.setAttribute("name", trackID + "_featsortmode");
    featSortRadio1.setAttribute("value", "position");
    if(featureSortMode == "position") { featSortRadio1.checked = "checked"; }
    featSortRadio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'featureSortMode', this.value);");
    tspan = featSortModeSpan.appendChild(document.createElement('span'));
    tspan.innerHTML = "position";

    featSortRadio2 = featSortModeSpan.appendChild(document.createElement('input'));
    featSortRadio2.setAttribute("type", "radio");
    featSortRadio2.setAttribute("id", trackID + "_featsortmode_radio2");
    featSortRadio2.setAttribute("name", trackID + "_featsortmode");
    featSortRadio2.setAttribute("value", "signal");
    if(featureSortMode == "signal") { featSortRadio2.checked = "checked"; }
    featSortRadio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'featureSortMode', this.value);");
    tspan = featSortModeSpan.appendChild(document.createElement('span'));
    tspan.innerHTML = "signal";

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
  styles.push("signal-histogram", "split-signal", "xyplot", "arc", "1D-heatmap", "experiment-heatmap");
  styles.push("thick-arrow", "medium-arrow", "thin-arrow", "arrow", "centroid");
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
  if(featureSortMode == "position") { featSortRadio1.checked = "checked"; }
  if(featureSortMode == "signal")   { featSortRadio2.checked = "checked"; }

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

  //if(glyphStyle == "signal-histogram" || glyphStyle == "xyplot" || glyphStyle == "split-signal") {
  if(glyphStyle == "signal-histogram" || glyphStyle == "split-signal") {
    expressOptDiv.style.display = "block";
    //strandlessOpt.style.display  = "inline";
    fillOpt.style.display  = "none";
    expressOpts2.style.display = "block";
    colorModeDiv.style.display  = "none";
    featSortModeSpan.style.display = "none";
  } else if(glyphStyle == "xyplot") {
    expressOptDiv.style.display = "block";
    //strandlessOpt.style.display  = "inline";
    fillOpt.style.display  = "inline";
    expressOpts2.style.display = "block";
    colorModeDiv.style.display  = "block";
    featSortModeSpan.style.display = "none";
  } else if(glyphStyle == "experiment-heatmap" || glyphStyle == "1D-heatmap") {
    expressOptDiv.style.display = "block";
    //strandlessOpt.style.display  = "none";
    fillOpt.style.display  = "none";
    expressOpts2.style.display = "none";
    //colorModeDiv.style.display  = "block"; //TODO: extend heatmap coloring to allow strand or fixed colors
    colorModeDiv.style.display  = "none";
    featSortModeSpan.style.display = "none";
  } else if(glyphStyle == "arc") {
    expressOptDiv.style.display = "block";
    //strandlessOpt.style.display  = "inline";
    fillOpt.style.display  = "none";
    expressOpts2.style.display  = "none";
    colorModeDiv.style.display  = "block";
    featSortModeSpan.style.display = "none";
  } else {
    expressOptDiv.style.display = "none";
    colorModeDiv.style.display  = "block";
    featSortModeSpan.style.display = "inline";
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
      datatypeSelect.className = "dropdown";
      datatypeSelect.style.margin = "1px 4px 1px 4px";
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  var overlapmodeSelect = document.createElement('select');
  overlapmodeSelect.setAttribute('name', "submode");
  overlapmodeSelect.className = "dropdown";
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return null; }

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) { 
    datatypeSelect = document.createElement('select');
    datatypeSelect.className = "dropdown";
    datatypeSelect.setAttribute('name', "datatype");
    datatypeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'exptype', this.value);");
    datatypeSelect.id = trackID + "_datatypeSelect";
  }
  datatypeSelect.innerHTML = ""; //to clear old content

  var option = document.createElement('option');
  option.setAttribute("value", "-");
  option.innerHTML = "< all datatypes >";
  option.selected = "selected";
  datatypeSelect.appendChild(option);

  var source_ids = "";
  if(glyphTrack.source_ids) { source_ids = glyphTrack.source_ids; }
  if(glyphTrack.newconfig && glyphTrack.newconfig.source_ids) { source_ids = glyphTrack.newconfig.source_ids; }
  
  if(source_ids == "") { return datatypeSelect; }

  datatypeSelect.setAttribute('disabled', "disabled");
  if(glyphTrack.exptype && glyphTrack.exptype!="-") {
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

  datatypeXHR.open("POST", eedbSearchFCGI, true);
  datatypeXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //datatypeXHR.setRequestHeader("Content-length", paramXML.length);
  //datatypeXHR.setRequestHeader("Connection", "close");
  datatypeXHR.send(paramXML);

  return datatypeSelect;
}


function displayDatatypeSelect(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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

  var option = document.createElement('option');
  option.setAttribute("value", "-");
  option.innerHTML = "< all datatypes >";
  option.setAttribute("selected", "selected");
  datatypeSelect.appendChild(option);

  var exptype = glyphTrack.exptype;
  if(glyphTrack.newconfig && glyphTrack.newconfig.exptype) { exptype = glyphTrack.newconfig.exptype; }

  var types = xmlDoc.getElementsByTagName("datatype");
  var sortedTypes = new Array();
  var selectOK = false;
  var defaultType = "";
  //console.log("dataypes: ");
  if(exptype == "-") { selectOK=true; } //all datatypes
  for(var i=0; i<types.length; i++) {
    sortedTypes.push(types[i]);
    var type = types[i].getAttribute("type");
    if(type == exptype) { selectOK = true; }
    //console.log("["+type+"]");

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
    console.log("exptype undef :: change to default ["+defaultType+"]");
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
  if(sortedTypes.length==0) {
    datatypeSelect.setAttribute('disabled', "disabled");
  }

  return datatypeSelect;
}

function datatype_sort_func(a,b) {
  var name1 = a.getAttribute("type").toUpperCase();
  var name2 = b.getAttribute("type").toUpperCase();
  return (name2 < name1) - (name1 < name2);
}



function createBinningSelect(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  var binningSelect = document.createElement('select');
  binningSelect.className = "dropdown";
  binningSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'binning', this.value);");

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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  var binningSelect = document.createElement('select');
  binningSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'experiment_merge', this.value);");
  binningSelect.className = "dropdown";
  
  var valueArray = new Array("sum", "mean", "max", "min");
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  var outmodeSelect = document.createElement('select');
  outmodeSelect.id = trackID + "_source_outmode_select";
  outmodeSelect.className = "dropdown";
  outmodeSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'source_outmode', this.value);");
  
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

function gLyphsTrackDatastreamXMLPanel(trackID) {
  //a simple pop-up style panel to make it easy to get the <datastream> XML 
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  dstream_panel.setAttribute('style', "position:absolute; background-color:rgb(230,230,240); text-align:left; " //#CAFBDA
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
  a1.setAttribute("onclick", "gLyphsTrackDatastreamXMLPanelClose(\""+trackID+"\");return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  tspan = dstream_panel.appendChild(document.createElement('div'));
  tspan.setAttribute("style", "font-size:12px; margin:5px 0px 3px 10px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  tspan.innerHTML ="Track datastream XML";
  
  //make sure the source information is loaded into sources_hash
  if(!glyphTrack.sources_hash) {
    tdiv = dstream_panel.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:10px; margin:5px 0px 3px 10px; font-family:arial,helvetica,sans-serif; ");
    tdiv.innerHTML = "loading track sources info...";
    glyphTrack.show_source_xml=true;
    gLyphsTrackFetchSourcesInfo(trackID);
    return;
  }

  //----------
  var dataArea = dstream_panel.appendChild(document.createElement('textarea'));
  dataArea.setAttribute('style', "min-width:430px; max-width:430px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; resize:none;");
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


function gLyphsTrackDatastreamXMLPanelClose(trackID) {
  var dstream_panel = document.getElementById(trackID + "_datastream_xml_panel");
  if(!dstream_panel) { return; }
  dstream_panel.style.display = 'none';
}



//--------------------------------------------------------
//
// download data from track control panel section
//
//--------------------------------------------------------


function gLyphsDownloadTrackPanel(glyphTrack) {
  if(glyphTrack == null) { return; }
  var trackID = glyphTrack.trackID;

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
  
  if(!glyphTrack.subpanel_div) {
    glyphTrack.subpanel_div = document.createElement('div');
  }
  trackDiv.appendChild(glyphTrack.subpanel_div);
  glyphTrack.subpanel_div.innerHTML = "";
  
  var trackRect = glyphTrack.trackDiv.getBoundingClientRect();
                            
  if(!glyphTrack.svg) { return; }

  //if(glyphTrack.newconfig !== undefined) { return; }
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
  glyphTrack.download.location = glyphTrack.glyphsGB.chrom +":" + glyphTrack.glyphsGB.start + ".." + glyphTrack.glyphsGB.end;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; text-align:left; " //background-color:PaleTurquoise;
                            +"background-color:rgb(235,235,240); padding: 5px 5px 5px 5px; "
                            +"border:2px solid #808080; border-radius: 4px; "
                            //+"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"font-size:10px; font-family:arial,helvetica,sans-serif; "
                            +"left:"+(trackRect.right + window.scrollX - 385) +"px; "
                            +"top:"+(trackRect.top + window.scrollY+12)+"px; "
                            +"width:370px;"
                             );
  glyphTrack.subpanel_div.appendChild(divFrame);
  glyphTrack.download_div = divFrame;

  var tdiv, tdiv2, tspan, tlabel;

  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsTrackToggleSubpanel(\"" + trackID + "\", 'none'); return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
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
  button2.className = "medbutton";
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "download data");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-download');");

  //-------------------------------------------
  gLyphsDownloadOptions(glyphTrack);
  gLyphsDownloadRegionBuildStats(trackID);
}


function createDownloadFormatSelect(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  var span1 = document.createElement('span');
  span1.setAttribute("style", "margin:2px 0px 2px 0px;");

  var span2 = document.createElement('span');
  span2.innerHTML = "download format: ";
  span1.appendChild(span2);

  var formatSelect = span1.appendChild(document.createElement('select'));
  formatSelect.className = "dropdown";
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

  if(glyphTrack.download.format == "gff") {
    download_options.innerHTML = "";
    download_options.style.display = "block";

    //-----
    var tdiv = download_options.appendChild(document.createElement('div'));
    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'download-feature-metadata', this.checked);");
    if(glyphTrack.download.feature_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "feature metadata";
  }
}


function glyphsPostDownloadRequest(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  //trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  glyphTrack.newconfig = undefined;

  gLyphsShowTrackLoading(trackID);

  var asm    = glyphTrack.glyphsGB.asm;
  var chrom  = glyphTrack.glyphsGB.chrom;
  var start  = glyphTrack.glyphsGB.start;
  var end    = glyphTrack.glyphsGB.end;
  var chromloc = chrom +":" + start + ".." + end;

  var dwidth     = glyphTrack.glyphsGB.display_width;
  
  var url = eedbRegionCGI;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<format>"+glyphTrack.download.format+"</format>\n";
  paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n";
  paramXML += "<view_uuid>"+ glyphTrack.glyphsGB.configUUID +"</view_uuid>\n";

  paramXML += "<export_subfeatures>"+glyphTrack.download.subfeatures+"</export_subfeatures>\n";
  paramXML += "<export_feature_metadata>"+glyphTrack.download.feature_metadata+"</export_feature_metadata>\n";
  paramXML += "<export_experiment_metadata>"+glyphTrack.download.experiment_metadata+"</export_experiment_metadata>\n";
  paramXML += "<export_osc_metadata>"+glyphTrack.download.osc_metadata+"</export_osc_metadata>\n";

  paramXML += "<asm>"+glyphTrack.glyphsGB.asm+"</asm>\n";

  if(glyphTrack.download.mode == "selection") {
    var ss = glyphTrack.selection.chrom_start;
    var se = glyphTrack.selection.chrom_end;
    if(ss>se) { var t=ss; ss=se; se=t; }
    chromloc = chrom +":" + ss + ".." + se;
    paramXML += "<loc>"+chromloc+"</loc>\n";
    paramXML += "<mode>region</mode>\n";
  }
  if(glyphTrack.download.mode == "visible") {
    paramXML += "<loc>"+chromloc+"</loc>\n";
    paramXML += "<mode>region</mode>\n";
  }
  if(glyphTrack.download.mode == "genome") {
    paramXML += "<genome_scan>genome</genome_scan>\n";
    paramXML += "<mode>genome_scan</mode>\n";
  }
  if(glyphTrack.download.mode == "location") {
    paramXML += "<loc>"+glyphTrack.download.location+"</loc>\n";
    paramXML += "<mode>region</mode>\n";
  }

  if(glyphTrack.download.savefile) { paramXML += "<savefile>true</savefile>\n"; }

  paramXML += "<output_datatype>" + glyphTrack.datatype + "</output_datatype>\n";

  paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";

  paramXML += "</zenbu_query>\n";
  console.log(paramXML);
  
  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:640px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = paramXML;
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
   
  var build_stats = document.getElementById(trackID + "_download_buildstats");
  if(!build_stats) return;  

  var download_ctrls = document.getElementById(trackID + "_download_ctrls");
  if(download_ctrls) { download_ctrls.style.display = "none"; }

  var dynbin_div = document.getElementById(trackID + "_download_dyn_binsize");
  if(dynbin_div) { dynbin_div.style.display = "none"; }

  //eedbShowLogin();

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

  var asm      = glyphTrack.glyphsGB.asm;
  var chrom    = glyphTrack.glyphsGB.chrom;
  var start    = glyphTrack.glyphsGB.start;
  var end      = glyphTrack.glyphsGB.end;
  var chromloc = chrom +":" + start + ".." + end;
  var dwidth   = glyphTrack.glyphsGB.display_width;
  
  var paramXML = "<zenbu_query><format>xml</format><mode>trackcache_stats</mode>\n";
  
  if(glyphTrack.hashkey && !glyphTrack.loading) { 
    paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";
  } else {
    if(glyphTrack.peerName) { paramXML += "<peer_names>"+glyphTrack.peerName+"</peer_names>\n"; }
    if(glyphTrack.source_ids) { paramXML += "<source_ids>"+glyphTrack.source_ids+"</source_ids>\n"; }
    else {
      if(glyphTrack.sources) { paramXML += "<source_names>"+glyphTrack.sources+"</source_names>\n"; }
    }
    if(glyphTrack.exptype && glyphTrack.exptype!="-") { paramXML += "<exptype>"+glyphTrack.exptype+"</exptype>\n"; }
    if(glyphTrack.uuid) { paramXML += "<track_uuid>"+glyphTrack.uuid+"</track_uuid>\n"; }
  
    paramXML += "<source_outmode>" + glyphTrack.source_outmode + "</source_outmode>\n";
    paramXML += "<display_width>"+glyphTrack.glyphsGB.display_width+"</display_width>\n";

    //if(glyphTrack.exprbin_strandless)  { paramXML += "<strandless>true</strandless>\n"; }
    //if(glyphTrack.exprbin_add_count)   { paramXML += "<add_count_expression>true</add_count_expression>\n"; }
    //if(glyphTrack.exprbin_subfeatures) { paramXML += "<overlap_check_subfeatures>true</overlap_check_subfeatures>\n"; }
    //if(glyphTrack.exprbin_flipstrand)  { paramXML += "<flip_strand>true</flip_strand>\n"; }
    //if(glyphTrack.exprbin_binsize) { paramXML += "<bin_size>"+ glyphTrack.exprbin_binsize +"</bin_size>\n"; }

    if(glyphTrack.spstream_mode == "expression") {
      paramXML += glyphsTrack_expressionConfigXML(glyphTrack);
      //paramXML += "<binning>"+glyphTrack.binning+"</binning>\n";
      //paramXML += "<binning>sum</binning>\n";
      //paramXML += "<overlap_mode>"+glyphTrack.overlap_mode+"</overlap_mode>\n";
      //if(!glyphTrack.script) {
      //  //switch back to the legacy default histogram binning
      //  paramXML += "<expression_binning>true</expression_binning>\n"; 
      //}
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

  paramXML += "<asm>"+glyphTrack.glyphsGB.asm+"</asm>\n";
  
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var asm      = glyphTrack.glyphsGB.asm;
  if(buildstatsXMLHttp.responseXML == null) { stats_msg.innerHTML = "checking..."; return; }
  if(buildstatsXMLHttp.readyState!=4) { stats_msg.innerHTML = "checking..."; return; }
  if(buildstatsXMLHttp.status!=200) { stats_msg.innerHTML = "checking..."; return; }
  if(buildstatsXMLHttp.responseXML == null) { stats_msg.innerHTML = "checking..."; return; }
  
  var xmlDoc=buildstatsXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    //console.log('Problem with central DB!');
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
      if(current_user) {
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
  
  //scroll page if need to show full panel
  var doc_bottom = document.documentElement.clientHeight + window.scrollY; //visible bottom of page
  var panelRect = glyphTrack.download_div.getBoundingClientRect();  
  if(panelRect.bottom+window.scrollY >= doc_bottom) {
    var new_scroll = window.scrollY + 5 +(panelRect.bottom+window.scrollY - doc_bottom);
    window.scrollTo(0, new_scroll);
  }
}


function gLyphsDownloadRequestBuild(trackID) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;
   
  if(!glyphTrack.hashkey) { return; }

  var asm      = glyphTrack.glyphsGB.asm;
  var chrom    = glyphTrack.glyphsGB.chrom;
  var start    = glyphTrack.glyphsGB.start;
  var end      = glyphTrack.glyphsGB.end;
  var chromloc = chrom +":" + start + ".." + end;
  var dwidth   = glyphTrack.glyphsGB.display_width;
  
  var paramXML = "<zenbu_query><format>xml</format><mode>request_build</mode>\n";
  paramXML += "<trackcache>"+ glyphTrack.hashkey+"</trackcache>\n";
  paramXML += "<track_title>"+ encodehtml(glyphTrack.title)+"</track_title>\n";
  paramXML += "<view_uuid>"+ glyphTrack.glyphsGB.configUUID +"</view_uuid>\n";
  paramXML += "<asm>"+glyphTrack.glyphsGB.asm+"</asm>\n";
  
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
// track tool callback functions for duplicate, moving, closing
//
//---------------------------------------------------------------

function gLyphsDuplicateTrack(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  if(!glyphTrack.glyphsGB) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var glyphset = glyphTrack.glyphsGB.gLyphTrackSet;
  if(!glyphset) { return; }

  var trackID2 = "glyphTrack" + (newTrackID++);
  //console.log("duplicate track " + trackID + "=>" + trackID2); 

  var newDiv = document.createElement('div');
  newDiv.setAttribute("align","left");
  newDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  newDiv.setAttribute("class", "gLyphTrack");
  newDiv.setAttribute("id", trackID2);
  glyphset.insertBefore(newDiv, trackDiv);

  //var glyphTrack2 = Object.clone(glyphTrack);
  var glyphTrack2 = zenbu_object_clone(glyphTrack);
  glyphTrack2.trackID  = trackID2;
  glyphTrack2.glyphsGB = glyphTrack.glyphsGB;
  glyphTrack2.trackDiv = newDiv;
  glyphTrack2.exp_panel_frame = undefined;  //so it regenerates
  glyphTrack2.svg      = createSVG(glyphTrack.glyphsGB.display_width+10, 13);
  glyphTrack2.glyphs_array = [];

  glyphTrack2.experiments = new Object;
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    //glyphTrack2.experiments[experiment.id] = Object.clone(experiment);
    glyphTrack2.experiments[experiment.id] = zenbu_object_clone(experiment);
  }

  glyphsTrack_global_track_hash[trackID2] = glyphTrack2;
  glyphTrack.glyphsGB.tracks_hash[trackID2] = glyphTrack2;

  gLyphsRenderTrack(glyphTrack2);

  gLyphsDrawTrack(trackID2);  //this creates empty tracks with the "loading" tag

  prepareTrackXHR(trackID2);
  glyphTrack.glyphsGB.autosave();
}


function removeTrack(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  if(!glyphTrack.glyphsGB) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var glyphset = glyphTrack.glyphsGB.gLyphTrackSet;
  if(!glyphset) { return; }

  if(glyphset) { glyphset.removeChild(trackDiv); }

  if(glyphTrack.trackID == glyphTrack.glyphsGB.active_trackID) {
    glyphTrack.glyphsGB.active_trackID = undefined;
  }

  glyphsTrack_global_track_hash[trackID] = null;
  glyphTrack.glyphsGB.tracks_hash[trackID] = null;

  active_track_XHRs[trackID] = null;
  pending_track_XHRs[trackID] = null;
  delete glyphsTrack_global_track_hash[trackID];
  delete glyphTrack.glyphsGB.tracks_hash[trackID];
  delete active_track_XHRs[trackID];
  delete pending_track_XHRs[trackID];

  gLyphsDrawExpressionPanel(glyphTrack.glyphsGB);
  //displayProbeInfo();  //old system not used anymore
  glyphTrack.glyphsGB.autosave();
}

//----- move/drag/resize section

function endDrag() {
  //console.log("global end drag ");
  moveTrack("enddrag");
  current_dragTrack = null;

  if(current_resizeTrack) {
    document.onmousemove = moveToMouseLoc;
    current_resizeTrack.resize = null;
    var trackID = current_resizeTrack.trackID;
    current_resizeTrack = null;

    gLyphsDrawTrack(trackID);
    //glyphTrack.glyphsGB.autosave();
  }

  document.body.style.cursor = 'default';

  selectTrackRegion("enddrag", currentSelectTrackID);
  return false;
}


function moveTrack(mode, trackID) {

  updateTrackingLine(trackID);

  if(mode=="enddrag") {
    //console.log("end move track: " + current_dragTrack.trackID);
    if(ns4) toolTipSTYLE.visibility = "hidden";
    else toolTipSTYLE.display = "none";
    document.onmousemove = moveToMouseLoc;

    if(current_dragTrack) {      
      console.log("need to lock "+current_dragTrack.trackID+" into position");

      var glyphsGB = current_dragTrack.glyphsGB
      var glyphset = null;
      if(glyphsGB) { glyphset = glyphsGB.gLyphTrackSet; }

      if(glyphset && current_dragTrack.move_snap_container) { 
        console.log("has a move_snap_container");
        glyphset.insertBefore(current_dragTrack.trackDiv, current_dragTrack.move_snap_container); //moves it
        glyphset.removeChild(current_dragTrack.move_snap_container); 
        current_dragTrack.move_snap_container = null;
        current_dragTrack.glyphsGB.autosave();
      }
      
      current_dragTrack.is_moving = false;
      current_dragTrack.trackDiv.style.position = "static";
      current_dragTrack.trackDiv.style.left = "";
      current_dragTrack.trackDiv.style.top = "";
      current_dragTrack.trackDiv.style.border = "";      
    }
    current_dragTrack = null;
    return;
  }

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  if(!glyphTrack.glyphsGB) { return; }

  var glyphset = glyphTrack.glyphsGB.gLyphTrackSet;
  if(!glyphset) { return; }

  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;  
  
  if(mode=="startdrag") {
    console.log("start dragging track "+trackID);
    current_dragTrack = glyphTrack;
    //document.onmouseup = endDrag;

    gLyphsChangeActiveTrack(glyphTrack);

    var trackRect = glyphTrack.trackDiv.getBoundingClientRect();
    console.log("trackRect x:"+trackRect.x+" y:"+trackRect.y+" left:"+trackRect.left+" top:"+trackRect.top+ " bottom:"+trackRect.bottom);

    current_dragTrack.is_moving = false;
    document.onmousemove = gLyphsTrackMoveEvent;

    current_dragTrack.move_orig_left = current_dragTrack.trackDiv.style.left;
    current_dragTrack.move_orig_top  = current_dragTrack.trackDiv.style.top;
    current_dragTrack.move_start_left = trackRect.left + window.scrollX;
    current_dragTrack.move_start_top  = trackRect.top + window.scrollY;
    current_dragTrack.move_start_xpos = xpos;
    current_dragTrack.move_start_ypos = ypos;
    //console.log("click xpos:"+xpos+"  ypos:"+ypos);
    //console.log("click x_offset:"+(current_dragTrack.move_start_xpos - current_dragTrack.move_start_left)+
    //          "  y_offset:"+(current_dragTrack.move_start_ypos-current_dragTrack.move_start_top));
    gLyphsTrackMoveEvent(e);
  }
  if(current_dragTrack == null) { return; }
}


function gLyphsTrackMoveEvent(e) {
  if(!current_dragTrack) { return; }
  
  var glyphsGB = current_dragTrack.glyphsGB
  if(!glyphsGB) { return; }

  var glyphset = glyphsGB.gLyphTrackSet;
  if(!glyphset) { return; }

  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

  if(!e) e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  var offset_x = xpos - current_dragTrack.move_start_xpos;
  var offset_y = ypos - current_dragTrack.move_start_ypos;
  
  var border_color = "#0070E9";
  var gbRect = glyphset.getBoundingClientRect();
  if(xpos<gbRect.left+window.scrollX || xpos>gbRect.right+window.scrollX || 
     ypos<gbRect.top+window.scrollY || ypos>gbRect.bottom+window.scrollY) {
    border_color = "red";
    //TODO: once I get multiple glyphsGB working, I can allow a track to be moved betweeen GBs
    //for now I just color it RED to indicate that you are trying to move it out of the GB
  }

  if(!current_dragTrack.is_moving) {
    //console.log("track is not moving yet offset_x:"+offset_x+"  offset_y:"+offset_y);
    if((Math.abs(offset_x) > 5) || (Math.abs(offset_y) > 5)) {
      //console.log("OK moved far enough to start a real move event");
      current_dragTrack.is_moving = true;
            
      var trackRect = current_dragTrack.trackDiv.getBoundingClientRect();
      console.log("create snap container trackRect x:"+trackRect.x+" y:"+trackRect.y+" left:"+trackRect.left+" top:"+trackRect.top+ " bottom:"+trackRect.bottom);

      //--- create the place holder div to show where the track will snap to when released
      //D62AEA 2AD6EA 00D6E9 00C2E9  #0070E9  #00AFE9  #3F00E9
      var tcontainer = document.createElement('div');
      var style = "background-color: transparent; margin: 0px 0px 1px 0px; padding:0px 0px 0px 0px; ";
      style += "border:dashed; border-width:2px; border-color:"+border_color+"; ";
      style += "width:"+(trackRect.width-4)+"px; ";
      style += "height:"+(trackRect.height-6)+"px; ";
      tcontainer.setAttribute('style', style);
      current_dragTrack.move_snap_container = tcontainer;
      
      glyphset.insertBefore(tcontainer, current_dragTrack.trackDiv);
    }
  }
  if(current_dragTrack.move_snap_container) {
    current_dragTrack.move_snap_container.style.borderColor = border_color;
  }
  if(!current_dragTrack.is_moving) { return; }
  
  var new_left = (current_dragTrack.move_start_left -2) + offset_x;
  var new_top  = (current_dragTrack.move_start_top -2) + offset_y;
  
  //console.log("should move now xpos:"+xpos+"  ypos:"+ypos+"  left:"+new_left+"  top:"+new_top);
  current_dragTrack.trackDiv.style.position = "absolute";
  current_dragTrack.trackDiv.style.left = new_left + "px";
  current_dragTrack.trackDiv.style.top  = new_top + "px";
  current_dragTrack.trackDiv.style.border = "2px solid "+border_color;

  //figure out the locking position for where the track should insert
  //place a fixed size dummy div into the glyphset as an indicator of where it will snap too

  var snapRect = current_dragTrack.move_snap_container.getBoundingClientRect();

  //console.log("=== about to check all tracks in glyphsGB");
  for(var trackID in glyphsGB.tracks_hash){
    var glyphTrack = glyphsGB.tracks_hash[trackID];
    if(!glyphTrack) { continue; }
    if(!glyphTrack.trackDiv) { continue; }
    if(glyphTrack.trackID == current_dragTrack.trackID) { continue; }

    var trackRect = glyphTrack.trackDiv.getBoundingClientRect();
    var snapDirection = "down";
    if(trackRect.top < snapRect.bottom) { snapDirection = "up"; }

    var theight = 20;
    if(snapRect.height < theight) { theight = snapRect.height -2; }
      
    var tleft = trackRect.left + window.scrollX;
    var tright = trackRect.right + window.scrollX;
    var ttop = trackRect.top + window.scrollY + 2;
    var tbottom = trackRect.top + window.scrollY + theight;
    if(tbottom > trackRect.bottom + window.scrollY) { tbottom = trackRect.bottom + window.scrollY -7; }
        
    if((xpos > tleft) && (xpos < tright) && (new_top > ttop) && (new_top < tbottom)) {
      console.log("current_dragTrack["+(current_dragTrack.trackID)+"] snap( "+snapDirection+" ) over "+(glyphTrack.trackID));
      //console.log(glyphTrack.trackID+" trackRect x:"+trackRect.x+" y:"+trackRect.y+" left:"+trackRect.left+" right:"+trackRect.right+
      //            " top:"+trackRect.top+ " bottom:"+trackRect.bottom);
      //console.log(glyphTrack.trackID+" trackRect tleft:"+tleft+" tright:"+tright+" ttop:"+ttop+ " tbottom:"+tbottom);
      if(snapDirection == "up") {
        glyphset.insertBefore(current_dragTrack.move_snap_container, glyphTrack.trackDiv);
      }
      if(snapDirection == "down") {
        var nextTrackDiv = glyphTrack.trackDiv.nextSibling;
        if(nextTrackDiv) {
          glyphset.insertBefore(current_dragTrack.move_snap_container, nextTrackDiv);
        } else {
          //moving off the end
          console.log("move after end");
          glyphset.appendChild(current_dragTrack.move_snap_container);
        }
      }
    }
  }
}

//-------------------------------------
function gLyphsResizeTrack(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack && glyphTrack.loading) { return; }

  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

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
  
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

  var glyphTrack = current_resizeTrack;

  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  var height = (ypos - glyphTrack.resize.ystart) + glyphTrack.resize.start_height;
  if(height<10) { height = 10; }
  glyphTrack.track_height = height;

  //recalculate the data transforms and then redraw
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


//---------------------------------------------------------------
//
// track selection
//
//---------------------------------------------------------------


function selectTrackRegion(mode, trackID, featureID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack && glyphTrack.loading) { return; }

  updateTrackingLine(trackID);

  if(mode=="startdrag") {
    gLyphsChangeActiveTrack(glyphTrack);

    glyphTrack.selection = new Object;  //an object to hold start,end,svg elements
    glyphTrack.selection.asm = glyphTrack.glyphsGB.asm;
    glyphTrack.selection.chrom = glyphTrack.glyphsGB.chrom;

    //console.log("total_obj_count = " + glyphTrack.total_obj_count);
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
  var start  = glyphTrack.glyphsGB.start;
  var end    = glyphTrack.glyphsGB.end;
  if(glyphTrack.whole_chrom_scale) { //drawing whole chromosome
    start = 0;
    if(glyphTrack.glyphsGB.chrom_length>0) { end = glyphTrack.glyphsGB.chrom_length; }
  }
  var dwidth = glyphTrack.glyphsGB.display_width;
  var chrpos = Math.floor(start + (xpos*(end-start)/dwidth));
  if(glyphTrack.glyphsGB.flip_orientation) { 
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
    console.log("enddrag xstart:"+glyphTrack.selection.xstart+"  xend:"+glyphTrack.selection.xend+"  featureID:"+featureID);
    if(glyphTrack.selection.xend == glyphTrack.selection.xstart) {
      //single point click so no selection
      glyphTrack.selection = null;
      if(featureID !== undefined) {
        eedbClearSearchTooltip();
        var fidx = Math.floor(featureID);
        if(fidx == featureID) {
          var obj = glyphTrack.feature_array[fidx];
          if(glyphTrack.selected_feature && !glyphTrack.selected_feature.id && !obj.id) {
            gLyphsTrackSelectFeature(glyphTrack); //clear feature selection
          } else {
            console.log("set glyphTrack.selected_feature "+obj.name+" id["+obj.id+"] fidx["+obj.fidx+"]");
            gLyphsTrackSelectFeature(glyphTrack, obj);
          }
          gLyphsRenderTrack(glyphTrack);
          gLyphsDrawTrack(trackID);
        } else {
          console.log("feature select by ID not fidx");
          var feature = eedbGetObject(featureID);
          gLyphsTrackSelectFeature(glyphTrack, feature);
          gLyphsRenderTrack(glyphTrack);
          gLyphsDrawTrack(trackID);
        }
      } else {
        //single point click not on feature will recenter
        if(glyphTrack.last_select_point == chrpos) {      
          gLyphsRecenterView(glyphTrack.glyphsGB, chrpos);
          glyphTrack.last_select_point = -1;    
        } else {
          glyphTrack.last_select_point = chrpos;    
        }
        if(glyphTrack.selected_feature) { 
          gLyphsTrackSelectFeature(glyphTrack); //clear feature selection
          gLyphsRenderTrack(glyphTrack);
          gLyphsDrawTrack(trackID);
        } else {
          zenbuFeatureInfoEvent('close'); //in case a selection-sequence panel is open
        }
      }
    }
    else if(glyphTrack.selection.chrom_start>glyphTrack.selection.chrom_end) { 
      var t=glyphTrack.selection.chrom_start; 
      glyphTrack.selection.chrom_start=glyphTrack.selection.chrom_end; 
      glyphTrack.selection.chrom_end=t; 
    }
    if(!featureID && glyphTrack.selected_feature) {
      gLyphsTrackSelectFeature(glyphTrack); //clear feature selection
      gLyphsRenderTrack(glyphTrack);
      gLyphsDrawTrack(trackID);
    } else if(glyphTrack.glyphStyle=="experiment-heatmap") {
      //in case sort order needs to change
      gLyphsRenderTrack(glyphTrack);
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
  //console.log(msg);

  //if(glyphTrack.glyphStyle == "signal-histogram") { gLyphsDrawTrack(trackID); } 
  //else { gLyphsDrawSelection(glyphTrack); }
  gLyphsDrawTrack(trackID);
  updateTrackingLine(trackID);
}


function gLyphsTrackSelectFeature(glyphTrack, feature) {
  if(!glyphTrack) { return; }
  
  //clear previous selections
  //if(!feature && glyphTrack.selected_feature) { console.log("gLyphsTrackSelectFeature clear selected_feature"); }
  if(glyphTrack.glyphsGB) { glyphTrack.glyphsGB.selected_feature = null;}
  glyphTrack.selected_feature = null;
  glyphTrack.search_select_filter = "";
  for(var i=0; i<glyphTrack.feature_array.length; i++) {
    var tf = glyphTrack.feature_array[i];
    if(tf) { tf.search_selected = false; }
  }
  if(!feature) {
    zenbuDisplayFeatureInfo(); //clears panel
    return; 
  }
  if(feature.classname != "Feature") { return; }

  //check if metadata/fullload has heppened, if not request it
  if(feature.id && !feature.full_load) { feature.request_full_load = true; }

  if(glyphTrack.selected_feature == feature) {
    if(!gLyphsCenterOnFeature(glyphTrack.glyphsGB, glyphTrack.selected_feature)) {
      //returns false if centering did not change
      zenbuDisplayFeatureInfo(glyphTrack.selected_feature);
    }
  } else {
    console.log("gLyphsTrackSelectFeature set selected_feature");
    glyphTrack.selected_feature = feature;
    zenbuDisplayFeatureInfo(feature);
  }
  gLyphsDrawExpressionPanel(glyphTrack.glyphsGB);
  if(glyphTrack.glyphsGB.selectionCallback) {
    glyphTrack.glyphsGB.selectionCallback();
  }
}


function gLyphsTrackSearchSelect(glyphTrack, filter) {
  if(!glyphTrack) { return; }
  glyphTrack.selected_feature = null; //clear previous selected_feature
  glyphTrack.search_select_filter = filter;
  //console.log("gLyphsTrackSearchSelect "+glyphTrack.trackID+" ["+filter+"]");

  for(var i=0; i<glyphTrack.feature_array.length; i++) {
    var feature = glyphTrack.feature_array[i];
    if(!feature) { continue; }
    gLyphsTrackSearchTestObject(glyphTrack, feature);
    if(feature.search_selected) {
      console.log("gLyphsTrackSearchSelect "+glyphTrack.trackID+" ["+filter+"] found match "+feature.id);
    }
  }
}


function gLyphsTrackSearchTestObject(glyphTrack, feature) {
  if(!feature) { return; }
  feature.search_selected = false;
  if(!glyphTrack.search_select_filter) { return; }
  var filter = glyphTrack.search_select_filter.toLowerCase();
  
  if(feature.name && (feature.name.toLowerCase().indexOf(filter) != -1)) {
    feature.search_selected = true;
    glyphTrack.selected_feature = feature; 
    return;
  }
  if(feature.source && feature.source.category && (feature.source.category.toLowerCase().indexOf(filter) != -1)) {
    feature.search_selected = true;
    glyphTrack.selected_feature = feature; 
    return;
  }
  if(feature.source && feature.source.name && (feature.source.name.toLowerCase().indexOf(filter) != -1)) {
    feature.search_selected = true;
    glyphTrack.selected_feature = feature; 
    return;
  }
  if(feature.chromloc && (feature.chromloc.toLowerCase().indexOf(filter) != -1)) {
    feature.search_selected = true;
    glyphTrack.selected_feature = feature; 
    return;
  }
  for(var tag in feature.mdata) { //new common mdata[].array system
    if(feature.search_selected) { return; }
    var value_array = feature.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      if(feature.search_selected) { return; }
      var value = value_array[idx1];
      if(value && (value.toLowerCase().indexOf(filter) != -1)) {
        feature.search_selected = true;
        glyphTrack.selected_feature = feature; 
        return;
      }
    }
  }
}


function magnifyToSelection(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  if(glyphTrack.selection == null) { return; }
 
  var selection = glyphTrack.selection;
  gLyphsSetLocation(glyphTrack.glyphsGB, glyphTrack.glyphsGB.asm, glyphTrack.glyphsGB.chrom, selection.chrom_start, selection.chrom_end);
  glyphTrack.selection = null;

  gLyphsEmptySearchResults(glyphTrack.glyphsGB);
  gLyphsReloadRegion(glyphTrack.glyphsGB);
  glyphTrack.glyphsGB.urlHistoryUpdate();
}


function updateTrackingLine(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var start  = glyphTrack.glyphsGB.start;
  var end    = glyphTrack.glyphsGB.end;
  var dwidth = glyphTrack.glyphsGB.display_width;
  var chrpos = Math.floor(start + (xpos*(end-start)/dwidth));
  if(glyphTrack.glyphsGB.flip_orientation) { 
    chrpos = Math.floor(start + (1 - xpos/dwidth)*(end-start));
  }
  xpos = (chrpos-start)*dwidth/(end-start); //snap back to single-base resolution
  if(isNaN(xpos)) { return; }

  if(glyphTrack.glyphsGB.flip_orientation) { xpos = dwidth-xpos; }
  
  glyphTrack.glyphsGB.trackline_xpos   = xpos;
  glyphTrack.glyphsGB.trackline_chrpos = chrpos;

  //console.log("trackline x:"+xpos + "  chrpos:"+chrpos);
  var desc = glyphTrack.glyphsGB.loc_desc;
  desc += "<span style=\'font-size:8pt; color: orangered;\'> " +chrpos+ "</span>";
  if(glyphTrack.glyphsGB.gLyphs_location_info) {
    glyphTrack.glyphsGB.gLyphs_location_info.innerHTML = desc;
  }

  //loop through all the tracks and update
  for(var id in glyphsTrack_global_track_hash){
    var glyphTrack = glyphsTrack_global_track_hash[id];
    if(glyphTrack.trackLine) {
      glyphTrack.trackLine.setAttributeNS(null, 'x', (glyphTrack.glyphsGB.trackline_xpos)+'px');
      glyphTrack.trackLine.setAttributeNS(null, 'opacity', "1");
      if(glyphTrack.is_moving) { glyphTrack.trackLine.setAttributeNS(null, 'opacity', "0"); }
    }
  }
}


//---------------------------------------------------------------------------
//
// predefined scripts query/view/selection section
//
//---------------------------------------------------------------------------

function gLyphsTrackSearchScripts(trackID, cmd) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
    //console.log('Problem with central DB!');
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
  
  var scriptsDiv = document.getElementById(trackID + "_script_search_div");
  if(scriptsDiv == null) { return; }
  scriptsDiv.innerHTML = "";
    
  var scripts_array = glyphTrack.predef_scripts;
  if(!scripts_array) { return; }
  scripts_array.sort(gLyphs_name_sort_func);  
  
  var div1 = scriptsDiv.appendChild(document.createElement('div'));
  div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");
  
  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(document.createElement('thead')).appendChild(document.createElement('tr'));
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'script name';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'description';
    
  var tbody = my_table.appendChild(document.createElement('tbody'));
  for(i=0; i<scripts_array.length; i++) {
    var script = scripts_array[i];
    
    var tr = tbody.appendChild(document.createElement('tr'));
    
    if(i%2 == 0) { tr.setAttribute("style", "background-color:rgb(204,230,204);"); } 
    else         { tr.setAttribute("style", "background-color:rgb(224,245,224);"); } 
        
    var td1 = tr.appendChild(document.createElement('td'));
    var a1 = td1.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "glyphsLoadScriptConfig(\""+trackID+"\",\"" +script.uuid+ "\"); return false;");
    a1.innerHTML = script.name;

    tr.appendChild(document.createElement('td')).innerHTML = encodehtml(script.description);
  }
  
  if(scripts_array.length == 0) {
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.className = 'odd';
    tr.appendChild(document.createElement('td')).innerHTML = "no scripts available";
    tr.appendChild(document.createElement('td'));
  }
}


function gLyphs_name_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  if(a.exact_match) { return -1; }
  if(b.exact_match) { return 1; }
  
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
/*
function gLyphsTrackBuildSourcesSearchDiv(trackID) {  
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  sourceSelect.className = "dropdown";
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
  sourceInput.className = "sliminput";
  sourceInput.setAttgLyphsTrackSearchSourcesCmdribute('style', "margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  sourceInput.setAttribute('size', "90");
  sourceInput.setAttribute('type', "text");

  var searchButton = sourceSearchForm.appendChild(document.createElement('input'));
  searchButton.setAttribute('style', "margin-left: 3px;");
  searchButton.type = "button";
  searchButton.className = "medbutton";
  searchButton.value = "search";
  searchButton.setAttribute("onclick", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'search');");
  
  var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
  clearButton.type = "button";
  clearButton.className = "medbutton";
  clearButton.value = "clear";
  clearButton.setAttribute("onclick", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'clear');");

  var refreshButton = sourceSearchForm.appendChild(document.createElement('input'));
  refreshButton.type = "button";
  refreshButton.className = "medbutton";
  refreshButton.value = "refresh";
  refreshButton.setAttribute("onclick", "gLyphsTrackSearchSourcesCmd(\""+trackID+"\", 'refresh');");
  
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
    tspan.innerHTML = "source datatype:";
    tdiv.appendChild(datatypeSelect);
  }  
}  


function gLyphsTrackBuildSourcesInfoDiv(trackID) {  
  //for DEX-mode where we just display source information
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  //if(fsrc_count>0) { src_msg += "feature_sources["+fsrc_count+"]  "; }
  //if(exp_count>0)  { src_msg += "experiments["+exp_count+"]"; }
  //tspan.innerHTML = src_msg;
  
  //tdiv2.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  //tdiv2.innerHTML ="Edge left-node featuresource:";
  var dsi1 = zenbuDatasourceInterface();
  dsi1.edit_datasource_query = true;
  dsi1.allowChangeDatasourceMode = true;
  dsi1.enableResultFilter = false;
  dsi1.allowMultipleSelect = true;
  dsi1.datasource_mode = "feature";
  dsi1.style.marginLeft = "5px";
  dsi1.source_ids = glyphTrack.source_ids;
  //dsi1.source_ids = "D905615F-C6AA-41D5-A0C4-6F4F61705A80::1:::FeatureSource"; //just for testing interface code
  tdiv.appendChild(dsi1);
  glyphTrack.DSI = dsi1;
  //dsi1.updateCallOutFunction = eedbUserEdgeDSIUpdate;  
  zenbuDatasourceInterfaceUpdate(dsi1.id);
  
  //---
  tdiv = sourcesDiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top: 1px;");

  var tdiv2 = tdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "float:right; margin-right:6px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  var link1 = tdiv2.appendChild(document.createElement("a"));
  link1.setAttribute("href", "./#config=" +glyphTrack.glyphsGB.configUUID);
  link1.setAttribute("style", "color:gray;");
  link1.setAttribute("onclick", "gLyphsTrackDatastreamXMLPanel(\""+ trackID+"\"); return false;");
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
    tspan.innerHTML = "source datatype:";
    tdiv.appendChild(datatypeSelect);
  }
}



function gLyphsTrackSearchSourcesCmd(trackID, cmd) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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

  if(glyphTrack.newconfig.species_search) { filter = filter+" "+glyphTrack.glyphsGB.asm }
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  var sourcesXMLHttp = glyphTrack.sourcesXMLHttp;
  if(sourcesXMLHttp == null) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  if(sourcesXMLHttp.readyState!=4) { return; }
  if(sourcesXMLHttp.status!=200) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    //console.log('Problem with central DB!');
    gLyphsTrackShowSourcesSearch(trackID);
    return;
  }
  
  var sources_hash = glyphTrack.newconfig.sources_hash;

  var xmlFeatureSources = new Array();
  var xmlExperiments = new Array();
  var xmlEdgeSources = new Array();

  var sources_children = xmlDoc.childNodes;
  console.log("sources response block has "+sources_children.length+" children");
  for (var i = 0; i < sources_children.length; i++) {
    var sourceDOM = sources_children[i];
    if(sourceDOM.tagName == "featuresource") { xmlFeatureSources.push(sourceDOM);  }
    if(sourceDOM.tagName == "experiment")    { xmlExperiments.push(sourceDOM); }
    if(sourceDOM.tagName == "edgesource")    { xmlEdgeSources.push(sourceDOM); }
  }
  console.log("sources children fsrc:"+xmlFeatureSources.length+"  exp:"+xmlExperiments.length+"  esrc:"+xmlEdgeSources.length);

  //var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
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
  //var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
  var trhead = my_table.appendChild(document.createElement('thead')).appendChild(document.createElement('tr'));
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = '';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'source name';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'description';
  trhead.appendChild(document.createElement('th', { 'class': 'listView' })).innerHTML = 'source type';
  
  var tbody = my_table.appendChild(document.createElement('tbody'));
  for(i=0; i<sources_array.length; i++) {
    var source = sources_array[i];
    
    var tr = tbody.appendChild(document.createElement('tr'));
    
    if(i%2 == 0) { tr.setAttribute("style", "background-color:rgb(204,230,204);"); } 
    else         { tr.setAttribute("style", "background-color:rgb(224,245,224);"); } 

    //checkbox
    var td1 = tr.appendChild(document.createElement('td'));
    var checkbox = td1.appendChild(document.createElement('input'));
    checkbox.setAttribute("type", "checkbox");
    if(source.selected) { checkbox.setAttribute("checked", "checked"); }
    checkbox.setAttribute("onclick", "gLyphsTrackSelectSource(\""+trackID+"\", \"" +source.id+ "\", this.checked);");
        
    //name
    var td2 = tr.appendChild(document.createElement('td'));
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +source.id+"\"); return false;");
    a1.innerHTML = source.name;
    
    //description
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.description;

    //class type
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.classname;
  }
  
  if(sources_array.length == 0) {
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.setAttribute("style", "background-color:rgb(204,230,204);");
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("colspan", "4");
    td.innerHTML = "no data sources selected, please enter search term";
  }
}


function gLyphsTrackSelectSource(trackID, srcID, mode) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
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
*/
//-------------------------------------------------------------

function gLyphsTrackFetchSourcesInfo(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }
    
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
  glyphTrack.sourcesXMLHttp = xhr;
  xhr.open("POST", eedbSearchCGI, true); //async
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.onreadystatechange= function(id) { return function() { gLyphsTrackFetchSourcesInfoResponse(id); };}(glyphTrack.trackID);
  xhr.send(paramXML);
}

function gLyphsTrackFetchSourcesInfoResponse(trackID) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  
  var xhr = glyphTrack.sourcesXMLHttp;
  if(!xhr) { return; }

  if(xhr.responseXML == null) return;
  if(xhr.readyState!=4) return;
  if(xhr.status!=200) { return; }
  if(xhr.responseXML == null) return;
  
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    //console.log('Problem with central DB!');
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
  
  if(glyphTrack.show_source_xml) {
    gLyphsTrackDatastreamXMLPanel(glyphTrack.trackID);
  }
}

//-------------------------------------------------------------



function gLyphsTrackSearchNamedFeatures(glyphTrack, query) {
  if(!glyphTrack) { return; }
    
  if(!glyphTrack.nameSearchDiv) { glyphTrack.nameSearchDiv = document.createElement('div'); }
  glyphTrack.named_feature_array = [];  
    
  if(glyphTrack.noNameSearch) { return; }
    
  //if(glyphTrack.nameSearchXHR) { return; }  //one already out
  var searchDiv = glyphTrack.nameSearchDiv;
  searchDiv.style.display = 'block';
  searchDiv.style.fontSize = "11px";
  searchDiv.onmouseout= eedbClearSearchTooltip;
  searchDiv.innerHTML = "";

  var tspan = searchDiv.appendChild(document.createElement('span'));
  tspan.style = "font-weight:bold;color:Navy;";
  tspan.innerHTML = glyphTrack.title+"::";
  var tspan = searchDiv.appendChild(document.createElement('span'));
  tspan.style.paddingLeft = "3px";
  tspan.innerHTML = "searching...";

  var paramXML = "<zenbu_query>";
  paramXML += "<source_ids>"+ glyphTrack.source_ids +"</source_ids>"; 
  //paramXML += "<mode>search</mode><format>descxml</format><collab>all</collab>\n";
  paramXML += "<mode>search</mode><limit>1000</limit>";
  paramXML += "<format>fullxml</format>";
  if(!glyphTrack.allowUnmapped) { paramXML += "<skip_no_location>true</skip_no_location>"; }
  paramXML += "<name>"+query+"</name>";
  paramXML += "</zenbu_query>";
  
  console.log("gLyphsTrackSearchNamedFeatures "+glyphTrack.trackID);
  //console.log("gLyphsTrackSearchNamedFeatures "+paramXML);
  
  glyphTrack.nameSearchInfo = { total:0, matchCount:0, filtered:0, current_query:query };

  var xhr=GetXmlHttpObject();
  glyphTrack.nameSearchXHR = xhr;
  xhr.open("POST", eedbSearchCGI, true); //async
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.onreadystatechange= function(id) { return function() { gLyphsTrackNameSearchResponse(id); };}(glyphTrack.trackID);
  xhr.send(paramXML);
}


function gLyphsTrackNameSearchResponse(trackID) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  
  var xhr = glyphTrack.nameSearchXHR;
  if(!xhr) { return; }

  if(xhr.responseXML == null) return;
  if(xhr.readyState!=4) return;
  if(xhr.status!=200) { return; }
  if(xhr.responseXML == null) return;
  
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  console.log("gLyphsTrackNameSearchResponse "+glyphTrack.trackID+" has response");

  //search stats  
  var searchInfo = glyphTrack.nameSearchInfo;
  var xml_summary = xmlDoc.getElementsByTagName("result_count");
  if(xml_summary.length>0) {
    searchInfo.total      = parseInt(xml_summary[0].getAttribute("total"))
    searchInfo.filtered   = parseInt(xml_summary[0].getAttribute("filtered"));
    searchInfo.matchCount = parseInt(xml_summary[0].getAttribute("match_count"))
    if(searchInfo.filtered>0 && searchInfo.matchCount==0) { 
      searchInfo.matchCount=searchInfo.filtered;
    }
  }

  var xml_features = [];
  var children = xmlDoc.childNodes;
  for (var i = 0; i < children.length; i++) {
    var childDOM = children[i]
    if(!childDOM.tagName) { continue; }
    //console.log("child tagName ["+childDOM.tagName+"]");
    if(childDOM.tagName == "feature") {
      xml_features.push(childDOM);
    }
  }  
  for(i=0; i<xml_features.length; i++) { 
    var featureXML = xml_features[i];
    var feature = convertFullFeatureXML(glyphTrack, featureXML);
    //var feature = convertFeatureXML(glyphTrack, featureXML);
    if(feature) {
      glyphTrack.named_feature_array.push(feature);
      feature.trackID = glyphTrack.trackID;
    }
  }
  
  //find the exact_match and move to front via sort
  for(var i=0; i<glyphTrack.named_feature_array.length; i++) {
    var feature = glyphTrack.named_feature_array[i];
    if(feature.name.toLowerCase() == searchInfo.current_query.toLowerCase()) { feature.exact_match = true; }
  }
  glyphTrack.named_feature_array.sort(gLyphs_name_sort_func);

  for(var i=0; i<glyphTrack.named_feature_array.length; i++) {
    var feature = glyphTrack.named_feature_array[i];
    feature.fidx = i;
  }

  console.log("gLyphsTrackNameSearchResponse "+glyphTrack.trackID+" returned features:"+(glyphTrack.named_feature_array.length)+
    "  total:"+searchInfo.total+"  filtered:"+searchInfo.filtered+"  matchCount:"+searchInfo.matchCount);

  gLyphsTrackDisplayNameSearchResults(glyphTrack);
}


function gLyphsTrackDisplayNameSearchResults(glyphTrack) {
  if(!glyphTrack) { return; }
  var searchDiv = glyphTrack.nameSearchDiv;
  if(!searchDiv) return;
  
  searchDiv.style.display = 'block';
  searchDiv.style.fontSize = "11px";
  searchDiv.style.width = glyphTrack.glyphsGB.display_width+'px';
  searchDiv.onmouseout= eedbClearSearchTooltip;
  searchDiv.innerHTML = "";

  if(glyphTrack.named_feature_array.length == 0) {
    searchDiv.style.display = 'none';
    return;
  }
    
  if(glyphTrack.title) { 
    var tspan = searchDiv.appendChild(document.createElement('span'));
    tspan.style = "font-weight:bold;color:Navy;";
    tspan.innerHTML = glyphTrack.title+"::";
  }

  if(glyphTrack.nameSearchInfo) { 
    var searchInfo = glyphTrack.nameSearchInfo;
    if(searchInfo.total==-1) {
      //"Error in query";
      searchDiv.style.display = 'none';
      return;
    } else if((searchInfo.filtered==0) && (searchInfo.matchCount==0)) {
      //searchInfo.total+" searched : No match found";
      searchDiv.style.display = 'none';
      return;
    } else if(searchInfo.filtered > searchInfo.matchCount) {
      var tspan = searchDiv.appendChild(document.createElement('span'));
      tspan.innerHTML = searchInfo.matchCount+" matches : Too many to display";
      searchDiv.style.display = 'block';
    }
  }
  searchDiv.style.display = 'block';

  var tspan = searchDiv.appendChild(document.createElement('span'));
  tspan.style.paddingLeft = "5px";
  tspan.innerHTML = "(found " +searchInfo.filtered;
  if(searchInfo.filtered < searchInfo.total) { tspan.innerHTML += ", from " +searchInfo.total; }
  tspan.innerHTML += ") ";

  for(var i=0; i<glyphTrack.named_feature_array.length; i++) {
    var feature = glyphTrack.named_feature_array[i];
    
    var tspan = searchDiv.appendChild(document.createElement('span'));
    tspan.style.paddingLeft = "5px";
    tspan.style.color = "blue";
    tspan.style.display = "inline-block";
    tspan.onclick = function(idx) { return function() { gLyphsTrackNameSearchSelect(glyphTrack.trackID, idx); };}(feature.fidx);
    tspan.onmouseover = function(idx) { return function() { gLyphsTrackNameSearchFeatureInfo(glyphTrack.trackID, idx); };}(feature.fidx);

    tspan.innerHTML = feature.name;
    if(feature.name.toLowerCase() == searchInfo.current_query.toLowerCase()) { 
      tspan.style.fontSize = "12px";
      tspan.style.fontWeight = "bold";
      //if(searchDiv.exact_match_autoclick) { eedbSearchSingleSelect(searchID, obj.fid); }
    }
  }
  //eedbDisplaySearchSetHasResults(searchTrack.searchSetID);
}


function gLyphsTrackNameSearchFeatureInfo(trackID, feature_idx) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  var feature = glyphTrack.named_feature_array[feature_idx];
  eedbDisplayTooltipObj(feature);
}

function gLyphsTrackNameSearchSelect(trackID, feature_idx) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  var feature = glyphTrack.named_feature_array[feature_idx];
  console.log("gLyphsTrackNameSearchSelect "+trackID+" selected_feature: "+feature.name+"  "+feature.chromloc);
  glyphTrack.glyphsGB.selected_feature = feature;
  gLyphsCenterOnFeature(glyphTrack.glyphsGB, feature);
}

