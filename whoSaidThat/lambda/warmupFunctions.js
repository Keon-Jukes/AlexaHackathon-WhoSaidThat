const warmupQuestions = require('./documents/warmup.json');

const getRandomWarmupQuestion = function() {
  return  warmupQuestions[Math.floor(Math.random() * warmupQuestions.length)];
};

const checkAnswer = function(correctauthor, authorguess) {
  return String(correctauthor).toLowerCase() === String(authorguess).toLowerCase();
};

const getHour = function(userTimeZone) {
  const currentDateTime = new Date(new Date().toLocaleString("en-US", {timeZone: userTimeZone}));
  return currentDateTime.getHours();
};

module.exports = {
  getRandomWarmupQuestion,
  checkAnswer,
  getHour
};