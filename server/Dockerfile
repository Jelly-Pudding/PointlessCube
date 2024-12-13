# Stage 1: Build
FROM node:18-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
# If you have a build step (e.g., TypeScript), include it here

# Stage 2: Production Image
FROM node:18-alpine
WORKDIR /usr/src/app

# Copy only necessary files from build stage
COPY --from=build /usr/src/app/package*.json ./
RUN npm install --production

COPY --from=build /usr/src/app/server.js ./
COPY --from=build /usr/src/app/migrations ./migrations

# Set non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 4000
CMD ["node", "server.js"]
