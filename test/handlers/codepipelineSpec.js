const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const expect = chai.expect;

const codepipeline = rewire('../../src/handlers/codepipeline');

describe('codepipeline handler', function () {

    describe('generateSummary', function () {

        const testGenerate = (history, expected) => {
            const messageData = {
                runHistory: history
            };
            const resp = codepipeline.__get__('generateSummary')(messageData);
            return expect(resp).to.eventually.have.deep.property('summary', expected);
        };

        it('should detect no change if first execution', function () {
            return testGenerate(
                [
                    {status: 'Succeeded'}
                ],
                {
                    statusChanged: false,
                    curStatus: 'Succeeded'
                });
        });

        it('should detect no change if 2nd status matches', function () {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'Succeeded'},
                ],
                {
                    statusChanged: false,
                    curStatus: 'Succeeded',
                    prevStatus: 'Succeeded'
                });
        });

        it('should detect no change if non-fail/success intermediary present', function () {
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
                    prevStatus: 'Succeeded'
                });
        });

        it('should detect change if next execution changed', function () {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'Failed'}
                ],
                {
                    statusChanged: true,
                    curStatus: 'Succeeded',
                    prevStatus: 'Failed'
                });
        });

        it('should detect change if non-fail/success intermediary present', function () {
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
                    prevStatus: 'Succeeded'
                });
        });

        it('should detect no change even if previous to previous had changed', function () {
            return testGenerate(
                [
                    {status: 'Succeeded'},
                    {status: 'Failed'},
                    {status: 'Succeeded'},
                ],
                {
                    statusChanged: true,
                    curStatus: 'Succeeded',
                    prevStatus: 'Failed'
                });
        });


    });


});
