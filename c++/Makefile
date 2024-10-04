MAKE=make
CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I/usr/local/include -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
	   -L/usr/lib64/mysql -L/usr/local/lib -L/usr/local/mysql/lib -L./EEDB -L./MQDB
CPPFLAGS = -O3 -I./ -I../ -I/usr/local/include -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
	   -L/usr/lib64/mysql -L/usr/local/lib -L/usr/local/mysql/lib -L./EEDB -L./MQDB
LIBS =-lm -lz -lsqlite3 -lmqdb -leedb -lmqdb -lmysqlclient
SRCS_C = 
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all:	samtools	
	$(MAKE) -C lz4
	$(MAKE) -C MQDB
	$(MAKE) -C ZDX
	$(MAKE) -C EEDB
	$(MAKE) -C cgi
	$(MAKE) -C tools

clean:
	rm -f *.o zenbu_test
	rm -rf samtools-1.5
	rm -f include/zenbu/*/*.h include/zenbu/*/*/*.h
	$(MAKE) -C lz4 clean
	$(MAKE) -C EEDB clean
	$(MAKE) -C MQDB clean
	$(MAKE) -C ZDX clean
	$(MAKE) -C OSCeng clean
	$(MAKE) -C cgi clean
	$(MAKE) -C tools clean
	$(MAKE) -C tests clean

samtools:
	if [ ! -d samtools-1.5 ] ; then  tar xjf samtools-1.5.tar.bz2 ; fi
	$(MAKE) -C samtools-1.5

lz4:
	$(MAKE) -C lz4

mqdb:
	$(MAKE) -C MQDB

zdx:
	$(MAKE) -C ZDX

eedb:
	$(MAKE) -C EEDB


cleanobj :
	rm *.o

includedir: 
	cp MQDB/*.h include/zenbu/MQDB/
	cp ZDX/*.h include/zenbu/ZDX/
	cp EEDB/*.h include/zenbu/EEDB/
	cp EEDB/JobQueue/*.h include/zenbu/EEDB/JobQueue/
	cp EEDB/SPStreams/*.h include/zenbu/EEDB/SPStreams/
	cp EEDB/Tools/*.h include/zenbu/EEDB/Tools/
	cp EEDB/WebServices/*.h include/zenbu/EEDB/WebServices/
	cp EEDB/ZDX/*.h include/zenbu/EEDB/ZDX
	chmod -R +r include

libzenbu:	samtools lz4 mqdb zdx eedb includedir
	ar sr libzenbu.a MQDB/*.o ZDX/*.o EEDB/*.o EEDB/JobQueue/*.o EEDB/SPStreams/*.o EEDB/Tools/*.o EEDB/WebServices/*.o EEDB/ZDX/*.o 
	chmod -R +r include
	cp -f libzenbu.a /usr/local/lib/
	cp -frp include/zenbu /usr/local/include/



