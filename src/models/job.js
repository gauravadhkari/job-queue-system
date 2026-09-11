const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  type : {
    type : String
  },
  status : {
    type : String,
  },
  payload : {
    type : Object,
  },
  attempts : {
    type : Number,
  },
  error : {
    type : String,
  },
  completedAt : {
    type : Date,
    default : null,
  },
  priority : {
    type : Number,
    default : 5,
  },
  runAt : {
    type : Date,
    default : null,
  }
},
{
  timestamps : true
});

const Jobs = mongoose.model("Jobs",jobSchema);
module.exports = Jobs