// ZENBU zenbu_datasource_interface.js
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


var zenbuDatasourceInterface_hash = new Object();  //global hash of all DSIs


//===============================================================
//
// DataSourceInterface
//
//===============================================================



/*
  //sub panels
  var auxID = zenbuDSI.main_div_id + "_subpanel_aux";
  var auxdiv = document.getElementById(auxID);
  if(!auxdiv) {
    //auxdiv = main_div.appendChild(document.createElement('div'));
    auxdiv = master_div.appendChild(document.createElement('div'));
    auxdiv.id = auxID;
    zenbuDSI.auxdiv = auxdiv;
  }
  var auxwidth = mainRect.width-5;
  if(auxwidth<425) { auxwidth = 425; }
  auxdiv.setAttribute('style', "position:absolute; z-index:10; left:"+(mainRect.left+window.scrollX)+"px; top:"+(mainRect.top+window.scrollY+10)+"px; width:"+auxwidth+"px;");
  
  var cfgID = zenbuDSI.main_div_id + "_config_subpanel";
  var configdiv = document.getElementById(cfgID);
  if(!configdiv) {
    configdiv = document.createElement('div');
    //auxdiv.insertBefore(main_div, auxdiv.firstChild);
    auxdiv.appendChild(configdiv);
    configdiv.id = cfgID;
    configdiv.setAttribute('style', "background-color:rgb(245,245,250); text-align:left; " +
                           "border:inset; border-width:2px; padding: 3px 3px 3px 3px; " +
                           "width:400px; display:none; opacity: 0.98; " +
                           "position:absolute; top:20px; right:10px;"
                           );
    zenbuDSI.config_subpanel = configdiv;                       
  }
  //clearKids(configdiv);
  configdiv.innerHTML = "";

  var sourcesDiv = zenbuDatasourceInterfaceBuildSourcesInterface(zenbuDSI);
*/



function zenbuDatasourceInterface(uniqID) {
  if(!uniqID) { uniqID = "zenbuDSI_"+ createUUID(); }

  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];

  if(!zenbuDSI) {    
    console.log("zenbuDatasourceInterface ["+uniqID+"] create new widget");
    zenbuDSI = document.createElement('div');
    zenbuDSI.id = uniqID;
    //zenbuDSI.setAttribute("style", "position:relative; margin:3px 3px 3px 0px;");
    //zenbuDSI.setAttribute("style", "margin:2px 10px 2px 5px;");
    zenbuDSI.setAttribute('style', "width:100%;");
    zenbuDSI.innerHTML = "";
    
    //init variables here
    //example query for features for target list
    //zenbuDSI.datasource_mode = "feature";
    //zenbuDSI.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource";
    //zenbuDSI.query_filter = "F6_KD_CAGE:=true";
    //zenbuDSI.query_format = "fullxml";

    zenbuDSI.datasource_mode = "feature";  //feature, edge, shared_element
    zenbuDSI.source_ids = "";
    zenbuDSI.query_filter = "";
    zenbuDSI.query_format = "fullxml";
    zenbuDSI.edit_datasource_query = false;
    zenbuDSI.edit_datasource_script = false;
    zenbuDSI.allowChangeDatasourceMode = true;
    zenbuDSI.enableScripting = false;
    zenbuDSI.enableResultFilter = true;
    zenbuDSI.allowMultipleSelect = true;
    zenbuDSI.query_edge_search_depth = 1;

    zenbuDSI.newconfig = new Object();

    zenbuDatasourceInterface_hash[uniqID] = zenbuDSI;
    //zenbuDSI.assemblySelect = assemblySelect;
  }
  //var assemblySelect = zenbuDSI.assemblySelect;
  //assemblySelect.innerHTML = ""; //to clear old content of <select>
      
  //zenbuDatasourceInterfaceUpdate(uniqID);
  
  return zenbuDSI;
}


function zenbuDatasourceInterfaceUpdate(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  
  //externally set parent divs to enable autoresize
  var main_div = zenbuDSI.main_div;  
  var auxdiv = zenbuDSI.auxdiv;  
  var configdiv = zenbuDSI.config_subpanel;
  
  var datasource_mode = zenbuDSI.datasource_mode;
  if(datasource_mode == "") { return; } //element does not need a datasource
  if(zenbuDSI.newconfig && zenbuDSI.newconfig.datasource_mode != undefined) { datasource_mode = zenbuDSI.newconfig.datasource_mode; }
  
  //configdiv.appendChild(document.createElement('hr'));

  //var sourcesID = zenbuDSI.id + "_sources_search_div";
  //var sourceSearchDiv = document.getElementById(sourcesID);
  //if(!sourceSearchDiv) {
  //  sourceSearchDiv = document.createElement('div');
  //  sourceSearchDiv.id = sourcesID;
  //}
  //sourceSearchDiv.setAttribute('style', "width:100%;");
  //sourceSearchDiv.innerHTML = "";
  //configdiv.appendChild(sourceSearchDiv);
  
  zenbuDSI.style.width = "100%";
  zenbuDSI.innerHTML = "";
  
  if(main_div && configdiv) {  //can perform the autoresize code
    //reset widths: auxdiv.style.width = min "425px" or "775px" or maindiv.width; configdiv.style.width = "400px" or "750px";
    var mainRect = main_div.getBoundingClientRect();
    console.log("autoresize main_div "+uniqID+" rect x:"+mainRect.x+" y:"+mainRect.y+" width:"+mainRect.width+" height:"+mainRect.height);
    var auxwidth = mainRect.width-5;
    if(auxwidth<425) { auxwidth = 425; }
    var configRect = configdiv.getBoundingClientRect();
    if(zenbuDSI.edit_datasource_query) {
      if(mainRect.width < 775) { 
        auxwidth = 775;
      }
      if(configRect.width < 750) { configdiv.style.width = "750px"; }
    }
    configRect = configdiv.getBoundingClientRect(); //recalc

    if(auxdiv) {
      auxdiv.style.width = auxwidth+"px";
      //decide if configdiv is left/right justified
      var auxRect = auxdiv.getBoundingClientRect();
      if(auxRect.width>mainRect.width) { configdiv.style.left = "5px"; configdiv.style.right = ""; }
      else { configdiv.style.right = "10px"; configdiv.style.left = ""; }
    } else if(configdiv.style.position == "absolute") {
      //use mainRect for deciding left/right justified & configpanel is absolute on page
      //console.log("readjust using mainRect in absolute coords");
      configdiv.style.right = "";
      //console.log("configRect.width:"+configRect.width+"  mainRect.width:"+(mainRect.width));
      if(configRect.width>mainRect.width) { //left justify
        //console.log("left");
        configdiv.style.left = (mainRect.left + window.scrollX +10)+"px";
      } else { //right justify
        //console.log("right");
        configdiv.style.left = (mainRect.right + window.scrollX - configRect.width - 5) +"px"
      }
    }
  }
  
  //----------  
  var source_ids = zenbuDSI.source_ids;
  if(zenbuDSI.newconfig && zenbuDSI.newconfig.source_ids != undefined) { source_ids = zenbuDSI.newconfig.source_ids; }

  var fsrc_count =0;
  var exp_count = 0;
  var edge_count = 0;
  var src_array = source_ids.split(",");
  var src_regex = /^(.+)\:\:(\d+)\:\:\:(.+)$/;
  for(var i=0; i<src_array.length; i++) {
    var src = src_array[i];
    var mymatch = src_regex.exec(src);
    if(mymatch && (mymatch.length == 4)) {
      if(mymatch[3] == "Experiment") { exp_count++; }
      if(mymatch[3] == "FeatureSource") { fsrc_count++; }
      if(mymatch[3] == "EdgeSource") { edge_count++; }
    }
  }

  if(!zenbuDSI.newconfig || !zenbuDSI.edit_datasource_query) {
    //---- compacted version with [edit] button
    var div1 = zenbuDSI.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 3px 0px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");

    tspan = div1.appendChild(document.createElement('span'));
    tspan.innerHTML = "data type:"
    tspan = div1.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "padding-left:5px; font-style:italic;");
    
    if(datasource_mode=="feature") { 
      //tspan.innerHTML = "features"; 
      if(fsrc_count==0 && exp_count==0) { tspan.innerHTML = "feature/experiments"; }
      if(fsrc_count>0) { tspan.innerHTML += " ["+fsrc_count+"] sources"; }
      if(exp_count>0)  { tspan.innerHTML += " experiments["+exp_count+"]"; } 
    }
    if(datasource_mode=="edge") { 
      tspan.innerHTML = "edges"; 
      if(edge_count>0) { tspan.innerHTML += " ["+edge_count+"] sources"; }      
    }
    if(datasource_mode=="source") { 
      if(fsrc_count==0 && exp_count==0 && edge_count==0) { tspan.innerHTML = "sources"; }
      if(fsrc_count>0) { tspan.innerHTML += " feature_sources["+fsrc_count+"]"; }
      if(exp_count>0)  { tspan.innerHTML += " experiments["+exp_count+"]"; } 
      if(edge_count>0) { tspan.innerHTML += " edge_sources["+edge_count+"]"; }            
    }
    
    var button1 = div1.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 7px; font-size:10px; color:black; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "edit datasource query");
    button1.setAttribute("onmousedown", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'edit_datasource_query', this.value);");
 
    return zenbuDSI;
  } 

  //-------- edit datasource type mode
  if(!zenbuDSI.collabWidget) {
    zenbuDSI.collabWidget = eedbCollaborationPulldown("filter_search", uniqID);
    if(zenbuDSI.collaboration_filter) { 
      console.log("DSI set initial collaboration_filter : "+zenbuDSI.collaboration_filter);
      eedbCollaborationPulldownChanged(uniqID, zenbuDSI.collaboration_filter); //set internally
      eedbCollaborationPulldown("filter_search", uniqID); //refresh
    }
    zenbuDSI.collabWidget.callOutFunction = zenbuDatasourceInterfaceCollaborationChanged;
  }
  var collabWidget = zenbuDSI.appendChild(zenbuDSI.collabWidget);
  collabWidget.setAttribute('style', "float:right; margin-right:5px;");

  var div1 = zenbuDSI.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 3px 0px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  
  tspan = div1.appendChild(document.createElement('span'));
  tspan.setAttribute("style", "display:inline-block; padding-top:5px;");
  tspan.innerHTML = "data type:"
  if(zenbuDSI.allowChangeDatasourceMode) {      
    radio1 = div1.appendChild(document.createElement('input'));
    radio1.setAttribute("type", "radio");
    radio1.setAttribute("name", uniqID + "_sourcetype");
    radio1.setAttribute("value", "feature");
    if(datasource_mode == "feature") { radio1.setAttribute('checked', "checked"); }
    radio1.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'datasource_mode', this.value);");
    tspan = div1.appendChild(document.createElement('span'));
    tspan.innerHTML = "features";
    
    radio2 = div1.appendChild(document.createElement('input'));
    radio2.setAttribute("type", "radio");
    radio2.setAttribute("name", uniqID + "_sourcetype");
    radio2.setAttribute("value", "edge");
    if(datasource_mode == "edge") { radio2.setAttribute('checked', "checked"); }
    radio2.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'datasource_mode', this.value);");
    tspan = div1.appendChild(document.createElement('span'));
    tspan.innerHTML = "edges";
    
    radio3 = div1.appendChild(document.createElement('input'));
    radio3.setAttribute("type", "radio");
    radio3.setAttribute("name", uniqID + "_sourcetype");
    radio3.setAttribute("value", "source");
    if(datasource_mode == "source") { radio3.setAttribute('checked', "checked"); }
    radio3.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'datasource_mode', this.value);");
    tspan = div1.appendChild(document.createElement('span'));
    tspan.innerHTML = "sources";
  } else {
    tspan = div1.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "padding-left:5px; font-style:italic;");
    if(datasource_mode=="feature") { tspan.innerHTML = "feature/experiments"; }
    if(datasource_mode=="edge")    { tspan.innerHTML = "edges"; }
    if(datasource_mode=="source")  { tspan.innerHTML = "sources"; }
  }
  
  var tdiv = zenbuDSI.appendChild(document.createElement('div')); //to break the floating collabWidget
  tdiv.setAttribute('style', "clear:right;");

  if((datasource_mode == "edge") || (datasource_mode == "feature")) {  
    if(zenbuDSI.species_filter) {
      var species_filter = zenbuDSI.species_filter;
      if(zenbuDSI.newconfig && zenbuDSI.newconfig.species_filter != undefined) { species_filter = zenbuDSI.newconfig.species_filter; }
      var speciesDiv = zenbuDSI.appendChild(document.createElement('div'));
      speciesDiv.setAttribute('style', "margin: 0px 1px 0px 0px; font-size:10px;");
      var speciesCheck = speciesDiv.appendChild(document.createElement('input'));
      speciesCheck.setAttribute('type', "checkbox");
      if(species_filter) { speciesCheck.setAttribute("checked", "checked"); }
      speciesCheck.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'species_filter', this.value);");
      var speciesLabel = speciesDiv.appendChild(document.createElement('span'));
      speciesLabel.innerHTML = "restrict search to current species/assembly";
    }

    //----------
    var sourceSearchForm = zenbuDSI.appendChild(document.createElement('form'));
    sourceSearchForm.setAttribute('style', "margin-top: 3px;");
    sourceSearchForm.setAttribute("onsubmit", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'search'); return false;");
    
    var expSpan = sourceSearchForm.appendChild(document.createElement('span'));
    expSpan.innerHTML = "Search data sources:";
    expSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin-right:3px;");
    
    var sourceInput = sourceSearchForm.appendChild(document.createElement('input'));
    sourceInput.id = uniqID + "_sources_search_inputID";
    sourceInput.setAttribute('style', "width:430px; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    //sourceInput.setAttribute('size', "50");
    sourceInput.setAttribute('type', "text");
    
    var searchButton = sourceSearchForm.appendChild(document.createElement('input'));
    searchButton.setAttribute('style', "margin-left: 3px;");
    searchButton.type = "button";
    searchButton.className = "medbutton";
    searchButton.setAttribute("value", "search");
    searchButton.setAttribute("onclick", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'search');");
    
    var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
    clearButton.type = "button";
    clearButton.className = "medbutton";
    clearButton.setAttribute("value", "clear");
    clearButton.setAttribute("onclick", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'clear');");
            
    //-------------
    var sourceResultDiv = sourceSearchForm.appendChild(document.createElement('div'));
    sourceResultDiv.id = uniqID + "_sources_search_result_div";
    sourceResultDiv.setAttribute('style', "margin: 1px 3px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    //sourceResultDiv.innerHTML = "please enter search term";
    sourceResultDiv.innerHTML = "";

    //preload query trigger here
    if(zenbuDSI.source_ids && (!zenbuDSI.newconfig || !zenbuDSI.newconfig.sources_hash) ) {
      zenbuDatasourceInterfacePreload(uniqID);
    } else {
      zenbuDatasourceInterfaceShowSearchResult(uniqID);
    }
  }

  if(datasource_mode == "source") {
    var sourceTypeDiv = zenbuDSI.appendChild(document.createElement('div'));
    //----------
    //sourceSpan = ctrlOptions.appendChild(document.createElement('span'));
    //sourceSpan.id = "dex_search_datasource_select_span";
    //-
    var span1 = sourceTypeDiv.appendChild(document.createElement('span'));
    span1.setAttribute("style", "margin-left:15px; ");
    span1.innerHTML = "data source type:"
    var sourceSelect = sourceTypeDiv.appendChild(document.createElement('select'));
    sourceSelect.id = "dex_search_datasource_select";
    sourceSelect.className = "dropdown";
    sourceSelect.style.marginLeft = "3px";
    //sourceSelect.setAttribute("onchange", "dexReconfigContentsParam('datasource', this.value);");
    
    var option;
    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "all");
    option.innerHTML = "all data sources";
    
    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "experiments");
    option.innerHTML = "only experiments";
    //if(contents.filters.datasource == "experiments") { option.setAttribute("selected", "selected"); }
    
    option = sourceSelect.appendChild(document.createElement('option'));
    option.setAttribute("value", "feature_sources");
    option.innerHTML = "only feature sources";
    //if(contents.filters.datasource == "feature_sources") { option.setAttribute("selected", "selected"); }
  
    //if((contents.mode=="DataSources")||(contents.mode=="Experiments")||(contents.mode=="Annotation")) { sourceTypeDiv.style.display = "inline"; }
    //else { sourceTypeDiv.style.display = "none"; }
    
    var span0 = sourceTypeDiv.appendChild(document.createElement('span'));
    span0.setAttribute('style', "margin-left:10px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "sources pre-filter:";
    var query_filter = zenbuDSI.query_filter;
    if(zenbuDSI.newconfig && zenbuDSI.newconfig.query_filter != undefined) { query_filter = zenbuDSI.newconfig.query_filter; }
    var filterInput = sourceTypeDiv.appendChild(document.createElement('input'));
    filterInput.setAttribute('style', "width:250px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    filterInput.setAttribute('type', "text");
    filterInput.setAttribute('value', query_filter);
    filterInput.setAttribute("onkeyup", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'query_filter', this.value);");
    filterInput.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'query_filter', this.value);");
    filterInput.setAttribute("onblur", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'refresh', this.value);");

  }
  
  //post source form options
  var div1 = zenbuDSI.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 3px 0px 0px 10px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  //query_filter
  if(zenbuDSI.enableResultFilter && (datasource_mode != "source")) {
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "results filter:";
    var query_filter = zenbuDSI.query_filter;
    if(zenbuDSI.newconfig && zenbuDSI.newconfig.query_filter != undefined) { query_filter = zenbuDSI.newconfig.query_filter; }
    var filterInput = div1.appendChild(document.createElement('input'));
    filterInput.setAttribute('style', "width:250px; margin: 1px 10px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    filterInput.setAttribute('type', "text");
    filterInput.setAttribute('value', query_filter);
    filterInput.setAttribute("onkeyup", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'query_filter', this.value);");
    filterInput.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'query_filter', this.value);");
    filterInput.setAttribute("onblur", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'refresh', this.value);");
  }
  
  //query_edge_search_depth
  if(datasource_mode == "edge") {
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "edge network search depth:";
    var search_depth = zenbuDSI.query_edge_search_depth;
    if(zenbuDSI.newconfig && zenbuDSI.newconfig.query_edge_search_depth != undefined) { search_depth = zenbuDSI.newconfig.query_edge_search_depth; }
    var input = div1.appendChild(document.createElement('input'));
    input.setAttribute('style', "width:30px; margin: 1px 1px 1px 1px; font-size:10px; font-family:arial,helvetica,sans-serif;");
    input.setAttribute('type', "text");
    input.setAttribute('value', search_depth);
    input.setAttribute("onkeydown", "if(event.keyCode==13) { zenbuDatasourceInterfaceReconfigParam(\""+zenbuDSI.id+"\", 'query_edge_search_depth', this.value); }");
    input.setAttribute("onblur", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'refresh', this.value);");
  }

  //script editing
  if(zenbuDSI.enableScripting && !zenbuDSI.edit_datasource_script) {
    var div1 = zenbuDSI.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 3px 0px 0px 5px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    var button1 = div1.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 7px; font-size:10px; color:black; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button1.type = "button";
    button1.setAttribute("value", "edit data-processing script");
    button1.setAttribute("onmousedown", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'edit_datasource_script', this.value);");
  }
  
  return zenbuDSI;
}


function zenbuDatasourceInterfaceEvent(uniqID, mode, value, value2) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  console.log("zenbuDatasourceInterfaceEvent["+uniqID+"] "+mode+" value["+value+"]  value2["+value2+"]");

  if(mode == "source-info") {
    var source = null;
    if(zenbuDSI.newconfig.sources_hash) { source = zenbuDSI.newconfig.sources_hash[value]; }
    if(source) { console.log("source-info using source from zenbuDSI.newconfig.sources_hash hash. full_load:" + source.full_load); }
    if(!source) { source = eedbGetObject(value); } //uses jscript cache to hold recent objects
    if(source) {
      if(!source.full_load) { source.request_full_load = true; }
      eedbDisplaySourceInfo(source);
    }
  }
}    


function zenbuDatasourceInterfaceReconfigParam(uniqID, param, value, altvalue) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  console.log("zenbuDatasourceInterfaceReconfigParam["+uniqID+"] "+param+" value="+value+"  altvalue="+altvalue);

  if(zenbuDSI.newconfig === undefined) {
    zenbuDSI.newconfig = new Object;
  }
  var newconfig = zenbuDSI.newconfig;

  //datasource
  if(param == "datasource_mode") {  newconfig.datasource_mode = value; }
  if(param == "collaboration_filter") {  newconfig.collaboration_filter = value; }
  if(param == "edit_datasource_query") { zenbuDSI.edit_datasource_query = true; }
  if(param == "query_filter") {
    if(!value) { value = ""; }
    newconfig.query_filter = value.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
    return;
  }
  if(param == "query_edge_search_depth") { newconfig.query_edge_search_depth = value; }
  
  if(param == "species_filter") {
    if(zenbuDSI.newconfig.species_filter === undefined) { zenbuDSI.newconfig.species_filter=""; }
    else if(!zenbuDSI.newconfig.species_filter) { zenbuDSI.newconfig.species_filter = zenbuDSI.species_filter; }
    else { zenbuDSI.newconfig.species_filter = ""; }
  }
  
  //accept/reset
  if(param == "cancel-reconfig") {
    zenbuDSI.newconfig = undefined;
    //zenbuDatasourceInterfaceToggleSubpanel(uniqID, 'refresh');
    //reportsDrawElement(uniqID);
    return;
  }

  if(param == "accept-reconfig") {
    if(zenbuDSI.newconfig) {
      var newconfig = zenbuDSI.newconfig;
      
      if(newconfig.datasource_mode !== undefined) { zenbuDSI.datasource_mode = newconfig.datasource_mode; needReload=1; }
      if(newconfig.source_ids !== undefined) { zenbuDSI.source_ids = newconfig.source_ids; needReload=1; }
      if(newconfig.query_filter !== undefined) { zenbuDSI.query_filter = newconfig.query_filter; needReload=1; }
      if(newconfig.collaboration_filter !== undefined) { zenbuDSI.collaboration_filter = newconfig.collaboration_filter; needReload=1; }
      if(newconfig.query_edge_search_depth !== undefined) { zenbuDSI.query_edge_search_depth = newconfig.query_edge_search_depth; needReload=1; }
    }

    zenbuDSI.newconfig = undefined;
    
    //reportsDrawElement(uniqID);
    //zenbuDatasourceInterfaceToggleSubpanel(uniqID, 'none'); //close
    return;
  }

  if(zenbuDSI.updateCallOutFunction) { zenbuDSI.updateCallOutFunction(uniqID, "reconfig_param"); }

  zenbuDatasourceInterfaceUpdate(uniqID); //refresh
  //zenbuDatasourceInterfaceToggleSubpanel(uniqID, 'refresh'); //refresh
}


function zenbuDatasourceInterfaceCollaborationChanged(uniqID, collab_uuid) {
  console.log("zenbuDatasourceInterfaceCollaborationChanged  uniqID:"+uniqID+"  collab_uuid:"+collab_uuid);
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(zenbuDSI == null) { return; }
  zenbuDatasourceInterfaceReconfigParam(zenbuDSI.id, 'collaboration_filter', collab_uuid);
}


function zenbuDatasourceInterfaceSearchCmd(uniqID, cmd) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(zenbuDSI == null) { return; }
      
  var seachInput = document.getElementById(uniqID + "_sources_search_inputID");
  if(seachInput == null) { return; }
  
  if(!zenbuDSI.newconfig) { zenbuDSI.newconfig = new Object; }
  
  if(cmd == "clear") {
    seachInput.value ="";
    zenbuDSI.newconfig.sources_hash = new Object;
    zenbuDSI.newconfig.source_ids = "";
    zenbuDatasourceInterfaceShowSearchResult(uniqID);
  }
  if(cmd == "search") {
    var filter = "";
    if(seachInput) { filter = seachInput.value; }
    if(!filter) { filter =" "; }
    zenbuDatasourceInterfaceSubmitSearch(uniqID, filter);
  }
}


function zenbuDatasourceInterfacePreload(uniqID) {
  //preload the previous selected sources by searching based on the source_ids
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  if(!zenbuDSI.source_ids) { return; } //nothing to do
  console.log("zenbuDatasourceInterfacePreload "+uniqID);

  var sourceResultDiv = document.getElementById(uniqID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "preloading previously configured data sources...";

  if(!zenbuDSI.newconfig.sources_hash) {
    zenbuDSI.newconfig.sources_hash = new Object;
  }
  zenbuDSI.newconfig.source_ids = zenbuDSI.source_ids;
  zenbuDSI.newconfig.preload = true;

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  paramXML += "<source_ids>"+zenbuDSI.source_ids+"</source_ids>";
  paramXML += "<mode>sources</mode>";
  paramXML += "</zenbu_query>\n";
  
  var sourcesXMLHttp=GetXmlHttpObject();
  zenbuDSI.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { zenbuDatasourceInterfaceParseSearchResponse(id); };}(uniqID);
  sourcesXMLHttp.open("POST", eedbSearchCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function zenbuDatasourceInterfaceSubmitSearch(uniqID, filter) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }

  var sourceResultDiv = document.getElementById(uniqID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  sourceResultDiv.innerHTML = "searching data sources...";
  
  if(!zenbuDSI.newconfig.sources_hash) {
    zenbuDSI.newconfig.sources_hash = new Object;
  }
  
  //clear unselected sources from hash
  var sources_hash = new Object;
  for(var srcid in zenbuDSI.newconfig.sources_hash) {
    var source = zenbuDSI.newconfig.sources_hash[srcid];
    if(source && (source.selected || source.preload)) {
      sources_hash[srcid] = source;
    }
  }
  zenbuDSI.newconfig.sources_hash = sources_hash;
  
  var datasource_mode = zenbuDSI.datasource_mode;
  if(zenbuDSI.newconfig && zenbuDSI.newconfig.datasource_mode != undefined) { datasource_mode = zenbuDSI.newconfig.datasource_mode; }

  var paramXML = "<zenbu_query><format>descxml</format>\n";
  //if(datasource_mode == "feature") { paramXML += "<mode>feature_sources</mode>"; }
  if(datasource_mode == "feature") { paramXML += "<mode>sources</mode>"; }
  else if(datasource_mode == "edge") { paramXML += "<mode>edge_sources</mode>"; }
  else { paramXML += "<mode>sources</mode>";  }
  if(zenbuDSI.collabWidget) {
    paramXML += "<collab>" + zenbuDSI.collabWidget.collaboration_uuid + "</collab>";
  } else {
    paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  }
  var species_filter = zenbuDSI.species_filter;
  if(zenbuDSI.newconfig && zenbuDSI.newconfig.species_filter != undefined) { species_filter = zenbuDSI.newconfig.species_filter; }
  if(species_filter) {
    filter = species_filter+" and ("+filter+")";
  }
  console.log("filter: "+filter);
  paramXML += "<filter>" + filter + "</filter>";
  paramXML += "</zenbu_query>\n";
  //console.log(paramXML);
  
  var sourcesXMLHttp=GetXmlHttpObject();
  zenbuDSI.sourcesXMLHttp = sourcesXMLHttp;
  
  sourcesXMLHttp.onreadystatechange= function(id) { return function() { zenbuDatasourceInterfaceParseSearchResponse(id); };}(uniqID);
  sourcesXMLHttp.open("POST", eedbSearchFCGI, true);
  sourcesXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //sourcesXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //sourcesXMLHttp.setRequestHeader("Connection", "close");
  sourcesXMLHttp.send(paramXML);
}


function zenbuDatasourceInterfaceParseSearchResponse(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }

  var sourcesXMLHttp = zenbuDSI.sourcesXMLHttp;
  if(sourcesXMLHttp == null) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  if(sourcesXMLHttp.readyState!=4) { return; }
  if(sourcesXMLHttp.status!=200) { return; }
  if(sourcesXMLHttp.responseXML == null) { return; }
  
  var xmlDoc=sourcesXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    console.log("Problem with responseXML: no documentElement");
    zenbuDatasourceInterfaceShowSearchResult(uniqID);
    return;
  }
  
  var datasource_mode = zenbuDSI.datasource_mode;
  if(zenbuDSI.newconfig && zenbuDSI.newconfig.datasource_mode != undefined) { datasource_mode = zenbuDSI.newconfig.datasource_mode; }

  var sources_hash = zenbuDSI.newconfig.sources_hash;
  
  var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<xmlExperiments.length; i++) {
    var xmlSource = xmlExperiments[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {
      source = eedbParseExperimentData(xmlSource);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<xmlFeatureSources.length; i++) {
    var xmlSource = xmlFeatureSources[i];
    var srcID = xmlSource.getAttribute("id");
    if(!sources_hash[srcID]) {
      source = eedbParseFeatureSourceData(xmlSource);
      sources_hash[srcID] = source;
      source.selected = false;
    }
  }
  if(datasource_mode != "feature") { //don't parse EdgeSource if in feature/experiment mode
    var xmlEdgeSources = xmlDoc.getElementsByTagName("edgesource");
    for(i=0; i<xmlEdgeSources.length; i++) {
      var xmlSource = xmlEdgeSources[i];
      var srcID = xmlSource.getAttribute("id");
      if(!sources_hash[srcID]) {
        source = eedbParseEdgeSourceXML(xmlSource);
        sources_hash[srcID] = source;
        source.selected = false;
      }
    }
  }
  zenbuDSI.sourcesXMLHttp = undefined;
  
  //postprocess the sources to label the preload ones
  if(zenbuDSI.newconfig.preload) {
    var load_source_ids = "";
    var source_ids = zenbuDSI.source_ids;
    var ids = source_ids.split(/[\s\,]/);
    for(var i=0; i<ids.length; i++) {
      var srcID = ids[i];
      if(!srcID) { continue; }
      var source = sources_hash[srcID];
      if(source) {
        source.selected = true;
        source.preload = true;
      }
    }
    zenbuDSI.newconfig.preload=false;
  }
  
  //show sources
  zenbuDatasourceInterfaceShowSearchResult(uniqID);
}


function zenbuDatasourceInterfaceShowSearchResult(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }

  var sourceResultDiv = document.getElementById(uniqID + "_sources_search_result_div");
  if(sourceResultDiv == null) { return; }
  
  if(!zenbuDSI.newconfig.sources_hash) {
    zenbuDSI.newconfig.sources_hash = new Object;
  }
  var sources_array = new Array();
  var sources_hash = zenbuDSI.newconfig.sources_hash;
  
  var select_count = 0;
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) { select_count++; }
    sources_array.push(source);
  }
  sources_array.sort(zenbuDatasourceInterface_sources_sort_func);
  
  sourceResultDiv.innerHTML = "";
  
  //------------
  var sourceCountDiv = sourceResultDiv.appendChild(document.createElement('div'));
  sourceCountDiv.id = uniqID + "_sources_search_count_div";
  zenbuDatasourceInterfaceUpdateSearchCounts(uniqID);
  
  //----------
  var div1 = sourceResultDiv.appendChild(document.createElement('div'));
  div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow:auto; width:100%; max-height:250px;");
  
  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var thead = my_table.appendChild(document.createElement('thead'));
  var tr = thead.appendChild(document.createElement('tr'));
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "";
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "source name";
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "description";
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "source type";
  
  var tbody = my_table.appendChild(document.createElement('tbody'));
  for(i=0; i<sources_array.length; i++) {
    var source = sources_array[i];
    
    var tr = tbody.appendChild(document.createElement('tr'));
    
    if(i%2 == 0) { tr.setAttribute("style", "background-color:rgb(204,230,204);"); }
    else         { tr.setAttribute("style", "background-color:rgb(224,245,224);"); }
    
    //checkbox
    var td1 = tr.appendChild(document.createElement('td'));
    var checkbox = td1.appendChild(document.createElement('input'));
    if(zenbuDSI.allowMultipleSelect) { checkbox.setAttribute("type", "checkbox"); }
    else { 
      checkbox.setAttribute("type", "radio"); 
      checkbox.setAttribute("name", uniqID + "_search_result_radioset");
    }
    if(source.selected) { checkbox.setAttribute("checked", "checked"); }
    checkbox.setAttribute("onclick", "zenbuDatasourceInterfaceSelectSource(\""+uniqID+"\", \"" +source.id+ "\", this.checked);");
    
    //name
    var td2 = tr.appendChild(document.createElement('td'));
    var a1 = td2.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_source_view");
    a1.setAttribute("href", "./");
    //a1.setAttribute("onclick", "eedbFetchAndDisplaySourceInfo(\"" +source.id+ "\"); return false;");
    a1.setAttribute("onclick", "zenbuDatasourceInterfaceEvent(\""+uniqID+"\", 'source-info', '"+source.id+"'); return false; ");
    a1.innerHTML = source.name;
    
    //description
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.description;
    
    //class type
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.classname;
  }
  
  if(sources_array.length == 0) {
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.setAttribute("style", "background-color:rgb(204,230,204);");
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("colspan", "4");
    td.innerHTML = "no data sources selected, please enter search term";
  }
}


function zenbuDatasourceInterfaceUpdateSearchCounts(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  
  var sources_hash = zenbuDSI.newconfig.sources_hash;
  if(sources_hash == null) { return; }
  
  var sourceCountDiv = document.getElementById(uniqID + "_sources_search_count_div");
  if(sourceCountDiv == null) { return; }
  sourceCountDiv.innerHTML = "";
  
  var total_count = 0;
  var select_count = 0;
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    total_count++;
    if(source.selected) { select_count++; }
  }
  
  if(total_count>0) {
    if(select_count == total_count) {
      sourceCountDiv.innerHTML = select_count + " data sources selected";
    } else {
      sourceCountDiv.innerHTML = "selected " + select_count + " of " +total_count+" data sources";
    }
    
    if(zenbuDSI.allowMultipleSelect) {
      var a1 = sourceCountDiv.appendChild(document.createElement('a'));
      a1.setAttribute("target", "top");
      a1.setAttribute("href", "./");
      a1.setAttribute("style", "margin-left: 10px; font-size:12px;");
      a1.setAttribute("onclick", "zenbuDatasourceInterfaceSelectSource(\""+uniqID+"\", 'all'); return false;");
      a1.innerHTML = "select all";
    }
  }
}


function zenbuDatasourceInterfaceSelectSource(uniqID, srcID, mode) {
 var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
 if(!zenbuDSI) { return; }

  if(!zenbuDSI.newconfig) { return; }
  if(!zenbuDSI.newconfig.sources_hash) { return; }
    
  var sources_hash = zenbuDSI.newconfig.sources_hash;
  
  if(!zenbuDSI.allowMultipleSelect) {  //clear previous selection
    for(var srcid in sources_hash) {
      var source = sources_hash[srcid];
      if(source) { source.selected=false; }
    }
  }
  console.log("zenbuDatasourceInterfaceSelectSource "+uniqID+" "+srcID);
  if(srcID == "all") {
    for(var srcid in sources_hash) {
      var source = sources_hash[srcid];
      if(source) { source.selected = true; }
    }
    zenbuDatasourceInterfaceShowSearchResult(uniqID);
  } else {
    var source = sources_hash[srcID];
    if(source) {
      if(mode) { source.selected = true; }
      else     { source.selected = false; }
      zenbuDatasourceInterfaceUpdateSearchCounts(uniqID);
    }
  }
  
  //generate the source_id list and create title_prefix if needed
  if(zenbuDSI.title_prefix && zenbuDSI.newconfig.title_prefix == undefined) {
    zenbuDSI.newconfig.title_prefix = zenbuDSI.title_prefix;
  }
  if(!zenbuDSI.newconfig.title_prefix) { zenbuDSI.newconfig.title_prefix = ""; }
  var title = zenbuDSI.newconfig.title_prefix;
  zenbuDSI.newconfig.title_prefix = title.replace(/^\s+/, '').replace(/\s+$/, ''); //remove leading and trailing spaces
  
  zenbuDSI.newconfig.source_ids = "";
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    if(source.selected) {
      if(zenbuDSI.newconfig.source_ids) {
        zenbuDSI.newconfig.source_ids += ",";
      }
      zenbuDSI.newconfig.source_ids += source.id;
      if(zenbuDSI.newconfig.title_prefix == "") {
        zenbuDSI.newconfig.title_prefix = source.name;
      }
    }
  }
  var titleInput = document.getElementById(uniqID + "_config_title");
  if(titleInput && zenbuDSI.newconfig.title_prefix) {
    titleInput.value = zenbuDSI.newconfig.title_prefix;
  }
  //createDatatypeSelect(uniqID); //refresh
  
  if(zenbuDSI.updateCallOutFunction) { zenbuDSI.updateCallOutFunction(uniqID, "select_source"); }
}


function zenbuDatasourceInterface_sources_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }
  
  var an = String(a.name).toUpperCase();
  var bn = String(b.name).toUpperCase();
  if(an < bn) { return -1; }
  if(an > bn) { return 1; }
  
  return 0;
}






