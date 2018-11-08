CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I../../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml/ -I/usr/local/include/bamtools/
CPPFLAGS = -Wall -O3 -I./ -I../ -I../../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml/ -I/usr/local/include/bamtools/

LIBS =-lm -lz -lsqlite3 -lmqdb
SRCS_C = Dummy.cpp SourceStream.cpp StreamBuffer.cpp MergeStreams.cpp \
	 OSCFileDB.cpp MultiMergeStream.cpp FederatedSourceStream.cpp \
	 DBStream.cpp TemplateCluster.cpp FeatureEmitter.cpp CalcInterSubfeatures.cpp \
	 ObjectCount.cpp Proxy.cpp TemplateFilter.cpp FeatureLengthFilter.cpp \
	 CutoffFilter.cpp CalcFeatureSignificance.cpp IDFilter.cpp NormalizePerMillion.cpp \
	 StreamSubfeatures.cpp UniqueFeature.cpp ResizeFeatures.cpp ZenDB.cpp BAMDB.cpp \
         ExpressionDatatypeFilter.cpp Paraclu.cpp NeighborCutoff.cpp MakeStrandless.cpp \
         TopHits.cpp NormalizeRPKM.cpp DevNull.cpp NormalizeByFactor.cpp FeatureRename.cpp \
         FilterSubfeatures.cpp RenameExperiments.cpp OverlapAnnotate.cpp MetadataFilter.cpp \
         MetadataManipulate.cpp CachePoint.cpp RemoteServerStream.cpp StrandFilter.cpp
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all:	$(OBJS) 

clean:
	rm -f *.a *.o 

cleanobj :
	rm *.o *.a
     
