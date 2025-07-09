const mongoose = require('mongoose');

const v_bookingSchema = new mongoose.Schema({
  booking_id:String,
  cid: String,
  vid: String,     
  duration: Number,                
  price: Number,
  mode: String,
  date: { type: Date, default: Date.now },
  interested:{type : Boolean, default: false},
  confirmation:{type : Boolean, default: false},
  consent:{type : Boolean, default: false},
  completion: {type : Boolean, default: false}
});

module.exports = mongoose.model('V_booking', v_bookingSchema);