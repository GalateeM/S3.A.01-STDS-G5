FROM node:18-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./
EXPOSE 3000

ENV NODE_ENV=production
RUN npm ci
COPY . /
CMD ["node", "server.js"]