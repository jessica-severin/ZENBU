#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#include <eedb_obj.h>

#ifndef EEDB_CHROM_H
#define EEDB_CHROM_H

typedef struct {
  eedb_obj_t     super;
  long          chrom_id;
  char          chrom_name[64];
  long          assembly_id;
  long          chrom_length;
  char          chrom_type[64];
  char          description[256];
} eedb_chrom_t;

/*************************************
 * prototypes
 *************************************/
void        eedb_chrom_parse_obj(void *self);
char*       eedb_chrom_display_desc(void *self);
void        eedb_chrom_print(void *self);

#endif

