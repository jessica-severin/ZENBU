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


//var element = new ZenbuCytoscapeElement();

function ZenbuCytoscapeElement(elementID) {
  //create empty, uninitialized Category report-element object
  //console.log("create ZenbuCytoscapeElement");
  this.element_type = "cytoscape";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  //zenbuElement_init.call(this); //eventually when I refactor the superclass Element into object code

  this.title_prefix = "";
  this.datasource_mode = "edge";
  this.title = "new Cytoscape";

  this.assembly_name= "";
  this.assembly= null;
  this.colorspace = "Set3_bp_12";
  this.show_only_connected_chroms = false;
  this.show_mini_chroms = false; //ensures that all chroms get at least 0.5deg of the circle

  this.layout_style = "grid"; //random, grid, cose, breadthfirst, concentric, circle
  
  this.content_width = 500;
  this.content_height = 500;

  this.show_titlebar = true;
  this.widget_search = true;
  this.widget_filter = true;
  
//  this.cyto_elements = [];
  //demo data for testing
  this.cyto_elements = [ 
      { data: { id: 'a', text_color: "#2X2C2C", node_color: "gray", node_shape: "round-rectangle" } }, 
      { data: { id: 'b', text_color: "#2X2C2C", node_color: "gray", node_shape: "round-rectangle" } }, 
      { data: { id: 'ab', source: 'a', target: 'b', edge_color: "#CCC" } } ];
        
      
  this.cyto_node_style = {  //default label inside style
          'background-color': '#AAA',
          'label': 'data(id)',
          'color': 'data(text_color)',  //#2X2C2C default
          'font-weight': 'bold',
          'background-color': 'data(node_color)', //"#AAA", 
          'border-color': 'data(node_color)',
          'border-width':3,
          'border-opacity':1,
          'background-opacity':0.5, 
          shape: 'data(node_shape)',
          padding: '10px', //20 for rhomboid
          width: 'label',
          height: 'label', 
          'text-halign': 'center',
          'text-valign': 'center',
          'text-outline-color': 'data(node_color)',
          'text-outline-opacity': 1,
          'text-outline-width':3
        };
        
  this.cyto_style = [ // the stylesheet for the graph
      { selector: 'node',
        style: this.cyto_node_style,
      },
      { selector: "node:selected",
        style: {
          "background-color": "rgba(255,0,225,0.9)",  //only change the background color
        }
      },
      { selector: 'edge',
        style: {
          'width': 2,
          'line-color': 'data(edge_color)',
          'target-arrow-color': 'data(edge_color)', //#ccc
          'target-arrow-shape': 'triangle'
        }
      },
      { selector: 'edge:selected',
        style: {
          "line-color": "rgba(255,0,225,0.9)",  //only change the line color
        }
      },
      // { selector: "core",
      //   style: {
      //     "selection-box-color": "#AAD8FF",
      //     "selection-box-border-color": "#8BB0D0",
      //     "selection-box-opacity": "0.5"
      //   }
      // }, 
      // { selector: "node",
      //   style: {
      //     //"width": "mapData(score, 0, 0.006769776522008331, 20, 60)",
      //     //"height": "mapData(score, 0, 0.006769776522008331, 20, 60)",
      //     //"content": "data(name)",
      //     "font-size": "12px",
      //     "text-valign": "center",
      //     "text-halign": "center",
      //     "background-color": "#555",
      //     "text-outline-color": "#555",
      //     "text-outline-width": "2px",
      //     "color": "#fff",
      //     "overlay-padding": "6px",
      //     "z-index": "10"
      //   }
      // }, 
      // { selector: "node[?attr]",
      //   style: {
      //     "shape": "rectangle",
      //     "background-color": "#aaa",
      //     "text-outline-color": "#aaa",
      //     "width": "16px",
      //     "height": "16px",
      //     "font-size": "6px",
      //     "z-index": "1"
      //   }
      // }, 
      // { selector: "node[?query]",
      //   style: {
      //     "background-clip": "none",
      //     "background-fit": "contain"
      //   }
      // }, 
      // { selector: "node:selected",
      //   style: {
      //     "border-width": "6px",
      //     "border-color": "#AAD8FF",
      //     "border-opacity": "0.5",
      //     "background-color": "#77828C",
      //     "text-outline-color": "#77828C"
      //   }
      // }, 
      // { selector: "edge",
      //   style: {
      //     "curve-style": "haystack",
      //     "haystack-radius": "0.5",
      //     "opacity": "0.4",
      //     "line-color": "#bbb",
      //     //"width": "mapData(weight, 0, 1, 1, 8)",
      //     "overlay-padding": "3px"
      //   }
      // }, 
      // { selector: "node.unhighlighted",
      //   style: {
      //     "opacity": "0.2"
      //   }
      // }, 
      // { selector: "edge.unhighlighted",
      //   style: {
      //     "opacity": "0.05"
      //   }
      // }, 
      // { selector: ".highlighted",
      //   style: {
      //     "z-index": "999999"
      //   }
      // }, 
      // { selector: "node.highlighted",
      //   style: {
      //     "border-width": "6px",
      //     "border-color": "#AAD8FF",
      //     "border-opacity": "0.5",
      //     "background-color": "#394855",
      //     "text-outline-color": "#394855"
      //   }
      // }, 
      // { selector: "edge.filtered",
      //   style: {
      //     "opacity": "0"
      //   }
      // }, 
      // { selector: "edge[group=\"coexp\"]",
      //   style: {
      //     "line-color": "#d0b7d5"
      //   }
      // }, 
      // { selector: "edge[group=\"coloc\"]",
      //   style: {
      //     "line-color": "#a0b3dc"
      //   }
      // }, 
      // { selector: "edge[group=\"gi\"]",
      //   style: {
      //     "line-color": "#90e190"
      //   }
      // }, 
      // { selector: "edge[group=\"path\"]",
      //   style: {
      //     "line-color": "#9bd8de"
      //   }
      // }, 
      // { selector: "edge[group=\"pi\"]",
      //   style: {
      //     "line-color": "#eaa2a2"
      //   }
      // }, 
      // { selector: "edge[group=\"predict\"]",
      //   style: {
      //     "line-color": "#f6c384"
      //   }
      // }, 
      // { selector: "edge[group=\"spd\"]",
      //   style: {
      //     "line-color": "#dad4a2"
      //   }
      // }, 
      // { selector: "edge[group=\"spd_attr\"]",
      //   style: {
      //     "line-color": "#D0D0D0"
      //   }
      // }, 
      // { selector: "edge[group=\"reg\"]",
      //   style: {
      //     "line-color": "#D0D0D0"
      //   }
      // }, 
      // { selector: "edge[group=\"reg_attr\"]",
      //   style: {
      //     "line-color": "#D0D0D0"
      //   }
      // }, 
      // { selector: "edge[group=\"user\"]",
      //   style: {
      //     "line-color": "#f0ec86"
      //   }
      // }
    ];

  this.label_inside_nodes = true;
  this.default_node_shape = "round-rectangle";
  this.default_node_color = "#F09000";
  this.node_color_mode = "fixed_color"
  //this.default_node_color = "#0000A0";
  this.node_signal_colorspace = "fire1";
  this.node_signal_datatype = "";
  this.node_signal_logscale = false;
  this.node_signal_min = 0;
  this.node_signal_max = "auto";
  this.node_style_datatypes = null;

  this.edge_color_mode = "fixed_color"
  this.default_edge_color = "#CCCCCC";
  this.edge_weight_colorspace = "fire1";
  this.edge_color_datatype = "";
  this.edge_color_weight_logscale = false;
  this.edge_color_weight_invert = false;
  this.edge_color_weight_min = "auto";
  this.edge_color_weight_max = "auto";
  
  //methods
  this.initFromConfigDOM  = zenbuCytoscapeElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuCytoscapeElement_generateConfigDOM;  //returns a ConfigDOM object

  this.elementEvent       = zenbuCytoscapeElement_elementEvent;
  this.reconfigureParam   = zenbuCytoscapeElement_reconfigureParam;

  this.resetElement       = zenbuCytoscapeElement_reset;
  this.loadElement        = zenbuCytoscapeElement_load;
  this.postprocessElement = zenbuCytoscapeElement_postprocess;
  this.showSelections     = zenbuCytoscapeElement_showSelections
  this.drawElement        = zenbuCytoscapeElement_draw;
  this.configSubpanel     = zenbuCytoscapeElement_configSubpanel;

  //internal methods
  this.postprocessEdges    = zenbuCytoscapeElement_postprocessEdges;
  this.postprocessFeatures = zenbuCytoscapeElement_postprocessFeatures;
  this.fetchAssembly       = zenbuCytoscapeElement_fetch_assembly;
  this.renderEdges         = zenbuCytoscapeElement_renderEdges;
  this.renderFeatures      = zenbuCytoscapeElement_renderFeatures;
  
  this.nodeStyleInterface     = zenbuCytoscapeElement_nodeStyleInterface;
  this.calcDatatypeCategories = zenbuCytoscapeElement_calcDatatypeCategories;
  return this;
}


//=================================================================================
//TODO: need to figure this out, not currently using

function zenbuCytoscapeElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "cytoscape") { return false; }
    
  if(elementDOM.getAttribute("assembly_name")) {  this.assembly_name = elementDOM.getAttribute("assembly_name"); }
  if(elementDOM.getAttribute("colorspace")) {  this.colorspace = elementDOM.getAttribute("colorspace"); }
  if(elementDOM.getAttribute("layout_style")) {  this.layout_style = elementDOM.getAttribute("layout_style"); }

  if(elementDOM.getAttribute("default_node_shape")) { this.default_node_shape = elementDOM.getAttribute("default_node_shape"); }
  if(elementDOM.getAttribute("default_node_color")) { this.default_node_color = elementDOM.getAttribute("default_node_color"); }
  if(elementDOM.getAttribute("node_color_mode"))    { this.node_color_mode = elementDOM.getAttribute("node_color_mode"); }
  
  if(elementDOM.getAttribute("edge_color_mode"))    { this.edge_color_mode = elementDOM.getAttribute("edge_color_mode"); }
  if(elementDOM.getAttribute("default_edge_color")) { this.default_edge_color = elementDOM.getAttribute("default_edge_color"); }
  if(elementDOM.getAttribute("edge_signal_colorspace")) { this.edge_weight_colorspace = elementDOM.getAttribute("edge_signal_colorspace"); }
  if(elementDOM.getAttribute("edge_weight_colorspace")) { this.edge_weight_colorspace = elementDOM.getAttribute("edge_weight_colorspace"); }
  if(elementDOM.getAttribute("edge_color_datatype")) { this.edge_color_datatype = elementDOM.getAttribute("edge_color_datatype"); }  
  if(elementDOM.getAttribute("edge_color_weight_min")) { this.edge_color_weight_min = elementDOM.getAttribute("edge_color_weight_min"); }
  if(elementDOM.getAttribute("edge_color_weight_max")) { this.edge_color_weight_max = elementDOM.getAttribute("edge_color_weight_max"); }
  if(elementDOM.getAttribute("edge_color_weight_logscale") == "true") { this.edge_color_weight_logscale = true; }
  if(elementDOM.getAttribute("edge_color_weight_invert") == "true") { this.edge_color_weight_invert = true; }
  
  this.label_inside_nodes = false;
  if(elementDOM.getAttribute("label_inside_nodes") == "true") { this.label_inside_nodes = true; }
  
  var styleDOM = elementDOM.getElementsByTagName("node_style_datatypes")[0];
  if(styleDOM) {
    this.node_style_datatypes = {};
    var modeDOMs = styleDOM.getElementsByTagName("dtype_style");
    for(var i=0; i<modeDOMs.length; i++) {
      var modeDOM = modeDOMs[i];
      if(!modeDOM) { continue; }
      // shape:{datatype:"", categories:{}}, color:{datatype:"", categories:{}},  size: {datatype:"", categories:{}},
      var style_mode = modeDOM.getAttribute("style_mode");
      var datatype = modeDOM.getAttribute("datatype");
      this.node_style_datatypes[style_mode] = { datatype:datatype, categories:{} };

      var ctgDOMs = modeDOM.getElementsByTagName("dtype_category");
      for(var j=0; j<ctgDOMs.length; j++) {
        var ctgDOM = ctgDOMs[j];
        if(!ctgDOM) { continue; }
        //node_style_datatypes[style_mode].categories[ctgval] = {ctg:ctgval, color:"", shape:"", size:"", label_inside:""};
        var ctgval = ctgDOM.getAttribute("ctg");
        var ctg_obj = {ctg:ctgval, color:"", shape:"", size:"", label_inside:""}
        if(ctgDOM.getAttribute("shape")) { ctg_obj.shape = ctgDOM.getAttribute("shape"); }
        if(ctgDOM.getAttribute("color")) { ctg_obj.color = ctgDOM.getAttribute("color"); }
        if(ctgDOM.getAttribute("size")) { ctg_obj.size = ctgDOM.getAttribute("size"); }
        if(ctgDOM.getAttribute("label_inside")) { ctg_obj.label_inside = ctgDOM.getAttribute("label_inside"); }
        
        this.node_style_datatypes[style_mode].categories[ctgval] = ctg_obj;
      }
    }
  }

  return true;
}


function zenbuCytoscapeElement_generateConfigDOM() {
  console.log("zenbuCytoscapeElement_generateConfigDOM");

  var doc = document.implementation.createDocument("", "", null);
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually
  
  if(this.assembly_name) { elementDOM.setAttribute("assembly_name", this.assembly_name); }
  if(this.colorspace) { elementDOM.setAttribute("colorspace", this.colorspace); }
  if(this.layout_style) { elementDOM.setAttribute("layout_style", this.layout_style); }
  
  if(this.default_node_shape) { elementDOM.setAttribute("default_node_shape", this.default_node_shape); }
  if(this.default_node_color) { elementDOM.setAttribute("default_node_color", this.default_node_color); }
  if(this.node_color_mode) { elementDOM.setAttribute("node_color_mode", this.node_color_mode); }

  if(this.edge_color_mode) { elementDOM.setAttribute("edge_color_mode", this.edge_color_mode); }
  if(this.default_edge_color) { elementDOM.setAttribute("default_edge_color", this.default_edge_color); }
  if(this.edge_weight_colorspace) { elementDOM.setAttribute("edge_weight_colorspace", this.edge_weight_colorspace); }
  if(this.edge_color_datatype) { elementDOM.setAttribute("edge_color_datatype", this.edge_color_datatype); }
  if(this.edge_color_weight_min) { elementDOM.setAttribute("edge_color_weight_min", this.edge_color_weight_min); }
  if(this.edge_color_weight_max) { elementDOM.setAttribute("edge_color_weight_max", this.edge_color_weight_max); }
  if(this.edge_color_weight_logscale) { elementDOM.setAttribute("edge_color_weight_logscale", "true"); }
  if(this.edge_color_weight_invert) { elementDOM.setAttribute("edge_color_weight_invert", "true"); }
  
  if(this.label_inside_nodes) { elementDOM.setAttribute("label_inside_nodes", "true"); }
  
  if(this.node_style_datatypes) { 
    //   this.node_style_datatypes = { 
    //     shape:{datatype:"", categories:{}}, 
    //     color:{datatype:"", categories:{}}, 
    //     size: {datatype:"", categories:{}},
    //   };
    //node_style_datatypes[style_mode].categories[ctgval] = {ctg:ctgval, color:"", shape:"", size:"", label_inside:""};

    var styleDOM = doc.createElement("node_style_datatypes");
    for(var style_mode in this.node_style_datatypes) {
      if(!this.node_style_datatypes[style_mode].datatype) { continue; }

      var datatype   = this.node_style_datatypes[style_mode].datatype;
      var categories = this.node_style_datatypes[style_mode].categories;

      var modeDOM = doc.createElement("dtype_style");
      modeDOM.setAttribute("style_mode", style_mode);  //shape,color,size...
      modeDOM.setAttribute("datatype", datatype);

      for(var ctg in categories) { 
        var ctg_obj = categories[ctg];
        var ctgDOM = doc.createElement("dtype_category");
        ctgDOM.setAttribute("ctg", ctg_obj.ctg);
        if(ctg_obj.shape) { ctgDOM.setAttribute("shape", ctg_obj.shape); }
        if(ctg_obj.color) { ctgDOM.setAttribute("color", ctg_obj.color); }
        if(ctg_obj.size)  { ctgDOM.setAttribute("size",  ctg_obj.size); }
        modeDOM.appendChild(ctgDOM);
      }
      styleDOM.appendChild(modeDOM);
    }
    elementDOM.appendChild(styleDOM);
  }
  
  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuCytoscapeElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this.datasource();
}


function zenbuCytoscapeElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  
  if(param == "assembly_name") { this.newconfig.assembly_name = value; }
  if(param == "show_only_connected_chroms") { this.newconfig.show_only_connected_chroms = value; }
  if(param == "show_mini_chroms") { this.newconfig.show_mini_chroms = value; }

  if(param == "layout_style") { this.newconfig.layout_style = value; }
  if(param == "default_node_shape") { this.newconfig.default_node_shape = value; }
  if(param == "label_inside_nodes") { this.newconfig.label_inside_nodes = value; }
  if(param == "node_color_mode") { this.newconfig.node_color_mode = value; }
  if(param == "default_node_color") {
    if(!value) { value = "#0000A0"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    this.newconfig.default_node_color = value;
  }  
  if(param == "edit_node_style") { 
    this.newconfig.edit_node_style = value; 
    if(!this.newconfig.node_style_datatypes) {
      if(this.node_style_datatypes) { 
        this.newconfig.node_style_datatypes = zenbu_object_clone(this.node_style_datatypes);
      } else {
        this.newconfig.node_style_datatypes = {};
      }
    }
  }
  if(param == "node_style_datatypes") {
    // if(!this.newconfig.node_style_datatypes) {
    //   if(this.node_style_datatypes) { 
    //     this.newconfig.node_style_datatypes = zenbu_object_clone(this.node_style_datatypes);
    //   } else {
    //     this.newconfig.node_style_datatypes = {};
    //   }
    // }
    if(!this.newconfig.node_style_datatypes[altvalue]) { this.newconfig.node_style_datatypes[altvalue] = {datatype:"", categories:{}}; }
    if(this.newconfig.node_style_datatypes[altvalue].datatype != value) {
      this.newconfig.node_style_datatypes[altvalue] = { datatype: value, categories:{} };
      this.calcDatatypeCategories("feature", altvalue);
    }
  }
  if(param == "ctg_node_shape") { 
    //value holds the new shape,  altvalue holds the mdata category value
    this.newconfig.node_style_datatypes["shape"].categories[altvalue].shape = value;
  }
  if(param == "ctg_node_color") {
    if(!value) { value = "#0000A0"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    this.newconfig.node_style_datatypes["color"].categories[altvalue].color = value;
  }

  //edge
  if(param == "edge_color_mode") { this.newconfig.edge_color_mode = value; }
  if(param == "edge_color_datatype") {
    if(this.newconfig.edge_color_datatype != value) {
      console.log("edge_color_datatype changed to ["+value+"] - reset min/max");
      this.newconfig.edge_color_datatype = value;
      var datasourceElement = this.datasource();
      var edge_color_dtype = datasourceElement.datatypes[value];
      if(edge_color_dtype && this.edgeColorCSI) {
        console.log("edge_color_dtype dtype:"+edge_color_dtype.datatype+" minval:"+edge_color_dtype.min_val+" maxval:"+edge_color_dtype.max_val);
        this.edgeColorCSI.newconfig.min_signal = "auto"; //edge_color_dtype.min_val;
        this.edgeColorCSI.newconfig.max_signal = "auto"; //edge_color_dtype.max_val;
        //zenbuColorSpaceInterfaceUpdate(this.edgeColorCSI.id);
      }
    }
  }
  if(param == "default_edge_color") {
    if(!value) { value = "#0000A0"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    this.newconfig.default_edge_color = value;
  }
  
  if(param == "accept-reconfig") {
    if(this.newconfig.assembly_name !== undefined) { 
      this.assembly_name = this.newconfig.assembly_name; 
      this.newconfig.needReload=true; 
    }
    if(this.newconfig.layout_style !== undefined) { this.layout_style = this.newconfig.layout_style; }
    if(this.newconfig.default_node_shape !== undefined) { this.default_node_shape = this.newconfig.default_node_shape; }
    if(this.newconfig.label_inside_nodes !== undefined) { this.label_inside_nodes = this.newconfig.label_inside_nodes; }
    if(this.newconfig.node_color_mode !== undefined) { this.node_color_mode = this.newconfig.node_color_mode; }
    if(this.newconfig.default_node_color !== undefined) { this.default_node_color = this.newconfig.default_node_color; }
    if(this.newconfig.node_style_datatypes !== undefined) { this.node_style_datatypes = this.newconfig.node_style_datatypes; }

    if(this.newconfig.edge_color_mode !== undefined) { this.edge_color_mode = this.newconfig.edge_color_mode; }
    if(this.newconfig.default_edge_color !== undefined) { this.default_edge_color = this.newconfig.default_edge_color; }
    if(this.newconfig.edge_color_datatype !== undefined) { this.edge_color_datatype = this.newconfig.edge_color_datatype; }
    if(this.edgeColorCSI) {
      console.log("transfer params from edgeColorCSI");
      if(this.edgeColorCSI.newconfig.colorspace != undefined) { this.edge_weight_colorspace = this.edgeColorCSI.newconfig.colorspace; }
      if(this.edgeColorCSI.newconfig.min_signal != undefined) { this.edge_color_weight_min = this.edgeColorCSI.newconfig.min_signal; }
      if(this.edgeColorCSI.newconfig.max_signal != undefined) { this.edge_color_weight_max = this.edgeColorCSI.newconfig.max_signal; }
      if(this.edgeColorCSI.newconfig.logscale != undefined)   { this.edge_color_weight_logscale = this.edgeColorCSI.newconfig.logscale; }
      if(this.edgeColorCSI.newconfig.invert != undefined)     { this.edge_color_weight_invert = this.edgeColorCSI.newconfig.invert; }
      this.edgeColorCSI = null; //clear
    }
  }
}


function zenbuCytoscapeElement_calcDatatypeCategories(source_type, style_mode) {
  console.log("zenbuCytoscapeElement_calcDatatypeCategories "+this.elementID+ " mode:"+source_type+ " style_mode: "+style_mode);
  //if(!datatype) { return; }
  
  var datasourceElement = this.datasource();  
  if(!datasourceElement.dtype_columns) { return; }
  var columns = datasourceElement.dtype_columns;

  var node_style_datatypes = this.newconfig.node_style_datatypes;
  
  var datatype   = node_style_datatypes[style_mode].datatype;
  var categories = node_style_datatypes[style_mode].categories;
  
  function update_category(ctgval) {
    if(!ctgval) { return; }    
    node_style_datatypes[style_mode].categories[ctgval] = {ctg:ctgval, color:"", shape:"", size:"", label_inside:""};
  };


//   if(datasourceElement.datasource_mode == "edge")    {
//     //var datatype = selected_dtype.datatype
//     //datatype = datatype.replace(/^f1\./, '');
//     //datatype = datatype.replace(/^f2\./, '');
//     //console.log("zenbuCategoryElement_postprocess edges type["+datatype+"]")
// 
//     for(j=0; j<datasourceElement.edge_array.length; j++) {
//       var edge = datasourceElement.edge_array[j];
//       if(!edge) { continue; }
//       if(!edge.feature1) { continue; }
//       if(!edge.feature2) { continue; }
// 
//       //check for focus_feature sub-selection
//       if(datasourceElement.focus_feature &&
//          (datasourceElement.focus_feature.id != edge.feature1_id) &&
//          (datasourceElement.focus_feature.id != edge.feature2_id)) { continue; }
//       //if(datasourceElement.show_only_search_matches && !edge.search_match) { continue; }
// 
//       var t_feature = null;
//       if(edge && (/^f1\./.test(selected_dtype.datatype))) { t_feature = edge.feature1;}
//       if(edge && (/^f2\./.test(selected_dtype.datatype))) { t_feature = edge.feature2;}
//       
//       if(t_feature) {
//         if(t_feature.source && (datatype == "category")) {
//           update_category(t_feature.source.category, t_feature.filter_valid);
//         } else if(t_feature.source && (datatype == "source_name")) {
//           update_category(t_feature.source.name, t_feature.filter_valid);
//         } else if(datatype == "location_string") {
//           update_category(t_feature.chromloc, t_feature.filter_valid);
//         } else  if(datatype == "name") {
//           update_category(t_feature.name, t_feature.filter_valid);
//         } else if(t_feature.mdata && t_feature.mdata[datatype]) {
//           var value_array = t_feature.mdata[datatype];
//           for(var idx1=0; idx1<value_array.length; idx1++) {
//             val = value_array[idx1];
//             update_category(val, t_feature.filter_valid);
//           }
//         }
//       } else { //selected_dtype is on the edge
//         if(edge.source && (datatype == "category")) {
//           update_category(edge.source.category, edge.filter_valid);
//         } else if(edge.source && (datatype == "source_name")) {
//           update_category(edge.source.name, edge.filter_valid);
//         } else if(datatype == "location_string") {
//           update_category(edge.chromloc, edge.filter_valid);
//         } else if(edge.mdata && edge.mdata[datatype]) {
//           var value_array = edge.mdata[datatype];
//           for(var idx1=0; idx1<value_array.length; idx1++) {
//             val = value_array[idx1];
//             update_category(val, edge.filter_valid);
//           }
//         }
//       }      
//     }  //loop on edges
//   }
  
  if(source_type == "feature") {
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      
      if(feature.source && (datatype == "category")) { update_category(feature.source.category); } 
      else if(feature.source && (datatype == "source_name")) { update_category(feature.source.name); } 
      else if(datatype == "location_string") { update_category(feature.chromloc); } 
      else  if(datatype == "name") { update_category(feature.name); } 
      else if(feature.mdata && feature.mdata[datatype]) {
        var value_array = feature.mdata[datatype];
        for(var idx1=0; idx1<value_array.length; idx1++) { update_category(value_array[idx1]); }
      }
    }
  }

  //debug show the calculated categories
  var ctgs = "";
  for(var ctg in categories) { ctgs += ctg+", "; }  
  console.log("zenbuCytoscapeElement_calcDatatypeCategories "+this.elementID+" datatype:"+datatype+": "+ctgs);
}

//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuCytoscapeElement_reset() {
  console.log("zenbuCytoscapeElement_reset ["+this.elementID+"]");
  

  //clear previous loaded data
  //this.features = new Object();
  //this.feature_array = new Array();
  //this.edge_array = new Array();
  //this.edge_count = 0;
  
  //clear previous target
  //this.selected_id = ""; //selected row in the table
  //this.selected_feature = null; //selected row in the table
}


function zenbuCytoscapeElement_load() {
  console.log("zenbuCytoscapeElement_load");
  this.fetchAssembly()
}


function zenbuCytoscapeElement_postprocess() {
  //cytoscape does not append to title
  this.title = this.title_prefix;
  
  this.fetchAssembly();  //fetch if needed

  var datasourceElement = this.datasource();

  if(this.cy) { this.cy.destroy(); this.cy = null; }

  this.cyto_elements = [];
  
  if(datasourceElement.datasource_mode == "edge") {
    this.postprocessEdges();
  }
  if(datasourceElement.datasource_mode == "feature") {
    this.postprocessFeatures();
  }

  if(this.cyto_elements.length == 0) {
    //demo objects
    this.cyto_elements = [ // list of graph elements to start with
        { data: { id: 'a', text_color: "#2X2C2C", node_color: "gray", node_shape: "round-rectangle" } },
        { data: { id: 'b', text_color: "#2X2C2C", node_color: "gray", node_shape: "round-rectangle" } },
        { data: { id: 'ab', source: 'a', target: 'b', edge_color: "#CCC" } } // edge
      ];    
  }  
}


function zenbuCytoscapeElement_postprocessEdges() {
  var starttime = new Date();
  
  var elementID = this.elementID;
  console.log("zenbuCytoscapeElement_postprocessEdges: " + elementID);
  
  var datasourceElement = this.datasource();

  var feature_count = datasourceElement.feature_array.length;
  var edge_count    = datasourceElement.edge_array.length;
  console.log("zenbuCytoscapeElement_postprocessEdges: " + feature_count+ " features, " + edge_count+" edges, "+datasourceElement.filter_count+" filtered");

  this.title = this.title_prefix;
  if(datasourceElement.focus_feature) {
    if(!this.selected_feature) { this.selected_feature = datasourceElement.focus_feature; }
    console.log("zenbuCytoscapeElement_postprocessEdges start focus["+datasourceElement.focus_feature.name+"]");
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
  
  this.dtype_columns.sort(reports_column_order_sort_func);

  var edge_color_dtype = null;
  var edge_color_weight_min = this.edge_color_weight_min;
  var edge_color_weight_max = this.edge_color_weight_max;
  var dt1 = datasourceElement.datatypes[this.edge_color_datatype];
  if(dt1) {
    edge_color_dtype = dt1;
    console.log("edge_color_dtype dtype:"+edge_color_dtype.datatype+" minval:"+edge_color_dtype.min_val+" maxval:"+edge_color_dtype.max_val);
    edge_color_weight_min = edge_color_dtype.min_val;
    edge_color_weight_max = edge_color_dtype.max_val;
    if(this.edge_color_weight_min != "auto") { edge_color_weight_min = this.edge_color_weight_min; }
    if(this.edge_color_weight_max != "auto") { edge_color_weight_max = this.edge_color_weight_max; }
    if(this.edge_color_weight_logscale) {
      if(edge_color_weight_min!=0) { edge_color_weight_min = Math.log10(edge_color_weight_min); }
      if(edge_color_weight_max!=0) { edge_color_weight_max = Math.log10(edge_color_weight_max); }
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

      //
      // feature1
      //
      var feature1 = edge.feature1;
      var node_color = this.default_node_color;
      var node_shape = this.default_node_shape; //round-rectangle, rhomboid
      //dynamic change shape/color based on metadata
      if(this.node_style_datatypes) {
        if(this.node_style_datatypes["shape"]) {
          var datatype = this.node_style_datatypes["shape"].datatype;        
          //get the category for the datatype from the feature
          var ctg_value = "";
          if(feature1.mdata && feature1.mdata[datatype]) {
            var value_array = feature1.mdata[datatype];
            for(var idx1=0; idx1<value_array.length; idx1++) {
              ctg_value = value_array[idx1];
              break;
            }
          }
          //get the shape        
          if(this.node_style_datatypes["shape"].categories[ctg_value] &&
            this.node_style_datatypes["shape"].categories[ctg_value].shape) {
            node_shape = this.node_style_datatypes["shape"].categories[ctg_value].shape
          }
        }
        if(this.node_style_datatypes["color"]) {
          var datatype = this.node_style_datatypes["color"].datatype;        
          //get the category for the datatype from the feature
          var ctg_value = "";
          if(feature1.mdata && feature1.mdata[datatype]) {
            var value_array = feature1.mdata[datatype];
            for(var idx1=0; idx1<value_array.length; idx1++) {
              ctg_value = value_array[idx1];
              break;
            }
          }
          //get the color        
          if(this.node_style_datatypes["color"].categories[ctg_value] &&
            this.node_style_datatypes["color"].categories[ctg_value].color) {
            node_color = this.node_style_datatypes["color"].categories[ctg_value].color
          }
        }
      }
      var ele1 = { group:"nodes", selectable:true, grabbable:true, 
                     data: { id:"", dbid: "", text_color: "#2X2C2C", node_color: node_color, node_shape: node_shape } };
                  
      if(this.label_inside_nodes) {
        //label inside options                    
        var cl1 = new RGBColor(node_color);
        var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
        var text_color = "#2X2C2C"; //"rgb(44,44,44);"; //or black
        if(Y<=0.28) { text_color = "#FFFFFF"; } //white text
        //console.log("f1 Y="+Y+" textcolor "+text_color);
        
        ele1.data.text_color = text_color;
      }
      //if(node_shape == "rhomboid") { ele1.style.padding = "20px"; }

      var names = {}; //keep track of unique names for this element
      for(var i=0; i<this.dtype_columns.length; i++) {
        var dtype_col = this.dtype_columns[i];
        if(!dtype_col) { continue; }
        if(dtype_col.datatype == "row") { continue; }
        if(!dtype_col.visible && !dtype_col.signal_active) { continue; }
        var n1 = zenbu_object_dtypecol_value(edge.feature1, dtype_col, "unique"); //unique values concatenated 
        if(n1!="") { 
          if(!names[n1]) {
            if(ele1.data.id !="") { ele1.data.id += ", "; }
            ele1.data.id += n1;
            names[n1] = true;
          }
        }
      }
      if(ele1.data.id=="" && edge.feature1.name && (edge.feature1.name != edge.feature1.source_name)) {
        ele1.data.id = edge.feature1.name;
      }
      if(ele1.data.id=="") { ele1.data.id = "f1_"+j; }
      edge.feature1.node_name = ele1.data.id;
      ele1.data.dbid = feature1.id;
      this.cyto_elements.push(ele1);

      //
      // feature2
      //
      var feature2 = edge.feature2;
      var node_color = this.default_node_color;
      var node_shape = this.default_node_shape; //round-rectangle, rhomboid
      //dynamic change shape/color based on metadata
      if(this.node_style_datatypes) {
        if(this.node_style_datatypes["shape"]) {
          var datatype = this.node_style_datatypes["shape"].datatype;        
          //get the category for the datatype from the feature
          var ctg_value = "";
          if(feature2.mdata && feature2.mdata[datatype]) {
            var value_array = feature2.mdata[datatype];
            for(var idx1=0; idx1<value_array.length; idx1++) {
              ctg_value = value_array[idx1];
              break;
            }
          }
          //get the shape        
          if(this.node_style_datatypes["shape"].categories[ctg_value] &&
            this.node_style_datatypes["shape"].categories[ctg_value].shape) {
            node_shape = this.node_style_datatypes["shape"].categories[ctg_value].shape
          }
        }
        if(this.node_style_datatypes["color"]) {
          var datatype = this.node_style_datatypes["color"].datatype;        
          //get the category for the datatype from the feature
          var ctg_value = "";
          if(feature2.mdata && feature2.mdata[datatype]) {
            var value_array = feature2.mdata[datatype];
            for(var idx1=0; idx1<value_array.length; idx1++) {
              ctg_value = value_array[idx1];
              break;
            }
          }
          //get the color        
          if(this.node_style_datatypes["color"].categories[ctg_value] &&
            this.node_style_datatypes["color"].categories[ctg_value].color) {
            node_color = this.node_style_datatypes["color"].categories[ctg_value].color
          }
        }
      }

      var ele2 = { group:"nodes", selectable:true, grabbable:true, 
                   data: { id:"", dbid:"", text_color: "#2X2C2C", node_color: node_color, node_shape: node_shape } };
      if(this.label_inside_nodes) {
        //label inside options
        var cl1 = new RGBColor(node_color);
        var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
        var text_color = "#2X2C2C"; //"rgb(44,44,44);"; //or black
        if(Y<=0.28) { text_color = "#FFFFFF"; } //white text
        //console.log("f2 Y="+Y+" textcolor "+text_color);

        ele2.data.text_color = text_color;
      }
      //if(node_shape == "rhomboid") { ele2.style.padding = "20px"; }
      
      var names = {}; //keep track of unique names for this element
      for(var i=0; i<this.dtype_columns.length; i++) {
        var dtype_col = this.dtype_columns[i];
        if(!dtype_col) { continue; }
        if(dtype_col.datatype == "row") { continue; }
        if(!dtype_col.visible && !dtype_col.signal_active) { continue; }
        var n1 = zenbu_object_dtypecol_value(edge.feature2, dtype_col, "unique"); //unique values concatenated 
        if(n1!="") { 
          if(!names[n1]) {
            if(ele2.data.id !="") { ele2.data.id += ", "; }
            ele2.data.id += n1;
            names[n1] = true;
          }
        }
      }
      if(ele2.data.id=="" && edge.feature2.name && (edge.feature2.name != edge.feature2.source_name)) { 
        ele2.data.id = edge.feature2.name;
      }
      if(ele2.data.id=="") { ele2.data.id = "f2_"+j; }
      edge.feature2.node_name = ele2.data.id;
      ele2.data.dbid = feature2.id;
      this.cyto_elements.push(ele2);
      
      //edge
      var edge_color = this.default_edge_color;
      if(edge_color_dtype && (this.edge_color_mode == "weight")) { 
        var signal = 0.0;        
        var weights = edge.weights[edge_color_dtype.datatype];
        if(weights && weights.length>0) { signal = weights[0].weight; }
        //colorscore (cr) is 0..1 scaled signal
        //var cs = (signal - edge_color_dtype.min_val) / (edge_color_dtype.max_val - edge_color_dtype.min_val);
        if(this.edge_color_weight_logscale) { signal = Math.log10(signal); }
        var cs = (signal - edge_color_weight_min) / (edge_color_weight_max - edge_color_weight_min);
        var color = zenbuScoreColorSpace(this.edge_weight_colorspace, cs, false, 
                                         false, //this.edge_color_weight_logscale,
                                         this.edge_color_weight_invert); //leave discrete false          
        edge_color = color.getCSSHexadecimalRGB();
      }
      
      var ele = { group:"edges", selectable:true, grabbable:true, data: { id:edge.id, dbid: edge.id, edge_color: edge_color } };
      ele.data.source = edge.feature1.node_name;
      ele.data.target = edge.feature2.node_name;
      //TODO: edge weight 
      this.cyto_elements.push(ele);
    }
  }

  console.log("zenbuCytoscapeElement_postprocessEdges: " + feature_count+ " features, " + edge_count+" edges, "+this.filter_count+" filtered");
  
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("zenbuCytoscapeElement_postprocessEdges " +(runtime)+"msec");
}


function zenbuCytoscapeElement_postprocessFeatures() {
  var starttime = new Date();
  
  var elementID = this.elementID;
  console.log("zenbuCytoscapeElement_postprocessFeatures: " + elementID);
  
  var datasourceElement = this.datasource();

  var feature_count = datasourceElement.feature_array.length;
  //console.log("zenbuCytoscapeElement_postprocessFeatures: " + feature_count+ " features, "+datasourceElement.filter_count+" filtered");

  this.title = this.title_prefix;
  
  this.fetchAssembly();  //fetch if needed
  if(this.assembly && this.assembly.chroms_hash) {
    for(var chrom_name in this.assembly.chroms_hash) {
      var chrom = this.assembly.chroms_hash[chrom_name];
      if(!chrom) { continue; }
      chrom.has_connections = false;
    }
  }
  
  this.dtype_columns.sort(reports_column_order_sort_func);

  if(datasourceElement.datasource_mode == "feature") {
    this.filter_count=0;
    //datasourceElement.feature_array.sort(this.tableSortFunc());
    for(j=0; j<datasourceElement.feature_array.length; j++) {
      var feature = datasourceElement.feature_array[j];
      if(!feature) { continue; }
      if(!feature.filter_valid) { continue; }
      if(datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

      this.filter_count++;
      
      if(this.assembly && this.assembly.chroms_hash) {
        var chrom1 = this.assembly.chroms_hash[feature.chrom];
        if(chrom1) { chrom1.has_connections = true; }
      }

      var ele = { group:"nodes", selectable:true, grabbable:true, data: { id:"" } };

      var names = {}; //keep track of unique names for this element
      for(var i=0; i<this.dtype_columns.length; i++) {
        var dtype_col = this.dtype_columns[i];
        if(!dtype_col) { continue; }
        if(dtype_col.datatype == "row") { continue; }
        if(!dtype_col.visible && !dtype_col.signal_active) { continue; }
        
        var n1 = zenbu_object_dtypecol_value(feature, dtype_col, "unique"); //unique values concatenated 
        if(n1!="") { 
          if(!names[n1]) {
            if(ele.data.id !="") { ele.data.id += ", "; }
            ele.data.id += n1;
            names[n1] = true;
          }
        }
      }

      if(ele.data.id=="" && feature.name && (feature.name != feature.source_name)) { ele.data.id = feature.name; }
      if(ele.data.id=="") { ele.data.id = "n"+j; }
      this.cyto_elements.push(ele);

      
//     { // node n1
//       group: 'nodes', // 'nodes' for a node, 'edges' for an edge
//       // NB the group field can be automatically inferred for you but specifying it
//       // gives you nice debug messages if you mis-init elements
//       data: { // element data (put json serialisable dev data here)
//         id: 'n1', // mandatory (string) id for each element, assigned automatically on undefined
//         parent: 'nparent', // indicates the compound node parent id; not defined => no parent
//         // (`parent` can be effectively changed by `eles.move()`)
//       },
//       // scratchpad data (usually temp or nonserialisable data)
//       scratch: {
//         _foo: 'bar' // app fields prefixed by underscore; extension fields unprefixed
//       },
//       position: { // the model position of the node (optional on init, mandatory after)
//         x: 100,
//         y: 100
//       },
//       selected: false, // whether the element is selected (default false)
//       selectable: true, // whether the selection state is mutable (default true)
//       locked: false, // when locked a node's position is immutable (default false)
//       grabbable: true, // whether the node can be grabbed and moved by the user
//       pannable: false, // whether dragging the node causes panning instead of grabbing
//       classes: ['foo', 'bar'] // an array (or a space separated string) of class names that the element has
//     },
      
      
      
    }
  }
  console.log("zenbuCytoscapeElement_postprocessFeatures: " + feature_count+ " features, "+this.filter_count+" filtered");
  var endtime = new Date();
  var runtime = (endtime.getTime() - starttime.getTime());
  console.log("zenbuCytoscapeElement_postprocessFeatures " +(runtime)+"msec");
}



//=================================================================================
// fetch assembly

function zenbuCytoscapeElement_fetch_assembly() {
  if(!this.assembly_name) { return; }
  if(this.assembly) {
    //console.log("zenbuCytoscapeElement_fetch_assembly :: assembly loaded ["+this.assembly.assembly_name+"]");
    if(this.assembly.assembly_name == this.assembly_name) {
      //console.log("zenbuCytoscapeElement_fetch_assembly :: assembly matches assembly_name");
      return; 
    }
  }
  console.log("zenbuCytoscapeElement_fetch_assembly :: fetch ["+this.assembly_name+"]");
  
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
    console.log("zenbuCytoscapeElement_fetch_assembly :: Problem with responseXML no xmlDoc");
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
  //console.log("zenbuCytoscapeElement_fetch_assembly found ["+this.assembly.assembly_name+"] "+this.assembly.description);

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

function zenbuCytoscapeElement_draw() {
  if(this.loading) { return; }
  //console.log("zenbuCytoscapeElement_draw ["+this.elementID+"]");
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this.datasource();
  this.fetchAssembly();  //fetch if needed

  //if(this.filter_count == 0) { //use the query feature
  //  var load_info = main_div.appendChild(document.createElement('div'));
  //  load_info.setAttribute('style', "font-size:11px; ;margin-left:15px;");
  //  load_info.innerHTML = "no data...";
  //  return;
  //}
    
  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 40;
  width = width -11;
  //console.log("zenbuCytoscapeElement_draw width["+width+"] height["+height+"]");
  
  if(!this.cytoscape_div) { 
    var cytoscape_div  = document.createElement('div');
    //cytoscape_div.setAttribute('style', "width: "+width+"px; height:"+height+"px;");
    cytoscape_div.setAttribute("style", "font-size:11px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    cytoscape_div.style.width = width+"px";
    cytoscape_div.style.height = height+"px";
    this.cytoscape_div = cytoscape_div;
  }
  main_div.appendChild(this.cytoscape_div);
  this.cytoscape_div.style.width = width+"px";
  this.cytoscape_div.style.height = height+"px";

  var layout_options = {
    name: this.layout_style,
    //name: "random",
    nodeDimensionsIncludeLabels: true, // Excludes the label when calculating node bounding boxes for the layout algorithm
    //animate: true, // whether to transition the node positions
    //animationDuration: 500, // duration of animation in ms if enabled
    randomize: false,
    padding: 20,
    minNodeSpacing: 1,
    spacingFactor: 0.6, 
    /*
    //concentric
    fit: true, // whether to fit the viewport to the graph
    padding: 30, // the padding on fit
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
    nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
    height: undefined, // height of layout area (overrides container height)
    width: undefined, // width of layout area (overrides container width)
    spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
    animate: false, // whether to transition the node positions
    animationDuration: 500, // duration of animation in ms if enabled
    animationEasing: undefined, // easing of animation if enabled
    animateFilter: function ( node, i ){ return true; }, 
      // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
    ready: undefined, // callback on layoutready
    stop: undefined, // callback on layoutstop
    transform: function (node, position ){ return position; } 
      // transform a given node position. Useful for changing flow direction in discrete layouts
    
    //breadthfirst adds
    directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
    grid: false, // whether to create an even grid into which the DAG is placed (circle:false only)
    roots: undefined, // the roots of the trees
    maximal: false, // whether to shift nodes down their natural BFS depths in order to avoid upwards edges (DAGS only)
    
    //preset
    positions: undefined, // map of (node id) => (position obj); or function(node){ return somPos; }
    zoom: undefined, // the zoom level to set (prob want fit = false if set)
    pan: undefined, // the pan level to set (prob want fit = false if set)
    
    //grid
    avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
    condense: false, // uses all available space on false, uses minimal space on true
    rows: undefined, // force num of rows in the grid
    cols: undefined, // force num of columns in the grid
    position: function( node ){}, // returns { row, col } for element
    sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
    
    //circle
    clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
    radius: undefined, // the radius of the circle
    startAngle: 3 / 2 * Math.PI, // where nodes start in radians
    sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
    clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
    sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }

    //concentric
    startAngle: 3 / 2 * Math.PI, // where nodes start in radians
    sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
    clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
    equidistant: false, // whether levels have an equal radial distance betwen them, may cause bounding box overflow
    minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
    concentric: function( node ){ // returns numeric value for each node, placing higher nodes in levels towards the centre
    return node.degree();
    },
    levelWidth: function( nodes ){ // the letiation of concentric values in each level
    return nodes.maxDegree() / 4;
    },
    */
  };


  if(this.label_inside_nodes) {
    //label_inside_nodes style
    this.cyto_node_style = { 
        'background-color': '#AAA',
        'label': 'data(id)',
        'color': 'data(text_color)',  //#2X2C2C default
        'font-weight': 'bold',
        'background-color': 'data(node_color)',
        'border-color': 'data(node_color)',
        'border-width':3,
        'border-opacity':1,
        'background-opacity':0.5, 
        shape: 'data(node_shape)',
        padding: '10px', //20 for rhomboid?
        width: 'label',
        height: 'label', 
        'text-halign': 'center',
        'text-valign': 'center',
        'text-outline-color': 'data(node_color)',
        'text-outline-opacity': 1,
        'text-outline-width':3
    };
  } else {
    this.cyto_node_style = { 
        'color': '#2X2C2C',
        'label': 'data(id)',
        'background-color': 'data(node_color)',
        'border-color': 'data(node_color)',
        'border-width':3,
        'border-opacity':1,
        'background-opacity':0.5, 
        shape: 'data(node_shape)',
    };
  }

  this.cyto_style[0] = { selector: 'node', style: this.cyto_node_style };  //first style is for nodes
  
  if(!this.cy) {
    // this.cy = cytoscape({ container: this.cytoscape_div, elements: this.cyto_elements, style: this.cyto_style, layout: { name: 'cose' } });
    // this.cy = cytoscape({ container: this.cytoscape_div, elements: this.cyto_elements, style: this.cyto_style, layout: { name: 'random' } });    

    //var layout = { name: this.layout_style };
    //var layout = { name: "random" };

    this.cy = cytoscape({ container: this.cytoscape_div, elements: this.cyto_elements, style: this.cyto_style, layout: layout_options });    
  } else {
    this.cy.mount( this.cytoscape_div ); //Attaches the instance to the specified container for visualisation.
    layout = this.cy.layout(layout_options);
    layout.run();
  }

  this.cy.autounselectify( false );

  //this.cy.elements().on('select', function(evt){ console.log( 'select ' + evt.target.id() ); });
  //this.cy.elements().on('unselect', function(evt){ console.log( 'unselect ' + evt.target.id() ); });
  
  var func1 = function(id) { return function(evt) { 
      zenbuCytoscapeElement_cyto_event(id, 'select', evt.target.data("dbid")); };}(this.elementID);
  this.cy.elements().on('tap', func1);

  //var func2 = function(id) { return function(evt) { 
  //    zenbuCytoscapeElement_cyto_event(id, 'unselect', ''); };}(this.elementID);
  //this.cy.elements().on('unselect', func2);
  //this.cy.elements().on('select', function(evt){ zenbuCytoscapeElement_cyto_event(this.elementID, 'select', evt.target.data("dbid")); });
  //this.cy.elements().on('unselect', function(evt){ zenbuCytoscapeElement_cyto_event(this.elementID, 'unselect', evt.target.data("dbid")); });

  // if(this.layout_style != "random") {
  //   this.cy.mount(this.cytoscape_div);
  //   layout_options.name = "random";
  //   var layout = this.cy.layout(layout_options);
  //   layout.run();
  //   layout_options.name = this.layout_style;    
  //   layout = this.cy.layout(layout_options);
  //   layout.run();
  // }
}


function zenbuCytoscapeElement_cyto_event(elementID, evnt, dbid) {
  console.log("zenbuCytoscapeElement_cyto_event ["+elementID+"] "+evnt+" "+dbid);
  
  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var datasourceElement = reportElement.datasource();
  if(!datasourceElement) { return; }

  if(!reportElement.cy) { return; }
  
  if(evnt=="select") {
    reportElement.selected_edge = null;
    reportElement.selected_feature = null;
    if(dbid == reportElement.selected_id) { reportElement.selected_id = null; }
    else { reportElement.selected_id = dbid; }
    //reportElementEvent(elementID, 'select', dbid);
    reportElement.showSelections();
  }
}


function zenbuCytoscapeElement_renderEdges(svg) {
  if(!this.assembly) { return; }
  if(!svg) { return; }
    
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this.datasource();
  if(datasourceElement.datasource_mode != "edge") { return; }
    
  //console.log("zenbuCytoscapeElement_renderEdges ["+this.elementID+"]");

  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 50;
  width = width -10;
    
  var radius = width;
  if(height<radius) { radius = height; }
  radius = (radius / 2.0)-10;
  //console.log("zenbuCytoscapeElement_renderEdges width["+width+"] height["+height+"]  radius["+radius+"]");
  
  for(j=0; j<datasourceElement.edge_array.length; j++) {
    var edge = datasourceElement.edge_array[j];
    if(!edge) { continue; }
    edge.selected = false;
    if(this.selected_edge && (edge.id == this.selected_edge.id)) { edge.selected=true; }
  }
  datasourceElement.edge_array.sort(reports_cytoscape_edge_sort_func);

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
    //console.log("cytoscape edge.f1 ["+edge.feature1.name+"] edge.f2["+edge.feature2.name+"]");
    //console.log("cytoscape edge.f1 ["+edge.feature1.chrom+"] edge.f2["+edge.feature2.chrom+"]");
    
    var chrom1 = this.assembly.chroms_hash[edge.feature1.chrom];
    if(!chrom1) { continue; }
    if(chrom1.chrom_length==0) { continue; }

    var chrom2 = this.assembly.chroms_hash[edge.feature2.chrom];
    if(!chrom2) { continue; }
    if(chrom2.chrom_length==0) { continue; }
    
    arc_f1 = chrom1.arc_start + (edge.feature1.start)*(chrom1.arc_end - chrom1.arc_start)/chrom1.chrom_length;
    var point_f1 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f1);
    //console.log("cytoscape edge.f1 ["+edge.feature1.chrom+"] :"+edge.feature1.start+" : "+arc_f1+" : "+point_f1.x+","+point_f1.y);

    arc_f2 = chrom2.arc_start + (edge.feature2.start)*(chrom2.arc_end - chrom2.arc_start)/chrom2.chrom_length;
    var point_f2 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f2);
    //console.log("cytoscape edge.f2 ["+edge.feature2.chrom+"] :"+edge.feature2.start+" : "+arc_f2+" : "+point_f2.x+","+point_f2.y);
    
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
    
    line1.setAttribute("onmouseover", "zenbuCytoscapeElement_edgeHoverInfo('"+this.elementID+"','"+j+"');");
    line1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    line1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ edge.id+"');");
  }
}


function zenbuCytoscapeElement_renderFeatures(svg) {
  if(!this.assembly) { return; }
  if(!svg) { return; }
    
  var main_div = this.main_div;
  if(!main_div) { return; }

  var datasourceElement = this.datasource();
  if(datasourceElement.datasource_mode != "feature") { return; }
    
  //console.log("zenbuCytoscapeElement_renderFeatures ["+this.elementID+"]");

  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 50;
  width = width -10;
    
  var radius = width;
  if(height<radius) { radius = height; }
  radius = (radius / 2.0)-10;
  //console.log("zenbuCytoscapeElement_renderFeatures width["+width+"] height["+height+"]  radius["+radius+"]");
  
  for(j=0; j<datasourceElement.feature_array.length; j++) {
    var feature = datasourceElement.feature_array[j];
    if(!feature) { continue; }
    feature.selected = false;
    if(this.selected_feature && (feature.id == this.selected_feature.id)) { feature.selected=true; }
  }
  datasourceElement.feature_array.sort(reports_cytoscape_feature_sort_func);

  //make sure the columns are sorted for the hover-info
  this.dtype_columns.sort(reports_column_order_sort_func);

  var t1 = performance.now();
  //console.log("after sort " + (t1 - t0) + " msec.");
  
  for(j=0; j<datasourceElement.feature_array.length; j++) {
    var feature = datasourceElement.feature_array[j];
    if(!feature) { continue; }
    if(!feature.filter_valid) { continue; }
    if(datasourceElement.show_only_search_matches && !feature.search_match) { continue; }

    //ok render the feature    
    var chrom1 = this.assembly.chroms_hash[feature.chrom];
    if(!chrom1) { continue; }
    if(chrom1.chrom_length==0) { continue; }
    var chrom2 = chrom1;
    
    arc_f1 = chrom1.arc_start + (feature.start)*(chrom1.arc_end - chrom1.arc_start)/chrom1.chrom_length;
    var point_f1 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f1);
    //console.log("cytoscape feature.f1 ["+feature.chrom+"] :"+feature.start+" : "+arc_f1+" : "+point_f1.x+","+point_f1.y);

    arc_f2 = chrom2.arc_start + (feature.end)*(chrom2.arc_end - chrom2.arc_start)/chrom2.chrom_length;
    var point_f2 = polarToCartesian((width/2.0), height/2.0, radius-25, arc_f2);
    //console.log("cytoscape feature.f2 ["+feature.chrom+"] :"+feature.start+" : "+arc_f2+" : "+point_f2.x+","+point_f2.y);
    
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
    
    if(this.selected_feature && (feature.id == this.selected_feature.id)) {
      line1.setAttributeNS(null, 'stroke', "rgba(255,0,225,0.9)");
      line1.setAttributeNS(null, 'stroke-width', "5px");
    }
    
    line1.setAttribute("onmouseover", "zenbuCytoscapeElement_featureHoverInfo('"+this.elementID+"','"+j+"');");
    line1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    line1.setAttribute("onmousedown", "reportElementEvent(\""+this.elementID+"\", 'select', '"+ feature.id+"');");
  }
}


function zenbuCytoscapeElement_showSelections() {
  console.log("zenbuCytoscapeElement_showSelections "+this.elementID+" "+this.selected_id);
  //can't just redraw since cytoscape always throws away user mods/movements or does a new layout
  //so I must use the internal cytoscape elements().select() functions

  if(!this.cy) { console.log("cytoscape obj not created yet"); return; }
  
  var datasourceElement = this.datasource();
  
  //first unselect everything from the graph
  
  this.cy.elements().selectify();
  this.cy.elements().unselect();
  this.cy.elements().unselectify();
  
  //console.log("cyto unselected everything");
  //if(this.selected_id.match(/Edge/)) { console.log("cyto selected_id is Edge"); }

  var selected_hash = {};

  //reselect the feature if selected_id is for feature/node
  this.selected_feature = null;
  for(j=0; j<datasourceElement.feature_array.length; j++) {
    var feature = datasourceElement.feature_array[j];
    if(!feature) { continue; }
    if(!feature.filter_valid) { continue; }
    if(this.search_data_filter && this.show_only_search_matches && !feature.search_match) { continue; }
    
    if(feature.id == this.selected_id) {
      //console.log("cyto found matching feature: "+feature.id+" node.id="+feature.node_name);
      this.selected_feature = feature;
      selected_hash[feature.id] = feature;
      //this.cy.elements("node[id = '"+(feature.node_name)+"' ]").select();
    }
  }    
  //if(this.selected_feature) { 
  //  console.log("cyto selected feature ["+this.elementID+"] "+this.selected_feature.id+" "+this.selected_feature.node_name);
  //}
  
  for(j=0; j<datasourceElement.edge_array.length; j++) {
    var edge = datasourceElement.edge_array[j];
    if(!edge) { continue; }
    if(!edge.filter_valid) { continue; }
    if(this.search_data_filter && this.show_only_search_matches && !edge.search_match) { continue; }
    if(this.focus_feature &&
        (this.focus_feature.id != edge.feature1_id) &&
        (this.focus_feature.id != edge.feature2_id)) { continue; }      
    
    if(edge.id == this.selected_id) {
      //console.log("cyto found matching selection edge: "+edge.id+" "+edge.feature1.node_name+" "+edge.feature2.node_name);
      selected_hash[edge.id] = edge;
      selected_hash[edge.feature1.id] = edge.feature1;
      selected_hash[edge.feature2.id] = edge.feature2;
    }
    
    if(this.selected_feature && (edge.feature1.node_name == this.selected_feature.node_name)) {         
      //console.log("cyto found matching f1: "+edge.id+" "+edge.feature1.node_name+" "+edge.feature2.node_name);
      selected_hash[edge.id] = edge;
      selected_hash[edge.feature1.id] = edge.feature1;
    }
    if(this.selected_feature && (edge.feature2.node_name == this.selected_feature.node_name)) {         
      //console.log("cyto found matching f2: "+edge.id+" "+edge.feature1.node_name+" "+edge.feature2.node_name);
      selected_hash[edge.id] = edge;
      selected_hash[edge.feature2.id] = edge.feature2;
    }
  }

  var feature_count=0, edge_count=0, count=0;
  for(var dbid in selected_hash) {
    var obj = selected_hash[dbid];
    var ele = null;
    count++;
    if(obj.classname == "Feature") { 
      var feature = obj;
      feature_count++; 
      //console.log("ctyo try to find node by id="+feature.node_name);
      ele = this.cy.getElementById(feature.node_name);
      if(ele) { 
        //console.log("cyto select NODE : "+ele.id());
        ele.selectify();
        ele.select();
        ele.unselectify();
      }
    }
    if(obj.classname == "Edge") { 
      var edge = obj;
      edge_count++; 
      //console.log("ctyo try to find edge by id="+edge.id);
      ele = this.cy.getElementById(obj.id);
      if(ele) {
        //console.log("cyto select EDGE : "+ele.id()); 
        ele.selectify();
        ele.select();
        ele.unselectify();
      }
    }
  }

  console.log("zenbuCytoscapeElement_showSelections ["+this.elementID+"] need to select features:"+feature_count+", edges:"+edge_count+", count:"+count);
}


function zenbuCytoscapeElement_edgeHoverInfo(elementID, edgeIdx) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var datasourceElement = reportElement.datasource();
  if(!datasourceElement) { return; }
  if(datasourceElement.datasource_mode != "edge") { return; }
    
  var edge = datasourceElement.edge_array[edgeIdx];
  if(!edge) { return; }
  
  zenbuReports_hoverInfo(reportElement, edge);
}


function zenbuCytoscapeElement_featureHoverInfo(elementID, featureIdx) {
  var toolTipLayer = document.getElementById("toolTipLayer");
  if(!toolTipLayer) { return; }

  var reportElement = current_report.elements[elementID];
  if(!reportElement) { return; }

  var datasourceElement = reportElement.datasource();
  if(!datasourceElement) { return; }
  if(datasourceElement.datasource_mode != "feature") { return; }
    
  var feature = datasourceElement.feature_array[featureIdx];
  if(!feature) { return; }
  
  zenbuReports_hoverInfo(reportElement, feature);
}

//=================================================================================
//
// configuration
//
//=================================================================================

function zenbuCytoscapeElement_configSubpanel() {
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this.datasource();
    
  // div1 = configdiv.appendChild(document.createElement('div'));
  // var genomeWidget = zenbuGenomeSelectWidget("filter_search", this.elementID);
  // genomeWidget.callOutFunction = zenbuCytoscapeElement_genome_select_callback;
  // if(this.assembly_name) { genomeWidget.name = this.assembly_name; }
  // genomeWidget.elementID = this.elementID;
  // genomeWidget.assemblySelect.style.width = "330px";
  // div1.appendChild(genomeWidget);
  // zenbuGenomeSelectUpdate(this.elementID);

  // tdiv2  = configdiv.appendChild(document.createElement('div'));
  // tdiv2.setAttribute('style', "margin: 5px 0px 0px 5px;");
  // tdiv2.appendChild(reportElementColorSpaceOptions(this));

  //----  
  // configdiv.appendChild(document.createElement('hr'));

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute('style', "margin-top: 10px;");
  var layout_style = this.layout_style;
  if(this.newconfig && this.newconfig.layout_style != undefined) { layout_style = this.newconfig.layout_style; }
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 0px 0px 5px;");
  span1.innerHTML = "layout style: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'layout_style', this.value);");
  var types = ["random", "grid", "cose", "breadthfirst", "concentric", "circle"];
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == layout_style) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }

  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 7px 1px 0px 20px;");
  tcheck.setAttribute('type', "checkbox");
  var val1 = this.label_inside_nodes;
  if(this.newconfig && this.newconfig.label_inside_nodes != undefined) { 
    val1 = this.newconfig.label_inside_nodes; 
  }
  if(val1) { tcheck.setAttribute('checked', "checked"); }
  tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'label_inside_nodes', this.checked);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "margin: 0px 0px 0px 3px;");
  tspan2.innerHTML = "labels inside nodes";

  var hr1 = configdiv.appendChild(document.createElement('hr'));
  hr1.style.borderTop = "1px dashed #7f7f7f";

  var tdiv1 = configdiv.appendChild(document.createElement('div'));
  tdiv1.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = tdiv1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="node styling :";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var node_shape = this.default_node_shape;
  if(this.newconfig && this.newconfig.default_node_shape != undefined) { node_shape = this.newconfig.default_node_shape; }
  var span1 = tdiv2.appendChild(document.createElement('span'));
  span1.setAttribute('style', "margin: 2px 0px 0px 5px;");
  span1.innerHTML = "default node shape: ";
  var select = tdiv2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'default_node_shape', this.value);");
  var types = ["ellipse", "triangle", "round-triangle", "rectangle", "round-rectangle", "bottom-round-rectangle", "cut-rectangle", "barrel", "rhomboid", "diamond", "round-diamond", "pentagon", "round-pentagon", "hexagon", "round-hexagon", "concave-hexagon", "heptagon", "round-heptagon", "octagon", "round-octagon", "star", "tag", "round-tag", "vee" ];
  for(var i=0; i<types.length; i++) {
    var val1 = types[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", val1);
    if(val1 == node_shape) { option.setAttribute("selected", "selected"); }
    option.innerHTML = val1;
  }
  
  //
  //default_node_color
  //
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin: 0px 5px 0px 5px; ");
  tspan.innerHTML = "default node coloring: ";

  var color_mode = this.node_color_mode;
  if(this.newconfig && this.newconfig.node_color_mode != undefined) { color_mode = this.newconfig.node_color_mode; }
  //console.log("color_mode : "+color_mode);
  
  radio1 = tdiv2.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_node_color_mode");
  radio1.setAttribute("value", "fixed_color");
  if(color_mode == "fixed_color") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'node_color_mode', this.value);");
  tspan1 = tdiv2.appendChild(document.createElement('span'));
  tspan1.innerHTML = "fixed color";
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio2.setAttribute("name", this.elementID + "_node_color_mode");
  radio2.setAttribute("value", "signal");
  if(color_mode == "signal") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'node_color_mode', this.value);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "signal";

  var dtype_count = 0;
  for(var dtype in datasourceElement.datatypes) {
    var dtype_col = datasourceElement.datatypes[dtype];
    if(!dtype_col) { continue; }
    if(dtype_col.col_type != "signal") { continue; }
    dtype_count++;
  }
//   if(dtype_count==0) { 
//     radio1.setAttribute('checked', "checked");
//     radio2.setAttribute('disabled', "disabled");
//     tspan2.style.color = "#808080";
//   }
  
  var color_options_div = configdiv.appendChild(document.createElement('div'));
  color_options_div.setAttribute('style', "margin-top:2px;");

  if(color_mode == "fixed_color") { 
    var fixed_color = this.default_node_color;
    if(this.newconfig && this.newconfig.default_node_color != undefined) { fixed_color = this.newconfig.default_node_color; }
    tspan2 = color_options_div.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 10px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "fixed color:";
    var colorInput = color_options_div.appendChild(document.createElement('input'));
    colorInput.setAttribute('value', fixed_color);
    colorInput.setAttribute('size', "7");
    colorInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'default_node_color', this.value);");
    
    if(this.fixed_color_picker) { this.fixed_color_picker.hidePicker(); } //hide old picker
    this.fixed_color_picker = new jscolor.color(colorInput);
    color_options_div.appendChild(colorInput);
  }

  if(color_mode == "signal") {     
    //datatype select
    var tdiv  = color_options_div.appendChild(document.createElement('div'));
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "datatype:";
    tspan.style.marginLeft = "10px";
    var dtypeSelect = document.createElement('select');
    dtypeSelect.setAttribute('name', "datatype");
    dtypeSelect.className = "dropdown";
    dtypeSelect.style.fontSize = "10px";
    //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'node_signal_datatype', this.value); return false");
    dtypeSelect.setAttribute("onselect", "reportElementReconfigParam(\""+ this.elementID +"\", 'node_signal_datatype', this.value); return false");
    var val1 = this.node_signal_datatype;
    if(this.newconfig && this.newconfig.node_signal_datatype != undefined) { val1 = this.newconfig.node_signal_datatype; }
    var dtype_count = 0;
    for(var dtype in datasourceElement.datatypes) {
      var dtype_col = datasourceElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type != "signal") { continue; }
      var option = dtypeSelect.appendChild(document.createElement('option'));
      option.setAttribute("value", dtype_col.datatype);
      if(val1 == dtype) { option.setAttribute("selected", "selected"); }
      option.innerHTML = dtype_col.title;
      dtype_count++;
    }
    tdiv.appendChild(dtypeSelect);

    //add a color spectrum picker
    var uniqID = this.elementID+"_signalCSI";
    var signalCSI = this.signalCSI;
    if(!signalCSI) {
      signalCSI = zenbuColorSpaceInterface(uniqID);
      signalCSI.elementID = this.elementID;
      signalCSI.colorspace = this.node_signal_colorspace;
      signalCSI.enableScaling = true;
      signalCSI.min_signal = this.node_signal_min;
      signalCSI.max_signal = this.node_signal_max;
      signalCSI.logscale = this.node_signal_logscale;
      signalCSI.callOutFunction = zenbuGenomeWideElement_signal_CSI_callback;
      this.signalCSI = signalCSI;
    }
    zenbuColorSpaceInterfaceUpdate(uniqID);
    signalCSI.style.marginLeft = "10px";
    color_options_div.appendChild(signalCSI);
  }
  
  this.nodeStyleInterface();
  
  //
  // edge interfaces
  //
  var hr1 = configdiv.appendChild(document.createElement('hr'));
  hr1.style.borderTop = "1px dashed #7f7f7f";

  var tdiv1 = configdiv.appendChild(document.createElement('div'));
  tdiv1.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = tdiv1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="edge styling :";
  
  //default_edge_color
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  var tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin: 0px 5px 0px 5px; ");
  tspan.innerHTML = "edge coloring: ";

  var color_mode = this.edge_color_mode;
  if(this.newconfig && this.newconfig.edge_color_mode != undefined) { color_mode = this.newconfig.edge_color_mode; }
  //console.log("color_mode : "+color_mode);
  
  radio1 = tdiv2.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_edge_color_mode");
  radio1.setAttribute("value", "fixed_color");
  if(color_mode == "fixed_color") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edge_color_mode', this.value);");
  tspan1 = tdiv2.appendChild(document.createElement('span'));
  tspan1.innerHTML = "fixed color";
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio2.setAttribute("name", this.elementID + "_edge_color_mode");
  radio2.setAttribute("value", "weight");
  if(color_mode == "weight") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edge_color_mode', this.value);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "weight";
  
  var color_options_div = configdiv.appendChild(document.createElement('div'));
  color_options_div.setAttribute('style', "margin-top:2px;");

  if(color_mode == "fixed_color") { 
    var fixed_color = this.default_edge_color;
    if(this.newconfig && this.newconfig.default_edge_color != undefined) { fixed_color = this.newconfig.default_edge_color; }
    tspan2 = color_options_div.appendChild(document.createElement('span'));
    tspan2.setAttribute('style', "margin: 1px 4px 1px 10px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    tspan2.innerHTML = "fixed color:";
    var colorInput = color_options_div.appendChild(document.createElement('input'));
    colorInput.setAttribute('value', fixed_color);
    colorInput.setAttribute('size', "7");
    colorInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'default_edge_color', this.value);");
    
    if(this.fixed_color_picker) { this.fixed_color_picker.hidePicker(); } //hide old picker
    this.fixed_color_picker = new jscolor.color(colorInput);
    color_options_div.appendChild(colorInput);
  }

  if(color_mode == "weight") {     
    //datatype select
    var tdiv  = color_options_div.appendChild(document.createElement('div'));
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "datatype:";
    tspan.style.marginLeft = "10px";
    var dtypeSelect = document.createElement('select');
    dtypeSelect.setAttribute('name', "datatype");
    dtypeSelect.className = "dropdown";
    dtypeSelect.style.fontSize = "10px";
    //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edge_color_datatype', this.value); return false");
    dtypeSelect.setAttribute("onselect", "reportElementReconfigParam(\""+ this.elementID +"\", 'edge_color_datatype', this.value); return false");
    var val1 = this.edge_color_datatype;
    if(this.newconfig && this.newconfig.edge_color_datatype != undefined) { val1 = this.newconfig.edge_color_datatype; }
    var dtype_count = 0;
    for(var dtype in datasourceElement.datatypes) {
      var dtype_col = datasourceElement.datatypes[dtype];
      if(!dtype_col) { continue; }
      if(dtype_col.col_type != "weight") { continue; }
      var option = dtypeSelect.appendChild(document.createElement('option'));
      option.setAttribute("value", dtype_col.datatype);
      if(!val1) { val1=dtype_col.datatype; }
      if(val1 == dtype) { option.setAttribute("selected", "selected"); }
      option.innerHTML = dtype_col.title;
      dtype_count++;
    }
    tdiv.appendChild(dtypeSelect);
    
    if(!this.edge_color_datatype) { 
      if(!this.newconfig) { this.newconfig = {}; }
      this.newconfig.edge_color_datatype = val1;
    }
    
    //add a color spectrum picker
    var uniqID = this.elementID+"_edgeWeightCSI";
    var edgeColorCSI = this.edgeColorCSI;
    if(!edgeColorCSI) {
      edgeColorCSI = zenbuColorSpaceInterface(uniqID);
      edgeColorCSI.elementID = this.elementID;
      edgeColorCSI.colorspace = this.edge_weight_colorspace;
      edgeColorCSI.enableScaling = true;
      edgeColorCSI.min_signal = this.edge_color_weight_min;
      edgeColorCSI.max_signal = this.edge_color_weight_max;
      edgeColorCSI.logscale = this.edge_color_weight_logscale;
      edgeColorCSI.invert = this.edge_color_weight_invert;      
      edgeColorCSI.callOutFunction = zenbuCytoscapeElement_edge_color_CSI_callback;
      this.edgeColorCSI = edgeColorCSI;
    }
    zenbuColorSpaceInterfaceUpdate(uniqID);
    edgeColorCSI.style.marginLeft = "10px";
    color_options_div.appendChild(edgeColorCSI);
  }
  
  
//   configdiv.appendChild(document.createElement('hr'));
//   
//   tdiv2  = configdiv.appendChild(document.createElement('div'));
//   tcheck = tdiv2.appendChild(document.createElement('input'));
//   tcheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
//   tcheck.setAttribute('type', "checkbox");
//   var val1 = this.show_only_connected_chroms;
//   if(this.newconfig && this.newconfig.show_only_connected_chroms != undefined) { 
//     val1 = this.newconfig.show_only_connected_chroms; 
//   }
//   if(val1) { tcheck.setAttribute('checked', "checked"); }
//   tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_only_connected_chroms', this.checked);");
//   tspan2 = tdiv2.appendChild(document.createElement('span'));
//   tspan2.innerHTML = "show only connected chroms";
// 
//   show_mini_chroms
//   tcheck = tdiv2.appendChild(document.createElement('input'));
//   tcheck.setAttribute('style', "margin: 0px 1px 0px 15px;");
//   tcheck.setAttribute('type', "checkbox");
//   var val1 = this.show_mini_chroms;
//   if(this.newconfig && this.newconfig.show_mini_chroms != undefined) { 
//     val1 = this.newconfig.show_mini_chroms; 
//   }
//   if(val1) { tcheck.setAttribute('checked', "checked"); }
//   tcheck.setAttribute("onclick", "reportElementReconfigParam(\""+ this.elementID +"\", 'show_mini_chroms', this.checked);");
//   tspan2 = tdiv2.appendChild(document.createElement('span'));
//   tspan2.innerHTML = "expand small chroms";
//   tspan2.setAttribute("onmouseover", "eedbMessageTooltip(\"When selected, all chroms will be given a minimum size in order to be visible.<br>If not selected, chroms will be scaled to their true size and small chroms/scaffolds, although present, will be too small to see.\",250);");
//   tspan2.setAttribute("onmouseout", "eedbClearSearchTooltip();");
// 
//   focus_chrom_percent
//   tdiv2  = configdiv.appendChild(document.createElement('div'));
//   var val1 = this.focus_chrom_percent;
//   if(this.newconfig && this.newconfig.focus_chrom_percent != undefined) { 
//     val1 = this.newconfig.focus_chrom_percent; 
//   }
//   var span3 = tdiv2.appendChild(document.createElement('span'));
//   span3.setAttribute('style', "margin-left: 5px; ");
//   var tspan = span3.appendChild(document.createElement('span'));
//   tspan.innerHTML = "focus chrom percent: ";
//   var input = span3.appendChild(document.createElement('input'));
//   input.className = "sliminput";
//   input.style.width = "50px";
//   input.setAttribute('type', "text");
//   input.setAttribute('value', val1);
//   input.setAttribute("onchange", "reportElementReconfigParam(\""+this.elementID+"\", 'focus_chrom_percent', this.value);");

  configdiv.appendChild(document.createElement('hr'));

  return configdiv;
}


function zenbuCytoscapeElement_genome_select_callback(genomeWidget) {
  console.log("zenbuCytoscapeElement_genome_select_callback");
  if(!genomeWidget) { return; }
  var name = genomeWidget.name;
  if(name == "all") { name = ""; }
  reportElementReconfigParam(genomeWidget.elementID, 'assembly_name', name);
}

function zenbuCytoscapeElement_edge_color_CSI_callback(uniqID, mode, param, value, altvalue) {
  console.log("zenbuCytoscapeElement_edge_color_CSI_callback["+uniqID+"] mode:"+mode+" "+param+" value="+value+"  altvalue="+altvalue);

  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];
  if(zenbuCSI == null) { return; }
  var elementID = uniqID;
  if(zenbuCSI.elementID) { elementID = zenbuCSI.elementID; }
  var reportElement = current_report.elements[elementID];
  if(reportElement == null) { return; }
  if(mode=="reconfig_param") {    
    //typing in the values does not trigger reconfig, but [enter] triggers "update" which does pass through
    if(param != "min_signal" && param !="max_signal") { 
      reportElementReconfigParam(elementID, "reconfig_param", "", "");
    }
  }
}

function zenbuCytoscapeElement_nodeStyleInterface() {
  if(!this.cascade_triggers) { this.cascade_triggers = new Array(); }

  var datasourceElement = this.datasource();

  var main_div = this.main_div;
  if(!main_div) { return null; }
  var elementID = this.elementID;
  
  var auxdiv = this.auxdiv;
  if(!auxdiv) { return; }
  
  var configdiv = this.config_options_div;
  if(!configdiv) { return; }
  
  if(!this.nodeStyleDiv) {
    this.nodeStyleDiv = document.createElement('div');
  }
  var nodeStyleDiv = this.nodeStyleDiv;
  nodeStyleDiv.setAttribute('style', "width:100%;");
  nodeStyleDiv.innerHTML = "";
  //nodeStyleDiv.appendChild(document.createElement('hr'));
  
  configdiv.appendChild(nodeStyleDiv);

  //----------
  var labelDiv = nodeStyleDiv.appendChild(document.createElement('div'));
  labelDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var span1 = labelDiv.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  span1.innerHTML ="advanced node styling :";
    
  if(!this.newconfig || !this.newconfig.edit_node_style) {
    var button1 = labelDiv.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 7px; font-size:10px; color:black; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE;  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4);
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "edit node styles");
    button1.setAttribute("onmousedown", "reportElementReconfigParam(\""+ this.elementID +"\", 'edit_node_style', 'shape');");
    
    if(this.node_style_datatypes) {
      var tdiv = nodeStyleDiv.appendChild(document.createElement('div'));
      tdiv.style.marginLeft = "10px";
      for(var style_mode in this.node_style_datatypes) {
        if(!this.node_style_datatypes[style_mode].datatype) { continue; }
        
        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.setAttribute('style', "font-size:10px;");
        tspan.innerHTML = style_mode+": ";
        
        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.setAttribute('style', "font-size:10px; font-style:italic; margin-right:10px;");
        tspan.innerHTML = this.node_style_datatypes[style_mode].datatype;
      }
    } else {
      //var tdiv = nodeStyleDiv.appendChild(document.createElement('div'));
      //tdiv.style.marginLeft = "10px";
      //tdiv.innerHTML = "not activated";
    }
    return nodeStyleDiv;
  } 
  
  //
  // show details of interface 
  //
  var edit_node_style = this.newconfig.edit_node_style;
  
  var node_style_datatypes = this.node_style_datatypes;
  if(this.newconfig && this.newconfig.node_style_datatypes != undefined) { node_style_datatypes = this.newconfig.node_style_datatypes; }
  
  tdiv2  = nodeStyleDiv.appendChild(document.createElement('div'));
  var tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin: 0px 0px 0px 5px; ");
  tspan.innerHTML = "edit: ";

  radio1 = tdiv2.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_edit_node_style_radio");
  radio1.setAttribute("value", "shape");
  if(edit_node_style == "shape") { radio1.setAttribute('checked', "checked"); }
  radio1.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edit_node_style', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "shape";
  
  radio2 = tdiv2.appendChild(document.createElement('input'));
  radio2.setAttribute("type", "radio");
  radio1.setAttribute("name", this.elementID + "_edit_node_style_radio");
  radio2.setAttribute("value", "color");
  if(edit_node_style == "color") { radio2.setAttribute('checked', "checked"); }
  radio2.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edit_node_style', this.value);");
  tspan = tdiv2.appendChild(document.createElement('span'));
  tspan.innerHTML = "color";
  
  // radio3 = tdiv2.appendChild(document.createElement('input'));
  // radio3.setAttribute("type", "radio");
  // radio3.setAttribute("name", this.elementID + "_edit_node_style_radio");
  // radio3.setAttribute("value", "size");
  // if(this.newconfig.edit_node_style == "size") { radio2.setAttribute('checked', "checked"); }
  // radio3.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'edit_node_style', this.value);");
  // tspan = tdiv2.appendChild(document.createElement('span'));
  // tspan.innerHTML = "size";

    
  //node_style_datatypes select
  datasourceElement.dtype_columns.sort(reports_column_order_sort_func);
  var columns = datasourceElement.dtype_columns;

  var tdiv  = nodeStyleDiv.appendChild(document.createElement('tdiv'));
  tdiv.setAttribute('style', "margin: 3px 1px 0px 5px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "style node <b>"+edit_node_style +"</b> by datatype: ";
  var dtypeSelect = tdiv.appendChild(document.createElement('select'));
  dtypeSelect.setAttribute('name', "datatype");
  dtypeSelect.className = "dropdown";
  dtypeSelect.style.fontSize = "10px";
  //dtypeSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
  dtypeSelect.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'node_style_datatypes', this.value, '" +edit_node_style+"'); return false");
  dtypeSelect.setAttribute("onselect", "reportElementReconfigParam(\""+ this.elementID +"\", 'node_style_datatypes', this.value, '"+ +edit_node_style+"'); return false");
  var option = dtypeSelect.appendChild(document.createElement('option'));
  option.setAttribute("value", "");
  option.setAttribute("selected", "selected");
  option.innerHTML = "please select datatype";
  
  var node_datatypes = {};
  var datatype_array = [];
  for(var i=0; i<columns.length; i++) {
    var dtype_col = columns[i];
    if(!dtype_col) { continue; }
    if(dtype_col.col_type != "mdata") { continue; }
    
    var datatype = dtype_col.datatype;
    if(!(datatype.match(/^f1\./)) && !(datatype.match(/^f2\./))) { continue; }
    datatype = datatype.replace(/^f1\./, '');
    datatype = datatype.replace(/^f2\./, '');
    
    if(!node_datatypes[datatype]) {
      node_datatypes[datatype] = true;
      datatype_array.push(datatype);
    }
  }  
  datatype_array.sort();

  for(var i=0; i<datatype_array.length; i++) {    
    var datatype = datatype_array[i];
    var option = dtypeSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", datatype);          
    option.innerHTML = datatype;    
    if(node_style_datatypes && node_style_datatypes[edit_node_style] && (node_style_datatypes[edit_node_style].datatype == datatype)) { 
      option.setAttribute("selected", "selected");
    }
  }
  if(!node_style_datatypes || !node_style_datatypes[edit_node_style]) { return nodeStyleDiv; } 

  var categories = node_style_datatypes[edit_node_style].categories;

  var category_array = [];
  for(var ctg in categories) { 
    var ctg_obj = categories[ctg];
    category_array.push(ctg_obj);
  }
  //sort

  var table1 = nodeStyleDiv.appendChild(document.createElement('table'));
  for(var ctg_idx=0; ctg_idx<category_array.length; ctg_idx++){
    var ctg_obj = category_array[ctg_idx];
    if(!ctg_obj) { continue; }
    //console.log("trigger "+this.elementID+" ["+trig_idx+"] on["+trigger.on_trigger+"]  action["+trigger.action_mode+" - "+trigger.options+"]");
    //if(!trigger.targetElement) { trigger.targetElement = current_report.elements[trigger.targetElementID]; }
    //if(!trigger.targetElement) { continue; }
    
    var tr1 = table1.appendChild(document.createElement('tr'));

    //var rowdiv = nodeStyleDiv.appendChild(document.createElement('div'));
    var td1 = tr1.appendChild(document.createElement('td'));
    var span1 = td1.appendChild(document.createElement('span'));
    span1.style = "margin-left:10px; font-size:10px; font-style:italic;";
    span1.innerHTML = ctg_obj.ctg;
    
    //TODO: need to setup the reconfigParam to work with ctg shape/color
    
    if(edit_node_style == "shape") {
      var node_shape = this.default_node_shape;
      if(this.newconfig && this.newconfig.default_node_shape != undefined) { node_shape = this.newconfig.default_node_shape; }
      if(!ctg_obj.shape) { ctg_obj.shape = node_shape; }
      
      var td2 = tr1.appendChild(document.createElement('td'));
      var select = td2.appendChild(document.createElement('select'));
      select.className = "dropdown";
      select.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'ctg_node_shape', this.value, '"+ ctg_obj.ctg+ "');");
      //select.onchange = function(idx) { return function() { gLyphsTrackNameSearchSelect(glyphTrack.trackID, idx); };}(feature.fidx);
      var types = ["ellipse", "triangle", "round-triangle", "rectangle", "round-rectangle", "bottom-round-rectangle", "cut-rectangle", "barrel", "rhomboid", "diamond", "round-diamond", "pentagon", "round-pentagon", "hexagon", "round-hexagon", "concave-hexagon", "heptagon", "round-heptagon", "octagon", "round-octagon", "star", "tag", "round-tag", "vee" ];
      for(var i=0; i<types.length; i++) {
        var val1 = types[i];
        var option = select.appendChild(document.createElement('option'));
        option.setAttribute("value", val1);
        if(val1 == ctg_obj.shape) { option.setAttribute("selected", "selected"); }
        option.innerHTML = val1;
      }
    }

    if(edit_node_style == "color") {
      var fixed_color = this.default_node_color;
      if(this.newconfig && this.newconfig.default_node_color != undefined) { fixed_color = this.newconfig.default_node_color; }
      if(!ctg_obj.color) { ctg_obj.color = fixed_color; }

      var td2 = tr1.appendChild(document.createElement('td'));

      var colorInput = td2.appendChild(document.createElement('input'));
      colorInput.setAttribute('value', ctg_obj.color);
      colorInput.setAttribute('size', "7");
      colorInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'ctg_node_color', this.value, '"+  ctg_obj.ctg +"');");
      if(ctg_obj.fixed_color_picker) { ctg_obj.fixed_color_picker.hidePicker(); } //hide old picker
      ctg_obj.fixed_color_picker = new jscolor.color(colorInput);
      td2.appendChild(colorInput);
    }
  }
    
  return nodeStyleDiv;
}

//=================================================================================
//
// helper functions
//
//=================================================================================

function reports_cytoscape_edge_sort_func(a,b) {
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

function reports_cytoscape_feature_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.selected) { return 1; }
  if(b.selected) { return -1; }

  if(a.id < b.id) { return -1; }
  if(a.id > b.id) { return  1; }

  return 0;
}

function reports_cytoscape_chrom_sort_func(a,b) {
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

