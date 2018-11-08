#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <limits.h>


typedef struct {
  long      id;
  int       length;
  char      name[64];
  char      seq[32];
  void      *prev_tag;
  void      *next_tag;
} seqtag_t;

typedef struct {
  int               show_orig;
  int               calc_1g;
  int               calc_1e;
  char              *file_path;
} params_t;


/*************************************
 * prototypes
 *************************************/
void       readtags(params_t* params);
void       create_errors(char* tagseq);
seqtag_t*  parse_tag_line(char* line);
void       fasta_tag(seqtag_t *tag);
void       print_tag(seqtag_t *tag);
seqtag_t*  create_tag(char* name, char* seq);
seqtag_t*  create_1G_error(seqtag_t* tag);
seqtag_t*  create_1errors(seqtag_t* tag);
seqtag_t*  create_delete(seqtag_t* tag, int pos);
seqtag_t*  create_mismatch(seqtag_t* tag, int pos, char base);
seqtag_t*  create_insert(seqtag_t* tag, int pos, char base);

void       unlink_tag(seqtag_t *tag);
void       unlink_chain(seqtag_t *tag);
seqtag_t*  last_tag(seqtag_t *tag);
seqtag_t*  first_tag(seqtag_t *tag);
seqtag_t*  merge_tag_chains(seqtag_t *tag1, seqtag_t *tag2);
void       print_tag_chain(seqtag_t *tag);
void       uniq_tag_chain(seqtag_t *tag);


/*************************************
 * main
 *************************************/

int main(int argc, char *argv[]) {
  seqtag_t *start_tag, *tag;
  int      count=0;
  int      i;
  char          *name;
  params_t      params;

  //params.file_path ="h93large1_unq.fa";
  params.file_path  = NULL;
  params.show_orig  = 0;
  params.calc_1g    = 0;
  params.calc_1e    = 0;

  for(i=1; i<argc; i++) {
    if(argv[i][0] == '-') {
      if(strcmp(argv[i], "-orig")==0) { params.show_orig = 1; }
      if(strcmp(argv[i], "-1g")==0) { params.calc_1g = 1; }
      if(strcmp(argv[i], "-1e")==0) { params.calc_1e = 1; }
      if(strcmp(argv[i], "-f")==0) { params.file_path = argv[i+1]; }
      if(strcmp(argv[i], "-stdin")==0) { params.file_path = NULL; }
    }
  }

  readtags(&params);

  exit(0);
}

/*************************************
 * now all the subroutines
 *************************************/

void readtags(params_t *params) {
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
  int        tag_count = 0;
  int        is_fasta=1;
  seqtag_t   *tag, *first_tag=NULL, *last_tag=NULL;
  seqtag_t   *edit_tag;
  char       tag_name[64];
  
  //printf("file: %s\n", params->file_path);
  if(params->file_path != NULL) {
    fp = fopen(params->file_path, "r");
  } else {
    fp = stdin;
  }
  buffer = (char*)malloc(bufsize);
  memset(buffer, 0, bufsize);
  linebuf = (char*)malloc(bufsize);
  readbuf = (char*)malloc(readBufSize + 1000);
  memset(tag_name, 0, 64);

  starttime = time(0);
  while(!feof(fp)) {
    readCount = (int)fread(readbuf, 1, readBufSize, fp);
    bufferCount++;
    byteCount = byteCount + readCount;
    if(bufferCount % 1000 == 0) {
     // printf("  read %1.3f Mbytes\t%d lines\n", ((double)(byteCount))/(1024.0*1024.0), linecount);
    }
    //memset(linebuf, 0, bufsize); 
    //strncpy(linebuf, readbuf,200);
    //printf("NEW READ : (%s)END\n", linebuf);
    strncat(buffer, readbuf, readCount);
    //printf("BUFFER : (%s)END\n", buffer);
    //printf("new buffer length : %d\n", strlen(buffer));
    bufptr = buffer;
    bufptr2 = buffer;
    bufend = buffer + strlen(buffer); /* points at the \0 added by strncat()*/

    while(bufptr2 < bufend) {
      while((bufptr2 < bufend) && (*bufptr2 != '\0') && (*bufptr2 != '\n')) { bufptr2++; }        
      if(*bufptr2 == '\n') {
        *bufptr2 = '\0';
        linecount++;
        //printf("LINE %7d : %s\n", linecount, bufptr);
        tag=NULL;
        if(is_fasta) {
          if(bufptr[0] == '>') { 
            //printf("%s\n", bufptr);
            sprintf(tag_name, "%s", bufptr+1);
            //tag_count++;
          } else {
            tag_count++;
            //printf("%s\n", bufptr);
            tag = create_tag(tag_name, bufptr); 
            //print_tag(tag);

	    if(params->show_orig) {
              fasta_tag(tag);
            }

            if(params->calc_1g) {
              unlink_tag(create_1G_error(tag));
            }

            if(params->calc_1e) {
              create_1errors(tag);
            }

            unlink_tag(tag);
          } 
        } else {
          tag = parse_tag_line(bufptr);
        }

        bufptr2 = bufptr2+1;
        bufptr = bufptr2;
      } 
    } //while(bufptr2<bufend)
    /* not an end of line means we ran off the buffer
       so we need to shift the rest of the buffer 
       to the beginning and break out to read more
       of the file */
    strcpy(buffer, bufptr); //the end over, very efficient

    //printf("COPY end of bufptr over to buffer\n");
    //memset(linebuf, 0, bufsize);
    //strcpy(linebuf, bufptr); //copy remainder to temp
    //printf("COPY OVER : %s\n", linebuf); 
    //memset(buffer, 0, bufsize); //clear the buffer
    //strcpy(buffer, linebuf); //copy the temp into the buffer
    //printf("BUFFER BEFORE EXTEND : %s\n", buffer); 

    //if(linecount > 100) { break; }
  }
  
  if(1) {
    mbytes = ((double)(byteCount))/(1024.0*1024.0);
    runtime = time(0) - starttime;
    fprintf(stderr, "just read %d lines\n", linecount);
    fprintf(stderr, "just read %1.3f Mbytes\n", mbytes);
    fprintf(stderr, "  %1.3f secs\n", (float)runtime);
    fprintf(stderr, "  %1.3f mbytes/sec\n", mbytes/runtime); 
    fprintf(stderr, "processed %d input tags\n", tag_count);
  }

  free(buffer);
  free(linebuf);
  free(readbuf);
  fclose(fp);

  return;
}

/*************************************/
seqtag_t*  create_tag(char* name, char* seq) {
  seqtag_t  *tag;
  char      *newseq;
  
 // printf("%d seqtag_t bytes\n", sizeof(seqtag_t));
  tag = (seqtag_t*)malloc(sizeof(seqtag_t));
  memset(tag, 0, sizeof(seqtag_t));

  if((name == NULL) || (name[0] == '\0')) {
    strncpy(tag->name, seq, 64);
  } else {
    strncpy(tag->name, name, 64);
  }

  tag->length = strlen(seq);

  strncpy(tag->seq, seq, 32);
  //print_tag(tag);
  return tag;
}

/*************************************/

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
      strncpy(tag->name, ptr, 64);
    }
    if(col==4) { 
      tag->length = atoi(ptr); 
    }
    if(col==5) {
      strncpy(tag->seq, ptr,32);
    }
  }
  //print_tag(tag);
  return tag;
}

/*************************************/

void fasta_tag(seqtag_t *tag) {
  if(tag == NULL) { return; }
  printf(">%s\n%s\n", tag->name, tag->seq);
}

void print_tag(seqtag_t *tag) {
  if(tag == NULL) { return; }
  printf("TAG(%d) %s :[%d] %s\n", tag->id, tag->name, tag->length, tag->seq);
}

/*************************************
 * linked list manipulations
 *************************************/

void unlink_tag(seqtag_t *tag) {
  void   *name, *seq;

  if(tag==NULL) { return; }
  seqtag_t *prev, *next;
  prev = tag->prev_tag;
  next = tag->next_tag;
  if(prev != NULL) { prev->next_tag = next; }
  if(next != NULL) { next->prev_tag = prev; }
  free(tag);
}

seqtag_t* first_tag(seqtag_t *tag) {
  if(tag==NULL) { return NULL; }
  while(tag->prev_tag != NULL) { tag = tag->prev_tag; }
  return tag;
}

seqtag_t* last_tag(seqtag_t *tag) {
  if(tag==NULL) { return NULL; }
  while(tag->next_tag != NULL) { tag = tag->next_tag; }
  return tag;
}

seqtag_t* merge_tag_chains(seqtag_t *tag1, seqtag_t *tag2) {
  seqtag_t  *last_tag1  = last_tag(tag1);
  seqtag_t  *first_tag2 = first_tag(tag2);

  if(last_tag1 != NULL) { last_tag1->next_tag = first_tag2; }
  if(first_tag2 != NULL) { first_tag2->prev_tag = last_tag1; }
  if(tag1 == NULL) { tag1 = first_tag2; } 
  return tag1;
}

void unlink_chain(seqtag_t *tag) {
  seqtag_t  *lasttag = last_tag(tag);
  seqtag_t  *deltag;

  while(lasttag != tag) {
    deltag = lasttag;
    lasttag = lasttag->prev_tag;
    unlink_tag(deltag);
  }
}


void print_tag_chain(seqtag_t *tag) {
  int count=0;
  tag = first_tag(tag);
  while(tag!=NULL) {
    //print_tag(tag);
    fasta_tag(tag);
    tag = tag->next_tag;
    count++;
  }
  //printf("%d tags in chain\n", count);
}


void uniq_tag_chain(seqtag_t *tag) {
  seqtag_t  *tag1, *tag2, *del_tag;
  tag1 = last_tag(tag); 
  //printf("FIND UNIQUE SET\n");
  while(tag1 != NULL) {
    //print_tag(tag1);
    tag2 = tag1->prev_tag;
    while(tag2!=NULL) {
      if(strcmp(tag2->seq, tag1->seq) ==0) {
        del_tag = tag2;
        tag2 = tag2->prev_tag;
        //printf("DELETE    : "); print_tag(del_tag);
        //printf("  same as : "); print_tag(tag1);
        unlink_tag(del_tag);
      } else {
        tag2 = tag2->prev_tag;
      }
    }
    tag1 = tag1->prev_tag;
  }
}


/*************************************
 * now all the subroutines
 *************************************/

seqtag_t* create_1G_error(seqtag_t* tag) {
  seqtag_t  *edit_tag;
  char      *edit_name;

  if((tag->seq[0] != 'g') && (tag->seq[0] != 'G')) { return NULL; }
  //printf("ORIGINAL :: "); print_tag(tag);
  
  edit_tag = create_tag(NULL, (tag->seq)+1);
  sprintf(edit_tag->name, "%s_D0G", tag->name);
  //printf("G EDIT   :: "); 
  fasta_tag(edit_tag);
  
  return edit_tag;
}


seqtag_t* create_1errors(seqtag_t* tag) {
  int       i;
  seqtag_t  *edit_tag, *all_edits=NULL;

  //printf("ORIGINAL :: "); print_tag(tag);
  for(i=0; i < tag->length; i++) {
    all_edits = merge_tag_chains(all_edits, create_delete(tag, i));
  }
  for(i=0; i < tag->length; i++) {
    all_edits = merge_tag_chains(all_edits, create_mismatch(tag, i, 'A'));
    all_edits = merge_tag_chains(all_edits, create_mismatch(tag, i, 'C'));
    all_edits = merge_tag_chains(all_edits, create_mismatch(tag, i, 'G'));
    all_edits = merge_tag_chains(all_edits, create_mismatch(tag, i, 'T'));
  }
  for(i=0; i < tag->length; i++) {
    all_edits = merge_tag_chains(all_edits, create_insert(tag, i, 'A'));
    all_edits = merge_tag_chains(all_edits, create_insert(tag, i, 'C'));
    all_edits = merge_tag_chains(all_edits, create_insert(tag, i, 'G'));
    all_edits = merge_tag_chains(all_edits, create_insert(tag, i, 'T'));
  }
  //print_tag_chain(all_edits);
  uniq_tag_chain(all_edits);
  print_tag_chain(all_edits);
  unlink_chain(all_edits);

  return all_edits;
}


seqtag_t* create_delete(seqtag_t* tag, int pos) {
  seqtag_t  *edit_tag, *lasttag;
  char      *edit_name, *seq2, *ptr1, *ptr2;
  int       len;

  //printf("ORIGINAL :: "); print_tag(tag);
  
  if((pos==0) && ((tag->seq[0] == 'g') || (tag->seq[0] == 'G'))) { return NULL; }

  seq2 = (char*)malloc(tag->length + 3);
  ptr1 = tag->seq;
  ptr2 = seq2;
  while(*ptr1 != '\0') {
    if((ptr1 - tag->seq) == pos) { ptr1++; }
    if(*ptr1 == '\0') { break; }
    *ptr2++ = *ptr1++;
  }
  *ptr2 = '\0';

  edit_tag = create_tag(NULL, seq2);
  sprintf(edit_tag->name, "%s_D%d%c", tag->name, pos, tag->seq[pos]);
  //printf("1D EDIT  :: "); print_tag(edit_tag);
  //fasta_tag(edit_tag);
  free(seq2);

  return edit_tag;
}


seqtag_t* create_mismatch(seqtag_t* tag, int pos, char base) {
  seqtag_t  *edit_tag;
  char      *edit_name, *seq2;

  //don't need to change it to what is already there
  if(tag->seq[pos] == base) { return NULL; }
  
  seq2 = (char*)malloc(tag->length + 1);
  strcpy(seq2, tag->seq);
  seq2[pos] = base; //change the base

  edit_tag = create_tag(NULL, seq2);
  sprintf(edit_tag->name, "%s_M%d%c", tag->name, pos, base);

  //printf("1D EDIT  :: "); print_tag(edit_tag);
  //fasta_tag(edit_tag);
  free(seq2);
  
  return edit_tag;
}


seqtag_t* create_insert(seqtag_t* tag, int pos, char base) {
  seqtag_t  *edit_tag;
  char      *edit_name, *seq2, *ptr1, *ptr2;

  //don't do insert in first or last position
  if(pos==0) { return NULL; }
  if(pos== tag->length) { return NULL; }

  seq2 = (char*)malloc(tag->length + 3);
  memset(seq2, 0, tag->length + 3);
  
  ptr1 = tag->seq;
  ptr2 = seq2;
  while(*ptr1 != '\0') {
    if((ptr1 - tag->seq) == pos) { 
      *ptr2 = base;  //put the insert base in now
      ptr2++; 
    }
    if(*ptr1 == '\0') { break; }
    *ptr2++ = *ptr1++;
  }
  *ptr2 = '\0';

  edit_tag = create_tag(NULL, seq2);
  sprintf(edit_tag->name, "%s_I%d%c", tag->name, pos, base);

  //printf("1I EDIT  :: "); print_tag(edit_tag);
  //fasta_tag(edit_tag);
  free(seq2);
  
  return edit_tag;
}


