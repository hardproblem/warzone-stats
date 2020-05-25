module.exports = controller;

const db = require('./db');
const { sendStats } = require('./stats');
const { playerExists } = require('./cod-api');
const util = require('./util');
const leaderboard = require('./leaderboard');

const commands = {
    'stats': { 
        method: allStats, 
        syntax: 'stats [time:3h|3d|1w|2m:1d]',
        help: 'Display stats of all registered users',
        rx: /^!cds stats( ([0-9]+)([h|d|w|m]))?$/
    },
    'users': { 
        method: getUsers,
        syntax: 'users',
        help: 'Prints list of all registered users',
        rx: /^!cds users$/
    },
    'register': {
        method: registerUser,
        syntax: 'register <psn|atvi> <username>',
        help: 'Registers a new user',
        rx: /^!cds register (psn|atvi) [0-9A-Za-z#_-]+$/
    },
    'unregister': { 
        method: unregisterUser, 
        syntax: 'unregister <psn|atvi> <username>', 
        help: 'Unregisters a user',
        rx: /^!cds unregister (psn|atvi) [0-9A-Za-z#_-]+$/ 
    },
    'single': { 
        method: singleStats, 
        syntax: 'single <psn|atvi> <username> [time:3h|3d|1w|2m:1d]',
        help: 'Display solo stats',
        rx: /^!cds single (psn|atvi) [0-9A-Za-z#_-]+( ([0-9]+)([h|d|w|m]))?$/
    },
    'leaderboard-enable': {
        method: enableLeaderboard,
        syntax: 'leaderboard-enable \'<cronjob>\'',
        help: 'Generates a leaderboard based on performance between cronjob runs',
        rx: /^!cds leaderboard-enable '([*\//0-9- ]+)'?$/
    },
    'leaderboard-disable': {
        method: disableLeaderboard,
        syntax: 'leaderboard-disable',
        help: 'Disable leaderboard',
        rx: /^!cds leaderboard-disable$/
    },
    'help': {
        method: help,
        syntax: 'help',
        help: 'Shows this help',
        rx: /^!cds help$/
    },
    'teams': {
        method: teamSplit,
        syntax: 'teams <players-per-team>',
        help: 'Randomly splits users into teams',
        rx: /^!cds teams [0-9]+$/
    }
};

async function controller(msg) {
    // trim unnecessary spaces
    msg.content = msg.content.replace(/ +/g, ' ').trim();
    
    // extract command name
    let cmd = util.tokenize(msg.content)[1];

    try {
        const command = commands[cmd];
        // check if command exists
        if (!command) {
            help(msg);
            return;
        }
        // check if syntax is okay
        if (!command.rx.test(msg.content)) {
            msg.reply(`Invalid syntax, use \`!cds ${command.syntax}\` instead.\nSend \`!cds help\` for more information.`);
            return;
        }
        // run command
        await command.method(msg);
    } catch (e) {
        msg.reply(e);
    }

}

async function allStats(msg) {
    let tokens = util.tokenize(msg.content);
    let users = await db.getAllUsers(msg.channel.id);

    // check if any users registered
    if (users.length == 0) {
        msg.reply('No users registered!');
        return;
    }
 
    // prepare reply
    let duration = util.parseDuration(tokens[2]);

    let i = 0;
    // for each user, call the sendStats function with a 3s delay to prevent API exhaustion
    users.forEach(async(u) => { 
        // send initial message for further editing
        let msgObj = await msg.reply(`Fetching stats for **${util.escapeMarkdown(u.username)}** (${u.platform})...`);
        setTimeout(sendStats(u, 0, msgObj, duration), i++ * 3000)
    });
}

async function getUsers(msg) {
    let users = await db.getAllUsers(msg.channel.id);
    users = users.map(x => `${util.escapeMarkdown(x.username)} (${x.platform})`);
    msg.reply(`\nRegistered users:\n${users.join('\n')}`);
}

async function registerUser(msg) {
    let tokens = util.tokenize(msg.content);
    let username = tokens[3];
    let platform = tokens[2];

    if (await playerExists(platform, username))

    await db.addUserToChannel(msg.channel.id, username, platform);
    msg.reply(`**${username}** *(${platform})* has been registered!`);    
}

async function unregisterUser(msg) {
    let tokens = util.tokenize(msg.content);
    let username = tokens[3];
    let platform = tokens[2];

    await db.removeUserFromChannel(msg.channel.id, username, platform);
    msg.reply(`**${util.escapeMarkdown(username)}** *(${platform})* has been unregistered!`);
}

async function singleStats(msg) {
    let tokens = util.tokenize(msg.content);   
    let username = tokens[3];
    let platform = tokens[2];
    let duration = util.parseDuration(tokens[4]);

    let msgObj = await msg.reply(`Fetching stats for **${util.escapeMarkdown(username)}** (${platform})...`);
    await sendStats(u, 0, msgObj, duration)(); 
}

async function enableLeaderboard(msg) {
    let rx = commands['leaderboard-enable'].rx;
    let match = msg.content.match(rx);
    let cron = match[1];
    
    try {
        // check if cron is valid
        if (!util.isValidCron(cron)) {
            msg.reply('Invalid cron syntax!');
            return;
        }

        // schedule message
        await leaderboard.enable(msg.channel.id, cron);
        let nextHit = util.nextCronHit(cron);
        msg.reply(`Leaderboard enabled! Will be updated next on ${ nextHit.format('DD MMM, YYYY') } at ${ nextHit.format('hh:mma') } UTC.`);
    } catch (e) {
        msg.reply(e);
    }
}

async function disableLeaderboard(msg) {
    await leaderboard.disable(msg.channel.id);
    msg.reply('Leaderboard disabled!');
}

async function help(msg) {
    let help = '\n**COD-Daily-Stats Guide:**\n';
    for (let cmd in commands) {
        help += `\`${commands[cmd].syntax}\`: *${commands[cmd].help}*\n`;
    }
    help += 'For issues or feedback, feel free to report here https://github.com/Haroon96/cod-daily-stats/issues'
    msg.reply(help);
}

async function teamSplit(msg) {
    let perTeam = parseInt(util.tokenize(msg.content)[2]);
    let users = await db.getAllUsers(msg.channel.id);
    users = util.shuffle(users);
    try {
        let reply = [];
        let teamNum = 1;
        for (let i = 0; i < users.length; ++i) {
            if (i % perTeam == 0) {
                reply.push(`\nTeam ${teamNum}`);
                teamNum++;
            }
            reply.push(`> ${util.escapeMarkdown(users[i].username)} (${users[i].platform})`);
        }
        msg.reply(reply.join('\n'));
    } catch (e) { 
        msg.reply(`Failed to split teams! ${e}`);
    }
}