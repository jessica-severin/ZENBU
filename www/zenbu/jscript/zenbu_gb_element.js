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
  this.view_config = "";
  this.chrom_location = "";
  this.location_padding = 0.1;

  this.show_titlebar = true;
  this.widget_search = false;
  this.widget_filter = false;
  
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
  
  if(elementDOM.getAttribute("view_config")) { this.view_config = elementDOM.getAttribute("view_config"); }
  if(elementDOM.getAttribute("chrom_location")) { this.chrom_location = elementDOM.getAttribute("chrom_location"); }
  if(elementDOM.getAttribute("location_padding")) { this.location_padding = parseFloat(elementDOM.getAttribute("location_padding")); }

  return true;
}


function zenbuGBElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  if(this.view_config) { elementDOM.setAttribute("view_config", this.view_config); }
  if(this.chrom_location) { elementDOM.setAttribute("chrom_location", this.chrom_location); }
  if(this.location_padding) { elementDOM.setAttribute("location_padding", this.location_padding); }
  
  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuGBElement_elementEvent(mode, value, value2) {
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  if(mode == "select_location") {
    this.selected_location = value;
    console.log("gbelement select_location "+value);
    reportsPostprocessElement(this.elementID);
    reportsDrawElement(this.elementID);
  }
}


function zenbuGBElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  if(param == "location_padding") {
    if(value<0) { value=0; }
    if(value>1) { value=1; }
    this.newconfig.location_padding = value;
  }

  if(param == "accept-reconfig") {
    //this.needReload=true;
    if(this.newconfig.location_padding !== undefined) { this.location_padding = this.newconfig.location_padding; }
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
}


function zenbuGBElement_load() {
  console.log("zenbuGBElement_load");
  //zenbuGBElement_reset(this);
  
  if(this.focus_feature) {
    this.title = this.title_prefix +" : " + this.focus_feature.name;
  }
  
  this.loading = true;
  reportsDrawElement(this.elementID); //clear or show loading
  
  //eventually this might do something after I get the zenbu_gb javascript native into zenbu-reports
  //but for now it's a stub
  //reportsPostprocessZenbuGB(this);
  this.postprocessElement();
  reportsDrawElement(this.elementID);
}


function zenbuGBElement_postprocess() {
  console.log("zenbuGBElement_postprocess");
  
  this.loading = false;
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  
  if(!this.view_config) { return; }
  //if(!this.focus_feature) { return; }
  
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 15;
  width = width - 10;
  
  //load an enbedded zenbu genome browser into the div
  /*
   this.view_config = "kzwDaVIQApzmnPDsong5J";
   this.chrom_location = "";
   this.zenbu_url = "http://zenbu.gsc.riken.jp/zenbudev/gLyphs";
   this.selected_id = "";
   this.selected_feature = null;
   */
  
  //<object type="text/html" data="http://zenbu.gsc.riken.jp/zenbudev/gLyphs/index_embed3.html#config=kzwDaVIQApzmnPDsong5J;loc=hg38::chrX:102740106..102914471+;dwidth=1000" style="width:100%; height:500px">
  //var zenbu_obj = document.createElement('embed');
  var zenbu_obj = document.createElement('object');
  //var zenbu_obj = document.createElement('iframe');
  zenbu_obj.type = "text/html";
  style = "width:100%; ";
  //if(this.content_width) { style += "width:"+(this.content_width)+"px; "; }
  style += "height: "+(height - 30)+"px; ";
  zenbu_obj.setAttribute('style', style);
  zenbu_obj.innerHTML = "loading....";
  
  var url = "../gLyphs/index_embed3.html#config=" + this.view_config;
  url += ";dwidth=" + (width-45);
  var chromloc = "";
  if(this.focus_feature && this.focus_feature.chrom) {
    var chromlen = this.focus_feature.end - this.focus_feature.start + 1;
    var padding = parseInt(this.location_padding * chromlen);
    console.log("feature len "+chromlen + " padding "+padding);
    //url += ";loc=" + this.focus_feature.chrom+ ":" + (this.focus_feature.start - padding) + ".."+ (this.focus_feature.end + padding);
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
  if(chromloc) { url += ";loc=" + chromloc; }
  zenbu_obj.data = url;
  //zenbu_obj.src = url;
  console.log("zenbuGBElement_postprocess " + url);
  //if(!chromloc) { zenbu_obj.innerHTML = "no location available"; }

  if(chromloc != this.chrom_location) {
    console.log("zenbuGBElement_postprocess: location changed to : "+chromloc);
    this.zenbu_view_obj = zenbu_obj;
  }
  if(this.current_gb_width != (width-45)) {
    console.log("zenbuGBElement_postprocess: width changed to : "+(width-45));
    this.zenbu_view_obj = zenbu_obj;
  }
  if(!this.zenbu_view_obj) { 
    console.log("zenbuGBElement_postprocess: no view_obj so set");
    this.zenbu_view_obj = zenbu_obj; 
  }

  this.chrom_location = chromloc;
  this.current_gb_width = (width-45);
}  



function zenbuGBElement_draw() {
  console.log("zenbuGBElement_draw");
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  
  if(!this.view_config) { return; }
  //if(!this.focus_feature) { return; }
  
  if(current_report.current_dragging_element) {
    console.log("zenbuGBElement_draw dragging so remove view_obj");
    if(this.zenbu_view_obj) { main_div.removeChild(this.zenbu_view_obj); }
    var span1 = main_div.appendChild(document.createElement('span'));
    span1.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    span1.innerHTML = "dragging...";
    return;
  }
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 15;
  width = width - 10;

  //resize to pagesize logic
  if(this.resized) {
    console.log("ZenbuGB was resized!!! to width " +this.content_width);
    //reportsPostprocessZenbuGB(this);
    this.postprocessElement();
  }
  if(!this.zenbu_view_obj) {
    console.log("zenbuGBElement_draw: no view_obj so generate");
    this.postprocessElement();
  }
  
  //load an enbedded zenbu genome browser into the div
  /*
   this.view_config = "kzwDaVIQApzmnPDsong5J";
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
   
   var url = this.zenbu_url + "/index_embed3.html#config=" + this.view_config;
   //var url = "../gLyphs/index_embed3.html#config=" + this.view_config;
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
  
  if(this.zenbu_view_obj) {
    main_div.appendChild(this.zenbu_view_obj);
  } else {
    var span1 = main_div.appendChild(document.createElement('span'));
    span1.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    span1.innerHTML = "no location available";
  }
}


function zenbuGBElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  
  configdiv.appendChild(document.createElement('hr'));
  
  //----------
  var view_config = this.view_config;
  if(this.newconfig && this.newconfig.view_config != undefined) { view_config = this.newconfig.view_config; }
  var div1 = configdiv.appendChild(document.createElement('div'));
  var span0 = div1.appendChild(document.createElement('span'));
  span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "view config:";
  var titleInput = div1.appendChild(document.createElement('input'));
  titleInput.setAttribute('style', "width:240px; margin: 1px 1px 1px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', view_config);
  titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'zenbu_view_config', this.value);");
  titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'zenbu_view_config', this.value);");
  titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");

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
}

//=================================================================================
//
// helper functions
//
//=================================================================================

