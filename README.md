# Pointless Cube
Remember "Curiosity: What's Inside the Cube?"? It's like that except more transparent about being pointless.

# Set Up

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
KEYCLOAK_ISSUER=http://keycloak:8080/realms/myrealm
```

You will also need `server/.env`:
```
NODE_ENV=production
KEYCLOAK_ISSUER=http://keycloak:8080/realms/myrealm
PGHOST=app_postgres
PGUSER=myapp
PGPASSWORD=appsecretpassword
PGDATABASE=myapp
PGPORT=5432
PORT=4000
```

Make sure the PG password is the same for both

From the root directory (`PointlessCube/`), run:
```bash
docker-compose up --build -d
```

go to http://localhost:8080/. create a realm called myrealm. create a client called my-app...

root url http://localhost:80/ 
valid redirect uris http://localhost:80/*
web origins http://localhost

In Realm Settings → Login, enable "User registration"

^ KEYCLOAK_ISSUER=http://keycloak:8080/realms/myrealm

access app at localhost


docker-compose up -d
docker-compose build
docker-compose down