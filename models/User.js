const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  tgId: {
    type: Number,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    required: true
  },
  course: {
    type: Number,
    required: true
  },
  joins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  exp: {
    type: Number,
    default: 0
  },
  gameList: {
    isActive: {
      type: Boolean,
      default: false // Указывает, играет ли пользователь в игру
    },
    gameList: [{
      gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    }]
  }
})

const User = mongoose.model('User', userSchema)

module.exports = User