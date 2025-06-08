// midi-sharing-webapp/config/dbMongo.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI not found in .env file. MongoDB connection will fail.");
  // process.exit(1); // Or handle appropriately
}

const client = new MongoClient(uri, {
  useNewUrlParser: true, // Mặc dù có thể không cần thiết với driver mới
  useUnifiedTopology: true, // Mặc dù có thể không cần thiết với driver mới
});

let dbConnection;
let gfsBucket;

const connectToServer = async (callback) => {
  try {
    if (!uri) throw new Error("MONGO_URI is not defined.");
    await client.connect();
    dbConnection = client.db(); // Mặc định sẽ dùng DB name từ URI, hoặc bạn có thể chỉ định ở đây
    console.log("Successfully connected to MongoDB.");

    // Initialize GridFSBucket
    const { GridFSBucket } = require('mongodb');
    gfsBucket = new GridFSBucket(dbConnection, {
      bucketName: process.env.GRIDFS_MIDI_BUCKET_NAME || 'midiFilesBucket'
    });
    console.log(`GridFS bucket '${gfsBucket.bucketName}' initialized.`);

    if (callback) callback();
  } catch (e) {
    console.error("Failed to connect to MongoDB or initialize GridFS:", e);
    if (callback) callback(e);
    // process.exit(1); // Thoát nếu không kết nối được DB
  }
};

const getDb = () => {
  if (!dbConnection) {
    console.warn("MongoDB connection not established. Call connectToServer first.");
  }
  return dbConnection;
};

const getGfsBucket = () => {
  if (!gfsBucket) {
    console.warn("GridFS bucket not initialized. Call connectToServer first.");
  }
  return gfsBucket;
};

module.exports = { connectToServer, getDb, getGfsBucket };