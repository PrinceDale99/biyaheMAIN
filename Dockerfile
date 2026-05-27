# Stage 1: Build C++ Core
FROM ubuntu:22.04 AS cpp-builder

# Install build dependencies
RUN apt-get update && apt-get install -y cmake g++ make

WORKDIR /app/core
COPY core/ ./

# Build the shared library. CMakeLists.txt outputs to ${CMAKE_BINARY_DIR}/lib/biyahe_core.so
RUN mkdir build && cd build && cmake .. && make

# Stage 2: Build Node.js Backend
FROM node:20-bookworm AS node-builder

WORKDIR /app
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci

# Copy backend source
COPY backend/ ./

# Ensure core directory exists and copy the built C++ shared library
RUN mkdir -p /app/core
COPY --from=cpp-builder /app/core/build/lib/biyahe_core.so /app/core/biyahe_core.so

RUN npm run build

# Stage 3: Production Runner
FROM node:20-bookworm-slim

WORKDIR /app

# Ensure core directory exists for the shared library
RUN mkdir -p /app/core

# Copy the built C++ shared library
COPY --from=cpp-builder /app/core/build/lib/biyahe_core.so /app/core/biyahe_core.so

# Copy the built Next.js app and its dependencies
COPY --from=node-builder /app/backend/.next /app/backend/.next
COPY --from=node-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=node-builder /app/backend/public /app/backend/public
COPY --from=node-builder /app/backend/package.json /app/backend/package.json
COPY --from=node-builder /app/backend/next.config.ts /app/backend/

# Set working directory to backend where the app runs
WORKDIR /app/backend

# Ensure Next.js binds to all interfaces for Render
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["npm", "start"]
