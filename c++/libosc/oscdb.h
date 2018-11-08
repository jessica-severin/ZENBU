#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#ifndef LIBOSC_OSCDB_H
#define LIBOSC_OSCDB_H

#define READ_BUF_SIZE   8192
#define BUFSIZE         1024*1024 

typedef struct {
  int               debug;
  char              *file_path;
  int               idx_fildes;
  int               data_fildes;
  long long         *idx_mmap;
  long long         max_id;
  clock_t           startclock;
  double            starttime;
  int               access_id;
  int               max_lines;
  char              *buffer, *readbuf;
  char              *bufptr, *bufend;
  long long         seek_pos, next_obj_id;
} oscdb_t;

typedef struct {
  oscdb_t       *oscdb;
  long long     id;
  long long     offset;
  char          *line_buffer;
  char          *columns[100];
} osc_object_t;



/*************************************
 * oscdb function
 *************************************/
oscdb_t*          oscdb_new(void);
void              oscdb_init(oscdb_t *self, char* infile);
void              oscdb_build_index(oscdb_t *self);

osc_object_t*     oscdb_next_object(oscdb_t *self);
osc_object_t*     oscdb_access_object(oscdb_t *self, long long id);


/*************************************
 * osc_object functions
 *************************************/
void           osc_object_delete(osc_object_t *obj);

void           osc_object_parse_columns(osc_object_t *obj);

char*          osc_object_display_desc(osc_object_t *obj);
void           osc_object_print(osc_object_t *obj);

#endif

