const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectID } = require('mongodb');
const { getPlayerProfile } = require('./cod-api');

let _db = null;

async function start() {
    const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    _db = client.db(process.env.MONGO_DBNAME);
    app.listen(3000, () => {
        console.log("App started!");
    });
}

const app = express();

app.use(cors());
app.use(express.json());

app.get('/getUsers', async(req, res) => {
   
    if (!req.query.id) {
        res.status(500);
        res.send("No ID specified!");
        return;
    }
    
    let _id = ObjectID(req.query.id);
    let channel = await _db.collection('channels').findOne({ _id });

    if (!channel) {
        res.statusCode(500);
        res.send("Invalid ID specified!");
        return;
    }
   
    res.send(channel.users);
});

app.post('/saveUsers', async(req, res) => {
    let { _id, userList } = req.body;
    if (!userList || !_id) {
        res.status(500);
        res.send('Invalid request!');
        return;
    }

    let users = userList.map(x =>  { return {username: x.username, platform: x.platform} });
    
    _id = ObjectID(_id);
    
    await _db.collection('channels').updateOne({ _id }, {
        $set: { users }
    });
    
    res.send('Updated!');
});

app.get('/isValidUser', async(req, res) => {
    if (!req.query.username || !req.query.platform) {
        res.status(500);
        res.send('Invalid query!');
        return;
    }
    
    let playerProfile = await getPlayerProfile(req.query.platform, req.query.username);
    res.send(playerProfile ? playerProfile : {});
});


start();