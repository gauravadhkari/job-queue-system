require('dotenv').config();
const express = require("express");
const connectDB = require("./config/db");
const Jobs = require("./models/job");
const { redisClient , connectRedis} = require("./config/redis");
const jobQueue = require("./queue/jobQueue");
const app = express();
const PORT = process.env.PORT || 3001;
app.use(express.json());
connectDB();
connectRedis();
app.get("/",(req,res) => {
  res.json({
    message : "Api is running..."
  })
});
app.post("/jobs", async (req,res) => {
  try{
  const { type , payload} = req.body;
  const job = await Jobs.create({
    type,
    status : "pending",
    payload,
    attempts : 0,
    error : null,
  });
  const queueJob = await jobQueue.add(
    type,
    {
      mongoJobId : job._id.toString(),
    },{
      attempts : 3,
      backoff : {
        type : "exponential",
        delay : 2000,
      }
    }
  )
  console.log("Queue JOb : ",queueJob.id);
  res.status(201).json({
    success : true,
    message : "Job Created..",
    job
  })
}catch(error){
  console.error("Internal Server Error",error.message);
  res.status(500).json({
    success : false,
    message : "Server Error.."
  })
}
});
app.get("/jobs", async(req,res) => {
  try{
  const data = await Jobs.find();
  res.status(200).json({
    success : true,
    data
  });
  }catch(error){
    console.error("Internal Server Error",error.message);
    res.status(500).json({
      success : false,
      message : "Server Error.."
    })
  }
})
app.get("/jobs/:id", async(req,res) => {
  try{
  const jobId = req.params.id;
  const job = await Jobs.findById(jobId);
  if(!job){
    return res.status(404).json({
      success : false,
      message : "Job not found.."
    })
  }
  console.log(job)
  res.json({
    success : true,
    job
  });
}catch(error){
  console.error("Internal Server Error:",error.message);
  res.status(500).json({
    success: false,
    message : "Server Error.."
  })
}
})
app.listen(PORT, () => {
  console.log("Server is running on PORT",PORT)
});