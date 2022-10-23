const { color, log } = require('console-log-colors');
const simpleGit = require('simple-git')
const path = 'dist'
const repo = 'https://github.com/istarwyh/resume-it.git'

log.green(`Start public to your git repo:[${repo}]\nPlease wait ...`)

const git = simpleGit(path).init().addRemote('origin', repo);

git.add('./*')
.commit("automatically publish")
.checkoutLocalBranch('gh-pages', () => {
  console.log('Checkout to branch gh-pages');
})
.push(['-f', 'origin', 'gh-pages'])
.checkout('master', () => {
  console.log('Finish public, back to branch master.');
})
