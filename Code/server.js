const express = require('express');
const http = require('http');
const mqtt = require("mqtt");
const { type } = require('os');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

const io = require("socket.io")(server);
const clonedeep = require('lodash.clonedeep')

var diagnostiqueEnCours = [];
var typeAlertEnCours = null;
var isTemp1Inf = false;
var isTemp2Sup = false;
var tempsProblemeDoubleTemps = null;
var etatEnCours = null;

/**
 * Connexion to TimeScale DB
 */

const { Sequelize, DataTypes } = require('sequelize');
const { cp } = require('fs');
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

const Panne = sequelize.define('Panne', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  },
  dateInsertion: DataTypes.DATE,
  data: DataTypes.TEXT
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

  /**
   * Destroy too old datas, first time
   */
  var dateMinDestroy = new Date();
  dateMinDestroy.setHours(dateMinDestroy.getHours() - 7);
  var timeOnDestroy = new Date();
  const { Op } = require("sequelize");
  sequelize.authenticate().then(() => {
    Puissance.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
    TemperatureT1.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
    TemperatureT2.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
    Niveau.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
    CO2.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
    Diag.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
    Panne.destroy({
      where: {
        dateInsertion: {
          [Op.lt]: dateMinDestroy
        }
      },
      force: true
    });
  })

  var datas1 = [];
  var datas2 = [];

  client.on("message", (topic, payload) => {

    // Historique puissance
    sequelize.authenticate().then(() => {
      const puissances = Puissance.findAll(
        {
          order: [["dateInsertion", "ASC"]]
        }
      ).then((res) => {
        let datas = [];
        if (res.length !== 0) {
          var j = 0;
          var moyenne = 0;
          var dateMin = new Date();
          dateMin.setHours(dateMin.getHours() - 6);
          for (let i = 0; i < res.length - 1; i++) {
            if (res[i].dateInsertion.getTime() >= dateMin.getTime()) {
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
        if (res.length !== 0) {
          var j = 0;
          var moyenne = 0;
          var dateMin = new Date();
          dateMin.setHours(dateMin.getHours() - 6);
          for (let i = 0; i < res.length - 1; i++) {
            if (res[i].dateInsertion.getTime() >= dateMin.getTime()) {
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
        if (res.length !== 0) {
          var j = 0;
          var moyenne = 0;
          var dateMin = new Date();
          dateMin.setHours(dateMin.getHours() - 6);
          for (let i = 0; i < res.length - 1; i++) {
            if (res[i].dateInsertion.getTime() >= dateMin.getTime()) {
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
        }
        // Emission
        io.emit("CO2Historique", datas);
      })
    })

    // Historique Température
    sequelize.authenticate().then(() => {

      datas1 = [];
      datas2 = [];

      const temperaturesT1 = TemperatureT1.findAll(
        {
          order: [["dateInsertion", "ASC"]]
        }
      ).then((res) => {
        if (res.length !== 0) {
          var j = 0;
          var moyenne = 0;
          var dateMin = new Date();
          dateMin.setHours(dateMin.getHours() - 6);
          for (let i = 0; i < res.length - 1; i++) {
            if (res[i].dateInsertion.getTime() >= dateMin.getTime()) {
              if (j < 50) {
                moyenne += res[i].data;
                j++;
              }
              else {
                j = 0;
                var date = res[i].dateInsertion;
                date.setHours(date.getHours() + 1);
                var dict = { "dateInsertion1": date.toLocaleTimeString("fr-FR"), "data1": moyenne / 50 };
                datas1.push(dict);
                moyenne = res[i].data;
              }
            }
          }
          const temperaturesT2 = TemperatureT2.findAll(
            {
              order: [["dateInsertion", "ASC"]]
            }
          ).then((res) => {
            var j = 0;
            var moyenne = 0;
            var dateMin = new Date();
            dateMin.setHours(dateMin.getHours() - 6);
            for (let i = 0; i < res.length - 1; i++) {
              if (res[i].dateInsertion.getTime() >= dateMin.getTime()) {
                if (j < 50) {
                  moyenne += res[i].data;
                  j++;
                }
                else {
                  j = 0;
                  var date = res[i].dateInsertion;
                  date.setHours(date.getHours() + 1);
                  var dict = { "dateInsertion2": date.toLocaleTimeString("fr-FR"), "data2": moyenne / 50 };
                  datas2.push(dict);
                  moyenne = res[i].data;
                }
              }
            }

            var datas = []
            var taille = datas1.length;

            if (datas1.length > datas2.length) {
              taille = datas2.length;
            }

            for (var i = 0; i < taille; i++) {
              datas.push({ "dateInsertion1": datas1[i].dateInsertion1, "dateInsertion2": datas2[i].dateInsertion2, "T1": datas1[i].data1, "T2": datas2[i].data2 });
            }

            // Emission
            io.emit("TemperatureHistorique", datas);
          })
        }
      })

      // Historique Pannes
      sequelize.authenticate().then(() => {
        const pannes = Panne.findAll(
          {
            order: [["dateInsertion", "ASC"]]
          }
        ).then((res) => {
          let datas = [];
          if (res.length !== 0) {
            var dateMin = new Date();
            dateMin.setHours(dateMin.getHours() - 6);
            for (let i = 0; i < res.length - 1; i++) {
              if (res[i].dateInsertion.getTime() >= dateMin.getTime()) {
                var date = res[i].dateInsertion;
                date.setHours(date.getHours() + 1);
                var dict = { "dateInsertion": date.toLocaleTimeString("fr-FR"), "data": res[i].data};
                datas.push(dict);
              }
            }
          }
          // Emission
          io.emit("PanneHistorique", datas);
        })
      })
    })

    let data = payload.toString()

    try {
      data = JSON.parse(data)
    } catch (e) { }

    io.emit(topic, data)

    //Insertion of data into timescale tables for history
    //create also notifications
    sequelize.sync().then(() => {
      var isAlert = false;
      let topicSplit = topic.split('/');
      let dataName = topicSplit[topicSplit.length - 1];
      switch (dataName) {
        case 'T1':
          const temp1 = TemperatureT1.create({
            dateInsertion: Date.now(),
            data: data,
          });
          if (data < 30) {
            isTemp1Inf = true;
          } else {
            isTemp1Inf = false;
          }
          if (data < -120) {
            if (!diagnostiqueEnCours.includes("Capteur de température ambiante déconnecté !")) {
              diagnostiqueEnCours.push("Capteur de température ambiante déconnecté !");
              const panne = Panne.create({
                dateInsertion: Date.now(),
                data: "Capteur de température ambiante déconnecté",
              });
            }
            if (typeAlertEnCours === null) {
              isAlert = true;
              if (typeAlertEnCours != "Capteur de température ambiante déconnecté !") {
                typeAlertEnCours = "Capteur de température ambiante déconnecté !";
                sendNotification(typeAlertEnCours);
                sendEmail(typeAlertEnCours);
              }
            }
          } else {
            const index = diagnostiqueEnCours.indexOf("Capteur de température ambiant déconnecté !");
            if (index > -1) { // only splice array when item is found
              diagnostiqueEnCours.splice(index, 1); // 2nd parameter means remove one item only
            }
          }
          break;
        case 'T2':
          const temp2 = TemperatureT2.create({
            dateInsertion: Date.now(),
            data: data,
          });
          if (data > 10) {
            isTemp2Sup = true;

          } else {
            isTemp2Sup = false;
          }
          if (data < -120) {
            if (!diagnostiqueEnCours.includes("Capteur de température du fût déconnecté !")) {
              diagnostiqueEnCours.push("Capteur de température du fût déconnecté !");
            }
            if (typeAlertEnCours === null) {
              isAlert = true;
              if (typeAlertEnCours != "Capteur de température du fût déconnecté !") {
                typeAlertEnCours = "Capteur de température du fût déconnecté !";
                sendNotification(typeAlertEnCours);
                sendEmail(typeAlertEnCours);
              }
            }
          } else {
            const index = diagnostiqueEnCours.indexOf("Capteur de température du fût déconnecté !");
            if (index > -1) { // only splice array when item is found
              diagnostiqueEnCours.splice(index, 1); // 2nd parameter means remove one item only
            }
          }
          if (etatEnCours != "MQTT 2 déconnecté !" && data > 7) {
            etatEnCours = "Température élevée de la bière !";
          }
          if(data>2 && data<=7 && etatEnCours != "MQTT 2 déconnecté !" && etatEnCours != "Température élevée de la bière !" && etatEnCours != "Le fût est plein !") {
            etatEnCours = "Température idéale de la bière !";
          }
          break;
        case 'Puissance':
          const puissance = Puissance.create({
            dateInsertion: Date.now(),
            data: data,
          });
          if (data == -10) {
            if (!diagnostiqueEnCours.includes("Wattmètre déconnecté !")) {
              diagnostiqueEnCours.push("Wattmètre déconnecté !");
            }
            if (typeAlertEnCours === null) {
              isAlert = true;
              if (typeAlertEnCours != "Wattmètre déconnecté !") {

                io.emit("Etat", "Wattmètre déconnecté !");
                typeAlertEnCours = "Wattmètre déconnecté !";
                sendNotification(typeAlertEnCours);
                sendEmail(typeAlertEnCours);
              }
            }
          } else {
            const index = diagnostiqueEnCours.indexOf("Wattmètre déconnecté !");
            if (index > -1) { // only splice array when item is found
              diagnostiqueEnCours.splice(index, 1); // 2nd parameter means remove one item only
            }
          }
          if (data > 75) {
            if (!diagnostiqueEnCours.includes("Puissance consommée trop importante !")) {
              diagnostiqueEnCours.push("Puissance consommée trop importante !");
            }
            if (typeAlertEnCours != "Puissance consommée trop importante !") {
              typeAlertEnCours = "Puissance consommée trop importante !";
              sendNotification(typeAlertEnCours);
              sendEmail(typeAlertEnCours);
            }
          } else {
            const index = diagnostiqueEnCours.indexOf("Puissance consommée trop importante !");
            if (index > -1) { // only splice array when item is found
              diagnostiqueEnCours.splice(index, 1); // 2nd parameter means remove one item only
            }
          }
          break;
        case 'Niveau':
          const niveau = Niveau.create({
            dateInsertion: Date.now(),
            data: data,
          });
          if (data < 10 && typeAlertEnCours === null) {
            isAlert = true;
            if (typeAlertEnCours != "Le fût est bientôt vide, pensez à le recharger !") {
              typeAlertEnCours = "Le fût est bientôt vide, pensez à le recharger !";
              sendNotification(typeAlertEnCours);
              sendEmail(typeAlertEnCours);
            }
            if (etatEnCours != "MQTT 2 déconnecté !" && etatEnCours != "Température élevée de la bière !") {
              etatEnCours = "Le fût est bientôt vide, pensez à le recharger !";
            }
          }
          if (data>90 && etatEnCours != "MQTT 2 déconnecté !" && etatEnCours != "Température élevée de la bière !") {
            etatEnCours = "Le fût est plein !";
          }
          break;
        case 'Diag':
          const diag = Diag.create({
            dateInsertion: Date.now(),
            data: data,
          });
          if (data == "MQTT 2 déconnecté !") {
            etatEnCours = "MQTT 2 déconnecté !";
            if (!diagnostiqueEnCours.includes("MQTT 2 déconnecté !")) {
              diagnostiqueEnCours.push("MQTT 2 déconnecté !");
              const panne = Panne.create({
                dateInsertion: Date.now(),
                data: "MQTT 2 déconnecté",
              });
            }
            isAlert = true;
            if (typeAlertEnCours != "MQTT 2 déconnecté !") {
              typeAlertEnCours = "MQTT 2 déconnecté !";
              sendEmail("MQTT 2 déconnecté !");
              sendNotification(typeAlertEnCours);
            }
          } else {
            const index = diagnostiqueEnCours.indexOf("MQTT 2 déconnecté !");
            if (index > -1) { // only splice array when item is found
              diagnostiqueEnCours.splice(index, 1); // 2nd parameter means remove one item only
            }
          }
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
      if (isTemp1Inf && isTemp2Sup) {
        if (tempsProblemeDoubleTemps === null) {
          var tpsDate = new Date();
          tempsProblemeDoubleTemps = tpsDate.getTime();
        } else {
          var tpsDate = new Date();
          var diffSecondes = (tpsDate.getTime() - tempsProblemeDoubleTemps) / 1000;
          //si cela fait plus de 30min que les températures ne sont pas idéales et si l'alerte n'est pas déjà présente
          //alors on crée une alerte
          if (diffSecondes > 20) {//1800
            if (!diagnostiqueEnCours.includes("Problème de fonctionnement du module peltier")) {
              diagnostiqueEnCours.push("Problème de fonctionnement du module peltier");
              const panne = Panne.create({
                dateInsertion: Date.now(),
                data: "Problème de fonctionnement du module peltier",
              });
            }
            if (typeAlertEnCours === null) {
              isAlert = true;
              if (typeAlertEnCours != "Problème de fonctionnement du module peltier") {
                typeAlertEnCours = "Problème de fonctionnement du module peltier";
                sendNotification(typeAlertEnCours);
                sendEmail(typeAlertEnCours);
              }
            }
          } else {
            const index = diagnostiqueEnCours.indexOf("Problème de fonctionnement du module peltier");
            if (index > -1) { // only splice array when item is found
              diagnostiqueEnCours.splice(index, 1); // 2nd parameter means remove one item only
            }
          }
        }
      } else {
        tempsProblemeDoubleTemps = null;
      }

      if (isAlert = false) {
        typeAlertEnCours = null;
      }
      //tests : diagnostiqueEnCours = ["Problème de fonctionnement du module peltier", "Puissance consommée trop importante !", "MQTT 2 déconnecté !"];
      io.emit("Panne", diagnostiqueEnCours);
      if(etatEnCours!=null) {
        io.emit("Etat", etatEnCours);
      }


    }).catch((error) => {
      console.error('Unable to create the tables : ', error);
    });

    //delete the too old values every 1 hours
    var dateNow = new Date();
    var dateMinDestroy = new Date();
    dateMinDestroy.setHours(dateMinDestroy.getHours() - 7);
    if (dateNow.getHours() - timeOnDestroy.getHours() >= 1) {
      Puissance.destroy({
        where: {
          dateInsertion: {
            [Op.lt]: dateMinDestroy
          }
        },
        force: true
      });
      TemperatureT1.destroy({
        where: {
          dateInsertion: {
            [Op.lt]: dateMinDestroy
          }
        },
        force: true
      });
      TemperatureT2.destroy({
        where: {
          dateInsertion: {
            [Op.lt]: dateMinDestroy
          }
        },
        force: true
      });
      Niveau.destroy({
        where: {
          dateInsertion: {
            [Op.lt]: dateMinDestroy
          }
        },
        force: true
      });
      CO2.destroy({
        where: {
          dateInsertion: {
            [Op.lt]: dateMinDestroy
          }
        },
        force: true
      });
      Diag.destroy({
        where: {
          dateInsertion: {
            [Op.lt]: dateMinDestroy
          }
        },
        force: true
      });
    }
    timeOnDestroy = new Date();

  })

  /**
   * SOCKET IO
   */

  io.on('connection', (socket) => {
    console.log('WS - User Connected');

    socket.on('disconnect', () => {
      console.log('WS - User Disconnected');
    });

    socket.on("NewMail", (arg) => {
      addEmail(arg);  
    });
  });

  server.listen(process.env.APP_PORT, () => {
    console.log(`HTTP - Listening on *:${process.env.APP_PORT}`);
  });
}

(async () => {
  await sequelize.sync({ force: false })
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
const OneSignal = require('onesignal-node');
const client = new OneSignal.Client('b86bb1c7-a686-4471-a3a7-07bf311b13db', 'YjFhZjAwZDMtMTYyOC00Y2UwLTg3MzktYTJmYzRlZjllMDIx');

function addEmail(email) {
  const user = {
    device_type : 11,
    identifier: email,
    notification_types : 1
  }
  client.addDevice(user);
}



function sendNotification(typeAlertEnCours) {
  const notification = {
    contents: {
      'en': typeAlertEnCours,
    },
    included_segments: ['Subscribed Users']
  };

  client.createNotification(notification)
    .then(response => console.log(response))
    .catch(e => { });
}


function sendEmail(message) {
  const notification = {
    included_segments: ['Subscribed Users'],
    email_subject: "Notification PintVision",
    email_from_address: "no-reply@pintvision.com",
    email_body: `<!DOCTYPE html>
    <html lang="fr" xml:lang="fr" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
        <meta name="x-apple-disable-message-reformatting">
         <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
     <style type="text/css">
            html { background-color:#E1E1E1; margin:0; padding:0; }
            body, #bodyTable, #bodyCell, #bodyCell{height:100% !important; margin:0; padding:0; width:100% !important;font-family:Helvetica, Arial, "Lucida Grande", sans-serif;}
            table{border-collapse:collapse;}
            table[id=bodyTable] {width:100%!important;margin:auto;max-width:500px!important;color:#7A7A7A;font-weight:normal;}
            img, a img{border:0; outline:none; text-decoration:none;height:auto; line-height:100%;}
            a {text-decoration:none !important;border-bottom: 1px solid;}
            h1, h2, h3, h4, h5, h6{color:#5F5F5F; font-weight:normal; font-family:Helvetica; font-size:20px; line-height:125%; text-align:Left; letter-spacing:normal;margin-top:0;margin-right:0;margin-bottom:10px;margin-left:0;padding-top:0;padding-bottom:0;padding-left:0;padding-right:0;}
    
            /* CLIENT-SPECIFIC STYLES */
            .ReadMsgBody{width:100%;} .ExternalClass{width:100%;} /* Force Hotmail/Outlook.com to display emails at full width. */
            .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div{line-height:100%;} /* Force Hotmail/Outlook.com to display line heights normally. */
            table, td{mso-table-lspace:0pt; mso-table-rspace:0pt;} /* Remove spacing between tables in Outlook 2007 and up. */
            #outlook a{padding:0;} /* Force Outlook 2007 and up to provide a "view in browser" message. */
            img{-ms-interpolation-mode: bicubic;display:block;outline:none; text-decoration:none;} /* Force IE to smoothly render resized images. */
            body, table, td, p, a, li, blockquote{-ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; font-weight:normal!important;} /* Prevent Windows- and Webkit-based mobile platforms from changing declared text sizes. */
            .ExternalClass td[class="ecxflexibleContainerBox"] h3 {padding-top: 10px !important;} /* Force hotmail to push 2-grid sub headers down */
            /* ========== Page Styles ========== */
            h1{display:block;font-size:26px;font-style:normal;font-weight:normal;line-height:100%;}
            h2{display:block;font-size:20px;font-style:normal;font-weight:normal;line-height:120%;}
            h3{display:block;font-size:17px;font-style:normal;font-weight:normal;line-height:110%;}
            h4{display:block;font-size:18px;font-style:italic;font-weight:normal;line-height:100%;}
            .flexibleImage{height:auto;}
            .linkRemoveBorder{border-bottom:0 !important;}
            table[class=flexibleContainerCellDivider] {padding-bottom:0 !important;padding-top:0 !important;}
    
            body, #bodyTable{background-color:#E1E1E1;}
            #emailHeader{background-color:#E1E1E1;}
            #emailBody{background-color:#FFFFFF;}
            #emailFooter{background-color:#E1E1E1;}
            .nestedContainer{background-color:#F8F8F8; border:1px solid #CCCCCC;}
            .emailButton{background-color:#205478; border-collapse:separate;}
            .buttonContent{color:#FFFFFF; font-family:Helvetica; font-size:18px; font-weight:bold; line-height:100%; padding:15px; text-align:center;}
            .buttonContent a{color:#FFFFFF; display:block; text-decoration:none!important; border:0!important;}
            .emailCalendar{background-color:#FFFFFF; border:1px solid #CCCCCC;}
            .emailCalendarMonth{background-color:#205478; color:#FFFFFF; font-family:Helvetica, Arial, sans-serif; font-size:16px; font-weight:bold; padding-top:10px; padding-bottom:10px; text-align:center;}
            .emailCalendarDay{color:#205478; font-family:Helvetica, Arial, sans-serif; font-size:60px; font-weight:bold; line-height:100%; padding-top:20px; padding-bottom:20px; text-align:center;}
            .imageContentText {margin-top: 10px;line-height:0;}
            .imageContentText a {line-height:0;}
            #invisibleIntroduction {display:none !important;} /* Removing the introduction text from the view */
            span[class=ios-color-hack] a {color:#275100!important;text-decoration:none!important;} 
            span[class=ios-color-hack2] a {color:#205478!important;text-decoration:none!important;}
            span[class=ios-color-hack3] a {color:#8B8B8B!important;text-decoration:none!important;}
            /* MOBILE STYLES */
            @media only screen and (max-width: 480px){
                body{width:100% !important; min-width:100% !important;} /* Force iOS Mail to render the email at full width. */
                table[id="emailHeader"],
                table[id="emailBody"],
                table[id="emailFooter"],
                table[class="flexibleContainer"],
                td[class="flexibleContainerCell"] {width:100% !important;}
                td[class="flexibleContainerBox"], td[class="flexibleContainerBox"] table {display: block;width: 100%;text-align: left;}
                table[class="emailButton"]{width:100% !important;}
                td[class="buttonContent"]{padding:0 !important;}
                td[class="buttonContent"] a{padding:15px !important;}
    
            }
            @media only screen and (-webkit-device-pixel-ratio:.75){
                /* Put CSS for low density (ldpi) Android layouts in here */
            }
    
            @media only screen and (-webkit-device-pixel-ratio:1){
                /* Put CSS for medium density (mdpi) Android layouts in here */
            }
    
            @media only screen and (-webkit-device-pixel-ratio:1.5){
                /* Put CSS for high density (hdpi) Android layouts in here */
            }
             @media only screen and (min-device-width : 320px) and (max-device-width:568px) {
    
            }
        </style>
    </head>
    <body bgcolor="#E1E1E1" leftmargin="0" marginwidth="0" topmargin="0" marginheight="0" offset="0">
        <center role="article" aria-roledescription="email" aria-label="email name" lang="en" dir="ltr" style="background-color:#E1E1E1;">
            <table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable" style="table-layout: fixed;max-width:100% !important;width: 100% !important;min-width: 100% !important;">
                <tr>
                    <td align="center" valign="top" id="bodyCell">
    
                        <table bgcolor="#E1E1E1" border="0" cellpadding="0" cellspacing="0" width="500" id="emailHeader">
                            <tr>
                                <td align="center" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center" valign="top">
                                                <!-- FLEXIBLE CONTAINER // -->
                                                <table border="0" cellpadding="10" cellspacing="0" width="500" class="flexibleContainer">
                                                    <tr>
                                                        <td valign="top" width="500" class="flexibleContainerCell">
    
                                                            <!-- CONTENT TABLE // -->
                                                            <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                                                                <tr>
                                                                    <td align="right" valign="middle" class="flexibleContainerBox">
                                                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:100%;">
                                                                            <tr>
                                                                                <td align="left" class="textContent">                                                                                 
                                                                                </td>
                                                                            </tr>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
    
                        <!-- EMAIL BODY // -->
                        <table bgcolor="#FFFFFF"  border="0" cellpadding="0" cellspacing="0" width="500" id="emailBody">
                            <tr>
                                <td align="center" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="color:#FFFFFF;" bgcolor="#3498db">
                                        <tr>
                                            <td align="center" valign="top">
                                                <table border="0" cellpadding="0" cellspacing="0" width="500" class="flexibleContainer">
                                                    <tr>
                                                        <td align="center" valign="top" width="500" class="flexibleContainerCell">
                                                            <table border="0" cellpadding="30" cellspacing="0" width="100%">
                                                                <tr>
                                                                    <td align="center" valign="top" class="textContent">
                                                                        <h1 style="color:#FFFFFF;line-height:100%;font-family:Helvetica,Arial,sans-serif;font-size:35px;font-weight:normal;margin-bottom:5px;text-align:center;">Nouvelle notification</h1>
                                                                        <h2 style="text-align:center;font-weight:normal;font-family:Helvetica,Arial,sans-serif;font-size:23px;margin-bottom:10px;color:#205478;line-height:135%;">PintVision</h2>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr mc:hideable>
                                <td align="center" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center" valign="top">
                                                <table border="0" cellpadding="30" cellspacing="0" class="flexibleContainer">
                                                    <tr>
                                                        <td valign="top" width="500" class="flexibleContainerCell">
    
                                                            <h3 style="color:#5F5F5F;line-height:125%;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:normal;margin-top:0;margin-bottom:3px;text-align:left;">Bonjour,</h3>
                                                            <div style="text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:15px;margin-bottom:0;color:#5F5F5F;line-height:135%;">Vous avez reçu une nouvelle notification : "` + message + `".

                                                            </div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr style="padding-top:0;">
                                            <td align="center" valign="top">
                                                <table border="0" cellpadding="30" cellspacing="0" width="500" class="flexibleContainer">
                                                    <tr>
                                                        <td style="padding-top:0;" align="center" valign="top" width="500" class="flexibleContainerCell">
                                                            <table border="0" cellpadding="0" cellspacing="0" width="50%" class="emailButton" style="background-color: #3498DB;">
                                                                <tr>
                                                                    <td align="center" valign="middle" class="buttonContent" style="padding-top:15px;padding-bottom:15px;padding-right:15px;padding-left:15px;">
                                                                        <a style="color:#FFFFFF;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:20px;line-height:135%;" target="_blank" href="http://localhost:3000">Voir sur l'application</a>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        
    
    
                            <!-- MODULE DIVIDER // -->
                            <tr>
                                <td align="center" valign="top">
                                    <!-- CENTERING TABLE // -->
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center" valign="top">
                                                <!-- FLEXIBLE CONTAINER // -->
                                                <table border="0" cellpadding="0" cellspacing="0" width="500" class="flexibleContainer">
                                                    <tr>
                                                        <td align="center" valign="top" width="500" class="flexibleContainerCell">
                                                            <table class="flexibleContainerCellDivider" border="0" cellpadding="30" cellspacing="0" width="100%">
                                                                <tr>
                                                                    <td align="center" valign="top" style="padding-top:0px;padding-bottom:0px;">
    
                                                                        <!-- CONTENT TABLE // -->
                                                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                                            <tr>
                                                                                <td align="center" valign="top" style="border-top:1px solid #C8C8C8;"></td>
                                                                            </tr>
                                                                        </table>
                                                                        <!-- // CONTENT TABLE -->
    
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <!-- // FLEXIBLE CONTAINER -->
                                            </td>
                                        </tr>
                                    </table>
                                    <!-- // CENTERING TABLE -->
                                </td>
                            </tr>
                            <!-- // END -->
                        <!-- EMAIL FOOTER // -->
                        <table bgcolor="#E1E1E1" border="0" cellpadding="0" cellspacing="0" width="500" id="emailFooter">
                            <tr>
                                <td align="center" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td align="center" valign="top">
                                                <table border="0" cellpadding="0" cellspacing="0" class="flexibleContainer">
                                                    <tr>
                                                        <td align="center" valign="top" class="flexibleContainerCell">
                                                            <table border="0" cellpadding="30" cellspacing="0" width="100%">
                                                                <tr>
                                                                    <td valign="top" bgcolor="#E1E1E1">
                                                                        <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#828282;text-align:center;line-height:120%;">
                                                                            <div>Copyright &#169; 2020 <a href="http://www.charlesmudy.com/respmail/" target="_blank" style="text-decoration:none;color:#828282;"><span style="color:#828282;">Respmail</span></a>. All&nbsp;rights&nbsp;reserved.</div>
                                                                            <div>Si vous ne souhaitez plus recevoir d'emails, <a href="[unsubscribe_url]" target="_blank" style="text-decoration:none;color:#828282;"><span style="color:#828282;">cliquez ici</span></a>.</div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </center>
    </body>
    </html>
    `
  }

  client.createNotification(notification).then(response => console.log(response))
    .catch(e => { });
}
