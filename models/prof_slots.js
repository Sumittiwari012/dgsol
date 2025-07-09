const mongoose = require('mongoose');

const prof_slot = new mongoose.Schema({
  date: String,
  prof_username: String,
  time:String,
  slotval:{
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Prof_slot', prof_slot);