#include <fcntl.h>
#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>

#define READ_BUF_SIZE   8192
#define BUFSIZE         1024*1024 

typedef struct {
  long      id;
  long long offset;
  int       length;
  char      *seq;
  int       exp_count;
  int       express[10];
  int       total_express;
  void      *prev_tag;
  void      *next_tag;
} seqtag_t;

typedef struct {
  char        *full_name;
  long long   total_express;
} experiment_t;

typedef enum {
  INDEX, STREAM1, STREAM2, ACCESS, RANDTEST
} eeSeqEng_modes_t; 

typedef struct {
  int               debug;
  char              *file_path;
  int               idx_fildes;
  int               data_fildes;
  long long         *idx_mmap;
  long long         max_id;
  clock_t           startclock;
  int               exp_count;
  experiment_t      experiments[10];
  int               access_id;
  int               max_lines;
  long long         total_expression;
  eeSeqEng_modes_t  mode;
  char              *buffer, *readbuf;
  char              *bufptr, *bufend;
  long long         seek_pos, next_obj_id;
} eeSeqEng_t;


/*************************************
 * prototypes
 *************************************/
eeSeqEng_t*  eeseq_new(void);
void         eeseq_init(eeSeqEng_t *self, char* infile);
void         eeseq_read_experiments(eeSeqEng_t *self);
void         eeseq_build_index(eeSeqEng_t *self);
void         eeseq_mmap_idx(eeSeqEng_t *self);
void         eeseq_readtags(eeSeqEng_t* self);
void         eeseq_parse_exp_line(eeSeqEng_t* self, char* line);
seqtag_t*    eeseq_parse_tag_line(eeSeqEng_t* self, char* line, int linenum);
void         eeseq_print_tag(eeSeqEng_t* self, seqtag_t *tag);
void         eeseq_write_exptag(FILE *fp, seqtag_t *tag);
void         eeseq_unlink_tag(seqtag_t *tag);
void         eeseq_process_line(eeSeqEng_t* self, char* line);
seqtag_t*    eeseq_access_tag(eeSeqEng_t *self, long long id);
seqtag_t*    eeseq_nexttag(eeSeqEng_t *self);

