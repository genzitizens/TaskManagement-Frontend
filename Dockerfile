# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
