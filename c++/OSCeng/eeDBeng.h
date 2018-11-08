#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#ifndef EEDB_ENG_H
#define EEDB_ENG_H

#include <eedb_obj.h>
#include <eedb_chrom.h>
#include <eedb_feature.h>
#include <eedb_assembly.h>

#define READ_BUF_SIZE   8192
#define BUFSIZE         1024*1024 


/************************************/

typedef struct {
  eedb_obj_t    super;
  long          taxon_id;
  char          genus[64];
  char          species[64];
  char          sub_species[64];
  char          common_name[128];
  char          *classification;
} taxon_t;

typedef struct {
  eedb_obj_t    super;
  long          chrom_id;
  long          chrom_start;
  long          chrom_end;
  long          chunk_len;
} chrom_chunk_t;

typedef struct {
  eedb_obj_t    super;
  long          feature_source_id;
  char          fsrc_name[256];
  char          fsrc_category[256];
  char          import_source[256];
  time_t        import_date;
  time_t        freeze_date;
  char          *url;
  char          *comments;
  long          comment_id;
  char          reference_pubmed_ids[256];
  char          is_active;
  char          is_visible;
} feature_source_t;


/*************************************
 * prototypes
 *************************************/
eeDBeng_t*      eedb_new(void);
void            eedb_init(eeDBeng_t *self, char* infile);
void            eedb_build_index(eeDBeng_t *self);

eedb_obj_t*     eedb_next_object(eeDBeng_t *self);
eedb_obj_t*     eedb_access_object(eeDBeng_t *self, long long id);

#endif

