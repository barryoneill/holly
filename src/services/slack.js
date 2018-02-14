const https = require('https');
const util = require('util');
const config = require('../config');

const slackConfig = config.loadSlackConfig();

exports.sendToSlack = (slackMessage, isImportant) => {

    sendToSlackChannel(slackMessage, slackConfig.channel);

    if(isImportant) {
        if(!slackConfig.channelImportant){
            console.log('No important channel configured, will not send additional message');
        }
        else {
            sendToSlackChannel(slackMessage, slackConfig.channelImportant);
        }
    }
};

sendToSlackChannel = (slackMessage, channelName) => {

    slackMessage.channel = channelName;
    slackMessage.username = slackConfig.username;
    slackMessage.icon_emoji = slackConfig.icon_emoji;

    console.log(' = Sending slack message: ' + JSON.stringify(slackMessage, null, 2));

    const options = {
        method: 'POST',
        hostname: 'hooks.slack.com',
        port: 443,
        path: slackConfig.webhookURI
    };

    const req = https.request(options, function (res) {
        res.setEncoding('utf8');
    });

    req.on('error', function (e) {
        console.log('Failed to send slack message: ' + e.message);
    });

    req.write(util.format("%j", slackMessage));
    req.end();

};

