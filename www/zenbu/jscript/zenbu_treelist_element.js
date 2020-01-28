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
  return true;
}


function zenbuTreeListElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.sort_col) { elementDOM.setAttribute("sort_col", this.sort_col); }
  if(this.sort_reverse) { elementDOM.setAttribute("sort_reverse", "true"); }
  if(this.move_selection_to_top) { elementDOM.setAttribute("move_selection_to_top", "true"); }  //treelist

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
}


function zenbuTreeListElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  //eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  if(param == "move_selection_to_top") {  this.newconfig.move_selection_to_top = value; }
  
  if(param == "accept-reconfig") {
    //this.needReload=true;
    if(this.newconfig.move_selection_to_top !== undefined) { this.move_selection_to_top = this.newconfig.move_selection_to_top; }
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
  
  if(this.datasource_mode == "edge") {
    //reportsPostprocessTreeListEdges(this);
    this.postprocessEdges();
  }
  //no need to extra postprocessing of datasource="feature" since they can only be displayed as a list
}


function zenbuTreeListElement_postprocessEdges() {
  var starttime = new Date();
  
  var elementID = this.elementID;
  console.log("reportElementPostprocessTreeListEdges: " + elementID);
  
  var feature_count = this.feature_array.length;
  var edge_count    = this.edge_array.length;
  //console.log("reportElementPostprocessTreeListEdges: " + feature_count+ " features, " + edge_count+" edges");
  
  if(this.focus_feature) {
    if(!this.selected_feature) { this.selected_feature = this.focus_feature; }
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
  
  if(this.filter_count == 0) { //use the query feature
    var load_info = main_div.appendChild(document.createElement('div'));
    load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
    load_info.innerHTML = "no data...";
    return;
  }
  
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
  
  var list_div = main_div.appendChild(document.createElement('div'));
  style = "overflow-y:scroll; ";
  style += "height: "+ ( height-20)+"px; ";
  list_div.setAttribute('style', style);
  list_div.innerHTML = "";
  
  var table = list_div.appendChild(document.createElement('table'));
  table.setAttribute("style", "border-collapse: collapse;");
  //table.setAttribute("width", "100%");
  var tbody = table.appendChild(document.createElement('tbody'));
  
  if(this.datasource_mode == "feature") {
    if(this.move_selection_to_top) {
      if(this.filter_count>0 && this.selected_feature && (this.feature_array[0].id != this.selected_feature.id)) {
        //move the selected feature to top of list
        for(j=0; j<this.feature_array.length; j++) {
          var feature = this.feature_array[j];
          if(feature && (feature.id == this.selected_feature.id)) {
            this.feature_array.splice(0, 0, this.feature_array.splice(j, 1)[0]);
            break;
          }
        }
      }
    }
  }
  
  var j=0;
  var draw_root=false;
  var current_root = null;
  while(j<this.filter_count) {
    var edge = null;
    var feature = null;
    
    if(this.datasource_mode == "feature") {
      feature = this.feature_array[j];
      if(this.show_only_search_matches && !feature.search_match) { j++; continue; }
    }
    
    if(this.datasource_mode == "edge") {
      edge = this.edge_array[j];
      if(!edge) { j++; continue; }
      if(!edge.feature1) { j++; continue; }
      if(!edge.feature2) { j++; continue; }
      if(!draw_root && edge.feature1.edge_node_type == "root" && (!current_root || current_root.id != edge.feature1.id)) {
        feature = edge.feature1;
        current_root = feature;
        draw_root=true;
      } else {
        feature = edge.feature2;
        draw_root=false;
      }
    }
    
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.className = "row";
    //in google Chrome, can not mix onclick and onmouseover, so must use onmousedown instead
    //tr.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
    tr.setAttribute("onmousedown", "if(event.button==2 || event.altKey) { reportElementColumnsInterface(\""+this.elementID+ "\"); } else { reportElementEvent(\""+ this.elementID +"\", 'select', '"+feature.id+"'); }");
    
    var rowstyle = "padding:0; ";
    if(this.selected_feature && (feature.id == this.selected_feature.id)) {
      rowstyle += "background:rgb(220,220,220);";
    }
    if(this.show_only_search_matches) {
      if(feature.search_match) { rowstyle += "color:#0000D0;"; }
      else { rowstyle += "color:lightgray;" }
    }
    tr.setAttribute("style", rowstyle);
    
    for(var icol=0; icol<columns.length; icol++) {
      var dtype_col = columns[icol];
      if(!dtype_col) { continue; }
      if(!dtype_col.visible) { continue; }
      
      var datatype = dtype_col.datatype;
      datatype = datatype.replace(/^f1\./, '');
      datatype = datatype.replace(/^f2\./, '');
      
      var td = tr.appendChild(document.createElement('td'));
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
      }
    }
    if(!draw_root) { j++; }
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

