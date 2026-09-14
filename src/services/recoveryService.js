const Jobs = require("../models/job");
const jobQueue = require("../queue/jobQueue");

const recoveryJob = async () => {
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
      queueStatus : "queueing"
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
        error : null,
        status : "pending"
      })
      recovered++;
     }catch(queueError){
      await Jobs.findByIdAndUpdate(job.id,{
        queueStatus : "queue_failed",
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