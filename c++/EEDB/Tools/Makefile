CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I../../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml/
CPPFLAGS = -Wall -O3 -I./ -I../ -I../../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml/

LIBS =-lm -lz -lsqlite3 -lmqdb -leedb_spstreams
SRCS_C = OSCFileParser.cpp OSCTableGenerator.cpp ResortBuffer.cpp LSArchiveImport.cpp Paraclu.cpp TrackCacheBuilder RemoteUserTool
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all: $(OBJS)

clean:
	rm -f *.a *.o 

cleanobj :
	rm *.o *.a
     
