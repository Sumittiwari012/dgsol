require('dotenv').config();
const express = require('express');
const router = express.Router();
const booking = require('../models/booking');
const Person = require('../models/personal');
const prof = require('../models/professional');
const dp = require('../models/date_prof');
const aps= require('../models/slots');
const volunteer= require('../models/volunteer');
const v_resp=require('../models/volunteer_resp');
const moment = require('moment'); 
const available = require('../models/available');
const VBooking = require('../models/v_booking'); // Adjust path as needed
const chat_room = require('../models/chat_room');

router.get('/p_dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/login_prof');

  const { username } = req.session.user;
  const professional = await prof.findOne({ username });
  if(professional.type=="volunteer") return res.redirect('/volunteer_dashboard');
  const isProfileComplete = Boolean(
    professional?.name &&
    professional?.edu &&
    typeof professional?.exp === 'number' &&
    Array.isArray(professional?.certification) && professional.certification.length > 0 &&
    Array.isArray(professional?.lang) && professional.lang.length > 0 &&
    Array.isArray(professional?.treat_app) && professional.treat_app.length > 0 &&
    Array.isArray(professional?.mode) && professional.mode.length > 0 &&
    typeof professional?.price === 'number' &&
    professional?.specialization &&
    professional?.pno &&
    professional?.email
  );
  
  const now = moment();

  const bookings = await booking.find({ prof_username: username });
  const day_slot = await aps.find({ username: username });
  //console.log(day_slot);

  const scheduledMeetings = bookings.filter(booking => {
    const startTime = booking.time.split('-')[0].trim(); // e.g., "05:00"
    const dateTime = moment(`${moment(booking.date).format('YYYY-MM-DD')} ${startTime}`, 'YYYY-MM-DD HH:mm');
    return dateTime.isSameOrAfter(now);
  }).sort((a, b) => {
    const aStart = a.time.split('-')[0].trim();
    const bStart = b.time.split('-')[0].trim();
    const aDateTime = moment(`${moment(a.date).format('YYYY-MM-DD')} ${aStart}`, 'YYYY-MM-DD HH:mm');
    const bDateTime = moment(`${moment(b.date).format('YYYY-MM-DD')} ${bStart}`, 'YYYY-MM-DD HH:mm');

    const diff = aDateTime.diff(bDateTime);
    if (diff !== 0) return diff;
    
    // If same datetime, sort by qno
    return a.qno - b.qno;
  });

  res.render('prof_dashboard/p_dashboard', {
    username,
    isProfileComplete,
    professional,
    scheduledMeetings,
    day_slot
  });
});



router.get('/volunteer_dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/login_prof');

    const { username } = req.session.user;

    try {
        const bookings = await VBooking.find({ vid: username }).sort({ date: 1 });
        const v_av = await available.findOne({ username });

        const enrichedBookings = await Promise.all(
          bookings.map(async (booking) => {
            const user = await Person.findOne({ username: booking.cid });
            const chatRoom = await chat_room.findOne({ booking_id: booking.booking_id });

            return {
              name: user ? user.fullName : booking.cid,
              date: booking.date,
              mode: booking.mode,
              duration: booking.duration,
              booking_id: booking.booking_id,
              confirmation: booking.confirmation,

              // Add these:
              uid: chatRoom?.uid || null,
              start_time_of_client: chatRoom?.start_date_time_client || null,
              chat_room: chatRoom?.uid || null
            };
          })
        );

        res.render('prof_dashboard/volunteer_dashboard', {
            username,
            v_av,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Error loading volunteer dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/login_prof', async (req, res) => {
  res.render('prof_dashboard/login_prof');
});

router.get('/volunteer', async (req, res) => {
  if (!req.session.user) return res.redirect('/login_prof');
  res.render('prof_dashboard/volunteer');
});


router.get('/profile_comp', async (req, res) => {
  if (!req.session.user) return res.redirect('/login_prof');
  res.render('prof_dashboard/profile_comp');
});

router.get('/update', async (req, res) => {
  if (!req.session.user) return res.redirect('/login_prof');
  res.render('prof_dashboard/update');
});

  router.post('/submit_questionnaire', async (req, res) => {
    if (!req.session.user) return res.redirect('/login_prof');

    try {
      const{name,email,phone, gender,mode,lang,capacity,price,password,rapport,education }=req.body;
      const username=req.session.user.username;
    await prof.findOneAndUpdate(
    { username: username },           // filter
    { type: "volunteer" },           // update
    { new: true, upsert: false }     // options
  );
    await volunteer.findOneAndUpdate(
  { username: username }, // filter
  {
   name,
  username,
  edu: education,    
  gender,           
  lang,       
  mode,           
  price,                
  pno: phone,
  email,
  password,
  approve:false,
  slotsize: capacity
  }, // update
  { new: true, upsert: true } // options
);
  await v_resp.findOneAndUpdate(
  { username: username }, // filter
  {
   username,
  q5_rapport: rapport,
  }, // update
  { new: true, upsert: true } // options
);
  return res.redirect('/volunteer_dashboard');  
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

router.post('/saveProfile', async (req, res) => {
  
  if (!req.session.user) return res.redirect('/login_prof');

  try {
    const {
      name, pno, password, edu, exp, price,
      certification, specialization, lang,
      mode, address, treat_app, available,
      time_slots,pps
    } = req.body;
    const modpps=parseInt(pps);
    const requiresAddress = Array.isArray(mode)
      ? mode.includes('In-Person') || mode.includes('Hybrid')
      : mode === 'In-Person' || mode === 'Hybrid';

    if (requiresAddress && (!address || address.trim() === '')) {
      return res.status(400).json({ error: 'Address required for In-Person or Hybrid mode.' });
    }

    // 1. Update profile data
    const updateData = {
      name,
      pno,
      password,
      edu,
      exp,
      price,
      specialization,
      certification: [].concat(certification || []),
      lang: [].concat(lang || []),
      mode: [].concat(mode || []),
      address: requiresAddress ? address : '',
      treat_app: [].concat(treat_app || []),
      approve: false,
      slotsize: modpps
    };

    const updatedProfile = await prof.findOneAndUpdate(
      { username: req.session.user.username },
      updateData,
      { new: true, upsert: false }
    );
    
    
    // 2. Update Date_Prof model
    const convertedDays = [];
    const dayMap = {
      'Sunday': 'sun',
      'Monday': 'mon',
      'Tuesday': 'tue',
      'Wednesday': 'wed',
      'Thursday': 'thur',
      'Friday': 'fri',
      'Saturday': 'sat'
    };
    
    const slotMap = {};
    for (const day of available || []) {
      const abbr = dayMap[day];
      if (abbr) slotMap[abbr] = [].concat(time_slots || []);
      convertedDays.push(abbr);
    }
    
    await dp.findOneAndUpdate(
      { username: req.session.user.username },
      { username: req.session.user.username, ...slotMap },
      { upsert: true, new: true }
    );
     const slotval=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    for(const t of time_slots || []){
        const separated= t.split(':')[0];
        slotval[parseInt(separated)]=modpps;
    }
    for(const sday of convertedDays || []){
      const updatedslot = await aps.findOneAndUpdate(
        { day: available[0] , username: req.session.user.username},
        { $set: { day: sday , nps:slotval, username: req.session.user.username} },
        { new: true, upsert: true }
      );
    }
    return res.redirect('/p_dashboard');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/updateAvailability', async (req, res) => {
  const { availability, price } = req.body; // Changed from availabilityUpdates to availability
  const username = req.session.user?.username;

  if (!username) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!Array.isArray(availability)) {
    return res.status(400).json({ success: false, message: 'Invalid availability data' });
  }

  // Group data by day
  const grouped = {};
  availability.forEach(({ day, hour, value }) => {
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push([hour, value]);
  });

  try {
    // Step 1: Clear previous entries
    await aps.deleteMany({ username });
    
    const apsRecords = [];
    const dateProfEntry = {
      username,
      sun: [],
      mon: [],
      tue: [],
      wed: [],
      thur: [],
      fri: [],
      sat: []
    };

    for (const day in grouped) {
      const hourValuePairs = grouped[day];

      // aps logic
      const nps = Array(24).fill(0);
      hourValuePairs.forEach(([hour, value]) => {
        nps[hour] = value;
      });
      apsRecords.push({ day, username, nps });

      // dp logic
      const timeSlots = hourValuePairs.map(([hour]) => {
        const from = `${hour}:00`;
        const to = `${hour + 1}:00`;
        return `${from}-${to}`;
      });
      dateProfEntry[day] = timeSlots;
    }

    // Step 2: Insert new entries
    await aps.insertMany(apsRecords);
    await dp.replaceOne({ username }, dateProfEntry, { upsert: true });
    await prof.updateOne({ username }, { $set: { price } });

    res.json({ success: true, message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Update failed:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



router.post('/logout_p', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout Error:', err);
      return res.status(500).send('Logout failed.');
    }
    res.redirect('/login_prof');
  });
});

router.get('/approve_meeting', async (req, res) => {
  const meetings = await booking.find({prof_username:req.session.user.username,status:false }).sort({ date: 1 });
  res.render('prof_dashboard/approve_meeting', { meetings });
});

router.post('/approve', async (req, res) => {
  const {bid}=req.body;
  await booking.findOneAndUpdate({ bid: bid }, { status: true },{ new: true, upsert: true });
  console.log();
  res.redirect('/approve_meeting');
});

router.post('/update_qulification', async (req, res) => {
  const { edu, exp, certification, specialization } = req.body;

  await prof.updateOne(
    {username: req.session.user.username },
    {
      edu,
      exp,
      certification: Array.isArray(certification) ? certification : [certification],
       specialization,
      approve: false
    }
  );

  res.redirect('/p_dashboard'); // or wherever appropriate
});
// POST: Approve meeting
router.post('/volunteer/availability', async (req, res) => {
  const { username } = req.session.user;

  try {
    const v_av = await available.findOne({ username });

    if (!v_av) {
      await available.findOneAndUpdate(
        { username },
        { available: true },
        { new: true, upsert: true } // set upsert to true to create if not exists
      );
      console.log("created and marked available");
    } else if (v_av.available === false) {
      await available.findOneAndUpdate(
        { username },
        { available: true },
        { new: true }
      );
      console.log("available");
    } else {
      await available.findOneAndUpdate(
        { username },
        { available: false },
        { new: true }
      );
      console.log("not available");
    }

    // ✅ Send a simple success response to avoid infinite loading
    return res.redirect('/volunteer_dashboard');

  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(500).send("Server error");
  }
});

router.post('/confirm-booking', async (req, res) => {
  const { bookingId } = req.body; // This now correctly extracts { bookingId: "..." }

  if (!bookingId) {
    return res.status(400).json({ success: false, message: 'Booking ID required' });
  }

  try {
    // Find the booking by its _id
    const booking = await VBooking.findById(bookingId);
    // console.log(booking); // Keep this for debugging if needed

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Update the existing booking using its _id
    // Set confirmation to true
    const updatedBooking = await VBooking.findByIdAndUpdate(
      bookingId, // Query by _id
      { confirmation: true }, // Update the 'confirmation' field to true
      { new: true } // Return the updated document
    );

    if (!updatedBooking) {
        // This case should ideally not be hit if findById found the booking,
        // but it's good for robustness.
        return res.status(404).json({ success: false, message: 'Booking not found after update attempt' });
    }

    return res.json({ success: true, message: 'Booking confirmed.' });
  } catch (error) {
    console.error('Error confirming booking:', error);
    // You might want to differentiate between CastError (invalid _id format) and other errors
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid Booking ID format.' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router;
