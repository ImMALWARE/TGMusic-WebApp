const express = require('express');
const fs = require('fs');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.json())
app.use(cookieParser());

let tg_clients = {};

app.get('/', async (req, res) => {
  fs.readFile('website/index.html', 'utf8', (err, data) => {
    res.send(data);
  });
});

app.get('/styles.css', async (req, res) => {
  fs.readFile('website/styles.css', 'utf8', (err, data) => {
    res.type('text/css');
    res.send(data);
  });
});

app.get('/tgmusic.js', async (req, res) => {
  fs.readFile('website/web.js', 'utf8', (err, data) => {
    res.type('text/javascript');
    res.send(data);
  });
});

app.get('/auth', async (req, res) => {
  fs.readFile('website/auth.html', 'utf8', (err, data) => {
    res.send(data);
  });
});

app.get('/auth.css', async (req, res) => {
  fs.readFile('website/auth.css', 'utf8', (err, data) => {
    res.type('text/css');
    res.send(data);
  });
});

app.get('/tgmusic.js', async (req, res) => {
  fs.readFile('website/web.js', 'utf8', (err, data) => {
    res.type('text/javascript');
    res.send(data);
  });
});

app.get('/favicon.ico', async (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(__dirname + '/website/favicon.ico');
})

app.get('/auth.js', async (req, res) => {
  fs.readFile('website/auth.js', 'utf8', (err, data) => {
    res.type('text/javascript');
    res.send(data);
  });
});

app.get('/api/get_songs', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write('event: start\n\n');
    if (!tg_clients[req.cookies.api_id]) {
      tg_clients[req.cookies.api_id] = new TelegramClient(new StringSession(''), parseInt(req.cookies.api_id), req.cookies.api_hash, { connectionRetries: 5 });
    }
    try {
        await tg_clients[req.cookies.api_id].start({
            botAuthToken: req.cookies.bot_token
        });
    } catch (error) {
        if (!error.code === 420) {
            console.error(error);
            return res.status(500).send('Error')
        }
        console.log(`Ожидание ${error.seconds} секунд...`);
        res.write(`data: {"type":"flood_wait","value":"${error.seconds}"}\n\n`);
        await new Promise(resolve => setTimeout(resolve, error.seconds * 1000));
    }
    console.log('Клиент запущен!');    
    const channel = await tg_clients[req.cookies.api_id].getInputEntity(req.cookies.channel_id);
    let told_title = false;
    let current_message_id = 1;

    while (true) {
        try {
            const response = await tg_clients[req.cookies.api_id].invoke(
                new Api.channels.GetMessages({
                    channel: channel,
                    id: [current_message_id]
                })
            );
            if (!told_title) {
              told_title = true;
              res.write(`data: {"type":"channel_name","value":"${response.chats[0].title}"}\n\n`);
            }
            current_message_id++;
            if (response.messages.length === 0) break;
            const message = response.messages[0];
            if (!message.audio) continue;
            res.write(`data: ${JSON.stringify({
              type: 'song',
              message_id: current_message_id-1,
              date: message.date,
              title: message.audio.attributes[0].title,
              performer: message.audio.attributes[0].performer,
              duration: message.audio.attributes[0].duration,
              media: Buffer.from(JSON.stringify({id: message.media.document.id, accessHash: message.media.document.accessHash, fileReference: message.media.document.fileReference})).toString('base64'),
              size: message.audio.size,
              filename: message.audio.attributes[1].fileName
            })}\n\n`);
        } catch (error) {
            console.error('Ошибка:', error);
            return res.end();
        }
    }
});

app.post('/api/get_song', async (req, res) => {
  const {media} = req.body;
  if (!tg_clients[req.cookies.api_id]) {
    res.status(400).send('Get songs list first!');
  }
  console.log('Клиент запущен!');
  const objidfl = JSON.parse(Buffer.from(media, 'base64').toString('utf-8'));
  objidfl.fileReference = Buffer.from(objidfl.fileReference.data);
  objidfl.thumbSize = 'y';
  const buffer = await tg_clients[req.cookies.api_id].downloadFile(new Api.InputDocumentFileLocation(objidfl), {
    progressCallback : console.log
  });
  res.send(buffer);
});

app.post('/api/check_secrets', async (req, res) => {
  const {api_id, api_hash, bot_token, channel_id} = req.body;
  try {
    const telegram = new TelegramClient(new StringSession(''), parseInt(api_id), api_hash, { connectionRetries: 5 });
    await telegram.start({botAuthToken: bot_token});   
    const channel = await telegram.getInputEntity(channel_id);
    await telegram.invoke(
      new Api.channels.GetMessages({
        channel: channel,
        id: [2]
      })
    );
  } catch (error) {
    console.error(error);
    return res.status(400).send(error.message)
  }
  res.send('OK');
});

app.get('*', (req, res) => {
  res.status(404).send('<head><title>404 Not Found</title><link rel="icon" href="https://i.imgur.com/lMbtjHr.png"><meta name="title" content="404"><meta name="description" content="Not Found"></head><body style="margin: 0px; background: #0e0e0e; height: 100%"><img style="display: block; margin: auto;background-color: hsl(0, 0%, 90%);transition: background-color 300ms;" src="https://http.cat/404"></body>');
});

app.listen(8000, '127.0.0.1', () => {
  console.log('Сервер запущен: http://127.0.0.1:8000/');
});