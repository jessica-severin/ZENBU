MAKE=make
CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I/usr/local/include -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.2/ -I../samtools-1.2/htslib-1.2.1/     
CPPFLAGS = -O3 -I./ -I../ -I/usr/local/include -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.2/ -I../samtools-1.2/htslib-1.2.1/

LIBFLAGS = -L/usr/lib64/mysql -L/usr/local/lib -L/usr/local/mysql/lib -L../EEDB -L../MQDB -L../ZDX -L../lz4 -L../samtools-1.2 -L../samtools-1.2/htslib-1.2.1
LIBS = -lm -leedb -lmqdb -lzdx -llz4 -lmysqlclient -lfcgi -lsqlite3 -lz -lbam -lhts -lcurl -lssl -lcrypto -lpthread
SRCS_C = 
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all:	osceng lz4 zdx mqdb eedb zenbu_test zenbu_test2 zenbu_test_module zenbu_test_streamtks 

#zenbu_test:	zdx mqdb eedb zenbu_test.o
#	$(CPP) $(CPPFLAGS) zenbu_test.o $(LIBS) -o zenbu_test

zenbu_test:	lz4 zdx mqdb eedb zenbu_test.o
	$(CPP) $(CPPFLAGS) zenbu_test.o $(LIBFLAGS) $(LIBS) -o zenbu_test

zenbu_test2:    lz4 zdx mqdb eedb zenbu_test2.o
	$(CPP) $(CPPFLAGS) zenbu_test2.o $(LIBFLAGS) $(LIBS) -o zenbu_test2

zenbu_test_module:       lz4 zdx mqdb eedb zenbu_test_module.o
	$(CPP) $(CPPFLAGS) zenbu_test_module.o $(LIBFLAGS) $(LIBS) -o zenbu_test_module

zenbu_test_streamtks:	lz4 zdx mqdb eedb zenbu_test_streamtks.o
	$(CPP) $(CPPFLAGS) zenbu_test_streamtks.o $(LIBFLAGS) $(LIBS) -o zenbu_test_streamtks

server_test:	server_test.o
	$(CPP) $(CPPFLAGS) server_test.o $(LIBFLAGS) $(LIBS) -o server_test
osceng: 
	$(MAKE) -C ../OSCeng

mqdb: 
	$(MAKE) -C ../MQDB

lz4: 
	$(MAKE) -C ../lz4

zdx:
	$(MAKE) -C ../ZDX

eedb:
	$(MAKE) -C ../EEDB

clean:
	rm -f *.o  zenbu_test zenbu_test2 zenbu_test_module zenbu_test_streamtks

cleanobj :
	rm *.o
     
