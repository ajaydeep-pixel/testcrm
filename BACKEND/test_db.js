require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    console.log('Connecting to:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');
    
    const session = await mongoose.startSession();
    console.log('Session started');
    session.startTransaction();
    console.log('Transaction started');
    await session.commitTransaction();
    console.log('Transaction committed');
    session.endSession();
    console.log('Session ended');
    
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

test();
