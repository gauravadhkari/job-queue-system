const config = require('../config/env');
const Jobs = require("../models/job");
const jobQueue = require("../queue/jobQueue");

const recoveryJob = async () => {
    const STALE_QUEUEING_TIME = config.recovery.staleQueueing || 60000;
    const staleBefore = new Date(Date.now() - STALE_QUEUEING_TIME);
    const staleJobs = await Jobs.find({
      queueStatus : "queueing",
      queueingAt : {
        $lte : staleBefore
      }
    })
    for(const staleJob of staleJobs){
      if(staleJob.status === "processing" ||
        staleJob.status === "failed"  ||
        staleJob.status === "completed"
      ){
        await Jobs.findByIdAndUpdate(staleJob._id,{
          queueStatus : "queued",
          queueingAt : null
        });
        continue;
      }
      const bullJob = await jobQueue.getJob(
        staleJob._id.toString()
      )
      if(bullJob){
        const bullState = await bullJob.getState();
        console.log("Recovered Stale Job :",staleJob._id.toString(),
        "BullMQ state :",bullState);
        await Jobs.findByIdAndUpdate(staleJob._id,{
          queueStatus : "queued",
          queueJobId : bullJob.id,
          queueingAt : null,
          error : null,
        })
        continue;
      }
      await Jobs.findByIdAndUpdate(staleJob._id,{
        queueStatus : "queue_failed",
        queueingAt : null,
        error : "Stale queueing Job was not Found in BUllMQ!"
      })
    }
    const failedJobs = await Jobs.find({
      queueStatus : "queue_failed"
    }).limit(20);

    console.log("Failed jobs found :",failedJobs.length);
    let recovered = 0;
    let skipped = 0;
    let failed = 0;
    for(const failedJob of failedJobs){
      const job = await Jobs.findOneAndUpdate({
        _id : failedJob._id,
        queueStatus : "queue_failed"
      },
    {
      queueStatus : "queueing",
      queueingAt : new Date(),
    },{
      returnDocument : "after"
    });
    if(!job){
      skipped++;
      continue;
    }
    let delayMs = 0;
     if(job.runAt){
      delayMs = Math.max(new Date(job.runAt).getTime() - Date.now(),0);
     }
     try{
      const queueJob = await jobQueue.add(job.type,
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
          delay : delayMs,
        }
      );
      await Jobs.findByIdAndUpdate(job.id,{
        queueStatus : "queued",
        queueJobId : queueJob.id,
        queueingAt : null,
        error : null,
        status : "pending"
      })
      recovered++;
     }catch(queueError){
      await Jobs.findByIdAndUpdate(job.id,{
        queueStatus : "queue_failed",
        queueingAt : null,
        error : "Redis queue unavailable",
      })
      failed++;
     }
    }
    return {
      count : failedJobs.length,
      recovered : recovered,
      skipped : skipped,
      failed : failed,
    }
  
}

module.exports = recoveryJob;