#!/bin/sh
apt-get update
apt-get upgrade
apt-get install build-essential module-assistant dkms
m-a prepare
sh /media/cdrom/VBoxLinuxAdditions.run
