const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  name: String,
  username: String,
  edu: String,    
  gender:String,           
  lang: [String],       
  mode: String,           
  price: Number,                
  pno: Number,
  email: String,
  password: String,
  approve:Boolean
});

module.exports = mongoose.model('Volunteer', volunteerSchema);