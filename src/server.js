require('dotenv').config();
const express = require("express");
const connectDB = require("./config/db");
const Jobs = require("./models/job");
const jobQueue = require("./queue/jobQueue");
const app = express();
const PORT = process.env.PORT || 3001;
app.use(express.json());
const startServer = async () => {
  try{
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on PORT : ${PORT}`);
    })
  }catch(error){
    console.log("Failed to Start Server:",error.message);
    process.exit(1);
  }
}
startServer();

app.get("/",(req,res) => {
  res.json({
    message : "Api is running..."
  })
});
app.post("/jobs", async (req,res) => {
  try{
  const { type , payload , priority,runAt} = req.body;
  console.log("Priority received:", priority);
  console.log("Priority type:", typeof priority);
  const targetTime = new Date(runAt).getTime();
  if(Number.isNaN(targetTime)) {
    return res.status(400).json({
      success : false,
      message : "Invalid runAt Date"
    });
  }
  const delayMs = targetTime - Date.now();
  if(delayMs < 0){
    return res.status(400).json({
      success : false,
      message : "Run At must be in the failure"
    })
  }
  const job = await Jobs.create({
    type,
    status : "pending",
    payload,
    priority,
    runAt : new Date(runAt),
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
      },
      priority,
      delay : delayMs,
    }
  )
  console.log("BullMQ priority:", queueJob.opts.priority);
  console.log("Queue JOb : ",queueJob.id);
  console.log(
  new Date().toLocaleTimeString(),
  "Queued job:",
  queueJob.id,
  "delay:",
  queueJob.opts.delay
);
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