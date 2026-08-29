import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "safepost";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export async function getMongoClient() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  const clientPromise = globalForMongo.mongoClientPromise ?? new MongoClient(uri).connect();
  if (process.env.NODE_ENV !== "production") {
    globalForMongo.mongoClientPromise = clientPromise;
  }
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const connectedClient = await getMongoClient();
  return connectedClient.db(databaseName);
}