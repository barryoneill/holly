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
        .then(generateSummary)
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
        .then(data => {
            messageData.executionInfo = data.pipelineExecution;
            return messageData;
        });
};

populateRunHistory = (messageData) => {

    const req = {'pipelineName': messageData.event.pipelineName};
    console.log('== loading run history for - ' + JSON.stringify(req));

    return new AWS.CodePipeline().listPipelineExecutions(req).promise()
        .then(data => {

            try {
                const runHistory = data.pipelineExecutionSummaries;

                /* we have no way to tell listPipelineExecutions to start only from this execution, and we're
                 * only interested in the history of executions _since_ this one, so we'll drop any others
                 * that may have been triggered in the meantime */
                const currentExecution = messageData.executionInfo.pipelineExecutionId;
                const idx = runHistory.findIndex(e => e.pipelineExecutionId === currentExecution);

                messageData.runHistory = runHistory.slice(idx, runHistory.length);

            }
            catch(err) {
                console.log('couldn\'t determine severity of message, skipping. Error: ' + err);
            }

            return messageData;
        });
};

generateSummary = (messageData) => {

    const history = messageData.runHistory;

    if(!history || history.length < 1) {
        console.log('No run history loaded for: ' + JSON.stringify(messageData.event));
        return Promise.resolve(messageData);
    }

    const summary = {
        statusChanged: false,
        curStatus: history[0].status
    };

    if(history.length > 1) {

        /* filter out the non-interesting statuses ('InProgress', 'Superseded'), we're interested
         * in detecting an execution that changes from success->failed or vice versa. */
        const prevExecution = history.slice(1, history.length)
            .find(e => isImportantStatus(e.status));

        if(prevExecution){
            summary.prevStatus = prevExecution.status;
            summary.statusChanged = summary.curStatus !== summary.prevStatus;
        }
    }

    messageData.summary = summary;

    return Promise.resolve(messageData);
};

populateGitHubInfo = (messageData) => {

    if (!messageData.executionInfo.artifactRevisions ||
        messageData.executionInfo.artifactRevisions.length < 1) {
        console.log("No commit information available, skipping.");
        return Promise.resolve(messageData);
    }

    const revisionURL = messageData.executionInfo.artifactRevisions[0].revisionUrl;
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

    let important = false;
    let headingMessage = util.format('Still: *%s*', messageData.executionInfo.status);

    if(messageData.summary && messageData.summary.statusChanged){
        important = isImportantStatus(messageData.summary.curStatus);
        headingMessage = util.format('Status changed to *%s*', messageData.summary.curStatus)
    }

    const heading = util.format('*<https://console.aws.amazon.com/codepipeline/home?region=us-east-1#/view/%s|%s>*: %s',
        messageData.event.pipelineName, messageData.event.pipelineName, headingMessage);

    const revision = messageData.executionInfo.artifactRevisions[0];

    const slackMsg = {
        text: heading,
        attachments: [{
            color: getColor(messageData.executionInfo.status),
            ts: messageData.event.time,
            fields: []
        }]
    };

    if(revision) {
        slackMsg.attachments[0].fields.push({
            'value': util.format('*Msg:* \"_%s_\"', revision.revisionSummary),
            'short': false
        });
        slackMsg.attachments[0].fields.push({
            'value': util.format('*Commit*: <%s|%s>', revision.revisionUrl, revision.revisionId.substring(0, 8)),
            'short': true
        });
    }

    const author = messageData.github ? messageData.github.data.commit.author.email : 'n/a';
    if(messageData.github){
        slackMsg.attachments[0].fields.push({
            'value': util.format('*Author:* _%s_', author),
            'short': true
        });
    }

    // enable markdown in all attachment fields
    slackMsg.attachments[0].mrkdwn_in = Object.keys(slackMsg.attachments[0]);

    slack.sendToSlack(slackMsg, important);

    return Promise.resolve([messageData, slackMsg]);


};

getColor = (state) => {
    const colors = new Map([
            ['InProgress', 'warning'],
            ['Succeeded', 'good'],
            ['Superseded', 'warning'],
            ['Failed', 'danger'],
        ]);
    return colors.has(state) ? colors.get(state) : '#AAAAAA';
};

isImportantStatus = (status) => {
    return status === 'Succeeded' || status === 'Failed';
};