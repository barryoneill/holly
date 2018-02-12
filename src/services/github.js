const AWS = require('aws-sdk');
const octokit = require('@octokit/rest')();
const config = require('../config');

exports.fetchCommitInfo = (revisionURI) => {

    const ssm = new AWS.SSM();

    return ssm.getParameter({
        Name: config.loadGitSSMKey(),
        WithDecryption: true
    })
    .promise()
    .then(gitToken => {

        octokit.authenticate({type: 'token', token: gitToken.Parameter.Value});

        const commitInfo = exports.parseRevisionURI(revisionURI);

        return octokit.repos.getCommit(commitInfo);
    });

};

exports.parseRevisionURI = (revisionURI) => {

    const pattern = /https:\/\/github.com\/(.+?)\/(.+?)\/commit\/([A-Fa-f0-9]+)/;

    const parts = revisionURI.match(pattern);

    if(!parts || parts.length < 4) {
        throw "Failed to parse commit '" + revisionURI + "' against pattern: " + pattern;
    }

    return {
        owner: parts[1],
        repo: parts[2],
        sha: parts[3]
    }
};
