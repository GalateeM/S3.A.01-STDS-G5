const express = require('express');
const cors = require('cors')
const http = require('http');
const mqtt = require("mqtt")

const app = express();
const server = http.createServer(app);

app.use(cors())
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

client.on("connect", (socket) => {
    console.log('Connected')
    client.subscribe(["STDS/#"], () => {
        console.log(`Subscribe to topic`)
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
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(process.env.APP_PORT, () => {
  console.log(`listening on *:${process.env.APP_PORT}`);
});

console.log(process.env.APP_PORT)