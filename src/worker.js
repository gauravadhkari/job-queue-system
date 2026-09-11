require('dotenv').config();
const Jobs = require("./models/job");
const { Worker } = require("bullmq");
const connectDB = require("./config/db");


const delay = (ms) => {
      return new Promise((resolve) => {
        setTimeout(resolve,ms);
      });
    };
const startWorker = async () => {
await connectDB();
const worker = new Worker(
  "jobs",
  async(job) => {
    try{
      if (job.name === "scheduled_test") {
    console.log(
      new Date().toLocaleTimeString(),
      "Recurring job executed:",
      job.data.message
    );

    return;
  }
  
    console.log("Bull Mq job received",job.id);
    console.log("Job Name : ",job.name);
    console.log("Job data :",job.data);
    const mongoJob = await Jobs.findById(job.data.mongoJobId);
    if(!mongoJob){
      throw new Error("Mongo Job not found!");
    }
    await delay(3000);
    if(job.name === "fail_test"){
      throw new Error("Simulated Job Failure");
    }
    console.log("Work Successfully Processed..");
  }catch(error){
      console.error("Job failed :",error.message);
      throw error;
    }
  },
  {
    connection : {
      host : "127.0.0.1",
      port : 6379
    },
    concurrency : 1,
  },
);

worker.on("active", async (job) => {
  if (!job.data.mongoJobId) {
    console.log(
      `${new Date().toLocaleTimeString()} Scheduled job ${job.id} active`
    );
    return;
  }
  console.log(new Date().toLocaleTimeString(),
  `Job ${job.id} Active | attempt ${job.attemptsMade + 1}`)
  try{
    const currentAttempt = job.attemptsMade + 1;
    await Jobs.findByIdAndUpdate(
      job.data.mongoJobId,
      {
        status : "processing",
        attempts : currentAttempt,
      }
    );
   console.log(`Job ${job.id} has started | attemptsMade : ${job.attemptsMade}`);

}catch(error){
  console.error("Failed to update attempt:",error.message);
}
});
worker.on("completed", async(job) => {
  if (!job.data.mongoJobId) {
    console.log(
      `${new Date().toLocaleTimeString()} Scheduled job ${job.id} completed Successfully`
    );
    return;
  }
  try{
    await Jobs.findByIdAndUpdate(
      job.data.mongoJobId,
      {
        status : "completed",
        completedAt : new Date(),
      }
    );
  console.log(`Job ${job.id} completed successfully`);
  }catch(error){
     console.error("Error in Updating Status", error.message);
  }
});
worker.on("failed", async (job,error) => {
   if(!job){
    console.error("Unknown job failure:",error.message);
    return;
  }
  console.log(
    new Date().toLocaleTimeString(),
    `Job ${job.id} FAILED | attemptsMade ${job.attemptsMade}`
  );
  if (!job.data.mongoJobId) {
    console.error(
      `Scheduled job ${job.id} failed:`,
      error.message
    );
    return;
  }
  try{
    const maxAttempts = job.opts.attempts || 1;
    if(job.attemptsMade >= maxAttempts){
      await Jobs.findByIdAndUpdate(
        job.data.mongoJobId,
        {
          status : "failed",
          attempts : job.attemptsMade,
          error : error.message,
        }
      );
      console.log(`Job ${job.id} Permanent  Failed ,Job attempts : ${job.attemptsMade}`);
    }
    else {
      await Jobs.findByIdAndUpdate(
        job.data.mongoJobId,
        {
          status : "retrying",
          attempts : job.attemptsMade,
          error : error.message,
        }
      );
      console.log(`Job ${job.id} failed | attemptsMade : ${job.attemptsMade} | BullMq retrying`);
    }
  }catch(error){
    console.error("Error in Updating MongoDB",error.message);
  }
});
worker.on("error", (error) => {
  console.log("Worker Error:",error.message);
})
}
startWorker();