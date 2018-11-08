#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/time.h>

#include <oscdb.h>

/*************************************
 * prototypes
 *************************************/
void run_access_test(oscdb_t *self, long rand_iterations);
void nextobj_test(oscdb_t* self);
void access_stream_test (oscdb_t* oscdb, long rand_iterations);

/*************************************
 * main
 *************************************/

int main(int argc, char *argv[]) {
  osc_object_t   *obj;
  int         i, x;
  oscdb_t   *oscdb;
  double      runtime;
  char        *infile=NULL;
  long        rand_iterations = 5000;
  int         lines_2_stream =1;
  enum { INDEX, STREAM, ACCESS, RANDTEST, RANDSTREAM } mode;
  
  //printf("sizeof(feature_source_t) = %ld\n", sizeof(feature_source_t));
  
  mode = STREAM;
  oscdb = oscdb_new();
  //oscdb->file_path = "s19_expression2";
  //oscdb->file_path = "i03_expression.txt.gz";
  //oscdb->file_path = "test";

  for(i=1; i<argc; i++) {
    if(argv[i][0] == '-') {
      if(strcmp(argv[i], "-idx")==0) { mode = INDEX; }
      if(strcmp(argv[i], "-f")==0) { infile = argv[i+1]; }
      if(strcmp(argv[i], "-lines")==0) {       
        if((i+1<argc) && (argv[i+1][0] != '-')) {
          lines_2_stream = strtol(argv[i+1], NULL, 10);
        }
      }
      if(strcmp(argv[i], "-v")==0) { 
        if((i+1<argc) && (argv[i+1][0] != '-')) {
          oscdb->debug = strtol(argv[i+1], NULL, 10);
        } else {
          oscdb->debug = 1;
        }
      }
      if(strcmp(argv[i], "-id")==0) { 
        mode=ACCESS; 
        oscdb->access_id = strtol(argv[i+1], NULL, 10); 
      }
      if(strcmp(argv[i], "-rand")==0) { 
        mode = RANDTEST;
        if(i+1 < argc) {
          rand_iterations = strtol(argv[i+1], NULL, 10); 
          if(rand_iterations == 0) { rand_iterations = 5000; }
        }
      }
      if(strcmp(argv[i], "-rand2")==0) { 
        mode = RANDSTREAM;
        if(i+1 < argc) {
          rand_iterations = strtol(argv[i+1], NULL, 10); 
          if(rand_iterations == 0) { rand_iterations = 5000; }
        }
      }
      if(strcmp(argv[i], "-stdin")==0) { oscdb->file_path = NULL; }
    }
  }
  oscdb_init(oscdb, infile);
  
  switch(mode) {
    case ACCESS:
      obj = oscdb_access_object(oscdb, oscdb->access_id);
      osc_object_print(obj);
      osc_object_delete(obj);
      for(x=1; x<lines_2_stream; x++) {
        obj = oscdb_next_object(oscdb);
        osc_object_print(obj);
        osc_object_delete(obj);
      }
      break;

    case RANDTEST:
      run_access_test(oscdb, rand_iterations);
      break;
      
    case RANDSTREAM:
      access_stream_test(oscdb, rand_iterations);
      break;

    case STREAM:
      nextobj_test(oscdb);
      break;
    
    case INDEX:
      oscdb_build_index(oscdb);
      break;
  }
  if(oscdb->debug) {
    runtime = (double)(clock() - oscdb->startclock) / CLOCKS_PER_SEC;
    printf("runtime %1.3f secs\n", (float)runtime);
  }
  
  exit(0);
}



/*************************************/

void run_access_test (oscdb_t* oscdb, long rand_iterations) {
  osc_object_t  *obj;
  int        x;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  //FILE       *fp_out;
  //char       outpath[1024];
  
  //sprintf(outpath, "%s.rand", oscdb->file_path);
  //fp_out = fopen(outpath, "w");

  srand(time(NULL));
  oscdb_access_object(oscdb, 0); //need to fix this

  //if(self->debug) { printf("index file max ID: %lld\n", (long long)oscdb->max_id); }
  oscdb->startclock = clock();
  start_t = time(NULL);
  
  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (oscdb->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%ld\n", id);
    obj = oscdb_access_object(oscdb, id);
    if(oscdb->debug) { osc_object_print(obj); }
    //eedb_write_expobj(fp_out, obj);
    osc_object_delete(obj);
  }
  //fclose(fp_out);
  //runtime = (double)(clock() - oscdb->startclock) / CLOCKS_PER_SEC;
  runtime = (double)(time(NULL) - start_t);
  rate = rand_iterations/runtime; 
  printf("just read %ld random objs\n", rand_iterations);
  printf("  %1.3f secs\n", (float)runtime);
  if(rate>2000.0) {
    printf("  %1.3f kilo objs/sec\n", rate/1000.0); 
  } else {
    printf("  %1.3f objs/sec\n", rate); 
  }
}


void nextobj_test(oscdb_t* oscdb) {
  osc_object_t  *obj;
  int        iterations=10;
  double     runtime;
  double     mbytes, rate;
  int        objcount=0;
  struct timeval   starttime,endtime,difftime;

  gettimeofday(&starttime, NULL);

  obj = oscdb_next_object(oscdb);
  while(obj) {
    if(oscdb->debug) { osc_object_print(obj); }
    //eedb_write_expobj(fp_out, obj);
    osc_object_delete(obj);
    obj = oscdb_next_object(oscdb);
    objcount++;
    iterations--;
    
    if(objcount % 250000 == 0) {
      printf("  read %1.3f Mbytes\t%d lines\n", ((double)(oscdb->seek_pos))/(1024.0*1024.0), objcount);
    }

    //if(iterations<0) { obj=NULL; }
  }
    
  mbytes = ((double)(oscdb->seek_pos))/(1024.0*1024.0);

  gettimeofday(&endtime, NULL);
  timersub(&endtime, &starttime, &difftime);
  runtime = (double)difftime.tv_sec + ((double)difftime.tv_usec)/1000000.0;  

  rate = objcount/runtime; 

  printf("obj count: %d\n", objcount);
  printf("just read %1.3f Mbytes\n", mbytes);
  printf("  %1.3f secs\n", (float)runtime);
  printf("  %1.3f mbytes/sec\n", mbytes/runtime);   
  if(rate>1000000.0) {
    printf("  %1.3f mega objs/sec\n", rate/1000000.0); 
  } else if(rate>2000.0) {
    printf("  %1.3f kilo objs/sec\n", rate/1000.0); 
  } else {
    printf("  %1.3f objs/sec\n", rate); 
  }
}


void access_stream_test (oscdb_t* oscdb, long rand_iterations) {
  osc_object_t  *obj;
  int        x, y;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  int        stream_slice = 1000;
  //FILE       *fp_out;
  //char       outpath[1024];
  
  //sprintf(outpath, "%s.rand", oscdb->file_path);
  //fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  //if(self->debug) { printf("index file max ID: %lld\n", (long long)oscdb->max_id); }
  oscdb->startclock = clock();
  start_t = time(NULL);
  rand_iterations /= stream_slice;

  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (oscdb->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    obj = oscdb_access_object(oscdb, id);
    if(oscdb->debug) { osc_object_print(obj); }
    //eedb_write_expobj(fp_out, obj);
    osc_object_delete(obj);
    
    for(y=1; y<stream_slice; y++) {
      obj = oscdb_next_object(oscdb);
      if(obj) {
        if(oscdb->debug > 1) { osc_object_print(obj); }
        osc_object_delete(obj);
      }
    }
  }
  //fclose(fp_out);
  //runtime = (double)(clock() - oscdb->startclock) / CLOCKS_PER_SEC;
  runtime = (double)(time(NULL) - start_t);
  rate = (rand_iterations*stream_slice)/runtime; 
  printf("just read %ld random objs\n", (rand_iterations*stream_slice));
  printf("  %1.3f secs\n", (float)runtime);
  if(rate>1000000.0) {
    printf("  %1.3f mega objs/sec\n", rate/1000000.0); 
  } else if(rate>2000.0) {
    printf("  %1.3f kilo objs/sec\n", rate/1000.0); 
  } else {
    printf("  %1.3f objs/sec\n", rate); 
  }
}

void randomize_database (oscdb_t* oscdb) {
  osc_object_t  *obj;
  int        x;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  FILE       *fp_out;
  char       outpath[1024];
  long       rand_iterations = 100;
  
  sprintf(outpath, "%s.rand", oscdb->file_path);
  fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  //if(self->debug) { printf("index file max ID: %lld\n", (long long)oscdb->max_id); }
  oscdb->startclock = clock();
  start_t = time(NULL);

  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (oscdb->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    obj = oscdb_access_object(oscdb, id);
    osc_object_print(obj);
    //eedb_write_expobj(fp_out, obj);
    osc_object_delete(obj);
  }
  fclose(fp_out);
  //runtime = (double)(clock() - oscdb->startclock) / CLOCKS_PER_SEC;
  runtime = (double)(time(NULL) - start_t);
  rate = rand_iterations/runtime; 
  printf("just read %ld random objs\n", rand_iterations);
  printf("  %1.3f secs\n", (float)runtime);
  if(rate>2000.0) {
    printf("  %1.3f kilo objs/sec\n", rate/1000.0); 
  } else {
    printf("  %1.3f objs/sec\n", rate); 
  }
}


