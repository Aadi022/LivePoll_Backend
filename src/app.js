const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
require("dotenv").config();
const { Server } = require("socket.io");
const { TeacherLogin } = require("./controllers/login");
const {
  createPoll,
  voteOnOption,
  getPolls,
} = require("../src/controllers/poll");
const StudentScore = require("./models/studentScore");

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

const DB = "mongodb+srv://aadityamta_db_user:aadi02@livepoll.q83aors.mongodb.net/";

mongoose
  .connect(DB)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((e) => {
    console.error("Failed to connect to MongoDB:", e);
  });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

let votes = {};
let connectedUsers = {};
let currentPoll = null;

// Function to update student score
const updateStudentScore = async (studentName, teacherUsername, isCorrect) => {
  try {
    const existingScore = await StudentScore.findOne({ 
      studentName, 
      teacherUsername 
    });

    if (existingScore) {
      existingScore.totalQuestions += 1;
      if (isCorrect) {
        existingScore.correctAnswers += 1;
      }
      existingScore.score = (existingScore.correctAnswers / existingScore.totalQuestions) * 100;
      existingScore.lastUpdated = new Date();
      await existingScore.save();
    } else {
      const newScore = new StudentScore({
        studentName,
        teacherUsername,
        totalQuestions: 1,
        correctAnswers: isCorrect ? 1 : 0,
        score: isCorrect ? 100 : 0
      });
      await newScore.save();
    }
  } catch (error) {
    console.error("Error updating student score:", error);
  }
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("createPoll", async (pollData) => {
    votes = {};
    currentPoll = await createPoll(pollData);
    io.emit("pollCreated", currentPoll);
  });

  socket.on("kickOut", (userToKick) => {
    for (let id in connectedUsers) {
      if (connectedUsers[id] === userToKick) {
        io.to(id).emit("kickedOut", { message: "You have been kicked out." });
        const userSocket = io.sockets.sockets.get(id);
        if (userSocket) {
          userSocket.disconnect(true);
        }
        delete connectedUsers[id];
        break;
      }
    }
    io.emit("participantsUpdate", Object.values(connectedUsers));
  });

  socket.on("joinChat", ({ username }) => {
    connectedUsers[socket.id] = username;
    io.emit("participantsUpdate", Object.values(connectedUsers));

    socket.on("disconnect", () => {
      delete connectedUsers[socket.id];
      io.emit("participantsUpdate", Object.values(connectedUsers));
    });
  });

  socket.on("studentLogin", (name) => {
    socket.emit("loginSuccess", { message: "Login successful", name });
  });

  socket.on("chatMessage", (message) => {
    io.emit("chatMessage", message);
  });

  socket.on("submitAnswer", async (answerData) => {
    votes[answerData.option] = (votes[answerData.option] || 0) + 1;
    voteOnOption(answerData.pollId, answerData.option);
    
    // Check if the answer is correct and update student score
    if (currentPoll) {
      const selectedOption = currentPoll.options.find(opt => opt.text === answerData.option);
      const isCorrect = selectedOption ? selectedOption.correct : false;
      await updateStudentScore(answerData.username, currentPoll.teacherUsername, isCorrect);
    }
    
    io.emit("pollResults", votes);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Polling System Backend");
});

app.post("/teacher-login", (req, res) => {
  TeacherLogin(req, res);
});

app.get("/polls/:teacherUsername", (req, res) => {
  getPolls(req, res);
});

app.get("/leaderboard/:teacherUsername", async (req, res) => {
  try {
    const { teacherUsername } = req.params;
    const leaderboard = await StudentScore.find({ teacherUsername })
      .sort({ score: -1, correctAnswers: -1 })
      .limit(10);
    res.status(200).json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});
