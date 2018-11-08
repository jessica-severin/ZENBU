#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>
#include <sys/types.h>
#include <sys/mman.h>

#include <eeSeqEng.h>

/*************************************
 * prototypes
 *************************************/
void       test_read_index(eeSeqEng_t *self);
void       run_access_test(eeSeqEng_t *self, long rand_iterations);
void       nexttag_test(eeSeqEng_t* eeSeqEng);

/*************************************
 * main
 *************************************/

int main(int argc, char *argv[]) {
  seqtag_t    *tag;
  int         i;
  eeSeqEng_t  *eeSeqEng;
  double      runtime;
  char        *infile=NULL;
  long        rand_iterations = 5000;

  eeSeqEng = eeseq_new();
  //eeSeqEng->file_path = "s19_expression2";
  //eeSeqEng->file_path = "i03_expression.txt.gz";
  //eeSeqEng->file_path = "test";

  for(i=1; i<argc; i++) {
    if(argv[i][0] == '-') {
      if(strcmp(argv[i], "-idx")==0) { eeSeqEng->mode = INDEX; }
      if(strcmp(argv[i], "-stream")==0) { eeSeqEng->mode = STREAM2; }
      if(strcmp(argv[i], "-f")==0) { infile = argv[i+1]; }
      if(strcmp(argv[i], "-v")==0) { 
        if((i+1<argc) && (argv[i+1][0] != '-')) {
          eeSeqEng->debug = strtol(argv[i+1], NULL, 10);
        } else {
          eeSeqEng->debug = 1;
        }
      }
      if(strcmp(argv[i], "-id")==0) { 
        eeSeqEng->mode=ACCESS; 
        eeSeqEng->access_id = strtol(argv[i+1], NULL, 10); 
        eeSeqEng->max_lines = 1;
      }
      if(strcmp(argv[i], "-rand")==0) { 
        eeSeqEng->mode = RANDTEST;
        if(i+1 < argc) {
          rand_iterations = strtol(argv[i+1], NULL, 10); 
          if(rand_iterations == 0) { rand_iterations = 5000; }
        }
      }
      if(strcmp(argv[i], "-stdin")==0) { eeSeqEng->file_path = NULL; }
    }
  }
  eeseq_init(eeSeqEng, infile);
  
  switch(eeSeqEng->mode) {
    case ACCESS:
      eeseq_mmap_idx(eeSeqEng);
      //test_read_index(eeSeqEng);
      //run_access_test(eeSeqEng);
      tag = eeseq_access_tag(eeSeqEng, eeSeqEng->access_id);
      eeseq_print_tag(eeSeqEng, tag);
      eeseq_unlink_tag(tag);
      break;

    case RANDTEST:
      run_access_test(eeSeqEng, rand_iterations);
      break;
      
    case STREAM1:
      eeseq_readtags(eeSeqEng);
      break;

    case STREAM2:
      nexttag_test(eeSeqEng);
      break;
    
    case INDEX:
      eeseq_build_index(eeSeqEng);
      break;
  }
  if(eeSeqEng->debug) {
    runtime = (double)(clock() - eeSeqEng->startclock) / CLOCKS_PER_SEC;
    printf("runtime %1.3f secs\n", (float)runtime);
  }
  exit(0);
}


/*************************************/

void test_read_index (eeSeqEng_t *eeSeqEng) {
  int        readCount;
  long long  seek_pos;
  int        linecount = 0;
  char       outpath[1024];

  if(eeSeqEng->gzfp == NULL) { eeSeqEng->gzfp = gzopen(eeSeqEng->file_path, "rb"); }

  if(eeSeqEng->idx_fildes == 0) {
    sprintf(outpath, "%s.eeidx", eeSeqEng->file_path);
    eeSeqEng->idx_fildes = open(outpath, O_RDONLY, 0x755);
  }
  
  linecount=0;
  do {
    readCount = read(eeSeqEng->idx_fildes, &seek_pos, sizeof(long long));
    if(readCount == 8) { //one object
      printf("LINE %7d : %10lld offset\n", linecount, seek_pos);
      linecount++;
    } else {
      //printf("ERROR reading index files\n");
      //exit(1);
    }
  } while(readCount>0);
}

/*************************************/

void run_access_test (eeSeqEng_t* eeSeqEng, long rand_iterations) {
  seqtag_t   *tag;
  int        x;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  //FILE       *fp_out;
  //char       outpath[1024];
  
  eeseq_mmap_idx(eeSeqEng);

  //sprintf(outpath, "%s.rand", eeSeqEng->file_path);
  //fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  //if(self->debug) { printf("index file max ID: %lld\n", (long long)eeSeqEng->max_id); }
  eeSeqEng->startclock = clock();
  start_t = time(NULL);

  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (eeSeqEng->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    tag = eeseq_access_tag(eeSeqEng, id);
    if(eeSeqEng->debug) { eeseq_print_tag(eeSeqEng, tag); }
    //eeseq_write_exptag(fp_out, tag);
    eeseq_unlink_tag(tag);
  }
  //fclose(fp_out);
  //runtime = (double)(clock() - eeSeqEng->startclock) / CLOCKS_PER_SEC;
  runtime = (double)(time(NULL) - start_t);
  rate = rand_iterations/runtime; 
  printf("just read %ld random tags\n", rand_iterations);
  printf("  %1.3f secs\n", (float)runtime);
  if(rate>2000.0) {
    printf("  %1.3f kilo tags/sec\n", rate/1000.0); 
  } else {
    printf("  %1.3f tags/sec\n", rate); 
  }

}

void nexttag_test(eeSeqEng_t* eeSeqEng) {
  seqtag_t   *tag;
  int        iterations=10;
  double     runtime;
  double     mbytes;
  int        tagcount=0;
  int        detectable_tags=0, detect_express=0;
  int        col;
  time_t     start_t;

  eeSeqEng->startclock = clock();
  start_t = time(NULL);

  tag = eeseq_nexttag(eeSeqEng);
  while(tag) {
    //eeseq_print_tag(eeSeqEng, tag);
    //eeseq_write_exptag(fp_out, tag);
    eeseq_unlink_tag(tag);
    tag = eeseq_nexttag(eeSeqEng);
    tagcount++;
    iterations--;
    
    if(tagcount % 250000 == 0) {
      printf("  read %1.3f Mbytes\t%d lines\n", ((double)(eeSeqEng->seek_pos))/(1024.0*1024.0), tagcount);
    }

    //if(iterations<0) { tag=NULL; }
  }
  
  printf("\n%lld total expression\n", eeSeqEng->total_expression);
  for(col=0; col<eeSeqEng->exp_count; col++) {
    printf("experiment[%3d] %15s :: total_express %lld\n", col, eeSeqEng->experiments[col].full_name, eeSeqEng->experiments[col].total_express);
  }
  printf("\n");
  
  mbytes = ((double)(eeSeqEng->seek_pos))/(1024.0*1024.0);
  runtime = (double)(clock() - eeSeqEng->startclock) / CLOCKS_PER_SEC;
  //runtime = (double)(time(NULL) - start_t);
  //printf("just read %d tags\n", linecount);
  printf("tag count: %d\n", tagcount);
  printf("detectable tags: %d [%d] (%1.1f %%)\n", detectable_tags, detect_express, (detect_express *100.0 / eeSeqEng->total_expression));
  printf("just read %1.3f Mbytes\n", mbytes);
  printf("  %1.3f secs\n", (float)runtime);
  printf("  %1.3f kilolines/sec\n", tagcount/runtime/1000.0); 
  printf("  %1.3f mbytes/sec\n", mbytes/runtime);   
}


void randomize_database (eeSeqEng_t* eeSeqEng) {
  seqtag_t   *tag;
  int        x;
  long       id;
  double     runtime, rate;
  time_t     start_t;
  FILE       *fp_out;
  char       outpath[1024];
  long       rand_iterations = 100;
  
  eeseq_mmap_idx(eeSeqEng);

  sprintf(outpath, "%s.rand", eeSeqEng->file_path);
  fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  //if(self->debug) { printf("index file max ID: %lld\n", (long long)eeSeqEng->max_id); }
  eeSeqEng->startclock = clock();
  start_t = time(NULL);

  for(x=0; x<rand_iterations; x++) {
    id = floor(0.5 + (eeSeqEng->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    tag = eeseq_access_tag(eeSeqEng, id);
    eeseq_print_tag(eeSeqEng, tag);
    //eeseq_write_exptag(fp_out, tag);
    eeseq_unlink_tag(tag);
  }
  fclose(fp_out);
  //runtime = (double)(clock() - eeSeqEng->startclock) / CLOCKS_PER_SEC;
  runtime = (double)(time(NULL) - start_t);
  rate = rand_iterations/runtime; 
  printf("just read %ld random tags\n", rand_iterations);
  printf("  %1.3f secs\n", (float)runtime);
  if(rate>2000.0) {
    printf("  %1.3f kilo tags/sec\n", rate/1000.0); 
  } else {
    printf("  %1.3f tags/sec\n", rate); 
  }
}
