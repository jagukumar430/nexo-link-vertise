const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user_id: {
    type: Number,
    required: true,
    index: true
  },
  bot_username: {
    type: String,
    required: true,
    trim: true
  },
  used: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL Index: Automatically delete documents after 15 minutes (900 seconds)
tokenSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 900,
  name: 'token_ttl_index'
});

// Compound index for efficient queries
tokenSchema.index({ token: 1, used: 1, createdAt: 1 });

// Pre-save middleware for additional validation
tokenSchema.pre('save', function(next) {
  if (!this.token || this.token.length < 32) {
    return next(new Error('Invalid token length'));
  }
  next();
});

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
