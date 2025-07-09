const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bid: String,
  prof_name: String,
  prof_username: String,
  client_name: String,
  client_username: String,
  mode:String,
  date:Date,
  time:String,
  consult_type:String,
  qno:Number
});

module.exports = mongoose.model('Booking', bookingSchema);