const jobQueue = require("../queue/jobQueue");

const removeScheduler = async () => {
  const removed  = await jobQueue.removeJobScheduler("test-scheduler");

  console.log("Scheduled removed :",removed);
  process.exit(0);
};

removeScheduler();