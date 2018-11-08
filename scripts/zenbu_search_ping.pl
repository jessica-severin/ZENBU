#!/usr/bin/perl

while(1) {
  my $cmd = "wget -O/dev/null http://osc-intweb1.gsc.riken.jp/zenbu/cgi/eedb_search.fcgi?mode=experiments;filter=fubar";
  printf("\n==================\n");
  printf($cmd,"\n");
  system($cmd);
  printf("====> sleep for 5minutes now\n");
  sleep(5*60);
}
