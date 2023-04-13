sudo yum update
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 12
npm install -g pm2
sudo yum update
sudo yum install ruby
sudo yum install wget
wget https://aws-codedeploy-ap-south-1.s3.ap-south-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo systemctl status codedeploy-agent
lsblk
sudo mkswap /dev/xvdb
sudo swapon /dev/xvdb
sudo vim /etc/fstab
sudo swapon --show
htop
top
pm2
pm2 list
pm2 kill
pm2
ls
rm install
mkdir app