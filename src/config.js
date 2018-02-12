
exports.loadSlackConfig = () => {

    return {
        webhookURI: findRequired('SLACK_WEBHOOK_URI'),
        channel: findRequired('SLACK_CHANNEL'),
        username: findRequired('SLACK_USERNAME'),
        icon_emoji: findRequired('SLACK_EMOJI')
    }
};

exports.loadGitSSMKey = () => {
    return findRequired('GIT_SSM_KEY')
};

findRequired = (fieldName) => {
    const val = process.env[fieldName];
    if(!val) {
        throw 'Couldn\'t find required env var \'' + fieldName + '\'';
    }
    return val;
};