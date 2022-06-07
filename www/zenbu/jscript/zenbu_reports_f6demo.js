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


//===============================================================
//
// FANTOM6 report demo setup
//
//===============================================================

function reportsSetupF6DemoView() {
  console.log("reportsSetupF6DemoView");
  if(!current_user) {
    reportsNoUserWarn("access this view configuration");
    return;
  }

  current_report.view_config_loaded = true;
  current_report.configUUID = "A560D9AF-4330-4D94-8132-50FFBC7FEE33";
  current_report.config_fixed_id = "f6demo";
  current_report.config_title = "FANTOM6 long-non-coding gene knockdown analysis reports";
  current_report.desc = "";
  //current_report.config_creator = "jessica.severin@gmail.com";
  current_report.config_creator = "jessica severin";
  current_report.config_createdate = "Thu Nov 30 16:05:10 2017 JST";
  reportsShowConfigInfo();

  //load config or manually setup the elements
  reportsNewLayoutElement("row", "row1");
  reportsNewLayoutElement("row", "row2");
  reportsNewLayoutElement("row", "row3");
  reportsNewLayoutElement("col", "col1");
  
  reportsSetupList_target_list();
  reportsSetup_GeneTargetASOs(); //this is still special, need to abstract into maybe a list
  reportsSetupTable_target_DE_genes();
  reportsSetupChart_DE_ASO_concordance();
  reportsSetupChart_basemean_FC();
  reportsSetupChart_fdr_FC();
  reportsSetupZenbuGB1();
  //testChart();
}

// Target list reportElement
function reportsSetupList_target_list() {
  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["target_list"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("treelist","target_list");
    //reportElement.elementID = "target_list";
    reportElement.main_div_id = "target_list_div";
    current_report.elements[reportElement.elementID] = reportElement;
  }
  
  reportElementAddCascadeTrigger(reportElement, "zenbu_gb1",       "select", "focus_load", "selection");
  reportElementAddCascadeTrigger(reportElement, "gene_target_aso", "select", "focus_load", "selection");
  
  //reportElement.source_query = "format=fullxml;mode=features;source_ids=CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource;filter=F6_KD_CAGE:=true";
  reportElement.datasource_mode = "feature";
  reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource";
  reportElement.query_filter = "F6_KD_CAGE:=KD_CAGE";
  reportElement.query_format = "fullxml";
  reportElement.load_on_page_init = true;
  
  reportElement.title = "KD gene targets";
  reportElement.title_prefix = "KD gene targets";
  reportElement.sort_col = "name";
  reportElement.sort_reverse = false;
  reportElement.widget_search = true;
  reportElement.widget_filter = false;
  
  reportElement.init_selection = "LINC00630";
  reportElement.content_width = 250;
  reportElement.content_height = 330;
  reportElement.resetable = false;
  reportElement.move_selection_to_top=true;
  
  //setup the columns
  var t_col = reportElementAddDatatypeColumn(reportElement, "name", "target name", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "geneName", "geneName", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "geneID", "geneID");
  t_col.visible = false;
  //var t_col = reportElementAddDatatypeColumn(reportElement, "trnscptID", "trnscptID", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "F6_KD_CAGE", "F6_KD_CAGE");
  t_col.visible = false;
  
  var t_col = reportElementAddDatatypeColumn(reportElement, "category", "category"); //default but don't show
  t_col.visible = false;
  var t_col = reportElementAddDatatypeColumn(reportElement, "source_name", "source_name"); //default but don't show
  t_col.visible = false;
  
  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row1";
  reportElement.layout_col = 1;
  reportsUpdateElementLayout(reportElement);
  
  //reportsResetTableElement(reportElement); //might not need here
}

// Gene Target and ASO reportElement

function reportsSetup_GeneTargetASOs() {
  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["gene_target_aso"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("treelist","gene_target_aso");
    //reportElement.element_type = "asolist";  //HACK: toggle between asolist and treelist toggles old/new system
    //reportElement.element_type = "treelist";
    //reportElement.element_type = "table";
    //reportElement.elementID = "gene_target_aso"; //special for now
    //reportElement.datasourceElementID = undefined;
    reportElement.main_div_id = "KD_targets_aso";
    //current_report.elements[reportElement.elementID] = reportElement;
  }
  
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "reset", "set_focus", "clear");
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "reset", "reset");
  
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "load", "set_focus", "selection");
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "load", "set_filter_features", "all_features");
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "load", "load");
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "select", "set_focus", "selection");
  reportElementAddCascadeTrigger(reportElement, "target_DE_genes", "select", "postprocess");
  
  //reportElementAddCascadeTrigger(reportElement, "DE_ASO_concordance", "select", "postprocess");
  //reportElementAddCascadeTrigger(reportElement, "KD_DE_basemean_FC",  "select", "postprocess");
  //reportElementAddCascadeTrigger(reportElement, "KD_DE_fdr_FC",       "select", "postprocess");
  
  reportElement.title = "Knockdown target and ASO guide RNAs";
  reportElement.title_prefix = "Knockdown target and ASO guide RNAs";
  
  reportElement.datasource_mode = "edge";
  reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::1:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::2:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::10:::EdgeSource";
  reportElement.query_filter = "";
  reportElement.query_format = "fullxml";
  reportElement.query_edge_search_depth = 3;
  
  //reportElement.sort_col = "name";
  //reportElement.sort_reverse = false;
  
  reportElement.widget_search = true;
  reportElement.widget_filter = false;
  
  reportElement.init_selection = "";
  reportElement.content_width = 430;
  reportElement.content_height = 330;
  
  //setup the columns
  var t_col = reportElementAddDatatypeColumn(reportElement, "category", "category", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "name", "name", true);
  //var t_col = reportElementAddDatatypeColumn(reportElement, "source_name", "source");
  //var t_col = reportElementAddDatatypeColumn(reportElement, "HGNC_symbol", "HGNC_symbol");
  var t_col = reportElementAddDatatypeColumn(reportElement, "oligo_seq", "oligo_seq", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "F6_KD_CAGE", "KD_CAGE", true);
  
  //var t_col = reportElementAddDatatypeColumn(reportElement, "source_name", "source_name"); //default but don't show
  //t_col.visible = false;
  
  //reportElementAddDatatypeColumn(reportElement, "f1.name", "name", false);
  //reportElementAddDatatypeColumn(reportElement, "f2.name", "name", false);
  
  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row1";
  reportElement.layout_col = 2;
  reportsUpdateElementLayout(reportElement);
}

// Target DE genes fetch and table display

function reportsSetupTable_target_DE_genes() {
  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["target_DE_genes"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("table", "target_DE_genes");
    //reportElement.element_type = "table";
    //reportElement.elementID = "target_DE_genes";
    //reportElement.datasourceElementID = undefined;
    //reportElement.datasourceElementID = "gene_target_aso";
    reportElement.main_div_id = "KD_DE_genes_table_div";
    //current_report.elements[reportElement.elementID] = reportElement;
  }
  reportElement.datasource_mode = "edge";
  //reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::7:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::8:::EdgeSource,CCFED83C-F889-43DC-BA41-7843FCB90095::9:::EdgeSource";
  //reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::14:::EdgeSource";  //118,125,168  full
  //reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::16:::EdgeSource";    //39,969,294 trimmed
  reportElement.source_ids = "6F90A065-4234-4C36-93D4-546878DEF3CB::1:::EdgeSource";   //oscdb version of trimmed
  
  reportElement.query_filter = "";
  reportElement.query_format = "fullxml";
  reportElement.widget_search = true;
  reportElement.widget_filter = true;
  
  reportElement.content_width = 850;
  reportElement.content_height = 330;
  
  reportElementAddCascadeTrigger(reportElement, "zenbu_gb1", "select_location", "focus_load", "selection");


  //these are all because of the dependant datasource element, should be able to make this generic
  /*
   reportElementAddCascadeTrigger(reportElement, "DE_ASO_concordance", "reset", "postprocess");
   reportElementAddCascadeTrigger(reportElement, "KD_DE_basemean_FC",  "reset", "postprocess");
   reportElementAddCascadeTrigger(reportElement, "KD_DE_fdr_FC",       "reset", "postprocess");
   
   reportElementAddCascadeTrigger(reportElement, "DE_ASO_concordance", "load", "postprocess");
   reportElementAddCascadeTrigger(reportElement, "KD_DE_basemean_FC",  "load", "postprocess");
   reportElementAddCascadeTrigger(reportElement, "KD_DE_fdr_FC",       "load", "postprocess");
   
   reportElementAddCascadeTrigger(reportElement, "DE_ASO_concordance", "postprocess", "postprocess");
   reportElementAddCascadeTrigger(reportElement, "KD_DE_basemean_FC",  "postprocess", "postprocess");
   reportElementAddCascadeTrigger(reportElement, "KD_DE_fdr_FC",       "postprocess", "postprocess");
   */
  
  //reportElementAddCascadeTrigger(reportElement, "DE_ASO_concordance", "select", "postprocess");
  //reportElementAddCascadeTrigger(reportElement, "KD_DE_basemean_FC",  "select", "postprocess");
  //reportElementAddCascadeTrigger(reportElement, "KD_DE_fdr_FC",       "select", "postprocess");
  
  
  reportElement.title = "Knockdown differentially expressed genes for : ";
  reportElement.title_prefix = "Knockdown differentially expressed genes for : ";
  reportElement.sort_col = "fdr";
  reportElement.sort_reverse = false;
  reportElement.dtype_filter_select = "fdr";
  reportElement.table_page_size = 15;
  
  //setup the columns
  var t_col = reportElementAddDatatypeColumn(reportElement, "f1.name", "ASO", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "f2.name", "gene ID", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "f2.geneName", "geneName", true);
  var t_col = reportElementAddDatatypeColumn(reportElement, "baseMean", "baseMean", true);
  t_col.col_type = "weight";
  var t_col = reportElementAddDatatypeColumn(reportElement, "log10baseMean", "log10baseMean", true);
  t_col.col_type = "weight";
  var t_col = reportElementAddDatatypeColumn(reportElement, "fdr", "fdr", true);
  t_col.col_type = "weight";
  t_col.filtered = true;
  t_col.filter_min = "min";
  t_col.filter_max = 0.1;
  
  var t_col = reportElementAddDatatypeColumn(reportElement, "log2FC", "log2FC", true);
  t_col.col_type = "weight";
  var t_col = reportElementAddDatatypeColumn(reportElement, "pvalue", "pvalue", true);
  t_col.col_type = "weight";
  var t_col = reportElementAddDatatypeColumn(reportElement, "KD_tpm_ave", "KD_tpm_ave", true);
  t_col.col_type = "weight";
  var t_col = reportElementAddDatatypeColumn(reportElement, "NC_tpm_ave", "NC_tpm_ave", true);
  t_col.col_type = "weight";

  //var t_col = reportElementAddDatatypeColumn(reportElement, "zenbugb", "zenbu view");
  var t_col = reportElementAddDatatypeColumn(reportElement, "f2.location_link", "zenbu view", true);
  t_col.title = "zenbu view";
  t_col.visible = true;
  t_col.colnum = -1;
  
  //name,category,source_name are default but don't show
  var t_col = reportElementAddDatatypeColumn(reportElement, "f2.category", "category"); //default but don't show
  t_col.visible = false;
  var t_col = reportElementAddDatatypeColumn(reportElement, "f2.source_name", "source_name"); //default but don't show
  t_col.visible = false;
  
  //reportElementAddDatatypeColumn(reportElement, "f1.name", "name", false);
  //reportElementAddDatatypeColumn(reportElement, "f2.name", "name", false);

  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row1";
  reportElement.layout_col = 3;
  reportsUpdateElementLayout(reportElement);
  
  //reportsResetTableElement(reportElement); //might not need here
}


function reportsSetupChart_DE_ASO_concordance() {
  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["DE_ASO_concordance"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("chart", "DE_ASO_concordance");
    reportElement.chart_type = "bubble";
  }
  
  reportElement.datasource_mode = "shared_element";
  reportElement.datasourceElementID = "target_DE_genes";
  
  //reportElement.main_div_id = "KD_DE_ASO_concordance_plot";
  reportElement.dual_feature_axis = true;
  reportElement.symetric_axis = true;
  reportElement.content_width = 450;
  reportElement.content_height = 500;
  
  
  reportElement.widget_search = true;
  reportElement.widget_filter = true;
  
  reportElement.title = "Knockdown ASO concordance : ";
  reportElement.title_prefix = "Knockdown ASO concordance : ";
  reportElement.xaxis = { datatype: "log2FC", fixedscale:true, symetric: true };
  reportElement.yaxis = { datatype: "log2FC", fixedscale:true, symetric: true };
  //reportElement.xaxis = { datatype: "log2FoldChange", fixedscale:true, symetric: true };
  //reportElement.yaxis = { datatype: "log2FoldChange", fixedscale:true, symetric: true };
  //reportElement.datatype_x = "log2FoldChange";
  //reportElement.datatype_y = "log2FoldChange";
  //reportElement.datatype = "fdr";
  //reportElement.datatype = "log2FoldChange";
  //reportElement.datatype_x = "log10baseMean";
  
  reportElement.x_feature = null;
  reportElement.y_feature = null;
  reportElement.target_array = null;
  
  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row2";
  reportElement.layout_col = 1;
  reportsUpdateElementLayout(reportElement);
}


function reportsSetupChart_basemean_FC() {
  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["KD_DE_basemean_FC"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("chart", "KD_DE_basemean_FC");
    //reportElement.element_type = "chart";
    reportElement.chart_type = "bubble";
    reportElement.main_div_id = "KD_DE_basemean_FC_plot";
    reportElement.content_width = 550;
    reportElement.content_height = 500;
    reportElement.dual_feature_axis = false;
    //current_report.elements[reportElement.elementID] = reportElement;
  }
  
  reportElement.datasource_mode = "shared_element";
  reportElement.datasourceElementID = "target_DE_genes";
  
  reportElement.widget_search = true;
  reportElement.widget_filter = true;
  
  reportElement.title = "Knockdown target MA-plot : ";
  reportElement.title_prefix = "Knockdown target MA-plot : ";
  reportElement.xaxis = { datatype: "log10baseMean", fixedscale:true  };
  reportElement.yaxis = { datatype: "log2FC", fixedscale:true, symetric: true };
  //reportElement.yaxis = { datatype: "log2FoldChange", fixedscale:true, symetric: true };
  //reportElement.datatype_x = "log2FoldChange";
  //reportElement.datatype_y = "log2FoldChange";
  //reportElement.datatype = "fdr";
  //reportElement.datatype = "log2FoldChange";
  //reportElement.datatype_x = "log10baseMean";
  
  reportElement.x_feature = null;
  reportElement.y_feature = null;
  
  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row2";
  reportElement.layout_col = 2;
  reportsUpdateElementLayout(reportElement);
}


function reportsSetupChart_fdr_FC() {  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["KD_DE_fdr_FC"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("chart", "KD_DE_fdr_FC");
    reportElement.chart_type = "bubble";
  }
  reportElement.datasourceElementID = "target_DE_genes";
  reportElement.main_div_id = "KD_DE_fdr_FC_plot";
  reportElement.content_width = 530;
  reportElement.content_height = 500;
  reportElement.dual_feature_axis = false;
  
  reportElement.datasource_mode = "shared_element";
  reportElement.datasourceElementID = "target_DE_genes";
  
  reportElement.widget_search = true;
  reportElement.widget_filter = true;
  
  reportElement.title = "Knockdown target foldchange vs fdr : ";
  reportElement.title_prefix = "Knockdown target foldchange vs fdr : ";
  reportElement.yaxis = { datatype: "fdr", fixedscale: false };
  reportElement.xaxis = { datatype: "log2FC", fixedscale: true, symetric: true };
  //reportElement.yaxis = { datatype: "pvalue", fixedscale: false };
  //reportElement.yaxis = { datatype: "fdr", fixedscale: false };
  //reportElement.xaxis = { datatype: "log2FoldChange", symetric: true };
  //reportElement.datatype_x = "log2FoldChange";
  //reportElement.datatype_y = "log2FoldChange";
  //reportElement.datatype = "fdr";
  //reportElement.datatype = "log2FoldChange";
  //reportElement.datatype_x = "log10baseMean";
  
  reportElement.x_feature = null;
  reportElement.y_feature = null;
  
  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row2";
  reportElement.layout_col = 3;
  reportsUpdateElementLayout(reportElement);
}


function reportsSetupZenbuGB1() {
  //hardcoded but eventually this will be user configured and saved as XML
  
  var reportElement = current_report.elements["zenbu_gb1"];
  if(!reportElement) {
    reportElement = reportsNewReportElement("zenbugb", "zenbu_gb1");
    //reportElement.element_type = "zenbugb";
    //reportElement.elementID = "zenbu_gb1";
    reportElement.datasourceElementID = undefined;
    reportElement.main_div_id = "zenbu_gb1_div";
    //current_report.elements[reportElement.elementID] = reportElement;
  }
  
  reportElement.datasource_mode = "";
  //reportElement.source_ids = "CCFED83C-F889-43DC-BA41-7843FCB90095::6:::FeatureSource";
  //reportElement.query_filter = "F6_KD_CAGE:=true";
  //reportElement.query_format = "fullxml";
  reportElement.title = "pre-FANTOM6 KD genome view";
  reportElement.title_prefix = "pre-FANTOM6 KD genome view";
  
  //reportElement.view_config = "GkUmWDlIHNRtGD-lR8v02D";
  reportElement.view_config = "0HzC3s1rFdZneP2vWeIvcD";
  reportElement.chrom_location = "";
  reportElement.zenbu_url = "http://fantom.gsc.riken.jp/zenbu/gLyphs";
  reportElement.selected_id = "";
  reportElement.selected_feature = null;
  reportElement.selected_edge = null;

  reportElement.content_width = 1200;
  reportElement.content_height = 1000;
  
  reportElement.main_div = null;
  
  reportElement.layout_mode = "child";
  reportElement.layout_parentID = "row3";
  reportElement.layout_col = 1;
  reportsUpdateElementLayout(reportElement);
}



