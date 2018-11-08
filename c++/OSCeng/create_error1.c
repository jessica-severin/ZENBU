#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <limits.h>



typedef struct {
  long      id;
  int       length;
  char      *name;
  char      *seq;
  void      *prev_tag;
  void      *next_tag;
} seqtag_t;

/*************************************
 * prototypes
 *************************************/
seqtag_t* readtags(char* path);
void create_errors(char* tagseq);
seqtag_t*  parse_tag_line(char* line);
void print_tag(seqtag_t *tag);

/*************************************
 * main
 *************************************/

int main() {
  seqtag_t *start_tag, *tag;
  int      count=0;

  start_tag = readtags("sampletags2");
  tag = start_tag;
  while(tag != NULL) {
    tag = tag->next_tag;
    count++;
  }
  printf("looped %d tags\n", count);

  exit(0);
}

/*************************************
 * now all the subroutines
 *************************************/

void create_errors(char* tagseq) {
  printf("%s\n", tagseq);
}

seqtag_t* readtags(char* path) {
  int        x, readCount;
  FILE       *fp;
  long long  byteCount=0, bufferCount=0;
  char       *buffer, *readbuf, *linebuf;
  int        bufsize = 1024*1024;
  int        readBufSize = 8192;
  time_t     starttime, runtime;
  double     mbytes;
  char       *bufptr, *bufptr2, *bufend;
  int        linecount = 0;
  seqtag_t   *tag, *first_tag=NULL, *last_tag=NULL;
  
  printf("long : %d bytes\n", sizeof(bufferCount));
  fp = fopen(path, "r");
  buffer = (char*)malloc(bufsize);
  memset(buffer, 0, bufsize);
  linebuf = (char*)malloc(bufsize);
  readbuf = (char*)malloc(readBufSize + 1000);

  starttime = time(0);
  while(!feof(fp)) {
    readCount = (int)fread(readbuf, 1, readBufSize, fp);
    bufferCount++;
    byteCount = byteCount + readCount;
    if(bufferCount % 1000 == 0) {
      printf("  read %1.3f Mbytes\t%d lines\n", ((double)(byteCount))/(1024.0*1024.0), linecount);
    }
    strncat(buffer, readbuf, readCount);
    //printf("new buffer length : %d\n", strlen(buffer));
    bufptr = buffer;
    bufptr2 = buffer;
    bufend = buffer + strlen(buffer); /* points at the \0 added by strncat()*/

    while(bufptr2 < bufend) {
      while((bufptr2 < bufend) && (*bufptr2 != '\n')) { bufptr2++; }        
      if(*bufptr2 == '\n') {
        *bufptr2 = '\0';
        linecount++;
        //printf("LINE %7d : %s\n", linecount, bufptr);
        tag = parse_tag_line(bufptr);
	if(first_tag==NULL) {
	  first_tag=tag;
	  last_tag=tag;
	} else {
	  last_tag->next_tag = tag;
	  tag->prev_tag = last_tag;
	  last_tag = tag;
	}

        bufptr2 = bufptr = bufptr2+1;
      } else {
	/* not an end of line means we ran off the buffer
	   so we need to shift the rest of the buffer 
	   to the beginning and break out to read more
	   of the file */
        strcpy(buffer, bufptr);
      }
    }
    //if(linecount > 1000000) { break; }
  }
  
  mbytes = ((double)(byteCount))/(1024.0*1024.0);
  runtime = time(0) - starttime;
  printf("just read %d lines\n", linecount);
  printf("just read %1.3f Mbytes\n", mbytes);
  printf("  %1.3f secs\n", (float)runtime);
  printf("  %1.3f mbytes/sec\n", mbytes/runtime); 

  return first_tag;
}


seqtag_t*  parse_tag_line(char* line) {
  seqtag_t  *tag;
  char      *ptr = line;
  char      *str;
  int       col=0;

  tag = (seqtag_t*)malloc(sizeof(seqtag_t));
  memset(tag, 0, sizeof(tag));

  //printf("LINE : %s\n", line);
  while((ptr = strsep(&line, " \t")) != NULL) {
    if(*ptr== '\0') { break; }
    if(*ptr== '\n') { break; }
    col++;
    //printf(" %d : '%s'\n", col, ptr);
    if(col==1) { tag->id = strtol(ptr, NULL, 10); }
    if(col==3) {
      tag->name = (char*)malloc(strlen(ptr)+1);
      strcpy(tag->name, ptr);
    }
    if(col==4) { 
      tag->length = atoi(ptr); 
    }
    if(col==5) {
      str = (char*)malloc(strlen(ptr)+1);
      strcpy(str, ptr);
      tag->seq = str;
    }
  }
  //print_tag(tag);

  return tag;
}

void print_tag(seqtag_t *tag) {
  printf("TAG(%d) %s :[%d] %s\n", tag->id, tag->name, tag->length, tag->seq);
}

void unlink_tag(seqtag_t *tag) {
  seqtag_t *prev, *next;
  prev = tag->prev_tag;
}
