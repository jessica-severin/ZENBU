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


//var element = new ZenbuCategoryElement();

function ZenbuCategoryElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuCategoryElement");
  this.element_type = "category";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);

  this.title_prefix = "";
  this.title = "";
  //this.datasource_mode = "";
  this.show_titlebar = true;
  this.widget_search = false;
  this.widget_filter = false;
  this.category_datatype = "";
  this.hide_zero = true;
  this.radio_list = false;
  this.show_filter_bars = true;
  this.show_percent_bars = false;
  this.filter_bar_ratio = 0.5;
  this.display_type = "filter_list";
  this.category_method = "count";
  this.ctg_value_datatype = "";
  this.colorspace = "Set3_bp_12";
  this.selected_dtype = null;
  
  //methods
  this.initFromConfigDOM  = zenbuCategoryElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuCategoryElement_generateConfigDOM;  //returns a ConfigDOM object

  this.resetElement       = zenbuCategoryElement_reset;
  this.postprocessElement = zenbuCategoryElement_postprocess;
  this.drawElement        = zenbuCategoryElement_draw;

  this.elementEvent       = zenbuCategoryElement_elementEvent;
  this.reconfigureParam   = zenbuCategoryElement_reconfigureParam;

  this.configSubpanel     = zenbuCategoryElement_configSubpanel;

  //internal methods
  this.drawFilterList   = zenbuCategoryElement_drawFilterList;
  this.drawChart        = zenbuCategoryElement_drawChart;
  //this.drawBarChart     = zenbuCategoryElement_drawBarChart;

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================

function zenbuCategoryElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "category") { return false; }
  
  //TODO: eventually maybe a superclass init call here
  this.radio_list = false;
  if(elementDOM.getAttribute("category_datatype")) { this.category_datatype = elementDOM.getAttribute("category_datatype"); }
  if(elementDOM.getAttribute("display_type"))      { this.display_type = elementDOM.getAttribute("display_type"); }
  if(elementDOM.getAttribute("colorspace"))        { this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("radio_list")=="true") { this.radio_list = true; }

  if(elementDOM.getAttribute("show_filter_bars")=="false") { this.show_filter_bars = false; } else { this.show_filter_bars = true; }
  if(elementDOM.getAttribute("show_percent_bars")=="true") { this.show_percent_bars = true; } else { this.show_percent_bars = false; }
  if(elementDOM.getAttribute("filter_bar_ratio")) { this.filter_bar_ratio = parseFloat(elementDOM.getAttribute("filter_bar_ratio")); }
  return true;
}


function zenbuCategoryElement_generateConfigDOM() {
  //TODO: need to figure this out, not currently using
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  elementDOM.setAttribute("display_type", this.display_type);
  if(this.category_datatype) { elementDOM.setAttribute("category_datatype", this.category_datatype); }
  if(this.category_method) { elementDOM.setAttribute("category_method", this.category_method); }
  if(this.ctg_value_datatype) { elementDOM.setAttribute("ctg_value_datatype", this.ctg_value_datatype); }
  if(this.colorspace) { elementDOM.setAttribute("colorspace", this.colorspace); }
  if(this.radio_list) { elementDOM.setAttribute("radio_list", "true"); }
  elementDOM.setAttribute("filter_bar_ratio", this.filter_bar_ratio);
  if(this.show_filter_bars) { elementDOM.setAttribute("show_filter_bars", "true"); } else { elementDOM.setAttribute("show_filter_bars", "false"); }
  if(this.show_percent_bars) { elementDOM.setAttribute("show_percent_bars", "true"); } else { elementDOM.setAttribute("show_percent_bars", "false"); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuCategoryElement_elementEvent(mode, value, value2) {
  var datasourceElement = this.datasource();
  if(mode == "dtype-category-filter") {  
    //console.log("zenbuCategoryElement_elementEvent ["+this.elementID+"] "+mode+" "+value+" "+value2);
    var dtype = datasourceElement.datatypes[value];
    if(dtype && dtype.categories) { 
      if(this.radio_list) { 
        for(var ctg in dtype.categories) {
          dtype.categories[ctg].filtered = false;
          if(ctg == value2) { dtype.categories[value2].filtered = true; }
        }
      } 
      else if(dtype.categories[value2]) {
        dtype.categories[value2].filtered = !(dtype.categories[value2].filtered);
      }
      
      dtype.filtered = false;
      for(var ctg in dtype.categories) {
        if(dtype.categories[ctg].filtered) {
          dtype.filtered = true;
          break;          
        }
      }
      reportsPostprocessElement(datasourceElement.elementID);
      if(this.elementID != datasourceElement.elementID) { 
        reportsDrawElement(datasourceElement.elementID);
      }
      reportElementTriggerCascade(this, "filter_change");
    }
  }
}


function zenbuCategoryElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //TODO: eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  //category
  if(param == "category_datatype") { this.newconfig.category_datatype = value; }
  if(param == "display_type") { this.newconfig.display_type = value; }
  if(param == "hide_zero") { this.newconfig.hide_zero = value; }
  if(param == "radio_list") { this.newconfig.radio_list = value; }
  if(param == "show_filter_bars") { this.newconfig.show_filter_bars = value; }
  if(param == "show_percent_bars") { this.newconfig.show_percent_bars = value; }
  if(param == "filter_bar_ratio") { this.newconfig.filter_bar_ratio = value; return true; }
  if(param == "colorspace") { this.newconfig.colorspace = value; }

  if(param == "accept-reconfig") {
    //this.needReload=true;
    if(this.newconfig.category_datatype !== undefined)   { this.category_datatype = this.newconfig.category_datatype; }
    if(this.newconfig.display_type !== undefined)        { this.display_type = this.newconfig.display_type; }
    if(this.newconfig.hide_zero !== undefined)           { this.hide_zero = this.newconfig.hide_zero; }
    if(this.newconfig.radio_list !== undefined)          { this.radio_list = this.newconfig.radio_list; }
    if(this.newconfig.show_filter_bars !== undefined)    { this.show_filter_bars = this.newconfig.show_filter_bars; }
    if(this.newconfig.show_percent_bars !== undefined)   { this.show_percent_bars = this.newconfig.show_percent_bars; }
    if(this.newconfig.filter_bar_ratio !== undefined)    { this.filter_bar_ratio = this.newconfig.filter_bar_ratio; }
    if(this.newconfig.colorspace !== undefined)          { this.colorspace = this.newconfig.colorspace; }
  }
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuCategoryElement_reset() {
  //console.log("zenbuCategoryElement_reset ["+this.elementID+"]");
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  
  this.postprocessElement();
}



function zenbuCategoryElement_postprocess() {
  //console.log("zenbuCategoryElement_postprocess "+this.elementID);
  var starttime = new Date();

  this.loading = false;
    
  var datasourceElement = this.datasource();  
  if(!datasourceElement.dtype_columns) { return; }
  var columns = datasourceElement.dtype_columns;
  
  var category_datatype = this.category_datatype;
  if(this.newconfig && this.newconfig.category_datatype != undefined) { category_datatype = this.newconfig.category_datatype; }
  
  var selected_dtype = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if(dtype_col.datatype == category_datatype) { selected_dtype = dtype_col; break; }
  }
  if(!selected_dtype) { return; }
  //console.log("selected_dtype type["+selected_dtype.datatype+"]  title["+selected_dtype.title+"]")
  if(selected_dtype.col_type != "mdata") { return; } //might loosen this in the future

  //scan the datasource column for all the different categories, count up and display
  if(!selected_dtype.categories) {
    selected_dtype.categories = new Object();
  }
  var categories = selected_dtype.categories;
  //clear the old counts
  for(var ctg in categories) {
    var ctg_obj = categories[ctg];
    ctg_obj.count = 0;
    ctg_obj.hidden_count = 0;
    ctg_obj.value = null;
  }
  this.selected_dtype = selected_dtype;
  
  function update_category(dtype_col, ctgval, filter_valid, category_method, signal) {
    if(!ctgval) { return; }
    var categories = dtype_col.categories;
    if(!categories[ctgval]) { categories[ctgval] = {ctg:ctgval, count:0, hidden_count:0, value:null, filtered:false}; }
    if(!filter_valid) { categories[ctgval].hidden_count++; return; }
    categories[ctgval].count++;
    
    if(category_method=="count") { return; }
    if(signal==null) { return; }
    
    //console.log("update_category ["+ctgval+"] mode["+category_method+"] sig["+signal+"]");
    switch(category_method) {
      case "min": 
        if(categories[ctgval].value==null) { categories[ctgval].value = signal; }
        if(signal < categories[ctgval].value) { categories[ctgval].value = signal; }
        break;
      case "max": 
        if(categories[ctgval].value==null) { categories[ctgval].value = signal; }
        if(signal > categories[ctgval].value) { categories[ctgval].value = signal; }
        break;
      case "sum": 
      case "mean": 
        if(categories[ctgval].value==null) { categories[ctgval].value = signal; }
        else { categories[ctgval].value += signal; }
        break;
      default: 
        break;
    }
  };

  //recalc if this is filtered or not
  var is_filtered = false;
  for(var ctg in selected_dtype.categories) {
    if(selected_dtype.categories[ctg].filtered) {
      is_filtered = true;
    }
  }
  if(selected_dtype.filtered != is_filtered) { console.log("DANGER!! selected_dtype.filtered out of sync with categories"); }
  selected_dtype.filtered = is_filtered;

  var max_cnt=0;
  if(datasourceElement.datasource_mode == "edge")    {
    var datatype = selected_dtype.datatype
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');
    console.log("zenbuCategoryElement_postprocess edges type["+datatype+"]")

    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.feature1) { continue; }
      if(!edge.feature2) { continue; }

      //check for focus_feature sub-selection
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }
      //if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }

      var t_feature = null;
      if(edge && (/^f1\./.test(selected_dtype.datatype))) { t_feature = edge.feature1;}
      if(edge && (/^f2\./.test(selected_dtype.datatype))) { t_feature = edge.feature2;}

      //specific logic rather than using object.filter_valid
      if(!reportElementEdgeCheckValidFilters(datasourceElement, edge)) { continue; }
      selected_dtype.filtered=false;
      if(!reportElementCheckCategoryFilters(datasourceElement, edge)) {
        //even with this filter turned off it is still filter out so really filtered so skip it
        if(is_filtered) { selected_dtype.filtered=true; }
        continue;
      }
      if(is_filtered) { selected_dtype.filtered=true; }
      
      var signal = 0;
      if(this.ctg_value_datatype) {
        var ctg_value_datatype = this.ctg_value_datatype;
        ctg_value_datatype = ctg_value_datatype.replace(/^f1\./, '');
        ctg_value_datatype = ctg_value_datatype.replace(/^f2\./, '');

        var sig_feature = null;
        if(edge && (/^f1\./.test(this.ctg_value_datatype))) { sig_feature = edge.feature1;}
        if(edge && (/^f2\./.test(this.ctg_value_datatype))) { sig_feature = edge.feature2;}

        if(sig_feature && sig_feature.expression_hash && 
           sig_feature.expression_hash[ctg_value_datatype] && 
           sig_feature.expression_hash[ctg_value_datatype][0]) {
          signal = sig_feature.expression_hash[ctg_value_datatype][0].total;
        }
        if(edge && edge.weights && edge.weights[ctg_value_datatype] && edge.weights[ctg_value_datatype][0]) {
          signal = edge.weights[ctg_value_datatype][0].weight;
        }
      }

      if(t_feature) {
        var filtered =reportsObjectCheckCategoryFilters(t_feature, selected_dtype);
        if(t_feature.source && (datatype == "category")) {
          //console.log("check t_feature "+t_feature.name+" -- category");
          update_category(selected_dtype, t_feature.source.category, filtered, this.category_method, signal);
        } else if(t_feature.source && (datatype == "source_name")) {
          //console.log("check t_feature "+t_feature.name+" -- source_name");
          update_category(selected_dtype, t_feature.source.name, filtered, this.category_method, signal);
        } else if(datatype == "location_string") {
          //console.log("check t_feature "+t_feature.name+" -- location_string");
          update_category(selected_dtype, t_feature.chromloc, filtered, this.category_method, signal);
        } else  if(datatype == "name") {
          update_category(selected_dtype, t_feature.name, filtered, this.category_method, signal);
        } else if(t_feature.mdata && t_feature.mdata[datatype]) {
          //console.log("check t_feature "+t_feature.name+" -- "+selected_dtype.datatype+"  mdata["+datatype+"]");
          var value_array = t_feature.mdata[datatype];
          for(var idx1=0; idx1<value_array.length; idx1++) {
            val = value_array[idx1];
            update_category(selected_dtype, val, filtered, this.category_method, signal);
          }
        }
      } else { //selected_dtype is on the edge
        var filtered =reportsObjectCheckCategoryFilters(edge, selected_dtype);
        //console.log("check edge name["+edge.name+"]");
        if(edge.source && (datatype == "category")) {
          update_category(selected_dtype, edge.source.category, filtered, this.category_method, signal);
        } else if(edge.source && (datatype == "source_name")) {
          update_category(selected_dtype, edge.source.name, filtered, this.category_method, signal);
        } else if(datatype == "location_string") {
          update_category(selected_dtype, edge.chromloc, filtered, this.category_method, signal);
        } else if(edge.mdata && edge.mdata[datatype]) {
          var value_array = edge.mdata[datatype];
          for(var idx1=0; idx1<value_array.length; idx1++) {
            val = value_array[idx1];
            update_category(selected_dtype, val, filtered, this.category_method, signal);
          }
        }
      }      
    }  //loop on edges
  }
  
  if(datasourceElement.datasource_mode == "feature") {
    var datatype = selected_dtype.datatype
    console.log("zenbuCategoryElement_postprocess features type["+datatype+"]")
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      
      //specific logic rather than using object.filter_valid
      if(!reportElementCheckValidSignalFilters(datasourceElement, feature)) { continue; }
      selected_dtype.filtered=false;
      if(!reportElementCheckCategoryFilters(datasourceElement, feature)) {
        //even with this filter turned off it is still filter out so really filtered so skip it
        if(is_filtered) { selected_dtype.filtered=true; }
        continue;
      }
      if(is_filtered) { selected_dtype.filtered=true; }

      var signal = 0;
      if(feature.expression_hash && feature.expression_hash[this.ctg_value_datatype] && feature.expression_hash[this.ctg_value_datatype][0]) {
        signal = feature.expression_hash[this.ctg_value_datatype][0].total;
      }
      
      var val = "";
      if(feature.source && (datatype == "category")) {
        //console.log("check feature "+feature.name+" -- category");
        update_category(selected_dtype, feature.source.category, feature.filter_valid, this.category_method, signal);
      } else if(feature.source && (datatype == "source_name")) {
        //console.log("check feature "+feature.name+" -- source_name");
        update_category(selected_dtype, feature.source.name, feature.filter_valid, this.category_method, signal);
      } else if(datatype == "location_string") {
        //console.log("check feature "+feature.name+" -- location_string");
        update_category(selected_dtype, feature.chromloc, feature.filter_valid, this.category_method, signal);
      } else  if(datatype == "name") {
        update_category(selected_dtype, feature.name, feature.filter_valid, this.category_method, signal);
      } else if(feature.mdata && feature.mdata[datatype]) {
        //console.log("check feature "+feature.name+" -- "+selected_dtype.datatype+"  mdata["+datatype+"]");
        var value_array = feature.mdata[datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          val = value_array[idx1];
          update_category(selected_dtype, val, feature.filter_valid, this.category_method, signal);
        }
      }
    }
  }
  
  if(datasourceElement.datasource_mode == "source") {
    //filter_count = datasourceElement.feature_array.length;
    for(j=0; j<datasourceElement.sources_array.length; j++) {
      var source = datasourceElement.sources_array[j];
      if(!source) { continue; }

      //specific logic rather than using object.filter_valid
      selected_dtype.filtered=false;
      if(!reportElementCheckCategoryFilters(datasourceElement, source)) {
        //even with this filter turned off it is still filter out so really filtered so skip it
        if(is_filtered) { selected_dtype.filtered=true; }
        continue;
      }
      if(is_filtered) { selected_dtype.filtered=true; }

      var val = "";
      if(selected_dtype.datatype == "category") {
        val = source.category;
        if(val && !categories[val]) { categories[val] = {ctg:val, count:0, value:0, filtered:false}; }
        if(source.filter_valid) { categories[val].count++; }
      } else if(selected_dtype.datatype == "source_name") {
        val = source.name;
        if(val && !categories[val]) { categories[val] = {ctg:val, count:0, value:0, filtered:false}; }
        if(source.filter_valid) { categories[val].count++; }
      } else if(source.mdata && source.mdata[selected_dtype.datatype]) {
        var value_array = source.mdata[selected_dtype.datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          val = value_array[idx1];
          if(val && !categories[val]) { categories[val] = {ctg:val, count:0, value:0, filtered:false}; }
          if(source.filter_valid) { categories[val].count++; }
        }
      }
    }
  }
  
  for(var ctg in categories) {
    var ctg_obj = categories[ctg];
    if(ctg_obj.count>max_cnt) { max_cnt=ctg_obj.count; }
    if(ctg_obj.hidden_count>max_cnt) { max_cnt=ctg_obj.hidden_count; }
    //console.log("dtype["+selected_dtype.datatype+"]  category ["+ctg_obj.ctg+"] cnt="+ctg_obj.count);
  }
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  //console.log("zenbuCategoryElement_postprocess "+this.elementID+" "+(runtime)+"msec");
}

//=================================================================================
//
// configSubpanel
//
//=================================================================================

function zenbuCategoryElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();
    
  //display_type
  var display_type = this.display_type;
  if(this.newconfig && this.newconfig.display_type != undefined) { display_type = this.newconfig.display_type; }
  
  var tdiv2 = configdiv.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 0px 5px;");
  span1.innerHTML = "display type: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'display_type', this.value);");
  var types = ["filter_list", "piechart", "doughnut", "bar", "horizontalBar"];
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == display_type) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }

  //category method
  var category_method = this.category_method;
  if(this.newconfig && this.newconfig.category_method != undefined) { category_method = this.newconfig.category_method; }

  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 15px;");
  span1.innerHTML = "category method: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'category_method', this.value);");
  var methods = ["count", "sum", "mean", "min", "max"];
  for(var i=0; i<methods.length; i++) {
    var val1 = methods[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == category_method) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }
  
  //column datatype selection options
  var tdiv2 = configdiv.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 5px;");
  span1.innerHTML = "category column: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'category_datatype', this.value);");

  var select2 = null;
  if(category_method != "count") {
    tdiv3  = configdiv.appendChild(document.createElement('div'));
    var span1 = tdiv3.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin: 2px 1px 2px 5px;");
    span1.innerHTML = "value column: ";
    select2 = tdiv3.appendChild(document.createElement('select'));
    select2.className = "dropdown";
    select2.style.fontSize = "10px";
    select2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'ctg_value_datatype', this.value);");
  }

  //hide_zero
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 3px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.hide_zero;
  if(this.newconfig && this.newconfig.hide_zero != undefined) { val1 = this.newconfig.hide_zero; }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'hide_zero', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide zero value categories";

  if(display_type == "filter_list") {
    tcheck = tdiv2.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 3px 1px 0px 15px;");
    tcheck.setAttribute('type', "checkbox");
    var val1 = this.radio_list;
    if(this.newconfig && this.newconfig.radio_list != undefined) { val1 = this.newconfig.radio_list; }
    if(val1) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'radio_list', this.checked);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "radio list (single select)";

    tdiv2  = configdiv.appendChild(document.createElement('div'));
    
    var filter_bar_ratio = this.filter_bar_ratio;
    if(this.newconfig && this.newconfig.filter_bar_ratio != undefined) { filter_bar_ratio = this.newconfig.filter_bar_ratio; }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 10px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "bar width ratio:";
    var ratioInput = tdiv2.appendChild(document.createElement('input'));
    ratioInput.className = "sliminput";
    ratioInput.setAttribute('size', "5");
    ratioInput.setAttribute('type', "text");
    ratioInput.setAttribute('value', filter_bar_ratio);
    ratioInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID+"\", 'filter_bar_ratio', this.value);");
    ratioInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+ this.elementID+"\", 'update'); }");    

    var show_filter_bars = this.show_filter_bars;
    if(this.newconfig && this.newconfig.show_filter_bars != undefined) { show_filter_bars = this.newconfig.show_filter_bars; }
    tcheck = tdiv2.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 3px 1px 0px 15px;");
    tcheck.setAttribute('type', "checkbox");
    if(show_filter_bars) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_filter_bars', this.checked);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "show bars";

    var show_percent_bars = this.show_percent_bars;
    if(this.newconfig && this.newconfig.show_percent_bars != undefined) { show_percent_bars = this.newconfig.show_percent_bars; }
    tcheck = tdiv2.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 3px 1px 0px 15px;");
    tcheck.setAttribute('type', "checkbox");
    if(show_percent_bars) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_percent_bars', this.checked);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "percentage bars";
  }
  
  
  if(datasourceElement.dtype_columns) {
    datasourceElement.dtype_columns.sort(reports_column_order_sort_func);
    var columns = datasourceElement.dtype_columns;

    var category_datatype = this.category_datatype;
    if(this.newconfig && this.newconfig.category_datatype != undefined) { category_datatype = this.newconfig.category_datatype; }
    var ctg_value_datatype = this.ctg_value_datatype;
    if(this.newconfig && this.newconfig.ctg_value_datatype != undefined) { ctg_value_datatype = this.newconfig.ctg_value_datatype; }

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
      } else if(select2) {
        if(dtype_col.datatype == ctg_value_datatype) { option.setAttribute("selected", "selected"); }
        select2.appendChild(option);
      }
    }
  }


  if(display_type != "filter_list") {
    tdiv2  = configdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute('style', "margin-top: 10px;");
    tdiv2.appendChild(reportElementColorSpaceOptions(this));
  }

  configdiv.appendChild(document.createElement('hr'));
}

//=================================================================================
//
// Draw section
//
//=================================================================================

function zenbuCategoryElement_draw() {
  //console.log("zenbuCategoryElement_draw "+this.elementID);
  if((this.display_type == "piechart") || (this.display_type == "doughnut") || (this.display_type == "bar") || (this.display_type == "horizontalBar")) {
    this.drawChart();
  } else {
    this.drawFilterList();
  }
}

function zenbuCategoryElement_drawFilterList() {
  //console.log("zenbuCategoryElement_drawFilterList");
  if(this.loading) { return; }

  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();

  var datasourceElement = this.datasource();

  if(!datasourceElement.dtype_columns) { return; }

  /*
  var selected_feature = datasourceElement.selected_feature;
  var selected_edge = datasourceElement.selected_edge;
  var selected_source = datasourceElement.selected_source;
  var focus_feature = datasourceElement.focus_feature;

  if(datasourceElement.selected_id) {
    console.log("zenbuCategoryElement_draw selected_id ["+datasourceElement.selected_id+"]");
  }
  if(datasourceElement.selected_feature) {
    console.log("zenbuCategoryElement_draw selected_feature ["+datasourceElement.selected_feature.name +" "+datasourceElement.selected_feature.id +"]");
  }
  if(datasourceElement.selected_edge) {
    console.log("zenbuCategoryElement_draw selected_edge ["+datasourceElement.selected_edge.id +"]");
  }
  if(datasourceElement.selected_source) {
    console.log("zenbuCategoryElement_draw selected_source ["+datasourceElement.selected_source.name +" "+datasourceElement.selected_source.id +"]");
  }
  */
  var columns = datasourceElement.dtype_columns;  

  var category_datatype = this.category_datatype;
  if(this.newconfig && this.newconfig.category_datatype != undefined) { category_datatype = this.newconfig.category_datatype; }

  var selected_dtype = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }  
    if(dtype_col.datatype == category_datatype) { selected_dtype = dtype_col; break; }  
  }
  if(!selected_dtype) { return; }

  //contents
  var tdiv, tspan, tinput, ta;
  if(this.chartTitleArea) { this.chartTitleArea.nodeValue = selected_dtype.title; }
  else {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "text-align:left; font-size:14px; font-weight:bold; font-family:arial,helvetica,sans-serif; background-color:#FDFDFD; word-wrap:break-word; ");
    tdiv.innerHTML = selected_dtype.title;
  }

  //scan the datasource column for all the different categories, count up and display
  if(!selected_dtype.categories) { selected_dtype.categories = new Object(); }
  var categories = selected_dtype.categories;

  /*
  //clear the old counts
  for(var ctg in categories) {
    var ctg_obj = categories[ctg];
    ctg_obj.count = 0;
  }

  var max_cnt=0;
  if(datasourceElement.datasource_mode == "edge")    {
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.feature1) { continue; }
      if(!edge.feature2) { continue; }

      var t_feature = null;
      if(edge && (/^f1\./.test(dtype_col.datatype))) { t_feature = edge.feature1;}
      if(edge && (/^f2\./.test(dtype_col.datatype))) { t_feature = edge.feature2;}

      //var ctg = edge.mdata[selected_dtype.datatype]
      if(!edge.filter_valid) { continue; }
      if(this.show_only_search_matches && !edge.search_match) { continue; }
      if(this.focus_feature &&
         (this.focus_feature.id != edge.feature1_id) &&
         (this.focus_feature.id != edge.feature2_id)) { continue; }
      //TODO: maybe also implement the multi-select filter_feature_ids or some new multi-select-trigger layer
      //this.filter_count++;
      //display_list.push(edge);
    }
  }
  if(datasourceElement.datasource_mode == "feature") {
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      var ctg = "";
      //if(!feature.filter_valid) { continue; }
      if(this.show_only_search_matches && !feature.search_match) { continue; }
      //this.filter_count++;
      //display_list.push(feature);
    }
  }
  if(datasourceElement.datasource_mode == "source") {
    //filter_count = datasourceElement.feature_array.length;
    var is_filtered = selected_dtype.filtered;
    for(j=0; j<datasourceElement.sources_array.length; j++) {
      var source = datasourceElement.sources_array[j];
      if(!source) { continue; }
      if(is_filtered) {
        selected_dtype.filtered=false;
        reportElementCheckCategoryFilters(datasourceElement, source);
      }
      var val = "";
      if(selected_dtype.datatype == "category") {
        val = source.category;
        if(val && !categories[val]) { categories[val] = {ctg:val, count:0, filtered:false}; }
        if(source.filter_valid) { categories[val].count++; }
      } else if(selected_dtype.datatype == "source_name") {
        val = source.name;
        if(val && !categories[val]) { categories[val] = {ctg:val, count:0, filtered:false}; }
        if(source.filter_valid) { categories[val].count++; }
      } else if(source.mdata && source.mdata[selected_dtype.datatype]) {
        var value_array = source.mdata[selected_dtype.datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) {
          val = value_array[idx1];
          if(val && !categories[val]) { categories[val] = {ctg:val, count:0, filtered:false}; }
          if(source.filter_valid) { categories[val].count++; }
        }
      }
      if(is_filtered) {
        selected_dtype.filtered=true;
        reportElementCheckCategoryFilters(datasourceElement, source);
      }
    }
  }
  */
  
  var max_cnt=0;
  var total_cnt =0;
  var ctg_array = new Array();
  for(var ctg in categories) {
    var ctg_obj = categories[ctg];
    total_cnt += ctg_obj.count + ctg_obj.hidden_count;
    if(ctg_obj.count>max_cnt) { max_cnt=ctg_obj.count; }
    if(ctg_obj.hidden_count>max_cnt) { max_cnt=ctg_obj.hidden_count; }
    //console.log("category ["+ctg_obj.ctg+"] cnt="+ctg_obj.count);
    ctg_array.push(ctg_obj);
  }

  switch(this.category_method) {
    case "count": ctg_array.sort(category_count_sort_func); break;
    case "mean":  ctg_array.sort(category_mean_sort_func);  break;
    default:      ctg_array.sort(category_value_sort_func); break;
  }
  
  var content_width = 100;
  var content_height = 100;
  if(this.content_width)  { content_width = this.content_width; }
  if(this.content_height) { content_height = this.content_height; }

  var ctg_main_div = main_div.appendChild(document.createElement('div'));
  ctg_main_div.setAttribute('style', "overflow:hidden; padding:0px; margin:0px;");
  if(current_report.edit_page_configuration) { ctg_main_div.style.backgroundColor = "#F0F0F0"; }
  ctg_main_div.style.width  = (content_width-2)+"px";
  
  if(!this.auto_content_height) {
    ctg_main_div.style.height = (content_height-24)+"px";
    var tdiv = ctg_main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "overflow-y:scroll;");
    tdiv.style.width  = (content_width+30)+"px";
    tdiv.style.height = (content_height-24)+"px";
    content_width -= 30;
    ctg_main_div = tdiv;
  } else { content_width -= 20; }
  
  var bar_width = (content_width) * this.filter_bar_ratio;
  
  for(var idx1=0; idx1<ctg_array.length; idx1++) {
    var ctg_obj = ctg_array[idx1];
    
    if(this.hide_zero && !ctg_obj.filtered && (ctg_obj.count==0) && (ctg_obj.hidden_count==0)) { continue; }
    
    var tdiv = ctg_main_div.appendChild(document.createElement('div'));
    style ="margin: 0px 0px 0px 0px; text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; background-color:#FDFDFD;  word-wrap:break-word; ";
    //"background-color:#FAFAFA; border:inset; border-width:2px; padding: 5px 5px 5px 5px; ";
    //"padding: 5px 5px 5px 5px; overflow: auto; resize: both; ";
    //"padding: 5px 5px 5px 5px; overflow-y:scroll; resize:both; ";
    //style += "min-width:100px; ";
    //if(this.content_width) { style += "width:"+(this.content_width-2)+"px; "; }
    tdiv.setAttribute('style', style);

    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('type', "checkbox");
    if(this.radio_list) { 
      tcheck.setAttribute('type', "radio");
      tcheck.setAttribute("name", this.main_div_id + "_radio_list");
    }
    tcheck.setAttribute('style', "margin:0px 0px 0px 0px; padding:0px 0px;");
    //tcheck.setAttribute("onclick", "reportsChangeGlobalParameter('compacted_tracks', this.checked);");
    tcheck.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'dtype-category-filter', \""+selected_dtype.datatype+"\", \""+ctg_obj.ctg+"\"); return false");
    if(ctg_obj.filtered) { 
      tcheck.setAttribute('checked', "checked");
      tdiv.style.backgroundColor = "#F0F0F0";   //"E8E8E8";
    }

    var tspan1 = tdiv.appendChild(document.createElement('span'));
    tspan1.setAttribute('style', "display:inline-block; margin-left:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;");
    //tspan1.style.width = ((content_width-30)/2)+"px";
    tspan1.style.width = (content_width - bar_width)+"px";
    tspan1.innerHTML = ctg_obj.ctg;
    if(selected_dtype.filtered) { tspan1.style.fontWeight = "bold"; }

    var tspan2 = tdiv.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "display:inline-block; position:relative; margin-left:2px; border-radius:7px; height:14px; font-size:10px;");
    //tspan2.style.backgroundColor = "lightgray";
    var ctg_count = ctg_obj.count;
    if(ctg_obj.count==0 && ctg_obj.hidden_count>0) { ctg_count = ctg_obj.hidden_count; }
    if(this.show_filter_bars) {
      if(this.show_percent_bars) { tspan2.style.backgroundColor = "lightgray"; }
      //('style', "display:inline-block; position:relative; margin-left:2px; background-color:lightgray; border-radius:7px; height:14px; font-size:10px;");
      //tspan2.style.width = ((content_width-30)/2)+"px";
      tspan2.style.width = (bar_width)+"px";
      //var varwidth = ((content_width-30)/2)*(ctg_count/max_cnt);
      //var varwidth = ((content_width-30)/2)*(ctg_count/total_cnt);
      var varwidth = bar_width*(ctg_count/max_cnt);
      if(this.show_percent_bars) { varwidth = bar_width*(ctg_count/total_cnt); }
      tspan3 = tspan2.appendChild(document.createElement('span'));
      var bckcolor = "lightblue";
      if(ctg_obj.filtered) { bckcolor = "#a7f1a7"; }
      tspan3.setAttribute('style', "display:inline-block; position:absolute; background-color:"+bckcolor+"; border-radius:7px; height:14px; right:0px; top:0px;");
      if(varwidth>12) { tspan3.style.width = parseInt(varwidth)+"px"; }
      else {
        tspan3.style.width = "12px";
        var clip1 = tspan2.appendChild(document.createElement('span'));
        clip1.setAttribute('style', "display:inline-block; position:absolute; height:14px; right:0px; top:0px; overflow:hidden;");
        clip1.style.width = parseInt(varwidth)+"px";
        clip1.appendChild(tspan3);
      }
    }
    tspan4 = tspan2.appendChild(document.createElement('span'));
    tspan4.setAttribute('style', "display:inline-block; position:absolute; text-align:right; left:0px; top:1px; white-space:nowrap;");
    tspan4.appendChild(document.createTextNode(ctg_count));
    //tspan4.style.width = parseInt((content_width-30)/2)+"px";
    tspan4.style.width = parseInt(bar_width-4)+"px";
  }
}


function zenbuCategoryElement_drawChart() {
  //console.log("zenbuCategoryElement_drawChart");
  if(this.loading) { return; }
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();
  
  var datasourceElement = this.datasource();
  
  if(!datasourceElement.dtype_columns) { return; }
  
  var columns = datasourceElement.dtype_columns;
  
  var category_datatype = this.category_datatype;
  if(this.newconfig && this.newconfig.category_datatype != undefined) { category_datatype = this.newconfig.category_datatype; }
  
  var selected_dtype = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if(dtype_col.datatype == category_datatype) { selected_dtype = dtype_col; break; }
  }
  if(!selected_dtype) { return; }
  
  //contents
  var tdiv, tspan, tinput, ta;
  if(this.chartTitleArea) { this.chartTitleArea.nodeValue = selected_dtype.title; }
  else {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "text-align:left; font-size:14px; font-weight:bold; font-family:arial,helvetica,sans-serif; background-color:#FDFDFD; word-wrap:break-word; ");
    tdiv.innerHTML = selected_dtype.title;
  }
  
  //scan the datasource column for all the different categories, count up and display
  if(!selected_dtype.categories) { selected_dtype.categories = new Object(); }
  var categories = selected_dtype.categories;
  
  
  var max_cnt=0;
  var ctg_array = new Array();
  for(var ctg in categories) {
    var ctg_obj = categories[ctg];
    if(ctg_obj.count>max_cnt) { max_cnt=ctg_obj.count; }
    if(ctg_obj.hidden_count>max_cnt) { max_cnt=ctg_obj.hidden_count; }
    //console.log("category ["+ctg_obj.ctg+"] cnt="+ctg_obj.count);
    ctg_array.push(ctg_obj);
  }
  switch(this.category_method) {
    case "count": ctg_array.sort(category_count_sort_func); break;
    case "mean":  ctg_array.sort(category_mean_sort_func); break;
    default:      ctg_array.sort(category_value_sort_func); break;
  }
  
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

  //build the chart_data
  this.chart_data = new Object;
  this.chart_data.labels   = [];
  this.chart_data.datasets = [{ data:[], backgroundColor:[] }];

  var colorspace = this.colorspace;
  //if(this.newconfig && (this.newconfig.colorspace !== undefined)) { colorspace = this.newconfig.colorspace; }

  for(var idx1=0; idx1<ctg_array.length; idx1++) {
    var ctg_obj = ctg_array[idx1];
    
    if(this.hide_zero && !ctg_obj.filtered && (ctg_obj.count==0)) { continue; }
    
    this.chart_data.labels.push(ctg_obj.ctg);
    if(this.category_method=="count") {
      this.chart_data.datasets[0].data.push(ctg_obj.count);
    } else if(this.category_method=="mean") {
      this.chart_data.datasets[0].data.push(ctg_obj.value/ctg_obj.count);
    } else {
      this.chart_data.datasets[0].data.push(ctg_obj.value);
    }
    
    //var color = zenbuIndexColorSpace("Set3_bp_12", idx1);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11
    var color = zenbuIndexColorSpace(colorspace, idx1);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11
    this.chart_data.datasets[0].backgroundColor.push(color.getCSSHexadecimalRGB());
  }
  
  var ctx = canvas.getContext('2d');
  
  var draw_type = "pie";
  var show_legend = true;
  if(this.display_type == "piechart") { draw_type = "pie"; }
  if(this.display_type == "doughnut") { draw_type = "doughnut"; }
  if(this.display_type == "bar") { draw_type = "bar"; show_legend = false; }
  if(this.display_type == "horizontalBar") { draw_type = "horizontalBar"; show_legend = false; }

  var minRotate = 45;
  if(this.chart_data.labels.length<=5) { minRotate = 0; }
  
  var options = { responsive: false,
                  maintainAspectRatio: false,
                  legend: { display: show_legend },
                  title: {
                    display: false,
                    text: ''
                  }
                };
  if(this.display_type == "bar") {
    var ylabel = "count";
    if(this.category_method!="count") {
      var dtype_col = datasourceElement.datatypes[this.ctg_value_datatype];
      if(dtype_col) {
        ylabel = dtype_col.title;
        //if(dtype_col.title != dtype_col.datatype) { ylabel += " ["+ dtype_col.datatype +"]"; }
      }
    }
    options.scales = { 
      xAxes: [{
        ticks: { autoSkip:false, minRotation:minRotate, padding:2, fontSize:8 },
      }],
      yAxes: [{ 
        ticks: { padding:2, fontSize:8 },
        scaleLabel: {
          display: true,
          labelString: ylabel,
        },
      }]
    };
    if(this.category_method=="count") { options.scales.yAxes[0].ticks.min = 0; }
  }
  if(this.display_type == "horizontalBar") {
    var ylabel = "count";
    if(this.category_method!="count") {
      var dtype_col = datasourceElement.datatypes[this.ctg_value_datatype];
      if(dtype_col) {
        ylabel = dtype_col.title;
        //if(dtype_col.title != dtype_col.datatype) { ylabel += " ["+ dtype_col.datatype +"]"; }
      }
    }

    options.scales = { 
      xAxes: [{ 
        ticks: { padding:2, fontSize:8 },
        scaleLabel: {
          display: true,
          labelString: ylabel,
        },
      }],
      yAxes: [{ 
        ticks: { autoSkip:false, minRotation:0, padding:2, fontSize:10 }, 
      }]
    };
    if(this.category_method=="count") { options.scales.xAxes[0].ticks.min = 0; }
  }

  this.chart = new Chart(ctx, {   type: draw_type,
                                  data: this.chart_data,
                                  options: options
                                  });
                                  
  this.chart.elementID = this.elementID;
  this.chart.update(0);
}


//=================================================================================
//
// helper functions
//
//=================================================================================

function category_count_sort_func(a,b) {
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

function category_value_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.filtered && !b.filtered) { return -1; }
  if(!a.filtered && b.filtered) { return 1; }
  if(b.value > a.value) { return 1; }
  if(b.value < a.value) { return -1; }
  return 0;
}

function category_mean_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  if(a.filtered && !b.filtered) { return -1; }
  if(!a.filtered && b.filtered) { return 1; }
  if(b.value/b.count > a.value/a.count) { return 1; }
  if(b.value/b.count < a.value/a.count) { return -1; }
  return 0;
}
