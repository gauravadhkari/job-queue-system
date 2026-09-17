const config = require("../config/env")
const { Queue } = require("bullmq");
const  IORedis  = require("ioredis")
const connection = new IORedis({
    host : config.redis.host || "127.0.0.1",
    port : config.redis.port || 6379,

   maxRetriesPerRequest : 1,
   enableOfflineQueue : false,
   connectTimeout: config.redis.connectTimeout|| 3000,
   retryStrategy(times){
     return Math.min(times * 1000,5000);
   },
});
connection.on("error", (error) => {
  console.error("BullMQ Queue Error:",error.message);
});

const jobQueue = new Queue("jobs",{
  connection,
})
module.exports = jobQueue;