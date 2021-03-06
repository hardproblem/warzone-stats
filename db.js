module.exports = {
    addUserToChannel,
    removeUserFromChannel,
    getUserFromChannel,
    schedule,
    unschedule,
    getAllUsers,
    getAllSchedules,
    getModeIds,
    init
};

const MongoClient = require('mongodb').MongoClient;

let _db = null;

async function init() {
    const client = await MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    _db = client.db(process.env.MONGO_DBNAME);
}

async function findChannel(channelId) {
    let channel = await _db.collection('channels').findOne({ channelId });
    // if channel not found in db, create it
    if (channel == null) {
        channel = { channelId, users: [] };
        await _db.collection('channels').insertOne(channel);
    }
    return channel;
}

async function isUserAdded(channelId, username, platform) {
    let userAdded = await _db.collection('channels').findOne({channelId, users: { $all: [{username: username, platform: platform}] }});
    return userAdded != null;
}

async function addUserToChannel(channelId, username, platform) {

    if (await isUserAdded(channelId, username, platform)) {
        throw 'User already added!';
    }

    await _db.collection('channels').updateOne({ channelId }, {
        $push: {
            users: { username, platform }
        }
    }, {
        upsert: true
    });
}

async function getUserFromChannel(channelId, username, platform) {
    let r = await _db.collection('channels').findOne({ 
        channelId,
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
    await _db.collection('channels').updateOne({ channelId }, {
        $pull: {
            users: { username, platform }
        }
    });
}

async function getAllUsers(channelId) {
    let channel = await findChannel(channelId);
    return channel.users;
}

async function schedule(channelId, cron, mode, time) {
    await _db.collection('schedules').updateOne({ channelId }, {
        $set: {
            cron: cron,
            time: time,
            mode: mode
        }
    }, {
        upsert: true
    });
}

async function unschedule(channelId) {
    await _db.collection('schedules').deleteOne({ channelId });
}

async function getAllSchedules() {
    return await _db.collection('schedules').find({});
}

async function getModeIds(mode) {
    return (await _db.collection('modes').findOne({ mode })).modeIds;
}