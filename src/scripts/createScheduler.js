const jobQueue = require("../queue/jobQueue");

const createScheduler = async () => {
  try {
     await jobQueue.upsertJobScheduler(
      "test-scheduler",
      {
        pattern : "*/10 * * * * *",//second minute hour day-of-month month day-of-week
      },
      {
        name : "scheduled_test",
        data : {
          message : "Every 2 minutes"
        }
      }
     );
     console.log("Scheduled Created");
     const schedulers = await jobQueue.getJobSchedulers();
     console.log(schedulers);
     await jobQueue.close();
  }catch(error){
    console.error("Scheduled Error",error.message);
  }
};

createScheduler();