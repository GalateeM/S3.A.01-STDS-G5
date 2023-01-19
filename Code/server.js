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
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
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

/**
 * Connexion to TimeScale DB
 */

const {Sequelize, DataTypes}  = require('sequelize')
const sequelize = new Sequelize('postgres://timescale:password@timescaledb:5432/postgres',
    {
        dialect: 'postgres',
        protocol: 'postgres',
        dialectOptions: {
        }
    })

  sequelize.authenticate().then(() => {
      console.log('Connection has been established successfully.');
  }).catch(err => {
      console.error('Unable to connect to the database:', err);
  });

/**
 * Creation of tables in TimeScale DB
 */

const TemperatureT1 = sequelize.define('TemperatureT1', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data : DataTypes.FLOAT
});

sequelize.sync().then(() => {
  console.log('TemperatureT1 table created successfully!');

  const temp1 = TemperatureT1.create({
   dateInsertion: Date.now(),
   data: 20,
  });

  const temp2 = TemperatureT1.create({
    dateInsertion: Date.now(),
    data: 30,
   });

}).catch((error) => {
  console.error('Unable to create table : ', error);
});

sequelize.sync().then(() => {

  TemperatureT1.findAll().then(res => {
      console.log(res)
  }).catch((error) => {
      console.error('Failed to retrieve data : ', error);
  });

}).catch((error) => {
  console.error('Unable to create table : ', error);
});

/** 
 * APP
*/

app.get("/liste-pannes", (req, res) => {
  res.json({
    foo: "bar"
  })
})
