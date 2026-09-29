# Enflite help: builds the React client, then runs the Express server, which serves the API,
# the client and content/files. On start it loads content/ into MongoDB (npm run seed), so the
# database always matches the content in this image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY client client
RUN npm run build -w client

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY server server
COPY content content
COPY --from=build /app/client/dist client/dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "node server/scripts/seed.js && node server/src/index.js"]
