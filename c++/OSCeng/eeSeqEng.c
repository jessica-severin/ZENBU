#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>
#include <sys/types.h>
#include <sys/mman.h>

#define READ_BUF_SIZE   8192
#define BUFSIZE         1024*1024 

typedef struct {
  long      id;
  int       length;
  char      *seq;
  int       exp_count;
  int       express[10];
  int       total_express;
  void      *prev_tag;
  void      *next_tag;
} seqtag_t;

typedef struct {
  char        *full_name;
  long long   total_express;
} experiment_t;

typedef struct {
  int               debug;
  char              *file_path;
  gzFile            *fp;
  int               idx_fildes;
  int               data_fildes;
  long long         *idx_mmap;
  long long         max_id;
  clock_t           startclock;
  int               exp_count;
  experiment_t      experiments[10];
  int               access_id;
  int               max_lines;
  long long         total_expression;
  enum {INDEX, STREAM, ACCESS, RANDTEST}  mode;
  char              *buffer, *readbuf, *linebuf;
  long              rand_iterations;
} params_t;


/*************************************
 * prototypes
 *************************************/
void       read_experiments(params_t *params);
void       mmap_idx(params_t *params);
void       readtags(params_t* params);
void       parse_exp_line(params_t* params, char* line);
seqtag_t*  parse_tag_line(params_t* params, char* line, int linenum);
void       print_tag(params_t* params, seqtag_t *tag);
void       write_exptag(FILE *fp, seqtag_t *tag);
void       unlink_tag(seqtag_t *tag);
void       process_line(params_t* params, char* line);
seqtag_t*  access_tag(params_t *params, long long id);
void       test_read_index (params_t *params);
void       run_access_test(params_t* params);
void       finger_print_tag(seqtag_t *tag);

/*************************************
 * main
 *************************************/

int main(int argc, char *argv[]) {
  seqtag_t    *tag;
  int         i;
  params_t    params;
  double      runtime;

  memset(&params, 0, sizeof(params));

  params.file_path = "i03_expression.txt.gz";
  //params.file_path  = NULL;
  params.mode = STREAM;
  params.max_lines = -1;
  params.debug = 0;
  params.fp = NULL;
  params.startclock = clock();
  params.rand_iterations = 5000;

  params.file_path = "s19_expression2";
  //params.file_path = "i03_expression.txt.gz";
  //params.file_path = "test";

  for(i=1; i<argc; i++) {
    if(argv[i][0] == '-') {
      if(strcmp(argv[i], "-idx")==0) { params.mode = INDEX; }
      if(strcmp(argv[i], "-stream")==0) { params.mode = STREAM; }
      if(strcmp(argv[i], "-v")==0) { params.debug = 1; }
      if(strcmp(argv[i], "-f")==0) { params.file_path = argv[i+1]; }
      if(strcmp(argv[i], "-id")==0) { 
        params.mode=ACCESS; 
        params.access_id = strtol(argv[i+1], NULL, 10); 
        params.max_lines = 1;
      }
      if(strcmp(argv[i], "-rand")==0) { 
        params.mode = RANDTEST;
        params.rand_iterations = strtol(argv[i+1], NULL, 10); 
	if(params.rand_iterations == 0) { params.rand_iterations = 5000; }
      }

      if(strcmp(argv[i], "-stdin")==0) { params.file_path = NULL; }
    }
  }

  read_experiments(&params);
  
  switch(params.mode) {
    case ACCESS:
      mmap_idx(&params);
      //test_read_index(&params);
      //run_access_test(&params);
      tag = access_tag(&params, params.access_id);
      print_tag(&params, tag);
      unlink_tag(tag);
      break;

    case RANDTEST:
      mmap_idx(&params);
      run_access_test(&params);
      break;
      
    case STREAM:
    case INDEX:
      readtags(&params);
      break;      
  }
  if(params.debug) {
    runtime = (double)(clock() - params.startclock) / CLOCKS_PER_SEC;
    printf("runtime %1.3f secs\n", (float)runtime);
  }
  exit(0);
}

/*************************************
 * now all the subroutines
 *************************************/

void read_experiments(params_t *params) {
  int        readCount;
  char       *bufptr, *bufptr2, *bufend;

  if(params->fp == NULL) { params->fp = gzopen(params->file_path, "rb"); }

  if(params->buffer == NULL) {
    params->buffer = (char*)malloc(BUFSIZE);
    params->linebuf = (char*)malloc(BUFSIZE);
    params->readbuf = (char*)malloc(READ_BUF_SIZE + 1000);  
  }
  memset(params->buffer, 0, BUFSIZE);
  
  readCount = gzread(params->fp, params->readbuf, READ_BUF_SIZE);
  strncat(params->buffer, params->readbuf, readCount);
  //printf("new buffer length : %d\n", strlen(buffer));
  bufptr = params->buffer;
  bufptr2 = params->buffer;
  bufend = params->buffer + strlen(params->buffer); /* points at the \0 added by strncat()*/

  while((bufptr2 < bufend) && (*bufptr2 != '\0') && (*bufptr2 != '\n')) { bufptr2++; }

  if(*bufptr2 == '\n') {
    *bufptr2 = '\0';
    if(*bufptr=='#') {
      parse_exp_line(params, bufptr);
    }
  }
  //now seek to the end of the experiment line
  //seek_pos = (bufptr2 +1 - buffer);
  //gzseek(params->fp, seek_pos, SEEK_SET);
  gzrewind(params->fp);
}


/**
 * read the 'expression' file generated by the tag extraction process
 ***/
void readtags(params_t *params) {
  int        readCount;
  FILE       *fp_out;
  FILE       *fp_idx = NULL;
  long long  byteCount=0, bufferCount=0, seek_pos;
  char       *buffer, *readbuf, *linebuf;
  int        bufsize = 1024*1024;
  double     runtime;
  double     mbytes;
  char       *bufptr, *bufptr2, *bufend;
  int        linecount = 0;
  int        tagcount=0;
  int        detectable_tags=0, detect_express=0;
  int        col;
  char       outpath[1024];
  seqtag_t   *tag;

  if(params->fp == NULL) { params->fp = gzopen(params->file_path, "rb"); }

  if(params->mode == INDEX) {
    sprintf(outpath, "%s.eeidx", params->file_path);
    fp_idx = fopen(outpath, "w");
  }
  
  sprintf(outpath, "%s.copy", params->file_path);
  fp_out = fopen(outpath, "w");
  
  printf("long : %lud bytes\n", sizeof(bufferCount));
  buffer = (char*)malloc(bufsize);
  memset(buffer, 0, bufsize);
  linebuf = (char*)malloc(bufsize);
  readbuf = (char*)malloc(READ_BUF_SIZE + 1000);  
    
  if(params->mode == ACCESS) {
    gzseek(params->fp, (z_off_t)params->access_id, SEEK_SET);
  }

  while(!gzeof(params->fp)) {
    readCount = gzread(params->fp, readbuf, READ_BUF_SIZE);
    bufferCount++;
    strncat(buffer, readbuf, readCount);
    //printf("new buffer length : %d\n", strlen(buffer));
    bufptr = buffer;
    bufptr2 = buffer;
    bufend = buffer + strlen(buffer); /* points at the \0 added by strncat()*/

    while(bufptr2 < bufend) {
      while((bufptr2 < bufend) && (*bufptr2 != '\0') && (*bufptr2 != '\n')) { bufptr2++; }
      if(*bufptr2 == '\n') {
        *bufptr2 = '\0';
        seek_pos = byteCount + (bufptr - buffer);
        //printf("LINE %7d : %10lld offset :: %s \n", linecount, seek_pos, bufptr);
        //fprintf(fp_out, "%s\n", bufptr);

        //
        // do things with the line buffer here
        //
        switch (params->mode) {
          case STREAM:
            tag = parse_tag_line(params, bufptr, linecount);
            if(tag) { 
              tagcount++; 
              if(params->debug) { print_tag(params, tag); }
              if(tag->total_express > 7) {
                detectable_tags++; 
                detect_express += tag->total_express;
                write_exptag(fp_out, tag);
              }
            }
            unlink_tag(tag);
            break;
            
          case INDEX:
            //fprintf(fp_out, "%s\n", bufptr);
            if((*bufptr!='#')&&(*bufptr!='>')) {
              fwrite(&seek_pos, sizeof(seek_pos), 1, fp_idx);
            }
            break;
          
          case ACCESS:
            tag = parse_tag_line(params, bufptr, linecount);
            print_tag(params, tag);
            unlink_tag(tag);
            //problem leave this open to stream from this point forward, but ok for now
            //gzclose(fp);
            return;
            break;

          default:
            break;
        }

        linecount++;
        bufptr2 = bufptr2+1;
        bufptr = bufptr2;
        
      }
    } //bottom of the while(bufptr2<bufend){} loop

    //update the bytecount since we are done with this buffer
    //printf("end of buffer\nstarting byteCount:%lld, readCount:%d, bufend:%d,  bufptr:%d\n", byteCount, readCount, (bufend-buffer), (bufptr-buffer));
    byteCount = byteCount + (bufptr - buffer);
    if(bufferCount % 1000 == 0) {
      printf("  read %1.3f Mbytes\t%d lines\n", ((double)(byteCount))/(1024.0*1024.0), linecount);
    }

    /* not an end of line means we ran off the buffer
       so we need to shift the rest of the buffer
       to the beginning and break out to read more
       of the file */
    strcpy(buffer, bufptr); //the end over, very efficient


  } //end of the while(!gzeof(fp)){} loop
  gzclose(params->fp);
  fclose(fp_out);
  if(params->mode == INDEX) { fclose(fp_idx); }

  printf("\n%lld total expression\n", params->total_expression);
  for(col=0; col<params->exp_count; col++) {
    printf("experiment[%3d] %15s :: total_express %lld\n", col, params->experiments[col].full_name, params->experiments[col].total_express);
  }
  printf("\n");
  
  mbytes = ((double)(byteCount))/(1024.0*1024.0);
  runtime = (double)(clock() - params->startclock) / CLOCKS_PER_SEC;
  printf("just read %d lines\n", linecount);
  printf("tag count: %d\n", tagcount);
  printf("detectable tags: %d [%d] (%1.1f %%)\n", detectable_tags, detect_express, (detect_express *100.0 / params->total_expression));
  printf("just read %1.3f Mbytes\n", mbytes);
  printf("  %1.3f secs\n", (float)runtime);
  printf("  %1.3f kilolines/sec\n", linecount/runtime/1000.0); 
  printf("  %1.3f mbytes/sec\n", mbytes/runtime); 
}


void mmap_idx(params_t *params) {
  off_t      idx_len;
  char       outpath[1024];
  void       *mmap_addr;
  
  if(params->idx_fildes == 0) {
    sprintf(outpath, "%s.eeidx", params->file_path);
    params->idx_fildes = open(outpath, O_RDONLY, 0x755);
  }
  idx_len = lseek(params->idx_fildes, 0, SEEK_END);  
  if(params->debug) { printf("index file %lld bytes long\n", (long long)idx_len); }
  lseek(params->idx_fildes, 0, SEEK_SET);
  
  mmap_addr =  mmap(NULL, idx_len, PROT_READ, MAP_FILE, params->idx_fildes, 0);
  params->idx_mmap = mmap_addr;
  params->max_id = (idx_len / sizeof(long long)) - 1;
  if(params->debug) { printf("index file max ID: %lld\n", (long long)params->max_id); }

  
  /*
  lseek(params->idx_fildes, idx_pos, SEEK_SET);
  readCount = read(params->idx_fildes, &seek_pos, sizeof(long long));
  //printf("read %d bytes\n", readCount);
  if(readCount != sizeof(long long)) { //one object
    printf("ERROR reading index files\n");
    exit(1);
  }
  //printf("LINE %7lld : %10lld offset\n", id, seek_pos);
  gzseek(params->fp, seek_pos, SEEK_SET);
  */

}


seqtag_t* access_tag(params_t *params, long long id) {
  //int        readCount;
  ssize_t    readCount;
  long long  seek_pos;
  int        bufsize = 1024*1024;
  char       *bufptr, *bufptr2, *bufend;
  char       outpath[1024];
  seqtag_t   *tag = NULL;

  if(params->data_fildes == 0) { params->data_fildes = open(params->file_path, O_RDONLY, 0x755); }

  if(params->idx_fildes == 0) {
    sprintf(outpath, "%s.eeidx", params->file_path);
    params->idx_fildes = open(outpath, O_RDONLY, 0x755);
  }
  
  if(params->buffer == NULL) {
    params->buffer = (char*)malloc(bufsize);
    params->linebuf = (char*)malloc(bufsize);
    params->readbuf = (char*)malloc(READ_BUF_SIZE + 1000);  
  }
  //memset(params->buffer, 0, bufsize);
  params->buffer[0] = '\0';

  //
  // ok now the seek magick, got to love memory-mapped binary files
  //  
  seek_pos = params->idx_mmap[id];
  if(params->debug) { printf("LINE %7lld : %10lld offset\n", id, seek_pos); }
  //gzseek(params->fp, seek_pos, SEEK_SET);
  lseek(params->data_fildes, seek_pos, SEEK_SET);  

  //
  // and now read the tag
  //
  
  //readCount = gzread(params->fp, params->readbuf, READ_BUF_SIZE);
  readCount = read(params->data_fildes, params->readbuf, 2048);

  strncat(params->buffer, params->readbuf, readCount);
  //printf("new buffer length : %d\n", strlen(buffer));
  bufptr = params->buffer;
  bufptr2 = params->buffer;
  bufend = params->buffer + strlen(params->buffer); /* points at the \0 added by strncat()*/

  while((bufptr2 < bufend) && (*bufptr2 != '\0') && (*bufptr2 != '\n')) { bufptr2++; }

  if(*bufptr2 == '\n') {
    *bufptr2 = '\0';
    if(params->debug) { printf("LINE %7lld : %10lld offset :: %s \n", id, seek_pos, bufptr); }
    tag = parse_tag_line(params, bufptr, id);
  }
  return tag;
}


void test_read_index (params_t *params) {
  int        readCount;
  long long  seek_pos;
  int        linecount = 0;
  char       outpath[1024];

  if(params->fp == NULL) { params->fp = gzopen(params->file_path, "rb"); }

  if(params->idx_fildes == 0) {
    sprintf(outpath, "%s.eeidx", params->file_path);
    params->idx_fildes = open(outpath, O_RDONLY, 0x755);
  }
  
  linecount=0;
  do {
    readCount = read(params->idx_fildes, &seek_pos, sizeof(long long));
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

seqtag_t*  parse_tag_line(params_t* params, char* line, int linenum) {
  seqtag_t  *tag;
  char      *ptr = line;
  char      *str;
  int       col=0;
  int       express=0;

  if(*line =='#') { return NULL; }
  if(*line =='>') { return NULL; }

  tag = (seqtag_t*)malloc(sizeof(seqtag_t));
  memset(tag, 0, sizeof(tag));
  tag->id = linenum;
  tag->exp_count = params->exp_count;

  //printf("LINE : %s\n", line);
  while((ptr = strsep(&line, " \t")) != NULL) {
    if(*ptr== '\0') { break; }
    if(*ptr== '\n') { break; }
    col++;
    //printf("    %d : '%s'\n", col, ptr);
    if(col==1) {
      tag->length = strlen(ptr);
      str =(char*)malloc(tag->length+1);
      strcpy(str, ptr);
      tag->seq = str;
    } else {
      express = strtol(ptr, NULL, 10); 
      if((col-2)< params->exp_count) {
        tag->express[col-2] = express;
        params->experiments[col-2].total_express += express;
      } 
    }
  }
  tag->total_express = express;
  params->total_expression += express;
  //print_tag(params, tag);
  return tag;
}


void unlink_tag(seqtag_t *tag) {
  void   *seq;

  if(tag==NULL) { return; }
  seqtag_t *prev, *next;
  prev = tag->prev_tag;
  next = tag->next_tag;
  if(prev != NULL) { prev->next_tag = next; }
  if(next != NULL) { next->prev_tag = prev; }
  seq = tag->seq;
  tag->seq = NULL;
  free(seq);
  free(tag);
}


void print_tag(params_t* params, seqtag_t *tag) {
  int col;

  if(tag == NULL) { return; }
  printf("TAG(%ld) [len:%d total:%d] %s [", tag->id, tag->length, tag->total_express, tag->seq);
  for(col=0; col<params->exp_count; col++) {
    printf("(%s : %d) ", params->experiments[col].full_name, tag->express[col]);
  }
  printf("]\n");
}


void write_exptag(FILE *fp, seqtag_t *tag) {
  int col;

  if(tag == NULL) { return; }
  fprintf(fp, "%s", tag->seq);
  for(col=0; col<tag->exp_count; col++) {
    fprintf(fp, "\t%d", tag->express[col]);
  }
  fprintf(fp, "\t%d\n", tag->total_express);
}


void finger_print_tag(seqtag_t *tag) {

}

/*************************************/

void parse_exp_line(params_t* params, char* line) {
  char      *ptr = line;
  char      *str;
  int       col=0;

  //printf("LINE : %s\n", line);
  while((ptr = strsep(&line, "\t")) != NULL) {
    if(*ptr== '\0') { break; }
    if(*ptr== '\n') { break; }
    col++;
    //printf("    %d : '%s'\n", col, ptr);
    if(col>1) {
      str =(char*)malloc(strlen(ptr)+1);
      strcpy(str, ptr);
      params->experiments[col-2].full_name = str;
      params->experiments[col-2].total_express = 0;
    }
  }
  params->exp_count = col-2;
  if(params->debug) {
    for(col=0; col<params->exp_count; col++) {
      printf("experiment[%d] = '%s'\n", col, params->experiments[col].full_name);
    }
  }
}

/*************************************/

void run_access_test (params_t* params) {
  seqtag_t   *tag;
  int        x;
  long       id;
  double     runtime;
  time_t     start_t;
  FILE       *fp_out;
  char       outpath[1024];
  
  sprintf(outpath, "%s.rand", params->file_path);
  fp_out = fopen(outpath, "w");

  srand(time(NULL));
  
  printf("index file max ID: %lld\n", (long long)params->max_id);
  params->startclock = clock();
  start_t = time(NULL);

  for(x=0; x<params->rand_iterations; x++) {
    id = floor(0.5 + (params->max_id * ((double)rand() / (double)RAND_MAX)));
    //printf("access id:%d\n", id);
    tag = access_tag(params, id);
    print_tag(params, tag);
    write_exptag(fp_out, tag);
    unlink_tag(tag);
  }
  fclose(fp_out);
  //runtime = (double)(clock() - params->startclock) / CLOCKS_PER_SEC;
  runtime = (double)(time(NULL) - start_t);
  printf("just read %ld random tags\n", params->rand_iterations);
  printf("  %1.3f secs\n", (float)runtime);
  printf("  %1.3f tags/sec\n", (params->rand_iterations)/runtime); 

}
