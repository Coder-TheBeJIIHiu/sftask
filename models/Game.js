const mongoose = require('mongoose')
const randomCode = require('../utils/randomCode')
// Define the schema
const gameSchema = new mongoose.Schema({
  started: { type: Boolean, default: true }, // Indicates if the process has started; defaults to true
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], // An array of user IDs referencing the User model
  completed: { type: Boolean, default: false }, // Indicates if the process is completed; defaults to false
  startTime: { type: Date, default: Date.now }, // The time when the process started; defaults to now
  task: { type: String, requried: true },
  code: { type: String, default: randomCode() }
})
// Export the model
module.exports = mongoose.model('Game', gameSchema)