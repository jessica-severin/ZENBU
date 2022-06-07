#!/bin/bash
while [ 1==1 ]; do  
echo -n "launch zenbu agents :: "  
date
#/zenbu/bin/zenbu_job_runner -run&
/zenbu/bin/zenbu_track_builder -build -buildtime 2000 -loadlimit 0.2&
sleep 15; 
done
