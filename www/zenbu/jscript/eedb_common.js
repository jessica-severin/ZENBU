/*--------------------------------------------------------------------------
 * Software License Agreement (BSD License)
 * EdgeExpressDB [eeDB] system
 * ZENBU system
 * ZENBU eedb_common.js
 * copyright (c) 2007-2010 Jessica Severin RIKEN OSC
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *    * Neither the name of Jessica Severin RIKEN OSC nor the
 *     names of its contributors may be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *--------------------------------------------------------------------------*/


var ns4 = document.layers;
var ns6 = document.getElementById && !document.all;
var ie4 = document.all;
offsetX = 0;
offsetY = 10;
var toolTipSTYLE="";
var winW = 630, winH = 460;
var toolTipWidth = 300;
var svgNS = "http://www.w3.org/2000/svg";
var svgXlink = "http://www.w3.org/1999/xlink";
var current_user=null;
var current_error=null;
var zenbu_embedded_view = false;
var zenbu_embedded_navigation = true;

var eedbSearchCGI    = eedbWebRoot + "/cgi/eedb_search.cgi";
var eedbSearchFCGI   = eedbWebRoot + "/cgi/eedb_search.fcgi";
var eedbUserCGI      = eedbWebRoot + "/cgi/eedb_user.cgi";
var eedbUserFCGI     = eedbWebRoot + "/cgi/eedb_user.fcgi";
var eedbLoginCGI     = eedbWebRoot + "/cgi/eedb_openid_login.cgi";
var eedbUploadCGI    = eedbWebRoot + "/cgi/eedb_upload.cgi";
var eedbConfigCGI    = eedbWebRoot + "/cgi/eedb_config_server.cgi";
var eedbRegionCGI    = eedbWebRoot + "/cgi/eedb_region.cgi";

var current_collaboration = new Object;
current_collaboration.name = "private";
current_collaboration.uuid = "private";
current_collaboration.callOutFunction = null;

function eedbInitToolTips() {
  if(ns4||ns6||ie4) {
    if(ns4) toolTipSTYLE = document.toolTipLayer;
    else if(ns6) toolTipSTYLE = document.getElementById("toolTipLayer").style;
    else if(ie4) toolTipSTYLE = document.all.toolTipLayer.style;
    if(ns4) document.captureEvents(Event.MOUSEMOVE);
    else {
      toolTipSTYLE.visibility = "visible";
      toolTipSTYLE.display = "none";
    }
    document.onmousemove = moveToMouseLoc;
  }
  window.onresize = getNewWindowSize;
  getNewWindowSize();

  var versionSpan = document.getElementById("zenbuVersionSpan");
  if(versionSpan) { versionSpan.innerHTML = zenbuVersion; }
}


function moveToMouseLoc(e) { 
  var posx = 0;
  var posy = 0;
  if(!e) var e = window.event;
  if(!e) { return; }
  if(e.pageX || e.pageY) {
    posx = e.pageX;
    posy = e.pageY;
  }
  else if(e.clientX || e.clientY) {
    posx = e.clientX + document.body.scrollLeft
         + document.documentElement.scrollLeft;
    posy = e.clientY + document.body.scrollTop
         + document.documentElement.scrollTop;
  }

  var hscale = posx / winW; 
  if(hscale > 1.0) hscale=1.0;
  var adjusted_xpos = (offsetX + posx - Math.floor((toolTipWidth+10)*hscale)); 
  toolTipSTYLE.left = adjusted_xpos +'px'; 
  toolTipSTYLE.top = (posy + offsetY) +'px';
  toolTipSTYLE.xpos = posx;
  toolTipSTYLE.ypos = posy;
  toolTipSTYLE.adjusted_xpos = adjusted_xpos;
  return true;
}


function eedbClearTooltip() {
  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";
  offsetY = 10;
}


function GetXmlHttpObject() {
  var xhr=null;
  try { xhr=new XMLHttpRequest(); }// Firefox, Opera 8.0+, Safari
  catch(e) {
    try { xhr=new ActiveXObject("Msxml2.XMLHTTP"); } // Internet Explorer
    catch(e) { xhr=new ActiveXObject("Microsoft.XMLHTTP"); }
  }
  return xhr;
}


function getNewWindowSize() {
  if(parseInt(navigator.appVersion)>3) {
    if(navigator.appName.indexOf("Microsoft")!=-1) {
      winW = document.body.offsetWidth;
      winH = document.body.offsetHeight;
    } else { //should cover all other modern browsers
      winW = window.innerWidth;
      winH = window.innerHeight;
    }
  }

  // not sure how to get this dynamically
  winW -= 20; /* whatever you set your body bottom margin/padding to be */
  winH -= 20; /* whatever you set your body bottom margin/padding to be */
};


function allBrowserGetElementsByClassName(src, className) {
  if(ns4||ns6||ie4) {
    var hasClassName = new RegExp("(?:^|\\s)"+className+"(?:$|\\s)");

    var hasClassName = new RegExp("(?:^|\\s)"+className+"(?:$|\\s)");
    var allElements = src.getElementsByTagName("*");
    var results = [];
    var element;
    for(var i=0;(element=allElements[i])!=null;i++) {
      var elementClass=element.className;
      if(elementClass && elementClass.indexOf(className)!=-1 && hasClassName.test(elementClass)) {
        results.push(element);
      }
    }
    return results;
  } else {
   return src.getElementsByClassName(className);
  }
}


function browserCompatibilityCheck() {

  var ok=1;
  if (/WebKit[\/\s](\d+\.\d+)/.test(navigator.userAgent)){ //test for WebKit/x.x or WebKit x.x (ignoring remaining digits);
    var wkversion=new Number(RegExp.$1) // capture x.x portion and store as a number
    if(wkversion>=500) { ok=1; }
  }

  if (/Firefox[\/\s](\d+\.\d+)/.test(navigator.userAgent)){ //test for Firefox/x.x or Firefox x.x (ignoring remaining digits);
    var ffversion=new Number(RegExp.$1) // capture x.x portion and store as a number
    if(ffversion>=3) { ok=1; }
  }

  if(/Opera[\/\s](\d+\.\d+)/.test(navigator.userAgent)) { 
    //test for Opera/x.x or Opera x.x (ignoring remaining decimal places);
    var oprversion=new Number(RegExp.$1) // capture x.x portion and store as a number
    if(oprversion>=9) { ok=1; }
  }

  if(/MSIE (\d+\.\d+);/.test(navigator.userAgent)) { //test for MSIE x.x;
    var ieversion=new Number(RegExp.$1) // capture x.x portion and store as a number
    if(ieversion<10)  { ok=0; }
  }

  return ok;
}


function encodehtml(text) {
  if(text) {
    var textneu = text.replace(/&/g,"&amp;");
    textneu = textneu.replace(/</g,"&lt;");
    textneu = textneu.replace(/>/g,"&gt;");
    textneu = textneu.replace(/\n/g,"<br>");
    textneu = textneu.replace(/\r/g,"");
    return(textneu);
  } else { return ""; }

  /*
  if(!String.prototype.decodeHTML) {
    String.prototype.decodeHTML = function () {
      return this.replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
    };
  }
   "", '&quot;'
   '', '&apos;'
   */
}


function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
 });
}


// remove multiple, leading or trailing spaces in string
function trim_string(s) {
  if(!s) { return ""; }
  s = s.replace(/(^\s*)|(\s*$)/gi,"");
  s = s.replace(/[ ]{2,}/gi," ");
  s = s.replace(/\n /,"\n");
  return s;
}


function clearKids(obj) {
  var count=0;
  while(obj.firstChild) {
    //The list is LIVE so it will re-index each call
    obj.removeChild(obj.firstChild);
    count++;
  }
  //document.getElementById("message").innerHTML= "cleared " +count+ " elements"; 
}


function createUUID() {
    var s = [];
    var hexDigits = "0123456789ABCDEF";
    for (var i = 0; i < 32; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[12] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01

    var uuid = s.join("");
    return uuid;
}


function zenbuGenerateUUID() {
  //uses webservices to generate UUID server-side
  var url = eedbConfigCGI + "?mode=validate_uuid";
  var uuid = createUUID();  //backup use the javascript Rand code
  
  var saveConfigXHR=GetXmlHttpObject();
  saveConfigXHR.open("GET", url, false);  //synchronous
  saveConfigXHR.send(null);

  if(saveConfigXHR.readyState!=4) return uuid;
  if(saveConfigXHR.status!=200) { return uuid; }
  if(saveConfigXHR.responseXML == null) { return uuid; }

  var xmlDoc=saveConfigXHR.responseXML.documentElement;
  if(xmlDoc==null) { return uuid; }
  
  var xml_uuid = xmlDoc.getElementsByTagName("config_uuid");
  var xml_validation = xmlDoc.getElementsByTagName("validation_status");

  if(xml_uuid && xml_uuid.length>0 && xml_validation && xml_validation.length>0) {
    var validation = xml_validation[0].firstChild.nodeValue;
    var t_uuid = xml_uuid[0].firstChild.nodeValue;
    if(validation == "autogen_uuid") { uuid = t_uuid; }
  }
  return uuid;
}


function setCookie(c_name,value, exdays) {
  //document.getElementById("message").innerHTML = " cookies[" +document.cookie+"]";
  var exdate=new Date();
  exdate.setDate(exdate.getDate() + exdays);
  var c_value=escape(value) + ((exdays==null) ? "" : "; path=/; expires="+exdate.toUTCString());
  document.cookie = c_name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/';
  document.cookie = c_name + "=" + c_value;
  //document.getElementById("message").innerHTML = "cookie[" +document.cookie+"]";
}


function getCookie(c_name) {
  var i,x,y,ARRcookies=document.cookie.split(";");
  for (i=0;i<ARRcookies.length;i++) {
    x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
    y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
    x=x.replace(/^\s+|\s+$/g,"");
    if (x==c_name) {
      return unescape(y);
    }
  }
}

function numberWithCommas(x) {
  if(!x) { return ""; }
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function zenbuRedirect(newurl) {
  window.open(newurl, "_blank");
}


function zenbuParseLocation(query) {
  var region = new Object();
  region.asm     = "";
  region.chrom   = "";
  region.start   = -1;
  region.end     = -1;
  region.strand  = "";

  var rtnval = false;

  //first remove leading and trailing spaces
  var match1 = /^(\s*)(.+)(\s*)$/.exec(query);
  if(match1 && (match1.length == 4)) { 
    query = match1[2]; 
  }

  //look for assembly is <asm>:: pattern
  var asm_match = /^([\w-._]+)\:\:(.+)$/.exec(query);
  if(asm_match && (asm_match.length == 3)) {
    region.asm = asm_match[1];
    query = asm_match[2];
  }

  var mymatch = /^([\w-._]+)\:(\d+)\.\.(\d+)([+-]*)$/.exec(query);
  if(mymatch && (mymatch.length >= 4)) {
    rtnval = true;
    region.chrom = mymatch[1];
    region.start = Math.floor(mymatch[2]);
    region.end   = Math.floor(mymatch[3]);
    if(mymatch.length==5) {
      if(mymatch[4] == "-") { region.strand = "-"; }
      if(mymatch[4] == "+") { region.strand = "+"; }
    }
    query = "";
  }

  var mymatch = /^([\w-._]+)\:(\d+)\-(\d+)([+-]*)$/.exec(query);
  if(mymatch && (mymatch.length >= 4)) {
    rtnval = true;
    region.chrom = mymatch[1];
    region.start = Math.floor(mymatch[2]);
    region.end   = Math.floor(mymatch[3]);
    if(mymatch.length==5) {
      if(mymatch[4] == "-") { region.strand = "-"; }
      if(mymatch[4] == "+") { region.strand = ";"; }
    }
    query = "";
  }

  var mymatch = /^([\w-._]+)\:$/.exec(query);
  if(mymatch && (mymatch.length >= 2)) {
    rtnval = true;
    region.chrom = mymatch[1];
    query = "";
  }

  var mymatch = /chr(\w+)/.exec(query);
  if(!rtnval && mymatch && (mymatch.length == 2)) {
    var toks = query.split(/[\s\:\.\-]/);
    var num1, num2;
    for(var i=0; i<toks.length; i++) {
      var tok = toks[i];
      if(!tok) { continue; }

      var match2 = /^chr(\w+)/.exec(tok);
      if(match2 && match2.length==2) {
        region.chrom = "chr"+match2[1];
	rtnval=true;
      }
      if(/\,/.test(tok)) { tok = tok.replace(/\,/g, ""); }
      if(/^(\d+)$/.test(tok)) {
        if(num1 === undefined) { num1 = Math.floor(tok); }
	else { num2 = Math.floor(tok); }
      }
    }
  }

  if(region.end<region.start) {
    var t = region.start;
    region.start = region.end;
    region.end = t;
  }

  if(rtnval) { return region; }
  return undefined;
}


//==================================================
//
// user login
//
//==================================================

function eedbShowLogin() {
  var user = eedbGetCurrentUser();

  var login_div = document.getElementById("eedb_login_div");
  if(login_div === undefined) { return user; }
  if(!login_div) { return user; }

  if(zenbu_embedded_view) { return user; }

  //build the interface
  login_div.setAttribute("style",
                         "text-align:right; margin-bottom:3px; font-size:12px; font-family:arial,helvetica,sans-serif; float:right; "
                         );
  login_div.innerHTML = "";

  var name_span = document.createElement("span");
  name_span.setAttribute("style", "font-weight:bold; color:black;");
  login_div.appendChild(name_span);
  name_span.innerHTML = "guest";

  var spacer = login_div.appendChild(document.createElement("span"));
  spacer.innerHTML = "|";
  spacer.setAttribute("style", "margin-left:5px; margin-right:5px;");

  var signin_span = login_div.appendChild(document.createElement("a"));
  signin_span.setAttribute("href", "./");
  signin_span.setAttribute("style", "text-decoration:underline; color:rgb(92,69,46);");
  signin_span.innerHTML ="Sign in";

  if(user!=null) {
    signin_span.innerHTML ="Sign out";
    signin_span.setAttribute("onclick", "eedbLoginAction('logout');return false");
    name_span.innerHTML="";
    name_link = name_span.appendChild(document.createElement("a"));
    name_link.setAttribute("href", eedbWebRoot+"/user#section=profile");
    name_link.setAttribute("style", "text-decoration:none; color:black;");
    if(user.nickname) { name_link.innerHTML = user.nickname; }
    else if(user.email) { name_link.innerHTML = user.email; }
    else { name_link.innerHTML = user.openID; }
    if(!user.email) { 
      zenbuValidateEmailPanel();
      //goto the login page with page redirect
      var currentURL = document.URL;
      if(/\/user\//.exec(currentURL) == null) {
        window.location = eedbWebRoot + "/user#section=validate";
      }
    }
  } else {
    signin_span.innerHTML ="Sign in";
    signin_span.setAttribute("onclick", "eedbLoginAction('login');return false");
  }
  
  if(current_user && current_user.no_password) { zenbuResetPasswordPanel(); }

  return user;
}


function eedbLoginAction(param, value) {
  if(param == "login") {
    //goto the login page with page redirect
    //window.location = eedbWebRoot + "/user";
    zenbuUserLoginPanel();
  }
  if(param == "logout") {
    eedbLogoutCurrentUser();
    eedbShowLogin();
    location.reload();
  }
}


function eedbLogoutCurrentUser() {
  var url = eedbUserFCGI + "?mode=logout";

  var userXHR=GetXmlHttpObject();
  if(userXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  userXHR.open("GET",url,false);
  userXHR.send(null);
  if(window.eedbLoginChanged) { eedbLoginChanged(); }
  return null;
}


function eedbGetCurrentUser() {
  current_user = null;
  var url = eedbUserFCGI + "?mode=user";

  var userXHR=GetXmlHttpObject();
  if(userXHR==null) {
    alert ("Your browser does not support AJAX!");
    return null;
  }
  userXHR.open("GET",url,false);
  userXHR.send(null);
  if(userXHR.readyState!=4) return null;
  if(userXHR.responseXML == null) return null;
  var xmlDoc=userXHR.responseXML.documentElement;
  if(xmlDoc==null)  return null;
  var userXML = xmlDoc.getElementsByTagName("eedb_user")[0];
  current_user = eedbParseUserXML(userXML);

  return current_user;
}


function eedbParseUserXML(userXML) {
  if(userXML) {
    var user = new Object;
    user.openID = "";
    //user.openID = userXML.getAttribute("openID");
    user.email = userXML.getAttribute("valid_email");
    user.nickname = userXML.getAttribute("nickname");
    if(userXML.getAttribute("member_status")) {
      user.member_status = userXML.getAttribute("member_status");
    }
    if(userXML.getAttribute("status")) {
      user.member_status = userXML.getAttribute("status");
    }

    var syms = userXML.getElementsByTagName("symbol");
    var mdata = userXML.getElementsByTagName("mdata");
    for(var j=0; j<syms.length; j++) {
      if(syms[j].getAttribute("type")=="openid:fullname")   { user.fullname = syms[j].getAttribute("value"); }
      if(syms[j].getAttribute("type")=="openid:country")    { user.country  = syms[j].getAttribute("value"); }
      if(syms[j].getAttribute("type")=="openid:language")   { user.language = syms[j].getAttribute("value"); }
      if(syms[j].getAttribute("type")=="openid:timezone")   { user.timezone = syms[j].getAttribute("value"); }
      if(syms[j].getAttribute("type")=="openid:gender")     { user.gender   = syms[j].getAttribute("value"); }
      if(syms[j].getAttribute("type")=="openid:dob")        { user.dob      = syms[j].getAttribute("value"); }
    }
    for(var j=0; j<mdata.length; j++) {
      if(mdata[j].getAttribute("type")=="uuid" && (mdata[j].firstChild)) { user.uuid = mdata[j].firstChild.nodeValue; }
      if(mdata[j].getAttribute("type")=="user_registry" && (mdata[j].firstChild)) { user.registry = mdata[j].firstChild.nodeValue; }
    }

    user.openid_array = new Array;
    var openIDs = userXML.getElementsByTagName("openid");
    for(var j=0; j<openIDs.length; j++) {
      var openID = openIDs[j].firstChild.nodeValue;
      user.openid_array.push(openID);
    }

    var hmac = userXML.getElementsByTagName("hmac_secretkey");
    if(hmac && (hmac.length>0)) { user.hmackey = hmac[0].firstChild.nodeValue; }

    user.no_password = false;
    var no_pass = userXML.getElementsByTagName("no_password");
    if(no_pass && (no_pass.length>0)) { 
      user.no_password = true; 
      console.log("user: "+ user.email +" has no password");
    }
    
    return  user;
  }
  return null;
}

//-----------------------------------------------------------------------

function zenbuRegisterCurrentURL() {
  //register the currentURL for redirect later
  var currentURL = document.URL;

  var paramXML = "<zenbu_query><mode>user</mode>";
  paramXML += "<last_url>" + currentURL + "</last_url>";
  paramXML += "</zenbu_query>";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserFCGI, true);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
}


function zenbuUserLoginPanel() {
  var login_div = document.getElementById("eedb_login_div");
  if(login_div === undefined) { return; }

  var login_panel = document.getElementById("zenbu_login_panel");
  if(login_panel) { return; }
  
  var e = window.event
  toolTipWidth=800;
  moveToMouseLoc(e);

  zenbuRegisterCurrentURL();

  login_panel = login_div.appendChild(document.createElement('div'));
  login_panel.id = "zenbu_login_panel";
  login_panel.setAttribute('style', "position:absolute; background-color:#f0f0f7; text-align:left; "+
                            "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                            "z-index:1; top:180px; width:800px; height:300px;"+
                            "left:" + ((winW/2)-400) +"px; "
                            );
  login_panel.innerHTML = "";
  
  // title
  var div1 = login_panel.appendChild(document.createElement('div'));
  div1.setAttribute("style", "font-weight:bold; font-size:16px; margin-top:5px; ");
  
  // close button
  var a1 = div1.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "zenbuCloseUserLoginPanel();return false");
  a1.setAttribute("style", "float: right;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px_gray.png");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  span1 = div1.appendChild(document.createElement('span'));
  span1.innerHTML = "Welcome to ZENBU : User Login";
  

  var table1 = login_panel.appendChild(document.createElement('table'));
  //table1.setAttribute("border", "2");
  table1.setAttribute("width", "100%");
  var tbody = table1.appendChild(document.createElement('tbody'));
  var tr0 = tbody.appendChild(document.createElement('tr'));

  //login email/password left side
  var td0 = tr0.appendChild(document.createElement('td'));
  td0.setAttribute("width","50%");

  //<form id="bridgeForm" action="#" target="loginframe" autocomplete="on">
  //  <input type="text" name="username" id="username" />
  //  <input type="password" name="password" id="password"/>
  //</form>

  var form2 = td0.appendChild(document.createElement('form'));
  form2.setAttribute("autocomplete", "on");
  form2.setAttribute("action", "#");
  form2.id = "zenbu_login_form";

  var div2 = form2.appendChild(document.createElement('div'));
  div2.setAttribute("style", "margin-bottom:3px;");
  var span1 = div2.appendChild(document.createElement('label'));
  span1.setAttribute("style", "width:110px; display:inline-block;");
  span1.innerHTML = "email address :";
  span1 = div2.appendChild(document.createElement('span'));
  var input1 = span1.appendChild(document.createElement('input'));
  input1.id  = "user_login_panel_email";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "email");
  //input1.setAttribute("autocomplete", "on");
  input1.setAttribute("size", "40");
  input1.setAttribute("style", "width:250px;");

  div2 = form2.appendChild(document.createElement('div'));
  div2.setAttribute("style", "margin-bottom:5px;");
  span1 = div2.appendChild(document.createElement('span'));
  span1.setAttribute("style", "width:110px; display:inline-block;");
  span1.innerHTML = "password :";
  span1 = div2.appendChild(document.createElement('span'));
  span1.setAttribute("style", "padding-right:5px;");
  var input1 = span1.appendChild(document.createElement('input'));
  input1.id  = "user_login_panel_password";
  input1.setAttribute("type", "password");
  input1.setAttribute("name", "password");  
  //input1.setAttribute("autocomplete", "on");
  input1.setAttribute("size", "40");
  input1.setAttribute("style", "width:250px;");
  input1.setAttribute("onkeyup", "if(event && event.which == 13) { zenbuSubmitPasswordLogin(); }");

  div2 = form2.appendChild(document.createElement('div'));
  div2.setAttribute("style", "text-align:center; border:1px;");

  var button = div2.appendChild(document.createElement('button'));
  button.setAttribute("style", "font-size:14px; padding: 1px 4px; align:center; width:150px; margin-left:5px; margin-right:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("type", "button");
  button.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  button.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  button.setAttribute("onclick", "zenbuSubmitPasswordLogin();");
  button.innerHTML ="log in";

  a1 = div2.appendChild(document.createElement('a'));
  a1.setAttribute("href", "./");
  a1.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-left:15px;");
  a1.setAttribute("onclick", "zenbuForgotPasswordPanel(); return false;");
  a1.innerHTML ="Forgot your password?";

  //new user right side
  var td2 = tr0.appendChild(document.createElement('td'));
  td2.setAttribute("width","50%");
  td2.setAttribute("rowspan", "3");
  td2.setAttribute("style", "border-left:2pt dotted gray; padding-left:10px;");

  var div2 = td2.appendChild(document.createElement('div'));
  var span2 = div2.appendChild(document.createElement('span'));
  span2.setAttribute("style", "font-size:12px; font-weight:bold;");
  span2.innerHTML = "New user?";
  var button = div2.appendChild(document.createElement('button'));
  button.setAttribute("style", "font-size:12px; padding: 1px 4px; align:center; width:150px; margin-left:15px; margin-right:5px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "zenbuNewUserCreatePanel();");
  button.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  button.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  button.innerHTML ="register new account";


  var div3 = td2.appendChild(document.createElement('div'));
  div3.setAttribute("style", "margin-top:5px; font-size:10px;");
  var div3b = div3.appendChild(document.createElement('div'));
  div3b.innerHTML = "ZENBU user accounts provide additional features not available with guest accounts";
  var ul1 = div3.appendChild(document.createElement('ul'));
  ul1.setAttribute("style", "margin-top:0px; font-size:10px;");
  var li = ul1.appendChild(document.createElement('li'));
  li.innerHTML = "secured data sharing for research collaboration projects";
  li = ul1.appendChild(document.createElement('li'));
  li.innerHTML = "user data upload capability";
  li = ul1.appendChild(document.createElement('li'));
  li.innerHTML = "private configurations not published to the general public";


  //
  // old openID login
  //
  login_panel.appendChild(document.createElement('hr'));
  var div4 = login_panel.appendChild(document.createElement('div'));
  div4.setAttribute("style", "margin:10px 0px 10px 0px;");
  div4.innerHTML = "Alternatively you can sign in with your previously registered <a target='top' style='color:blue; font-weight:bold;' href='http://openid.net/get-an-openid/'>OpenID</a> account.";
  
  var divRow, divCell, cellA, cellButton, cellImg, cellMsg;
  
  var table = login_panel.appendChild(document.createElement('table'));
  table.setAttribute("style", "margin-left:10px; padding: 0; font-size:10px;");
  
  divRow = table.appendChild(document.createElement('tr'));
  
  divCell = divRow.appendChild(document.createElement('td'));
  cellA = divCell.appendChild(document.createElement('a'));
  cellA.setAttribute("href", eedbLoginCGI+"?user_query=me.yahoo.com");
  cellButton = cellA.appendChild(document.createElement('button'));
  cellButton.setAttribute("style", "padding: 1px 4px; margin:1px 5px; align:center; width:100px; height:35px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  cellButton.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  cellButton.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  cellImg = cellButton.appendChild(document.createElement('img'));
  cellImg.setAttribute("src", "http://openid.net/wp-content/uploads/2009/11/yahoo.png");
  cellImg.setAttribute("width", "70px");
  cellImg.setAttribute("alt","Yahoo");

  divCell = divRow.appendChild(document.createElement('td'));
  cellA = divCell.appendChild(document.createElement('a'));
  cellA.setAttribute("href", eedbLoginCGI+"?user_query=yahoo.co.jp");
  cellButton = cellA.appendChild(document.createElement('button'));
  cellButton.setAttribute("style", "padding: 1px 4px; margin:1px 5px; align:center; width:100px; height:35px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  cellButton.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  cellButton.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  cellImg = cellButton.appendChild(document.createElement('img'));
  cellImg.setAttribute("src", "http://openid.net/wp-content/uploads/2009/11/yahoo-jp.png");
  cellImg.setAttribute("width", "70px");
  cellImg.setAttribute("alt","Yahoo! Japan");
  
  //divCell = divRow.appendChild(document.createElement('td'));
  //divCell.setAttribute("style", "width:100px; margin:10px;");
  //cellA = divCell.appendChild(document.createElement('a'));
  //cellA.setAttribute("href", eedbLoginCGI+"?user_query=mixi.jp");
  //cellButton = cellA.appendChild(document.createElement('button'));
  //cellButton.setAttribute("style", "padding: 1px 4px; margin:1px 5px; align:center; width:100px; height:35px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //cellButton.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  //cellButton.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  //cellImg = cellButton.appendChild(document.createElement('img'));
  //cellImg.setAttribute("src", "http://openid.net/wp-content/uploads/2009/11/mixi_jp.png");
  //cellImg.setAttribute("width", "70px");
  //cellImg.setAttribute("alt","mixi.jp");
  
  divCell = divRow.appendChild(document.createElement('td'));
  cellA = divCell.appendChild(document.createElement('a'));
  cellA.setAttribute("href", eedbLoginCGI+"?user_query=pip.verisignlabs.com");
  cellButton = cellA.appendChild(document.createElement('button'));
  cellButton.setAttribute("style", "padding: 1px 4px; margin:1px 5px; align:center; width:100px; height:35px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  cellButton.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  cellButton.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  cellImg = cellButton.appendChild(document.createElement('img'));
  cellImg.setAttribute("src", "/zenbu/images/symantec-verisign.png");
  cellImg.setAttribute("width", "70px");
  cellImg.setAttribute("alt","verisign");

  //divCell = divRow.appendChild(document.createElement('td'));
  //cellA = divCell.appendChild(document.createElement('a'));
  //cellA.setAttribute("href", eedbLoginCGI+"?user_query=https://www.google.com/accounts/o8/id");
  //cellButton = cellA.appendChild(document.createElement('button'));
  //cellButton.setAttribute("style", "padding: 1px 4px; margin:1px 5px; align:center; width:100px; height:35px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  //cellButton.setAttribute("onMouseOver", "this.style.background='#CCCCCC';");
  //cellButton.setAttribute("onMouseOut", "this.style.background='#EEEEEE';");
  //cellImg = cellButton.appendChild(document.createElement('img'));
  //cellImg.setAttribute("src", "http://openid.net/images/get-logos/google.png");
  //cellImg.setAttribute("width", "70px");
  //cellImg.setAttribute("alt","google");
  
  
  var form = login_panel.appendChild(document.createElement('form'));
  form.id = "form";
  form.setAttribute("method", "post");
  form.setAttribute("action", eedbLoginCGI);
  
  var div1 = form.appendChild(document.createElement('div'));
  div1.setAttribute("style", "margin-bottom:10px; margin-left:45px;");
  
  var span1 = div1.appendChild(document.createElement('span'));
  span1.innerHTML = "OpenID: ";
  
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "user_query";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "user_query");
  input1.setAttribute("size", "50");
  
  var input2 = div1.appendChild(document.createElement('input'));
  input2.id  = "submit-button";
  input2.setAttribute("type", "submit");
  input2.setAttribute("value", "Continue");
  
  div4 = login_panel.appendChild(document.createElement('div'));
  div4.setAttribute("style", "margin:10px 0px 10px 0px; font-size:12px;");
  span1 = div4.appendChild(document.createElement('span'));
  span1.setAttribute("style", "color:red");
  span1.innerHTML = "Notice: ";
  span1 = div4.appendChild(document.createElement('span'));
  span1.innerHTML = "<a href='https://www.myopenid.com/'>myopenid</a> shut down their services on February 1st 2014. Google has also shutdown their OpenID service in March of 2015.<br>For all previous myopenID users, please either create a new account or contact [jessica.severin{at}riken.jp] to help with converting your old account.";

  if(current_error) {
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:15px; font-weight:bold; font-size:12px; color:#CC1010;");
    div1.innerHTML = current_error.message;
  }
}


function zenbuCloseUserLoginPanel() {
  var login_div = document.getElementById("eedb_login_div");
  if(!login_div) { return; }
  var login_panel = document.getElementById("zenbu_login_panel");
  if(!login_panel) { return; }
    
  login_div.removeChild(login_panel);
  current_error = null;
  location.reload();
}


//----------------------------------------------

function zenbuNewUserCreatePanel() {
  var login_panel = document.getElementById("zenbu_login_panel");
  if(!login_panel) { return; }

  login_panel.innerHTML = "";

  // title
  var div1 = login_panel.appendChild(document.createElement('div'));
  div1.setAttribute("style", "font-weight:bold; font-size:16px; margin-top:5px; ");
  div1.innerHTML = "Welcome to ZENBU : Create New User Account";

  // close button
  var a1 = div1.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "zenbuCloseUserLoginPanel();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");


  div1 = login_panel.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 10px 0px; text-decoration:none; font-size:12px;");
  div1.innerHTML = "New user account creation";
  div1.innerHTML +="<br>Please enter your email and we will send you a validation link back to zenbu to complete the process.";
  //div1.innerHTML +="  This will allow other users to identify you by your email.";
  
  div1 = login_panel.appendChild(document.createElement('div'));
  var label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:none; color:black;");
  label1.innerHTML = "email: ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "zenbu_user_profile_email";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "email");
  input1.setAttribute("size", "40");
  
  var button = div1.appendChild(document.createElement('button'));
  button.setAttribute('style', "margin: 0px 0px 0px 10px;");
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "zenbuSubmitNewUserCreate();");
  button.innerHTML ="send validation email";

  if(current_error) {
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:15px; font-weight:bold; font-size:12px; color:#CC1010;");
    div1.innerHTML = current_error.message;
  }

  if(login_panel.already_exists) {
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:15px;");
    span1 = div1.appendChild(document.createElement('span'));
    span1.setAttribute("style", "font-weight:bold; font-size:12px; color:#CC1010;");
    span1.innerHTML = "that email is already registered.";
    //span1.innerHTML = "that email is already registered. Did you forget your password?";

    a1 = div1.appendChild(document.createElement('a'));
    a1.setAttribute("href", "./");
    a1.setAttribute("style", "font-size:12px; padding: 1px 4px; margin-right:15px;");
    a1.setAttribute("onclick", "zenbuForgotPasswordPanel(); return false;");
    a1.innerHTML ="Did you forget your password?";

    /*
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:5px; font-size:12px; ");
    div1.innerHTML = "would you like to reset the password for [" + login_panel.prev_email + "]";

    var button = div1.appendChild(document.createElement('button'));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.4); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onclick", "zenbuSubmitForgotPassword(\""+login_panel.prev_email+"\");");
    button.innerHTML ="send reset password email";
    */
  }
  if(login_panel.validation_sent) {
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:15px; font-weight:bold; font-size:12px;");
    div1.innerHTML = "validation email sent to your email address. Please click the link sent in the email to activate your account and set your password.";
  }
}


function zenbuForgotPasswordPanel() {
  var login_panel = document.getElementById("zenbu_login_panel");
  if(!login_panel) { return; }

  login_panel.innerHTML = "";

  // title
  var div1 = login_panel.appendChild(document.createElement('div'));
  div1.setAttribute("style", "font-weight:bold; font-size:16px; margin-top:5px; ");
  div1.innerHTML = "ZENBU : User account recovery";

  // close button
  var a1 = div1.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  a1.setAttribute("onclick", "zenbuCloseUserLoginPanel();return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");


  div1 = login_panel.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 10px 0px; text-decoration:none; font-size:12px;");
  div1.innerHTML ="<br>Please enter your email and we will send you an email with a validation code to reset your forgotten password.";
  //div1.innerHTML +="  This will allow other users to identify you by your email.";
  
  div1 = login_panel.appendChild(document.createElement('div'));
  var label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:none; color:black;");
  label1.innerHTML = "email: ";
  var input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "zenbu_user_profile_email";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "email");
  input1.setAttribute("size", "40");
  if(login_panel.validation_sent) {
    input1.value = login_panel.validation_email;
    input1.setAttribute("disabled", "true");
  } else {
    var button = div1.appendChild(document.createElement('button'));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onclick", "zenbuSubmitForgotPassword();");
    button.innerHTML ="send reset password email";
  }

  if(current_error) {
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:15px; font-weight:bold; font-size:12px; color:#CC1010;");
    div1.innerHTML = current_error.message;
  }

  if(login_panel.validation_sent) {
    div1 = login_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "margin-top:15px; font-size:12px;");
    //div1.innerHTML = "validation email sent to your email address. Please click the link sent in the email to activate your account and set your password.";
    div1.innerHTML = "validation email sent to your email address. <br> Please click the link sent in the email or enter the <b>validation code</b> sent in the email to activate your account and set your password.";

    div1 = login_panel.appendChild(document.createElement('div'));
    var label1 = div1.appendChild(document.createElement('label'));
    label1.setAttribute("style", "font-weight:none; color:black;");
    label1.innerHTML = "validation code: ";
    var input1 = div1.appendChild(document.createElement('input'));
    input1.id  = "zenbu_user_profile_valid_code";
    input1.setAttribute("type", "text");
    input1.setAttribute("name", "valid_code");
    input1.setAttribute("size", "40");
  
    var button = div1.appendChild(document.createElement('button'));
    button.setAttribute("style", "font-size:10px; padding: 1px 4px; margin-left:15px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
    button.setAttribute("type", "button");
    button.setAttribute("onclick", "zenbuSendEmailValidationCheck();");
    button.innerHTML ="validate";
  }
}


function zenbuSubmitNewUserCreate() {
  current_error = null;
  var email_input    = document.getElementById("zenbu_user_profile_email");
  if(!email_input) { zenbuNewUserCreatePanel(); return; }
  var email = email_input.value;
  if(!email) { 
    current_error = new Object;
    current_error.message = "please enter an email address";
    zenbuNewUserCreatePanel(); 
    return; 
  }

  var login_panel = document.getElementById("zenbu_login_panel");

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>create_user</mode>\n";
  paramXML += "<profile_email>"+ email +"</profile_email>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  if(xhr.readyState!=4) return;
  if(xhr.responseXML == null) return;
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null)  return;
  var errorXML = xmlDoc.getElementsByTagName("ERROR");
  if(errorXML.length>0) {
    var msg = errorXML[0].firstChild.nodeValue;
    if(msg == "email_exists") {
      //current_error.message = "that email is already registered. Did you forget your password?";
      if(login_panel) { 
        login_panel.already_exists = true; 
        login_panel.prev_email = email; 
      }
    } else {
      current_error = new Object;
      current_error.message = msg;
    }
    zenbuNewUserCreatePanel(); 
    return; 
  }

  //zenbuCloseUserLoginPanel();
  if(login_panel) { login_panel.validation_sent = true; }
  zenbuNewUserCreatePanel(); 
}


function zenbuSubmitForgotPassword(email) {
  current_error = null;

  var email_input = document.getElementById("zenbu_user_profile_email");
  if(!email && email_input) { 
    email = email_input.value;
  }

  if(!email) { 
    current_error = new Object;
    current_error.message = "please enter an email address";
    zenbuForgotPasswordPanel(); 
    return; 
  }

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>forgot_password</mode>\n";
  paramXML += "<profile_email>"+ email +"</profile_email>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  var login_panel = document.getElementById("zenbu_login_panel");
  if(login_panel) { 
    login_panel.validation_sent = true; 
    login_panel.validation_email = email; 
  }
  zenbuForgotPasswordPanel(); 
}


function zenbuSendEmailValidationCheck(email, valid_code) {
  current_error = null;

  var email_input = document.getElementById("zenbu_user_profile_email");
  if(!email && email_input) { 
    email = email_input.value;
  }

  if(!email) { 
    current_error = new Object;
    current_error.message = "please enter an email address";
    zenbuForgotPasswordPanel(); 
    return; 
  }
  console.log("validate email ["+email+"]");

  var valid_code_input = document.getElementById("zenbu_user_profile_valid_code");
  if(!valid_code && valid_code_input) { 
    valid_code = valid_code_input.value;
  }
  console.log("validate email ["+email+"] code["+valid_code+"]");

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>validate</mode>\n";
  paramXML += "<profile_email>"+ email +"</profile_email>";
  paramXML += "<valid_code>"+ valid_code +"</valid_code>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  var login_panel = document.getElementById("zenbu_login_panel");
  if(login_panel) { login_panel.validation_sent = true; }
  //zenbuForgotPasswordPanel(); 

  location.reload();
}

//----------------------------------------------

function zenbuResetPasswordPanel() {
  var main_div = document.getElementById("eedb_login_div");
  if(!main_div) { return; }
  if(!current_user) { return; }
  if(!current_user.email) { return; }
  
  var reset_panel = document.getElementById("zenbu_reset_password_panel");
  if(!reset_panel) {
    reset_panel = main_div.appendChild(document.createElement('div'));
    reset_panel.id = "zenbu_reset_password_panel";
    reset_panel.setAttribute('style', "position:absolute; background-color:#e0f0ec; text-align:left; "+
                          "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                          "z-index:1; top:180px; width:520px;"+
                          "left:" + ((winW/2)-260) +"px; "
                          );
  }

  var tdiv, tspan, tinput, ta;
  reset_panel.innerHTML = "";

  // title
  var tdiv = reset_panel.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : change password";

  // close button
  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./#section=uploads");
  //a1.setAttribute("onclick", "eedbUserCloseNewUploadPanel();return false");
  //a1.setAttribute("onclick", "document.getElementById('eedb_user_altdiv').innerHTML=''; location.reload(); return false");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var div1, form, label1, input1, text1, span1;

  var table1 = reset_panel.appendChild(document.createElement('table'));
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
  input1.setAttribute("onkeyup", "zenbuResetPasswordCheck();");
  td2 = tr1.appendChild(document.createElement('td'));
  div2 = td2.appendChild(document.createElement('div'));
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
  input1.setAttribute("onkeyup", "zenbuResetPasswordCheck();");
  td2 = tr1.appendChild(document.createElement('td'));
  div2 = td2.appendChild(document.createElement('div'));
  div2.id = "zenbu_user_reset_password_match"; 
  div2.innerHTML ="";

  div1 = reset_panel.appendChild(document.createElement('div'));
  button = div1.appendChild(document.createElement('button'));
  button.id  = "zenbu_user_reset_password_button";
  button.setAttribute("style", "width:300px; font-size:12px; padding: 1px 4px; margin:10px 0px 15px 100px; border-radius: 5px; border: solid 1px #20538D; background: #EEEEEE; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 1px rgba(0, 0, 0, 0.2); ");
  button.setAttribute("type", "button");
  button.setAttribute("disabled", "disabled");
  button.setAttribute("onclick", "zenbuResetPasswordSubmit();");
  button.innerHTML ="set password";

  if(current_error) { 
    div1 = reset_panel.appendChild(document.createElement('div'));
    div1.setAttribute("style", "font-weight:bold; color:#B22222;");
    div1.innerHTML = current_error.message;
  }
}


function zenbuResetPasswordCheck() {
  current_error = {};
    
  var input1 = document.getElementById("zenbu_user_reset_password_new1");
  var input2 = document.getElementById("zenbu_user_reset_password_new2");
  if(!input1 || !input2) { zenbuResetPasswordPanel(); return; }

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


function zenbuResetPasswordSubmit() {
  current_error = {};
  var input1 = document.getElementById("zenbu_user_reset_password_new1");
  var input2 = document.getElementById("zenbu_user_reset_password_new2");
  if(!input1 || !input2) { zenbuResetPasswordPanel(); return; }

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
    
  current_error.message = "problem reseting password, please try again";
  if(xhr.readyState!=4) { return zenbuResetPasswordPanel(); }
  if(xhr.responseXML == null) { return zenbuResetPasswordPanel(); }
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null) { return zenbuResetPasswordPanel(); } 
  var errorXML = xmlDoc.getElementsByTagName("ERROR");
  if(errorXML.length>0) {
    var msg = errorXML[0].firstChild.nodeValue;
    if(msg == "email_exists") {
      current_error.message = "that email is already registered, please login or pick a different email";
    } else {
      current_error.message = msg;
    }
    return zenbuResetPasswordPanel();
  }

  //OK
  //current_error.message = "";
  current_error = null;
  eedbShowLogin();
}


//----------------------------------------------


function zenbuValidateEmailPanel() {
  var main_div = document.getElementById("eedb_login_div");
  if(!main_div) { return; }
  if(!current_user) { return; }
  
  var divFrame = document.getElementById("zenbu_email_validate_panel");
  if(divFrame) { return; }  //panel already active
  
  var tdiv, tspan, tinput, ta;
  divFrame = main_div.appendChild(document.createElement('div'));
  divFrame.id = "zenbu_email_validate_panel";
  divFrame.setAttribute('style', "position:absolute; background-color:#e0f0ec; text-align:left; "+
                        "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                        "z-index:1; top:180px; width:560px;"+
                        "left:" + ((winW/2)-280) +"px; "
                        );
  divFrame.innerHTML = "";
  
  // title
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : validate user email address";
  
  var div1, form, label1, input1, text1, span1;
  div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 10px 0px; text-decoration:none; font-size:12px;");
  div1.innerHTML ="ZENBU has switched to use verified emails to identify individual users.";
  div1.innerHTML +="<br>Please enter your email and we will send you a validation link back to zenbu to complete the process.";
  //div1.innerHTML +="  This will allow other users to identify you by your email.";
  
  
  div1 = divFrame.appendChild(document.createElement('div'));
  label1 = div1.appendChild(document.createElement('label'));
  label1.setAttribute("style", "font-weight:none; color:black;");
  label1.innerHTML = "email: ";
  input1 = div1.appendChild(document.createElement('input'));
  input1.id  = "zenbu_user_profile_email";
  input1.setAttribute("type", "text");
  input1.setAttribute("name", "email");
  input1.setAttribute("size", "40");
  if(current_user && current_user.email) { input1.setAttribute("value", current_user.email); }
  
  button = div1.appendChild(document.createElement('button'));
  button.setAttribute('style', "margin: 0px 0px 0px 10px;");
  button.setAttribute("type", "button");
  button.setAttribute("onclick", "zenbuSubmitEmailValidation();");
  button.innerHTML ="send validation email";

  div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 15px 0px 10px 0px; text-decoration:none; font-size:12px;");
  div1.innerHTML ="After recieving your email, please click the link in the email";
}


function zenbuEnterValidateCodePanel() {
  var main_div = document.getElementById("eedb_login_div");
  if(!main_div) { return; }
  if(!current_user) { return; }
  
  var tdiv, tspan, tinput, ta;
  var divFrame = document.getElementById("zenbu_email_validate_panel");
  if(!divFrame) { 
    divFrame = main_div.appendChild(document.createElement('div'));
    divFrame.id = "zenbu_email_validate_panel";
    divFrame.setAttribute('style', "position:absolute; background-color:#e0f0ec; text-align:left; "+
                          "border:inset; border-width:3px; padding: 3px 7px 3px 7px; "+
                          "z-index:1; top:180px; width:500px;"+
                          "left:" + ((winW/2)-250) +"px; "
                          );
  }
  divFrame.innerHTML = "";

  // title
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold; margin-top:5px; ");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "ZENBU : validate user email address";
  
  var div1, form, label1, input1, text1, span1;
  div1 = divFrame.appendChild(document.createElement('div'));
  div1.setAttribute('style', "margin: 10px 0px 10px 0px; text-decoration:none; font-size:12px;");
  div1.innerHTML ="Thank you for entering your email address with ZENBU. Please check your email now."; 
  div1.innerHTML +="<br>After recieving your email, please click the link in the email";
}


function zenbuSubmitEmailValidation() {
  var email_input    = document.getElementById("zenbu_user_profile_email");
  if(!email_input) { zenbuValidateEmailPanel(); return; }
  var email = email_input.value;
  if(!email) { zenbuValidateEmailPanel(); return; }
  
  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>send_validation</mode>\n";
  paramXML += "<profile_email>"+ email +"</profile_email>";
  paramXML += "</zenbu_query>\n";
  
  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);
  
  zenbuEnterValidateCodePanel();
}


function zenbuSubmitPasswordLogin() {
  var email_input    = document.getElementById("user_login_panel_email");
  if(!email_input) { zenbuUserLoginPanel(); return; }
  var password_input    = document.getElementById("user_login_panel_password");
  if(!password_input) { zenbuUserLoginPanel(); return; }

  var login_div = document.getElementById("eedb_login_div");
  var login_panel = document.getElementById("zenbu_login_panel");

  var email  = email_input.value;
  var passwd = password_input.value;

  var paramXML = "<zenbu_query>\n";
  paramXML += "<mode>password_login</mode>\n";
  paramXML += "<profile_email>"+ email +"</profile_email>";
  paramXML += "<password>"+ passwd +"</password>";
  paramXML += "</zenbu_query>\n";

  var xhr=GetXmlHttpObject();
  xhr.open("POST", eedbUserCGI, false);
  xhr.setRequestHeader("Content-Type", "application/xml; charset=UTF-8;");
  xhr.send(paramXML);

  if(xhr.readyState!=4) return;
  if(xhr.responseXML == null) return;
  var xmlDoc=xhr.responseXML.documentElement;
  if(xmlDoc==null)  return;
  var failureXML = xmlDoc.getElementsByTagName("login_failure");
  if(failureXML.length>0) {
    var msg = failureXML[0].firstChild.nodeValue;
    current_error = new Object;
    current_error.message = msg;
    //force refresh with error by removing old panel and rebuild
    if(login_div && login_panel) { login_div.removeChild(login_panel); }
    zenbuUserLoginPanel(); 
    return; 
  }

  //login valid
  location.reload();
}





//======================================================
//
// general functions
//
//======================================================

function zenbuClearMessage() {
  var main_div = document.getElementById("message");
  if(!main_div) { return; }
  main_div.innerHTML = "";
}
  

function zenbuGeneralWarn(message, title) {
  var main_div = document.getElementById("message");
  if(!main_div) { return; }

  main_div.innerHTML = "";

  var e = window.event
  moveToMouseLoc(e);
  var ypos = toolTipSTYLE.ypos-35;
  if(ypos < 100) { ypos = 100; }

  var divFrame = document.createElement('div');
  main_div.appendChild(divFrame);
  divFrame.setAttribute('style', "position:absolute; background-color:lightgray; text-align:left; "
                            +"border-radius: 7px; border: solid 2px #808080; padding: 3px 7px 3px 7px; "
                            +"z-index:1; "
                            +"left:" + ((winW/2)-220) +"px; "
                            +"top:"+ypos+"px; "
                            +"width:440px;"
                             );
  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "font-size:14px; font-weight:bold;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = "Alert:";
  if(title) { tspan.innerHTML = title; }

  var a1 = tdiv.appendChild(document.createElement('a'));
  a1.setAttribute("target", "top");
  a1.setAttribute("href", "./");
  a1.setAttribute("onclick", "zenbuClearMessage(); return false;");
  var img1 = a1.appendChild(document.createElement('img'));
  img1.setAttribute("src", eedbWebRoot+"/images/close_icon16px.png");
  img1.setAttribute("style", "float: right;");
  img1.setAttribute("width", "16");
  img1.setAttribute("height", "16");
  img1.setAttribute("alt","close");

  var tdiv = divFrame.appendChild(document.createElement('div'));
  tdiv.setAttribute('style', "margin-top:10px; margin-bottom:10px; font-size:12px;");
  var tspan = tdiv.appendChild(document.createElement('span'));
  tspan.innerHTML = message;
}


function scorePassword(pass) {
    var score = 0;
    if(!pass) return score;

    // award every unique letter until 5 repetitions
    var letters = new Object();
    for (var i=0; i<pass.length; i++) {
        letters[pass[i]] = (letters[pass[i]] || 0) + 1;
        score += 5.0 / letters[pass[i]];
    }

    // bonus points for mixing it up
    var variations = {
        digits: /\d/.test(pass),
        lower: /[a-z]/.test(pass),
        upper: /[A-Z]/.test(pass),
        nonWords: /\W/.test(pass),
    }

    variationCount = 0;
    for (var check in variations) {
        variationCount += (variations[check] == true) ? 1 : 0;
    }
    score += (variationCount - 1) * 10;

    return parseInt(score);
}


function complement_base(base) {
  if(base == "a") { return "t"; }
  if(base == "c") { return "g"; }
  if(base == "g") { return "c"; }
  if(base == "t") { return "a"; }

  if(base == "A") { return "T"; }
  if(base == "C") { return "G"; }
  if(base == "G") { return "C"; }
  if(base == "T") { return "A"; }
}


function luminosity_contrast(R1,G1,B1, R2,G2,B2) {
  //should be >5 for visibility
  var L1 = 0.2126 * Math.pow(R1/255, 2.2) +
           0.7152 * Math.pow(G1/255, 2.2) +
           0.0722 * Math.pow(B1/255, 2.2);
 
  var L2 = 0.2126 * Math.pow(R2/255, 2.2) +
           0.7152 * Math.pow(G2/255, 2.2) +
           0.0722 * Math.pow(B2/255, 2.2);
 
  var lum = 0;
  if(L1 > L2) { lum = (L1+0.05) / (L2+0.05); }
  else { lum = (L2+0.05) / (L1+0.05); }
  console.log("luminosity = "+lum);
  return lum;
}


function zenbu_object_clone(obj) {
  if(!obj) { return null; }
  if(Array.isArray(obj)) {
    return [].concat(obj);
  } else {
    return Object.assign({ }, obj);
  }
}
