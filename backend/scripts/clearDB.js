import mongoose from "mongoose";
import connectDB from "../src/config/db";

connectDB();

const collections = await mongoose.connection.db.collections();
for (const c of collections) {
  await c.deleteMany({});
}