// ZENBU zenbu_reports.js
//
// Contact : Jessica Severin <jessica.severin@riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
// * ZENBU eedb_reports.js
// * copyright (c) 2007-2018 Jessica Severin RIKEN
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

var eedbRegionCGI = eedbWebRoot + "/cgi/eedb_region.cgi";
var newElementID = 100;
var maxActiveXHRs = 9;

var reports_active_XHRs = new Object();
var reports_pending_XHRs = new Object();

var reportsInitParams = new Object();  //contents can be set inside the index.html
//reportsInitParams.configUUID = "f6demo";
reportsInitParams.configUUID = "Intro";

var current_report = new Object();
current_report.elements = new Object(); //hash of elementID to element in this report
current_report.active_cascades = {};
current_report.display_width = Math.floor(800);
current_report.asm = "hg18";
current_report.config_title = "";
current_report.configUUID = "";
current_report.config_fixed_id = "";
current_report.desc = "";
current_report.view_config_loaded = false;
current_report.view_config = null;  //will hold the loaded configuration object
current_report.reinitialize_page = false; //internal flag to indicate that the view config was reloaded/changed
current_report.exppanel_hide_deactive = false;
current_report.exppanel_active_on_top = false;
current_report.hide_zero_experiments = false;
current_report.exppanel_subscroll = true;
current_report.groupinfo_ranksum_display = false;
current_report.autosaveInterval = undefined;
current_report.active_elementID = undefined;
current_report.init_url_terms = new Array();
//current_report.search_feature = undefined;
current_report.focus_feature = undefined;
current_report.edit_page_configuration = true;  //global 'edit' mode toggle, like editing wiki page
current_report.new_element_abs_pos = 100;

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


function reportsInit() {
  //document.getElementById("message").innerHTML = "reportsInit";
  if(!browserCompatibilityCheck()) {
    window.location ="../browser_upgrade.html";
  }
  eedbShowLogin();

  zenbuInitColorSpaces();
  
  if(current_user && !current_user.email) {
    eedbLogoutCurrentUser();
    eedbShowLogin();
  }

  // reset global current_collaboration
  current_collaboration.name = "all";
  current_collaboration.uuid = "all";
  current_collaboration.callOutFunction = null;

  jscolor.init();

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget

  var mainSearch = document.getElementById("reportsSearchBox1");
  if(mainSearch) {
    //mainSearch.default_message = "search for genes";
    eedbClearSearchResults("reportsSearchBox1");
  }
  //reportsInitSearchFromConfig();

  if(!current_report) {
    current_report = new Object();
    current_report.asm = eedbDefaultAssembly;
  }
  var dwidth = Math.floor(reportsInitParams.display_width);
  if(!dwidth) { dwidth = Math.floor(800); }
  reportsInitParams.display_width = dwidth;
  current_report.display_width = dwidth;

  //parsing URL
  reportsParseURL(window.location.href);

  console.log("pageInit after parseURL");
  //if(!current_report.reinitialize_page) {
  ////  console.log("not current_report.reinitialize_page");
  if(!current_report.configUUID && reportsInitParams.configUUID) {
    console.log("init view from reportsInitParams.configUUID");
    reportsLoadPageConfigUUID(reportsInitParams.configUUID);
    //if(reportsInitParams.display_width) { current_report.display_width = reportsInitParams.display_width; }
    //reloadRegion();
  }
  reportsChangeDhtmlHistoryLocation();

  current_report.first_init = true;
  window.addEventListener("hashchange", reportsHandleHistoryChange, false);
  current_report.first_init = false;

  reportsReinitializePage();
  
  /*
  var master_div = document.getElementById("zenbuReportsDiv");
  if(master_div) { master_div.innerHTML = ""; }

  if(!current_report.configUUID) {
    //empty view
    reportsNewLayoutElement("row", "row1");
  }

  //load config or manually setup the elements
  reportsNewLayoutElement("row", "row1");
  reportsNewLayoutElement("row", "row2");
  reportsNewLayoutElement("row", "row3");
  reportsNewLayoutElement("col", "col1");

  reportsSetupList_target_list();
  reportsSetup_GeneTargetASOs(); //this is still special, need to abstract into maybe a list
  reportsSetupTable_target_DE_genes();
  reportsSetupChart_DE_ASO_concordance();
  reportsSetupChart_basemean_FC();
  reportsSetupChart_fdr_FC();
  reportsSetupZenbuGB1();
  //testChart();
   */
}


function reportsReinitializePage() {
  //based on the loaded elements and page configuration rebuild the master_view
  var master_div = document.getElementById("zenbuReportsDiv");
  if(!master_div) { return; }
  
  console.log("reportsReinitializePage");
  master_div.style.height = "100px";
  master_div.style.marginLeft = "3px";
  //master_div.style.overflow = "auto";
  //master_div.style.overflowY = "visible";
  //master_div.style.overflowX = "scroll";

  if(!current_user) {
    current_report.edit_page_configuration = false;
    //  return zenbuUserLoginPanel();
  }

  if(!current_report.view_config_loaded) {
    //empty view
    reportsNewLayoutElement("row", "row1");
  }

  //TODO: might-reverse reportsUpdateLayoutElements();
  
  //reportsLoadObjectInfo("7AA26B8D-8634-45A4-8F74-DF3E04B3456A::15516");
  //reportsLoadTargetList();
  //reportsLoadElement("target_list");
  
  reportsShowConfigInfo();

  reportsDisplayEditTools();
  
  reportsResetElements();
  
  reportsDrawElements();

  //preprocess the init_url_terms 
  for(var j=0; j<current_report.init_url_terms.length; j++) {
    var term = current_report.init_url_terms[j];
    if(!term) { continue; }
    //console.log(" url_term elementID["+term.elementID+"] mode:"+term.mode+"  val["+term.value+"]");
    var termElement = current_report.elements[term.elementID];
    if(!termElement) { continue; }
    
    if(term.mode=="search_select") {
      termElement.init_selection = "";  //clear init_selection from the config (if it was set)
      termElement.search_data_filter = term.value;
      termElement.show_only_search_matches = false;
    }
    if(term.mode=="search_select_hide") {
      termElement.init_selection = ""
      termElement.search_data_filter = term.value;
      termElement.show_only_search_matches = false;
    }
  }

  //load the page-init elements
  for(var elementID in current_report.elements) {
    var reportElement = current_report.elements[elementID];
    if(!reportElement) { continue; }
    if(reportElement.load_on_page_init) {
      reportsLoadElement(elementID);
    }
  }
  
  //reportsChangeDhtmlHistoryLocation();
  current_report.reinitialize_page = false;
}


function reportsParseURL(urlConfig) {
  //this function takes URL address, parses for configuration UUID and
  //location, and then reconfigures the view.  But it does not execute a reload/redraw

  //if(!urlConfig && zenbu_embedded_view) { return; }
  console.log("reportsParseURL ["+urlConfig+"]")
  if(!urlConfig) {
    reportsLoadPageFromConfig(null); //null will cause a clean reset
    return;
  }
  
  //reset some variables
  current_report.init_url_terms = new Array();

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
  for(var i=0; i<params.length; i++) {
    var param = params[i];
    //document.getElementById("message").innerHTML += " param[" + param +"]";
    if(i==0) {
      //first param is the configuration name/uuid
      reportsLoadPageConfigUUID(param);
      continue;
    }
    var tagvalue = param.split("=");
    if(tagvalue.length != 2) { continue; }

    var objID = "";
    var val1 = "";
    var idx1 = tagvalue[1].indexOf(":");
    if(idx1 > 0) { 
      objID = tagvalue[1].substr(0,idx1); 
      val1  = tagvalue[1].substr(idx1+1);       
    }

    if(tagvalue[0] == "search_select") {
      current_report.init_url_terms.push( {mode:"search_select", elementID:objID, value:val1} );
      console.log("URL search_select obj["+objID+"] val["+val1+"]");
    }
    if(tagvalue[0] == "search_select_hide") {
      current_report.init_url_terms.push( {mode:"search_select_hide", elementID:objID, value:val1} );
      console.log("URL init search_select_hide obj["+objID+"] val["+val1+"]");
    }
    
  }
}


function reportsHandleHistoryChange() {
  if(zenbu_embedded_view) { return; }
  if(current_report.first_init) {
    console.log("reportsHandleHistoryChange first init");
    current_report.first_init = false;
    return;
  }
  console.log("reportsHandleHistoryChange url["+window.location.href+"]");
  
  //eedbEmptySearchResults("reportsSearchBox1");
  reportsParseURL(window.location.href);
  if(current_report.reinitialize_page) {
    reportsReinitializePage();
  } else {
    //for future where other url params control aspects of the view
    reportsDisplayEditTools();
    reportsDrawElements();
    //TODO: might-reverse: reportsUpdateLayoutElements();
  }
}


function reportsChangeDhtmlHistoryLocation() {
  //if(zenbu_embedded_view) { return; }
  var urlID = current_report.configUUID;
  if(current_report.config_fixed_id) { urlID = current_report.config_fixed_id;}
  var newurl = "#"+urlID;
  
  console.log("reportsChangeDhtmlHistoryLocation url:"+newurl+"  terms:"+(current_report.init_url_terms.length));
  for(var j=0; j<current_report.init_url_terms.length; j++) {
    //current_report.init_url_terms.push( {mode:"search_select", elementID:objID, value:val1} );
    var term = current_report.init_url_terms[j];
    newurl += ";" + term.mode + "=";
    if(term.elementID) { newurl += term.elementID + ":"; }
    newurl += term.value;
  }
  window.history.pushState({}, "", newurl);
}


//---------------------------------------------------------------
//
// General warning panels
//
//---------------------------------------------------------------

function reportsNoUserWarn(message) {
  var main_div = document.getElementById("global_panel_layer");
  if(!main_div) { return; }

  var e = window.event
  moveToMouseLoc(e);
  var ypos = toolTipSTYLE.ypos-35;
  if(ypos < 100) { ypos = 100; }

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:absolute; background-color:#f0f0f7; text-align:left; "
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
  a1.setAttribute("onclick", "reportsClearGlobalPanelLayer(); return false;");
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


function reportsGeneralWarn(message) {
  var main_div = document.getElementById("global_panel_layer");
  if(!main_div) { return; }

  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

  var e = window.event
  moveToMouseLoc(e);
  var ypos = toolTipSTYLE.ypos-35;
  if(ypos < 100) { ypos = 100; }

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);  //bck color options: FEF8A6  FFFFC0
  divFrame.setAttribute('style', "position:absolute; background-color:#f0f0f7; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                            +"z-index:1; opacity: 0.98; "
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
  a1.setAttribute("onclick", "reportsClearGlobalPanelLayer(); return false;");
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

function reportsClearGlobalPanelLayer() {
  var global_layer_div = document.getElementById("global_panel_layer");
  if(!global_layer_div) { return; }
  global_layer_div.innerHTML ="";
}


//------------------------------------------------------------------------------


function reportsShowConfigInfo() {
  var titlediv = document.getElementById("reports_title");
  if(!titlediv) { return; }

  titlediv.setAttribute("style", "font-size:20px; font-weight:bold; width:50%; margin: auto;");
  //titlediv.setAttribute("style", "font-family:arial,helvetica,sans-serif; font-size:20px; font-weight:bold;  width:50%; margin: auto;");
  //titlediv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
  //<div id="reports_title" style="width:80%; font-size:20px; font-weight:bold;"><center>FANTOM6 long-non-coding gene knockdown analysis reports</center></div>

  titlediv.innerHTML="";
  var link1 = titlediv.appendChild(document.createElement("span"));
  //var link1 = titlediv.appendChild(document.createElement("a"));
  //link1.setAttribute("href", "./#config=" +current_report.configUUID);
  if((/^temporary\./.test(current_report.config_title)) ||
     (/^modified\./.test(current_report.config_title)) ||
     (/\(modified\)$/.test(current_report.config_title))) {
    link1.setAttribute("style", "color:rgb(136,0,0);");
  } else {
    link1.setAttribute("style", "color:black;");
  }
  link1.innerHTML = encodehtml(current_report.config_title);
  
  // save view button
  //var button = titlediv.appendChild(document.createElement("button"));
  //button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onclick", "reportsSaveConfigPanel();");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"save view configuration to collaboration\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  //button.innerHTML = "save view";

  var descdiv = titlediv.appendChild(document.createElement("div"));
  descdiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descdiv.innerHTML = "";

  var div1 = descdiv.appendChild(document.createElement("div"));
  div1.innerHTML = encodehtml(current_report.desc);

  if(current_report.edit_page_configuration) {
    var div2 = descdiv.appendChild(document.createElement("div"));
    div2.setAttribute("style", "font-size:10px;");
    if(current_report.config_creator) {
      var span1 = div2.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:10px;");
      span1.innerHTML = "created by: "+ encodehtml(current_report.config_creator);
    }
    if(current_report.config_createdate) {
      var span1 = div2.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:10px;");
      //span1.innerHTML = encodehtml(current_report.config_createdate) +" GMT";
      span1.innerHTML = encodehtml(current_report.config_createdate);
    }

    if(current_report.view_config  && current_report.view_config.collaboration) {
      var span1 = div2.appendChild(document.createElement("span"));
      span1.setAttribute("style", "margin-left:10px;");
      span1.innerHTML = "collaboration: ";
      if(current_report.view_config.type == "AUTOSAVE") {
        span1.innerHTML += "(temp)";
      } else {
        span1.innerHTML += current_report.view_config.collaboration.name;
      }
    }
  }
}


function reportsLoadPageConfigUUID(configUUID) {
  //given a configUUID, queries the config_server for full XML info.
  //if available, then it parses the XML and reconfigures the view
  //return value is true/false depending on success of reconfig loading
  console.log("reportsLoadPageConfigUUID ["+configUUID+"]");
  if(!configUUID) { return; }
  if(current_report.configUUID == configUUID) { return; }
  
  current_report.configUUID = configUUID; //make sure to set to we can reload if it fails

  //clear previous elements
  current_report.elements = new Object(); //hash of elementID to element in this report
  var master_div = document.getElementById("zenbuReportsDiv");
  if(master_div) { master_div.innerHTML = ""; }
  current_report.reinitialize_page = true;  //will trigger a re-init
  
  if(configUUID == "blank") {
    console.log("reportsSetupBlankView");
    current_report.view_config_loaded = true;
    current_report.configUUID = "";
    current_report.config_fixed_id = "blank";
    current_report.config_title = "empty page";
    current_report.desc = "";
    current_report.config_creator = "";
    current_report.config_createdate = "";
    reportsShowConfigInfo();
    return;
  }
  //if(configUUID == "f6demo") {
  //  reportsSetupF6DemoView();
  //  return;
  //}

  var id = configUUID + ":::Config";
  var config = eedbFetchObject(id);
  if(!reportsLoadPageFromConfig(config)) {
    if(!current_report.view_config_loaded) {
      if(!current_user) {
        //if no configUUID then not a valid config or no access to it
        //assume it exists but user can not see it because they forgot to login
        reportsGeneralWarn("This page either does not exist or is not available to the public.<br>"+
                          "Please login to check if you have access to this page or to create it.");
        eedbLoginAction("login");
      } else {
        reportsGeneralWarn("This reports page is not available. "+
                          "It either does not exist, or has been deleted from the system, or you do not have privilege to access it. "+
                          "<br>Please continue to create this page if you are interested.");
      }
    }
    return;
  }
  
  return;
}

//=================================================================================
//
// parsing view configXML into page/elements
//
//=================================================================================

function reportsLoadPageFromConfig(config) {
  //parse the config object into view, reportElments and layoutElements
  //only does the parsing and creation of the element objects
  //does not perform the view re-initialization or triggers initial cascade
  
  // clean out previous elements and current_report params
  //current_report = new Object();
  current_report.elements = new Object(); //hash of elementID to element in this report
  
  current_report.config_title = "";
  current_report.desc = "";
  //current_report.configUUID = "";
  current_report.config_creator = "";
  current_report.config_createdate = "";
  
  //current_report.display_width = Math.floor(800);
  //current_report.asm = "hg18";
  //current_report.exppanel_hide_deactive = false;
  //current_report.exppanel_active_on_top = false;
  //current_report.hide_zero_experiments = false;
  //current_report.exppanel_subscroll = true;
  //current_report.groupinfo_ranksum_display = false;
  //current_report.active_elementID = undefined;
  //current_report.search_feature = undefined;

  current_report.autosaveInterval = undefined;
  current_report.init_url_terms = new Array();
  current_report.focus_feature = undefined;
  current_report.edit_page_configuration = false;  //global 'edit' mode toggle, like editing wiki page
  current_report.new_element_abs_pos = 100;

  current_report.view_config = null;
  current_report.view_config_loaded = false;
  current_report.reinitialize_page = true; //internal flag to indicate that the view config was reloaded/changed

  //maybe need to clean out always and do the return here
  if(!config) { return false; }
  if(!config.uuid) { return false; }

  if(config.uuid) {
    current_report.configUUID = config.uuid;
    current_report.config_fixed_id = config.fixed_id;
  } else {
    //if no configUUID then not a valid config
    current_report.view_config_loaded = false;
    //reportsNoUserWarn("access this view configuration");
    return false;
  }
  
  var configDOM = config.configDOM;
  if(!configDOM) {
    current_report.view_config_loaded = false;
    return false;
  }
  
  if(configDOM.getElementsByTagName("settings")) {
    var settings = configDOM.getElementsByTagName("settings")[0];
    if(settings) {
      if(settings.getAttribute("dwidth")) {
        current_report.display_width = parseInt(settings.getAttribute("dwidth"));
      }
      if(settings.getAttribute("hide_compacted") == "true") {
        current_report.hide_compacted_tracks = true;
      } else {
        current_report.hide_compacted_tracks = false;
      }
      if(settings.getAttribute("exppanel_hide_deactive") == "true") {
        current_report.exppanel_hide_deactive = true;
      } else {
        current_report.exppanel_hide_deactive = false;
      }
      if(settings.getAttribute("exppanel_active_on_top") == "true") {
        current_report.exppanel_active_on_top = true;
      } else {
        current_report.exppanel_active_on_top = false;
      }
      if(settings.getAttribute("exppanel_subscroll") == "true") {
        current_report.exppanel_subscroll = true;
      } else {
        current_report.exppanel_subscroll = false;
      }
      if(settings.getAttribute("global_nocache") == "true") {
        current_report.nocache = true;
      } else {
        current_report.nocache = false;
      }
    }
  }
  
  if(config.collaboration) {
    current_collaboration.name = config.collaboration.name;
    current_collaboration.uuid = config.collaboration.uuid;
    console.log("loaded view has collaboration ["+current_collaboration.name+"]  ["+current_collaboration.uuid+"]")
  }
  
  current_report.fixed_id_editor_status = "";
  if(config.mdata["fixed_id_editor_status"]) { 
    current_report.fixed_id_editor_status = config.mdata["fixed_id_editor_status"];
    console.log("fixed_id_editor_status: "+current_report.fixed_id_editor_status);
  }

  //--------------------------------
  //eedbEmptySearchResults("glyphsSearchBox1");
  
  current_report.view_config_loaded = true;
  current_report.view_config = config;
  current_report.config_createdate = config.create_date;
  current_report.config_title = config.name;
  current_report.desc = config.description;
  if(config.author) {
    current_report.config_creator = config.author;
  } else {
    current_report.config_creator = config.owner_openID;
  }
  reportsShowConfigInfo();
  
  //
  // now parse the actual configDOM for tracks and sources
  //
  /*
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
   */

  var elementSet = configDOM.getElementsByTagName("reportElementSet");
  if(!elementSet) { return false; }
  elementSet = elementSet[0];
  //<reportElementSet newElementID="100" new_element_abs_pos="550" num_elements="12">
  newElementID=100;
  current_report.new_element_abs_pos = 100;
  var num_expected_elements = 0;
  if(elementSet.getAttribute("newElementID")) { newElementID = parseInt(elementSet.getAttribute("newElementID")); }
  //if(elementSet.getAttribute("new_element_abs_pos")) { current_report.new_element_abs_pos = parseInt(elementSet.getAttribute("new_element_abs_pos")); }
  if(elementSet.getAttribute("num_elements")) { num_expected_elements = parseInt(elementSet.getAttribute("num_elements")); }

  /*
  //f6demo creation code
  reportsNewLayoutElement("row", "row1");
  reportsNewLayoutElement("row", "row2");
  reportsNewLayoutElement("row", "row3");
  reportsNewLayoutElement("col", "col1");
  
  reportsSetupList_target_list();
  reportsSetup_GeneTargetASOs(); //this is still special, need to abstract into maybe a list
  reportsSetupTable_target_DE_genes();
  reportsSetupChart_DE_ASO_concordance();
  reportsSetupChart_basemean_FC();
  reportsSetupChart_fdr_FC();
  reportsSetupZenbuGB1();
  */
  
  var elements = configDOM.getElementsByTagName("reportElement");
  //first build the layout elements
  for(var i=0; i<elements.length; i++) {
    var elementDOM = elements[i];
    if(!elementDOM) { continue; }
    var element_type = elementDOM.getAttribute("element_type");
    if(element_type == "layout") {
      reportsCreateLayoutElementFromConfigDOM(elementDOM);
    }
  }

  //then the other reportElements
  for(var i=0; i<elements.length; i++) {
    var elementDOM = elements[i];
    if(!elementDOM) { continue; }
    var element_type = elementDOM.getAttribute("element_type");
    if(element_type != "layout") {
      reportsCreateElementFromConfigDOM(elementDOM);
    }
    //gLyphTrack_array[glyphTrack.trackID] = glyphTrack;
    //glyphset.appendChild(glyphTrack.trackDiv);
    //gLyphsDrawTrack(glyphTrack.trackID);  //this creates empty tracks with the "loading" tag
  }

  /*
  if(configDOM.getElementsByTagName("region")) {
    var region = configDOM.getElementsByTagName("region")[0];
    if(region) {
      gLyphsSetLocation(region.getAttribute("asm"),
                        region.getAttribute("chrom"),
                        parseInt(region.getAttribute("start")),
                        parseInt(region.getAttribute("end")));
    }
  }
  //gLyphsInitSearchFromTracks();
  */
  
  return true;
}

//
// parsing Element configXML DOM
//
function reportsCreateLayoutElementFromConfigDOM(elementDOM) {
  if(!elementDOM) { return null; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "layout") { return null;}
  
  var elementID = elementDOM.getAttribute("elementID");
  var layout_type = elementDOM.getAttribute("layout_type");
  var layout_parentID = elementDOM.getAttribute("layout_parentID");
  
  //<reportElement element_type="layout" elementID="row1" main_div_id="row1_div" title="layout row : row1" layout_mode="child" layout_parentID="" layout_type="row"/>
  
  var layoutElement = reportsNewLayoutElement(layout_type, elementID, layout_parentID);

  if(elementDOM.getAttribute("main_div_id")) {  layoutElement.main_div_id = elementDOM.getAttribute("main_div_id"); }
  if(elementDOM.getAttribute("title")) {  layoutElement.title = elementDOM.getAttribute("title"); }
  if(elementDOM.getAttribute("layout_mode")) {  layoutElement.layout_mode = elementDOM.getAttribute("layout_mode"); }

  if(elementDOM.getAttribute("layout_parentID")) {  layoutElement.layout_parentID = elementDOM.getAttribute("layout_parentID"); }
  if(elementDOM.getAttribute("layout_col")) {  layoutElement.layout_col = parseInt(elementDOM.getAttribute("layout_col")); }
  if(elementDOM.getAttribute("layout_row")) {  layoutElement.layout_row = parseInt(elementDOM.getAttribute("layout_row")); }
  if(elementDOM.getAttribute("layout_xpos")) {  layoutElement.layout_xpos = parseInt(elementDOM.getAttribute("layout_xpos")); }
  if(elementDOM.getAttribute("layout_ypos")) {  layoutElement.layout_ypos = parseInt(elementDOM.getAttribute("layout_ypos")); }
  if(elementDOM.getAttribute("tab_size_mode")) { layoutElement.tab_size_mode = elementDOM.getAttribute("tab_size_mode"); }  
  if(elementDOM.getAttribute("content_width")) {  layoutElement.content_width = parseInt(elementDOM.getAttribute("content_width")); }
  if(elementDOM.getAttribute("content_height")) {  layoutElement.content_height = parseInt(elementDOM.getAttribute("content_height")); }

  var tabDOMs = elementDOM.getElementsByTagName("tab");
  if(tabDOMs.length>0) { layoutElement.tabs_array = new Array(); } //clear array
  for(var j=0; j<tabDOMs.length; j++) {
    var tabDOM = tabDOMs[j];
    if(!tabDOM) { continue; }
    var tab_obj = new Object();
    tab_obj.title = tabDOM.getAttribute("title");
    tab_obj.child_elementID = tabDOM.getAttribute("child_elementID");
    layoutElement.tabs_array.push(tab_obj);
  }

  return layoutElement;
}


function reportsCreateElementFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return null; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type == "layout") { return null;}
  if(element_type == "tools_panel") { return null;}

  var elementID = elementDOM.getAttribute("elementID");

  var reportElement = current_report.elements[elementID];
  if(!reportElement) {
    reportElement = reportsNewReportElement(element_type, elementID);
    current_report.elements[reportElement.elementID] = reportElement;
  }

  reportElement.load_on_page_init = false;
  reportElement.show_titlebar = true;
  reportElement.widget_search = false;
  reportElement.widget_filter = false;
  reportElement.widget_columns = false;
  reportElement.move_selection_to_top=false;
  reportElement.sort_reverse = false;
  reportElement.show_only_search_matches = false;
  reportElement.hide_zero = false;
  reportElement.auto_content_height = false;
  reportElement.title = "";
  reportElement.title_prefix = "";
  //reportElement.resetable = false;
  
  if(elementDOM.getAttribute("main_div_id")) {  reportElement.main_div_id = elementDOM.getAttribute("main_div_id"); }
  if(elementDOM.getAttribute("title")) {  reportElement.title = elementDOM.getAttribute("title"); }
  if(elementDOM.getAttribute("title_prefix")) {  reportElement.title_prefix = elementDOM.getAttribute("title_prefix"); }

  if(elementDOM.getAttribute("datasource_mode")) {  reportElement.datasource_mode = elementDOM.getAttribute("datasource_mode"); }
  if(elementDOM.getAttribute("datasource_submode")) {  reportElement.datasource_submode = elementDOM.getAttribute("datasource_submode"); }
  if(elementDOM.getAttribute("datasourceElementID")) {  reportElement.datasourceElementID = elementDOM.getAttribute("datasourceElementID"); }
  if(elementDOM.getAttribute("source_ids")) {  reportElement.source_ids = elementDOM.getAttribute("source_ids"); }
  if(elementDOM.getAttribute("query_filter")) {  reportElement.query_filter = elementDOM.getAttribute("query_filter"); }
  if(elementDOM.getAttribute("collaboration_filter")) {  reportElement.collaboration_filter = elementDOM.getAttribute("collaboration_filter"); console.log("reportElement.collaboration_filter: "+reportElement.collaboration_filter); }
  if(elementDOM.getAttribute("query_format")) {  reportElement.query_format = elementDOM.getAttribute("query_format"); }
  if(elementDOM.getAttribute("query_edge_search_depth")) {  reportElement.query_edge_search_depth = elementDOM.getAttribute("query_edge_search_depth"); }

  if(elementDOM.getAttribute("table_page_size")) {  reportElement.table_page_size = Math.floor(elementDOM.getAttribute("table_page_size")); }
  //if(elementDOM.getAttribute("table_num_pages")) {  reportElement.table_num_pages = elementDOM.getAttribute("table_num_pages"); }
  //if(elementDOM.getAttribute("table_page")) {  reportElement.table_page = elementDOM.getAttribute("table_page"); }
  if(elementDOM.getAttribute("sort_col")) {  reportElement.sort_col = elementDOM.getAttribute("sort_col"); }
  if(elementDOM.getAttribute("sort_reverse") == "true") { reportElement.sort_reverse = true; }
  if(elementDOM.getAttribute("move_selection_to_top") == "true") { reportElement.move_selection_to_top = true; }

  if(elementDOM.getAttribute("load_on_page_init") == "true") { reportElement.load_on_page_init = true; }
  //if(elementDOM.getAttribute("resetable") == "true") { reportElement.resetable = true; }
  if(elementDOM.getAttribute("init_selection")) {  reportElement.init_selection = elementDOM.getAttribute("init_selection"); }
  //if(elementDOM.getAttribute("selected_id")) {  reportElement.selected_id = elementDOM.getAttribute("selected_id"); }
  //if(elementDOM.getAttribute("search_data_filter")) {  reportElement.search_data_filter = elementDOM.getAttribute("search_data_filter"); }
  //if(elementDOM.getAttribute("show_only_search_matches") == "true") { reportElement.show_only_search_matches = true; }

  if(elementDOM.getAttribute("show_titlebar") == "false") { reportElement.show_titlebar = false; }
  if(elementDOM.getAttribute("widget_search") == "true") { reportElement.widget_search = true; }
  if(elementDOM.getAttribute("widget_filter") == "true") { reportElement.widget_filter = true; }
  if(elementDOM.getAttribute("widget_columns") == "true") { reportElement.widget_columns = true; }
  if(elementDOM.getAttribute("border")) {  reportElement.border = elementDOM.getAttribute("border"); }

  if(elementDOM.getAttribute("hide_zero") == "true") { reportElement.hide_zero = true; }

  if(elementDOM.getAttribute("layout_mode")) {  reportElement.layout_mode = elementDOM.getAttribute("layout_mode"); }
  if(elementDOM.getAttribute("layout_parentID")) {  reportElement.layout_parentID = elementDOM.getAttribute("layout_parentID"); }
  if(elementDOM.getAttribute("layout_col")) {  reportElement.layout_col = parseInt(elementDOM.getAttribute("layout_col")); }
  if(elementDOM.getAttribute("layout_row")) {  reportElement.layout_row = parseInt(elementDOM.getAttribute("layout_row")); }
  if(elementDOM.getAttribute("layout_xpos")) {  reportElement.layout_xpos = parseInt(elementDOM.getAttribute("layout_xpos")); }
  if(elementDOM.getAttribute("layout_ypos")) {  reportElement.layout_ypos = parseInt(elementDOM.getAttribute("layout_ypos")); }
  if(elementDOM.getAttribute("content_width")) {  reportElement.content_width = parseInt(elementDOM.getAttribute("content_width")); }
  if(elementDOM.getAttribute("content_height")) {  reportElement.content_height = parseInt(elementDOM.getAttribute("content_height")); }
  if(elementDOM.getAttribute("auto_content_height") == "true") { reportElement.auto_content_height = true; }

  if(elementDOM.getAttribute("assembly_name")) { reportElement.assembly_name = elementDOM.getAttribute("assembly_name"); }

  //general subclass method
  if(reportElement.initFromConfigDOM) {
    reportElement.initFromConfigDOM(elementDOM);
  }

  //element_type specific parameters
  //if(reportElement.element_type == "table") {
  //}
  if(reportElement.element_type == "chart") {
    reportElement.symetric_axis = false;
    if(elementDOM.getAttribute("chart_type")) { reportElement.chart_type = elementDOM.getAttribute("chart_type"); }
    if(elementDOM.getAttribute("display_type")) { reportElement.display_type = elementDOM.getAttribute("display_type"); }
    //if(elementDOM.getAttribute("layout_type")) { reportElement.layout_type = elementDOM.getAttribute("layout_type"); }
    if(elementDOM.getAttribute("symetric_axis") == "1") { reportElement.symetric_axis = true; }
    
    var xaxisDOM = elementDOM.getElementsByTagName("chart_xaxis")[0];
    if(xaxisDOM.getAttribute("datatype")) { reportElement.xaxis.datatype = xaxisDOM.getAttribute("datatype"); }
    if(xaxisDOM.getAttribute("fixedscale") == "1") { reportElement.xaxis.fixedscale = true; } else { reportElement.xaxis.fixedscale = false; }
    if(xaxisDOM.getAttribute("symetric") == "1") { reportElement.xaxis.symetric = true; } else { reportElement.xaxis.symetric = false; }
    if(xaxisDOM.getAttribute("log") == "1") { reportElement.xaxis.log = true; } else { reportElement.xaxis.log = false; }

    var yaxisDOM = elementDOM.getElementsByTagName("chart_yaxis")[0];
    if(yaxisDOM.getAttribute("datatype")) { reportElement.yaxis.datatype = yaxisDOM.getAttribute("datatype"); }
    if(yaxisDOM.getAttribute("fixedscale") == "1") { reportElement.yaxis.fixedscale = true; } else { reportElement.yaxis.fixedscale = false; }
    if(yaxisDOM.getAttribute("symetric") == "1") { reportElement.yaxis.symetric = true; } else { reportElement.yaxis.symetric = false; }
    if(yaxisDOM.getAttribute("log") == "1") { reportElement.yaxis.log = true; } else { reportElement.yaxis.log = false; }
  }
  if(reportElement.element_type == "zenbugb") {
    if(elementDOM.getAttribute("zenbu_url")) { reportElement.zenbu_url = elementDOM.getAttribute("zenbu_url"); }
    if(elementDOM.getAttribute("view_config")) { reportElement.view_config = elementDOM.getAttribute("view_config"); }
    if(elementDOM.getAttribute("chrom_location")) { reportElement.chrom_location = elementDOM.getAttribute("chrom_location"); }
  }
  if(reportElement.element_type == "html") {
    if(elementDOM.getAttribute("html_content")) { reportElement.html_content = elementDOM.getAttribute("html_content"); }
    var htmlContentDOM = elementDOM.getElementsByTagName("html_content");
    if(htmlContentDOM && htmlContentDOM.length>0) {
      reportElement.html_content = htmlContentDOM[0].firstChild.nodeValue;
    }
    //console.log("html_content ["+reportElement.html_content+"]")
  }
  if(reportElement.element_type == "category") {
    //reportElement.initFromConfigDOM(elementDOM);
    if(elementDOM.getAttribute("category_datatype")) { reportElement.category_datatype = elementDOM.getAttribute("category_datatype"); }
    if(elementDOM.getAttribute("category_method")) { reportElement.category_method = elementDOM.getAttribute("category_method"); }
    if(elementDOM.getAttribute("ctg_value_datatype")) { reportElement.ctg_value_datatype = elementDOM.getAttribute("ctg_value_datatype"); }
    if(elementDOM.getAttribute("display_type")) { reportElement.display_type = elementDOM.getAttribute("display_type"); }
    if(elementDOM.getAttribute("colorspace")) { reportElement.colorspace = elementDOM.getAttribute("colorspace"); }
  }
  //if(reportElement.element_type == "layout") {
  //  if(reportElement.layout_type) { elementDOM.setAttribute("layout_type", reportElement.layout_type); }
  //}

  
  //dtype_column
  //  <dtype_column datatype="geneName" title="geneName" colnum="6" col_type="mdata" visible="true"/>
  var colDOMs = elementDOM.getElementsByTagName("dtype_column");
  for(var j=0; j<colDOMs.length; j++) {
    var colDOM = colDOMs[j];
    if(!colDOM) { continue; }
    
    var datatype = colDOM.getAttribute("datatype");
    var title = colDOM.getAttribute("title");

    var t_col = reportElementAddDatatypeColumn(reportElement, datatype, title);

    if(colDOM.getAttribute("colnum")) { t_col.colnum = parseInt(colDOM.getAttribute("colnum")); }
    if(colDOM.getAttribute("signal_order")) { t_col.signal_order = parseInt(colDOM.getAttribute("signal_order")); }
    if(colDOM.getAttribute("col_type")) { t_col.col_type = colDOM.getAttribute("col_type"); }

    if(colDOM.getAttribute("user_modifiable") == "true") { t_col.user_modifiable = true; } else { t_col.user_modifiable = false; }
    if(colDOM.getAttribute("visible") == "true") { t_col.visible = true; } else { t_col.visible = false; }
    if(colDOM.getAttribute("filtered") == "true") { t_col.filtered = true; } else { t_col.filtered = false; }
    if(colDOM.getAttribute("filter_abs") == "true") { t_col.filter_abs = true; } else { t_col.filter_abs = false; }
    
    if(colDOM.getAttribute("signal_active") == "true") { t_col.signal_active = true; t_col.visible = false; } 
    else { t_col.signal_active = false; }
    
    if(colDOM.getAttribute("filter_min")) {
      t_col.filter_min = colDOM.getAttribute("filter_min");
      if(t_col.filter_min != "min") { t_col.filter_min = parseFloat(t_col.filter_min); }
    }
    if(colDOM.getAttribute("filter_max")) {
      t_col.filter_max = colDOM.getAttribute("filter_max");
      if(t_col.filter_max != "max") { t_col.filter_max = parseFloat(t_col.filter_max); }
    }
    if(colDOM.getAttribute("highlight_color")) { t_col.highlight_color = colDOM.getAttribute("highlight_color"); }
    
    if(t_col.filtered && (t_col.col_type == "mdata")) {
      //parse categories for mdata filters
      var ctgDOMs = colDOM.getElementsByTagName("md_category");
      for(var k=0; k<ctgDOMs.length; k++) {
        var ctgDOM = ctgDOMs[k];
        if(!ctgDOM) { continue; }
        
        var ctg_obj = {ctg:"", count:0, filtered:false};
        if(ctgDOM.getAttribute("ctg")) { ctg_obj.ctg = ctgDOM.getAttribute("ctg"); }
        if(ctgDOM.getAttribute("filtered") == "true") {
          ctg_obj.filtered = true;
          if(!(t_col.categories)) { t_col.categories = new Object; }
          t_col.categories[ctg_obj.ctg] = ctg_obj;
        }
      }
      if(!(t_col.categories)) { t_col.filtered=false; }  //safety check
    }
  }

  //cascade_trigger
  //  <cascade_trigger trigger_idx="1" targetElementID="gene_target_aso" on_trigger="select" action_mode="focus_load" options="selection"/>
  var triggers = elementDOM.getElementsByTagName("cascade_trigger");
  for(var j=0; j<triggers.length; j++) {
    var triggerDOM = triggers[j];
    if(!triggerDOM) { continue; }
    
    //trigDoc.setAttribute("trigger_idx", trig_idx);
    var targetElementID = triggerDOM.getAttribute("targetElementID");
    var on_trigger = triggerDOM.getAttribute("on_trigger");
    var action_mode = triggerDOM.getAttribute("action_mode");
    var options = triggerDOM.getAttribute("options");
    
    var trigger = reportElementAddCascadeTrigger(reportElement, targetElementID, on_trigger, action_mode, options);
    if(trigger && (on_trigger == "hyperlink")) {
      trigger.hyperlink_datatype = triggerDOM.getAttribute("hyperlink_datatype");
    }
  }
  
  reportsPrepElement(reportElement);  //creates main_div
  //reportsResetTableElement(reportElement); //might not need here
  return reportElement;
}


//=================================================================================
// View/Element configXML creation / save
//=================================================================================

function reportsGeneratePageConfigDOM() {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer
  
  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = current_report.saveconfig;
  
  var config = doc.createElement("ZENBU_reports_page_config");
  doc.appendChild(config);
  
  //var collab = config.appendChild(doc.createElement("collaboration"));
  //collab.setAttribute("uuid", current_collaboration.uuid);
  //collab.setAttribute("name", current_collaboration.name);
  
  if(saveconfig.autosave) {
    var autosave = doc.createElement("autoconfig");
    autosave.setAttribute("value", "public");
    config.appendChild(autosave);
  }
  
  var summary = doc.createElement("summary");
  if(saveconfig.title) { summary.setAttribute("title", saveconfig.title); }
  if(saveconfig.desc) { summary.setAttribute("desc", saveconfig.desc); }
  if(current_user) {
    if(current_user.nickname) { summary.setAttribute("user_nickname", current_user.nickname); }
    if(current_user.email)    { summary.setAttribute("user_email", current_user.email); }
    if(current_user.openID)   { summary.setAttribute("user_openID", current_user.openID); }
  }
  //var current_time = new Date();
  //summary.setAttribute("create_date", current_time); }
  config.appendChild(summary);
  
  //var loc = doc.createElement("region");
  //loc.setAttribute("asm",    current_report.asm);
  //loc.setAttribute("chrom",  current_report.chrom);
  //loc.setAttribute("start",  current_report.start);
  //loc.setAttribute("end",    current_report.end);
  //config.appendChild(loc);
  
  var settings = doc.createElement("settings");
  settings.setAttribute("dwidth", current_report.display_width);
  if(current_report.nocache) { settings.setAttribute("global_nocache", "true"); }
  //if(current_report.edit_page_configuration) { settings.setAttribute("edit_page_configuration", "true"); }
  config.appendChild(settings);
  
  //var expexp = doc.createElement("experiment_expression");
  //expexp.setAttribute("exp_sort", express_sort_mode);
  //config.appendChild(expexp);
    
  /*
   current_report.elements = new Object(); //hash of elementID to element in this report
   current_report.configUUID = "";
   current_report.active_elementID = undefined;
   current_report.init_url_terms = undefined;
   //current_report.search_feature = undefined;
   current_report.focus_feature = undefined;
   1 current_report.
   4 current_report.active_elementID
   3 current_report.active_trackID
   6 current_report.asm
   2 current_report.auto_flip
   6 current_report.autosaveInterval
   3 current_report.chrom
   16 current_report.configUUID
   7 current_report.config_createdate
   12 current_report.config_creator
   10 current_report.config_title
   7 current_report.current_dragging_element
   7 current_report.desc
   11 current_report.display_width
   17 current_report.edit_page_configuration
   96 current_report.elements
   4 current_report.end
   10 current_report.exportSVGconfig
   5 current_report.exppanel_active_on_top
   5 current_report.exppanel_hide_deactive
   5 current_report.exppanel_subscroll
   5 current_report.first_init
   9 current_report.flip_orientation
   6 current_report.focus_feature
   3 current_report.groupinfo_ranksum_display
   2 current_report.has_sequence
   5 current_report.hide_compacted_tracks
   3 current_report.hide_zero_experiments
   10 current_report.init_url_terms
   6 current_report.modified
   9 current_report.new_element_abs_pos
   6 current_report.nocache
   8 current_report.reinitialize_page
   10 current_report.saveConfigXHR
   61 current_report.saveconfig
   12 current_report.search_feature
   2 current_report.show_focus_metadata
   3 current_report.start
   10 current_report.view_config
   11 current_report.view_config_loaded
  */
  
  var element_set = doc.createElement("reportElementSet");
  element_set.setAttribute("newElementID", newElementID);
  //element_set.setAttribute("new_element_abs_pos", current_report.new_element_abs_pos);
  config.appendChild(element_set);

  var count=0;
  for(var elementID in current_report.elements) {
    var reportElement = current_report.elements[elementID];
    if(!reportElement) { continue; }
    //var elementDOM = reportsGenerateElementDOM(reportElement);
    var elementDOM = null;
    if(reportElement.generateConfigDOM) { elementDOM = reportElement.generateConfigDOM(); }
    else { elementDOM = reportsGenerateElementDOM(reportElement); }
    if(elementDOM) { element_set.appendChild(elementDOM); }
    count++;
  }
  element_set.setAttribute("num_elements", count);
  
  return doc;
}


function reportsGenerateElementDOM(reportElement) {
  if(!reportElement) { return null; }
  if(reportElement.element_type == "tools_panel") { return null; }
  
  var doc = document.implementation.createDocument("", "", null);
  
  var elementDOM = doc.createElement("reportElement");
  
  if(reportElement.element_type) { elementDOM.setAttribute("element_type", reportElement.element_type); }
  if(reportElement.elementID) { elementDOM.setAttribute("elementID", reportElement.elementID); }
  if(reportElement.main_div_id) { elementDOM.setAttribute("main_div_id", reportElement.main_div_id); }

  if(reportElement.title) { elementDOM.setAttribute("title", reportElement.title); }
  if(reportElement.title_prefix) { elementDOM.setAttribute("title_prefix", reportElement.title_prefix); }
  
  if(reportElement.datasource_mode) { elementDOM.setAttribute("datasource_mode", reportElement.datasource_mode); } //feature, edge, shared_element
  if(reportElement.datasource_submode) { elementDOM.setAttribute("datasource_submode", reportElement.datasource_submode); } //feature, edge, shared_element
  if(reportElement.datasourceElementID) { elementDOM.setAttribute("datasourceElementID", reportElement.datasourceElementID); }  //for shared_element mode
  if(reportElement.source_ids) { elementDOM.setAttribute("source_ids", reportElement.source_ids); }
  if(reportElement.query_filter) { elementDOM.setAttribute("query_filter", reportElement.query_filter); }
  if(reportElement.collaboration_filter) { elementDOM.setAttribute("collaboration_filter", reportElement.collaboration_filter); }
  if(reportElement.query_format) { elementDOM.setAttribute("query_format", reportElement.query_format); }
  if(reportElement.query_edge_search_depth) { elementDOM.setAttribute("query_edge_search_depth", reportElement.query_edge_search_depth); }

  if(reportElement.table_page_size) { elementDOM.setAttribute("table_page_size", reportElement.table_page_size); }
  //if(reportElement.table_num_pages) { elementDOM.setAttribute("table_num_pages", reportElement.table_num_pages); }
  //if(reportElement.table_page) { elementDOM.setAttribute("table_page", reportElement.table_page); }
  if(reportElement.sort_col) { elementDOM.setAttribute("sort_col", reportElement.sort_col); }
  if(reportElement.sort_reverse) { elementDOM.setAttribute("sort_reverse", "true"); }
  if(reportElement.move_selection_to_top) { elementDOM.setAttribute("move_selection_to_top", "true"); }  //treelist

  if(reportElement.load_on_page_init) {
    elementDOM.setAttribute("load_on_page_init", "true");
    //if(reportElement.selected_feature) { elementDOM.setAttribute("init_selection", reportElement.selected_feature.name); }
    if(reportElement.selected_id) { elementDOM.setAttribute("init_selection", reportElement.selected_id); }
  }
  //if(reportElement.search_data_filter) { elementDOM.setAttribute("search_data_filter", reportElement.search_data_filter); }
  //if(reportElement.show_only_search_matches) { elementDOM.setAttribute("show_only_search_matches", "true"); }

  if(reportElement.hide_zero) { elementDOM.setAttribute("hide_zero", "true"); }

  if(reportElement.show_titlebar) { elementDOM.setAttribute("show_titlebar", "true"); } else { elementDOM.setAttribute("show_titlebar", "false"); }
  if(reportElement.widget_search) { elementDOM.setAttribute("widget_search", "true"); }
  if(reportElement.widget_filter) { elementDOM.setAttribute("widget_filter", "true"); }
  if(reportElement.widget_columns) { elementDOM.setAttribute("widget_columns", "true"); }
  if(reportElement.border) { elementDOM.setAttribute("border", reportElement.border); }

  if(reportElement.layout_mode) { elementDOM.setAttribute("layout_mode", reportElement.layout_mode); }  //absolute, child
  if(reportElement.layout_parentID) { elementDOM.setAttribute("layout_parentID", reportElement.layout_parentID); } //linked to Row, Column, or Grid layoutElement
  else { elementDOM.setAttribute("layout_parentID", ""); } //root
  if(reportElement.layout_row) { elementDOM.setAttribute("layout_row", reportElement.layout_row); }
  if(reportElement.layout_col) { elementDOM.setAttribute("layout_col", reportElement.layout_col); }
  if(reportElement.layout_xpos) { elementDOM.setAttribute("layout_xpos", parseInt(reportElement.layout_xpos)); }
  if(reportElement.layout_ypos) { elementDOM.setAttribute("layout_ypos", parseInt(reportElement.layout_ypos)); }
  
  if(reportElement.content_width) { elementDOM.setAttribute("content_width", reportElement.content_width); }
  if(reportElement.content_height) { elementDOM.setAttribute("content_height", reportElement.content_height); }
  if(reportElement.auto_content_height) { elementDOM.setAttribute("auto_content_height", "true"); }
  
  //dtype_columns
  if(reportElement.datatypes) {
    for(var dtype in reportElement.datatypes) {
      var dtype_col = reportElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      //if(!dtype_col.visible && (dtype_col.col_type=="hyperlink")) { continue; }
      //if(!dtype_col.visible && !dtype_col.filtered && (dtype_col.datatype!="category") && (dtype_col.datatype!="source_name")) { continue; }

      var colDoc = doc.createElement("dtype_column");
      colDoc.setAttribute("datatype", dtype_col.datatype);
      colDoc.setAttribute("title", dtype_col.title);
      colDoc.setAttribute("colnum", dtype_col.colnum);
      colDoc.setAttribute("col_type", dtype_col.col_type);
      if(dtype_col.signal_order) { colDoc.setAttribute("signal_order", dtype_col.signal_order); }
      if(dtype_col.filter_min) { colDoc.setAttribute("filter_min", dtype_col.filter_min); }
      if(dtype_col.filter_max) { colDoc.setAttribute("filter_max", dtype_col.filter_max); }

      if(dtype_col.visible) { colDoc.setAttribute("visible", "true"); }
      if(dtype_col.filtered) { colDoc.setAttribute("filtered", "true"); }
      if(dtype_col.filter_abs) { colDoc.setAttribute("filter_abs", "true"); }
      if(dtype_col.user_modifiable) { colDoc.setAttribute("user_modifiable", "true"); }
      if(dtype_col.signal_active) { colDoc.setAttribute("signal_active", "true"); }
      
      if(dtype_col.highlight_color) { colDoc.setAttribute("highlight_color", dtype_col.highlight_color); }

      if(dtype_col.filtered && (dtype_col.col_type == "mdata") && dtype_col.categories) {
        //need to save categories for mdata filters
        for(var ctg in dtype_col.categories) {
          var ctg_obj = dtype_col.categories[ctg];
          if(ctg_obj.filtered) {
            var ctgDoc = doc.createElement("md_category");
            ctgDoc.setAttribute("ctg", ctg_obj.ctg);
            if(ctg_obj.filtered) { ctgDoc.setAttribute("filtered", "true"); }
            colDoc.appendChild(ctgDoc);
          }
        }
      }

      elementDOM.appendChild(colDoc);
    }
  }
  
  //cascade triggers
  if(reportElement.cascade_triggers) {
    for(var trig_idx=0; trig_idx<reportElement.cascade_triggers.length; trig_idx++){
      var trigger = reportElement.cascade_triggers[trig_idx];
      if(!trigger) { continue; }
      
      var trigDoc = doc.createElement("cascade_trigger");
      trigDoc.setAttribute("trigger_idx", trig_idx);
      trigDoc.setAttribute("targetElementID", trigger.targetElementID);
      trigDoc.setAttribute("on_trigger", trigger.on_trigger);
      trigDoc.setAttribute("action_mode", trigger.action_mode);
      if(trigger.options) { trigDoc.setAttribute("options", trigger.options); }
      if(trigger.hyperlink_datatype) { trigDoc.setAttribute("hyperlink_datatype", trigger.hyperlink_datatype); }
      
      elementDOM.appendChild(trigDoc);
    }
  }
  
  if(reportElement.element_type == "layout") {
    if(reportElement.layout_type) { elementDOM.setAttribute("layout_type", reportElement.layout_type); }
    if(reportElement.tab_size_mode) { elementDOM.setAttribute("tab_size_mode", reportElement.tab_size_mode); }

    if(reportElement.layout_type == "tab" && reportElement.tabs_array) {
      for(var tidx=0; tidx<reportElement.tabs_array.length; tidx++){
        var tab_obj = reportElement.tabs_array[tidx];
        if(!tab_obj) { continue; }
        var tabDoc = doc.createElement("tab");
        tabDoc.setAttribute("title", tab_obj.title);          
        if(tab_obj.child_elementID) { tabDoc.setAttribute("child_elementID", tab_obj.child_elementID); }
        elementDOM.appendChild(tabDoc);
      }
    }
  }
  
  reportElement.elementDOM = elementDOM;
  reportElement.elementDOM_doc = doc;
  return elementDOM;
}

//
// upload configXML
//

function reportsUploadPageConfigXML() {
  if(current_report.saveConfigXHR) {
    //a save already in operation. flag for resave when finished
    current_report.modified = true;
    return;
  }
  if(!current_report.saveconfig) { return; }
  
  var configDOM = reportsGeneratePageConfigDOM();
  
  var serializer = new XMLSerializer();
  var configXML  = serializer.serializeToString(configDOM);
  
  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = configXML.indexOf("<ZENBU_reports_page_config>");
  if(idx1 > 0) { configXML = configXML.substr(idx1); }
  
  var saveconfig = current_report.saveconfig;
  current_report.view_config = undefined; //clear old config object since it is not valid anymore
  
  //build the zenbu_query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode><configtype>report</configtype>\n";
  if(saveconfig.fixed_id) { paramXML += "<fixed_id>"+saveconfig.fixed_id+"</fixed_id>\n"; }
  if(saveconfig.title) { paramXML += "<title>"+ encodehtml(saveconfig.title) + "</title>\n"; }
  if(saveconfig.desc) { paramXML += "<description>"+ encodehtml(saveconfig.desc) + "</description>\n"; }
  
  if(saveconfig.autosave) {
    paramXML += "<autosave>true</autosave>\n";
  } else {
    paramXML += "<collaboration_uuid>"+ current_collaboration.uuid +"</collaboration_uuid>\n";
    
    //current_report.exportSVGconfig = new Object;
    //current_report.exportSVGconfig.title = current_report.configname;
    //current_report.exportSVGconfig.savefile = false;
    //current_report.exportSVGconfig.hide_widgets = false;
    //current_report.exportSVGconfig.hide_sidebar = false;
    //current_report.exportSVGconfig.hide_titlebar = false;
    //current_report.exportSVGconfig.hide_experiment_graph = true;
    //current_report.exportSVGconfig.hide_compacted_tracks = true;
    
    //var svgXML = generateSvgXML();
    //paramXML += "<svgXML>" + svgXML + "</svgXML>";
    //current_report.exportSVGconfig = undefined;
  }
  
  paramXML += "<configXML>" + configXML + "</configXML>";
  paramXML += "</zenbu_query>\n";
  
  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  current_report.saveConfigXHR = configXHR;
  
  configXHR.open("POST",eedbConfigCGI, true); //async
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  configXHR.onreadystatechange= reportsUploadPageConfigXMLResponse;
  //configXHR.setRequestHeader("Content-length", paramXML.length);
  //configXHR.setRequestHeader("Connection", "close");
  configXHR.send(paramXML);
  current_report.modified = false;
}


function reportsUploadPageConfigXMLResponse() {
  var configXHR = current_report.saveConfigXHR;
  if(!configXHR) { return; }
  
  //might need to be careful here
  if(configXHR.readyState!=4) { return; }
  if(configXHR.responseXML == null) { return; }
  if(configXHR.status!=200) { return; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null) { return null; }
  
  // parse result back to get uuid and adjust view
  current_report.configUUID = "";
  if(xmlDoc.getElementsByTagName("configuration")) {
    var configXML = xmlDoc.getElementsByTagName("configuration")[0];
    current_report.view_config = eedbParseConfigurationData(configXML);
    if(current_report.view_config) {
      current_report.configUUID = current_report.view_config.uuid;
      current_report.config_fixed_id = current_report.view_config.fixed_id;
      if(current_report.view_config.collaboration) {
        current_collaboration.name = current_report.view_config.collaboration.name;
        current_collaboration.uuid = current_report.view_config.collaboration.uuid;
        console.log("loaded view has collaboration ["+current_collaboration.name+"]  ["+current_collaboration.uuid+"]")
      }
    }
  }
  
  if(current_report.configUUID) {
    reportsChangeDhtmlHistoryLocation();
    
    current_report.desc           = current_report.saveconfig.desc;
    current_report.config_title   = current_report.saveconfig.title;
    current_report.config_creator = "guest";
    if(current_user) {
      if(current_user.email)    { current_report.config_creator = current_user.email; }
      if(current_user.openID)   { current_report.config_creator = current_user.openID; }
      if(current_user.nickname) { current_report.config_creator = current_user.nickname; }
    }
    reportsShowConfigInfo();
  }
  
  current_report.saveConfigXHR = undefined;
  if(current_report.modified) { //do it again since it was modified after this save was initiated
    reportsUploadPageConfigXML();
    return;
  }
  //finished
  current_report.saveconfig = undefined;
  current_report.edit_page_configuration = false;
  reportsDisplayEditTools();
  reportsDrawElements();
  //TODO: might-reverse: reportsUpdateLayoutElements();
}


//autosave code 
function reportsAutosaveConfig() {
  if(!current_user) { return; }
  //delay the autosave to allow user to do many manipulations without stalling
  if(!current_report.autosaveInterval) {
    current_report.autosaveInterval = setInterval("reportsSendAutosaveConfig();", 30000); //30 seconds
    //current_report.autosaveInterval = setInterval("reportsSendAutosaveConfig();", 3000); //3 seconds
  }
  current_report.modified = true;
}

function reportsSendAutosaveConfig() {
  var saveconfig = new Object;
  current_report.saveconfig = saveconfig;
  saveconfig.name     = "tempsave";
  saveconfig.desc     = current_report.desc;
  saveconfig.autosave = true;

  //var mymatch = /^temporary\.(.+)/.exec(current_report.configname);
  //if(mymatch && (mymatch.length == 2)) {
  //  current_report.configname = mymatch[1];
  //}
  //mymatch = /^modified\.(.+)/.exec(current_report.configname);
  //if(mymatch && (mymatch.length == 2)) {
  //  current_report.configname = mymatch[1];
  //}
  //mymatch = /(.+) \(modified\)$/.exec(current_report.configname);
  //if(mymatch && (mymatch.length == 2)) {
  //  current_report.configname = mymatch[1];
  //}
  //saveconfig.name = current_report.configname + " (modified)";

  //TODO: need some logic somewhere so that autosave does not use the fixed_id but saves to uniq ids only
  //reportsUploadPageConfigXML();

  if(current_report.autosaveInterval) {
    window.clearInterval(current_report.autosaveInterval);
    current_report.autosaveInterval = undefined;
  }
}


//---------------------------------------------------------------
//
// Configuration save panel interface
//
//---------------------------------------------------------------

function reportsSaveConfigPanel() {
  var saveConfigDiv = document.getElementById("global_panel_layer");
  if(!saveConfigDiv) { return; }
  
  eedbShowLogin();
  if(!current_user) {
    reportsNoUserWarn("save a reports page configuration");
    return;
  }
  console.log("reportsSaveConfigPanel");
  
  if(current_report.saveconfig == undefined) {
    console.log("reportsSaveConfigPanel first init create saveconfig");
    current_report.saveconfig = new Object;
    current_report.saveconfig.title  = current_report.config_title;
    current_report.saveconfig.desc   = current_report.desc;
    current_report.saveconfig.fixed_id = current_report.config_fixed_id;
    current_report.saveconfig.validation_status = "checking";
    if(!current_report.saveconfig.fixed_id) {
      current_report.saveconfig.edit_fixed_id = false;
      current_report.saveconfig.validation_status = "valid";
      current_report.saveconfig.validation_message = "no fixed ID";
    }
  }
  
  //clear/reset previous autosave
  if(current_report.autosaveInterval) {
    window.clearInterval(current_report.autosaveInterval);
    current_report.autosaveInterval = undefined;
  }
  current_report.modified = false;
  current_report.saveConfigXHR = undefined;

  var xpos = current_report.saveconfig.xpos;
  var ypos = current_report.saveconfig.ypos;
  if(!xpos) {
    var e = window.event
    toolTipWidth=400;
    moveToMouseLoc(e);
    current_report.saveconfig.xpos = xpos = toolTipSTYLE.xpos;
    current_report.saveconfig.ypos = ypos = toolTipSTYLE.ypos + 10;
  }
  
  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:#FDFDFD; text-align:left; "
                        +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                        //+"left:" + ((winW/2)-250) +"px; top:200px; "
                        +"left:"+(xpos-400)+"px; top:"+(ypos)+"px; "
                        +"width:400px; z-index:90;"
                        );
  var tdiv, tspan, tinput;
  
  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onmousedown", "reportsSaveConfigPanelParam('cancel'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  
  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Save reports page configuration";
  divFrame.appendChild(tdiv)
  
  //----------
  if(current_report.configUUID) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "uuid:";

    var span1 = div1.appendChild(document.createElement('span'));
    //span1.setAttribute("style", "padding:0px 0px 0px 10px; font-size:11px; font-weight:bold; color:rgb(94,115,153);");
    span1.setAttribute("style", "padding:0px 0px 0px 10px; font-size:11px; color:orange;");
    span1.innerHTML = current_report.configUUID;
  }
  
  //----------
  if(current_report.saveconfig.edit_fixed_id) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
    var span0 = document.createElement('span');
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "fixed page url ID:";
    div1.appendChild(span0);
    var fixedIdInput = document.createElement('input');
    fixedIdInput.id = "_fixed_id_inputID";
    fixedIdInput.setAttribute('style', "width:150px; margin-left: 5px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    fixedIdInput.setAttribute('type', "text");
    fixedIdInput.setAttribute('value', current_report.saveconfig.fixed_id);
    //fixedIdInput.setAttribute("onkeydown", "reportsSaveConfigPanelParam('configUUID', this.value);");
    fixedIdInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportsSaveConfigPanelParam('fixed_id', this.value); }");
    div1.appendChild(fixedIdInput);
    
    button = div1.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "reportsSaveConfigPanelParam('fixed_id', '');");
    button.innerHTML = "verify fixed ID";
  } else {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    var span1 = div1.appendChild(document.createElement('span'));
    span1.innerHTML = "fixed page url ID:";
    var uuid_span = div1.appendChild(document.createElement('span'));
    uuid_span.setAttribute("style", "padding:0px 0px 0px 10px; font-size:11px; font-weight:bold; color:rgb(94,115,153);");
    uuid_span.innerHTML = current_report.saveconfig.fixed_id;

    button = div1.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "reportsSaveConfigPanelParam('edit_fixed_id');");
    button.innerHTML = "change fixedID";
    
    if(current_report.saveconfig.fixed_id_owner) {
      button = div1.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "reportsSaveConfigPanelParam('edit_fixed_id_editors');");
      button.innerHTML = "manage editors";
    }
  }

  //button = div1.appendChild(document.createElement("button"));
  //button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:10px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onclick", "reportsSaveConfigPanelParam('autogen-uuid');");
  //button.innerHTML = "generate UUID";

  
  //----------
  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
  var span0 = div1.appendChild(document.createElement('span'));
  span0.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "page configuration title:";
  div1 = divFrame.appendChild(document.createElement('div'));
  var titleInput = div1.appendChild(document.createElement('input'));
  titleInput.setAttribute('style', "width:380px; margin: 1px 1px 5px 7px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', current_report.saveconfig.title);
  titleInput.setAttribute("onkeyup", "reportsSaveConfigPanelParam('name', this.value);");
  
  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:385px; margin: 3px 5px 3px 7px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute('value', current_report.saveconfig.desc);
  descInput.innerHTML = current_report.saveconfig.desc;
  descInput.setAttribute("onkeyup", "reportsSaveConfigPanelParam('desc', this.value);");
  divFrame.appendChild(descInput);
  
  //----------
  divFrame.appendChild(document.createElement('hr'));

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
    if(current_user.email) {
      var email_span = userDiv.appendChild(document.createElement('span'));
      email_span.setAttribute("style", "padding-left:10px; color:gray; font-size:11px;");
      email_span.innerHTML = current_user.email;
    }
  }
  
  var div1 = divFrame.appendChild(document.createElement('div'));
  var collabWidget = eedbCollaborationSelectWidget();
  div1.appendChild(collabWidget);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  console.log("reportsSaveConfigPanel fixed_id=["+current_report.saveconfig.fixed_id+"]  status="+current_report.saveconfig.validation_status+"  message["+current_report.saveconfig.validation_message+"]");

  if(current_report.saveconfig.validation_status == "checking") {
    console.log("validation_status == checking");
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px;");
    span1.innerHTML = "checking page ID....";
    reportsSaveConfigValidateUserPageEditing();
  } else if(current_report.saveconfig.validation_status == "ws-error") {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px; color:#FC8B28");
    span1.innerHTML = "error with webservices validating user";
  } else if(current_report.saveconfig.validation_status == "invalid") {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px; color:#FC8B28");
    span1.innerHTML = "invalid fixedID : "+current_report.saveconfig.validation_message;
  } else if(current_report.saveconfig.edit_fixed_id) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px;");
    span1.innerHTML = "editing page ID, press < Enter > key to validate";
  } else {
    console.log("validation_status == valid?");
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    
    var button2 = div1.appendChild(document.createElement('input'));
    button2.setAttribute("type", "button");
    button2.setAttribute("value", "save page");
    button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    button2.setAttribute("onclick", "reportsSaveConfigPanelParam('accept');");

    var button1 = div1.appendChild(document.createElement('input'));
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "cancel");
    button1.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    button1.setAttribute("onclick", "reportsSaveConfigPanelParam('cancel');");

    var span1 = div1.appendChild(document.createElement('div'));
    span1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    span1.innerHTML = current_report.saveconfig.validation_message;
  }
  console.log("ok set the panel contents");
  saveConfigDiv.innerHTML ="";
  saveConfigDiv.appendChild(divFrame);
}


function reportsSaveConfigPanelParam(param, value) {
  var saveConfigDiv = document.getElementById("global_panel_layer");
  if(!saveConfigDiv) { return; }
  
  var saveconfig = current_report.saveconfig;
  if(saveconfig === undefined) {
    if(saveConfigDiv) { saveConfigDiv.innerHTML =""; }
    return;
  }
  
  if(param == "name") { saveconfig.title = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  
  if(param == "fixed_id") {
    if(value == "") {
      var input1 = document.getElementById("_fixed_id_inputID");
      if(input1) { value = input1.value; }
    }
    saveconfig.fixed_id = value;
    if(saveconfig.fixed_id) {
      saveconfig.validation_status = "checking";
      saveconfig.edit_fixed_id = false;
      reportsSaveConfigPanel(); //refresh
      //reportsSaveConfigValidateUserPageEditing();
    } else {
      current_report.saveconfig.edit_fixed_id = false;
      current_report.saveconfig.validation_status = "valid";
      current_report.saveconfig.validation_message = "no fixed ID";
      reportsSaveConfigPanel(); //refresh
    }
  }
  if(param == "edit_fixed_id") {
    saveconfig.edit_fixed_id = true;
    reportsSaveConfigPanel(); //refresh
  }
  if(param == "edit_fixed_id_editors") {
    //saveconfig.edit_fixed_id = true;
    //reportsSaveConfigPanel(); //refresh
    reportsFixedIdEditorManagementPanel(true);
    //TODO: bring up panel with inputs and webservice checking logic
  }
  if(param == "fixedID_editor_mode") {
    //TODO: way to save the change back to webservice, either immediate or delayed
    //saveconfig.fixedID_editor_mode = value;
    //reportsSaveConfigPanel(); //refresh
    //reportsFixedIdEditorManagementPanel(false);
    var fixed_id = current_report.config_fixed_id;
    if(current_report.saveconfig && current_report.saveconfig.fixed_id) { fixed_id = current_report.saveconfig.fixed_id; }
    reportsChangeFixIdEditorMode(fixed_id, value);
  }
  if(param == "add_fixedID_editor") {
    var fixed_id = current_report.config_fixed_id;
    if(current_report.saveconfig && current_report.saveconfig.fixed_id) { fixed_id = current_report.saveconfig.fixed_id; }
    if(value == "") {
      var input1 = document.getElementById("configuration_fixedID_user_input");
      if(input1) { value = input1.value; }
    }
    reportsChangeFixIdEditors(fixed_id, value, 'add');
  }
  if(param == "remove_fixedID_editor") {
    var fixed_id = current_report.config_fixed_id;
    if(current_report.saveconfig && current_report.saveconfig.fixed_id) { fixed_id = current_report.saveconfig.fixed_id; }
    //if(value == "") {
    //  var input1 = document.getElementById("configuration_fixedID_user_input");
    //  if(input1) { value = input1.value; }
    //}
    reportsChangeFixIdEditors(fixed_id, value, 'remove');
  }
  
  if(param == "autogen-uuid") {
    reportsSaveConfigUUIDAutogen(); //syncronous GET to webservices
    reportsSaveConfigPanel(); //refresh
  }
  
  if(param == "cancel") {
    saveConfigDiv.innerHTML ="";
    current_report.saveconfig = undefined;
    current_report.modified = false;
    current_report.saveConfigXHR = undefined;
  }
  
  if(param == "accept") {
    current_report.saveConfigXHR = undefined;
    reportsUploadPageConfigXML();
    saveConfigDiv.innerHTML ="";
  }
}


function reportsSaveConfigUUIDAutogen() {
  //uses webservices to generate UUID server-side
  var url = eedbConfigCGI + "?mode=validate_uuid";
  
  var saveConfigXHR=GetXmlHttpObject();
  saveConfigXHR.open("GET", url, false);  //synchronous
  saveConfigXHR.send(null);

  if(saveConfigXHR.readyState!=4) return;
  if(saveConfigXHR.status!=200) { return; }
  if(saveConfigXHR.responseXML == null) { return; }

  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  
  var xml_uuid = xmlDoc.getElementsByTagName("config_uuid");
  var xml_validation = xmlDoc.getElementsByTagName("validation_status");

  if(xml_uuid && xml_uuid.length>0 && xml_validation && xml_validation.length>0) {
    var validation = xml_validation[0].firstChild.nodeValue;
    var uuid = xml_uuid[0].firstChild.nodeValue;
    if(validation == "autogen_uuid") {
      current_report.saveconfig.fixed_id = uuid;
      current_report.saveconfig.validation_status = "valid";
      current_report.saveconfig.validation_message = "new page";
      current_report.saveconfig.edit_fixed_id = false;
    }
  }
}


function reportsSaveConfigValidateUserPageEditing() {
  console.log("reportsSaveConfigValidateUserPageEditing");
  if(current_report.saveconfig.validation_status != "checking") { return; }
  
  if(!current_report.saveconfig.fixed_id) {
    console.log("reportsSaveConfigValidateUserPageEditing empty fixed_id");
    current_report.saveconfig.edit_fixed_id = false;
    current_report.saveconfig.validation_status = "valid";
    current_report.saveconfig.validation_message = "no fixed ID";
    return;
  }
  
  current_report.saveconfig.fixed_id_owner = false;
  
  var paramXML = "<zenbu_query><mode>validate_uuid</mode>\n";
  paramXML += "<uuid>"+current_report.saveconfig.fixed_id+"</uuid>";
  paramXML += "</zenbu_query>\n";
  //var url = eedbConfigCGI + "?mode=validate_uuid;uuid=" + current_report.saveconfig.fixed_id;
  
  var saveConfigXHR=GetXmlHttpObject();
  current_report.saveConfigXHR = saveConfigXHR;

  //saveConfigXHR.open("GET", url, false);  //synchronous
  //saveConfigXHR.send(null);
  //console.log("sent "+url);

  saveConfigXHR.onreadystatechange= reportsSaveConfigValidateUserPageEditingResponse;
  saveConfigXHR.open("POST", eedbConfigCGI, true);
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}

function reportsSaveConfigValidateUserPageEditingResponse() {
  console.log("reportsSaveConfigValidateUserPageEditingResponse");
  
  var saveConfigXHR = current_report.saveConfigXHR;
  
  if(!saveConfigXHR || (saveConfigXHR.readyState!=4) || (saveConfigXHR.status!=200) || (saveConfigXHR.responseXML == null)) {
    current_report.saveconfig.validation_status = "ws-error";
    return;
  }

  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { current_report.saveconfig.validation_status = "ws-error"; return; }
  console.log("reportsSaveConfigValidateUserPageEditingResponse: ok can parse response");

  var uuid = "";
  var xml_uuid = xmlDoc.getElementsByTagName("config_uuid");
  if(xml_uuid && xml_uuid.length>0) { uuid = xml_uuid[0].firstChild.nodeValue; }

  var validation = "";
  var xml_validation = xmlDoc.getElementsByTagName("validation_status");
  if(xml_validation && xml_validation.length>0) { validation = xml_validation[0].firstChild.nodeValue; }

  var check_status = "";
  var xml_check_status = xmlDoc.getElementsByTagName("check_status");
  if(xml_check_status && xml_check_status.length>0) { check_status = xml_check_status[0].firstChild.nodeValue; }

  var config_type = "";
  var xml_config_type = xmlDoc.getElementsByTagName("config_type");
  if(xml_config_type && xml_config_type.length>0) { config_type = xml_config_type[0].firstChild.nodeValue; }

  var message = "";
  var xml_message = xmlDoc.getElementsByTagName("validation_message");
  if(xml_message && xml_message.length>0) { message = xml_message[0].firstChild.nodeValue; }

  console.log("reportsSaveConfigValidateUserPageEditingResponse uuid="+uuid+"  valid="+validation+"  config_type=["+config_type+"]  message["+message+"]");

  if(config_type!="" && config_type!="REPORT") {
    current_report.saveconfig.validation_status = "invalid";
    current_report.saveconfig.validation_message = "configuration ID exists and is not a Reports page";
  }
  else if(uuid && validation) {
    if(validation == "valid_new_uuid") {
      current_report.saveconfig.validation_status = "valid";
      current_report.saveconfig.validation_message = "new page";
    }
    if(validation == "no_user") {
      current_report.saveconfig.validation_status = "invalid";
      current_report.saveconfig.validation_message = "no user login";
    }
    if(validation == "exists_secured_editable") {
      current_report.saveconfig.validation_status = "valid";
      current_report.saveconfig.validation_message = "changes fixedID link";
      if(check_status == "fixed_id_owner") { current_report.saveconfig.fixed_id_owner = true; }
    }
    if(validation == "exists_secured_non_editable") {
      current_report.saveconfig.validation_status = "invalid";
      current_report.saveconfig.validation_message = "page read-only, user can not edit";
    }
    if(validation == "exists_security_fault") {
      current_report.saveconfig.validation_status = "invalid";
      current_report.saveconfig.validation_message = "page secured by other users, can not read or edit";
    }
  } else {
    current_report.saveconfig.validation_status = "invalid";
    current_report.saveconfig.validation_message = "could not validate security access";
  }
  
  current_report.saveconfig.edit_fixed_id = false;
  console.log("reportsSaveConfigValidateUserPageEditingResponse uuid="+uuid+"  status="+current_report.saveconfig.validation_status+"  message["+current_report.saveconfig.validation_message+"]");
  reportsSaveConfigPanel(); //refresh
}


function reportsFixedIdEditorManagementPanel(reload) {
  console.log("reportsFixedIdEditorManagementPanel");
  var global_layer_div = document.getElementById("global_panel_layer");
  if(!global_layer_div) { return; }

  var fixed_id = current_report.config_fixed_id;
  if(current_report.saveconfig && current_report.saveconfig.fixed_id) { fixed_id = current_report.saveconfig.fixed_id; }
  if(!fixed_id) { reportsSaveConfigPanel(); return; }
  console.log("reportsFixedIdEditorManagementPanel fixed_id["+fixed_id+"]");
  
  var xpos = current_report.saveconfig.xpos;
  var ypos = current_report.saveconfig.ypos;
  if(!xpos) {
    var e = window.event
    toolTipWidth=400;
    moveToMouseLoc(e);
    current_report.saveconfig.xpos = xpos = toolTipSTYLE.xpos;
    current_report.saveconfig.ypos = ypos = toolTipSTYLE.ypos + 10;
  }

  var divFrame = document.getElementById("zenbu_reports_fixed_id_editor_management_panel");
  if(!divFrame) {
    divFrame = document.createElement('div');
    divFrame.id = "zenbu_reports_fixed_id_editor_management_panel";
    global_layer_div.appendChild(divFrame);
    divFrame.setAttribute('style', "background-color:lightgray; text-align:left; "
                          +"border:inset; border-width:1px; padding: 7px 7px 7px 7px; "
                          +"z-index:100; "
                          +"position:absolute; left:"+ (xpos-800)+"px; top:"+(ypos+90)+"px;"
                          +"width:700px;"
                          );
    /*
    divFrame.setAttribute('style', "position:absolute; background-color:#FDFDFD; text-align:left; "
                          +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                          //+"left:" + ((winW/2)-250) +"px; top:200px; "
                          +"left:"+(xpos-400)+"px; top:"+(ypos)+"px; "
                          +"width:400px; z-index:90;"
                          );
    */
  }
  divFrame.innerHTML = ""; //clear
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Manage editors for fixedID : ";
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  tspan.innerHTML = fixed_id;
  
  //close button
  //tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onmousedown", "reportsSaveConfigPanel(); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //divFrame.style.width = "500px";
  //divFrame.style.left = (xpos-600)+"px";

  //--------
  if(reload) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 0px 20px; color:#B22222; font-size:10px;");
    div1.innerHTML = "loading.........";
    reportsLoadFixIdEditors(fixed_id);
    return;
  }

  //----------
  var modeDiv = divFrame.appendChild(document.createElement('div'));
  modeDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var label1 = modeDiv.appendChild(document.createElement('span'));
  label1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  label1.innerHTML ="Editor mode :";

  if(!current_report.saveconfig.fixedID_editor_mode) { current_report.saveconfig.fixedID_editor_mode = "OWNER_ONLY"; }
  var editor_mode = current_report.saveconfig.fixedID_editor_mode;
  //console.log("datasource_mode : "+datasource_mode);
  
  var radio1 = modeDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "_fixedID_editor_mode");
  radio1.setAttribute("value", "OWNER_ONLY");
  if(editor_mode == "OWNER_ONLY") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportsSaveConfigPanelParam('fixedID_editor_mode', this.value);");
  tspan = modeDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "owner only";
  
  radio1 = modeDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "_fixedID_editor_mode");
  radio1.setAttribute("value", "COLLABORATORS");
  if(editor_mode == "COLLABORATORS") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportsSaveConfigPanelParam('fixedID_editor_mode', this.value);");
  tspan = modeDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "shared collaboration members";

  radio1 = modeDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "_fixedID_editor_mode");
  radio1.setAttribute("value", "USER_LIST");
  if(editor_mode == "USER_LIST") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportsSaveConfigPanelParam('fixedID_editor_mode', this.value);");
  tspan = modeDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "specified user list";

  if(editor_mode != "USER_LIST") { return; }
  
  // --------
  //divFrame.style.width = "700px";
  //divFrame.style.left = (xpos-800)+"px";

  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 0px 0px; font-size:10px;");
  div1.innerHTML = "add new user to list of people able to edit this fixedID redirection link.";
  //div1.innerHTML += "<br> If user is not in system, ZENBU will send email inviting them to create an account";
  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 10px 0px;");
  var label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "user's email address ";
  
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "configuration_fixedID_user_input";
  input1.setAttribute("type", "text");
  input1.setAttribute("size", "50");
  
  var button = div1.appendChild(document.createElement('button'));
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "reportsSaveConfigPanelParam('add_fixedID_editor', '');");
  button.innerHTML ="add";
  
  // --------
  divFrame.appendChild(document.createElement('hr'));
  
  if(!current_report.saveconfig.editors || current_report.saveconfig.editors.length==0) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 0px 20px; color:#B22222; font-size:10px;");
    div1.innerHTML = "no editors currently set...";
    return;
  }

  // now display as table
  var scrolldiv = divFrame.appendChild(document.createElement('div'));
  scrolldiv.setAttribute("style", "max-height:350px; width:100%;border:1px; margin-bottom:5px; overflow:auto;");
  
  var my_table = scrolldiv.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(document.createElement('thead')).appendChild(document.createElement('tr'));
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "row";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "nickname";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "email";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "status";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.width = '30px';
  th.innerHTML = "action";
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('row'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('nickname'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('email'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('status'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView', "width":"30px" }).update('action'));
  
  var tbody = my_table.appendChild(document.createElement('tbody'));
  var row=1;
  
  //then the editors
  for(i=0; i<current_report.saveconfig.editors.length; i++) {
    var user = current_report.saveconfig.editors[i];
    var user_ident = user.email;
    if(!user_ident) { user_ident = user.openid_array[0]; }
   
    var tr = tbody.appendChild(document.createElement('tr'));
    if(i%2 == 0) { tr.setAttribute("style", "background-color:#FDFDFD;"); }
    else         { tr.setAttribute("style", "background-color:#F0F0F0;"); }
   
    tr.appendChild(document.createElement('td')).innerHTML = row;  //row
    //var td = tr.appendChild(document.createElement('td').update(row));  //row
    tr.appendChild(document.createElement('td')).innerHTML = encodehtml(user.nickname);
    var td = tr.appendChild(document.createElement('td'));
    td.innerHTML = encodehtml(user.email);
    if(current_user.email == user.email) { td.setAttribute("style", "color:#25258e; font-weight:bold;"); }
   
    if(user.member_status == "OWNER") {
      tr.appendChild(document.createElement('td')).innerHTML = "owner";
      tr.appendChild(document.createElement('td')).innerHTML = "-";
    } else {
      td = tr.appendChild(document.createElement('td'));
      td = td.innerHTML = user.member_status.toLowerCase();

      var td = tr.appendChild(document.createElement('td'));
      td.setAttribute("style", "white-space:nowrap");
      var div2 = td.appendChild(document.createElement('div'));
      var button = div2.appendChild(document.createElement('button'));
      button.setAttribute("style", "font-size:10px; color:#B22222; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE;  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //button.setAttribute("onclick", "zenbuCollaborationRemoveUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
      button.setAttribute("onclick", "reportsSaveConfigPanelParam('remove_fixedID_editor', '"+user_ident+"');");
      button.innerHTML ="remove user";
      //var button = div2.appendChild(document.createElement('button'));
      //button.setAttribute("style", "font-size:10px; color:#B22222; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //button.setAttribute("onclick", "zenbuCollaborationMakeAdminUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
      //button.innerHTML ="make admin";
    }
    row++;
  }
  
}


function reportsLoadFixIdEditors(fixed_id) {
  console.log("reportsLoadFixIdEditors ["+fixed_id+"]");
  var paramXML = "<zenbu_query><mode>fixed_id_editors</mode>";
  if(fixed_id) { paramXML += "<fixed_id>"+fixed_id+"</fixed_id>"; }
  paramXML += "</zenbu_query>";

  current_report.saveconfig.editors = new Array;
  current_report.saveconfig.fixedID_editor_mode = "OWNER_ONLY"; //reset
  
  var saveConfigXHR=GetXmlHttpObject();
  current_report.saveConfigXHR = saveConfigXHR;

  saveConfigXHR.onreadystatechange=reportsParseFixIdEditorsResponse;
  saveConfigXHR.open("POST", eedbConfigCGI, true); //async
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}

function reportsChangeFixIdEditorMode(fixed_id, editor_mode) {
  console.log("reportsLoadFixIdEditors ["+fixed_id+"]");
  var paramXML = "<zenbu_query><mode>change_editor_mode</mode>";
  if(fixed_id) { paramXML += "<fixed_id>"+fixed_id+"</fixed_id>"; }
  if(editor_mode) { paramXML += "<editor_mode>"+editor_mode+"</editor_mode>"; }
  paramXML += "</zenbu_query>";
  
  current_report.saveconfig.editors = new Array;
  current_report.saveconfig.fixedID_editor_mode = "OWNER_ONLY"; //reset
  
  var saveConfigXHR=GetXmlHttpObject();
  current_report.saveConfigXHR = saveConfigXHR;
  
  saveConfigXHR.onreadystatechange=reportsParseFixIdEditorsResponse;
  saveConfigXHR.open("POST", eedbConfigCGI, true); //async
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}

function reportsChangeFixIdEditors(fixed_id, editor_email, submode) {
  console.log("reportsLoadFixIdEditors ["+fixed_id+"]");
  var paramXML = "<zenbu_query>";
  if(submode=="add") { paramXML += "<mode>add_editor</mode>"; }
  if(submode=="remove") { paramXML += "<mode>remove_editor</mode>"; }
  if(fixed_id) { paramXML += "<fixed_id>"+fixed_id+"</fixed_id>"; }
  if(editor_email) { paramXML += "<user_identity>"+editor_email+"</user_identity>"; }
  paramXML += "</zenbu_query>";
  
  current_report.saveconfig.editors = new Array;
  current_report.saveconfig.fixedID_editor_mode = "OWNER_ONLY"; //reset
  
  var saveConfigXHR=GetXmlHttpObject();
  current_report.saveConfigXHR = saveConfigXHR;
  
  saveConfigXHR.onreadystatechange=reportsParseFixIdEditorsResponse;
  saveConfigXHR.open("POST", eedbConfigCGI, true); //async
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}


function reportsParseFixIdEditorsResponse() {
  var saveConfigXHR = current_report.saveConfigXHR;
  if(saveConfigXHR == null) {
    return reportsFixedIdEditorManagementPanel(false);
  }

  if(saveConfigXHR.readyState!=4) { return; }
  if(saveConfigXHR.status!=200) { return; }
  if(saveConfigXHR.responseXML == null) { return reportsFixedIdEditorManagementPanel(false); }
  
  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { return reportsFixedIdEditorManagementPanel(false); }

  var modeXML = xmlDoc.getElementsByTagName("editor_mode");
  if(modeXML && modeXML.length>0) {
    current_report.saveconfig.fixedID_editor_mode = modeXML[0].firstChild.nodeValue;
  }

  var xmlEditors = xmlDoc.getElementsByTagName("editors");
  if(xmlEditors && xmlEditors.length>0) {
    var xmlUsers = xmlEditors[0].getElementsByTagName("eedb_user");
    for(i=0; i<xmlUsers.length; i++) {
      var user = eedbParseUserXML(xmlUsers[i]);
      current_report.saveconfig.editors.push(user);
    }
  }

  reportsFixedIdEditorManagementPanel(false);
}


//----------------------------------------------------
// 
// global settings panel
//
//----------------------------------------------------

function reportsGlobalSettingsPanel() {
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
  a1.setAttribute("onclick", "reportsChangeGlobalParameter('close'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
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
  widthInput.setAttribute("value", current_report.display_width);
  //widthInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportsChangeExpressRegionConfig('dwidth', this.value, this)}");
  widthInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportsChangeGlobalParameter('dwidth', this.value)}");

  //----------
  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(current_report.hide_compacted_tracks) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportsChangeGlobalParameter('compacted_tracks', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide compacted tracks";

  //----------
  //tdiv2 = leftdiv.appendChild(document.createElement('div'));
  //tcheck = tdiv2.appendChild(document.createElement('input'));
  //tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  //tcheck.setAttribute('type', "checkbox");
  //if(current_report.flip_orientation) { tcheck.setAttribute('checked', "checked"); }
  //tcheck.setAttribute("onclick", "reportsChangeGlobalParameter('flip_orientation', this.checked);");
  //tspan2 = tdiv2.appendChild(document.createElement('span'));
  //tspan2.innerHTML = "flip strand orientation";

  //tdiv2= rightdiv.appendChild(document.createElement('div'));
  //tcheck = tdiv2.appendChild(document.createElement('input'));
  //tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  //tcheck.setAttribute('type', "checkbox");
  //if(current_report.auto_flip) { tcheck.setAttribute('checked', "checked"); }
  //tcheck.setAttribute("onclick", "reportsChangeGlobalParameter('auto_flip', this.checked);");
  //tspan2 = tdiv2.appendChild(document.createElement('span'));
  //tspan2.innerHTML = "auto flip to centered feature";

  tdiv2= rightdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  if(current_report.nocache) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportsChangeGlobalParameter('nocache', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "global no caching";

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


function reportsChangeGlobalParameter(param, value) {
  var globalLayer = document.getElementById("global_panel_layer");
  if(globalLayer === undefined) { return; }
  if(!globalLayer) { return; }

  var need_to_reload = false;

  if(param =="dwidth") {
    var new_width = Math.floor(value);
    if(new_width < 640) { new_width=640; }
    if(new_width != current_report.display_width) { need_to_reload = true; }
    current_report.display_width = new_width;
    reportsInitParams.display_width = new_width;
  }

  if(param == "close") { globalLayer.innerHTML =""; }

  if(param == "new_report") {
    //clear previous elements
    current_report.elements = new Object(); //hash of elementID to element in this report
    var master_div = document.getElementById("zenbuReportsDiv");
    if(master_div) { master_div.innerHTML = ""; }
    current_report.reinitialize_page = true;  //will trigger a re-init
    current_report.view_config_loaded = true;
    current_report.view_config = null;
    current_report.configUUID = "";
    current_report.config_fixed_id = "";
    current_report.config_title = "new page";
    current_report.desc = "";
    current_report.config_creator = "";
    current_report.config_createdate = "";
    current_report.edit_page_configuration = true;
    reportsShowConfigInfo();
    reportsDisplayEditTools();
    reportsChangeDhtmlHistoryLocation();
    return;
  }
  if(param == "clone_report") {
    current_report.configUUID = "";
    current_report.config_fixed_id = "";
    current_report.config_creator = "";
    current_report.config_createdate = "";
    current_report.edit_page_configuration = true;
    reportsShowConfigInfo();
    reportsDisplayEditTools();
    reportsChangeDhtmlHistoryLocation();
  }
  if(param == "edit_report") {
    if(!current_user) {
      reportsGeneralWarn("Please login in order to edit this page.");
      eedbLoginAction("login");
    } else {
      current_report.edit_page_configuration = true;
      reportsShowConfigInfo();
      reportsDisplayEditTools();

      //reportsResetElements();
      for(var elementID in current_report.elements) {
        var reportElement = current_report.elements[elementID];
        if(!reportElement) { continue; }
        if(reportElement.load_on_page_init && (reportElement.datasource_mode=="source")) {
          //in user-mode (non-edit) sources are loaded with descxml so need to get fullxml now
          reportsLoadElement(elementID);
        }
      }

      reportsDrawElements();
      //TODO: might-reverse: reportsUpdateLayoutElements();
    }
  }
  if(param == "toggle_preview_report") {
    current_report.modified = true;
    current_report.edit_page_configuration = !current_report.edit_page_configuration;
    reportsShowConfigInfo();
    reportsDisplayEditTools();
    reportsDrawElements();
    //TODO: might-reverse: reportsUpdateLayoutElements();
  }
  if(param == "cancel_edit_report") {
    current_report.edit_page_configuration = false;
    reportsShowConfigInfo();
    reportsDisplayEditTools();
    reportsDrawElements();
    //TODO: might-reverse: reportsUpdateLayoutElements();
  }
  if(param == "save_report_edits") {
    reportsSaveConfigPanel();
  }
  
  //if(need_to_reload) { reloadRegion(); }
}


//===============================================================
//
// edit/add-tools/save controls section
//
//===============================================================

function reportsDisplayEditTools() {
  var editToolsLayer = document.getElementById("zenbu_reports_edit_tools");  //this is fixed in the index.html
  if(!editToolsLayer) { return; }
  if(editToolsLayer === undefined) { return; }

  var master_div = document.getElementById("zenbuReportsDiv");  //master div for all panels
  var masterRect = master_div.getBoundingClientRect();

  var toolPanelElement = current_report.elements["zenbu_reports_tools_panel"];
  if(!toolPanelElement) {
    toolPanelElement = reportsNewReportElement("tools_panel","zenbu_reports_tools_panel");
    toolPanelElement.layout_mode = "absolute";
    toolPanelElement.title = "tools panel";
    toolPanelElement.datasource_mode = "";  //feature, edge, shared_element
    toolPanelElement.resetable = false;
    toolPanelElement.content_width = 150;
    toolPanelElement.content_height = 100;
    toolPanelElement.auto_content_height = true;
    toolPanelElement.layout_xpos = masterRect.right - 200;
    toolPanelElement.layout_ypos = masterRect.top + 20;
    toolPanelElement.widget_search = false;
    toolPanelElement.widget_filter = false;
    toolPanelElement.widget_columns = false;
    toolPanelElement.loading = false;
    reportsDrawElement(toolPanelElement.elementID);
  }
  
  editToolsLayer.innerHTML = ""; //always clear this and rebuild

  //global 'edit' mode toggle, like editing wiki page
  if(!current_report.edit_page_configuration) {
    //TODO: if user can edit, then allow with an edit button, need to expand beyond the email== check
    //if(current_user && current_report.view_config && (current_user.email==current_report.view_config.owner_identity)) { 
    if(current_user && current_report.view_config && !current_report.modified) {
      if(!current_report.config_fixed_id || (current_user.email==current_report.view_config.owner_identity) ||
        current_report.fixed_id_editor_status=="fixed_id_editor" || current_report.fixed_id_editor_status=="fixed_id_owner") { 
        button = editToolsLayer.appendChild(document.createElement("input"));
        button.type = "button";
        button.className = "slimbutton";
        //button.setAttribute("style", "font-size:11px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
        button.value = "edit page";
        button.innerHTML = "edit page";
        button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
        button.setAttribute("onclick", "reportsChangeGlobalParameter('edit_report');");
      } else {
        button = editToolsLayer.appendChild(document.createElement("input"));
        button.type = "button";
        button.className = "slimbutton";
        //button.setAttribute("style", "font-size:11px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
        button.value = "clone page";
        button.innerHTML = "clone page";
        button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
        button.setAttribute("onclick", "reportsChangeGlobalParameter('clone_report');");
      }
    }

    if(!current_report.modified) {
      button = editToolsLayer.appendChild(document.createElement("input"));
      button.type = "button";
      button.className = "slimbutton";
      //button.setAttribute("style", "font-size:11px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.value = "create new page";
      button.innerHTML = "create new page";
      button.setAttribute("onclick", "reportsChangeGlobalParameter('new_report');");
    }
    if(current_report.modified) {
      button = editToolsLayer.appendChild(document.createElement("input"));
      button.type = "button";
      button.className = "slimbutton";
      //button.setAttribute("style", "font-size:11px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.value = "exit preview: edit page";
      button.innerHTML = "exit preview: edit page";
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.setAttribute("onclick", "reportsChangeGlobalParameter('toggle_preview_report');");
    }

    reportsDrawElement(toolPanelElement.elementID);
    return;
  }
  
  //if editing page then show the save/cancel buttons and display the tools panel
  tdiv = editToolsLayer.appendChild(document.createElement('div'));
  tdiv.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  if(!current_user) { 
    tdiv.setAttribute("onmouseover", "eedbMessageTooltip(\"please login to save pages\",100);");
  }

  button = tdiv.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "slimbutton";
  //button.setAttribute("style", "font-size:11px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"save report page\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "reportsChangeGlobalParameter('save_report_edits');");
  button.value = "save report changes";
  button.innerHTML = "save report changes";
  if(!current_user) { button.setAttribute('disabled', "disabled"); }

  button = tdiv.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "slimbutton";
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "reportsChangeGlobalParameter('toggle_preview_report');");
  button.value = "preview";
  button.innerHTML = "preview";
  //if(!current_report.modified) { button.setAttribute('disabled', "disabled"); }

  //if(!current_report.modified) {
  //  button = tdiv.appendChild(document.createElement("button"));
  //  button.setAttribute("style", "font-size:11px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  //  button.setAttribute("onclick", "reportsChangeGlobalParameter('cancel_edit_report');");
  //  button.innerHTML = "cancel editing";
  //}

  reportsDrawElement(toolPanelElement.elementID);
}


function reportsDrawToolsPanel(toolPanelElement) {
  if(!toolPanelElement) { return; }
  
  var main_div = toolPanelElement.main_div;
  if(!main_div) { return; }

  if(!current_report.edit_page_configuration) {
    main_div.style.display = "none";
    return;
  }
  
  main_div.style.display  = "block";  //make sure it is displayed
  main_div.style.overflow = "visible";
  main_div.style.resize   = "none";

  //
  //create the tools panel content
  //
  
  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('table');");
  button.innerHTML = "Table";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('treelist');");
  button.innerHTML = "TreeList";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('chart');");
  button.innerHTML = "Chart";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('circos');");
  button.innerHTML = "Circos";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('cytoscape');");
  button.innerHTML = "Cytoscape";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('genomewide');");
  button.innerHTML = "GenomeWide";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('category');");
  button.innerHTML = "Category";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('html');");
  button.innerHTML = "HTML";

  //tdiv = main_div.appendChild(document.createElement('div'));
  //tdiv.setAttribute("style", "width:80%; margin:auto; ");
  //button = tdiv.appendChild(document.createElement("button"));
  //button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  //button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('category', 'piechart');");
  //button.innerHTML = "Pie chart";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('zenbugb');");
  button.innerHTML = "Zenbu genome browser";

  main_div.appendChild(document.createElement('hr'));

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('layout', 'row');");
  button.innerHTML = "row layout";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('layout', 'col');");
  button.innerHTML = "column layout";

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "width:80%; margin:auto; ");
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-top:10px; width:100%; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"create element\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onmousedown", "reportsToolsPanelCreateElement('layout', 'tab');");
  button.innerHTML = "tab layout";

}


function reportsToolsPanelCreateElement(element_type, sub_type) {
  var master_div = document.getElementById("zenbuReportsDiv");  //master div for all panels
  if(!master_div) { return; }
  var masterRect = master_div.getBoundingClientRect();

  if(!current_report.modified) {
    current_report.modified = true;
    reportsDisplayEditTools();
  }

  if(element_type == "layout") {
    var layoutElement = reportsNewLayoutElement(sub_type);
    //TODO: need ability to move layouts around
    return;
  }
  
  var reportElement = reportsNewReportElement(element_type);

  if(sub_type && ((reportElement.element_type == "category") || (reportElement.element_type == "chart"))){
    reportElement.display_type = sub_type;
  }

  var e = window.event;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  console.log("create new element ["+reportElement.elementID+"] at cursor x="+xpos+" ypos="+ypos);
  
  xpos -= reportElement.content_width * 0.5;
  ypos -= 15;
  
  reportElement.layout_mode = "absolute";
  reportElement.layout_xpos = xpos;
  reportElement.layout_ypos = ypos;
  
  reportsDrawElement(reportElement.elementID);

  reportElementToggleLayoutDrag(reportElement, "start");
}

//===============================================================
//
// reportElement fetch and parse section (features and edges)
//
//===============================================================

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


function reportsSendPendingXHRs() {
  //document.getElementById("message").innerHTML += " reportsSendPendingXHRs";
  var pending_count =0;
  for(var elementID in reports_pending_XHRs) { 
    if(reports_active_XHRs[elementID] == null) { pending_count++; }
  }
  var active_count =0;
  for(var elementID in reports_active_XHRs) { active_count++; }
  //document.getElementById("message").innerHTML += " pendingXHRs[" + pending_count + "]  activeXHRs[" + active_count + "]";
  if(pending_count==0) { 
    //setTimeout("reportsSendPendingXHRs();", 10000); //10 seconds
    return; 
  }

  if(active_count>=maxActiveXHRs) { 
    setTimeout("reportsSendPendingXHRs();", 1000); //1 second
    return; 
  }
  for(var elementID in reports_pending_XHRs) { 
    if(reports_active_XHRs[elementID] == null) { 
      var xhrObj = reports_pending_XHRs[elementID]; 
      if(xhrObj.xhr != null) { xhrObj.xhr=null; }
      reports_pending_XHRs[elementID] = null; 
      delete reports_pending_XHRs[elementID]; 
      reports_active_XHRs[elementID] = xhrObj;
      reportsSendElementXHR(xhrObj);
      active_count++;
    }
    if(active_count>=maxActiveXHRs) { return; }
  }
}


function reportsSendElementXHR(xhrObj) {
  if(xhrObj == null) { return; }
  //document.getElementById("message").innerHTML += "  send[" + xhrObj.elementID + "]";

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  xhrObj.xhr = xhr;

  //funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { reportsXHResponse(id); };}(xhrObj.elementID);

  var webURL = eedbSearchCGI;
  if(xhrObj.mode == "region") { webURL = eedbRegionCGI; }

  xhr.open("POST", webURL, true);
  xhr.setRequestHeader("Content-Type", "text/plain; charset=UTF-8;");
  //xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", xhrObj.paramXML.length);
  //xhr.setRequestHeader("Content-encoding", "x-compress, x-gzip, gzip");
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(xhrObj.paramXML);
}


function reportsXHResponse(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }

  var xhrObj = reports_active_XHRs[elementID];
  if(xhrObj == null) {  
    //document.getElementById("message").innerHTML += elementID + ' no xhrObj';
    delete reports_active_XHRs[elementID];
    reportsDrawElement(elementID);
    reportElement.loading = false;
    setTimeout("reportsSendPendingXHRs();", 30); //30msec
    return; 
  }
  //these tests are to make sure the XHR has fully returned
  var xhr = xhrObj.xhr;
  if(xhr == null) { 
    //document.getElementById("message").innerHTML += elementID + ' no xhr ';
    return;
  }

  //document.getElementById("message").innerHTML += " ["+elementID + '-rs'+xhr.readyState+ "-st"+xhr.status + "]";
  if(xhr.readyState!=4) { return; }

  if(xhr.status>=500) { 
    //document.getElementById("message").innerHTML = "query error 500 ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    xhrObj.xhr = null;
    reports_active_XHRs[elementID] = null;
    delete reports_active_XHRs[elementID];
    reportElement.loading = false;
    reportElement.load_retry = -1;
    reportsDrawElement(elementID);
    return; 
  }

  if(xhr.status!=200) { 
    //document.getElementById("message").innerHTML += "query warn 200 ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    return; 
  }
  if(xhr.responseXML == null) { 
    //document.getElementById("message").innerHTML += "query error no response ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    xhrObj.xhr = null;
    reports_active_XHRs[elementID] = null;
    delete reports_active_XHRs[elementID];
    reportElement.loading = false;
    reportElement.load_retry = -1;
    reportsDrawElement(elementID);
    return; 
  }

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    //document.getElementById("message").innerHTML += "query error no xmlDoc ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    xhrObj.xhr = null;
    reports_active_XHRs[elementID] = null;
    delete reports_active_XHRs[elementID];
    reportElement.loading = false;
    reportElement.load_retry = -1;
    reportsDrawElement(elementID);
    return;
  }
  //document.getElementById("message").innerHTML += ' draw:' + elementID;

  reportElement.loading = false;

  //TODO:
  //document.getElementById("message").innerHTML += ' got response, ready to parse XML [' + elementID +"]";
  reportsParseElementData(reportElement, xhrObj);
  //gLyphsRenderTrack(reportElement);

  //all information is now transfered into objects so
  //can delete XML and XHRs
  xhrObj.xhr = null;
  reports_active_XHRs[elementID] = null;
  delete reports_active_XHRs[elementID];
 
  reportElement.dataLoaded = true;
  reportElement.load_retry = 0;
  reportElement.loaded_timestamp = Date.now();

  reportsPostprocessElement(elementID);
  reportsDrawElement(elementID);

  reportElementTriggerCascade(reportElement, "load");  //on_trigger==load happens after element loads/postprocess

  //see if there are anymore requests pending to be sent
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
}


function reportsParseElementData(reportElement, xhrObj) {
  //this is the call back function after a new XHR has completed
  //which converts the XML into JSON objects so the XHR and XML
  //can deleted
  var starttime = new Date();

  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;
  //document.getElementById("message").innerHTML += " parseElementData["+xhrObj.elementID+"]";
  console.log("reportsParseElementData:"+reportElement.elementID);

  reportElement.features = new Object();
  reportElement.feature_array = new Array();

  reportElement.edge_array = new Array();

  if(!reportElement.datasources) { reportElement.datasources = new Object(); }
  reportElement.sources_array = new Array();
  if(!reportElement.datatypes) {  reportElement.datatypes   = new Object(); }
  
  reportElement.security_error = "";
  var security_error = xmlDoc.getElementsByTagName("security_error");
  if(security_error && security_error.length>0) {
    reportElement.security_error = security_error[0].getAttribute("blocked");
    return;
  }

  //flag the dtypes to remove those not valid with this load
  if(reportElement.datatypes) {
    for(var dtype in reportElement.datatypes) {
      var dtype_col = reportElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type == "hyperlink") { continue; }
      if(dtype_col.col_type == "row") { continue; }
      if(dtype_col.filtered) { continue; }
      if(dtype_col.visible) { continue; }
      dtype_col.dtype_valid = false;
    }
  }

  // get the datasources for this reportElement
  var sources = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<sources.length; i++) {
    var sourceDOM  = sources[i];
    var sourceID   = sourceDOM.getAttribute("id");
    var source = reportElement.datasources[sourceID];
    source = eedbParseExperimentData(sourceDOM, source);
    reportElement.datasources[source.id] = source;
  }
  var sources = xmlDoc.getElementsByTagName("featuresource");
  for(var i=0; i<sources.length; i++) {
    var sourceDOM  = sources[i];
    var sourceID   = sourceDOM.getAttribute("id");
    var source = reportElement.datasources[sourceID];
    //if(source) { console.log("reparse source ["+sourceID+"]"); } else { console.log("new source ["+sourceID+"] to parse"); }
    source = eedbParseFeatureSourceData(sourceDOM, source);
    reportElement.datasources[source.id] = source;
  }
  var sources = xmlDoc.getElementsByTagName("edgesource");
  for(var i=0; i<sources.length; i++) {
    var sourceDOM  = sources[i];
    var sourceID   = sourceDOM.getAttribute("id");
    var source = reportElement.datasources[sourceID];
    //if(source) { console.log("reparse source ["+sourceID+"]"); } else { console.log("new source ["+sourceID+"] to parse"); }
    source = eedbParseEdgeSourceXML(sourceDOM, source);
    reportElement.datasources[source.id] = source;
  }
  //build source_array from the datasources hash
  for(var sourceID in reportElement.datasources) {
    var source = reportElement.datasources[sourceID];
    if(!source) { continue; }
    reportElement.sources_array.push(source);
    //console.log("source ["+source.name+"] ["+source.id+"] desc="+source.mdata["description"]+"]");
  }
  //console.log("sources_array "+ reportElement.sources_array.length +" sources");

  //sources mode
  if(reportElement.datasource_mode == "source") {
    //console.log("add default source columns");
    reportElementAddDatatypeColumn(reportElement, "name", "name", true);
    reportElementAddDatatypeColumn(reportElement, "category", "category", true);
    reportElementAddDatatypeColumn(reportElement, "eedb:assembly_name", "assembly", true);
    reportElementAddDatatypeColumn(reportElement, "description", "description", true);
    reportElementAddDatatypeColumn(reportElement, "import_date", "import_date", true);
    reportElementAddDatatypeColumn(reportElement, "owner_identity", "owner_identity", true);
    reportElementAddDatatypeColumn(reportElement, "owner_import_date", "owner_import_date", true);
    reportElementAddDatatypeColumn(reportElement, "platform", "platform", true);
    reportElementAddDatatypeColumn(reportElement, "source_class", "source_class", true);
    //reportElementAddDatatypeColumn(reportElement, "feature_count", "feature_count", true);
    //reportElementAddDatatypeColumn(reportElement, "series_point", "series_point", true);

    for(var i=0; i<reportElement.sources_array.length; i++) {
      var source  = reportElement.sources_array[i];
      if(!source) { continue; }
      source.filter_valid = true;
      //if(source.className == "experiment") { }
      for(var tag in source.mdata) { //new common mdata[].array system
        var t_col = reportElementAddDatatypeColumn(reportElement, tag, tag, false);
        //t_col.visible = false;
      }
    }
  }
  
  //read the features
  var features = xmlDoc.getElementsByTagName("feature");
  var dtype_score = null;
  var dtype_name = null;
  var dtype_category = null;
  var dtype_source_name = null;
  var dtype_location_link = null;
  var dtype_location_string = null;
  
  if(features.length>0) {
    if(reportElement.datasource_mode == "edge") {
      reportElementAddDatatypeColumn(reportElement, "f1.name", "name", true);
      reportElementAddDatatypeColumn(reportElement, "f1.category", "category", false);
      reportElementAddDatatypeColumn(reportElement, "f1.source_name", "source_name", false);
      reportElementAddDatatypeColumn(reportElement, "f1.location_link", "location", false);
      reportElementAddDatatypeColumn(reportElement, "f1.location_string", "location", false);
      
      reportElementAddDatatypeColumn(reportElement, "f2.name", "name", true);
      reportElementAddDatatypeColumn(reportElement, "f2.category", "category", false);
      reportElementAddDatatypeColumn(reportElement, "f2.source_name", "source_name", false);
      reportElementAddDatatypeColumn(reportElement, "f2.location_link", "location", false);
      reportElementAddDatatypeColumn(reportElement, "f2.location_string", "location", false);
    }
  }

  for(var i=0; i<features.length; i++) {
    var featureDOM  = features[i];
    var feature = eedbParseFeatureFullXML(featureDOM);
    if(!feature) { continue; }
    feature.filter_valid = true;
    feature.search_match = false;
    feature.f1_edge_count = 0;
    feature.f2_edge_count = 0;

    //connect datasource
    //console.log("feature ["+feature.name+"] source_id["+feature.source_id+"]");
    if(reportElement.datasources[feature.source_id]) { 
      //source is in the datasource cache so use that one
      feature.source = reportElement.datasources[feature.source_id];
      //console.log("found source ["+feature.source.name+"] ["+feature.source.id+"]");
    } else if(feature.source) {
      //link the one loaded with the feature in so we can fully load later
      reportElement.datasources[feature.source_id] = feature.source; 
      reportElement.sources_array.push(feature.source);
    }

    //FANTOM6 cat metadata hack
    if(feature.mdata && feature.mdata["CAT_geneClass"] && !feature.description) {
      feature.description = feature.mdata["geneName"] + " ";
      feature.summary = feature.mdata["HGNC_name"];
      feature.summary += ", " + feature.mdata["geneType"];
      if(feature.mdata["CAT_geneClass"]) { feature.summary += ", " + feature.mdata["CAT_geneClass"][0]; }
      if(feature.mdata["alias_name"]) { feature.summary += ", " + feature.mdata["alias_name"][0]; }
      if(feature.mdata["prev_name"]) { feature.summary += ", " + feature.mdata["prev_name"][0]; }
      if(feature.mdata["alias_symbol"]) { feature.summary += ", " + feature.mdata["alias_symbol"][0]; }
      if(feature.mdata["prev_symbol"]) { feature.summary += ", " + feature.mdata["prev_symbol"][0]; }
    }
    
    //mdata to column datatype
    if(reportElement.datasource_mode == "feature") {
      if(!dtype_name && feature.name && (feature.source.name!=feature.name)) { 
        dtype_name = reportElementAddDatatypeColumn(reportElement, "name", "name", true);
      }
      if(!dtype_category && feature.source && feature.source.category) {
        dtype_category = reportElementAddDatatypeColumn(reportElement, "category", "category", true); 
      }
      if(!dtype_source_name && feature.source && feature.source.name) {
        dtype_source_name = reportElementAddDatatypeColumn(reportElement, "source_name", "source_name", true); 
      }
      if(!dtype_location_string && feature.chromloc) {
        dtype_location_link = reportElementAddDatatypeColumn(reportElement, "location_link", "location", false);
        dtype_location_string = reportElementAddDatatypeColumn(reportElement, "location_string", "location", false); 
      }
      for(var tag in feature.mdata) { //new common mdata[].array system
        if(tag=="keyword") { continue; }
        if(tag=="eedb:display_name") { continue; }
        var t_col = reportElementAddDatatypeColumn(reportElement, tag, tag, false);
      }
      //feature score
      if(feature.score && feature.score!=0) {
        if(!dtype_score) {
          dtype_score = reportElementAddDatatypeColumn(reportElement, "bedscore", "bedscore", false);
          dtype_score.col_type = "signal";
        }
        if((dtype_score.min_val == 0) && (dtype_score.max_val == 0)) {
          dtype_score.min_val = feature.score;
          dtype_score.max_val = feature.score;
        }
        if(feature.score < dtype_score.min_val) { dtype_score.min_val = feature.score; }
        if(feature.score > dtype_score.max_val) { dtype_score.max_val = feature.score; }
      }
      //feature.expression.data_types
      if(feature.expression) {
        for(var eidx=0; eidx<feature.expression.length; eidx++) {
          var expr = feature.expression[eidx];
          if(!expr) { continue; }
          var dtype = expr.datatype;
          if(!dtype) { continue; }
          var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, dtype, false);
          dtype_col.col_type = "signal";
          //console.log("feature_expression "+dtype+" total="+expr.total);
          if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
            dtype_col.min_val = expr.total;
            dtype_col.max_val = expr.total;
            //console.log("dtype_col "+dtype+"set first min/max");
          }
          if(expr.total < dtype_col.min_val) { dtype_col.min_val = expr.total; }
          if(expr.total > dtype_col.max_val) { dtype_col.max_val = expr.total; }
  
          //console.log("dtype_col "+dtype_col.col_type+" "+dtype_col.datatype+" min:"+dtype_col.min_val+" max:"+dtype_col.max_val);
        }
        /*
        expression.expID      = expID;
        expression.datatype   = expressXML.getAttribute("datatype");
        expression.count      = 1;
        expression.dup        = 1;
        expression.sense      = 0;
        expression.antisense  = 0;
        expression.total      = 0;  //value for either/both strands
        feature.expression.push(expression);
        */
      }
    }

    reportElement.feature_array.push(feature);
    reportElement.features[feature.id] = feature;
  }
  //document.getElementById("message").innerHTML += " read "+ reportElement.feature_array.length +" features,";
  //document.getElementById("message").innerHTML += " read "+ reportElement.sources_array.length +" sources,";

  //read the edges
  var edges = xmlDoc.getElementsByTagName("edge");
  for(var i=0; i<edges.length; i++) {
    var edgeDOM  = edges[i];
    var edge     = eedbParseEdgeXML(edgeDOM);
    edge.filter_valid = true;
    edge.search_match = false;
    //connect datasource and features
    if(reportElement.datasources[edge.source_id]) { 
      edge.source = reportElement.datasources[edge.source_id];
    }
    if(reportElement.features[edge.feature1_id]) { 
      edge.feature1 = reportElement.features[edge.feature1_id];
      edge.feature1.f1_edge_count++;
      for(var tag in edge.feature1.mdata) { //new common mdata[].array system
        if(tag=="keyword") { continue; }
        if(tag=="eedb:display_name") { continue; }
        var dtype = "f1."+tag;
        var t_col = reportElementAddDatatypeColumn(reportElement, dtype, tag);
      }
      //feature1.expression.data_types
      if(edge.feature1.expression) {
        for(var eidx=0; eidx<edge.feature1.expression.length; eidx++) {
          var expr = edge.feature1.expression[eidx];
          if(!expr) { continue; }
          if(!expr.datatype) { continue; }
          var dtype = "f1."+expr.datatype;
          var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, expr.datatype, false);
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
    if(reportElement.features[edge.feature2_id]) { 
      edge.feature2 = reportElement.features[edge.feature2_id];
      edge.feature2.f2_edge_count++;
      //console.log("connect edge.feature2 ["+edge.feature2_id+"] name["+edge.feature2.name+"]");
      for(var tag in edge.feature2.mdata) { //new common mdata[].array system
        if(tag=="keyword") { continue; }
        if(tag=="eedb:display_name") { continue; }
        var dtype = "f2."+tag;
        var t_col = reportElementAddDatatypeColumn(reportElement, dtype, tag);
      }
      //feature2.expression.data_types
      if(edge.feature2.expression) {
        for(var eidx=0; eidx<edge.feature2.expression.length; eidx++) {
          var expr = edge.feature2.expression[eidx];
          if(!expr) { continue; }
          if(!expr.datatype) { continue; }
          var dtype = "f2."+expr.datatype;
          var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, expr.datatype, false);
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
      var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, dtype, true);
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
    
    //edge metadata
    for(var tag in edge.mdata) { //new common mdata[].array system
      if(tag=="keyword") { continue; }
      if(tag=="eedb:display_name") { continue; }
      var t_col = reportElementAddDatatypeColumn(reportElement, tag, tag, false);
    }

    //edge metadata
    for(var tag in edge.mdata) { //new common mdata[].array system
      if(tag=="keyword") { continue; }
      if(tag=="eedb:display_name") { continue; }
      var t_col = reportElementAddDatatypeColumn(reportElement, tag, tag, false);
    }

    reportElement.edge_array.push(edge);
  }
  console.log("reportsParseElementData ["+reportElement.elementID+"] read "+reportElement.feature_array.length+" features; "+ reportElement.edge_array.length +" edges");

  var dtype_msg = "";
  reportElement.dtype_columns = new Array();
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.dtype_valid) { //remove it
      reportElement.datatypes[dtype] = null;
      //delete reportElement.datatypes[dtype];
      continue; 
    }

    reportElement.dtype_columns.push(dtype_col);
    if(!reportElement.dtype_filter_select && ((dtype_col.col_type == "weight") || (dtype_col.col_type == "signal"))) {
      reportElement.dtype_filter_select = dtype; 
    }
    if(!dtype_col.filtered) {
      dtype_col.filter_min = "min";
      dtype_col.filter_max = "max";
    }
    dtype_msg += "  dtype_col "+dtype_col.col_type+" "+dtype_col.datatype+" min:"+dtype_col.min_val+" max:"+dtype_col.max_val+"\n";
  }
  //console.log("reportsParseElementData final dtype_columns: \n"+dtype_msg);

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportsParseElementData ["+reportElement.elementID+"] "+(runtime)+"msec");
}


function reportElementAddDatatypeColumn(reportElement, dtype, title, visible) {
  if(!reportElement) { return; }

  if(reportElement.element_type == "treelist") {
    dtype = dtype.replace(/^f1\./, '');
    dtype = dtype.replace(/^f2\./, '');
  }
  
  if(!reportElement.dtype_columns) { reportElement.dtype_columns = new Array; }
  var dtype_col = reportElement.datatypes[dtype];
  if(!dtype_col) {
    dtype_col = new Object;
    dtype_col.datatype = dtype;
    if(title) { dtype_col.title = title; }
    else { dtype_col.title = dtype; }
    dtype_col.colnum = reportElement.dtype_columns.length + 1;
    dtype_col.signal_order = reportElement.dtype_columns.length + 1;
    dtype_col.col_type = "mdata";
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

    reportElement.datatypes[dtype] = dtype_col;
    reportElement.dtype_columns.push(dtype_col);
    //console.log("reportElementAddDatatypeColumn "+reportElement.elementID+" new "+dtype_col.datatype);
  }
  dtype_col.dtype_valid = true;
  return dtype_col;
}


function reportElementEdgeCheckValidFilters(reportElement, edge) {
  if(!reportElement) { return false; }
  if(!edge) { return true; }
  if(edge.classname != "Edge") { return true; }

  //edge.filter_valid = false;
  //console.log("reportElementEdgeCheckValidFilters f1:"+edge.feature1.name+"  f2:"+edge.feature2.name);
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    if(dtype_col.col_type != "weight") { continue; }

    var weights = edge.weights[dtype];
    if(!weights) { continue; }
    
    for(var j=0; j<weights.length; j++) {
      var w1 = weights[j].weight;
      if(dtype_col.filter_abs) { w1 = Math.abs(w1); }
      if((dtype_col.filter_min!="min") && (w1 < dtype_col.filter_min)) { edge.filter_valid = false; return false; }
      if((dtype_col.filter_max!="max") && (w1 > dtype_col.filter_max)) { edge.filter_valid = false; return false; }
    }
  }

  //then check the features for signal filters
  if(!reportElementCheckValidSignalFilters(reportElement, edge.feature1)) { edge.filter_valid = false; return false; }
  if(!reportElementCheckValidSignalFilters(reportElement, edge.feature2)) { edge.filter_valid = false; return false; }

  //edge.filter_valid = true;
  return true;
}


function reportElementCheckValidSignalFilters(reportElement, feature) {
  if(!reportElement) { return false; }
  if(!feature) { return true; }
  if(feature.classname != "Feature") { return true; }
  if(!feature.expression_hash) { return true; }

  //feature.filter_valid = true;
  //console.log("reportElementCheckValidSignalFilters f:"+feature.name);
  
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    if(dtype_col.col_type != "signal") { continue; }

    var datatype = dtype_col.datatype;
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');
    //console.log("  signal dtype["+dtype_col.datatype+"] ["+datatype+"]");

    if(datatype=="bedscore") { //special logic for feature.score
      var s1 = feature.score
      if(dtype_col.filter_abs) { s1 = Math.abs(s1); }
      if((dtype_col.filter_min!="min") && (s1 < dtype_col.filter_min)) { feature.filter_valid = false; return false; }
      if((dtype_col.filter_max!="max") && (s1 > dtype_col.filter_max)) { feature.filter_valid = false; return false; }
    }

    var signals = feature.expression_hash[datatype];
    if(!signals) { continue; }
    
    for(var j=0; j<signals.length; j++) {
      var s1 = signals[j].total;
      if(dtype_col.filter_abs) { s1 = Math.abs(s1); }
      if((dtype_col.filter_min!="min") && (s1 < dtype_col.filter_min)) { feature.filter_valid = false; return false; }
      if((dtype_col.filter_max!="max") && (s1 > dtype_col.filter_max)) { feature.filter_valid = false; return false; }
    }
  }
  
  //passed all the filters so it is good to go
  //feature.filter_valid = true;
  return true;
}


/*
function reportElementCheckCategoryFilters(reportElement, object) {
  if(!reportElement) { return false; }
  if(!object) { return false; }
 
  //performs a combination of logic.
  //within same datatype, multiple categories are treated as OR
  //between different datatypes, filter is treated as AND
  object.filter_valid = true;

  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    if(dtype_col.col_type != "mdata") { continue; }
    if(!dtype_col.categories) { continue; }

    //perform class specifc tests if datatype is not generic mdata
    //if(dtype_col.datatype == "name") {
    //  val = object.name;
    //}
    //if((object.classname == "Experiment") || (object.classname == "FeatureSource") || (object.classname == "EdgeSource")) {
    //   if(dtype_col.datatype == "category") {
    //    val = object.category;
    //  }
    //}
    //if(object.classname == "Feature") { }
    //if(object.classname == "Edge") { }
    //if(object.classname == "Configuration") { }

    //this is one of the filtered dtypes, must pass this category test in order to continue checking next dtype
    if(!object.mdata || !object.mdata[dtype_col.datatype]) {
      //object doesn't have this datatype so immeadiately fails tests
      object.filter_valid = false;
      return false;
    }

    //perform positive OR selection on different categories of this dtype, 
    var valid=false;  //assumes fail until finds a match
    var value_array = object.mdata[dtype_col.datatype];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      val = value_array[idx1];
      var ctg_obj = dtype_col.categories[val];
      if(!ctg_obj) { continue; }
      if(ctg_obj.filtered) { 
        //console.log("found match");
        valid= true; 
        break; 
      }
    }
    if(!valid) {
      object.filter_valid = false;
      return false;
    }

    //ok pased this dtype filter, so continue on and check the others
  }
  //passed all the filters so it good to go
  object.filter_valid = true;
  return true;
}
*/


function reportElementCheckCategoryFilters(reportElement, object) {
  if(!reportElement) { return false; }
  if(!object) { return false; }

  //performs a combination of logic.
  //within same datatype, multiple categories are treated as OR
  //between different datatypes, filter is treated as AND
  //object.filter_valid = true;  //BUG NO NO
  
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    if(dtype_col.col_type != "mdata") { continue; }
    if(!dtype_col.categories) { continue; }

    if(!reportsObjectCheckCategoryFilters(object, dtype_col)) {
      //object.filter_valid = false;
      return false;
    }
  }
  
  //passed all the filters so it is good to go
  //object.filter_valid = true;  //BUG NO NO
  return true;
}


function reportsObjectCheckCategoryFilters(object, dtype_col) {
  if(!object) { return false; }
  if(!dtype_col) { return false; }

  //perform positive OR selection on different categories of this dtype,

  if(!dtype_col.filtered) { return true; }
  if(dtype_col.col_type != "mdata") { return true; }
  if(!dtype_col.categories) { return true; }

  //perform class specific tests if datatype is not generic mdata
  //if(dtype_col.datatype == "name") {
  //  val = object.name;
  //}
  //if((object.classname == "Experiment") || (object.classname == "FeatureSource") || (object.classname == "EdgeSource")) {
  //   if(dtype_col.datatype == "category") {
  //    val = object.category;
  //  }
  //}
  //if(object.classname == "Feature") { }
  //if(object.classname == "Edge") { }
  //if(object.classname == "Configuration") { }
  if(object.classname == "Edge") {
    var t_feature = null;
    if(/^f1\./.test(dtype_col.datatype)) { t_feature = object.feature1;}
    if(/^f2\./.test(dtype_col.datatype)) { t_feature = object.feature2;}
    if(t_feature) {
      //console.log("reportsObjectCheckCategoryFilters "+dtype_col.datatype+"  edge-feature["+t_feature.name+"]");
      if(!reportsObjectCheckCategoryFilters(t_feature, dtype_col)) { return false; }
      return true;
    }
  }
  
  var datatype = dtype_col.datatype;
  datatype = datatype.replace(/^f1\./, '');
  datatype = datatype.replace(/^f2\./, '');

  //this is one of the filtered dtypes, must pass this category test in order to continue checking next dtype
  if(!object.mdata || !object.mdata[datatype]) {
    //object doesn't have this datatype so immeadiately fails tests
    //console.log("reportsObjectCheckCategoryFilters "+datatype+"  obj["+object.name+"] no mdata");
    return false;
  }
  
  //perform positive OR selection on different categories of this dtype,
  var valid=false;  //assumes fail until finds a match
  var value_array = object.mdata[datatype];
  for(var idx1=0; idx1<value_array.length; idx1++) {
    val = value_array[idx1];
    var ctg_obj = dtype_col.categories[val];
    if(!ctg_obj) { continue; }
    if(ctg_obj.filtered) {
      //console.log("found match ctg["+ctg_obj.ctg+"]");
      valid= true;
      break;
    }
  }
  if(valid) { return true; }
  return false;
}


function reportElementSearchTestObject(feature, filter) {
  feature.search_match = false;
  if(feature.name && (feature.name.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  if(feature.source && feature.source.category && (feature.source.category.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  if(feature.source && feature.source.name && (feature.source.name.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  if(feature.chromloc && (feature.chromloc.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  for(var tag in feature.mdata) { //new common mdata[].array system
    if(feature.search_match) { return; }
    var value_array = feature.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      if(feature.search_match) { return; }
      var value = value_array[idx1];
      if(value && (value.toLowerCase().indexOf(filter) != -1)) {
        feature.search_match = true;
        return;
      }
    }
  }
}


function reportElementSearchData(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  var starttime = new Date();

  var datasourceElement = reportElement.datasource();
  // if(reportElement.datasourceElementID) {
  //   var ds = current_report.elements[reportElement.datasourceElementID];
  //   if(ds) { datasourceElement = ds; }
  //   else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  // }

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  var source_count  = datasourceElement.sources_array.length;

  //first clear previous search
  datasourceElement.search_match_feature_count = 0;
  datasourceElement.search_match_edge_count = 0;
  datasourceElement.search_match_source_count = 0;

  for(var k=0; k<feature_count; k++) {
    var feature = datasourceElement.feature_array[k];
    if(feature) { feature.search_match = false; }
  }
  for(var k=0; k<edge_count; k++) {
    var edge = datasourceElement.edge_array[k];
    if(edge) { edge.search_match = false; }
  }
  for(var k=0; k<source_count; k++) {
    var source = datasourceElement.sources_array[k];
    if(source) { source.search_match = false; }
  }

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportElementSearchData "+elementID+" 1st clear " +(runtime)+"msec");

  if(!datasourceElement.search_data_filter) { return; }  //also performs the clear

  var filter = datasourceElement.search_data_filter;
  filter = filter.toLowerCase();
  console.log("reportElementSearchData ["+filter+"]");
  
  //features
  if(datasourceElement.datasource_mode == "feature") {
    for(var k=0; k<feature_count; k++) {
      var feature = datasourceElement.feature_array[k];
      if(!feature) { continue; }
      reportElementSearchTestObject(feature, filter);
      if(feature.search_match) { datasourceElement.search_match_feature_count++ }
    }
  }

  //edges
  if(datasourceElement.datasource_mode == "edge") {
    for(var k=0; k<feature_count; k++) {
      var feature = datasourceElement.feature_array[k];
      if(!feature) { continue; }
      reportElementSearchTestObject(feature, filter);
    }

    for(var k=0; k<edge_count; k++) {
      var edge = datasourceElement.edge_array[k];
      if(!edge) { continue; }
      edge.search_match = false;

      reportElementSearchTestObject(edge, filter); //search edge metadata?
      //reportElementSearchTestObject(edge.feature1, filter);
      //reportElementSearchTestObject(edge.feature2, filter);
      
      if(edge.feature1.search_match || edge.feature2.search_match) { edge.search_match = true; }
      
      if(!edge.filter_valid) { continue; }
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

      if(edge.search_match) { datasourceElement.search_match_edge_count++ }
    }
  }

  //sources
  if(datasourceElement.datasource_mode == "source") {
    for(var k=0; k<source_count; k++) {
      var source = datasourceElement.sources_array[k];
      if(!source) { continue; }
      reportElementSearchTestObject(source, filter);
      if(source.search_match) { datasourceElement.search_match_source_count++ }
    }
  }

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportElementSearchData "+elementID+" "+(runtime)+"msec");

  //reportElementToggleSubpanel(elementID, 'refresh');
  //reportsDrawElement(elementID);
}

//-----------------------------------
// features
//-----------------------------------

function reportElementLoadSourceFeatures(reportElement) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementLoadSourceFeatures");
  
  reportsResetElement(elementID);
  
  //clear previous loaded data
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.edge_array = new Array();
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;

  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table
  reportElement.selected_location = null; //selected location

  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;

  var paramXML = "<zenbu_query><format>fullxml</format><mode>features</mode>";
  paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  if(reportElement.query_filter) { paramXML += "<filter>"+reportElement.query_filter+"</filter>"; }
  paramXML += "</zenbu_query>\n";
  
  if(reports_pending_XHRs[reportElement.elementID] != null) {
    var xhrObj = reports_pending_XHRs[reportElement.elementID];
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    reports_pending_XHRs[reportElement.elementID] = null;
    delete reports_pending_XHRs[reportElement.elementID];
  }
  delete reports_active_XHRs[reportElement.elementID];
  
  var xhrObj        = new Object;
  xhrObj.elementID  = reportElement.elementID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.paramXML   = paramXML;
  xhrObj.mode       = "search";  //eedb_search.cgi
  
  reportElement.loading = true;
  reportElement.load_retry = 0;
  //document.getElementById("message").innerHTML += " prepare["+reportElement.elementID+"]";
  
  reports_pending_XHRs[reportElement.elementID] = xhrObj;
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
  
  reportsDrawElement(elementID);  //clear and show loading
  
  reportElementTriggerCascade(reportElement, "preload");  //on_trigger==preload happens before element loads/postprocess
}


function reportElementPostprocessFeaturesQuery(reportElement) {
  console.log("reportElementPostprocessFeaturesQuery");
  
  reportElement.raw_count = reportElement.feature_array.length;

  reportElement.filter_count = 0;
  for(j=0; j<reportElement.feature_array.length; j++) {
    var feature = reportElement.feature_array[j];
    if(!feature) { continue; }
    feature.filter_valid = true;

    if(!reportElementCheckValidSignalFilters(reportElement, feature)) { continue; }

    if(!reportElementCheckCategoryFilters(reportElement, feature)) { feature.filter_valid = false; continue; }
    reportElement.filter_count++;
  }

  var num_pages = Math.ceil(reportElement.filter_count / reportElement.table_page_size);
  reportElement.table_num_pages = num_pages;
  reportElement.table_page = 1;

  /*
  //if requested find initial selection
  if(!reportElement.selected_feature && reportElement.init_selection) {
    var selected_feature = null;
    //TODO: redo the init_selection logic to use the new selection event logic, and allow URL init_selection
    //reportElementEvent(reportElement.elementID, 'select', reportElement.init_selection);
    for(var k=0; k<reportElement.feature_array.length; k++) {
      var feature = reportElement.feature_array[k];
      if(!feature) { continue; }
      
      if(!reportElement.selected_feature && reportElement.init_selection) {
        if(reportElement.init_selection == "any") {
          //grab first one
          if(!selected_feature) { selected_feature = feature; }
        }
        if(feature.name == reportElement.init_selection) {
          console.log("found initial feature selection by name ["+reportElement.init_selection+"]");
          selected_feature = feature;
        }
        for(var tag in feature.mdata) { //new common mdata[].array system
          var value_array = feature.mdata[tag];
          for(var idx1=0; idx1<value_array.length; idx1++) {
            var value = value_array[idx1];
            if(value == reportElement.init_selection) {
              console.log("found focus feature in mdata ["+reportElement.init_selection+"]");
              selected_feature = feature;
            }
          }
        }
      }
    }
    if(selected_feature) {
      reportElement.selected_id = selected_feature.id;
      reportElement.selected_feature = selected_feature;
    }
    //reportElement.init_selection = ""; //clear it use the current selection at save time
  }
   */
}

//---- Edges ------

function reportElementLoadSourceEdges(reportElement) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementLoadSourceEdges: " + elementID);
  
  reportsResetElement(elementID);
  reportsDrawElement(elementID); //clear

  //clear previous loaded data
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  
  reportElement.edge_array = new Array();

  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;
  
  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;

  //clear previous target/selection
  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table
  reportElement.selected_location = null; //selected location

  //TODO: need to figure out this logic, might need flag if ok to pull full edge-network
  //actually I think using load_on_page_init is enough. if this is set then there is no input trigger so should be ok to pull all edges
  if(!reportElement.load_on_page_init && !reportElement.focus_feature && !reportElement.filter_feature_ids) { return; }

  var paramXML = "<zenbu_query><format>"+reportElement.query_format+"</format><mode>edges</mode>";
  paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  if(reportElement.query_edge_search_depth) {
    paramXML += "<edge_search_depth>"+reportElement.query_edge_search_depth+"</edge_search_depth>";
  }
  var feature_ids = "";
  if(reportElement.focus_feature) {
    feature_ids += reportElement.focus_feature.id;
  }
  if(reportElement.filter_feature_ids) {
    if(feature_ids!="") { feature_ids += ","; }
    feature_ids += reportElement.filter_feature_ids;
  }
  paramXML += "<feature_ids>"+feature_ids+"</feature_ids>";
  console.log("load "+reportElement.elementID+" edges with filter_features: "+feature_ids);
  if(reportElement.format == "descxml") {
    paramXML += "<mdkey_list>";
    //<mdkey_list>HGNC_symbol, HGNC_name, ";
    for(var dtype in reportElement.datatypes) {
      var dtype_col = reportElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type == "mdata") {
        paramXML += dtype_col.datatype + ", ";
      }
    }
    paramXML += "</mdkey_list>";
  }
  paramXML += "</zenbu_query>\n";
  
  //var paramXML = "<zenbu_query><format>fullxml</format><mode>edges</mode><edge_search_depth>3</edge_search_depth>";
  //paramXML += "<source_ids>CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource</source_ids>";
  //paramXML += "<source_ids>CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::10:::EdgeSource</source_ids>";
  //paramXML += "<feature_ids>"+reportElement.focus_feature.id+"</feature_ids>";
  //paramXML += "</zenbu_query>\n";
  
  if(reports_pending_XHRs[reportElement.elementID] != null) {
    var xhrObj = reports_pending_XHRs[reportElement.elementID];
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    reports_pending_XHRs[reportElement.elementID] = null;
    delete reports_pending_XHRs[reportElement.elementID];
  }
  delete reports_active_XHRs[reportElement.elementID];
  
  var xhrObj        = new Object;
  xhrObj.elementID  = reportElement.elementID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.paramXML   = paramXML;
  xhrObj.mode       = "search";
  
  reportElement.loading = true;
  reportElement.load_retry = 0;
  
  reportsDrawElement(elementID);  //clear and show loading
  reportElementTriggerCascade(reportElement, "preload");  //on_trigger==preload happens before element loads/postprocess

  reports_pending_XHRs[reportElement.elementID] = xhrObj;
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
}


function reportElementPostprocessEdgesQuery(reportElement) {
  if(!reportElement) { return; }
  var starttime = new Date();
  
  var elementID = reportElement.elementID;
  console.log("reportElementPostprocessEdgesQuery: " + elementID);

  reportElement.edge_count = reportElement.edge_array.length;
  reportElement.raw_count  = reportElement.edge_array.length;

  var feature_count = reportElement.feature_array.length;
  var edge_count    = reportElement.edge_array.length;
  console.log("reportElementPostprocessEdgesQuery: " + feature_count+ " features, " + edge_count+" edges");
  
  if(reportElement.focus_feature) {
    //if(!reportElement.selected_feature) { reportElement.selected_feature = reportElement.focus_feature; }  //DONT do this anymore
    console.log("reportElementPostprocessEdgesQuery start focus["+reportElement.focus_feature.name+"]");
  }
  
  var filter_feature_ids_hash = {};
  if(reportElement.filter_feature_ids) {
    var ids = reportElement.filter_feature_ids.split(/[\s\,]/);
    for(var i=0; i<ids.length; i++) {
      var objID = ids[i];
      if(!objID) { continue; }
      filter_feature_ids_hash[objID] = true;
    }
  }
  
  //general edge filtering
  reportElement.filter_count=0;
  for(var k=0; k<reportElement.edge_array.length; k++) {
    var edge = reportElement.edge_array[k];
    if(!edge) { continue; }
    edge.internal_id = k;

    //filtering
    if(!edge.feature1) { continue; }
    if(!edge.feature2) { continue; }
    
    //some precalcs hacks: if asking for log10XXXX and have XXXX can calculate it
    //TODO: need to make this generic
    var basemean;
    if(edge.weights["baseMean"]) { basemean = edge.weights["baseMean"][0]; }
    if(basemean && !(edge.weights["log10baseMean"])) {
      weight = new Object();
      weight.datatype   = "log10baseMean";
      weight.weight     = Math.log10(basemean.weight);
      edge.weights[weight.datatype] = new Array;
      edge.weights[weight.datatype].push(weight);
    }

    //the weights cutoff filter check
    edge.filter_valid = true;
    if(!reportElementEdgeCheckValidFilters(reportElement, edge)) { continue; }

    if(reportElement.focus_feature &&
       (reportElement.focus_feature.id != edge.feature1_id) &&
       (reportElement.focus_feature.id != edge.feature2_id)) { continue; }

    if(!reportElementCheckCategoryFilters(reportElement, edge)) { edge.filter_valid = false; continue; }

    if(reportElement.filter_feature_ids) {
      if(!filter_feature_ids_hash[edge.feature1_id] && !filter_feature_ids_hash[edge.feature2_id]) {
        edge.filter_valid = false;
        continue;
      }
    }

    reportElement.filter_count++;
  }
  console.log("reportElementPostprocessEdgesQuery filter_count= "+reportElement.filter_count);

  var num_pages = Math.ceil(reportElement.filter_count / Math.floor(reportElement.table_page_size));
  reportElement.table_num_pages = num_pages;
  reportElement.table_page = 1;
  console.log("postprocessEdgesQuery "+elementID+" filter_count= "+reportElement.filter_count+" page_size["+reportElement.table_page_size+"]  num_pages"+reportElement.table_num_pages+"]  table_page["+reportElement.table_page+"]")

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("postprocessEdgesQuery " +(runtime)+"msec");
}

//-----------------------------------
// sources
//-----------------------------------

function reportElementLoadSources(reportElement) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementLoadSources");
  
  reportsResetElement(elementID);
  
  //clear previous loaded data
  reportElement.datasources = new Object();
  reportElement.sources_array = new Array();
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.edge_array = new Array();
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;
  
  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table
  reportElement.selected_location = null; //selected location

  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;
  
  //TODO: maybe system to get all mdata types and then here only query based on selected columns?
  var paramXML = "<zenbu_query>";

  if(reportElement.datasource_submode=="experiments") { paramXML += "<mode>experiments</mode>"; }
  else if(reportElement.datasource_submode=="feature_sources") { paramXML += "<mode>feature_sources</mode>"; }
  else if(reportElement.datasource_submode=="edge_sources") { paramXML += "<mode>edge_sources</mode>"; }
  else if(reportElement.datasource_submode=="assemblies") { paramXML += "<mode>genome</mode>"; } 
  else { paramXML += "<mode>sources</mode>"; }

  //paramXML += "<format>fullxml</format>";
  if(current_report.edit_page_configuration) { paramXML += "<format>fullxml</format>"; }
  else {
    paramXML += "<format>descxml</format>";
    paramXML += "<mdkey_list>";
    for(var dtype in reportElement.datatypes) {
      var dtype_col = reportElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if(dtype_col.visible || dtype_col.filtered || dtype_col.categories) { paramXML += dtype_col.datatype + ","; }
    }
    paramXML += "</mdkey_list>";
  }

  if(reportElement.collaboration_filter) { paramXML += "<collab>"+reportElement.collaboration_filter+"</collab>"; }
  if(reportElement.query_filter) { paramXML += "<filter>"+reportElement.query_filter+"</filter>"; }
  paramXML += "</zenbu_query>\n";
  
  if(reports_pending_XHRs[reportElement.elementID] != null) {
    var xhrObj = reports_pending_XHRs[reportElement.elementID];
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    reports_pending_XHRs[reportElement.elementID] = null;
    delete reports_pending_XHRs[reportElement.elementID];
  }
  delete reports_active_XHRs[reportElement.elementID];
  
  var xhrObj        = new Object;
  xhrObj.elementID  = reportElement.elementID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.paramXML   = paramXML;
  xhrObj.mode       = "search";  //eedb_search.cgi
  
  reportElement.loading = true;
  reportElement.load_retry = 0;
  //document.getElementById("message").innerHTML += " prepare["+reportElement.elementID+"]";
  
  reports_pending_XHRs[reportElement.elementID] = xhrObj;
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
  
  reportsDrawElement(elementID);  //clear and show loading
  
  reportElementTriggerCascade(reportElement, "preload");  //on_trigger==preload happens before element loads/postprocess
}


function reportElementPostprocessSourcesQuery(reportElement) {
  console.log("reportElementPostprocessSourcesQuery");
  
  reportElement.raw_count = reportElement.sources_array.length;
  //reportElement.filter_count = reportElement.sources_array.length;

  reportElement.filter_count = 0;
  for(j=0; j<reportElement.sources_array.length; j++) {
    var source = reportElement.sources_array[j];
    if(!source) { continue; }
    source.filter_valid = true;
    if(!reportElementCheckCategoryFilters(reportElement, source)) { source.filter_valid = false; continue; }
    reportElement.filter_count++;
  }

  var num_pages = Math.ceil(reportElement.filter_count / reportElement.table_page_size);
  reportElement.table_num_pages = num_pages;
  reportElement.table_page = 1;
}


//===============================================================
//
// Reports Element redirection block
//
//===============================================================


function reportsResetElements() {
  //global reset is called when page needs to refresh
  for(var elementID in current_report.elements) {
    var reportElement = current_report.elements[elementID];
    if(!reportElement) { continue; }
    if(reportElement.resetable) { 
      reportsResetElement(elementID);
    }
  }
}

function reportsDrawElements() {
  console.log("reportsDrawElements");
  //global reset is called when page needs to refresh
  for(var elementID in current_report.elements) {
    var reportElement = current_report.elements[elementID];
    if(!reportElement) { continue; }
    if(reportElement.layout_parentID) {
      parent = current_report.elements[reportElement.layout_parentID];
      if(!parent) {
        console.log("element["+reportElement.elementID+"] has parentID but parent doesn't exist - cleanup");
        reportElement.layout_parentID = null;
      }
      if(parent) { 
        //console.log("element["+reportElement.elementID+"] child of layout so skip");
        continue;
      }
    }
    //console.log("element["+reportElement.elementID+"] at top level");
    if(reportElement.element_type == "layout") {
      reportsDrawLayoutElement(reportElement, true); //traverse down
    } else {
      reportsDrawElement(elementID);
    }
  }
}


function reportsResetElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.resetable) { return; }

  //clear previous loaded data
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.edge_array = new Array();

  //common resets
  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table
  reportElement.selected_location = null; //selected location
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;
  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;
  
  reportElement.loading = false;  //TODO: need to double check this logic
  
  //element specific resets
  if(reportElement.resetElement) {
    reportElement.resetElement();
  }
  //if(reportElement.element_type == "treelist") {
  //  reportsResetTreeListElement(reportElement);
  //}
  //if(reportElement.element_type == "table") {
  //  //reportsResetTableElement(reportElement);
  //  reportElement.resetElement();
  //}
  //if(reportElement.element_type == "chart") {
  //  //reportsResetChartElement(reportElement);
  //  reportElement.resetElement();
  //}
  //if(reportElement.element_type == "zenbugb") {
  //  //reportsResetZenbuGB(reportElement);
  //  reportElement.resetElement();
  //}
  //if(reportElement.element_type == "html") {
  //  //reportsResetHtmlElement(reportElement);
  //  reportElement.resetElement();
  //}
  //if(reportElement.element_type == "category") {
  //  //reportsResetCategoryElement(reportElement);
  //  reportElement.resetElement();
  //}

  //trigger draw to clear display
  //TODO: might-reverse: reportsDrawElement(elementID);
  
  reportElementTriggerCascade(reportElement, "reset");
}


function reportsLoadElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  console.log("reportsLoadElement ["+elementID+"]");
  reportsResetElement(elementID);

  //datasource general
  if(reportElement.datasource_mode == "feature") {
    reportElementLoadSourceFeatures(reportElement);
  }
  if(reportElement.datasource_mode == "edge") {
    reportElementLoadSourceEdges(reportElement);
  }
  if(reportElement.datasource_mode == "source") {
    reportElementLoadSources(reportElement);
  }
  if(reportElement.datasource_mode == "shared_element") {
    reportsPostprocessElement(elementID);
  }

  //element_type related loading
  if(reportElement.loadElement) { reportElement.loadElement(); }

  //element specific resets
  //if(reportElement.elementID == "target_DE_genes") {
  //  reportsLoadTargetDEgenes();
  //}

  //maybe trigger postprocess here, but maybe internal to the Load methods
  //reportsPostprocessElement(elementID);
}


function reportsPostprocessElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  var starttime = new Date();
  console.log("reportsPostprocessElement "+elementID);
  
  //datasource general
  if(reportElement.datasource_mode == "feature") {
    reportElementPostprocessFeaturesQuery(reportElement);
  }
  if(reportElement.datasource_mode == "edge") {
    reportElementPostprocessEdgesQuery(reportElement);
  }
  if(reportElement.datasource_mode == "source") {
    reportElementPostprocessSourcesQuery(reportElement);
  }
  if(reportElement.datasource_mode == "shared_element") {
    //copy column/datatypes from datasource to reportElement
    var datasourceElement = reportElement.datasource();
    if(datasourceElement && (datasourceElement.elementID != elementID)) {
      //console.log("reportsPostprocessElement "+elementID+" copy datatypes from shared_element "+datasourceElement.elementID);
      for(var dtype in datasourceElement.datatypes) {
        var dtype_col = datasourceElement.datatypes[dtype];
        if(!dtype_col) { continue; }
        var t_col = reportElementAddDatatypeColumn(reportElement, dtype_col.datatype, dtype_col.title, false);
        t_col.col_type = dtype_col.col_type;
      }
      //might be best to always copy the feature/edge/source array into the local to allow local sorting
      //shares feature/edge/source objects so does not use extra memory, but array and sort can be different
      console.log("copy feature/edge/source array objs from "+datasourceElement.elementID+" into "+reportElement.elementID+" local arrays for local sorting");
      reportElement.feature_array = []; 
      for(j=0; j<datasourceElement.feature_array.length; j++) {
        var feature = datasourceElement.feature_array[j];
        if(feature) { reportElement.feature_array.push(feature); }
      }
      reportElement.edge_array = []; 
      for(j=0; j<datasourceElement.edge_array.length; j++) {
        var edge = datasourceElement.edge_array[j];
        if(edge) { reportElement.edge_array.push(edge); }
      }
      reportElement.sources_array = []; 
      for(j=0; j<datasourceElement.sources_array.length; j++) {
        var source = datasourceElement.sources_array[j];
        if(source) { reportElement.sources_array.push(source); }
      }
    }
  }

  //reportElementSearchData(elementID); //resets the search_match flag and applies search if needed
  if(reportElement.search_data_filter) {
    reportElementSearchData(elementID); //resets the search_match flag and applies search if needed
  }

  
  //element_type related postprocessing
  if(reportElement.postprocessElement) {
    reportElement.postprocessElement();
  }
  //if(reportElement.element_type == "treelist") {
  //  reportsPostprocessTreeList(reportElement);
  //}
  //if(reportElement.element_type == "chart") {
  //  //reportsPostprocessChart(reportElement);
  //  reportElement.postprocessElement();
  //}
  //if(reportElement.element_type == "table") {
  //  //reportsPostprocessTable(reportElement);
  //  reportElement.postprocessElement();
  //}
  //if(reportElement.element_type == "zenbugb") {
  //  //reportsPostprocessZenbuGB(reportElement);
  //  reportElement.postprocessElement();
  //}
  //if(reportElement.element_type == "html") {
  //  //reportsPostprocessHtmlElement(reportElement);
  //  reportElement.postprocessElement();
  //}
  //if(reportElement.element_type == "category") {
  //  //reportsPostprocessCategoryElement(reportElement);
  //  reportElement.postprocessElement();
  //}

  //post-processing of the init_url_terms
  for(var j=0; j<current_report.init_url_terms.length; j++) {
    var term = current_report.init_url_terms[j];
    if(!term) { continue; }
    if(term.init_complete) { continue; }
    if(term.elementID != reportElement.elementID) { continue; }

    if((term.mode=="search_select") || (term.mode=="search_select_hide")) {
      var feature_matches = reportElement.search_match_feature_count;
      var edge_matches    = reportElement.search_match_edge_count;
      var source_matches  = reportElement.search_match_source_count;
      if(feature_matches>0 || edge_matches>0 || source_matches>0) {
        if(term.mode=="search_select_hide") { reportElement.show_only_search_matches = true; }
      }
      
      if((reportElement.datasource_mode == "feature") && (feature_matches==1)) {
        for(var k=0; k<reportElement.feature_array.length; k++) {
          var feature = reportElement.feature_array[k];
          if(!feature) { continue; }
          if(feature.search_match) { reportElement.init_selection = feature.id; break; 
          }
        }
      }
      if((reportElement.datasource_mode == "edge") && (edge_matches==1)) {
        for(var k=0; k<reportElement.edge_array.length; k++) {
          var edge = reportElement.edge_array[k];
          if(!edge) { continue; }
          if(edge.search_match) { reportElement.init_selection = edge.id; break; 
          }
        }
      }
      if((reportElement.datasource_mode == "source") && (source_matches==1)) {
        for(var k=0; k<source_count; k++) {
          var source = reportElement.sources_array[k];
          if(!source) { continue; }
          if(source.search_match) { reportElement.init_selection = source.id; break; }
        }
      }
      //if(term.mode=="select") { 
      //  reportElement.search_data_filter = ""; 
      //  reportElement.search_match_feature_count = 0;
      //  reportElement.search_match_edge_count = 0;
      //  reportElement.search_match_source_count = 0;
      //  reportElement.show_only_search_matches = false;
      //}
    }
    term.init_complete = true;
  }
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportsPostprocessElement "+reportElement.elementID+" "+(runtime)+"msec");

  //trigger cascades here
  reportElementTriggerCascade(reportElement, "postprocess");
  reportElementTriggerCascade(reportElement, "select");

  if(reportElement.init_selection) {
    reportElementUserEvent(reportElement, 'select', reportElement.init_selection);
    reportElement.init_selection = ""; //clear it, uses the new current selection at save time
  }
}


function reportsDrawElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  reportsPrepElement(reportElement);  //creates main_div and setup
  var starttime = new Date();

  if(reportElement.element_type == "layout") { return; }  //need to keep the layout and single-element drawing separate
  
  var datasourceElement = reportElement.datasource();
  // if(reportElement.datasourceElementID) {
  //   var ds = current_report.elements[reportElement.datasourceElementID];
  //   if(ds) { datasourceElement = ds; }
  //   else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  // }

  //general drawing for all elements: frame, titlebar, loading_info
  var main_div = reportElement.main_div;
  if(!main_div) {
    main_div = document.getElementById(reportElement.main_div_id);
    reportElement.main_div = main_div;
  }
  if(!main_div) { return; }
  main_div.innerHTML = "";
  main_div.setAttribute('style', "font-size:12px;");
  console.log("reportsDrawElement ["+elementID+"]");
  
  //frame, resize and titlebar
  var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; "+
              "background-color:#FDFDFD; padding: 5px 5px 5px 5px; ";  //bck #FDFDFD, F6F6F6
  style += "min-width:100px; ";
  var border = reportElement.border;
  if(reportElement.newconfig && reportElement.newconfig.border != undefined) { border = reportElement.newconfig.border; }
  switch(border) {
    case "none": break;
    case "inset": style += "border:inset 2px; "; break;
    case "simple": style += "border:solid 2px #808080; "; break;
    case "double": style += "border:double 3px #808080; "; break;
    case "left": style += "border:solid 1px #808080; border-left:solid 5px #808080; "; break;
    case "round": style += "border-radius: 7px; border: solid 2px #808080; "; break;
    default: break;
  }
  if(current_report.edit_page_configuration) { //if editing ... draw frame/resize
    if(reportElement.auto_content_height) { style += "overflow: visible; resize: horizontal; "; }
    else { style += "overflow: auto; resize: both; "; }
    //style += "border:inset; border-width:2px; overflow: auto; resize: both; ";
    //"padding: 5px 5px 5px 5px; overflow-y:scroll; resize:both; ";
  }
  if((reportElement.layout_mode == "absolute") || (reportElement.layout_mode == "dragging")) {
    style += "position:absolute; left:"+ reportElement.layout_xpos +"px; top:"+ reportElement.layout_ypos +"px; ";
  }
  if(reportElement.content_width) { style += "width:"+(reportElement.content_width)+"px; "; }
  if(reportElement.content_height && !reportElement.auto_content_height) { style += "height: "+(reportElement.content_height)+"px; "; }
  main_div.setAttribute('style', style);
  
  if(current_report.edit_page_configuration) {
    main_div.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mousedown');");
    main_div.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mouseup');");
  }
  reportElementDrawTitlebar(reportElement);
  
  if(datasourceElement.loading) {
    var load_info = main_div.appendChild(document.createElement('span'));
    load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    load_info.innerHTML = "loading...";
    return;
  }

  //element_type based drawing code
  if(reportElement.drawElement) {
    reportElement.drawElement();
  }
  //if(reportElement.element_type == "table") {
  //  //reportsDrawTable(reportElement);
  //  reportElement.drawElement();
  //}
  //if(reportElement.element_type == "treelist") {
  //  reportsDrawTreeList(reportElement);
  //}
  //if(reportElement.element_type == "chart") {
  //  //reportsDrawChart(reportElement);
  //  reportElement.drawElement();
  //}
  //if(reportElement.element_type == "zenbugb") {
  //  //reportsDrawZenbuGB(reportElement);
  //  reportElement.drawElement();
  //}
  //if(reportElement.element_type == "html") {
  //  //reportsDrawHtmlElement(reportElement);
  //  reportElement.drawElement();
  //}
  //if(reportElement.element_type == "category") {
  //  reportElement.drawElement();
  //  //if((reportElement.display_type == "piechart") || (reportElement.display_type == "doughnut")) {
  //  //  reportsDrawCategoryPieChart(reportElement);
  //  //} else {
  //  //  reportsDrawCategoryElement(reportElement);
  //  //}
  //}
  if(reportElement.element_type == "tools_panel") {
    reportsDrawToolsPanel(reportElement);
  }
  
  var master_div = document.getElementById("zenbuReportsDiv");
  var masterRect = master_div.getBoundingClientRect();
  //console.log("masterRect x:"+masterRect.x+" y:"+masterRect.y+" left:"+masterRect.left+" top:"+masterRect.top+ " bottom:"+masterRect.bottom);
  var mainRect = main_div.getBoundingClientRect();
  //console.log("mainRect "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
  if(masterRect.bottom < mainRect.bottom + 10) {
    //console.log("master_div top:"+masterRect.top+" bottom:"+masterRect.bottom+" height:"+masterRect.height+" adjust because "+reportElement.elementID + " bottom is "+mainRect.bottom);
    var t_height = mainRect.bottom - masterRect.top + 10;
    if(t_height < 100) { t_height = 100; }
    //console.log("master_div["+elementID+"] new height: "+t_height);
    master_div.style.height = t_height + "px";
  }

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportsDrawElement "+reportElement.elementID+" "+(runtime)+"msec");
}


function reportElementAddCascadeTrigger(reportElement, targetElementID, on_trigger, action_mode, options) {
  //Cascade causes reload while Focus usually involves just selecting from within existing data
  if(!reportElement) { return; }
  if(!on_trigger) { return; }
  if(!action_mode) { return; }
  console.log("add CascadeTrigger from element["+reportElement.elementID+"] to["+targetElementID+"]");
  if(!options) { options = ""; }
  
  var trigger = new Object();
  trigger.element         = reportElement;
  trigger.targetElementID = targetElementID;
  trigger.targetElement   = current_report.elements[targetElementID];;
  trigger.on_trigger      = on_trigger;
  trigger.action_mode     = action_mode;
  trigger.options         = options;

  if(!reportElement.cascade_triggers) { reportElement.cascade_triggers = new Array(); }
  reportElement.cascade_triggers.push(trigger);
  console.log("added cascade trigger: "+on_trigger+" => "+action_mode + " - "+options);
  return trigger;
}


function reportsCopyCascadeTrigger(in_trigger) {
  if(!in_trigger) { return null; }
  
  var trigger = new Object();
  trigger.element         = in_trigger.element;
  trigger.targetElementID = in_trigger.targetElementID;
  trigger.targetElement   = in_trigger.targetElement;
  trigger.on_trigger      = in_trigger.on_trigger;
  trigger.action_mode     = in_trigger.action_mode;
  trigger.options         = in_trigger.options;
  trigger.hyperlink_datatype = in_trigger.hyperlink_datatype;

  return trigger;
}


function reportElementTriggerCascade(reportElement, on_trigger) {
  //Cascade causes reload while Focus usually involves just selecting from within existing data
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;

  var datasource = reportElement.datasource();
  //if(reportElement.datasourceElementID) {
  //  datasource = current_report.elements[reportElement.datasourceElementID];
  //}
  if(!datasource) { return; }
  console.log("TRIGGER-CASCADE from element["+reportElement.elementID+"] datasource["+datasource.elementID+"]  on["+on_trigger+"]");
  
  //code to try to prevent run-away infinite loops
  var cascade_key = reportElement.elementID +"_"+ on_trigger;
  if(current_report.active_cascades[cascade_key]) {
    console.log("event cascade ["+cascade_key+"] already happened so don't trigger again");
    return;
  }
  current_report.active_cascades[cascade_key] = true;

  //first check for elements globally which use this reportElement as it's dependant datasource
  for(var depID in current_report.elements) {
    var dependantElement = current_report.elements[depID];
    if(!dependantElement) { continue; }
    if(dependantElement.datasourceElementID == elementID) {
      if(on_trigger == "select") {
        if(datasource.selected_edge) {
          //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection-edge["+datasource.selected_edge.id+"]");
          reportElementCascadeEvent(dependantElement, 'select', datasource.selected_edge.id);
        }
        else if(datasource.selected_feature) {
          //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection-feature["+datasource.selected_feature.id+"]");
          reportElementCascadeEvent(dependantElement, 'select', datasource.selected_feature.id);
        }
        else if(datasource.selected_source) {
          //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection-source["+datasource.selected_source.id+"]");
          reportElementCascadeEvent(dependantElement, 'select', datasource.selected_source.id);
        }
        else { //send if clear or valid
          //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection_id["+datasource.selected_id+"]");
          reportElementCascadeEvent(dependantElement, 'select', datasource.selected_id);
        }
      }
      if(on_trigger == "reset") {
        //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"]");
        reportsResetElement(dependantElement.elementID);
        reportsDrawElement(dependantElement.elementID);
      }
      if(on_trigger == "preload") {
        //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"]");
        reportsResetElement(dependantElement.elementID);
        reportsDrawElement(dependantElement.elementID);
      }
      if((on_trigger == "load") || (on_trigger == "postprocess")) {
        //console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"]");
        reportsPostprocessElement(dependantElement.elementID);
        reportsDrawElement(dependantElement.elementID);
      }
    }
  }
  
  //console.log("TRIGGER-CASCADE "+on_trigger+" from element["+reportElement.elementID+"] datasource["+datasource.elementID+"]");
  
  //dependents come from the reportElement not its datasource
  //but selected feature comes from the datasource
  for(var trig_idx=0; trig_idx<reportElement.cascade_triggers.length; trig_idx++){
    var trigger = reportElement.cascade_triggers[trig_idx];
    if(!trigger) { continue; }
    //console.log("trigger "+reportElement.elementID+" ["+trig_idx+"] on["+trigger.on_trigger+"]  action["+trigger.action_mode+" - "+trigger.options+"]");
    if(trigger.on_trigger != on_trigger) { continue; }

    if(trigger.on_trigger == "hyperlink") {
      if(trigger.hyperlink_datatype != datasource.selected_hyperlink_datatype) { continue; }
      //console.log("TRIGGER-CASCADE from["+reportElement.elementID+"] on["+on_trigger+"] datatype["+trigger.hyperlink_datatype+"] => to-page["+trigger.targetElementID+"] action["+trigger.action_mode+" - "+trigger.options+"]");

      var send_data = "";
      if(trigger.options == "selection_id") {
        if(datasource.selected_feature) { send_data = datasource.selected_feature.id; }
        if(datasource.selected_edge)    { send_data = datasource.selected_edge.id; }
        if(datasource.selected_source)  { send_data = datasource.selected_source.id; }
      }
      
      var datatype = trigger.options;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');

      var t_feature = datasource.selected_feature;
      if(datasource.selected_edge && (/^f1\./.test(trigger.options))) { t_feature = datasource.selected_edge.feature1;}
      if(datasource.selected_edge && (/^f2\./.test(trigger.options))) { t_feature = datasource.selected_edge.feature2;}

      if(t_feature) {
        if(datatype == "id") {
          send_data = t_feature.id;
        }
        else if(datatype == "name") {
          send_data = t_feature.name;
        }
        else if(t_feature.mdata[datatype]) {
          send_data = t_feature.mdata[datatype];
        }
      }

      //var hyperlink_url = eedbWebRoot + "/reports/#"+trigger.targetElementID+";"+datatype+"="+send_data;
      var hyperlink_url = eedbWebRoot + "/reports/#"+trigger.targetElementID+send_data;
      //console.log("hyperlink trigger url ["+hyperlink_url+"]");
      window.location = hyperlink_url;

      continue;
    }    
    
    if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
    if(!trigger.targetElement) { continue; }
    
    //console.log("TRIGGER-CASCADE from["+reportElement.elementID+"] on["+on_trigger+"] => to["+trigger.targetElement.elementID+"] action["+trigger.action_mode+" - "+trigger.options+"]");

    if(trigger.action_mode == "select") {
      if(trigger.options == "selection_id") {
        if(datasource.selected_feature) { reportElementCascadeEvent(trigger.targetElement, 'select', datasource.selected_feature.id); }
        if(datasource.selected_edge)    { reportElementCascadeEvent(trigger.targetElement, 'select', datasource.selected_edge.id); }
        if(datasource.selected_source)  { reportElementCascadeEvent(trigger.targetElement, 'select', datasource.selected_source.id); }
      }
      
      var datatype = trigger.options;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');

      var t_feature = datasource.selected_feature;
      if(datasource.selected_edge && (/^f1\./.test(trigger.options))) { t_feature = datasource.selected_edge.feature1;}
      if(datasource.selected_edge && (/^f2\./.test(trigger.options))) { t_feature = datasource.selected_edge.feature2;}

      if(t_feature) {
        if(datatype == "id") {
          reportElementCascadeEvent(trigger.targetElement, 'select', t_feature.id);
        }
        else if(datatype == "name") {
          reportElementCascadeEvent(trigger.targetElement, 'select', t_feature.name);
        }
        else if(t_feature.mdata[datatype]) {
          //console.log("send mdata ["+t_feature.mdata[datatype]+"]");
          reportElementCascadeEvent(trigger.targetElement, 'select', t_feature.mdata[datatype]);
        }
      }
      if(trigger.options == "clear") {
        console.log("trigger send clear selection");
        reportElementCascadeEvent(trigger.targetElement, 'select', "");
      }
    }
    
    if((trigger.action_mode == "set_focus") || (trigger.action_mode == "focus_load")) {
      //get the selection from this element/datasource, set it as focus_feature on target
      if(trigger.options == "selection") {
        var selected_feature = datasource.selected_feature;
        if(!selected_feature) { select_feature = datasource.focus_feature; }
        if(selected_feature) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.focus_feature  = datasource.selected_feature;
        }
      }
      if(trigger.options == "selection_f1") {
        if(datasource.selected_edge) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.focus_feature  = datasource.selected_edge.feature1;
        }
      }
      if(trigger.options == "selection_f2") {
        if(datasource.selected_edge) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.focus_feature  = datasource.selected_edge.feature2;
        }
      }
      if(trigger.options == "clear") {
        trigger.targetElement.focus_feature  = null;
      }
    }

    if(trigger.action_mode == "set_filter_features") {
      //get the selection from this element/datasource, set it as focus_feature on target
      if(trigger.options == "clear") {
        trigger.targetElement.filter_feature_ids  = "";
      }
      if(trigger.options == "selection") {
        //if(datasource.selected_id) { trigger.targetElement.filter_feature_ids  = datasource.selected_id; }
        var selected_feature = datasource.selected_feature;
        if(!selected_feature) { select_feature = datasource.focus_feature; }
        if(selected_feature) {
          console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.filter_feature_ids  = selected_feature.id;
        }
      }
      if(trigger.options == "subnetwork") {
        //selection is connected to network, use all features in connected network as load filter for next element load
      }
      if(trigger.options == "all_features") {
        //all_features in element/datasource are used as load filter for next element load
        console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"]");
        var all_feature_ids = "";
        for(var k=0; k<datasource.feature_array.length; k++) {
          var feature = datasource.feature_array[k];
          if(!feature) { continue; }
          if(all_feature_ids != "") { all_feature_ids += ","; }
          all_feature_ids += feature.id;
        }
        //console.log("all_feature_ids ["+all_feature_ids+"]");
        trigger.targetElement.filter_feature_ids = all_feature_ids;
      }
    }

    if(trigger.action_mode == "reset") {
      reportsResetElement(trigger.targetElement.elementID);
      reportsDrawElement(trigger.targetElement.elementID); //clear
    }

    if((trigger.action_mode == "load") || (trigger.action_mode == "focus_load")) {
      reportsLoadElement(trigger.targetElement.elementID);
    }
   
    if(trigger.action_mode == "postprocess") {
      reportsPostprocessElement(trigger.targetElement.elementID);
      reportsDrawElement(trigger.targetElement.elementID);
    }
    if(trigger.action_mode == "select_location") {
      if(datasource.selected_location) {
        reportElementCascadeEvent(trigger.targetElement, 'select_location', datasource.selected_location);
      } else if(datasource.selected_feature) {
        reportElementCascadeEvent(trigger.targetElement, 'select_location', datasource.selected_feature.chromloc);
      }
      //reportElementCascadeEvent(trigger.targetElement, 'select', datasource.selected_edge.id); }
      //reportsDrawElement(trigger.targetElement.elementID);
    }
    
  }
}


function reportElementShowSelectedFeature(elementID, select_id) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  //console.log("reportElementShowSelectedFeature "+elementID+" "+select_id);

  if(reportElement.element_type == "chart") {
    //reportChartProcessSelections(reportElement);
    reportElement.showSelections();
    if(reportElement.chart) { reportElement.chart.update(0); }
  }
  else if(reportElement.showSelections) {
    reportElement.showSelections();
  } 
  else {
    reportsDrawElement(elementID);
  }
  
}

//
//=====================================================================
//

function reportsNewReportElement(element_type, elementID) {
  if(!element_type) { element_type = "" }
  if(element_type && !elementID) { elementID = element_type + (newElementID++); }
  
  var reportElement = new Object;
  reportElement.element_type = element_type;
  reportElement.elementID = elementID;

  switch(element_type) {
    case "table":      reportElement = new ZenbuTableElement(elementID); break;
    case "treelist":   reportElement = new ZenbuTreeListElement(elementID); break;
    case "category":   reportElement = new ZenbuCategoryElement(elementID); break;
    case "chart":      reportElement = new ZenbuChartElement(elementID); break;
    case "html":       reportElement = new ZenbuHtmlElement(elementID); break;
    case "zenbugb":    reportElement = new ZenbuGBElement(elementID); break;
    case "circos":     reportElement = new ZenbuCircosElement(elementID); break;
    case "genomewide": reportElement = new ZenbuGenomeWideElement(elementID); break;
    case "cytoscape":  reportElement = new ZenbuCytoscapeElement(elementID); break;
    default:
      reportElementInit(reportElement);
      break;
  }

  var t_col = reportElementAddDatatypeColumn(reportElement, "row", "row", true);
  t_col.col_type = "row";

  //store into the hash of global elements on the page
  if(reportElement.elementID) {
    current_report.elements[reportElement.elementID] = reportElement;
  }
  return reportElement;
}


function reportElementInit(reportElement) {
  reportElement.main_div = undefined;
  reportElement.main_div_id = undefined;
  //reportElement.elementID = "element"+ (newElementID++);
  //reportElement.main_div_id = reportElement.elementID + "_div";

  reportElement.title = "";
  reportElement.title_prefix = "";

  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.dtype_columns = new Array();

  reportElement.edge_array = new Array();
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;

  reportElement.datasources = new Object();
  reportElement.sources_array = new Array();
  reportElement.datatypes   = new Object();

  reportElement.datasource_mode = "feature";  //feature, edge, shared_element
  reportElement.datasource_submode = "all";
  reportElement.datasourceElementID = undefined;  //for shared_element mode
  reportElement.source_ids = "";
  reportElement.query_filter = "";
  reportElement.collaboration_filter = "";
  reportElement.query_format = "fullxml";
  reportElement.query_edge_search_depth = 1;
  reportElement.load_on_page_init = false;
  reportElement.focus_feature = null;
  reportElement.filter_feature_ids = "";
  reportElement.hide_zero = false;

  reportElement.table_page_size = 20;
  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;

  reportElement.init_selection = "";
  reportElement.selected_id = "";
  reportElement.selected_feature = null;
  reportElement.selected_edge = null;
  reportElement.selected_source = null;
  reportElement.selected_location = null;
  reportElement.search_data_filter = "";
  reportElement.show_only_search_matches = false;
  
  reportElement.resetable = true;
  reportElement.loading = false;  //not loaded

  reportElement.show_titlebar = true;
  reportElement.widget_search = true;
  reportElement.widget_filter = true;
  reportElement.widget_columns = true;
  reportElement.border = "inset";

  reportElement.layout_mode = "absolute";  //absolute, child
  reportElement.layout_parentID = null;    //linked to Row, Column, or Grid layoutElement
  reportElement.layout_row = 0;
  reportElement.layout_col = 0;
  reportElement.layout_xpos = current_report.new_element_abs_pos;
  reportElement.layout_ypos = current_report.new_element_abs_pos;
  current_report.new_element_abs_pos += 50;

  reportElement.content_width = 250;
  reportElement.content_height = 250;
  reportElement.auto_content_height = false;
  
  reportElement.cascade_triggers = new Array();
  
  reportElement.filterSubpanel = reportElement_filterSubpanel;
  reportElement.datasource     = reportElement_datasourceElement;

  //type specific initialization parameters
  if(reportElement.element_type == "treelist") {
    reportElement.title = "new TreeList";
    reportElement.sort_col = "name";
    reportElement.sort_reverse = false;
    reportElement.move_selection_to_top=true;
    //reportElementAddDatatypeColumn(reportElement, "name", "name", true);
    //reportElementAddDatatypeColumn(reportElement, "category", "category", true);
    //reportElementAddDatatypeColumn(reportElement, "source_name", "source_name", true);
    //reportElementAddDatatypeColumn(reportElement, "location_link", "location", false);
    //reportElementAddDatatypeColumn(reportElement, "location_string", "location", false);
  }
  if(reportElement.element_type == "table") {
    reportElement.title = "new Table";
    reportElement.sort_col = "name";
    reportElement.sort_reverse = false;
    //reportElementAddDatatypeColumn(reportElement, "name", "name", true);
    //reportElementAddDatatypeColumn(reportElement, "category", "category", true);
    //reportElementAddDatatypeColumn(reportElement, "source_name", "source_name", true);
    //reportElementAddDatatypeColumn(reportElement, "location_link", "location", false);
    //reportElementAddDatatypeColumn(reportElement, "location_string", "location", false);
  }
  if(reportElement.element_type == "chart") {
    reportElement.title = "new Chart Graph";
    reportElement.chart_type = "bubble";
    reportElement.display_type = "bubble";
    reportElement.focus_feature_mode= "progressive";
    reportElement.symetric_axis = false;
    reportElement.xaxis = { datatype: "", fixedscale:true, symetric: true, log:false };
    reportElement.yaxis = { datatype: "", fixedscale:true, symetric: true, log:false };
  }
  if(reportElement.element_type == "zenbugb") {
    reportElement.title = "new ZenbuGB";
    reportElement.datasource_mode = "";
    reportElement.widget_search = false;
    reportElement.widget_filter = false;
    reportElement.widget_columns = false;
    reportElement.zenbu_url = "http://fantom.gsc.riken.jp/zenbu";
    reportElement.view_config = "";
    reportElement.chrom_location = "";
  }
  if(reportElement.element_type == "html") {
    reportElement.title = "new HtmlElement";
    //reportElement.datasource_mode = "";
    reportElement.show_titlebar = false;
    reportElement.widget_search = false;
    reportElement.widget_filter = false;
    reportElement.widget_columns = false;
    reportElement.html_content = "";
  }
  if(reportElement.element_type == "category") {
    reportElement.title_prefix = "";
    reportElement.title = "";
    //reportElement.datasource_mode = "";
    reportElement.show_titlebar = true;
    reportElement.widget_search = false;
    reportElement.widget_filter = false;
    reportElement.widget_columns = false;
    reportElement.category_datatype = "";
    reportElement.hide_zero = true;
    reportElement.display_type = "";
    reportElement.colorspace = "Set3_bp_12";
  }
  if(reportElement.element_type == "tools_panel") {
    reportElement.title = "tools panel";
    reportElement.datasource_mode = "";
    reportElement.widget_search = false;
    reportElement.widget_filter = false;
    reportElement.widget_columns = false;
    reportElement.resetable = false;
    reportElement.loading = false;
    reportElement.layout_mode == "absolute";
    //reportElement.layout_xpos = masterRect.right - 200;
    //reportElement.layout_ypos = masterRect.top + 50;
    reportElement.content_width = 150;
    reportElement.content_height = 380;
  }
}


function reportElement_datasourceElement() {
  var datasourceElement = this;
  // var datasourceElementID = this.datasourceElementID;
  // if(this.newconfig && this.newconfig.datasourceElementID != undefined) { datasourceElementID = this.newconfig.datasourceElementID; }
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  while(datasourceElement.datasource_element) {
    datasourceElement = datasourceElement.datasource_element;
    //console.log(datasourceElement);
  }
  return datasourceElement;
}


//=================================================================
//
// Layout related code
//
//=================================================================

function reportsNewLayoutElement(layout_type, elementID, layout_parentID) {
  var layoutElement = new Object;
  
  if(!layout_type) { layout_type = "row" }
  if((layout_type!="row") && (layout_type!="col") && (layout_type!="grid") && (layout_type!="tab")) { layout_type = "row" }
  if(!elementID) { elementID = layout_type + (newElementID++); }
  //if(!elementID) { elementID = "layout" + (newElementID++); }

  layoutElement.element_type = "layout";
  layoutElement.layout_type = layout_type; //row, col, grid, tab
  layoutElement.elementID = elementID;
  layoutElement.main_div = null;
  layoutElement.main_div_id = layoutElement.elementID + "_div";
  layoutElement.datasource_mode = "";  //feature, edge, shared_element

  layoutElement.title_prefix = "";
  layoutElement.title = "layout " + layout_type + " : "+elementID;

  layoutElement.show_titlebar = false;
  layoutElement.widget_search = false;
  layoutElement.widget_filter = false;
  layoutElement.widget_columns = false;
  layoutElement.border = "dashed";

  layoutElement.layout_row = 0;
  layoutElement.layout_col = 0;
  if(layoutElement.layout_type == "row")  { layoutElement.content_width=200; layoutElement.content_height=100; }
  if(layoutElement.layout_type == "col")  { layoutElement.content_width=100; layoutElement.content_height=200; }
  
  if(layoutElement.layout_type == "tab")  { 
    layoutElement.content_width=300; 
    layoutElement.content_height=200;
    layoutElement.active_tab = 0;
    layoutElement.edit_active_tab = false;
    layoutElement.tab_style = "angled2"; //angled1, angled2, rectangle1 rectangle2
    layoutElement.tab_size_mode = "compacted";
    layoutElement.tabs_array = [ { title:"tab1" }, { title:"tab2" } ];
    layoutElement.configSubpanel = layoutElement_tab_configSubpanel;
  }
  
  layoutElement.layout_mode = "root";  //absolute, child, root
  layoutElement.layout_parentID = null;  //root
  if(layout_parentID) {
    layoutElement.layout_parentID = layout_parentID;
    layoutElement.layout_mode = "child";
  }
  
  //store into the hash of global elements on the page
  if(layoutElement.elementID) {
    current_report.elements[layoutElement.elementID] = layoutElement;
  }
  
  layoutElement.datasource = reportElement_datasourceElement;

  reportsDrawLayoutElement(layoutElement);
  
  return layoutElement;
}

function reportElement_layout_col_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.layout_col < b.layout_col) { return -1; }
  if(a.layout_col > b.layout_col) { return 1; }
  return 0;
}
function reportElement_layout_row_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.layout_row < b.layout_row) { return -1; }
  if(a.layout_row > b.layout_row) { return 1; }
  return 0;
}


function reportsUpdateLayoutElements() {
  console.log("reportsUpdateLayoutElements");
  //global reset layout for all layout elements
  
  //build array of all elements
  var layout_array = new Array();
  for(var elementID in current_report.elements) {
    var reportElement = current_report.elements[elementID];
    if(!reportElement) { continue; }
    reportElement.layout_depth = 0;
    layout_array.push(reportElement);
  }
  //first pass calculate the depth (actually an inverse depth, leaves are 0 and elements with children increase depth)
  for(var i=0; i<layout_array.length; i++) {
    var element = layout_array[i];
    while(element && element.layout_parentID) {
      parent = current_report.elements[element.layout_parentID];
      if(parent && (parent.layout_depth < element.layout_depth+1)) { parent.layout_depth = element.layout_depth+1; }
      element = parent;
    }
  }
  layout_array.sort(function(a, b){ return a.layout_depth - b.layout_depth;});
  for(var i=0; i<layout_array.length; i++) {
    var layoutElement = layout_array[i];
    reportsDrawLayoutElement(layoutElement);
  }
}

function reportsUpdateLayoutHierarchy(reportElement) {
  //process the layout hierarchy from the node and up to the parents
  if(!reportElement) { return; }
  reportsDrawLayoutElement(reportElement);
  
  var parent = current_report.elements[reportElement.layout_parentID];
  while(parent) {
    reportsDrawLayoutElement(parent);
    parent = current_report.elements[parent.layout_parentID];
  }
}

function reportsPrepElement(reportElement) {
  if(!reportElement) { return; }
  
  if(!reportElement.main_div_id) {
    reportElement.main_div_id = reportElement.elementID + "_div";
  }
  if(!reportElement.main_div) {
    var master_div = document.getElementById("zenbuReportsDiv");
    if(!master_div) { return; }
    
    //console.log("reportsPrepElement ["+reportElement.elementID+"]");
    var main_div = document.getElementById(reportElement.main_div_id);
    if(!main_div) {
      console.log("reportsPrepElement ["+reportElement.elementID+"] need to create main_div");
      main_div = document.createElement('div');
      main_div.id = reportElement.main_div_id;
      master_div.appendChild(main_div); //just so that it is anchored somewhere to start with
    }
    reportElement.main_div = main_div;
  }

  if(!reportElement.auxdiv) { //used for sub panels
    var auxID = reportElement.main_div_id + "_subpanel_aux";
    var auxdiv = document.getElementById(auxID);
    if(!auxdiv) {
      auxdiv = master_div.appendChild(document.createElement('div'));
      auxdiv.id = auxID;
      reportElement.auxdiv = auxdiv;
      auxdiv.setAttribute('style', "position:absolute; z-index:10; left:0px; top:0px; width:100px;");
    }
  }
  if(!reportElement.header_div) { // for titla area and widgets
    var headerID = reportElement.main_div_id + "_header_div";
    var header_div = document.getElementById(headerID);
    if(!header_div) {
      header_div = main_div.appendChild(document.createElement('div'));
    }
    reportElement.header_div = header_div;
  }
  return reportElement
}


function reportsDrawLayoutElement(layoutElement, traverse_down) {
  if(!layoutElement) { return; }
  if(layoutElement.element_type != "layout") { return; }
  reportsPrepElement(layoutElement);
  if(!layoutElement.main_div) { return; }

  console.log("reportsDrawLayoutElement ["+layoutElement.elementID+"] "+layoutElement.layout_type);
  var master_div = document.getElementById("zenbuReportsDiv");
  var masterRect = master_div.getBoundingClientRect();
  //console.log("masterRect x:"+masterRect.x+" y:"+masterRect.y+" left:"+masterRect.left+" top:"+masterRect.top+ " bottom:"+masterRect.bottom);

  if(!layoutElement.header_div) {
    layoutElement.header_div = document.createElement('div');
    layoutElement.header_div.innerHTML = "";
  }
  
  var active_tab_obj = null;
  if(layoutElement.layout_type == "tab") { 
    active_tab_obj = layoutElement.tabs_array[layoutElement.active_tab];
    if(active_tab_obj && active_tab_obj.child_elementID) {
      var childElement = current_report.elements[active_tab_obj.child_elementID];
      if(childElement) { active_tab_obj.child_element = childElement; }
    }
  }
  
  var children = new Array();
  for(var childID in current_report.elements) {
    var childElement = current_report.elements[childID];
    if(!childElement) { continue; }
    if(childElement.layout_parentID == layoutElement.elementID) {
      //console.log("layout child["+childElement.elementID+"] has parentID["+childElement.layout_parentID+"] : match found parent["+layoutElement.elementID+"]");
      //var locHash = "";
      //if(layoutElement.layout_type == "row")  { locHash = "col"+childElement.layout_col; }
      //if(layoutElement.layout_type == "col")  { locHash = "row"+childElement.layout_row; }
      //if(layoutElement.layout_type == "grid") { locHash = "row"+childElement.layout_row+"col"+childElement.layout_col; }
      //if(layoutElement.layout_type == "tab")  { locHash = "row"+childElement.layout_row+"col"+childElement.layout_col; }
      children.push(childElement);
    }
  }
  //console.log("found "+(children.length)+" children");
  
  if(layoutElement.layout_type == "disconnect")  {
    var layoutRect = layoutElement.main_div.getBoundingClientRect();
    for(var k=0; k<children.length; k++) {
      var childElement = children[k];
      if(!childElement) { continue; }
      var childRect = childElement.main_div.getBoundingClientRect();
      if(childElement.main_div.style.display != "none") {
        childElement.layout_xpos = childRect.x + window.scrollX;
        childElement.layout_ypos = childRect.y + window.scrollY;
      } else {
        childElement.layout_xpos = layoutRect.x +10 + window.scrollX + (k*10);
        childElement.layout_ypos = layoutRect.y + window.scrollY + (k*10);
      }
    }
    for(var k=0; k<children.length; k++) {
      var childElement = children[k];
      if(!childElement) { continue; }
      childElement.layout_parentID = null;
      childElement.layout_mode = "absolute";
      childElement.main_div.style.display = "block";
      master_div.appendChild(childElement.main_div); //move it to the master_div
      //reportsDrawElement(childElement.elementID);
      if(childElement.element_type == "layout") {
        reportsDrawLayoutElement(childElement, true);
      } else {
        reportsDrawElement(childElement.elementID);
      }
    }
    return layoutElement;
  }
  
  layoutElement.main_div.innerHTML = ""; //clear previous layout
  if(current_report.edit_page_configuration || (layoutElement.layout_type == "tab")) {
    layoutElement.main_div.appendChild(layoutElement.header_div); 
  }
  layoutElement.header_div.innerHTML = "";

  //double check children for gaps and overlaps, sort by row,col
  // I have idea where I insert by using a fractional number (like 2.5 to go between 2 and 3)
  // and then the loop below resets the row/col to the actual value thus fixing gaps
  // so just need a simple sort function here
  if(layoutElement.layout_type == "row")  {
    children.sort(reportElement_layout_col_sort_func);
  }
  if(layoutElement.layout_type == "col")  {
    children.sort(reportElement_layout_row_sort_func);
  }
 
  //temporarily attach all children to main_div to allow ClientRect to work
  for(var k=0; k<children.length; k++) {
    var childElement = children[k];
    if(!childElement) { continue; }
    if(!childElement.main_div) { continue; }
    if(childElement.layout_mode != "child") { continue; }
    layoutElement.main_div.appendChild(childElement.main_div); 
  }
  
  //pre-prep traverse down the heirarchy doing draws and updates
  if(traverse_down && (children.length>0)) {
    console.log("traverse down layout element with "+(children.length)+" children");
    for(var k=0; k<children.length; k++) {
      var childElement = children[k];
      if(!childElement) { continue; }
      if(childElement.element_type == "layout") {
        reportsDrawLayoutElement(childElement, true);
      } else {
        childElement.main_div.style.display = "block";
        reportsDrawElement(childElement.elementID);
      }
    }
  }

  var layout_color = "black";  //D62AEA 2AD6EA 00D6E9 00C2E9
  if(layoutElement.layout_type == "row") { layout_color = "#0070E9"; }
  if(layoutElement.layout_type == "col") { layout_color = "#00AFE9"; }
  if(layoutElement.layout_type == "tab") { layout_color = "#3F00E9"; }
  
  var table1 = layoutElement.main_div.appendChild(document.createElement('table'));
  table1.setAttribute('style', "padding:0; margin:0; margin-left:0; border-spacing:0; border-collapse:collapse;");
  if(current_report.edit_page_configuration) { table1.style.margin = "3px 0px 0px 3px"; }
  var tr1 = table1.appendChild(document.createElement('tr'));
  tr1.setAttribute('style', "padding:0; margin:0; border-spacing:0; border-collapse:collapse;");
  tr1.valign = "top";

  var max_width = 0;
  var max_height = 0;
  var tcontainer = layoutElement.main_div;
  var children_count = 0;
  for(var k=0; k<children.length; k++) {
    var childElement = children[k];
    if(!childElement) { continue; }
    children_count++;
    childElement.main_div.style.display = "block";
    
    if(layoutElement.layout_type == "tab") {
      if(childElement.layout_mode == "child") {
        if(active_tab_obj.child_elementID && (childElement.elementID == active_tab_obj.child_elementID)) { 
          childElement.main_div.style.display = "block";
        } else {    
          childElement.main_div.style.display = "none";
          children_count--;
          continue;
        }
      }
    }
    
    if(layoutElement.layout_type == "row")  {
      childElement.layout_col = k + 1;
      childElement.layout_row = 0;
      var td1 = tr1.appendChild(document.createElement('td'));
      td1.setAttribute('style', "padding:0; margin:0; border-spacing:0; border-collapse:collapse; vertical-align:top;");
      tcontainer = td1.appendChild(document.createElement('div'));
      //var style = "margin-left: 5px; margin-top: 3px; vertical-align:top; ";
      var style = "margin:0px; padding-right:3px; vertical-align:top; ";
      //tcontainer = layoutElement.main_div.appendChild(document.createElement('div'));
      //var style = "margin-left: 5px; margin-top: 3px; display:inline-block; vertical-align:top; ";
      if(childElement.layout_mode == "dragging") {
        style += "border:dashed; border-width:2px; border-color:"+layout_color+"; ";
        if(childElement.content_width)  { style += "width:"+(childElement.content_width+10)+"px; "; }
        if(childElement.content_height) { style += "height:"+(childElement.content_height+10)+"px; "; }
      }
      tcontainer.setAttribute('style', style);
      max_width += childElement.content_width+19;
      if(max_height < childElement.content_height+12) { max_height = childElement.content_height+12; }
    }
    if(layoutElement.layout_type == "col")  {
      childElement.layout_row = k + 1;
      childElement.layout_col = 0;
      var td1 = tr1.appendChild(document.createElement('td'));
      td1.setAttribute('style', "padding:0; margin:0; border-spacing:0; border-collapse:collapse;");
      td1.valign = "top";
      tcontainer = td1.appendChild(document.createElement('div'));
      //tcontainer = layoutElement.main_div.appendChild(document.createElement('div'));
      //var style = "margin-left: 5px; margin-top: 3px; vertical-align:top; ";
      var style = "margin:0px; padding-bottom:3px; vertical-align:top; ";
      if(childElement.layout_mode == "dragging") {
        style += "border:dashed; border-width:2px; border-color:"+layout_color+"; ";
        if(childElement.content_width)  { style += "width:"+(childElement.content_width+10)+"px; "; }
        if(childElement.content_height) { style += "height:"+(childElement.content_height+10)+"px; "; }
      }
      tcontainer.setAttribute('style', style);
      if(max_width < childElement.content_width+19) { max_width = childElement.content_width+19; }
      max_height += childElement.content_height+19;
      //prepare tr1 for next row in this column
      tr1 = table1.appendChild(document.createElement('tr'));
      tr1.setAttribute('style', "padding:0; margin:0; border-spacing:0; border-collapse:collapse;");
      tr1.valign = "top";
    }
    if(layoutElement.layout_type == "tab")  {
      console.log("layout active tab: child["+childElement.elementID+"] width:"+childElement.content_width+" height:"+childElement.content_height);
      var td1 = tr1.appendChild(document.createElement('td'));
      td1.setAttribute('style', "padding:0; margin:0; border-spacing:0; border-collapse:collapse; vertical-align:top;");
      tcontainer = td1.appendChild(document.createElement('div'));
      var style = "margin:0px; padding-bottom:3px; padding-right:0px; vertical-align:top; ";
      if(childElement.layout_mode == "dragging") {
        style += "border:dashed; border-width:2px; border-color:"+layout_color+"; ";
        if(childElement.content_width)  { style += "width:"+(childElement.content_width+10)+"px; "; }
        if(childElement.content_height) { style += "height:"+(childElement.content_height+10)+"px; "; }
      }
      tcontainer.setAttribute('style', style);
      max_width += childElement.content_width+19;
      if(max_height < childElement.content_height+12) { max_height = childElement.content_height+12; }
    }
    if(layoutElement.layout_type == "grid")  {
      //TODO: logic for "grid" to watch row/col and create table/tr/td appropriately
    }

    if(childElement.layout_mode == "child") {
      //console.log("layout parent ["+layoutElement.elementID+"] adding child main_div["+childElement.main_div_id+"]");
      tcontainer.appendChild(childElement.main_div);
    }
    childElement.layout_container = tcontainer;
  }
  //if(layoutElement.layout_type == "tab")  {
  //  if(max_width < 300)  { max_width = 300; }
  //  if(max_height < 100) { max_height = 100; }
  //}
  
  //if editing page ... draw border around the layout so we can find it
  //style = "white-space: nowrap; "
  style = "";
  if(current_report.edit_page_configuration) {
    //style += "border:dashed; border-width:2px; border-color:#D62AEA; padding:2px; border-top:1px solid;";
    style += "border:dashed; border-width:2px; border-color:"+layout_color+"; border-top:none; ";
    if(layoutElement.layout_type!="tab") { style += "padding:2px 2px 2px 2px; "; }
    if(children_count==0) {
      if(layoutElement.layout_type == "row")  { max_width=200; style += "width: 200px; height: 100px; "; }
      if(layoutElement.layout_type == "col")  { max_width=100; style += "width: 100px; height: 200px; "; }
      if(layoutElement.layout_type == "tab")  { max_width=300; style += "width: 300px; height: 100px; "; }
    }
    else {
      style += "width:"+max_width+"px; ";
      //if(layoutElement.layout_type == "col")  { style += "width: 100px; height: 200px; "; }
    }
  }
  if((layoutElement.layout_mode == "absolute") || (layoutElement.layout_mode == "dragging")) {
    style += "position:absolute; left:"+ layoutElement.layout_xpos +"px; top:"+ layoutElement.layout_ypos +"px; ";
  }
  if(children_count==0 && max_width<100) { max_width=100; style += "width:"+max_width+"px; "; }
  if(layoutElement.layout_type == "tab")  { style += "width:"+max_width+"px; "; }
  layoutElement.main_div.setAttribute('style', style);

  var closebar=null, reattachBar=null, movebar=null;
  if(current_report.edit_page_configuration) {
    //draw the style of the layout element, dragbar, and close icon
    // titla area first
    var header_div = layoutElement.header_div;
    header_div.innerHTML = "";

    var barwidth = max_width;
    closebar = header_div.appendChild(document.createElement('div'));
    closebar.setAttribute('style', "width:15px; height:5px; vertical-align:top; background:red; display:inline-block; float:right;");
    closebar.setAttribute("onmouseover", "eedbMessageTooltip(\"delete layout\",90);");
    closebar.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    closebar.setAttribute("onmousedown", "reportElementReconfigParam(\""+ layoutElement.elementID +"\", 'delete-layout');");
    barwidth -= 19;

    if(layoutElement.layout_mode == "absolute") {
      reattachBar = header_div.appendChild(document.createElement('div'));
      reattachBar.setAttribute('style', "width:15px; margin-right:4px; height:5px; vertical-align:top; background:black; display:inline-block; float:right;");
      reattachBar.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"reattach\",80);");
      reattachBar.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      reattachBar.setAttribute("onmousedown", "reportElementReconfigParam(\""+ layoutElement.elementID +"\", 'reattach-layout');");
      barwidth -= 19;
    }
    
    movebar = header_div.appendChild(document.createElement('div'));
    movebar.setAttribute('style', "width:"+(barwidth)+"px; height:5px; vertical-align:top; background:"+layout_color+";");
    movebar.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"move layout\",80);");
    movebar.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    movebar.setAttribute("onmousedown", "reportElementEvent(\""+layoutElement.elementID+"\", 'start_element_drag');");
    movebar.setAttribute("onmouseup",   "reportElementEvent(\""+layoutElement.elementID+"\", 'stop_element_drag');");
  }
  
  if(layoutElement.layout_type=="tab") {
    layoutElementDrawTabBar(layoutElement);
    //if(layoutElement.max_tab_offset > parseInt(layoutElement.main_div.clientWidth)) {
    if(layoutElement.max_tab_offset > max_width) {
      console.log("tabs width:"+layoutElement.max_tab_offset+" is wider than "+max_width+" : so resize");
      max_width = layoutElement.max_tab_offset;
      layoutElement.main_div.style.minWidth = max_width+"px";
      if(movebar) {
        if(reattachBar) { movebar.style.width = (max_width -38)+"px"; } else { movebar.style.width = (max_width -19)+"px"; }
      }
    }
    //if(active_tab_obj.child_elementID) { reportsDrawElement(active_tab_obj.child_elementID); }
    if(active_tab_obj.child_element) {
      if(active_tab_obj.child_element.element_type == "layout") {
          reportsDrawLayoutElement(active_tab_obj.child_element, true);
      } else {
        //childElement.main_div.style.display = "block";
        reportsDrawElement(active_tab_obj.child_element.elementID);
      }
    }
  }
  
  var layoutRect = layoutElement.main_div.getBoundingClientRect();
  //console.log("layoutRect "+layoutElement.main_div_id+" rect x:"+layoutRect.x+" y:"+layoutRect.y+" left:"+layoutRect.left+" top:"+layoutRect.top+" bottom:"+layoutRect.bottom);
  if(masterRect.bottom < layoutRect.bottom+10) {
    //console.log("master_div bottom:"+masterRect.bottom+" height:"+masterRect.height+" adjust because "+layoutElement.elementID + " bottom is "+layoutRect.bottom);
    var t_height = layoutRect.bottom - masterRect.top + 10;
    if(t_height<100) { t_height = 100; }
    //console.log("master_div new height: "+t_height);
    master_div.style.height = t_height + "px";
  }
  layoutElement.content_width  = parseInt(layoutRect.width)-14;
  layoutElement.content_height = parseInt(layoutRect.height)-14;

  return layoutElement;
}


function reportsLayoutElementCheckAddChild(layoutElement, reportElement) {
  //check if reportElement current bound rectangle overlaps with layout and then decide which location it should be in
  if(!layoutElement) { return false; }
  if(layoutElement.element_type != "layout") { return false; }
  if(!reportElement) { return false; }
  if(reportElement.element_type == "tools_panel") { return false; }
  if(reportElement.elementID == layoutElement.elementID) { return false; }
  if(reportElement.layout_parentID == layoutElement.elementID) {
    //console.log("layout checkAdd element["+reportElement.elementID+"] already child of ["+layoutElement.elementID+"]");
    return false;
  }
  if(reportElement.elementID == layoutElement.layout_parentID) {
    //console.log("layout checkAdd : can't flip : element["+layoutElement.elementID+"] already child of ["+reportElement.elementID+"]");
    return false;
  }

  var xpos = reportElement.layout_xpos - window.scrollX;
  var ypos = reportElement.layout_ypos - window.scrollY;
  
  var layoutRect = layoutElement.main_div.getBoundingClientRect();

  //TODO: maybe here is the best place for the tab logic. need to check which tab and if it already has a child
  //tab specific logic for upper left corner only
  if(layoutElement.layout_type == "tab") {
    var tab_obj = layoutElement.tabs_array[layoutElement.active_tab];
    if(!tab_obj) { return false; }
    if(tab_obj.child_elementID) { return false; }
    if((xpos>(layoutRect.left-20) && xpos<(layoutRect.left+20) && ypos>(layoutRect.top+10) && ypos<(layoutRect.top+50))) {
      //console.log("layout checkAddChild child["+reportElement.elementID+"] set parentID ["+layoutElement.elementID+"]");
      reportElement.layout_parentID = layoutElement.elementID;
      reportElement.layout_container = null;
      reportElement.layout_col = 0;
      reportElement.layout_row = 0;
      layoutElement.edit_active_tab=false;
      reportsUpdateLayoutHierarchy(reportElement);
      return true;
    }
    else 
      return false;
  }
  
  //if near corner of layoutElement can insert at the front
  if((layoutElement.layout_type != "tab") && (xpos>(layoutRect.left-20) && xpos<(layoutRect.left+20) && ypos>(layoutRect.top-20) && ypos<(layoutRect.top+20))) {
    //console.log("layout checkAddChild child["+reportElement.elementID+"] set parentID ["+layoutElement.elementID+"]");
    reportElement.layout_parentID = layoutElement.elementID;
    reportElement.layout_container = null;
    reportElement.layout_col = 0;
    reportElement.layout_row = 0;
    reportsUpdateLayoutHierarchy(reportElement);
    return true;
  }
    
  if((layoutElement.layout_type == "row") && (xpos<layoutRect.left || xpos>layoutRect.right || ypos<(layoutRect.top-20) || ypos>(layoutRect.top+20))) {
    return false;
  }
  if((layoutElement.layout_type == "col") && (xpos<(layoutRect.left-20) || xpos>(layoutRect.left+20) || ypos<layoutRect.top || ypos>layoutRect.bottom)) {
    return false;
  }

  //console.log("found a layout which I might be able to attach to ["+layoutElement.elementID+"]");
  //find correct location within for adding
  reportElement.layout_col = 0;
  reportElement.layout_row = 0;
  
  var children = new Array();
  for(var childID in current_report.elements) {
    var childElement = current_report.elements[childID];
    if(!childElement) { continue; }
    if(childElement.layout_parentID != layoutElement.elementID) { continue; }
    if(childElement.layout_mode != "child") { continue; }
    children.push(childElement);
  }
  if(layoutElement.layout_type == "row")  { children.sort(reportElement_layout_col_sort_func); }
  if(layoutElement.layout_type == "col")  { children.sort(reportElement_layout_row_sort_func); }

  var childElement = null;
  for(var k=0; k<children.length; k++) {
    childElement = children[k];
    if(!childElement) { continue; }
    
    var childRect = childElement.main_div.getBoundingClientRect();

    if((xpos>(childRect.left-20) && xpos<(childRect.left+20) && ypos>(childRect.top-20) && ypos<(childRect.top+20))) {
      //console.log("layout checkAddChild child["+reportElement.elementID+"] set parentID ["+layoutElement.elementID+"]");
      reportElement.layout_parentID = layoutElement.elementID;
      reportElement.layout_container = null;
      if(layoutElement.layout_type == "row") {
        reportElement.layout_col = childElement.layout_col - 0.5;
      }
      if(layoutElement.layout_type == "col") {
        reportElement.layout_row = childElement.layout_row - 0.5;
      }
      if(layoutElement.layout_type == "grid")  {
        //TODO: logic to watch row/col and create table/tr/td appropriately
      }
      reportsUpdateLayoutHierarchy(layoutElement);
      return true;
    }
  }

  if(childElement && (layoutElement.layout_type == "row") &&
     (xpos>(childRect.right-20) && xpos<(childRect.right+20) && ypos>(childRect.top-20) && ypos<(childRect.top+20))) {
    //console.log("layout row checkAddChild child["+reportElement.elementID+"] set parentID ["+layoutElement.elementID+"]");
    reportElement.layout_parentID = layoutElement.elementID;
    reportElement.layout_container = null;
    reportElement.layout_col = childElement.layout_col + 0.5;
    reportsUpdateLayoutHierarchy(layoutElement);
    return true;
  }

  if(childElement && (layoutElement.layout_type == "col") &&
     (xpos>(childRect.left-20) && xpos<(childRect.left+20) && ypos>(childRect.bottom-20) && ypos<(childRect.bottom+20))) {
    //console.log("layout col checkAddChild child["+reportElement.elementID+"] set parentID ["+layoutElement.elementID+"]");
    reportElement.layout_parentID = layoutElement.elementID;
    reportElement.layout_container = null;
    reportElement.layout_row = childElement.layout_row + 0.5;
    reportsUpdateLayoutHierarchy(layoutElement);
    return true;
  }

  return false;
}

//==== moving element for layout

function reportElementToggleLayoutDrag(reportElement, mode) {
  if(!reportElement || !reportElement.main_div) {
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    current_report.current_dragging_element = null;
    return;
  }
  
  var width = reportElement.main_div.offsetWidth;
  var height = reportElement.main_div.offsetWidth;
  //reportElement.preresize_width  = reportElement.main_div.offsetWidth;
  //reportElement.preresize_height = reportElement.main_div.offsetHeight;

  var e = window.event
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  //TODO: bug when grabbing element on a scrolled page. seems one of the coordinates is off, need to compare to me old code
  //feature_info is doing it ok
  
  //console.log("reportElementToggleLayoutDrag["+reportElement.elementID+"] mode="+mode+" x="+xpos+" y="+ypos+" width="+width+" height="+height);

  if(mode =='start') {
    current_report.current_dragging_element = reportElement;
    reportElement.layout_drag_startX = xpos;
    reportElement.layout_drag_startY = ypos;
    reportElement.layout_mode_orig = reportElement.layout_mode;
    reportElement.layout_mode = "dragging";
    reportElement.is_moving = true;

    var mainRect = reportElement.main_div.getBoundingClientRect();
    //console.log("main_div "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" right:"+mainRect.right+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
    //console.log("window.scrollX="+window.scrollX+" window.scrollY="+window.scrollY);
    
    var master_div = document.getElementById("zenbuReportsDiv");
    master_div.appendChild(reportElement.main_div);  //make sure it is moved to the master_div so that absolute coordinates work
    reportElement.layout_xpos = mainRect.x + window.scrollX +2;
    reportElement.layout_ypos = mainRect.y + window.scrollY +2;
    //reportsDrawElement(reportElement.elementID);

    if(reportElement.auxdiv) { reportElement.auxdiv.style.display = "none"; }
    //reportElementToggleSubpanel(reportElement.elementID, 'none'); //hide the subpanels when dragging
    //TODO: need to cascade down layout hierarchy and hide subpanels of children if moving a layout element

    //special code for the embedded <object> zenbuGB since this causes problems when doing addChild()
    if(reportElement.element_type == "zenbugb") {
      //reportsDrawZenbuGB(reportElement);
      reportElement.drawElement();
    }
    
    if(reportElement.layout_parentID) {  //update layout parent to create placeholder for moving element
      var layoutElement = current_report.elements[reportElement.layout_parentID];
      reportsDrawLayoutElement(layoutElement);
    }

    document.onmousemove = reportsElementMoveEvent;

    //set the relative starting x/y position within the panel
    reportElement.layout_drag_offsetX = xpos - (mainRect.x + window.scrollX);
    reportElement.layout_drag_offsetY = ypos - (mainRect.y + window.scrollY);
    reportsElementMoveEvent(e);
  }
  if(mode =='stop') {
    //console.log("stop dragging element");
    if(!reportElement.is_moving) { return; }
    if(reportElement.layout_parentID) { 
      reportElement.layout_mode = "child"; 
      var layoutElement = current_report.elements[reportElement.layout_parentID];
      if(layoutElement && layoutElement.layout_type == "tab") {
        var active_tab_obj = layoutElement.tabs_array[layoutElement.active_tab];
        if(active_tab_obj) { 
          active_tab_obj.child_elementID = reportElement.elementID; 
        }
      }
    }
    else { reportElement.layout_mode = "absolute"; }
    //reportElement.layout_mode = reportElement.layout_mode_orig;
    reportElement.is_moving=false;
    current_report.current_dragging_element = null;
    document.onmousemove = moveToMouseLoc;  //reset the global events back
    
    if(reportElement.auxdiv) { reportElement.auxdiv.style.display = "block"; }

    reportsDrawElement(reportElement.elementID);
    reportsUpdateLayoutHierarchy(reportElement);

    if(document.selection) { document.selection.empty(); }
    else if(window.getSelection) { window.getSelection().removeAllRanges(); }
  }
}


function reportsElementMoveEvent(e) {
  reportElement = current_report.current_dragging_element;
  if(!reportElement || !reportElement.header_div) {
    //console.log("no current drag, reset move-event");
    document.onmousemove = moveToMouseLoc;
    current_report.current_dragging_element = null;
    return;
  }
  
  if(!e) { e = window.event; }
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  //console.log("move x="+xpos+" ypos="+ypos);

  //var mainRect = reportElement.main_div.getBoundingClientRect();
  //console.log("main_div "+reportElement.main_div_id+" left:"+mainRect.left+" right:"+mainRect.right+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
  //if(xpos<mainRect.left || xpos>mainRect.right || ypos < mainRect.top || ypos > mainRect.bottom) {
  //  console.log("move fell outside the header_rect so stop the dragging");
  //  //reportElementToggleLayoutDrag(reportElement, "stop");
  //}
  
  xpos = xpos - reportElement.layout_drag_offsetX;
  ypos = ypos - reportElement.layout_drag_offsetY;
  reportElement.layout_xpos = xpos;
  reportElement.layout_ypos = ypos;

  reportElement.main_div.style.position = "absolute";
  reportElement.main_div.style.left = reportElement.layout_xpos + "px";
  reportElement.main_div.style.top  = reportElement.layout_ypos + "px";
  
  //First check if I've moved far enough outside my current parent to detach
  var master_div = document.getElementById("zenbuReportsDiv");
  var layoutElement = current_report.elements[reportElement.layout_parentID];
  if(master_div && layoutElement && reportElement.layout_container) {
    var layoutRect = reportElement.layout_container.getBoundingClientRect();
    console.log("layoutRect "+reportElement.main_div_id+" left:"+layoutRect.left+" right:"+layoutRect.right+" top:"+layoutRect.top+" bottom:"+layoutRect.bottom);
    if(xpos<(layoutRect.left+window.scrollX-30) || xpos>(layoutRect.left+window.scrollX+30) ||
       ypos < (layoutRect.top+window.scrollY-30) || ypos > (layoutRect.top+window.scrollY+30)) {
      console.log("moved outside layout parent so detach");
      reportElement.layout_parentID = null;
      reportElement.layout_container = null;
      master_div.appendChild(reportElement.main_div);  //move it to the main so that it is anchored somewhere
      if(layoutElement.layout_type == "tab") { 
        var active_tab_obj = layoutElement.tabs_array[layoutElement.active_tab];
        if(active_tab_obj) { active_tab_obj.child_elementID = null; }
      }
      reportsUpdateLayoutHierarchy(layoutElement);
    }
    return;
  }
  
  if(!layoutElement) {
    //free floating so need to see if it is close enough to be attached to some layout element
    for(var elementID in current_report.elements) {
      var layoutElement = current_report.elements[elementID];
      if(!layoutElement) { continue; }
      if(layoutElement.element_type != "layout") { continue; }
      if(reportsLayoutElementCheckAddChild(layoutElement, reportElement)) { break; }
    }
  }
  
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }
}

//-- tab layout section

function layoutElementDrawTabBar(layoutElement) {
  if(!layoutElement) { return; }
    
  var master_div = document.getElementById("zenbuReportsDiv");

  var main_div = layoutElement.main_div;
  if(!main_div) { return; }

  if(!layoutElement.header_div) { return; }
  if(!layoutElement.auxdiv) { return; }
  
  console.log("layoutElementDrawTabBar ["+layoutElement.elementID+"] "+layoutElement.layout_type);

  var mainRect = main_div.getBoundingClientRect();
  //console.log("drawTabBar mainRect "+layoutElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top+" bottom:"+mainRect.bottom+" width:"+mainRect.width+" height:"+mainRect.height);

  var width = parseInt(main_div.clientWidth);
  //console.log("drawTabBar clientWidth:"+main_div.clientWidth+" as-int:"+width);
  if(width<20) { width=20; }
  //console.log("drawTabBar tab-bar width:"+width);
  
  //console.log("adjust TabBar auxdiv left:"+(mainRect.left+window.scrollX));
  var auxwidth = mainRect.width-5;
  if(auxwidth<425) { auxwidth = 425; }
  layoutElement.auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left+window.scrollX)+"px; top:"+(mainRect.top+window.scrollY+10)+"px; width:"+auxwidth+"px;");

  var detailsID = layoutElement.main_div_id + "_tab_details_panel";
  var details_div = document.getElementById(detailsID);
  if(!details_div) {
    details_div = document.createElement('div');
    layoutElement.auxdiv.appendChild(details_div);
    details_div.id = detailsID;
  }
  details_div.style.display = "none";
  details_div.innerHTML = "";

  var svg = layoutElement.header_div.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', '20px');
  //svg.setAttribute('style', 'float:left');

  //widgets
  var header_g = svg.appendChild(document.createElementNS(svgNS,'g'));  
  
  var tab_style = layoutElement.tab_style;
  if(layoutElement.newconfig && layoutElement.newconfig.tab_style != undefined) { tab_style = layoutElement.newconfig.tab_style; }

  var tab_size_mode = layoutElement.tab_size_mode;
  if(layoutElement.newconfig && layoutElement.newconfig.tab_size_mode != undefined) { tab_size_mode = layoutElement.newconfig.tab_size_mode; }

  var min_tab_width = 10;
  var tab_count=0;
  for(var tidx=0; tidx<layoutElement.tabs_array.length; tidx++) {
    var tab_obj = layoutElement.tabs_array[tidx];
    if(!tab_obj) { continue; }
    tab_count++

    var tab_label = header_g.appendChild(document.createElementNS(svgNS,'text')); //need to add so calc works
    tab_label.setAttributeNS(null, 'x', "10px");
    tab_label.setAttributeNS(null, 'y', '15px');
    if(tidx == layoutElement.active_tab) { tab_label.setAttributeNS(null, "font-weight","bold"); }
    tab_label.setAttributeNS(null, "font-size","12px");
    tab_label.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    var text1 = document.createTextNode(tab_obj.title);
    tab_label.appendChild(text1);
    tab_label.setAttribute("onclick", "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab', "+tidx+");");    

    tab_obj.tab_label = tab_label;

    //var bbox = tab_label.getBBox();
    var tlen = tab_label.getComputedTextLength();
    min_tab_width += tlen+20;
    //console.log("tab["+(tidx+1)+"] width:"+bbox.width);
    //console.log("tab["+(tidx+1)+"] tlen:"+tlen);
  }
  if(tab_style == "angled2") { min_tab_width += 10; }
  if(current_report.edit_page_configuration) { min_tab_width += 38; } //for add-tab and config-widget
  //console.log("tab width:"+width+"  min_tab_width:"+min_tab_width);
  
  var tab_offset = 0;
  for(var tidx=0; tidx<layoutElement.tabs_array.length; tidx++) {
    var tab_obj = layoutElement.tabs_array[tidx];
    if(!tab_obj) { continue; }

    var tab_color = "#A0A0A0";  //#808080
    if(tidx == layoutElement.active_tab) { tab_color = "#E7E7E7"; } //#F0F0F0 //#E7E7E7 is normal titlebar color

    var tab_g = header_g.insertBefore(document.createElementNS(svgNS,'g'), header_g.childNodes[0]);
    tab_obj.tab_g = tab_g;
    
    var tab_back_g = tab_g.appendChild(document.createElementNS(svgNS,'g'));

    tab_label = tab_obj.tab_label;
    tab_label.setAttributeNS(null, 'x', (tab_offset+10)+"px");
    tab_g.appendChild(tab_label);

    var tlen = tab_label.getComputedTextLength();
    
    if(tab_size_mode=="full_width" && width>min_tab_width) {
      var extra = parseInt((width - min_tab_width)/tab_count);
      //console.log("extend tab to fill: "+extra);
      tlen += extra;
    }

    if(tab_style == "angled1") {
      var points = "";
      points = points + tab_offset + "," + 20 + " ";
      points = points + (tab_offset+tlen+20) + "," + 20 + " ";
      points = points + (tab_offset+tlen+15) + "," + 3 + " ";
      points = points + (tab_offset+5) + "," + 3 + " ";

      var polygon = tab_back_g.appendChild(document.createElementNS(svgNS,'polygon'));
      polygon.setAttributeNS(null, 'points', points);
      polygon.setAttributeNS(null, 'fill', tab_color);
      polygon.setAttributeNS(null, 'stroke', "black");
      polygon.setAttributeNS(null, 'stroke-width', "1px");
      polygon.setAttribute("onclick",   "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab', "+tidx+");");
    }
    if(tab_style == "angled2") {
      var path1 = tab_back_g.appendChild(document.createElementNS(svgNS,'path'));
      points = "M"+(tab_offset+1.5)+" "+20;
      points += " V10";
      points += " Q"+(tab_offset+1.5)+" 3 "+(tab_offset+7)+" 3";
      points += " H"+(tab_offset+tlen+7);
      points += " Q"+(tab_offset+tlen+15)+" 3 "+(tab_offset+tlen+19)+" 10";
      points += " Q"+(tab_offset+tlen+25)+" 20 "+(tab_offset+tlen+32)+" 19";
      points += " V20";
      points += " Z";
      path1.setAttributeNS(null, 'd', points);      
      path1.setAttributeNS(null, 'fill', tab_color);
      path1.setAttributeNS(null, 'stroke', "black");
      path1.setAttributeNS(null, 'stroke-width', "1.5px");
      path1.setAttribute("onclick",   "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab', "+tidx+");");      
      tab_label.setAttributeNS(null, 'x', (tab_offset+7)+"px");
    }

    if(tab_style == "rectangle1") {
      var rect1 = tab_back_g.appendChild(document.createElementNS(svgNS,'rect'));
      rect1.setAttributeNS(null, 'x', tab_offset+1);
      rect1.setAttributeNS(null, 'y', 3);
      rect1.setAttributeNS(null, 'width', tlen+18);
      rect1.setAttributeNS(null, 'height', 17);
      rect1.setAttributeNS(null, 'fill', tab_color);
      //rect1.setAttributeNS(null, 'stroke', "black");
      //if(tidx == layoutElement.active_tab) { rect1.setAttributeNS(null, 'stroke-width', "2px"); }
      //else { rect1.setAttributeNS(null, 'stroke-width', "1px"); }
      rect1.setAttribute("onclick",   "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab', "+tidx+");");      
      tab_label.setAttributeNS(null, 'x', (tab_offset+8)+"px");
    }
    if(tab_style == "rectangle2") {
      //  <path d="M1 49 V5 Q1 1 5 1 H20 Q25 1 25 6 V49 Z" fill="rgba(255, 122, 0, 0.8)" />
      var path1 = tab_back_g.appendChild(document.createElementNS(svgNS,'path'));
      points = "M"+(tab_offset+1)+" "+20;
      points += " V10";
      points += " Q"+(tab_offset+1)+" 3 "+(tab_offset+8)+" 3";
      points += " H"+(tab_offset+tlen+11);
      points += " Q"+(tab_offset+tlen+18)+" 3 "+(tab_offset+tlen+18)+" 10";
      points += " V20";
      points += " Z";
      path1.setAttributeNS(null, 'd', points);      
      path1.setAttributeNS(null, 'fill', tab_color);
      path1.setAttribute("onclick",   "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab', "+tidx+");");      
      tab_label.setAttributeNS(null, 'x', (tab_offset+8)+"px");
    }

    if(current_report.edit_page_configuration && (tidx == layoutElement.active_tab)) {
      tab_g.setAttribute("onclick", "reportElementEvent(\""+layoutElement.elementID+"\", 'edit_active_tab');");
      if(layoutElement.edit_active_tab) {
        var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
        style += "width:250px; padding: 5px 5px 5px 5px; white-space: nowrap; ";
        style += "box-sizing: border-box; border: 1px solid darkgray; border-radius: 2px; background-color:#E6E6E6; ";
        style += "position:absolute; left:"+(tab_offset+5)+"px; top:17px; z-index:100; ";
        details_div.setAttribute('style', style);
                
        tdiv = details_div.appendChild(document.createElement('div'));
        var tspan = tdiv.appendChild(document.createElement('span'));
        tspan.innerHTML = "title: ";
        var input = tdiv.appendChild(document.createElement('input'));
        input.className = "sliminput";
        input.style.width = "190px";
        input.setAttribute('type', "text");
        input.setAttribute('value', tab_obj.title);
        input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab_title', this.value); }");
        input.setAttribute("onblur", "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab_title', this.value);");
        
        tdiv = details_div.appendChild(document.createElement('div'));
        var tspan = tdiv.appendChild(document.createElement('span'));
        tspan.innerHTML = "tab order: ";
        var input = tdiv.appendChild(document.createElement('input'));
        input.className = "sliminput";
        input.style.width = "30px";
        input.setAttribute('type', "text");
        input.setAttribute('value', tidx+1);
        input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab_idx', this.value); }");
        input.setAttribute("onblur", "reportElementEvent(\""+layoutElement.elementID+"\", 'active_tab_idx', this.value);");
        
        if(layoutElement.tabs_array.length>1) {
          button = tdiv.appendChild(document.createElement("input"));
          button.type = "button";
          button.className = "slimbutton";
          button.style.marginLeft = "25px";
          button.value = "delete tab";
          button.innerHTML = "delete tab";
          button.setAttribute("onclick", "reportElementEvent(\""+layoutElement.elementID+"\", 'delete_active_tab');");
        }

      } else {
        tab_g.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"click again to edit\",80);");
      }
      tab_g.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }

    tab_offset += tlen+20;
  }

  //move active tab to end of draw list so it is on top
  var active_tab_obj = layoutElement.tabs_array[layoutElement.active_tab];
  header_g.appendChild(active_tab_obj.tab_g);
  
  if(tab_style == "angled2") { tab_offset += 10; }

  //bottom line for all tabs
  var line1 = header_g.appendChild(document.createElementNS(svgNS,'line'));
  line1.setAttributeNS(null, 'x1', 0);
  line1.setAttributeNS(null, 'y1', 20);
  line1.setAttributeNS(null, 'x2', tab_offset);
  line1.setAttributeNS(null, 'y2', 20);
  line1.setAttributeNS(null, 'stroke', "black");
  line1.setAttributeNS(null, 'stroke-width', "3px");

  if(current_report.edit_page_configuration) {
    //need an add-tab widget here at the end
    tab_offset += 2;
    var add_tab_g = header_g.appendChild(document.createElementNS(svgNS,'g'));
    add_tab_g.setAttribute("onclick",   "reportElementEvent(\""+layoutElement.elementID+"\", 'add_tab');");
    add_tab_g.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"add a new tab\",80);");
    add_tab_g.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

    var rect1 = add_tab_g.appendChild(document.createElementNS(svgNS,'rect'));
    rect1.setAttributeNS(null, 'x', tab_offset);
    rect1.setAttributeNS(null, 'y', 3);
    rect1.setAttributeNS(null, 'rx', 4);
    rect1.setAttributeNS(null, 'ry', 4);
    rect1.setAttributeNS(null, 'width', 16);
    rect1.setAttributeNS(null, 'height', 16);
    rect1.setAttributeNS(null, 'fill', "#E6E6E6");

    var path1 = add_tab_g.appendChild(document.createElementNS(svgNS,'path'));
    points = "M"+(tab_offset+8)+" 5 v12 ";
    points += "M"+(tab_offset+2)+" 11 h12 ";
    path1.setAttributeNS(null, 'd', points);      
    path1.setAttributeNS(null, 'stroke', "black");
    path1.setAttributeNS(null, 'stroke-width', "2px");
    
    tab_offset += 36;
  }
  
  layoutElement.max_tab_offset = tab_offset + 5; // + 30;
  if(layoutElement.max_tab_offset > width) { 
    width = layoutElement.max_tab_offset; 
    svg.setAttributeNS(null, 'width', width+'px');
  }

  //widgets
  var widget_pos = width;
  if(current_report.edit_page_configuration && layoutElement.element_type!="tools_panel") {
    widget_pos -= 22;
    var configwidget = reportElementCreateConfigWidget(layoutElement);
    configwidget.setAttributeNS(null, 'transform', "translate("+widget_pos+",0)");
    header_g.appendChild(configwidget);
  }  
}


function layoutElement_tab_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
      
  var tdiv2 = configdiv.appendChild(document.createElement("div"));

  /*
  //tab_style
  var tab_style = this.tab_style;
  if(this.newconfig && this.newconfig.tab_style != undefined) { tab_style = this.newconfig.tab_style; }
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 5px;");
  span1.innerHTML = "tab style: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'tab_style', this.value);");
  var types = ["angled1", "angled2", "rectangle1", "rectangle2"];
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == tab_style) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }
  */

  //tab_size_mode
  var tab_size_mode = this.tab_size_mode;
  if(this.newconfig && this.newconfig.tab_size_mode != undefined) { tab_size_mode = this.newconfig.tab_size_mode; }
  radio1 = tdiv2.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_tab_size_mode_radio");
  radio1.setAttribute("value", "compacted");
  if(tab_size_mode == "compacted") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'tab_size_mode', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "compact tabs";
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_tab_size_mode_radio");
  radio2.setAttribute("value", "full_width");
  if(tab_size_mode == "full_width") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'tab_size_mode', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "full width tabs";

}


//===============================================================
//
// Genertic display functions for use later
//
//===============================================================


function reportElementEvent(elementID, mode, value, value2) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  reportElementUserEvent(reportElement, mode, value, value2);
}


function reportElementUserEvent(reportElement, mode, value, value2) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementUserEvent ["+elementID+"] "+mode+" "+value+" "+value2);
  current_report.active_cascades = {};  //start new user cascade
  reportElementCascadeEvent(reportElement, mode, value, value2);
}


function reportElementCascadeEvent(reportElement, mode, value, value2) {
  //internal event from a cascade not from a user interaction
  if(!reportElement) { return; }
  var starttime = new Date();

  var elementID = reportElement.elementID;
  console.log("reportElementCascadeEvent ["+elementID+"] "+mode+" "+value+" "+value2);
  
  var datasourceElement = reportElement.datasource();

  //
  // subclass method
  //
  if(reportElement.elementEvent) {
    //if(reportElement.elementEvent(mode, value, value2)) { return true; }
    reportElement.elementEvent(mode, value, value2);
  }

  //
  //select related block
  //
  if((mode=="clear_select") || ((mode == "select") && (value == reportElement.selected_id))) {
    //clear previous selection
    console.log(reportElement.elementID+" clear selection need to cascade");
    reportElement.selected_id = "";
    reportElement.selected_feature = null;
    reportElement.selected_edge = null;
    reportElement.selected_source = null;
    reportElement.selected_location = null;
    reportsDrawElement(elementID);
    reportElementTriggerCascade(reportElement, "select");
    return true;
  }
  
  if(mode == "select_location") { 
    reportElement.selected_location = value;
    reportElementTriggerCascade(reportElement, "select_location");
    return true;
  }
  if((mode == "select" || mode == "hyperlink_trigger") && (value != reportElement.selected_id)) {
    //first process selection_id to find feature, edge, feature1, feature2
    reportElement.selected_id = value;
    reportElement.selected_feature = null;
    reportElement.selected_edge = null;
    reportElement.selected_source = null;
    reportElement.selected_location = null;
    if(value) {
      var search_val = String(value).toLowerCase();
      if((datasourceElement.datasource_mode == "feature" || reportElement.element_type == "treelist")) {
        if(datasourceElement.features[value]) {
          reportElement.selected_feature = datasourceElement.features[value];
        } else {
          //console.log("selection in feature/treelist failed via ID lookup, trying loop mode search_val["+search_val+"]");
          for(var k=0; k<datasourceElement.feature_array.length; k++) {
            var feat1 = datasourceElement.feature_array[k];
            if(!feat1) { continue; }
            //if(!feature.filter_valid) { continue; }
            //if(reportElement.show_only_search_matches && !feature.search_match) { continue; }
            if((feat1.id == value) || (feat1.name == value)) {
              //console.log("found match via id or name");
              reportElement.selected_feature = feat1
              reportElement.selected_id = feat1.id;
              break;
            }
            for(var mdtag in feat1.mdata) { //new common mdata[].array system
              var mdvalue_array = feat1.mdata[mdtag];
              for(var idx1=0; idx1<mdvalue_array.length; idx1++) {
                var mdvalue = mdvalue_array[idx1];
                if(mdvalue && (mdvalue.toLowerCase().indexOf(search_val) >= 0)) {
                  //console.log("found match via mdata tag["+mdtag+"] value["+mdvalue+"]");
                  reportElement.selected_feature = feat1
                  reportElement.selected_id = feat1.id;
                  break;
                }
              }
              if(reportElement.selected_feature) { break; }
            }
            if(reportElement.selected_feature) { break; }
          }
        }
        if(reportElement.selected_feature) {
          console.log("selected feature ["+elementID+"] ["+reportElement.selected_feature.name +"  "+reportElement.selected_feature.id +"]");
        }
      }
      if(datasourceElement.datasource_mode == "edge" && datasourceElement.edge_array) {
        if(datasourceElement.selected_edge && datasourceElement.selected_edge.id == value) {
          reportElement.selected_edge = datasourceElement.selected_edge;
          //console.log("selected edge transfer from datasource ["+elementID+"] "+reportElement.selected_edge.id +"]");
        } else {
          for(var k=0; k<datasourceElement.edge_array.length; k++) {
            var edge = datasourceElement.edge_array[k];
            if(!edge) { continue; }
            if(!edge.filter_valid) { continue; }
            if(reportElement.focus_feature &&
               (reportElement.focus_feature.id != edge.feature1_id) &&
               (reportElement.focus_feature.id != edge.feature2_id)) { continue; }
            if((edge.id == reportElement.selected_id) || (edge.feature1.id == reportElement.selected_id) || (edge.feature2.id == reportElement.selected_id)) {
              reportElement.selected_edge = edge;
              //console.log("found matching edge ["+elementID+"] "+reportElement.selected_edge.id +"]");
              break;
            }
            //TODO: expand the selection methods to the new mdata/name/id loop logic
            /*
            if((edge.id == value) || (edge.name == value)) {
              console.log("found match via edge.id or edge.name");
              reportElement.selected_edge = edge
              reportElement.selected_id = edge.id;
              break;
            }
            //TODO: maybe need to search both f1.mdata and f2.mdata
            for(var mdtag in feat1.mdata) { //new common mdata[].array system
              var mdvalue_array = feat1.mdata[mdtag];
              for(var idx1=0; idx1<mdvalue_array.length; idx1++) {
                var mdvalue = mdvalue_array[idx1];
                if(mdvalue && (mdvalue.toLowerCase().indexOf(search_val) >= 0)) {
                  console.log("found match via mdata tag["+mdtag+"] value["+mdvalue+"]");
                  reportElement.selected_feature = feat1
                  reportElement.selected_id = feat1.id;
                  break;
                }
              }
              if(reportElement.selected_edge) { break; }
            }
             */
            if(reportElement.selected_edge) { break; }
          }
        }
      }
      if(datasourceElement.datasource_mode == "source") {
        //console.log("try selected_source lookup ["+value+"]");
        if(datasourceElement.datasources && datasourceElement.datasources[value]) {
          reportElement.selected_source = datasourceElement.datasources[value];
        }
      }
    }  //if(value)
  }
  
  if((mode == "select") || (mode == "select_location") || (mode == "hyperlink_trigger")) {
    //debug
    if(reportElement.selected_id) { console.log("selected_id ["+elementID+"] ["+reportElement.selected_id+"]"); }
    if(reportElement.selected_edge) { console.log("selected edge ["+elementID+"] "+reportElement.selected_edge.id +"]"); }
    if(reportElement.selected_feature) { console.log("selected feature ["+elementID+"] ["+reportElement.selected_feature.name +" "+reportElement.selected_feature.id +"]"); }
    if(reportElement.selected_source) { console.log("selected source ["+elementID+"] ["+reportElement.selected_source.name +" "+reportElement.selected_source.id +"]"); }
  }

  if(mode == "select") {
    reportElementShowSelectedFeature(elementID, reportElement.selected_id); //highlights the feature/edge in reportElement
    reportElementTriggerCascade(reportElement, "select");
//     var endtime = new Date();
//     var runtime = (endtime.getTime() - starttime.getTime());
//     console.log("select full cascade time ["+reportElement.elementID+"] "+(runtime)+"msec");
//     return true; //to avoid the full/slow redraw at the bottom of this function
  }
  if(mode == "select_location") {
    //console.log("trigger select_location ");
    //console.log("trigger select_location ["+reportElement.selected_feature.name +"  "+reportElement.selected_feature.chromloc +"]");
    //console.log("trigger select_location: " + feature.name + " :: "+feature.chromloc);
    reportElementShowSelectedFeature(elementID, reportElement.selected_id); //highlights the feature in reportElement
    reportElementTriggerCascade(reportElement, "select");
    reportElementTriggerCascade(reportElement, "select_location");
  }
  if(mode == "hyperlink_trigger") {
    //console.log("trigger hyperlink ");
    //console.log("trigger select_location ["+reportElement.selected_feature.name +"  "+reportElement.selected_feature.chromloc +"]");
    //console.log("trigger select_location: " + feature.name + " :: "+feature.chromloc);
    reportElementShowSelectedFeature(elementID, reportElement.selected_id); //highlights the feature in reportElement
    reportElement.selected_hyperlink_datatype = value2;
    reportElementTriggerCascade(reportElement, "hyperlink");
    //reportElementTriggerCascade(reportElement, "select");
  }
  
  //---------------------------------------------------------------------
  if(mode == "mouseover") {
    reportElement.mouseover_value = value;
  }
  if(mode == "clear") {
    reportElement.mouseover_value = null;
  }

  if(mode == "dtype_filter_select") {
    reportElement.dtype_filter_select = value;
  }
  if(mode == "dtype-title") {
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.title = value2; }
    //reportElementColumnsInterface(elementID, 'refresh');
    reportElementToggleSubpanel(elementID, 'refresh');
  }
  if(mode == "dtype-colnum") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      if(parseInt(value2) < dtype.colnum) { dtype.colnum = parseInt(value2) - 0.5; }
      else { dtype.colnum = parseInt(value2) + 0.5; }
    }
    //reportElementColumnsInterface(elementID, 'refresh');
    reportElementToggleSubpanel(elementID, 'refresh');
  }
  if(mode == "dtype_signal_order") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      if(parseInt(value2) < dtype.signal_order) { dtype.signal_order = parseInt(value2) - 0.5; }
      else { dtype.signal_order = parseInt(value2) + 0.5; }
      console.log("dtype: "+dtype.datatype+" signal_order:"+dtype.signal_order);
    }
    //reportElementColumnsInterface(elementID, 'refresh');
    reportElementToggleSubpanel(elementID, 'refresh');
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-highlight") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      //console.log("dtype-highlight ["+value2+"]");
      if(value2 && (value2.charAt(0) != "#")) { value2 = "#"+value2; }
      if(value2 == "#EBEBEB") { value2 = ""; }
      //console.log("dtype-highlight ["+value2+"]");
      dtype.highlight_color = value2;
    }
    reportElementToggleSubpanel(elementID, 'refresh');
  }
  if(mode == "dtype-visible") {
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.visible = !dtype.visible; }
  }
  if(mode == "dtype_signal_active") {
    var dtype = reportElement.datatypes[value];
    if(dtype) { 
      dtype.signal_active = !dtype.signal_active; 
      dtype.visible = false; //safety step
    }
    reportElementToggleSubpanel(elementID, 'refresh');
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-user_modifiable") {
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.user_modifiable = !dtype.user_modifiable; }
  }
  if(mode == "dtype-filter") {  
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.filtered = !dtype.filtered; }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-add") {
    var dtype = reportElement.datatypes[reportElement.dtype_filter_select];
    if(dtype) { dtype.filtered = true; }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-remove") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      dtype.filtered = false;
      reportElement.dtype_filter_select = dtype.datatype;  //set to that which was just deleted
    }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-abs") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      dtype.filter_abs = !dtype.filter_abs;
      //switching abs/non-abs mode, so best to just reset
      if(dtype.filter_abs) {
        dtype.filter_min = 0.0;
        dtype.filter_max = "max";
      } else {
        dtype.filter_min = "min"; 
        dtype.filter_max = "max";
      }
    }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-min") {
    var val2_float = parseFloat(value2);
    var dtype = reportElement.datatypes[value];    
    if(dtype) {
      var max_val = dtype.max_val;
      var min_val = dtype.min_val;
      if(dtype.filter_abs) {
        min_val = 0.0;
        if(Math.abs(dtype.min_val)>max_val) { max_val = Math.abs(dtype.min_val); }
      }
      if(isNaN(val2_float))     { val2_float = min_val; }
      if(val2_float > max_val)  { val2_float = max_val; }
      if(val2_float < min_val)  { val2_float = min_val; }
      if((dtype.filter_max!="max") && (val2_float > dtype.filter_max)) { val2_float = dtype.filter_max; }
      if(!dtype.filter_abs && val2_float==min_val) { dtype.filter_min="min"; } else { dtype.filter_min = val2_float; }
      reportsPostprocessElement(elementID);
    }
  }
  if(mode == "dtype-filter-max") {  
    var val2_float = parseFloat(value2);
    if(isNaN(val2_float)) { value2="max"; }
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      var max_val = dtype.max_val;
      if(dtype.filter_abs && (Math.abs(dtype.min_val)>max_val)) {
        max_val = Math.abs(dtype.min_val);
      }
      if(val2_float < dtype.min_val)    { val2_float = dtype.min_val; }
      if(val2_float >= max_val)         { value2 = "max"; }
      if((dtype.filter_min!="min") && (val2_float < dtype.filter_min)) { val2_float = dtype.filter_min; }
      if(value2=="max") { dtype.filter_max="max"; } else { dtype.filter_max = val2_float; }
      reportsPostprocessElement(elementID);
    }
  }

  if(mode == "dtype-category-filter") {  
    var dtype = reportElement.datatypes[value];
    if(dtype) { 
      if(dtype.categories && dtype.categories[value2]) {
        dtype.categories[value2].filtered = !(dtype.categories[value2].filtered); 
      }
      dtype.filtered = false;
      for(var ctg in dtype.categories) {
        if(dtype.categories[ctg].filtered) {
          dtype.filtered = true;
          break;          
        }
      }
      reportsPostprocessElement(elementID);
    }
  }

  //if(mode == "update-zenbu") {
  //  console.log("update-zenbu");
  //  //a1.setAttribute("onclick", "reportElementEvent(\""+reportElement.elementID+"\", 'update-zenbu', this.value); return false;");
  //}
  
  if(mode == "feature-info") {  
    var feature = reportElement.features[value];
    if(!feature || (reportElement.selected_feature_info == value)) {
      feature = eedbGetObject(value); //uses jscript cache to hold recent objects
    }
    if(feature) {
      //console.log("show feature: " + value);
      zenbuDisplayFeatureInfo(feature); 
      reportElement.selected_feature_info = value;
    }
  }
  if(mode == "source-info") {
    var source = datasourceElement.datasources[value];
    if(source) { console.log("source-info using source from datasources hash full_load:" + source.full_load); }
    if(!source) { source = eedbGetObject(value); } //uses jscript cache to hold recent objects
    if(source) {
      if(!source.full_load) { source.request_full_load = true; }
      eedbDisplaySourceInfo(source);
    }
  }
  if(mode == "edge-info") {
    var edge = eedbGetObject(value); //uses jscript cache to hold recent objects
    if(edge) {
      //console.log("fetched edge");
      zenbuDisplayFeatureInfo(edge); 
    }
  }
  
  if(mode == "main_div_resize_mousedown") {
    if(reportElement.main_div) {
      reportElement.preresize_width  = reportElement.main_div.offsetWidth;
      reportElement.preresize_height = reportElement.main_div.offsetHeight;
      //console.log("Element ["+elementID+"] main_div_resize_mousedown width["+reportElement.preresize_width+"] height["+reportElement.preresize_height+"]");
    }
    return true;
  }
  if(mode == "main_div_resize_mouseup") {
    if(reportElement.main_div) {
      var width  = reportElement.main_div.offsetWidth;
      var height = reportElement.main_div.offsetHeight;
      //console.log("Element ["+elementID+"] main_div_resize_mouseup width["+width+"] height["+height+"]");
      if((width != reportElement.preresize_width) || (height != reportElement.preresize_height)) {
        //console.log("ReportElement ["+elementID+"] was resized!!!");

        reportElement.content_width  = width -14;
        reportElement.content_height = height - 14;;
        //reportsDrawTargetDEgenesTable(reportElement);
        //console.log("Element resized ["+elementID+"] main_div width["+reportElement.content_width+"] height["+reportElement.content_height+"]");

        if(reportElement.element_type == "chart") { reportElement.chart = null; }

        reportElement.resized = true;
        reportsDrawElement(elementID);
        reportElement.resized = false;
        
        var layoutElement = current_report.elements[reportElement.layout_parentID];
        if(layoutElement) { reportsUpdateLayoutHierarchy(layoutElement); }
      }
      if(reportElement.is_moving) { reportElementToggleLayoutDrag(reportElement, "stop"); }
    }
    return true;
  }
  
  if(mode == "start_element_drag") {
    reportElementToggleLayoutDrag(reportElement, "start");
    return true;
  }
  if(mode == "stop_element_drag") {
    reportElementToggleLayoutDrag(reportElement, "stop");
    return true;
  }
  
  if(mode == "active_tab") {
    if(reportElement.active_tab != value) { 
      reportElement.active_tab = value;
      reportsDrawLayoutElement(reportElement); 
    }
    return true;
  }
  if(mode == "add_tab" && (reportElement.layout_type == "tab")) {
    reportElement.active_tab = reportElement.tabs_array.length;
    reportElement.tabs_array.push({ title:"tab"+(reportElement.active_tab+1) });
    reportsDrawLayoutElement(reportElement);
  }
  if(mode == "edit_active_tab" && (reportElement.layout_type == "tab")) {
    reportElement.edit_active_tab = !(reportElement.edit_active_tab);
    reportsDrawLayoutElement(reportElement);
  }
  if(mode == "active_tab_title" && (reportElement.layout_type == "tab")) {
    active_tab_obj = reportElement.tabs_array[reportElement.active_tab];
    if(active_tab_obj) { active_tab_obj.title = value; }
    reportsDrawLayoutElement(reportElement);
  }
  if(mode == "active_tab_idx" && (reportElement.layout_type == "tab")) {
    var new_idx = parseInt(value)-1;
    if(new_idx<0) { new_idx=0; }
    if(new_idx>=reportElement.tabs_array.length) { new_idx=reportElement.active_tab; }
    if(new_idx!=reportElement.active_tab) {      
      active_tab_obj = reportElement.tabs_array[reportElement.active_tab];
      if(active_tab_obj) {
        reportElement.tabs_array.splice(reportElement.active_tab,1);
        reportElement.tabs_array.splice(new_idx,0,active_tab_obj);
        reportElement.active_tab = new_idx;
      }
    }
    reportsDrawLayoutElement(reportElement);
  }
  if(mode == "delete_active_tab" && (reportElement.layout_type == "tab")) {
    reportElement.edit_active_tab = false;
    active_tab_obj = reportElement.tabs_array[reportElement.active_tab];
    if(active_tab_obj) {
      reportElement.tabs_array.splice(reportElement.active_tab,1);
      reportElement.active_tab--;
      if(reportElement.active_tab<0) { reportElement.active_tab=0; }
      if(active_tab_obj.child_elementID) {
        var master_div = document.getElementById("zenbuReportsDiv");
        var layoutRect = reportElement.main_div.getBoundingClientRect();
        var childElement = current_report.elements[active_tab_obj.child_elementID];
        if(childElement) {
          var childRect = childElement.main_div.getBoundingClientRect();
          childElement.layout_xpos = childRect.x + window.scrollX + 10;
          childElement.layout_ypos = childRect.y + window.scrollY + 10;
          childElement.layout_parentID = null;
          childElement.layout_mode = "absolute";
          childElement.main_div.style.display = "block";
          master_div.appendChild(childElement.main_div); //move it to the master_div
          reportsDrawElement(childElement.elementID);
        }
      }
    }
    reportsDrawLayoutElement(reportElement);
  }

  reportsDrawElement(elementID);  //default is to trigger redraw
}


function reportElementReconfigParam(elementID, param, value, altvalue) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  console.log("reportElementReconfigParam["+elementID+"] "+param+" value="+value+"  altvalue="+altvalue);

  if(param == "delete-element") {
    var master_div = document.getElementById("zenbuReportsDiv");
    if(reportElement.auxdiv) { master_div.removeChild(reportElement.auxdiv); }
    delete current_report.elements[elementID];
    master_div.appendChild(reportElement.main_div);  //make sure it is moved to the master_div
    master_div.removeChild(reportElement.main_div);  //then remove
    var layoutElement = current_report.elements[reportElement.layout_parentID];
    if(layoutElement) { reportsUpdateLayoutHierarchy(layoutElement); }//rebuilds and does not include
    return;
  }
  if(param == "delete-layout") {
    eedbClearSearchTooltip();
    var master_div = document.getElementById("zenbuReportsDiv");
    if(reportElement.auxdiv) { master_div.removeChild(reportElement.auxdiv); }
    
    //disconnect children from layout and move to master_div
    reportElement.layout_type = "disconnect";
    reportsDrawLayoutElement(reportElement);

    delete current_report.elements[elementID];
    master_div.appendChild(reportElement.main_div);  //make sure it is moved to the master_div
    master_div.removeChild(reportElement.main_div);  //then remove
    reportsUpdateLayoutElements(); //refresh global layout hierarchy
    return;
  }
  if(param == "reattach-layout") {
    console.log("reattach-layout");
    eedbClearSearchTooltip();
    reportElement.layout_mode = "root";
    reportElement.layout_parentID = null;
    reportsDrawLayoutElement(reportElement);
    return;
  }

  if(param == "content_width") {
    reportElement.content_width = parseInt(value);
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportElement.resized = true;
    reportsDrawElement(elementID);
    reportElement.resized = false;
    reportsUpdateLayoutHierarchy(reportElement);
    return;
  }
  if(param == "content_height") {
    reportElement.auto_content_height = false;
    if(value == "auto") { reportElement.auto_content_height=true; }
    else { reportElement.content_height = parseInt(value); }
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportElement.resized = true;
    reportsDrawElement(elementID);
    reportElement.resized = false;
    reportsUpdateLayoutHierarchy(reportElement);
    return;
  }

  if(reportElement.newconfig === undefined) {
    reportElement.newconfig = new Object;
  }
  var newconfig = reportElement.newconfig;

  //first do the subclass method if defined
  if(reportElement.reconfigureParam) { 
    if(reportElement.reconfigureParam(param, value, altvalue)) { return; } 
  }

  //general
  if(param == "title") {
    if(!value) { value = ""; }
    newconfig.title_prefix = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    return;
  }
  if(param == "description") {  newconfig.description = value; return; }
  if(param == "backColor") {
    if(!value) { value = "#F6F6F6"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    newconfig.backColor = value;
  }

  if(param == "widget_filter") {
    if(newconfig.widget_filter === undefined) { newconfig.widget_filter = reportElement.widget_filter; }
    newconfig.widget_filter = !newconfig.widget_filter;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "widget_search") {
    if(newconfig.widget_search === undefined) { newconfig.widget_search = reportElement.widget_search; }
    newconfig.widget_search = !newconfig.widget_search;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "widget_columns") {
    if(newconfig.widget_columns === undefined) { newconfig.widget_columns = reportElement.widget_columns; }
    newconfig.widget_columns = !newconfig.widget_columns;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "show_titlebar") {
    if(newconfig.show_titlebar === undefined) { newconfig.show_titlebar = reportElement.show_titlebar; }
    newconfig.show_titlebar = !newconfig.show_titlebar;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "border_type") {
    newconfig.border = value;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "display_type") {
    newconfig.display_type = value;
  }
  if(param == "category_method") {
    newconfig.category_method = value;
  }
  if(param == "ctg_value_datatype") {
    newconfig.ctg_value_datatype = value;
  }
  
  if(param == "tab_style") {
    newconfig.tab_style = value;
    reportsDrawLayoutElement(reportElement);
  }
  if(param == "tab_size_mode") {
    newconfig.tab_size_mode = value;
    reportsDrawLayoutElement(reportElement);
  }

  //search_data system
  if(param == "search_data_filter") { newconfig.search_data_filter = value; return; }
  if(param == "search_data_filter_search") {
    reportElement.search_data_filter = "";
    if(newconfig.search_data_filter) { reportElement.search_data_filter = newconfig.search_data_filter; }
    reportElementSearchData(reportElement.elementID); //resets the search_match flag and performs refresh on panel
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    //if(reportElement.element_type == "table") { reportsPostprocessTable(reportElement); } //to readjust the filter_count
    reportsPostprocessElement(reportElement.elementID); //to readjust the filter_count and cascade to dependant elements
    reportsDrawElement(elementID);
    return;
  }
  if(param == "search_data_filter_clear") {
    reportElement.search_data_filter = "";
    reportElement.show_only_search_matches = false;
    reportElementSearchData(reportElement.elementID); //resets the search_match flag and performs refresh on panel
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    //if(reportElement.element_type == "table") { reportsPostprocessTable(reportElement); } //to readjust the filter_count
    reportsPostprocessElement(reportElement.elementID); //to readjust the filter_count and cascade to dependant elements
    reportsDrawElement(elementID);
    return;
  }
  if(param == "show_only_search_matches") {
    reportElement.show_only_search_matches = value;
    //reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportElementToggleSubpanel(elementID, 'none'); //hide panel
    //if(reportElement.element_type == "table") { reportsPostprocessTable(reportElement); } //to readjust the filter_count
    reportsPostprocessElement(reportElement.elementID); //to readjust the filter_count and cascade to dependant elements
    reportsDrawElement(elementID);
    //reportElementTriggerCascade(reportElement, "postprocess");
    return;
  }


  //datasource
  if(param == "datasource_mode") {  newconfig.datasource_mode = value; }
  if(param == "datasource_submode") {  newconfig.datasource_submode = value; }
  if(param == "edit_datasource_query") {  newconfig.edit_datasource_query = true; }
  if(param == "edit_datasource_script") {  newconfig.edit_datasource_script = true; }
  if(param == "query_filter") {
    if(!value) { value = ""; }
    newconfig.query_filter = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    return;
  }
  if(param == "query_edge_search_depth") { newconfig.query_edge_search_depth = value; }
  
  if(param == "datasourceElementID") {
    if(!value) { value = ""; }
    newconfig.datasourceElementID = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    return;
  }
  if(param == "load_on_page_init") {  newconfig.load_on_page_init = value; }
  
  //cascade-trigger configuration
  if(param == "edit_cascade_triggers") {
    newconfig.edit_cascade_triggers = true;
    newconfig.cascade_triggers = new Array();
    for(var trig_idx=0; trig_idx<reportElement.cascade_triggers.length; trig_idx++){
      var trigger = reportElement.cascade_triggers[trig_idx];
      if(!trigger) { continue; }
      if(trigger.on_trigger!="hyperlink") {
        if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
        if(!trigger.targetElement) { continue; }
      }
      var t_trigger = reportsCopyCascadeTrigger(trigger);
      if(t_trigger) { newconfig.cascade_triggers.push(t_trigger); }
    }
  }
  if(param == "add_cascade_trigger") {
    console.log("add_cascade_trigger "+reportElement.elementID);
    var trigger = new Object();
    trigger.element         = reportElement;
    trigger.targetElementID = "";
    trigger.targetElement   = null;
    trigger.on_trigger      = "select";
    trigger.action_mode     = "select";
    trigger.options         = "";
    newconfig.cascade_triggers.push(trigger);
  }
  if(param == "delete_cascade_trigger") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger.on_trigger == "hyperlink") {
        reportElement.datatypes[trigger.hyperlink_datatype] = null;
        reportElement.dtype_columns = new Array();
        for(var dtype in reportElement.datatypes) {
          var dtype_col = reportElement.datatypes[dtype];
          if(dtype_col) { reportElement.dtype_columns.push(dtype_col); }
        }
      }
      newconfig.cascade_triggers.splice(idx, 1);
    }
  }
  if(param == "copy_cascade_trigger") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var t_trigger = reportsCopyCascadeTrigger(newconfig.cascade_triggers[idx]);
      if(t_trigger) {
        newconfig.cascade_triggers.splice(idx, 0, t_trigger);
      }
    }
  }
  if(param == "trigger_on_trigger") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) { trigger.on_trigger = altvalue; }
      if(trigger.on_trigger == "hyperlink") {
        //find new hyper# 
        for(idx2=1; idx2<200; idx2++) {
          var dtype = "hyper"+(idx2);
          var dtype_col = reportElement.datatypes[dtype];
          if(!dtype_col) { trigger.hyperlink_datatype = dtype; break; }
          else { console.log("searching hyperlink_datatype: exists: "+dtype); }
        }
        var t_col = reportElementAddDatatypeColumn(reportElement, trigger.hyperlink_datatype);
        t_col.visible = true;
        t_col.col_type = "hyperlink";
      }
    }
  }
  if(param == "trigger_action_mode") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) {
        trigger.action_mode = altvalue;
        if((altvalue == "set_focus") || (altvalue == "focus_load") || (altvalue == "set_filter_features")) {
          trigger.options = "selection";
        } else { trigger.options = ""; }
      }
    }
  }
  if(param == "trigger_options") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) { trigger.options = altvalue; }
    }
  }
  if(param == "trigger_targetID") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) {
        trigger.targetElementID = altvalue;
        trigger.targetElement = current_report.elements[trigger.targetElementID];
      }
    }
  }
  
  //treelist params
  if(param == "move_selection_to_top") {  newconfig.move_selection_to_top = value; }

  //charts
  if(param == "symetric_axis") {  newconfig.symetric_axis = value; }
  if(param == "xaxis_fixedscale") {  newconfig.xaxis_fixedscale = value; if(!value) { newconfig.xaxis_symetric=false; } }
  if(param == "yaxis_fixedscale") {  newconfig.yaxis_fixedscale = value; if(!value) { newconfig.yaxis_symetric=false; } }
  if(param == "xaxis_symetric")   {  newconfig.xaxis_symetric = value; if(value) { newconfig.xaxis_fixedscale=true; } }
  if(param == "yaxis_symetric")   {  newconfig.yaxis_symetric = value; if(value) { newconfig.yaxis_fixedscale=true; } }
  if(param == "xaxis_log")        {  newconfig.xaxis_log = value; }
  if(param == "yaxis_log")        {  newconfig.yaxis_log = value; }
  if(param == "xaxis_datatype")   {  newconfig.xaxis_datatype = value; }
  if(param == "yaxis_datatype")   {  newconfig.yaxis_datatype = value; }

  //zenbuGB
  if(param == "zenbu_url") { newconfig.zenbu_url = value; return; }
  if(param == "zenbu_view_config") { newconfig.view_config = value; return;}

  //category
  if(param == "category_datatype") { newconfig.category_datatype = value; }
  if(param == "category_method") { newconfig.category_method = value; }
  if(param == "ctg_value_datatype") { newconfig.ctg_value_datatype = value; }
  if(param == "display_type") { newconfig.display_type = value; }
  if(param == "hide_zero") { newconfig.hide_zero = value; }

  //accept/reset
  if(param == "cancel-reconfig") {
    reportElement.newconfig = undefined;
    if(reportElement.colorspaceCSI) { 
      reportElement.colorspaceCSI.newconfig = new Object();  //clear changes and go back to init state
      //zenbuColorSpaceInterfaceUpdate(reportElement.colorspaceCSI.id);
    }
    reportElementToggleSubpanel(elementID, 'refresh');
    reportsDrawElement(elementID);
    return;
  }

  if(param == "accept-reconfig") {
    var needReload=0;
    if(reportElement.newconfig) {
      var newconfig = reportElement.newconfig;
      if(newconfig.needReload) { needReload=1; }
      if(newconfig.widget_filter !== undefined) { reportElement.widget_filter = newconfig.widget_filter; }
      if(newconfig.widget_columns !== undefined) { reportElement.widget_columns = newconfig.widget_columns; }
      if(newconfig.widget_search !== undefined) { reportElement.widget_search = newconfig.widget_search; }
      if(newconfig.show_titlebar !== undefined) { reportElement.show_titlebar = newconfig.show_titlebar; }
      if(newconfig.border !== undefined) { reportElement.border = newconfig.border; }
      
      if(newconfig.datasource_mode !== undefined) {
        reportElement.datasource_mode = newconfig.datasource_mode; needReload=1;
        if((reportElement.datasource_mode == "source") && current_collaboration) {
          reportElement.collaboration_filter = current_collaboration.uuid;
        }
      }
      if(newconfig.datasource_submode !== undefined) { reportElement.datasource_submode = newconfig.datasource_submode; needReload=1; }
      if(newconfig.source_ids !== undefined) { reportElement.source_ids = newconfig.source_ids; needReload=1; }
      if(newconfig.query_filter !== undefined) { reportElement.query_filter = newconfig.query_filter; needReload=1; }
      if(newconfig.collaboration_filter !== undefined) { reportElement.collaboration_filter = newconfig.collaboration_filter; needReload=1; }
      if(newconfig.query_edge_search_depth !== undefined) { reportElement.query_edge_search_depth = newconfig.query_edge_search_depth; needReload=1; }
      if(newconfig.datasourceElementID !== undefined) { reportElement.datasourceElementID = newconfig.datasourceElementID; needReload=1;}
      if(newconfig.load_on_page_init !== undefined) {
        reportElement.load_on_page_init = newconfig.load_on_page_init;
        if(reportElement.load_on_page_init) { needReload=1; }
      }
      
      if(newconfig.cascade_triggers) {
        reportElement.cascade_triggers = newconfig.cascade_triggers;
        needReload=1;
      }
      
      if(newconfig.title_prefix !== undefined) {
        reportElement.title        = newconfig.title_prefix;
        reportElement.title_prefix = newconfig.title_prefix;
      }
      reportElement.title=reportElement.title_prefix;

      if(newconfig.symetric_axis !== undefined) { reportElement.symetric_axis = newconfig.symetric_axis; }

      if(newconfig.xaxis_fixedscale !== undefined) { reportElement.xaxis.fixedscale = newconfig.xaxis_fixedscale; reportElement.chart=null; }
      if(newconfig.yaxis_fixedscale !== undefined) { reportElement.yaxis.fixedscale = newconfig.yaxis_fixedscale; reportElement.chart=null; }
      if(newconfig.xaxis_symetric !== undefined)   { reportElement.xaxis.symetric = newconfig.xaxis_symetric; reportElement.chart=null; }
      if(newconfig.yaxis_symetric !== undefined)   { reportElement.yaxis.symetric = newconfig.yaxis_symetric; reportElement.chart=null; }
      if(newconfig.xaxis_log !== undefined)        { reportElement.xaxis.log = newconfig.xaxis_log; reportElement.chart=null; }
      if(newconfig.yaxis_log !== undefined)        { reportElement.yaxis.log = newconfig.yaxis_log; reportElement.chart=null; }
      if(newconfig.xaxis_datatype !== undefined)   { reportElement.xaxis.datatype = newconfig.xaxis_datatype; }
      if(newconfig.yaxis_datatype !== undefined)   { reportElement.yaxis.datatype = newconfig.yaxis_datatype; }

      if(newconfig.zenbu_url !== undefined)     { reportElement.zenbu_url = newconfig.zenbu_url; }
      if(newconfig.view_config !== undefined)   { reportElement.view_config = newconfig.view_config; }

      if(newconfig.html_content !== undefined)   { reportElement.html_content = newconfig.html_content; }

      if(newconfig.category_datatype !== undefined)   { reportElement.category_datatype = newconfig.category_datatype; }
      if(newconfig.category_method !== undefined)     { reportElement.category_method = newconfig.category_method; }
      if(newconfig.ctg_value_datatype !== undefined)  { reportElement.ctg_value_datatype = newconfig.ctg_value_datatype; }
      if(newconfig.display_type !== undefined)        { reportElement.display_type = newconfig.display_type; }
      if(newconfig.hide_zero !== undefined)           { reportElement.hide_zero = newconfig.hide_zero; }
      
      if(newconfig.display_type !== undefined)        { reportElement.display_type = newconfig.display_type; }
      if(newconfig.colorspace !== undefined)          { reportElement.colorspace = newconfig.colorspace; }
      //if(newconfig.colorspace_logscale !== undefined) { reportElement.colorspace_logscale = newconfig.colorspace; }
      if(reportElement.colorspaceCSI) {
        var CSI = reportElement.colorspaceCSI;
        if(CSI.newconfig.colorspace != undefined) { reportElement.colorspace = CSI.newconfig.colorspace; }
        if(CSI.newconfig.colorspace == "single-color") { reportElement.colorspace = CSI.newconfig.single_color; }
        if(CSI.newconfig.min_signal != undefined) { reportElement.colorspace_min = CSI.newconfig.min_signal; }
        if(CSI.newconfig.max_signal != undefined) { reportElement.colorspace_max = CSI.newconfig.max_signal; }
        if(CSI.newconfig.logscale != undefined)   { reportElement.colorspace_logscale = CSI.newconfig.logscale; }
        reportElement.colorspaceCSI = null; //clear
      }

      if(newconfig.tab_style !== undefined) { reportElement.tab_style = newconfig.tab_style; }
      if(newconfig.tab_size_mode !== undefined) { reportElement.tab_size_mode = newconfig.tab_size_mode; }

      if(newconfig.move_selection_to_top !== undefined) { reportElement.move_selection_to_top = newconfig.move_selection_to_top; }
    }
    
    //post checks
    if(reportElement.datasource_mode != "shared_element") {
      reportElement.datasourceElementID = ""; //need to clear if not in shared mode
    }

    //check if anything changed
    //var new_atr_count = 0;
    //for(e in reportElement.newconfig) { new_atr_count++; }
    //if(reportElement.uuid && (new_atr_count > 0)) {
    //  //something changed so shared tracj uuid nolonger valid
    //  reportElement.parent_uuid = reportElement.uuid;
    //  reportElement.uuid = undefined
    //}
    reportElement.newconfig = undefined;
    current_report.modified = true;

    if(needReload) {
      console.log("accept-reconfig reload");
      reportsLoadElement(elementID);
    } else {
      console.log("accept-reconfig postprocess");
      //reportsResetElement(elementID);
      reportsPostprocessElement(elementID);
    }
    reportsDisplayEditTools();
    reportsDrawElement(elementID);
    reportElementToggleSubpanel(elementID, 'none'); //close
    return;
  }

  reportElementToggleSubpanel(elementID, 'refresh'); //refresh
}


function reportElementDrawTitlebar(reportElement) {
  if(!reportElement) { return; }

  var show_titlebar = reportElement.show_titlebar;
  if(reportElement.newconfig && reportElement.newconfig.show_titlebar != undefined) { show_titlebar = reportElement.newconfig.show_titlebar; }
  if(!current_report.edit_page_configuration && !show_titlebar) { return; }
    
  var master_div = document.getElementById("zenbuReportsDiv");
  var masterRect = master_div.getBoundingClientRect();
  //console.log("masterRect x:"+masterRect.x+" y:"+masterRect.y+" left:"+masterRect.left+" top:"+masterRect.top+ " bottom:"+masterRect.bottom);

  var main_div = reportElement.main_div;
  if(!main_div) { return; }

  var mainRect = main_div.getBoundingClientRect();
  //console.log("mainRect "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
  /*
  if(masterRect.bottom < mainRect.bottom) {
    console.log("master_div bottom:"+masterRect.bottom+" height:"+masterRect.height+" adjust because "+reportElement.elementID + " bottom is "+mainRect.bottom);
    var t_height = mainRect.bottom - masterRect.top;
    console.log("master_div new height: "+t_height);
    master_div.style.height = t_height + "px";
  }
  */
  var width = parseInt(main_div.clientWidth);
  width = width - 5;
  //var width = mainRect.width-5;

  //sub panels
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) {
    //auxdiv = main_div.appendChild(document.createElement('div'));
    auxdiv = master_div.appendChild(document.createElement('div'));
    auxdiv.id = auxID;
    reportElement.auxdiv = auxdiv;
  }
  var auxwidth = mainRect.width-5;
  if(auxwidth<425) { auxwidth = 425; }
  auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left+window.scrollX)+"px; top:"+(mainRect.top+window.scrollY+10)+"px; width:"+auxwidth+"px;");

  reportElementToggleSubpanel(reportElement.elementID, 'refresh'); //build the sub-panels

  //main_div.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mousedown');");
  //main_div.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mouseup');");

  // titla area first
  var headerID = reportElement.main_div_id + "_header_div";
  var header_div = document.getElementById(headerID);
  if(!header_div) {
    header_div = main_div.appendChild(document.createElement('div'));
  }
  header_div.setAttribute('style', "width:100%;");
  header_div.innerHTML = "";
  reportElement.header_div = header_div;
  
  var svg = header_div.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', '20px');
  //svg.setAttribute('style', 'float:left');

  //widgets
  var header_g = svg.appendChild(document.createElementNS(svgNS,'g'));

  var titleBar = header_g.appendChild(document.createElementNS(svgNS,'rect'));
  titleBar.setAttributeNS(null, 'x', '0px');
  titleBar.setAttributeNS(null, 'y', '0px');
  titleBar.setAttributeNS(null, 'width',  (width)+"px");
  titleBar.setAttributeNS(null, 'height', "20px");
  titleBar.setAttributeNS(null, 'style', "fill: #E7E7E7;");
  if(current_report.edit_page_configuration) {
    titleBar.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'start_element_drag');");
    titleBar.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'stop_element_drag');");
  }
  
  var heading = header_g.appendChild(document.createElementNS(svgNS,'text'));
  heading.setAttributeNS(null, 'x', "10px");
  heading.setAttributeNS(null, 'y', '15px');
  heading.setAttributeNS(null, "font-weight","bold");
  heading.setAttributeNS(null, "font-size","14px");
  heading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  var text1 = document.createTextNode(reportElement.title);
  reportElement.chartTitleArea = text1;
  heading.appendChild(text1);
  if(current_report.edit_page_configuration) {
    heading.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'start_element_drag');");
    heading.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'stop_element_drag');");
  }

  //widgets
  var widget_pos = width - 4;

  if(current_report.edit_page_configuration && reportElement.element_type!="tools_panel") {
    widget_pos -= 22;
    var configwidget = reportElementCreateConfigWidget(reportElement);
    configwidget.setAttributeNS(null, 'transform', "translate("+widget_pos+",0)");
    header_g.appendChild(configwidget);
  }

  var widget_columns = reportElement.widget_columns;
  if(reportElement.newconfig && reportElement.newconfig.widget_columns != undefined) { 
    widget_columns = reportElement.newconfig.widget_columns; 
  }
  if(current_report.edit_page_configuration && (reportElement.element_type != "tools_panel") && (reportElement.element_type != "html")  &&
     (reportElement.element_type != "category") && (reportElement.element_type != "zenbugb") && (reportElement.element_type != "layout")) {
    widget_columns=true; 
  }
  if(widget_columns) {
    widget_pos -= 20;
    var widget = reportElementCreateColumnsWidget(reportElement);
    widget.setAttributeNS(null, 'transform', "translate("+ widget_pos +",2)");
    header_g.appendChild(widget);
  }
  
  var widget_filter = reportElement.widget_filter;
  if(reportElement.newconfig && reportElement.newconfig.widget_filter != undefined) { widget_filter = reportElement.newconfig.widget_filter; }
  if(widget_filter) {
    widget_pos -= 20;
    var widget = reportElementCreateFilterWidget(reportElement);
    widget.setAttributeNS(null, 'transform', "translate("+ widget_pos +",2)");
    header_g.appendChild(widget);
  }

  var widget_search = reportElement.widget_search;
  if(reportElement.newconfig && reportElement.newconfig.widget_search != undefined) { widget_search = reportElement.newconfig.widget_search; }
  if(widget_search) {
    widget_pos -= 20;
    var searchwidget = reportElementCreateSearchWidget(reportElement);
    searchwidget.setAttributeNS(null, 'transform', "translate("+ widget_pos +",3)");
    header_g.appendChild(searchwidget);
  }
  
  titleBar.setAttributeNS(null, 'width',  (widget_pos-5)+"px");
  
}

//----- subpanel control tools ---------------------------------------------------------------------

function reportElementToggleSubpanel(elementID, mode, submode) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.main_div) { return; }
  if(!mode) { return; }
  eedbClearSearchTooltip();
  //console.log("reportElementToggleSubpanel "+ elementID +" "+mode + " "+reportElement.element_type);

  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  if(reportElement.main_div) {
    var mainRect = reportElement.main_div.getBoundingClientRect();
    //console.log("main_div "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top);
    //auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left+window.scrollX)+"px; top:"+(mainRect.top+window.scrollY+10)+"px; width:"+auxwidth+"px;");
    auxdiv.style.left = (mainRect.left+window.scrollX)+"px";
    auxdiv.style.top  = (mainRect.top+window.scrollY+10)+"px";
  }
  
  //search interface panel is generic for all elements
  var searchDiv = reportElementSearchSubpanel(reportElement);

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var filterDiv, configDiv
  //filter system is based on the datasource
  if(reportElement.filterSubpanel) {
    filterDiv = reportElement.filterSubpanel();
  }

  columnsDiv = reportElementColumnsSubpanel(reportElement);

  //config is based on each element type
  configDiv = reportElementConfigSubpanel(reportElement);
  
  //var groupingdiv = gLyphsExpressionPanelGroupingSubpanel();
  //if(!groupingdiv) { return; }

  if(mode == reportElement.subpanel_mode) { mode = "none"; }
  if(mode == "refresh") { mode = reportElement.subpanel_mode; }
  else { reportElement.column_dtype_select = ""; }

  reportElement.subpanel_mode = mode;  

  //groupingdiv.style.display = "none";
  if(searchDiv) { searchDiv.style.display = "none"; }
  if(configDiv) { configDiv.style.display   = "none"; }
  if(filterDiv) { filterDiv.style.display   = "none"; }
  if(columnsDiv) { columnsDiv.style.display   = "none"; }

  //if(mode == "group")   { groupingdiv.style.display = "block"; }
  if(searchDiv && (mode == "search"))  { searchDiv.style.display = "block"; } 
  if(configDiv && (mode == "config"))  { configDiv.style.display = "block"; }
  if(filterDiv && (mode == "filter"))  { filterDiv.style.display = "block"; }
  if(columnsDiv) {
    if((mode == "columns") || (mode == "columns_down")) { columnsDiv.style.display = "block"; }
    if(submode == "shift") {
      if(columnsDiv.style.top == "20px") {
        columnsDiv.style.top = "40px"; 
        columnsDiv.shift_arrow.style.transform = "scaleY(-1)"; 
      } else {
        columnsDiv.style.top = "20px"; 
        columnsDiv.shift_arrow.style.transform = "scaleY(1)"; 
      }
    }
  }
    
  //TODO: maybe need the auxdiv resize logic here depending on the state
}


function reportElementCreateSearchWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'search');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"search\",50);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var backg = g1.appendChild(document.createElementNS(svgNS,'rect'));
  backg.setAttributeNS(null, 'x', '-2px');
  backg.setAttributeNS(null, 'y', '-2px');
  backg.setAttributeNS(null, 'width',  "18px");
  backg.setAttributeNS(null, 'height', "18px");
  backg.setAttributeNS(null, 'fill', 'rgb(255,255,255)'); //

  var datasourceElement = reportElement.datasource();
  if(datasourceElement.search_data_filter) {  
    backg.setAttributeNS(null, 'fill', '#ffc266'); //#ffe0b3 #bdf5bd
  }

  var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle1.setAttributeNS(null, 'cx', '5px');
  circle1.setAttributeNS(null, 'cy', '5px');
  circle1.setAttributeNS(null, "r","5px");
  circle1.setAttributeNS(null, "stroke", 'gray');
  circle1.setAttributeNS(null, "stroke-width", '2');
  //circle1.setAttributeNS(null, 'fill', '#E7E7E7');
  circle1.setAttributeNS(null, 'fill', 'white');

  var line1 = g1.appendChild(document.createElementNS(svgNS,'line'));
  line1.setAttributeNS(null, 'x1', '10px');
  line1.setAttributeNS(null, 'y1', '10px');
  line1.setAttributeNS(null, 'x2', '13px');
  line1.setAttributeNS(null, 'y2', '13px');
  line1.setAttributeNS(null, "stroke", 'gray');
  line1.setAttributeNS(null, "stroke-width", '3');
  line1.setAttributeNS(null, "stroke-linecap", 'round');

  return g1;
}


function reportElementCreateFilterWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'filter');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"filter\",60);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var backg = g1.appendChild(document.createElementNS(svgNS,'rect'));
  backg.setAttributeNS(null, 'x', '0px');
  backg.setAttributeNS(null, 'y', '0px');
  backg.setAttributeNS(null, 'width',  "18px");
  backg.setAttributeNS(null, 'height', "16px");
  //backg.setAttributeNS(null, 'fill', '#E7E7E7');  //titlebar color
  //backg.setAttributeNS(null, 'fill', 'rgb(245,245,250)');
  backg.setAttributeNS(null, 'fill', 'rgb(255,255,255)');

  /*
  //funnel
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray');
  path.setAttributeNS(null, 'fill', '#E7E7E7');
  var points = "M1,3 A3,3 0 0,1 1,0 L15,0 A3,3 0 0,1 15,3 L10,8 L10,14 L6,16 L6,8 Z";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);
  */
  
  /*
  // lines in/out dots for filter
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray');
  path.setAttributeNS(null, 'fill', '#E7E7E7');
  //var points = "M1,3 A3,3 0 0,1 1,0 L15,0 A3,3 0 0,1 15,3 L10,8 L10,14 L6,16 L6,8 Z";
  var points = "M1,0 L1,5 M5.5,0 L5.5,5 M10.5,0 L10.5,5 M15,0 L15,5 M5,11 L5,16 M11,11 L11,16";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);

  for(var i=0; i<3; i++) {
    var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
    circle1.setAttributeNS(null, 'cx', (2+i*6) + 'px');
    circle1.setAttributeNS(null, 'cy', '8px');
    circle1.setAttributeNS(null, "r","2px");
    circle1.setAttributeNS(null, "stroke", 'gray');
    circle1.setAttributeNS(null, "stroke-width", '1');
    circle1.setAttributeNS(null, "fill", 'gray');
  }
  */
  
  //dots in/out  wiggle for filter
  for(var i=0; i<3; i++) {
    var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
    circle1.setAttributeNS(null, 'cx', (3+i*6) + 'px');
    circle1.setAttributeNS(null, 'cy', '3px');
    circle1.setAttributeNS(null, "r","2px");
    circle1.setAttributeNS(null, "stroke", 'gray');
    circle1.setAttributeNS(null, "stroke-width", '1');
    circle1.setAttributeNS(null, "fill", 'gray');
  }

  var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle1.setAttributeNS(null, 'cx', '9px');
  circle1.setAttributeNS(null, 'cy', '13px');
  circle1.setAttributeNS(null, "r","2px");
  circle1.setAttributeNS(null, "stroke", 'gray');
  circle1.setAttributeNS(null, "stroke-width", '1');
  circle1.setAttributeNS(null, "fill", 'gray');

  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray');
  path.setAttributeNS(null, 'fill', '#E7E7E7');
  var points = "M0,7 L3,9 L6,7 L9,9 L12,7 L15,9 L18,7 ";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);
  
  return g1;
}


function reportElementCreateColumnsWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'columns');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"columns\",60);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var backg = g1.appendChild(document.createElementNS(svgNS,'rect'));
  backg.setAttributeNS(null, 'x', '0px');
  backg.setAttributeNS(null, 'y', '0px');
  backg.setAttributeNS(null, 'width',  "18px");
  backg.setAttributeNS(null, 'height', "16px");
  //backg.setAttributeNS(null, 'fill', '#E7E7E7');  //titlebar color
  //backg.setAttributeNS(null, 'fill', 'rgb(245,245,250)');
  backg.setAttributeNS(null, 'fill', 'rgb(255,255,255)');
  
  // column grid
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray');
  path.setAttributeNS(null, 'fill', 'white');
  //var points = "M1,3 A3,3 0 0,1 1,0 L15,0 A3,3 0 0,1 15,3 L10,8 L10,14 L6,16 L6,8 Z";
  var points = "M2,0 L18,0 L18,16 L2,16 Z M1,7 L18,7 M1,11.5 L18,11.5 M10,0 L10,16";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);

  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 3px; stroke: gray');
  var points = "M2,2 L18,2";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);
  
  return g1;
}


function reportElementCreateConfigWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onmousedown", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'config');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"configure\",80);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'style', 'stroke-width: 1px; stroke: gray');
  line.setAttributeNS(null, 'fill', '#E7E7E7');
  var points = '';
  for(var ang=0; ang<=28; ang++) {
    var radius = 8;
    if(ang % 4 == 0) { radius = 8; }
    if(ang % 4 == 1) { radius = 8; }
    if(ang % 4 == 2) { radius = 5.5; }
    if(ang % 4 == 3) { radius = 5.5; }
    var x = Math.cos(ang*2*Math.PI/28.0) *radius + 10;
    var y = Math.sin(ang*2*Math.PI/28.0) *radius + 10;
    points = points + x + "," + y + " ";
  }
  line.setAttributeNS(null, 'points', points);
  g1.appendChild(line);

  var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle1.setAttributeNS(null, 'cx', '10px');
  circle1.setAttributeNS(null, 'cy', '10px');
  circle1.setAttributeNS(null, "r","3px");
  circle1.setAttributeNS(null, "stroke", 'gray');
  circle1.setAttributeNS(null, "stroke-width", '1px');
  circle1.setAttributeNS(null, 'fill', '#E7E7E7');
  //circle1.setAttributeNS(null, 'fill', 'none');


  return g1;
}


function reportElementSearchSubpanel(reportElement) {
  if(!reportElement) { return; }
  if(reportElement.element_type == "layout") { return; }

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  //console.log("reportElementSearchSubpanel");
  
  //var width = parseInt(main_div.clientWidth);
  //width = width - 10;
  //if(width>350) { width=350;}
  //width=350;

  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  //console.log("reportElementSearchSubpanel aux ok");

  var subID = reportElement.main_div_id + "_search_subpanel";
  var searchdiv = document.getElementById(subID);
  if(!searchdiv) {
    searchdiv = document.createElement('div');
    //auxdiv.insertBefore(searchdiv, auxdiv.firstChild);
    auxdiv.appendChild(searchdiv);
    searchdiv.id = subID;
    searchdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                             "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                             //"width:"+(width-30)+"px; display:none; opacity: 0.95; " +
                             "width:350px; display:none; opacity: 1.0; " +
                             "position:absolute; top:20px; right:10px;"
                             );
  }
  //clearKids(searchdiv);
  searchdiv.innerHTML = "";
  var mainRect = main_div.getBoundingClientRect();
  var auxRect = auxdiv.getBoundingClientRect();
  //console.log("search panel auxdiv.width="+auxRect.width+"  maindiv.width="+mainRect.width);
  if(auxRect.width>mainRect.width) { searchdiv.style.left = "5px"; searchdiv.style.right = ""; }
  else { searchdiv.style.right = "10px"; searchdiv.style.left = ""; }

  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;

  //close button
  tdiv = searchdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onmousedown", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");

  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //subpanel title
  tdiv = searchdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "search";

  searchdiv.appendChild(document.createElement('hr'));

  //var form1 = searchdiv.appendChild(document.createElement('form'));
  //form1.setAttribute("onsubmit", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");
  //tdiv = form1.appendChild(document.createElement('div'));
  //var expInput = tdiv.appendChild(document.createElement('input'));
  //expInput.setAttribute('style', "width:"+(width-100)+"px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //expInput.setAttribute('style', "width:270px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //expInput.id = "expExp_search_inputID";
  //expInput.setAttribute('type', "text");
  //if(glyphTrack && glyphTrack.expfilter) {
  //  expInput.setAttribute('value', glyphTrack.expfilter);
  //}
  
  //search_data_filter
  var div1 = searchdiv.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  //var span0 = div1.appendChild(document.createElement('span'));
  //span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  //span0.innerHTML = "results filter:";
  var filter = datasourceElement.search_data_filter;
  //if(reportElement.newconfig && reportElement.newconfig.search_data_filter != undefined) { filter = reportElement.newconfig.search_data_filter; }
  if(!filter) { filter = ""; }
  var filterInput = div1.appendChild(document.createElement('input'));
  filterInput.className = "sliminput";
  filterInput.style.width = "235px";
  //filterInput.setAttribute('style', "width:270px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //filterInput.setAttribute('style', "width:235px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  filterInput.setAttribute('type', "text");
  filterInput.setAttribute('value', filter);
  filterInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+datasourceElement.elementID+"\", 'search_data_filter_search'); }");    
  filterInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");
  filterInput.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");
  filterInput.setAttribute("onblur", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");

  search_button = div1.appendChild(document.createElement("button"));
  search_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  search_button.setAttribute("onclick", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter_search');");
  search_button.innerHTML = "search";

  clear_button = div1.appendChild(document.createElement("button"));
  clear_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:3px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"clear filters\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  clear_button.setAttribute("onclick", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter_clear');");
  clear_button.innerHTML = "clear";

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  var source_count  = 0;
  if(datasourceElement.datasource_mode=="source")  { source_count = datasourceElement.sources_array.length; }

  tdiv = searchdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "font-size:10px; margin-left:5px; margin-left:40px;");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "searchable data";
  if(feature_count==0 && edge_count==0 && source_count==0) {
    tspan.innerHTML = "no data to search";
    search_button.setAttribute('disabled', "disabled");
  }
  if(feature_count>0) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML = "  features:<i>"+ feature_count+ "</i>";
  }
  if(edge_count>0) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML += "  edges:<i>"+ edge_count+"</i>";
  }
  if(source_count>0) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML += "  sources:<i>"+ source_count+"</i>";
  }

  //results display
  /*
  var feature_matches=0;
  for(var k=0; k<feature_count; k++) {
    var feature = datasourceElement.feature_array[k];
    if(!feature) { continue; }
    if(feature.search_match) { feature_matches++; }
  }
  var edge_matches=0;
  for(var k=0; k<datasourceElement.edge_array.length; k++) {
    var edge = datasourceElement.edge_array[k];
    if(!edge) { continue; }
    if(!edge.filter_valid) { continue; }
    if(edge.search_match) { edge_matches++; }
  }
  if(reportElement.datasource_mode == "edge" && edge_matches==0) { feature_matches=0; }
  */

  var feature_matches = datasourceElement.search_match_feature_count;
  var edge_matches    = datasourceElement.search_match_edge_count;
  var source_matches  = datasourceElement.search_match_source_count;

  if(feature_matches>0 || edge_matches>0 || source_matches>0) {
    tdiv = searchdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:12px; margin-left:10px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "color:#0000D0;"); //0071EC
    tspan.innerHTML = "found matching";
    
    //if(reportElement.datasource_mode == "feature") { }
  
    if(feature_matches>0) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "padding-left:5px;");
      tspan.innerHTML = "features:<i>"+ feature_matches+ "</i>";
    }
    if(edge_matches>0) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "padding-left:5px;");
      tspan.innerHTML += "edges:<i>"+ edge_matches+"</i>";
    }
    if(source_matches>0) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "padding-left:5px;");
      tspan.innerHTML += "sources:<i>"+ source_matches+"</i>";
    }

    tdiv = searchdiv.appendChild(document.createElement('div'));
    radio1 = tdiv.appendChild(document.createElement('input'));
    radio1.setAttribute("type", "radio");
    radio1.setAttribute("name", reportElement.elementID + "_searchmatchmode");
    radio1.setAttribute("value", "show_highlight");
    if(!(datasourceElement.show_only_search_matches)) { radio1.setAttribute('checked', "checked"); }
    radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'show_only_search_matches', false);");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "highlight matches";
    
    radio2 = tdiv.appendChild(document.createElement('input'));
    radio2.setAttribute("type", "radio");
    radio1.setAttribute("name", reportElement.elementID + "_searchmatchmode");
    radio2.setAttribute("value", "show_only");
    if(datasourceElement.show_only_search_matches) { radio2.setAttribute('checked', "checked"); }
    radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'show_only_search_matches', true);");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "show only matches";
  }
  if(filter!="" && feature_matches==0 && edge_matches==0 && source_matches==0) {
    tdiv = searchdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:12px; margin-left:10px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML = "no matches found";
  }
  
  return searchdiv;
}


function reportElementConfigSubpanel(reportElement) {
  //generic configuration panel with redirect to specific types for specifics
  if(!reportElement) { return; }
  
  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }
  
  var cfgID = reportElement.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) {
    configdiv = document.createElement('div');
    //auxdiv.insertBefore(main_div, auxdiv.firstChild);
    auxdiv.appendChild(configdiv);
    configdiv.id = cfgID;
    configdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:450px; display:none; opacity: 1.0; " +
                           "position:absolute; top:20px; right:10px;"
                           );
    reportElement.config_subpanel = configdiv;
  }
  //clearKids(configdiv);
  configdiv.innerHTML = "";

  //reset widths: auxdiv.style.width = min "425px" or "775px" or maindiv.width; configdiv.style.width = "400px" or "750px";
  var mainRect = main_div.getBoundingClientRect();
  //console.log("main_div "+main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top);
  var auxwidth = mainRect.width-5;
  var configwidth = 430;  //was 405
  if(auxwidth<460) { auxwidth = 460; } //was 430
  if(reportElement.newconfig && (reportElement.newconfig.edit_datasource_query || reportElement.newconfig.edit_cascade_triggers || reportElement.newconfig.edit_datasource_script)) {
    if(mainRect.width < 775) { auxwidth = 775; }
    configwidth = 750;
  }
  auxdiv.style.width = auxwidth+"px";
  configdiv.style.width = configwidth+"px";
  //decide if configdiv is left/right justified
  var auxRect = auxdiv.getBoundingClientRect();
  if(auxRect.width>mainRect.width) { configdiv.style.left = "5px"; configdiv.style.right = ""; }
  else { configdiv.style.right = "10px"; configdiv.style.left = ""; }

  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;
  
  //close button
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");
  
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = configdiv.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight:bold;");
  if(reportElement.element_type == "treelist") { tspan.innerHTML = "tree-list configuration: "; }
  if(reportElement.element_type == "table")    { tspan.innerHTML = "table configuration: "; }
  if(reportElement.element_type == "chart")    { tspan.innerHTML = "chart configuration: "; }
  if(reportElement.element_type == "zenbugb")  { tspan.innerHTML = "zenbuGB configuration: "; }
  if(reportElement.element_type == "html")     { tspan.innerHTML = "html configuration: "; }
  if(reportElement.element_type == "circos")   { tspan.innerHTML = "circos configuration: "; }
  if(reportElement.element_type == "genomewide"){ tspan.innerHTML = "genomewide configuration: "; }
  if(reportElement.element_type == "cytoscape") { tspan.innerHTML = "cytoscape configuration: "; }
  tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.setAttribute('style', "font-size:10px; color:blue; padding-left:5px; font-style:italic;");
  tspan.setAttribute('style', "font-size:10px; color:blue; padding-left:5px;");
  tspan.innerHTML = reportElement.elementID;
  
  if(reportElement.element_type != "category" && reportElement.element_type != "layout") {
    var title_prefix = reportElement.title_prefix;
    if(reportElement.newconfig && reportElement.newconfig.title_prefix != undefined) { title_prefix = reportElement.newconfig.title_prefix; }
    var div1 = configdiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "title:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id =  reportElement.elementID + "_config_title";
    titleInput.className = "sliminput";
    titleInput.style.width = "330px";
    //titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', title_prefix);
    titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
  }

  var sourcesDiv = reportElementBuildSourcesInterface(reportElement);
  
  var cascadesDiv = reportElementCascadeTriggersInterface(reportElement);

  configdiv.appendChild(document.createElement('hr'));
  
  //-------  type specific section -------------
  reportElement.config_options_div = configdiv.appendChild(document.createElement('div'));
  if(reportElement.configSubpanel) {
    reportElement.configSubpanel();
  }

  //---------- widget controls ------------------
  //configdiv.appendChild(document.createElement('hr'));
  var general_ctrl_div = document.createElement('div');
  if(reportElement.element_type != "layout") { configdiv.appendChild(general_ctrl_div); }

  tdiv2  = general_ctrl_div.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.show_titlebar;
  if(reportElement.newconfig && reportElement.newconfig.show_titlebar != undefined) { val1 = reportElement.newconfig.show_titlebar; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'show_titlebar', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "title bar";
  if(reportElement.element_type=="category") { tcheck.setAttribute('checked', "checked"); tcheck.setAttribute('disabled', "disabled"); }

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.widget_search;
  if(reportElement.newconfig && reportElement.newconfig.widget_search != undefined) { val1 = reportElement.newconfig.widget_search; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'widget_search', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "search widget";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.widget_filter;
  if(reportElement.newconfig && reportElement.newconfig.widget_filter != undefined) { val1 = reportElement.newconfig.widget_filter; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'widget_filter', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "filter widget";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.widget_columns;
  if(reportElement.newconfig && reportElement.newconfig.widget_columns != undefined) { val1 = reportElement.newconfig.widget_columns; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'widget_columns', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "columns widget";
  
  //---------- layout controls ------------------
  //configdiv.appendChild(document.createElement('hr'));
  tdiv2  = general_ctrl_div.appendChild(document.createElement('div'));
  
  var content_width = reportElement.content_width;
  var span0 = tdiv2.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "width:";
  var input = tdiv2.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', content_width);
  input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+reportElement.elementID+"\", 'content_width', this.value); }");
  input.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");

  var content_height = reportElement.content_height;
  if(reportElement.auto_content_height) { content_height = "auto"; }
  var span0 = tdiv2.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin-left:10px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "height:";
  var input = tdiv2.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', content_height);
  input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+reportElement.elementID+"\", 'content_height', this.value); }");
  input.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");

  //border options
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 15px;");
  span1.innerHTML = "border: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'border_type', this.value);");
  select.className = "dropdown";
  
  var opts1 = ["none", "simple", "inset", "double", "left", "round" ];
  var val1 = reportElement.border;
  if(reportElement.newconfig && reportElement.newconfig.border != undefined) { val1 = reportElement.newconfig.border; }
  for(var idx1=0; idx1<opts1.length; idx1++) {
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", opts1[idx1]);
    if(val1 == opts1[idx1]) { option.setAttribute("selected", "selected"); }
    option.innerHTML = opts1[idx1];
  }
  
  general_ctrl_div.appendChild(document.createElement('hr'));

  //---------- control buttons ------------------
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-top:5px; float:left;");
  button = tdiv2.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'delete-element');");
  button.value = "delete element";
  button.innerHTML = "delete element";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-top:5px; float:right;");
  button = tdiv2.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'cancel-reconfig');");
  button.value = "discard changes";
  button.innerHTML = "discard changes";
  if(!reportElement.newconfig) { button.setAttribute('disabled', "disabled"); }
  
  button = tdiv2.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'accept-reconfig');");
  button.value = "accept";
  button.innerHTML = "accept";
  if(!reportElement.newconfig) { button.setAttribute('disabled', "disabled"); }

  return configdiv;
}


function reportElement_filterSubpanel() {
  if(this.loading) { return; }
  //console.log("filtersubpanel "+this.elementID+"]");
  
  //if(!this.main_div) { return ctrl_div; }
  var main_div = this.main_div;
  if(!main_div) { return; }
  
  var auxID = this.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  //console.log("filtersubpanel "+this.elementID+" datasource ["+datasourceElement.elementID+"]");
  
  var panelID = this.main_div_id + "_filter_subpanel";
  var paneldiv = document.getElementById(panelID);
  if(!paneldiv) {
    paneldiv = document.createElement('div');
    //auxdiv.insertBefore(main_div, auxdiv.firstChild);
    auxdiv.appendChild(paneldiv);
    paneldiv.id = panelID;
    paneldiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                          "border:inset; border-width:2px; padding: 3px 3px 7px 3px; " +
                          "width:350px; display:none; opacity: 0.98; " +
                          "position:absolute; top:20px; right:10px;"
                          );
  }
  paneldiv.innerHTML = "";
  //clearKids(paneldiv);
  var mainRect = main_div.getBoundingClientRect();
  var auxRect = auxdiv.getBoundingClientRect();
  if(auxRect.width>mainRect.width) { paneldiv.style.left = "5px"; paneldiv.style.right = ""; }
  else { paneldiv.style.right = "10px"; paneldiv.style.left = ""; }

  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;
  
  //close button
  tdiv = paneldiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reportElementToggleSubpanel('"+this.elementID+"', 'none'); return false;");
  
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = paneldiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "Signal data filters";
  
  //paneldiv.appendChild(document.createElement('hr'));
  
  var tdiv, tspan, tinput, ta;
  
  this.dtype_filterbars = new Object; //hash to hold the filterbars for the active filters;
  
  //first show the active filters
  for(var dtype in datasourceElement.datatypes) {
    var dtype_col = datasourceElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }  //maybe "expression" or "signal"
    if(!dtype_col.filtered) { continue; }
    
    var tdiv2= paneldiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "border-top: solid 1px gray; padding-top:5px; margin: 5px 0px 0px 2px;");
    //tdiv2.setAttribute('style', "margin: 2px 0px 0px 2px;");
    
    var tspan = tdiv2.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight:bold;");
    var label =  dtype_col.title;
    if(dtype_col.title != dtype_col.datatype) { label +=  " ["+ dtype_col.datatype +"]"; }
    tspan.innerHTML = label;

    tcheck = tdiv2.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 0px 25px; vertical-align: middle; ");
    tcheck.setAttribute('type', "checkbox");
    if(dtype_col.filter_abs) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-abs', \""+dtype_col.datatype+"\"); return false");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.setAttribute("style", "margin-bottom:3px;");
    tspan2.innerHTML = "absolute value";
    
    var button = tdiv2.appendChild(document.createElement("button"));
    button.innerHTML = "remove filter";
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:7px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); 
    button.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-remove', \""+dtype_col.datatype+"\"); return false");

    //----
    
    var tdiv2= paneldiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
    //tdiv2.setAttribute('style', "border-bottom: solid 1px gray; margin: 0px 0px 0px 15px;");
    tdiv2.setAttribute('style', "margin: 2px 0px 2px 15px;");
    var tspan = tdiv2.appendChild(document.createElement('span'));
    tspan.innerHTML = "cutoffs min: ";
    var input = tdiv2.appendChild(document.createElement('input'));
    input.setAttribute("style", "font-size:12px; width:90px; padding: 3px 5px; margin: 2px 2px; box-sizing: border-box; border: 2px solid gray; border-radius: 4px;");
    input.setAttribute('type', "text");
    if(dtype_col.filter_min=="min") { input.setAttribute('value', "min"); }
    else { input.setAttribute('value', dtype_col.filter_min.toPrecision(6)); }
    input.setAttribute("onchange", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-min', \""+dtype_col.datatype+"\", this.value); return false");
        
    var tspan = tdiv2.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-left:10px;");
    tspan.innerHTML = "max: ";
    var input = tdiv2.appendChild(document.createElement('input'));
    input.setAttribute("style", "font-size:12px; width:90px; padding: 3px 5px; margin: 2px 2px; box-sizing: border-box; border: 2px solid gray; border-radius: 4px;");
    //input.setAttribute('size', "13");
    input.setAttribute('type', "text");
    if(dtype_col.filter_max=="max") { input.setAttribute('value', "max"); }
    else { input.setAttribute('value', dtype_col.filter_max.toPrecision(6)); }
    input.setAttribute("onchange", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-max', \""+dtype_col.datatype+"\", this.value); return false");
    
    //display double range bar info-graphic
    var bar_width = 300;
    var tdiv2= paneldiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "margin: 2px 0px 2px 15px;");
    
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "display:inline-block; position:relative; background-color:lightgray; border-radius:7px; height:14px; font-size:8px;");
    tspan2.style.width = bar_width+"px";
    //mouseover-hover display of the numerical value
    tspan2.setAttribute("onmousemove", "reportElementFilterHoverValue(\""+this.elementID+"\", \""+dtype_col.datatype+"\");");
    tspan2.setAttribute("onmousedown", "reportElementFilterHoverValue(\""+this.elementID+"\", \""+dtype_col.datatype+"\", 'start');");
    tspan2.setAttribute("onmouseup", "reportElementFilterHoverValue(\""+this.elementID+"\", \""+dtype_col.datatype+"\", 'end');");
    tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    tspan2.id = panelID+"_filter_bar_"+dtype_col.datatype;

    var max_val = dtype_col.max_val;
    if(dtype_col.filter_abs && (Math.abs(dtype_col.min_val)>max_val)) {
      max_val = Math.abs(dtype_col.min_val);
    }
    var min_val = dtype_col.min_val;
    if(dtype_col.filter_abs) { min_val = 0.0; }

    var filter_min = dtype_col.filter_min;
    if(dtype_col.filter_min=="min") { filter_min = min_val; }
    if(filter_min<min_val) { filter_min=min_val; }
    var filter_max = dtype_col.filter_max;
    if(dtype_col.filter_max=="max") { filter_max = max_val; }

    var varleft  = bar_width*((filter_min-min_val)/(max_val-min_val));
    var varwidth = bar_width*((filter_max-filter_min)/(max_val-min_val));
    if(dtype_col.filter_abs) {
      //center with zero at middle
      varwidth = bar_width*(filter_max/max_val);
      varleft  = (bar_width-varwidth)/2.0;
    }
    if(isNaN(varleft)) { varleft=0; }
    if(isNaN(varwidth)) { varwidth=0; }
    if(!isFinite(varleft)) { varleft=0; }
    if(!isFinite(varwidth)) { varwidth=0; }
    
    var clip1 = tspan2.appendChild(document.createElement('span'));
    clip1.setAttribute('style', "display:inline-block; position:absolute; height:14px; left:0px; top:0px; overflow:hidden;");
    clip1.style.left  = "0px";
    clip1.style.width = bar_width+"px";

    var bar1 = clip1.appendChild(document.createElement('span'));
    bar1.setAttribute('style', "display:inline-block; position:absolute; background-color:rgb(255,190,0); border-radius:7px; height:14px; left:0px; top:0px;");
    bar1.style.left  = varleft+"px";
    bar1.style.width = varwidth+"px";

    if(varwidth<12) {
      bar1.style.left = "0px";
      bar1.style.width = "12px";
      clip1.style.left = varleft+"px";
      clip1.style.width = varwidth+"px";
      //clip1.appendChild(bar1);
    }
    
    var filterBar = new Object;
    filterBar.bar1 = bar1;
    filterBar.bar2 = null;
    filterBar.clip1 = clip1;
    
    if(dtype_col.filter_abs) {
      //add a gray "mask" in the center
      var t_width = bar_width*(filter_min/max_val);
      var t_left  = (bar_width-t_width)/2.0;
      if(isNaN(t_left)) { t_left=0; }
      if(isNaN(t_width)) { t_width=0; }
      if(!isFinite(t_left)) { t_left=0; }
      if(!isFinite(t_width)) { t_width=0; }
      var bar2 = clip1.appendChild(document.createElement('span'));
      bar2.setAttribute('style', "display:inline-block; position:absolute; background-color:lightgray; height:14px; left:0px; top:0px;");
      bar2.style.left  = t_left+"px";
      bar2.style.width = t_width+"px";
      //dtype_col.filterBar_bar2  = bar2;
      filterBar.bar2 = bar2;
    }
    
    //dtype_col.filterBar_clip1 = clip1;
    //dtype_col.filterBar_bar1  = bar1;
    this.dtype_filterbars[dtype] = filterBar;
  }
  
  paneldiv.appendChild(document.createElement('hr'));

  //add new filter
  tdiv = paneldiv.appendChild(document.createElement('div'));
  var dtypeSelect = undefined;  
  var found_filter_select = false;
  var first_non_selected = undefined;
  for(var dtype in datasourceElement.datatypes) {
    var dtype_col = datasourceElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }  //maybe "expression" or "signal"
    if(dtype_col.filtered) { continue; }  //only show the non-filter datatypes

    if(!dtypeSelect) {
      dtypeSelect = tdiv.appendChild(document.createElement('select'));
      dtypeSelect.setAttribute('name', "datatype");  
      dtypeSelect.className = "dropdown";
      //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
      dtypeSelect.setAttribute("onchange", "reportElementEvent(\""+this.elementID+"\", 'dtype_filter_select', this.value); return false");
      dtypeSelect.innerHTML = ""; //to clear old content
    }
    var option = dtypeSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", dtype_col.datatype);
    if(datasourceElement.dtype_filter_select == dtype) { option.setAttribute("selected", "selected"); found_filter_select=true; }
    if(!found_filter_select && !first_non_selected) { first_non_selected = option; }
    var label =  dtype_col.title;
    if(dtype_col.title != dtype_col.datatype) {
      label +=  " ["+ dtype_col.datatype +"]";
    }
    option.innerHTML = label;
  }
  if(dtypeSelect) {
    if(!found_filter_select && first_non_selected) {
      first_non_selected.selected = "selected";
      datasourceElement.dtype_filter_select = first_non_selected.value;
    }
    var button = tdiv.appendChild(document.createElement("button"));
    button.innerHTML = "add filter";
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4);
    button.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-add', ''); return false");
  }
  
  return paneldiv;
}


function reportElementFilterHoverValue(elementID, dtype, setvalue) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  var panelID = reportElement.main_div_id + "_filter_subpanel";

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var dtype_col = datasourceElement.datatypes[dtype];
  if(!dtype_col) { return; }
  if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { return; }  //maybe "expression" or "signal"

  var filterBar = reportElement.dtype_filterbars[dtype];

  var filterBarID = panelID+"_filter_bar_"+dtype_col.datatype;
  var filterBarSpan = document.getElementById(filterBarID);
  if(!filterBarSpan) { return; }
  
  offsetY = 3;
  var barRect = filterBarSpan.getBoundingClientRect();
  var e = window.event
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  xpos = xpos - (barRect.x + window.scrollX);
  
  var max_val = dtype_col.max_val;
  if(dtype_col.filter_abs && (Math.abs(dtype_col.min_val)>max_val)) {
    max_val = Math.abs(dtype_col.min_val);
  }
  var min_val = dtype_col.min_val;
  if(dtype_col.filter_abs) { min_val = 0.0; }

  var posPerc = xpos / barRect.width;
  if(dtype_col.filter_abs) {
    var t_width = barRect.width / 2.0;
    posPerc = Math.abs(xpos-t_width) / t_width;
  }
  var relValue = (max_val - min_val) * posPerc + min_val;
  //console.log("xpos: "+xpos+ "  perc:"+posPerc+ " relValue:"+relValue+" autoset:"+dtype_col.autoSet);    
    
  toolTipWidth=100;
  var tdiv = document.createElement('div');
  tdiv.setAttribute("style", "text-align:center; font-size:10px; font-family:arial,helvetica,sans-serif; width:100px; z-index:100; padding: 1px 5px; margin: 3px 2px; box-sizing: border-box; border: 1px solid gray; border-radius: 4px; background-color:rgb(245,245,250);");
  tdiv.innerHTML = relValue.toPrecision(6);

  var tooltip = document.getElementById("toolTipLayer");
  tooltip.innerHTML = "";
  tooltip.appendChild(tdiv);
  toolTipSTYLE.display='block';
  
  if(setvalue=="end") {
    //console.log("end autoset");    
    eedbClearSearchTooltip();
    reportElementFilterbarUpdate(dtype_col, filterBar);
    if(dtype_col.autoSet == "filter_max") {
      reportElementUserEvent(datasourceElement, 'dtype-filter-max', dtype_col.datatype, relValue);
    }
    if(dtype_col.autoSet == "filter_min") {
      reportElementUserEvent(datasourceElement, 'dtype-filter-min', dtype_col.datatype, relValue);
    }    
    dtype_col.autoSet = "";
  }
  if(setvalue=="start") {
    //console.log("click autoset min/max value to: "+ relValue);
    var val1 = dtype_col.filter_min;
    var val2 = dtype_col.filter_max;
    if(val1=="min") { val1 = min_val; }
    if(val2=="max") { val2 = max_val; }
    val1 = Math.abs(relValue - val1);
    val2 = Math.abs(relValue - val2);
    if(val2<val1) {
      dtype_col.autoSet = "filter_max";
    } else {
      dtype_col.autoSet = "filter_min";
    }
    reportElementFilterbarUpdate(dtype_col, filterBar);
  }
  
  if(dtype_col.autoSet == "filter_max") {
    dtype_col.filter_max = relValue;
    reportElementFilterbarUpdate(dtype_col, filterBar);
  }
  if(dtype_col.autoSet == "filter_min") {
    dtype_col.filter_min = relValue;    
    reportElementFilterbarUpdate(dtype_col, filterBar);
  }
}


function reportElementFilterbarUpdate(dtype_col, filterBar) {
  if(!dtype_col) { return; }
  if(!filterBar) { return; }
  if(!filterBar.clip1) { return; }
  if(!filterBar.bar1) { return; }

  //display double range bar info-graphic
  var bar_width = 300;

  var max_val = dtype_col.max_val;
  if(dtype_col.filter_abs && (Math.abs(dtype_col.min_val)>max_val)) {
    max_val = Math.abs(dtype_col.min_val);
  }
  var min_val = dtype_col.min_val;
  if(dtype_col.filter_abs) { min_val = 0.0; }

  var filter_min = dtype_col.filter_min;
  if(dtype_col.filter_min=="min") { filter_min = min_val; }
  if(filter_min<min_val) { filter_min=min_val; }
  var filter_max = dtype_col.filter_max;
  if(dtype_col.filter_max=="max") { filter_max = max_val; }

  var varleft  = bar_width*((filter_min-min_val)/(max_val-min_val));
  var varwidth = bar_width*((filter_max-filter_min)/(max_val-min_val));
  if(dtype_col.filter_abs) {
    //center with zero at middle
    varwidth = bar_width*(filter_max/max_val);
    varleft  = (bar_width-varwidth)/2.0;
  }
  if(isNaN(varleft)) { varleft=0; }
  if(isNaN(varwidth)) { varwidth=0; }
  
  filterBar.clip1.style.left  = "0px";
  filterBar.clip1.style.width = bar_width+"px";

  filterBar.bar1.style.left  = varleft+"px";
  filterBar.bar1.style.width = varwidth+"px";

  if(varwidth<12) {
    filterBar.bar1.style.left = "0px";
    filterBar.bar1.style.width = "12px";
    filterBar.clip1.style.left = varleft+"px";
    filterBar.clip1.style.width = varwidth+"px";
  }
  
  if(filterBar.bar2 && dtype_col.filter_abs && (filter_min>0.0)) {
    //update gray "mask" in the center
    var t_width = bar_width*(filter_min/max_val);
    var t_left  = (bar_width-t_width)/2.0;
    if(isNaN(t_left)) { t_left=0; }
    if(isNaN(t_width)) { t_width=0; }
    filterBar.bar2.style.left  = t_left+"px";
    filterBar.bar2.style.width = t_width+"px";
  }
}


//===============================================================
//
// Element datasource interface and search section
//
//===============================================================


function reportElementBuildSourcesInterface(reportElement) {
  if(!reportElement) { return null; }
  
  var main_div = reportElement.main_div;
  if(!main_div) { return null; }
  var elementID = reportElement.elementID;
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var cfgID = reportElement.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) { return; }
  
  var datasource_mode = reportElement.datasource_mode;
  if(datasource_mode == "") { return; } //element does not need a datasource
  if(reportElement.newconfig && reportElement.newconfig.datasource_mode != undefined) { datasource_mode = reportElement.newconfig.datasource_mode; }
  
  configdiv.appendChild(document.createElement('hr'));

  var sourcesID = reportElement.main_div_id + "_sources_search_div";
  var sourceSearchDiv = document.getElementById(sourcesID);
  if(!sourceSearchDiv) {
    sourceSearchDiv = document.createElement('div');
    sourceSearchDiv.id = sourcesID;
  }
  sourceSearchDiv.setAttribute('style', "width:100%;");
  sourceSearchDiv.innerHTML = "";
  configdiv.appendChild(sourceSearchDiv);
  
  //reset widths
  //var mainRect = main_div.getBoundingClientRect();
  //console.log("main_div "+main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top);
  //var auxwidth = mainRect.width-5;
  //if(auxwidth<425) { auxwidth = 425; }
  //configdiv.style.width = "400px";
  //auxdiv.style.width = auxwidth+"px";
  
  //----------
  var sourceDiv = sourceSearchDiv.appendChild(document.createElement('div'));
  sourceDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var labelSources = sourceDiv.appendChild(document.createElement('span'));
  labelSources.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelSources.innerHTML ="Data source:";
  
  var datasource_mode = reportElement.datasource_mode;
  if(reportElement.newconfig && reportElement.newconfig.datasource_mode != undefined) { datasource_mode = reportElement.newconfig.datasource_mode; }
  var datasource_submode = reportElement.datasource_submode;
  if(reportElement.newconfig && reportElement.newconfig.datasource_submode != undefined) { datasource_submode = reportElement.newconfig.datasource_submode; }
  //console.log("datasource_mode : "+datasource_mode);
  var query_filter = reportElement.query_filter;
  if(reportElement.newconfig && reportElement.newconfig.query_filter != undefined) { query_filter = reportElement.newconfig.query_filter; }
  
  radio1 = sourceDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  //radio1.setAttribute("id", elementID + "_sourcetype_radio1");
  radio1.setAttribute("name", elementID + "_sourcemodetype");
  radio1.setAttribute("value", "feature");
  if(datasource_mode != "shared_element") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
  tspan = sourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "data query";
  
  radio2 = sourceDiv.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  //radio2.setAttribute("id", elementID + "_sourcetype_radio2");
  radio1.setAttribute("name", elementID + "_sourcemodetype");
  radio2.setAttribute("value", "shared_element");
  if(datasource_mode == "shared_element") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
  tspan = sourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "shared element";
  
  if(datasource_mode == "shared_element") {
    var datasourceElementID = reportElement.datasourceElementID;
    if(reportElement.newconfig && reportElement.newconfig.datasourceElementID != undefined) { datasourceElementID = reportElement.newconfig.datasourceElementID; }
    if(!datasourceElementID) { datasourceElementID = ""; }
    //console.log("datasourceElementID : "+datasourceElementID);
    
    var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "shared datasource element: ";
    /*
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id =  reportElement.elementID + "_config_datasrcID";
    titleInput.className = "sliminput"; //css styling
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', datasourceElementID);
    titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasourceElementID', this.value);");
    titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasourceElementID', this.value);");
    //titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    //titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
    */
    //pull-down based on the known page elements
    var select = div1.appendChild(document.createElement('select'));
    select.className = "dropdown";
    select.style.fontSize = "10px";
    select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasourceElementID', this.value);");
    if(datasourceElementID == "") {
      var option = select.appendChild(document.createElement('option'));
      option.setAttribute("value", "");
      option.setAttribute("selected", "selected");
      option.innerHTML = "please select element";
    }
    for(var id1 in current_report.elements) {
      var t_element = current_report.elements[id1];
      if(!t_element) { continue; }
      if(t_element.element_type == "layout") { continue; }
      if(t_element.element_type == "tools_panel") { continue; }
      if(t_element.elementID == reportElement.elementID) { continue; }
      var option = select.appendChild(document.createElement('option'));
      option.setAttribute("value", t_element.elementID);
      if(datasourceElementID == t_element.elementID) { option.setAttribute("selected", "selected"); }
      option.innerHTML = t_element.elementID;
    }

  } else {  //a data query type
    if(!reportElement.newconfig || !reportElement.newconfig.edit_datasource_query) {
      var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
      div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "data type:"
      tspan = div1.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "padding-left:5px; font-style:italic;");
      if(datasource_mode=="feature") { tspan.innerHTML = "features"; }
      if(datasource_mode=="edge")    { tspan.innerHTML = "edges"; }
      if(datasource_mode=="source")  { tspan.innerHTML = "sources"; }
      
      var button1 = div1.appendChild(document.createElement('input'));
      button1.setAttribute("style", "margin-left: 7px; font-size:10px; color:black; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); 
      button1.setAttribute("type", "button");
      button1.setAttribute("value", "edit datasource query");
      button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'edit_datasource_query', this.value);");
      
    } else {
      if(!reportElement.newconfig.dsi) { 
        var dsi1 = zenbuDatasourceInterface(reportElement.elementID);
        dsi1.edit_datasource_query = true;
        dsi1.allowChangeDatasourceMode = true;
        dsi1.source_ids = reportElement.source_ids;
        dsi1.enableResultFilter = true;
        dsi1.enableScripting = true;
        dsi1.allowMultipleSelect = true;

        dsi1.datasource_mode = datasource_mode;
        dsi1.query_filter = query_filter;
        if(reportElement.collaboration_filter) { 
          dsi1.collaboration_filter = reportElement.collaboration_filter; 
          console.log("reportElement: "+reportElement.elementID+"  collaboration_filter: "+reportElement.collaboration_filter);
        }
        dsi1.newconfig = reportElement.newconfig; //share newconfig

        //dsi1.style.marginLeft = "5px";
        reportElement.newconfig.dsi = dsi1;
        //dsi1.updateCallOutFunction = reportElementDSIUpdate; //not needed since sharing newconfig
        zenbuDatasourceInterfaceUpdate(reportElement.newconfig.dsi.id);
      }
      if(reportElement.newconfig.dsi) { 
        sourceSearchDiv.appendChild(reportElement.newconfig.dsi);
        zenbuDatasourceInterfaceUpdate(reportElement.newconfig.dsi.id);
      }
    }

      /*
      //first resize the config panel to be wider
      //var mainRect = main_div.getBoundingClientRect();
      //if(mainRect.width < 775) {
      //  auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left)+"px; top:"+(mainRect.top+10)+"px; width:775px;");
      //  //auxdiv.style.width = "775px";
      //}
      //configdiv.style.width = "750px";
    
      //-------- source type mode
      var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
      div1.appendChild(document.createTextNode("data type:"));
      div1.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      
      radio1 = div1.appendChild(document.createElement('input'));
      radio1.setAttribute("type", "radio");
      radio1.setAttribute("name", elementID + "_sourcetype");
      radio1.setAttribute("value", "feature");
      if(datasource_mode == "feature") { radio1.setAttribute('checked', "checked"); }
      radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "features";
      
      radio2 = div1.appendChild(document.createElement('input'));
      radio2.setAttribute("type", "radio");
      radio2.setAttribute("name", elementID + "_sourcetype");
      radio2.setAttribute("value", "edge");
      if(datasource_mode == "edge") { radio2.setAttribute('checked', "checked"); }
      radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "edges";
      
      radio3 = div1.appendChild(document.createElement('input'));
      radio3.setAttribute("type", "radio");
      radio3.setAttribute("name", elementID + "_sourcetype");
      radio3.setAttribute("value", "source");
      if(datasource_mode == "source") { radio3.setAttribute('checked', "checked"); }
      radio3.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "sources";
      
      //-
      var collabWidget = eedbCollaborationSelectWidget("filter_search");
      var tspan = div1.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "display:inline-block; float:right;");
      tspan.appendChild(collabWidget);

      if((datasource_mode == "edge") || (datasource_mode == "feature")) {
        //----------
        var sourceSearchForm = sourceSearchDiv.appendChild(document.createElement('form'));
        sourceSearchForm.setAttribute('style', "margin-top: 5px;");
        sourceSearchForm.setAttribute("onsubmit", "reportElementSourcesSearchCmd(\""+elementID+"\", 'search'); return false;");
        
        var expSpan = sourceSearchForm.appendChild(document.createElement('span'));
        expSpan.innerHTML = "Search data sources:";
        expSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin-right:3px;");
        
        var sourceInput = sourceSearchForm.appendChild(document.createElement('input'));
        sourceInput.id = elementID + "_sources_search_inputID";
        sourceInput.setAttribute('style', "width:430px; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
        //sourceInput.setAttribute('size', "50");
        sourceInput.setAttribute('type', "text");
        
        var searchButton = sourceSearchForm.appendChild(document.createElement('input'));
        searchButton.setAttribute('style', "margin-left: 3px;");
        searchButton.type = "button";
        searchButton.className = "medbutton";
        searchButton.setAttribute("value", "search");
        searchButton.setAttribute("onclick", "reportElementSourcesSearchCmd(\""+elementID+"\", 'search');");
        
        var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
        clearButton.type = "button";
        clearButton.className = "medbutton";
        clearButton.setAttribute("value", "clear");
        clearButton.setAttribute("onclick", "reportElementSourcesSearchCmd(\""+elementID+"\", 'clear');");
        
        //var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
        //clearButton.setAttribute("type", "button");
        //clearButton.setAttribute("value", "refresh");
        //clearButton.setAttribute("onclick", "reportElementSourcesSearchCmd(\""+elementID+"\", 'refresh');");
        
        //-------------
        var sourceResultDiv = sourceSearchForm.appendChild(document.createElement('div'));
        sourceResultDiv.id = elementID + "_sources_search_result_div";
        sourceResultDiv.setAttribute('style', "margin: 1px 3px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
        //sourceResultDiv.innerHTML = "please enter search term";
        sourceResultDiv.innerHTML = "";

        //preload query trigger here
        if(reportElement.source_ids && (!reportElement.newconfig || !reportElement.newconfig.sources_hash) ) {
          reportElementSourcesPreload(elementID);
        } else {
          reportElementSourcesShowSearchResult(elementID);
        }
      }
 
      if(datasource_mode == "source") {
        var sourceTypeDiv = sourceSearchDiv.appendChild(document.createElement('div'));
        //----------
        //sourceSpan = ctrlOptions.appendChild(document.createElement('span'));
        //sourceSpan.id = "dex_search_datasource_select_span";
        //-
        var span1 = sourceTypeDiv.appendChild(document.createElement('span'));
        span1.setAttribute("style", "margin-left:15px; ");
        span1.innerHTML = "data source type:"
        var sourceSelect = sourceTypeDiv.appendChild(document.createElement('select'));
        sourceSelect.className = "dropdown";
        //select.style.fontSize = "10px";
        sourceSelect.id = "dex_search_datasource_select";
        sourceSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_submode', this.value);");
        sourceSelect.setAttribute("style", "margin-left:3px; ");
        
        var option;
        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "all");
        option.innerHTML = "all data sources";
        if(datasource_submode == "all") { option.setAttribute("selected", "selected"); }
        
        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "experiments");
        option.innerHTML = "only experiments";
        if(datasource_submode == "experiments") { option.setAttribute("selected", "selected"); }
        
        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "feature_sources");
        option.innerHTML = "only feature sources";
        if(datasource_submode == "feature_sources") { option.setAttribute("selected", "selected"); }

        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "edge_sources");
        option.innerHTML = "only edge sources";
        if(datasource_submode == "edge_sources") { option.setAttribute("selected", "selected"); }
      }
      
      //query_filter
      var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
      div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      var span0 = div1.appendChild(document.createElement('span'));
      span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
      span0.innerHTML = "results filter:";
      var query_filter = reportElement.query_filter;
      if(reportElement.newconfig && reportElement.newconfig.query_filter != undefined) { query_filter = reportElement.newconfig.query_filter; }
      var filterInput = div1.appendChild(document.createElement('input'));
      filterInput.setAttribute('style', "width:250px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
      filterInput.setAttribute('type', "text");
      filterInput.setAttribute('value', query_filter);
      filterInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'query_filter', this.value);");
      filterInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'query_filter', this.value);");
      filterInput.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
    
      //query_edge_search_depth
      if(datasource_mode == "edge") {
        var span0 = div1.appendChild(document.createElement('span'));
        span0.setAttribute('style', "margin-left:15px; font-size:12px; font-family:arial,helvetica,sans-serif;");
        span0.innerHTML = "edge network search depth:";
        var search_depth = reportElement.query_edge_search_depth;
        if(reportElement.newconfig && reportElement.newconfig.query_edge_search_depth != undefined) { search_depth = reportElement.newconfig.query_edge_search_depth; }
        var input = div1.appendChild(document.createElement('input'));
        input.setAttribute('style', "width:30px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
        input.setAttribute('type', "text");
        input.setAttribute('value', search_depth);
        input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+reportElement.elementID+"\", 'query_edge_search_depth', this.value); }");
        input.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
      }
    }
    */

    //load_on_page_init
    var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    var checkbox = div1.appendChild(document.createElement('input'));
    checkbox.setAttribute("type", "checkbox");
    var load_on_page_init = reportElement.load_on_page_init;
    if(reportElement.newconfig && reportElement.newconfig.load_on_page_init != undefined) { load_on_page_init = reportElement.newconfig.load_on_page_init; }
    if(load_on_page_init) { checkbox.setAttribute("checked", "checked"); }
    checkbox.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'load_on_page_init', this.checked);");
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "load data on page initialization";
  }
  
  

  //TODO: example query for features for target list
  //reportElement.datasource_mode = "feature";
  //reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource";
  //reportElement.query_filter = "F6_KD_CAGE:=true";
  //reportElement.query_format = "fullxml";
  
  
  /*
   //-------------
   tdiv = sourceSearchDiv.appendChild(document.createElement('div'));
   tdiv.setAttribute('style', "margin-top: 1px;");
   
   var outmodeSelect = createSourceOutmodeSelect(elementID);
   if(outmodeSelect) {
   tspan = tdiv.appendChild(document.createElement('span'));
   tspan.setAttribute('style', "margin-left:10px; font-size:9px; font-family:arial,helvetica,sans-serif;");
   tspan.innerHTML = "feature mode: ";
   tdiv.appendChild(outmodeSelect);
   }
   
   var datatypeSelect = createDatatypeSelect(elementID);
   if(datatypeSelect) {
   tspan = tdiv.appendChild(document.createElement('span'));
   tspan.setAttribute('style', "margin-left:20px; font-size:9px; font-family:arial,helvetica,sans-serif;");
   tspan.innerHTML = "source datatype:";
   tdiv.appendChild(datatypeSelect);
   }
   */
  
  return sourceSearchDiv;
}

function reportElementDSIUpdate(uniqID, mode, param, value, altvalue) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(zenbuDSI == null) { return; }
  var elementID = uniqID;
  if(zenbuDSI.elementID) { elementID = zenbuDSI.elementID; }
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  console.log("reportElementDSIUpdate "+uniqID+" elementID:"+elementID+" mode:"+mode);

  if(mode=="reconfig_param") {
    reportElementReconfigParam(elementID, param, value, altvalue);
  }
  if(mode=="select_source") {
    console.log("new source_ids: " + zenbuDSI.newconfig.source_ids);
  }
}

function reportElementCSIUpdate(uniqID, mode, param, value, altvalue) {
  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];
  if(zenbuCSI == null) { return; }
  var elementID = uniqID;
  if(zenbuCSI.elementID) { elementID = zenbuCSI.elementID; }
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  console.log("reportElementCSIUpdate "+uniqID+" elementID:"+elementID+" mode:"+mode);

  if(mode=="reconfig_param") {
    reportElementReconfigParam(elementID, param, value, altvalue);
  }
}


/*
function reportElementSourcesSearchCmd(elementID, cmd) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  
  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  
  var seachInput = document.getElementById(elementID + "_sources_search_inputID");
  if(seachInput == null) { return; }
  
  if(!reportElement.newconfig) { reportElement.newconfig = new Object; }
  
  if(cmd == "clear") {
    seachInput.value ="";
    reportElement.newconfig.sources_hash = new Object;
    reportElement.newconfig.source_ids = "";
    reportElementSourcesShowSearchResult(elementID);
  }
  if(cmd == "search") {
    var filter = "";
    if(seachInput) { filter = seachInput.value; }
    if(!filter) { filter =" "; }
    reportElementSourcesSubmitSearch(elementID, filter);
  }
}


function reportElementSourcesPreload(elementID) {
  //preload the previous selected sources by searching based on the source_ids
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.source_ids) { return; } //nothing to do

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "preloading previously configured data sources...";

  if(!reportElement.newconfig.sources_hash) {
    reportElement.newconfig.sources_hash = new Object;
  }
  reportElement.newconfig.source_ids = reportElement.source_ids;
  reportElement.newconfig.preload = true;

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  paramXML += "<mode>sources</mode>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  reportElement.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { reportElementSourcesParseSearchResponse(id); };}(elementID);
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function reportElementSourcesSubmitSearch(elementID, filter) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "searching data sources...";
  
  if(!reportElement.newconfig.sources_hash) {
    reportElement.newconfig.sources_hash = new Object;
  }
  
  //clear unselected sources from hash
  var sources_hash = new Object;
  for(var srcid in reportElement.newconfig.sources_hash) {
    var source = reportElement.newconfig.sources_hash[srcid];
    if(source && (source.selected || source.preload)) {
      sources_hash[srcid] = source;
    }
  }
  reportElement.newconfig.sources_hash = sources_hash;
  
  var datasource_mode = reportElement.datasource_mode;
  if(reportElement.newconfig && reportElement.newconfig.datasource_mode != undefined) { datasource_mode = reportElement.newconfig.datasource_mode; }

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  if(datasource_mode == "feature") { paramXML += "<mode>feature_sources</mode>"; }
  else if(datasource_mode == "edge") { paramXML += "<mode>edge_sources</mode>"; }
  else { paramXML += "<mode>sources</mode>";  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "<filter>" + filter + "</filter>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  reportElement.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { reportElementSourcesParseSearchResponse(id); };}(elementID);
  sourcesXMLHttp.open("POST", eedbSearchFCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function reportElementSourcesParseSearchResponse(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var sourcesXMLHttp = reportElement.sourcesXMLHttp;
  if(sourcesXMLHttp == null) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  if(sourcesXMLHttp.readyState!=4) { return; }
  if(sourcesXMLHttp.status!=200) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    //document.getElementById("message").innerHTML= 'Problem with central DB!';
    reportElementSourcesShowSearchResult(elementID);
    return;
  }
  
  var sources_hash = reportElement.newconfig.sources_hash;
  
  var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<xmlExperiments.length; i++) {
    var xmlSource = xmlExperiments[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {
      source = eedbParseExperimentData(xmlSource);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<xmlFeatureSources.length; i++) {
    var xmlSource = xmlFeatureSources[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {
      source = eedbParseFeatureSourceData(xmlSource);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  var xmlEdgeSources = xmlDoc.getElementsByTagName("edgesource");
  for(i=0; i<xmlEdgeSources.length; i++) {
    var xmlSource = xmlEdgeSources[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {
      source = eedbParseEdgeSourceXML(xmlSource);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  reportElement.sourcesXMLHttp = undefined;
  
  //postprocess the sources to label the preload ones
  if(reportElement.newconfig.preload) {
    var load_source_ids = "";
    var source_ids = reportElement.source_ids;
    var ids = source_ids.split(/[\s\,]/);
    for(var i=0; i<ids.length; i++) {
      var srcID = ids[i];
      if(!srcID) { continue; }
      var source = sources_hash[srcID];
      if(source) {
        source.selected = true;
        source.preload = true;
      }
    }
    reportElement.newconfig.preload=false;
  }
  
  //show sources
  reportElementSourcesShowSearchResult(elementID);
}


function reportElementSourcesShowSearchResult(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  
  if(!reportElement.newconfig.sources_hash) {
    reportElement.newconfig.sources_hash = new Object;
  }
  var sources_array = new Array();
  var sources_hash = reportElement.newconfig.sources_hash;
  
  var select_count = 0;
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) { select_count++; }
    sources_array.push(source);
  }
  sources_array.sort(reportElement_sources_sort_func);
  
  sourceResultDiv.innerHTML = "";
  
  //------------
  var sourceCountDiv = sourceResultDiv.appendChild(document.createElement('div'));
  sourceCountDiv.id = elementID + "_sources_search_count_div";
  reportElementSourcesUpdateSearchCounts(elementID);
  
  //----------
  var div1 = sourceResultDiv.appendChild(document.createElement('div'));
  div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");
  
  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var thead = my_table.appendChild(document.createElement('thead'));
  var tr = thead.appendChild(document.createElement('tr'));
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "";
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "source name";
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "description";
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "source type";
  
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
    checkbox.setAttribute("onclick", "reportElementSourcesSelectSource(\""+elementID+"\", \"" +source.id+ "\", this.checked);");
    
    //name
    var td2 = tr.appendChild(document.createElement('td'));
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "#");
    a1.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'source-info', '"+source.id+"'); return false; ");
    //a1.setAttribute("onclick", "gLyphsLoadObjectInfo(\""+source.id+"\"); return false;");
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


function reportElementSourcesUpdateSearchCounts(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  
  var sources_hash = reportElement.newconfig.sources_hash;
  if(sources_hash == null) { return; }
  
  var sourceCountDiv = document.getElementById(elementID + "_sources_search_count_div");
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
    a1.setAttribute("onclick", "reportElementSourcesSelectSource(\""+elementID+"\", 'all'); return false;");
    a1.innerHTML = "select all";
  }
}


function reportElementSourcesSelectSource(elementID, srcID, mode) {
 var reportElement = current_report.elements[elementID];
 if(!reportElement) { return; }

  if(!reportElement.newconfig) { return; }
  if(!reportElement.newconfig.sources_hash) { return; }
  
  var sources_hash = reportElement.newconfig.sources_hash;
  
  if(srcID == "all") {
    for(var srcid in sources_hash) {
      var source = sources_hash[srcid];
      if(source) { source.selected = true; }
    }
    reportElementSourcesShowSearchResult(elementID);
  } else {
    var source = sources_hash[srcID];
    if(source) {
      if(mode) { source.selected = true; }
      else     { source.selected = false; }
      reportElementSourcesUpdateSearchCounts(elementID);
    }
  }
  
  //generate the source_id list and create title_prefix if needed
  if(reportElement.title_prefix && reportElement.newconfig.title_prefix == undefined) {
    reportElement.newconfig.title_prefix = reportElement.title_prefix;
  }
  if(!reportElement.newconfig.title_prefix) { reportElement.newconfig.title_prefix = ""; }
  var title = reportElement.newconfig.title_prefix;
  reportElement.newconfig.title_prefix = title.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
  
  reportElement.newconfig.source_ids = "";
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) {
      if(reportElement.newconfig.source_ids) {
        reportElement.newconfig.source_ids += ",";
      }
      reportElement.newconfig.source_ids += source.id;
      if(reportElement.newconfig.title_prefix == "") {
        reportElement.newconfig.title_prefix = source.name;
      }
    }
  }
  var titleInput = document.getElementById(elementID + "_config_title");
  if(titleInput && reportElement.newconfig.title_prefix) {
    titleInput.value = reportElement.newconfig.title_prefix;
  }
  //createDatatypeSelect(elementID); //refresh
}


function reportElement_sources_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  var an = String(a.name).toUpperCase();
  var bn = String(b.name).toUpperCase();
  if(an < bn) { return -1; }
  if(an > bn) { return 1; }
  
  return 0;
}
*/



function zenbuReports_hoverInfo(reportElement, object) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }
  if(!reportElement) { return; }
  if(!object) { return; }  //feature, edge, source... with .mdata

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
  }
  if(!datasourceElement) { return; }

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "background-color:#404040; text-align:left; font-size:10px; color:#FDFDFD; "
                        + "font-family:arial,helvetica,sans-serif; min-width:100px; z-index:100; "
                        + "opacity: 0.90; padding: 3px 3px 3px 3px; "
                        + "border-radius: 7px; border: solid 1px #808080; "
                       );
    
  //var tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  //var tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.innerHTML = "This will be the edge info hover:";
  
  var firstRow = true;
  for(var icol=0; icol<reportElement.dtype_columns.length; icol++) {
    var dtype_col = reportElement.dtype_columns[icol];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible) { continue; }

    var t_feature = object;
    var edge = null;
    if(object.classname == "Edge") { 
      edge = object;
      if(edge && (/^f1\./.test(dtype_col.datatype))) { t_feature = edge.feature1;}
      if(edge && (/^f2\./.test(dtype_col.datatype))) { t_feature = edge.feature2;}
    }
    
    var datatype = dtype_col.datatype;
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');

    tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "max-width:330px; word-wrap:break-word; margin:0px 10px 0px 2px; ");

    if(!firstRow) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "font-weight: bold; word-wrap: break-word; ");
      tspan.innerHTML = dtype_col.title + ": ";
    }

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "word-wrap: break-word; ");
    if(firstRow) { tspan.style = "word-wrap:break-word; font-weight:bold; font-size:12px; "; }

    if(t_feature && (dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) {
      tspan.innerHTML = t_feature.name;
    } 
    else if(edge && edge.weights && (dtype_col.col_type == "weight")) {
      var weights = edge.weights[dtype_col.datatype];
      if(weights) { 
        tspan.innerHTML = weights[0].weight.toPrecision(4);
      }
    } 
    else if(t_feature && t_feature.expression && (dtype_col.col_type == "signal")) {
      for(var j2=0; j2<t_feature.expression.length; j2++) {
        var expression = t_feature.expression[j2];
        if(expression.datatype != datatype) { continue; }
        if(tspan.innerHTML != "") { tspan.innerHTML += " "; }
        tspan.innerHTML += expression.total.toPrecision(4);
      }
    } 
    else if(t_feature && t_feature.mdata && dtype_col.col_type == "mdata") {
      var val = "";
      if(t_feature.mdata && t_feature.mdata[datatype]) {
        var value_array = t_feature.mdata[datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          if(val) { val += ", "; }
          val += value_array[idx1];
        }
      } else if(t_feature.source && (datatype == "category")) {
        val = t_feature.source.category;
      } else if(t_feature.source && (datatype == "source_name")) {
        val = t_feature.source.name;
      } else if(datatype == "location_string") {
        val = t_feature.chromloc;
      }
      if(val) { tspan.innerHTML = val; }      
    }
    firstRow = false;
  }
    
  toolTipWidth = 100;
  toolTipLayer.innerHTML = "";
  toolTipLayer.appendChild(divFrame);
  toolTipSTYLE.display='block';
}


function zenbu_object_dtypecol_value(object, dtype_col, mode) {
  if(!object || !dtype_col) { return ""; }
  
  var value = "";
  var values = {};
  var datatype = dtype_col.datatype;
  datatype = datatype.replace(/^f1\./, '');
  datatype = datatype.replace(/^f2\./, '');

  var t_feature = object;
  var edge = null;
  if(object.classname == "Edge") { 
    edge = object;
    if(edge && (/^f1\./.test(dtype_col.datatype))) { t_feature = edge.feature1;}
    if(edge && (/^f2\./.test(dtype_col.datatype))) { t_feature = edge.feature2;}
  }

  if(t_feature && (dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) {
    value = t_feature.name;
  } 
  else if(edge && edge.weights && (dtype_col.col_type == "weight")) {
    var weights = edge.weights[dtype_col.datatype];
    if(weights) { 
      value = weights[0].weight.toPrecision(4);
    }
  } 
  else if(t_feature && t_feature.expression && (dtype_col.col_type == "signal")) {
    for(var j2=0; j2<t_feature.expression.length; j2++) {
      var expression = t_feature.expression[j2];
      if(expression.datatype != datatype) { continue; }
      var e1 = expression.total.toPrecision(4);
      if(mode!="unqiue" || (mode=="unique" && !values[e1])) {
        if(value != "") { value += " "; }
        value += e1;
      }
      values[e1] = true;
      if(mode=="first" && value!="") { break; }
    }
  } 
  else if(t_feature && t_feature.mdata && dtype_col.col_type == "mdata") {
    var val = "";
    if(t_feature.mdata && t_feature.mdata[datatype]) {
      var value_array = t_feature.mdata[datatype];
      for(var idx1=0; idx1<value_array.length; idx1++) {
        var md1 = value_array[idx1];
        if(mode!="unique" || (mode=="unique" && !values[md1])) {
          if(val) { val += ", "; }
          val += md1;
        }
        values[md1] = true;
        if(mode=="first" && val!="") { break; }
      }
    } else if(t_feature.source && (datatype == "category")) {
      val = t_feature.source.category;
    } else if(t_feature.source && (datatype == "source_name")) {
      val = t_feature.source.name;
    } else if(datatype == "location_string") {
      val = t_feature.chromloc;
    }
    if(val) { value = val; }      
  }
  
  return value;
}


//===============================================================
//
// Element trigger-cascade link interface
//
//===============================================================

function reportElementCascadeTriggersInterface(reportElement) {
  if(!reportElement) { return null; }
  if(!reportElement.cascade_triggers) { reportElement.cascade_triggers = new Array(); }

  var main_div = reportElement.main_div;
  if(!main_div) { return null; }
  var elementID = reportElement.elementID;
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var cfgID = reportElement.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) { return; }
  
  configdiv.appendChild(document.createElement('hr'));
  
  var cascadesID = reportElement.main_div_id + "_config_cascades_div";
  var cascadesDiv = document.getElementById(cascadesID);
  if(!cascadesDiv) {
    cascadesDiv = document.createElement('div');
    cascadesDiv.id = cascadesID;
  }
  cascadesDiv.setAttribute('style', "width:100%;");
  cascadesDiv.innerHTML = "";
  configdiv.appendChild(cascadesDiv);
  
  //----------
  var labelDiv = cascadesDiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="Inter-Element cascade-triggers:";
  
  tspan = labelDiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "padding-left:5px; font-size:10px; font-style:italic;");
  var num_triggers = reportElement.cascade_triggers.length;
  if(reportElement.newconfig && reportElement.newconfig.cascade_triggers) { num_triggers = reportElement.newconfig.cascade_triggers.length; }
  tspan.innerHTML = num_triggers + " triggers";

  //first display current CascadeTriggers (probably no editing, but delete)
  if(!reportElement.newconfig || !reportElement.newconfig.edit_cascade_triggers) {
    var button1 = labelDiv.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 17px; font-size:10px; color:black; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE;  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4);
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "edit cascade triggers");
    button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'edit_cascade_triggers', this.value);");
    
  } else {
    var button1 = labelDiv.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 17px; font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "add trigger");
    button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'add_cascade_trigger');");
    button1.setAttribute("onmouseover", "eedbMessageTooltip(\"add new cascade trigger\",130);");
    button1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    var table1 = cascadesDiv.appendChild(document.createElement('table'));
    table1.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");

    //var columns = reportElement.dtype_columns;
    var columns = new Array();
    for(var dtype in reportElement.datatypes) {
      var dtype_col = reportElement.datatypes[dtype];
      if(dtype_col) { columns.push(dtype_col); }
    }
    columns.sort(reports_column_order_sort_func);

    for(var trig_idx=0; trig_idx<reportElement.newconfig.cascade_triggers.length; trig_idx++){
      var trigger = reportElement.newconfig.cascade_triggers[trig_idx];
      if(!trigger) { continue; }
      //console.log("trigger "+reportElement.elementID+" ["+trig_idx+"] on["+trigger.on_trigger+"]  action["+trigger.action_mode+" - "+trigger.options+"]");
      //if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
      //if(!trigger.targetElement) { continue; }

      //var rowdiv = cascadesDiv.appendChild(document.createElement('div'));
      var tr1 = table1.appendChild(document.createElement('tr'));

      //on_trigger
      var td1 = tr1.appendChild(document.createElement('td'));
      var span1 = td1.appendChild(document.createElement('span'));
      span1.innerHTML = "&#9658; on: ";
      var select = td1.appendChild(document.createElement('select'));
      select.className = "dropdown";
      select.style.fontSize = "10px";
      select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_on_trigger', '"+trig_idx+"', this.value);");
      var opts1 = ["select", "select_location", "hyperlink", "reset", "preload", "load", "postprocess" ];
      for(var idx1=0; idx1<opts1.length; idx1++) {
        var option = select.appendChild(document.createElement('option'));
        option.setAttribute("value", opts1[idx1]);
        if(trigger.on_trigger == opts1[idx1]) { option.setAttribute("selected", "selected"); }
        option.innerHTML = opts1[idx1];
      }
      
      //action_mode
      var td1 = tr1.appendChild(document.createElement('td'));
      if(trigger.on_trigger == "hyperlink") {
        var span1 = td1.appendChild(document.createElement('span'));
        span1.innerHTML = "column: ";
        var span1 = td1.appendChild(document.createElement('span'));
        span1.setAttribute("style", "font-size:10px; font-weight:bold; padding:1px 1px 1px 1px; margin:0px 3px 0px 1px;");
        span1.innerHTML = trigger.hyperlink_datatype
        span1 = td1.appendChild(document.createElement('span'));
        span1.innerHTML = " &rArr; send ";
      } else {
        var span1 = td1.appendChild(document.createElement('span'));
        span1.innerHTML = "&rArr; action: ";
        var select = td1.appendChild(document.createElement('select'));
        select.className = "dropdown";
        select.style.fontSize = "10px";
        select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_action_mode', '"+trig_idx+"', this.value);");
        var opts1 = ["select", "select_location", "set_focus", "focus_load", "set_filter_features", "reset", "load", "postprocess"];
        for(var idx1=0; idx1<opts1.length; idx1++) {
          var option = select.appendChild(document.createElement('option'));
          option.setAttribute("value", opts1[idx1]);
          if(trigger.action_mode == opts1[idx1]) { option.setAttribute("selected", "selected"); }
          option.innerHTML = opts1[idx1];
        }
      }

      //action_mode options
      var opts1 = [];
      if(trigger.action_mode == "select") {
        opts1 = ["clear"];
        if(trigger.on_trigger == "hyperlink") { opts1 = ["nothing"]; }
        opts1.push("selection_id");
        if((reportElement.datasource_mode == "edge") && (reportElement.element_type != "treelist")) {
          opts1.push("f1.id");
          opts1.push("f2.id");
        }
        for(var i=0; i<columns.length; i++) {
          var dtype_col = columns[i];
          if(!dtype_col) { continue; }
          //dtype_col.colnum = i+1;  //reset column order based on sorting
          opts1.push(dtype_col.datatype);
        }
      }
      if((trigger.action_mode == "set_focus") || (trigger.action_mode == "focus_load")) {
        opts1 = ["clear"];
        if((reportElement.datasource_mode == "edge") && (reportElement.element_type != "treelist")) {
          opts1.push("selection_f1");
          opts1.push("selection_f2");
        } else {
          opts1.push("selection");
        }
      }
      if(trigger.action_mode == "set_filter_features") {
        opts1 = ["clear", "selection", "subnetwork", "all_features"];
      }
      if(opts1.length>0) {
        var span1 = td1.appendChild(document.createElement('span'));
        span1.innerHTML = " : ";
        var select = td1.appendChild(document.createElement('select'));
        select.className = "dropdown";
        select.style.fontSize = "10px";
        select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_options', '"+trig_idx+"', this.value);");
        for(var idx1=0; idx1<opts1.length; idx1++) {
          var option = select.appendChild(document.createElement('option'));
          option.setAttribute("value", opts1[idx1]);
          if(trigger.options == opts1[idx1]) { option.setAttribute("selected", "selected"); }
          option.innerHTML = opts1[idx1];
        }
      }

      //target: even the to-target can be a pull-down based on the known page elements
      var td1 = tr1.appendChild(document.createElement('td'));
      var span1 = td1.appendChild(document.createElement('span'));
      //if(trigger.on_trigger == "hyperlink") {
      if((trigger.targetElementID != "") && (!trigger.targetElement)) {
        span1.innerHTML += " to-page : ";
        var input1 = td1.appendChild(document.createElement('input'));
        input1.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_targetID', '"+trig_idx+"', this.value);");
        input1.className = "sliminput";
        input1.style.width = "100px";
        input1.value = trigger.targetElementID;
      }
      else {
        span1.innerHTML += " to-target : ";
        var select = td1.appendChild(document.createElement('select'));
        select.className = "dropdown";
        select.style.fontSize = "10px";
        select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_targetID', '"+trig_idx+"', this.value);");
        if(trigger.targetElementID == "") {
          var option = select.appendChild(document.createElement('option'));
          option.setAttribute("value", "");
          option.setAttribute("selected", "selected");
          option.innerHTML = "please select target";
        }
        if(trigger.on_trigger == "hyperlink") {
          var option = select.appendChild(document.createElement('option'));
          option.setAttribute("value", "external_page");
          option.innerHTML = "external page";
        }
        for(var id1 in current_report.elements) {
          var t_element = current_report.elements[id1];
          if(!t_element) { continue; }
          if(t_element.element_type == "layout") { continue; }
          if(t_element.element_type == "tools_panel") { continue; }
          var option = select.appendChild(document.createElement('option'));
          option.setAttribute("value", t_element.elementID);
          if(trigger.targetElementID == t_element.elementID) { option.setAttribute("selected", "selected"); }
          option.innerHTML = t_element.elementID;
        }
      }
      
      //copy trigger img/button
      td1 = tr1.appendChild(document.createElement('td'));
      var img1 = td1.appendChild(document.createElement('img'));
      img1.setAttribute('style', "margin-left:5px;");
      img1.setAttribute("src", eedbWebRoot+"/images/copy_gray.png");
      img1.setAttribute("height", "12");
      img1.setAttribute("alt","copy");
      img1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'copy_cascade_trigger', '"+trig_idx+"');");
      img1.setAttribute("onmouseover", "eedbMessageTooltip(\"copy cascade trigger\",130);");
      img1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

      //delete trigger img/button
      var img1 = td1.appendChild(document.createElement('img'));
      img1.setAttribute('style', "margin-left:5px;");
      img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
      img1.setAttribute("width", "12");
      img1.setAttribute("height", "12");
      img1.setAttribute("alt","close");
      img1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'delete_cascade_trigger', '"+trig_idx+"');");
      img1.setAttribute("onmouseover", "eedbMessageTooltip(\"delete cascade trigger\",130);");
      img1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

      /*
      //for debugging
      var row_div = cascadesDiv.appendChild(document.createElement('div'));
      row_div.setAttribute('style', "margin-left:15px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      var span1 = row_div.appendChild(document.createElement('span'));
      //"&alpha; &psi; &bull; &#9658; &Omega; &otimes;ƒmouseover
      span1.innerHTML = "&#9658; on["+trigger.on_trigger+"] ";
      span1.innerHTML += " &rArr; action["+trigger.action_mode+"] "
      if(trigger.options) { span1.innerHTML += " opts:["+trigger.options+"] "; }
      span1.innerHTML += " &Omega; to-target["+trigger.targetElement.element_type+":"+trigger.targetElementID+"]";
       */
    }
  }
    
  return cascadesDiv;
}


//===============================================================
//
// column controls interface
//
//===============================================================

function reportElementColumnsSubpanel(reportElement) {
  if(!reportElement) { return; }
  if(reportElement.element_type == "layout") { return; }

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  //console.log("reportElementSearchSubpanel");
  
  //var width = parseInt(main_div.clientWidth);
  //width = width - 10;
  //if(width>350) { width=350;}
  //width=350;

  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  //console.log("reportElementSearchSubpanel aux ok");

  var subID = reportElement.main_div_id + "_columns_config_subpanel";
  var columns_div = document.getElementById(subID);
  if(!columns_div) {
    columns_div = document.createElement('div');
    //auxdiv.insertBefore(columns_div, auxdiv.firstChild);
    auxdiv.appendChild(columns_div);
    columns_div.id = subID;
    //columns_div.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
    //                         "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
    //                         "display:none; opacity: 0.98; " +
    //                         "position:absolute; top:40px; right:10px;"
    //                        );

    var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
    style += "background-color:rgb(245,245,250); ";
    //style += "background-color:#FDFDFD; ";
    style += "padding: 5px 5px 5px 5px; min-width:150px; ";
    style += "border:inset; border-width:2px; white-space: nowrap; ";
    style += "display:none; opacity: 1.0; ";
    style += "position:absolute; top:20px; right:10px; z-index:100; ";
    //style += "position:absolute; left:"+ (xpos+5) +"px; top:"+ (ypos) +"px; z-index:100; ";
    columns_div.setAttribute('style', style);
  }
  columns_div.innerHTML = "";
  var mainRect = main_div.getBoundingClientRect();
  var auxRect = auxdiv.getBoundingClientRect();
  //console.log("search panel auxdiv.width="+auxRect.width+"  maindiv.width="+mainRect.width);
  if(auxRect.width>mainRect.width) { columns_div.style.left = "5px"; columns_div.style.right = ""; }
  else { columns_div.style.right = "10px"; columns_div.style.left = ""; }

  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;

  //close button
  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onmousedown", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //shift up/down button
  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  tdiv.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"shift panel\",60);");
  tdiv.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/dropdown_arrow.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","shift down");
  columns_div.shift_arrow = img1;
  a1.setAttribute("onmousedown", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'refresh', 'shift'); return false;");
  if(columns_div.style.top == "40px") { img1.style.transform = "scaleY(-1)"; }

  //subpanel title
  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "columns interface";

  columns_div.appendChild(document.createElement('hr'));

  //if(reportElement.subpanel_mode != "columns") { reportElement.column_dtype_select = ""; }
  
  reportElementColumnsInterfaceRender(reportElement, columns_div);
  
  return columns_div;
}


function reportElementColumnsInterface(elementID, visible_mode) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return null; }

  //reportElementToggleSubpanel(elementID, 'columns');

  /*
  if(!current_report.edit_page_configuration) { return; }

  //column/datatypes are copied from datasource to sharedElement so allows different
  //  column display for sharedDatasource. so interface on the reportElement
  
  //attempts to try to get the right-mouse context panel to disappear but without success
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }
  window.blur();

  var auxdiv = reportElement.auxdiv;
  if(!auxdiv) { return; }
  var auxRect = auxdiv.getBoundingClientRect();

  //var configdiv = reportElement.config_options_div;
  var colPanelID = reportElement.main_div_id + "_columns_config_subpanel";
  var columns_div = document.getElementById(colPanelID);
  if(!columns_div) {
    columns_div = auxdiv.appendChild(document.createElement('div'));
    columns_div.id = colPanelID;
    columns_div.panel_visible = false;
  }
  columns_div.panel_visible = ! columns_div.panel_visible;
  if(visible_mode=="refresh") { columns_div.panel_visible = true; }
  if(visible_mode=="open") { columns_div.panel_visible = true; }
  if(visible_mode=="close") { columns_div.panel_visible = false; }

  if(!columns_div.panel_visible) {
    columns_div.style.display = "none";
    reportElement.column_dtype_select = "";
    return;
  }

  var e = window.event
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  if(xpos < 100) { xpos = 100; }
  if(ypos < 100) { ypos = 100; }

  xpos = xpos - (auxRect.x + window.scrollX);
  ypos = ypos - (auxRect.y + window.scrollY);

  if(visible_mode=="refresh") {
    xpos = reportElement.columns_panel_xpos;
    ypos = reportElement.columns_panel_ypos;
  } else {
    reportElement.columns_panel_xpos = xpos;
    reportElement.columns_panel_ypos = ypos;
  }

  //bck-color: rgb(245,245,250)  #FDFDFD
  var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
  style += "background-color:#FDFDFD; padding: 5px 5px 5px 5px; min-width:150px; ";
  style += "border:inset; border-width:2px; white-space: nowrap; ";
  style += "position:absolute; left:"+ (xpos+5) +"px; top:"+ (ypos) +"px; z-index:100; ";
  //style += "position:absolute; left:100px; top:30px; z-index:100; ";
  columns_div.setAttribute('style', style);

  columns_div.innerHTML = "";

  //close button
  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reportElementColumnsInterface('"+reportElement.elementID+"', 'close'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "white-space: nowrap; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "datatype column controls ";

  columns_div.appendChild(document.createElement('hr'));
  
  reportElementColumnsInterfaceRender(reportElement, columns_div);
  return  columns_div;
  */
}


function reportElementColumnsInterfaceRender(reportElement, columns_div, signalMode) {
  if(!reportElement) { return; }
  if(!columns_div) { return; }
  
  var columnsRect = columns_div.getBoundingClientRect();

  if((signalMode=="signalOnly") || (reportElement.element_type == "chart")) {
    reportElement.dtype_columns.sort(signal_column_order_sort_func);
  } else {
    reportElement.dtype_columns.sort(reports_column_order_sort_func);
  }
  var columns = reportElement.dtype_columns;
  
  var selected_row_div = null;
  var selected_dtype_col = null;
  var previous_dtype_col = null;
  var signal_order_cnt = 1;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }

    if((signalMode=="signalOnly") && (dtype_col.col_type != "signal") && (dtype_col.col_type != "weight")) { continue; }

    if(!current_report.edit_page_configuration && !dtype_col.visible && !dtype_col.user_modifiable && !dtype_col.signal_active) { continue; }
      
    var dtype_signal_mode = false; //when the signal/weights are being treated separately with signal_active & signal_order
    if(((dtype_col.col_type == "signal") || (dtype_col.col_type == "weight")) && 
       ((signalMode=="signalOnly") || (reportElement.element_type == "chart"))) { dtype_signal_mode=true; }

    if((reportElement.element_type == "chart") && previous_dtype_col && 
       ((dtype_col.signal_active && !dtype_col.visible && previous_dtype_col.visible) || 
        (!dtype_col.visible && !dtype_col.signal_active && dtype_col.user_modifiable && 
         (previous_dtype_col.visible || previous_dtype_col.signal_active)) || 
        (!dtype_col.visible && !dtype_col.signal_active && !dtype_col.user_modifiable && 
         (previous_dtype_col.visible || previous_dtype_col.signal_active || previous_dtype_col.user_modifiable)))) {
      columns_div.appendChild(document.createElement('hr'));
    }
    previous_dtype_col = dtype_col;

    //reset column order based on sorting
    if(dtype_signal_mode) { dtype_col.signal_order = signal_order_cnt++; }
    else { dtype_col.colnum = i+1;  }
    
    var row_div = columns_div.appendChild(document.createElement('div'));
    row_div.setAttribute('style', "white-space: nowrap; ");
    row_div.setAttribute("onclick", "reportElementColumnsInterfaceDetails(\""+reportElement.elementID+"\", \""+dtype_col.datatype+"\"); return false");
    row_div.className = "row_outline";
    if((dtype_col.col_type == "signal") || (dtype_col.col_type == "weight")) { 
      row_div.style.backgroundColor = "#fff7ea"; //"#fffcf7"; //"#f9f0de";
    }

    var tcheck = row_div.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 1px 3px 1px 3px;");
    tcheck.setAttribute('type', "checkbox");

    if(dtype_signal_mode) {
      if(dtype_col.signal_active) { tcheck.setAttribute('checked', "checked"); }
      tcheck.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype_signal_active', \""+dtype_col.datatype+"\"); return false");
    } else {
      if(dtype_col.visible) { tcheck.setAttribute('checked', "checked"); }
      tcheck.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-visible', \""+dtype_col.datatype+"\"); return false");
    }
    if(!current_report.edit_page_configuration && !dtype_col.user_modifiable) { tcheck.disabled = "disabled"; }
    
    var tspan = row_div.appendChild(document.createElement('span'));
    tspan.innerHTML =  dtype_col.title;
    if(dtype_col.title != dtype_col.datatype) {
      var tspan = row_div.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "padding-left:7px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
      tspan.innerHTML =  "["+ dtype_col.datatype +"]";
    }
    
    if(reportElement.column_dtype_select == dtype_col.datatype) {
      console.log("columns interface select ["+dtype_col.datatype+"] for details interface");
      row_div.style.backgroundColor = "#DDFDFD";
      selected_row_div = row_div;
      selected_dtype_col = dtype_col;
    }
    
    //TODO: click on dtype name brings up a rename panel, panel can also allow other ctrl like order-pos
    //TODO: click/drag on dtype name starts a drag reorder
  }

  
  if(selected_row_div && (current_report.edit_page_configuration || selected_dtype_col.user_modifiable)) {
    var rect = selected_row_div.getBoundingClientRect();
    console.log("row_div rect x:"+rect.x+" y:"+rect.y+" left:"+rect.left+" right:"+rect.right+" top:"+rect.top+" bottom:"+rect.bottom);

    var details_div = columns_div.appendChild(document.createElement('div'));
    var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
    style += "background-color:#FDFDFD; padding: 5px 5px 5px 5px; width:300px; ";
    style += "border:inset; border-width:2px; white-space: nowrap; ";
    //style += "position:absolute; left:"+(columnsRect.right-columnsRect.left+10)+"px; top:"+(rect.top-columnsRect.top)+"px; z-index:100; ";
    style += "position:absolute; left:"+(selected_row_div.clientWidth+15)+"px; top:"+(rect.top-columnsRect.top)+"px; z-index:100; ";
    details_div.setAttribute('style', style);

    tdiv = details_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px; color:gray; float:right;");
    tdiv.innerHTML = selected_dtype_col.col_type;

    tdiv = details_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px; color:blue;");
    tdiv.innerHTML = selected_dtype_col.datatype;

    tdiv = details_div.appendChild(document.createElement('div'));
    //tdiv.innerHTML = "title ["+selected_dtype_col.title+"]";
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "title: ";
    var input = tdiv.appendChild(document.createElement('input'));
    //input.setAttribute('size', "13");
    input.setAttribute('style', "width:200px; margin: 1px 1px 1px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    input.setAttribute('type', "text");
    input.setAttribute('value', selected_dtype_col.title);
    input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+reportElement.elementID+"\", 'dtype-title', \""+selected_dtype_col.datatype+"\", this.value); }");
    input.setAttribute("onblur", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-title', \""+selected_dtype_col.datatype+"\", this.value);");
    //input.setAttribute("onchange", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-title', \""+selected_dtype_col.datatype+"\", this.value); return false");
    //input.setAttribute("onkeydown", "if(event.keyCode==13) { reportsChangeGlobalParameter('dwidth', this.value)}");
    //input.setAttribute("onblur", "reportElementColumnsInterfaceDetails(\""+reportElement.elementID+"\", \""+selected_dtype_col.datatype+"\"); return false");

    tdiv = details_div.appendChild(document.createElement('div'));
    //tdiv.innerHTML = "colnum ["+selected_dtype_col.colnum+"]";
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "column order: ";
    var input = tdiv.appendChild(document.createElement('input'));
    input.setAttribute('size', "3");
    input.setAttribute('type', "text");      
    if(((selected_dtype_col.col_type == "signal") || (selected_dtype_col.col_type == "weight")) && 
       ((signalMode=="signalOnly") || (reportElement.element_type == "chart"))) {
      tspan.innerHTML = "signal order: ";
      input.setAttribute('value', selected_dtype_col.signal_order);
      input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+reportElement.elementID+"\", 'dtype_signal_order', \""+ selected_dtype_col.datatype+ "\", this.value); }");
      input.setAttribute("onblur", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype_signal_order', \""+selected_dtype_col.datatype+"\", this.value);");
    } else {
      input.setAttribute('value', selected_dtype_col.colnum);
      input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+reportElement.elementID+"\", 'dtype-colnum', \""+ selected_dtype_col.datatype+ "\", this.value); }");
      input.setAttribute("onblur", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-colnum', \""+selected_dtype_col.datatype+"\", this.value);");
    }
    //input.setAttribute("onchange", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-colnum', \""+selected_dtype_col.datatype+"\", this.value); return false");
    //input.setAttribute("onblur", "reportElementColumnsInterfaceDetails(\""+reportElement.elementID+"\", \""+selected_dtype_col.datatype+"\"); return false");
    
    console.log("make colorpicker now");
    tspan2 = tdiv.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin:2px 3px 2px 5px; ");
    tspan2.innerHTML = "highlight:";
    var highlight_color = "#EBEBEB"; //230,230,230
    if(selected_dtype_col.highlight_color) { highlight_color = selected_dtype_col.highlight_color; }
    
    var colorInput = tdiv.appendChild(document.createElement('input'));
    colorInput.setAttribute('style', "margin-top:2px; ");
    colorInput.setAttribute('value', highlight_color);
    colorInput.setAttribute('size', "5");
    colorInput.setAttribute("onchange", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-highlight', \""+selected_dtype_col.datatype+"\", this.value);");
    if(columns_div.color_picker) { columns_div.color_picker.hidePicker(); } //hide old picker
    columns_div.color_picker = new jscolor.color(colorInput);

    if(current_report.edit_page_configuration) {
      //user_modifiable    
      tdiv = details_div.appendChild(document.createElement('div'));
      tcheck = tdiv.appendChild(document.createElement('input'));
      tcheck.setAttribute('style', "margin: 2px 1px 0px 14px;");
      tcheck.setAttribute('type', "checkbox");
      if(selected_dtype_col.user_modifiable) { tcheck.setAttribute('checked', "checked"); }
      tcheck.setAttribute("onclick", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-user_modifiable', \""+selected_dtype_col.datatype+"\", this.value);");                        
      var tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "column user modifiable";
    }
  }
  return  columns_div;
}


function reportElementColumnsInterfaceDetails(elementID, dtype) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return null; }

  if(reportElement.column_dtype_select == dtype) {
    reportElement.column_dtype_select= "";
  } else {
    reportElement.column_dtype_select= dtype;
  }
  //reportElementColumnsInterface(elementID, 'refresh');
  reportElementToggleSubpanel(elementID, 'refresh');
}


//===================================================================================

function reportElementColorSpaceOptions(reportElement) {
  if(!reportElement) { return null; }
  var uniqID = reportElement.elementID+"_colorspace_CSI";
  var colorspaceCSI = reportElement.colorspaceCSI;
  if(!colorspaceCSI) {
    colorspaceCSI = zenbuColorSpaceInterface(uniqID);
    colorspaceCSI.elementID = reportElement.elementID;
    colorspaceCSI.colorspace = reportElement.colorspace;
    colorspaceCSI.enableScaling = false; //do not show the min_signal/max_signal interfaces
    //colorspaceCSI.min_signal = reportElement.signal_min;
    //colorspaceCSI.max_signal = reportElement.signal_max;
    colorspaceCSI.logscale = reportElement.colorspace_logscale;
    colorspaceCSI.callOutFunction = reportElementCSIUpdate;
    reportElement.colorspaceCSI = colorspaceCSI;
    console.log("first create colorspaceCSI reportElement["+reportElement.elementID+"] colorspace:"+reportElement.colorspace);
  }
  zenbuColorSpaceInterfaceUpdate(uniqID);
  return colorspaceCSI;
}


function reports_column_order_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.visible && !b.visible) { return -1; }
  if(!a.visible && b.visible) { return 1; }

  if(!a.visible && !b.visible) { 
    if(a.title.toLowerCase() < b.title.toLowerCase()) { return -1; }
    if(a.title.toLowerCase() > b.title.toLowerCase()) { return 1; }
  }

  if(a.colnum>0 && b.colnum<0) { return -1; }
  if(a.colnum<0 && b.colnum>0) { return 1; }

  if(a.colnum > b.colnum) { return 1; }
  if(a.colnum < b.colnum) { return -1; }
  return 0;
}

function signal_column_order_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.visible && !b.visible) { return -1; }
  if(!a.visible && b.visible) { return 1; }

  if(a.visible && b.visible) {
    if(a.colnum>0 && b.colnum<0) { return -1; }
    if(a.colnum<0 && b.colnum>0) { return 1; }

    if(a.colnum > b.colnum) { return 1; }
    if(a.colnum < b.colnum) { return -1; }    
  }
  
  if(a.signal_active && !b.signal_active) { return -1; }
  if(!a.signal_active && b.signal_active) { return 1; }
  
  if(a.signal_active && b.signal_active) { 
    if(a.signal_order>0 && b.signal_order<0) { return -1; }
    if(a.signal_order<0 && b.signal_order>0) { return 1; }

    if(a.signal_order > b.signal_order) { return 1; }
    if(a.signal_order < b.signal_order) { return -1; }
  }

  if(a.user_modifiable && !b.user_modifiable) { return -1; }
  if(!a.user_modifiable && b.user_modifiable) { return 1; }
  
  if(a.title.toLowerCase() < b.title.toLowerCase()) { return -1; }
  if(a.title.toLowerCase() > b.title.toLowerCase()) { return 1; }
  
  return 0;
}

