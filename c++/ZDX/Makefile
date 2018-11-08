CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml/ 
CPPFLAGS = -Wall -O3 -I./ -I../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml/

LIBS = -lm -lsqlite3 -lz
SRCS_C = ZDXdb.cpp 
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)
SUBDIRS = 

all:	libzdx.a

libzdx.a: $(OBJS) 
	ar r libzdx.a $(OBJS)

clean:
	rm -f *.a *.o 

cleanobj :
	rm *.o *.a
     
