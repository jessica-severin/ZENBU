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

#include <eeDBeng.h>
#include <eedb_feature.h>
#include <eedb_chrom.h>
#include <eedb_assembly.h>

/*************************************
 * prototypes
 *************************************/
void run_access_test(eeDBeng_t *self, long rand_iterations);
void nextobj_test(eeDBeng_t* self);
void access_stream_test (eeDBeng_t* eeDBeng_i, long rand_iterations);

/*************************************
 * main
 *************************************/

int main(int argc, char *argv[]) {
  eedb_obj_t   *obj;
  int         i, x;
  eeDBeng_t   *eeDBeng_i;
  double      runtime;
  char        *infile=NULL;
  long        rand_iterations = 5000;
  int         lines_2_stream =1;
  enum { INDEX, STREAM, ACCESS, RANDTEST, RANDSTREAM } mode;
  
  //printf("sizeof(feature_source_t) = %ld\n", sizeof(feature_source_t));
  
  mode = STREAM;
  eeDBeng_i = eedb_new();
  //eeDBeng_i->file_path = "s19_expression2";
  //eeDBeng_i->file_path = "i03_expression.txt.gz";
  //eeDBeng_i->file_path = "test";

  for(i=1; i<argc; i++) {
    if(argv[i][0] == '-') {
      if(strcmp(argv[i], "-idx")==0) { mode = INDEX; }
      if(strcmp(argv[i], "-f")==0) { infile = argv[i+1]; }
      if(strcmp(argv[i], "-feature")==0) { eeDBeng_i->obj_class = FEATURE; }
      if(strcmp(argv[i], "-chrom")==0) { eeDBeng_i->obj_class = CHROM; }
      if(strcmp(argv[i], "-assembly")==0) { eeDBeng_i->obj_class = ASSEMBLY; }
      if(strcmp(argv[i], "-lines")==0) {       
        if((i+1<argc) && (argv[i+1][0] != '-')) {
          lines_2_stream = strtol(argv[i+1], NULL, 10);
        }
      }
      if(strcmp(argv[i], "-v")==0) { 
        if((i+1<argc) && (argv[i+1][0] != '-')) {
          eeDBeng_i->debug = strtol(argv[i+1], NULL, 10);
        } else {
          eeDBeng_i->debug = 1;
        }
      }
      if(strcmp(argv[i], "-id")==0) { 
        mode=ACCESS; 
        eeDBeng_i->access_id = strtol(argv[i+1], NULL, 10); 
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
      if(strcmp(argv[i], "-stdin")==0) { eeDBeng_i->file_path = NULL; }
    }
  }
  eedb_init(eeDBeng_i, infile);
  
  switch(mode) {
    case ACCESS:
      obj = eedb_access_object(eeDBeng_i, eeDBeng_i->access_id);
      eedb_print_obj(obj);
      eedb_obj_unlink(obj);
      for(x=1; x<lines_2_stream; x++) {
        obj = eedb_next_object(eeDBeng_i);
        eedb_print_obj(obj);
        eedb_obj_unlink(obj);
      }
      break;

    case RANDTEST:
      run_access_test(eeDBeng_i, rand_iterations);
      break;
      
    case RANDSTREAM:
      access_stream_test(eeDBeng_i, rand_iterations);
      break;

    case STREAM:
      nextobj_test(eeDBeng_i);
      break;
    
    case INDEX:
      eedb_build_index(eeDBeng_i);
      break;
  }
  if(eeDBeng_i->debug) {
    runtime = (double)(clock() - eeDBeng_i->startclock) / CLOCKS_PER_SEC;
    printf("runtime %1.3f secs\n", (float)runtime);
  }
  
  exit(0);
}



/*************************************/

void run_access_test (eeDBeng_t* eeDBeng_i, long rand_iterations) {
  eedb_obj_t  *obj;
  int        x;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  //FILE       *fp_out;
  //char       outpath[1024];
  
  //sprintf(outpath, "%s.rand", eeDBeng_i->file_path);
  //fp_out = fopen(outpath, "w");

  srand(time(NULL));
  eedb_access_object(eeDBeng_i, 0); //need to fix this

  //if(self->debug) { printf("index file max ID: %lld\n", (long long)eeDBeng_i->max_id); }
  eeDBeng_i->startclock = clock();
  start_t = time(NULL);
  
  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (eeDBeng_i->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%ld\n", id);
    obj = eedb_access_object(eeDBeng_i, id);
    if(eeDBeng_i->debug) { eedb_print_obj(obj); }
    //eedb_write_expobj(fp_out, obj);
    eedb_obj_unlink(obj);
  }
  //fclose(fp_out);
  //runtime = (double)(clock() - eeDBeng_i->startclock) / CLOCKS_PER_SEC;
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


void nextobj_test(eeDBeng_t* eeDBeng_i) {
  eedb_obj_t  *obj;
  int        iterations=10;
  double     runtime;
  double     mbytes, rate;
  int        objcount=0;
  struct timeval   starttime,endtime,difftime;

  gettimeofday(&starttime, NULL);

  obj = eedb_next_object(eeDBeng_i);
  while(obj) {
    if(eeDBeng_i->debug) { eedb_print_obj(obj); }
    //eedb_write_expobj(fp_out, obj);
    eedb_obj_unlink(obj);
    obj = eedb_next_object(eeDBeng_i);
    objcount++;
    iterations--;
    
    if(objcount % 250000 == 0) {
      printf("  read %1.3f Mbytes\t%d lines\n", ((double)(eeDBeng_i->seek_pos))/(1024.0*1024.0), objcount);
    }

    //if(iterations<0) { obj=NULL; }
  }
    
  mbytes = ((double)(eeDBeng_i->seek_pos))/(1024.0*1024.0);

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


void access_stream_test (eeDBeng_t* eeDBeng_i, long rand_iterations) {
  eedb_obj_t  *obj;
  int        x, y;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  int        stream_slice = 1000;
  //FILE       *fp_out;
  //char       outpath[1024];
  
  //sprintf(outpath, "%s.rand", eeDBeng_i->file_path);
  //fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  //if(self->debug) { printf("index file max ID: %lld\n", (long long)eeDBeng_i->max_id); }
  eeDBeng_i->startclock = clock();
  start_t = time(NULL);
  rand_iterations /= stream_slice;

  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (eeDBeng_i->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    obj = eedb_access_object(eeDBeng_i, id);
    if(eeDBeng_i->debug) { eedb_print_obj(obj); }
    //eedb_write_expobj(fp_out, obj);
    eedb_obj_unlink(obj);
    
    for(y=1; y<stream_slice; y++) {
      obj = eedb_next_object(eeDBeng_i);
      if(obj) {
        if(eeDBeng_i->debug > 1) { eedb_print_obj(obj); }
        eedb_obj_unlink(obj);
      }
    }
  }
  //fclose(fp_out);
  //runtime = (double)(clock() - eeDBeng_i->startclock) / CLOCKS_PER_SEC;
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

void randomize_database (eeDBeng_t* eeDBeng_i) {
  eedb_obj_t  *obj;
  int        x;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  FILE       *fp_out;
  char       outpath[1024];
  long       rand_iterations = 100;
  
  sprintf(outpath, "%s.rand", eeDBeng_i->file_path);
  fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  //if(self->debug) { printf("index file max ID: %lld\n", (long long)eeDBeng_i->max_id); }
  eeDBeng_i->startclock = clock();
  start_t = time(NULL);

  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (eeDBeng_i->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    obj = eedb_access_object(eeDBeng_i, id);
    eedb_print_obj(obj);
    //eedb_write_expobj(fp_out, obj);
    eedb_obj_unlink(obj);
  }
  fclose(fp_out);
  //runtime = (double)(clock() - eeDBeng_i->startclock) / CLOCKS_PER_SEC;
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


