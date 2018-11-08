MAKE=make
CC=gcc
CPP=g++
CFLAGS   = -Wall -O3 -I./ -I../ -I/usr/local/include -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.2/ -I../samtools-1.2/htslib-1.2.1
CPPFLAGS = -O3 -I./ -I../ -I/usr/local/include -I/usr/local/mysql/include -I/usr/include/mysql -I/usr/local/boost/ \
           -I../rapidxml-1.13/ -I../samtools-1.2/ -I../samtools-1.2/htslib-1.2.1
LIBFLAGS = -L../EEDB -L../MQDB -L../ZDX -L../lz4 -L../samtools-1.2 -L../samtools-1.2/htslib-1.2.1 -L/usr/lib64/mysql -L/usr/local/lib -L/usr/local/mysql/lib
LIBS = -lm -leedb -lmqdb -lzdx -llz4 -lmysqlclient -lfcgi -lsqlite3 -lz -lhts -lbam -lcurl -lssl -lcrypto -pthread
SRCS_C = 
SRCS   = $(SRCS_C)
OBJS   = $(SRCS_C:.cpp=.o)

all:	lz4 mqdb zdx eedb zenbu_federation_upgrade zenbu_edit_source_metadata zenbu_create_OSCFileDB zenbu_test_peer \
	zenbu_register_peer zenbu_lsarchive_sync zenbu_create_filedb zenbu_config_manager zenbu_track_builder zenbu_job_runner \
        zenbutools zenbu_upload zenbu_ncbi_genome_load

zenbu_register_peer:	mqdb eedb zenbu_register_peer.o
	$(CPP) $(CPPFLAGS) zenbu_register_peer.o $(LIBFLAGS) $(LIBS) -o zenbu_register_peer

zenbu_edit_source_metadata:	mqdb eedb zenbu_edit_source_metadata.o
	$(CPP) $(CPPFLAGS) zenbu_edit_source_metadata.o $(LIBFLAGS) $(LIBS) -o zenbu_edit_source_metadata

zenbu_federation_upgrade:	mqdb eedb zenbu_federation_upgrade.o
	$(CPP) $(CPPFLAGS) zenbu_federation_upgrade.o $(LIBFLAGS) $(LIBS) -o zenbu_federation_upgrade

zenbu_create_OSCFileDB:	mqdb eedb zenbu_create_OSCFileDB.o
	$(CPP) $(CPPFLAGS) zenbu_create_OSCFileDB.o $(LIBFLAGS) $(LIBS) -o zenbu_create_OSCFileDB

zenbu_create_filedb:	mqdb eedb zenbu_create_filedb.o
	$(CPP) $(CPPFLAGS) zenbu_create_filedb.o $(LIBFLAGS) $(LIBS) -o zenbu_create_filedb

zenbu_test_peer:	mqdb eedb zenbu_test_peer.o
	$(CPP) $(CPPFLAGS) zenbu_test_peer.o $(LIBFLAGS) $(LIBS) -o zenbu_test_peer

zenbu_lsarchive_sync:	mqdb eedb zenbu_lsarchive_sync.o
	$(CPP) $(CPPFLAGS) zenbu_lsarchive_sync.o $(LIBFLAGS) $(LIBS) -o zenbu_lsarchive_sync

zenbu_config_manager:	mqdb eedb zenbu_config_manager.o
	$(CPP) $(CPPFLAGS) zenbu_config_manager.o $(LIBFLAGS) $(LIBS) -o zenbu_config_manager

zenbu_track_builder:	mqdb eedb zenbu_track_builder.o
	$(CPP) $(CPPFLAGS) zenbu_track_builder.o $(LIBFLAGS) $(LIBS) -o zenbu_track_builder

zenbu_job_runner:	mqdb eedb zenbu_job_runner.o
	$(CPP) $(CPPFLAGS) zenbu_job_runner.o $(LIBFLAGS) $(LIBS) -o zenbu_job_runner

zenbutools:	mqdb eedb zenbutools.o
	$(CPP) $(CPPFLAGS) zenbutools.o $(LIBFLAGS) $(LIBS) -o zenbutools

zenbu_upload:	mqdb eedb zenbu_upload.o
	$(CPP) $(CPPFLAGS) zenbu_upload.o $(LIBFLAGS) $(LIBS) -o zenbu_upload

zenbu_ncbi_genome_load:	mqdb eedb zenbu_ncbi_genome_load.o
	$(CPP) $(CPPFLAGS) zenbu_ncbi_genome_load.o $(LIBFLAGS) $(LIBS) -o zenbu_ncbi_genome_load

lz4: 
	$(MAKE) -C ../lz4

mqdb: 
	$(MAKE) -C ../MQDB

zdx:
	$(MAKE) -C ../ZDX

eedb:
	$(MAKE) -C ../EEDB

clean:
	rm -f *.o  zenbu_edit_source_metadata zenbu_federation_upgrade zenbu_lsarchive_sync zenbu_register_peer zenbutools zenbu_upload \
           zenbu_test_peer zenbu_create_OSCFileDB  zenbu_track_builder zenbu_create_filedb zenbu_job_runner zenbu_config_manager \
	   zenbu_ncbi_genome_load

install:
	cp -f zenbu_edit_source_metadata zenbu_federation_upgrade zenbu_lsarchive_sync zenbu_register_peer zenbu_upload \
           zenbu_test_peer zenbu_create_OSCFileDB zenbu_job_runner zenbu_track_builder zenbu_create_filedb zenbu_agent_launcher.sh \
           zenbu_config_manager zenbu_ncbi_genome_load \
           /usr/local/bin/

cleanobj :
	rm *.o
     
