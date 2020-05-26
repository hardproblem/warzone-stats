module.exports = {
    addUserToChannel,
    removeUserFromChannel,
    getUserFromChannel,
    scheduleLeaderboard,
    isLeaderboardEnabled,
    unscheduleLeaderboard,
    getAllUsers,
    getAllLeaderboardSchedules,
    addStatsToSnapshot,
    addSnapshot,
    getSnapshotTimes,
    getLastSnapshotTime,
    init
};

const MongoClient = require('mongodb').MongoClient;

let _db = null;

async function init() {
    const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    _db = client.db(process.env.MONGO_DBNAME);
}

async function findChannel(channelId) {
    let channel = await _db.collection('channels').findOne({ channelId: channelId });
    // if channel not found in db, create it
    if (channel == null) {
        channel = { channelId: channelId, users: [] };
        await _db.collection('channels').insertOne(channel);
    }
    return channel;
}

async function isUserAdded(channelId, username, platform) {
    let userAdded = await _db.collection('channels').findOne({channelId: channelId, users: { $all: [{username: username, platform: platform}] }});
    return userAdded != null;
}

async function addUserToChannel(channelId, username, platform) {

    if (await isUserAdded(channelId, username, platform)) {
        throw 'User already added!';
    }

    await _db.collection('channels').updateOne({ channelId: channelId }, {
        $push: {
            users: { username: username, platform: platform }
        }
    }, {
        upsert: true
    });
}

async function getUserFromChannel(channelId, username, platform) {
    let r = await _db.collection('channels')
        .findOne({ 
            channelId: channelId,
            users: {
                $elemMatch: {
                    username: new RegExp(username, 'i'),
                    platform: platform
                }
            }
        }, {
            // only select matching user
            projection: {'users.$': 1}
        });
    return r ? r.users[0] : null;
}

async function removeUserFromChannel(channelId, username, platform) {
    await _db.collection('channels').updateOne({ channelId: channelId }, {
        $pull: {
            users: { username: username, platform: platform }
        }
    });
}

async function getAllUsers(channelId) {
    let channel = await findChannel(channelId);
    return channel.users;
}

async function scheduleLeaderboard(channelId, cron) {
    await _db.collection('leaderboards').updateOne({ channelId: channelId }, {
        $set: {
            cron: cron,
            snapshots: []
        }
    }, {
        upsert: true
    });
}

async function isLeaderboardEnabled(channelId) {
    let ld = await _db.collection('leaderboards').findOne({ channelId: channelId, cron: { $ne: null } });
    return ld ? true : false;
}

async function addSnapshot(channelId, timestamp, startTimestamp, users) {
    await _db.collection('leaderboards').updateOne({ channelId: channelId }, {
        $push: {
            snapshots: { timestamp: timestamp, startTimestamp: startTimestamp, users: users}
        }
    });
 }

async function addStatsToSnapshot(channelId, username, platform, stats, timestamp) {
    await _db.collection('leaderboards').updateOne(
        { 
            // filter by channel and timestamp 
            channelId: channelId, 
            'snapshots.timestamp': timestamp
        }, 
        {
            // uses mongodbs arrayFilters
            // $[t] => timestamp match
            // $[u] => username match
            // add a new stats field to the user object
            // needed for deep nested array element matches
            $set: {
               'snapshots.$[t].users.$[u].stats': stats
            },
        },
        {
            arrayFilters: [
                // snapshots => timestamp must match
                {'t.timestamp': timestamp},
                // snapshots => users => username & platform must match
                { $and: 
                    [
                        {'u.username': username},
                        {'u.platform': platform}
                    ] 
                }
            ],
            multi: true
        }
    );
}

async function getSnapshotTimes(channelId) {
    let ss = await _db.collection('leaderboards').findOne({ channelId: channelId }, 
        { projection: { 'snapshots.timestamp': 1 } }
    );
    return ss.snapshots.map(x => x.timestamp);
}

async function getLastSnapshotTime(channelId) {
    let timestamps = await getSnapshotTimes(channelId);
    return timestamps.reduce(function (a, b) { return new Date(a) > new Date(b) ? a : b; }, null);
}

async function unscheduleLeaderboard(channelId) {
    await _db.collection('leaderboards').updateOne({ channelId: channelId }, {
        $set: {
            cron: null
        }
    });
}

async function getAllLeaderboardSchedules() {
    return await _db.collection('leaderboards').find({ cron: { $ne: null } }, { projection: { cron: 1, channelId: 1 } });
}