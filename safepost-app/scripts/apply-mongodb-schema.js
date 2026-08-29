// Run this script to apply JSON Schema validation to the MongoDB `profiles` collection:
// node scripts/apply-mongodb-schema.js

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const databaseName = process.env.MONGODB_DB || "safepost";

async function applySchema() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(databaseName);

    const schema = {
      $jsonSchema: {
        bsonType: "object",
        required: ["workspaceId", "name", "email", "role", "region"],
        properties: {
          workspaceId: {
            bsonType: "string",
            description: "Workspace identifier - required string",
          },
          name: {
            bsonType: "string",
            description: "User name - required string",
          },
          email: {
            bsonType: "string",
            description: "User email - required string",
          },
          phone: {
            bsonType: "string",
            description: "Optional phone number string",
          },
          role: {
            bsonType: "string",
            description: "User role - required string",
          },
          region: {
            bsonType: "string",
            description: "User region - required string",
          },
          apiKey: {
            bsonType: "string",
            description: "Optional API key string",
          },
          updatedAt: {
            bsonType: "date",
            description: "Last update timestamp",
          },
        },
      },
    };

    const collections = await db.listCollections({ name: "profiles" }).toArray();

    if (collections.length === 0) {
      await db.createCollection("profiles", { validator: schema });
      console.log("Created 'profiles' collection with JSON Schema validation.");
    } else {
      await db.command({
        collMod: "profiles",
        validator: schema,
        validationLevel: "moderate",
      });
      console.log("Updated 'profiles' collection validation schema.");
    }
  } catch (error) {
    console.error("Error applying schema:", error);
  } finally {
    await client.close();
  }
}

applySchema();
