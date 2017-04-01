const { writeFileSync, closeSync, openSync } = require('fs');
const { get } = require('request');
const { load } = require('cheerio');
const { prompt } = require('inquirer');
const { info } = require('better-console');

const { clearConsole, traverseNode, unicodeToChar, createFiles } = require('./util.js');

const ALGORITHM_URL = `https://leetcode.com/api/problems/algorithms/`;
const QUESTION_URL = slug => `https://leetcode.com/problems/${slug}/`;
const FETCH_JS_RE = /{\'value\': \'javascript\'[\w\W\s]+?\},/;
const FETCH_CODE_RE = /\/\*\*[\w\W\s]+?\};/;

const difficultyMap = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

const questionTitle = question => {
  let { difficulty, paid_only, stat } = question;
  let { question_id, question__title, total_acs, total_submitted } = stat;
  let { level } = question.difficulty;
  return `${question_id}\t${difficultyMap[level]}\t${(total_acs / total_submitted).toString().slice(0, 4)}%\t${question__title}`;
};

const questionOption = question => {
  let { paid_only } = question;
  return paid_only ? { name: questionTitle(question), disabled: 'Paid only'} : questionTitle(question);
};

const mapTitleToQuestion = questions => questions.reduce((pre, curr) => {
  pre[questionTitle(curr)] = curr;
  return pre;
}, {});

const getQuestions = url => new Promise((resolve, reject) => {
  get(url).on('response', res => {
    res.setEncoding('utf8');
    let chunk = '';
    res.on('data', data => chunk += data);
    res.on('error', err => reject(err));
    res.on('end', () => resolve(JSON.parse(chunk).stat_status_pairs));
  });
});

const showQuestionSelection = questions => {
  titleQuestionMap = mapTitleToQuestion(questions);
  return prompt({
    type    : 'list',
    name    : 'title',
    message : 'Which problem do you want to solve?',
    choices : questions.map(questionOption)
  });
};

const getQuestionContent = title => new Promise((resolve, reject) => {
  let question = titleQuestionMap[title];
  let { question__article__slug, question__title_slug } = question.stat;
  let selectedQuestionSlug = question__article__slug || question__title_slug;
  get(QUESTION_URL(selectedQuestionSlug)).on('response', res => {
    let chunk = '';
    res.on('data', data => chunk += data);
    res.on('error', err => reject(err));
    res.on('end', () => {
      const $ = load(chunk);
      resolve({
        slug        : selectedQuestionSlug,
        code        : unicodeToChar($('.container[ng-app=app]')[0].attribs['ng-init']).match(FETCH_JS_RE)[0].match(FETCH_CODE_RE)[0],
        description : $('meta[name=description]')[0].attribs['content'],
      });
    });
  });
});

const actionToQuestion = question => {
  let { slug, code, description } = question;
  info(description);
  prompt({
    type    : 'list',
    name    : 'action',
    message : 'Do you want to solve the problem?',
    choices : ['solve', 'back']
  }).then(answer => {
    switch (answer.action) {
      case 'back':
        SelectAndSolve();
        return;

      case 'solve':
        createFiles(slug, code);
        return;

      default:
        return;
    }
  });
};

const SelectAndSolve = () => {
  clearConsole();
  getQuestions(ALGORITHM_URL).then(
    questions => showQuestionSelection(questions),
    err => Promise.reject(err)
  ).then(
    answer => getQuestionContent(answer.title),
    err => Promise.reject(err)
  ).then(
    question => actionToQuestion(question)
  );
};

SelectAndSolve();