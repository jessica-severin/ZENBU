/* $Id: zenbu_filter_element.js,v 1.5 2023/06/05 10:00:51 severin Exp $ */

// ZENBU zenbu_filter_element.js
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


//var element = new ZenbuFilterElement();

function ZenbuFilterElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuFilterElement");
  this.element_type = "filter";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);

  this.title_prefix = "Filter";
  this.title = "";
  this.description = "";
  this.content_height = 300;
  this.auto_content_height = true;
  //this.datasource_mode = "";
  this.show_titlebar = true;
  this.widget_search = false;
  this.widget_filter = false;
  this.widget_columns = false;
  this.signal_datatype = "";
  this.dtype_filterbars = new Object; //hash to hold the filterbars for the active filters;

  
  //methods
  this.initFromConfigDOM  = zenbuFilterElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuFilterElement_generateConfigDOM;  //returns a ConfigDOM object

  this.resetElement       = zenbuFilterElement_reset;
  this.postprocessElement = zenbuFilterElement_postprocess;
  this.drawElement        = zenbuFilterElement_draw;

  this.elementEvent       = zenbuFilterElement_elementEvent;
  this.reconfigureParam   = zenbuFilterElement_reconfigureParam;

  this.configSubpanel     = zenbuFilterElement_configSubpanel;

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================

function zenbuFilterElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "filter") { return false; }
  
  //TODO: eventually maybe a superclass init call here

  if(elementDOM.getAttribute("signal_datatype")) { this.signal_datatype = elementDOM.getAttribute("signal_datatype"); }
  
  var descDOM = elementDOM.getElementsByTagName("description")[0];
  if(descDOM) { this.description = descDOM.firstChild.nodeValue; }

  return true;
}


function zenbuFilterElement_generateConfigDOM() {
  //TODO: need to figure this out, not currently using
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  if(this.signal_datatype) { elementDOM.setAttribute("signal_datatype", this.signal_datatype); }
  if(this.description) {
    var desc = elementDOM.appendChild(document.createElement("description"));
    desc.innerHTML = escapeXml(this.description);
  }
  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuFilterElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this;
  //if(this.datasourceElementID) {
  //  var ds = current_report.elements[this.datasourceElementID];
  //  if(ds) { datasourceElement = ds; }
  //  else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  //}

  if(mode == "dtype-signal-filter") {  
    var dtype = this.datatypes[value];  //my copy of the datasource.datatypes
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
      reportsPostprocessElement(this.elementID);  //global function for now  //TODO: replace with class hierchary?
    }
  }
}


function zenbuFilterElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //TODO: eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  //category
  if(param == "signal_datatype") { this.newconfig.signal_datatype = value; }
  
  if(param == "accept-reconfig") {
    if(this.newconfig.signal_datatype !== undefined) { 
      if(this.signal_datatype != this.newconfig.signal_datatype) {
        console.log("signal_datatype changed "+this.signal_datatype+" => "+this.newconfig.signal_datatype);
        var datasourceElement = this.datasource();
        var dtype1 = datasourceElement.datatypes[this.signal_datatype];
        var dtype2 = datasourceElement.datatypes[this.newconfig.signal_datatype];
        if(dtype1) { dtype1.filtered = false; } //disable the previous filter
        if(dtype2) { dtype2.filtered = true; }  //enable the new filter
      }    
      this.signal_datatype = this.newconfig.signal_datatype;
    }
    if(this.newconfig.description !== undefined) { this.description = this.newconfig.description; }
    reportsPostprocessElement(this.elementID);
  }
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuFilterElement_reset() {
  //console.log("zenbuFilterElement_reset ["+this.elementID+"]");
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  
  this.postprocessElement();
}



function zenbuFilterElement_postprocess() {
  console.log("zenbuFilterElement_postprocess "+this.elementID);
  var starttime = new Date();

  this.loading = false;
    
  var datasourceElement = this.datasource();
  
  if(!datasourceElement.dtype_columns) { return; }
  var columns = datasourceElement.dtype_columns;
  
  var signal_datatype = this.signal_datatype;
  //if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }
  
  var selected_dtype = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if(dtype_col.datatype == signal_datatype) { selected_dtype = dtype_col; break; }
  }
  if(!selected_dtype) { return; }
  //console.log("selected_dtype type["+selected_dtype.datatype+"]  title["+selected_dtype.title+"]")
  if((selected_dtype.col_type != "weight") && (selected_dtype.col_type != "signal")) { return; } 

  this.selected_dtype = selected_dtype;
  //this.title_prefix = "Filter: "+selected_dtype.title;
  this.title_prefix = selected_dtype.title;

  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  //console.log("zenbuFilterElement_postprocess "+this.elementID+" "+(runtime)+"msec");
}

//=================================================================================
//
// configSubpanel
//
//=================================================================================

function zenbuFilterElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var signal_datatype = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }  
  var description = this.description;
  if(this.newconfig && this.newconfig.description != undefined) { description = this.newconfig.description; }

  console.log("zenbuFilterElement_configSubpanel "+this.elementID+" signal_datatype["+signal_datatype+"]");

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
  
  //tdiv2 = configdiv.appendChild(document.createElement("div"));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 15px; vertical-align: middle; ");
  tcheck.setAttribute('type', "checkbox");
  //tcheck.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'filter_abs', this.value);");
  if(selected_dtype) {
    if(selected_dtype.filter_abs) { tcheck.setAttribute('checked', "checked"); }
    tcheck.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-abs', \""+selected_dtype.datatype+"\"); return false");
  }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute("style", "margin-bottom:3px;");
  tspan2.innerHTML = "absolute value";


  if(!selected_dtype && first_dtype) {
    console.log("no selected_dtype, so set to first: "+first_dtype);
    if(this.newconfig) { this.newconfig.signal_datatype = first_dtype; }
    else { this.signal_datatype = first_dtype; }
  }
  
  //-------
  var div1 = configdiv.appendChild(document.createElement('div'));
  var span0 = div1.appendChild(document.createElement('span'));
  span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin: 2px 1px 2px 5px;");
  span0.innerHTML = "description:";
  var descInput = div1.appendChild(document.createElement('textarea'));
  descInput.setAttribute('style', "width:385px; margin: 3px 5px 3px 7px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 3);
  descInput.setAttribute('value', description);
  descInput.innerHTML = description;
  descInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'description', this.value);");
  //descInput.setAttribute("onkeydown", "if(event.keyCode==13) { reportElementReconfigParam(\""+ this.elementID+"\", 'update'); }");
  descInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");

  configdiv.appendChild(document.createElement('hr'));
}

//=================================================================================
//
// Draw section
//
//=================================================================================

function zenbuFilterElement_draw() {
  //console.log("zenbuFilterElement_draw "+this.elementID);
  if(this.loading) { return; }
  //console.log("filtersubpanel "+this.elementID+"]");
    
  var datasourceElement = this.datasource();
  //console.log("filtersubpanel "+this.elementID+" datasource ["+datasourceElement.elementID+"]");
  if(!datasourceElement.dtype_columns) { return; }
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  var mainRect = main_div.getBoundingClientRect();
  
  var panelID = this.main_div_id + "_filter_subpanel"; //for hyjacking reportElementFilterHoverValue()

  var columns = datasourceElement.dtype_columns;  

  var signal_datatype = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }

  var selected_dtype = null;
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }  
    if(dtype_col.datatype == signal_datatype) { selected_dtype = dtype_col; break; }  
  }
  if(!selected_dtype) { return; }
  if((selected_dtype.col_type != "weight") && (selected_dtype.col_type != "signal")) { return; }  //maybe "expression" or "signal"

  //contents
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck, tspan, ta;
  
  console.log("zenbuFilterElement_draw "+this.elementID+" selected_dtype: "+selected_dtype.datatype);
    
  //----
  if(this.description) {
    var tdiv = main_div.appendChild(document.createElement("div"));
    tdiv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 2px 5px 2px 5px;");
    tdiv.innerHTML = this.description;
  }  
  
  //----
  var tdiv2= main_div.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif;");
  //tdiv2.setAttribute('style', "border-bottom: solid 1px gray; margin: 0px 0px 0px 15px;");
  tdiv2.setAttribute('style', "margin: 2px 0px 2px 0px;");
  
  if(!selected_dtype.filtered) {
    button = tdiv2.appendChild(document.createElement("input"));
    button.type = "button";
    button.className = "medbutton";
    button.value = "re-activate filter";
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-add', \""+selected_dtype.datatype+"\"); return false");
    return;
  }
    
  var inputWidth = (mainRect.width - 128) / 2;
  if(selected_dtype.filter_abs) { inputWidth -= 30; }
  if(inputWidth<20) { inputWidth=20; }
  
  var minSpan = tdiv2.appendChild(document.createElement('span'));
  minSpan.setAttribute("style", "white-space: nowrap;");
    
  var tspan = minSpan.appendChild(document.createElement('span'));
  tspan.innerHTML = "min: ";
  if(selected_dtype.filter_abs) { tspan.innerHTML = "min abs(): "; }

  var input = minSpan.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.setAttribute('type', "text");
  //input.setAttribute('size', "5");
  input.style.marginLeft = "0px";
  input.style.width = inputWidth +"px";
  if(selected_dtype.filter_min=="min") { input.setAttribute('value', "min"); }
  else { input.setAttribute('value', selected_dtype.filter_min.toPrecision(6)); }
  input.setAttribute("onchange", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-min', \""+selected_dtype.datatype+"\", this.value); return false");
      
  //if(this.content_width<200) { tdiv2.appendChild(document.createElement('br')); }

  var maxSpan = tdiv2.appendChild(document.createElement('span'));
  maxSpan.setAttribute("style", "white-space: nowrap;");
  var tspan = maxSpan.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin-left:5px;");
  tspan.innerHTML = "max: ";
  if(selected_dtype.filter_abs) { tspan.innerHTML = "max abs(): "; }
  var input = maxSpan.appendChild(document.createElement('input'));
  input.className = "sliminput";  
  input.setAttribute('type', "text");
  //input.setAttribute('size', "5");
  input.style.marginLeft = "0px";
  input.style.width = inputWidth +"px";
  if(selected_dtype.filter_max=="max") { input.setAttribute('value', "max"); }
  else { input.setAttribute('value', selected_dtype.filter_max.toPrecision(6)); }
  input.setAttribute("onchange", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-max', \""+selected_dtype.datatype+"\", this.value); return false");
  
  var img = tdiv2.appendChild(document.createElement("img"));
  img.setAttribute('style', "margin: 0px 0px 4px 5px; vertical-align:bottom;");
  //img.src = "https://fantom.gsc.riken.jp/zenbu/images/close_icon16px_gray.png";
  img.src = "/zenbu/images/close_icon16px_gray.png";
  img.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  img.setAttribute("onmouseover", "eedbMessageTooltip(\"deactivate filter\",100);");
  img.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'dtype-filter-remove', \""+selected_dtype.datatype+"\"); return false");
  
  //display double range bar info-graphic
  var bar_width = mainRect.width-25;
  
  var tdiv2= main_div.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin: 2px 0px 2px 2px;");
  
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "display:inline-block; position:relative; background-color:lightgray; border-radius:7px; height:14px; font-size:8px;");
  tspan2.style.width = bar_width+"px";
  //mouseover-hover display of the numerical value
  tspan2.setAttribute("onmousemove", "reportElementFilterHoverValue(\""+this.elementID+"\", \""+selected_dtype.datatype+"\");");
  tspan2.setAttribute("onmousedown", "reportElementFilterHoverValue(\""+this.elementID+"\", \""+selected_dtype.datatype+"\", 'start');");
  tspan2.setAttribute("onmouseup", "reportElementFilterHoverValue(\""+this.elementID+"\", \""+selected_dtype.datatype+"\", 'end');");
  tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");

  tspan2.id = panelID+"_filter_bar_"+dtype_col.datatype;

  var max_val = selected_dtype.max_val;
  if(selected_dtype.filter_abs && (Math.abs(selected_dtype.min_val)>max_val)) {
    max_val = Math.abs(selected_dtype.min_val);
  }
  var min_val = selected_dtype.min_val;
  if(selected_dtype.filter_abs) { min_val = 0.0; }

  var filter_min = selected_dtype.filter_min;
  if(selected_dtype.filter_min=="min") { filter_min = min_val; }
  if(filter_min<min_val) { filter_min=min_val; }
  var filter_max = selected_dtype.filter_max;
  if(selected_dtype.filter_max=="max") { filter_max = max_val; }

  var varleft  = bar_width*((filter_min-min_val)/(max_val-min_val));
  var varwidth = bar_width*((filter_max-filter_min)/(max_val-min_val));
  if(selected_dtype.filter_abs) {
    //center with zero at middle
    varwidth = bar_width*(filter_max/max_val);
    varleft  = (bar_width-varwidth)/2.0;
  }
  if(isNaN(varleft)) { varleft=0; }
  if(isNaN(varwidth)) { varwidth=0; }
  if(!isFinite(varleft)) { varleft=0; }
  if(!isFinite(varwidth)) { varwidth=0; }
  
  var clip1 = tspan2.appendChild(document.createElement('span'));
  clip1.setAttribute('style', "display:inline-block; position:absolute; height:14px; left:0px; top:0px; overflow:hidden;");
  clip1.style.left  = "0px";
  clip1.style.width = bar_width+"px";

  var bar1 = clip1.appendChild(document.createElement('span'));
  bar1.setAttribute('style', "display:inline-block; position:absolute; background-color:rgb(255,190,0); border-radius:7px; height:14px; left:0px; top:0px;");
  bar1.style.left  = varleft+"px";
  bar1.style.width = varwidth+"px";

  if(varwidth<12) {
    bar1.style.left = "0px";
    bar1.style.width = "12px";
    clip1.style.left = varleft+"px";
    clip1.style.width = varwidth+"px";
    //clip1.appendChild(bar1);
  }
  
  var filterBar = new Object;
  filterBar.bar1 = bar1;
  filterBar.bar2 = null;
  filterBar.clip1 = clip1;
  filterBar.bar_width = bar_width;
  
  if(selected_dtype.filter_abs) {
    //add a gray "mask" in the center
    var t_width = bar_width*(filter_min/max_val);
    var t_left  = (bar_width-t_width)/2.0;
    if(isNaN(t_left)) { t_left=0; }
    if(isNaN(t_width)) { t_width=0; }
    if(!isFinite(t_left)) { t_left=0; }
    if(!isFinite(t_width)) { t_width=0; }
    var bar2 = clip1.appendChild(document.createElement('span'));
    bar2.setAttribute('style', "display:inline-block; position:absolute; background-color:lightgray; height:14px; left:0px; top:0px;");
    bar2.style.left  = t_left+"px";
    bar2.style.width = t_width+"px";
    //selected_dtype.filterBar_bar2  = bar2;
    filterBar.bar2 = bar2;
  }
  
  this.dtype_filterbars[selected_dtype.datatype] = filterBar; //to work with reportElementFilterHoverValue and reportElementFilterbarUpdate
}

