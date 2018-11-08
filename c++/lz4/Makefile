CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I../../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml-1.13/ -I/usr/local/include/bamtools/ 
CPPFLAGS = -Wall -O3 -I./ -I../ -I../../ -I/usr/include/mysql -I/usr/local/mysql/include -I/usr/local/include -I/usr/local/boost/ \
           -I/usr/local/rapidxml-1.13/ -I/usr/local/include/bamtools/ 

LIBS = -lm -lsqlite3 -lz
SRCS_C = lz4.c
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.c=.o)
SUBDIRS = 

all:	liblz4.a

liblz4.a: $(OBJS) 
	ar r liblz4.a $(OBJS)

clean:
	rm -f *.a *.o 

cleanobj :
	rm *.o *.a
     
