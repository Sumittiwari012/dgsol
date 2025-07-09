const mongoose = require('mongoose');

const attendSchema = new mongoose.Schema({
  day: String,
  username: String,
  nps:[Number]
});

module.exports = mongoose.model('Attend_per_session', attendSchema);