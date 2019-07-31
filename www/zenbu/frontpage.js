var eedbDefaultAssembly;
var current_dragTrack;
var currentSelectTrackID;
var eedbCurrentUser ="";

//---------------------------------------------
//
// eeDB_search call back function section
//
//---------------------------------------------

function eedbSearchGlobalCalloutClick(id) {
  eedbClearSearchTooltip();
  zenbuLoadViewConfig(id)
}

function singleSearchValue(str) {
  return false;
}

function clearExpressTooltip() {
  if(ns4) toolTipSTYLE.visibility = "hidden";
  else toolTipSTYLE.display = "none";
  // document.getElementById("SVGdiv").innerHTML= "tooltip mouse out";
}


function zenbuLoadViewConfig(id) {
  var url = eedbConfigCGI;
  url += "?format=simplexml&uuid=" + id;

  var expressXMLHttp=GetXmlHttpObject();
  if(expressXMLHttp==null) {
    alert ("Your browser does not support AJAX!");
    return;
  }
  //document.getElementById("message").innerHTML = "frontpage : " + url;

  expressXMLHttp.open("GET",url,false); //not async
  expressXMLHttp.send(null);

  if(expressXMLHttp == null) { return; }
  //document.getElementById("message").innerHTML += " "+expressXMLHttp.readyState;
  if(expressXMLHttp.responseXML == null) return;
  if(expressXMLHttp.readyState!=4) return;
  if(expressXMLHttp.status!=200) { return; }

  var xmlDoc=expressXMLHttp.responseXML.documentElement;
  if(xmlDoc==null) {
    alert('Problem with central DB!');
    return;
  }

  var configUUID = xmlDoc.getAttribute("uuid");
  if(configUUID) { 
    var newurl = eedbWebRoot + "/gLyphs/#config="+configUUID;
    //document.getElementById("message").innerHTML = newurl;
    location.href = newurl;
  }
  return 1;
}

function zenbuFrontPageInit() {
  //zenbuGeneralWarn("Due to server room power maintenance at the RIKEN Yokohama campus, all ZENBU webservers will be shutdown from Aug 17 17:00 JST to Aug 21 20:00 JST.<br>"+
  //                 "We appologize for the inconvenience to ZENBU users, but we will restore services as soon as possible.");
}

function zenbuFrontViewInfo(uuid) {
  var info_div = document.getElementById("zenbu_front_view_info");
  if(!info_div) { return; }
  info_div.innerHTML = "";
  info_div.setAttribute("onclick", "");

  var config = eedbGetObject(uuid, "config");
  if(!config) { return; }
  clearKids(info_div);

  var title = config.title;
  if(!title) { title = config.name; }

  info_div.setAttribute("onclick", "location.href='./gLyphs/#config=" +config.uuid+"'");
  info_div.setAttribute("style", "margin-left:5px; cursor:pointer;"); 

  var titlediv = info_div.appendChild(document.createElement("div"));
  titlediv.setAttribute("style", "font-size:16px; font-weight:bold; color:black;");
  titlediv.innerHTML = encodehtml(title);

  if(config.img_url) {
    var img = info_div.appendChild(document.createElement("img"));
    img.setAttribute("src", config.img_url);
    img.setAttribute("width","400px");
  }

  //description below the image
  var descdiv = info_div.appendChild(document.createElement("div"));
  descdiv.setAttribute("style", "font-size:10px;");

  var div1 = descdiv.appendChild(document.createElement("div"));
  div1.innerHTML = encodehtml(config.description);

  var div2 = descdiv.appendChild(document.createElement("div"));
  div2.setAttribute("style", "font-size:10px;");
  if(config.author) {
    var span1 = div2.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:10px;");
    span1.innerHTML = "created by: "+ encodehtml(config.author);
  } else if(config.owner_openID) {
    var span1 = div2.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:10px;");
    span1.innerHTML = "created by: "+ encodehtml(config.owner_openID);
  }

  if(config.create_date) {
    var span1 = div2.appendChild(document.createElement("span"));
    span1.setAttribute("style", "margin-left:10px;");
    span1.innerHTML = encodehtml(config.create_date) +" GMT";
  }


}


