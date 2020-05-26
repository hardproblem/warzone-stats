new Vue({
    el: '#leaderboard',
    data: {
        channelId: null,
        initialized: false,
        timestamps: [],
        selectedTimestamp: null,
        stats: {},
        sortBy: 'K/D',
        desc: true,
        filter: ''
    },
    methods: {
        init: async function() {
            try {
                this.initChannelId();
                await this.getTimestamps();
                await this.fetchStats(this.selectedTimestamp);   
            } catch (e) {
                console.log(e);
            }
            this.initialized = true;
        },
        initChannelId: function() {
            let rx = /leaderboard\/([0-9]+)/;
            let match = location.href.match(rx);
            if (match && match[1]) {
                this.channelId = match[1];
            } else {
                throw 'Bad channel ID';
            }
        },
        fetchStats: async function(timestamp) {
            if (!timestamp) {
                // return;
            }
            let res = await fetch(`/api/getStats?channelId=${this.channelId}&timestamp=${timestamp}`);
            if (res.ok) {
                Vue.set(this.stats, timestamp, await res.json());
                Vue.set(this.stats, timestamp, getRawData());                
            }
        },
        getTimestamps: async function() {
            let res = await fetch(`/api/getSnapshotTimes?channelId=${this.channelId}`);
            if (res.ok) {
                this.timestamps = await res.json();
                if (this.timestamps.length > 0) {
                    this.selectedTimestamp = this.timestamps[0];
                }
            }
        },
        getIcon: function(plt) {
            switch (plt) {
                case 'psn': return '<svg viewBox="5 117.952 990 764.096" class="icon" data-v-7a37f106=""><path d="M986.195 702.762c-19.338 24.398-66.718 41.803-66.718 41.803l-352.455 126.6V777.8l259.383-92.42c29.436-10.546 33.955-25.455 10.029-33.28-23.881-7.848-67.122-5.6-96.58 4.992l-172.832 60.871v-96.895l9.962-3.373s49.942-17.675 120.168-25.455c70.226-7.735 156.215 1.057 223.72 26.646 76.072 24.039 84.64 59.478 65.323 83.876zM600.572 543.781V305.019c0-28.041-5.172-53.855-31.481-61.164-20.147-6.454-32.65 12.255-32.65 40.273v597.919l-161.251-51.18V117.952c68.562 12.728 168.447 42.814 222.145 60.917 136.562 46.884 182.861 105.237 182.861 236.716-.001 128.151-79.108 176.723-179.624 128.196zM79.31 768.041c-78.096-21.992-91.093-67.82-55.497-94.22 32.898-24.375 88.845-42.725 88.845-42.725l231.208-82.211v93.725l-166.378 59.544c-29.39 10.547-33.91 25.478-10.029 33.303 23.903 7.826 67.167 5.6 96.603-4.969l79.805-28.963v83.853c-5.06.899-10.703 1.799-15.921 2.676-79.829 13.042-164.851 7.6-248.636-20.013z" data-v-7a37f106=""></path></svg>';
                case 'atvi': return '<svg viewBox="0 0 24 24" class="icon" data-v-7a37f106="" xmlns="http://www.w3.org/2000/svg"><path d="M2.8 15.3v3.5S6.4 22 12 22s9.2-3.2 9.2-3.2v-3.5s-5.2-3.1-9.2-6c-4 2.9-9.2 6-9.2 6zM18.2 17c-2.9 1.5-6.2 1.4-6.2 1.4s-3.3.1-6.2-1.4c1.9-1.1 4.3-2.7 6.2-4.1 2 1.4 4.4 3 6.2 4.1z" data-v-7a37f106=""></path><path data-v-7a37f106="" d="M12 2C8 4.9 2.8 8 2.8 8v3.5S8.2 8.3 12 5.6c3.8 2.7 9.2 5.9 9.2 5.9V8S16 4.9 12 2z"></path></svg>';
            } 
        },
        sort: function(f) {
            let board = this.stats[this.selectedTimestamp];
            if (this.sortBy == f) {
                this.desc = !this.desc;
                Vue.set(this.stats, this.selectedTimestamp, board.reverse()); 
            } else {
                Vue.set(this.stats, this.selectedTimestamp, _.sortBy(board, `stats.${f}`).reverse()); 
                this.sortBy = f;
                this.desc = true;
            }
        }
    },
    computed: {
        filteredStats: function() {
            let board = this.stats[this.selectedTimestamp];
            if (!board) { 
                return [];
            }
            let pos = 1;
            for (let i = 0; i < board.length; ++i) {
                if (i > 0 && board[i].stats[this.sortBy] != board[i - 1].stats[this.sortBy]) {
                    pos++;
                }
                board[i].position = pos;
            }
            if (this.filter) {
                board = _.filter(board, x => JSON.stringify(x).includes(this.filter));
            }
            return board;
        }
    },
    created: function() {
        this.init();
    }
});

Vue.filter('timePlayedLimit', function(v) {
    return moment.duration(v, 'seconds')
        .format("w[w] d[d] h[h] m[m] s[s]", {trim: "both mid"})
        .split(/ +/g).slice(0, 2).join(' ');
});

Vue.filter('time', function(v) {
    return moment(v).format('hh:mma DD MMM, YYYY')
});


function getRawData() {
    return [{
        "username": "m_haroon2305",
        "platform": "psn",
        "stats": {
            "Matches": 0,
            "Kills": 0,
            "Deaths": 0,
            "Score": 0,
            "Time Played": 10000,
            "Headshots": 0,
            "Assists": 0,
            "Executions": 0,
            "Vehicles Destroyed": 0,
            "Team Wipes": 0,
            "Total XP": 0,
            "K/D": "NaN"
        }
    }, {
        "username": "saadmujeeb_24",
        "platform": "psn",
        "stats": {
            "Matches": 5,
            "Kills": 5,
            "Deaths": 8,
            "Score": 10750,
            "Time Played": 20000,
            "Headshots": 2,
            "Assists": 0,
            "Executions": 0,
            "Vehicles Destroyed": 0,
            "Team Wipes": 2,
            "Total XP": 48964,
            "K/D": "0.63"
        }
    }, {
        "username": "botmun_",
        "platform": "psn",
        "stats": {
            "Matches": 2,
            "Kills": 2,
            "Deaths": 3,
            "Score": 14225,
            "Time Played": 30000,
            "Headshots": 0,
            "Assists": 0,
            "Executions": 0,
            "Vehicles Destroyed": 0,
            "Team Wipes": 1,
            "Total XP": 43186,
            "K/D": "0.67"
        }
    }, {
        "username": "bouncybear#2283071",
        "platform": "atvi",
        "stats": {
            "Matches": 5,
            "Kills": 9,
            "Deaths": 6,
            "Score": 10675,
            "Time Played": 400000,
            "Headshots": 1,
            "Assists": 0,
            "Executions": 0,
            "Vehicles Destroyed": 0,
            "Team Wipes": 2,
            "Total XP": 49506,
            "K/D": "1.50"
        }
    }, {
        "username": "mango_man7",
        "platform": "psn",
        "stats": {
            "Matches": 2,
            "Kills": 6,
            "Deaths": 4,
            "Score": 10525,
            "Time Played": 124151,
            "Headshots": 1,
            "Assists": 0,
            "Executions": 0,
            "Vehicles Destroyed": 0,
            "Team Wipes": 1,
            "Total XP": 39830,
            "K/D": "1.50"
        }
    }, {
        "username": "moyx",
        "platform": "atvi",
        "stats": {
            "Matches": 16,
            "Kills": 79,
            "Deaths": 30,
            "Score": 93500,
            "Time Played": 12351,
            "Headshots": 30,
            "Assists": 0,
            "Executions": 2,
            "Vehicles Destroyed": 1,
            "Team Wipes": 15,
            "Total XP": 249230,
            "K/D": "2.63"
        }
    }];
}