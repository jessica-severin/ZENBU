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


//var element = new ZenbuTreeListElement();

function ZenbuTreeListElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuTreeListElement");
  this.element_type = "treelist";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  //zenbuElement_init.call(this); //eventually when I refactor the superclass Element into object code

  this.title_prefix = "";
  this.datasource_mode = "feature";
  this.title = "new TreeList";
  this.sort_col = "name";
  this.sort_reverse = false;
  this.move_selection_to_top=true;
  this.show_hover_info = false;
  this.radio_list = false;
  this.font_size = 10;
  this.show_table_header = false;

  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;
  
  //methods
  this.initFromConfigDOM  = zenbuTreeListElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuTreeListElement_generateConfigDOM;  //returns a ConfigDOM object

  this.elementEvent       = zenbuTreeListElement_elementEvent;
  this.reconfigureParam   = zenbuTreeListElement_reconfigureParam;

  this.resetElement       = zenbuTreeListElement_reset;
  this.postprocessElement = zenbuTreeListElement_postprocess;
  this.drawElement        = zenbuTreeListElement_draw;
  this.configSubpanel     = zenbuTreeListElement_configSubpanel;

  //internal methods
  this.postprocessEdges   = zenbuTreeListElement_postprocessEdges;
  this.tableSortFunc      = zenbuTableElement_tableSortFunc;
  return this;
}


//=================================================================================
//TODO: need to figure this out, not currently using

function zenbuTreeListElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "treelist") { return false; }
  
  //eventually maybe a superclass init call here
  
  if(elementDOM.getAttribute("sort_col")) {  this.sort_col = elementDOM.getAttribute("sort_col"); }
  if(elementDOM.getAttribute("sort_reverse") == "true") { this.sort_reverse = true; }
  if(elementDOM.getAttribute("move_selection_to_top") == "true") { this.move_selection_to_top = true; }
  if(elementDOM.getAttribute("show_hover_info") == "true") { this.show_hover_info = true; }
  if(elementDOM.getAttribute("show_table_header") == "true") { this.show_table_header = true; }
  this.radio_list = false;
  if(elementDOM.getAttribute("radio_list")=="true") { this.radio_list = true; }
  return true;
}


function zenbuTreeListElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.sort_col) { elementDOM.setAttribute("sort_col", this.sort_col); }
  if(this.sort_reverse) { elementDOM.setAttribute("sort_reverse", "true"); }
  if(this.move_selection_to_top) { elementDOM.setAttribute("move_selection_to_top", "true"); }  //treelist
  if(this.show_hover_info) { elementDOM.setAttribute("show_hover_info", "true"); }
  if(this.show_table_header) { elementDOM.setAttribute("show_table_header", "true"); }
  if(this.radio_list) { elementDOM.setAttribute("radio_list", "true"); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuTreeListElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this.datasource();
  if(mode == "column_sort") {
    if(this.sort_col == value) {
      this.sort_reverse = !this.sort_reverse;
    }
    this.sort_col = value;
    //reportsPostprocessElement(this.elementID);
    reportsDrawElement(this.elementID);
  }
}

function zenbuTreeListElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  //eventually a superclass method here, but for now a hybrid function=>obj.method approach
  if(param == "move_selection_to_top") { this.newconfig.move_selection_to_top = value; }
  if(param == "show_hover_info")       { this.newconfig.show_hover_info = value; }
  if(param == "show_table_header")     { this.newconfig.show_table_header = value; }
  if(param == "radio_list") { 
    this.newconfig.radio_list = value; 
    if(value) { this.newconfig.move_selection_to_top = true; }
  }

  if(param == "accept-reconfig") {
    //this.needReload=true;
    if(this.newconfig.move_selection_to_top !== undefined) { this.move_selection_to_top = this.newconfig.move_selection_to_top; }
    if(this.newconfig.show_hover_info !== undefined) { this.show_hover_info = this.newconfig.show_hover_info; }
    if(this.newconfig.show_table_header !== undefined) { this.show_table_header = this.newconfig.show_table_header; }
    if(this.newconfig.radio_list !== undefined) { this.radio_list = this.newconfig.radio_list; }
  }
}


//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuTreeListElement_reset() {
  //console.log("zenbuTreeListElement_reset ["+this.elementID+"]");
  
  //clear previous loaded data
  //this.features = new Object();
  //this.feature_array = new Array();
  //this.edge_array = new Array();
  //this.edge_count = 0;
  
  //clear previous target
  //this.selected_id = ""; //selected row in the table
  //this.selected_feature = null; //selected row in the table
}


function zenbuTreeListElement_postprocess() {
  //treelist does not append to title
  this.title = this.title_prefix;

  var datasourceElement = this.datasource();
  
  if(datasourceElement.datasource_mode == "edge") {
    //reportsPostprocessTreeListEdges(this);
    this.postprocessEdges();
  }
  //no need to extra postprocessing of datasource="feature" since they can only be displayed as a list

  if(this.radio_list && !this.selected_feature) {
    //must have a selection if in radio mode
    if(this.feature_array.length>0) { 
      this.selected_feature = this.feature_array[0];
    }
  }
}


function zenbuTreeListElement_postprocessEdges() {
  var starttime = new Date();
  
  var elementID = this.elementID;
  console.log("reportElementPostprocessTreeListEdges: " + elementID);
  
  var datasourceElement = this.datasource();

  var feature_count = this.feature_array.length;
  var edge_count    = this.edge_array.length;
  //console.log("reportElementPostprocessTreeListEdges: " + feature_count+ " features, " + edge_count+" edges");
  
  if(this.focus_feature) {
    if(!this.selected_feature && !this.radio_list) { this.selected_feature = this.focus_feature; }
    console.log("reportElementPostprocessTreeListEdges start focus["+this.focus_feature.name+"]");
  }
  
  //Idea here is to search the graph of edges for root nodes and sort the edges into a tree from there
  //on load each feature has  feature.f1_edge_count and feature.f2_edge_count set
  //f1_edge_count==0 means a leaf since this feature not connected out to any edges
  //f2_edge_count==0 means a root node since this feature not connected in by any edges
  var parent = null;
  var fidx1=0, k=0;
  for(var k=0; k<this.feature_array.length; k++) {
    var feature = this.feature_array[k];
    if(!feature) { continue; }
    feature.edge_node_type = "";
    feature.tree_level=0;
    if(feature.f1_edge_count==0) { feature.edge_node_type = "leaf"; }
    if(feature.f2_edge_count==0) { feature.edge_node_type = "root"; }
    if(feature.f1_edge_count==0 && feature.f2_edge_count==0) { feature.edge_node_type = "orphan"; }
    //console.log("reportElementPostprocessTreeListEdges features "+feature.name+ ","+feature.category+","+feature.source.name+" f1_edge_count:"+feature.f1_edge_count+"  f2_edge_count:"+feature.f2_edge_count+ " "+feature.edge_node_type);
    feature.internal_id = k;
    //console.log("reportElementPostprocessTreeListEdges features "+feature.name+ ","+feature.category+","+feature.source_name+" f1_edge_count:"+feature.f1_edge_count+"  f2_edge_count:"+feature.f2_edge_count+ " "+feature.edge_node_type);
  }
  
  //first move all the root edges to the front and sort everything by name
  this.edge_array.sort(reports_treelist_edge_root_sort_func);
  
  if(this.radio_list && !this.selected_feature) {
    //must have a selection if in radio mode
    if(this.edge_array.length>0) { 
      this.selected_feature = this.edge_array[0].feature2;
    }
  }

  //main loop work from each root on down
  var eidx1=0, eidx2=0, idx_insert=0;
  while(eidx1<this.edge_array.length) {
    var edge1 = this.edge_array[eidx1];
    if(!edge1) { eidx1++; continue; }
    edge1.feature2.tree_level = edge1.feature1.tree_level+1;
    //console.log("eidx1="+eidx1+" f1["+ edge1.feature1.name+"]-"+edge1.feature1.tree_level+"  f2["+edge1.feature2.name+"]-"+edge1.feature2.tree_level);
    
    //loop through the remaining edges and move any edge where edge1.feature2_id == edge2.feature1_id up below edge1
    idx_insert = eidx1+1; //insert children after eidx1
    for(var eidx2=eidx1+1; eidx2<this.edge_array.length; eidx2++) {
      var edge2 = this.edge_array[eidx2];
      if(!edge2) { continue; }
      
      if(edge1.feature2_id == edge2.feature1_id) {
        //console.log("found child f1["+edge2.feature1.name+"]  f2["+edge2.feature2.name+"]");
        if(eidx2!=idx_insert) {
          //console.log("move child from "+eidx2+" to "+idx_insert);
          this.edge_array.splice(eidx2, 1); //remove edge2 from current position
          this.edge_array.splice(idx_insert, 0, edge2); //insert back at idx_insert and shifts everything down
        }
        idx_insert++;
      }
    }
    
    eidx1++;
  }
  
  //TODO: might need to check the filter_valid and search_match flags here if user wants that option
  for(var k=0; k<this.edge_array.length; k++) {
    var edge = this.edge_array[k];
    if(!edge) { continue; }
    edge.internal_id = k;
  }
  this.filter_count = this.edge_array.length;
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("reportsPostprocessTreeListEdges " +(runtime)+"msec");
}



function zenbuTreeListElement_draw() {
  var main_div = this.main_div;
  if(!main_div) { return; }
  
  var datasourceElement = this.datasource();
  
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 15;
  width = width - 10;
  
  var tdiv, tspan, tinput, ta;
  //now search the edges/features and display the targets and ASOs
  
  //get the visible columns in order
  var columns = new Array();
  for(var dtype in this.datatypes) {
    var dtype_col = this.datatypes[dtype];
    if(dtype_col) { columns.push(dtype_col); }
  }
  columns.sort(reports_column_order_sort_func);
  
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
  if(this.filter_count == 0) { //use the query feature
    var load_info = main_div.appendChild(document.createElement('div'));
    load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    load_info.innerHTML = "no data...";
    return;
  }

  //TODO: special sort for treelist here
  display_list.sort(this.tableSortFunc());

  if(this.move_selection_to_top && (display_list.length>0) && this.selected_feature) {
    //start search from 1 since 0 is already at top and don't need to change
    if(datasourceElement.datasource_mode == "edge" && this.radio_list) {
      for(j=1; j<display_list.length; j++) {
        var edge = display_list[j];
        if(edge && (edge.feature1.id == this.selected_feature.id || edge.feature2.id == this.selected_feature.id)) {
          display_list.splice(0, 0, display_list.splice(j, 1)[0]);
          break;
        }
      }
    } else {
      for(j=1; j<display_list.length; j++) {
        var feature = display_list[j];
        if(feature && (feature.id == this.selected_feature.id)) {
          display_list.splice(0, 0, display_list.splice(j, 1)[0]);
          break;
        }
      }
    }
  }

  
  var list_div = main_div.appendChild(document.createElement('div'));
  style = "overflow-y:scroll; ";
  style += "height: "+ ( height-20)+"px; ";
  list_div.setAttribute('style', style);
  if(this.font_size) { list_div.style.fontSize = this.font_size+"px"; }
  list_div.innerHTML = "";
  
  var table = list_div.appendChild(document.createElement('table'));
  table.setAttribute("style", "border-collapse: collapse;");
  table.setAttribute("width", "100%");
  
  if(this.show_table_header) {
    var thead = table.appendChild(document.createElement('thead'));
    var tr = thead.appendChild(document.createElement('tr'));
    if(this.radio_list) { tr.appendChild(document.createElement('td')); }
    for(var i=0; i<columns.length; i++) {
      var dtype_col = columns[i];
      if(!dtype_col) { continue; }
      if(!dtype_col.visible) { continue; }
      var th = tr.appendChild(document.createElement('th'));
      if(this.sort_col == dtype_col.datatype) { th.setAttribute('style', "color:green;"); }
      if(this.grid_lines) { th.style.borderLeft = "1px solid gray"; }
      //th.setAttribute("onmousedown", "reportElementTableEvent(\""+this.elementID+"\", 'sort', '"+dtype_col.datatype+"');");
      //th.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'column_sort', '"+dtype_col.datatype+"');");
      th.setAttribute("onmousedown", "if(event.button==2 || event.altKey) { reportElementColumnsInterface(\""+this.elementID+ "\"); } else { reportElementEvent(\""+ this.elementID +"\", 'column_sort', '"+dtype_col.datatype+"'); }");
      th.innerHTML = dtype_col.title;
      //th.setAttribute("ondblclick", "reportElementColumnsInterface((\""+this.elementID+"\");");
      //th.setAttribute("ondblclick", "reportsGeneralWarn('yep I can capture double-click, I will use this for column rename'); return false");
      //TODO: need to use the column_sort event and check for right-click or dblclick before sorting
    }
  }
  var tbody = table.appendChild(document.createElement('tbody'));
  
  var idx_row = 0;
  var draw_root=false;
  var current_root = null;
  while(idx_row<display_list.length) {
    var edge = null;
    var feature = null;
    var source = null;
    
    if(datasourceElement.datasource_mode == "feature") {
      feature = display_list[idx_row];
      if(this.search_data_filter && this.show_only_search_matches && !feature.search_match) { idx_row++; continue; }
    }    
    if(datasourceElement.datasource_mode == "edge") {
      edge = display_list[idx_row];
      if(!edge) { idx_row++; continue; }
      if(!edge.feature1) { idx_row++; continue; }
      if(!edge.feature2) { idx_row++; continue; }
      if(this.search_data_filter && this.show_only_search_matches && !edge.search_match) { idx_row++; continue; }
      if(!draw_root && !this.radio_list && edge.feature1.edge_node_type == "root" && (!current_root || current_root.id != edge.feature1.id)) {
        feature = edge.feature1;
        current_root = feature;
        draw_root=true;
      } else {
        feature = edge.feature2;
        draw_root=false;
      }
    }
    if(datasourceElement.datasource_mode == "source") {
      source = display_list[idx_row];
      if(this.search_data_filter && this.show_only_search_matches && !source.search_match) { idx_row++; continue; }
    }
    if(!feature && !edge && !source) { idx_row++; continue; }
      
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.className = "row";
    //in google Chrome, can not mix onclick and onmouseover, so must use onmousedown instead
    //tr.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
    tr.setAttribute("onmousedown", "if(event.button==2 || event.altKey) { reportElementColumnsInterface(\""+this.elementID+ "\"); } else { reportElementEvent(\""+ this.elementID +"\", 'select', '"+feature.id+"'); }");
    if(feature) {
      //tr.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
      tr.setAttribute("onmouseover", "zenbuTableElement_hoverInfo('"+this.elementID+"', 'feature', '"+feature.id+"');");
      tr.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    }

    var rowstyle = "padding:0; ";
    if(this.selected_feature && (feature.id == this.selected_feature.id)) {
      rowstyle += "background:rgb(220,220,220);";
    }
    if(this.show_only_search_matches) {
      if(feature.search_match) { rowstyle += "color:#0000D0;"; }
      else { rowstyle += "color:lightgray;" }
    }
    tr.setAttribute("style", rowstyle);
    if(this.search_data_filter &&
       !((feature && feature.search_match) || (edge && edge.search_match) || (source && source.search_match))) {
      tr.style.color = "#B0B0B0"; //gray out the mistmatches
    }

    if(this.radio_list) {
      var td = tr.appendChild(document.createElement('td'));
      tcheck = td.appendChild(document.createElement('input'));
      //tcheck.setAttribute('type', "checkbox");
      tcheck.setAttribute('type', "radio");
      tcheck.setAttribute("name", this.main_div_id + "_radio_list");
      tcheck.setAttribute('style', "margin:0px 0px 0px 0px; padding:0px 0px;");
      //tcheck.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+feature.id+"'); return false");
      if(this.selected_feature && (feature.id == this.selected_feature.id)) {
        tcheck.setAttribute('checked', "checked");
        //tdiv.style.backgroundColor = "#F0F0F0";   //"E8E8E8";
      }
    }
    
    for(var icol=0; icol<columns.length; icol++) {
      var dtype_col = columns[icol];
      if(!dtype_col) { continue; }
      if(!dtype_col.visible) { continue; }
      
      var datatype = dtype_col.datatype;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');
      
      var td = tr.appendChild(document.createElement('td'));
      //if(column_count==0) { td.setAttribute("style", "white-space:nowrap;"); }
      //if(this.grid_lines) { td.style.border = "1px solid gray"; }
      var span1 = td.appendChild(document.createElement('span'));
      if(icol==0) {
        var indent = 5;
        if(feature.tree_level) { indent = 5+ 10*(feature.tree_level); }
        span1.setAttribute("style", "display:inline-block; margin-left: "+indent+"px;");
      } else {
        span1.setAttribute("style", "display:inline-block; margin-left: 3px;");
      }
      if(datatype == "name") {
        var a1 = span1.appendChild(document.createElement('a'));
        a1.setAttribute("target", "top");
        a1.setAttribute("href", "./");
        a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'feature-info', '"+feature.id+"');");
        a1.setAttribute("onclick", "return false;");
        a1.innerHTML = feature.name;
      } else if(edge && (dtype_col.col_type == "weight")) {
        var weights = edge.weights[datatype];
        if(weights) {
          span1.innerHTML = weights[0].weight.toPrecision(4);
        }
      } else if(dtype_col.col_type == "mdata") {
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
        if(val) { span1.innerHTML = val; }
        
        if(datatype == "location_link") {
          var a1 = span1.appendChild(document.createElement('a'));
          a1.setAttribute("target", "top");
          a1.setAttribute("href", "#");
          //a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select_location', '"+feature.id+"');");
          a1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select_location', '"+feature.chromloc+"');");
          a1.setAttribute("onclick", "return false;");
          a1.innerHTML = dtype_col.title;
        }
        //if(this.radio_list) { span1.setAttribute("style", ""); }
      }
    }
    if(!draw_root) { idx_row++; }
  }
  //load_info.innerHTML = filter_count +" differentially expressed genes";
}


function zenbuTreeListElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();
  
  //-----
  div1 = configdiv.appendChild(document.createElement('div'));
  var datasource_mode = datasourceElement.datasource_mode;
  if(this.newconfig && this.newconfig.datasource_mode != undefined) { datasource_mode = this.newconfig.datasource_mode; }
  if(datasource_mode == "feature") {
    tcheck = div1.appendChild(document.createElement('input'));
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("style", "margin-left: 5px;");
    var move_selection_to_top = this.move_selection_to_top;
    if(this.newconfig && this.newconfig.move_selection_to_top != undefined) { move_selection_to_top = this.newconfig.move_selection_to_top; }
    if(move_selection_to_top) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'move_selection_to_top', this.checked);");
    tspan = div1.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin-right:15px;");
    //tspan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    tspan.innerHTML = "move selection to top";
  }
  
  tcheck = div1.appendChild(document.createElement('input'));
  tcheck.setAttribute("style", "margin-left: 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_table_header;
  if(this.newconfig && this.newconfig.show_table_header != undefined) { val1 = this.newconfig.show_table_header; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_table_header', this.checked);");
  tspan2 = div1.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "margin-right:15px;");
  tspan2.innerHTML = "show column names";

  // tdiv2  = configdiv.appendChild(document.createElement('div'));
  // tdiv2.setAttribute('style', "margin-top: 5px;");
  tcheck = div1.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_hover_info;
  if(this.newconfig && this.newconfig.show_hover_info != undefined) { val1 = this.newconfig.show_hover_info; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_hover_info', this.checked);");
  tspan2 = div1.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show hover info panel";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  //tdiv2.setAttribute('style', "margin-top: 5px;");
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute("style", "margin-left: 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.radio_list;
  if(this.newconfig && this.newconfig.radio_list != undefined) { val1 = this.newconfig.radio_list; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'radio_list', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "radio list (single select)";
 
  return configdiv;
}

//=================================================================================
//
// helper functions
//
//=================================================================================

function reports_treelist_edge_root_sort_func(e1,e2) {
  //first pass move all the root edges to the front and sort them by feature1.name
  if(!e1) { return 1; }
  if(!e2) { return -1; }
  if(!e1.feature1) { return 1; }
  if(!e2.feature1) { return -1; }
  
  if((e1.feature1.edge_node_type=="root") && (e2.feature1.edge_node_type!="root")) { return -1; }
  if((e1.feature1.edge_node_type!="root") && (e2.feature1.edge_node_type=="root")) { return 1; }
  
  if((e1.feature1.edge_node_type=="root") && (e2.feature1.edge_node_type=="root")) {
    if(e1.feature1.name < e2.feature1.name) { return -1; }
    if(e1.feature1.name > e2.feature1.name) { return 1; }
    return 0;
  }
  
  //everything else gets a name sort on f2
  if(!e1.feature2) { return 1; }
  if(!e2.feature2) { return -1; }
  if(e1.feature2.name < e2.feature2.name) { return -1; }
  if(e1.feature2.name > e2.feature2.name) { return 1; }
  return 0;
}

