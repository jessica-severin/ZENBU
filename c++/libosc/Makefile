CC=gcc 
CFLAGS=-Wall -O3 -I./ -I/usr/local/include -L/usr/local/lib
LIBS=-lm -lz
TESTS = test.o
OBJS = oscdb.o 

all:	osc_test

osc_test: $(OBJS) test.o
	gcc $(CFLAGS) $(LIBS) $(OBJS) test.o -o osc_test

clean:
	rm -f osc_test *.o 

cleanobj :
	rm *.o
     
