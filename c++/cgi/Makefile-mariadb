MAKE=make
CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I/usr/local/include -I/usr/include/mariadb/ -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.5/ -I../samtools-1.5/htslib-1.5/     
CPPFLAGS = -O3 -I./ -I../ -I/usr/local/include -I/usr/include/mariadb/ -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.5/ -I../samtools-1.5/htslib-1.5/

LIBFLAGS = -L../EEDB -L../MQDB -L../ZDX -L../lz4 -L../samtools-1.5 -L../samtools-1.5/htslib-1.5 -L/usr/lib64/mysql -L/usr/local/lib -L/usr/local/mysql/lib 
LIBS = -lm -leedb -lmqdb -lzdx -llz4 -lmariadb -lfcgi -lsqlite3 -lz -lbam -lhts -lcurl -lssl -lcrypto -lpthread -llzma -lbz2
SRCS_C = eedb_search.cpp eedb_region.cpp eedb_config_server.cpp eedb_upload.cpp
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all:	lz4 mqdb zdx eedb eedb_search.cgi eedb_search.fcgi eedb_config_server.cgi eedb_region.cgi eedb_upload.cgi eedb_download.cgi eedb_user.cgi eedb_user.fcgi

eedb_search.cgi:	mqdb eedb eedb_search.o
	$(CPP) $(CPPFLAGS) eedb_search.o $(LIBFLAGS) $(LIBS) -o eedb_search.cgi

eedb_search.fcgi:	mqdb eedb eedb_search.o
	$(CPP) $(CPPFLAGS) eedb_search.o $(LIBFLAGS) $(LIBS) -o eedb_search.fcgi

eedb_config_server.cgi:	mqdb eedb eedb_config_server.o
	$(CPP) $(CPPFLAGS) eedb_config_server.o $(LIBFLAGS) $(LIBS) -o eedb_config_server.cgi

eedb_region.cgi:	mqdb eedb eedb_region.o
	$(CPP) $(CPPFLAGS) eedb_region.o $(LIBFLAGS) $(LIBS) -o eedb_region.cgi

eedb_upload.cgi:	mqdb eedb eedb_upload.o
	$(CPP) $(CPPFLAGS) eedb_upload.o $(LIBFLAGS) $(LIBS) -o eedb_upload.cgi

eedb_download.cgi:	mqdb eedb eedb_download.o
	$(CPP) $(CPPFLAGS) eedb_download.o $(LIBFLAGS) $(LIBS) -o eedb_download.cgi

eedb_user.cgi:	mqdb eedb eedb_user.o
	$(CPP) $(CPPFLAGS) eedb_user.o $(LIBFLAGS) $(LIBS) -o eedb_user.cgi

eedb_user.fcgi:	mqdb eedb eedb_user.o
	$(CPP) $(CPPFLAGS) eedb_user.o $(LIBFLAGS) $(LIBS) -o eedb_user.fcgi

lz4: 
	$(MAKE) -C ../lz4

mqdb: 
	$(MAKE) -C ../MQDB

zdx:
	$(MAKE) -C ../ZDX

eedb:
	$(MAKE) -C ../EEDB

clean:
	rm -f *.o *cgi

cleanobj :
	rm *.o
     
