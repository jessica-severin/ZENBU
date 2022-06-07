/* $Id: zenbu_colorscale_element.js,v 1.7 2020/12/22 01:20:30 severin Exp $ */

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


//var element = new ZenbuColorscaleElement();

function ZenbuColorscaleElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuColorscaleElement");
  this.element_type = "colorscale";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);

  this.title_prefix = "Colorscale";
  this.title = "";
  this.description = "";
  this.orientation = "horizontal";
  this.content_height = 300;
  this.auto_content_height = true;
  //this.datasource_mode = "";
  this.show_titlebar = false;
  this.widget_search = false;
  this.widget_filter = false;
  this.widget_download = false;
  this.widget_columns = false;
  
  this.signal_datatype = "";
  this.colorspace = "Set3_bp_12";
  this.colorspace_min = "auto";
  this.colorspace_max = "auto"; 
  this.colorspace_logscale = false;
  this.colorspace_invert = false;
  this.colorspace_zero_center = false;

  //methods
  this.initFromConfigDOM  = zenbuColorscaleElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuColorscaleElement_generateConfigDOM;  //returns a ConfigDOM object

  this.resetElement       = zenbuColorscaleElement_reset;
  this.postprocessElement = zenbuColorscaleElement_postprocess;
  this.drawElement        = zenbuColorscaleElement_draw;

  this.elementEvent       = zenbuColorscaleElement_elementEvent;
  this.reconfigureParam   = zenbuColorscaleElement_reconfigureParam;

  this.configSubpanel     = zenbuColorscaleElement_configSubpanel;

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================

function zenbuColorscaleElement_initFromConfigDOM(elementDOM) {
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "colorscale") { return false; }
  
  if(elementDOM.getAttribute("orientation"))           { this.orientation = elementDOM.getAttribute("orientation"); }
  if(elementDOM.getAttribute("signal_datatype"))       { this.signal_datatype = elementDOM.getAttribute("signal_datatype"); }
  if(elementDOM.getAttribute("colorspace"))            { this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("colorspace_min"))        { this.colorspace_min = elementDOM.getAttribute("colorspace_min"); }
  if(elementDOM.getAttribute("colorspace_max"))        { this.colorspace_max = elementDOM.getAttribute("colorspace_max"); }
  if(elementDOM.getAttribute("colorspace_invert") == "true") { this.colorspace_invert = true; }
  if(elementDOM.getAttribute("colorspace_logscale") == "true") { this.colorspace_logscale = true; }
  if(elementDOM.getAttribute("colorspace_zero_center") == "true") { this.colorspace_zero_center = true; }

  var descDOM = elementDOM.getElementsByTagName("description")[0];
  if(descDOM) { this.description = descDOM.firstChild.nodeValue; }

  return true;
}


function zenbuColorscaleElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  elementDOM.setAttribute("colorspace", this.colorspace);
  elementDOM.setAttribute("colorspace_min", this.colorspace_min);
  elementDOM.setAttribute("colorspace_max", this.colorspace_max);
  elementDOM.setAttribute("orientation", this.orientation);
  if(this.signal_datatype) { elementDOM.setAttribute("signal_datatype", this.signal_datatype); }
  if(this.colorspace_logscale) { elementDOM.setAttribute("colorspace_logscale", "true"); }
  if(this.colorspace_invert) { elementDOM.setAttribute("colorspace_invert", "true"); }
  if(this.colorspace_zero_center) { elementDOM.setAttribute("colorspace_zero_center", "true"); }
  if(this.colorspace_logscale) { elementDOM.setAttribute("colorspace_logscale", "true"); }
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

function zenbuColorscaleElement_elementEvent(mode, value, value2) {
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


function zenbuColorscaleElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  if(param == "orientation") { 
    this.newconfig.orientation = value; 
    if(value == "vertical") { this.auto_content_height = false; }
    else { this.auto_content_height = true; }
  }
  if(param == "signal_datatype") { 
    this.newconfig.signal_datatype = value;
    reportsPostprocessElement(this.elementID);
  }
  
  if(param == "accept-reconfig") {
    if(this.newconfig.orientation !== undefined) { this.orientation = this.newconfig.orientation; }
    if(this.newconfig.description !== undefined) { this.description = this.newconfig.description; }
    if(this.newconfig.signal_datatype !== undefined) { this.signal_datatype = this.newconfig.signal_datatype; }
  }
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuColorscaleElement_reset() {
  //console.log("zenbuColorscaleElement_reset ["+this.elementID+"]");
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
  this.auto_content_height = true;
  this.postprocessElement();
}


function zenbuColorscaleElement_postprocess() {
  console.log("zenbuColorscaleElement_postprocess "+this.elementID);

  this.loading = false;
    
  var datasourceElement = this.datasource();  
  if(!datasourceElement) { return; }
  if(!datasourceElement.dtype_columns) { return; }
    
  var signal_datatype = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }

  this.signal_dtype_col = null;
  for(var i=0; i<datasourceElement.dtype_columns.length; i++) {
    var dtype_col = datasourceElement.dtype_columns[i];
    if(!dtype_col) { continue; }
    if((dtype_col.col_type != "weight") && (dtype_col.col_type != "signal")) { continue; }
    if(dtype_col.datatype == signal_datatype)  { this.signal_dtype_col = dtype_col; }
  }
  if(this.signal_dtype_col) {
    console.log("found signal_dtype "+(this.signal_dtype_col.datatype));
  }
}

//=================================================================================
//
// configSubpanel
//
//=================================================================================

function zenbuColorscaleElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var signal_datatype = this.signal_datatype;
  if(this.newconfig && this.newconfig.signal_datatype != undefined) { signal_datatype = this.newconfig.signal_datatype; }
  var orientation = this.orientation;
  if(this.newconfig && this.newconfig.orientation != undefined) { orientation = this.newconfig.orientation; }
  var description = this.description;
  if(this.newconfig && this.newconfig.description != undefined) { description = this.newconfig.description; }

  console.log("zenbuColorscaleElement_configSubpanel "+this.elementID+" signal_datatype["+signal_datatype+"]");
    
  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();  

  //column datatype selection options
  var tdiv2 = configdiv.appendChild(document.createElement("div"));
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 1px 2px 5px;");
  span1.innerHTML = "signal datatype: ";
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
  

  if(!selected_dtype && first_dtype) {
    console.log("no selected_dtype, so set to first: "+first_dtype);
    if(this.newconfig) { this.newconfig.signal_datatype = first_dtype; }
    else { this.signal_datatype = first_dtype; }
  }
  
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));  
  reportElementColorSpaceOptions(this);  //generate if needed
  this.colorspaceCSI.label = "color:";
  this.colorspaceCSI.enableScaling = true;
  if(this.signal_dtype_col) {
    this.colorspaceCSI.signalRangeMin = this.signal_dtype_col.min_val;
    this.colorspaceCSI.signalRangeMax = this.signal_dtype_col.max_val;
  }
  this.colorspaceCSI.min_signal = this.colorspace_min;
  this.colorspaceCSI.max_signal = this.colorspace_max;
  this.colorspaceCSI.style.marginLeft = "7px";
  zenbuColorSpaceInterfaceUpdate(this.colorspaceCSI.id);
  tdiv2.appendChild(this.colorspaceCSI);

  //-------
  tdiv2  = configdiv.appendChild(document.createElement('div'));  
  radio1 = tdiv2.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_config_orientation");
  radio1.setAttribute("value", "horizontal");
  if(orientation == "horizontal") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'orientation', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "horizontal";
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_config_orientation");
  radio2.setAttribute("value", "vertical");
  if(orientation == "vertical") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'orientation', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "vertical";

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

function zenbuColorscaleElement_draw() {
  console.log("zenbuColorscaleElement_draw "+this.elementID);
  if(this.loading) { 
    if(this.orientation=="vertical") { this.content_width = 100; }
    return;
  }

  if(!this.signal_dtype_col) { return; }

  var signal_min = this.signal_dtype_col.min_val;
  var signal_max = this.signal_dtype_col.max_val; 
  if(this.colorspace_min != "auto") { signal_min = parseFloat(this.colorspace_min); }
  if(this.colorspace_max != "auto") { signal_max = parseFloat(this.colorspace_max); }
  if(isNaN(signal_min)) { signal_min = 0.0; }
  if(isNaN(signal_max)) { signal_max = 1.0; }
  if(signal_min > signal_max) {
    var ts = signal_min;
    signal_min = signal_max;
    signal_max = ts;
  }
  if(signal_max == signal_min) { return; }

  var datasourceElement = this.datasource();
  if(!datasourceElement.dtype_columns) { return; }
  
  var main_div = this.main_div;
  if(!main_div) { return; }

  var vertical = false;
  if(this.orientation == "vertical") { 
    vertical = true; 
    main_div.style.minWidth = "30px";
  }

  //contents
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck, tspan, ta;
  
  var scale_width = this.content_width-2;
  if(vertical) { 
    scale_width = this.content_height - 2; 
    if(this.show_titlebar || current_report.edit_page_configuration) { scale_width -= 20; }
  }
  
  if(this.description) {
    var tdiv = main_div.appendChild(document.createElement("div"));
    tdiv.setAttribute("style", "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 2px 5px 2px 5px;");
    tdiv.innerHTML = this.description;
  }

  var svg = main_div.appendChild(document.createElementNS(svgNS,'svg'));
  if(vertical) {
    svg.setAttributeNS(null, 'height', scale_width+'px');
    svg.setAttributeNS(null, 'width', scale_width+'px');
  } else {
    svg.setAttributeNS(null, 'width', scale_width+'px');
    svg.setAttributeNS(null, 'height', "35");
  }
  
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size", "10px");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  svg.appendChild(g1);

  var colorspace_g = g1.appendChild(document.createElementNS(svgNS,'g'));
  var labels_g = g1.appendChild(document.createElementNS(svgNS,'g'));

  var margin = 20;
  if(vertical) { margin = 7; }
  var segwidth = 1.0;
  var segments = (scale_width-5-(margin*2))/segwidth;    
  var middle_seg = segments / 2;
  var max_width = 25;

 //scale axis
  var axis_d = ["M", margin, 22, "l", 0, -7, "L", margin+((segments+1)*segwidth), 15, "l",0,7];
  if(vertical) { axis_d = ["M", 22, margin, "l", -7, 0, "L", 15, margin+((segments+1)*segwidth),"l",7,0]; }
  
  if(this.colorspace_zero_center) { //zero colorspace_zero_center
    var tpos = margin+(middle_seg*segwidth);
    if(vertical) { axis_d.push("M", 15, tpos, "l", 7, 0); }
    else { axis_d.push("M", tpos, 15, "l", 0, 7); }

    var text = labels_g.appendChild(document.createElementNS(svgNS,'text'));
    text.setAttribute('x', '0px');
    text.setAttribute('y', '0px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    text.appendChild(document.createTextNode("0"));
    var bbox = text.getBBox();
    if(vertical) { text.setAttribute('transform', "translate(25, "+(tpos -2 + bbox.height/2)+")"); }
    else { text.setAttribute('transform', "translate("+(tpos - bbox.width/2)+","+(20+bbox.height)+")"); }
  }
  var text = labels_g.appendChild(document.createElementNS(svgNS,'text'));
  text.setAttribute('x', '0px');
  text.setAttribute('y', '0px');
  text.setAttributeNS(null, 'style', 'fill: black;');
  text.appendChild(document.createTextNode(signal_min));
  var bbox = text.getBBox();
  if(vertical) { text.setAttribute('transform', "translate(25, "+(margin -2 + bbox.height/2)+")"); }
  else { text.setAttribute('transform', "translate("+(margin - bbox.width/2)+","+(20+bbox.height)+")"); }

  var tpos = margin+((segments+1)*segwidth);
  var text = labels_g.appendChild(document.createElementNS(svgNS,'text'));
  text.setAttribute('x', '0px');
  text.setAttribute('y', '0px');
  text.setAttributeNS(null, 'style', 'fill: black;');
  text.appendChild(document.createTextNode(signal_max));
  var bbox = text.getBBox();
  if(vertical) { text.setAttribute('transform', "translate(25, "+(tpos -2 + bbox.height/2)+")"); }
  else { text.setAttribute('transform', "translate("+(tpos - bbox.width/2)+","+(20+bbox.height)+")"); }

  //loops on the segments
  for(var idx1=0; idx1<=segments; idx1++) {
    var tcolor = "rgb(186,186,186)";  //background color
  
    var signal = signal_min + ((idx1/segments) * (signal_max - signal_min));
    if(this.colorspace_zero_center) { //two halfs
      if(idx1 < middle_seg) { //signal_min..0 : left half
        signal = ((middle_seg - idx1) / middle_seg) * signal_min;
      } else { //0 .. signal_max : right half
        signal = ((idx1 - middle_seg) / middle_seg) * signal_max;
      }
    }
    if(signal < signal_min) { signal = signal_min; } //problem
    if(signal > signal_max) { signal = signal_max; } //problem

    var cs = signal;
    if(this.colorspace_zero_center) {
      if((signal < 0.0) && (signal_min < 0.0)) { 
        cs = signal / (0.0 - signal_min);
        //console.log("zero_center NEG "+cell_obj.row+" "+cell_obj.col+" sig: "+signal+" cs:"+cs);
      }
      if(signal>0 && signal_max>0) {
        cs = signal / (signal_max - 0.0);
        //console.log("zero_center POS "+cell_obj.row+" "+cell_obj.col+" sig: "+signal+" cs:"+cs);              
      }
    } else {
      cs = (signal - signal_min) / (signal_max - signal_min);  //0..1
    }
    var color = zenbuScoreColorSpace(this.colorspace, cs, false, this.colorspace_logscale, this.colorspace_invert, this.colorspace_zero_center);
    tcolor = color.getCSSHexadecimalRGB();
      
    var tcx = margin+ (idx1*segwidth);
    var tcy = 2;

    var line1 = colorspace_g.appendChild(document.createElementNS(svgNS,'line'));
    line1.setAttributeNS(null, 'stroke', tcolor);
    line1.setAttributeNS(null, 'stroke-width', "1px");
    line1.setAttributeNS(null, 'fill', "transparent");
    line1.setAttribute("onmouseover", "eedbMessageTooltip(\""+(signal.toPrecision(6))+"\",100);");
    line1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    
    if(vertical) {
      line1.setAttributeNS(null, 'y1', tcx);
      line1.setAttributeNS(null, 'y2', tcx);
      line1.setAttributeNS(null, 'x1', 2);
      line1.setAttributeNS(null, 'x2', 12);
    } else {
      line1.setAttributeNS(null, 'x1', tcx);
      line1.setAttributeNS(null, 'x2', tcx);
      line1.setAttributeNS(null, 'y1', 2);
      line1.setAttributeNS(null, 'y2', 12);
    }

//     var d = ["M", tcx, tcy, "l", 0, 10 ];
//     var line1 = colorspace_g.appendChild(document.createElementNS(svgNS,'path'));
//     line1.setAttributeNS(null, 'd', d.join(" "));
//     line1.setAttributeNS(null, 'stroke', tcolor);
//     line1.setAttributeNS(null, 'stroke-width', "1px");
//     line1.setAttributeNS(null, 'fill', "transparent");
//     line1.setAttribute("onmouseover", "eedbMessageTooltip(\""+(signal.toPrecision(6))+"\",100);");
//     line1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
 
//     var cell_rect = colorspace_g.appendChild(document.createElementNS(svgNS,'rect'));
//     cell_rect.setAttributeNS(null, 'x', tcx+'px');
//     cell_rect.setAttributeNS(null, 'y', tcy+'px');
//     cell_rect.setAttributeNS(null, 'width', "2px");
//     cell_rect.setAttributeNS(null, 'height', "10px");
//     cell_rect.setAttributeNS(null, 'fill', tcolor); //"rgb(100,245,250)"); //"rgb(245,245,250)"
//     //cell_rect.setAttributeNS(null, 'stroke', tcolor); //"rgb(100,245,250)"); //"rgb(245,245,250)"
// 
//     cell_rect.setAttribute("onmouseover", "eedbMessageTooltip(\""+(signal.toPrecision(6))+"\",100);");
//     cell_rect.setAttribute("onmouseout", "eedbClearSearchTooltip();");
//     //cell_rect.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");
    
    //in google Chrome, can not mix onclick and onmouseover, so must use onmousedown instead
    //cell_rect.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
    //cell_rect.setAttribute("onmouseover", "zenbuHeatmapElement_hoverInfo('"+this.elementID+"','"+(row_ctg_obj.ctg)+"','"+(col_ctg_obj.ctg)+"');");
    //cell_rect.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  }
 
  function adjust_tick(tick_val) {
    tick_val = Math.abs(tick_val);
    if(tick_val>2) { tick_val = Math.floor(tick_val); }
    if(tick_val>40 && tick_val<90) { tick_val = 50; }
    if(tick_val>15 && tick_val<=40) { tick_val = 25; }
    if(tick_val>9 && tick_val<=15) { tick_val = 10; }
    if(tick_val>3 && tick_val<=9) { tick_val = 5; }
    if(tick_val>1.5 && tick_val<=3) { tick_val = 2; }
    if(tick_val>0.6 && tick_val<=1.5) { tick_val = 1; }
    if(tick_val>0.3 && tick_val<=0.6) { tick_val = 0.5; }
    if(tick_val>0.1 && tick_val<=0.3) { tick_val = 0.25; }
    if(tick_val==0) { tick_val = 1.0; }
    return tick_val;
  }
  
  //signal_max ticks
  var sig_ref = signal_min;
  if(this.colorspace_zero_center) { sig_ref = 0.0; }
  var tick = adjust_tick((signal_max - sig_ref) / 4.0);
  var neg_tick = adjust_tick(Math.abs(signal_min / 4.0));

  //for(var tsig=signal_min; tsig<(signal_max-(tick/2)); tsig+=tick) {
  //var tsig=signal_min;  
  //TODO need to start on first tick after signal_min
  var tsig=0;
  if(signal_min<0) {
    while(tsig > signal_min) { tsig -= neg_tick; }
    tsig += neg_tick;
  }
  if(signal_min>0) {
    while(tsig < signal_min) { tsig += tick; }
  }
  
  while(tsig<(signal_max-(tick/2))) {
    if(tsig==0 && signal_min!=0) { tsig=tick; continue; }
    if(tsig<0 && tsig > -neg_tick/2) { tsig=tick; continue; } //skip zero from close-negative
    if(tsig>0 && tsig < tick/2) { tsig=tick; continue; } //skip zero from close-positive

    var idx1 = segments * ((tsig - sig_ref) / (signal_max - sig_ref));

    if(this.colorspace_zero_center) { 
      idx1 = middle_seg;
      if(tsig<0) {
        // signal = ((middle_seg - idx1) / middle_seg) * signal_min;
        // signal / signal_min = ((middle_seg - idx1) / middle_seg) ;
        // (signal / signal_min) * middle_seg = middle_seg - idx1 ;
        // ((signal / signal_min) * middle_seg) - middle_seg = - idx1 ;
        idx1 = middle_seg - ((tsig / signal_min) * middle_seg);
      }
      if(tsig>0) {
        //signal = ((idx1 - middle_seg) / middle_seg) * signal_max;
        //(signal / signal_max) = ((idx1 - middle_seg) / middle_seg);
        //(signal / signal_max)*middle_seg = ((idx1 - middle_seg));
        //((signal / signal_max)*middle_seg) + middle_seg = idx1;
        idx1 = middle_seg + ((tsig / signal_max) * middle_seg);
      }
    }
    var tcx = margin+(idx1 * segwidth);

    //add appropriate tick marks
    if(vertical) { axis_d.push("M", 15, tcx, "l", 7, 0); }
    else { axis_d.push("M", tcx, 15, "l", 0, 7); }

    var label = tsig;
//     if(Math.abs(tsig) < 100) { label = tsig.toFixed(0); }
//     if(Math.abs(tsig) < 5) { label = tsig.toFixed(1); }
//     if(Math.abs(tsig) < 2) { label = tsig.toFixed(2); }
//     if(tick >= 1) { label = tsig.toFixed(0); }
//     if(Math.abs(tsig) > 1000) { label = tsig.toPrecision(3); } //forces exp notation
//     if(tsig == signal_min) { label = tsig; }

    var text = labels_g.appendChild(document.createElementNS(svgNS,'text'));
    text.setAttribute('x', '0px');
    text.setAttribute('y', '0px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    text.appendChild(document.createTextNode(label));
    var bbox = text.getBBox();
    if(vertical) { text.setAttribute('transform', "translate(25, "+(tcx -2 + bbox.height/2)+")"); }
    else { text.setAttribute('transform', "translate("+(tcx - bbox.width/2)+","+(20+bbox.height)+")"); }

    //TODO: need signal_min is ok
    if(this.colorspace_zero_center && tsig<0) {
      tsig += neg_tick;
    } else {
      tsig += tick;      
    }
  }
  
  var line1 = g1.appendChild(document.createElementNS(svgNS,'path'));
  line1.setAttributeNS(null, 'd', axis_d.join(" "));
  line1.setAttributeNS(null, 'stroke', "#808080");
  line1.setAttributeNS(null, 'stroke-width', "1px");
  //line1.setAttributeNS(null, 'fill', "red");
  line1.setAttributeNS(null, 'fill', "transparent");
  
  var bbox = labels_g.getBBox();
  if(vertical) {
    this.content_width = bbox.width + bbox.x;
    if(current_report.edit_page_configuration) { this.content_width = 150; }
    console.log("colorscale calc width x:"+bbox.x+" w:"+bbox.width+" cw:"+this.content_width);
    svg.setAttributeNS(null, 'width', this.content_width+'px');
    this.auto_content_height = false;
    main_div.style.width = (this.content_width)+"px";
  } else {
    this.content_height = 50;
    if(current_report.edit_page_configuration || this.show_titlebar) { this.content_height += 25; }
    this.auto_content_height = true;  
  }

}

