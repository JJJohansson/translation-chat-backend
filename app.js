import { firebase_settings, translator_settings } from './constants';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
// https://cloud.ibm.com/docs && https://cloud.ibm.com/apidocs/language-translator?code=node
import LanguageTranslatorV3 from 'watson-developer-cloud/language-translator/v3';

const serviceAccount = firebase_settings;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://broken-telephone-chat.firebaseio.com"
});
const db = admin.database();
const ref = db.ref('messages');

const translator = new LanguageTranslatorV3(translator_settings);

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/', (req, res) => {
  const timestamp = req.body.timestamp ? req.body.timestamp : undefined;
  const message = req.body.message ? req.body.message : undefined;
  const address = req.connection.remoteAddress;
  console.log(`-- New connection from ${address} --`);

  if (timestamp && message) {
    console.log('1.', message);
    translateMagic(message)
      .then(result => {
        const data = {timestamp: timestamp, message: result[0], original: message, origin: address, route: result[1]};
        console.log('-- End of connection! --');
        let newMessage= ref.push();
        const newKey = newMessage.key;
        newMessage.set(data);
        res.status(200).send(newKey).end();
      })
      .catch(error => console.log(error));
      /*
     const data = { timestamp: timestamp, message: message, origin: address };
     console.log('--- END ---');
     ref.push(data);
     res.status(200).send("OK").end();
      */
  } else {
    res.status(400).send('Required information missing!').end();
  }
});

console.log('listening to port 3001..');
app.listen(3001);

const translateMagic = (message = '', i = 0, route = []) => {
  let params = [
    {
      text: message,
      model_il: 'en-ar',
      source: 'en',
      target: 'ar'
    },
    {
      text: message,
      model_il: 'ar-en',
      source: 'ar',
      target: 'en'
    },
    {
      text: message,
      model_il: 'en-fi',
      source: 'en',
      target: 'fi'
    },
    {
      text: message,
      model_il: 'fi-en',
      source: 'fi',
      target: 'en'
    },
    {
      text: message,
      model_il: 'en-hi',
      source: 'en',
      target: 'hi'
    },
    {
      text: message,
      model_il: 'hi-en',
      source: 'hi',
      target: 'en'
    },
    {
      text: message,
      model_il: 'en-ja',
      source: 'en',
      target: 'ja'
    },
    {
      text: message,
      model_il: 'ja-en',
      source: 'ja',
      target: 'en'
    },
    {
      text: message,
      model_il: 'en-zh',
      source: 'en',
      target: 'zh'
    },
    {
      text: message,
      model_il: 'zh-en',
      source: 'zh',
      target: 'en'
    },
  ];

  return translator.translate(params[i])
    .then(response => {
      const translation = response.translations[0].translation.length > 0 ? response.translations[0].translation : message;
      console.log(`${i+2}. ${translation}`);
      let iterator = i;
      let updatedRoute = route;

      if (i === params.length-1) {
        return [translation, updatedRoute];
      } else {
        iterator++;
        updatedRoute.push(params[i].model_il);
      }
      return translateMagic(translation, iterator, updatedRoute);
    })
    .catch(error => {
      return error;
    });
};
