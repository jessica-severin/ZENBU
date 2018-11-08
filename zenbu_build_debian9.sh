#!/bin/sh
apt-get -y install apache2 libapache2-mod-fcgid mysql-server mysql-client sqlite3 samtools git wget cvs

apt-get -y install  make bzip2 gcc g++ libboost-dev libcurl4-openssl-dev libfcgi-dev default-libmysqlclient-dev libncurses-dev libsqlite3-dev zlib1g-dev 

apt-get -y install g++ make cmake libfcgi-dev default-libmysqlclient-dev libmysql++-dev libsqlite3-dev expat libexpat1-dev openssl uuid-runtime libssl1.0-dev libcrypto++-dev libboost-dev libcurl4-openssl-dev

apt-get -y install libdata-uuid-perl libyaml-perl libclass-dbi-mysql-perl  libclass-dbi-sqlite-perl libcgi-application-perl libcgi-fast-perl libnet-openid-common-perl libnet-openid-consumer-perl libcrypt-openssl-bignum-perl libio-all-lwp-perl liblwp-authen-oauth-perl liblwpx-paranoidagent-perl libnet-ping-external-perl libxml-treepp-perl libcache-perl libswitch-perl

# make zenbu directory structure
mkdir /etc/zenbu /usr/share/zenbu /var/lib/zenbu
mkdir /usr/share/zenbu/src 
mkdir /usr/share/zenbu/www 
mkdir /var/lib/zenbu/dbs /var/lib/zenbu/cache /var/lib/zenbu/users
chown www-data /var/lib/zenbu/cache
chown www-data /var/lib/zenbu/users
chgrp -R www-data /var/lib/zenbu/
#the owner must be the apache process owner, on some systems is it httpd, or apache or www-data
#alternate is to do chmod 777 or chgrp to allow the apache process to write into the directories cache and users

export ZENBU_SRC_DIR=`pwd`
echo $ZENBU_SRC_DIR

#bamtools build : in version >=2.10.x and onward ZENBU no longer uses bamtools
#cd /usr/share/zenbu/src
#git clone git://github.com/pezmaster31/bamtools.git
#cd bamtools
#mkdir build
#cd build
#cmake ..
#make
#make install
#echo "/usr/local/lib/bamtools" >> /etc/ld.so.conf.d/lib.conf
#ldconfig

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
cp -r $ZENBU_SRC_DIR/sql /usr/share/zenbu/src/ZENBU/

cd $ZENBU_SRC_DIR/c++
make

#install the commandline tools
cd $ZENBU_SRC_DIR/c++/tools
make
make install

#make zenbu website
cp -rp $ZENBU_SRC_DIR/www/zenbu /usr/share/zenbu/www/zenbu_2.11.2
ln -s /usr/share/zenbu/www/zenbu_2.11.2  /var/www/html/zenbu 
cd $ZENBU_SRC_DIR/c++/cgi
make
cp -f *cgi /usr/share/zenbu/www/zenbu_2.11.2/cgi/

#configure zenbu server
export ZUUID=`uuidgen`
sed 's/uuid_replace_me/'$ZUUID'/g' $ZENBU_SRC_DIR/build_support/zenbu.conf > /etc/zenbu/zenbu.conf

#currently this script only performs some of the basic configuration. please follow the remainder of the installation documentation to complete the installation process

#MYSQL user database setup
mysql -hlocalhost -P3306 -uroot -proot < $ZENBU_SRC_DIR/build_support/zenbu_mysql_cmds1.txt 
mysql -hlocalhost -P3306 -uroot -proot < $ZENBU_SRC_DIR/build_support/zenbu_mysql_cmds.txt 

mysql -hlocalhost -P3306 -uroot -proot zenbu_users  < $ZENBU_SRC_DIR/sql/schema.sql
mysql -hlocalhost -P3306 -uroot -proot zenbu_users  < $ZENBU_SRC_DIR/sql/system_tables.sql

zenbu_register_peer -url "mysql://zenbu_admin:zenbu_admin@localhost:3306/zenbu_users" -newpeer

#currently this script only performs some of the basic configuration. please follow the remainder of the installation documentation to complete the installation process
#in particular you will need to configure your apache2 server to allow cgi and fcgid zenbu scripts to run
#also you will need to modify the /etc/zenbu/zembu.conf with your SMTP email server to allow zenbu to send emails which are required for the user login system
