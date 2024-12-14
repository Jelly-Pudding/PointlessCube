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
