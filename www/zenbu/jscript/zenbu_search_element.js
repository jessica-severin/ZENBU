/* $Id: zenbu_search_element.js,v 1.1 2020/10/05 07:20:29 severin Exp $ */

// ZENBU zenbu_search_element.js
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


//var element = new ZenbuSearchElement();

function ZenbuSearchElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuSearchElement");
  this.element_type = "search";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);

  this.title_prefix = "Search";
  this.title = "";
  this.content_width = 500;
  this.content_height = 300;
  this.auto_content_height = true;
  this.border = "simple";
  //this.datasource_mode = "";
  this.show_titlebar = false;
  this.widget_search = false;
  this.widget_filter = false;
  this.widget_columns = false;
  this.signal_datatype = "";
  this.filter_abs = false;
  this.hide_zero = true;
  
  //methods
  this.initFromConfigDOM  = ZenbuSearchElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = ZenbuSearchElement_generateConfigDOM;  //returns a ConfigDOM object

  this.resetElement       = ZenbuSearchElement_reset;
  this.postprocessElement = ZenbuSearchElement_postprocess;
  this.drawElement        = ZenbuSearchElement_draw;

  this.elementEvent       = ZenbuSearchElement_elementEvent;
  this.reconfigureParam   = ZenbuSearchElement_reconfigureParam;

  this.configSubpanel     = ZenbuSearchElement_configSubpanel;

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================

function ZenbuSearchElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "search") { return false; }
  
  return true;
}


function ZenbuSearchElement_generateConfigDOM() {
  //TODO: need to figure this out, not currently using
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function ZenbuSearchElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this;
  //if(this.datasourceElementID) {
  //  var ds = current_report.elements[this.datasourceElementID];
  //  if(ds) { datasourceElement = ds; }
  //  else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  //}
}


function ZenbuSearchElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //TODO: eventually a superclass method here, but for now a hybrid function=>obj.method approach    
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function ZenbuSearchElement_reset() {
  //console.log("ZenbuSearchElement_reset ["+this.elementID+"]");
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  
  this.postprocessElement();
}



function ZenbuSearchElement_postprocess() {
  console.log("ZenbuSearchElement_postprocess "+this.elementID);
  var starttime = new Date();
  //Do I need to do anything here?
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  //console.log("ZenbuSearchElement_postprocess "+this.elementID+" "+(runtime)+"msec");
}

//=================================================================================
//
// configSubpanel
//
//=================================================================================

function ZenbuSearchElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  /*
  var signal_datatype = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }
  
  var filter_abs = this.filter_abs;
  if(this.newconfig && this.newconfig.filter_abs != undefined) { filter_abs = this.newconfig.filter_abs; }

  console.log("ZenbuSearchElement_configSubpanel "+this.elementID+" signal_datatype["+signal_datatype+"]");

  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();  

  //column datatype selection options
  var tdiv2 = configdiv.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 5px;");
  span1.innerHTML = "filter column: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'signal_datatype', this.value);");

  var selected_dtype = null;
  var first_dtype = "";

  if(datasourceElement.dtype_columns && datasourceElement.dtype_columns.length>0) {
    console.log("rebuild the dtype_columns select on datasource: "+datasourceElement.elementID);
    datasourceElement.dtype_columns.sort(reports_column_order_sort_func);
    var columns = datasourceElement.dtype_columns;

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

      if((dtype_col.col_type == "weight") || (dtype_col.col_type == "signal")) {
        if(!first_dtype) { first_dtype = dtype_col.datatype; }
        if(dtype_col.datatype == signal_datatype) { 
          option.setAttribute("selected", "selected"); 
          selected_dtype = dtype_col;
        }
        select.appendChild(option);
      }
    }
  }
  
  tdiv2 = configdiv.appendChild(document.createElement("div"));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 15px; vertical-align: middle; ");
  tcheck.setAttribute('type', "checkbox");
  if(filter_abs) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'filter_abs', this.value);");

  //tcheck.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-abs', \""+selected_dtype.datatype+"\"); return false");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute("style", "margin-bottom:3px;");
  tspan2.innerHTML = "absolute value";


  if(!selected_dtype && first_dtype) {
    console.log("no selected_dtype, so set to first: "+first_dtype);
    if(this.newconfig) { this.newconfig.signal_datatype = first_dtype; }
    else { this.signal_datatype = first_dtype; }
  }
  
  configdiv.appendChild(document.createElement('hr'));
  */
}

//=================================================================================
//
// Draw section
//
//=================================================================================

function ZenbuSearchElement_draw() {
  console.log("ZenbuSearchElement_draw "+this.elementID);
    
  var datasourceElement = this.datasource();
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();

  var searchdiv = document.createElement('div');
  main_div.appendChild(searchdiv);
  /*
   searchdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                            "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                            //"width:"+(width-30)+"px; display:none; opacity: 0.95; " +
                            "width:350px; display:none; opacity: 1.0; " +
                            "position:absolute; top:20px; right:10px;"
                            );
  */
  searchdiv.innerHTML = "";

  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;

  //search_data_filter
  var div1 = searchdiv.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
 
  if(this.title) {
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "margin-right:3px; font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold; ");
    span0.innerHTML = this.title + ":";
  }
  
  var filter = datasourceElement.search_data_filter;
  //if(this.newconfig && this.newconfig.search_data_filter != undefined) { filter = this.newconfig.search_data_filter; }
  if(!filter) { filter = ""; }
  var filterInput = div1.appendChild(document.createElement('input'));
  filterInput.className = "sliminput";
  filterInput.style.width = "235px";
  //filterInput.setAttribute('style', "width:270px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  //filterInput.setAttribute('style', "width:235px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  filterInput.setAttribute('type', "text");
  filterInput.setAttribute('value', filter);
  filterInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+datasourceElement.elementID+"\", 'search_data_filter_search'); }");    
  filterInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");
  filterInput.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");
  filterInput.setAttribute("onblur", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter', this.value);");

  search_button = div1.appendChild(document.createElement("button"));
  search_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
  //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  search_button.setAttribute("onclick", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'search_data_filter_search');");
  search_button.innerHTML = "search";

  clear_button = div1.appendChild(document.createElement("button"));
  clear_button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:3px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
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
  // var feature_matches=0;
  // for(var k=0; k<feature_count; k++) {
  //   var feature = datasourceElement.feature_array[k];
  //   if(!feature) { continue; }
  //   if(feature.search_match) { feature_matches++; }
  // }
  // var edge_matches=0;
  // for(var k=0; k<datasourceElement.edge_array.length; k++) {
  //   var edge = datasourceElement.edge_array[k];
  //   if(!edge) { continue; }
  //   if(!edge.filter_valid) { continue; }
  //   if(edge.search_match) { edge_matches++; }
  // }
  // if(this.datasource_mode == "edge" && edge_matches==0) { feature_matches=0; }

  var feature_matches = datasourceElement.search_match_feature_count;
  var edge_matches    = datasourceElement.search_match_edge_count;
  var source_matches  = datasourceElement.search_match_source_count;

  if(feature_matches>0 || edge_matches>0 || source_matches>0) {
    tdiv = searchdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:12px; margin-left:10px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "color:#0000D0;"); //0071EC
    tspan.innerHTML = "found matching";
    
    //if(this.datasource_mode == "feature") { }
  
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
  }
  if(filter!="" && feature_matches==0 && edge_matches==0 && source_matches==0) {
    tdiv = searchdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:12px; margin-left:10px;");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding-left:5px;");
    tspan.innerHTML = "no matches found";
  }

  tdiv = searchdiv.appendChild(document.createElement('div'));
  radio1 = tdiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_searchmatchmode");
  radio1.setAttribute("value", "show_highlight");
  if(!(datasourceElement.show_only_search_matches)) { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'show_only_search_matches', false);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "highlight matches";
  
  radio2 = tdiv.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio2.setAttribute("name", this.elementID + "_searchmatchmode");
  radio2.setAttribute("value", "show_only");
  if(datasourceElement.show_only_search_matches) { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ datasourceElement.elementID +"\", 'show_only_search_matches', true);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "show only matches";
  
  return searchdiv;
}
