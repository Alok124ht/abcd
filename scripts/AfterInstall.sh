#!/bin/bash
source /home/ec2-user/.bashrc

cd /home/ec2-user/app
curl http://169.254.169.254/latest/user-data > /home/ec2-user/app/.env
curl http://169.254.169.254/latest/user-data > /tmp/.env-ol
# npm install
cd ..
#cd /home/ec2-user/app
# pwd > /tmp/hellopr.txt