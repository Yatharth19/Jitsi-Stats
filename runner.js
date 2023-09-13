const config = require('./config');
const exportStats = require('./jitsi_prometheus');

const domain = "https://meet-uat.lybl.com/anvil-";
for (let i=0;i<config.numberOfConferences;i++) {
    let url = domain + i;
    console.log(url);
    exportStats(url);
}