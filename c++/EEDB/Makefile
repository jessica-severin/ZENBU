CC=gcc
CPP=g++
CFLAGS   = -Wall -Wno-unused-but-set-variable -Wno-unused-result -O3 -I./ -I../ -I/usr/include/mariadb/ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.5/ -I../samtools-1.5/htslib-1.5/
CPPFLAGS = -Wall -Wno-unused-but-set-variable -Wno-unused-result -O3 -I./ -I../ -I/usr/include/mariadb/ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.5/ -I../samtools-1.5/htslib-1.5/

LIBS = -lm -lsqlite3 -lz
SRCS_C = Assembly.cpp Chrom.cpp ChromChunk.cpp \
         Metadata.cpp Symbol.cpp EdgeSet.cpp MetadataSet.cpp InteractionMatrix.cpp \
         DataSource.cpp FeatureSource.cpp Experiment.cpp EdgeSource.cpp \
         Peer.cpp SPStream.cpp User.cpp Collaboration.cpp Configuration.cpp \
         Datatype.cpp Feature.cpp Expression.cpp Edge.cpp EdgeWeight.cpp TrackCache.cpp TrackRequest.cpp \
         Tools/OSCFileParser.cpp Tools/OSCTableGenerator.cpp Tools/ResortBuffer.cpp Tools/LSArchiveImport.cpp \
         Tools/Paraclu.cpp Tools/TrackCacheBuilder.cpp Tools/RemoteUserTool.cpp \
         JobQueue/Job.cpp JobQueue/UploadFile.cpp \
         SPStreams/Dummy.cpp SPStreams/SourceStream.cpp SPStreams/StreamBuffer.cpp SPStreams/MergeStreams.cpp \
         SPStreams/OSCFileDB.cpp SPStreams/MultiMergeStream.cpp SPStreams/FederatedSourceStream.cpp \
         SPStreams/DBStream.cpp SPStreams/TemplateCluster.cpp SPStreams/FeatureEmitter.cpp \
         SPStreams/ObjectCount.cpp SPStreams/Proxy.cpp SPStreams/TemplateFilter.cpp SPStreams/FeatureLengthFilter.cpp \
         SPStreams/CutoffFilter.cpp SPStreams/CalcFeatureSignificance.cpp SPStreams/IDFilter.cpp \
         SPStreams/NormalizePerMillion.cpp SPStreams/CalcInterSubfeatures.cpp SPStreams/StreamSubfeatures.cpp \
         SPStreams/UniqueFeature.cpp SPStreams/ResizeFeatures.cpp SPStreams/ZenDB.cpp SPStreams/BAMDB.cpp \
         SPStreams/ExpressionDatatypeFilter.cpp SPStreams/Paraclu.cpp SPStreams/NeighborCutoff.cpp \
         SPStreams/MakeStrandless.cpp SPStreams/TopHits.cpp SPStreams/NormalizeRPKM.cpp SPStreams/DevNull.cpp \
         SPStreams/StreamTKs.cpp SPStreams/NormalizeByFactor.cpp SPStreams/FeatureRename.cpp \
         SPStreams/FilterSubfeatures.cpp SPStreams/RenameExperiments.cpp SPStreams/RescalePseudoLog.cpp \
         SPStreams/OverlapAnnotate.cpp SPStreams/MetadataFilter.cpp SPStreams/MetadataManipulate.cpp \
         SPStreams/CachePoint.cpp SPStreams/RemoteServerStream.cpp SPStreams/StrandFilter.cpp SPStreams/FlipStrand.cpp \
         SPStreams/MannWhitneyRanksum.cpp SPStreams/OverlapMerge.cpp SPStreams/SiteFinder.cpp \
         SPStreams/FoldChange.cpp SPStreams/DemultiplexSource.cpp SPStreams/CAGECorrection.cpp SPStreams/AppendExpression.cpp \
         SPStreams/AddLinkedMetadata.cpp SPStreams/PairReads.cpp SPStreams/EdgeLengthFilter.cpp \
         SPStreams/DumbBellToEdge.cpp SPStreams/MergeEdges.cpp \
         ZDX/ZDXsegment.cpp ZDX/ZDXstream.cpp \
         WebServices/WebBase.cpp WebServices/MetaSearch.cpp WebServices/ConfigServer.cpp WebServices/RegionServer.cpp \
         WebServices/UploadServer.cpp WebServices/DownloadServer.cpp WebServices/UserSystem.cpp WebServices/zenbu_common.cpp 

SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)
SUBDIRS = SPStreams Tools

all:	libeedb.a

samtools:
	$(MAKE) -C ../samtools-1.5

libeedb.a: samtools $(OBJS) 
	ar r libeedb.a $(OBJS)

clean:
	rm -f *.a *.o  SPStreams/*.o Tools/*.o WebServices/*.o ZDX/*.o JobQueue/*.o

cleanobj :
	rm *.o *.a
     
