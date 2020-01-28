// ZENBU eedb_user.js
//
// Contact : Jessica Severin <severin@gsc.riken.jp> 
//
// * Software License Agreement (BSD License)
// * EdgeExpressDB [eeDB] system
// * ZENBU system
// * ZENBU eedb_user.js
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

var eedbUserXMLHttp;
var eedbUserXMLHttp2;
var eedbUserXMLHttp3;
var userview = new Object;

var eedbUploadFileCGI = eedbWebRoot + "/cgi/eedb_upload_file.cgi";

function eedbUserInitContents() {
  if(!browserCompatibilityCheck()) {
    window.location ="../browser_upgrade.html";
  }
  //zenbuGeneralWarn("Due to server room power maintenance at the RIKEN Yokohama campus, all ZENBU webservers will be shutdown from Aug 17 17:00 JST to Aug 21 20:00 JST.<br>"+
  //                  "We appologize for the inconvenience to ZENBU users, but we will restore services as soon as possible.");

  dhtmlHistory.initialize();

  // reset global current_collaboration
  current_collaboration.name = "private";
  current_collaboration.uuid = "private";
  current_collaboration.callOutFunction = null;

  userview.user = eedbShowLogin();

  userview.mode = "profile";
  //if(userview.user) { userview.mode = "collaborations"; }
  userview.current_view_index = 0;
  userview.page_size = 20;
  userview.num_pages = 0;
  userview.error_msg = "";

  userview.filters = new Object;
  userview.filters.platform = "";
  userview.filters.assembly = "";
  userview.filters.search = "";
  userview.filters.hide_mapcount = 1;
  userview.filters.only_my_uploads = true;

  userview.assemblies = new Object;
  userview.assemblies['hg18'] = 'human hg18';
  userview.assemblies['hg19'] = 'human hg19';
  userview.assemblies['mm9']  = 'mouse mm9';
  userview.assemblies['mm10']  = 'mouse mm10';
  userview.assemblies['rn4']  = 'rat rn4';
  userview.assemblies['galGal3']  = 'chicken galGal3';
  userview.assemblies['galGal4']  = 'chicken galGal4';
  userview.assemblies['canFam2']  = 'dog canFam2';
  userview.assemblies['susScr2']  = 'pig susScr2';
  userview.assemblies['dm3']  = 'drosophila R5/dm3';
  userview.assemblies['danRer6']  = 'zebrafish Zv8';
  userview.assemblies['Zv9']  = 'zebrafish Zv9';
  userview.assemblies['rheMac2']  = 'rhesus macaque rheMac2';
  userview.assemblies['rheMacMulLas']  = 'Macaca mulatta lasiota (rheMacMulLas)';
  userview.assemblies['RPV_L_WT']  = 'rinderpest virus RPV_L_WT';
  userview.assemblies['RPV_L_delC']  = 'rinderpest virus RPV_L_delC';
  userview.assemblies['H3N2udornNCBI']  = 'influenza A H3N2 udorn - NCBI';
  userview.assemblies['H3N2udornDigard']  = 'influenza A H3N2 udorn - Digard';

  userview.uploads = new Object;
  userview.uploads.source_hash = new Object();
  userview.uploads.peer_hash = new Object();
  userview.uploads.refreshInterval = undefined;

  userview.downloads = new Object;
  userview.downloads.source_hash = new Object();

  userview.collaborations = new Object;
  userview.collaborations.uuid_hash = new Object();
  userview.collaborations.loaded = false;

  eedbUserXMLHttp=GetXmlHttpObject();
  eedbUserXMLHttp2=GetXmlHttpObject();
  eedbUserXMLHttp3=GetXmlHttpObject();
  if(eedbUserXMLHttp==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }

  var initialURL = dhtmlHistory.getCurrentLocation();
  if(initialURL) { eedbUserParseURL(initialURL); }
  dhtmlHistory.addListener(eedbUserHandleHistoryChange);

  eedbUserShowSubmenu();
  //eedbUserReloadContentsData();
  eedbUserShowContents();
  //zenbuRegisterCurrentURL();

  eedbUserReloadCollaborations("async"); //make sure list of collaborations are loading in the background
}


function eedbUserSearchSubmit() {
  var searchInput = document.getElementById("eedb_user_uploads_search_input");
  if(!searchInput) { return; }
  eedbUserCloseUploadSourcesPanel();
  eedbSourceInfoEvent('close');
  userview.current_view_index = 0;
  var str = searchInput.value;
  userview.filters.search = str;
  userview.uploads.loading = true;
  eedbUserShowUploads();
  eedbUserReloadContentsData();
  return false;
}

function eedbUserSearchClear(reload) {
  var searchInput = document.getElementById("eedb_user_uploads_search_input");
  if(!searchInput) { return; }
  eedbUserCloseUploadSourcesPanel();
  eedbSourceInfoEvent('close');
  searchInput.value ="";
  userview.filters.search = "";
  if(reload) { 
    userview.uploads.loading = true;
    eedbUserShowUploads();
    eedbUserReloadContentsData(); 
  }
  return false;
}


function eedbLoginChanged() {
  //optional callout function when the login has changed
  userview.user = eedbShowLogin();
  eedbUserShowSubmenu();
  eedbUserShowContents();
}


function eedbUserParseURL(urlConfig) {
  //this function takes URL address, parses for configuration UUID and
  //location, and then reconfigures the view.  But it does not execute a reload/redraw

  //document.getElementById("message").innerHTML += "eedbUserParseURL " + urlConfig;
  if(!urlConfig) { return false; }
  var params = urlConfig.split(";");
  var rtnval = false;
  for(var i=0; i<params.length; i++) {
    var param = params[i];
    //document.getElementById("message").innerHTML += " param[" + param +"]";
    var tagvalue = param.split("=");
    if(tagvalue.length != 2) { continue; }
    if(tagvalue[0] == "section") {
      eedbUserReconfigParam("mode", tagvalue[1]);
      rtnval = true;
    }
    if(tagvalue[0] == "error") {
      userview.error_msg = "ERROR with login: "+tagvalue[1];
    }
  }
  return rtnval;
}

function eedbUserHandleHistoryChange(newLocation, historyData) {
  eedbUserSearchClear();
  if(eedbUserParseURL(newLocation)) { 
    userview.user = eedbShowLogin();
    eedbUserShowSubmenu();
    eedbUserShowContents();
  }
}


//
//---------------------------------------------------------------------------
//

function eedbUserShowSubmenu() {
  var submenu_div = document.getElementById("eedb_user_submenu");
  if(!submenu_div) { return; }

  //userview.user = eedbShowLogin();
  submenu_div.innerHTML ="";

  submenu_div.setAttribute('style', "margin: 4px 0px 5px 0px; background-repeat:repeat-x;"+
     "background-image:url("+eedbWebRoot+"/images/subnav_bg.gif); width:480px;"+
     "line-height:2em; border-right:1px; color:#FFFFFF; font-weight:bold;"+
     "font-family:Verdana, Arial, Helvitica, sans-serif; text-decoration:none; font-size:11px;");

  var spanstyle = "line-height:2em; padding:5px 10px 5px 10px; border-right:1px; ";

  var span1 = submenu_div.appendChild(new Element('span'));
  if(!userview.user) { 
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.innerHTML = "login";
    userview.mode = "profile";
    return;
  } else {
    if(userview.mode == "profile") { span1.setAttribute("style", spanstyle+"color:black;"); }
    else { 
      span1.setAttribute("style", spanstyle);
      span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'in');");
      span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'out');");
      span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'profile');");
    }
    span1.innerHTML = "profile";
  }
  if(!userview.user.email) { return; }

  span1 = submenu_div.appendChild(new Element('span'));
  if(userview.mode == "uploads") {
    span1.setAttribute("style", spanstyle+"color:black;");
    span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'selected_in');");
    span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'selected_out');");
    span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'uploads');");
  } else {
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'uploads');");
  }
  span1.innerHTML = "data upload";

  span1 = submenu_div.appendChild(new Element('span'));
  if(userview.mode == "collaborations") { 
    span1.setAttribute("style", spanstyle+"color:black;"); 
    span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'selected_in');");
    span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'selected_out');");
    span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'collaborations');");
  }
  else { 
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'collaborations');");
  }
  span1.innerHTML = "collaborative projects";

  span1 = submenu_div.appendChild(new Element('span'));
  if(userview.mode == "downloads") { 
    span1.setAttribute("style", spanstyle+"color:black;"); 
    span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'selected_in');");
    span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'selected_out');");
    span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'downloads');");
  } else { 
    span1.setAttribute("style", spanstyle);
    span1.setAttribute("onMouseOver", "eedbUserSubmenuHover(this, 'in');");
    span1.setAttribute("onMouseOut",  "eedbUserSubmenuHover(this, 'out');");
    span1.setAttribute("onclick", "eedbUserReconfigParam('mode', 'downloads');");
  }
  span1.innerHTML = "downloads";
}

function eedbUserSubmenuHover(item, mode) {
  if(mode == "in") { 
    item.setAttribute("style", "line-height:2em; padding:5px 10px 5px 10px; border-right:1px; background-color:#C0C0C0;");
  }
  if(mode == "out") { 
    item.setAttribute("style", "line-height:2em; padding:5px 10px 5px 10px; border-right:1px;");
  }
  if(mode == "selected_in") { 
    item.setAttribute("style", "color:black; line-height:2em; padding:5px 10px 5px 10px; border-right:1px; background-color:#C0C0C0;");
  }
  if(mode == "selected_out") { 
    item.setAttribute("style", "color:black; line-height:2em; padding:5px 10px 5px 10px; border-right:1px;");
  }
}

//
//---------------------------------------------------------------------------
//

function eedbUserReloadContentsData() {
  if(userview.mode == "uploads") { eedbUserReloadMySourceData(); }
}

function eedbUserShowContents() {
  current_collaboration.callOutFunction = null;
  if(!userview.user) { return eedbUserProfilePanel(); }
  if(userview.mode == "profile") { return eedbUserProfilePanel(); }
  if(userview.mode == "uploads") { return eedbUserShowUploads(); }
  if(userview.mode == "downloads") { return eedbUserDownloadsView(); }
  if(userview.mode == "collaborations") { return eedbCollaborationView(); }
  if(userview.mode == "validate") { return eedbUserProfilePanel(); }

  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }
  main_div.innerHTML ="";
}

//---------------------------------------------------------------------------
//
// login / profile section
//
//---------------------------------------------------------------------------

function eedbUserProfilePanel() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }

  main_div.setAttribute('style', "margin: 0% 5% 0% 5%; text-decoration:none; font-size:14px; color:black;");
  main_div.innerHTML = "";

  if(!userview.user) { 
    var div1 = main_div.appendChild(document.createElement('div'));
    div1.setAttribute("style", "font-weight:bold; font-size:16px;");
    div1.innerHTML = "Welcome to ZENBU : User Login";
  
    var div3 = main_div.appendChild(document.createElement('div'));
    div3.setAttribute("style", "margin-top:5px; font-size:12px;");
    var div3b = div3.appendChild(document.createElement('div'));
    div3b.innerHTML = "ZENBU user login provides additional features not available with guest accounts";
  
    var ul1 = div3.appendChild(document.createElement('ul'));
    ul1.setAttribute("style", "margin-top:0px; font-size:12px;");
    var li = ul1.appendChild(document.createElement('li'));
    li.innerHTML = "secured data sharing for research collaboration projects";
    li = ul1.appendChild(document.createElement('li'));
    li.innerHTML = "user data upload capability";
    li = ul1.appendChild(document.createElement('li'));
    li.innerHTML = "private configurations not published to the general public";
  
    return zenbuUserLoginPanel(); 
  }

  var h3 = main_div.appendChild(document.createElement('h3'));
  h3.innerHTML = "Welcome to ZENBU : ";
  var div1, label1, name_span, input1;

  div1 = main_div.appendChild(document.createElement('div'));
  label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:normal; color:black;");
  label1.innerHTML ="email identity: ";
  name_span = div1.appendChild(document.createElement('span'));
  if(userview.user.email) {
    name_span.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
    name_span.innerHTML = userview.user.email;

    button = div1.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onclick", "zenbuUserResetPasswordPanel();");
    button.innerHTML ="change password";
  } else {
    name_span.setAttribute("style", "font-weight:bold; color:rgb(198,74,74);");
    name_span.innerHTML = "user must validate their email address";
  }


  //------------------------------------------------------------------------------
  var form1 = main_div.appendChild(document.createElement('form'));
  div1 = form1.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:normal; color:black;");
  label1.innerHTML = "nickname: ";
  input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_user_profile_nickname";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "nickname");
  input1.setAttribute("size", "30");
  if(userview.user.nickname) { input1.setAttribute("value", userview.user.nickname); }

  button = div1.appendChild(new Element('button'));
  button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbUserSubmitProfileUpdate();");
  button.innerHTML ="update nickname";
  form1.setAttribute("onsubmit", "eedbUserSubmitProfileUpdate();");

  //------------------------------------------------------------------------------
  var form1 = main_div.appendChild(document.createElement('form'));
  form1.setAttribute("onsubmit", "eedbUserSubmitProfileUpdate();");
  div1 = form1.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:normal; color:black;");
  label1.innerHTML = "hmac key: ";
  input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_user_profile_hmac";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "hmac");
  input1.setAttribute("size", "80");
  if(userview.user.hmackey) { input1.setAttribute("value", userview.user.hmackey); }

  button = div1.appendChild(new Element('button'));
  button.setAttribute("style", "font-size:11px; font-family:arial,helvetica,sans-serif; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbUserGenerateHmacKey();");
  button.innerHTML ="generate random hmac key";

  //------------------------------------------------------------------------------
  div1 = main_div.appendChild(document.createElement('div'));
  label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:normal; color:black;");
  label1.innerHTML ="openIDs: ";
  for(var j=0; j<userview.user.openid_array.length; j++) {
    name_span = div1.appendChild(document.createElement('div'));
    name_span.setAttribute("style", "font-weight:bold; color:rgb(94,115,153); margin-left:30px;");
    var openID = userview.user.openid_array[j];
    if(j>0) { name_span.innerHTML += "   "; }
    name_span.innerHTML = openID;
  }
  //------------------------------------------------------------------------------

  /*
  div1 = main_div.appendChild(document.createElement('div'));
  button = div1.appendChild(new Element('button'));
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbUserSubmitProfileUpdate();");
  button.innerHTML ="update profile";
  */





  /*
  div1 = main_div.appendChild(document.createElement('div'));
  button = div1.appendChild(new Element('button'));
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbUserSubmitProfileUpdate();");
  button.innerHTML ="update profile";
  */

  /*
  div1 = main_div.appendChild(document.createElement('div'));
  div1.setAttribute("style", "margin-top:20px;");
  button = div1.appendChild(new Element('button'));
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbUserSubmitUpgrade();");
  button.innerHTML ="upgrade user uploaded databases";
  */

  if(userview.user.no_password) {
    zenbuUserResetPasswordPanel();
  }
}


function eedbUserSubmitProfileUpdate() {
  var nickname_input  = document.getElementById("eedb_user_profile_nickname");
  var hmac_input      = document.getElementById("eedb_user_profile_hmac");

  var paramXML = "<zenbu_query>";
  paramXML += "<mode>update-profile</mode>";
  if(nickname_input && nickname_input.value) {
    paramXML += "<nickname>"+ nickname_input.value +"</nickname>";
  }
  if(hmac_input && hmac_input.value) {
    paramXML += "<set_hmac>"+ hmac_input.value +"</set_hmac>";
  }
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  eedbLoginChanged();
}


function eedbUserGenerateHmacKey() {
  var paramXML = "<zenbu_query>";
  paramXML += "<mode>generate_hmac</mode>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  eedbLoginChanged();
}


function eedbUserSubmitUpgrade() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }
  var divFrame = document.getElementById("eedb_user_upgrade_info_div");
  if(divFrame) { return; }  //already doing an upgrade

  var tdiv, tspan, tinput, ta;
  divFrame = main_div.appendChild(document.createElement('div'));
  divFrame.id = "eedb_user_upgrade_info_div";
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:center; "
                            +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                            +"left:" + ((winW/2)-150) +"px; "
                            +"top:200px; "
                            +"width:300px; height:80px; z-index:100;"
                             );

  tdiv = divFrame.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-size:18px; font-weight: bold;");
  tspan.innerHTML = "<p>upgrading user uploaded databases";

  var paramXML = "<zenbu_query><mode>upgrade_user_dbs</mode></zenbu_query>\n";
  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, true);
  xhr.onreadystatechange= eedbUserUpgradeCompleted;
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);
}

function eedbUserUpgradeCompleted() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }
  var divFrame = document.getElementById("eedb_user_upgrade_info_div");
  if(divFrame) { main_div.removeChild(divFrame); }
}


function eedbUserSubmitInvitationEmail() {
  var email_input    = document.getElementById("eedb_user_profile_email");
  if(!email_input) { eedbUserCloseEmailValidatePanel(); return; }
  var email = email_input.value;
  if(!email) { eedbUserCloseEmailValidatePanel(); return; }

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>send_validation</mode>\n";
  paramXML += "<profile_email>"+ email +"</profile_email>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, true);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  eedbUserCloseEmailValidatePanel();
}


function zenbuUserResetPasswordPanel() {
  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }
  if(!current_user) { return; }
  if(!current_user.email) { return; }

  main_div.innerHTML = "";

  var tdiv, tspan, tinput, ta;
  divFrame = main_div.appendChild(document.createElement('div'));
  divFrame.id = "zenbu_user_reset_password_panel";
  divFrame.setAttribute('style', "position:absolute; background-color:#e0f0ec; text-align:left; "+
                        "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                        "z-index:1; top:180px; width:520px;"+
                        "left:" + ((winW/2)-260) +"px; "
                        );
  divFrame.innerHTML = "";

  // title
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : change password";

  // close button
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  //a1.setAttribute("onclick", "eedbUserCloseNewUploadPanel();return false");
  a1.setAttribute("onclick", "document.getElementById('eedb_user_altdiv').innerHTML=''; location.reload(); return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var div1, form, label1, input1, text1, span1;

  var table1 = divFrame.appendChild(document.createElement('table'));
  table1.setAttribute("style", "font-weight:normal; color:black;");

  tr1 = table1.appendChild(document.createElement('tr'));
  td1 = tr1.appendChild(document.createElement('td'));
  td1.innerHTML = "email identity:";
  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("style", "font-weight:bold; color:black;");
  if(current_user.email) { td1.innerHTML = current_user.email; }

  tr1 = table1.appendChild(document.createElement('tr'));
  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("style", "font-weight:normal; color:black;");
  td1.innerHTML = "new password: ";
  td2 = tr1.appendChild(document.createElement('td'));
  input1 = td2.appendChild(document.createElement('input'));
  input1.id  = "zenbu_user_reset_password_new1";
  input1.setAttribute("type", "password");
  input1.setAttribute("size", "40");
  input1.setAttribute("onkeyup", "zenbuUserPasswordCheck();");
  td2 = tr1.appendChild(document.createElement('td'));
  div2 = td2.appendChild(new Element('div'));
  div2.id = "zenbu_user_reset_password_strength"; 
  div2.setAttribute("style", "width:130px; font-size:12px; padding: 1px 10px; border-radius: 0px; border: solid 1px #000000; background:#FF0000; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  div2.innerHTML ="too short &#9734;&#9734;&#9734;&#9734;&#9734;";
 
  tr1 = table1.appendChild(document.createElement('tr'));
  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("style", "font-weight:normal; color:black;");
  td1.innerHTML = "retype password: ";
  td2 = tr1.appendChild(document.createElement('td'));
  input1 = td2.appendChild(document.createElement('input'));
  input1.id  = "zenbu_user_reset_password_new2";
  input1.setAttribute("type", "password");
  input1.setAttribute("size", "40");
  input1.setAttribute("onkeyup", "zenbuUserPasswordCheck();");
  td2 = tr1.appendChild(document.createElement('td'));
  div2 = td2.appendChild(new Element('div'));
  div2.id = "zenbu_user_reset_password_match"; 
  div2.innerHTML ="";

  div1 = divFrame.appendChild(document.createElement('div'));
  button = div1.appendChild(new Element('button'));
  button.id  = "zenbu_user_reset_password_button";
  button.setAttribute("style", "width:300px; font-size:12px; padding: 1px 4px; margin:10px 0px 15px 100px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("type", "button");
  button.setAttribute("disabled", "disabled");
  button.setAttribute("onclick", "zenbuSubmitPasswordReset();");
  button.innerHTML ="set password";

  if(userview.error_msg) {
    div1 = divFrame.appendChild(document.createElement('div'));
    div1.setAttribute("style", "font-weight:bold; color:#B22222;");
    div1.innerHTML = userview.error_msg;
  }
}


function zenbuUserPasswordCheck() {
  userview.error_msg = "";
  var input1 = document.getElementById("zenbu_user_reset_password_new1");
  var input2 = document.getElementById("zenbu_user_reset_password_new2");
  if(!input1 || !input2) { zenbuUserResetPasswordPanel(); return; }

  var strengthDiv = document.getElementById("zenbu_user_reset_password_strength");
  var matchDiv = document.getElementById("zenbu_user_reset_password_match");
  matchDiv.innerHTML = "";

  var button = document.getElementById("zenbu_user_reset_password_button");
  button.setAttribute("disabled", "disabled");

  var pass1 = input1.value;
  var pass2 = input2.value;
  
  if(pass1.length < 3) {
    strengthDiv.style.background = "#FF0000";
    strengthDiv.innerHTML = "too short &#9734;&#9734;&#9734;&#9734;&#9734;";
    return;
  }
  if(pass1!=pass2) { matchDiv.innerHTML = "does not match"; }

  var score = scorePassword(pass1);
  //strengthDiv.innerHTML = score + " ";
  strengthDiv.innerHTML = "";
  if((pass1==pass2) && (score>=20)) { button.removeAttribute("disabled"); }

  if(score > 80) {
    strengthDiv.style.background = "green";
    strengthDiv.innerHTML += "very strong &#9733;&#9733;&#9733;&#9733;&#9733;";
  }
  if(score<=80 && score>60) {
    strengthDiv.style.background = "#AAFF55";
    strengthDiv.innerHTML += "strong &#9733;&#9733;&#9733;&#9733;&#9734;";
  }
  if(score<=60 && score>=40) {
    strengthDiv.style.background = "#FFFF66";
    strengthDiv.innerHTML += "ok &#9733;&#9733;&#9733;&#9734;&#9734;";
  }
  if(score<40 && score>=20) {
    strengthDiv.style.background = "#FF6600";
    strengthDiv.innerHTML += "weak &#9733;&#9733;&#9734;&#9734;&#9734;";
  }
  if(score<20) {
    strengthDiv.style.background = "#FF7777";
    strengthDiv.innerHTML += "very weak &#9733;&#9734;&#9734;&#9734;&#9734;";
  }
}




function zenbuSubmitPasswordReset() {
  userview.error_msg = "";
  var input1 = document.getElementById("zenbu_user_reset_password_new1");
  var input2 = document.getElementById("zenbu_user_reset_password_new2");
  if(!input1 || !input2) { zenbuUserResetPasswordPanel(); return; }

  var pass1 = input1.value;
  var pass2 = input2.value;
  
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>reset_password</mode>\n";
  paramXML += "<newpass1>"+ pass1 +"</newpass1>";
  paramXML += "<newpass2>"+ pass2 +"</newpass2>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  userview.error_msg = "problem reseting password, please try again";
  if(xhr.readyState!=4) { return zenbuUserResetPasswordPanel(); }
  if(xhr.responseXML == null) { return zenbuUserResetPasswordPanel(); }
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { return zenbuUserResetPasswordPanel(); } 
  var errorXML = xmlDoc.getElementsByTagName("ERROR");
  if(errorXML.length>0) {
    var msg = errorXML[0].firstChild.nodeValue;
    if(msg == "email_exists") {
      userview.error_msg = "that email is already registered, please login or pick a different email";
    } else {
      userview.error_msg = msg;
    }
    return zenbuUserResetPasswordPanel();
  }

  //OK
  userview.error_msg = "";
  document.getElementById('eedb_user_altdiv').innerHTML='';
}



//---------------------------------------------------------------------------
//
// Upload section
//
//---------------------------------------------------------------------------

function eedbUserNewUploadPanel() {
  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }

  if(userview.uploads.refreshInterval) {
    window.clearInterval(userview.uploads.refreshInterval);
    userview.uploads.refreshInterval = undefined;
  }

  var upload_panel = document.getElementById("eedb_user_new_upload_panel");
  if(upload_panel) { return eedbUserNewUploadPanelRefresh(); }

  upload_panel = main_div.appendChild(document.createElement('div'));
  upload_panel.id = "eedb_user_new_upload_panel";
  upload_panel.setAttribute('style', "position:absolute; background-color:#e0f0ec; text-align:left; "+
//background-color: #e0f0ec  aleTurquoise
                             "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                             "z-index:1; top:180px; width:860px;"+
                             "left:" + ((winW/2)-430) +"px; "
                           );
  upload_panel.innerHTML = "";

  userview.upload = new Object;
  userview.upload.assembly = null;
  userview.upload.display_name = "";
  userview.upload.description = "";
  userview.upload.datatype = "";
  userview.upload.edgemode = "node";
  userview.upload.strict_edge_linking = true;
  userview.upload.file_format = null;
  userview.upload.file_path = null;
  
  // title
  var tdiv = upload_panel.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : data file upload";

  // close button
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserCloseNewUploadPanel();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var div1, form, label1, input1, text1, span1;

  div1 = upload_panel.appendChild(document.createElement('div'));
  div1.setAttribute('style', "color:red; margin: 10px 0px 10px 0px; text-decoration:none; font-size:10px;");
  div1.innerHTML ="Disclaimer: The ZENBU user system is designed to be secured. By design your uploaded data will only be available to you and your selected collaborators with whom you choose to share the data.  But note that we do not guarantee the security or privacy of your data, and we can not be held responsible for your data security.";

  div1 = upload_panel.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 10px 0px; text-decoration:none; font-size:14px;");
  div1.innerHTML="currently ZENBU supports ";
  div1.innerHTML +="<a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/BED'>BED</a>";
  div1.innerHTML +=", <a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/BAM'>BAM</a>";
  div1.innerHTML +=", <a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/GFF_and_GTF_file_support'>GFF/GFF2/GTF</a>";
  div1.innerHTML +=", and <a target='_blank' href='https://zenbu-wiki.gsc.riken.jp/zenbu/wiki/index.php/OSCtable'>OSC</a> ";
  div1.innerHTML +=" files for upload. <br>Texted based files can be gzip (.gz) compressed prior to upload";

  form = upload_panel.appendChild(document.createElement('form'));
  form.id = "eedb_user_upload_form";
  form.setAttribute("action", eedbUploadFileCGI);
  form.setAttribute("method", "POST");
  form.setAttribute("enctype", "multipart/form-data");

  div1 = form.appendChild(document.createElement('div'));
  //div1.setAttribute('style', "margin: 0px 0px 20px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "File to upload: ";

  input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_upload_file";
  input1.setAttribute("type", "file");
  input1.setAttribute("name", "upload_file");
  input1.setAttribute("size", "50");
  input1.setAttribute("onchange", "eedbUserReconfigParam('upload-file', this.value);");

  div1 = form.appendChild(document.createElement('div'));
  span1 = div1.appendChild(document.createElement('span'));
  span1.setAttribute("style", "margin-right:5px;");
  span1.innerHTML ="file type: ";
  span1 = div1.appendChild(document.createElement('span'));
  span1.id  = "eedb_upload_filetype";
  span1.setAttribute("style", "font-weight:bold; color:rgb(94,115,153);");
  span1.innerHTML ="unknown file type";

  //--------  express options
  express_options = form.appendChild(document.createElement('div'));
  express_options.setAttribute("style", "margin:3px 0px 0px 15px; display:none;");
  express_options.id = "eedb_user_upload_expression_options";

  var tdiv,tdiv2,tcheck,tspan1,tspan2;

  bedscore_div = express_options.appendChild(document.createElement('div'));
  bedscore_div.id = "eedb_user_upload_bedscore_div";
  bedscore_div.setAttribute("style", "display:none;");
  tcheck = bedscore_div.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 0px;");
  tcheck.setAttribute('name', "bedscore_expression");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "eedbUserReconfigParam('bedscore-express', this.checked);");
  if(userview.upload.bedscore_express) {tcheck.setAttribute("checked", "checked"); }
  tspan2 = bedscore_div.appendChild(document.createElement('span'));
  tspan2.innerHTML = " score column has experimental signal values";

  tdiv2 = bedscore_div.appendChild(document.createElement('div'));
  tdiv2.id = "eedb_user_upload_datatype_div";
  tdiv2.setAttribute("style", "margin-left:10px;");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.innerHTML = "expression datatype:";
  var input1 = tdiv2.appendChild(document.createElement('input'));
  input1.id  = "eedb_user_upload_datatype";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "datatype");
  input1.setAttribute("size", "20");
  input1.setAttribute("value", userview.upload.datatype);
  input1.setAttribute("onkeypress", "eedbUserReconfigParam('upload-datatype', this.value);");
  tspan2 = tdiv2.appendChild(document.createElement('span'));
  tspan2.setAttribute("style", "margin-left:5px;");
  tspan2.innerHTML = "(eg: tagcount, norm, raw, tpm, rle, score, pvalue....)";

  tdiv = express_options.appendChild(document.createElement('div'));
  tcheck = tdiv.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 0px;");
  tcheck.setAttribute('name', "singletagmap_expression");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "eedbUserReconfigParam('singletagmap-express', this.checked);");
  if(userview.upload.singletagmap_express) {tcheck.setAttribute("checked", "checked"); }
  tspan2 = tdiv.appendChild(document.createElement('span'));
  tspan2.innerHTML = " single-tagcount expression";
  tdiv2 = tdiv.appendChild(document.createElement('div'));
  tdiv2.setAttribute("style", "margin-left:20px;");
  tdiv2.innerHTML = "Count each line of file as expression of 1 tagcount (no correction for 'multi-mapping' locations).";

  /* still buggy for bed files */
  /*
  tdiv = express_options.appendChild(document.createElement('div'));
  tcheck = tdiv.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 1px 0px 0px;");
  tcheck.setAttribute('name', "build_feature_name_index");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "eedbUserReconfigParam('build_feature_name_index', this.checked);");
  if(userview.upload.build_feature_name_index) {tcheck.setAttribute("checked", "checked"); }
  tspan2 = tdiv.appendChild(document.createElement('span'));
  tspan2.innerHTML = "Build name indexing for annotation features (eg genes, transcripts)";
  */


  //-------- data file uploads name/description --------
  namedesc_div = form.appendChild(document.createElement('div'));
  namedesc_div.id = "eedb_user_upload_namedesc_div";
  namedesc_div.setAttribute("style", "display:none;");

  div1 = namedesc_div.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 20px 0px 0px 0px;");
  var genomeWidget = eedbUserCreateAssemblySelect(true);
  userview.upload.genomeWidget = genomeWidget;
  div1.appendChild(genomeWidget);
  zenbuGenomeSelectUpdate();

  //node-edge options
  node_edge_options = namedesc_div.appendChild(document.createElement('div'));
  node_edge_options.setAttribute("style", "display:none;");
  node_edge_options.id = "eedb_user_upload_node_edge_options";
  
  var fsrc1 = form.appendChild(document.createElement('input'));
  fsrc1.id  = "eedb_upload_edge_fsrc1";
  fsrc1.setAttribute("type", "hidden");
  fsrc1.setAttribute("name", "featuresource1");
  fsrc1.setAttribute("value", "");
  var fsrc2 = form.appendChild(document.createElement('input'));
  fsrc2.id  = "eedb_upload_edge_fsrc2";
  fsrc2.setAttribute("type", "hidden");
  fsrc2.setAttribute("name", "featuresource2");
  fsrc2.setAttribute("value", "");

  //----------  
  //var platform_span = eedbUserCreatePlatformSelect();
  //div1.appendChild(platform_span);

  namedesc_div.appendChild(document.createElement('hr'));

  div1 = namedesc_div.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "Display name: ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_upload_display_name";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "display_name");
  input1.setAttribute("size", "50");
  input1.setAttribute("onkeypress", "eedbUserReconfigParam('upload-display_name', this.value);");


  div1 = namedesc_div.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  div1.innerHTML="please enter description of data file";

  div1 = namedesc_div.appendChild(document.createElement('div'));
  text1 = div1.appendChild(document.createElement('textarea'));
  text1.id  = "eedb_upload_description";
  text1.setAttribute("style", "max-width:650px; min-width:650px; min-height:100px;");
  text1.setAttribute("rows", "6");
  text1.setAttribute("name", "description");
  text1.setAttribute("onchange", "eedbUserReconfigParam('upload-description', this.value);");

  //-------- genome options --------
  genome_div = form.appendChild(document.createElement('div'));
  genome_div.id = "eedb_user_upload_genome_div";
  genome_div.setAttribute("style", "display:none;");

  div1 = genome_div.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "NCBI taxon_id: ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_upload_taxon_id";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "taxon_id");
  input1.setAttribute("size", "20");
  input1.setAttribute("onkeypress", "eedbUserReconfigParam('upload-taxon_id', this.value);");

  div1 = genome_div.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "genome unique name (eg rheMac2): ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedb_upload_genome_name";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "upload_genome_name");
  input1.setAttribute("size", "20");
  input1.setAttribute("onkeypress", "eedbUserReconfigParam('upload-genome_name', this.value);");


  //-------- upload button --------
  div1 = form.appendChild(document.createElement('div'));
  var input2 = div1.appendChild(document.createElement('input'));
  input2.id = "eedb_user_upload_button";
  input2.setAttribute("style", "width:300px; margin:12px 0px 10px 50px; ");
  //input2.setAttribute("type", "submit");
  input2.setAttribute("type", "button");
  input2.setAttribute("disabled", "disabled");
  input2.setAttribute("value", "Copy file and Queue upload");
  input2.setAttribute("onmousedown", "eedbUserReconfigParam('upload-submit', '');");

  div1 = upload_panel.appendChild(document.createElement('div'));
  div1.id = "eedb_user_upload_send_message";
  div1.innerHTML = "";
}


function eedbUserNewUploadPanelRefresh() {
  if(!userview.upload) { return false; }

  var upload_panel = document.getElementById("eedb_user_new_upload_panel");
  if(!upload_panel) { return false; }

  var dispname = document.getElementById("eedb_upload_display_name");
  if(dispname) {
     dispname.setAttribute("value", userview.upload.display_name);
  }
  var desc = document.getElementById("eedb_upload_description");
  if(desc) {
    desc.value = userview.upload.description;
  }
  var button = document.getElementById("eedb_user_upload_button");
  if(button) {
    if(!userview.upload.assembly || !userview.upload.file_path || userview.upload.file_sent) { button.setAttribute("disabled", "disabled"); }
    else { button.removeAttribute("disabled"); }
  } 
  var filetype = document.getElementById("eedb_upload_filetype");
  if(filetype) {
    if(userview.upload.file_format) { filetype.innerHTML = userview.upload.file_format; }
    else { filetype.innerHTML ="unknown file type"; }
    if(userview.upload.file_format == "BAM") {
      //filetype.innerHTML +=" <br><span style='color:red; font-size:10px; font-weight:normal;'>Note that BAM files must include a valid <a target='_blank' href='http://samtools.github.io/hts-specs/SAMv1.pdf'>header</a>. Check with samtools -H [file] prior to upload if you are uncertain.</span>";
    }
  }
  var sendmsg = document.getElementById("eedb_user_upload_send_message");
  if(sendmsg && userview.upload.file_sent) {
    sendmsg.innerHTML = "File is now copying to server. Please wait....";
  }

  if(userview.upload.assembly) { current_genome.name = userview.upload.assembly; }
  if(userview.upload.genomeWidget) {
    if(userview.upload.file_format == "OSC") { userview.upload.genomeWidget.setAttribute("allow_non_genomic", "true"); }
    else { userview.upload.genomeWidget.setAttribute("allow_non_genomic", "false"); }
  }
  zenbuGenomeSelectUpdate();
  
  /*
  var assemblySelect = document.getElementById("_assemblySelect");
  if(assemblySelect) {
    for(var i=0;i<assemblySelect.options.length;i++) {
      if(assemblySelect.options[i].value == userview.upload.assembly) {
        assemblySelect.options[i].selected = true;
      }
    }
  }
  */

  var express_options  =  document.getElementById("eedb_user_upload_expression_options");
  var bedscore_options = document.getElementById("eedb_user_upload_bedscore_div");
  var namedesc_options = document.getElementById("eedb_user_upload_namedesc_div");
  var genome_options   = document.getElementById("eedb_user_upload_genome_div");
  var edge_options     = document.getElementById("eedb_user_upload_node_edge_options");
  var datatype_div     = document.getElementById("eedb_user_upload_datatype_div");
  var datatype_input   = document.getElementById("eedb_user_upload_datatype");

  express_options.setAttribute("style", "display:none;");
  namedesc_options.setAttribute("style", "display:none;");
  bedscore_options.setAttribute("style", "display:none;");
  genome_options.setAttribute("style", "display:none;");
  edge_options.setAttribute("style", "display:none;");

  if(userview.upload.file_format) { 
    if(userview.upload.file_format == "GENOME") {
      genome_options.setAttribute("style", "display:block;");
      if(!userview.upload.genome_name || !userview.upload.taxon_id || !userview.upload.file_path) { button.setAttribute("disabled", "disabled"); }
      else { button.removeAttribute("disabled"); }
    } else {
      namedesc_options.setAttribute("style", "display:block;");
      if(userview.upload.file_format != "BAM") {
        //if(!userview.upload.file_format || (userview.upload.file_format == "BAM")) {
        //  express_options.setAttribute("style", "display:none;");
        //} else {
        express_options.setAttribute("style", "margin:3px 0px 0px 15px; display:block;");
        bedscore_options.setAttribute("style", "display:none;");
        datatype_div.setAttribute("style", "display:none;");

        if((userview.upload.file_format == "BED") || (userview.upload.file_format == "OSC")) {
          bedscore_options.setAttribute("style", "display:block;");
          if(userview.upload.bedscore_express) { datatype_div.setAttribute("style", "margin-left:15px; display:block;"); } 
          else { datatype_div.setAttribute("style", "display:none;"); }
          datatype_input.setAttribute("value", userview.upload.datatype);
        }
      }
    }
  }
  
  if(userview.upload.assembly == "non-genomic") {
    edge_options.setAttribute("style", "display:block;");
    edge_options.innerHTML = "";
  
    tdiv = edge_options.appendChild(document.createElement('div'));
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.setAttribute('style', "margin:0px 3px 0px 5px;");
    tspan.innerHTML = "non-genomic data type:";

    var radio1 = tdiv.appendChild(document.createElement('input'));
    radio1.setAttribute("type", "radio");
    radio1.setAttribute("value", "node");
    radio1.setAttribute("onchange", "eedbUserReconfigParam('upload-edge-mode', this.value);");
    if(userview.upload.edgemode == "node") { radio1.setAttribute("checked", "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "nodes";

    var radio2 = tdiv.appendChild(document.createElement('input'));
    radio2.setAttribute("style", "margin-left:20px;");
    radio2.setAttribute("type", "radio");
    radio2.setAttribute("value", "edge");
    if(userview.upload.edgemode == "edge") { radio2.setAttribute("checked", "checked"); }
    radio2.setAttribute("onchange", "eedbUserReconfigParam('upload-edge-mode', this.value);");
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "edges";

    if(userview.upload.edgemode == "edge") {
      var strict_edge_linking = tdiv.appendChild(document.createElement('input'));  //to right of the above radios
      strict_edge_linking.style.marginLeft = "35px";
      strict_edge_linking.setAttribute("type", "checkbox");
      strict_edge_linking.setAttribute("name", "strict_edge_linking");
      //strict_edge_linking.setAttribute("value", "true");
      strict_edge_linking.setAttribute("onclick", "eedbUserReconfigParam('upload-strict_edge_linking', this.checked);");
      if(userview.upload.strict_edge_linking) { strict_edge_linking.setAttribute("checked", "checked"); }
      tspan = tdiv.appendChild(document.createElement('span'));
      tspan.innerHTML = "strict edge-node linking";
      var msg = "<div style='text-align:left;'>strict linking <b>enabled</b>: if it's unable to finding a matching node for any edgef1/edgef2 lookup, it will cause an upload parsing error and FAIL the upload.<p><b>disabled</b>: failure to find a matching node will cause that edge to be skipped but loading will continue</div>"; 
      strict_edge_linking.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",300);");
      strict_edge_linking.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      tspan.setAttribute("onmouseover", "eedbMessageTooltip(\""+msg+"\",300);");
      tspan.setAttribute("onmouseout", "eedbClearSearchTooltip();");

      
      //-----
      tdiv = edge_options.appendChild(document.createElement('div'));
      tdiv.setAttribute('style', "margin:3px 0px 3px 5px;");
      //tspan = tdiv.appendChild(document.createElement('span'));
      //tspan.setAttribute('style', "margin-right:3px;");
      //tspan.innerHTML = "options for setting the featuresource1 and featuresource2 here";
      
      var tdiv2 = tdiv.appendChild(document.createElement('div'));
      tdiv2.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold;");
      tdiv2.innerHTML ="Edge left-node featuresource:";
      var dsi1 = zenbuDatasourceInterface();
      dsi1.edit_datasource_query = true;
      dsi1.allowChangeDatasourceMode = false;
      dsi1.enableResultFilter = false;
      dsi1.allowMultipleSelect = false;
      dsi1.datasource_mode = "feature";
      dsi1.style.marginLeft = "5px";
      tdiv.appendChild(dsi1);
      userview.upload.dsi1 = dsi1;
      
      var tdiv2 = tdiv.appendChild(document.createElement('div'));
      tdiv2.setAttribute("style", "font-size:12px; font-family:arial,helvetica,sans-serif; font-weight:bold; margin-top:7px;");
      tdiv2.innerHTML ="Edge right-node featuresource:";
      var dsi2 = zenbuDatasourceInterface();
      dsi2.edit_datasource_query = true;
      dsi2.allowChangeDatasourceMode = false;
      dsi2.enableResultFilter = false;
      dsi2.allowMultipleSelect = false;
      dsi2.datasource_mode = "feature";
      dsi2.style.marginLeft = "5px";
      tdiv.appendChild(dsi2);
      userview.upload.dsi2 = dsi2;
      
      //dsi1.source_ids = "D905615F-C6AA-41D5-A0C4-6F4F61705A80::1:::FeatureSource"; //just for testing interface code
      //dsi2.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::17:::FeatureSource";

      dsi1.updateCallOutFunction = eedbUserEdgeDSIUpdate;
      dsi2.updateCallOutFunction = eedbUserEdgeDSIUpdate;
      
      zenbuDatasourceInterfaceUpdate(dsi1.id);
      zenbuDatasourceInterfaceUpdate(dsi2.id);
    }
   
  }
  
}


function eedbUserCloseNewUploadPanel() {
  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }
  var upload_panel = document.getElementById("eedb_user_new_upload_panel");
  if(!upload_panel) { return; }

  main_div.removeChild(upload_panel);
  eedbUserReloadQueueStatus(); //to restart the refresh if needed
}


function eedbUserEdgeDSIUpdate(uniqID, mode) {
  var zenbuDSI = zenbuDatasourceInterface_hash[uniqID];
  if(zenbuDSI == null) { return; }

  console.log("eedbUserEdgeDSIUpdate "+uniqID+" mode:"+mode);

  if(mode=="select_source") {
    var fsrc1_input = document.getElementById("eedb_upload_edge_fsrc1");
    var fsrc2_input = document.getElementById("eedb_upload_edge_fsrc2");

    console.log("new source_ids: " + zenbuDSI.newconfig.source_ids);
    
    if(userview.upload.dsi1.id == zenbuDSI.id) {
      console.log("coming from DSI_1");
      fsrc1_input.value = zenbuDSI.newconfig.source_ids
    }
    if(userview.upload.dsi2.id == zenbuDSI.id) {
      console.log("coming from DSI_2");
      fsrc2_input.value = zenbuDSI.newconfig.source_ids;
    }
    
    
  }
  //zenbuDatasourceInterfaceUpdate(uniqID); //refresh
  //zenbuDatasourceInterfaceToggleSubpanel(uniqID, 'refresh'); //refresh
}

//---------------------------------------------------------------------------
//
// Collaboration group section
//
//---------------------------------------------------------------------------

function eedbCollaborationView() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }

  main_div.setAttribute('style', "margin: 0px 20px 0px 20px; text-decoration:none; font-size:12px;");
  main_div.innerHTML = "";

  var div1, form, label1, input1, text1, button;

  //top controls
  div1 = main_div.appendChild(document.createElement('div'));
  button = div1.appendChild(new Element('button'));
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbNewCollaborationPanel();");
  button.innerHTML ="create new collaborative project";

  div1 = main_div.appendChild(document.createElement('div'));
  div1.id = "eedb_user_collaboration_table_div";
  div1.innerHTML = "loading data...";

  if(!userview.collaborations.loaded) { eedbUserReloadCollaborations("async"); }
  eedbUserShowCollaborations();
}


function eedbNewCollaborationPanel() {
  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }

  var new_collab_panel = document.getElementById("eedb_user_new_collab_panel");
  if(new_collab_panel) { return eedbUserNewUploadPanelRefresh(); }

  new_collab_panel = main_div.appendChild(document.createElement('div'));
  new_collab_panel.id = "eedb_user_new_collab_panel";
  new_collab_panel.setAttribute('style', "position:absolute; background-color:#e0f0ec; text-align:left; "+
                             "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                             "z-index:1; top:180px; width:500px;"+
                             "left:" + ((winW/2)-250) +"px; "
                           );
  new_collab_panel.innerHTML = "";

  // title
  var tdiv = new_collab_panel.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : create new collaborative project";

  // close button
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=collaborations");
  a1.setAttribute("onclick", "eedbUserCloseNewCollaborationPanel();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");


  var div1, form, label1, input1, text1, check1, span1;
  form = new_collab_panel.appendChild(document.createElement('form'));

  /*
  var h3 = new_collab_panel.appendChild(document.createElement('h3'));
  h3.innerHTML = "Welcome to ZENBU : collaboration management ";

  div1 = form.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 20px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "create new collaborative project: ";
  */

  div1 = form.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 0px 0px 15px 0px;");
  /*
  check1 = div1.appendChild(document.createElement('input'));
  check1.setAttribute('style', "margin: 0px 5px 0px 0px;");
  check1.setAttribute('name', "public_announce");
  check1.setAttribute('type', "checkbox");
  check1.id = "eedb_user_newcollaboration_public";
  */
  span1 = div1.appendChild(document.createElement('span'));
  span1.innerHTML = "All collaborations are secured. Only members of the collaboration will be able to see the data shared in the collaboration. The owner of the collaboration will need to manage the membership (add/delete members) for the collaboration";
 //  "is publicly announced to all users. Each user request must still be approved by collaboration owner. If not checked, the collaboration name is hidden and collaboration owner must send invitations to users.";

  div1 = form.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "Collaboration name: ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id = "eedb_user_newcollaboration_displayname";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "display_name");
  input1.setAttribute("size", "50");

  div1 = form.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 5px 0px 5px 0px;");
  div1.innerHTML="please enter description of collaboration group";

  div1 = form.appendChild(document.createElement('div'));
  text1 = div1.appendChild(document.createElement('textarea'));
  text1.id = "eedb_user_newcollaboration_description";
  text1.setAttribute("cols", "60");
  text1.setAttribute("rows", "6");
  text1.setAttribute("name", "description");

  div1 = form.appendChild(document.createElement('div'));
  var button1 = div1.appendChild(document.createElement('input'));
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "create new collaborative project");
  button1.setAttribute("onclick", "eedbUserSubmitNewCollaboration();");

}

function eedbUserCloseNewCollaborationPanel() {
  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }
  var new_collab_panel = document.getElementById("eedb_user_new_collab_panel");
  if(!new_collab_panel) { return; }

  main_div.removeChild(new_collab_panel);
}



function eedbUserSubmitNewCollaboration() {
  var name_input    = document.getElementById("eedb_user_newcollaboration_displayname");
  var desc_text     = document.getElementById("eedb_user_newcollaboration_description");
  var public_check  = document.getElementById("eedb_user_newcollaboration_public");

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>create_group</mode>\n";
  //if(public_check && public_check.checked) {
  //  paramXML += "<public_announce>true</public_announce>";
  //}
  if(name_input && name_input.value) {
    paramXML += "<display_name>"+ name_input.value +"</display_name>";
  }
  if(desc_text && desc_text.value) {
    paramXML += "<description>"+ desc_text.value +"</description>";
  }
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  var alt_div = document.getElementById("eedb_user_altdiv");
  if(alt_div) { alt_div.innerHTML = ""; }

  eedbUserReloadCollaborations("async"); //reload full list
  eedbCollaborationView();
}

//----------

function eedbUserFullLoadCollaborations() {
  if(userview.collaborations.loading) {
    console.log("eedbUserFullLoadCollaborations : other loading async, just wait...");
    return;
  }
  if(userview.collaborations.full_loading) {
    console.log("eedbUserFullLoadCollaborations : already full_load started, just wait...");
    return;
  }
  var need_full_loading = 0;
  var last_fullload_uuid = "";
  for (var uuid in userview.collaborations.uuid_hash) {
    var collaboration = userview.collaborations.uuid_hash[uuid];
    if(!collaboration) { continue; }
    if(collaboration.full_load) { continue; }
    //console.log("found collaboration for full_load: "+collaboration.name);
    need_full_loading++;
    last_fullload_uuid = collaboration.uuid;
  }
  if(need_full_loading==0) {
    console.log("eedbUserFullLoadCollaborations : all collaborations full_loaded");
    return;
  }
  if(need_full_loading==1) {
    eedbUserReloadCollaborations("async", last_fullload_uuid);
    return;
  }

  console.log("eedbUserFullLoadCollaborations");

  var paramXML = "<zenbu_query><mode>collaborations</mode>";
  paramXML += "<format>xml</format>"; //full_load
  paramXML += "</zenbu_query>";
  userview.collaborations.full_loading = true;

  eedbUserXMLHttp3.onreadystatechange=eedbUserPrepareCollaborations;
  eedbUserXMLHttp3.open("POST", eedbUserCGI, true); //async
  eedbUserXMLHttp3.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  eedbUserXMLHttp3.send(paramXML);
}


function eedbUserReloadCollaborations(async, collab_uuid) {
  if(async=="async") { async=true; } else { async=false;}
  if(async && userview.collaborations.loading) {
    console.log("eedbUserReloadCollaborations already loading async, just wait...");
    return;
  }
  console.log("eedbUserReloadCollaborations");

  userview.filters.platform = "";

  var collaborations = userview.collaborations;

  if(async) { collaborations.loading = true; }
 
  var paramXML = "<zenbu_query><mode>collaborations</mode>";
  if(collab_uuid) { 
    paramXML += "<format>xml</format>"; //full_load
    paramXML += "<collaboration_uuid>"+collab_uuid+"</collaboration_uuid>";
    userview.collaborations.full_loading = true;
  } else { 
    paramXML += "<format>descxml</format>";
    paramXML += "<submode>member</submode>";
    if(userview.filters.search != "") {
      paramXML += "<filter>"; 
      paramXML += " "+userview.filters.search;
      paramXML += "</filter>"; 
    }
    userview.collaborations.full_loading = false;

    //TODO: might need some logic for removing collaborations from hash now that I don't clear and reload.
    //but not sure how often this would arise without the user wanting to reload the page
    //but here is an idea.
    //reload of full list so set invalid flag existing collaborations, return will revalidate
    for (var uuid in userview.collaborations.uuid_hash) {
      var collaboration = userview.collaborations.uuid_hash[uuid];
      if(!collaboration) { continue; }
      //collaboration.is_valid = false;
    }
  }
  paramXML += "</zenbu_query>";

  //var xhr=GetXmlHttpObject();
  //xhr.open("POST", eedbUserCGI, false); //not async
  //xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  //xhr.send(paramXML);

  eedbUserXMLHttp3.onreadystatechange=eedbUserPrepareCollaborations;
  if(async) {
    eedbUserXMLHttp3.open("POST", eedbUserCGI, true); //async
  } else {
    eedbUserXMLHttp3.open("POST", eedbUserCGI, false); //synchronous
  }
  eedbUserXMLHttp3.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  eedbUserXMLHttp3.send(paramXML);
}


function eedbUserPrepareCollaborations() {
  if(eedbUserXMLHttp3 == null) { return; }
  if(eedbUserXMLHttp3.responseXML == null) return;
  if(eedbUserXMLHttp3.readyState!=4) return;
  if(eedbUserXMLHttp3.status!=200) { return; }
  var xmlDoc=eedbUserXMLHttp3.responseXML.documentElement;

  if(xmlDoc==null) { return; }

  //if(xhr.responseXML == null) return;
  //if(xhr.readyState!=4) return;
  //if(xhr.status!=200) { return; }
  //var xmlDoc=xhr.responseXML.documentElement;
  //if(xmlDoc==null) { return; } 
 
  var collaborations = userview.collaborations;
  collaborations.total_count=0;
  collaborations.like_count=0;
  collaborations.filtered_count=0;
  collaborations.loading = false;

  var xmlCollaborations = xmlDoc.getElementsByTagName("collaboration");
  for(i=0; i<xmlCollaborations.length; i++) {
    var xmlCollaboration = xmlCollaborations[i];
    if(!xmlCollaboration) { continue; }

    var collab_uuid = xmlCollaboration.getAttribute("uuid");
    var collaboration = userview.collaborations.uuid_hash[collab_uuid];

    collaboration = eedbParseCollaborationData(xmlCollaboration, collaboration);
    userview.collaborations.uuid_hash[collaboration.uuid] = collaboration;
    if(userview.collaborations.full_loading) { collaboration.full_load = true; }
    if(collaboration.shared_peers.total_count > 0) { collaboration.full_load = true; }
    collaboration.is_valid = true;
  }
  //document.getElementById("message").innerHTML = "finished loading collaborations";

  collaborations.total_count = xmlCollaborations.length;
  collaborations.filtered_count = xmlCollaborations.length;
  collaborations.loaded = true;
  userview.collaborations.full_loading = false;

  //eedbUserShowCollaborations();
  //if(userview.mode == "profile") { return eedbUserProfilePanel(); }
  if(userview.mode == "uploads") { return eedbUserShowUploads(); }
  //if(userview.mode == "downloads") { return eedbUserDownloadsView(); }
  if(userview.mode == "collaborations") { return eedbUserShowCollaborations(); }
  //if(userview.mode == "validate") { return eedbUserProfilePanel(); }
}


function eedbUserFilteredCollaborationArray() {
  var array1 = new Array;
  for (var uuid in userview.collaborations.uuid_hash) {
    var collaboration = userview.collaborations.uuid_hash[uuid];
    if(!collaboration) { continue; }
    if(!collaboration.is_valid) { continue; }
    //maybe do additionl filtering here
    array1.push(collaboration);
  }
  return array1;
}


function eedbUserShowCollaborations() {
  var main_div = document.getElementById("eedb_user_collaboration_table_div");
  if(!main_div) { return; }

  main_div.innerHTML = "";

  if(userview.collaborations.loading) {
    main_div.innerHTML = "loading collaborations...";
    return;
  }

  var collaboration_array = eedbUserFilteredCollaborationArray();
  if(!collaboration_array) { return; }
  collaboration_array.sort(eedbUser_collaboration_sort_func);

  var need_full_load = false;

  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.setAttribute("style", "white-space: nowrap");
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('owner'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('shared dbs'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('members'));

  var num_pages = Math.ceil(collaboration_array.length / userview.page_size);
  userview.uploads.filter_count = collaboration_array.length;
  userview.num_pages = num_pages;

  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<userview.page_size; j++) {
    var i = j+ userview.current_view_index;
    if(i>=collaboration_array.length) { break; }

    var collaboration = collaboration_array[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    tr.appendChild(new Element('td').update(i+1));  //row
    tr.appendChild(new Element('td').update(encodehtml(collaboration.name)));
    tr.appendChild(new Element('td').update(encodehtml(collaboration.description)));

    //owner
    var td = tr.appendChild(new Element('td'));
    var tdiv = td.appendChild(new Element('div'));
    tdiv.innerHTML = collaboration.owner_nickname; 
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = collaboration.owner_identity; 

    //shared dbs
    var td = tr.appendChild(new Element('td'));
    if(collaboration.shared_peers.total_count) {
      td.innerHTML = collaboration.shared_peers.total_count;
    } else if(!collaboration.full_load) {
      td.setAttribute('style', "color:darkgray;");
      td.innerHTML = "loading...";
      need_full_load = true;
    } else {
      td.innerHTML = "-";
    }

    //member management
    var td = tr.appendChild(new Element('td'));
    td.setAttribute("style", "white-space: nowrap");
    var member_info_span = td.appendChild(new Element('span'));
    member_info_span.setAttribute("style", "padding: 3px 3px;");

    if(collaboration.uuid == "public") { 
      member_info_span.innerHTML = "everyone"; 
    } else if(collaboration.member_status == "INVITED") {
      member_info_span.innerHTML = "pending invitation";
    } else if((collaboration.member_count==0) || (collaboration.member_status == "not_member") || (collaboration.member_status == "REQUEST")) {
      member_info_span.innerHTML = "-";
    } else {
      var a1 = member_info_span.appendChild(document.createElement('a'));
      a1.setAttribute("target", "top");
      a1.setAttribute("href", "./");
      a1.setAttribute("onclick", "eedbUserCollaborationUsersInfo(\"" +collaboration.uuid+ "\"); return false;");
      a1.innerHTML = collaboration.member_count;
      //if(collaboration.member_status == "OWNER") {
      //  var span2 = member_info_span.appendChild(new Element('span'));
      //  span2.innerHTML = "owner";
      //}
    }

    var span2 = td.appendChild(new Element('span'));
    if(collaboration.member_status == "not_member") {
      //public announce collaboration
      /*
      var button = span2.appendChild(new Element('button'));
      button.setAttribute("type", "button");
      button.setAttribute("onclick", "eedbUserRequestJoinCollaboration(\""+ collaboration.uuid + "\");");
      button.innerHTML ="request to join";

      var button = span2.appendChild(new Element('button'));
      button.setAttribute("type", "button");
      button.setAttribute("onclick", "eedbUserIgnoreCollaboration(\""+ collaboration.uuid + "\");");
      button.innerHTML ="ignore";
      */
    } else if(collaboration.member_status == "REQUEST") {
      span2.innerHTML = "request pending approval";
    } else if((collaboration.member_status == "OWNER") || (collaboration.member_status == "ADMIN")) {
      var button = span2.appendChild(new Element('button'));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; margin-right:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "zenbuCollaborationUserManagementPanel(\""+ collaboration.uuid + "\");");
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"add and remove users from collaboration\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "manage users";

      if(collaboration.open_to_public == "y") { 
        var div3 = span2.appendChild(new Element('div'));
        div3.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; color:#4169E1;"); //color:#4169E1 color:#B22222
        div3.innerHTML = "open to public";
      }
      //if(collaboration.pending_requests.length>0) { 
      //  var div3 = span2.appendChild(new Element('div'));
      //  div3.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; color:#4169E1;");
      //  div3.innerHTML = "pending requests" ;
      //}
    } else if(collaboration.member_status == "INVITED") {
      var button = span2.appendChild(new Element('button'));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "eedbUserAceptInvitation(\""+ collaboration.uuid + "\");");
      button.innerHTML ="accept invitation";

      var button = span2.appendChild(new Element('button'));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "eedbUserIgnoreCollaboration(\""+ collaboration.uuid + "\");");
      button.innerHTML ="ignore";
    }

  }

  if(collaboration_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update(0));
    tr.appendChild(new Element('td').update("no collaborations available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }

  main_div.appendChild(div1);

  var div2 = main_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = collaboration_array.length + " filtered ";
  msg += userview.collaborations.total_count + " total system collaborations";
  span1.innerHTML = msg;

  var pagingSpan = eedbUserPagingInterface();
  div2.appendChild(pagingSpan);

  if(userview.active_collaboration_user_manager) {
    zenbuCollaborationUserManagementPanel(userview.active_collaboration_user_manager, false);
    userview.active_collaboration_user_manager = undefined;
  }
 
  if(need_full_load) { eedbUserFullLoadCollaborations(); }
}


function eedbUser_collaboration_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.uuid == "curated") { return -1; }
  if(b.uuid == "curated") { return 1; }
  if(a.uuid == "public") { return -1; }
  if(b.uuid == "public") { return 1; }

  var a_status = a.member_status;
  var b_status = b.member_status;
  if(a_status=="ADMIN") { a_status = "OWNER"; }
  if(b_status=="ADMIN") { b_status = "OWNER"; }

  if(a_status != b_status) {
    if(a_status == "OWNER") { return -1; }
    if(b_status == "OWNER") { return 1; }
    if(a_status == "MEMBER") { return -1; }
    if(b_status == "MEMBER") { return 1; }
    if(a_status == "REQUEST") { return -1; }
    if(b_status == "REQUEST") { return 1; }
  }
  //if(a.public_announce != b.public_announce) { 
  //  if(a.public_announce == "y") { return 1; }
  //  if(b.public_announce == "y") { return -1; }
  //}

  if(a.name < b.name) { return -1; }
  if(a.name > b.name) { return 1; }

  return 0;
}


//Request join/ignore/accept is old system and deprecated but keeping code here
function eedbUserRequestJoinCollaboration(uuid) {
  if(!uuid) { return; }
  var url = eedbUserCGI+"?mode=request_join_collaboration;collaboration_uuid="+uuid;

  var singleFeatureSourceXMLHttp=GetXmlHttpObject();
  singleFeatureSourceXMLHttp.open("GET", url, false);
  singleFeatureSourceXMLHttp.send(null);
  //no need to parse response at this time

  eedbUserReloadCollaborations("sync", uuid);
  eedbUserShowCollaborations();
  return;
}


function eedbUserIgnoreCollaboration(uuid) {
  if(!uuid) { return; }
  var url = eedbUserCGI+"?mode=ignore_collaboration;collaboration_uuid="+uuid;

  var xhr=GetXmlHttpObject();
  xhr.open("GET", url, false);
  xhr.send(null);
  //no need to parse response at this time

  eedbUserReloadCollaborations("sync", uuid);
  eedbUserShowCollaborations();
  return;
}

function eedbUserAceptInvitation(uuid) {
  if(!uuid) { return; }
  var url = eedbUserCGI+"?mode=accept_invitation;collaboration_uuid="+uuid;

  var xhr=GetXmlHttpObject();
  xhr.open("GET", url, false);
  xhr.send(null);
  //no need to parse response at this time

  eedbUserReloadCollaborations("sync", uuid);
  eedbUserShowCollaborations();
  return;
}


/*
function eedbUserProcessCollaborationRequests(uuid) {
  eedbUserShowCollaborations();
  if(!uuid) { return; }

  var collaboration;
  var collaboration_array = eedbUserFilteredCollaborationArray();
  for(var j=0; j<collaboration_array.length; j++) {
    collaboration = collaboration_array[j]
    if(collaboration.uuid == uuid) { break; }
  }
  if(collaboration.uuid != uuid) { return; }
  if(collaboration.member_status != "OWNER") { return; }

  if(collaboration.pending_requests.length == 0) { return; }

  var main_div = document.getElementById("eedb_user_collaboration_table_div");
  if(!main_div) { return; }

  var e = window.event
  toolTipWidth=600;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.adjusted_xpos;
  var ypos = toolTipSTYLE.ypos;

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);
  divFrame.setAttribute('style', "background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                            +"z-index:1; "
                            //+"left:" + ((winW/2)-300) +"px; top:200px; "
                            +"position:absolute; left:"+(xpos)+"px; top:"+(ypos-30)+"px;"
                            +"width:600px;"
                             );
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Manage user requests for collaboration : "; 
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  tspan.innerHTML = collaboration.name;

  //
  // now display as table
  //
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  divFrame.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('nickname'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('OpenID'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('action'));

  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<collaboration.pending_requests.length; i++) {
    var user = collaboration.pending_requests[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') }
    else { tr.addClassName('even') }

    tr.appendChild(new Element('td').update(i+1));  //row
    tr.appendChild(new Element('td').update(encodehtml(user.nickname)));
    tr.appendChild(new Element('td').update(encodehtml(user.openID)));

    var td = tr.appendChild(new Element('td'));
    var div2 = td.appendChild(new Element('div'));
    var button = div2.appendChild(new Element('button'));
    button.setAttribute("type", "button");
    button.setAttribute("onclick", "eedbUserAcceptRequest(\""+ collaboration.uuid +"\", \""+ user.openID+"\");");
    button.innerHTML ="accept";
    var div2 = td.appendChild(new Element('div'));
    var button = div2.appendChild(new Element('button'));
    button.setAttribute("type", "button");
    button.setAttribute("onclick", "eedbUserRejectRequest(\""+ collaboration.uuid +"\", \""+ user.openID+"\");");
    button.innerHTML ="reject";
  }
}
*/


function eedbUserAcceptRequest(uuid, user_ident) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>accept_request</mode>\n";
  paramXML += "<collaboration_uuid>"+uuid+"</collaboration_uuid>";
  paramXML += "<user_identity>"+user_ident+"</user_identity>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  zenbuCollaborationUserManagementPanel(uuid, true);
}


function eedbUserRejectRequest(uuid, user_ident) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>reject_request</mode>\n";
  paramXML += "<collaboration_uuid>"+uuid+"</collaboration_uuid>";
  paramXML += "<user_identity>"+user_ident+"</user_identity>";
  paramXML += "</zenbu_query>\n";
  
  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  zenbuCollaborationUserManagementPanel(uuid, true);
}


function zenbuCollaborationRemoveUser(uuid, user_ident) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>collaboration_remove_user</mode>\n";
  paramXML += "<collaboration_uuid>"+uuid+"</collaboration_uuid>";
  paramXML += "<user_identity>"+user_ident+"</user_identity>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  zenbuCollaborationUserManagementPanel(uuid, true);
}


function zenbuCollaborationMakeAdminUser(uuid, user_ident) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>collaboration_make_admin_user</mode>\n";
  paramXML += "<collaboration_uuid>"+uuid+"</collaboration_uuid>";
  paramXML += "<user_identity>"+user_ident+"</user_identity>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  zenbuCollaborationUserManagementPanel(uuid, true);
}


function zenbuCollaborationRevokeAdminUser(uuid, user_ident) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>collaboration_revoke_admin_user</mode>\n";
  paramXML += "<collaboration_uuid>"+uuid+"</collaboration_uuid>";
  paramXML += "<user_identity>"+user_ident+"</user_identity>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  zenbuCollaborationUserManagementPanel(uuid, true);
}


function zenbuCollaborationInviteUser(uuid) {
  var openid_input = document.getElementById("eedbUser_invitation_input");
  if(!openid_input) { return; }
  var user_ident = openid_input.value;
  if(!user_ident) { return; }

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>invite_user</mode>\n";
  paramXML += "<collaboration_uuid>"+uuid+"</collaboration_uuid>";
  paramXML += "<user_identity>"+user_ident+"</user_identity>";
  paramXML += "</zenbu_query>\n";
  
  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  zenbuCollaborationUserManagementPanel(uuid, true);
}



//---------------------------------------------------------------------------


function zenbuCollaborationUserManagementPanel(uuid, reload) {
  var collaboration;
  var collaboration_array = eedbUserFilteredCollaborationArray();
  for(var j=0; j<collaboration_array.length; j++) {
    collaboration = collaboration_array[j]
    if(collaboration.uuid == uuid) { break; }
  }
  if(!collaboration || (collaboration.uuid != uuid) || (collaboration.member_status != "OWNER" && collaboration.member_status != "ADMIN")) { 
    var msg = "Collaboration ["+uuid+"] not found or you do not have security access to manage it.";
    zenbuGeneralWarn(msg);
    return;
  }

  var main_div = document.getElementById("eedb_user_collaboration_table_div");
  if(!main_div) { return; }

  var e = window.event
  moveToMouseLoc(e);
  var ypos = toolTipSTYLE.ypos-35;
  if(ypos < 100) { ypos = 100; }
  ypos=150;

  var divFrame = document.getElementById("zenbu_collaboration_management_panel");
  if(!divFrame) {
    divFrame = document.createElement('div');
    divFrame.id = "zenbu_collaboration_management_panel";
    main_div.appendChild(divFrame);
    divFrame.setAttribute('style', "background-color:#c0c0cc; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                            +"z-index:1; "
                            +"position:absolute; left:"+ ((winW/2)-200) +"px; top:"+ypos+"px;"
                            +"width:700px;"
                             );
  }
  divFrame.innerHTML = ""; //clear
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Manage users for collaboration : "; 
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  tspan.innerHTML = collaboration.name;

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserShowCollaborations();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  //if(collaboration.open_to_public == "y") { 
  //  var div1 = tdiv.appendChild(new Element('div'));
  //  div1.setAttribute('style', "margin: 0px 10px 0px 10px; color:#B22222; font-size:10px; float:right;");
  //  div1.innerHTML = "open to public";
  //}

  // --------

  var div1 = divFrame.appendChild(new Element('div'));
  div1.setAttribute('style', "margin: 10px 0px 0px 0px; font-size:10px;");
  div1.innerHTML = "add new users to collaboration. If user is not in system, ZENBU will send email inviting them to create an account";
  var div1 = divFrame.appendChild(new Element('div'));
  div1.setAttribute('style', "margin: 0px 0px 10px 0px;");
  var label1 = div1.appendChild(document.createElement('label'));
  label1.innerHTML = "user's email address ";

  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "eedbUser_invitation_input";
  input1.setAttribute("type", "text");
  input1.setAttribute("size", "50");

  var button = div1.appendChild(new Element('input'));
  button.type = "button";
  button.className = "medbutton";
  button.setAttribute("onclick", "zenbuCollaborationInviteUser(\""+ collaboration.uuid +"\");");
  button.value ="add/invite";

  if(collaboration.open_to_public == "y") { 
    var div2 = div1.appendChild(new Element('div'));
    div2.setAttribute('style', "margin: 0px 10px 0px 10px; color:#B22222; font-size:10px;");
    div2.innerHTML = "published collaboration: open to public";
  } else {
    //var div2 = div1.appendChild(new Element('div'));
    //div2.setAttribute('style', "margin: 0px 10px 0px 10px; color:#B22222; font-size:10px;");
    //var button = div2.appendChild(new Element('input'));
    //button.type = "button";
    //button.className = "slimbutton";
    //button.setAttribute("onclick", "zenbuCollaborationInviteUser(\""+ collaboration.uuid +"\");");
    //button.value ="publish collaboration : open all data and views to public";
  }

  // --------
  divFrame.appendChild(new Element('hr'));

  if(reload) {
    var div1 = divFrame.appendChild(new Element('div'));
    div1.setAttribute('style', "margin: 0px 0px 0px 20px; color:#B22222; font-size:10px;");
    div1.innerHTML = "loading.........";
    userview.active_collaboration_user_manager = uuid;
    eedbUserReloadCollaborations("async", uuid);
    return;
  }


  // now display as table
  var scrolldiv = divFrame.appendChild(document.createElement('div'));
  scrolldiv.setAttribute("style", "max-height:350px; width:100%;border:1px; margin-bottom:5px; overflow:auto;");

  var my_table = scrolldiv.appendChild(new Element('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('nickname'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('email'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('status'));
  trhead.appendChild(new Element('th', { 'class': 'listView', "width":"30px" }).update('action'));

  var tbody = my_table.appendChild(new Element('tbody'));
  var row=1;

  //first the members

  for(i=0; i<collaboration.members.length; i++) {
    var user = collaboration.members[i];
    var user_ident = user.email;
    if(!user_ident) { user_ident = user.openid_array[0]; }

    var tr = tbody.appendChild(new Element('tr'));
    if(row%2 == 0) { tr.addClassName('odd') }
    else { tr.addClassName('even') }

    tr.appendChild(new Element('td').update(row));  //row
    tr.appendChild(new Element('td').update(encodehtml(user.nickname)));
    var td = tr.appendChild(new Element('td').update(encodehtml(user.email)));
    if(userview.user.email == user.email) { td.setAttribute("style", "color:#25258e; font-weight:bold;"); }

    if(user.email == collaboration.owner_identity) {
      tr.appendChild(new Element('td').update("owner"));
      tr.appendChild(new Element('td').update("-"));
    } else {
      td = tr.appendChild(new Element('td'));
      td = td.update(user.member_status.toLowerCase());
      if(user.member_status == "ADMIN") {
        td.setAttribute("style", "color:#e65c00;");
        var td = tr.appendChild(new Element('td'));
        td.setAttribute("style", "white-space:nowrap");
        var div2 = td.appendChild(new Element('div'));
        var button = div2.appendChild(new Element('button'));
        button.setAttribute("style", "font-size:10px; color:#ff6600; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
        button.setAttribute("onclick", "zenbuCollaborationRevokeAdminUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
        button.innerHTML ="revoke admin";
      } else {
        var td = tr.appendChild(new Element('td'));
        td.setAttribute("style", "white-space:nowrap");
        var div2 = td.appendChild(new Element('div'));
        var button = div2.appendChild(new Element('button'));
        button.setAttribute("style", "font-size:10px; color:#B22222; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
        button.setAttribute("onclick", "zenbuCollaborationRemoveUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
        button.innerHTML ="remove user";
        var button = div2.appendChild(new Element('button'));
        button.setAttribute("style", "font-size:10px; color:#B22222; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
        button.setAttribute("onclick", "zenbuCollaborationMakeAdminUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
        button.innerHTML ="make admin";
      }
    }
    row++;
  }

  //then the pending invitations
  for(i=0; i<collaboration.pending_invites.length; i++) {
    var user = collaboration.pending_invites[i];
    var user_ident = user.email;
    if(!user_ident) { user_ident = user.openid_array[0]; }

    var tr = tbody.appendChild(new Element('tr'));
    if(row%2 == 0) { tr.addClassName('odd') }
    else { tr.addClassName('even') }
    tr.setAttribute("style", "color:#B22222;");

    tr.appendChild(new Element('td').update(row));  //row
    tr.appendChild(new Element('td').update(encodehtml(user.nickname)));
    tr.appendChild(new Element('td').update(encodehtml(user.email)));
    tr.appendChild(new Element('td').update("invitation pending"));

    //tr.appendChild(new Element('td').update("-"));
    var td = tr.appendChild(new Element('td'));
    var div2 = td.appendChild(new Element('div'));
    var button = div2.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "zenbuCollaborationRemoveUser(\""+ collaboration.uuid +"\", \""+ user_ident+"\");");
    button.innerHTML ="cancel invite";
    row++;
  }

  //then the pending incoming requests
  for(i=0; i<collaboration.pending_requests.length; i++) {
    var user = collaboration.pending_requests[i];

    var tr = tbody.appendChild(new Element('tr'));
    tr.setAttribute("style", "white-space: nowrap");

    if(row%2 == 0) { tr.addClassName('odd') }
    else { tr.addClassName('even') }
    tr.setAttribute("style", "color:#4169E1;");

    tr.appendChild(new Element('td').update(row));  //row
    tr.appendChild(new Element('td').update(encodehtml(user.nickname)));
    tr.appendChild(new Element('td').update(encodehtml(user.email)));
    tr.appendChild(new Element('td').update("join request"));

    var td = tr.appendChild(new Element('td'));
    var div2 = td.appendChild(new Element('div'));
    var button = div2.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "eedbUserAcceptRequest(\""+ collaboration.uuid +"\", \""+ user.email+"\");");
    button.innerHTML ="accept";
    var button = div2.appendChild(new Element('button'));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("onclick", "eedbUserRejectRequest(\""+ collaboration.uuid +"\", \""+ user.email+"\");");
    button.innerHTML ="reject";
    row++;
  }

 
}



//---------------------------------------------------------------------------
//
// FeatureSource section
//
//---------------------------------------------------------------------------

function eedbUserReloadMySourceData() {
  if(userview.mode != "uploads") { return; }

  //also query the queuing system
  eedbUserReloadQueueStatus();

  eedbUserFullLoadCollaborations();
  //eedbUserReloadCollaborations("async"); //async //TODO: need new logic for sharing

  userview.filters.platform = "";

  var uploads = userview.uploads;

  uploads.peer_hash = new Object();
  uploads.platforms = new Object;
  uploads.loading = true;

  //userview.current_view_index = 0;

  var paramXML = "<zenbu_query><mode>sources</mode><format>descxml</format>";
  paramXML += "<collab>" + current_collaboration.uuid + "</collab>";
  if(userview.filters.search != "") {
    paramXML += "<filter>";
    paramXML += " "+userview.filters.search;
    paramXML += "</filter>";
  }
  paramXML += "</zenbu_query>";

  eedbUserXMLHttp.onreadystatechange=eedbUserPrepareMySourceData;
  //eedbUserXMLHttp.open("POST", eedbSearchFCGI, true); 
  eedbUserXMLHttp.open("POST", eedbSearchCGI, true); //async and not the fcgi
  eedbUserXMLHttp.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //eedbUserXMLHttp.setRequestHeader("Content-length", paramXML.length);
  //eedbUserXMLHttp.setRequestHeader("Connection", "close");
  eedbUserXMLHttp.send(paramXML);
}


function eedbUserPrepareMySourceData() {
  if(eedbUserXMLHttp == null) { return; }
  if(eedbUserXMLHttp.responseXML == null) return;
  if(eedbUserXMLHttp.readyState!=4) return;
  if(eedbUserXMLHttp.status!=200) { return; }
  var xmlDoc=eedbUserXMLHttp.responseXML.documentElement;

  if(xmlDoc==null) { return; } 
 
  var uploads = userview.uploads;

  if(xmlDoc.getElementsByTagName("result_count").length>0) {
    uploads.total_count     = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("total") -0;
    uploads.like_count      = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("like_count") -0;
    uploads.filtered_count  = xmlDoc.getElementsByTagName("result_count")[0].getAttribute("filtered") -0;
  }


  var xmlPeers = new Array();
  var xmlFeatureSources = new Array();
  var xmlExperiments = new Array();
  var xmlEdgeSources = new Array();
  var xmlAssemblies = new Array();

  var sources_children = xmlDoc.childNodes;
  console.log("found sources block. has "+sources_children.length+" children");
  for (var i = 0; i < sources_children.length; i++) {
    var sourceDOM = sources_children[i];
    if(sourceDOM.tagName == "peer")          { xmlPeers.push(sourceDOM); }
    if(sourceDOM.tagName == "featuresource") { xmlFeatureSources.push(sourceDOM);  }
    if(sourceDOM.tagName == "experiment")    { xmlExperiments.push(sourceDOM); }
    if(sourceDOM.tagName == "edgesource")    { xmlEdgeSources.push(sourceDOM); }
    if(sourceDOM.tagName == "assembly")      { xmlAssemblies.push(sourceDOM); }
  }
  console.log("sources children peer:"+(xmlPeers.length)+"  fsrc:"+xmlFeatureSources.length+"  exp:"+xmlExperiments.length+"  esrc:"+xmlEdgeSources.length+" asm:"+xmlAssemblies.length);

  //peers
  //var xmlPeers = xmlDoc.getElementsByTagName("peer");
  for(i=0; i<xmlPeers.length; i++) {
    var peer = eedbParsePeerData(xmlPeers[i]);
    if(!uploads.peer_hash[peer.uuid]) {
      peer.name = peer.uuid;
      peer.featuresource_count = 0;
      peer.edgesource_count = 0;
      peer.experiment_count = 0;
      peer.assembly_count = 0;
      peer.source_hash = new Object();
      uploads.peer_hash[peer.uuid] = peer;
    }
  }

  //feature sources
  //var xmlFeatureSources = xmlDoc.getElementsByTagName("featuresource");
  for(i=0; i<xmlFeatureSources.length; i++) {
    var xmlFeatureSource = xmlFeatureSources[i];

    var category = xmlFeatureSource.getAttribute("category");
    if((category == "config") || (category == "userprofile")) { continue; }

    var srcid = xmlFeatureSource.getAttribute("id");
    var idx1 = srcid.indexOf("::");
    if(idx1 == -1) { continue; }
    var uuid = srcid.substring(0,idx1);
    var peer = uploads.peer_hash[uuid];
    if(!peer) {
      peer = new Object;
      peer.uuid = uuid;
      peer.name = uuid;
      peer.featuresource_count = 0;
      peer.experiment_count = 0;
      peer.assembly_count = 0;
      uploads.peer_hash[uuid] = peer;
      peer.source_hash = new Object();
    }
    peer.featuresource_count++;

    var featuresource = uploads.source_hash[srcid];
    if(!featuresource) {
      featuresource = new Object;
      featuresource.id = srcid;
      uploads.source_hash[srcid] = featuresource;
    }
    eedbParseFeatureSourceData(xmlFeatureSource, featuresource);
    peer.source_hash[srcid] = featuresource;

    if(!peer.primary_source) { peer.primary_source = featuresource; }
    if(peer.primary_source.objID > featuresource.objID) { peer.primary_source = featuresource; }
  }

  //edge sources
  //var xmlEdgeSources = xmlDoc.getElementsByTagName("edgesource");
  for(var i=0; i<xmlEdgeSources.length; i++) {
    var sourceDOM  = xmlEdgeSources[i];
    var srcid   = sourceDOM.getAttribute("id");
    //console.log("edgesource id["+srcid+"]");

    var idx1 = srcid.indexOf("::");
    if(idx1 == -1) { continue; }
    var uuid = srcid.substring(0,idx1);
    //console.log("edgesource uuid["+uuid+"]");
    var peer = uploads.peer_hash[uuid];
    if(!peer) {  continue; }
    //console.log("have peer ["+peer.uuid+"]  ["+peer.db_url+"]");
    peer.edgesource_count++;

    var source = uploads.source_hash[srcid];
    //if(source) { console.log("reparse source ["+srcid+"]"); } else { console.log("new source ["+srcid+"] to parse"); }
    source = eedbParseEdgeSourceXML(sourceDOM, source);
    peer.source_hash[source.id] = source;
    if(!peer.primary_source) { peer.primary_source = source; }
    if(peer.primary_source.objID > source.objID) { peer.primary_source = source; }
  }

  //experiments
  //var xmlExperiments = xmlDoc.getElementsByTagName("experiment");
  for(i=0; i<xmlExperiments.length; i++) {
    var xmlExperiment = xmlExperiments[i];

    var srcid = xmlExperiment.getAttribute("id");
    var idx1 = srcid.indexOf("::");
    if(idx1 == -1) { continue; }
    var uuid = srcid.substring(0,idx1);
    var peer = uploads.peer_hash[uuid];
    if(!peer) { continue; }
    peer.experiment_count++;

    var experiment = uploads.source_hash[srcid];
    if(!experiment) {
      experiment = new Object;
      experiment.id = srcid;
      uploads.source_hash[srcid] = experiment;
    }
    eedbParseExperimentData(xmlExperiment, experiment);
    peer.source_hash[srcid] = experiment;

    if(!peer.primary_source) { peer.primary_source = experiment; }
    if(peer.primary_source.objID > experiment.objID) { peer.primary_source = experiment; }
  }

  //assembly
  //var xmlAssemblies = xmlDoc.getElementsByTagName("assembly");
  for(i=0; i<xmlAssemblies.length; i++) {
    var assembly = eedbParseAssemblyData(xmlAssemblies[i]);

    var peer = uploads.peer_hash[assembly.uuid];
    if(!peer) { continue; }
    peer.assembly_count++;

    uploads.source_hash[assembly.id] = assembly;
    peer.source_hash[assembly.id] = assembly;
    if(!peer.primary_source) { peer.primary_source = assembly; }
  }

  uploads.loading = false;

  if(userview.mode == "uploads") { return eedbUserShowUploads(); }
}


function eedbUserClearFailedJobs() {
  var url = eedbUploadCGI + "?mode=clear_failed_jobs";
  var clearFailsXMLHttp=GetXmlHttpObject();
  clearFailsXMLHttp.open("GET", url, false);
  clearFailsXMLHttp.send(null);

  eedbUserReloadQueueStatus();
}


function eedbUserReloadQueueStatus() {
  var paramXML = "<zenbu_query><mode>queuestatus</mode></zenbu_query>\n";

  eedbUserXMLHttp2.open("POST", eedbUploadCGI, false);  //run async in background
  eedbUserXMLHttp2.onreadystatechange=eedbUserPrepareQueueStatus;
  eedbUserXMLHttp2.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  eedbUserXMLHttp2.send(paramXML);
}


function eedbUserPrepareQueueStatus() {
  if(eedbUserXMLHttp2 == null) { return; }
  if(eedbUserXMLHttp2.responseXML == null) return;
  if(eedbUserXMLHttp2.readyState!=4) return;
  if(eedbUserXMLHttp2.status!=200) { return; }
  var xmlDoc=eedbUserXMLHttp2.responseXML.documentElement;

  if(xmlDoc==null) { return; } 
 
  var uploads = userview.uploads;
  uploads.queue_array = new Array();

  //jobs
  var refresh = false;
  var xmlJobs = xmlDoc.getElementsByTagName("job");
  for(i=0; i<xmlJobs.length; i++) {
    var xmlJob = xmlJobs[i];

    var job = new Object;
    eedbUserParseJobData(xmlJob, job); 
    if(job.status != "FAILED") { refresh = true; }
    uploads.queue_array.push(job);
  }

  if(!refresh && userview.uploads.refreshInterval) {
    window.clearInterval(userview.uploads.refreshInterval);
    userview.uploads.refreshInterval = undefined;
  }
  if(refresh && !userview.uploads.refreshInterval) {
    userview.uploads.refreshInterval = setInterval("eedbUserReloadMySourceData();", 300000); //300 seconds, 5min
  }
  eedbUserShowMydataQueue();
}

function eedbUserParseJobData(xmlJob, job) {
  if(!xmlJob) { return; }
  if(!job) { job = new Object; } 
  
  job.classname    = "Job";
  job.upload_error = "";
  job.id           = xmlJob.getAttribute("id");
  job.name         = xmlJob.getAttribute("name");
  job.status       = xmlJob.getAttribute("status");
  if(job.status == "READY") { job.status = "QUEUED"; }
  if(xmlJob.getAttribute("create_date")) {
    job.import_date  = xmlJob.getAttribute("create_date");
  }
  if(xmlJob.getAttribute("create_timestamp")) {
    job.import_timestamp  = xmlJob.getAttribute("create_timestamp");
  }
  if(xmlJob.getAttribute("owner_openid")) {
    job.owner_openID  = xmlJob.getAttribute("owner_openid");
  }
  job.platform     = '';     
  job.assembly     = '';     
  job.description  = "";

  eedbParseMetadata(xmlJob, job);

  if(job.mdata["upload_error"]) {
    var value_array = job.mdata["upload_error"];
    for(var idx1=0; idx1<value_array.length; idx1++) {
      var value = value_array[idx1];
      if(job.upload_error) { job.upload_error +=". "; }
      job.upload_error += value;
    }
  }

  return job;
}


function eedbUserFilteredPeerArray() {
  var filters = userview.filters;

  var peer_hash = userview.uploads.peer_hash;
  var filter_array = new Array;
  //for (var platform in userview.uploads.platforms) {
  for (var uuid in peer_hash) {
    var peer = peer_hash[uuid];
    if(!peer) { continue; }

    var primary_source = peer.primary_source;
    if(!primary_source) { continue; }

    if(userview.filters.only_my_uploads && (userview.user.email != primary_source.owner_identity)) { continue; }
    
    if(userview.filters.assembly) {
      if((primary_source.assembly != userview.filters.assembly) && (primary_source.assembly_name != userview.filters.assembly)) { continue; }
    }

    filter_array.push(peer);
  }
  return filter_array;
}


function eedbUserShowUploads() {
  current_collaboration.callOutFunction = function() { eedbUserSearchSubmit(); }
  var master_div = document.getElementById("eedb_user_maindiv");
  if(!master_div) { return; }

  master_div.setAttribute('style', "margin: 0% 5% 0% 5%; text-decoration:none; color:black;");

  var main_div = document.getElementById("eedb_user_uploads_maindiv");
  if(!main_div) { master_div.innerHTML = ""; }
  
  var uploadButton = document.getElementById("eedb_user_new_upload_button");
  if(!uploadButton) { 
    var uploadButton = master_div.appendChild(document.createElement('div'));
    uploadButton.id = "eedb_user_new_upload_button";
    uploadButton.setAttribute("style", "margin-bottom:5px;");
    button = uploadButton.appendChild(new Element('input'));
    button.type = "button";
    button.className = "largebutton";
    button.setAttribute("onclick", "eedbUserNewUploadPanel();");
    button.value ="upload new data file into ZENBU";
  }

  // upload queue section
  eedbUserShowMydataQueue();

  // dex-like search/filter controls
  var searchCtrl = document.getElementById("eedb_user_uploads_search_ctrls");
  if(!searchCtrl) {
    searchCtrl = master_div.appendChild(document.createElement('div'));
    searchCtrl.id = "eedb_user_uploads_search_ctrls";
  }
  eedbUserRefreshSearchControls();  

  // main container for table of my uploaded datasets
  if(!main_div) {
    console.log("showUploads need to create new uploads_main_div");
    main_div = master_div.appendChild(document.createElement('div'));
    main_div.id = "eedb_user_uploads_maindiv";
  }

  var div1;
  if(userview.uploads.loading) {
    main_div.innerHTML = "loading data...";
    return;
  }
  
  var peer_array = eedbUserFilteredPeerArray();
  if(!peer_array) { return; }
  peer_array.sort(eedbUser_peer_sort_func);
  var queue_array = userview.uploads.queue_array;

  //perform check if peer has been shared
  if(!userview.collaborations.loaded) { eedbUserReloadCollaborations("async"); }
  eedbUserFullLoadCollaborations(); //performs full_load of shared-dbs if needed
  var collaboration_array = eedbUserFilteredCollaborationArray();

  var need_full_loading = false;
  for (var uuid in userview.collaborations.uuid_hash) {
    var collaboration = userview.collaborations.uuid_hash[uuid];
    if(!collaboration) { continue; }
    if(collaboration.full_load) { continue; }
    need_full_loading = true;
  }
  if(collaboration_array.length == 0) { need_full_loading = true; }

  for(var i=0; i<peer_array.length; i++) {
    var peer = peer_array[i];
    peer.shared = false;
    peer.shared_count = 0;
    peer.public = "";
    if(need_full_loading) { peer.shared_count = -1; }
    if(collaboration_array.length == 0) { peer.shared_count = -1; }
    for(var j=0; j<collaboration_array.length; j++) {
      collaboration = collaboration_array[j]
      if((collaboration.member_status != "OWNER") && (collaboration.member_status != "ADMIN") && (collaboration.member_status != "MEMBER")) { continue; }
      if(!collaboration.shared_peers) { continue; }
      if(collaboration.shared_peers[peer.uuid]) {
        peer.shared = true;
        peer.shared_count++;
        if(collaboration.uuid == "public") { peer.public = "public"; }
        if(collaboration.uuid == "curated") { peer.public = "curated"; }
      }
    }
  }
  main_div.innerHTML = "";


  var all_page_uuids = "";
  for(j=0; j<userview.page_size; j++) {
    var i = j+ userview.current_view_index;
    if(i>=peer_array.length) { break; }
    var peer = peer_array[i];
    //now show all peers, don't check for missing primary_source
    all_page_uuids += peer.uuid + ",";
  }
 
  //paging interface at top
  var div2 = main_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = peer_array.length + " uploaded data sources";
  span1.innerHTML = msg;

  var selectAllSpan = div2.appendChild(new Element('a'));
  selectAllSpan.setAttribute('style', "margin-left: 10px; font-family:arial,helvetica,sans-serif; color:purple; text-decoration:underline;");
  selectAllSpan.setAttribute('href', "./");
  selectAllSpan.setAttribute("onclick", "eedbUserSelectAllPeers(\""+all_page_uuids+"\"); return false");
  selectAllSpan.innerHTML = "select all on page";

  //var pagingSpan = eedbUserPagingInterface();
  //div2.appendChild(pagingSpan);

  /*
  var span3 = div2.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', contents.page_size);
  input.setAttribute("onchange", "dexReconfigContentsParam('page-size', this.value);return false;");
  */
 
  //
  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('dataset name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('datasources'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('genome'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('upload date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('select'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('share'));

  /*
  var tmp1 = trhead.appendChild(new Element('th', { 'class': 'listView' }).update('delete'));
  var msg = "delete only available for non-shared datasets. Please ushare before deleting";
  tmp1.setAttribute("onmouseover", "eedbMessageTooltip('"+msg+"',150);");
  tmp1.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  */


  var num_pages = Math.ceil(peer_array.length / userview.page_size);
  userview.uploads.filter_count = peer_array.length;
  userview.num_pages = num_pages;

  var rowNum = 0;
  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<userview.page_size; j++) {
    rowNum++;
    var i = j+ userview.current_view_index;
    if(i>=peer_array.length) { break; }

    var peer = peer_array[i];
    var primary_source = peer.primary_source;
    if(!primary_source) { 
      //document.getElementById("message").innerHTML += "peer FS missing ["+ peer.uuid+"]";
      //if no primary source, then just show the information about the peer (uuid, db_url)
      primary_source = new Object;
      primary_source.name = peer.uuid;
      primary_source.description = peer.db_url;
      primary_source.assembly = "";
    }
    
    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } else { tr.addClassName('even') } 
    //if(i%4 == 0) { tr.setAttribute("style", "background:#FAFAEE;"); }

    tr.appendChild(new Element('td').update(i+1));  //row

    var idTD = tr.appendChild(document.createElement('td'));
    idTD.innerHTML = primary_source.name;

    var td1 = tr.appendChild(new Element('td'));
    td1.setAttribute('nowrap', "nowrap");
    var a1 = td1.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_featuresource_view");
    a1.setAttribute("href", "./");
    var div2 = a1.appendChild(new Element('div'));
    if(peer.featuresource_count>0) {
      div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
      div2.setAttribute("onclick", "eedbUserShowUploadSourcesPanel(\"" +peer.uuid+ "\"); return false;");
      div2.innerHTML = peer.featuresource_count + " annotation sources ";
    }
    if(peer.edgesource_count>0) {
      var div2 = a1.appendChild(new Element('div'));
      div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
      div2.setAttribute("onclick", "eedbUserShowUploadSourcesPanel(\"" +peer.uuid+ "\"); return false;");
      div2.innerHTML = peer.edgesource_count + " edge sources ";
    }
    if(peer.experiment_count>0) {
      var div2 = a1.appendChild(new Element('div'));
      div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
      div2.setAttribute("onclick", "eedbUserShowUploadSourcesPanel(\"" +peer.uuid+ "\"); return false;");
      div2.innerHTML = peer.experiment_count + " experiments ";
    }
    if(peer.assembly_count>0) {
      var div2 = a1.appendChild(new Element('div'));
      div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
      div2.setAttribute("onclick", "eedbUserShowUploadSourcesPanel(\"" +peer.uuid+ "\"); return false;");
      div2.innerHTML = peer.assembly_count + " genomes ";
    }

    tr.appendChild(new Element('td').update(encodehtml(primary_source.assembly)));
    tr.appendChild(new Element('td').update(encodehtml(primary_source.description)));

    //create data/owner/edit cell
    //tr.appendChild(new Element('td').update(encodehtml(primary_source.import_date)));
    var td = tr.appendChild(new Element('td'));
    td.setAttribute("nowrap", "nowrap");
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px;");
    var tspan = tdiv.appendChild(new Element('span'));
    tspan.innerHTML = primary_source.owner_identity;
    var tdiv = td.appendChild(new Element('div'));
    tdiv.setAttribute("style", "font-size:10px; color:rgb(94,115,153);");
    tdiv.innerHTML = encodehtml(primary_source.import_date);

    var td = tr.appendChild(new Element('td'));
    if(userview.user.email == primary_source.owner_identity) {
      var input = td.appendChild(new Element('input'));
      input.setAttribute('type', "checkbox");
      input.setAttribute("style", "background:white;");
      input.setAttribute("onclick", "eedbUserSelectPeer(\"" +peer.uuid+ "\", this.checked);");
      if(peer.selected) { input.setAttribute('checked', "checked"); }
    }

    //sharing interface
    var td1 = tr.appendChild(new Element('td'));
    //td1.setAttribute('nowrap', "nowrap");
    if(peer.shared_count < 0) { 
      var div2 = td1.appendChild(new Element('div'));
      div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px; color:darkgray;");
      div2.innerHTML = "loading..."; 
    }
    else if((userview.user.email == primary_source.owner_identity) && (peer.shared_count >= 0)) { 
      var a1 = td1.appendChild(document.createElement('a'));
      a1.setAttribute("target", "eeDB_featuresource_view");
      a1.setAttribute("href", "./");
      var div2 = a1.appendChild(new Element('div'));
      div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
      div2.setAttribute("onclick", "eedbUserShareDatabasePanel(\"" +primary_source.id+ "\"); return false;");
      if(peer.shared_count == 0) { 
        a1.setAttribute('style', "color:DarkCyan;");
        div2.innerHTML = "not shared"; 
      }
      else if(peer.shared_count < 0) { 
        a1.setAttribute('style', "color:DarkCyan;");
        div2.innerHTML = "loading..."; 
      }
      else { 
        a1.setAttribute('style', "color:Brown;");
        if(peer.public == "public") { div2.innerHTML = "public"; }
        else if(peer.public == "curated") { div2.innerHTML = "curated"; }
        else { div2.innerHTML = "shared "+ peer.shared_count + " collaboration"; }
      }
    } else {
      tdiv = td1.appendChild(new Element('div'));
      tdiv.setAttribute("style", "font-size:10px; color:rgb(180,51,51);");
      tdiv.innerHTML = "not owner";
    }
  }
  if(peer_array.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update(0));
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }

  main_div.appendChild(div1);

  var div2 = main_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = peer_array.length + " uploaded data sources";
  span1.innerHTML = msg;

  var pagingSpan = eedbUserPagingInterface();
  div2.appendChild(pagingSpan);
}

function eedbUser_peer_sort_func(a,b) {
  if(!a) { return 1; }
  if(!a.primary_source) { return 1; }
  if(!b) { return -1; }
  if(!b.primary_source) { return -1; }

  if(a.primary_source.import_timestamp < b.primary_source.import_timestamp) { return 1; }
  if(a.primary_source.import_timestamp > b.primary_source.import_timestamp) { return -1; }

  if(a.primary_source.name < b.primary_source.name) { return -1; }
  if(a.primary_source.name > b.primary_source.name) { return 1; }

  return 0;
}

function eedbUserShowMydataQueue() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }

  var queue_div = document.getElementById("eedb_user_uploads_queue_div");
  if(!queue_div) {
    queue_div = main_div.appendChild(new Element('div'));
    queue_div.id = "eedb_user_uploads_queue_div";
  }
  queue_div.innerHTML = "";
  
  var queue_array = userview.uploads.queue_array;
  if(queue_array.length == 0) { return; }

  //
  // now display as table
  //
  var thr = queue_div.appendChild(new Element('hr'));
  thr.setAttribute("title", "Upload job queue");

  var button = queue_div.appendChild(new Element('button'));
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "eedbUserReloadMySourceData();");
  button.innerHTML ="update job queue status";

  var clearFailedButton = queue_div.appendChild(new Element('button'));
  clearFailedButton.style.marginLeft = "10px";
  clearFailedButton.style.display = "none";
  clearFailedButton.setAttribute("type", "button");
  clearFailedButton.setAttribute("onclick", "eedbUserClearFailedJobs();");
  clearFailedButton.innerHTML ="clear failed jobs";

  var div1 = queue_div.appendChild(new Element('div'));
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('job queue'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('genome'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('upload date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('status'));

  var rowNum = 0;
  var tbody = my_table.appendChild(new Element('tbody'));
  for(var i=0; i<queue_array.length; i++) {
    rowNum++;

    var job = queue_array[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } 
    else { tr.addClassName('even') } 

    (tr.appendChild(new Element('td'))).innerHTML = "job " + rowNum;  //row

    var idTD = tr.appendChild(document.createElement('td'));
    idTD.innerHTML = job.name;

    (tr.appendChild(new Element('td'))).innerHTML = job.assembly;

    var td = tr.appendChild(document.createElement('td'));
    if(job.upload_error) { 
      td.innerHTML = "UPLOAD ERROR: " + job.upload_error; 
      td.setAttribute("style", "color:red;");
    } else { td.innerHTML = job.description;}

    (tr.appendChild(new Element('td'))).innerHTML = encodehtml(job.import_date);
    (tr.appendChild(new Element('td'))).innerHTML = job.status;
    if(job.status == "FAILED") { clearFailedButton.style.display = "initial"; }
  }
  queue_div.appendChild(new Element('hr'));
}


function eedbUserShowSourceInfo(id, peer_uuid) {
  if(peer_uuid && userview.uploads && userview.uploads.peer_hash) {
    var peer = userview.uploads.peer_hash[peer_uuid];
    if(peer) {
      var source = peer.source_hash[id];
      if(source) {  
        if(!source.full_load) { source.request_full_load = true; }
        eedbDisplaySourceInfo(source); 
      }
    }
  }

  /*
  var object = eedbReloadObject(id);
  if(!object) { return false; }

  object.finishFunction = eedbUserReloadSource;

  if(object.classname == "EdgeSource") { eedbDisplaySourceInfo(object); }
  if(object.classname == "FeatureSource") { eedbDisplaySourceInfo(object); }
  if(object.classname == "Experiment") { eedbDisplaySourceInfo(object); }
  */
}


//function eedbUserReloadSource(source) {
//  //document.getElementById("message").innerHTML = "user edit metadata finished";
//  if(!source) { return; }
//  delete userview.uploads.source_hash[source.id];
//  eedbUserReloadContentsData();
//  eedbUserReloadCollaborations(false);
//  eedbUserShowUploads();
//}

//------------------------------------------------------------------------
// multiple select code
//

function eedbUserSelectPeer(uuid, state) {
  if(!userview.uploads) { return; }
  var peer_hash = userview.uploads.peer_hash;
  if(!peer_hash) { return; }
  var peer = peer_hash[uuid];
  if(!peer) { return; }
  peer.selected = state;
}

function eedbUserSelectAllPeers(uuid_list) {
  if(!userview.uploads) { return; }
  var peer_hash = userview.uploads.peer_hash;
  if(!peer_hash) { return; }
  //document.getElementById("message").innerHTML = "select-all ["+ uuid_list+"]--";
  var uuids = uuid_list.split(",");
  for(var i=0; i<uuids.length; i++) {
    var uuid = uuids[i];
    var peer = peer_hash[uuid];
    if(!peer) { continue; }
    peer.selected = true;
  }
  eedbUserShowUploads();
  return false;
}

function eedbUserSelectedPeersPanel(mode) {
  if(!userview.uploads) { return; }
  var peer_hash = userview.uploads.peer_hash;
  if(!peer_hash) { return; }

  var share_warn = false;
  var peer_array = new Array;
  for (var uuid in peer_hash) {
    var peer = peer_hash[uuid];
    if(peer.selected) { 
      peer_array.push(peer); 
      if(peer.shared) { share_warn = true; }
    }
  }
  if(peer_array.length == 0) {
    var msg = "you have not selected any databases.<br>Please select databases with checkboxes before trying to share or delete.";
    zenbuGeneralWarn(msg);
    return;
  }

  var alt_div = document.getElementById("eedb_user_altdiv");
  if(!alt_div) { return; }
  alt_div.innerHTML = "";

  //----------------------------
  var divFrame = document.createElement('div');
  divFrame.id = "eedb_user_share_panel";
  alt_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:fixed; background-color:LightYellow; text-align:left; "
                        +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                        +"z-index:1; "
                        +"left:" + ((winW/2)-300) +"px; "
                        +"top:5%; "
                        +"width:600px; min-height:100px;"
                        );

  // title
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  if(mode == "delete") { tspan.innerHTML = "ZENBU: Delete multiple uploaded databases"; }
  if(mode == "share") { tspan.innerHTML = "ZENBU: Share multiple uploaded databases"; }

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserClearAltDiv(); eedbUserShowUploads(); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute("style", "margin-top:10px; font-size:12px;");
  tdiv.innerHTML = "You have selected " + peer_array.length + " databases to <b>" + mode +"</b>";
  

  if((mode == "delete") && share_warn) {
    var tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "margin-top:5px; color:Brown; font-size:14px; font-weight:bold;");
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "Warning: About to delete shared data sources";
  }

  var tdiv = divFrame.appendChild(document.createElement('div'));

  if(mode == "delete") {
    var tdiv = divFrame.appendChild(document.createElement('div'));
    tdiv.setAttribute('style', "margin-top:10px; font-size:12px;");
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML += "Do you really want to "+mode+"?"

    var tdiv = divFrame.appendChild(document.createElement('div'));
    var button1 = tdiv.appendChild(document.createElement('input'));
    button1.setAttribute("type", "button");
    button1.setAttribute("value", mode);
    button1.setAttribute('style', "margin-left: 20px; width: 100px;");
    if(mode == "delete") { button1.setAttribute("onclick", "eedbUserDeleteMultipleDatabases();"); }

    var button2 = tdiv.appendChild(document.createElement('input'));
    button2.setAttribute("type", "button");
    button2.setAttribute("value", "cancel");
    button2.setAttribute('style', "margin-left: 20px; width:100px;");
    button2.setAttribute("onclick", "eedbUserClearAltDiv();");
  }

  if(mode == "share") {
    var member_collaborations = new Array;
    var collaboration_array = eedbUserFilteredCollaborationArray();

    for(var j=0; j<collaboration_array.length; j++) {
      collaboration = collaboration_array[j]
      if((collaboration.member_status == "OWNER") || (collaboration.member_status == "ADMIN") || (collaboration.member_status == "MEMBER")) {
        member_collaborations.push(collaboration);
      }
    }
    if(member_collaborations.length == 0) { 
      eedbUserClearAltDiv();
      eedbUserNoCollaborationWarn();
      return; 
    }

    //sort the collaborations
    member_collaborations.sort(eedbUser_collab_share_sort_func);

    // scroll frame
    var scrolldiv = divFrame.appendChild(document.createElement('div'));
    scrolldiv.setAttribute("style", "height:350px; width:100%;border:1px; margin-bottom:5px; overflow:auto; resize:vertical;");

    //
    // now display as table
    //
    var my_table = new Element('table');
    my_table.setAttribute("width", "100%");
    scrolldiv.appendChild(my_table);
    var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
    trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
    trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
    trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
    trhead.appendChild(new Element('th', { 'class': 'listView' }).update('# members'));
    trhead.appendChild(new Element('th', { 'class': 'listView' }).update('action'));

    var tbody = my_table.appendChild(new Element('tbody'));
    for(i=0; i<member_collaborations.length; i++) {
      var collaboration = member_collaborations[i];

      var tr = tbody.appendChild(new Element('tr'));
      if(i%2 == 0) { tr.setAttribute("style", "background-color: #E0E0E0;"); } 
      else { tr.setAttribute("style", "background-color: #E8E8E8;"); }

      tr.appendChild(new Element('td').update(i+1));  //row
      tr.appendChild(new Element('td').update(encodehtml(collaboration.name)));
      tr.appendChild(new Element('td').update(encodehtml(collaboration.description)));
      if(collaboration.member_count>0) { tr.appendChild(new Element('td').update(collaboration.member_count)); } 
      else { tr.appendChild(new Element('td').update("-")); }

      if((collaboration.uuid== "public") || (collaboration.uuid == "curated")) {
        tr.setAttribute("style", "background-color: #F4A460;");
      }

      var td = tr.appendChild(new Element('td'));
      var button = td.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      //button.setAttribute("onclick", "eedbUserShareDatabaseWithCollaboration(\""+ source_id +"\", \""+collaboration.uuid+"\");");
      button.setAttribute("onclick", "eedbUserShareMultipleDatabases(\""+collaboration.uuid+"\");");
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"share data source to this collaboration\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "share";
    }
  }

}


function eedbUserShareMultipleDatabases(collab_uuid) {
  if(!userview.uploads) { return; }
  var peer_hash = userview.uploads.peer_hash;
  if(!peer_hash || !collab_uuid) { 
    eedbUserClearAltDiv();
    return; 
  }

  var count=0;
  var total = peer_hash.length;
  for (var uuid in peer_hash) {
    var peer = peer_hash[uuid];
    if(!peer.selected) { continue; }
    if(!peer.primary_source) { continue; }
    count++;

    var paramXML = "<zenbu_query>\n";
    paramXML += "<mode>sharedb</mode>\n";
    paramXML += "<sharedb>"+peer.primary_source.id+"</sharedb>";
    paramXML += "<collaboration_uuid>"+collab_uuid+"</collaboration_uuid>";
    paramXML += "</zenbu_query>\n";

    var xhr=GetXmlHttpObject();
    xhr.open("POST", eedbUserCGI, false);
    xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
    //xhr.setRequestHeader("Content-length", paramXML.length);
    //xhr.setRequestHeader("Connection", "close");
    xhr.send(paramXML);

    peer.selected = false;
  }

  eedbUserClearAltDiv();
  eedbClearSearchTooltip();

  userview.uploads.loading = true;
  eedbUserShowUploads();

  eedbUserReloadCollaborations(false, collab_uuid);
  userview.uploads.loading = false;
  eedbUserShowUploads();
}


function eedbUserDeleteMultipleDatabases() {
  if(!userview.uploads) { return; }
  var peer_hash = userview.uploads.peer_hash;
  if(!peer_hash) { return; }

  var peer_array = new Array;
  for (var uuid in peer_hash) {
    var peer = peer_hash[uuid];
    if(!peer.selected) { continue; }

    var paramXML = "<zenbu_query>\n";
    paramXML += "<deletedb>"+peer.uuid+"</deletedb>";
    paramXML += "</zenbu_query>\n";

    var xhr=GetXmlHttpObject();
    xhr.open("POST", eedbUploadCGI, false);
    xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
    //xhr.setRequestHeader("Content-length", paramXML.length);
    //xhr.setRequestHeader("Connection", "close");
    xhr.send(paramXML);
  }
  eedbUserClearAltDiv();
  eedbUserReloadMySourceData();
}



//
//-------------------------------------------------------------------------------
//

function eedbUser_collab_share_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(a.shared && !b.shared) { return -1; }
  if(!a.shared && b.shared) { return 1; }

  if(a.uuid == "public" && b.uuid!="public") { return 1; }
  if(a.uuid != "public" && b.uuid=="public") { return -1; }

  if(a.uuid == "curated" && b.uuid!="curated") { return 1; }
  if(a.uuid != "curated" && b.uuid=="curated") { return -1; }

  var a_name = a.name.toLowerCase();
  var b_name = b.name.toLowerCase();

  if(a_name < b_name) { return -1; }
  if(a_name > b_name) { return 1; }

  return 0;
}

function eedbUserShareDatabasePanel(source_id) {
  //eedbUserShowUploads();
  if(!source_id) { return; }

  var alt_div = document.getElementById("eedb_user_altdiv");
  if(!alt_div) { return; }
  alt_div.innerHTML = "";

  //----------------------------
  var divFrame = document.createElement('div');
  divFrame.id = "eedb_user_share_panel";
  alt_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:fixed; background-color:LightYellow; text-align:left; "
                        +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                        +"z-index:1; "
                        +"left:" + ((winW/2)-300) +"px; "
                        +"top:5%; "
                        +"width:600px; min-height:100px;"
                        );

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Share uploaded database : "; 
  var name_span = tdiv.appendChild(document.createElement('span'));
  name_span.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  name_span.innerHTML = "loading.....";

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserClearAltDiv(); eedbUserShowUploads(); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");
  
  var sourcedb = eedbFetchObject(source_id);
  if(!sourcedb) { 
    eedbUserClearAltDiv();
    return; 
  }

  //eedbUserReloadCollaborations();
  var member_collaborations = new Array;
  var collaboration_array = eedbUserFilteredCollaborationArray();

  for(var j=0; j<collaboration_array.length; j++) {
    collaboration = collaboration_array[j]
    collaboration.shared = false;
    if((collaboration.member_status == "OWNER") || (collaboration.member_status == "ADMIN") || (collaboration.member_status == "MEMBER")) {
      member_collaborations.push(collaboration);
      if(collaboration.shared_peers && (collaboration.shared_peers[sourcedb.uuid])) { 
        collaboration.shared = true;
      }
    }
  }
  if(member_collaborations.length == 0) { 
    eedbUserClearAltDiv();
    eedbUserNoCollaborationWarn();
    return; 
  }

  name_span.innerHTML = sourcedb.name;

  //sort the collaborations
  member_collaborations.sort(eedbUser_collab_share_sort_func);

  // scroll frame
  var scrolldiv = divFrame.appendChild(document.createElement('div'));
  scrolldiv.setAttribute("style", "height:350px; width:100%;border:1px; margin-bottom:5px; overflow:auto; resize:vertical;");

  //
  // now display as table
  //
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  scrolldiv.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('# members'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('action'));

  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<member_collaborations.length; i++) {
    var collaboration = member_collaborations[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.setAttribute("style", "background-color: #E0E0E0;"); } 
    else { tr.setAttribute("style", "background-color: #E8E8E8;"); }

    tr.appendChild(new Element('td').update(i+1));  //row
    tr.appendChild(new Element('td').update(encodehtml(collaboration.name)));
    tr.appendChild(new Element('td').update(encodehtml(collaboration.description)));
    if(collaboration.member_count>0) { tr.appendChild(new Element('td').update(collaboration.member_count)); } 
    else { tr.appendChild(new Element('td').update("-")); }

    if((collaboration.uuid== "public") || (collaboration.uuid == "curated")) {
      tr.setAttribute("style", "background-color: #F4A460;");
    }

    var td = tr.appendChild(new Element('td'));
    if(collaboration.shared_peers && (collaboration.shared_peers[sourcedb.uuid])) { 
      tr.setAttribute("style", "background-color: #74C365;");
      var div2 = td.appendChild(new Element('div'));
      div2.setAttribute("style", "margin-left:auto; margin-right:auto;");
      div2.innerHTML ="sharing";
      div2 = td.appendChild(new Element('div'));
      var button = div2.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:8px; padding: 1px 4px; margin-left:auto;margin-right:auto; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "eedbUserUnshareDatabaseWithCollaboration(\""+ source_id +"\", \""+collaboration.uuid+"\");");
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"share data source to this collaboration\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "unshare";
    } else {
      //var button = div2.appendChild(new Element('button'));
      //button.setAttribute("type", "button");
      //button.setAttribute("onclick", "eedbUserShareDatabaseWithCollaboration(\""+ source_id +"\", \""+collaboration.uuid+"\");");
      //button.innerHTML ="share";
      var button = td.appendChild(document.createElement("button"));
      button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
      button.setAttribute("onclick", "eedbUserShareDatabaseWithCollaboration(\""+ source_id +"\", \""+collaboration.uuid+"\");");
      button.setAttribute("onmouseover", "eedbMessageTooltip(\"share data source to this collaboration\",100);");
      button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
      button.innerHTML = "share";
    }
  }
}


function eedbUserClearAltDiv() {
  var alt_div = document.getElementById("eedb_user_altdiv");
  if(!alt_div) { return; }
  alt_div.innerHTML = "";
}


function eedbUserNoCollaborationWarn() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                            +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                            +"z-index:1; opacity: 0.95; "
                            +"left:" + ((winW/2)-200) +"px; "
                            +"top:200px; "
                            +"width:400px;"
                             );
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Warning: Not a member of any collaborations";

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserShowUploads();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top:10px; font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "In order to share your data, you must first become a member of a collaboration.";
  tspan.innerHTML += "<br>Please go to the <a href=\"./#section=collaborations\">Collaboration section</a> and either join a collaboration or create one.";
}


function eedbUserShareDatabaseWithCollaboration(source_id, collab_uuid) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>sharedb</mode>\n";
  paramXML += "<sharedb>"+source_id+"</sharedb>";
  paramXML += "<collaboration_uuid>"+collab_uuid+"</collaboration_uuid>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  eedbUserReloadCollaborations("sync", collab_uuid);
  eedbUserShareDatabasePanel(source_id);
  eedbUserShowUploads();
}


function eedbUserUnshareDatabaseWithCollaboration(source_id, collab_uuid) {
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>unsharedb</mode>\n";
  paramXML += "<unsharedb>"+source_id+"</unsharedb>";
  paramXML += "<collaboration_uuid>"+collab_uuid+"</collaboration_uuid>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  //xhr.setRequestHeader("Content-length", paramXML.length);
  //xhr.setRequestHeader("Connection", "close");
  xhr.send(paramXML);

  eedbUserReloadCollaborations("sync", collab_uuid);
  eedbUserShareDatabasePanel(source_id);
  eedbUserShowUploads();
}


function eedbUserShowUploadSourcesPanel(peer_uuid) {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }

  var peer_array = eedbUserFilteredPeerArray();
  if(!peer_array) { return; }

  var peer = null;
  for(var i=0; i<peer_array.length; i++) {
    peer = peer_array[i];
    if(peer.uuid == peer_uuid) { break; }
  }
  if(!peer) { return; }
  if(peer.uuid != peer_uuid) { return; }

  var e = window.event
  toolTipWidth=800;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.adjusted_xpos;
  var ypos = toolTipSTYLE.ypos;

  var sources_panel = document.getElementById("eedb_user_upload_sources_info");
  if(!sources_panel) {
    sources_panel = main_div.appendChild(document.createElement('div'));
    sources_panel.id = "eedb_user_upload_sources_info";
    sources_panel.setAttribute('style', "position:absolute; background-color:#c0c0cc; text-align:left; "+
                               "border:inset; border-width:1px; padding: 3px 7px 3px 7px; "+
                               "z-index:1; top:"+ypos+"px; width:800px; "+
                               "left:" + ((winW/2)-400) +"px; "
                             );
  }
  sources_panel.innerHTML = "";

  // title
  var tdiv = sources_panel.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Sources for uploaded file:";
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  tspan.innerHTML = peer.primary_source.name

  // close button
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserCloseUploadSourcesPanel();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  // scroll frame
  var scrolldiv = sources_panel.appendChild(document.createElement('div'));
  scrolldiv.setAttribute("style", "max-height:350px; width:100%;border:1px; margin-bottom:5px; overflow:auto;");

  //
  // now display as table
  //
  var my_table = scrolldiv.appendChild(new Element('table'));
  my_table.setAttribute("width", "100%");
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('row'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('type'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('name'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('description'));

  var tbody = my_table.appendChild(new Element('tbody'));

  var source_count = 0;
  for (var srcid in peer.source_hash) {
    var source = peer.source_hash[srcid];
    source_count++;
    var tr = tbody.appendChild(new Element('tr'));
    if(source_count%2 == 0) { tr.addClassName('odd') } else { tr.addClassName('even') }

    var td = tr.appendChild(new Element('td'));
    td.innerHTML = source_count;

    td = tr.appendChild(new Element('td'));
    td.innerHTML = source.classname;

    td = tr.appendChild(new Element('td'));
    var a1 = td.appendChild(document.createElement('a'));
    a1.setAttribute("target", "eeDB_featuresource_view");
    a1.setAttribute("href", "./");
    a1.setAttribute("onclick", "eedbUserShowSourceInfo(\"" +source.id+ "\", \""+peer_uuid+"\"); return false;");
    a1.innerHTML = source.name;

    td = tr.appendChild(new Element('td'));
    td.innerHTML = source.description;
  }

  if(source_count == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update(0));
    tr.appendChild(new Element('td').update("no data available"));
    tr.appendChild(new Element('td'));
  }
}


function eedbUserCloseUploadSourcesPanel() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }
  var sources_panel = document.getElementById("eedb_user_upload_sources_info");
  if(!sources_panel) { return; }

  main_div.removeChild(sources_panel);
}


function eedbUserRefreshSearchControls() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }
  var search_div = document.getElementById("eedb_user_uploads_search_ctrls");
  if(!search_div) { return; }

  search_div.setAttribute("margin-bottom", "5px;");
  search_div.innerHTML = "";
  
  var table1 = search_div.appendChild(document.createElement('table'));
  table1.setAttribute("width", "100%");
  //table1.setAttribute("border", "2");

  var tr1 = table1.appendChild(document.createElement('tr'));
  var td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("width", "1px");
  td1.innerHTML = "Search:";
  
  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("width", "1px");
  var input1 = td1.appendChild(document.createElement('input'));
  input1.id = "eedb_user_uploads_search_input";
  input1.className = "sliminput";
  input1.setAttribute("type", "text");
  input1.setAttribute("autocomplete", "off");
  input1.setAttribute("size", "50");
  input1.setAttribute("style", "font-size:12px;");
  input1.setAttribute("onchange", "eedbUserSearchSubmit();return false;");
  if(userview.filters.search) { input1.setAttribute("value", userview.filters.search); }

  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("width", "1px");
  input1 = td1.appendChild(document.createElement('input'));
  input1.type = "button";
  input1.className = "medbutton";
  input1.setAttribute("value", "search");
  input1.setAttribute("onclick", "eedbUserSearchSubmit();");

  
  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("width", "1px");
  input1 = td1.appendChild(document.createElement('input'));
  input1.type = "button";
  input1.className = "medbutton";
  input1.setAttribute("value", "clear");
  input1.setAttribute("onclick", "eedbUserSearchClear('true')");
    
  td1 = tr1.appendChild(document.createElement('td'));
  td1.setAttribute("nowrap", "nowrap");
  td1.setAttribute("width", "1px");
  td1.setAttribute("style", "padding-left:15px");
  var tdiv1 = td1.appendChild(document.createElement('div'));
  var collabWidget = eedbCollaborationSelectWidget("filter_search");
  tdiv1.appendChild(collabWidget);  
  var tcheck = tdiv1.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin-left:7px;");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "eedbUserReconfigParam('only_my_uploads', this.checked);");
  if(userview.filters.only_my_uploads) { tcheck.setAttribute("checked", "checked"); }
  tspan = tdiv1.appendChild(document.createElement('span'));
  tspan.innerHTML = "show only my uploads";
  if(!search_div.genome_select) {
    var genome_select = zenbuGenomeSelectWidget("filter_search", createUUID());
    genome_select.style.marginLeft = "0px";
    genome_select.callOutFunction = eedbUserSourcesGenomeFilter;
    genome_select.allow_non_genomic = true;
    if(userview.filters.assembly) { genome_select.name = userview.filters.assembly; }
    search_div.genome_select = genome_select;
    console.log("created new GenomeSelect with uuid["+genome_select.uniqID+"]");
  }
  var tdiv2 = td1.appendChild(document.createElement('div'));
  tdiv2.appendChild(search_div.genome_select);

  td1 = tr1.appendChild(document.createElement('td'));

  var tr2 = table1.appendChild(document.createElement('tr'));
  td1 = tr2.appendChild(document.createElement('td'));
  td1.setAttribute("colspan", "4");

  td1 = tr2.appendChild(document.createElement('td'));
  td1.setAttribute("width", "1px");
  td1.setAttribute("align", "right");
  var button = td1.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  button.setAttribute("onclick", "eedbUserSelectedPeersPanel('share')");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"share multi-selected data sources<br>to collaboration\",170);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.value = "share";

  //td1 = tr2.appendChild(document.createElement('td'));
  //td1.setAttribute("width", "1px");
  button = td1.appendChild(document.createElement("input"));
  button.type = "button";
  button.className = "medbutton";
  button.setAttribute("onclick", "eedbUserSelectedPeersPanel('delete')");
  button.setAttribute("onmouseover", "eedbMessageTooltip(\"delete multi-selected data sources\",170);");
  button.setAttribute("onmouseout", "eedbClearSearchTooltip();");
  button.value = "delete";
    
}  

function eedbUserSourcesGenomeFilter(genomeWidget) {
  if(!genomeWidget) { return; }  
  //genomeWidget.name = name;
  //genomeWidget.assembly = assembly;

  var name = genomeWidget.name;
  if(name == "all") { name = ""; }
  userview.filters.assembly = name; 
  
  eedbUserShowUploads();
}

//---------------------------------------------------------------------------
//
// common interface elements
//
//---------------------------------------------------------------------------

function eedbUserPagingInterface() {

  var page = Math.ceil(userview.current_view_index / userview.page_size) + 1;

  var pagingSpan = document.getElementById("eedbUser_paging_span");

  if(!pagingSpan) { 
    pagingSpan = new Element('span');
    pagingSpan.id = "eedbUser_paging_span";
  }
  pagingSpan.setAttribute('style', "font-family:arial,helvetica,sans-serif;");

  var link1 = pagingSpan.appendChild(new Element('a'));
  link1.setAttribute("href", "./");
  link1.setAttribute('style', "margin-left: 75px; color:purple; text-decoration:underline;");
  link1.setAttribute("onclick", "eedbUserReconfigParam('previous-page');return false");
  link1.innerHTML = "<< previous page";

  var tspan2 = pagingSpan.appendChild(new Element('span'));
  tspan2.setAttribute('style', "margin-left: 5px; font-weight:bold;");
  tspan2.innerHTML = "| Page: ";

  var start_page = 1;
  if(page > 7) {
    var link2 = pagingSpan.appendChild(new Element('a'));
    link2.setAttribute("href", "./");
    link2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline;");
    link2.setAttribute("onclick", "eedbUserReconfigParam('page', \"1\");return false");
    link2.innerHTML = 1;

    var span2 = pagingSpan.appendChild(new Element('span'));
    span2.setAttribute('style', "margin-left: 4px; ");
    span2.innerHTML = "...";
    start_page = page - 4;
  }
  for(var j=start_page; j<start_page+9; j++) {
    if(j>userview.num_pages) { break; }
    var link2 = pagingSpan.appendChild(new Element('a'));
    link2.setAttribute("href", "./");
    link2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline;");
    if(j == page) { link2.setAttribute('style', "margin-left: 4px; color:black; font-weight:bold;"); }
    link2.setAttribute("onclick", "eedbUserReconfigParam('page', \"" +j+ "\");return false");
    link2.innerHTML = j;
  }
  if(j<=userview.num_pages) {
    var span2 = pagingSpan.appendChild(new Element('span'));
    span2.setAttribute('style', "margin-left: 4px; ");
    span2.innerHTML = "...";
    var link2 = pagingSpan.appendChild(new Element('a'));
    link2.setAttribute('href', "./");
    link2.setAttribute('style', "margin-left: 4px; color:purple; text-decoration:underline;");
    link2.setAttribute("onclick", "eedbUserReconfigParam('page', \"" +userview.num_pages+ "\");return false");
    link2.innerHTML = userview.num_pages;
  }

  var tspan3 = pagingSpan.appendChild(new Element('span'));
  tspan3.setAttribute('style', "margin-left: 5px; color:black; font-weight:bold;");
  tspan3.innerHTML = "|";

  var link2 = pagingSpan.appendChild(new Element('a'));
  link2.setAttribute('href', "./");
  link2.setAttribute('style', "margin-left: 4px; font-family:arial,helvetica,sans-serif; color:purple; text-decoration:underline;");
  link2.setAttribute("onclick", "eedbUserReconfigParam('next-page');return false");
  link2.innerHTML = "next page >>";

  var span3 = pagingSpan.appendChild(new Element('span'));
  span3.setAttribute('style', "margin-left: 30px;");
  var tspan = span3.appendChild(new Element('span'));
  tspan.innerHTML = "page size: ";
  var input = span3.appendChild(document.createElement('input'));
  input.setAttribute('size', "3");
  input.setAttribute('type', "text");
  input.setAttribute('value', userview.page_size);
  input.setAttribute("onchange", "eedbUserReconfigParam('page-size', this.value);return false;");

  return pagingSpan;
}


//---------------------------------------------------------------------------
//
// filter controls section
//
//---------------------------------------------------------------------------

function eedbUserCreatePlatformSelect() {
  var span1          = document.getElementById("_platformSelectSpan");
  var platformSelect = document.getElementById("_platformSelect");
  if(!span1) {
    span1 = document.createElement('span');
    span1.id = "_platformSelectSpan";
    span1.setAttribute("style", "margin:2px 10px 2px 0px;");

    var span2 = document.createElement('span');
    span2.innerHTML = "featuresource platforms:";
    span1.appendChild(span2);

    platformSelect = document.createElement('select');
    platformSelect.setAttribute('name', "platform");
    platformSelect.setAttribute('style', "margin: 1px 0px 1px 0px; font-size:10px; font-family:arial,helvetica,sans-serif; ");
    platformSelect.setAttribute("onchange", "eedbUserReconfigParam('platform', this.value);");
    platformSelect.id = "_platformSelect";
    span1.appendChild(platformSelect);
  }
  platformSelect.innerHTML = ""; //to clear old content

  var option = document.createElement('option');
  option.setAttribute("value", "");
  option.innerHTML = "all platforms";
  platformSelect.appendChild(option);

  var platforms = new Array;
  for (var platform in userview.uploads.platforms) {
    platforms.push(platform);
  }
  platforms.sort(function(x,y){
       var a = String(x).toUpperCase();
       var b = String(y).toUpperCase();
       if(a > b) { return 1; }
       if(a < b) { return -1; }
       return 0; });

  for (var i=0; i<platforms.length; i++) {
    var platform = platforms[i];
    var option = document.createElement('option');
    option.setAttributeNS(null, "value", platform);
    //if(type == track.exptype) { option.setAttributeNS(null, "selected", "selected"); }
    option.innerHTML = platform;
    platformSelect.appendChild(option);
  }

  return span1;
}


function eedbUserCreateAssemblySelect() {
  //current_genome.callOutFunction = eedbUserGenomeSelectCallout;
  if(userview.filters.assembly) { current_genome.name = userview.filters.assembly; }

  var genomeWidget = zenbuGenomeSelectWidget("upload");
  genomeWidget.style.marginLeft = "0px";
  genomeWidget.callOutFunction = eedbUserGenomeSelectCallout;
  
  return genomeWidget;
}

function eedbUserGenomeSelectCallout() {
  //console.log("eedbUserGenomeSelectCallout");
  var name = current_genome.name;
  if(name == "all") { name = ""; }
  eedbUserReconfigParam('assembly', name);
}


function eedbUserCreateOthers() {
  var ctrlDiv = document.getElementById("contents_controls");
  if(!ctrlDiv) {  return; }

  var span1  = document.getElementById("_othersSelectSpan");
  if(!span1) {
    span1 = document.createElement('span');
    span1.id = "_othersSelectSpan";
    span1.setAttribute("style", "margin:2px 10px 2px 0px;");

    var span2 = document.createElement('span');
    span2.innerHTML = "tissues:   cells:   treatments:  ";
    span1.appendChild(span2);
    ctrlDiv.appendChild(span1);
  }
  return span1;
}


function eedbUserReconfigParam(param, value) {
  if(param == "platform") {  
    userview.filters.platform = value; 
    //userview.current_view_index = 0;
  }
  if(param == "assembly") {  
    eedbUserSearchClear();
    userview.filters.assembly = value; 
    userview.filters.platform = "";
    userview.filters.search = "";
    //userview.current_view_index = 0;
    if(userview.upload) {
      userview.upload.assembly = value;
    }
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-file") {  
    if(userview.upload) {
      userview.upload.file_path = null;
      userview.upload.file_format = null;

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
             userview.upload.file_format = ext.toUpperCase();
             name = mymatch[1];
        }
        if((ext=="fasta") || (ext=="fa") || (ext=="fas")) {
          userview.upload.file_format = "GENOME";
          name = mymatch[1]; //might not need
        }
      }
      if(userview.upload.file_format) {
        var n=name.lastIndexOf("\\");
        if(n != -1) { name = name.substr(n+1); }
        var n=name.lastIndexOf("\/");
        if(n != -1) { name = name.substr(n+1); }

        //var mymatch = /^(.+)[\/\\](\w+)$/.exec(name);
        //if(mymatch && (mymatch.length == 3)) { name = mymatch[2]; }

        name = name.replace(/[_-]/g, " ");

        var toks = name.split(/\s/);
        for(var i in toks) {
          if(userview.assemblies[toks[i]]) {
            userview.upload.assembly = toks[i];
          }
        }
        if(!userview.upload.display_name) { userview.upload.display_name = name; }
        if(!userview.upload.description) { userview.upload.description = name; }
        userview.upload.file_path = value;
      }
    }
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "bedscore-express") {  
    userview.upload.bedscore_express = value;
    if(value && (userview.upload.datatype =="")) { userview.upload.datatype = "score"; }
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "singletagmap-express") {  
    userview.upload.singletagmap_express = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "build_feature_name_index") {  
    userview.upload.build_feature_name_index = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-display_name") {  
    userview.upload.display_name  = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-description") {  
    userview.upload.description  = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-datatype") {  
    userview.upload.datatype  = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-genome_name") {  
    userview.upload.genome_name  = value;
    userview.upload.display_name  = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-taxon_id") {  
    userview.upload.taxon_id  = value;
    eedbUserNewUploadPanelRefresh();
    //eedbUserGetNCBITaxonInfo(userview.upload.taxon_id);
  }
   if(param == "upload-edge-mode") {  
    userview.upload.edgemode  = value;
    eedbUserNewUploadPanelRefresh();
  }
  if(param == "upload-strict_edge_linking") {  
    userview.upload.strict_edge_linking = value;
    edbUserNewUploadPanelRefresh();
  }

  if(param == "upload-submit") {  
    userview.upload.file_sent  = true;
    eedbUserNewUploadPanelRefresh();
    var upload_form = document.getElementById("eedb_user_upload_form");
    if(upload_form) { upload_form.submit(); }
  }

  if(param == "only_my_uploads") {  
    userview.filters.only_my_uploads = value;
    //eedbUserSearchSubmit();
    eedbUserShowContents();
  }

  if(param == "page") {  
    userview.current_view_index = (value-1) * userview.page_size;
    eedbUserShowContents();
  }
  if(param == "previous-page") {  
    var idx = userview.current_view_index - userview.page_size;
    if(idx < 0) { idx = 0; }
    userview.current_view_index = idx;
    eedbUserShowContents();
  }
  if(param == "next-page") {  
    var idx = userview.current_view_index + userview.page_size;
    var page = Math.ceil(idx / userview.page_size);
    if(page < userview.num_pages) { 
      userview.current_view_index = idx;
    }
    eedbUserShowContents();
  }
  if(param == "page-size") {
    userview.page_size = Math.floor(value);
    if(userview.page_size < 5) { userview.page_size=5; }
    //if(contents.page_size > 100) { contents.page_size=100; }
    eedbUserShowContents();
  }
  if(param == "mode") {
    //userview.filters.assembly = ""; 
    userview.filters.platform = "";
    userview.filters.search = "";
    userview.upload = null;
    userview.current_view_index = 0;

    if(!userview.user) { value = "profile"; }

    userview.mode = value;
    if(value == "uploads") { eedbUserReloadMySourceData(); }

    eedbUserSearchClear();
    eedbUserShowSubmenu();
    dhtmlHistory.add("#section="+value);
    eedbUserShowContents();
    //zenbuRegisterCurrentURL();
  }
  
  //--------------------------------------------------------
  // download params
  var ztrack = userview.download_track;

  if(param == "download-format") { 
    ztrack.download.format = value;
    eedbUserDownloadOptions(ztrack);
  }
  
  if(param == "download-savefile") { ztrack.download.savefile = value; }
  if(param == "download-mode") { 
    ztrack.download.mode = value; 
  }
  if(param == "download-subfeatures") { ztrack.download.subfeatures = value; }
  if(param == "download-feature-metadata") { ztrack.download.feature_metadata = value; }
  if(param == "download-experiment-metadata") { ztrack.download.experiment_metadata = value; }
  if(param == "download-osc-metadata") { ztrack.download.osc_metadata = value; }
  
  if(param == "download-location") { 
    var radio = document.getElementById(ztrack.trackID + "_DownloadMode_location");
    if(radio) { radio.setAttribute("checked", "checked"); }
    ztrack.download.mode     = "location";
    ztrack.download.location = value; 
  }
    
  if(param == "accept-download") {
    eedbUserPostDownloadRequest(ztrack);
    ztrack.download  = undefined;
    eedbUserCloseDownloadPanel();
  }
  
}


function eedbUserPreDeleteWarning(source_id, share_count) {
  var alt_div = document.getElementById("eedb_user_altdiv");
  if(!alt_div) { return; }
  alt_div.innerHTML = "";
  
  var divFrame = document.createElement('div');
  alt_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:absolute; background-color:LightYellow; text-align:left; "
                        +"border:inset; border-width:1px; padding: 3px 7px 3px 7px; "
                        +"z-index:1; opacity: 0.95; "
                        +"left:" + ((winW/2)-200) +"px; "
                        +"top:200px; "
                        +"width:400px;"
                        );
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Warning: About to delete shared data";
  
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserClearAltDiv();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");
  
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top:10px; font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "You are about to delete a data source which is shared with " + share_count + " collaborations."
  tspan.innerHTML += "<p>Do you really want to delete?"
  
  var tdiv = divFrame.appendChild(document.createElement('div'));
  
  var button1 = tdiv.appendChild(document.createElement('input'));
  button1.setAttribute("type", "button");
  button1.setAttribute("value", "yes");
  button1.setAttribute('style', "margin-left: 20px; width: 100px;");
  button1.setAttribute("onclick", "eedbUserDeleteDatabase(\"" +source_id+ "\");");

  var button2 = tdiv.appendChild(document.createElement('input'));
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "no");
  button2.setAttribute('style', "margin-left: 20px; width:100px;");
  button2.setAttribute("onclick", "eedbUserClearAltDiv();");

}


function eedbUserDeleteDatabase(source_id) {
  eedbUserClearAltDiv();
  
  userview.uploads.loading = true;
  eedbUserShowUploads();
  
  var url = eedbUploadCGI + "?deletedb=" + source_id;

  var deleteXMLHttp=GetXmlHttpObject();
  deleteXMLHttp.open("GET", url, false);
  deleteXMLHttp.send(null);

  if(deleteXMLHttp == null) { return eedbUserReloadMySourceData(); }
  if(deleteXMLHttp.responseXML == null) { return eedbUserReloadMySourceData(); }
  if(deleteXMLHttp.readyState!=4) { return eedbUserReloadMySourceData(); }
  if(deleteXMLHttp.status!=200) { return eedbUserReloadMySourceData(); }
  var xmlDoc=deleteXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return eedbUserReloadMySourceData(); }

  var xmlUpload = xmlDoc.getElementsByTagName("upload");
  eedbUserReloadMySourceData();
}


function eedbUserCollaborationUsersInfo(uuid) {
  eedbUserShowCollaborations();
  if(!uuid) { return; }
  
  var collaboration;
  var collaboration_array = eedbUserFilteredCollaborationArray();
  for(var j=0; j<collaboration_array.length; j++) {
    collaboration = collaboration_array[j]
    if(collaboration.uuid == uuid) { break; }
  }
  if(collaboration.uuid != uuid) { return; }
  
  var main_div = document.getElementById("eedb_user_collaboration_table_div");
  if(!main_div) { return; }
  
  var e = window.event
  toolTipWidth=500;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.adjusted_xpos;
  var ypos = toolTipSTYLE.ypos;
  
  var divFrame = main_div.appendChild(document.createElement('div'));
  divFrame.setAttribute('style', "text-align:left; font-size:10px; font-family:arial,helvetica,sans-serif; "+
                        "width:500px; z-index:60; padding: 3px 3px 3px 3px; "+
                        "background-color:rgb(220,255,255); border:inset; border-width:2px; "+
                        "position:absolute; left:"+  ((winW/2)-250) +"px; top:"+ ypos +"px;");
  
  tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "eedbUserShowCollaborations();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("width", "12");
  img1.setAttribute("height", "12");
  img1.setAttribute("alt","close");

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "font-weight:bold; color:rgb(94,115,153);");
  tspan.innerHTML = collaboration.name;
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = " : users"; 

  //user table
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  divFrame.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('nickname'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('email'));
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(i=0; i<collaboration.members.length; i++) {
    var user = collaboration.members[i];
    
    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') }
    else { tr.addClassName('even') }
    
    tr.appendChild(new Element('td').update(encodehtml(user.nickname)));
    tr.appendChild(new Element('td').update(encodehtml(user.email)));
  }
}


//---------------------------------------------------------------------------
//
// Downloads section
//
//---------------------------------------------------------------------------

function eedbUserDownloadsView() {
  var main_div = document.getElementById("eedb_user_maindiv");
  if(!main_div) { return; }

  main_div.setAttribute('style', "margin: 0px 20px 0px 20px; text-decoration:none; font-size:12px;");
  main_div.innerHTML = "";

  var div1, form, label1, input1, text1, button;

  div1 = main_div.appendChild(document.createElement('div'));
  div1.id = "eedb_user_downloads_table_div";

  eedbUserReloadDownloads();
  eedbUserShowDownloads();
}


//----------

function eedbUserReloadDownloads() {
  var url = eedbUserCGI+"?mode=downloads";
  eedbUserXMLHttp.onreadystatechange=eedbUserPrepareDownloadsData;
  eedbUserXMLHttp.open("GET", url, false);
  eedbUserXMLHttp.send(null);
}


function eedbUserPrepareDownloadsData() {
  if(eedbUserXMLHttp == null) { return; }
  if(eedbUserXMLHttp.responseXML == null) return;
  if(eedbUserXMLHttp.readyState!=4) return;
  if(eedbUserXMLHttp.status!=200) { return; }
  var xmlDoc=eedbUserXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) { return; } 
 
  var downloads = userview.downloads;
  downloads.download_requests = new Array();

  var xmlDownloads = xmlDoc.getElementsByTagName("track_request");
  for(i=0; i<xmlDownloads.length; i++) {
    var xmlDownload = xmlDownloads[i];

    var download = new Object;
    download.id               = xmlDownload.getAttribute("id");
    download.trackname        = "";
    download.view_uuid        = "";
    download.assembly         = xmlDownload.getAttribute("asmb");
    download.chrom            = xmlDownload.getAttribute("chrom");
    download.start            = xmlDownload.getAttribute("start");
    download.end              = xmlDownload.getAttribute("end");
    download.num_segs         = Math.floor(xmlDownload.getAttribute("num_segs"));
    download.unbuilt          = Math.floor(xmlDownload.getAttribute("unbuilt"));
    download.claimed          = 0;
    download.numbuilt         = 0;
    download.send_email       = xmlDownload.getAttribute("send_email");
    download.date             = xmlDownload.getAttribute("time");

    var tname = xmlDownload.getElementsByTagName("track_name");
    if(tname && tname.length>0) { download.trackname = tname[0].firstChild.nodeValue; }

    var vuuid = xmlDownload.getElementsByTagName("view_uuid");
    if(vuuid && vuuid.length>0) { download.view_uuid = vuuid[0].firstChild.nodeValue; }

    var hashkey = xmlDownload.getElementsByTagName("hashkey");
    if(hashkey && hashkey.length>0) { download.hashkey = hashkey[0].firstChild.nodeValue; }

    var build_stats = xmlDownload.getElementsByTagName("build_stats");
    if(build_stats && build_stats.length>0) { 
      download.num_segs  = build_stats[0].getAttribute("numsegs"); 
      download.numbuilt  = build_stats[0].getAttribute("numbuilt"); 
      download.claimed   = build_stats[0].getAttribute("numclaimed"); 
    }

    downloads.download_requests.push(download);
  }
  downloads.total_count = xmlDownloads.length;
  eedbUserShowDownloads();
}


function eedbUserShowDownloads() {
  var main_div = document.getElementById("eedb_user_downloads_table_div");
  if(!main_div) { return; }

  main_div.innerHTML = "";

  var downloads = userview.downloads.download_requests;
  if(!downloads) { return; }
  downloads.sort(eedbUser_downloads_sort_func);

  //
  // now display as table
  //
  var div1 = new Element('div');
  div1.setAttribute('style', "width:100%;");
  var my_table = new Element('table');
  my_table.setAttribute("width", "100%");
  div1.appendChild(my_table);
  var trhead = my_table.appendChild(new Element('thead')).appendChild(new Element('tr'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('id'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('view'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('track'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('location'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('date'));
  trhead.appendChild(new Element('th', { 'class': 'listView' }).update('status'));

  var num_pages = Math.ceil(downloads.length / userview.page_size);
  userview.uploads.filter_count = downloads.length;
  userview.num_pages = num_pages;

  var need_refresh = false;
  
  var tbody = my_table.appendChild(new Element('tbody'));
  for(j=0; j<userview.page_size; j++) {
    var i = j+ userview.current_view_index;
    if(i>=downloads.length) { break; }

    var download = downloads[i];

    var tr = tbody.appendChild(new Element('tr'));
    if(i%2 == 0) { tr.addClassName('odd') } else { tr.addClassName('even') } 
    //if(i%4 == 0) { tr.setAttribute("style", "background:#FAFAEE;"); }

    tr.appendChild(new Element('td').update(download.id));

    var td = tr.appendChild(document.createElement('td'));
    if(download.view_uuid) {
      td.innerHTML = "<a href=\"../gLyphs/#config=" +download.view_uuid+ "\">view</a>";
    }

    tr.appendChild(new Element('td').update(encodehtml(download.trackname)));

    //location
    var locname = download.assembly + " ";
    if(!download.chrom) { locname ="whole genome"; }
    else if(download.start == -1 && download.end==-1) {
      locname += download.chrom;
    } else {
      locname += download.chrom + ":" + download.start +".."+ download.end;
    }
    var td = tr.appendChild(new Element('td'));
    td.innerHTML = locname;

    var td = tr.appendChild(new Element('td'));
    td.innerHTML = download.date;

    var td = tr.appendChild(new Element('td'));
    td.setAttribute('nowrap', "nowrap");
    if(download.num_segs>0) {
      if(download.unbuilt==0) {
        var a1 = td.appendChild(document.createElement('a'));
        a1.setAttribute("target", "zenbu_user_download_target");
        a1.setAttribute("href", "./");
        var div2 = a1.appendChild(new Element('div'));
        div2.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
        div2.setAttribute("onclick", "eedbUserDownloadTrackPanel(\"" +download.id+ "\"); return false;");
        div2.innerHTML = "download ready";      
      } else {
        need_refresh = true;
        //var div2 = td.appendChild(new Element('div'));
        //div2.setAttribute('style', "font-size:10px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");

        var a1 = td.appendChild(document.createElement('a'));
        a1.setAttribute("target", "zenbu_user_download_target");
        a1.setAttribute("href", "./");
        var div2 = a1.appendChild(new Element('div'));
        div2.setAttribute('style', "font-size:12px; font-family:arial,helvetica,sans-serif; margin: 0px 0px 0px 0px;");
        div2.setAttribute("onclick", "eedbUserDownloadTrackPanel(\"" +download.id+ "\"); return false;");

        //var completed = Math.floor(10000 - 10000*(download.unbuilt / download.num_segs))/100;
        var completed = Math.floor(10000*download.numbuilt / download.num_segs)/100;
        div2.innerHTML = completed + "%";
        if(download.claimed >0) { div2.innerHTML += " building"; }
      }
    } else {
      td.innerHTML = "problem with request";
    }
  }
  
  if(downloads.length == 0) {
    var tr = tbody.appendChild(new Element('tr'));
    tr.addClassName('odd');
    tr.appendChild(new Element('td').update(0));
    tr.appendChild(new Element('td').update("no downloads available"));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
    tr.appendChild(new Element('td'));
  }

  main_div.appendChild(div1);

  var div2 = main_div.appendChild(new Element('div'));
  var span1 = div2.appendChild(new Element('span'));
  var msg = userview.downloads.total_count + " downloads";
  span1.innerHTML = msg;

  var pagingSpan = eedbUserPagingInterface();
  div2.appendChild(pagingSpan);
  
  //for refreshing the view
  if(need_refresh) {
    var milliseconds = new Date().getTime();
    var next_refresh = Math.floor(main_div.getAttribute("next_refresh"));
    if(next_refresh <= milliseconds) {
      main_div.setAttribute("next_refresh", milliseconds+10000);
      setTimeout("eedbUserReloadDownloads();", 10000); //10 seconds
    }  
  }
}


function eedbUser_downloads_sort_func(a,b) {
  if(!a) { return 1; }
  if(!b) { return -1; }

  if(Math.floor(a.id) < Math.floor(b.id)) { return 1; }
  if(Math.floor(a.id) > Math.floor(b.id)) { return -1; }

  /*
  if(a.uuid == "curated") { return -1; }
  if(b.uuid == "curated") { return 1; }
  if(a.uuid == "public") { return -1; }
  if(b.uuid == "public") { return 1; }

  if(a.member_status != b.member_status) {
    if(a.member_status == "OWNER") { return -1; }
    if(b.member_status == "OWNER") { return 1; }
    if(a.member_status == "ADMIN") { return -1; }
    if(b.member_status == "ADMIN") { return 1; }
    if(a.member_status == "MEMBER") { return -1; }
    if(b.member_status == "MEMBER") { return 1; }
    if(a.member_status == "REQUEST") { return -1; }
    if(b.member_status == "REQUEST") { return 1; }
  }
  if(a.public_announce != b.public_announce) { 
    if(a.public_announce == "y") { return 1; }
    if(b.public_announce == "y") { return -1; }
  }

  if(a.name < b.name) { return -1; }
  if(a.name > b.name) { return 1; }
  */

  return 0;
}



//--------------------------------------------------------
//
// download data from track control panel section
//
//--------------------------------------------------------

function eedbUserDownloadTrackPanel(requestID) {
  var downloads = userview.downloads.download_requests;
  if(!downloads) { return; }

  var ztrack;
  for(var i=0; i<downloads.size(); i++) {
    var download = downloads[i];
    if(download.id == requestID) { ztrack = download; }
  }
  if(!ztrack) { return; }
  userview.download_track = ztrack;

  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }

  var download_panel = document.getElementById("eedb_user_track_download_panel");
  if(download_panel) { 
    //close the old one and make a new one
    main_div.removeChild(download_panel);
  }

  ztrack.trackDiv = main_div;
  ztrack.trackID = ztrack.hashkey;

  var e = window.event
  toolTipWidth=370;
  moveToMouseLoc(e);
  var xpos = toolTipSTYLE.adjusted_xpos;
  var ypos = toolTipSTYLE.ypos;

  ztrack.download = new Object;
  ztrack.download.format = "osc";
  ztrack.download.savefile = false;
  ztrack.download.mode = "genome";
  ztrack.download.subfeatures = "none";
  ztrack.download.feature_metadata = false;
  ztrack.download.experiment_metadata = false;
  ztrack.download.osc_metadata = false;  
    
  if(ztrack.chrom) { 
    ztrack.download.mode = "location";
    ztrack.download.location = ztrack.chrom +":" + ztrack.start + ".." + ztrack.end;
  }

  download_panel = main_div.appendChild(document.createElement('div'));
  download_panel.id = "eedb_user_track_download_panel";
  download_panel.setAttribute('style', "position:absolute; background-color:PaleTurquoise; text-align:left; "
                        +"border:inset; border-width:1px; padding: 3px 3px 3px 3px; "
                        +"font-size:10px; font-family:arial,helvetica,sans-serif; "
                        +"width:370px; "
                        +"position:absolute; left:"+(xpos-50)+"px; top:"+(ypos-30)+"px;"
                        );
  
  download_panel.innerHTML = "";

  // title
  var tdiv = download_panel.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:12px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : track data download";

  // close button
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "eedbUserCloseDownloadPanel();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var div1, form, label1, input1, text1, span1;
  var tdiv, tdiv2, tspan, tlabel;

  //----------
  tdiv = download_panel.appendChild(document.createElement('div'));
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.setAttribute('style', "margin-right:3px;");
  tspan.innerHTML = "region:";

  var radio3 = tdiv.appendChild(document.createElement('input'));
  radio3.setAttribute("type", "radio");
  radio3.setAttribute("name", ztrack.trackID + "_DownloadMode");
  radio3.setAttribute("value", "genome");
  radio3.setAttribute("onchange", "eedbUserReconfigParam('download-mode', this.value);");
  if(ztrack.download.mode == "genome") { radio3.setAttribute("checked", "checked"); }
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "whole genome";


  //----------
  tdiv = download_panel.appendChild(document.createElement('div'));
  var radio3 = tdiv.appendChild(document.createElement('input'));
  radio3.id = ztrack.trackID + "_DownloadMode_location";
  radio3.setAttribute("style", "margin-left:40px;");
  radio3.setAttribute("type", "radio");
  radio3.setAttribute("name", ztrack.trackID + "_DownloadMode");
  radio3.setAttribute("value", "location");
  if(ztrack.download.mode == "location") { radio3.setAttribute("checked", "checked"); }
  radio3.setAttribute("onchange", "eedbUserReconfigParam('download-mode', this.value);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "location:";

  var input1 = tdiv.appendChild(document.createElement('input'));
  input1.setAttribute('style', "width:200px; margin: 1px 1px 1px 3px; font-size:10px; font-family:arial,helvetica,sans-serif;");
  input1.setAttribute('type', "text");
  if(ztrack.download.mode == "location") { 
    input1.setAttribute('value', ztrack.download.location);
  }
  //input1.setAttribute("onfocus", "eedbUserReconfigParam('download-location', this.value);");
  //input1.setAttribute("onkeyup", "eedbUserReconfigParam('download-location', this.value);");
  input1.setAttribute("onchange", "eedbUserReconfigParam('download-location', this.value);");

  //----------
  var dyn_binsize = download_panel.appendChild(document.createElement('div'));
  dyn_binsize.id = ztrack.trackID + "_download_dyn_binsize";

  //----------
  var build_stats = download_panel.appendChild(document.createElement('div'));
  build_stats.id = ztrack.trackID + "_download_buildstats";
  if(ztrack.hashkey) {
    var div1 = build_stats.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-left:6px; font-size:9px; font-family:arial,helvetica,sans-serif; ");
    var span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "color:orange; ");
    span1.innerHTML = ztrack.hashkey;
  }


  //
  //----------
  //
  var download_ctrls = download_panel.appendChild(document.createElement('div'));
  download_ctrls.id = ztrack.trackID + "_download_ctrls";

  download_ctrls.appendChild(document.createElement('hr'));

  tdiv = download_ctrls.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin: 2px 0px 2px 0px;");
  tspan = eedbUserCreateDownloadFormatSelect(ztrack);
  tdiv.appendChild(tspan);

  var tcheck = tdiv.appendChild(document.createElement('input'));
  tcheck.setAttribute('style', "margin: 0px 3px 0px 24px;");
  tcheck.setAttribute('type', "checkbox");
  tcheck.setAttribute("onclick", "eedbUserReconfigParam('download-savefile', this.checked);");
  tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "save to file";

  //----------
  var download_options = download_ctrls.appendChild(document.createElement('div'));
  download_options.setAttribute('style', "margin: 2px 0px 2px 0px;");
  download_options.id = ztrack.trackID + "_download_options";
  download_options.style.display = 'none';

  //----------
  var button2 = download_ctrls.appendChild(document.createElement('input'));
  button2.setAttribute("type", "button");
  button2.setAttribute("value", "download data");
  button2.setAttribute('style', "float:right; margin: 0px 4px 4px 4px;");
  button2.setAttribute("onclick", "eedbUserReconfigParam('accept-download');");

  //-------------------------------------------
  eedbUserDownloadOptions(ztrack);
}


function eedbUserCloseDownloadPanel() {
  var main_div = document.getElementById("eedb_user_altdiv");
  if(!main_div) { return; }
  var download_panel = document.getElementById("eedb_user_track_download_panel");
  if(!download_panel) { return; }
  main_div.removeChild(download_panel);
}


function eedbUserCreateDownloadFormatSelect(ztrack) {
  var trackID = ztrack.trackID;

  var span1 = document.createElement('span');
  span1.setAttribute("style", "margin:2px 0px 2px 0px;");
  
  var span2 = document.createElement('span');
  span2.innerHTML = "download format: ";
  span1.appendChild(span2);
  
  var formatSelect = span1.appendChild(document.createElement('select'));
  formatSelect.id = trackID + "_download_format_select";
  formatSelect.setAttributeNS(null, "onchange", "eedbUserReconfigParam('download-format', this.value);");
  formatSelect.innerHTML = "";
  
  var formats = new Object;
  formats["osc"] = "osc table";
  formats["bed12"] = "bed12";
  formats["bed6"] = "bed6";
  formats["bed3"] = "bed3";
  formats["gff"] = "gff";
  //formats["wig"] = "wig";
  formats["fullxml"] = "zenbu xml";
  formats["das"] = "das xml";
  for(var format in formats) {
    var desc = formats[format];
    var option = formatSelect.appendChild(document.createElement('option'));
    option.setAttributeNS(null, "value", format);
    if(format == ztrack.download.format) {
      option.setAttributeNS(null, "selected", "selected");
    }
    option.innerHTML = desc;
  }
  return span1;
}


function eedbUserDownloadOptions(ztrack) {
  if(!ztrack) { return; }
  
  var trackID = ztrack.trackID;
  
  var download_options = document.getElementById(trackID + "_download_options");
  if(!download_options) { return; }
  
  download_options.style.display = 'none';
  
  if(!ztrack.download) { return; }
  
  if(ztrack.download.format == "osc") {
    download_options.innerHTML = "";
    download_options.style.display = "block";
    
    //-----
    var tdiv = download_options.appendChild(document.createElement('div'));
    var tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "subfeatures: ";
    
    var radio1 = tdiv.appendChild(document.createElement('input'));
    radio1.setAttribute("style", "margin-left:7px;");
    radio1.setAttribute("type", "radio");
    radio1.setAttribute("name", trackID + "_DownloadSubfeatureRadio");
    radio1.setAttribute("value", "none");
    radio1.setAttribute("onchange", "eedbUserReconfigParam('download-subfeatures', this.value);");
    if(ztrack.download.subfeatures == "none") { radio1.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "none";
    
    var radio2 = tdiv.appendChild(document.createElement('input'));
    radio2.setAttribute("style", "margin-left:7px;");
    radio2.setAttribute("type", "radio");
    radio2.setAttribute("name", trackID + "_DownloadSubfeatureRadio");
    radio2.setAttribute("value", "bed");
    radio2.setAttribute("onchange", "eedbUserReconfigParam('download-subfeatures', this.value);");
    if(ztrack.download.subfeatures == "bed") { radio2.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "bed12 blocks";
    
    var radio3 = tdiv.appendChild(document.createElement('input'));
    radio3.setAttribute("style", "margin-left:7px;");
    radio3.setAttribute("type", "radio");
    radio3.setAttribute("name", trackID + "_DownloadSubfeatureRadio");
    radio3.setAttribute("value", "cigar");
    radio3.setAttribute("onchange", "eedbUserReconfigParam('download-subfeatures', this.value);");
    if(ztrack.download.subfeatures == "cigar") { radio3.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "zenbu cigar";
    
    //-----
    tdiv = download_options.appendChild(document.createElement('div'));
    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "eedbUserReconfigParam('download-feature-metadata', this.checked);");
    if(ztrack.download.feature_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "feature metadata";
    
    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "eedbUserReconfigParam('download-experiment-metadata', this.checked);");
    if(ztrack.download.experiment_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "experiment metadata";
    
    //-----
    tdiv = download_options.appendChild(document.createElement('div'));
    tcheck = tdiv.appendChild(document.createElement('input'));
    tcheck.setAttribute('style', "margin: 0px 1px 3px 14px;");
    tcheck.setAttribute('type', "checkbox");
    tcheck.setAttribute("onclick", "eedbUserReconfigParam('download-osc-metadata', this.checked);");
    if(ztrack.download.osc_metadata) { tcheck.setAttribute('checked', "checked"); }
    tspan = tdiv.appendChild(document.createElement('span'));
    tspan.innerHTML = "oscheader metadata (skip for excel)";
  }
}


function eedbUserPostDownloadRequest(ztrack) {
  //this routine is called to initiate a full track reload with new data
  //it calls the XML webservices, gets data, then draws the track
  if(ztrack == null) { return; }
  
  var trackDiv = ztrack.trackDiv;
  if(!trackDiv) return;
  
  //trackDiv.setAttribute("style", "margin: 0px 0px -2px 0px; border-width: 0px; padding: 0px 0px 0px 0px;");
        
  var url = eedbRegionCGI;
  var paramXML = "<zenbu_query>\n";
  paramXML += "<format>"+ztrack.download.format+"</format>\n";
  paramXML += "<trackcache>"+ ztrack.hashkey +"</trackcache>\n";
  paramXML += "<track_title>"+ ztrack.trackname+"</track_title>\n";
  paramXML += "<mode>region</mode>\n";
  
  paramXML += "<export_subfeatures>"+ztrack.download.subfeatures+"</export_subfeatures>\n";
  paramXML += "<export_feature_metadata>"+ztrack.download.feature_metadata+"</export_feature_metadata>\n";
  paramXML += "<export_experiment_metadata>"+ztrack.download.experiment_metadata+"</export_experiment_metadata>\n";
  paramXML += "<export_osc_metadata>"+ztrack.download.osc_metadata+"</export_osc_metadata>\n";
    
  //later will use with new TrackCache system
  //if(ztrack.uuid) { paramXML += "<track_uuid>"+ztrack.uuid+"</track_uuid>\n"; }  
  
  paramXML += "<asm>"+ztrack.assembly+"</asm>\n";
  
  if(ztrack.download.mode == "location") {
    paramXML += "<loc>"+ztrack.download.location+"</loc>\n";
  }
  if(ztrack.download.mode == "genome") {
    paramXML += "<genome_scan>genome</genome_scan>\n";
  }
  
  if(ztrack.download.savefile) { paramXML += "<savefile>true</savefile>\n"; }
  paramXML += "</zenbu_query>\n";
  
  var form = trackDiv.appendChild(document.createElement('form'));
  form.setAttribute("method", "POST");
  form.setAttribute("target", "glyphs_download_data");
  form.setAttribute("action", eedbRegionCGI);
  form.setAttribute("enctype", "application/x-www-form-urlencoded");
  
  var input1 = form.appendChild(document.createElement('input'));
  input1.setAttribute("type", "hidden");
  input1.setAttribute("name", "POSTDATA");
  input1.setAttribute("value", paramXML);
  
  form.submit();
}


//------------------------------------------------------------------------------------------------
//
// NCBI taxon info query
//
//------------------------------------------------------------------------------------------------

function eedbUserGetNCBITaxonInfo(taxon_id) {
  //TODO: just stubs, need to make a zenbu webservice, does not allow crosssite
  //should make new webservice on zenbu do return taxon/genome info
  var url = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=taxonomy&retmode=xml&id="+taxon_id;

  eedbUserXMLHttp2.open("POST", url, false);  //run async in background
  eedbUserXMLHttp2.onreadystatechange=eedbUserPrepareQueueStatus;
  eedbUserXMLHttp2.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  eedbUserXMLHttp2.send();
}


function eedbUserParseNCBITaxonInfo() {
  //TODO: just stubs, need to make a zenbu webservice, does not allow crosssite
  if(eedbUserXMLHttp2 == null) { return; }
  if(eedbUserXMLHttp2.responseXML == null) return;
  if(eedbUserXMLHttp2.readyState!=4) return;
  if(eedbUserXMLHttp2.status!=200) { return; }
  var xmlDoc=eedbUserXMLHttp2.responseXML.documentElement;

  if(xmlDoc==null) { return; } 
 
  var genome = new Object; 
  var taxon = xmlDoc.getElementsByTagName("taxon");
  for(i=0; i<taxon.length; i++) {
    var node = taxon[i].getElementsByTagName("TaxId");
    if(node.length >0) { genome.taxon_id = node.firstChild.nodeValue; }
    if(genome.taxon_id != taxon_id) { continue; }

    node = taxon[i].getElementsByTagName("ScientificName");
    if(node.length>0) { genome.scientific_name = node.firstChild.nodeValue; }


  }
  document.getElementById("message").innerHTML += "genome ["+genome.taxon_id+" "+genome.scientific_name+"] ";
}

