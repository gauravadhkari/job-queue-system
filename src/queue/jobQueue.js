const { Queue } = require("bullmq");
const  IORedis  = require("ioredis")
const connection = new IORedis({
    host : "127.0.0.1",
    port : 6379,

   maxRetriesPerRequest : 1,
   enableOfflineQueue : false,
   connectTimeout: 3000,
   retryStrategy : () => null,
});
connection.on("error", (error) => {
  console.error("BullMQ Queue Error:",error.message);
});

const jobQueue = new Queue("jobs",{
  connection,
})
module.exports = jobQueue;