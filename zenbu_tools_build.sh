#!/bin/sh

export ZENBU_SRC_DIR=`pwd`
echo $ZENBU_SRC_DIR

cd $ZENBU_SRC_DIR/c++
make

#install the commandline tools
cd $ZENBU_SRC_DIR/c++/tools
make
make install

