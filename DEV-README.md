# PointlessCube Local Development Setup

This guide will help you set up a local development environment for the PointlessCube project.

## Prerequisites

- Docker and Docker Compose installed on your machine
- Git (to clone the repository)

## Setup Instructions

1. **Clone the repository (if you haven't already)**
   ```bash
   git clone <repository-url>
   cd PointlessCube
   ```

2. **Start the development environment**
   ```bash
   # Start the development environment using .env.dev
   docker compose --env-file .env.dev -f docker-compose.dev.yml up -d --build
   ```

3. **Access the services**
   - Client (React app): http://localhost:3000
   - Server API: http://localhost:4000
   - Keycloak: http://localhost:8080/auth
   - PostgreSQL (App DB): localhost:5432 (username: myapp, password: appsecretpassword)
   - PostgreSQL (Keycloak DB): localhost:5433 (username: keycloak, password: password)

## Keycloak Setup

After starting the services for the first time, you'll need to set up Keycloak:

1. Go to http://localhost:8080/auth
2. Log in to the admin console with:
   - Username: admin
   - Password: password
3. Create a new realm called `myrealm`
4. In the realm, create a new client:
   - Client ID: `my-app`
   - Client Protocol: `openid-connect`
   - Root URL: `http://localhost:3000`
   - Valid Redirect URIs: `http://localhost:3000/*`
   - Web Origins: `http://localhost:3000`
5. In Realm Settings → Login, enable "User registration"
6. Set the Frontend URL to `http://localhost:8080/auth`

## Client Configuration

The client has been configured to automatically detect whether it's running in development or production mode:

- In development mode:
  - It connects to Keycloak at `http://localhost:8080/auth`
  - It uses `http://localhost:3000/` as the redirect URI
  - Socket.IO connects directly to the server at `http://localhost:4000`

- In production mode:
  - It connects to Keycloak at `https://www.minecraftoffline.net/auth`
  - It uses `https://www.minecraftoffline.net/game/` as the redirect URI
  - Socket.IO connects through the Nginx proxy

This configuration is handled automatically based on the `NODE_ENV` environment variable, which is set to `development` in the development Docker setup.

## Development Workflow

- The client and server containers are set up with hot-reloading, so changes to the code will be reflected immediately.
- The client code is mounted as a volume, so any changes you make to the React code will be immediately reflected.
- The server code is also mounted as a volume, and nodemon will restart the server when changes are detected.

## Stopping the Development Environment

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml down
```

To completely remove volumes (databases) and start fresh:
```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml down -v
```

## Troubleshooting

- If you encounter issues with the client not connecting to the server, make sure the CORS settings in the server are configured to allow requests from `http://localhost:3000`.
- If Keycloak isn't accessible, check that the container is running with `docker ps` and look at the logs with `docker logs keycloak_dev`.
- For database connection issues, ensure the correct environment variables are set in the `.env.dev` file. 