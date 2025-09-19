const mongoose = require("mongoose");

const studentScoreSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  teacherUsername: { type: String, required: true },
  totalQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  score: { type: Number, default: 0 }, // percentage
  lastUpdated: { type: Date, default: Date.now }
});

const StudentScore = mongoose.model("StudentScore", studentScoreSchema);

module.exports = StudentScore;
