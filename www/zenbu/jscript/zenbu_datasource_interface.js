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

    zenbuDSI.datasource_mode = "feature";  //feature, edge, source, shared_element, all_data(all datasources)
    zenbuDSI.source_ids = "";
    zenbuDSI.query_filter = "";
    zenbuDSI.query_format = "fullxml";
    zenbuDSI.edit_datasource_query = false;
    zenbuDSI.enableUploadSearchToggle = false;
    zenbuDSI.master_mode = "search";
    zenbuDSI.assembly = null;
    zenbuDSI.edit_datasource_script = false;
    zenbuDSI.allowChangeDatasourceMode = true;
    zenbuDSI.enableScripting = false;
    zenbuDSI.enableResultFilter = true;
    zenbuDSI.allowMultipleSelect = true;
    zenbuDSI.query_edge_search_depth = 1;
    zenbuDSI.show_exp=true;
    zenbuDSI.show_fsrc=true;
    zenbuDSI.show_esrc=true;

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

    //tspan = div1.appendChild(document.createElement('span'));
    //tspan.innerHTML = "data type:"
    tspan = div1.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "padding-left:2px; font-style:italic;");
    
    if(fsrc_count>0) { tspan.innerHTML += "feature_sources["+fsrc_count+"] "; }
    if(exp_count>0)  { tspan.innerHTML += "experiments["+exp_count+"] "; } 
    if(edge_count>0) { tspan.innerHTML += "edge_sources["+edge_count+"] "; }            
    
    var button1 = div1.appendChild(document.createElement('input'));
    button1.setAttribute("style", "margin-left: 7px; font-size:10px; color:black; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button1.setAttribute("type", "button");
    button1.setAttribute("value", "edit datasource query");
    button1.setAttribute("onmousedown", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'edit_datasource_query', this.value);");
 
    return zenbuDSI;
  }
  
  if(zenbuDSI.enableUploadSearchToggle) {
    //upload / search radio toggle
    var div1 = zenbuDSI.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 3px 0px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");

    radio2 = div1.appendChild(document.createElement('input'));
    radio2.setAttribute("type", "radio");
    radio2.setAttribute("name", uniqID + "_upload_search_mode");
    radio2.setAttribute("value", "search");
    if(zenbuDSI.master_mode == "search") { radio2.setAttribute('checked', "checked"); }
    radio2.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'master_mode', this.value);");
    tspan = div1.appendChild(document.createElement('span'));
    tspan.innerHTML = "search database";
    tspan.setAttribute("onclick", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'master_mode', 'search');");

    radio1 = div1.appendChild(document.createElement('input'));
    radio1.setAttribute("type", "radio");
    radio1.setAttribute("name", uniqID + "_upload_search_mode");
    radio1.setAttribute("value", "upload");
    if(zenbuDSI.master_mode == "upload") { radio1.setAttribute('checked', "checked"); }
    radio1.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'master_mode', this.value);");
    tspan = div1.appendChild(document.createElement('span'));
    tspan.innerHTML = "upload new file";
    tspan.setAttribute("onclick", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'master_mode', 'upload');");
  }
  
  if(zenbuDSI.master_mode == "upload") {
    var upload_panel = zenbuDatasourceInterfaceUploadPanel(zenbuDSI.id);
    if(upload_panel) { zenbuDSI.appendChild(upload_panel); }
    //var div1 = zenbuDSI.appendChild(document.createElement('div'));
    //div1.innerHTML = "upload interface here";
    //zenbuDSI.appendChild(document.createElement('hr'));
    return;
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
  
//   var uploadButton = div1.appendChild(document.createElement('input'));
//   uploadButton.setAttribute('style', "margin-left: 3px; ");
//   uploadButton.type = "button";
//   uploadButton.className = "slimbutton";
//   if(!zenbuDSI.master_mode) { uploadButton.setAttribute("value", "upload new file"); }
//   else { uploadButton.setAttribute("value", "search for datasources"); }
//   uploadButton.setAttribute("onmousedown", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'master_mode', this.value);");

//   if(zenbuDSI.master_mode) {
//     //special redirect to the new upload management interfaces
//     tspan = div1.appendChild(document.createElement('span'));
//     tspan.setAttribute("style", "display:inline-block; padding-top:5px;");
//     tspan.innerHTML = "upload interface here";
//     div1.appendChild(document.createElement('hr'));
//     return;
//   } else 
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

  if((datasource_mode == "edge") || (datasource_mode == "feature") || (datasource_mode == "all_data")) {  
    var altOptsDiv = zenbuDSI.appendChild(document.createElement('div'));
    altOptsDiv.setAttribute('style', "margin: 0px 1px 0px 0px; font-size:10px;");

    if(zenbuDSI.species_filter) {
      var species_filter = zenbuDSI.species_filter;
      if(zenbuDSI.newconfig && zenbuDSI.newconfig.species_filter != undefined) { species_filter = zenbuDSI.newconfig.species_filter; }
      var speciesCheck = altOptsDiv.appendChild(document.createElement('input'));
      speciesCheck.setAttribute('type', "checkbox");
      if(species_filter) { speciesCheck.setAttribute("checked", "checked"); }
      speciesCheck.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'species_filter', this.value);");
      var speciesLabel = altOptsDiv.appendChild(document.createElement('span'));
      speciesLabel.innerHTML = "restrict search to current species/assembly";
    }
    if(datasource_mode == "all_data") {
      var show_exp  = zenbuDSI.show_exp;
      var show_fsrc = zenbuDSI.show_fsrc;
      var show_esrc = zenbuDSI.show_esrc;      

      var t_label = altOptsDiv.appendChild(document.createElement('span'));
      t_label.style.marginLeft = "15px";
      t_label.innerHTML = "show search:";

      var expCheck = altOptsDiv.appendChild(document.createElement('input'));
      expCheck.style.marginLeft = "5px";
      expCheck.setAttribute('type', "checkbox");
      expCheck.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'show_exp', this.value);");
      var t_label = altOptsDiv.appendChild(document.createElement('span'));
      t_label.innerHTML = "Experiments";

      var fsrcCheck = altOptsDiv.appendChild(document.createElement('input'));
      fsrcCheck.style.marginLeft = "5px";
      fsrcCheck.setAttribute('type', "checkbox");
      fsrcCheck.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'show_fsrc', this.value);");
      var t_label = altOptsDiv.appendChild(document.createElement('span'));
      t_label.innerHTML = "FeatureSources";

      var esrcCheck = altOptsDiv.appendChild(document.createElement('input'));
      esrcCheck.style.marginLeft = "5px";
      esrcCheck.setAttribute('type', "checkbox");
      esrcCheck.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'show_esrc', this.value);");
      var t_label = altOptsDiv.appendChild(document.createElement('span'));
      t_label.innerHTML = "EdgeSources";

      if(show_exp)  { expCheck.setAttribute("checked", "checked"); }
      if(show_fsrc) { fsrcCheck.setAttribute("checked", "checked"); }
      if(show_esrc) { esrcCheck.setAttribute("checked", "checked"); }
    }

    //----------
    var sourceSearchForm = zenbuDSI.appendChild(document.createElement('form'));
    sourceSearchForm.setAttribute('style', "margin-top: 3px;");
    sourceSearchForm.setAttribute("onsubmit", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'search'); return false;");
    
    var expSpan = sourceSearchForm.appendChild(document.createElement('span'));
    expSpan.innerHTML = "Search database:";
    expSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin-right:3px;");
    
    var sourceInput = sourceSearchForm.appendChild(document.createElement('input'));
    sourceInput.id = uniqID + "_sources_search_inputID";
    sourceInput.setAttribute('style', "width:380px; margin: 1px 1px 1px 1px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    //sourceInput.setAttribute('size', "50");
    sourceInput.setAttribute('type', "text");
    
    var searchButton = sourceSearchForm.appendChild(document.createElement('input'));
    searchButton.setAttribute('style', "margin-left: 5px;");
    searchButton.type = "button";
    searchButton.className = "medbutton";
    searchButton.setAttribute("value", "search");
    searchButton.setAttribute("onclick", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'search');");
    
    var clearButton = sourceSearchForm.appendChild(document.createElement('input'));
    clearButton.type = "button";
    clearButton.className = "medbutton";
    clearButton.setAttribute("value", "clear");
    clearButton.setAttribute("onclick", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'clear');");
            
    var showButton = sourceSearchForm.appendChild(document.createElement('input'));
    showButton.type = "button";
    showButton.className = "medbutton";
    showButton.setAttribute("value", "show my uploads");
    showButton.setAttribute("onclick", "zenbuDatasourceInterfaceSearchCmd(\""+uniqID+"\", 'show_my_uploads');");

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
  if((datasource_mode == "edge") || (datasource_mode == "all_data")) {
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
  if(param == "master_mode") { zenbuDSI.master_mode = value; }
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

  if(param == "show_exp")  { zenbuDSI.show_exp = !(zenbuDSI.show_exp); }
  if(param == "show_fsrc") { zenbuDSI.show_fsrc = !(zenbuDSI.show_fsrc); }
  if(param == "show_esrc") { zenbuDSI.show_esrc = !(zenbuDSI.show_esrc); }
  
  //
  // upload params
  //
  //   if(param == "assembly") {  
  //     eedbUserSearchClear();
  //     userview.filters.assembly = value; 
  //     userview.filters.platform = "";
  //     userview.filters.search = "";
  //     //userview.current_view_index = 0;
  //     if(zenbuDSI.upload) {
  //       zenbuDSI.upload.assembly = value;
  //     }
  //     zenbuDatasourceInterfaceUploadStatusRefresh(uniqID);
  //   }
  if(param == "upload_file") {  
    if(zenbuDSI.upload) {
      zenbuDSI.upload.file_path = null;
      zenbuDSI.upload.file_format = null;

      var name = value;
      var mymatch = /^(.+)\.gz$/.exec(name);
      if(mymatch && (mymatch.length == 2)) {
        name = mymatch[1];
      }
      var mymatch = /^(.+)\.tar$/.exec(name);
      if(mymatch && (mymatch.length == 2)) {
        name = mymatch[1];
      }
      var mymatch = /^(.+)\.(\w+)$/.exec(name);
      if(mymatch && (mymatch.length == 3)) {
        var ext = mymatch[2];
        if((ext=="bed") || (ext=="sam") || (ext=="osc") ||
           (ext=="bam") || (ext=="gff") || (ext=="gff2") || (ext=="gff3") || (ext=="gtf")) {
             zenbuDSI.upload.file_format = ext.toUpperCase();
             name = mymatch[1];
        }
        if((ext=="fasta") || (ext=="fa") || (ext=="fas")) {
          zenbuDSI.upload.file_format = "GENOME";
          name = mymatch[1]; //might not need
        }
      }
      if(zenbuDSI.upload.file_format) {
        var n=name.lastIndexOf("\\");
        if(n != -1) { name = name.substr(n+1); }
        var n=name.lastIndexOf("\/");
        if(n != -1) { name = name.substr(n+1); }

        //var mymatch = /^(.+)[\/\\](\w+)$/.exec(name);
        //if(mymatch && (mymatch.length == 3)) { name = mymatch[2]; }

        name = name.replace(/[_-]/g, " ");

        // var toks = name.split(/\s/);
        // for(var i in toks) {
        //   if(userview.assemblies[toks[i]]) {
        //     zenbuDSI.upload.assembly = toks[i];
        //   }
        // }
        if(!zenbuDSI.upload.display_name) { zenbuDSI.upload.display_name = name; }
        if(!zenbuDSI.upload.description) { zenbuDSI.upload.description = name; }
        zenbuDSI.upload.file_path = value;
        
        if(zenbuDSI.updateCallOutFunction) { zenbuDSI.updateCallOutFunction(uniqID, "upload_filename"); }
        
        if(zenbuDSI.file_picker) {
          const fileList = zenbuDSI.file_picker.files; 
          console.log("selected "+(fileList.length)+" files");    
          for (let i = 0, numFiles = fileList.length; i < numFiles; i++) {
            const file = fileList[i];
            console.log("file "+i+" name["+file.name+"]  size["+file.size+"]  type["+file.type+"]");
            zenbuDSI.upload.selected_file = file;
          }
        }

      }
    }
  }
  if(param == "bedscore-express") {  
    zenbuDSI.upload.bedscore_express = value;
    if(value && (zenbuDSI.upload.datatype =="")) { zenbuDSI.upload.datatype = "score"; }
  }
  if(param == "singletagmap-express") {  
    zenbuDSI.upload.singletagmap_express = value;
  }
  if(param == "build_feature_name_index") {  
    zenbuDSI.upload.build_feature_name_index = value;
  }
  if(param == "upload-display_name") { zenbuDSI.upload.display_name  = value; return true; }
  if(param == "upload-description") { zenbuDSI.upload.description  = value; return true; }
  if(param == "upload-datatype") { zenbuDSI.upload.datatype  = value; return true; }
  
  //   if(param == "upload-genome_name") {  
  //     zenbuDSI.upload.genome_name  = value;
  //     zenbuDSI.upload.display_name  = value;
  //   }
  //   if(param == "upload-taxon_id") {  
  //     zenbuDSI.upload.taxon_id  = value;
  //     //eedbUserGetNCBITaxonInfo(zenbuDSI.upload.taxon_id);
  //   }
  //    if(param == "upload-edge-mode") {  
  //     zenbuDSI.upload.edgemode  = value;
  //   }
  //   if(param == "upload-strict_edge_linking") {  
  //     zenbuDSI.upload.strict_edge_linking = value;
  //   }
  if(param == "upload-submit") {  
    zenbuDatasourceInterfaceUploadFilePrep(zenbuDSI.id);
  }

  //-------------------------------------------------------  
  
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
  if(cmd == "show_my_uploads") {
    zenbuDSI.collaboration_filter = "private";
    eedbCollaborationPulldownChanged(uniqID, zenbuDSI.collaboration_filter); //set internally
    eedbCollaborationPulldown("filter_search", zenbuDSI.id); //refresh
    zenbuDatasourceInterfaceSubmitSearch(uniqID, " ");
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
  if((datasource_mode == "feature") || (datasource_mode == "all_data")) { paramXML += "<mode>sources</mode>"; }
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
    source.hide = false;
    if(source.selected) { select_count++; }
    else {
      if(source.classname == "Experiment" && !zenbuDSI.show_exp) { source.hide = true; continue; }
      if(source.classname == "FeatureSource" && !zenbuDSI.show_fsrc) { source.hide = true; continue; }
      if(source.classname == "EdgeSource" && !zenbuDSI.show_esrc) { source.hide = true; continue; }
    }
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
  div1.setAttribute("style", "border:1px black solid; background-color:snow; overflow-y:scroll; overflow-x:hidden; width:730px; max-height:250px;");
  
  // display as table
  var my_table = div1.appendChild(document.createElement('table'));
  my_table.setAttribute("style", "width:720px;");
  my_table.setAttribute("width", "720px");
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
  var th = tr.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "upload date";
    
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
    var tdiv = a1.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "word-wrap:break-word; width:220px;"); 
    tdiv.innerHTML = source.name;
    
    //description
    var td3 = tr.appendChild(document.createElement('td'));
    var tdiv = td3.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "word-wrap:break-word; width:220px;"); 
    tdiv.innerHTML = source.description;
    
    //class type
    var td3 = tr.appendChild(document.createElement('td'));
    td3.innerHTML = source.classname;
    
    //create data/owner/edit cell
    var td4 = tr.appendChild(document.createElement('td'));
    td4.setAttribute("nowrap", "nowrap");
    var tdiv = td4.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = source.owner_identity;
    var tdiv = td4.appendChild(document.createElement('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = encodehtml( source.import_date);
  }
  
  if(sources_array.length == 0) {
    var tr = tbody.appendChild(document.createElement('tr'));
    tr.setAttribute("style", "background-color:rgb(204,230,204);");
    var td = tr.appendChild(document.createElement('td'));
    td.setAttribute("colspan", "5");
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
    if(source.selected) { select_count++; total_count++; }
    else if(!source.hide) { total_count++; }
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
      if(!source) { continue; }
      if(source.hide) { continue; }
      source.selected = true;
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
  
  if(!a.selected && b.selected) { return 1; }
  if(a.selected && !b.selected) { return -1; }

  if(!a.import_timestamp && b.import_timestamp) { return 1; }
  if(a.import_timestamp && !b.import_timestamp) { return -1; }

  if(a.import_timestamp < b.import_timestamp) { return 1; }
  if(a.import_timestamp > b.import_timestamp) { return -1; }

  var an = String(a.name).toUpperCase();
  var bn = String(b.name).toUpperCase();
  if(an < bn) { return -1; }
  if(an > bn) { return 1; }
  
  return 0;
}


//---------------------------------------------------------------------
//
// upload interface section
//
//---------------------------------------------------------------------

function zenbuDatasourceInterfaceUploadPanel(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }

  if(!zenbuDSI.upload) {
    zenbuDSI.upload = new Object;
    zenbuDSI.upload.assembly = zenbuDSI.assembly;
    zenbuDSI.upload.display_name = "";
    zenbuDSI.upload.description = "";
    zenbuDSI.upload.datatype = "";
    zenbuDSI.upload.edgemode = "node";
    zenbuDSI.upload.strict_edge_linking = true;
    zenbuDSI.upload.file_format = null;
    zenbuDSI.upload.file_path = null;
    zenbuDSI.upload.status = "";
    zenbuDSI.upload.file_sent = false;
    
  }
  
//   if(zenbuDSI.upload_refreshInterval) {
//     window.clearInterval(zenbuDSI.upload_refreshInterval);
//     zenbuDSI.upload_refreshInterval = undefined;
//   }

  if(!zenbuDSI.upload_panel) { zenbuDSI.upload_panel = document.createElement('div'); }

  var upload_panel = zenbuDSI.upload_panel;
  upload_panel.style.fontSize = "12px";
  upload_panel.style.marginLeft = "15px";
  upload_panel.innerHTML = "";
  
  var div1, form, label1, input1, text1, span1;

//   div1 = upload_panel.appendChild(document.createElement('div'));
//   div1.setAttribute('style', "color:red; margin: 10px 0px 10px 0px; text-decoration:none; font-size:10px;");
//   div1.innerHTML ="Disclaimer: The ZENBU user system is designed to be secured. By design your uploaded data will only be available to you and your selected collaborators with whom you choose to share the data.  But note that we do not guarantee the security or privacy of your data, and we can not be held responsible for your data security.";
  
  if(zenbuDSI.upload.file_sent) {
    //first basic file info: file name, size, assembly
    div1 = upload_panel.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 5px 0px; text-decoration:none; font-size:12px;");

    if(!zenbuDSI.upload.selected_file) { return zenbuDSI.upload_panel; }

    var file_info = zenbuDSI.upload.file_info;
    var selected_file = zenbuDSI.upload.selected_file;

    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "font-weight:bold; color:rgb(20, 181, 162);");
    span1.innerHTML = zenbuDSI.upload.selected_file.name;
    
    span1 = div1.appendChild(document.createElement('span'));
    span1.style.marginLeft = "10px";
    span1.innerHTML = "size: ";
    var span2 = div1.appendChild(document.createElement('span'));
    span2.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
    var file_len = zenbuDSI.upload.selected_file.size;
    if(file_len > 1024*1024) { span2.innerHTML = (file_len/1024.0/1024.0).toFixed(3) + " MBytes"; } 
    else if(file_len > 1024) { span2.innerHTML = (file_len/1024.0).toFixed(3) + " KBytes"; } 
    else { span2.innerHTML = file_len+ " bytes"; }

    if(zenbuDSI.upload.assembly) {
      span1 = div1.appendChild(document.createElement('span'));
      span1.style.marginLeft = "10px";
      span1.innerHTML = "genome: ";
      span1 = div1.appendChild(document.createElement('span'));
      span1.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
      span1.innerHTML = zenbuDSI.upload.assembly;
    }

    //status and progress
    if(!zenbuDSI.upload.status_div) {
      zenbuDSI.upload.status_div = document.createElement('div');
      zenbuDSI.upload.status_div.setAttribute('style', "margin: 0px 0px 5px 0px; text-decoration:none; font-size:12px;");
    }
    upload_panel.appendChild(zenbuDSI.upload.status_div);
    zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);

    div1 = upload_panel.appendChild(document.createElement('div'));
    div1.id = "eedb_user_upload_send_message";
    div1.innerHTML = "";

    return zenbuDSI.upload_panel;
  }

  div1 = upload_panel.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 5px 0px; text-decoration:none; font-size:10px;");
  div1.innerHTML="ZENBU supports ";
  div1.innerHTML +="<a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/BED'>BED</a>";
  div1.innerHTML +=", <a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/BAM'>BAM</a>";
  div1.innerHTML +=", <a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/GFF_and_GTF_file_support'>GFF3/GFF2/GTF</a>";
  div1.innerHTML +=", and <a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/OSCtable'>OSC</a> ";
  div1.innerHTML +=" files for upload. Texted based files can be gzip (.gz) compressed prior to upload";

  form = upload_panel.appendChild(document.createElement('form'));
  form.id = "eedb_user_upload_form";
  //form.setAttribute("action", eedbWebRoot + "/cgi/eedb_upload_file.cgi");
  //form.setAttribute("method", "POST");
  form.setAttribute("enctype", "multipart/form-data");
  zenbuDSI.upload_form = form;

  div1 = form.appendChild(document.createElement('div'));
  //div1.setAttribute('style', "margin: 0px 0px 20px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "File to upload: ";

  if(!zenbuDSI.file_picker) { 
    input1 = document.createElement('input');
    input1.id  = "eedb_upload_file";
    input1.setAttribute("type", "file");
    input1.setAttribute("name", "upload_file");
    input1.setAttribute("size", "50");
    input1.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload_file', this.value);");
    zenbuDSI.file_picker = input1;
  }
  div1.appendChild(zenbuDSI.file_picker);
  
  div1 = form.appendChild(document.createElement('div'));
  div1.style.marginTop = "3px";
  span1 = div1.appendChild(document.createElement('span'));
  //span1.setAttribute("style", "margin-right:5px;");
  span1.innerHTML ="file type: ";
  span1 = div1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
  if(zenbuDSI.upload.file_format) { span1.innerHTML = zenbuDSI.upload.file_format; }
  else { span1.innerHTML ="unknown file type"; }
  if(zenbuDSI.upload.selected_file) {
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "margin-left:15px;");
    span1.innerHTML ="size: ";
    var span2 = div1.appendChild(document.createElement('span'));
    span2.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
    var file_len = zenbuDSI.upload.selected_file.size;
    if(file_len > 1024*1024) { span2.innerHTML = (file_len/1024.0/1024.0).toFixed(3) + " MBytes"; } 
    else if(file_len > 1024) { span2.innerHTML = (file_len/1024.0).toFixed(3) + " KBytes"; } 
    else { span2.innerHTML = file_len+ " bytes"; }
  }
  if(zenbuDSI.assembly) {
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "margin-left:15px;");
    span1.innerHTML ="genome: ";
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
    if(zenbuDSI.upload.assembly) { span1.innerHTML = zenbuDSI.upload.assembly; }
    else { span1.innerHTML ="not defined"; }
  } else {
    div1 = form.appendChild(document.createElement('div'));
    var genomeWidget = zenbuGenomeSelectWidget("upload", zenbuDSI.id);
    genomeWidget.style.marginLeft = "0px";
    //genomeWidget.callOutFunction = eedbUserGenomeSelectCallout;
    zenbuDSI.upload.genomeWidget = genomeWidget;
    div1.appendChild(genomeWidget);
    zenbuGenomeSelectUpdate(zenbuDSI.id);
  }
  
  //--------  express options
  var express_options = form.appendChild(document.createElement('div'));
  express_options.setAttribute("style", "margin:3px 0px 0px 15px; display:none;");
  express_options.id = "eedb_user_upload_expression_options";

  var tdiv,tdiv2,tcheck,tspan1,tspan2;

  var bedscore_options = express_options.appendChild(document.createElement('div'));
  //bedscore_options.id = "eedb_user_upload_bedscore_options";
  bedscore_options.setAttribute("style", "display:none;");
  tcheck = bedscore_options.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 0px;");
  tcheck.setAttribute('name', "bedscore_expression");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'bedscore-express', this.checked);");
  if(zenbuDSI.upload.bedscore_express) {tcheck.setAttribute("checked", "checked"); }
  tspan2 = bedscore_options.appendChild(document.createElement('span'));
  tspan2.innerHTML = " score column has experimental signal values";

  var datatype_div = bedscore_options.appendChild(document.createElement('div'));
  datatype_div.id = "eedb_user_upload_datatype_div";
  datatype_div.setAttribute("style", "margin-left:10px;");
  tspan2 = datatype_div.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression datatype:";
  var datatype_input = datatype_div.appendChild(document.createElement('input'));
  datatype_input.id  = "eedb_user_upload_datatype";
  datatype_input.setAttribute("type", "text");
  datatype_input.setAttribute("name", "datatype");
  datatype_input.setAttribute("size", "20");
  datatype_input.setAttribute("value", zenbuDSI.upload.datatype);
  datatype_input.setAttribute("onkeyup", "if(event.keyCode==13) { zenbuDatasourceInterfaceReconfigParam(\""+zenbuDSI.id+"\", 'refresh', this.value); } else { zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-datatype', this.value); }");
  datatype_input.setAttribute("onblur", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'refresh', this.value);");

  tspan2 = datatype_div.appendChild(document.createElement('span'));
  tspan2.setAttribute("style", "margin-left:5px;");
  tspan2.innerHTML = "(eg: tagcount, norm, raw, tpm, rle, score, pvalue....)";

  tdiv = express_options.appendChild(document.createElement('div'));
  tcheck = tdiv.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 0px;");
  tcheck.setAttribute('name', "singletagmap_expression");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'singletagmap-express', this.checked);");
  if(zenbuDSI.upload.singletagmap_express) {tcheck.setAttribute("checked", "checked"); }
  tspan2 = tdiv.appendChild(document.createElement('span'));
  tspan2.innerHTML = " single-tagcount expression";
  tdiv2 = tdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-left:20px;");
  tdiv2.innerHTML = "Count each line of file as expression of 1 tagcount (no correction for 'multi-mapping' locations).";

  //--------  name index options : still buggy for bed files 
  name_index_options = form.appendChild(document.createElement('div'));
  name_index_options.setAttribute("style", "margin:3px 0px 0px 15px; display:none;");
  name_index_options.id = "eedb_user_upload_name_index_options";
  /* still buggy for bed files */
  tdiv = name_index_options.appendChild(document.createElement('div'));
  tcheck = tdiv.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 0px;");
  tcheck.setAttribute('name', "build_feature_name_index");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'build_feature_name_index', this.checked);");
  if(zenbuDSI.upload.build_feature_name_index) {tcheck.setAttribute("checked", "checked"); }
  tspan2 = tdiv.appendChild(document.createElement('span'));
  tspan2.innerHTML = " build name search indexing (<span style=\"color:#FF4500; \">WARN</span> only for annotation features with unique names)";


  //-------- data file uploads name/description --------
  var namedesc_options = form.appendChild(document.createElement('div'));
  namedesc_options.id = "eedb_user_upload_namedesc_options";
  namedesc_options.setAttribute("style", "display:none;");

//   //node-edge options
//   node_edge_options = namedesc_options.appendChild(document.createElement('div'));
//   node_edge_options.setAttribute("style", "display:none;");
//   node_edge_options.id = "eedb_user_upload_node_edge_options";
//  
//   var fsrc1 = form.appendChild(document.createElement('input'));
//   fsrc1.id  = "eedb_upload_edge_fsrc1";
//   fsrc1.setAttribute("type", "hidden");
//   fsrc1.setAttribute("name", "featuresource1");
//   fsrc1.setAttribute("value", "");
//   var fsrc2 = form.appendChild(document.createElement('input'));
//   fsrc2.id  = "eedb_upload_edge_fsrc2";
//   fsrc2.setAttribute("type", "hidden");
//   fsrc2.setAttribute("name", "featuresource2");
//   fsrc2.setAttribute("value", "");

  //----------  
  //var platform_span = eedbUserCreatePlatformSelect();
  //div1.appendChild(platform_span);

  //namedesc_options.appendChild(document.createElement('hr'));

  div1 = namedesc_options.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "Display name: ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_upload_display_name";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "display_name");
  input1.setAttribute("size", "50");
  if(zenbuDSI.upload.display_name) { input1.setAttribute("value", zenbuDSI.upload.display_name); }
  input1.setAttribute("onkeyup", "if(event.keyCode==13) { zenbuDatasourceInterfaceReconfigParam(\""+zenbuDSI.id+"\", 'refresh', this.value); } else { zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-display_name', this.value); }");
  input1.setAttribute("onblur", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'refresh', this.value);");
  
  div1 = namedesc_options.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  div1.innerHTML="description of data file";
  div1 = namedesc_options.appendChild(document.createElement('div'));
  text1 = div1.appendChild(document.createElement('textarea'));
  text1.id  = "eedb_upload_description";
  text1.setAttribute("style", "max-width:650px; min-width:650px; min-height:30px;");
  text1.setAttribute("rows", "3");
  text1.setAttribute("name", "description");
  if(zenbuDSI.upload.description) { text1.value = zenbuDSI.upload.description; }
  text1.setAttribute("onkeyup", "if(event.keyCode==13) { zenbuDatasourceInterfaceReconfigParam(\""+zenbuDSI.id+"\", 'refresh', this.value); } else { zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-description', this.value); }");
  text1.setAttribute("onblur", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\", 'refresh', this.value);");

  
  if(zenbuDSI.upload.file_format) { 
    if(zenbuDSI.upload.file_format == "GENOME") {
      genome_options.setAttribute("style", "display:block;");
      if(!zenbuDSI.upload.genome_name || !zenbuDSI.upload.taxon_id || !zenbuDSI.upload.file_path) { button.setAttribute("disabled", "disabled"); }
      else { button.removeAttribute("disabled"); }
    } else {
      namedesc_options.setAttribute("style", "display:block;");
      if(zenbuDSI.upload.file_format != "BAM") {
        //if(!zenbuDSI.upload.file_format || (zenbuDSI.upload.file_format == "BAM")) {
        //  express_options.setAttribute("style", "display:none;");
        //} else {
        express_options.setAttribute("style", "margin:3px 0px 0px 15px; display:block;");
        bedscore_options.setAttribute("style", "display:none;");
        datatype_div.setAttribute("style", "display:none;");

        if((zenbuDSI.upload.file_format == "BED") || (zenbuDSI.upload.file_format == "OSC")) {
          bedscore_options.setAttribute("style", "display:block;");
          if(zenbuDSI.upload.bedscore_express) { datatype_div.setAttribute("style", "margin-left:15px; display:block;"); } 
          else { datatype_div.setAttribute("style", "display:none;"); }
          datatype_input.setAttribute("value", zenbuDSI.upload.datatype);
        }
        if((zenbuDSI.upload.file_format == "BED") || (zenbuDSI.upload.file_format == "GFF")) {
          name_index_options.setAttribute("style", "margin:3px 0px 0px 15px; display:block;");
        }
      }
    }
  }

//   //-------- genome upload options --------
//   genome_div = form.appendChild(document.createElement('div'));
//   genome_div.id = "eedb_user_upload_genome_div";
//   genome_div.setAttribute("style", "display:none;");
// 
//   div1 = genome_div.appendChild(document.createElement('div'));
//   div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
//   label1 = div1.appendChild(document.createElement('label'));
//   label1.innerHTML = "NCBI taxon_id: ";
//   var input1 = div1.appendChild(document.createElement('input'));
//   input1.id  = "eedb_upload_taxon_id";
//   input1.setAttribute("type", "text");
//   input1.setAttribute("name", "taxon_id");
//   input1.setAttribute("size", "20");
//   input1.setAttribute("onkeypress", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-taxon_id', this.value);");
// 
//   div1 = genome_div.appendChild(document.createElement('div'));
//   div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
//   label1 = div1.appendChild(document.createElement('label'));
//   label1.innerHTML = "genome unique name (eg rheMac2): ";
//   var input1 = div1.appendChild(document.createElement('input'));
//   input1.id  = "eedb_upload_genome_name";
//   input1.setAttribute("type", "text");
//   input1.setAttribute("name", "upload_genome_name");
//   input1.setAttribute("size", "20");
//   input1.setAttribute("onkeypress", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-genome_name', this.value);");


  //-------- upload button --------
  div1 = form.appendChild(document.createElement('div'));
  div1.style.margin = "5px 0px 5px 0px";
  var input2 = div1.appendChild(document.createElement('input'));
  input2.id = "eedb_user_upload_button";
  //input2.className = "medbutton";
  input2.style.width = "200px";
  input2.setAttribute("type", "button");
  input2.setAttribute("disabled", "disabled");
  input2.setAttribute("value", "Upload file");
  input2.setAttribute("onmousedown", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-submit', '');");
  if(!zenbuDSI.upload.assembly || !zenbuDSI.upload.file_path || zenbuDSI.upload.file_sent) { 
    input2.setAttribute("disabled", "disabled");
  } else { 
    input2.className = "largebutton";
    input2.removeAttribute("disabled"); 
    input2.style.background = "orange";
    input2.style.width = "500px";
  }
  
  div1 = upload_panel.appendChild(document.createElement('div'));
  div1.id = "eedb_user_upload_send_message";
  div1.innerHTML = "";
  
  return zenbuDSI.upload_panel;
}


function zenbuDatasourceInterfaceUploadStatusRefresh(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }

  if(!zenbuDSI.upload) { return false; }

  var upload_panel = zenbuDSI.upload_panel;
  if(!upload_panel) { return false; }
  if(!zenbuDSI.upload.status_div) { return false; }

  var file_info = zenbuDSI.upload.file_info;
  var selected_file = zenbuDSI.upload.selected_file;

  var status_div = zenbuDSI.upload.status_div;
  status_div.innerHTML = "";

  div1 = status_div.appendChild(document.createElement('div'));

  span1 = div1.appendChild(document.createElement('span'));
  span1.innerHTML = "status: ";      
  var span2 = div1.appendChild(document.createElement('span'));
  span2.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
  span2.innerHTML = zenbuDSI.upload.status;
  var span3 = div1.appendChild(document.createElement('span'));
  span3.style = "margin-left:5px; font-size:10px;";

  console.log("zenbuDatasourceInterfaceUploadStatusRefresh : "+zenbuDSI.upload.status);
  
  if(zenbuDSI.upload.status == "success")   { } 
  if(zenbuDSI.upload.status == "error")     { } 
  if(zenbuDSI.upload.status == "abort")     { } 
  if(zenbuDSI.upload.status == "timeout")   { } 
  if(zenbuDSI.upload.status == "loadstart") {
    //console.log("file copy started file name["+selected_file.name+"]  size["+selected_file.size+"]  type["+selected_file.type+"]  safe["+file_info.safe_file+"]");
    zenbuDSI.upload.progress_bar = 0.1;
  }
  if(zenbuDSI.upload.status == "copying") {
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin-left:10px; text-decoration:none; font-size:12px;");
    span1.innerHTML = "progress: "+(zenbuDSI.upload.copy_progress*100.0).toFixed(1) + "%";
    zenbuDSI.upload.progress_bar = 0.1 + (zenbuDSI.upload.copy_progress * 0.5);
  }
  if(zenbuDSI.upload.status == "loadend") {
    //div1 = status_div.appendChild(document.createElement('div'));
    //div1.setAttribute('style', "margin: 0px 0px 5px 0px; text-decoration:none; font-size:12px;");
    //div1.innerHTML = "FINISHED copy ["+file_info.safe_file+"]";
    zenbuDSI.upload.progress_bar = 0.65;
  }
  if(zenbuDSI.upload.status == "QUEUED") { 
    zenbuDSI.upload.progress_bar = 0.7;
  }
  if(zenbuDSI.upload.status == "RUN") { 
    span2.innerHTML = "BUILDING INDEXES";
    zenbuDSI.upload.progress_bar = 0.8;
    span3.innerHTML ="(this may take a long time with large or complex files)";
  }
  if(zenbuDSI.upload.status == "UPLOAD COMPLETE") { 
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "margin-left:10px; text-decoration:none; font-size:12px;");
    span1.innerHTML = file_info.safe_file;
    zenbuDSI.upload.progress_bar = 0.9;
  }

  //console.log(`zenbuDSI ${zenbuDSI.id} : ${zenbuDSI.upload.status}: ${e.loaded} bytes transferred of ${e.total}`);
  //console.log(`upload ${zenbuDSI.upload.status}: ${e.loaded} bytes transferred of ${e.total}`);

  //
  //progress bar
  //
  var mainRect = zenbuDSI.getBoundingClientRect();
  var bar_width = mainRect.width-50;
  
  var tdiv = status_div.appendChild(document.createElement('div'));
  
  var tspan2 = tdiv.appendChild(document.createElement('span'));
  tspan2.setAttribute('style', "display:inline-block; position:relative; margin-left:2px; border-radius:7px; height:14px; font-size:10px;");
  tspan2.style.backgroundColor = "lightgray";
  //('style', "display:inline-block; position:relative; margin-left:2px; background-color:lightgray; border-radius:7px; height:14px; font-size:10px;");
  //tspan2.style.width = ((content_width-30)/2)+"px";
  tspan2.style.width = (bar_width)+"px";

  var varwidth = bar_width*(zenbuDSI.upload.progress_bar);
  tspan3 = tspan2.appendChild(document.createElement('span'));
  var bckcolor = "lightblue";
  //if(ctg_obj.filtered) { bckcolor = "#a7f1a7"; }
  tspan3.setAttribute('style', "display:inline-block; position:absolute; background-color:"+bckcolor+"; border-radius:7px; height:14px; left:0px; top:0px;");
  if(varwidth>12) { tspan3.style.width = parseInt(varwidth)+"px"; }
  else {
    tspan3.style.width = "12px";
    var clip1 = tspan2.appendChild(document.createElement('span'));
    clip1.setAttribute('style', "display:inline-block; position:absolute; height:14px; left:0px; top:0px; overflow:hidden;");
    clip1.style.width = parseInt(varwidth)+"px";
    clip1.appendChild(tspan3);
  }
}  



  //     var dispname = document.getElementById("eedb_upload_display_name");
  //     if(dispname) {
  //       dispname.setAttribute("value", zenbuDSI.upload.display_name);
  //     }
  //     var desc = document.getElementById("eedb_upload_description");
  //     if(desc) {
  //       desc.value = zenbuDSI.upload.description;
  //     }
  //     var button = document.getElementById("eedb_user_upload_button");
  //     if(button) {
  //       if(!zenbuDSI.upload.assembly || !zenbuDSI.upload.file_path || zenbuDSI.upload.file_sent) { button.setAttribute("disabled", "disabled"); }
  //       else { button.removeAttribute("disabled"); }
  //     } 
  //     var filetype = document.getElementById("eedb_upload_filetype");
  //     if(filetype) {
  //       if(zenbuDSI.upload.file_format) { filetype.innerHTML = zenbuDSI.upload.file_format; }
  //       else { filetype.innerHTML ="unknown file type"; }
  //       if(zenbuDSI.upload.file_format == "BAM") {
  //         //filetype.innerHTML +=" <br><span style='color:red; font-size:10px; font-weight:normal;'>Note that BAM files must include a valid <a target='_blank' href='http://samtools.github.io/hts-specs/SAMv1.pdf'>header</a>. Check with samtools -H [file] prior to upload if you are uncertain.</span>";
  //       }
  //     }
  //     var sendmsg = document.getElementById("eedb_user_upload_send_message");
  //     if(sendmsg && zenbuDSI.upload.file_sent) {
  //       sendmsg.innerHTML = "File is now copying to server. Please wait....";
  //     }
  // 
  //     if(zenbuDSI.upload.assembly) { current_genome.name = zenbuDSI.upload.assembly; }
  //     if(zenbuDSI.upload.genomeWidget) {
  //       if(zenbuDSI.upload.file_format == "OSC") { zenbuDSI.upload.genomeWidget.setAttribute("allow_non_genomic", "true"); }
  //       else { zenbuDSI.upload.genomeWidget.setAttribute("allow_non_genomic", "false"); }
  //     }
  //     zenbuGenomeSelectUpdate();
  //     
  //     /*
  //     var assemblySelect = document.getElementById("_assemblySelect");
  //     if(assemblySelect) {
  //       for(var i=0;i<assemblySelect.options.length;i++) {
  //         if(assemblySelect.options[i].value == zenbuDSI.upload.assembly) {
  //           assemblySelect.options[i].selected = true;
  //         }
  //       }
  //     }
  //     */
  // 
  //     var express_options  =  document.getElementById("eedb_user_upload_expression_options");
  //     var bedscore_options = document.getElementById("eedb_user_upload_bedscore_options");
  //     var namedesc_options = document.getElementById("eedb_user_upload_namedesc_options");
  //     var genome_options   = document.getElementById("eedb_user_upload_genome_div");
  //     var edge_options     = document.getElementById("eedb_user_upload_node_edge_options");
  //     var datatype_div     = document.getElementById("eedb_user_upload_datatype_div");
  //     var datatype_input   = document.getElementById("eedb_user_upload_datatype");
  //     var name_index_options   = document.getElementById("eedb_user_upload_name_index_options");
  // 
  //     express_options.setAttribute("style", "display:none;");
  //     namedesc_options.setAttribute("style", "display:none;");
  //     bedscore_options.setAttribute("style", "display:none;");
  //     genome_options.setAttribute("style", "display:none;");
  //     edge_options.setAttribute("style", "display:none;");
  //     name_index_options.setAttribute("style", "display:none;");
  // 
  //     if(zenbuDSI.upload.file_format) { 
  //       if(zenbuDSI.upload.file_format == "GENOME") {
  //         genome_options.setAttribute("style", "display:block;");
  //         if(!zenbuDSI.upload.genome_name || !zenbuDSI.upload.taxon_id || !zenbuDSI.upload.file_path) { button.setAttribute("disabled", "disabled"); }
  //         else { button.removeAttribute("disabled"); }
  //       } else {
  //         namedesc_options.setAttribute("style", "display:block;");
  //         if(zenbuDSI.upload.file_format != "BAM") {
  //           //if(!zenbuDSI.upload.file_format || (zenbuDSI.upload.file_format == "BAM")) {
  //           //  express_options.setAttribute("style", "display:none;");
  //           //} else {
  //           express_options.setAttribute("style", "margin:3px 0px 0px 15px; display:block;");
  //           bedscore_options.setAttribute("style", "display:none;");
  //           datatype_div.setAttribute("style", "display:none;");
  // 
  //           if((zenbuDSI.upload.file_format == "BED") || (zenbuDSI.upload.file_format == "OSC")) {
  //             bedscore_options.setAttribute("style", "display:block;");
  //             if(zenbuDSI.upload.bedscore_express) { datatype_div.setAttribute("style", "margin-left:15px; display:block;"); } 
  //             else { datatype_div.setAttribute("style", "display:none;"); }
  //             datatype_input.setAttribute("value", zenbuDSI.upload.datatype);
  //           }
  //           if((zenbuDSI.upload.file_format == "BED") || (zenbuDSI.upload.file_format == "GFF")) {
  //             name_index_options.setAttribute("style", "margin:3px 0px 0px 15px; display:block;");
  //           }
  //         }
  //       }
  //     }
  //     
  //     if(zenbuDSI.upload.assembly == "non-genomic") {
  //       edge_options.setAttribute("style", "display:block;");
  //       edge_options.innerHTML = "";
  //     
  //       tdiv = edge_options.appendChild(document.createElement('div'));
  //       tspan = tdiv.appendChild(document.createElement('span'));
  //       tspan.setAttribute('style', "margin:0px 3px 0px 5px;");
  //       tspan.innerHTML = "non-genomic data type:";
  // 
  //       var radio1 = tdiv.appendChild(document.createElement('input'));
  //       radio1.setAttribute("type", "radio");
  //       radio1.setAttribute("value", "node");
  //       radio1.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-edge-mode', this.value);");
  //       if(zenbuDSI.upload.edgemode == "node") { radio1.setAttribute("checked", "checked"); }
  //       tspan = tdiv.appendChild(document.createElement('span'));
  //       tspan.innerHTML = "nodes";
  // 
  //       var radio2 = tdiv.appendChild(document.createElement('input'));
  //       radio2.setAttribute("style", "margin-left:20px;");
  //       radio2.setAttribute("type", "radio");
  //       radio2.setAttribute("value", "edge");
  //       if(zenbuDSI.upload.edgemode == "edge") { radio2.setAttribute("checked", "checked"); }
  //       radio2.setAttribute("onchange", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-edge-mode', this.value);");
  //       tspan = tdiv.appendChild(document.createElement('span'));
  //       tspan.innerHTML = "edges";
  // 
  //       if(zenbuDSI.upload.edgemode == "edge") {
  //         var strict_edge_linking = tdiv.appendChild(document.createElement('input'));  //to right of the above radios
  //         strict_edge_linking.style.marginLeft = "35px";
  //         strict_edge_linking.setAttribute("type", "checkbox");
  //         strict_edge_linking.setAttribute("name", "strict_edge_linking");
  //         //strict_edge_linking.setAttribute("value", "true");
  //         strict_edge_linking.setAttribute("onclick", "zenbuDatasourceInterfaceReconfigParam(\""+ zenbuDSI.id +"\",'upload-strict_edge_linking', this.checked);");
  //         if(zenbuDSI.upload.strict_edge_linking) { strict_edge_linking.setAttribute("checked", "checked"); }
  //         tspan = tdiv.appendChild(document.createElement('span'));
  //         tspan.innerHTML = "strict edge-node linking";
  //         var msg = "<div style='text-align:left;'>strict linking <b>enabled</b>: if it's unable to finding a matching node for any edgef1/edgef2 lookup, it will cause an upload parsing error and FAIL the upload.<p><b>disabled</b>: failure to find a matching node will cause that edge to be skipped but loading will continue</div>"; 
  //         strict_edge_linking.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",300);");
  //         strict_edge_linking.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  //         tspan.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",300);");
  //         tspan.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  // 
  //         
  //         //-----
  //         tdiv = edge_options.appendChild(document.createElement('div'));
  //         tdiv.setAttribute('style', "margin:3px 0px 3px 5px;");
  //         //tspan = tdiv.appendChild(document.createElement('span'));
  //         //tspan.setAttribute('style', "margin-right:3px;");
  //         //tspan.innerHTML = "options for setting the featuresource1 and featuresource2 here";
  //         
  //         var tdiv2 = tdiv.appendChild(document.createElement('div'));
  //         tdiv2.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  //         tdiv2.innerHTML ="Edge left-node featuresource:";
  //         var dsi1 = zenbuDatasourceInterface();
  //         dsi1.edit_datasource_query = true;
  //         dsi1.allowChangeDatasourceMode = false;
  //         dsi1.enableResultFilter = false;
  //         dsi1.allowMultipleSelect = false;
  //         dsi1.datasource_mode = "feature";
  //         dsi1.style.marginLeft = "5px";
  //         tdiv.appendChild(dsi1);
  //         zenbuDSI.upload.dsi1 = dsi1;
  //         
  //         var tdiv2 = tdiv.appendChild(document.createElement('div'));
  //         tdiv2.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold; margin-top:7px;");
  //         tdiv2.innerHTML ="Edge right-node featuresource:";
  //         var dsi2 = zenbuDatasourceInterface();
  //         dsi2.edit_datasource_query = true;
  //         dsi2.allowChangeDatasourceMode = false;
  //         dsi2.enableResultFilter = false;
  //         dsi2.allowMultipleSelect = false;
  //         dsi2.datasource_mode = "feature";
  //         dsi2.style.marginLeft = "5px";
  //         tdiv.appendChild(dsi2);
  //         zenbuDSI.upload.dsi2 = dsi2;
  //         
  //         //dsi1.source_ids = "D905615F-C6AA-41D5-A0C4-6F4F61705A80::1:::FeatureSource"; //just for testing interface code
  //         //dsi2.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::17:::FeatureSource";
  // 
  //         dsi1.updateCallOutFunction = eedbUserEdgeDSIUpdate;
  //         dsi2.updateCallOutFunction = eedbUserEdgeDSIUpdate;
  //         
  //         zenbuDatasourceInterfaceUpdate(dsi1.id);
  //         zenbuDatasourceInterfaceUpdate(dsi2.id);
  //       }
  //     }  



//I'm going to need to redo the upload using the command-line eedb_upload.cgi webservice and the prep/send mode
//Otherwise I will need to make a new webservice.
// https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
// looks like there are more features in javascript for inspecting files from the file-picker 

function zenbuDatasourceInterfaceUploadFilePrep(uniqID) {  
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }

  if(!zenbuDSI.upload) { return false; }
  zenbuDSI.upload.progress_bar = 0.0;
  zenbuDSI.upload.copy_progress = 0.0;
  zenbuDSI.upload.collaboration_filter = "private";

  var upload_panel = zenbuDSI.upload_panel;
  if(!upload_panel) { return false; }
  
  var paramXML = "<zenbu_query>";
  paramXML += "<mode>uploadprep</mode>";

  if(zenbuDSI.upload.selected_file) {
    const file = zenbuDSI.upload.selected_file;
    //console.log("file "+i+" name["+file.name+"]  size["+file.size+"]  type["+file.type+"]");
    // selected_file = file;
    // var file_len = file.size;
    // if(file_len > 1024*1024) { console.log((file_len/1024.0/1024.0).toFixed(3) + " MBytes"); } 
    // else if(file_len > 1024) { console.log((file_len/1024.0).toFixed(3) + " KBytes"); } 
    // else { console.log(file_len+ " bytes"); }
    paramXML += "<upload_file  filename=\""+escapeXml(file.name)+"\">";
    // if(_parameters.find("gff_mdata") != _parameters.end()) { 
    //   paramXML += "<gff_mdata>"+_parameters["gff_mdata"]+"</gff_mdata>"; 
    // }
    paramXML += "</upload_file>";      
  }

  if(zenbuDSI.upload.display_name) { paramXML += "<display_name>"+escapeXml(zenbuDSI.upload.display_name)+"</display_name>"; }
  if(zenbuDSI.upload.description) { paramXML += "<description>"+escapeXml(zenbuDSI.upload.description)+"</description>"; }
  if(zenbuDSI.upload.assembly) { paramXML += "<assembly>"+zenbuDSI.upload.assembly+"</assembly>"; }
  if(zenbuDSI.upload.build_feature_name_index) { paramXML += "<build_feature_name_index>true</build_feature_name_index>"; }
  if(zenbuDSI.upload.bedscore_express) { 
    paramXML += "<bedscore_expression>true</bedscore_expression>";
    paramXML += "<datatype>"+zenbuDSI.upload.datatype+"</datatype>";
  }  
  if(zenbuDSI.upload.singletagmap_express) { 
    paramXML += "<singletagmap_expression>true</singletagmap_expression>";
    paramXML += "<datatype>"+zenbuDSI.upload.datatype+"</datatype>";
  }  
  paramXML += "<check_duplicates>false</check_duplicates>";
  // if(_parameters["submode"] == "edges") {
  //   paramXML += "<strict_edge_linking>"+_parameters["strict_edge_linking"]+"</strict_edge_linking>\n";
  //   paramXML += "<featuresource1>"+_parameters["featuresource1"]+"</featuresource1>\n";
  //   paramXML += "<featuresource2>"+_parameters["featuresource2"]+"</featuresource2>\n";
  //   //<featuresource1>3741F65E-B551-48BF-90D0-48E5F3ED85EF::1:::FeatureSource</featuresource1>
  //   //<featuresource2>3741F65E-B551-48BF-90D0-48E5F3ED85EF::1:::FeatureSource</featuresource2>
  //   //<strict_edge_linking>on</strict_edge_linking>
  // }
  paramXML += "</zenbu_query>";  
  console.log(paramXML);
  
  var uploadXMLHttp=GetXmlHttpObject();
  zenbuDSI.uploadXMLHttp = uploadXMLHttp;
  uploadXMLHttp.onreadystatechange= function(id) { return function() { zenbuDatasourceInterfaceUploadPrepResponse(id); };}(uniqID);
  uploadXMLHttp.open("POST", eedbUploadCGI, true);
  uploadXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  uploadXMLHttp.send(paramXML);

  zenbuDSI.upload.file_sent  = true;
  zenbuDSI.upload.status  = "prep";

  return true;
}



function zenbuDatasourceInterfaceUploadHandleEvent(e) {
  var perc = e.loaded / e.total;
  if(e.target.zenbuDSI) {
    var zenbuDSI = e.target.zenbuDSI;
    var file_info = zenbuDSI.upload.file_info;
    var selected_file = zenbuDSI.upload.selected_file;
    
    if(e.type == "load") { zenbuDSI.upload.status = "success"; } 
    if(e.type == "error") { zenbuDSI.upload.status = "error"; } 
    if(e.type == "abort") { zenbuDSI.upload.status = "abort"; } 
    if(e.type == "timeout") { zenbuDSI.upload.status = "timeout"; } 
    if(e.type == "loadstart") {
      zenbuDSI.upload.status = "loadstart";
      //console.log("file copy started file name["+selected_file.name+"]  size["+selected_file.size+"]  type["+selected_file.type+"]  safe["+file_info.safe_file+"]");
    }
    if(e.type == "loadend") {
      zenbuDSI.upload.status = "loadend";
      zenbuDSI.upload.loadend = true;
      zenbuDSI.uploadFileXHR = null;
      //console.log("FINISHED upload status["+(zenbuDSI.upload.status)+"]  file name["+selected_file.name+"]  size["+selected_file.size+"]  type["+selected_file.type+"]  safe["+file_info.safe_file+"]");
      zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);
      zenbuDatasourceInterfaceUploadMonitorQueue(zenbuDSI.id);
      return;
    }
    if(e.type == "progress") {
      zenbuDSI.upload.status = "copying";
      zenbuDSI.upload.copy_progress = perc;
      zenbuDSI.upload.size_loaded = e.loaded;
      zenbuDSI.upload.size_total = e.total;
      //console.log(`progress: ${file_info.original_file} ${file_info.file_uuid} : ${perc}  [ ${e.loaded} of ${e.total} ]`);
      zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);
      return;
    }
    //  console.log(`zenbuDSI ${zenbuDSI.id} : ${e.type}: ${e.loaded} bytes transferred of ${e.total}`);
    //  console.log(`upload ${e.type}: ${e.loaded} bytes transferred of ${e.total}`);
  
    zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);
    //zenbuDatasourceInterfaceUpdate(zenbuDSI.id);
  }
}


function zenbuDatasourceInterfaceUploadPrepResponse(uniqID) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  if(!zenbuDSI.upload) { return false; }
  if(!zenbuDSI.uploadXMLHttp) { return false; }

  console.log("zenbuDatasourceInterfaceUploadPrepResponse returned - get safename and send file contents");

  var uploadXMLHttp = zenbuDSI.uploadXMLHttp;
  if(uploadXMLHttp == null) { return; }
  if(uploadXMLHttp.responseXML == null) { return; }
  if(uploadXMLHttp.readyState!=4) { return; }
  if(uploadXMLHttp.status!=200) { return; }
  if(uploadXMLHttp.responseXML == null) { return; }
  
  var xmlDoc=uploadXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    console.log("Problem with uploadXMLHttp.responseXML: no documentElement");
    zenbuDSI.upload.status = "error";
    return false;
  }
  
  var errornodes = xmlDoc.getElementsByTagName("upload_error");
  for(i=0; i<errornodes.length; i++) {
    var errornode = errornodes[i];
    var error_val = errornode.firstChild.nodeValue;
    if(!zenbuDSI.upload.errors) { zenbuDSI.upload.errors = []; }
    zenbuDSI.upload.errors.push(error_val);
    console.log("ERROR: "+error_val);
    zenbuDSI.upload.status = "error";
    //return false;
  }
  var nodes = xmlDoc.getElementsByTagName("upload_file");
  if(nodes.length == 0) {
    console.log("ERROR: upload prep did not return any files to upload. maybe all duplicates");
    zenbuDSI.upload.status = "duplicate";
    return true;
  }
  //console.log("upload prep returned "+nodes.length+" upload_file preps");

  for(i=0; i<nodes.length; i++) {
    var uploadFileXML = nodes[i];
    var file_info = {};
    for (var j=0; j<uploadFileXML.children.length; j++) {
      var tchild = uploadFileXML.children[j];
      if(tchild.tagName == "original_file") { file_info.original_file = tchild.firstChild.nodeValue; }
      if(tchild.tagName == "safe_file") { file_info.safe_file = tchild.firstChild.nodeValue; }
      if(tchild.tagName == "safebasename") { file_info.safebasename = tchild.firstChild.nodeValue; }
      if(tchild.tagName == "file_format") { file_info.file_format = tchild.firstChild.nodeValue; }
      if(tchild.tagName == "file_uuid") { file_info.file_uuid = tchild.firstChild.nodeValue; }
      if(tchild.tagName == "safepath") { file_info.safepath = tchild.firstChild.nodeValue; }
      if(tchild.tagName == "xmlpath") { file_info.xmlpath = tchild.firstChild.nodeValue; }
    }
    //console.log("orig:"+file_info.original_file+"  safe:"+file_info.safe_file);
    
    if(zenbuDSI.upload.selected_file.name == file_info.original_file) {
      zenbuDSI.upload.file_info = file_info;
      var pickerfile = zenbuDSI.upload.selected_file;
      console.log("FOUND matching file name["+pickerfile.name+"]  size["+pickerfile.size+"]  type["+pickerfile.type+"]  safe["+file_info.safe_file+"]");
    }
  }
  
  if(zenbuDSI.upload.selected_file && zenbuDSI.upload.file_info) {
    //send the file
    var xhr = new XMLHttpRequest();
    xhr.zenbuDSI = zenbuDSI;
    xhr.upload.zenbuDSI = zenbuDSI;
    zenbuDSI.uploadFileXHR = xhr;
    xhr.open("POST", eedbUploadCGI, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    //xhr.overrideMimeType('text/plain; charset=x-user-defined-binary');
    xhr.setRequestHeader("x-zenbu-upload", zenbuDSI.upload.file_info.safe_file);

    //xhr.upload.addEventListener('load', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.upload.addEventListener('progress', zenbuDatasourceInterfaceUploadHandleEvent);
    //xhr.upload.addEventListener('error', zenbuDatasourceInterfaceUploadHandleEvent);
    //xhr.upload.addEventListener('abort', zenbuDatasourceInterfaceUploadHandleEvent);
    //xhr.upload.addEventListener('loadstart', zenbuDatasourceInterfaceUploadHandleEvent);
    //xhr.upload.addEventListener('loadend', zenbuDatasourceInterfaceUploadHandleEvent);
    //xhr.addEventListener('progress', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.addEventListener('loadstart', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.addEventListener('loadend', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.addEventListener('load', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.addEventListener('error', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.addEventListener('abort', zenbuDatasourceInterfaceUploadHandleEvent);
    xhr.addEventListener('timeout', zenbuDatasourceInterfaceUploadHandleEvent);

    const self = zenbuDSI;
    zenbuDSI.reader = new FileReader();
    zenbuDSI.reader.onload = function(evt) {
      console.log("FileReader onload finished so send now");
      self.uploadFileXHR.send(evt.target.result);
    };
    zenbuDSI.reader.readAsArrayBuffer(zenbuDSI.upload.selected_file);
  }
  zenbuDSI.uploadXMLHttp = undefined;
  
  return true;
}    


function zenbuDatasourceInterfaceUploadMonitorQueue(uniqID) {
  console.log("zenbuDatasourceInterfaceUploadMonitorQueue "+uniqID);

  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  if(!zenbuDSI.upload) { return false; }

  var file_info = zenbuDSI.upload.file_info;
  var selected_file = zenbuDSI.upload.selected_file;
  if(!file_info || !selected_file) { return false; }

  var paramXML = "<zenbu_query><mode>queuestatus</mode></zenbu_query>\n";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", eedbUploadCGI, false);  //run sync
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  if(xhr.responseXML == null) return;
  if(xhr.readyState!=4) return;
  if(xhr.status!=200) { return; }
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { return; } 
  
  var refresh = false;
  var xmlJobs = xmlDoc.getElementsByTagName("job");
  console.log("queue query returned "+xmlJobs.length+" jobs to check");
  zenbuDSI.upload.active_job = null;
  
  for(i=0; i<xmlJobs.length; i++) {
    var xmlJob = xmlJobs[i];
    var job = zenbuParseJobXML(xmlJob);
    if(job.mdata["safe_file"] && (job.mdata["safe_file"][0] == file_info.safe_file)) {
      console.log("found matching job status["+job.status+"] for safe_name "+file_info.safe_file);
      zenbuDSI.upload.active_job = job;
      zenbuDSI.upload.status = job.status;
      refresh=true;
    }
  }

  if(!refresh && zenbuDSI.upload.refreshInterval) {
    window.clearInterval(zenbuDSI.upload.refreshInterval);
    zenbuDSI.upload.refreshInterval = undefined;
  }
  
  if(zenbuDSI.upload.status == "RUN" && !zenbuDSI.upload.active_job) {
    zenbuDSI.upload.status = "UPLOAD COMPLETE";
    zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);

    //TODO: find the matching job for the current upload safe_name
    //monitor just this job, if the job disappears from the queue and is not FAILED then
    // we need another function to search for it and then add it into the selected sources of the DSI
    zenbuDatasourceInterfaceUploadSearchSafeName(zenbuDSI.id);
    return; 
  }

  if(refresh && !zenbuDSI.upload.refreshInterval) {
    console.log("set queue refreshInterval");
    //zenbuDSI.upload.refreshInterval = setInterval(`zenbuDatasourceInterfaceUploadMonitorQueue(${uniqID});`, 3000); //3 seconds
    zenbuDSI.upload.refreshInterval = setInterval(
      function(id) { return function() { zenbuDatasourceInterfaceUploadMonitorQueue(id); };}(uniqID), 3000); //3 seconds
  }
  zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);
}


function zenbuDatasourceInterfaceUploadSearchSafeName(uniqID) {
  console.log("zenbuDatasourceInterfaceUploadSearchSafeName "+uniqID);

  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(!zenbuDSI) { return; }
  if(!zenbuDSI.upload) { return false; }

  var file_info = zenbuDSI.upload.file_info;
  var selected_file = zenbuDSI.upload.selected_file;
  if(!file_info || !selected_file) { return false; }

  zenbuDSI.upload.status = "SEARCH DB";
  zenbuDSI.upload.progress_bar = 0.95;
  zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);
  
  var paramXML = "<zenbu_query><mode>sources</mode><collab>private</collab>";
  paramXML += "<filter>"+file_info.safe_file+"</filter>";
  paramXML += "<format>fullxml</format></zenbu_query>";
  
  var xhr = new XMLHttpRequest();
  zenbuDSI.sourcesXMLHttp = xhr;
  xhr.open("POST", eedbSearchFCGI, false);  //run sync
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.onreadystatechange= function(id) { return function() { zenbuDatasourceInterfaceParseSearchResponse(id); };}(uniqID);
  xhr.send(paramXML);

  zenbuDSI.upload.status = "SEARCH returned";
  zenbuDSI.upload.progress_bar = 0.98;
  zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);  

  if(xhr.responseXML == null) return;
  if(xhr.readyState!=4) return;
  if(xhr.status!=200) { return; }
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { return; } 
  
  if(!zenbuDSI.newconfig.sources_hash) { zenbuDSI.newconfig.sources_hash = new Object; }
  zenbuDatasourceInterfaceParseSearchResponse(uniqID);

  var sources_hash = zenbuDSI.newconfig.sources_hash;

  var found_datasource = null;
  
  for(var srcid in sources_hash) {
    var source = sources_hash[srcid];
    if(!source) { continue; }
    
    if(source.mdata["upload_unique_name"] && (source.mdata["upload_unique_name"][0] == file_info.safe_file)) {
      console.log("found matching DataSource ["+source.id+"] for safe_name "+file_info.safe_file);
      source.selected = true;
      source.hide = false;
      found_datasource = source;
    }
  }
  
  if(found_datasource) {
    zenbuDSI.upload.status = "DATASOURCE in database";
    zenbuDSI.upload.progress_bar = 1.0;
    zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);  

    if(zenbuDSI.enableUploadSearchToggle) {
      zenbuDatasourceInterfaceSelectSource(zenbuDSI.id, found_datasource.id, true);
      zenbuDatasourceInterfaceShowSearchResult(uniqID);
      zenbuDatasourceInterfaceReconfigParam(zenbuDSI.id, 'master_mode', 'search');
    }
    return;
  } else {
    zenbuDSI.upload.status = "SEARCH FAILED";
    zenbuDSI.upload.progress_bar = 0.99;
    zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);  
  }

  zenbuDatasourceInterfaceUploadStatusRefresh(zenbuDSI.id);
}



