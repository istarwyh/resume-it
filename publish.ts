const { log } = require('console-log-colors');
const simpleGit = require('simple-git');

const path = 'dist';
const repo = 'https://github.com/istarwyh/resume-it.git';

log.green(`Start publishing to your git repo: ${repo}\nPlease wait...`);

try {
    const git = simpleGit(path).init().addRemote('origin', repo);

    git.add('./*')
        .commit('automatically publish')
        .checkoutLocalBranch('gh-pages', () => {
            console.log('Checked out to branch gh-pages');
        })
        .push(['-f', 'origin', 'gh-pages'])
        .checkout('master', () => {
            log.green('Finished publishing, back to branch master.');
        })
        .catch((error) => {
            log.red(error);
        });
} catch (error) {
    log.red(error);
}