/*--------------------------------------------------------------------------
 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * ZENBU system
 * copyright (c) 2007-2010 Jessica Severin RIKEN OSC
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
 *--------------------------------------------------------------------------*/

var eedbRegistryURL;
var eedb_searchXHR_array = new Array();
var eedb_searchTracks = new Object();
var newSearchTrackID = 1;
var eedbPeerCache = new Object();
var eedbSearchObjCache = new Array;

var fullLoadXHRs = new Object(); //objID to XHR

var current_source;  //for use with source_info display system

var current_genome = new Object;
current_genome.name = "";
current_genome.uuid = "";
current_genome.available_genomes = new Array;
current_genome.genomeWidgets = new Object; //hash of allocated widgets
current_genome.callOutFunction = null;
current_genome.loading = false;


function unparse_dbid(dbid) {
  var zobj = new Object;
  zobj.uuid = "";
  zobj.objID = -1;
  zobj.objClass="Feature";
  
  var idx1 = dbid.indexOf("::");
  var idx2 = dbid.indexOf(":::");
  if(idx1 == -1) { return zobj; }

  zobj.uuid = dbid.substring(0,idx1);
  if(idx2 != -1) {
    zobj.objClass = dbid.substring(idx2+3);
    zobj.objID = dbid.substring(idx1+2, idx2);
  } else {
    zobj.objID = dbid.substring(idx1+2);
  }
  return zobj;
}


function eedbClearSearchResults(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }

  var searchInput = document.getElementById(searchSetID + "_inputID");
  if(searchInput) {
    searchInput.value = "";
 //   searchInput.focus();
    if(searchset.default_message) { 
      searchInput.value = searchset.default_message; 
      searchInput.style.color = "lightgray";
      searchInput.setAttribute("onclick", "eedbClearDefaultSearchMessage(\'"+searchSetID+"\');");
      searchInput.setAttribute("onfocus", "eedbClearDefaultSearchMessage(\'"+searchSetID+"\');");
      searchInput.setAttribute("onblur", "eedbSearchUnfocus(\'"+searchSetID+"\');");
      searchInput.show_default_message = true;
    }
  }

  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(!searchMesg) { 
    searchMesg = document.createElement('div');
    searchMesg.id  = searchSetID + "_messageID";
    searchset.appendChild(searchMesg);
  }
  if(searchMesg) {  
    searchMesg.setAttribute("align","left");
    searchMesg.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
    searchMesg.innerHTML=""; 
    //searchMesg.innerHTML="please enter search term"; 
  }


  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");
  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];
    searchDiv.style.display = 'block';
    //searchDiv.style.display = 'none';
    searchDiv.innerHTML="";
    searchDiv.style.marginTop = "5px";
    searchDiv.style.marginBottom = "5px";
    searchDiv.style.color = 'black';
    searchDiv.style.size = '12';
    searchDiv.style.fontFamily = 'arial, helvetica, sans-serif';
    searchDiv.onmouseout = "eedbClearSearchTooltip();";
    searchDiv.setAttribute('searchSetID', searchSetID);

    var searchID    = searchDiv.getAttribute("id");
    var searchTrack = eedbSearchGetSearchTrack(searchID, searchSetID);
    if(searchTrack.mode == "hide") { searchDiv.style.display = 'none'; }

    var title       = searchTrack.searchTitle;
    var peerName    = searchTrack.peerName;
    var mode        = searchTrack.mode;
    var grid        = searchTrack.grid;
    var multiselect = searchTrack.multiselect;
    var server      = searchTrack.server;
    var sources     = searchTrack.sources;
    var source_ids  = searchTrack.source_ids;
    if(!title) { title = sources; }

    if(multiselect) {
      if(!searchTrack) { continue; }

      var select_count=0;
      for (var fid in searchTrack.selected_hash) {
        var obj = searchTrack.selected_hash[fid];
        if(!obj.state) {continue;}
        select_count++;
      }

      var text="<div style=\"font-size:11px;\" onmouseout=\"eedbClearSearchTooltip();\" >";
      if(title) { text += "<span style=\"font-weight:bold;color:Navy;\">"+ title + "::</span> "; }
      text += "<a style=\"color:red\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'clear\');\">unselect all ("+select_count+")</a> ";

      if(grid) { text += "<table width='100%'><tr>"; }
      var count=0;
      for (var fid in searchTrack.selected_hash) {
        var obj = searchTrack.selected_hash[fid];
        if(!obj.state) {continue;}
        if(grid && (count%grid == 0)) { text += "</tr><tr>"; }
        if(grid) { text += "<td>"; }
        text += "<input type=\"checkbox\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'" +fid+ "\', this.checked);\" checked=\"checked\" />";
        text += "<a href=\"#\" " +"onclick=\"eedbSearchSingleSelect(\'" +searchID+ "\', \'" +fid+ "\');return false;\" "
                +" onmouseover=\"eedbSearchTooltip(\'" +fid+ "\');\""
                +" >" + encodehtml(obj.fname) +"</a> ";
        if(grid) { text += "</td>"; }
        count++;
      }
      if(grid) { text += "</tr></table>"; }
      text += "</div>";
      searchDiv.innerHTML=text;
    }
  }
  eedbClearSearchTooltip();
}


function eedbClearDefaultSearchMessage(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }

  var searchInput = document.getElementById(searchSetID + "_inputID");
  if(!searchInput) { return; }

  if(searchInput.show_default_message) {
    searchInput.show_default_message = false;
    searchInput.value = "";
    searchInput.style.color = "black";
  }
}


function eedbSearchUnfocus(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }

  var searchInput = document.getElementById(searchSetID + "_inputID");
  if(!searchInput) { return; }

  if(searchInput.show_default_message) { return; }
  if(searchInput.value != "") { return; }

  eedbClearSearchResults(searchSetID);
}


function eedbEmptySearchResults(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");
  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];
    searchDiv.innerHTML="";
  }
  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(!searchMesg) { 
    searchMesg = document.createElement('div');
    searchMesg.id  = searchSetID + "_messageID";
    searchset.appendChild(searchMesg);
  }
  if(searchMesg) {  
    searchMesg.setAttribute("align","left");
    searchMesg.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
    //searchMesg.innerHTML="please enter search term"; 
    searchMesg.innerHTML=""; 
  }
}


function eedbSetSearchInput(searchSetID, strvalue) {
  //sets the input value to allow editing
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  if(!strvalue) { return; }

  var searchInput = document.getElementById(searchSetID + "_inputID");
  if(!searchInput) { return; }

  searchInput.style.color = "black";
  searchInput.show_default_message = false;
  searchInput.value = strvalue;
}


function eedbDisplaySearchSetHasResults(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }

  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(!searchMesg) {
    searchMesg = document.createElement('div');
    searchMesg.id  = searchSetID + "_messageID";
    searchMesg.setAttribute("align","left");
    searchMesg.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
    searchset.appendChild(searchMesg);
  }
  searchMesg.innerHTML="";
  var has_match = false;
  for(searchID in eedb_searchTracks) {
    var searchTrack = eedb_searchTracks[searchID];
    if(!searchTrack) { continue; }
    if(searchTrack.searchSetID != searchSetID) { continue; }
    if((searchTrack.filtered>0) || (searchTrack.matchCount>0)) { has_match = true; }
  }
  if(!has_match) { searchMesg.innerHTML="<span style=\"font-weight:bold; color:#980000;\">search term not found</span>"; }
}


function eedbMultiSearch(searchSetID, str, e) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  if(!str) {
    var searchInput = document.getElementById(searchSetID + "_inputID");
    if(!searchInput) { return; }
    str = searchInput.value;
  }
  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");
  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];
    eedbSearchSpecificDB(searchSetID, str, e, searchDiv);
  }
}


function eedbSearchSpecificDB(searchSetID, str, e, searchDiv) {
  if(!searchDiv) return null;

  var searchID   = searchDiv.getAttribute("id");
  eedbSearchQueueQuery(searchSetID, searchID, str, e);

  var searchTrack = eedbSearchGetSearchTrack(searchID);
  eedbSearchSubmitSearch(searchTrack);
  return searchTrack;
}


function eedbSearchGetSearchTrack(searchID, searchSetID) {
  var searchTrack = eedb_searchTracks[searchID];
  if(searchTrack) { return searchTrack; }

  if(!searchSetID) { return; }
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  var searchDiv  = document.getElementById(searchID);
  if(!searchDiv) { return; }

  searchTrack                  = new Object;
  searchTrack.searchSetID      = searchSetID;
  searchTrack.searchID         = searchID;
  searchTrack.searchDiv        = searchDiv;
  searchTrack.peerName         = searchDiv.getAttribute("peer");
  searchTrack.server           = searchDiv.getAttribute("server");
  searchTrack.sources          = searchDiv.getAttribute("sources");
  searchTrack.source_ids       = searchDiv.getAttribute("source_ids");
  searchTrack.mode             = searchDiv.getAttribute("mode");
  searchTrack.searchTitle      = searchDiv.getAttribute("searchTitle");
  searchTrack.submode          = searchDiv.getAttribute("submode");
  searchTrack.grid             = searchDiv.getAttribute("grid");
  searchTrack.multiselect      = searchDiv.getAttribute("multiselect");
  searchTrack.showAll          = searchDiv.getAttribute("showAll");
  searchTrack.allowUnmapped    = searchDiv.getAttribute("allowUnmapped");
  searchTrack.selected_hash    = new Object;
  searchTrack.search_pending   = false;
  searchTrack.queue            = new Array();
  eedb_searchTracks[searchID]  = searchTrack;

  return searchTrack;
}


function eedbSearchDeleteSearchTrack(searchID) {
  var searchTrack = eedb_searchTracks[searchID];
  if(searchTrack) { 
    searchTrack.searchDiv = undefined;
    eedb_searchTracks[searchID]  = undefined;
    delete searchTrack;
  }
}


function eedbSearchQueueQuery(searchSetID, searchID, str, e) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  var registry_mode = searchset.getAttribute("registry_mode");

  var searchDiv  = document.getElementById(searchID);
  if(!searchDiv) { return; }

  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(searchMesg) { searchMesg.innerHTML = ""; }

  var searchTrack = eedbSearchGetSearchTrack(searchID, searchSetID);
  if(!searchTrack) { return; }

  if(searchTrack.mode == "hide") { return; }
  if(!searchTrack.queue) { searchTrack.queue = new Array(); } 

  if(e && (e.type == "click")) { 
    searchTrack.search_pending   = false;
    return searchTrack.queue.push(str); 
  }
  var charCode;
  if(e && e.which) charCode=e.which;
  else if(e) charCode = e.keyCode;
  if(charCode==13) { 
    searchTrack.search_pending   = false;
    return searchTrack.queue.push(str); 
  }

  //if(str.length>=7) { return searchTrack.queue.push(str); }  //turn off autocomplete

  //if(str.length>=3 && !(/\s/.test(str))) { return searchTrack.queue.push(str); }
  //if((mode == "experiments" || mode=="feature_sources") && (charCode) && (charCode!=13)) { return; }
}


function eedbSearchSubmitSearch(searchTrack) {
  if(!searchTrack) { return; }
  if(searchTrack.mode == "hide") { return; }
  if(!searchTrack.queue) { return; }
  if(searchTrack.queue.length==0) { return; }
  if(searchTrack.search_pending) { return; }

  var query = searchTrack.queue.pop();
  searchTrack.queue = new Array();  //clear array
  searchTrack.current_query = query;

  var searchset = document.getElementById(searchTrack.searchSetID);
  var registry_mode = searchset.getAttribute("registry_mode");

  var searchSetID  = searchTrack.searchSetID;
  var searchID     = searchTrack.searchID;
  var title        = searchTrack.searchTitle;
  var peerName     = searchTrack.peerName
  var sources      = searchTrack.sources;
  var source_ids   = searchTrack.source_ids;
  var mode         = searchTrack.mode;
  var searchDiv    = searchTrack.searchDiv;
  if(!title && peerName) { title = peerName; }

  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(searchMesg) { searchMesg.innerHTML = ""; }

  var url = eedbSearchFCGI;
  var params = "";

  //----------------------
  // new XML based query
  //
  var paramXML = "<zenbu_query>\n";
  if(registry_mode) { paramXML += "<registry_mode>"+registry_mode+"</registry_mode>\n"; }
  if(peerName)      { paramXML += "<peer_names>"+peerName+"</peer_names>\n"; }
  if(sources)       { paramXML += "<source_names>"+sources+"</source_names>\n"; }
  if(source_ids)    { paramXML += "<source_ids>"+ source_ids +"</source_ids>\n"; }

  if(mode == "experiments") {
    paramXML += "<mode>experiments</mode><filter>"+query+"</filter><format>fullxml</format>\n";
  } else if(mode == "feature_sources") {
    paramXML += "<mode>feature_sources</mode><filter>"+query+"</filter><format>fullxml</format>\n";
  } else if(mode == "feature") {
    url = eedbSearchCGI;
    paramXML += "<mode>search</mode><limit>1000</limit>\n";
    if(!searchTrack.allowUnmapped) { paramXML += "<skip_no_location>true</skip_no_location>\n"; }
    paramXML += "<name>"+query+"</name>\n";
  } else if(mode == "eeDB_gLyphs_configs") {
    url = eedbConfigCGI;
    paramXML += "<configtype>view</configtype><mode>search</mode><format>search</format>\n";
    paramXML += "<search>"+query+"</search>\n";
  } else if(mode == "eeDB_gLyph_track_configs") {
    url = eedbConfigCGI;
    paramXML += "<configtype>track</configtype><mode>search</mode><format>search</format>\n";
    paramXML += "<search>"+query+"</search>\n";;
  } else if(mode == "ZENBU_script_configs") {
    url = eedbConfigCGI;
    paramXML += "<configtype>script</configtype><mode>search</mode><format>search</format>\n";
    paramXML += "<search>"+query+"</search>\n";;
  } else { return; }
  paramXML += "</zenbu_query>\n";


  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }

  var text="<div style=\"font-size:11px;\" onmouseout=\"eedbClearSearchTooltip();\" >";
  if(title) { text += "<span style=\"font-weight:bold;color:Navy;\">"+ title + "::</span> "; }
  text += " searching...</div>";
  searchDiv.innerHTML= text;

  var xhrObj = new Object;
  xhrObj.xhr   = xhr;
  eedb_searchXHR_array[searchID] = xhrObj;
  //this is funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { eedbDisplaySearchResults(id); };}(searchID);

  searchTrack.search_pending = true;

  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
}


function eedbGetLastSearchResponse(searchID) {
  var xhrObj = eedb_searchXHR_array[searchID];
  var xhr = xhrObj.xhr;
  if(xhr == null) { return; }
  if(xhr.readyState!=4) return;
  if(xhr.status && (xhr.status!=200)) { return; }
  if(xhr.responseXML == null) return;

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
  return xmlDoc;
}

function search_display_sort_func(a,b) {
  if(a.fname.toLowerCase() > b.fname.toLowerCase()) { return 1; }
  if(a.fname.toLowerCase() < b.fname.toLowerCase()) { return -1; }
  return 0;
}

function eedbDisplaySearchResults(searchID) {
  var searchTrack = eedbSearchGetSearchTrack(searchID);
  if(!searchTrack) { return; }
  var searchDiv = document.getElementById(searchID);
  if(!searchDiv) return;

  if(searchTrack.mode == "hide") { searchDiv.style.display = 'none'; return; }
  searchDiv.style.display = 'block';

  var title       = searchTrack.searchTitle;
  var peer        = searchTrack.peerName;
  var mode        = searchTrack.mode;
  var submode     = searchTrack.submode;
  var grid        = searchTrack.grid;
  var multiselect = searchTrack.multiselect;
  var showAll     = searchTrack.showAll;
  if(!title) { title = peer; }

  var text="<div style=\"font-size:11px;\" onmouseout=\"eedbClearSearchTooltip();\" >";
  if(title) { text += "<span style=\"font-weight:bold;color:Navy;\">"+ title + "::</span> "; }
  text += " searching...</div>";
  searchDiv.innerHTML= text;

  if((mode == "eeDB_gLyphs_configs") || 
     (mode == "eeDB_gLyph_track_configs") || 
     (mode == "ZENBU_script_configs")) { mode = "config"; } 

  var xhrObj = eedb_searchXHR_array[searchID];
  var xhr = xhrObj.xhr;
  if(xhr == null) { return; }
  if(xhr.readyState!=4) return;
  if(xhr.status && (xhr.status!=200)) { return; }
  if(xhr.responseXML == null) return;

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
  searchTrack.search_pending = false;

  var text="<div style=\"font-size:11px;\" onmouseout=\"eedbClearSearchTooltip();\" >";
  var nodes;
  if(title) { text += "<span style=\"font-weight:bold;color:Navy;\">"+ title + "::</span> "; }

  searchTrack.total = 0;
  searchTrack.matchCount = 0;
  searchTrack.filtered = 0;
  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    searchTrack.total      = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
    searchTrack.filtered   = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("filtered") -0;
    searchTrack.matchCount = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("match_count") -0;
    if(searchTrack.filtered>0 && searchTrack.matchCount==0) { searchTrack.matchCount=searchTrack.filtered; }
  }
  if(searchTrack.total==-1) {
    text += "Error in query";
    searchDiv.style.display = 'none';
  } else if((searchTrack.filtered==0) && (searchTrack.matchCount==0)) {
    text += searchTrack.total+" searched : No match found";
    searchDiv.style.display = 'none';
    //searchDiv.style.display = 'block';
  } else if(searchTrack.filtered > searchTrack.matchCount) {
    text += searchTrack.matchCount+" matches : Too many to display";
    searchDiv.style.display = 'block';
  } else {
    searchDiv.style.display = 'block';
    if(mode == "experiments") {
      var tnodes = xmlDoc.getElementsByTagName("experiment");
      if(submode && (submode == "no_mapcount")) {
        var nodes = new Array; 
        var re1 = /_mapcount$/;
        for(i=0; i<tnodes.length; i++)  {
          var expname = tnodes[i].getAttribute("name");
          if(!re1.exec(expname)) { nodes.push(tnodes[i]); }
        }
        searchTrack.filtered = nodes.length;
      } else {
        nodes = tnodes;
      }
    } else if(mode == "feature_sources") {
      nodes = xmlDoc.getElementsByTagName("featuresource");
    } else {
      nodes = xmlDoc.getElementsByTagName("match");
    }

    text += "(found " +searchTrack.filtered;
    if(searchTrack.filtered < searchTrack.total) { text += ", from " +searchTrack.total; }
    text += ") ";

    if(multiselect) {
      text += "<a style=\"color:red; text-decoration:underline;\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'all\');\">select all</a> ";
      text += "<a style=\"color:red; text-decoration:underline;\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'clear\');\">unselect all</a> ";
    }

    if(showAll == 1) {
      var allnames = "";
      for(i=0; i<nodes.length; i++) allnames += nodes[i].getAttribute("desc")+ " ";
      text += "<a style=\"color:red\" href=\"#\" onclick=\"eedbSearchSingleSelect(\'" +searchID+ "\', '" +allnames+ "');\" >(add all " +searchTrack.filtered+ ")</a> ";
    }
    if(grid) { text += "<table width='100%'><tr>"; }

    var obj_array = new Array;
    var count=0;
    for (var fid in searchTrack.selected_hash) {
      var obj = searchTrack.selected_hash[fid]; 
      obj.visible = false; //reset all previously loaded objs back to in-visible
      if(!obj.state) {continue;}
      obj.visible = true; //unless checked state
      if(grid && (count%grid == 0)) { text += "</tr><tr>"; }
      if(grid) { text += "<td>"; }
      text += "<input type=\"checkbox\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'" +fid+ "\', this.checked);\" checked=\"checked\" />";
      text += "<a href=\"#\" " +"onclick=\"eedbSearchSingleSelect(\'" +searchID+ "\', \'" +fid+ "\');return false;\" "
              +" onmouseover=\"eedbSearchTooltip(\'" +fid+ "\', \""+mode+"\");\""
              +">" + encodehtml(obj.fname) +"</a> ";
      if(grid) { text += "</td>"; }
      count++;
    }

    var exact_match=null;
    for(i=0; i<nodes.length; i++) {
      var fid   = nodes[i].getAttribute("feature_id");
      var fname = nodes[i].getAttribute("desc");
      if(mode == "experiments") {
        var source = eedbParseExperimentData(nodes[i]);
        fid = source.id;
        fname = source.name;
      }
      if(mode == "feature_sources") {
        var source = eedbParseFeatureSourceData(nodes[i]);
        fid = source.id;
        fname = source.name;
      }
      var obj = searchTrack.selected_hash[fid]; 
      if(!obj) { 
        obj = new Object; 
        obj.state = false; 
        obj.fid = fid; 
        obj.fname = fname; 
        searchTrack.selected_hash[fid] = obj; 
      }
      obj.visible = true;  //all objects returned from query are set back to visible
      if(fname.toLowerCase() == searchTrack.current_query.toLowerCase()) { exact_match = obj; }
      else { obj_array.push(obj); }
    }
    obj_array.sort(search_display_sort_func);
    if(exact_match) { obj_array.unshift(exact_match); }

    for(i=0; i<obj_array.length; i++) {
      var obj = obj_array[i];
      if(obj && obj.state) { continue; }
      if(grid && (count%grid == 0)) { text += "</tr><tr>"; }
      if(grid) { text += "<td>"; }
      if(multiselect) {
        obj.visible = true;
        text += "<input type=\"checkbox\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'" +obj.fid+ "\', this.checked);\" ";
        if(obj && obj.state) { text += " checked "; }
        text += " />";
      }

      text += "<a href=\"#\" " +"onclick=\"eedbSearchSingleSelect(\'" +searchID+ "\', \'" +obj.fid+ "\');return false;\" "
           +" onmouseover=\"eedbSearchTooltip(\'" +obj.fid+ "\', \'" +mode+ "\');\" >";

      if(obj.fname.toLowerCase() == searchTrack.current_query.toLowerCase()) { 
        text += "<span style=\"font-size:12px; font-weight: bold;\">"+encodehtml(obj.fname)+"</span>";
        if(searchDiv.exact_match_autoclick) { eedbSearchSingleSelect(searchID, obj.fid); }
      } else {
        text += encodehtml(obj.fname);
      }
      text += "</a> ";
      if(grid) { text += "</td>"; }
      count++;
    }
    if(grid) { text += "</tr></table>"; }
  }

  text += "</div>";
  searchDiv.innerHTML=text;

  //if there is still something in the search queue it will submit again
  eedbSearchSubmitSearch(searchTrack);

  eedbDisplaySearchSetHasResults(searchTrack.searchSetID);
}


function eedbSearchMultiSelect(searchID, fid, state) {
  var searchTrack = eedbSearchGetSearchTrack(searchID);
  if(!searchTrack) { return; }

  if((fid == "all") || (fid=="clear")) {
    for (var id in searchTrack.selected_hash) {
      var obj = searchTrack.selected_hash[id];
      if(!obj.visible) { continue; }
      if(fid=="all") { obj.state = true; }
      if(fid=="clear") { obj.state = false; }
    }
    eedbClearSearchResults(searchTrack.searchSetID);
  } else {
    //document.getElementById("message").innerHTML= "flip "+fid + " state="+state; 
    var obj = searchTrack.selected_hash[fid];
    if(obj) { obj.state = state; }
  }
  if(searchTrack.callOutFunction) {
    searchTrack.callOutFunction(searchID, fid, state);
  }
}


function eedbSearchSingleSelect(searchID, fid) {
  var searchTrack = eedbSearchGetSearchTrack(searchID);
  if(!searchTrack) { return; }

  if(searchTrack.callOutFunction) {
    searchTrack.callOutFunction(searchID, fid, "single");
  } else {
    eedbSearchGlobalCalloutClick(fid);
  }
}



function eedbSearchTooltip(id, mode) {
  var obj = eedbGetObject(id, mode);
  if(!obj) { return; }
  eedbDisplayTooltipObj(obj);
}


function eedbClearSearchTooltip() {
  toolTipWidth=300;
  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";
  // document.getElementById("SVGdiv").innerHTML= "tooltip mouse out";
  document.getElementById("toolTipLayer").innerHTML = ""; 
  offsetY = 10;
}


function eedbDisplayTooltipObj(obj) {
  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  if(obj.classname == "Feature") { eedbFeatureTooltip(obj); }
  if(obj.classname == "Edge")    { eedbEdgeTooltip(obj); }
  if(obj.classname == "Experiment") { eedbSourceTooltip(obj); }
  if(obj.classname == "FeatureSource") { eedbSourceTooltip(obj); }
  if(obj.classname == "Configuration") { eedbSourceTooltip(obj); }
}


function eedbMessageTooltip(message, width) {
  if(!message) return;
  var tooltip = document.getElementById("toolTipLayer");
  if(!tooltip) { return; }

  var msg_div = document.createElement('div');
  msg_div.innerHTML = message;
  msg_div.style = "text-align:center; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                  "z-index:100; padding: 3px 5px 3px 5px; "+
                  "box-sizing: border-box; border: 1px solid #808080; border-radius: 4px; "+
                  "background-color:#404040; color:#FDFDFD; opacity:0.85;";

  tooltip.innerHTML = "";
  tooltip.appendChild(msg_div);
  toolTipSTYLE.display='block';

  if(width) { 
    toolTipWidth=width; 
    msg_div.style.width = width+"px";
  }
}


function eedbFeatureTooltip(feature) {
  if(!feature) return;
  var genloc = feature.genloc;
  if(!genloc) { genloc =""; } else { genloc += " ::  "; }

  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:350px; z-index:100; padding: 3px 3px 3px 3px; "+
                    "box-sizing: border-box; border: 1px solid #808080; border-radius: 4px; background-color:#404040; color:#FDFDFD; "+
                    "opacity:0.85; \">";
  object_html += "<div>";
  object_html += " <span style=\"font-size:12px; font-weight: bold;\">" + encodehtml(feature.name)+"</span>";
  object_html += " <span style=\"font-size:9px;\">" + encodehtml(feature.category) +" : " + encodehtml(feature.source_name) + "</span>";
  object_html += "</div>";
  object_html += eedbFeatureInfoHTML(feature);
  object_html += "</div>"; 

  if(ns4) {
    toolTipSTYLE.document.write(object_html);
    toolTipSTYLE.document.close();
    toolTipSTYLE.visibility = "visible";
  }
  if(ns6) {
    //document.getElementById("toolTipLayer").innerHTML;
    document.getElementById("toolTipLayer").innerHTML = object_html;
    toolTipSTYLE.display='block'
  }
  if(ie4) {
    document.all("toolTipLayer").innerHTML=object_html;
    toolTipSTYLE.display='block'
  }
}


function eedbFeatureInfoHTML(feature) {
  if(!feature) return "";
  var genloc = feature.genloc;
  if(!genloc) { genloc =""; } else { genloc += " ::  "; }

  var object_html = "";
  if(feature.description) { object_html += "<div>" + encodehtml(feature.description)+ "</div>"; }
  if(feature.gene_names) { object_html += "<div>alias: " + feature.gene_names +"</div>"; }
  if(feature.entrez_id) { object_html += "<div>EntrezID: " + feature.entrez_id +"</div>"; }
  if(feature.chromloc) { 
    object_html += "<div>location: " + genloc + feature.chromloc; 
    var len = feature.end - feature.start+1;
    if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
    else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
    else { len += "bp"; }
    object_html += " ("+len+")</div>"; 
  }
  if(feature.maxexpress) { object_html += "<div>maxexpress: " + feature.maxexpress + "</div>"; }
  if(feature.score || feature.exp_total) { 
    object_html += "<div>";
    if(feature.score) { object_html += "<span style='margin-right:5px;' >score: " + feature.score + "</span>";  }
    if(feature.exp_total) { object_html += "<span>exp_total: " + feature.exp_total.toFixed(2) + "</span>"; }
    object_html += "</div>"; 
  }
  if(feature.cytostain) { object_html += "<div>cytostain: " + feature.cytostain + "</div>"; }

  return object_html;
}


function eedbSourceTooltip(source) {
  if(!source) return;
  if(current_source) { return; }

  toolTipWidth=350;
  var tdiv, tspan, tinput, ta;
  var main_div = document.createElement('div');
  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "box-sizing: border-box; border: 1px solid #808080; border-radius: 4px; "+
                                 "background-color:#404040; color:#FDFDFD; "+
                                 "opacity:0.85;");

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = source.name;

  tdiv = main_div.appendChild(document.createElement('div'));
  if(source.platform) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = source.platform;
  }
  if(source.source_name) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = source.source_name;
  }
  if(source.category) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = source.category;
  }
  if(source.owner_identity) {
    //tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tspan.innerHTML = "created by: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = source.owner_identity;
  }

  if(source.description.length > 0) {
    //main_div.appendChild(document.createElement('hr'));
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = source.description;
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


function eedbEdgeTooltip(edge) {
  if(!edge) return;

  toolTipWidth=350;
  var tdiv, tspan, tinput, ta;
  var main_div = document.createElement('div');
  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:250px; z-index:60; padding: 3px 5px 3px 3px; "+
                                 "box-sizing: border-box; border: 1px solid #808080; border-radius: 4px; "+
                                 "background-color:#404040; color:#FDFDFD; "+
                                 "opacity:0.85;");

  if(edge.name) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
    tspan.innerHTML = edge.name;
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  if(edge.platform) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = edge.platform;
  }
  if(edge.source) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = edge.source.name;

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = edge.source.category;
  }
  if(edge.owner_identity) {
    //tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tspan.innerHTML = "created by: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = edge.owner_identity;
  }
  if(edge.description.length > 0) {
    //main_div.appendChild(document.createElement('hr'));
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = edge.description;
  }
  
  if(edge.feature1) {
    var feature = edge.feature1;
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tspan.innerHTML = "feature1: ";
    if(feature.chromloc) { 
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = feature.chromloc; 
      var len = feature.end - feature.start+1;
      if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
      else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
      else { len += "bp"; }
      tspan.innerHTML += " ("+len+")"; 
    }
    //tspan = tdiv.appendChild(document.createElement('span'));
    //tspan.innerHTML = feature.name;
    //tdiv = main_div.appendChild(document.createElement('div'));
    //tdiv.style.marginLeft = "5px";
    //tdiv.innerHTML = eedbFeatureInfoHTML(feature);
  }
  if(edge.feature2) {
    var feature = edge.feature2;
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tspan.innerHTML = "feature2: ";
    if(feature.chromloc) { 
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = feature.chromloc; 
      var len = feature.end - feature.start+1;
      if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
      else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
      else { len += "bp"; }
      tspan.innerHTML += " ("+len+")"; 
    }
    //tspan = tdiv.appendChild(document.createElement('span'));
    //tspan.innerHTML = feature.name;
    //tdiv = main_div.appendChild(document.createElement('div'));
    //tdiv.style.marginLeft = "5px";
    //tdiv.innerHTML = eedbFeatureInfoHTML(feature);
  }
  
  //length
  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "padding: 0px 3px 0px 2px;");
  var len = edge.end - edge.start+1;
  if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
  else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
  else { len += "bp"; }
  tdiv.innerHTML = "edge length: "+len;

  if(edge.maxexpress) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "maxexpress: " + edge.maxexpress;
  }
  if(edge.score || edge.exp_total) {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(edge.score) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "padding: 0px 5px 0px 2px;");
      tspan.innerHTML = "score: " + edge.score;
    }
    if(edge.exp_total) { 
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "padding: 0px 5px 0px 2px;");
      tspan.innerHTML = "weight_total: " + edge.exp_total.toFixed(2);
    }
  }

  //weights
  for(var dtype in edge.weights) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tdiv.innerHTML = dtype+": ";
    var weights = edge.weights[dtype];
    for(var j=0; j<weights.length; j++) {
      var weight = weights[j];
      if(weight.source) { 
        tdiv = main_div.appendChild(document.createElement('div'));
        tdiv.style.marginLeft = "7px";
        if(weight.source.display_name) { tdiv.innerHTML += weight.source.display_name+": "; }
        else {  tdiv.innerHTML += weight.source.name+": "; }
      }
      else if(j>0) { tdiv.innerHTML += ", "; }
      tdiv.innerHTML += weight.weight;
    }
  }

  //main_div.appendChild(document.createElement('hr'));
  for(var tag in edge.mdata) { //new common mdata[].array system
    if(tag=="description") { continue; }
    if(tag=="eedb:description") { continue; }
    if(tag=="eedb:category") { continue; }
    if(tag=="display_name") { continue; }
    if(tag=="eedb:display_name") { continue; }
    if(tag=="eedb:owner_nickname") { continue; }
    if(tag=="eedb:owner_OpenID") { continue; }
    if(tag=="keyword") { continue; }

    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold;");
    tspan.innerHTML = tag + ": ";
    var value_array = edge.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      if(idx1!=0) { 
        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.innerHTML = ", " 
      }

      tspan = tdiv.appendChild(document.createElement('span'));
      //tspan.setAttribute('style', "color: rgb(105,105,105);");
      tspan.innerHTML = value;
    }
  }

  //update the tooltip
  var tooltip = document.getElementById("toolTipLayer");
  tooltip.innerHTML = "";
  tooltip.appendChild(main_div);
  toolTipSTYLE.display='block';
}


function eedbAddSearchTrack(searchSetID, sources, title) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }

  var searchDiv = document.createElement('div');
  searchDiv.id = searchSetID + "_searchTrack" + (newSearchTrackID++);
  searchDiv.setAttribute("class","EEDBsearch");
  searchDiv.style.display = 'none';
  searchDiv.style.marginTop = "5px";
  searchDiv.style.marginBottom = "5px";
  searchDiv.style.color = 'black';
  searchDiv.style.size = '12';
  searchDiv.style.fontFamily = 'arial, helvetica, sans-serif';
  searchDiv.onmouseout = "eedbClearSearchTooltip();";

  searchDiv.setAttribute("searchTitle", title);

  if(sources == "eeDB_gLyphs_configs") {
    searchDiv.setAttribute("mode", "eeDB_gLyphs_configs");
    searchDiv.setAttribute("showAll", 0);
    searchset.appendChild(searchDiv);
  } 
  else if(sources == "eeDB_gLyph_track_configs") {
    searchDiv.setAttribute("mode", "eeDB_gLyph_track_configs");
    searchDiv.setAttribute("showAll", 0);
    searchset.appendChild(searchDiv);
  }
  else {
    searchDiv.setAttribute("source_ids", sources);
    searchDiv.setAttribute("mode", "feature");
    searchDiv.setAttribute("showAll", 0);
    searchset.appendChild(searchDiv);
  }
  
  //return searchDiv.id;
  var searchTrack = eedbSearchGetSearchTrack(searchDiv.id, searchSetID);
  return searchTrack;
}


//---------------------------------------------------------------------------------
//
// direct object access and cache code
//   centralized object parsing
//
//---------------------------------------------------------------------------------

function eedbGetObject(id, mode) {
  //check the search object cache first
  for(var i=0; i<eedbSearchObjCache.length; i++) {
    var obj = eedbSearchObjCache[i];
    if(obj.id == id) {
      eedbSearchObjCache.splice(i, 1);
      eedbSearchObjCache.unshift(obj);
      return obj;
    }
  }
  //then go fetch it
  if(mode=="config") { id += ":::Config"; } 
  return eedbFetchObject(id);
}

function eedbReloadObject(id) {
  //first remove old object(s) from cache
  for(var i=0; i<eedbSearchObjCache.length; i++) {
    var obj = eedbSearchObjCache[i];
    if(obj.id == id) {
      eedbSearchObjCache.splice(i, 1);
      if(i>0) { i = i-1; }
    }
  }
  //then go fetch it
  return eedbFetchObject(id);
}


function eedbFetchObject(id, obj) {
  if(!id) { return null; }

  var url = eedbSearchCGI;
  url += "?format=fullxml;id=" + id;

  var src_regex = /^(.+)\:\:\:(.+)$/;
  var mymatch = src_regex.exec(id);
  if(mymatch && (mymatch.length == 3) && (mymatch[2] == "Config")) { 
    var uuid = mymatch[1];
    url = eedbConfigCGI; 
    url += "?format=fullxml;uuid=" + uuid;
  }

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }

  xhr.open("GET",url,false);
  xhr.send(null);
  if(xhr.readyState!=4) return null;
  if(xhr.responseXML == null) return null;
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    alert('Problem with central DB!');
    return null;
  }

  if(!obj) { obj = new Object; }
  obj.id = id;

  if(xmlDoc.getElementsByTagName("peer").length>0) {
    obj.peer = xmlDoc.getElementsByTagName("peer")[0];
  }
  if(xmlDoc.tagName == "configuration") {
    eedbParseConfigurationData(xmlDoc, obj);
  }
  else if(xmlDoc.getElementsByTagName("feature").length > 0) {
    obj.classname = "Feature";
    var featureDOM = xmlDoc.getElementsByTagName("feature")[0];
    eedbParseFeatureData(featureDOM, obj);
  }
  else if(xmlDoc.getElementsByTagName("edge").length > 0) {
    obj.classname = "Edge";
    var objectDOM = xmlDoc.getElementsByTagName("edge")[0];
    eedbParseEdgeXML(objectDOM, obj);
  } 
  else if(xmlDoc.getElementsByTagName("experiment").length >0) {
    obj.classname = "Experiment";
    var experimentDOM = xmlDoc.getElementsByTagName("experiment")[0];
    eedbParseExperimentData(experimentDOM, obj);
  }
  else if(xmlDoc.getElementsByTagName("featuresource").length > 0) {
    obj.classname = "FeatureSource";
    var fsourceDOM = xmlDoc.getElementsByTagName("featuresource")[0];
    eedbParseFeatureSourceData(fsourceDOM, obj);
  }
  else if(xmlDoc.getElementsByTagName("assembly").length > 0) {
    obj.classname = "Assembly";
    var assemblyDOM = xmlDoc.getElementsByTagName("assembly")[0];
    eedbParseAssemblyData(assemblyDOM, obj);
  }
  else if(xmlDoc.getElementsByTagName("edgesource").length > 0) {
    obj.classname = "EdgeSource";
    var fsourceDOM = xmlDoc.getElementsByTagName("edgesource")[0];
    eedbParseEdgeSourceXML(fsourceDOM, obj);
  } 
  
  eedbSearchObjCache.unshift(obj);
  while(eedbSearchObjCache.length > 100) { eedbSearchObjCache.pop(); }
  obj.full_load = true;
  return obj;
}

/*
function eedbFullLoadObject(id, obj) {
  if(!id) { return obj; }
  if(id == -1) { return obj; }
  if(!obj) { obj = new Object; }
  if(obj.full_load) { return obj; }
  eedbFetchObject(id, obj);
  obj.full_load = true;
  return obj;
}
*/

function eedbFullLoadObject(obj) {
  if(!obj) { return; }
  obj.request_full_load = false;
  if(!obj.id) { return; }

  if(obj.full_load) { 
    if(obj.callOutFunction) { obj.callOutFunction(obj); } 
    return;
  }

  var objectXHR = GetXmlHttpObject()
  if(objectXHR == null) { return; }
  objectXHR.current_object = obj;
  fullLoadXHRs[obj.id] = objectXHR;

  // XML POST query
  var paramXML = "<zenbu_query><format>fullxml</format><mode>object</mode><id>"+(obj.id)+"</id></zenbu_query>";
  console.log("eedbFullLoadObject : "+paramXML);

  objectXHR.onreadystatechange= function(id) { return function() { eedbFullLoadCurrentObjectReply(id); };}(obj.id);
  objectXHR.open("POST", eedbSearchCGI, true);
  objectXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  objectXHR.send(paramXML);
}

function eedbFullLoadCurrentObjectReply(objID) {
  if(!objID) { return; }

  var objectXHR = fullLoadXHRs[objID];
  
  if(!objectXHR) { return; }
  if(!objectXHR.current_object) { return; }
  if(objectXHR.responseXML == null) { return; }
  if(objectXHR.readyState!=4) { return; }
  if(objectXHR.status!=200) { return; }
  
  var current_object = objectXHR.current_object;

  var xmlDoc=objectXHR.responseXML.documentElement;
  if(xmlDoc==null) { return; }

  var currentObjectDOM = null;
  var object_reply_children = xmlDoc.childNodes;
  console.log("eedbFullLoadCurrentObjectReply sources block. has "+object_reply_children.length+" children");
  for (var i = 0; i < object_reply_children.length; i++) {
    var objectDOM = object_reply_children[i];
    if(!objectDOM) { continue; }
    if(!objectDOM.tagName) { continue; }

    var objID =  objectDOM.getAttribute("id");
    if(current_object.id == objID) {
      console.log("found matching objectDOM by id: "+objID);
      currentObjectDOM = objectDOM;
    }
  }

  if(currentObjectDOM) {
    console.log("have currentObjectDOM tagName:", currentObjectDOM.tagName);
    if(currentObjectDOM.tagName == "assembly")      { eedbParseAssemblyData(currentObjectDOM, current_object); } 
    if(currentObjectDOM.tagName == "featuresource") { eedbParseFeatureSourceData(currentObjectDOM, current_object); }
    if(currentObjectDOM.tagName == "experiment")    { eedbParseExperimentData(currentObjectDOM, current_object); }
    if(currentObjectDOM.tagName == "edgesource")    { eedbParseEdgeSourceXML(currentObjectDOM, current_object); }    
    if(currentObjectDOM.tagName == "configuration") { eedbParseConfigurationData(currentObjectDOM, current_object); }
    if(currentObjectDOM.tagName == "feature")       { eedbParseFeatureFullXML(currentObjectDOM, current_object); }
    if(currentObjectDOM.tagName == "edge")          { eedbParseEdgeXML(currentObjectDOM, current_object); }
  } else {
    console.log("FAILED to find matching currentObjectDOM");
    current_object.full_load_error = true;
  }
  current_object.full_load = true;
  
  delete fullLoadXHRs[objID]; //clear

  if(current_object.callOutFunction) { current_object.callOutFunction(current_object); }
}

//-----

function eedbFullLoadCurrentSource() {
  if(!current_source) { return; }
  if(current_source.full_load) { return; }

  current_source.request_full_load = false;

  var sourceReloadXMLHttp = GetXmlHttpObject()
  if(sourceReloadXMLHttp == null) { return; }
  current_source.xhr = sourceReloadXMLHttp;

  // XML POST query
  var paramXML = "<zenbu_query><mode>sources</mode><format>fullxml</format><source_ids>"+(current_source.id)+"</source_ids></zenbu_query>";
  console.log("eedbFullLoadCurrentSource : "+paramXML);

  sourceReloadXMLHttp.onreadystatechange = eedbFullLoadCurrentSourceReply;
  sourceReloadXMLHttp.open("POST", eedbSearchCGI, true);
  sourceReloadXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  sourceReloadXMLHttp.send(paramXML);
}

function eedbFullLoadCurrentSourceReply() {
  if(!current_source) { return; }
  var sourceReloadXMLHttp = current_source.xhr;
  if(!sourceReloadXMLHttp) { return; }
  if(sourceReloadXMLHttp.responseXML == null) { return; }
  if(sourceReloadXMLHttp.readyState!=4) { return; }
  if(sourceReloadXMLHttp.status!=200) { return; }

  var xmlDoc=sourceReloadXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return; }

  var currentSourceDOM = null;
  var sources_children = xmlDoc.childNodes;
  console.log("eedbFullLoadCurrentSourceReply sources block. has "+sources_children.length+" children");
  for (var i = 0; i < sources_children.length; i++) {
    var sourceDOM = sources_children[i];
    if(!sourceDOM) { continue; }
    if(!sourceDOM.tagName) { continue; }

    var srcID =  sourceDOM.getAttribute("id");
    if(current_source.id == srcID) {
      console.log("found matching sourceDOM by id");
      currentSourceDOM = sourceDOM;
    }
  }

  if(currentSourceDOM) {
    console.log("have currentSourceDOM tagName:", currentSourceDOM.tagName);
    if(currentSourceDOM.tagName == "assembly")      { eedbParseAssemblyData(currentSourceDOM, current_source); } 
    if(currentSourceDOM.tagName == "featuresource") { eedbParseFeatureSourceData(currentSourceDOM, current_source); }
    if(currentSourceDOM.tagName == "experiment")    { eedbParseExperimentData(currentSourceDOM, current_source); }
    if(currentSourceDOM.tagName == "edgesource")    { eedbParseEdgeSourceXML(currentSourceDOM, current_source); }
    // eedbParseConfigurationData(xmlDoc, obj);
  } else {
    console.log("FAILED to find matching currentSourceDOM");
    current_source.full_load_error = true;
  }

  current_source.full_load = true;

  eedbDisplaySourceInfo(); //refresh current_source
}



function eedbParsePeerData(xmlPeer, peer) {
  if(!xmlPeer) { return; }

  if(!peer) { peer = new Object; }
  peer.classname    = "Peer";
  peer.uuid         = xmlPeer.getAttribute("uuid");
  peer.alias        = xmlPeer.getAttribute("alias");
  peer.db_url       = xmlPeer.getAttribute("db_url");
  return peer;
}


function eedbParseFeatureData(xmlFeature, feature) {
  if(!xmlFeature) { return; }

  if(!feature) { feature = new Object; }

  feature.classname    = "Feature";
  feature.id           = xmlFeature.getAttribute("id");
  feature.source       = null; //object
  feature.taxon_id     = "";
  feature.asm          = "";
  feature.chrom        = "";
  feature.strand       = " ";
  feature.start        = -1;
  feature.end          = -1;
  feature.description  = "";
  feature.category     = "";
  feature.gene_names   = "";
  
  if(xmlFeature.getAttribute("fsrc")) { feature.source_name = xmlFeature.getAttribute("fsrc"); }
  if(xmlFeature.getAttribute("category")) { feature.category = xmlFeature.getAttribute("category"); }
  if(xmlFeature.getAttribute("ctg")) { feature.category = xmlFeature.getAttribute("ctg"); }
  if(xmlFeature.getAttribute("fsrc_id")) { feature.source_id = xmlFeature.getAttribute("fsrc_id"); }
  if(xmlFeature.getAttribute("source_id")) { feature.source_id = xmlFeature.getAttribute("source_id"); }
  if(xmlFeature.getAttribute("name")) { feature.name = xmlFeature.getAttribute("name"); }
  if(xmlFeature.getAttribute("desc")) { feature.name = xmlFeature.getAttribute("desc"); }
  if(xmlFeature.getAttribute("taxon_id")) { feature.taxon_id = xmlFeature.getAttribute("taxon_id"); }
  if(xmlFeature.getAttribute("asm")) { feature.asm = xmlFeature.getAttribute("asm"); }
  if(xmlFeature.getAttribute("chr")) { feature.chrom = xmlFeature.getAttribute("chr"); }
  if(xmlFeature.getAttribute("strand")) { feature.strand = xmlFeature.getAttribute("strand"); }
  if(xmlFeature.getAttribute("start")) { feature.start = Math.round(xmlFeature.getAttribute("start")); }
  if(xmlFeature.getAttribute("end")) { feature.end = Math.round(xmlFeature.getAttribute("end")); }
  if(xmlFeature.getAttribute("sig")) { feature.score  = parseFloat(xmlFeature.getAttribute('sig')); }
  if(xmlFeature.getAttribute("score")) { feature.score  = parseFloat(xmlFeature.getAttribute('score')); }
  
  //if(xmlFeature.getAttribute("peer")) { feature.id = xmlFeature.getAttribute("peer") + "::"+ feature.id; }

  //20180315, thinking about going back to source_id to reduce XML size, but will keep here for now
  if(xmlFeature.getElementsByTagName("featuresource")) {
    var xmlSource = xmlFeature.getElementsByTagName("featuresource")[0];
    if(xmlSource) { 
      feature.source = eedbParseFeatureSourceData(xmlSource); 
      feature.source_name = feature.source.name;
      feature.category = feature.source.category;
      feature.source_id = feature.source.id;
    }
  }
  if(!feature.category) { feature.category = ""; }
  if(!feature.source_name) { feature.source_name = ""; }
  if(!feature.fsrc_id) { feature.fsrc_id = feature.source_id; }

  if(xmlFeature.getElementsByTagName("chrom")) {
    var xmlChrom = xmlFeature.getElementsByTagName("chrom")[0];
    if(xmlChrom) { 
      feature.taxon_id     = xmlChrom.getAttribute("taxon_id");
      feature.asm          = xmlChrom.getAttribute("asm");
      feature.chrom        = xmlChrom.getAttribute("chr");
    }
  }
  feature.fsrc_id = feature.source_id; //backward compatability

  if(feature.chrom) {
    feature.chromloc = feature.asm.toLowerCase() +"::"+
                       feature.chrom+":"+ feature.start +".."+ feature.end+
                       feature.strand;
  }
  /*
  var maxexpress = xmlFeature.getElementsByTagName("max_expression");
  if(maxexpress && (maxexpress.length > 0)) {
    var express = maxexpress[0].getElementsByTagName("express");
    for(i=0; i<express.length; i++) {
      var platform = express[i].getAttribute("platform");
      if(platform == 'Illumina microarray') { platform = "ILMN"; }
      object_html += platform + ":" + express[i].getAttribute("maxvalue") + " ";
    }
  }
  */

  var xmlCollabs = xmlFeature.getElementsByTagName("collaboration");
  if(xmlCollabs && (xmlCollabs.length>0)) {
    feature.collaboration = eedbParseCollaborationData(xmlCollabs[0]);
  }

  eedbParseMetadata(xmlFeature, feature);
  //post process metadata
  if(feature.mdata["EntrezID"])  { feature.entrez_id = feature.mdata["EntrezID"][0]; }
  if(feature.mdata["entrez_ID"]) { feature.entrez_id = feature.mdata["entrez_ID"][0]; }
  if(feature.mdata["refseq_ID"]) { feature.refseq_id = feature.mdata["refseq_ID"][0]; }
  if(!feature.name && feature.mdata["geneName"]) { feature.name = feature.mdata["geneName"][0]; }
  if(!feature.name && feature.mdata["geneID"]) { feature.name = feature.mdata["geneID"][0]; }

  return feature;
}


function eedbParseFeatureFullXML(featureXML, feature) {
  if(!featureXML) { return null; }
  if(!feature) { feature = new Object; }

  eedbParseFeatureData(featureXML, feature);

  if(feature.mdata["bed:itemRgb"]) {
    //maybe need to parse value to make sure it is valid
    var value1 = feature.mdata["bed:itemRgb"][0]
    var rgb_regex = /^(\d+)\,(\d+)\,(\d+)$/;
    if(rgb_regex.exec(value1)) {
      feature.color = "rgb("+value1+")";
    }
  }
  if(feature.mdata["cytostain"]) { feature.cytostain = feature.mdata["cytostain"][0]; }

  // subfeatures
  var subfeats = featureXML.getElementsByTagName("feature");
  if(subfeats && subfeats.length>0) {
    //document.getElementById("message").innerHTML += fname + " has " + (subfeats.length) +" subfs; ";
    var subfeatures_array = new Array();
    feature.subfeatures = subfeatures_array;
    for(var j=0; j<subfeats.length; j++) {
      var subfeatureXML = subfeats[j];
      var subf = eedbParseFeatureFullXML(subfeatureXML);
      subfeatures_array.push(subf);
    }
  }

  // expression  
  var express = featureXML.getElementsByTagName("expression");
  for(var j=0; j<express.length; j++) {
    if(!feature.expression) { feature.expression = new Array(); }
    if(!feature.expression_hash) { feature.expression_hash = new Object(); }
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

    if(!(feature.expression_hash[expression.datatype])) { feature.expression_hash[expression.datatype] = new Array; }
    feature.expression_hash[expression.datatype].push(expression);

    if(expressXML.getAttribute("dup")) {
      expression.dup = parseFloat(expressXML.getAttribute("dup"));
    }

    var expressValue = parseFloat(expressXML.getAttribute("value"));
    expression.total = expressValue;

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
    //console.log("parse feature "+(feature.id)+" expression length "+(express.length)+" idx "+(feature.expression.length)+" dtype["+(expression.datatype)+"] val="+expressValue+"  total="+(expression.total));
  }

  return feature;
}

function eedbGenerateFeatureDOM(feature) {
  var doc = document.implementation.createDocument("", "", null);
  var featureDOM = doc.createElement("feature");
  if(!feature) { return featureDOM; }
  
  if(feature.id) { featureDOM.setAttribute("id", feature.id); }
  if(feature.source_name) { featureDOM.setAttribute("fsrc", feature.source_name); }
  if(feature.category) { featureDOM.setAttribute("category", feature.category); }
  if(feature.source_id) { featureDOM.setAttribute("source_id", feature.source_id); }
  if(feature.name) { featureDOM.setAttribute("name", feature.name); }
  if(feature.taxon_id) { featureDOM.setAttribute("taxon_id", feature.taxon_id); }
  if(feature.asm) { featureDOM.setAttribute("asm", feature.asm); }
  if(feature.chrom) { featureDOM.setAttribute("chr", feature.chrom); }
  if(feature.strand) { featureDOM.setAttribute("strand", feature.strand); }
  if(feature.start) { featureDOM.setAttribute("start", feature.start); }
  if(feature.end) { featureDOM.setAttribute("end", feature.end); }
  if(feature.score) { featureDOM.setAttribute("score", feature.score); }
  
  if(feature.source) {
    //var fsrcDOM = eedbGenerateFeatureSourceDOM(feature.source); 
    //featureDOM.appendChild(fsrcDOM);
  }
  if(feature.collaboration) {
    //var collabDOM = eedbGenerateCollaborationDOM(feature.collaboration);
    //featureDOM.appendChild(collabDOM);
  }
  if(feature.mdata) {
    //eedbGenerateMetadataDOM(feature.mdata, featureDOM);
  }
  return featureDOM;
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
function feature_reverse_loc_sort_func(a,b) {
  if(a.end < b.end) { return 1; }
  if(a.end > b.end) { return -1; }
  if(a.start < b.start) { return 1; }
  if(a.start > b.start) { return -1; }
  return 0;
}
function feature_size_sort_func(a,b) {
  var size_a = a.end - a.start + 1;
  var size_b = b.end - b.start + 1;  
  if(size_a < size_b) { return -1; }
  if(size_a > size_b) { return 1; }
  return 0;
}


function eedbParseEdgeXML(edgeXML, edge) {
  if(!edgeXML) { return; }

  if(!edge) { edge = new Object; }

  edge.classname      = "Edge";
  edge.id             = edgeXML.getAttribute("id");
  edge.source         = null; //object
  edge.source_id      = edgeXML.getAttribute("esrc_id");
  edge.dir            = edgeXML.getAttribute("dir");
  edge.feature1       = null;
  edge.feature2       = null;
  edge.feature1_id    = edgeXML.getAttribute("f1id");
  edge.feature2_id    = edgeXML.getAttribute("f2id");
  edge.name  = "";
  edge.category  = "";
  edge.description  = "";

  eedbParseMetadata(edgeXML, edge);

  // edge_weight  
  edge.weights = new Object();
  var weights = edgeXML.getElementsByTagName("edgeweight");
  for(var j=0; j<weights.length; j++) {
    var weightXML = weights[j];

    weight = new Object();
    weight.source     = null //object;
    weight.source_id  = weightXML.getAttribute("datasource_id");
    weight.expid  = weightXML.getAttribute("datasource_id");
    weight.datatype   = weightXML.getAttribute("datatype");
    weight.weight     = 0;
    //mirror the expression to easily integrate into existing code
    weight.count      = 1;
    weight.dup        = 1;
    weight.sense      = 0;
    weight.antisense  = 0;
    weight.total      = 0;
    if(weightXML.getAttribute("weight")) {
      weight.weight = parseFloat(weightXML.getAttribute("weight"));
      weight.total = weight.weight;
      weight.sense = weight.weight;
    }
    if(weight.dir == "-") {
      weight.antisense = weight.weight;
      weight.sense = 0;
    }

    if(!(edge.weights[weight.datatype])) { edge.weights[weight.datatype] = new Array; }
    edge.weights[weight.datatype].push(weight);
  }
  
  var f1 = edgeXML.getElementsByTagName("feature1");
  if(f1 && f1.length>0) { 
    var featureXML = f1[0].firstChild;
    var feature = eedbParseFeatureFullXML(featureXML);
    if(feature) { 
      edge.feature1 = feature; 
      edge.feature1_id = null;
    }
  }
  var f2 = edgeXML.getElementsByTagName("feature2");
  if(f2 && f2.length>0) { 
    var featureXML = f2[0].firstChild;
    var feature = eedbParseFeatureFullXML(featureXML);
    if(feature) { 
      edge.feature2 = feature; 
      edge.feature2_id = null;
    }
  }
  
  return edge;
}


function eedbParseDataSourceXML(sourceXML, source) {
  if(!sourceXML) { return; }

  if(!source) { source = new Object; }

  source.classname    = "DataSource";
  source.id           = sourceXML.getAttribute("id");
  source.name         = sourceXML.getAttribute("name");
  source.category     = sourceXML.getAttribute("category");
  source.platform     = "";
  source.series_point = "";
  source.feature_count = 0;
  source.edge_count    = 0;
  source.platform     = '';
  source.assembly     = '';
  source.description  = "";
  source.series_name  = "";
  source.ev_terms     = '';
  source.biosample    = '';
  source.treatment    = "";

  if(sourceXML.getAttribute("platform")) { source.platform = sourceXML.getAttribute("platform"); }
  if(sourceXML.getAttribute("series_name")) { source.series_name = sourceXML.getAttribute("series_name"); }
  if(sourceXML.getAttribute("series_point")) { source.series_point = sourceXML.getAttribute("series_point"); }

  if(sourceXML.getAttribute("import_date")) {
    source.import_date  = sourceXML.getAttribute("import_date");
  }
  if(sourceXML.getAttribute("create_date")) {
    source.import_date  = sourceXML.getAttribute("create_date");
  }
  if(sourceXML.getAttribute("create_timestamp")) {
    source.import_timestamp  = sourceXML.getAttribute("create_timestamp");
  }
  if(sourceXML.getAttribute("owner_identity")) {
    source.owner_identity  = sourceXML.getAttribute("owner_identity");
  }
  if(sourceXML.getAttribute("feature_count")) {
    source.feature_count  = parseInt(sourceXML.getAttribute("feature_count"));
  }
  if(sourceXML.getAttribute("edge_count")) {
    source.edge_count  = parseInt(sourceXML.getAttribute("edge_count"));
  }
  source.assembly     = '';
  source.description  = "";
  source.ev_terms     = '';
  source.biosample    = '';
  source.treatment    = "";

  if(source.id) {
    var zobj = unparse_dbid(source.id);
    if(zobj.uuid) {
      source.uuid = zobj.uuid;
      source.objID = zobj.objID;
    }
  }

  eedbParseMetadata(sourceXML, source);

  var desc = sourceXML.getElementsByTagName("description");
  if(desc && desc.length>0) { source.description = desc[0].firstChild.nodeValue; }
  if(source.name) { source.name = source.name.replace(/_/g, " "); }
  if(source.treatment) { source.treatment = source.treatment.replace(/_/g, " "); }

  return source;
}


function eedbParseEdgeSourceXML(sourceXML, source) {
  source = eedbParseDataSourceXML(sourceXML, source);
  source.classname    = "EdgeSource";
  return source;
}


function eedbParseFeatureSourceData(xmlFeatureSource, featuresource) {
  if(!xmlFeatureSource) { return; }

  if(!featuresource) { 
    featuresource = new Object;
    featuresource.name         = '';
    featuresource.platform     = '';
    featuresource.assembly     = '';
    featuresource.description  = "";
  }

  featuresource.classname    = "FeatureSource";
  featuresource.id           = xmlFeatureSource.getAttribute("id");
  featuresource.name         = xmlFeatureSource.getAttribute("name");
  featuresource.category     = xmlFeatureSource.getAttribute("category");
  featuresource.feature_count = 0;

  if(xmlFeatureSource.getAttribute("import_date")) {
    featuresource.import_date  = xmlFeatureSource.getAttribute("import_date");
  }
  if(xmlFeatureSource.getAttribute("create_date")) {
    featuresource.import_date  = xmlFeatureSource.getAttribute("create_date");
  }
  if(xmlFeatureSource.getAttribute("create_timestamp")) {
    featuresource.import_timestamp  = xmlFeatureSource.getAttribute("create_timestamp");
  }
  if(xmlFeatureSource.getAttribute("owner_identity")) {
    featuresource.owner_identity  = xmlFeatureSource.getAttribute("owner_identity");
  }
  if(xmlFeatureSource.getAttribute("feature_count")) {
    featuresource.feature_count  = parseInt(xmlFeatureSource.getAttribute("feature_count"));
  }

  if(featuresource.id) {
    var zobj = unparse_dbid(featuresource.id);
    if(zobj.uuid) {
      featuresource.uuid = zobj.uuid;
      featuresource.objID = zobj.objID;
    }
  }

  eedbParseMetadata(xmlFeatureSource, featuresource);
  return featuresource;
}


function eedbParseExperimentData(xmlExperiment, experiment) {
  if(!xmlExperiment) { return; }

  if(!experiment) { 
    experiment = new Object;
    experiment.name         = "";
    experiment.series_name  = "";
    experiment.ev_terms     = '';
    experiment.assembly     = '';
    experiment.biosample    = '';
    experiment.treatment    = "";
    experiment.description  = "";
  }

  experiment.classname    = "Experiment";
  if(xmlExperiment.getAttribute("id")) { experiment.id = xmlExperiment.getAttribute("id"); }
  if(xmlExperiment.getAttribute("name")) { experiment.name = xmlExperiment.getAttribute("name"); }
  if(xmlExperiment.getAttribute("platform")) { experiment.platform = xmlExperiment.getAttribute("platform"); }
  if(xmlExperiment.getAttribute("series_name")) { experiment.series_name = xmlExperiment.getAttribute("series_name"); }
  if(xmlExperiment.getAttribute("series_point")) { experiment.series_point = xmlExperiment.getAttribute("series_point"); }
  if(xmlExperiment.getAttribute("demux_key")) { experiment.demux_key = xmlExperiment.getAttribute("demux_key"); }

  if(xmlExperiment.getAttribute("import_date")) {
    experiment.import_date  = xmlExperiment.getAttribute("import_date");
  }
  if(xmlExperiment.getAttribute("create_date")) {
    experiment.import_date  = xmlExperiment.getAttribute("create_date");
  }
  if(xmlExperiment.getAttribute("create_timestamp")) {
    experiment.import_timestamp  = xmlExperiment.getAttribute("create_timestamp");
  }
  if(xmlExperiment.getAttribute("feature_count")) {
    experiment.feature_count  = parseInt(xmlExperiment.getAttribute("feature_count"));
  }
  if(xmlExperiment.getAttribute("owner_identity")) {
    experiment.owner_identity  = xmlExperiment.getAttribute("owner_identity");
  }
  eedbParseMetadata(xmlExperiment, experiment);
  var desc = xmlExperiment.getElementsByTagName("description");
  if(desc && desc.length>0) { experiment.description = desc[0].firstChild.nodeValue; }
  if(experiment.name) { experiment.name = experiment.name.replace(/_/g, " "); }
  if(experiment.treatment) { experiment.treatment = experiment.treatment.replace(/_/g, " "); }

  var subsrc_node = xmlExperiment.getElementsByTagName("subsources");
  if(subsrc_node && (subsrc_node.length>0)) {
    subsrc_node = subsrc_node[0];
    if(!experiment.subsources) { experiment.subsources = new Object(); } //hash
    experiment.subsource_count = subsrc_node.getAttribute("count");

    var children = subsrc_node.childNodes;
    for (var j=0; j<children.length; j++) {
      var subsrcDOM = children[j]
      if(subsrcDOM.tagName != "experiment") { continue; }
      var subID = subsrcDOM.getAttribute("id");
      var subexp = experiment.subsources[subID];
      if(!subexp) { //make new subsource as shallow-copy of parent first
        subexp = new Object;
        subexp.classname          = "Experiment";
        subexp.id                 = subID
        subexp.name               = experiment.name;
        subexp.description        = experiment.description;
        subexp.platform           = experiment.platform;
        subexp.series_point       = experiment.series_point;
        subexp.import_date        = experiment.import_date;
        subexp.import_timestamp   = experiment.import_timestamp ;
        subexp.owner_identity     = experiment.owner_identity;
        subexp.parent_source      = experiment;
        experiment.subsources[subexp.id] = subexp;
      }
      eedbParseExperimentData(subsrcDOM, subexp); //parse specific subsource xml
      //eedbParseMetadata(xmlExperiment, subexp); //copy/parse the parent mdata into the child subsource. but this is really slow, need to rethink
    }
  }

  if(experiment.id) {
    var zobj = unparse_dbid(experiment.id);
    if(zobj.uuid) {
      experiment.uuid = zobj.uuid;
      experiment.objID = zobj.objID;
    }
  }

  return experiment;
}


function eedbParseMetadata(eedbXML, eedbObject) {
  if(!eedbXML) { return; }
  if(!eedbObject) { return; }

  //eedbObject.id           = eedbXML.getAttribute("id");
  if(!eedbObject.mdata) { 
    eedbObject.mdata = new Object; //hash to concat string
    eedbObject.ev_terms     = '';
    eedbObject.biosample    = "";
    eedbObject.treatment    = "";
    eedbObject.description  = "";
    eedbObject.gene_names   = "";
    eedbObject.tissue       = "";
    eedbObject.cell_type    = "";
    eedbObject.cell_line    = "";
    eedbObject.species_name = "";
  }

  var children = eedbXML.childNodes;
  for(var j=0; j<children.length; j++) {
    var mdataDOM = children[j]
    if(mdataDOM.tagName != "symbol") { continue; }

    var tag   = mdataDOM.getAttribute("type");
    var value = mdataDOM.getAttribute("value");
    
    if(!value) { continue; }
    if(/^UNDEFINED/.exec(value)) { continue; }

    if(!(eedbObject.mdata[tag])) { eedbObject.mdata[tag] = new Array; }
    eedbObject.mdata[tag].push(value);
  }
  for(var j=0; j<children.length; j++) {
    var mdataDOM = children[j]
    if(mdataDOM.tagName != "mdata") { continue; }

    if(!(mdataDOM.firstChild)) { continue; }
    if(!(mdataDOM.firstChild.nodeValue)) { continue; }

    var tag   = mdataDOM.getAttribute("type")
    var value = mdataDOM.firstChild.nodeValue;
    if(tag == "osc_header") { continue; }
    if(tag == "oscfile_colnum") { continue; }
    if(!value) { continue; }
    if(/^UNDEFINED/.exec(value)) { continue; }

    if(!(eedbObject.mdata[tag])) { eedbObject.mdata[tag] = new Array; }
    eedbObject.mdata[tag].push(value);
  }

  //remove duplicates code
  for(var tag in eedbObject.mdata) {
    var value_array = eedbObject.mdata[tag];
    var value_hash = new Object;
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];
      value_hash[value]= 1;
    }
    eedbObject.mdata[tag] = new Array;
    for(var value in value_hash) {
      eedbObject.mdata[tag].push(value);
    }
  }


  //converted all the specific parsing into a general post-process, but some of these attributes are no longer used
  //so at some point I want to go and clean this up a bit
  eedbObject.tissue = "";
  eedbObject.treatment = "";
  eedbObject.gene_names = "";
  for(var tag in eedbObject.mdata) {
    var value_array = eedbObject.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      if(tag == "uuid") { eedbObject.uuid = value; }
      if(tag == "library_name") { eedbObject.lib_name = value; }
      if(tag == "EV_term") { eedbObject.ev_terms += value + ", "; }
      if(tag == "ILMN_hg6v2_key") { eedbObject.gene_names += value + " "; }
      if(tag == "Entrez_synonym") { eedbObject.gene_names += value + " "; }
      if(tag == "TFsymbol") { eedbObject.gene_names += value + " "; }
      if((tag == "EntrezGene") && (eedbObject.name.toLowerCase() != value.toLowerCase())) { eedbObject.gene_names += value + " "; }
      if(tag == "EntrezID") { eedbObject.entrez_id = value; }
      if(tag == "OMIM") { eedbObject.omim_id = value; }
      if(tag == "GeneticLoc") { eedbObject.genloc = value; }

      if(tag == "eedb:category") { eedbObject.category = value; }
      if(tag == "eedb:display_name") { eedbObject.name = value; }
      if(tag == "display_name") { eedbObject.name = value; }
      if(tag == "assembly") { eedbObject.assembly = value; }
      if(tag == "assembly_name") { eedbObject.assembly = value; }
      if(tag == "eedb:assembly_name") { eedbObject.assembly = value; }
      if(tag == "genome") { eedbObject.assembly = value; }
      if(tag == "tissue") { eedbObject.tissue += value+" "; }
      if(tag == "tissue_type") { eedbObject.tissue += value+" "; }
      if(tag == "osc:LSArchive_sample_tissue_type") { eedbObject.tissue += value+" "; }
      if(tag == "eedb:cell_line") { eedbObject.cell_line = value; }
      if(tag == "cell_line") { eedbObject.cell_line = value; }
      if(tag == "osc:LSArchive_sample_cell_line") { eedbObject.cell_line = value; }
      if(tag == "cell_type") { eedbObject.cell_type = value; }
      if(tag == "osc:LSArchive_sample_cell_type") { eedbObject.cell_type = value; }
      if(tag == "species_name") { eedbObject.species_name = value; }
      if(tag == "osc:LSArchive_sample_organism") { eedbObject.species_name = value; }
      if(tag == "series_name") { eedbObject.series_name = value; }
      if(tag == "eedb:platform" && !eedbObject.platform) { eedbObject.platform = value; }
      if(tag == "eedb:series_name") { eedbObject.series_name = value; }
      if(tag == "eedb:series_point") { eedbObject.series_point = value; }
      if(tag == "experimental_condition") { eedbObject.treatment += value+" "; }
      if(tag == "eedb:treatment") { eedbObject.treatment = value+" "; }
      if(tag == "osc:LSArchive_sample_experiment_condition") { eedbObject.treatment += value+" "; }
      if(tag == "description") { eedbObject.description = value; }
      if(tag == "Summary") { eedbObject.summary = value; }
      if(tag == "comments") { eedbObject.comments = value; }
      if(tag == "sam:description") { eedbObject.sam_desc = value; }
      if(tag == "zenbu:proxy_id") { eedbObject.proxy_id = value; }
      if(tag == "rgbcolor") { eedbObject.rgbcolor = value; }
      if(tag == "enc:assay") { eedbObject.encAssay = value; }
      if(tag == "enc:biosample") { eedbObject.encBiosample = value; }
      if(tag == "enc:biosampleSynonyms") { eedbObject.encBiosampleSyms = value; }
      if(tag == "enc:biosampleTreatments") { eedbObject.encBiosampleTreatments = value; }

      //if((tag == "eedb:owner_OpenID") && !eedbObject.owner_openID) { eedbObject.owner_openID = value; }
    }
  }

  if(!eedbObject.description && eedbObject.comments) { eedbObject.description = eedbObject.comments; }
  if(!eedbObject.description && eedbObject.sam_desc) { eedbObject.description = eedbObject.sam_desc; }
  //if(!eedbObject.name) { eedbObject.name = eedbObject.id; }
  if(!eedbObject.treatment && eedbObject.series_name) { eedbObject.treatment = eedbObject.series_name; }

  //if(eedbObject.species_name) { eedbObject.biosample += eedbObject.species_name + " "; }
  if(eedbObject.cell_line)    { eedbObject.biosample += eedbObject.cell_line + " "; }
  if(eedbObject.cell_type)    { eedbObject.biosample += eedbObject.cell_type + " "; }
  if(eedbObject.tissue)       { eedbObject.biosample += eedbObject.tissue + " "; }
  if(eedbObject.encBiosample) { eedbObject.biosample += eedbObject.encBiosample + " "; }
  if(eedbObject.encBiosampleSyms) { eedbObject.biosample += eedbObject.encBiosampleSyms + " "; }

  if(!eedbObject.platform && eedbObject.encAssay) { eedbObject.platform = eedbObject.encAssay; }
  if(!eedbObject.treatment && eedbObject.encBiosampleTreatments) { eedbObject.treatment = eedbObject.encBiosampleTreatments; }

  eedbObject.description += "";
}


function eedbParseSimpleMetadata(eedbXML, eedbObject) {
  if(!eedbXML) { return; }
  if(!eedbObject) { return; }
  
  if(!eedbObject.mdata) { eedbObject.mdata = new Object; } //hash to array of values
  
  var children = eedbXML.childNodes;

  for(var j=0; j<children.length; j++) {
    var mdataDOM = children[j]
    if(mdataDOM.tagName != "symbol") { continue; }

    var tag   = mdataDOM.getAttribute("type");
    var value = mdataDOM.getAttribute("value");
    
    if(!value) { continue; }
    if(/^UNDEFINED/.exec(value)) { continue; }
    
    if(!(eedbObject.mdata[tag])) { eedbObject.mdata[tag] = new Array; }
    eedbObject.mdata[tag].push(value);
  }
  for(var j=0; j<children.length; j++) {
    var mdataDOM = children[j]
    if(mdataDOM.tagName != "mdata") { continue; }
    if(!(mdataDOM.firstChild)) { continue; }
    if(!(mdataDOM.firstChild.nodeValue)) { continue; }
    
    var tag   = mdataDOM.getAttribute("type")
    var value = mdataDOM.firstChild.nodeValue;
    if(tag == "osc_header") { continue; }
    if(tag == "oscfile_colnum") { continue; }
    if(!value) { continue; }
    if(/^UNDEFINED/.exec(value)) { continue; }
    
    if(!(eedbObject.mdata[tag])) { eedbObject.mdata[tag] = new Array; }
    eedbObject.mdata[tag].push(value);
  }
}

//=== check_by_filter_logic : ported from c++
function check_by_filter_logic(eedbObject, filter) {
  if(!eedbObject) { return false; }
  if(!eedbObject.mdata) { return false; }

  filter = trim_string(filter); //trims white space from front and rear
  if(!filter) { //empty string matches everything
    //console.log("check_by_filter_logic["+filter+"]");
    return true;
  }  
  //console.log("check_by_filter_logic["+filter+"]");  

  //"not" phrase
  p1 = filter.indexOf("not ");
  if(p1==0) { 
    //invert phrase logic response
    //console.log("  not phrase[%s]\n", filter);
    filter = filter.substring(p1+4);
    if(check_by_filter_logic(eedbObject, filter)) { return false; } else { return true; }
  }

  //"!(" not phrase
  p1 = filter.indexOf("!(");
  if(p1==0) { 
    //invert block logic response
    //console.log("  not phrase[%s]\n", filter);
    filter = filter.substring(1);
    if(check_by_filter_logic(eedbObject, filter)) { return false; } else { return true; }
  }
  
  // '(' blocking
  if(filter.charAt(0) == '(') {
    //console.log(" filter[%s] start with (\n", filter);
    var cnt=1;
    p1=1;
    while(p1<filter.length && cnt>0) {
      if(filter.charAt(p1) == '(') { cnt++; }
      if(filter.charAt(p1) == ')') { cnt--; }
      if(cnt>0) { p1++; }
    }
    phrase1 = "";
    phrase2 = "";
    if(cnt==0) { 
      phrase1 = filter.substring(1, p1); 
      //console.log(" filter found matching ) p1=[%s], phrase1[%s]\n", filter.charAt(p1), phrase1);
    }
    else { phrase1 = filter.substring(1); }
    
    if(p1<filter.length) { p1++; } //move past the ')'
    //eat whitespace on phrase2
    while(p1<filter.length && ((filter.charAt(p1)==' ') || (filter.charAt(p1)=='\t'))) { p1++; }
    
    if(p1>=filter.length) { 
      //no phrase2 so just do phrase1
      return check_by_filter_logic(eedbObject, phrase1); 
    }
    
    phrase2 = filter.substring(p1);
    //console.log("  filter phrase2[%s]\n", phrase2);
    p2 = phrase2.indexOf("or ");
    p3 = phrase2.indexOf("and ");
    if(p2==0) {
      //console.log("  filter phase2 starts with OR\n");
      var phrase2b = phrase2.substring(3);
      if(check_by_filter_logic(eedbObject, phrase1) || check_by_filter_logic(eedbObject, phrase2b)) { return true; }
      else { return false; }
    } 
    else if(p3==0) {
      var phrase2b = phrase2.substring(4);
      //console.log("  filter phrase1[%s] AND phrase2[%s]\n", phrase1, phrase2b);
      //if(check_by_filter_logic(eedbObject, phrase1) && check_by_filter_logic(eedbObject, phrase2)) { return true; }
      var rtn1 = check_by_filter_logic(eedbObject, phrase1);
      var rtn2 = check_by_filter_logic(eedbObject, phrase2b);
      //console.log(" filter phrase1 [%s] rtn=%s\n", phrase1, rtn1);
      //console.log(" filter phrase2 [%s] rtn=%s\n", phrase2b, rtn2);
      if(rtn1 && rtn2) { return true; } else { return false; }
    } else {
      if(check_by_filter_logic(eedbObject, phrase1) && check_by_filter_logic(eedbObject, phrase2)) { return true; }
      else { return false; }
    }
  }

  //and phrases
  p1 = filter.indexOf(" and ");
  if(p1 != -1) { 
    //process "and" phrases, any false in the "and" will cause a fail
    phrase1 = filter.substring(0, p1);
    phrase2 = filter.substring(p1+5);
    if(check_by_filter_logic(eedbObject, phrase1) && check_by_filter_logic(eedbObject, phrase2)) { return true; }
    else { return false; }
  }  
  
  //or phrases
  p1 = filter.indexOf(" or ");
  if(p1 != -1) { 
    //process "or" phrases, any true makes it true
    phrase1 = filter.substring(0, p1);
    phrase2 = filter.substring(p1+4);
    if(check_by_filter_logic(eedbObject, phrase1) || check_by_filter_logic(eedbObject, phrase2)) { return true; }
    else { return false; }
  }  

  //2017-2-6 changed logic, now := and ~= requires () to isolate, but now allows spaces in key and value
  //ex: (oligo_info.target_gene_name:=negative control: scrambled antisense)
  //now everything before := ~= is key and everything after is value 
  //so only way to isolate is with ( ), not with " "

  //check for "key:=value" logic
  var key;
  p1 = filter.indexOf(":=");
  if(p1 != -1) { 
    //console.log("filter[%s] has key:= logic\n", filter);
    key = filter.substring(0, p1);
    //console.log(" filter key[%s]\n", key);
    if(p1+2 < filter.length) {
      var val1 = filter.substring(p1+2);
      filter = val1;
    } else { filter = ""; }
    //console.log(" filter key:=value logic [%s]:=[%s]\n", key, val1);
    if(find_metadata(eedbObject, key, val1)) { return true; }
    else { return false; }
  }  
  //check for "key~=value" logic
  p1 = filter.indexOf("~=");
  if(p1 != -1) { 
    key = filter.substring(0, p1);
    if(p1+2 < filter.length) {
      var val1 = filter.substring(p1+2);
      filter = val1;
    } else { filter = ""; }
    //console.log("found key~=value logic [%s] :~ [%s]\n", key, filter);
    if(has_metadata_like(eedbObject, key, filter)) { return true; }
    else { return false; }
  }  

  //phrases like A,B,C translates as implied "or"
  p1 = filter.indexOf(",");
  if(p1 != -1) { 
    //process "," phrases, any true makes it true
    phrase1 = filter.substring(0, p1);
    phrase2 = filter.substring(p1+1);
    if(check_by_filter_logic(eedbObject, phrase1) || check_by_filter_logic(eedbObject, phrase2)) { return true; }
    else { return false; }
  }  

  //multi word phrases like "brain cortex", translates as an implied "and"
  filter = trim_string(filter); //trims white space from front and rear again to be safe
  p1 = filter.indexOf(" ");
  if(p1 != -1) { 
    //process " " phrases, any false makes it false
    phrase1 = trim_string(filter.substring(0, p1));
    phrase2 = trim_string(filter.substring(p1+1));
    if(phrase1 && phrase2 && 
       check_by_filter_logic(eedbObject, phrase1) && 
       check_by_filter_logic(eedbObject, phrase2)) { return true; }
    else { return false; }
  }

  //OK this is a bare keyword now
  //check for !<key>
  var invert_keyword = false;
  if(filter.charAt(0) == '!') { 
    filter = filter.substring(1);
    invert_keyword = true;
  }
  if(!filter) { return true; }  //empty string matches everything
  var rtn = has_metadata_like(eedbObject, key, filter);
  if(invert_keyword) { rtn = !rtn; }
  //console.log("  keyword check [%s] %d\n", filter, rtn);
  return rtn;
}


function find_metadata(eedbObject, tag, value) {
  //returns first occurance matching search pattern. 
  //if value is set, this is an exact match search
  //if value is empty, this returns the first occurance with matching tag.
  if(!eedbObject) { return null; }
  if(!eedbObject.mdata) { return null; }
  if((!tag || tag=="") && (!value || value=="")) { return null; }
  if(tag) { tag = tag.toLowerCase(); }
  if(value) { value = value.toLowerCase(); }
  //console.log(" filter find_metadata tag[%s]:=value[%s]\n", tag, value);

  for(var tg1 in eedbObject.mdata) {
    var rtn = true;
    if(tag && (tg1.toLowerCase() != tag)) { rtn = false; }

    var value_array = eedbObject.mdata[tg1];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var tval = value_array[idx1];
      if(value && (tval.toLowerCase() != value)) { rtn = false; }
      if(rtn) { return tval; }
    } 
    //for(var i=0; i<eedbObject.mdata.size(); i++) {
    //  var mdata = eedbObject.mdata[i];
    //  bool rtn = true;
    //  if(!tag.empty() && (mdata->type() != tag)) { rtn = false; }
    //  if(!value.empty()) {
    //    //string tval = mdata->data().substr(0,value.size());
    //    var tval = mdata->data().toLowerCase();
    //    if(tval != value) { rtn = false; }
    //  }
    //  if(rtn) { return mdata; }
  } 
  return null;
}


function has_metadata_like(eedbObject, tag, value) {
  //tag (if specified) must match exactly (case-sensitive)
  //value (if specified) is allowed to be a case-insensitive 'prefix'
  
  if(!eedbObject) { return false; }
  if(!tag && !value) { return false; }
  if(tag) { tag = tag.toLowerCase(); }
  if(value) { value = value.toLowerCase(); }

  //could consider to expand beyond mdata to 
  // if(eedbObject.name && (eedbObject.name.toLowerCase().indexOf(value) != -1)) { return true; }
  // if(eedbObject.source) {
  //   if(eedbObject.source.category && (eedbObject.source.category.toLowerCase().indexOf(value) != -1)) { return true; }
  //   if(eedbObject.source.name && (eedbObject.source.name.toLowerCase().indexOf(value) != -1)) { return true; }
  // }
  // if(eedbObject.chromloc && (eedbObject.chromloc.toLowerCase().indexOf(value) != -1)) { return true; }
  
  for(var tg1 in eedbObject.mdata) {
    var rtn = true;
    if(tag && (tg1.toLowerCase() != tag)) { rtn = false; }

    if(value) {
      var value_array = eedbObject.mdata[tg1];
      for(var idx1=0; idx1<value_array.length; idx1++) {
        var tval = value_array[idx1];
        if(tval) { tval = tval.toLowerCase(); }
        //--anywhere search
        if(tval.indexOf(value) == -1) { rtn = false; }
      }
    }
    if(rtn) { return true; }
  }

  /*
  for(var i=0; i<_metadata.size(); i++) {
    Metadata *mdata = _metadata[i];
    bool rtn = true;
    if(!tag.empty() && (mdata->type() != tag)) { rtn = false; }
    if(!value.empty()) {
      //prior to 2.8.3 this only searched Symbols, now everything
      
      //--prefix search
      //string tval = mdata->data().substr(0,value.size());
      //boost::algorithm::to_lower(tval);
      //if(tval != value) { rtn = false; }

      //--anywhere search
      var tval = mdata->data();
      tval = tval.toLowerCase();
      if(tval.indexOf(value) == -1) { rtn = false; }
    }
    if(rtn) { return true; }
  } 
  */
  return false;
}


//-------------------------------------------------------------------


function eedbParseCollaborationData(xmlCollaboration, collaboration) {
  if(!xmlCollaboration) { return null; }
  
  if(!collaboration) { collaboration = new Object; }
  
  /*
  var uuid = xmlCollaboration.getAttribute("uuid");
  var collaboration = userview.collaborations.uuid_hash[uuid];
  if(!collaboration) {
    collaboration = new Object;
    collaboration.uuid = uuid;
    collaboration.selected = false;
    userview.collaborations.uuid_hash[uuid] = collaboration;
  }
  */
  
  collaboration.pending_requests = new Array;
  collaboration.pending_invites  = new Array;
  collaboration.shared_peers     = new Object;
  collaboration.members          = new Array;
  collaboration.member_count     = 0;
  collaboration.uuid             = xmlCollaboration.getAttribute("uuid");
  collaboration.name             = xmlCollaboration.getAttribute("name");
  collaboration.member_status    = xmlCollaboration.getAttribute("member_status");
  collaboration.public_announce  = xmlCollaboration.getAttribute("public_announce");
  collaboration.open_to_public   = xmlCollaboration.getAttribute("open_to_public");
  collaboration.description      = "";
  collaboration.owner_nickname   = "";
  collaboration.selected         = false;
  
  //owner
  var owner_root = xmlCollaboration.getElementsByTagName("owner")[0];
  if(owner_root) {
    var user = owner_root.getElementsByTagName("eedb_user");
    if(user && user.length >0) {
      collaboration.owner_nickname = user[0].getAttribute("nickname");
      if(user[0].getAttribute("valid_email")) {
        collaboration.owner_identity = user[0].getAttribute("valid_email");
      } else {
        collaboration.owner_identity = user[0].getAttribute("openID");
      }
    }
  }
  if(collaboration.uuid == "public"  && !collaboration.owner_identity) { collaboration.owner_identity = "public"; }
  if(collaboration.uuid == "curated" && !collaboration.owner_identity) { collaboration.owner_identity = "curators"; }

  var syms = xmlCollaboration.getElementsByTagName("symbol");
  var mdata = xmlCollaboration.getElementsByTagName("mdata");
  for(var j=0; j<syms.length; ++j) {
    var tag   = syms[j].getAttribute("type");
    var value = syms[j].getAttribute("value");
    if(!value) { continue; }
    if(tag == "eedb:display_name") { collaboration.name = value; }
  }
  for(var j=0; j<mdata.length; ++j) {
    if(mdata[j].getAttribute("type")=="description") { collaboration.description += mdata[j].firstChild.nodeValue+". "; }
    if((mdata[j].getAttribute("type")=="comments") && !collaboration.description) { collaboration.description = mdata[j].firstChild.nodeValue; }
  }
  if(!collaboration.name) { collaboration.name = collaboration.uuid; }
  collaboration.description += "";
  
  collaboration.shared_peers.total_count = 0;
  var shared_data = xmlCollaboration.getElementsByTagName("shared_data_peers")[0];
  if(shared_data) {
    var peers = shared_data.getElementsByTagName("peer");
    for(var j=0; j<peers.length; j++) {
      var peer = eedbParsePeerData(peers[j]);
      if(!collaboration.shared_peers[peer.uuid]) {
        collaboration.shared_peers[peer.uuid] = peer;
        collaboration.shared_peers.total_count++;
      }
    }
  }
  
  var request_root = xmlCollaboration.getElementsByTagName("user_requests")[0];
  if(request_root) {
    var users = request_root.getElementsByTagName("eedb_user");
    for(var j=0; j<users.length; j++) {
      var user = eedbParseUserXML(users[j]);
      collaboration.pending_requests.push(user);
    }
  }
  
  var invite_root = xmlCollaboration.getElementsByTagName("user_invitations")[0];
  if(invite_root) {
    var users = invite_root.getElementsByTagName("eedb_user");
    for(var j=0; j<users.length; j++) {
      var user = eedbParseUserXML(users[j]);
      collaboration.pending_invites.push(user);
    }
  }
  
  var members_root = xmlCollaboration.getElementsByTagName("member_users")[0];
  if(members_root) {
    var users = members_root.getElementsByTagName("eedb_user");
    for(var j=0; j<users.length; j++) {
      var user = eedbParseUserXML(users[j]);
      //if(user.email == "") { continue; }
      if(user.email == collaboration.owner_identity) { user.member_status = "OWNER"; }
      //else { user.member_status = "member"; } 
      collaboration.members.push(user);
    }
    collaboration.member_count = collaboration.members.length;
  }
  //collaboration.members.sort(eedb_collab_members_sort_func);
  
  return collaboration;
}


function eedbParseConfigurationData(xmlConfig, config) {
  if(!xmlConfig) { return null; }
  if(!config) { config = new Object; }
  
  config.classname    = "Configuration";
  config.uuid         = xmlConfig.getAttribute("uuid");
  config.fixed_id     = "";
  config.id           = config.uuid;
  config.access_count = Math.floor(xmlConfig.getAttribute("access_count"));
  config.type         = "";
  config.name         = "";
  config.assembly     = "";
  config.description  = "";
  config.title        = "";
  config.create_date  = "";
  config.owner_identity = "";
  config.author       = "";
  config.configDOM    = null;
  config.img_url      = "";

  if(xmlConfig.getAttribute("type")) { config.type = xmlConfig.getAttribute("type"); }
  if(xmlConfig.getAttribute("create_date")) { config.create_date = xmlConfig.getAttribute("create_date"); }
  if(xmlConfig.getAttribute("fixed_id")) { config.fixed_id = xmlConfig.getAttribute("fixed_id"); }

  eedbParseMetadata(xmlConfig, config);

  var mdata = xmlConfig.getElementsByTagName("mdata");
  for(j=0; j<mdata.length; ++j) {
    if(!(mdata[j].firstChild)) { continue; }

    if(mdata[j].getAttribute("type")=="configXML") { 
      config.configDOM = mdata[j].firstChild; 
    }

    if(!(mdata[j].firstChild.nodeValue)) { continue; }
    if(!config.create_date) {
      if(mdata[j].getAttribute("type")=="date")        { config.create_date = mdata[j].firstChild.nodeValue; }
      if(mdata[j].getAttribute("type")=="create_date") { config.create_date = mdata[j].firstChild.nodeValue; }
    }
    if(mdata[j].getAttribute("type")=="title")       { config.title = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="script_name") { config.name = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="configname")  { config.name = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="description") { config.description = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="thumbnail_url")   { config.img_url = mdata[j].firstChild.nodeValue; }
    if(mdata[j].getAttribute("type")=="REMOTE_ADDR") { config.remote_addr = mdata[j].firstChild.nodeValue; }
  }
  
  var user = xmlConfig.getElementsByTagName("eedb_user");
  if(user && user.length >0) {
    config.author = user[0].getAttribute("nickname");
    config.owner_identity = user[0].getAttribute("valid_email");
  }
  
  config.collaboration = undefined;
  var collaboration = xmlConfig.getElementsByTagName("collaboration");
  if(collaboration && collaboration.length >0) {
    config.collaboration = eedbParseCollaborationData(collaboration[0]);
  }
  
  return config;
}


function eedbParseAssemblyData(xmlAssembly, assembly) {
  if(!xmlAssembly) { return null; }
  
  if(!assembly) { assembly = new Object; }
  
  assembly.classname     = "Assembly";
  assembly.id            = xmlAssembly.getAttribute("id");
  assembly.taxon_id      = xmlAssembly.getAttribute("taxon_id");
  assembly.ncbi_name     = xmlAssembly.getAttribute("ncbi");
  assembly.ucsc_name     = xmlAssembly.getAttribute("ucsc");
  assembly.assembly_name  = xmlAssembly.getAttribute("asm");
  if(!assembly.assembly_name && assembly.ucsc_name) { assembly.assembly_name = assembly.ucsc_name; }
  if(!assembly.assembly_name && assembly.ncbi_name) { assembly.assembly_name = assembly.ncbi_name; }

  assembly.genus         = xmlAssembly.getAttribute("genus");
  assembly.species       = xmlAssembly.getAttribute("species");
  assembly.release_date  = xmlAssembly.getAttribute("release_date");
  assembly.ncbi_acc        = xmlAssembly.getAttribute("ncbi_acc");
  assembly.classification  = xmlAssembly.getAttribute("classification");

  assembly.has_sequence = false;
  if(xmlAssembly.getAttribute('seq') =="y") { assembly.has_sequence = true; }
      
  if(xmlAssembly.getAttribute("import_date")) {
    assembly.import_date  = xmlAssembly.getAttribute("import_date");
  }
  if(xmlAssembly.getAttribute("create_date")) {
    assembly.import_date  = xmlAssembly.getAttribute("create_date");
  }
  if(xmlAssembly.getAttribute("create_timestamp")) {
    assembly.import_timestamp  = xmlAssembly.getAttribute("create_timestamp");
  }
  if(xmlAssembly.getAttribute("owner_identity")) {
    assembly.owner_identity  = xmlAssembly.getAttribute("owner_identity");
  }

  assembly.common_name = "";
  if(xmlAssembly.getAttribute("common_name")) { assembly.common_name = xmlAssembly.getAttribute("common_name"); }

  if(assembly.id) {
    var zobj = unparse_dbid(assembly.id);
    if(zobj.uuid) {
      assembly.uuid  = zobj.uuid;
      assembly.objID = zobj.objID;
    }
  }

  eedbParseMetadata(xmlAssembly, assembly);
  if(!assembly.release_date) {
    if(assembly.mdata["release_date"]) { assembly.release_date = assembly.mdata["release_date"][0]; }
  }
  
  assembly.chroms_array     = new Array;

  //convert some attributes so this behaves like a DataSource
  assembly.assembly = assembly.assembly_name;
  assembly.name = "Genome : " + assembly.assembly_name;
  assembly.description = "genome assembly "+assembly.common_name +" ("+ assembly.genus +" "+ assembly.species+ " "+ assembly.taxon_id+") ";
  if(assembly.release_date) { 
    assembly.description += assembly.release_date +" ";
  }
  if(assembly.ucsc_name) { assembly.description += assembly.ucsc_name + " "; }
  if(assembly.ncbi_name) { assembly.description += assembly.ncbi_name + " "; }
  if(assembly.ncbi_acc) { assembly.description += assembly.ncbi_acc + " "; }
  
  return assembly;
}


function eedbFetchChrom(asm, chrom_name) {
  if(!asm || !chrom_name) { return null; }

  var url = eedbSearchCGI + "?mode=chrom&asm="+asm+";chrom="+chrom_name;
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

  var genomeHash = new Object;
  var xmlAssemblies = xmlDoc.getElementsByTagName("assembly");
  for(i=0; i<xmlAssemblies.length; i++) {
    var assembly = eedbParseAssemblyData(xmlAssemblies[i]);
    genomeHash[assembly.assembly_name] = assembly;
  }

  var xmlChroms = xmlDoc.getElementsByTagName("chrom");
  for(i=0; i<xmlChroms.length; i++) {
    var chrom = eedbParseChromData(xmlChroms[i]);
    //if((chromXML.getAttribute('asm') != asm)  && (chromXML.getAttribute('ucsc_asm') != asm) && (chromXML.getAttribute('ncbi_asm') != asm)) { continue; }
    if(chrom) { 
      if(genomeHash[chrom.assembly_name]) {
        chrom.assembly = genomeHash[chrom.assembly_name];
      }
      return chrom; 
    }
  }
}


function eedbParseChromData(chromXML, chrom) {
  if(!chromXML) { return null; }

  if(!chrom) { chrom = new Object; }

  chrom.classname     = "Chrom";

  //<chrom chr="chr1" ncbi_chrom_acc="NC_000001.11" asm="hg38" ucsc_asm="hg38" ncbi_asm="GRCh38" taxon_id="9606" length="248956422" id="7AA26B8D-8634-45A4-8F74-DF3E04B3456A::1:::Chrom" description="chr1"/>
  chrom.chrom_name = chromXML.getAttribute('chr');
  chrom.assembly_name = chromXML.getAttribute('asm');
  chrom.chrom_length = Math.floor(chromXML.getAttribute('length'));
  chrom.chrom_id = chromXML.getAttribute('id');

  chrom.ncbi_chrom_acc = chromXML.getAttribute('ncbi_chrom_acc');
  chrom.ucsc_name = chromXML.getAttribute('ucsc_asm');
  chrom.ncbi_name = chromXML.getAttribute('ncbi_asm');
  chrom.taxon_id = chromXML.getAttribute('taxon_id');
  chrom.description = chromXML.getAttribute('description');

  chrom.description = "Chrom "+chrom.assembly_name +"::"+ chrom.chrom_name +" ("+ chrom.chrom_length+"bp)";
  if(chrom.taxon_id) { chrom.description += " taxID:"+ chrom.taxon_id; }
  if(chrom.ucsc_name) { chrom.description += " "+chrom.ucsc_name; }
  if(chrom.ncbi_name) { chrom.description += " "+chrom.ncbi_name; }
  if(chrom.ncbi_chrom_acc) { chrom.description += " "+chrom.ncbi_chrom_acc; }

  return chrom;
}


//-------------------------------------------------------------------
//
// object info display and metadata edit
//
//-------------------------------------------------------------------

function eedbFetchAndDisplaySourceInfo(sourceID) {
  var source = eedbGetObject(sourceID); //uses jscript cache to hold recent objects
  //var source = eedbFetchObject(sourceID); //always fetches from webservice to get updates
  if(source) {
    eedbDisplaySourceInfo(source);
  }
}


function eedbDisplaySourceInfo(source, user_match) {
  var info_div = document.getElementById("source_info");
  if(!info_div) { return; }
  if(!source && !current_source) { return; }

  var info_options = document.getElementById("source_info_panel_options");
  if(!info_options) {
    info_options = document.createElement('div');
    info_options.id = "source_info_panel_options";
  }

  var xpos, ypos;
  if(source) {
    current_source = source;
    var e = window.event
    toolTipWidth=450;
    moveToMouseLoc(e);
    xpos = toolTipSTYLE.adjusted_xpos;
    ypos = toolTipSTYLE.ypos;

    info_div.setAttribute('xpos', xpos);
    info_div.setAttribute('ypos', ypos);

  } else {
    source = current_source;
    xpos = info_div.getAttribute('xpos');
    ypos = info_div.getAttribute('ypos');
  }

  if(source.metadata_changed) { 
    var adds=0; var dels=0; var changes=0;
    for(var idx=0; idx<source.mdata_edits.length; idx++) {
      var editObj = source.mdata_edits[idx];
      if(editObj.mode == "add") { adds++; }
      if(editObj.mode == "delete") { dels++; }
      if(editObj.mode == "change") { changes++; }
    }
    //document.getElementById("message").innerHTML= "edit["+changes+"] del["+dels+"] add["+adds+"]";
  }

  if(!user_match) {
    user_match=false;
    var user = eedbGetCurrentUser();
    if(user && (user.email == source.owner_identity)) { user_match=true; }
  }
  if(!user_match) { source.edit_mode = false; }
  //else { source.edit_mode = true; }

  info_div.innerHTML = "";
  var tdiv, tspan, tinput, ta;
  //var main_div = info_div.appendChild(document.createElement('div'));
  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  //rgb(220,255,255) old color
  
  var main_div = info_div;
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "width:450px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "background-color:rgb(230,230,240); "+
                                 "box-sizing: border-box; border: 2px solid #808080; border-radius: 4px; "+
                                 "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  main_div.style.display = "block";

  //titlebar area to capture move events
  var titlebar_div = main_div.appendChild(document.createElement('div'));
  titlebar_div.setAttribute("onmousedown", "eedbSourceInfoToggleDrag('start');");
  titlebar_div.setAttribute("onmouseup", "eedbSourceInfoToggleDrag('stop');");
 
  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "eedbSourceInfoEvent('close');return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = encodehtml(source.name);
  if(source.edit_mode) {
    tspan.setAttribute('style', "font-size:12px; font-weight: bold; color: rgb(105,105,155);");
    tspan.setAttribute("onclick", "eedbSourceInfoEvent('edit-metadata-panel','eedb:display_name','0');return false");
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  if(source.platform) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 0px 0px 3px;");
    tspan.innerHTML = source.platform;
  }
  if(source.source_name) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 0px 0px 3px;");
    tspan.innerHTML = source.source_name;
  }
  if(source.category) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 0px 0px 3px;");
    tspan.innerHTML = source.category;
    if(source.edit_mode) {
      tspan.setAttribute('style', "font-size:9px; padding: 0px 0px 0px 3px; color: rgb(105,105,155);");
      tspan.setAttribute("onclick", "eedbSourceInfoEvent('edit-metadata-panel','eedb:category','0');return false");
    }
  }

  if(source.owner_identity) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; ");
    tspan.innerHTML = "created by: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = source.owner_identity;
  }

  //sourceID
  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight: bold; ");
  tspan.innerHTML = "sourceID: ";
  tspan2 = tdiv.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "color:darkgray;");
  tspan2.innerHTML = source.id;
  if(source.classname== "Configuration") {
    tspan.innerHTML = source.type + " config: ";
    tspan2.innerHTML = source.uuid;
  }
  if(source.fixed_id) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; ");
    tspan.innerHTML = "fixedID: ";
    tspan2 = tdiv.appendChild(document.createElement('span'));
    tspan2.innerHTML = source.fixed_id;
  }

  if(source.subsource_count) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; ");
    tspan.innerHTML = "subsources: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = source.subsource_count;
  }

  //description
  main_div.appendChild(document.createElement('hr'));
  tdiv = main_div.appendChild(document.createElement('div'));
  if(source.description && source.description.length>0) { tdiv.innerHTML = source.description; }
  else { tdiv.innerHTML = "no description"; }
  if(source.edit_mode) {
    tdiv.setAttribute('style', "color: rgb(105,105,155);");
    tdiv.setAttribute("onclick", "eedbSourceInfoEvent('edit-metadata-panel','description','0');return false");
  }

  main_div.appendChild(document.createElement('hr'));

  if(source.request_full_load) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; color:blue; ");
    tspan.innerHTML = "loading full metadata.....";
    eedbFullLoadCurrentSource(); //async process
  }

  //if there is a full_load_error
  if(source.full_load_error) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; color:red; ");
    tspan.innerHTML = "error: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:darkgray;");
    tspan.innerHTML = "unable to load full metadata, probably deleted but phantom object in cache. don't use.";
  }

  if(source.demux_key) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "max-width:450px");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "demux_key: " + source.demux_key;
  }

  if(source.exptype && source.value) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "signal : " + source.value + " " + source.exptype;
  }
  if(source.exptype && source.sense_value && source.antisense_value) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "sense signal : " + source.sense_value + " " + source.exptype;
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "anti-sense signal : " + source.antisense_value + " " + source.exptype;
  }

  //for(var tag in source.mdata) { //new common mdata[].array system
  var all_tags = [];
  if(source && source.mdata) { all_tags = Object.keys(source.mdata); }
  all_tags.sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  for(var j=0; j<all_tags.length; j++) {
    var tag = all_tags[j];
    if(tag=="description") { continue; }
    if(tag=="eedb:description") { continue; }
    if(tag=="eedb:category") { continue; }
    if(tag=="display_name") { continue; }
    if(tag=="eedb:display_name") { continue; }
    if(tag=="eedb:owner_nickname") { continue; }
    if(tag=="eedb:owner_email") { continue; }
    if(tag=="eedb:owner_OpenID") { continue; }
    if(tag=="keyword") { continue; }

    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold;");
    tspan.innerHTML = tag + ": ";
    if(source.edit_mode && eedbMetadataTagEditable(tag)) {
      tspan.setAttribute('style', "font-weight: bold; font-style:italic;");
      tspan.setAttribute("onclick", "eedbSourceInfoEvent('add-metadata-panel', '"+tag+"');return false"); 
    } 
    var value_array = source.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      if(idx1!=0) { 
        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.innerHTML = ", " 
      }

      tspan = tdiv.appendChild(document.createElement('span'));
      if(source.edit_mode && (tag!="keyword") && eedbMetadataTagEditable(tag)) {
        tspan.setAttribute('style', "color: rgb(105,105,155);");
        tspan.setAttribute("onclick", "eedbSourceInfoEvent('edit-metadata-panel','"+tag+"','"+idx1+"');return false");
      } else {
        tspan.setAttribute('style', "color: rgb(105,105,105);");
      }
      tspan.innerHTML = value;

      if(source.edit_mode && eedbMetadataTagEditable(tag)) {
        a1 = tdiv.appendChild(document.createElement('a'));
        a1.setAttribute("target", "top");
        a1.setAttribute("href", "./");
        a1.setAttribute("onclick", "eedbSourceInfoEvent('delete-metadata','"+tag+"','"+idx1+"');return false");
        var tspan2 = a1.appendChild(document.createElement('span'));
        tspan2.setAttribute('style', "color: rgb(255,50,50); font-weight:bold; ");
        tspan2.innerHTML ="x";
      }
    }
  }

  if(user_match && source.full_load) { 
    var tdiv2 = main_div.appendChild(document.createElement('div'));
    if(source.edit_mode) {
      tdiv = tdiv2.appendChild(document.createElement('div'));
      tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
      var button = tdiv.appendChild(document.createElement('input'));
      button.type = "button";
      button.className = "medbutton";
      button.setAttribute("onclick", "eedbSourceInfoEvent('save-metadata');return false");
      button.value = "save metadata changes";
      if(!source.metadata_changed) { button.setAttribute("disabled", "disabled"); }

      tdiv = tdiv2.appendChild(document.createElement('div'));
      tdiv.setAttribute('style', "margin: 4px 4px 4px 4px;");
      var button = tdiv.appendChild(document.createElement('input'));
      button.type = "button";
      button.className = "medbutton";
      button.setAttribute("onclick", "eedbSourceInfoEvent('add-metadata-panel');return false");
      button.value = "add new metadata";
    } else {
      tdiv = tdiv2.appendChild(document.createElement('div'));
      tdiv.setAttribute('style', "margin: 4px 4px 4px 4px;");
      var button = tdiv.appendChild(document.createElement('input'));
      button.type = "button";
      button.className = "medbutton";
      button.value = "edit metadata";
      button.setAttribute("onclick", "eedbSourceInfoEvent('edit-mode');return false");
    }

    main_div.appendChild(document.createElement('hr')); 
    main_div.appendChild(info_options);
  }

  if(source.classname== "FeatureSource") {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; ");
    tspan.innerHTML = "feature count: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:darkgray;");
    tspan.innerHTML = source.feature_count;
  }
  if(source.classname== "EdgeSource") {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; ");
    tspan.innerHTML = "edge count: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:darkgray;");
    tspan.innerHTML = source.edge_count;
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  if(source.classname== "Configuration") {
    tdiv.innerHTML = "<a target=\"_eedb_xml\" href=\""+eedbConfigCGI+"?format=fullxml;uuid="+source.uuid+"\">xml</a>";
  } else {
    tdiv.innerHTML = "<a target=\"_eedb_xml\" href=\""+eedbSearchCGI+"?format=fullxml;id="+source.id+"\">xml</a>";
  }

  main_div.appendChild(document.createElement('p'));
}


function eedbSourceInfoEvent(param, tag, value_idx) {
  var info_div = document.getElementById("source_info");
  if(!info_div) { return; }
  if(!current_source) { return; }

  if(param == "edit-mode") {
    current_source.edit_mode = true;
    eedbDisplaySourceInfo(null,true); //redraw
  }

  if(!current_source.mdata_edits) { current_source.mdata_edits = new Array; }

  var current_value = "";
  if(tag) {
    if(!current_source.mdata[tag]) { current_source.mdata[tag] = new Array; }
    if(current_source.mdata[tag][value_idx]) {
      current_value = current_source.mdata[tag][value_idx];
    }
    if(tag == "description") { current_value = current_source.description; }
    if(tag == "eedb:display_name") { current_value = current_source.name; }
    if(tag == "eedb:category") { current_value = current_source.category; }
  }

  if(param == "refresh") {  
    eedbDisplaySourceInfo(null,true); //redraw
  }
  if(param == "close") {  
    info_div.innerHTML = "";
    info_div.style.display = "none";
    if(current_source.metadata_changed) { eedbReloadObject(current_source.id); }
    current_source.edit_mode = false;
    current_source = undefined;
  }
  if(param == "save-metadata") {  
    current_source.edit_mode = false;
    if(current_source.metadata_changed) { 
      //send edits to server
      eedbSendMetadataEdits();

      //then reload from server and close panel
      info_div.innerHTML = "";
      if(current_source.finishFunction) { current_source.finishFunction(current_source); }
      //current_source = eedbReloadObject(current_source.id);
      //eedbDisplaySourceInfo(null,true); //redraw
      current_source.full_load = false;
      current_source = undefined;
    }
  }
  if(param=="delete-metadata") {
    var md1 = new Object;
    md1.mode = "delete";
    md1.tag = tag;
    md1.value = current_source.mdata[tag][value_idx];
    current_source.mdata_edits.push(md1);
    current_source.metadata_changed = true;

    current_source.mdata[tag].splice(value_idx, 1);
    if(current_source.mdata[tag].length == 0) { delete current_source.mdata[tag]; }

    eedbDisplaySourceInfo(null,true); //redraw
  }
  if(param=="edit-metadata-panel") {
    var e = window.event
    moveToMouseLoc(e);
    var xpos = toolTipSTYLE.xpos;
    var ypos = toolTipSTYLE.ypos;

    var tdiv = info_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "width:380px; z-index:60; padding: 3px 3px 3px 3px; "+
                               "background-color:rgb(255,255,200); border:inset; border-width:2px; "+
                               "position:absolute; left:"+(xpos)+"px; top:"+(ypos-30)+"px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; ");
    tspan.innerHTML = "edit metadata tag: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = tag;

    var tdiv2 = tdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "margin: 3px 3px 3px 3px; ");
    var input1 = tdiv2.appendChild(document.createElement('textarea'));
    input1.id = "eedb_metadataedit_editvalue_textarea";
    input1.setAttribute('style', "font-size:12px; width:100%; ");
    input1.setAttribute("rows", "5");
    input1.innerHTML = current_value;
    input1.focus();

    var button = tdiv.appendChild(document.createElement('input'));
    button.type = "button";
    button.className = "medbutton";
    button.setAttribute('style', "float:right; padding: 3px 3px 3px 3px; ");
    button.setAttribute("onclick", "eedbSourceInfoEvent('accept-edit', '"+tag+"','"+value_idx+"');return false");
    button.value = "accept";
    var button = tdiv.appendChild(document.createElement('input'));
    button.type = "button";
    button.className = "medbutton";
    button.setAttribute('style', "float:right; padding: 3px 3px 3px 3px; ");
    button.setAttribute("onclick", "eedbSourceInfoEvent('refresh');return false");
    button.value = "cancel";
  }
  if(param=="accept-edit") {
    var input = document.getElementById("eedb_metadataedit_editvalue_textarea");
    if(input) {
      var oldval = current_value;
      var newval = input.value;
      //document.getElementById("message").innerHTML= "edit ["+value+"] old["+oldval+"] new[" +newval+"]";
      var md1 = new Object;
      md1.mode     = "change";
      md1.tag      = tag;
      md1.oldvalue = oldval;
      md1.newvalue = newval;
      current_source.mdata_edits.push(md1);
      current_source.metadata_changed = true;
      if(tag == "description") { current_source.description = newval; md1.oldvalue=""; }
      if(tag == "eedb:display_name") { current_source.name = newval; md1.oldvalue=""; }
      if(tag == "display_name") { current_source.name = newval; md1.oldvalue=""; }
      if(tag == "eedb:category") { current_source.category = newval; md1.oldvalue=""; }
      current_source.mdata[tag][value_idx] = newval;
    }
    eedbDisplaySourceInfo(null,true); //redraw
  }
  if(param=="add-metadata-panel") {
    var e = window.event
    moveToMouseLoc(e);
    var xpos = toolTipSTYLE.xpos;
    var ypos = toolTipSTYLE.ypos;

    var tdiv = info_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "width:380px; z-index:60; padding: 3px 3px 3px 3px; "+
                               "background-color:rgb(255,255,200); border:inset; border-width:2px; "+
                               "position:absolute; left:"+(xpos)+"px; top:"+(ypos-200)+"px;");
    var tdiv2 = tdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "font-weight: bold; ");
    tdiv2.innerHTML = "add metadata: ";

    var tdiv2 = tdiv.appendChild(document.createElement('div'));
    var tspan = tdiv2.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = "Tag:";
    var input1 = tdiv2.appendChild(document.createElement('input'));
    input1.id = "eedb_metadataedit_addtag_input";
    input1.setAttribute('type', "text");
    input1.setAttribute('style', "font-size:12px; margin-left:5px; width:330px; ");
    if(tag) { input1.setAttribute('value', tag); }
    input1.focus();

    var tdiv2 = tdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "margin: 3px 3px 3px 3px; ");
    var tspan = tdiv2.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green; vertical-align:top; ");
    tspan.innerHTML = "Value:";

    var input1 = tdiv2.appendChild(document.createElement('textarea'));
    input1.id = "eedb_metadataedit_addvalue_input";
    input1.setAttribute('style', "font-size:12px; width:330px; margin-left:5px; ");
    input1.setAttribute("rows", "5");

    var button = tdiv.appendChild(document.createElement('input'));
    button.type = "button";
    button.className = "medbutton";
    button.setAttribute('style', "float:right; padding: 3px 3px 3px 3px; ");
    button.setAttribute("onclick", "eedbSourceInfoEvent('accept-add');return false");
    button.value = "add";
    var button = tdiv.appendChild(document.createElement('input'));
    button.type = "button";
    button.className = "medbutton";
    button.setAttribute('style', "float:right; padding: 3px 3px 3px 3px; ");
    button.setAttribute("onclick", "eedbSourceInfoEvent('refresh');return false");
    button.value = "cancel";
  }
  if(param=="accept-add") {
    var input_tag   = document.getElementById("eedb_metadataedit_addtag_input");
    var input_value = document.getElementById("eedb_metadataedit_addvalue_input");
    var newtag = "";
    if(input_tag) { newtag = input_tag.value; }
    //remove unallowed add tags, some can be edited though
    if(newtag=="eedb:name") { newtag = ""; }
    if(newtag=="eedb:owner_nickname") { newtag = ""; }
    if(newtag=="eedb:owner_OpenID") { newtag = ""; }
    if(newtag=="eedb:category") { newtag = ""; }
    if(newtag=="eedb:display_name") { newtag = ""; }
    if(newtag=="display_name") { newtag = ""; }

    var newval = "";
    if(input_value) {
      newval = input_value.value;
      //document.getElementById("message").innerHTML= "edit ["+value+"] old["+oldval+"] new[" +newval+"]";
    }
    if(newtag && newval) {
      var md1   = new Object;
      md1.mode  = "add";
      md1.tag   = newtag;
      md1.value = newval;
      current_source.mdata_edits.push(md1);

      var value_array = current_source.mdata[newtag];
      if(!value_array) {
        value_array = new Array;
        current_source.mdata[newtag] = value_array;
      }
      value_array.push(newval);
      current_source.metadata_changed = true;
    }
    eedbDisplaySourceInfo(null,true); //redraw
  }
}


function eedbSourceInfoToggleDrag(mode, e) {
  //console.log("eedbSourceInfoToggleDrag "+mode);
  if (!e) var e = window.event
  var info_div = document.getElementById("source_info");
  if(!info_div) { return; }
  if(!info_div) {
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    document.onmouseup   = null;
    return;
  }

  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  if(mode =='start') {
    info_div.setAttribute("is_moving", 1);
    document.onmousemove = eedbSourceInfoMoveEvent;

    //set the relative starting x/y position within the panel
    var offX = xpos - Math.floor(info_div.getAttribute("xpos"));
    var offY = ypos - Math.floor(info_div.getAttribute("ypos"));
    info_div.setAttribute("move_offsetX", offX);
    info_div.setAttribute("move_offsetY", offY);
    eedbSourceInfoMoveEvent(e);
  } else {
    if(info_div.getAttribute("is_moving")) { //stop moving 
      //reset the global events back
      document.onmousemove = moveToMouseLoc;
      document.onmouseup = null;
      info_div.removeAttribute("is_moving");
    }
  }
}


function eedbSourceInfoMoveEvent(e) {
  var info_div = document.getElementById("source_info");
  if(!info_div) { return; }

  if(!info_div.getAttribute("is_moving")) { return; }
  //console.log("eedbSourceInfoMoveEvent moving");
  
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

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


function eedbMetadataTagEditable(tag) {
  if(tag == "uuid") { return false; }
  if(tag == "eedb:owner_nickname") { return false; }
  if(tag == "eedb:owner_OpenID") { return false; }
  if(tag == "assembly_name") { return false; }
  if(tag == "genome_assembly") { return false; }
  if(tag == "eedb:assembly_name") { return false; }
  if(tag == "eedb:owner_email") { return false; }
  if(tag == "eedb:owner_nickname") { return false; }
  if(tag == "eedb:name") { return false; }
  if(tag == "configXML") { return false; }
  if(tag == "date") { return false; }
  if(tag == "REMOTE_ADDR") { return false; }
  if(tag == "upload_unique_name") { return false; }
  if(/_total$/.exec(tag)) { return false; }
  return true;
}


function eedbSendMetadataEdits() {
  if(!current_source) { return; }
  if(!current_source.metadata_changed) { return; }

  var user = eedbShowLogin();
  if(!user) { return; }
  if(user.email != current_source.owner_identity) { return; }

  // new XML POST query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>edit_metadata</mode>\n";
  paramXML += "<ids>"+current_source.id+"</ids>\n";

  paramXML += "<mdata_edit_commands>\n";
  for(var idx=0; idx<current_source.mdata_edits.length; idx++) {
    var editObj = current_source.mdata_edits[idx];
    if(editObj.mode == "add") { 
      paramXML += "<edit mode='add' id='"+current_source.id+"' tag='"+ editObj.tag+"'>" +editObj.value +"</edit>";
    }
    if(editObj.mode == "delete") {
      paramXML += "<edit mode='delete' id='"+current_source.id+"' tag='"+ editObj.tag+"'>" +editObj.value +"</edit>";
    }
    if(editObj.mode == "change") {
      paramXML += "<edit mode='change' id='"+current_source.id+"' tag='"+ editObj.tag+"'><old>"+editObj.oldvalue+"</old><new>"+editObj.newvalue+"</new></edit>";
    }
  }
  paramXML += "</mdata_edit_commands>\n";
  paramXML += "</zenbu_query>\n";


  var xhr = GetXmlHttpObject();
  if(xhr==null) { alert ("Your browser does not support AJAX!"); return; }

  xhr.open("POST", eedbUserCGI, false); //not async
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);
}


//---------------------------------------------------------------------------------
//
// collaboration select inferface
//
//---------------------------------------------------------------------------------

var eedbCollaborationPulldown_hash = new Object();  //global hash of all uniq collaboration pulldowns

function eedbCollaborationPulldown(submode, uniqID) {
  //eedbShowLogin();
  if(!uniqID) { uniqID = "zenbuCollabPulldown_"+ createUUID(); }
  var collabWidget = eedbCollaborationPulldown_hash[uniqID];

  if(!collabWidget) {    
    console.log("eedbCollaborationPulldown ["+uniqID+"] create new widget");
    collabWidget = document.createElement('span');
    collabWidget.setAttribute("style", "position:relative;");
    collabWidget.id = uniqID;
    collabWidget.collaboration_uuid = current_collaboration.uuid;
    collabWidget.collaboration_name = current_collaboration.name;
    console.log("init with current_collaboration.uuid = "+ current_collaboration.uuid);
    eedbCollaborationPulldown_hash[uniqID] = collabWidget;
  }
  
  collabWidget.innerHTML = ""; //to clear old content

  if(submode) { collabWidget.submode = submode; } 
  else { submode = collabWidget.submode; }

  if((submode != "config_search") && (submode != "filter_search") && (collabWidget.collaboration_uuid == "all")) {
    //for saving into collaboration
    collabWidget.collaboration_uuid = "private";
    collabWidget.collaboration_name = "private";
  }
  var title = collabWidget.collaboration_name;
  if(collabWidget.collaboration_uuid == "private") {
    if(submode == "filter_search") { title = "my uploads"; }
    else { title = "private"; }
  }
    
  var span1 = collabWidget.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 0px;");
  span1.innerHTML = "collaboration: ";
  if(submode=="filter_search") { span1.innerHTML = "collaboration filter: "; }

  var collab_array = new Array;

  var select = collabWidget.appendChild(document.createElement('select'));
  select.setAttribute("onchange", "eedbCollaborationPulldownChanged(\""+ uniqID +"\", this.value);");
  select.className = "dropdown";
  select.style.margin = "0px";
  select.style.fontSize = "10px";
  
  if((submode == "filter_search") || (submode == "config_search")) {
    var c1 = { uuid: "all", name:"all"};
    collab_array.push(c1);
  }
  if(current_user) {
    var c1 = { uuid: "private", name:"private"};
    if(submode == "filter_search") { c1.name = "my uploads"; }
    collab_array.push(c1);
  }
  
  // make cgi query
  var collabXMLHttp = GetXmlHttpObject()  
  if(collabXMLHttp == null) { return; }
  
  var url = eedbUserCGI+"?mode=collaborations;format=minxml";
  if((submode == "filter_search") || (submode == "config_search")) { url += ";submode=searchable"; }
  else { url += ";submode=member"; }
  collabXMLHttp.open("GET", url, false);  //not async
  collabXMLHttp.send(null);
  if(collabXMLHttp.responseXML == null) { return; }
  if(collabXMLHttp.readyState!=4) { return; }
  if(collabXMLHttp.status!=200) { return; }
  
  var xmlDoc=collabXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  
  var xmlCollabs = xmlDoc.getElementsByTagName("collaboration");
  for(i=0; i<xmlCollabs.length; i++) {
    var collaboration = eedbParseCollaborationData(xmlCollabs[i]);
    collab_array.push(collaboration);
  }
  collab_array.sort(eedb_collab_sort_func);

  for(i=0; i<collab_array.length; i++) {
    var collaboration = collab_array[i];    
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", collaboration.uuid);
    if(collabWidget.collaboration_uuid == collaboration.uuid) { option.setAttribute("selected", "selected"); }
    option.innerHTML = collaboration.name;
  }
  collabWidget.collab_array = collab_array;
  
  return collabWidget;
}

function eedbCollaborationPulldownChanged(uniqID, collab_uuid) {
  var collabWidget = eedbCollaborationPulldown_hash[uniqID];
  if(!collabWidget) { return; }
  if(!collabWidget.collab_array) { return; }

  //console.log("eedbCollaborationPulldownChanged "+uniqID+ " : " +collab_uuid);

  for(i=0; i<collabWidget.collab_array.length; i++) {
    var collaboration = collabWidget.collab_array[i];
    if(!collaboration) { continue; }
    if(collaboration.uuid == collab_uuid) {
      collabWidget.collaboration_uuid = collaboration.uuid;
      collabWidget.collaboration_name = collaboration.name;
    }
  }
  //console.log("eedbCollaborationPulldownChanged "+uniqID+ " : selection [" +collabWidget.collaboration_uuid +
  //            "] : "+ collabWidget.collaboration_name);

  if(collabWidget.callOutFunction) { collabWidget.callOutFunction(uniqID, collab_uuid); }
}

//--------------------

function eedbCollaborationSelectWidget(submode) {
  var collabWidget = document.getElementById("_collaborationSelectWidget");
  if(!collabWidget) {    
    collabWidget = document.createElement('span');
    collabWidget.id = "_collaborationSelectWidget";
    collabWidget.setAttribute("style", "position:relative; margin:3px 3px 3px 0px;");
  }
  collabWidget.innerHTML = ""; //to clear old content

  if(submode) { collabWidget.setAttribute("submode", submode); } 
  else { submode = collabWidget.getAttribute("submode"); }

  if((submode != "config_search") && (submode != "filter_search") && (current_collaboration.uuid == "all")) {
    //for saving into collaboration
    current_collaboration.uuid = "private";
    current_collaboration.name = "private";
  }
  var title = current_collaboration.name;
  if(current_collaboration.uuid == "private") {
    if(submode == "filter_search") { title = "my uploads"; }
    else { title = "private"; }
  }
                          
  var width = 200;
    
  var svg = collabWidget.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', (width+117)+'px');
  svg.setAttributeNS(null, 'height', '18px');
  svg.setAttributeNS(null, 'y', '10px');

  var defs = document.createElementNS(svgNS,'defs');
  var rg1 = document.createElementNS(svgNS,'linearGradient');
  rg1.setAttributeNS(null, 'id', 'copperLinearGradient');
  rg1.setAttributeNS(null, 'x1', '0%');
  rg1.setAttributeNS(null, 'y1', '0%');
  rg1.setAttributeNS(null, 'x2', '0%');
  rg1.setAttributeNS(null, 'y2', '100%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'style', 'stop-opacity:1; stop-color:rgb(245,222,179);');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'style', 'stop-opacity:1; stop-color:rgb(244,164,96);');
  rg1.appendChild(stop2);
  svg.appendChild(defs);
  
  var label1 = svg.appendChild(document.createElementNS(svgNS,'text'));
  label1.setAttributeNS(null, 'x', '1px');
  label1.setAttributeNS(null, 'y', '12px');
  label1.setAttributeNS(null, "font-size","12");
  label1.setAttributeNS(null, "fill", "black");
  label1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label1.appendChild(document.createTextNode("collaborative project:"));

  var g1 = svg.appendChild(document.createElementNS(svgNS,'g'));
  g1.setAttributeNS(null, 'transform', "translate(117,0)");

  var border = g1.appendChild(document.createElementNS(svgNS,'polygon'));
  border.setAttributeNS(null, 'points', '1,1 '+(width-1)+',1 '+(width-1)+',16 1,16');
  border.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke:url(#copperLinearGradient); fill:white;');
  border.setAttributeNS(null, "onclick", "eedbShowCollaborationSelectPanel();");

  
  var label2 = g1.appendChild(document.createElementNS(svgNS,'text'));
  label2.setAttributeNS(null, 'x', '5px');
  label2.setAttributeNS(null, 'y', '12px');
  label2.setAttributeNS(null, "font-size","10");
  label2.setAttributeNS(null, "fill", "black");
  label2.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label2.setAttributeNS(null, "font-weight", 'bold');
  label2.appendChild(document.createTextNode(title));
  label2.setAttributeNS(null, "onclick", "eedbShowCollaborationSelectPanel();");

  var polyback2 = g1.appendChild(document.createElementNS(svgNS,'polygon'));
  polyback2.setAttributeNS(null, 'points', (width-16)+',0 '+(width-1)+',0 '+(width-1)+',15 '+(width-16)+',15');
  polyback2.setAttributeNS(null, 'style', 'fill:url(#copperLinearGradient)');
  polyback2.setAttributeNS(null, "onclick", "eedbShowCollaborationSelectPanel();");
  
  var arrow = g1.appendChild(document.createElementNS(svgNS,'polygon'));
  arrow.setAttributeNS(null, 'points', (width-12)+',5 '+(width-4)+',5 '+(width-8)+',11');
  arrow.setAttributeNS(null, 'style', 'fill:white');
  arrow.setAttributeNS(null, "onclick", "eedbShowCollaborationSelectPanel();");
  
  return collabWidget;
}


function eedbShowCollaborationSelectPanel() {
  var collabWidget        = document.getElementById("_collaborationSelectWidget");
  var submode = collabWidget.getAttribute("submode");

  eedbShowLogin();

  var divFrame = collabWidget.appendChild(document.createElement('div'));
  divFrame.id = "_collaborationSelect";
  divFrame.setAttribute('style', "position:absolute; background-color:rgb(245,222,179); text-align:left; "
                        +"border:inset; border-width:2px; padding: 3px 3px 3px 3px; "
                        +"font-size:10px; "
                        +"left:10px; top:5px; width:320px; z-index:200;"
                        );
  var tdiv, tspan, tinput;
  
  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Select collaborative project";
  divFrame.appendChild(tdiv)
  
  var currentOK = false;

  //add "all" option for DEX filtering
  if((submode == "filter_search") || (submode == "config_search")) {
    var option = divFrame.appendChild(document.createElement('div'));
    option.setAttribute('style', "padding: 1px 1px 1px 1px;");
    var radio = option.appendChild(document.createElement("input"));
    radio.setAttribute("onclick", "eedbCollaborationSelectChanged('all','all');");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "collabRadioSet");
    radio.setAttribute("value", "all");
    if(current_collaboration.uuid == "all") { radio.setAttribute("checked", "checked"); currentOK=true; }
    var tspan = option.appendChild(document.createElement("span"));
    tspan.innerHTML = "all";
  }

  //add private collaboration
  if(current_user) {
    var option = divFrame.appendChild(document.createElement('div'));
    option.setAttribute('style', "padding: 1px 1px 1px 1px;");
    var radio = option.appendChild(document.createElement("input"));
    radio.id = "_collaborationSelectWidget_private_radio";
    radio.setAttribute("onclick", "eedbCollaborationSelectChanged('private','private');");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "collabRadioSet");
    radio.setAttribute("value", "private");
    if(current_collaboration.uuid == "private") { radio.setAttribute("checked", "checked"); currentOK=true; }
    var tspan = option.appendChild(document.createElement("span"));

    var submode = collabWidget.getAttribute("submode");
    if(submode == "filter_search") { tspan.innerHTML = "my uploads"; }
    else { tspan.innerHTML = "private"; }
  }
  
  // make cgi query
  var collabXMLHttp = GetXmlHttpObject()  
  if(collabXMLHttp == null) { return; }
  
  var url = eedbUserCGI+"?mode=collaborations;format=minxml";
  if((submode == "filter_search") || (submode == "config_search")) { url += ";submode=searchable"; }
  else { url += ";submode=member"; }
  collabXMLHttp.open("GET", url, false);  //not async
  collabXMLHttp.send(null);
  if(collabXMLHttp.responseXML == null) { return; }
  if(collabXMLHttp.readyState!=4) { return; }
  if(collabXMLHttp.status!=200) { return; }
  
  var xmlDoc=collabXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  
  var collab_array = new Array;
  var xmlCollabs = xmlDoc.getElementsByTagName("collaboration");
  for(i=0; i<xmlCollabs.length; i++) {
    var collaboration = eedbParseCollaborationData(xmlCollabs[i]);
    collab_array.push(collaboration);
  }
  collab_array.sort(eedb_collab_sort_func);

  for(i=0; i<collab_array.length; i++) {
    var collaboration = collab_array[i];
    //if((i==0) && (collaboration.owner_openID != "public")) { divFrame.appendChild(document.createElement('p')); }
    var option = divFrame.appendChild(document.createElement('div'));
    option.setAttribute('style', "padding: 1px 1px 1px 1px;");
    var radio = option.appendChild(document.createElement("input"));
    radio.setAttribute("onclick", "eedbCollaborationSelectChanged('"+collaboration.uuid+"','"+collaboration.name+"');");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "collabRadioSet");
    radio.setAttribute("value", collaboration.uuid);
    if(current_collaboration.uuid == collaboration.uuid) { radio.setAttribute("checked", "checked"); currentOK=true; }
    var tspan = option.appendChild(document.createElement("span"));
    tspan.innerHTML = collaboration.name;    

    if(collaboration.uuid == "public") { divFrame.appendChild(document.createElement('p')); }
  }
  divFrame.appendChild(document.createElement('p'));
  if(!currentOK) {
    var radio = document.getElementById("_collaborationSelectWidget_private_radio");
    if(radio) { radio.setAttribute("checked", "checked"); }
    current_collaboration.name = "private";
    current_collaboration.uuid = "private";
  }
}


function eedb_collab_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.uuid == "all") { return -1; }
  if(b.uuid == "all") { return 1; }
  if(a.uuid == "private") { return -1; }
  if(b.uuid == "private") { return 1; }
  if(a.uuid == "curated") { return -1; }
  if(b.uuid == "curated") { return 1; }
  if(a.uuid == "public") { return -1; }
  if(b.uuid == "public") { return 1; }

  if(a.name.toLowerCase() > b.name.toLowerCase()) { return 1; }
  if(a.name.toLowerCase() < b.name.toLowerCase()) { return -1; }

  return 0;
}


function eedb_collab_members_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.member_status == "owner") { return -1; }
  if(b.member_status == "owner") { return 1; }

  var emailA = a.email;
  var emailB = b.email;

  if(!emailA) { return 1; }
  if(!emailB) { return -1; }

  if(emailA.toLowerCase() > emailB.toLowerCase()) { return 1; }
  if(emailA.toLowerCase() < emailB.toLowerCase()) { return -1; }

  return 0;
}


function eedbCollaborationSelectChanged(uuid, name) {
  //document.getElementById("message").innerHTML = "collaboration ["+uuid+"]";
  current_collaboration.name = name;
  current_collaboration.uuid = uuid;
  eedbCollaborationSelectWidget();
  if(current_collaboration.callOutFunction) {
    current_collaboration.callOutFunction();
  }
}


function eedbCollaborationChange(value) {
  //value can be either name or uuid, performs query and check before changing
  //document.getElementById("message").innerHTML= "eedbCollaborationChange [" + value +"]";

  // make cgi query
  var collabXMLHttp = GetXmlHttpObject()  
  if(collabXMLHttp == null) { return; }
  
  value = value.unescapeHTML();
  value = value.replace(/%20/g, " ");

  var url = eedbUserCGI+"?mode=collaborations;format=simplexml;submode=searchable";
  url += ";collaboration_uuid="+value;
  collabXMLHttp.open("GET", url, false);  //not async
  collabXMLHttp.send(null);
  if(collabXMLHttp.responseXML == null) { return; }
  if(collabXMLHttp.readyState!=4) { return; }
  if(collabXMLHttp.status!=200) { return; }
  
  var xmlDoc=collabXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  
  var xmlCollabs = xmlDoc.getElementsByTagName("collaboration");
  for(i=0; i<xmlCollabs.length; i++) {
    var collaboration = eedbParseCollaborationData(xmlCollabs[i]);
        
    if((collaboration.uuid == value) || (collaboration.name == value)) {
      current_collaboration.name = collaboration.name;
      current_collaboration.uuid = collaboration.uuid;
    } else {
      current_collaboration.name = "all";
      current_collaboration.uuid = "all";
    }
  }
}




//---------------------------------------------------------------------------------
//
// genome/assembly select inferface
//
//---------------------------------------------------------------------------------

function zenbuGenomeSelectWidget(submode, uniqID) {
  if(!uniqID) { uniqID = "_"; }

  var genomeWidget = current_genome.genomeWidgets[uniqID];

  if(!genomeWidget) {    
    console.log("zenbuGenomeSelectWidget ["+uniqID+"] create new widget");
    genomeWidget = document.createElement('span');
    genomeWidget.id = uniqID+"_genomeSelectWidget";
    genomeWidget.uniqID = uniqID;
    //genomeWidget.setAttribute("style", "position:relative; margin:3px 3px 3px 0px;");
    genomeWidget.setAttribute("style", "margin:2px 10px 2px 5px;");
    genomeWidget.name = "";
    genomeWidget.assembly = null;

    var span2 = document.createElement('span');
    span2.innerHTML = "genome:";
    genomeWidget.appendChild(span2);
    
    assemblySelect = document.createElement('select');
    //assemblySelect.className = "sliminput";
    assemblySelect.className = "dropdown";
    assemblySelect.style.fontSize = "10px";
    assemblySelect.setAttribute("name", "assembly");
   // assemblySelect.setAttribute('style', "margin: 1px 0px 1px 3px; font-family:arial,helvetica,sans-serif; ");
    assemblySelect.setAttribute("onchange", "zenbuGenomeSelectChanged(\""+uniqID+"\", this.value);");
    assemblySelect.id = uniqID+"_genomeSelect";
    genomeWidget.appendChild(assemblySelect);

    current_genome.genomeWidgets[uniqID] = genomeWidget;
    genomeWidget.assemblySelect = assemblySelect;
  }
  var assemblySelect = genomeWidget.assemblySelect;
  assemblySelect.innerHTML = ""; //to clear old content of <select>
    
  if(submode) { genomeWidget.setAttribute("submode", submode); } 
  else { submode = genomeWidget.getAttribute("submode"); }
  
  if(current_genome.available_genomes.length >0) {
    zenbuGenomeSelectUpdate(uniqID);
  } else {
    //create a loading... label and then load
    var option = document.createElement('option');
    option.setAttribute("value", "");
    option.innerHTML = "loading.....";
    assemblySelect.appendChild(option);
    
    zenbuLoadAvailableGenomes();
  }
  
  return genomeWidget;
}


function zenbuGenomeSelectUpdate(uniqID) {
  if(!uniqID) { uniqID = "_"; }
  var genomeWidget = current_genome.genomeWidgets[uniqID];
  if(!genomeWidget) { return; }

  var assemblySelect = genomeWidget.assemblySelect;
  assemblySelect.innerHTML = ""; //to clear old content of <select>
  
  if(current_genome.available_genomes.length == 0) {
    //create a loading... label and then load
    var option = document.createElement('option');
    option.setAttribute("value", "");
    option.innerHTML = "loading.....";
    assemblySelect.appendChild(option);
    return genomeWidget;
  }

  var submode = genomeWidget.getAttribute("submode");  
  if(submode == "filter_search") {
    var option = document.createElement('option');
    option.setAttribute("value", "all");
    option.innerHTML = "all assemblies";
    assemblySelect.appendChild(option);
  }

  if(submode == "upload") {
    var option = document.createElement('option');
    option.setAttribute("value", "");
    option.innerHTML = "please select genome assembly";
    assemblySelect.appendChild(option);
  }
  if((genomeWidget.getAttribute("allow_non_genomic") == "true") || genomeWidget.allow_non_genomic) {
    var option = document.createElement('option');
    option.setAttribute("value", "non-genomic");
    option.innerHTML = "non genomic";
    assemblySelect.appendChild(option);
    if(genomeWidget.name == "non-genomic") { option.setAttribute("selected", "selected"); }
    //if(current_genome.name == "non-genomic") { option.setAttribute("selected", "selected"); }
  }

  for(var i=0; i<current_genome.available_genomes.length; i++) {
    var assembly = current_genome.available_genomes[i];
    
    var option = document.createElement('option');
    option.setAttribute("value", assembly.assembly_name);
    //option.innerHTML = assembly.common_name + " "+ assembly.assembly_name;
    //option.innerHTML = assembly.common_name + " ("+assembly.genus +" "+ assembly.species + ") "+ assembly.assembly_name;
    option.innerHTML = assembly.assembly_name + " - "+ assembly.common_name + " ("+assembly.genus +" "+ assembly.species + ")";
    assemblySelect.appendChild(option);
    
    if(assembly.assembly_name == genomeWidget.name) { option.setAttribute("selected", "selected"); }
    //if(assembly.assembly_name == current_genome.name) { option.setAttribute("selected", "selected"); }
  }  
  return genomeWidget;
}


function zenbuLoadAvailableGenomes() {
  if(current_genome.loading) { return; }

  var genomeXMLHttp = GetXmlHttpObject()  
  if(genomeXMLHttp == null) { return; }
  current_genome.xhr = genomeXMLHttp;
  
  // XML POST query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>genome</mode>\n";
  paramXML += "</zenbu_query>\n";
  
  genomeXMLHttp.onreadystatechange = zenbuLoadAvailableGenomesReply;
  genomeXMLHttp.open("POST", eedbSearchFCGI, true);
  genomeXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  genomeXMLHttp.send(paramXML);

  current_genome.loading = true;
}  
 
function zenbuLoadAvailableGenomesReply() {
  var genomeXMLHttp = current_genome.xhr;
  if(!genomeXMLHttp) { return; }
  if(genomeXMLHttp.responseXML == null) { return; }
  if(genomeXMLHttp.readyState!=4) { return; }
  if(genomeXMLHttp.status!=200) { return; }
  
  current_genome.loading = false;
  var xmlDoc=genomeXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  
  //make sure it is clear
  current_genome.available_genomes = new Array;
  var genomeHash = new Object;

  var xmlAssemblies = xmlDoc.getElementsByTagName("assembly");
  for(i=0; i<xmlAssemblies.length; i++) {
    var assembly = eedbParseAssemblyData(xmlAssemblies[i]);

    genomeHash[assembly.assembly_name] = assembly;
  }

  for(var name in genomeHash) {
    var assembly = genomeHash[name];
    current_genome.available_genomes.push(assembly);
  }
  current_genome.available_genomes.sort(genomes_sort_func);

  for(uniqID in current_genome.genomeWidgets) {
    var genomeWidget = current_genome.genomeWidgets[uniqID];
    zenbuGenomeSelectUpdate(uniqID);
  }
  //zenbuGenomeSelectUpdate();
}

function genomes_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.common_name.toLowerCase() > b.common_name.toLowerCase()) { return 1; }
  if(a.common_name.toLowerCase() < b.common_name.toLowerCase()) { return -1; }

  if(a.assembly_name && b.assembly_name) {
    if(a.assembly_name.toLowerCase() > b.assembly_name.toLowerCase()) { return 1; }
    if(a.assembly_name.toLowerCase() < b.assembly_name.toLowerCase()) { return -1; }
  }
  return 0;
}


function zenbuGenomeSelectChanged(uniqID, name) {
  console.log("zenbuGenomeSelectChanged ["+uniqID+"] name:"+name);
  if(!uniqID) { uniqID = "_"; }
  var genomeWidget = current_genome.genomeWidgets[uniqID];
  if(!genomeWidget) { return; }
  console.log("zenbuGenomeSelectChanged ["+uniqID+"] have the widget");

  genomeWidget.name = "all";
  genomeWidget.assembly = null;
  
  for(var i=0; i<current_genome.available_genomes.length; i++) {
    var assembly = current_genome.available_genomes[i];
    if((assembly.assembly_name == name) || (assembly.assembly_name == name)) {
      genomeWidget.name = name;
      genomeWidget.assembly = assembly;
      console.log("zenbuGenomeSelectChanged found matching genome");
    }
  }
  if(name == "non-genomic") { genomeWidget.name = name; }
    
  current_genome.name = genomeWidget.name

  if(current_genome.callOutFunction) { current_genome.callOutFunction(); }
  if(genomeWidget.callOutFunction)   { genomeWidget.callOutFunction(genomeWidget); }
}


function zenbuParseJobXML(xmlJob, job) {
  if(!xmlJob) { return; }
  if(!job) { job = new Object; } 
  
  job.classname    = "Job";
  job.upload_error = "";
  job.id           = xmlJob.getAttribute("id");
  job.name         = xmlJob.getAttribute("name");
  job.status       = xmlJob.getAttribute("status");
  if(job.status == "READY") { job.status = "QUEUED"; }
  if(xmlJob.getAttribute("create_date")) {
    job.import_date  = xmlJob.getAttribute("create_date");
  }
  if(xmlJob.getAttribute("create_timestamp")) {
    job.import_timestamp  = xmlJob.getAttribute("create_timestamp");
  }
  if(xmlJob.getAttribute("owner_openid")) {
    job.owner_openID  = xmlJob.getAttribute("owner_openid");
  }
  job.platform     = '';     
  job.assembly     = '';     
  job.description  = "";

  eedbParseMetadata(xmlJob, job);
  
  if(job.mdata["upload_error"]) {
    var value_array = job.mdata["upload_error"];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];
      if(job.upload_error) { job.upload_error +=". "; }
      job.upload_error += value;
    }
  }

  return job;
}


