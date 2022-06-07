
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
  this.initFromConfigDOM  = zenbuElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuElement_generateConfigDOM;  //returns a ConfigDOM object
  
  this.elementEvent       = zenbuElement_elementEvent;
  this.reconfigureParam   = zenbuElement_reconfigureParam;
  
  this.resetElement       = zenbuElement_reset;
  this.postprocessElement = zenbuElement_postprocess;
  this.showSelections     = zenbuElement_showSelections
  this.drawElement        = zenbuElement_draw;
  this.configSubpanel     = zenbuElement_configSubpanel;
  this.filterSubpanel     = zenbuElement_filterSubpanel;
  
  //internal methods
  this.initElement        = zenbuElement_init;
  
  //finally perform init
  this.initElement();

  return this;
}


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
// Element configXML creation / init
//=================================================================================

function reportsCreateElementFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return null; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type == "layout") { return null;}
  if(element_type == "tools_panel") { return null;}

  var elementID = elementDOM.getAttribute("elementID");

  var reportElement = current_report.elements[elementID];
  if(!reportElement) {
    reportElement = zenbuElement_createElement(element_type, elementID);
  }

  reportElement.load_on_page_init = false;
  reportElement.show_titlebar = true;
  reportElement.widget_search = false;
  reportElement.widget_filter = false;
  reportElement.move_selection_to_top=false;
  reportElement.sort_reverse = false;
  reportElement.show_search_matches = false;
  reportElement.hide_zero = false;
  reportElement.title = "";
  reportElement.title_prefix = "";
  //reportElement.resetable = false;
  
  if(elementDOM.getAttribute("main_div_id")) {  reportElement.main_div_id = elementDOM.getAttribute("main_div_id"); }
  if(elementDOM.getAttribute("title")) {  reportElement.title = elementDOM.getAttribute("title"); }
  if(elementDOM.getAttribute("title_prefix")) {  reportElement.title_prefix = elementDOM.getAttribute("title_prefix"); }

  if(elementDOM.getAttribute("datasource_mode")) {  reportElement.datasource_mode = elementDOM.getAttribute("datasource_mode"); }
  if(elementDOM.getAttribute("datasourceElementID")) {  reportElement.datasourceElementID = elementDOM.getAttribute("datasourceElementID"); }
  if(elementDOM.getAttribute("source_ids")) {  reportElement.source_ids = elementDOM.getAttribute("source_ids"); }
  if(elementDOM.getAttribute("query_filter")) {  reportElement.query_filter = elementDOM.getAttribute("query_filter"); }
  if(elementDOM.getAttribute("collaboration_filter")) {  reportElement.collaboration_filter = elementDOM.getAttribute("collaboration_filter"); }
  if(elementDOM.getAttribute("query_format")) {  reportElement.query_format = elementDOM.getAttribute("query_format"); }
  if(elementDOM.getAttribute("query_edge_search_depth")) {  reportElement.query_edge_search_depth = elementDOM.getAttribute("query_edge_search_depth"); }

  if(elementDOM.getAttribute("table_page_size")) {  reportElement.table_page_size = Math.floor(elementDOM.getAttribute("table_page_size")); }
  //if(elementDOM.getAttribute("table_num_pages")) {  reportElement.table_num_pages = elementDOM.getAttribute("table_num_pages"); }
  //if(elementDOM.getAttribute("table_page")) {  reportElement.table_page = elementDOM.getAttribute("table_page"); }
  if(elementDOM.getAttribute("sort_col")) {  reportElement.sort_col = elementDOM.getAttribute("sort_col"); }
  if(elementDOM.getAttribute("sort_reverse") == "true") { reportElement.sort_reverse = true; }
  if(elementDOM.getAttribute("move_selection_to_top") == "true") { reportElement.move_selection_to_top = true; }

  if(elementDOM.getAttribute("load_on_page_init") == "true") { reportElement.load_on_page_init = true; }
  //if(elementDOM.getAttribute("resetable") == "true") { reportElement.resetable = true; }
  if(elementDOM.getAttribute("init_selection")) {  reportElement.init_selection = elementDOM.getAttribute("init_selection"); }
  //if(elementDOM.getAttribute("selected_id")) {  reportElement.selected_id = elementDOM.getAttribute("selected_id"); }
  //if(elementDOM.getAttribute("search_data_filter")) {  reportElement.search_data_filter = elementDOM.getAttribute("search_data_filter"); }
  //if(elementDOM.getAttribute("show_search_matches") == "true") { reportElement.show_search_matches = true; }

  if(elementDOM.getAttribute("show_titlebar") == "false") { reportElement.show_titlebar = false; }
  if(elementDOM.getAttribute("widget_search") == "true") { reportElement.widget_search = true; }
  if(elementDOM.getAttribute("widget_filter") == "true") { reportElement.widget_filter = true; }
  if(elementDOM.getAttribute("border")) {  reportElement.border = elementDOM.getAttribute("border"); }

  if(elementDOM.getAttribute("hide_zero") == "true") { reportElement.hide_zero = true; }

  if(elementDOM.getAttribute("layout_mode")) {  reportElement.layout_mode = elementDOM.getAttribute("layout_mode"); }
  if(elementDOM.getAttribute("layout_parentID")) {  reportElement.layout_parentID = elementDOM.getAttribute("layout_parentID"); }
  if(elementDOM.getAttribute("layout_col")) {  reportElement.layout_col = parseInt(elementDOM.getAttribute("layout_col")); }
  if(elementDOM.getAttribute("layout_row")) {  reportElement.layout_row = parseInt(elementDOM.getAttribute("layout_row")); }
  if(elementDOM.getAttribute("layout_xpos")) {  reportElement.layout_xpos = parseInt(elementDOM.getAttribute("layout_xpos")); }
  if(elementDOM.getAttribute("layout_ypos")) {  reportElement.layout_ypos = parseInt(elementDOM.getAttribute("layout_ypos")); }
  if(elementDOM.getAttribute("content_width")) {  reportElement.content_width = parseInt(elementDOM.getAttribute("content_width")); }
  if(elementDOM.getAttribute("content_height")) {  reportElement.content_height = parseInt(elementDOM.getAttribute("content_height")); }

  //element_type specific parameters
  //if(reportElement.element_type == "table") {
  //}
  if(reportElement.element_type == "chart") {
    reportElement.dual_feature_axis = false;
    reportElement.symetric_axis = false;
    if(elementDOM.getAttribute("chart_type")) { reportElement.chart_type = elementDOM.getAttribute("chart_type"); }
    //if(elementDOM.getAttribute("layout_type")) { reportElement.layout_type = elementDOM.getAttribute("layout_type"); }
    if(elementDOM.getAttribute("dual_feature_axis") == "1") { reportElement.dual_feature_axis = true; }
    if(elementDOM.getAttribute("symetric_axis") == "1") { reportElement.symetric_axis = true; }
    
    var xaxisDOM = elementDOM.getElementsByTagName("chart_xaxis")[0];
    if(xaxisDOM.getAttribute("datatype")) { reportElement.xaxis.datatype = xaxisDOM.getAttribute("datatype"); }
    if(xaxisDOM.getAttribute("fixedscale") == "1") { reportElement.xaxis.fixedscale = true; } else { reportElement.xaxis.fixedscale = false; }
    if(xaxisDOM.getAttribute("symetric") == "1") { reportElement.xaxis.symetric = true; } else { reportElement.xaxis.symetric = false; }
    if(xaxisDOM.getAttribute("log") == "1") { reportElement.xaxis.log = true; } else { reportElement.xaxis.log = false; }

    var yaxisDOM = elementDOM.getElementsByTagName("chart_yaxis")[0];
    if(yaxisDOM.getAttribute("datatype")) { reportElement.yaxis.datatype = yaxisDOM.getAttribute("datatype"); }
    if(yaxisDOM.getAttribute("fixedscale") == "1") { reportElement.yaxis.fixedscale = true; } else { reportElement.yaxis.fixedscale = false; }
    if(yaxisDOM.getAttribute("symetric") == "1") { reportElement.yaxis.symetric = true; } else { reportElement.yaxis.symetric = false; }
    if(yaxisDOM.getAttribute("log") == "1") { reportElement.yaxis.log = true; } else { reportElement.yaxis.log = false; }
  }
  if(reportElement.element_type == "zenbugb") {
    if(elementDOM.getAttribute("zenbu_url")) { reportElement.zenbu_url = elementDOM.getAttribute("zenbu_url"); }
    if(elementDOM.getAttribute("view_config")) { reportElement.view_config = elementDOM.getAttribute("view_config"); }
    if(elementDOM.getAttribute("chrom_location")) { reportElement.chrom_location = elementDOM.getAttribute("chrom_location"); }
  }
  if(reportElement.element_type == "html") {
    if(elementDOM.getAttribute("html_content")) { reportElement.html_content = elementDOM.getAttribute("html_content"); }
    var htmlContentDOM = elementDOM.getElementsByTagName("html_content");
    if(htmlContentDOM && htmlContentDOM.length>0) {
      reportElement.html_content = htmlContentDOM[0].firstChild.nodeValue;
    }
    //console.log("html_content ["+reportElement.html_content+"]")
  }
  if(reportElement.element_type == "category") {
    if(elementDOM.getAttribute("category_datatype")) { reportElement.category_datatype = elementDOM.getAttribute("category_datatype"); }
    if(elementDOM.getAttribute("display_type")) { reportElement.display_type = elementDOM.getAttribute("display_type"); }
    if(elementDOM.getAttribute("colorspace")) { reportElement.colorspace = elementDOM.getAttribute("colorspace"); }
  }
  //if(reportElement.element_type == "layout") {
  //  if(reportElement.layout_type) { elementDOM.setAttribute("layout_type", reportElement.layout_type); }
  //}

  
  //dtype_column
  //  <dtype_column datatype="geneName" title="geneName" colnum="6" col_type="mdata" visible="true"/>
  var colDOMs = elementDOM.getElementsByTagName("dtype_column");
  for(var j=0; j<colDOMs.length; j++) {
    var colDOM = colDOMs[j];
    if(!colDOM) { continue; }
    
    var datatype = colDOM.getAttribute("datatype");
    var title = colDOM.getAttribute("title");

    var t_col = reportElementAddDatatypeColumn(reportElement, datatype, title);

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
    
    var trigger = reportElementAddCascadeTrigger(reportElement, targetElementID, on_trigger, action_mode, options);
  }

  reportsUpdateElementLayout(reportElement);
  return reportElement;
}


function zenbuElement_createElement(element_type, elementID) {
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
    default:           reportElement = new ZenbuElement(elementID); break;  //generic element
  }
  
  //store into the hash of global elements on the page
  if(reportElement && reportElement.elementID) {
    current_report.elements[reportElement.elementID] = reportElement;
  }
  return reportElement;
}


//=================================================================================
// View/Element configXML creation / save
//=================================================================================



function reportsGenerateElementDOM(reportElement) {
  if(!reportElement) { return null; }
  if(reportElement.element_type == "tools_panel") { return null; }
  
  var doc = document.implementation.createDocument("", "", null);
  
  var elementDOM = doc.createElement("reportElement");
  
  if(reportElement.element_type) { elementDOM.setAttribute("element_type", reportElement.element_type); }
  if(reportElement.elementID) { elementDOM.setAttribute("elementID", reportElement.elementID); }
  if(reportElement.main_div_id) { elementDOM.setAttribute("main_div_id", reportElement.main_div_id); }

  if(reportElement.title) { elementDOM.setAttribute("title", reportElement.title); }
  if(reportElement.title_prefix) { elementDOM.setAttribute("title_prefix", reportElement.title_prefix); }
  
  if(reportElement.datasource_mode) { elementDOM.setAttribute("datasource_mode", reportElement.datasource_mode); } //feature, edge, shared_element
  if(reportElement.datasourceElementID) { elementDOM.setAttribute("datasourceElementID", reportElement.datasourceElementID); }  //for shared_element mode
  if(reportElement.source_ids) { elementDOM.setAttribute("source_ids", reportElement.source_ids); }
  if(reportElement.query_filter) { elementDOM.setAttribute("query_filter", reportElement.query_filter); }
  if(reportElement.collaboration_filter) { elementDOM.setAttribute("collaboration_filter", reportElement.collaboration_filter); }
  if(reportElement.query_format) { elementDOM.setAttribute("query_format", reportElement.query_format); }
  if(reportElement.query_edge_search_depth) { elementDOM.setAttribute("query_edge_search_depth", reportElement.query_edge_search_depth); }

  if(reportElement.table_page_size) { elementDOM.setAttribute("table_page_size", reportElement.table_page_size); }
  //if(reportElement.table_num_pages) { elementDOM.setAttribute("table_num_pages", reportElement.table_num_pages); }
  //if(reportElement.table_page) { elementDOM.setAttribute("table_page", reportElement.table_page); }
  if(reportElement.sort_col) { elementDOM.setAttribute("sort_col", reportElement.sort_col); }
  if(reportElement.sort_reverse) { elementDOM.setAttribute("sort_reverse", "true"); }
  if(reportElement.move_selection_to_top) { elementDOM.setAttribute("move_selection_to_top", "true"); }  //treelist

  if(reportElement.load_on_page_init) {
    elementDOM.setAttribute("load_on_page_init", "true");
    //if(reportElement.selected_feature) { elementDOM.setAttribute("init_selection", reportElement.selected_feature.name); }
    if(reportElement.selected_id) { elementDOM.setAttribute("init_selection", reportElement.selected_id); }
  }
  //if(reportElement.search_data_filter) { elementDOM.setAttribute("search_data_filter", reportElement.search_data_filter); }
  //if(reportElement.show_search_matches) { elementDOM.setAttribute("show_search_matches", "true"); }

  if(reportElement.hide_zero) { elementDOM.setAttribute("hide_zero", "true"); }

  if(reportElement.show_titlebar) { elementDOM.setAttribute("show_titlebar", "true"); } else { elementDOM.setAttribute("show_titlebar", "false"); }
  if(reportElement.widget_search) { elementDOM.setAttribute("widget_search", "true"); }
  if(reportElement.widget_filter) { elementDOM.setAttribute("widget_filter", "true"); }
  if(reportElement.border) { elementDOM.setAttribute("border", reportElement.border); }

  if(reportElement.layout_mode) { elementDOM.setAttribute("layout_mode", reportElement.layout_mode); }  //absolute, child
  if(reportElement.layout_parentID) { elementDOM.setAttribute("layout_parentID", reportElement.layout_parentID); } //linked to Row, Column, or Grid layoutElement
  else { elementDOM.setAttribute("layout_parentID", ""); } //root
  if(reportElement.layout_row) { elementDOM.setAttribute("layout_row", reportElement.layout_row); }
  if(reportElement.layout_col) { elementDOM.setAttribute("layout_col", reportElement.layout_col); }
  if(reportElement.layout_xpos) { elementDOM.setAttribute("layout_xpos", parseInt(reportElement.layout_xpos)); }
  if(reportElement.layout_ypos) { elementDOM.setAttribute("layout_ypos", parseInt(reportElement.layout_ypos)); }
  
  if(reportElement.content_width) { elementDOM.setAttribute("content_width", reportElement.content_width); }
  if(reportElement.content_height) { elementDOM.setAttribute("content_height", reportElement.content_height); }
  
  //dtype_columns
  if(reportElement.dtype_columns) {
    for(var i=0; i<reportElement.dtype_columns.length; i++) {
      var dtype_col = reportElement.dtype_columns[i];
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
  if(reportElement.cascade_triggers) {
    for(var trig_idx=0; trig_idx<reportElement.cascade_triggers.length; trig_idx++){
      var trigger = reportElement.cascade_triggers[trig_idx];
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
  if(reportElement.element_type == "table") {
  }
  if(reportElement.element_type == "chart") {
    if(reportElement.chart_type) { elementDOM.setAttribute("chart_type", reportElement.chart_type); }
    if(reportElement.dual_feature_axis) { elementDOM.setAttribute("dual_feature_axis", 1); }
    if(reportElement.symetric_axis) { elementDOM.setAttribute("symetric_axis", 1); }
    if(reportElement.layout_type) { elementDOM.setAttribute("layout_type", reportElement.layout_type); }

    var xaxis = doc.createElement("chart_xaxis");
    xaxis.setAttribute("datatype", reportElement.xaxis.datatype);
    if(reportElement.xaxis.fixedscale) { xaxis.setAttribute("fixedscale", 1); } else { xaxis.setAttribute("fixedscale", 0); }
    if(reportElement.xaxis.symetric)   { xaxis.setAttribute("symetric", 1); }   else { xaxis.setAttribute("symetric", 0); }
    if(reportElement.xaxis.log)        { xaxis.setAttribute("log", 1); }        else { xaxis.setAttribute("log", 0); }
    elementDOM.appendChild(xaxis);

    var yaxis = doc.createElement("chart_yaxis");
    yaxis.setAttribute("datatype", reportElement.yaxis.datatype);
    if(reportElement.yaxis.fixedscale) { yaxis.setAttribute("fixedscale", 1); } else { yaxis.setAttribute("fixedscale", 0); }
    if(reportElement.yaxis.symetric)   { yaxis.setAttribute("symetric", 1); }   else { yaxis.setAttribute("symetric", 0); }
    if(reportElement.yaxis.log)        { yaxis.setAttribute("log", 1); }        else { yaxis.setAttribute("log", 0); }
    elementDOM.appendChild(yaxis);
  }
  if(reportElement.element_type == "zenbugb") {
    if(reportElement.zenbu_url) { elementDOM.setAttribute("zenbu_url", reportElement.zenbu_url); }
    if(reportElement.view_config) { elementDOM.setAttribute("view_config", reportElement.view_config); }
    if(reportElement.chrom_location) { elementDOM.setAttribute("chrom_location", reportElement.chrom_location); }
  }
  if(reportElement.element_type == "html") {
    if(reportElement.html_content) {
      //elementDOM.setAttribute("html_content", reportElement.html_content);
      var htmlContentDOM = elementDOM.appendChild(doc.createElement("html_content"));
      //htmlContentDOM.appendChild(doc.createTextNode(escapeXml(reportElement.html_content)));
      htmlContentDOM.appendChild(doc.createTextNode(reportElement.html_content));
    }
    //if(reportElement.view_config) { elementDOM.setAttribute("view_config", reportElement.view_config); }
    //if(reportElement.chrom_location) { elementDOM.setAttribute("chrom_location", reportElement.chrom_location); }
  }
  if(reportElement.element_type == "category") {
    if(reportElement.category_datatype) {
      elementDOM.setAttribute("category_datatype", reportElement.category_datatype);
      elementDOM.setAttribute("display_type", reportElement.display_type);
      elementDOM.setAttribute("colorspace", reportElement.colorspace);
    }
  }

  if(reportElement.element_type == "layout") {
    if(reportElement.layout_type) { elementDOM.setAttribute("layout_type", reportElement.layout_type); }
  }
  
  reportElement.elementDOM = elementDOM;
  return elementDOM;
}


//=====================================================================
//
// Element superclass methods. root method which subclasses extend
//
//=====================================================================


function reportsResetElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.resetable) { return; }
  
  //clear previous loaded data
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.edge_array = new Array();
  
  //common resets
  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;
  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;
  
  reportElement.loading = false;  //TODO: need to double check this logic
  
  //element specific resets
  if(reportElement.element_type == "treelist") {
    reportsResetTreeListElement(reportElement);
  }
  if(reportElement.element_type == "table") {
    reportsResetTableElement(reportElement);
  }
  if(reportElement.element_type == "chart") {
    reportsResetChartElement(reportElement);
  }
  if(reportElement.element_type == "zenbugb") {
    reportsResetZenbuGB(reportElement);
  }
  if(reportElement.element_type == "html") {
    reportsResetHtmlElement(reportElement);
  }
  if(reportElement.element_type == "category") {
    reportsResetCategoryElement(reportElement);
  }
  
  
  //trigger draw to clear display
  reportsDrawElement(elementID);
  
  reportElementTriggerCascade(reportElement, "reset");
}


function reportsLoadElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  
  console.log("reportsLoadElement ["+elementID+"]");
  reportsResetElement(elementID);
  
  //datasource general
  if(reportElement.datasource_mode == "feature") {
    reportElementLoadSourceFeatures(reportElement);
  }
  if(reportElement.datasource_mode == "edge") {
    reportElementLoadSourceEdges(reportElement);
  }
  if(reportElement.datasource_mode == "source") {
    reportElementLoadSources(reportElement);
  }
  if(reportElement.datasource_mode == "shared_element") {
    //copy column/datatypes from datasource to reportElement
    if(reportElement.datasourceElementID) {
      datasourceElement = current_report.elements[reportElement.datasourceElementID];
      if(datasourceElement) {
        for(var dtype in datasourceElement.datatypes) {
          var dtype_col = datasourceElement.datatypes[dtype];
          if(!dtype_col) { continue; }
          reportElementAddDatatypeColumn(reportElement, dtype_col.datatype, dtype_col.title, dtype_col.visible);
        }
      }
    }
    reportsPostprocessElement(elementID);
  }
  
  //element_type related loading
  if(reportElement.element_type == "zenbugb") {
    reportsLoadZenbuGB(reportElement);
  }
  
  //element specific resets
  //if(reportElement.elementID == "target_DE_genes") {
  //  reportsLoadTargetDEgenes();
  //}
  
  //maybe trigger postprocess here, but maybe internal to the Load methods
  //reportsPostprocessElement(elementID);
}


function reportsPostprocessElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  var starttime = new Date();
  console.log("reportsPostprocessElement "+elementID);
  
  //datasource general
  if(reportElement.datasource_mode == "feature") {
    reportElementPostprocessFeaturesQuery(reportElement);
  }
  if(reportElement.datasource_mode == "edge") {
    reportElementPostprocessEdgesQuery(reportElement);
  }
  if(reportElement.datasource_mode == "source") {
    reportElementPostprocessSourcesQuery(reportElement);
  }
  
  //reportElementSearchData(elementID); //resets the search_match flag and applies search if needed
  if(reportElement.search_data_filter || reportElement.show_search_matches) {
    reportElementSearchData(elementID); //resets the search_match flag and applies search if needed
  }
  
  //element_type related postprocessing
  if(reportElement.element_type == "treelist") {
    reportsPostprocessTreeList(reportElement);
  }
  if(reportElement.element_type == "chart") {
    reportsPostprocessChart(reportElement);
  }
  if(reportElement.element_type == "table") {
    reportsPostprocessTable(reportElement);
  }
  if(reportElement.element_type == "zenbugb") {
    reportsPostprocessZenbuGB(reportElement);
  }
  if(reportElement.element_type == "html") {
    reportsPostprocessHtmlElement(reportElement);
  }
  if(reportElement.element_type == "category") {
    reportsPostprocessCategoryElement(reportElement);
  }
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportsPostprocessElement "+reportElement.elementID+" "+(runtime)+"msec");
  
  //TODO: redo the init_selection logic to use the new selection event logic, and allow URL init_selection
  if(!reportElement.selected_feature && reportElement.init_selection) {
    //if(reportElement.init_selection) {
    reportElementEvent(reportElement.elementID, 'select', reportElement.init_selection);
    //reportElement.init_selection = ""; //clear it, uses the new current selection at save time
  }
  
  //trigger cascades here
  reportElementTriggerCascade(reportElement, "postprocess");
  reportElementTriggerCascade(reportElement, "select");
}


function reportsDrawElement(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  
  if(reportElement.element_type == "layout") { return; }  //hack for now
  
  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }
  
  //general drawing for all elements: frame, titlebar, loading_info
  var main_div = reportElement.main_div;
  if(!main_div) {
    main_div = document.getElementById(reportElement.main_div_id);
    reportElement.main_div = main_div;
  }
  if(!main_div) { return; }
  main_div.innerHTML = "";
  main_div.setAttribute('style', "font-size:12px;");
  console.log("reportsDrawElement ["+elementID+"]");
  
  //frame, resize and titlebar
  var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; "+
  "background-color:#FDFDFD; padding: 5px 5px 5px 5px; ";  //bck #FDFDFD, F6F6F6
  style += "min-width:100px; ";
  var border = reportElement.border;
  if(reportElement.newconfig && reportElement.newconfig.border != undefined) { border = reportElement.newconfig.border; }
  switch(border) {
    case "none": break;
    case "inset": style += "border:inset 2px; "; break;
    case "simple": style += "border:solid 2px #808080; "; break;
    case "double": style += "border:double 3px #808080; "; break;
    case "left": style += "border:solid 1px #808080; border-left:solid 5px #808080; "; break;
    case "round": style += "border-radius: 7px; border: solid 2px #808080; "; break;
    default: break;
  }
  if(current_report.edit_page_configuration) { //if editing ... draw frame/resize
    style += "overflow: auto; resize: both; ";
    //style += "border:inset; border-width:2px; overflow: auto; resize: both; ";
    //"padding: 5px 5px 5px 5px; overflow-y:scroll; resize:both; ";
  }
  if((reportElement.layout_mode == "absolute") || (reportElement.layout_mode == "dragging")) {
    style += "position:absolute; left:"+ reportElement.layout_xpos +"px; top:"+ reportElement.layout_ypos +"px; ";
  }
  if(reportElement.content_width) { style += "width:"+(reportElement.content_width)+"px; "; }
  if(reportElement.content_height) { style += "height: "+(reportElement.content_height)+"px; "; }
  main_div.setAttribute('style', style);
  
  main_div.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mousedown');");
  main_div.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mouseup');");
  
  reportElementDrawTitlebar(reportElement);
  
  if(datasourceElement.loading) {
    var load_info = main_div.appendChild(document.createElement('span'));
    load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    load_info.innerHTML = "loading...";
    return;
  }
  
  //element_type based drawing code
  if(reportElement.element_type == "table") {
    reportsDrawTable(reportElement);
  }
  if(reportElement.element_type == "treelist") {
    reportsDrawTreeList(reportElement);
  }
  if(reportElement.element_type == "chart") {
    reportsDrawChart(reportElement);
  }
  if(reportElement.element_type == "zenbugb") {
    reportsDrawZenbuGB(reportElement);
  }
  if(reportElement.element_type == "html") {
    reportsDrawHtmlElement(reportElement);
  }
  if(reportElement.element_type == "category") {
    if((reportElement.display_type == "piechart") || (reportElement.display_type == "doughnut")) {
      reportsDrawCategoryPieChart(reportElement);
    } else {
      reportsDrawCategoryElement(reportElement);
    }
  }
  if(reportElement.element_type == "tools_panel") {
    reportsDrawToolsPanel(reportElement);
  }
  
  var master_div = document.getElementById("zenbuReportsDiv");
  var masterRect = master_div.getBoundingClientRect();
  //console.log("masterRect x:"+masterRect.x+" y:"+masterRect.y+" left:"+masterRect.left+" top:"+masterRect.top+ " bottom:"+masterRect.bottom);
  var mainRect = main_div.getBoundingClientRect();
  //console.log("mainRect "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
  if(masterRect.bottom < mainRect.bottom + 10) {
    console.log("master_div bottom:"+masterRect.bottom+" height:"+masterRect.height+" adjust because "+reportElement.elementID + " bottom is "+mainRect.bottom);
    var t_height = mainRect.bottom - masterRect.top + 10;
    if(t_height < 100) { t_height = 100; }
    console.log("master_div new height: "+t_height);
    master_div.style.height = t_height + "px";
  }
}


function reportElementDrawTitlebar(reportElement) {
  if(!reportElement) { return; }
  
  var show_titlebar = reportElement.show_titlebar;
  if(reportElement.newconfig && reportElement.newconfig.show_titlebar != undefined) { show_titlebar = reportElement.newconfig.show_titlebar; }
  if(!current_report.edit_page_configuration && !show_titlebar) { return; }
  
  var master_div = document.getElementById("zenbuReportsDiv");
  var masterRect = master_div.getBoundingClientRect();
  //console.log("masterRect x:"+masterRect.x+" y:"+masterRect.y+" left:"+masterRect.left+" top:"+masterRect.top+ " bottom:"+masterRect.bottom);
  
  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  
  var mainRect = main_div.getBoundingClientRect();
  //console.log("mainRect "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top+" bottom:"+mainRect.bottom);
  /*
   if(masterRect.bottom < mainRect.bottom) {
   console.log("master_div bottom:"+masterRect.bottom+" height:"+masterRect.height+" adjust because "+reportElement.elementID + " bottom is "+mainRect.bottom);
   var t_height = mainRect.bottom - masterRect.top;
   console.log("master_div new height: "+t_height);
   master_div.style.height = t_height + "px";
   }
   */
  var width = parseInt(main_div.clientWidth);
  width = width - 5;
  //var width = mainRect.width-5;
  
  //sub panels
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) {
    //auxdiv = main_div.appendChild(document.createElement('div'));
    auxdiv = master_div.appendChild(document.createElement('div'));
    auxdiv.id = auxID;
    reportElement.auxdiv = auxdiv;
  }
  var auxwidth = mainRect.width-5;
  if(auxwidth<425) { auxwidth = 425; }
  auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left+window.scrollX)+"px; top:"+(mainRect.top+window.scrollY+10)+"px; width:"+auxwidth+"px;");
  
  reportElementToggleSubpanel(reportElement.elementID, 'refresh'); //build the sub-panels
  
  //main_div.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mousedown');");
  //main_div.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'main_div_resize_mouseup');");
  
  // titla area first
  var headerID = reportElement.main_div_id + "_header_div";
  var header_div = document.getElementById(headerID);
  if(!header_div) {
    header_div = main_div.appendChild(document.createElement('div'));
  }
  header_div.setAttribute('style', "width:100%;");
  header_div.innerHTML = "";
  reportElement.header_div = header_div;
  
  var svg = header_div.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', '20px');
  //svg.setAttribute('style', 'float:left');
  
  //widgets
  var header_g = svg.appendChild(document.createElementNS(svgNS,'g'));
  
  var titleBar = header_g.appendChild(document.createElementNS(svgNS,'rect'));
  titleBar.setAttributeNS(null, 'x', '0px');
  titleBar.setAttributeNS(null, 'y', '0px');
  titleBar.setAttributeNS(null, 'width',  (width)+"px");
  titleBar.setAttributeNS(null, 'height', "20px");
  titleBar.setAttributeNS(null, 'style', "fill: #E7E7E7;");
  if(current_report.edit_page_configuration) {
    titleBar.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'start_element_drag');");
    titleBar.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'stop_element_drag');");
  }
  
  var heading = header_g.appendChild(document.createElementNS(svgNS,'text'));
  heading.setAttributeNS(null, 'x', "10px");
  heading.setAttributeNS(null, 'y', '15px');
  heading.setAttributeNS(null, "font-weight","bold");
  heading.setAttributeNS(null, "font-size","14px");
  heading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  var text1 = document.createTextNode(reportElement.title);
  reportElement.chartTitleArea = text1;
  heading.appendChild(text1);
  if(current_report.edit_page_configuration) {
    heading.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'start_element_drag');");
    heading.setAttribute("onmouseup",   "reportElementEvent(\""+reportElement.elementID+"\", 'stop_element_drag');");
  }
  
  //widgets
  var widget_pos = width - 4;
  
  if(current_report.edit_page_configuration && reportElement.element_type!="tools_panel") {
    widget_pos -= 22;
    var configwidget = reportElementCreateConfigWidget(reportElement);
    configwidget.setAttributeNS(null, 'transform', "translate("+widget_pos+",0)");
    header_g.appendChild(configwidget);
  }
  
  var widget_filter = reportElement.widget_filter;
  if(reportElement.newconfig && reportElement.newconfig.widget_filter != undefined) { widget_filter = reportElement.newconfig.widget_filter; }
  if(widget_filter) {
    widget_pos -= 20;
    var widget = reportElementCreateFilterWidget(reportElement);
    widget.setAttributeNS(null, 'transform', "translate("+ widget_pos +",2)");
    header_g.appendChild(widget);
  }
  
  var widget_search = reportElement.widget_search;
  if(reportElement.newconfig && reportElement.newconfig.widget_search != undefined) { widget_search = reportElement.newconfig.widget_search; }
  if(widget_search) {
    widget_pos -= 20;
    var searchwidget = reportElementCreateSearchWidget(reportElement);
    searchwidget.setAttributeNS(null, 'transform', "translate("+ widget_pos +",3)");
    header_g.appendChild(searchwidget);
  }
  
  titleBar.setAttributeNS(null, 'width',  (widget_pos-5)+"px");
}


//===============================================================
//
// reportElement fetch and parse section (features and edges)
//
//===============================================================

function reportsSendPendingXHRs() {
  //document.getElementById("message").innerHTML += " reportsSendPendingXHRs";
  var pending_count =0;
  for(var elementID in reports_pending_XHRs) { 
    if(reports_active_XHRs[elementID] == null) { pending_count++; }
  }
  var active_count =0;
  for(var elementID in reports_active_XHRs) { active_count++; }
  //document.getElementById("message").innerHTML += " pendingXHRs[" + pending_count + "]  activeXHRs[" + active_count + "]";
  if(pending_count==0) { 
    //setTimeout("reportsSendPendingXHRs();", 10000); //10 seconds
    return; 
  }

  if(active_count>=maxActiveXHRs) { 
    setTimeout("reportsSendPendingXHRs();", 1000); //1 second
    return; 
  }
  for(var elementID in reports_pending_XHRs) { 
    if(reports_active_XHRs[elementID] == null) { 
      var xhrObj = reports_pending_XHRs[elementID]; 
      if(xhrObj.xhr != null) { xhrObj.xhr=null; }
      reports_pending_XHRs[elementID] = null; 
      delete reports_pending_XHRs[elementID]; 
      reports_active_XHRs[elementID] = xhrObj;
      reportsSendElementXHR(xhrObj);
      active_count++;
    }
    if(active_count>=maxActiveXHRs) { return; }
  }
}


function reportsSendElementXHR(xhrObj) {
  if(xhrObj == null) { return; }
  //document.getElementById("message").innerHTML += "  send[" + xhrObj.elementID + "]";

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  xhrObj.xhr = xhr;

  //funky code to get a parameter into the call back funtion
  xhr.onreadystatechange= function(id) { return function() { reportsXHResponse(id); };}(xhrObj.elementID);

  var webURL = eedbSearchCGI;
  if(xhrObj.mode == "region") { webURL = eedbRegionCGI; }

  xhr.open("POST", webURL, true);
  xhr.setRequestHeader("Content-Type", "text/plain; charset=UTF-8;");
  //xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", xhrObj.paramXML.length);
  //xhr.setRequestHeader("Content-encoding", "x-compress, x-gzip, gzip");
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(xhrObj.paramXML);
}


function reportsXHResponse(elementID) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }

  var xhrObj = reports_active_XHRs[elementID];
  if(xhrObj == null) {  
    //document.getElementById("message").innerHTML += elementID + ' no xhrObj';
    delete reports_active_XHRs[elementID];
    reportsDrawElement(elementID);
    reportElement.loading = false;
    setTimeout("reportsSendPendingXHRs();", 30); //30msec
    return; 
  }
  //these tests are to make sure the XHR has fully returned
  var xhr = xhrObj.xhr;
  if(xhr == null) { 
    //document.getElementById("message").innerHTML += elementID + ' no xhr ';
    return;
  }

  //document.getElementById("message").innerHTML += " ["+elementID + '-rs'+xhr.readyState+ "-st"+xhr.status + "]";
  if(xhr.readyState!=4) { return; }

  if(xhr.status>=500) { 
    //document.getElementById("message").innerHTML = "query error 500 ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    xhrObj.xhr = null;
    reports_active_XHRs[elementID] = null;
    delete reports_active_XHRs[elementID];
    reportElement.loading = false;
    reportElement.load_retry = -1;
    reportsDrawElement(elementID);
    return; 
  }

  if(xhr.status!=200) { 
    //document.getElementById("message").innerHTML += "query warn 200 ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    return; 
  }
  if(xhr.responseXML == null) { 
    //document.getElementById("message").innerHTML += "query error no response ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    xhrObj.xhr = null;
    reports_active_XHRs[elementID] = null;
    delete reports_active_XHRs[elementID];
    reportElement.loading = false;
    reportElement.load_retry = -1;
    reportsDrawElement(elementID);
    return; 
  }

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) {
    //document.getElementById("message").innerHTML += "query error no xmlDoc ["+elementID + '-'+xhr.readyState+ "-"+xhr.status + "]";
    xhrObj.xhr = null;
    reports_active_XHRs[elementID] = null;
    delete reports_active_XHRs[elementID];
    reportElement.loading = false;
    reportElement.load_retry = -1;
    reportsDrawElement(elementID);
    return;
  }
  //document.getElementById("message").innerHTML += ' draw:' + elementID;

  reportElement.loading = false;

  //TODO:
  //document.getElementById("message").innerHTML += ' got response, ready to parse XML [' + elementID +"]";
  reportsParseElementData(reportElement, xhrObj);
  //gLyphsRenderTrack(reportElement);

  //all information is now transfered into objects so
  //can delete XML and XHRs
  xhrObj.xhr = null;
  reports_active_XHRs[elementID] = null;
  delete reports_active_XHRs[elementID];
 
  reportElement.dataLoaded = true;
  reportElement.load_retry = 0;
  reportElement.loaded_timestamp = Date.now();

  reportsPostprocessElement(elementID);
  reportsDrawElement(elementID);

  reportElementTriggerCascade(reportElement, "load");  //on_trigger==load happens after element loads/postprocess

  //see if there are anymore requests pending to be sent
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
}


function reportsParseElementData(reportElement, xhrObj) {
  //this is the call back function after a new XHR has completed
  //which converts the XML into JSON objects so the XHR and XML
  //can deleted
  var starttime = new Date();

  var xhr        = xhrObj.xhr;
  var xmlDoc     = xhr.responseXML.documentElement;
  //document.getElementById("message").innerHTML += " parseElementData["+xhrObj.elementID+"]";

  reportElement.features = new Object();
  reportElement.feature_array = new Array();

  reportElement.edge_array = new Array();

  if(!reportElement.datasources) { reportElement.datasources = new Object(); }
  reportElement.sources_array = new Array();
  if(!reportElement.datatypes) {  reportElement.datatypes   = new Object(); }
  
  reportElement.security_error = "";
  var security_error = xmlDoc.getElementsByTagName("security_error");
  if(security_error && security_error.length>0) {
    reportElement.security_error = security_error[0].getAttribute("blocked");
    return;
  }

  // get the datasources for this reportElement
  var sources = xmlDoc.getElementsByTagName("experiment");
  for(var i=0; i<sources.length; i++) {
    var sourceDOM  = sources[i];
    var sourceID   = sourceDOM.getAttribute("id");
    var source = reportElement.datasources[sourceID];
    source = eedbParseExperimentData(sourceDOM, source);
    reportElement.datasources[source.id] = source;
  }
  var sources = xmlDoc.getElementsByTagName("featuresource");
  for(var i=0; i<sources.length; i++) {
    var sourceDOM  = sources[i];
    var sourceID   = sourceDOM.getAttribute("id");
    var source = reportElement.datasources[sourceID];
    //if(source) { console.log("reparse source ["+sourceID+"]"); } else { console.log("new source ["+sourceID+"] to parse"); }
    source = eedbParseFeatureSourceData(sourceDOM, source);
    reportElement.datasources[source.id] = source;
  }
  var sources = xmlDoc.getElementsByTagName("edgesource");
  for(var i=0; i<sources.length; i++) {
    var sourceDOM  = sources[i];
    var sourceID   = sourceDOM.getAttribute("id");
    var source = reportElement.datasources[sourceID];
    //if(source) { console.log("reparse source ["+sourceID+"]"); } else { console.log("new source ["+sourceID+"] to parse"); }
    source = eedbParseEdgeSourceXML(sourceDOM, source);
    reportElement.datasources[source.id] = source;
  }
  //build source_array from the datasources hash
  for(var sourceID in reportElement.datasources) {
    var source = reportElement.datasources[sourceID];
    if(!source) { continue; }
    reportElement.sources_array.push(source);
    //console.log("source ["+source.name+"] ["+source.id+"] desc="+source.mdata["description"]+"]");
  }
  //console.log("sources_array "+ reportElement.sources_array.length +" sources");

  //sources mode
  if(reportElement.datasource_mode == "source") {
    //console.log("add default source columns");
    reportElementAddDatatypeColumn(reportElement, "name", "name", true);
    reportElementAddDatatypeColumn(reportElement, "category", "category", true);
    reportElementAddDatatypeColumn(reportElement, "eedb:assembly_name", "assembly", true);
    reportElementAddDatatypeColumn(reportElement, "description", "description", true);
    reportElementAddDatatypeColumn(reportElement, "import_date", "import_date", true);
    reportElementAddDatatypeColumn(reportElement, "create_date", "create_date", true);
    reportElementAddDatatypeColumn(reportElement, "owner_identity", "owner_identity", true);
    reportElementAddDatatypeColumn(reportElement, "platform", "platform", true);
    //reportElementAddDatatypeColumn(reportElement, "feature_count", "feature_count", true);
    //reportElementAddDatatypeColumn(reportElement, "series_point", "series_point", true);

    for(var i=0; i<reportElement.sources_array.length; i++) {
      var source  = reportElement.sources_array[i];
      if(!source) { continue; }
      source.filter_valid = true;
      //if(source.className == "experiment") { }
      for(var tag in source.mdata) { //new common mdata[].array system
        var t_col = reportElementAddDatatypeColumn(reportElement, tag, tag, false);
        //t_col.visible = false;
      }
    }
  }
  
  //read the features
  var features = xmlDoc.getElementsByTagName("feature");
  if(features.length>0) {
    if(reportElement.datasource_mode == "feature") {
      reportElementAddDatatypeColumn(reportElement, "name", "name", true);
      reportElementAddDatatypeColumn(reportElement, "category", "category", true);
      reportElementAddDatatypeColumn(reportElement, "source_name", "source_name", true);
      reportElementAddDatatypeColumn(reportElement, "location_link", "location", false);
      reportElementAddDatatypeColumn(reportElement, "location_string", "location", false);
    }
    if(reportElement.datasource_mode == "edge") {
      reportElementAddDatatypeColumn(reportElement, "f1.name", "name", true);
      reportElementAddDatatypeColumn(reportElement, "f1.category", "category", false);
      reportElementAddDatatypeColumn(reportElement, "f1.source_name", "source_name", false);
      reportElementAddDatatypeColumn(reportElement, "f1.location_link", "location", false);
      reportElementAddDatatypeColumn(reportElement, "f1.location_string", "location", false);
      
      reportElementAddDatatypeColumn(reportElement, "f2.name", "name", true);
      reportElementAddDatatypeColumn(reportElement, "f2.category", "category", false);
      reportElementAddDatatypeColumn(reportElement, "f2.source_name", "source_name", false);
      reportElementAddDatatypeColumn(reportElement, "f2.location_link", "location", false);
      reportElementAddDatatypeColumn(reportElement, "f2.location_string", "location", false);
    }
  }

  for(var i=0; i<features.length; i++) {
    var featureDOM  = features[i];
    var feature = eedbParseFeatureFullXML(featureDOM);
    if(!feature) { continue; }
    feature.filter_valid = true;
    feature.search_match = false;
    feature.f1_edge_count = 0;
    feature.f2_edge_count = 0;

    //FANTOM6 cat metadata hack
    if(feature.mdata && feature.mdata["CAT_geneClass"] && !feature.description) {
      feature.description = feature.mdata["geneName"] + " ";
      feature.summary = feature.mdata["HGNC_name"];
      feature.summary += ", " + feature.mdata["geneType"];
      if(feature.mdata["CAT_geneClass"]) { feature.summary += ", " + feature.mdata["CAT_geneClass"][0]; }
      if(feature.mdata["alias_name"]) { feature.summary += ", " + feature.mdata["alias_name"][0]; }
      if(feature.mdata["prev_name"]) { feature.summary += ", " + feature.mdata["prev_name"][0]; }
      if(feature.mdata["alias_symbol"]) { feature.summary += ", " + feature.mdata["alias_symbol"][0]; }
      if(feature.mdata["prev_symbol"]) { feature.summary += ", " + feature.mdata["prev_symbol"][0]; }
    }
    
    //mdata to column datatype
    if(reportElement.datasource_mode == "feature") {
      //reportElementAddDatatypeColumn(reportElement, "name", "name", true);
      //reportElementAddDatatypeColumn(reportElement, "category", "category", true);
      //reportElementAddDatatypeColumn(reportElement, "source_name", "source_name", true);
      //reportElementAddDatatypeColumn(reportElement, "location_link", "location", false);
      //reportElementAddDatatypeColumn(reportElement, "location_string", "location", false);
      for(var tag in feature.mdata) { //new common mdata[].array system
        if(!reportElement.datatypes[tag]) {
          var t_col = reportElementAddDatatypeColumn(reportElement, tag, tag, false);
          //t_col.visible = false;
        }
      }
      //TODO: feature.expression.data_types
      if(feature.expression) {
        for(var eidx=0; eidx<feature.expression.length; eidx++) {
          var expr = feature.expression[eidx];
          if(!expr) { continue; }
          var dtype = expr.datatype;
          if(!dtype) { continue; }
          var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, dtype, false);
          dtype_col.col_type = "signal";
          if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
            dtype_col.min_val = expr.total;
            dtype_col.max_val = expr.total;
          }
          if(expr.total < dtype_col.min_val) { dtype_col.min_val = expr.total; }
          if(expr.total > dtype_col.max_val) { dtype_col.max_val = expr.total; }
        }
        /*
        expression.expID      = expID;
        expression.datatype   = expressXML.getAttribute("datatype");
        expression.count      = 1;
        expression.dup        = 1;
        expression.sense      = 0;
        expression.antisense  = 0;
        expression.total      = 0;  //value for either/both strands
        feature.expression.push(expression);
        */
      }
    }

    //connect datasource
    //console.log("feature ["+feature.name+"] source_id["+feature.source_id+"]");
    if(reportElement.datasources[feature.source_id]) { 
      //source is in the datasource cache so use that one
      feature.source = reportElement.datasources[feature.source_id];
      //console.log("found source ["+feature.source.name+"] ["+feature.source.id+"]");
    } else if(feature.source) {
      //link the one loaded with the feature in so we can fully load later
      reportElement.datasources[feature.source_id] = feature.source; 
      reportElement.sources_array.push(feature.source);
    }
    reportElement.feature_array.push(feature);
    reportElement.features[feature.id] = feature;
  }
  //document.getElementById("message").innerHTML += " read "+ reportElement.feature_array.length +" features,";
  //document.getElementById("message").innerHTML += " read "+ reportElement.sources_array.length +" sources,";

  //read the edges
  var edges = xmlDoc.getElementsByTagName("edge");
  for(var i=0; i<edges.length; i++) {
    var edgeDOM  = edges[i];
    var edge     = eedbParseEdgeXML(edgeDOM);
    edge.filter_valid = true;
    edge.search_match = false;
    //connect datasource and features
    if(reportElement.datasources[edge.source_id]) { 
      edge.source = reportElement.datasources[edge.source_id];
    }
    if(reportElement.features[edge.feature1_id]) { 
      edge.feature1 = reportElement.features[edge.feature1_id];
      edge.feature1.f1_edge_count++;
      //reportElementAddDatatypeColumn(reportElement, "f1.name", "name", true);
      //reportElementAddDatatypeColumn(reportElement, "f1.category", "category", false);
      //reportElementAddDatatypeColumn(reportElement, "f1.source_name", "source_name", false);
      //reportElementAddDatatypeColumn(reportElement, "f1.location_link", "location", false);
      //reportElementAddDatatypeColumn(reportElement, "f1.location_string", "location", false);
      //document.getElementById("message").innerHTML += " connect-f1";
      for(var tag in edge.feature1.mdata) { //new common mdata[].array system
        var dtype = "f1."+tag;
        if(!reportElement.datatypes[dtype]) {
          var t_col = reportElementAddDatatypeColumn(reportElement, dtype, tag);
          //t_col.visible = false;
        }
      }
      //TODO: feature1.expression.data_types
      if(edge.feature1.expression) {
        for(var eidx=0; eidx<edge.feature1.expression.length; eidx++) {
          var expr = edge.feature1.expression[eidx];
          if(!expr) { continue; }
          if(!expr.datatype) { continue; }
          var dtype = "f1."+expr.datatype;
          var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, expr.datatype, false);
          dtype_col.col_type = "signal";
          if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
            dtype_col.min_val = expr.total;
            dtype_col.max_val = expr.total;
          }
          if(expr.total < dtype_col.min_val) { dtype_col.min_val = expr.total; }
          if(expr.total > dtype_col.max_val) { dtype_col.max_val = expr.total; }
        }
      }
    }
    if(reportElement.features[edge.feature2_id]) { 
      edge.feature2 = reportElement.features[edge.feature2_id];
      edge.feature2.f2_edge_count++;
      //reportElementAddDatatypeColumn(reportElement, "f2.name", "name", true);
      //reportElementAddDatatypeColumn(reportElement, "f2.category", "category", false);
      //reportElementAddDatatypeColumn(reportElement, "f2.source_name", "source_name", false);
      //reportElementAddDatatypeColumn(reportElement, "f2.location_link", "location", false);
      //reportElementAddDatatypeColumn(reportElement, "f2.location_string", "location", false);
      //document.getElementById("message").innerHTML += " connect-f2";
      for(var tag in edge.feature2.mdata) { //new common mdata[].array system
        var dtype = "f2."+tag;
        if(!reportElement.datatypes[dtype]) {
          var t_col = reportElementAddDatatypeColumn(reportElement, dtype, tag);
          //t_col.visible = false;
        }
      }
      //TODO: feature2.expression.data_types
      if(edge.feature2.expression) {
        for(var eidx=0; eidx<edge.feature2.expression.length; eidx++) {
          var expr = edge.feature2.expression[eidx];
          if(!expr) { continue; }
          if(!expr.datatype) { continue; }
          var dtype = "f2."+expr.datatype;
          var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, expr.datatype, false);
          dtype_col.col_type = "signal";
          if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
            dtype_col.min_val = expr.total;
            dtype_col.max_val = expr.total;
          }
          if(expr.total < dtype_col.min_val) { dtype_col.min_val = expr.total; }
          if(expr.total > dtype_col.max_val) { dtype_col.max_val = expr.total; }
        }
      }
    }
    reportElement.edge_array.push(edge);
  }
  //document.getElementById("message").innerHTML += " read "+ reportElement.edge_array.length +" edges,";

  //loop on datatype_cols and reset the min/max to zero
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) {
      dtype_col.filter_min = "min";
      dtype_col.filter_max = "max";
    }
    dtype_col.min_val = 0;
    dtype_col.max_val = 0;
  }

  //datatypes,from the sources or looping on Expression/Weights
  var edge_count = reportElement.edge_array.length;
  for(var k=0; k<edge_count; k++) {
    var edge = reportElement.edge_array[k];
    if(!edge) { continue; }
    for(var dtype in edge.weights) {
      if(!reportElement.dtype_filter_select) { reportElement.dtype_filter_select = dtype; }

      var weights = edge.weights[dtype];
      if(!weights) { continue; }
      //var dtype_col = reportElement.datatypes[dtype];
      //if(!dtype_col) {
        /*
        dtype_col = new Object;
        dtype_col.datatype = dtype;
        dtype_col.title = dtype;
        dtype_col.colnum = 0;
        dtype_col.visible = true;
        dtype_col.filtered = false;
        dtype_col.filter_abs = false;
        dtype_col.filter_min = 0;
        dtype_col.filter_max = 0;
        dtype_col.min_val = weights[0].weight;
        dtype_col.max_val = weights[0].weight;
        reportElement.datatypes[dtype] = dtype_col;
        */
      //}
      var dtype_col = reportElementAddDatatypeColumn(reportElement, dtype, dtype, true);
      dtype_col.col_type = "weight";
      if((dtype_col.min_val == 0) && (dtype_col.max_val == 0)) {
        dtype_col.min_val = weights[0].weight;
        dtype_col.max_val = weights[0].weight;
      }

      for(var j=0; j<weights.length; j++) {
        var w1 = weights[j].weight;
        if(w1 < dtype_col.min_val) { dtype_col.min_val = w1; }
        if(w1 > dtype_col.max_val) { dtype_col.max_val = w1; }
      }
    }
  }
  var colnum = 1;
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    //dtype_col.colnum = colnum++

    if(!dtype_col.filtered) {
      dtype_col.filter_min = "min";
      dtype_col.filter_max = "max";
    }
  }

  //maybe fetch full sources
  //gLyphsCacheSources(reportElement);  //original per-track source cache system

  var dtypes = "";
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    dtypes += dtype + ", ";
  }
  console.log("reportsParseElementData final dtype_columns: "+dtypes);

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportsParseElementData ["+reportElement.elementID+"] "+(runtime)+"msec");
}


function reportElementAddDatatypeColumn(reportElement, dtype, title, visible) {
  if(!reportElement) { return; }

  if(reportElement.element_type == "treelist") {
    dtype = dtype.replace(/^f1\./, '');
    dtype = dtype.replace(/^f2\./, '');
  }
  
  if(!reportElement.dtype_columns) { reportElement.dtype_columns = new Array; }
  var dtype_col = reportElement.datatypes[dtype];
  if(!dtype_col) {
    dtype_col = new Object;
    dtype_col.datatype = dtype;
    if(title) { dtype_col.title = title; }
    else { dtype_col.title = dtype; }
    dtype_col.colnum = reportElement.dtype_columns.length + 1;
    dtype_col.col_type = "mdata";
    dtype_col.visible = false;
    dtype_col.filtered = false;
    dtype_col.filter_abs = false;
    dtype_col.filter_min = "min";
    dtype_col.filter_max = "max";
    dtype_col.min_val = 0;
    dtype_col.max_val = 0;
    
    if(visible) { dtype_col.visible = true; }

    reportElement.datatypes[dtype] = dtype_col;
    reportElement.dtype_columns.push(dtype_col);
  }
  return dtype_col;
}


function reportElementEdgeCheckValidFilters(reportElement, edge) {
  if(!reportElement) { return false; }
  if(!edge) { return false; }
  if(edge.classname != "Edge") { return true; }

  edge.filter_valid = false;
  
  for(var dtype in edge.weights) {
    var weights = edge.weights[dtype];
    if(!weights) { continue; }
    
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    
    for(var j=0; j<weights.length; j++) {
      var w1 = weights[j].weight;
      if(dtype_col.filter_abs) { w1 = Math.abs(w1); }
      if((dtype_col.filter_min!="min") && (w1 < dtype_col.filter_min)) { return false; }
      if((dtype_col.filter_max!="max") && (w1 > dtype_col.filter_max)) { return false; }
    }
  }
  edge.filter_valid = true;
  return true;
}

/*
function reportElementCheckCategoryFilters(reportElement, object) {
  if(!reportElement) { return false; }
  if(!object) { return false; }
 
  //performs a combination of logic.
  //within same datatype, multiple categories are treated as OR
  //between different datatypes, filter is treated as AND
  object.filter_valid = true;

  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    if(dtype_col.col_type != "mdata") { continue; }
    if(!dtype_col.categories) { continue; }

    //perform class specifc tests if datatype is not generic mdata
    //if(dtype_col.datatype == "name") {
    //  val = object.name;
    //}
    //if((object.classname == "Experiment") || (object.classname == "FeatureSource") || (object.classname == "EdgeSource")) {
    //   if(dtype_col.datatype == "category") {
    //    val = object.category;
    //  }
    //}
    //if(object.classname == "Feature") { }
    //if(object.classname == "Edge") { }
    //if(object.classname == "Configuration") { }

    //this is one of the filtered dtypes, must pass this category test in order to continue checking next dtype
    if(!object.mdata || !object.mdata[dtype_col.datatype]) {
      //object doesn't have this datatype so immeadiately fails tests
      object.filter_valid = false;
      return false;
    }

    //perform positive OR selection on different categories of this dtype, 
    var valid=false;  //assumes fail until finds a match
    var value_array = object.mdata[dtype_col.datatype];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      val = value_array[idx1];
      var ctg_obj = dtype_col.categories[val];
      if(!ctg_obj) { continue; }
      if(ctg_obj.filtered) { 
        //console.log("found match");
        valid= true; 
        break; 
      }
    }
    if(!valid) {
      object.filter_valid = false;
      return false;
    }

    //ok pased this dtype filter, so continue on and check the others
  }
  //passed all the filters so it good to go
  object.filter_valid = true;
  return true;
}
*/

function reportElementCheckCategoryFilters(reportElement, object) {
  if(!reportElement) { return false; }
  if(!object) { return false; }

  //performs a combination of logic.
  //within same datatype, multiple categories are treated as OR
  //between different datatypes, filter is treated as AND
  object.filter_valid = true;
  
  for(var dtype in reportElement.datatypes) {
    var dtype_col = reportElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(!dtype_col.filtered) { continue; }
    if(dtype_col.col_type != "mdata") { continue; }
    if(!dtype_col.categories) { continue; }

    if(!reportsObjectCheckCategoryFilters(object, dtype_col)) {
      object.filter_valid = false;
      return false;
    }
  }
  
  //passed all the filters so it is good to go
  object.filter_valid = true;
  return true;
}


function reportsObjectCheckCategoryFilters(object, dtype_col) {
  if(!object) { return false; }
  if(!dtype_col) { return false; }

  //perform positive OR selection on different categories of this dtype,

  if(!dtype_col.filtered) { return true; }
  if(dtype_col.col_type != "mdata") { return true; }
  if(!dtype_col.categories) { return true; }

  //perform class specific tests if datatype is not generic mdata
  //if(dtype_col.datatype == "name") {
  //  val = object.name;
  //}
  //if((object.classname == "Experiment") || (object.classname == "FeatureSource") || (object.classname == "EdgeSource")) {
  //   if(dtype_col.datatype == "category") {
  //    val = object.category;
  //  }
  //}
  //if(object.classname == "Feature") { }
  //if(object.classname == "Edge") { }
  //if(object.classname == "Configuration") { }
  if(object.classname == "Edge") {
    var t_feature = null;
    if(/^f1\./.test(dtype_col.datatype)) { t_feature = object.feature1;}
    if(/^f2\./.test(dtype_col.datatype)) { t_feature = object.feature2;}
    if(t_feature) {
      //console.log("reportsObjectCheckCategoryFilters "+dtype_col.datatype+"  edge-feature["+t_feature.name+"]");
      if(!reportsObjectCheckCategoryFilters(t_feature, dtype_col)) { return false; }
      return true;
    }
  }
  
  var datatype = dtype_col.datatype;
  datatype = datatype.replace(/^f1\./, '');
  datatype = datatype.replace(/^f2\./, '');

  //this is one of the filtered dtypes, must pass this category test in order to continue checking next dtype
  if(!object.mdata || !object.mdata[datatype]) {
    //object doesn't have this datatype so immeadiately fails tests
    //console.log("reportsObjectCheckCategoryFilters "+datatype+"  obj["+object.name+"] no mdata");
    return false;
  }
  
  //perform positive OR selection on different categories of this dtype,
  var valid=false;  //assumes fail until finds a match
  var value_array = object.mdata[datatype];
  for(var idx1=0; idx1<value_array.length; idx1++) {
    val = value_array[idx1];
    var ctg_obj = dtype_col.categories[val];
    if(!ctg_obj) { continue; }
    if(ctg_obj.filtered) {
      //console.log("found match ctg["+ctg_obj.ctg+"]");
      valid= true;
      break;
    }
  }
  if(valid) { return true; }
  return false;
}


function reportElementSearchTestObject(feature, filter) {
  feature.search_match = false;
  if(feature.name && (feature.name.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  if(feature.source && feature.source.category && (feature.source.category.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  if(feature.source && feature.source.name && (feature.source.name.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  if(feature.chromloc && (feature.chromloc.toLowerCase().indexOf(filter) != -1)) {
    feature.search_match = true;
    return;
  }
  for(var tag in feature.mdata) { //new common mdata[].array system
    if(feature.search_match) { return; }
    var value_array = feature.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      if(feature.search_match) { return; }
      var value = value_array[idx1];
      if(value && (value.toLowerCase().indexOf(filter) != -1)) {
        feature.search_match = true;
        return;
      }
    }
  }
}


function reportElementSearchData(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  var starttime = new Date();

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  var source_count  = datasourceElement.sources_array.length;

  //first clear previous search
  datasourceElement.search_match_feature_count = 0;
  datasourceElement.search_match_edge_count = 0;
  datasourceElement.search_match_source_count = 0;

  for(var k=0; k<feature_count; k++) {
    var feature = datasourceElement.feature_array[k];
    if(feature) { feature.search_match = false; }
  }
  for(var k=0; k<edge_count; k++) {
    var edge = datasourceElement.edge_array[k];
    if(edge) { edge.search_match = false; }
  }
  for(var k=0; k<source_count; k++) {
    var source = datasourceElement.sources_array[k];
    if(source) { source.search_match = false; }
  }

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportElementSearchData "+elementID+" 1st clear " +(runtime)+"msec");

  if(!datasourceElement.search_data_filter) { return; }  //also performs the clear

  var filter = datasourceElement.search_data_filter;
  filter = filter.toLowerCase();
  console.log("reportElementSearchData ["+filter+"]");
  
  //features
  if(datasourceElement.datasource_mode == "feature") {
    for(var k=0; k<feature_count; k++) {
      var feature = datasourceElement.feature_array[k];
      if(!feature) { continue; }
      reportElementSearchTestObject(feature, filter);
      if(feature.search_match) { datasourceElement.search_match_feature_count++ }
    }
  }

  //edges
  if(datasourceElement.datasource_mode == "edge") {
    for(var k=0; k<feature_count; k++) {
      var feature = datasourceElement.feature_array[k];
      if(!feature) { continue; }
      reportElementSearchTestObject(feature, filter);
    }

    for(var k=0; k<edge_count; k++) {
      var edge = datasourceElement.edge_array[k];
      if(!edge) { continue; }
      edge.search_match = false;

      reportElementSearchTestObject(edge, filter); //search edge metadata?
      //reportElementSearchTestObject(edge.feature1, filter);
      //reportElementSearchTestObject(edge.feature2, filter);
      
      if(edge.feature1.search_match || edge.feature2.search_match) { edge.search_match = true; }
      
      if(!edge.filter_valid) { continue; }
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

      if(edge.search_match) { datasourceElement.search_match_edge_count++ }
    }
  }

  //sources
  if(datasourceElement.datasource_mode == "source") {
    for(var k=0; k<source_count; k++) {
      var source = datasourceElement.sources_array[k];
      if(!source) { continue; }
      reportElementSearchTestObject(source, filter);
      if(source.search_match) { datasourceElement.search_match_source_count++ }
    }
  }

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportElementSearchData "+elementID+" "+(runtime)+"msec");

  //reportElementToggleSubpanel(elementID, 'refresh');
  //reportsDrawElement(elementID);
}

//-----------------------------------
// features
//-----------------------------------

function reportElementLoadSourceFeatures(reportElement) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementLoadSourceFeatures");
  
  reportsResetElement(elementID);
  
  //clear previous loaded data
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.edge_array = new Array();
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;

  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table

  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;

  var paramXML = "<zenbu_query><format>fullxml</format><mode>features</mode>";
  paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  if(reportElement.query_filter) { paramXML += "<filter>"+reportElement.query_filter+"</filter>"; }
  paramXML += "</zenbu_query>\n";
  
  if(reports_pending_XHRs[reportElement.elementID] != null) {
    var xhrObj = reports_pending_XHRs[reportElement.elementID];
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    reports_pending_XHRs[reportElement.elementID] = null;
    delete reports_pending_XHRs[reportElement.elementID];
  }
  delete reports_active_XHRs[reportElement.elementID];
  
  var xhrObj        = new Object;
  xhrObj.elementID  = reportElement.elementID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.paramXML   = paramXML;
  xhrObj.mode       = "search";  //eedb_search.cgi
  
  reportElement.loading = true;
  reportElement.load_retry = 0;
  //document.getElementById("message").innerHTML += " prepare["+reportElement.elementID+"]";
  
  reports_pending_XHRs[reportElement.elementID] = xhrObj;
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
  
  reportsDrawElement(elementID);  //clear and show loading
  
  reportElementTriggerCascade(reportElement, "preload");  //on_trigger==preload happens before element loads/postprocess
}


function reportElementPostprocessFeaturesQuery(reportElement) {
  console.log("reportElementPostprocessFeaturesQuery");
  
  reportElement.raw_count = reportElement.feature_array.length;

  reportElement.filter_count = reportElement.feature_array.length;
  var num_pages = Math.ceil(reportElement.filter_count / reportElement.table_page_size);
  reportElement.table_num_pages = num_pages;
  reportElement.table_page = 1;

  /*
  //if requested find initial selection
  if(!reportElement.selected_feature && reportElement.init_selection) {
    var selected_feature = null;
    //TODO: redo the init_selection logic to use the new selection event logic, and allow URL init_selection
    //reportElementEvent(reportElement.elementID, 'select', reportElement.init_selection);
    for(var k=0; k<reportElement.feature_array.length; k++) {
      var feature = reportElement.feature_array[k];
      if(!feature) { continue; }
      
      if(!reportElement.selected_feature && reportElement.init_selection) {
        if(reportElement.init_selection == "any") {
          //grab first one
          if(!selected_feature) { selected_feature = feature; }
        }
        if(feature.name == reportElement.init_selection) {
          console.log("found initial feature selection by name ["+reportElement.init_selection+"]");
          selected_feature = feature;
        }
        for(var tag in feature.mdata) { //new common mdata[].array system
          var value_array = feature.mdata[tag];
          for(var idx1=0; idx1<value_array.length; idx1++) {
            var value = value_array[idx1];
            if(value == reportElement.init_selection) {
              console.log("found focus feature in mdata ["+reportElement.init_selection+"]");
              selected_feature = feature;
            }
          }
        }
      }
    }
    if(selected_feature) {
      reportElement.selected_id = selected_feature.id;
      reportElement.selected_feature = selected_feature;
    }
    //reportElement.init_selection = ""; //clear it use the current selection at save time
  }
   */
}

//---- Edges ------

function reportElementLoadSourceEdges(reportElement) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementLoadSourceEdges: " + elementID);
  
  reportsResetElement(elementID);
  reportsDrawElement(elementID); //clear

  //clear previous loaded data
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  
  reportElement.edge_array = new Array();

  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;
  
  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;

  //clear previous target/selection
  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table

  //TODO: need to figure out this logic, might need flag if ok to pull full edge-network
  //actually I think using load_on_page_init is enough. if this is set then there is no input trigger so should be ok to pull all edges
  if(!reportElement.load_on_page_init && !reportElement.focus_feature && !reportElement.filter_feature_ids) { return; }

  var paramXML = "<zenbu_query><format>"+reportElement.query_format+"</format><mode>edges</mode>";
  paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  if(reportElement.query_edge_search_depth) {
    paramXML += "<edge_search_depth>"+reportElement.query_edge_search_depth+"</edge_search_depth>";
  }
  var feature_ids = "";
  if(reportElement.focus_feature) {
    feature_ids += reportElement.focus_feature.id;
  }
  if(reportElement.filter_feature_ids) {
    if(feature_ids!="") { feature_ids += ","; }
    feature_ids += reportElement.filter_feature_ids;
  }
  paramXML += "<feature_ids>"+feature_ids+"</feature_ids>";
  if(reportElement.format == "descxml") {
    paramXML += "<mdkey_list>";
    //<mdkey_list>HGNC_symbol, HGNC_name, ";
    for(var dtype in reportElement.datatypes) {
      var dtype_col = reportElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type == "mdata") {
        paramXML += dtype_col.datatype + ", ";
      }
    }
    paramXML += "</mdkey_list>";
  }
  paramXML += "</zenbu_query>\n";
  
  //var paramXML = "<zenbu_query><format>fullxml</format><mode>edges</mode><edge_search_depth>3</edge_search_depth>";
  //paramXML += "<source_ids>CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource</source_ids>";
  //paramXML += "<source_ids>CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::10:::EdgeSource</source_ids>";
  //paramXML += "<feature_ids>"+reportElement.focus_feature.id+"</feature_ids>";
  //paramXML += "</zenbu_query>\n";
  
  if(reports_pending_XHRs[reportElement.elementID] != null) {
    var xhrObj = reports_pending_XHRs[reportElement.elementID];
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    reports_pending_XHRs[reportElement.elementID] = null;
    delete reports_pending_XHRs[reportElement.elementID];
  }
  delete reports_active_XHRs[reportElement.elementID];
  
  var xhrObj        = new Object;
  xhrObj.elementID  = reportElement.elementID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.paramXML   = paramXML;
  xhrObj.mode       = "search";
  
  reportElement.loading = true;
  reportElement.load_retry = 0;
  
  reportsDrawElement(elementID);  //clear and show loading
  reportElementTriggerCascade(reportElement, "preload");  //on_trigger==preload happens before element loads/postprocess

  reports_pending_XHRs[reportElement.elementID] = xhrObj;
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
}


function reportElementPostprocessEdgesQuery(reportElement) {
  if(!reportElement) { return; }
  var starttime = new Date();
  
  var elementID = reportElement.elementID;
  console.log("reportElementPostprocessEdgesQuery: " + elementID);

  reportElement.edge_count = reportElement.edge_array.length;
  reportElement.raw_count  = reportElement.edge_array.length;

  var feature_count = reportElement.feature_array.length;
  var edge_count    = reportElement.edge_array.length;
  console.log("reportElementPostprocessEdgesQuery: " + feature_count+ " features, " + edge_count+" edges");
  
  if(reportElement.focus_feature) {
    //if(!reportElement.selected_feature) { reportElement.selected_feature = reportElement.focus_feature; }  //DONT do this anymore
    console.log("reportElementPostprocessEdgesQuery start focus["+reportElement.focus_feature.name+"]");
  }
  
  //general edge filtering
  reportElement.filter_count=0;
  for(var k=0; k<reportElement.edge_array.length; k++) {
    var edge = reportElement.edge_array[k];
    if(!edge) { continue; }
    edge.internal_id = k;

    //filtering
    if(!edge.feature1) { continue; }
    if(!edge.feature2) { continue; }
    
    //some precalcs hacks: if asking for log10XXXX and have XXXX can calculate it
    //TODO: need to make this generic
    var basemean;
    if(edge.weights["baseMean"]) { basemean = edge.weights["baseMean"][0]; }
    if(basemean && !(edge.weights["log10baseMean"])) {
      weight = new Object();
      weight.datatype   = "log10baseMean";
      weight.weight     = Math.log10(basemean.weight);
      edge.weights[weight.datatype] = new Array;
      edge.weights[weight.datatype].push(weight);
    }

    //the weights cutoff filter check
    edge.filter_valid = true;
    if(!reportElementEdgeCheckValidFilters(reportElement, edge)) { continue; }

    if(reportElement.focus_feature &&
       (reportElement.focus_feature.id != edge.feature1_id) &&
       (reportElement.focus_feature.id != edge.feature2_id)) { continue; }

    if(!reportElementCheckCategoryFilters(reportElement, edge)) { continue; }

    reportElement.filter_count++;
  }
  console.log("reportElementPostprocessEdgesQuery filter_count= "+reportElement.filter_count);

  var num_pages = Math.ceil(reportElement.filter_count / Math.floor(reportElement.table_page_size));
  reportElement.table_num_pages = num_pages;
  reportElement.table_page = 1;
  console.log("postprocessEdgesQuery "+elementID+" filter_count= "+reportElement.filter_count+" page_size["+reportElement.table_page_size+"]  num_pages"+reportElement.table_num_pages+"]  table_page["+reportElement.table_page+"]")

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("postprocessEdgesQuery " +(runtime)+"msec");
}

//-----------------------------------
// sources
//-----------------------------------

function reportElementLoadSources(reportElement) {
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;
  console.log("reportElementLoadSources");
  
  reportsResetElement(elementID);
  
  //clear previous loaded data
  reportElement.datasources = new Object();
  reportElement.sources_array = new Array();
  reportElement.features = new Object();
  reportElement.feature_array = new Array();
  reportElement.edge_array = new Array();
  reportElement.edge_count = 0;
  reportElement.filter_count = 0;
  reportElement.raw_count = 0;
  
  reportElement.selected_id = ""; //selected row in the table
  reportElement.selected_feature = null; //selected row in the table
  reportElement.selected_edge = null; //selected row in the table
  reportElement.selected_source = null; //selected row in the table

  reportElement.table_num_pages = 0;
  reportElement.table_page = 1;
  
  //TODO: maybe system to get all mdata types and then here only query based on selected columns?
  var paramXML = "<zenbu_query><format>fullxml</format><mode>sources</mode>";
  //paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  //paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  if(reportElement.collaboration_filter) { paramXML += "<collab>"+reportElement.collaboration_filter+"</collab>"; }
  if(reportElement.query_filter) { paramXML += "<filter>"+reportElement.query_filter+"</filter>"; }
  paramXML += "</zenbu_query>\n";
  
  if(reports_pending_XHRs[reportElement.elementID] != null) {
    var xhrObj = reports_pending_XHRs[reportElement.elementID];
    if(xhrObj.xhr != null) { xhrObj.xhr=null; }
    reports_pending_XHRs[reportElement.elementID] = null;
    delete reports_pending_XHRs[reportElement.elementID];
  }
  delete reports_active_XHRs[reportElement.elementID];
  
  var xhrObj        = new Object;
  xhrObj.elementID  = reportElement.elementID;
  xhrObj.xhr        = null; //not active yet
  xhrObj.paramXML   = paramXML;
  xhrObj.mode       = "search";  //eedb_search.cgi
  
  reportElement.loading = true;
  reportElement.load_retry = 0;
  //document.getElementById("message").innerHTML += " prepare["+reportElement.elementID+"]";
  
  reports_pending_XHRs[reportElement.elementID] = xhrObj;
  setTimeout("reportsSendPendingXHRs();", 30); //30msec
  
  reportsDrawElement(elementID);  //clear and show loading
  
  reportElementTriggerCascade(reportElement, "preload");  //on_trigger==preload happens before element loads/postprocess
}


function reportElementPostprocessSourcesQuery(reportElement) {
  console.log("reportElementPostprocessSourcesQuery");
  
  reportElement.raw_count = reportElement.sources_array.length;
  //reportElement.filter_count = reportElement.sources_array.length;

  reportElement.filter_count = 0;
  for(j=0; j<reportElement.sources_array.length; j++) {
    var source = reportElement.sources_array[j];
    if(!source) { continue; }
    source.filter_valid = true;
    if(!reportElementCheckCategoryFilters(reportElement, source)) { continue; }
    reportElement.filter_count++;
  }

  var num_pages = Math.ceil(reportElement.filter_count / reportElement.table_page_size);
  reportElement.table_num_pages = num_pages;
  reportElement.table_page = 1;
}

//===================================================================================
//
// Cascade Trigger section
//
//===================================================================================

function reportElementAddCascadeTrigger(reportElement, targetElementID, on_trigger, action_mode, options) {
  //Cascade causes reload while Focus usually involves just selecting from within existing data
  if(!reportElement) { return; }
  if(!on_trigger) { return; }
  if(!action_mode) { return; }
  console.log("add CascadeTrigger from element["+reportElement.elementID+"] to["+targetElementID+"]");
  if(!options) { options = ""; }
  
  var trigger = new Object();
  trigger.element         = reportElement;
  trigger.targetElementID = targetElementID;
  trigger.targetElement   = current_report.elements[targetElementID];;
  trigger.on_trigger      = on_trigger;
  trigger.action_mode     = action_mode;
  trigger.options         = options;

  if(!reportElement.cascade_triggers) { reportElement.cascade_triggers = new Array(); }
  reportElement.cascade_triggers.push(trigger);
  console.log("added cascade trigger: "+on_trigger+" => "+action_mode + " - "+options);
}


function reportsCopyCascadeTrigger(in_trigger) {
  if(!in_trigger) { return null; }
  
  var trigger = new Object();
  trigger.element         = in_trigger.element;
  trigger.targetElementID = in_trigger.targetElementID;
  trigger.targetElement   = in_trigger.targetElement;
  trigger.on_trigger      = in_trigger.on_trigger;
  trigger.action_mode     = in_trigger.action_mode;
  trigger.options         = in_trigger.options;

  return trigger;
}


function reportElementTriggerCascade(reportElement, on_trigger) {
  //Cascade causes reload while Focus usually involves just selecting from within existing data
  if(!reportElement) { return; }
  var elementID = reportElement.elementID;

  var datasource = reportElement;
  if(reportElement.datasourceElementID) {
    datasource = current_report.elements[reportElement.datasourceElementID];
  }
  if(!datasource) { return; }
  console.log("TRIGGER-CASCADE "+on_trigger+" from element["+reportElement.elementID+"] datasource["+datasource.elementID+"]");

  //first check for elements globally which use this reportElement as it's dependant datasource
  for(var depID in current_report.elements) {
    var dependantElement = current_report.elements[depID];
    if(!dependantElement) { continue; }
    if(dependantElement.datasourceElementID == elementID) {
      if(on_trigger == "select") {
        if(datasource.selected_edge) {
          console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection-edge["+datasource.selected_edge.id+"]");
          reportElementEvent(dependantElement.elementID, 'select', datasource.selected_edge.id);
        }
        else if(datasource.selected_feature) {
          console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection-feature["+datasource.selected_feature.id+"]");
          reportElementEvent(dependantElement.elementID, 'select', datasource.selected_feature.id);
        }
        else if(datasource.selected_source) {
          console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection-source["+datasource.selected_source.id+"]");
          reportElementEvent(dependantElement.elementID, 'select', datasource.selected_source.id);
        }
        else if(datasource.selected_id){
          console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"] selection_id["+datasource.selected_id+"]");
          reportElementEvent(dependantElement.elementID, 'select', datasource.selected_id);
        }
      }
      if(on_trigger == "reset") {
        console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"]");
        reportsResetElement(dependantElement.elementID);
        reportsDrawElement(dependantElement.elementID);
      }
      if(on_trigger == "preload") {
        console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"]");
        reportsResetElement(dependantElement.elementID);
        reportsDrawElement(dependantElement.elementID);
      }
      if((on_trigger == "load") || (on_trigger == "postprocess")) {
        console.log("TRIGGER-CASCADE depdenant on["+on_trigger+"] from element["+reportElement.elementID+"] to dependent element["+dependantElement.elementID+"]");
        reportsPostprocessElement(dependantElement.elementID);
        reportsDrawElement(dependantElement.elementID);
      }
    }
  }
  
  //console.log("TRIGGER-CASCADE "+on_trigger+" from element["+reportElement.elementID+"] datasource["+datasource.elementID+"]");
  
  //dependents come from the reportElement not its datasource
  //but selected feature comes from the datasource
  for(var trig_idx=0; trig_idx<reportElement.cascade_triggers.length; trig_idx++){
    var trigger = reportElement.cascade_triggers[trig_idx];
    if(!trigger) { continue; }
    //console.log("trigger "+reportElement.elementID+" ["+trig_idx+"] on["+trigger.on_trigger+"]  action["+trigger.action_mode+" - "+trigger.options+"]");
    if(trigger.on_trigger != on_trigger) { continue; }
    if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
    if(!trigger.targetElement) { continue; }
    
    console.log("TRIGGER-CASCADE from["+reportElement.elementID+"] on["+on_trigger+"] => to["+trigger.targetElement.elementID+"] action["+trigger.action_mode+" - "+trigger.options+"]");

    if(trigger.action_mode == "select") {
      if(trigger.options == "selection_id") {
        if(datasource.selected_feature) { reportElementEvent(trigger.targetElement.elementID, 'select', datasource.selected_feature.id); }
        if(datasource.selected_edge)    { reportElementEvent(trigger.targetElement.elementID, 'select', datasource.selected_edge.id); }
        if(datasource.selected_source)  { reportElementEvent(trigger.targetElement.elementID, 'select', datasource.selected_source.id); }
      }
      
      var datatype = trigger.options;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');

      var t_feature = datasource.selected_feature;
      if(datasource.selected_edge && (/^f1\./.test(trigger.options))) { t_feature = datasource.selected_edge.feature1;}
      if(datasource.selected_edge && (/^f2\./.test(trigger.options))) { t_feature = datasource.selected_edge.feature2;}

      if(t_feature) {
        if(datatype == "id") {
          reportElementEvent(trigger.targetElement.elementID, 'select', t_feature.id);
        }
        else if(datatype == "name") {
          reportElementEvent(trigger.targetElement.elementID, 'select', t_feature.name);
        }
        else if(t_feature.mdata[datatype]) {
          console.log("send mdata ["+t_feature.mdata[datatype]+"]");
          reportElementEvent(trigger.targetElement.elementID, 'select', t_feature.mdata[datatype]);
        }
      }
      //if(trigger.options == "clear") {
      //  trigger.targetElement.focus_feature  = null;
      //}
    }
    
    if((trigger.action_mode == "set_focus") || (trigger.action_mode == "focus_load")) {
      //get the selection from this element/datasource, set it as focus_feature on target
      if(trigger.options == "selection") {
        var selected_feature = datasource.selected_feature;
        if(!selected_feature) { select_feature = datasource.focus_feature; }
        if(selected_feature) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.focus_feature  = datasource.selected_feature;
        }
      }
      if(trigger.options == "selection_f1") {
        if(datasource.selected_edge) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.focus_feature  = datasource.selected_edge.feature1;
        }
      }
      if(trigger.options == "selection_f2") {
        if(datasource.selected_edge) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.focus_feature  = datasource.selected_edge.feature2;
        }
      }
      if(trigger.options == "clear") {
        trigger.targetElement.focus_feature  = null;
      }
    }

    if(trigger.action_mode == "set_filter_features") {
      //get the selection from this element/datasource, set it as focus_feature on target
      if(trigger.options == "clear") {
        trigger.targetElement.filter_feature_ids  = "";
      }
      if(trigger.options == "selection") {
        var selected_feature = datasource.selected_feature;
        if(!selected_feature) { select_feature = datasource.focus_feature; }
        if(selected_feature) {
          //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"] to selection ["+selected_feature.name +"  "+selected_feature.id +"]");
          trigger.targetElement.filter_feature_ids  = selected_feature.id;
        }
      }
      if(trigger.options == "subnetwork") {
        //selection is connected to network, use all features in connected network as load filter for next element load
      }
      if(trigger.options == "all_features") {
        //all_features in element/datasource are used as load filter for next element load
        //console.log("TRIGGER-CASCADE action["+trigger.action_mode+" - "+trigger.options+"] ON ["+trigger.targetElement.elementID+"]");
        var all_feature_ids = "";
        for(var k=0; k<datasource.feature_array.length; k++) {
          var feature = datasource.feature_array[k];
          if(!feature) { continue; }
          if(all_feature_ids != "") { all_feature_ids += ","; }
          all_feature_ids += feature.id;
        }
        console.log("all_feature_ids ["+all_feature_ids+"]");
        trigger.targetElement.filter_feature_ids = all_feature_ids;
      }
    }

    if(trigger.action_mode == "reset") {
      reportsResetElement(trigger.targetElement.elementID);
      reportsDrawElement(trigger.targetElement.elementID); //clear
    }

    if((trigger.action_mode == "load") || (trigger.action_mode == "focus_load")) {
      reportsLoadElement(trigger.targetElement.elementID);
    }
   
    if(trigger.action_mode == "postprocess") {
      reportsPostprocessElement(trigger.targetElement.elementID);
      reportsDrawElement(trigger.targetElement.elementID);
    }
    
  }
}


function reportElementShowSelectedFeature(elementID, select_id) {
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  console.log("reportElementShowSelectedFeature "+elementID+" "+select_id);
  
  if(reportElement.element_type == "table") {
    reportElement.showSelections();
  }
  
  if(reportElement.element_type == "chart") {
    reportElement.showSelections();
    if(reportElement.chart) { reportElement.chart.update(0); }
  }
}


//===============================================================
//
// Events and parameters
//
//===============================================================


function reportElementEvent(elementID, mode, value, value2) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  console.log("reportElementEvent ["+elementID+"] "+mode+" "+value+" "+value2);
  
  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  //
  //select related block
  //
  if((mode == "select" || mode == "select_location") && (value != reportElement.selected_id)) {
    //first process selection_id to find feature, edge, feature1, feature2
    reportElement.selected_id = value;
    reportElement.selected_feature = null;
    reportElement.selected_edge = null;
    reportElement.selected_source = null;
    if(value) {
      var search_val = String(value).toLowerCase();
      if((datasourceElement.datasource_mode == "feature" || reportElement.element_type == "treelist")) {
        if(datasourceElement.features[value]) {
          reportElement.selected_feature = datasourceElement.features[value];
        } else {
          console.log("selection in feature/treelist failed via ID lookup, trying loop mode search_val["+search_val+"]");
          for(var k=0; k<datasourceElement.feature_array.length; k++) {
            var feat1 = datasourceElement.feature_array[k];
            if(!feat1) { continue; }
            //if(!feature.filter_valid) { continue; }
            //if(reportElement.show_search_matches && !feature.search_match) { continue; }
            if((feat1.id == value) || (feat1.name == value)) {
              console.log("found match via id or name");
              reportElement.selected_feature = feat1
              reportElement.selected_id = feat1.id;
              break;
            }
            for(var mdtag in feat1.mdata) { //new common mdata[].array system
              var mdvalue_array = feat1.mdata[mdtag];
              for(var idx1=0; idx1<mdvalue_array.length; idx1++) {
                var mdvalue = mdvalue_array[idx1];
                if(mdvalue && (mdvalue.toLowerCase().indexOf(search_val) >= 0)) {
                  console.log("found match via mdata tag["+mdtag+"] value["+mdvalue+"]");
                  reportElement.selected_feature = feat1
                  reportElement.selected_id = feat1.id;
                  break;
                }
              }
              if(reportElement.selected_feature) { break; }
            }
            if(reportElement.selected_feature) { break; }
          }
        }
        if(reportElement.selected_feature) {
          console.log("selected feature ["+elementID+"] ["+reportElement.selected_feature.name +"  "+reportElement.selected_feature.id +"]");
        }
      }
      if(datasourceElement.datasource_mode == "edge" && datasourceElement.edge_array) {
        if(datasourceElement.selected_edge && datasourceElement.selected_edge.id == value) {
          reportElement.selected_edge = datasourceElement.selected_edge;
          console.log("selected edge transfer from datasource ["+elementID+"] "+reportElement.selected_edge.id +"]");
        } else {
          for(var k=0; k<datasourceElement.edge_array.length; k++) {
            var edge = datasourceElement.edge_array[k];
            if(!edge) { continue; }
            if(!edge.filter_valid) { continue; }
            if(reportElement.focus_feature &&
               (reportElement.focus_feature.id != edge.feature1_id) &&
               (reportElement.focus_feature.id != edge.feature2_id)) { continue; }
            if((edge.id == reportElement.selected_id) || (edge.feature1.id == reportElement.selected_id) || (edge.feature2.id == reportElement.selected_id)) {
              reportElement.selected_edge = edge;
              console.log("found matching edge ["+elementID+"] "+reportElement.selected_edge.id +"]");
              break;
            }
            //TODO: expand the selection methods to the new mdata/name/id loop logic
            /*
            if((edge.id == value) || (edge.name == value)) {
              console.log("found match via edge.id or edge.name");
              reportElement.selected_edge = edge
              reportElement.selected_id = edge.id;
              break;
            }
            //TODO: maybe need to search both f1.mdata and f2.mdata
            for(var mdtag in feat1.mdata) { //new common mdata[].array system
              var mdvalue_array = feat1.mdata[mdtag];
              for(var idx1=0; idx1<mdvalue_array.length; idx1++) {
                var mdvalue = mdvalue_array[idx1];
                if(mdvalue && (mdvalue.toLowerCase().indexOf(search_val) >= 0)) {
                  console.log("found match via mdata tag["+mdtag+"] value["+mdvalue+"]");
                  reportElement.selected_feature = feat1
                  reportElement.selected_id = feat1.id;
                  break;
                }
              }
              if(reportElement.selected_edge) { break; }
            }
             */
            if(reportElement.selected_edge) { break; }
          }
        }
      }
      if(datasourceElement.datasource_mode == "source") {
        console.log("try selected_source lookup ["+value+"]");
        if(datasourceElement.datasources && datasourceElement.datasources[value]) {
          reportElement.selected_source = datasourceElement.datasources[value];
        }
      }
    }  //if(value)
  }
  if(reportElement.selected_edge) { console.log("selected edge ["+elementID+"] "+reportElement.selected_edge.id +"]"); }
  if(reportElement.selected_feature) { console.log("selected feature ["+elementID+"] ["+reportElement.selected_feature.name +" "+reportElement.selected_feature.id +"]"); }
  if(reportElement.selected_source) { console.log("selected source ["+elementID+"] ["+reportElement.selected_source.name +" "+reportElement.selected_source.id +"]"); }

  if(mode == "select") {
    reportElementShowSelectedFeature(elementID, reportElement.selected_id); //highlights the feature/edge in reportElement
    reportElementTriggerCascade(reportElement, "select");
  }
  if(mode == "select_location") {
    console.log("trigger select_location ");
    //console.log("trigger select_location ["+reportElement.selected_feature.name +"  "+reportElement.selected_feature.chromloc +"]");
    //console.log("trigger select_location: " + feature.name + " :: "+feature.chromloc);
    reportElementShowSelectedFeature(elementID, reportElement.selected_id); //highlights the feature in reportElement
    reportElementTriggerCascade(reportElement, "select");
    reportElementTriggerCascade(reportElement, "select_location");
  }
  
  //---------------------------------------------------------------------
  if(mode == "mouseover") {
    reportElement.mouseover_value = value;
  }
  if(mode == "clear") {
    reportElement.mouseover_value = null;
  }

  if(mode == "page-size") {  
    var table_page_index = (reportElement.table_page-1) * reportElement.table_page_size;  //get old index
    reportElement.table_page_size = Math.floor(value);
    if(reportElement.table_page_size < 5) { reportElement.table_page_size = 5; }
    //if(reportElement.table_page_size > 100) { reportElement.table_page_size = 100; }
    var num_pages = Math.ceil(reportElement.filter_count / reportElement.table_page_size);
    reportElement.table_num_pages = num_pages;
    reportElement.table_page = Math.floor(table_page_index / reportElement.table_page_size) + 1;
    //console.log("new page size:"+reportElement.table_page_size+" old index="+table_page_index+"  new page="+reportElement.table_page);
    reportElement.content_height = Math.floor((reportElement.table_page_size * 16.4) + 65);  //For DrawTable
  }
  if(mode == "page") {  
    if(value<1) { value = 1; }
    reportElement.table_page = value;
  }
  if(mode == "previous-page") {  
    reportElement.table_page--;
    if(reportElement.table_page<1) { reportElement.table_page = 1; }
  }
  if(mode == "next-page") {  
    reportElement.table_page++;
    if(reportElement.table_page > reportElement.table_num_pages) { reportElement.table_page = reportElement.table_num_pages; }
  }

  if(mode == "column_sort") {
    if(reportElement.sort_col == value) {
      reportElement.sort_reverse = !reportElement.sort_reverse;
    }
    reportElement.sort_col = value;
  }
  if(mode == "dtype_filter_select") {
    reportElement.dtype_filter_select = value;
  }
  if(mode == "dtype-title") {
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.title = value2; }
    reportElementColumnsInterface(elementID, 'refresh');
  }
  if(mode == "dtype-colnum") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      if(parseInt(value2) < dtype.colnum) { dtype.colnum = parseInt(value2) - 0.5; }
      else { dtype.colnum = parseInt(value2) + 0.5; }
    }
    reportElementColumnsInterface(elementID, 'refresh');
  }
  if(mode == "dtype-visible") {
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.visible = !dtype.visible; }
  }
  if(mode == "dtype-filter") {  
    var dtype = reportElement.datatypes[value];
    if(dtype) { dtype.filtered = !dtype.filtered; }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-add") {
    var dtype = reportElement.datatypes[reportElement.dtype_filter_select];
    if(dtype) { dtype.filtered = true; }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-remove") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      dtype.filtered = false;
      reportElement.dtype_filter_select = dtype.datatype;  //set to that which was just deleted
    }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-abs") {
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      dtype.filter_abs = !dtype.filter_abs;
      if(dtype.filter_abs) {
        console.log(dtype.datatype+" is abs, filter_min currently ["+dtype.filter_min+"]");
        if((dtype.filter_min<0.0) || (dtype.filter_min=="min")) {
          dtype.filter_min = 0.0;
          console.log(dtype.datatype+" is abs so set filter_min to 0.0");
        }
        if(dtype.filter_max<0.0) {
          dtype.filter_max = Math.abs(dtype.filter_max);
        }
      } else {
        if(dtype.filter_min == 0.0) { dtype.filter_min = "min"; }
      }
    }
    reportsPostprocessElement(elementID);
  }
  if(mode == "dtype-filter-min") {
    var val2_float = parseFloat(value2);
    if(isNaN(val2_float)) { value2="min"; }
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      if(dtype.filter_abs && (val2_float<0)) { val2_float = 0.0; }
      if(val2_float > dtype.max_val)    { val2_float = dtype.max_val; }
      if(val2_float <= dtype.min_val)   { value2 = "min"; }
      if((dtype.filter_max!="max") && (val2_float > dtype.filter_max)) { val2_float = dtype.filter_max; }
      if(value2=="min") { dtype.filter_min="min"; } else { dtype.filter_min = val2_float; }
      reportsPostprocessElement(elementID);
    }
  }
  if(mode == "dtype-filter-max") {  
    var val2_float = parseFloat(value2);
    if(isNaN(val2_float)) { value2="max"; }
    var dtype = reportElement.datatypes[value];
    if(dtype) {
      var max_val = dtype.max_val;
      if(dtype.filter_abs && (Math.abs(dtype.min_val)>max_val)) {
        max_val = Math.abs(dtype.min_val);
      }
      if(val2_float < dtype.min_val)    { val2_float = dtype.min_val; }
      if(val2_float >= max_val)         { value2 = "max"; }
      if((dtype.filter_min!="min") && (val2_float < dtype.filter_min)) { val2_float = dtype.filter_min; }
      if(value2=="max") { dtype.filter_max="max"; } else { dtype.filter_max = val2_float; }
      reportsPostprocessElement(elementID);
    }
  }

  if(mode == "dtype-category-filter") {  
    var dtype = reportElement.datatypes[value];
    if(dtype) { 
      if(dtype.categories && dtype.categories[value2]) {
        dtype.categories[value2].filtered = !(dtype.categories[value2].filtered); 
      }
      dtype.filtered = false;
      for(var ctg in dtype.categories) {
        if(dtype.categories[ctg].filtered) {
          dtype.filtered = true;
          break;          
        }
      }
      reportsPostprocessElement(elementID);
    }
  }

  //if(mode == "update-zenbu") {
  //  console.log("update-zenbu");
  //  //a1.setAttribute("onclick", "reportElementEvent(\""+reportElement.elementID+"\", 'update-zenbu', this.value); return false;");
  //}
  
  if(mode == "feature-info") {  
    var feature = reportElement.features[value];
    if(!feature || (reportElement.selected_feature_info == value)) {
      feature = eedbGetObject(value); //uses jscript cache to hold recent objects
    }
    if(feature) {
      console.log("show feature: " + value);
      zenbuDisplayFeatureInfo(feature); 
      reportElement.selected_feature_info = value;
    }
  }
  if(mode == "source-info") {
    var source = eedbGetObject(value); //uses jscript cache to hold recent objects
    if(source) {
      eedbDisplaySourceInfo(source);
    }
  }
  
  if(mode == "main_div_resize_mousedown") {
    if(reportElement.main_div) {
      reportElement.preresize_width  = reportElement.main_div.offsetWidth;
      reportElement.preresize_height = reportElement.main_div.offsetHeight;
      console.log("Element ["+elementID+"] main_div_resize_mousedown width["+reportElement.preresize_width+"] height["+reportElement.preresize_height+"]");
    }
    return true;
  }
  if(mode == "main_div_resize_mouseup") {
    if(reportElement.main_div) {
      var width  = reportElement.main_div.offsetWidth;
      var height = reportElement.main_div.offsetHeight;
      console.log("Element ["+elementID+"] main_div_resize_mouseup width["+width+"] height["+height+"]");
      if((width != reportElement.preresize_width) || (height != reportElement.preresize_height)) {
        console.log("ReportElement ["+elementID+"] was resized!!!");

        reportElement.content_width  = width -14;
        reportElement.content_height = height - 14;;
        //reportsDrawTargetDEgenesTable(reportElement);
        console.log("Element resized ["+elementID+"] main_div width["+reportElement.content_width+"] height["+reportElement.content_height+"]");

        if(reportElement.element_type == "chart") { reportElement.chart = null; }

        reportElement.resized = true;
        reportsDrawElement(elementID);
        reportElement.resized = false;
        
        var layoutElement = current_report.elements[reportElement.layout_parentID];
        if(layoutElement) { reportsUpdateLayoutHierarchy(layoutElement); }
      }
      if(reportElement.is_moving) { reportElementToggleLayoutDrag(reportElement, "stop"); }
    }
    return true;
  }
  
  if(mode == "start_element_drag") {
    reportElementToggleLayoutDrag(reportElement, "start");
    return true;
  }
  if(mode == "stop_element_drag") {
    reportElementToggleLayoutDrag(reportElement, "stop");
    return true;
  }

  reportsDrawElement(elementID);
}


function reportElementReconfigParam(elementID, param, value, altvalue) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  console.log("reportElementReconfigParam["+elementID+"] "+param+" value="+value+"  altvalue="+altvalue);

  if(param == "delete-element") {
    var master_div = document.getElementById("zenbuReportsDiv");
    if(reportElement.auxdiv) { master_div.removeChild(reportElement.auxdiv); }
    delete current_report.elements[elementID];
    master_div.appendChild(reportElement.main_div);  //make sure it is moved to the master_div
    master_div.removeChild(reportElement.main_div);  //then remove
    var layoutElement = current_report.elements[reportElement.layout_parentID];
    if(layoutElement) { reportsUpdateLayoutHierarchy(layoutElement); }//rebuilds and does not include
    return;
  }
  if(param == "delete-layout") {
    eedbClearSearchTooltip();
    var master_div = document.getElementById("zenbuReportsDiv");
    if(reportElement.auxdiv) { master_div.removeChild(reportElement.auxdiv); }
    
    //disconnect children from layout and move to master_div
    reportElement.layout_type = "disconnect";
    reportsUpdateElementLayout(reportElement);

    delete current_report.elements[elementID];
    master_div.appendChild(reportElement.main_div);  //make sure it is moved to the master_div
    master_div.removeChild(reportElement.main_div);  //then remove
    reportsUpdateLayoutElements(); //refresh global layout hierarchy
    return;
  }
  if(param == "reattach-layout") {
    console.log("reattach-layout");
    eedbClearSearchTooltip();
    reportElement.layout_mode = "root";
    reportElement.layout_parentID = null;
    reportsUpdateElementLayout(reportElement);
    return;
  }

  if(param == "content_width") {
    reportElement.content_width = parseInt(value);
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportElement.resized = true;
    reportsDrawElement(elementID);
    reportElement.resized = false;
    reportsUpdateLayoutHierarchy(reportElement);
    return;
  }
  if(param == "content_height") {
    reportElement.content_height = parseInt(value);
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportElement.resized = true;
    reportsDrawElement(elementID);
    reportElement.resized = false;
    reportsUpdateLayoutHierarchy(reportElement);
    return;
  }

  if(reportElement.newconfig === undefined) {
    reportElement.newconfig = new Object;
  }
  var newconfig = reportElement.newconfig;

  //general
  if(param == "title") {
    if(!value) { value = ""; }
    newconfig.title_prefix = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    return;
  }
  if(param == "description") {  newconfig.description = value; return; }
  if(param == "backColor") {
    if(!value) { value = "#F6F6F6"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    newconfig.backColor = value;
  }

  if(param == "widget_filter") {
    if(newconfig.widget_filter === undefined) { newconfig.widget_filter = reportElement.widget_filter; }
    newconfig.widget_filter = !newconfig.widget_filter;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "widget_search") {
    if(newconfig.widget_search === undefined) { newconfig.widget_search = reportElement.widget_search; }
    newconfig.widget_search = !newconfig.widget_search;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "show_titlebar") {
    if(newconfig.show_titlebar === undefined) { newconfig.show_titlebar = reportElement.show_titlebar; }
    newconfig.show_titlebar = !newconfig.show_titlebar;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "border_type") {
    newconfig.border = value;
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportsDrawElement(elementID);
    return;
  }
  if(param == "display_type") {
    newconfig.display_type = value;
  }

  //search_data system
  if(param == "search_data_filter") { reportElement.search_data_filter = value; return; }
  if(param == "search_data_filter_search") {
    reportElementSearchData(reportElement.elementID); //resets the search_match flag and performs refresh on panel
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    //if(reportElement.element_type == "table") { reportsPostprocessTable(reportElement); } //to readjust the filter_count
    reportsPostprocessElement(reportElement.elementID); //to readjust the filter_count and cascade to dependant elements
    reportsDrawElement(elementID);
    return;
  }
  if(param == "search_data_filter_clear") {
    reportElement.search_data_filter = "";
    reportElement.show_search_matches = false;
    reportElementSearchData(reportElement.elementID); //resets the search_match flag and performs refresh on panel
    reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    //if(reportElement.element_type == "table") { reportsPostprocessTable(reportElement); } //to readjust the filter_count
    reportsPostprocessElement(reportElement.elementID); //to readjust the filter_count and cascade to dependant elements
    reportsDrawElement(elementID);
    return;
  }
  if(param == "show_search_matches") {
    reportElement.show_search_matches = !reportElement.show_search_matches;
    //reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    reportElementToggleSubpanel(elementID, 'none'); //hide panel
    //if(reportElement.element_type == "table") { reportsPostprocessTable(reportElement); } //to readjust the filter_count
    reportsPostprocessElement(reportElement.elementID); //to readjust the filter_count and cascade to dependant elements
    reportsDrawElement(elementID);
    //reportElementTriggerCascade(reportElement, "postprocess");
    return;
  }


  //datasource
  if(param == "datasource_mode") {  newconfig.datasource_mode = value; }
  if(param == "edit_datasource_query") {  newconfig.edit_datasource_query = true; }
  if(param == "query_filter") {
    if(!value) { value = ""; }
    newconfig.query_filter = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    return;
  }
  if(param == "query_edge_search_depth") { newconfig.query_edge_search_depth = value; }
  
  if(param == "datasourceElementID") {
    if(!value) { value = ""; }
    newconfig.datasourceElementID = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    return;
  }
  if(param == "load_on_page_init") {  newconfig.load_on_page_init = value; }
  
  //cascade-trigger configuration
  if(param == "edit_cascade_triggers") {
    newconfig.edit_cascade_triggers = true;
    newconfig.cascade_triggers = new Array();
    for(var trig_idx=0; trig_idx<reportElement.cascade_triggers.length; trig_idx++){
      var trigger = reportElement.cascade_triggers[trig_idx];
      if(!trigger) { continue; }
      if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
      if(!trigger.targetElement) { continue; }
      var t_trigger = reportsCopyCascadeTrigger(trigger);
      if(t_trigger) { newconfig.cascade_triggers.push(t_trigger); }
    }
  }
  if(param == "add_cascade_trigger") {
    console.log("add_cascade_trigger "+reportElement.elementID);
    var trigger = new Object();
    trigger.element         = reportElement;
    trigger.targetElementID = "";
    trigger.targetElement   = null;
    trigger.on_trigger      = "select";
    trigger.action_mode     = "select";
    trigger.options         = "";
    newconfig.cascade_triggers.push(trigger);
  }
  if(param == "delete_cascade_trigger") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      newconfig.cascade_triggers.splice(idx, 1);
    }
  }
  if(param == "copy_cascade_trigger") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var t_trigger = reportsCopyCascadeTrigger(newconfig.cascade_triggers[idx]);
      if(t_trigger) {
        newconfig.cascade_triggers.splice(idx, 0, t_trigger);
      }
    }
  }
  if(param == "trigger_on_trigger") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) { trigger.on_trigger = altvalue; }
    }
  }
  if(param == "trigger_action_mode") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) {
        trigger.action_mode = altvalue;
        if((altvalue == "set_focus") || (altvalue == "focus_load") || (altvalue == "set_filter_features")) {
          trigger.options = "selection";
        } else { trigger.options = ""; }
      }
    }
  }
  if(param == "trigger_options") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) { trigger.options = altvalue; }
    }
  }
  if(param == "trigger_targetID") {
    var idx = parseInt(value);
    if(idx > -1 && idx < newconfig.cascade_triggers.length) {
      var trigger = newconfig.cascade_triggers[idx];
      if(trigger) {
        trigger.targetElementID = altvalue;
        trigger.targetElement = current_report.elements[trigger.targetElementID];
      }
    }
  }

  //colorspace
  if(param == "colorspace") {
    newconfig.colorspace = value;
  }
  if(param == "colorspace_discrete") {
    newconfig.colorMode = "signal";
    newconfig.colorspace_discrete = value;
  }
  if(param == "colorspace_category") {
    newconfig.colorspace_category = value;
    if(value == "brewer-sequential") {
      newconfig.colorspace = "BuGn_bp_7";
    }
    if(value == "brewer-diverging") {
      newconfig.colorspace = "BrBG_bp_7";
    }
    if(value == "brewer-qualitative") {
      newconfig.colorspace = "Set3_bp_9";
    }
    if(value == "zenbu-spectrum") {
      newconfig.colorspace = "fire1";
    }
    var colorspec = zenbuColorSpaces[newconfig.colorspace];
    newconfig.colorspace_discrete = colorspec.discrete;
  }
  if(param == "colorspace_depth") {
    //modify the color
    var csname = newconfig.colorspace;
    if(!csname) {
      csname = reportElement.colorspace;
      newconfig.colorspace = csname;
    }
    var colorspec = zenbuColorSpaces[csname];
    var idx1 = csname.indexOf('_bp_');
    if(idx1 > 0) {
      csname = csname.substr(0, idx1+4);
      csname += value
      if(zenbuColorSpaces[csname]) { newconfig.colorspace = csname; }
      else {
        for(var cn in zenbuColorSpaces){
          var cspc2 = zenbuColorSpaces[cn];
          if(cspc2.colorcat != colorspec.colorcat) { continue; }
          if(cspc2.bpdepth != value) { continue; }
          newconfig.colorspace = cn;
          break;
        }
      }
    }
    var colorspec = zenbuColorSpaces[newconfig.colorspace];
    newconfig.colorspace_discrete = colorspec.discrete;
  }
  //if(param == "colorspace_logscale") {
  //  if(value) { newconfig.colorspace_logscale=1; }
  //  else { newconfig.colorspace_logscale = 0; }
  //}

  
  //treelist params
  if(param == "move_selection_to_top") {  newconfig.move_selection_to_top = value; }

  //charts
  if(param == "symetric_axis") {  newconfig.symetric_axis = value; }
  if(param == "dual_feature_axis") {
    if(value == "dual") { newconfig.dual_feature_axis = true; }
    else { newconfig.dual_feature_axis = false; }
  }
  if(param == "xaxis_fixedscale") {  newconfig.xaxis_fixedscale = value; if(!value) { newconfig.xaxis_symetric=false; } }
  if(param == "yaxis_fixedscale") {  newconfig.yaxis_fixedscale = value; if(!value) { newconfig.yaxis_symetric=false; } }
  if(param == "xaxis_symetric")   {  newconfig.xaxis_symetric = value; if(value) { newconfig.xaxis_fixedscale=true; } }
  if(param == "yaxis_symetric")   {  newconfig.yaxis_symetric = value; if(value) { newconfig.yaxis_fixedscale=true; } }
  if(param == "xaxis_log")        {  newconfig.xaxis_log = value; }
  if(param == "yaxis_log")        {  newconfig.yaxis_log = value; }
  if(param == "xaxis_datatype")   {  newconfig.xaxis_datatype = value; }
  if(param == "yaxis_datatype")   {  newconfig.yaxis_datatype = value; }

  //zenbuGB
  if(param == "zenbu_url") { newconfig.zenbu_url = value; return; }
  if(param == "zenbu_view_config") { newconfig.view_config = value; return;}

  //html
  if(param == "html_content") {
    if(newconfig.html_content === undefined) { newconfig.html_content = reportElement.html_content; }
    newconfig.html_content = value;
    //reportElementToggleSubpanel(elementID, 'refresh'); //refresh
    //reportsDrawElement(elementID);
    return;
  }

  //category
  if(param == "category_datatype") { newconfig.category_datatype = value; }
  if(param == "display_type") { newconfig.display_type = value; }
  if(param == "hide_zero") { newconfig.hide_zero = value; }

  //accept/reset
  if(param == "cancel-reconfig") {
    reportElement.newconfig = undefined;
    reportElementToggleSubpanel(elementID, 'refresh');
    reportsDrawElement(elementID);
    return;
  }

  if(param == "accept-reconfig") {
    var needReload=0;
    if(reportElement.newconfig) {
      var newconfig = reportElement.newconfig;
      if(newconfig.widget_filter !== undefined) { reportElement.widget_filter = newconfig.widget_filter; }
      if(newconfig.widget_search !== undefined) { reportElement.widget_search = newconfig.widget_search; }
      if(newconfig.show_titlebar !== undefined) { reportElement.show_titlebar = newconfig.show_titlebar; }
      if(newconfig.border !== undefined) { reportElement.border = newconfig.border; }
      
      if(newconfig.datasource_mode !== undefined) {
        reportElement.datasource_mode = newconfig.datasource_mode; needReload=1;
        if((reportElement.datasource_mode == "source") && current_collaboration) {
          reportElement.collaboration_filter = current_collaboration.uuid;
        }
      }
      if(newconfig.source_ids !== undefined) { reportElement.source_ids = newconfig.source_ids; needReload=1; }
      if(newconfig.query_filter !== undefined) { reportElement.query_filter = newconfig.query_filter; needReload=1; }
      if(newconfig.collaboration_filter !== undefined) { reportElement.collaboration_filter = newconfig.collaboration_filter; needReload=1; }
      if(newconfig.query_edge_search_depth !== undefined) { reportElement.query_edge_search_depth = newconfig.query_edge_search_depth; needReload=1; }
      if(newconfig.datasourceElementID !== undefined) { reportElement.datasourceElementID = newconfig.datasourceElementID; needReload=1;}
      if(newconfig.load_on_page_init !== undefined) {
        reportElement.load_on_page_init = newconfig.load_on_page_init;
        if(reportElement.load_on_page_init) { needReload=1; }
      }
      
      if(newconfig.cascade_triggers) {
        reportElement.cascade_triggers = newconfig.cascade_triggers;
        needReload=1;
      }
      
      if(newconfig.title_prefix !== undefined) {
        reportElement.title        = newconfig.title_prefix;
        reportElement.title_prefix = newconfig.title_prefix;
      }
      reportElement.title=reportElement.title_prefix;

      if(newconfig.symetric_axis !== undefined) { reportElement.symetric_axis = newconfig.symetric_axis; }
      if(newconfig.dual_feature_axis !== undefined) { reportElement.dual_feature_axis = newconfig.dual_feature_axis; }

      if(newconfig.xaxis_fixedscale !== undefined) { reportElement.xaxis.fixedscale = newconfig.xaxis_fixedscale; reportElement.chart=null; }
      if(newconfig.yaxis_fixedscale !== undefined) { reportElement.yaxis.fixedscale = newconfig.yaxis_fixedscale; reportElement.chart=null; }
      if(newconfig.xaxis_symetric !== undefined)   { reportElement.xaxis.symetric = newconfig.xaxis_symetric; reportElement.chart=null; }
      if(newconfig.yaxis_symetric !== undefined)   { reportElement.yaxis.symetric = newconfig.yaxis_symetric; reportElement.chart=null; }
      if(newconfig.xaxis_log !== undefined)        { reportElement.xaxis.log = newconfig.xaxis_log; reportElement.chart=null; }
      if(newconfig.yaxis_log !== undefined)        { reportElement.yaxis.log = newconfig.yaxis_log; reportElement.chart=null; }
      if(newconfig.xaxis_datatype !== undefined)   { reportElement.xaxis.datatype = newconfig.xaxis_datatype; }
      if(newconfig.yaxis_datatype !== undefined)   { reportElement.yaxis.datatype = newconfig.yaxis_datatype; }

      if(newconfig.zenbu_url !== undefined)     { reportElement.zenbu_url = newconfig.zenbu_url; }
      if(newconfig.view_config !== undefined)   { reportElement.view_config = newconfig.view_config; }

      if(newconfig.html_content !== undefined)   { reportElement.html_content = newconfig.html_content; }

      if(newconfig.category_datatype !== undefined)   { reportElement.category_datatype = newconfig.category_datatype; }
      if(newconfig.display_type !== undefined)        { reportElement.display_type = newconfig.display_type; }
      if(newconfig.hide_zero !== undefined)           { reportElement.hide_zero = newconfig.hide_zero; }
      
      if(newconfig.display_type !== undefined)        { reportElement.display_type = newconfig.display_type; }
      if(newconfig.colorspace !== undefined)          { reportElement.colorspace = newconfig.colorspace; }
      //if(newconfig.colorspace_logscale !== undefined) { reportElement.colorspace_logscale = newconfig.colorspace; }

      if(newconfig.move_selection_to_top !== undefined) { reportElement.move_selection_to_top = newconfig.move_selection_to_top; }
    }

    //check if anything changed
    //var new_atr_count = 0;
    //for(e in reportElement.newconfig) { new_atr_count++; }
    //if(reportElement.uuid && (new_atr_count > 0)) {
    //  //something changed so shared tracj uuid nolonger valid
    //  reportElement.parent_uuid = reportElement.uuid;
    //  reportElement.uuid = undefined
    //}
    reportElement.newconfig = undefined;

    /*
    if(!reportElement.has_subfeatures && (reportElement.glyphStyle=='transcript' || reportElement.glyphStyle=='probesetloc' ||
                                       reportElement.glyphStyle=='thin-transcript' || reportElement.glyphStyle=='thick-transcript')) {
      needReload = 1;
    }

    if(needReload == 1) { reportElement.uuid = undefined; }
    if(needReload >=1) {
      //reportElement.experiments = undefined;
      if(reportElement.trackDiv) {
        var reconfig_div = document.getElementById(trackID+"_reconfigure_divframe");
        if(reconfig_div) { reportElement.trackDiv.removeChild(reconfig_div); }
      }
      gLyphsShowTrackLoading(trackID);
      prepareTrackXHR(trackID);
    } else {
      //recalculate the data transforms and then redraw
      gLyphsRenderTrack(reportElement);
      gLyphsDrawTrack(trackID);
    }
    gLyphsInitSearchFromTracks();
    gLyphsAutosaveConfig();
    */
    
    if(needReload) {
      console.log("accept-reconfig reload");
      reportsLoadElement(elementID);
    } else {
      console.log("accept-reconfig postprocess");
      //reportsResetElement(elementID);
      reportsPostprocessElement(elementID);
    }
    reportsDrawElement(elementID);
    reportElementToggleSubpanel(elementID, 'none'); //close
    return;
  }

  reportElementToggleSubpanel(elementID, 'refresh'); //refresh
}


//==========================================================================================
//
// Subpanel and configuration interface section
//
//==========================================================================================


function reportElementToggleSubpanel(elementID, mode) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.main_div) { return; }
  if(!mode) { return; }
  eedbClearSearchTooltip();
  //console.log("reportElementToggleSubpanel "+ elementID +" "+mode + " "+reportElement.element_type);

  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  if(reportElement.main_div) {
    var mainRect = reportElement.main_div.getBoundingClientRect();
    //console.log("main_div "+reportElement.main_div_id+" rect x:"+mainRect.x+" y:"+mainRect.y+" left:"+mainRect.left+" top:"+mainRect.top);
    //auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left+window.scrollX)+"px; top:"+(mainRect.top+window.scrollY+10)+"px; width:"+auxwidth+"px;");
    auxdiv.style.left = (mainRect.left+window.scrollX)+"px";
    auxdiv.style.top  = (mainRect.top+window.scrollY+10)+"px";
  }
  
  //search interface panel is generic for all elements
  var searchDiv = reportElementSearchSubpanel(reportElement);

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var filterDiv, configDiv
  //filter system is based on the datasource
  if(datasourceElement.element_type == "table") {
    //console.log("datasource is a table");
    filterDiv = reportsTableFilterSubpanel(reportElement);
  }

  //config is based on each element type
  configDiv = reportElementConfigSubpanel(reportElement);
  
  //var groupingdiv = gLyphsExpressionPanelGroupingSubpanel();
  //if(!groupingdiv) { return; }

  if(mode == reportElement.subpanel_mode) { mode = "none"; }
  if(mode == "refresh") { mode = reportElement.subpanel_mode; }
  reportElement.subpanel_mode = mode;  

  //groupingdiv.style.display = "none";
  if(searchDiv) { searchDiv.style.display = "none"; }
  if(configDiv) { configDiv.style.display   = "none"; }
  if(filterDiv) { filterDiv.style.display   = "none"; }

  //if(mode == "group")   { groupingdiv.style.display = "block"; }
  if(searchDiv && (mode == "search"))  { searchDiv.style.display = "block"; } 
  if(configDiv && (mode == "config"))  { configDiv.style.display = "block"; }
  if(filterDiv && (mode == "filter"))  { filterDiv.style.display = "block"; }
  //TODO: maybe need the auxdiv resize logic here depending on the state
}


function reportElementCreateSearchWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'search');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"search\",50);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle1.setAttributeNS(null, 'cx', '5px');
  circle1.setAttributeNS(null, 'cy', '5px');
  circle1.setAttributeNS(null, "r","5px");
  circle1.setAttributeNS(null, "stroke", 'gray');
  circle1.setAttributeNS(null, "stroke-width", '2');
  //circle1.setAttributeNS(null, 'fill', '#E7E7E7');
  circle1.setAttributeNS(null, 'fill', 'white');

  var line1 = g1.appendChild(document.createElementNS(svgNS,'line'));
  line1.setAttributeNS(null, 'x1', '10px');
  line1.setAttributeNS(null, 'y1', '10px');
  line1.setAttributeNS(null, 'x2', '13px');
  line1.setAttributeNS(null, 'y2', '13px');
  line1.setAttributeNS(null, "stroke", 'gray');
  line1.setAttributeNS(null, "stroke-width", '3');
  line1.setAttributeNS(null, "stroke-linecap", 'round');

  return g1;
}


function reportElementCreateFilterWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'filter');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"filter\",60);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var backg = g1.appendChild(document.createElementNS(svgNS,'rect'));
  backg.setAttributeNS(null, 'x', '0px');
  backg.setAttributeNS(null, 'y', '0px');
  backg.setAttributeNS(null, 'width',  "18px");
  backg.setAttributeNS(null, 'height', "16px");
  //backg.setAttributeNS(null, 'fill', '#E7E7E7');  //titlebar color
  //backg.setAttributeNS(null, 'fill', 'rgb(245,245,250)');
  backg.setAttributeNS(null, 'fill', 'rgb(255,255,255)');

  /*
  //funnel
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray');
  path.setAttributeNS(null, 'fill', '#E7E7E7');
  var points = "M1,3 A3,3 0 0,1 1,0 L15,0 A3,3 0 0,1 15,3 L10,8 L10,14 L6,16 L6,8 Z";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);
  */
  
  /*
  // lines in/out dots for filter
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: gray');
  path.setAttributeNS(null, 'fill', '#E7E7E7');
  //var points = "M1,3 A3,3 0 0,1 1,0 L15,0 A3,3 0 0,1 15,3 L10,8 L10,14 L6,16 L6,8 Z";
  var points = "M1,0 L1,5 M5.5,0 L5.5,5 M10.5,0 L10.5,5 M15,0 L15,5 M5,11 L5,16 M11,11 L11,16";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);

  for(var i=0; i<3; i++) {
    var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
    circle1.setAttributeNS(null, 'cx', (2+i*6) + 'px');
    circle1.setAttributeNS(null, 'cy', '8px');
    circle1.setAttributeNS(null, "r","2px");
    circle1.setAttributeNS(null, "stroke", 'gray');
    circle1.setAttributeNS(null, "stroke-width", '1');
    circle1.setAttributeNS(null, "fill", 'gray');
  }
  */
  
  //dots in/out  wiggle for filter
  for(var i=0; i<3; i++) {
    var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
    circle1.setAttributeNS(null, 'cx', (3+i*6) + 'px');
    circle1.setAttributeNS(null, 'cy', '3px');
    circle1.setAttributeNS(null, "r","2px");
    circle1.setAttributeNS(null, "stroke", 'gray');
    circle1.setAttributeNS(null, "stroke-width", '1');
    circle1.setAttributeNS(null, "fill", 'gray');
  }

  var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle1.setAttributeNS(null, 'cx', '9px');
  circle1.setAttributeNS(null, 'cy', '13px');
  circle1.setAttributeNS(null, "r","2px");
  circle1.setAttributeNS(null, "stroke", 'gray');
  circle1.setAttributeNS(null, "stroke-width", '1');
  circle1.setAttributeNS(null, "fill", 'gray');

  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray');
  path.setAttributeNS(null, 'fill', '#E7E7E7');
  var points = "M0,7 L3,9 L6,7 L9,9 L12,7 L15,9 L18,7 ";
  path.setAttributeNS(null, 'd', points);
  g1.appendChild(path);
  
  return g1;
}


function reportElementCreateConfigWidget(reportElement) {
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "onmousedown", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'config');");
  g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"configure\",80);");
  g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");

  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);

  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'style', 'stroke-width: 1px; stroke: gray');
  line.setAttributeNS(null, 'fill', '#E7E7E7');
  var points = '';
  for(var ang=0; ang<=28; ang++) {
    var radius = 8;
    if(ang % 4 == 0) { radius = 8; }
    if(ang % 4 == 1) { radius = 8; }
    if(ang % 4 == 2) { radius = 5.5; }
    if(ang % 4 == 3) { radius = 5.5; }
    var x = Math.cos(ang*2*Math.PI/28.0) *radius + 10;
    var y = Math.sin(ang*2*Math.PI/28.0) *radius + 10;
    points = points + x + "," + y + " ";
  }
  line.setAttributeNS(null, 'points', points);
  g1.appendChild(line);

  var circle1 = g1.appendChild(document.createElementNS(svgNS,'circle'));
  circle1.setAttributeNS(null, 'cx', '10px');
  circle1.setAttributeNS(null, 'cy', '10px');
  circle1.setAttributeNS(null, "r","3px");
  circle1.setAttributeNS(null, "stroke", 'gray');
  circle1.setAttributeNS(null, "stroke-width", '1px');
  circle1.setAttributeNS(null, 'fill', '#E7E7E7');
  //circle1.setAttributeNS(null, 'fill', 'none');


  return g1;
}


function reportElementSearchSubpanel(reportElement) {
  if(!reportElement) { return; }
  if(reportElement.element_type == "layout") { return; }

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }

  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  //console.log("reportElementSearchSubpanel");
  
  //var width = parseInt(main_div.clientWidth);
  //width = width - 10;
  //if(width>350) { width=350;}
  //width=350;

  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  //console.log("reportElementSearchSubpanel aux ok");

  var subID = reportElement.main_div_id + "_search_subpanel";
  var searchdiv = document.getElementById(subID);
  if(!searchdiv) {
    searchdiv = document.createElement('div');
    //auxdiv.insertBefore(searchdiv, auxdiv.firstChild);
    auxdiv.appendChild(searchdiv);
    searchdiv.id = subID;
    searchdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                             "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                             //"width:"+(width-30)+"px; display:none; opacity: 0.95; " +
                             "width:350px; display:none; opacity: 0.98; " +
                             "position:absolute; top:20px; right:10px;"
                             );
  }
  //clearKids(searchdiv);
  searchdiv.innerHTML = "";
  var mainRect = main_div.getBoundingClientRect();
  var auxRect = auxdiv.getBoundingClientRect();
  console.log("search panel auxdiv.width="+auxRect.width+"  maindiv.width="+mainRect.width);
  if(auxRect.width>mainRect.width) { searchdiv.style.left = "5px"; searchdiv.style.right = ""; }
  else { searchdiv.style.right = "10px"; searchdiv.style.left = ""; }

  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;

  //close button
  tdiv = searchdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onmousedown", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");

  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  //subpanel title
  tdiv = searchdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "search";

  searchdiv.appendChild(document.createElement('hr'));

  //var form1 = searchdiv.appendChild(document.createElement('form'));
  //form1.setAttribute("onsubmit", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");
  //tdiv = form1.appendChild(document.createElement('div'));
  //var expInput = tdiv.appendChild(document.createElement('input'));
  //expInput.setAttribute('style', "width:"+(width-100)+"px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //expInput.setAttribute('style', "width:270px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //expInput.id = "expExp_search_inputID";
  //expInput.setAttribute('type', "text");
  //if(glyphTrack && glyphTrack.expfilter) {
  //  expInput.setAttribute('value', glyphTrack.expfilter);
  //}
  
  //search_data_filter
  var div1 = searchdiv.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  //var span0 = div1.appendChild(document.createElement('span'));
  //span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  //span0.innerHTML = "results filter:";
  var filter = datasourceElement.search_data_filter;
  //if(reportElement.newconfig && reportElement.newconfig.search_data_filter != undefined) { filter = reportElement.newconfig.search_data_filter; }
  if(!filter) { filter = ""; }
  var filterInput = div1.appendChild(document.createElement('input'));
  //filterInput.setAttribute('style', "width:270px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  filterInput.setAttribute('style', "width:235px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  filterInput.setAttribute('type', "text");
  filterInput.setAttribute('value', filter);
  filterInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");
  filterInput.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");
  filterInput.setAttribute("onblur", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");

  search_button = div1.appendChild(document.createElement("button"));
  search_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  search_button.setAttribute("onclick", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter_search');");
  search_button.innerHTML = "search";

  clear_button = div1.appendChild(document.createElement("button"));
  clear_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:3px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"clear filters\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  clear_button.setAttribute("onclick", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter_clear');");
  clear_button.innerHTML = "clear";

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  var source_count  = 0;
  if(datasourceElement.datasource_mode=="source")  { source_count = datasourceElement.sources_array.length; }

  tdiv = searchdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "font-size:10px; margin-left:5px; margin-left:40px;");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "searchable data";
  if(feature_count==0 && edge_count==0 && source_count==0) {
    tspan.innerHTML = "no data to search";
    search_button.setAttribute('disabled', "disabled");
  }
  if(feature_count>0) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML = "  features:<i>"+ feature_count+ "</i>";
  }
  if(edge_count>0) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML += "  edges:<i>"+ edge_count+"</i>";
  }
  if(source_count>0) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML += "  sources:<i>"+ source_count+"</i>";
  }

  //results display
  /*
  var feature_matches=0;
  for(var k=0; k<feature_count; k++) {
    var feature = datasourceElement.feature_array[k];
    if(!feature) { continue; }
    if(feature.search_match) { feature_matches++; }
  }
  var edge_matches=0;
  for(var k=0; k<datasourceElement.edge_array.length; k++) {
    var edge = datasourceElement.edge_array[k];
    if(!edge) { continue; }
    if(!edge.filter_valid) { continue; }
    if(edge.search_match) { edge_matches++; }
  }
  if(reportElement.datasource_mode == "edge" && edge_matches==0) { feature_matches=0; }
  */

  var feature_matches = datasourceElement.search_match_feature_count;
  var edge_matches    = datasourceElement.search_match_edge_count;
  var source_matches  = datasourceElement.search_match_source_count;

  if(feature_matches>0 || edge_matches>0 || source_matches>0) {
    tdiv = searchdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:12px; margin-left:10px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "color:#0000D0;"); //0071EC
    tspan.innerHTML = "found matching";
    
    //if(reportElement.datasource_mode == "feature") { }
  
    if(feature_matches>0) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "padding-left:5px;");
      tspan.innerHTML = "features:<i>"+ feature_matches+ "</i>";
    }
    if(edge_matches>0) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "padding-left:5px;");
      tspan.innerHTML += "edges:<i>"+ edge_matches+"</i>";
    }
    if(source_matches>0) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute("style", "padding-left:5px;");
      tspan.innerHTML += "sources:<i>"+ source_matches+"</i>";
    }

    showsearch_button = tdiv.appendChild(document.createElement("button"));
    showsearch_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:10px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    showsearch_button.setAttribute("onclick", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'show_search_matches');");
    if(datasourceElement.show_search_matches) { showsearch_button.innerHTML = "normal view"; }
    else { showsearch_button.innerHTML = "show matches"; }
  }
  if(filter!="" && feature_matches==0 && edge_matches==0 && source_matches==0) {
    tdiv = searchdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:12px; margin-left:10px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML = "no matches found";
  }
  
  return searchdiv;
}


function reportElementConfigSubpanel(reportElement) {
  //generic configuration panel with redirect to specific types for specifics
  if(!reportElement) { return; }
  
  var main_div = reportElement.main_div;
  if(!main_div) { return; }
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+reportElement.datasourceElementID+"]"); }
  }
  
  var cfgID = reportElement.main_div_id + "_config_subpanel";
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
  if(reportElement.newconfig && (reportElement.newconfig.edit_datasource_query || reportElement.newconfig.edit_cascade_triggers)) {
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
  a1.setAttribute("onclick", "reportElementToggleSubpanel('"+reportElement.elementID+"', 'none'); return false;");
  
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = configdiv.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight:bold;");
  if(reportElement.element_type == "treelist") { tspan.innerHTML = "tree-list configuration: "; }
  if(reportElement.element_type == "table")    { tspan.innerHTML = "table configuration: "; }
  if(reportElement.element_type == "chart")    { tspan.innerHTML = "chart configuration: "; }
  if(reportElement.element_type == "zenbugb")  { tspan.innerHTML = "zenbuGB configuration: "; }
  if(reportElement.element_type == "html")     { tspan.innerHTML = "html configuration: "; }
  tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.setAttribute('style', "font-size:10px; color:blue; padding-left:5px; font-style:italic;");
  tspan.setAttribute('style', "font-size:10px; color:blue; padding-left:5px;");
  tspan.innerHTML = reportElement.elementID;
  
  if(reportElement.element_type != "category") {
    var title_prefix = reportElement.title_prefix;
    if(reportElement.newconfig && reportElement.newconfig.title_prefix != undefined) { title_prefix = reportElement.newconfig.title_prefix; }
    var div1 = configdiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "title:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id =  reportElement.elementID + "_config_title";
    titleInput.setAttribute('style', "width:80%; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', title_prefix);
    titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
  }

  var sourcesDiv = reportElementBuildSourcesInterface(reportElement);
  
  var cascadesDiv = reportElementCascadeTriggersInterface(reportElement);
  
  //-------  type specific section -------------
  reportElement.config_options_div = configdiv.appendChild(document.createElement('div'));
  if(reportElement.element_type == "treelist") {
    reportsTreeListConfigSubpanel(reportElement);
  }
  if(reportElement.element_type == "table") {
    reportsTableConfigSubpanel(reportElement);
  }
  if(reportElement.element_type == "chart") {
    reportsChartConfigSubpanel(reportElement);
  }
  if(reportElement.element_type == "zenbugb") {
    reportsZenbuGBConfigSubpanel(reportElement);
  }
  if(reportElement.element_type == "html") {
    reportsHtmlElementConfigSubpanel(reportElement);
  }
  if(reportElement.element_type == "category") {
    reportsCategoryElementConfigSubpanel(reportElement);
  }

  //---------- widget controls ------------------
  //configdiv.appendChild(document.createElement('hr'));
  tdiv2  = configdiv.appendChild(document.createElement('div'));

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.show_titlebar;
  if(reportElement.newconfig && reportElement.newconfig.show_titlebar != undefined) { val1 = reportElement.newconfig.show_titlebar; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'show_titlebar', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "title bar";
  if(reportElement.element_type=="category") { tcheck.setAttribute('checked', "checked"); tcheck.setAttribute('disabled', "disabled"); }

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.widget_search;
  if(reportElement.newconfig && reportElement.newconfig.widget_search != undefined) { val1 = reportElement.newconfig.widget_search; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'widget_search', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "search widget";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = reportElement.widget_filter;
  if(reportElement.newconfig && reportElement.newconfig.widget_filter != undefined) { val1 = reportElement.newconfig.widget_filter; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'widget_filter', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "filter widget";

  //border options
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 15px;");
  span1.innerHTML = "border: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'border_type', this.value);");
  var opts1 = ["none", "simple", "inset", "double", "left", "round" ];
  var val1 = reportElement.border;
  if(reportElement.newconfig && reportElement.newconfig.border != undefined) { val1 = reportElement.newconfig.border; }
  for(var idx1=0; idx1<opts1.length; idx1++) {
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", opts1[idx1]);
    if(val1 == opts1[idx1]) { option.setAttribute("selected", "selected"); }
    option.innerHTML = opts1[idx1];
  }
  
  //---------- layout controls ------------------
  //configdiv.appendChild(document.createElement('hr'));
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  
  var content_width = reportElement.content_width;
  if(reportElement.newconfig && reportElement.newconfig.content_width != undefined) { content_width = reportElement.newconfig.content_width; }
  var span0 = tdiv2.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "width:";
  var input = tdiv2.appendChild(document.createElement('input'));
  input.setAttribute('style', "width:50px; margin: 1px 1px 1px 1px; font-size:11px; font-family:arial,helvetica,sans-serif;");
  input.setAttribute('type', "text");
  input.setAttribute('value', content_width);
  input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+reportElement.elementID+"\", 'content_width', this.value); }");
  input.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");

  var content_height = reportElement.content_height;
  if(reportElement.newconfig && reportElement.newconfig.content_height != undefined) { content_height = reportElement.newconfig.content_height; }
  var span0 = tdiv2.appendChild(document.createElement('span'));
  span0.setAttribute('style', "margin-left:10px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "height:";
  var input = tdiv2.appendChild(document.createElement('input'));
  input.setAttribute('style', "width:50px; margin: 1px 1px 1px 1px; font-size:11px; font-family:arial,helvetica,sans-serif;");
  input.setAttribute('type', "text");
  input.setAttribute('value', content_height);
  input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+reportElement.elementID+"\", 'content_height', this.value); }");
  input.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");

  //---------- control buttons ------------------
  configdiv.appendChild(document.createElement('hr'));
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-top:5px; float:left;");
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'delete-element');");
  button.innerHTML = "delete element";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-top:5px; float:right;");
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'cancel-reconfig');");
  button.innerHTML = "reset";
  if(!reportElement.newconfig) { button.setAttribute('disabled', "disabled"); }
  
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'accept-reconfig');");
  button.innerHTML = "accept";
  if(!reportElement.newconfig) { button.setAttribute('disabled', "disabled"); }


  return configdiv;
}


//===============================================================
//
// Element datasource configuration interface and search section
//
//===============================================================

function reportElementBuildSourcesInterface(reportElement) {
  if(!reportElement) { return null; }
  
  var main_div = reportElement.main_div;
  if(!main_div) { return null; }
  var elementID = reportElement.elementID;
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var cfgID = reportElement.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) { return; }
  
  var datasource_mode = reportElement.datasource_mode;
  if(datasource_mode == "") { return; } //element does not need a datasource
  if(reportElement.newconfig && reportElement.newconfig.datasource_mode != undefined) { datasource_mode = reportElement.newconfig.datasource_mode; }
  
  configdiv.appendChild(document.createElement('hr'));

  var sourcesID = reportElement.main_div_id + "_sources_search_div";
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
  
  var datasource_mode = reportElement.datasource_mode;
  if(reportElement.newconfig && reportElement.newconfig.datasource_mode != undefined) { datasource_mode = reportElement.newconfig.datasource_mode; }
  //console.log("datasource_mode : "+datasource_mode);
  
  radio1 = sourceDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  //radio1.setAttribute("id", elementID + "_sourcetype_radio1");
  radio1.setAttribute("name", elementID + "_sourcemodetype");
  radio1.setAttribute("value", "feature");
  if(datasource_mode != "shared_element") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
  tspan = sourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "data query";
  
  radio2 = sourceDiv.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  //radio2.setAttribute("id", elementID + "_sourcetype_radio2");
  radio1.setAttribute("name", elementID + "_sourcemodetype");
  radio2.setAttribute("value", "shared_element");
  if(datasource_mode == "shared_element") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
  tspan = sourceDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "shared element";
  
  if(datasource_mode == "shared_element") {
    var datasourceElementID = reportElement.datasourceElementID;
    if(reportElement.newconfig && reportElement.newconfig.datasourceElementID != undefined) { datasourceElementID = reportElement.newconfig.datasourceElementID; }
    if(!datasourceElementID) { datasourceElementID = ""; }
    //console.log("datasourceElementID : "+datasourceElementID);
    
    var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "shared elementID:";
    var titleInput = div1.appendChild(document.createElement('input'));
    titleInput.id =  reportElement.elementID + "_config_datasrcID";
    titleInput.setAttribute('style', "width:250px; margin: 1px 1px 1px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    titleInput.setAttribute('type', "text");
    titleInput.setAttribute('value', datasourceElementID);
    titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasourceElementID', this.value);");
    titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasourceElementID', this.value);");
    //titleInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    //titleInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'title', this.value);");
    titleInput.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
  } else {  //a data query type
    if(!reportElement.newconfig || !reportElement.newconfig.edit_datasource_query) {
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
      button1.setAttribute("style", "margin-left: 7px; font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button1.setAttribute("type", "button");
      button1.setAttribute("value", "edit datasource query");
      button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'edit_datasource_query', this.value);");
      
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
      radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "features";
      
      radio2 = div1.appendChild(document.createElement('input'));
      radio2.setAttribute("type", "radio");
      radio2.setAttribute("name", elementID + "_sourcetype");
      radio2.setAttribute("value", "edge");
      if(datasource_mode == "edge") { radio2.setAttribute('checked', "checked"); }
      radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
      tspan = div1.appendChild(document.createElement('span'));
      tspan.innerHTML = "edges";
      
      radio3 = div1.appendChild(document.createElement('input'));
      radio3.setAttribute("type", "radio");
      radio3.setAttribute("name", elementID + "_sourcetype");
      radio3.setAttribute("value", "source");
      if(datasource_mode == "source") { radio3.setAttribute('checked', "checked"); }
      radio3.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'datasource_mode', this.value);");
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
        sourceSearchForm.setAttribute("onsubmit", "reportElementSourcesSearchCmd(\""+elementID+"\", 'search'); return false;");
        
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
        searchButton.setAttribute("onclick", "reportElementSourcesSearchCmd(\""+elementID+"\", 'search');");
        
        var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
        clearButton.setAttribute("type", "button");
        clearButton.setAttribute("value", "clear");
        clearButton.setAttribute("onclick", "reportElementSourcesSearchCmd(\""+elementID+"\", 'clear');");
        
        //var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
        //clearButton.setAttribute("type", "button");
        //clearButton.setAttribute("value", "refresh");
        //clearButton.setAttribute("onclick", "reportElementSourcesSearchCmd(\""+elementID+"\", 'refresh');");
        
        //-------------
        var sourceResultDiv = sourceSearchForm.appendChild(document.createElement('div'));
        sourceResultDiv.id = elementID + "_sources_search_result_div";
        sourceResultDiv.setAttribute('style', "margin: 1px 3px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
        //sourceResultDiv.innerHTML = "please enter search term";
        sourceResultDiv.innerHTML = "";

        //preload query trigger here
        if(reportElement.source_ids && (!reportElement.newconfig || !reportElement.newconfig.sources_hash) ) {
          reportElementSourcesPreload(elementID);
        } else {
          reportElementSourcesShowSearchResult(elementID);
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
      var query_filter = reportElement.query_filter;
      if(reportElement.newconfig && reportElement.newconfig.query_filter != undefined) { query_filter = reportElement.newconfig.query_filter; }
      var filterInput = div1.appendChild(document.createElement('input'));
      filterInput.setAttribute('style', "width:250px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
      filterInput.setAttribute('type', "text");
      filterInput.setAttribute('value', query_filter);
      filterInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'query_filter', this.value);");
      filterInput.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'query_filter', this.value);");
      filterInput.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
    
      //query_edge_search_depth
      if(datasource_mode == "edge") {
        var span0 = div1.appendChild(document.createElement('span'));
        span0.setAttribute('style', "margin-left:15px; font-size:12px; font-family:arial,helvetica,sans-serif;");
        span0.innerHTML = "edge network search depth:";
        var search_depth = reportElement.query_edge_search_depth;
        if(reportElement.newconfig && reportElement.newconfig.query_edge_search_depth != undefined) { search_depth = reportElement.newconfig.query_edge_search_depth; }
        var input = div1.appendChild(document.createElement('input'));
        input.setAttribute('style', "width:30px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
        input.setAttribute('type', "text");
        input.setAttribute('value', search_depth);
        input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+reportElement.elementID+"\", 'query_edge_search_depth', this.value); }");
        input.setAttribute("onblur", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'refresh', this.value);");
      }
    }
    
    //load_on_page_init
    var div1 = sourceSearchDiv.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    var checkbox = div1.appendChild(document.createElement('input'));
    checkbox.setAttribute("type", "checkbox");
    var load_on_page_init = reportElement.load_on_page_init;
    if(reportElement.newconfig && reportElement.newconfig.load_on_page_init != undefined) { load_on_page_init = reportElement.newconfig.load_on_page_init; }
    if(load_on_page_init) { checkbox.setAttribute("checked", "checked"); }
    checkbox.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'load_on_page_init', this.checked);");
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "load data on page initialization";
  }
  
  

  //TODO: example query for features for target list
  //reportElement.datasource_mode = "feature";
  //reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource";
  //reportElement.query_filter = "F6_KD_CAGE:=true";
  //reportElement.query_format = "fullxml";
  
  
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

function reportElementSourcesSearchCmd(elementID, cmd) {
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
    reportElementSourcesShowSearchResult(elementID);
  }
  if(cmd == "search") {
    var filter = "";
    if(seachInput) { filter = seachInput.value; }
    if(!filter) { filter =" "; }
    reportElementSourcesSubmitSearch(elementID, filter);
  }
}


function reportElementSourcesPreload(elementID) {
  //preload the previous selected sources by searching based on the source_ids
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.source_ids) { return; } //nothing to do

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "preloading previously configured data sources...";

  if(!reportElement.newconfig.sources_hash) {
    reportElement.newconfig.sources_hash = new Object;
  }
  reportElement.newconfig.source_ids = reportElement.source_ids;
  reportElement.newconfig.preload = true;

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  paramXML += "<source_ids>"+reportElement.source_ids+"</source_ids>";
  paramXML += "<mode>sources</mode>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  reportElement.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { reportElementSourcesParseSearchResponse(id); };}(elementID);
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function reportElementSourcesSubmitSearch(elementID, filter) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "searching data sources...";
  
  if(!reportElement.newconfig.sources_hash) {
    reportElement.newconfig.sources_hash = new Object;
  }
  
  //clear unselected sources from hash
  var sources_hash = new Object;
  for(var srcid in reportElement.newconfig.sources_hash) {
    var source = reportElement.newconfig.sources_hash[srcid];
    if(source && (source.selected || source.preload)) {
      sources_hash[srcid] = source;
    }
  }
  reportElement.newconfig.sources_hash = sources_hash;
  
  var datasource_mode = reportElement.datasource_mode;
  if(reportElement.newconfig && reportElement.newconfig.datasource_mode != undefined) { datasource_mode = reportElement.newconfig.datasource_mode; }

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  if(datasource_mode == "feature") { paramXML += "<mode>feature_sources</mode>"; }
  else if(datasource_mode == "edge") { paramXML += "<mode>edge_sources</mode>"; }
  else { paramXML += "<mode>sources</mode>";  }
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  paramXML += "<filter>" + filter + "</filter>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  reportElement.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { reportElementSourcesParseSearchResponse(id); };}(elementID);
  sourcesXMLHttp.open("POST", eedbSearchFCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function reportElementSourcesParseSearchResponse(elementID) {
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
    reportElementSourcesShowSearchResult(elementID);
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
  reportElementSourcesShowSearchResult(elementID);
}


function reportElementSourcesShowSearchResult(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var sourceResultDiv = document.getElementById(elementID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  
  if(!reportElement.newconfig.sources_hash) {
    reportElement.newconfig.sources_hash = new Object;
  }
  var sources_array = new Array();
  var sources_hash = reportElement.newconfig.sources_hash;
  
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
  reportElementSourcesUpdateSearchCounts(elementID);
  
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
    checkbox.setAttribute("onclick", "reportElementSourcesSelectSource(\""+elementID+"\", \"" +source.id+ "\", this.checked);");
    
    //name
    var td2 = tr.appendChild(document.createElement('td'));
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "#");
    a1.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'source-info', '"+source.id+"'); return false; ");
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


function reportElementSourcesUpdateSearchCounts(elementID) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  
  var sources_hash = reportElement.newconfig.sources_hash;
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
    a1.setAttribute("onclick", "reportElementSourcesSelectSource(\""+elementID+"\", 'all'); return false;");
    a1.innerHTML = "select all";
  }
}


function reportElementSourcesSelectSource(elementID, srcID, mode) {
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
    reportElementSourcesShowSearchResult(elementID);
  } else {
    var source = sources_hash[srcID];
    if(source) {
      if(mode) { source.selected = true; }
      else     { source.selected = false; }
      reportElementSourcesUpdateSearchCounts(elementID);
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


//===============================================================
//
// Element cascade-trigger configuration interface
//
//===============================================================

function reportElementCascadeTriggersInterface(reportElement) {
  if(!reportElement) { return null; }
  if(!reportElement.cascade_triggers) { reportElement.cascade_triggers = new Array(); }

  var main_div = reportElement.main_div;
  if(!main_div) { return null; }
  var elementID = reportElement.elementID;
  
  var auxID = reportElement.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) { return; }
  
  var cfgID = reportElement.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) { return; }
  
  configdiv.appendChild(document.createElement('hr'));
  
  var cascadesID = reportElement.main_div_id + "_config_cascades_div";
  var cascadesDiv = document.getElementById(cascadesID);
  if(!cascadesDiv) {
    cascadesDiv = document.createElement('div');
    cascadesDiv.id = cascadesID;
  }
  cascadesDiv.setAttribute('style', "width:100%;");
  cascadesDiv.innerHTML = "";
  configdiv.appendChild(cascadesDiv);
  
  //----------
  var labelDiv = cascadesDiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="Inter-Element cascade-triggers:";
  
  tspan = labelDiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "padding-left:5px; font-size:10px; font-style:italic;");
  var num_triggers = reportElement.cascade_triggers.length;
  if(reportElement.newconfig && reportElement.newconfig.cascade_triggers) { num_triggers = reportElement.newconfig.cascade_triggers.length; }
  tspan.innerHTML = num_triggers + " triggers";

  //first display current CascadeTriggers (probably no editing, but delete)
  if(!reportElement.newconfig || !reportElement.newconfig.edit_cascade_triggers) {
    var button1 = labelDiv.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 17px; font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "edit cascade triggers");
    button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'edit_cascade_triggers', this.value);");
    
  } else {
    var button1 = labelDiv.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 17px; font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "add trigger");
    button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'add_cascade_trigger');");
    button1.setAttribute("onmouseover", "eedbMessageTooltip(\"add new cascade trigger\",130);");
    button1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    var table1 = cascadesDiv.appendChild(document.createElement('table'));
    table1.setAttribute('width', "100%");
    table1.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");

    for(var trig_idx=0; trig_idx<reportElement.newconfig.cascade_triggers.length; trig_idx++){
      var trigger = reportElement.newconfig.cascade_triggers[trig_idx];
      if(!trigger) { continue; }
      //console.log("trigger "+reportElement.elementID+" ["+trig_idx+"] on["+trigger.on_trigger+"]  action["+trigger.action_mode+" - "+trigger.options+"]");
      //if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
      //if(!trigger.targetElement) { continue; }

      var tr1 = table1.appendChild(document.createElement('tr'));

      //var row_div = cascadesDiv.appendChild(document.createElement('div'));
      //row_div.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      
      //var span1 = row_div.appendChild(document.createElement('span'));
      //"&alpha; &psi; &bull; &#9658; &Omega; &otimes;ƒmouseover
      //span1.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      //span1.innerHTML = "&#9658; on["+trigger.on_trigger+"] &rArr; action["+trigger.action_mode+"] "
      //to-target["+trigger.targetElement.element_type+":"+trigger.targetElementID+"]";
      //if(trigger.options) { span1.innerHTML += " opts:["+trigger.options+"] "; }
      //span1.innerHTML += " &Omega; to-target["+trigger.targetElement.element_type+":"+trigger.targetElementID+"]";

      //on_trigger
      var td1 = tr1.appendChild(document.createElement('td'));
      var span1 = td1.appendChild(document.createElement('span'));
      span1.innerHTML = "&#9658; on: ";
      //span1.innerHTML = "&alpha; on: ";
      var select = td1.appendChild(document.createElement('select'));
      select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_on_trigger', '"+trig_idx+"', this.value);");
      var opts1 = ["select", "select_location", "reset", "preload", "load", "postprocess" ];
      for(var idx1=0; idx1<opts1.length; idx1++) {
        var option = select.appendChild(document.createElement('option'));
        option.setAttribute("value", opts1[idx1]);
        if(trigger.on_trigger == opts1[idx1]) { option.setAttribute("selected", "selected"); }
        option.innerHTML = opts1[idx1];
      }

      //action_mode
      var td1 = tr1.appendChild(document.createElement('td'));
      var span1 = td1.appendChild(document.createElement('span'));
      span1.innerHTML = " &rArr; action: ";
      var select = td1.appendChild(document.createElement('select'));
      select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_action_mode', '"+trig_idx+"', this.value);");
      var opts1 = ["select", "set_focus", "focus_load", "set_filter_features", "reset", "load", "postprocess"];
      for(var idx1=0; idx1<opts1.length; idx1++) {
        var option = select.appendChild(document.createElement('option'));
        option.setAttribute("value", opts1[idx1]);
        if(trigger.action_mode == opts1[idx1]) { option.setAttribute("selected", "selected"); }
        option.innerHTML = opts1[idx1];
      }

      //action_mode options
      var opts1 = [];
      if(trigger.action_mode == "select") {
        opts1 = ["clear"];
        opts1.push("selection_id");
        if((reportElement.datasource_mode == "edge") && (reportElement.element_type != "treelist")) {
          opts1.push("f1.id");
          opts1.push("f2.id");
        }
        //reportElement.dtype_columns.sort(zenbuElement_column_order_sort_func);
        var columns = reportElement.dtype_columns;
        for(var i=0; i<columns.length; i++) {
          var dtype_col = columns[i];
          if(!dtype_col) { continue; }
          //dtype_col.colnum = i+1;  //reset column order based on sorting
          opts1.push(dtype_col.datatype);
        }
      }
      if((trigger.action_mode == "set_focus") || (trigger.action_mode == "focus_load")) {
        opts1 = ["clear"];
        if((reportElement.datasource_mode == "edge") && (reportElement.element_type != "treelist")) {
          opts1.push("selection_f1");
          opts1.push("selection_f2");
        } else {
          opts1.push("selection");
        }
      }
      if(trigger.action_mode == "set_filter_features") {
        opts1 = ["clear", "selection", "subnetwork", "all_features"];
      }
      if(opts1.length>0) {
        var span1 = td1.appendChild(document.createElement('span'));
        span1.innerHTML = " : ";
        var select = td1.appendChild(document.createElement('select'));
        select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_options', '"+trig_idx+"', this.value);");
        for(var idx1=0; idx1<opts1.length; idx1++) {
          var option = select.appendChild(document.createElement('option'));
          option.setAttribute("value", opts1[idx1]);
          if(trigger.options == opts1[idx1]) { option.setAttribute("selected", "selected"); }
          option.innerHTML = opts1[idx1];
        }
      }

      //target: even the to-target can be a pull-down based on the known page elements
      var td1 = tr1.appendChild(document.createElement('td'));
      var span1 = td1.appendChild(document.createElement('span'));
      //span1.innerHTML += " to-target : ";
      span1.innerHTML += " &Omega; to-target : ";
      var select = td1.appendChild(document.createElement('select'));
      select.setAttribute("onchange", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'trigger_targetID', '"+trig_idx+"', this.value);");
      if(trigger.targetElementID == "") {
        var option = select.appendChild(document.createElement('option'));
        option.setAttribute("value", "");
        option.setAttribute("selected", "selected");
        option.innerHTML = "please select target";
      }
      for(var id1 in current_report.elements) {
        var t_element = current_report.elements[id1];
        if(!t_element) { continue; }
        if(t_element.element_type == "layout") { continue; }
        if(t_element.element_type == "tools_panel") { continue; }
        var option = select.appendChild(document.createElement('option'));
        option.setAttribute("value", t_element.elementID);
        if(trigger.targetElementID == t_element.elementID) { option.setAttribute("selected", "selected"); }
        option.innerHTML = t_element.elementID;
      }

      //copy trigger img/button
      var img1 = td1.appendChild(document.createElement('img'));
      img1.setAttribute('style', "margin-left:5px;");
      img1.setAttribute("src", eedbWebRoot+"/images/copy_gray.png");
      img1.setAttribute("height", "12");
      img1.setAttribute("alt","copy");
      img1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'copy_cascade_trigger', '"+trig_idx+"');");
      img1.setAttribute("onmouseover", "eedbMessageTooltip(\"copy cascade trigger\",130);");
      img1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

      //delete trigger img/button
      var img1 = td1.appendChild(document.createElement('img'));
      img1.setAttribute('style', "margin-left:5px;");
      img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
      img1.setAttribute("width", "12");
      img1.setAttribute("height", "12");
      img1.setAttribute("alt","close");
      img1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ reportElement.elementID +"\", 'delete_cascade_trigger', '"+trig_idx+"');");
      img1.setAttribute("onmouseover", "eedbMessageTooltip(\"delete cascade trigger\",130);");
      img1.setAttribute("onmouseout", "eedbClearSearchTooltip();");

      /*
      //for debugging
      var row_div = cascadesDiv.appendChild(document.createElement('div'));
      row_div.setAttribute('style', "margin-left:15px; font-size:12px; font-family:arial,helvetica,sans-serif;");
      var span1 = row_div.appendChild(document.createElement('span'));
      //"&alpha; &psi; &bull; &#9658; &Omega; &otimes;ƒmouseover
      span1.innerHTML = "&#9658; on["+trigger.on_trigger+"] ";
      span1.innerHTML += " &rArr; action["+trigger.action_mode+"] "
      if(trigger.options) { span1.innerHTML += " opts:["+trigger.options+"] "; }
      span1.innerHTML += " &Omega; to-target["+trigger.targetElement.element_type+":"+trigger.targetElementID+"]";
       */

    }
  }
  
  return cascadesDiv;
}


//===============================================================
//
// column controls interface
//
//===============================================================


function reportElementColumnsInterface(elementID, visible_mode) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return null; }
  
  if(!current_report.edit_page_configuration) { return; }

  //column/datatypes are copied from datasource to sharedElement so allows different
  //  column display for sharedDatasource. so interface on the reportElement
  
  //attempts to try to get the right-mouse context panel to disappear but without success
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }
  window.blur();

  var auxdiv = reportElement.auxdiv;
  if(!auxdiv) { return; }
  var auxRect = auxdiv.getBoundingClientRect();

  //var configdiv = reportElement.config_options_div;
  var colPanelID = reportElement.main_div_id + "_columns_config_subpanel";
  var columns_div = document.getElementById(colPanelID);
  if(!columns_div) {
    columns_div = auxdiv.appendChild(document.createElement('div'));
    columns_div.id = colPanelID;
    columns_div.panel_visible = false;
  }
  columns_div.panel_visible = ! columns_div.panel_visible;
  if(visible_mode=="refresh") { columns_div.panel_visible = true; }
  if(visible_mode=="open") { columns_div.panel_visible = true; }
  if(visible_mode=="close") { columns_div.panel_visible = false; }

  if(!columns_div.panel_visible) {
    columns_div.style.display = "none";
    reportElement.column_dtype_select = "";
    return;
  }

  var columnsRect = columns_div.getBoundingClientRect();

  var e = window.event
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  if(xpos < 100) { xpos = 100; }
  if(ypos < 100) { ypos = 100; }

  xpos = xpos - (auxRect.x + window.scrollX);
  ypos = ypos - (auxRect.y + window.scrollY);

  if(visible_mode=="refresh") {
    xpos = reportElement.columns_panel_xpos;
    ypos = reportElement.columns_panel_ypos;
  } else {
    reportElement.columns_panel_xpos = xpos;
    reportElement.columns_panel_ypos = ypos;
  }

  //bck-color: rgb(245,245,250)  #FDFDFD
  var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
  style += "background-color:#FDFDFD; padding: 5px 5px 5px 5px; min-width:150px; ";
  style += "border:inset; border-width:2px; white-space: nowrap; ";
  style += "position:absolute; left:"+ (xpos+5) +"px; top:"+ (ypos) +"px; z-index:100; ";
  //style += "position:absolute; left:100px; top:30px; z-index:100; ";
  columns_div.setAttribute('style', style);

  columns_div.innerHTML = "";

  //close button
  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "reportElementColumnsInterface('"+reportElement.elementID+"', 'close'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = columns_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "white-space: nowrap; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "datatype column controls ";

  columns_div.appendChild(document.createElement('hr'));
  
  reportElement.dtype_columns.sort(zenbuElement_column_order_sort_func);
  var columns = reportElement.dtype_columns;

  var selected_row_div = null;
  var selected_dtype_col = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    
    dtype_col.colnum = i+1;  //reset column order based on sorting
  
    var row_div = columns_div.appendChild(document.createElement('div'));
    row_div.setAttribute('style', "white-space: nowrap; ");
    row_div.setAttribute("onclick", "reportElementColumnsInterfaceDetails(\""+reportElement.elementID+"\", \""+dtype_col.datatype+"\"); return false");
    row_div.className = "row_outline";

    var tcheck = row_div.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 1px 3px 1px 3px;");
    tcheck.setAttribute('type', "checkbox");
    if(dtype_col.visible) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onmousedown", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-visible', \""+dtype_col.datatype+"\"); return false");
    
    var tspan = row_div.appendChild(document.createElement('span'));
    tspan.innerHTML =  dtype_col.title;
    if(dtype_col.title != dtype_col.datatype) {
      var tspan = row_div.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "padding-left:7px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
      tspan.innerHTML =  "["+ dtype_col.datatype +"]";
    }
    
    if(reportElement.column_dtype_select == dtype_col.datatype) {
      console.log("columns interface select ["+dtype_col.datatype+"] for details interface");
      row_div.style.backgroundColor = "#DDFDFD";
      selected_row_div = row_div;
      selected_dtype_col = dtype_col;
    }
    
    //TODO: click on dtype name brings up a rename panel, panel can also allow other ctrl like order-pos
    //TODO: click/drag on dtype name starts a drag reorder
  }

  if(selected_row_div) {
    var rect = selected_row_div.getBoundingClientRect();
    console.log("row_div rect x:"+rect.x+" y:"+rect.y+" left:"+rect.left+" right:"+rect.right+" top:"+rect.top+" bottom:"+rect.bottom);

    var details_div = columns_div.appendChild(document.createElement('div'));
    var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; ";
    style += "background-color:#FDFDFD; padding: 5px 5px 5px 5px; width:300px; ";
    style += "border:inset; border-width:2px; white-space: nowrap; ";
    //style += "position:absolute; left:"+(columnsRect.right-columnsRect.left+10)+"px; top:"+(rect.top-columnsRect.top)+"px; z-index:100; ";
    style += "position:absolute; left:"+(selected_row_div.clientWidth+15)+"px; top:"+(rect.top-columnsRect.top)+"px; z-index:100; ";
    details_div.setAttribute('style', style);

    tdiv = details_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px; color:gray; float:right;");
    tdiv.innerHTML = selected_dtype_col.col_type;

    tdiv = details_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px; color:blue;");
    tdiv.innerHTML = selected_dtype_col.datatype;

    tdiv = details_div.appendChild(document.createElement('div'));
    //tdiv.innerHTML = "title ["+selected_dtype_col.title+"]";
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "title: ";
    var input = tdiv.appendChild(document.createElement('input'));
    //input.setAttribute('size', "13");
    input.setAttribute('style', "width:200px; margin: 1px 1px 1px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    input.setAttribute('type', "text");
    input.setAttribute('value', selected_dtype_col.title);
    input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+reportElement.elementID+"\", 'dtype-title', \""+selected_dtype_col.datatype+"\", this.value); }");
    input.setAttribute("onblur", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-title', \""+selected_dtype_col.datatype+"\", this.value);");
    //input.setAttribute("onchange", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-title', \""+selected_dtype_col.datatype+"\", this.value); return false");
    //input.setAttribute("onkeydown", "if(event.keyCode==13) { reportsChangeGlobalParameter('dwidth', this.value)}");
    //input.setAttribute("onblur", "reportElementColumnsInterfaceDetails(\""+reportElement.elementID+"\", \""+selected_dtype_col.datatype+"\"); return false");

    tdiv = details_div.appendChild(document.createElement('div'));
    //tdiv.innerHTML = "colnum ["+selected_dtype_col.colnum+"]";
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "column order: ";
    var input = tdiv.appendChild(document.createElement('input'));
    input.setAttribute('size', "7");
    input.setAttribute('type', "text");
    input.setAttribute('value', selected_dtype_col.colnum);
    input.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementEvent(\""+reportElement.elementID+"\", 'dtype-colnum', \""+ selected_dtype_col.datatype+ "\", this.value); }");
    input.setAttribute("onblur", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-colnum', \""+selected_dtype_col.datatype+"\", this.value);");
    //input.setAttribute("onchange", "reportElementEvent(\""+reportElement.elementID+"\", 'dtype-colnum', \""+selected_dtype_col.datatype+"\", this.value); return false");
    //input.setAttribute("onblur", "reportElementColumnsInterfaceDetails(\""+reportElement.elementID+"\", \""+selected_dtype_col.datatype+"\"); return false");
  }

  return  columns_div;
}

function reportElementColumnsInterfaceDetails(elementID, dtype) {
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return null; }

  if(reportElement.column_dtype_select == dtype) {
    reportElement.column_dtype_select= "";
  } else {
    reportElement.column_dtype_select= dtype;
  }
  reportElementColumnsInterface(elementID, 'refresh');
}


function zenbuElement_column_order_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  if(a.visible && !b.visible) { return -1; }
  if(!a.visible && b.visible) { return 1; }
  
  if(!a.visible && !b.visible) {
    if(a.title.toLowerCase() < b.title.toLowerCase()) { return -1; }
    if(a.title.toLowerCase() > b.title.toLowerCase()) { return 1; }
  }
  
  if(a.colnum>0 && b.colnum<0) { return -1; }
  if(a.colnum<0 && b.colnum>0) { return 1; }
  
  if(a.colnum > b.colnum) { return 1; }
  if(a.colnum < b.colnum) { return -1; }
  return 0;
}


//===================================================================================
//
//  Colorspace config controls. can be used by sublasses if they need
//
//===================================================================================

function reportElementColorSpaceOptions(reportElement) {
  if(!reportElement) { return null; }
  var div1 = document.createElement('div');
  
  var span1 = div1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "margin: 0px 0px 0px 7px;");
  span1.appendChild(document.createTextNode("color options:"));
  
  var colorspace = reportElement.colorspace;
  if(reportElement.newconfig && (reportElement.newconfig.colorspace !== undefined)) { colorspace = reportElement.newconfig.colorspace; }
  if(!colorspace) {
    colorspace = "fire1";
    if(reportElement.newconfig) { reportElement.newconfig.colorspace = "fire1"; }
  }
  console.log("reportElementColorSpaceOptions colorspace["+colorspace+"]");
  var colorcat = "zenbu-spectrum";
  var colordepth = "";
  var colorprefix = colorspace;
  if(colorspace.match(/_bp_/)) {
    var colorSpc = zenbuColorSpaces[colorspace];
    if(colorSpc) {
      colorcat = colorSpc.colorcat;
      
      var idx1 = colorspace.indexOf('_bp_');
      if(idx1 > 0) {
        colordepth = colorspace.substr(idx1+4);
        colorprefix = colorspace.substr(0,idx1);
      }
    }
  }
  console.log("colorspace["+colorspace+"]  prefix["+colorprefix+"]  depth["+colordepth+"]");

  var discrete = reportElement.colorspace_discrete;
  if(reportElement.newconfig && (reportElement.newconfig.colorspace_discrete !== undefined)) { discrete = reportElement.newconfig.colorspace_discrete; }
  if(!discrete) { discrete = zenbuColorSpaces[colorspace].discrete; }
  
  var logscale = false;
  //var logscale = reportElement.colorspace_logscale;
  //if(reportElement.newconfig && (reportElement.newconfig.colorspace_logscale !== undefined)) { logscale = reportElement.newconfig.colorspace_logscale; }

  //first colorspace_category
  var select = div1.appendChild(document.createElement('select'));
  select.setAttributeNS(null, "onchange", "reportElementReconfigParam(\""+ reportElement.elementID+"\", 'colorspace_category', this.value);");
  var ccats = ["brewer-sequential", "brewer-diverging", "brewer-qualitative", "zenbu-spectrum"];
  for(var i=0; i<ccats.length; i++) {
    var ccat = ccats[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", ccat);
    if(ccat == colorcat) { option.setAttribute("selected", "selected"); }
    option.innerHTML = ccat;
  }

  //second the actual colorspace name
  var cdepths_hash = {};
  var cdepths = [];
  var csname_hash = {};
  var select = div1.appendChild(document.createElement('select'));
  select.setAttributeNS(null, "onchange", "reportElementReconfigParam(\""+ reportElement.elementID+"\", 'colorspace', this.value);");
  for(var csname in zenbuColorSpaces){
    var colorSpc = zenbuColorSpaces[csname];
    if(colorSpc.colorcat != colorcat) { continue; }

    var dname = csname;
    var idx1 = dname.indexOf('_bp_');
    if(idx1 > 0) { dname = dname.substr(0, idx1); }

    if(dname == colorprefix) { cdepths_hash[colorSpc.bpdepth] = true; }
    
    if(csname_hash[dname]) { continue; }
    
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", csname);
    option.innerHTML = dname;
    if(dname == colorprefix) { option.setAttribute("selected", "selected"); }
    csname_hash[dname] = true;
  }
  for(var bpdepth in cdepths_hash) { cdepths.push(bpdepth); }

  //third the color depth for brewer palettes
  var span2 = div1.appendChild(document.createElement('span'));
  if(colorcat == "zenbu-spectrum") { span2.setAttribute("style", "display:none"); }
  var select = span2.appendChild(document.createElement('select'));
  select.setAttributeNS(null, "onchange", "reportElementReconfigParam(\""+ reportElement.elementID+"\", 'colorspace_depth', this.value);");
  //var cdepths = ['3','4','5','6','7','8','9','10','11','12'];
  for(var i=0; i<cdepths.length; i++) {
    var cdepth = cdepths[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", cdepth);
    if(cdepth == colordepth) { option.setAttribute("selected", "selected"); }
    option.innerHTML = cdepth;
  }
  
  //var span2 = div1.appendChild(document.createElement('span'));
  //var logCheck = span2.appendChild(document.createElement('input'));
  //logCheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
  //logCheck.setAttribute('type', "checkbox");
  //if(logscale) { logCheck.setAttribute('checked', "checked"); }
  //logCheck.setAttribute("onclick", "reportElementReconfigParam(\""+ reportElement.elementID+"\", 'colorspace_logscale', this.checked);");
  //var span1 = span2.appendChild(document.createElement('span'));
  //span1.innerHTML = "log scale";

  //next line draw the color spectrum
  var div2 = div1.appendChild(document.createElement('div'));
  //div2.appendChild(zenbuMakeColorGradient(reportElement));
  div2.appendChild(zenbuMakeColorGradient(colorspace, discrete, logscale));
  
  
  /*
  //a scaling value input
  var div2 = div1.appendChild(document.createElement('div'));
  div2.setAttribute('style', "margin: 0px 1px 0px 7px;");
  var span4 = div2.appendChild(document.createElement('span'));
  span4.innerHTML = "min signal: ";
  var levelInput = div2.appendChild(document.createElement('input'));
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  levelInput.setAttribute('size', "5");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', reportElement.scale_min_signal);
  levelInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID+"\", 'scale_min_signal', this.value);");
  
  var span4 = div2.appendChild(document.createElement('span'));
  span4.setAttribute('style', "margin-left: 3px;");
  span4.innerHTML = "max signal: ";
  var levelInput = div2.appendChild(document.createElement('input'));
  levelInput.setAttribute('style', "margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  levelInput.setAttribute('size', "5");
  levelInput.setAttribute('type', "text");
  levelInput.setAttribute('value', reportElement.scale_max_signal);
  levelInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ reportElement.elementID+"\", 'scale_max_signal', this.value);");
  */
  //var span2 = div2.appendChild(document.createElement('span'));
  //span2.setAttribute('style', "margin: 1px 2px 1px 3px;");
  //span2.innerHTML = "experiment merge:";
  //div2.appendChild(createExperimentMergeSelect(reportElement.elementID));
  
  return div1;
}





