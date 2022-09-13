const presidentialQuotes = require('./documents/presidential.json');

const getRandomPresidentialQuestion = function(pastPresidentialQuotes = []) {
  const filtered = presidentialQuotes.filter(c => !pastPresidentialQuotes.find(pc => pc.id === c.id));
  return filtered.length > 0
     ? filtered[Math.floor(Math.random() * filtered.length)]
    : {"id":0, "correctauthor":null, "quote": null};
};

const checkAnswer = function(correctauthor, authorguess) {
  return String(correctauthor).toLowerCase() === String(authorguess).toLowerCase();
};


module.exports = {
  getRandomPresidentialQuestion,
  checkAnswer
};
