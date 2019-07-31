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

//var element = new ZenbuChartElement();

function ZenbuChartElement(elementID) {
  //create empty, uninitialized Category report-element object
  console.log("create ZenbuChartElement");
  this.element_type = "chart";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  
  this.title_prefix = "";
  this.title = "new Chart Graph";
  //this.datasource_mode = "";
  this.display_type = "bubble";
  this.focus_feature_mode = "current";  //"ignore", "progressive"
  this.legend_group_mode = "focus_feature";

  this.bar_orientation = "vertical";
  this.bar_order = "original"; //["original", "signal descending", "signal ascending"]; //"metadata label";
  this.show_bar_labels = false;
  this.stacked = false;

  this.category_datatype = "";
  this.hide_zero = true;
  this.category_method = "count";
  this.ctg_value_datatype = "";
  this.colorspace = "#00A0FF";

  this.symetric_axis = false;
  this.xaxis = { datatype: "", fixedscale:true, symetric: true, log:false, feature_name:"" };
  this.yaxis = { datatype: "", fixedscale:true, symetric: true, log:false, feature_name:"" };
  this.zaxis = { datatype: "", fixedscale:true, symetric: true, log:false, feature_name:"" };
  
  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;

  //methods
  this.initFromConfigDOM  = zenbuChartElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuChartElement_generateConfigDOM;  //returns a ConfigDOM object
  
  this.elementEvent       = zenbuChartElement_elementEvent;
  this.reconfigureParam   = zenbuChartElement_reconfigureParam;

  this.resetElement       = zenbuChartElement_reset;
  this.postprocessElement = zenbuChartElement_postprocess;
  this.drawElement        = zenbuChartElement_draw;
  this.configSubpanel     = zenbuChartElement_configSubpanel;
  this.showSelections     = zenbuChartElement_showSelections;
  
  //internal methods
  this.configBubbleChart        = zenbuChartElement_configBubbleChart;
  this.configBarChart           = zenbuChartElement_configBarChart;
  this.configPlotly3D           = zenbuChartElement_configPlotly3D;
  this.configLegendGroupMode    = zenbuChartElement_configLegendGroupMode;
  
  this.postprocessBubbleChart      = zenbuChartElement_postprocessBubbleChart;
  this.postprocessPlotly         = zenbuChartElement_postprocessPlotly
  this.postprocessLegendCategory   = zenbuChartElement_postprocessLegendCategory;
  this.postprocessBarChart         = zenbuChartElement_postprocessBarChart;
  this.prepareBarChartSignal       =  zenbuChartElement_prepareBarChartSignal;
  this.createBarChartDataset       = zenbuChartElement_createBarChartDataset;
  
  this.renderBubbleChart        = zenbuChartElement_renderBubbleChart;
  this.drawBarChart             = zenbuChartElement_drawBarChart;
  this.drawPlotly3D             = ZenbuChartElement_drawPlotly3D;
  this.drawPlotlyTernary        = ZenbuChartElement_drawPlotlyTernary;
  
  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================
//TODO: need to figure this out, not currently using

function zenbuChartElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "chart") { return false; }
  
  //eventually maybe a superclass init call here
  
  this.focus_feature_mode = "current";
  this.legend_group_mode = "focus_feature";
  this.symetric_axis = false;
  this.category_datatype = "";
  this.hide_zero = true;

  if(elementDOM.getAttribute("chart_type")) { this.display_type = elementDOM.getAttribute("chart_type"); }
  if(elementDOM.getAttribute("display_type")) { this.display_type = elementDOM.getAttribute("display_type"); }
  //if(elementDOM.getAttribute("layout_type")) { this.layout_type = elementDOM.getAttribute("layout_type"); }
  if(elementDOM.getAttribute("dual_feature_axis") == "1") { this.focus_feature_mode = "progressive"; }  //backward compat
  if(elementDOM.getAttribute("symetric_axis") == "1") { this.symetric_axis = true; }
  if(elementDOM.getAttribute("focus_feature_mode")) { this.focus_feature_mode = elementDOM.getAttribute("focus_feature_mode"); }
  if(elementDOM.getAttribute("legend_group_mode")) { this.legend_group_mode = elementDOM.getAttribute("legend_group_mode"); }
  if(elementDOM.getAttribute("category_datatype")) { this.category_datatype = elementDOM.getAttribute("category_datatype"); }
  if(elementDOM.getAttribute("hide_zero") == "true") { this.hide_zero = true; }
  if(elementDOM.getAttribute("colorspace"))        { this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("bar_orientation")) { this.bar_orientation = elementDOM.getAttribute("bar_orientation"); }
  if(elementDOM.getAttribute("bar_order")) { this.bar_order = elementDOM.getAttribute("bar_order"); }
  if(elementDOM.getAttribute("show_bar_labels")) { this.show_bar_labels = elementDOM.getAttribute("show_bar_labels"); }
  if(elementDOM.getAttribute("stacked")) { this.stacked = elementDOM.getAttribute("stacked"); }
  
  var xaxisDOM = elementDOM.getElementsByTagName("chart_xaxis")[0];
  if(xaxisDOM) {
    if(xaxisDOM.getAttribute("datatype")) { this.xaxis.datatype = xaxisDOM.getAttribute("datatype"); }
    if(xaxisDOM.getAttribute("fixedscale") == "1") { this.xaxis.fixedscale = true; } else { this.xaxis.fixedscale = false; }
    if(xaxisDOM.getAttribute("symetric") == "1") { this.xaxis.symetric = true; } else { this.xaxis.symetric = false; }
    if(xaxisDOM.getAttribute("log") == "1") { this.xaxis.log = true; } else { this.xaxis.log = false; }
  }
  var yaxisDOM = elementDOM.getElementsByTagName("chart_yaxis")[0];
  if(yaxisDOM) {
    if(yaxisDOM.getAttribute("datatype")) { this.yaxis.datatype = yaxisDOM.getAttribute("datatype"); }
    if(yaxisDOM.getAttribute("fixedscale") == "1") { this.yaxis.fixedscale = true; } else { this.yaxis.fixedscale = false; }
    if(yaxisDOM.getAttribute("symetric") == "1") { this.yaxis.symetric = true; } else { this.yaxis.symetric = false; }
    if(yaxisDOM.getAttribute("log") == "1") { this.yaxis.log = true; } else { this.yaxis.log = false; }
  }
  var zaxisDOM = elementDOM.getElementsByTagName("chart_zaxis")[0];
  if(zaxisDOM) {
    if(zaxisDOM.getAttribute("datatype")) { this.zaxis.datatype = zaxisDOM.getAttribute("datatype"); }
    if(zaxisDOM.getAttribute("fixedscale") == "1") { this.zaxis.fixedscale = true; } else { this.zaxis.fixedscale = false; }
    if(zaxisDOM.getAttribute("symetric") == "1") { this.zaxis.symetric = true; } else { this.zaxis.symetric = false; }
    if(zaxisDOM.getAttribute("log") == "1") { this.zaxis.log = true; } else { this.zaxis.log = false; }
  }
  return true;
}


function zenbuChartElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.chart_type) { elementDOM.setAttribute("chart_type", this.chart_type); }
  if(this.display_type) { elementDOM.setAttribute("display_type", this.display_type); }
  if(this.focus_feature_mode) { elementDOM.setAttribute("focus_feature_mode", this.focus_feature_mode); }
  if(this.legend_group_mode) { elementDOM.setAttribute("legend_group_mode", this.legend_group_mode); }
  if(this.symetric_axis) { elementDOM.setAttribute("symetric_axis", 1); }
  if(this.layout_type) { elementDOM.setAttribute("layout_type", this.layout_type); }
  if(this.category_datatype) { elementDOM.setAttribute("category_datatype", this.category_datatype); }
  if(this.hide_zero) { elementDOM.setAttribute("hide_zero", "true"); }
  if(this.colorspace) { elementDOM.setAttribute("colorspace", this.colorspace); }
  if(this.bar_orientation) { elementDOM.setAttribute("bar_orientation", this.bar_orientation); }
  if(this.bar_order) { elementDOM.setAttribute("bar_order", this.bar_order); }
  if(this.show_bar_labels) { elementDOM.setAttribute("show_bar_labels", this.show_bar_labels); }
  if(this.stacked) { elementDOM.setAttribute("stacked", this.stacked); }

  var xaxis = document.createElement("chart_xaxis");
  xaxis.setAttribute("datatype", this.xaxis.datatype);
  if(this.xaxis.fixedscale) { xaxis.setAttribute("fixedscale", 1); } else { xaxis.setAttribute("fixedscale", 0); }
  if(this.xaxis.symetric)   { xaxis.setAttribute("symetric", 1); }   else { xaxis.setAttribute("symetric", 0); }
  if(this.xaxis.log)        { xaxis.setAttribute("log", 1); }        else { xaxis.setAttribute("log", 0); }
  elementDOM.appendChild(xaxis);
  
  var yaxis = document.createElement("chart_yaxis");
  yaxis.setAttribute("datatype", this.yaxis.datatype);
  if(this.yaxis.fixedscale) { yaxis.setAttribute("fixedscale", 1); } else { yaxis.setAttribute("fixedscale", 0); }
  if(this.yaxis.symetric)   { yaxis.setAttribute("symetric", 1); }   else { yaxis.setAttribute("symetric", 0); }
  if(this.yaxis.log)        { yaxis.setAttribute("log", 1); }        else { yaxis.setAttribute("log", 0); }
  elementDOM.appendChild(yaxis);
  
  var zaxis = document.createElement("chart_zaxis");
  zaxis.setAttribute("datatype", this.zaxis.datatype);
  if(this.zaxis.fixedscale) { zaxis.setAttribute("fixedscale", 1); } else { zaxis.setAttribute("fixedscale", 0); }
  if(this.zaxis.symetric)   { zaxis.setAttribute("symetric", 1); }   else { zaxis.setAttribute("symetric", 0); }
  if(this.zaxis.log)        { zaxis.setAttribute("log", 1); }        else { zaxis.setAttribute("log", 0); }
  elementDOM.appendChild(zaxis);

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuChartElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this;
  //if(this.datasourceElementID) {
  //  var ds = current_report.elements[this.datasourceElementID];
  //  if(ds) { datasourceElement = ds; }
  //  else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  //}
}


function zenbuChartElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  if(param == "display_type") { 
    this.newconfig.display_type = value;
    this.chart_data = null;
    this.chart = null;
  }
  
  if(param == "focus_feature_mode") { this.newconfig.focus_feature_mode = value; }  
  if(param == "legend_group_mode")  { this.newconfig.legend_group_mode = value; }  
  if(param == "category_datatype")  { this.newconfig.category_datatype = value; }
  if(param == "hide_zero")          { this.newconfig.hide_zero = value; }
  if(param == "colorspace")         { this.newconfig.colorspace = value; }
  if(param == "bar_orientation")    { this.newconfig.bar_orientation = value; }
  if(param == "bar_order")          { this.newconfig.bar_order = value; }
  if(param == "show_bar_labels")    { this.newconfig.show_bar_labels = value; }
  if(param == "stacked")            { this.newconfig.stacked = value; }
  if(param == "signal_columns_div_visible") {
    this.newconfig.signal_columns_div_visible = !this.newconfig.signal_columns_div_visible;
  }
  
  if(param == "xaxis_fixedscale") { this.newconfig.xaxis_fixedscale = value; if(!value) { this.newconfig.xaxis_symetric=false; } }
  if(param == "xaxis_symetric")   { this.newconfig.xaxis_symetric = value; if(value) { this.newconfig.xaxis_fixedscale=true; } }
  if(param == "xaxis_log")        { this.newconfig.xaxis_log = value; }
  
  if(param == "yaxis_fixedscale") { this.newconfig.yaxis_fixedscale = value; if(!value) { this.newconfig.yaxis_symetric=false; } }
  if(param == "yaxis_symetric")   { this.newconfig.yaxis_symetric = value; if(value) { this.newconfig.yaxis_fixedscale=true; } }
  if(param == "yaxis_log")        { this.newconfig.yaxis_log = value; }
  
  if(param == "zaxis_fixedscale") { this.newconfig.zaxis_fixedscale = value; if(!value) { this.newconfig.zaxis_symetric=false; } }
  if(param == "zaxis_symetric")   { this.newconfig.zaxis_symetric = value; if(value) { this.newconfig.zaxis_fixedscale=true; } }
  if(param == "zaxis_log")        { this.newconfig.zaxis_log = value; }
  
  if(param == "accept-reconfig") {
    var reload = this.newconfig.needReload;
    if(this.newconfig.hide_zero !== undefined) { this.hide_zero = this.newconfig.hide_zero; }
    if(this.newconfig.category_datatype !== undefined) { this.category_datatype = this.newconfig.category_datatype; reload=true; }
    if(this.newconfig.colorspace !== undefined) { this.colorspace = this.newconfig.colorspace; reload=true; }
    if(this.newconfig.focus_feature_mode !== undefined) { this.focus_feature_mode = this.newconfig.focus_feature_mode; reload=true; }
    if(this.newconfig.legend_group_mode !== undefined) { this.legend_group_mode = this.newconfig.legend_group_mode; reload=true; }
    if(this.newconfig.bar_orientation !== undefined) { this.bar_orientation = this.newconfig.bar_orientation; reload=true; }
    if(this.newconfig.bar_order !== undefined) { this.bar_order = this.newconfig.bar_order; reload=true; }
    if(this.newconfig.show_bar_labels !== undefined) { this.show_bar_labels = this.newconfig.show_bar_labels; reload=true; }
    if(this.newconfig.stacked !== undefined) { this.stacked = this.newconfig.stacked; reload=true; }
  
    if(this.newconfig.xaxis_fixedscale !== undefined) { this.xaxis.fixedscale = this.newconfig.xaxis_fixedscale; this.chart=null; }
    if(this.newconfig.xaxis_symetric !== undefined)   { this.xaxis.symetric = this.newconfig.xaxis_symetric; this.chart=null; }
    if(this.newconfig.xaxis_log !== undefined)        { this.xaxis.log = this.newconfig.xaxis_log; this.chart=null; }
    if(this.newconfig.yaxis_fixedscale !== undefined) { this.yaxis.fixedscale = this.newconfig.yaxis_fixedscale; this.chart=null; }
    if(this.newconfig.yaxis_symetric !== undefined)   { this.yaxis.symetric = this.newconfig.yaxis_symetric; this.chart=null; }
    if(this.newconfig.yaxis_log !== undefined)        { this.yaxis.log = this.newconfig.yaxis_log; this.chart=null; }
    if(this.newconfig.zaxis_fixedscale !== undefined) { this.zaxis.fixedscale = this.newconfig.zaxis_fixedscale; this.chart=null; }
    if(this.newconfig.zaxis_symetric !== undefined)   { this.zaxis.symetric = this.newconfig.zaxis_symetric; this.chart=null; }
    if(this.newconfig.zaxis_log !== undefined)        { this.zaxis.log = this.newconfig.zaxis_log; this.chart=null; }

    if(this.colorspaceCSI) {
      var CSI = this.colorspaceCSI;
      if(CSI.newconfig.colorspace != undefined) { this.colorspace = CSI.newconfig.colorspace; reload=true; }
      if(CSI.newconfig.colorspace == "single-color") { this.colorspace = CSI.newconfig.single_color; reload=true; }
      if(CSI.newconfig.min_signal != undefined) { this.colorspace_min = CSI.newconfig.min_signal; reload=true; }
      if(CSI.newconfig.max_signal != undefined) { this.colorspace_max = CSI.newconfig.max_signal; reload=true; }
      if(CSI.newconfig.logscale != undefined)   { this.colorspace_logscale = CSI.newconfig.logscale; reload=true; }
      console.log("accept-reconfig with colorspaceCSI color interface new colorspace:"+this.colorspace);
    }
    this.newconfig.needReload = reload;
  }
}


//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuChartElement_reset() {
  console.log("zenbuChartElement_reset ["+this.elementID+"]");

  this.x_feature = null;
  this.y_feature = null;
  this.target_array = null;

  this.max_value = 0;
  this.chart_point_count = 0;

  this.chart_data = null;
  this.chart = null;
}


function zenbuChartElement_postprocess() {
  var starttime = new Date();
  //query just returned data for a new focus_feature
  //need to search through connected features for the EntrezGene and starting target

  if(this.display_type=="3D") { this.display_type = "scatter3D"; } //backward compatability

  var datasourceElement = this;
  if(this.datasourceElementID) {
    datasourceElement = current_report.elements[this.datasourceElementID];
    this.datasourceElement = datasourceElement;
    this.loading = datasourceElement.loading;
  }
  if(!datasourceElement) { return; }

  if(this.dependant_timestamp != datasourceElement.loaded_timestamp) {
    this.dependant_timestamp = datasourceElement.loaded_timestamp;
    this.x_feature = null;
    this.y_feature = null;
    this.focus_feature = null;
    this.prev_focus_feature = null;
    console.log("zenbuChartElement_postprocess ["+ this.elementID + "] dependance out of data, refresh");
  }

  if(datasourceElement.focus_feature && (!this.focus_feature || (this.focus_feature.id != datasourceElement.focus_feature.id))) {
    //console.log("zenbuChartElement_postprocess selected feature ["+ datasourceElement.focus_feature.name+"]");
    this.prev_focus_feature = this.focus_feature;
    this.focus_feature = datasourceElement.focus_feature;
  }

  if(datasourceElement.datasource_mode == "edge") {
    if(this.focus_feature_mode=="progressive") {
      //search through the target_element features for the ASOs
      if(!this.prev_focus_feature) {
        for(var k=0; k<datasourceElement.feature_array.length; k++) {
          var feature = datasourceElement.feature_array[k];
          if(!feature) { continue; }
          if(feature.f1_edge_count == 0) { continue; }

          if(!this.focus_feature) { this.focus_feature = feature; }
          if(!this.prev_focus_feature && (this.focus_feature.id != feature.id)) { this.prev_focus_feature = feature; }
        }
      }
      if(this.prev_focus_feature) {
        console.log("ASOconcordance prev selected ASO ["+ this.prev_focus_feature.name+"]");
      }

      if(this.focus_feature)      { this.x_feature = this.focus_feature; }
      if(this.prev_focus_feature) { this.y_feature = this.prev_focus_feature; }

      if(this.x_feature && this.y_feature) {
        this.title = this.title_prefix + this.x_feature.name +" - "+ this.y_feature.name;
      }
    } 
    else if(this.focus_feature_mode=="current") {
      this.x_feature = this.focus_feature;
      this.y_feature = this.focus_feature;
      //this.chart = null;
      //this.chart_data = null;
      if(this.x_feature) {
        this.title = this.title_prefix + this.x_feature.name;
      }
    }
  }
  
  if(this != datasourceElement) {
    //copy feature_array / edge_array into this (shares feature/edge objects, but array and sort and be different)
    var t0 = performance.now();
    if(datasourceElement.datasource_mode == "feature") {
      this.feature_array = new Array(); 
      for(j=0; j<datasourceElement.feature_array.length; j++) {
        var feature = datasourceElement.feature_array[j];
        if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !feature.search_match) { continue; }
        if(feature) { this.feature_array.push(feature); }
      }
      var t1 = performance.now();
      console.log("copy feature_array from datasourceElement to this " + (t1 - t0) + " msec.");
    }
    if(datasourceElement.datasource_mode == "edge") {
      this.edge_array = new Array(); 
      for(j=0; j<datasourceElement.edge_array.length; j++) {
        var edge = datasourceElement.edge_array[j];
        if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
        if(edge) { this.edge_array.push(edge); }
      }
      var t1 = performance.now();
      console.log("copy edge_array from datasourceElement to this " + (t1 - t0) + " msec.");
    }
  }

  if((this.legend_group_mode == "category_mdata") && this.category_datatype) { this.postprocessLegendCategory(); }
  
  if(this.display_type == "bubble") {
    this.postprocessBubbleChart();
  }
  if(this.display_type == "bar" || this.display_type == "line") {
    this.postprocessBarChart();
  }
  if((this.display_type == "scatter3D") || (this.display_type == "ternary")) {
    this.postprocessPlotly();
  }

  var logmsg = "zenbuChartElement_postprocess ["+ this.elementID + "]";
  //if(this.x_feature) { logmsg += " featureX[" + this.x_feature.id +" , "+this.x_feature.name +"]"; }
  //if(this.y_feature && (this.x_feature.id != this.y_feature.id)) { logmsg += " featureY[" + this.x_feature.id +" , "+this.x_feature.name +"]"; }
  if(this.x_feature) { logmsg += " featureX[" + this.x_feature.name +"]"; }
  if(this.x_feature && this.y_feature && (this.x_feature.id != this.y_feature.id)) { logmsg += " featureY["+ this.y_feature.name +"]"; }
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  logmsg += " "+(runtime)+"msec";
  console.log(logmsg);
}


function zenbuChartElement_postprocessBubbleChart() {
  //query just returned data for a new focus_feature
  //need to search through connected features for the EntrezGene and starting target

  var t0 = performance.now();

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  //backward compatability hack for converting axis.datatype to signal_active
  if(!this.backward_compat_check_dataypes) {
    this.backward_compat_check_dataypes = true;
    var dtype_col = this.datatypes[this.xaxis.datatype];
    if(dtype_col && !dtype_col.signal_active) {
      console.log("backcompat: bubble chart set x-axis ["+this.xaxis.datatype+"] to first signal_active");
      dtype_col.signal_active=true;
      dtype_col.user_modifiable=true;
      dtype_col.signal_order = 0.1;
    }
    var dtype_col = this.datatypes[this.yaxis.datatype];
    if(dtype_col && !dtype_col.signal_active) {
      console.log("backcompat: bubble chart set y-axis ["+this.yaxis.datatype+"] to second signal_active");
      dtype_col.signal_active=true; 
      dtype_col.user_modifiable=true; 
      dtype_col.signal_order = 0.2;
    }
  }
  
  //new version which sets the axis datatypes from order of signal_active datatypes
  this.dtype_columns.sort(signal_column_order_sort_func);
  var xaxis_dtype = null;
  var yaxis_dtype = null;
  for(var i=0; i<this.dtype_columns.length; i++) {
    var dtype_col = this.dtype_columns[i];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "signal") && (dtype_col.col_type != "weight")) { continue; }
    if(!dtype_col.signal_active) { continue; }
    if(!xaxis_dtype) { 
      xaxis_dtype = dtype_col;
      this.xaxis.datatype = dtype_col.datatype; //reset for other code usage, axis label....
      console.log("first signal_active dtype_col["+dtype_col.datatype+"] - dominant for sorting");
    } 
    else if(!yaxis_dtype) { 
      yaxis_dtype = dtype_col;
      this.yaxis.datatype = dtype_col.datatype; //reset for other code usage, axis label....
      console.log("first signal_active dtype_col["+dtype_col.datatype+"] - dominant for sorting");
    }
  }
  if(!xaxis_dtype || !yaxis_dtype) { return; }
  //if((signal_dtype.col_type != "signal") && (signal_dtype.col_type != "weight")) { return; } //might loosen this in the future
  console.log("x-axis_dtype type["+xaxis_dtype.datatype+"]  title["+xaxis_dtype.title+"]")
  console.log("y-axis_dtype type["+yaxis_dtype.datatype+"]  title["+yaxis_dtype.title+"]")
  
  //if((datasourceElement.datasource_mode=="edge") && (!this.x_feature || !this.y_feature)) { return; }

  //make the Chart.js bubble datasources
  var both_data = new Object;
  var opposite_data = new Object;
  var featureX_data = new Object;
  var featureY_data = new Object;
  var neither_data = new Object;
  var category_data_hash = new Object; //hash of data-objs

  if(!this.chart_data) {
    console.log("chart ["+this.elementID+"] rebuild chart_data");
    this.chart_data = new Object;
    this.chart_data.datasets = new Array;

    //make the dataset categories
    both_data = new Object;
    both_data.zenbuid = "both";
    both_data.label = "both";
    both_data.backgroundColor = "#F8A12A"; //FF0000
    both_data.hoverBackgroundColor = "#F8A12A";
    //this.chart_data.datasets.push(both_data);

    opposite_data = new Object;
    opposite_data.zenbuid = "opposite";
    opposite_data.label = "opposite";
    opposite_data.backgroundColor = "#E30004"; //800080
    opposite_data.hoverBackgroundColor = "#E30004";
    //this.chart_data.datasets.push(opposite_data);

    featureX_data = new Object;
    featureX_data.zenbuid = "featureX";
    featureX_data.label = "featureX";
    featureX_data.backgroundColor = "#008000";
    featureX_data.hoverBackgroundColor = "#008000";
    //featureX_data.hidden =  true;
    //this.chart_data.datasets.push(featureX_data);

    featureY_data = new Object;
    featureY_data.zenbuid = "featureY";
    featureY_data.label = "featureY";
    featureY_data.backgroundColor = "#0000FF";
    //featureY_data.hidden = true;
    featureY_data.hoverBackgroundColor = "#0000FF";
    //this.chart_data.datasets.push(featureY_data);

    neither_data = new Object;
    neither_data.zenbuid = "neither";
    neither_data.label = "filtered out";
    neither_data.backgroundColor = "#808080";
    neither_data.hoverBackgroundColor = "#808080";
    //neither_data.hidden = true;
    //this.chart_data.datasets.push(neither_data);
    
    if((this.legend_group_mode == "category_mdata") && this.category_datatype && this.category_selected_dtype) {
      var categories = this.category_selected_dtype.categories;
      var idx1=0;
      for(var ctg in categories) {
        var ctg_obj = categories[ctg];
        //{ctg:ctgval, count:0, value:null, filtered:false}; }

        console.log("create category chart "+ctg_obj.ctg);
        var color = zenbuIndexColorSpace(this.colorspace, idx1++);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11
        
        dataset = new Object;
        dataset.zenbuid = "category";
        dataset.category = ctg_obj.ctg;
        dataset.label = ctg_obj.ctg;
        dataset.backgroundColor = color.getCSSHexadecimalRGB();
        dataset.hoverBackgroundColor = color.getCSSHexadecimalRGB();
        //dataset.hidden = true;
  
        category_data_hash[ctg_obj.ctg] = dataset;
        this.chart_data.datasets.push(dataset);
      }
      this.chart_data.datasets.push(neither_data);
    }

    //new logic for choosing which datasets to include into the chart_data
    if(this.legend_group_mode == "focus_feature") {
      if(datasourceElement.datasource_mode=="feature") {
        this.chart_data.datasets.push(both_data);
        both_data.label = "active";
        this.chart_data.datasets.push(neither_data);
      }
      if(datasourceElement.datasource_mode=="edge") {
        if(this.focus_feature_mode=="progressive") {
          this.chart_data.datasets.push(both_data);
          this.chart_data.datasets.push(opposite_data);
        }
        this.chart_data.datasets.push(featureX_data);
        if(this.focus_feature_mode=="progressive") {
          this.chart_data.datasets.push(featureY_data);
        }
        this.chart_data.datasets.push(neither_data);
      }
    }
    
  } 
  else {
    this.chart_data.datasets.forEach(function(data) {
      if(data.zenbuid == "both")     { both_data = data; }
      if(data.zenbuid == "opposite") { opposite_data = data; }
      if(data.zenbuid == "neither")  { neither_data = data; }
      if(data.zenbuid == "featureX") { featureX_data = data; }
      if(data.zenbuid == "featureY") { featureY_data = data; }
      if(data.zenbuid == "category") { category_data_hash[data.category] = data; }
    });
  }

  both_data.data = new Array;
  opposite_data.data = new Array;
  featureX_data.data = new Array;
  featureY_data.data = new Array;
  neither_data.data = new Array;
  for(var ctg in category_data_hash) { category_data_hash[ctg].data = new Array; }

  this.max_value = 0;
  this.xaxis.min_value = -1;
  this.xaxis.max_value = 1;
  this.yaxis.min_value = -1;
  this.yaxis.max_value = 1;
  this.xaxis.feature_name = "";
  this.yaxis.feature_name = "";

  featureX_data.label = this.title_prefix; 
  featureY_data.label = "featureY";
  if(this.x_feature && this.y_feature) {
    featureX_data.label = this.x_feature.name;
    featureY_data.label = this.y_feature.name;
    this.xaxis.feature_name = this.x_feature.name;
    this.yaxis.feature_name = this.y_feature.name;
    if(this.x_feature.id == this.y_feature.id) {
      featureX_data.backgroundColor = "#F8A12A";
      featureX_data.hoverBackgroundColor = "#F8A12A";
    }
  }

  //console.log("chart_data.datasets "+ this.chart_data.datasets.length + " categories");
  
  if(datasourceElement.datasource_mode == "feature") {    
    //datasourceElement.feature_array.sort(reports_edge_feature2_sort_func);

    var t1 = performance.now();
    //console.log("after sort " + (t1 - t0) + " msec.");

    //var gene_2_aso_hash = new Object;
    var current_point = new Object;
    var feature_count = datasourceElement.feature_array.length;
    //console.log(edge_count + " edges to process");
    //console.log("datatype ["+this.datatype+"]");
    var point_count = 0;
    for(var feat_idx=0; feat_idx<feature_count; feat_idx++) {
      var feature = datasourceElement.feature_array[feat_idx];
      if(!feature) { continue; }
      if(!feature.expression_hash) { continue; }

      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

      current_point = new Object;
      current_point.x = 0.0;
      current_point.y = 0.0;
      current_point.r = 3;
      current_point.feature_id = feature.id;
      current_point.feature_idx = feat_idx;
      current_point.search_match = false;
      current_point.selected = false;
      
      if(feature.search_match) { current_point.search_match = true; }  

      //Xaxis
      var signal = 0.0;
      if(this.xaxis.datatype == "bedscore") {
        signal = parseFloat(feature.score);
      }
      if(feature.expression_hash[this.xaxis.datatype] && feature.expression_hash[this.xaxis.datatype][0]) {
        signal = feature.expression_hash[this.xaxis.datatype][0].total;
      }
      if(this.xaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }      
      current_point.x = signal.toPrecision(5);
      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }
      if(point_count == 0) {
        this.xaxis.min_value = signal;
        this.xaxis.max_value = signal;
      }
      if(signal > this.xaxis.max_value) { this.xaxis.max_value = signal; }
      if(signal < this.xaxis.min_value) { this.xaxis.min_value = signal; }
      //console.log("aso1 signal ["+signal+"]");

      //Yaxis
      var signal = 0.0;
      if(this.yaxis.datatype == "bedscore") {
        signal = parseFloat(feature.score);
      }
      if(feature.expression_hash[this.yaxis.datatype] && feature.expression_hash[this.yaxis.datatype][0]) {
        signal = feature.expression_hash[this.yaxis.datatype][0].total;
      }
      if(this.yaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }
      current_point.y = signal.toPrecision(5);
      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }

      if(point_count == 0) {
        this.yaxis.min_value = signal;
        this.yaxis.max_value = signal;
      }
      if(signal > this.yaxis.max_value) { this.yaxis.max_value = signal; }
      if(signal < this.yaxis.min_value) { this.yaxis.min_value = signal; }
      //console.log("featureY signal ["+signal+"]");

      //add point to correct dataset based on filter_valid
      //if(feature.filter_valid) { both_data.data.push(current_point); }
      if(feature.filter_valid) { 
        if(this.legend_group_mode == "focus_feature") { both_data.data.push(current_point); }
        if(this.legend_group_mode == "category_mdata") {
          ctg = zenbuChartElement_get_category(this.category_datatype, feature);
          if(category_data_hash[ctg]) { category_data_hash[ctg].data.push(current_point); }
          else { neither_data.data.push(current_point); }
        }
      } 
      else { neither_data.data.push(current_point); }
      point_count++;
    }
  }

  
  if(datasourceElement.datasource_mode == "edge") {
    //need to pair up DE-effected-genes to their ASOs
    //do this by sorting by features and then all the effectors in next to each other
    datasourceElement.edge_array.sort(reports_edge_feature2_sort_func);

    var t1 = performance.now();
    //console.log("after sort " + (t1 - t0) + " msec.");

    //var gene_2_aso_hash = new Object;
    var current_feature = null;
    var current_point = new Object;
    var edge_count = datasourceElement.edge_array.length;
    //console.log(edge_count + " edges to process");
    //console.log("datatype ["+this.datatype+"]");
    var point_count = 0;
    for(var edge_idx=0; edge_idx<edge_count; edge_idx++) {
      var edge = datasourceElement.edge_array[edge_idx];
      if(!edge) { continue; }
      if(!edge.feature2) { continue; }
      if(!edge.feature1) { continue; }

      if(this.x_feature && this.y_feature && (edge.feature1_id != this.x_feature.id) && (edge.feature1_id != this.y_feature.id)) { continue; }

      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !edge.search_match) { continue; }

      //if(!current_feature) { current_feature = edge.feature2; }
      if(!current_feature || !this.x_feature || (current_feature.id != edge.feature2.id)) {
        //finished with previous point
        //if((current_point.x != 0.0) && (current_point.y != 0.0)) {
        if((current_point.x) || (current_point.y)) {
          if((!this.x_feature && !this.y_feature) || (this.x_feature.id == this.y_feature.id)) {
            if(current_point.x_pass) {
              if(this.legend_group_mode == "focus_feature") { featureX_data.data.push(current_point); }
              if(this.legend_group_mode == "category_mdata") {
                ctg = zenbuChartElement_get_category(this.category_datatype, current_point.edge);
                if(category_data_hash[ctg]) { category_data_hash[ctg].data.push(current_point); }
                else { neither_data.data.push(current_point); }
              }
            } else {
              neither_data.data.push(current_point);
            }
          } else {
            if(current_point.x_pass && current_point.y_pass) {
              if(current_point.x * current_point.y > 0) { //both same sign
                both_data.data.push(current_point);
              } else {
                opposite_data.data.push(current_point);
              }
            } else if(current_point.x_pass) {
              featureX_data.data.push(current_point);
            } else if(current_point.y_pass) {
              featureY_data.data.push(current_point);
            } else {
              neither_data.data.push(current_point);
            }
          }
          point_count++;
        }

        current_point = new Object;
        current_point.x = 0.0;
        current_point.y = 0.0;
        current_point.r = 3;
        current_point.x_pass = false;
        current_point.y_pass = false;
        if(this.x_feature) { 
          current_point.feature1_id = edge.feature1.id;
          current_point.feature2_id = edge.feature2.id;
        } else {
          current_point.edge_id = edge.id; 
        }
        current_point.edge_idx = edge_idx;
        current_point.search_match = false;
        current_point.selected = false;
        current_point.edge = edge;

        current_feature = edge.feature2;
        
        if(edge.search_match || edge.feature1.search_match || edge.feature2.search_match) {
          current_point.search_match = true;
          //console.log("chart ["+this.elementID+"] found search_match point");
        }
  
        //TODO: need to change this chart code to be more edge generic

        //console.log("switch next DE gene ["+current_feature.name+"]");
        //if(point_count>100) { break; }
      }

      if(!this.x_feature || (this.x_feature.id == edge.feature1_id)) {
        var weight = 0.0;
        if(edge.weights[this.xaxis.datatype] && edge.weights[this.xaxis.datatype][0]) {
          //weight = edge.weights[this.xaxis.datatype][0].weight.toFixed(4);
          weight = edge.weights[this.xaxis.datatype][0].weight;
        }
        if(this.xaxis.log) {
          if(weight!=0.0) { weight = Math.log10(Math.abs(weight)); }
        }
        
        //current_point.x = weight;
        //current_point.x = weight.toFixed(2);
        //current_point.x = weight.toExponential(3);
        current_point.x = weight.toPrecision(5);
        if(Math.abs(weight) > this.max_value) { this.max_value = Math.abs(weight); }

        if(point_count == 0) {
          this.xaxis.min_value = weight;
          this.xaxis.max_value = weight;
        }
        if(weight > this.xaxis.max_value) { this.xaxis.max_value = weight; }
        if(weight < this.xaxis.min_value) { this.xaxis.min_value = weight; }

        //console.log("aso1 weight ["+weight+"]");
        //if(reportElementEdgeCheckValidFilters(datasourceElement, edge)) { current_point.x_pass = true; }
        if(edge.filter_valid) { current_point.x_pass = true; }

        current_point.x_edge_id = edge.id;
      }

      if(!this.y_feature || (this.y_feature.id == edge.feature1_id)) {
        var weight = 0.0;
        if(edge.weights[this.yaxis.datatype] && edge.weights[this.yaxis.datatype][0]) {
          //weight = edge.weights[this.yaxis.datatype][0].weight.toFixed(4);
          weight = edge.weights[this.yaxis.datatype][0].weight;
        }
        if(this.yaxis.log) {
          if(weight!=0.0) { weight = Math.log10(Math.abs(weight)); }
        }

        //current_point.y = weight;
        //current_point.y = weight.toFixed(2);
        //current_point.y = weight.toExponential(3);
        current_point.y = weight.toPrecision(5);
        if(Math.abs(weight) > this.max_value) { this.max_value = Math.abs(weight); }

        if(point_count == 0) {
          this.yaxis.min_value = weight;
          this.yaxis.max_value = weight;
        }
        if(weight > this.yaxis.max_value) { this.yaxis.max_value = weight; }
        if(weight < this.yaxis.min_value) { this.yaxis.min_value = weight; }

        //console.log("featureY weight ["+weight+"]");
        //if(reportElementEdgeCheckValidFilters(datasourceElement, edge)) { current_point.y_pass = true; }
        if(edge.filter_valid) { current_point.y_pass = true; }
        
        current_point.y_edge_id = edge.id;
      }
    }
  }
  
  this.chart_point_count = point_count;
  if(this.xaxis.symetric) {
    var tval1 = Math.abs(this.xaxis.min_value);
    var tval2 = Math.abs(this.xaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.xaxis.min_value = -tval2;
    this.xaxis.max_value = tval2;
  }
  if(this.yaxis.symetric) {
    var tval1 = Math.abs(this.yaxis.min_value);
    var tval2 = Math.abs(this.yaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.yaxis.min_value = -tval2;
    this.yaxis.max_value = tval2;
  }
  if(this.symetric_axis) {
    this.xaxis.max_value = this.max_value;
    this.xaxis.min_value = -this.max_value;
    this.yaxis.max_value = this.max_value;
    this.yaxis.min_value = -this.max_value;
    //this.max_value = 2.0; //TODO: need outlier code
  }

  var t1 = performance.now();
  var logmsg = "zenbuChartElement_postprocessBubbleChart ["+this.elementID+"] "+point_count+" points total, ";
  logmsg += "xaxis (" + this.xaxis.min_value +" .. "+ this.xaxis.max_value + "), ";
  logmsg += "yaxis (" + this.yaxis.min_value +" .. "+ this.yaxis.max_value + "), ";
  logmsg +=  (t1 - t0) + " msec.";
  console.log(logmsg);
  //console.log("zenbuChartElement_postprocessBubbleChart ["+this.elementID+"] "+point_count+" points total, " + (t1 - t0) + " msec.");
}


//===============================================================================================


function zenbuChartElement_postprocessPlotly() {
  //query just returned data for a new focus_feature
  //need to search through connected features for the EntrezGene and starting target

  console.log("zenbuChartElement_postprocessPlotly");
  var t0 = performance.now();

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  //backward compatability hack for converting axis.datatype to signal_active
  if(!this.backward_compat_check_dataypes) {
    this.backward_compat_check_dataypes = true;
    var dtype_col = this.datatypes[this.xaxis.datatype];
    if(dtype_col && !dtype_col.signal_active) {
      console.log("backcompat: plotly3D set x-axis ["+this.xaxis.datatype+"] to first signal_active");
      dtype_col.signal_active=true;
      dtype_col.user_modifiable=true;
      dtype_col.signal_order = 0.1;
    }
    var dtype_col = this.datatypes[this.yaxis.datatype];
    if(dtype_col && !dtype_col.signal_active) {
      console.log("backcompat: plotly3D set y-axis ["+this.yaxis.datatype+"] to second signal_active");
      dtype_col.signal_active=true; 
      dtype_col.user_modifiable=true; 
      dtype_col.signal_order = 0.2;
    }
  }
  
  //label is first visible column in array
  this.dtype_columns.sort(reports_column_order_sort_func);  //re-sort for labels
  var label_dtype_col = null;
  for(var i=0; i<this.dtype_columns.length; i++) {
    var dtype_col = this.dtype_columns[i];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible) { continue; }
    label_dtype_col = dtype_col;
    console.log("first visible dtype_col["+dtype_col.datatype+"] use as label_dtype_col");
    break;
  }

  //new version which sets the axis datatypes from order of signal_active datatypes
  this.dtype_columns.sort(signal_column_order_sort_func);
  var xaxis_dtype = null;
  var yaxis_dtype = null;
  var zaxis_dtype = null;
  for(var i=0; i<this.dtype_columns.length; i++) {
    var dtype_col = this.dtype_columns[i];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "signal") && (dtype_col.col_type != "weight")) { continue; }
    if(!dtype_col.signal_active) { continue; }
    if(!xaxis_dtype) { 
      xaxis_dtype = dtype_col;
      this.xaxis.datatype = dtype_col.datatype; //reset for other code usage, axis label....
      console.log("plotly3D first signal_active dtype_col["+dtype_col.datatype+"] - dominant for sorting");
    } 
    else if(!yaxis_dtype) { 
      yaxis_dtype = dtype_col;
      this.yaxis.datatype = dtype_col.datatype; //reset for other code usage, axis label....
    }
    else if(!zaxis_dtype) { 
      zaxis_dtype = dtype_col;
      this.zaxis.datatype = dtype_col.datatype; //reset for other code usage, axis label....
    }
  }
  if(!xaxis_dtype) { return; }  
  if((this.display_type == "scatter3D") || (this.display_type == "ternary")) {
    if(!xaxis_dtype || !yaxis_dtype || !zaxis_dtype) { return; }
  }
  
  //if((signal_dtype.col_type != "signal") && (signal_dtype.col_type != "weight")) { return; } //might loosen this in the future
  console.log("plotly3D x-axis_dtype type["+xaxis_dtype.datatype+"]  title["+xaxis_dtype.title+"]")
  console.log("plotly3D y-axis_dtype type["+yaxis_dtype.datatype+"]  title["+yaxis_dtype.title+"]")
  console.log("plotly3D z-axis_dtype type["+zaxis_dtype.datatype+"]  title["+zaxis_dtype.title+"]")
  
  //if((datasourceElement.datasource_mode=="edge") && (!this.x_feature || !this.y_feature)) { return; }

  /*plotly 3D dataset follows this format
    var trace1 = {
      x:unpack(rows, 'x1'), y: unpack(rows, 'y1'), z: unpack(rows, 'z1'),
      mode: 'markers',
      marker: {
        size: 5,
        line: {
          color: 'rgba(217, 217, 217, 0.14)',
          width: 0.5 },
        opacity: 0.8},
      type: 'scatter3d'
    };
  */
  /* ternary 
     var datasets = [{
      type: 'scatterternary',
      mode: 'markers',
      a: rawData.map(function(d) { return d.journalist; }),
      b: rawData.map(function(d) { return d.developer; }),
      c: rawData.map(function(d) { return d.designer; }),
      text: rawData.map(function(d) { return d.label; }),
      marker: {
          symbol: 100,
          color: '#DB7365',
          size: 14,
          line: { width: 2 }
      },
  }];
  */
  
  var display_type = this.display_type;
  if(display_type == "scatter3D") { display_type = "scatter3d" };
  if(display_type == "ternary") { display_type = "scatterternary" };

  //make the plotly 3D datasets
  var both_data = new Object;
  var opposite_data = new Object;
  var featureX_data = new Object;
  var featureY_data = new Object;
  var featureZ_data = new Object;
  var filtered_data = new Object;
  var category_data_hash = new Object; //hash of data-objs

  //if(!this.chart_data) {
    console.log("plotly3D ["+this.elementID+"] rebuild chart_data");
    this.chart_data = new Object;
    this.chart_data.datasets = new Array;

    //make the dataset categories
    both_data = new Object;
    both_data.zenbuid = "both";
    both_data.name = "both";
    both_data.backgroundColor = "#F8A12A"; //FF0000
    both_data.hoverBackgroundColor = "#F8A12A";
    both_data.text = new Array;
    both_data.type = display_type;
    both_data.mode = "markers";
    both_data.marker = { size: [], opacity: 0.8, 
                         color: [],
                         line: { width: 0.5, color: 'rgba(217, 217, 217, 0.14)' }
                       }

    opposite_data = new Object;
    opposite_data.zenbuid = "opposite";
    opposite_data.name = "opposite";
    opposite_data.backgroundColor = "#E30004"; //800080
    opposite_data.hoverBackgroundColor = "#E30004";

    featureX_data = new Object;
    featureX_data.zenbuid = "featureX";
    featureX_data.name = "featureX";
    featureX_data.backgroundColor = "#008000";
    featureX_data.hoverBackgroundColor = "#008000";

    featureY_data = new Object;
    featureY_data.zenbuid = "featureY";
    featureY_data.name = "featureY";
    featureY_data.backgroundColor = "#0000FF";
    featureY_data.hoverBackgroundColor = "#0000FF";

    featureZ_data = new Object;
    featureZ_data.zenbuid = "featureY";
    featureZ_data.name = "featureY";
    featureZ_data.backgroundColor = "#0000FF";
    featureZ_data.hoverBackgroundColor = "#0000FF";

    filtered_data = new Object;
    filtered_data.zenbuid = "neither";
    filtered_data.name = "filtered out";
    filtered_data.backgroundColor = "#808080";
    filtered_data.hoverBackgroundColor = "#808080";
    filtered_data.text = new Array;
    filtered_data.type = display_type;
    filtered_data.mode = "markers";
    filtered_data.marker = { size: [], opacity: 0.8, 
                             color: [],
                             line: { width: 0.5, color: 'rgba(217, 217, 217, 0.14)' } 
                           }

    
    if((this.legend_group_mode == "category_mdata") && this.category_datatype && this.category_selected_dtype) {
      var categories = this.category_selected_dtype.categories;
      var idx1=0;
      for(var ctg in categories) {
        var ctg_obj = categories[ctg];
        //{ctg:ctgval, count:0, value:null, filtered:false}; }

        console.log("plotly3D create category chart "+ctg_obj.ctg);
        var color = zenbuIndexColorSpace(this.colorspace, idx1++);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11
        
        dataset = new Object;
        dataset.zenbuid = "category_"+ctg_obj.ctg;
        dataset.category = ctg_obj.ctg;
        dataset.name = ctg_obj.ctg;
        dataset.backgroundColor = color.getCSSHexadecimalRGB();
        dataset.hoverBackgroundColor = color.getCSSHexadecimalRGB();
        dataset.text = new Array;
        dataset.customdata = new Array;
        dataset.type = display_type;
        dataset.mode = "markers";
        dataset.marker = { size: [], opacity: 0.8, 
                           color: [],
                           //line: { width: 0.5, color: 'rgba(217, 217, 217, 0.14)' } 
                           line: { width: 0.5, color: 'rgba(128, 128, 128, 0.14)' } 
                         }
  
        category_data_hash[ctg_obj.ctg] = dataset;
        this.chart_data.datasets.push(dataset);
      }
      this.chart_data.datasets.push(filtered_data);
    }

    //new logic for choosing which datasets to include into the chart_data
    if(this.legend_group_mode == "focus_feature") {
      if(datasourceElement.datasource_mode=="feature") {
        this.chart_data.datasets.push(both_data);
        both_data.name = "active";
        this.chart_data.datasets.push(filtered_data);
      }
      if(datasourceElement.datasource_mode=="edge") {
        if(this.focus_feature_mode=="progressive") {
          this.chart_data.datasets.push(both_data);
          this.chart_data.datasets.push(opposite_data);
        }
        this.chart_data.datasets.push(featureX_data);
        if(this.focus_feature_mode=="progressive") {
          this.chart_data.datasets.push(featureY_data);
        }
        this.chart_data.datasets.push(filtered_data);
      }
    }
  
  /*
  } 
  else {
    this.chart_data.datasets.forEach(function(data) {
      if(data.zenbuid == "both")     { both_data = data; }
      if(data.zenbuid == "opposite") { opposite_data = data; }
      if(data.zenbuid == "neither")  { filtered_data = data; }
      if(data.zenbuid == "featureX") { featureX_data = data; }
      if(data.zenbuid == "featureY") { featureY_data = data; }
      if(data.zenbuid == "category") { category_data_hash[data.category] = data; }
    });
  }
  */
  
  //reset the x,y,z arrays
  this.chart_data.datasets.forEach(function(data) { 
    data.x = [];
    data.y = [];
    data.z = []; 
    delete data.a;
    delete data.b;
    delete data.c;
    data.text=[]; 
    data.customdata=[]; 
  });
  
  this.chart_data.xaxis_dtype = xaxis_dtype;
  this.chart_data.yaxis_dtype = yaxis_dtype;
  this.chart_data.zaxis_dtype = zaxis_dtype;

  this.max_value = 0;
  this.ternary_sum = 0;
  this.xaxis.min_value = -1;
  this.xaxis.max_value = 1;
  this.yaxis.min_value = -1;
  this.yaxis.max_value = 1;
  this.xaxis.feature_name = "";
  this.yaxis.feature_name = "";

  featureX_data.label = this.title_prefix; 
  featureY_data.label = "featureY";
  if(this.x_feature && this.y_feature) {
    featureX_data.label = this.x_feature.name;
    featureY_data.label = this.y_feature.name;
    this.xaxis.feature_name = this.x_feature.name;
    this.yaxis.feature_name = this.y_feature.name;
    if(this.x_feature.id == this.y_feature.id) {
      featureX_data.backgroundColor = "#F8A12A";
      featureX_data.hoverBackgroundColor = "#F8A12A";
    }
  }

  //console.log("chart_data.datasets "+ this.chart_data.datasets.length + " categories");
  
  if(datasourceElement.datasource_mode == "feature") {    
    //datasourceElement.feature_array.sort(reports_edge_feature2_sort_func);

    var t1 = performance.now();
    //console.log("after sort " + (t1 - t0) + " msec.");

    //var gene_2_aso_hash = new Object;
    var current_point = new Object;
    var feature_count = datasourceElement.feature_array.length;
    //console.log(edge_count + " edges to process");
    //console.log("datatype ["+this.datatype+"]");
    var point_count = 0;
    for(var feat_idx=0; feat_idx<feature_count; feat_idx++) {
      var feature = datasourceElement.feature_array[feat_idx];
      if(!feature) { continue; }
      if(!feature.expression_hash) { continue; }

      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

      current_point = new Object;
      current_point.x = 0.0;
      current_point.y = 0.0;
      current_point.z = 0.0;
      current_point.r = 5;
      current_point.label = feature.name;
      current_point.feature_id = feature.id;
      current_point.feature_idx = feat_idx;
      current_point.search_match = false;
      current_point.selected = false;
      
      if(feature.search_match) { current_point.search_match = true; }  
    
      // label/name
      if(label_dtype_col) { 
        dtype = label_dtype_col.datatype;
        var label = zenbuChartElement_get_category(dtype, feature);
        if(label) { current_point.label = label; }
      }

      //Xaxis
      var signal = 0.0;
      if(xaxis_dtype.datatype == "bedscore") {
        signal = parseFloat(feature.score);
      }
      if(feature.expression_hash[xaxis_dtype.datatype] && feature.expression_hash[xaxis_dtype.datatype][0]) {
        signal = feature.expression_hash[xaxis_dtype.datatype][0].total;
      }
      if(this.xaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }      
      current_point.x = signal.toPrecision(5);
      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }
      if(point_count == 0) {
        this.xaxis.min_value = signal;
        this.xaxis.max_value = signal;
      }
      if(signal > this.xaxis.max_value) { this.xaxis.max_value = signal; }
      if(signal < this.xaxis.min_value) { this.xaxis.min_value = signal; }
      //console.log("aso1 signal ["+signal+"]");

      //Yaxis
      var signal = 0.0;
      if(yaxis_dtype.datatype == "bedscore") {
        signal = parseFloat(feature.score);
      }
      if(feature.expression_hash[yaxis_dtype.datatype] && feature.expression_hash[yaxis_dtype.datatype][0]) {
        signal = feature.expression_hash[yaxis_dtype.datatype][0].total;
      }
      if(this.yaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }
      current_point.y = signal.toPrecision(5);
      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }

      if(point_count == 0) {
        this.yaxis.min_value = signal;
        this.yaxis.max_value = signal;
      }
      if(signal > this.yaxis.max_value) { this.yaxis.max_value = signal; }
      if(signal < this.yaxis.min_value) { this.yaxis.min_value = signal; }
      //console.log("featureY signal ["+signal+"]");

      //Zaxis
      var signal = 0.0;
      if(zaxis_dtype.datatype == "bedscore") {
        signal = parseFloat(feature.score);
      }
      if(feature.expression_hash[zaxis_dtype.datatype] && feature.expression_hash[zaxis_dtype.datatype][0]) {
        signal = feature.expression_hash[zaxis_dtype.datatype][0].total;
      }
      if(this.zaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }      
      current_point.z = signal.toPrecision(5);
      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }
      if(point_count == 0) {
        this.zaxis.min_value = signal;
        this.zaxis.max_value = signal;
      }
      if(signal > this.zaxis.max_value) { this.zaxis.max_value = signal; }
      if(signal < this.zaxis.min_value) { this.zaxis.min_value = signal; }

      //ternary_sum
      var ternary_sum = parseFloat(current_point.x) + parseFloat(current_point.y) + parseFloat(current_point.z);
      if(ternary_sum > this.ternary_sum) { this.ternary_sum = ternary_sum; }
      
      if(feature.filter_valid) { 
        if(this.legend_group_mode == "focus_feature") { 
          both_data.x.push(current_point.x); 
          both_data.y.push(current_point.y); 
          both_data.z.push(current_point.z); 
          both_data.text.push(current_point.label); 
          both_data.customdata.push(feature);
          both_data.marker.size.push(current_point.r);
          both_data.marker.color.push(both_data.backgroundColor); 
          feature.plotly_dset_name = both_data.zenbuid;
          feature.plotly_dset_fidx = both_data.x.length -1;
        }
        if(this.legend_group_mode == "category_mdata") {
          ctg = zenbuChartElement_get_category(this.category_datatype, feature);
          if(category_data_hash[ctg]) { 
            var dset = category_data_hash[ctg];
            dset.x.push(current_point.x);
            dset.y.push(current_point.y);
            dset.z.push(current_point.z);            
            dset.text.push(current_point.label);
            dset.customdata.push(feature);
            dset.marker.size.push(current_point.r);
            dset.marker.color.push(dset.backgroundColor); 
            feature.plotly_dset_name = dset.zenbuid;
            feature.plotly_dset_fidx = dset.x.length -1;
          }
          else { 
            filtered_data.x.push(current_point.x);
            filtered_data.y.push(current_point.y);
            filtered_data.z.push(current_point.z);
            filtered_data.text.push(current_point.label);
            filtered_data.customdata.push(feature);
            filtered_data.marker.size.push(current_point.r);
            filtered_data.marker.color.push(filtered_data.backgroundColor); 
            feature.plotly_dset_name = filtered_data.zenbuid;
            feature.plotly_dset_fidx = filtered_data.x.length -1;
          }
        }
      } 
      else { 
        filtered_data.x.push(current_point.x);
        filtered_data.y.push(current_point.y);
        filtered_data.z.push(current_point.z);        
        filtered_data.text.push(current_point.label);
        filtered_data.customdata.push(feature);
        filtered_data.marker.size.push(current_point.r);
        filtered_data.marker.color.push(filtered_data.backgroundColor); 
        feature.plotly_dset_name = filtered_data.zenbuid;
        feature.plotly_dset_fidx = filtered_data.x.length -1;
      }
      point_count++;
    }
  }

  /*
  if(datasourceElement.datasource_mode == "edge") {
    //need to pair up DE-effected-genes to their ASOs
    //do this by sorting by features and then all the effectors in next to each other
    datasourceElement.edge_array.sort(reports_edge_feature2_sort_func);

    var t1 = performance.now();
    //console.log("after sort " + (t1 - t0) + " msec.");

    //var gene_2_aso_hash = new Object;
    var current_feature = null;
    var current_point = new Object;
    var edge_count = datasourceElement.edge_array.length;
    //console.log(edge_count + " edges to process");
    //console.log("datatype ["+this.datatype+"]");
    var point_count = 0;
    for(var edge_idx=0; edge_idx<edge_count; edge_idx++) {
      var edge = datasourceElement.edge_array[edge_idx];
      if(!edge) { continue; }
      if(!edge.feature2) { continue; }
      if(!edge.feature1) { continue; }

      if(this.x_feature && this.y_feature && (edge.feature1_id != this.x_feature.id) && (edge.feature1_id != this.y_feature.id)) { continue; }

      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !edge.search_match) { continue; }

      //if(!current_feature) { current_feature = edge.feature2; }
      if(!current_feature || !this.x_feature || (current_feature.id != edge.feature2.id)) {
        //finished with previous point
        //if((current_point.x != 0.0) && (current_point.y != 0.0)) {
        if((current_point.x) || (current_point.y)) {
          if((!this.x_feature && !this.y_feature) || (this.x_feature.id == this.y_feature.id)) {
            if(current_point.x_pass) {
              if(this.legend_group_mode == "focus_feature") { featureX_data.data.push(current_point); }
              if(this.legend_group_mode == "category_mdata") {
                ctg = zenbuChartElement_get_category(this.category_datatype, current_point.edge);
                if(category_data_hash[ctg]) { category_data_hash[ctg].data.push(current_point); }
                else { filtered_data.data.push(current_point); }
              }
            } else {
              filtered_data.data.push(current_point);
            }
          } else {
            if(current_point.x_pass && current_point.y_pass) {
              if(current_point.x * current_point.y > 0) { //both same sign
                both_data.data.push(current_point);
              } else {
                opposite_data.data.push(current_point);
              }
            } else if(current_point.x_pass) {
              featureX_data.data.push(current_point);
            } else if(current_point.y_pass) {
              featureY_data.data.push(current_point);
            } else {
              filtered_data.data.push(current_point);
            }
          }
          point_count++;
        }

        current_point = new Object;
        current_point.x = 0.0;
        current_point.y = 0.0;
        current_point.r = 3;
        current_point.x_pass = false;
        current_point.y_pass = false;
        if(this.x_feature) { 
          current_point.feature1_id = edge.feature1.id;
          current_point.feature2_id = edge.feature2.id;
        } else {
          current_point.edge_id = edge.id; 
        }
        current_point.edge_idx = edge_idx;
        current_point.search_match = false;
        current_point.selected = false;
        current_point.edge = edge;

        current_feature = edge.feature2;
        
        if(edge.search_match || edge.feature1.search_match || edge.feature2.search_match) {
          current_point.search_match = true;
          //console.log("chart ["+this.elementID+"] found search_match point");
        }
  
        //TODO: need to change this chart code to be more edge generic

        //console.log("switch next DE gene ["+current_feature.name+"]");
        //if(point_count>100) { break; }
      }

      if(!this.x_feature || (this.x_feature.id == edge.feature1_id)) {
        var weight = 0.0;
        if(edge.weights[xaxis_dtype.datatype] && edge.weights[xaxis_dtype.datatype][0]) {
          //weight = edge.weights[xaxis_dtype.datatype][0].weight.toFixed(4);
          weight = edge.weights[xaxis_dtype.datatype][0].weight;
        }
        if(this.xaxis.log) {
          if(weight!=0.0) { weight = Math.log10(Math.abs(weight)); }
        }
        
        //current_point.x = weight;
        //current_point.x = weight.toFixed(2);
        //current_point.x = weight.toExponential(3);
        current_point.x = weight.toPrecision(5);
        if(Math.abs(weight) > this.max_value) { this.max_value = Math.abs(weight); }

        if(point_count == 0) {
          this.xaxis.min_value = weight;
          this.xaxis.max_value = weight;
        }
        if(weight > this.xaxis.max_value) { this.xaxis.max_value = weight; }
        if(weight < this.xaxis.min_value) { this.xaxis.min_value = weight; }

        //console.log("aso1 weight ["+weight+"]");
        //if(reportElementEdgeCheckValidFilters(datasourceElement, edge)) { current_point.x_pass = true; }
        if(edge.filter_valid) { current_point.x_pass = true; }

        current_point.x_edge_id = edge.id;
      }

      if(!this.y_feature || (this.y_feature.id == edge.feature1_id)) {
        var weight = 0.0;
        if(edge.weights[yaxis_dtype.datatype] && edge.weights[yaxis_dtype.datatype][0]) {
          //weight = edge.weights[yaxis_dtype.datatype][0].weight.toFixed(4);
          weight = edge.weights[yaxis_dtype.datatype][0].weight;
        }
        if(this.yaxis.log) {
          if(weight!=0.0) { weight = Math.log10(Math.abs(weight)); }
        }

        //current_point.y = weight;
        //current_point.y = weight.toFixed(2);
        //current_point.y = weight.toExponential(3);
        current_point.y = weight.toPrecision(5);
        if(Math.abs(weight) > this.max_value) { this.max_value = Math.abs(weight); }

        if(point_count == 0) {
          this.yaxis.min_value = weight;
          this.yaxis.max_value = weight;
        }
        if(weight > this.yaxis.max_value) { this.yaxis.max_value = weight; }
        if(weight < this.yaxis.min_value) { this.yaxis.min_value = weight; }

        //console.log("featureY weight ["+weight+"]");
        //if(reportElementEdgeCheckValidFilters(datasourceElement, edge)) { current_point.y_pass = true; }
        if(edge.filter_valid) { current_point.y_pass = true; }
        
        current_point.y_edge_id = edge.id;
      }
    }
  }
  */
  
  if(this.display_type =="ternary") {
    //switch from xyz to abc
    this.chart_data.datasets.forEach(function(data) { 
      data.a = data.x; 
      data.b = data.y; 
      data.c = data.z;
      delete data.x;
      delete data.y;
      delete data.z;
    });
  }
  
  this.chart_point_count = point_count;
  if(this.xaxis.symetric) {
    var tval1 = Math.abs(this.xaxis.min_value);
    var tval2 = Math.abs(this.xaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.xaxis.min_value = -tval2;
    this.xaxis.max_value = tval2;
  }
  if(this.yaxis.symetric) {
    var tval1 = Math.abs(this.yaxis.min_value);
    var tval2 = Math.abs(this.yaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.yaxis.min_value = -tval2;
    this.yaxis.max_value = tval2;
  }
  if(this.zaxis.symetric) {
    var tval1 = Math.abs(this.zaxis.min_value);
    var tval2 = Math.abs(this.zaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.zaxis.min_value = -tval2;
    this.zaxis.max_value = tval2;
  }
  if(this.symetric_axis) {
    this.xaxis.max_value = this.max_value;
    this.xaxis.min_value = -this.max_value;
    this.yaxis.max_value = this.max_value;
    this.yaxis.min_value = -this.max_value;
    //this.max_value = 2.0; //TODO: need outlier code
  }

  var t1 = performance.now();
  var logmsg = "zenbuChartElement_postprocessPlotly ["+this.elementID+"] "+point_count+" points total, ";
  logmsg += "xaxis (" + this.xaxis.min_value +" .. "+ this.xaxis.max_value + "), ";
  logmsg += "yaxis (" + this.yaxis.min_value +" .. "+ this.yaxis.max_value + "), ";
  logmsg += "zaxis (" + this.zaxis.min_value +" .. "+ this.zaxis.max_value + "), ";
  logmsg += "ternary_sum: " + this.ternary_sum+", ";
  logmsg +=  (t1 - t0) + " msec.";
  console.log(logmsg);
  //console.log("zenbuChartElement_postprocessPlotly ["+this.elementID+"] "+point_count+" points total, " + (t1 - t0) + " msec.");
}


//===============================================================================================


function zenbuChartElement_postprocessBarChart() {
  console.log("zenbuChartElement_postprocessBarChart ["+this.elementID+"] begin");

  var t0 = performance.now();

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  this.max_value = 0;
  this.xaxis.min_value = -1;
  this.xaxis.max_value = 1;
  this.xaxis.feature_name = "";

  //build the chart_data
  this.chart_data = new Object;
  this.chart_data.labels   = []; //for each bar  
  this.chart_data.datasets = [];
  this.chart_point_count = 0;
  
  //this signal_dtype for sorting is the first active_signal datatype
  this.dtype_columns.sort(signal_column_order_sort_func);
  var signal_dtype = null;
  for(var i=0; i<this.dtype_columns.length; i++) {
    var dtype_col = this.dtype_columns[i];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "signal") && (dtype_col.col_type != "weight")) { continue; }
    if(!dtype_col.signal_active) { continue; }
    signal_dtype = dtype_col;
    this.xaxis.datatype = signal_dtype.datatype; //reset for other code usage, axis label....
    console.log("first signal_active dtype_col["+dtype_col.datatype+"] - dominant for sorting");
    break;
  }
  if(!signal_dtype) { return; }
  console.log("signal_dtype type["+signal_dtype.datatype+"]  title["+signal_dtype.title+"]")
  if((signal_dtype.col_type != "signal") && (signal_dtype.col_type != "weight")) { return; } //might loosen this in the future
  
  //label is first visible column in array
  this.dtype_columns.sort(reports_column_order_sort_func);  //re-sort for labels
  var label_dtype_col = null;
  for(var i=0; i<this.dtype_columns.length; i++) {
    var dtype_col = this.dtype_columns[i];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible) { continue; }
    label_dtype_col = dtype_col;
    console.log("found first visible dtype_col["+dtype_col.datatype+"] so use as chart label");
    break;
  }

  //prepare feature_array edge_array for charting
  if(datasourceElement.datasource_mode == "feature") {  
    for(var fidx=0; fidx<this.feature_array.length; fidx++) {
      var feature = this.feature_array[fidx];
      if(!feature) { continue; }
      feature.chart_active = false;
      feature.chart_dtype_signal = {};
    }
  }
  if(datasourceElement.datasource_mode == "edge") {      
    for(eidx=0; eidx<this.edge_array.length; eidx++) {
      var edge = this.edge_array[eidx];
      if(!edge) { continue; }
      edge.chart_active = false;
      edge.chart_dtype_signal = {};
    }
  }

  //
  //first build the chart_active and chart_dtype_signal for feature/edge for each datatype
  //
  for(var dtype in this.datatypes) {
    var dtype_col = this.datatypes[dtype];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "signal") && (dtype_col.col_type != "weight")) { continue; }  
    if(!dtype_col.signal_active) { continue; }
    this.prepareBarChartSignal(dtype_col);
  }
  
  //
  //then labels and sorting code. transfer the chart_signal of the active dtype for sorting
  //
  if(datasourceElement.datasource_mode == "feature") {
    for(var fidx=0; fidx<this.feature_array.length; fidx++) {
      var feature = this.feature_array[fidx];
      if(!feature) { continue; }      
      feature.chart_signal = feature.chart_dtype_signal[signal_dtype.datatype]; //allows the filtered to always be sorted to end

      if(!feature.chart_active) { continue; }
      var dtype = "name";
      if(label_dtype_col) { dtype = label_dtype_col.datatype; }
      var label = zenbuChartElement_get_category(dtype, feature);
      if(!label) { label = feature.name; }
      this.chart_data.labels.push(label);
    }
    console.log("sort bar "+this.feature_array.length+" features: ["+this.bar_order+"]");
    switch(this.bar_order) {
      case "original": console.log("original"); this.feature_array.sort(chart_element_signal_orig_sort_func); break;
      case "signal descending": console.log("descend"); this.feature_array.sort(chart_element_signal_desc_sort_func); break;
      case "signal ascending":  console.log("ascend"); this.feature_array.sort(chart_element_signal_asc_sort_func); break;
      case "metadata label": break;
      default: break;
    }
  }
  if(datasourceElement.datasource_mode == "edge") {      
    for(eidx=0; eidx<this.edge_array.length; eidx++) {
      var edge = this.edge_array[eidx];
      if(!edge) { continue; }
      edge.chart_signal = edge.chart_dtype_signal[signal_dtype.datatype]; //allows the filtered to always be sorted to end

      if(!edge.chart_active) { continue; }
      var dtype = "name";
      if(label_dtype_col) { dtype = label_dtype_col.datatype; }
      var label = zenbuChartElement_get_category(dtype, edge);
      if(!label) { label = edge.name; }
      this.chart_data.labels.push(label);
    }
    console.log("sort bar "+this.edge_array.length+" edges: ["+this.bar_order+"]");
    switch(this.bar_order) {
      case "original": console.log("original"); this.edge_array.sort(chart_element_signal_orig_sort_func); break;
      case "signal descending": console.log("descend"); this.edge_array.sort(chart_element_signal_desc_sort_func); break;
      case "signal ascending":  console.log("ascend"); this.edge_array.sort(chart_element_signal_asc_sort_func); break;
      case "metadata label": break;
      default: break;
    }    
    console.log("after sort edge_array has "+this.edge_array.length+" edges");
  }
  
  //
  //finally convert chart_dtype_signal into chart.datasets
  //
  var columns = this.dtype_columns;
  columns.sort(signal_column_order_sort_func);
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "signal") && (dtype_col.col_type != "weight")) { continue; }  
    if(!dtype_col.signal_active) { continue; }
    var dataset = this.createBarChartDataset(dtype_col);
    if(dataset) { this.chart_data.datasets.push(dataset); }
  }      
  
  if(this.xaxis.symetric) {
    var tval1 = Math.abs(this.xaxis.min_value);
    var tval2 = Math.abs(this.xaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.xaxis.min_value = -tval2;
    this.xaxis.max_value = tval2;
  }
  
  var t1 = performance.now();
  var logmsg = "zenbuChartElement_postprocessBarChart ["+this.elementID+"] ";
  logmsg += "signal axis (" + this.xaxis.min_value +" .. "+ this.xaxis.max_value + "), ";
  logmsg +=  (t1 - t0) + " msec.";
  console.log(logmsg);
}

//======================

function zenbuChartElement_prepareBarChartSignal(signal_dtype) {
  if(!signal_dtype) { return null; }
  console.log("zenbuChartElement_prepareBarChartSignal ["+this.elementID+"] dtype:"+signal_dtype.datatype);

  var t0 = performance.now();

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  if(datasourceElement.datasource_mode == "feature") {    
    //this.feature_array is clone of datasource.feature_array if this!=datasource to allow internal sort
    console.log(this.feature_array.length + " features to process");
    for(var fidx=0; fidx<this.feature_array.length; fidx++) {
      var feature = this.feature_array[fidx];
      if(!feature) { continue; }
      feature.chart_signal = undefined; //allows the filtered to always be sorted to end

      //for now the filtered features are removed from the chart
      //later I may have options for remove, gray-out, or place in separate dataset
      if(!feature.filter_valid) { continue; } 
      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

      //bar chart always uses the xaxis for parameters even if it draw horizontal/vertical
      var signal = 0.0;
      if(signal_dtype.datatype == "bedscore") {
        signal = parseFloat(feature.score);
      }
      if(feature.expression_hash && feature.expression_hash[signal_dtype.datatype] && feature.expression_hash[signal_dtype.datatype][0]) {
        signal = feature.expression_hash[signal_dtype.datatype][0].total;
      }
      if(this.xaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }

      if(this.hide_zero && signal==0) { continue; }

      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }
      if(this.chart_point_count == 0) {
        this.xaxis.min_value = signal;
        this.xaxis.max_value = signal;
      }
      if(signal > this.xaxis.max_value) { this.xaxis.max_value = signal; }
      if(signal < this.xaxis.min_value) { this.xaxis.min_value = signal; }
      this.chart_point_count++;
      
      feature.chart_signal = signal;
      feature.chart_dtype_signal[signal_dtype.datatype] = signal;
      feature.chart_active = true;
    }
  }
  
  if(datasourceElement.datasource_mode == "edge") {  
    //console.log("datasource_mode == edge");
    console.log(this.edge_array.length + " edges to process");
    
    var datatype = signal_dtype.datatype;
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');
    console.log("datatype["+signal_dtype.datatype+"] => ["+datatype+"]");

    for(eidx=0; eidx<this.edge_array.length; eidx++) {
      var edge = this.edge_array[eidx];
      if(!edge) { continue; }
      edge.chart_signal = undefined; //allows the filtered to always be sorted to end
      
      if(!edge.feature1) { continue; }
      if(!edge.feature2) { continue; }

      //for now the filtered features are removed from the chart
      //later I may have options for remove, gray-out, or place in separate dataset
      if(!edge.filter_valid) { continue; } 
      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !edge.search_match) { continue; }

      //check for focus_feature sub-selection
      //this.focus_feature_mode = "current";  //"ignore", "progressive"
      if((this.focus_feature_mode != "ignore") && datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }
      //if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }

      var sig_feature = null;
      if(edge && (/^f1\./.test(signal_dtype.datatype))) { sig_feature = edge.feature1;}
      if(edge && (/^f2\./.test(signal_dtype.datatype))) { sig_feature = edge.feature2;}

      var signal = 0.0;
      if(sig_feature) {
        if(datatype == "bedscore") {
          signal = parseFloat(sig_feature.score);
        }
        else 
        if(sig_feature.expression_hash && 
           sig_feature.expression_hash[datatype] && 
           sig_feature.expression_hash[datatype][0]) {
          signal = sig_feature.expression_hash[datatype][0].total;
        }
      }
      if(edge && edge.weights && edge.weights[datatype] && edge.weights[datatype][0]) {
        signal = edge.weights[datatype][0].weight;
      }

      if(this.xaxis.log) {
        if(signal!=0.0) { signal = Math.log10(Math.abs(signal)); }
      }

      if(this.hide_zero && signal==0) { continue; }

      if(Math.abs(signal) > this.max_value) { this.max_value = Math.abs(signal); }
      if(this.chart_point_count == 0) {
        this.xaxis.min_value = signal;
        this.xaxis.max_value = signal;
      }
      if(signal > this.xaxis.max_value) { this.xaxis.max_value = signal; }
      if(signal < this.xaxis.min_value) { this.xaxis.min_value = signal; }
      this.chart_point_count++;
      
      edge.chart_signal = signal;
      edge.chart_dtype_signal[signal_dtype.datatype] = signal;
      edge.chart_active = true;
    }    
  }
  
  if(this.xaxis.symetric) {
    var tval1 = Math.abs(this.xaxis.min_value);
    var tval2 = Math.abs(this.xaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.xaxis.min_value = -tval2;
    this.xaxis.max_value = tval2;
  }
  
  var t1 = performance.now();
  var logmsg = "zenbuChartElement_prepareBarChartSignal ["+this.elementID+"] "+this.chart_point_count+" points total, ";
  logmsg += "signal axis (" + this.xaxis.min_value +" .. "+ this.xaxis.max_value + "), ";
  logmsg +=  (t1 - t0) + " msec.";
  console.log(logmsg);
}


function zenbuChartElement_createBarChartDataset(signal_dtype) {
  if(!signal_dtype) { return null; }
  console.log("zenbuChartElement_createBarChartDataset ["+this.elementID+"] dtype:"+signal_dtype.datatype);

  var t0 = performance.now();

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  var dataset = {};

  if(this.display_type =="bar") {
    dataset = { data:[], backgroundColor:[] };
  }
  if(this.display_type =="line") {
    dataset = { data:[], backgroundColor:"#0010FF", pointBackgroundColor:[], pointRadius:[], fill:false };
  }
  dataset.label = signal_dtype.title;

  //set dataset backgroundColor  
  var colorspace = this.colorspace;
  //if(this.newconfig && (this.newconfig.colorspace !== undefined)) { colorspace = this.newconfig.colorspace; }
  var dataset_hexcolor = "#0010FF";
  var color = zenbuIndexColorSpace(colorspace, signal_dtype.signal_order-1);
  if(color) { dataset_hexcolor = color.getCSSHexadecimalRGB(); }
  if(signal_dtype.highlight_color) { dataset_hexcolor = signal_dtype.highlight_color; }
  if(this.display_type!="bar") { dataset.backgroundColor = dataset_hexcolor; }

  if(datasourceElement.datasource_mode == "feature") {      
    //convert sorted features to bars
    //since using this.feature_array, and undef chart_signal is at sorted end
    //there will be a 1:1 match of the chart_data[idx], labels[idx] and feature_array[idx]
    for(var fidx=0; fidx<this.feature_array.length; fidx++) {
      var feature = this.feature_array[fidx];
      if(!feature) { continue; }
      if(!feature.chart_active) { continue; }
              
      var chart_signal = feature.chart_dtype_signal[signal_dtype.datatype];
      //if(!chart_signal) { chart_signal = 0; }
      //chart_signal = chart_signal.toPrecision(5);
      dataset.data.push(chart_signal);

      var hexcolor = dataset_hexcolor;
      var radius = 3;
      if(datasourceElement.search_data_filter) {
        radius = 7;
        if(!feature.search_match) { hexcolor = "#B0B0B0"; radius=3; } //gray out the mistmatches
      }
      if(this.display_type=="bar") { 
        dataset.backgroundColor.push(hexcolor);
      }
      if(this.display_type=="line") { 
        dataset.pointBackgroundColor.push(hexcolor); 
        dataset.pointRadius.push(radius);         
      }
    }
  }
  
  if(datasourceElement.datasource_mode == "edge") {   
    //convert sorted edges to bars
    for(eidx=0; eidx<this.edge_array.length; eidx++) {
      var edge = this.edge_array[eidx];
      if(!edge) { continue; }
      if(!edge.chart_active) { continue; }
        
      var chart_signal = edge.chart_dtype_signal[signal_dtype.datatype];
      dataset.data.push(chart_signal);
      
      var hexcolor = dataset_hexcolor;
      var radius = 3;
      if(datasourceElement.search_data_filter) {
        radius = 7;
        if(!edge.search_match) { hexcolor = "#B0B0B0"; radius=3; } //gray out the mistmatches
      }
      if(this.display_type=="bar") { 
        dataset.backgroundColor.push(hexcolor);
      }
      if(this.display_type=="line") { 
        dataset.pointBackgroundColor.push(hexcolor); 
        dataset.pointRadius.push(radius);         
      }
    }
  }

  console.log("generated "+(dataset.data.length)+"chart datapoints");
  
  if(this.xaxis.symetric) {
    var tval1 = Math.abs(this.xaxis.min_value);
    var tval2 = Math.abs(this.xaxis.max_value);
    if(tval1 > tval2) { tval2 = tval1; }
    this.xaxis.min_value = -tval2;
    this.xaxis.max_value = tval2;
  }
  
  var t1 = performance.now();
  var logmsg = "zenbuChartElement_createBarChartDataset ["+this.elementID+"] "+this.chart_point_count+" points total, ";
  logmsg += "signal axis (" + this.xaxis.min_value +" .. "+ this.xaxis.max_value + "), ";
  logmsg +=  (t1 - t0) + " msec.";
  console.log(logmsg);

  return dataset;
}



//==================================


function zenbuChartElement_postprocessLegendCategory() {
  if(!this.category_datatype) { return; }
  console.log("zenbuChartElement_postprocessLegendCategory "+this.elementID);
    
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  
  if(!datasourceElement.dtype_columns) { return; }
  var columns = datasourceElement.dtype_columns;
  
  var category_datatype = this.category_datatype;
  //if(this.newconfig && this.newconfig.category_datatype != undefined) { category_datatype = this.newconfig.category_datatype; }
  
  var selected_dtype = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if(dtype_col.datatype == category_datatype) { selected_dtype = dtype_col; break; }
  }
  if(!selected_dtype) { return; }
  console.log("zenbuChartElement_postprocessLegendCategory selected_dtype type["+selected_dtype.datatype+"]  title["+selected_dtype.title+"]")
  if(selected_dtype.col_type != "mdata") { return; } //might loosen this in the future

  //hijack the CategoryElement postprocess to prep the categories
  zenbuCategoryElement_postprocess.call(this);

  this.category_selected_dtype = selected_dtype;
  
  //for(var ctg in selected_dtype.categories) {
  //  var ctg_obj = selected_dtype.categories[ctg];
  //  console.log(" dtype "+selected_dtype.datatype+" category "+ctg_obj.ctg);
  //}
  
}


function zenbuChartElement_get_category(selected_datatype, object) {
  if(!selected_datatype) { return ""; }
  if(!object) { return ""; }
  var datatype = selected_datatype
  datatype = datatype.replace(/^f1\./, '');
  datatype = datatype.replace(/^f2\./, '');
  //console.log("zenbuCategoryElement_postprocess edges type["+datatype+"]")

  var edge = null;
  var feature = null;
  var source = null;
  
  if(object.classname == "Edge")       { edge = object; }
  if(object.classname == "Feature")    { feature = object; }
  if(object.classname == "Datasource") { source = object; }

  var category = "";
  if(edge) {
    if(!edge.feature1) { return ""; }
    if(!edge.feature2) { return ""; }

    var t_feature = null;
    if(edge && (/^f1\./.test(selected_datatype))) { t_feature = edge.feature1;}
    if(edge && (/^f2\./.test(selected_datatype))) { t_feature = edge.feature2;}
    
    if(t_feature) {
      if(t_feature.source && (datatype == "category")) {
        category = t_feature.source.category;
      } else if(t_feature.source && (datatype == "source_name")) {
        category = t_feature.source.name;
      } else if(datatype == "location_string") {
        category = t_feature.chromloc;
      } else  if(datatype == "name") {
        category = t_feature.name;
      } else if(t_feature.mdata && t_feature.mdata[datatype]) {
        var value_array = t_feature.mdata[datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          category = value_array[idx1];
        }
      }
    } else {
      //selected_datatype is on the edge
      if(edge.source && (datatype == "category")) {
        category = edge.source.category;
      } else if(edge.source && (datatype == "source_name")) {
        category = edge.source.name;
      } else if(datatype == "location_string") {
        category = edge.chromloc;
      } else if(edge.mdata && edge.mdata[datatype]) {
        var value_array = edge.mdata[datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          category = value_array[idx1];
        }
      }
    }
    return category;
  }
  
  if(feature) {
    if(feature.source && (datatype == "category")) {
      category = feature.source.category;
    } else if(feature.source && (datatype == "source_name")) {
      category = feature.source.name;
    } else if(datatype == "location_string") {
      category = feature.chromloc;
    } else  if(datatype == "name") {
      category = feature.name;
    } else if(feature.mdata && feature.mdata[datatype]) {
      var value_array = feature.mdata[datatype];
      for(var idx1=0; idx1<value_array.length; idx1++) {
        category = value_array[idx1];
      }
    }
    return category;
  }
  
  if(source) {
    if(selected_datatype == "category") {
      category = source.category;
    } else if(selected_datatype == "source_name") {
      category = source.name;
    } else if(source.mdata && source.mdata[selected_datatype]) {
      var value_array = source.mdata[selected_datatype];
      for(var idx1=0; idx1<value_array.length; idx1++) {
        category = value_array[idx1];
      }
    }
    return category;
  }
  return category;
}

//============


function zenbuChartElement_showSelections() {
  if(this.element_type != "chart") { return; }

  if(!this.chart_data) { return; }

  var elementID = this.elementID;
  console.log("zenbuChartElement_showSelections ["+elementID+"]  selected_id="+this.selected_id);
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  var select_id = this.selected_id;
  //if(this.selected_edge) {
  //  console.log("zenbuChartElement_showSelections ["+elementID+"] has selected_edge change select_id to f2 ["+this.selected_edge.feature2.id+"]");
  //  select_id = this.selected_edge.feature2.id;
  //}
  
  
  if(this.display_type == "bar" || this.display_type == "line") {
    if(this.barchart_selected_point) {
      var idx = this.barchart_selected_point.idx;
      var color = this.barchart_selected_point.color;
      this.chart_data.datasets[0].backgroundColor[idx] = color;
      this.barchart_selected_point = null;
    }

    //data is copied into this to allow resort
    if(datasourceElement.datasource_mode=="feature") {
      for(var j=0; j<this.feature_array.length; j++) {
        var feature = this.feature_array[j];
        if(feature && feature.id == select_id) {
          //console.log("found selected feature at idx:"+j);
          this.barchart_selected_point = { 
            color: this.chart_data.datasets[0].backgroundColor[j],
            idx: j
          }
          this.chart_data.datasets[0].backgroundColor[j] = "rgba(255,0,225,0.5)";
          break;
        }
      }
    }
    if(datasourceElement.datasource_mode=="edge") {
      for(var j=0; j<this.edge_array.length; j++) {
        var edge = this.edge_array[j];
        if(edge && edge.id == select_id) {
          //console.log("found selected edge at idx:"+j);
          this.barchart_selected_point = { 
            color: this.chart_data.datasets[0].backgroundColor[j],
            idx: j
          }
          this.chart_data.datasets[0].backgroundColor[j] = "rgba(255,0,225,0.5)";
        }
      }
    }
  }

  if(this.display_type == "scatter3D" || this.display_type == "ternary") {
    if(!this.plotly_div) { return; }
    
    var dset_name_hash = new Object;
    for(var j=0; j<this.chart_data.datasets.length; j++) {
      var dset = this.chart_data.datasets[j];
      dset.ds_idx = j;
      dset_name_hash[dset.zenbuid] = dset;
    }

    if(this.plotly_selected_point) {
      var dataset = dset_name_hash[this.plotly_selected_point.dset_name];
      if(dataset) {
        var idx = this.plotly_selected_point.plotly_dset_fidx;
        dataset.marker.color[idx] = this.plotly_selected_point.color;
        dataset.marker.size[idx] = 5;
      }
      this.plotly_selected_point = null;
    }

    //data is copied into this to allow resort
    if(datasourceElement.datasource_mode=="feature") {
      for(var feat_idx=0; feat_idx<this.feature_array.length; feat_idx++) {
        var feature = this.feature_array[feat_idx];
        if(!feature) { continue; }
        
        var dataset = dset_name_hash[feature.plotly_dset_name];
        if(!dataset) { continue; }
        
        if(feature && feature.id == select_id) {
          console.log("found plotly selected feature at feat_idx:"+feat_idx+" plotly_idx:"+feature.plotly_dset_fidx);
          console.log("plotly_dset_name: "+feature.plotly_dset_name);
          console.log("plotly selected feature part of dataset: "+dataset.name+" color:"+dataset.backgroundColor);
          this.plotly_selected_point = { 
            color: dataset.backgroundColor,  //default background color for point
            dset_name: dataset.zenbuid,
            feat_idx: feat_idx,
            plotly_dset_fidx: feature.plotly_dset_fidx
          }
          dataset.marker.color[feature.plotly_dset_fidx] = "#ff3de8"; //"#ff75ef"; //"#ff00e1"; //"rgba(255,0,225,0.5)";
          dataset.marker.size[feature.plotly_dset_fidx] = 10;
        }
        
        if(datasourceElement.search_data_filter && !datasourceElement.show_only_search_matches && feature.search_match) {
          dataset.marker.color[feature.plotly_dset_fidx] = "#66edff"; //"#00e1ff"; //"rgba(0,225,255,0.5)";
          dataset.marker.size[feature.plotly_dset_fidx] = 7;
          //point_meta.custom.backgroundColor = "rgba(0,225,255,0.5)"; //0000D0
          //point_meta.custom.radius = 3;
        }

      }
    }
    /*
    if(datasourceElement.datasource_mode=="edge") {
      for(var j=0; j<this.edge_array.length; j++) {
        var edge = this.edge_array[j];
        if(edge && edge.id == select_id) {
          //console.log("found selected edge at idx:"+j);
          this.plotly_selected_point = { 
            color: this.chart_data.datasets[0].backgroundColor[j],
            idx: j
          }
          this.chart_data.datasets[0].backgroundColor[j] = "rgba(255,0,225,0.5)";
        }
      }
    }
    */

    //var update = {
    //  'marker.color': dataset.marker.color,
    //  'marker.size': dataset.marker.size,
    //};
    
    Plotly.newPlot(this.plotly_div, this.chart_data.datasets, this.plotly_layout);
    //Plotly.react(this.plotly_div, this.chart_data.datasets, this.plotly_layout);
    //Plotly.restyle(this.plotly_div, update, dataset.ds_idx);
  
        
    this.plotly_div.on('plotly_beforehover', function(eventdata) {
          //eventdata is a MouseEvent object
          //var points = eventdata.points[0],
          //pointNum = points.pointNumber;
          //console.log("plotly before_hover"+eventdata);
          //for(var type in eventdata) {
          //  console.log("plotly eventdata attrib["+type+"] value:"+eventdata[type]);
          //}
          //return false; //turn off the default hover info  
        }); 
    
    //var reportElement = this;
    //this.plotly_div.on('plotly_hover', function(eventdata) { zenbuChartElement_plotlyHoverEvent(eventdata, reportElement); });
    this.plotly_div.on('plotly_click', function(eventdata) { zenbuChartElement_plotlyClickEvent(eventdata, datasourceElement); });
  }
  
  
  if(this.display_type == "bubble") {
    if(!this.chart) { return; }
    if(!this.chart.data) { return; }
    if(!this.chart.data.datasets) { return; }

    //bubble/scatter code below
    console.log("this.chart.data.datasets.length = "+this.chart.data.datasets.length);
    for(var j=0; j<this.chart.data.datasets.length; j++) {
      var dataset = this.chart.data.datasets[j];
      
      //first pass move the selected/search points to the end of array so they are visible
      //for(var k=0; k<dataset.data.length-1; k++) {
      var selected_points = new Array();
      var k=0;
      while(k<dataset.data.length) {
        var point = dataset.data[k];
        point.selected = false;

        //if(point.feature1_id != select_id && point.feature2_id != select_id) { continue; }
        if(point.x_edge_id == select_id || point.y_edge_id == select_id || point.feature1_id==select_id || point.feature2_id == select_id || point.feature_id == select_id) {
          //console.log("chart ["+elementID+"] found matching selection point dataset["+j+"] point["+k+"]");
          point.selected = true;
          //need this point at the top, so need to move it to the end of the data array
          //first remove it, then push to back
          dataset.data.splice(k, 1);
          selected_points.push(point);
          continue;
        }
        
        if(datasourceElement.search_data_filter && point.search_match) {
          //console.log("chart ["+elementID+"] found search_match point dataset["+j+"] point["+k+"]");
          //need this point at the top, so need to move it to the end of the data array
          //first remove it, then push to back
          dataset.data.splice(k, 1);
          selected_points.push(point);
          continue;
        }
        k++;
      }
      for(k=0; k<selected_points.length; k++) {
        dataset.data.push(selected_points[k]);
      }

      //second pass modify the metadata
      let meta = this.chart.getDatasetMeta(j);
      for(var k=0; k<dataset.data.length; k++) {
        var point      = dataset.data[k];
        var point_meta = meta.data[k];
        if(!point_meta) { continue; }
        point_meta.custom = {};  //clear previous custom

        if(datasourceElement.search_data_filter && !datasourceElement.show_only_search_matches && point.search_match) {
          point_meta.custom.backgroundColor = "rgba(0,225,255,0.5)"; //0000D0
          point_meta.custom.radius = 3;
        }

        if(point.selected) {
          //then use custom meta to highlight last point
          //if(!point_meta.custom) {  point_meta.custom = {}; }
          point_meta.custom.backgroundColor = "rgba(255,0,225,0.5)";
          point_meta.custom.radius = 7;
        }
      }
    }
    //this.chart.update(0);
  }
}


/*  old process selections code
  if(reportElement.current_focus_point) {
    reportElement.current_focus_point.custom = {};
    reportElement.current_focus_point = null;
  }
  if(!reportElement.chart) { return; }
  if(!reportElement.chart.data) { return; }
  if(!reportElement.chart.data.datasets) { return; }
  
  if(reportElement.selected_edge) {
    console.log("reportElementShowSelectedFeature ["+elementID+"] has selected_edge change select_id to f2 ["+reportElement.selected_edge.feature2.id+"]");
    select_id = reportElement.selected_edge.feature2.id;
  }
  
  for(var j=0; j<reportElement.chart.data.datasets.length; j++) {
    var dataset = reportElement.chart.data.datasets[j];
    for(var k=0; k<dataset.data.length; k++) {
      var point = dataset.data[k];
      
      //if(point.feature1_id != select_id && point.feature2_id != select_id) { continue; }
      if(point.edge_id == select_id || point.feature1_id==select_id || point.feature2_id == select_id) {
        console.log("chart ["+elementID+"] found matching slection point dataset["+j+"] point["+k+"]");
        console.log('highlightPoint ['+point.edge_id+"]");
        
        //need this point at the top, so need to move it to the end of the data array
        //first remove it, then push to back
        dataset.data.splice(k, 1);
        dataset.data.push(point);
        
        //then use custom meta to highlight last point
        let meta = reportElement.chart.getDatasetMeta(j);
        let point2 = meta.data[dataset.data.length-1];
        point2.custom = point.custom || {};
        point2.custom.backgroundColor = "rgba(255,0,225,0.5)";
        point2.custom.radius = 7;
        
        reportElement.current_focus_point = point2;
        
        // first parameter to update is the animation duration.
        // if none is specified, the config animation duration
        // is used. Using 0 here will do the draw immediately.
        reportElement.chart.update(0);
        break;
      }
    }
  }
 */

//==========  Chart Render  =======================================================================

function zenbuChartElement_renderBubbleChart() {
  console.log("renderBubbleChart ["+this.elementID+"]");

  var main_div = this.main_div;
  if(!main_div) { return; }
  
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 50;
  width = width -10;
  console.log("bubble chart client width["+width+"] height["+height+"]");
  
  var canvas = document.createElement('canvas');
  canvas.id = this.main_div_id + "_chart_canvas";
  this.chart_canvas = canvas;
  main_div.appendChild(canvas);

  if(this.symetric_axis) {
     canvas.width  = width-50;
     canvas.height = width-50;
  } else {
     canvas.width  = width;
     canvas.height = height;
  }

  var ctx = canvas.getContext('2d');

  var xaxis_scale = "linear";
  var yaxis_scale = "linear";
  //if(this.xaxis.log) { xaxis_scale = "logarithmic"; }
  //if(this.yaxis.log) { yaxis_scale = "logarithmic"; }

  this.chart = new Chart(ctx, {
        type: 'bubble', 
        data: this.chart_data,
        options: { 
          //events: ['click']
          //onHover: reportsChartHoverEvent,
          onClick: reportsChartClickEvent,
          tooltips: {
             enabled: true, 
             //mode: 'index',
             //filter: function(tooltipItems, data) { return false; },
             callbacks: {
               //Use the footer callback to display additional point information
               title: function(id) { 
                          return function(tooltipItems, data) { 
                            return reportsChartTooltipEvent(id, tooltipItems, data, "title"); 
                          };}(this.elementID),
               footer: function(id) { 
                          return function(tooltipItems, data) { 
                            return reportsChartTooltipEvent(id, tooltipItems, data, "body"); 
                          };}(this.elementID),
             },
             footerFontStyle: 'normal'
          },
          hover: {
            //onHover: reportsChartHoverEvent
          }, 
          animation: { duration: 0 },
          scales: {
            xAxes: [{
                type: xaxis_scale,
                //type: "linear",
                //type: "logarithmic",
                scaleLabel: {
                  display: true,
                  labelString: this.xaxis.datatype + " " + this.xaxis.feature_name,
                },
                ticks: {
                  //min: this.xaxis.min_value,
                  //max: this.xaxis.max_value,
                  //min: -this.max_value,
                  //max: this.max_value,
                  //stepSize: 0.5
                }
                //stacked: true
            }],
            yAxes: [{
                type: yaxis_scale,
                //type: "linear",
                //type: "logarithmic",
                scaleLabel: {
                  display: true,
                  labelString: this.yaxis.datatype + " " + this.yaxis.feature_name,
                },
                ticks: {
                  //min: this.yaxis.min_value,
                  //max: this.yaxis.max_value,
                  //min: -this.max_value,
                  //max: this.max_value,
                  //stepSize: 0.5
                }
            }]
          },
        }
  });

  if(this.xaxis.fixedscale) {
    this.chart.options.scales.xAxes[0].ticks.min = this.xaxis.min_value;
    this.chart.options.scales.xAxes[0].ticks.max = this.xaxis.max_value;
  }
  if(this.yaxis.fixedscale) {
    this.chart.options.scales.yAxes[0].ticks.min = this.yaxis.min_value;
    this.chart.options.scales.yAxes[0].ticks.max = this.yaxis.max_value;
  }
  
  if(this.xaxis.log) {
    this.chart.options.scales.xAxes[0].scaleLabel.labelString = "log10 "+ this.xaxis.datatype + " " + this.xaxis.feature_name;
  }
  if(this.yaxis.log) {
    this.chart.options.scales.yAxes[0].scaleLabel.labelString = "log10 "+ this.yaxis.datatype + " " + this.yaxis.feature_name;
  }
  
  this.chart.update(0);

  this.chart.elementID = this.elementID;
}


function zenbuChartElement_draw() {
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }


  //if(!this.chart_data || !this.x_feature || !this.y_feature || datasourceElement.filter_count==0) {
  //if(!this.chart_data || !this.x_feature || !this.y_feature) {
  if(!this.chart_data) {
    var load_info = main_div.appendChild(document.createElement('span'));
    load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    load_info.innerHTML = "no data...";
    return;
  }
  
  if(this.display_type == "scatter3D") {
    this.drawPlotly3D();
    this.showSelections();
    return;
  }
  if(this.display_type == "ternary") {
    this.drawPlotlyTernary();
    this.showSelections();
    return;
  }

  //if(!this.chart_data) { return; }
  //if(!this.x_feature || !this.y_feature) { return; }
  if(this.display_type == "bar" || this.display_type == "line") {
    this.drawBarChart();
    return;
  }
  
  if(!this.chart) {
    if(this.display_type == "bubble") {
      this.renderBubbleChart();
    }
  }
  else {
    if(this.chart_canvas) { main_div.appendChild(this.chart_canvas); }
    if(this.chartTitleArea) { this.chartTitleArea.nodeValue = this.title; }

    this.chart.data = this.chart_data;

    if(this.xaxis.fixedscale) {
      this.chart.options.scales.xAxes[0].ticks.min = this.xaxis.min_value;
      this.chart.options.scales.xAxes[0].ticks.max = this.xaxis.max_value;
    }
    this.chart.options.scales.xAxes[0].scaleLabel.labelString = this.xaxis.datatype + " " + this.xaxis.feature_name;
    if(this.xaxis.log) {
      this.chart.options.scales.xAxes[0].scaleLabel.labelString = "log10 "+ this.xaxis.datatype + " " + this.xaxis.feature_name;
    }

    if(this.yaxis.fixedscale) {
      this.chart.options.scales.yAxes[0].ticks.min = this.yaxis.min_value;
      this.chart.options.scales.yAxes[0].ticks.max = this.yaxis.max_value;
    }
    this.chart.options.scales.yAxes[0].scaleLabel.labelString = this.yaxis.datatype + " " + this.yaxis.feature_name;
    if(this.yaxis.log) {
      this.chart.options.scales.yAxes[0].scaleLabel.labelString = "log10 "+ this.yaxis.datatype + " " + this.yaxis.feature_name;
    }
  }
  
  this.showSelections();
  if(this.chart) { this.chart.update(); }
}


function zenbuChartElement_drawBarChart() {
  console.log("zenbuChartElement_drawBarChart");
  if(this.loading) { return; }
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  
  var signal_dtype = this.datatypes[this.xaxis.datatype];

  if(this.chartTitleArea) { this.chartTitleArea.nodeValue = this.title; }
  
  var content_width = 100;
  var content_height = 100;
  if(this.content_width)  { content_width = this.content_width; }
  if(this.content_height) { content_height = this.content_height; }
  
  //clip & hidden scroll containers
  var tdiv = main_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "overflow:hidden; padding:0px; margin:0px;");
  if(current_report.edit_page_configuration) { tdiv.style.backgroundColor = "#F0F0F0"; }
  tdiv.style.width  = (content_width-2)+"px";
  tdiv.style.height = (content_height-24)+"px";
  
  var ctg_main_div = tdiv.appendChild(document.createElement('div'));
  ctg_main_div.setAttribute('style', "overflow-y:scroll;");
  ctg_main_div.style.width  = parseInt(content_width+30)+"px";
  ctg_main_div.style.height = parseInt(content_height-24)+"px";
  //ctg_main_div.innerHTML = "a piechart will go in here";
  
  var canvas = document.createElement('canvas');
  canvas.setAttribute('style', "margin-left:5px;");
  canvas.id = this.main_div_id + "_chart_canvas";
  this.chart_canvas = canvas;
  //main_div.appendChild(canvas);
  ctg_main_div.appendChild(canvas);

  canvas.width  = (content_width-10);
  canvas.height = (content_height-30);
  //console.log("pie chart canvas width["+canvas.width+"] height["+canvas.height+"]");
  
  var ctx = canvas.getContext('2d');
  
  var draw_type = "bar";
  var show_legend = true;
  //if(this.display_type == "piechart") { draw_type = "pie"; }
  //if(this.display_type == "doughnut") { draw_type = "doughnut"; }
  
  if(this.display_type == "line") { draw_type = "line"; show_legend = false; }
  if(this.display_type == "bar") { 
    draw_type = "bar"; show_legend = false;
    if(this.bar_orientation == "horizontal") { draw_type = "horizontalBar"; show_legend = false; }
  }
  if(this.chart_data.datasets.length > 1) { show_legend=true; }
  //var minRotate = 45;
  //if(this.chart_data.labels.length<=5) { minRotate = 0; }
  //minRotate=0;
  
  var options = { responsive: false,
                  maintainAspectRatio: false,
                  legend: { display: show_legend },
                  title: {
                    display: false,
                    text: ''
                  },
                  onClick: reportsChartClickEvent,
                  tooltips: {
                    enabled: true, 
                    //mode: 'index',
                    //filter: function(tooltipItems, data) { return false; },                    
                    
                    callbacks: {
                      //Use the footer callback to display additional point information
                      title: function(id) { 
                                  return function(tooltipItems, data) { 
                                    return reportsChartTooltipEvent(id, tooltipItems, data, "title"); 
                                  };}(this.elementID),
                      footer: function(id) { 
                                  return function(tooltipItems, data) { 
                                    return reportsChartTooltipEvent(id, tooltipItems, data, "body"); 
                                  };}(this.elementID),
                    },
                    footerFontStyle: 'normal'
                  },
                };
  if((this.display_type == "bar") || (this.display_type == "line")) {
    var signal_label = this.xaxis.datatype;
    if(signal_dtype) { signal_label = signal_dtype.title; }
    if(this.xaxis.log) {signal_label = "log10 "+ signal_label; }

    var show_bar_labels = this.show_bar_labels;
    if(this.chart_data.labels.length > this.content_width/15) { show_bar_labels=false; }

    var stacked = this.stacked;

    options.scales = { 
      xAxes: [{
        ticks: { display:show_bar_labels, autoSkip:false, /*minRotation:minRotate,*/ maxRotation:90, padding:2, fontSize:8 },
        gridLines: { display:false },
        categoryPercentage:1,
      }],
      yAxes: [{ 
        ticks: { display:true, autoSkip:false, padding:2, fontSize:8 },
        scaleLabel: {
          display: true,
          labelString: signal_label,
        },
        gridLines:{ display:true },
        categoryPercentage:1,
        stacked: this.stacked,
      }]
    };
    
    if(this.chart_data.labels.length > this.content_width) { 
      options.scales.xAxes[0].barThickness = 1;
      options.scales.yAxes[0].barThickness = 1;
      options.scales.xAxes[0].barPercentage = 1;
      options.scales.yAxes[0].barPercentage = 1;
    }
    if(this.chart_data.labels.length > this.content_width/10) { 
      options.scales.yAxes[0].ticks.autoSkip = true;
      options.scales.xAxes[0].ticks.autoSkip = true;
    }

    if(this.bar_orientation == "horizontal") { 
      //this.chart.options.scales.yAxes[0].scaleLabel.labelString = "log10 "+ this.xaxis.datatype;
      options.scales.xAxes[0].scaleLabel = { display: true, labelString: signal_label, };
      options.scales.xAxes[0].ticks.display = true;
      //delete options.scales.xAxes[0].ticks.minRotation;
      options.scales.xAxes[0].gridLines.display = true;
      options.scales.xAxes[0].stacked = this.stacked;
      
      options.scales.yAxes[0].scaleLabel.display = false;
      options.scales.yAxes[0].ticks.display = show_bar_labels;
      //options.scales.yAxes[0].ticks.autoSkip = true;
      options.scales.yAxes[0].gridLines.display = false;
      options.scales.yAxes[0].stacked = false;
      
    }
  }
  
  /*
  if(this.display_type == "horizontalBar") {
    var signal_label = "count";
    if(this.category_method!="count") {
      var dtype_col = datasourceElement.datatypes[this.ctg_value_datatype];
      if(dtype_col) {
        signal_label = dtype_col.title;
        //if(dtype_col.title != dtype_col.datatype) { signal_label += " ["+ dtype_col.datatype +"]"; }
      }
    }

    options.scales = { 
      xAxes: [{ 
        ticks: { padding:2, fontSize:8 },
        scaleLabel: {
          display: true,
          labelString: signal_label,
        },
      }],
      yAxes: [{ 
        ticks: { autoSkip:false, minRotation:0, padding:2, fontSize:10 }, 
      }]
    };
    if(this.category_method=="count") { options.scales.xAxes[0].ticks.min = 0; }
  }
  */
  
  if(this.xaxis.fixedscale) {
    if(this.bar_orientation == "horizontal") { 
      options.scales.xAxes[0].ticks.min = this.xaxis.min_value;
      options.scales.xAxes[0].ticks.max = this.xaxis.max_value;
    }
    else {
      options.scales.yAxes[0].ticks.min = this.xaxis.min_value;
      options.scales.yAxes[0].ticks.max = this.xaxis.max_value;
    }
    //this.chart.options.scales.xAxes[0].scaleLabel.labelString = this.xaxis.datatype + " " + this.xaxis.feature_name;
    //if(this.xaxis.log) {
    //  this.chart.options.scales.xAxes[0].scaleLabel.labelString = "log10 "+ this.xaxis.datatype + " " + this.xaxis.feature_name;
    //}
    //this.chart.options.scales.yAxes[0].scaleLabel.labelString = this.yaxis.datatype + " " + this.yaxis.feature_name;
    //if(this.yaxis.log) {
    //  this.chart.options.scales.yAxes[0].scaleLabel.labelString = "log10 "; this.yaxis.datatype + " " + this.yaxis.feature_name;
    //}
  }
  
  this.chart = new Chart(ctx, {   type: draw_type,
                                  data: this.chart_data,
                                  options: options
                                  });
                                  
  this.chart.elementID = this.elementID;
  this.chart.update(0);
}



function ZenbuChartElement_drawPlotly3D() {
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  var content_width = 100;
  var content_height = 100;
  if(this.content_width)  { content_width = this.content_width; }
  if(this.content_height) { content_height = this.content_height; }
  
  //clip & hidden scroll containers
  var clip_div = main_div.appendChild(document.createElement('div'));
  clip_div.setAttribute('style', "overflow:hidden; padding:0px; margin:0px;");
  //clip_div.setAttribute('style', "overflow:scroll; padding:0px; margin:0px;");
  //if(current_report.edit_page_configuration) { clip_div.style.backgroundColor = "#F0F0F0"; }
  //if(current_report.edit_page_configuration) { clip_div.style.backgroundColor = "pink"; }
  clip_div.style.width  = (content_width-5)+"px";
  clip_div.style.height = (content_height-24)+"px";
  
  var plot_div = clip_div.appendChild(document.createElement('div'));
  plot_div.style.width  = parseInt(content_width-8)+"px";
  plot_div.style.height = parseInt(content_height-26)+"px";
        
  var xaxis_label = this.chart_data.xaxis_dtype.title;
  var yaxis_label = this.chart_data.yaxis_dtype.title;
  var zaxis_label = this.chart_data.zaxis_dtype.title;
  if(this.xaxis.log) { xaxis_label = "log10 "+xaxis_label; }
  if(this.yaxis.log) { yaxis_label = "log10 "+yaxis_label; }
  if(this.zaxis.log) { zaxis_label = "log10 "+zaxis_label; }
  
  var layout = {
    showlegend: true,
    margin: { l: 0, r: 0, b: 20, t: 20 },
    scene: {aspectmode: "cube", 
            xaxis: {title: xaxis_label, titlefont: { size: 12 }},
            yaxis: {title: yaxis_label, titlefont: { size: 12 }},
            zaxis: {title: zaxis_label, titlefont: { size: 12 }}}
  };

  Plotly.newPlot( plot_div, this.chart_data.datasets, layout );
  //console.log( Plotly.BUILD );   // Current Plotly.js version

  this.plotly_div = plot_div;
  this.plotly_layout = layout;
  
  this.plotly_div.on('plotly_click', function(eventdata) { zenbuChartElement_plotlyClickEvent(eventdata, datasourceElement); });
}


function plotlyMakeAxis(title, tickangle) {
    return {
      title: title,
      titlefont: { size: 14 },
      tickangle: tickangle,
      tickfont: { size: 12 },
      tickcolor: 'rgba(0,0,0,0)',
      ticklen: 5,
      showline: true,
      showgrid: true
    };
}


function ZenbuChartElement_drawPlotlyTernary() {
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  /*
  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  
  var signal_dtype = this.datatypes[this.xaxis.datatype];

  if(this.chartTitleArea) { this.chartTitleArea.nodeValue = this.title; }
  */
  var content_width = 100;
  var content_height = 100;
  if(this.content_width)  { content_width = this.content_width; }
  if(this.content_height) { content_height = this.content_height; }
  
  //clip & hidden scroll containers
  var clip_div = main_div.appendChild(document.createElement('div'));
  clip_div.setAttribute('style', "overflow:hidden; padding:0px; margin:0px;");
  //clip_div.setAttribute('style', "overflow:scroll; padding:0px; margin:0px;");
  //if(current_report.edit_page_configuration) { clip_div.style.backgroundColor = "#F0F0F0"; }
  //if(current_report.edit_page_configuration) { clip_div.style.backgroundColor = "pink"; }
  clip_div.style.width  = (content_width-5)+"px";
  clip_div.style.height = (content_height-24)+"px";
  
  var plot_div = clip_div.appendChild(document.createElement('div'));
  plot_div.style.width  = parseInt(content_width-8)+"px";
  plot_div.style.height = parseInt(content_height-26)+"px";
  
  var layout = {
      showlegend: true,
      //margin: { l: 20, r: 0, b: 20, t: 20 },
      margin: { b:50, l:70, r:0, t: 30 },
      ternary: {
          sum: this.ternary_sum,
          aaxis: plotlyMakeAxis(this.chart_data.xaxis_dtype.title, 0),
          baxis: plotlyMakeAxis("<br>"+this.chart_data.yaxis_dtype.title, 45),
          caxis: plotlyMakeAxis("<br>"+this.chart_data.zaxis_dtype.title, -45),
          bgcolor: "hsl(33, 100%, 97%)"    //'#fff1e0'
      },
      /*
      annotations: [{
        showarrow: false,
        text: 'Replica of Tom Pearson\'s <a href="http://bl.ocks.org/tomgp/7674234">block</a>',
          x: 1.0,
          y: 1.3,
          font: { size: 15 }
      }],*/
      //paper_bgcolor: '#fff1e0',
  };

  Plotly.newPlot(plot_div, this.chart_data.datasets, layout);
  
  //plot_div.on('plotly_beforehover',function(){ return false; }); //turn off the default hover
  
  this.plotly_div = plot_div;
  this.plotly_layout = layout;

  //var reportElement = this;
  //this.plotly_div.on('plotly_hover', function(eventdata) { zenbuChartElement_plotlyHoverEvent(eventdata, reportElement); });
  this.plotly_div.on('plotly_click', function(eventdata) { zenbuChartElement_plotlyClickEvent(eventdata, datasourceElement); });
}


function zenbuChartElement_plotlyClickEvent(eventdata, datasourceElement) {
  console.log("zenbuChartElement_plotlyClickEvent");  
  if(!eventdata || !eventdata.points || !datasourceElement) { return; }
  var point = eventdata.points[0]; //maybe array of selected points?
  if(!point) { return; }
  if(point.customdata) { //feature/edge/ object
    console.log("plotly clicked fid:"+point.customdata.id+"  name:"+point.customdata.name);
    reportElementEvent(datasourceElement.elementID, 'select', point.customdata.id);
  }
}

function zenbuChartElement_plotlyHoverEvent(eventdata, reportElement) {
  if(!eventdata || !eventdata.points) { return; }
  var point = eventdata.points[0];
  if(!point) { return; }
  var pointNum = point.pointNumber;
  //console.log("zenbuChartElement_plotlyHoverEvent pointNum:"+pointNum);
  if(point.customdata) {
    console.log("plotly hover id:"+point.customdata.id+"  name:"+point.customdata.name);
    //zenbuReports_hoverInfo(reportElement, point.customdata);  
  }
  //for(var type in eventdata) {
  //  console.log("plotly eventdata attrib["+type+"] value:"+eventdata[type]);
  //}
  //event data returns event: MouseEvent, point:Object, xaxes:Object, yaxis:Object, xvals, yvals

  //Plotly.Fx.hover(this.plotly_div,[
  //    { curveNumber:0, pointNumber:pointNum },
  //    { curveNumber:1, pointNumber:pointNum },
  //    { curveNumber:2, pointNumber:pointNum },
  //]);
  //hoverInfo.innerHTML += "<h3>does this work? pointnum:"+pointNum+"</h3>";
}



//==========  Chart Config  =======================================================================

function zenbuChartElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;

  var datasourceElement = this;
  var datasourceElementID = this.datasourceElementID;
  if(this.newconfig && this.newconfig.datasourceElementID != undefined) { datasourceElementID = this.newconfig.datasourceElementID; }
  if(datasourceElementID) {
    datasourceElement = current_report.elements[datasourceElementID];
    this.datasourceElement = datasourceElement;
  }
  if(!datasourceElement) { datasourceElement = this; }
    
  var datasource_mode = datasourceElement.datasource_mode;
  if(this.newconfig && this.newconfig.datasource_mode != undefined) { 
    datasource_mode = this.newconfig.datasource_mode; 
  }

  if(datasource_mode == "edge") {
    var focus_feature_mode = this.focus_feature_mode;
    if(this.newconfig && this.newconfig.focus_feature_mode != undefined) { focus_feature_mode = this.newconfig.focus_feature_mode; }
    
    tdiv2  = configdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "margin: 2px 1px 0px 5px;");
    tdiv2.innerHTML = "edge source options:";

    tdiv2  = configdiv.appendChild(document.createElement('div'));
    tdiv2.style.marginLeft = "10px";
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 2px 1px 0px 5px;");
    tspan2.innerHTML = "focus feature filter: ";
    
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', this.elementID + "_config_focus_feature_mode_radio");
    tradio.setAttribute('value', "ignore");
    tradio.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'focus_feature_mode', 'ignore');");
    if(focus_feature_mode=="ignore") { tradio.setAttribute('checked', "checked"); }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "ignore";
    var msg = "<div style='text-align:left; padding:3px;'>the focus_feature is ignored and ALL edges in datasource will be plotted</div>";
    tradio.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",200);");
    tradio.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",200);");
    tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");


    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', this.elementID + "_config_focus_feature_mode_radio");
    tradio.setAttribute('value', "current");
    tradio.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'focus_feature_mode', 'current');");
    if(focus_feature_mode=="current") { tradio.setAttribute('checked', "checked"); }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "current";
    var msg = "<div style='text-align:left; padding:3px;'>the focus_feature is used so only edges connected to the focus_feature will be plotted</div>";
    tradio.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",230);");
    tradio.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",230);");
    tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', this.elementID + "_config_focus_feature_mode_radio");
    tradio.setAttribute('value', "progressive");
    tradio.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'focus_feature_mode', 'progressive');");
    if(focus_feature_mode=="progressive") { tradio.setAttribute('checked', "checked"); }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "dual progressive";
    var msg = "<div style='text-align:left; padding:3px;'>both the current and previous focus_feature will be used and mapped to different axes progressively. Points are linked via the feature2 of the progressive edges.<br>This special mode allows for creating correlation or concordance type plots.</div>";
    tradio.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",280);");
    tradio.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",280);");
    tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  }
  
  
  //display_type
  var display_type = this.display_type;
  if(this.newconfig && this.newconfig.display_type != undefined) { display_type = this.newconfig.display_type; }
  
  var tdiv2 = configdiv.appendChild(document.createElement("div"));
  tdiv2.style.marginTop = "5px";
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 0px;");
  span1.innerHTML = "chart type: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  //select.setAttribute("style", "font-size:10px;");
  select.className = "dropdown";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'display_type', this.value);");
  var types = ["bubble", "bar", "line", "scatter3D", "ternary"]; // "piechart", "doughnut"];
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == display_type) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }
  
  if(display_type=="bubble") { 
    this.configBubbleChart(datasourceElement); 
    //legend mode at bottom
    this.configLegendGroupMode(datasourceElement);
  }
  if((display_type=="bar")||(display_type=="line"))  { 
    this.configBarChart(datasourceElement); 
  }
  if(display_type=="scatter3D") { 
    this.configPlotly3D(datasourceElement);
  }
  if((display_type=="scatter3D") || (display_type=="ternary")) { 
    this.configLegendGroupMode(datasourceElement); //legend mode at bottom
  }
  
}


function zenbuChartElement_configLegendGroupMode(datasourceElement) {
  if(!this.config_options_div) { return; }  
  var configdiv = this.config_options_div;

  //------------------------
  var legend_group_mode = this.legend_group_mode;
  if(this.newconfig && this.newconfig.legend_group_mode != undefined) { legend_group_mode = this.newconfig.legend_group_mode; }

  var legendConfigDiv = configdiv.appendChild(document.createElement('div'));
  legendConfigDiv.style.marginLeft = "5px";
  legendConfigDiv.style.marginBottom = "10px";

  tdiv2 = legendConfigDiv.appendChild(document.createElement('div'));
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "margin: 2px 1px 0px 0px;");
  tspan2.innerHTML = "legend grouping mode: ";
  
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', this.elementID + "_config_legend_group_mode_radio");
  tradio.setAttribute('value', "focus_feature");
  tradio.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'legend_group_mode', 'focus_feature');");
  if(legend_group_mode=="focus_feature") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "default";
  var msg = "<div style='text-align:left; padding:3px;'>the focus_feature is used to segment the legend groups</div>";
  tradio.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",200);");
  tradio.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",200);");
  tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', this.elementID + "_config_legend_group_mode_radio");
  tradio.setAttribute('value', "category_mdata");
  tradio.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'legend_group_mode', 'category_mdata');");
  if(legend_group_mode=="category_mdata") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "category column metadata";
  var msg = "<div style='text-align:left; padding:3px;'>a metadata column of the edge is used to create categories which are mapped to different legend-groups for plotting.</div>";
  tradio.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",280);");
  tradio.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",280);");
  tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  
  if(legend_group_mode=="category_mdata") {
    //column datatype selection options
    var tdiv2 = legendConfigDiv.appendChild(document.createElement("div"));
    tdiv2.setAttribute('style', "margin-top: 5px;");
    var span1 = tdiv2.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin: 2px 1px 2px 15px;");
    span1.innerHTML = "category column: ";
    var select = tdiv2.appendChild(document.createElement('select'));
    select.className = "dropdown";
    select.style.fontSize = "10px";
    select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'category_datatype', this.value);");

    //hide_zero
    //tdiv2  = legendConfigDiv.appendChild(document.createElement('div'));
    //tcheck = tdiv2.appendChild(document.createElement('input'));
    //tcheck.setAttribute('style', "margin: 3px 1px 0px 15px;");
    //tcheck.setAttribute('type', "checkbox");
    //var val1 = this.hide_zero;
    //if(this.newconfig && this.newconfig.hide_zero != undefined) { val1 = this.newconfig.hide_zero; }
    //if(val1) { tcheck.setAttribute('checked', "checked"); }
    //tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'hide_zero', this.checked);");
    //tspan2 = tdiv2.appendChild(document.createElement('span'));
    //tspan2.innerHTML = "hide zero value categories";

    if(datasourceElement.dtype_columns) {
      datasourceElement.dtype_columns.sort(reports_column_order_sort_func);
      var columns = datasourceElement.dtype_columns;

      var category_datatype = this.category_datatype;
      if(this.newconfig && this.newconfig.category_datatype != undefined) { category_datatype = this.newconfig.category_datatype; }

      var selected_dtype = null;
      for(var i=0; i<columns.length; i++) {
        var dtype_col = columns[i];
        if(!dtype_col) { continue; }
        //if((dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) { continue; }

        //var option = select.appendChild(document.createElement('option'));
        var option = document.createElement('option');
        option.setAttribute("style", "font-size:10px;");
        if(dtype_col.visible) { option.style.color = "blue"; }

        option.setAttribute("value", dtype_col.datatype);
        
        var label =  dtype_col.title;
        if(dtype_col.title != dtype_col.datatype) {
          label +=  " ["+ dtype_col.datatype +"]";
        }
        option.innerHTML = label;

        if(dtype_col.col_type == "mdata") {
          if(dtype_col.datatype == category_datatype) { option.setAttribute("selected", "selected"); }
          select.appendChild(option);
        }
      }
    }
    
    //add a color spectrum picker
    tdiv2  = legendConfigDiv.appendChild(document.createElement('div'));
    tdiv2.style.marginTop = "10px";
    tdiv2.appendChild(reportElementColorSpaceOptions(this));
  }
}


function zenbuChartElement_configBubbleChart(datasourceElement) {
  if(!this.config_options_div) { return; }  
  var configdiv = this.config_options_div;

  //-----------
  ttable  = configdiv.appendChild(document.createElement('table'));
  ttable.setAttribute('cellspacing', "0");
  ttable.setAttribute('style', "font-size:10px; margin-top:5px; ");
  //----------

  // datatype select -------------
  var columns_div = zenbuChartElement_signalColumnsInterface(this, configdiv);

  // axis control table ----------
  ttable  = configdiv.appendChild(document.createElement('table'));
  ttable.setAttribute('cellspacing', "0");
  ttable.setAttribute('style', "font-size:12px; margin:auto; border: 2px solid gray; padding:3px 10px 3px 10px;");
//  this.xaxis = { datatype: "log2FC", fixedscale:true, symetric: true };

  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "text-align:center;");
  tdiv2.innerHTML = "x-axis";
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "text-align:center;");
  tdiv2.innerHTML = "y-axis";

  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray;  padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.fixedscale;
  if(this.newconfig && this.newconfig.xaxis_fixedscale != undefined) { val1 = this.newconfig.xaxis_fixedscale; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  //if(this.xaxis.fixedscale) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_fixedscale', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "fixed scale";

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.yaxis.fixedscale;
  if(this.newconfig && this.newconfig.yaxis_fixedscale != undefined) { val1 = this.newconfig.yaxis_fixedscale; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  //if(this.yaxis.fixedscale) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_fixedscale', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "fixed scale";

  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.symetric;
  if(this.newconfig && this.newconfig.xaxis_symetric != undefined) { val1 = this.newconfig.xaxis_symetric; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_symetric', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "symetric +/- scaling";

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.yaxis.symetric;
  if(this.newconfig && this.newconfig.yaxis_symetric != undefined) { val1 = this.newconfig.yaxis_symetric; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_symetric', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "symetric +/- scaling";

  ttr  = ttable.appendChild(document.createElement('tr'));
  
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.log;
  if(this.newconfig && this.newconfig.xaxis_log != undefined) { val1 = this.newconfig.xaxis_log; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_log', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "log scale";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.yaxis.log;
  if(this.newconfig && this.newconfig.yaxis_log != undefined) { val1 = this.newconfig.yaxis_log; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_log', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "log scale";

  /*
  //--- datatype select
  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv  = ttd.appendChild(document.createElement('div'));
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "datatype:";
  var dtypeSelect = tdiv.appendChild(document.createElement('select'));
  dtypeSelect.setAttribute('name', "datatype");
  dtypeSelect.className = "dropdown";  
  dtypeSelect.style.fontSize = "10px";
  //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_datatype', this.value); return false");
  //dtypeSelect.setAttribute("onchange", "dexCollaborationMoveEvent(this.value);");
  var option = dtypeSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.innerHTML = "please select";
  var val1 = this.xaxis.datatype;
  if(this.newconfig && this.newconfig.xaxis_datatype != undefined) { val1 = this.newconfig.xaxis_datatype; }
  for(var dtype in datasourceElement.datatypes) {
    var dtype_col = datasourceElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }
    var option = dtypeSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", dtype_col.datatype);
    if(val1 == dtype) { option.setAttribute("selected", "selected"); }
    option.innerHTML = dtype_col.title;
  }

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv  = ttd.appendChild(document.createElement('div'));
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "datatype:";
  var dtypeSelect = tdiv.appendChild(document.createElement('select'));
  dtypeSelect.setAttribute('name', "datatype");
  dtypeSelect.className = "dropdown";
  dtypeSelect.style.fontSize = "10px";
  //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_datatype', this.value); return false");
  //dtypeSelect.setAttribute("onchange", "dexCollaborationMoveEvent(this.value);");
  var option = dtypeSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.innerHTML = "please select";
  var val1 = this.yaxis.datatype;
  if(this.newconfig && this.newconfig.yaxis_datatype != undefined) { val1 = this.newconfig.yaxis_datatype; }
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
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('colspan', 2);
  var tdiv2= ttd.appendChild(document.createElement('div'));
  //tdiv2.setAttribute("style", "margin:5px 1px 3px 5px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 0px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.symetric_axis;
  if(this.newconfig && this.newconfig.symetric_axis != undefined) { val1 = this.newconfig.symetric_axis; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'symetric_axis', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "square symetric axis scaling";
}


function zenbuChartElement_configBarChart(datasourceElement) {
  if(!this.config_options_div) { return; }  
  var configdiv = this.config_options_div;

  var barConfigDiv  = configdiv.appendChild(document.createElement('div'));
  barConfigDiv.style.marginLeft = "5px";
  barConfigDiv.style.marginBottom = "10px";

  var display_type = this.display_type;
  if(this.newconfig && this.newconfig.display_type != undefined) { display_type = this.newconfig.display_type; }

  // bar orientation radio ------------------
  var bar_orientation = this.bar_orientation;
  if(this.newconfig && this.newconfig.bar_orientation != undefined) { bar_orientation = this.newconfig.bar_orientation; }

  if(display_type == "bar") {
    tdiv2  = barConfigDiv.appendChild(document.createElement('div'));
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 2px 1px 0px 0px;");
    tspan2.innerHTML = "orientation: ";
    var types = ["vertical", "horizontal"];
    for(var i=0; i<types.length; i++) {
      var val1 = types[i];    
      tradio = tdiv2.appendChild(document.createElement('input'));
      tradio.setAttribute('type', "radio");
      tradio.setAttribute('name', this.elementID + "_config_bar_orientation_radio");
      tradio.setAttribute('value', val1);
      tradio.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'bar_orientation', '"+val1+"');");
      if(bar_orientation==val1) { tradio.setAttribute('checked', "checked"); }
      tspan2 = tdiv2.appendChild(document.createElement('span'));
      tspan2.innerHTML = val1;
    }
  }
  
  // bar order radio ------------------
  var bar_order = this.bar_order;
  if(this.newconfig && this.newconfig.bar_order != undefined) { bar_order = this.newconfig.bar_order; }
  var show_bar_labels = this.show_bar_labels;
  if(this.newconfig && this.newconfig.show_bar_labels != undefined) { show_bar_labels = this.newconfig.show_bar_labels; }

  tdiv2  = barConfigDiv.appendChild(document.createElement('div'));
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "margin: 2px 1px 0px 0px;");
  tspan2.innerHTML = display_type+" order: ";
  var barOrderSelect = tdiv2.appendChild(document.createElement('select'));
  barOrderSelect.setAttribute('name', "bar_order");
  barOrderSelect.className = "dropdown";  
  barOrderSelect.style.fontSize = "10px";
  barOrderSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'bar_order', this.value); return false");
  var types = ["original", "signal descending", "signal ascending"]; //"metadata label";
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = barOrderSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(bar_order == val1) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }
  
  // bar label section -------------  
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 2px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  if(show_bar_labels) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_bar_labels', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show "+display_type+" labels";

  //stacked
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 2px 0px 10px;");
  tcheck.setAttribute('type', "checkbox");
  var stacked = this.stacked;
  if(this.newconfig && this.newconfig.stacked != undefined) { stacked = this.newconfig.stacked; }
  if(stacked) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'stacked', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "stacked";

  //==== signal axis control table ----------
  //will use the xaxis for configuration since we only need one signal axis
  //will use the bar_orientation to decide how to draw
  
  // datatype select -------------
  var columns_div = zenbuChartElement_signalColumnsInterface(this, barConfigDiv);

  /*
  //this will be replaced with logic where by the first signal column is the one for sort order
  
  tdiv2  = barConfigDiv.appendChild(document.createElement('div'));
  tdiv2.style.marginLeft = "10px"
  var tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.style.marginRight = "3px";
  tspan.innerHTML = "active signal datatype:";
  var dtypeSelect = tdiv2.appendChild(document.createElement('select'));
  dtypeSelect.setAttribute('name', "datatype");
  dtypeSelect.className = "dropdown";  
  dtypeSelect.style.fontSize = "10px";
  dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_datatype', this.value); return false");
  var option = dtypeSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.innerHTML = "please select";
  var val1 = this.xaxis.datatype;
  if(this.newconfig && this.newconfig.xaxis_datatype != undefined) { val1 = this.newconfig.xaxis_datatype; }
  for(var dtype in this.datatypes) {
    var dtype_col = this.datatypes[dtype];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }
    if(!dtype_col.signal_active) { continue; }
    var option = dtypeSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", dtype_col.datatype);
    if(val1 == dtype) { option.setAttribute("selected", "selected"); }
    var label =  dtype_col.title;
    if(dtype_col.title != dtype_col.datatype) {
      label +=  " ["+ dtype_col.datatype +"]";
    }
    option.innerHTML = label;
  }
  */
  
  //add a color spectrum picker
  tdiv2  = barConfigDiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin: 0px 2px 5px 5px;");
  tdiv2.appendChild(reportElementColorSpaceOptions(this));


  // other options ----------------
  tdiv2  = barConfigDiv.appendChild(document.createElement('div'));
  tdiv2.style.marginLeft = "10px";
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 2px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.fixedscale;
  if(this.newconfig && this.newconfig.xaxis_fixedscale != undefined) { val1 = this.newconfig.xaxis_fixedscale; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_fixedscale', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "fixed scale";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 2px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.symetric;
  if(this.newconfig && this.newconfig.xaxis_symetric != undefined) { val1 = this.newconfig.xaxis_symetric; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_symetric', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "symetric +/- scaling";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 2px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.log;
  if(this.newconfig && this.newconfig.xaxis_log != undefined) { val1 = this.newconfig.xaxis_log; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_log', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "log scale";  
  
  //hide_zero
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 2px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.hide_zero;
  if(this.newconfig && this.newconfig.hide_zero != undefined) { val1 = this.newconfig.hide_zero; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'hide_zero', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide zeros";
}


function zenbuChartElement_configPlotly3D(datasourceElement) {
  if(!this.config_options_div) { return; }  
  var configdiv = this.config_options_div;

  //-----------
  ttable  = configdiv.appendChild(document.createElement('table'));
  ttable.setAttribute('cellspacing', "0");
  ttable.setAttribute('style', "font-size:10px; margin-top:5px; ");
  //----------

  // datatype select -------------
  var columns_div = zenbuChartElement_signalColumnsInterface(this, configdiv);

  // axis control table ----------
  ttable  = configdiv.appendChild(document.createElement('table'));
  ttable.setAttribute('cellspacing', "0");
  ttable.setAttribute('style', "font-size:12px; margin:auto; border: 2px solid gray; padding:3px 10px 3px 10px;");
//  this.xaxis = { datatype: "log2FC", fixedscale:true, symetric: true };

  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "text-align:center;");
  tdiv2.innerHTML = "x-axis";
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "text-align:center;");
  tdiv2.innerHTML = "y-axis";
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "text-align:center;");
  tdiv2.innerHTML = "z-axis";

  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray;  padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.fixedscale;
  if(this.newconfig && this.newconfig.xaxis_fixedscale != undefined) { val1 = this.newconfig.xaxis_fixedscale; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  //if(this.xaxis.fixedscale) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_fixedscale', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "fixed scale";

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.yaxis.fixedscale;
  if(this.newconfig && this.newconfig.yaxis_fixedscale != undefined) { val1 = this.newconfig.yaxis_fixedscale; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  //if(this.yaxis.fixedscale) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_fixedscale', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "fixed scale";

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.zaxis.fixedscale;
  if(this.newconfig && this.newconfig.zaxis_fixedscale != undefined) { val1 = this.newconfig.zaxis_fixedscale; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'zaxis_fixedscale', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "fixed scale";

  ttr  = ttable.appendChild(document.createElement('tr'));

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.symetric;
  if(this.newconfig && this.newconfig.xaxis_symetric != undefined) { val1 = this.newconfig.xaxis_symetric; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_symetric', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "symetric +/-";

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.yaxis.symetric;
  if(this.newconfig && this.newconfig.yaxis_symetric != undefined) { val1 = this.newconfig.yaxis_symetric; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_symetric', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "symetric +/-";

  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.zaxis.symetric;
  if(this.newconfig && this.newconfig.zaxis_symetric != undefined) { val1 = this.newconfig.zaxis_symetric; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'zaxis_symetric', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "symetric +/-";

  ttr  = ttable.appendChild(document.createElement('tr'));
  
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-right: solid 1px gray; padding-right:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.xaxis.log;
  if(this.newconfig && this.newconfig.xaxis_log != undefined) { val1 = this.newconfig.xaxis_log; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'xaxis_log', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "log scale";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.yaxis.log;
  if(this.newconfig && this.newconfig.yaxis_log != undefined) { val1 = this.newconfig.yaxis_log; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'yaxis_log', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "log scale";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('style', "border-left: solid 1px gray; padding-left:5px;");
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.zaxis.log;
  if(this.newconfig && this.newconfig.zaxis_log != undefined) { val1 = this.newconfig.zaxis_log; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'zaxis_log', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "log scale";

  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  ttd.setAttribute('colspan', 2);
  var tdiv2= ttd.appendChild(document.createElement('div'));
  //tdiv2.setAttribute("style", "margin:5px 1px 3px 5px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 0px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.symetric_axis;
  if(this.newconfig && this.newconfig.symetric_axis != undefined) { val1 = this.newconfig.symetric_axis; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'symetric_axis', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "square symetric axis scaling";
}


function zenbuChartElement_signalColumnsInterface(reportElement, barConfigDiv) {
  if(!reportElement) { return; }
  if(!reportElement.signal_columns_div) {
    reportElement.signal_columns_div = document.createElement('div');
  }
  var columns_main_div = reportElement.signal_columns_div;
  columns_main_div.setAttribute('style', "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif");
  columns_main_div.innerHTML = "";

  barConfigDiv.appendChild(columns_main_div);

  var mainRect = reportElement.main_div.getBoundingClientRect();
  console.log("mainRect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" right:"+mainRect.right+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
   
  button = columns_main_div.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  button.value = "edit signal axis datatypes";
  button.innerHTML = "signal axis datatypes";
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+reportElement.elementID+"\", 'signal_columns_div_visible');");

  if(!reportElement.newconfig || !reportElement.newconfig.signal_columns_div_visible) {
    return columns_main_div;
  }
  var buttonRect = button.getBoundingClientRect();
  console.log("buttonRect x:"+buttonRect.x+" y:"+buttonRect.y+" left:"+buttonRect.left+" right:"+buttonRect.right+" top:"+buttonRect.top+" bottom:"+buttonRect.bottom);

  var columns_div = columns_main_div.appendChild(document.createElement("div"));

  var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
  style += "background-color:rgb(245,245,250); ";
  //style += "background-color:#FDFDFD; ";
  style += "padding: 5px 5px 5px 5px; min-width:180px; ";
  style += "border:inset; border-width:2px; white-space: nowrap; ";
  //style += "display:none; opacity: 1.0; ";
  style += "position:absolute; left:180px; top:"+(buttonRect.top-mainRect.top-30)+"px; z-index:100; ";
  columns_div.setAttribute('style', style);

  //close button
  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onmousedown", "reportElementReconfigParam(\""+reportElement.elementID+"\", 'signal_columns_div_visible'); return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "white-space: nowrap; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "signal axis datatype layers";

  columns_div.appendChild(document.createElement('hr'));

  reportElementColumnsInterfaceRender(reportElement, columns_div, "signalOnly");

  return  columns_main_div;
}


//=================================================================================
//
// helper functions
//
//=================================================================================

function reports_edge_feature2_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
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


function chart_element_signal_orig_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.chart_signal===undefined) { return 1; }
  if(b.chart_signal===undefined) { return -1; }
  return 0;
}
function chart_element_signal_desc_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.chart_signal===undefined) { return 1; }
  if(b.chart_signal===undefined) { return -1; }
  if(a.chart_signal > b.chart_signal) { return -1; }
  if(a.chart_signal < b.chart_signal) { return  1; }
  return 0;
}
function chart_element_signal_asc_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.chart_signal===undefined) { return 1; }
  if(b.chart_signal===undefined) { return -1; }
  if(a.chart_signal < b.chart_signal) { return -1; }
  if(a.chart_signal > b.chart_signal) { return  1; }
  return 0;
}


function reportsChartHoverEvent(event, data1, data2) {
  var message = "hover event";
  var width = 100;
  toolTipWidth=width;
  var object_html = "<div style=\"text-align:center; font-size:10px; font-family:arial,helvetica,sans-serif; "+
  "width:"+width+"px; z-index:100; "+
  "background-color:lavender; border:groove; "+
  "opacity: 0.95; \">";
  object_html += "<div>" + message +"</div>";
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


function reportsChartTooltipEvent(elementID, tooltipItems, data, mode) {
  //console.log("reportsChartTooltipEvent "+elementID);
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return ""; }
  if(tooltipItems.length == 0) { return ""; }

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var rtnValue = new Array; //doh finally found correct documentation, get multiple lines via array of strings
  tooltipItems.forEach(function(tooltipItem) {
    var data_obj = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
    var skip_first=true;
    if(mode=="title" || mode=="all") { skip_first=false; }

    if(typeof data_obj == "object") { //scatter plot uses point objects
      if(datasourceElement.datasource_mode=="feature") {
        data_obj = reportElement.feature_array[data_obj.feature_idx]; //._index?
      }
      if(datasourceElement.datasource_mode=="edge") {
        data_obj = reportElement.edge_array[data_obj.edge_idx];
      }
    }
    else if(typeof data_obj == "number") { 
      if(datasourceElement.datasource_mode=="feature") {
        data_obj = reportElement.feature_array[tooltipItem.index]; //._index?
      }
      if(datasourceElement.datasource_mode=="edge") {
        data_obj = reportElement.edge_array[tooltipItem.index];
      }
    }
    
    var columns = reportElement.dtype_columns;
    for(var i=0; i<columns.length; i++) {
      var dtype_col = columns[i];
      if(!dtype_col) { continue; }
      if(!dtype_col.visible && !dtype_col.signal_active) { continue; }
      if(skip_first) { skip_first=false; continue; }
      
      var datatype = dtype_col.datatype;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');

      if(dtype_col.col_type == "signal") {
        var signal = null;
        if(datatype == "bedscore") {
          signal = parseFloat(data_obj.score);
        }
        else 
        if(data_obj.expression_hash && 
           data_obj.expression_hash[datatype] && 
           data_obj.expression_hash[datatype][0]) {
          signal = data_obj.expression_hash[datatype][0].total;
        }
        if(signal != null) {
          rtnValue.push(dtype_col.title+": "+signal);
          //rtnValue += signal+"; ";
        }
      }
      if(dtype_col.col_type == "weight") {
        var signal = null;
        if(data_obj && data_obj.weights && data_obj.weights[datatype] && data_obj.weights[datatype][0]) {
          signal = data_obj.weights[datatype][0].weight;
        }
        if(signal != null) {
          rtnValue.push(dtype_col.title+": "+signal);
          //rtnValue += signal+"; ";
        }
      }
      if(dtype_col.col_type == "mdata") {
        var label = zenbuChartElement_get_category(dtype_col.datatype, data_obj);
        if(label) {
          if(mode=="title") { rtnValue.push(label); }
          else { rtnValue.push(dtype_col.title+": "+label); }
          //rtnValue += label+"; ";
        }
      }
      if(mode=="title") { break; }
    }

  });
  //console.log(rtnValue);
  return rtnValue;
  //return "does this work";
  //return 'Sum: ' + sum;
  //return "my custom footer";
  //if(data && data.gene_name) { return data.gene_name; }
  //return "hmm no name";
}


function reportsChartClickEvent(event, eventItems) {
  //console.log("reportsChartClickEvent");
  
  var index = eventItems.datasetIndex;
  var ci = this.chart;
  if(!ci) { return; }
  var data = ci.data;
  var reportElement = current_report.elements[ci.elementID];
  if(!reportElement) { return; }
  //console.log("first gene " + data.datasets[0].data[0].gene_name);
  
  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }
  
  var names = "";
  console.log("reportsChartClickEvent ["+reportElement.elementID+"] datasource["+datasourceElement.elementID+"] eventItems.length: " + eventItems.length); //should be an array of active elements what ever that means
  
  eventItems.forEach(function(item) {
    console.log("item.datasetIndex: " + item._datasetIndex);
    console.log("item.index: " + item._index);
    //var fields="";
    //for(var tok in item) { fields += tok+", "; }
    //console.log("item: " + fields);
    var data_obj = data.datasets[item._datasetIndex].data[item._index];
    var feature = undefined;
    var edge = undefined;
    if(reportElement.display_type == "bar" || reportElement.display_type == "line") {
      if(datasourceElement.datasource_mode=="feature") {
        feature = reportElement.feature_array[item._index];
      }
      if(datasourceElement.datasource_mode=="edge") {
        edge = reportElement.edge_array[item._index];
      }
    }
    if(feature) { 
      console.log("click found feature:"+feature.name); 
      reportElementEvent(datasourceElement.elementID, 'select', feature.id);
    }
    if(edge) { 
      console.log("click found edge:"+edge.id);
      reportElementEvent(datasourceElement.elementID, 'select', edge.id);
    }
    //var fields="";
    //for(var tok in data_obj) { fields += tok+", "; }
    //console.log("data_obj: " + fields);
    //if(names) { names += " "; }
    //names += data_obj.name;
    //if(data_obj.x_edge_id || data_obj.y_edge_id) {
    if(data_obj.feature2_id) {
      if(datasourceElement) {
        //TODO select in datasourceElementID (ex: click in chart cascades up to dependant table)
        //reportElementEvent(reportElement.datasourceElementID, 'select', data_obj.edge_id);
        reportElementEvent(datasourceElement.elementID, 'select', data_obj.feature2_id);
      }
    }
    if(data_obj.feature_id) {
      if(reportElement && reportElement.datasourceElementID) {
        //TODO select in datasourceElementID (ex: click in chart cascades up to dependant table)
        reportElementEvent(datasourceElement.elementID, 'select', data_obj.feature_id);
      }
    }
    if(data_obj.edge_id) {
      if(reportElement && reportElement.datasourceElementID) {
        //TODO select in datasourceElementID (ex: click in chart cascades up to dependant table)
        reportElementEvent(datasourceElement.elementID, 'select', data_obj.edge_id);
      }
    }

  });

}


function testChart() {
  var main_div = document.getElementById("KD_DE_ASO_concordance_plot");
  if(!main_div) { return; }
  main_div.setAttribute('style', "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; "+
                        "background-color:#FAFAFA; border:inset; border-width:2px;"+
                        "padding: 5px 5px 5px 5px; height:inherit; min-height:100px; max-height:400px");
  
  main_div.innerHTML = "";
  var height = main_div.clientHeight;
  height = height - 20;
  //document.getElementById("message").innerHTML += " height["+height+"]";
  
  var titlediv = main_div.appendChild(document.createElement('div'));
  titlediv.setAttribute('style', "text-align:left; font-size:18px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  titlediv.innerHTML = "Chart.js - Line Chart Demo";
  
  //var tdiv = main_div.appendChild(document.createElement('div'));
  var canvas = main_div.appendChild(document.createElement('canvas'));
  canvas.id = "DE_ASO_chart";
  
  //var canvas = document.getElementById('DE_ASO_chart');
  canvas.setAttribute("height", (height*0.5)+"px");
  canvas.setAttribute("width",  height+"px");
  
  var ctx = document.getElementById('DE_ASO_chart').getContext('2d');
  
  /*
   titlediv.innerHTML = "Chart.js - Line Chart Demo";
   var data = {
   labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
   datasets: [{
   label: 'apples',
   data: [12, 19, 3, 17, 6, 3, 7],
   backgroundColor: "rgba(153,255,51,0.4)"
   }, {
   label: 'oranges',
   data: [2, 29, 5, 5, 2, 3, 10],
   backgroundColor: "rgba(255,153,0,0.4)"
   }]
   };
   //var chart_data = { type: 'line', data: data };
   var myChart = new Chart(ctx, { type: 'line', data: data });
   */
  
  titlediv.innerHTML = "Chart.js - Bubble Chart Demo";
  /*
   var data2 = {
   datasets: [{
   label: 'First Dataset',
   data: [ { x: 20, y: 30, r: 15 },
   { x: 40, y: 10, r: 10 }
   ],
   backgroundColor:"#FF6384",
   hoverBackgroundColor: "#FF6384",
   }]
   };
   */
  
  var data2 = new Object;
  data2.datasets = new Array;
  
  var set1 = new Object;
  set1.label = "First Dataset";
  //set1.data = new Array;
  set1.data = [ { x: 20, y: 30, r: 15 }, { x: 40, y: 10, r: 10 } ];
  set1.backgroundColor = "#008000";
  set1.hoverBackgroundColor = "#008000";
  data2.datasets.push(set1);
  
  var myChart = new Chart(ctx, { type: 'bubble', data: data2 });
}

