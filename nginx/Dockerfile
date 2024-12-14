FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY certs /etc/ssl/
RUN chmod 644 /etc/nginx/nginx.conf && \
    chmod 600 /etc/ssl/minecraftoffline.net.key && \
    chmod 644 /etc/ssl/minecraftoffline.net.crt
