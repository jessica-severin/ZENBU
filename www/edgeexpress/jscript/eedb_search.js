/*--------------------------------------------------------------------------
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
 *--------------------------------------------------------------------------*/

var eedbRegistryURL;
var eedb_searchXHR_array = new Array();
var eedb_searchTracks = new Object();
var newSearchTrackID = 1;
var searchXMLHttp;
var eedbObjectURL = "../cgi/eedb_object.fcgi";
var eedbPeerCache = new Object();

function eedbGetPeer(name) {
  if(!eedbRegistryURL) return;
  if(eedbPeerCache[name] != null) { return eedbPeerCache[name];}

  var url = eedbObjectURL + "?peers=" + name;

  var peerXHR=GetXmlHttpObject();
  if(peerXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  peerXHR.open("GET",url,false);
  peerXHR.send(null);
  if(peerXHR.readyState!=4) return;
  if(peerXHR.responseXML == null) return;
  var xmlDoc=peerXHR.responseXML.documentElement;
  if(xmlDoc==null)  return;
  var peer = xmlDoc.getElementsByTagName("peer")[0];
  eedbPeerCache[name] = peer;
  return peer;
}


function eedbClearSearchResults(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }

  var searchInput = document.getElementById(searchSetID + "_inputID");
  if(searchInput) {
    searchInput.value = "";
    searchInput.focus();
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
    searchMesg.innerHTML="please enter search term"; 
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
    var title       = searchDiv.getAttribute("searchTitle");
    var peerName    = searchDiv.getAttribute("peer");
    var mode        = searchDiv.getAttribute("mode");
    var grid        = searchDiv.getAttribute("grid");
    var multiselect = searchDiv.getAttribute("multiselect");
    var server      = searchDiv.getAttribute("server");
    var sources     = searchDiv.getAttribute("sources");
    if(!title) { title = peerName; }
    if(mode == "hide") { searchDiv.style.display = 'none'; }

    var searchTrack = eedb_searchTracks[searchID];
    if(!searchTrack) {
      searchTrack                 = new Object;
      searchTrack.searchSetID     = searchSetID;
      searchTrack.searchID        = searchID;
      searchTrack.searchDiv       = searchDiv;
      searchTrack.peerName        = peerName;
      searchTrack.sources         = sources;
      searchTrack.mode            = mode;
      searchTrack.selected_hash   = new Object;
      eedb_searchTracks[searchID] = searchTrack;
    }

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
        text += "<a href=\"#\" " +"onclick=\"searchClick(\'" +fid+ "\', \'" +encodehtml(obj.fname)+ "\');return false;\" "
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

function eedbEmptySearchResults(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");
  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];
    searchDiv.innerHTML="";
  }
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
  var charCode;
  if(e && e.which) charCode=e.which;
  else if(e) charCode = e.keyCode;

  if (str.length<3 && charCode!=13) {
    //eedbClearSearchResults(searchSetID);
    return;
  }

  if(!searchDiv) return;

  var searchID   = searchDiv.getAttribute("id");
  var server     = searchDiv.getAttribute("server");
  var peerName   = searchDiv.getAttribute("peer");
  var sources    = searchDiv.getAttribute("sources");
  var mode       = searchDiv.getAttribute("mode");

  if(mode == "hide") { return; }
  if((mode == "experiments" || mode=="feature_sources") && (charCode) && (charCode!=13)) { return; }

  var searchTrack = eedb_searchTracks[searchID];
  if(!searchTrack) {
    searchTrack                = new Object;
    searchTrack.searchSetID    = searchSetID;
    searchTrack.searchID       = searchID;
    searchTrack.searchDiv      = searchDiv;
    searchTrack.peerName       = peerName;
    searchTrack.sources        = sources;
    searchTrack.mode           = mode;
    searchTrack.selected_hash = new Object;
    eedb_searchTracks[searchID] = searchTrack;
  }

  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(searchMesg) { searchMesg.innerHTML = ""; }

  var url = eedbObjectURL +"?";
  if(server) { url = server +"?"; }
  if(peerName) { url += "peer="+peerName+";"; }

  str = str.replace(/[\+]/g,'%2B');
  if(mode == "experiments") {
    url += "mode=experiments;filter="+str+";";
  } else if(mode == "feature_sources") {
    url += "mode=feature_sources;filter="+str+";";
  } else {
    url += "mode=search;limit=1000;name="+str+";";
    if(sources) { url += "sources="+sources+";"; }
  }

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }

  var xhrObj = new Object;
  xhrObj.xhr   = xhr;
  eedb_searchXHR_array[searchID] = xhrObj;


  searchDiv.innerHTML="Searching...";

  //damn this is funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { eedbDisplaySearchResults(id); };}(searchID);
  xhr.open("GET",url,true);
  xhr.send(null);
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


function eedbDisplaySearchResults(searchID) {
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

  var searchDiv = document.getElementById(searchID);
  if(!searchDiv) return;
  var searchTrack = eedb_searchTracks[searchID];

  var title   = searchDiv.getAttribute("searchTitle");
  var peer    = searchDiv.getAttribute("peer");
  var mode    = searchDiv.getAttribute("mode");
  var grid    = searchDiv.getAttribute("grid");
  var multiselect = searchDiv.getAttribute("multiselect");
  var showAll = searchDiv.getAttribute("showAll");
  if(!title) { title = peer; }

  var text="<div style=\"font-size:11px;\" onmouseout=\"eedbClearSearchTooltip();\" >";
  var nodes;
  if(title) { text += "<span style=\"font-weight:bold;color:Navy;\">"+ title + "::</span> "; }

  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    total     = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
    likeCount = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("like_count") -0;
    filtered  = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("filtered") -0;
  }
  if(total==-1) {
    text += "Error in query";
    searchDiv.style.display = 'none';
  } else if(total==0) {
    text += "No match found";
    searchDiv.style.display = 'none';
  } else if(total>0 && filtered==0) {
    if(likeCount>0) {
      text += total+" matches : Too many to display";
      searchDiv.style.display = 'block';
    } else {
      text += total+" searched : No match found";
      //searchDiv.style.display = 'none';
      searchDiv.style.display = 'block';
    }
  } else {
    searchDiv.style.display = 'block';
    if(mode == "experiments") {
      nodes = xmlDoc.getElementsByTagName("experiment");
    } else if(mode == "feature_sources") {
      nodes = xmlDoc.getElementsByTagName("featuresource");
    } else {
      nodes = xmlDoc.getElementsByTagName("match");
    }

    text += "(found " +filtered;
    if(filtered < total) { text += ", from " +total; }
    text += ") ";

    if(multiselect) {
      text += "<a style=\"color:red; text-decoration:underline;\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'all\');\">select all</a> ";
      text += "<a style=\"color:red; text-decoration:underline;\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'clear\');\">unselect all</a> ";
    }

    if(showAll == 1) {
      var allnames = "";
      for(i=0; i<nodes.length; i++) allnames += nodes[i].getAttribute("desc")+ " ";
      text += "<a style=\"color:red\" href=\"#\" onclick=\"searchClickAll('" +allnames+ "')\" >(add all " +filtered+ ")</a> ";
    }
    if(grid) { text += "<table width='100%'><tr>"; }

    var count=0;
    for (var fid in searchTrack.selected_hash) {
      var obj = searchTrack.selected_hash[fid]; 
      obj.visible = false;
      if(!obj.state) {continue;}
      obj.visible = true;
      if(grid && (count%grid == 0)) { text += "</tr><tr>"; }
      if(grid) { text += "<td>"; }
      text += "<input type=\"checkbox\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'" +fid+ "\', this.checked);\" checked=\"checked\" />";
      text += "<a href=\"#\" " +"onclick=\"searchClick(\'" +fid+ "\', \'" + encodehtml(obj.fname)+ "\');return false;\" "
              +" onmouseover=\"eedbSearchTooltip(\'" +fid+ "\');\""
              +">" + encodehtml(obj.fname) +"</a> ";
      if(grid) { text += "</td>"; }
      count++;
    }

    for(i=0; i<nodes.length; i++) {
      var fid   = nodes[i].getAttribute("feature_id");
      var fname = nodes[i].getAttribute("desc");
      if(mode == "experiments") {
        fid = nodes[i].getAttribute("id");
        fname = nodes[i].getAttribute("name");
        fname = fname.replace(/_/g, " ");
      }
      if(mode == "feature_sources") {
        fid = nodes[i].getAttribute("id");
        var category = nodes[i].getAttribute("category");
        fname = nodes[i].getAttribute("name");
        fname = fname.replace(/_/g, " ");
      }
      var obj = searchTrack.selected_hash[fid]; 
      if(obj && obj.state) { continue; }
      if(grid && (count%grid == 0)) { text += "</tr><tr>"; }
      if(grid) { text += "<td>"; }
      if(multiselect) {
        if(!obj) { obj = new Object; obj.state = false; obj.fid = fid; obj.fname = fname; searchTrack.selected_hash[fid] = obj; }
        obj.visible = true;
        text += "<input type=\"checkbox\" onclick=\"eedbSearchMultiSelect(\'" +searchID+ "\', \'" +fid+ "\', this.checked);\" ";
        if(obj && obj.state) { text += " checked "; }
        text += " />";
      }

      text += "<a href=\"#\" " +"onclick=\"searchClick(\'" +fid+ "\', \'" + encodehtml(fname)+ "\');return false;\" "
              +" onmouseover=\"eedbSearchTooltip(\'" +fid+ "\');\""
              +">" + encodehtml(fname) +"</a> ";
      if(grid) { text += "</td>"; }
      count++;
    }
    if(grid) { text += "</tr></table>"; }
  }

  text += "</div>";
  searchDiv.innerHTML=text;
}

function eedbSearchMultiSelect(searchID, fid, state) {
  var searchTrack = eedb_searchTracks[searchID];
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


function eedbSearchTooltip(id) {

  var mode = "feature";

  var url = eedbObjectURL + "?id=" + id;
  //document.getElementById("message").innerHTML= url;

  featureTipXMLHttp=GetXmlHttpObject();
  if(featureTipXMLHttp==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }

  //featureTipXMLHttp.onreadystatechange=eedbDisplaySearchTooltip;
  featureTipXMLHttp.open("GET",url,false);
  featureTipXMLHttp.send(null);
  eedbDisplaySearchTooltip();
}

function eedbClearSearchTooltip() {
  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";
  // document.getElementById("SVGdiv").innerHTML= "tooltip mouse out";
  offsetY = 10;
}

function eedbDisplaySearchTooltip(id) {
  if(featureTipXMLHttp.readyState!=4) return;
  if(featureTipXMLHttp.responseXML == null) return;

  var xmlDoc=featureTipXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    alert('Problem with central DB!');
    return;
  } 

  var peer;
  if(xmlDoc.getElementsByTagName("peer").length>0) {
    peer = xmlDoc.getElementsByTagName("peer")[0];
  }
  if(xmlDoc.getElementsByTagName("feature").length > 0) {
    var feature = xmlDoc.getElementsByTagName("feature")[0];
    eedbFeatureTooltip(feature);
  }
  else if(xmlDoc.getElementsByTagName("experiment").length >0) {
    var experiment = xmlDoc.getElementsByTagName("experiment")[0];
    eedbExperimentTooltip(experiment, peer);
  }
  else if(xmlDoc.getElementsByTagName("featuresource").length > 0) {
    var fsource = xmlDoc.getElementsByTagName("featuresource")[0];
    eedbFeatureSourceTooltip(fsource, peer);
  }

}


function eedbFeatureTooltip(feature) {
  if(!feature) return;
  var fsource = feature.getElementsByTagName("featuresource")[0];
  var symbols = feature.getElementsByTagName("symbol");
  var mdata = feature.getElementsByTagName("mdata");
  var maxexpress = feature.getElementsByTagName("max_expression");
  var synonyms = "";
  var description = "";
  var entrez_id;
  var genloc = "";
  var chromloc = ""; 
  if(feature.getAttribute("chr")) {
    chromloc = feature.getAttribute("chr") +":" 
                +feature.getAttribute("start") +".." 
                +feature.getAttribute("end")
                +feature.getAttribute("strand");
  }

  for(i=0; i<mdata.length; i++) {
    if(mdata[i].getAttribute("type") == "description") description = mdata[i].firstChild.nodeValue; 
  }
  for(i=0; i<symbols.length; i++) {
    if(symbols[i].getAttribute("type") == "ILMN_hg6v2_key") {
      synonyms += symbols[i].getAttribute("value") + " ";
    }
    if(symbols[i].getAttribute("type") == "Entrez_synonym") {
      synonyms += symbols[i].getAttribute("value") + " ";
    }
    if((symbols[i].getAttribute("type") == "EntrezGene") && (feature.getAttribute("desc") != symbols[i].getAttribute("value"))) {
      synonyms += symbols[i].getAttribute("value") + " ";
    }
    if(symbols[i].getAttribute("type") == "EntrezID") entrez_id = symbols[i].getAttribute("value");
    if(symbols[i].getAttribute("type") == "GeneticLoc") genloc = symbols[i].getAttribute("value");
    if(symbols[i].getAttribute("type") == "TFsymbol") synonyms += symbols[i].getAttribute("value");
  }
  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:300px; z-index:100; "+
                    "background-color:lavender; border:inset; padding: 3px 3px 3px 3px;"+
                    "opacity: 0.95; filter:alpha(opacity=95); -moz-opacity:0.95;\">";
  object_html += "<div>";
  object_html += " <span style=\"font-size:12px; font-weight: bold;\">" + encodehtml(feature.getAttribute("desc"))+"</span>";
  object_html += " <span style=\"font-size:9px;\">" + encodehtml(fsource.getAttribute("category")) +" : " + encodehtml(fsource.getAttribute("name")) + "</span>";
  object_html += "</div>";
  if(description.length > 0) { object_html += "<div>" + encodehtml(description)+ "</div>"; }
  if(synonyms.length > 0) { object_html += "<div>alias: " + synonyms +"</div>"; }
  if(entrez_id) { object_html += "<div>EntrezID: " + entrez_id +"</div>"; }
  if(chromloc) { object_html += "<div>location: " + genloc + " ::  " + chromloc +"</div>"; }
  if(maxexpress && (maxexpress.length > 0)) {
    object_html += "<div>maxexpress: ";
    var express = maxexpress[0].getElementsByTagName("express");
    for(i=0; i<express.length; i++) {
      var platform = express[i].getAttribute("platform");
      if(platform == 'Illumina microarray') { platform = "ILMN"; }
      object_html += platform + ":" + express[i].getAttribute("maxvalue") + " ";
    }
    object_html += "</div>";
  }

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


function eedbExperimentTooltip(experiment, peer) {
  if(!experiment) return;

  var peer_name;
  if(peer) { peer_name = peer.getAttribute("alias"); }

  var symbols = experiment.getElementsByTagName("symbol");
  var mdata = experiment.getElementsByTagName("mdata");
  var description = "";
  var exp_name = experiment.getAttribute("name");
  exp_name = exp_name.replace(/_/g, " ");

  for(i=0; i<mdata.length; i++) {
    if(mdata[i].getAttribute("type") == "description") description = mdata[i].firstChild.nodeValue; 
  }
  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:380px; z-index:100; "+
                    "background-color:lavender; border:inset; padding: 3px 3px 3px 3px;"+
                    "opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9;\">";
  object_html += "<div>";
  if(peer) {
    var peer_name = peer.getAttribute("alias");
    object_html += "<span style=\"font-size:12px;\">peer: <span style=\"color:blue;\">" +peer_name+ "</span></span>";
  }
  object_html += "<span style=\"float:right; font-size:12px; font-weight:bold; margin: 0px 5px 0px 0px;\">experiment</span></div>";

  object_html += "<div><span style=\"font-size:12px; font-weight: bold;\">" +exp_name+ "</span>";
  object_html += " <span style=\"font-size:9px;\">" + experiment.getAttribute("platform") +"</span>";
  object_html += "</div>";
  if(description.length > 0) object_html += "<div>" +description+ "</div>";

  //object_html += "<table cellpadding=\"0px\">";
  //for(i=0; i<symbols.length; i++) {
  //  var type = symbols[i].getAttribute("type");
  //  var value = symbols[i].getAttribute("value");
  //  object_html += "<tr><td style=\"font-size:12px;\">" +type+ "</td><td>" +value+ "</td></tr>";
  //}
  //object_html += "</table>";

  object_html += "</div>";

  //offsetY = -100 - (symbols.length*16);
  offsetY = -100;

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


function eedbFeatureSourceTooltip(fsource, peer) {
  if(!fsource) return;

  var category = fsource.getAttribute("category");
  var name = fsource.getAttribute("name");
  name = name.replace(/_/g, " ");

  var peer_name;
  if(peer) { peer_name = peer.getAttribute("alias"); }

  var symbols = fsource.getElementsByTagName("symbol");
  var mdata = fsource.getElementsByTagName("mdata");
  var description = "";
  for(i=0; i<mdata.length; i++) {
    if(mdata[i].getAttribute("type") == "description") description = mdata[i].firstChild.nodeValue; 
  }

  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:300px; z-index:100; "+
                    "background-color:lavender; border:inset; padding: 3px 3px 3px 3px;"+
                    "opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9;\">";
  object_html += "<div>";
  if(peer) {
    var peer_name = peer.getAttribute("alias");
    object_html += "<span style=\"font-size:12px;\">peer: <span style=\"color:blue;\">" +peer_name+ "</span></span>";
  }
  object_html += "<span style=\"float:right; font-size:12px; font-weight:bold; margin: 0px 5px 0px 0px;\">feature-source</span></div>";

  object_html += "<div><span style=\"font-size:12px; font-weight: bold;\">" +name+ "</span>";
  object_html += " <span style=\"font-size:9px;\">"+ category + "</span>";
  object_html += "</div>";
  if(description.length > 0) object_html += "<div>" +description+ "</div>";

  object_html += "<table cellpadding=\"0px\">";
  for(i=0; i<symbols.length; i++) {
    var type = symbols[i].getAttribute("type");
    var value = symbols[i].getAttribute("value");
    object_html += "<tr><td style=\"font-size:12px;\">" +type+ "</td><td>" +value+ "</td></tr>";
  }
  object_html += "</table>";

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


function eeebReconfigureSearchSet(searchSetID) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");

  var reconfigDiv = document.getElementById("searchSetConfigDiv");
  if(reconfigDiv) {
    reconfigDiv.innerHTML = "";
  } else {
    reconfigDiv = document.createElement('div');
    reconfigDiv.setAttribute('id', "searchSetConfigDiv");
    reconfigDiv.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"z-index:102; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + (toolTipSTYLE.xpos-229) +"px; "
                            +"top:" + toolTipSTYLE.ypos +"px; "
                            +"width:320px;"
                             );
    searchset.appendChild(reconfigDiv);
  }

  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];

    var searchID   = searchDiv.getAttribute("id");
    var server     = searchDiv.getAttribute("server");
    var peerName   = searchDiv.getAttribute("peer");
    var sources    = searchDiv.getAttribute("sources");
    var mode       = searchDiv.getAttribute("mode");

    //----------
    var button = document.createElement('input');
    button.setAttribute("type", "button");
    button.setAttribute("value", "delete");
    button.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    button.setAttribute("onclick", "eedbReconfigSearchParam(\""+ searchSetID +"\", 'delete', \""+ searchID +"\");");
    reconfigDiv.appendChild(button);

    var div1 = document.createElement('div');
    div1.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif;");
    div1.innerHTML = "peer: " + peerName;
    reconfigDiv.appendChild(div1)

    div1 = document.createElement('div');
    div1.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif;");
    div1.innerHTML = "source filter: " + sources;
    reconfigDiv.appendChild(div1)

    reconfigDiv.appendChild(document.createElement('hr'));
  }

  //
  // add new search
  //
  var tdiv = document.createElement('div');
  var tspan = document.createElement('span');
  tspan.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML = "feature sources:";
  tdiv.appendChild(tspan);
  var tinput = document.createElement('input');
  tinput.id = searchSetID + "_reconfig_newsources";
  tinput.setAttribute('style', "width:150px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  tinput.setAttribute('type', "text");
  tinput.setAttribute("onkeyup", "eedbReconfigSearchParam(\""+ searchSetID +"\", 'sources', this.value);");
  tdiv.appendChild(tinput);
  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "add");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "eedbReconfigSearchParam(\""+ searchSetID +"\", 'add');");
  tdiv.appendChild(button2);
  reconfigDiv.appendChild(tdiv)
  reconfigDiv.appendChild(document.createElement('hr'));


  //
  // finish button
  //
  var button3 = document.createElement('input');
  button3.setAttribute("type", "button");
  button3.setAttribute("value", "finish");
  button3.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button3.setAttribute("onclick", "eedbReconfigSearchParam(\""+ searchSetID +"\", 'done');");
  reconfigDiv.appendChild(button3);
}


function eedbReconfigSearchParam(searchSetID, param, value) {
  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  //document.getElementById("message").innerHTML= "reconfig: " + searchSetID + ":: "+ param + "="+value;

  if(param == "add") {
    var tinput = document.getElementById(searchSetID + "_reconfig_newsources");
    if(!tinput) { return; }
    var sources = tinput.value;
    var params = sources.split(",");
    for(var i=0; i<params.length; i++) {
      var param = params[i];
      var re1 = /^(.+)\:\:(.+)$/;
      var id_match = re1.exec(param);
      if(id_match && (id_match.length == 3)) {
        var peer = id_match[1];
        var source = id_match[2];

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

        searchDiv.setAttribute("peer", id_match[1]);
        searchDiv.setAttribute("searchTitle", id_match[2]);
        searchDiv.setAttribute("sources", id_match[2]);
        searchDiv.setAttribute("mode", "feature");
        searchDiv.setAttribute("showAll", 0);

        searchset.appendChild(searchDiv);
      }
    }
    eeebReconfigureSearchSet(searchSetID);
  }

  if(param == "delete") {
    var searchDiv = document.getElementById(value);
    if(searchDiv) {  
      searchset.removeChild(searchDiv); 
      eeebReconfigureSearchSet(searchSetID);
    }
  }

  if(param == "done") {
    var reconfigDiv = document.getElementById("searchSetConfigDiv");
    searchset.removeChild(reconfigDiv);
  }

  if(param == "accept-reconfig") {
  }
}


//-------------------------------------
//
// config save/restore section
//
//-------------------------------------

function generateSearchConfigDOM(doc, searchSetID) {

  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return doc; }

  var tracks = doc.createElement("eedbSearchTracks");

  var searchDivs = allBrowserGetElementsByClassName(searchset,"EEDBsearch");
  for(i=0; i<searchDivs.length; i++) {
    var searchDiv = searchDivs[i];

    var track = doc.createElement("searchTrack");
    track.setAttribute("peer",    searchDiv.getAttribute("peer"));
    track.setAttribute("searchTitle",   searchDiv.getAttribute("searchTitle"));
    track.setAttribute("sources", searchDiv.getAttribute("sources"));
    track.setAttribute("mode",    searchDiv.getAttribute("mode"));
    track.setAttribute("showAll", searchDiv.getAttribute("showAll"));

    tracks.appendChild(track);
  }
  return tracks;
}


function eedbSearchInitFromConfig(searchSetID, configDOM) {

  var searchset = document.getElementById(searchSetID);
  if(!searchset) { return; }
  clearKids(searchset);

  eedb_searchXHR_array = new Array();

  var searchMesg = document.getElementById(searchSetID + "_messageID");
  if(!searchMesg) {
    searchMesg = document.createElement('div');
    searchMesg.setAttribute("align","left");
    searchMesg.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
    searchMesg.id  = searchSetID + "_messageID";
    searchset.appendChild(searchMesg);
  }
  if(searchMesg) {  searchMesg.innerHTML="please enter search term"; }

  //if($self->{'id'} =~ /(.+)^::(.+)/) { $self->{'peer_name'} = $1; }

  var tracks = configDOM.getElementsByTagName("searchTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];

    //create trackdiv and glyphTrack objects and configure them

    var trackID = searchSetID + "_searchTrack" + (newSearchTrackID++);
    var searchDiv = document.createElement('div');
    searchDiv.id = trackID;
    searchDiv.setAttribute("class","EEDBsearch");
    searchDiv.style.display = 'none';
    searchDiv.style.marginTop = "5px";
    searchDiv.style.marginBottom = "5px";
    searchDiv.style.color = 'black';
    searchDiv.style.size = '12';
    searchDiv.style.fontFamily = 'arial, helvetica, sans-serif';
    searchDiv.onmouseout = "eedbClearSearchTooltip();";

    searchDiv.setAttribute("peer",    trackDOM.getAttribute("peer"));
    searchDiv.setAttribute("searchTitle",   trackDOM.getAttribute("searchTitle"));
    searchDiv.setAttribute("sources", trackDOM.getAttribute("sources"));
    searchDiv.setAttribute("mode",    trackDOM.getAttribute("mode"));
    searchDiv.setAttribute("showAll", trackDOM.getAttribute("showAll"));

    searchset.appendChild(searchDiv);
  }
  eedbClearSearchTooltip();
}

