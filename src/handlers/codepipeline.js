const util = require('util');
const AWS = require('aws-sdk');
const github = require('../services/github');
const slack = require('../services/slack');

exports.handles = (event) => {
    try {
        return JSON.parse(event.Records[0].Sns.Message)['detail-type']
            === "CodePipeline Pipeline Execution State Change"
    }
    catch (_) {
        console.log("Not a codepipeline event");
        return false;
    }
};

exports.handle = (event) => {

    const snsPayload = JSON.parse(event.Records[0].Sns.Message);
    console.log('handling SNS payload: ' + JSON.stringify(snsPayload));

    const messageData = {
        event: {
            time: new Date(snsPayload.time).getTime() / 1000,
            pipelineName: snsPayload.detail.pipeline,
            executionId: snsPayload.detail['execution-id'],
            state: snsPayload.detail.state,
        }
    };

    // propagate 'messageData' through API calls which hydrate useful info, then send
    return populateExecutionInfo(messageData)
        .then(populateRunHistory)
        .then(populateGitHubInfo)
        .then(sendToSlack)
        .catch(err => {
            console.log("Failure to process message data: " + err);
        })

};

populateExecutionInfo = (messageData) => {

    const req = {
        'pipelineName': messageData.event.pipelineName,
        'pipelineExecutionId': messageData.event.executionId
    };
    console.log('== loading execution info for - ' + JSON.stringify(req));

    return new AWS.CodePipeline().getPipelineExecution(req)
        .promise()
        .then(executionInfo => {
            messageData.executionInfo = executionInfo;
            return messageData;

        });
};

populateRunHistory = (messageData) => {

    const req = {'pipelineName': messageData.event.pipelineName, maxResults: 5};
    console.log('== loading run history for - ' + JSON.stringify(req));

    return new AWS.CodePipeline().listPipelineExecutions(req).promise()
        .then(runHistory => {
            messageData.runHistory = runHistory.pipelineExecutionSummaries;
            return messageData;

        });
};

populateGitHubInfo = (messageData) => {

    if (!messageData.executionInfo.pipelineExecution.artifactRevisions ||
        messageData.executionInfo.pipelineExecution.artifactRevisions.length < 1) {
        console.log("No commit information available, skipping.");
        return Promise.resolve(messageData);
    }

    const revisionURL = messageData.executionInfo.pipelineExecution.artifactRevisions[0].revisionUrl;
    console.log('== loading commit info for - ' + revisionURL);
    return github.fetchCommitInfo(revisionURL)
        .then(commitInfo => {
            messageData.github = commitInfo;
            return messageData;
        })
        .catch(err => {
            // don't actually fail, just leave the commit info unpopulated in messageData
            console.log('Failed to fetch commit info from github, commit info will be unavailable. Error: ' + err);
            return messageData;
        });

};

sendToSlack = (messageData) => {

    const slackMsg = populateTemplate(messageData);

    slack.sendToSlack(slackMsg);

    return Promise.resolve([messageData, slackMsg]);


};

getColor = (state) => {
    const colors = new Map();
    colors.set('STARTED', 'warning');
    colors.set('SUCCEEDED', 'good');
    colors.set('SUPERSEDED', 'warning');
    colors.set('FAILED', 'danger');
    return colors.has(state) ? colors.get(state) : '#AAAAAA';
};

populateTemplate = (messageData) => {

    const text = util.format('*<https://console.aws.amazon.com/codepipeline/home?region=us-east-1#/view/%s|%s>*: *%s*',
        messageData.event.pipelineName, messageData.event.pipelineName, messageData.event.state);

    const revision = messageData.executionInfo.pipelineExecution.artifactRevisions[0];

    const author = messageData.github ? messageData.github.data.commit.author.email : 'n/a';

    return slackMsg = {
        text: text,
        attachments: [{
            color: getColor(messageData.event.state),
            ts: messageData.event.time,
            fields: [
                {
                    'value': util.format('*Msg:* \"_%s_\"', revision.revisionSummary),
                    'short': false
                },{
                    'value': util.format('*Commit*: <%s|%s>', revision.revisionUrl, revision.revisionId.substring(0, 8)),
                    'short': true
                },{
                    'value': util.format('*Author:* _%s_', author),
                    'short': true
                }
            ]
        }]
    };

};

