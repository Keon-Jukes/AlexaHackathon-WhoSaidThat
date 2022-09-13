const roundoneQuotes = require('./documents/roundone.json');

const getRandomRoundoneQuestion = function(pastQuotes = []) {
  const filtered = roundoneQuotes.filter(c => !pastQuotes.find(pc => pc.id === c.id));
  return filtered.length > 0
     ? filtered[Math.floor(Math.random() * filtered.length)]
    : {"id":0, "correctauthor":null, "quote": null};
};

const checkAnswer = function(correctauthor, authorguess) {
  return String(correctauthor).toLowerCase() === String(authorguess).toLowerCase();
};

const getHour = function(userTimeZone) {
  const currentDateTime = new Date(new Date().toLocaleString("en-US", {timeZone: userTimeZone}));
  return currentDateTime.getHours();
};

module.exports = {
  getRandomRoundoneQuestion,
  checkAnswer,
  getHour
};
