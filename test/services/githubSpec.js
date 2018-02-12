const { expect } = require('chai');
const github = require('../../src/services/github');

describe('github service', function () {


    it('should part revison URL', function () {

        const URI = 'https://github.com/my-repo/my-project/commit/a1b2c3d4e5f6';

        console.log(github.parseRevisionURI(URI));

        expect(github.parseRevisionURI(URI)).to.deep.equal({
            owner: 'my-repo',
            repo: 'my-project',
            sha: 'a1b2c3d4e5f6'
        });

    });

});
