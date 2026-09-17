require('dotenv').config();
const config = {
  port : Number(process.env.PORT) || 3001,
  mongo :{
  uri : process.env.MONGO_URI,
  },
  redis :{
  host : process.env.REDIS_HOST || "127.0.0.1",
  port : Number(process.env.REDIS_PORT) || 6379,
  connectTimeout : Number(process.env.REDIS_CONNECT_TIMEOUT),
  },
  recovery : {
  interval : Number(process.env.RECOVERY_INTERVAL_MS),
  staleQueueing : Number(process.env.STALE_QUEUEING_TIME_MS)
  }
}

module.exports = config;