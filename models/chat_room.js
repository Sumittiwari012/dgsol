const mongoose = require('mongoose');

const chat_roomSchema = new mongoose.Schema({
  booking_id:String,
  start_date_time_client: {type: Date, Default: null},
  start_date_time_volunteer: {type: Date, Default: null},
  endtime: String,
  uid: String,
  vid: String,
  duration: Number,
  payment_status:{type: Boolean,Default: true}
});

module.exports = mongoose.model('Chat_Room', chat_roomSchema);