#!/usr/bin/python
import os,sys
import MySQLdb
import cgitb; cgitb.enable()
import cgi

os.environ[ 'HOME' ] = "/tmp"
IMG_DIR = "/data/www/html/nw2006/edgedb/tmpimages/"
IMG_URL = "../tmpimages/"

import pylab
from matplotlib.font_manager import FontProperties

timecourses = {'CAGE':['0', '1', '4', '12', '24', '96'],
               'qRT-PCR':['0','1','2','4','6','12','24','48','72','96'],
               'Illumina':['0','1','2','4','6','12','24','48','72','96']}

ylabels = {'CAGE':'TPM',
           'qRT-PCR':'Copy Number',
           'Illumina':'Expression Ratio'}

linestyle = {'1':'-.',
             '3':'--',
             '6':'-'}
           
fonts = {'title':25,
	 'lw':3,
	 'label':20,
	 'legend':20,
	 'ticks':17,
	 'dpi':35,
         'image_size':''}

markersize = 10

colorcycle = ['b','g','r','c','m','y','k']
markercycle =['','^','o','s','d','>','<','x','h']


def fetchCAGEData(lib1, lib3, lib6):
    cursor.execute("SELECT enz.feature_id geneId, enz.primary_name pname, f2.feature_id fid,"
        +"f2.primary_name primary_name, series_name, value "
        +"FROM feature enz JOIN edge fl1 "
        +"on(fl1.feature2_id=enz.feature_id) "
        +"JOIN feature f2 "
        +"on(fl1.feature1_id=f2.feature_id) "
        +"JOIN expression fe on(f2.feature_id = fe.feature_id) "
        +"JOIN experiment using(experiment_id ) "
        +"WHERE fl1.edge_source_id=21 "
        +"and enz.feature_id in ("+idstring+") "
        +"order by fid, series_name, series_point")

    parseResultSet(lib1, lib3, lib6)
    
def fetchQRTData(lib1, lib3, lib6):
    cursor.execute("SELECT enz.feature_id fid, enz.primary_name primary_name, "
        +"series_name, value, f2.primary_name primer_name FROM feature enz "
        +"JOIN edge fl1 "
        +"on(fl1.feature2_id=enz.feature_id) JOIN feature f2 "
        +"on(fl1.feature1_id=f2.feature_id) JOIN expression fe "
        +"on(f2.feature_id = fe.feature_id) JOIN experiment using(experiment_id ) "
        +"WHERE fl1.edge_source_id=25 and enz.feature_id in ("+idstring+") "
        +"and series_name in ("+datasetstring+") "
        +"order by fid, f2.feature_id, series_name, series_point")

    

    parseResultSet(lib1, lib3, lib6)


def fetchIlluminaData(lib1, lib3, lib6):
    cursor.execute("SELECT f2.primary_name id "
        +"FROM feature enz "
        +"JOIN edge fl1 on(fl1.feature2_id=enz.feature_id) "
        +"JOIN feature f2 on( fl1.feature1_id=f2.feature_id) "
        +"JOIN expression fe on(f2.feature_id = fe.feature_id) "
        +"WHERE fl1.edge_source_id=28 and enz.feature_id in ("+idstring+") "
        +"and sig_error>0.99"
        +"and experiment_id not in(71,72)"
        +"group by feature1_id , feature2_id")

    rs = cursor.fetchallDict()
    probeIds = ""
    for row in rs:
        if len(probeIds)>0:
            probeIds+=','
        probeIds += row['id']

    if len(probeIds)>0:
        cursor.execute("SELECT enz.feature_id fid,enz.primary_name primary_name, "
            +"f2.primary_name ilm_id, series_name, value "
            +"FROM feature enz JOIN edge fl1 "
            +"on(fl1.feature2_id=enz.feature_id ) "
            +"JOIN feature f2 on( fl1.feature1_id=f2.feature_id) "
            +"JOIN expression fe on(f2.feature_id = fe.feature_id) "
            +"JOIN experiment using(experiment_id ) "
            +"WHERE fl1.edge_source_id=28 "
            +"and series_name in ("+datasetstring+") "
            +"and enz.feature_id in ("+idstring+") "
            +"and f2.primary_name in("+probeIds+") "
            +"and experiment.experiment_id not in(71,72) "
            +"order by fid,ilm_id,series_name,series_point")

        parseResultSet(lib1, lib3, lib6)


def parseResultSet(lib1, lib3, lib6):
    rs = cursor.fetchallDict()
    lastid=-1
    lastgene=-1
    probeindex=0
    probecount=0    
    
    for row in rs:
        lib = {}
        probeid=''
        if row['series_name'].find("RIKEN1")==0:
            lib = lib1
        elif row['series_name'].find("RIKEN3")==0:
            lib = lib3
        else:
            lib = lib6
            
        if row.has_key('ilm_id'):
            probeid='_'+row['ilm_id']

        elif row.has_key('primer_name'):
            probeid='_'+row['primer_name']
    

        if lib.has_key(str(row['fid'])+probeid):
            gene = lib[str(row['fid'])+probeid]
        else:
            gene = []
            lib[str(row['fid'])+probeid] = gene
            gene.append(str(row['fid'])+probeid)
            gene.append(row['primary_name'])
            if ids.count(str(row['fid'])+probeid)==0:
                ids.append(str(row['fid'])+probeid) 
            if row.has_key('geneId'):
                gene.append(str(row['geneId']))
                gene.append(str(row['pname']))
            else:
                gene.append('')
		gene.append('')

        gene.append(row['value'])

        

def plotGraph():

    lineColors = {}

    pylab.clf() # Clears the current figure

    timecourse = timecourses[thistype]

    targetGenes = []
    labels = []

    color = ''
    colcycleindex = 0
    markercycleindex = 0
    geneid = ''
    for id in ids:
        if thistype=='Illumina' and id.find('_')==-1:
            continue

        if geneid!=id.split('_')[0]:
            markercycleindex=0
            
        geneid = id.split('_')[0]

        for dataset in datasets:       
            if dataset=='1':
                lib = lib1
            elif dataset=='3':
                lib = lib3
            else:
                lib = lib6

            if not lib.has_key(id):
                continue

            label = lib[id][1]

            values = lib[id][4:]


            if thistype=='Illumina':
                fvalues=[float(i) for i in values]
                med=pylab.median(fvalues)
                values=["%1.4f"%(f/med) for f in fvalues]

            targetGenes.append(lib[id][:4]+[dataset]+values)  

                    
        if thistype=='Illumina':
                markercycleindex=markercycleindex+1
                     
                 
    graphData.append({'type':thistype,
                      'timecourse':timecourse,
                      'values':targetGenes})

        

def writeTableData():
    if isHTML:
        for graph in graphData:
            if len( graph['values'] )==0:
                continue
            print "<img src=\""+IMG_URL+graph['imageName']+"\">"
            
        print "<br><pre>"
        print """<br><br><br>&lt;?xml version=\"1.0\" encoding=\"UTF-8\"?&gt;<br>&lt;expressionGraphs&gt;"""
    else:
        print """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<expressionGraphs>"""

    for graph in graphData:
        if len( graph['values'] )==0:
            continue
        
        if isHTML:
            print "<br>&nbsp;&nbsp;&lt;graph url=\""+graph['imageName']+"\" type=\""+graph['type']+"\"&gt;"
        else:
            print "<graph type=\""+graph['type']+"\">"

        
        for gene in graph['values']:

            if isHTML:
                gstring="<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;"
            else:
                gstring="<"

            if graph['type']=='Illumina':
                ids = gene[0].split('_')
                gstring += "gene id=\""+ids[0]+"\" name=\""+gene[1]+"\" probeId=\""+ids[1]+"\""
            elif graph['type']=='qRT-PCR':
                ids = gene[0].split('_')
                gstring += "gene id=\""+ids[0]+"\" name=\""+gene[1]+"\" primerId=\""+ids[1]+"\" "
            elif len(gene[2])>0:
                gstring += "gene id=\""+gene[2]
                gstring += "\" name=\""+gene[3]+"\""
                gstring+=" promoter_id=\""+gene[0]+"\""
                gstring+=" promoter=\""+gene[1]+"\""
            else:
                gstring += "gene id=\""+gene[0] 
                gstring += "\" name=\""+gene[1]+"\""

            

            gstring+=" dataset=\""+gene[4]+"\" data=\""
            
            gSize = len(gene)
            for i in range(5, gSize):
                gstring += "("+graph['timecourse'][i-5]+","+str(gene[i])+")"
                if(i<gSize-1):
                    gstring += ","
            
            if isHTML:
                gstring+="\"/&gt;"
            else:
                gstring+="\"/>"

            print gstring
            
        if isHTML:
            print "<br>&nbsp;&nbsp;&lt;/graph&gt;"
        else:
            print "</graph>"
    if isHTML:
        print "<br>&lt;/expressionGraphs&gt;</pre>"
    else:
        print "</expressionGraphs>"


form = cgi.FieldStorage() 

promoterAlias = {}
idstring = ""
if form.has_key('ids'):
    ids = form.getfirst("ids","").split(",");
    for i in range(len(ids)):
        alias = ids[i].split(":")
        if len(idstring)>1:
            idstring+=","
        if len(alias)>1:
            promoterAlias[alias[1]]=alias[0]
            idstring+=alias[1]
            ids[i] = alias[1]
        else:
            idstring+=alias[0]


if form.has_key('type'):
   type = form.getfirst("type", "").split(",");
else:
   type=""

if form.has_key('dataset'):
    datasets = form.getfirst("dataset", "").split(",");
    datasets.sort()
else:
    datasets = ['1','3','6']


datasetstring=""
for ds in datasets:
    if len(datasetstring)>0:
        datasetstring=datasetstring+','
    datasetstring=datasetstring+'\'RIKEN'+ds+'\''

       
if form.has_key('size'):
    #Its either big or small in this version
    fonts['title']=16
    fonts['lw']=1
    fonts['label']=12
    fonts['legend']=10
    fonts['ticks']=10
    fonts['dpi']=100
    fonts['image_size']='L'
    markersize=5

isHTML = 0

print "Content-type: text/xml; charset=UTF-8"
print


conn = MySQLdb.connect(host="fantom40.gsc.riken.jp",user="read",passwd="read",db="f4_goi")
cursor = MySQLdb.cursors.DictCursor(conn)

graphData = [];
for thistype in type:  
    lib1 ={}
    lib3 ={}
    lib6 ={}
    if thistype.lower()=="cage":
        thistype = "CAGE"
        fetchCAGEData(lib1, lib3, lib6)
        
    elif thistype.lower()=="qrt-pcr":
        thistype = "qRT-PCR"
        fetchQRTData(lib1, lib3, lib6)
        
    elif thistype.lower()=="illumina":
        thistype = "Illumina"
        fetchIlluminaData(lib1, lib3, lib6)

    else:
        continue
    plotGraph()
    
writeTableData()

cursor.close()
conn.close()

