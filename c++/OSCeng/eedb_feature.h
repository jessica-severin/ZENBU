#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#include <eedb_obj.h>

#ifndef EEDB_FEATURE_H
#define EEDB_FEATURE_H

typedef struct {
  eedb_obj_t     super;
  long          feature_id;
  long          chrom_id;
  long          feature_source_id;
  long          chrom_start;
  long          chrom_end;
  char          strand;
  char          primary_name[64];
  double        significance;
  char          last_update[32];
} eedb_feature_t;

/*************************************
 * prototypes
 *************************************/
void        eedb_feature_parse_obj(void *self);
char*       eedb_feature_display_desc(void *self);
void        eedb_feature_print(void *self);

#endif

