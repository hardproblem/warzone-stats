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
        let lastTimestamp = await getLastTimestamp(channelId, cron);

        let channel = client.channels.cache.get(channelId);
        
        // send end of season message
        channel.send(`**Season finished!**\nCollecting stats and generating the leaderboard now.\nView it here: https://cod-daily-stats.herokuapp.com/leaderboards/${channelId}`);
        // create a placeholder snapshot
        await db.addSnapshot(channelId, timestamp.toISOString(), lastTimestamp.toISOString(), users);
        // fetch stats for all users and add to snapshot
        for (let u of users) {
            await getStats(u.username, u.platform, channelId, timestamp, lastTimestamp);
        }
        // notify that all stats have been fetched
        channel.send(`Last season's leaderboard has finished generating! View it here: https://cod-daily-stats.herokuapp.com/leaderboards/${channelId}`);
    });
    jobs[channelId] = job;
}

function cancelJob(channelId) {
    let job = jobs[channelId];
    if (job) {
        job.cancel();
    }
}

async function getLastTimestamp(channelId, cron) {
    let lastTimestamp = await db.getLastSnapshotTime(channelId);
    // if no snapshot exists, calculate time from when last cronjob would've hit
    if (!lastTimestamp) {
        lastTimestamp = prevCronHit(cron);
    }
    return moment(lastTimestamp);
}

async function getStats(username, platform, channelId, timestamp, lastTimestamp, tryn=0) {
    // retry timeouts
    let tryWaits = new Array(3).fill([15000, 30000, 60000, 90000, 120000]).flat().sort((a, b) => a - b);
    let promise = async(res, rej) => {
        try {
            // fetch stats and snapshot
            let data = await generateStats(platform, username, lastTimestamp, timestamp);
            await db.addStatsToSnapshot(channelId, username, platform, data, timestamp.toISOString());
            res();
        } catch (e) {
            if (e.code == "WzMatchService::NoAccount") {
                // if no account found, resolve promise as-is
                res();
            } else {
                // get next timeout
                let timeout = tryn < tryWaits.length ? tryWaits[tryn] : 120000;
                // retry if some other error occured
                setTimeout(async() => {
                    // recursive call the function again
                    await getStats(username, platform, channelId, timestamp, lastTimestamp, tryn + 1);
                    // call the original promise resolve
                    res();
                }, timeout);
            }
        }
    }

    return new Promise(promise);
}