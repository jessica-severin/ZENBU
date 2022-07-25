CC=gcc 
CFLAGS=-Wall -O3 -I./ -I/usr/local/include -L/usr/local/lib
LIBS=-lm -lz
TESTS = eeDBeng_test.o
OBJS = eedb_obj.o eedb_feature.o eedb_chrom.o eedb_assembly.o eeDBeng_lib.o 

all:	eeDBeng

eeDBeng: $(OBJS) eeDBeng_test.o
	gcc $(CFLAGS) $(LIBS) $(OBJS) eeDBeng_test.o -o eeDBeng -lm

eeSeqEng: $(OBJS) eeSeqEng_test.o
	g++ $(CFLAGS) $(LIBS) $(OBJS) eeSeqEng_test.o -o eeSeqEng -lm

$(OBJS) : eeSeqEng.h

EESeqEng_wrap.c: EESeqEng.i
	swig -perl5 EESeqEng.i 

EESeqEng_wrap.o: EESeqEng_wrap.c
	gcc -dynamic -fPIC -c -Wall EESeqEng_wrap.c -I/System/Library/Perl/5.8.6/darwin-thread-multi-2level/CORE/

bundle: EESeqEng_wrap.o eeSeqEng_lib.o
	gcc -bundle -flat_namespace -undefined suppress -o EESeqEng.bundle EESeqEng_wrap.o eeSeqEng_lib.o -lm -lz

clean:
	rm -f eeSeqEng eeDBeng *.o *_wrap.c

cleanobj :
	rm *.o
     
