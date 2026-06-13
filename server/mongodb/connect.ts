import mongoose from "mongoose";

let isConnected = false;

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Set it in Replit Secrets or .env");
  }

  if (isConnected) {
    return;
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || "ppamong",
  });

  isConnected = true;
  console.log("[MongoDB] Connected to Atlas (ppamong)");
}

export async function disconnectMongoDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

export { mongoose };
