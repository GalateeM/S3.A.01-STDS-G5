FROM node:18-alpine

WORKDIR .

COPY package*.json ./
EXPOSE 3000


ENV NODE_ENV=production
RUN npm ci
COPY . /
CMD ["node", "server.js"]

RUN docker run -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb:latest-pg14