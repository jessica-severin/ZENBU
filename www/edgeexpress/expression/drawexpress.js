var expressXMLHttp;
var trackXHR_array = new Array();
var eedbRegistryURL = "/eedb_core/cgi/edgeexpress.fcgi";
var expressXmlURL = "../cgi/edgeexpress.fcgi?mode=express&format=xml";
var eedbRegionURL = "../cgi/eedb_region.cgi";
var express_sort_mode = 'expid';
var svgNS = "http://www.w3.org/2000/svg";
var svgXlink = "http://www.w3.org/1999/xlink";

var current_feature;
var current_region;
var current_express_probe;
var feature_express_probes = new Array();
var region_express_probes = new Object();

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

function searchClick(id, geneName) {
  eedbClearSearchTooltip();
  //document.getElementById("searchResults").innerHTML="Searching...";
  expressLoadFeature(id);
}

function singleSearchValue(str) {
  document.getElementById("message").innerHTML = "";
  var str = document.getElementById("searchText").value;
  //if(str.match(/^(.+)\:(\d+)\.\.(\d+)$/)) {

  var re = /^(.+)\:(\d+)\.\.(\d+)$/;
  var mymatch = re.exec(str);

  if(mymatch && (mymatch.length == 4)) {
   // document.getElementById("message").innerHTML = "submit loc: " + str;

    if(!current_region) {
      current_region = new Object();
      current_region.logscale = 0;
      current_region.submode = "5end";
      current_region.display_width = Math.floor(800);
    }
    current_region.asm   = "rn4";
    current_region.chrom = mymatch[1];
    current_region.start = Math.floor(mymatch[2]);
    current_region.end   = Math.floor(mymatch[3]);

    document.getElementById('genome_region_div').style.display = 'block';
    emptySearchResults();
    reloadRegion();
  }

  return false;
}

function clearExpressTooltip() {
  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";
  // document.getElementById("SVGdiv").innerHTML= "tooltip mouse out";
}


function expressLoadFeature(id) {
  var url = expressXmlURL;

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

  expressXMLHttp.onreadystatechange=displayFeatureExpression;
  expressXMLHttp.open("GET",url,true);
  expressXMLHttp.send(null);
}


function displayFeatureExpression() {

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

  reloadRegion();

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
  for(i=0; i<express.length; i++) {
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
  for(i=0; i<express_sort.length; i++) {
    var expname = express_sort[i].getAttribute("exp_name");
    var normvalue = parseFloat(express_sort[i].getAttribute("value"));
    var detection = parseFloat(express_sort[i].getAttribute("sig_error"));
    if(normvalue > max_value) max_value = normvalue;

    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '0px');
    text.setAttributeNS(null, 'y', ((i*12)+35) +'px');
    text.appendChild(document.createTextNode(expname));
    g1.appendChild(text);

    text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '270px');
    text.setAttributeNS(null, 'y', ((i*12)+35) +'px');
    text.appendChild(document.createTextNode(normvalue + '  (' + detection + ')'));
    g1.appendChild(text);
  }
  for(i=0; i<express_sort.length; i++) {
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


//----------------------------------------------
// somewhat generic function which display an
// info box from the feature DOM
//----------------------------------------------

function displayProbeInfo() {
  // feature is an XML DOM document which holds the feature data

  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:330px; z-index:-10; "+
                    "background-color:rgb(245,255,255); border:inset; padding: 3px 3px 3px 3px;\">";
  object_html += "<div style=\"font-weight:bold; \">expression probes</div>";

  for (var trackID in region_express_probes) {
    var xmlDoc = region_express_probes[trackID];
    if(!xmlDoc) { continue; }
    var region = xmlDoc.getElementsByTagName("express_region")[0];
    var asm    = region.getAttribute("asm").toUpperCase();
    var chrom  = region.getAttribute("chrom");
    var start  = region.getAttribute("start");
    var end    = region.getAttribute("end");

    object_html += "<div><a style=\"font-weight: bold;\" href=\"#\" onclick=\"changeRegionProbe('" +trackID+ "')\"  >";
    object_html += "region: "+ asm + " " +chrom+ ":" +start+ ".." +end;
    object_html += "</a></div>";

    var experiments = xmlDoc.getElementsByTagName("expression")
    //document.getElementById("message").innerHTML = "experiments: " + experiments.length;
  }

  for(i=0; i<feature_express_probes.length; i++) {
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
  
  for(i=0; i<feature_express_probes.length; i++) {
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
// somewhat generic function which display an
// info box from the feature DOM
//----------------------------------------------

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

  if(!current_region) {
    current_region = new Object();
    current_region.logscale = 0;
    current_region.submode = "5end";
    current_region.display_width = Math.floor(800);
  }
  current_region.asm   = feature.getAttribute("asm");
  current_region.chrom = feature.getAttribute("chr");
  current_region.start = start;
  current_region.end   = end;

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
    if(symbols[i].getAttribute("type") == "OMIM") omim_id = symbols[i].getAttribute("value");
    if(symbols[i].getAttribute("type") == "GeneticLoc") genloc = symbols[i].getAttribute("value");
    if(symbols[i].getAttribute("type") == "TFsymbol") synonyms += symbols[i].getAttribute("value");
  }
  var object_html = "<div style=\"text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:350px; z-index:-10; "+
                    "background-color:rgb(188,188,255); border:inset; padding: 3px 3px 3px 3px;\">";
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
  object_html += "<div>location: " + genloc + " ::  " + chromloc + "</div>";
  object_html += "<div>maxexpress: ";
  if(maxexpress && (maxexpress.length > 0)) {
    var express = maxexpress[0].getElementsByTagName("express");
    for(i=0; i<express.length; i++) {
      var platform = express[i].getAttribute("platform");
      if(platform == 'Illumina microarray') { platform = "ILMN"; }
      object_html += platform + ":" + express[i].getAttribute("maxvalue") + " ";
    }
  }
  object_html += "</div></div>";
  document.getElementById("feature_info").innerHTML= object_html;
  //document.getElementById("feature_info").innerHTML= description;
}

function applyExperimentFilter() {
  var filter = document.getElementById("expFilterText").value;
  //document.getElementById("message").innerHTML = "apply experiment filter:: " +filter;
  current_region.expfilter = filter;
  reloadRegion();
}

function changeExpressRegionConfig(type, value, widget) {
  var need_to_reload = 0;

  //document.getElementById("message").innerHTML = "changeExpressRegionConfig: type["+type+"]  value["+value+"]";

  var old_log = current_region.logscale;
  if(document.getElementById("logscaleCheck").checked) { current_region.logscale=1; }
  else { current_region.logscale = 0; }
  if(old_log != current_region.logscale) { need_to_reload=1; }
  
  var submode = document.getElementById("expSubMode").value;
  if(submode != current_region.submode) { need_to_reload=1; }
  current_region.submode=submode;

  if(type =="dwidth") {
    var new_width = Math.floor(value);
    if(new_width < 640) { new_width=640; }
    if(new_width != current_region.display_width) { need_to_reload=1; }
    current_region.display_width = new_width;
  }

  if(need_to_reload == 1) { reloadRegion(); }
}

function toggleTrackHide(trackID) {
  var xhrObj = trackXHR_array[trackID];
  if(!xhrObj) { return; }
  xhrObj.hideTrack = !(xhrObj.hideTrack);
  drawTrack(trackID);
}

//--------------------------------------------------------
//
//
//       EEDB gLyphs genomic visualization toolkit
//
//
//--------------------------------------------------------

function redrawRegion() {
  var dwidth = current_region.display_width;
  var asm    = current_region.asm;
  var chrom  = current_region.chrom;
  var start  = current_region.start;
  var end    = current_region.end;
  var len    = end-start;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }

  //var chromloc = chrom +":" + start + ".." + end;
  //document.getElementById("svgTestArea2").innerHTML = "redraw" + asm.toUpperCase() + " " + chromloc + "  [len "+ len + " ]";

  var gLyphDivs = document.getElementsByClassName("gLyphTrack");
  for(i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    var xhrObj = trackXHR_array[trackID];
    //xhrObj.glyphStyle="hide";
    showTrackLoading(trackID);
    drawTrack(trackID);
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

  //testDirectSVG();

  var glyphset = document.getElementById("gLyphTrackSet");
  glyphset.setAttribute("style", 'width: '+ dwidth+'px;');


  var gLyphDivs = document.getElementsByClassName("gLyphTrack");
  for(i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    showTrackLoading(trackID);
  }
  for(i=0; i<gLyphDivs.length; i++) {
    var gLyphDiv = gLyphDivs[i];
    var trackID = gLyphDiv.getAttribute("id");
    prepareTrackXHR(trackID, chrom, start, end);
  }

//  refreshGbrowse();
}


function prepareTrackXHR(trackID, chrom, start, end) {
  var trackDiv = document.getElementById(trackID);
  if(!trackDiv) return;

  trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

  showTrackLoading(trackID);

  var chromloc = chrom +":" + start + ".." + end;

  var peerName   = trackDiv.getAttribute("peer");
  var sourceName = trackDiv.getAttribute("source");
  var server     = trackDiv.getAttribute("server");
  var serverType = trackDiv.getAttribute("server_type");
  var glyphStyle = trackDiv.getAttribute("glyph");
  var exptype    = trackDiv.getAttribute("exptype");
  var expfilter  = current_region.expfilter;
  var logscale   = current_region.logscale;
  var submode    = current_region.submode;
  var dwidth     = current_region.display_width;
  
  var url = eedbRegionURL;
  if(peerName) {
    var peer = eedbGetPeer(peerName);
    if(peer) {
      var webURL = peer.getAttribute("web_url");
      //document.getElementById("message").innerHTML = "peer web:: " + webURL;
      if(webURL) { url = webURL + "/cgi/eedb_region.cgi"; }
    } 
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
    url += ";format=xml;mode=express;submode=" + submode;
    if(expfilter) { url += ";expfilter=" + expfilter; }
  }
  else if(glyphStyle && (glyphStyle=='transcript')) {
    url += ";format=xml;submode=subfeature";
  } else {
    url += ";format=xml";
  }
  //if(glyphStyle && (glyphStyle=='cytoband')) { document.getElementById("message").innerHTML = url; }
  //if(glyphStyle && (glyphStyle=='express')) { document.getElementById("message").innerHTML = url; }

  var old_xhrObj = trackXHR_array[trackID];
  var hideTrack =0;
  if(old_xhrObj) { hideTrack = old_xhrObj.hideTrack; }

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
  xhrObj.glyphStyle = glyphStyle;
  xhrObj.trackDiv   = trackDiv;
  xhrObj.hideTrack  = hideTrack;

  var title = trackDiv.getAttribute("trackTitle");
  var sourceName = trackDiv.getAttribute("source");
  if(!title && sourceName) { title = sourceName; }
  if(!title && (glyphStyle == "cytoband")) { 
    title = current_region.asm.toUpperCase()  + " " + current_region.chrom;
  }
  if(!title) { title = 'all data tracks'; }
  xhrObj.title = title;

  trackXHR_array[trackID] = xhrObj;

  //damn this is funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { drawTrack(id); };}(trackID);
  xhr.open("GET",url,true);
  xhr.send(null);
}


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
  document.getElementById("gbrowse1").innerHTML= "<a target=\"RGD\" href=\"" + hyperlink+"\"><img scrolling='no' src=\"" + gb_url + "\"/></a>";
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
      current_region.expfilter ="";
    }
  }
  if(start<0) { start = 0; }

  current_region.start = start;
  current_region.end   = end;

  reloadRegion();
}


function showTrackLoading(trackID) {
  var xhrObj = trackXHR_array[trackID];
  if(xhrObj == null) { return; }

  var svg = xhrObj.svg;
  if(!svg) return;

  var tobj = document.createElementNS(svgNS,'text');
  tobj.setAttributeNS(null, 'x', '300px');
  tobj.setAttributeNS(null, 'y', '9px');
  tobj.setAttributeNS(null, "font-size","10px");
  tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  tobj.setAttributeNS(null, 'style', 'fill: red;');
  var textNode = document.createTextNode("track reloading");
  tobj.appendChild(textNode);

  svg.appendChild(tobj);
} 


function drawTrack(trackID) {
  var xhrObj = trackXHR_array[trackID];
  if(xhrObj == null) { return; }
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
  //document.getElementById("message").innerHTML= 'draw track ' + trackID;
  xhrObj.xmlDoc = xmlDoc;

  // get the chrom object
  if(xmlDoc.getElementsByTagName("chrom")) {
    var chrom = xmlDoc.getElementsByTagName("chrom")[0];
    current_region.chromXML = chrom;
  }

  var glyphStyle = xhrObj.glyphStyle;
  if(glyphStyle == "express") { 
    drawExpressTrack(xhrObj);
  } else {
    drawFeatureTrack(xhrObj);
  }
}

//------------------------
//
// feature tracks
//
//------------------------

function drawFeatureTrack(xhrObj) {
  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhrObj.xmlDoc;
  var trackDiv   = xhrObj.trackDiv;
  var glyphStyle = xhrObj.glyphStyle;

  //var title = trackDiv.getAttribute("trackTitle");
  //var sourceName = trackDiv.getAttribute("source");
  //if(!title && sourceName) { title = sourceName; }
  //if(!title) { title = 'all data tracks'; }

  var peer = trackDiv.getAttribute("peer");
  var maxlevels = trackDiv.getAttribute("levels");
  var levelHeight = 10;
  if(glyphStyle == "transcript") { levelHeight=6; }

  //
  // clear and prep the SVG
  // to use bbox I need to attach to an SVG DOM tree
  // so a create e tmp svg of height 1
  // then I can move the tree over to the main view
  //
  var dwidth = current_region.display_width;
  var tmp_svg = createSVG(dwidth, 1); //offscreen basically, height does not matter
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
  if(feature_array.length > 1000) {
    glyphStyle = "thin";
    levelHeight=3;
  }

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
  var svg = createSVG(dwidth, 13+(maxlevels*levelHeight));
  trackDiv.removeChild(tmp_svg);
  trackDiv.appendChild(svg);
  for(var i=0; i<feature_array.length; i++) {
    var feature = feature_array[i];
    var level   = feature.getAttribute('glyph_level'); 

    var glyph = feature.glyphObj; 
    if(!glyph) { continue; }

    glyph.setAttributeNS(null, 'transform', "translate(0,"+ (level*levelHeight)+ ")");

    var fid  = feature.getAttribute('id'); 
    var peer = feature.getAttribute('peer'); 
    if(peer) { fid = peer + "::" + fid; }

    glyph.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +fid+ "\");");
    glyph.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    glyph.setAttributeNS(null, "onclick", "eedbClearSearchTooltip();expressLoadFeature(\"" +fid+ "\");");
  }
  g1.appendChild(drawHeading(xhrObj));
  if(glyphStyle == "cytoband") { 
    var glyph1 = drawCytoSpan(xhrObj);
    var glyph2 = drawChromScale(xhrObj);
    g1.appendChild(glyph1);
    g1.appendChild(glyph2);
  }

  tmp_svg.removeChild(g1);
  svg.appendChild(g1);
  xhrObj.svg = svg;
}


function drawFeature(xhrObj, feature, glyphStyle) {
  if(xhrObj.hideTrack) { return null; }
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
  if(glyphStyle == "transcript") { 
    glyph = drawLine(xfs, xfe, strand); 

    // now for loop on the sub features
    var subfeats = feature.getElementsByTagName("feature");
    //document.getElementById("message").innerHTML += fname + " has " + (subfeats.length) +" subfs; ";
    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      if(subfeature.getAttribute('category') != "exon") { continue; }
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
	   && !(glyphStyle == "cytoband")) { 
    var tobj = document.createElementNS(svgNS,'text');
    if(xfs>0) { 
      tobj.setAttributeNS(null, 'text-anchor', 'end' );
      tobj.setAttributeNS(null, 'x', xfs-1 );
    } else { 
      tobj.setAttributeNS(null, 'text-anchor', 'start' );
      tobj.setAttributeNS(null, 'x', xfe+2 );
    }
    if(glyphStyle == "transcript") { 
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

function drawExpressTrack(xhrObj) {
  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;
  var trackDiv   = xhrObj.trackDiv;
  var glyphStyle = xhrObj.glyphStyle;
  var trackID    = trackDiv.getAttribute("id");

  add_region_express(trackID, xmlDoc);

  var title = trackDiv.getAttribute("trackTitle");
  var sourceName = trackDiv.getAttribute("source");
  if(!title && sourceName) { title = sourceName; }
  if(!title) { title = 'all data tracks'; }

  var peer = trackDiv.getAttribute("peer");
  var maxlevels = trackDiv.getAttribute("levels");
  var levelHeight = 1;
  if(!maxlevels || maxlevels < 10) { maxlevels = 10; }
  if(xhrObj.hideTrack) { maxlevels=0; }
  xhrObj.maxlevels = maxlevels;

  //<express_region binspan="20.694" max_express="743.426"/>
  var express_params = xmlDoc.getElementsByTagName("express_region")[0];
  xhrObj.binspan     = express_params.getAttribute("binspan");
  xhrObj.max_express = express_params.getAttribute("max_express");

  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var dwidth = current_region.display_width;
  var svg = createSVG(dwidth, 15+(maxlevels*levelHeight));
  trackDiv.appendChild(svg);
  var g1 = document.createElementNS(svgNS,'g');

  //
  // then generate the expression glyphs
  //
  if(!(xhrObj.hideTrack)) {
    var expressbins = xmlDoc.getElementsByTagName("expressbin");
    for(var i=0; i<expressbins.length; i++) {
      var expressbin = expressbins[i];
      var glyph = drawExpressBin(xhrObj, expressbin, glyphStyle);
      if(glyph) { g1.appendChild(glyph); }
    }
  }
  title += " [max "+ xhrObj.max_express ;
  if(current_region.logscale==1) { title += " log"; }
  title += "]";
  xhrObj.title = title;
  g1.appendChild(drawHeading(xhrObj));

  svg.appendChild(g1);
  xhrObj.svg = svg;
}


function drawExpressBin(xhrObj, expressbin, glyphStyle) {
  var dwidth        = current_region.display_width;
  var chrom         = xhrObj.chrom;
  var start         = xhrObj.start;
  var end           = xhrObj.end;
  var chromloc      = chrom +":" + start + ".." + end;
  var maxlevels     = xhrObj.maxlevels;
  var max_express   = xhrObj.max_express;
  var logscale      = current_region.logscale;

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
    g2.appendChild(drawBar(bin, y_up,   10+maxlevels, "+")); 
    g2.appendChild(drawBar(bin, y_down, 10+maxlevels, "-")); 
    glyph = g2;
  }
  if(glyphStyle == "cytoband") { glyph = drawCytoBand(xfs, xfe, strand, fname); } 
  if(glyphStyle == "box") { glyph = drawBox(xfs, xfe, strand); } 
  if(glyphStyle == "arrow") { glyph = drawArrow(xpos, strand); }
  if(glyphStyle == "subfeature") { glyph = drawBox(xfs, xfe, strand); } 
  if(glyphStyle == "exon") { glyph = drawExon(xfs, xfe, strand); } 
  if(glyphStyle == "utr") { glyph = drawUTR(xfs, xfe, strand); } 
  if(glyphStyle == "thin") { glyph = drawThin(xfs, xfe, strand); } 

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
  var obj = document.createElementNS(svgNS,'svg');
  obj.setAttributeNS(null, 'width', width+'px');
  obj.setAttributeNS(null, 'height', height+'px');
  obj.setAttributeNS(null, "xlink", "http://www.w3.org/1999/xlink");

  //var rect = document.createElementNS(svgNS,'rect');
  //rect.setAttributeNS(null, 'x', '0px');
  //rect.setAttributeNS(null, 'y', '0px');
  //rect.setAttributeNS(null, 'width',  width+'px');
  //rect.setAttributeNS(null, 'height', height+'px');
  //rect.setAttributeNS(null, 'style', 'fill: pink;  stroke: pink;'); 
  //obj.appendChild(rect);

  return obj;
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
  block.setAttributeNS(null, 'points', xfs+' 9,' +xfe+' 9,' +xfe+' 21,' +xfs+' 21');
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


function drawCircle(x) {
  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', x+'px');
  circle.setAttributeNS(null, 'cy', '30px');
  circle.setAttributeNS(null, 'r', '10px');
  circle.setAttributeNS(null, 'fill', '#ff0000');
  circle.setAttributeNS(null, 'stroke', '#000000');
  circle.setAttributeNS(null, 'stroke-width', '5px');
  return circle;
}


function testDirectSVG() {
  //document.getElementById("message").update(svg);
  //document.getElementById("message").innerHTML= "hello world"; 
  //document.getElementById("svgTestArea2").innerHTML ="hello";

  var testArea2 = document.getElementById("message");
  clearKids(testArea2)
  var svg = createSVG(640, 50);
  testArea2.appendChild(svg);

  var g1 = document.createElementNS(svgNS,'g');

  //for(i=0; i<10; i++) { xpos = Math.random()*640; g1.appendChild(drawCircle(xpos)); }
  for(i=0; i<10; i++) {
    xpos = Math.random()*640;
    len = Math.random()*20;
    strand = '+';
    if(Math.random() > 0.5) strand='-';
    g1.appendChild(drawArrow(xpos, strand, (i%4)));
  }
  g1.appendChild(drawHeading('all tracks'));
  svg.appendChild(g1);

  //if(svg2) { document.getElementById("message").innerHTML= "hello world end";  }
}


function drawHeading(xhrObj) {
  //<text x="40" y="100" onclick="showRectColor()">Click on this text to show rectangle color.</text>
  var g2 = document.createElementNS(svgNS,'g');

  var obj = document.createElementNS(svgNS,'text');
  obj.setAttributeNS(null, 'x', '11px');
  obj.setAttributeNS(null, 'y', '9px');
  obj.setAttributeNS(null, "font-size","10");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  //var textNode = document.createTextNode(xhrObj.title);
  //document.getElementById("message").appendChild(document.createTextNode(title));
  obj.appendChild(document.createTextNode(xhrObj.title));
  g2.appendChild(obj);

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;'); 
  rect.setAttributeNS(null, "onclick", "toggleTrackHide(\"" +xhrObj.trackID+ "\");");
  g2.appendChild(rect);

  if(xhrObj.hideTrack) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    line.setAttributeNS(null, "onclick", "toggleTrackHide(\"" +xhrObj.trackID+ "\");");
    g2.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    circle.setAttributeNS(null, "onclick", "toggleTrackHide(\"" +xhrObj.trackID+ "\");");
    g2.appendChild(circle);
  }

  return g2;
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

