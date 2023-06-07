/* $Id: zenbu_genomewide_element.js,v 1.29 2023/04/28 06:31:44 severin Exp $ */

// ZENBU
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


//var element = new ZenbuGenomeWideElement();

function ZenbuGenomeWideElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuGenomeWideElement");
  this.element_type = "genomewide";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  //zenbuElement_init.call(this); //eventually when I refactor the superclass Element into object code

  this.title_prefix = "";
  this.datasource_mode = "feature";
  this.title = "new GenomeWide";

  this.assembly_name= "";
  this.assembly= null;
  this.colorspace = "Dark2_bp_7";
  this.show_only_chroms_with_data = false;
  this.show_mini_chroms = false; //ensures that all chroms get at least 0.5deg of the circle
  this.focus_chrom_percent = 33;
  this.chrom_track_height = 20;
  this.visible_chrom_count=0;
  this.expand_height_tofit = false;
  this.display_type = "chromosome view";
  this.edge_location_mode = "both features";
  this.feature_color_mode = "match_chrom";
  this.fixed_color = "#0000A0";
  this.signal_colorspace = "fire1";
  this.signal_logscale = false;
  this.signal_min = 0;
  this.signal_max = "auto";
  this.signal_datatype = "slotcount";
  this.hide_filtered_slots = false;
  this.yaxis_logscale = false;

  this.focus_chrom_name = "";
  
  this.content_width = 500;
  this.content_height = 300;

  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;

  var dtype = reportElementAddDatatypeColumn(this, "slotcount", "chrom seg count", false);
  dtype.col_type = "signal";
  
  //methods
  this.initFromConfigDOM  = zenbuGenomeWideElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuGenomeWideElement_generateConfigDOM;  //returns a ConfigDOM object

  this.elementEvent       = zenbuGenomeWideElement_elementEvent;
  this.reconfigureParam   = zenbuGenomeWideElement_reconfigureParam;

  this.resetElement       = zenbuGenomeWideElement_reset;
  this.loadElement        = zenbuGenomeWideElement_load;
  this.postprocessElement = zenbuGenomeWideElement_postprocess;
  this.drawElement        = zenbuGenomeWideElement_draw;
  this.configSubpanel     = zenbuGenomeWideElement_configSubpanel;

  //internal methods
  this.fetchAssembly      = zenbuGenomeWideElement_fetch_assembly;
  this.drawChromView      = zenbuGenomeWideElement_drawChromosomeView;
  this.drawManhattan      = zenbuGenomeWideElement_drawManhattanPlot;

  this.renderChromView             = zenbuGenomeWideElement_renderChromView;
  this.renderManhattanViewFeatures = zenbuGenomeWideElement_renderManhattanViewFeatures;
  this.renderManhattanViewEdges    = zenbuGenomeWideElement_renderManhattanViewEdges;
  
  return this;
}


//=================================================================================

function zenbuGenomeWideElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "genomewide") { return false; }
    
  if(elementDOM.getAttribute("display_type")) {  this.display_type = elementDOM.getAttribute("display_type"); }
  if(elementDOM.getAttribute("assembly_name")) {  this.assembly_name = elementDOM.getAttribute("assembly_name"); }
  if(elementDOM.getAttribute("colorspace")) {  this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("feature_color_mode")) {  this.feature_color_mode = elementDOM.getAttribute("feature_color_mode"); }
  if(elementDOM.getAttribute("fixed_color")) {  this.fixed_color = elementDOM.getAttribute("fixed_color"); }
  if(elementDOM.getAttribute("focus_chrom_percent")) {  this.focus_chrom_percent = parseFloat(elementDOM.getAttribute("focus_chrom_percent")); }
  if(elementDOM.getAttribute("show_only_chroms_with_data") == "true") { this.show_only_chroms_with_data = true; }
  if(elementDOM.getAttribute("show_mini_chroms") == "true") { this.show_mini_chroms = true; }
  if(elementDOM.getAttribute("expand_height_tofit") == "true") { this.expand_height_tofit = true; }
  if(elementDOM.getAttribute("hide_filtered_slots") == "true") { this.hide_filtered_slots = true; }
  if(elementDOM.getAttribute("signal_datatype")) { this.signal_datatype = elementDOM.getAttribute("signal_datatype"); }
  if(elementDOM.getAttribute("yaxis_logscale") == "true") { this.yaxis_logscale = true; }
  if(elementDOM.getAttribute("edge_location_mode")) {  this.edge_location_mode = elementDOM.getAttribute("edge_location_mode"); }

  return true;
}


function zenbuGenomeWideElement_generateConfigDOM() {
  console.log("zenbuGenomeWideElement_generateConfigDOM");
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.display_type) { elementDOM.setAttribute("display_type", this.display_type); }
  if(this.assembly_name) { elementDOM.setAttribute("assembly_name", this.assembly_name); }
  if(this.colorspace) { elementDOM.setAttribute("colorspace", this.colorspace); }
  if(this.feature_color_mode) { elementDOM.setAttribute("feature_color_mode", this.feature_color_mode); }
  if(this.fixed_color) { elementDOM.setAttribute("fixed_color", this.fixed_color); }
  if(this.focus_chrom_percent) { elementDOM.setAttribute("focus_chrom_percent", this.focus_chrom_percent); }
  if(this.show_only_chroms_with_data) { elementDOM.setAttribute("show_only_chroms_with_data", "true"); }
  if(this.show_mini_chroms) { elementDOM.setAttribute("show_mini_chroms", "true"); }
  if(this.expand_height_tofit) { elementDOM.setAttribute("expand_height_tofit", "true"); }
  if(this.hide_filtered_slots) { elementDOM.setAttribute("hide_filtered_slots", "true"); }  
  if(this.signal_datatype) { elementDOM.setAttribute("signal_datatype", this.signal_datatype); }
  if(this.yaxis_logscale) { elementDOM.setAttribute("yaxis_logscale", "true"); }
  if(this.edge_location_mode) { elementDOM.setAttribute("edge_location_mode", this.edge_location_mode); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================

function zenbuGenomeWideElement_elementEvent(mode, value, value2) {
  var datasourceElement = this.datasource();
  
  if(mode == "select_slot") {  
    if(this.chromview_slots) {
      for(var sidx=0; sidx<this.chromview_slots.length; sidx++) {
        var slot = this.chromview_slots[sidx];
        if(!slot) { continue; }
        if(slot.selected) { slot.svg_line.setAttributeNS(null, 'stroke', slot.color); }
        slot.selected=false;
      }
      var slot = this.chromview_slots[value];
      if(slot) {
        console.log("found selection slot: "+slot.chrom.chrom_name+" "+slot.start+" "+slot.end);
        slot.selected=true; 
        //slot.svg_line.stroke = "pink";
        slot.svg_line.setAttributeNS(null, 'stroke', "red");
        
        var start = end = -1;
        for(var fidx=0; fidx<slot.features.length; fidx++) {
          var feature = slot.features[fidx];
          if(!feature) { continue; }
          if(!feature.filter_valid) { continue; }
          if(datasourceElement.search_data_filter && !feature.search_match) { continue; }
          if(start == -1) { start = feature.start; end = feature.end; }
          if(feature.start < start) { start = feature.start; }
          if(feature.end > end) { end = feature.end; }
        }
        //var chromloc = slot.chrom.chrom_name+":"+slot.start+".."+slot.end;
        var chromloc = slot.chrom.chrom_name+":"+start+".."+end;
        //this.selected_location = chromloc;
        reportElementUserEvent(this, 'select_location', chromloc);
      }
    }
  }
  if(mode == "chrom-info") {  
    if(this.assembly && this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[value];
      if(chrom) {
        //console.log("show feature: " + value);
        zenbuDisplayFeatureInfo(chrom); 
      }
    }
  }
  
  if(mode == "focus_chrom_name") {
    console.log("zenbuGenomeWideElement_elementEvent -- focus_chrom_name");
    if(this.focus_chrom_name == value) { //same name, toggle off
      this.focus_chrom_name = "";
    } else {
      this.focus_chrom_name = value;
    }
    //reportsPostprocessElement(elementID);
  }
  
  if(mode=="select") {
    //var t1 = performance.now();
    console.log("zenbuGenomeWideElement_elementEvent select");
    if(this.selected_point_feature) {
      //clear previous point selection
      var point = this.selected_point_feature.manhattan_point;
      point.setAttributeNS(null, 'r', "2");
      point.setAttributeNS(null, 'fill', this.selected_point_feature.manhattan_color);
      this.selected_point_feature = null;
    }
    if(datasourceElement.selected_feature) {
      console.log("zenbuGenomeWideElement_elementEvent select_feature : "+datasourceElement.selected_feature.id);
      var point = datasourceElement.selected_feature.manhattan_point;
      if(point) {
        point.setAttributeNS(null, 'r', "7");
        point.setAttributeNS(null, 'fill', "rgba(255,0,225,0.5)");
        this.selected_point_feature = datasourceElement.selected_feature;
        if(this.manhattan_render) {
          this.manhattan_render.appendChild(point); //moves to the end of render list
        }
      }
    }
    
    if(this.selected_point_edge) {
      //clear previous point selection
      var point1 = this.selected_point_edge.manhattan_point1;
      var point2 = this.selected_point_edge.manhattan_point2;
      if(point1) {
        point1.setAttributeNS(null, 'r', "2");
        point1.setAttributeNS(null, 'fill', this.selected_point_edge.manhattan_color1);
      }
      if(point2) {
        point2.setAttributeNS(null, 'r', "2");
        point2.setAttributeNS(null, 'fill', this.selected_point_edge.manhattan_color2);
      }
      this.selected_point_edge = null;
    }

    if(datasourceElement.selected_edge) {
      console.log("zenbuGenomeWideElement_elementEvent select_edge : "+datasourceElement.selected_edge.id);
      for(eidx=0; eidx<this.edge_array.length; eidx++) {
        var edge = this.edge_array[eidx];
        if(!edge) { continue; }

        if(datasourceElement.selected_edge.id == edge.id) {
          //console.log("zenbuGenomeWideElement_elementEvent select_edge FOUND edge points, color PINK");
          var point1 = edge.manhattan_point1;
          var point2 = edge.manhattan_point2;
          if(point1) {
            point1.setAttributeNS(null, 'r', "7");
            point1.setAttributeNS(null, 'fill', "rgba(255,0,225,0.7)");
            if(this.manhattan_render) { this.manhattan_render.appendChild(point1); } //moves to the end of render list
          }
          if(point2) {
            point2.setAttributeNS(null, 'r', "7");
            point2.setAttributeNS(null, 'fill', "rgba(255,0,225,0.7)");
            if(this.manhattan_render) { this.manhattan_render.appendChild(point2); } //moves to the end of render list
          }
          this.selected_point_edge = edge;
        } //if edge.id match
      } //for edge loop
    }
    //var t2 = performance.now();
    //console.log("zenbuGenomeWideElement_elementEvent select " + (t2 - t1) + " msec");
  }
}


function zenbuGenomeWideElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  if(param == "assembly_name") { this.newconfig.assembly_name = value; }
  if(param == "show_only_chroms_with_data") { this.newconfig.show_only_chroms_with_data = value; }
  if(param == "show_mini_chroms") { this.newconfig.show_mini_chroms = value; }
  if(param == "expand_height_tofit") { this.newconfig.expand_height_tofit = value; }
  if(param == "hide_filtered_slots") { this.newconfig.hide_filtered_slots = value; }
  if(param == "edge_location_mode") { this.newconfig.edge_location_mode = value; }
  if(param == "feature_color_mode") { this.newconfig.feature_color_mode = value; }
  if(param == "fixed_color") {
    if(!value) { value = "#0000A0"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    this.newconfig.fixed_color = value;
  }
  if(param == "signal_datatype") { this.newconfig.signal_datatype = value; }
  if(param == "yaxis_logscale") { this.newconfig.yaxis_logscale = value; }
  
  if(param == "focus_chrom_percent") {
    if(value<1) { value = value * 100; }
    if(value<5) { value=5; }
    if(value>90) { value=90; }
    this.newconfig.focus_chrom_percent = value; 
  } 
  
  if(param == "cancel-reconfig") {
    if(this.signalCSI) {
      this.signalCSI.newconfig = new Object(); //clear
    }
  }
  if(param == "accept-reconfig") {
    if(this.newconfig.assembly_name !== undefined) { 
      this.assembly_name = this.newconfig.assembly_name; 
      this.newconfig.needReload=true; 
    }
    if(this.newconfig.show_only_chroms_with_data !== undefined) { 
      this.show_only_chroms_with_data = this.newconfig.show_only_chroms_with_data; 
      //this.newconfig.needReload=true; 
    }
    if(this.newconfig.show_mini_chroms !== undefined) { this.show_mini_chroms = this.newconfig.show_mini_chroms; }
    if(this.newconfig.expand_height_tofit !== undefined) { this.expand_height_tofit = this.newconfig.expand_height_tofit; }
    if(this.newconfig.hide_filtered_slots !== undefined) { this.hide_filtered_slots = this.newconfig.hide_filtered_slots; }
    if(this.newconfig.edge_location_mode !== undefined) { this.edge_location_mode = this.newconfig.edge_location_mode; }
    if(this.newconfig.feature_color_mode !== undefined) { this.feature_color_mode = this.newconfig.feature_color_mode; }
    if(this.newconfig.fixed_color !== undefined) { this.fixed_color = this.newconfig.fixed_color; }
    if(this.newconfig.focus_chrom_percent !== undefined) { this.focus_chrom_percent = this.newconfig.focus_chrom_percent; }
    if(this.newconfig.signal_datatype !== undefined) { this.signal_datatype = this.newconfig.signal_datatype; }
    if(this.newconfig.yaxis_logscale !== undefined) { this.yaxis_logscale = this.newconfig.yaxis_logscale; }
    if(this.signalCSI) {
      if(this.signalCSI.newconfig.colorspace != undefined) { this.signal_colorspace = this.signalCSI.newconfig.colorspace; }
      if(this.signalCSI.newconfig.min_signal != undefined) { this.signal_min = this.signalCSI.newconfig.min_signal; }
      if(this.signalCSI.newconfig.max_signal != undefined) { this.signal_max = this.signalCSI.newconfig.max_signal; }
      if(this.signalCSI.newconfig.logscale != undefined)   { this.signal_logscale = this.signalCSI.newconfig.logscale; }
      this.signalCSI = null; //clear
    }
  }
}


//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuGenomeWideElement_reset() {
  console.log("zenbuGenomeWideElement_reset ["+this.elementID+"]");
  this.chromview_render=null;
  this.manhattan_render=null;
  this.features_are_sorted = false;

  //clear previous loaded data
  //this.features = new Object();
  //this.feature_array = new Array();
  //this.edge_array = new Array();
  //this.edge_count = 0;
  
  //clear previous target
  //this.selected_id = ""; //selected row in the table
  //this.selected_feature = null; //selected row in the table
}


function zenbuGenomeWideElement_load() {
  console.log("zenbuGenomeWideElement_load");
  this.fetchAssembly();
  this.features_are_sorted = false;
}


function zenbuGenomeWideElement_postprocess() {
  console.log("zenbuGenomeWideElement_postprocess: " + this.elementID);
  var starttime = new Date();
  this.title = this.title_prefix;
  
  this.fetchAssembly();  //fetch if needed

  var datasourceElement = this.datasource();

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  console.log("zenbuGenomeWideElement_postprocess: " + feature_count+ " features, " + edge_count+" edges, "+datasourceElement.filter_count+" filtered");

  this.title = this.title_prefix;
  if(datasourceElement.focus_feature) {
    if(!this.selected_feature) { this.selected_feature = datasourceElement.focus_feature; }
    console.log("zenbuGenomeWideElement_postprocess start focus["+datasourceElement.focus_feature.name+"]");
    if(this.title) { this.title += " "+ datasourceElement.focus_feature.name; }
  }
  
  this.fetchAssembly();  //fetch if needed
  if(this.assembly && this.assembly.chroms_hash) {
    for(var chrom_name in this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[chrom_name];
      if(!chrom) { continue; }
      chrom.has_features = false;
    }
  }

  //add a special datatype for chrom-slot-count-density
  var slotcount_dtype = reportElementAddDatatypeColumn(datasourceElement, "slotcount", "chrom seg count", false);
  slotcount_dtype.col_type = "signal";
  slotcount_dtype.min_val = 0; //reset min/max
  slotcount_dtype.max_val = 0;

  var region_ranges = {}; //track max start-end for each chrom to set a best span for all data
  
  if(!datasourceElement.dtype_filter_select) { datasourceElement.dtype_filter_select = "slotcount"; }

  if(datasourceElement.datasource_mode == "feature") {
  //if(datasourceElement.feature_array.length>0) {
    this.filter_count=0;
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }
      if(datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

      this.filter_count++;      
      if(this.assembly && this.assembly.chroms_hash) {
        var chrom = this.assembly.chroms_hash[feature.chrom];
        if(chrom) { 
          chrom.has_features = true;
          feature.chrom_name_index = chrom.name_index;
        }
      }
    }
    if(this != datasourceElement) {
      //copy feature_array into this (shares feature objects, but array and sort and be different)
      var t0 = performance.now();
      this.feature_array = new Array(); 
      for(j=0; j<datasourceElement.feature_array.length; j++) {
        var feature = datasourceElement.feature_array[j];
        if(feature) { this.feature_array.push(feature); }
      }
      var t1 = performance.now();
      console.log("copy feature_array from datasourceElement to this " + (t1 - t0) + " msec.");
    }
    
    for(j=0; j<this.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!region_ranges[feature.chrom]) { region_ranges[feature.chrom] = {start: feature.start, end:feature.end}; }
      else {
        if(feature.start < region_ranges[feature.chrom].start) { region_ranges[feature.chrom].start = feature.start; }
        if(feature.end   > region_ranges[feature.chrom].end)   { region_ranges[feature.chrom].end   = feature.end; }
      }
    }
  }

  if(datasourceElement.datasource_mode == "edge") {
    console.log("zenbuGenomeWideElement_postprocess [" + this.elementID+"] edges");
    this.filter_count=0;
    //datasourceElement.edge_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(!edge.feature1 || !edge.feature2) { continue; }
      if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

      this.filter_count++;
      
      //set a chrom,start,end for the edge to make plotting easier. if cross-chrom then feature1 is used
      edge.chrom = null;
      edge.start = 0;
      edge.end = 0;
      if(this.assembly && this.assembly.chroms_hash) {
        var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
        var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];
        if(chrom1 && (this.edge_location_mode=="both features" || this.edge_location_mode=="left feature")) {
          chrom1.has_features = true; 
          edge.feature1.chrom_name_index = chrom1.name_index;
          edge.chrom = edge.feature1.chrom;
          edge.start = edge.feature1.start;
          edge.end   = edge.feature1.end
        }
        if(chrom2 && (this.edge_location_mode=="both features" || this.edge_location_mode=="right feature")) {
          chrom2.has_features = true; 
          edge.feature2.chrom_name_index = chrom2.name_index;
          if(!edge.chrom) {
            edge.chrom = edge.feature2.chrom;
            edge.start = edge.feature2.start;
            edge.end   = edge.feature2.end
          }
          if(edge.feature1.chrom == edge.feature2.chrom) {
            if(edge.feature2.start < edge.start) { edge.start = edge.feature2.start; }
            if(edge.feature2.end > edge.end) { edge.end = edge.feature2.end; }
          }
        }
      }
      
      if(this.edge_location_mode=="both features" || this.edge_location_mode=="left feature") {
        var feat1 = edge.feature1;
        if(!region_ranges[feat1.chrom]) { region_ranges[feat1.chrom] = {start: feat1.start, end:feat1.end}; }
        else {
          if(feat1.start < region_ranges[feat1.chrom].start) { region_ranges[feat1.chrom].start = feat1.start;  }
          if(feat1.end   > region_ranges[feat1.chrom].end)   { region_ranges[feat1.chrom].end   = feat1.end; }
        }
      }
      if(this.edge_location_mode=="both features" || this.edge_location_mode=="right feature") {
        var feat2 = edge.feature2;
        if(!region_ranges[feat2.chrom]) { region_ranges[feat2.chrom] = {start: feat2.start, end:feat2.end}; }
        else {
          if(feat2.start < region_ranges[feat2.chrom].start) { region_ranges[feat2.chrom].start = feat2.start;  }
          if(feat2.end   > region_ranges[feat2.chrom].end)   { region_ranges[feat2.chrom].end   = feat2.end; }
        }
      }
    }
  }

  //find best range for setting global selected_location
  var max_length = 0;
  var max_chrom = "";
  for(var chrom_name in region_ranges) {
    var range = region_ranges[chrom_name];
    //console.log("postprocess["+this.elementID+"] range: "+chrom_name+" "+range.start+".."+range.end);
    var len = range.end - range.start +1;
    if(len > max_length) { max_length = len; max_chrom = chrom_name; }
  }
  if(max_length>0) {
    var range = region_ranges[max_chrom];
    this.selected_location = max_chrom+":"+range.start+".."+range.end;
    datasourceElement.selected_location = this.selected_location;
    //console.log("postprocess["+this.elementID+"] MAX range, selected_location set: "+this.selected_location);
  }

  //last process the chromosomes to determine which are visible
  this.visible_chrom_count=0;
  this.visible_chrom_length = 0;
  this.max_chrom = null;
  this.chroms_array = new Array();
  if(this.assembly && this.assembly.chroms_hash) {
    for(var chrom_name in this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[chrom_name];
      if(!chrom) { continue; }
      chrom.visible = false;
      if(!chrom.chrom_length || chrom.chrom_length<=0) { continue; }
      if(this.show_only_chroms_with_data && !chrom.has_features) { continue; }
      this.visible_chrom_length += chrom.chrom_length;
      chrom.visible = true;
      this.visible_chrom_count++;
    }
    console.log("zenbuGenomeWideElement_postprocess pre-scan chroms["+this.visible_chrom_count+"] total_length["+this.visible_chrom_length+"]");
    var new_total_length=0;
    for(var chrom_name in this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[chrom_name];
      if(!chrom) { continue; }
      if(!chrom.visible) { continue; }
      if(!this.show_mini_chroms && (chrom.chrom_length / this.visible_chrom_length < 0.005)) { 
        chrom.visible=false; 
        //console.log("skip small chrom ["+chrom_name+"] length:"+chrom.chrom_length);
        continue;
      }
      new_total_length += chrom.chrom_length;
      if(!this.max_chrom) { this.max_chrom = chrom; }
      if(chrom.chrom_length > this.max_chrom.chrom_length) { this.max_chrom = chrom; }
      this.chroms_array.push(chrom);
    }
    this.visible_chrom_length = new_total_length;
    this.visible_chrom_count = this.chroms_array.length
    console.log("zenbuGenomeWideElement_postprocess chroms["+this.visible_chrom_count+"] total_length:"+this.visible_chrom_length);
    if(this.max_chrom) {
      console.log("zenbuGenomeWideElement_postprocess max chrom["+this.max_chrom.chrom_name+"] length:"+this.max_chrom.chrom_length);
    }
  }
  this.chroms_array.sort(reports_genomewide_chrom_sort_func);
  
  console.log("zenbuGenomeWideElement_postprocess: " + (this.feature_array.length)+ " features, " + edge_count+" edges, "+this.filter_count+" filtered");
  
  if(!this.features_are_sorted) {
    var t0 = performance.now();
    this.feature_array.sort(reports_genomewide_featureloc_sort_func);
    var t1 = performance.now();
    console.log("sort this.feature_array " + (t1 - t0) + " msec.");
    this.features_are_sorted = true;
  }

  //make sure the columns are sorted for the hover-info
  this.dtype_columns.sort(reports_column_order_sort_func);
  
  //clear the render caches
  this.chromview_render = null;
  this.manhattan_render = null;

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("zenbuGenomeWideElement_postprocess " +(runtime)+"msec");
}


//=================================================================================
// fetch assembly

function zenbuGenomeWideElement_fetch_assembly() {
  if(!this.assembly_name) { return; }
  if(this.assembly) {
    //console.log("zenbuGenomeWideElement_fetch_assembly :: assembly loaded ["+this.assembly.assembly_name+"]");
    if(this.assembly.assembly_name == this.assembly_name) {
      //console.log("zenbuGenomeWideElement_fetch_assembly :: assembly matches assembly_name");
      return; 
    }
  }
  console.log("zenbuGenomeWideElement_fetch_assembly :: fetch ["+this.assembly_name+"]");
  
  var url = eedbSearchCGI + "?mode=genome&asm="+this.assembly_name;
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
    console.log("zenbuGenomeWideElement_fetch_assembly :: Problem with responseXML no xmlDoc");
    return;
  }

  var xmlAssemblies = xmlDoc.getElementsByTagName("assembly");
  for(i=0; i<xmlAssemblies.length; i++) {
    var assembly = eedbParseAssemblyData(xmlAssemblies[i]);
    if((assembly.assembly_name == this.assembly_name) || 
       (assembly.ucsc_name == this.assembly_name) || 
       (assembly.ncbi_name == this.assembly_name) || 
       (assembly.ncbi_acc == this.assembly_name)) { this.assembly = assembly; break; }
  }
  if(!this.assembly) { return; }
  //console.log("zenbuGenomeWideElement_fetch_assembly found ["+this.assembly.assembly_name+"] "+this.assembly.description);

  assembly.chroms_hash = new Object();
 
  var xmlChroms = xmlDoc.getElementsByTagName("chrom");
  for(i=0; i<xmlChroms.length; i++) {
    var chrom = eedbParseChromData(xmlChroms[i]);
    if(!chrom) { continue; }
    
    chrom.name_index = null;
    if(chrom.chrom_name.indexOf("chr")==0) { chrom.name_index = chrom.chrom_name.substr(3); }
    if(chrom.name_index && !isNaN(chrom.name_index)) { chrom.name_index = Math.abs(chrom.name_index); }
    
    if(chrom.assembly_name == this.assembly.assembly_name) {
      chrom.assembly = this.assembly;
      this.assembly.chroms_hash[chrom.chrom_name] = chrom;
    } else {
      console.log(chrom.description+" => don't match assembly");
    }
  }
  
  this.total_genome_length = 0;
  for(var chrom_name in this.assembly.chroms_hash) {
    var chrom = this.assembly.chroms_hash[chrom_name];
    if(!chrom) { continue; }
    this.total_genome_length += chrom.chrom_length;
  }  
}

//=================================================================================
//
// draw
//
//=================================================================================


function zenbuGenomeWideElement_draw() {
  if(this.loading) { return; }
  console.log("zenbuGenomeWideElement_draw ["+this.elementID+"]");
  var main_div = this.main_div;
  if(!main_div) { return; }

  if(this.display_type=="chromosome view") { this.drawChromView(); }
  if(this.display_type=="manhattan plot")  { this.drawManhattan(); }
}


//=================================================================================
//
// chromosome view section
//
//=================================================================================

function zenbuGenomeWideElement_drawChromosomeView() {
  if(this.loading) { return; }
  console.log("zenbuGenomeWideElement_drawChromosomeView ["+this.elementID+"]");
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this.datasource();

  if(this.resized) { //clear render caches so it rebuilds
    this.chromview_render = null; 
  }
  
  var t0 = performance.now();
  
  //if(this.filter_count == 0) { //use the query feature
  //  var load_info = main_div.appendChild(document.createElement('div'));
  //  load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
  //  load_info.innerHTML = "no data...";
  //  return;
  //}
    
  var div1 = main_div.appendChild(document.createElement('div'));
  //div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");

  var height = this.content_height - 30;
  var width  = this.content_width;
  
  var vis_height = this.visible_chrom_count * this.chrom_track_height + 5;
  if(vis_height > height) { 
    if(this.expand_height_tofit) {
      console.log("zenbuGenomeWideElement_drawChromosomeView content_height:"+height+" vis_height:"+vis_height);
      reportElementReconfigParam(this.elementID, 'content_height', vis_height+30);
      //reportElementReconfigParam(this.elementID, 'refresh');
      return;
    } else {
      //div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");
      div1.setAttribute("style", "overflow-y:scroll; width:100%; height:"+height+"px;");
      height = vis_height;
      width = width - 25;
    }
  }
  console.log("zenbuGenomeWideElement_drawChromosomeView width["+width+"] height["+height+"]");
  
  var svg = div1.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', vis_height+'px');
  
  if(!this.chroms_array) { return; }
  
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  //g1.setAttributeNS(svgNS, 'transform', "translate(0,30)");
  svg.appendChild(g1);
    
  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  var max_name_width = 0;
  for(var idx=0; idx<this.chroms_array.length; idx++) {
    var chrom = this.chroms_array[idx];
    if(!chrom) { continue; }
    if(!chrom.visible) { continue; }
    
    //make background box
    /*
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((idx*this.chrom_track_height)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', this.chrom_track_height+ 'px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    //back_rect.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
    //back_rect.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //back_rect.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
    chrom.back_rect = back_rect;
    g2.appendChild(back_rect);
    */
    
    var name = chrom.chrom_name;
    if(name == undefined) { name = ".."; }
    
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '5px');
    text.setAttributeNS(null, 'y', ((idx*this.chrom_track_height)+11) +'px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    //text.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
    //text.setAttribute("onmouseover", "reportElementEvent(\""+this.elementID+"\", 'chrom-info', '"+chrom.chrom_name+"'); return false; ");
    //text.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //text.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
    text.appendChild(document.createTextNode(name));
    g2.appendChild(text);
    
    var bbox = text.getBBox();
    if(bbox.width > max_name_width) { max_name_width = bbox.width; }
  }
  console.log("max chrom name width: "+max_name_width);
  this.max_name_width = max_name_width;
  this.render_width = width;
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var idx1=0; idx1<this.chroms_array.length; idx1++) {
    var chrom = this.chroms_array[idx1];
    if(!chrom) { continue; }
    if(!chrom.visible) { continue; }
    chrom.draw_idx = idx1;
          
    var color = zenbuIndexColorSpace(this.colorspace, idx1);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11
    
    var chrom_width = width - 15 - max_name_width;
    if(this.max_chrom) {
      var scale = chrom.chrom_length / this.max_chrom.chrom_length;
      chrom_width = chrom_width * scale;
    }
    //console.log("chrom "+chrom.chrom_name+" width:"+chrom_width);
    
    var rect = document.createElementNS(svgNS,'rect');
    rect.setAttributeNS(null, 'x', (max_name_width+10)+'px');
    rect.setAttributeNS(null, 'y', (idx1*this.chrom_track_height+2) +'px');
    rect.setAttributeNS(null, 'rx', (this.chrom_track_height/3)+'px');
    rect.setAttributeNS(null, 'ry', (this.chrom_track_height/3)+'px');
    rect.setAttributeNS(null, 'width', chrom_width+'px');
    rect.setAttributeNS(null, 'height', (this.chrom_track_height-4) +'px');
    //if((sig_error < 0.01) || (sig_error >0.99)) rect.setAttributeNS(null, 'fill', "rgb(123, 123, 240)");
    //else rect.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
    //if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
    //else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
    rect.setAttributeNS(null, 'stroke', color.getCSSHexadecimalRGB());
    rect.setAttributeNS(null, 'stroke-width', 2);
    rect.setAttributeNS(null, 'fill', "white");
    g3.appendChild(rect);
  }
  
  t1 = performance.now();
  console.log("after draw chroms " + (t1 - t0) + " msec.");

  //if(!this.chromview_render) { this.renderChromView(); }
  this.renderChromView();
  if(this.chromview_render) { g1.appendChild(this.chromview_render); }

  //var g4 = g1.appendChild(document.createElementNS(svgNS,'g'));

}


function zenbuGenomeWideElement_renderChromView() {
  if(this.chromview_render) { return; }
  if(this.filter_count==0) { return; }

  console.log("zenbuGenomeWideElement_renderChromView start");
  var t0 = performance.now();
  
  var datasourceElement = this.datasource();
  
  //
  // render the features onto genomic-map
  //
  //datasourceElement.feature_array.sort(reports_genomewide_featureloc_sort_func);
  //var t1 = performance.now();
  //console.log("after sort features" + (t1 - t0) + " msec.");

  //make sure the columns are sorted for the hover-info
  //this.dtype_columns.sort(reports_column_order_sort_func);
  //var t1 = performance.now();
  //console.log("after sort columns" + (t1 - t0) + " msec.");
  this.chromview_slots = new Array();

  var slotcount_dtype = reportElementAddDatatypeColumn(datasourceElement, "slotcount", "chrom seg count", false);
  slotcount_dtype.col_type = "signal";
  slotcount_dtype.min_val = 0; //reset min/max
  slotcount_dtype.max_val = 0;

  console.log("building slot.signal with datatype:"+this.signal_datatype);
  var signal_dtype = null;
  if(this.signal_datatype!="slotcount") {  
    //need a temporary dtype obj for managing sum/min/max for merging signal into slots
    signal_dtype = new Object();
    signal_dtype.datatype = "slotsignal_"+this.signal_datatype;
    signal_dtype.title = "slot "+this.signal_datatype;
    signal_dtype.col_type = "signal";
    signal_dtype.visible = false;
    signal_dtype.min_val = 0; //reset min/max
    signal_dtype.max_val = 0;
    //var signal_dtype = datasourceElement.datatypes[this.signal_datatype];
    if(signal_dtype) { console.log("created signal_dtype : "+ signal_dtype.datatype); }
  }
  
  //preloop to fill array with features or edges by datasource
  var object_array = [];  
  if(datasourceElement.datasource_mode == "feature") {
    for(j=0; j<this.feature_array.length; j++) {
      var feature = this.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }
      if(datasourceElement.show_only_search_matches && !feature.search_match) { continue; }
      object_array.push(feature);
    }
  }
  if(datasourceElement.datasource_mode == "edge") {
    var t_signal_dtype = datasourceElement.datatypes[this.signal_datatype];
    for(j=0; j<this.edge_array.length; j++) {
      var edge = this.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(!edge.feature1 || !edge.feature2) { continue; }
      if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }
      //object_array.push(edge);
      edge.feature1.signal = undefined;
      edge.feature2.signal = undefined;      
      if(this.signal_datatype!="slotcount") {  
        var signal = zenbu_object_dtypecol_value(edge, t_signal_dtype, "first"); //return first (single) value
        edge.feature1.signal = signal;
        edge.feature2.signal = signal;
      }
      var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
      var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];
      if(chrom1 && (this.edge_location_mode=="both features" || this.edge_location_mode=="left feature")) {
        object_array.push(edge.feature1);
      }
      if(chrom2 && (this.edge_location_mode=="both features" || this.edge_location_mode=="right feature")) {
        object_array.push(edge.feature2);
      }
    }
  }
  object_array.sort(reports_genomewide_featureloc_sort_func);
  //console.log("zenbuGenomeWideElement_renderChromView preloop "+(object_array.length)+" "+datasourceElement.datasource_mode);

  var g4 = document.createElementNS(svgNS,'g');
  var current_chrom = null;
  var current_slot = null;
  var obj = null;
  var chrom = null;
  for(fidx=0; fidx<=object_array.length; fidx++) {
    //trick logic to go one past the end to trigger final slot to render
    obj=null;
    chrom=null;
    if(fidx<object_array.length) { obj = object_array[fidx]; }
    if(obj) { chrom = this.assembly.chroms_hash[obj.chrom]; }

    if(obj && !obj.filter_valid) { continue; }

    if(current_slot && (!chrom || !obj || current_chrom!=chrom || obj.start>current_slot.end)) {
      //render slot into line
      var slot_x = (this.max_name_width+13)+ Math.floor((current_slot.start / current_slot.chrom.chrom_length) * current_slot.chrom.chrom_width);
      var slot_y = Math.floor(current_slot.chrom.draw_idx * this.chrom_track_height)+4;
        
      var line = document.createElementNS(svgNS,'line');
      line.setAttributeNS(null, 'x1', slot_x+'px');
      line.setAttributeNS(null, 'y1', slot_y+'px');
      line.setAttributeNS(null, 'x2', slot_x+'px');
      line.setAttributeNS(null, 'y2', (slot_y+this.chrom_track_height-8)+'px');
      line.setAttributeNS(null, 'stroke-width', 1);
      line.setAttributeNS(null, 'stroke', current_slot.color);
      current_slot.svg_line = line;

      //update the slotcount_dtype
      if((slotcount_dtype.min_val == 0) && (slotcount_dtype.max_val == 0)) {
        slotcount_dtype.min_val = current_slot.count;
        slotcount_dtype.max_val = current_slot.count;
      }
      if(current_slot.count < slotcount_dtype.min_val) { slotcount_dtype.min_val = current_slot.count; }
      if(current_slot.count > slotcount_dtype.max_val) { slotcount_dtype.max_val = current_slot.count; }

      if(signal_dtype) {
        if(signal_dtype.min_val == 0 && signal_dtype.max_val == 0) {
          console.log("set initial signal_dtype val:"+current_slot.signal);
          signal_dtype.min_val = current_slot.signal;
          signal_dtype.max_val = current_slot.signal;
        }
        if(current_slot.signal < signal_dtype.min_val) { signal_dtype.min_val = current_slot.signal; }
        if(current_slot.signal > signal_dtype.max_val) { signal_dtype.max_val = current_slot.signal; }
      }
      current_slot=null; //finished with current_slot
    }
    if(!obj) { continue; }
    if(!chrom) { continue; }
    if(!chrom.visible) { continue; }

    if(!current_chrom || current_chrom!=chrom) {
      //console.log("obj changed to chrom:"+chrom.chrom_name);
      current_chrom = chrom;
      chrom.chrom_width = this.render_width - 15 - this.max_name_width - 10;  //take off extra 10 for border and rounded ends
      if(this.max_chrom) {
        var scale = chrom.chrom_length / this.max_chrom.chrom_length;
        chrom.chrom_width = chrom.chrom_width * scale;
      }
      chrom.color = zenbuIndexColorSpace(this.colorspace, chrom.draw_idx);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11
    }

    if(!current_slot) {
      //build next slot, slot is 1px wide
      current_slot = new Object();
      current_slot.color = "#000000"; //default color for now
      current_slot.count = 0;
      current_slot.signal = 0;
      current_slot.valid = false;
      current_slot.search_match = false;      
      var slot_length = Math.floor(chrom.chrom_length / chrom.chrom_width);
      current_slot.chrom = chrom;
      current_slot.start = Math.floor(obj.start / slot_length) * slot_length;
      current_slot.end = current_slot.start + slot_length -1;
      current_slot.slot_length = slot_length;
      current_slot.features = new Array();
      
      this.chromview_slots.push(current_slot); //track the chromview_slots
      current_slot.slot_idx = this.chromview_slots.length-1;
      
      //console.log("new slot "+current_slot.start+".."+current_slot.end+"  for obj start:"+obj.start);
    }
    
    if(current_slot && (obj.start>=current_slot.start) && (obj.start<=current_slot.end)) {
      current_slot.features.push(obj);
      var is_valid = true;
      if(!obj.filter_valid) { is_valid=false; }
      if(is_valid) { 
        current_slot.valid=true; 
        current_slot.count++; 
        if(signal_dtype) {
          if(obj.signal != undefined) {
            current_slot.signal += obj.signal; 
          } else {
            var signal = zenbu_object_dtypecol_value(obj, signal_dtype, "first"); //return first (single) value
            current_slot.signal += signal;
          }
        }
      }
      if(!datasourceElement.search_data_filter || obj.search_match) { current_slot.search_match = true; }
    }
    //else {
    //  console.log("slot problem "+current_slot.start+".."+current_slot.end+"  for object:"+obj.chrom+":"+obj.start+".."+obj.end);
    //  return;
    //}
  }

  //post-loop the slots if slotcount filter is activated
  console.log("slotcount_dtype min:"+slotcount_dtype.min_val+"  max:"+slotcount_dtype.max_val);
  if(slotcount_dtype.filtered) {
    console.log("slotcount_dtype filter activated: need to reloop slots and deavtivate/gray out those that fail filter");
    for(var sidx=0; sidx<this.chromview_slots.length; sidx++) {
      var slot = this.chromview_slots[sidx];
      if(!slot) { continue; }
      var c1 = slot.count;
      if(slotcount_dtype.filter_abs) { c1 = Math.abs(c1); }
      if((slotcount_dtype.filter_min!="min") && (c1 < slotcount_dtype.filter_min)) { slot.valid = false; }
      if((slotcount_dtype.filter_max!="max") && (c1 > slotcount_dtype.filter_max)) { slot.valid = false; }
    }
  }
  if(signal_dtype) {
    console.log("signal_dtype post: "+signal_dtype.datatype+" minval:"+signal_dtype.min_val+" maxval:"+signal_dtype.max_val)
  }
  /*
  if(signal_dtype && signal_dtype.filtered) {
    console.log("signal_dtype filter activated: need to reloop slots and deavtivate/gray out those that fail filter");
    for(var sidx=0; sidx<this.chromview_slots.length; sidx++) {
      var slot = this.chromview_slots[sidx];
      if(!slot) { continue; }
      var c1 = slot.signal;
      if(signal_dtype.filter_abs) { c1 = Math.abs(c1); }
      if((signal_dtype.filter_min!="min") && (c1 < signal_dtype.filter_min)) { slot.valid = false; }
      if((signal_dtype.filter_max!="max") && (c1 > signal_dtype.filter_max)) { slot.valid = false; }
    }
  }
  */
  var t1 = performance.now();
  console.log("zenbuGenomeWideElement_renderChromView after slot processing " + (t1 - t0) + " msec.");

  //final loop to set color and events for the slots
  for(var sidx=0; sidx<this.chromview_slots.length; sidx++) {
    var slot = this.chromview_slots[sidx];
    if(!slot) { continue; }
    if(!slot.svg_line) { 
      // console.log("slot missing svg_line!! idx:"+sidx+" "+slot.chrom.chrom_name+":"+slot.start+".."+slot.end); continue; }
      //render slot into line
      var slot_x = (this.max_name_width+13)+ Math.floor((slot.start / slot.chrom.chrom_length) * slot.chrom.chrom_width);
      var slot_y = Math.floor(slot.chrom.draw_idx * this.chrom_track_height)+4;
        
      var line = document.createElementNS(svgNS,'line');
      line.setAttributeNS(null, 'x1', slot_x+'px');
      line.setAttributeNS(null, 'y1', slot_y+'px');
      line.setAttributeNS(null, 'x2', slot_x+'px');
      line.setAttributeNS(null, 'y2', (slot_y+this.chrom_track_height-8)+'px');
      line.setAttributeNS(null, 'stroke-width', 1);
      line.setAttributeNS(null, 'stroke', slot.color);
      slot.svg_line = line;
    }

    if(slot.valid && slot.search_match) {
      slot.color = "#000000";
      if(this.feature_color_mode == "match_chrom") { slot.color = slot.chrom.color.getCSSHexadecimalRGB(); }
      if(this.feature_color_mode == "fixed_color") { slot.color = this.fixed_color; }
      if(this.feature_color_mode == "signal") { 
        //colorscore (cr) is 0..1 scaled signal
        var signal = slot.count;
        var datatype = slotcount_dtype;
        if(signal_dtype) { signal = slot.signal; datatype = signal_dtype; }
        var cs = (signal - datatype.min_val) / (datatype.max_val - datatype.min_val);
        var color = zenbuScoreColorSpace(this.signal_colorspace, cs, false, this.signal_logscale); //leave discrete false
        slot.color = color.getCSSHexadecimalRGB();
      }
    } else {
      slot.color = "#E8E8E8";
    }
    slot.svg_line.setAttributeNS(null, 'stroke', slot.color);

    if(slot.valid) { 
      slot.svg_line.setAttribute("onmouseover", "zenbuGenomeWideElement_slotHoverInfo('"+this.elementID+"','"+(slot.slot_idx)+"');");
      slot.svg_line.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      slot.svg_line.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select_slot', '"+ (slot.slot_idx)+"');");
    }

    var append_slot = true;
    if(this.hide_filtered_slots && !slot.valid) { append_slot = false; }
    if(datasourceElement.show_only_search_matches && !slot.search_match) { append_slot = false; }
    if(append_slot) { g4.appendChild(slot.svg_line); }
  }

  t1 = performance.now();
  console.log("zenbuGenomeWideElement_renderChromView total " + (t1 - t0) + " msec.");
  this.chromview_render = g4;
}


function zenbuGenomeWideElement_slotHoverInfo(elementID, slotIdx) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var datasourceElement = reportElement.datasource();
  if(!datasourceElement) { return; }
    
  var slot = reportElement.chromview_slots[slotIdx];
  if(!slot) { return; }

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "background-color:#404040; text-align:left; font-size:10px; color:#FDFDFD; "
                        + "font-family:arial,helvetica,sans-serif; width:350px; z-index:100; "
                        + "opacity: 0.90; padding: 3px 3px 3px 3px; "
                        + "border-radius: 7px; border: solid 1px #808080; "
                       );
    
  //var tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  //var tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.innerHTML = "This will be the slot info hover:";

  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "width:330px; word-wrap: break-word; ");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight: bold; word-wrap: break-word; ");
  tspan.innerHTML = "segment"+slot.slot_idx+" "+slot.chrom.chrom_name+":"+slot.start+".."+slot.end;
  //tspan.innerHTML += "("+slot.slot_length+"bp)";
  
  if(slot.signal>0) {
    tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "width:330px; word-wrap: break-word; ");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; white-space:nowrap; padding-right:10px;");
    tspan.innerHTML = "signal sum: "+slot.signal;
  }

  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "width:330px; word-wrap: break-word; ");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight: bold; white-space:nowrap; padding-right:10px;");
  tspan.innerHTML = slot.count+" features:";
  //tspan.innerHTML += "("+slot.slot_length+"bp)";

  //tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "width:330px; word-wrap: break-word; ");
  for(var fidx=0; fidx<slot.features.length; fidx++) {
    var feature = slot.features[fidx];
    if(!feature) { continue; }
    var is_valid=true;
    if(!feature.filter_valid) { is_valid=false; }
    if(datasourceElement.search_data_filter && !feature.search_match) { is_valid=false; }
    tspan = tdiv.appendChild(document.createElement('span'));
    //tspan.setAttribute('style', "font-weight: bold; word-wrap: break-word; ");
    tspan.setAttribute('style', "padding-right:5px; word-wrap: break-word; ");
    if(!is_valid) { tspan.style.color = "#B0B0B0"; }
    tspan.innerHTML = feature.name;
  }
  
  /*  
  current_slot.count = 0;
  current_slot.signal = 0;
  current_slot.valid = false;
  var slot_length = Math.floor(chrom.chrom_length / chrom.chrom_width);
  current_slot.start = Math.floor(feature.start / slot_length) * slot_length;
  current_slot.end = current_slot.start + slot_length -1;
  current_slot.slot_length = slot_length;
  current_slot.features = new Array();
  */
      
  toolTipLayer.innerHTML = "";
  toolTipLayer.appendChild(divFrame);
  toolTipSTYLE.display='block';
}

//=================================================================================
//
// ManhattanPlot section
//
//=================================================================================

function zenbuGenomeWideElement_drawManhattanPlot() {
  if(this.loading) { return; }
  console.log("zenbuGenomeWideElement_drawManhattanPlot ["+this.elementID+"]");
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this.datasource();
  
  if(this.resized) { //clear render caches so it rebuilds
    this.manhattan_render = null; 
  }

  var t0 = performance.now();
      
  var div1 = main_div.appendChild(document.createElement('div'));

  var height = this.content_height - 30;
  var width  = this.content_width;  
  //console.log("zenbuGenomeWideElement_drawManhattanPlot width["+width+"] height["+height+"]");
  
  var svg = div1.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', height+'px');
  
  if(!this.chroms_array) { return; }
  
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  svg.appendChild(g1);
    
  var left_border = 40;
    
  var genome_scale = (width-(left_border+10)) / this.visible_chrom_length;
  this.manhattan_genome_scale = genome_scale;

  var ticks_d = [];
 
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  var max_name_width = 0;
  var cummulative_length = 0;
  var draw_idx=0;
  for(var idx=0; idx<this.chroms_array.length; idx++) {
    var chrom = this.chroms_array[idx];
    if(!chrom) { continue; }
    if(!chrom.visible) { continue; }
    chrom.draw_idx = draw_idx++;
    chrom.color = zenbuIndexColorSpace(this.colorspace, chrom.draw_idx);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11

    var name = chrom.chrom_name;
    if(name == undefined) { name = ".."; }
    name = name.replace(/^chr/, '');

    var tg1 = g2.appendChild(document.createElementNS(svgNS,'g'));
    
    var tcx = left_border+ cummulative_length*genome_scale;
    var tcm  = left_border+ (cummulative_length + (chrom.chrom_length/2))*genome_scale;
    var tcy  = parseInt(height-40);
    var tcw  = chrom.chrom_length*genome_scale;
    chrom.manhattan_start = tcx;
    chrom.manhattan_width = tcw;
    chrom.manhattan_genome_scale = (tcw-2)/chrom.chrom_length; //adjust for size of dots
    if(tcw<4) { chrom.manhattan_genome_scale = genome_scale; }
      
    //tick marks
    var td2 = ["M", tcm, tcy-9, "l", 0, 10];
    ticks_d = ticks_d.concat(td2);
    
    //make chrom box
    var chromrect = document.createElementNS(svgNS,'rect');
    chromrect.setAttributeNS(null, 'x', tcx);
    chromrect.setAttributeNS(null, 'y', (tcy-9) +'px');
    //chromrect.setAttributeNS(null, 'width', parseInt((chrom.chrom_length)*genome_scale) + "px");
    chromrect.setAttributeNS(null, 'width', tcw);
    chromrect.setAttributeNS(null, 'height', '3px');
    chromrect.setAttributeNS(null, 'stroke-width', 0);
    chromrect.setAttributeNS(null, 'fill', chrom.color.getCSSHexadecimalRGB());
    chromrect.setAttributeNS(null, 'stroke', chrom.color.getCSSHexadecimalRGB());
    var msg = chrom.chrom_name +": len="+chrom.chrom_length+" x="+tcx+" w="+tcw;
    chromrect.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",300);");
    chromrect.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //chromrect.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
    g2.appendChild(chromrect);

    //rotated chrom name text
    var text = tg1.appendChild(document.createElementNS(svgNS,'text'));
    text.setAttribute('x', '0px');
    text.setAttribute('y', '0px');
    text.setAttribute('transform', "rotate(-90 0,0)");
    text.setAttribute('style', 'fill: black;');
    //text.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
    //text.setAttribute("onmouseover", "reportElementEvent(\""+this.elementID+"\", 'chrom-info', '"+chrom.chrom_name+"'); return false; ");
    //text.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //text.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
    text.appendChild(document.createTextNode(name));
    //g2.appendChild(text);
    
    cummulative_length += chrom.chrom_length;
    var bbox = text.getBBox();
    if(bbox.width > max_name_width) { max_name_width = bbox.width; };
    
    tcm += parseInt(bbox.height/2)-1;
    tcy += parseInt(bbox.width)+2;
    tg1.setAttribute('transform', "translate("+tcm+","+tcy+")");
  }
  
  //draw tick marks into g2
  //console.log("ticks: "+ticks_d.join(" "));
  var line1 = g2.appendChild(document.createElementNS(svgNS,'path'));
  line1.setAttributeNS(null, 'd', ticks_d.join(" "));
  line1.setAttributeNS(null, 'stroke', "#909090");
  line1.setAttributeNS(null, 'stroke-width', "1px");
  line1.setAttributeNS(null, 'fill', "transparent");

  //transform g2 up/down based on max_name_width
  //console.log("chrom name max_name_width="+max_name_width);
  var offset = 25-max_name_width;
  g2.setAttribute('transform', "translate(0,"+offset+")");
  this.manhattan_bottom = height+offset-50;

  //draw x-axis label "chromosome"
  var text = g1.appendChild(document.createElementNS(svgNS,'text'));
  text.setAttribute('x', (width/2)+'px');
  text.setAttribute('y', (height)+'px');
  text.setAttribute('style', 'fill: black;');
  text.appendChild(document.createTextNode("chromosome"));
  
  //draw y-axis label of the datatype with scale ticks
  var signal_dtype = datasourceElement.datatypes[this.signal_datatype];
  if(signal_dtype) {
    console.log("drawManhattanPlot signal_dtype dtype:"+signal_dtype.datatype+" minval:"+signal_dtype.min_val+" maxval:"+signal_dtype.max_val);
    var tg2 = g1.appendChild(document.createElementNS(svgNS,'g'));
    var text = tg2.appendChild(document.createElementNS(svgNS,'text'));
    text.setAttribute('x', '0px');
    text.setAttribute('y', '0px');
    text.setAttribute('transform', "rotate(-90 0,0)");
    text.setAttribute('style', 'fill: black;');
    text.appendChild(document.createTextNode(signal_dtype.title)); 
    tg2.setAttribute('transform', "translate(10, "+(height/2)+")");
    
    if(signal_dtype.max_val != signal_dtype.min_val) {
      var yaxis_height = (this.manhattan_bottom-10);
      var height_scale = (this.manhattan_bottom-10)/(signal_dtype.max_val - signal_dtype.min_val);
      var major_tick = Math.pow(10,Math.floor(Math.log2(signal_dtype.max_val - signal_dtype.min_val)/Math.log2(10)));
      var minor_tick = major_tick / 10;
      //if((signal_dtype.max_val - signal_dtype.min_val)/major_tick < 5) { major_tick = major_tick/2; }
      //console.log("height scale = "+height_scale+ " major_tick="+major_tick);
      var ticks3 = [];
      var min_tick = Math.floor(signal_dtype.min_val / major_tick)*major_tick;
      for(var tk1=min_tick; tk1<=signal_dtype.max_val; tk1+=minor_tick) {
        var yrel = (tk1-signal_dtype.min_val) / (signal_dtype.max_val - signal_dtype.min_val); //0-1.0 scale
        if(this.yaxis_logscale) { yrel = Math.log(yrel*100 + 1) / Math.log(100+1); }
        //var tcy = this.manhattan_bottom - (tk1-signal_dtype.min_val)*height_scale;
        var tcy = this.manhattan_bottom - (yrel)*yaxis_height;
        
        if(tk1 % major_tick ==0) {
          //rotated tick value
          var tg3 = g1.appendChild(document.createElementNS(svgNS,'g'));
          var text = tg3.appendChild(document.createElementNS(svgNS,'text'));
          text.setAttribute('x', '0px');
          text.setAttribute('y', '0px');
          text.setAttribute('transform', "rotate(-90 0,0)");
          text.setAttribute('style', 'fill: black;');
          text.appendChild(document.createTextNode(tk1));
          var bbox = text.getBBox();
          tg3.setAttribute('transform', "translate("+(left_border-14)+","+(tcy+(bbox.width/2)) +")");

          var tkd2 = ["M", (left_border-12), tcy, "l", 10, 0];
          ticks3 = ticks3.concat(tkd2);      
        } else if(tk1 % (major_tick/2) ==0) {
          var tkd2 = ["M", (left_border-9), tcy, "l", 7, 0];
          ticks3 = ticks3.concat(tkd2);          
        } else {
          var tkd2 = ["M", (left_border-6), tcy, "l", 4, 0];
          ticks3 = ticks3.concat(tkd2);
        }
        
      }
      var line1 = g1.appendChild(document.createElementNS(svgNS,'path'));
      line1.setAttributeNS(null, 'd', ticks3.join(" "));
      line1.setAttributeNS(null, 'stroke', "#909090");
      line1.setAttributeNS(null, 'stroke-width', "1px");
      line1.setAttributeNS(null, 'fill', "transparent");
    }
  } else {
    console.log("drawManhattanPlot could not find datatype:"+this.signal_datatype);
  }
  
  //draw graph lines adjusted for the chrom max_name_width
  var d = ["M", left_border-2, 10,
           "L", left_border-2, this.manhattan_bottom,
           "L", width-10, this.manhattan_bottom];
  var line1 = g1.appendChild(document.createElementNS(svgNS,'path'));
  line1.setAttributeNS(null, 'd', d.join(" "));
  line1.setAttributeNS(null, 'stroke', "#303030");
  line1.setAttributeNS(null, 'stroke-width', "2px");
  line1.setAttributeNS(null, 'fill', "transparent");

  //console.log("max chrom name width: "+max_name_width);
  //this.max_name_width = max_name_width;
  //this.render_width = width;
  
  if(datasourceElement.datasource_mode == "feature") { this.renderManhattanViewFeatures(); }
  if(datasourceElement.datasource_mode == "edge")    { this.renderManhattanViewEdges(); }

  if(this.manhattan_render) { g1.appendChild(this.manhattan_render); }
}


function zenbuGenomeWideElement_renderManhattanViewFeatures() {
  if(this.manhattan_render) { return; }
  if(this.filter_count==0) { return; }

  console.log("zenbuGenomeWideElement_renderManhattanViewFeatures start");
  var t0 = performance.now();
  
  var datasourceElement = this.datasource();
  
  var height = this.manhattan_bottom - 15;
  var width  = this.content_width;  
  console.log("draw height="+height);

  var signal_dtype = null;
  var height_scale = 0.0;
  var dt1 = datasourceElement.datatypes[this.signal_datatype];
  if(dt1) {
    signal_dtype = dt1;
    console.log("renderManhattan signal_dtype dtype:"+signal_dtype.datatype+" minval:"+signal_dtype.min_val+" maxval:"+signal_dtype.max_val);
    height_scale = (height/(signal_dtype.max_val - signal_dtype.min_val));
    console.log("renderManhattan height scale = "+height_scale);
  }
  
  //TODO: might always do a preloop, collate features into slots (like chromview) and then be able to 
  //sort features within slot where invalid are underneath, valid above, selected on top
  
  //if slotcount, need special preloop to recalc the min/max for the slots
  var current_chrom = null;
  var current_fx = null;
  if(signal_dtype && signal_dtype.datatype == "slotcount") {
    console.log("preloop features to recalc the slotcount min/max");
    var t1 = performance.now();
    signal_dtype.min_val = 0; //reset min/max
    signal_dtype.max_val = 0;
    for(fidx=0; fidx<this.feature_array.length; fidx++) {
      var feature = this.feature_array[fidx];
      if(!feature) { continue; }
      var chrom = this.assembly.chroms_hash[feature.chrom];
      if(!chrom) { continue; }
      if(!chrom.visible) { continue; }
      
      if(!feature.filter_valid) { continue; }

      if(!current_chrom || current_chrom!=chrom) {
        current_chrom = chrom;
        current_fx = null;
      }
      
      var fx = Math.round(chrom.manhattan_start + (((feature.start+feature.end)/2.0) * chrom.manhattan_genome_scale));
      
      if(current_fx && current_fx.fx != fx) {
        //update the slotcount_dtype
        if((signal_dtype.min_val == 0) && (signal_dtype.max_val == 0)) {
          signal_dtype.min_val = current_fx.count;
          signal_dtype.max_val = current_fx.count;
        }
        if(current_fx.count < signal_dtype.min_val) { signal_dtype.min_val = current_fx.count; }
        if(current_fx.count > signal_dtype.max_val) { signal_dtype.max_val = current_fx.count; }        
        current_fx = null;
      }
      
      if(!current_fx) {
        current_fx = new Object;
        current_fx.fx = fx;
        current_fx.count = 0;
      }
      feature.slotcount = current_fx.count;
      current_fx.count++;      
    }
    signal_dtype.min_val = 0; //slotcount always has a 0 min
    
    console.log("signal_dtype dtype:"+signal_dtype.datatype+" minval:"+signal_dtype.min_val+" maxval:"+signal_dtype.max_val);
    height_scale = (height/(signal_dtype.max_val - signal_dtype.min_val));
    console.log("height scale = "+height_scale);
    
    var t2 = performance.now();
    console.log("zenbuGenomeWideElement_renderManhattanViewFeatures preloop " + (t2 - t1) + " msec");
  }
  
  var g4 = document.createElementNS(svgNS,'g');
  current_chrom = null;
  var feature = null;
  var chrom = null;
  for(fidx=0; fidx<=this.feature_array.length; fidx++) {
    //trick logic to go one past the end to trigger final slot to render
    feature=null;
    chrom=null;
    if(fidx<this.feature_array.length) { feature = this.feature_array[fidx]; }
    if(feature) { chrom = this.assembly.chroms_hash[feature.chrom]; }
    
    if(!feature) { continue; }
    if(!chrom) { continue; }
    if(!chrom.visible) { continue; }

    if(!current_chrom || current_chrom!=chrom) {
      //console.log("feature changed to chrom:"+chrom.chrom_name);
      current_chrom = chrom;
    }

    var is_valid = true;
    if(!feature.filter_valid) { is_valid=false; }
    if(datasourceElement.search_data_filter && !feature.search_match) { is_valid=false; }

    var fx = Math.round(chrom.manhattan_start + (((feature.start+feature.end)/2.0) * chrom.manhattan_genome_scale));
    //var fx = chrom.manhattan_start + (((feature.start+feature.end)/2.0) * this.manhattan_genome_scale);
    var fy = this.manhattan_bottom -2;
   
    var signal = 0.0;
    if(signal_dtype) {
      if(this.signal_datatype=="slotcount") {
        if(is_valid) { 
          signal = feature.slotcount;
        }
      } else if(this.signal_datatype=="bedscore" && feature.score) {
        signal = parseFloat(feature.score); 
      } else if(feature.expression) {
        for(var exp_idx=0; exp_idx<feature.expression.length; exp_idx++) {
          var expression = feature.expression[exp_idx];
          if(expression && (expression.datatype == this.signal_datatype)) {
            signal += expression.total;
          }
        }
      }
      var s1 = (signal- signal_dtype.min_val) / (signal_dtype.max_val - signal_dtype.min_val); //0-1 scale
      if(this.yaxis_logscale) { 
        s1 = Math.log(s1*100 + 1) / Math.log(100+1);
      }
      fy = this.manhattan_bottom -2 - (height * s1);
    }
    
    if(this.hide_filtered_slots && !is_valid) { continue; }
    
    var color = "#E8E8E8";
    if(is_valid) {
      color = "#000000";
      if(this.feature_color_mode == "match_chrom") { color = chrom.color.getCSSHexadecimalRGB(); }
      if(this.feature_color_mode == "fixed_color") { color = this.fixed_color; }
      if(signal_dtype && (this.feature_color_mode == "signal")) { 
        //colorscore (cr) is 0..1 scaled signal
        var cs = (signal - signal_dtype.min_val) / (signal_dtype.max_val - signal_dtype.min_val);
        var color = zenbuScoreColorSpace(this.signal_colorspace, cs, false, this.signal_logscale); //leave discrete false
        color = color.getCSSHexadecimalRGB();
      }
    } else {
      color = "#E8E8E8";
    }
    
    //final draw point, set color and events for the feature
    //   <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
    var point = document.createElementNS(svgNS,'circle');
    point.setAttributeNS(null, 'cx', fx+1);
    point.setAttributeNS(null, 'cy', fy-1);
    point.setAttributeNS(null, 'r', "2");
    point.setAttributeNS(null, 'stroke-width', 0);
    point.setAttributeNS(null, 'fill', color);    
    point.setAttribute("onmouseover", "zenbuGenomeWideElement_featureHoverInfo('"+this.elementID+"','"+fidx+"');");
    point.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    point.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'select', '"+ feature.id+"');");
    g4.appendChild(point);

    if(datasourceElement.selected_feature && (datasourceElement.selected_feature.id == feature.id)) {
      point.setAttributeNS(null, 'r', "7");
      point.setAttributeNS(null, 'fill', "rgba(255,0,225,0.5)");
      this.selected_point_feature = datasourceElement.selected_feature;
    }
    
    feature.manhattan_point = point;  
    feature.manhattan_color = color;
  }
  
  if(this.selected_point_feature) {
    var point = this.selected_point_feature.manhattan_point;
    g4.appendChild(point); //moves to the end of render list
  }
  
  var t1 = performance.now();
  console.log("zenbuGenomeWideElement_renderManhattanViewFeatures finish " + (t1 - t0) + " msec.");
  this.manhattan_render = g4;  
}


function zenbuGenomeWideElement_renderManhattanViewEdges() {
  if(this.manhattan_render) { return; }
  if(this.filter_count==0) { return; }

  console.log("zenbuGenomeWideElement_renderManhattanViewEdges start");
  var t0 = performance.now();
  
  var datasourceElement = this.datasource();
  
  var height = this.manhattan_bottom - 15;
  var width  = this.content_width;  
  //console.log("draw height="+height);

  var signal_dtype = null;
  var height_scale = 0.0;
  var dt1 = datasourceElement.datatypes[this.signal_datatype];
  if(dt1) {
    signal_dtype = dt1;
    console.log("renderManhattan signal_dtype dtype:"+signal_dtype.datatype+" minval:"+signal_dtype.min_val+" maxval:"+signal_dtype.max_val);
    height_scale = (height/(signal_dtype.max_val - signal_dtype.min_val));
    //console.log("renderManhattan height scale = "+height_scale);
  }
  
  //TODO: might always do a preloop, collate features into slots (like chromview) and then be able to 
  //sort features within slot where invalid are underneath, valid above, selected on top
  
  this.edge_array.sort(reports_genomewide_edge_sort_func);

  //clear and preset
  for(eidx=0; eidx<this.edge_array.length; eidx++) {
    var edge = this.edge_array[eidx];
    if(!edge) { continue; }
    edge.eidx = eidx;
    edge.slotcount = 0;
    if(edge.feature1) {
      edge.manhattan_point1 = null;
    }
    if(edge.feature2) {
      edge.manhattan_point2 = null;
    }
  }

  //if slotcount, need special preloop to recalc the min/max for the slots
  
//   var current_chrom = null;
//   var current_fx = null;
//   if(signal_dtype && signal_dtype.datatype == "slotcount") {
//     console.log("preloop features to recalc the slotcount min/max");
//     var t1 = performance.now();
//     signal_dtype.min_val = 0; //reset min/max
//     signal_dtype.max_val = 0;
//     for(eidx=0; eidx<this.edge_array.length; eidx++) {
//       var edge = this.edge_array[eidx];
//       if(!edge) { continue; }
//       edge.slotcount = 0;
//       
//       if(!edge.filter_valid) { continue; }
//       if(!edge.feature1 || !edge.feature2) { continue; }
//       if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
//       if(datasourceElement.focus_feature &&
//          (datasourceElement.focus_feature.id != edge.feature1_id) &&
//          (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }
//       
//       //set in postprocess now
//       var t_chrom = edge.feature1.chrom;
//       var t_start = edge.feature1.start;
//       var t_end   = edge.feature1.end;
//       if(edge.feature1.chrom == edge.feature2.chrom) {
//         if(edge.feature2.start < t_start) { t_start = edge.feature2.start; }
//         if(edge.feature2.end < t_end) { t_end = edge.feature2.end; }
//       }
//       
//       var chrom = this.assembly.chroms_hash[t_chrom];
//       if(!chrom) { continue; }
//       if(!chrom.visible) { continue; }
//       
//       if(!current_chrom || current_chrom!=chrom) {
//         current_chrom = chrom;
//         current_fx = null;
//       }
//       
//       var fx = Math.round(chrom.manhattan_start + (((t_start + t_end)/2.0) * chrom.manhattan_genome_scale));
//       
//       if(current_fx && current_fx.fx != fx) {
//         //update the slotcount_dtype
//         if((signal_dtype.min_val == 0) && (signal_dtype.max_val == 0)) {
//           signal_dtype.min_val = current_fx.count;
//           signal_dtype.max_val = current_fx.count;
//         }
//         if(current_fx.count < signal_dtype.min_val) { signal_dtype.min_val = current_fx.count; }
//         if(current_fx.count > signal_dtype.max_val) { signal_dtype.max_val = current_fx.count; }        
//         current_fx = null;
//       }
//       
//       if(!current_fx) {
//         current_fx = new Object;
//         current_fx.fx = fx;
//         current_fx.count = 0;
//       }
//       edge.slotcount = current_fx.count;
//       current_fx.count++;      
//     }
//     signal_dtype.min_val = 0; //slotcount always has a 0 min
//     
//     console.log("renderManhattan signal_dtype dtype:"+signal_dtype.datatype+" minval:"+signal_dtype.min_val+" maxval:"+signal_dtype.max_val);
//     height_scale = (height/(signal_dtype.max_val - signal_dtype.min_val));
//     console.log("renderManhattan height scale = "+height_scale);
//     
//     var t2 = performance.now();
//     console.log("zenbuGenomeWideElement_renderManhattanViewEdges preloop " + (t2 - t1) + " msec");
//   }
  
  var g4 = document.createElementNS(svgNS,'g');
  var edge = null;
  for(eidx=0; eidx<=this.edge_array.length; eidx++) {
    //trick logic to go one past the end to trigger final slot to render
    edge=null;
    if(eidx<this.edge_array.length) { edge = this.edge_array[eidx]; }
    if(!edge) { continue; }
    if(!edge.feature1) { continue; }
    if(!edge.feature2) { continue; }
    
    var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
    var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];

    var is_valid = true;
    if(!edge.filter_valid) { is_valid=false; }
    if(datasourceElement.search_data_filter && !edge.search_match) { is_valid=false; }
    if(this.hide_filtered_slots && !is_valid) { continue; }

    var fy = this.manhattan_bottom -2;
    var signal = 0.0;
    if(signal_dtype) {
      if(this.signal_datatype=="slotcount") {
        if(is_valid) { 
          signal = 1; //edge.slotcount;
        }
      } else {
        signal = zenbu_object_dtypecol_value(edge, signal_dtype, "first"); //return first (single) value
        //TODO: might need to add a "sum" more to this function
      }

      var s1 = (signal- signal_dtype.min_val) / (signal_dtype.max_val - signal_dtype.min_val); //0-1 scale
      if(this.yaxis_logscale) { 
        s1 = Math.log(s1*100 + 1) / Math.log(100+1);
      }
      fy = this.manhattan_bottom -2 - (height * s1);
    }
    
    var color = "#E8E8E8";
    if(is_valid) {
      color = "#000000";
      // if(this.feature_color_mode == "match_chrom") { color = chrom.color.getCSSHexadecimalRGB(); }
      if(this.feature_color_mode == "fixed_color") { color = this.fixed_color; }
      if(signal_dtype && (this.feature_color_mode == "signal")) { 
        //colorscore (cr) is 0..1 scaled signal
        var cs = (signal - signal_dtype.min_val) / (signal_dtype.max_val - signal_dtype.min_val);
        var color = zenbuScoreColorSpace(this.signal_colorspace, cs, false, this.signal_logscale); //leave discrete false
        color = color.getCSSHexadecimalRGB();
      }
    } else {
      color = "#E8E8E8";
    }
    
    // var fx = Math.round(chrom.manhattan_start + (((edge.start+edge.end)/2.0) * chrom.manhattan_genome_scale));
    // //var fx = chrom.manhattan_start + (((edge.start+edge.end)/2.0) * this.manhattan_genome_scale);

    if(chrom1 && chrom1.visible && (this.edge_location_mode=="both features" || this.edge_location_mode=="left feature")) {
      var fx = Math.round(chrom1.manhattan_start + (((edge.feature1.start + edge.feature1.end)/2.0) * chrom1.manhattan_genome_scale));

      if(is_valid && this.feature_color_mode == "match_chrom") { color = chrom1.color.getCSSHexadecimalRGB(); }

      //final draw point, set color and events for the feature
      //   <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
      var point = document.createElementNS(svgNS,'circle');
      point.setAttributeNS(null, 'cx', fx+1);
      point.setAttributeNS(null, 'cy', fy-1);
      point.setAttributeNS(null, 'r', "2");
      point.setAttributeNS(null, 'stroke-width', 0);
      point.setAttributeNS(null, 'fill', color);    
      point.setAttribute("onmouseover", "zenbuGenomeWideElement_edgeHoverInfo('"+this.elementID+"','"+eidx+"');");
      point.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      point.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'select', '"+ edge.id+"');");
      g4.appendChild(point);
      
      if(datasourceElement.selected_edge && (datasourceElement.selected_edge.id == edge.id)) {
        console.log("zenbuGenomeWideElement_renderManhattanViewEdges found selected edge point, color PINK");
        point.setAttributeNS(null, 'r', "7");
        point.setAttributeNS(null, 'fill', "rgba(255,0,225,0.7)");
        //this.selected_point_feature = edge;
        edge.selected = true;
        this.selected_point_edge = edge;
      }
      edge.manhattan_point1 = point;
      edge.manhattan_color1 = color;
    }
    
    if(chrom2 && chrom2.visible && (this.edge_location_mode=="both features" || this.edge_location_mode=="right feature")) {
      var fx = Math.round(chrom2.manhattan_start + (((edge.feature2.start + edge.feature2.end)/2.0) * chrom2.manhattan_genome_scale));

      if(is_valid && this.feature_color_mode == "match_chrom") { color = chrom2.color.getCSSHexadecimalRGB(); }

      //final draw point, set color and events for the feature
      //   <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
      var point = document.createElementNS(svgNS,'circle');
      point.setAttributeNS(null, 'cx', fx+1);
      point.setAttributeNS(null, 'cy', fy-1);
      point.setAttributeNS(null, 'r', "2");
      point.setAttributeNS(null, 'stroke-width', 0);
      point.setAttributeNS(null, 'fill', color);    
      point.setAttribute("onmouseover", "zenbuGenomeWideElement_edgeHoverInfo('"+this.elementID+"','"+eidx+"');");
      point.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      point.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'select', '"+ edge.id+"');");
      g4.appendChild(point);
      
      if(datasourceElement.selected_edge && (datasourceElement.selected_edge.id == edge.id)) {
        console.log("zenbuGenomeWideElement_renderManhattanViewEdges found selected edge point, color PINK");
        point.setAttributeNS(null, 'r', "7");
        point.setAttributeNS(null, 'fill', "rgba(255,0,225,0.7)");
        //this.selected_point_feature = edge;
        //edge.feature2.selected = true;
        edge.selected = true;
        this.selected_point_edge = edge;
      }
      edge.manhattan_point2 = point;
      edge.manhattan_color2 = color;
    }
    
  }
  
  if(this.selected_point_edge) {
    var point1 = this.selected_point_edge.manhattan_point1;
    if(point1) { g4.appendChild(point); } //moves to the end of render list
    var point2 = this.selected_point_edge.manhattan_point2;
    if(point2) { g4.appendChild(point); } //moves to the end of render list
  }
  
  var t1 = performance.now();
  console.log("zenbuGenomeWideElement_renderManhattanViewEdges finish " + (t1 - t0) + " msec.");
  this.manhattan_render = g4;  
}


function zenbuGenomeWideElement_featureHoverInfo(elementID, fidx) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
    
  var feature = reportElement.feature_array[fidx];
  if(!feature) { return; }

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "background-color:#404040; text-align:left; font-size:10px; color:#FDFDFD; "
                        + "font-family:arial,helvetica,sans-serif; width:350px; z-index:100; "
                        + "opacity: 0.90; padding: 3px 3px 3px 3px; "
                        + "border-radius: 7px; border: solid 1px #808080; "
                       );
    
  //var tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  //var tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.innerHTML = "This will be the feature info hover:";
  
  for(var icol=0; icol<reportElement.dtype_columns.length; icol++) {
    var dtype_col = reportElement.dtype_columns[icol];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible) { continue; }
    
    var datatype = dtype_col.datatype;
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');

    tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "width:330px; word-wrap: break-word; ");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; word-wrap: break-word; ");
    tspan.innerHTML = dtype_col.title + ": ";

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "word-wrap: break-word; ");

    if((dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) {
      tspan.innerHTML = feature.name;
    } 
    else if(feature.score && (datatype == "bedscore")) {
      tspan.innerHTML = parseFloat(feature.score); 
    }
    else if(feature.slotcount && (datatype == "slotcount")) {
      tspan.innerHTML = parseFloat(feature.slotcount); 
    }    
    else if(feature.expression && (dtype_col.col_type == "signal")) {
      for(var j2=0; j2<feature.expression.length; j2++) {
        var expression = feature.expression[j2];
        if(expression.datatype != datatype) { continue; }
        if(tspan.innerHTML != "") { tspan.innerHTML += " "; }
        tspan.innerHTML += expression.total.toPrecision(4);
      }
    } 
    else if(dtype_col.col_type == "mdata") {
      var val = "";
      if(feature.mdata && feature.mdata[datatype]) {
        var value_array = feature.mdata[datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          if(val) { val += ", "; }
          val += value_array[idx1];
        }
      } else if(feature.source && (datatype == "category")) {
        val = feature.source.category;
      } else if(feature.source && (datatype == "source_name")) {
        val = feature.source.name;
      } else if(datatype == "location_string") {
        val = feature.chromloc;
      }
      if(val) { tspan.innerHTML = val; }      
    } 
  }
    
  toolTipLayer.innerHTML = "";
  toolTipLayer.appendChild(divFrame);
  toolTipSTYLE.display='block';
}


/*
//=================================================================================
// old code
//=================================================================================

function zenbuGenomeWideElement_renderEdges(svg) {
  if(!this.assembly) { return; }
  if(!svg) { return; }
    
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this.datasource();
  if(datasourceElement.datasource_mode != "edge") { return; }
    
  //console.log("zenbuGenomeWideElement_renderEdges ["+this.elementID+"]");

  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 50;
  width = width -10;
    
  var radius = width;
  if(height<radius) { radius = height; }
  radius = (radius / 2.0)-10;
  //console.log("zenbuGenomeWideElement_renderEdges width["+width+"] height["+height+"]  radius["+radius+"]");
  
  for(j=0; j<datasourceElement.edge_array.length; j++) {
    var edge = datasourceElement.edge_array[j];
    if(!edge) { continue; }
    edge.selected = false;
    if(this.selected_edge && (edge.id == this.selected_edge.id)) { 
      console.log("zenbuGenomeWideElement_renderEdges found selected_edge");
      edge.selected=true;
    }
  }
  datasourceElement.edge_array.sort(reports_genomewide_edge_sort_func);

  //make sure the columns are sorted for the hover-info
  this.dtype_columns.sort(reports_column_order_sort_func);

  var t1 = performance.now();
  //console.log("after sort " + (t1 - t0) + " msec.");
  
  for(j=0; j<datasourceElement.edge_array.length; j++) {
    var edge = datasourceElement.edge_array[j];
    if(!edge) { continue; }
    if(!edge.filter_valid) { continue; }
    if(datasourceElement.search_data_filter && !edge.search_match) { continue; }
    if(!edge.feature1) { continue; }
    if(!edge.feature2) { continue; }
    if(datasourceElement.focus_feature &&
        (datasourceElement.focus_feature.id != edge.feature1_id) &&
        (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

    //ok render the edge
    //console.log("genomewide edge.f1 ["+edge.feature1.name+"] edge.f2["+edge.feature2.name+"]");
    //console.log("genomewide edge.f1 ["+edge.feature1.chrom+"] edge.f2["+edge.feature2.chrom+"]");
    
    var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
    if(!chrom1) { continue; }
    if(chrom1.chrom_length==0) { continue; }

    var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];
    if(!chrom2) { continue; }
    if(chrom2.chrom_length==0) { continue; }
    
    arc_f1 = chrom1.arc_start + (edge.feature1.start)*(chrom1.arc_end - chrom1.arc_start)/chrom1.chrom_length;
    var point_f1 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f1);
    //console.log("genomewide edge.f1 ["+edge.feature1.chrom+"] :"+edge.feature1.start+" : "+arc_f1+" : "+point_f1.x+","+point_f1.y);

    arc_f2 = chrom2.arc_start + (edge.feature2.start)*(chrom2.arc_end - chrom2.arc_start)/chrom2.chrom_length;
    var point_f2 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f2);
    //console.log("genomewide edge.f2 ["+edge.feature2.chrom+"] :"+edge.feature2.start+" : "+arc_f2+" : "+point_f2.x+","+point_f2.y);
    
    //   <line x1="0" y1="0" x2="200" y2="200" style="stroke:rgb(255,0,0);stroke-width:2" />
    
    var d = ["M", point_f1.x, point_f1.y, 
             //"L", point_f2.x, point_f2.y
             "C", width/2.0, height/2.0, point_f2.x, point_f2.y, point_f2.x, point_f2.y,
             "C", point_f2.x, point_f2.y, width/2.0, height/2.0, point_f1.x, point_f1.y
            ];

    var line1 = svg.appendChild(document.createElementNS(svgNS,'path'));
    line1.setAttributeNS(null, 'd', d.join(" "));
    line1.setAttributeNS(null, 'stroke', "#808080");
    line1.setAttributeNS(null, 'stroke-width', "1px");
    //line1.setAttributeNS(null, 'fill', "red");
    line1.setAttributeNS(null, 'fill', "transparent");
    
    if(this.selected_edge && (edge.id == this.selected_edge.id)) {
      line1.setAttributeNS(null, 'stroke', "rgba(255,0,225,0.9)");
      line1.setAttributeNS(null, 'stroke-width', "5px");
    }

    //var msg = "edge.f1 ["+edge.feature1.name+"]<br>"+edge.feature1.chromloc;
    //msg += "<p>edge.f2["+edge.feature2.name+"]<br>"+edge.feature2.chromloc;
    //line1.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",250);");
    
    line1.setAttribute("onmouseover", "zenbuGenomeWideElement_edgeHoverInfo('"+this.elementID+"','"+j+"');");
    line1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    line1.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'select', '"+ edge.id+"');");
  }
}
*/


function zenbuGenomeWideElement_edgeHoverInfo(elementID, edgeIdx) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var edge = reportElement.edge_array[edgeIdx];
  if(!edge) { return; }

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "background-color:#404040; text-align:left; font-size:10px; color:#FDFDFD; "
                        + "font-family:arial,helvetica,sans-serif; width:350px; z-index:100; "
                        + "opacity: 0.90; padding: 3px 3px 3px 3px; "
                        + "border-radius: 7px; border: solid 1px #808080; "
                       );
    
  //var tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  //var tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.innerHTML = "This will be the edge info hover:";
  
  for(var icol=0; icol<reportElement.dtype_columns.length; icol++) {
    var dtype_col = reportElement.dtype_columns[icol];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible) { continue; }

    var t_feature;
    if(edge && (/^f1\./.test(dtype_col.datatype))) { t_feature = edge.feature1;}
    if(edge && (/^f2\./.test(dtype_col.datatype))) { t_feature = edge.feature2;}
    
    var datatype = dtype_col.datatype;
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');

    tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "width:330px; word-wrap: break-word; ");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; word-wrap: break-word; ");
    tspan.innerHTML = dtype_col.title + ": ";

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "word-wrap: break-word; ");

    if(t_feature && (dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) {
      tspan.innerHTML = t_feature.name;
    } 
    else if(edge && (dtype_col.col_type == "weight")) {
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
    else if(t_feature && dtype_col.col_type == "mdata") {
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
  }
    
  toolTipLayer.innerHTML = "";
  toolTipLayer.appendChild(divFrame);
  toolTipSTYLE.display='block';

}


//=================================================================================
//
// configuration
//
//=================================================================================

function zenbuGenomeWideElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();

  var labelDiv = configdiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="Visualization:";

  div1 = configdiv.appendChild(document.createElement('div'));
  var genomeWidget = zenbuGenomeSelectWidget("filter_search", this.elementID);
  genomeWidget.callOutFunction = zenbuGenomeWideElement_genome_select_callback;
  if(this.assembly_name) { genomeWidget.name = this.assembly_name; }
  //if(userview.filters.assembly) { genomeWidget.name = userview.filters.assembly; }
  genomeWidget.elementID = this.elementID;
  genomeWidget.assemblySelect.style.width = "330px";
  div1.appendChild(genomeWidget);
  zenbuGenomeSelectUpdate(this.elementID);

  //-----  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin: 5px 0px 0px 5px;");
  tdiv2.appendChild(reportElementColorSpaceOptions(this));
    
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin-top: 5px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_only_chroms_with_data;
  if(this.newconfig && this.newconfig.show_only_chroms_with_data != undefined) { 
    val1 = this.newconfig.show_only_chroms_with_data; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_only_chroms_with_data', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show only chroms with data";

  //show_mini_chroms
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_mini_chroms;
  if(this.newconfig && this.newconfig.show_mini_chroms != undefined) { 
    val1 = this.newconfig.show_mini_chroms; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_mini_chroms', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show small chroms";
  tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\"When selected, all chroms will be given a minimum size in order to be visible.<br>If not selected, chroms will be scaled to their true size and small chroms/scaffolds, although present, will be too small to see.\",250);");
  tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");

  //show edge position options
  if(datasourceElement.datasource_mode == "edge") { 
    var edge_location_mode = this.edge_location_mode;
    if(this.newconfig && this.newconfig.edge_location_mode != undefined) { edge_location_mode = this.newconfig.edge_location_mode; }

    tdiv2  = configdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "margin:3px 0px 0px 5px;");
    
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "edge location mode: ";
    tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\"edges have two locations for the left and right feature. choose features are to be displayed.\",250);");
    tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    var select = tdiv2.appendChild(document.createElement('select'));
    select.className = "dropdown";
    select.style.marginLeft = "3px";
    select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edge_location_mode', this.value);");
    var types = ["both features", "left feature", "right feature"];
    for(var i=0; i<types.length; i++) {
      var val1 = types[i];
      var option = select.appendChild(document.createElement('option'));
      option.value = val1;
      option.innerHTML = val1;
      if(val1 == edge_location_mode) { option.setAttribute("selected", "selected"); }
    }
  }
  
  var hr1 = configdiv.appendChild(document.createElement('hr'));
  hr1.width = "95%";

  //display_type
  var display_type = this.display_type;
  if(this.newconfig && this.newconfig.display_type != undefined) { display_type = this.newconfig.display_type; }
  tdiv2 = configdiv.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 5px;");
  span1.innerHTML = "display mode: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  //select.setAttribute("style", "font-size:10px;");
  select.className = "dropdown";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'display_type', this.value);");
  var types = ["manhattan plot", "chromosome view"];
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = select.appendChild(document.createElement('option'));
    option.value = val1;
    option.innerHTML = val1;
    if(val1 == display_type) { option.setAttribute("selected", "selected"); }
  }
  
  var feature_color_mode = this.feature_color_mode;
  if(this.newconfig && this.newconfig.feature_color_mode != undefined) { feature_color_mode = this.newconfig.feature_color_mode; }

  var chrom_view_options = configdiv.appendChild(document.createElement("div"));
  var datatype_options  = configdiv.appendChild(document.createElement("div"));
  var manhattan_options  = configdiv.appendChild(document.createElement("div"));
  chrom_view_options.style.display = "none";
  manhattan_options.style.display = "none";
  if(display_type=="chromosome view") { 
    chrom_view_options.style.display = "block";
    datatype_options.style.display = "none";    
    if(feature_color_mode == "signal") { datatype_options.style.display = "block"; }
  }
  if(display_type=="manhattan plot")  { 
    datatype_options.style.display = "block";    
    manhattan_options.style.display = "block";
  }

  //datatype select
  var tdiv  = datatype_options.appendChild(document.createElement('span'));
  tdiv.setAttribute('style', "margin: 3px 1px 0px 5px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "signal datatype: ";
  var dtypeSelect = tdiv.appendChild(document.createElement('select'));
  dtypeSelect.setAttribute('name', "datatype");
  dtypeSelect.className = "dropdown";
  dtypeSelect.style.fontSize = "10px";
  //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_datatype', this.value); return false");
  dtypeSelect.setAttribute("onselect", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_datatype', this.value); return false");
  var val1 = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { val1 = this.newconfig.signal_datatype; }
  var option = dtypeSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.setAttribute("selected", "selected");
  option.innerHTML = "please select datatype";
  for(var dtype in datasourceElement.datatypes) {
    var dtype_col = datasourceElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }
    var option = dtypeSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", dtype_col.datatype);
    if(val1 == dtype) { option.setAttribute("selected", "selected"); }
    option.innerHTML = dtype_col.title;
  }

  //
  //chromsome-view chrom_view_options
  //
  //expand_height_tofit
  tdiv2  = chrom_view_options.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.expand_height_tofit;
  if(this.newconfig && this.newconfig.expand_height_tofit != undefined) { 
    val1 = this.newconfig.expand_height_tofit; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'expand_height_tofit', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expand height to fit chromosomes";
  
  //hide_filtered_slots
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 20px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.hide_filtered_slots;
  if(this.newconfig && this.newconfig.hide_filtered_slots != undefined) { 
    val1 = this.newconfig.hide_filtered_slots; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'hide_filtered_slots', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide filtered slots";
  
  //
  //manhattan-plot manhattan_options
  //
  //yaxis_logscale
  if(display_type=="manhattan plot")  { 
    tdiv2  = manhattan_options.appendChild(document.createElement('div'));
    //tdiv2  = datatype_options.appendChild(document.createElement('span'));
    //tdiv2.style.display = "inline-block";
    tdiv2.style.marginLeft = "5px";
    tcheck = tdiv2.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
    tcheck.setAttribute('type', "checkbox");
    var val1 = this.yaxis_logscale;
    if(this.newconfig && this.newconfig.yaxis_logscale != undefined) { 
      val1 = this.newconfig.yaxis_logscale; 
    }
    if(val1) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_logscale', this.checked);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "y-axis logscale";

    tspan2  = tdiv2.appendChild(document.createElement('span'));
    //tspan2.style.display = "inline-block";
    tspan2.style.marginLeft = "5px";
    tcheck = tspan2.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
    tcheck.setAttribute('type', "checkbox");
    var val1 = this.hide_filtered_slots;
    if(this.newconfig && this.newconfig.hide_filtered_slots != undefined) { 
      val1 = this.newconfig.hide_filtered_slots; 
    }
    if(val1) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'hide_filtered_slots', this.checked);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "hide filtered";
  }
  
  //
  //feature_color_mode
  //
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin: 0px 0px 0px 5px; ");
  tspan.innerHTML = "coloring mode: ";

  //console.log("feature_color_mode : "+feature_color_mode);
  radio1 = tdiv2.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_feature_color_mode");
  radio1.setAttribute("value", "match_chrom");
  if(feature_color_mode == "match_chrom") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'feature_color_mode', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "match chrom color";
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_feature_color_mode");
  radio2.setAttribute("value", "fixed_color");
  if(feature_color_mode == "fixed_color") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'feature_color_mode', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "fixed color";

  /*
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_feature_color_mode");
  radio2.setAttribute("value", "density");
  if(feature_color_mode == "density") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'feature_color_mode', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "density";
  */
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_feature_color_mode");
  radio2.setAttribute("value", "signal");
  if(feature_color_mode == "signal") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'feature_color_mode', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "signal";

  var color_options_div = configdiv.appendChild(document.createElement('div'));
  color_options_div.setAttribute('style', "margin-top:2px;");

  if(feature_color_mode == "fixed_color") { 
    var fixed_color = this.fixed_color;
    if(this.newconfig && this.newconfig.fixed_color != undefined) { fixed_color = this.newconfig.fixed_color; }
    tspan2 = color_options_div.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "fixed color:";
    var colorInput = color_options_div.appendChild(document.createElement('input'));
    colorInput.setAttribute('value', fixed_color);
    colorInput.setAttribute('size', "7");
    colorInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'fixed_color', this.value);");
    colorInput.color = new jscolor.color(colorInput);
    color_options_div.appendChild(colorInput);
  }

  if(feature_color_mode == "signal") { 
    //add a color spectrum picker
    var uniqID = this.elementID+"_signalCSI";
    var signalCSI = this.signalCSI;
    if(!signalCSI) {
      signalCSI = zenbuColorSpaceInterface(uniqID);
      signalCSI.elementID = this.elementID;
      signalCSI.colorspace = this.signal_colorspace;
      signalCSI.enableScaling = true;
      signalCSI.min_signal = this.signal_min;
      signalCSI.max_signal = this.signal_max;
      signalCSI.logscale = this.signal_logscale;
      signalCSI.callOutFunction = zenbuGenomeWideElement_signal_CSI_callback;
      this.signalCSI = signalCSI;
    }
    zenbuColorSpaceInterfaceUpdate(uniqID);
    color_options_div.appendChild(signalCSI);

    /*
    //datatype select
    var tdiv  = color_options_div.appendChild(document.createElement('div'));
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "datatype:";
    var dtypeSelect = tdiv.appendChild(document.createElement('select'));
    dtypeSelect.setAttribute('name', "datatype");
    dtypeSelect.className = "dropdown";
    dtypeSelect.style.fontSize = "10px";
    //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_datatype', this.value); return false");
    dtypeSelect.setAttribute("onselect", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_datatype', this.value); return false");
    var val1 = this.signal_datatype;
    if(this.newconfig && this.newconfig.signal_datatype != undefined) { val1 = this.newconfig.signal_datatype; }
    for(var dtype in datasourceElement.datatypes) {
      var dtype_col = datasourceElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }
      var option = dtypeSelect.appendChild(document.createElement('option'));
      option.setAttribute("value", dtype_col.datatype);
      if(val1 == dtype) { option.setAttribute("selected", "selected"); }
      option.innerHTML = dtype_col.title;
    }
    */
  }
  
  //focus_chrom_percent
  /*
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var val1 = this.focus_chrom_percent;
  if(this.newconfig && this.newconfig.focus_chrom_percent != undefined) { 
    val1 = this.newconfig.focus_chrom_percent; 
  }
  var span3 = tdiv2.appendChild(document.createElement('span'));
  span3.setAttribute('style', "margin-left: 5px; ");
  var tspan = span3.appendChild(document.createElement('span'));
  tspan.innerHTML = "focus chrom percent: ";
  var input = span3.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', val1);
  input.setAttribute("onchange", "reportElementReconfigParam(\""+this.elementID+"\", 'focus_chrom_percent', this.value);");
  */

  configdiv.appendChild(document.createElement('hr'));

  return configdiv;
}


function zenbuGenomeWideElement_genome_select_callback(genomeWidget) {
  console.log("zenbuGenomeWideElement_genome_select_callback");
  if(!genomeWidget) { return; }
  var name = genomeWidget.name;
  if(name == "all") { name = ""; }
  reportElementReconfigParam(genomeWidget.elementID, 'assembly_name', name);
}


function zenbuGenomeWideElement_signal_CSI_callback(uniqID, mode, param, value, altvalue) {
  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];
  if(zenbuCSI == null) { return; }
  var elementID = uniqID;
  if(zenbuCSI.elementID) { elementID = zenbuCSI.elementID; }
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  if(mode=="reconfig_param") {
    reportElementReconfigParam(elementID, "reconfig_param", "", "");
  }
}

//=================================================================================
//
// helper functions
//
//=================================================================================

function reports_genomewide_featureloc_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  if(a.chrom_name_index && !b.chrom_name_index) { return -1; }
  if(!a.chrom_name_index && b.chrom_name_index) { return 1; }
  if(a.chrom_name_index > b.chrom_name_index) { return 1; }
  if(a.chrom_name_index < b.chrom_name_index) { return -1; }
  if(b.chrom > a.chrom) { return -1; }
  if(b.chrom < a.chrom) { return 1; }

  if(a.start < b.start) { return -1; }
  if(a.start > b.start) { return 1; }
  if(a.end < b.end) { return -1; }
  if(a.end > b.end) { return 1; }
  return 0;
}

function reports_genomewide_edge_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.selected) { return 1; }
  if(b.selected) { return -1; }

  if(a.filter_valid && !b.filter_valid) { return 1; }
  if(b.filter_valid && !a.filter_valid) { return -1; }

  var af2 = a.feature2;
  var bf2 = b.feature2;
  if(!af2) { return 1; }
  if(!bf2) { return -1; }
  
  if(af2.id < bf2.id) { return -1; }
  if(af2.id > bf2.id) { return  1; }

  var af1 = a.feature1;
  var bf1 = b.feature1;
  if(!af1) { return 1; }
  if(!bf1) { return -1; }
  if(af1.id < bf1.id) { return -1; }
  if(af1.id > bf1.id) { return  1; }

  return 0;
}


function reports_genomewide_chrom_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  //if(a.filtered && !b.filtered) { return -1; }
  //if(!a.filtered && b.filtered) { return 1; }

  if(a.name_index && !b.name_index) { return -1; }
  if(!a.name_index && b.name_index) { return 1; }
  if(a.name_index > b.name_index) { return 1; }
  if(a.name_index < b.name_index) { return -1; }

  //if(b.chrom_length > a.chrom_length) { return 1; }
  //if(b.chrom_length < a.chrom_length) { return -1; }
  if(b.chrom_name > a.chrom_name) { return -1; }
  if(b.chrom_name < a.chrom_name) { return 1; }
  return 0;
}

