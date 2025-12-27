import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from './models/Session.js';
import connectDB from './config/db.js';

dotenv.config();

const findConflicts = async () => {
    await connectDB();
    console.log("Checking for double bookings...");

    const sessions = await Session.find({ status: 'PENDING' }).lean();
    const seen = new Set();
    const conflicts = [];

    for (const s of sessions) {
        // Create a unique key for Trainer + Date + Time
        const key = `${s.trainerId}-${s.date.toISOString()}-${s.startTime}`;
        if (seen.has(key)) {
            conflicts.push(s);
        } else {
            seen.add(key);
        }
    }

    if (conflicts.length === 0) {
        console.log("No conflicts found!");
    } else {
        console.log(`Found ${conflicts.length} overlapping sessions.`);
        console.log("You should delete these manually or clear the Session collection for a fresh start.");
        conflicts.forEach(c => console.log(`Conflict: Trainer ${c.trainerId} on ${c.date.toDateString()} at ${c.startTime}`));
    }
    process.exit();
};

findConflicts();