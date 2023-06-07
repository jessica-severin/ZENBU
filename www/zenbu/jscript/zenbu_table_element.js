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

//var element = new ZenbuTableElement();

function ZenbuTableElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuTableElement");
  this.element_type = "table";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  
  this.title_prefix = "";
  this.title = "new Table";
  this.sort_col = "name";
  this.sort_reverse = false;
  this.font_size = 10;
  this.overflow_mode = "paging";
  this.show_hover_info = false;
  this.grid_lines = false;
  
  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;
  
  //methods
  this.initFromConfigDOM  = zenbuTableElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuTableElement_generateConfigDOM;  //returns a ConfigDOM object
  
  this.elementEvent       = zenbuTableElement_elementEvent;
  this.reconfigureParam   = zenbuTableElement_reconfigureParam;

  this.resetElement       = zenbuTableElement_reset;
  this.postprocessElement = zenbuTableElement_postprocess;
  this.showSelections     = zenbuTableElement_showSelections
  this.drawElement        = zenbuTableElement_draw;
  this.configSubpanel     = zenbuTableElement_configSubpanel;
  
  //internal methods
  this.pagingInterface    = zenbuTableElement_pagingInterface
  this.tableSortFunc     = zenbuTableElement_tableSortFunc;
  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================
//TODO: need to figure out subclass configXML, not currently using

function zenbuTableElement_initFromConfigDOM(elementDOM) {
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "table") { return false; }
  
  //eventually maybe a superclass init call here
  
  if(elementDOM.getAttribute("table_page_size")) {  this.table_page_size = Math.floor(elementDOM.getAttribute("table_page_size")); }
  //if(elementDOM.getAttribute("table_num_pages")) {  this = elementDOM.getAttribute("table_num_pages"); }
  //if(elementDOM.getAttribute("table_page")) {  this = elementDOM.getAttribute("table_page"); }
  if(elementDOM.getAttribute("sort_col")) {  this.sort_col = elementDOM.getAttribute("sort_col"); }
  if(elementDOM.getAttribute("sort_reverse") == "true") { this.sort_reverse = true; }
  if(elementDOM.getAttribute("overflow_mode")) { this.overflow_mode = elementDOM.getAttribute("overflow_mode"); }
  if(elementDOM.getAttribute("show_hover_info") == "true") { this.show_hover_info = true; }
  if(elementDOM.getAttribute("grid_lines") == "true") { this.grid_lines = true; }
  
  return true;
}


function zenbuTableElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.table_page_size) { elementDOM.setAttribute("table_page_size", this.table_page_size); }
  //if(this.table_num_pages) { elementDOM.setAttribute("table_num_pages", this.table_num_pages); }
  //if(this.table_page) { elementDOM.setAttribute("table_page", this.table_page); }
  if(this.sort_col) { elementDOM.setAttribute("sort_col", this.sort_col); }
  if(this.sort_reverse) { elementDOM.setAttribute("sort_reverse", "true"); }
  if(this.overflow_mode) { elementDOM.setAttribute("overflow_mode", this.overflow_mode); }
  if(this.show_hover_info) { elementDOM.setAttribute("show_hover_info", "true"); }
  if(this.grid_lines) { elementDOM.setAttribute("grid_lines", "true"); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuTableElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this.datasource();
  if(mode == "page-size") {  
    var table_page_index = (this.table_page-1) * this.table_page_size;  //get old index
    this.table_page_size = Math.floor(value);
    if(this.table_page_size < 5) { this.table_page_size = 5; }
    //if(this.table_page_size > 100) { this.table_page_size = 100; }
    var num_pages = Math.ceil(this.filter_count / this.table_page_size);
    this.table_num_pages = num_pages;
    this.table_page = Math.floor(table_page_index / this.table_page_size) + 1;
    //console.log("new page size:"+this.table_page_size+" old index="+table_page_index+"  new page="+this.table_page);
    //this.content_height = Math.floor((this.table_page_size * 16.4) + 65);  //For DrawTable
    var line_height = 16.4;
    if(this.font_size) { line_height = this.font_size + 4.4; }
    if(this.grid_lines) { line_height += 1; }
    this.content_height = Math.floor((this.table_page_size * line_height) + 65);  //For DrawTable
  }
  if(mode == "page") {  
    if(value<1) { value = 1; }
    this.table_page = value;
  }
  if(mode == "previous-page") {  
    this.table_page--;
    if(this.table_page<1) { this.table_page = 1; }
  }
  if(mode == "next-page") {  
    this.table_page++;
    if(this.table_page > this.table_num_pages) { this.table_page = this.table_num_pages; }
  }
  if(mode == "column_sort") {
    if(this.sort_col == value) {
      this.sort_reverse = !this.sort_reverse;
    } else {
      this.sort_col = value;
      this.sort_reverse = false;
    }
    reportsPostprocessElement(this.elementID);
  }
}


function zenbuTableElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  if(param == "overflow_mode")   { this.newconfig.overflow_mode = value; }
  if(param == "show_hover_info") { this.newconfig.show_hover_info = value; }
  if(param == "grid_lines")      { this.newconfig.grid_lines = value; }
  
  if(param == "accept-reconfig") {
    if(this.newconfig.overflow_mode !== undefined) { this.overflow_mode = this.newconfig.overflow_mode; }
    if(this.newconfig.show_hover_info !== undefined) { 
      this.show_hover_info = this.newconfig.show_hover_info; 
      //this.newconfig.needReload=true; 
    }
    if(this.newconfig.grid_lines !== undefined) { this.grid_lines = this.newconfig.grid_lines; }
  }
}

//=================================================================================
//
// reset / postprocess
//
//=================================================================================


function zenbuTableElement_reset() {
  //console.log("zenbuTableElement_reset ["+this.elementID+"]");

  //clear previous loaded data
  this.features = new Object();
  this.feature_array = new Array();
  this.edge_array = new Array();
  this.edge_count = 0;

  //clear previous target & selection
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table

  this.table_num_pages = 0;
  this.table_page = 1;

  this.title = this.title_prefix;
}


function zenbuTableElement_postprocess() {
  var elementID = this.elementID;
  //console.log("zenbuTableElement_postprocess ["+elementID+"]");

  var datasourceElement = this.datasource();

  //update title
  this.title = this.title_prefix;
  if(datasourceElement.focus_feature) {
    this.title += " "+ datasourceElement.focus_feature.name;
  }
  
  if(datasourceElement.datasource_mode == "feature") {
    datasourceElement.filter_count=0;
    datasourceElement.feature_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }
      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !feature.search_match) { continue; }
      datasourceElement.filter_count++;
    }
  }
  if(datasourceElement.datasource_mode == "edge") {
    datasourceElement.filter_count=0;
    console.log("table postprocess ds["+(datasourceElement.elementID)+"] sort "+(datasourceElement.edge_array.length)+" edges by "+(this.sort_col));
    datasourceElement.edge_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

      datasourceElement.filter_count++;
    }
  }
  if(datasourceElement.datasource_mode == "source") {
    datasourceElement.filter_count=0;
    datasourceElement.sources_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.sources_array.length; j++) {
      var source = datasourceElement.sources_array[j];
      if(!source) { continue; }
      if(!source.filter_valid) { continue; }
      if(datasourceElement.search_data_filter && datasourceElement.show_only_search_matches && !source.search_match) { continue; }
      datasourceElement.filter_count++;
    }
  }
  var num_pages = Math.ceil(datasourceElement.filter_count / this.table_page_size);
  this.table_num_pages = num_pages;
  this.table_page = 1;
}


function zenbuTableElement_showSelections() {
  if(this.element_type != "table") { return; }
  
  console.log("zenbuTableElement_showSelections "+this.elementID+" "+this.selected_id);
  
  var datasourceElement = this.datasource();
  
  //figure out which page the selected feature/edge is on so it updates
  var display_list = new Array();
  if(datasourceElement.datasource_mode == "edge")    {
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(this.search_data_filter && this.show_only_search_matches && !edge.search_match) { continue; }
      if(this.focus_feature &&
         (this.focus_feature.id != edge.feature1_id) &&
         (this.focus_feature.id != edge.feature2_id)) { continue; }
      
      display_list.push(edge);
    }
  }
  if(datasourceElement.datasource_mode == "feature") {
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }
      if(this.search_data_filter && this.show_only_search_matches && !feature.search_match) { continue; }
      display_list.push(feature);
    }
  }
  display_list.sort(this.tableSortFunc());
  
  var filter_idx=0;
  var found_match=false;
  for(j=0; j<display_list.length; j++) {
    var obj1 = display_list[j];
    if(!obj1) { continue; }
    filter_idx++;
    if(datasourceElement.datasource_mode == "feature") {
      if(obj1.id == this.selected_id) { found_match=true; break; }
    }
    if(datasourceElement.datasource_mode == "edge") {
      //if(obj1.feature2_id == this.selected_id) { found_match=true; break; }
      if(obj1.id == this.selected_id) { found_match=true; break; }
      if(obj1.feature1.id == this.selected_id) { found_match=true; break; }
      if(obj1.feature2.id == this.selected_id) { found_match=true; break; }
    }
  }
  
  /*
  if(datasourceElement.datasource_mode == "feature") {
    datasourceElement.feature_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      //if(!feature.filter_valid) { continue; }
      if(this.show_only_search_matches && !feature.search_match) { continue; }
      filter_idx++;
      if(feature.id == this.selected_id) { found_match=true; break; }
    }
  }
  if(datasourceElement.datasource_mode == "edge") {
    datasourceElement.edge_array.sort(this.tableSortFunc());
    filter_idx=0;
    found_match=false;
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(this.show_only_search_matches && !edge.search_match) { continue; }
      if(this.focus_feature && (edge.feature1_id != this.focus_feature.id)) { continue; }
      filter_idx++;
      if(edge.feature2_id == this.selected_id) { found_match=true; break; }
    }
  }
   */
  if(found_match) {
    //need to round this index to the page boundary
    this.table_page = Math.floor((filter_idx-1) / this.table_page_size) + 1;
    var table_page_index = (this.table_page-1) * this.table_page_size;
    console.log("zenbuTableElement_showSelections ["+this.elementID+"] display_list.length:"+(display_list.length)+" found index:"+filter_idx+" page="+this.table_page+"  page_size="+this.table_page_size +"  page_index="+table_page_index);
    
    if(this.overflow_mode == "scrolling") { this.table_needs_to_scroll = true; }
  }
  
  reportsDrawElement(this.elementID);
}


//==========  Table draw =======================================================================

function zenbuTableElement_draw() {
  if(this.loading) { return; }

  var datasourceElement = this.datasource();

  var main_div =  this.main_div;
  if(!main_div) { return; }

  //resize to pagesize logic
  if(this.resized) {
    console.log("table was resized!!! to height " +this.content_height);
    var table_page_index = (this.table_page-1) * this.table_page_size;
    console.log("current index "+table_page_index+", current page "+this.table_page);
    //console.log("current index "+this.table_page_index+", current page "+page);
    //need to round this index to the page boundary
    var line_height = 16.4;  //old offset was 72
    if(this.font_size) { line_height = this.font_size + 4.4; }
    if(this.grid_lines) { line_height += 1; }
    this.table_page_size = Math.round((this.content_height -67) / line_height);
    if(this.table_page_size < 5) { this.table_page_size = 5; }
    this.table_page = Math.floor(table_page_index / this.table_page_size) + 1;
    this.table_num_pages  = Math.ceil(this.filter_count / this.table_page_size);
    console.log("resized new page size ["+ this.table_page_size  +"]");
    var t_height = Math.floor((this.table_page_size * line_height) + 65);
    if(this.content_height < t_height) {
      this.content_height = Math.floor((this.table_page_size * line_height) + 65);
      console.log("resized readjust height ["+ this.content_height  +"]");
      main_div.style.height = this.content_height +"px";
    }
  }

  //TODO: need logic for toggle hiding table if no focus_feature/filter_ids/data
  //if(need to hide) { return; }

  //console.log("reportsDrawTable : " + this.elementID);
  
  //table contents
  var tdiv, tspan, tinput, ta;
  var table_div = main_div.appendChild(document.createElement('div'));
  this.table_div = table_div;
  var style = "text-align:left; font-family:arial,helvetica,sans-serif; "+
              "background-color:#FDFDFD; min-width:100px; overflow:auto;";  //overflow is a safety
              //"background-color:#FAFAFA; border:inset; border-width:2px; padding: 5px 5px 5px 5px; ";
              //"padding: 5px 5px 5px 5px; overflow: auto; resize: both; ";
              //"padding: 5px 5px 5px 5px; overflow-y:scroll; resize:both; ";
              //style += "min-width:100px; ";
  if(this.content_width) { style += "width:"+(this.content_width-2)+"px; "; }
  if(this.font_size) { style += "font-size:"+(this.font_size)+"px; "; }  
  table_div.setAttribute('style', style);

  table_div.innerHTML = "";

  //now search the edges/features and display the targets and ASOs

  //get the visible columns in order
  this.dtype_columns.sort(reports_column_order_sort_func);
  var columns = this.dtype_columns;

  var table = table_div.appendChild(document.createElement('table'));
  table.setAttribute('style', "border-collapse:collapse; border:1px solid black");
  table.width = (this.content_width - 5)+"px";

  var thead = table.appendChild(document.createElement('thead'));
  var tr = thead.appendChild(document.createElement('tr'));

  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible) { continue; }
    var th = tr.appendChild(document.createElement('th'));
    if(this.sort_col == dtype_col.datatype) { th.setAttribute('style', "color:green;"); }
    if(this.grid_lines) { th.style.borderLeft = "1px solid gray"; }
    //th.setAttribute("onmousedown", "reportElementTableEvent(\""+this.elementID+"\", 'sort', '"+dtype_col.datatype+"');");
    //th.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'column_sort', '"+dtype_col.datatype+"');");
    th.setAttribute("onmousedown", "if(event.ctrl || event.altKey) { reportElementColumnsInterface(\""+this.elementID+ "\"); } else { reportElementEvent(\""+ this.elementID +"\", 'column_sort', '"+dtype_col.datatype+"'); }");
    th.innerHTML = dtype_col.title;
    if(this.sort_col == dtype_col.datatype) {
      //if(this.sort_reverse) { th.innerHTML += "&#11167;"; } else { th.innerHTML += "&#11165;"; } //dart arrow
      if(this.sort_reverse) { th.innerHTML += "&#9660;"; } else { th.innerHTML += "&#9650;"; } //triangle
    }

    //th.setAttribute("ondblclick", "reportElementColumnsInterface((\""+this.elementID+"\");");
    //th.setAttribute("ondblclick", "reportsGeneralWarn('yep I can capture double-click, I will use this for column rename'); return false");
    //TODO: need to use the column_sort event and check for right-click or dblclick before sorting
  }
  if(this.overflow_mode == "scrolling") {  //add extra th for padding
    var th = tr.appendChild(document.createElement('th'));
    th.style.width = "10px"; //needs to be the width of the scrollbar of the body
  }

  var tbody = document.createElement('tbody');
  var tbody_temp_thead = null;

  if(this.overflow_mode == "scrolling") {
    table_div.style.height = (this.content_height - 20)+"px";
    
    var tbody1 = table.appendChild(document.createElement('tbody'));
    var tr = tbody1.appendChild(document.createElement('tr'));
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("colspan", columns.length+1);

    var tdiv2 = td.appendChild(document.createElement('div'));
    tdiv2.setAttribute("style", "overflow-y: scroll; width:100%; ");
    tdiv2.style.height = (this.content_height - 80)+"px";
    this.table_scroll_div = tdiv2;
    
    var table2 = tdiv2.appendChild(document.createElement('table'));
    //table2.width = (this.content_width - 5)+"px";
    table2.width = "100%";
    
    tbody_temp_thead = document.createElement('thead');
    var tr = tbody_temp_thead.appendChild(document.createElement('tr'));
    //tr.setAttribute("style", "height: 1px; border-collapse:collapse; display:none;");
    for(var i=0; i<columns.length; i++) {
      var dtype_col = columns[i];
      if(!dtype_col) { continue; }
      if(!dtype_col.visible) { continue; }
      var th = tr.appendChild(document.createElement('th'));
      th.innerHTML = dtype_col.title;
    }
    table2.appendChild(tbody_temp_thead);
    table2.appendChild(tbody);
  } else { //this.overflow_mode == "paging"
    table.appendChild(tbody);
  }

  this.filter_count = 0;
  var display_list = new Array();
  if(datasourceElement.datasource_mode == "edge")    {
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(!edge.feature1) { continue; }
      if(!edge.feature2) { continue; }
      if(this.search_data_filter && this.show_only_search_matches && !edge.search_match) { continue; }
      if(this.focus_feature &&
         (this.focus_feature.id != edge.feature1_id) &&
         (this.focus_feature.id != edge.feature2_id)) { continue; }
      //TODO: maybe also implement the multi-select filter_feature_ids or some new multi-select-trigger layer
      this.filter_count++;
      display_list.push(edge);
    }
  }
  if(datasourceElement.datasource_mode == "feature") {
    //filter_count = datasourceElement.feature_array.length;
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }
      if(this.search_data_filter && this.show_only_search_matches && !feature.search_match) { continue; }
      this.filter_count++;
      display_list.push(feature);
    }
  }
  if(datasourceElement.datasource_mode == "source") {
    //filter_count = datasourceElement.feature_array.length;
    for(j=0; j<datasourceElement.sources_array.length; j++) {
      var source = datasourceElement.sources_array[j];
      if(!source) { continue; }
      if(!source.filter_valid) { continue; }
      if(this.search_data_filter && this.show_only_search_matches && !source.search_match) { continue; }
      this.filter_count++;
      display_list.push(source);
    }
  }
  if(this.filter_count == 0) {
    var tr = tbody.appendChild(document.createElement('tr'));
    var td = tr.appendChild(document.createElement('td'));
    td.innerHTML = "no data in table";
  }

  display_list.sort(this.tableSortFunc());

  var table_page_index = (this.table_page-1) * this.table_page_size;
  var table_page_size = this.table_page_size;
  if(this.overflow_mode == "scrolling") {
    table_page_index = 0;
    table_page_size = display_list.length;
  }
  
  var selected_row_idx = 0;
  var selected_row_top = 0;
  for(j=0; j<table_page_size; j++) {
    var idx_row = j+ table_page_index;
    if(idx_row >= this.filter_count) { break; }

    var edge = null;
    var feature = null;
    var source = null;

    if(datasourceElement.datasource_mode == "feature") {
      feature = display_list[idx_row];
      if(this.search_data_filter && this.show_only_search_matches && !feature.search_match) { continue; }
    }
    if(datasourceElement.datasource_mode == "edge") {
      edge = display_list[idx_row];
      if(!edge) { continue; }
      //if(!edge.feature1) { continue; }
      //if(!edge.feature2) { continue; }
      //if(this.show_only_search_matches && !edge.feature1.search_match && !edge.feature2.search_match) { continue; }
      if(this.search_data_filter && this.show_only_search_matches && !edge.search_match) { continue; }
    }
    if(datasourceElement.datasource_mode == "source") {
      source = display_list[idx_row];
      if(this.search_data_filter && this.show_only_search_matches && !source.search_match) { continue; }
    }
    if(!feature && !edge && !source) { continue; }

    var tr = tbody.appendChild(document.createElement('tr'));
    tr.className = "row";
    //tr.setAttribute("style", "white-space:nowrap;");

    //in google Chrome, can not mix onclick and onmouseover, so must use onmousedown instead
    if(feature) {
      tr.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
      tr.setAttribute("onmouseover", "zenbuTableElement_hoverInfo('"+this.elementID+"', 'feature', '"+feature.id+"');");
      tr.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    }
    if(edge) {
      tr.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ edge.id+"');");
      tr.setAttribute("onmouseover", "zenbuTableElement_hoverInfo('"+this.elementID+"', 'edge', '"+edge.id+"');");
      tr.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    }
    if(source) {
      tr.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ source.id+"');");
      tr.setAttribute("onmouseover", "zenbuTableElement_hoverInfo('"+this.elementID+"', 'source', '"+source.id+"');");
      tr.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    }

    //if(this.selected_feature && feature && (feature.id == this.selected_feature.id)) {
    //  tr.setAttribute('style', "background:rgb(230,230,230);");
    //}
    //if(this.selected_edge && edge && (edge.id == this.selected_edge.id)) {
    //  tr.setAttribute('style', "background:rgb(230,230,230);");
    //}

    var select_row = false;
    if(this.selected_id && feature && (feature.id == this.selected_id)) { select_row=true; }
    if(this.selected_id && edge && ((edge.id == this.selected_id) || (edge.feature1.id == this.selected_id) || (edge.feature2.id == this.selected_id))) { select_row=true; }
    if(this.selected_id && source && (source.id == this.selected_id)) { select_row=true; }
    if(select_row) { 
      tr.style.background = "#EBEBEB";
      selected_row_idx = j;
      selected_row_top = tr.offsetTop;
    }

    //((feature && feature.search_match) || (edge && (edge.feature1.search_match || edge.feature2.search_match)))) {
    //if(this.show_only_search_matches &&
    //   ((feature && feature.search_match) || (edge && edge.search_match) || (source && source.search_match))) {
    //  tr.style.color = "#0000D0"; //0000D0  0071EC
    //}
    if(this.search_data_filter &&
       !((feature && feature.search_match) || (edge && edge.search_match) || (source && source.search_match))) {
      tr.style.color = "#B0B0B0"; //gray out the mistmatches
    }
    
    column_count = 0;    
    for(var icol=0; icol<columns.length; icol++) {
      var dtype_col = columns[icol];
      if(!dtype_col) { continue; }
      if(!dtype_col.visible) { continue; }

      var t_object;
      if(edge) { t_object = edge;}
      if(feature) { t_object = feature;}
      if(source) { t_object = source;}
      if(edge && (/^f1\./.test(dtype_col.datatype))) { t_object = edge.feature1;}
      if(edge && (/^f2\./.test(dtype_col.datatype))) { t_object = edge.feature2;}
      
      var datatype = dtype_col.datatype;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');

      var td = tr.appendChild(document.createElement('td'));
      if(column_count==0) { td.setAttribute("style", "white-space:nowrap;"); }
      if(this.grid_lines) { td.style.border = "1px solid gray"; }
      td.colnum = column_count++;

      if(select_row && dtype_col.highlight_color) { 
        td.style.background = dtype_col.highlight_color; 
        var cl1 = new RGBColor(dtype_col.highlight_color);
        if(cl1.ok && (luminosity_contrast(cl1.r, cl1.g, cl1.b, 0,0,0) <6)) { td.style.color = "white"; }
      }
      
      if(dtype_col.col_type=="row") {
        var rowNumA = td.appendChild(document.createElement('a'));
        rowNumA.setAttribute("target", "top");
        rowNumA.setAttribute("href", "./");
        rowNumA.setAttribute("onclick", "return false;");
        rowNumA.innerHTML = idx_row+1;
        if(feature) { rowNumA.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'feature-info', '"+feature.id+"');"); }
        if(edge)    { rowNumA.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'edge-info', '"+edge.id+"');"); }
        if(source)  { rowNumA.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'source-info', '"+source.id+"');"); }
      }
      
      if(t_object && (dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) {
        //td.innerHTML = feature.name;
        var a1 = td.appendChild(document.createElement('a'));
        a1.setAttribute("target", "top");
        a1.setAttribute("href", "./");
        a1.innerHTML = t_object.name;
        if((t_object.classname=="Experiment") || (t_object.classname=="FeatureSource") || (t_object.classname=="EdgeSource")) {
          a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'source-info', '"+t_object.id+"');"); 
        } else if(t_object.classname=="Edge") {
          a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'edge-info', '"+t_object.id+"');");
        } else {
          a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'feature-info', '"+t_object.id+"');");
        }
        a1.setAttribute("onclick", "return false;");
      } else if(edge && (dtype_col.col_type == "weight")) {
        var weights = edge.weights[dtype_col.datatype];
        if(weights) { 
          var val1 = weights[0].weight;
          if(val1 != Math.floor(val1)) { val1 = val1.toPrecision(4); }
          td.innerHTML = val1;
        }
        td.setAttribute("align", "right");
        td.style.padding = "0px 5px 0px 3px";
      } else if(t_object && t_object.score && (datatype == "bedscore") && (dtype_col.col_type == "signal")) {
        td.setAttribute("align", "right");
        td.style.padding = "0px 5px 0px 3px";
        td.innerHTML = parseFloat(t_object.score);
        //td.innerHTML = parseFloat(t_object.score).toPrecision(6);
        //tspan.innerHTML = parseFloat(feature.score); 
      } else if(t_object && t_object.expression && (dtype_col.col_type == "signal")) {
        //console.log("feature "+t_object.name+" signal ["+datatype+"]");
        td.style.padding = "0px 5px 0px 3px";
        td.setAttribute("align", "right");
        for(var j2=0; j2<t_object.expression.length; j2++) {
          var expression = t_object.expression[j2];
          if(expression.datatype != datatype) { continue; }
          if(td.innerHTML != "") { td.innerHTML += " "; }
          var val1 = expression.total;
          if(val1 != Math.floor(val1)) { val1 = val1.toPrecision(4); }
          td.innerHTML = val1;
        }
      } else if(t_object && dtype_col.col_type == "mdata") {
        var val = "";
        if(t_object.mdata && t_object.mdata[datatype]) {
          var value_array = t_object.mdata[datatype];
          for(var idx1=0; idx1<value_array.length; idx1++) {
            if(val) { val += ", "; }
            val += value_array[idx1];
          }
        } else if(t_object.source && (datatype == "category")) {
          val = t_object.source.category;
        } else if(t_object.source && (datatype == "source_name")) {
          val = t_object.source.name;
        } else if(datatype == "platform") {
          val = t_object.platform;
        } else if(datatype == "import_date") {
          val = t_object.import_date;
        } else if(datatype == "owner_identity") {
          val = t_object.owner_identity;
        } else if(datatype == "owner_import_date") {
          val = "<div style='font-size:10px;'>" + t_object.owner_identity +"</div>";
          val += "<div style='font-size:10px; color:rgb(94,115,153);'>" + t_object.import_date +"</div>";
        } else if(datatype == "source_class") {
          val = t_object.classname;
        }
        if(val) { td.innerHTML = val; }
        
        if(datatype == "location_link" || datatype == "location_string") {
          var a1 = td.appendChild(document.createElement('a'));
          a1.setAttribute("target", "top");
          a1.setAttribute("href", "#");
          //a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select_location', '"+t_object.id+"');");
          a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select_location', '"+t_object.chromloc+"');");
          a1.setAttribute("onclick", "return false;");
          if(datatype == "location_link") { a1.innerHTML = dtype_col.title; }
          else { a1.innerHTML = t_object.chromloc; }
        }
      } else if(t_object && (dtype_col.col_type == "hyperlink")) {
        var a1 = td.appendChild(document.createElement('a'));
        a1.setAttribute("target", "top");
        a1.setAttribute("href", "#"+datatype);
        a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'hyperlink_trigger', '"+t_object.id+"', '"+datatype+"');");
        a1.setAttribute("onclick", "return false;");
        a1.innerHTML = dtype_col.title;
      }
    }
  }

  if(this.overflow_mode == "paging") {
    //var pagingSpan = reportElementPagingInterface(this);
    var pagingSpan = this.pagingInterface();
    tdiv = table_div.appendChild(document.createElement('div'));
    tdiv.appendChild(pagingSpan);
  }
  if(this.overflow_mode == "scrolling") {
    //draw filter count at bottom        
    var tspan = table_div.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:12px; margin-right: 10px; float:right; display:inline-block; ");
    tspan.innerHTML = this.filter_count + " rows";
    
    //transfer the column widths from the tbody.td to the th so they are lined up
    var thElements = thead.getElementsByTagName("th");
    var tdElements = tbody.getElementsByTagName("td");
    var width = [];

    tempResult = window.getComputedStyle(tbody_temp_thead, null).getPropertyValue("width");
    //thead.style.width = tempResult;
    thead.style.width = `${tempResult.toString()}`;
    //width[i] = `${tempResult.toString()}`;
    //tbody_temp_thead.setAttribute("style", "height: 1px; border-collapse:collapse; display:none;");

    for(var i = 0; i < tdElements.length; i++) {
      // get inner width because thats what we will set
      tempResult = window.getComputedStyle(tdElements[i], null).getPropertyValue("width");
      //console.log("compute td colnum:"+ tdElements[i].colnum+" width:"+tempResult+ " : "+(tdElements[i].innerHTML));
      width[tdElements[i].colnum] = tempResult;
    }
    //for(var i = 0; i < width.length; i++) { console.log("final colnum:"+ i+" width:"+(width[i])); }
    for(var i = 0; i < thElements.length; i++) {
      //console.log("set th:"+ i+" to width:"+(width[i]));
      //if(width[i]) { thElements[i].style.width = `${width[i].toString()}` ; }
      if(width[i]) { thElements[i].style.width = width[i]; }
    }
    for(var i = 0; i < tdElements.length; i++) {
      var colnum = tdElements[i].colnum;
      //console.log("compute td colnum:"+ tdElements[i].colnum+" width:"+(width[tdElements[i].colnum]));
      //if(width[tdElements[i].colnum]) { tdElements[i].style.width = width[tdElements[i].colnum]; }
      if(width[colnum]) { tdElements[i].style.width = width[colnum]; }
    }

    tbody_temp_thead.setAttribute("style", "height: 1px; border-collapse:collapse; display:none;");

    //readjust the table_scroll_div height if the header has wrapped lines
    var t_rect = thead.getBoundingClientRect();
    console.log("scrolling table header height:"+(t_rect.height));
    this.table_scroll_div.style.height = (this.content_height - 60 - t_rect.height)+"px";
    
    if(this.table_needs_to_scroll) {
      this.table_needs_to_scroll = false;
      if(this.table_scroll_div) {
        var scrollRect = this.table_scroll_div.getBoundingClientRect();
        //console.log("table_needs_to_scroll scrollRect top:"+scrollRect.top+ " height:"+scrollRect.height);
        //console.log("scroll display_list.length:"+(display_list.length)+" selected_row_idx:"+selected_row_idx+" selected_row_top:"+selected_row_top);
        var scroll_offset = Math.floor(selected_row_top-(scrollRect.height / 2));
        if(scroll_offset<0) { scroll_offset = 0; }
        console.log("table scroll to:"+scroll_offset);
        this.table_scroll_div.scrollTop = scroll_offset;
      }
    }
  }
  
  if(!this.resized && (this.overflow_mode == "paging")) {
    //double check bounds
    var mainRect = main_div.getBoundingClientRect();
    var tableRect = table_div.getBoundingClientRect();
    //if((this.overflow_mode == "paging") && (tableRect.bottom > mainRect.bottom-3)) {
    if((tableRect.bottom>0) && (tableRect.bottom > mainRect.bottom-5)) {
      var offset = Math.round(tableRect.bottom - mainRect.bottom + 7);
      this.content_height += offset;
      console.log("drawTable["+this.elementID+"] need to resize to fit tableBottom:"+tableRect.bottom+" mainBottom:"+mainRect.bottom + " offset:"+offset+" new content_height:"+this.content_height);
      main_div.style.height = this.content_height +"px";
    }
  }
}


function zenbuTableElement_hoverInfo(elementID, classType, objID) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.show_hover_info) { return; }

  var datasourceElement = reportElement.datasource();
  if(!datasourceElement) { return; }
  
  var object = null;
  if(classType == "edge") {
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(edge.id == objID) { object = edge; break; }
    }
  }
  if(classType == "feature") {
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(feature.id == objID) { object = feature; break; }
    }
  }
  if(classType == "source") {
    for(j=0; j<datasourceElement.sources_array.length; j++) {
      var source = datasourceElement.sources_array[j];
      if(!source) { continue; }
      if(source.id == objID) { object = source; break; }
    }
  }

  zenbuReports_hoverInfo(reportElement, object);  
}


function zenbuTableElement_pagingInterface() {
  if(!this.main_div) { return; }
  
  var datasourceElement = this.datasource();
  
  var content_width = this.content_width;
  
  //interface changes at content_width: 750 700 670 630 570 500 400 320 300 250
  
  //var num_pages = Math.ceil(this.filter_count / Math.floor(this.table_page_size));
  //this.table_num_pages = num_pages;
  //this.table_page = 1;
  //console.log("zenbuTableElement_pagingInterface "+this.elementID+" filter_count= "+this.filter_count+" page_size["+this.table_page_size+"]  num_pages"+this.table_num_pages+"]  table_page["+this.table_page+"]")
  
  //var page = Math.ceil(this.table_page_index / this.table_page_size) + 1;
  if(this.table_page < 1) { this.table_page = 1; }
  var page = this.table_page;
  var table_page_index = (this.table_page-1) * this.table_page_size;
  //console.log("zenbuTableElement_pagingInterface page_size["+this.table_page_size+"] table_page_index="+table_page_index+", page="+this.table_page);
  
  var pagingSpan = document.createElement('span');
  
  pagingSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  
  //num rows is on right side, but because of floats, I need to put it before the other elements
  var span5 = pagingSpan.appendChild(document.createElement('span'));
  span5.setAttribute('style', "margin-right: 10px; float:right; display:inline-block; ");
  var tspan = span5.appendChild(document.createElement('span'));
  //tspan.innerHTML = "filtered " + this.filter_count + " / " + this.raw_count;
  //tspan.innerHTML = this.filter_count + " "+datasourceElement.datasource_mode+"s";
  tspan.innerHTML = this.filter_count + " rows";
  
  var tspan = pagingSpan.appendChild(document.createElement('a'));
  tspan.setAttribute('style', "color:purple; text-decoration:underline;");
  tspan.setAttribute('href', "./");
  tspan.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'previous-page'); return false");
  if(content_width<570) { tspan.innerHTML = "<<"; }
  else if(content_width<750) { tspan.innerHTML = "<< previous"; }
  else { tspan.innerHTML = "<< previous page"; }
  
  if(content_width>=300) {
    var tspan2 = pagingSpan.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin-left: 5px; font-weight:bold; display:inline-block;");
    if(content_width<670) { tspan2.innerHTML = "page"; } else { tspan2.innerHTML = "| Page: "; }
  }
  
  var start_page = 1;
  var end_page = 10;
  if(content_width<700) { end_page=8; }
  if(content_width<630) { end_page=6; }
  if(content_width<500) { end_page=0; }
  
  if(page >= Math.ceil(end_page*0.7)) {
    var span2 = pagingSpan.appendChild(document.createElement('a'));
    span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline; display:inline-block; min-width:20px;");
    if(content_width<320) { span2.style.minWidth = "10px"; }
    span2.setAttribute('href', "./");
    span2.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'page', \"1\"); return false");
    span2.innerHTML = 1;
    
    var span2 = pagingSpan.appendChild(document.createElement('span'));
    span2.setAttribute('style', "margin-left: 2px; display:inline-block; min-width:20px;");
    if(content_width<320) { span2.style.marginLeft = "0px"; span2.style.minWidth = "12px"; }
    span2.innerHTML = "...";
    
    if(content_width<500) {
      start_page = page;
      end_page = 0;
    } else if(content_width<630) {
      start_page = page - 1;
      end_page = start_page +3;
    } else if(content_width<700) {
      start_page = page - 2;
      end_page = start_page +5;
    } else {
      start_page = page - 3;
      end_page = start_page +7;
    }
  }
  for(var j=start_page; j<end_page; j++) {
    if(j>this.table_num_pages) { break; }
    var span2 = pagingSpan.appendChild(document.createElement('a'));
    span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline; display:inline-block; min-width:20px;");
    if(j == page) { span2.setAttribute('style', "margin-left: 4px; color:black; font-weight:bold; display:inline-block; min-width:20px;"); }
    span2.setAttribute('href', "./");
    span2.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'page', \"" +j+ "\"); return false");
    span2.innerHTML = j;
  }
  if(j<=this.table_num_pages) {
    if((content_width>=500) && (j+1<this.table_num_pages)) {
      var span2 = pagingSpan.appendChild(document.createElement('span'));
      span2.setAttribute('style', "margin-left: 4px; display:inline-block; min-width:20px;");
      if(content_width<320) { span2.style.marginLeft = "0px"; span2.style.minWidth = "10px"; }
      span2.innerHTML = "...";
    }
    if(j+1 == this.table_num_pages) {
      span2 = pagingSpan.appendChild(document.createElement('a'));
      span2.setAttribute('href', "./");
      span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline; display:inline-block; min-width:20px;");
      //if(content_width<500) { span2.style.minWidth = "20px"; } else { span2.style.minWidth = "25px"; }
      span2.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'page', \"" +(this.table_num_pages-1)+ "\"); return false");
      span2.innerHTML = this.table_num_pages-1;
    }
    span2 = pagingSpan.appendChild(document.createElement('a'));
    span2.setAttribute('href', "./");
    span2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline; display:inline-block; min-width:20px;");
    span2.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'page', \"" +this.table_num_pages+ "\"); return false");
    span2.innerHTML = this.table_num_pages;
  }
  
  if(content_width>=500) {
    var tspan3 = pagingSpan.appendChild(document.createElement('span'));
    tspan3.setAttribute('style', "margin-left: 4px; color:black; font-weight:bold;");
    tspan3.innerHTML = "|";
  }
  
  var tspan4 = pagingSpan.appendChild(document.createElement('a'));
  tspan4.setAttribute('href', "./");
  tspan4.setAttribute('style', "margin-left: 4px; font-family:arial,helvetica,sans-serif; color:purple; text-decoration:underline;");
  tspan4.setAttribute("onclick", "reportElementEvent(\""+this.elementID+"\", 'next-page');return false");
  if(content_width<570) { tspan4.innerHTML = ">>"; }
  else if(content_width<750) { tspan4.innerHTML = "next >>"; }
  else { tspan4.innerHTML = "next page >>"; }
  
  if(content_width>=250) {
    var span3 = pagingSpan.appendChild(document.createElement('span'));
    span3.setAttribute('style', "margin-left: 15px; ");
    var tspan = span3.appendChild(document.createElement('span'));
    tspan.innerHTML = "page: ";
    var input = span3.appendChild(document.createElement('input'));
    input.setAttribute("style", "font-size:12px; width:35px; padding: 1px 2px; margin: 3px 0px; box-sizing: border-box; border: 1px solid gray; border-radius: 4px;");
    input.setAttribute('type', "text");
    input.setAttribute('value', this.table_page);
    input.setAttribute("onchange", "reportElementEvent(\""+this.elementID+"\", 'page', this.value); return false;");
  }
  if(content_width>=400) {
    var span3 = pagingSpan.appendChild(document.createElement('span'));
    span3.setAttribute('style', "margin-left: 5px; ");
    var tspan = span3.appendChild(document.createElement('span'));
    tspan.innerHTML = "rows: ";
    var input = span3.appendChild(document.createElement('input'));
    input.setAttribute("style", "font-size:12px; width:35px; padding: 1px 2px; margin: 3px 0px; box-sizing: border-box; border: 1px solid gray; border-radius: 4px;");
    input.setAttribute('type', "text");
    input.setAttribute('value', this.table_page_size);
    input.setAttribute("onchange", "reportElementEvent(\""+this.elementID+"\", 'page-size', this.value); return false;");
  }
  
  /*
   var span5 = pagingSpan.appendChild(document.createElement('span'));
   span5.setAttribute('style', "margin-right: 10px; float:right; display:inline-block; ");
   var tspan = span5.appendChild(document.createElement('span'));
   //tspan.innerHTML = "filtered " + this.filter_count + " / " + this.raw_count;
   tspan.innerHTML = this.filter_count + " rows";
   */
  
  /*
   var collabSelect = collabWidget.appendChild(document.createElement('select'));
   collabSelect.setAttribute('name', "datatype");
   collabSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
   collabSelect.setAttribute("onchange", "dexCollaborationMoveEvent(this.value);");
   collabSelect.innerHTML = ""; //to clear old content
   
   if(object.collaboration) {
   var option = collabSelect.appendChild(document.createElement('option'));
   option.setAttribute("value", "private");
   if(object.collaboration.uuid == "private") { option.setAttributeNS(null, "selected", "selected"); }
   option.innerHTML = "private";
   */
  
  return pagingSpan;
}


//==========  Table configuration  =======================================================================

function zenbuTableElement_configSubpanel() {
  if(!this.config_options_div) { return; }

  var datasourceElement = this.datasource();

  var configdiv = this.config_options_div;
  
  //tdiv = configdiv.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "width:90%; margin: 0px 4px 4px 4px; white-space: pre-wrap;");
  //tdiv.innerHTML = "TODO: need some interface for column order and selecting active columns from metadata, and datatypes";

  
  var labelDiv = configdiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="Visualization:";

  //-----
  div1 = configdiv.appendChild(document.createElement('div'));
  div1.appendChild(document.createTextNode("overflow mode:"));
  div1.setAttribute('style', "margin-left:5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  
  var overflow_mode = this.overflow_mode;
  if(this.newconfig && this.newconfig.overflow_mode != undefined) { overflow_mode = this.newconfig.overflow_mode; }

  radio1 = div1.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_overflow_mode");
  radio1.setAttribute("value", "scrolling");
  if(overflow_mode == "scrolling") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'overflow_mode', this.value);");
  tspan = div1.appendChild(document.createElement('span'));
  tspan.innerHTML = "scrolling";
  
  radio2 = div1.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio2.setAttribute("name", this.elementID + "_overflow_mode");
  radio2.setAttribute("value", "paging");
  if(overflow_mode == "paging") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'overflow_mode', this.value);");
  tspan = div1.appendChild(document.createElement('span'));
  tspan.innerHTML = "paging";
  
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin-top: 5px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_hover_info;
  if(this.newconfig && this.newconfig.show_hover_info != undefined) { val1 = this.newconfig.show_hover_info; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_hover_info', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show hover info panel";

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 10px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.grid_lines;
  if(this.newconfig && this.newconfig.grid_lines != undefined) { val1 = this.newconfig.grid_lines; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'grid_lines', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "grid lines";

  configdiv.appendChild(document.createElement('hr'));

  return configdiv;

}


//=================================================================================
//
// helper functions
//
//=================================================================================
/*
function reports_table_column_order_func(a,b) {
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
*/

function  zenbuTableElement_tableSortFunc() {
  var sort_rev = false;
  if(this.sort_reverse) { sort_rev = true; }
  var search_match_to_top = false;
  if(this.move_selection_to_top) { search_match_to_top = true; }
  if(this.move_search_match_to_top) { search_match_to_top = true; }

  var datasourceElement = this.datasource();
  
  var colname = this.sort_col;
  if(!colname) { return name_func; }
  
  var datatype = colname;
  datatype = datatype.replace(/^f1\./, '');
  datatype = datatype.replace(/^f2\./, '');
  console.log("tableSortFunc for colname["+colname+"] -> datatype ["+datatype+"]");
  
  //feature sort functions
  var name_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    if(search_match_to_top) {
      if(a.search_match && !b.search_match) { return -1; }
      if(!a.search_match && b.search_match) { return 1; }
    }
    if(a.name && b.name && a.name.toLowerCase() < b.name.toLowerCase()) { res = -1; }
    if(a.name && b.name && a.name.toLowerCase() > b.name.toLowerCase()) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }
  
  var feature_mdata_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    if(search_match_to_top) {
      if(a.search_match && !b.search_match) { return -1; }
      if(!a.search_match && b.search_match) { return 1; }
    }
    var a_md = a.mdata[datatype];
    var b_md = b.mdata[datatype];
    if(datatype=="import_date") { a_md = parseInt(a.import_timestamp); b_md = parseInt(b.import_timestamp); }
    if(datatype=="owner_identity") { a_md = a.owner_identity; b_md = b.owner_identity; }
    if(datatype=="owner_import_date") { a_md = a.import_timestamp; b_md = b.import_timestamp; }
    if(datatype=="platform") { a_md = a.platform; b_md = b.platform; }
    if(datatype=="source_class") { a_md = a.classname; b_md = b.classname; }
    if(!a_md) { return 1; }
    if(!b_md) { return -1; }
    if(a_md && a_md[0]) { a_md = a_md[0].toLowerCase(); }
    if(b_md && b_md[0]) { b_md = b_md[0].toLowerCase(); }
    if(a_md < b_md) { res = -1; }
    if(a_md > b_md) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }
  
  //edge sort functions
  var edge_name_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    var af = a;
    var bf = b;
    if(colname.match(/^f1\./)) { af = a.feature1; bf = b.feature1; }
    if(colname.match(/^f2\./)) { af = a.feature2; bf = b.feature2; }
    if(!af) { return 1; }
    if(!bf) { return -1; }
    if(search_match_to_top) {
      if(af.search_match && !bf.search_match) { return -1; }
      if(!af.search_match && bf.search_match) { return 1; }
    }
    if(af.name.toLowerCase() < bf.name.toLowerCase()) { res = -1; }
    if(af.name.toLowerCase() > bf.name.toLowerCase()) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }
  
  var edge_mdata_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    var af = a;
    var bf = b;
    if(colname.match(/^f1\./)) { af = a.feature1; bf = b.feature1; }
    if(colname.match(/^f2\./)) { af = a.feature2; bf = b.feature2; }
    if(!af) { return 1; }
    if(!bf) { return -1; }
    if(search_match_to_top) {
      if(af.search_match && !bf.search_match) { return -1; }
      if(!af.search_match && bf.search_match) { return 1; }
    }
    //var a_val = "";
    //var b_val = "";
    var a_md = af.mdata[datatype];
    var b_md = bf.mdata[datatype];
    if(!a_md) { return 1; }
    if(!b_md) { return -1; }
    if(a_md && a_md[0]) { a_md = a_md[0].toLowerCase(); }
    if(b_md && b_md[0]) { b_md = b_md[0].toLowerCase(); }
    //if(!a_val) { return 1; }
    //if(!b_val) { return -1; }
    if(a_md < b_md) { res = -1; }
    if(a_md > b_md) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }
  
  var edge_weight_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    if(search_match_to_top) {
      if(a.search_match && !b.search_match) { return -1; }
      if(!a.search_match && b.search_match) { return 1; }
    }    
    if(!a.weights[colname]) { return 1; }
    if(!b.weights[colname]) { return -1; }
    var val_a = 0;
    var weight = a.weights[colname][0];
    if(weight) { val_a = weight.weight;}
    
    var val_b = 0;
    var weight = b.weights[colname][0];
    if(weight) { val_b = weight.weight;}
    
    if(val_a < val_b) { res = -1; }
    if(val_a > val_b) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }

  var feature_expression_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    if(search_match_to_top) {
      if(a.search_match && !b.search_match) { return -1; }
      if(!a.search_match && b.search_match) { return 1; }
    }
    var val_a = 0;
    var val_b = 0;

    if(datatype=="bedscore") {
      if(a.score) { val_a = a.score; }
      if(b.score) { val_b = b.score; }
    } else {
      if(!a.expression_hash) { return 1; }
      if(!b.expression_hash) { return -1; }
      if(!a.expression_hash[colname]) { return 1; }
      if(!b.expression_hash[colname]) { return -1; }
      var signal = a.expression_hash[colname][0];
      if(signal) { val_a = signal.total;}
      var signal = b.expression_hash[colname][0];
      if(signal) { val_b = signal.total;}
    }
    
    if(val_a < val_b) { res = -1; }
    if(val_a > val_b) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }
  
  var edge_feature_expression_func = function(a,b) {
    var res =0;
    if(!a) { return 1; }
    if(!b) { return -1; }
    var af = null;
    var bf = null;
    if(colname.match(/^f1\./)) { af = a.feature1; bf = b.feature1; }
    if(colname.match(/^f2\./)) { af = a.feature2; bf = b.feature2; }
    if(!af) { return 1; }
    if(!bf) { return -1; }
    if(search_match_to_top) {
      if(af.search_match && !bf.search_match) { return -1; }
      if(!af.search_match && bf.search_match) { return 1; }
    }
    var val_a = 0;
    var val_b = 0;

    if(datatype=="bedscore") {
      if(af.score) { val_a = af.score; }
      if(bf.score) { val_b = bf.score; }
    } else {
      if(!af.expression_hash) { return 1; }
      if(!bf.expression_hash) { return -1; }
      if(!af.expression_hash[datatype]) { return 1; }
      if(!bf.expression_hash[datatype]) { return -1; }
      var signal = af.expression_hash[datatype][0];
      if(signal) { val_a = signal.total;}
      var signal = bf.expression_hash[datatype][0];
      if(signal) { val_b = signal.total;}
    }
    
    if(val_a < val_b) { res = -1; }
    if(val_a > val_b) { res =  1; }
    if(sort_rev) { res = -1 * res; }
    return res;
  }

  if(!this) { return name_func; }
  
  if((datasourceElement.datasource_mode == "feature") || (datasourceElement.datasource_mode == "source")) {
    if(datatype == "name") { return name_func; }
    
    var dtype_col = this.datatypes[colname];
    if(!dtype_col) {
      //console.log("could not find datatype ["+colname+"]");
      return name_func;
    }
    if(dtype_col.col_type == "mdata") {
      return feature_mdata_func;
    }
    if(dtype_col.col_type == "signal") {
      return feature_expression_func;
    }
    
    return name_func;
  }
  
  if(datasourceElement.datasource_mode == "edge") {
    if(datatype == "name") { return edge_name_func; }
    
    var dtype_col = this.datatypes[colname];
    if(!dtype_col) {
      //console.log("could not find datatype ["+colname+"]");
      return edge_name_func;
    }
    if(dtype_col.col_type == "signal") {
      return edge_feature_expression_func;
    }

    if(dtype_col.col_type == "mdata") {
      //console.log("return edge_mdata_func");
      return edge_mdata_func;
    }
    if(dtype_col.col_type == "weight") {
      //console.log("return edge_weight_func");
      return edge_weight_func;
    }
    return edge_name_func;
  }
  
  return name_func;
}



