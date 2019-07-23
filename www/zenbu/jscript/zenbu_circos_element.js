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


//var element = new ZenbuCircosElement();

function ZenbuCircosElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuCircosElement");
  this.element_type = "circos";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  //zenbuElement_init.call(this); //eventually when I refactor the superclass Element into object code

  this.title_prefix = "";
  this.datasource_mode = "edge";
  this.title = "new Circos";

  this.assembly_name= "";
  this.assembly= null;
  this.colorspace = "Set3_bp_12";
  this.show_only_connected_chroms = false;
  this.focus_chrom_percent = 33;
  this.show_mini_chroms = false; //ensures that all chroms get at least 0.5deg of the circle

  this.focus_chrom_name = "";
  
  this.content_width = 500;
  this.content_height = 500;

  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;
  
  //methods
  this.initFromConfigDOM  = zenbuCircosElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuCircosElement_generateConfigDOM;  //returns a ConfigDOM object

  this.elementEvent       = zenbuCircosElement_elementEvent;
  this.reconfigureParam   = zenbuCircosElement_reconfigureParam;

  this.resetElement       = zenbuCircosElement_reset;
  this.loadElement        = zenbuCircosElement_load;
  this.postprocessElement = zenbuCircosElement_postprocess;
  this.showSelections     = zenbuCircosElement_showSelections
  this.drawElement        = zenbuCircosElement_draw;
  this.configSubpanel     = zenbuCircosElement_configSubpanel;

  //internal methods
  this.postprocessEdges   = zenbuCircosElement_postprocessEdges;
  this.fetchAssembly      = zenbuCircosElement_fetch_assembly;
  this.renderEdges        = zenbuCircosElement_renderEdges;
  
  return this;
}


//=================================================================================
//TODO: need to figure this out, not currently using

function zenbuCircosElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "circos") { return false; }
    
  if(elementDOM.getAttribute("assembly_name")) {  this.assembly_name = elementDOM.getAttribute("assembly_name"); }
  if(elementDOM.getAttribute("colorspace")) {  this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("show_only_connected_chroms") == "true") { this.show_only_connected_chroms = true; }
  if(elementDOM.getAttribute("show_mini_chroms") == "true") { this.show_mini_chroms = true; }
  if(elementDOM.getAttribute("focus_chrom_percent")) {  this.focus_chrom_percent = parseFloat(elementDOM.getAttribute("focus_chrom_percent")); }

  return true;
}


function zenbuCircosElement_generateConfigDOM() {
  console.log("zenbuCircosElement_generateConfigDOM");
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.assembly_name) { elementDOM.setAttribute("assembly_name", this.assembly_name); }
  if(this.colorspace) { elementDOM.setAttribute("colorspace", this.colorspace); }
  if(this.show_only_connected_chroms) { elementDOM.setAttribute("show_only_connected_chroms", "true"); }
  if(this.show_mini_chroms) { elementDOM.setAttribute("show_mini_chroms", "true"); }
  if(this.focus_chrom_percent) { elementDOM.setAttribute("focus_chrom_percent", this.focus_chrom_percent); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuCircosElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this;
  //if(this.datasourceElementID) {
  //  var ds = current_report.elements[this.datasourceElementID];
  //  if(ds) { datasourceElement = ds; }
  //  else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  //}
  
  if(mode == "focus_chrom_name") {
    console.log("zenbuCircosElement_elementEvent -- focus_chrom_name");
    if(this.focus_chrom_name == value) { //same name, toggle off
      this.focus_chrom_name = "";
    } else {
      this.focus_chrom_name = value;
    }
    //reportsPostprocessElement(elementID);
  }

}


function zenbuCircosElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  if(param == "assembly_name") { this.newconfig.assembly_name = value; }
  if(param == "show_only_connected_chroms") { this.newconfig.show_only_connected_chroms = value; }
  if(param == "show_mini_chroms") { this.newconfig.show_mini_chroms = value; }
  
  if(param == "focus_chrom_percent") {
    if(value<1) { value = value * 100; }
    if(value<5) { value=5; }
    if(value>90) { value=90; }
    this.newconfig.focus_chrom_percent = value; 
  } 
  
  if(param == "accept-reconfig") {
    if(this.newconfig.assembly_name !== undefined) { 
      this.assembly_name = this.newconfig.assembly_name; 
      this.newconfig.needReload=true; 
    }
    if(this.newconfig.show_only_connected_chroms !== undefined) { 
      this.show_only_connected_chroms = this.newconfig.show_only_connected_chroms; 
      //this.newconfig.needReload=true; 
    }
    if(this.newconfig.show_mini_chroms !== undefined) { 
      this.show_mini_chroms = this.newconfig.show_mini_chroms; 
    }
    if(this.newconfig.focus_chrom_percent !== undefined) { 
      this.focus_chrom_percent = this.newconfig.focus_chrom_percent; 
    }
  }
}


//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuCircosElement_reset() {
  //console.log("zenbuCircosElement_reset ["+this.elementID+"]");
  
  //clear previous loaded data
  //this.features = new Object();
  //this.feature_array = new Array();
  //this.edge_array = new Array();
  //this.edge_count = 0;
  
  //clear previous target
  //this.selected_id = ""; //selected row in the table
  //this.selected_feature = null; //selected row in the table
}


function zenbuCircosElement_load() {
  console.log("zenbuCircosElement_load");
  this.fetchAssembly()
}


function zenbuCircosElement_postprocess() {
  //circos does not append to title
  this.title = this.title_prefix;
  
  this.fetchAssembly();  //fetch if needed

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  if(datasourceElement.datasource_mode == "edge") {
    this.postprocessEdges();
  }
  //no need to extra postprocessing of datasource="feature"
}


function zenbuCircosElement_postprocessEdges() {
  var starttime = new Date();
  
  var elementID = this.elementID;
  console.log("zenbuCircosElement_postprocessEdges: " + elementID);
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  console.log("zenbuCircosElement_postprocessEdges: " + feature_count+ " features, " + edge_count+" edges, "+datasourceElement.filter_count+" filtered");

  this.title = this.title_prefix;
  if(datasourceElement.focus_feature) {
    if(!this.selected_feature) { this.selected_feature = datasourceElement.focus_feature; }
    console.log("zenbuCircosElement_postprocessEdges start focus["+datasourceElement.focus_feature.name+"]");
    if(this.title) { this.title += " "+ datasourceElement.focus_feature.name; }
  }
  
  this.fetchAssembly();  //fetch if needed
  if(this.assembly && this.assembly.chroms_hash) {
    for(var chrom_name in this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[chrom_name];
      if(!chrom) { continue; }
      chrom.has_connections = false;
    }
  }
  
  if(datasourceElement.datasource_mode == "edge") {
    this.filter_count=0;
    //datasourceElement.edge_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.edge_array.length; j++) {
      var edge = datasourceElement.edge_array[j];
      if(!edge) { continue; }
      if(!edge.filter_valid) { continue; }
      if(!edge.feature1 || !edge.feature2) { continue; }
      if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
      if(datasourceElement.focus_feature &&
         (datasourceElement.focus_feature.id != edge.feature1_id) &&
         (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

      this.filter_count++;
      
      if(this.assembly && this.assembly.chroms_hash) {
        var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
        var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];
        if(chrom1) { chrom1.has_connections = true; }
        if(chrom2) { chrom2.has_connections = true; }
      }
    }
  }

  console.log("zenbuCircosElement_postprocessEdges: " + feature_count+ " features, " + edge_count+" edges, "+this.filter_count+" filtered");
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("zenbuCircosElement_postprocessEdges " +(runtime)+"msec");
}


//=================================================================================
// fetch assembly

function zenbuCircosElement_fetch_assembly() {
  if(!this.assembly_name) { return; }
  if(this.assembly) {
    //console.log("zenbuCircosElement_fetch_assembly :: assembly loaded ["+this.assembly.assembly_name+"]");
    if(this.assembly.assembly_name == this.assembly_name) {
      //console.log("zenbuCircosElement_fetch_assembly :: assembly matches assembly_name");
      return; 
    }
  }
  console.log("zenbuCircosElement_fetch_assembly :: fetch ["+this.assembly_name+"]");
  
  var url = eedbSearchCGI + "?mode=genome&asm="+this.assembly_name;
  var chromXMLHttp=GetXmlHttpObject();
  if(chromXMLHttp==null) { return; }

  chromXMLHttp.open("GET",url,false); //synchronous
  chromXMLHttp.send(null);

  if(chromXMLHttp.responseXML == null) return;
  if(chromXMLHttp.readyState!=4) return;
  if(chromXMLHttp.status!=200) { return; }
  if(chromXMLHttp.responseXML == null) return;

  var xmlDoc=chromXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    console.log("zenbuCircosElement_fetch_assembly :: Problem with responseXML no xmlDoc");
    return;
  }

  var xmlAssemblies = xmlDoc.getElementsByTagName("assembly");
  for(i=0; i<xmlAssemblies.length; i++) {
    var assembly = eedbParseAssemblyData(xmlAssemblies[i]);
    if((assembly.assembly_name == this.assembly_name) || 
       (assembly.ucsc_name == this.assembly_name) || 
       (assembly.ncbi_name == this.assembly_name) || 
       (assembly.ncbi_acc == this.assembly_name)) { this.assembly = assembly; break; }
  }
  if(!this.assembly) { return; }
  //console.log("zenbuCircosElement_fetch_assembly found ["+this.assembly.assembly_name+"] "+this.assembly.description);

  assembly.chroms_hash = new Object();
  
  var xmlChroms = xmlDoc.getElementsByTagName("chrom");
  for(i=0; i<xmlChroms.length; i++) {
    var chrom = eedbParseChromData(xmlChroms[i]);
    if(!chrom) { continue; }
    
    chrom.name_index = null;
    if(chrom.chrom_name.indexOf("chr")==0) { chrom.name_index = chrom.chrom_name.substr(3); }
    if(chrom.name_index && !isNaN(chrom.name_index)) { chrom.name_index = Math.abs(chrom.name_index); }
    
    if(chrom.assembly_name == this.assembly.assembly_name) {
      chrom.assembly = this.assembly;
      this.assembly.chroms_hash[chrom.chrom_name] = chrom;
    } else {
      console.log(chrom.description+" => don't match assembly");
    }
  }
  
}

//=================================================================================
//
// draw
//
//=================================================================================

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;

  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(centerX, centerY, radius, thickness, startAngle, endAngle){

    var start = polarToCartesian(centerX, centerY, radius, endAngle);
    var end   = polarToCartesian(centerX, centerY, radius, startAngle);

    var start2 = polarToCartesian(centerX, centerY, radius-thickness, endAngle);
    var end2   = polarToCartesian(centerX, centerY, radius-thickness, startAngle);

    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    /*
    var d = ["M", start.x, start.y, 
             "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y];
    if(thickness>0) {
      d2 = ["L", end2.x, end2.y,
            "A", radius-thickness, radius-thickness, 0, largeArcFlag, 1, start2.x, start2.y,
            "L", start.x, start.y ];
      d = d.concat(d2);
    }
    */
    
    var d = ["M", end.x, end.y, 
             "A", radius, radius, 0, largeArcFlag, 1, start.x, start.y];
    if(thickness>0) {
      d2 = ["L", start2.x, start2.y,
            "A", radius-thickness, radius-thickness, 0, largeArcFlag, 0, end2.x, end2.y,
            "L", end.x, end.y ];
      d = d.concat(d2);
    } 
    else { 
      d2 = ["A", radius, radius, 0, largeArcFlag, 0, end.x, end.y];
      d = d.concat(d2);
    }
    
    return d.join(" ");       
}


function createArc(centerX, centerY, radius, startAngle, endAngle, color) {
  if(!color) { color = "black"; }
  var arc1 = document.createElementNS(svgNS,'path');
  arc1.setAttributeNS(null, 'd', describeArc(centerX, centerY, radius, 15, startAngle, endAngle));
  arc1.setAttributeNS(null, 'stroke', "black");
  arc1.setAttributeNS(null, 'stroke-width', "1px");
  arc1.setAttributeNS(null, 'fill', color);  //#FDFDFD
  return arc1;
}

function zenbuCircosElement_draw() {
  if(this.loading) { return; }
  //console.log("zenbuCircosElement_draw ["+this.elementID+"]");
  var main_div = this.main_div;
  if(!main_div) { return; }

  this.fetchAssembly();  //fetch if needed

  //if(this.filter_count == 0) { //use the query feature
  //  var load_info = main_div.appendChild(document.createElement('div'));
  //  load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
  //  load_info.innerHTML = "no data...";
  //  return;
  //}
    
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 50;
  width = width -10;
  //console.log("zenbuCircosElement_draw width["+width+"] height["+height+"]");
  
  var svg = main_div.appendChild(document.createElementNS(svgNS,'svg'));
  svg.setAttributeNS(null, 'width', width+'px');
  svg.setAttributeNS(null, 'height', height+'px');
  //svg.setAttribute('style', 'float:left');
  
  var radius = width;
  if(height<radius) { radius = height; }
  radius = (radius / 2.0)-10;

  if(this.assembly && this.assembly.chroms_hash) {
    var total_length = 0;
    
    var chroms_array = new Array();
    
    for(var chrom_name in this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[chrom_name];
      if(!chrom) { continue; }
      if(chrom.chrom_length==0) { continue; }
      //if(this.hide_zero && !ctg_obj.filtered && (ctg_obj.count==0)) { continue; }
      chrom.arc_start = 0;
      chrom.arc_end = 0;
      
      if(this.show_only_connected_chroms && this.filter_count>0 && !chrom.has_connections) { continue; }

      if(this.focus_chrom_name!=chrom.chrom_name) {
        total_length += chrom.chrom_length;
      }
      chroms_array.push(chrom);
    }
    chroms_array.sort(reports_circos_chrom_sort_func);
    
    var total_arc = 360;
    if(this.focus_chrom_name) { total_arc = 3.6 * (100-this.focus_chrom_percent); }
    var arc_start = 0;
    for(var idx1=0; idx1<chroms_array.length; idx1++) {
      var chrom = chroms_array[idx1];
            
      var color = zenbuIndexColorSpace(this.colorspace, idx1);  //Spectral_bp_11  Set2_bp_8  Set3_bp_11

      if(this.show_mini_chroms) { 
        arc_end = arc_start +0.25+ (total_arc-(chroms_array.length/2))*(chrom.chrom_length / total_length);
      } else {
        arc_end = arc_start + total_arc*(chrom.chrom_length / total_length);
      }
      //arc_end = arc_start + (360-(chroms_array.length/3))*(chrom.chrom_length / total_length);
      //arc_end = arc_start +0.5 + (360-(chroms_array.length/2))*(chrom.chrom_length / total_length);
      if(this.focus_chrom_name == chrom.chrom_name) { 
        arc_end = arc_start + (3.60*this.focus_chrom_percent); 
        if(this.show_mini_chroms) { arc_end += 0.25; }
      }
      
      chrom.arc_start = arc_start;
      chrom.arc_end   = arc_end;
      
      arc1 = createArc(width/2.0, height/2.0, radius-10, arc_start, arc_end, color.getCSSHexadecimalRGB());
      arc1.id = createUUID(); //unique UUID for this arc so we can use it as a textpath
      svg.appendChild(arc1);
      arc1.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
      arc1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      //focus_chrom_name
      arc1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");

      var arc2 = svg.appendChild(document.createElementNS(svgNS,'path'));
      arc2.setAttributeNS(null, 'd', describeArc((width/2.0), height/2.0, radius-8, 0, arc_start, arc_end));
      arc2.setAttributeNS(null, 'stroke', "transparent");
      arc2.setAttributeNS(null, 'stroke-width', "1px");
      arc2.setAttributeNS(null, 'fill', "transparent");  //#FDFDFD
      arc2.id = createUUID(); //unique UUID for this arc so we can use it as a textpath
      arc2.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
      arc2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      arc2.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");

      var arc_text = svg.appendChild(document.createElementNS(svgNS,'text'));
      arc_text.setAttributeNS(null, 'style', "font-size:8px;");
      arc_text.setAttribute("onmouseover", "eedbMessageTooltip(\""+chrom.chrom_name+"\",100);");
      arc_text.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      arc_text.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'focus_chrom_name', '"+chrom.chrom_name+"');");

      var arc_textpath = arc_text.appendChild(document.createElementNS(svgNS,'textPath'));
      arc_textpath.setAttribute('href', "#"+arc2.id);
      //arc_textpath.setAttribute('side', "left");
      arc_textpath.setAttribute('startOffset', "2px");
      arc_textpath.innerHTML = chrom.chrom_name;
      
      if(this.show_mini_chroms) { arc_start = arc_end+0.25; }
      else { arc_start = arc_end; }
    }
    
    this.renderEdges(svg);
  } 
  else {
    var circle1 = svg.appendChild(document.createElementNS(svgNS,'circle'));
    circle1.setAttributeNS(null, 'cx', (width/2.0)+'px');
    circle1.setAttributeNS(null, 'cy', (height/2.0)+'px');
    circle1.setAttributeNS(null, 'r',  radius+"px");
    circle1.setAttributeNS(null, 'stroke', "red");
    circle1.setAttributeNS(null, 'stroke-width', "10px");
    circle1.setAttributeNS(null, 'fill', "#FDFDFD");

    var arc1 = svg.appendChild(createArc((width/2.0), height/2.0, radius-10, 0, 90, "darkgray"));
    arc1 = svg.appendChild(createArc((width/2.0), height/2.0, radius-10, 91, 133, "red"));
    arc1 = svg.appendChild(createArc((width/2.0), height/2.0, radius-10, 134, 170,"green"));
    arc1 = svg.appendChild(createArc((width/2.0), height/2.0, radius-10, 171, 233,"blue"));
    arc1 = svg.appendChild(createArc((width/2.0), height/2.0, radius-10, 234, 275,"purple"));
    arc1 = svg.appendChild(createArc((width/2.0), height/2.0, radius-10, 276, 359,"cyan"));
  }
}


function zenbuCircosElement_renderEdges(svg) {
  if(!this.assembly) { return; }
  if(!svg) { return; }
    
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  if(datasourceElement.datasource_mode != "edge") { return; }
    
  //console.log("zenbuCircosElement_renderEdges ["+this.elementID+"]");

  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 50;
  width = width -10;
    
  var radius = width;
  if(height<radius) { radius = height; }
  radius = (radius / 2.0)-10;
  //console.log("zenbuCircosElement_renderEdges width["+width+"] height["+height+"]  radius["+radius+"]");
  
  for(j=0; j<datasourceElement.edge_array.length; j++) {
    var edge = datasourceElement.edge_array[j];
    if(!edge) { continue; }
    edge.selected = false;
    if(this.selected_edge && (edge.id == this.selected_edge.id)) { edge.selected=true; }
  }
  datasourceElement.edge_array.sort(reports_circos_edge_sort_func);

  //make sure the columns are sorted for the hover-info
  this.dtype_columns.sort(reports_column_order_sort_func);

  var t1 = performance.now();
  //console.log("after sort " + (t1 - t0) + " msec.");
  
  for(j=0; j<datasourceElement.edge_array.length; j++) {
    var edge = datasourceElement.edge_array[j];
    if(!edge) { continue; }
    if(!edge.filter_valid) { continue; }
    if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
    if(!edge.feature1) { continue; }
    if(!edge.feature2) { continue; }
    if(datasourceElement.focus_feature &&
        (datasourceElement.focus_feature.id != edge.feature1_id) &&
        (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }

    //ok render the edge
    //console.log("circos edge.f1 ["+edge.feature1.name+"] edge.f2["+edge.feature2.name+"]");
    //console.log("circos edge.f1 ["+edge.feature1.chrom+"] edge.f2["+edge.feature2.chrom+"]");
    
    var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
    if(!chrom1) { continue; }
    if(chrom1.chrom_length==0) { continue; }

    var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];
    if(!chrom2) { continue; }
    if(chrom2.chrom_length==0) { continue; }
    
    arc_f1 = chrom1.arc_start + (edge.feature1.start)*(chrom1.arc_end - chrom1.arc_start)/chrom1.chrom_length;
    var point_f1 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f1);
    //console.log("circos edge.f1 ["+edge.feature1.chrom+"] :"+edge.feature1.start+" : "+arc_f1+" : "+point_f1.x+","+point_f1.y);

    arc_f2 = chrom2.arc_start + (edge.feature2.start)*(chrom2.arc_end - chrom2.arc_start)/chrom2.chrom_length;
    var point_f2 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f2);
    //console.log("circos edge.f2 ["+edge.feature2.chrom+"] :"+edge.feature2.start+" : "+arc_f2+" : "+point_f2.x+","+point_f2.y);
    
    //   <line x1="0" y1="0" x2="200" y2="200" style="stroke:rgb(255,0,0);stroke-width:2" />
    
    var d = ["M", point_f1.x, point_f1.y, 
             //"L", point_f2.x, point_f2.y
             "C", width/2.0, height/2.0, point_f2.x, point_f2.y, point_f2.x, point_f2.y,
             "C", point_f2.x, point_f2.y, width/2.0, height/2.0, point_f1.x, point_f1.y
            ];

    var line1 = svg.appendChild(document.createElementNS(svgNS,'path'));
    line1.setAttributeNS(null, 'd', d.join(" "));
    line1.setAttributeNS(null, 'stroke', "#808080");
    line1.setAttributeNS(null, 'stroke-width', "1px");
    //line1.setAttributeNS(null, 'fill', "red");
    line1.setAttributeNS(null, 'fill', "transparent");
    
    if(this.selected_edge && (edge.id == this.selected_edge.id)) {
      line1.setAttributeNS(null, 'stroke', "rgba(255,0,225,0.9)");
      line1.setAttributeNS(null, 'stroke-width', "5px");
    }

    //var msg = "edge.f1 ["+edge.feature1.name+"]<br>"+edge.feature1.chromloc;
    //msg += "<p>edge.f2["+edge.feature2.name+"]<br>"+edge.feature2.chromloc;
    //line1.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",250);");
    
    line1.setAttribute("onmouseover", "zenbuCircosElement_edgeHoverInfo('"+this.elementID+"','"+j+"');");
    line1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    line1.setAttribute("onmousedown", "reportElementEvent(\""+datasourceElement.elementID+"\", 'select', '"+ edge.id+"');");
  }
}


function zenbuCircosElement_showSelections() {
  console.log("zenbuCircosElement_showSelections "+this.elementID+" "+this.selected_id);
  reportsDrawElement(this.elementID);
}


function zenbuCircosElement_edgeHoverInfo(elementID, edgeIdx) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var datasourceElement = reportElement;
  if(reportElement.datasourceElementID) {
    var ds = current_report.elements[reportElement.datasourceElementID];
    if(ds) { datasourceElement = ds; }
  }
  if(!datasourceElement) { return; }
  if(datasourceElement.datasource_mode != "edge") { return; }
    
  var edge = datasourceElement.edge_array[edgeIdx];
  if(!edge) { return; }
  
  zenbuReports_hoverInfo(reportElement, edge);
}


//=================================================================================
//
// configuration
//
//=================================================================================

function zenbuCircosElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
    
  div1 = configdiv.appendChild(document.createElement('div'));
  var genomeWidget = zenbuGenomeSelectWidget("filter_search", this.elementID);
  genomeWidget.callOutFunction = zenbuCircosElement_genome_select_callback;
  if(this.assembly_name) { genomeWidget.name = this.assembly_name; }
  //if(userview.filters.assembly) { genomeWidget.name = userview.filters.assembly; }
  genomeWidget.elementID = this.elementID;
  genomeWidget.assemblySelect.style.width = "330px";
  div1.appendChild(genomeWidget);
  zenbuGenomeSelectUpdate(this.elementID);

  //-----  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin-top: 10px;");
  tdiv2.appendChild(reportElementColorSpaceOptions(this));
  
  configdiv.appendChild(document.createElement('hr'));
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_only_connected_chroms;
  if(this.newconfig && this.newconfig.show_only_connected_chroms != undefined) { 
    val1 = this.newconfig.show_only_connected_chroms; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_only_connected_chroms', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "show only connected chroms";

  //show_mini_chroms
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 15px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.show_mini_chroms;
  if(this.newconfig && this.newconfig.show_mini_chroms != undefined) { 
    val1 = this.newconfig.show_mini_chroms; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_mini_chroms', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expand small chroms";
  tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\"When selected, all chroms will be given a minimum size in order to be visible.<br>If not selected, chroms will be scaled to their true size and small chroms/scaffolds, although present, will be too small to see.\",250);");
  tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");

  //focus_chrom_percent
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var val1 = this.focus_chrom_percent;
  if(this.newconfig && this.newconfig.focus_chrom_percent != undefined) { 
    val1 = this.newconfig.focus_chrom_percent; 
  }
  var span3 = tdiv2.appendChild(document.createElement('span'));
  span3.setAttribute('style', "margin-left: 5px; ");
  var tspan = span3.appendChild(document.createElement('span'));
  tspan.innerHTML = "focus chrom percent: ";
  var input = span3.appendChild(document.createElement('input'));
  input.className = "sliminput";
  input.style.width = "50px";
  input.setAttribute('type', "text");
  input.setAttribute('value', val1);
  input.setAttribute("onchange", "reportElementReconfigParam(\""+this.elementID+"\", 'focus_chrom_percent', this.value);");

  configdiv.appendChild(document.createElement('hr'));

  return configdiv;
}


function zenbuCircosElement_genome_select_callback(genomeWidget) {
  console.log("zenbuCircosElement_genome_select_callback");
  if(!genomeWidget) { return; }
  var name = genomeWidget.name;
  if(name == "all") { name = ""; }
  reportElementReconfigParam(genomeWidget.elementID, 'assembly_name', name);
}


//=================================================================================
//
// helper functions
//
//=================================================================================

function reports_circos_edge_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.selected) { return 1; }
  if(b.selected) { return -1; }

  var af2 = a.feature2;
  var bf2 = b.feature2;
  if(!af2) { return 1; }
  if(!bf2) { return -1; }
  if(af2.id < bf2.id) { return -1; }
  if(af2.id > bf2.id) { return  1; }

  var af1 = a.feature1;
  var bf1 = b.feature1;
  if(!af1) { return 1; }
  if(!bf1) { return -1; }
  if(af1.id < bf1.id) { return -1; }
  if(af1.id > bf1.id) { return  1; }

  return 0;
}


function reports_circos_chrom_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  //if(a.filtered && !b.filtered) { return -1; }
  //if(!a.filtered && b.filtered) { return 1; }

  if(a.name_index && !b.name_index) { return -1; }
  if(!a.name_index && b.name_index) { return 1; }
  if(a.name_index > b.name_index) { return 1; }
  if(a.name_index < b.name_index) { return -1; }

  //if(b.chrom_length > a.chrom_length) { return 1; }
  //if(b.chrom_length < a.chrom_length) { return -1; }
  if(b.chrom_name > a.chrom_name) { return -1; }
  if(b.chrom_name < a.chrom_name) { return 1; }
  return 0;
}

