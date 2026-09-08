const mongoose = require("mongoose");

require('dotenv').config();

const connectDB = async () => {
  try {
   await  mongoose.connect(`${process.env.MONGO_URI}`);
   console.log("Database Connected Successfully...")
  }catch(error){
    console.error("Db connection error :",error.message);
    process.exit(1);
  }
}

module.exports = connectDB