const mongoose = require("mongoose");
const config = require("./env");


const connectDB = async () => {
  try {
   await  mongoose.connect(`${config.mongo.uri}`);
   console.log("Database Connected Successfully...")
  }catch(error){
    console.error("Db connection error :",error.message);
    process.exit(1);
  }
}

module.exports = connectDB