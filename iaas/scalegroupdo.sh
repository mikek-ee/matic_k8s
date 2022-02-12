apt-get update
apt-get install nginx -y

cat <<EOF > /etc/nginx/nginx.conf
events {
    worker_connections 1024;
}

http {

    server {
        listen 80;
        
        location / {
            root /www/data;
        }
    }
}
EOF

mkdir /www/
mkdir /www/data
cat <<EOF > /www/data/index.html
<html>
    <head><title>Hello!</title><head>
    <body>Hello new updated world!</body>
</html>
EOF

systemctl restart nginx.service
