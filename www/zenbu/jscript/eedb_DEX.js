// ZENBU eedb_DEX.js
//
// Contact : Jessica Severin <severin@gsc.riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
// * ZENBU eedb_DEX.js
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

var contentsXMLHttp;
var contents = new Object;

function dexInitContents() {
  if(!browserCompatibilityCheck()) {
    window.location ="../browser_upgrade.html";
  }
  eedbShowLogin();
  if(current_user && !current_user.email) { return; }

  // reset global current_collaboration
  current_collaboration.name = "all";
  current_collaboration.uuid = "all";
  //current_collaboration.callOutFunction = function() { dexReloadContentsData(); }

  contents.mode = "Views";
  contents.current_index = 0;
  contents.page_size = 20;
  contents.num_pages = 0;
  contents.loading = false;
  
  contents.collaboration_select = null;

  contents.filters = new Object;
  contents.filters.datasource = "";
  contents.filters.platform = "";
  contents.filters.category = "";
  contents.filters.assembly = "";
  contents.filters.search = "";
  contents.filters.hide_mapcount = 1;
  contents.filters.source_ids = "";
  contents.filters.show_fixedID_reports = true;

  contents.cart = new Object;
  contents.cart.sources = new Object;
  contents.cart.tracks  = new Object;

  contents.datasources = new Object;
  contents.datasources.sources_hash = new Object();
  contents.datasources.total_count = 0;
  contents.datasources.mdstats_array = new Array();

  contents.configs = new Object;
  contents.configs.views_hash = new Object();
  contents.configs.total_count = 0;

  contents.tracks = new Object;
  contents.tracks.tracks_hash = new Object();
  contents.tracks.total_count = 0;

  contents.scripts = new Object;
  contents.scripts.scripts_hash = new Object();
  contents.scripts.total_count = 0;
  
  contentsXMLHttp=GetXmlHttpObject();
  if(contentsXMLHttp==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }

  gLyphsInitColorSpaces(); //for new track config hacking into glyphs code

  dhtmlHistory.initialize();
  dhtmlHistory.addListener(dexHandleHistoryChange);

  var initialURL = dhtmlHistory.getCurrentLocation();
  if(!dexParseURL(initialURL)) {
    //not parsed URL, so set some defaults
    contents.mode = "Views";
    dexShowSubmenu();
    dexReloadContentsData();
  }
  else {
    dexShowCart();
    dexShowContents();
  }
}


function dexParseURL(urlConfig) {
  //this function takes URL address, parses for configuration UUID and
  //location, and then reconfigures the view.  But it does not execute a reload/redraw

  if(!urlConfig) { return false; }
  var params = urlConfig.split(";");
  var rtnval = false;
  for(var i=0; i<params.length; i++) {
    var param = params[i];
    var p1 = param.indexOf("=");
    if(p1 == -1) { continue; }
    var tag0 = param.substr(0,p1);
    var value1 = param.substr(p1+1);
    if(tag0 == "section") {
      var mode = value1;
      if(mode=="Experiments") { mode = "DataSources"; contents.filters.datasource="experiments"; }
      if(mode=="Annotation")  { mode = "DataSources"; contents.filters.datasource="feature_sources"; }
      if(mode=="Edges")       { mode = "DataSources"; contents.filters.datasource="edge_sources"; }
      if((mode=="Views")||(mode=="Tracks")||(mode == "Scripts")||(mode=="DataSources")||(mode=="Reports")) {
        contents.mode = mode;
        rtnval = true;
      }
    }
    if(tag0 == "datasource") {
      contents.filters.datasource = value1;
      rtnval = true;
    }
    if(tag0 == "search") {
      var value = value1;
      value = value.unescapeHTML();
      value = value.replace(/%20/g, " ");
      contents.filters.search = value;
      rtnval = true;
    }
    if(tag0 == "source_ids") {
      contents.filters.source_ids = value1;
      rtnval = true;
    }
    if(tag0 == "asm") {
      contents.filters.assembly = value1;
      rtnval = true;
    }
    if(tag0 == "platform") {
      contents.filters.platform = value1;
      rtnval = true;
    }
    if(tag0 == "collab") {
      current_collaboration.name = value1;
      current_collaboration.uuid = value1;
      eedbCollaborationChange(value1);
      rtnval = true;
    }
  }
  if(rtnval) {
    contents.current_index = 0;
    dexReloadContentsData();
  }
  return rtnval;
}

function dexHandleHistoryChange(newLocation, historyData) {
  var noreload = dhtmlHistory.noreload;
  dhtmlHistory.noreload=false;
  if(noreload) { return; }
  dexSearchReset(false);
  if(dexParseURL(newLocation)) {
    contents.user = eedbShowLogin();
    dexShowCart();
    dexShowContents();
  }
}

//
//---------------------------------------------------------------------------
//


function dexShowSubmenu() {
  var submenu_div = document.getElementById("zenbu_dex_submenu");
  if(!submenu_div) { return; }
  
  //userview.user = eedbShowLogin();
  submenu_div.innerHTML ="";

  submenu_div.setAttribute('style', "margin:0px; background-repeat:repeat-x; "+
     "background-image:url("+eedbWebRoot+"/images/subnav_bg.gif); width:400px;"+
     "line-height:2em; border-right:1px; color:#FFFFFF; font-weight:bold;"+
     "font-family:Verdana, Arial, Helvitica, sans-serif; text-decoration:none; font-size:11px;");

  var spanstyle = "line-height:2em; padding:5px 10px 5px 10px; border-right:1px; ";


  //----------
  var span1 = submenu_div.appendChild(new Element('span'));
  if(contents.mode == "Views") { 
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Views');");
  } else { 
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Views');");
  }
  span1.innerHTML = "Views";

  //----------
  span1 = submenu_div.appendChild(new Element('span'));
  if(contents.mode == "Reports") {
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Reports');");
  } else {
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Reports');");
  }
  span1.innerHTML = "Reports";

  //----------
  span1 = submenu_div.appendChild(new Element('span'));
  if(contents.mode == "Tracks") { 
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Tracks');");
  } else { 
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Tracks');");
  }
  span1.innerHTML = "Tracks";

 
  //----------
  span1 = submenu_div.appendChild(new Element('span'));
  if((contents.mode=="Experiments")||(contents.mode=="Annotation")||(contents.mode=="DataSources")) {
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'DataSources');");
  } else { 
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'DataSources');");
  }
  span1.innerHTML = "Data Sources";

  //----------
  span1 = submenu_div.appendChild(new Element('span'));
  if(contents.mode == "Scripts") { 
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'selected');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Scripts');");
  } else { 
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "dexSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "dexSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "dexReconfigContentsParam('mode', 'Scripts');");
  }
  span1.innerHTML = "Scripts";
}


function dexSubmenuHover(item, mode) {
  if(mode == "in") { 
    item.setAttribute("style", "line-height:2em; padding:5px 10px 5px 10px; border-right:1px; background-color:#C0C0C0;");
  }
  if(mode == "out") { 
    item.setAttribute("style", "line-height:2em; padding:5px 10px 5px 10px; border-right:1px;");
  }
  if(mode == "selected_in") { 
    item.setAttribute("style", "color:black; line-height:2em; padding:5px 10px 5px 10px; border-right:1px; background-color:#C0C0C0;");
  }
  if(mode == "selected_out") { 
    item.setAttribute("style", "color:black; line-height:2em; padding:5px 10px 5px 10px; border-right:1px;");
  }
}


//
//---------------------------------------------------------------------------
//

function dexShowControls() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(contents.loading && contents_table_div) { 
    contents_table_div.setStyle({color:'black', opacity:0.8});
    contents_table_div.innerHTML = 'loading data...';
  }

  var ctrlDiv = document.getElementById("dex_contents_controls");
  if(!ctrlDiv) {  return; }

  //----------------
  var ctrlOptions = document.getElementById("dex_contents_controls_options");
  if(!ctrlOptions) {
    ctrlOptions  = document.createElement('div');
    ctrlOptions.id = "dex_contents_controls_options";
    ctrlDiv.appendChild(ctrlOptions);
  }
  dexShowCart();
  //-
  if(!contents.collaboration_select) {
    contents.collaboration_select = eedbCollaborationPulldown("filter_search");
    contents.collaboration_select.callOutFunction = dexCollaborationChanged;
  }
  var collabSelect = contents.collaboration_select;
    
  var collabCell = document.getElementById("dex_collaboration_widget");
  if(!collabCell) {
    var collabCell = ctrlOptions.appendChild(document.createElement('span'));
    collabCell.id = "dex_collaboration_widget";
    collabCell.setAttribute("style", "margin-left:5px; margin-right:5px; display:inline;");
    //var collabSelect = eedbCollaborationSelectWidget("filter_search");
    collabCell.appendChild(collabSelect);
  }
  dexCreateDatasourceSelect();
  dexCreateAssemblySelect();

  var reportsDiv = document.getElementById("dex_contents_controls_reports_div");
  if(!reportsDiv) {
    reportsDiv = ctrlOptions.appendChild(document.createElement('div'));
    reportsDiv.id = "dex_contents_controls_reports_div";
    reportsDiv.setAttribute("style", "margin-left:10px; vertical-align:bottom; display:inline-block;");
    var tcheck = reportsDiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('type', "checkbox");
    reportsDiv.showCheckbox = tcheck;
    tspan = reportsDiv.appendChild(document.createElement('span'));
    tspan.style.verticalAlign="2px";
    tspan.innerHTML = "show only fixedID pages";
  }
  if(contents.mode=="Reports") {
    reportsDiv.style.display = "inline-block";
    if(contents.filters.show_fixedID_reports) { reportsDiv.showCheckbox.setAttribute("checked", "checked"); }
    reportsDiv.showCheckbox.setAttribute("onclick", "dexReconfigContentsParam('show_fixedID_reports', this.checked);");
  } else {
    reportsDiv.style.display = "none";
  }
  
  //----------------
  var searchInput    = document.getElementById("dex_main_search_input");
  var searchButton   = document.getElementById("dex_contents_controls_search_button");
  var clearButton    = document.getElementById("dex_contents_controls_clear_button");
  var dexSearchDiv   = document.getElementById("dex_contents_controls_search_div");
  if(!dexSearchDiv) {
    dexSearchDiv  = document.createElement('div');
    dexSearchDiv.id = "dex_contents_controls_search_div";
    dexSearchDiv.setAttribute("style", "white-space: nowrap");
    //ctrlDiv.insertBefore(dexSearchDiv, ctrlDiv.firstChild);
    ctrlDiv.appendChild(dexSearchDiv);

    //-
    var searchForm = dexSearchDiv.appendChild(document.createElement('form'));
    searchForm.setAttribute('style', "margin-top: 5px; margin-bottom:3px;");
    searchForm.setAttribute("onsubmit", "dexSearchSubmit(); return false;");

    var expSpan = searchForm.appendChild(document.createElement('span'));
    expSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin-right:3px;");
    //if(contents.mode == "DataSources") { expSpan.innerHTML = "Search data sources:"; }
    //if(contents.mode == "Experiments") { expSpan.innerHTML = "Search data sources:"; }
    //if(contents.mode == "Annotation") { expSpan.innerHTML = "Search data sources:"; }
    //if(contents.mode == "Tracks") { expSpan.innerHTML = "Search tracks:"; } 
    //if(contents.mode == "Views") { expSpan.innerHTML = "Search views:"; } 
    //if(contents.mode == "Scripts") { expSpan.innerHTML = "Search scripts:"; } 
    expSpan.innerHTML = "Search:";

    searchInput = searchForm.appendChild(document.createElement('input'));
    searchInput.id = "dex_main_search_input";
    searchInput.className = "sliminput";
    searchInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    searchInput.setAttribute('size', "90");
    searchInput.setAttribute('type', "text");

    searchButton = searchForm.appendChild(document.createElement('input'));
    searchButton.id = "dex_contents_controls_search_button";
    searchButton.className = "slimbutton";
    searchButton.style.fontSize = "12px";
    //searchButton.setAttribute('style', "margin-left: 3px;");
    searchButton.setAttribute("type", "button");
    searchButton.setAttribute("value", "search");
    searchButton.setAttribute("onclick", "dexSearchSubmit();");

    clearButton = searchForm.appendChild(document.createElement('input'));
    clearButton.id = "dex_contents_controls_clear_button";
    clearButton.className = "slimbutton";
    //clearButton.setAttribute('style', "display:none;");
    clearButton.setAttribute("type", "button");
    clearButton.setAttribute("value", "clear");
    clearButton.setAttribute("onclick", "dexSearchClear('true');");

    var resetButton = searchForm.appendChild(document.createElement('input'));
    resetButton.className = "slimbutton";
    resetButton.style.fontSize = "12px";
    resetButton.setAttribute("type", "button");
    resetButton.setAttribute("value", "reset");
    resetButton.setAttribute("onclick", "dexSearchReset('true');");
  }

  if(contents.filters.source_ids) { 
    searchButton.setAttribute('value', "refine search"); 
    clearButton.setAttribute('style', "display:inline;"); 
  } else { 
    searchButton.setAttribute('value', "search"); 
    clearButton.setAttribute('style', "display:none;"); 
  }

  searchInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  if(contents.filters.search) { searchInput.value = contents.filters.search; }
  if(contents.filters.source_ids) {
    searchInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif; background:rgb(224,245,224);");
  }

  if((contents.mode == "Tracks") || (contents.mode == "Views") || (contents.mode == "Scripts") || (contents.mode == "Reports")) {
    //eedbCollaborationSelectWidget("config_search");
    if(collabSelect) { eedbCollaborationPulldown("config_search", collabSelect.id); }
  } else {
    //eedbCollaborationSelectWidget("filter_search");
    if(collabSelect) { eedbCollaborationPulldown("filter_search", collabSelect.id); }
  }
}

function dexCollaborationChanged() {
  if(!contents.collaboration_select) { return; }
  current_collaboration.name = contents.collaboration_select.collaboration_name;
  current_collaboration.uuid = contents.collaboration_select.collaboration_uuid;
  //console.log("dexCollaborationChanged "+current_collaboration.name+" : "+current_collaboration.uuid);
  dexReloadContentsData();
}

function dexSearchSubmit() {
  var searchInput = document.getElementById("dex_main_search_input");
  if(!searchInput) { return false; }
  contents.filters.search = searchInput.value;
  contents.current_index = 0;
  dexReloadContentsData();
  return false;
}

function dexSearchReset(reload) {
  var searchInput = document.getElementById("dex_main_search_input");
  if(!searchInput) { return false; }
  searchInput.value ="";
  contents.filters.search = "";
  contents.filters.source_ids = "";
  contents.current_index = 0;
  if(reload) { dexReloadContentsData(); }
  return false;
}

function dexSearchClear(reload) {
  var searchInput = document.getElementById("dex_main_search_input");
  if(!searchInput) { return false; }
  searchInput.value ="";
  contents.filters.search = "";
  contents.current_index = 0;
  if(reload) { dexReloadContentsData(); }
  return false;
}



//
//---------------------------------------------------------------------------
//

function dexReloadContentsData() {
  contents.user = eedbShowLogin();

  eedbClearSearchTooltip();
  dexShowControls();

  contents.loading = true;
  contents.current_index = 0;
  contents.datasources.mdstats_loading = false;
  contents.datasources.mdstats_array = new Array();
  dexShowSourceMdataStats();  //clear

  var contents_table_div = document.getElementById("contents_table_div");
  if(contents_table_div) { contents_table_div.setStyle({color:'black', opacity:0.8}).update('loading data...'); }

  var url = "#section=" + contents.mode;
  if(current_collaboration.uuid) { url += ";collab=" + current_collaboration.uuid; }
  if(contents.filters.assembly) { url += ";asm=" + contents.filters.assembly; }
  if(contents.filters.platform) { url += ";platform=" + contents.filters.platform; }
  if(contents.filters.datasource) { url += ";datasource=" + contents.filters.datasource; }
  if(contents.filters.search)   { url += ";search=" + contents.filters.search; }
  if(contents.filters.source_ids) { url += ";source_ids=" + contents.filters.source_ids; }
  dhtmlHistory.noreload = true;
  dhtmlHistory.add(url);
  zenbuRegisterCurrentURL();

  if(contents.mode == "Views") { dexReloadViewsData(); }
  if(contents.mode == "Tracks") { dexReloadTracksData(); }
  if(contents.mode == "DataSources") { dexReloadDataSources(); }
  if(contents.mode == "Scripts") { dexReloadScriptsData(); }
  if(contents.mode == "Reports") { dexReloadReportsData(); }
}

function dexShowContents() {
  dexShowSubmenu();
  dexShowControls();

  if(contents.mode == "Views") { dexShowViews(); }
  if(contents.mode == "Tracks") { dexShowTracks(); }
  if(contents.mode == "DataSources") { dexShowDataSources(); }
  if(contents.mode == "Scripts") { dexShowScripts(); }
  if(contents.mode == "Reports") { dexShowReports(); }
}

//---------------------------------------------------------------------------
//
// DataSources section
//
//---------------------------------------------------------------------------

function dexReloadDataSources() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  contents_table_div.setStyle({color:'black', opacity:0.8}).update('loading data...');

  contents.filters.platform = "";

  contents.loading = true;
  contents.datasources.platforms = new Object;

  contents.datasources.mdstats_loading = false;
  contents.datasources.mdstats_array = new Array();
  dexShowSourceMdataStats();  //clear

  //do not clear hash, but instead "hide" the unselected sources
  for(var uuid in contents.datasources.sources_hash) {
    var source = contents.datasources.sources_hash[uuid];
    if(!source) { continue; }
    if(source.selected) { source.visible=true; } else { source.visible = false; }
  }
  //contents.current_index = 0;

  var paramXML = "<zenbu_query><format>minxml</format>\n"; //descxml minxml simplexml
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";

  if(contents.filters.datasource=="experiments") { paramXML += "<mode>experiments</mode>"; } 
  else if(contents.filters.datasource=="feature_sources") { paramXML += "<mode>feature_sources</mode>"; } 
  else if(contents.filters.datasource=="edge_sources") { paramXML += "<mode>edge_sources</mode>"; } 
  //else if(contents.filters.datasource=="assemblies") { paramXML += "<mode>genome</mode>"; } 
  else { paramXML += "<mode>sources</mode>"; }

  if(contents.filters.source_ids) {
    paramXML += "<source_ids>" + contents.filters.source_ids + "</source_ids>";
  }

  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    var filter = "";
    if(contents.filters.assembly != "") { filter = "(eedb:assembly_name:="+contents.filters.assembly + " or assembly_name:="+contents.filters.assembly+") "; }
    //if(contents.filters.assembly != "") { filter = contents.filters.assembly + " "; }
    if(contents.filters.search != "")   { filter += contents.filters.search; }
    paramXML += "<filter>" + filter + "</filter>";
  }
  paramXML += "</zenbu_query>\n";

  contentsXMLHttp.onreadystatechange=dexParseDataSourceSearch;
  contentsXMLHttp.open("POST", eedbSearchFCGI, true);
  contentsXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //contentsXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //contentsXMLHttp.setRequestHeader("Connection", "close");
  contentsXMLHttp.send(paramXML);
}


function dexParseDataSourceSearch() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  if(contentsXMLHttp == null) { return; }
  if(contentsXMLHttp.responseXML == null) return;
  if(contentsXMLHttp.readyState!=4) return;
  if(contentsXMLHttp.status!=200) { return; }
  var xmlDoc=contentsXMLHttp.responseXML.documentElement;

  if(xmlDoc==null) {
    contents_table_div.setStyle({color:'black', opacity:1.0}).update('Problem with webservice query!');
    return;
  } 

  contents.loading = false;

  //<result_count method="experiments" total="4394" filtered="2068" />
  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    contents.datasources.total_count     = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
    contents.datasources.match_count     = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("match_count") -0;
    contents.datasources.filtered_count  = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("filtered") -0;
  }

  var count1 = 0;
  var count2 = 0;
  var sources_hash = contents.datasources.sources_hash;

  var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<xmlExperiments.length; i++) {
    count1++
    var xmlSource = xmlExperiments[i];
    var srcid = xmlSource.getAttribute("id");
    var source = sources_hash[srcid];
    if(!source) {
      count2++
      source = new Object;
      eedbParseExperimentData(xmlSource, source);
      sources_hash[srcid] = source;
      source.selected = false;
    }
    source.visible = true;
  }

  var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<xmlFeatureSources.length; i++) {
    count1++
    var xmlSource = xmlFeatureSources[i];
    var srcid = xmlSource.getAttribute("id");
    var source = sources_hash[srcid];
    if(!source) {
      count2++
      source = new Object;
      eedbParseFeatureSourceData(xmlSource, source);
      sources_hash[srcid] = source;
      source.selected = false;
    }
    source.visible = true;
  }

  var xmlEdgeSources = xmlDoc.getElementsByTagName("edgesource");
  for(i=0; i<xmlEdgeSources.length; i++) {
    count1++
    var xmlSource = xmlEdgeSources[i];
    var srcid = xmlSource.getAttribute("id");
    var source = sources_hash[srcid];
    if(!source) {
      count2++
      source = new Object;
      eedbParseEdgeSourceXML(xmlSource, source);
      sources_hash[srcid] = source;
      source.selected = false;
    }
    source.visible = true;
  }

  var xmlAssemblies = xmlDoc.getElementsByTagName("assembly");
  for(i=0; i<xmlAssemblies.length; i++) {
    count1++
    var xmlSource = xmlAssemblies[i];
    var srcid = xmlSource.getAttribute("id");
    var source = sources_hash[srcid];
    if(!source) {
      count2++
      source = new Object;
      eedbParseAssemblyData(xmlSource, source);
      sources_hash[srcid] = source;
      source.selected = false;
    }
    source.visible = true;
  }
  //document.getElementById("message").innerHTML = "parsed "+count1+" sources into "+count2+" unique";

  //dexCreateAssemblySelect();
  dexShowCart();
  dexShowDataSources();

  if((contents.filters.search != "") || contents.filters.source_ids) { dexReloadSourceMetadataStats(); }
}


function dexLoadFullDataSourcesList(ids) {
  if(!ids) { return; }
  //var url = eedbSearchFCGI+"?mode=experiments;format=fullxml;source_ids="+ids;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>sources</mode><format>fullxml</format>\n";
  paramXML += "<source_ids>" + ids + "</source_ids>\n";
  paramXML += "</zenbu_query>\n";
  
  var singleExperimentXMLHttp=GetXmlHttpObject();
  singleExperimentXMLHttp.open("POST", eedbSearchFCGI, false);
  singleExperimentXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  singleExperimentXMLHttp.send(paramXML);

  if(singleExperimentXMLHttp == null) { return; }
  if(singleExperimentXMLHttp.responseXML == null) return;
  if(singleExperimentXMLHttp.readyState!=4) return;
  if(singleExperimentXMLHttp.status!=200) { return; }
  var xmlDoc=singleExperimentXMLHttp.responseXML.documentElement;

  if(xmlDoc==null) { return; }

  var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<xmlExperiments.length; i++) {
    var xmlSource = xmlExperiments[i];
    var expid = xmlSource.getAttribute("id");
    var source = contents.datasources.sources_hash[expid];
    if(!source) { continue; }
    if(source.full_load) { continue; }
    eedbParseExperimentData(xmlSource, source);
    if(source.platform) { contents.datasources.platforms[source.platform] = source.platform; }
    source.full_load = 1;
  }

  var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<xmlFeatureSources.length; i++) {
    var xmlSource = xmlFeatureSources[i];
    var expid = xmlSource.getAttribute("id");
    var source = contents.datasources.sources_hash[expid];
    if(!source) { continue; }
    if(source.full_load) { continue; }
    eedbParseFeatureSourceData(xmlSource, source);
    if(source.platform) { contents.datasources.platforms[source.platform] = source.platform; }
    source.full_load = 1;
  }

  var xmlEdgeSources = xmlDoc.getElementsByTagName("edgesource");
  for(i=0; i<xmlEdgeSources.length; i++) {
    var xmlSource = xmlEdgeSources[i];
    var srcid = xmlSource.getAttribute("id");
    var source = contents.datasources.sources_hash[srcid];
    if(!source) { continue; }
    if(source.full_load) { continue; }
    eedbParseEdgeSourceXML(xmlSource, source);
    if(source.platform) { contents.datasources.platforms[source.platform] = source.platform; }
    source.full_load = 1;
  }

}


function dexFilteredDataSourcesArray() {
  var filters = contents.filters;

  var sources_array = new Array();
  var sources_hash = contents.datasources.sources_hash;

  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(!source.visible) { continue; }
    if((filters.platform!="") && (filters.platform != source.platform)) { continue; }
    if(filters.hide_mapcount && (/mapcount/.test(source.name))) { continue; }

    if((contents.filters.datasource=="experiments") && (source.classname!="Experiment")) { continue; }
    if((contents.filters.datasource=="feature_sources") && (source.classname!="FeatureSource")) { continue; }
    if((contents.filters.datasource=="edge_sources") && (source.classname!="EdgeSource")) { continue; }
    if((contents.filters.datasource=="assemblies") && (source.classname!="Assembly")) { continue; }

    sources_array.push(source);
  }
  return sources_array;
}


function dexShowDataSources() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  dexShowControls();
  dexShowSourceMdataStats();

  var sources_array = dexFilteredDataSourcesArray();
  if(!sources_array) { return; }
  sources_array.sort(dex_datasource_sort_func);

  var num_pages = Math.ceil(sources_array.length / contents.page_size);
  contents.datasources.filter_count = sources_array.length;
  contents.num_pages = num_pages;

  if(contents.current_index > (num_pages-1) * contents.page_size) {
    contents.current_index = (num_pages-1) * contents.page_size;
    if(contents.current_index <0) { contents.current_index=0; }
  }

  contents_table_div.innerHTML = "";

  if(contents.loading) {
    var div2 = contents_table_div.appendChild(new Element('div'));
    div2.innerHTML ="loading data...";
    return;
  }

  //paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = sources_array.length + " filtered ";
  msg += contents.datasources.total_count + " total data sources";
  span1.innerHTML = msg;

  var selectAllSpan = div2.appendChild(new Element('a'));
  selectAllSpan.setAttribute('style', "margin-left: 10px; font-family:arial,helvetica,sans-serif; color:purple; text-decoration:underline;");
  selectAllSpan.setAttribute('href', "./");
  selectAllSpan.setAttribute("onclick", "return false");
  selectAllSpan.innerHTML = "select all";

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);

  var span3 = div2.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', contents.page_size);
  input.setAttribute("onchange", "dexReconfigContentsParam('page-size', this.value);return false;");

  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('select'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('source name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('genome'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('platform'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('cellline / tissue'));
  //trhead.appendChild(new Element('th', { 'class': 'listView' }).update('evoc terms'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('time point'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('treatment'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('upload date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('source type'));

  var load_ids="";
  var page_ids="";
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=sources_array.length) { break; }
    var source = sources_array[i];
    page_ids += source.id + ",";
    if(source.full_load) { continue; }
    load_ids += source.id + ",";
  }
  selectAllSpan.setAttribute("onclick", "dexAlterSelection('select-all-sources', \""+page_ids+"\"); return false");
  dexLoadFullDataSourcesList(load_ids);

  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=sources_array.length) { break; }

    var source = sources_array[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    tr.appendChild(new Element('td').update(i+1));

    var td = tr.appendChild(new Element('td'));
    if(source.classname != "Assembly") {
      var input = td.appendChild(new Element('input'));
      input.setAttribute('type', "checkbox");
      input.setAttribute("style", "background:white;");
      input.setAttribute("onclick", "dexAlterSelection('source-check', \"" +source.id+ "\");");
      if(source.selected) { input.setAttribute('checked', "checked"); }
    }

    var idTD = tr.appendChild(document.createElement('td'));
    idTD.innerHTML = source.name;
    //var a1 = idTD.appendChild(document.createElement('a'));
    //a1.setAttribute("target", "eeDB_source_view");
    //a1.setAttribute("href", "./");
    //a1.setAttribute("onclick", "dexShowSourceInfo(\"datasource\",\"" +source.id+ "\"); return false;");
    //a1.innerHTML = source.name;

    tr.appendChild(new Element('td').update(encodehtml(source.assembly)));

    td = tr.appendChild(document.createElement('td'));
    var span1 = td.appendChild(document.createElement('span'));
    span1.innerHTML = encodehtml(source.description);
    button = td.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onmouseover", "eedbMessageTooltip('metadata details panel',130);");
    button.setAttribute("onclick", "dexShowSourceInfo(\"datasource\",\"" +source.id+ "\"); return false;");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML ="details";

    var platform = source.platform;
    if(platform) {
      tr.appendChild(new Element('td').update(platform));
    } else {
      var td1 = new Element('td');
      //td1.innerHTML = "<span style=\"color:goldenrod; font-weight:bold;;\">LSArchive sync ERROR</span>";
      td1.innerHTML = "";
      tr.appendChild(td1);
    }

    tr.appendChild(new Element('td').update(encodehtml(source.biosample)));
   // tr.appendChild(new Element('td').update(encodehtml(source.ev_terms)));
    tr.appendChild(new Element('td').update(encodehtml(source.series_point)));
    tr.appendChild(new Element('td').update(encodehtml(source.treatment)));


    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("nowrap", "nowrap");
    if(source.owner_identity) {
      var tdiv = td.appendChild(document.createElement('div'));
      tdiv.setAttribute("style", "font-size:10px;");
      var tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = source.owner_identity;
    }
    if(source.import_date) {
      var tdiv = td.appendChild(document.createElement('div'));
      tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
      tdiv.innerHTML = encodehtml(source.import_date);
    }

    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.classname;

  }

  if(sources_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }

  contents_table_div.appendChild(div1);

  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = sources_array.length + " filtered ";
  msg += contents.datasources.total_count + " total data sources";
  span1.innerHTML = msg;

  var span3 = div2.appendChild(new Element('a'));
  span3.setAttribute('style', "margin-left: 10px; font-family:arial,helvetica,sans-serif; color:purple; text-decoration:underline;");
  span3.setAttribute('href', "./");
  span3.setAttribute("onclick", "dexAlterSelection('select-all-sources', \""+page_ids+"\"); return false");
  span3.innerHTML = "select all";

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);
}

function dex_datasource_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.selected && !b.selected) { return -1; }
  if(!a.selected && b.selected) { return 1; }

  if(!a.import_timestamp && b.import_timestamp) { return 1; }
  if(a.import_timestamp && !b.import_timestamp) { return -1; }
  if(a.import_timestamp < b.import_timestamp) { return 1; }
  if(a.import_timestamp > b.import_timestamp) { return -1; }
  
  //if(a.classname < b.classname) { return -1; }
  //if(a.classname > b.classname) { return 1; }

  //if(!a.platform && b.platform) { return 1; }
  //if(a.platform && !b.platform) { return -1; }

  //if(a.platform < b.platform) { return -1; }
  //if(a.platform > b.platform) { return 1; }

  a_name = a.name.toLowerCase();
  b_name = b.name.toLowerCase();

  if(a_name < b_name) { return -1; }
  if(a_name > b_name) { return 1; }

  if(a.series_point != b.series_point) { return a.series_point - b.series_point; }

  //if(a.id < b.id) { return -1; }
  //if(a.id > b.id) { return 1; }

  return 0;
}

//---------------------------------------------------------------------------
//
// DataSources metadata overview
//
//---------------------------------------------------------------------------

function dexReloadSourceMetadataStats() {
  var dex_metadata_div = document.getElementById("dex_metadata_div");
  if(!dex_metadata_div) { return; }

  //contents.current_index = 0;
  contents.datasources.mdstats_loading = true;
  contents.datasources.mdstats_array = new Array();
  dexShowSourceMdataStats();  //show loading

  //mode=mdstats;submode=matching_values;sourcetype=Experiment;md_show_ids=true;filter=monocyte
  var paramXML = "<zenbu_query><mode>mdstats</mode><md_show_ids>true</md_show_ids>\n";
  paramXML += "<submode>matching_values</submode>";
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";

  if(contents.filters.source_ids) {
    paramXML += "<source_ids>" + contents.filters.source_ids + "</source_ids>";
  }

  if(contents.filters.datasource=="experiments") { paramXML += "<sourcetype>Experiment</sourcetype>"; } 
  else if(contents.filters.datasource=="feature_sources") { paramXML += "<sourcetype>FeatureSource</sourcetype>"; } 
  else if(contents.filters.datasource=="edge_sources") { paramXML += "<sourcetype>EdgeSource</sourcetype>"; } 

  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    var filter = "";
    if(contents.filters.assembly != "") { filter = contents.filters.assembly + " "; }
    if(contents.filters.search != "")   { filter += contents.filters.search; }
    paramXML += "<filter>" + filter + "</filter>";
  }
  paramXML += "</zenbu_query>\n";


  var mdataXHR = GetXmlHttpObject();
  contents.datasources.mdataXHR = mdataXHR;

  mdataXHR.onreadystatechange=dexParseSourceMdataStats;
  mdataXHR.open("POST", eedbSearchFCGI, true);
  mdataXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //mdataXHR.setRequestHeader("Content-length", paramXML.length);
  //mdataXHR.setRequestHeader("Connection", "close");
  mdataXHR.send(paramXML);
}


function dexParseSourceMdataStats() {
  var dex_metadata_div = document.getElementById("dex_metadata_div");
  if(!dex_metadata_div) { return; }
  if(!contents.datasources.mdataXHR) { return; }

  var mdataXHR = contents.datasources.mdataXHR;

  if(mdataXHR == null) { return; }
  if(mdataXHR.responseXML == null) return;
  if(mdataXHR.readyState!=4) return;
  if(mdataXHR.status!=200) { return; }
  var xmlDoc=mdataXHR.responseXML.documentElement;

  if(xmlDoc==null) {
    dex_metadata_div.setAttribute("style", "color:black; opacity:1.0;");
    dex_metadata_div.innerHTML = 'Problem with mdstats webservice query!';
    contents.datasources.mdataXHR = NULL;
    return;
  } 

  contents.datasources.mdstats_loading = false;
  contents.datasources.mdstats_array = new Array();;

  var xmlMDkeys = xmlDoc.getElementsByTagName("mdkey");
  for(i=0; i<xmlMDkeys.length; i++) {
    var keyXML = xmlMDkeys[i];

    var mdkey = new Object;
    mdkey.key          = keyXML.getAttribute("key");
    mdkey.source_count = Math.floor(keyXML.getAttribute("source_count"));
    mdkey.value_count  = Math.floor(keyXML.getAttribute("value_count"));
    mdkey.source_ids   = "";
    mdkey.show_values  = false;

    mdkey.value_array  = new Array;

    var xmlMDvalues = keyXML.getElementsByTagName("mdvalue");
    for(j=0; j<xmlMDvalues.length; j++) {
      var valueXML = xmlMDvalues[j];
      var mdvalue = new Object;
      mdvalue.value = valueXML.getAttribute("value");
      mdvalue.source_count = Math.floor(valueXML.getAttribute("source_count"));

      var datasources = valueXML.getElementsByTagName("datasource");
      for(k=0; k<datasources.length; k++) {
        var id1 = datasources[k].getAttribute("id");
        if(mdkey.source_ids) { mdkey.source_ids += ","; }
        mdkey.source_ids += id1;
      }
      mdkey.value_array.push(mdvalue);
    }

    contents.datasources.mdstats_array.push(mdkey);
  }

  contents.datasources.mdstats_array.sort(dex_mdstats_sort_func);

  dexShowSourceMdataStats();
}


function dexShowSourceMdataStats() {
  var dex_metadata_div = document.getElementById("dex_metadata_div");
  if(!dex_metadata_div) { return; }

  dex_metadata_div.innerHTML = "";
  if(contents.mode != "DataSources") { return; }

  if(contents.loading) { return; } //wait till after contents are loaded

  if(contents.datasources.mdstats_loading) {
    dex_metadata_div.setAttribute("style", "color:black; opacity:1.0;");
    dex_metadata_div.innerHTML  = 'loading metadata details...';
    return;
  }

  if(contents.datasources.mdstats_array.length == 0) { 
    var button = dex_metadata_div.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:3px; margin-bottom:2px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "dexSourceMdataParameter('fullload', true); return false;");
    button.innerHTML = "load metadata facet browser";
    return; 
  }

  var div1 = dex_metadata_div.appendChild(document.createElement("div"));
  div1.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; margin-left:47px; margin-bottom:2px; ");
  if(contents.filters.search == "") { 
    div1.innerHTML = "showing complete metadata facets" ;
  } else {
    div1.innerHTML = "showing query matching metadata facets";
  }
  if(contents.filters.source_ids) {
    var source_ids = contents.filters.source_ids.split(",");
    if(source_ids.length >0) { div1.innerHTML += " from " + source_ids.length + " sources"; }
  }

  //----------
  var div1 = dex_metadata_div.appendChild(document.createElement('div'));
  div1.setAttribute("style", "margin-left:47px; margin-bottom:3px; border:1px black solid; background-color:snow; overflow:auto; width:800px; max-height:200px;");

  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  var col1 = my_table.appendChild(new Element('col'));
  col1.setAttribute("width", "1px");
  col1 = my_table.appendChild(new Element('col'));
  col1.setAttribute("width", "1px");
  col1.setAttribute("nowrap", "nowrap");
  col1 = my_table.appendChild(new Element('col'));
  col1.setAttribute("width", "100%");

  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  var th1 = trhead.appendChild(new Element('th'));
  th1.setAttribute("nowrap", "nowrap");
  th1.innerHTML = "metadata key";
  th1 = trhead.appendChild(new Element('th'));
  th1.setAttribute("nowrap", "nowrap");
  th1.innerHTML = "source count";
  th1 = trhead.appendChild(new Element('th'));
  th1.setAttribute("nowrap", "nowrap");
  th1.innerHTML = "metadata values";

  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<contents.datasources.mdstats_array.length; i++) {
    var mdkey = contents.datasources.mdstats_array[i];
 
    var tr = tbody.appendChild(new Element('tr'));
    
    if(i%2 == 0) { tr.setAttribute("style", "background-color:rgb(204,230,204);"); } 
    else         { tr.setAttribute("style", "background-color:rgb(224,245,224);"); } 

    //key
    var td2 = tr.appendChild(document.createElement('td'));
    td2.setAttribute("valign", "top");
    td2.setAttribute("nowrap", "nowrap");
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "dexSourceMdataParameter('sourceids', \""+mdkey.source_ids+"\"); return false;");
    a1.setAttribute("onmouseover", "eedbMessageTooltip('refine to "+ mdkey.source_count+" sources',120);");
    a1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    a1.innerHTML = mdkey.key;
    
    //source count
    var td4 = tr.appendChild(document.createElement('td'));
    td4.setAttribute("valign", "top");
    td4.setAttribute("nowrap", "nowrap");
    td4.innerHTML = mdkey.source_count + " sources";

    //values
    var td3 = tr.appendChild(document.createElement('td'));
    td3.setAttribute("valign", "top");

    var span1 = td3.appendChild(document.createElement('span'));
    span1.innerHTML = mdkey.value_array.length + " different values";

    var button = td3.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; font-weight:normal; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; margin-left:3px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "dexSourceMdataParameter('hideshowvalues', \""+mdkey.key+"\"); return false;");
    if(mdkey.show_values) { button.innerHTML = "hide values"; } else { button.innerHTML = "show values"; }
    mdkey.hideshow_button = button;

    var div3 = td3.appendChild(document.createElement('div'));
    if(!mdkey.show_values) { div3.setAttribute("style", "display:none;"); }
    for(j=0; j<mdkey.value_array.length; j++) {
      if(j>0) { div3.appendChild(document.createElement('br')); }
      var mdvalue = mdkey.value_array[j];
      var span2 = div3.appendChild(document.createElement('span'));
      span2.setAttribute("style", "margin-left:20px; color:rgb(150,150,150);");
      span2.innerHTML = mdvalue.source_count;

      var a2 = div3.appendChild(document.createElement('a'));
      a2.setAttribute("style", "margin-left:5px;");
      a2.setAttribute("target", "eeDB_source_view");
      a2.setAttribute("href", "./");
      a2.setAttribute("onclick", "dexSourceMdataParameter('sourceids', \""+mdvalue.source_ids+"\"); return false;");
      a2.setAttribute("onmouseover", "eedbMessageTooltip('refine to "+ mdvalue.source_count+" sources',120);");
      a2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      a2.innerHTML = mdvalue.value;
    }
    mdkey.values_div = div3;

  }
}

function dex_mdstats_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.source_count != b.source_count) { return b.source_count - a.source_count; }

  if(a.value_count != b.value_count) { return b.value_count - a.value_count; }

  return 0;
}


function dexSourceMdataParameter(mode, value) {
  if(mode=="hideshowvalues") {
    for(i=0; i<contents.datasources.mdstats_array.length; i++) {
      var mdkey = contents.datasources.mdstats_array[i];
      if(mdkey.key == value) { 
        mdkey.show_values = !mdkey.show_values; 
        if(mdkey.show_values) { 
          mdkey.hideshow_button.innerHTML = "hide values"; 
          mdkey.values_div.setAttribute("style", "display:block;");
        } else { 
          mdkey.hideshow_button.innerHTML = "show values"; 
          mdkey.values_div.setAttribute("style", "display:none;");
        }
      }
    }
  }
  if(mode=="sourceids") {
    //document.getElementById("message").innerHTML = "select source_ids ["+value+"]";
    contents.filters.source_ids = value;
    contents.current_index = 0;
    dexSearchClear(true);
    return;
  }
  if(mode=="fullload") {
    contents.datasources.mdstats_fullload = value;
    dexReloadSourceMetadataStats();
  }
}


//---------------------------------------------------------------------------

function dexShowSourceInfo(datatype, id) {
  eedbClearSearchTooltip();
  var object;
  if(datatype == "view")   { object = dexGetConfig(datatype, id); }
  if(datatype == "track")  { object = dexGetConfig(datatype, id); } 
  if(datatype == "script") { object = dexGetConfig(datatype, id); }
  if(datatype == "report") { object = dexGetConfig(datatype, id); }

  if(datatype == "datasource") { 
    var sources_array = dexFilteredDataSourcesArray();
    for(j=0; j<sources_array.length; j++) {
      var source = sources_array[j];
      if(source && source.id == id) { object = source; break; }
    }
  }

  if(!object) { object = eedbReloadObject(id); }
  if(!object) { return false; }
  if(!object.full_load) { object.request_full_load = true; }

  object.finishFunction = dexReloadContentsData;

  var e = window.event
  toolTipWidth=450;
  moveToMouseLoc(e);

  if(object.classname == "Experiment") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "FeatureSource") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "EdgeSource") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "Assembly") {
    eedbDisplaySourceInfo(object);
  }
  if(object.classname == "Configuration") {
    //document.getElementById("message").innerHTML = "try to display/edit a config : " + id;
    //used for config info display/edit
    eedbDisplaySourceInfo(object);

    var info_options = document.getElementById("source_info_panel_options");
    if(info_options) {
      //info_options.innerHTML = "config ["+object.uuid+"]";
      info_options.innerHTML = "";

      var tdiv = info_options.appendChild(document.createElement('div'));

      var delbutton = tdiv.appendChild(new Element('input'));
      delbutton.setAttribute('type', "button");
      delbutton.setAttribute('value', "delete configuration");
      delbutton.setAttribute("style", "background-color:Coral; margin:0px 10px 0px 0px; font-size:11px;");
      delbutton.setAttribute("onclick", "dexDeleteConfig(\"" + object.uuid +"\");");

      var collabWidget = dexCollaborationMoveWidget(object);
      collabWidget.setAttribute("style", "padding:2px 10px 2px 5px;");
      tdiv.appendChild(collabWidget);

      info_options.appendChild(document.createElement('hr'));
    }
  }
}


function dexCollaborationMoveEvent(collab_uuid) {
  //working with the current_source panel system
  var moveButton = document.getElementById("dex_collaboration_move_widget_button");
  if(!moveButton) { return; }
  moveButton.setAttribute("disabled", "disabled");

  if(!current_source) { return; }
  current_source.move_to_collaboration = collab_uuid;
  if(!current_source.collaboration) { return; }
  if(current_source.collaboration.uuid == collab_uuid) { return; }
  moveButton.removeAttribute("disabled");
}

function dexMoveConfigCollaboration() {
  //working with the current_source panel system
  if(!current_source) { eedbSourceInfoEvent('close'); return; }
  var new_collab = current_source.move_to_collaboration;
  if(!new_collab) { eedbSourceInfoEvent('close'); return; }
  if(!current_source.collaboration) { eedbSourceInfoEvent('close'); return; }
  if(current_source.collaboration.uuid == new_collab) { eedbSourceInfoEvent('close'); return; }

  //send move webservice command
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>moveconfig</mode>\n";
  paramXML += "<uuid>"+current_source.uuid+"</uuid>";
  paramXML += "<collaboration_uuid>"+new_collab+"</collaboration_uuid>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbConfigCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.setRequestHeader("Content-length", paramXML.length);
  xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  //refresh views
  eedbSourceInfoEvent('close');
  dexReloadContentsData();
  dexShowContents();
}



function dexCollaborationMoveWidget(object) {
  var collabWidget = document.createElement('div');
  collabWidget.innerHTML = ""; //to clear old content
  collabWidget.id ="dex_collaboration_move_widget";

  var span2 = document.createElement('span');
  span2.innerHTML = "collaboration: ";
  collabWidget.appendChild(span2);

  var collabSelect = collabWidget.appendChild(document.createElement('select'));
  collabSelect.setAttribute('name', "datatype");
  collabSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  collabSelect.setAttribute("onchange", "dexCollaborationMoveEvent(this.value);");
  collabSelect.innerHTML = ""; //to clear old content

  if(object.collaboration) {
    var option = collabSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "private");
    if(object.collaboration.uuid == "private") { option.setAttributeNS(null, "selected", "selected"); }
    option.innerHTML = "private";

    // make cgi query
    var collabXMLHttp = GetXmlHttpObject()
    if(collabXMLHttp == null) { return collabWidget; }

    var url = eedbUserCGI+"?mode=collaborations;format=simplexml;submode=member";
    collabXMLHttp.open("GET", url, false);  //not async
    collabXMLHttp.send(null);
    if(collabXMLHttp.responseXML == null) { return collabWidget; }
    if(collabXMLHttp.readyState!=4) { return collabWidget; }
    if(collabXMLHttp.status!=200) { return collabWidget; }

    var xmlDoc=collabXMLHttp.responseXML.documentElement;
    if(xmlDoc==null) { return collabWidget; }


    var collab_array = new Array;
    var xmlCollabs = xmlDoc.getElementsByTagName("collaboration");
    for(i=0; i<xmlCollabs.length; i++) {
      var collaboration = eedbParseCollaborationData(xmlCollabs[i]);
      collab_array.push(collaboration);
    }
    collab_array.sort(eedb_collab_sort_func);

    for(i=0; i<collab_array.length; i++) {
      var collaboration = collab_array[i];    
      var option = collabSelect.appendChild(document.createElement('option'));
      option.setAttribute("value", collaboration.uuid);
      if(collaboration.uuid == object.collaboration.uuid) { option.setAttributeNS(null, "selected", "selected"); }
      option.innerHTML = collaboration.name;
    }
  }

  //var button = collabWidget.appendChild(document.createElement('button'));
  var button = collabWidget.appendChild(document.createElement('input'));
  button.setAttribute('type', "button");
  button.id ="dex_collaboration_move_widget_button";
  button.className = "slimbutton";
  button.value = "move";
  button.style.fontSize = "12px";
  //button.setAttribute("style", "margin-left:5px;");
  button.setAttribute("onclick", "dexMoveConfigCollaboration();return false");
  button.innerHTML = "move";
  button.setAttribute("disabled", "disabled");

  return collabWidget;
}



//---------------------------------------------------------------------------
//
// Predefined tracks section
//
//---------------------------------------------------------------------------


function dexReloadTracksData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  contents.filters.platform = "";

  var tracks = contents.tracks;

  tracks.tracks_array = new Array();
  tracks.platforms = new Object;

  //do not clear hash, but instead "hide" the unselected tracks
  for(var uuid in tracks.tracks_hash) {
    var track = tracks.tracks_hash[uuid];
    if(!track) { continue; }
    if(track.selected) { track.visible=true; } else { track.visible = false; }
  }
  
  //contents.current_index = 0;
  contents.loading = true;

  dexShowControls();

  contentsXMLHttp=GetXmlHttpObject();
  contentsXMLHttp.onreadystatechange=dexPrepareTracksData;

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>search</mode><format>minxml</format><configtype>track</configtype>\n";
  paramXML += "<sort>create_date</sort><sort_order>desc</sort_order>";
  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    paramXML += "<filter>";
    if(contents.filters.assembly != "") { paramXML += contents.filters.assembly + " "; }
    if(contents.filters.search != "") { paramXML += contents.filters.search; }
    paramXML += "</filter>";
  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "</zenbu_query>\n";
  
  contentsXMLHttp.open("POST", eedbConfigCGI, true);
  contentsXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  contentsXMLHttp.send(paramXML);

  /*
  //var url = eedbConfigCGI+"?configtype=track;mode=search;format=minxml;sort=name;sort_order=asc";
  var url = eedbConfigCGI+"?configtype=track;mode=search;format=minxml;sort=create_date;sort_order=desc";
  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    url += ";filter=";
    if(contents.filters.assembly != "") { url += " "+contents.filters.assembly; }
    if(contents.filters.search != "") { url += " "+contents.filters.search; }
  }
  url += ";collab=" + current_collaboration.uuid;
  contentsXMLHttp.open("GET", url, true);
  contentsXMLHttp.send(null);
  */
}


function dexPrepareTracksData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  if(contentsXMLHttp == null) { return; }
  if(contentsXMLHttp.responseXML == null) return;
  if(contentsXMLHttp.readyState!=4) return;
  if(contentsXMLHttp.status!=200) { return; }
  var xmlDoc=contentsXMLHttp.responseXML.documentElement;

  if(xmlDoc==null) {
    contents_table_div.setStyle({color:'black', opacity:1.0}).update('Problem with eeDB server!');
    return;
  } 

  contents.loading = false;
  var tracks = contents.tracks;
  tracks.tracks_array.clear();

  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    tracks.total_count = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
  }

  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");

    var track = tracks.tracks_hash[uuid];
    if(!track) {
      track = new Object;
      track.uuid = uuid;
      track.selected = false;
      tracks.tracks_hash[uuid] = track;
    }
    track.visible = true;
    dexParseTrackData(xmlConfig, track);

    tracks.tracks_array.push(track);
  }

  if(tracks.tracks_array.length > tracks.total_count) { tracks.total_count = tracks.tracks_array.length; }

  //dexCreateAssemblySelect();
  //dexCreatePlatformSelect();
  //dexCreateOthers();
  dexShowCart();
  dexShowTracks();
}


function dexParseTrackData(xmlConfig, track) {
  if(!xmlConfig) { return; }
  if(!track) { return; }

  track.classname    = "Configuration";
  track.uuid         = xmlConfig.getAttribute("uuid");
  track.name         = xmlConfig.getAttribute("desc");
  track.access_count = Math.floor(xmlConfig.getAttribute("access_count"));
  track.assembly     = "";
  track.description  = "";
  track.title        = "";
  track.create_date  = "";
  track.trackDOM     = undefined;

  eedbParseMetadata(xmlConfig, track);

  var mdata = xmlConfig.getElementsByTagName("mdata");
  for(j=0; j<mdata.length; ++j) {
    if(!(mdata[j].firstChild)) { continue; }
    if(mdata[j].getAttribute("type")=="date") { track.create_date = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="title") { track.name = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="description") { track.description = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="REMOTE_ADDR") { track.remote_addr = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="configXML") { 
      var configDOM = mdata[j].firstChild; 
      var newTracks = configDOM.getElementsByTagName("gLyphTrack");
      if(!newTracks) { continue; }
      if(newTracks.length != 1) { continue; }
      var newTrack = newTracks[0];
      var source_ids = newTrack.getAttribute("source_ids");
      if(source_ids) { track.source_array = source_ids.split(","); }
      var source_names = newTrack.getAttribute("sources");
      if(source_names) { track.source_names = source_names.split(","); }
      track.trackDOM = newTrack.cloneNode(true);
    }
  }

  track.owner_openID = "";
  track.author       = "";
  var user = xmlConfig.getElementsByTagName("eedb_user");
  if(user && user.length >0) {
    track.author = user[0].getAttribute("nickname");
    track.owner_openID = user[0].getAttribute("openID");
  }

  track.collaboration = undefined;
  var collaboration = xmlConfig.getElementsByTagName("collaboration");
  if(collaboration && collaboration.length >0) {
    track.collaboration = eedbParseCollaborationData(collaboration[0]);
  }


  if(track.trackDOM) {
    track.trackDOM.removeAttribute("trackID");
    if(track.uuid) { track.trackDOM.setAttribute("uuid", track.uuid); }
  }
}


function dexFilteredTracksArray() {
  var filters = contents.filters;

  var tracks_hash = contents.tracks.tracks_hash;
  var filter_array = new Array;
  for(var uuid in tracks_hash) {
    var track = tracks_hash[uuid];
    if(!track.visible) { continue; }
    //if((filters.platform!="") && (filters.platform != experiment.platform)) { continue; }
    //if(filters.hide_mapcount && (/mapcount/.test(experiment.name))) { continue; }
    filter_array.push(track);
  }
  
  return filter_array;
}


function dexShowTracks() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  contents_table_div.innerHTML = "";

  if(contents.loading) {
    contents_table_div.innerHTML = "loading data...";
    return;
  }

  var tracks_array = dexFilteredTracksArray();
  if(!tracks_array) { return; }

  dexCreateAssemblySelect();

  //
  // build the table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('select'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('genome'));
  //trhead.appendChild(new Element('th', { 'class': 'listView' }).update('author'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('create date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('data sources'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('accessed'));

  var num_pages = Math.ceil(tracks_array.length / contents.page_size);
  contents.tracks.filter_count = tracks_array.length;
  contents.num_pages = num_pages;

  if(contents.current_index > (num_pages-1) * contents.page_size) {
    contents.current_index = (num_pages-1) * contents.page_size;
    if(contents.current_index <0) { contents.current_index=0; }
  }

  var load_ids="";
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=tracks_array.length) { break; }
    var config = tracks_array[i];
    if(load_ids) { load_ids += ","; }
    load_ids += config.uuid;
  }
  dexLoadFullConfigList(load_ids, contents.tracks.tracks_hash);
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=tracks_array.length) { break; }

    var track = tracks_array[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    tr.appendChild(new Element('td').update(i+1));

    var td = tr.appendChild(new Element('td'));
    var input = td.appendChild(new Element('input'));
    input.setAttribute('type', "checkbox");
    input.setAttribute("style", "background:white;");
    input.setAttribute("onclick", "dexAlterSelection('track-check', \"" +track.uuid+ "\");");
    if(track.selected) { input.setAttribute('checked', "checked"); }
    

    var idTD = tr.appendChild(document.createElement('td'));
    idTD.innerHTML = track.name;

    tr.appendChild(new Element('td').update(encodehtml(track.assembly)));

    td = tr.appendChild(document.createElement('td'));
    var span1 = td.appendChild(document.createElement('span'));
    span1.innerHTML = encodehtml(track.description);
    button = td.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onmouseover", "eedbMessageTooltip('metadata details panel',130);");
    button.setAttribute("onclick", "dexShowSourceInfo(\"track\",\"" +track.uuid+ "\"); return false;");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML ="details";


    //create data/owner/edit cell
    var td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(track.author) { 
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = track.author;
    } else if(track.owner_identity) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = track.owner_identity;
    }
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = track.create_date;
    
    var src_info="";
    var fs_cnt=0;
    var exp_cnt=0;
    if(track.source_array) {
      for(var k=0; k<track.source_array.length; k++) {
        var srcid = track.source_array[k];
        if(/FeatureSource/.test(srcid)) { fs_cnt++; }
        if(/Experiment/.test(srcid)) { exp_cnt++; }
      }
    }
    if(track.source_names) {
      fs_cnt += track.source_names.length;
    }
    if(fs_cnt>0) { src_info += fs_cnt+" annot."; }
    if(exp_cnt>0) { 
      if(src_info!="") { src_info += " "; }
      src_info += exp_cnt+" exps."; 
    }
    tr.appendChild(new Element('td').update(encodehtml(src_info)));
    tr.appendChild(new Element('td').update(track.access_count));
  }

  if(tracks_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }


  // build the display now
  //
  contents_table_div.innerHTML = "";

  //paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = tracks_array.length + " filtered ";
  msg += contents.tracks.total_count + " total tracks";
  span1.innerHTML = msg;

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);

  var span3 = div2.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', contents.page_size);
  input.setAttribute("onchange", "dexReconfigContentsParam('page-size', this.value);return false;");

  if(contents.loading) {
    var div2 = contents_table_div.appendChild(new Element('div'));
    div2.innerHTML ="loading data...";
    return;
  }
  
  // the table
  contents_table_div.appendChild(div1);

  //bottom paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = tracks_array.length + " filtered ";
  msg += contents.tracks.total_count + " total tracks";
  span1.innerHTML = msg;

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);
}


//---------------------------------------------------------------------------
//
// View Configs section
//
//---------------------------------------------------------------------------


function dexReloadViewsData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  contents.filters.platform = "";

  var configs = contents.configs;

  configs.views_array = new Array();
  configs.views_hash = new Object();
  configs.platforms = new Object;

  //contents.current_index = 0;
  contents.loading = true;

  dexShowControls();

  contentsXMLHttp=GetXmlHttpObject();
  contentsXMLHttp.onreadystatechange=dexPrepareViewsData;

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>search</mode><format>minxml</format><configtype>view</configtype>\n";
  paramXML += "<sort>create_date</sort><sort_order>desc</sort_order>";
  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    paramXML += "<filter>";
    if(contents.filters.assembly != "") { paramXML += contents.filters.assembly + " "; }
    if(contents.filters.search != "") { paramXML += contents.filters.search; }
    paramXML += "</filter>";
  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "</zenbu_query>\n";

  contentsXMLHttp.open("POST", eedbConfigCGI, true);
  contentsXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  contentsXMLHttp.send(paramXML);

  /*
  var url = eedbConfigCGI+"?configtype=view;mode=search;format=minxml;sort=create_date;sort_order=desc";
  //var url = eedbConfigCGI+"?configtype=view;mode=search;format=minxml;sort=name;sort_order=asc";
  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    url += ";filter=";
    if(contents.filters.assembly != "") { url += contents.filters.assembly + " "; }
    if(contents.filters.search != "") { url += contents.filters.search; }
  }
  url += ";collab=" + current_collaboration.uuid;
  contentsXMLHttp.open("GET", url, true);
  contentsXMLHttp.send(null);
  */
}


function dexPrepareViewsData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  if(contentsXMLHttp == null) { return; }
  if(contentsXMLHttp.responseXML == null) return;
  if(contentsXMLHttp.readyState!=4) return;
  if(contentsXMLHttp.status!=200) { return; }
  var xmlDoc=contentsXMLHttp.responseXML.documentElement;

  if(xmlDoc==null) {
    contents_table_div.setStyle({color:'black', opacity:1.0}).update('Problem with eeDB server!');
    return;
  } 

  contents.loading = false;
  var configs = contents.configs;

  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    configs.total_count = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
  }

  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");

    var config = configs.views_hash[uuid];
    if(!config) {
      config = new Object;
      config.uuid = uuid;
      config.selected = false;
      configs.views_hash[uuid] = config;
    }
    eedbParseConfigurationData(xmlConfig, config);
  }

  configs.views_array.clear();
  for(var uuid in configs.views_hash) {
    var config = configs.views_hash[uuid];
    configs.views_array.push(config);
  }
  if(configs.views_array.length > configs.total_count) { configs.total_count = configs.views_array.length; }

  dexShowCart();
  dexShowViews();
}


function dexFilteredViewsArray() {
  var filters = contents.filters;

  var views_array = contents.configs.views_array;
  var filter_array = new Array;
  for(var i=0; i<views_array.length; i++) {
    var config = views_array[i];
    //if((filters.platform!="") && (filters.platform != experiment.platform)) { continue; }
    //if(filters.hide_mapcount && (/mapcount/.test(experiment.name))) { continue; }
    filter_array.push(config);
  }
  return filter_array;
}


function dexShowViews() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  contents_table_div.innerHTML = "";

  if(contents.loading) {
    var div2 = contents_table_div.appendChild(new Element('div'));
    div2.innerHTML ="loading data...";
    return;
  }

  var views_array = dexFilteredViewsArray();
  if(!views_array) { return; }

  dexCreateAssemblySelect();

  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('genome'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('create date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('accessed'));
  //trhead.appendChild(new Element('th', { 'class': 'listView' }).update('dex template'));

  var num_pages = Math.ceil(views_array.length / contents.page_size);
  contents.configs.filter_count = views_array.length;
  contents.num_pages = num_pages;

  if(contents.current_index > (num_pages-1) * contents.page_size) {
    contents.current_index = (num_pages-1) * contents.page_size;
    if(contents.current_index <0) { contents.current_index=0; }
  }
   
  var load_ids="";
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=views_array.length) { break; }
    var config = views_array[i];
    if(load_ids) { load_ids += ","; }
    load_ids += config.uuid;
  }
  dexLoadFullConfigList(load_ids, contents.configs.views_hash);
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=views_array.length) { break; }

    var config = views_array[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    tr.appendChild(new Element('td').update(i+1));

    //var td = tr.appendChild(document.createElement('td'));
    //td.innerHTML = "<a href=\"../gLyphs/#config=" +config.uuid+ "\">view</a>";

    td = tr.appendChild(document.createElement('td'));
    var a1 = td.appendChild(document.createElement('a'));
    a1.setAttribute("href", "../gLyphs/#config=" +config.uuid);
    a1.innerHTML = config.name;
    a1.setAttribute("onmouseover", "eedbMessageTooltip('open visualization view in genome browser',120);");
    a1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    //td = tr.appendChild(document.createElement('td'));
    //var span1 = td.appendChild(document.createElement('span'));
    //span1.innerHTML = encodehtml(config.name);
    //button = td.appendChild(new Element('button'));
    //button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //button.setAttribute("type", "button");
    //button.setAttribute("onmouseover", "eedbMessageTooltip('open visualization view in genome browser',120);");
    //button.setAttribute("onclick", "dexOpenView(\"" +config.uuid+ "\"); return false;");
    //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //button.innerHTML ="open view";

    td = tr.appendChild(document.createElement('td'));
    td.innerHTML = encodehtml(config.assembly);

    td = tr.appendChild(document.createElement('td'));
    var span1 = td.appendChild(document.createElement('span'));
    span1.innerHTML = encodehtml(config.description);
    button = td.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onmouseover", "eedbMessageTooltip('metadata details panel',130);");
    button.setAttribute("onclick", "dexShowSourceInfo(\"view\",\"" +config.uuid+ "\"); return false;");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML ="details";


    //create data/owner edit cell
    td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(config.author) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = config.author;
    } else if(config.owner_identity) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = config.owner_identity;
    }
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = config.create_date;


    tr.appendChild(new Element('td').update(config.access_count));

    /*
    var td = tr.appendChild(new Element('td'));
    var input = td.appendChild(new Element('input'));
    input.setAttribute('type', "radio");
    input.setAttribute("name", "DEX_viewconfig_select_radio");
    input.setAttribute("onclick", "dexAlterSelection('viewconfig-check', \"" +config.uuid+ "\");");
    //if(track.selected) { input.setAttribute('checked', "checked"); }
    */

  }

  if(views_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }


  contents_table_div.innerHTML = "";

  //paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = views_array.length + " filtered ";
  msg += contents.configs.total_count + " total configs";
  span1.innerHTML = msg;

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);

  var span3 = div2.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', contents.page_size);
  input.setAttribute("onchange", "dexReconfigContentsParam('page-size', this.value);return false;");

  //data table
  contents_table_div.appendChild(div1);

  //bottom paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = views_array.length + " filtered ";
  msg += contents.configs.total_count + " total configs";
  span1.innerHTML = msg;

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);
}


function dexOpenView(uuid) {
  var url = "../gLyphs/#config="+uuid;
  //document.getElementById("message").innerHTML += "   "+ url;
  location.href= url;
}


//---------------------------------------------------------------------------
//
// Reports Configs section
//
//---------------------------------------------------------------------------


function dexReloadReportsData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }
  
  contents.filters.platform = "";
  
  var configs = contents.configs;
  
  configs.reports_array = new Array();
  configs.reports_hash = new Object();
  configs.platforms = new Object;
  
  //contents.current_index = 0;
  contents.loading = true;
  
  dexShowControls();
  
  contentsXMLHttp=GetXmlHttpObject();
  contentsXMLHttp.onreadystatechange=dexPrepareReportsData;
  
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>search</mode><format>minxml</format><configtype>reports</configtype>\n"; //minxml
  paramXML += "<sort>create_date</sort><sort_order>desc</sort_order>";
  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    paramXML += "<filter>";
    if(contents.filters.assembly != "") { paramXML += contents.filters.assembly + " "; }
    if(contents.filters.search != "") { paramXML += contents.filters.search; }
    paramXML += "</filter>";
  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "</zenbu_query>\n";
  
  contentsXMLHttp.open("POST", eedbConfigCGI, true);
  contentsXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  contentsXMLHttp.send(paramXML);
}


function dexPrepareReportsData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }
  
  if(contentsXMLHttp == null) { return; }
  if(contentsXMLHttp.responseXML == null) return;
  if(contentsXMLHttp.readyState!=4) return;
  if(contentsXMLHttp.status!=200) { return; }
  var xmlDoc=contentsXMLHttp.responseXML.documentElement;
  
  if(xmlDoc==null) {
    contents_table_div.setStyle({color:'black', opacity:1.0}).update('Problem with eeDB server!');
    return;
  }
  
  contents.loading = false;
  var configs = contents.configs;
  
  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    configs.total_count = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
  }
  
  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");
    
    var config = configs.reports_hash[uuid];
    if(!config) {
      config = new Object;
      config.uuid = uuid;
      config.selected = false;
      configs.reports_hash[uuid] = config;
    }
    eedbParseConfigurationData(xmlConfig, config);
  }
  
  configs.reports_array.clear();
  for(var uuid in configs.reports_hash) {
    var config = configs.reports_hash[uuid];
    configs.reports_array.push(config);
  }
  if(configs.reports_array.length > configs.total_count) { configs.total_count = configs.reports_array.length; }
  
  dexShowCart();
  dexShowReports();
}


function dexFilteredReportsArray() {
  var filters = contents.filters;
  
  var reports_array = contents.configs.reports_array;
  var filter_array = new Array;
  for(var i=0; i<reports_array.length; i++) {
    var config = reports_array[i];
    //if((filters.platform!="") && (filters.platform != experiment.platform)) { continue; }
    //if(filters.hide_mapcount && (/mapcount/.test(experiment.name))) { continue; }
    if(contents.filters.show_fixedID_reports && !config.fixed_id) { continue; }
    
    filter_array.push(config);
  }
  return filter_array;
}


function dexShowReports() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }
  
  contents_table_div.innerHTML = "";
  
  if(contents.loading) {
    var div2 = contents_table_div.appendChild(new Element('div'));
    div2.innerHTML ="loading data...";
    return;
  }
  
  var reports_array = dexFilteredReportsArray();
  if(!reports_array) { return; }
  
  dexCreateAssemblySelect();
  
  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('fixedID'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('create date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('accessed'));
  //trhead.appendChild(new Element('th', { 'class': 'listView' }).update('dex template'));
  
  var num_pages = Math.ceil(reports_array.length / contents.page_size);
  contents.configs.filter_count = reports_array.length;
  contents.num_pages = num_pages;
  
  if(contents.current_index > (num_pages-1) * contents.page_size) {
    contents.current_index = (num_pages-1) * contents.page_size;
    if(contents.current_index <0) { contents.current_index=0; }
  }
  
  var load_ids="";
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=reports_array.length) { break; }
    var config = reports_array[i];
    if(load_ids) { load_ids += ","; }
    load_ids += config.uuid;
  }
  dexLoadFullConfigList(load_ids, contents.configs.reports_hash);
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=reports_array.length) { break; }
    
    var config = reports_array[i];
    
    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') }
    else { tr.addClassName('even') }
    
    tr.appendChild(new Element('td').update(i+1));
    
    //var td = tr.appendChild(document.createElement('td'));
    //td.innerHTML = "<a href=\"../gLyphs/#config=" +config.uuid+ "\">view</a>";
    
    td = tr.appendChild(document.createElement('td'));
    var a1 = td.appendChild(document.createElement('a'));
    a1.setAttribute("href", "../reports/#" +config.uuid);
    a1.innerHTML = config.name;
    a1.setAttribute("onmouseover", "eedbMessageTooltip('open analysis report',120);");
    a1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    
    td = tr.appendChild(document.createElement('td'));
    td.innerHTML = encodehtml(config.fixed_id);
    
    td = tr.appendChild(document.createElement('td'));
    var span1 = td.appendChild(document.createElement('span'));
    span1.innerHTML = encodehtml(config.description);
    button = td.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onmouseover", "eedbMessageTooltip('metadata details panel',130);");
    button.setAttribute("onclick", "dexShowSourceInfo(\"report\",\"" +config.uuid+ "\"); return false;");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML ="details";
    
    
    //create data/owner edit cell
    td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(config.author) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = config.author;
    } else if(config.owner_identity) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = config.owner_identity;
    }
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = config.create_date;
    
    
    tr.appendChild(new Element('td').update(config.access_count));
  }
  
  if(reports_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }
  
  
  contents_table_div.innerHTML = "";
  
  //paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = reports_array.length + " filtered ";
  msg += contents.configs.total_count + " total configs";
  span1.innerHTML = msg;
  
  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);
  
  var span3 = div2.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', contents.page_size);
  input.setAttribute("onchange", "dexReconfigContentsParam('page-size', this.value);return false;");
  
  //data table
  contents_table_div.appendChild(div1);
  
  //bottom paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = reports_array.length + " filtered ";
  msg += contents.configs.total_count + " total configs";
  span1.innerHTML = msg;
  
  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);
}


//---------------------------------------------------------------------------
//
// Scripts section
//
//---------------------------------------------------------------------------


function dexReloadScriptsData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  contents.filters.platform = "";

  var scripts = contents.scripts;

  scripts.scripts_hash = new Object();
  scripts.scripts_array = new Array();
  scripts.platforms = new Object;

  //contents.current_index = 0;
  contents.loading = true;

  dexShowControls();

  contentsXMLHttp=GetXmlHttpObject();
  contentsXMLHttp.onreadystatechange=dexPrepareScriptsData;
  var url = eedbConfigCGI+"?configtype=script;mode=search;format=minxml;sort=create_date;sort_order=desc";
  if((contents.filters.assembly != "") || (contents.filters.search != "")) {
    url += ";filter=";
    if(contents.filters.assembly != "") { url += " "+contents.filters.assembly; }
    if(contents.filters.search != "") { url += " "+contents.filters.search; }
  }
  url += ";collab=" + current_collaboration.uuid;
  contentsXMLHttp.open("GET", url, true);
  contentsXMLHttp.send(null);
  dexPrepareScriptsData();
}


function dexPrepareScriptsData() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  if(contentsXMLHttp == null) { return; }
  if(contentsXMLHttp.responseXML == null) return;
  if(contentsXMLHttp.readyState!=4) return;
  if(contentsXMLHttp.status!=200) { return; }
  var xmlDoc=contentsXMLHttp.responseXML.documentElement;

  if(xmlDoc==null) {
    contents_table_div.setStyle({color:'black', opacity:1.0}).update('Problem with eeDB server!');
    return;
  } 

  contents.loading = false;
  var scripts = contents.scripts;

  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    var total = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
    if(total>0) { scripts.total_count = total; }
  }

  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var xmlConfig = xmlConfigs[i];
    var uuid = xmlConfig.getAttribute("uuid");

    var script = scripts.scripts_hash[uuid];
    if(!script) {
      script = new Object;
      script.uuid = uuid;
      script.selected = false;
      scripts.scripts_hash[uuid] = script;
    }
    eedbParseConfigurationData(xmlConfig, script);
  }

  scripts.scripts_array.clear();
  for(var uuid in scripts.scripts_hash) {
    var script = scripts.scripts_hash[uuid];
    scripts.scripts_array.push(script);
  }
  if(scripts.scripts_array.length > scripts.total_count) { scripts.total_count = scripts.scripts_array.length; }

  dexShowCart();
  dexShowScripts();
}


function dexFilteredScriptsArray() {
  var filters = contents.filters;

  var scripts_array = contents.scripts.scripts_array;
  var filter_array = new Array;
  for(var i=0; i<scripts_array.length; i++) {
    var script = scripts_array[i];
    //if((filters.platform!="") && (filters.platform != experiment.platform)) { continue; }
    //if(filters.hide_mapcount && (/mapcount/.test(experiment.name))) { continue; }
    filter_array.push(script);
  }
  return filter_array;
}


function dexShowScripts() {
  var contents_table_div = document.getElementById("contents_table_div");
  if(!contents_table_div) { return; }

  if(contents.loading) {
    contents_table_div.innerHTML = "loading data...";
    return;
  }

  var scripts_array = dexFilteredScriptsArray();
  if(!scripts_array) { return; }

  //check if there are sources to make tracks
  var has_datasources = false;
  for(var srcid in contents.cart.sources) { has_datasources = true; }

  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('build track'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('create date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('accessed'));

  var num_pages = Math.ceil(scripts_array.length / contents.page_size);
  contents.scripts.filter_count = scripts_array.length;
  contents.num_pages = num_pages;

  if(contents.current_index > (num_pages-1) * contents.page_size) {
    contents.current_index = (num_pages-1) * contents.page_size;
    if(contents.current_index <0) { contents.current_index=0; }
  }
    
  var load_ids="";
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=scripts_array.length) { break; }
    var config = scripts_array[i];
    if(load_ids) { load_ids += ","; }
    load_ids += config.uuid;
  }
  dexLoadFullConfigList(load_ids, contents.scripts.scripts_hash);
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<contents.page_size; j++) {
    var i = j+ contents.current_index;
    if(i>=scripts_array.length) { break; }

    var script = scripts_array[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    tr.appendChild(new Element('td').update(i+1));

    //build track
    var td = tr.appendChild(new Element('td'));
    var button = td.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin:2px; border-radius: 5px; border: solid 1px #535353; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "dexCreateTrackFromScriptConfig(\"" +script.uuid+ "\"); return false;");
    button.innerHTML = "build track";
    if(!has_datasources) { button.setAttribute("disabled", "disabled"); }


    var idTD = tr.appendChild(document.createElement('td'));
    idTD.innerHTML = script.name;
    //var a1 = idTD.appendChild(document.createElement('a'));
    //a1.setAttribute("target", "eeDB_source_view");
    //a1.setAttribute("href", "./");
    //a1.setAttribute("onclick", "dexShowSourceInfo(\"script\",\"" +script.uuid+ "\"); return false;");
    //a1.innerHTML = script.name;

    td = tr.appendChild(document.createElement('td'));
    var span1 = td.appendChild(document.createElement('span'));
    span1.innerHTML = encodehtml(script.description);
    button = td.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onmouseover", "eedbMessageTooltip('metadata details panel',130);");
    button.setAttribute("onclick", "dexShowSourceInfo(\"script\",\"" +script.uuid+ "\"); return false;");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML ="details";



    //create data/owner edit cell
    var td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    if(script.author) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = script.author;
    } else if(script.owner_identity) {
      var tspan = tdiv.appendChild(new Element('span'));
      tspan.innerHTML = script.owner_identity;
    }
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = script.create_date;

    tr.appendChild(new Element('td').update(script.access_count));
  }

  if(scripts_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }

  contents_table_div.innerHTML = "";

  //paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = scripts_array.length + " filtered ";
  msg += contents.scripts.total_count + " total scripts";
  span1.innerHTML = msg;

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);

  var span3 = div2.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', contents.page_size);
  input.setAttribute("onchange", "dexReconfigContentsParam('page-size', this.value);return false;");

  // the table
  contents_table_div.appendChild(div1);

  //bottom paging interface
  var div2 = contents_table_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = scripts_array.length + " filtered ";
  msg += contents.scripts.total_count + " total scripts";
  span1.innerHTML = msg;

  var pagingSpan = dexPagingInterface();
  div2.appendChild(pagingSpan);
}


function dexLoadFullConfigList(ids, configs_hash) {
  if(!ids) { return; }
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>configs</mode><format>simplexml</format><collab>all</collab>\n";
  paramXML += "<uuid_list>" + ids + "</uuid_list>\n";
  paramXML += "</zenbu_query>\n";
  
  var singleExperimentXMLHttp=GetXmlHttpObject();
  singleExperimentXMLHttp.open("POST", eedbConfigCGI, false);
  singleExperimentXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  singleExperimentXMLHttp.send(paramXML);
  
  if(singleExperimentXMLHttp == null) { return; }
  if(singleExperimentXMLHttp.responseXML == null) return;
  if(singleExperimentXMLHttp.readyState!=4) return;
  if(singleExperimentXMLHttp.status!=200) { return; }
  var xmlDoc=singleExperimentXMLHttp.responseXML.documentElement;
  
  if(xmlDoc==null) { return; }
  
  var xmlConfigs = xmlDoc.getElementsByTagName("configuration");
  for(i=0; i<xmlConfigs.length; i++) {
    var configDOM = xmlConfigs[i];
    var uuid = configDOM.getAttribute("uuid");
    var config = configs_hash[uuid];
    if(!config) { continue; }
    eedbParseConfigurationData(configDOM, config);
  }
}

//---------------------------------------------------------------------------
//
// common interface elements
//
//---------------------------------------------------------------------------

function dexPagingInterface() {

  var page = Math.ceil(contents.current_index / contents.page_size) + 1;

  var pagingSpan = new Element('span');
  pagingSpan.id = "dex_paging_span";

  //var pagingSpan = document.getElementById("dex_paging_span");
  //if(!pagingSpan) { 
  //  pagingSpan = new Element('span');
  //  pagingSpan.id = "dex_paging_span";
  //}
  pagingSpan.setAttribute('style', "font-family:arial,helvetica,sans-serif;");

  var tspan = pagingSpan.appendChild(new Element('a'));
  tspan.setAttribute('style', "margin-left: 75px; color:purple; text-decoration:underline;");
  tspan.setAttribute('href', "./");
  tspan.setAttribute("onclick", "dexReconfigContentsParam('previous-page'); return false");
  tspan.innerHTML = "<< previous page";

  var tspan2 = pagingSpan.appendChild(new Element('span'));
  tspan2.setAttribute('style', "margin-left: 5px; font-weight:bold;");
  tspan2.innerHTML = "| Page: ";

  var start_page = 1;
  if(page > 7) {
    var span2 = pagingSpan.appendChild(new Element('a'));
    span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline;");
    span2.setAttribute('href', "./");
    span2.setAttribute("onclick", "dexReconfigContentsParam('page', \"1\"); return false");
    span2.innerHTML = 1;

    var span2 = pagingSpan.appendChild(new Element('span'));
    span2.setAttribute('style', "margin-left: 4px; ");
    span2.innerHTML = "...";
    start_page = page - 4;
  }
  for(var j=start_page; j<start_page+9; j++) {
    if(j>contents.num_pages) { break; }
    var span2 = pagingSpan.appendChild(new Element('a'));
    span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline;");
    if(j == page) { span2.setAttribute('style', "margin-left: 4px; color:black; font-weight:bold;"); }
    span2.setAttribute('href', "./");
    span2.setAttribute("onclick", "dexReconfigContentsParam('page', \"" +j+ "\"); return false");
    span2.innerHTML = j;
  }
  if(j<=contents.num_pages) {
    var span2 = pagingSpan.appendChild(new Element('span'));
    span2.setAttribute('style', "margin-left: 4px; ");
    span2.innerHTML = "...";
    span2 = pagingSpan.appendChild(new Element('a'));
    span2.setAttribute('href', "./");
    span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline;");
    span2.setAttribute("onclick", "dexReconfigContentsParam('page', \"" +contents.num_pages+ "\"); return false");
    span2.innerHTML = contents.num_pages;
  }

  var tspan3 = pagingSpan.appendChild(new Element('span'));
  tspan3.setAttribute('style', "margin-left: 5px; color:black; font-weight:bold;");
  tspan3.innerHTML = "|";

  var tspan4 = pagingSpan.appendChild(new Element('a'));
  tspan4.setAttribute('href', "./");
  tspan4.setAttribute('style', "margin-left: 4px; font-family:arial,helvetica,sans-serif; color:purple; text-decoration:underline;");
  tspan4.setAttribute("onclick", "dexReconfigContentsParam('next-page');return false");
  tspan4.innerHTML = "next page >>";

  return pagingSpan;
}

//---------------------------------------------------------------------------
//
// Cart section
//
//---------------------------------------------------------------------------

function dexShowCart() {
  var ctrlOptions = document.getElementById("dex_contents_controls_options");
  if(!ctrlOptions) { return; }

  var cart_div = document.getElementById("dex_contents_cart");
  if(!cart_div) { 
    cart_div  = document.createElement('div');
    cart_div.id = "dex_contents_cart";
    ctrlOptions.appendChild(cart_div);
  }

  cart_div.setAttribute("style", "width:230px; top:25px; float:right; "+
                        "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                        "background-color:#FFC0FF; border:double; padding: 3px 3px 3px 3px;");
  cart_div.innerHTML = "";

  //var div1 = cart_div.appendChild(new Element('div'));
  //div1.setAttribute('style', "font-family:arial,helvetica,sans-serif; font-weight:bold;");
  //div1.innerHTML = "cart";

  var experiment_array = new Array;
  var featsource_array = new Array;
  var tracks = new Array;

  for (var srcid in contents.cart.sources) { 
    if(/FeatureSource/.test(srcid)) { featsource_array.push(srcid); }
    if(/Experiment/.test(srcid)) { experiment_array.push(srcid);  }
  }
  for (var track in contents.cart.tracks) { tracks.push(track); }

  var table1 = cart_div.appendChild(new Element('table'));
  table1.setAttribute('width', "100%");
  var tr1 = table1.appendChild(new Element('tr'));

  var td1 = tr1.appendChild(new Element('td'));
  var msg = tracks.length + " tracks ";
  td1.innerHTML = msg;

  td1 = tr1.appendChild(new Element('td'));
  msg = experiment_array.length + " experiments ";
  td1.innerHTML = msg;

  td1 = tr1.appendChild(new Element('td'));
  msg = featsource_array.length + " annotation sources ";
  td1.innerHTML = msg;

  var input = cart_div.appendChild(new Element('input'));
  input.setAttribute('type', "button");
  input.setAttribute("onclick", "dexAlterSelection('visualize-cart','');");
  input.className = "slimbutton";

  if((experiment_array.length>0) || (featsource_array.length>0)) {
    input.setAttribute('value', "configure track");
  } else {
    if(tracks.length==0) { input.setAttribute("disabled", "disabled"); }
    input.setAttribute('value', "create view");
  }

  /*
  var input = cart_div.appendChild(new Element('input'));
  input.setAttribute('type', "button");
  input.setAttribute("onclick", "dexAlterSelection('download-cart','');");
  input.setAttribute('value', "download");
  input.setAttribute("disabled", "disabled");
  if(tracks.length==0) { input.setAttribute("disabled", "disabled"); }
  */

  input = cart_div.appendChild(new Element('input'));
  input.setAttribute('type', "button");
  input.className = "slimbutton";
  input.setAttribute("onclick", "dexAlterSelection('clear-cart','');");
  input.setAttribute('value', "clear cart");
}


function dexAlterSelection(param, value) {
  if(param == "source-check") {  
    var source = contents.datasources.sources_hash[value];
    if(source) {
      source.selected = !(source.selected);
      if(source.selected) {
        contents.cart.sources[source.id] = source;
      } else {
        delete contents.cart.sources[source.id];
      }
      dexShowCart();
    }
  }
  if(param == "select-all-sources") {
    var sources_array = dexFilteredDataSourcesArray();
    for(var i=0; i<sources_array.length; i++) {
      var source = sources_array[i];
      source.selected = true;
      contents.cart.sources[source.id] = source;
    }
    dexShowCart();
    dexShowContents();
  }
  if(param == "track-check") {  
    var track = contents.tracks.tracks_hash[value];
    if(track) {
      track.selected = !(track.selected);
      if(track.selected) {
        contents.cart.tracks[track.uuid] = track;
      } else {
        delete contents.cart.tracks[track.uuid];
      }
      dexShowCart();
    }
  }
  if(param == "clear-cart") {  
    for(var id in contents.cart.sources) {
      contents.cart.sources[id].selected = false;
    }
    for(var id in contents.cart.tracks) {
      contents.cart.tracks[id].selected = false;
    }
    contents.cart.tracks = new Object;
    contents.cart.sources = new Object;
    dexShowCart();
    dexShowContents();
  }
  if(param == "visualize-cart") {  
    dexCreateGlyphsConfig();
  }
}


//---------------------------------------------------------------------------
//
// filter controls section
//
//---------------------------------------------------------------------------

function dexCreateDatasourceSelect() {
  var ctrlOptions = document.getElementById("dex_contents_controls_options");
  if(!ctrlOptions) {  return; }

  //----------
  var sourceSpan = document.getElementById("dex_search_datasource_select_span");
  if(!sourceSpan) {
    sourceSpan = ctrlOptions.appendChild(document.createElement('span'));
    sourceSpan.id = "dex_search_datasource_select_span";
    //-
    var span1 = sourceSpan.appendChild(document.createElement('span'));
    span1.setAttribute("style", "margin-left:5px; ");
    span1.innerHTML = "data source type:"
    var sourceSelect = sourceSpan.appendChild(document.createElement('select'));
    sourceSelect.id = "dex_search_datasource_select";
    sourceSelect.className = "dropdown";
  //sourceSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'source_search_mode', this.value);");
    sourceSelect.setAttribute("onchange", "dexReconfigContentsParam('datasource', this.value);");
    sourceSelect.style.marginLeft = "3px";
    sourceSelect.style.fontSize = "10px";

    var option;
    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "all");
    option.innerHTML = "all data sources";

    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "experiments");
    option.innerHTML = "only experiments";
    if(contents.filters.datasource == "experiments") { option.setAttribute("selected", "selected"); }

    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "feature_sources");
    option.innerHTML = "only feature sources";
    if(contents.filters.datasource == "feature_sources") { option.setAttribute("selected", "selected"); }

    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "edge_sources");
    option.innerHTML = "only edge sources";
    if(contents.filters.datasource == "edge_sources") { option.setAttribute("selected", "selected"); }

    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "assemblies");
    option.innerHTML = "only genome assemblies";
    if(contents.filters.datasource == "assemblies") { option.setAttribute("selected", "selected"); }
  }
  if((contents.mode=="DataSources")||(contents.mode=="Experiments")||(contents.mode=="Annotation")) { sourceSpan.style.display = "inline"; }
  else { sourceSpan.style.display = "none"; }
}


function dexCreatePlatformSelect() {
  var ctrlDiv = document.getElementById("dex_contents_controls_options");
  if(!ctrlDiv) {  return; }

  var span1          = document.getElementById("_platformSelectSpan");
  var platformSelect = document.getElementById("_platformSelect");
  if(!span1) {
    span1 = document.createElement('span');
    span1.id = "_platformSelectSpan";
    span1.setAttribute("style", "margin:2px 10px 2px 0px;");

    var span2 = document.createElement('span');
    span2.innerHTML = "experiment platforms:";
    span1.appendChild(span2);

    platformSelect = document.createElement('select');
    platformSelect.setAttribute('name', "datatype");
    platformSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    platformSelect.setAttribute("onchange", "dexReconfigContentsParam('platform', this.value);");
    platformSelect.id = "_platformSelect";
    span1.appendChild(platformSelect);
    ctrlDiv.appendChild(span1);
  }
  platformSelect.innerHTML = ""; //to clear old content

  var option = document.createElement('option');
  option.setAttribute("value", "");
  option.innerHTML = "all platforms";
  platformSelect.appendChild(option);

  var platforms = new Array;
  for (var platform in contents.datasources.platforms) {
    platforms.push(platform);
  }
  platforms.sort(function(x,y){
       var a = String(x).toUpperCase();
       var b = String(y).toUpperCase();
       if(a > b) { return 1; }
       if(a < b) { return -1; }
       return 0; });

  for (var i=0; i<platforms.length; i++) {
    var platform = platforms[i];
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", platform);
    //if(type == track.exptype) { option.setAttributeNS(null, "selected", "selected"); }
    option.innerHTML = platform;
    platformSelect.appendChild(option);
  }

  return span1;
}


function dexCreateAssemblySelect() {
  var ctrlDiv = document.getElementById("dex_contents_controls_options");
  if(!ctrlDiv) {  return; }

  current_genome.callOutFunction = dexGenomeSelectCallout;
  if(contents.filters.assembly) { current_genome.name = contents.filters.assembly; }

  var genomeWidget = zenbuGenomeSelectWidget("filter_search");

  var genomeDiv = document.getElementById("dex_search_genome_div");
  if(!genomeDiv) {
    genomeDiv = ctrlDiv.appendChild(document.createElement('div'));
    genomeDiv.setAttribute('style' , "display:inline-block; margin-left:5px;");
    genomeDiv.id = "dex_search_genome_div";
    genomeDiv.appendChild(genomeWidget);
  }

  return genomeWidget;
}

function dexGenomeSelectCallout() {
  var name = current_genome.name;
  if(name == "all") { name = ""; }
  dexReconfigContentsParam('assembly', name);
}


function dexCreateOthers() {
  var ctrlDiv = document.getElementById("dex_contents_controls_options");
  if(!ctrlDiv) {  return; }

  var span1  = document.getElementById("_othersSelectSpan");
  if(!span1) {
    span1 = document.createElement('span');
    span1.id = "_othersSelectSpan";
    span1.setAttribute("style", "margin:2px 10px 2px 0px;");

    /*
    var span2 = document.createElement('span');
    span2.innerHTML = "tissues:   cells:   treatments:  ";
    span1.appendChild(span2);
    ctrlDiv.appendChild(span1);
    */
  }
  return span1;
}


function dexReconfigContentsParam(param, value) {
  if(param == "platform") {  
    contents.filters.platform = value; 
    contents.current_index = 0;
  }
  if(param == "datasource") {  
    contents.filters.datasource = value; 
    contents.current_index = 0;
    contents.filters.platform = "";
    dexReloadContentsData();
  }
  if(param == "category") {  
    contents.filters.category = value; 
    contents.current_index = 0;
  }
  if(param == "assembly") {  
    //document.getElementById("dex_main_search_input").value ="";
    contents.filters.assembly = value; 
    contents.filters.platform = "";
    //contents.filters.search = "";
    contents.current_index = 0;
    dexReloadContentsData();
  }
  if(param == "page-size") {  
    contents.page_size = Math.floor(value);
    if(contents.page_size < 5) { contents.page_size=5; }
    //if(contents.page_size > 100) { contents.page_size=100; }
  }
  if(param == "page") {  
    contents.current_index = (value-1) * contents.page_size;
  }
  if(param == "previous-page") {  
    var idx = contents.current_index - contents.page_size;
    if(idx < 0) { idx = 0; }
    contents.current_index = idx;
  }
  if(param == "next-page") {  
    var idx = contents.current_index + contents.page_size;
    var page = Math.ceil(idx / contents.page_size);
    if(page < contents.num_pages) { 
      contents.current_index = idx;
    }
  }
  if(param == "mode") {
    if(value == "Configs") { value = "Views"; }

    if(contents.mode != value) { contents.current_index = 0; }
    contents.mode = value;

    if(value == "Scripts") { contents.filters.assembly = "";  }
    contents.filters.platform = "";
    contents.filters.search = "";
    contents.filters.source_ids = "";

    dexShowSubmenu();
    dexSearchReset(true); //reloads
  }
  if(param == "show_fixedID_reports") {
    contents.filters.show_fixedID_reports = value;
  }
  dexShowContents();
}

function dexRegstrymodeChange(param, value) {
}

//----------------------------------------------------------------------
//
// gLyphs config section
//
//----------------------------------------------------------------------

function dexCreateGlyphsConfig() {
  var has_datasources = false;
  for(var srcid in contents.cart.sources) { has_datasources = true; }
  if(has_datasources) {
    dexConfigureNewTrack();
    return;
  }
  
  var assemblies = new Object;
  var tracks = new Array;

  for (var fid in contents.cart.tracks) { 
    var track = contents.cart.tracks[fid];
    tracks.push(track);
    var asms = track.assembly.split(" ");
    for(var i=0; i<asms.length; i++) {
      var asm = asms[i]; 
      if(asm=="") { continue; }
      if(assemblies[asm]) { assemblies[asm] += 1; }
      else { assemblies[asm] = 1; }
    }
  }
  var most_asm = "";
  var most_asm_count = 0;
  for (var asm in assemblies) {
    if(assemblies[asm] > most_asm_count) {
      most_asm = asm.toLowerCase();
      most_asm_count = assemblies[asm];
    }
  }
  //document.getElementById("message").innerHTML = "most_asm : " + most_asm;
  var loc = most_asm + "::chr1:1..100000";
  if(most_asm == "hg38") { loc ="hg38::chr19:49657992-49667452"; }
  if(most_asm == "hg18") { loc ="hg18::chr19:54853066..54862509"; }
  if(most_asm == "mm9") { loc ="mm9::chr7:52251732..52259514"; }
  if(most_asm == "mm10") { loc ="mm10::chr7:44996347..45004147"; }
  if(most_asm == "rn4") { loc ="rn4::chr1:95469084..95476276"; }
  if(most_asm == "hg19") { loc ="hg19::chr19:50161252..50170707"; }
  if(most_asm == "galgal3") { loc ="galGal3::chr13:18847517..18852149"; }
  if(most_asm == "galgal4") { loc ="galGal4::chr13:18847517..18852149"; }
  if(most_asm == "canfam2") { loc ="canFam2::chr11:29061859..29067632"; }
  if(most_asm == "susscr2") { loc ="SUSSCR2::chr14:64970668..64974929"; }
  if(most_asm == "danrer6") { loc ="zv8::chr12:4853670..4873528"; }
  if(most_asm == "zv8") { loc ="zv8::chr12:4853670..4873528"; }
  if(most_asm == "Zv9") { loc ="Zv9::chr12:4853670..4873528"; }
  if(most_asm == "zv9") { loc ="Zv9::chr12:4853670..4873528"; }
  if(most_asm == "rhemac2") { loc ="rheMac2::chr12:4853670..4873528"; }
  if(most_asm == "rhemacmullas") { loc ="rheMacMulLas::chr12:4853670..4873528"; }
  if(most_asm == "rpv_l_wt") { loc ="RPV_L_WT::chr_rpv:1..15882"; }
  if(most_asm == "rpv_l_delc") { loc ="RPV_L_delC::chr_rpv:1..15888"; }
  if(most_asm == "H3N2udornNCBI") { loc ="H3N2udornNCBI::seg1:1..1000"; }
  if(most_asm == "H3N2udornDigard") { loc ="H3N2udornDigard::seg1:1..1000"; }

  if(tracks.length == 0) { return; }

  var configDoc = dex_loadTemplateConfig(dexTemplateConfig, loc);
  dex_configAddTracks(configDoc);
  var uuid = dex_uploadConfig(configDoc);
  if(uuid != "") {
    //document.getElementById("message").innerHTML = "new autosave : " + uuid;
    var url = "../gLyphs/#config="+uuid;
    if(loc!="") { url += ";loc="+loc; }
    //document.getElementById("message").innerHTML += "   "+ url;
    location.href= url;
  }
}


function dex_configAddTracks(configDoc) {
  var newTrackID = 100;
  var trackset = configDoc.getElementsByTagName("gLyphTracks");
  if(trackset && (trackset.length>0)) { trackset = trackset[0]; } else { return; }
  newTrackID = trackset.getAttribute("next_trackID");

  var parser = new DOMParser();

  for (var uuid in contents.cart.tracks) { 
    var track = contents.cart.tracks[uuid];
    if(!track.trackDOM) {
      dexGetConfig("track", uuid); //perform fullxml load
    }
    newTrackID++;
    if(track.trackDOM) { trackset.appendChild(track.trackDOM.cloneNode(true)); }
  }
  trackset.setAttribute("next_trackID", newTrackID);
}


function dex_loadTemplateConfig(configUUID, loc) {
  var url = eedbConfigCGI + "?format=configXML;uuid=" + configUUID;
  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  configXHR.open("GET",url,false); //not async, wait until returns
  configXHR.send(null);
  if(configXHR.readyState!=4) { return false; }
  if(configXHR.responseXML == null) { return false; }

  var configDoc=configXHR.responseXML;
  if(configDoc==null) { return false; }

  var configDOM=configDoc.documentElement;
  if(configDOM==null) { return false; }

  //first remove the old UUID from the config
  var uuidElement = configDOM.getElementsByTagName("configUUID");
  if(uuidElement && (uuidElement.length>0)) {
    var element = uuidElement[0];
    configDOM.removeChild(element);
  }

  //remove registry
  var elems = configDOM.getElementsByTagName("registry");
  if(elems && (elems.length>0)) {
    var element = elems[0];
    configDOM.removeChild(element);
  }

  var autosave = configDOM.appendChild(configDoc.createElement("autoconfig"));
  autosave.setAttribute("value", true);

  // reset the summary information
  var summary = configDOM.getElementsByTagName("summary")[0];
  if(!summary) {
    summary = configDOM.appendChild(configDoc.createElement("summary"));
  }
  if(summary) {
    summary.setAttribute("title", "gLyphs");
    summary.setAttribute("name", "");
    summary.setAttribute("desc", "DEX created configuration");
    if(contents.user) {
      summary.setAttribute("user", contents.user.nickname);
      summary.setAttribute("creator_openID", contents.user.openID);
    } else { 
      summary.setAttribute("user", "dex"); 
    }
  }

  //reset region
  var regionDOM = configDOM.getElementsByTagName("region")[0];
  if(!regionDOM) {
    regionDOM = configDOM.appendChild(configDoc.createElement("region"));
  }
  if(regionDOM) {
    regionDOM.setAttribute("dwidth", 900);
    if(loc) {
      var loc_match = /^(\w+)\:\:(.+)\:(\d+)\.\.(\d+)$/.exec(loc);
      if(loc_match && (loc_match.length == 5)) {
        regionDOM.setAttribute("asm", loc_match[1]);
        regionDOM.setAttribute("chrom", loc_match[2]);
        regionDOM.setAttribute("start", Math.floor(loc_match[3]));
        regionDOM.setAttribute("end", Math.floor(loc_match[4]));
      }
    }
  }

  var trackset = configDOM.getElementsByTagName("gLyphTracks")[0];
  if(!trackset) {
    trackset = configDOM.appendChild(configDoc.createElement("gLyphTracks"));
  }
  return configDoc;
}


function dex_uploadConfig(configDOM) {
  var serializer = new XMLSerializer();
  var xml = serializer.serializeToString(configDOM);

  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = xml.indexOf("<eeDBgLyphsConfig>");
  if(idx1 > 0) { xml = xml.substr(idx1); }

  //build the zenbu_query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode>\n";
  paramXML += "<autosave>true</autosave>\n";
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
    return "";
  }

  configXHR.open("POST",eedbConfigCGI,false); //not async, wait until returns
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  configXHR.send(paramXML);

  var uuid ="";
  if(configXHR.readyState!=4) return uuid;
  if(configXHR.responseXML == null) return uuid;
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null)  return uuid;

  if(xmlDoc.getElementsByTagName("configXML")) {
    var saveConfig = xmlDoc.getElementsByTagName("configXML")[0];
    if(saveConfig) { uuid = saveConfig.getAttribute("uuid"); }
  }

  return uuid;
}


function  dexDeleteConfig(uuid) {
  eedbSourceInfoEvent('close');

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  var url = eedbConfigCGI;
  url += "?mode=delete;uuid=" + uuid;
  
  configXHR.open("GET",url,false); //not async, wait until returns
  configXHR.send();

  dexReloadContentsData();
  dexShowContents();
}


function dexGetConfig(datatype, uuid) {
  configXHR=GetXmlHttpObject();
  var url = eedbConfigCGI+"?format=fullxml;uuid="+uuid;
  configXHR.open("GET", url, false); //not async
  configXHR.send(null);
  if(configXHR.readyState!=4) { return null; }
  if(configXHR.responseXML == null) { return null; }

  var xmlConfig = configXHR.responseXML.documentElement;
  if(xmlConfig==null)  { return null; }
  var uuid = xmlConfig.getAttribute("uuid");

  var config;
  if(datatype == "view")   { 
    config = contents.configs.views_hash[uuid]; 
    eedbParseConfigurationData(xmlConfig, config);
  }
  if(datatype == "track")  { 
    config = contents.tracks.tracks_hash[uuid]; 
    dexParseTrackData(xmlConfig, config);
  }
  if(datatype == "script") { 
    config = contents.scripts.scripts_hash[uuid]; 
    eedbParseConfigurationData(xmlConfig, config);
  }
  if(datatype == "report")   {
    config = contents.configs.reports_hash[uuid];
    eedbParseConfigurationData(xmlConfig, config);
  }
  config.full_load= true;
  return config;
}


//----------------------------------------------------------------------
//
// new track creation section
//
//----------------------------------------------------------------------


function dexNewTrack() {
  var tracks = contents.tracks;
  var trackID = createUUID();

  var track = zenbuNewTrack();
  track.trackID = trackID;

  /*
  track = new Object;
  */
  track.fid = undefined;
  track.selected = false;
  track.trackmode = "advanced";
  track.glyphStyle = "thick-arrow";
  track.submode ="5end";
  track.maxlevels = 100;
  track.assembly = "";
  track.title = "";
  track.exp_mincut = 0.0;
  track.expscaling = "auto";
  track.source_array = new Array;
  track.binning = "sum";
  track.expfilter = "";
  track.strandless = "";
  track.logscale = "";
  track.scorecolor = false;

  var assemblies = new Object;

  var src_ids = "";
  for (var srcid in contents.cart.sources) {
    var source = contents.cart.sources[srcid];
    if(!source) { continue; }
    if(track.title == "") { track.title = source.name; }
    track.source_array.push(srcid);
    if(source.assembly) { assemblies[source.assembly] = 1; }
    source.newtrack_selected = true;
    src_ids += srcid+",";
  }
  if(!src_ids) { return undefined; }
  track.source_ids = src_ids;

  for (var asmb in assemblies) { track.assembly += " "+asmb; }

  //if(has_annot && !has_exp) { track.glyphStyle = "transcript"; track.trackmode="annotation"; }
  //if(!has_annot && has_exp) { track.glyphStyle = "signal-histogram"; track.trackmode="expression"; }

  contents.newtrack = track;
  return track
}
  

function dexConfigureNewTrack() {
  var track = dexNewTrack();
  if(!track) { return; }
  var configDiv = document.getElementById("dex_config_div");
  configDiv.setAttribute("style", "background-color:wheat; padding:5px 5px 5px 5px; margin-top:3px; "
                                  +"z-index:1; visibility:visible;"
                                  //+"position:absolute; left:" + ((winW/2)-(divWidth/2)) +"px; top:160px; width:"+ divWidth +"px;"
                                  );
  //configDiv.setAttribute("style", "visibility:visible;");
  clearKids(configDiv);
  track.trackDiv = configDiv;

  track.dexMode = true;
  track.dex_callout = dexConfigNewTrackParam;
  gLyphTrack_array[track.trackID] = track; //hacking into glyphs code
  configureNewTrack(track.trackID); //glyphs new-track function
}


function dexCreateDatatypeSelect(trackID) {
  var track = contents.newtrack;

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) { 
    datatypeSelect = document.createElement('select');
    datatypeSelect.setAttribute('name', "datatype");
    datatypeSelect.setAttribute('style', "margin: 1px 4px 1px 4px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    datatypeSelect.setAttribute("onchange", "dexConfigNewTrackParam(\""+ trackID+"\", 'exptype', this.value);");
    datatypeSelect.id = trackID + "_datatypeSelect";
  }
  datatypeSelect.innerHTML = ""; //to clear old content

  var option = document.createElement('option');
  option.setAttribute("value", "");
  option.innerHTML = "... loading";
  datatypeSelect.appendChild(option);

  if(!track.source_array) { return datatypeSelect; }

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>expression_datatypes</mode>\n";
  if(track.source_array !== undefined) {
    paramXML += "<source_ids>";
    for(var i=0; i<track.source_array.length; i++) {
      if(i!=0) { paramXML += ","; }
      paramXML += track.source_array[i];
    }
    paramXML += "</source_ids>\n";
  }
  paramXML += "</zenbu_query>\n";

  var datatypeXHR=GetXmlHttpObject();
  if(datatypeXHR==null) {
    alert ("Your browser does not support AJAX!");
    return datatypeSelect;
  }
  track.datatypeXHR = datatypeXHR;
  datatypeXHR.onreadystatechange= function(id) { return function() { dexDisplayDatatypeSelect(id); };}(trackID);

  datatypeXHR.open("POST", eedbSearchFCGI, true);
  datatypeXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  datatypeXHR.send(paramXML);

  return datatypeSelect;
}


function dexDisplayDatatypeSelect(trackID) {
  var track = contents.newtrack;
  if(track == null) { return null; }

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) {  return; } 

  if(!track.datatypeXHR) { return; }

  if(track.datatypeXHR.readyState!=4) return null;
  if(track.datatypeXHR.responseXML == null) return null;
  var xmlDoc=track.datatypeXHR.responseXML.documentElement;
  if(xmlDoc==null)  return null;

  datatypeSelect.innerHTML = ""; //to clear old content

  //var option = document.createElement('option');
  //option.setAttribute("value", "");
  //option.innerHTML = "no datatype filter";
  //datatypeSelect.appendChild(option);

  var types = xmlDoc.getElementsByTagName("datatype");
  var sortedTypes = new Array();
  var selectOK = false;
  var defaultType = "";
  for(var i=0; i<types.length; i++) {
    var type = types[i].getAttribute("type");
    if(/deprecated/.test(type)) { continue; }

    sortedTypes.push(types[i]);
    if(type == track.exptype) { selectOK = true; }

    if(type == "tpm") { defaultType=type; }
    if((type == "mapnorm_tpm") && (defaultType!="tpm")) { defaultType=type; }
    if((type == "mapnorm_tagcnt") && (defaultType!="mapnorm_tpm") && (defaultType!="tpm")) { defaultType=type; }

    if((type == "raw") && !defaultType) { defaultType=type; }
    if((type == "tagcount") && !defaultType) { defaultType=type; }
    if((type == "tagcnt") && !defaultType) { defaultType=type; }
  }
  sortedTypes.sort(dex_datatype_sort_func);
  if(!selectOK) { track.exptype=""; }
  if(!track.exptype && defaultType) { track.exptype = defaultType; }

  for(var i=0; i<sortedTypes.length; i++) {
    var typeDOM = sortedTypes[i];
    var type = typeDOM.getAttribute("type");
    if(i==0) { 
      track.default_exptype = type;
      if(track.exptype == "") { track.exptype = type; }
    }        
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", type);
    if(type == track.exptype) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = type;
    datatypeSelect.appendChild(option);
  }
  return datatypeSelect;
}

function dex_datatype_sort_func(a,b) {
  var name1 = a.getAttribute("type").toUpperCase();
  var name2 = b.getAttribute("type").toUpperCase();
  return (name2 < name1) - (name1 < name2);
}


function dexConfigNewTrackParam(trackID, param, value) {
  var template = contents.newtrack;
  if(param == "accept-new") {
    for(var trackID in gLyphTrack_array) {
      var track = gLyphTrack_array[trackID];
      track.assembly = template.assembly;

      // set some defaults if they are not configured
      if(track.title == "") { track.title = ""; }
      if(track.trackmode!="annotation") {
        if(track.exptype === undefined)   { track.exptype = track.default_exptype; }
        if(track.maxlevels === undefined) { track.maxlevels = 100; }
        if(track.expsscaling === undefined) { track.expscaling = "auto"; }
      }
      //transfer track to cart
      glyphsGenerateTrackDOM(track);
      contents.cart.tracks[track.trackID] = track;
    }
    gLyphTrack_array = new Object();
    
    //clean up sources from cart
    if(template.source_array) {
      for(var i=0; i<template.source_array.length; i++) {
        var srcid = template.source_array[i];
        var source = contents.cart.sources[srcid];
        if(source && (source.newtrack_selected)) {
          source.selected = false;
          source.newtrack_selected = false;
          delete contents.cart.sources[srcid];
        }
      }
    }
    
    //contents.cart.sources = new Object;

    contents.newtrack = undefined;
    var configDiv = document.getElementById("dex_config_div");
    configDiv.setAttribute("style", "visibility:hidden;");
    configDiv.innerHTML = "";
    
    dexShowCart();
    dexShowContents();
    dexConfigureNewTrack();
  }

  if(param == "cancel-new") {
    contents.newtrack = undefined;
    var configDiv = document.getElementById("dex_config_div");
    configDiv.setAttribute("style", "visibility:hidden;");
    configDiv.innerHTML = "";
  }
} 


//-------------------------------------------------------------------------------------------

function dexCreateTrackFromScriptConfig(configUUID) {
  if(!configUUID) { return; }
  var track = dexNewTrack();
  if(!track) { return; }

  //for loading a predefined script into a new track
  //given a configUUID, queries the config_server for full XML info.
  //if available, then it parses the XML and configures the track

  var url = eedbConfigCGI + "?format=configXML;uuid=" + configUUID;
  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  configXHR.open("GET",url,false); //not async, wait until returns
  configXHR.send(null);
  if(configXHR.readyState!=4) { return false; }
  if(configXHR.responseXML == null) { return false; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null) { return false; }

  //OK go ahead and load the script
  if(xmlDoc.tagName != "ZENBU_script_config") { return undefined; }

  var processing = xmlDoc.getElementsByTagName("zenbu_script")[0];
  if(!processing) { return false; }

  //everying ok
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

  track.script = script;  //need to check this

  // new defaults section which will load track-config defaults when loading a predefined script
  // into the interface
  var defaults = xmlDoc.getElementsByTagName("track_defaults")[0];
  if(defaults) {
    if(defaults.getAttribute("scorecolor")) {
      track.scorecolor = true;
      track.colorspace = defaults.getAttribute("scorecolor"); 
    }
    if(defaults.getAttribute("glyphStyle")) { track.glyphStyle = defaults.getAttribute("glyphStyle"); }

    if(defaults.getAttribute("backColor")) { 
      var value = defaults.getAttribute("backColor");
      if(value.charAt(0) != "#") { value = "#"+value; }
      track.backColor = value; 
    }
    if(defaults.getAttribute("posStrandColor")) { 
      var value = defaults.getAttribute("posStrandColor");
      if(value.charAt(0) != "#") { value = "#"+value; }
      track.posStrandColor = value;               
    }
    if(defaults.getAttribute("revStrandColor")) {
      var value = defaults.getAttribute("revStrandColor");
      if(value.charAt(0) != "#") { value = "#"+value; }
      track.revStrandColor = value;
    }

    if(defaults.getAttribute("hidezeroexps") == "true") { track.hidezeroexps = true; }
    if(defaults.getAttribute("hidezeroexps") == "false") { track.hidezeroexps = false; }

    //below are not tested to see if the reconfig panel updates correctly
    if(defaults.getAttribute("exptype")) { track.exptype = defaults.getAttribute("exptype"); }
    if(defaults.getAttribute("datatype")) { track.datatype = defaults.getAttribute("datatype"); }
    if(defaults.getAttribute("source_outmode")) { track.source_outmode = defaults.getAttribute("source_outmode"); }

    if(defaults.getAttribute("height")) { 
      var value = defaults.getAttribute("height");
      track.track_height = Math.floor(value); 
      if(track.track_height <20) { track.track_height = 20; } 
      if(track.track_height >500) { track.track_height = 500; } 
    }
    if(defaults.getAttribute("expscaling")) { 
      track.expscaling = parseFloat(defaults.getAttribute("expscaling")); 
      if(isNaN(track.expscaling) || (track.expscaling==0)) { track.expscaling = "auto"; } 
    }

    if(defaults.getAttribute("strandless") == "true") { track.strandless = true; }
    if(defaults.getAttribute("strandless") == "false") { track.strandless = false; }

    if(defaults.getAttribute("logscale") == "true") { track.logscale = true; }
    if(defaults.getAttribute("logscale") == "false") { track.logscale = false; }
  }
  //fix old glyphStyle
  if(track.glyphStyle == "express") { track.glyphStyle = "signal-histogram"; }
  if(track.glyphStyle == "line") { track.glyphStyle = "centroid"; }
  if(track.glyphStyle == "thin") { track.glyphStyle = "thin-box"; }
  if(track.glyphStyle == "medium-exon") { track.glyphStyle = "thin-box"; }
  if(track.glyphStyle == "thin-exon") { track.glyphStyle = "thin-box"; }
  if(track.glyphStyle == "exon") { track.glyphStyle = "thick-box"; }
  if(track.glyphStyle == "utr") { track.glyphStyle = "thick-box"; }


  // set some defaults if they are not configured
  if(track.title == "") { track.title = script.name; }
  if(track.description == "") { track.description = script.desc; }

  //now finally create the sources and create the trackDOM
  if(track.source_array) {
    var src_ids = "";
    for(var i=0; i<track.source_array.length; i++) {
      var srcid = track.source_array[i];
      var source = contents.cart.sources[srcid];
      if(source && (source.newtrack_selected)) {
        source.selected = false;
        source.newtrack_selected = false;
        delete contents.cart.sources[srcid];
        src_ids += srcid+",";
      }
    }
    track.source_ids = src_ids;
  }
  dexGetTrackDefaultDatatype();

  var tdom = glyphsGenerateTrackDOM(track);
  contents.cart.tracks[track.trackID] = track;

  //contents.cart.sources = new Object;

  contents.newtrack = undefined;
  var configDiv = document.getElementById("dex_config_div");
  configDiv.setAttribute("style", "visibility:hidden;");
  configDiv.innerHTML = "";

  dexShowCart();
  dexShowContents();
}


function dexGetTrackDefaultDatatype() {
  var track = contents.newtrack;
  if(!track) { return; }
  if(!track.source_ids) { return; }
  if(track.exptype) { return; }

  var url = eedbSearchFCGI+"?mode=expression_datatypes;source_ids=" + track.source_ids;

  var datatypeXHR=GetXmlHttpObject();
  if(datatypeXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }

  datatypeXHR.open("GET", url, false); //synchronous
  datatypeXHR.send(null);
  if(datatypeXHR.readyState!=4) { return; }
  if(datatypeXHR.responseXML == null) { return; }
  if(datatypeXHR.status!=200) { return; }

  var xmlDoc=datatypeXHR.responseXML.documentElement;
  if(xmlDoc==null) { return; }

  var types = xmlDoc.getElementsByTagName("datatype");
  var defaultType = "";
  for(var i=0; i<types.length; i++) {
    var type = types[i].getAttribute("type");
    if(/deprecated/.test(type)) { continue; }

    if(type == "tpm") { defaultType=type; }
    if((type == "mapnorm_tpm") && (defaultType!="tpm")) { defaultType=type; }
    if((type == "mapnorm_tagcnt") && (defaultType!="mapnorm_tpm") && (defaultType!="tpm")) { defaultType=type; }

    if((type == "raw") && !defaultType) { defaultType=type; }
    if((type == "tagcount") && !defaultType) { defaultType=type; }
    if((type == "tagcnt") && !defaultType) { defaultType=type; }
  }
  if(!track.exptype && defaultType) { 
    track.exptype = defaultType; 
    track.datatype = defaultType; 
  }
}


