#!/bin/bash
export DISPLAY=:1

rm -f /tmp/.X1-lock
Xvfb :1 -ac -screen 0 1024x768x16 &

x11vnc -ncache_cr -display :1 -forever -shared  -bg -noipv6 -passwd "$VNC_SERVER_PASSWORD" &

npm start
