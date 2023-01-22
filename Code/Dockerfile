FROM node:18-alpine

WORKDIR .

COPY package*.json ./
EXPOSE 3000


ENV NODE_ENV=production
RUN npm ci
COPY . /
CMD ["node", "server.js"]


RUN docker-compose up