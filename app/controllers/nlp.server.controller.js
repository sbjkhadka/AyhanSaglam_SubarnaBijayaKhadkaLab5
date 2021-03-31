const axios = require("axios");
const cheerio = require("cheerio");
const compromise = require("compromise");
const natural = require("natural");
const _ = require("lodash");

exports.renderURLForm = (req, res) => {
  res.render("urlForm");
};

exports.run = async (req, res, next) => {
  console.log('body', req.body);
  // const url =
  //   "https://www.recode.net/ad/18027288/ai-sustainability-environment";
  // const numSentence = 3;
  const url = req.body.summarizeURL; // Now this is taking URL from frontend request
  const numSentence = req.body.numSentences; // Now this is taking numSentences from frontend request
  const sentences = [];
  req.query.numSentence = numSentence;

  try {
    // Get the full HTML content from URL
    var htmlContent = await axios.get(url);

    // Load the HTML into the Cheerio parser
    var result = cheerio.load(htmlContent.data);

    // Get sentences of every paragraph into the array
    // Naive way to scraping text content - doesn't support React/Angular apps that maintain their
    // data inside JSON objects
    result("p").each((index, element) => {
      // For each paragraph element, splice the content into sentences and store each into the array
      compromise(result(element).text())
        .sentences()
        .out("array")
        .forEach((sentence) => {
          sentences.push(sentence);
        });
    });
    req.sentences = sentences;
    next();
  } catch (error) {
    //add error processing
  }
};
exports.scrapeURL = async (req, res, next) => {
  const sentences = [];

  try {
    // Get the full HTML content from URL
    var htmlContent = await axios.get(req.query.summarizeURL);

    // Load the HTML into the Cheerio parser
    var result = cheerio.load(htmlContent.data);

    // Get sentences of every paragraph into the array
    // Naive way to scraping text content - doesn't support React/Angular apps that maintain their
    // data inside JSON objects
    result("p").each((index, element) => {
      // For each paragraph element, splice the content into sentences and store each into the array
      compromise(result(element).text())
        .sentences()
        .out("array")
        .forEach((sentence) => {
          sentences.push(sentence);
        });
    });
    req.sentences = sentences;
    next();
  } catch (error) {
    res.render("urlForm", {
      error: "Unable to access website URL - Try a different website.",
    });
  }
};

exports.processText = (req, res, next) => {
  req.payload = summarizeSentences(req.sentences, req.query.numSentence);
  next();
};

exports.renderResult = (req, res) => {
  res.render("results", { payload: req.payload });
};

exports.renderResultJson = (req, res) => {
  return res.json(req.payload);
};

// Splits sentences and then stems (transforms to basic word) each token
const stemAndTokenize = (text) => {
  let tokens = new natural.WordTokenizer().tokenize(text);
  return tokens.map((token) => natural.PorterStemmer.stem(token));
};

const summarizeSentences = (sentences, numOfSentences) => {
  const db = new natural.TfIdf();
  const scoresMap = {};

  // Each sentence is its own document, made up of tokenized words that are stemmed
  sentences.forEach((sentence) => {
    db.addDocument(stemAndTokenize(sentence));
  });

  // Generate points based on points of each token and occurence in each sentence
  sentences.forEach((sentence) => {
    stemAndTokenize(sentence).forEach((token) => {
      db.tfidfs(token, (id, measure) => {
        if (!scoresMap[id]) {
          scoresMap[id] = { id, score: 0 };
        }
        scoresMap[id].score += measure;
      });
    });
  });

  // Converts the object/map to an array for easier traversing
  let scoresArray = _.values(scoresMap);

  // Sort sentences by highest scores descending
  scoresArray.sort((a, b) => (a.score < b.score ? 1 : -1));

  // Take only the top 'numOfSentences' sentences
  scoresArray = scoresArray.slice(0, numOfSentences);

  // Sort the sentences by their id incrementing (order of when sentences appeared on website)
  scoresArray.sort((a, b) => (a.id < b.id ? -1 : 1));

  return scoresArray.map((item) => sentences[item.id]);
};
