#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <string.h>
#include <zlib.h>

main() {
  int        x, readCount;
  FILE       *fp;
  FILE       *fp_out;
  long long  byteCount=0, bufferCount=0;
  char       *buffer, *readbuf, *linebuf;
  int        bufsize = 1024*1024;
  int        readBufSize = 8192;
  clock_t    startclock;
  double     runtime;
  double     mbytes;
  char       *bufptr, *bufptr2, *bufend;
  int        linecount = 0;
  char       *path, outpath[1024];

  //path = "s19_expression2";
  path = "i03_expression.txt.gz";
  sprintf(outpath, "%s.copy", path);
  
  printf("long : %d bytes\n", sizeof(bufferCount));
  fp = gzopen(path, "rb");
  fp_out = fopen(outpath, "w");
  buffer = (char*)malloc(bufsize);
  memset(buffer, 0, bufsize);
  linebuf = (char*)malloc(bufsize);
  readbuf = (char*)malloc(readBufSize + 1000);

  startclock = clock();
  while(!gzeof(fp)) {
    readCount = gzread(fp, readbuf, readBufSize);
    bufferCount++;
    byteCount = byteCount + readCount;
    if(bufferCount % 1000 == 0) {
      printf("  read %1.3f Mbytes\t%d lines\n", ((double)(byteCount))/(1024.0*1024.0), linecount);
    }
    strncat(buffer, readbuf, readCount);
    //printf("new buffer length : %d\n", strlen(buffer));
    bufptr = buffer;
    bufptr2 = buffer;
    bufend = buffer + strlen(buffer); /* points at the \0 added by strncat()*/

    while(bufptr2 < bufend) {
      while((bufptr2 < bufend) && (*bufptr2 != '\0') && (*bufptr2 != '\n')) { bufptr2++; }
      if(*bufptr2 == '\n') {
        *bufptr2 = '\0';
        linecount++;
        //printf("LINE %7d : %s\n", linecount, bufptr);
        fprintf(fp_out, "%s\n", bufptr);

        //
        // do things with the line buffer here
        //

        bufptr2 = bufptr2+1;
        bufptr = bufptr2;
      }
    } //bottom of the while(bufptr2<bufend){} loop

    /* not an end of line means we ran off the buffer
       so we need to shift the rest of the buffer
       to the beginning and break out to read more
       of the file */
    strcpy(buffer, bufptr); //the end over, very efficient

    //if(linecount > 100) { break; }
  } //end of the while(!gzeof(fp)){} loop
  gzclose(fp);
  fclose(fp_out);
  
  mbytes = ((double)(byteCount))/(1024.0*1024.0);
  runtime = (double)(clock() - startclock) / CLOCKS_PER_SEC;
  printf("just read %d lines\n", linecount);
  printf("just read %1.3f Mbytes\n", mbytes);
  printf("  %1.3f secs\n", (float)runtime);
  printf("  %1.3f kilolines/sec\n", linecount/runtime/1000.0); 
  printf("  %1.3f mbytes/sec\n", mbytes/runtime); 
  exit(1);
}

