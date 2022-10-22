const git = require('simple-git')
const colors = require('colors')
const path = 'dist'
const repo = 'https://github.com/istarwyh/resume-it.git'

console.log(`Start public to your git repo:[${repo}]\nPlease wait ...`.green)
git(path)
  .init()
  .add('./*')
  .commit("automatically publish")
  .addRemote('origin', repo)
  .push(['origin', 'master'], () => {
    console.log("Push to master success");
  })
  .checkoutLocalBranch('gh-pages', () => {
    console.log('Checkout to branch gh-pages');
  })
  .push(['-f', 'origin', 'gh-pages'])
  .checkout('master', () => {
    console.log('Finish public, back to branch master.');
  })
