#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>
#include <sys/types.h>
#include <sys/mman.h>

#include <eedb_chrom.h>

/*************************************
 * prototypes
 *************************************/


/*************************************/

void eedb_chrom_parse_obj(void* self) {
  char       *line, *ptr;
  int        col=0;
  
  line = ((eedb_obj_t*)self)->line_buffer;
  //printf("LINE : %s\n",line);
  while((ptr = strsep(&line, " \t")) != NULL) {
    if(*ptr== '\0') { break; }
    if(*ptr== '\n') { break; }
    col++;
    //printf("    %d : '%s'\n", col, ptr);
    switch(col) {
      //4       chr11   1       134452384       chromosome
      case 1: //chrom_id
        ((eedb_chrom_t*)self)->chrom_id = strtol(ptr, NULL, 10); 
        break;
      case 2: //chrom_name
        strncpy(((eedb_chrom_t*)self)->chrom_name, ptr, 63);
        break;
      case 3: //assembly_id
        ((eedb_chrom_t*)self)->assembly_id = strtol(ptr, NULL, 10); 
        break;
      case 4: //chrom_length
        ((eedb_chrom_t*)self)->chrom_length = strtol(ptr, NULL, 10); 
        break;
      case 5: //chrom_type
        strncpy(((eedb_chrom_t*)self)->chrom_type, ptr, 63);
        break;
      case 6: //description
        strncpy(((eedb_chrom_t*)self)->description, ptr, 255);
        break;
      default: break;
    }
  }
}


void eedb_chrom_print(void *self) {
  char *str;
  if(self == NULL) { return; }
  //printf("FEATURE(%lld) %s\n", ((eedb_obj_t*)self)->id, ((eedb_obj_t*)self)->line_buffer);
  str = eedb_chrom_display_desc(self);
  printf("%s\n", str);
  free(str);
}


char* eedb_chrom_display_desc(void *self) {
  char *str = (char*)malloc(1024);
  sprintf(str, "Chrom[%lld] asm[%ld] %s %s : len %ld :: %s", 
           ((eedb_obj_t*)self)->id, 
           ((eedb_chrom_t*)self)->assembly_id, 
           ((eedb_chrom_t*)self)->chrom_type,
           ((eedb_chrom_t*)self)->chrom_name,
           ((eedb_chrom_t*)self)->chrom_length,
           ((eedb_chrom_t*)self)->description
           );
  return str;
}



