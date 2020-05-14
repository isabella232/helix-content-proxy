/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

const assert = require('assert');
const index = require('../src/index.js').main;
const { setupPolly } = require('./utils.js');

describe('GitHub Integration Tests', () => {
  setupPolly({
    recordIfMissing: false,
  });

  before(() => {
    process.env.FORCE_HTTP1 = 'true';
  });

  after(() => {
    delete process.env.FORCE_HTTP1;
  });

  it('Retrieves Markdown from GitHub', async () => {
    const result = await index({
      owner: 'adobe',
      repo: 'helix-pipeline',
      ref: '9526b3b315a8b8a5e48c8e70fff362bf43426020',
      path: 'docs/markdown.md',
      __ow_headers: {
        'x-request-id': 'fake'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Markdown Features in Project Helix'), 0);
  });

  it('Retrieves Markdown from GitHub with Token from Headers', async function staticToken() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/fstab.yaml')
      .intercept((_, res) => res.sendStatus(404));


    let foundtoken, foundid;
    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/README.md')
      .intercept((req, res) => {
        console.log(req.headers);
        foundtoken = req.headers.authorization;
        foundid = req.headers['x-request-id']
        res.status(200).send('# Read me')
      });

    const result = await index({
      owner: 'adobe',
      repo: 'project-helix',
      ref: 'master',
      path: 'README.md',
      __ow_headers: {
        'x-request-id': 'fake',
        'x-github-token': 'undisclosed-token'
      }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Read me'), 0);
    assert.equal(foundtoken, 'token undisclosed-token');
    assert.equal(foundid, 'fake');
  });

  it('Retrieves Markdown from GitHub with Token from Config', async function staticToken() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/fstab.yaml')
      .intercept((_, res) => res.sendStatus(404));


    let foundtoken, foundid;
    server
      .get('https://raw.githubusercontent.com/adobe/project-helix/master/README.md')
      .intercept((req, res) => {
        console.log(req.headers);
        foundtoken = req.headers.authorization;
        foundid = req.headers['x-request-id']
        res.status(200).send('# Read me')
      });

    const result = await index({
      owner: 'adobe',
      repo: 'project-helix',
      ref: 'master',
      path: 'README.md',
      __ow_headers: {
        'x-request-id': 'fake',
      },
      GITHUB_TOKEN: 'fake-token'
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Read me'), 0);
    assert.equal(foundtoken, 'token fake-token');
    assert.equal(foundid, 'fake');
  });

  it('Retrieves Markdown from GitHub with low cache', async () => {
    const result = await index({
      owner: 'adobe',
      repo: 'helix-pipeline',
      ref: 'master',
      path: 'docs/markdown.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('# Markdown Features in Project Helix'), 0);
    assert.equal(result.headers['cache-control'], 'max-age=60');
    assert.equal(result.headers['surrogate-control'], 'max-age=60');
  });

  it('Retrieves Markdown from GitHub when FSTab.yaml is present', async () => {
    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: '04f19cd404780382c5a53d0cf64fbe4b0b827eff',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.indexOf('---'), 0);
    assert.equal(result.headers['x-source-location'], 'https://raw.githubusercontent.com/adobe/theblog/04f19cd404780382c5a53d0cf64fbe4b0b827eff/index.md');
    assert.equal(result.headers['cache-control'], 'max-age=30758400');
    assert.equal(result.headers['surrogate-control'], 'max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable');
  });

  it('Fails to retrieve Markdown from GitHub is malfunctioning', async function badGitHub() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/fstab.yaml')
      .intercept((_, res) => res.sendStatus(500));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a2',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 502);
  });

  it('Fails to retrieve Markdown from GitHub is down', async function badGitHub() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/fstab.yaml')
      .intercept((_, res) => res.sendStatus(503));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a2',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 503);
  });

  it('Fails to retrieve Markdown from GitHub is partially down', async function badGitHub() {
    const { server } = this.polly;

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/fstab.yaml')
      .intercept((_, res) => res.sendStatus(404));

    server
      .get('https://raw.githubusercontent.com/adobe/theblog/cb8a0dc5d9d89b800835166783e4130451d3c6a2/index.md')
      .intercept((_, res) => res.sendStatus(503));

    const result = await index({
      owner: 'adobe',
      repo: 'theblog',
      ref: 'cb8a0dc5d9d89b800835166783e4130451d3c6a2',
      path: '/index.md',
    });

    assert.equal(result.statusCode, 503);
  });
});
