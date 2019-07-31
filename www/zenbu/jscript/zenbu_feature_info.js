// ZENBU zenbu_feature_info.js
//
// Contact : Jessica Severin <severin@gsc.riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
// * ZENBU eedb_reports.js
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

var zenbuFeatureInfo_selected_feature = undefined;


function zenbuDisplayFeatureInfo(feature) {
  zenbuFeatureInfo_selected_feature = feature;  //sets the selected_feature linked to feature_info

  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  eedbClearSearchTooltip();
  info_div.innerHTML = "";
  info_div.setAttribute('style', "");

  if(!feature) { return; }

  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";

  var e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos + 5;

  if(info_div.getAttribute("xpos_abs")) { xpos = Math.floor(info_div.getAttribute("xpos_abs")); }
  info_div.setAttribute("xpos", xpos);
  info_div.setAttribute("ypos", ypos);

  //info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

  var tdiv, tspan, tinput, ta;
  var main_div = info_div;
  main_div.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                                 "width:350px; z-index:120; padding: 3px 3px 3px 3px; "+
                                 //"background-color:rgb(220,220,255); border:inset; border-width:2px; "+
                                 "background-color:rgb(230,230,240); "+
                                 "border: 2px solid #808080; border-radius: 4px; "+
                                 "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");

  //titlebar area to capture move events
  var titlebar_div = main_div.appendChild(document.createElement('div'));
  titlebar_div.setAttribute("onmousedown", "zenbuFeatureInfoToggleDrag('start');");
  titlebar_div.setAttribute("onmouseup", "zenbuFeatureInfoToggleDrag('stop');");

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "zenbuFeatureInfoEvent('close');return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  tdiv = titlebar_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:12px; font-weight: bold;");
  tspan.innerHTML = feature.name;
  if(feature.category && feature.source_name) {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-size:9px; padding: 0px 0px 0px 3px;");
    tspan.innerHTML = feature.category +" : " + feature.source_name;
  }
  if(feature.description && feature.description.length > 0) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = feature.description;
  }
  if(feature.summary) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "margin-top:3px;");
    tdiv.innerHTML = feature.summary;
  }

  if(feature.description || feature.summary) {
    main_div.appendChild(document.createElement('hr'));
  }

  if(feature.request_full_load) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; color:blue; ");
    tspan.innerHTML = "loading full metadata.....";
    //feature.callOutFunction = gLyphsDisplayFeatureInfo;
    feature.callOutFunction = zenbuDisplayFeatureInfo;
    eedbFullLoadObject(feature); //async process
  }

  //if there is a full_load_error
  if(feature.full_load_error) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "font-weight: bold; color:orange; ");
    tspan.innerHTML = "warn: ";
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "color:darkgray;");
    tspan.innerHTML = "unable to load full metadata";
  }

  if(feature.gene_names && (feature.gene_names.length > 0)) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "alias: " + feature.gene_names;
  }

  if(feature.entrez_id || feature.omim_id) {
    tdiv = main_div.appendChild(document.createElement('div'));
    if(feature.entrez_id) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "EntrezID:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "zenbu_entrez");
      ta.setAttribute("href", "http://www.ncbi.nlm.nih.gov/sites/entrez?db=gene&amp;cmd=Retrieve&amp;dopt=full_report&amp;list_uids="+feature.entrez_id);
      ta.innerHTML = feature.entrez_id;
    }
    if(feature.omim_id) {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "OMIM:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "zenbu_OMIM");
      ta.setAttribute("href", "http://www.ncbi.nlm.nih.gov/omim/"+ feature.omim_id);
      ta.innerHTML = feature.omim_id;
    }
  }
  if((feature.category == "mrna") || (feature.category == "refgene")) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "NCBI:";
    ta = tdiv.appendChild(document.createElement('a'));
    ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
    ta.setAttribute("target", "zenbu_ncbi");
    ta.setAttribute("href", "http://www.ncbi.nlm.nih.gov/nuccore/"+feature.name);
    ta.innerHTML = feature.name;
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "DDBJ:";
    ta = tdiv.appendChild(document.createElement('a'));
    ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
    ta.setAttribute("target", "zenbu_ddbj");
    ta.setAttribute("href", "http://getentry.ddbj.nig.ac.jp/search/get_entry?&accnumber="+feature.name);
    ta.innerHTML = feature.name;
    if(feature.taxon_id == "10090") {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "MGI:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "zenbu_mgijax");
      ta.setAttribute("href", "http://www.informatics.jax.org/javawi2/servlet/WIFetch?page=sequenceDetail&id="+feature.name);
      ta.innerHTML = feature.name;
    }
    if(feature.taxon_id == "9606") {
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "NATsDB:";
      ta = tdiv.appendChild(document.createElement('a'));
      ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
      ta.setAttribute("target", "zenbu_natsdb");
      ta.setAttribute("href", "http://natsdb.cbi.pku.edu.cn/nats_seq.php?species=hs&acc="+feature.name);
      ta.innerHTML = feature.name;
    }
  }

  var chromloc = feature.chromloc;
  if(!chromloc) {
    chromloc = "";
    if(feature.asm) { chromloc += feature.asm.toLowerCase() +"::"; }
    chromloc += feature.chrom+":";
    chromloc += feature.start +".."+ feature.end + feature.strand;
  }
  tdiv = main_div.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "location: ";
  if(feature.genloc) { tspan.innerHTML += feature.genloc + " :: "; }
  
  if(info_div.locationCallOutFunction) { 
    ta = tdiv.appendChild(document.createElement('a'));
    ta.setAttribute("style", "padding: 0px 5px 0px 0px;");
    ta.setAttribute("href", "./");
    ta.innerHTML = chromloc;

    var start = Math.floor(feature.start);
    var end   = Math.floor(feature.end);
    var range = end-start;
    start -= Math.round(range*.25);
    end += Math.round(range*.25);
    var chromloc = feature.chrom+":" + start +".."+end;
    ta.onclick = function() { info_div.locationCallOutFunction(chromloc); return false; }
  } else {
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute("style", "padding: 0px 5px 0px 0px; ");
    tspan.innerHTML = chromloc;
  }
  var ss = feature.start;
  var se = feature.end;
  if(ss>se) { var t=ss; ss=se; se=t; }
  var len = se-ss+1;
  if(len > 1000000) { len = (len/1000000) + "mb"; }
  else if(len > 1000) { len = (len/1000) + "kb"; }
  else { len += "bp"; }
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "("+len+")";


  //hyperlinks here
  if(feature.mdata && feature.mdata["zenbu:hyperlink"]) {
    var parser = new DOMParser();
    tdiv = main_div.appendChild(document.createElement('div'));
    var value_array = feature.mdata["zenbu:hyperlink"];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];

      var hyperlinkDoc = parser.parseFromString(value, "text/xml");
      if(hyperlinkDoc && hyperlinkDoc.documentElement && (hyperlinkDoc.documentElement.tagName == "a")) {
        var hyperlink = hyperlinkDoc.documentElement;
        var url = hyperlink.getAttribute("href");
        var name = hyperlink.firstChild.nodeValue;
        var title = "hyperlink";
        if(hyperlink.getAttribute("title"))  { title = hyperlink.getAttribute("title"); }
        if(hyperlink.getAttribute("prefix")) { title = hyperlink.getAttribute("prefix"); }
        if(!title) { tile = "hyperlink"; }

        var tdiv2 = tdiv.appendChild(document.createElement('div'));
        tspan = tdiv2.appendChild(document.createElement('span'));
        //tspan.innerHTML = "hyperlink: ";
        tspan.innerHTML = escape(title) + ": "; 

        var link1 = tdiv2.appendChild(document.createElement("a"));
        link1.setAttribute("target", "f5rb");
        link1.setAttribute("href", unescape(url));
        link1.innerHTML = escape(name);
      }
    }
  }

  //if(feature.description) { object_html += "<div>" + encodehtml(feature.description)+ "</div>"; }
  //if(feature.gene_names) { object_html += "<div>alias: " + feature.gene_names +"</div>"; }
  //if(feature.entrez_id) { object_html += "<div>EntrezID: " + feature.entrez_id +"</div>"; }
  //if(feature.maxexpress) { object_html += "<div>maxexpress: " + feature.maxexpress + "</div>"; }
  if(feature.score || feature.exp_total) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    if(feature.score) { tdiv.innerHTML = "score: " + feature.score; }
    if(feature.exp_total) { tdiv.innerHTML += "  exp_total: " + feature.exp_total.toFixed(2); }
  }

  //
  //if(maxexpress && (maxexpress.length > 0)) {
  //  object_html += "<div>maxexpress: ";
  //  var express = maxexpress[0].getElementsByTagName("signal-histogram");
  //  for(var i=0; i<express.length; i++) {
  //    var platform = express[i].getAttribute("platform");
  //    if(platform == 'Illumina microarray') { platform = "ILMN"; }
  //    object_html += platform + ":" + express[i].getAttribute("maxvalue") + " ";
  //  }
  //}

  if(feature.cytostain) { 
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.innerHTML = "cytostain: " + feature.cytostain;
  }

  //metadata
  if(feature.mdata) {
    for(var tag in feature.mdata) { //new common mdata[].array system
      if(tag=="description") { continue; }
      if(tag=="eedb:description") { continue; }
      if(tag=="eedb:category") { continue; }
      if(tag=="display_name") { continue; }
      if(tag=="eedb:display_name") { continue; }
      if(tag=="eedb:owner_nickname") { continue; }
      if(tag=="eedb:owner_OpenID") { continue; }
      if(tag=="keyword") { continue; }

      tdiv = main_div.appendChild(document.createElement('div'));
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.setAttribute('style', "font-weight: bold;");
      tspan.innerHTML = tag + ": ";
      var value_array = feature.mdata[tag];
      for(var idx1=0; idx1<value_array.length; idx1++) {
        var value = value_array[idx1];

        if(idx1!=0) { 
          tspan = tdiv.appendChild(document.createElement('span'));
          tspan.innerHTML = ", " 
        }

        tspan = tdiv.appendChild(document.createElement('span'));
        tspan.setAttribute('style', "color: rgb(105,105,105); word-wrap: break-word; ");
        tspan.innerHTML = value;
      }
    }
  }

  if(!feature.chrom_id) {
    var chrom = eedbFetchChrom(feature.asm, feature.chrom);
    if(chrom) { 
      feature.chrom_id = chrom.chrom_id; 
      if(chrom.assembly) { feature.has_sequence = chrom.assembly.has_sequence; }
    }
  }

  if(feature.has_sequence) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    var button1 = tdiv.appendChild(document.createElement('input'));
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "sequence");
    button1.className = "slimbutton";    
    button1.style.marginLeft = "0px";
    button1.style.marginTop = "0px";
    button1.style.fontSize = "9px";
    button1.setAttribute("onclick", "zenbuFeatureInfoShowSequence(); return false;");
    button1.innerHTML = "sequence";
  }

  if(feature.id) {
    tdiv = main_div.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    tdiv.innerHTML = "<a target=\"_eedb_xml\" href=\""+eedbSearchCGI+"?format=fullxml;id="+feature.id+"\">xml</a>";
  }
  
  eedbClearSearchTooltip();
}


function zenbuFeatureInfoEvent(param, value) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  if(param == "close") {
    info_div.innerHTML = ""; 
    info_div.setAttribute('style', "");
    info_div.removeAttribute("xpos_abs"); //reset the offsets
    zenbuFeatureInfo_selected_feature = undefined;
    if(info_div.callOutFunction) { info_div.callOutFunction("close"); }
  }
}


function zenbuFeatureInfoToggleDrag(mode, e) {
  if (!e) var e = window.event
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }
  if(!info_div) {
    //reset the global events back
    document.onmousemove = moveToMouseLoc;
    document.onmouseup   = null;
    return;
  }

  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  if(mode =='start') {
    info_div.setAttribute("is_moving", 1);
    document.onmousemove = zenbuFeatureInfoMoveEvent;

    //set the relative starting x/y position within the panel
    var offX = xpos - Math.floor(info_div.getAttribute("xpos"));
    var offY = ypos - Math.floor(info_div.getAttribute("ypos"));
    info_div.setAttribute("move_offsetX", offX);
    info_div.setAttribute("move_offsetY", offY);
    zenbuFeatureInfoMoveEvent(e);
  } else {
    if(info_div.getAttribute("is_moving")) { //stop moving 
      //reset the global events back
      document.onmousemove = moveToMouseLoc;
      document.onmouseup = null;
      info_div.removeAttribute("is_moving");
    }
  }
}


function zenbuFeatureInfoMoveEvent(e) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }

  if(!info_div.getAttribute("is_moving")) { return; }
  
  if(document.selection) { document.selection.empty(); }
  else if(window.getSelection) { window.getSelection().removeAllRanges(); }

  if(!e) e = window.event
  toolTipWidth=350;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.xpos;
  var ypos = toolTipSTYLE.ypos;

  xpos = xpos - Math.floor(info_div.getAttribute("move_offsetX"));
  ypos = ypos - Math.floor(info_div.getAttribute("move_offsetY"));

//  info_div.setAttribute('style', "position:absolute; left:"+ xpos +"px; top:"+ ypos +"px;");
  info_div.style.left = xpos + "px";
  info_div.style.top  = ypos + "px";

  info_div.setAttribute("xpos", xpos);
  info_div.setAttribute("ypos", ypos);

  info_div.setAttribute("xpos_abs", xpos);
}

//---------------------------------------------------------------
//
// feature_info and sequence info section
// 
//---------------------------------------------------------------


function zenbuFeatureInfoShowSequence(showseq) {
  if(!zenbuFeatureInfo_selected_feature) { return; }
  var feature = zenbuFeatureInfo_selected_feature;

  var strand = feature.strand;
  if(strand!="+" && strand!="-") { strand = "+"; }

  //better to copy the array so as not disrupt the feature
  var subfeats = [];
  if(feature.subfeatures && (feature.subfeatures.length>0)) { 
    console.log("feature has "+(feature.subfeatures.length)+" subfeats");
    subfeats = [].concat(feature.subfeatures);
  }

  var chrom = feature.chrom;
  var start = feature.start;
  var end   = feature.end;
  var name  = feature.name;

  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }
  

  var divFrame = document.getElementById("feature_info_sequence_div");
  if(divFrame) { //toggle if off
    info_div.removeChild(divFrame);
    if(!showseq) { return; }
  }

  divFrame = info_div.appendChild(document.createElement('div'));
  divFrame.id = "feature_info_sequence_div";
  divFrame.setAttribute('style', "margin-top:5px;");

  divFrame.appendChild(document.createElement('hr')); //to break up the right-float <sequence> button
  //divFrame.appendChild(document.createElement('p'));

  var chromloc   = chrom +":" + start + ".." + end;

  if(!feature.id || (info_div.prev_feature_id != feature.id)) {
    console.log("feature_info changed to "+feature.id);

    if(!feature.chrom_id) {
      var chrom = eedbFetchChrom(feature.asm, feature.chrom);
      if(chrom) { 
        feature.chrom_id = chrom.chrom_id; 
        if(chrom.assembly) { feature.has_sequence = chrom.assembly.has_sequence; }
      }
    }

    var paramXML = "<zenbu_query><format>xml</format><mode>sequence</mode>\n";
    paramXML += "<source_ids>"+ feature.chrom_id+"</source_ids>\n";
    paramXML += "<asm>"+feature.asm+"</asm>\n";
    paramXML += "<loc>"+chromloc+"</loc>\n";
    paramXML += "<strand>"+strand+"</strand>\n";
    paramXML += "</zenbu_query>\n";

    var chromXMLHttp=GetXmlHttpObject();
    if(chromXMLHttp==null) { return; }

    chromXMLHttp.open("POST", eedbRegionCGI, false);  //synchronous
    chromXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
    //chromXMLHttp.setRequestHeader("Content-length", paramXML.length);
    //chromXMLHttp.setRequestHeader("Connection", "close");
    chromXMLHttp.send(paramXML);

    if(chromXMLHttp.responseXML == null) return;
    if(chromXMLHttp.readyState!=4) return;
    if(chromXMLHttp.status!=200) { return; }
    if(chromXMLHttp.responseXML == null) return;

    var xmlDoc=chromXMLHttp.responseXML.documentElement;
    if(xmlDoc==null) {
      document.getElementById("message").innerHTML= 'Problem with central DB!';
      return;
    }

    var sequenceXML = xmlDoc.getElementsByTagName("sequence");
    if(!sequenceXML) { return; }
    if(sequenceXML.length == 0) { return; }

    info_div.sequence = sequenceXML[0].firstChild.nodeValue;

    //next get the subfeature_types
    info_div.subfeature_types = new Object;
    info_div.subfeature_types["genomic"] = { type:"genomic", count:0, active:true, color:"black" };

    if(strand=="-") { subfeats.sort(feature_reverse_loc_sort_func); }
    else { subfeats.sort(feature_loc_sort_func); }
    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      if(!subfeature) { continue; }
      var subtype = subfeature.category;
      if(!info_div.subfeature_types[subtype]) {
        info_div.subfeature_types[subtype] = { type:subtype, count:0, active:true, color:"black" };
      }
      info_div.subfeature_types[subtype].count++;
      info_div.subfeature_types["intron"] = { type:"intron", count:0, active:true, color:"gray" };
      info_div.subfeature_types["genomic"].active = false;
      
      switch(subfeature.category) {
        case "UTR":
        case "5utr":
        case "3utr":
          info_div.subfeature_types[subtype].color = "orange";
          break;
        case "start_codon":
          info_div.subfeature_types[subtype].color = "green";
          break;
        case "stop_codon":
          info_div.subfeature_types[subtype].color = "red";
          break;
        case "exon":
          info_div.subfeature_types[subtype].color = "navy";
          break;
        default:
          break;
      }
    }

    //ok so set the prev_feature_id
    info_div.prev_feature_id = feature.id;
  }
  var sequence = info_div.sequence;
  if(!sequence) {
    console.log("failed to get feature_info sequence");
    return;
  }
  var subseq_len = sequence.length;
  console.log("genomic sequence "+subseq_len+"bp");

  //special adjustment for bed-like features since "block" overlaps with "utr"
  var thickstart = feature.start;
  var thickend   = feature.end;
  for(var j=0; j<subfeats.length; j++) {
    var subfeature = subfeats[j];
    if(!subfeature) { continue; }
    if(feature.strand == "+") {
      if((subfeature.category == "5utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
      if((subfeature.category == "3utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
    }
    if(feature.strand == "-") {
      if((subfeature.category == "3utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
      if((subfeature.category == "5utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
    }
    //gencode uses UTR for both 5utr and 3utr
    if((subfeature.category == "UTR") && (subfeature.start == feature.start) && (subfeature.end >= thickstart)) { 
      thickstart = subfeature.end+1; 
    }
    if((subfeature.category == "UTR") && (subfeature.end == feature.end) && (subfeature.start <= thickend)) { 
      thickend = subfeature.start-1; 
    }
  }
  console.log("sequence setup for "+feature.name+" "+chrom+":"+feature.start+".."+feature.end+feature.strand+"  thickstart:"+thickstart+"  thickend:"+thickend+"  subfeats:"+(subfeats.length));

  //special code to create 'intron' or 'other' to fill in the gaps
  subfeats.sort(feature_loc_sort_func);
  var curr_pos = feature.start;
  var j=0;
  while(j<subfeats.length) {
    var subfeature = subfeats[j];
    if(!subfeature) { break; }
    //console.log("subfeature ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"]");
    if(subfeature.start - curr_pos > 1) {
      //console.log("  found gap, create intron "+(curr_pos+1)+".."+(subfeature.start-1));
      var intron = new Object();
      intron.start = curr_pos+1;
      intron.end = subfeature.start-1;
      intron.strand = feature.strand;
      intron.category = "intron";
      subfeats.push(intron);
      subfeats.sort(feature_loc_sort_func);
    } else { j++ }
    curr_pos = subfeature.end;
  }
  
  //the logic for overlapping subfeatures is still not perfect
  // I think the best way is to create a 1bp 'map' and paint the subfeature type onto it
  //start with the longest subfeatures and move to shorter. that way priority is given to the shortest subfeatures
  //and thus creates a pyramid effect
  var sequence_attribs = [];
  for(var i=0; i<sequence.length; i++) {
    sequence_attribs[i] = "genomic"; //predefine as genomic
  }
  subfeats.sort(feature_size_sort_func);  //sort from largest to smallest
  subfeats.reverse();
  for(var j=0; j<subfeats.length; j++) {
    var subfeature = subfeats[j];
    if(!subfeature) { continue; }
    var sft = info_div.subfeature_types[subfeature.category];
    if(!sft.active) { continue; }

    var fs = subfeature.start;
    var fe = subfeature.end;
    var cs = fs - feature.start;
    var ce = fe - feature.start;
    if(feature.strand=="-") {
      cs = feature.end - fe;
      ce = feature.end - fs;
    }
    //subfeature.sequence = sequence.substring(cs,ce);
    //console.log("subfeature ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"] len="+(subfeature.end-subfeature.start+1)+"  cs="+cs+"  ce="+ce);
    for(var k=cs; k<=ce; k++) {
      if(sequence_attribs[k]=="CDS" && (subfeature.category=="block" || subfeature.category=="exon")) {
        continue; 
      }
      //if(sequence_attribs[k] != "genomic") { console.log("overlapping subfeatures old:"+(sequence_attribs[k])+" new:"+subfeature.category); }
      sequence_attribs[k] = subfeature.category;
    }
  }
  subfeats.sort(feature_loc_sort_func); //reset back

  //use the sequence_attribs and create pseudo contiguous segments
  var segments = [];
  var segment = null;
  for(var i=0; i<sequence.length; i++) {
    var seqchar  = sequence.charAt(i);
    var seq_catg = sequence_attribs[i];
    
    var sft = info_div.subfeature_types[seq_catg];
    if(!sft) { console.log("problem seq_catg["+seq_catg+"] does not have sft"); continue; }
    if(!sft.active) { continue; }
    
    if(!segment || (segment.category != seq_catg)) {
      segment = new Object();
      segment.category = seq_catg;
      segment.sft = sft;
      segment.start = i;
      segment.end = i;
      segment.seq = seqchar;
      segments.push(segment);
      //console.log("new segment start:"+i+" "+seq_catg);
    } else {
      segment.end = i;
      segment.seq += seqchar;
    }
  }
  console.log("generated "+(segments.length)+" sequence segments");  
  
  //
  // now display in popup panel
  //
  var tdiv, tspan, tinput;

  // location
  tdiv = divFrame.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  //tspan.innerHTML = "seq: ";
  //if(feature.genloc) { tspan.innerHTML += feature.genloc + " :: "; }
  tspan.innerHTML = feature.asm +" "+ chromloc + strand;

  var seqlen_span = tdiv.appendChild(document.createElement('span'));
  seqlen_span.innerHTML = " [seq "+ sequence.length + "bp]";
  
  //controls for subfeature modifications
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:10px; word-wrap:break-word;");
  for(var subtype in info_div.subfeature_types) {
    var sft = info_div.subfeature_types[subtype];
    //console.log("subtype ["+subtype+"]  cnt="+sft.count+" active:"+sft.active);

    var tblock  = tdiv.appendChild(document.createElement('label'));
    tblock.style.display = "inline";
    tblock.style.whiteSpace = "nowrap";
    var check1 = tblock.appendChild(document.createElement('input'));
    check1.setAttribute('style', "margin: 1px 1px 1px 5px;");
    check1.setAttribute('type', "checkbox");
    if(sft.active) { check1.setAttribute('checked', "checked"); }
    check1.setAttribute("onclick", "zenbuFeatureInfoSequenceFilter('"+subtype+"');");
    var span1 = tblock.appendChild(document.createElement('span'));
    span1.style.color = sft.color;
    span1.innerHTML = subtype;
    if(subtype=="genomic") { 
      span1 = tblock.appendChild(document.createElement('span'));
      span1.setAttribute('style', "margin: 1px 1px 1px 5px;");
      span1.innerHTML = "|";
    }
  }

  //sequence box
  var seqBox = divFrame.appendChild(document.createElement('div'));
  seqBox.setAttribute('style', "width:340px; height:180px; margin: 3px 5px 3px 5px; font-size:12px; font-family:monospace; overflow-y:scroll; resize: vertical; word-break: break-all; word-wrap: break-word; background:white; border:inset 2px; min-height:100px; ");

  subseq_len = 0;
  for(var i=0; i<segments.length; i++) {
    var segment = segments[i];
    if(!segment) { continue; }
    var sft = segment.sft;
    if(!sft || !sft.active) { continue; }
    //console.log("segment "+segment.category+"  s:"+segment.start+"  e:"+segment.end+"  "+segment.seq);
    console.log("segment "+segment.category+"  s:"+segment.start+"  e:"+segment.end);
    subseq_len += segment.seq.length;

    if(segment.category == "intron") { segment.seq = segment.seq.toLowerCase(); }
    //else { segment.seq = segment.seq.toUpperCase(); }

    var span1 = seqBox.appendChild(document.createElement('span'));
    //span1.setAttribute('style', seqstyle);
    span1.style.color = sft.color;
    span1.innerHTML = segment.seq;
  }

  //
  //---- older attempts at doing the subfeature.category filter/coloring of the sequence
  //
  /*
  //precalc the sequence for each subfeature
  for(var j=0; j<subfeats.length; j++) {
    var subfeature = subfeats[j];
    var fs = subfeature.start;
    var fe = subfeature.end;
    var cs = fs - feature.start;
    var ce = fe - feature.start + 1;
    if(strand=="-") {
      cs = feature.end - fe;
      ce = feature.end - fs + 1;
    }
    subfeature.sequence = sequence.substring(cs,ce);
    console.log("subfeature ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"] -- "+subfeature.sequence);
  }
  */

  /*
  var sft1 = info_div.subfeature_types["genomic"];
  if(subfeats && sft1 && !sft1.active) {
    if(strand=="-") { sequence = sequence.split("").reverse().join(""); }

    var subseq = "";
    var subseq_pos=0;

    var thickstart = feature.start;
    var thickend   = feature.end;
    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      if(feature.strand == "+") {
        if((subfeature.category == "5utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
        if((subfeature.category == "3utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
      }
      if(feature.strand == "-") {
        if((subfeature.category == "3utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
        if((subfeature.category == "5utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
      }
    }

    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      console.log("subfeature ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"]");
      var sft = info_div.subfeature_types[subfeature.category];
      if(!sft.active) { continue; }

      var fs = subfeature.start;
      var fe = subfeature.end;
      if((subfeature.category == "block") || (subfeature.category == "exon")) {
        if(thickstart == thickend) { continue; }
        if(fe < thickstart) { continue; }
        if(fs > thickend) { continue; }
        if(fs < thickstart) { fs = thickstart; }
        if(fe > thickend)   { fe = thickend; }
      }
      var cs = fs - feature.start;
      var ce = fe - feature.start + 1;
      if(subseq_pos > ce) { 
        console.log("  skip ce:"+ce+" <=  prev_ce:"+subseq_pos);
        continue;
      }
      if(subseq_pos > cs) { 
        console.log("  readjust cs:"+cs+"  prev_ce:"+subseq_pos);
        cs = subseq_pos; 
      }
      console.log("  extract subseq ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"] fs:"+fs+" fe"+fe+" cs:"+cs+" ce:"+ce);
      subseq += sequence.substring(cs,ce);
      subseq_pos = ce;
    }
    sequence = subseq;
    if(strand=="-") { sequence = sequence.split("").reverse().join(""); }
  }
  */
  //document.getElementById("message").innerHTML = "feature seq : " + sequence;
  /*
  var sft1 = info_div.subfeature_types["genomic"];
  if(subfeats && sft1 && !sft1.active) {    
    //if(strand=="-") { sequence = sequence.split("").reverse().join(""); }
    //reverse the subfeature sort order, don't reverse the sequence, but instead reverse the coordinate system

    //not simple reverse, should be sorted on the subfeat.end
    //if(strand=="-") { subfeats.sort(feature_reverse_loc_sort_func); }
    //else { subfeats.sort(feature_loc_sort_func); }


    //not simple reverse for "-" strand, should be sorted on the subfeat.end
    if(strand=="-") { subfeats.sort(feature_reverse_loc_sort_func); }
    else { subfeats.sort(feature_loc_sort_func); }

    //precalc the sequence for each subfeature
    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      var fs = subfeature.start;
      var fe = subfeature.end;
      var cs = fs - feature.start;
      var ce = fe - feature.start + 1;
      if(strand=="-") {
        cs = feature.end - fe;
        ce = feature.end - fs + 1;
      }
      subfeature.sequence = sequence.substring(cs,ce);
      //console.log("subfeature ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"] -- "+subfeature.sequence);
    }

    var subseq = "";
    var subseq_pos=0;
    subseq_len = 0;

    //var thickstart = feature.start;
    //var thickend   = feature.end;
    //for(var j=0; j<subfeats.length; j++) {
    //  var subfeature = subfeats[j];
    //  if(feature.strand == "+") {
    //    if((subfeature.category == "5utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
    //    if((subfeature.category == "3utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
    //  }
    //  if(feature.strand == "-") {
    //    if((subfeature.category == "3utr") && (subfeature.end >= thickstart)) { thickstart = subfeature.end+1; }
    //    if((subfeature.category == "5utr") && (subfeature.start <= thickend)) { thickend = subfeature.start-1; }
    //  }
    //}
    
    for(var j=0; j<subfeats.length; j++) {
      var subfeature = subfeats[j];
      //console.log("subfeature ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"]");
      var sft = info_div.subfeature_types[subfeature.category];
      if(!sft.active) { continue; }

      var fs = subfeature.start;
      var fe = subfeature.end;
      if((subfeature.category == "block") || (subfeature.category == "exon")) {
        if(thickstart == thickend) { continue; }
        if(fe < thickstart) { continue; }
        if(fs > thickend) { continue; }
        if(fs < thickstart) { fs = thickstart; }
        if(fe > thickend)   { fe = thickend; }
      }
      var cs = fs - feature.start;
      var ce = fe - feature.start + 1;
      if(strand=="-") {
        cs = feature.end - fe;
        ce = feature.end - fs + 1;
      }

      //subseq_pos needs new logic now based on strand
      if(subseq_pos > ce) { 
        //console.log("  skip ce:"+ce+" <=  prev_ce:"+subseq_pos);
        continue;
      }
      if(subseq_pos > cs) { 
        //console.log("  readjust cs:"+cs+"  prev_ce:"+subseq_pos);
        cs = subseq_pos; 
      }
      //console.log("  extract subseq ["+subfeature.category+" "+subfeature.start+".."+subfeature.end+"] fs:"+fs+" fe"+fe+" cs:"+cs+" ce:"+ce);
      //subseq += sequence.substring(cs,ce);
      var tseq = sequence.substring(cs,ce);
      subseq_len += tseq.length;
      if(strand=="-") { subseq_pos = cs; } else { subseq_pos = ce; }
      if(subfeature.category == "intron") { tseq = tseq.toLowerCase(); }
      
      //var seqstyle = "color:black;";
      //switch(subfeature.category) {
      //  case "block":
      //  case "exon":
      //  case "CDS":
      //    seqstyle = "color:black;";
      //    break;
      //  case "UTR":
      //    seqstyle = "color:orange;";
      //    //tseq = tseq.toLowerCase();
      //    break;
      //  case "5utr":
      //    seqstyle = "color:orange;";
      //    //tseq = tseq.toLowerCase();
      //    break;
      //  case "3utr":
      //    seqstyle = "color:chocolate";
      //    //tseq = tseq.toLowerCase();
      //    break;
      //  case "start_codon":
      //    seqstyle = "color:green;";
      //    break;
      //  case "stop_codon":
      //    seqstyle = "color:red;";
      //    break;
      //  case "intron":
      //    seqstyle = "color:lightgray;";
      //    tseq = tseq.toLowerCase();
      //    break;
      //  default:
      //    break;
      //}
      var span1 = seqBox.appendChild(document.createElement('span'));
      //span1.setAttribute('style', seqstyle);
      span1.style.color = sft.color;
      span1.innerHTML = tseq;
    }
    //sequence = subseq;
    //if(strand=="-") { sequence = sequence.split("").reverse().join(""); }
    //if(strand=="-") { subfeats = subfeats.reverse(); }
    //subfeats.sort(feature_loc_sort_func);
  }
  else {
    //genomic
    seqBox.innerHTML = sequence;
  } 
  */
  
  var len = subseq_len;
  if(len > 1000000) {
    len = Math.round(len/1000);
    len = len/1000.0;
    len += " mb";
  }
  else if(len > 1000) {
    //len = Math.round(len/100);
    len = len/1000.0;
    len += " kb";
  }
  else { len += " bp"; }
  //seqlen_span.innerHTML = " [seq "+ len+"]";
  seqlen_span.innerHTML = " [seq "+ subseq_len + "bp]";
}


function zenbuFeatureInfoSequenceFilter(subtype) {
  var info_div = document.getElementById("feature_info");
  if(!info_div) { return; }
  if(!info_div.subfeature_types) { return; }

  var main_sft = info_div.subfeature_types[subtype];
  if(!main_sft) { return; }
  main_sft.active = !main_sft.active;
  console.log("change type ["+subtype+"]");
  if(subtype == "genomic") {
    for(var st in info_div.subfeature_types) {
      var sft2 = info_div.subfeature_types[st];
      if(sft2.type !="genomic") { sft2.active = !main_sft.active; }
    }
  }

  //if non-genomic selected, turn off genomic
  var genomic_sft = info_div.subfeature_types["genomic"];
  if((subtype != "genomic") && main_sft.active) {
    if(genomic_sft) { genomic_sft.active = false; }
  }

  //if nothing selected, then activate the genomic
  var something=false;
  for(var st in info_div.subfeature_types) {
    var sft2 = info_div.subfeature_types[st];
    if((sft2.type !="genomic") && sft2.active) { something = true; }
  }
  if(!something && genomic_sft) { genomic_sft.active = true; }

  zenbuFeatureInfoShowSequence(true);
}
