#!/bin/sh

apt-get -y install mysql-client sqlite3 samtools git wget cvs make cmake bzip2 gcc g++ libboost-dev libfcgi-dev default-libmysqlclient-dev libncurses-dev libsqlite3-dev zlib1g-dev libfcgi-dev libmysql++-dev libsqlite3-dev expat libexpat1-dev openssl uuid-runtime libssl-dev libcrypto++-dev libcurl4-openssl-dev

apt-get -y install libdata-uuid-perl libyaml-perl libclass-dbi-mysql-perl  libclass-dbi-sqlite-perl libcgi-application-perl libcgi-fast-perl libnet-openid-common-perl libnet-openid-consumer-perl libcrypt-openssl-bignum-perl libio-all-lwp-perl liblwp-authen-oauth-perl liblwpx-paranoidagent-perl libnet-ping-external-perl libxml-treepp-perl libcache-perl libswitch-perl

# make zenbu directory structure
mkdir /etc/zenbu /usr/share/zenbu /var/lib/zenbu
mkdir /usr/share/zenbu/src 
mkdir /usr/share/zenbu/www 
#the owner must be the apache process owner, on some systems is it httpd, or apache or www-data
#alternate is to do chmod 777 or chgrp to allow the apache process to write into the directories cache and users

export ZENBU_SRC_DIR=`pwd`
echo $ZENBU_SRC_DIR

#zenbu source code - when pulling from sourceforge
#cd /usr/share/zenbu/src
#wget http://downloads.sourceforge.net/project/zenbu/ZENBU_2.11.2.tar.gz
#tar -xzf ZENBU_2.11.2.tar.gz
#cd ZENBU_2.11.2/c++
#make

#zenbu source code - when using script packaged with the source code
#copy the perl lib objects to /usr/share/zenbu/src/ZENBU/lib
mkdir /usr/share/zenbu/src/ZENBU
cp -r $ZENBU_SRC_DIR/lib /usr/share/zenbu/src/ZENBU/

cd $ZENBU_SRC_DIR/c++
make

#install the commandline tools
cd $ZENBU_SRC_DIR/c++/tools
make
make install

