
exports.loadSlackConfig = () => {

    return {
        webhookURI: findRequired('SLACK_WEBHOOK_URI'),
        channel: findRequired('SLACK_CHANNEL'),
        channelImportant: find('SLACK_CHANNEL_IMPORTANT'),
        username: findRequired('SLACK_USERNAME'),
        icon_emoji: findRequired('SLACK_EMOJI')
    }
};

exports.loadGitSSMKey = () => {
    return findRequired('GIT_SSM_KEY')
};


find = (fieldName) => {
    return process.env[fieldName];
};

findRequired = (fieldName) => {
    const val = process.env[fieldName];
    if(!val) {
        throw 'Couldn\'t find required env var \'' + fieldName + '\'';
    }
    return val;
};