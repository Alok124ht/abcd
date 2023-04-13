mongodump -d=production -c=clients
mongodump -d=production -c=phases
mongodump -d=production -c=topics
mongodump -d=production -c=subjects
mongodump -d=production -c=subgroups
mongodump -d=production -c=supergroups
tar -zcvf dump.tar.gz dump
rm -rf dump