module.exports = {
    getPlayerProfile,
    getRecentMatches
};

const moment = require('moment');
const fetch = require('node-fetch');
const { getModeIds } = require('./db');

const modeIds = {};

async function request(url) {
    return await fetch(url, {
        "credentials": "include",
        "headers": {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en"
        },
        "method": "GET",
        "mode": "cors"
    }).then(res => res.json());
}

async function getPlayerProfile(platform, username) {
    let url = `https://api.tracker.gg/api/v2/warzone/standard/profile/${platform}/${encodeURIComponent(username)}`;
    let res = await request(url);
    return res.errors ? null : 
        {
            username: res.data.platformInfo.platformUserIdentifier,
            platform: res.data.platformInfo.platformSlug
        };
}

async function getRecentMatches(platform, username, duration, mode) {
    let now = moment();
    let recentMatches = [];

    let next = 'null';

    // check if modeIds loaded, else load from db
    if (!modeIds[mode]) modeIds[mode] = await getModeIds(mode);

    // fetch all matches during specified duration
    while (true) {

        // get matches from tracker.gg api
        let url = `https://api.tracker.gg/api/v1/warzone/matches/${platform}/${encodeURIComponent(username)}?type=wz&next=${next}`;
        let res = await request(url);

        if (res.errors) {
            throw {msg: res.errors[0].message, code: res.errors[0].code};
        }

        let matches = res.data.matches;

        // filter out matches of other types
        matches = matches.filter(x => modeIds[mode].includes(x.attributes.modeId));

        // filter to only today's matches
        let filteredMatches = matches.filter(x => now.diff(x.metadata.timestamp, duration.unit) < duration.value);
        
        // append filtered matches to todays list
        recentMatches.push(...filteredMatches);

        // stop if reached duration limit or all matches
        if (filteredMatches.length < matches.length) {
            break;
        }

        // setup for next query
        next = res.data.metadata.next;
    }

    return recentMatches;
}
