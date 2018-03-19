const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const AWS = require('aws-sdk-mock');

chai.use(chaiAsPromised);

const expect = chai.expect;

const codepipeline = rewire('../../src/handlers/codepipeline');

describe('codepipeline handler', () => {

    describe('populateActionFailure', () => {

        const testPipelineName = 'testPipeline';

        const messageData = {
            event: { pipelineName: testPipelineName }
        };

        afterEach(() =>  {
            AWS.restore('CodePipeline', 'getPipelineState');
        });

        it('should call CodePipeline.getPipelineState with the correct params', () => {
            AWS.mock('CodePipeline', 'getPipelineState', function (params, callback){
                expect(params).to.deep.equal({name: testPipelineName});
                callback(null, 'whatever');
            });
            codepipeline.__get__('populateActionFailure')(messageData);
        });


        it('should not populate any additional attributes if pipeline succeeds', () =>  {

            AWS.mock('CodePipeline', 'getPipelineState', function (params, callback){
                callback(null, require('./data/codepipeline_get-pipeline-state-success'));
            });

            const resp = codepipeline.__get__('populateActionFailure')(messageData);

            expect(resp).to.eventually.deep.equal(messageData);
        });

        it('should populate \'stageErrorInfo\' if a stage fails', () =>  {

            AWS.mock('CodePipeline', 'getPipelineState', function (params, callback){
                callback(null, require('./data/codepipeline_get-pipeline-state-fail'));
            });

            const resp = codepipeline.__get__('populateActionFailure')(messageData);
            const expected = {
                stageName: 'Build',
                actionName: 'CodeBuild',
                code: 'JobFailed',
                message: 'Build terminated with state: FAILED',
                entityUrl: 'https://us-east-1.console.aws.amazon.com/codebuild/home?#/projects/holly-failmsg-test/view',
                externalExecutionId: "holly-failmsg-test:69b0f0ff-6a85-4b7d-98dd-9a57aca070d9",
                externalExecutionUrl: "https://us-east-1.console.aws.amazon.com/codebuild/home?#/builds/holly-failmsg-test:69b0f0ff-6a85-4b7d-98dd-9a57aca070d9/view/new"
            };

            expect(resp).to.eventually.have.deep.property('stageErrorInfo', expected);
        });

    });

    describe('generateSummary', () =>  {

        const testGenerate = (history, expected) => {
            const messageData = {
                runHistory: history
            };
            const resp = codepipeline.__get__('generateSummary')(messageData);
            return expect(resp).to.eventually.have.deep.property('summary', expected);
        };

        it('should detect no change if first execution', () =>  {
            return testGenerate(
                [
                    {status: 'Succeeded'}
                ],
                {
                    statusChanged: false,
                    curStatus: 'Succeeded'
                });
        });

        it('should detect no change if 2nd status matches', () =>  {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'Succeeded'},
                ],
                {
                    statusChanged: false,
                    curStatus: 'Succeeded',
                    prevStatus: 'Succeeded',
                    trend: ['☐', '☐']
                });
        });

        it('should detect no change if non-fail/success intermediary present', () =>  {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'InProgress'},
                    {status: 'Superseded'},
                    {status: 'Succeeded'}
                ],
                {
                    statusChanged: false,
                    curStatus: 'Succeeded',
                    prevStatus: 'Succeeded',
                    trend: ['☐', '☐']
                });
        });

        it('should detect change if next execution changed', () =>  {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'Failed'}
                ],
                {
                    statusChanged: true,
                    curStatus: 'Succeeded',
                    prevStatus: 'Failed',
                    trend: ['☐', '☒']
                });
        });

        it('should detect change if non-fail/success intermediary present', () =>  {
            return testGenerate(
                [
                    {status: 'Failed'},
                    {status: 'InProgress'},
                    {status: 'Superseded'},
                    {status: 'Succeeded'}
                ],
                {
                    statusChanged: true,
                    curStatus: 'Failed',
                    prevStatus: 'Succeeded',
                    trend: ['☒', '☐']
                });
        });

        it('should detect no change even if previous to previous had changed', () =>  {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'Failed'},
                    {status: 'Succeeded'},
                ],
                {
                    statusChanged: true,
                    curStatus: 'Succeeded',
                    prevStatus: 'Failed',
                    trend: ['☐', '☒', '☐']
                });
        });


    });


});
