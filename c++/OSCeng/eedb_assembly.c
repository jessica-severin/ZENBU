#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>
#include <sys/types.h>
#include <sys/mman.h>

#include <eedb_assembly.h>

/*************************************
 * prototypes
 *************************************/


/*************************************/

void eedb_assembly_parse_obj(void* self) {
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
      //1       9606    36.2    hg18    0000-00-00
      case 1: //assembly_id
        ((eedb_assembly_t*)self)->assembly_id = strtol(ptr, NULL, 10); 
        break;
      case 2: //taxon_id
        ((eedb_assembly_t*)self)->taxon_id = strtol(ptr, NULL, 10); 
        break;
      case 3: //ncbi_version
        strncpy(((eedb_assembly_t*)self)->ncbi_version, ptr, 32);
        break;
      case 4: //ucsc_name
        strncpy(((eedb_assembly_t*)self)->ucsc_name, ptr, 32);
        break;
      case 5: //release_date
        strncpy(((eedb_assembly_t*)self)->release_date, ptr, 64);
        break;
      default: break;
    }
  }
}


void eedb_assembly_print(void *self) {
  char *str;
  if(self == NULL) { return; }
  str = eedb_assembly_display_desc(self);
  printf("%s\n", str);
  free(str);
}


char* eedb_assembly_display_desc(void *self) {
  char *str = (char*)malloc(1024);
  sprintf(str, "Assembly[%lld] (%ld) %s : %s : %s", 
           ((eedb_obj_t*)self)->id, 
           ((eedb_assembly_t*)self)->assembly_id, 
           ((eedb_assembly_t*)self)->ncbi_version,
           ((eedb_assembly_t*)self)->ucsc_name,
           ((eedb_assembly_t*)self)->release_date
           );
  return str;
}



