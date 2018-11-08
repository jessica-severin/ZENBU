CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I/usr/include/mysql -I/usr/local/include -I/usr/local/mysql/include -I/usr/local/boost/
CPPFLAGS = -Wall -O3 -I./ -I../ -I/usr/include/mysql -I/usr/local/include -I/usr/local/mysql/include -I/usr/local/boost
LIBS =-lm -lz -lsqlite3 -lssl -lcrypto
SRCS_C = Database.cpp  DBObject.cpp  MappedQuery.cpp DBStream.cpp DBCache.cpp
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all:	libmqdb.a

libmqdb.a: $(OBJS) 
	ar r libmqdb.a $(OBJS)

clean:
	rm -f *.a *.o 

cleanobj :
	rm *.o *.a
     
