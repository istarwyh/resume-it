const { validate } = require('./lib/public-output.cjs');
const simpleGit = require('simple-git');
(async () => {
    // Fail closed before initializing a deployment repository or making a network request.
    validate();
    const git = simpleGit('dist');
    await git.init();
    await git.addRemote('origin', 'https://github.com/istarwyh/resume-it.git');
    await git.add('.');
    await git.commit('Publish public default resume');
    await git.checkoutLocalBranch('gh-pages');
    await git.push(['-f', 'origin', 'gh-pages']);
    console.log('Published public default resume.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
