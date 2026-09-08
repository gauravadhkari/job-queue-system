require('dotenv').config();
const Jobs = require("./models/job");
const jobQueue = require("./queue/jobQueue")
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
    console.log("Bull Mq job received",job.id);
    console.log("Job Name : ",job.name);
    console.log("Job data :",job.data);
    const mongoJob = await Jobs.findById(job.data.mongoJobId);
    if(!mongoJob){
      throw new Error("Mongo Job not Found!")
    }
    await Jobs.findByIdAndUpdate(
      mongoJob._id,
      {
        status : "processing"
      }
    );
    await delay(3000);
    if(job.name === "fail_test"){
      throw new Error("Simulated Job Failure..")
    }
    await Jobs.findByIdAndUpdate(
      mongoJob._id,
      {
        status : "completed",
        completedAt : new Date(),
        error : null
      }
    );
    console.log("Job completed : ",job.id);
  }catch(error){
      console.error("Job failed :",error.message);
      throw error;
    }
  },
  {
    connection : {
      host : "127.0.0.1",
      port : 6379
    }
  }
);
}
startWorker();