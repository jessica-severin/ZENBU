#!/bin/bash
export EEDB_ROOT="/zenbu/src/ZENBU_2.302"
hostname
echo $1
/usr/bin/perl /zenbu/src/ZENBU_2.302/scripts/eedb_create_OSCFileDB.pl -LSA -file $1 -builddir /work/scratch -deploydir severin@osc-fs.gsc.riken.jp:/eeDB2/dbs -registry "mysql://severin:<pass>@osc-mysql.gsc.riken.jp/eeDB_test_autoregistry"
