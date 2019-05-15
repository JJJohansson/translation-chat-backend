import { firebase_settings, translator_settings, translation_models } from './constants';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
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

app.get('/languages', (req, res) => {
  const languages = [
    { id: 'en', language: 'English' },
    { id: 'fi', language: 'Finnish' },
    { id: 'de', language: 'German' },
    { id: 'ru', language: 'Russian' },
    { id: 'sv', language: 'Swedish' }
  ];
  res.status(200).send(languages).end();
});

app.post('/magic', (req, res) => {
  const timestamp = req.body.timestamp ? req.body.timestamp : undefined;
  const message = req.body.message ? req.body.message : undefined;
  const user = req.body.user ? req.body.user : undefined;
  const language = req.body.language ? req.body.language : undefined;
  const address = req.connection.remoteAddress;
  console.log(`-- New connection from (${address}) --`);

  if (timestamp && message && user && language) {
    console.log('1. (en):', message);
    translateMagic(message)
      .then(result => {
        const data = {
          timestamp: timestamp,
          language: language,
          message: result[0],
          original: message,
          origin: address,
          route: result[1],
          translations: result[2]
        };
        console.log('-- End of connection --');
        let newMessage = ref.push();
        const newKey = newMessage.key;
        newMessage.set(data);
        res.status(200).send(data).end();
      })
      .catch(error => res.status(400).send({ error }).end());
  } else {
    res.status(400).send({ error: "required data missing" }).end();
  }

});

app.post('/message', (req, res) => {
  const timestamp = req.body.timestamp ? req.body.timestamp : undefined;
  const message = req.body.message ? req.body.message : undefined;
  const user = req.body.user ? req.body.user : undefined;
  const source = req.body.language ? req.body.language : undefined;
  const address = req.connection.remoteAddress;
  console.log(`New connection from (${address})`);
  console.log(timestamp, message, user, source);

  if (timestamp && message && user && source) {
    if (source === 'en') { // MESSAGE IN ENGLISH
      for (let model of translation_models) model.text = message;
      const params = translation_models.filter(model => model.source === source);
      const calls = params.map(call => translator.translate(call));

      Promise.all(calls)
        .then(response => {
          const translations = response.map(message => ({ message: message.translations[0].translation }));
          for (let i = 0; i < params.length; i++) translations[i].id = params[i].target;
          translations.push({ message: message, id: source });
          const data = {
            timestamp: timestamp,
            source: source,
            translations: translations,
            origin: address,
            user: user
          };

          ref.push(data);
          res.status(200).send(data).end();
        })
        .catch(error => res.status(500).send(error).end());
    } else { // MESSAGE NOT IN ENGLISH
      const params = translation_models.find(model => model.source === source);
      params.text = message;

      translator.translate(params)
        .then(response => {
          const sourceTranslation = response.translations[0].translation;
          const params = translation_models.filter(model => model.target !== source && model.target !== 'en');
          for (let model of params) model.text = sourceTranslation;
          const calls = params.map(call => translator.translate(call));

          Promise.all(calls)
            .then(response => {
              const translations = response.map(message => ({ message: message.translations[0].translation }));
              for (let i = 0; i < params.length; i++) translations[i].id = params[i].target;
              translations.push({ message: message, id: source }, { message: sourceTranslation, id: 'en' });
              const data = {
                timestamp: timestamp,
                source: source,
                translations: translations,
                origin: address,
                user: user
              };

              ref.push(data);
              res.status(200).send(data).end();
            })
            .catch(error => res.status(500).send(error).end());
        })
        .catch(error => res.status(500).send(error).end());
    }
  } else {
    res.status(400).send({ error: "required data missing" }).end();
  }
});

const translateMagic = (message = '', i = 0, route = [], translations = []) => {
  const params = [
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
      console.log(`${i + 2}. (${params[i].target}): ${translation}`);
      let iterator = i;
      let updatedRoute = route;
      let updatedTranslations = [...translations];
      updatedTranslations.push(translation);

      if (i === params.length - 1) {
        return [translation, updatedRoute, updatedTranslations];
      } else {
        iterator++;
        updatedRoute.push(params[i].model_il);
      }
      return translateMagic(translation, iterator, updatedRoute, updatedTranslations);
    })
    .catch(error => {
      return error;
    });
};

(() => {
  console.log("+------------------------------------------------------------------------+")
  console.log("|                          _                            _                |");
  console.log("|  _                      | |      _                   | |          _    |");
  console.log("| | |_ _ __ __ _ _ __  ___| | __ _| |_ ___  _ __    ___| |__   __ _| |_  |");
  console.log("| | __| '__/ _` | '_ \\/ __| |/ _` | __/ _ \\| '__|  / __| '_ \\ / _` | __| |");
  console.log("| | |_| | | (_| | | | \\__ \\ | (_| | || (_) | |    | (__| | | | (_| | |_  |");
  console.log("|  \\__|_|  \\__,_|_| |_|___/_|\\__,_|\\__\\___/|_|     \\___|_| |_|\\__,_|\\__| |");
  console.log("|                                                                        |")
  console.log("+------------------------ listening to port 3001 ------------------------+");
  app.listen(3001);
})();
