import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Event from '../models/Event.js';
import UserEvent from '../models/UserEvents.js';
import Question from '../models/Question.js';

dotenv.config();

// Store active quiz rooms
const quizRooms = new Map(); //Each event (quiz) has a room ID stored in quizRooms.
//set and get are the methods to store and retrieve data from the quizRooms.

const participantData = new Map();

// Initialize Socket.io server
export const initSocketIO = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      // Get cookies from handshake
      const cookies = socket.handshake.headers.cookie;
      
      if (!cookies) {
        return next(new Error('Authentication error: No cookies found'));
      }
      
      // Parse cookies to get the JWT token
      const cookieArr = cookies.split(';');
      let token = null;
      
      // Find the JWT token cookie
      for (const cookie of cookieArr) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'jwt' || name === 'token' || name === 'authToken') {
          token = value;
          break;
        }
      }
      
      if (!token) {
        return next(new Error('Authentication error: Auth cookie not found'));
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      
      // Get user from database
      const user = await User.findByPk(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Set socket data
      socket.userId = user.id;
      socket.role = user.Role.toLowerCase();
      socket.userData = {
        id: user.id,
        name: user.FullName,
        email: user.Email,
        role: user.Role
      };
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });
  
  // Handle connections
  io.on('connection', (socket) => {
    console.log(`New socket connection: ${socket.id} (User: ${socket.userId}, Role: ${socket.role})`);
    
    // Send authentication confirmation
    socket.emit('authenticated', {
      userId: socket.userId,
      role: socket.role
    });
    
    
    // Handle joining a quiz room
    socket.on('join-quiz', async (data) => {
      try {
        const { eventId } = data;
        
        // Get event from database
        const event = await Event.findByPk(eventId);
        if (!event) {
          return socket.emit('error', { message: 'Event not found' });
        }
        
        // Check if event is ongoing
        if (event.status !== 'Ongoing') {
          return socket.emit('error', { message: 'Event is not ongoing' });
        }
        
        // Check if user is registered for this event (students only)
        if (socket.role === 'student') {
          const registration = await UserEvent.findOne({
            where: {
              userId: socket.userId,
              eventId: eventId,
              status: 'Registered'
            }
          });
          
          if (!registration) {
            return socket.emit('error', { message: 'You are not registered for this event' });
          }
          
          // Update status to Joined
          await registration.update({ status: 'Joined' });
        }
        
        // Leave any previous rooms
        if (socket.eventId) {
          socket.leave(`quiz-${socket.eventId}`);
        }
        
        // Set event ID and join room
        socket.eventId = eventId;
        socket.join(`quiz-${eventId}`); // It joins or creates a room for the user, but it doesn't store the quiz host, questions, and participants etc etc details for tracking.
        
        // Create quiz room object , if it doesn't exist
        if (!quizRooms.has(eventId)) {  //It stores the quiz host, questions, and participants and many more for tracking..
          quizRooms.set(eventId, {
            hostId: event.hostID,
            participants: new Set(),
            currentQuestion: null,
            questions: [],
            startTime: null,
            endTime: null,
            currentQuestionIndex: -1,
            questionInProgress: false,
            answers: {},
            isActive: false
          });
        }
        
        const room = quizRooms.get(eventId); //It retrieves the quiz room object for the given event.Now, we can modify the room (add participants, set questions, etc.).
        
        // Add user to room participants or validate host
        if (socket.role === 'host') {
          if (socket.userId !== room.hostId) {
            socket.leave(`quiz-${eventId}`);
            return socket.emit('error', { message: 'You are not the host of this event' });
          }
        } else {
          // Add student to participants
          room.participants.add(socket.userId);
        }
        
        // Send join confirmation
        socket.emit('joined-quiz', {
          eventId: eventId,
          participantCount: room.participants.size
        });
        
       
        
        console.log(`User ${socket.userId} joined quiz ${eventId}`);
      } catch (error) {
        console.error('Join quiz error:', error);
        socket.emit('error', { message: 'Failed to join quiz' });
      }
    });
    
    // Handle starting a quiz (host only)
    socket.on('start-quiz', async (data) => {
      try {
        const { eventId } = data;
        
        // Get random questions
        const questions = await Question.getRandomQuestions(50); // Get 50 random questions

        // Store in quiz room
        quizRooms.set(eventId, {
          questions: questions,
          currentQuestionIndex: -1,
          answers: {},
          isActive: false
        });

        // Send questions to host for selection
        socket.emit('questions-for-selection', {
          questions: questions.map(q => ({
            id: q._id,
            question: q.question,
            options: q.options
          }))
        });

      } catch (error) {
        console.error('Error starting quiz:', error);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });
    
    // Handle host selecting questions
    socket.on('submit-selected-questions', async (data) => {
      try {
        const { eventId, selectedQuestionIds } = data;
        const room = quizRooms.get(eventId);

        // Filter only selected questions
        room.questions = room.questions.filter(q => 
          selectedQuestionIds.includes(q._id.toString())
        );

        // Start the quiz
        room.isActive = true;
        room.currentQuestionIndex = 0;

        // Send first question to all participants
        sendNextQuestion(eventId);

      } catch (error) {
        console.error('Error with question selection:', error);
        socket.emit('error', { message: 'Failed to start quiz with selected questions' });
      }
    });
    
    // Function to send next question
    function sendNextQuestion(eventId) {
      const room = quizRooms.get(eventId);
      if (!room || !room.isActive) return;

      const currentQuestion = room.questions[room.currentQuestionIndex];
      
      // Send question to all participants
      io.to(eventId).emit('new-question', {
        questionId: currentQuestion._id,
        question: currentQuestion.question,
        options: currentQuestion.options,
        questionNumber: room.currentQuestionIndex + 1,
        totalQuestions: room.questions.length
      });

      // Set timer for 10 seconds
      setTimeout(() => {
        endCurrentQuestion(eventId);
      }, 10000); // 10 seconds
    }

    // Function to end current question
    function endCurrentQuestion(eventId) {
      const room = quizRooms.get(eventId);
      if (!room || !room.isActive) return;

      const currentQuestion = room.questions[room.currentQuestionIndex];

      // Calculate results for this question
      const results = {
        questionId: currentQuestion._id,
        correctAnswer: currentQuestion.correctAnswer,
        answers: room.answers[currentQuestion._id] || {}
      };

      // Send results to all participants
      io.to(eventId).emit('question-ended', results);

      // Clear answers for this question
      room.answers[currentQuestion._id] = {};

      // Move to next question after 3 seconds
      setTimeout(() => {
        room.currentQuestionIndex++;
        
        // Check if quiz is finished
        if (room.currentQuestionIndex >= room.questions.length) {
          endQuiz(eventId);
        } else {
          sendNextQuestion(eventId);
        }
      }, 3000); // 3 second delay between questions
    }
    
    // Handle answer submission (student only)
    socket.on('submit-answer', async (data) => {
      try {
        const { questionId, answer } = data;
        
        // Check if user is a student
        if (socket.role !== 'student') {
          return socket.emit('error', { message: 'Only students can submit answers' });
        }
        
        // Check if user is in a quiz
        if (!socket.eventId || !quizRooms.has(socket.eventId)) {
          return socket.emit('error', { message: 'Not currently in a quiz' });
        }
        
        const room = quizRooms.get(socket.eventId);
        
        // Check if this question is current
        if (!room.currentQuestion || room.currentQuestion.id != questionId) {
          return socket.emit('error', { message: 'This question is not currently active' });
        }
        
        // Check if question is still in progress
        if (!room.questionInProgress) {
          return socket.emit('error', { message: 'Time is up for this question' });
        }
        
        // Save the answer
        if (!participantData.has(socket.userId)) {
          participantData.set(socket.userId, {
            eventId: socket.eventId,
            score: 0,
            answers: new Map()
          });
        }
        
        const userData = participantData.get(socket.userId);
        userData.answers.set(questionId, answer);
        
        // Send confirmation to student
        socket.emit('answer-received', {
          questionId: questionId
        });
        
        // Notify host about the submission (without revealing the answer)
        socket.to(`quiz-${socket.eventId}`).emit('answer-submitted', {
          participantId: socket.userId,
          participantName: socket.userData.name,
          questionId: questionId
        });
        
        console.log(`User ${socket.userId} submitted answer for question ${questionId}`);
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });
    
    // Handle ending a quiz (host only)
    socket.on('end-quiz', async (data) => {
      try {
        const { eventId } = data;
        
        // Check if user is host
        if (socket.role !== 'host') {
          return socket.emit('error', { message: 'Only hosts can end a quiz' });
        }
        
        // Get quiz room
        if (!quizRooms.has(eventId)) {
          return socket.emit('error', { message: 'Quiz room not found' });
        }
        
        const room = quizRooms.get(eventId);
        
        // Check if user is the host of this event
        if (room.hostId !== socket.userId) {
          return socket.emit('error', { message: 'You are not the host of this event' });
        }
        
        // End any question in progress
        if (room.questionInProgress) {
          await endCurrentQuestion(eventId);
        }
        
        // Set end time
        room.endTime = new Date();
        
        // Calculate final scores and rankings
        const finalScores = [];
        room.participants.forEach(participantId => {
          const userData = participantData.get(participantId);
          if (userData) {
            // Find user details
            const userSocket = Array.from(io.sockets.sockets.values())
              .find(s => s.userId === participantId);
            
            const userName = userSocket ? userSocket.userData.name : 'Unknown User';
            
            finalScores.push({
              participantId,
              participantName: userName,
              score: userData.score,
              totalAnswered: userData.answers.size,
              correctAnswers: Array.from(userData.answers.entries())
                .filter(([qId, answer]) => {
                  const question = room.questions.find(q => q.id == qId);
                  return question && answer === question.correctAnswer;
                }).length
            });
          }
        });
        
        // Sort by score (highest first)
        finalScores.sort((a, b) => b.score - a.score);
        
        // Calculate rankings
        for (let i = 0; i < finalScores.length; i++) {
          finalScores[i].rank = i + 1;
        }
        
        // Send final results to host
        socket.emit('quiz-ended', {
          results: finalScores,
          totalQuestions: room.questions.length,
          startTime: room.startTime,
          endTime: room.endTime
        });
        
        // Send final results to each participant
        finalScores.forEach(score => {
          const participantSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === score.participantId);
          
          if (participantSocket) {
            participantSocket.emit('quiz-ended', {
              yourScore: score.score,
              yourRank: score.rank,
              totalParticipants: room.participants.size,
              correctAnswers: score.correctAnswers,
              totalQuestions: room.questions.length,
              topScores: finalScores.slice(0, 3) // Top 3 scores
            });
          }
        });
        
        // Update event status to Completed
        try {
          const event = await Event.findByPk(eventId);
          if (event) {
            await event.update({ status: 'Completed' });
          }
        } catch (error) {
          console.error('Failed to update event status:', error);
        }
        
        // Clean up
        if (room.questionTimer) {
          clearTimeout(room.questionTimer);
          room.questionTimer = null;
        }
        
        // Keep room data for history
        console.log(`Quiz ${eventId} ended by host ${socket.userId}`);
      } catch (error) {
        console.error('End quiz error:', error);
        socket.emit('error', { message: 'Failed to end quiz' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
      
      // Handle quiz room cleanup if user was in a room
      if (socket.eventId) {
        const room = quizRooms.get(socket.eventId);
        if (room) {
          if (socket.role === 'host') {
            // Notify participants that host disconnected
            socket.to(`quiz-${socket.eventId}`).emit('host-disconnected', {
              message: 'The host has disconnected'
            });
          } else if (socket.role === 'student') {
            // Remove from participants
            room.participants.delete(socket.userId);
            
            // Notify host about participant leaving
            socket.to(`quiz-${socket.eventId}`).emit('participant-left', {
              userId: socket.userId,
              participantCount: room.participants.size
            });
          }
        }
      }
    });
  });
  
  return io;
};

// Helper function to end the current question and show results
async function endCurrentQuestion(io, eventId) {
  const room = quizRooms.get(eventId);
  if (!room || !room.questionInProgress) return;
  
  // Clear the timer if it exists
  if (room.questionTimer) {
    clearTimeout(room.questionTimer);
    room.questionTimer = null;
  }
  
  room.questionInProgress = false;
  const currentQuestion = room.currentQuestion;
  
  // Calculate scores and prepare results
  const results = {
    questionId: currentQuestion.id,
    correctAnswer: currentQuestion.correctAnswer,
    participantAnswers: []
  };
  
  // Process all participant answers for this question
  room.participants.forEach(participantId => {
    const userData = participantData.get(participantId);
    if (userData) {
      const answer = userData.answers.get(currentQuestion.id);
      let isCorrect = false;
      
      // If participant answered
      if (answer) {
        isCorrect = answer === currentQuestion.correctAnswer;
        // Add points if correct
        if (isCorrect) {
          userData.score += currentQuestion.points;
        }
      }
      
      // Find user details
      const userSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === participantId);
      
      const userName = userSocket ? userSocket.userData.name : 'Unknown User';
      
      // Add to results
      results.participantAnswers.push({
        participantId,
        participantName: userName,
        answer: answer || 'No answer',
        isCorrect,
        score: userData.score
      });
    }
  });
  
  // Send results to everyone in the room
  const sockets = await io.in(`quiz-${eventId}`).fetchSockets();
  
  for (const socket of sockets) {
    if (socket.role === 'host') {
      // Host gets full results
      socket.emit('question-ended', { results });
    } else {
      // Students get only their own result
      const participantResult = results.participantAnswers.find(r => r.participantId === socket.userId);
      
      socket.emit('question-ended', {
        yourAnswer: participantResult?.answer || 'No answer',
        correctAnswer: currentQuestion.correctAnswer,
        isCorrect: participantResult?.isCorrect || false,
        yourScore: participantResult?.score || 0
      });
    }
  }
  
  console.log(`Question ${room.currentQuestionIndex + 1} ended for quiz ${eventId}`);
} 