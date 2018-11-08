#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#include <eedb_obj.h>

#ifndef EEDB_ASSEMBLY_H
#define EEDB_ASSEMBLY_H

typedef struct {
  eedb_obj_t    super;
  long          assembly_id;
  long          taxon_id;
  char          ncbi_version[32];
  char          ucsc_name[32];
  char          release_date[32];
} eedb_assembly_t;

/*************************************
 * prototypes
 *************************************/
void        eedb_assembly_parse_obj(void *self);
char*       eedb_assembly_display_desc(void *self);
void        eedb_assembly_print(void *self);

#endif

