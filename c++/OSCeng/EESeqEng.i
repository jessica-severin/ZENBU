// File : EESeqEng.i
%module EESeqEng
%{
#include "EESeqEng.h"
%}
%include "EESeqEng.h"

// File I/O functions (explained shortly)
FILE *fopen(char *name, char *mode);
void  fclose(FILE *);
