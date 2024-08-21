import cors from 'cors';
import express from 'express';
import { connectToDB, db } from "./db.js";
import nodemailer from "nodemailer";


const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
    res.json("Server is running successfully!");
});

// Signup route
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        const existingUser = await db.collection('ast').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        await db.collection('ast').insertOne({ email, password });
        res.status(201).json({ success: true, message: 'Signup successful!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error, please try again later' });
    }
});

// Signin route
app.post('/signin', async (req, res) => {
    try {
        const result = await db.collection("ast").findOne({ email: req.body.email });
        if (result) {
            if (result.password === req.body.password) {
                res.json({ message: "Login successful", values: result });
            } else {
                res.json({ error: "Incorrect password" });
            }
        } else {
            res.json({ error: "User not found" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to process login." });
    }
});

// Reset password route
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const result = await db.collection("ast").updateOne(
            { email: email },
            { $set: { password: newPassword } }
        );

        if (result.modifiedCount > 0) {
            res.json({ success: true, message: "Password updated successfully" });
        } else {
            res.json({ success: false, message: "User not found or password not updated" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update password" });
    }
});

// Hospital login route
app.post('/hlogin', async (req, res) => {
    try {
        const formData = req.body;

        // Insert the form data into the "hospitals" collection
        const result = await db.collection('hospitals').insertOne(formData);

        if (result.acknowledged) {
            res.json({ success: true, message: 'Signup successful' });
        } else {
            res.json({ success: false, message: 'Signup failed' });
        }
    } catch (err) {
        console.error('Error occurred during signup:', err);
        res.status(500).json({ success: false, message: 'An error occurred during signup' });
    }
});

app.get('/', (req, res) => {
    res.json("Server is running successfully!");
});

app.post('/searchpage', async (req, res) => {
    try {
        // Construct a query to search by name, case-insensitive
        console.log("in back")
        console.log(req.body)
        const query = { hospitalName: { $regex: req.body.name } };
        
        // Find all documents that match the query
        const results = await db.collection("hospitals").find(query).toArray();
        console.log(results)
        if (results.length > 0) {
            res.json({ result: results });
        } else {
            res.json({ error: "No documents found" });
        }
    } catch (e) {
        console.error('Error fetching data:', e);
        res.status(500).json({ error: "Failed to process the request." });
    }
});

const handleSignIn = async () => {
    try {
        const res = await axios.post("http://localhost:9000/signin", { email, password });
        if (res.data.message) {
            alert("Login successful");
            nav('/hospital-form'); // Redirect to HospitalForm after successful login
        } else {
            alert(res.data.error || "User not found");
            nav('/signup');
        }
    } catch (err) {
        console.error(err);
        alert("An error occurred. Please try again.");
    }
};

// Updated /emergencypage endpoint to return all documents
app.post('/emergencypage', async (req, res) => {
    try {
        // Fetch all documents in the "ast" collection
        const results = await db.collection("hospitals").find({}).toArray();
console.log(results);
        if (results.length > 0) {
            res.json({ result: results });
        } else {
            res.json({ error: "No documents found" });
        }
    } catch (e) {
        console.error('Error fetching data:', e);
        res.status(500).json({ error: "Failed to process the request." });
    }
});

// Appointment Booking Route
app.post('/book-appointment', async (req, res) => {
    try {
        const { hospitalId, userId, doctorName, appointmentDate, appointmentTime } = req.body;
        
        const appointment = {
            hospitalId,
            userId,
            doctorName,
            appointmentDate,
            appointmentTime,
            status: 'Booked'
        };

        const result = await db.collection('appointments').insertOne(appointment);

        if (result.acknowledged) {
            res.status(201).json({ success: true, message: 'Appointment booked successfully!' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to book appointment' });
        }
    } catch (err) {
        console.error('Error booking appointment:', err);
        res.status(500).json({ success: false, message: 'An error occurred while booking appointment' });
    }
});
// Bed Slot Booking Route
app.post('/book-bed', async (req, res) => {
    try {
        const { hospitalId, userId, bedType } = req.body;

        const availableBeds = await db.collection('hospitals').findOne({ _id: hospitalId });

        if (availableBeds && availableBeds[bedType] > 0) {
            await db.collection('hospitals').updateOne(
                { _id: hospitalId },
                { $inc: { [bedType]: -1 } }
            );

            const bedBooking = {
                hospitalId,
                userId,
                bedType,
                bookingDate: new Date(),
                status: 'Booked'
            };

            await db.collection('bed_bookings').insertOne(bedBooking);
            res.status(201).json({ success: true, message: 'Bed booked successfully!' });
        } else {
            res.status(400).json({ success: false, message: 'No available beds for the selected type' });
        }
    } catch (err) {
        console.error('Error booking bed:', err);
        res.status(500).json({ success: false, message: 'An error occurred while booking bed' });
    }
});
// Location-Based Hospital Search Route
app.post('/nearby-hospitals', async (req, res) => {
    const { latitude, longitude, radius } = req.body;

    try {
        const hospitals = await db.collection('hospitals').find({
            location: {
                $geoWithin: {
                    $centerSphere: [[longitude, latitude], radius / 3963.2] // Radius in miles
                }
            }
        }).toArray();

        if (hospitals.length > 0) {
            res.status(200).json({ success: true, hospitals });
        } else {
            res.status(404).json({ success: false, message: 'No hospitals found within the specified radius' });
        }
    } catch (err) {
        console.error('Error fetching nearby hospitals:', err);
        res.status(500).json({ success: false, message: 'An error occurred while fetching nearby hospitals' });
    }
});

app.get('/hospitals', async (req, res) => {
    try {
        const hospitals = await db.collection('hospitals').find({}).toArray();
        res.json({ success: true, hospitals });
    } catch (err) {
        console.error('Error fetching hospitals:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch hospitals' });
    }
});

// Booking endpoint


app.post('/book', async (req, res) => {
    try {
        console.log(req.body);
        const { hospitalName, patientName, bedType } = req.body;

        // Check for required fields
        if (!hospitalName || !patientName || !bedType) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Validate bed type
        if (!['icu', 'normal'].includes(bedType)) {
            return res.status(400).json({ success: false, message: 'Invalid bed type' });
        }

        // Determine which bed type to update
        const updateField = bedType === 'icu' ? 'icuBedAvailability' : 'bedAvailability';
        console.log(updateField);

        // Update the bed count for the selected hospital by hospital name
        const result = await db.collection('hospitals').findOneAndUpdate(
            { hospitalName: hospitalName, [updateField]: { $gt: 0 } }, // Ensure there are beds available
            { $inc: { [updateField]: -1 } }, // Decrement the bed count
            { returnDocument: 'after' } // Return the updated document
        );
console.log(result)
        // Check if the hospital was found and updated
        if (result ) {
            // Save booking details in the bookings collection
            await db.collection('bookings').insertOne({
                hospitalName: result.hospitalName,
                patientName,
                bedType,
                bookedAt: new Date()
            });

            // Respond with success
            res.json({ success: true, message: 'Booking successful', data: result.value });
        } else {
            // No available beds or hospital not found
            res.status(404).json({ success: false, message: 'No available beds or hospital not found' });
        }
    } catch (err) {
        console.error('Error during booking:', err);
        res.status(500).json({ success: false, message: 'An error occurred during booking' });
    }
});
let otps;
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: 'pranayerra2003@gmail.com',
      pass: 'hqia xwbl pzzp zlso'
  },
  tls: {
      rejectUnauthorized: false
  }
});

app.post('/send-otp', (req, res) => {
    const { email } = req.body;
    otps = Math.floor(100000 + Math.random() * 900000);

    const mailOptions = {
        from: 'pranayerra2003@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otps}` // Corrected line
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.json({ success: false });
        } else {
            console.log('Email sent: ' + info.response);
            res.json({ success: true });
        }
    });
});

// OTP Verification route
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    // Log incoming request data for debugging
    console.log("Received OTP:", otp);
    console.log("Expected OTP:", otps);
    console.log("Received Email:", email);

    try {
        if (!otps || !email) {
            return res.status(400).json({ success: false, message: 'OTP has not been sent or email is missing' });
        }

        if (otps==otp) {
            // OTP matches, proceed with account creation
            await db.collection('users').insertOne({ email });
            // otps = null; // Remove the OTP from store after successful verification

            res.status(201).json({ success: true, message: 'Signup successful!' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ success: false, message: 'Server error, please try again later.' });
    }
});


let bookings = []; // Array to store bookings

app.post('/book', (req, res) => {
    const { hospitalName, patientName, bedType } = req.body;
    const bookingId = `${Date.now()}_${patientName}`; // Generate a simple booking ID

    const newBooking = { bookingId, hospitalName, patientName, bedType };
    bookings.push(newBooking);

    res.status(200).json({ success: true, bookingId });
});

app.post('/cancel-booking', (req, res) => {
    const { bookingId } = req.body;

    const index = bookings.findIndex(booking => booking.bookingId === bookingId);
    if (index !== -1) {
        bookings.splice(index, 1); // Remove the booking from the array
        return res.status(200).json({ success: true, message: 'Booking canceled successfully' });
    }

    res.status(404).json({ success: false, message: 'Booking not found' });
});


// Connect to the database and start the server
connectToDB(() => {
    app.listen(9000, () => {
        console.log("Server running at https://nationalinfoportal.onrender.com");
    });
})