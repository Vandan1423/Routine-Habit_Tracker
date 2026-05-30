import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () =>{
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Successfully connected to Database");
    } catch (error) {
        console.error("Error connecting to Database:", error);
        process.exit(1); // Exit with failure
    }
}

export default connectDB;