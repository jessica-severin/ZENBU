#!/bin/bash
while [ 1==1 ]; do  
echo -n "launch zenbu agents :: "  
date
#/zenbu/bin/zenbu_track_builder -build -buildtime 583 -loadlimit 0.1&
/zenbu/bin/zenbu_job_runner -run&
sleep 10 
done
