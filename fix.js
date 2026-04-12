require("dotenv").config();
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const result = await mongoose.connection.collection("bookings").updateMany(
            { documentStatus: "Pending" },
            { $set: { documentStatus: "Approved" } }
        );
        console.log("Stuck bookings fixed:", result.modifiedCount);
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
});
