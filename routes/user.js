require('dotenv').config();
const express = require('express');
const router = express.Router();
const PersonalInfo = require('../models/personal');
const HealthPreference = require('../models/healthpref');
const ContactInfo = require('../models/contactinfo'); // use correct models
const AccountInfo = require('../models/accountinfo'); // use correct models
const booking = require('../models/booking');

const app = express();
app.use(express.json());


router.get('/edit', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    
    const username = req.session.user.username;
    
    const personal = await PersonalInfo.findOne({ username });
    const contact = await ContactInfo.findOne({ username });
    const health = await HealthPreference.findOne({ username });
    // Construct a combined user object for the form
    const user = {
      fullName: personal?.fullName || '',
      dob: personal?.dateOfBirth ? personal.dateOfBirth.toISOString().split('T')[0] : '',
      gender: personal?.gender || '',
      bio: personal?.bio || '',
      phone: contact?.phone || '',
      address: contact?.address || '',
      country: contact?.country || '',
      healthPreferences: health?.conditionDetails ? health.conditionDetails.split(', ') : [],
      preferredSupport: health?.therapyType || []
    };
    //console.log(user);hey
    res.render('edit', { user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});


router.get('/v_page', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    const username= req.session.user.username;
    res.render('v_page',{username});
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.get('/checkup', async (req, res) => {
  try {
    res.render('checkup');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.get('/chat_room/:booking_id', (req, res) => {
  const bookingId = req.params.booking_id;
  const username = (req.session.user && req.session.user.username) || 'User';
  res.render('chat_room', { booking_id: bookingId, username });
});


router.get('/userpage', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const username = req.session.user.username;

  try {
    const personal = await PersonalInfo.findOne({ username }).lean();
    const contact = await ContactInfo.findOne({ username }).lean();
    const account = await AccountInfo.findOne({ username }).lean();

    const allDocs = {
      Personal: personal || {},
      Contact: contact || {},
      Account: account || {}
    };

    const missingFields = {
      Personal: [],
      Contact: [],
      Account: []
    };

    // Get current datetime
    const now = new Date();

    // Get all bookings sorted by date/time
    const allBookings = await booking.find({ client_username: username }).sort({ date: 1, time: 1 });

    // Filter only future or ongoing bookings
    const upcomingBookings = allBookings.filter(b => {
      const bookingDate = new Date(b.date);
      const [hours, minutes] = b.time.split(':').map(Number); // assumes time is string "HH:MM"
      bookingDate.setHours(hours);
      bookingDate.setMinutes(minutes);
      return bookingDate >= now;
    });

    res.render('userpage', {
      user: {
        fullName: personal.fullName,
        username: personal.username,
        hasPassword: !!account.password,
        bookings: upcomingBookings,
        emailVerified: contact.emailVerified
      }
    });
  } catch (err) {
    console.error('Userpage Error:', err);
    res.status(500).send('Server error.');
  }
});

app.post('/complete-single-field', async (req, res) => {
  // validate and update user's field
  res.json({ success: true, verifiedPercentage: 80 });
});

router.post('/edit', async (req, res) => {
  try {
    const username = req.session.user?.username;
    if (!username) return res.status(401).send('Unauthorized');

    const {
      fullName,
      dob,
      gender,
      phone,
      address,
      country,
      bio,
      healthPreferences = [],
      preferredSupport = []
    } = req.body;
    
    // Normalize to array if single string is submitted
    const healthPrefs = Array.isArray(healthPreferences) ? healthPreferences : [healthPreferences];
    const supportPrefs = Array.isArray(preferredSupport) ? preferredSupport : [preferredSupport];

    // Update Personal Info
    await PersonalInfo.findOneAndUpdate(
      { username },
      {
        fullName,
        dateOfBirth: dob,
        gender,
        bio
      },
      { upsert: true }
    );

    // Update Contact Info
    await ContactInfo.findOneAndUpdate(
      { username },
      {
        phone,
        address,
        country
      },
      { upsert: true }
    );

    // Update Health Preferences
    await HealthPreference.findOneAndUpdate(
      { username },
      {
        conditionDetails: healthPrefs.join(', '),
        therapyType: supportPrefs
      },
      { upsert: true }
    );

    res.redirect('/userpage');
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send('Server error');
  }
});



module.exports = router;
