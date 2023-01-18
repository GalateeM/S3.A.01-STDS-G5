const express = require('express');
const http = require('http');
const mqtt = require("mqtt")

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

const io = require("socket.io")(server);

/**
 * MQTT
 */

const client = mqtt.connect(process.env.MQTT_URL, {
  clientId: "coucou",
  clean: true,
  connectTimeout: 4000,
  username: 'student',
  password: 'student',
  reconnectPeriod: 1000,
})

client.on("connect", () => {
    console.log('MQTT - Connected')

    client.subscribe(["STDS/#"], () => {
        console.log(`MQTT - Subscribed to all topics`)
    })
})

client.on("message", (topic, payload) => {
  let data = payload.toString()

  try {
    data = JSON.parse(data)
  } catch(e) {}

  io.emit(topic, data)
})

/**
 * SOCKET IO
 */

io.on('connection', (socket) => {
  console.log('WS - User Connected');

  socket.on('disconnect', () => {
    console.log('WS - User Disconnected');
  });
});

server.listen(process.env.APP_PORT, () => {
  console.log(`HTTP - Listening on *:${process.env.APP_PORT}`);
});