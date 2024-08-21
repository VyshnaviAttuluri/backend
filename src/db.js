import { MongoClient } from "mongodb";

let db;
async function connectToDB(cb) {
    const url = "mongodb+srv://vyshnavi:vyshnavi12@hospitals.6rzam.mongodb.net/?retryWrites=true&w=majority&appName=hospitals";
    const client = new MongoClient(url);

    try {
        await client.connect();
        db = client.db();
        console.log("Connected successfully to the database");
        cb(); // Execute the callback after successful connection
    } catch (error) {
        console.error("Failed to connect to the database", error);
        throw error;
    }
}

// connectToDB()

export { connectToDB, db };
