module.exports = function (app) {
  var nlp = require("../controllers/nlp.server.controller");

  app.route("/").get(nlp.renderURLForm);

  app
    .route("/processNLP")
    .get(nlp.scrapeURL, nlp.processText, nlp.renderResult);

  app.route("/api/run").post(nlp.run, nlp.processText, nlp.renderResultJson); // Modified this route to POST

};
