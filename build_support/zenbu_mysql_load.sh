#!/bin/sh
mysql -hlocalhost -P3306 -uroot -proot zenbu_users  < ../sql/schema.sql
mysql -hlocalhost -P3306 -uroot -proot zenbu_users  < ../sql/system_tables.sql

zenbu_register_peer -url "mysql://zenbu_admin:zenbu_admin@localhost:3306/zenbu_users" -newpeer
