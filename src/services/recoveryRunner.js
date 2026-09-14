const recoveryJob = require("./recoveryService");
let isRecovering = false;
const startRecoveryRunner = async () => {
  setInterval( async () => {
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
  },10000)
}

module.exports = startRecoveryRunner;