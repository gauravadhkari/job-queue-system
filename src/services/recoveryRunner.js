const config = require('../config/env');
const recoveryJob = require("./recoveryService");
let isRecovering = false;
const RECOVERY_INTERVAL = config.recovery.interval || 30000;
const startRecoveryRunner = async () => {
  const interval = setInterval( async () => {
    if(isRecovering){
      console.log("Recovery Already Running, skipping");
      return;
    }

    isRecovering = true;
  try{
     console.log("Checking for queue Failed..");

     const result = await recoveryJob();
     console.log("Recovered Jobs:",result);
  }catch(error){
     console.error("Automatic recovery failed:",error.message);
  }finally{
    isRecovering = false;
  }
  },RECOVERY_INTERVAL);
  return interval;
}

module.exports = startRecoveryRunner;