#!/bin/bash
export EEDB_ROOT="/zenbu/src/ZENBU_2.302"
hostname
echo $1
/usr/bin/perl /zenbu/src/ZENBU_2.302/scripts/eedb_create_OSCFileDB.pl -LSA -GeNAS -single_tagmap -file $1 -keywords "genas autoload" -builddir /work/scratch -deploydir severin@osc-fs.gsc.riken.jp:/eeDB2/dbs/genas_autoload -registry "mysql://severin:sevjes753@osc-mysql.gsc.riken.jp/eeDB_test_autoregistry"
