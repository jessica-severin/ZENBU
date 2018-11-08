#!/bin/sh
apt-get -y install apache2 libapache2-mod-fcgid mysql-server mysql-client sqlite3 samtools git wget cvs

apt-get -y install  make bzip2 gcc g++ libboost-dev libcurl4-openssl-dev libfcgi-dev default-libmysqlclient-dev libncurses-dev libsqlite3-dev zlib1g-dev libssl1.0-dev

apt-get -y install g++ make cmake libfcgi-dev default-libmysqlclient-dev libmysql++-dev libsqlite3-dev expat libexpat1-dev openssl uuid-runtime libcrypto++-dev libboost-dev libcurl4-openssl-dev

apt-get -y install libdata-uuid-perl libyaml-perl libclass-dbi-mysql-perl  libclass-dbi-sqlite-perl libcgi-application-perl libcgi-fast-perl libnet-openid-common-perl libnet-openid-consumer-perl libcrypt-openssl-bignum-perl libio-all-lwp-perl liblwp-authen-oauth-perl liblwpx-paranoidagent-perl libnet-oping-perl libxml-treepp-perl libcache-perl libswitch-perl

apt install libbz2-dev
apt install liblzma-dev

export ZENBU_SRC_DIR=`pwd`
echo $ZENBU_SRC_DIR

cd $ZENBU_SRC_DIR/c++
make

#install the commandline tools
cd $ZENBU_SRC_DIR/c++/tools
make
make install

