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

var zenbuColorSpaces = new Object();
var zenbuColorSpaceInterface_hash = new Object();  //global hash of all CSI

//zenbuInitColorSpaces();
//var csi1 = zenbuColorSpaceInterface(uniqID);
//csi.colorspace = "fire1";
//csi.enableScaling = true;
//csi.min_signal = 0;
//csi.max_signal = 100;
//csi.logscale = true;
//zenbuColorSpaceInterfaceUpdate(uniqID);


function zenbuColorSpaceInterface(uniqID) {
  if(!uniqID) { uniqID = "zenbuCSI"+ createUUID(); }

  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];

  if(!zenbuCSI) {
    console.log("zenbuColorSpaceInterface ["+uniqID+"] create new widget");
    zenbuCSI = document.createElement('div');
    zenbuCSI.id = uniqID;
    zenbuCSI.setAttribute('style', "width:100%;");
    zenbuCSI.innerHTML = "";

    //init variables here
    zenbuCSI.label = "color:";
    zenbuCSI.colorspace = "fire1";
    zenbuCSI.single_color = "#0000FF";
    zenbuCSI.category_dtype = undefined;
    zenbuCSI.enableScaling = true;
    zenbuCSI.showLogScale = true;
    zenbuCSI.showInvert = true;
    zenbuCSI.showZeroCenter = true;
    zenbuCSI.min_signal = "auto";
    zenbuCSI.max_signal = "auto";
    zenbuCSI.signalRangeMin = undefined;
    zenbuCSI.signalRangeMax = undefined;
    zenbuCSI.logscale = false;
    zenbuCSI.invert = false;
    zenbuCSI.gradientSegLen = 42;
    zenbuCSI.callOutFunction = null; //zenbuCSI.callOutFunction(zenbuCSI.id, mode, param, value, altvalue);

    zenbuCSI.newconfig = new Object();

    zenbuColorSpaceInterface_hash[uniqID] = zenbuCSI;
  }
  //zenbuColorSpaceInterfaceUpdate(uniqID);

  return zenbuCSI;
}


function zenbuColorSpaceInterfaceUpdate(uniqID) {
  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];
  if(!zenbuCSI) { return; }

  var colorspace = zenbuCSI.colorspace;
  if(zenbuCSI.newconfig && (zenbuCSI.newconfig.colorspace !== undefined)) { colorspace = zenbuCSI.newconfig.colorspace; }
  var colorSpc = zenbuColorSpaces[colorspace];
  if(!colorSpc && colorspace && (colorspace.charAt(0) == "#")) {
    //special code for single-color init
    var color = colorspace;
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(.*)$/i.exec(color);
    if(result) {
      var r = parseInt(result[1], 16);
      var g = parseInt(result[2], 16);
      var b = parseInt(result[3], 16);
      if(result[4] == " spectrum") {
        colorspace = "user-color";
        zenbuCSI.single_color = "#"+ result[1] + result[2] + result[3] ;
        colorSpc = zenbuColorSpaces["user-color"];
        colorSpc.colors = new Array();
        colorSpc.colors.push(new RGBColour(240, 240, 240)); //gray
        colorSpc.colors.push(new RGBColour(r,g,b));
        console.log("zenbuCSI.colorspace["+uniqID+"] init is user-color["+color+"] -> ["+(colorSpc.colors[1].getCSSHexadecimalRGB())+"]");
      } else {
        colorspace = "single-color";
        zenbuCSI.single_color = color;
        colorSpc = zenbuColorSpaces["single-color"];
        colorSpc.colors[0] = new RGBColour(r,g,b);
        console.log("zenbuCSI.colorspace["+uniqID+"] init is single-color["+color+"] -> ["+(colorSpc.colors[0].getCSSHexadecimalRGB())+"]");
      }
    }    
  }
  if(!colorspace || !colorSpc) {
    colorspace = "fire1";
    if(zenbuCSI.newconfig) { zenbuCSI.newconfig.colorspace = "fire1"; }
  }

  var discrete = zenbuCSI.colorspace_discrete;
  if(zenbuCSI.newconfig && (zenbuCSI.newconfig.colorspace_discrete !== undefined)) { discrete = zenbuCSI.newconfig.colorspace_discrete; }
  if(!discrete) { discrete = zenbuColorSpaces[colorspace].discrete; }
 
  var logscale = zenbuCSI.logscale;
  if(zenbuCSI.newconfig && (zenbuCSI.newconfig.logscale !== undefined)) { logscale = zenbuCSI.newconfig.logscale; }
  var min_signal = zenbuCSI.min_signal;
  if(zenbuCSI.newconfig && zenbuCSI.newconfig.min_signal != undefined) { min_signal = zenbuCSI.newconfig.min_signal; }
  var max_signal = zenbuCSI.max_signal;
  if(zenbuCSI.newconfig && zenbuCSI.newconfig.max_signal != undefined) { max_signal = zenbuCSI.newconfig.max_signal; }
  var invert = zenbuCSI.invert;
  if(zenbuCSI.newconfig && (zenbuCSI.newconfig.invert !== undefined)) { invert = zenbuCSI.newconfig.invert; }
  var zero_center = zenbuCSI.zero_center;
  if(zenbuCSI.newconfig && (zenbuCSI.newconfig.zero_center !== undefined)) { zero_center = zenbuCSI.newconfig.zero_center; }

  zenbuCSI.style.width = "100%";
  zenbuCSI.innerHTML = "";

  //console.log("reportElementColorSpaceOptions colorspace["+colorspace+"]");
  var colorcat = "zenbu-spectrum";
  var colordepth = "";
  var colorprefix = colorspace;
  if(colorspace == "single-color") { colorcat = "single-color"; }
  if(colorspace == "category-colors") { colorcat = "category-colors"; }
  if(colorspace.match(/_bp_/)) {
    var colorSpc = zenbuColorSpaces[colorspace];
    if(colorSpc) {
      colorcat = colorSpc.colorcat;
      
      var idx1 = colorspace.indexOf('_bp_');
      if(idx1 > 0) {
        colordepth = colorspace.substr(idx1+4);
        colorprefix = colorspace.substr(0,idx1);
      }
    }
  }
  //console.log("colorspace["+colorspace+"]  prefix["+colorprefix+"]  depth["+colordepth+"]");

  //first colorspace_category
  var div1 = zenbuCSI.appendChild(document.createElement('div'));
  var span1 = div1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "margin: 0px 0px 0px 0px;");
  span1.appendChild(document.createTextNode(zenbuCSI.label));

  var select = div1.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttributeNS(null, "onchange", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'colorspace_category', this.value);");
  var ccats = ["single-color", "brewer-sequential", "brewer-diverging", "brewer-qualitative", "zenbu-spectrum"];
  if(zenbuCSI.category_dtype) { ccats.push("category-colors"); }
  for(var i=0; i<ccats.length; i++) {
    var ccat = ccats[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", ccat);
    if(ccat == colorcat) { option.setAttribute("selected", "selected"); }
    option.innerHTML = ccat;
  }

  //single-color mode
  if(colorcat == "single-color") {    
    var single_color = zenbuCSI.single_color;
    if(zenbuCSI.newconfig && zenbuCSI.newconfig.single_color != undefined) { single_color = zenbuCSI.newconfig.single_color; }
    var colorInput = div1.appendChild(document.createElement('input'));
    colorInput.setAttribute('style', "margin:1px 0px 0px 5px; ");
    colorInput.setAttribute('value', single_color);
    colorInput.setAttribute('size', "5");
    colorInput.setAttributeNS(null, "onchange", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'single_color', this.value);");
    if(zenbuCSI.color_picker) { zenbuCSI.color_picker.hidePicker(); } //hide old picker
    zenbuCSI.color_picker = new jscolor.color(colorInput);
    return;
  }

  if(colorcat == "category-colors") {
    var catColorDiv = div1.appendChild(document.createElement('div'));
    if(!zenbuCSI.category_dtype || !zenbuCSI.category_dtype.categories) {
      catColorDiv.style = "margin-left:10px;";
      catColorDiv.innerHTML = "please select category to edit category-colors";
      return;
    }
      
    var categories = zenbuCSI.category_dtype.categories;
    var category_array = [];
    for(var ctg in categories) { 
      var ctg_obj = categories[ctg];
      category_array.push(ctg_obj);
    }
    //sort?

    var table1 = catColorDiv.appendChild(document.createElement('table'));
    for(var ctg_idx=0; ctg_idx<category_array.length; ctg_idx++){
      var ctg_obj = category_array[ctg_idx];
      if(!ctg_obj) { continue; }
      
      var tr1 = table1.appendChild(document.createElement('tr'));

      //var rowdiv = catColorDiv.appendChild(document.createElement('div'));
      var td1 = tr1.appendChild(document.createElement('td'));
      var span1 = td1.appendChild(document.createElement('span'));
      span1.style = "margin-left:10px; font-size:10px; font-style:italic;";
      span1.innerHTML = ctg_obj.ctg;
      
      var fixed_color = this.default_node_color;
      if(this.newconfig && this.newconfig.default_node_color != undefined) { fixed_color = this.newconfig.default_node_color; }
      if(!ctg_obj.color) { ctg_obj.color = fixed_color; }

      var td2 = tr1.appendChild(document.createElement('td'));
      td2.style = "padding-left:10px";

      var colorInput = td2.appendChild(document.createElement('input'));
      colorInput.setAttribute('value', ctg_obj.color);
      colorInput.setAttribute('size', "7");
      colorInput.setAttribute("onchange", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id +"\", 'ctg_color', this.value, '"+  ctg_obj.ctg +"');");
      if(ctg_obj.fixed_color_picker) { ctg_obj.fixed_color_picker.hidePicker(); } //hide old picker
      ctg_obj.fixed_color_picker = new jscolor.color(colorInput);
      td2.appendChild(colorInput);
    }
    return;
  }

  //second the actual colorspace name
  var cdepths_hash = {};
  var cdepths = [];
  var csname_hash = {};
  var select = div1.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttributeNS(null, "onchange", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'colorspace', this.value);");
  for(var csname in zenbuColorSpaces){
    var colorSpc = zenbuColorSpaces[csname];
    if(colorSpc.colorcat != colorcat) { continue; }

    var dname = csname;
    var idx1 = dname.indexOf('_bp_');
    if(idx1 > 0) { dname = dname.substr(0, idx1); }

    if(dname == colorprefix) { cdepths_hash[colorSpc.bpdepth] = true; }
    
    if(csname_hash[dname]) { continue; }
    
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", csname);
    option.innerHTML = dname;
    if(dname == colorprefix) { option.setAttribute("selected", "selected"); }
    csname_hash[dname] = true;
  }
  for(var bpdepth in cdepths_hash) { cdepths.push(bpdepth); }

  //third the color depth for brewer palettes
  var span2 = div1.appendChild(document.createElement('span'));
  if(colorcat == "zenbu-spectrum") { span2.setAttribute("style", "display:none"); }
  var select = span2.appendChild(document.createElement('select'));
  select.className = "dropdown";
  //select.style.fontSize = "10px";
  select.setAttributeNS(null, "onchange", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'colorspace_depth', this.value);");
  for(var i=0; i<cdepths.length; i++) {
    var cdepth = cdepths[i];
    var option = select.appendChild(document.createElement('option'));
    option.setAttribute("value", cdepth);
    if(cdepth == colordepth) { option.setAttribute("selected", "selected"); }
    option.innerHTML = cdepth;
  }

  var div1b = zenbuCSI.appendChild(document.createElement('div'));
  div1b.style.marginLeft = "5px";

  if(zenbuCSI.showLogScale) {
    var span2 = div1b.appendChild(document.createElement('span'));
    var logCheck = span2.appendChild(document.createElement('input'));
    logCheck.setAttribute('style', "margin: 0px 1px 0px 5px;");
    logCheck.setAttribute('type', "checkbox");
    if(logscale) { logCheck.setAttribute('checked', "checked"); }
    logCheck.setAttribute("onclick", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'logscale', this.checked);");
    var span1 = span2.appendChild(document.createElement('span'));
    span1.innerHTML = "log scale";
  }
  
  if(zenbuCSI.showInvert) {
    var span2 = div1b.appendChild(document.createElement('span'));
    var invertCheck = span2.appendChild(document.createElement('input'));
    invertCheck.setAttribute('style', "margin: 0px 1px 0px 7px;");
    invertCheck.setAttribute('type', "checkbox");
    if(invert) { invertCheck.setAttribute('checked', "checked"); }
    invertCheck.setAttribute("onclick", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'invert', this.checked);");
    var span1 = span2.appendChild(document.createElement('span'));
    span1.innerHTML = "invert";
  }
  
  if(zenbuCSI.showZeroCenter) {
    var span3 = div1b.appendChild(document.createElement('span'));
    var invertCheck = span3.appendChild(document.createElement('input'));
    invertCheck.setAttribute('style', "margin: 0px 1px 0px 7px;");
    invertCheck.setAttribute('type', "checkbox");
    if(zero_center) { invertCheck.setAttribute('checked', "checked"); }
    invertCheck.setAttribute("onclick", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'zero_center', this.checked);");
    var span1 = span3.appendChild(document.createElement('span'));
    span1.innerHTML = "zero-center";
  }
  
  var single_color = zenbuCSI.single_color;
  if(zenbuCSI.newconfig && zenbuCSI.newconfig.single_color != undefined) { single_color = zenbuCSI.newconfig.single_color; }
  zenbuColorSpaceSetUserColor(single_color);

  //next line draw the color spectrum
  var div2 = zenbuCSI.appendChild(document.createElement('div'));
  div2.appendChild(zenbuMakeColorGradient(colorspace, discrete, logscale, invert, zenbuCSI.gradientSegLen));
  
  //zenbu spectrum user-color mode
  if(colorspace == "user-color") {    
    var colorInput = div2.appendChild(document.createElement('input'));
    colorInput.setAttribute('style', "margin:1px 0px 0px 5px; font-size:10px; ");
    colorInput.setAttribute('value', single_color);
    colorInput.setAttribute('size', "5");
    colorInput.setAttributeNS(null, "onchange", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'user_color', this.value);");
    if(zenbuCSI.color_picker) { zenbuCSI.color_picker.hidePicker(); } //hide old picker
    zenbuCSI.color_picker = new jscolor.color(colorInput);
  }

  if(zenbuCSI.enableScaling) {
    //a scaling value input
    var div2 = zenbuCSI.appendChild(document.createElement('div'));
    div2.setAttribute('style', "margin: 2px 0px 1px 7px;");
    var span4 = div2.appendChild(document.createElement('span'));
    span4.innerHTML = "min signal: ";
    var minInput = div2.appendChild(document.createElement('input'));
    minInput.className = "sliminput";
    minInput.setAttribute('size', "5");
    minInput.setAttribute('type', "text");
    minInput.setAttribute('value', min_signal);
    minInput.setAttribute("onkeyup", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'min_signal', this.value);");
    minInput.setAttribute("onkeydown", "if(event.keyCode==13) { zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'update'); }");
    minInput.setAttribute("onblur", "zenbuColorSpaceInterfaceReconfigParam(\""+zenbuCSI.id+"\", 'update');");
    if(zenbuCSI.signalRangeMin != undefined) {
      minInput.setAttribute("onmouseover", "eedbMessageTooltip('min signal: "+(zenbuCSI.signalRangeMin)+"',130);");
      minInput.setAttribute("onmouseout", "eedbClearSearchTooltip();");

    }

    var span4 = div2.appendChild(document.createElement('span'));
    span4.setAttribute('style', "margin-left: 3px;");
    span4.innerHTML = "max signal: ";
    var maxInput = div2.appendChild(document.createElement('input'));
    maxInput.className = "sliminput";
    maxInput.setAttribute('size', "5");
    maxInput.setAttribute('type', "text");
    maxInput.setAttribute('value', max_signal);
    maxInput.setAttribute("onkeyup", "zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'max_signal', this.value);");
    maxInput.setAttribute("onkeydown", "if(event.keyCode==13) { zenbuColorSpaceInterfaceReconfigParam(\""+ zenbuCSI.id+"\", 'update'); }");
    maxInput.setAttribute("onblur", "zenbuColorSpaceInterfaceReconfigParam(\""+zenbuCSI.id+"\", 'update');");
    if(zenbuCSI.signalRangeMax != undefined) {
      maxInput.setAttribute("onmouseover", "eedbMessageTooltip('max signal: "+(zenbuCSI.signalRangeMax)+"',130);");
      maxInput.setAttribute("onmouseout", "eedbClearSearchTooltip();");    
    }
        
    //var span2 = div2.appendChild(document.createElement('span'));
    //span2.setAttribute('style', "margin: 1px 2px 1px 3px;");
    //span2.innerHTML = "experiment merge:";
    //div2.appendChild(createExperimentMergeSelect(zenbuCSI.id));
  }
}


function zenbuColorSpaceInterfaceReconfigParam(uniqID, param, value, altvalue) {
  var zenbuCSI = zenbuColorSpaceInterface_hash[uniqID];
  if(!zenbuCSI) { return; }
  //console.log("zenbuColorSpaceInterfaceReconfigParam["+uniqID+"] "+param+" value="+value+"  altvalue="+altvalue);

  if(zenbuCSI.newconfig === undefined) {
    zenbuCSI.newconfig = new Object;
  }
  var newconfig = zenbuCSI.newconfig;

  if(param == "min_signal") {  
    newconfig.min_signal = parseFloat(value); 
    if(isNaN(newconfig.min_signal)) { newconfig.min_signal = "auto"; } 
    else {
      if((zenbuCSI.signalRangeMin!=undefined) && (newconfig.min_signal < zenbuCSI.signalRangeMin)) {
        console.log("zenbuColorSpace trying to set min_signal to "+newconfig.min_signal+" while signalRangeMin="+zenbuCSI.signalRangeMin);
        //newconfig.min_signal = "auto";
      }
    }
    return true;
  }
  if(param == "max_signal") {
    newconfig.max_signal = parseFloat(value); 
    if(isNaN(newconfig.max_signal)) { newconfig.max_signal = "auto"; } 
    else {
      if((zenbuCSI.signalRangeMax!=undefined) && (newconfig.max_signal > zenbuCSI.signalRangeMax)) {
        console.log("zenbuColorSpace trying to set max_signal to "+newconfig.max_signal+" while signalRangeMax="+zenbuCSI.signalRangeMax);
        //newconfig.max_signal = "auto";
      }
    }
    return true;
  }
  
  if(param == "logscale") { 
    if(value) { newconfig.logscale=1; }
    else { newconfig.logscale = 0; }
  }
  if(param == "invert") { 
    if(value) { newconfig.invert=1; }
    else { newconfig.invert = 0; }
  }
  if(param == "zero_center") { 
    if(value) { newconfig.zero_center=1; }
    else { newconfig.zero_center = 0; }
  }
  
  if(param == "ctg_color") { //set category value specific color
    if(!value) { value = "#0000A0"; }
    if(value.charAt(0) != "#") { value = "#"+value; }
    if(zenbuCSI.category_dtype && zenbuCSI.category_dtype.categories) {
      zenbuCSI.category_dtype.categories[altvalue].color = value;
      newconfig.category_colors_changed = true;
    }
  }

  if(param == "colorspace") {  
    newconfig.colorspace = value;
    var colorSpc = zenbuColorSpaces[value];
    if(!colorSpc && value.length==6) {
      var color = value;
      if(color.charAt(0)!="#") { color = "#"+color; }
      newconfig.colorspace = color;
      newconfig.single_color = color;
      // var colorSpc = zenbuColorSpaces["single-color"];
      // var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(.*)$/i.exec(color);
      // if(result) {
      //   var r = parseInt(result[1], 16);
      //   var g = parseInt(result[2], 16);
      //   var b = parseInt(result[3], 16);
      //   colorSpc.colors[0] = new RGBColour(r,g,b);
      // }
      // console.log("colorspace is single-color["+color+"]  -> ["+(colorSpc.colors[0].getCSSHexadecimalRGB())+"]");
    }
  }
  if(param == "single_color") {  
    var color = value;
    if(color.charAt(0)!="#") { color = "#"+color; }
    newconfig.colorspace = color;
    newconfig.single_color = color;
  }
  if(param == "user_color") {  
    var color = value;
    if(color.charAt(0)!="#") { color = "#"+color; }
    newconfig.colorspace = color + " spectrum";
    newconfig.single_color = color;
    zenbuColorSpaceSetUserColor(color);
  }
  if(param == "colorspace_discrete") {  
    newconfig.colorMode = "signal";
    newconfig.colorspace_discrete = value;
  }
  if(param == "colorspace_category") {  
    newconfig.colorspace_category = value;
    if(value == "single-color") {
      //newconfig.colorspace = "single-color";
      if(newconfig.single_color === undefined) { newconfig.single_color = zenbuCSI.single_color; }
      newconfig.colorspace = newconfig.single_color;
      console.log("switch colorspace_category[single-color] : "+ newconfig.colorspace);
    }
    if(value == "brewer-sequential") {
      newconfig.colorspace = "BuGn_bp_7";
    }
    if(value == "brewer-diverging") {
      newconfig.colorspace = "BrBG_bp_7";
    }
    if(value == "brewer-qualitative") {
      newconfig.colorspace = "Accent_bp_7";
    }
    if(value == "zenbu-spectrum") { 
      newconfig.colorspace = "fire1";
    }
    if(value == "category-colors") { 
      newconfig.colorspace = "category-colors";
    }
    var colorspec = zenbuColorSpaces[newconfig.colorspace];
    if(colorspec) { newconfig.colorspace_discrete = colorspec.discrete; }
  }
  if(param == "colorspace_depth") {  
    //modify the color
    var csname = newconfig.colorspace;
    if(!csname) { 
      csname = zenbuCSI.colorspace; 
      newconfig.colorspace = csname;
    }
    var colorspec = zenbuColorSpaces[csname];
    var idx1 = csname.indexOf('_bp_');
    if(idx1 > 0) { 
      csname = csname.substr(0, idx1+4); 
      csname += value
      if(zenbuColorSpaces[csname]) { newconfig.colorspace = csname; }
      else {
        for(var cn in zenbuColorSpaces){
          var cspc2 = zenbuColorSpaces[cn];
          if(cspc2.colorcat != colorspec.colorcat) { continue; }
          if(cspc2.bpdepth != value) { continue; }
          newconfig.colorspace = cn;
          break;
        }
      }
    }
    var colorspec = zenbuColorSpaces[newconfig.colorspace];
    newconfig.colorspace_discrete = colorspec.discrete;
  }

  if(zenbuCSI.callOutFunction) { 
    zenbuCSI.callOutFunction(uniqID, "reconfig_param", param, value, altvalue);
  }
  if((param == "min_signal") || (param == "max_signal")) { return; }

  zenbuColorSpaceInterfaceUpdate(uniqID); //refresh
}



function zenbuInitColorSpaces() {
  zenbuColorSpaces = new Object();
  
  //first the brewer palette colors
  var brewer_palette = {"Spectral":  {3: ['rgb(252,141,89)', 'rgb(255,255,191)', 'rgb(153,213,148)'], 4: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(171,221,164)', 'rgb(43,131,186)'], 5: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(255,255,191)', 'rgb(171,221,164)', 'rgb(43,131,186)'], 6: ['rgb(213,62,79)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(230,245,152)', 'rgb(153,213,148)', 'rgb(50,136,189)'], 7: ['rgb(213,62,79)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(230,245,152)', 'rgb(153,213,148)', 'rgb(50,136,189)'], 8: ['rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)'], 9: ['rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)'], 10: ['rgb(158,1,66)', 'rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)', 'rgb(94,79,162)'], 11: ['rgb(158,1,66)', 'rgb(213,62,79)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(230,245,152)', 'rgb(171,221,164)', 'rgb(102,194,165)', 'rgb(50,136,189)', 'rgb(94,79,162)'], 'type': 'div'} ,
    "RdYlGn":  {3: ['rgb(252,141,89)', 'rgb(255,255,191)', 'rgb(145,207,96)'], 4: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(166,217,106)', 'rgb(26,150,65)'], 5: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(255,255,191)', 'rgb(166,217,106)', 'rgb(26,150,65)'], 6: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(217,239,139)', 'rgb(145,207,96)', 'rgb(26,152,80)'], 7: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(217,239,139)', 'rgb(145,207,96)', 'rgb(26,152,80)'], 8: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)'], 9: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)'], 10: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)', 'rgb(0,104,55)'], 11: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,139)', 'rgb(255,255,191)', 'rgb(217,239,139)', 'rgb(166,217,106)', 'rgb(102,189,99)', 'rgb(26,152,80)', 'rgb(0,104,55)'], 'type': 'div'} ,
    "RdBu":  {3: ['rgb(239,138,98)', 'rgb(247,247,247)', 'rgb(103,169,207)'], 4: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(146,197,222)', 'rgb(5,113,176)'], 5: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(247,247,247)', 'rgb(146,197,222)', 'rgb(5,113,176)'], 6: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(209,229,240)', 'rgb(103,169,207)', 'rgb(33,102,172)'], 7: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(247,247,247)', 'rgb(209,229,240)', 'rgb(103,169,207)', 'rgb(33,102,172)'], 8: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)'], 9: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(247,247,247)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)'], 10: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)', 'rgb(5,48,97)'], 11: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(247,247,247)', 'rgb(209,229,240)', 'rgb(146,197,222)', 'rgb(67,147,195)', 'rgb(33,102,172)', 'rgb(5,48,97)'], 'type': 'div'} ,
    "PiYG":  {3: ['rgb(233,163,201)', 'rgb(247,247,247)', 'rgb(161,215,106)'], 4: ['rgb(208,28,139)', 'rgb(241,182,218)', 'rgb(184,225,134)', 'rgb(77,172,38)'], 5: ['rgb(208,28,139)', 'rgb(241,182,218)', 'rgb(247,247,247)', 'rgb(184,225,134)', 'rgb(77,172,38)'], 6: ['rgb(197,27,125)', 'rgb(233,163,201)', 'rgb(253,224,239)', 'rgb(230,245,208)', 'rgb(161,215,106)', 'rgb(77,146,33)'], 7: ['rgb(197,27,125)', 'rgb(233,163,201)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(230,245,208)', 'rgb(161,215,106)', 'rgb(77,146,33)'], 8: ['rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)'], 9: ['rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)'], 10: ['rgb(142,1,82)', 'rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)', 'rgb(39,100,25)'], 11: ['rgb(142,1,82)', 'rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(230,245,208)', 'rgb(184,225,134)', 'rgb(127,188,65)', 'rgb(77,146,33)', 'rgb(39,100,25)'], 'type': 'div'} ,
    "PiBu":  {3: ['rgb(233,163,201)', 'rgb(247,247,247)', 'rgb(145,191,219)'], 4: ['rgb(208,28,139)', 'rgb(241,182,218)', 'rgb(171,217,233)', 'rgb(44,123,182)'], 5: ['rgb(208,28,139)', 'rgb(241,182,218)', 'rgb(247,247,247)', 'rgb(171,217,233)', 'rgb(44,123,182)'], 6: ['rgb(197,27,125)', 'rgb(233,163,201)', 'rgb(253,224,239)', 'rgb(224,243,248)', 'rgb(145,191,219)', 'rgb(69,117,180)'], 7: ['rgb(197,27,125)', 'rgb(233,163,201)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(224,243,248)', 'rgb(145,191,219)', 'rgb(69,117,180)'], 8: ['rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)'], 9: ['rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)'], 10: ['rgb(142,1,82)', 'rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)', 'rgb(49,54,149)'], 11: ['rgb(142,1,82)', 'rgb(197,27,125)', 'rgb(222,119,174)', 'rgb(241,182,218)', 'rgb(253,224,239)', 'rgb(247,247,247)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)', 'rgb(49,54,149)'], 'type': 'div'} ,
    "PRGn":  {3: ['rgb(175,141,195)', 'rgb(247,247,247)', 'rgb(127,191,123)'], 4: ['rgb(123,50,148)', 'rgb(194,165,207)', 'rgb(166,219,160)', 'rgb(0,136,55)'], 5: ['rgb(123,50,148)', 'rgb(194,165,207)', 'rgb(247,247,247)', 'rgb(166,219,160)', 'rgb(0,136,55)'], 6: ['rgb(118,42,131)', 'rgb(175,141,195)', 'rgb(231,212,232)', 'rgb(217,240,211)', 'rgb(127,191,123)', 'rgb(27,120,55)'], 7: ['rgb(118,42,131)', 'rgb(175,141,195)', 'rgb(231,212,232)', 'rgb(247,247,247)', 'rgb(217,240,211)', 'rgb(127,191,123)', 'rgb(27,120,55)'], 8: ['rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)'], 9: ['rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(247,247,247)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)'], 10: ['rgb(64,0,75)', 'rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)', 'rgb(0,68,27)'], 11: ['rgb(64,0,75)', 'rgb(118,42,131)', 'rgb(153,112,171)', 'rgb(194,165,207)', 'rgb(231,212,232)', 'rgb(247,247,247)', 'rgb(217,240,211)', 'rgb(166,219,160)', 'rgb(90,174,97)', 'rgb(27,120,55)', 'rgb(0,68,27)'], 'type': 'div'} ,
    "RdYlBu":  {3: ['rgb(252,141,89)', 'rgb(255,255,191)', 'rgb(145,191,219)'], 4: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(171,217,233)', 'rgb(44,123,182)'], 5: ['rgb(215,25,28)', 'rgb(253,174,97)', 'rgb(255,255,191)', 'rgb(171,217,233)', 'rgb(44,123,182)'], 6: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,144)', 'rgb(224,243,248)', 'rgb(145,191,219)', 'rgb(69,117,180)'], 7: ['rgb(215,48,39)', 'rgb(252,141,89)', 'rgb(254,224,144)', 'rgb(255,255,191)', 'rgb(224,243,248)', 'rgb(145,191,219)', 'rgb(69,117,180)'], 8: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)'], 9: ['rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(255,255,191)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)'], 10: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)', 'rgb(49,54,149)'], 11: ['rgb(165,0,38)', 'rgb(215,48,39)', 'rgb(244,109,67)', 'rgb(253,174,97)', 'rgb(254,224,144)', 'rgb(255,255,191)', 'rgb(224,243,248)', 'rgb(171,217,233)', 'rgb(116,173,209)', 'rgb(69,117,180)', 'rgb(49,54,149)'], 'type': 'div'} ,
    "BrBG":  {3: ['rgb(216,179,101)', 'rgb(245,245,245)', 'rgb(90,180,172)'], 4: ['rgb(166,97,26)', 'rgb(223,194,125)', 'rgb(128,205,193)', 'rgb(1,133,113)'], 5: ['rgb(166,97,26)', 'rgb(223,194,125)', 'rgb(245,245,245)', 'rgb(128,205,193)', 'rgb(1,133,113)'], 6: ['rgb(140,81,10)', 'rgb(216,179,101)', 'rgb(246,232,195)', 'rgb(199,234,229)', 'rgb(90,180,172)', 'rgb(1,102,94)'], 7: ['rgb(140,81,10)', 'rgb(216,179,101)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(90,180,172)', 'rgb(1,102,94)'], 8: ['rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)'], 9: ['rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)'], 10: ['rgb(84,48,5)', 'rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)', 'rgb(0,60,48)'], 11: ['rgb(84,48,5)', 'rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)', 'rgb(0,60,48)'], 'type': 'div'} ,
    "RdGy":  {3: ['rgb(239,138,98)', 'rgb(255,255,255)', 'rgb(153,153,153)'], 4: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(186,186,186)', 'rgb(64,64,64)'], 5: ['rgb(202,0,32)', 'rgb(244,165,130)', 'rgb(255,255,255)', 'rgb(186,186,186)', 'rgb(64,64,64)'], 6: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(224,224,224)', 'rgb(153,153,153)', 'rgb(77,77,77)'], 7: ['rgb(178,24,43)', 'rgb(239,138,98)', 'rgb(253,219,199)', 'rgb(255,255,255)', 'rgb(224,224,224)', 'rgb(153,153,153)', 'rgb(77,77,77)'], 8: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)'], 9: ['rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(255,255,255)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)'], 10: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)', 'rgb(26,26,26)'], 11: ['rgb(103,0,31)', 'rgb(178,24,43)', 'rgb(214,96,77)', 'rgb(244,165,130)', 'rgb(253,219,199)', 'rgb(255,255,255)', 'rgb(224,224,224)', 'rgb(186,186,186)', 'rgb(135,135,135)', 'rgb(77,77,77)', 'rgb(26,26,26)'], 'type': 'div'} ,
    "PuOr":  {3: ['rgb(241,163,64)', 'rgb(247,247,247)', 'rgb(153,142,195)'], 4: ['rgb(230,97,1)', 'rgb(253,184,99)', 'rgb(178,171,210)', 'rgb(94,60,153)'], 5: ['rgb(230,97,1)', 'rgb(253,184,99)', 'rgb(247,247,247)', 'rgb(178,171,210)', 'rgb(94,60,153)'], 6: ['rgb(179,88,6)', 'rgb(241,163,64)', 'rgb(254,224,182)', 'rgb(216,218,235)', 'rgb(153,142,195)', 'rgb(84,39,136)'], 7: ['rgb(179,88,6)', 'rgb(241,163,64)', 'rgb(254,224,182)', 'rgb(247,247,247)', 'rgb(216,218,235)', 'rgb(153,142,195)', 'rgb(84,39,136)'], 8: ['rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)'], 9: ['rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(247,247,247)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)'], 10: ['rgb(127,59,8)', 'rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)', 'rgb(45,0,75)'], 11: ['rgb(127,59,8)', 'rgb(179,88,6)', 'rgb(224,130,20)', 'rgb(253,184,99)', 'rgb(254,224,182)', 'rgb(247,247,247)', 'rgb(216,218,235)', 'rgb(178,171,210)', 'rgb(128,115,172)', 'rgb(84,39,136)', 'rgb(45,0,75)'], 'type': 'div'} ,
    
    "Accent":  {3: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)'], 4: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)'], 5: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)'], 6: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)', 'rgb(240,2,127)'], 7: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)', 'rgb(240,2,127)', 'rgb(191,91,23)'], 8: ['rgb(127,201,127)', 'rgb(190,174,212)', 'rgb(253,192,134)', 'rgb(255,255,153)', 'rgb(56,108,176)', 'rgb(240,2,127)', 'rgb(191,91,23)', 'rgb(102,102,102)'], 'type': 'qual'} ,
    "Set1":  {3: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)'], 4: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)'], 5: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)'], 6: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)'], 7: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)'], 8: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)', 'rgb(247,129,191)'], 9: ['rgb(228,26,28)', 'rgb(55,126,184)', 'rgb(77,175,74)', 'rgb(152,78,163)', 'rgb(255,127,0)', 'rgb(255,255,51)', 'rgb(166,86,40)', 'rgb(247,129,191)', 'rgb(153,153,153)'], 'type': 'qual'} ,
    "Set2":  {3: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)'], 4: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)'], 5: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)'], 6: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)', 'rgb(255,217,47)'], 7: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)', 'rgb(255,217,47)', 'rgb(229,196,148)'], 8: ['rgb(102,194,165)', 'rgb(252,141,98)', 'rgb(141,160,203)', 'rgb(231,138,195)', 'rgb(166,216,84)', 'rgb(255,217,47)', 'rgb(229,196,148)', 'rgb(179,179,179)'], 'type': 'qual'} ,
    "Set3":  {3: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)'], 4: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)'], 5: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)'], 6: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)'], 7: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)'], 8: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)'], 9: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)'], 10: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)', 'rgb(188,128,189)'], 11: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)', 'rgb(188,128,189)', 'rgb(204,235,197)'], 12: ['rgb(141,211,199)', 'rgb(255,255,179)', 'rgb(190,186,218)', 'rgb(251,128,114)', 'rgb(128,177,211)', 'rgb(253,180,98)', 'rgb(179,222,105)', 'rgb(252,205,229)', 'rgb(217,217,217)', 'rgb(188,128,189)', 'rgb(204,235,197)', 'rgb(255,237,111)'], 'type': 'qual'} ,
    "Dark2":  {3: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)'], 4: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)'], 5: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)'], 6: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)', 'rgb(230,171,2)'], 7: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)', 'rgb(230,171,2)', 'rgb(166,118,29)'], 8: ['rgb(27,158,119)', 'rgb(217,95,2)', 'rgb(117,112,179)', 'rgb(231,41,138)', 'rgb(102,166,30)', 'rgb(230,171,2)', 'rgb(166,118,29)', 'rgb(102,102,102)'], 'type': 'qual'} ,
    "Paired":  {3: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)'], 4: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)'], 5: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)'], 6: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)'], 7: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)'], 8: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)'], 9: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)'], 10: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)'], 11: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)', 'rgb(255,255,153)'], 12: ['rgb(166,206,227)', 'rgb(31,120,180)', 'rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)', 'rgb(255,255,153)', 'rgb(177,89,40)'], 'type': 'qual'} ,
    "Pastel2":  {3: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)'], 4: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)'], 5: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)'], 6: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)', 'rgb(255,242,174)'], 7: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)', 'rgb(255,242,174)', 'rgb(241,226,204)'], 8: ['rgb(179,226,205)', 'rgb(253,205,172)', 'rgb(203,213,232)', 'rgb(244,202,228)', 'rgb(230,245,201)', 'rgb(255,242,174)', 'rgb(241,226,204)', 'rgb(204,204,204)'], 'type': 'qual'} ,
    "Pastel1":  {3: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)'], 4: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)'], 5: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)'], 6: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)'], 7: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)', 'rgb(229,216,189)'], 8: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)', 'rgb(229,216,189)', 'rgb(253,218,236)'], 9: ['rgb(251,180,174)', 'rgb(179,205,227)', 'rgb(204,235,197)', 'rgb(222,203,228)', 'rgb(254,217,166)', 'rgb(255,255,204)', 'rgb(229,216,189)', 'rgb(253,218,236)', 'rgb(242,242,242)'], 'type': 'qual'} ,
    
    "OrRd":  {3: ['rgb(254,232,200)', 'rgb(253,187,132)', 'rgb(227,74,51)'], 4: ['rgb(254,240,217)', 'rgb(253,204,138)', 'rgb(252,141,89)', 'rgb(215,48,31)'], 5: ['rgb(254,240,217)', 'rgb(253,204,138)', 'rgb(252,141,89)', 'rgb(227,74,51)', 'rgb(179,0,0)'], 6: ['rgb(254,240,217)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(227,74,51)', 'rgb(179,0,0)'], 7: ['rgb(254,240,217)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(239,101,72)', 'rgb(215,48,31)', 'rgb(153,0,0)'], 8: ['rgb(255,247,236)', 'rgb(254,232,200)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(239,101,72)', 'rgb(215,48,31)', 'rgb(153,0,0)'], 9: ['rgb(255,247,236)', 'rgb(254,232,200)', 'rgb(253,212,158)', 'rgb(253,187,132)', 'rgb(252,141,89)', 'rgb(239,101,72)', 'rgb(215,48,31)', 'rgb(179,0,0)', 'rgb(127,0,0)'], 'type': 'seq'} ,
    "PuBu":  {3: ['rgb(236,231,242)', 'rgb(166,189,219)', 'rgb(43,140,190)'], 4: ['rgb(241,238,246)', 'rgb(189,201,225)', 'rgb(116,169,207)', 'rgb(5,112,176)'], 5: ['rgb(241,238,246)', 'rgb(189,201,225)', 'rgb(116,169,207)', 'rgb(43,140,190)', 'rgb(4,90,141)'], 6: ['rgb(241,238,246)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(43,140,190)', 'rgb(4,90,141)'], 7: ['rgb(241,238,246)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(54,144,192)', 'rgb(5,112,176)', 'rgb(3,78,123)'], 8: ['rgb(255,247,251)', 'rgb(236,231,242)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(54,144,192)', 'rgb(5,112,176)', 'rgb(3,78,123)'], 9: ['rgb(255,247,251)', 'rgb(236,231,242)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(116,169,207)', 'rgb(54,144,192)', 'rgb(5,112,176)', 'rgb(4,90,141)', 'rgb(2,56,88)'], 'type': 'seq'} ,
    "BuPu":  {3: ['rgb(224,236,244)', 'rgb(158,188,218)', 'rgb(136,86,167)'], 4: ['rgb(237,248,251)', 'rgb(179,205,227)', 'rgb(140,150,198)', 'rgb(136,65,157)'], 5: ['rgb(237,248,251)', 'rgb(179,205,227)', 'rgb(140,150,198)', 'rgb(136,86,167)', 'rgb(129,15,124)'], 6: ['rgb(237,248,251)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(136,86,167)', 'rgb(129,15,124)'], 7: ['rgb(237,248,251)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(140,107,177)', 'rgb(136,65,157)', 'rgb(110,1,107)'], 8: ['rgb(247,252,253)', 'rgb(224,236,244)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(140,107,177)', 'rgb(136,65,157)', 'rgb(110,1,107)'], 9: ['rgb(247,252,253)', 'rgb(224,236,244)', 'rgb(191,211,230)', 'rgb(158,188,218)', 'rgb(140,150,198)', 'rgb(140,107,177)', 'rgb(136,65,157)', 'rgb(129,15,124)', 'rgb(77,0,75)'], 'type': 'seq'} ,
    "Oranges":  {3: ['rgb(254,230,206)', 'rgb(253,174,107)', 'rgb(230,85,13)'], 4: ['rgb(254,237,222)', 'rgb(253,190,133)', 'rgb(253,141,60)', 'rgb(217,71,1)'], 5: ['rgb(254,237,222)', 'rgb(253,190,133)', 'rgb(253,141,60)', 'rgb(230,85,13)', 'rgb(166,54,3)'], 6: ['rgb(254,237,222)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(230,85,13)', 'rgb(166,54,3)'], 7: ['rgb(254,237,222)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(241,105,19)', 'rgb(217,72,1)', 'rgb(140,45,4)'], 8: ['rgb(255,245,235)', 'rgb(254,230,206)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(241,105,19)', 'rgb(217,72,1)', 'rgb(140,45,4)'], 9: ['rgb(255,245,235)', 'rgb(254,230,206)', 'rgb(253,208,162)', 'rgb(253,174,107)', 'rgb(253,141,60)', 'rgb(241,105,19)', 'rgb(217,72,1)', 'rgb(166,54,3)', 'rgb(127,39,4)'], 'type': 'seq'} ,
    "BuGn":  {3: ['rgb(229,245,249)', 'rgb(153,216,201)', 'rgb(44,162,95)'], 4: ['rgb(237,248,251)', 'rgb(178,226,226)', 'rgb(102,194,164)', 'rgb(35,139,69)'], 5: ['rgb(237,248,251)', 'rgb(178,226,226)', 'rgb(102,194,164)', 'rgb(44,162,95)', 'rgb(0,109,44)'], 6: ['rgb(237,248,251)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(44,162,95)', 'rgb(0,109,44)'], 7: ['rgb(237,248,251)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(65,174,118)', 'rgb(35,139,69)', 'rgb(0,88,36)'], 8: ['rgb(247,252,253)', 'rgb(229,245,249)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(65,174,118)', 'rgb(35,139,69)', 'rgb(0,88,36)'], 9: ['rgb(247,252,253)', 'rgb(229,245,249)', 'rgb(204,236,230)', 'rgb(153,216,201)', 'rgb(102,194,164)', 'rgb(65,174,118)', 'rgb(35,139,69)', 'rgb(0,109,44)', 'rgb(0,68,27)'], 'type': 'seq'} ,
    "YlOrBr":  {3: ['rgb(255,247,188)', 'rgb(254,196,79)', 'rgb(217,95,14)'], 4: ['rgb(255,255,212)', 'rgb(254,217,142)', 'rgb(254,153,41)', 'rgb(204,76,2)'], 5: ['rgb(255,255,212)', 'rgb(254,217,142)', 'rgb(254,153,41)', 'rgb(217,95,14)', 'rgb(153,52,4)'], 6: ['rgb(255,255,212)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(217,95,14)', 'rgb(153,52,4)'], 7: ['rgb(255,255,212)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(236,112,20)', 'rgb(204,76,2)', 'rgb(140,45,4)'], 8: ['rgb(255,255,229)', 'rgb(255,247,188)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(236,112,20)', 'rgb(204,76,2)', 'rgb(140,45,4)'], 9: ['rgb(255,255,229)', 'rgb(255,247,188)', 'rgb(254,227,145)', 'rgb(254,196,79)', 'rgb(254,153,41)', 'rgb(236,112,20)', 'rgb(204,76,2)', 'rgb(153,52,4)', 'rgb(102,37,6)'], 'type': 'seq'} ,
    "YlGn":  {3: ['rgb(247,252,185)', 'rgb(173,221,142)', 'rgb(49,163,84)'], 4: ['rgb(255,255,204)', 'rgb(194,230,153)', 'rgb(120,198,121)', 'rgb(35,132,67)'], 5: ['rgb(255,255,204)', 'rgb(194,230,153)', 'rgb(120,198,121)', 'rgb(49,163,84)', 'rgb(0,104,55)'], 6: ['rgb(255,255,204)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(49,163,84)', 'rgb(0,104,55)'], 7: ['rgb(255,255,204)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,90,50)'], 8: ['rgb(255,255,229)', 'rgb(247,252,185)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,90,50)'], 9: ['rgb(255,255,229)', 'rgb(247,252,185)', 'rgb(217,240,163)', 'rgb(173,221,142)', 'rgb(120,198,121)', 'rgb(65,171,93)', 'rgb(35,132,67)', 'rgb(0,104,55)', 'rgb(0,69,41)'], 'type': 'seq'} ,
    "Reds":  {3: ['rgb(254,224,210)', 'rgb(252,146,114)', 'rgb(222,45,38)'], 4: ['rgb(254,229,217)', 'rgb(252,174,145)', 'rgb(251,106,74)', 'rgb(203,24,29)'], 5: ['rgb(254,229,217)', 'rgb(252,174,145)', 'rgb(251,106,74)', 'rgb(222,45,38)', 'rgb(165,15,21)'], 6: ['rgb(254,229,217)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(222,45,38)', 'rgb(165,15,21)'], 7: ['rgb(254,229,217)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(153,0,13)'], 8: ['rgb(255,245,240)', 'rgb(254,224,210)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(153,0,13)'], 9: ['rgb(255,245,240)', 'rgb(254,224,210)', 'rgb(252,187,161)', 'rgb(252,146,114)', 'rgb(251,106,74)', 'rgb(239,59,44)', 'rgb(203,24,29)', 'rgb(165,15,21)', 'rgb(103,0,13)'], 'type': 'seq'} ,
    "RdPu":  {3: ['rgb(253,224,221)', 'rgb(250,159,181)', 'rgb(197,27,138)'], 4: ['rgb(254,235,226)', 'rgb(251,180,185)', 'rgb(247,104,161)', 'rgb(174,1,126)'], 5: ['rgb(254,235,226)', 'rgb(251,180,185)', 'rgb(247,104,161)', 'rgb(197,27,138)', 'rgb(122,1,119)'], 6: ['rgb(254,235,226)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(197,27,138)', 'rgb(122,1,119)'], 7: ['rgb(254,235,226)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(221,52,151)', 'rgb(174,1,126)', 'rgb(122,1,119)'], 8: ['rgb(255,247,243)', 'rgb(253,224,221)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(221,52,151)', 'rgb(174,1,126)', 'rgb(122,1,119)'], 9: ['rgb(255,247,243)', 'rgb(253,224,221)', 'rgb(252,197,192)', 'rgb(250,159,181)', 'rgb(247,104,161)', 'rgb(221,52,151)', 'rgb(174,1,126)', 'rgb(122,1,119)', 'rgb(73,0,106)'], 'type': 'seq'} ,
    "Greens":  {3: ['rgb(229,245,224)', 'rgb(161,217,155)', 'rgb(49,163,84)'], 4: ['rgb(237,248,233)', 'rgb(186,228,179)', 'rgb(116,196,118)', 'rgb(35,139,69)'], 5: ['rgb(237,248,233)', 'rgb(186,228,179)', 'rgb(116,196,118)', 'rgb(49,163,84)', 'rgb(0,109,44)'], 6: ['rgb(237,248,233)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(49,163,84)', 'rgb(0,109,44)'], 7: ['rgb(237,248,233)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(65,171,93)', 'rgb(35,139,69)', 'rgb(0,90,50)'], 8: ['rgb(247,252,245)', 'rgb(229,245,224)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(65,171,93)', 'rgb(35,139,69)', 'rgb(0,90,50)'], 9: ['rgb(247,252,245)', 'rgb(229,245,224)', 'rgb(199,233,192)', 'rgb(161,217,155)', 'rgb(116,196,118)', 'rgb(65,171,93)', 'rgb(35,139,69)', 'rgb(0,109,44)', 'rgb(0,68,27)'], 'type': 'seq'} ,
    "YlGnBu":  {3: ['rgb(237,248,177)', 'rgb(127,205,187)', 'rgb(44,127,184)'], 4: ['rgb(255,255,204)', 'rgb(161,218,180)', 'rgb(65,182,196)', 'rgb(34,94,168)'], 5: ['rgb(255,255,204)', 'rgb(161,218,180)', 'rgb(65,182,196)', 'rgb(44,127,184)', 'rgb(37,52,148)'], 6: ['rgb(255,255,204)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(44,127,184)', 'rgb(37,52,148)'], 7: ['rgb(255,255,204)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(29,145,192)', 'rgb(34,94,168)', 'rgb(12,44,132)'], 8: ['rgb(255,255,217)', 'rgb(237,248,177)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(29,145,192)', 'rgb(34,94,168)', 'rgb(12,44,132)'], 9: ['rgb(255,255,217)', 'rgb(237,248,177)', 'rgb(199,233,180)', 'rgb(127,205,187)', 'rgb(65,182,196)', 'rgb(29,145,192)', 'rgb(34,94,168)', 'rgb(37,52,148)', 'rgb(8,29,88)'], 'type': 'seq'} ,
    "Purples":  {3: ['rgb(239,237,245)', 'rgb(188,189,220)', 'rgb(117,107,177)'], 4: ['rgb(242,240,247)', 'rgb(203,201,226)', 'rgb(158,154,200)', 'rgb(106,81,163)'], 5: ['rgb(242,240,247)', 'rgb(203,201,226)', 'rgb(158,154,200)', 'rgb(117,107,177)', 'rgb(84,39,143)'], 6: ['rgb(242,240,247)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(117,107,177)', 'rgb(84,39,143)'], 7: ['rgb(242,240,247)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(128,125,186)', 'rgb(106,81,163)', 'rgb(74,20,134)'], 8: ['rgb(252,251,253)', 'rgb(239,237,245)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(128,125,186)', 'rgb(106,81,163)', 'rgb(74,20,134)'], 9: ['rgb(252,251,253)', 'rgb(239,237,245)', 'rgb(218,218,235)', 'rgb(188,189,220)', 'rgb(158,154,200)', 'rgb(128,125,186)', 'rgb(106,81,163)', 'rgb(84,39,143)', 'rgb(63,0,125)'], 'type': 'seq'} ,
    "GnBu":  {3: ['rgb(224,243,219)', 'rgb(168,221,181)', 'rgb(67,162,202)'], 4: ['rgb(240,249,232)', 'rgb(186,228,188)', 'rgb(123,204,196)', 'rgb(43,140,190)'], 5: ['rgb(240,249,232)', 'rgb(186,228,188)', 'rgb(123,204,196)', 'rgb(67,162,202)', 'rgb(8,104,172)'], 6: ['rgb(240,249,232)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(67,162,202)', 'rgb(8,104,172)'], 7: ['rgb(240,249,232)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(78,179,211)', 'rgb(43,140,190)', 'rgb(8,88,158)'], 8: ['rgb(247,252,240)', 'rgb(224,243,219)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(78,179,211)', 'rgb(43,140,190)', 'rgb(8,88,158)'], 9: ['rgb(247,252,240)', 'rgb(224,243,219)', 'rgb(204,235,197)', 'rgb(168,221,181)', 'rgb(123,204,196)', 'rgb(78,179,211)', 'rgb(43,140,190)', 'rgb(8,104,172)', 'rgb(8,64,129)'], 'type': 'seq'} ,
    "Greys":  {3: ['rgb(240,240,240)', 'rgb(189,189,189)', 'rgb(99,99,99)'], 4: ['rgb(247,247,247)', 'rgb(204,204,204)', 'rgb(150,150,150)', 'rgb(82,82,82)'], 5: ['rgb(247,247,247)', 'rgb(204,204,204)', 'rgb(150,150,150)', 'rgb(99,99,99)', 'rgb(37,37,37)'], 6: ['rgb(247,247,247)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(99,99,99)', 'rgb(37,37,37)'], 7: ['rgb(247,247,247)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(115,115,115)', 'rgb(82,82,82)', 'rgb(37,37,37)'], 8: ['rgb(255,255,255)', 'rgb(240,240,240)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(115,115,115)', 'rgb(82,82,82)', 'rgb(37,37,37)'], 9: ['rgb(255,255,255)', 'rgb(240,240,240)', 'rgb(217,217,217)', 'rgb(189,189,189)', 'rgb(150,150,150)', 'rgb(115,115,115)', 'rgb(82,82,82)', 'rgb(37,37,37)', 'rgb(0,0,0)'], 'type': 'seq'} ,
    "YlOrRd":  {3: ['rgb(255,237,160)', 'rgb(254,178,76)', 'rgb(240,59,32)'], 4: ['rgb(255,255,178)', 'rgb(254,204,92)', 'rgb(253,141,60)', 'rgb(227,26,28)'], 5: ['rgb(255,255,178)', 'rgb(254,204,92)', 'rgb(253,141,60)', 'rgb(240,59,32)', 'rgb(189,0,38)'], 6: ['rgb(255,255,178)', 'rgb(254,217,118)', 'rgb(254,178,76)', 'rgb(253,141,60)', 'rgb(240,59,32)', 'rgb(189,0,38)'], 7: ['rgb(255,255,178)', 'rgb(254,217,118)', 'rgb(254,178,76)', 'rgb(253,141,60)', 'rgb(252,78,42)', 'rgb(227,26,28)', 'rgb(177,0,38)'], 8: ['rgb(255,255,204)', 'rgb(255,237,160)', 'rgb(254,217,118)', 'rgb(254,178,76)', 'rgb(253,141,60)', 'rgb(252,78,42)', 'rgb(227,26,28)', 'rgb(177,0,38)'], 'type': 'seq'} ,
    "PuRd":  {3: ['rgb(231,225,239)', 'rgb(201,148,199)', 'rgb(221,28,119)'], 4: ['rgb(241,238,246)', 'rgb(215,181,216)', 'rgb(223,101,176)', 'rgb(206,18,86)'], 5: ['rgb(241,238,246)', 'rgb(215,181,216)', 'rgb(223,101,176)', 'rgb(221,28,119)', 'rgb(152,0,67)'], 6: ['rgb(241,238,246)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(221,28,119)', 'rgb(152,0,67)'], 7: ['rgb(241,238,246)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(231,41,138)', 'rgb(206,18,86)', 'rgb(145,0,63)'], 8: ['rgb(247,244,249)', 'rgb(231,225,239)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(231,41,138)', 'rgb(206,18,86)', 'rgb(145,0,63)'], 9: ['rgb(247,244,249)', 'rgb(231,225,239)', 'rgb(212,185,218)', 'rgb(201,148,199)', 'rgb(223,101,176)', 'rgb(231,41,138)', 'rgb(206,18,86)', 'rgb(152,0,67)', 'rgb(103,0,31)'], 'type': 'seq'} ,
    "Blues":  {3: ['rgb(222,235,247)', 'rgb(158,202,225)', 'rgb(49,130,189)'], 4: ['rgb(239,243,255)', 'rgb(189,215,231)', 'rgb(107,174,214)', 'rgb(33,113,181)'], 5: ['rgb(239,243,255)', 'rgb(189,215,231)', 'rgb(107,174,214)', 'rgb(49,130,189)', 'rgb(8,81,156)'], 6: ['rgb(239,243,255)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(49,130,189)', 'rgb(8,81,156)'], 7: ['rgb(239,243,255)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(66,146,198)', 'rgb(33,113,181)', 'rgb(8,69,148)'], 8: ['rgb(247,251,255)', 'rgb(222,235,247)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(66,146,198)', 'rgb(33,113,181)', 'rgb(8,69,148)'], 9: ['rgb(247,251,255)', 'rgb(222,235,247)', 'rgb(198,219,239)', 'rgb(158,202,225)', 'rgb(107,174,214)', 'rgb(66,146,198)', 'rgb(33,113,181)', 'rgb(8,81,156)', 'rgb(8,48,107)'], 'type': 'seq'} ,
    "PuBuGn":  {3: ['rgb(236,226,240)', 'rgb(166,189,219)', 'rgb(28,144,153)'], 4: ['rgb(246,239,247)', 'rgb(189,201,225)', 'rgb(103,169,207)', 'rgb(2,129,138)'], 5: ['rgb(246,239,247)', 'rgb(189,201,225)', 'rgb(103,169,207)', 'rgb(28,144,153)', 'rgb(1,108,89)'], 6: ['rgb(246,239,247)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(28,144,153)', 'rgb(1,108,89)'], 7: ['rgb(246,239,247)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(54,144,192)', 'rgb(2,129,138)', 'rgb(1,100,80)'], 8: ['rgb(255,247,251)', 'rgb(236,226,240)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(54,144,192)', 'rgb(2,129,138)', 'rgb(1,100,80)'], 9: ['rgb(255,247,251)', 'rgb(236,226,240)', 'rgb(208,209,230)', 'rgb(166,189,219)', 'rgb(103,169,207)', 'rgb(54,144,192)', 'rgb(2,129,138)', 'rgb(1,108,89)', 'rgb(1,70,54)'], 'type': 'seq'}
  };
  
  for(var bpname in brewer_palette) {
    var bp1 = brewer_palette[bpname];
    var bptype = bp1["type"];
    if(bptype == "seq")  { bptype = "brewer-sequential"; }
    if(bptype == "qual") { bptype = "brewer-qualitative"; }
    if(bptype == "div")  { bptype = "brewer-diverging"; }
    for(var bpdepth in bp1) {
      if(bpdepth == "type") { continue; }
      var bpcolor = new Object();
      bpcolor.name = bpname + "_bp_" + bpdepth;
      bpcolor.discrete = true;
      bpcolor.colorcat = bptype;
      bpcolor.bpdepth = bpdepth;
      bpcolor.colors = new Array();
      //transfer colors
      var bp_rgbs = bp1[bpdepth];
      for(var j=0; j<bp_rgbs.length; j++) {
        var rgb1 = bp_rgbs[j];
        rgb1 = rgb1.replace("rgb(", "");
        rgb1 = rgb1.replace(")", "");
        var rgb2 = rgb1.split(",");
        //if(bpname == "PuBuGn" && bpdepth=="9") { document.getElementById("message").innerHTML += " "+rgb1; }
        bpcolor.colors.push(new RGBColour(rgb2[0], rgb2[1], rgb2[2]));   //orange
      }
      zenbuColorSpaces[bpcolor.name] = bpcolor;
      //console.log("add brewer colorSpace ["+bpcolor.name+"]");
    }
  }
  
  // single-color
  var tcolor = new Object();
  tcolor.name = "single-color";
  tcolor.discrete = true;
  tcolor.colorcat = "single-color";
  tcolor.bpdepth = "";
  tcolor.log = false;
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(0, 0, 255)); //#0000FF
  zenbuColorSpaces[tcolor.name] = tcolor;

  // category-colors
  var tcolor = new Object();
  tcolor.name = "category-colors";
  tcolor.discrete = true;
  tcolor.colorcat = "category-colors";
  tcolor.bpdepth = "";
  tcolor.log = false;
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
  zenbuColorSpaces[tcolor.name] = tcolor;

  // sense-color
  var tcolor = new Object();
  tcolor.name = "sense-color";
  tcolor.discrete = false;
  tcolor.colorcat = "zenbu-spectrum";
  tcolor.bpdepth = "";
  tcolor.log = false;
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
  tcolor.colors.push(new RGBColour(0, 0, 0));       //black
  zenbuColorSpaces[tcolor.name] = tcolor;

  //userColor
  var tcolor = new Object();
  tcolor.name = "user-color";
  tcolor.discrete = false;
  tcolor.colorcat = "zenbu-spectrum";
  tcolor.bpdepth = "";
  tcolor.log = false;
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
  tcolor.colors.push(new RGBColour(0, 0, 255));     //#0000FF
  zenbuColorSpaces[tcolor.name] = tcolor;

  // fire1
  var fire1 = new Object();
  fire1.name = "fire1";
  fire1.discrete = false;
  fire1.colorcat = "zenbu-spectrum";
  fire1.bpdepth = "";
  fire1.colors = new Array();
  fire1.colors.push(new RGBColour(220, 220, 220)); //gray
  fire1.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  fire1.colors.push(new RGBColour(255, 153, 0));   //orange
  fire1.colors.push(new RGBColour(255, 0, 0));     //red
  zenbuColorSpaces[fire1.name] = fire1;
  
  // fire2
  var fire2 = new Object();
  fire2.name = "fire2";
  fire2.discrete = false;
  fire2.colorcat = "zenbu-spectrum";
  fire2.bpdepth = "";
  fire2.colors = new Array();
  fire2.colors.push(new RGBColour(220, 220, 220)); //gray
  fire2.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  fire2.colors.push(new RGBColour(255, 153, 0));   //orange
  fire2.colors.push(new RGBColour(255, 0, 0));     //red
  fire2.colors.push(new RGBColour(70, 0, 0));     //black-red
  zenbuColorSpaces[fire2.name] = fire2;
  
  // fire3
  var fire3 = new Object();
  fire3.name = "fire3";
  fire3.discrete = false;
  fire3.colorcat = "zenbu-spectrum";
  fire3.bpdepth = "";
  fire3.colors = new Array();
  fire3.colors.push(new RGBColour(0, 0, 0));       //black
  fire3.colors.push(new RGBColour(255, 0, 0));     //red
  fire3.colors.push(new RGBColour(255, 153, 0));   //orange
  fire3.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  fire3.colors.push(new RGBColour(220, 220, 220)); //gray
  zenbuColorSpaces[fire3.name] = fire3;
  
  // fire4
  var fire4 = new Object();
  fire4.name = "fire4";
  fire4.discrete = false;
  fire4.colorcat = "zenbu-spectrum";
  fire4.bpdepth = "";
  fire4.colors = new Array();
  fire4.colors.push(new RGBColour(0, 0, 0));       //black
  fire4.colors.push(new RGBColour(255, 0, 0));     //red
  fire4.colors.push(new RGBColour(255, 153, 0));   //orange
  fire4.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  zenbuColorSpaces[fire4.name] = fire4;

  // rainbow
  var rainbow = new Object();
  rainbow.name = "rainbow";
  rainbow.discrete = false;
  rainbow.colorcat = "zenbu-spectrum";
  rainbow.bpdepth = "";
  rainbow.colors = new Array();
  rainbow.colors.push(new RGBColour(255, 0, 255));   //purple
  rainbow.colors.push(new RGBColour(0, 0, 200));     //blue
  rainbow.colors.push(new RGBColour(0, 255, 255));   //cyan
  rainbow.colors.push(new RGBColour(0, 220, 0));     //green
  rainbow.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  rainbow.colors.push(new RGBColour(255, 153, 0));   //orange
  rainbow.colors.push(new RGBColour(255, 0, 0));     //red
  zenbuColorSpaces[rainbow.name] = rainbow;
  
  // rainbow2
  var rainbow = new Object();
  rainbow.name = "rainbow2";
  rainbow.discrete = false;
  rainbow.colorcat = "zenbu-spectrum";
  rainbow.bpdepth = "";
  rainbow.colors = new Array();
  rainbow.colors.push(new RGBColour(255, 0, 0));     //red
  rainbow.colors.push(new RGBColour(255, 153, 0));   //orange
  rainbow.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  rainbow.colors.push(new RGBColour(0, 220, 0));     //green
  rainbow.colors.push(new RGBColour(0, 255, 255));   //cyan
  rainbow.colors.push(new RGBColour(0, 0, 200));     //blue
  rainbow.colors.push(new RGBColour(255, 0, 255));   //purple
  zenbuColorSpaces[rainbow.name] = rainbow;
  
  // chakra
  var rainbow = new Object();
  rainbow.name = "chakra";
  rainbow.discrete = false;
  rainbow.colorcat = "zenbu-spectrum";
  rainbow.bpdepth = "";
  rainbow.colors = new Array();
  rainbow.colors.push(new RGBColour(220, 20, 60));   //red crimson
  rainbow.colors.push(new RGBColour(255, 153, 0));   //orange
  //rainbow.colors.push(new RGBColour(255, 255, 51));  //yellow
  rainbow.colors.push(new RGBColour(255, 215, 0));  //gold
  rainbow.colors.push(new RGBColour(0, 200, 0));     //green
  rainbow.colors.push(new RGBColour(30, 144, 255));  //dodger blue
  rainbow.colors.push(new RGBColour(112, 0, 195));    //indigo
  rainbow.colors.push(new RGBColour(218, 112, 214)); //violet/orchid
  zenbuColorSpaces[rainbow.name] = rainbow;
  
  // middle-heat
  var spec = new Object();
  spec.name = "middle-heat";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  zenbuColorSpaces[spec.name] = spec;
  
  // middle-heat2
  var spec = new Object();
  spec.name = "middle-heat2";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(240, 240, 51));  //yellow FFFF33
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  zenbuColorSpaces[spec.name] = spec;
  
  // divergent1
  var spec = new Object();
  spec.name = "divergent1";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(15, 199, 255));  //dark cyan
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(255, 0, 0));     //red
  zenbuColorSpaces[spec.name] = spec;

  // divergent2
  var spec = new Object();
  spec.name = "divergent2";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(100, 0, 100));  //dark purple
  spec.colors.push(new RGBColour(220, 220, 220)); //gray
  spec.colors.push(new RGBColour(0, 100, 0));     //dark green
  zenbuColorSpaces[spec.name] = spec;
  
  // divergent3: smooth variation on brewer-BrBg_9
  //['rgb(140,81,10)', 'rgb(191,129,45)', 'rgb(223,194,125)', 'rgb(246,232,195)', 'rgb(245,245,245)', 'rgb(199,234,229)', 'rgb(128,205,193)', 'rgb(53,151,143)', 'rgb(1,102,94)'],
  var spec = new Object();
  spec.name = "divergent3";
  spec.discrete = false;
  spec.colorcat = "zenbu-spectrum";
  spec.bpdepth = "";
  spec.colors = new Array();
  spec.colors.push(new RGBColour(140,81,10));   //brown 
  spec.colors.push(new RGBColour(223,194,125)); //mid-brown
  spec.colors.push(new RGBColour(245,245,245)); //gray
  spec.colors.push(new RGBColour(128,205,193)); //mid-green
  spec.colors.push(new RGBColour(1,102,94));    //dark green
  zenbuColorSpaces[spec.name] = spec;
    
  // gray1
  var gray1 = new Object();
  gray1.name = "gray1";
  gray1.discrete = false;
  gray1.colorcat = "zenbu-spectrum";
  gray1.bpdepth = "";
  gray1.colors = new Array();
  gray1.colors.push(new RGBColour(220, 220, 220)); //gray
  gray1.colors.push(new RGBColour(0, 0, 0));       //black
  zenbuColorSpaces[gray1.name] = gray1;
  
  // blue1
  var blue1 = new Object();
  blue1.name = "blue1";
  blue1.discrete = false;
  blue1.colorcat = "zenbu-spectrum";
  blue1.bpdepth = "";
  blue1.colors = new Array();
  blue1.colors.push(new RGBColour(240, 240, 240)); //gray
  blue1.colors.push(new RGBColour(0, 0, 245));     //blue
  zenbuColorSpaces[blue1.name] = blue1;
  
  // blue2
  var blue2 = new Object();
  blue2.name = "blue2";
  blue2.discrete = false;
  blue2.colorcat = "zenbu-spectrum";
  blue2.bpdepth = "";
  blue2.log = true;
  blue2.colors = new Array();
  blue2.colors.push(new RGBColour(240, 240, 240)); //gray
  blue2.colors.push(new RGBColour(0, 0, 245));     //blue
  zenbuColorSpaces[blue2.name] = blue2;
  
  // pink1
  var pink1 = new Object();
  pink1.name = "pink1";
  pink1.discrete = false;
  pink1.colorcat = "zenbu-spectrum";
  pink1.bpdepth = "";
  pink1.colors = new Array();
  pink1.colors.push(new RGBColour(255, 230, 255));  //pale pink
  pink1.colors.push(new RGBColour(255, 20, 147));   //deep pink
  zenbuColorSpaces[pink1.name] = pink1;
  
  // orange1
  var orange1 = new Object();
  orange1.name = "orange1";
  orange1.discrete = false;
  orange1.colorcat = "zenbu-spectrum";
  orange1.bpdepth = "";
  orange1.colors = new Array();
  orange1.colors.push(new RGBColour(240, 240, 240)); //gray
  orange1.colors.push(new RGBColour(255, 100, 0));   //orange
  zenbuColorSpaces[orange1.name] = orange1;
  
  // orange2
  var orange2 = new Object();
  orange2.name = "orange2";
  orange2.discrete = false;
  orange2.colorcat = "zenbu-spectrum";
  orange2.bpdepth = "";
  orange2.log = true;
  orange2.colors = new Array();
  orange2.colors.push(new RGBColour(240, 240, 240)); //gray
  orange2.colors.push(new RGBColour(255, 100, 0));   //orange
  zenbuColorSpaces[orange2.name] = orange2;
}


function zenbuScoreColorSpace(colorname, score, discrete, logscale, invert, zero_center, alpha) {
  //score is from 0.0 to 1.0
  // function returns an RGBColour object
  if(zero_center && (score < -1.0)) { score = -1.0; }
  if((score < 0) && !zero_center) { score = 0; }
  if(score > 1.0) { score = 1.0; }
  if(!zero_center && invert) { score = 1.0 - score; }
  if(zero_center && invert) { score = 0.0 - score; }
  if(!alpha || isNaN(alpha)) { alpha = 1.0; }
  if(!colorname) { return new RGBColour(0, 0, 0, alpha); }

  var colorSpc = zenbuColorSpaces[colorname];
  if(!colorSpc && (colorname.charAt(0) == "#")) {
    //special code for single-color colorname
    var color = new RGBColour(0, 0, 0, alpha); //black in case there is parsing error
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(.*)$/i.exec(colorname);
    if(result) {
      var r = parseInt(result[1], 16);
      var g = parseInt(result[2], 16);
      var b = parseInt(result[3], 16);
      color = new RGBColour(r,g,b, alpha);
      if(result[4] != " spectrum") { return color; }
      else {
        colorSpc = zenbuColorSpaces["user-color"];
        colorSpc.colors = new Array();
        colorSpc.colors.push(new RGBColour(240, 240, 240, alpha)); //gray
        colorSpc.colors.push(color);        
      }
    }    
    //console.log("zenbuScoreColorSpace single-color["+colorname+"] -> ["+(color.getCSSHexadecimalRGB())+"]");
    //return color;
  }
  if(!colorSpc) { return new RGBColour(0, 0, 0, alpha); } //return black if name error
  
  //document.getElementById("message").innerHTML= "colorspace: " + colorSpc.colors.length;
  if(colorSpc.log) { logscale = true; }
  if(logscale) {
    score = Math.log(Math.abs(score)*100 + 1) / Math.log(100+1);
  }
  
  if(colorSpc.discrete) { discrete = true; }
  if(discrete) {
    var ci = score * (colorSpc.colors.length);
    if(zero_center) { ci = ((score +1.0)/2.0) * (colorSpc.colors.length); }
    var idx = Math.floor(ci);
    if(idx == colorSpc.colors.length) { idx = colorSpc.colors.length - 1; }
    var color1 = colorSpc.colors[idx];
    if(!color1) { return new RGBColour(0, 0, 0, alpha); }
    return color1
  }
  
  var ci = Math.abs(score) * (colorSpc.colors.length - 1);
  if(zero_center) { ci = ((score +1.0)/2.0) * (colorSpc.colors.length - 1); }
  var idx = Math.floor(ci);
  var cr = ci - idx;
  //document.getElementById("message").innerHTML += "ci: " + ci;
  //console.log("score:"+score+"  ci:"+ci+" idx:"+idx);
  
  var color1 = colorSpc.colors[idx];
  var color2 = colorSpc.colors[idx+1];
  if(!color1) { 
    color1 = new RGBColour(0, 0, 0, alpha); 
    color1.zcr = score;
    return color1;
  }
  if(!color2) { 
    color1.zcr = score;
    return color1; 
  }
  
  if(discrete) { if(cr<=0.5) {return color1;} else {return color2;} }
  
  var c1 = color1.getRGB();
  var c2 = color2.getRGB();
  
  var r  = c1.r + cr * (c2.r - c1.r);
  var g  = c1.g + cr * (c2.g - c1.g);
  var b  = c1.b + cr * (c2.b - c1.b);
  
  var color = new RGBColour(r, g, b, alpha);
  color.zcr = score;
  return color;
}


function zenbuIndexColorSpace(colorname, index) {
  if(!colorname) { return new RGBColour(0, 0, 0); }
  var colorSpc = zenbuColorSpaces[colorname];
  if(!colorSpc && (colorname.charAt(0) == "#")) {
    //special code for single-color colorname
    var color = new RGBColour(0, 0, 0); //black in case there is parsing error
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(.*)$/i.exec(colorname);
    if(result) {
      var r = parseInt(result[1], 16);
      var g = parseInt(result[2], 16);
      var b = parseInt(result[3], 16);
      color = new RGBColour(r,g,b);
      if(result[4] != " spectrum") { return color; }
      else {
        colorSpc = zenbuColorSpaces["user-color"];
        colorSpc.colors = new Array();
        colorSpc.colors.push(new RGBColour(240, 240, 240)); //gray
        colorSpc.colors.push(color);        
      }
    }    
    //console.log("zenbuIndexColorSpace single-color["+colorname+"] -> ["+(color.getCSSHexadecimalRGB())+"]");
    //return color;
  }
  if(!colorSpc) {   //return black if name error
    //console.log("zenbuIndexColorSpace ["+colorname+"] name error");
    return new RGBColour(0, 0, 0);
  }
  
  var ci = index % (colorSpc.colors.length);
  var idx = Math.floor(ci);
  //console.log("index="+index+"  ci="+ci+"  idx="+idx);
  if(idx == colorSpc.colors.length) { idx = colorSpc.colors.length - 1; }
  var color1 = colorSpc.colors[idx];
  if(!color1) { return new RGBColour(0, 0, 0); }
  return color1
}


function zenbuColorSpaceSetSenseColor(userColor) {
  if(!userColor) { return; }
  var tcolor = zenbuColorSpaces["sense-color"];
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
  var cl1 = new RGBColor(userColor);
  tcolor.colors.push(new RGBColour(cl1.r, cl1.g, cl1.b)); //sense color
}

function zenbuColorSpaceSetUserColor(userColor) {
  if(!userColor) { userColor = "#0000FF"; }
  var tcolor = zenbuColorSpaces["user-color"];
  tcolor.colors = new Array();
  tcolor.colors.push(new RGBColour(240, 240, 240)); //gray
  var cl1 = new RGBColor(userColor);
  tcolor.colors.push(new RGBColour(cl1.r, cl1.g, cl1.b)); //sense color
}


function zenbuMakeColorGradient(colorname, discrete, logscale, invert, seglen) {
  if(!seglen) { seglen = 42; }
  if(seglen<10) { seglen = 10; }
  
  if(!colorname) { colorname = "fire1"; }
  if(!discrete) { discrete = zenbuColorSpaces[colorname].discrete; }
  
  var span1 = document.createElement('span');
  span1.setAttribute("style", "margin: 0px 0px 0px 7px;");
  for (var i = 0; i <= seglen; ++i) {
    var score = i / seglen;
    var color = zenbuScoreColorSpace(colorname, score, discrete, logscale, invert);
    var font1 = span1.appendChild(document.createElement('font'));
    font1.setAttribute("color", color.getCSSHexadecimalRGB());
    font1.innerHTML ="&#9608;";
  }
  return span1;
}
