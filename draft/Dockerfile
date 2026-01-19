# NiagaMap Repository: https://github.com/codingwithiz/NiagaMap
# Docker setup for running backend (Express) and frontend (Vite) services

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init bash

ENV NODE_ENV=development
ENV BACKEND_PORT=5000
ENV FRONTEND_PORT=5173

# Backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Frontend dependencies (needs dev deps for Vite)
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci 

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 5000
EXPOSE 5173

ENTRYPOINT ["dumb-init", "--"]

# Run backend and frontend together; Vite bound to 0.0.0.0 for container networking
CMD ["bash", "-c", "cd backend && PORT=${BACKEND_PORT} node server.js & cd frontend && npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT}"]
