#!/bin/bash
export EEDB_ROOT="/zenbu/src/ZENBU_2.302"
hostname
/usr/bin/perl /zenbu/src/ZENBU_2.302/scripts/eedb_create_OSCFileDB.pl -LSA -single_tagmap -file $1 -keywords "genas autoload fantom5" -builddir /work/scratch -deploydir /zenbu/dbs3/fantom5_autoload -registry "sqlite:///zenbu/dbs3/eedb_OSC3_registry.sqlite"
