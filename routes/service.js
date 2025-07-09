const moment = require('moment'); // if not already imported
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const session = require('express-session');
const professional = require('../models/professional');
const booking=require('../models/booking');
const personal = require("../models/personal");
const date_prof = require('../models/date_prof');
const slots = require('../models/slots');
const Prof_slot = require('../models/prof_slots'); // ✅ your model import
const Volunteer = require('../models/volunteer'); // Adjust the path if needed
const Available = require('../models/available');
const VBooking = require('../models/v_booking');
const chat_room= require('../models/chat_room');
router.get('/therapy', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    res.render('therapy');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.post('/api/filter-therapists', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const { date, specialization, language, mode } = req.body;
    const query = {
      approve: true
    };

    let weekdayKey = null;
    if (date && date !== 'ALL') {
      weekdayKey = new Date(date).toLocaleDateString("en-US", {
        weekday: "short"
      }).toLowerCase().slice(0, 3); // e.g., "mon", "tue"
    }
    
    // Correct weekday mapping
    const weekdayMap = {
      mon: "mon",
      tue: "tue",
      wed: "wed",
      thu: "thur",  // Fix for DB field
      fri: "fri",
      sat: "sat",
      sun: "sun"
    };
    const actualKey = weekdayMap[weekdayKey];

    // Apply filters
    if (specialization?.trim().toUpperCase() !== 'ALL') {
      query.specialization = { $regex: new RegExp(`^${specialization.trim()}$`, 'i') };
    }

    if (language?.trim().toUpperCase() !== 'ALL') {
      query.lang = { $elemMatch: { $regex: new RegExp(`^${language.trim()}$`, 'i') } };
    }

    if (mode?.trim().toUpperCase() !== 'ALL') {
      query.mode = { $elemMatch: { $regex: new RegExp(`^${mode.trim()}$`, 'i') } };
    }

    const therapists = await professional.find(query).lean();
    const therapistUsernames = therapists.map(t => t.username);

    // Fetch time availability
    const timeData = await date_prof.find({
      username: { $in: therapistUsernames }
    }).lean();

    const timeMap = {};
    for (const doc of timeData) {
      const slots = actualKey ? doc[actualKey] : [];
      if (slots && slots.length > 0) {
        timeMap[doc.username] = slots;
      }
    }

    // Filter and enrich therapists
    const enrichedTherapists = therapists
      .filter(t => timeMap[t.username])  // only keep those available on that day
      .map(t => ({
        ...t,
        available: weekdayKey ? [weekdayKey] : [],
        timeSlots: timeMap[t.username]
      }));

    res.json({ success: true, matchedTherapists: enrichedTherapists });

  } catch (error) {
    console.error("❌ Error in /api/filter-therapists:", error);
    res.status(500).send("Server Error");
  }
});

router.post("/api/book-session", async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');

    const client = await personal.findOne({ username: req.session.user.username });
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });

    const {
      therapistUsername,
      date,
      time,
      consultationType,
      mode
    } = req.body;

    const therapist = await professional.findOne({ username: therapistUsername });
    if (!therapist) return res.status(404).json({ success: false, message: "Therapist not found" });

    const bookingDay = moment(date).format('ddd').toLowerCase(); // "sun", "mon", etc.
    const hour = parseInt(time.split(':')[0]) % 24;
    const date_prof_data= await slots.findOne({
      username: therapistUsername,
      day:bookingDay
    });
    
    
    let slotRecord = await Prof_slot.findOne({
      prof_username: therapistUsername,
      date: date,
      time: time
    });

    if (!slotRecord) {
      // First booking for this slot
      slotRecord = new Prof_slot({
        prof_username: therapistUsername,
        date: date,
        time: time,
        slotval: 1
      });
    } else {
      // Increment existing slotval
      slotRecord.slotval += 1;
    }
    if (slotRecord.slotval > date_prof_data.nps[hour]) {
  // Revert incremented slotval
  if (slotRecord.isNew) {
    // Don't save if it was just created
    slotRecord = null;
  } else {
    slotRecord.slotval -= 1;
    await slotRecord.save(); // revert to previous state
  }

  return res.status(403).json({
    success: false,
    message: "Booking not allowed: Time slot is full."
  });
}
    await slotRecord.save(); // ✅ Save updated or new slot

    // ✅ Create booking
    const bookingId = new mongoose.Types.ObjectId();
    const newBooking = new booking({
      prof_name: therapist.name,
      prof_username: therapist.username,
      client_name: client.fullName,
      client_username: req.session.user.username,
      mode,
      date: new Date(date),
      time,
      consult_type: consultationType,
      bid: `${bookingId.toString()}`,
      qno: slotRecord.slotval
    });

    await newBooking.save();

    return res.json({ success: true, message: "Booking confirmed" });

  } catch (err) {
    console.error("Booking error:", err);
    return res.status(500).json({ success: false, message: "Booking failed" });
  }
});



router.get('/get_interested_volunteers', async (req, res) => {
  // Ensure the user is logged in
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const clientUsername = req.session.user.username; // Get username from session

  try {
    // 1. Find VBooking entries where the client is interested and it's not yet confirmed by the volunteer
    const interestedBookings = await VBooking.find({
      cid: clientUsername,
      interested: true,    // Marked as interested by the client
    }).sort({ date: -1 }); // Sort by date, newest first

    // 2. Enrich these bookings with volunteer details (e.g., volunteer's actual name)
    const enrichedInterestedBookings = await Promise.all(
      interestedBookings.map(async (booking) => {
        // Fetch the volunteer's name using their username (vid) from the Volunteer model
        const volunteer = await Volunteer.findOne({ username: booking.vid }, { name: 1, _id: 0 }); // Only fetch name

        return {
            volunteerId: booking.vid,
            name: volunteer ? volunteer.name : 'Unknown Volunteer',
            mode: booking.mode,
            durationInMinutes: booking.duration,
            payableAmount: booking.price,
            booking_id: booking.booking_id,
            confirmation: booking.confirmation // Add this field
          };
      })
    );

    res.json(enrichedInterestedBookings);

  } catch (error) {
    console.error('Error fetching interested volunteers for sidebar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// (Your existing /filter_volunteers route - no changes needed here for this task)
router.post('/filter_volunteers', async (req, res) => {
  try {
    const { mode, gender, language } = req.body;
    const clientUsername = req.session.user.username; 

    // Step 1: Get all usernames with engaged_status: false
    const availableUsers = await Available.find(
      { engaged_status: false },
      { username: 1, _id: 0 }
    );
    const availableUsernames = availableUsers.map(user => user.username);
    if (!availableUsernames.length) return res.json([]);

    // Step 2: Build initial query
    const query = {
      username: { $in: availableUsernames },
      approve: true
    };
    if (gender) query.gender = gender;
    if (mode) query.mode = { $in: [mode, "Both"] };
    if (language) query.lang = { $in: [language] };

    // Step 3: Fetch matching volunteers
    let volunteers = await Volunteer.find(query, {
      name: 1,
      username: 1,
      gender: 1,
      mode: 1,
      lang: 1,
      price: 1,
      _id: 0
    });

    // Step 4: Get volunteers already marked interested by this client AND NOT YET CONFIRMED
    const alreadyInterestedAndUnconfirmed = await VBooking.find(
      {
        cid: clientUsername,
        interested: true,
       
        vid: { $in: volunteers.map(v => v.username) }
      },
      { vid: 1, _id: 0 }
    );
    const interestedVolunteerUsernames = alreadyInterestedAndUnconfirmed.map(b => b.vid);

    // Step 5: Filter out those already interested (and unconfirmed)
    volunteers = volunteers.filter(v => !interestedVolunteerUsernames.includes(v.username));
    res.json(volunteers);

  } catch (err) {
    console.error('Error fetching filtered volunteers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/book_volunteer', async (req, res) => {
  let { userId, volunteerId, mode, durationInMinutes, payableAmount } = req.body;

  // Basic validation
  if (!userId || !volunteerId || !durationInMinutes) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    // Fetch volunteer details
    const volunteer = await Volunteer.findOne({ username: volunteerId });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found.' });
    }

    // If volunteer's mode is "Both" and user hasn't specified, default to "Text"
    if (!mode && volunteer.mode === "Both") {
      mode = "Text";
    } else if (!mode) {
      // fallback to volunteer's default mode if user hasn't provided any
      mode = volunteer.mode;
    }
    const bookingId = new mongoose.Types.ObjectId();
    // Create booking
    const newBooking = new VBooking({
      booking_id: `${bookingId.toString()}`,
      cid: userId,
      vid: volunteerId,
      mode,
      duration: durationInMinutes,
      price: payableAmount
    });

    await newBooking.save();
    res.status(200).json({ success: true, message: 'Booking saved successfully.' });

  } catch (error) {
    console.error('Booking Error:', error);
    res.status(500).json({ success: false, message: 'Server error while booking.' });
  }
});

router.post('/mark_interested', async (req, res) => {
  const { userId, volunteerId, mode, durationInMinutes, payableAmount } = req.body;

  if (!userId || !volunteerId || !durationInMinutes) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const existing = await VBooking.findOne({ cid: userId, vid: volunteerId, completed: false });

    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a pending booking with this volunteer.' });
    }

    const bookingId = new mongoose.Types.ObjectId();

    const newBooking = new VBooking({
      booking_id: `${bookingId}`,
      cid: userId,
      vid: volunteerId,
      mode,
      interested: true,
      duration: durationInMinutes,
      price: payableAmount
    });

    await newBooking.save();
    res.status(200).json({ success: true, message: 'Interest marked.' });
  } catch (err) {
    console.error('Interest Marking Error:', err);
    res.status(500).json({ success: false, message: 'Server error while marking interest.' });
  }
});

router.post('/chat_room', async (req, res) => {
  const { booking_id } = req.body;
  console.log('Received booking_id:', booking_id); // For debugging

  try {
    const booking_detail = await VBooking.findOne({booking_id : booking_id}); // Assuming booking_id is VBooking's _id
    console.log('Found booking_detail:', booking_detail); // For debugging

    if (!booking_detail) {
      return res.status(404).json({ success: false, message: 'Booking details not found.' });
    }

    // Corrected: Use Date.now() or new Date()
    const updateData = {
      booking_id: booking_id,
      start_date_time_client: new Date(), // <-- CHANGE IS HERE
      uid: booking_detail.cid,
      vid: booking_detail.vid,
      duration: booking_detail.duration
    };

    await chat_room.findOneAndUpdate(
      { booking_id: booking_id },
      updateData,
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Chat room entry created/updated successfully.' });
  } catch (err) {
    console.error('Chat Room Creation/Update Error:', err);
    res.status(500).json({ success: false, message: 'Server error during chat room setup.' });
  }
});

router.post('/join_volunteer', async (req, res) => {
  const { booking_id } = req.body;
  

  try {
    const booking_detail = await VBooking.findOne({booking_id : booking_id}); // Assuming booking_id is VBooking's _id

    if (!booking_detail) {
      return res.status(404).json({ success: false, message: 'Booking details not found.' });
    }

    // Corrected: Use Date.now() or new Date()
    const updateData = {
      booking_id: booking_id,
      start_date_time_volunteer: new Date(), // <-- CHANGE IS HERE
      uid: booking_detail.cid,
      vid: booking_detail.vid,
      duration: booking_detail.duration
    };

    await chat_room.findOneAndUpdate(
      { booking_id: booking_id },
      updateData,
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Chat room entry created/updated successfully.' });
  } catch (err) {
    console.error('Chat Room Creation/Update Error:', err);
    res.status(500).json({ success: false, message: 'Server error during chat room setup.' });
  }
});


module.exports = router;
