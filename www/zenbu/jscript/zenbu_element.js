
// ZENBU zenbu_element.js
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

var zenbuElement_global_newElementID = 100;

function ZenbuElement(elementID) {
  this.element_type = "element";
  if(!elementID) { elementID = this.element_type + (zenbuElement_global_newElementID++); }
  this.elementID = elementID;
  
  //methods
  //this.initFromConfigDOM  = zenbuElement_initFromConfigDOM;  //pass a ConfigDOM object
  //this.generateConfigDOM  = zenbuElement_generateConfigDOM;  //returns a ConfigDOM object
  
  //this.elementEvent       = zenbuElement_elementEvent;
  //this.reconfigureParam   = zenbuElement_reconfigureParam;
  
  this.resetElement              = zenbuElement_reset;
  //this.postprocessElement      = zenbuElement_postprocess;
  //this.showSelections          = zenbuElement_showSelections
  //this.drawElement             = zenbuElement_draw;
  //this.filterSubpanel          = zenbuElement_filterSubpanel;
  this.configurationSubpanel     = zenbuElement_configurationSubpanel;
  
  //internal methods
  this.initElement                       = zenbuElement_init;
  this.buildSourcesInterface             = zenbuElement_buildSourcesInterface;
  this.preloadSourcesInterface           = zenbuElement_preloadSourcesInterface;
  this.sourcesInterfaceSubmitSearch      = zenbuElement_sourcesInterfaceSubmitSearch;
  this.sourcesInterfaceShowSearchResults = zenbuElement_sourcesInterfaceShowSearchResults;
  this.sourcesInterfaceUpdateSearchCounts = zenbuElement_sourcesInterfaceUpdateSearchCounts;
  
  //finally perform init
  this.initElement();

  return this;
}


// global helper functions

function zenbuElementCreateType(element_type, elementID) {
  if(!element_type) { element_type = "" }
  if(element_type && !elementID) { elementID = element_type + (zenbuElement_global_newElementID++); }
  
  var reportElement = null;
  
  switch(element_type) {
    case "table":      reportElement = new ZenbuTableElement(elementID); break;
    case "treelist":   reportElement = new ZenbuTreeListElement(elementID); break;
    case "category":   reportElement = new ZenbuCategoryElement(elementID); break;
    case "chart":      reportElement = new ZenbuChartElement(elementID); break;
    case "html":       reportElement = new ZenbuHtmlElement(elementID); break;
    case "zenbugb":    reportElement = new ZenbuGBElement(elementID); break;
    //case "layout":         reportElement = new ZenbuGBElement(elementID); break;
    //case "tools_panel":    reportElement = new ZenbuGBElement(elementID); break;
    default:           reportElement = new ZenbuElement(elementID); break;  //generic element
  }
  
  //store into the hash of global elements on the page
  if(reportElement && reportElement.elementID) {
    current_report.elements[reportElement.elementID] = reportElement;
  }
  return reportElement;
}


function zenbuElementCreateFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return null; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type == "layout") { return null;}  //?might be ok eventually
  if(element_type == "tools_panel") { return null;}

  var elementID = elementDOM.getAttribute("elementID");

  var reportElement = current_report.elements[elementID];
  if(!reportElement) {
    reportElement = zenbuElementCreateType(element_type, elementID);
  }
  
  reportElement.initFromConfigDOM(elementDOM);

  //reportsUpdateElementLayout(reportElement);
  return reportElement;
}

//=================================================================================

function zenbuElement_init() {
  this.main_div = undefined;
  this.main_div_id = undefined;
  
  this.title = "";
  this.title_prefix = "";
  
  this.features = new Object();
  this.feature_array = new Array();
  this.dtype_columns = new Array();
  
  this.edge_array = new Array();
  this.edge_count = 0;
  this.filter_count = 0;
  
  this.datasources = new Object();
  this.sources_array = new Array();
  this.datatypes   = new Object();
  
  this.datasource_mode = "feature";  //feature, edge, shared_element
  this.datasourceElementID = undefined;  //for shared_element mode
  this.source_ids = "";
  this.query_filter = "";
  this.collaboration_filter = "";
  this.query_format = "fullxml";
  this.query_edge_search_depth = 1;
  this.load_on_page_init = false;
  this.focus_feature = null;
  this.filter_feature_ids = "";
  this.hide_zero = false;
  
  this.table_page_size = 20;
  this.table_num_pages = 0;
  this.table_page = 1;
  
  this.init_selection = "";
  this.selected_id = "";
  this.selected_feature = null;
  this.selected_edge = null;
  this.selected_source = null;
  this.search_data_filter = "";
  this.show_search_matches = false;
  
  this.resetable = true;
  this.loading = false;  //not loaded
  
  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;
  this.border = "inset";
  
  this.layout_mode = "absolute";  //absolute, child
  this.layout_parentID = null;    //linked to Row, Column, or Grid layoutElement
  this.layout_row = 0;
  this.layout_col = 0;
  this.layout_xpos = current_report.new_element_abs_pos;
  this.layout_ypos = current_report.new_element_abs_pos;
  current_report.new_element_abs_pos += 50;
  
  this.content_width = 250;
  this.content_height = 250;
  
  this.cascade_triggers = new Array();
}

//=================================================================================
// Element configXML creation / init methods
//=================================================================================

function zenbuElement_initFromConfigDOM(elementDOM) {
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");

  this.load_on_page_init = false;
  this.show_titlebar = true;
  this.widget_search = false;
  this.widget_filter = false;
  this.move_selection_to_top=false;
  this.sort_reverse = false;
  this.show_search_matches = false;
  this.hide_zero = false;
  this.title = "";
  this.title_prefix = "";
  //this.resetable = false;
  
  if(elementDOM.getAttribute("main_div_id")) {  this.main_div_id = elementDOM.getAttribute("main_div_id"); }
  if(elementDOM.getAttribute("title")) {  this.title = elementDOM.getAttribute("title"); }
  if(elementDOM.getAttribute("title_prefix")) {  this.title_prefix = elementDOM.getAttribute("title_prefix"); }

  if(elementDOM.getAttribute("datasource_mode")) {  this.datasource_mode = elementDOM.getAttribute("datasource_mode"); }
  if(elementDOM.getAttribute("datasourceElementID")) {  this.datasourceElementID = elementDOM.getAttribute("datasourceElementID"); }
  if(elementDOM.getAttribute("source_ids")) {  this.source_ids = elementDOM.getAttribute("source_ids"); }
  if(elementDOM.getAttribute("query_filter")) {  this.query_filter = elementDOM.getAttribute("query_filter"); }
  if(elementDOM.getAttribute("collaboration_filter")) {  this.collaboration_filter = elementDOM.getAttribute("collaboration_filter"); }
  if(elementDOM.getAttribute("query_format")) {  this.query_format = elementDOM.getAttribute("query_format"); }
  if(elementDOM.getAttribute("query_edge_search_depth")) {  this.query_edge_search_depth = elementDOM.getAttribute("query_edge_search_depth"); }

  if(elementDOM.getAttribute("table_page_size")) {  this.table_page_size = Math.floor(elementDOM.getAttribute("table_page_size")); }
  //if(elementDOM.getAttribute("table_num_pages")) {  this.table_num_pages = elementDOM.getAttribute("table_num_pages"); }
  //if(elementDOM.getAttribute("table_page")) {  this.table_page = elementDOM.getAttribute("table_page"); }
  if(elementDOM.getAttribute("sort_col")) {  this.sort_col = elementDOM.getAttribute("sort_col"); }
  if(elementDOM.getAttribute("sort_reverse") == "true") { this.sort_reverse = true; }
  if(elementDOM.getAttribute("move_selection_to_top") == "true") { this.move_selection_to_top = true; }

  if(elementDOM.getAttribute("load_on_page_init") == "true") { this.load_on_page_init = true; }
  //if(elementDOM.getAttribute("resetable") == "true") { this.resetable = true; }
  if(elementDOM.getAttribute("init_selection")) {  this.init_selection = elementDOM.getAttribute("init_selection"); }
  //if(elementDOM.getAttribute("selected_id")) {  this.selected_id = elementDOM.getAttribute("selected_id"); }
  //if(elementDOM.getAttribute("search_data_filter")) {  this.search_data_filter = elementDOM.getAttribute("search_data_filter"); }
  //if(elementDOM.getAttribute("show_search_matches") == "true") { this.show_search_matches = true; }

  if(elementDOM.getAttribute("show_titlebar") == "false") { this.show_titlebar = false; }
  if(elementDOM.getAttribute("widget_search") == "true") { this.widget_search = true; }
  if(elementDOM.getAttribute("widget_filter") == "true") { this.widget_filter = true; }
  if(elementDOM.getAttribute("border")) {  this.border = elementDOM.getAttribute("border"); }

  if(elementDOM.getAttribute("hide_zero") == "true") { this.hide_zero = true; }

  if(elementDOM.getAttribute("layout_mode")) {  this.layout_mode = elementDOM.getAttribute("layout_mode"); }
  if(elementDOM.getAttribute("layout_parentID")) {  this.layout_parentID = elementDOM.getAttribute("layout_parentID"); }
  if(elementDOM.getAttribute("layout_col")) {  this.layout_col = parseInt(elementDOM.getAttribute("layout_col")); }
  if(elementDOM.getAttribute("layout_row")) {  this.layout_row = parseInt(elementDOM.getAttribute("layout_row")); }
  if(elementDOM.getAttribute("layout_xpos")) {  this.layout_xpos = parseInt(elementDOM.getAttribute("layout_xpos")); }
  if(elementDOM.getAttribute("layout_ypos")) {  this.layout_ypos = parseInt(elementDOM.getAttribute("layout_ypos")); }
  if(elementDOM.getAttribute("content_width")) {  this.content_width = parseInt(elementDOM.getAttribute("content_width")); }
  if(elementDOM.getAttribute("content_height")) {  this.content_height = parseInt(elementDOM.getAttribute("content_height")); }

  //element_type specific parameters
  //if(this.element_type == "table") {
  //}
  if(this.element_type == "chart") {
    this.dual_feature_axis = false;
    this.symetric_axis = false;
    if(elementDOM.getAttribute("chart_type")) { this.chart_type = elementDOM.getAttribute("chart_type"); }
    //if(elementDOM.getAttribute("layout_type")) { this.layout_type = elementDOM.getAttribute("layout_type"); }
    if(elementDOM.getAttribute("dual_feature_axis") == "1") { this.dual_feature_axis = true; }
    if(elementDOM.getAttribute("symetric_axis") == "1") { this.symetric_axis = true; }
    
    var xaxisDOM = elementDOM.getElementsByTagName("chart_xaxis")[0];
    if(xaxisDOM.getAttribute("datatype")) { this.xaxis.datatype = xaxisDOM.getAttribute("datatype"); }
    if(xaxisDOM.getAttribute("fixedscale") == "1") { this.xaxis.fixedscale = true; } else { this.xaxis.fixedscale = false; }
    if(xaxisDOM.getAttribute("symetric") == "1") { this.xaxis.symetric = true; } else { this.xaxis.symetric = false; }
    if(xaxisDOM.getAttribute("log") == "1") { this.xaxis.log = true; } else { this.xaxis.log = false; }

    var yaxisDOM = elementDOM.getElementsByTagName("chart_yaxis")[0];
    if(yaxisDOM.getAttribute("datatype")) { this.yaxis.datatype = yaxisDOM.getAttribute("datatype"); }
    if(yaxisDOM.getAttribute("fixedscale") == "1") { this.yaxis.fixedscale = true; } else { this.yaxis.fixedscale = false; }
    if(yaxisDOM.getAttribute("symetric") == "1") { this.yaxis.symetric = true; } else { this.yaxis.symetric = false; }
    if(yaxisDOM.getAttribute("log") == "1") { this.yaxis.log = true; } else { this.yaxis.log = false; }
  }
  if(this.element_type == "zenbugb") {
    if(elementDOM.getAttribute("zenbu_url")) { this.zenbu_url = elementDOM.getAttribute("zenbu_url"); }
    if(elementDOM.getAttribute("view_config")) { this.view_config = elementDOM.getAttribute("view_config"); }
    if(elementDOM.getAttribute("chrom_location")) { this.chrom_location = elementDOM.getAttribute("chrom_location"); }
  }
  if(this.element_type == "html") {
    if(elementDOM.getAttribute("html_content")) { this.html_content = elementDOM.getAttribute("html_content"); }
    var htmlContentDOM = elementDOM.getElementsByTagName("html_content");
    if(htmlContentDOM && htmlContentDOM.length>0) {
      this.html_content = htmlContentDOM[0].firstChild.nodeValue;
    }
    //console.log("html_content ["+this.html_content+"]")
  }
  if(this.element_type == "category") {
    if(elementDOM.getAttribute("category_datatype")) { this.category_datatype = elementDOM.getAttribute("category_datatype"); }
    if(elementDOM.getAttribute("display_type")) { this.display_type = elementDOM.getAttribute("display_type"); }
    if(elementDOM.getAttribute("colorspace")) { this.colorspace = elementDOM.getAttribute("colorspace"); }
  }
  //if(this.element_type == "layout") {
  //  if(this.layout_type) { elementDOM.setAttribute("layout_type", this.layout_type); }
  //}
  
  //dtype_column
  //  <dtype_column datatype="geneName" title="geneName" colnum="6" col_type="mdata" visible="true"/>
  var colDOMs = elementDOM.getElementsByTagName("dtype_column");
  for(var j=0; j<colDOMs.length; j++) {
    var colDOM = colDOMs[j];
    if(!colDOM) { continue; }
    
    var datatype = colDOM.getAttribute("datatype");
    var title = colDOM.getAttribute("title");

    var t_col = thisAddDatatypeColumn(this, datatype, title);

    if(colDOM.getAttribute("colnum")) { t_col.colnum = parseInt(colDOM.getAttribute("colnum")); }
    if(colDOM.getAttribute("col_type")) { t_col.col_type = colDOM.getAttribute("col_type"); }
    
    if(colDOM.getAttribute("visible") == "true") { t_col.visible = true; } else { t_col.visible = false; }
    if(colDOM.getAttribute("filtered") == "true") { t_col.filtered = true; } else { t_col.filtered = false; }
    if(colDOM.getAttribute("filter_abs") == "true") { t_col.filter_abs = true; } else { t_col.filter_abs = false; }

    if(colDOM.getAttribute("filter_min")) {
      t_col.filter_min = colDOM.getAttribute("filter_min");
      if(t_col.filter_min != "min") { t_col.filter_min = parseFloat(t_col.filter_min); }
    }
    if(colDOM.getAttribute("filter_max")) {
      t_col.filter_max = colDOM.getAttribute("filter_max");
      if(t_col.filter_max != "max") { t_col.filter_max = parseFloat(t_col.filter_max); }
    }
    
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
    
    var trigger = thisAddCascadeTrigger(this, targetElementID, on_trigger, action_mode, options);
  }
}


//=================================================================================
//
// Element configXML creation / init
//
//=================================================================================


function zenbuElement_generateConfigDOM() {
  if(this.element_type == "tools_panel") { return null; }
  
  var doc = document.implementation.createDocument("", "", null);
  
  var elementDOM = doc.createElement("reportElement");
  
  if(this.element_type) { elementDOM.setAttribute("element_type", this.element_type); }
  if(this.elementID) { elementDOM.setAttribute("elementID", this.elementID); }
  if(this.main_div_id) { elementDOM.setAttribute("main_div_id", this.main_div_id); }

  if(this.title) { elementDOM.setAttribute("title", this.title); }
  if(this.title_prefix) { elementDOM.setAttribute("title_prefix", this.title_prefix); }
  
  if(this.datasource_mode) { elementDOM.setAttribute("datasource_mode", this.datasource_mode); } //feature, edge, shared_element
  if(this.datasourceElementID) { elementDOM.setAttribute("datasourceElementID", this.datasourceElementID); }  //for shared_element mode
  if(this.source_ids) { elementDOM.setAttribute("source_ids", this.source_ids); }
  if(this.query_filter) { elementDOM.setAttribute("query_filter", this.query_filter); }
  if(this.collaboration_filter) { elementDOM.setAttribute("collaboration_filter", this.collaboration_filter); }
  if(this.query_format) { elementDOM.setAttribute("query_format", this.query_format); }
  if(this.query_edge_search_depth) { elementDOM.setAttribute("query_edge_search_depth", this.query_edge_search_depth); }

  if(this.table_page_size) { elementDOM.setAttribute("table_page_size", this.table_page_size); }
  //if(this.table_num_pages) { elementDOM.setAttribute("table_num_pages", this.table_num_pages); }
  //if(this.table_page) { elementDOM.setAttribute("table_page", this.table_page); }
  if(this.sort_col) { elementDOM.setAttribute("sort_col", this.sort_col); }
  if(this.sort_reverse) { elementDOM.setAttribute("sort_reverse", "true"); }
  if(this.move_selection_to_top) { elementDOM.setAttribute("move_selection_to_top", "true"); }  //treelist

  if(this.load_on_page_init) {
    elementDOM.setAttribute("load_on_page_init", "true");
    //if(this.selected_feature) { elementDOM.setAttribute("init_selection", this.selected_feature.name); }
    if(this.selected_id) { elementDOM.setAttribute("init_selection", this.selected_id); }
  }
  //if(this.search_data_filter) { elementDOM.setAttribute("search_data_filter", this.search_data_filter); }
  //if(this.show_search_matches) { elementDOM.setAttribute("show_search_matches", "true"); }

  if(this.hide_zero) { elementDOM.setAttribute("hide_zero", "true"); }

  if(this.show_titlebar) { elementDOM.setAttribute("show_titlebar", "true"); } else { elementDOM.setAttribute("show_titlebar", "false"); }
  if(this.widget_search) { elementDOM.setAttribute("widget_search", "true"); }
  if(this.widget_filter) { elementDOM.setAttribute("widget_filter", "true"); }
  if(this.border) { elementDOM.setAttribute("border", this.border); }

  if(this.layout_mode) { elementDOM.setAttribute("layout_mode", this.layout_mode); }  //absolute, child
  if(this.layout_parentID) { elementDOM.setAttribute("layout_parentID", this.layout_parentID); } //linked to Row, Column, or Grid layoutElement
  else { elementDOM.setAttribute("layout_parentID", ""); } //root
  if(this.layout_row) { elementDOM.setAttribute("layout_row", this.layout_row); }
  if(this.layout_col) { elementDOM.setAttribute("layout_col", this.layout_col); }
  if(this.layout_xpos) { elementDOM.setAttribute("layout_xpos", parseInt(this.layout_xpos)); }
  if(this.layout_ypos) { elementDOM.setAttribute("layout_ypos", parseInt(this.layout_ypos)); }
  
  if(this.content_width) { elementDOM.setAttribute("content_width", this.content_width); }
  if(this.content_height) { elementDOM.setAttribute("content_height", this.content_height); }
  
  //dtype_columns
  if(this.dtype_columns) {
    for(var i=0; i<this.dtype_columns.length; i++) {
      var dtype_col = this.dtype_columns[i];
      if(!dtype_col) { continue; }
      //if(!dtype_col.visible && !dtype_col.filtered && (dtype_col.datatype!="category") && (dtype_col.datatype!="source_name")) { continue; }

      var colDoc = doc.createElement("dtype_column");
      colDoc.setAttribute("datatype", dtype_col.datatype);
      colDoc.setAttribute("title", dtype_col.title);
      colDoc.setAttribute("colnum", dtype_col.colnum);
      colDoc.setAttribute("col_type", dtype_col.col_type);
      if(dtype_col.filter_min) { colDoc.setAttribute("filter_min", dtype_col.filter_min); }
      if(dtype_col.filter_max) { colDoc.setAttribute("filter_max", dtype_col.filter_max); }

      if(dtype_col.visible) { colDoc.setAttribute("visible", "true"); }
      if(dtype_col.filtered) { colDoc.setAttribute("filtered", "true"); }
      if(dtype_col.filter_abs) { colDoc.setAttribute("filter_abs", "true"); }
      
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
  if(this.cascade_triggers) {
    for(var trig_idx=0; trig_idx<this.cascade_triggers.length; trig_idx++){
      var trigger = this.cascade_triggers[trig_idx];
      if(!trigger) { continue; }
      
      var trigDoc = doc.createElement("cascade_trigger");
      trigDoc.setAttribute("trigger_idx", trig_idx);
      trigDoc.setAttribute("targetElementID", trigger.targetElementID);
      trigDoc.setAttribute("on_trigger", trigger.on_trigger);
      trigDoc.setAttribute("action_mode", trigger.action_mode);
      if(trigger.options) { trigDoc.setAttribute("options", trigger.options); }

      elementDOM.appendChild(trigDoc);
    }
  }
  
  //element_type specific parameters
  if(this.element_type == "table") {
  }
  if(this.element_type == "chart") {
    if(this.chart_type) { elementDOM.setAttribute("chart_type", this.chart_type); }
    if(this.dual_feature_axis) { elementDOM.setAttribute("dual_feature_axis", 1); }
    if(this.symetric_axis) { elementDOM.setAttribute("symetric_axis", 1); }
    if(this.layout_type) { elementDOM.setAttribute("layout_type", this.layout_type); }

    var xaxis = doc.createElement("chart_xaxis");
    xaxis.setAttribute("datatype", this.xaxis.datatype);
    if(this.xaxis.fixedscale) { xaxis.setAttribute("fixedscale", 1); } else { xaxis.setAttribute("fixedscale", 0); }
    if(this.xaxis.symetric)   { xaxis.setAttribute("symetric", 1); }   else { xaxis.setAttribute("symetric", 0); }
    if(this.xaxis.log)        { xaxis.setAttribute("log", 1); }        else { xaxis.setAttribute("log", 0); }
    elementDOM.appendChild(xaxis);

    var yaxis = doc.createElement("chart_yaxis");
    yaxis.setAttribute("datatype", this.yaxis.datatype);
    if(this.yaxis.fixedscale) { yaxis.setAttribute("fixedscale", 1); } else { yaxis.setAttribute("fixedscale", 0); }
    if(this.yaxis.symetric)   { yaxis.setAttribute("symetric", 1); }   else { yaxis.setAttribute("symetric", 0); }
    if(this.yaxis.log)        { yaxis.setAttribute("log", 1); }        else { yaxis.setAttribute("log", 0); }
    elementDOM.appendChild(yaxis);
  }
  if(this.element_type == "zenbugb") {
    if(this.zenbu_url) { elementDOM.setAttribute("zenbu_url", this.zenbu_url); }
    if(this.view_config) { elementDOM.setAttribute("view_config", this.view_config); }
    if(this.chrom_location) { elementDOM.setAttribute("chrom_location", this.chrom_location); }
  }
  if(this.element_type == "html") {
    if(this.html_content) {
      //elementDOM.setAttribute("html_content", this.html_content);
      var htmlContentDOM = elementDOM.appendChild(doc.createElement("html_content"));
      //htmlContentDOM.appendChild(doc.createTextNode(escapeXml(this.html_content)));
      htmlContentDOM.appendChild(doc.createTextNode(this.html_content));
    }
    //if(this.view_config) { elementDOM.setAttribute("view_config", this.view_config); }
    //if(this.chrom_location) { elementDOM.setAttribute("chrom_location", this.chrom_location); }
  }
  if(this.element_type == "category") {
    if(this.category_datatype) {
      elementDOM.setAttribute("category_datatype", this.category_datatype);
      elementDOM.setAttribute("display_type", this.display_type);
      elementDOM.setAttribute("colorspace", this.colorspace);
    }
  }

  if(this.element_type == "layout") {
    if(this.layout_type) { elementDOM.setAttribute("layout_type", this.layout_type); }
  }
  
  this.elementDOM = elementDOM;
  return elementDOM;
}


//=====================================================================
//
// Element superclass methods. root method which subclasses extend
//
//=====================================================================

function zenbuElement_reset() {
  //reset keeps configuration, but reset/clears the loaded data and selections
  //it will keep externally set focus_feature and filter_feature_ids intact though since these are used by the loader
  if(!this.resetable) { return; }
  
  //clear previous loaded data
  this.features = new Object();
  this.feature_array = new Array();
  this.edge_array = new Array();
  this.feature_count = 0;
  this.edge_count = 0;
  this.filter_count = 0;
  this.raw_count = 0;

  //common resets
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  this.search_match_feature_count = 0;
  this.search_match_edge_count = 0;
  this.search_match_source_count = 0;

  this.loading = false;  //need to double check this logic
}

/*
function zenbuElement_postprocess() {
  //superclass method, can be called by subclasses at beginning of postprocess
  this.starttime = new Date();
  console.log("zenbuElement_postprocess "+this.elementID);
  
  //datasource general
  if(this.datasource_mode == "feature") {
    reportElementPostprocessFeaturesQuery(this);
  }
  if(this.datasource_mode == "edge") {
    reportElementPostprocessEdgesQuery(this);
  }
  if(this.datasource_mode == "source") {
    reportElementPostprocessSourcesQuery(this);
  }
  
  //reportElementSearchData(elementID); //resets the search_match flag and applies search if needed
  if(this.search_data_filter || this.show_search_matches) {
    reportElementSearchData(elementID); //resets the search_match flag and applies search if needed
  }
}


function zenbuElement_finish_postprocess(){
  //common superclass helper method, can be called by subclasses at end of postprocess
  var endtime = new Date();
  var runtime = (endtime.getTime() - this.starttime.getTime());
  console.log("zenbuElement_postprocess "+this.elementID+" "+(runtime)+"msec");
  
  //TODO: redo the init_selection logic to use the new selection event logic, and allow URL init_selection
  if(!this.selected_feature && this.init_selection) {
    //if(this.init_selection) {
    reportElementEvent(this.elementID, 'select', this.init_selection);
    //this.init_selection = ""; //clear it, uses the new current selection at save time
  }
  
  //trigger cascades here
  reportElementTriggerCascade(this, "postprocess");
  reportElementTriggerCascade(this, "select");
}
*/


//===============================================================
//
// Element configuration panel
//
//===============================================================

function zenbuElement_configurationSubpanel() {
  //generic configuration panel with redirect to specific types for specifics
  
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
  
  var cfgID = this.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) {
    configdiv = document.createElement('div');
    //auxdiv.insertBefore(main_div, auxdiv.firstChild);
    auxdiv.appendChild(configdiv);
    configdiv.id = cfgID;
    configdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:400px; display:none; opacity: 0.98; " +
                           "position:absolute; top:20px; right:10px;"
                           );
  }
  //clearKids(configdiv);
  configdiv.innerHTML = "";

  //reset widths: auxdiv.style.width = min "425px" or "775px" or maindiv.width; configdiv.style.width = "400px" or "750px";
  var mainRect = main_div.getBoundingClientRect();
  //console.log("main_div "+main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top);
  var auxwidth = mainRect.width-5;
  var configwidth = 400;
  if(auxwidth<425) { auxwidth = 425; }
  if(this.newconfig && (this.newconfig.edit_datasource_query || this.newconfig.edit_cascade_triggers)) {
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
  a1.setAttribute("onclick", "reportElementToggleSubpanel('"+this.elementID+"', 'none'); return false;");
  
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = configdiv.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight:bold;");
  if(this.element_type == "treelist") { tspan.innerHTML = "tree-list configuration: "; }
  if(this.element_type == "table")    { tspan.innerHTML = "table configuration: "; }
  if(this.element_type == "chart")    { tspan.innerHTML = "chart configuration: "; }
  if(this.element_type == "zenbugb")  { tspan.innerHTML = "zenbuGB configuration: "; }
  if(this.element_type == "html")     { tspan.innerHTML = "html configuration: "; }
  if(this.element_type == "circos")   { tspan.innerHTML = "circos configuration: "; }
  tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.setAttribute('style', "font-size:10px; color:blue; padding-left:5px; font-style:italic;");
  tspan.setAttribute('style', "font-size:10px; color:blue; padding-left:5px;");
  tspan.innerHTML = this.elementID;
  
  if(this.element_type != "category") {
    var title_prefix = this.title_prefix;
    if(this.newconfig && this.newconfig.title_prefix != undefined) { title_prefix = this.newconfig.title_prefix; }
    var div1 = configdiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "title:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id =  this.elementID + "_config_title";
    titleInput.className = "sliminput";
    titleInput.style.width = "330px";
    //titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', title_prefix);
    titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");
  }

  var sourcesDiv = this.buildSourcesInterface();
  
  var cascadesDiv = reportElementCascadeTriggersInterface(this);

  configdiv.appendChild(document.createElement('hr'));
  
  //-------  type specific section -------------
  this.config_options_div = configdiv.appendChild(document.createElement('div'));
  if(this.configSubpanel) {
    this.configSubpanel();
  }

  //---------- widget controls ------------------
  //configdiv.appendChild(document.createElement('hr'));
  tdiv2  = configdiv.appendChild(document.createElement('div'));

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_titlebar;
  if(this.newconfig && this.newconfig.show_titlebar != undefined) { val1 = this.newconfig.show_titlebar; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_titlebar', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "title bar";
  if(this.element_type=="category") { tcheck.setAttribute('checked', "checked"); tcheck.setAttribute('disabled', "disabled"); }

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.widget_search;
  if(this.newconfig && this.newconfig.widget_search != undefined) { val1 = this.newconfig.widget_search; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'widget_search', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "search widget";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.widget_filter;
  if(this.newconfig && this.newconfig.widget_filter != undefined) { val1 = this.newconfig.widget_filter; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'widget_filter', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "filter widget";

  //border options
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 15px;");
  span1.innerHTML = "border: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'border_type', this.value);");
  select.className = "dropdown";
  
  var opts1 = ["none", "simple", "inset", "double", "left", "round" ];
  var val1 = this.border;
  if(this.newconfig && this.newconfig.border != undefined) { val1 = this.newconfig.border; }
  for(var idx1=0; idx1<opts1.length; idx1++) {
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", opts1[idx1]);
    if(val1 == opts1[idx1]) { option.setAttribute("selected", "selected"); }
    option.innerHTML = opts1[idx1];
  }
  
  //---------- layout controls ------------------
  //configdiv.appendChild(document.createElement('hr'));
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  
  var content_width = this.content_width;
  if(this.newconfig && this.newconfig.content_width != undefined) { content_width = this.newconfig.content_width; }
  var span0 = tdiv2.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "width:";
  var input = tdiv2.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', content_width);
  input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+this.elementID+"\", 'content_width', this.value); }");
  input.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");

  var content_height = this.content_height;
  if(this.newconfig && this.newconfig.content_height != undefined) { content_height = this.newconfig.content_height; }
  var span0 = tdiv2.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin-left:10px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "height:";
  var input = tdiv2.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', content_height);
  input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+this.elementID+"\", 'content_height', this.value); }");
  input.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");

  //---------- control buttons ------------------
  configdiv.appendChild(document.createElement('hr'));
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-top:5px; float:left;");
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; color:black; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'delete-element');");
  button.innerHTML = "delete element";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-top:5px; float:right;");
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; color:black; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'cancel-reconfig');");
  button.innerHTML = "reset";
  if(!this.newconfig) { button.setAttribute('disabled', "disabled"); }
  
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; color:black; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'accept-reconfig');");
  button.innerHTML = "accept";
  if(!this.newconfig) { button.setAttribute('disabled', "disabled"); }


  return configdiv;
}


//===============================================================
//
// Element datasource interface and search section
//
//===============================================================

function zenbuElement_buildSourcesInterface() {
    var main_div = this.main_div;
  if(!main_div) { return null; }
  var elementID = this.elementID;
  
  var auxID = this.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var cfgID = this.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) { return; }
  
  var datasource_mode = this.datasource_mode;
  if(datasource_mode == "") { return; } //element does not need a datasource
  if(this.newconfig && this.newconfig.datasource_mode != undefined) { datasource_mode = this.newconfig.datasource_mode; }
  
  configdiv.appendChild(document.createElement('hr'));

  var sourcesID = this.main_div_id + "_sources_search_div";
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
  
  var datasource_mode = this.datasource_mode;
  if(this.newconfig && this.newconfig.datasource_mode != undefined) { datasource_mode = this.newconfig.datasource_mode; }
  //console.log("datasource_mode : "+datasource_mode);
  
  radio1 = sourceDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  //radio1.setAttribute("id", elementID + "_sourcetype_radio1");
  radio1.setAttribute("name", elementID + "_sourcemodetype");
  radio1.setAttribute("value", "feature");
  if(datasource_mode != "shared_element") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasource_mode', this.value);");
  tspan = sourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "data query";
  
  radio2 = sourceDiv.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  //radio2.setAttribute("id", elementID + "_sourcetype_radio2");
  radio1.setAttribute("name", elementID + "_sourcemodetype");
  radio2.setAttribute("value", "shared_element");
  if(datasource_mode == "shared_element") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasource_mode', this.value);");
  tspan = sourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "shared element";
  
  if(datasource_mode == "shared_element") {
    var datasourceElementID = this.datasourceElementID;
    if(this.newconfig && this.newconfig.datasourceElementID != undefined) { datasourceElementID = this.newconfig.datasourceElementID; }
    if(!datasourceElementID) { datasourceElementID = ""; }
    //console.log("datasourceElementID : "+datasourceElementID);
    
    var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "shared elementID:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id =  this.elementID + "_config_datasrcID";
    titleInput.className = "sliminput"; //css styling
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', datasourceElementID);
    titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasourceElementID', this.value);");
    titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasourceElementID', this.value);");
    //titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'title', this.value);");
    //titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");
  } else {  //a data query type
    if(!this.newconfig || !this.newconfig.edit_datasource_query) {
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
      button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ this.elementID +"\", 'edit_datasource_query', this.value);");
      
    } else {
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
      radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "features";
      
      radio2 = div1.appendChild(document.createElement('input'));
      radio2.setAttribute("type", "radio");
      radio2.setAttribute("name", elementID + "_sourcetype");
      radio2.setAttribute("value", "edge");
      if(datasource_mode == "edge") { radio2.setAttribute('checked', "checked"); }
      radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "edges";
      
      radio3 = div1.appendChild(document.createElement('input'));
      radio3.setAttribute("type", "radio");
      radio3.setAttribute("name", elementID + "_sourcetype");
      radio3.setAttribute("value", "source");
      if(datasource_mode == "source") { radio3.setAttribute('checked', "checked"); }
      radio3.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'datasource_mode', this.value);");
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
        sourceSearchForm.setAttribute("onsubmit", "zenbuElement_sourcesSearchCmd(\""+elementID+"\", 'search'); return false;");
        
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
        searchButton.setAttribute("type", "button");
        searchButton.setAttribute("value", "search");
        searchButton.setAttribute("onclick", "zenbuElement_sourcesSearchCmd(\""+elementID+"\", 'search');");
        
        var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
        clearButton.setAttribute("type", "button");
        clearButton.setAttribute("value", "clear");
        clearButton.setAttribute("onclick", "zenbuElement_sourcesSearchCmd(\""+elementID+"\", 'clear');");
        
        //var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
        //clearButton.setAttribute("type", "button");
        //clearButton.setAttribute("value", "refresh");
        //clearButton.setAttribute("onclick", "zenbuElement_sourcesSearchCmd(\""+elementID+"\", 'refresh');");
        
        //-------------
        var sourceResultDiv = sourceSearchForm.appendChild(document.createElement('div'));
        sourceResultDiv.id = elementID + "_sources_search_result_div";
        sourceResultDiv.setAttribute('style', "margin: 1px 3px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
        //sourceResultDiv.innerHTML = "please enter search term";
        sourceResultDiv.innerHTML = "";

        //preload query trigger here
        if(this.source_ids && (!this.newconfig || !this.newconfig.sources_hash) ) {
          this.preloadSourcesInterface();
        } else {
          this.sourcesInterfaceShowSearchResults();
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
        sourceSelect.id = "dex_search_datasource_select";
        //sourceSelect.setAttribute("onchange", "dexReconfigContentsParam('datasource', this.value);");
        sourceSelect.setAttribute("style", "margin-left:3px; ");
        
        var option;
        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "all");
        option.innerHTML = "all data sources";
        
        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "experiments");
        option.innerHTML = "only experiments";
        //if(contents.filters.datasource == "experiments") { option.setAttribute("selected", "selected"); }
        
        option = sourceSelect.appendChild(document.createElement('option'));
        option.setAttribute("value", "feature_sources");
        option.innerHTML = "only feature sources";
        //if(contents.filters.datasource == "feature_sources") { option.setAttribute("selected", "selected"); }
      
        //if((contents.mode=="DataSources")||(contents.mode=="Experiments")||(contents.mode=="Annotation")) { sourceTypeDiv.style.display = "inline"; }
        //else { sourceTypeDiv.style.display = "none"; }
      }
      
      //query_filter
      var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
      div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      var span0 = div1.appendChild(document.createElement('span'));
      span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
      span0.innerHTML = "results filter:";
      var query_filter = this.query_filter;
      if(this.newconfig && this.newconfig.query_filter != undefined) { query_filter = this.newconfig.query_filter; }
      var filterInput = div1.appendChild(document.createElement('input'));
      filterInput.setAttribute('style', "width:250px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
      filterInput.setAttribute('type', "text");
      filterInput.setAttribute('value', query_filter);
      filterInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'query_filter', this.value);");
      filterInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'query_filter', this.value);");
      filterInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");
    
      //query_edge_search_depth
      if(datasource_mode == "edge") {
        var span0 = div1.appendChild(document.createElement('span'));
        span0.setAttribute('style', "margin-left:15px; font-size:12px; font-family:arial,helvetica,sans-serif;");
        span0.innerHTML = "edge network search depth:";
        var search_depth = this.query_edge_search_depth;
        if(this.newconfig && this.newconfig.query_edge_search_depth != undefined) { search_depth = this.newconfig.query_edge_search_depth; }
        var input = div1.appendChild(document.createElement('input'));
        input.setAttribute('style', "width:30px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
        input.setAttribute('type', "text");
        input.setAttribute('value', search_depth);
        input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+this.elementID+"\", 'query_edge_search_depth', this.value); }");
        input.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");
      }
    }
    
    //load_on_page_init
    var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    var checkbox = div1.appendChild(document.createElement('input'));
    checkbox.setAttribute("type", "checkbox");
    var load_on_page_init = this.load_on_page_init;
    if(this.newconfig && this.newconfig.load_on_page_init != undefined) { load_on_page_init = this.newconfig.load_on_page_init; }
    if(load_on_page_init) { checkbox.setAttribute("checked", "checked"); }
    checkbox.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'load_on_page_init', this.checked);");
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "load data on page initialization";
  }
  
  

  //TODO: example query for features for target list
  //this.datasource_mode = "feature";
  //this.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource";
  //this.query_filter = "F6_KD_CAGE:=true";
  //this.query_format = "fullxml";
  
  
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


function zenbuElement_sourcesSearchCmd(elementID, cmd) {
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
    reportElement.sourcesInterfaceShowSearchResults();
  }
  if(cmd == "search") {
    var filter = "";
    if(seachInput) { filter = seachInput.value; }
    if(!filter) { filter =" "; }
    reportElement.sourcesInterfaceSubmitSearch(filter);
  }
}


function zenbuElement_preloadSourcesInterface() {
  //preload the previous selected sources by searching based on the source_ids
  if(!this.source_ids) { return; } //nothing to do

  var sourceResultDiv = document.getElementById(this.elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "preloading previously configured data sources...";

  if(!this.newconfig.sources_hash) {
    this.newconfig.sources_hash = new Object;
  }
  this.newconfig.source_ids = this.source_ids;
  this.newconfig.preload = true;

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  paramXML += "<source_ids>"+this.source_ids+"</source_ids>";
  paramXML += "<mode>sources</mode>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  this.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { zenbuElement_sourcesParseSearchResponse(id); };}(this.elementID);
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function zenbuElement_sourcesInterfaceSubmitSearch(filter) {
  var sourceResultDiv = document.getElementById(this.elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "searching data sources...";
  
  if(!this.newconfig.sources_hash) {
    this.newconfig.sources_hash = new Object;
  }
  
  //clear unselected sources from hash
  var sources_hash = new Object;
  for(var srcid in this.newconfig.sources_hash) {
    var source = this.newconfig.sources_hash[srcid];
    if(source && (source.selected || source.preload)) {
      sources_hash[srcid] = source;
    }
  }
  this.newconfig.sources_hash = sources_hash;
  
  var datasource_mode = this.datasource_mode;
  if(this.newconfig && this.newconfig.datasource_mode != undefined) { datasource_mode = this.newconfig.datasource_mode; }

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  if(datasource_mode == "feature") { paramXML += "<mode>feature_sources</mode>"; }
  else if(datasource_mode == "edge") { paramXML += "<mode>edge_sources</mode>"; }
  else { paramXML += "<mode>sources</mode>";  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "<filter>" + filter + "</filter>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  this.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { zenbuElement_sourcesParseSearchResponse(id); };}(this.elementID);
  sourcesXMLHttp.open("POST", eedbSearchFCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function zenbuElement_sourcesParseSearchResponse(elementID) {
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
    reportElement.sourcesInterfaceShowSearchResults();
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
  reportElement.sourcesInterfaceShowSearchResults();
}


function zenbuElement_sourcesInterfaceShowSearchResults() {
  var sourceResultDiv = document.getElementById(this.elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  
  if(!this.newconfig.sources_hash) {
    this.newconfig.sources_hash = new Object;
  }
  var sources_array = new Array();
  var sources_hash = this.newconfig.sources_hash;
  
  var select_count = 0;
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) { select_count++; }
    sources_array.push(source);
  }
  sources_array.sort(zenbuElement_sources_sort_func);
  
  sourceResultDiv.innerHTML = "";
  
  //------------
  var sourceCountDiv = sourceResultDiv.appendChild(document.createElement('div'));
  sourceCountDiv.id = elementID + "_sources_search_count_div";
  this.sourcesInterfaceUpdateSearchCounts();
  
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
    checkbox.setAttribute("onclick", "zenbuElement_sourcesSelectSource(\""+elementID+"\", \"" +source.id+ "\", this.checked);");
    
    //name
    var td2 = tr.appendChild(document.createElement('td'));
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "#");
    a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'source-info', '"+source.id+"'); return false; ");
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


function zenbuElement_sourcesInterfaceUpdateSearchCounts() { 
  var sources_hash = this.newconfig.sources_hash;
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
    a1.setAttribute("onclick", "zenbuElement_sourcesSelectSource(\""+elementID+"\", 'all'); return false;");
    a1.innerHTML = "select all";
  }
}


function zenbuElement_sourcesSelectSource(elementID, srcID, mode) {
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
    reportElement.sourcesInterfaceShowSearchResults();
  } else {
    var source = sources_hash[srcID];
    if(source) {
      if(mode) { source.selected = true; }
      else     { source.selected = false; }
      reportElement.sourcesInterfaceUpdateSearchCounts();
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


function zenbuElement_sources_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  var an = String(a.name).toUpperCase();
  var bn = String(b.name).toUpperCase();
  if(an < bn) { return -1; }
  if(an > bn) { return 1; }
  
  return 0;
}

