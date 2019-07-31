// ZENBU eedb_gLyphs.js
//
// Contact : Jessica Severin <severin@gsc.riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
// * ZENBU eedb_gLyphs.js
// * copyright (c) 2007-2010 Jessica Severin RIKEN OSC
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


var zenbuExpPanel_FilterXHR = null;
var zenbuExpPanel_current_dragPanelTrack = null;


function gLyphsDrawExpressionPanel(glyphsGB) {
  if(!glyphsGB) { return; }
  if(current_resizeTrack) { return; } //safety code using global variable
  console.log("gLyphsDrawExpressionPanel");

  if(!glyphsGB.active_trackID) {     
    if(glyphsGB.expPanelFrame) {
      glyphsGB.expPanelFrame.setAttribute('style', "visibility:hidden;"); 
    }
    return;
    //glyphsExpPanelDraw();
    //return; 
  }
  
  var glyphTrack = glyphsTrack_global_track_hash[glyphsGB.active_trackID];
  glyphTrack.expPanelActive = true;  //need this here for first page draw after track load
  glyphsExpPanelRecalcAndDraw(glyphTrack);
  
  gLyphsUpdateTrackTitleBars(glyphTrack.glyphsGB);
}


//======================================================================================
//
// new experiment-expression panel interface
//
//======================================================================================

function glyphsExpPanelRecalcAndDraw(glyphTrack) {
  if(!glyphTrack) { return; }
  if(current_resizeTrack) { return; } //safety code using global variable

  if(glyphTrack.loading) { return; }
  if(glyphTrack.delay_experiment_draw) { return; }
  //if(!glyphTrack.expPanelActive) { return; }
    
  if(glyphTrack.selected_feature) {
    processFeatureExpressExperiments(glyphTrack, glyphTrack.selected_feature);
  } else if(glyphTrack.has_expression) {  
    // track with expression (either feature/color or wiggle)
    processFeatureRegionExperiments(glyphTrack);
  }
  glyphsExpPanelDraw(glyphTrack);
}


function glyphsExpPanelDraw(glyphTrack) { 
  if(!glyphTrack) { return; }
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }

  if(glyphTrack.loading) { return; }
  if(glyphTrack.delay_experiment_draw) { return; }

  if(!glyphTrack.expPanelActive) { 
    //TODO: need logic for if a shared expframe or per-track
    //expframe.setAttribute('style', "visibility:hidden;");  
    return; 
  }

  if(!glyphTrack.experiment_array || (glyphTrack.experiment_array.length==0))  {
    expframe.setAttribute('style', "visibility:hidden;");
    return;
  }
  //console.log("glyphsExpPanelDraw "+glyphTrack.trackID);
  
  //reposition
  var xpos = expframe.getAttribute("xpos");
  var ypos = expframe.getAttribute("ypos");
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) {
    frame_width = glyphTrack.displayWidth();
  }
    
  if(xpos && ypos) { //floating
    expframe.setAttribute('style', 
                          "width:"+frame_width+"px; z-index:50; padding: 2px 2px 2px 2px; "+
                          "background-color:rgb(245,245,250); "+ 
                          "border:2px solid #808080; border-radius: 4px; "+
                          "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  } else { //attached at bottom
    expframe.setAttribute('style', 
                          "width:"+frame_width+"px; z-index:50; padding: 2px 2px 2px 2px; margin-bottom:3px;  "+
                          "border:2px solid #808080; border-radius: 4px; "+
                          "background-color:rgb(245,245,250);"); 
  }
  
  //build display experiment list
  var total_exp_count=0;
  var unfilter_exp_count=0;
  var experiments = new Array;
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    total_exp_count++;
    if(!experiment.hide) { unfilter_exp_count++ }
    if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
    //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
    experiments.push(experiment);
  }
  
  //sub panels
  if(!glyphTrack.expPanelFrame().auxdiv) {
    auxdiv = expframe.appendChild(document.createElement('div'));
    auxdiv.setAttribute('style', "width:100%; position:relative;");
    glyphTrack.expPanelFrame().auxdiv = auxdiv;
    gLyphsToggleExpressionSubpanel(glyphTrack.trackID, 'none'); //build the sub-panels
  }
  gLyphsToggleExpressionSubpanel(glyphTrack.trackID); //refresh the sub-panels
  
  //header
  var headerdiv = glyphTrack.expPanelFrame().headerdiv;
  if(!headerdiv) {
    headerdiv = expframe.appendChild(document.createElement('div'));
    headerdiv.setAttribute('style', "width:100%;");
    glyphTrack.expPanelFrame().headerdiv = headerdiv;
  }  
  clearKids(headerdiv);
  var header_g = gLyphsExpressionPanelHeader(glyphTrack);
  var svg = createSVG(frame_width, 30);
  svg.appendChild(header_g);
  headerdiv.appendChild(svg);

  //calc the text colors
  glyphTrack.posTextColor = "rgb(44,44,44)";
  glyphTrack.revTextColor = "rgb(44,44,44)";
  var cl1 = new RGBColor(glyphTrack.posStrandColor);
  if(cl1.ok) {
    var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
    if(Y<=0.28) { 
      //glyphTrack.posTextColor = "lightgray"; 
      //glyphTrack.posTextColor = "rgb(192, 192, 192)";
      glyphTrack.posTextColor = "rgb(230, 230, 230)";
    }
    //cl1.r = 255 - cl1.r;
    //cl1.g = 255 - cl1.g;
    //cl1.b = 255 - cl1.b;
    //glyphTrack.posTextColor = cl1.toRGB();
  }
  var cl2 = new RGBColor(glyphTrack.revStrandColor);
  if(cl2.ok) {
    var Y = 0.2126 * Math.pow(cl2.r/255.0,2.2)  +  0.7151 * Math.pow(cl2.g/255.0,2.2)  +  0.0721 * Math.pow(cl2.b/255.0,2.2);
    if(Y<=0.28) { 
      //glyphTrack.revTextColor = "lightgray"; 
      //glyphTrack.revTextColor = "rgb(192, 192, 192)";
      glyphTrack.revTextColor = "rgb(230, 230, 230)";
    }
    //cl2.r = 255 - cl2.r;
    //cl2.g = 255 - cl2.g;
    //cl2.b = 255 - cl2.b;
    //glyphTrack.revTextColor = cl2.toRGB();
  }
  
  //
  // content graph divs with optional internal scroll panel
  // 
  var graph_msgdiv = glyphTrack.expPanelFrame().graph_msgdiv;
  if(!graph_msgdiv) {
    graph_msgdiv = expframe.appendChild(document.createElement('div'));
    glyphTrack.expPanelFrame().graph_msgdiv = graph_msgdiv;
    graph_msgdiv.setAttribute('style', "width:100%; background-color:rgb(245,245,250); color:rgb(153,50,204); \
                              font-size:14px; font-weight:bold; font-family:arial,helvetica,sans-serif; \
                              margin: 7px 0px 0px 10px; display:none;");
  }
  
  var graphdiv = glyphTrack.expPanelFrame().graphdiv;
  if(!graphdiv) {
    graphdiv = expframe.appendChild(document.createElement('div'));
    glyphTrack.expPanelFrame().graphdiv = graphdiv;
    graphdiv.setAttribute('style', "width:100%; height:100px; background-color:rgb(245,245,250); "+
                          "min-height:100px; overflow-y:scroll; resize:vertical;");
  }
  clearKids(graphdiv);
  if(glyphTrack.exppanel_subscroll) {
    graphdiv.setAttribute('style', "width:100%; height:500px; background-color:rgb(245,245,250); "+
                          "min-height:100px; overflow-y:scroll; resize:vertical;");
  } else {
    graphdiv.setAttribute('style', "width:100%; background-color:rgb(245,245,250);");
  }

  //render the graph in the different modes
  var graph_g1 = gLyphsRenderExpressionPanelGraph(glyphTrack);
  var graph_height = 12*experiments.length;
  if(glyphTrack.exppanelmode == "mdgroup") {
    if(graph_g1.getAttribute('mdgroup_graph_height')) {
      graph_height = parseFloat(graph_g1.getAttribute('mdgroup_graph_height'));
    }
  }
  if(glyphTrack.exppanelmode == "ranksum") { 
    //if(glyphTrack.experiment_ranksum_enrichment) { graph_height = 12*glyphTrack.experiment_ranksum_enrichment.length; }
    if(graph_g1.getAttribute('ranksum_graph_height')) {
      graph_height = parseFloat(graph_g1.getAttribute('ranksum_graph_height'));
    }
    //if(graph_height<100) { graph_height=100; }
  }
  var graph_width  = frame_width - 20;  
  var svg2 = createSVG(graph_width, graph_height);
  if(graph_g1) { svg2.appendChild(graph_g1); }
  graphdiv.appendChild(svg2);  
  
  //rebuild export if needed
  if(glyphTrack.expression_subpanel_mode == "export")  { 
    var exportdiv = gLyphsExpressionPanelExportSubpanel();
    exportdiv.style.display = "block"; 
  }
}


function gLyphsExpressionPanelHeader(glyphTrack) {
  if(!glyphTrack) { return; }
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }

  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = glyphTrack.displayWidth(); }

  var header_g = glyphTrack.expPanelFrame().header_g;
  if(!header_g) {
    header_g = document.createElementNS(svgNS,'g');
    glyphTrack.expPanelFrame().header_g = header_g;
  }

  //for now still bind to a single track or selected feature
  if(!glyphTrack) { return; }
  var strandless = glyphTrack.strandless;
  var trackID = glyphTrack.trackID;

  var total_exp_count=0;
  var unfilter_exp_count=0;
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    total_exp_count++;
    if(experiment.hide) { continue; } 
    //if(glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
    unfilter_exp_count++
  }
  
  var ss;
  var se; 
  if(glyphTrack.selected_feature) {
    ss = glyphTrack.selected_feature.start;
    se = glyphTrack.selected_feature.end;
  } else {
    ss = glyphTrack.glyphsGB.start;
    se = glyphTrack.glyphsGB.end;
    if(glyphTrack.selection) { 
      ss = glyphTrack.selection.chrom_start;
      se = glyphTrack.selection.chrom_end;
    }
  }
  if(ss>se) { var t=ss; ss=se; se=t; }
  var len = se-ss+1;
  if(len > 1000000) { len = Math.round(len/100000)/10.0 + "mb"; }
  else if(len > 1000) { len = Math.round(len/100)/10.0 + "kb"; }
    
  else { len += "bp"; }
  var subheading_text = glyphTrack.glyphsGB.chrom+" "+ss +".."+se+" ("+len+")"; 
  
  // title bar, controls, and headers  
  header_g.setAttributeNS(null, "font-size","8pt");
  header_g.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  clearKids(header_g);

  var clip1 = header_g.appendChild(document.createElementNS(svgNS,'clipPath'));
  clip1.id = "expexp_header_clip1";
  var cliprec1 = clip1.appendChild(document.createElementNS(svgNS,'rect'));
  cliprec1.setAttribute('x', '0px');
  cliprec1.setAttribute('y', '0px');
  cliprec1.setAttribute('width', (frame_width-295)+'px');
  cliprec1.setAttribute('height', '18px');
  
  // make a rectangle for the "title bar" 
  var title_g = header_g.appendChild(document.createElementNS(svgNS,'g'));
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    title_g.setAttributeNS(null, "onmousedown", "gLyphsExpPanelToggleDrag('"+glyphTrack.trackID+"', 'start');");
    title_g.setAttributeNS(null, "onmouseup", "gLyphsExpPanelToggleDrag('"+glyphTrack.trackID+"', 'stop');");
  }
  var titleBar = title_g.appendChild(document.createElementNS(svgNS,'rect'));
  titleBar.setAttributeNS(null, 'x', '0px');
  titleBar.setAttributeNS(null, 'y', '0px');
  titleBar.setAttributeNS(null, 'width',  (frame_width-100)+'px');
  titleBar.setAttributeNS(null, 'height', '18px');
  titleBar.setAttributeNS(null, 'style', 'fill: #D7D7D7;');
  
  var titlepos = 8;
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    if(!glyphTrack.glyphsGB.share_exp_panel) {
      var widget = gLyphsExpPanelCloseWidget(glyphTrack);
      widget.setAttributeNS(null, 'transform', "translate(5,3)");
      header_g.appendChild(widget);
      titlepos +=17;
    } 
    if(expframe && expframe.getAttribute("xpos") && expframe.getAttribute("ypos")) {
      //floating
      var reattach = gLyphsCreateExperimentExpressReattachWidget(glyphTrack);
      reattach.setAttributeNS(null, 'transform', "translate("+(titlepos-3)+",3)");
      header_g.appendChild(reattach);
      titlepos +=17;
    }
  }
  var heading = title_g.appendChild(document.createElementNS(svgNS,'text'));
  heading.setAttribute('clip-path', "url(#expexp_header_clip1)");
  heading.setAttributeNS(null, 'x', titlepos+"px");
  heading.setAttributeNS(null, 'y', '14px');
  heading.setAttributeNS(null, "font-weight","bold");
  heading.setAttributeNS(null, "font-size","12pt");
  heading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  if(glyphTrack.selected_feature) {
   heading.appendChild(document.createTextNode(glyphTrack.selected_feature.name +" ~ "+glyphTrack.title));
  } else {
   heading.appendChild(document.createTextNode(glyphTrack.title));
  }
  
  var subheading = title_g.appendChild(document.createElementNS(svgNS,'text'));
  subheading.setAttributeNS(null, 'x', (frame_width-290)+'px');
  subheading.setAttributeNS(null, 'y', '12px');
  subheading.setAttributeNS(null, "font-size","8pt");
  subheading.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  subheading.appendChild(document.createTextNode(subheading_text));
  
  //widgets
  var widgetBar = header_g.appendChild(document.createElementNS(svgNS,'rect'));
  widgetBar.setAttributeNS(null, 'x', (frame_width-100)+'px');
  widgetBar.setAttributeNS(null, 'y', '0px');
  widgetBar.setAttributeNS(null, 'width',  "100px");
  widgetBar.setAttributeNS(null, 'height', "18px");
  widgetBar.setAttributeNS(null, 'style', "fill: #D7D7D7;");
  //widgetBar.setAttributeNS(null, 'style', "fill: #07D7D7;");

  var groupwidget = gLyphsCreateExperimentExpressGroupingWidget(glyphTrack);
  groupwidget.setAttributeNS(null, 'transform', "translate("+(frame_width-103)+",3)");
  header_g.appendChild(groupwidget);
  
  var filterwidget = gLyphsCreateExperimentExpressFilterWidget(glyphTrack);
  filterwidget.setAttributeNS(null, 'transform', "translate("+(frame_width-65)+",3)");
  header_g.appendChild(filterwidget);
    
  var configwidget = gLyphsCreateExpressionPanelConfigWidget(glyphTrack);
  configwidget.setAttributeNS(null, 'transform', "translate("+(frame_width-34)+",4)");
  header_g.appendChild(configwidget);
  
  var export1 = gLyphsCreateExperimentExpressExportWidget(glyphTrack);
  export1.setAttributeNS(null, 'transform', "translate("+(frame_width-18)+",3)");
  header_g.appendChild(export1);
  
  //column headers experiment/mdata name - strand info line
  var nametitle = "experiment name ("+unfilter_exp_count+" / "+ total_exp_count + ")";
  if(glyphTrack.exppanelmode == "mdgroup") {
    nametitle = "metadata group ["+glyphTrack.mdgroupkey+"] ("+unfilter_exp_count+" / "+ total_exp_count + " exps)";
  }
  if(glyphTrack.exppanelmode == "ranksum") { 
    nametitle = "rank-sum enrichment ("+unfilter_exp_count+" / "+ total_exp_count + " exps)";
  }
  var head1 = document.createElementNS(svgNS,'text');
  head1.setAttributeNS(null, 'x', '4px');
  head1.setAttributeNS(null, 'y', '28px');
  head1.setAttributeNS(null, "font-size","8pt");
  head1.appendChild(document.createTextNode(nametitle));
  if((glyphTrack.express_sort_mode == "name") || (glyphTrack.express_sort_mode == "mdvalue")) {
    head1.setAttributeNS(null, "font-weight","bold");
  }
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    if((glyphTrack.exppanelmode == "mdgroup") || (glyphTrack.exppanelmode == "ranksum")) { 
      head1.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'mdvalue');");
    } else {
      head1.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'name');");
    }
    head1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort experiment name',110);");
    head1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  header_g.appendChild(head1);
  
  
  if(!strandless) {
    var head1 = document.createElementNS(svgNS,'text');
    head1.setAttributeNS(null, 'x', (frame_width-280)+'px');
    head1.setAttributeNS(null, 'y', '28px');
    head1.setAttributeNS(null, 'text-anchor', "end");
    head1.setAttributeNS(null, "font-size","8pt");
    head1.appendChild(document.createTextNode("<- anti-sense strand"));
    if(glyphTrack.express_sort_mode == "value_minus") {
      head1.setAttributeNS(null, "font-weight","bold");
      //head1.setAttributeNS(null, "style", "color:purple");
    }
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      head1.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_minus');");  
      head1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort anti-sense strand',100);");
      head1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head1);
    
    var head2 = document.createElementNS(svgNS,'text');
    head2.setAttributeNS(null, 'x', (frame_width-265)+'px');
    head2.setAttributeNS(null, 'y', '28px');
    head2.setAttributeNS(null, "font-size","8pt");
    head2.appendChild(document.createTextNode("<>"));
    if(glyphTrack.express_sort_mode == "value_both") {
      head2.setAttributeNS(null, "font-weight","bold");
      head2.setAttributeNS(null, "font-size","10pt");
    }
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      head2.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_both');");  
      head2.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort both strands',90);");
      head2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head2);
    
    var head2 = document.createElementNS(svgNS,'text');
    head2.setAttributeNS(null, 'x', (frame_width-240)+'px');
    head2.setAttributeNS(null, 'y', '28px');
    head2.setAttributeNS(null, "font-size","8pt");
    head2.appendChild(document.createTextNode("sense strand ->"));
    if(glyphTrack.express_sort_mode == "value_plus") {
      head2.setAttributeNS(null, "font-weight","bold");
      //head2.setAttributeNS(null, "style", "color:green");
    }
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      head2.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_plus');");  
      head2.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort sense strand',100);");
      head2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head2);
  } else {
    var head1 = document.createElementNS(svgNS,'text');
    head1.setAttributeNS(null, 'x', (frame_width-470)+'px');
    head1.setAttributeNS(null, 'y', '28px');
    head1.setAttributeNS(null, "font-size","8pt");
    head1.appendChild(document.createTextNode("strandless"));
    if((glyphTrack.express_sort_mode == "value_both") || (glyphTrack.express_sort_mode == "value_plus")) {
      head1.setAttributeNS(null, "font-weight","bold");
      //head1.setAttributeNS(null, "style", "color:blue");
    }
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      head1.setAttributeNS(null, "onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_both');");  
      head1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip('sort strandless',80);");
      head1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    header_g.appendChild(head1);
  }
  return header_g;
}


function gLyphsRenderExpressionPanelGraph(glyphTrack) {
  var graph_g1;
  if(!glyphTrack) { return graph_g1; }
  
  if(!glyphTrack.exppanelmode ||(glyphTrack.exppanelmode=="experiments")) { 
    //tranditional single track show expression
    graph_g1 = gLyphsExpressionPanelRenderExperimentMode(glyphTrack);
  }
  if(glyphTrack.exppanelmode == "mdgroup") { 
    //metadata key grouping mode
    graph_g1 = gLyphsExpressionPanelRenderMDGroupMode(glyphTrack);
  }
  if(glyphTrack.exppanelmode == "ranksum") { 
    graph_g1 = gLyphsExpressionPanelRankSumRender(glyphTrack);
  }
  return graph_g1;
}


function gLyphsExpressionPanelRenderExperimentMode(glyphTrack) { 
  if(!glyphTrack) { return; }

  //original method shows one line per experiment
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }  

  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = glyphTrack.displayWidth(); }
  var graph_width  = frame_width - 20;
    
  //build display experiment list & calculate max_value for scaling
  var max_value = 0.0;
  var experiments = new Array;
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
    //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
    if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
    experiments.push(experiment);
    
    //calculate the max
    var value           = experiment.value;
    var sense_value     = experiment.sense_value;
    var antisense_value = experiment.antisense_value;
    //console.log("experiment id:"+ experiment.id+" value:"+value+" sense:"+sense_value+" anti:"+antisense_value);
    
    if(glyphTrack.strandless) {
      if(value > max_value) { max_value = value; }
    } else {
      if(sense_value > max_value)     { max_value = sense_value; }
      if(antisense_value > max_value) { max_value = antisense_value; }
    }    
  }  
  var graph_height = 12*experiments.length;
  //console.log("gLyphsExpressionPanelRenderExperimentMode "+glyphTrack.trackID + " has "+(experiments.length)+" experiments");
  
  //pre-generate new dynamic names so they can be sorted
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    gLyphsExperimentName(glyphTrack, experiment);
  }
  gLyphsTrack_sort_experiment_expression(glyphTrack, experiments, glyphTrack.express_sort_mode);
   
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');

  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    
    //make background box
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((i*12)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', '12px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    //back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    //back_rect.setAttributeNS(null, 'visibility', "hidden");
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      back_rect.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
      back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
      back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    experiment.back_rect = back_rect;
    g2.appendChild(back_rect);

    //calculate the max
    var value           = experiment.value;
    var sense_value     = experiment.sense_value;
    var antisense_value = experiment.antisense_value;
        
    //draw the experiment names
    var hideGlyph = gLyphsCreateHideExperimentWidget(glyphTrack, experiment, i);
    if(hideGlyph) { g2.appendChild(hideGlyph); }
    
    var exptype   = experiment.exptype;
    var expname   = experiment.expname;
    var expID     = experiment.id;
    var value     = experiment.value;
    var sig_error = experiment.sig_error;
    var hide      = experiment.hide;
    
    //ID magic to deal with proxy_id experiments
    var expID2 = expID;
    if(experiment.orig_id) { expID2 = experiment.orig_id; }
    
     // don't truncate the experiment names anymore
     //if(expname) {
     //var expname2 = expname.substring(0,41);
     //if(expname != expname2) { expname = expname2 +"..."; }
     //}
    if(expname == undefined) { expname = "loading names..."; }
    if(exptype) { expname += " ["+ exptype +"]"; }
    
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+9) +'px');
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      text.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +expID+ "\");");
      text.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + expID2+"\");");
      text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    if(experiment.hide) { text.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
    else { text.setAttributeNS(null, 'style', 'fill: black;'); }


    text.appendChild(document.createTextNode(expname));
    g2.appendChild(text);
  }
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g')); //parent for expression levels
  
  var g5a = g3.appendChild(document.createElementNS(svgNS,'g')); //bars -
  var g5b = g3.appendChild(document.createElementNS(svgNS,'g')); //bars +
  
  var g4a = g3.appendChild(document.createElementNS(svgNS,'g')); //text -
  var g4b = g3.appendChild(document.createElementNS(svgNS,'g')); //text +
  
  var scale = 0;
  if(max_value>0) { scale = 225.0 / max_value; }
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];

    var value           = experiment.value;
    var sense_value     = experiment.sense_value;
    var antisense_value = experiment.antisense_value;
    var sig_error       = experiment.sig_error;
    
    //if((sig_error < 0.01) || (sig_error >0.99)) ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
    //else ctx.fillStyle = "rgba(170, 170, 170, 0.5)";
    //ctx.fillRect (270, i*12+2, newvalue, 10);
    
    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', (graph_width-470)+'px');
      rect.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      //if((sig_error < 0.01) || (sig_error >0.99)) rect.setAttributeNS(null, 'fill', "rgb(123, 123, 240)");
      //else rect.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
      else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
      g5b.appendChild(rect);
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-460)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.setAttributeNS(null, 'style', 'fill:' + glyphTrack.posTextColor); 
      text1.appendChild(document.createTextNode(Math.round(value*1000.0)/1000.0));
      g4b.appendChild(text1);
      
      if(experiment.hide) { 
        rect.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        text1.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', (graph_width-240)+'px');
      rect1.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      //if((sig_error < 0.01) || (sig_error >0.99)) rect1.setAttributeNS(null, 'fill', "rgb(57, 177, 58)");  //green
      //else rect1.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      if(glyphTrack.exppanel_use_rgbcolor) { rect1.setAttributeNS(null, 'fill', experiment.rgbcolor); }
      else { rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
      g5b.appendChild(rect1);
      
      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (graph_width-240-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      //if((sig_error < 0.01) || (sig_error >0.99)) rect2.setAttributeNS(null, 'fill', "rgb(177, 89, 178)");  //purple
      //else rect2.setAttributeNS(null, 'fill', "rgb(170, 170, 170)");
      if(glyphTrack.exppanel_use_rgbcolor) { rect2.setAttributeNS(null, 'fill', experiment.rgbcolor); }
      else { rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); }
      g5a.appendChild(rect2);
            
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-235)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.appendChild(document.createTextNode(Math.round(sense_value*1000.0)/1000.0));
      //if(experiment.hide) { text1.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posTextColor); }
      text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posTextColor); 
      g4b.appendChild(text1);
      
      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', (graph_width-245)+'px');
      text2.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(antisense_value*1000.0)/1000.0));
      //if(experiment.hide) { text2.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revTextColor); }
      text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revTextColor);
      g4a.appendChild(text2);
      
      if(experiment.hide) { 
        rect1.setAttribute('style', "opacity:0.2");        
        rect2.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        text2.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        //text1.setAttribute('style', "opacity:0.2");        
        //text2.setAttribute('style', "opacity:0.2");        
      }
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect1.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        rect1.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        rect2.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        rect2.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        text1.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        text2.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        text2.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
    }
  }

  return g1;
}

function gLyphsExperimentName(glyphTrack, source) { 
  var name = undefined;
  if(!source) { return name; }

  if(source.name) { name = source.name; } //default
  source.expname = name;

  if(!glyphTrack) { return name; }
  if(!glyphTrack.exp_name_mdkeys) { return name; }
  if(!source.mdata) { return name; }

  //finite state machine parser
  name = "";
  var mdkey = "";
  var state=1;
  var pos=0;
  while(state>0) {
    if(pos > glyphTrack.exp_name_mdkeys.length) { state=-1; break; }
    var c1 = glyphTrack.exp_name_mdkeys.charAt(pos);

    switch(state) {
      case(1): //mdkey
        if(c1 == "" || c1==" " || c1=="\t" || c1=="\n" || c1=="," || c1=="\"") { 
          state=2;
        } else {
          mdkey += c1;
          pos++;
        }
        break;

      case(2): // add mdkey value to name
        //console.log("mdkey["+mdkey+"] ");
        if(mdkey && source.mdata[mdkey]) { 
          if(name) { name += " "; }
          name += source.mdata[mdkey][0]; 
        } 
        else if((mdkey=="name") || (mdkey=="eedb:name") || (mdkey=="display_name") || (mdkey=="eedb:display_name")) {
          if(name) { name += " "; }
          name += source.name;
        }
        else if(mdkey=="demux_key") {
          if(name) { name += " "; }
          name += source.demux_key;
        }
        mdkey = "";
        if(c1=="\"") { state=3; } else { state=1;}
        pos++;
        break;

      case(3): // quoted string
        if(c1=="\"") { 
          if(name) { name += " "; }
          name += mdkey; 
          mdkey = "";
          pos++;
          state = 1;
        } else {
          mdkey += c1;
          pos++;
        }
        break;

      default:
        state=-1;
        break;
    }
  }

  source.expname = name;
  return name;
}


function gLyphsExpressionPanelRenderMDGroupMode(glyphTrack) { 
  //original method shows one line per experiment
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  g1.setAttribute('mdgroup_graph_height', 50); //default if empty

  if(!glyphTrack) { return g1; }
  
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return g1; }    
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = glyphTrack.displayWidth(); }
  var graph_width  = frame_width - 20;
  
  if(!glyphTrack.experiment_mdgrouping) {
    gLyphsTrackCalcMetadataGrouping(glyphTrack.trackID);
  } else {
    gLyphsTrackCalcMetadataGroupingValues(glyphTrack); //just need to update the values
  }

  if(!glyphTrack.experiment_mdgrouping || (glyphTrack.experiment_mdgrouping.length == 0)) { 
    return g1;
  }
      
  /*
  //update the experiment_mdgrouping with current experiment_array values
  var max_value = 0.0;
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    mdgroup.value = 0;
    mdgroup.sense_value = 0;
    mdgroup.sense_error = 0;
    mdgroup.antisense_value = 0;
    mdgroup.antisense_error = 0;
    mdgroup.value_total = 0;
    mdgroup.sense_total = 0;
    mdgroup.antisense_total = 0;
    mdgroup.source_count = 0;
    
    var avgR=0, avgG=0, avgB=0, colorCnt=0;;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) {
        //console.log("noid["+srcid+"] ");
        continue;
      }
      //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
      //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
      if(experiment.hide) { continue; }
      if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }

      //calculate sums/mean
      mdgroup.value_total     += experiment.value;
      mdgroup.sense_total     += experiment.sense_value;
      mdgroup.antisense_total += experiment.antisense_value;
      mdgroup.source_count++;

      if(experiment.rgbcolor) {
        //console.log(" ["+experiment.rgbcolor+"] ");
        var cl2 = new RGBColor(experiment.rgbcolor);
        avgR += cl2.r;
        avgG += cl2.g;
        avgB += cl2.b;
        colorCnt++;
      }
    }
    if(mdgroup.source_count==0) { continue; }

    mdgroup.value           = mdgroup.value_total / mdgroup.source_count;
    mdgroup.sense_value     = mdgroup.sense_total / mdgroup.source_count;
    mdgroup.antisense_value = mdgroup.antisense_total / mdgroup.source_count;
    
    //calc error bar (stddev for now)
    mdgroup.value_error = 0;
    mdgroup.sense_error = 0;
    mdgroup.antisense_error = 0;
    if(mdgroup.source_ids.length>1) {
      for(var j=0; j<mdgroup.source_ids.length; j++) {
        var srcid = mdgroup.source_ids[j];
        var experiment = glyphTrack.experiments[srcid];
        if(!experiment) { continue; }
        if(experiment.hide) { continue; }
        //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
        //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
        if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }

        //calculate sums/mean
        mdgroup.value_error     += (experiment.value - mdgroup.value) * (experiment.value - mdgroup.value);
        mdgroup.sense_error     += (experiment.sense_value - mdgroup.sense_value) * (experiment.sense_value - mdgroup.sense_value);
        mdgroup.antisense_error += (experiment.antisense_value - mdgroup.antisense_value) * (experiment.antisense_value - mdgroup.antisense_value);
      }
      //sample standard deviation : sqrt (sum-of-squares / (n-1) )
      mdgroup.value_error     = Math.sqrt(mdgroup.value_error / (mdgroup.source_count-1));
      mdgroup.sense_error     = Math.sqrt(mdgroup.sense_error / (mdgroup.source_count-1));
      mdgroup.antisense_error = Math.sqrt(mdgroup.antisense_error / (mdgroup.source_count-1));

      //standard error of the mean : stddev \ sqrt (n)
      if(glyphTrack.errorbar_type == "stderror") { 
        mdgroup.value_error     = mdgroup.value_error / Math.sqrt(mdgroup.source_count);
        mdgroup.sense_error     = mdgroup.sense_error / Math.sqrt(mdgroup.source_count);
        mdgroup.antisense_error = mdgroup.antisense_error / Math.sqrt(mdgroup.source_count);
      }
    }

    //calc max
    if(glyphTrack.strandless) {
      if(mdgroup.value+mdgroup.value_error > max_value) { max_value = mdgroup.value+mdgroup.value_error; }
    } else {
      if(mdgroup.sense_value+mdgroup.sense_error > max_value)     { max_value = mdgroup.sense_value+mdgroup.sense_error; }
      if(mdgroup.antisense_value+mdgroup.antisense_error > max_value) { max_value = mdgroup.antisense_value+mdgroup.antisense_error; }
    }

    if(!mdgroup.rgbcolor && colorCnt>0) {
      //calculate the average color of all the experiments
      mdgroup.rgbcolor = "#FF00FF";
      avgR = parseInt(avgR / colorCnt);
      avgG = parseInt(avgG / colorCnt);
      avgB = parseInt(avgB / colorCnt);
      var color = new RGBColour(avgR, avgG, avgB);
      mdgroup.rgbcolor = color.getCSSHexadecimalRGB();
      //console.log(" ["+avgR +":"+avgG+":"+avgB+"]"+ mdgroup.rgbcolor);
    }
  }
  */

  //glyphTrack.glyphsGB.express_sort_mode = glyphTrack.express_sort_mode;
  //glyphTrack.experiment_mdgrouping.sort(gLyphs_exppanel_mdgroup_sort_func);
  gLyphsTrack_sort_experiment_expression(glyphTrack, glyphTrack.experiment_mdgrouping, glyphTrack.express_sort_mode);

  clearKids(g1);

  var active_mdgroups = new Array;
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    mdgroup.array_index = i;
    //if(mdgroup.source_count==0) { continue; }
    active_mdgroups.push(mdgroup);
  }
  g1.setAttribute('mdgroup_graph_height', 12 * active_mdgroups.length);

  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var i=0; i<active_mdgroups.length; i++) {
    var mdgroup = active_mdgroups[i];

    //make background box
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((i*12)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', '12px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      back_rect.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
      back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
      back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    mdgroup.back_rect = back_rect;
    g2.appendChild(back_rect);
    //share back_rect to the group experiments for gLyphsTrackHighlightExperiment()
    for(var src_idx=0; src_idx<mdgroup.source_ids.length; src_idx++) {
      var srcid = mdgroup.source_ids[src_idx];
      var experiment = glyphTrack.experiments[srcid];
      if(experiment) { experiment.mdgroup_back_rect = back_rect; }
    }

    var hideGlyph = gLyphsExpPanelHideMetadataWidget(glyphTrack, mdgroup);
    if(hideGlyph) { 
      hideGlyph.setAttribute('transform', "translate(0,"+ ((i*12)) +")");
      g2.appendChild(hideGlyph); 
    }

    //draw the names
    var name ="";
    if(mdgroup.mdvalue) { name += mdgroup.mdvalue; }
    if(mdgroup.source_count == mdgroup.source_ids.length) {
      name += " ("+mdgroup.source_count+" exps)";
    } else {
      name += " ("+mdgroup.source_count+"/"+(mdgroup.source_ids.length)+" exps)";
    }
        
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+9) +'px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      text.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
      text.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
      text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    
    if(mdgroup.hide) { text.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
    else { text.setAttributeNS(null, 'style', 'fill: black;'); }

    text.appendChild(document.createTextNode(name));
    g2.appendChild(text);
  }
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g')); //parent for expression levels
  
  var g5a = g3.appendChild(document.createElementNS(svgNS,'g')); //bars -
  var g5b = g3.appendChild(document.createElementNS(svgNS,'g')); //bars +
  
  var g4a = g3.appendChild(document.createElementNS(svgNS,'g')); //text -
  var g4b = g3.appendChild(document.createElementNS(svgNS,'g')); //text +
  
  var scale = 0;
  if(glyphTrack.mdgroup_max_value>0) { scale = 225.0 / glyphTrack.mdgroup_max_value; }
  for(var i=0; i<active_mdgroups.length; i++) {
    var mdgroup = active_mdgroups[i];

    var value           = mdgroup.value;
    var sense_value     = mdgroup.sense_value;
    var antisense_value = mdgroup.antisense_value;
        
    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', (graph_width-470)+'px');
      rect.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      //rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', mdgroup.rgbcolor); }
      else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }

      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        rect.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
        rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect);

      if(mdgroup.value_error>0) {
        var error_width = mdgroup.value_error * 2*scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-470+(2*scale*value))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        if(!glyphTrack.glyphsGB.exportSVGconfig) {
          error1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
          error1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
          error1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
        g5b.appendChild(error1);
      }      

      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-460)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      var cl1 = new RGBColor(glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { if(mdgroup.rgbcolor) { cl1 = new RGBColor(mdgroup.rgbcolor); } else { cl1 = new RGBColor("black"); } }
      var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
      var textColor = "rgb(44,44,44);"; //or black
      if(Y<=0.28) { textColor = "rgb(230, 230, 230);"; }
      text1.setAttributeNS(null, 'style', 'fill: '+textColor); 
      text1.appendChild(document.createTextNode(Math.round(value*1000.0)/1000.0));
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      if(mdgroup.hide) { 
        rect.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', (graph_width-240)+'px');
      rect1.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      //rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { rect1.setAttributeNS(null, 'fill', mdgroup.rgbcolor); }
      else { rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }

      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        rect1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
        rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect1);

      if(mdgroup.sense_error>0) {
        var error_width = mdgroup.sense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240+(sense_value * scale))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        if(!glyphTrack.glyphsGB.exportSVGconfig) {
          error1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
          error1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
          error1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
        g5b.appendChild(error1);
      }      
      
      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (graph_width-240-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      //rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { rect2.setAttributeNS(null, 'fill', mdgroup.rgbcolor); }
      else { rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); }

      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect2.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        rect2.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
        rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5a.appendChild(rect2);
      
      if(mdgroup.antisense_error>0) {
        var error_width = mdgroup.antisense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240-width2)+" "+((i*12)+5.5)+
                            " h-"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        if(!glyphTrack.glyphsGB.exportSVGconfig) {
          error1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
          error1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
          error1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
        g5b.appendChild(error1);
      }      
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-235)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.appendChild(document.createTextNode(Math.round(sense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text1.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text1.setAttributeNS(null, 'style', 'fill: black;'); }
      var cl1 = new RGBColor(glyphTrack.posStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { if(mdgroup.rgbcolor) { cl1 = new RGBColor(mdgroup.rgbcolor); } else { cl1 = new RGBColor("black"); } }
      var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
      var textColor = "rgb(44,44,44);"; //or black
      if(Y<=0.28) { textColor = "rgb(230, 230, 230);"; }
      text1.setAttributeNS(null, 'style', 'fill:'+textColor); 
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', (graph_width-245)+'px');
      text2.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(antisense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text2.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text2.setAttributeNS(null, 'style', 'fill: black;'); }
      var cl1 = new RGBColor(glyphTrack.revStrandColor);
      if(glyphTrack.exppanel_use_rgbcolor) { if(mdgroup.rgbcolor) { cl1 = new RGBColor(mdgroup.rgbcolor); } else { cl1 = new RGBColor("black"); } }
      var Y = 0.2126 * Math.pow(cl1.r/255.0,2.2)  +  0.7151 * Math.pow(cl1.g/255.0,2.2)  +  0.0721 * Math.pow(cl1.b/255.0,2.2);
      var textColor = "rgb(44,44,44);"; //or black
      if(Y<=0.28) { textColor = "rgb(230, 230, 230);"; }
      text2.setAttributeNS(null, 'style', 'fill:'+textColor); 
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text2.setAttributeNS(null, "onclick", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\", true);");
        text2.setAttributeNS(null, "onmouseover", "gLyphsTrackMDGroupInfo(\""+ glyphTrack.trackID+ "\", \"" + mdgroup.array_index +"\");");
        text2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4a.appendChild(text2);
      
      if(mdgroup.hide) { 
        rect1.setAttribute('style', "opacity:0.2");        
        rect2.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        text2.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    }
  }
  
  return g1;
}


//---- express panel move, resize, attach tools -----------------------------------------------------------

function gLyphsExpPanelCloseWidget(glyphTrack) {
  var g1 = document.createElementNS(svgNS,'g');

  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);
  var rg1 = document.createElementNS(svgNS,'radialGradient');
  rg1.setAttributeNS(null, 'id', 'radialGradient1');
  rg1.setAttributeNS(null, 'cx', '30%');
  rg1.setAttributeNS(null, 'cy', '30%');
  rg1.setAttributeNS(null, 'fx', '30%');
  rg1.setAttributeNS(null, 'fy', '30%');
  rg1.setAttributeNS(null, 'r',  '50%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'stop-opacity', '0');
  //stop1.setAttributeNS(null, 'stop-color', 'rgb(255,100,100)');
  stop1.setAttributeNS(null, 'stop-color', 'rgb(100,100,100)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  //stop2.setAttributeNS(null, 'stop-color', 'rgb(250,0,30)');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(150,150,150)');
  rg1.appendChild(stop2);

  var circle = document.createElementNS(svgNS,'circle');
  circle.setAttributeNS(null, 'cx', '4.5px');
  circle.setAttributeNS(null, 'cy', '5.5px');
  circle.setAttributeNS(null, 'r',  '6px');
  //circle.setAttributeNS(null, 'fill', 'rgb(230,230,230)');
  circle.setAttributeNS(null, 'fill', 'url(#radialGradient1)');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    circle.setAttributeNS(null, "onclick", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'exp_panel_close');");
    //circle.setAttributeNS(null, "onclick", "removeTrack(\"" + glyphTrack.trackID + "\");");
    circle.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"close panel\",80);");
    circle.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(circle);

  var line = document.createElementNS(svgNS,'path');
  line.setAttributeNS(null, 'd', 'M2 3 L7 8 M2 8 L7 3 ');
  line.setAttribute('stroke', "rgb(50,50,50)");
  line.setAttribute('stroke-width', '1.5px');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    line.setAttributeNS(null, "onclick", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'exp_panel_close');");
    //line.setAttributeNS(null, "onclick", "removeTrack(\"" + glyphTrack.trackID + "\");");
    line.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"close panel\",80);");
    line.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(line);
  return g1;
}


function gLyphsCreateExperimentExpressReattachWidget(glyphTrack) {
  var g1 = document.createElementNS(svgNS,'g');

  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '12px');
  rect.setAttributeNS(null, 'height', '12px');
  rect.setAttributeNS(null, 'style', 'fill: lightgray;  stroke: lightgray;');
  if(!glyphTrack.glyphsGB.exportSVGconfig && glyphTrack) {
    rect.setAttributeNS(null, "onclick", "gLyphsReattachExpGraph('"+glyphTrack.trackID+"');");
    rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"reattach panel\",80);");
    rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }

  var poly = document.createElementNS(svgNS,'polyline');
  poly.setAttributeNS(null, 'points', '10,0 12,2 5,9 5,12 0,12 0,7 3,7 10,0');
  //poly.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: goldenrod; fill:white;');
  poly.setAttributeNS(null, 'style', 'stroke-width: 1.5px; stroke: gray; fill:white;');
  if(!glyphTrack.glyphsGB.exportSVGconfig && glyphTrack) {
    poly.setAttributeNS(null, "onclick", "gLyphsReattachExpGraph('"+glyphTrack.trackID+"');");
    poly.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"reattach panel\",80);");
    poly.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  g1.appendChild(poly);

  return g1;
}


function gLyphsReattachExpGraph(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }

  //reset the global events back
  document.onmousemove = moveToMouseLoc;
  document.onmouseup = endDrag;

  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }
  expframe.removeAttribute("xpos");
  expframe.removeAttribute("ypos");
  glyphsExpPanelDraw(glyphTrack);
  return false;
}


function gLyphsExpPanelToggleDrag(trackID, mode, e) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(glyphTrack == null) { return; }

  if (!e) var e = window.event
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { 
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    document.onmouseup   = endDrag;
    return; 
  }
  if(!expframe.getAttribute("xpos")) { expframe.setAttribute("xpos", 0); }
    
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  
  if(!expframe.getAttribute("is_moving") || (mode =='start')) { 
    expframe.setAttribute("is_moving", 1);
    zenbuExpPanel_current_dragPanelTrack = glyphTrack;
    document.onmousemove = gLyphsExpPanelMoveEvent;
    
    var offset = xpos - expframe.getAttribute("xpos");
    if(offset<30)  { offset=30;}
    if(offset>900) { offset=900; }
    expframe.setAttribute("move_offset", offset);
    gLyphsExpPanelMoveEvent(e);    
  } else {
    //stop moving
    //reset the global events back
    zenbuExpPanel_current_dragPanelTrack = null;
    document.onmousemove = moveToMouseLoc;
    document.onmouseup = endDrag;
    
    if(ns4) toolTipSTYLE.visibility = "hidden";
    else toolTipSTYLE.display = "none";
    
    expframe.removeAttribute("is_moving");
    gLyphsExpressionPanelHeader(glyphTrack);  //shows the reattach widget
  }
}


function gLyphsExpPanelMoveEvent(e) {
  if(!zenbuExpPanel_current_dragPanelTrack) { return; }
  var expframe = zenbuExpPanel_current_dragPanelTrack.expPanelFrame();
  if(!expframe) { return; }
  
  if(!expframe.getAttribute("is_moving")) { return; }
  
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

  moveToMouseLoc(e);
  
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;
  
  var offset = expframe.getAttribute("move_offset");
  
  //
  // now move the experiment frame
  //
  var xpos = (toolTipSTYLE.xpos - offset);
  var ypos = toolTipSTYLE.ypos - 15;
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = zenbuExpPanel_current_dragPanelTrack.displayWidth(); }
  
  expframe.setAttribute('xpos', xpos);
  expframe.setAttribute('ypos', ypos);
  expframe.setAttribute('style', 
                        "width:"+frame_width+"px; z-index:50; padding: 2px 2px 2px 2px; position:absolute; "+
                        "background-color:rgb(245,245,250); "+
                        //"border:inset; border-width:2px; "+
                        "border:2px solid #808080; border-radius: 4px; "+
                        "left:"+ xpos +"px; top:"+ ypos +"px;");
}

//---- info panels section -----------------------------------------------------------

function gLyphsTrackExperimentInfo(trackID, expID) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }

  //change background highlight
  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(!experiment.back_rect) { continue; }
    //experiment.back_rect.setAttributeNS(null, 'visibility', "hidden");
    if(experiment.id == expID) {
      //experiment.back_rect.setAttributeNS(null, 'visibility', "visible");
      experiment.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
      //experiment.back_rect.setAttributeNS(null, 'fill', "pink");
    } else {
      experiment.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }

  //console.log("gLyphsTrackExperimentInfo t: " + trackID + "  e: "+expID);
  var experiment = glyphTrack.experiments[expID];
  gLyphsTrackHighlightExperiment(glyphTrack, experiment);
  if(!experiment) { return; }

  toolTipWidth=350;
  var tdiv, tspan, tinput, ta;
  var main_div = document.createElement('div');
  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "box-sizing: border-box; border: 1px solid #808080; border-radius: 4px; "+
                                 "background-color:#404040; color:#FDFDFD; "+
                                 "opacity:0.85;");

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = experiment.name;

  tdiv = main_div.appendChild(document.createElement('div'));
  if(experiment.platform) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = experiment.platform;
  }
  if(experiment.source_name) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = experiment.source_name;
  }
  if(experiment.category) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 3px 0px 0px;");
    tspan.innerHTML = experiment.category;
  }
  if(experiment.owner_identity) {
    //tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; padding: 0px 3px 0px 2px;");
    tspan.innerHTML = "created by: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:green;");
    tspan.innerHTML = experiment.owner_identity;
  }

  if(experiment.description && (experiment.description.length > 0)) {
    //main_div.appendChild(document.createElement('hr'));
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "max-width:450px");
    tdiv.innerHTML = experiment.description;
  }

  if(experiment.id) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "max-width:450px");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "sourceID: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:lightgray;");
    tspan.innerHTML = experiment.id;
  }

  if(experiment.demux_key) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "max-width:450px");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "demux_key: " + experiment.demux_key;
  }

  if(glyphTrack.strandless) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "signal : " + experiment.value + " " + experiment.exptype;
  } else {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "sense signal : " + experiment.sense_value + " " + experiment.exptype;
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "anti-sense signal : " + experiment.antisense_value + " " + experiment.exptype;
  }


  /*
  main_div.appendChild(document.createElement('hr'));
  for(var tag in source.mdata) { //new common mdata[].array system
    if(tag=="description") { continue; }
    if(tag=="eedb:description") { continue; }
    if(tag=="eedb:category") { continue; }
    if(tag=="display_name") { continue; }
    if(tag=="eedb:display_name") { continue; }
    if(tag=="eedb:owner_nickname") { continue; }
    if(tag=="eedb:owner_OpenID") { continue; }

    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold;");
    tspan.innerHTML = tag + ": ";
    var value_array = source.mdata[tag];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      if(idx1!=0) { 
        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.innerHTML = ", " 
      }

      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "color: rgb(105,105,105);");
      tspan.innerHTML = value;
    }
  }
  */

  //update the tooltip
  var tooltip = document.getElementById("toolTipLayer");
  tooltip.innerHTML = "";
  tooltip.appendChild(main_div);
  toolTipSTYLE.display='block';
}


function gLyphsTrackDisplaySourceInfo(trackID, sourceID) {
  //wrapper for 
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }

  var source = null;
  if(glyphTrack.experiments) { source = glyphTrack.experiments[sourceID]; }
  if(!source) { source = eedbGetObject(sourceID); }
  if(!source) { return false; }

  if(!source.full_load) { source.request_full_load = true; }
  eedbDisplaySourceInfo(source);
}


function gLyphsTrackMDGroupInfo(trackID, mdgroupIdx, fullmode) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  if(!glyphTrack.experiment_mdgrouping) { return; }

  //change background highlight
  for(var i=0; i<glyphTrack.experiment_mdgrouping.length; i++) {
    var mdgroup = glyphTrack.experiment_mdgrouping[i];
    if(!mdgroup.back_rect) { continue; }
    if(i == mdgroupIdx) {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    } else {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }

  var mdgroup = glyphTrack.experiment_mdgrouping[mdgroupIdx];
  if(!mdgroup) { return; }
  mdgroup.idx = mdgroupIdx;

  gLyphsTrackGroupInfo(glyphTrack, mdgroup, fullmode, "mdgroup");
}


function gLyphsTrackRankSumInfo(trackID, mdgroupIdx, fullmode) {
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  if(!glyphTrack.ranksum_mdgroups) { return; }

  //change background highlight
  for(var i=0; i<glyphTrack.ranksum_mdgroups.length; i++) {
    var mdgroup = glyphTrack.ranksum_mdgroups[i];
    if(!mdgroup.back_rect) { continue; }
    if(i == mdgroupIdx) {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(230, 230, 255)");
    } else {
      mdgroup.back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    }
  }

  var mdgroup = glyphTrack.ranksum_mdgroups[mdgroupIdx];
  if(!mdgroup) { return; }

  gLyphsTrackGroupInfo(glyphTrack, mdgroup, fullmode, "ranksum");
}


function gLyphsTrackGroupInfo(glyphTrack, mdgroup, fullmode, paneltype) {
  if(!glyphTrack) { return; }
  if(!mdgroup) { return; }
  var trackID = glyphTrack.trackID;
  //console.log("gLyphsTrackGroupInfo "+trackID);
  
  gLyphsTrackHighlightExperiment(glyphTrack, mdgroup);

  toolTipWidth=350;
  var tdiv, tspan, tinput, ta;
  var main_div = document.createElement('div');
  main_div.setAttribute('style', "text-align:left; font-size:8pt; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 //"background-color:rgb(230,230,240); border:inset; border-width:2px; opacity:0.95;"
                                 "box-sizing: border-box; border: 1px solid #808080; border-radius: 4px; "+
                                 "background-color:#404040; color:#FDFDFD; "+
                                 "opacity:0.85;"
                       );

  var titlebar_div = main_div.appendChild(document.createElement('div'));

  if(fullmode) {
    //titlebar area to capture move events
    titlebar_div.setAttribute("onmousedown", "eedbSourceInfoToggleDrag('start');");
    titlebar_div.setAttribute("onmouseup", "eedbSourceInfoToggleDrag('stop');");

    tdiv = titlebar_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");

    //group color
    if(paneltype=="mdgroup") { 
      tspan2 = tdiv.appendChild(document.createElement('span'));
      tspan2.setAttribute('style', "margin: 1px 4px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
      tspan2.innerHTML = "color:";
      var colorInput = tdiv.appendChild(document.createElement('input'));
      colorInput.setAttribute('style', "margin: 1px 8px 1px 0px;");
      colorInput.setAttribute('value', mdgroup.rgbcolor);
      colorInput.setAttribute('size', "7");
      colorInput.setAttribute("onchange", "reconfigTrackParam(\""+ trackID+"\", 'expMDGroupColor', this.value, "+mdgroup.idx+");");
      colorInput.color = new jscolor.color(colorInput);
      tdiv.appendChild(colorInput);
    }

    var a1 = tdiv.appendChild(document.createElement('a'));
    a1.setAttribute("target", "top");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "eedbSourceInfoEvent('close');return false");
    var img1 = a1.appendChild(document.createElement('img'));
    img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
    img1.setAttribute("width", "12");
    img1.setAttribute("height", "12");
    img1.setAttribute("alt","close");
  }

  //update the tooltip
  var tooltip = document.getElementById("toolTipLayer");
  tooltip.innerHTML = "";
  tooltip.appendChild(main_div);
  toolTipSTYLE.display='block';

  if(fullmode) {
    var info_div = document.getElementById("source_info");
    if(!info_div) { return; }
    
    current_source = mdgroup;
    var e = window.event
    toolTipWidth=450;
    moveToMouseLoc(e);
    var xpos = toolTipSTYLE.adjusted_xpos;
    var ypos = toolTipSTYLE.ypos;
    info_div.setAttribute('xpos', xpos);
    info_div.setAttribute('ypos', ypos);
  
    info_div.setAttribute('style', "text-align:left; font-size:8pt; font-family:arial,helvetica,sans-serif; "+
                                 "min-width:350px; z-index:60; padding: 3px 3px 3px 3px; "+
                                 "background-color:rgb(230,230,240); "+
                                 "box-sizing: border-box; border: 2px solid #808080; border-radius: 4px; "+
                                 "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

    info_div.innerHTML = "";
    main_div.setAttribute('style', "");
    info_div.appendChild(main_div);
  }

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:10pt; font-weight: bold;");
  if(paneltype=="mdgroup") { tspan.innerHTML = mdgroup.mdvalue; }
  if(paneltype=="ranksum") { tspan.innerHTML = mdgroup.name; }

  if(fullmode && (paneltype=="ranksum")) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 0px 4px;");

    ttable  = tdiv.appendChild(document.createElement('table'));
    ttable.setAttribute('cellspacing', "0");
    ttable.setAttribute('style', "font-size:10px;");

    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    ttd.innerHTML = "display: ";

    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_display");
    tradio.setAttribute('value', "");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'ranksum_display', this.value);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "experiments in group";
    if(!glyphTrack.groupinfo_ranksum_display) { tradio.setAttribute('checked', "checked"); }
    
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_display");
    tradio.setAttribute('value', "ranksum");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'ranksum_display', this.value);");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "ranksum";
    if(glyphTrack.groupinfo_ranksum_display) { tradio.setAttribute('checked', "checked"); }
  } 

  if(glyphTrack.strandless) {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(paneltype=="mdgroup") {
      tdiv.innerHTML = "signal : " + mdgroup.value.toFixed(3);
      tdiv.innerHTML += " +/- " + mdgroup.value_error.toFixed(3);
      tdiv.innerHTML += " " + glyphTrack.datatype;
    }
    if(paneltype=="ranksum") {
      tdiv.innerHTML = "z-score : " + mdgroup.value.toFixed(3);
    }
  } else {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(paneltype=="mdgroup") {
      tdiv.innerHTML = "sense signal : " + mdgroup.sense_value.toFixed(3);
      tdiv.innerHTML += " +/- " + mdgroup.sense_error.toFixed(3);
      tdiv.innerHTML += " " + glyphTrack.datatype;
    }
    if(paneltype=="ranksum") {
      tdiv.innerHTML = "sense z-score : " + mdgroup.sense_value.toFixed(3);
    }
    tdiv = main_div.appendChild(document.createElement('div'));
    if(paneltype=="mdgroup") {
      tdiv.innerHTML = "anti-sense signal : " + mdgroup.antisense_value.toFixed(3);
      tdiv.innerHTML += " +/- " + mdgroup.antisense_error.toFixed(3);
      tdiv.innerHTML += " " + glyphTrack.datatype;
    }
    if(paneltype=="ranksum") {
      tdiv.innerHTML = "anti-sense z-score : " + mdgroup.antisense_value.toFixed(3);
    }
  }

  if(fullmode && mdgroup.mdata_list) {
    var table = main_div.appendChild(document.createElement('table'));
    table.setAttribute('style', "font-size:8pt; padding: 0px 3px 0px 0px;");
    var tr = table.appendChild(document.createElement('tr'));
    tr.setAttribute('valign', "top");
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute('style', "font-size:8pt; font-weight:bold; padding: 0px 3px 0px 0px;");
    td.setAttribute('valign', "top");
    td.innerHTML = "mdata: ";
    td = tr.appendChild(document.createElement('td'));
    td.setAttribute('style', "font-size:8pt; padding: 0px 3px 0px 0px;");
    for(var j=0; j<mdgroup.mdata_list.length; j++) {
      var mdata = mdgroup.mdata_list[j];
      if(td.innerHTML != "") { td.innerHTML += "<br>"; }
      td.innerHTML += mdata.type + ":=" + mdata.value;
    }
  }

  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:8pt; padding: 0px 3px 0px 0px;");
  //tspan.innerHTML = mdgroup.source_count+" experiments";  
  if(mdgroup.source_count == mdgroup.source_ids.length) {
    tspan.innerHTML = mdgroup.source_count+" experiments";
  } else {
    tspan.innerHTML = mdgroup.source_count+"/"+(mdgroup.source_ids.length)+" experiments";
  }
   
  if(!fullmode) { return; }  

  var ranksum_div = main_div.appendChild(document.createElement('div'));
  ranksum_div.id = "panel_groupinfo_ranksum_div";
  ranksum_div.style.display = "none";

  //glyphTrack.glyphsGB.exppanel_active_on_top = glyphTrack.active_on_top;
  //glyphTrack.glyphsGB.express_sort_mode = glyphTrack.express_sort_mode;

  if(paneltype=="ranksum") {
    var src_hash = new Object;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      src_hash[srcid] = true;
    }

    var sense_max = 0.0;
    var antisense_max = 0.0;
    var exp_array = new Array;
    for(var i=0; i<glyphTrack.experiment_array.length; i++) {
      var experiment = glyphTrack.experiment_array[i];
      //if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
      if(experiment.hide) { continue; }
      exp_array.push(experiment);
      //calculate the max
      var value           = experiment.value;
      var sense_value     = experiment.sense_value;
      var antisense_value = experiment.antisense_value;

      if(glyphTrack.strandless) {
        if(value > sense_max) { sense_max = value; }
      } else {
        if(sense_value > sense_max)     { sense_max = sense_value; }
        if(antisense_value > antisense_max) { antisense_max = antisense_value; }
      }
    }

    //sense first
    //var old_sortmode = glyphTrack.glyphsGB.express_sort_mode;
    //glyphTrack.glyphsGB.express_sort_mode = "value_plus";
    //exp_array.sort(gLyphs_express_sort_func);
    gLyphsTrack_sort_experiment_expression(glyphTrack, exp_array, "value_plus");

    var sigwidth = 1;
    sigwidth = Math.floor(400.0 / exp_array.length);
    if(sigwidth < 1) { sigwidth = 1; }
    if(sigwidth >10) { sigwidth = 10; }
    //if(exp_array.length<150) { sigwidth = 3; }
    //if(exp_array.length<75) { sigwidth = 5; }

    tdiv = ranksum_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "padding: 0px 7px 3px 7px;");
    var svg = createSVG(exp_array.length*sigwidth, 120);
    tdiv.appendChild(svg);

    for(var j=0; j<exp_array.length; j++) {
      var experiment = exp_array[j];
      var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
      var sigheight = 1;
      if(sense_max>0) { sigheight = 100.0 * experiment.sense_value / sense_max; }
      if(sigheight < 1.0) { sigheight = 1.0; }
      rect.setAttributeNS(null, 'x', (j*sigwidth+1) +'px');
      //rect.setAttributeNS(null, 'y', 100 - 100.0 * experiment.sense_value / sense_max);
      rect.setAttributeNS(null, 'y', 100 - sigheight);
      rect.setAttributeNS(null, 'width', sigwidth + 'px');
      //rect.setAttributeNS(null, 'height', 100.0 * experiment.sense_value / sense_max);
      rect.setAttributeNS(null, 'height', sigheight);

      if(src_hash[experiment.id]) { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); } 
      else { rect.setAttributeNS(null, 'fill', "lightgray"); }
    } 
    //then antisense display
    if(!glyphTrack.strandless) {
      //glyphTrack.glyphsGB.express_sort_mode = "value_minus";
      //exp_array.sort(gLyphs_express_sort_func);
      gLyphsTrack_sort_experiment_expression(glyphTrack, exp_array, "value_minus");

      tdiv = ranksum_div.appendChild(document.createElement('div'));
      tdiv.setAttribute('style', "padding: 0px 7px 3px 7px;");
      var svg = createSVG(exp_array.length*sigwidth, 120);
      tdiv.appendChild(svg);
      for(var j=0; j<exp_array.length; j++) {
        var experiment = exp_array[j];
        var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        var sigheight = 1;
        if(antisense_max>0) { sigheight = 100.0 * experiment.antisense_value / antisense_max; }
        if(sigheight < 1.0) { sigheight = 1.0; }
        rect.setAttributeNS(null, 'x', (j*sigwidth+1) +'px');
        //rect.setAttributeNS(null, 'y', 100 - 100.0 * experiment.antisense_value / antisense_max);
        rect.setAttributeNS(null, 'y', 100 - sigheight);
        rect.setAttributeNS(null, 'width', sigwidth + 'px');
        //rect.setAttributeNS(null, 'height', 100.0 * experiment.antisense_value / antisense_max);
        rect.setAttributeNS(null, 'height', sigheight);

        if(src_hash[experiment.id]) { rect.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); } 
        else { rect.setAttributeNS(null, 'fill', "lightgray"); }
      } 
    }

    //reset the sort_order mode 
    //glyphTrack.glyphsGB.express_sort_mode = old_sortmode;
  } 

  //always make the experiment list view
    var exp_div = main_div.appendChild(document.createElement('div'));
    exp_div.id = "panel_groupinfo_exp_div";
    exp_div.style.display = "block";
    
    //show all experiments in the group
    var exp_array = new Array;
    var max_value=0;
    var max_text=0;
    for(var j=0; j<mdgroup.source_ids.length; j++) {
      var srcid = mdgroup.source_ids[j];
      var experiment = glyphTrack.experiments[srcid];
      if(!experiment) { continue; }
      //if(glyphTrack && glyphTrack.hidezeroexps && (experiment.value==0)) { continue; }
      //if(experiment.hide) { continue; }
      if(glyphTrack.hide_deactive_exps && experiment.hide) { continue; }
      if(glyphTrack.hide_zero && (experiment.value==0)) { continue; }
      
      gLyphsExperimentName(glyphTrack, experiment); //make the dynamic name 
      exp_array.push(experiment);

      if(glyphTrack.strandless) {
        if(experiment.value > max_value) { max_value = experiment.value; }
      } else {
        if(experiment.sense_value > max_value)     { max_value = experiment.sense_value; }
        if(experiment.antisense_value > max_value) { max_value = experiment.antisense_value; }
      }
      if(experiment.expname.length > max_text) { max_text = experiment.expname.length; }
    }
    if(max_value==0) { max_value=1; } //avoid div-by-zero
    //exp_array.sort(gLyphs_express_sort_func);
    gLyphsTrack_sort_experiment_expression(glyphTrack, exp_array, glyphTrack.express_sort_mode);

    tdiv = exp_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "padding: 0px 7px 3px 7px;");
    var svg = createSVG((max_text*8)+120, 12*exp_array.length);
    tdiv.appendChild(svg);

    max_text=0;
    for(var j=0; j<exp_array.length; j++) {
      var experiment = exp_array[j];

      var back_rect = document.createElementNS(svgNS,'rect');
      back_rect.setAttributeNS(null, 'x', '0px');
      back_rect.setAttributeNS(null, 'y', ((j*12)) +'px');
      back_rect.setAttributeNS(null, 'width', "100%");
      back_rect.setAttributeNS(null, 'height', '12px');
      back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        back_rect.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      experiment.back_rect = back_rect;
      svg.appendChild(back_rect);

      var text = document.createElementNS(svgNS,'text');
      text.setAttributeNS(null, 'x', '7px');
      text.setAttributeNS(null, 'y', (j*12+9) +'px');
      text.setAttributeNS(null, 'style', 'font-size:8pt; font-family:arial,helvetica,sans-serif; fill:black;');
      //if(experiment.hide) { text.style.fill = "rgb(192, 192, 192);" }
      if(experiment.hide) { text.setAttributeNS(null, 'style', 'font-size:8pt; font-family:arial,helvetica,sans-serif; fill: rgb(192, 192, 192);'); }
      else { text.setAttributeNS(null, 'style', 'font-size:8pt; font-family:arial,helvetica,sans-serif; fill: black;'); }
      text.appendChild(document.createTextNode(experiment.expname));
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
        text.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
        text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      svg.appendChild(text);
      var bbox = text.getBBox();
      if(bbox.width > max_text) { max_text = bbox.width; }
    }
    svg.setAttributeNS(null, 'width', (max_text+120)+'px');

    for(var j=0; j<exp_array.length; j++) {
      var experiment = exp_array[j];
      if(glyphTrack.strandless) {
        var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        rect.setAttributeNS(null, 'x', (max_text+10) +'px');
        rect.setAttributeNS(null, 'y', (j*12+1) +'px');
        rect.setAttributeNS(null, 'width', 100.0 * experiment.value / max_value);
        rect.setAttributeNS(null, 'height', '10px');
        if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
        else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
        if(experiment.hide) { rect.setAttribute('style', "opacity:0.2"); }

        if(!glyphTrack.glyphsGB.exportSVGconfig) {
          rect.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
          rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
          rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
      } else {
        var rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        rect.setAttributeNS(null, 'x', (max_text+10) +'px');
        rect.setAttributeNS(null, 'y', (j*12+1) +'px');
        rect.setAttributeNS(null, 'width', 100.0 * experiment.sense_value / max_value);
        rect.setAttributeNS(null, 'height', '5px');
        if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
        else { rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor); }
        if(experiment.hide) { rect.setAttribute('style', "opacity:0.2"); }

        if(!glyphTrack.glyphsGB.exportSVGconfig) {
          rect.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
          rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
          rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }

        rect = svg.appendChild(document.createElementNS(svgNS,'rect'));
        rect.setAttributeNS(null, 'x', (max_text+10) +'px');
        rect.setAttributeNS(null, 'y', (j*12 +6) +'px');
        rect.setAttributeNS(null, 'width', 100.0 * experiment.antisense_value / max_value);
        rect.setAttributeNS(null, 'height', '5px');
        if(glyphTrack.exppanel_use_rgbcolor) { rect.setAttributeNS(null, 'fill', experiment.rgbcolor); }
        else { rect.setAttributeNS(null, 'fill', glyphTrack.revStrandColor); }
        if(experiment.hide) { rect.setAttribute('style', "opacity:0.2"); }

        if(!glyphTrack.glyphsGB.exportSVGconfig) {
          rect.setAttributeNS(null, "onclick", "gLyphsTrackDisplaySourceInfo(\""+ glyphTrack.trackID+ "\", \"" +experiment.id+ "\");");
          rect.setAttributeNS(null, "onmouseover", "gLyphsTrackExperimentInfo(\""+ glyphTrack.trackID+ "\", \"" + experiment.id+"\");");
          rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
        }
      }
    }
  

  if(paneltype=="ranksum" && glyphTrack.groupinfo_ranksum_display) { 
    exp_div.style.display = "none";
    ranksum_div.style.display = "block";
  } else { 
    exp_div.style.display = "block"; 
    ranksum_div.style.display = "none"; 
  }
}


//----- subpanel tools ---------------------------------------------------------------------

function gLyphsToggleExpressionSubpanel(trackID, mode) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }
  if(!glyphTrack.expPanelFrame()) { return false; }

  var filterdiv   = glyphTrack.expPanelFrame().filter_subpanel;  
  var groupingdiv = glyphTrack.expPanelFrame().grouping_subpanel;
  var configdiv   = glyphTrack.expPanelFrame().config_subpanel
  var exportdiv   = glyphTrack.expPanelFrame().export_subpanel;
  
  if(mode == glyphTrack.expression_subpanel_mode) { mode = "none"; }
  if(!mode) { mode = glyphTrack.expression_subpanel_mode; } //refresh
  glyphTrack.expression_subpanel_mode = mode;  

  if(filterdiv) { filterdiv.style.display   = "none"; }
  if(groupingdiv) { groupingdiv.style.display = "none"; }
  if(configdiv) { configdiv.style.display   = "none"; }
  if(exportdiv) { exportdiv.style.display = "none"; }
  
  if(mode == "filter")  { 
    filterdiv = gLyphsExpressionPanelFilterSubpanel(glyphTrack);
    if(filterdiv) { filterdiv.style.display = "block"; }
  }
  if(mode == "group") { 
    groupingdiv = gLyphsExpressionPanelGroupingSubpanel(glyphTrack);
    if(groupingdiv) { groupingdiv.style.display = "block"; }
  } 
  if(mode == "config")  { 
    configdiv = gLyphsExpressionPanelConfigSubpanel(glyphTrack);
    if(configdiv) { configdiv.style.display = "block"; }
  }
  if(mode == "export") { 
    exportdiv = gLyphsExpressionPanelExportSubpanel(glyphTrack);
    if(exportdiv) { exportdiv.style.display = "block"; }
  }
  
  if(glyphTrack.expPanelFrame().auxdiv) { 
    //scroll page if need to show full panel
    var doc_bottom = document.documentElement.clientHeight + window.scrollY; //visible bottom of page
    var panelRect = glyphTrack.expPanelFrame().auxdiv.getBoundingClientRect();  
    if(panelRect.bottom+window.scrollY >= doc_bottom) {
      var new_scroll = window.scrollY + 5 +(panelRect.bottom+window.scrollY - doc_bottom);
      //window.scrollTo(0, new_scroll);
    }
  }
}

//----- express panel filter tools ---------------------------------------------------------------------

function gLyphsCreateExperimentExpressFilterWidget(glyphTrack) {
  var g1 = document.createElementNS(svgNS,'g');

  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'filter');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"filter experiments\",90);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '25px');
  rect.setAttributeNS(null, 'height', '11px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  
  var txt1 = g1.appendChild(document.createElementNS(svgNS,'text'));
  txt1.setAttributeNS(null, 'x', '3px');
  txt1.setAttributeNS(null, 'y', '9px');
  txt1.setAttributeNS(null, "font-size","10px");
  txt1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  txt1.setAttributeNS(null, "font-weight", 'bold');
  txt1.setAttributeNS(null, 'style', 'fill: gray;');
  txt1.appendChild(document.createTextNode("FLT"));
  return g1;
}


function gLyphsExpressionPanelFilterSubpanel(glyphTrack) {
  if(!glyphTrack) { return; }
  
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
    
  var auxdiv = glyphTrack.expPanelFrame().auxdiv;
  if(!auxdiv) { return; }
  
  var filterdiv = glyphTrack.expPanelFrame().filterdiv;
  if(!filterdiv) { 
    filterdiv = document.createElement('div');
    auxdiv.insertBefore(filterdiv, auxdiv.firstChild);
    filterdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:330px; display:none; opacity:0.95; " +
                           "position:absolute; top:20px; right:10px;"
                           );      
    glyphTrack.expPanelFrame().filter_subpanel = filterdiv;
  }
  clearKids(filterdiv);
  
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button;
  var trackID = glyphTrack.trackID;

  //close button
  tdiv = filterdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = filterdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "experiment filters";
      
  var form1 = filterdiv.appendChild(document.createElement('form'));
  form1.setAttribute("onsubmit", "gLyphsApplyExpExpressFilterSearch('"+glyphTrack.trackID+"'); return false;");
  tdiv = form1.appendChild(document.createElement('div'));
  var expInput = tdiv.appendChild(document.createElement('input'));
  expInput.setAttribute('style', "width:200px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  expInput.id = "expExp_filter_search_inputID";
  glyphTrack.expPanelFrame().filter_input = expInput;
  expInput.setAttribute('type', "text");
  if(glyphTrack && glyphTrack.expfilter) {
    expInput.setAttribute('value', glyphTrack.expfilter);
  }
  
  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiments and filter\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "gLyphsApplyExpExpressFilterSearch('"+glyphTrack.trackID+"'); return false;");
  button.innerHTML = "filter";

  button = tdiv.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"clear filters\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "gLyphsClearExpExpressFilterSearch('"+glyphTrack.trackID+"');");
  button.innerHTML = "clear";
  
  tdiv = filterdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "font-size:10px; margin-left:5px;");
  glyphTrack.expPanelFrame().filter_panel_msg = tdiv;

  //code to include complex filters for finding matching controls
  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(glyphTrack && glyphTrack.exp_filter_incl_matching) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'include_matching',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "include matching/control experiments";

  if(glyphTrack && glyphTrack.exp_filter_incl_matching) {
    tdiv2  = filterdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute("style", "margin-left:25px; margin-bottom: 2px;");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "match by mdata-key : ";
    tinput = tdiv2.appendChild(document.createElement('input'));
    //tinput.setAttribute("style", "margin-left: 5px;");
    tinput.setAttribute('style', "width:100px; margin-left: 5pxx; font-size:10px; font-family:arial,helvetica,sans-serif;");
    tinput.setAttribute('type', "text");
    tinput.setAttribute('onchange', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'include_matching_mdkey',this.value)");
    if(glyphTrack.exp_matching_mdkey) { tinput.setAttribute('value', glyphTrack.exp_matching_mdkey); }

    tdiv2  = filterdiv.appendChild(document.createElement('div'));
    tdiv2.setAttribute("style", "margin-left:25px; ");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "match group post-filter : ";
    tinput = tdiv2.appendChild(document.createElement('input'));
    //tinput.setAttribute("style", "margin-left: 5px;");
    tinput.setAttribute('style', "width:100px; margin-left: 5pxx; font-size:10px; font-family:arial,helvetica,sans-serif;");
    tinput.setAttribute('type', "text");
    tinput.setAttribute('onchange', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'include_matching_post_filter',this.value)");
    if(glyphTrack.exp_matching_post_filter) { tinput.setAttribute('value', glyphTrack.exp_matching_post_filter); }
  }

  filterdiv.appendChild(document.createElement('hr'));

  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.id = "gLyphHideExpsCheckbox";
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(glyphTrack.hide_deactive_exps) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'hide_deactive',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide deactivated experiments";

  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(glyphTrack.active_on_top) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'active_on_top',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "keep active experiments on top";
    
  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  tinput = tdiv2.appendChild(document.createElement('input'));
  tinput.setAttribute('type', "checkbox");
  tinput.setAttribute("style", "margin-left: 5px;");
  if(glyphTrack.hide_zero) { tinput.setAttribute('checked', "checked"); }
  tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'hide_zero_experiments',this.checked)");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "hide experiments with zero signal";
  
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:25px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"invert the filtering\",100);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.setAttribute("onclick", "gLyphsInvertExperimentSelection('"+glyphTrack.trackID+"');");
  button.innerHTML = "invert selection";
    
  filterdiv.appendChild(document.createElement('hr'));

  tdiv2  = filterdiv.appendChild(document.createElement('div'));
  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin:0px 0px 5px 50px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute('onclick', "gLyphsTrack_reconfig_with_visible_experiments('"+glyphTrack.trackID+"')");
  button.innerHTML = "reconfigure with active experiments";
  
  //tdiv2  = filterdiv.appendChild(document.createElement('div'));
  //button = tdiv2.appendChild(document.createElement("button"));
  //button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:65px; margin-top:3px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.setAttribute('onclick', "glyphs_reconfig_experiments('"+trackID+"', 'deactivate-zeroexps')");
  //button.innerHTML = "deactivate empty experiments";

  return filterdiv;
}

//----- grouping subpanel ---------------------------------------------------------------------

function gLyphsCreateExperimentExpressGroupingWidget(glyphTrack) {
  var g1 = document.createElementNS(svgNS,'g');
  
  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'group');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"experiment grouping<br>and enrichment\",130);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '33px');
  rect.setAttributeNS(null, 'height', '11px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  
  var txt1 = g1.appendChild(document.createElementNS(svgNS,'text'));
  txt1.setAttributeNS(null, 'x', '3px');
  txt1.setAttributeNS(null, 'y', '9px');
  txt1.setAttributeNS(null, "font-size","10px");
  txt1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  txt1.setAttributeNS(null, "font-weight", 'bold');
  txt1.setAttributeNS(null, 'style', 'fill: gray;');
  txt1.appendChild(document.createTextNode("STAT"));
  return g1;
}


function gLyphsExpressionPanelGroupingSubpanel(glyphTrack) {
  if(!glyphTrack) { return; }
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
    
  var auxdiv = glyphTrack.expPanelFrame().auxdiv;
  if(!auxdiv) { return; }
  
  var groupingdiv = glyphTrack.expPanelFrame().grouping_subpanel;
  if(!groupingdiv) { 
    groupingdiv = document.createElement('div');
    auxdiv.insertBefore(groupingdiv, auxdiv.firstChild);
    groupingdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:330px; display:none; opacity:0.95; " +
                           "position:absolute; top:20px; right:10px;"
                           );      
    glyphTrack.expPanelFrame().grouping_subpanel = groupingdiv;
  }
  clearKids(groupingdiv);
  
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button;
  var trackID = glyphTrack.trackID;
  
  //close button
  tdiv = groupingdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = groupingdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "experiment grouping and enrichment";
  
  groupingdiv.appendChild(document.createElement('hr'));

  var select = groupingdiv.appendChild(document.createElement('select'));    
  select.setAttribute('style', "width:250px; margin-left:25px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  select.setAttributeNS(null, "onchange", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'exppanelmode', this.value);");
  var gcats = new Object;
  gcats['experiments'] = "no grouping";
  gcats['mdgroup'] = "metadata key grouping";
  gcats['ranksum'] = "rank-sum enrichment";
  for(var groupmode in gcats){
    var gcat_desc = gcats[groupmode];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", groupmode);
    if(glyphTrack && glyphTrack.exppanelmode == groupmode) { option.setAttribute("selected", "selected"); }
    option.innerHTML = gcat_desc;
  }
  
  if(!glyphTrack) { return; }

  if(glyphTrack.exppanelmode == "mdgroup") {
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:12px;");
    tdiv.innerHTML = "group by metadata key";
    
    var form1 = groupingdiv.appendChild(document.createElement('form'));
    form1.setAttribute("onsubmit", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'mdgroup_input'); return false;");
    tdiv = form1.appendChild(document.createElement('div'));
    var expInput = tdiv.appendChild(document.createElement('input'));
    expInput.setAttribute('style', "width:200px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    expInput.id = "expExp_mdgroup_inputID";  //id allows for autocomplete history 
    glyphTrack.expPanelFrame().mdgroup_input = expInput;
    expInput.setAttribute('type', "text");
    if(glyphTrack && glyphTrack.mdgroupkey) {
      expInput.setAttribute('value', glyphTrack.mdgroupkey);
    }
    
    button = tdiv.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiment metadata and group\",100);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    button.innerHTML = "group";
    
    /*
    button = tdiv.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onmouseover", "eedbMessageTooltip(\"clear filters\",100);");
    button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //button.setAttribute("onclick", "gLyphsClearExpExpressFilterSearch('"+glyphTrack.trackID+"');");
    button.innerHTML = "clear";
    */    

    ttable  = tdiv.appendChild(document.createElement('table'));
    ttable.setAttribute('cellspacing', "0");
    ttable.setAttribute('style', "font-size:10px;");

    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    ttd.innerHTML = "error bars: ";

    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "errorbar_type");
    tradio.setAttribute('value', "stddev");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'errorbar_type', this.value);");
    if(glyphTrack.errorbar_type == "stddev") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "sample standard deviation";
    
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "errorbar_type");
    tradio.setAttribute('value', "stderror");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'errorbar_type', this.value);");
    if(glyphTrack.errorbar_type == "stderror") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "standard error";
  }
  
  if(glyphTrack.exppanelmode == "ranksum") {
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px;");
    tdiv.innerHTML = "wilcoxon-mann-whitney rank-sum enrichment algorithm.<br>displays z-score returned by test.<br>for experiments with lots of metadata and tracks with many experiments, this statistical calculation can take over 30seconds to perform.";
        
    tdiv2  = groupingdiv.appendChild(document.createElement('div'));
    tinput = tdiv2.appendChild(document.createElement('input'));
    tinput.setAttribute('type', "checkbox");
    tinput.setAttribute("style", "margin-left: 5px;");
    if(glyphTrack.hide_deactive_exps) { tinput.setAttribute('checked', "checked"); }
    tinput.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'hide_deactive',this.checked)");
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "hide deactivated metadata";

    groupingdiv.appendChild(document.createElement('hr'));

    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "font-size:10px;");
    tdiv.innerHTML = "limit search to specified metadata keys (space separated list)";
    
    var form1 = groupingdiv.appendChild(document.createElement('form'));
    form1.setAttribute("onsubmit", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'ranksum_mdkeys'); return false;");
    tdiv = form1.appendChild(document.createElement('div'));
    var expInput = tdiv.appendChild(document.createElement('input'));
    expInput.setAttribute('style', "width:180px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    expInput.id = "exppanel_ranksum_mdkey_focus_inputID";
    glyphTrack.expPanelFrame().ranksum_mdkey_input = expInput;
    expInput.setAttribute('type', "text");
    if(glyphTrack && glyphTrack.ranksum_mdkeys) {
      expInput.setAttribute('value', glyphTrack.ranksum_mdkeys);
    }
    
    //button = tdiv.appendChild(document.createElement("button"));
    //button.setAttribute("style", "font-size:10px; padding: 1px 2px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    //button.setAttribute("onmouseover", "eedbMessageTooltip(\"search experiment metadata and group\",100);");
    //button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
    //button.innerHTML = "apply";
    
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "margin-top:3px;");
    var form1 = tdiv.appendChild(document.createElement('form'));
    form1.setAttribute("onsubmit", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'ranksum_min_zscore'); return false;");
    tspan = form1.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:10px;");
    tspan.innerHTML = "min z-score: ";
    var expInput = form1.appendChild(document.createElement('input'));
    expInput.setAttribute('style', "width:30px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    glyphTrack.expPanelFrame().ranksum_min_zscore_input = expInput;
    expInput.setAttribute('type', "text");
    if(glyphTrack && glyphTrack.ranksum_min_zscore) {
      expInput.setAttribute('value', glyphTrack.ranksum_min_zscore);
    }
        
    
    /*
    ttable  = groupingdiv.appendChild(document.createElement('table'));
    ttable.setAttribute('cellspacing', "0");
    ttable.setAttribute('style', "font-size:10px;");

    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_algo");
    tradio.setAttribute('value', "wilcoxon");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'ranksum_algo', this.value);");
    if(glyphTrack.ranksum_algo == "wilcoxon") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "Wilcoxon signed rank test";
    
    ttr  = ttable.appendChild(document.createElement('tr'));
    ttd  = ttr.appendChild(document.createElement('td'));
    tdiv2  = ttd.appendChild(document.createElement('div'));
    tradio = tdiv2.appendChild(document.createElement('input'));
    tradio.setAttribute('type', "radio");
    tradio.setAttribute('name', "ranksum_algo");
    tradio.setAttribute('value', "mannwhitney");
    tradio.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'ranksum_algo', this.value);");
    if(glyphTrack.ranksum_algo == "mannwhitney") {
      tradio.setAttribute('checked', "checked"); 
    }
    tspan2 = tdiv2.appendChild(document.createElement('span'));
    tspan2.innerHTML = "Mann-Whitney U-test";
     */
    
    tdiv = groupingdiv.appendChild(document.createElement('div'));
    tdiv.id = "express_panel_ranksum_msg";
    tdiv.setAttribute("style", "font-size:10px; margin-left:5px;");    
  }
  
  return groupingdiv;
}


//----- rank-sum enrichment calc and render ---------------------------------------------------------------------


function gLyphsExpressionPanelRankSumRender(glyphTrack) { 
  //will render into SVG the data that was precalculated 
  var g1 = document.createElementNS(svgNS,'g');
  g1.id = "exp_panel_ranksum_svg_g1";
  g1.setAttributeNS(null, "font-size","8pt");
  g1.setAttributeNS(null, "font-family", 'arial,helvetica,sans-serif');
  
  if(!glyphTrack) { return g1; }

  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return g1; }
  
  var frame_width = Math.round(expframe.style.width);
  if(!frame_width) { frame_width = glyphTrack.displayWidth(); }
  var graph_width  = frame_width - 20;
  
  if(!glyphTrack.experiment_ranksum_enrichment) {
    gLyphsTrackCalcRankSumEnrichment(glyphTrack.trackID);  //async
  }
  
  if(glyphTrack.experiment_ranksum_enrichment.length == 0) { 
    return g1;
  }  

  //update the experiment_ranksum_enrichment with current experiment_array values
  var ranksum_mdgroups = new Array;
  var max_value = 0.0;
  for(var i=0; i<glyphTrack.experiment_ranksum_enrichment.length; i++) {
    var mdgroup = glyphTrack.experiment_ranksum_enrichment[i];    
    if(glyphTrack.hide_deactive_exps && mdgroup.hide) { continue; }
    
    //calc max
    if(glyphTrack.strandless) {
      if(Math.abs(mdgroup.value) < glyphTrack.ranksum_min_zscore) { continue; }
      if(Math.abs(mdgroup.value)+mdgroup.value_error > max_value) { max_value = Math.abs(mdgroup.value)+mdgroup.value_error; }
    } else {
      if((Math.abs(mdgroup.sense_value) < glyphTrack.ranksum_min_zscore) &&
         (Math.abs(mdgroup.antisense_value) < glyphTrack.ranksum_min_zscore)) { continue; }
      if(Math.abs(mdgroup.sense_value)+mdgroup.sense_error > max_value)     { max_value = Math.abs(mdgroup.sense_value)+mdgroup.sense_error; }
      if(Math.abs(mdgroup.antisense_value)+mdgroup.antisense_error > max_value) { max_value = Math.abs(mdgroup.antisense_value)+mdgroup.antisense_error; }
    }
    ranksum_mdgroups.push(mdgroup);
  }
  //glyphTrack.glyphsGB.express_sort_mode = glyphTrack.express_sort_mode;
  //ranksum_mdgroups.sort(gLyphs_exppanel_mdgroup_sort_func);
  gLyphsTrack_sort_experiment_expression(glyphTrack, ranksum_mdgroups, glyphTrack.express_sort_mode);

  glyphTrack.ranksum_mdgroups = ranksum_mdgroups; 
  clearKids(g1);
  
  g1.setAttribute('ranksum_graph_height', 12 * ranksum_mdgroups.length);

  //draw names
  var g2 = g1.appendChild(document.createElementNS(svgNS,'g'));
  for(var i=0; i<ranksum_mdgroups.length; i++) {
    var mdgroup = ranksum_mdgroups[i];
    
    //make background box
    var back_rect = document.createElementNS(svgNS,'rect');
    back_rect.setAttributeNS(null, 'x', '0px');
    back_rect.setAttributeNS(null, 'y', ((i*12)) +'px');
    back_rect.setAttributeNS(null, 'width', "100%");
    back_rect.setAttributeNS(null, 'height', '12px');
    back_rect.setAttributeNS(null, 'fill', "rgb(245,245,250)");
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      back_rect.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
      back_rect.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
      back_rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }
    mdgroup.back_rect = back_rect;
    g2.appendChild(back_rect);

    var hideGlyph = gLyphsExpPanelHideMetadataWidget(glyphTrack, mdgroup);
    if(hideGlyph) { 
      hideGlyph.setAttribute('transform', "translate(0,"+ ((i*12)) +")");
      g2.appendChild(hideGlyph); 
    }
          
    //if(!mdgroup.mdvalue) { mdgroup.mdvalue = "hmm problem..."; }
    var name = mdgroup.name;
    name += " ("+mdgroup.group_count+" exps)";
    
    var text = document.createElementNS(svgNS,'text');
    text.setAttributeNS(null, 'x', '10px');
    text.setAttributeNS(null, 'y', ((i*12)+9) +'px');
    text.setAttributeNS(null, 'style', 'fill: black;');
    if(!glyphTrack.glyphsGB.exportSVGconfig) {
      text.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
      text.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
      text.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
    }

    if(mdgroup.hide) { text.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
    else { text.setAttributeNS(null, 'style', 'fill: black;'); }

    text.appendChild(document.createTextNode(name));
    g2.appendChild(text);
  }
  
  var g3 = g1.appendChild(document.createElementNS(svgNS,'g')); //parent for expression levels
  
  var g5a = g3.appendChild(document.createElementNS(svgNS,'g')); //bars -
  var g5b = g3.appendChild(document.createElementNS(svgNS,'g')); //bars +
  
  var g4a = g3.appendChild(document.createElementNS(svgNS,'g')); //text -
  var g4b = g3.appendChild(document.createElementNS(svgNS,'g')); //text +
  
  //setup the inverse colors
  var posInvColor = glyphTrack.posTextColor;
  var revInvColor = glyphTrack.revTextColor;

  var scale = 0;
  if(max_value>0) { scale = 225.0 / max_value; }
  for(var i=0; i<ranksum_mdgroups.length; i++) {
    var mdgroup = ranksum_mdgroups[i];
    
    var value           = Math.abs(mdgroup.value);
    var sense_value     = Math.abs(mdgroup.sense_value);
    var antisense_value = Math.abs(mdgroup.antisense_value);

    if(glyphTrack.strandless) {
      //strandless
      var rect = document.createElementNS(svgNS,'rect');
      rect.setAttributeNS(null, 'x', (graph_width-470)+'px');
      rect.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect.setAttributeNS(null, 'width', 2*scale*value);
      rect.setAttributeNS(null, 'height', '11px');
      rect.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect);
      
      if(mdgroup.value_error>0) {
        var error_width = mdgroup.value_error * 2*scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-470+(2*scale*value))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        g5b.appendChild(error1);
      }      
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-460)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.setAttributeNS(null, 'style', 'fill:' + glyphTrack.posTextColor); 
      text1.appendChild(document.createTextNode(Math.round(mdgroup.value*1000.0)/1000.0));
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      if(mdgroup.hide) { 
        rect.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    } else {
      var rect1 = document.createElementNS(svgNS,'rect');
      rect1.setAttributeNS(null, 'x', (graph_width-240)+'px');
      rect1.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect1.setAttributeNS(null, 'width', sense_value * scale);
      rect1.setAttributeNS(null, 'height', '11px');
      rect1.setAttributeNS(null, 'fill', glyphTrack.posStrandColor);
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5b.appendChild(rect1);
      
      if(mdgroup.sense_error>0) {
        var error_width = mdgroup.sense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240+(sense_value * scale))+" "+((i*12)+5.5)+
                            " h"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        g5b.appendChild(error1);
      }      
      
      var width2 = antisense_value * scale;
      var rect2 = document.createElementNS(svgNS,'rect');
      rect2.setAttributeNS(null, 'x', (graph_width-240-width2)+'px');
      rect2.setAttributeNS(null, 'y', ((i*12)) +'px');
      rect2.setAttributeNS(null, 'width', width2);
      rect2.setAttributeNS(null, 'height', '11px');
      rect2.setAttributeNS(null, 'fill', glyphTrack.revStrandColor);
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        rect2.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        rect2.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        rect2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g5a.appendChild(rect2);
      
      if(mdgroup.antisense_error>0) {
        var error_width = mdgroup.antisense_error * scale;
        if(error_width<1.5) { error_width = 1.5; }
        var error1 = document.createElementNS(svgNS,'path');
        error1.setAttribute('d', "M"+(graph_width-240-width2)+" "+((i*12)+5.5)+
                            " h-"+ error_width+
                            " m0 -4.5 v9"
                            );
        //error1.setAttribute('stroke', glyphTrack.posStrandColor);
        error1.setAttribute('stroke', "red");
        error1.setAttribute('stroke-width', '1px');
        g5b.appendChild(error1);
      }      
      
      var text1 = document.createElementNS(svgNS,'text');
      text1.setAttributeNS(null, 'x', (graph_width-235)+'px');
      text1.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text1.appendChild(document.createTextNode(Math.round(mdgroup.sense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text1.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text1.setAttributeNS(null, 'style', 'fill: black;'); }
      //text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posTextColor); 
      text1.setAttributeNS(null, 'style', 'fill:'+posInvColor); 
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text1.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text1.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4b.appendChild(text1);
      
      var text2 = document.createElementNS(svgNS,'text');
      text2.setAttributeNS(null, 'x', (graph_width-245)+'px');
      text2.setAttributeNS(null, 'y', ((i*12)+9) +'px');
      text2.setAttributeNS(null, 'text-anchor', "end");
      text2.appendChild(document.createTextNode(Math.round(mdgroup.antisense_value*1000.0)/1000.0));
      //if(mdgroup.hide) { text2.setAttributeNS(null, 'style', 'fill: rgb(192, 192, 192);'); }
      //else { text2.setAttributeNS(null, 'style', 'fill: black;'); }
      //text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revTextColor); 
      text2.setAttributeNS(null, 'style', 'fill:'+revInvColor); 
      if(!glyphTrack.glyphsGB.exportSVGconfig) {
        text2.setAttributeNS(null, "onclick", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\", true);");
        text2.setAttributeNS(null, "onmouseover", "gLyphsTrackRankSumInfo(\""+ glyphTrack.trackID+ "\", \"" + i +"\");");
        text2.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
      }
      g4a.appendChild(text2);

      if(mdgroup.sense_value<0) {
        rect1.setAttributeNS(null, 'fill', posInvColor);
        text1.setAttributeNS(null, 'style', 'fill:'+glyphTrack.posStrandColor); 
      }
      if(mdgroup.antisense_value<0) {
        rect2.setAttributeNS(null, 'fill', revInvColor);
        text2.setAttributeNS(null, 'style', 'fill:'+glyphTrack.revStrandColor); 
      }

      
      if(mdgroup.hide) { 
        rect1.setAttribute('style', "opacity:0.2");        
        rect2.setAttribute('style', "opacity:0.2");        
        text1.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
        text2.setAttribute('style', 'fill: rgb(120, 120, 120);'); 
      }
    }
  }
  
  return g1;
}


function gLyphsExpPanelHideMetadataWidget(glyphTrack, mdgroup) {
  if(!glyphTrack) { return; }
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');
  
  //console.log("gLyphsExpPanelHideMetadataWidget "+glyphTrack.trackID+" mdgroup: "+mdgroup);
  //for (var attr in mdgroup) {
  //  console.log("mdgroup key["+attr+"]  value["+(mdgroup[attr])+"]");
  //}

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "gLyphsExpPanelToggleHideMetadataType('"+glyphTrack.trackID+"', '"+mdgroup.mdvalue+"');");
  }
  g1.appendChild(rect);
  
  if(mdgroup.hide) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
      line.setAttributeNS(null, "onclick", "gLyphsExpPanelToggleHideMetadataType('"+glyphTrack.trackID+"', '"+mdgroup.mdvalue+ "');");
    }
    g1.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
      circle.setAttributeNS(null, "onclick", "gLyphsExpPanelToggleHideMetadataType('"+glyphTrack.trackID+"', '"+mdgroup.mdvalue+"');");
    }
    g1.appendChild(circle);
  }
  return g1;
}

function gLyphsExpPanelToggleHideMetadataType(trackID, mdvalue) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  
  var mdgroup_array = null;
  if(glyphTrack.exppanelmode == "mdgroup") {
    mdgroup_array = glyphTrack.experiment_mdgrouping;
    //console.log("gLyphsExpPanelToggleHideMetadataType "+trackID+" mdkey:"+mdvalue+"  mdgroup_array:"+mdgroup_array);
  }
  if(glyphTrack.exppanelmode == "ranksum") {
    mdgroup_array = glyphTrack.experiment_ranksum_enrichment;
  }
  if(!mdgroup_array) { return; }
    
  for(var i=0; i<mdgroup_array.length; i++) {
    var mdgroup = mdgroup_array[i];    
    if(!mdgroup) { continue; }
    if(mdgroup.mdvalue == mdvalue) {
      mdgroup.hide = !(mdgroup.hide);
      //console.log("change mdgroup:("+mdgroup.mdvalue+") hide:"+mdgroup.hide+" and adjust experiments:"+(mdgroup.source_ids.length));
      for(var expID in mdgroup.source_hash) {
        var experiment = glyphTrack.experiments[expID];
        if(!experiment) { continue; }
        if(mdgroup.hide) {
          experiment.pre_mdgroup_hide = experiment.hide;
          experiment.hide = true;
        } else {
          experiment.hide = experiment.pre_mdgroup_hide;
        }
      }
    }
  }
  glyphsExpPanelDraw(glyphTrack);
  
  glyphTrack.expfilter = ""; //no longer exactly matches the filtering
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


//----- config subpanel ---------------------------------------------------------------------

function gLyphsCreateExpressionPanelConfigWidget(glyphTrack) {  
  var g1 = document.createElementNS(svgNS,'g');
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'config');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"configure expression panel\",120);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  }
  
  var defs = document.createElementNS(svgNS,'defs');
  g1.appendChild(defs);
  var rg1 = document.createElementNS(svgNS,'radialGradient');
  rg1.setAttributeNS(null, 'id', 'grayRadialGradient');
  rg1.setAttributeNS(null, 'cx', '40%');
  rg1.setAttributeNS(null, 'cy', '40%');
  rg1.setAttributeNS(null, 'fx', '40%');
  rg1.setAttributeNS(null, 'fy', '40%');
  rg1.setAttributeNS(null, 'r',  '40%');
  defs.appendChild(rg1);
  var stop1 = document.createElementNS(svgNS,'stop');
  stop1.setAttributeNS(null, 'offset', '0%');
  stop1.setAttributeNS(null, 'stop-opacity', '0');
  stop1.setAttributeNS(null, 'stop-color', 'rgb(180,180,180)');
  rg1.appendChild(stop1);
  var stop2 = document.createElementNS(svgNS,'stop');
  stop2.setAttributeNS(null, 'offset', '100%');
  stop2.setAttributeNS(null, 'stop-opacity', '1');
  stop2.setAttributeNS(null, 'stop-color', 'rgb(100,100,100)');
  rg1.appendChild(stop2);
  
  var line = document.createElementNS(svgNS,'polyline');
  line.setAttributeNS(null, 'style', 'stroke-width: 1px; stroke: url(#grayRadialGradient)');
  line.setAttributeNS(null, 'fill', 'url(#grayRadialGradient)');
  var points = '';
  for(var ang=0; ang<=28; ang++) {
    var radius = 5;
    if(ang % 4 == 2) { radius = 5; }
    if(ang % 4 == 3) { radius = 5; }
    if(ang % 4 == 0) { radius = 2.5; }
    if(ang % 4 == 1) { radius = 2.5; }
    var x = Math.cos(ang*2*Math.PI/28.0) *radius + 5;
    var y = Math.sin(ang*2*Math.PI/28.0) *radius + 5;
    points = points + x + "," + y + " ";
  }
  line.setAttributeNS(null, 'points', points);
  g1.appendChild(line);
  
  return g1;
}


function gLyphsExpressionPanelConfigSubpanel(glyphTrack) {
  if(!glyphTrack) { return; }
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
    
  var auxdiv = glyphTrack.expPanelFrame().auxdiv;
  if(!auxdiv) { return; }
  
  var configdiv = glyphTrack.expPanelFrame().config_subpanel;
  if(!configdiv) { 
    configdiv = document.createElement('div');
    auxdiv.insertBefore(configdiv, auxdiv.firstChild);
    configdiv.id = "experiment_express_config_subpanel";
    configdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                             "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                             "width:330px; display:none; opacity:0.95; " +
                             "position:absolute; top:20px; right:10px;"
                             );      
    glyphTrack.expPanelFrame().config_subpanel = configdiv;
  }
  clearKids(configdiv);
  
  var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;
  var trackID = glyphTrack.trackID;
  
  //close button
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "general configuration";
  
  configdiv.appendChild(document.createElement('hr'));
      
  tdiv = configdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px;");
  tdiv.innerHTML = "experiment sort order";
  
  ttable  = configdiv.appendChild(document.createElement('table'));
  ttable.setAttribute('cellspacing', "0");
  ttable.setAttribute('style', "font-size:10px;");
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "name");
  tradio.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'name');");
  if(glyphTrack.express_sort_mode == "name") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "name";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "value_plus");
  tradio.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_plus');");
  if(glyphTrack.express_sort_mode == "value_plus") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression (+ strand)";
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "point");
  tradio.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'point');");
  if(glyphTrack.express_sort_mode == "point") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "series/time point";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "value_minus");
  tradio.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_minus');");
  if(glyphTrack.express_sort_mode == "value_minus") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression (- strand)";
  
  ttr  = ttable.appendChild(document.createElement('tr'));
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "series");
  tradio.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'series');");
  if(glyphTrack.express_sort_mode == "series") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "series set";
  
  ttd  = ttr.appendChild(document.createElement('td'));
  tdiv2  = ttd.appendChild(document.createElement('div'));
  tradio = tdiv2.appendChild(document.createElement('input'));
  tradio.setAttribute('type', "radio");
  tradio.setAttribute('name', "express_sort");
  tradio.setAttribute('value', "value_both");
  tradio.setAttribute("onclick", "reconfigTrackParam(\""+ trackID+"\", 'express_sort_mode', 'value_both');");  
  if(glyphTrack.express_sort_mode == "value_both") { tradio.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression (both strands)";
    
  // display_name control
  configdiv.appendChild(document.createElement('hr'));
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  span2  = tdiv2.appendChild(document.createElement('span'));
  span2.innerHTML = "display name from metadata (keys):";

  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'exp_name_mdkeys'); return false;");
  button.innerHTML = "accept";

  button = tdiv2.appendChild(document.createElement("button"));
  button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("onclick", "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'exp_name_mdkeys_clear'); return false;");
  button.innerHTML = "reset";

  var text1 = configdiv.appendChild(document.createElement('textarea'));
  text1.setAttribute('rows', 3);
  text1.setAttribute('wrap', "off");
  text1.setAttribute('style', "width:315px; margin: 5px 5px 3px 5px; font-size:10px; font-family:arial,helvetica,sans-serif; resize:vertical; min-height:30px");
  text1.id = "expExp_name_mdkeys_inputID";
  glyphTrack.expPanelFrame().name_mdkeys_input = text1;
  text1.setAttribute('type', "text");
  if(glyphTrack && glyphTrack.exp_name_mdkeys ){
    //text1.setAttribute('value', glyphTrack.exp_name_mdkeys);
    text1.innerHTML = glyphTrack.exp_name_mdkeys;
  }

  // extra checks
  configdiv.appendChild(document.createElement('hr'));
  
  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("style", "margin-left: 5px;");
  tcheck.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'subscroll', this.checked)");
  if(glyphTrack.exppanel_subscroll) { tcheck.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "enable internal scroll panel";

  tdiv2  = configdiv.appendChild(document.createElement('div'));
  tcheck = tdiv2.appendChild(document.createElement('input'));
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("style", "margin-left: 5px;");
  tcheck.setAttribute('onclick', "gLyphsExpressionPanelReconfigParam('"+glyphTrack.trackID+"', 'exprgbcolor', this.checked)");
  if(glyphTrack && glyphTrack.exppanel_use_rgbcolor) { tcheck.setAttribute('checked', "checked"); }
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "use experiment rgbColor";

  return configdiv;
}

//--- Expression panel export tools  -------------------------------------------------------------------

function gLyphsCreateExperimentExpressExportWidget(glyphTrack) {
  var g1 = document.createElementNS(svgNS,'g');  
  if(!glyphTrack.glyphsGB.exportSVGconfig) {
    g1.setAttributeNS(null, "onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'export');");
    g1.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"export data\",80);");
    g1.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");    
    //  poly.setAttributeNS(null, "onclick", "gLyphsExpGraphExportPanel();");
  }
  
  var rect = g1.appendChild(document.createElementNS(svgNS,'rect'));
  rect.setAttributeNS(null, 'x', '0px');
  rect.setAttributeNS(null, 'y', '0px');
  rect.setAttributeNS(null, 'width',  '11px');
  rect.setAttributeNS(null, 'height', '11px');
  rect.setAttributeNS(null, 'fill', 'rgb(240,240,255)');
  rect.setAttributeNS(null, 'stroke', 'rgb(100,100,100)');
  //if(!glyphTrack.glyphsGB.exportSVGconfig) {
  //  rect.setAttributeNS(null, "onclick", "gLyphsExpGraphExportPanel();");
  //  rect.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"export data\",80);");
  //  rect.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  //}
  
  var poly = g1.appendChild(document.createElementNS(svgNS,'polygon'));
  poly.setAttributeNS(null, 'points', '4,2  7,2  7,5  9.5,5  5.5,9.5  1.5,5  4,5  4,2');
  //poly.setAttributeNS(null, 'fill', 'blue');
  poly.setAttributeNS(null, 'fill', 'gray');
  //if(!glyphTrack.glyphsGB.exportSVGconfig) {
  //  poly.setAttributeNS(null, "onclick", "gLyphsExpGraphExportPanel();");
  //  poly.setAttributeNS(null, "onmouseover", "eedbMessageTooltip(\"export data\",80);");
  //  poly.setAttributeNS(null, "onmouseout", "eedbClearSearchTooltip();");
  //}
  g1.setAttributeNS(null, 'transform', "translate(" + (glyphTrack.displayWidth()-45) + ",0)");
  return g1;
}


function gLyphsExpressionPanelExportSubpanel(glyphTrack) {
  if(!glyphTrack) { return; }
  var expframe = glyphTrack.expPanelFrame();
  if(!expframe) { return; }
  var frame_width = Math.round(expframe.style.width);
    
  var auxdiv = glyphTrack.expPanelFrame().auxdiv;
  if(!auxdiv) { return; }
  
  var exportdiv = glyphTrack.expPanelFrame().export_subpanel;
  if(!exportdiv) { 
    exportdiv = document.createElement('div');
    auxdiv.insertBefore(exportdiv, auxdiv.firstChild);
    glyphTrack.expPanelFrame().export_subpanel = exportdiv;
    exportdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:500px; display:none; " +
                           "position:absolute; top:20px; right:10px;"
                           );      
  
    var tdiv, tdiv2, tspan1, tspan2, tinput, tradio, ttable, ttr, ttd, button, tcheck;
  }
  clearKids(exportdiv);
  
  //close button
  tdiv = exportdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "gLyphsToggleExpressionSubpanel('"+glyphTrack.trackID+"', 'none'); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  
  //subpanel title
  tdiv = exportdiv.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold;");
  tdiv.innerHTML = "export expression data";
  
  //----------
  var dataArea = exportdiv.appendChild(document.createElement('textarea'));
  dataArea.id = "experiment_express_export_data_area";
  dataArea.setAttribute('style', "resize:vertical; width:96%; margin: 3px 5px 3px 5px; font-size:10px; "+
                        "color:black; font-family:\"Courier New\", Courier, monospace;");
  dataArea.setAttribute('rows', 15);
  dataArea.setAttribute('wrap', "off");  

  //now fill in the data
  var experiments = new Array;
  gLyphsTrack_sort_experiment_expression(glyphTrack, glyphTrack.experiment_array, glyphTrack.express_sort_mode);

  for(var i=0; i<glyphTrack.experiment_array.length; i++) {
    var experiment = glyphTrack.experiment_array[i];
    if(experiment.hide && glyphTrack.hide_deactive_exps) { continue; }
    experiments.push(experiment);
  }
  
  dataArea.innerHTML = "experiment_name\tdatatype\t";
  if(glyphTrack.strandless) { dataArea.innerHTML += "strandless value\n"; }
  else { dataArea.innerHTML += "neg_strand_value\tpos_strand_value\n\n"; }
  
  for(var i=0; i<experiments.length; i++) {
    var experiment = experiments[i];
    
    var dataline = experiment.expname + "\t" + experiment.exptype + "\t";
    
    var value           = experiments[i].value;
    var sense_value     = experiments[i].sense_value;
    var antisense_value = experiments[i].antisense_value;
    
    if(glyphTrack.strandless) { 
      dataline += Math.round(value*1000.0)/1000.0;
    } else {
      dataline += (Math.round(antisense_value*1000.0)/1000.0) + "\t" + (Math.round(sense_value*1000.0)/1000.0);
    }
    
    dataArea.innerHTML += dataline +"\n";
  }
  return exportdiv;
}


//--- expression panel control & manipulation functions  -------------------------------------------------------------------

function gLyphsApplyExpExpressFilterSearch(trackID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return false; }
  if(!glyphTrack.experiments) { return false; }
  if(!glyphTrack.expPanelFrame()) { return false; }

  var searchMsg = glyphTrack.expPanelFrame().filter_panel_msg;
  if(searchMsg) { searchMsg.innerHTML = ""; }
  
  var searchInput = glyphTrack.expPanelFrame().filter_input;
  if(searchInput) {
    var expfilter = searchInput.value;  
    if(expfilter != glyphTrack.expfilter) {
      //gLyphsAutosaveConfig(); //don't autosave anymore with filter changes
      glyphTrack.expfilter = expfilter;
    }
  }
  return gLyphsSubmitExpExpressFilterSearch(glyphTrack);
}


function gLyphsSubmitExpExpressFilterSearch(glyphTrack) {
  if(!glyphTrack) { return false; }
  if(!glyphTrack.experiments) { return false; }
  if(!glyphTrack.expPanelFrame()) { return false; }

  if(!glyphTrack.expfilter) {
    gLyphsClearExpExpressFilterSearch(glyphTrack.trackID);
    return false;
  }

  glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
  glyphTrack.experiment_mdgrouping = null; //clear this so it recalcs

  var searchMsg = glyphTrack.expPanelFrame().filter_panel_msg;
  if(searchMsg) { searchMsg.innerHTML = ""; }

  //OK rebuild this as a ws query outside of the generic search system
  var paramXML = "<zenbu_query>\n";
  paramXML += "<registry_mode>all</registry_mode>\n";

  if(glyphTrack.peerName)   { paramXML += "<peer_names>"+glyphTrack.peerName+"</peer_names>\n"; }
  if(glyphTrack.sources)    { paramXML += "<source_names>"+glyphTrack.sources+"</source_names>\n"; }
  if(glyphTrack.source_ids) { paramXML += "<source_ids>"+ glyphTrack.source_ids +"</source_ids>\n"; }
  paramXML += "<registry_mode>all</registry_mode>\n";
  paramXML += "<mode>experiments</mode><filter>"+glyphTrack.expfilter+"</filter><format>minxml</format>\n";
  if(glyphTrack.exp_filter_incl_matching) {
    paramXML += "<include_matching><mdkeys>" + glyphTrack.exp_matching_mdkey + "</mdkeys><post_filter>" + glyphTrack.exp_matching_post_filter + "</post_filter></include_matching>";
  }
  paramXML += "</zenbu_query>\n";

  var xhr = GetXmlHttpObject();
  if(xhr==null) {
    alert ("Your browser does not support AJAX!");
    return false;
  }
  zenbuExpPanel_FilterXHR = xhr;
  zenbuExpPanel_FilterXHR.glyphTrack = glyphTrack;
  
  if(searchMsg) { searchMsg.innerHTML = "searching for filter..."; }
  xhr.open("POST", eedbSearchCGI, true); //async
  xhr.onreadystatechange= gLyphsExpFilterSearchXMLResponse;
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
}


function gLyphsExpFilterSearchXMLResponse() {
  var xhr = zenbuExpPanel_FilterXHR;
  if(!xhr) { return; }
  
  var glyphTrack = zenbuExpPanel_FilterXHR.glyphTrack
  if(!glyphTrack) { return; }
  if(!glyphTrack.experiments) { return; }
  if(!glyphTrack.expPanelFrame()) { return; }
  
  var searchMsg = glyphTrack.expPanelFrame().filter_panel_msg;
  if(searchMsg) { searchMsg.innerHTML = ""; }

  if(xhr.readyState!=4) { return false; }
  if(xhr.status!=200) { return false; }
  if(xhr.responseXML == null) { searchMsg.innerHTML = "problem with filter search"; return false; }

  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { 
    if(searchMsg) { searchMsg.innerHTML = "problem with filter search"; }
    return false; 
  }

  var experimentXML = xmlDoc.getElementsByTagName("experiment");
  if(!experimentXML) { return false; }
  if(experimentXML.length == 0) { 
    gLyphsClearExpExpressFilterSearch(glyphTrack.trackID);
    return false; 
  }
  //console.log("expexp search with ["+glyphTrack.expfilter+"] rtn " + experimentXML.length);

  //first reset all experiments to hidden
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = true; 
  }

  //then show the ones returned by the query
  for(var i=0; i<experimentXML.length; i++) {
    var expID = experimentXML[i].getAttribute("id");
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = false; 
  }
  zenbuExpPanel_FilterXHR = null;
  
  //gLyphsAutosaveConfig(); //might need to skip this autosave

  glyphsExpPanelDraw(glyphTrack);
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
  return true; //everything ok
}


function gLyphsClearExpExpressFilterSearch(trackID) {
  eedbClearSearchResults("expExp_search");

  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }

  glyphTrack.expfilter = "";
  glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
  glyphTrack.experiment_mdgrouping = null; //clear this so it recalcs

  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = false;
  }
  //gLyphsAutosaveConfig(); //don't autosave with filter changes anymore
  glyphsExpPanelDraw(glyphTrack);
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function gLyphsInvertExperimentSelection(trackID) {
  eedbClearSearchResults("expExp_search");
  
  if(!trackID) { return; }
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  
  glyphTrack.expfilter = "";
  
  for(var expID in glyphTrack.experiments){
    var experiment = glyphTrack.experiments[expID];
    if(!experiment) { continue; }
    experiment.hide = !experiment.hide;
  }
  gLyphsAutosaveConfig();
  glyphsExpPanelDraw(glyphTrack);
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function gLyphsCreateHideExperimentWidget(glyphTrack, experiment, row) {
  if(glyphTrack.glyphsGB.exportSVGconfig && glyphTrack.glyphsGB.exportSVGconfig.hide_widgets) { return; }
  var g1 = document.createElementNS(svgNS,'g');
  g1.setAttributeNS(null, 'transform', "translate(0,"+ ((row*12)) +")");

  var rect = document.createElementNS(svgNS,'rect');
  rect.setAttributeNS(null, 'x', '1px');
  rect.setAttributeNS(null, 'y', '1px');
  rect.setAttributeNS(null, 'width',  '8px');
  rect.setAttributeNS(null, 'height', '8px');
  rect.setAttributeNS(null, 'style', 'fill: white;  stroke: white;');
  if(!glyphTrack.glyphsGB.exportSVGconfig) { 
    rect.setAttributeNS(null, "onclick", "gLyphsToggleExperimentHide('"+glyphTrack.trackID+"', '"+experiment.id+"');");
  }
  g1.appendChild(rect);

  if(experiment.hide) {
    var line = document.createElementNS(svgNS,'polyline');
    line.setAttributeNS(null, 'points', '1,5 8,5');
    line.setAttributeNS(null, 'style', 'stroke-width: 2px; stroke: red;');
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
      line.setAttributeNS(null, "onclick", "gLyphsToggleExperimentHide('"+glyphTrack.trackID+"', '"+experiment.id+"');");
    }
    g1.appendChild(line);
  } else {
    var circle = document.createElementNS(svgNS,'circle');
    circle.setAttributeNS(null, 'cx', '5px');
    circle.setAttributeNS(null, 'cy', '5px');
    circle.setAttributeNS(null, 'r',  '3px');
    circle.setAttributeNS(null, 'fill', 'white');
    circle.setAttributeNS(null, 'stroke', 'blue');
    circle.setAttributeNS(null, 'stroke-width', '2px');
    if(!glyphTrack.glyphsGB.exportSVGconfig) { 
      circle.setAttributeNS(null, "onclick", "gLyphsToggleExperimentHide('"+glyphTrack.trackID+"', '"+experiment.id+"');");
    }
    g1.appendChild(circle);
  }
  return g1;
}

function gLyphsToggleExperimentHide(trackID, expID) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  var experiment = glyphTrack.experiments[expID];
  if(!experiment) { return; }
  experiment.hide = !(experiment.hide);
  //console.log(trackID+" hide:"+(experiment.hide)+" exp:"+experiment.name);
  glyphsExpPanelDraw(glyphTrack);

  glyphTrack.expfilter = ""; //no longer exactly matches the filtering
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


function gLyphsExpressionPanelReconfigParam(trackID, param, value) {
  var glyphTrack = glyphsTrack_global_track_hash[trackID];
  if(!glyphTrack) { return; }
  
  if(param == "hide_deactive") {
    glyphTrack.hide_deactive_exps = value;
  }
  if(param == "active_on_top") {
    glyphTrack.active_on_top = value;
  }
  if(param == "hide_zero_experiments") {
    glyphTrack.hide_zero = value;
  }
  if(param == "subscroll") {
    glyphTrack.exppanel_subscroll = value;
  }
  if(param == "exprgbcolor") {
    glyphTrack.exppanel_use_rgbcolor = value;
  }
  if(param == "mdgroup_input") {
    var searchInput = glyphTrack.expPanelFrame().mdgroup_input;
    if(searchInput) {
      var mdgroupkey = searchInput.value;  
      glyphTrack.mdgroupkey = mdgroupkey;
      glyphTrack.experiment_mdgrouping = null;  //clear this so it recalcs
      glyphTrack.checked_missing_mdata = false;
    }
  }
  if(param == "exp_name_mdkeys") {
    var searchInput = glyphTrack.expPanelFrame().name_mdkeys_input;
    if(searchInput) {
      var mdkeys = searchInput.value;  
      glyphTrack.exp_name_mdkeys = mdkeys;
      gLyphsCacheSources(glyphTrack); //reload
      gLyphsAutosaveConfig(); 
    }
  }
  if(param == "exp_name_mdkeys_clear") {
    var searchInput = glyphTrack.expPanelFrame().name_mdkeys_input;
    searchInput.value = "";  
    searchInput.innerHTML = "";  
    glyphTrack.exp_name_mdkeys = "";
    gLyphsAutosaveConfig(); 
  }
  
  
  if(param == "errorbar_type") {
    glyphTrack.errorbar_type = value; 
  }
  if(param == "ranksum_display") {
    var ranksum_div = document.getElementById("panel_groupinfo_ranksum_div");
    var exp_div     = document.getElementById("panel_groupinfo_exp_div");

    if(value == "ranksum") {
      if(ranksum_div) { ranksum_div.style.display = "block"; }
      if(exp_div)     { exp_div.style.display     = "none"; }
      glyphTrack.groupinfo_ranksum_display = true;
    } else {
      if(ranksum_div) { ranksum_div.style.display = "none"; }
      if(exp_div)     { exp_div.style.display     = "block"; }
      glyphTrack.groupinfo_ranksum_display = false;
    }
  }
  if(param == "expfilter") {
    glyphTrack.expfilter = value; 
  }
  if(param == "include_matching") {
    glyphTrack.exp_filter_incl_matching = value; 
  }
  if(param == "include_matching_mdkey") {
    glyphTrack.exp_matching_mdkey = value;
  }
  if(param == "include_matching_post_filter") {
    glyphTrack.exp_matching_post_filter = value;
  }
  if(param == "exppanelmode") {
    if(value != glyphTrack.exppanelmode) { gLyphsAutosaveConfig(); }
    glyphTrack.exppanelmode = value;
  }
  if(param == "ranksum_mdkeys") {
    var searchInput = glyphTrack.expPanelFrame().ranksum_mdkey_input;
    if(searchInput) {
      var value2 = searchInput.value;
      if(value2 != glyphTrack.ranksum_mdkeys) { 
        gLyphsAutosaveConfig(); 
        glyphTrack.experiment_ranksum_enrichment = null; //clear this so it recalcs
      }
      glyphTrack.ranksum_mdkeys = value2;
    }
  }
  if(param == "ranksum_min_zscore") {
    var searchInput = glyphTrack.expPanelFrame().ranksum_min_zscore_input;
    if(searchInput) {
      var zscore = parseFloat(searchInput.value);
      if(zscore != glyphTrack.ranksum_min_zscore) { 
        gLyphsAutosaveConfig(); 
        glyphTrack.ranksum_min_zscore = zscore;
      }
    }
  }
  
  if(param == "exp_panel_show") {
    glyphTrack.expPanelActive = true;
    glyphTrack.expPanelFrame().hide = false;
  }
  if(param == "exp_panel_close") {
    console.log("hide track-specific expPanel "+glyphTrack.trackID);
    glyphTrack.expPanelFrame().hide = true;
    glyphTrack.expPanelActive = false;
  }
  
  //gLyphsDrawExpressionPanel(glyphTrack.glyphsGB);
  glyphsExpPanelDraw(glyphTrack);
  gLyphsRenderTrack(glyphTrack);
  gLyphsDrawTrack(glyphTrack.trackID);
}


