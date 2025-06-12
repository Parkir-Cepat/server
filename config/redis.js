import "dotenv/config";
import Redis from "ioredis";

const client = new Redis({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

client.on("error", (err) => console.log("Redis Client Error", err));

export default client;
