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


//var element = new ZenbuHeatmapElement();

function ZenbuHeatmapElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuHeatmapElement");
  this.element_type = "heatmap";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);

  this.title_prefix = "";
  this.title = "";
  this.border = "simple";
  this.show_titlebar = false;
  this.widget_search = false;
  this.widget_filter = false;
  this.widget_download = false;
  this.widget_columns = false;
  
  this.row_category_datatype = "";
  this.col_category_datatype = "";
  this.show_row_labels = true;
  this.show_col_labels = true;
  this.row_sort_method = "alphabetical";
  this.col_sort_method = "alphabetical";
  this.row_rank_datatype = "";
  this.col_rank_datatype = "";
  this.row_rank_merge_method = "mean";
  this.col_rank_merge_method = "mean";
  
  this.show_hover_info = false;
  this.hide_zero = true;
  this.signal_merge_method = "mean";
  this.signal_datatype = "";
  this.colorspace = "Set3_bp_12";
  this.colorspace_min = "auto";
  this.colorspace_max = "auto"; 
  this.colorspace_logscale = false;
  this.colorspace_invert = false;
  this.colorspace_zero_center = false;
  this.cell_size = 10;
  this.background_color = "#BABABA";
  this.auto_content_height = true;
  this.matrix_signal_min;
  this.matrix_signal_max;

  //methods
  this.initFromConfigDOM  = zenbuHeatmapElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuHeatmapElement_generateConfigDOM;  //returns a ConfigDOM object

  this.resetElement       = zenbuHeatmapElement_reset;
  this.postprocessElement = zenbuHeatmapElement_postprocess;
  this.drawElement        = zenbuHeatmapElement_draw;

  this.elementEvent       = zenbuHeatmapElement_elementEvent;
  this.reconfigureParam   = zenbuHeatmapElement_reconfigureParam;

  this.configSubpanel     = zenbuHeatmapElement_configSubpanel;

  //internal methods
  this.drawHeatmap        = zenbuHeatmapElement_drawHeatmap;

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================

function zenbuHeatmapElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "heatmap") { return false; }
  
  //TODO: eventually maybe a superclass init call here
  if(elementDOM.getAttribute("row_category_datatype")) { this.row_category_datatype = elementDOM.getAttribute("row_category_datatype"); }
  if(elementDOM.getAttribute("col_category_datatype")) { this.col_category_datatype = elementDOM.getAttribute("col_category_datatype"); }
  if(elementDOM.getAttribute("signal_datatype"))       { this.signal_datatype = elementDOM.getAttribute("signal_datatype"); }
  if(elementDOM.getAttribute("signal_merge_method"))   { this.signal_merge_method = elementDOM.getAttribute("signal_merge_method"); }
  if(elementDOM.getAttribute("cell_size"))             { this.cell_size = parseInt(elementDOM.getAttribute("cell_size")); }
  if(elementDOM.getAttribute("background_color"))      { this.background_color = elementDOM.getAttribute("background_color"); }
  if(elementDOM.getAttribute("colorspace"))            { this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("colorspace_min"))        { this.colorspace_min = elementDOM.getAttribute("colorspace_min"); }
  if(elementDOM.getAttribute("colorspace_max"))        { this.colorspace_max = elementDOM.getAttribute("colorspace_max"); }
  if(elementDOM.getAttribute("colorspace_invert") == "true") { this.colorspace_invert = true; }
  if(elementDOM.getAttribute("colorspace_logscale") == "true") { this.colorspace_logscale = true; }
  if(elementDOM.getAttribute("colorspace_zero_center") == "true") { this.colorspace_zero_center = true; }
  if(elementDOM.getAttribute("show_row_labels") == "false") { this.show_row_labels = false; }
  if(elementDOM.getAttribute("show_col_labels") == "false") { this.show_col_labels = false; }
  if(elementDOM.getAttribute("row_sort_method"))            { this.row_sort_method = elementDOM.getAttribute("row_sort_method"); }
  if(elementDOM.getAttribute("col_sort_method"))            { this.col_sort_method = elementDOM.getAttribute("col_sort_method"); }
  if(elementDOM.getAttribute("row_rank_datatype"))          { this.row_rank_datatype = elementDOM.getAttribute("row_rank_datatype"); }
  if(elementDOM.getAttribute("col_rank_datatype"))          { this.col_rank_datatype = elementDOM.getAttribute("col_rank_datatype"); }
  if(elementDOM.getAttribute("row_rank_merge_method"))      { this.row_rank_merge_method = elementDOM.getAttribute("row_rank_merge_method"); }
  if(elementDOM.getAttribute("col_rank_merge_method"))      { this.col_rank_merge_method = elementDOM.getAttribute("col_rank_merge_method"); }
  if(elementDOM.getAttribute("show_hover_info") == "true")  { this.show_hover_info = true; }

  return true;
}


function zenbuHeatmapElement_generateConfigDOM() {
  //TODO: need to figure this out, not currently using
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  if(this.row_category_datatype) { elementDOM.setAttribute("row_category_datatype", this.row_category_datatype); }
  if(this.col_category_datatype) { elementDOM.setAttribute("col_category_datatype", this.col_category_datatype); }
  if(this.signal_merge_method) { elementDOM.setAttribute("signal_merge_method", this.signal_merge_method); }
  if(this.signal_datatype) { elementDOM.setAttribute("signal_datatype", this.signal_datatype); }
  elementDOM.setAttribute("colorspace", this.colorspace);
  elementDOM.setAttribute("background_color", this.background_color);
  if(this.cell_size) { elementDOM.setAttribute("cell_size", this.cell_size); }
  if(this.colorspace_logscale) { elementDOM.setAttribute("colorspace_logscale", "true"); }
  if(this.colorspace_invert) { elementDOM.setAttribute("colorspace_invert", "true"); }
  if(this.colorspace_zero_center) { elementDOM.setAttribute("colorspace_zero_center", "true"); }
  elementDOM.setAttribute("colorspace_min", this.colorspace_min);
  elementDOM.setAttribute("colorspace_max", this.colorspace_max);
  if(!this.show_row_labels) { elementDOM.setAttribute("show_row_labels", "false"); }
  if(!this.show_col_labels) { elementDOM.setAttribute("show_col_labels", "false"); }
  if(this.row_sort_method) { elementDOM.setAttribute("row_sort_method", this.row_sort_method); }
  if(this.col_sort_method) { elementDOM.setAttribute("col_sort_method", this.col_sort_method); }
  if(this.row_rank_datatype) { elementDOM.setAttribute("row_rank_datatype", this.row_rank_datatype); }
  if(this.col_rank_datatype) { elementDOM.setAttribute("col_rank_datatype", this.col_rank_datatype); }
  if(this.row_rank_merge_method) { elementDOM.setAttribute("row_rank_merge_method", this.row_rank_merge_method); }
  if(this.col_rank_merge_method) { elementDOM.setAttribute("col_rank_merge_method", this.col_rank_merge_method); }
  if(this.show_hover_info) { elementDOM.setAttribute("show_hover_info", "true"); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuHeatmapElement_elementEvent(mode, value, value2) {
  var datasourceElement = this.datasource();
}


function zenbuHeatmapElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //TODO: eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  //category
  if(param == "row_category_datatype") { this.newconfig.row_category_datatype = value; }
  if(param == "col_category_datatype") { this.newconfig.col_category_datatype = value; }
  if(param == "show_row_labels") { this.newconfig.show_row_labels = value; }
  if(param == "show_col_labels") { this.newconfig.show_col_labels = value; }
  if(param == "col_sort_method") { this.newconfig.col_sort_method = value; }
  if(param == "row_sort_method") { this.newconfig.row_sort_method = value; }
  if(param == "row_rank_datatype") { this.newconfig.row_rank_datatype = value; }
  if(param == "col_rank_datatype") { this.newconfig.col_rank_datatype = value; }
  if(param == "row_rank_merge_method") { this.newconfig.row_rank_merge_method = value; }
  if(param == "col_rank_merge_method") { this.newconfig.col_rank_merge_method = value; }

  if(param == "show_hover_info") { this.newconfig.show_hover_info = value; }
  if(param == "hide_zero") { this.newconfig.hide_zero = value; }
  if(param == "colorspace") { this.newconfig.colorspace = value; }
  if(param == "signal_datatype") { this.newconfig.signal_datatype = value; }
  if(param == "background_color") { 
    if(value.charAt(0)!="#") { value = "#"+value; }
    this.newconfig.background_color = value;
  }
  if(param == "cell_size") { this.newconfig.cell_size = value; return true; }
  if(param == "signal_merge_method") { 
    this.newconfig.signal_merge_method = value;
    if(value == "non-zero") {
      var cs = this.colorspaceCSI.colorspace
      if(this.colorspaceCSI.newconfig.colorspace) { cs = this.colorspaceCSI.newconfig.colorspace; }
      if(cs != "single-color") {
        console.log("non-zero so force change to single-color mode");
        zenbuColorSpaceInterfaceReconfigParam(this.colorspaceCSI.id, 'colorspace', "#0000FF");
      }
//       this.newconfig.colorspace = "#0000FF" //"single-color"; 
//       this.colorspaceCSI.colorspace = "#0000FF";
//       zenbuColorSpaceInterfaceUpdate(this.colorspaceCSI.id);
    }
  }

  if(param == "accept-reconfig") {
    //this.needReload=true;
    if(this.newconfig.row_category_datatype !== undefined) { this.row_category_datatype = this.newconfig.row_category_datatype; }
    if(this.newconfig.col_category_datatype !== undefined) { this.col_category_datatype = this.newconfig.col_category_datatype; }
    if(this.newconfig.show_row_labels !== undefined) { this.show_row_labels = this.newconfig.show_row_labels; }
    if(this.newconfig.show_col_labels !== undefined) { this.show_col_labels = this.newconfig.show_col_labels; }
    if(this.newconfig.col_sort_method !== undefined) { this.col_sort_method = this.newconfig.col_sort_method; }
    if(this.newconfig.row_sort_method !== undefined) { this.row_sort_method = this.newconfig.row_sort_method; }
    if(this.newconfig.row_rank_datatype !== undefined) { this.row_rank_datatype = this.newconfig.row_rank_datatype; }
    if(this.newconfig.col_rank_datatype !== undefined) { this.col_rank_datatype = this.newconfig.col_rank_datatype; }
    if(this.newconfig.row_rank_merge_method !== undefined) { this.row_rank_merge_method = this.newconfig.row_rank_merge_method; }
    if(this.newconfig.col_rank_merge_method !== undefined) { this.col_rank_merge_method = this.newconfig.col_rank_merge_method; }
    if(this.newconfig.show_hover_info !== undefined) { this.show_hover_info = this.newconfig.show_hover_info; }
    if(this.newconfig.hide_zero !== undefined) { this.hide_zero = this.newconfig.hide_zero; }
    if(this.newconfig.background_color !== undefined) { this.background_color = this.newconfig.background_color; }
    if(this.newconfig.colorspace !== undefined) { this.colorspace = this.newconfig.colorspace; }
    if(this.newconfig.signal_datatype !== undefined) { this.signal_datatype = this.newconfig.signal_datatype; }
    if(this.newconfig.signal_merge_method !== undefined) { this.signal_merge_method = this.newconfig.signal_merge_method; }
    if(this.newconfig.cell_size !== undefined) { 
      this.cell_size = parseInt(this.newconfig.cell_size);
      if(isNaN(this.cell_size)) { this.cell_size = 5; }
      if(this.cell_size<3) { this.cell_size=3; }
    }
    reportsDrawElement(this.elementID);  //hack: does double draw for now until I can fix the auto width
  }
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuHeatmapElement_reset() {
  //console.log("zenbuHeatmapElement_reset ["+this.elementID+"]");
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  this.auto_content_height = true;

  this.postprocessElement();
}

function zenbuHeatmapElement_postprocess() {
  //console.log("zenbuHeatmapElement_postprocess "+this.elementID);
  var starttime = new Date();

  this.loading = false;
    
  var datasourceElement = this.datasource();  
  if(!datasourceElement) { return; }
  if(!datasourceElement.dtype_columns) { return; }
  
  var row_category_datatype = this.row_category_datatype;
  if(this.newconfig && this.newconfig.row_category_datatype != undefined) { row_category_datatype = this.newconfig.row_category_datatype; }

  var col_category_datatype = this.col_category_datatype;
  if(this.newconfig && this.newconfig.col_category_datatype != undefined) { col_category_datatype = this.newconfig.col_category_datatype; }

  
  this.row_dtype_col = null;
  this.col_dtype_col = null;
  this.signal_dtype_col = null;
  for(var i=0; i<this.dtype_columns.length; i++) { //use local copy of dtype_col
    var dtype_col = this.dtype_columns[i];
    if(!dtype_col) { continue; }
    if(dtype_col.datatype == row_category_datatype) { this.row_dtype_col = dtype_col; }
    if(dtype_col.datatype == col_category_datatype) { this.col_dtype_col = dtype_col; }
    if(dtype_col.datatype == this.signal_datatype)  { this.signal_dtype_col = dtype_col; }
  }
  if(!this.row_dtype_col) { return; }
  if(!this.col_dtype_col) { return; }

  //clear previous categories
  this.row_dtype_col.visible = true;
  this.col_dtype_col.visible = true;
  if(this.signal_dtype_col) { this.signal_dtype_col.visible = true; }
  this.row_dtype_col.categories = {};
  this.col_dtype_col.categories = {};
  
  //recalc
  reportElement_process_dtype_category(datasourceElement, this.row_dtype_col, this.row_rank_merge_method, this.row_rank_datatype);
  reportElement_process_dtype_category(datasourceElement, this.col_dtype_col, this.col_rank_merge_method, this.col_rank_datatype);

  if(!this.row_dtype_col.categories) { this.row_dtype_col.categories = {}; }
  if(!this.col_dtype_col.categories) { this.col_dtype_col.categories = {}; }

  //prepare the row/col category/label arrays and sort
  this.row_ctg_array = new Array();
  for(var ctg in this.row_dtype_col.categories) {
    var ctg_obj = this.row_dtype_col.categories[ctg];
    this.row_ctg_array.push(ctg_obj);
  }
  switch(this.row_sort_method) {
    case "ascending": 
      this.row_ctg_array.sort(zenbu_heatmap_ctg_value_sort_func);
      break;
    case "decending":
      this.row_ctg_array.sort(zenbu_heatmap_ctg_value_sort_func); 
      this.row_ctg_array.reverse();
      break;
    default:
      this.row_ctg_array.sort(zenbu_heatmap_ctg_name_sort_func);
      break;
  }  
  //------------
  this.col_ctg_array = new Array();
  for(var ctg in this.col_dtype_col.categories) {
    var ctg_obj = this.col_dtype_col.categories[ctg];
    this.col_ctg_array.push(ctg_obj);
  }
  switch(this.col_sort_method) {
    case "ascending": 
      this.col_ctg_array.sort(zenbu_heatmap_ctg_value_sort_func);
      break;
    case "decending":
      this.col_ctg_array.sort(zenbu_heatmap_ctg_value_sort_func); 
      this.col_ctg_array.reverse();
      break;
    default:
      this.col_ctg_array.sort(zenbu_heatmap_ctg_name_sort_func);
      break;
  }  
  
  this.row_max_label_width = 0;
  this.col_max_label_height = 0;
  
  //process the data into the heatmap_matrix of values
  this.heatmap_matrix = {}; //use a row_col key to define cells not 2d array
  if(datasourceElement.datasource_mode == "edge")    {
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.feature1) { continue; }
      if(!edge.feature2) { continue; }
      if(!edge.filter_valid) { continue; }
      //if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }

      //check for focus_feature sub-selection
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

      var row_mval = zenbu_object_dtypecol_value(edge, this.row_dtype_col, "first");
      var col_mval = zenbu_object_dtypecol_value(edge, this.col_dtype_col, "first");
      var cell_key = row_mval +"_"+ col_mval;
      if(this.heatmap_matrix[cell_key] == undefined) { 
        this.heatmap_matrix[cell_key] = { row:row_mval, col:col_mval, signal:undefined, values:[], objs:[] }; 
      }
         
      var sigval = 0;
      if(this.signal_datatype == "__count") { sigval=1; }
      else {
        sigval = zenbu_object_dtypecol_value(edge, this.signal_dtype_col, "first"); //first value found 
      }
      if(!sigval) { sigval = 0; }
      this.heatmap_matrix[cell_key].values.push(parseFloat(sigval));
      this.heatmap_matrix[cell_key].objs.push(edge);
    }  //loop on edges
  }
  
  if(datasourceElement.datasource_mode == "feature") {
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }      
      //if(datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

      var row_mval = zenbu_object_dtypecol_value(feature, this.row_dtype_col, "first");
      var col_mval = zenbu_object_dtypecol_value(feature, this.col_dtype_col, "first");
      var cell_key = row_mval +"_"+ col_mval;
      if(this.heatmap_matrix[cell_key] == undefined) { 
        this.heatmap_matrix[cell_key] = { row:row_mval, col:col_mval, signal:undefined, values:[], objs:[] }; 
      }
         
      var sigval = 0;
      if(this.signal_datatype == "__count") { sigval=1; }
      else {
        sigval = zenbu_object_dtypecol_value(feature, this.signal_dtype_col, "first"); //first value found 
      }
      if(!sigval) { sigval = 0; }
      this.heatmap_matrix[cell_key].values.push(parseFloat(sigval));
      this.heatmap_matrix[cell_key].objs.push(feature);
    } //loop on features      
  }
  
  if(datasourceElement.datasource_mode == "source") {
    for(j=0; j<datasourceElement.sources_array.length; j++) {
      var source = datasourceElement.sources_array[j];
      if(!source) { continue; }
      if(!source.filter_valid) { continue; }      
      //if(datasourceElement.show_only_search_matches && !source.search_match) { continue; }
    }
  }

  //process matrix to turn into signal value and calc overall min/max
  this.matrix_signal_min = undefined;
  this.matrix_signal_max = undefined;
  for(var cell_key in this.heatmap_matrix) {
    if(this.heatmap_matrix[cell_key] == undefined) { continue; }
    var cell_obj = this.heatmap_matrix[cell_key];     
    var cell_values = cell_obj.values;     
    if(cell_values.length==0) { continue; }
    
    var cell_value = undefined; 
    for(var idx3=0; idx3<cell_values.length; idx3++) {
      if(cell_value == undefined) { cell_value = 0; }
      switch(this.signal_merge_method) {
        case "non-zero": cell_value = 1; break;
        case "count": cell_value++; break;
        case "sum": cell_value += cell_values[idx3];break;         
        case "mean": cell_value += cell_values[idx3];break;
        case "min":
          if(idx3==0) { cell_value = cell_values[idx3]; }
          if(cell_values[idx3] < cell_value) { cell_value = cell_values[idx3]; }
          break;
        case "max": 
          if(idx3==0) { cell_value = cell_values[idx3]; }
          if(cell_values[idx3] > cell_value) { cell_value = cell_values[idx3]; }
          break;
        default: break;
      }
    }  //cell_value loop
    if(cell_value == undefined) { 
      cell_obj.signal = undefined; 
      continue;
    }
    
    if(this.signal_merge_method == "mean") { cell_value = cell_value / cell_values.length; }
    
    if(this.matrix_signal_min==undefined || (cell_value < this.matrix_signal_min)) { this.matrix_signal_min = cell_value; }
    if(this.matrix_signal_max==undefined || (cell_value > this.matrix_signal_max)) { this.matrix_signal_max = cell_value; }

    cell_obj.signal = cell_value;
  }
  console.log(this.elementID+" heatmap_matrix min:"+this.matrix_signal_min+":  max:"+this.matrix_signal_max);
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("zenbuHeatmapElement_postprocess "+this.elementID+" "+(runtime)+"msec");
}


function zenbuHeatmapElement_hoverInfo(elementID, row_mval, col_mval) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }
  if(!reportElement.show_hover_info) { return; }
  if(!reportElement.row_dtype_col || !reportElement.col_dtype_col) { return; }
  
  var datasourceElement = reportElement.datasource();
  if(!datasourceElement) { return; }
  
  var cell_key = row_mval +"_"+ col_mval;
  var cell_obj = reportElement.heatmap_matrix[cell_key];
  //if(!cell_obj) { return; }
  //if(isNaN(cell_obj.signal)) { return; }
  //console.log("heatmap hoverinfo row:"+row_mval+"  col:"+col_mval+"  signal:"+cell_obj.signal);

  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "background-color:#404040; text-align:left; font-size:10px; color:#FDFDFD; "
                        + "font-family:arial,helvetica,sans-serif; min-width:100px; z-index:100; "
                        + "opacity: 0.90; padding: 3px 3px 3px 3px; "
                        + "border-radius: 7px; border: solid 1px #808080; "
                       );

  reportElement.dtype_columns.sort(reports_column_order_sort_func);  //default table sort order

  var columns = [];
  columns.push(reportElement.row_dtype_col);
  columns.push(reportElement.col_dtype_col);
  if(reportElement.signal_dtype_col) { columns.push(reportElement.signal_dtype_col); } 
  else {
    var tdtype = {visible:true, title:"value- "+reportElement.signal_datatype, datatype:"__cell_signal"};
    if(reportElement.signal_datatype == "__count") { tdtype.title = "value- count"; }
    columns.push(tdtype);
  }

  for(var icol=0; icol<reportElement.dtype_columns.length; icol++) {
    var dtype_col = reportElement.dtype_columns[icol];
    if(!dtype_col) { continue; }
    if(reportElement.row_dtype_col && (dtype_col.datatype == reportElement.row_dtype_col.datatype)) { continue; }
    if(reportElement.col_dtype_col && (dtype_col.datatype == reportElement.col_dtype_col.datatype)) { continue; }
    if(reportElement.signal_dtype_col && (dtype_col.datatype == reportElement.signal_dtype_col.datatype)) { continue; }
    columns.push(dtype_col);
  }

  for(var icol=0; icol<columns.length; icol++) {
    var dtype_col = columns[icol];
    if(!dtype_col) { continue; }
    if(!dtype_col.visible && !dtype_col.user_modifiable) { continue; }
    
    var datatype = dtype_col.datatype;
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');

    //tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv = document.createElement('div');
    tdiv.setAttribute('style', "max-width:350px; word-wrap:break-word; margin:0px 10px 0px 2px; ");

    var title = dtype_col.title;
    if(reportElement.row_dtype_col && (dtype_col.datatype == reportElement.row_dtype_col.datatype)) { title = "row- "+title; }
    if(reportElement.col_dtype_col && (dtype_col.datatype == reportElement.col_dtype_col.datatype)) { title = "col- "+title; }
    if(reportElement.signal_dtype_col && (dtype_col.datatype == reportElement.signal_dtype_col.datatype)) { title = "value- "+title; }    
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; word-wrap: break-word; ");
    tspan.innerHTML = title + ": ";

    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "word-wrap: break-word; margin-left:5px;");
    //if(firstRow) { tspan.style = "word-wrap:break-word; font-weight:bold; font-size:12px; "; }

    if(dtype_col.datatype == reportElement.row_dtype_col.datatype) { tspan.innerHTML = row_mval; }
    else if(dtype_col.datatype == reportElement.col_dtype_col.datatype) { tspan.innerHTML = col_mval; }
    else if(cell_obj) { 
      if(dtype_col.datatype == "__cell_signal") { 
        if(!isNaN(cell_obj.signal)) { tspan.innerHTML = cell_obj.signal; }
      }
      else {
        var val_hash = {}; //get unqiue values
        for(var idx3=0; idx3<cell_obj.objs.length; idx3++) {
          var tobj = cell_obj.objs[idx3];
          if(!tobj) { continue; }
          var tval3 = zenbu_object_dtypecol_value(tobj, dtype_col, "first");
          if(tval3 != undefined) { val_hash[tval3] = true; }
        }
        
        var tval3 = Object.keys(val_hash).join(", ");
        //for(var tval3 in val_hash) {}
        tspan.innerHTML = tval3;
      }
    }
    if(!tspan.innerHTML) { tspan.innerHTML = "..."; }    
    divFrame.appendChild(tdiv);
    firstRow = false;
  }
    
  toolTipWidth = 100;
  toolTipLayer.innerHTML = "";
  toolTipLayer.appendChild(divFrame);
  toolTipSTYLE.display='block';
  //console.log("ok should see the tooltip hoverinfo");
}

//=================================================================================
//
// configSubpanel
//
//=================================================================================

function zenbuHeatmapElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();
    
  var row_category_datatype = this.row_category_datatype;
  if(this.newconfig && this.newconfig.row_category_datatype != undefined) { row_category_datatype = this.newconfig.row_category_datatype; }

  var col_category_datatype = this.col_category_datatype;
  if(this.newconfig && this.newconfig.col_category_datatype != undefined) { col_category_datatype = this.newconfig.col_category_datatype; }
  
  var signal_datatype = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }
  
  var signal_merge_method = this.signal_merge_method;
  if(this.newconfig && this.newconfig.signal_merge_method != undefined) { signal_merge_method = this.newconfig.signal_merge_method; }

  var background_color = this.background_color;
  if(this.newconfig && this.newconfig.background_color != undefined) { background_color = this.newconfig.background_color; }

  var cell_size = this.cell_size;
  if(this.newconfig && this.newconfig.cell_size != undefined) { cell_size = this.newconfig.cell_size; }
  if(isNaN(cell_size)) { cell_size = 5; }
  if(cell_size<3) { cell_size=3; }

  var labelDiv = configdiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="Visualization:";

  // axis control table ----------
  var x_axis_div  = configdiv.appendChild(document.createElement('div'));
  x_axis_div.style.marginLeft = "7px";
  var tspan = x_axis_div.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold;");
  tspan.innerHTML = "Columns: ";

  var y_axis_div  = configdiv.appendChild(document.createElement('div'));
  y_axis_div.style.marginLeft = "7px";
  var tspan = y_axis_div.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold;");
  tspan.innerHTML = "Rows: ";

  //---------------------------
  var tcheck = x_axis_div.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 10px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_col_labels;
  if(this.newconfig && this.newconfig.show_col_labels != undefined) { val1 = this.newconfig.show_col_labels; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_col_labels', this.checked);");
  tspan2 = x_axis_div.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show column labels";

  tcheck = y_axis_div.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 2px 1px 0px 10px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_row_labels;
  if(this.newconfig && this.newconfig.show_row_labels != undefined) { val1 = this.newconfig.show_row_labels; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_row_labels', this.checked);");
  tspan2 = y_axis_div.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show row labels";

  
  //------ label category datatype
  //column datatype selection options
  var tdiv2 = x_axis_div.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 10px;");
  span1.innerHTML = "label datatype:";
  var col_dtype_select = tdiv2.appendChild(document.createElement('select'));
  col_dtype_select.className = "dropdown";
  col_dtype_select.style.fontSize = "10px";
  col_dtype_select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'col_category_datatype', this.value);");
  var option = col_dtype_select.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.innerHTML = "please select";

  //row datatype selection options
  var tdiv2 = y_axis_div.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 10px;");
  span1.innerHTML = "label datatype:";
  var row_dtype_select = tdiv2.appendChild(document.createElement('select'));
  row_dtype_select.className = "dropdown";
  row_dtype_select.style.fontSize = "10px";
  row_dtype_select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'row_category_datatype', this.value);");
  var option = row_dtype_select.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.innerHTML = "please select";


  //---------------------------------
  //label sort methods
  var col_sort_method = this.col_sort_method;
  if(this.newconfig && this.newconfig.col_sort_method != undefined) { col_sort_method = this.newconfig.col_sort_method; }
  var tdiv = x_axis_div.appendChild(document.createElement("div"));
  var span1 = tdiv.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 10px;");
  span1.innerHTML = "rank sort:";
  var select = tdiv.appendChild(document.createElement('select'));
  select.className = "dropdown";
  select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'col_sort_method', this.value);");
  var methods = ["alphabetical", "ascending", "decending"];
  for(var i=0; i<methods.length; i++) {
    var val1 = methods[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == col_sort_method) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }

  if(col_sort_method!="alphabetical" && datasourceElement.dtype_columns) {
    var col_rank_datatype = this.col_rank_datatype;
    if(this.newconfig && this.newconfig.col_rank_datatype != undefined) { col_rank_datatype = this.newconfig.col_rank_datatype; }
    var col_rank_merge_method = this.col_rank_merge_method;
    if(this.newconfig && this.newconfig.col_rank_merge_method != undefined) { col_rank_merge_method = this.newconfig.col_rank_merge_method; }

    var tdiv = x_axis_div.appendChild(document.createElement("div"));
    var span1 = tdiv.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin: 2px 1px 2px 20px;");
    span1.innerHTML = "rank datatype:";
    var t_select = tdiv.appendChild(document.createElement('select'));
    t_select.className = "dropdown";
    t_select.style.fontSize = "10px";
    t_select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'col_rank_datatype', this.value);");

    datasourceElement.dtype_columns.sort(reports_column_order_sort_func);  //default table sort order
    var columns = datasourceElement.dtype_columns;
    for(var i=0; i<columns.length; i++) {
      var dtype_col = columns[i];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type != "weight" && dtype_col.col_type != "signal") { continue; }

      var option = document.createElement('option');
      option.setAttribute("style", "font-size:10px;");
      if(dtype_col.visible) { option.style.color = "blue"; }
      option.setAttribute("value", dtype_col.datatype);     
      option.innerHTML = dtype_col.datatype;

      if(dtype_col.datatype == col_rank_datatype) { option.setAttribute("selected", "selected"); }
      t_select.appendChild(option);
    }
    
    var span1 = tdiv.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin: 2px 1px 2px 10px;");
    span1.innerHTML = "merge:";
    var select = tdiv.appendChild(document.createElement('select'));
    select.className = "dropdown";
    select.style.fontSize = "10px";
    select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'col_rank_merge_method', this.value);");
    var methods = ["non-zero", "count", "sum", "mean", "min", "max"];
    for(var i=0; i<methods.length; i++) {
      var val1 = methods[i];
      var option = select.appendChild(document.createElement('option'));
      option.setAttribute("value", val1);
      if(val1 == col_rank_merge_method) { option.setAttribute("selected", "selected"); }
      option.innerHTML = val1;
    }
  }

  var row_sort_method = this.row_sort_method;
  if(this.newconfig && this.newconfig.row_sort_method != undefined) { row_sort_method = this.newconfig.row_sort_method; }
  var tdiv = y_axis_div.appendChild(document.createElement("div"));
  var span1 = tdiv.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 10px;");
  span1.innerHTML = "rank sort: ";
  var select = tdiv.appendChild(document.createElement('select'));
  select.className = "dropdown";
  select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'row_sort_method', this.value);");
  var methods = ["alphabetical", "ascending", "decending"];
  for(var i=0; i<methods.length; i++) {
    var val1 = methods[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == row_sort_method) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }

  if(row_sort_method!="alphabetical" && datasourceElement.dtype_columns) {
    var row_rank_datatype = this.row_rank_datatype;
    if(this.newconfig && this.newconfig.row_rank_datatype != undefined) { row_rank_datatype = this.newconfig.row_rank_datatype; }
    var row_rank_merge_method = this.row_rank_merge_method;
    if(this.newconfig && this.newconfig.row_rank_merge_method != undefined) { row_rank_merge_method = this.newconfig.row_rank_merge_method; }

    var tdiv = y_axis_div.appendChild(document.createElement("div"));
    var span1 = tdiv.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin: 2px 1px 2px 20px;");
    span1.innerHTML = "rank datatype:";
    var t_select = tdiv.appendChild(document.createElement('select'));
    t_select.className = "dropdown";
    t_select.style.fontSize = "10px";
    t_select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'row_rank_datatype', this.value);");

    datasourceElement.dtype_columns.sort(reports_column_order_sort_func);  //default table sort order
    var columns = datasourceElement.dtype_columns;
    for(var i=0; i<columns.length; i++) {
      var dtype_col = columns[i];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type != "weight" && dtype_col.col_type != "signal") { continue; }

      var option = document.createElement('option');
      option.setAttribute("style", "font-size:10px;");
      if(dtype_col.visible) { option.style.color = "blue"; }
      option.setAttribute("value", dtype_col.datatype);     
      option.innerHTML = dtype_col.datatype;

      if(dtype_col.datatype == row_rank_datatype) { option.setAttribute("selected", "selected"); }
      t_select.appendChild(option);
    }
    
    var span1 = tdiv.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin: 2px 1px 2px 10px;");
    span1.innerHTML = "merge:";
    var select = tdiv.appendChild(document.createElement('select'));
    select.className = "dropdown";
    select.style.fontSize = "10px";
    select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'row_rank_merge_method', this.value);");
    var methods = ["non-zero", "count", "sum", "mean", "min", "max"];
    for(var i=0; i<methods.length; i++) {
      var val1 = methods[i];
      var option = select.appendChild(document.createElement('option'));
      option.setAttribute("value", val1);
      if(val1 == row_rank_merge_method) { option.setAttribute("selected", "selected"); }
      option.innerHTML = val1;
    }
  }
    
  //---------------------------
  var cells_div  = configdiv.appendChild(document.createElement('div'));
  cells_div.style.marginLeft = "7px";
  var tspan = cells_div.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold;");
  tspan.innerHTML = "Heatmap cells: ";

  //cell method/datatype
  tdiv3  = cells_div.appendChild(document.createElement('div'));
  tdiv3.setAttribute('style', "margin-top: 5px;");
  var span1 = tdiv3.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 7px;");
  span1.innerHTML = "cell datatype:";
  signal_dtype_select = tdiv3.appendChild(document.createElement('select'));
  signal_dtype_select.className = "dropdown";
  signal_dtype_select.style.fontSize = "10px";
  signal_dtype_select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_datatype', this.value);");
    
  var option = document.createElement('option');
  option.setAttribute("style", "font-size:10px; color:orange;");
  option.setAttribute("value", "__count");     
  option.innerHTML = "count";
  signal_dtype_select.appendChild(option);
  
  //------
  
  var span1 = tdiv3.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 15px;");
  span1.innerHTML = "merge:";
  var select = tdiv3.appendChild(document.createElement('select'));
  select.className = "dropdown";
  select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_merge_method', this.value);");
  var methods = ["non-zero", "count", "sum", "mean", "min", "max"];
  for(var i=0; i<methods.length; i++) {
    var val1 = methods[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == signal_merge_method) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }

  //==== fill the datatypes for the selectors
  
  if(datasourceElement.dtype_columns) {
    datasourceElement.dtype_columns.sort(reports_column_order_sort_func);
    var columns = datasourceElement.dtype_columns;

    var selected_dtype = null;
    for(var i=0; i<columns.length; i++) {
      var dtype_col = columns[i];
      if(!dtype_col) { continue; }
      //if((dtype_col.datatype == "name") || (dtype_col.datatype == "f1.name") || (dtype_col.datatype == "f2.name")) { continue; }

      var option = document.createElement('option');
      option.setAttribute("style", "font-size:10px;");
      if(dtype_col.visible) { option.style.color = "blue"; }
      option.setAttribute("value", dtype_col.datatype);     
      var label =  dtype_col.title;
      if(dtype_col.title != dtype_col.datatype) { label +=  " ["+ dtype_col.datatype +"]"; }
      option.innerHTML = label;

      if(dtype_col.col_type == "mdata") {
        if(dtype_col.datatype == row_category_datatype) { option.setAttribute("selected", "selected"); }
        row_dtype_select.appendChild(option);
        
        var option2 = document.createElement('option');
        option2.setAttribute("style", "font-size:10px;");
        if(dtype_col.visible) { option2.style.color = "blue"; }
        option2.setAttribute("value", dtype_col.datatype);     
        var label =  dtype_col.title;
        if(dtype_col.title != dtype_col.datatype) { label +=  " ["+ dtype_col.datatype +"]"; }
        option2.innerHTML = label;
        if(dtype_col.datatype == col_category_datatype) { option2.setAttribute("selected", "selected"); }
        col_dtype_select.appendChild(option2);
      } else if((dtype_col.col_type == "signal") || (dtype_col.col_type == "weight")){
        if(dtype_col.datatype == signal_datatype) { option.setAttribute("selected", "selected"); }
        signal_dtype_select.appendChild(option);
      }
    }
  }
  
  tdiv2  = cells_div.appendChild(document.createElement('div'));  
  reportElementColorSpaceOptions(this);  //generate if needed
  this.colorspaceCSI.label = "cell color:";
  this.colorspaceCSI.enableScaling = true;
  this.colorspaceCSI.signalRangeMin = this.matrix_signal_min;
  this.colorspaceCSI.signalRangeMax = this.matrix_signal_max;
  this.colorspaceCSI.min_signal = this.colorspace_min;
  this.colorspaceCSI.max_signal = this.colorspace_max;
  this.colorspaceCSI.style.marginLeft = "7px";
  zenbuColorSpaceInterfaceUpdate(this.colorspaceCSI.id);
  tdiv2.appendChild(this.colorspaceCSI);

  
  var div2 = cells_div.appendChild(document.createElement('div'));
  div2.setAttribute('style', "margin: 2px 0px 1px 7px;");
  var span4 = div2.appendChild(document.createElement('span'));
  span4.innerHTML = "cell size: ";
  var cellSizeInput = div2.appendChild(document.createElement('input'));
  cellSizeInput.className = "sliminput";
  //cellSizeInput.setAttribute('size', "5");
  cellSizeInput.style.width = "30px";
  //cellSizeInput.style.fontSize = "10px";
  cellSizeInput.setAttribute('type', "text");
  cellSizeInput.setAttribute('value', cell_size);
  cellSizeInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID+"\", 'cell_size', this.value);");
  cellSizeInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+ this.elementID+"\", 'update'); }");
  
  var span4 = div2.appendChild(document.createElement('span'));
  span4.setAttribute('style', "margin:1px 0px 0px 15px; ");
  span4.innerHTML = "background color:";
  var colorInput = div2.appendChild(document.createElement('input'));
  colorInput.setAttribute('style', "margin:1px 0px 0px 5px; ");
  colorInput.setAttribute('value', background_color);
  colorInput.setAttribute('size', "5");
  colorInput.setAttributeNS(null, "onchange", "reportElementReconfigParam(\""+ this.elementID+"\", 'background_color', this.value);");
  if(this.back_color_picker) { this.back_color_picker.hidePicker(); } //hide old picker
  this.back_color_picker = new jscolor.color(colorInput);

  configdiv.appendChild(document.createElement('hr'));

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

}

//=================================================================================
//
// Draw section
//
//=================================================================================

function zenbuHeatmapElement_draw() {
  //console.log("zenbuHeatmapElement_draw "+this.elementID);
  this.drawHeatmap();
  reportsUpdateLayoutHierarchy(this); //process the layout up the hierarchy without redrawing elements
}

function zenbuHeatmapElement_drawHeatmap() {
  //console.log("zenbuHeatmapElement_drawHeatmap");
  if(this.loading) { return; }
  if(!this.row_dtype_col || !this.col_dtype_col) { return; }
  if(!this.col_ctg_array || !this.row_ctg_array) { return; }

  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();

  var datasourceElement = this.datasource();
  if(!datasourceElement) { return; }
  if(!datasourceElement.dtype_columns) { return; }

  var tdiv, tspan, tinput, ta;

  var svg = main_div.appendChild(document.createElementNS(svgNS,'svg'));
  //svg.setAttributeNS(null, 'width', (content_width-2)+'px');
  //svg.setAttributeNS(null, 'height', (content_height-24)+'px');
   
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size", this.cell_size+"px");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  svg.appendChild(g1);

  var col_label_g = g1.appendChild(document.createElementNS(svgNS,'g'));
  var col_max_label_height = 0;
  if(this.show_col_labels) {
    for(var idx1=0; idx1<this.col_ctg_array.length; idx1++) {
      var ctg_obj = this.col_ctg_array[idx1];
      //if(this.hide_zero && !ctg_obj.filtered && (ctg_obj.count==0) && (ctg_obj.hidden_count==0)) { continue; }

      var tg2 = col_label_g.appendChild(document.createElementNS(svgNS,'g'));
      tg2.setAttribute("onmouseover", "eedbMessageTooltip(\""+(ctg_obj.ctg)+" : "+(ctg_obj.value)+"\",130);");
      tg2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      //tg2.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
      //tg2.setAttribute("onmouseover", "reportElementEvent(\""+this.elementID+"\", 'chrom-info', '"+chrom.chrom_name+"'); return false; ");
      //tg2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      //tg2.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
      
      var name = ctg_obj.ctg;
      if(name == undefined) { name = ".."; }


      var text = document.createElementNS(svgNS,'text');
      text.setAttribute('x', '0px');
      text.setAttribute('y', '0px');
      text.setAttribute('transform', "rotate(-90 0,0)");
      text.setAttributeNS(null, 'style', 'fill: black;');
      text.appendChild(document.createTextNode(name));
      tg2.appendChild(text);
      
      var bbox = text.getBBox();
      if(bbox.width > col_max_label_height) { col_max_label_height = bbox.width; }
      //console.log("col label["+ctg_obj.ctg+"] width:"+(bbox.width)+" height:"+(bbox.height));
      
      var tcx = (idx1+1) * this.cell_size;
      var tcy = 0;
      tg2.setAttribute('transform', "translate("+tcx+","+tcy+")");
    }
    console.log(this.elementID+" col_max_label_height:"+col_max_label_height);
    col_label_g.setAttribute('transform', "translate(0,"+(col_max_label_height)+")");
  }
  
  //row labels
  var row_label_g = g1.appendChild(document.createElementNS(svgNS,'g'));
  var row_max_label_width = 0;
  if(this.show_row_labels) {
    for(var idx1=0; idx1<this.row_ctg_array.length; idx1++) {
      var ctg_obj = this.row_ctg_array[idx1];
      //if(this.hide_zero && !ctg_obj.filtered && (ctg_obj.count==0) && (ctg_obj.hidden_count==0)) { continue; }
      
      var name = ctg_obj.ctg;
      if(name == undefined) { name = ".."; }

      var tg2 = row_label_g.appendChild(document.createElementNS(svgNS,'g'));
      //tg2.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
      //tg2.setAttribute("onmouseover", "reportElementEvent(\""+this.elementID+"\", 'chrom-info', '"+chrom.chrom_name+"'); return false; ");
      //tg2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      //tg2.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");

      var text = document.createElementNS(svgNS,'text');
      text.setAttribute('x', '0px');
      text.setAttribute('y', '0px');
      text.setAttributeNS(null, 'style', 'fill: black;');
      text.appendChild(document.createTextNode(name));
      tg2.appendChild(text);
      
      var bbox = text.getBBox();
      if(bbox.width > row_max_label_width) { row_max_label_width = bbox.width; }
      //console.log("row label["+ctg_obj.ctg+"] width:"+(bbox.width)+" height:"+(bbox.height));
      
      var tcx = -1 * bbox.width;
      var tcy = (idx1+1) * this.cell_size;
      tg2.setAttribute('transform', "translate("+tcx+","+tcy+")");
    }
    console.log(this.elementID+" row_max_label_width:"+row_max_label_width);
  }
  
  row_label_g.setAttribute('transform', "translate("+(row_max_label_width)+", "+(col_max_label_height+0)+")");
  col_label_g.setAttribute('transform', "translate("+(row_max_label_width+0)+", "+(col_max_label_height)+")");

  //set content size
  var content_width  = row_max_label_width + (this.col_ctg_array.length * this.cell_size) + 5;
  var content_height = col_max_label_height + (this.row_ctg_array.length * this.cell_size) + 5;
  console.log(this.elementID+" col_ctg len:"+(this.col_ctg_array.length)+"  cell_size:"+this.cell_size+"  row_label:"+row_max_label_width+"  content_width:"+content_width);
    
//   //draw label border box
//   var d = ["M", row_max_label_width+2, content_height-5,
//            "L", row_max_label_width+2, col_max_label_height+2,
//            "L", content_width-5, col_max_label_height+2];
//   var line1 = g1.appendChild(document.createElementNS(svgNS,'path'));
//   line1.setAttributeNS(null, 'd', d.join(" "));
//   line1.setAttributeNS(null, 'stroke', "#303030");
//   line1.setAttributeNS(null, 'stroke-width', "1px");
//   line1.setAttributeNS(null, 'fill', "transparent");


  var matrix_signal_min = this.matrix_signal_min;
  var matrix_signal_max = this.matrix_signal_max; 
  if(this.colorspace_min != "auto") { matrix_signal_min = parseFloat(this.colorspace_min); }
  if(this.colorspace_max != "auto") { matrix_signal_max = parseFloat(this.colorspace_max); }
    
  //placeholder for the matrix to make sure I have position correct  
  var matrix_g = g1.appendChild(document.createElementNS(svgNS,'g')); 
  for(var idx1=0; idx1<this.row_ctg_array.length; idx1++) {
    var row_ctg_obj = this.row_ctg_array[idx1];

    for(var idx2=0; idx2<this.col_ctg_array.length; idx2++) {
      var col_ctg_obj = this.col_ctg_array[idx2];
      
      var cell_key = row_ctg_obj.ctg +"_"+ col_ctg_obj.ctg;
      var cell_obj = this.heatmap_matrix[cell_key];
          
      var tcx = row_max_label_width +2 + ((idx2+0) * this.cell_size);
      var tcy = col_max_label_height +2 + ((idx1+0) * this.cell_size);
      
      var tcolor = this.background_color; //"rgb(186,186,186)";  //background color
      if(cell_obj != undefined && !isNaN(cell_obj.signal)) { 
        //tcolor = "orange";
        var cs = cell_obj.signal;
        if(this.colorspace_zero_center) {
          if((cell_obj.signal < 0.0) && (matrix_signal_min < 0.0)) { 
            cs = cell_obj.signal / (0.0 - matrix_signal_min);
            //console.log("zero_center NEG "+cell_obj.row+" "+cell_obj.col+" sig: "+cell_obj.signal+" cs:"+cs);
          }
          if(cell_obj.signal>0 && matrix_signal_max>0) {
            cs = cell_obj.signal / (matrix_signal_max - 0.0);
            //console.log("zero_center POS "+cell_obj.row+" "+cell_obj.col+" sig: "+cell_obj.signal+" cs:"+cs);              
          }
        } else {
          //console.log("normal 0-1 colorscale sig: "+cell_obj.signal+" cs:"+cs);              
          if(matrix_signal_max > matrix_signal_min) { 
            cs = (cell_obj.signal - matrix_signal_min) / (matrix_signal_max - matrix_signal_min);
          }
        }
        var color = zenbuScoreColorSpace(this.colorspace, cs, false, this.colorspace_logscale, this.colorspace_invert, this.colorspace_zero_center);
        tcolor = color.getCSSHexadecimalRGB();
      }
        
        
      var cell_rect = matrix_g.appendChild(document.createElementNS(svgNS,'rect'));
      cell_rect.setAttributeNS(null, 'x', tcx+'px');
      cell_rect.setAttributeNS(null, 'y', tcy+'px');
      cell_rect.setAttributeNS(null, 'width', (this.cell_size-1)+"px");
      cell_rect.setAttributeNS(null, 'height', (this.cell_size-1)+"px");
      cell_rect.setAttributeNS(null, 'fill', tcolor); //"rgb(100,245,250)"); //"rgb(245,245,250)"
      //cell_rect.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
      //cell_rect.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      //cell_rect.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
      
      //in google Chrome, can not mix onclick and onmouseover, so must use onmousedown instead
      //cell_rect.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
      cell_rect.setAttribute("onmouseover", "zenbuHeatmapElement_hoverInfo('"+this.elementID+"','"+(row_ctg_obj.ctg)+"','"+(col_ctg_obj.ctg)+"');");
      cell_rect.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    }
  }
  

  //reset the SVG and element to the new bounded size
  svg.setAttributeNS(null, 'width', content_width+'px');
  svg.setAttributeNS(null, 'height', content_height+'px');

  this.content_width  = content_width;  //+2
  this.content_height = content_height; //need to set for the layout algorithms
  if(current_report.edit_page_configuration || this.show_titlebar) { this.content_height += 25; }
  this.auto_content_height = true;
  this.main_div.style.width = (this.content_width)+"px";
  reportElementDrawTitlebar(this);
}



//=================================================================================
//
// helper functions
//
//=================================================================================
/*
function zenbu_heatmap_ctg_count_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.filtered && !b.filtered) { return -1; }
  if(!a.filtered && b.filtered) { return 1; }
  if(b.count > a.count) { return 1; }
  if(b.count < a.count) { return -1; }
  if(b.hidden_count > a.hidden_count) { return 1; }
  if(b.hidden_count < a.hidden_count) { return -1; }
  return 0;
}
*/

function zenbu_heatmap_ctg_value_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  //if(a.filtered && !b.filtered) { return -1; }
  //if(!a.filtered && b.filtered) { return 1; }
  if(b.value > a.value) { return -1; }
  if(b.value < a.value) { return 1; }

  var a_ctg = a.ctg;
  var b_ctg = b.ctg;
  if(a_ctg) { a_ctg = a_ctg.toLowerCase(); }
  if(b_ctg) { b_ctg = b_ctg.toLowerCase(); }

  if(b_ctg > a_ctg) { return -1; }
  if(b_ctg < a_ctg) { return 1; }

  return 0;
}

/*
 function zenbu_heatmap_ctg_mean_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.filtered && !b.filtered) { return -1; }
  if(!a.filtered && b.filtered) { return 1; }
  if(b.value/b.count > a.value/a.count) { return 1; }
  if(b.value/b.count < a.value/a.count) { return -1; }
  return 0;
}
*/

function zenbu_heatmap_ctg_name_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.filtered && !b.filtered) { return -1; }
  if(!a.filtered && b.filtered) { return 1; }
  
  var a_ctg = a.ctg;
  var b_ctg = b.ctg;
  if(a_ctg) { a_ctg = a_ctg.toLowerCase(); }
  if(b_ctg) { b_ctg = b_ctg.toLowerCase(); }

  if(b_ctg > a_ctg) { return -1; }
  if(b_ctg < a_ctg) { return 1; }
  return 0;
}
