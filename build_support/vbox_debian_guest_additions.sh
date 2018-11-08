#!/bin/sh
apt-get update
apt-get upgrade
apt-get install build-essentials module-assistant
m-a prepare
sh /media/cdrom/VBoxLinuxAdditions.run
