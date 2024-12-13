# Stage 1: Build
FROM node:18-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Image (optional)
# We are building the React app in the first stage and serving it via Nginx,
# so no need for a second stage here.
