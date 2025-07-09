const mongoose = require("mongoose");

const volunter_respSchema = new mongoose.Schema({
  username:String,
  q5_rapport: String,
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("volunteer_resp", volunter_respSchema);