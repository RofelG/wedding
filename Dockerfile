FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000
CMD ["node", "src/server.js"]
