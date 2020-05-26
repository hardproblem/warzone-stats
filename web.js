const path = require('path');
const express = require('express');
const app = express();

const db = require('./db');

// api
app.get('/api/getSnapshotTimes', async(req, res) => {
    if (!req.query.channelId) {
        res.status(400).send('Invalid channelId');
        return;
    }
    let snapshotTimes = await db.getSnapshotTimes(req.query.channelId);
    res.json(snapshotTimes);
});

// api
app.get('/api/getStats', async(req, res) => {
    if (!req.query.timestamp) {
        res.status(400).send('Invalid timestamp');
        return;
    }  
    if (!req.query.channelId) {
        res.status(400).send('Invalid channel ID');
        return;
    }
    let stats = await db.getSnapshotStats(req.query.channelId, req.query.timestamp);
    res.json(stats);
});

// send leaderboard requests to leaderboard index
app.get(/\/leaderboard\/[0-9]+/,  (req, res) => {
    res.sendFile(path.join(__dirname, 'web/leaderboard/index.html'));
});

// serve all files from the web directory
app.get('/*', express.static('web'));


// run the app after initialization
init();

async function init() {
    await db.init();
    app.listen(process.env.PORT || 3000);
}
