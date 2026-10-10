import "dotenv/config";
import readline from "node:readline/promises";
import mongoose from "mongoose";

// Empties the database named in MONGO_URI: every account and everything any account has made.
// It cannot be undone. The collections and their indexes stay, so a server that is running carries on
// (a dropped database would lose its unique indexes until that server restarted).
//
//   node scripts/clearDB.js        (or: npm run db:clear)
//
// It shows what it is about to empty and asks for the database's name to be typed before it does anything.

const uri = process.env.MONGO_URI;
if (!uri) {
    console.error("MONGO_URI is not set. It is read from backend/.env.");
    process.exit(1);
}
if (!process.stdin.isTTY) {
    console.error("This asks a question before deleting anything, so it has to be run in a terminal.");
    process.exit(1);
}

await mongoose.connect(uri);

const { name, host } = mongoose.connection;
const collections = await mongoose.connection.db.collections();
const counts = await Promise.all(collections.map((collection) => collection.countDocuments()));

console.log(`\nDatabase "${name}" on ${host}\n`);
collections.forEach((collection, index) => {
    console.log(`  ${collection.collectionName.padEnd(24)} ${counts[index]}`);
});
console.log(`\nEverything listed will be deleted: ${counts.reduce((sum, count) => sum + count, 0)} documents. This cannot be undone.`);

const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
const typed = (await terminal.question(`Type the database's name (${name}) to go ahead: `)).trim();
terminal.close();

if (typed !== name) {
    console.log("Nothing was deleted.");
} else {
    for (const collection of collections) {
        const { deletedCount } = await collection.deleteMany({});
        console.log(`  emptied ${collection.collectionName} (${deletedCount})`);
    }
    console.log("Done. Every account is gone: sign up again to start fresh.");
}

await mongoose.disconnect();
