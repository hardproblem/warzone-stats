module.exports = {
    init,
    enable,
    disable
};

const { scheduleJob } = require('node-schedule');
const moment = require('moment');

const db = require('./db');
const { generateStats } = require('./stats');
const { prevCronHit } = require('./util');

const jobs = {};
var client = null;

async function init(_client) {
    client = _client;
    let schedules = await db.getAllLeaderboardSchedules();
    schedules.forEach(sch => {
        createJob(sch.channelId, sch.cron);
    });
}

async function enable(channelId, cron) {
    await db.scheduleLeaderboard(channelId, cron);
    cancelJob(channelId);
    createJob(channelId, cron);
}

async function disable(channelId) {
    await db.unscheduleLeaderboard(channelId);
    cancelJob(channelId);
}

function createJob(channelId, cron) {
    let job = scheduleJob(cron, async() => {
        let users = await db.getAllUsers(channelId);
        let timestamp = moment();
        let duration = await getDuration(channelId, cron, timestamp);

        console.log('starting');
        
        await db.addSnapshot(channelId, timestamp.toISOString(), users);
        await Promise.all(users.map(u => getStats(u.username, u.platform, duration, channelId, timestamp)));

        console.log("promises finished");
        
        let channel = client.channels.cache.get(channelId);
        channel.send('A new leaderboard is ready for viewing!'); 
    });
    jobs[channelId] = job;
}

function cancelJob(channelId) {
    let job = jobs[channelId];
    if (job) {
        job.cancel();
    }
}

async function getDuration(channelId, cron, timestamp) {
    let lastTimestamp = await db.getLastSnapshotTime(channelId);
    // if no snapshot exists, calculate time from when last cronjob would've hit
    if (!lastTimestamp) {
        lastTimestamp = prevCronHit(cron);
    }
    // return { value: timestamp.diff(lastTimestamp, 'hours'), unit: 'hour' };
    return { value: 2, unit: 'day' };
}

async function getStats(username, platform, duration, channelId, timestamp, tryn=0) {
    console.log('promise running')
    let tryWaits = new Array(3).fill([15000, 30000, 60000, 90000, 120000]).flat().sort((a, b) => a - b);
    let promise = async(res, rej) => {
        try {
            let data = await generateStats(platform, username, duration);
            await db.addStatsToSnapshot(channelId, username, platform, data, timestamp.toISOString());
            res();
        } catch (e) {
            if (e.code == "WzMatchService::NoAccount") {
                // if no account found, resolve promise as-is
                res();
            } else {
                let timeout = tryn < tryWaits.length ? tryWaits[tryn] : 120000;
                // retry if some other error occured
                setTimeout(async() => {
                    // recursive call the function again
                    await getStats(username, platform, duration, channelId, timestamp, tryn + 1);
                    // call the original promise resolve
                    res();
                }, timeout);
            }
        }
    }

    return new Promise(promise);
}