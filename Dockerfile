FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY FE ./FE
COPY BE ./BE
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY BE ./BE
COPY --from=build /app/FE/dist ./FE/dist
USER node
EXPOSE 3000
CMD ["node", "BE/src/server.js"]
