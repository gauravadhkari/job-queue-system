const express = require("express");
const mongoose = require("mongoose")
const connectDB = require("./config/db");
const Jobs = require("./models/job");
const jobQueue = require("./queue/jobQueue");
const recoveryJob = require('./services/recoveryService');
const startRecoveryRunner = require('./services/recoveryRunner');
const config = require("./config/env");
const app = express();
const PORT = config.PORT || 3001;
app.use(express.json());
let server;
let recoveryInterval;
const startServer = async () => {
  try{
    await connectDB();
    recoveryInterval = startRecoveryRunner();
    server = app.listen(PORT, () => {
      console.log(`Server is running on PORT : ${PORT}`);
    })
  }catch(error){
    console.log("Failed to Start Server:",error.message);
    process.exit(1);
  }
}
startServer();

app.get("/health", async(req,res) => {
  
     const mongoHealthy = mongoose.connection.readyState === 1;
     let redisHealthy = true;
     try{
       await jobQueue.getJobCounts("waiting")
      }catch(error){
        redisHealthy = false;
       }
      const healthy = mongoHealthy && redisHealthy;
      return res.status(healthy ? 200 : 503).json({
        success : healthy,
        status : healthy ? "Healthy" : "Unhealthy",
        services : {
          api : "healthy",
          mongoDb : mongoHealthy ? "Healthy" : "Unavailable",
          redis : redisHealthy ? "Healthy" : "Unavailable"
        }
      });
});
app.post("/jobs", async (req,res) => {
  try{
  const { type , payload , priority,runAt,idempotencyKey} = req.body;
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
  if(delayMs <= 0){
    return res.status(400).json({
      success : false,
      message : "runAt must be in the failure"
    })
  }
  const existingJob = await Jobs.findOne({
    idempotencyKey
  });
  if(existingJob){
    return res.status(200).json({
      message : "Job already Exist..",
      existingJob,
    })
  }
  const job = await Jobs.create({
    type,
    status : "pending",
    payload,
    priority,
    runAt : new Date(runAt),
    idempotencyKey,
    queueStatus :"not_queued",
    attempts : 0,
    error : null,
  });
  let queueJob;
  try{
   queueJob = await jobQueue.add(
    type,
    {
      mongoJobId : job._id.toString(),
    },{
      jobId : job._id.toString(),
      attempts : 3,
      backoff : {
        type : "exponential",
        delay : 2000,
      },
      priority,
      delay : delayMs,
    }
  );
}catch(queueError){
    await Jobs.findByIdAndUpdate(job._id,{
      queueStatus : "queue_failed",
      error : queueError.message,
    });
    return res.status(503).json({
      success : false,
      message : "Job was created but not Queued..",
      jobId : job._id,
    })
  }
  const updatedJob = await Jobs.findByIdAndUpdate(job._id,{
    queueStatus : "queued",
    queueJobId : queueJob.id,
  },
   {
    returnDocument : "after",
   });
   console.log("BullMQ priority:", queueJob.opts.priority);
  console.log("Queue JOb : ",queueJob.id);
  console.log(
  new Date().toLocaleTimeString(),
  "Queued job:",
  queueJob.id,
  "delay:",
  queueJob.opts.delay
);
   return res.status(201).json({
  success: true,
  message: "Job Created",
  job: updatedJob
});
}catch(error){
  if(error.code === 11000 && error.keyPattern?.idempotencyKey){
    const existingJob = await Jobs.findOne({
      idempotencyKey
    });
    return res.status(200).json({
      success : true,
      message : "Duplicate request.Existing Job returned.",
      job : existingJob,
    });
  }
  console.error("Internal Server Error",error.message);
  res.status(500).json({
    success : false,
    message : "Server Error.."
  })
}
});
app.post("/jobs/:id/requeue", async (req,res) => {
  try {
     const jobId = req.params.id;
     const job = await Jobs.findOneAndUpdate({
      _id : jobId,
      queueStatus : "queue_failed"
     },{
      queueStatus : "queueing"
     },
    {
      returnDocument : "after",
    });
     if(!job){
      return res.status(409).json({
        success : false,
        message : "Job can not be requued in its current state"
      });
     }
     let delayMs = 0;
     if(job.runAt){
      delayMs = Math.max(new Date(job.runAt).getTime() - Date.now(),0);
     }
     let queueJob;
     try{
       queueJob = await jobQueue.add(
        job.type,
        {
          mongoJobId : job._id.toString(),
        },
        {
          jobId : job._id.toString(),
          attempts : 3,
          backoff : {
            type : "exponential",
            delay : 2000
          },
          priority : job.priority,
          delay : delayMs
        }
       );
     }catch(queueError){
       await Jobs.findByIdAndUpdate(job._id,{
        queueStatus : "queue_failed",
        error : queueError.message,
       })
       return res.status(503).json({
        success : false,
        message : "Requeue Failed. Redis/queue may still unavailable"
       });
     }
     const updatedJob = await Jobs.findByIdAndUpdate(job.id,
    {
      queueStatus : "queued",
      queueJobId : queueJob._id,
      error : null,
      status : "pending",

    },
    {
      returnDocument : "after",
    }
  );
  return res.status(200).json({
    success : true,
    message : "Job requeued Successfully",
    job : updatedJob,
  })
  }catch(error){
    console.error("Queue Error:",error.message);
    res.status(500).json({
      success : false,
      message : "Internal Server Error"
    })
  }
});
app.post("/jobs/recover-failed", async(req,res) => {
  try {
    const result = await recoveryJob();
    res.status(200).json({
      success : true,
      ...result,
    })
  }catch(error){
    res.status(500).json({
      success : false,
      message : "Recovery Failed!"
    })
  }
})
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
app.get("/admin/job-stats", async (req,res) => {
  try{
  
    const [total,pending,processing,completed,failed] = await Promise.all(
      [
        Jobs.countDocuments(),
        Jobs.countDocuments({status : "pending"}),
        Jobs.countDocuments({status : "processing"}),
        Jobs.countDocuments({status : "completed"}),
        Jobs.countDocuments({status : "failed"})
      ]
    );
    const [queued,queueing,not_queued,queue_failed] = await Promise.all(
      [
        Jobs.countDocuments({queueStatus : "queued"}),
        Jobs.countDocuments({queueStatus : "queueing"}),
        Jobs.countDocuments({queueStatus : "not_queued"}),
        Jobs.countDocuments({queueStatus : "queue_failed"})
      ]
    );
    let bullJobCount = null;
    let queueHealth = "Healthy";
    try{
      bullJobCount = await jobQueue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
     )
    }catch(queueError){
      queueHealth = "Unavailable";
      console.log("BullMQ health check failed :",queueError.message);
    }
    return res.status(200).json({
      success : true,
      health : {
        queue : queueHealth,
      },
      jobs : {
        total,
        pending,
        processing,
        completed,
        failed
      },
      queue :{
        queued,
        not_queued,
        queueing,
        queue_failed
      },
      bullJobs : bullJobCount,
    })
  }catch(error){
    console.error("Getting Job Stats Error",error.message);
    res.status(500).json({
      success : false,
      message : "Internal Server Error"
    })
  }
})
app.get("/admin/failed-jobs",async (req,res) => {
  try {
    const failedJobs = await Jobs.find(
      {status : "failed"}
    ).sort({updatedAt : -1})
    .limit(20)
    .select("type status attempts error payload priority createdAt updatedAt")

    return res.status(200).json({
      success : true,
      count : failedJobs.length,
      Jobs : failedJobs,
    })
  }catch(error){
     console.error("Get failed Job Error:",error.message);
     res.status(500).json({
      success : false,
      message : "Internal Server Error"
     });
  }
})

//// GRACEFULL SHUTDOWN

const gracefulShutdown = async (signal) => {
   console.log(`{$signal} received . Shutting down gracefully`);
   try {
    if(recoveryInterval){
      clearInterval(recoveryInterval);
    }

    if(server){
      server.close();
    }
    await jobQueue.close();
    await mongoose.connection.close();

    console.log("Shutdown Completed");
    process.exit(0);
   }catch(error){
    console.error("Shutdown Error:",error.message);

    process.exit(1);
   }
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
})
process.on("SIGTERM",() => {
  gracefulShutdown("SIGTERM");
})