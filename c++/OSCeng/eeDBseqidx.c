#include <stdio.h>
#include <stdlib.h>
#include <zlib.h>

main() {
  char    *path;
  gzFile  gz_data;
  int     byte;

  path = "/Users/jessica/data/shortRNA/S19-CA/s19_expression.txt.gz";
  printf("hello world\n");
  printf("open [%s] for indexing\n", path);

  gz_data =  gzopen (path, "rb"); 
  do {
    byte = gzgetc (gz_data); 
  } while(byte != -1);
  gzclose(gz_data);
}

