var expressXMLHttp;
var gLyphTrack_array = new Array();
var trackXHR_array = new Array();
var expressXmlURL = "../cgi/edgeexpress.fcgi?mode=express&format=xml";
var eedbRegionURL = "../cgi/eedb_region.cgi";
var express_sort_mode = 'expid';
var svgNS = "http://www.w3.org/2000/svg";
var svgXlink = "http://www.w3.org/1999/xlink";
var newTrackID = 100;
var eedbDefaultAssembly;
var current_dragTrack;
var currentSelectTrackID;
var eedbCurrentUser ="";

var current_feature;
var current_express_probe;
var feature_express_probes = new Array();
var region_express_probes = new Object();

var current_region = new Object();
current_region.display_width = Math.floor(800);
current_region.asm = "hg18";
current_region.title = "welcome to eeDB gLyphs";
current_region.user = "";
current_region.configname = "";
current_region.desc = "";


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

//---------------------------------------------
//
// function to work with a GBrowse to use for comparison and debugging
//
//---------------------------------------------

function refreshGbrowse() {
  var asm      = current_region.asm;
  var chrom    = current_region.chrom;
  var start    = current_region.start;
  var end      = current_region.end;
  var chromloc = chrom +":" + start + ".." + end;
  var dwidth   = current_region.display_width;

  var hyperlink = "http://rgd.mcw.edu/gb/gbrowse/rgd_904/?name=" + chromloc + ";width=800";
  hyperlink += ";version=100;grid=on;label=RGD_curated_genes-EntrezTranscript-miRNA_Track-RGD_ESTs-UCSC_MRNA-RGD_STS";

  var gbrowse = "http://rgd.mcw.edu/gb/gbrowse_img/rgd_904/";
  //var gbrowse = "https://genomec.gsc.riken.jp/nw2006/fantom44/gev/gbrowse_img/hg18/";

  var gb_url = gbrowse + "?name=" + chromloc +";width="+dwidth;

  //gb_url += ";type=TU+paper1_cage_cluster_level2+paper1_cage_cluster_level3+Transcript+Illumina_BR_PMA+TF_PMA_Full";
  gb_url += ";type=RGD_curated_genes+EntrezTranscript+miRNA_Track+RGD_ESTs+UCSC_MRNA+RGD_STS";

  //gb_url += ";format=GD::SVG";
  gb_url += ";keystyle=between;grid=on";

  //document.getElementById("gbrowse1").innerHTML= "<iframe width=705px height=200px SCROLLING=yes src=\"" + gb_url + "\" />";
  var gbrowse_div = document.getElementById("gbrowse1");
  if(!gbrowse_div) { return; }
  gbrowse_div.innerHTML= "<a target=\"RGD\" href=\"" + hyperlink+"\"><img scrolling='no' src=\"" + gb_url + "\"/></a>";
}

//----------------------------------------------
// a simple draw test for debugging
//----------------------------------------------

function drawtest4() {
  var canvas = document.getElementById("express_canvas");
  if (canvas.getContext) {
     var ctx = canvas.getContext("2d");

     ctx.clearRect(0, 0, canvas.width, canvas.height);

     ctx.fillStyle = "rgb(200,0,0)";
     ctx.fillRect (10, 10, 55, 50);

     ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
     ctx.fillRect (30, 30, 55, 50);
  }
}


//---------------------------------------------
//
// eeDB_search call back function section
//
//---------------------------------------------

function searchClick(id, geneName) {
  eedbClearSearchTooltip();
  //document.getElementById("searchResults").innerHTML="Searching...";
  loadFeatureInfo(id);
  centerOnFeature();
}

function singleSearchValue(str) {
  //document.getElementById("message").innerHTML = "";
  var str = document.getElementById("searchText").value;
  gLyphsInitLocation(str);
  return false;
}

function clearExpressTooltip() {
  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";
  // document.getElementById("SVGdiv").innerHTML= "tooltip mouse out";
}


//---------------------------------------------
//
// section to mananage the feature_info
// and XHR to get the feature DOM data
//
//---------------------------------------------

function loadFeatureInfo(id) {
  var url = expressXmlURL;

  if(current_feature) {
    var curid  = current_feature.getAttribute("id");
    var curpeer = current_feature.getAttribute("peer");
    if(curpeer) { curid = curpeer +"::"+ curid; }
    if(id == curid) {
      centerOnFeature(current_feature);
      return;
    }
  }

  var fid = id;
  var re = /^(.+)\:\:(\d+)$/;
  var mymatch = re.exec(id);
  if(mymatch && (mymatch.length == 3)) {
    peerName = mymatch[1];
    //fid      = mymatch[2];
    //document.getElementById("message").innerHTML = "peer: "+peerName+"  fid: " + fid;
    var peer = eedbGetPeer(peerName);
    if(peer && (peer.getAttribute("web_url"))) { 
      url = peer.getAttribute("web_url") + "/cgi/edgeexpress.fcgi"; 
    }
  }
  url += "?mode=express&format=xml&id=" + fid;

  expressXMLHttp=GetXmlHttpObject();
  if(expressXMLHttp==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  //document.getElementById("message").innerHTML = url;

  expressXMLHttp.onreadystatechange=displayFeatureXHR;
  expressXMLHttp.open("GET",url,false); //not async
  expressXMLHttp.send(null);
  displayFeatureXHR();
}


function displayFeatureXHR(mode) {

  if(expressXMLHttp == null) { return; }
  //document.getElementById("message").innerHTML += " "+expressXMLHttp.readyState;
  if(expressXMLHttp.responseXML == null) return;
  if(expressXMLHttp.readyState!=4) return;
  if(expressXMLHttp.status!=200) { return; }

  var xmlDoc=expressXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    alert('Problem with central DB!');
    return;
  }

  document.getElementById('genome_region_div').style.display = 'block';

  var feature = xmlDoc.getElementsByTagName("feature")[0];
  displayFeatureInfo(feature);

  feature_express_probes = xmlDoc.getElementsByTagName("feature_express");
  displayProbeInfo();

  current_express_probe = feature_express_probes[0];
  drawExpressionData();  //use the current_express_probe global variable
}


function add_region_express(trackID, xmlDoc) {
  if(!xmlDoc) { return; }
  region_express_probes[trackID] = xmlDoc 
  displayProbeInfo();

  current_express_probe = xmlDoc;
  drawExpressionData();  //use the current_express_probe global variable
}

function express_sort_func(a,b) {
  var rtnval=0;
  if(express_sort_mode == 'norm') {
      var norm_a = a.getAttribute("value");
      var norm_b = b.getAttribute("value");
      rtnval = norm_b - norm_a;
  }
  else if(express_sort_mode == 'series') {
    var nameA = a.getAttribute("series_name");
    var nameB = b.getAttribute("series_name");

    var pointA = a.getAttribute("series_point");
    var pointB = b.getAttribute("series_point");

    var expA = a.getAttribute("exp_acc");
    var expB = b.getAttribute("exp_acc");

    if(nameA < nameB) { rtnval = -1; }
    else if(nameA > nameB) { rtnval = 1; }
    else {
      rtnval = pointA - pointB;
      if(pointA == pointB) { 
        if(expA > expB) { rtnval = 1; } else { rtnval = -1; }
      }
    }
  }       
  else { //expID
      var expa = a.getAttribute("experiment_id");
      var expb = b.getAttribute("experiment_id");
      rtnval = expa - expb;
  }
  return rtnval;
}


function change_express_sort(mode) {
  express_sort_mode = mode;
  drawExpressionData();
}


function drawExpressionData() {
  //uses the current_express_probe data for drawing

  var expdiv = document.getElementById("express_div");
  if(!expdiv) return;
  clearKids(expdiv);

  if(!current_express_probe) return;
  var express = current_express_probe.getElementsByTagName("expression");

  var express_sort = new Array();
  for(var i=0; i<express.length; i++) {
    var type = express[i].getAttribute("type");
    //if(type == "norm") { express_sort.push(express[i]); }
    express_sort.push(express[i]);
  }
  express_sort.sort(express_sort_func);

  var svg = createSVG(740, 25 + (12*express_sort.length));
  expdiv.appendChild(svg);

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  svg.appendChild(g1);
  expdiv.appendChild(svg);

  var heading_text = "expression";
  var feature = current_express_probe.getElementsByTagName("feature")[0];
  if(feature) {
    var fsource = feature.getElementsByTagName("featuresource")[0];
    heading_text = "[" + fsource.getAttribute("name") + "]   " + feature.getAttribute("desc");
  }
  var region = current_express_probe.getElementsByTagName("express_region")[0];
  if(region) {
    var asm    = region.getAttribute("asm").toUpperCase();
    var chrom  = region.getAttribute("chrom");
    var start  = region.getAttribute("start");
    var end    = region.getAttribute("end");
    heading_text = "region: "+ asm + " " +chrom+ ":" +start+ ".." +end;
  }
  var heading = document.createElementNS(svgNS,'text');
  heading.setAttributeNS(null, 'x', '20px');
  heading.setAttributeNS(null, 'y', '18px');
  heading.setAttributeNS(null, "font-weight","bold");
  heading.setAttributeNS(null, "font-size","14pt");
  heading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  var tn1 = document.createTextNode(heading_text);
  heading.appendChild(tn1);
  g1.appendChild(heading);


  var max_value = 0;
  for(var i=0; i<express_sort.length; i++) {
    var exptype   = express_sort[i].getAttribute("type");
    var expname   = express_sort[i].getAttribute("exp_name");
    var normvalue = parseFloat(express_sort[i].getAttribute("value"));
    var detection = parseFloat(express_sort[i].getAttribute("sig_error"));
    if(normvalue > max_value) max_value = normvalue;
    
    var expname2 = expname.substring(0,41);
    if(expname != expname2) { expname = expname2 +"..."; }

    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '0px');
    text.setAttributeNS(null, 'y', ((i*12)+35) +'px');
    text.appendChild(document.createTextNode(expname));
    g1.appendChild(text);

    text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '270px');
    text.setAttributeNS(null, 'y', ((i*12)+35) +'px');
    text.appendChild(document.createTextNode(normvalue + '  (' + detection + ')  ' + exptype ));
    g1.appendChild(text);
  }
  for(var i=0; i<express_sort.length; i++) {
    var normvalue = express_sort[i].getAttribute("value");
    var detection = parseFloat(express_sort[i].getAttribute("sig_error"));
    var newvalue = (450 * normvalue) / max_value;

    //if((detection < 0.01) || (detection >0.99)) ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
    //else ctx.fillStyle = "rgba(170, 170, 170, 0.5)";
    //ctx.fillRect (270, i*12+2, newvalue, 10);

    var rect = document.createElementNS(svgNS,'rect');
    rect.setAttributeNS(null, 'x', '270px');
    rect.setAttributeNS(null, 'y', ((i*12)+26) +'px');
    rect.setAttributeNS(null, 'width', newvalue);
    rect.setAttributeNS(null, 'height', '11px');
    rect.setAttributeNS(null, 'opacity', "0.5");

    if((detection < 0.01) || (detection >0.99)) rect.setAttributeNS(null, 'fill', "rgb(0, 0, 200)");
    else rect.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");

    g1.appendChild(rect);

  }
} 

//----------------------------------------------
//
// somewhat generic functions which display an
// info box from an eeDB feature DOM
//
//----------------------------------------------

function displayProbeInfo() {
  // feature is an XML DOM document which holds the feature data

  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:330px; z-index:-10; "+
                    "background-color:rgb(245,255,255); border:inset; border-width:2px; padding: 3px 3px 3px 3px;\">";
  object_html += "<div style=\"font-weight:bold; \">expression probes</div>";

  for (var trackID in region_express_probes) {
    var xmlDoc = region_express_probes[trackID];
    if(!xmlDoc) { continue; }

    var glyphTrack = gLyphTrack_array[trackID];
    var title = "region";
    if(glyphTrack) { title = glyphTrack.title; }

    var region = xmlDoc.getElementsByTagName("express_region")[0];
    var asm    = region.getAttribute("asm").toUpperCase();
    var chrom  = region.getAttribute("chrom");
    var start  = region.getAttribute("start");
    var end    = region.getAttribute("end");

    object_html += "<div><a style=\"font-weight: bold;\" href=\"#\" onclick=\"changeRegionProbe('" +trackID+ "')\"  >";
    object_html += title + ": "+ asm + " " +chrom+ ":" +start+ ".." +end;
    object_html += "</a></div>";

    var experiments = xmlDoc.getElementsByTagName("expression")
    //document.getElementById("message").innerHTML = "experiments: " + experiments.length;
  }

  for(var i=0; i<feature_express_probes.length; i++) {
    var feature = feature_express_probes[i].getElementsByTagName("feature")[0];
    var fsource = feature.getElementsByTagName("featuresource")[0];

    var fid = feature.getAttribute("id");
    object_html += "<div><a style=\"font-weight: bold;\" href=\"#\" onclick=\"changeFeatureProbe('" +fid+ "')\"  >" 
                   + feature.getAttribute("desc")+"</a>";
    object_html += "<span style=\"font-size:9px;\">  [" + fsource.getAttribute("name") + "]</span>";
    object_html += "</div>";
  }

  object_html += "</div>";
  document.getElementById("probe_info").innerHTML= object_html;
}


function changeFeatureProbe(feature_id) {
  if(!feature_express_probes) { return; }
  
  for(var i=0; i<feature_express_probes.length; i++) {
    var probe = feature_express_probes[i];
    var feature = probe.getElementsByTagName("feature")[0];
    if(feature.getAttribute("id") == feature_id) {
      current_express_probe = probe;
    }
  }
  drawExpressionData();
}

function changeRegionProbe(region_trackID) {
  if(!region_express_probes) { return; }
  current_express_probe = region_express_probes[region_trackID];
  drawExpressionData();
}

//----------------------------------------------
// gLyphs generic section for working with
//  feature XML DOM
// and the <div id="feature_info"> element
//----------------------------------------------

function centerOnFeature(feature) {
  // feature is an XML DOM document which holds the feature data
  if(feature === undefined) { feature = current_feature; }

  var start = feature.getAttribute("start")-0;
  var end   = feature.getAttribute("end")-0;
  var range = end-start;
  start -= Math.round(range*.25);
  end += Math.round(range*.25);
  
  if(!current_region) {
    current_region = new Object();
    current_region.display_width = Math.floor(800);
    current_region.asm = eedbDefaultAssembly;
  }
  current_region.asm   = feature.getAttribute("asm");
  current_region.chrom = feature.getAttribute("chr");
  current_region.start = start;
  current_region.end   = end;
  reloadRegion();
}


function displayFeatureInfo(feature) {
  // feature is an XML DOM document which holds the feature data

  current_feature = feature;
  //document.getElementById("feature_info").innerHTML= "<div>does this work at least</div>";

  var fid   = feature.getAttribute("id");
  var peer  = feature.getAttribute("peer");
  var start = feature.getAttribute("start")-0;
  var end   = feature.getAttribute("end")-0;
  var range = end-start;
  start -= Math.round(range*.25);
  end += Math.round(range*.25);
  
  if(peer) { fid = peer +"::"+fid; }

  var fsource = feature.getElementsByTagName("featuresource")[0];
  var symbols = feature.getElementsByTagName("symbol");
  var mdata = feature.getElementsByTagName("mdata");
  var maxexpress = feature.getElementsByTagName("max_expression");
  var synonyms = "";
  var description = "";
  var entrez_id;
  var omim_id;
  var genloc = "";
  var chromloc = feature.getAttribute("asm").toUpperCase() +" "
                +feature.getAttribute("chr") +":"
                +feature.getAttribute("start") +".."
                +feature.getAttribute("end")
                +feature.getAttribute("strand");

  for(var i=0; i<mdata.length; i++) {
    if(mdata[i].getAttribute("type") == "description") description = mdata[i].firstChild.nodeValue;
  }
  for(var i=0; i<symbols.length; i++) {
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
    if(symbols[i].getAttribute("type") == "OMIM") omim_id = symbols[i].getAttribute("value");
    if(symbols[i].getAttribute("type") == "GeneticLoc") genloc = symbols[i].getAttribute("value");
    if(symbols[i].getAttribute("type") == "TFsymbol") synonyms += symbols[i].getAttribute("value");
  }
  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:350px; z-index:-10; "+
                    "background-color:rgb(220,220,255); border:inset; border-width:2px; padding: 3px 3px 3px 3px;\">";
  object_html += "<span style=\"font-size:12px; font-weight: bold;\">" + 
                 "<a target=\"top\" href=\"../view/#" + fid +"\">"+
                  feature.getAttribute("desc")+"</a></span>";
  object_html += " <span style=\"font-size:9px;\">" + fsource.getAttribute("category") +" : " + fsource.getAttribute("name") + "</span>";
  if(description.length > 0) object_html += "<div>" +description + "</div>";
  object_html += "<p></p>";
  if(synonyms.length > 0) object_html += "<div>alias: " + synonyms +"</div>";
  if(entrez_id || omim_id) {
    object_html += "<div>";
    if(entrez_id) object_html += "EntrezID:<a target=\"entrez\" "
                              + "href=\"http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene&#038;cmd=Retrieve&#038;dopt=full_report&#038;list_uids=" +entrez_id +"\""
                              +  ">" + entrez_id +"</a> ";
    if(omim_id) object_html += "OMIM:<a target=\"OMIM\" "
                            + "href=\"http://www.ncbi.nlm.nih.gov/entrez/dispomim.cgi?id=" 
                            + omim_id + "\">" + omim_id +"</a>";
    object_html += "</div>";
  }
  object_html += "<div>location: " + genloc + " ::  <a href=\"#\"  onclick=\"centerOnFeature();\">" + chromloc + "</a></div>";
  object_html += "<div>maxexpress: ";
  if(maxexpress && (maxexpress.length > 0)) {
    var express = maxexpress[0].getElementsByTagName("express");
    for(var i=0; i<express.length; i++) {
      var platform = express[i].getAttribute("platform");
      if(platform == 'Illumina microarray') { platform = "ILMN"; }
      object_html += platform + ":" + express[i].getAttribute("maxvalue") + " ";
    }
  }
  object_html += "</div></div>";
  document.getElementById("feature_info").innerHTML= object_html;
  //document.getElementById("feature_info").innerHTML= description;
}

//-------------------------------------------------------------------
//
// some controls for working with expression/experiment filters
//
//-------------------------------------------------------------------

function changeExpressRegionConfig(type, value, widget) {
  var need_to_reload = 0;

  //document.getElementById("message").innerHTML = "changeExpressRegionConfig: type["+type+"]  value["+value+"]";

  if(type =="dwidth") {
    var new_width = Math.floor(value);
    if(new_width < 640) { new_width=640; }
    if(new_width != current_region.display_width) { need_to_reload=1; }
    current_region.display_width = new_width;
  }

  if(need_to_reload == 1) { redrawRegion(); }
}

function toggleTrackHide(trackID) {
  var gylphTrack = gLyphTrack_array[trackID];
  if(!gylphTrack) { return; }
  gylphTrack.hideTrack = !(gylphTrack.hideTrack);
  drawTrack(trackID);
}

//--------------------------------------------------------
//
//
//       EEDB gLyphs genomic visualization toolkit
//
//
//--------------------------------------------------------

function gLyphTracksInit(gLyphTrackSetID) {

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var titlediv = document.getElementById("gLyphs_title");
  titlediv.innerHTML = current_region.title;

  var glyphset = document.getElementById(gLyphTrackSetID);
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
    glyphTrack.peerName   = trackDiv.getAttribute("peer");
    glyphTrack.sources    = sourceName;
    glyphTrack.server     = trackDiv.getAttribute("server");
    glyphTrack.serverType = trackDiv.getAttribute("server_type");
    glyphTrack.glyphStyle = trackDiv.getAttribute("glyph");
    glyphTrack.exptype    = trackDiv.getAttribute("exptype");
    glyphTrack.expfilter  = "";
    glyphTrack.maxlevels  = Math.floor(trackDiv.getAttribute("levels"));
    glyphTrack.logscale   = 0;
    glyphTrack.submode    = "5end";
    glyphTrack.binning    = "sum";

    gLyphTrack_array[trackID] = glyphTrack;
    drawTrack(trackID);
  }

  createAddTrackTool();

  //
  // first get defaults from the XHTML document
  //
  var loc = glyphset.getAttribute("loc");
  var fid = glyphset.getAttribute("feature");
  
  //
  // then initialize the history toolkit
  // and check if URL has config startup
  //
  dhtmlHistory.initialize();
  dhtmlHistory.addListener(gLyphsHandleHistoryChange);
  var initialURL = dhtmlHistory.getCurrentLocation();
  if(initialURL && parseConfigFromURL(initialURL)) {}
  else {
    if(fid && !loc) { loadFeatureInfo(fid); }
    if(loc) { 
      gLyphsInitLocation(loc); 
      if(fid) { loadFeatureInfo(fid); }
    }
  }
}


function gLyphsInitLocation(str) {
  if(!current_region) {
    current_region = new Object();
    current_region.display_width = Math.floor(800);
    current_region.asm = eedbDefaultAssembly;
  }

  var re1 = /^(.+)\:\:(.+)$/;
  var asm_match = re1.exec(str);
  if(asm_match && (asm_match.length == 3)) {
    current_region.asm = asm_match[1];
    str = asm_match[2];
    //document.getElementById("message").innerHTML += "loc with assembly["+current_region.asm+"] -- "+str;
  } else {
    current_region.asm = eedbDefaultAssembly;
    //document.getElementById("message").innerHTML += "use default assembly["+eedbDefaultAssembly+"] - "+str;
  }

  var re = /^(.+)\:(\d+)\.\.(\d+)$/;
  var mymatch = re.exec(str);
  if(mymatch && (mymatch.length == 4)) {
    //document.getElementById("message").innerHTML = "submit loc: " + str;
    current_region.chrom = mymatch[1];
    current_region.start = Math.floor(mymatch[2]);
    current_region.end   = Math.floor(mymatch[3]);

    document.getElementById('genome_region_div').style.display = 'block';
    eedbEmptySearchResults();
    reloadRegion();
  }
}

function parseConfigFromURL(urlConfig) {
  //document.getElementById("message").innerHTML += "parseConfigFromURL";
  if(!urlConfig) { return false; }
  var params = urlConfig.split(";");
  for(var i=0; i<params.length; i++) {
    var param = params[i];
    var tagvalue = param.split("=");
    if(tagvalue.length != 2) { continue; }
    if(tagvalue[0] == "config") {
      gLyphsInitConfigUUID(tagvalue[1]);
      return true;
    }
    if(tagvalue[0] == "loc") {
      gLyphsInitLocation(tagvalue[1]);
      return true;
    }
  }
  return false;
}

function gLyphsHandleHistoryChange(newLocation, historyData) {
  if(!parseConfigFromURL(newLocation)) { return false; }
  //document.getElementById("message").innerHTML = "gLyphsHandleHistoryChange";
  eedbEmptySearchResults();
  reloadRegion();
}

function redrawRegion() {
  var glyphset = document.getElementById("gLyphTrackSet");
  glyphset.setAttribute("style", 'width: '+ (current_region.display_width+10) +'px;');

  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }
    if(glyphTrack.glyphStyle == "express") {
      prepareTrackXHR(trackID);
    } else {
      drawTrack(trackID);
    }
  }
}


function reloadRegion() {
  var dwidth = current_region.display_width;
  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var len    = end-start;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }

  var chromloc = chrom +":" + start + ".." + end;

  document.getElementById("svgTestArea2").innerHTML = asm.toUpperCase() + " " + chromloc + "  [len "+ len + " ]";

  var glyphset = document.getElementById("gLyphTrackSet");
  glyphset.setAttribute("style", 'width: '+ (dwidth+10)+'px;');

  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    showTrackLoading(trackID);
  }
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    prepareTrackXHR(trackID);
  }
}


function prepareTrackXHR(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  //trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  showTrackLoading(trackID);

  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var chromloc = chrom +":" + start + ".." + end;

  var peerName   = glyphTrack.peerName;
  var sourceName = glyphTrack.sources;
  var server     = glyphTrack.server;
  var serverType = glyphTrack.serverType;
  var glyphStyle = glyphTrack.glyphStyle;
  var exptype    = glyphTrack.exptype;
  var logscale   = glyphTrack.logscale;
  var submode    = glyphTrack.submode;
  var binning    = glyphTrack.binning;
  var expfilter  = glyphTrack.expfilter;

  var dwidth     = current_region.display_width;
  
  if(glyphTrack.peerName && !(glyphTrack.peer)) {
    var peer = eedbGetPeer(glyphTrack.peerName);
    if(peer) { glyphTrack.peer = peer; } 
  }

  var url = eedbRegionURL;
  if(glyphTrack.peer) {
    var webURL = glyphTrack.peer.getAttribute("web_url");
    //document.getElementById("message").innerHTML = "peer web:: " + webURL;
    if(webURL) { url = webURL + "/cgi/eedb_region.cgi"; }
  } else if((serverType == "eedb") && server) {
    //url = server + "/cgi/eedb_region.cgi";
  }
  url += "?asm=" + current_region.asm ;
  if(sourceName) { url += ";types=" + sourceName; }
  if(exptype) { url += ";exptype=" + exptype; }
  url += ";log=" + logscale; 
  
  if(glyphStyle && (glyphStyle=='cytoband')) { url += ";chrom=" + chrom; }
  else { url += ";loc=" + chromloc; }

  if(glyphStyle && (glyphStyle=='express_iframe')) {
    url += ";width="+dwidth;
    url += ";format=svg;mode=express;submode=" + submode;
    if(expfilter) { url += ";expfilter=" + expfilter; }
    var iframe_html = "<iframe width='"+dwidth+"px' height='120px' scolling='no' src=\"" + url + "\" />";
    trackDiv.innerHTML= iframe_html;
    return;
  }
  else if(glyphStyle && (glyphStyle=='express')) {
    url += ";width="+dwidth;
    url += ";format=xml;mode=express;submode=" + submode + ";binning=" + binning;
    if(expfilter) { url += ";expfilter=" + expfilter; }
  }
  else if(glyphStyle && (glyphStyle=='transcript' || glyphStyle=='probesetloc')) {
    url += ";format=xml;submode=subfeature";
  } else {
    url += ";format=xml";
  }
  //if(glyphStyle && (glyphStyle=='cytoband')) { document.getElementById("message").innerHTML = url; }
  //if(glyphStyle && (glyphStyle=='express')) { document.getElementById("message").innerHTML = url; }

  var gylphTrack = gLyphTrack_array[trackID];

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  var xhrObj        = new Object;
  xhrObj.trackID    = trackID;
  xhrObj.xhr        = xhr;
  xhrObj.asm        = current_region.asm;
  xhrObj.start      = current_region.start;
  xhrObj.end        = current_region.end;
  xhrObj.chrom      = current_region.chrom;
  xhrObj.trackDiv   = trackDiv;

  trackXHR_array[trackID] = xhrObj;

  //damn this is funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { drawTrack(id); };}(trackID);
  xhr.open("GET",url,true);
  xhr.send(null);
}


function regionChange(mode) {
  var asm   = current_region.asm;
  var start = current_region.start;
  var end   = current_region.end;
  var range = end-start;

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
      start = current_feature.getAttribute("start")-0;
      end   = current_feature.getAttribute("end")-0;
      var range = end-start;
      start -= Math.round(range*.25);
      end += Math.round(range*.25);
    }
  }
  if(start<0) { start = 0; }

  current_region.start = start;
  current_region.end   = end;

  reloadRegion();
}


function showTrackLoading(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var svg = glyphTrack.svg;
  if(!svg) return;

  var tobj = document.createElementNS(svgNS,'text');
  tobj.setAttributeNS(null, 'x', (current_region.display_width/2)+'px');
  tobj.setAttributeNS(null, 'y', '9px');
  tobj.setAttributeNS(null, "font-size","10px");
  tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  tobj.setAttributeNS(null, 'style', 'fill: red;');
  var textNode = document.createTextNode("track reloading");
  tobj.appendChild(textNode);

  svg.appendChild(tobj);
} 


function drawTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var xhrObj = trackXHR_array[trackID];
  if(glyphTrack.hideTrack || (xhrObj == null)) { 
    clearKids(glyphTrack.trackDiv)
    var svg = createSVG(current_region.display_width+10, 13);
    glyphTrack.svg = svg;
    var g1 = document.createElementNS(svgNS,'g');
    svg.appendChild(g1);
    glyphTrack.trackDiv.appendChild(svg);
    drawHeading(glyphTrack);
    createMoveBar(glyphTrack);
    return;
  }

  var xhr = xhrObj.xhr;
  if(xhr == null) { return; }
  if(xhr.readyState!=4) return;
  if(xhr.status!=200) { return; }
  if(xhr.responseXML == null) return;

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    document.getElementById("message").innerHTML= 'Problem with central DB!';
    return;
  }
  //document.getElementById("message").innerHTML += ' draw:' + trackID;
  xhrObj.xmlDoc = xmlDoc;

  // get the chrom object
  if(xmlDoc.getElementsByTagName("chrom")) {
    var chrom = xmlDoc.getElementsByTagName("chrom")[0];
    current_region.chromXML = chrom;
  }

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphStyle == "express") { 
    drawExpressTrack(glyphTrack, xhrObj);
  } else {
    drawFeatureTrack(glyphTrack, xhrObj);
  }
  createMoveBar(glyphTrack);
}

//------------------------
//
// feature tracks
//
//------------------------

function drawFeatureTrack(glyphTrack, xhrObj) {
  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhrObj.xmlDoc;
  var trackDiv   = glyphTrack.trackDiv;
  var glyphStyle = glyphTrack.glyphStyle;

  var maxlevels = glyphTrack.maxlevels;
  var levelHeight = 10;
  if(glyphStyle == "transcript") { levelHeight=6; }
  if(glyphStyle == "probesetloc") { levelHeight=6; }

  if(glyphStyle == "cytoband") { 
    glyphTrack.title = current_region.asm.toUpperCase()  + " " + current_region.chrom;
  }

  //
  // clear and prep the SVG
  // to use bbox I need to attach to an SVG DOM tree
  // so a create e tmp svg of height 1
  // then I can move the tree over to the main view
  //
  var dwidth = current_region.display_width;
  var tmp_svg = createSVG(dwidth+10, 1); //offscreen basically, height does not matter
  var g1 = document.createElementNS(svgNS,'g');

  //
  // get the chrom object
  //
  if(xmlDoc.getElementsByTagName("chrom")) {
    var chrom = xmlDoc.getElementsByTagName("chrom")[0];
    current_region.chromXML = chrom;;
    if(glyphStyle == "cytoband") { 
      //title = chrom.getAttribute("asm").toUpperCase()  + " " + chrom.getAttribute("chr");
      levelHeight=34;
    }
  }

  //
  // get the top features from the XML
  //
  var features = xmlDoc.getElementsByTagName("feature");
  var feature_array = new Array();
  for(var i=0; i<features.length; i++) {
    var feature = features[i];
    if(feature.parentNode.tagName != "region") { continue; }
    feature_array.push(feature);
  }
  if((glyphStyle!="arrow") && (feature_array.length > 1000)) { glyphStyle = "thin"; }
  if(glyphStyle=="thin") { levelHeight=3; }

  //
  // then generate the glyphs (without tracking)
  // to use bbox I need to attach to an SVG DOM tree
  // then I can move the tree over to the main view
  //
  //document.getElementById("message").innerHTML= 'track:' + sourceName + " fcnt: " + feature_array.length + " style:"+glyphStyle;
  for(var i=0; i<feature_array.length; i++) {
    var feature = feature_array[i];
    var glyph = drawFeature(xhrObj, feature, glyphStyle);
    feature.glyphObj = glyph; 
    if(glyph) { g1.appendChild(glyph); }
  }
  //SVG does live update with each element added so add the block at the end
  clearKids(trackDiv)
  trackDiv.appendChild(tmp_svg);
  tmp_svg.appendChild(g1);
  
  //
  // then determine the levels
  //
  var level_span = new Array();
  for(var i=0; i<feature_array.length; i++) {
    var feature = feature_array[i];
    var glyph = feature.glyphObj; 
    if(!glyph) { continue; }
    var bbox = glyph.getBBox();

    var fs = bbox.x;
    var fe = bbox.x + bbox.width;

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
    feature.setAttribute('glyph_level', level);
    level_span[level] = fe+5;
  }
  maxlevels = level_span.length;

  //
  // then build the actual properly tracked view block
  //
  var svg = createSVG(dwidth+10, 13+(maxlevels*levelHeight));
  glyphTrack.svg = svg;
  trackDiv.removeChild(tmp_svg);
  trackDiv.appendChild(svg);
  for(var i=0; i<feature_array.length; i++) {
    var feature = feature_array[i];
    var level   = feature.getAttribute('glyph_level'); 

    var glyph = feature.glyphObj; 
    if(!glyph) { continue; }

    glyph.setAttributeNS(null, 'transform', "translate(0,"+ (2+level*levelHeight)+ ")");

    var fid  = feature.getAttribute('id'); 
    var peer = feature.getAttribute('peer'); 
    if(peer) { fid = peer + "::" + fid; }

    glyph.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +fid+ "\");");
    glyph.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    glyph.setAttributeNS(null, "onclick", "eedbClearSearchTooltip();loadFeatureInfo(\"" +fid+ "\");");
  }
  drawHeading(glyphTrack);
  if(glyphStyle == "cytoband") { 
    var glyph1 = drawCytoSpan(xhrObj);
    var glyph2 = drawChromScale(xhrObj);
    g1.appendChild(glyph1);
    g1.appendChild(glyph2);
  }

  tmp_svg.removeChild(g1);
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  svg.appendChild(g1);
}


function drawFeature(xhrObj, feature, glyphStyle) {
  var dwidth     = current_region.display_width;
  var chrom      = xhrObj.chrom;
  var start      = xhrObj.start;
  var end        = xhrObj.end;
  var chromloc   = chrom +":" + start + ".." + end;

  if(glyphStyle == "cytoband") { 
    //drawing whole chromosome
    var chromXML = current_region.chromXML;
    start = 0;
    end = chromXML.getAttribute('length'); 
  }

  var fname    = feature.getAttribute('desc'); 
  var category = feature.getAttribute('category'); 
  var strand   = feature.getAttribute('strand'); 
  var fs       = feature.getAttribute('start'); 
  var fe       = feature.getAttribute('end'); 
  var fid      = feature.getAttribute('id'); 
  var peer     = feature.getAttribute('peer'); 
  if(peer) { fid = peer + "::" + fid; }

  var xfs = dwidth*(fs-start)/(end-start); 
  var xfe = dwidth*(fe-start)/(end-start); 
  if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
  var len = xfe-xfs;
  var xc  = (xfe+xfs)/2;
  if(strand =="+") {xpos = xfe;} else {xpos = xfs;}

  var glyph = null;
  if(glyphStyle == "centroid") { glyph = drawCentroid(xfs, xfe, strand, xc); } 
  if(glyphStyle == "cytoband") { glyph = drawCytoBand(xfs, xfe, strand, fname); } 
  if(glyphStyle == "box") { glyph = drawBox(xfs, xfe, strand); } 
  if(glyphStyle == "arrow") { glyph = drawArrow(xpos, strand); }
  if(glyphStyle == "subfeature") { glyph = drawBox(xfs, xfe, strand); } 
  if(glyphStyle == "exon") { glyph = drawExon(xfs, xfe, strand); } 
  if(glyphStyle == "utr") { glyph = drawUTR(xfs, xfe, strand); } 
  if(glyphStyle == "thin") { glyph = drawThin(xfs, xfe, strand); } 
  if(glyphStyle == "transcript" || glyphStyle=='probesetloc') { 
    glyph = drawLine(xfs, xfe, strand); 

    // now for loop on the sub features
    var subfeats = feature.getElementsByTagName("feature");
    //document.getElementById("message").innerHTML += fname + " has " + (subfeats.length) +" subfs; ";
    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      if((subfeature.getAttribute('category') != "exon") && (subfeature.getAttribute('category') != "block")) { continue; }
      var sub_glyph = drawFeature(xhrObj, subfeature, "exon"); 
      if(sub_glyph) { glyph.appendChild(sub_glyph); }
    } 
    for(var j=0; j<subfeats.length; j++) {  
      var subfeature = subfeats[j];
      if(!(subfeature.getAttribute('category').match(/utr/))) { continue; }
      var sub_glyph = drawFeature(xhrObj, subfeature, "utr"); 
      if(sub_glyph) { glyph.appendChild(sub_glyph); }
    } 
  }

  if(glyph && !(glyphStyle.match(/utr/)) 
           && !(glyphStyle == 'exon') 
           && !(glyphStyle == 'thin') 
           && !(glyphStyle == 'arrow') 
	   && !(glyphStyle == "cytoband")) { 
    var tobj = document.createElementNS(svgNS,'text');
    if(xfs>0) { 
      tobj.setAttributeNS(null, 'text-anchor', 'end' );
      tobj.setAttributeNS(null, 'x', xfs-1 );
    } else { 
      tobj.setAttributeNS(null, 'text-anchor', 'start' );
      tobj.setAttributeNS(null, 'x', xfe+2 );
    }
    if(glyphStyle == "transcript" || glyphStyle=='probesetloc') { 
      tobj.setAttributeNS(null, 'y', '16px');
      tobj.setAttributeNS(null, "font-size","7px"); 
    } else { 
      tobj.setAttributeNS(null, 'y', '18px');
      tobj.setAttributeNS(null, "font-size","10px"); 
    }
    tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    tobj.setAttributeNS(null, 'style', 'fill: black;');
    tobj.appendChild(document.createTextNode(fname));
    glyph.appendChild(tobj);
  }

  //if(!glyph) { glyph = drawCentroid(xfs, xfe, strand, xc); } 

  return glyph;
}

//--------------------------------------
//
// expression tracks
//
//--------------------------------------

function drawExpressTrack(glyphTrack, xhrObj) {
  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;
  var trackDiv   = glyphTrack.trackDiv;
  var glyphStyle = glyphTrack.glyphStyle;
  var trackID    = glyphTrack.trackID;

  add_region_express(trackID, xmlDoc);

  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }

  var maxlevels = glyphTrack.maxlevels;
  if(!maxlevels || maxlevels < 10) { maxlevels = 10; }
  xhrObj.maxlevels = maxlevels;  //for drawExpressBin() routine

  //<express_region binspan="20.694" max_express="743.426"/>
  var express_params = xmlDoc.getElementsByTagName("express_region")[0];
  xhrObj.binspan     = express_params.getAttribute("binspan");
  //xhrObj.max_express = express_params.getAttribute("max_express");

  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var svg = createSVG(current_region.display_width+10, 13+(maxlevels));
  glyphTrack.svg = svg;
  trackDiv.appendChild(svg);
  var g1 = document.createElementNS(svgNS,'g');

  // make a backing rectangle to capture the selection events
  var backRect = document.createElementNS(svgNS,'rect');
  backRect.setAttributeNS(null, 'x', '0px');
  backRect.setAttributeNS(null, 'y', '13px');
  backRect.setAttributeNS(null, 'width',  current_region.display_width+'px');
  backRect.setAttributeNS(null, 'height', maxlevels+'px');
  backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); 
  backRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  g1.appendChild(backRect);

  var selectRect = document.createElementNS(svgNS,'rect');
  selectRect.setAttributeNS(null, 'x', '0px');
  selectRect.setAttributeNS(null, 'y', '13px');
  selectRect.setAttributeNS(null, 'width',  '0px');
  selectRect.setAttributeNS(null, 'height', glyphTrack.maxlevels+'px');
  selectRect.setAttributeNS(null, 'style', 'fill: lightgray;');
  selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
  selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
  selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  g1.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;

  //
  // calculate the max bin size
  //
  var expressbins = xmlDoc.getElementsByTagName("expressbin");
  var max_express = 0.0;
  for(var i=0; i<expressbins.length; i++) {
    var expressbin = expressbins[i];
    var sense      = expressbin.getAttribute('sense') *1.0; 
    var antisense  = expressbin.getAttribute('antisense') *1.0; 
    if(sense > max_express) { max_express = sense; }
    if(antisense > max_express) { max_express = antisense; }
  }
  xhrObj.max_express = max_express;

  //
  // then generate the expression glyphs
  //
  for(var i=0; i<expressbins.length; i++) {
    var expressbin = expressbins[i];
    var glyph = drawExpressBin(xhrObj, expressbin, glyphStyle);
    glyph.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    glyph.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    glyph.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    if(glyph) { g1.appendChild(glyph); }
  }
  new_title = title + " [max "+ xhrObj.max_express ;
  if(glyphTrack.logscale==1) { new_title += " log"; }
  new_title += "]";
  new_title += " " + glyphTrack.exptype;
  new_title += " " + glyphTrack.binning;
  glyphTrack.title = new_title;
  drawHeading(glyphTrack);
  glyphTrack.title = title;
  
  drawSelection(glyphTrack);

  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  svg.appendChild(g1);
}


function drawExpressBin(xhrObj, expressbin, glyphStyle) {
  var dwidth        = current_region.display_width;
  var chrom         = xhrObj.chrom;
  var start         = xhrObj.start;
  var end           = xhrObj.end;
  var chromloc      = chrom +":" + start + ".." + end;
  var maxlevels     = xhrObj.maxlevels;
  var max_express   = xhrObj.max_express;

  maxlevels = maxlevels / 2.0;

  // <expressbin bin="327" start="157176034" total="2.933" sense="2.784" antisense="0.149"/>
  var bin         = expressbin.getAttribute('bin'); 
  var start       = expressbin.getAttribute('start'); 
  var sense       = expressbin.getAttribute('sense') + 0.0; 
  var antisense   = expressbin.getAttribute('antisense') +0.0; 

  var y_up   = maxlevels * sense / max_express;
  var y_down = maxlevels * antisense / max_express;

  //#$g1->line( x1=>$x, x2=>$x, y1=>65, y2=>(65-$y_up), style => { 'stroke-width'=>'1.5', stroke=>'green' } );
  //#$g1->line( x1=>$x, x2=>$x, y1=>65, y2=>(65+$y_down), style => { 'stroke-width'=>'1.5', stroke=>'purple' } );
  //$g1->rectangle( x=>$x, width=>1, y=>(64-$y_up), height=>$y_up, style => { stroke=>'green', fill=>'green' } );
  //$g1->rectangle( x=>$x, width=>1, y=>65, height=>$y_down, style => { stroke=>'purple', fill=>'purple' } );

  var glyph = null;
  if(glyphStyle == "express") { 
    var g2 = document.createElementNS(svgNS,'g');
    g2.appendChild(drawBar(bin, y_up,   13+maxlevels, "+")); 
    g2.appendChild(drawBar(bin, y_down, 13+maxlevels, "-")); 
    glyph = g2;
  }

  return glyph;
}

//----------------------------------------------
//
// gLyphs toolbox methods. low level object 
// creation and manipulation
//
//----------------------------------------------

function createSVG(width, height) {
  //<svg id="svgTestArea2" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width='640px' height='50px'></svg>
  var svg = document.createElementNS(svgNS,'svg');
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', height+'px');
  svg.setAttributeNS(null, "xlink", "http://www.w3.org/1999/xlink");

  //var rect = document.createElementNS(svgNS,'rect');
  //rect.setAttributeNS(null, 'x', '0px');
  //rect.setAttributeNS(null, 'y', '0px');
  //rect.setAttributeNS(null, 'width',  width+'px');
  //rect.setAttributeNS(null, 'height', height+'px');
  //rect.setAttributeNS(null, 'style', 'fill: pink;'); 
  //svg.appendChild(rect);

  return svg;
}


function clearKids(obj) {
  var count=0;
  while(obj.firstChild) {
    //The list is LIVE so it will re-index each call
    obj.removeChild(obj.firstChild);
    count++;
  }
  //document.getElementById("message").innerHTML= "cleared " +count+ " elements"; 
}


function drawArrow1(x, len, strand, track) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var arrow = document.createElementNS(svgNS,'polygon');
  if(len<5) len=5;
  //arrow.setAttributeNS(null, 'points', (x-len)+' 14.5,' +(x+5)+' 14.5,' +x+' 10,' +(x+10)+' 15,' +x+' 20,' +(x+5)+' 15.5,' +(x-len)+' 15.5');
  if(strand == '+') {
    arrow.setAttributeNS(null, 'points', x+' 15,' +(x-10)+' 10,' +(x-5)+' 14.5,' +(x-len)+' 14.5,' +(x-len)+' 15.5,' +(x-5)+' 15.5,' +(x-10)+' 20');
    arrow.setAttributeNS(null, 'style', 'fill: green;');
  }
  if(strand == '-') {
    arrow.setAttributeNS(null, 'points', x+' 15,' +(x+10)+' 10,' +(x+5)+' 14.5,' +(x+len)+' 14.5,' +(x+len)+' 15.5,' +(x+5)+' 15.5,' +(x+10)+' 20');
    arrow.setAttributeNS(null, 'style', 'fill: purple;');
  }

  var g2 = document.createElementNS(svgNS,'g');
  g2.appendChild(arrow);
  return g2;
}


function drawArrow2(x, len, strand, track) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var arrow = document.createElementNS(svgNS,'polygon');
  if(len<5) len=5;
  //arrow.setAttributeNS(null, 'points', (x-len)+' 14.5,' +(x+5)+' 14.5,' +x+' 10,' +(x+10)+' 15,' +x+' 20,' +(x+5)+' 15.5,' +(x-len)+' 15.5');
  if(strand == '+') {
    arrow.setAttributeNS(null, 'points', x+' 15,' +(x-10)+' 10,' +(x-5)+' 14.5,' +(x-len)+' 14.5,' +(x-len)+' 15.5,' +(x-5)+' 15.5,' +(x-10)+' 20');
    arrow.setAttributeNS(null, 'style', 'fill: green;');
  }
  if(strand == '-') {
    arrow.setAttributeNS(null, 'points', x+' 15,' +(x+10)+' 10,' +(x+5)+' 14.5,' +(x+len)+' 14.5,' +(x+len)+' 15.5,' +(x+5)+' 15.5,' +(x+10)+' 20');
    arrow.setAttributeNS(null, 'style', 'fill: purple;');
  }

  var g2 = document.createElementNS(svgNS,'g');
  g2.appendChild(arrow);
  return g2;
}


function drawCentroid(start, end, strand, center) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }

  var block = document.createElementNS(svgNS,'polyline');
  //block.setAttributeNS(null, 'points', start+' 14.5,' +end+' 14.5,' +end+' 15.5,' +start+' 15.5');
  block.setAttributeNS(null, 'points', start+',15 ' +end+',15 ');
  block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 2px;');
  g2.appendChild(block);

  var arrow = document.createElementNS(svgNS,'polygon');
  if(strand == '+') {
    arrow.setAttributeNS(null, 'points', (center+5)+' 15,' +(center-5)+' 10,' +(center)+' 15,' +(center-5)+' 20');
  }
  if(strand == '-') {
    arrow.setAttributeNS(null, 'points', (center-5)+' 15,' +(center+5)+' 10,' +(center)+' 15,' +(center+5)+' 20');
  }
  g2.appendChild(arrow);
  return g2;
}


function drawArrow(center, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }

  var arrow = document.createElementNS(svgNS,'polygon');
  if(strand == '+') {
    arrow.setAttributeNS(null, 'points', (center+5)+' 15,' +(center-5)+' 10,' +(center)+' 15,' +(center-5)+' 20');
  }
  if(strand == '-') {
    arrow.setAttributeNS(null, 'points', (center-5)+' 15,' +(center+5)+' 10,' +(center)+' 15,' +(center+5)+' 20');
  }
  g2.appendChild(arrow);
  return g2;
}


function drawBox(start, end, strand) {
  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 14.5,' +end+' 14.5,' +end+' 15.5,' +start+' 15.5');
  block.setAttributeNS(null, 'style', 'fill: gray;');
  g2.appendChild(block);
  return g2;
}


function drawLine(start, end, strand) {
  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',13.5 ' +end+',13.5 ');
  block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.5px;');
  g2.appendChild(block);
  return g2;
}


function drawExon(start, end, strand) {
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 15.5,' +start+' 15.5');
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}


function drawUTR(start, end, strand) {
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11,' +end+' 11,' +end+' 16,' +start+' 16');
  block.setAttributeNS(null, 'style', 'stroke: black; fill: none; stroke-width: 1.5px;');
  return block;
}


function drawCytoBand(start, end, strand, name) {
  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 10,' +end+' 10,' +end+' 20,' +start+' 20');
  if(strand == "+") { block.setAttributeNS(null, 'style', 'fill: gray;'); }
  else { block.setAttributeNS(null, 'style', 'fill: lightgray;'); }
  g2.appendChild(block);

  var tobj = document.createElementNS(svgNS,'text');
  tobj.setAttributeNS(null, 'x', 1+start+'px');
  tobj.setAttributeNS(null, 'y', '18px');
  tobj.setAttributeNS(null, "font-size","10px");
  tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  var textNode = document.createTextNode(name);
  tobj.appendChild(textNode);
  g2.appendChild(tobj);

  //document.getElementById("message").innerHTML += " ;"+name; 
  return g2;
}


function drawCytoSpan(xhrObj) {
  var dwidth   = current_region.display_width;
  var chromXML = current_region.chromXML;
  var fs       = xhrObj.start;
  var fe       = xhrObj.end;
  var start    = 0;
  var end      = chromXML.getAttribute('length'); 

  var xfs = dwidth*(fs-start)/(end-start); 
  var xfe = dwidth*(fe-start)/(end-start); 

  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', xfs+' 11,' +xfe+' 11,' +xfe+' 23,' +xfs+' 23');
  block.setAttributeNS(null, 'style', 'stroke:red; fill: none; stroke-width: 1.5px;');
  g2.appendChild(block);
  return g2;
} 


function drawChromScale(xhrObj) {
  var dwidth   = current_region.display_width;
  var chromXML = current_region.chromXML;
  var start    = xhrObj.start;
  var end      = xhrObj.end;
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


function drawHeading(glyphTrack) {

  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }

  var closeWidget = createCloseTrackWidget(glyphTrack.trackID);
  closeWidget.setAttributeNS(null, 'transform', "translate(" + current_region.display_width + ",0)");
  glyphTrack.svg.appendChild(closeWidget);

  createHideTrackWidget(glyphTrack);

  createConfigTrackWidget(glyphTrack);

  //
  // and now the title
  //
  var obj = document.createElementNS(svgNS,'text');
  obj.setAttributeNS(null, 'x', '20px');
  obj.setAttributeNS(null, 'y', '9px');
  obj.setAttributeNS(null, "font-size","10");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  obj.appendChild(document.createTextNode(title));

  glyphTrack.svg.appendChild(obj);
}


function drawSelection(glyphTrack) {
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

  var xfs   = dwidth*(fs-start)/(end-start);
  var xfe   = dwidth*(fe-start)/(end-start);
  var width = xfe-xfs+1;
  
  selection.xmiddle = 10 + (xfe + xfs)/2;

  selectRect.setAttributeNS(null, 'x', xfs+'px');
  selectRect.setAttributeNS(null, 'width',  width+'px');

  //document.getElementById("message").innerHTML = "drawselect"; 

  createMagnifyRegionWidget(glyphTrack);
}


function drawThin(start, end, strand) {
  var g2 = document.createElementNS(svgNS,'g');

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11 ' +end+',11 ');
  if(strand == '+') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: purple;'); }
  g2.appendChild(block);
  return g2;
}

function drawBar(pos, height, middle, strand) {
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
  return bar;
}

//---------------------------------------------------------
//
// widget creation section
// use svg and events to create "widgets" inside the tracks
// to allow users to manipulate the tracks
//
//---------------------------------------------------------

function createAddTrackTool() {
  var glyphset = document.getElementById("gLyphTrackSet");

  var div = document.createElement('div');
  div.setAttribute("align","left");
  div.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
  div.id = "glyphTrack" + (newTrackID++);

  var svg = createSVG(50, 25);
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttributeNS(null, 'title', 'add new track');
  div.appendChild(svg);

  var polyback = document.createElementNS(svgNS,'polygon');
  polyback.setAttributeNS(null, 'points', '0,0 8,0 8,21 0,14');
  polyback.setAttributeNS(null, 'style', 'fill: mediumslateblue;');
  polyback.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g2.appendChild(polyback);

  polyback = document.createElementNS(svgNS,'polygon');
  polyback.setAttributeNS(null, 'points', '8,0 16,0 16,14 8,21');
  polyback.setAttributeNS(null, 'style', 'fill: slateblue;');
  polyback.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g2.appendChild(polyback);

  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', '8px');
  circle.setAttributeNS(null, 'cy', '8px');
  circle.setAttributeNS(null, 'r',  '5px');
  circle.setAttributeNS(null, 'fill', 'lightgray');
  circle.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g2.appendChild(circle);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'points', '4,8 12,8 8,8 8,4 8,12 8,8');
  line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: darkslateblue;');
  line.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g2.appendChild(line);

  svg.appendChild(g2);
  glyphset.appendChild(div);

  return div;
}


function createHideTrackWidget(glyphTrack) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 'close track');

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;');
  rect.setAttributeNS(null, "onclick", "toggleTrackHide(\"" +glyphTrack.trackID+ "\");");
  g1.appendChild(rect);

  if(glyphTrack.hideTrack) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    line.setAttributeNS(null, "onclick", "toggleTrackHide(\"" +glyphTrack.trackID+ "\");");
    g1.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    circle.setAttributeNS(null, "onclick", "toggleTrackHide(\"" +glyphTrack.trackID+ "\");");
    g1.appendChild(circle);
  }
  g1.setAttributeNS(null, 'transform', "translate(8, 0)");
  glyphTrack.svg.appendChild(g1);
}


function createCloseTrackWidget(trackID) {

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 'close track');

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
  stop1.setAttributeNS(null, 'stop-color', 'rgb(255,100,100)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(250,0,30)');
  rg1.appendChild(stop2);

  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', '5px');
  circle.setAttributeNS(null, 'cy', '5px');
  circle.setAttributeNS(null, 'r',  '5px');
  circle.setAttributeNS(null, 'fill', 'url(#redRadialGradient)');
  circle.setAttributeNS(null, "onclick", "removeTrack(\"" + trackID + "\");");
  g1.appendChild(circle);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'points', '2,2 8,8 5,5 8,2 2,8 5,5');
  line.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: black;');
  line.setAttributeNS(null, "onclick", "removeTrack(\"" + trackID + "\");");
  g1.appendChild(line);

  return g1;
}


function createMoveBar(glyphTrack) {
  //uses the full svg document and creates a full height move bar
  var svg = glyphTrack.svg;
  var height = parseInt(svg.getAttributeNS(null, 'height'));

  var rect1 = document.createElementNS(svgNS,'rect');
  rect1.setAttributeNS(null, 'x', '0');
  rect1.setAttributeNS(null, 'y', '1');
  rect1.setAttributeNS(null, 'width', '7');
  rect1.setAttributeNS(null, 'height', height-1);
  rect1.setAttributeNS(null, 'style', 'fill: dimgray; stroke-width:1px; stroke:black;');
  rect1.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
  rect1.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");");
  rect1.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  svg.appendChild(rect1);
}


function createMagnifyRegionWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 'magnify region');

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
  stop1.setAttributeNS(null, 'stop-color', 'rgb(100,100,255)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(50,50,250)');
  rg1.appendChild(stop2);

  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', '0px');
  circle.setAttributeNS(null, 'cy', '4px');
  circle.setAttributeNS(null, 'r',  '3.5px');
  circle.setAttributeNS(null, 'fill', 'url(#blueRadialGradient)');
  circle.setAttributeNS(null, 'stroke', 'gray');
  circle.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  g1.appendChild(circle);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'points', '3,6.5 8,11');
  line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray;');
  line.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");
  g1.appendChild(line);

  g1.setAttributeNS(null, "onclick", "magnifyToSelection(\"" + glyphTrack.trackID + "\");");

  g1.setAttributeNS(null, 'transform', "translate(" + glyphTrack.selection.xmiddle + ",0)");
  glyphTrack.svg.appendChild(g1);
}


function createConfigTrackWidget(glyphTrack) {

  if(glyphTrack.glyphStyle == "cytoband") { return; }

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 're-configure : ' + glyphTrack.title);

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
  line.setAttributeNS(null, "onclick", "reconfigureTrack(\"" + glyphTrack.trackID + "\");");
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

  g1.setAttributeNS(null, "onclick", "reconfigureTrack(\"" + glyphTrack.trackID + "\");");

  g1.setAttributeNS(null, 'transform', "translate(" + (current_region.display_width-15) + ",1)");
  glyphTrack.svg.appendChild(g1);
}

//---------------------------------------------------------------
//
//
// Configuration export and initialization
//
// 
//---------------------------------------------------------------

function gLyphsSaveConfig() {
  var saveConfigDiv = document.getElementById("save_config_div");
  
  if(current_region.saveconfig !== undefined) { return; }

  current_region.saveconfig = new Object;
  current_region.saveconfig.title = current_region.title;
  current_region.saveconfig.user = eedbCurrentUser; 

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"z-index:1; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + (toolTipSTYLE.xpos-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos+10) +"px; "
                            +"width:350px;"
                             );
  var tdiv, tspan, tinput;

  //----------
  tdiv = document.createElement('div');
  tspan = document.createElement('span');
  tspan.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  tspan.innerHTML = "title:";
  tdiv.appendChild(tspan);
  var tinput = document.createElement('input');
  tinput.setAttribute('style', "width:300px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  tinput.setAttribute('type', "text");
  tinput.setAttribute('value', current_region.title);
  tinput.setAttribute("onkeyup", "saveConfigParam('title', this.value);");
  tdiv.appendChild(tinput);
  divFrame.appendChild(tdiv)

  //----------
  var div1 = document.createElement('div');
  var span0 = document.createElement('span');
  span0.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "config name:";
  div1.appendChild(span0);
  var titleInput = document.createElement('input');
  titleInput.setAttribute('style', "width:120px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute("onkeyup", "saveConfigParam('name', this.value);");
  div1.appendChild(titleInput);

  var userSpan = document.createElement('span');
  userSpan.setAttribute('style', "padding:0px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  userSpan.innerHTML = "user:";
  div1.appendChild(userSpan);
  var userInput = document.createElement('input');
  userInput.setAttribute('style', "width:100px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  userInput.setAttribute('type', "text");
  userInput.setAttribute('value', eedbCurrentUser);
  userInput.setAttribute("onkeyup", "saveConfigParam('user', this.value);");
  div1.appendChild(userInput);

  divFrame.appendChild(div1)

  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute("onkeyup", "saveConfigParam('desc', this.value);");
  divFrame.appendChild(descInput);


  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "saveConfigParam('cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save config");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "saveConfigParam('accept');");
  divFrame.appendChild(button2);

  saveConfigDiv.appendChild(divFrame);
}


function saveConfigParam(param, value) {
  var saveConfigDiv = document.getElementById("save_config_div");

  var saveconfig = current_region.saveconfig;
  if(saveconfig === undefined) { return; }

  if(param == "title") { saveconfig.title = value; }
  if(param == "name") { saveconfig.name = value; }
  if(param == "user")  { saveconfig.user = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  if(param == "cancel") {
    saveConfigDiv.innerHTML ="";
    current_region.saveconfig = undefined;
  }

  if(param == "accept") {
    eedbCurrentUser = saveconfig.user;

    var configDOM = uploadConfigXML();

    var titlediv = document.getElementById("gLyphs_title");
    titlediv.innerHTML = current_region.saveconfig.title;

    var descdiv = document.getElementById("gLyphs_description");
    descdiv.innerHTML = current_region.saveconfig.desc;

    saveConfigDiv.innerHTML ="";
    current_region.saveconfig = undefined;
  }
}


function generateConfigDOM() {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = current_region.saveconfig;

  var config = doc.createElement("eeDBgLyphsConfig");
  doc.appendChild(config);

  var registry = doc.createElement("registry");
  registry.setAttribute("url", eedbRegistryURL);
  config.appendChild(registry);

  var summary = doc.createElement("summary");
  summary.setAttribute("title", saveconfig.title);
  summary.setAttribute("name", saveconfig.name);
  summary.setAttribute("user", saveconfig.user);
  summary.setAttribute("desc", saveconfig.desc);
  config.appendChild(summary);

  var loc = doc.createElement("region");
  loc.setAttribute("asm",    current_region.asm);
  loc.setAttribute("chrom",  current_region.chrom);
  loc.setAttribute("start",  current_region.start);
  loc.setAttribute("end",    current_region.end);
  loc.setAttribute("dwidth", current_region.display_width);
  config.appendChild(loc);

  if(current_feature) { 
    //one of the great aspects of working with DOM objects...
    //I can just append the whole feature DOM into the config
    //config.appendChild(current_feature); 

    var feat = doc.createElement("feature");
    feat.setAttribute("peer", current_feature.getAttribute("peer"));
    feat.setAttribute("id",   current_feature.getAttribute("id"));
    feat.setAttribute("desc", current_feature.getAttribute("desc"));
    config.appendChild(feat);
  }  

  var tracks = doc.createElement("gLyphTracks");
  config.appendChild(tracks);

  var glyphset = document.getElementById("gLyphTrackSet");
  var gLyphDivs = glyphset.getElementsByClassName("gLyphTrack");
  for(var i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var glyphTrack = gLyphTrack_array[trackID];
    if(!glyphTrack) { continue; }

    var track = doc.createElement("gLyphTrack");
    //track.setAttribute("trackID", glyphTrack.trackID);
    track.setAttribute("title", glyphTrack.title);
    track.setAttribute("glyphStyle", glyphTrack.glyphStyle);
    track.setAttribute("peerName", glyphTrack.peerName);
    track.setAttribute("sources", glyphTrack.sources);
    track.setAttribute("hide", glyphTrack.hideTrack);
    if(glyphTrack.glyphStyle == "express") {
      track.setAttribute("exptype", glyphTrack.exptype);
      track.setAttribute("expfilter", glyphTrack.expfilter);
      track.setAttribute("logscale", glyphTrack.logscale);
      track.setAttribute("submode", glyphTrack.submode);
      track.setAttribute("binning", glyphTrack.binning);
      track.setAttribute("maxlevels", glyphTrack.maxlevels);
    }

    tracks.appendChild(track);
  }

  return doc;
}


function uploadConfigXML() {
  var configDOM = generateConfigDOM();

  var serializer = new XMLSerializer();
  var xml = serializer.serializeToString(configDOM);

  //
  // create a textarea for debugging the XML
  //
  //var xmlText = document.createElement('textarea');
  //xmlText.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //xmlText.rows = 7;
  //xmlText.value = xml;
  //document.getElementById("message").innerHTML = "";
  //document.getElementById("message").appendChild(xmlText);

  //
  // actual work
  //
  var url = eedbRegistryURL + "/cgi/eedb_config_server.cgi";
  //document.getElementById("message").innerHTML = url;

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return configDOM;
  }
  configXHR.open("POST",url,false); //not async, wait until returns
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  configXHR.send(xml);
  if(configXHR.readyState!=4) return configDOM;
  if(configXHR.responseXML == null) return configDOM;
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null)  return configDOM;

  //xmlText.value = serializer.serializeToString(xmlDoc);

  if(xmlDoc.getElementsByTagName("configXML")) {
    var saveConfig = xmlDoc.getElementsByTagName("configXML")[0];
    var uuid = saveConfig.getAttribute("uuid");
    dhtmlHistory.add("config="+uuid);
  }

  return configDOM;
}


function gLyphsInitConfigUUID(configUUID) {

  var url = eedbRegistryURL + "/cgi/eedb_config_server.cgi?uuid=" + configUUID;
  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  configXHR.open("GET",url,false); //not async, wait until returns
  configXHR.send(null);
  if(configXHR.readyState!=4) return;
  if(configXHR.responseXML == null) return;
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null)  return;

  gLyphsInitFromConfig(xmlDoc);
}


function gLyphsInitFromConfig(configDOM) {

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  //
  // clean it all out, probably should put in a global init method
  //
  current_feature = undefined;
  current_express_probe = undefined;
  eedbDefaultAssembly = undefined;
  current_dragTrack = undefined;
  currentSelectTrackID =undefined;
  feature_express_probes = new Array();
  region_express_probes = new Object();
  gLyphTrack_array = new Array();
  trackXHR_array = new Array();
  express_sort_mode = 'expid';
  newTrackID = 100;

  current_region = new Object();
  current_region.display_width = Math.floor(800);
  current_region.asm = "hg18";
  current_region.title = "welcome to eeDB gLyphs";
  current_region.user = eedbCurrentUser;
  current_region.configname = "";
  current_region.desc = "";


  //--------------------------------
  eedbEmptySearchResults();

  if(configDOM.getElementsByTagName("summary")) {
    var summary = configDOM.getElementsByTagName("summary")[0];
    current_region.title       = summary.getAttribute("title");
    current_region.configname  = summary.getAttribute("name");
    current_region.user        = summary.getAttribute("user");
    current_region.desc        = summary.getAttribute("desc");

    var titlediv = document.getElementById("gLyphs_title");
    titlediv.innerHTML = current_region.title;
    var descdiv = document.getElementById("gLyphs_description");
    descdiv.innerHTML = current_region.desc;
  }

  if(configDOM.getElementsByTagName("feature")) {
    var feature = configDOM.getElementsByTagName("feature")[0];
    var fid   = feature.getAttribute("id");
    var peer  = feature.getAttribute("peer");
    if(peer) { fid = peer +"::"+ fid; }
    loadFeatureInfo(fid);
  }

  var glyphset = document.getElementById("gLyphTrackSet");
  clearKids(glyphset);

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];
    //create trackdiv and glyphTrack objects and configure them

    var trackID = "glyphTrack" + (newTrackID++);
    var trackDiv = document.createElement('div');
    trackDiv.setAttribute("align","left");
    trackDiv.setAttribute("style", "background-color: none; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
    trackDiv.id = trackID;
    trackDiv.setAttribute("class","gLyphTrack");
    glyphset.appendChild(trackDiv);

    var glyphTrack        = new Object;
    glyphTrack.trackID    = trackID;
    glyphTrack.trackDiv   = trackDiv;
    glyphTrack.hideTrack  = trackDOM.getAttribute("hide");
    glyphTrack.title      = trackDOM.getAttribute("title");
    glyphTrack.peerName   = trackDOM.getAttribute("peerName");
    glyphTrack.sources    = trackDOM.getAttribute("sources");
    glyphTrack.glyphStyle = trackDOM.getAttribute("glyphStyle");
    if(trackDOM.getAttribute("maxlevels")) {
      glyphTrack.maxlevels  = Math.floor(trackDOM.getAttribute("maxlevels"));
    }
    if(glyphTrack.glyphStyle == "express") {
      glyphTrack.exptype    = trackDOM.getAttribute("exptype");
      glyphTrack.expfilter  = trackDOM.getAttribute("expfilter");
      glyphTrack.logscale   = trackDOM.getAttribute("logscale");
      glyphTrack.submode    = trackDOM.getAttribute("submode");
      glyphTrack.binning    = trackDOM.getAttribute("binning");
    }
    gLyphTrack_array[trackID] = glyphTrack;

    var peer = eedbGetPeer(glyphTrack.peerName);
    if(peer) { glyphTrack.peer = peer; }

    drawTrack(trackID);
  }
  createAddTrackTool();
  

  if(configDOM.getElementsByTagName("region")) {
    var region = configDOM.getElementsByTagName("region")[0];
    current_region.asm           = region.getAttribute("asm");
    current_region.chrom         = region.getAttribute("chrom");
    current_region.start         = region.getAttribute("start")-0;
    current_region.end           = region.getAttribute("end")-0;
    current_region.display_width = Math.floor(region.getAttribute("dwidth"));
    reloadRegion();
  } else {
    centerOnFeature();
  }
  return;
}


//----------------------------------------------------
// 
//
// track interactive configuration tool section
//
//
//----------------------------------------------------

function addNewTrack(trackID) {
  //the purpose of this method is to convert the "add track" div
  //into a new glyphTrack, create the glyphTrack object
  //and setup the track for configuration

  var trackDiv = document.getElementById(trackID);
  if(!trackDiv) { return; }

  trackDiv.setAttribute("class", "gLyphTrack");

  var glyphTrack        = new Object;
  glyphTrack.trackID    = trackID;
  glyphTrack.trackDiv   = trackDiv;
  glyphTrack.hideTrack  = 0;
  glyphTrack.title      = "";
  glyphTrack.exptype    = "norm";
  glyphTrack.expfilter  = "";
  glyphTrack.logscale   = 0;
  glyphTrack.submode    = "5end";
  glyphTrack.binning    = "sum";
  //glyphTrack.maxlevels  = 100;

  //just some test config for now
  glyphTrack.sources     = "UCSC_rn4_est";
  glyphTrack.peerName    = "eeDB_core";
  glyphTrack.glyphStyle  = "centroid";

  gLyphTrack_array[trackID] = glyphTrack;
  configureNewTrack(trackID);

  //create new div at end and make it the "add" button
  createAddTrackTool();
}


function configureNewTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  glyphTrack.newconfig = new Object;

  trackDiv.setAttribute("style", "background-color: pink; padding:5px 5px 5px 5px; margin-top:3px;");

  clearKids(trackDiv)

  glyphTrack.sourceHash = new Object();

  var p1 = document.createElement('div');
  p1.setAttribute("style", "font-size:16px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  p1.innerHTML ="configure track: "+ trackID;
  trackDiv.appendChild(p1);

  //----------
  var div1 = document.createElement('div');
  var span0 = document.createElement('span');
  span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "title:";
  div1.appendChild(span0);
  var titleInput = document.createElement('input');
  titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', glyphTrack.title);
  titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
  div1.appendChild(titleInput);
  trackDiv.appendChild(div1)

  //----------
  var span1 = document.createElement('span');
  span1.innerHTML = "select EEDB peer: "; 
  trackDiv.appendChild(span1);

  var peerSelect = document.createElement('select');
  peerSelect.id = trackID + "_peerselect";
  peerSelect.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'peer', this.value);");
  trackDiv.appendChild(peerSelect);
  var option = document.createElement('option');
  option.innerHTML = "no peers available";
  peerSelect.appendChild(option);
  
  //
  // OK this needs to be much more, but a simple one source pull down for now
  //
  var span2 = document.createElement('span');
  span2.innerHTML = " select source: ";
  trackDiv.appendChild(span2);
  var sourceSelect = document.createElement('select');
  sourceSelect.id = trackID + "_selectsource";
  trackDiv.appendChild(sourceSelect);

  var option = document.createElement('option');
  option.innerHTML = "select from sources";
  sourceSelect.appendChild(option);

  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "append source");
  button1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'source-append');");
  trackDiv.appendChild(button1);

  // 
  // source entry form
  //
  var div2 = document.createElement('div');
  div2.setAttribute("style", "margin:2px 0px 2px 0px;");
  trackDiv.appendChild(div2);
  var span2 = document.createElement('span');
  span2.innerHTML = "enter source name(s) [, separate if multiple]: ";
  div2.appendChild(span2);
  //input id="searchText" type="text" autocomplete="off" onkeyup="eedbMultiSearch(this.value, event)" size="140"
  var input1 = document.createElement('input');
  input1.id = trackID + "_inputsource";
  input1.setAttribute("type", "text");
  input1.setAttribute("autocomplete", "off");
  input1.setAttribute("size", "60");
  input1.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'source-input', this.value);");
  div2.appendChild(input1);

  //
  // glyphStyle
  //
  var div3 = document.createElement('div');
  div3.setAttribute('style', "margin: 2px 0px 2px 0px;");
  trackDiv.appendChild(div3);
  var glyphSelect = createGlyphstyleSelect(trackID);
  div3.appendChild(glyphSelect);

  //
  // if "express" track there are other options
  //
  var span3b = document.createElement('span');
  span3b.id = trackID + "_extendedExpressOptions";
  span3b.setAttribute('style', "padding: 3px 0px 1px 4px; visibility: hidden");
  div3.appendChild(span3b)
  //----------
  var span3 = document.createElement('span');
  span3.setAttribute('style', "padding: 1px 0px 1px 14px;");
  span3.innerHTML = "track height: ";
  span3b.appendChild(span3);
  var levelInput = document.createElement('input');
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  levelInput.setAttribute('size', "10");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', glyphTrack.maxlevels);
  levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'maxlevels', this.value);");
  span3b.appendChild(levelInput);
  //----------
  var span7 = document.createElement('span');
  span7.setAttribute('style', "padding: 0px 0px 0px 7px;");
  span7.innerHTML = "region:";
  span3b.appendChild(span7); 
  span3b.appendChild(createSubmodeSelect(trackID));
  //----------
  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) {
    var span2 = document.createElement('span');
    span2.setAttribute('style', "margin: 0px 0px 0px 14px;");
    span2.innerHTML = "datatype:";
    span3b.appendChild(span2);
    span3b.appendChild(datatypeSelect);
    span3b.appendChild(createBinningSelect(trackID));
  }
  //----------
  var logCheck = document.createElement('input');
  logCheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  logCheck.setAttribute('type', "checkbox");
  if(glyphTrack.logscale) { logCheck.setAttribute('checked', "checked"); }
  logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'logscale', this.checked);");
  span3b.appendChild(logCheck);
  var span1 = document.createElement('span');
  span1.innerHTML = "log scale";
  span3b.appendChild(span1);
  //----------


  //
  // and the button
  //
  var button = document.createElement('input');
  button.setAttribute("type", "button");
  button.setAttribute("value", "accept config");
  button.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept');");
  var div10 = document.createElement('div');
  div10.appendChild(button);
  trackDiv.appendChild(div10);

  loadConfigPanelPeers(trackID);
  loadConfigPanelSources(trackID);
}


function loadConfigPanelPeers(trackID) {
  var peerSelect = document.getElementById(trackID + "_peerselect");
  if(!peerSelect) { return; }

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var url = eedbRegistryURL + "/cgi/edgeexpress.fcgi?mode=peers";

  var peerXHR=GetXmlHttpObject();
  //var peerXHR = new flensed.flXHR({ autoUpdatePlayer:true });
  //var peerXHR = new flensed.flXHR({ autoUpdatePlayer:true, instanceId:trackID, onerror:flXHR_handleError, onreadystatechange:loadConfigPanelPeersResponse, loadPolicyURL:"http://osc-intweb1.gsc.riken.jp/edgeexpress-devel/cgi/crossdomain.xml" });
  if(peerXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  //document.getElementById("message").innerHTML = "flXHR created"; 
  //peerXHR.loadPolicyURL = "http://osc-intweb1.gsc.riken.jp/edgeexpress-devel/cgi/crossdomain.xml";
  peerXHR.instanceId = trackID;
  peerXHR.onreadystatechange= function(xhr) { return function() { loadConfigPanelPeersResponse(xhr); };}(peerXHR);
  peerXHR.open("GET",url,true);
  peerXHR.send(null);
} 

function flXHR_handleError(errObj) {
}

function loadConfigPanelPeersResponse(peerXHR) {
  //document.getElementById("message").innerHTML = "loadConfigPanelPeersResponse"; 

  if(peerXHR.readyState!=4) return;
  if(peerXHR.responseXML == null) return;
  var xmlDoc=peerXHR.responseXML.documentElement;
  if(xmlDoc==null)  return;

  //document.getElementById("message").innerHTML = "loadConfigPanelPeersResponse"; 
  
  var trackID = peerXHR.instanceId;

  var peerSelect = document.getElementById(trackID + "_peerselect");
  if(!peerSelect) { return; }

  var peers = xmlDoc.getElementsByTagName("peer");
  var sortedPeers = new Array();
  for(var i=0; i<peers.length; i++) {
    sortedPeers.push(peers[i]);
  }
  sortedPeers.sort(peer_sort_func);

  peerSelect.innerHTML = "";
  for(var i=0; i<sortedPeers.length; i++) {
    //<option value='5end'>5' end</option>
    var peerDOM = sortedPeers[i];

    var alias     = peerDOM.getAttribute("alias");
    var webURL    = peerDOM.getAttribute("web_url");
    var uuid      = peerDOM.getAttribute("uuid");

    var option = document.createElement('option');
    option.setAttributeNS(null, "value", alias);
    option.innerHTML = alias;
    peerSelect.appendChild(option);
  }
}

function peer_sort_func(a,b) {
  var name1 = a.getAttribute("alias").toUpperCase();
  var name2 = b.getAttribute("alias").toUpperCase();
  return (name1 > name2);
}


function loadConfigPanelSources(trackID) {
  var sourceSelect = document.getElementById(trackID + "_selectsource");
  if(!sourceSelect) { return; }

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  //refetch the peer 
  var peer = eedbGetPeer(glyphTrack.peerName);
  if(!peer) { return; }
  glyphTrack.peer = peer; 

  url = peer.getAttribute("web_url") + "/cgi/edgeexpress.fcgi?mode=feature_sources";

  var sourcesXHR=GetXmlHttpObject();
  if(sourcesXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  sourcesXHR.open("GET",url,false); //not async, wait until returns
  sourcesXHR.send(null);
  if(sourcesXHR.readyState!=4) return;
  if(sourcesXHR.responseXML == null) return;
  var xmlDoc=sourcesXHR.responseXML.documentElement;
  if(xmlDoc==null)  return;

  var sources = xmlDoc.getElementsByTagName("featuresource");
  var sortedSources = new Array();
  for(var i=0; i<sources.length; i++) {
    sortedSources.push(sources[i]);
  }
  sortedSources.sort(sources_sort_func);

  sourceSelect.innerHTML = "";
  for(var i=0; i<sortedSources.length; i++) {
    //<option value='5end'>5' end</option>
    var sourceDOM = sortedSources[i];

    var name     = sourceDOM.getAttribute("name");
    var category = sourceDOM.getAttribute("category");
    var count    = sourceDOM.getAttribute("count");

    var option = document.createElement('option');
    option.setAttributeNS(null, "value", name);
    option.innerHTML = name;
    sourceSelect.appendChild(option);
  }
  var option = document.createElement('option');
  option.setAttributeNS(null, "value", "");
  option.innerHTML = "use all sources";
  sourceSelect.appendChild(option);
}

function sources_sort_func(a,b) {
  var name1 = a.getAttribute("name").toUpperCase();
  var name2 = b.getAttribute("name").toUpperCase();
  return (name1 > name2);
}


function reconfigTrackParam(trackID, param, value) {
  //document.getElementById("message").innerHTML= "reconfig: " + trackID + ":: "+ param + "="+value;
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var newconfig = glyphTrack.newconfig;

  if(param == "submode") {  newconfig.submode = value; }
  if(param == "binning") {  newconfig.binning = value; }
  if(param == "title") {  newconfig.title = value; }
  if(param == "exptype") {  newconfig.exptype = value; }
  if(param == "expfilter") {  newconfig.expfilter = value; }
  if(param == "glyphStyle") { 
    newconfig.glyphStyle = value; 
    var expressOptions = document.getElementById(trackID + "_extendedExpressOptions");
    if(expressOptions) {
      if(value == "express") { expressOptions.setAttribute('style', "visibility: block"); }
      else { expressOptions.setAttribute('style', "visibility: hidden"); }
    }
  }
  if(param == "maxlevels") {  
    newconfig.maxlevels = Math.floor(value); 
    if(newconfig.maxlevels <15) { newconfig.maxlevels = 15; } 
    if(newconfig.maxlevels >500) { newconfig.maxlevels = 500; } 
  }
  if(param == "logscale") { 
    if(value) { newconfig.logscale=1; }
    else { newconfig.logscale = 0; }
  }
  if(param == "peer") {
    glyphTrack.peerName = value;
    //go dynamically fetch the featureSources from this EEDB now and rebuild the source pulldown
    loadConfigPanelSources(trackID);
    createDatatypeSelect(trackID);
  }
  if(param == "source-append") {
    var source_input = document.getElementById(trackID + "_inputsource");
    var source_select = document.getElementById(trackID + "_selectsource");
    if(source_select) {
      value = source_select.value;
      glyphTrack.sourceHash[value] = value;
    }
    if(source_input) {
      var sourceString="";
      for (var name in glyphTrack.sourceHash) {
        if(sourceString=="") { sourceString = name; }
        else { sourceString += ","+name; }
      }
      source_input.value= sourceString;
    }
  }
  if(param == "source-input") {
    glyphTrack.sources = value;
    glyphTrack.sourceHash = new Object();
    glyphTrack.sourceHash[value] = value;
  }

  if(param == "accept") {
    var source_input  = document.getElementById(trackID + "_inputsource");
    var source_select = document.getElementById(trackID + "_selectsource");
    if(source_input && (source_input.value !="")) { 
      glyphTrack.sources = source_input.value;
    } else {
      glyphTrack.sources = source_select.value;
    }

    glyphTrack.trackDiv.setAttribute("style", "background-color: none; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

    if(glyphTrack.newconfig) {
      var newconfig = glyphTrack.newconfig;
      if(newconfig.glyphStyle !== undefined) { glyphTrack.glyphStyle = newconfig.glyphStyle; }
      if(newconfig.logscale !== undefined) { glyphTrack.logscale = newconfig.logscale; }
      if(newconfig.submode !== undefined) { glyphTrack.submode = newconfig.submode; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; }
      if(newconfig.expfilter !== undefined) { glyphTrack.expfilter = newconfig.expfilter; }
      if(newconfig.maxlevels !== undefined) { glyphTrack.maxlevels = newconfig.maxlevels; }
    }

    //
    // set some defaults if they are not configured
    //
    if(glyphTrack.title == "") { glyphTrack.title = glyphTrack.sources; }

    if(glyphTrack.glyphStyle == "express") {
      //document.getElementById("message").innerHTML = "new express track so set some defaults";
      if(glyphTrack.exptype === undefined)   { glyphTrack.exptype = "norm"; }
      if(glyphTrack.maxlevels === undefined) { glyphTrack.maxlevels = 100; }
    }

    //refetch the peer 
    var peer = eedbGetPeer(glyphTrack.peerName);
    if(peer) { glyphTrack.peer = peer; } 

    glyphTrack.newconfig = undefined;
    drawTrack(trackID);
    prepareTrackXHR(trackID);
  }

  if(param == "cancel-reconfig") {
    glyphTrack.newconfig = undefined;
    drawTrack(trackID);
  }

  if(param == "accept-reconfig") {
    if(glyphTrack.newconfig) {
      var newconfig = glyphTrack.newconfig;
      if(newconfig.glyphStyle !== undefined) { glyphTrack.glyphStyle = newconfig.glyphStyle; }
      if(newconfig.logscale !== undefined) { glyphTrack.logscale = newconfig.logscale; }
      if(newconfig.submode !== undefined) { glyphTrack.submode = newconfig.submode; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; }
      if(newconfig.expfilter !== undefined) { glyphTrack.expfilter = newconfig.expfilter; }
      if(newconfig.maxlevels !== undefined) { glyphTrack.maxlevels = newconfig.maxlevels; }
    }
    glyphTrack.newconfig = undefined;
    prepareTrackXHR(trackID);
  }
}

//
//--------------------------------------------------------
//

function reconfigureTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(glyphTrack.newconfig !== undefined) { return; }

  glyphTrack.newconfig = new Object;

  if(glyphTrack.glyphStyle == "express") {
    reconfigureExpressionTrack(trackID);
  } else {
    reconfigureFeatureTrack(trackID);
  }
}

function reconfigureExpressionTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var svg = glyphTrack.svg;
  if(!svg) return;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"z-index:1; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + (toolTipSTYLE.xpos-259) +"px; "
                            +"top:" + toolTipSTYLE.ypos +"px; "
			    +"width:250px;"
                             );

  //----------
  var div1 = document.createElement('div');
  var span0 = document.createElement('span');
  span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "title:"; 
  div1.appendChild(span0);
  var titleInput = document.createElement('input');
  titleInput.setAttribute('style', "width:210px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', glyphTrack.title);
  titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
  div1.appendChild(titleInput);
  divFrame.appendChild(div1)

  //----------
  var div3 = document.createElement('div');
  divFrame.appendChild(div3)

  var logCheck = document.createElement('input');
  logCheck.setAttribute('style', "margin: 1px 1px 1px 1px;");
  logCheck.setAttribute('type', "checkbox");
  if(glyphTrack.logscale) { logCheck.setAttribute('checked', "checked"); }
  logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'logscale', this.checked);");
  div3.appendChild(logCheck);

  var span1 = document.createElement('span');
  span1.innerHTML = "log scale"; 
  div3.appendChild(span1);

  var submodeSelect = createSubmodeSelect(trackID);
  div3.appendChild(submodeSelect);

  //----------
  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) { 
    var div4 = document.createElement('div');
    divFrame.appendChild(div4);
    var span2 = document.createElement('span');
    span2.innerHTML = "datatype:"; 
    div4.appendChild(span2);
    div4.appendChild(datatypeSelect); 

    var binningSelect = createBinningSelect(trackID);
    div4.appendChild(binningSelect); 
  }

  //----------
  var div5 = document.createElement('div');
  var span3 = document.createElement('span');
  span3.innerHTML = "track height: "; 
  div5.appendChild(span3);
  var levelInput = document.createElement('input');
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  levelInput.setAttribute('size', "10");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', glyphTrack.maxlevels);
  levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'maxlevels', this.value);");
  div5.appendChild(levelInput);
  divFrame.appendChild(div5)

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var expSearchSet = document.createElement('div');
  expSearchSet.id = trackID + "_exp_searchset";
  expSearchSet.class = "EEDBsearchSet";
  divFrame.appendChild(expSearchSet)

  var expSpan = document.createElement('span');
  expSpan.innerHTML = "Experiment filter:"; 
  expSpan.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif;");
  expSpan.setAttribute("onclick", "eedbClearSearchResults(\""+ expSearchSet.id + "\");");
  expSearchSet.appendChild(expSpan);

  var expInput = document.createElement('input');
  expInput.setAttribute('style', "width:150px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  expInput.setAttribute('type', "text");
  expInput.setAttribute('value', glyphTrack.expfilter);
  expInput.setAttribute("onkeyup", "eedbMultiSearch(\""+ expSearchSet.id +"\", this.value, event); reconfigTrackParam(\""+ trackID+"\", 'expfilter', this.value);");
  expSearchSet.appendChild(expInput);

  var expSearch1 = document.createElement('div');
  expSearch1.id = trackID + "_expsearch1";
  expSearch1.setAttribute('class', "EEDBsearch");
  expSearch1.setAttribute('mode', "experiments");
  expSearchSet.appendChild(expSearch1);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
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

  //----------
  trackDiv.appendChild(divFrame);

  eedbMultiSearch(expSearchSet.id, glyphTrack.expfilter);
}


function reconfigureFeatureTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var svg = glyphTrack.svg;
  if(!svg) return;

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"z-index:102; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + (toolTipSTYLE.xpos-229) +"px; "
                            +"top:" + toolTipSTYLE.ypos +"px; "
			    +"width:220px;"
                             );

  //----------
  var div1 = document.createElement('div');
  var span0 = document.createElement('span');
  span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "title:";             
  div1.appendChild(span0);
  var titleInput = document.createElement('input');
  titleInput.setAttribute('style', "width:180px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', glyphTrack.title);
  titleInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'title', this.value);");
  div1.appendChild(titleInput);
  divFrame.appendChild(div1)

  //----------
  var glyphSelect = createGlyphstyleSelect(trackID);
  divFrame.appendChild(glyphSelect);

  //----------
  divFrame.appendChild(document.createElement('hr'));

  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "drawTrack(\""+ trackID+"\");");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "accept config");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-reconfig');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
}


function createGlyphstyleSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var span1 = document.createElement('span');
  span1.setAttribute("style", "margin:2px 0px 2px 0px;");

  var span2 = document.createElement('span');
  span2.innerHTML = "select gLyph style: ";
  span1.appendChild(span2);

  var glyphSelect = document.createElement('select');
  glyphSelect.id = trackID + "_glyphselect";
  glyphSelect.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'glyphStyle', this.value);");
  span1.appendChild(glyphSelect);

  var styles=new Array("express", "centroid", "transcript", "probesetloc", "cytoband", "box", "arrow", "subfeature", "exon", "utr", "thin");
  for(var i=0; i<styles.length; i++) {
    var glyphStyle = styles[i];

    var option = document.createElement('option');
    option.setAttributeNS(null, "value", glyphStyle);
    if(glyphStyle == glyphTrack.glyphStyle) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = glyphStyle;
    glyphSelect.appendChild(option);
  }
  return span1;
}


function createSubmodeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var submodeSelect = document.createElement('select');
  submodeSelect.setAttribute('name', "submode");
  submodeSelect.setAttribute('style', "margin: 1px 4px 1px 4px;");
  submodeSelect.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'submode', this.value);");

  var opt = document.createElement('option');
  opt.setAttribute('value', '5end');
  opt.innerHTML="5\' end";
  if(glyphTrack.submode =="5end") { opt.setAttribute("selected", "selected"); }
  submodeSelect.appendChild(opt);

  opt = document.createElement('option');
  opt.setAttribute('value', '3end');
  opt.innerHTML="3\' end";
  if(glyphTrack.submode =="3end") { opt.setAttribute("selected", "selected"); }
  submodeSelect.appendChild(opt);

  opt = document.createElement('option');
  opt.setAttribute('value', 'area');
  opt.innerHTML="area";
  if(glyphTrack.submode =="area") { opt.setAttribute("selected", "selected"); }
  submodeSelect.appendChild(opt);

  return submodeSelect;
}


function createDatatypeSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return null; }

  //refetch the peer 
  if(!glyphTrack.peerName) { return null; }
  var peer = eedbGetPeer(glyphTrack.peerName);
  if(!peer) { return null; }
  glyphTrack.peer = peer; 

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) { 
    datatypeSelect = document.createElement('select');
    datatypeSelect.setAttribute('name', "datatype");
    datatypeSelect.setAttribute('style', "margin: 1px 4px 1px 4px;");
    datatypeSelect.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'exptype', this.value);");
    datatypeSelect.id = trackID + "_datatypeSelect";
  }
  datatypeSelect.innerHTML = ""; //to clear old content

  url = peer.getAttribute("web_url") + "/cgi/edgeexpress.fcgi?mode=expression_datatypes";

  var sourcesXHR=GetXmlHttpObject();
  if(sourcesXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  sourcesXHR.open("GET",url,false); //not async, wait until returns
  sourcesXHR.send(null);
  if(sourcesXHR.readyState!=4) return null;
  if(sourcesXHR.responseXML == null) return null;
  var xmlDoc=sourcesXHR.responseXML.documentElement;
  if(xmlDoc==null)  return null;


  var types = xmlDoc.getElementsByTagName("datatype");
  for(var i=0; i<types.length; i++) {
    var typeDOM = types[i];

    var type = typeDOM.getAttribute("type");

    var option = document.createElement('option');
    option.setAttributeNS(null, "value", type);
    if(type == glyphTrack.exptype) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = type;
    datatypeSelect.appendChild(option);
  }
  return datatypeSelect;
}


function createBinningSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var binningSelect = document.createElement('select');
  binningSelect.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'binning', this.value);");

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
  glyphset.removeChild(trackDiv);
}

function endDrag() {
  //document.getElementById("message").innerHTML += "global end drag ";
  moveTrack("enddrag");
  current_dragTrack = null;

  selectTrackRegion("enddrag", currentSelectTrackID);
  return false;
}


function moveTrack(mode, trackID) {
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
  }
  if(targetTrack_index > currentDrag_index) {
    var target_div = trackDivs[targetTrack_index];
    if(target_div) { glyphset.insertBefore(current_dragTrack.trackDiv, target_div.nextSibling); }
  }
}


function selectTrackRegion(mode, trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  if(mode=="startdrag") {
    glyphTrack.selection = new Object;  //an object to hold start,end,svg elements
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

  var xpos   = toolTipSTYLE.xpos - glyphTrack.selection.offset; 
  var start  = current_region.start;
  var end    = current_region.end;
  var dwidth = current_region.display_width;
  var chrpos = Math.floor(start + (xpos*(end-start)/dwidth));

  if(mode=="enddrag") {
    glyphTrack.selection.xend = xpos;
    glyphTrack.selection.chrom_end = chrpos;
    glyphTrack.selection.active = "no";
    currentSelectTrackID = null;
    if(glyphTrack.selection.xend == glyphTrack.selection.xstart) {
      //single point click so no selection
      glyphTrack.selection = null;
    }
    else if(glyphTrack.selection.chrom_start>glyphTrack.selection.chrom_end) { 
      var t=glyphTrack.selection.chrom_start; 
      glyphTrack.selection.chrom_start=glyphTrack.selection.chrom_end; 
      glyphTrack.selection.chrom_end=t; 
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
  //var msg = "select x:" + glyphTrack.selection.start + "  y:"+ glyphTrack.selection.end;
  //document.getElementById("message").innerHTML = msg;

  drawTrack(trackID);
}


function magnifyToSelection(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  if(glyphTrack.selection == null) { return; }
 
  var selection = glyphTrack.selection;
  current_region.start = selection.chrom_start;
  current_region.end   = selection.chrom_end;

  glyphTrack.selection = null;

  eedbEmptySearchResults();
  reloadRegion();
}


//-----------------------------------
//
// test code to test the flXHR toolkit for crossdomain XHR
//
//-----------------------------------


function doit() {
  document.getElementById("message").innerHTML = "flXHR doit"; 
        var flproxy = new flensed.flXHR({ autoUpdatePlayer:true, instanceId:"myproxy1", onerror:handleError, onreadystatechange:handleLoading, loadPolicyURL:"http://osc-intweb1.gsc.riken.jp/edgeexpress-devel/cgi/crossdomain.xml" });
        flproxy.open("GET","http://osc-intweb1.gsc.riken.jp/eedb_core/cgi/edgeexpress.fcgi?mode=peers");
        flproxy.send(null);
}

function handleLoading(XHRobj) {
        if (XHRobj.readyState == 4) {
                var xmlStr = "";
                try { xmlStr = ((XHRobj.responseXML && XHRobj.responseXML.documentElement.nodeName != "parsererror") ? (new XMLSerializer()).serializeToString(XHRobj.responseXML) : ""); }
                catch (err) { xmlStr = XHRobj.responseXML.xml; }

  document.getElementById("message").innerHTML += " :: flXHR response came back"; 
                alert("readyState:"+XHRobj.readyState
                        //+"\nresponseText:"+XHRobj.responseText
                        +"\nresponseXML:"+xmlStr
                        +"\nstatus:"+XHRobj.status
                        +"\nstatusText:"+XHRobj.statusText
                        +"\nSource Object Id: "+XHRobj.instanceId
                );
        }
}

function handleError(errObj) {
        alert("Error: "+errObj.number
                +"\nType: "+errObj.name
                +"\nDescription: "+errObj.description
                +"\nSource Object Id: "+errObj.srcElement.instanceId
        );
}


