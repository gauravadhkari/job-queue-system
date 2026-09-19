# BACKGROUND JOB PROCESSING SYSTEM

A reliable background job processing system built with **Node.js, Express, MongoDB, Redis, and BullMQ**.

The system accepts jobs through an API, stores their state in MongoDB, queues them using BullMQ and Redis, and processes them asynchronously using a separate worker process.

It also handles retries, failures, delayed jobs, priorities, idempotency, Redis outages, automatic recovery, stale-job reconciliation, monitoring, and graceful shutdown.

---

## Architecture

`                   Client
                      |
                      v
                 Express API
                      |
                      v
                   MongoDB
              Store Job Record
                      |
                      v
                 BullMQ Queue
                      |
                      v
                    Redis
                      |
                      v
                 BullMQ Worker
                      |
                      v
             Background Processing
                      |
                      v
                   MongoDB
              Update Job Status

---           
# Recovery Flow

Redis unavailable
       |
       v
queue_failed
       |
       v
Recovery Runner
       |
       v
queueing
       |
       v
BullMQ enqueue
   /         \
success     failure
   |           |
   v           v
queued     queue_failed


# Stale Job Reconciliation

MongoDB says:
queueStatus = queueing
        |
        v
Check BullMQ using deterministic jobId
        |
     +--+--+
     |     |
  exists  missing
     |     |
     v     v
 repair   queue_failed
 Mongo        |
              v
          retry later

# Features

>Background job processing with BullMQ
>Redis-backed job queue
>MongoDB job-state persistence
>Separate API and worker processes
>Automatic retries
>Exponential backoff
>Job priority
>Worker concurrency
>Delayed jobs
>Scheduled/recurring job support
>Job idempotency
>Duplicate-request protection
>Queue failure tracking
>Automatic recovery after Redis outages
>Batch failed-job recovery
>Atomic recovery claiming
>Stale queueing job detection
>MongoDB/BullMQ state reconciliation
>Deterministic BullMQ job IDs
>Job monitoring APIs
>Failed-job inspection
>API, MongoDB and Redis health checks
>Graceful API shutdown
>Graceful worker shutdown
>Pending database-operation tracking
>Centralized environment configuration

# Tech Stack

Backend: Node.js, Express.js
Database: MongoDB + Mongoose
Queue: BullMQ
Queue Storage: Redis
Redis Client: ioredis
Development: Nodemon
Containerization: Docker for Redis

# Job LifeCycle

# If Normal Job moves through:

pending
   |
   v
queued
   |
   v
processing
   |
   v
completed

# If Process Fails :


processing
    |
    v
retrying
    |
    v
processing
    |
    +------> completed

or after max attempts:

processing
    |
    v
failed Permanently

# Queue admission is tracked Separately

not_queued
    |
    v
queueing
   /   \
  v     v
queued  queue_failed


This separates:

>whether the job successfully entered BullMQ
>whether the worker successfully processed the job