const express = require('express');
const http = require('http');
const mqtt = require("mqtt")

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

const io = require("socket.io")(server);

/**
 * Connexion to TimeScale DB
 */

const { Sequelize, DataTypes } = require('sequelize')
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
  data: DataTypes.FLOAT
});

const TemperatureT2 = sequelize.define('TemperatureT2', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data: DataTypes.FLOAT
});

const Niveau = sequelize.define('Niveau', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data: DataTypes.INTEGER
});

const CO2 = sequelize.define('CO2', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data: DataTypes.FLOAT
});

const Diag = sequelize.define('Diag', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data: DataTypes.TEXT
});

const Puissance = sequelize.define('Puissance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data: DataTypes.FLOAT
});


const initServer = async () => {
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

    // Historique puissance
    sequelize.authenticate().then(() => {
      const puissances = Puissance.findAll(
        {
          order: [["dateInsertion", "ASC"]]
        }
      ).then((res) => {
        let datas = [];
        var j = 0;
        var moyenne = 0;
        for (let i = 0; i < res.length - 1; i++) {
          var dateMin = res[res.length - 1].dateInsertion;
          dateMin.setHours(dateMin.getHours() - 6);
          if (res[i].dateInsertion >= dateMin) {
            if (j < 50) {
              moyenne += res[i].data;
              j++;
            }
            else {
              j = 0;
              var date = res[i].dateInsertion;
              date.setHours(date.getHours() + 1);
              var dict = { "dateInsertion": date.toLocaleTimeString("fr-FR"), "data": moyenne / 50 };
              datas.push(dict);
              moyenne = res[i].data;
            }
          }
        }
        // Emission
        io.emit("PuissanceHistorique", datas);
      })
    })

    // Historique niveau
    sequelize.authenticate().then(() => {
      const niveaux = Niveau.findAll(
        {
          order: [["dateInsertion", "ASC"]]
        }
      ).then((res) => {
        let datas = [];
        var j = 0;
        var moyenne = 0;
        for (let i = 0; i < res.length - 1; i++) {
          var dateMin = res[res.length - 1].dateInsertion;
          dateMin.setHours(dateMin.getHours() - 6);
          if (res[i].dateInsertion >= dateMin) {
            if (j < 50) {
              moyenne += res[i].data;
              j++;
            }
            else {
              j = 0;
              var date = res[i].dateInsertion;
              date.setHours(date.getHours() + 1);
              var dict = { "dateInsertion": date.toLocaleTimeString("fr-FR"), "data": moyenne / 50 };
              datas.push(dict);
              moyenne = res[i].data;
            }
          }
        }
        // Emission
        io.emit("NiveauHistorique", datas);
      })
    })

    // Historique Co2
    sequelize.authenticate().then(() => {
      const co2 = CO2.findAll(
        {
          order: [["dateInsertion", "ASC"]]
        }
      ).then((res) => {
        let datas = [];
        var j = 0;
        var moyenne = 0;
        for (let i = 0; i < res.length - 1; i++) {
          var dateMin = res[res.length - 1].dateInsertion;
          dateMin.setHours(dateMin.getHours() - 6);
          if (res[i].dateInsertion >= dateMin) {
            if (j < 50) {
              moyenne += res[i].data;
              j++;
            }
            else {
              j = 0;
              var date = res[i].dateInsertion;
              date.setHours(date.getHours() + 1);
              var dict = { "dateInsertion": date.toLocaleTimeString("fr-FR"), "data": moyenne / 50 };
              datas.push(dict);
              moyenne = res[i].data;
            }
          }
        }
        // Emission
        io.emit("CO2Historique", datas);
      })
    })

    let data = payload.toString()

    try {
      data = JSON.parse(data)
    } catch (e) { }

    io.emit(topic, data)

    //Insertion of data into timescale tables for history
    sequelize.sync().then(() => {
      let topicSplit = topic.split('/');
      let dataName = topicSplit[topicSplit.length - 1];
      switch (dataName) {
        case 'T1':
          const temp1 = TemperatureT1.create({
            dateInsertion: Date.now(),
            data: data,
          });
          break;
        case 'T2':
          const temp2 = TemperatureT2.create({
            dateInsertion: Date.now(),
            data: data,
          });
          break;
        case 'Puissance':
          const puissance = Puissance.create({
            dateInsertion: Date.now(),
            data: data,
          });
          break;
        case 'Niveau':
          const niveau = Niveau.create({
            dateInsertion: Date.now(),
            data: data,
          });
          break;
        case 'Diag':
          const diag = Diag.create({
            dateInsertion: Date.now(),
            data: data,
          });
          break;
        case 'CO2':
          const co2 = CO2.create({
            dateInsertion: Date.now(),
            data: data,
          });
          break;
        default:
          console.log('Nom de donnée non reconnu' + dataName);
      }



    }).catch((error) => {
      console.error('Unable to create the tables : ', error);
    });

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
}

(async () => {
  await sequelize.sync({ force: true })
  await sequelize.authenticate()
  await initServer()
})()

/** 
 * APP
*/

app.get("/liste-pannes", (req, res) => {
  res.json({
    foo: "bar"
  })
})

/**
 * Notifications
 */
function sendNotification() {
  console.log("===============================================================");
  const OneSignal = require('onesignal-node');
  const client = new OneSignal.Client('b86bb1c7-a686-4471-a3a7-07bf311b13db', 'YjFhZjAwZDMtMTYyOC00Y2UwLTg3MzktYTJmYzRlZjllMDIx');

  console.log(client);
  console.log("==========================================================");

  const notification = {
    contents: {
      'tr': 'Yeni bildirim',
      'en': 'New notification',
    },
    included_segments: ['Subscribed Users']
  };

  client.createNotification(notification)
    .then(response => console.log(response))
    .catch(e => { });
}

console.log("#####################ICI##########################################");
sendNotification();