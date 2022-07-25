#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>
#include <sys/types.h>
#include <sys/mman.h>

#include <eedb_feature.h>

/*************************************
 * prototypes
 *************************************/


/*************************************/

void eedb_feature_parse_obj(void* self) {
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
      //5179080 49      29      9957762 9957784 +       ENSE00001494171 0000-00-00 00:00:00

      case 1: //feature_id
        ((eedb_feature_t*)self)->feature_id = strtol(ptr, NULL, 10); 
        break;
      case 2: //chrom_id
        ((eedb_feature_t*)self)->chrom_id = strtol(ptr, NULL, 10); 
        break;
      case 3: //feature_source_id
        ((eedb_feature_t*)self)->feature_source_id = strtol(ptr, NULL, 10); 
        break;
      case 4: //chrom_start
        ((eedb_feature_t*)self)->chrom_start = strtol(ptr, NULL, 10); 
        break;
      case 5: //chrom_end
        ((eedb_feature_t*)self)->chrom_end = strtol(ptr, NULL, 10); 
        break;
      case 6: //strand
        ((eedb_feature_t*)self)->strand = *ptr;
        break;
      case 7: //primary_name
        strncpy(((eedb_feature_t*)self)->primary_name, ptr, 63);
        break;
      case 8: //last_update
        strncpy(((eedb_feature_t*)self)->last_update, ptr, 31);
        break;
      default: break;
    }
  }
}


void eedb_feature_print(void *self) {
  char *str;
  if(self == NULL) { return; }
  //printf("FEATURE(%lld) %s\n", ((eedb_obj_t*)self)->id, ((eedb_obj_t*)self)->line_buffer);
  str = eedb_feature_display_desc(self);
  printf("%s\n", str);
  free(str);
}


char* eedb_feature_display_desc(void *self) {
  char *str = (char*)malloc(1024);
  sprintf(str, "Feature[%lld](%ld) s[%ld] chr[%ld]:%ld..%ld%c : %s", 
           ((eedb_obj_t*)self)->id, 
           ((eedb_feature_t*)self)->feature_id, 
           ((eedb_feature_t*)self)->feature_source_id,
           ((eedb_feature_t*)self)->chrom_id,
           ((eedb_feature_t*)self)->chrom_start,
           ((eedb_feature_t*)self)->chrom_end,
           ((eedb_feature_t*)self)->strand,
           ((eedb_feature_t*)self)->primary_name
           );
  /*
  if((eedb_feature_t*)self->significance > 0.0) { sprintf(str, " sig:%1.2f", $self->significance); }
  my $symbols = $self->symbols();
  my $first=1;
  if(defined($symbols) and (scalar(@$symbols))) {
    $str .= ' (';
    foreach my $symbol (@$symbols) {
      if($first) { $first=0; }
      else { $str .= ','; }
      $str .= sprintf("(%s,%s)", $symbol->[0], $symbol->[1]);
    }
    $str .= ')';
  }
  */
  return str;
}



