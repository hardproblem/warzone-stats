module.exports = {
    tokenize,
    pprint,
    escapeMarkdown,
    parseDuration,
    isValidCron: require('cron-validator').isValidCron,
    prevCronHit,
    nextCronHit,
    shuffle
};

const { parseExpression } = require('cron-parser');

function tokenize(msg) {
    return msg.toLowerCase().split(/ +/);
}

function pprint(username, stats, duration) {
    let msg = `Stats for **${username}** over the last ${duration.value} ${duration.unit}(s)\n`;
    for (let stat in stats) {
        msg += `> ${stat}: ${stats[stat]}\n`;
    }
    return msg;
}

function escapeMarkdown(text) {
    return text.replace(/([_*])/, '\\$1');
}

function parseDuration(d) {
    if (!d) {
        return {value: 1, unit: 'day'};
    }
    let rx = /([0-9]+)([h|d|w|mo])/;
    let match = d.match(rx);
    return {
        value: match[1],
        unit: function(x) {
            switch(x) {
                case 'h': return 'hour';
                case 'd': return 'day';
                case 'w': return 'week';
                case 'm': return 'month';
            }
        }(match[2])
    }
}

function prevCronHit(exp) {
    let cp = parseExpression(exp);
    // need to go two steps back to avoid race conditions
    cp.prev();
    return cp.prev()._date;
}

function nextCronHit(exp) {
    return parseExpression(exp).next()._date;
}

function shuffle(arr) {
    return arr.map(x => ({ key: Math.random(), val: x }))
        .sort((a, b) => a.key - b.key)
        .map(x => x.val);
}
