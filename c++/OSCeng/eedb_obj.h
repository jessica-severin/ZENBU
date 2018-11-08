#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#ifndef EEDB_OBJ_H
#define EEDB_OBJ_H

typedef enum { OBJ, TAXON, ASSEMBLY, CHROM, CHUNK, FEATURE, EXPERIMENT, FEXPRESS, FLINK, FSOURCE, LSOURCE } obj_type_t;

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
  obj_type_t        obj_class;
} eeDBeng_t;

typedef struct {
  eeDBeng_t     *engine;
  long long     id;
  long long     offset;
  void          *prev_obj;
  void          *next_obj;
  char          *line_buffer;
} eedb_obj_t;

/*************************************
 * prototypes
 *************************************/
void           eedb_obj_unlink(eedb_obj_t *obj);
void           eedb_print_obj(eedb_obj_t *obj);

#endif

