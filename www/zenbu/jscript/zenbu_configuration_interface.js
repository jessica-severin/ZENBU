// ZENBU zenbu_config_interface.js
//
// Contact : Jessica Severin <jessica.severin@riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
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

var zenbuConfigurationInterface_hash = new Object();  //global hash of all ZCIs


//===============================================================
//
// ConfigurationInterface
//
//===============================================================

function zenbuClearGlobalPanelLayer() {
  var global_layer_div = document.getElementById("global_panel_layer");
  if(!global_layer_div) { return; }
  global_layer_div.innerHTML ="";
}


function zenbuConfigurationInterface(uniqID) {
  if(!uniqID) { uniqID = "zenbuCI_"+ createUUID(); }

  var zenbuCI = zenbuConfigurationInterface_hash[uniqID];

  if(!zenbuCI) {    
    console.log("zenbuConfigurationInterface ["+uniqID+"] create new interface panel");
    zenbuCI = document.createElement('div');
    zenbuCI.uniqID = uniqID;
    zenbuCI.innerHTML = "";
    
    zenbuCI.configDOM = null;
    zenbuCI.autosave = false;
    zenbuCI.config_type = "";
    zenbuCI.uploadCallOutFunction = null;
    zenbuCI.uploadCompleteFunction = null;
    zenbuCI.config = null; //set to parsed Configuration object on complete of upload

    zenbuCI.panel_title = "Save configuration";
    zenbuCI.title = "";
    zenbuCI.description = "";
    zenbuCI.fixed_id = "";
    zenbuCI.edit_fixed_id = false;
    zenbuCI.validation_status = "valid";
    zenbuCI.validation_message = "no fixed ID";

    zenbuConfigurationInterface_hash[uniqID] = zenbuCI;
  }
  return zenbuCI;
}


function zenbuConfigurationInterfaceUpdate(uniqID) {
  var zenbuCI = zenbuConfigurationInterface_hash[uniqID];
  if(!zenbuCI) { return; }

  if(zenbuCI.config_type!="REPORT" && zenbuCI.config_type!="VIEW") {
    zenbuCI.fixed_id = "";
    zenbuCI.edit_fixed_id = false;
    zenbuCI.validation_status = "";
    zenbuCI.validation_message = "";
  }

  zenbuCI.style = "";
  
  //eedbShowLogin();
  if(!eedbGetCurrentUser()) {
    zenbuCI.innerHTML = "";
    return;
  }
  console.log("zenbuConfigurationInterfaceUpdate "+uniqID);
    
  zenbuCI.modified = false;
  zenbuCI.saveConfigXHR = undefined;

  var xpos = zenbuCI.xpos;
  var ypos = zenbuCI.ypos;
  if(!xpos) {
    var e = window.event
    toolTipWidth=400;
    moveToMouseLoc(e);
    zenbuCI.xpos = xpos = toolTipSTYLE.xpos;
    zenbuCI.ypos = ypos = toolTipSTYLE.ypos + 10;
  }
  
  var divFrame = document.createElement('div');
  divFrame.setAttribute('style', "position:absolute; background-color:#FDFDFD; text-align:left; "
                        +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                        //+"left:" + ((winW/2)-250) +"px; top:200px; "
                        +"left:"+(xpos-400)+"px; top:"+(ypos)+"px; "
                        +"width:400px; z-index:90;"
                        );
  var tdiv, tspan, tinput;
  
  //close button
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.onmousedown = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'cancel'); return false; }
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
    
  tdiv = document.createElement('div');
  tdiv.style = "font-weight:bold; font-size:14px; padding: 5px 0px 5px 0px;"
  tdiv.setAttribute('align', "center");
  tdiv.innerHTML = zenbuCI.panel_title;
  divFrame.appendChild(tdiv)
  
  //----------
  if(zenbuCI.configUUID) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
    var span0 = div1.appendChild(document.createElement('span'));
    span0.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "uuid:";

    var span1 = div1.appendChild(document.createElement('span'));
    //span1.setAttribute("style", "padding:0px 0px 0px 10px; font-size:11px; font-weight:bold; color:rgb(94,115,153);");
    span1.setAttribute("style", "padding:0px 0px 0px 10px; font-size:11px; color:orange;");
    span1.innerHTML = zenbuCI.configUUID;
  }
  
  //----------
  if(zenbuCI.edit_fixed_id && (zenbuCI.config_type=="REPORT" || zenbuCI.config_type=="VIEW")) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
    var span0 = document.createElement('span');
    span0.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
    span0.innerHTML = "fixed page url ID:";
    div1.appendChild(span0);
    var fixedIdInput = document.createElement('input');
    fixedIdInput.id = "_fixed_id_inputID";
    fixedIdInput.setAttribute('style', "width:150px; margin-left: 5px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    fixedIdInput.setAttribute('type', "text");
    fixedIdInput.setAttribute('value', zenbuCI.fixed_id);
    //fixedIdInput.setAttribute("onkeydown", "zenbuConfigurationInterfaceReconfigParam('configUUID', this.value);");
    fixedIdInput.onkeydown = function(evt) { 
      if(evt.keyCode==13) { zenbuConfigurationInterfaceReconfigParam(uniqID, 'fixed_id', fixedIdInput.value); }
    }
    div1.appendChild(fixedIdInput);
    
    button = div1.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'fixed_id', ''); }
    button.innerHTML = "verify fixed ID";
  } else if(zenbuCI.config_type=="REPORT" || zenbuCI.config_type=="VIEW") {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
    var span1 = div1.appendChild(document.createElement('span'));
    span1.innerHTML = "fixed page url ID:";
    var uuid_span = div1.appendChild(document.createElement('span'));
    uuid_span.setAttribute("style", "padding:0px 0px 0px 10px; font-size:11px; font-weight:bold; color:rgb(94,115,153);");
    uuid_span.innerHTML = zenbuCI.fixed_id;

    button = div1.appendChild(document.createElement("button"));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'edit_fixed_id'); }
    button.innerHTML = "change fixedID";
    
    if(zenbuCI.fixed_id_owner) {
      button = div1.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'edit_fixed_id_editors'); }
      button.innerHTML = "manage editors";
    }
  }

  //button = div1.appendChild(document.createElement("button"));
  //button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:10px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //button.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'autogen-uuid'); }
  //button.innerHTML = "generate UUID";

  
  //----------
  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 3px 0px;");
  var span0 = div1.appendChild(document.createElement('span'));
  span0.setAttribute('style', "padding: 0px 2px 0px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  span0.innerHTML = "configuration title:";
  div1 = divFrame.appendChild(document.createElement('div'));
  var titleInput = div1.appendChild(document.createElement('input'));
  titleInput.setAttribute('style', "width:370px; margin: 1px 1px 5px 7px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  titleInput.setAttribute('type', "text");
  titleInput.setAttribute('value', zenbuCI.title);
  titleInput.onkeyup = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'name', titleInput.value); }
  
  //----------
  var descSpan = document.createElement('span');
  descSpan.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif;");
  descSpan.innerHTML = "description:";
  divFrame.appendChild(descSpan);
  var descInput = document.createElement('textarea');
  descInput.setAttribute('style', "width:385px; max-width:385px; min-width:385px; min-height:50px; margin: 3px 5px 3px 7px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  descInput.setAttribute('rows', 7);
  descInput.setAttribute('value', zenbuCI.description);
  descInput.innerHTML = zenbuCI.description;
  descInput.onkeyup = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'desc', descInput.value); }
  divFrame.appendChild(descInput);
  
  //----------
  divFrame.appendChild(document.createElement('hr'));

  //----------
  var userDiv = divFrame.appendChild(document.createElement('div'));
  userDiv.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:12px; font-family:arial,helvetica,sans-serif;");
  var userSpan = userDiv.appendChild(document.createElement('span'));
  userSpan.setAttribute('style', "padding:0px 0px 0px 0px;");
  userSpan.innerHTML = "user:";
  var name_span = userDiv.appendChild(document.createElement('span'));
  name_span.setAttribute("style", "padding:0px 0px 0px 10px; font-weight:bold; color:rgb(94,115,153);");
  name_span.innerHTML = "guest";
  if(current_user) {
    if(current_user.nickname) { name_span.innerHTML = current_user.nickname; }
    else { name_span.innerHTML = current_user.openID; }
    if(current_user.email) {
      var email_span = userDiv.appendChild(document.createElement('span'));
      email_span.setAttribute("style", "padding-left:10px; color:gray; font-size:11px;");
      email_span.innerHTML = current_user.email;
    }
  }
  
  var div1 = divFrame.appendChild(document.createElement('div'));  
  if(!zenbuCI.collabWidget) {
    zenbuCI.collabWidget = eedbCollaborationPulldown("member", uniqID);
    if(zenbuCI.collaboration_filter) { 
      console.log("DSI set initial collaboration_filter : "+zenbuCI.collaboration_filter);
      eedbCollaborationPulldownChanged(uniqID, zenbuCI.collaboration_filter); //set internally
      eedbCollaborationPulldown("member", uniqID); //refresh
    }
    //zenbuCI.collabWidget.callOutFunction = zenbuDatasourceInterfaceCollaborationChanged;
  }
  var collabWidget = zenbuCI.appendChild(zenbuCI.collabWidget);
  //var collabWidget = eedbCollaborationSelectWidget();
  div1.appendChild(collabWidget);

  //----------
  divFrame.appendChild(document.createElement('hr'));
  //----------
  console.log("zenbuConfigurationInterfaceUpdate fixed_id=["+zenbuCI.fixed_id+"]  status="+zenbuCI.validation_status+"  message["+zenbuCI.validation_message+"]");

  if(zenbuCI.validation_status == "checking") {
    console.log("validation_status == checking");
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px;");
    span1.innerHTML = "checking page ID....";
    zenbuConfigurationInterfaceValidateFixedID(zenbuCI);
  } else if(zenbuCI.validation_status == "ws-error") {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px; color:#FC8B28");
    span1.innerHTML = "error with webservices validating user";
  } else if(zenbuCI.validation_status == "invalid") {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px; color:#FC8B28");
    span1.innerHTML = "invalid fixedID : "+zenbuCI.validation_message;
  } else if(zenbuCI.edit_fixed_id) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    var span1= div1.appendChild(document.createElement('span'));
    span1.setAttribute('style', "padding:0px 0px 0px 0px;");
    span1.innerHTML = "editing page ID, press < Enter > key to validate";
  } else {
    console.log("validation_status == valid?");
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    
    var button2 = div1.appendChild(document.createElement('input'));
    button2.type = "button";
    button2.className = "largebutton";
    button2.setAttribute("value", "save");
    button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    button2.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'accept'); }

    var button1 = div1.appendChild(document.createElement('input'));
    button1.type = "button";
    button1.className = "largebutton";
    button1.setAttribute("value", "cancel");
    button1.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
    button1.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'cancel'); }

    var span1 = div1.appendChild(document.createElement('div'));
    span1.setAttribute('style', "margin: 0px 0px 3px 0px; font-size:11px; font-family:arial,helvetica,sans-serif;");
    span1.innerHTML = zenbuCI.validation_message;
  }
  console.log("ok set the panel contents");
  zenbuCI.innerHTML ="";
  zenbuCI.appendChild(divFrame);
  //zenbuCI.style.display = "block";

  return divFrame;
}


function zenbuConfigurationInterfaceReconfigParam(uniqID, param, value) {
  var zenbuCI = zenbuConfigurationInterface_hash[uniqID];
  if(!zenbuCI) { return; }
   
  console.log("zenbuConfigurationInterfaceReconfigParam["+uniqID+"] "+param+" value="+value);

  if(param == "name") { zenbuCI.title = value; }
  if(param == "desc") { zenbuCI.description = value; }
  
  if(param == "fixed_id") {
    if(value == "") {
      var input1 = document.getElementById("_fixed_id_inputID");
      if(input1) { value = input1.value; }
    }
    zenbuCI.fixed_id = value;
    if(zenbuCI.fixed_id) {
      zenbuCI.validation_status = "checking";
      zenbuCI.edit_fixed_id = false;
      zenbuConfigurationInterfaceUpdate(uniqID); //refresh
      //zenbuConfigurationInterfaceValidateFixedID(zenbuCI);
    } else {
      zenbuCI.edit_fixed_id = false;
      zenbuCI.validation_status = "valid";
      zenbuCI.validation_message = "no fixed ID";
      zenbuConfigurationInterfaceUpdate(uniqID); //refresh
    }
  }
  if(param == "edit_fixed_id") {
    zenbuCI.edit_fixed_id = true;
    zenbuConfigurationInterfaceUpdate(uniqID); //refresh
  }
  if(param == "edit_fixed_id_editors") {
    //zenbuCI.edit_fixed_id = true;
    //zenbuConfigurationInterfaceUpdate(uniqID); //refresh
    zenbuConfigurationInterfaceFixedIDEditorManagementPanel(zenbuCI, true);
    //TODO: bring up panel with inputs and webservice checking logic
  }
  if(param == "fixedID_editor_mode") {
    zenbuConfigurationInterfaceChangeFixIdEditorMode(zenbuCI, zenbuCI.fixed_id, value);
  }
  if(param == "add_fixedID_editor") {
    if(value == "") {
      var input1 = document.getElementById("configuration_fixedID_user_input");
      if(input1) { value = input1.value; }
    }
    zenbuConfigurationInterfaceChangeFixIdEditors(zenbuCI, zenbuCI.fixed_id, value, 'add');
  }
  if(param == "remove_fixedID_editor") {
    zenbuConfigurationInterfaceChangeFixIdEditors(zenbuCI, zenbuCI.fixed_id, value, 'remove');
  }
  
  if(param == "autogen-uuid") {
    zenbuConfigurationInterfaceConfigUUIDAutogen(zenbuCI); //syncronous GET to webservices
    zenbuConfigurationInterfaceUpdate(uniqID); //refresh
  }
  
  if(param == "cancel") {
    //saveConfigDiv.innerHTML ="";
    zenbuCI.modified = false;
    zenbuCI.saveConfigXHR = undefined;
    zenbuCI.innerHTML = "";
    //zenbuCI.style.display = "none";
  }
  
  if(param == "accept") {
    zenbuCI.saveConfigXHR = undefined;
    if(zenbuCI.uploadCallOutFunction) { zenbuCI.uploadCallOutFunction(zenbuCI); } 
    else { zenbuConfigurationInterfaceUploadConfigXML(zenbuCI); }
    zenbuCI.innerHTML = "";
  }
}


function zenbuConfigurationInterfaceConfigUUIDAutogen(zenbuCI) {
  if(!zenbuCI) { return; }
  var uniqID = zenbuCI.uniqID;

  //uses webservices to generate UUID server-side
  var url = eedbConfigCGI + "?mode=validate_uuid";
  
  var saveConfigXHR=GetXmlHttpObject();
  saveConfigXHR.open("GET", url, false);  //synchronous
  saveConfigXHR.send(null);

  if(saveConfigXHR.readyState!=4) return;
  if(saveConfigXHR.status!=200) { return; }
  if(saveConfigXHR.responseXML == null) { return; }

  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { return; }
  
  var xml_uuid = xmlDoc.getElementsByTagName("config_uuid");
  var xml_validation = xmlDoc.getElementsByTagName("validation_status");

  if(xml_uuid && xml_uuid.length>0 && xml_validation && xml_validation.length>0) {
    var validation = xml_validation[0].firstChild.nodeValue;
    var uuid = xml_uuid[0].firstChild.nodeValue;
    if(validation == "autogen_uuid") {
      zenbuCI.fixed_id = uuid;
      zenbuCI.validation_status = "valid";
      zenbuCI.validation_message = "new page";
      zenbuCI.edit_fixed_id = false;
    }
  }
}


function zenbuConfigurationInterfaceValidateFixedID(zenbuCI) {
  if(!zenbuCI) { return; }
  var uniqID = zenbuCI.uniqID;

  console.log("zenbuConfigurationInterfaceValidateFixedID");
  if(zenbuCI.validation_status != "checking") { return; }
  
  if(!zenbuCI.fixed_id) {
    console.log("zenbuConfigurationInterfaceValidateFixedID empty fixed_id");
    zenbuCI.edit_fixed_id = false;
    zenbuCI.validation_status = "valid";
    zenbuCI.validation_message = "no fixed ID";
    return;
  }
  
  zenbuCI.fixed_id_owner = false;
  
  var paramXML = "<zenbu_query><mode>validate_uuid</mode>\n";
  paramXML += "<uuid>"+zenbuCI.fixed_id+"</uuid>";
  paramXML += "</zenbu_query>\n";
  //var url = eedbConfigCGI + "?mode=validate_uuid;uuid=" + zenbuCI.fixed_id;
  
  var saveConfigXHR=GetXmlHttpObject();
  zenbuCI.saveConfigXHR = saveConfigXHR;

  //saveConfigXHR.open("GET", url, false);  //synchronous
  //saveConfigXHR.send(null);
  //console.log("sent "+url);

  //saveConfigXHR.onreadystatechange= zenbuConfigurationInterfaceValidateFixedIDResponse;
  saveConfigXHR.onreadystatechange= function(id) { return function() { zenbuConfigurationInterfaceValidateFixedIDResponse(id); };}(uniqID);
  saveConfigXHR.open("POST", eedbConfigCGI, true);
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}


function zenbuConfigurationInterfaceValidateFixedIDResponse(uniqID) {
  var zenbuCI = zenbuConfigurationInterface_hash[uniqID];
  if(!zenbuCI) { return; }

  console.log("zenbuConfigurationInterfaceValidateFixedIDResponse "+uniqID);
  
  var saveConfigXHR = zenbuCI.saveConfigXHR;
  
  if(!saveConfigXHR || (saveConfigXHR.readyState!=4) || (saveConfigXHR.status!=200) || (saveConfigXHR.responseXML == null)) {
    zenbuCI.validation_status = "ws-error";
    return;
  }

  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { zenbuCI.validation_status = "ws-error"; return; }
  console.log("zenbuConfigurationInterfaceValidateFixedIDResponse: ok can parse response");

  var uuid = "";
  var xml_uuid = xmlDoc.getElementsByTagName("config_uuid");
  if(xml_uuid && xml_uuid.length>0) { uuid = xml_uuid[0].firstChild.nodeValue; }

  var validation = "";
  var xml_validation = xmlDoc.getElementsByTagName("validation_status");
  if(xml_validation && xml_validation.length>0) { validation = xml_validation[0].firstChild.nodeValue; }

  var check_status = "";
  var xml_check_status = xmlDoc.getElementsByTagName("check_status");
  if(xml_check_status && xml_check_status.length>0) { check_status = xml_check_status[0].firstChild.nodeValue; }

  var config_type = "";
  var xml_config_type = xmlDoc.getElementsByTagName("config_type");
  if(xml_config_type && xml_config_type.length>0) { config_type = xml_config_type[0].firstChild.nodeValue; }

  var message = "";
  var xml_message = xmlDoc.getElementsByTagName("validation_message");
  if(xml_message && xml_message.length>0) { message = xml_message[0].firstChild.nodeValue; }

  console.log("zenbuConfigurationInterfaceValidateFixedIDResponse uuid="+uuid+"  valid="+validation+"  config_type=["+config_type+"]  message["+message+"]");

  if(config_type!="" && zenbuCI.config_type && (config_type!=zenbuCI.config_type)) {
    zenbuCI.validation_status = "invalid";
    zenbuCI.validation_message = "configuration fixedID exists but is not a "+zenbuCI.config_type;
  }
  else if(uuid && validation) {
    if(validation == "valid_new_uuid") {
      zenbuCI.validation_status = "valid";
      zenbuCI.validation_message = "new page";
    }
    if(validation == "no_user") {
      zenbuCI.validation_status = "invalid";
      zenbuCI.validation_message = "no user login";
    }
    if(validation == "exists_secured_editable") {
      zenbuCI.validation_status = "valid";
      zenbuCI.validation_message = "changes fixedID link";
      if(check_status == "fixed_id_owner") { zenbuCI.fixed_id_owner = true; }
    }
    if(validation == "exists_secured_non_editable") {
      zenbuCI.validation_status = "invalid";
      zenbuCI.validation_message = "page read-only, user can not edit";
    }
    if(validation == "exists_security_fault") {
      zenbuCI.validation_status = "invalid";
      zenbuCI.validation_message = "page secured by other users, can not read or edit";
    }
  } else {
    zenbuCI.validation_status = "invalid";
    zenbuCI.validation_message = "could not validate security access";
  }
  
  zenbuCI.edit_fixed_id = false;
  console.log("zenbuConfigurationInterfaceValidateFixedIDResponse uuid="+uuid+"  status="+zenbuCI.validation_status+"  message["+zenbuCI.validation_message+"]");
  zenbuConfigurationInterfaceUpdate(uniqID); //refresh
}


function zenbuConfigurationInterfaceFixedIDEditorManagementPanel(zenbuCI, reload) {
  if(!zenbuCI) { return; }
  var uniqID = zenbuCI.uniqID;
  
  console.log("zenbuConfigurationInterfaceFixedIDEditorManagementPanel");
  //var global_layer_div = document.getElementById("global_panel_layer");
  //if(!global_layer_div) { return; }

  var fixed_id = zenbuCI.fixed_id;
  if(!fixed_id) { zenbuConfigurationInterfaceUpdate(uniqID); return; }
  console.log("zenbuConfigurationInterfaceFixedIDEditorManagementPanel fixed_id["+fixed_id+"]");
  
  var xpos = zenbuCI.xpos;
  var ypos = zenbuCI.ypos;
  if(!xpos) {
    var e = window.event
    toolTipWidth=400;
    moveToMouseLoc(e);
    zenbuCI.xpos = xpos = toolTipSTYLE.xpos;
    zenbuCI.ypos = ypos = toolTipSTYLE.ypos + 10;
  }

  var divFrame = document.getElementById(zenbuCI.uniqID+"_fixed_id_editor_management_panel");
  if(!divFrame) {
    divFrame = document.createElement('div');
    divFrame.id = zenbuCI.uniqID+"_fixed_id_editor_management_panel";
    zenbuCI.appendChild(divFrame);
    divFrame.setAttribute('style', "background-color:lightgray; text-align:left; "
                          +"border:inset; border-width:1px; padding: 7px 7px 7px 7px; "
                          +"z-index:100; "
                          +"position:absolute; left:"+ (xpos-800)+"px; top:"+(ypos+90)+"px;"
                          +"width:700px;"
                          );
    /*
    divFrame.setAttribute('style', "position:absolute; background-color:#FDFDFD; text-align:left; "
                          +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                          //+"left:" + ((winW/2)-250) +"px; top:200px; "
                          +"left:"+(xpos-400)+"px; top:"+(ypos)+"px; "
                          +"width:400px; z-index:90;"
                          );
    */
  }
  divFrame.innerHTML = ""; //clear
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Manage editors for fixedID : ";
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  tspan.innerHTML = fixed_id;
  
  //close button
  //tdiv = divFrame.appendChild(document.createElement('div'));
  //tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  //var a1 = tdiv.appendChild(document.createElement('a'));
  //a1.setAttribute("target", "top");
  //a1.setAttribute("href", "./");
  //a1.onmousedown = function() { zenbuConfigurationInterfaceUpdate(uniqID); return false; }
  var img1 = tdiv.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");
  img1.onmousedown = function() { zenbuConfigurationInterfaceUpdate(uniqID); }

  //divFrame.style.width = "500px";
  //divFrame.style.left = (xpos-600)+"px";

  //--------
  if(reload) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 0px 20px; color:#B22222; font-size:10px;");
    div1.innerHTML = "loading.........";
    zenbuConfigurationInterfaceLoadFixIdEditors(zenbuCI, fixed_id);
    return;
  }

  //----------
  var modeDiv = divFrame.appendChild(document.createElement('div'));
  modeDiv.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif;");
  var label1 = modeDiv.appendChild(document.createElement('span'));
  label1.setAttribute("style", "font-size:12px; margin-right:7px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
  label1.innerHTML ="Editor mode :";

  if(!zenbuCI.fixedID_editor_mode) { zenbuCI.fixedID_editor_mode = "OWNER_ONLY"; }
  var editor_mode = zenbuCI.fixedID_editor_mode;
  //console.log("datasource_mode : "+datasource_mode);
  
  var radio1 = modeDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "_fixedID_editor_mode");
  radio1.setAttribute("value", "OWNER_ONLY");
  if(editor_mode == "OWNER_ONLY") { radio1.setAttribute('checked', "checked"); }
  radio1.onchange = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'fixedID_editor_mode', "OWNER_ONLY"); }
  tspan = modeDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "owner only";
  
  radio1 = modeDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "_fixedID_editor_mode");
  radio1.setAttribute("value", "COLLABORATORS");
  if(editor_mode == "COLLABORATORS") { radio1.setAttribute('checked', "checked"); }
  radio1.onchange = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'fixedID_editor_mode', "COLLABORATORS"); }
  tspan = modeDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "shared collaboration members";

  radio1 = modeDiv.appendChild(document.createElement('input'));
  radio1.setAttribute("type", "radio");
  radio1.setAttribute("name", "_fixedID_editor_mode");
  radio1.setAttribute("value", "USER_LIST");
  if(editor_mode == "USER_LIST") { radio1.setAttribute('checked', "checked"); }
  radio1.onchange = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'fixedID_editor_mode', "USER_LIST"); }
  tspan = modeDiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "specified user list";

  if(editor_mode != "USER_LIST") { return; }
  
  // --------
  //divFrame.style.width = "700px";
  //divFrame.style.left = (xpos-800)+"px";

  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 0px 0px; font-size:10px;");
  div1.innerHTML = "add new user to list of people able to edit this fixedID redirection link.";
  //div1.innerHTML += "<br> If user is not in system, ZENBU will send email inviting them to create an account";
  var div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 10px 0px;");
  var label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "user's email address ";
  
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "configuration_fixedID_user_input";
  input1.setAttribute("type", "text");
  input1.setAttribute("size", "50");
  
  var button = div1.appendChild(document.createElement('input'));
  button.type = "button";
  button.className = "medbutton";
  button.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'add_fixedID_editor', ''); }
  button.value ="add";
  
  // --------
  divFrame.appendChild(document.createElement('hr'));
  
  if(!zenbuCI.editors || zenbuCI.editors.length==0) {
    var div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute('style', "margin: 0px 0px 0px 20px; color:#B22222; font-size:10px;");
    div1.innerHTML = "no editors currently set...";
    return;
  }

  // now display as table
  var scrolldiv = divFrame.appendChild(document.createElement('div'));
  scrolldiv.setAttribute("style", "max-height:350px; width:100%;border:1px; margin-bottom:5px; overflow:auto;");
  
  var my_table = scrolldiv.appendChild(document.createElement('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(document.createElement('thead')).appendChild(document.createElement('tr'));
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "row";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "nickname";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "email";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.innerHTML = "status";
  var th = trhead.appendChild(document.createElement('th'));
  th.className = 'listView';
  th.width = '30px';
  th.innerHTML = "action";
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('row'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('nickname'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('email'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView' }).update('status'));
  //trhead.appendChild(document.createElement('th', { 'class': 'listView', "width":"30px" }).update('action'));
  
  var tbody = my_table.appendChild(document.createElement('tbody'));
  var row=1;
  
  //then the editors
  for(i=0; i<zenbuCI.editors.length; i++) {
    var user = zenbuCI.editors[i];
    var user_ident = user.email;
    if(!user_ident) { user_ident = user.openid_array[0]; }
   
    var tr = tbody.appendChild(document.createElement('tr'));
    if(i%2 == 0) { tr.setAttribute("style", "background-color:#FDFDFD;"); }
    else         { tr.setAttribute("style", "background-color:#F0F0F0;"); }
   
    tr.appendChild(document.createElement('td')).innerHTML = row;  //row
    //var td = tr.appendChild(document.createElement('td').update(row));  //row
    tr.appendChild(document.createElement('td')).innerHTML = encodehtml(user.nickname);
    var td = tr.appendChild(document.createElement('td'));
    td.innerHTML = encodehtml(user.email);
    if(current_user.email == user.email) { td.setAttribute("style", "color:#25258e; font-weight:bold;"); }
   
    if(user.member_status == "OWNER") {
      tr.appendChild(document.createElement('td')).innerHTML = "owner";
      tr.appendChild(document.createElement('td')).innerHTML = "-";
    } else {
      td = tr.appendChild(document.createElement('td'));
      td = td.innerHTML = user.member_status.toLowerCase();

      var td = tr.appendChild(document.createElement('td'));
      td.setAttribute("style", "white-space:nowrap");
      var div2 = td.appendChild(document.createElement('div'));
      var button = div2.appendChild(document.createElement('button'));
      button.setAttribute("style", "font-size:10px; color:#B22222; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE;  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //button.setAttribute("onclick", "zenbuCollaborationRemoveUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
      button.onclick = function() { zenbuConfigurationInterfaceReconfigParam(uniqID, 'remove_fixedID_editor', user_ident); }
      button.innerHTML ="remove user";
      //var button = div2.appendChild(document.createElement('button'));
      //button.setAttribute("style", "font-size:10px; color:#B22222; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //button.setAttribute("onclick", "zenbuCollaborationMakeAdminUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
      //button.innerHTML ="make admin";
    }
    row++;
  }
  
}


function zenbuConfigurationInterfaceLoadFixIdEditors(zenbuCI, fixed_id) {
  if(!zenbuCI) { return; }
  console.log("zenbuConfigurationInterfaceLoadFixIdEditors ["+fixed_id+"]");
  var paramXML = "<zenbu_query><mode>fixed_id_editors</mode>";
  if(fixed_id) { paramXML += "<fixed_id>"+fixed_id+"</fixed_id>"; }
  paramXML += "</zenbu_query>";

  zenbuCI.editors = new Array;
  zenbuCI.fixedID_editor_mode = "OWNER_ONLY"; //reset
  
  var saveConfigXHR=GetXmlHttpObject();
  zenbuCI.saveConfigXHR = saveConfigXHR;

  //saveConfigXHR.onreadystatechange=zenbuConfigurationInterfaceParseFixIdEditorsResponse;
  saveConfigXHR.onreadystatechange= function(id) { 
    return function() { zenbuConfigurationInterfaceParseFixIdEditorsResponse(id); };}(zenbuCI.uniqID);
  saveConfigXHR.open("POST", eedbConfigCGI, true); //async
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}


function zenbuConfigurationInterfaceChangeFixIdEditorMode(zenbuCI, fixed_id, editor_mode) {
  if(!zenbuCI) { return; }
  console.log("zenbuConfigurationInterfaceLoadFixIdEditors ["+fixed_id+"]");
  var paramXML = "<zenbu_query><mode>change_editor_mode</mode>";
  if(fixed_id) { paramXML += "<fixed_id>"+fixed_id+"</fixed_id>"; }
  if(editor_mode) { paramXML += "<editor_mode>"+editor_mode+"</editor_mode>"; }
  paramXML += "</zenbu_query>";
  
  zenbuCI.editors = new Array;
  zenbuCI.fixedID_editor_mode = "OWNER_ONLY"; //reset
  
  var saveConfigXHR=GetXmlHttpObject();
  zenbuCI.saveConfigXHR = saveConfigXHR;
  
  //saveConfigXHR.onreadystatechange=zenbuConfigurationInterfaceParseFixIdEditorsResponse;
  saveConfigXHR.onreadystatechange= function(id) { 
    return function() { zenbuConfigurationInterfaceParseFixIdEditorsResponse(id); };}(zenbuCI.uniqID);
  saveConfigXHR.open("POST", eedbConfigCGI, true); //async
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}


function zenbuConfigurationInterfaceChangeFixIdEditors(zenbuCI, fixed_id, editor_email, submode) {
  if(!zenbuCI) { return; }
  console.log("zenbuConfigurationInterfaceLoadFixIdEditors ["+fixed_id+"]");
  var paramXML = "<zenbu_query>";
  if(submode=="add") { paramXML += "<mode>add_editor</mode>"; }
  if(submode=="remove") { paramXML += "<mode>remove_editor</mode>"; }
  if(fixed_id) { paramXML += "<fixed_id>"+fixed_id+"</fixed_id>"; }
  if(editor_email) { paramXML += "<user_identity>"+editor_email+"</user_identity>"; }
  paramXML += "</zenbu_query>";
  
  zenbuCI.editors = new Array;
  zenbuCI.fixedID_editor_mode = "OWNER_ONLY"; //reset
  
  var saveConfigXHR=GetXmlHttpObject();
  zenbuCI.saveConfigXHR = saveConfigXHR;
  
  //saveConfigXHR.onreadystatechange=zenbuConfigurationInterfaceParseFixIdEditorsResponse;
  saveConfigXHR.onreadystatechange= function(id) { 
    return function() { zenbuConfigurationInterfaceParseFixIdEditorsResponse(id); };}(zenbuCI.uniqID);
  saveConfigXHR.open("POST", eedbConfigCGI, true); //async
  saveConfigXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  saveConfigXHR.send(paramXML);
}


function zenbuConfigurationInterfaceParseFixIdEditorsResponse(uniqID) {
  var zenbuCI = zenbuConfigurationInterface_hash[uniqID];
  if(!zenbuCI) { return; }

  var saveConfigXHR = zenbuCI.saveConfigXHR;
  if(saveConfigXHR == null) {
    return zenbuConfigurationInterfaceFixedIDEditorManagementPanel(zenbuCI, false);
  }

  if(saveConfigXHR.readyState!=4) { return; }
  if(saveConfigXHR.status!=200) { return; }
  if(saveConfigXHR.responseXML == null) { return zenbuConfigurationInterfaceFixedIDEditorManagementPanel(zenbuCI, false); }
  
  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { return zenbuConfigurationInterfaceFixedIDEditorManagementPanel(zenbuCI, false); }

  var modeXML = xmlDoc.getElementsByTagName("editor_mode");
  if(modeXML && modeXML.length>0) {
    zenbuCI.fixedID_editor_mode = modeXML[0].firstChild.nodeValue;
  }

  var xmlEditors = xmlDoc.getElementsByTagName("editors");
  if(xmlEditors && xmlEditors.length>0) {
    var xmlUsers = xmlEditors[0].getElementsByTagName("eedb_user");
    for(i=0; i<xmlUsers.length; i++) {
      var user = eedbParseUserXML(xmlUsers[i]);
      zenbuCI.editors.push(user);
    }
  }

  zenbuConfigurationInterfaceFixedIDEditorManagementPanel(zenbuCI, false);
}

//-----------------------------------------------------------------------

//
// upload configXML
//

function zenbuConfigurationInterfaceUploadConfigXML(zenbuCI) {
  if(!zenbuCI) { return; }
  var uniqID = zenbuCI.uniqID;
  
  if(zenbuCI.saveConfigXHR) {
    //a save already in operation. flag for resave when finished
    zenbuCI.modified = true;
    return;
  }

  var configDOM = zenbuCI.configDOM;
  if(!configDOM) { return; }
  
  var doc = document.implementation.createDocument("", "", null);
  if(zenbuCI.collabWidget) {
    var collab = configDOM.appendChild(doc.createElement("collaboration"));
    collab.setAttribute("uuid", zenbuCI.collabWidget.collaboration_uuid);
    collab.setAttribute("name", zenbuCI.collabWidget.collaboration_name);
  }
  if(zenbuCI.autosave) {
    var autosave = doc.createElement("autoconfig");
    autosave.setAttribute("value", "public");
    configDOM.appendChild(autosave);
  }
  var summary = configDOM.appendChild(doc.createElement("summary"));
  if(current_user) { 
    if(current_user.nickname) { summary.setAttribute("user", current_user.nickname); }
    if(current_user.openID) { summary.setAttribute("creator_openID", current_user.openID); }
  }
  if(zenbuCI.title) { 
    summary.setAttribute("name", encodehtml(zenbuCI.title));
    //var title = summary.appendChild(doc.createElement("title"));
    //title.nodeValue = zenbuCI.title;
  }
  if(zenbuCI.description) { 
    summary.setAttribute("desc", encodehtml(zenbuCI.description));
    //var description = summary.appendChild(doc.createElement("description"));
    //description.nodeValue = zenbuCI.description;
  }

  
  var serializer = new XMLSerializer();
  var configXML  = serializer.serializeToString(configDOM);
  
  //Opera now inserts <?xml version?> tags, need to remove them
  var idx1 = configXML.indexOf("<ZENBU_reports_page_config>");
  if(idx1 > 0) { configXML = configXML.substr(idx1); }
  
  zenbuCI.config = undefined; //clear old config object since it is not valid anymore
  
  //build the zenbu_query
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>saveconfig</mode><configtype>"+(zenbuCI.config_type.toLowerCase())+"</configtype>\n";
  if(zenbuCI.fixed_id) { paramXML += "<fixed_id>"+zenbuCI.fixed_id+"</fixed_id>\n"; }
  if(zenbuCI.title) { paramXML += "<title>"+ encodehtml(zenbuCI.title) + "</title>\n"; }
  if(zenbuCI.description) { paramXML += "<description>"+ encodehtml(zenbuCI.description) + "</description>\n"; }
  
  if(zenbuCI.autosave) {
    paramXML += "<autosave>true</autosave>\n";
  } else {
    if(zenbuCI.collabWidget) {
      paramXML += "<collaboration_uuid>"+ zenbuCI.collabWidget.collaboration_uuid +"</collaboration_uuid>\n";
    }
  }
  paramXML += "<configXML>" + configXML + "</configXML>";
  paramXML += "</zenbu_query>\n";
    
  var configXHR=GetXmlHttpObject();
  if(configXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  zenbuCI.saveConfigXHR = configXHR;
  
  configXHR.open("POST",eedbConfigCGI, true); //async
  configXHR.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  configXHR.onreadystatechange= function(id) { return function() { zenbuConfigurationInterfaceUploadResponse(id); };}(uniqID);
  configXHR.send(paramXML);
  zenbuCI.modified = false;
}


function zenbuConfigurationInterfaceUploadResponse(uniqID) {
  var zenbuCI = zenbuConfigurationInterface_hash[uniqID];
  if(!zenbuCI) { return; }   

  var configXHR = zenbuCI.saveConfigXHR;
  if(!configXHR) { return; }
  
  //might need to be careful here
  if(configXHR.readyState!=4) { return; }
  if(configXHR.responseXML == null) { return; }
  if(configXHR.status!=200) { return; }
  var xmlDoc=configXHR.responseXML.documentElement;
  if(xmlDoc==null) { return null; }
  
  // parse result back to get uuid and adjust view
  zenbuCI.configUUID = "";
  if(xmlDoc.getElementsByTagName("configuration")) {
    var configXML = xmlDoc.getElementsByTagName("configuration")[0];
    zenbuCI.config = eedbParseConfigurationData(configXML);
    if(zenbuCI.config) {
      zenbuCI.configUUID = zenbuCI.config.uuid;
      zenbuCI.fixed_id = zenbuCI.config.fixed_id;
      if(zenbuCI.config.collaboration) {
        //current_collaboration.name = zenbuCI.config.collaboration.name;
        //current_collaboration.uuid = zenbuCI.config.collaboration.uuid;
        console.log("loaded view has collaboration ["+zenbuCI.config.collaboration.name+"]  ["+zenbuCI.config.collaboration.uuid+"]")
      }
      // console.log("upload complete");
      // console.log("title:"+zenbuCI.config.title);
      // console.log("name:"+zenbuCI.config.name);
      // console.log("description:"+zenbuCI.config.description);
      // console.log("author:"+zenbuCI.config.author);
      // console.log("owner_identity:"+zenbuCI.config.owner_identity);
      // console.log("uuid:"+zenbuCI.config.uuid);
      // console.log("fixed_id:"+zenbuCI.config.fixed_id);
      // console.log("create_date:"+zenbuCI.config.create_date);
      // console.log("type:"+zenbuCI.config.type);
    }
  }
  
  if(zenbuCI.uploadCompleteFunction) { zenbuCI.uploadCompleteFunction(zenbuCI); }
}

