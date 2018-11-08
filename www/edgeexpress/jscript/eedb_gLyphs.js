var expressXMLHttp;
var gLyphTrack_array = new Array();
var trackXHR_array = new Array();
var expressXmlURL = "../cgi/edgeexpress.fcgi";
var eedbRegionURL = "../cgi/eedb_region.cgi";
var eedbObjectURL = "../cgi/eedb_object.fcgi";
var express_sort_mode = 'expid';
var svgNS = "http://www.w3.org/2000/svg";
var svgXlink = "http://www.w3.org/1999/xlink";
var newTrackID = 100;
var eedbDefaultAssembly;
var current_dragTrack;
var currentSelectTrackID;
var eedbCurrentUser ="";

var gLyphsInitParams = new Object();
gLyphsInitParams.display_width = Math.floor(800);

var current_feature;
var current_express_probe;
var current_expExpress;
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
// eeDB_search call back function section
//
//---------------------------------------------

function searchClick(id, geneName) {
  eedbClearSearchTooltip();
  //document.getElementById("searchResults").innerHTML="Searching...";
  if(loadFeatureInfo(id)) {
    centerOnFeature();
  }
}

function singleSearchValue(str) {
  //document.getElementById("message").innerHTML = "single search ";
  var str = document.getElementById("searchText").value;
  gLyphsInitLocation(str);
  return false;
}


//---------------------------------------------
//
// section to mananage the feature_info
// and XHR to get the feature DOM data
//
//---------------------------------------------

function loadFeatureInfo(id) {
  var url = eedbObjectURL;

  if(current_feature) {
    var curid  = current_feature.getAttribute("id");
    //var curpeer = current_feature.getAttribute("peer");
    //if(curpeer) { curid = curpeer +"::"+ curid; }
    if(id == curid) {
      centerOnFeature(current_feature);
      return;
    }
  }

  var fid = id;
  url += "?mode=feature&format=xml&id=" + fid;

  expressXMLHttp=GetXmlHttpObject();
  if(expressXMLHttp==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  //document.getElementById("message").innerHTML = url;

  //expressXMLHttp.onreadystatechange=displayObjectXHR;
  expressXMLHttp.open("GET",url,false); //not async
  expressXMLHttp.send(null);
  return displayObjectXHR();
}


function displayObjectXHR(mode) {

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

  if(document.getElementById('genome_region_div')) {
    document.getElementById('genome_region_div').style.display = 'block';
  }

  var features = xmlDoc.getElementsByTagName("feature");
  if(features && features.length>0) {
    return displayFeatureXHR(mode);
  }
  var experiments = xmlDoc.getElementsByTagName("experiment");
  if(experiments && experiments.length>0) {
    return displayExperimentInfo(experiments[0]);
  }
  return;
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

  if(!xmlDoc.getElementsByTagName("feature")) { return; }
  var feature = xmlDoc.getElementsByTagName("feature")[0];
  if(!feature) { return; }
  var fsource = feature.getElementsByTagName("featuresource")[0];
  if(fsource.getAttribute("name") == "eeDB_gLyphs_configs") {
    var symbols = feature.getElementsByTagName("symbol");
    var configUUID;
    for(var i=0; i<symbols.length; i++) {
      if(symbols[i].getAttribute("type") == "uuid") {
        configUUID = symbols[i].getAttribute("value");
      }
    }
    if(configUUID) { 
      gLyphsInitConfigUUID(configUUID); 
      reloadRegion();
      return 0;
    }
  } else if(fsource.getAttribute("name") == "eeDB_gLyph_track_configs") {
    var mdata = feature.getElementsByTagName("mdata");
    var configXML;
    for(var i=0; i<mdata.length; i++) {
      if(mdata[i].getAttribute("type") == "configXML") {
        configXML = mdata[i].firstChild.nodeValue;
      }
    }
    loadTrackConfig(configXML); 
    return 0;
  } else {
    displayFeatureInfo(feature);

    feature_express_probes = xmlDoc.getElementsByTagName("feature_express");
    displayProbeInfo();

    current_express_probe = feature_express_probes[0];
    //current_express_probe = processFeatureExpressProbe(feature_express_probes[0]);
    drawExpressionData();  //use the current_express_probe global variable
  }
  return 1;
}



function processFeatureExpressProbe(probeXML) {
  if(!probeXML) { return undefined; }

  var expExpress = new Object;

  var heading_text = probeXML.getAttribute("probe_title");
  if(!heading_text) {
    heading_text = "expression";
    var feature = probeXML.getElementsByTagName("feature")[0];
    if(feature) {
      var fsource = feature.getElementsByTagName("featuresource")[0];
      heading_text = "[" + fsource.getAttribute("name") + "]   " + feature.getAttribute("desc");
    }
    var region = probeXML.getElementsByTagName("express_region")[0];
    if(region) {
      var asm    = region.getAttribute("asm").toUpperCase();
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
    experiment.expID     = express[i].getAttribute("experiment_id");
    experiment.value     = parseFloat(express[i].getAttribute("value"));
    experiment.sig_error = parseFloat(express[i].getAttribute("sig_error"));

    expExpress.experiments[experiment.expID] = experiment;
    expExpress.experiment_array.push(experiment);

    if(experiment.value > max_value) max_value = experiment.value;
  }
  expExpress.max_value = max_value;
  return expExpress;
} 


function processExpressRegionExperiments(regionXML) {
  if(!regionXML) { return undefined; }

  var trackID      = regionXML.getAttribute("trackID");
  var glyphTrack   = gLyphTrack_array[trackID];
  var selection    = glyphTrack.selection;

  var expExpress = new Object;
  expExpress.trackID = trackID;

  var heading_text = regionXML.getAttribute("probe_title");
  if(!heading_text) {
    heading_text = "expression";
    var feature = regionXML.getElementsByTagName("feature")[0];
    if(feature) {
      var fsource = feature.getElementsByTagName("featuresource")[0];
      heading_text = "[" + fsource.getAttribute("name") + "]   " + feature.getAttribute("desc");
    }
    var region = regionXML.getElementsByTagName("express_region")[0];
    if(region) {
      var asm    = region.getAttribute("asm").toUpperCase();
      var chrom  = region.getAttribute("chrom");
      var start  = region.getAttribute("start");
      var end    = region.getAttribute("end");
      heading_text = "region: "+ asm + " " +chrom+ ":" +start+ ".." +end;
    }
  }
  if(selection) { 
    var ss = selection.chrom_start;
    var se = selection.chrom_end;
    if(ss>se) { var t=ss; ss=se; se=t; }
    var len = se-ss+1;
    if(len > 1000000) { len = (len/1000000) + "mb"; }
    else if(len > 1000) { len = (len/1000) + "kb"; }
    else { len += "bp"; }
    heading_text = heading_text + " ("+ss +".."+se+")  "+len; 
  }
  expExpress.heading_text = heading_text;
  expExpress.experiment_array = new Array;

  expExpress.experiments = glyphTrack.experiments;
  for(var expID in expExpress.experiments){
    var experiment = expExpress.experiments[expID]; 
    experiment.value = 0;  //reset
    experiment.sense_value = 0;  //reset
    experiment.antisense_value = 0;  //reset
    expExpress.experiment_array.push(experiment);
  }

  var max_value = 0;
  var express_bins = regionXML.getElementsByTagName("expressbin");
  for(var i=0; i<express_bins.length; i++) {
    var expbin = express_bins[i];
    var bin_start = expbin.getAttribute("start");
    if(selection) {
      var ss = selection.chrom_start;
      var se = selection.chrom_end;
      if(ss>se) { var t=ss; ss=se; se=t; }
      if(((bin_start < ss) || (bin_start > se))) { continue; }
    }

    var exp_express = expbin.getElementsByTagName("exp_express");
    for(var j=0; j<exp_express.length; j++) {
      var expID            = exp_express[j].getAttribute("exp_id");
      var datatype         = exp_express[j].getAttribute("datatype");
      var total_value      = parseFloat(exp_express[j].getAttribute("total"));
      var sense_value      = parseFloat(exp_express[j].getAttribute("sense"));
      var antisense_value  = parseFloat(exp_express[j].getAttribute("antisense"));

      var experiment = expExpress.experiments[expID];
      if(experiment) {
        experiment.value += total_value;
        experiment.sense_value += sense_value;;
        experiment.antisense_value += antisense_value;
        experiment.exptype  = datatype;
        if(experiment.value > max_value) max_value = experiment.value;
        if(experiment.sense_value > max_value) max_value = experiment.sense_value;
        if(experiment.antisense_value > max_value) max_value = experiment.antisense_value;
      }
    }
  }
  expExpress.max_value = max_value;
  return expExpress;
} 


function add_region_express(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  if(!(glyphTrack.expressData)) { return; }

  var xmlDoc = glyphTrack.expressData.xmlDoc;
  if(!xmlDoc) { return; }
  xmlDoc.setAttribute("trackID", trackID);
  region_express_probes[trackID] = xmlDoc 
  displayProbeInfo();

  current_express_probe = xmlDoc;
  drawExpressionData();  //use the current_express_probe global variable
}

function express_sort_func(a,b) {
  var rtnval=0;
  if(express_sort_mode == 'norm') {
      var norm_a = a.value;
      var norm_b = b.value;
      rtnval = norm_b - norm_a;
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
  else { //expID
      var expa = a.expID
      var expb = b.expID
      rtnval = expa - expb;
  }
  return rtnval;
}


function change_express_sort(mode) {
  express_sort_mode = mode;
  drawExpressionData();
}


function drawExpressionData() {
  //test method to replace old method

  if(!current_express_probe) { 
    var expdiv = document.getElementById("express_div");
    if(expdiv) { clearKids(expdiv); }
    return; 
  }

  var experiment_expression = current_express_probe.getElementsByTagName("experiment_expression");
  var expExpress = undefined;
  if(experiment_expression.length>0) {
    expExpress = processFeatureExpressProbe(current_express_probe);
  } else {
    expExpress = processExpressRegionExperiments(current_express_probe);
  }
  current_expExpress = expExpress;
  current_region.active_trackID = current_expExpress.trackID;
  drawExperimentExpression();
  updateTitleBar();
}


function drawExperimentExpression() { 

  var expExpress = current_expExpress;

  var expdiv = document.getElementById("express_div");
  if(!expdiv) return;
  clearKids(expdiv);

  if(!expExpress) return;
  var experiments = expExpress.experiment_array;
  experiments.sort(express_sort_func);
  var trackID = expExpress.trackID;
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) {
    current_expExpress = undefined;
    return;
  }

  var svg = createSVG(740, 25 + (12*experiments.length));
  expdiv.appendChild(svg);

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  svg.appendChild(g1);

  var heading = document.createElementNS(svgNS,'text');
  heading.setAttributeNS(null, 'x', '10px');
  heading.setAttributeNS(null, 'y', '14px');
  heading.setAttributeNS(null, "font-weight","bold");
  heading.setAttributeNS(null, "font-size","12pt");
  heading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  var tn1 = document.createTextNode(expExpress.heading_text);
  heading.appendChild(tn1);
  g1.appendChild(heading);

  if(glyphTrack) {
    if(!glyphTrack.strandless) {
      var head1 = document.createElementNS(svgNS,'text');
      head1.setAttributeNS(null, 'x', '480px');
      head1.setAttributeNS(null, 'y', '23px');
      head1.setAttributeNS(null, 'text-anchor', "end");
      head1.setAttributeNS(null, "font-size","8pt");
      head1.appendChild(document.createTextNode("<- reverse strand"));
      g1.appendChild(head1);

      var head2 = document.createElementNS(svgNS,'text');
      head2.setAttributeNS(null, 'x', '520px');
      head2.setAttributeNS(null, 'y', '23px');
      head2.setAttributeNS(null, "font-size","8pt");
      head2.appendChild(document.createTextNode("forward strand ->"));
      g1.appendChild(head2);
    } else {
      var head1 = document.createElementNS(svgNS,'text');
      head1.setAttributeNS(null, 'x', '270px');
      head1.setAttributeNS(null, 'y', '23px');
      head1.setAttributeNS(null, "font-size","8pt");
      head1.appendChild(document.createTextNode("strandless"));
      g1.appendChild(head1);
    }
  }


  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];

    var hideGlyph = createHideExperimentWidget(experiment);
    hideGlyph.setAttributeNS(null, 'transform', "translate(0,"+ ((i*12)+26) +")");
    g1.appendChild(hideGlyph);

    var exptype   = experiment.exptype;
    var expname   = experiment.expname;
    var expID     = experiment.expID;
    var value     = experiment.value;
    var sig_error = experiment.sig_error;
    var hide      = experiment.hide;
    
    if(expname) {
      var expname2 = expname.substring(0,41);
      if(expname != expname2) { expname = expname2 +"..."; }
    }
    if(exptype) { expname += " ["+ exptype +"]"; }

    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+35) +'px');
    text.setAttributeNS(null, "title", "experiment");
    text.setAttributeNS(null, "onclick", "loadFeatureInfo(\"" +expID+ "\");");
    //text.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +expID+ "\");");
    //text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    text.appendChild(document.createTextNode(expname));
    g1.appendChild(text);
  }

  var scale = 225.0 / expExpress.max_value;
  for(var i=0; i<experiments.length; i++) {
    var value           = experiments[i].value;
    var sense_value     = experiments[i].sense_value;
    var antisense_value = experiments[i].antisense_value;
    var sig_error       = experiments[i].sig_error;

    //if((sig_error < 0.01) || (sig_error >0.99)) ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
    //else ctx.fillStyle = "rgba(170, 170, 170, 0.5)";
    //ctx.fillRect (270, i*12+2, newvalue, 10);

    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', '270px');
      rect.setAttributeNS(null, 'y', ((i*12)+26) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      rect.setAttributeNS(null, 'opacity', "0.5");
      if((sig_error < 0.01) || (sig_error >0.99)) rect.setAttributeNS(null, 'fill', "rgb(0, 0, 230)");
      else rect.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      g1.appendChild(rect);

      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', '280px');
      text1.setAttributeNS(null, 'y', ((i*12)+35) +'px');
      text1.appendChild(document.createTextNode(Math.round(value*1000.0)/1000.0));
      g1.appendChild(text1);

    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', '500px');
      rect1.setAttributeNS(null, 'y', ((i*12)+26) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      rect1.setAttributeNS(null, 'opacity', "0.85");
      if((sig_error < 0.01) || (sig_error >0.99)) rect1.setAttributeNS(null, 'fill', "green");
      else rect1.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      g1.appendChild(rect1);

      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (500-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)+26) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      rect2.setAttributeNS(null, 'opacity', "0.85");
      if((sig_error < 0.01) || (sig_error >0.99)) rect2.setAttributeNS(null, 'fill', "purple");
      else rect2.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      g1.appendChild(rect2);

      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', '505px');
      text1.setAttributeNS(null, 'y', ((i*12)+35) +'px');
      text1.appendChild(document.createTextNode(Math.round(sense_value*1000.0)/1000.0));
      g1.appendChild(text1);

      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', '495px');
      text2.setAttributeNS(null, 'y', ((i*12)+35) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(antisense_value*1000.0)/1000.0));
      g1.appendChild(text2);

    }

  }

  setupExpExpressSearchFilter();
  return g1;
}


function setupExpExpressSearchFilter() {
  //----------
  var trackID    = current_expExpress.trackID;
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }

  var expSearchSet = document.getElementById("expExp_search");
  if(!expSearchSet) { return; }
  expSearchSet.setAttribute("class","EEDBsearchSet");
  expSearchSet.setAttribute('style',"width:220px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  expSearchSet.innerHTML = "";
  expSearchSet.appendChild(document.createElement('hr'));

  var expSpan = document.createElement('span');
  expSpan.innerHTML = "Experiment filter:";
  expSpan.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif;");
  expSpan.setAttribute("onclick", "eedbClearSearchResults(\""+ expSearchSet.id + "\");");
  expSearchSet.appendChild(expSpan);

  var expInputDiv = document.createElement('div');
  var expInput = document.createElement('input');
  expInput.setAttribute('style', "width:120px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  expInput.id = "expExp_search_input";
  expInput.setAttribute('type', "text");
  expInput.setAttribute('value', glyphTrack.expfilter);
  //expInput.setAttribute("onkeyup", "eedbMultiSearch(\""+ expSearchSet.id +"\", this.value, event); reconfigTrackParam(\""+ trackID+"\", 'expfilter', this.value);");
  expInput.setAttribute("onkeyup", "eedbMultiSearch(\""+ expSearchSet.id +"\", this.value, event); ");
  expInput.setAttribute("onsubmit", "applyExpExpressFilterSearch();");
  expInputDiv.appendChild(expInput);

  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "apply filter");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "applyExpExpressFilterSearch();");
  expInputDiv.appendChild(button1);
  expSearchSet.appendChild(expInputDiv);

  var expSearch1 = document.createElement('div');
  expSearch1.id = "expExp_search" + trackID + "_expsearch1";
  expSearch1.setAttribute('class', "EEDBsearch");
  expSearch1.setAttribute('mode', "experiments");
  expSearch1.setAttribute("peer", glyphTrack.peerName);
  expSearch1.setAttribute('style',"width:250px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  expSearchSet.appendChild(expSearch1);

} 


function applyExpExpressFilterSearch() {
  var trackID    = current_expExpress.trackID;
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }

  var expInput = document.getElementById("expExp_search_input");
  if(!expInput) { return; }
  //document.getElementById("message").innerHTML = "exp filter: " + expInput.value;
  glyphTrack.expfilter = expInput.value;
  glyphTrack.experiments = undefined;
  prepareTrackXHR(trackID);
}


function createHideExperimentWidget(experiment) {
  if(current_region.exportconfig && current_region.exportconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 'hide experiment');

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;');
  rect.setAttributeNS(null, "onclick", "toggleExperimentHide(\"" +experiment.expID+ "\");");
  g1.appendChild(rect);

  if(experiment.hide) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    line.setAttributeNS(null, "onclick", "toggleExperimentHide(\"" +experiment.expID+ "\");");
    g1.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    circle.setAttributeNS(null, "onclick", "toggleExperimentHide(\"" +experiment.expID+ "\");");
    g1.appendChild(circle);
  }
  return g1;
}

function toggleExperimentHide(expID) {
  if(!current_expExpress) { return; }
  var experiment = current_expExpress.experiments[expID];
  if(!experiment) { return; }
  experiment.hide = !(experiment.hide);
  drawExperimentExpression();

  var trackID    = current_expExpress.trackID;
  if(!trackID) { return; }
  var glyphTrack = gLyphTrack_array[trackID];
  if(!glyphTrack) { return; }
  //prepareTrackXHR(trackID);
  prepareTrackData(trackID);
}

//----------------------------------------------

//----------------------------------------------
//
// somewhat generic functions which display an
// info box from an eeDB feature DOM
//
//----------------------------------------------

function displayProbeInfo() {
  // feature is an XML DOM document which holds the feature data

  var probeinfo = document.getElementById("probe_info");
  if(probeinfo === undefined) { return; }

  probeinfo.setAttribute("style", 
                    "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                    "width:330px; z-index:-10; "+
                    "background-color:rgb(245,255,255); border:inset; border-width:2px; padding: 3px 3px 3px 3px;");

  var regionDivs = probeinfo.getElementsByClassName("gLyphsRegionProbe");
  if(regionDivs !== undefined) {
    regionDivs.innerHTML = "";
    var regionProbeDiv = regionDivs[0];
    var object_html = "";
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
      //var probe_title = title + ": "+ asm + " " +chrom+ ":" +start+ ".." +end;
      var probe_title = title;
      xmlDoc.setAttribute("probe_title", probe_title);

      object_html += "<div><a style=\"font-weight: bold;\" href=\"#express_div\" onclick=\"changeRegionProbe('" +trackID+ "')\"  >";
      object_html += probe_title;
      object_html += "</a></div>";
    }
    regionProbeDiv.innerHTML = object_html;
  }

  for(var i=0; i<feature_express_probes.length; i++) {
    var feature = feature_express_probes[i].getElementsByTagName("feature")[0];
    var fsource = feature.getElementsByTagName("featuresource")[0];

    var fid = feature.getAttribute("id");
    object_html += "<div><a style=\"font-weight: bold;\" href=\"#express_div\" onclick=\"changeFeatureProbe('" +fid+ "')\"  >" 
                   + feature.getAttribute("desc")+"</a>";
    object_html += "<span style=\"font-size:9px;\">  [" + fsource.getAttribute("name") + "]</span>";
    object_html += "</div>";
  }

  object_html += "</div>";
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
  if(current_express_probe) { drawExpressionData(); }
  updateTitleBar();
}

//----------------------------------------------
// gLyphs generic section for working with
//  feature XML DOM
// and the <div id="feature_info"> element
//----------------------------------------------

function centerOnFeature(feature) {
  // feature is an XML DOM document which holds the feature data
  if(feature === undefined) { feature = current_feature; }
  if(feature === undefined) { return; }

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

  gLyphsSetLocation(feature.getAttribute("asm"), feature.getAttribute("chr"), start, end);
  reloadRegion();
}


function displayFeatureInfo(featureXML) {
  // feature is an XML DOM document which holds the feature data

  current_feature = featureXML;
  //document.getElementById("feature_info").innerHTML= "<div>does this work at least</div>";

  var fid   = featureXML.getAttribute("id");
  var peer  = featureXML.getAttribute("peer");
  var start = featureXML.getAttribute("start")-0;
  var end   = featureXML.getAttribute("end")-0;
  var range = end-start;
  start -= Math.round(range*.25);
  end += Math.round(range*.25);
  
  if(peer) { fid = peer +"::"+fid; }

  var fsource = featureXML.getElementsByTagName("featuresource")[0];
  var symbols = featureXML.getElementsByTagName("symbol");
  var mdata = featureXML.getElementsByTagName("mdata");
  var maxexpress = featureXML.getElementsByTagName("max_expression");
  var synonyms = "";
  var description = "";
  var entrez_id;
  var omim_id;
  var genloc = "";
  var chromloc = featureXML.getAttribute("asm").toUpperCase() +" "
                +featureXML.getAttribute("chr") +":"
                +featureXML.getAttribute("start") +".."
                +featureXML.getAttribute("end")
                +featureXML.getAttribute("strand");

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
    if((symbols[i].getAttribute("type") == "EntrezGene") && (featureXML.getAttribute("desc") != symbols[i].getAttribute("value"))) {
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
                 //"<a target=\"top\" href=\"../view/#" + fid +"\">"+ featureXML.getAttribute("desc")+"</a>"+
                 featureXML.getAttribute("desc")+
                 "</span>";
  object_html += " <span style=\"font-size:9px;\">" + fsource.getAttribute("category") +" : " + fsource.getAttribute("name") + "</span>";
  if(description.length > 0) object_html += "<div>" +description + "</div>";
  object_html += "<p></p>";
  if(synonyms.length > 0) object_html += "<div>alias: " + synonyms +"</div>";
  if(entrez_id || omim_id) {
    object_html += "<div>";
    if(entrez_id) object_html += "EntrezID:<a target=\"entrez\" "
                              + "href=\"http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene&amp;cmd=Retrieve&amp;dopt=full_report&amp;list_uids=" +entrez_id +"\""
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


function displayExperimentInfo(experiment) {
  // feature is an XML DOM document which holds the feature data

  var expinfo_div = document.getElementById("experiment_info");
  if(!expinfo_div) { return; }

  var id            = experiment.getAttribute("id");
  var name          = experiment.getAttribute("name");
  var exp_acc       = experiment.getAttribute("exp_acc");
  var series_name   = experiment.getAttribute("series_name");
  var series_point  = experiment.getAttribute("series_point");

  var symbols = experiment.getElementsByTagName("symbol");
  var mdata = experiment.getElementsByTagName("mdata");
  var synonyms = "";
  var description = "";
  var comments = "";
  var entrez_id;
  var omim_id;
  var genloc = "";

  for(var i=0; i<mdata.length; i++) {
    if(mdata[i].getAttribute("type") == "description") description = mdata[i].firstChild.nodeValue;
    if(mdata[i].getAttribute("type") == "comments") comments = mdata[i].firstChild.nodeValue;
  }
  for(var i=0; i<symbols.length; i++) {
    if(symbols[i].getAttribute("type") == "ILMN_hg6v2_key") {
      synonyms += symbols[i].getAttribute("value") + " ";
    }
    if(symbols[i].getAttribute("type") == "Entrez_synonym") {
      synonyms += symbols[i].getAttribute("value") + " ";
    }
    if((symbols[i].getAttribute("type") == "EntrezGene") && (experiment.getAttribute("desc") != symbols[i].getAttribute("value"))) {
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
  object_html += "<a target=\"top\" href=\""+eedbObjectURL+"?id="+id+"\" >"+id +"</a><br></br>";

  object_html += "<span style=\"font-size:12px; font-weight: bold;\">"+name+"</span>";

  if(description.length > 0) { object_html += "<div>description: " +description + "</div>"; }
  if(comments.length > 0) { object_html += "<div>comments: " +comments + "</div>"; }
  object_html += "<p></p>";
  if(synonyms.length > 0) object_html += "<div>alias: " + synonyms +"</div>";
  if(entrez_id || omim_id) {
    object_html += "<div>";
    if(entrez_id) object_html += "EntrezID:<a target=\"entrez\" "
                              + "href=\"http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene&amp;cmd=Retrieve&amp;dopt=full_report&amp;list_uids=" +entrez_id +"\""
                              +  ">" + entrez_id +"</a> ";
    if(omim_id) object_html += "OMIM:<a target=\"OMIM\" "
                            + "href=\"http://www.ncbi.nlm.nih.gov/entrez/dispomim.cgi?id=" 
                            + omim_id + "\">" + omim_id +"</a>";
    object_html += "</div>";
  }
  object_html += "</div>";
  //expinfo_div.innerHTML = "does this work?"; return;
  expinfo_div.innerHTML= object_html;
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
    gLyphsInitParams.display_width = new_width;
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

function gLyphsInit() {
  if(!browserCompatibilityCheck()) {
    window.location ="browser_upgrade.html";
  }

  dhtmlHistory.initialize();
  dhtmlHistory.addListener(gLyphsHandleHistoryChange);

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

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
  if(initialURL && parseConfigFromURL(initialURL)) {
    reloadRegion();
  }
  else {
    if(gLyphsInitParams.uuid !== undefined) { 
      gLyphsInitConfigUUID(gLyphsInitParams.uuid); 
      reloadRegion();
    } else {
      gLyphTracksInit();
    }
  }
}


function gLyphTracksInit(gLyphTrackSetID) {

  //set a global event to catch all mouseup events to end all dragging
  //need in case someone starts drag in a widget but releases the mouse
  //outside of that widget
  document.onmouseup = endDrag;

  var titlediv = document.getElementById("gLyphs_title");
  titlediv.innerHTML = encodehtml(current_region.title);

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
    gLyphTrack.tackmode   = "annotation";
    glyphTrack.hideTrack  = 0;
    glyphTrack.title      = title;
    glyphTrack.peerName   = trackDiv.getAttribute("peer");
    glyphTrack.sources    = sourceName;
    glyphTrack.source_ids = "";
    glyphTrack.server     = trackDiv.getAttribute("server");
    glyphTrack.serverType = trackDiv.getAttribute("server_type");
    glyphTrack.glyphStyle = trackDiv.getAttribute("glyph");
    if(glyphTrack.glyphStyle == "express") { gLyphTrack.tackmode = "expression"; }
    glyphTrack.exptype    = trackDiv.getAttribute("exptype");
    glyphTrack.expfilter  = "";
    glyphTrack.maxlevels  = Math.floor(trackDiv.getAttribute("levels"));
    glyphTrack.exp_mincut = 0.0;
    glyphTrack.expscaling = "auto";
    glyphTrack.logscale   = 0;
    glyphTrack.submode    = "5end";
    glyphTrack.binning    = "sum";
    glyphTrack.strandless = false;
    //glyphTrack.maxlevels  = 100;

    gLyphTrack_array[trackID] = glyphTrack;
    drawTrack(trackID);
  }

  createAddTrackTool();

  //
  // first get defaults from the XHTML document
  //
  var loc = glyphset.getAttribute("loc");
  var fid = glyphset.getAttribute("feature");
}


function gLyphsInitLocation(str) {
  if(!current_region) {
    current_region = new Object();
    current_region.display_width = Math.floor(800);
    current_region.asm = eedbDefaultAssembly;
  }
  if(current_region.asm === undefined) { current_region.asm = eedbDefaultAssembly; }

  var re1 = /^(.+)\:\:(.+)$/;
  var asm_match = re1.exec(str);
  if(asm_match && (asm_match.length == 3)) {
    current_region.asm = asm_match[1];
    str = asm_match[2];
    //document.getElementById("message").innerHTML += "loc with assembly["+current_region.asm+"] -- "+str;
  } else {
    //document.getElementById("message").innerHTML += "use previous assembly["+current_region.asm+"] - "+str;
  }

  var re = /^(.+)\:(\d+)\.\.(\d+)$/;
  var mymatch = re.exec(str);
  if(mymatch && (mymatch.length == 4)) {
    //document.getElementById("message").innerHTML = "submit loc: " + str;

    gLyphsSetLocation(current_region.asm, mymatch[1], Math.floor(mymatch[2]), Math.floor(mymatch[3]));

    document.getElementById('genome_region_div').style.display = 'block';
    eedbEmptySearchResults();
    reloadRegion();
  }
}


function gLyphsSetLocation(asm, chrom, start, end) {
  if(start<1) { start = 1; }
  if(end<1) { end = 1; }
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
  if(current_region.chrom_length && (end > current_region.chrom_length)) {
    end = current_region.chrom_length;
  }
  current_region.asm   = asm;
  current_region.chrom = chrom;
  current_region.start = start;
  current_region.end   = end;
}


function parseConfigFromURL(urlConfig) {
  //document.getElementById("message").innerHTML += "parseConfigFromURL " + urlConfig;
  if(!urlConfig) { return false; }
  var params = urlConfig.split(";");
  var rtnval = false;
  for(var i=0; i<params.length; i++) {
    var param = params[i];
    //document.getElementById("message").innerHTML += " param[" + param +"]";
    var tagvalue = param.split("=");
    if(tagvalue.length != 2) { continue; }
    if(tagvalue[0] == "config") {
      gLyphsInitConfigUUID(tagvalue[1]);
      rtnval = true;
    }
    if(tagvalue[0] == "loc") {
      gLyphsInitLocation(tagvalue[1]);
      rtnval = true;
    }
  }
  return rtnval;
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
  var len    = end-start+1;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }
  current_region.length_desc = "[len "+ len + " ]";

  //clear out the old region probes
  region_express_probes = new Object();

  var chromloc = chrom +":" + start + ".." + end;

  current_region.loc_desc = asm.toUpperCase() + "::" + chromloc + "  [len "+ len + " ]";
  document.getElementById("gLyphs_location_info").innerHTML = current_region.loc_desc;

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

  glyphTrack.newconfig = undefined;

  showTrackLoading(trackID);

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
  var submode    = glyphTrack.submode;
  var binning    = glyphTrack.binning;
  var expfilter  = glyphTrack.expfilter;
  var spstream_mode = glyphTrack.spstream;

  var dwidth     = current_region.display_width;
  
  //document.getElementById("message").innerHTML = trackID + " peer["+peerName+"]  sourceNames["+sourceName+"]  sourceIDs["+source_ids+"]";

  var url = eedbRegionURL;
  var params = "asm=" + current_region.asm ;
  if(peerName) { params += ";peers=" + peerName; }
  if(source_ids) { params += ";source_ids=" + source_ids; }
  else {
    //if(glyphTrack.peer) { params += ";peers=" +glyphTrack.peer.getAttribute("uuid"); }
    if(sourceName) { params += ";types=" + sourceName; }
  }
  if(exptype) { params += ";exptype=" + exptype; }
  if(spstream_mode) { params += ";spstream=" + spstream_mode; }
  
  if(glyphStyle && (glyphStyle=='cytoband')) { params += ";chrom=" + chrom; }
  else { params += ";loc=" + chromloc; }

  if(glyphStyle && (glyphStyle=='express')) {
    params += ";width="+dwidth;
    params += ";format=xml;mode=express;submode=" + submode + ";binning=" + binning;
    if(expfilter) { params += ";expfilter=" + expfilter; }
  }
  else if(glyphStyle && (glyphStyle=='transcript' || glyphStyle=='probesetloc' || glyphStyle=='thin-transcript')) {
    params += ";format=xml;submode=subfeature";
  }
  else if(glyphStyle && glyphStyle=='seqtag') {
    params += ";format=xml;mode=objects;submode=full_feature";
  } else {
    params += ";format=xml;mode=region";
  }
  //if(glyphStyle && (glyphStyle=='cytoband')) { document.getElementById("message").innerHTML = params; }
  //if(glyphStyle && (glyphStyle=='express')) { document.getElementById("message").innerHTML = params; }

  var gylphTrack = gLyphTrack_array[trackID];

  if(trackXHR_array[trackID] != null) { delete trackXHR_array[trackID]; }

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

  trackXHR_array[trackID] = xhrObj;

  //damn this is funky code to get a parameter into the call back funtion
  //xhr.onreadystatechange= function(id) { return function() { drawTrack(id); };}(trackID);
  xhr.onreadystatechange= function(id) { return function() { prepareTrackData(id); };}(trackID);

  if(params.length < 1000) {
    xhr.open("GET",url+"?"+params,true);
    xhr.send(null);
  } else {
    xhr.open("POST",url,true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Content-length", params.length);
    xhr.setRequestHeader("Connection", "close");
    xhr.send(params);
  }
}


function regionChange(mode) {
  var asm   = current_region.asm;
  var chrom = current_region.chrom;
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

  gLyphsSetLocation(asm, chrom, start, end);

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


function prepareTrackData(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var xhrObj = trackXHR_array[trackID];
  if(xhrObj == null) {  return; }
  if((xhrObj.asm != current_region.asm) ||
     (xhrObj.chrom != current_region.chrom) ||
     (xhrObj.start != current_region.start) ||
     (xhrObj.end != current_region.end)) { return; }

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

  // get the chrom object
  if(xmlDoc.getElementsByTagName("chrom")) {
    var chromXML = xmlDoc.getElementsByTagName("chrom")[0];
    if(chromXML) { 
      current_region.chrom_length = chromXML.getAttribute('length'); 
    }
  }

  if(glyphTrack.glyphStyle == "express") { 
    prepareExpressTrackData(glyphTrack, xhrObj);
  } else {
    prepareFeatureTrackData(glyphTrack, xhrObj);
    //all information is now transfered into objects so
    //can delete XML
    xhrObj.xhr = undefined;
    delete trackXHR_array[trackID];
  }
 
  drawTrack(trackID);
}


function drawTrack(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  //clear the newconfig / reconfig
  glyphTrack.newconfig = undefined;

  if(glyphTrack.hideTrack || (glyphTrack.svg === undefined)) { 
    clearKids(glyphTrack.trackDiv)
    var svg = createSVG(current_region.display_width+10, 13);
    glyphTrack.svg = svg;
    glyphTrack.top_group = document.createElementNS(svgNS,'g');
    svg.appendChild(glyphTrack.top_group);
    glyphTrack.trackDiv.appendChild(svg);
    drawHeading(glyphTrack);
    createMoveBar(glyphTrack);
    return;
  }
  //document.getElementById("message").innerHTML= 'drawTrack ' + trackID;

  var glyphStyle = glyphTrack.glyphStyle;
  if(glyphStyle == "express") { 
    drawExpressTrack(glyphTrack);
  } else {
    drawFeatureTrack(glyphTrack);
  }
  createMoveBar(glyphTrack);
  //document.getElementById("message").innerHTML= 'drawTrack ' + trackID;
}

//------------------------
//
// feature tracks
//
//------------------------

function prepareFeatureTrackData(glyphTrack, xhrObj) {
  //this is the call back function after a new XHR has completed
  //which converts the XML into JSON objects so the XHR and XML
  //can deleted

  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;

  var feature_array = new Array();
  glyphTrack.feature_array = feature_array;

  // get the top features from the XML
  //TODO look into alternate method here. this will grab all features
  //and then I need to figure out if it is top or not. maybe can use children()
  var xml_features = xmlDoc.getElementsByTagName("feature");
  var mode = "full";
  var fcount=0;
  for(var i=0; i<xml_features.length; i++) {
    var featureXML = xml_features[i];
    if(featureXML.parentNode.tagName != "region") { continue; }
    fcount++;
  }
  if((glyphTrack.glyphStyle != "thin-transcript") && (fcount>2000)) { mode = "simple"; }
  for(var i=0; i<xml_features.length; i++) {
    var featureXML = xml_features[i];
    if(featureXML.parentNode.tagName != "region") { continue; }
    var feature;
    if(mode == "full") {
      feature = convertFullFeatureXML(featureXML);
    } else {
      feature = convertFeatureXML(featureXML);
    }
    feature_array.push(feature);
  }
  //document.getElementById("message").innerHTML= 'prepareFeatureTrackData ' + glyphTrack.trackID + " [" +feature_array.length +"]";
}

function convertFeatureXML(featureXML) {
  var feature       = new Object;
  feature.name      = featureXML.getAttribute('desc');
  feature.id        = featureXML.getAttribute('id');
  feature.fsrc_id   = featureXML.getAttribute('fsrc_id');
  feature.fsrc_name = featureXML.getAttribute('fsrc');
  feature.category  = featureXML.getAttribute('category');
  feature.start     = featureXML.getAttribute('start');
  feature.end       = featureXML.getAttribute('end');
  feature.strand    = featureXML.getAttribute('strand');
  feature.peer      = featureXML.getAttribute('peer');

  if(featureXML.getAttribute('peer')) {
    feature.peer = featureXML.getAttribute('peer');
    feature.id   = peer + "::" + feature.id;
  }
  return feature;
}

function convertFullFeatureXML(featureXML) {
  var feature = convertFeatureXML(featureXML);

  //now the metadata
  feature.mdata = new Array();
  var mdata = featureXML.getElementsByTagName("mdata");
  for(var i=0; i<mdata.length; i++) {
    var data   = new Object;
    data.type  = mdata[i].getAttribute("type");
    data.value = mdata[i].firstChild.nodeValue;
    feature.mdata.push(data);
  }
  var symbols = featureXML.getElementsByTagName("symbol");
  for(var i=0; i<symbols.length; i++) {
    var data   = new Object;
    data.type  = symbols[i].getAttribute("type");
    data.value = symbols[i].getAttribute("value");
    feature.mdata.push(data);
  }

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
  return feature;
}

function drawFeatureTrack(glyphTrack) {
  //document.getElementById("message").innerHTML= 'drawFeatureTrack ' + glyphTrack.trackID;
  var trackDiv   = glyphTrack.trackDiv;
  var glyphStyle = glyphTrack.glyphStyle;

  var maxlevels = glyphTrack.maxlevels;
  var levelHeight = 10;
  if(glyphStyle == "transcript") { levelHeight=7; }
  if(glyphStyle == "thin-transcript") { levelHeight=3; }
  if(glyphStyle == "probesetloc") { levelHeight=7; }
  if(glyphStyle == "cytoband") { levelHeight=34; }

  if(glyphStyle == "cytoband") { 
    glyphTrack.title = current_region.asm.toUpperCase()  + " " + current_region.chrom +"  "+ 
                       current_region.start +".."+ current_region.end +" "+
                       current_region.length_desc;
  }

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
  // get the top features from the XML
  //
  var feature_array = glyphTrack.feature_array;

  if((glyphStyle!="arrow") && (feature_array.length > 2000)) { 
    if(glyphStyle=="transcript" || glyphStyle=="thin-transcript") { glyphStyle = "thin-transcript"; }
    else { glyphStyle = "thin"; }
  }
  if(glyphStyle=="thin") { levelHeight=3; }
  if(glyphStyle=="thin-transcript") { levelHeight=3; }

  //
  // then generate the glyphs (without tracking)
  // to use bbox I need to attach to an SVG DOM tree
  // then I can move the tree over to the main view
  //
  //document.getElementById("message").innerHTML= 'track:' + sourceName + " fcnt: " + feature_array.length + " style:"+glyphStyle;
  for(var i=0; i<feature_array.length; i++) {
    var feature = feature_array[i];
    var glyph = drawFeature(glyphTrack, feature, glyphStyle);
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
    feature.glyph_level = level;
    level_span[level] = fe+5;
  }
  maxlevels = level_span.length;

  //
  // then build the actual properly tracked view block
  //
  var svg = createSVG(dwidth+10, 14+(maxlevels*levelHeight));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 14+(maxlevels*levelHeight);
  trackDiv.removeChild(tmp_svg);
  trackDiv.appendChild(svg);

  // make a backing rectangle to capture the selection events
  var backRect = document.createElementNS(svgNS,'rect');
  backRect.setAttributeNS(null, 'x', '0px');
  backRect.setAttributeNS(null, 'y', '13px');
  backRect.setAttributeNS(null, 'width',  current_region.display_width+'px');
  backRect.setAttributeNS(null, 'height', (maxlevels*levelHeight)+'px');
  backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;');
  backRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmousemove", "eedbClearSearchTooltip();selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  if(current_region.exportconfig === undefined) { g_select.appendChild(backRect); }

  var selectRect = document.createElementNS(svgNS,'rect');
  selectRect.setAttributeNS(null, 'x', '0px');
  selectRect.setAttributeNS(null, 'y', '13px');
  selectRect.setAttributeNS(null, 'width',  '0px');
  selectRect.setAttributeNS(null, 'height', (maxlevels*levelHeight)+'px');
  selectRect.setAttributeNS(null, 'style', 'fill: lightgray;');
  selectRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
  selectRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
  selectRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  g_select.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;

  // now the features
  for(var i=0; i<feature_array.length; i++) {
    var feature = feature_array[i];
    var level   = feature.glyph_level; 

    var glyph = feature.glyphObj; 
    if(!glyph) { continue; }

    glyph.setAttributeNS(null, 'transform', "translate(0,"+ (2+level*levelHeight)+ ")");

    var fid  = feature.id 

    glyph.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    glyph.setAttributeNS(null, "onmouseover", "eedbSearchTooltip(\"" +fid+ "\");");
    glyph.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    glyph.setAttributeNS(null, "onclick", "eedbClearSearchTooltip();loadFeatureInfo(\"" +fid+ "\");");
  }

  drawHeading(glyphTrack);

  if(glyphStyle == "cytoband") { 
   var glyph1 = drawCytoSpan();
   var glyph2 = drawChromScale();
   g1.appendChild(glyph1);
   g1.appendChild(glyph2);
  }

  var trackLine = document.createElementNS(svgNS,'rect');
  if(current_region.trackline_xpos) { trackLine.setAttributeNS(null, 'x', (current_region.trackline_xpos-2)+'px'); } 
  else { trackLine.setAttributeNS(null, 'x', '0px'); }
  trackLine.setAttributeNS(null, 'y', '11px');
  trackLine.setAttributeNS(null, 'width',  '1px');
  trackLine.setAttributeNS(null, 'height', (maxlevels*levelHeight + 2)+'px');
  trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
  trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  if(current_region.exportconfig === undefined) {
    g1.appendChild(trackLine);
    glyphTrack.trackLine = trackLine;
  }

  drawSelection(glyphTrack);

  tmp_svg.removeChild(g1);
  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);
}


function drawFeature(glyphTrack, feature, glyphStyle) {
  var dwidth     = current_region.display_width;
  var chrom      = current_region.chrom;
  var start      = current_region.start;
  var end        = current_region.end;
  var chromloc   = chrom +":" + start + ".." + end;

  if(glyphStyle == "cytoband") { 
    //drawing whole chromosome
    start = 0;
    if(current_region.chrom_length) { end = current_region.chrom_length; }
  }

  var fname    = feature.name
  var fsrc_id  = feature.fsrc_id; 
  var category = feature.category; 
  var strand   = feature.strand; 
  var fs       = feature.start; 
  var fe       = feature.end; 
  var fid      = feature.id; 

  var xfs = dwidth*(fs-start)/(end-start); 
  var xfe = dwidth*(fe-start)/(end-start); 
  if(xfe-xfs < 0.7) { xfe = xfs + 0.7; }  //to make sure somthing is visible
  var len = xfe-xfs;
  var xc  = (xfe+xfs)/2;
  if(strand =="+") {xpos = xfs;} else {xpos = xfe;}

  if(xfe < 0) { return undefined; }
  if(xfs > dwidth) { return undefined; }

  var glyph = null;
  if(glyphStyle == "centroid") { glyph = drawCentroid(xfs, xfe, strand, xc); } 
  if(glyphStyle == "thick-arrow") { glyph = drawThickArrow(xfs, xfe, strand); } 
  if(glyphStyle == "cytoband") { glyph = drawCytoBand(xfs, xfe, strand, fname); } 
  if(glyphStyle == "box") { glyph = drawBox(xfs, xfe, strand); } 
  if(glyphStyle == "arrow") { glyph = drawArrow(xpos, strand); }
  if(glyphStyle == "subfeature") { glyph = drawBox(xfs, xfe, strand); } 
  if(glyphStyle == "exon") { glyph = drawExon(xfs, xfe, strand); } 
  if(glyphStyle == "thin-exon") { glyph = drawThinExon(xfs, xfe, strand); } 
  if(glyphStyle == "utr") { glyph = drawUTR(xfs, xfe, strand); } 
  if(glyphStyle == "thin") { glyph = drawThin(xfs, xfe, strand); } 
  if(glyphStyle == "line") { glyph = drawLine(xfs, xfe, strand); } 
  if(glyphStyle == "seqtag") { glyph = drawSeqTag(xpos, strand, feature, glyphTrack); }
  if(glyphStyle == "transcript" || glyphStyle=='probesetloc') { 
    glyph = drawLine(xfs, xfe, strand); 

    // now for loop on the sub features
    var subfeats = feature.subfeatures;
    if(subfeats) {
      //document.getElementById("message").innerHTML += fname + " has " + (subfeats.length) +" subfs; ";
      for(var j=0; j<subfeats.length; j++) {  
        var subfeature = subfeats[j];
        if(subfeature.category.match(/utr/)) { continue; }
        var sub_glyph = drawFeature(glyphTrack, subfeature, "exon"); 
        if(sub_glyph) { glyph.appendChild(sub_glyph); }
      } 
      for(var j=0; j<subfeats.length; j++) {  
        var subfeature = subfeats[j];
        if(!subfeature.category.match(/utr/)) { continue; }
        var sub_glyph = drawFeature(glyphTrack, subfeature, "utr"); 
        if(sub_glyph) { glyph.appendChild(sub_glyph); }
      } 
    }
  }
  if(glyphStyle=='thin-transcript') { 
    glyph = drawThinLine(xfs, xfe, strand); 
    var subfeats = feature.subfeatures;
    if(subfeats) {
      for(var j=0; j<subfeats.length; j++) {  
        var subfeature = subfeats[j];
        var sub_glyph = drawFeature(glyphTrack, subfeature, "thin-exon"); 
        if(sub_glyph) { glyph.appendChild(sub_glyph); }
      } 
    }
  }

  if(glyph && fname
           && !(glyphStyle.match(/utr/)) 
           && !(glyphStyle == 'exon') 
           && !(glyphStyle == 'thin') 
           && !(glyphStyle == 'arrow') 
           && !(glyphStyle == 'seqtag') 
           && !(glyphStyle == 'thin-transcript') 
	   && !(glyphStyle == "cytoband")) { 
    var tobj = document.createElementNS(svgNS,'text');
    tobj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
    if(xfs>0) { 
      tobj.setAttributeNS(null, 'text-anchor', 'end' );
      tobj.setAttributeNS(null, 'x', xfs-1 );
    } else { 
      tobj.setAttributeNS(null, 'text-anchor', 'start' );
      tobj.setAttributeNS(null, 'x', xfe+2 );
    }
    if(glyphStyle == "transcript" || glyphStyle=='probesetloc') { 
      tobj.setAttributeNS(null, 'y', '16px');
      tobj.setAttributeNS(null, "font-size","9px"); 
    } else { 
      tobj.setAttributeNS(null, 'y', '18px');
      tobj.setAttributeNS(null, "font-size","10px"); 
    }
    tobj.setAttributeNS(null, 'style', 'fill: black;');
    tobj.appendChild(document.createTextNode(fname));
    glyph.appendChild(tobj);
  }

  //if(!glyph) { glyph = drawCentroid(xfs, xfe, strand, xc); } 

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

//--------------------------------------
//
// expression tracks
//
//--------------------------------------

function prepareExpressTrackData(glyphTrack, xhrObj) {
  //this is the call back function after a new XHR has completed

  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;

  var maxlevels = glyphTrack.maxlevels;
  if(!maxlevels || maxlevels < 10) { maxlevels = 10; }
  glyphTrack.maxlevels = maxlevels;

  var expressData = new Object;
  glyphTrack.expressData = expressData;
  expressData.xmlDoc = xmlDoc;

  var express_params  = xmlDoc.getElementsByTagName("express_region")[0];
  if(express_params === undefined) { return; }
  expressData.binspan = express_params.getAttribute("binspan");

  if(glyphTrack.experiments === undefined) {
    glyphTrack.experiments = new Object();
  }
  var exps = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<exps.length; i++) {
    var expID = exps[i].getAttribute("id");
    var experiment = glyphTrack.experiments[expID];
    if(experiment === undefined) {
      experiment               = new Object;
      experiment.expID         = expID;
      experiment.exptype       = '';
      experiment.value         = 0.0;
      experiment.sig_error     = 1.0;
      experiment.hide          = 0;
      glyphTrack.experiments[experiment.expID] = experiment;
    }
    if(experiment.expname === undefined) {
      experiment.expname       = exps[i].getAttribute("name");
      experiment.exp_acc       = exps[i].getAttribute("exp_acc");
      experiment.platform      = exps[i].getAttribute("platform");
      experiment.series_name   = exps[i].getAttribute("series_name");
      experiment.series_point  = exps[i].getAttribute("series_point");
    }
  }

  //
  // calculate the max bin size
  //
  var expressbins = xmlDoc.getElementsByTagName("expressbin");
  var min_cutoff = 0.0;
  var max_express = 0.0;
  var total_max_express = 0.0;
  var sense_max_express = 0.0;
  var anti_max_express = 0.0;
  for(var i=0; i<expressbins.length; i++) {
    var expressbin = expressbins[i];
    var total      = 0;
    var sense      = 0;
    var antisense  = 0;
    var exp_express = expressbin.getElementsByTagName("exp_express");
    for(var j=0; j<exp_express.length; j++) {
      var expID      = exp_express[j].getAttribute("exp_id");
      var datatype   = exp_express[j].getAttribute("datatype");
      var experiment = glyphTrack.experiments[expID];
      if(experiment && experiment.hide) { continue; }

      var sval  = parseFloat(exp_express[j].getAttribute("sense"));
      var aval  = parseFloat(exp_express[j].getAttribute("antisense"));
      var tval  = parseFloat(exp_express[j].getAttribute("total"));

      if(glyphTrack.binning == "sum") {
        sense      += sval;
        antisense  += aval;
        total      += tval;
      }
      if(glyphTrack.binning == "max") {
	if(sval > sense) { sense = sval; }
	if(aval > antisense) { antisense = aval; }
	if(tval > total) { total = tval; }
      }
      if(glyphTrack.binning == "min") {
        if(j==0) {
          sense      = sval;
          antisense  = aval;
          total      = tval;
	} else {
	  if(sval < sense) { sense = sval; }
	  if(aval < antisense) { antisense = aval; }
	  if(tval < total) { total = tval; }
	}
      }
    }
    if(glyphTrack.logscale == 1) { 
      if(sense>0.0) { sense = Math.log(sense+1.0); }
      if(antisense>0.0) { antisense = Math.log(antisense+1.0); }
      if(total>0.0) { total = Math.log(total+1.0); }
    }
    if(sense > sense_max_express) { sense_max_express = sense; }
    if(antisense > anti_max_express) { anti_max_express = antisense; }
    if(total > total_max_express) { total_max_express = total; }
  }
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
  if(glyphTrack.exp_mincut > 0.0) {
    min_cutoff = glyphTrack.exp_mincut;
  }

  expressData.max_express       = max_express;
  expressData.total_max_express = total_max_express;
  expressData.sense_max_express = sense_max_express;
  expressData.anti_max_express  = anti_max_express;

  //
  // then convert the xmlDoc data into JSON objects
  //
  maxlevels = maxlevels / 2.0;
  expressData.expressbins = new Array();

  for(var i=0; i<expressbins.length; i++) {
    var expressbin = expressbins[i];
    var total      = 0;
    var sense      = 0;
    var antisense  = 0;
    var exp_express = expressbin.getElementsByTagName("exp_express");
    for(var j=0; j<exp_express.length; j++) {
      var expID      = exp_express[j].getAttribute("exp_id");
      var datatype   = exp_express[j].getAttribute("datatype");
      var experiment = glyphTrack.experiments[expID];
      if(experiment && experiment.hide) { continue; }

      var sval  = parseFloat(exp_express[j].getAttribute("sense"));
      var aval  = parseFloat(exp_express[j].getAttribute("antisense"));
      var tval  = parseFloat(exp_express[j].getAttribute("total"));

      if(glyphTrack.binning == "sum") {
        sense      += sval;
        antisense  += aval;
        total      += tval;
      }
      if(glyphTrack.binning == "max") {
        if(sval > sense) { sense = sval; }
        if(aval > antisense) { antisense = aval; }
        if(tval > total) { total = tval; }
      }
      if(glyphTrack.binning == "min") {
        if(j==0) {
          sense      = sval;
          antisense  = aval;
          total      = tval;
        } else {
          if(sval < sense) { sense = sval; }
          if(aval < antisense) { antisense = aval; }
          if(tval < total) { total = tval; }
        }
      }
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
    if(sense < min_cutoff) { sense=0; }
    if(antisense < min_cutoff) { antisense=0; }
    if(total < min_cutoff) { total=0; }
  
    var newbin = new Object;
    newbin.bin    = expressbin.getAttribute('bin'); 
    newbin.y_total= (maxlevels*2* total) / total_max_express;
    newbin.y_up   = (maxlevels * sense) / max_express;
    newbin.y_down = (maxlevels * antisense) / max_express;
    if(newbin.y_total > maxlevels*2) { newbin.y_total = maxlevels*2; }
    if(newbin.y_up > maxlevels) { newbin.y_up = maxlevels; }
    if(newbin.y_down > maxlevels) { newbin.y_down = maxlevels; }
    expressData.expressbins.push(newbin);
  }
}


function drawExpressTrack(glyphTrack) {
  var trackDiv   = glyphTrack.trackDiv;
  var glyphStyle = glyphTrack.glyphStyle;
  var trackID    = glyphTrack.trackID;

  var expressData = glyphTrack.expressData;
  var xmlDoc      = expressData.xmlDoc;

  //add_region_express(trackID, xmlDoc);
  //add_region_express(trackID);

  var title = glyphTrack.title;
  if(!title) { title = 'all data sources'; }

  //
  // clear and prep the SVG
  //
  clearKids(trackDiv)
  var svg = createSVG(current_region.display_width+10, 13+(glyphTrack.maxlevels));
  glyphTrack.svg = svg;
  glyphTrack.svg_height = 13+(glyphTrack.maxlevels);
  trackDiv.appendChild(svg);
  glyphTrack.top_group = document.createElementNS(svgNS,'g');
  var g1 = document.createElementNS(svgNS,'g');

  // make a backing rectangle to capture the selection events
  var backRect = document.createElementNS(svgNS,'rect');
  backRect.setAttributeNS(null, 'x', '0px');
  backRect.setAttributeNS(null, 'y', '13px');
  backRect.setAttributeNS(null, 'width',  current_region.display_width+'px');
  backRect.setAttributeNS(null, 'height', glyphTrack.maxlevels+'px');
  backRect.setAttributeNS(null, 'style', 'fill: #F6F6F6;'); 
  backRect.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  backRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

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
  selectRect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  g1.appendChild(selectRect);
  glyphTrack.selectRect = selectRect;

  //
  // then generate the expression glyphs
  //
  var expressbins = expressData.expressbins;
  var maxlevels = glyphTrack.maxlevels;
  maxlevels = maxlevels / 2.0;
  for(var i=0; i<expressbins.length; i++) {
    var expressbin = expressbins[i];

    var glyph = document.createElementNS(svgNS,'g');
    if(glyphTrack.strandless) {
      glyph.appendChild(drawBar(expressbin.bin, expressbin.y_total, 13+(maxlevels*2), "")); 
    } else {
      glyph.appendChild(drawBar(expressbin.bin, expressbin.y_up,   13+maxlevels, "+")); 
      glyph.appendChild(drawBar(expressbin.bin, expressbin.y_down, 13+maxlevels, "-")); 
    }

    glyph.setAttributeNS(null, "onmousedown", "selectTrackRegion('startdrag', \"" + glyphTrack.trackID + "\");");
    glyph.setAttributeNS(null, "onmouseup",   "selectTrackRegion('enddrag', \"" + glyphTrack.trackID + "\");");
    glyph.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
    g1.appendChild(glyph);
  }
  new_title = title + " [scale:" + expressData.max_express.toFixed(2) + " max:"+ expressData.sense_max_express.toFixed(2) +"+ " + expressData.anti_max_express.toFixed(2) + "-";
  if(glyphTrack.expscaling != "auto") { new_title += " fixscale:" + glyphTrack.expscaling; }
  if(glyphTrack.logscale==1) { new_title += " log"; }
  new_title += "]";
  new_title += " " + glyphTrack.exptype;
  new_title += " " + glyphTrack.binning;

  glyphTrack.title = new_title;
  drawHeading(glyphTrack);
  glyphTrack.title = title;

  var trackLine = document.createElementNS(svgNS,'rect');
  trackLine.setAttributeNS(null, 'x', '0px');
  trackLine.setAttributeNS(null, 'y', '13px');
  trackLine.setAttributeNS(null, 'width',  '1px');
  trackLine.setAttributeNS(null, 'height', glyphTrack.maxlevels+'px');
  trackLine.setAttributeNS(null, 'style', 'fill: orangered;');
  trackLine.setAttributeNS(null, "onmousemove", "selectTrackRegion('drag', \"" + glyphTrack.trackID + "\");");
  g1.appendChild(trackLine);
  glyphTrack.trackLine = trackLine;
  
  drawSelection(glyphTrack);

  g1.setAttributeNS(null, 'transform', "translate(10,0)");
  glyphTrack.top_group.appendChild(g1);
  svg.appendChild(glyphTrack.top_group);

  add_region_express(trackID);
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
  svg.setAttributeNS(null, "xlink", "http://www.w3.org/1999/xlink");

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


function drawCentroid(start, end, strand, center) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }

  var block = document.createElementNS(svgNS,'polyline');
  //block.setAttributeNS(null, 'points', start+' 14.5,' +end+' 14.5,' +end+' 15.5,' +start+' 15.5');
  block.setAttributeNS(null, 'points', start+',15 ' +end+',15 ');
  block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 2px;');
  g2.appendChild(block);

  if(center>0 && center<current_region.display_width) {
    var arrow = document.createElementNS(svgNS,'polygon');
    if(strand == '+') {
      arrow.setAttributeNS(null, 'points', (center+5)+' 15,' +(center-5)+' 10,' +(center)+' 15,' +(center-5)+' 20');
    }
    if(strand == '-') {
      arrow.setAttributeNS(null, 'points', (center-5)+' 15,' +(center+5)+' 10,' +(center)+' 15,' +(center+5)+' 20');
    }
    g2.appendChild(arrow);
  }
  return g2;
}

function drawThickArrow(start, end, strand) {
  //<polygon points='10 10, 10 20, 27 15' style='fill: red;' /> 
  var g2 = document.createElementNS(svgNS,'g');
  if(strand == '+') { g2.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { g2.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '') { g2.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }

  if((strand == '+') && (end < current_region.display_width)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    arrow.setAttributeNS(null, 'points', (end)+' 15,' +(end-10)+' 10,' +(end-5)+' 15,' +(end-10)+' 20');
    g2.appendChild(arrow);
    end = end - 5;
  }
  if((strand == '-') && (start>0)) {
    var arrow = document.createElementNS(svgNS,'polygon');
    arrow.setAttributeNS(null, 'points', (start)+' 15,' +(start+10)+' 10,' +(start+5)+' 15,' +(start+10)+' 20');
    g2.appendChild(arrow);
    start = start + 5;
  }

  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+' 13,' +end+' 13,' +end+' 17,' +start+' 17');
  g2.appendChild(block);

  return g2;
}


function drawArrow(center, strand) {
  var arrow = document.createElementNS(svgNS,'polygon');
  if(strand == '-') {
    arrow.setAttributeNS(null, 'points', (center-5)+' 15,' +(center+5)+' 10,' +(center)+' 15,' +(center+5)+' 20,' + (center-5)+' 15');
  } else {
    arrow.setAttributeNS(null, 'points', (center+5)+' 15,' +(center-5)+' 10,' +(center)+' 15,' +(center-5)+' 20,' + (center+5)+' 15');
  }
  if(strand == '+') { arrow.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { arrow.setAttributeNS(null, 'style', 'fill: purple;'); }
  if(strand == '')  { arrow.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  return arrow;
}


function drawSeqTag(xpos, strand, feature, glyphTrack) {
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

  var fsrc    = feature.fsrc_name;
  var fsrc_id = feature.fsrc_id;
  var seqtag  = feature.name;
  var seqedit = "";
  var mdata = feature.mdata
  for(var i=0; i<mdata.length; i++) {
    if(mdata[i].type == "seqtag") seqtag = mdata[i].value;
    if(mdata[i].type == "edit") seqedit = mdata[i].value;
  }

  var srcColor = getTrackFsrcColor(glyphTrack, fsrc_id);

  var tobj = document.createElementNS(svgNS,'text');
  tobj.setAttributeNS(null, 'y', '16px');
  tobj.setAttributeNS(null, "font-size","9px");
  tobj.setAttributeNS(null, "font-family", 'monaco,andale-mono,courier');
  tobj.setAttributeNS(null, 'fill', "black");
  tobj.setAttributeNS(null, 'x', xpos);

  var t1 = document.createTextNode(seqtag);

  var tsp1 = document.createElementNS(svgNS,'tspan');
  tsp1.setAttributeNS(null, "fill", 'red');
  var t2 = document.createTextNode("["+ seqedit +"]");
  tsp1.appendChild(t2);

  var tsp2 = document.createElementNS(svgNS,'tspan');
  tsp2.setAttributeNS(null, "fill", srcColor);
  tsp2.setAttributeNS(null, "font-size","9px");
  var t3 = document.createTextNode(fsrc);
  tsp2.appendChild(t3);

  if(strand == '+') { 
    tobj.setAttributeNS(null, 'text-anchor', 'start');
    tobj.appendChild(t1);
    tobj.appendChild(tsp1);
    tobj.appendChild(tsp2);
  } else { 
    tobj.setAttributeNS(null, 'text-anchor', 'end' );
    tobj.appendChild(tsp2);
    tobj.appendChild(tsp1);
    tobj.appendChild(t1);
  }

  g2.appendChild(tobj);

  return g2;
}


function drawBox(start, end, strand) {
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


function drawLine(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',13.5 ' +end+',13.5 ');
  block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.5px;');
  g2.appendChild(block);
  return g2;
}


function drawExon(start, end, strand) {
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

function drawThinLine(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',12.5 ' +end+',12.5 ');
  block.setAttributeNS(null, 'style', 'stroke: gray; stroke-width: 1.5px;');
  g2.appendChild(block);
  return g2;
}

function drawThinExon(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', start+' 11.5,' +end+' 11.5,' +end+' 13.5,' +start+' 13.5');
  if(strand == '') { block.setAttributeNS(null, 'style', 'fill: dimgray;'); }
  if(strand == '+') { block.setAttributeNS(null, 'style', 'fill: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'fill: purple;'); }
  return block;
}

function drawUTR(start, end, strand) {
  if(start<0) { start = 0; }
  if(end > current_region.display_width) { end = current_region.display_width; }
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


function drawCytoSpan() {
  var dwidth   = current_region.display_width;
  var fs       = current_region.start;
  var fe       = current_region.end;
  var start    = 0;
  var end      = current_region.chrom_length;

  var xfs = dwidth*(fs-start)/(end-start); 
  var xfe = dwidth*(fe-start)/(end-start); 

  var g2 = document.createElementNS(svgNS,'g');
  var block = document.createElementNS(svgNS,'polygon');
  block.setAttributeNS(null, 'points', xfs+' 11,' +xfe+' 11,' +xfe+' 23,' +xfs+' 23');
  block.setAttributeNS(null, 'style', 'stroke:red; fill: none; stroke-width: 1.5px;');
  g2.appendChild(block);
  return g2;
} 


function drawChromScale() {
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

  if(!glyphTrack.top_group) { return; }

  // make a rectangle for a "title bar" for each track
  var titleBar = document.createElementNS(svgNS,'rect');
  titleBar.setAttributeNS(null, 'x', '0px');
  titleBar.setAttributeNS(null, 'y', '0px');
  titleBar.setAttributeNS(null, 'width',  current_region.display_width+10+'px');
  titleBar.setAttributeNS(null, 'height', '11px');
  if(glyphTrack.trackID == current_region.active_trackID) { titleBar.setAttributeNS(null, 'style', 'fill: #DECAAF;'); } 
  else { titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;'); }
  //titleBar.setAttributeNS(null, "onmousedown", "changeRegionProbe('" +glyphTrack.trackID+ "');");
  titleBar.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
  titleBar.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");changeRegionProbe('" +glyphTrack.trackID+ "');");
  titleBar.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  if((current_region.exportconfig === undefined) || !current_region.exportconfig.hide_titlebar) { 
    glyphTrack.top_group.appendChild(titleBar);
    glyphTrack.titleBar = titleBar;
  }

  createCloseTrackWidget(glyphTrack);

  createHideTrackWidget(glyphTrack);

  createConfigTrackWidget(glyphTrack);

  createDuplicateTrackWidget(glyphTrack);

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
  if(is_filtered) { title += " FILTERED"; }

  var obj = document.createElementNS(svgNS,'text');
  obj.setAttributeNS(null, 'x', '20px');
  obj.setAttributeNS(null, 'y', '9px');
  obj.setAttributeNS(null, "font-size","10");
  obj.setAttributeNS(null, "fill", "black");
  obj.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  obj.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
  obj.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");");
  obj.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  obj.appendChild(document.createTextNode(title));
  g2.appendChild(obj);

  glyphTrack.top_group.appendChild(g2);
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

  //document.getElementById("message").innerHTML += "drawselect"; 

  createMagnifyRegionWidget(glyphTrack);
}


function drawThin(start, end, strand) {
  var block = document.createElementNS(svgNS,'polyline');
  block.setAttributeNS(null, 'points', start+',11 ' +end+',11 ');
  if(strand == '+') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: green;'); }
  if(strand == '-') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: purple;'); }
  if(strand == '') { block.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: dimgray;'); }
  return block;
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
  if(strand == '') { 
    bar.setAttributeNS(null, 'y', (middle-1-height)+'px');
    bar.setAttributeNS(null, 'style', 'fill: rgb(0,0,230); stroke: blue;'); 
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

  var svg = createSVG(150, 25);
  var g2 = document.createElementNS(svgNS,'g');
  g2.setAttributeNS(null, 'title', 'add new track');
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

  //<linearGradient id="red_black" x1="0%" y1="0%" x2="0%" y2="100%">
  //<stop offset="0%" style="stop-color:rgb(255,0,0);stop-opacity:1"/>
  //<stop offset="100%" style="stop-color:rgb(255,255,0);stop-opacity:1"/>
  //</linearGradient>
  //</defs>


  var polyback = document.createElementNS(svgNS,'polygon');
  polyback.setAttributeNS(null, 'points', '0,0 50,0 50,21 0,14');
  //polyback.setAttributeNS(null, 'style', 'fill: mediumslateblue;');
  polyback.setAttributeNS(null, 'style', 'fill:url(#purpLinearGradient)');
  polyback.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  g2.appendChild(polyback);

  polyback = document.createElementNS(svgNS,'polygon');
  polyback.setAttributeNS(null, 'points', '50,0 100,0 100,14 50,21');
  //polyback.setAttributeNS(null, 'style', 'fill: slateblue;');
  polyback.setAttributeNS(null, 'style', 'fill:url(#purpLinearGradient)');
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

  var label = document.createElementNS(svgNS,'text');
  label.setAttributeNS(null, 'x', '20px');
  label.setAttributeNS(null, 'y', '11px');
  label.setAttributeNS(null, "font-size","10");
  label.setAttributeNS(null, "fill", "black");
  label.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  label.setAttributeNS(null, "font-weight", 'bold');
  label.setAttributeNS(null, "onclick", "addNewTrack(\"" + div.id + "\");");
  label.appendChild(document.createTextNode("add new track"));
  g2.appendChild(label);

  svg.appendChild(g2);
  glyphset.appendChild(div);

  return div;
}


function createHideTrackWidget(glyphTrack) {
  if(current_region.exportconfig && current_region.exportconfig.hide_widgets) { return; }
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
  glyphTrack.top_group.appendChild(g1);
}


function createCloseTrackWidget(glyphTrack) {
  if(current_region.exportconfig && current_region.exportconfig.hide_widgets) { return; }
  var trackID = glyphTrack.trackID;

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

  g1.setAttributeNS(null, 'transform', "translate(" + current_region.display_width + ",0)");
  glyphTrack.top_group.appendChild(g1);
}


function createDuplicateTrackWidget(glyphTrack) {
  if(current_region.exportconfig && current_region.exportconfig.hide_widgets) { return; }
  if(glyphTrack.glyphStyle == "cytoband") { return; }

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 'duplicate track');

  var rect1 = document.createElementNS(svgNS,'rect');
  rect1.setAttributeNS(null, 'x', '0');
  rect1.setAttributeNS(null, 'y', '0');
  rect1.setAttributeNS(null, 'width', '7');
  rect1.setAttributeNS(null, 'height', '5');
  rect1.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  rect1.setAttributeNS(null, "onclick", "gLyphsDuplicateTrack(\"" + glyphTrack.trackID + "\");");
  g1.appendChild(rect1);

  var rect2 = document.createElementNS(svgNS,'rect');
  rect2.setAttributeNS(null, 'x', '3');
  rect2.setAttributeNS(null, 'y', '3');
  rect2.setAttributeNS(null, 'width', '7');
  rect2.setAttributeNS(null, 'height', '5');
  rect2.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  rect2.setAttributeNS(null, "onclick", "gLyphsDuplicateTrack(\"" + glyphTrack.trackID + "\");");
  g1.appendChild(rect2);

  g1.setAttributeNS(null, 'transform', "translate(" + (current_region.display_width-30) + ",2)");
  glyphTrack.top_group.appendChild(g1);
}


function createMoveBar(glyphTrack) {
  if(current_region.exportconfig && current_region.exportconfig.hide_sidebar) { return; }

  //uses the full svg document and creates a full height move bar
  var svg = glyphTrack.svg;
  if(!svg) { return; }
  var height = parseInt(svg.getAttributeNS(null, 'height'));

  var g1 = document.createElementNS(svgNS,'g');

  var rect1 = document.createElementNS(svgNS,'rect');
  rect1.setAttributeNS(null, 'x', '0');
  rect1.setAttributeNS(null, 'y', '1');
  rect1.setAttributeNS(null, 'width', '7');
  rect1.setAttributeNS(null, 'height', height-1);
  rect1.setAttributeNS(null, 'style', 'fill: dimgray; stroke-width:1px; stroke:black;');
  rect1.setAttributeNS(null, "onmousedown", "moveTrack('startdrag', \"" + glyphTrack.trackID + "\");");
  rect1.setAttributeNS(null, "onmouseup", "moveTrack('enddrag', \"" + glyphTrack.trackID + "\");");
  rect1.setAttributeNS(null, "onmousemove", "moveTrack('drag', \"" + glyphTrack.trackID + "\");");
  g1.appendChild(rect1);
  glyphTrack.top_group.appendChild(g1);
}


function createMagnifyRegionWidget(glyphTrack) {
  if(glyphTrack.selection == null) { return; }

  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'title', 'magnify region');
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
  glyphTrack.top_group.appendChild(g1);
}


function createConfigTrackWidget(glyphTrack) {
  if(current_region.exportconfig && current_region.exportconfig.hide_widgets) { return; }

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
  line.setAttributeNS(null, "onclick", "gLyphsReconfigureTrack(\"" + glyphTrack.trackID + "\");");
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
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos+10) +"px; "
                            +"width:350px;"
                             );
  var tdiv, tspan, tinput;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Save gLyphs configuration";
  divFrame.appendChild(tdiv)

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

  var expexp = doc.createElement("experiment_expression");
  expexp.setAttribute("exp_sort", express_sort_mode);
  if(current_expExpress) {
    expexp.setAttribute("active_trackID", current_expExpress.trackID);
  }
  config.appendChild(expexp);
  //function changeRegionProbe(region_trackID) {

  if(current_feature) { 
    //one of the great aspects of working with DOM objects...
    //I can just append the whole feature DOM into the config
    //config.appendChild(current_feature); 

    var feat = doc.createElement("feature");
    if(current_feature.getAttribute("peer")) {
      feat.setAttribute("peer", current_feature.getAttribute("peer"));
    }
    feat.setAttribute("id",   current_feature.getAttribute("id"));
    feat.setAttribute("desc", current_feature.getAttribute("desc"));
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

    var track = doc.createElement("gLyphTrack");
    track.setAttribute("trackID", glyphTrack.trackID);
    track.setAttribute("title", glyphTrack.title);
    track.setAttribute("glyphStyle", glyphTrack.glyphStyle);
    if(glyphTrack.peerName) { track.setAttribute("peerName", glyphTrack.peerName); }
    if(glyphTrack.sources) { track.setAttribute("sources", glyphTrack.sources); }
    if(glyphTrack.source_ids) { track.setAttribute("source_ids", glyphTrack.source_ids); }
    if(glyphTrack.hideTrack) { track.setAttribute("hide", 1); }
    if(glyphTrack.glyphStyle == "express") {
      track.setAttribute("exptype", glyphTrack.exptype);
      track.setAttribute("expfilter", glyphTrack.expfilter);
      track.setAttribute("logscale", glyphTrack.logscale);
      track.setAttribute("submode", glyphTrack.submode);
      track.setAttribute("binning", glyphTrack.binning);
      track.setAttribute("maxlevels", glyphTrack.maxlevels);
      track.setAttribute("expscaling", glyphTrack.expscaling);
      track.setAttribute("strandless", glyphTrack.strandless);
      if(glyphTrack.experiments) {
        for(var expID in glyphTrack.experiments){
          var experiment = glyphTrack.experiments[expID];
          if(experiment.hide) { 
            var exp = doc.createElement("gLyphTrackExp");
            exp.setAttribute("id", experiment.expID);
            exp.setAttribute("hide", experiment.hide);
            track.appendChild(exp);
          }
        }
      }
    }
    if(glyphTrack.selection) {
      track.setAttribute("select_start", glyphTrack.selection.chrom_start);
      track.setAttribute("select_end", glyphTrack.selection.chrom_end);
    }

    tracks.appendChild(track);
  }

  var searchDOM = generateSearchConfigDOM(doc, "eedbSearchBox1");
  config.appendChild(searchDOM);

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
  //return;

  //
  // actual work
  //
  var url = "../cgi/eedb_config_server.cgi";
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
    dhtmlHistory.add("#config="+uuid);
  }

  return configDOM;
}


function gLyphsInitConfigUUID(configUUID) {

  if(current_region.configUUID == configUUID) { return; }

  var url = "../cgi/eedb_config_server.cgi?uuid=" + configUUID;
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

  var descdiv = document.getElementById("gLyphs_description");
  descdiv.innerHTML = "<div>"+ encodehtml(current_region.desc) +"</div>";
  descdiv.innerHTML += "<div><a href=\"#config=" +configUUID+ "\">"+current_region.configname+"</a></div>";

  current_region.configUUID = configUUID;
  dhtmlHistory.add("#config="+configUUID);
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
  current_region.display_width = gLyphsInitParams.display_width;
  current_region.asm = "hg18";
  current_region.title = "welcome to eeDB gLyphs";
  current_region.user = eedbCurrentUser;
  current_region.configname = "";
  current_region.desc = "";


  //--------------------------------
  eedbEmptySearchResults();

  var summaries = configDOM.getElementsByTagName("summary");
  if(summaries && (summaries.length>0)) {
    var summary = summaries[0];
    current_region.title       = summary.getAttribute("title");
    current_region.configname  = summary.getAttribute("name");
    current_region.user        = summary.getAttribute("user");
    current_region.desc        = summary.getAttribute("desc");

    var titlediv = document.getElementById("gLyphs_title");
    titlediv.innerHTML = encodehtml(current_region.title);
    var descdiv = document.getElementById("gLyphs_description");
    descdiv.innerHTML = encodehtml(current_region.desc);
  }

  var features = configDOM.getElementsByTagName("feature");
  if(features && (features.length>0)) {
    var featureXML = features[0];
    var fid   = featureXML.getAttribute("id");
    var peer  = featureXML.getAttribute("peer");
    if(peer) { fid = peer +"::"+ fid; }
    loadFeatureInfo(fid);
  }
  var searchConfig = configDOM.getElementsByTagName("eedbSearchTracks");
  if(searchConfig && (searchConfig.length>0)) {
    var searchDOM = searchConfig[0];
    eedbSearchInitFromConfig("eedbSearchBox1", searchDOM);
  }

  var expexps = configDOM.getElementsByTagName("experiment_expression");
  if(expexps && (expexps.length>0)) {
    var expexp = expexps[0];
    express_sort_mode              = expexp.getAttribute("exp_sort");
    current_region.active_trackID  = expexp.getAttribute("active_trackID");
  }


  var glyphset = document.getElementById("gLyphTrackSet");
  clearKids(glyphset);

  var trackset = configDOM.getElementsByTagName("gLyphTracks");
  if(trackset && (trackset.length>0) && (trackset[0].getAttribute("next_trackID"))) { 
    newTrackID = trackset[0].getAttribute("next_trackID");
  }

  var tracks = configDOM.getElementsByTagName("gLyphTrack");
  for(var i=0; i<tracks.length; i++) {
    var trackDOM = tracks[i];
    //create trackdiv and glyphTrack objects and configure them

    var trackID;
    if(trackDOM.getAttribute("trackID")) { trackID = trackDOM.getAttribute("trackID"); }
    else { trackID = "glyphTrack" + (newTrackID++); }
    var trackDiv = document.createElement('div');
    trackDiv.setAttribute("align","left");
    trackDiv.setAttribute("style", "background-color: none; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
    trackDiv.id = trackID;
    trackDiv.setAttribute("class","gLyphTrack");
    glyphset.appendChild(trackDiv);

    var glyphTrack        = new Object;
    glyphTrack.trackID    = trackID;
    glyphTrack.trackDiv   = trackDiv;
    glyphTrack.hideTrack  = !!trackDOM.getAttribute("hide"); //forces it into a boolean
    glyphTrack.title      = trackDOM.getAttribute("title");
    glyphTrack.glyphStyle = trackDOM.getAttribute("glyphStyle");
    glyphTrack.strandless = false;
    glyphTrack.trackmode  = "annotation";


    if(trackDOM.getAttribute("peerName")) { glyphTrack.peerName = trackDOM.getAttribute("peerName"); }
    if(trackDOM.getAttribute("sources")) { glyphTrack.sources = trackDOM.getAttribute("sources"); }
    if(trackDOM.getAttribute("source_ids")) { glyphTrack.source_ids = trackDOM.getAttribute("source_ids"); }

    if(trackDOM.getAttribute("select_start")) { 
      glyphTrack.selection = new Object;
      glyphTrack.selection.chrom_start = trackDOM.getAttribute("select_start");
      glyphTrack.selection.chrom_end = trackDOM.getAttribute("select_end");
      glyphTrack.selection.active = "no";
    }

    glyphTrack.maxlevels  = 100;
    if(trackDOM.getAttribute("maxlevels")) {
      glyphTrack.maxlevels  = Math.floor(trackDOM.getAttribute("maxlevels"));
    }
    glyphTrack.expscaling = "auto";
    if(trackDOM.getAttribute("expscaling")) {
      glyphTrack.expscaling  = parseFloat(trackDOM.getAttribute("expscaling"));
      if(isNaN(glyphTrack.expscaling) || (glyphTrack.expscaling==0)) { glyphTrack.expscaling = "auto"; }                                        
    }
    if(glyphTrack.glyphStyle == "express") {
      glyphTrack.trackmode   = "expression";
      glyphTrack.exptype     = trackDOM.getAttribute("exptype");
      glyphTrack.expfilter   = trackDOM.getAttribute("expfilter");
      glyphTrack.logscale    = Math.floor(trackDOM.getAttribute("logscale"));
      if(trackDOM.getAttribute("strandless") == "true") { glyphTrack.strandless = true; }
      glyphTrack.submode     = trackDOM.getAttribute("submode");
      glyphTrack.binning     = trackDOM.getAttribute("binning");
      glyphTrack.experiments = new Object();

      var exps = trackDOM.getElementsByTagName("gLyphTrackExp");
      for(var j=0; j<exps.length; j++) {
        var expID = exps[j].getAttribute("id");
        var experiment = glyphTrack.experiments[expID];
        if(experiment === undefined) {
          experiment               = new Object;
          experiment.expID         = expID;
          experiment.exptype       = '';
          experiment.value         = 0.0;
          experiment.sig_error     = 1.0;
          experiment.hide          = !!exps[j].getAttribute("hide");
          glyphTrack.experiments[expID] = experiment;
        }
      }
    }
    gLyphTrack_array[trackID] = glyphTrack;

    drawTrack(trackID);  //this creates empty tracks with the "loading" tag
  }
  createAddTrackTool();
  
  if(configDOM.getElementsByTagName("region")) {
    var region = configDOM.getElementsByTagName("region")[0];

    gLyphsSetLocation(region.getAttribute("asm"),
                      region.getAttribute("chrom"),
                      parseInt(region.getAttribute("start")),
                      parseInt(region.getAttribute("end")));
  }
  return;
}

//---------------------------------------------------------------
//
// track configuration / save
// 
//---------------------------------------------------------------


function saveTrackConfig(trackID) {
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
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos-300) +"px; "
                            +"width:350px;"
                             );

  glyphTrack.saveTrackConfig = new Object;
  glyphTrack.saveTrackConfig.title = glyphTrack.title;
  glyphTrack.saveTrackConfig.user = eedbCurrentUser; 

  var tdiv, tspan, tinput;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Save gLyphs Track";
  divFrame.appendChild(tdiv)

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
  tinput.setAttribute("onkeyup", "saveTrackConfigParam(\""+ trackID+"\", 'title', this.value);");
  tdiv.appendChild(tinput);
  divFrame.appendChild(tdiv)

  //----------
  tdiv = document.createElement('div');
  var userSpan = document.createElement('span');
  userSpan.setAttribute('style', "padding:0px 0px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  userSpan.innerHTML = "author name:";
  tdiv.appendChild(userSpan);
  var userInput = document.createElement('input');
  userInput.setAttribute('style', "width:200px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  userInput.setAttribute('type', "text");
  userInput.setAttribute('value', eedbCurrentUser);
  userInput.setAttribute("onkeyup", "saveTrackConfigParam(\""+ trackID+"\", 'user', this.value);");
  tdiv.appendChild(userInput);
  divFrame.appendChild(tdiv)

  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute("onkeyup", "saveTrackConfigParam(\""+ trackID+"\", 'desc', this.value);");
  divFrame.appendChild(descInput);


  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "cancel");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "saveTrackConfigParam(\""+ trackID+"\", 'cancel');");
  divFrame.appendChild(button1);

  var button2 = document.createElement('input');
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "save config");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "saveTrackConfigParam(\""+ trackID+"\", 'accept');");
  divFrame.appendChild(button2);

  //----------
  trackDiv.appendChild(divFrame);
  glyphTrack.saveTrackConfig.interface = divFrame;
}


function saveTrackConfigParam(trackID, param, value) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var trackDiv = glyphTrack.trackDiv;
  if(!trackDiv) return;

  var saveconfig = glyphTrack.saveTrackConfig;
  if(saveconfig === undefined) { return; }
  var saveConfigDiv = glyphTrack.saveTrackConfig.interface;

  if(param == "title") { saveconfig.title = value; }
  if(param == "user")  { saveconfig.user = value; }
  if(param == "desc")  { saveconfig.desc = value; }
  if(param == "cancel") {
    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.saveTrackConfig = undefined;
  }

  if(param == "accept") {
    eedbCurrentUser = saveconfig.user;

    var configDOM = generateTrackConfigDOM(trackID);
    uploadTrackConfigXML(configDOM);

    trackDiv.removeChild(saveConfigDiv);
    glyphTrack.saveTrackConfig = undefined;
    drawTrack(trackID);
  }
}


function generateTrackConfigDOM(trackID) {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return undefined; }

  var doc = document.implementation.createDocument("", "", null);
  var saveconfig = glyphTrack.saveTrackConfig;

  var config = doc.createElement("eeDBgLyphsTrackConfig");
  doc.appendChild(config);

  var summary = doc.createElement("summary");
  summary.setAttribute("title", saveconfig.title);
  summary.setAttribute("user", saveconfig.user);
  summary.setAttribute("desc", saveconfig.desc);
  config.appendChild(summary);

  var track = doc.createElement("gLyphTrack");
  track.setAttribute("title", glyphTrack.title);
  track.setAttribute("glyphStyle", glyphTrack.glyphStyle);
  if(glyphTrack.peerName) { track.setAttribute("peerName", glyphTrack.peerName); }
  if(glyphTrack.sources) { track.setAttribute("sources", glyphTrack.sources); }
  if(glyphTrack.source_ids) { track.setAttribute("source_ids", glyphTrack.source_ids); }
  if(glyphTrack.hideTrack) { track.setAttribute("hide", 1); }
  if(glyphTrack.glyphStyle == "express") {
    track.setAttribute("exptype", glyphTrack.exptype);
    track.setAttribute("expfilter", glyphTrack.expfilter);
    track.setAttribute("logscale", glyphTrack.logscale);
    track.setAttribute("submode", glyphTrack.submode);
    track.setAttribute("binning", glyphTrack.binning);
    track.setAttribute("maxlevels", glyphTrack.maxlevels);
    track.setAttribute("expscaling", glyphTrack.expscaling);
    track.setAttribute("strandless", glyphTrack.strandless);
    if(glyphTrack.experiments) {
      for(var expID in glyphTrack.experiments){
        var experiment = glyphTrack.experiments[expID];
        if(experiment.hide) { 
          var exp = doc.createElement("gLyphTrackExp");
          exp.setAttribute("id", experiment.expID);
          exp.setAttribute("hide", experiment.hide);
          track.appendChild(exp);
        }
      }
    }
  }
  if(glyphTrack.selection) {
    track.setAttribute("select_start", glyphTrack.selection.chrom_start);
    track.setAttribute("select_end", glyphTrack.selection.chrom_end);
  }
  config.appendChild(track);

  return doc;
}

function uploadTrackConfigXML(configDOM) {

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
  //return;

  //
  // actual work
  //
  var url = "../cgi/eedb_config_server.cgi";
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

  return configDOM;
}


function loadTrackConfig(configXML) {
  var parser = new DOMParser();
  var configDOM = parser.parseFromString(configXML, "text/xml");

  //--------------------------------
  eedbEmptySearchResults();

  //document.getElementById("message").innerHTML = "loadTrackConfig";

  var glyphset = document.getElementById("gLyphTrackSet");
  var newtrack_div = glyphset.lastChild;

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
    glyphset.insertBefore(trackDiv, newtrack_div);

    var glyphTrack        = new Object;
    glyphTrack.trackID    = trackID;
    glyphTrack.trackDiv   = trackDiv;
    glyphTrack.hideTrack  = false;
    glyphTrack.title      = trackDOM.getAttribute("title");
    glyphTrack.glyphStyle = trackDOM.getAttribute("glyphStyle");
    glyphTrack.strandless = false;
    glyphTrack.trackmode  = "annotation";

    if(trackDOM.getAttribute("peerName")) { glyphTrack.peerName = trackDOM.getAttribute("peerName"); }
    if(trackDOM.getAttribute("sources")) { glyphTrack.sources = trackDOM.getAttribute("sources"); }
    if(trackDOM.getAttribute("source_ids")) { glyphTrack.source_ids = trackDOM.getAttribute("source_ids"); }

    if(trackDOM.getAttribute("select_start")) {
      glyphTrack.selection = new Object;
      glyphTrack.selection.chrom_start = trackDOM.getAttribute("select_start");
      glyphTrack.selection.chrom_end = trackDOM.getAttribute("select_end");
      glyphTrack.selection.active = "no";
    }

    glyphTrack.maxlevels  = 100;
    if(trackDOM.getAttribute("maxlevels")) {
      glyphTrack.maxlevels  = Math.floor(trackDOM.getAttribute("maxlevels"));
    }
    glyphTrack.expscaling = "auto";
    if(trackDOM.getAttribute("expscaling")) {
      glyphTrack.expscaling  = parseFloat(trackDOM.getAttribute("expscaling"));
      if(isNaN(glyphTrack.expscaling) || (glyphTrack.expscaling==0)) { glyphTrack.expscaling = "auto"; }
    }
    if(glyphTrack.glyphStyle == "express") {
      glyphTrack.trackmode   = "expression";
      glyphTrack.exptype     = trackDOM.getAttribute("exptype");
      glyphTrack.expfilter   = trackDOM.getAttribute("expfilter");
      glyphTrack.logscale    = Math.floor(trackDOM.getAttribute("logscale"));
      if(trackDOM.getAttribute("strandless") == "true") { glyphTrack.strandless = true; }
      glyphTrack.submode     = trackDOM.getAttribute("submode");
      glyphTrack.binning     = trackDOM.getAttribute("binning");
      glyphTrack.experiments = new Object();

      var exps = trackDOM.getElementsByTagName("gLyphTrackExp");
      for(var j=0; j<exps.length; j++) {
        var expID = exps[j].getAttribute("id");
        var experiment = glyphTrack.experiments[expID];
        if(experiment === undefined) {
          experiment               = new Object;
          experiment.expID         = expID;
          experiment.exptype       = '';
          experiment.value         = 0.0;
          experiment.sig_error     = 1.0;
          experiment.hide          = !!exps[j].getAttribute("hide");
          glyphTrack.experiments[expID] = experiment;
        }
      }
    }
    gLyphTrack_array[trackID] = glyphTrack;

    drawTrack(trackID);  //this creates empty tracks with the "loading" tag
    prepareTrackXHR(trackID);

  }
  return;

}


//----------------------------------------------------
// 
// visualization save/print to SVG
//
//----------------------------------------------------

function configureExportSVG() {
  var saveDiv = document.getElementById("exportsvg_config_div");
  if(saveDiv === undefined) { return; }
  
  if(current_region.exportconfig !== undefined) { return; }

  current_region.exportconfig = new Object;
  current_region.exportconfig.title = current_region.title;
  current_region.exportconfig.user = eedbCurrentUser; 

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"z-index:1; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos+10) +"px; "
                            +"width:350px;"
                             );
  var tdiv, tspan1, tspan2, tinput, tcheck;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Export gLyphs SVG image";
  divFrame.appendChild(tdiv);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "exportSVGConfigParam('widgets', this.checked);");
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide widgets";
  tdiv.appendChild(tspan1);
  divFrame.appendChild(tdiv);

  tdiv = document.createElement('div');
  tcheck = document.createElement('input');
  tcheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  tcheck.setAttribute('type', "checkbox");
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
  tcheck.setAttribute("onclick", "exportSVGConfigParam('titlebar', this.checked);");
  tdiv.appendChild(tcheck);
  tspan1 = document.createElement('span');
  tspan1.innerHTML = "hide title bar";
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

  saveDiv.appendChild(divFrame);
}


function exportSVGConfigParam(param, value) {
  var exportDiv = document.getElementById("exportsvg_config_div");
  if(exportDiv === undefined) { return; }

  var exportconfig = current_region.exportconfig;
  if(exportconfig === undefined) { return; }

  if(param == "widgets") { exportconfig.hide_widgets = value; }
  if(param == "sidebar") { exportconfig.hide_sidebar = value; }
  if(param == "titlebar") { exportconfig.hide_titlebar = value; }

  if(param == "name") { exportconfig.name = value; }
  if(param == "user")  { exportconfig.user = value; }
  if(param == "desc")  { exportconfig.desc = value; }
  if(param == "svg-cancel") {
    exportDiv.innerHTML ="";
    current_region.exportconfig = undefined;
  }

  if(param == "svg-accept") {
    exportDiv.innerHTML ="";

    gLyphsSaveSVG();
  }
}

function gLyphsSaveSVG() {
  var saveDiv = document.getElementById("save_config_div");
  
  if(current_region.saveconfig !== undefined) { return; }

  current_region.saveconfig = new Object;
  current_region.saveconfig.title = current_region.title;
  current_region.saveconfig.user = eedbCurrentUser; 

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"z-index:1; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + ((winW/2)-250) +"px; "
                            +"top:" + (toolTipSTYLE.ypos+10) +"px; "
                            +"width:350px;"
                             );
  var tdiv, tspan, tinput;

  tdiv = document.createElement('h3');
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = "Export gLyphs SVG image";
  divFrame.appendChild(tdiv)

  tdiv = document.createElement('div');
  tdiv.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif;");
  tdiv.innerHTML = "Please copy/paste the SVG contents from this panel into a "+
                   "text editor of choice and save as a .svg document in a plain text format. "+
                   "This can then be viewed and edited in Inkscape, Adobe Illustrator or other "+
                   "SVG editors."; 
  divFrame.appendChild(tdiv)

  //----------
  var xml = generateSvgDOM();
  var xmlText = document.createElement('textarea');
  xmlText.setAttribute('style', "width:340px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  xmlText.rows = 10;
  xmlText.value = xml;
  divFrame.appendChild(xmlText);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  var button1 = document.createElement('input');
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "close");
  button1.setAttribute('style', "float:left; margin: 0px 4px 4px 4px;");
  button1.setAttribute("onclick", "saveConfigParam('cancel');");
  divFrame.appendChild(button1);

  saveDiv.appendChild(divFrame);
}


function generateSvgDOM() {
  //the reason I am using the DOM api is that all the nice
  //formating and character conversion is handled by the XMLSerializer

  var serializer = new XMLSerializer();

  var text = "<?xml version=\"1.0\" standalone=\"no\"?>\n";
  text += "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
  text += "<svg xmlns=\"http://www.w3.org/2000/svg\" y=\"10px\" width=\""+ (current_region.display_width+30) +"\" >\n";

  var export_g1 = document.createElementNS(svgNS,'g');

  var track_ypos = 0;
  for(var id in gLyphTrack_array){
    var glyphTrack = gLyphTrack_array[id];

    drawTrack(glyphTrack.trackID);
    var track_g1 = glyphTrack.top_group;
    if(track_g1) { 
      export_g1.appendChild(track_g1);

      track_g1.setAttributeNS(null, 'transform', "translate(10,"+ track_ypos  + ")");
      track_ypos += 1+ glyphTrack.svg_height;
    }
  }
  var exp_g1 = drawExperimentExpression();
  if(exp_g1) {
    export_g1.appendChild(exp_g1);
    drawExperimentExpression();
    exp_g1.setAttributeNS(null, 'transform', "translate(10,"+ track_ypos  + ")");
    //exp_g1.setAttributeNS(null, "x", "10px");
    //exp_g1.setAttributeNS(null, "y", track_ypos + "px");
    //text += serializer.serializeToString(exp_g1);
  }

  text += serializer.serializeToString(export_g1);

  text += "</svg>\n";

  //remove the exportconfig and redraw the interactive view
  current_region.exportconfig = undefined;
  redrawRegion();

  return text;
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
  glyphTrack.trackmode  = "both";
  glyphTrack.hideTrack  = 0;
  glyphTrack.title      = "";
  glyphTrack.default_exptype = "raw";
  glyphTrack.exptype    = "";
  glyphTrack.expfilter  = "";
  glyphTrack.logscale   = 0;
  glyphTrack.strandless = false;
  glyphTrack.submode    = "5end";
  glyphTrack.binning    = "sum";
  glyphTrack.maxlevels  = 100;
  glyphTrack.expscaling = "auto";
  glyphTrack.exp_mincut = 0.0;

  //just some test config for now
  glyphTrack.sources     = "";
  glyphTrack.source_ids  = "";
  glyphTrack.peerName    = "";
  glyphTrack.glyphStyle  = "express";

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

  trackDiv.setAttribute("style", "background-color: wheat; padding:5px 5px 5px 5px; margin-top:3px;");

  clearKids(trackDiv)

  glyphTrack.sourceHash = new Object();

  var p1 = document.createElement('div');
  p1.setAttribute("style", "font-size:16px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  p1.innerHTML ="configure new track: "+ trackID;
  trackDiv.appendChild(p1);
  trackDiv.appendChild(document.createElement('hr'));

  //----------
  var trackTypeDiv = document.createElement('form');
  trackDiv.appendChild(trackTypeDiv);
  var ttlabel1 = document.createElement('span');
  ttlabel1.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  ttlabel1.innerHTML ="Track type: ";
  trackTypeDiv.appendChild(ttlabel1);

  var ttradio3 = document.createElement('input');
  ttradio3.setAttribute("type", "radio");
  ttradio3.setAttribute("name", "newTrackTypeMode");
  ttradio3.setAttribute("value", "both");
  ttradio3.setAttribute("checked", "checked");
  ttradio3.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'trackmode', this.value);");
  var ttradio3Label = document.createElement('span');
  ttradio3Label.innerHTML = "feature expression (advanced)";
  trackTypeDiv.appendChild(ttradio3);
  trackTypeDiv.appendChild(ttradio3Label);

  var ttradio1 = document.createElement('input');
  ttradio1.setAttribute("type", "radio");
  ttradio1.setAttribute("name", "newTrackTypeMode");
  ttradio1.setAttribute("value", "expression");
  ttradio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'trackmode', this.value);");
  var ttradio1Label = document.createElement('span');
  ttradio1Label.innerHTML = "simple expression";
  trackTypeDiv.appendChild(ttradio1);
  trackTypeDiv.appendChild(ttradio1Label);

  var ttradio2 = document.createElement('input');
  ttradio2.setAttribute("type", "radio");
  ttradio2.setAttribute("name", "newTrackTypeMode");
  ttradio2.setAttribute("value", "annotation");
  ttradio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'trackmode', this.value);");
  var ttradio2Label = document.createElement('span');
  ttradio2Label.innerHTML = "annotation";
  trackTypeDiv.appendChild(ttradio2);
  trackTypeDiv.appendChild(ttradio2Label);

  trackDiv.appendChild(document.createElement('hr'));
  //----------

  //----------
  var sourceDiv = document.createElement('form');
  var labelSources = document.createElement('span');
  labelSources.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelSources.innerHTML ="Data sources";
  sourceDiv.appendChild(labelSources);
  trackDiv.appendChild(sourceDiv);
  var radio1 = document.createElement('input');
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "newTrackSearchMode");
  radio1.setAttribute("value", "experiments");
  radio1.setAttribute("checked", "checked");
  radio1.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'sourcemode', this.value);");
  var radio1Label = document.createElement('span');
  radio1Label.innerHTML = "experiments";
  //sourceDiv.appendChild(radio1);
  //sourceDiv.appendChild(radio1Label);

  var radio2 = document.createElement('input');
  radio2.setAttribute("type", "radio");
  radio2.setAttribute("name", "newTrackSearchMode");
  radio2.setAttribute("value", "feature_sources");
  radio2.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'sourcemode', this.value);");
  var radio2Label = document.createElement('span');
  radio2Label.innerHTML = "feature sources";
  //sourceDiv.appendChild(radio2);
  //sourceDiv.appendChild(radio2Label);

  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) {
    var span2 = document.createElement('span');
    span2.setAttribute('style', "margin: 0px 0px 0px 24px;");
    span2.innerHTML = "expression-datatype:";
    sourceDiv.appendChild(span2);
    sourceDiv.appendChild(datatypeSelect);
  }
  //----------

  //----------
  //<div id="eedbSearchBox1" class="EEDBsearchSet">
  //<form onsubmit="singleSearchValue('eedbSearchBox1');return false;">
  var expSearchSet = document.createElement('div');
  expSearchSet.id = trackID + "_newtrack_source_searchset";
  expSearchSet.setAttribute("class","EEDBsearchSet");
  trackDiv.appendChild(expSearchSet)

  //<span onclick="eedbClearSearchResults('eedbSearchBox1')">Search for experiments:</span>
  var expSpan = document.createElement('span');
  expSpan.innerHTML = "Search for data sources:";
  expSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  expSearchSet.appendChild(expSpan);

  //<input id="eedbSearchBox1_inputID" type="text" autocomplete="off" onkeyup="eedbMultiSearch('eedbSearchBox1', this.value, event)" size="100" style="font-size:12px;"></input>
  var sourceInput = document.createElement('input');
  sourceInput.id = expSearchSet.id + "_inputID";
  sourceInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  sourceInput.setAttribute('size', "90");
  sourceInput.setAttribute('type', "text");
  //sourceInput.setAttribute("onkeypress", "eedbMultiSearch(\""+ expSearchSet.id +"\", this.value, event);");
  sourceInput.setAttribute("onchange", "eedbMultiSearch(\""+ expSearchSet.id +"\", this.value, event);");
  expSearchSet.appendChild(sourceInput)

  //<input type="button" value="search" onclick="singleSearchValue('eedbSearchBox1')" />
  var searchButton = document.createElement('input');
  searchButton.setAttribute("type", "button");
  searchButton.setAttribute("value", "search");
  searchButton.setAttribute("onclick", "eedbMultiSearch(\""+ expSearchSet.id +"\");");
  expSearchSet.appendChild(searchButton);

  //<input type="button" value="clear search" onclick="eedbClearSearchResults('eedbSearchBox1')" />
  var clearButton = document.createElement('input');
  clearButton.setAttribute("type", "button");
  clearButton.setAttribute("value", "refresh");
  clearButton.setAttribute("onclick", "eedbClearSearchResults(\""+ expSearchSet.id +"\");");
  expSearchSet.appendChild(clearButton);

  //<div id="eedbSearchBox1_messageID"></div>
  var msgDiv = document.createElement('div');
  msgDiv.id = expSearchSet.id + "_messageID";
  expSearchSet.appendChild(msgDiv);

  //<div id="search2" class="EEDBsearch" mode="experiments" grid="5" multiselect='1' title="eeDB experiments" ></div>
  var expSearch1 = document.createElement('div');
  expSearch1.id = trackID + "_newtrack_expsearch1";
  expSearch1.setAttribute('class', "EEDBsearch");
  expSearch1.setAttribute('mode', "feature_sources"); //really feature_sources but hidden at the start
  expSearch1.setAttribute('grid', "5");
  expSearch1.setAttribute('multiselect', "1");
  expSearch1.setAttribute('searchTitle', "eeDB feature sources");
  expSearchSet.appendChild(expSearch1);

  var expSearch2 = document.createElement('div');
  expSearch2.id = trackID + "_newtrack_expsearch2";
  expSearch2.setAttribute('class', "EEDBsearch");
  expSearch2.setAttribute('mode', "experiments");
  expSearch2.setAttribute('grid', "5");
  expSearch2.setAttribute('multiselect', "1");
  expSearch2.setAttribute('searchTitle', "eeDB experiments");
  expSearchSet.appendChild(expSearch2);

  //builds the search object structures
  eedbClearSearchResults(expSearchSet.id);
  var searchTrack1 = eedb_searchTracks[expSearch1.id];
  var searchTrack2 = eedb_searchTracks[expSearch2.id];
  var callOutFunction = function(searchID, fid, state) {
    var searchTrack = eedb_searchTracks[searchID];
    if(searchTrack) {
      var trackID = searchTrack.glyphsTrackID;
      var glyphTrack = gLyphTrack_array[trackID];
      if(glyphTrack == null) { return null; }

      glyphTrack.source_ids = "";
      for (var fid in searchTrack.selected_hash) {
        var obj = searchTrack.selected_hash[fid];
        if(!obj.state) {continue;}
        glyphTrack.source_ids += fid +",";
      }
      //document.getElementById("message").innerHTML = "search changed selection "+trackID+" "+fid;
      createDatatypeSelect(trackID);
    }
  }
  if(searchTrack1) {
    //document.getElementById("message").innerHTML = "new track "+trackID+ " search built";
    searchTrack1.glyphsTrackID = trackID;
    searchTrack1.callOutFunction = callOutFunction;
  }
  if(searchTrack2) {
    //document.getElementById("message").innerHTML = "new track "+trackID+ " search built";
    searchTrack2.glyphsTrackID = trackID;
    searchTrack2.callOutFunction = callOutFunction;
  }


  //
  // old config system
  //
  //var origSourceDiv = document.createElement('div');
  //origSourceDiv.id = trackID + "_pulldownSourcesDiv";
  //var hr2 = document.createElement('hr');
  //hr2.setAttribute('width', "75%");
  //origSourceDiv.appendChild(hr2);
  //origSourceDiv.appendChild(buildOriginalSourceConfig(trackID));
  //origSourceDiv.style.display = 'block';
  //trackDiv.appendChild(origSourceDiv);

  //
  //---------------------------------------------------------------------------------
  //
  var streamDiv = document.createElement('div');
  streamDiv.id = trackID + "_streamprocessDiv";
  trackDiv.appendChild(streamDiv);
  buildStreamProcessDiv(trackID);

  //
  //---------------------------------------------------------------------------------
  //
  trackDiv.appendChild(document.createElement('hr'));
  var labelVisual = document.createElement('div');
  labelVisual.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelVisual.innerHTML ="Visualization";
  trackDiv.appendChild(labelVisual);

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
  var span3b = document.createElement('div');
  span3b.id = trackID + "_extendedExpressOptions";
  span3b.setAttribute('style', "padding: 3px 0px 1px 4px");
  if(glyphTrack.glyphStyle == "express") {
    span3b.style.display = "block";
  } else {
    span3b.style.display = 'none';
  }
  div3.appendChild(span3b)

  //----------
  var span3 = document.createElement('span');
  span3.setAttribute('style', "padding: 1px 0px 1px 14px;");
  span3.innerHTML = "track pixel height: ";
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
  var span2 = document.createElement('span');
  span2.setAttribute('style', "margin: 0px 0px 0px 14px;");
  span2.innerHTML = "binning:";
  span3b.appendChild(span2);
  span3b.appendChild(createBinningSelect(trackID));
  //----------
  var logCheck = document.createElement('input');
  logCheck.setAttribute('style', "margin: 0px 1px 0px 14px;");
  logCheck.setAttribute('type', "checkbox");
  if(glyphTrack.logscale == 1) { logCheck.setAttribute('checked', "checked"); }
  logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'logscale', this.checked);");
  span3b.appendChild(logCheck);
  var span1 = document.createElement('span');
  span1.innerHTML = "log scale";
  span3b.appendChild(span1);
  //----------

  //----------
  var strandlessCheck = document.createElement('input');
  strandlessCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  strandlessCheck.setAttribute('type', "checkbox");
  if(glyphTrack.strandless) { strandlessCheck.setAttribute('checked', "checked"); }
  strandlessCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'strandless', this.checked);");
  span3b.appendChild(strandlessCheck);
  var span1b = document.createElement('span');
  span1b.innerHTML = "strandless";
  span3b.appendChild(span1b);
  //----------


  //----------
  trackDiv.appendChild(document.createElement('hr'));
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

  //
  //---------------------------------------------------------------------------------
  //
  trackDiv.appendChild(document.createElement('hr'));

  //
  // and the cancel/accept buttons
  //
  var span = document.createElement('span');
  var button = document.createElement('input');
  button.setAttribute("type", "button");
  button.setAttribute('style', "margin: 0px 14px 0px 0px");
  button.setAttribute("value", "cancel");
  button.setAttribute("onclick", "removeTrack(\"" + trackID + "\");");
  span.appendChild(button);
  var button = document.createElement('input');
  button.setAttribute("type", "button");
  button.setAttribute("value", "accept config");
  button.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'accept-new');");
  span.appendChild(button);
  trackDiv.appendChild(span);

  //loadConfigPanelPeers(trackID);
  //loadConfigPanelSources(trackID);
  eedbClearSearchResults(expSearchSet.id); 
}


function buildStreamProcessDiv(trackID) {
  var streamDiv = document.getElementById(trackID + "_streamprocessDiv");
  if(!streamDiv) { return; }
  streamDiv.innerHTML = "";

  streamDiv.appendChild(document.createElement('hr'));
  var labelStreamProcess = document.createElement('div');
  labelStreamProcess.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  labelStreamProcess.innerHTML ="Stream Processing (experimental - advanced users only)";
  streamDiv.appendChild(labelStreamProcess);

  var span1 = document.createElement('span');
  span1.innerHTML = "select stream processing: ";
  streamDiv.appendChild(span1);

  streamDiv.appendChild(buildStreamSelect(trackID));

  var streamParamsDiv = document.createElement('div');
  streamParamsDiv.id = trackID + "_spstreamParamsDiv";
  streamDiv.appendChild(streamParamsDiv);
}


function buildStreamSelect(trackID) {
  var streamSelect = document.createElement('select');
  streamSelect.id = trackID + "_streamProcessSelect";
  streamSelect.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'spstream', this.value);");

  var option;
  option = document.createElement('option');
  option.setAttribute("value", "none");
  option.innerHTML = "none";
  streamSelect.appendChild(option);

  //option = document.createElement('option');
  //option.setAttribute("value", "cutoff");
  //option.innerHTML = "cutoff filter";
  //streamSelect.appendChild(option);

  option = document.createElement('option');
  option.setAttribute("value", "overlapcluster");
  option.innerHTML = "overlap cluster";
  streamSelect.appendChild(option);

  option = document.createElement('option');
  option.setAttribute("value", "custom");
  option.innerHTML = "custom XML script";
  streamSelect.appendChild(option);

  return streamSelect;
}


function buildOriginalSourceConfig(trackID) {
  var trackDiv = document.createElement('div');

  //----------
  //
  // peer and sources
  //
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

  //var button1 = document.createElement('input');
  //button1.setAttribute("type", "button");
  //button1.setAttribute("value", "append source");
  //button1.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'source-append');");
  //trackDiv.appendChild(button1);

  // 
  // federated source entry form
  //
  //var div2 = document.createElement('div');
  //div2.setAttribute("style", "margin:2px 0px 2px 0px;");
  //trackDiv.appendChild(div2);
  //var span2 = document.createElement('span');
  //span2.innerHTML = "enter source ids [, separate if multiple]: ";
  //div2.appendChild(span2);
  ////input id="searchText" type="text" autocomplete="off" onkeyup="eedbMultiSearch(this.value, event)" size="140"
  //var input1 = document.createElement('input');
  //input1.id = trackID + "_inputsource_ids";
  //input1.setAttribute("type", "text");
  //input1.setAttribute("autocomplete", "off");
  //input1.setAttribute("size", "60");
  //input1.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'source-ids', this.value);");
  //div2.appendChild(input1);

  //
  // federated peer entry form
  //
  //div2 = document.createElement('div');
  //div2.setAttribute("style", "margin:2px 0px 2px 0px;");
  //trackDiv.appendChild(div2);
  //var span2 = document.createElement('span');
  //span2.innerHTML = "enter peer ids [, separate if multiple]: ";
  //div2.appendChild(span2);
  ////input id="searchText" type="text" autocomplete="off" onkeyup="eedbMultiSearch(this.value, event)" size="140"
  //var input1 = document.createElement('input');
  //input1.id = trackID + "_inputpeer_ids";
  //input1.setAttribute("type", "text");
  //input1.setAttribute("autocomplete", "off");
  //input1.setAttribute("size", "60");
  //input1.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'peer-ids', this.value);");
  //div2.appendChild(input1);

  return trackDiv;
}


function loadConfigPanelPeers(trackID) {
  var peerSelect = document.getElementById(trackID + "_peerselect");
  if(!peerSelect) { return; }

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var url = eedbObjectURL + "?mode=peers";

  var peerXHR=GetXmlHttpObject();
  if(peerXHR==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  peerXHR.instanceId = trackID;
  peerXHR.onreadystatechange= function(xhr) { return function() { loadConfigPanelPeersResponse(xhr); };}(peerXHR);
  peerXHR.open("GET",url,true);
  peerXHR.send(null);
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
  var option = document.createElement('option');
  option.setAttributeNS(null, "value", "");
  option.innerHTML = "all peers";
  peerSelect.appendChild(option);

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
  return (name2 < name1) - (name1 < name2);
}


function loadConfigPanelSources(trackID) {
  var sourceSelect = document.getElementById(trackID + "_selectsource");
  if(!sourceSelect) { return; }

  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  sourceSelect.innerHTML = "";
  var option = document.createElement('option');
  option.setAttributeNS(null, "value", "");
  option.innerHTML = "use all sources";
  sourceSelect.appendChild(option);

  //refetch the peer 
  if(glyphTrack.peerName == "") { return; }
  
  var url = eedbObjectURL + "?mode=feature_sources;peers=" + glyphTrack.peerName;

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
}

function sources_sort_func(a,b) {
  var name1 = a.getAttribute("name").toUpperCase();
  var name2 = b.getAttribute("name").toUpperCase();
  return (name2 < name1) - (name1 < name2);
}


function reconfigTrackParam(trackID, param, value) {
  //document.getElementById("message").innerHTML= "reconfig: " + trackID + ":: "+ param + "="+value;
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var newconfig = glyphTrack.newconfig;
  if(newconfig === undefined) {
    drawTrack(trackID);
    return;
  }

  if(param == "submode") {  newconfig.submode = value; }
  if(param == "binning") {  newconfig.binning = value; }
  if(param == "title") {  newconfig.title = value; }
  if(param == "exptype") {  glyphTrack.exptype  = newconfig.exptype = value; }
  if(param == "expfilter") {  newconfig.expfilter = value; }
  if(param == "spstream") {  
    glyphTrack.spstream = value; 
    reconfigureStreamParams(trackID);
  }
  if(param == "glyphStyle") { 
    newconfig.glyphStyle = value; 
    var expressOptions = document.getElementById(trackID + "_extendedExpressOptions");
    if(expressOptions) {
      if(value == "express") { expressOptions.style.display = "block"; }
      else { expressOptions.style.display = 'none'; }
    }
    createDatatypeSelect(trackID);
  }
  if(param == "trackmode") {
    //document.getElementById("message").innerHTML += "reconfig: " + trackID + ":: "+ param + "="+value;
    glyphTrack.trackmode = value;
    var searchTrack1   = document.getElementById(trackID + "_newtrack_expsearch1");
    var searchTrack2   = document.getElementById(trackID + "_newtrack_expsearch2");
    if(value == "expression") { 
      newconfig.sourcemode = "experiment"; 
      if(searchTrack1) { searchTrack1.setAttribute('mode', "hide"); }
      if(searchTrack2) { searchTrack2.setAttribute('mode', "experiments"); }
    };
    if(value == "annotation") { 
      newconfig.sourcemode = "feature_sources"; 
      if(searchTrack1) { searchTrack1.setAttribute('mode', "feature_sources"); }
      if(searchTrack2) { searchTrack2.setAttribute('mode', "hide"); }
    };
    if(value == "both") { 
      if(searchTrack1) { searchTrack1.setAttribute('mode', "feature_sources"); }
      if(searchTrack2) { searchTrack2.setAttribute('mode', "experiments"); }
    }

    var streamProcessOptions = document.getElementById(trackID + "_streamprocessDiv");
    if(value == "both") { buildStreamProcessDiv(trackID); }
    else { streamProcessOptions.innerHTML=""; }
    createGlyphstyleSelect(trackID);
    glyphTrack.source_ids = "";
    eedbSearchMultiSelect(trackID + "_newtrack_expsearch1", 'clear');
    eedbSearchMultiSelect(trackID + "_newtrack_expsearch2", 'clear');

    var expressOptions = document.getElementById(trackID + "_extendedExpressOptions");
    if(expressOptions) {
      if(value != "annotation") { expressOptions.style.display = "block"; }
      else { expressOptions.style.display = 'none'; }
    }
    createDatatypeSelect(trackID);
  }
  if(param == "sourcemode") {
    //document.getElementById("message").innerHTML += "reconfig: " + trackID + ":: "+ param + "="+value;
    newconfig.sourcemode = value;
    var searchTrack = document.getElementById(trackID + "_newtrack_expsearch1");
    if(searchTrack) {
      //searchTrack.setAttribute('mode', value);
      //searchTrack.setAttribute('searchTitle', "eeDB " + value);
    }
  }

  if(param == "maxlevels") {  
    newconfig.maxlevels = Math.floor(value); 
    if(newconfig.maxlevels <15) { newconfig.maxlevels = 15; } 
    if(newconfig.maxlevels >500) { newconfig.maxlevels = 500; } 
  }
  if(param == "expscaling") {  
    newconfig.expscaling = parseFloat(value); 
    if(isNaN(newconfig.expscaling) || (newconfig.expscaling==0)) { newconfig.expscaling = "auto"; } 
  }
  if(param == "mincutoff") {  
    newconfig.exp_mincut = parseFloat(value); 
  }
  if(param == "logscale") { 
    if(value) { newconfig.logscale=1; }
    else { newconfig.logscale = 0; }
  }
  if(param == "strandless") {
    if(value) { newconfig.strandless=true; }
    else { newconfig.strandless = false; }
  }
  if(param == "peer") {
    glyphTrack.peerName = value;
    //go dynamically fetch the featureSources from this EEDB now and rebuild the source pulldown
    loadConfigPanelSources(trackID);
    //createDatatypeSelect(trackID);
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
  if(param == "source-ids") {
    glyphTrack.source_ids = value;
  }
  if(param == "peer-ids") {
    glyphTrack.peerName = value;
  }


  if(param == "accept-new") {
    var peer_input_ids   = document.getElementById(trackID + "_inputpeer_ids");
    var source_input_ids = document.getElementById(trackID + "_inputsource_ids");
    var source_input     = document.getElementById(trackID + "_inputsource");
    var source_select    = document.getElementById(trackID + "_selectsource");
    if(peer_input_ids) { 
      if(peer_input_ids.value !="") { glyphTrack.peerName = peer_input_ids.value; }  
    }
    if(source_input_ids) { 
      if(source_input_ids.value !="") { glyphTrack.source_ids = source_input_ids.value; }  
    }
    if(source_input) { if(source_input.value !="") { glyphTrack.sources = source_input.value;}  }
    if(source_select) { glyphTrack.sources = source_select.value; }

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

    glyphTrack.trackDiv.setAttribute("style", "background-color: none; margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");

    if(glyphTrack.newconfig) {
      var newconfig = glyphTrack.newconfig;
      if(newconfig.glyphStyle !== undefined) { glyphTrack.glyphStyle = newconfig.glyphStyle; }
      if(newconfig.logscale !== undefined) { glyphTrack.logscale = newconfig.logscale; }
      if(newconfig.strandless !== undefined) { glyphTrack.strandless = newconfig.strandless; }
      if(newconfig.submode !== undefined) { glyphTrack.submode = newconfig.submode; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; }
      if(newconfig.expfilter !== undefined) { glyphTrack.expfilter = newconfig.expfilter; }
      if(newconfig.maxlevels !== undefined) { glyphTrack.maxlevels = newconfig.maxlevels; }
      if(newconfig.expscaling !== undefined) { glyphTrack.expscaling = newconfig.expscaling; }
      if(newconfig.exp_mincut !== undefined) { glyphTrack.exp_mincut = newconfig.exp_mincut; }
    }

    //
    // set some defaults if they are not configured
    //
    if(glyphTrack.title == "") { glyphTrack.title = glyphTrack.sources; }

    if(glyphTrack.glyphStyle == "express") {
      //document.getElementById("message").innerHTML = "new express track so set some defaults";
      if(glyphTrack.exptype === undefined)   { glyphTrack.exptype = glyphTrack.default_exptype; }
      if(glyphTrack.maxlevels === undefined) { glyphTrack.maxlevels = 100; }
      if(glyphTrack.expsscaling === undefined) { glyphTrack.expscaling = "auto"; }
    }

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
      var needReload=0;
      if((newconfig.glyphStyle !== undefined) && ( glyphTrack.glyphStyle != newconfig.glyphStyle))  {
        if((glyphTrack.glyphStyle=="express") || (newconfig.glyphStyle=="express")) { needReload=1; }
        glyphTrack.glyphStyle = newconfig.glyphStyle; 
      }
      if(newconfig.logscale !== undefined) { glyphTrack.logscale = newconfig.logscale; }
      if(newconfig.strandless !== undefined) { glyphTrack.strandless = newconfig.strandless; }
      if(newconfig.submode !== undefined) { glyphTrack.submode = newconfig.submode; needReload=1; }
      if(newconfig.binning !== undefined) { glyphTrack.binning = newconfig.binning; needReload=1; }
      if(newconfig.title !== undefined) { glyphTrack.title = newconfig.title; }
      if(newconfig.exptype !== undefined) { glyphTrack.exptype = newconfig.exptype; needReload=1; }
      if(newconfig.expfilter !== undefined) { glyphTrack.expfilter = newconfig.expfilter; needReload=1; }
      if(newconfig.maxlevels !== undefined) { glyphTrack.maxlevels = newconfig.maxlevels; }
      if(newconfig.expscaling !== undefined) { glyphTrack.expscaling = newconfig.expscaling; }
      if(newconfig.exp_mincut !== undefined) { glyphTrack.exp_mincut = newconfig.exp_mincut; }
    }
    glyphTrack.newconfig = undefined;
    if(needReload == 1) {
      glyphTrack.experiments = undefined;
      prepareTrackXHR(trackID);
    } else {
      //reuse the xmlDoc but recalculate the transforms
      prepareTrackData(trackID);
    }
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

  if(glyphTrack.spstream == "cutoff") { createStreamParams_cutoff(glyphTrack, paramDiv); }
  if(glyphTrack.spstream == "overlapcluster") { createStreamParams_overlapcluster(glyphTrack, paramDiv); }
  if(glyphTrack.spstream == "custom") { createStreamParams_custom(glyphTrack, paramDiv); }
}

function createStreamParams_cutoff(glyphTrack, paramDiv) {
  var span4 = document.createElement('span');
  span4.innerHTML = "min-cutoff: ";
  paramDiv.appendChild(span4);
  var minInput = document.createElement('input');
  minInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  minInput.setAttribute('size', "10");
  minInput.setAttribute('type', "text");
  minInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_mincutoff', this.value);");
  paramDiv.appendChild(minInput);
}

function createStreamParams_overlapcluster(glyphTrack, paramDiv) {
  var span4 = document.createElement('span');
  span4.innerHTML = "min-cutoff: ";
  paramDiv.appendChild(span4);
  var minInput = document.createElement('input');
  minInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  minInput.setAttribute('size', "10");
  minInput.setAttribute('type', "text");
  minInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_mincutoff', this.value);");
  paramDiv.appendChild(minInput);

  span4 = document.createElement('span');
  span4.setAttribute('style', "margin: 0px 0px 0px 5px;");
  span4.innerHTML = "window overlap: ";
  paramDiv.appendChild(span4);
  var winInput = document.createElement('input');
  winInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  winInput.setAttribute('size', "10");
  winInput.setAttribute('type', "text");
  winInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_clusterWindow', this.value);");
  paramDiv.appendChild(winInput);

}


function createStreamParams_custom(glyphTrack, paramDiv) {
  var configInput = document.createElement('textarea');
  configInput.setAttribute('style', "width:700px; margin: 3px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  configInput.setAttribute('rows', 7);
  configInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ glyphTrack.trackID+"\", 'spstream_configxml', this.value);");
  paramDiv.appendChild(configInput);
}


//--------------------------------------------------------
//
// track re-configuration control panel section
//
//--------------------------------------------------------

function gLyphsReconfigureTrack(trackID) {
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
                            +"font-size:10px; font-family:arial,helvetica,sans-serif; "
                            +"z-index:1; opacity: 0.9; filter:alpha(opacity=90); -moz-opacity:0.9; "
                            +"left:" + (toolTipSTYLE.xpos-309) +"px; "
                            +"top:" + toolTipSTYLE.ypos +"px; "
			    +"width:300px;"
                             );

  //----------
  var div01 = document.createElement('div');
  var span01 = document.createElement('span');
  span01.setAttribute('style', "font-size:9px; font-family:arial,helvetica,sans-serif;");
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
  var src_msg = "data sources: ";
  if(fsrc_count>0) { src_msg += "feature_sources["+fsrc_count+"]  "; }
  if(exp_count>0)  { src_msg += "experiments["+exp_count+"]"; } 
  span01.innerHTML = src_msg;
  div01.appendChild(span01);
  divFrame.appendChild(div01)

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
  var glyphSelect = createGlyphstyleSelect(trackID);
  divFrame.appendChild(glyphSelect);

  //----------
  var div3 = document.createElement('div');
  divFrame.appendChild(div3)

  var logCheck = document.createElement('input');
  logCheck.setAttribute('style', "margin: 1px 1px 1px 1px;");
  logCheck.setAttribute('type', "checkbox");
  if(glyphTrack.logscale == 1) { logCheck.setAttribute('checked', "checked"); }
  logCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'logscale', this.checked);");
  div3.appendChild(logCheck);

  var span1 = document.createElement('span');
  span1.innerHTML = "log scale"; 
  div3.appendChild(span1);

  var strandlessCheck = document.createElement('input');
  strandlessCheck.setAttribute('style', "margin: 1px 1px 1px 7px;");
  strandlessCheck.setAttribute('type', "checkbox");
  if(glyphTrack.strandless) { strandlessCheck.setAttribute('checked', "checked"); }
  strandlessCheck.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'strandless', this.checked);");
  div3.appendChild(strandlessCheck);

  var span1 = document.createElement('span');
  span1.innerHTML = "strandless";
  div3.appendChild(span1);

  //----------
  var div3b = document.createElement('div');
  divFrame.appendChild(div3b)

  var submodeSelect = createSubmodeSelect(trackID);
  div3b.appendChild(submodeSelect);

  var binningSelect = createBinningSelect(trackID);
  div3b.appendChild(binningSelect); 

  //----------
  var datatypeSelect = createDatatypeSelect(trackID);
  if(datatypeSelect) { 
    var div4 = document.createElement('div');
    divFrame.appendChild(div4);
    var span2 = document.createElement('span');
    span2.innerHTML = "datatype:"; 
    div4.appendChild(span2);
    div4.appendChild(datatypeSelect); 

    //var binningSelect = createBinningSelect(trackID);
    //div4.appendChild(binningSelect); 
  }

  //----------
  var div5 = document.createElement('div');
  var span3 = document.createElement('span');
  span3.innerHTML = "track pixel height: "; 
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
  var div6 = document.createElement('div');
  var span4 = document.createElement('span');
  span4.innerHTML = "express scale: "; 
  div6.appendChild(span4);
  var levelInput = document.createElement('input');
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  levelInput.setAttribute('size', "7");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', glyphTrack.expscaling);
  levelInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'expscaling', this.value);");
  div6.appendChild(levelInput);

  span4 = document.createElement('span');
  span4.innerHTML = "min-cutoff: ";
  div6.appendChild(span4);
  var minInput = document.createElement('input');
  minInput.setAttribute('style', "margin: 1px 1px 1px 1px;");
  minInput.setAttribute('size', "7");
  minInput.setAttribute('type', "text");
  minInput.setAttribute('value', glyphTrack.exp_mincut);
  minInput.setAttribute("onkeyup", "reconfigTrackParam(\""+ trackID+"\", 'mincutoff', this.value);");
  div6.appendChild(minInput);

  divFrame.appendChild(div6)

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

  var button3 = document.createElement('input');
  button3.setAttribute("type", "button");
  button3.setAttribute("value", "save track");
  button3.setAttribute('style', "float:middle; margin: 0px 4px 4px 4px;");
  button3.setAttribute("onclick", "saveTrackConfig(\""+ trackID+"\");");
  divFrame.appendChild(button3);

  //----------
  trackDiv.appendChild(divFrame);
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
  button3.setAttribute("value", "save track");
  button3.setAttribute('style', "float:middle; margin: 0px 4px 4px 4px;");
  button3.setAttribute("onclick", "saveTrackConfig(\""+ trackID+"\");");
  divFrame.appendChild(button3);

  //----------
  trackDiv.appendChild(divFrame);
}


function createGlyphstyleSelect(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  var span1       = document.getElementById(trackID + "_glyphselectSpan");
  var glyphSelect = document.getElementById(trackID + "_glyphselect");
  if(!span1) {
    span1 = document.createElement('span');
    span1.id = trackID + "_glyphselectSpan";
    span1.setAttribute("style", "margin:2px 0px 2px 0px;");

    var span2 = document.createElement('span');
    span2.innerHTML = "select gLyph style: ";
    span1.appendChild(span2);

    glyphSelect = document.createElement('select');
    glyphSelect.id = trackID + "_glyphselect";
    glyphSelect.setAttributeNS(null, "onchange", "reconfigTrackParam(\""+ trackID+"\", 'glyphStyle', this.value);");
    span1.appendChild(glyphSelect);
  }
  glyphSelect.innerHTML = "";

  var styles = new Array;
  if(glyphTrack.trackmode != "annotation") { styles.push("express"); }
  if(glyphTrack.trackmode != "expression") {
    styles.push("centroid", "thick-arrow", "transcript", "thin-transcript", "cytoband", "box", "arrow", "line", "exon", "utr", "thin", "probesetloc", "seqtag");
  }
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
  submodeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'submode', this.value);");

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

  var datatypeSelect = document.getElementById(trackID + "_datatypeSelect");
  if(!datatypeSelect) { 
    datatypeSelect = document.createElement('select');
    datatypeSelect.setAttribute('name', "datatype");
    datatypeSelect.setAttribute('style', "margin: 1px 4px 1px 4px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    datatypeSelect.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'exptype', this.value);");
    datatypeSelect.id = trackID + "_datatypeSelect";
  }
  datatypeSelect.innerHTML = ""; //to clear old content

  if(glyphTrack.source_ids == "") { return datatypeSelect; }

  var url = eedbObjectURL;
  var params = "mode=expression_datatypes";
  if(glyphTrack.source_ids !== undefined) {
    params += ";source_ids=" + glyphTrack.source_ids;
  }

  var datatypeXHR=GetXmlHttpObject();
  if(datatypeXHR==null) {
    alert ("Your browser does not support AJAX!");
    return datatypeSelect;
  }
  glyphTrack.datatypeXHR = datatypeXHR;
  datatypeXHR.onreadystatechange= function(id) { return function() { displayDatatypeSelect(id); };}(trackID);

  if(params.length < 1000) {
    datatypeXHR.open("GET",url+"?"+params,true);
    datatypeXHR.send(null);
  } else {
    datatypeXHR.open("POST",url,true);
    datatypeXHR.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    datatypeXHR.setRequestHeader("Content-length", params.length);
    datatypeXHR.setRequestHeader("Connection", "close");
    datatypeXHR.send(params);
  }

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

  //var option = document.createElement('option');
  //option.setAttribute("value", "");
  //option.innerHTML = "no datatype filter";
  //datatypeSelect.appendChild(option);

  var types = xmlDoc.getElementsByTagName("datatype");
  var sortedTypes = new Array();
  var selectOK = false;
  for(var i=0; i<types.length; i++) {
    sortedTypes.push(types[i]);
    var type = types[i].getAttribute("type");
    if(type == glyphTrack.exptype) { selectOK = true; }
  }
  sortedTypes.sort(datatype_sort_func);
  if(!selectOK) { glyphTrack.exptype=""; }

  for(var i=0; i<sortedTypes.length; i++) {
    var typeDOM = sortedTypes[i];
    var type = typeDOM.getAttribute("type");
    if(i==0) { 
      glyphTrack.default_exptype = type;
      if(glyphTrack.exptype == "") { glyphTrack.exptype = type; }
    }        
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

  if(glyphTrack.trackID == current_region.active_trackID) {
    current_region.active_trackID = undefined;
    current_express_probe = undefined;
    current_expExpress = undefined;
    delete region_express_probes[trackID];
  }

  delete gLyphTrack_array[trackID];
  delete trackXHR_array[trackID];
  delete region_express_probes[trackID];

  drawExpressionData();
  displayProbeInfo();
}

function endDrag() {
  //document.getElementById("message").innerHTML += "global end drag ";
  moveTrack("enddrag");
  current_dragTrack = null;

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
  }
  if(targetTrack_index > currentDrag_index) {
    var target_div = trackDivs[targetTrack_index];
    if(target_div) { glyphset.insertBefore(current_dragTrack.trackDiv, target_div.nextSibling); }
  }
}


function selectTrackRegion(mode, trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }

  updateTrackingLine(trackID);

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
  //var msg = "select x:" + glyphTrack.selection.xstart + "  y:"+ glyphTrack.selection.xend;
  //document.getElementById("message").innerHTML = msg;

  //if(glyphTrack.glyphStyle == "express") { drawTrack(trackID); } 
  //else { drawSelection(glyphTrack); }
  drawTrack(trackID);
  updateTrackingLine(trackID);
}


function magnifyToSelection(trackID) {
  var glyphTrack = gLyphTrack_array[trackID];
  if(glyphTrack == null) { return; }
  if(glyphTrack.selection == null) { return; }
 
  var selection = glyphTrack.selection;
  gLyphsSetLocation(current_region.asm, current_region.chrom, selection.chrom_start, selection.chrom_end);
  glyphTrack.selection = null;

  eedbEmptySearchResults();
  reloadRegion();
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

  var xpos   = toolTipSTYLE.xpos - glyphTrack.mouse_offset
  var start  = current_region.start;
  var end    = current_region.end;
  var dwidth = current_region.display_width;
  var chrpos = Math.floor(start + (xpos*(end-start)/dwidth));
  
  current_region.trackline_xpos   = xpos;
  current_region.trackline_chrpos = chrpos;

  //document.getElementById("message").innerHTML = "trackline x:"+xpos + "  chrpos:"+chrpos;
  var desc = current_region.loc_desc;
  desc += "<span style=\'font-size:8pt; color: orangered;\'> track:" +chrpos+ "</span>";
  document.getElementById("gLyphs_location_info").innerHTML = desc;

  //loop through all the tracks and update
  for(var id in gLyphTrack_array){
    var glyphTrack = gLyphTrack_array[id];
    if(glyphTrack.trackLine) {
      glyphTrack.trackLine.setAttributeNS(null, 'x', (current_region.trackline_xpos-2)+'px');
    }
  }
}


function updateTitleBar() {
  //if(!current_expExpress) { return; }
  //if(current_expExpress.trackID == current_region.active_trackID) { return; }

  if(current_expExpress) { current_region.active_trackID = current_expExpress.trackID; }

  //document.getElementById("message").innerHTML = "update titlebar " + current_region.active_trackID; 

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

  glyphTrack2.experiments = new Object;
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    glyphTrack2.experiments[experiment.expID] = Object.clone(experiment);
  }

  gLyphTrack_array[trackID2] = glyphTrack2;

  drawTrack(trackID2);  //this creates empty tracks with the "loading" tag

  prepareTrackXHR(trackID2);
}

