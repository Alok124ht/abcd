#!/bin/bash
source /home/ec2-user/.bashrc

cd /home/ec2-user/app
pm2 start ecosystem.config.js --env production