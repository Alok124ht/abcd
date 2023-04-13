#!/bin/bash
source /home/ec2-user/.bashrc

cd /home/ec2-user/app

pm2 stop ecosystem.config.js --env production
pm2 delete ecosystem.config.js --env production
