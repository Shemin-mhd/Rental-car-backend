const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const bookingSchema = new mongoose.Schema({}, { strict: false });
const carSchema = new mongoose.Schema({}, { strict: false });

const Booking = mongoose.model('Booking', bookingSchema, 'bookings');
const Car = mongoose.model('Car', carSchema, 'cars');

async function checkStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const bookings = await Booking.find({ status: 'Confirmed' });
    console.log(`Found ${bookings.length} Confirmed bookings:`);
    for (const b of bookings) {
      const car = await Car.findById(b.carId);
      console.log(`Car: ${car ? car.name : 'Unknown'} (ID: ${b.carId}), Start: ${b.startDate}, End: ${b.endDate}`);
    }

    const cars = await Car.find({});
    console.log(`Found ${cars.length} cars:`);
    cars.forEach(c => {
      console.log(`Car: ${c.name}, isAvailable: ${c.isAvailable}, status: ${c.status}`);
    });

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

checkStatus();
