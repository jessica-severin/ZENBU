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


//var element = new ZenbuHtmlElement();

function ZenbuHtmlElement(elementID) {
  //create empty, uninitialized Category report-element object
  console.log("create ZenbuHtmlElement");
  this.element_type = "html";
  if(!elementID) { elementID = this.element_type + (newElementID++); }
  this.elementID = elementID;
  
  reportElementInit(this);
  //zenbuElement_init.call(this); //eventually when I refactor the superclass Element into object code

  this.title_prefix = "";
  this.title = "new HtmlElement";
  this.html_content = "";

  this.show_titlebar = false;
  this.widget_search = false;
  this.widget_filter = false;
  
  //methods
  this.initFromConfigDOM  = zenbuHtmlElement_initFromConfigDOM;  //pass a ConfigDOM object
  this.generateConfigDOM  = zenbuHtmlElement_generateConfigDOM;  //returns a ConfigDOM object

  this.elementEvent       = zenbuHtmlElement_elementEvent;
  this.reconfigureParam   = zenbuHtmlElement_reconfigureParam;

  this.resetElement       = zenbuHtmlElement_reset;
  //this.loadElement        = zenbuHtmlElement_load;
  this.postprocessElement = zenbuHtmlElement_postprocess;
  this.drawElement        = zenbuHtmlElement_draw;
  this.configSubpanel     = zenbuHtmlElement_configSubpanel;

  //internal methods

  return this;
}


//=================================================================================
// Element configXML creation / init
//=================================================================================
//TODO: need to figure this out, not currently using

function zenbuHtmlElement_initFromConfigDOM(elementDOM) {
  //create trackdiv and glyphTrack objects and configure them
  if(!elementDOM) { return false; }
  var element_type = elementDOM.getAttribute("element_type");
  if(element_type != "html") { return false; }
  
  //eventually maybe a superclass init call here

  if(elementDOM.getAttribute("html_content")) { this.html_content = elementDOM.getAttribute("html_content"); }
  var htmlContentDOM = elementDOM.getElementsByTagName("html_content");
  if(htmlContentDOM && htmlContentDOM.length>0) {
    this.html_content = htmlContentDOM[0].firstChild.nodeValue;
  }
  //console.log("html_content ["+this.html_content+"]")
  return true;
}


function zenbuHtmlElement_generateConfigDOM() {
  var elementDOM = reportsGenerateElementDOM(this);  //superclass method eventually

  var doc = document.implementation.createDocument("", "", null);

  if(this.html_content) {
    //elementDOM.setAttribute("html_content", this.html_content);
    var htmlContentDOM = elementDOM.appendChild(doc.createElement("html_content"));
    //htmlContentDOM.appendChild(doc.createTextNode(escapeXml(this.html_content)));
    htmlContentDOM.appendChild(doc.createTextNode(this.html_content));
  }
  //if(this.view_config) { elementDOM.setAttribute("view_config", this.view_config); }
  //if(this.chrom_location) { elementDOM.setAttribute("chrom_location", this.chrom_location); }

  return elementDOM;
}


//===============================================================
//
// event and parameters methods
//
//===============================================================
//TODO: these are placeholders for now, still need to figure out how to integrate subclass into main code

function zenbuHtmlElement_elementEvent(mode, value, value2) {
  //var datasourceElement = this;
  //if(this.datasourceElementID) {
  //  var ds = current_report.elements[this.datasourceElementID];
  //  if(ds) { datasourceElement = ds; }
  //  else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  //}
}


function zenbuHtmlElement_reconfigureParam(param, value, altvalue) {
  if(!this.newconfig) { return; }
  //eventually a superclass method here, but for now a hybrid function=>obj.method approach
  
  if(param == "html_content") {
    if(this.newconfig.html_content === undefined) { this.newconfig.html_content = this.html_content; }
    this.newconfig.html_content = value;
  }

  if(param == "edit_html_content") {
    this.newconfig.edit_html_content = !this.newconfig.edit_html_content;
    reportsDrawElement(this.elementID);
  }

  if(param == "accept-reconfig") {
    //this.needReload=true;
  }
}



//=================================================================================
//
// reset / postprocess
//
//=================================================================================

function zenbuHtmlElement_reset() {
  console.log("zenbuHtmlElement_reset ["+this.elementID+"]");
  
  //clear previous target
  this.selected_id = ""; //selected row in the table
  this.selected_feature = null; //selected row in the table
  this.selected_edge = null; //selected row in the table
  this.selected_source = null; //selected row in the table
}

/*
function zenbuHtmlElement_load() {
  console.log("reportsLoadZenbuGB");
  //reportsResetZenbuGB(this);
  
  if(this.focus_feature) {
    this.title = this.title_prefix +" : " + this.focus_feature.name;
  }
  
  this.loading = true;
  reportsDrawElement(this.elementID); //clear or show loading (global/superclass)
  
  //eventually this might do something but for now it's a stub
  this.postprocessElement();
  reportsDrawElement(this.elementID); //global/superclass
}
*/

function zenbuHtmlElement_postprocess() {
  console.log("reportsPostprocessHtmlElement");
  this.loading = false;
}


function zenbuHtmlElement_draw() {
  if(this.loading) { return; }
  
  var main_div = this.main_div;
  if(!main_div) { return; }
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  
  var selected_feature = datasourceElement.selected_feature;
  var selected_edge = datasourceElement.selected_edge;
  var selected_source = datasourceElement.selected_source;
  var focus_feature = datasourceElement.focus_feature;
  
  if(datasourceElement.selected_id) {
    console.log("reportsDrawHtmlElement selected_id ["+datasourceElement.selected_id+"]");
  }
  if(datasourceElement.selected_feature) {
    console.log("reportsDrawHtmlElement selected_feature ["+datasourceElement.selected_feature.name +" "+datasourceElement.selected_feature.id +"]");
  }
  if(datasourceElement.selected_edge) {
    console.log("reportsDrawHtmlElement selected_edge ["+datasourceElement.selected_edge.id +"]");
  }
  if(datasourceElement.selected_source) {
    console.log("reportsDrawHtmlElement selected_source ["+datasourceElement.selected_source.name +" "+datasourceElement.selected_source.id +"]");
  }
  
  console.log("reportsDrawHtmlElement : " + this.elementID);

  var height = parseInt(main_div.clientHeight);
  var width = parseInt(main_div.clientWidth);
  height = height - 15;
  width = width - 10;

  var edit_html_content = false;
  if(this.newconfig && this.newconfig.edit_html_content != undefined) { edit_html_content = this.newconfig.edit_html_content; }

  var html_content = this.html_content;
  if(this.newconfig && this.newconfig.html_content != undefined) { html_content = this.newconfig.html_content; }

  if(edit_html_content) {
    var htmlInput = main_div.appendChild(document.createElement('textarea'));
    var style = "text-align:left; font-size:12px; font-family:Courier New, Courier, monospace; "+
                "background-color:#FDFDFD; min-width:100px; word-wrap:break-word; resize:none; "+
                "width:"+(width)+"px; height:"+(height-35)+"px;";
    htmlInput.setAttribute('style', style);
    htmlInput.setAttribute('value', html_content);
    htmlInput.innerHTML = html_content;
    htmlInput.setAttribute("onkeyup", "reportElementReconfigParam(\""+ this.elementID +"\", 'html_content', this.value);");
    htmlInput.setAttribute("onchange", "reportElementReconfigParam(\""+ this.elementID +"\", 'html_content', this.value);");
    htmlInput.setAttribute("onblur", "reportElementReconfigParam(\""+ this.elementID +"\", 'refresh', this.value);");
    return;
  }
  
  //process the this.html_content for data injection
  //var html_content = this.html_content;
  var idx1 = html_content.indexOf("{{");
  while(idx1 >=0) {
    var str1 = html_content.substr(0,idx1);
    var str2 = html_content.substr(idx1+2);
    var idx2 = str2.indexOf("}}");
    if(idx2 < 0) {
      idx1 = -1;
      break;
    }
    var injection = str2.substr(0,idx2);
    var str3 = str2.substr(idx2+2);
    //console.log("found injections {{ "+injection+" }} between str1\n"+str1+"\nand str3\n"+str3);
    var inj_val = "";
    try {
      inj_val = eval(injection);
      if(inj_val == "undefined") { inj_val = ""; }
      if(inj_val === undefined) { inj_val = ""; }
    } catch (e) {
      //if (e instanceof SyntaxError) { alert(e.message); }
    }
    //console.log("found injections {{ "+injection+" }} value => ["+inj_val+"]");
    html_content = str1 + inj_val + str3;
    idx1 = html_content.indexOf("{{");
  }
  
  
  
  //table contents
  var tdiv, tspan, tinput, ta;
  var html_div = main_div.appendChild(document.createElement('div'));
  this.html_div = html_div;
  var style = "text-align:left; font-size:12px; font-family:arial,helvetica,sans-serif; "+
  "background-color:#FDFDFD; min-width:100px; word-wrap:break-word; ";
  //"background-color:#FAFAFA; border:inset; border-width:2px; padding: 5px 5px 5px 5px; ";
  //"padding: 5px 5px 5px 5px; overflow: auto; resize: both; ";
  //"padding: 5px 5px 5px 5px; overflow-y:scroll; resize:both; ";
  //style += "min-width:100px; ";
  if(this.content_width) { style += "width:"+(this.content_width-2)+"px; "; }
  html_div.setAttribute('style', style);
  //console.log("html_div style "+style);
  
  html_div.innerHTML = "";
  html_div.innerHTML = html_content;
}

function prettifyXml(sourceXml) {
  var xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  var xsltDoc = new DOMParser().parseFromString([
                                                 // describes how we want to modify the XML - indent everything
                                                 '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
                                                 '  <xsl:output omit-xml-declaration="yes" indent="yes"/>',
                                                 '    <xsl:template match="node()|@*">',
                                                 '      <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
                                                 '    </xsl:template>',
                                                 '</xsl:stylesheet>',
                                                 ].join('\n'), 'application/xml');
  
  var xsltProcessor = new XSLTProcessor();
  xsltProcessor.importStylesheet(xsltDoc);
  var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
  var resultXml = new XMLSerializer().serializeToString(resultDoc);
  return resultXml;
}


function zenbuHtmlElement_configSubpanel() {
  //zenbuElement_configSubpanel.call(this);  //pseudo superclass method call
  
  if(!this.config_options_div) { return; }
  
  var configdiv = this.config_options_div;
  
  var datasourceElement = this;
  if(this.datasourceElementID) {
    var ds = current_report.elements[this.datasourceElementID];
    if(ds) { datasourceElement = ds; }
    else { console.log("failed to find datasource ["+this.datasourceElementID+"]"); }
  }
  
  configdiv.appendChild(document.createElement('hr'));
  
  var edit_html_content = false;
  if(this.newconfig && this.newconfig.edit_html_content != undefined) { edit_html_content = this.newconfig.edit_html_content; }

  button = configdiv.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  if(edit_html_content) {
    button.value = "preview html";
    button.innerHTML = "preview html";
  } else {
    button.value = "edit html content";
    button.innerHTML = "edit html content";
  }
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "reportElementReconfigParam(\""+this.elementID+"\", 'edit_html_content');");

}

//=================================================================================
//
// helper functions
//
//=================================================================================

