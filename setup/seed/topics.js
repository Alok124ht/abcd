const mongoose = require("mongoose");
const config = require("../../config/config");
const Topic = require("../../server/topic/topic.model");
const mongoUri = config.mongo.host;

mongoose.connect(
  mongoUri,
  { server: { socketOptions: { keepAlive: 1 } } }
);
const db = new Topic();
db.topics = [{ name: "Dummy topic #1" }];
db.leaderboard = [];
