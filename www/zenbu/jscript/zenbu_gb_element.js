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


//var element = new ZenbuGBElement();

function ZenbuGBElement(elementID) {
  //create empty, uninitialized Category report-element object
  console.log("create ZenbuGBElement");
  this.element_type = "zenbugb";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  //zenbuElement_init.call(this); //eventually when I refactor the superclass Element into object code

  this.title_prefix = "";
  this.title = "new ZenbuGB";
  this.datasource_mode = "";
  this.configUUID = "";
  this.chrom_location = "";
  this.location_padding = 0.1;
  this.searchbox_enabled = true;
  
  this.content_width = 800;
  this.content_height = 300;
  this.auto_content_height = true;

  this.show_titlebar = true;
  this.widget_search = false;
  this.widget_filter = false;
  
  this.glyphsGB = new ZenbuGenomeBrowser();
  this.glyphsGB.reportElement = this;
  this.glyphsGB.searchbox_enabled = true;
  this.glyphsGB.hide_compacted_tracks = false;
  this.glyphsGB.view_config_loaded = true; //hack for an empty glyphsGB
  this.glyphsGB.display_width = this.content_width - 30;
  this.glyphsGB.display_width_auto = false;
  this.glyphsGB.asm = "hg38";
  this.glyphsGB.chrom = "chr19";
  this.glyphsGB.start = 49657992;
  this.glyphsGB.end = 49666908;
  
  //this.configUUID = "Xyv6DKmMLRSnK3Kt2VxEiC";  //empty DEX configuration, might change
  this.chrom_location = "hg38::chr19:49657992..49666908";

  reportElementAddDatatypeColumn(this, "name", "name", true);
  reportElementAddDatatypeColumn(this, "category", "category", true);
  //reportElementAddDatatypeColumn(this, "source_name", "source_name", true);
  //reportElementAddDatatypeColumn(this, "location_link", "location", false);
  reportElementAddDatatypeColumn(this, "location_string", "location", false);

  //create empty cytoband track
  gLyphsSearchInterface(this.glyphsGB);
  createAddTrackTool(this.glyphsGB);

  var glyphTrack = new ZenbuGlyphsTrack(this.glyphsGB);
  glyphTrack.glyphStyle = "cytoband";
  this.glyphsGB.gLyphTrackSet.appendChild(glyphTrack.trackDiv);
  createAddTrackTool(this.glyphsGB); //so it moves to end

  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
  gLyphsChangeActiveTrack(glyphTrack);
  
  gLyphsReloadRegion(this.glyphsGB); 

  this.glyphsGB.trackLoadComplete = zenbuGBElement_trackLoadComplete;
  this.glyphsGB.selectionCallback = zenbuGBElement_selectionCallback;
  this.glyphsGB.activeTrackCallback = zenbuGBElement_activeTrackCallback;
  this.glyphsGB.autosave = zenbuGBElement_autosave;

  //methods
  this.initFromConfigDOM  = zenbuGBElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuGBElement_generateConfigDOM;  //returns a ConfigDOM object

  this.elementEvent       = zenbuGBElement_elementEvent;
  this.reconfigureParam   = zenbuGBElement_reconfigureParam;

  this.resetElement       = zenbuGBElement_reset;
  this.loadElement        = zenbuGBElement_load;
  this.postprocessElement = zenbuGBElement_postprocess;
  this.drawElement        = zenbuGBElement_draw;
  this.configSubpanel     = zenbuGBElement_configSubpanel;

  this.datasource         = zenbuGBElement_datasourceElement;

  //internal methods

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================
//TODO: need to figure this out, not currently using

function zenbuGBElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "zenbugb") { return false; }
  
  if(elementDOM.getAttribute("view_config")) { this.configUUID = elementDOM.getAttribute("view_config"); }
  if(elementDOM.getAttribute("configUUID")) { this.configUUID = elementDOM.getAttribute("configUUID"); }
  if(elementDOM.getAttribute("chrom_location")) { this.chrom_location = elementDOM.getAttribute("chrom_location"); }
  if(elementDOM.getAttribute("location_padding")) { this.location_padding = parseFloat(elementDOM.getAttribute("location_padding")); }
  if(elementDOM.getAttribute("searchbox_enabled")=="false") { this.searchbox_enabled = false; }
  

  return true;
}


function zenbuGBElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  if(this.configUUID) { elementDOM.setAttribute("view_config", this.configUUID); }
  if(this.configUUID) { elementDOM.setAttribute("configUUID", this.configUUID); }
  if(this.chrom_location) { elementDOM.setAttribute("chrom_location", this.chrom_location); }
  if(this.location_padding) { elementDOM.setAttribute("location_padding", this.location_padding); }
  if(!this.searchbox_enabled) { elementDOM.setAttribute("searchbox_enabled", "false"); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuGBElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this.datasource();

  console.log("zenbuGBElement_elementEvent "+this.elementID+" mode:"+mode+"  value: "+value);
  if(mode == "select_location") {
    this.selected_location = value;
    reportsPostprocessElement(this.elementID);
    reportsDrawElement(this.elementID);
  }
  
  if(mode == "set_view_config") {
    this.configUUID = value;
    //reload glyphsGB with new config
    gLyphsInitViewConfigUUID(this.glyphsGB, this.configUUID);
    //need to get default location from config
    this.chrom_location = this.glyphsGB.regionLocation();
    reportsPostprocessElement(this.elementID);
    reportsDrawElement(this.elementID);
  }
  
  if(mode == "select") {
    this.selected_id = value;
    reportsDrawElement(this.elementID);
  }
  
  if(mode == "autosave") {  
    this.glyphsGB.autosave(); 
    reportElementToggleSubpanel(this.elementID, 'refresh');
    //reportElementReconfigParam(this.elementID, 'refresh');
  }
}


function zenbuGBElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  if(param == "zenbu_configUUID") {
    this.newconfig.configUUID = value;
    return true;
  }

  if(param == "location_padding") {
    if(value<0) { value=0; }
    if(value>1) { value=1; }
    this.newconfig.location_padding = value;
  }

  if(param == "searchbox_enabled") { this.newconfig.searchbox_enabled = value; }

  if(param == "accept-reconfig") {
    //this.needReload=true;
    if(this.newconfig.location_padding !== undefined) { this.location_padding = this.newconfig.location_padding; }
    if(this.newconfig.searchbox_enabled !== undefined) { this.searchbox_enabled = this.newconfig.searchbox_enabled; }
    if(this.newconfig.configUUID !== undefined) { 
      this.configUUID = this.newconfig.configUUID;
      //reload glyphsGB with new config
      gLyphsInitViewConfigUUID(this.glyphsGB, this.configUUID);
      //need to get default location from config
      this.chrom_location = this.glyphsGB.regionLocation();
    }
  }
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================


function zenbuGBElement_reset() {
  console.log("zenbuGBElement_reset ["+this.elementID+"]");
  
  //clear previous target
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  this.selected_location = null; 
  
  this.chrom_location = "";
  this.title = this.title_prefix;
  
  if(this.glyphsGB) {
    this.glyphsGB.display_width = this.content_width -30;
    this.glyphsGB.display_width_auto = false;
    this.postprocessElement();
  }
}


function zenbuGBElement_load() {
  console.log("zenbuGBElement_load ["+this.elementID+"]");
  //zenbuGBElement_reset(this);
  
  this.title = this.title_prefix;
  //if(this.focus_feature) {
  //  this.title = this.title_prefix +" : " + this.focus_feature.name;
  //}
  
  this.loading = true;
  reportsDrawElement(this.elementID); //clear or show loading
  
  //eventually this might do something after I get the zenbu_gb javascript native into zenbu-reports
  //but for now it's a stub
  //reportsPostprocessZenbuGB(this);
  this.postprocessElement();
  reportsDrawElement(this.elementID);
}


function zenbuGBElement_postprocess() {
  console.log("zenbuGBElement_postprocess ["+this.elementID+"]");
  
  this.loading = false;
  
  var main_div = this.main_div;
  if(!main_div) { return; }

  this.title = this.title_prefix; //reset title

  //if(!this.configUUID) { return; }
  //if(!this.focus_feature) { return; }
    
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 15;
  width = width - 10;
  
  //load an enbedded zenbu genome browser into the div
  /*
   this.configUUID = "kzwDaVIQApzmnPDsong5J";
   this.chrom_location = "";
   this.zenbu_url = "http://zenbu.gsc.riken.jp/zenbudev/gLyphs";
   this.selected_id = "";
   this.selected_feature = null;
   */
  
  //<object type="text/html" data="http://zenbu.gsc.riken.jp/zenbudev/gLyphs/index_embed3.html#config=kzwDaVIQApzmnPDsong5J;loc=hg38::chrX:102740106..102914471+;dwidth=1000" style="width:100%; height:500px">
  //var zenbu_obj = document.createElement('embed');
  //   var zenbu_obj = document.createElement('object');
  //   //var zenbu_obj = document.createElement('iframe');
  //   zenbu_obj.type = "text/html";
  //   style = "width:100%; ";
  //   //if(this.content_width) { style += "width:"+(this.content_width)+"px; "; }
  //   style += "height: "+(height - 30)+"px; ";
  //   zenbu_obj.setAttribute('style', style);
  //   zenbu_obj.innerHTML = "loading....";
  
  //var url = "../gLyphs/index_embed3.html#config=" + this.configUUID;
  //url += ";dwidth=" + (width-45);
  var chromloc = "";
  if(this.focus_feature && this.focus_feature.chrom) {
    var chromlen = this.focus_feature.end - this.focus_feature.start + 1;
    var padding = parseInt(this.location_padding * chromlen);
    console.log("feature len "+chromlen + " padding "+padding);
    chromloc = this.focus_feature.chrom+ ":" + (this.focus_feature.start - padding) + ".."+ (this.focus_feature.end + padding);
  } 
  if(this.selected_location) {
    chromloc = this.selected_location;
    var region = zenbuParseLocation(chromloc);
    if(region) {
      var chromlen = region.end - region.start + 1;
      var padding = parseInt(this.location_padding * chromlen);
      chromloc = region.chrom+ ":" + (region.start - padding) + ".."+ (region.end + padding);
    }
  }
  // if(chromloc) { url += ";loc=" + chromloc; }
  // //zenbu_obj.data = url;
  // //zenbu_obj.src = url;
  // console.log("zenbuGBElement_postprocess " + url);
  // //if(!chromloc) { zenbu_obj.innerHTML = "no location available"; }
  // 
  // if(chromloc != this.chrom_location) {
  //   console.log("zenbuGBElement_postprocess: location changed to : "+chromloc);
  //   this.zenbu_view_obj = zenbu_obj;
  // }
  // if(this.current_gb_width != (width-45)) {
  //   console.log("zenbuGBElement_postprocess: width changed to : "+(width-45));
  //   this.zenbu_view_obj = zenbu_obj;
  // }
  // if(!this.zenbu_view_obj) { 
  //   console.log("zenbuGBElement_postprocess: no view_obj so set");
  //   this.zenbu_view_obj = zenbu_obj; 
  // }

  if(chromloc) { this.chrom_location = chromloc; }
  
  if(!this.glyphsGB) {
    this.glyphsGB = new ZenbuGenomeBrowser();
    this.glyphsGB.trackLoadComplete = zenbuGBElement_trackLoadComplete;
    this.glyphsGB.selectionCallback = zenbuGBElement_selectionCallback;
    this.glyphsGB.activeTrackCallback = zenbuGBElement_activeTrackCallback;
    this.glyphsGB.autosave = zenbuGBElement_autosave;
    this.glyphsGB.searchbox_enabled = true;
    this.glyphsGB.reportElement = this;
    gLyphsSearchInterface(this.glyphsGB);
  }
  
  if(this.configUUID && !this.glyphsGB.configUUID) {
    console.log("zenbuGBElement_postprocess config not loaded");
    gLyphsInitViewConfigUUID(this.glyphsGB, this.configUUID);
  }
  gLyphsInitLocation(this.glyphsGB, this.chrom_location);
  this.glyphsGB.display_width = this.content_width - 30;
  this.glyphsGB.display_width_auto = false;
  this.main_div.appendChild(this.glyphsGB.main_div);

  this.glyphsGB.searchbox_enabled = this.searchbox_enabled;
  gLyphsSearchInterface(this.glyphsGB);

  gLyphsReloadRegion(this.glyphsGB); 
}  


function zenbuGBElement_draw() {
  console.log("zenbuGBElement_draw ["+this.elementID+"]");
  
  var main_div = this.main_div;
  if(!main_div) { return; }

  // if(this.selected_id) { console.log(this.elementID+" selected_id="+this.selected_id); }
  // if(this.selected_feature) { console.log(this.elementID+" selected_feature="+this.selected_feature.id); }
  // if(this.selected_edge) { console.log(this.elementID+" selected_edge="+this.selected_edge.id); }
  // if(this.selected_source) { console.log(this.elementID+" selected_source="+this.selected_source.id); }
  // if(this.selected_location) { console.log(this.elementID+" selected_location="+this.selected_location); }
  
  //if(!this.configUUID) { return; }
  //if(!this.focus_feature) { return; }
  
  // if(current_report.current_dragging_element) {
  //   console.log("zenbuGBElement_draw dragging so remove view_obj");
  //   if(this.zenbu_view_obj) { main_div.removeChild(this.zenbu_view_obj); }
  //   var span1 = main_div.appendChild(document.createElement('span'));
  //   span1.setAttribute('style', "font-size:11px; ;margin-left:15px;");
  //   span1.innerHTML = "dragging...";
  //   return;
  // }
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 15;
  width = width - 10;

  //resize to pagesize logic
  if(this.resized) {
    console.log("zenbuGBElement_draw: resized!!! to width " +this.content_width);
    //reportsPostprocessZenbuGB(this);
    this.postprocessElement();
    glyphsNavigationControls(this.glyphsGB);
  }
  //if(!this.zenbu_view_obj) {
  //  console.log("zenbuGBElement_draw: no view_obj so generate");
  //  this.postprocessElement();
  //}
  
  //load an enbedded zenbu genome browser into the div
  /*
   this.configUUID = "kzwDaVIQApzmnPDsong5J";
   this.chrom_location = "";
   this.zenbu_url = "http://zenbu.gsc.riken.jp/zenbudev/gLyphs";
   this.selected_id = "";
   this.selected_feature = null;
   */
  
  /*
   //<object type="text/html" data="http://zenbu.gsc.riken.jp/zenbudev/gLyphs/index_embed3.html#config=kzwDaVIQApzmnPDsong5J;loc=hg38::chrX:102740106..102914471+;dwidth=1000" style="width:100%; height:500px">
   var zenbu_obj = main_div.appendChild(document.createElement('object'));
   zenbu_obj.type = "text/html";
   style = "width:100%; ";
   //if(this.content_width) { style += "width:"+(this.content_width)+"px; "; }
   style += "height: "+(height - 30)+"px; ";
   zenbu_obj.setAttribute('style', style);
   zenbu_obj.innerHTML = "loading....";
   
   var url = this.zenbu_url + "/index_embed3.html#config=" + this.configUUID;
   //var url = "../gLyphs/index_embed3.html#config=" + this.configUUID;
   url += ";dwidth=" + (width-45);
   if(this.focus_feature.chrom) {
   var chromlen = this.focus_feature.end - this.focus_feature.start + 1;
   var padding = parseInt(0.1 * chromlen);
   console.log("feature len "+chromlen + " padding "+padding);
   url += ";loc=" + this.focus_feature.chrom+ ":" + (this.focus_feature.start - padding) + ".."+ (this.focus_feature.end + padding);
   zenbu_obj.data = url;
   console.log("zenbuGBElement_draw " + url);
   } else {
   zenbu_obj.innerHTML = "no location available";
   }
   */
  
  if(this.glyphsGB) {
    this.glyphsGB.display_width = this.content_width -30;
    this.glyphsGB.display_width_auto = false;
    main_div.appendChild(this.glyphsGB.main_div);
    //gLyphsInitLocation(this.glyphsGB, this.chrom_location);
    //gLyphsReloadRegion(this.glyphsGB);
    
    if(this.selected_id) {
      gLyphsSearchSelect(this.glyphsGB, this.selected_id);
    }
  }
}


function zenbuGBElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  //var datasourceElement = this.datasource();
  
  var labelDiv = configdiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="Visualization:";

  //----------
  var configUUID = this.configUUID;
  if(this.newconfig && this.newconfig.configUUID != undefined) { configUUID = this.newconfig.configUUID; }
  var div1 = configdiv.appendChild(document.createElement('div'));
  var span0 = div1.appendChild(document.createElement('span'));
  span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "view config:";
  var titleInput = div1.appendChild(document.createElement('input'));
  titleInput.setAttribute('style', "width:200px; margin: 1px 1px 1px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', configUUID);
  titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'zenbu_configUUID', this.value);");
  titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'zenbu_configUUID', this.value);");
  titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");

  button = div1.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "slimbutton";
  button.style.marginLeft = "5px";
  button.value = "save view";
  button.innerHTML = "save view";
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'autosave');");
  //button.onclick = function() { this.glyphsGB.autosave(); reportElementToggleSubpanel(this.elementID, 'refresh'); }

  //----
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var val1 = this.location_padding;
  if(this.newconfig && this.newconfig.location_padding != undefined) { val1 = this.newconfig.location_padding; }
  var span3 = tdiv2.appendChild(document.createElement('span'));
  span3.setAttribute('style', "margin-left: 5px; ");
  var tspan = span3.appendChild(document.createElement('span'));
  tspan.innerHTML = "location padding factor: ";
  var input = span3.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', val1);
  input.setAttribute("onchange", "reportElementReconfigParam(\""+this.elementID+"\", 'location_padding', this.value);");
  
  //tdiv2  = configdiv.appendChild(document.createElement('div'));
  //tdiv2.setAttribute('style', "margin-top: 5px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.searchbox_enabled;
  if(this.newconfig && this.newconfig.searchbox_enabled != undefined) { 
    val1 = this.newconfig.searchbox_enabled; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'searchbox_enabled', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "enable search box";

  configdiv.appendChild(document.createElement('hr'));
  return configdiv;
}

//=================================================================================
//
// helper functions
//
//=================================================================================

function zenbuGBElement_trackLoadComplete() {
  //logic to update page size based on dynamicly growing genome browser
  var master_div = document.getElementById("zenbuReportsDiv");
  if(!master_div) { return; }
  var masterRect = master_div.getBoundingClientRect();
  var mainRect = this.main_div.getBoundingClientRect();
  if(masterRect.bottom < mainRect.bottom + 10) {
    var t_height = mainRect.bottom - masterRect.top + 10;
    if(t_height < 100) { t_height = 100; }
    master_div.style.height = t_height + "px";
  }
  return;
  //callback function for this==ZenbuGenomeBrowser
  //console.log("zenbuGBElement_trackLoadComplete load_count: "+ this.load_count);
//   var height = this.main_div.clientHeight;
//   if(height<300) { height = 300; }
//   //console.log("glyphsGB  height= "+height);
//   //console.log("gbElement height= "+(this.reportElement.main_div.clientHeight));
//   this.reportElement.content_height = height+30;
//   if(this.reportElement.main_div) {
//     this.reportElement.main_div.style.height = height+30+"px";
//   }
}


function zenbuGBElement_selectionCallback() {
  //callback function for this==ZenbuGenomeBrowser
  var selected_feature = this.selectedFeature();
  var reportElement    = this.reportElement;
  
  console.log("zenbuGBElement_selectionCallback "+this.elementID); 
  if(!selected_feature) { 
    return;
  }

  console.log("zenbuGBElement_selectionCallback activeTrack:"+this.active_trackID+"  feature:"+(selected_feature.id));  console.log("zenbuGBElement_selectionCallback "+(selected_feature.name));
  
  //this.reportElement.configUUID = glyphsGB.configUUID;
  reportElement.selected_id = "";
  reportElement.selected_feature = selected_feature;
  //reportElementUserEvent(reportElement, 'select', selected_feature.id);

  current_report.active_cascades = {};  //start new user cascade
  reportElementTriggerCascade(reportElement, "select");
}


function zenbuGBElement_activeTrackCallback() {
  //callback function for this==ZenbuGenomeBrowser
  var selected_feature = this.selectedFeature();
  var reportElement    = this.reportElement;
  
  console.log("zenbuGBElement_activeTrackCallback "+reportElement.elementID + " activeTrack:"+reportElement.active_trackID);
  
  //this.reportElement.configUUID = glyphsGB.configUUID;
  //reportElement.selected_id = "";
  //reportElement.selected_feature = selected_feature;
  //reportElementUserEvent(reportElement, 'select', selected_feature.id);

  //reportsPostprocessElement(reportElement.elementID);

  current_report.active_cascades = {};  //start new user cascade
  reportElementTriggerCascade(reportElement, "postprocess");
  reportElementTriggerCascade(reportElement, "select");
}


function zenbuGBElement_autosave() {
  //callback function for this==ZenbuGenomeBrowser
  console.log("zenbuGBElement_autosave gb.uuid = "+this.uuid);
  this.modified = true;  //to allow retrigger of next autosave if needed
  
  //TODO: new logic (not interval) for resending autosave  
  //if one is still active and sending but not returned then don't send another right away
  if(this.saveConfigXHR) { return; } 

  zenbuGBElement_uploadAutosaveConfigXML(this.reportElement);
}


function zenbuGBElement_uploadAutosaveConfigXML(reportElement) {
  if(!reportElement) { return; }
  var glyphsGB = reportElement.glyphsGB;
  if(!glyphsGB) { return; }
  if(glyphsGB.saveConfigXHR) {
    //a save already in operation
    return;
  }

  var configDOM = document.implementation.createDocument("", "", null);  
  var config = gLyphsGB_configDOM(glyphsGB);
  glyphsGB.modified = false;  //reset the modified right after we make the configDOM
  var autosave = config.appendChild(configDOM.createElement("autoconfig"));
  autosave.setAttribute("value", "public");
  configDOM.appendChild(config);
  
  var serializer = new XMLSerializer();
  var configXML  = serializer.serializeToString(configDOM);

  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = configXML.indexOf("<eeDBgLyphsConfig>");
  if(idx1 > 0) { configXML = configXML.substr(idx1); }

  glyphsGB.configUUID = undefined; //clear old config object since it is not valid anymore

  //build the zenbu_query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode>\n";
  paramXML += "<autosave>true</autosave>\n";
  paramXML += "<configXML>" + configXML + "</configXML>";
  paramXML += "</zenbu_query>\n";

  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  glyphsGB.saveConfigXHR = configXHR;

  configXHR.open("POST",eedbConfigCGI, true); //async
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //configXHR.onreadystatechange= gLyphsUploadViewConfigXMLResponse;
  configXHR.onreadystatechange= function(id) { return function() { zenbuGBElement_autosaveUploadResponse(id); };}(reportElement.elementID);
  configXHR.send(paramXML);
}


function zenbuGBElement_autosaveUploadResponse(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  
  var glyphsGB = reportElement.glyphsGB;
  if(!glyphsGB) { return; }

  var configXHR = glyphsGB.saveConfigXHR;
  if(!configXHR) { return; }

  //might need to be careful here
  if(configXHR.readyState!=4) { return; }
  if(configXHR.responseXML == null) { return; }
  if(configXHR.status!=200) { return; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null) { return null; }

  // parse result back to get uuid and adjust view
  glyphsGB.configUUID = "";
  if(xmlDoc.getElementsByTagName("configuration")) {
    var configXML = xmlDoc.getElementsByTagName("configuration")[0];
    glyphsGB.view_config = eedbParseConfigurationData(configXML);
    if(glyphsGB.view_config) {
      glyphsGB.configUUID = glyphsGB.view_config.uuid;      
      glyphsGB.config_createdate = glyphsGB.view_config.create_date;
      glyphsGB.configname = glyphsGB.view_config.name;
      glyphsGB.desc = glyphsGB.view_config.description;
      if(glyphsGB.view_config.author) {
        glyphsGB.config_creator = glyphsGB.view_config.author;
      } else {
        glyphsGB.config_creator = glyphsGB.view_config.owner_openID;
      }
      if(glyphsGB.view_config.type != "AUTOSAVE") {
        glyphsGB.config_fixed_id = glyphsGB.view_config.fixed_id;
      }
      console.log("zenbuGBElement_autosaveUploadResponse got config back new uuid="+glyphsGB.configUUID);
      glyphsGB.reportElement.configUUID = glyphsGB.configUUID;
    }
  }
  
  glyphsGB.saveConfigXHR = undefined;
  if(glyphsGB.modified) { //do it again
    zenbuGBElement_uploadAutosaveConfigXML(glyphsGB.reportElement);
  }
  reportElementToggleSubpanel(elementID, 'refresh');
}


function zenbuGBElement_datasourceElement() {
  var datasourceElement = this;

  if(this.glyphsGB && this.glyphsGB.activeTrack()) {
    var activeTrack = this.glyphsGB.activeTrack();
    activeTrack.elementID = this.elementID;
    activeTrack.loading = false;
    //activeTrack.datasource_mode = "feature";
    //if(activeTrack.edge_array.length>0) { activeTrack.datasource_mode = "edge"; }
    //activeTrack.element_type = this.element_type;
    //activeTrack.element_type = "glyphsTrack";
    //console.log("zenbuGBElement_datasourceElement track : ", activeTrack);
    datasourceElement = activeTrack;
    this.datasource_element = activeTrack;
  }
  //console.log("zenbuGBElement_datasourceElement ", datasourceElement);
  return datasourceElement;
}

