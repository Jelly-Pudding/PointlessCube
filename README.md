# Pointless Cube
Remember "Curiosity: What's Inside the Cube?"? It's like that except more transparent about being pointless.

# Set Up

## Cloudflare Set Up

- in DNS, make sure Proxy status is "proxied" and the orange cloud shows.
- In SSL/TLS, in overview, set it to Full (strict).
- In SSL/TLS, in Edge Certificates, set Always Use HTTPS to true.
- In SSL/TLS, in origin certificates, create a certificate. Choose RSA. These certificates should be put in nginx/certs/. (Private key will be minecraftoffline.net.key, and then the other one can just be minecraftoffline.net.crt)
- Also get origin cert: curl -o nginx/certs/origin-root.pem https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem
- Create the bundle.crt in nginx/certs as well: cat nginx/certs/minecraftoffline.net.crt nginx/certs/origin-root.pem > nginx/certs/bundle.crt

## Project Set Up

Make sure you have `.env` files set up. One is in the root repository - example:
```
# Keycloak Database
KEYCLOAK_DB_PASSWORD=password

# Keycloak Admin
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=password

# Application Database
APP_DB_PASSWORD=appsecretpassword

# Keycloak Issuer
KEYCLOAK_ISSUER=https://www.minecraftoffline.net/auth/realms/myrealm
```

You will also need `server/.env` - example:
```
NODE_ENV=production
KEYCLOAK_ISSUER=https://www.minecraftoffline.net/auth/realms/myrealm
PGHOST=app_postgres
PGUSER=myapp
PGPASSWORD=appsecretpassword
PGDATABASE=myapp
PGPORT=5432
PORT=4000
```

Make sure the PG password is the same for both...

From the root directory (`PointlessCube/`), run:
```bash
docker-compose up --build -d
```

Go to www.minecraftoffline.net/auth/. Go to administration console. Create a realm called myrealm. In this realm create a client called my-app...

root url https://www.minecraftoffline.net/
valid redirect uris https://www.minecraftoffline.net/*
web origins https://www.minecraftoffline.net

In Realm Settings → Login, enable "User registration"... put https://www.minecraftoffline.net/auth for the Frontend URL.

Access app at www.minecraftoffline.net

# Useful Commands
docker compose up --build -d
docker-compose down

---

## Migration Away from Cloudflare

We previously used Cloudflare for SSL/TLS termination. Now, we’ve **migrated** to Let’s Encrypt via **Certbot** on our own server. Here’s how we did it:

1. **Disable Cloudflare proxy**  
   - In your Cloudflare DNS settings, switch any proxied records (“orange cloud”) to **DNS-only** (“gray cloud”), or remove them altogether if you’re no longer using Cloudflare’s DNS at all.  
   - This ensures traffic goes **directly** to your server’s IP, bypassing Cloudflare.

2. **Update DNS**  
   - Point your domain (e.g. `www.minecraftoffline.net`) to your server’s IP.  
   - Wait for DNS propagation so requests are sent straight to your host.

3. **Remove Cloudflare-specific SSL configs**  
   - We no longer need origin certificates or a Cloudflare CA bundle.  
   - Delete or comment out references to Cloudflare’s `.crt` and `.key` in your old Nginx config.  
   - Set up the Nginx config to terminate SSL using Let’s Encrypt certificates from Certbot instead.

4. **Set up Let’s Encrypt certificates with Certbot**  
   - In our Docker Compose file, we included a **certbot** service and volumes for storing `/etc/letsencrypt`.  
   - The Nginx container references those certificates (`fullchain.pem` and `privkey.pem`) to serve HTTPS.
   - HTTP on port 80 is used for ACME challenges. All non-challenge requests are redirected to HTTPS.
   - Certificates can be easily generated. First bring down everything (`docker compose down`). Then run a command like the one below in the project's root directory:
     `docker run --rm -it -p 80:80 -v $(pwd)/nginx/certbot/conf:/etc/letsencrypt -v $(pwd)/nginx/certbot/www:/var/www/certbot certbot/certbot certonly --standalone -d primeanarchy.com -d www.primeanarchy.com --email your-email-here@hello.com --agree-tos --no-eff-email`

5. **Redeploy**  
   - Run `docker-compose up --build -d` to rebuild images and start containers with the updated Nginx/Certbot setup.  
   - Verify at `https://www.minecraftoffline.net` that you have a valid Let’s Encrypt certificate, and Cloudflare is no longer in the loop.

---
