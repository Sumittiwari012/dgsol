const mongoose = require('mongoose');

const availableSchema = new mongoose.Schema({
  username: String,
  available: {type:Boolean,default:false},
  engaged_status: {type:Boolean,default:false}
});

module.exports = mongoose.model('Available', availableSchema);