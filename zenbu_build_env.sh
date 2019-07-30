#source zenbu_build_env.sh

#zenbu must install system config into /etc/zenbu/zenbu.conf
#mkdir /etc/zenbu 

export ZENBU_BUILD_VERSION=ZENBU_2.11
export ZENBU_SRC_DIR=`pwd`

export ZENBU_BIN_DIR=/usr/local/bin
#export ZENBU_BIN_DIR=/zenbu/bin
#export ZENBU_BIN_DIR=~/bin

export ZENBU_HTML_DIR=/var/www/html/zenbu

export ZENBU_USERS_DIR=/var/lib/zenbu/user
export ZENBU_CACHE_DIR=/var/lib/zenbu/cache
export ZENBU_DBS_DIR=/var/lib/zenbu/dbs

#export ZENBU_USERS_DIR=/zenbu/user
#export ZENBU_CACHE_DIR=/zenbu/cache
#export ZENBU_DBS_DIR=/zenbu/dbs

export ZENBU_SHARED_SRC=/usr/share/zenbu
#export ZENBU_SHARED_SRC=/usr/local/zenbu
#export ZENBU_SHARED_SRC=/zenbu


#mkdir /etc/zenbu /usr/share/zenbu /var/lib/zenbu
#mkdir /usr/share/zenbu/src
#mkdir /usr/share/zenbu/www
#mkdir /var/www/html/zenbu
#mkdir /var/lib/zenbu/dbs /var/lib/zenbu/cache /var/lib/zenbu/users
#chown www-data /var/lib/zenbu/cache
#chown www-data /var/lib/zenbu/users
#chgrp -R www-data /var/lib/zenbu/

