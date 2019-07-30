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

cleanobj :
	rm *.o

