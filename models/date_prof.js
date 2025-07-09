const mongoose = require('mongoose');

const date_profSchema = new mongoose.Schema({
  username: String,      
  sun: [String],  
  mon: [String],           
  tue: [String],
  wed: [String],     
  thur: [String],           
  fri: [String],     
  sat: [String]
});

module.exports = mongoose.model('Date_Prof', date_profSchema);