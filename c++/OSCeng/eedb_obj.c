#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <sys/types.h>

#include <eedb_obj.h>

/*************************************
 * now all the subroutines
 *************************************/

void eedb_obj_unlink(eedb_obj_t *obj) {
  void     *line;
  eedb_obj_t *prev, *next;

  if(obj==NULL) { return; }
  prev = obj->prev_obj;
  next = obj->next_obj;
  if(prev != NULL) { prev->next_obj = next; }
  if(next != NULL) { next->prev_obj = prev; }
  
  line = obj->line_buffer;
  obj->line_buffer = NULL;
  free(line);
  
  free(obj);
}


