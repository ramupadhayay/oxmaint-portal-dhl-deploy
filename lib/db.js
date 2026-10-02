import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI

let cached = global.mongoose
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export default async function dbConnect() {
  if (!MONGO_URI) {
    throw new Error('Please define MONGO_URI in .env.local')
  }
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URI)
      .then((m) => {
        const dbName = m.connection.db.databaseName
        console.log(`[INFO] Connected to MongoDB - ${dbName} database`)
        return m
      })
      // Forget a failed attempt, or it is the answer forever.
      //
      // The promise is cached so concurrent requests share one connect. A
      // rejected one was cached the same way, so a single failure — the Atlas
      // SRV lookup timing out on a flaky router, which is what happened — left
      // every later request awaiting the same rejection in milliseconds, with
      // no retry, until the process was restarted. Every sign-in and every
      // record write failed with "Server error" on a database that was fine.
      .catch((err) => {
        cached.promise = null
        console.error(`[ERROR] MongoDB connect failed, will retry on the next request: ${err.message}`)
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
