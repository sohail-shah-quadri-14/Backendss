import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Event from '../models/Event.js';
import UserEvent from '../models/UserEvents.js';

dotenv.config();

const quizRooms = new Map();

// Static questions for quiz
const staticQuestions = [
  {
    id: "q1",
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    answer: "Paris",
    timer: 10 // Updated timer to 30 seconds
  },
  {
    id: "q2",
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    answer: "Mars",
    timer: 10 // Updated timer to 30 seconds
  },
  {
    id: "q3",
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    answer: "4",
    timer: 10 // Updated timer to 30 seconds
  },
  {
    id: "q4",
    question: "Who wrote Romeo and Juliet?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    answer: "William Shakespeare",
    timer: 10 // Updated timer to 30 seconds
  }
];

export const initSocketIO = (io) => {
  io.use(async (socket, next) => {
    try {
      let token = null;

      // 1. Try to get token from query parameters (for React Native)
      if (socket.handshake.query && socket.handshake.query.token) {
        token = socket.handshake.query.token;
        console.log('Token found in query parameters');
      }

      // 2. Try to get token from auth header
      else if (socket.handshake.headers.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
          console.log('Token found in authorization header');
        }
      }

      // 3. Try to get token from cookies (for web browsers)
      else if (socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie;
        token = cookies
          .split(';')
          .map(c => c.trim().split('='))
          .find(([name]) => ['jwt', 'token', 'accessToken'].includes(name))?.[1];

        if (token) {
          console.log('Token found in cookies');
        }
      }

      if (!token) {
        console.log('No token found in request');
        return next(new Error('Authentication error: No token found in the socket'));
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      console.log('Token verified successfully');

      // Fetch user from database
      const user = await User.findByPk(decoded.id);
      if (!user) {
        console.log('User not found in database');
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user data to socket
      socket.userId = user.id;
      socket.role = user.Role.toLowerCase(); // Note: Changed from user.role to user.Role.toLowerCase()
      socket.userData = {
        id: user.id,
        name: `${user.FirstName} ${user.LastName}`,
        email: user.Email,
        role: user.Role
      };

      console.log(`User authenticated: ${user.Email} (${user.Role})`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error.message);
      next(new Error(`Authentication failed: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id} (User: ${socket.userId}, Role: ${socket.role})`);
    socket.emit('connected', { userId: socket.userId, role: socket.role });

    // Host creates and joins a quiz room
    socket.on('host-quiz', async ({ eventId }) => {
      try {
        // Verify user is a host
        if (socket.role !== 'host') {
          return socket.emit('error', { message: 'Only hosts can create quiz rooms' });
        }

        // Find the event
        const event = await Event.findByPk(eventId);
        if (!event) {
          return socket.emit('error', { message: 'Event not found' });
        }

        // Verify the user is the host of this event
        if (event.hostID !== socket.userId) {
          return socket.emit('error', { message: 'You can only host events you created' });
        }

        // Check if event is already completed
        if (event.status === 'Completed') {
          return socket.emit('error', { message: 'Cannot host a completed event' });
        }

        // Update event status to Ongoing
        await event.update({ status: 'Ongoing' });

        // Leave any previous quiz room
        if (socket.eventId) {
          socket.leave(`quiz-${socket.eventId}`);
        }

        // Join this quiz room
        socket.eventId = eventId;
        socket.join(`quiz-${eventId}`);

        // Create quiz room if it doesn't exist
        if (!quizRooms.has(eventId)) {
          quizRooms.set(eventId, {
            hostId: socket.userId,
            participants: new Set([socket.userId]), // Add host as first participant
            questions: [],
            currentQuestionIndex: -1,
            questionInProgress: false,
            answers: {},
            isActive: false
          });
        } else {
          // If room exists, update host and add to participants
          const existingRoom = quizRooms.get(eventId);
          existingRoom.hostId = socket.userId;
          existingRoom.participants.add(socket.userId);
        }

        // Get the room (now it definitely exists)
        const room = quizRooms.get(eventId);
        room.currentQuestionIndex = -1; // Start before first question
        room.isActive = true;

        // Assign static questions to the room
        room.questions = staticQuestions;

        // Notify the host
        socket.emit('quiz-hosted', {
          eventId,
          message: 'You are now hosting this quiz. Quiz is active!',
          status: 'Ongoing',
        });


        console.log(`Host ${socket.userId} created quiz room for event ${eventId}`);
      } catch (error) {
        console.error('Host quiz error:', error);
        socket.emit('error', { message: 'Failed to host quiz' });
      }
    });

    // Students join an existing quiz
    socket.on('join-live-quiz', async ({ eventId }) => {
      try {
        // Verify user is a student
        if (socket.role !== 'student') {
          return socket.emit('error', { message: 'This endpoint is for students only' });
        }

        // Find the event
        const event = await Event.findByPk(eventId);
        if (!event || event.status !== 'Ongoing') {
          return socket.emit('error', { message: 'Event is not currently active' });
        }

        // Verify student is registered
        const registration = await UserEvent.findOne({
          where: { userId: socket.userId, eventId, status: 'Registered' }
        });

        if (!registration) {
          return socket.emit('error', { message: 'You are not registered for this event' });
        }

        // Update registration status
        await registration.update({ status: 'Joined' });

        // Leave any previous quiz room
        if (socket.eventId) {
          socket.leave(`quiz-${socket.eventId}`);
        }

        // Join this quiz room
        socket.eventId = eventId;
        socket.join(`quiz-${eventId}`);

        // Get quiz room
        const room = quizRooms.get(eventId);
        if (!room) {
          return socket.emit('error', { message: 'Quiz room not found' });
        }

        // Add student to participants
        room.participants.add(socket.userId);

        // Notify the student
        socket.emit('joined-quiz', {
          eventId,
          participantCount: room.participants.size,
          message: 'You have joined the quiz'
        });

        // // Notify the host about new participant
        // io.to(`user-${room.hostId}`).emit('participant-joined', {
        //   userId: socket.userId,
        //   name: socket.userData?.name || 'Unknown User',
        //   participantCount: room.participants.size
        // });

        console.log(`Student ${socket.userId} joined quiz ${eventId}`);
      } catch (error) {
        console.error('Join quiz error:', error);
        socket.emit('error', { message: 'Failed to join quiz' });
      }
    });

    // Host sends the next question to all participants
    socket.on('next-question', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) {
          return socket.emit('error', { message: 'Unauthorized host' });
        }
        if (!room.isActive) {
          return socket.emit('error', { message: 'Quiz not active' });
        }
        if (room.questionInProgress) {
          return socket.emit('error', { message: 'A question is already in progress' });
        }
    
        room.currentQuestionIndex++;
        const isLastQuestion = room.currentQuestionIndex === room.questions.length - 1;
        if (room.currentQuestionIndex >= room.questions.length) {
          room.isActive = false;
          io.to(`quiz-${eventId}`).emit('quiz-ended', { message: 'Quiz completed!' });
          await Event.update({ status: 'Completed' }, { where: { id: eventId } });
          return;
        }
    
        const question = room.questions[room.currentQuestionIndex];
        room.questionInProgress = true;
        room.answers = {};
    
        // Send question to all participants including the host
        io.to(`quiz-${eventId}`).emit('new-question', {
          questionId: question.id,
          questionText: question.question,
          options: question.options,
          timer: 10, // Timer in seconds
          questionNumber: room.currentQuestionIndex + 1,
          totalQuestions: room.questions.length,
          isLastQuestion
        });
    
        setTimeout(() => {
          if (room.questionInProgress && room.isActive) {
            endQuestion(io, eventId, room, question);
          }
        }, 11000); // Reduced timer to 30 seconds
    
        console.log(`Question ${room.currentQuestionIndex + 1} sent for quiz ${eventId}`);
      } catch (error) {
        console.error('Next question error:', error);
        socket.emit('error', { message: 'Failed to send next question' });
      }
    });

    socket.on('show-results', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) {
          return socket.emit('error', { message: 'Unauthorized host' });
        }
    
        if (room.isActive) {
          return socket.emit('error', { message: 'Quiz is still active. End the quiz to show results.' });
        }
    
        // Calculate leaderboard
        const leaderboard = [];
        for (const [userId, userAnswers] of Object.entries(room.answers)) {
          const userResult = {
            userId,
            name: room.participants.has(userId) ? socket.userData?.name || 'Unknown User' : 'Unknown User',
            totalPoints: 0, // Total points scored
            questions: []
          };
    
          for (const question of room.questions) {
            const userAnswer = userAnswers[question.id];
            if (userAnswer) {
              const isCorrect = userAnswer.answer === question.answer;
              userResult.questions.push({
                questionId: question.id,
                questionText: question.question,
                isCorrect,
                answer: userAnswer.answer,
                correctAnswer: question.answer
              });
    
              if (isCorrect) {
                userResult.totalPoints += 10; // Award 10 points for correct answers
              }
            }
          }
    
          leaderboard.push(userResult);
        }
    
        // Sort leaderboard by total points (descending)
        leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
    
        // Log the result to the console
        const result = {
          eventId,
          leaderboard,
          message: 'Quiz results are now available!'
        };
        console.log('Quiz Results:', JSON.stringify(result, null, 2)); // Pretty print the result
    
        // Send leaderboard to all participants
        socket.to(`quiz-${eventId}`).emit('quiz-results', result);
    
        console.log(`Results sent for quiz ${eventId}`);
      } catch (error) {
        console.error('Show results error:', error);
        socket.emit('error', { message: 'Failed to show results' });
      }
    });

    socket.on('end-quiz', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) {
          return socket.emit('error', { message: 'Unauthorized host' });
        }

        room.isActive = false;
        io.to(`quiz-${eventId}`).emit('quiz-ended', { message: 'Quiz ended!' });

        await Event.update({ status: 'Completed' }, { where: { id: eventId } });

        console.log(`Quiz ${eventId} ended by host ${socket.userId}`);
      } catch (error) {
        console.error('End quiz error:', error);
        socket.emit('error', { message: 'Failed to end quiz' });
      }
    });



    socket.on('submit-answer', async ({ eventId, questionId, answer }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || !room.isActive || !room.questionInProgress) {
          return socket.emit('error', { message: 'Cannot submit answer now' });
        }

        const timestamp = Date.now();
        room.answers[socket.userId] = { answer, timestamp };

        socket.emit('answer-received', { questionId });


        io.to(`quiz-${eventId}`).emit('answer-submitted', {
          userId: socket.userId,
          questionId
        });

        console.log(`Answer received from ${socket.userId} for question ${questionId} in quiz ${eventId}`);
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
      if (socket.eventId) {
        const room = quizRooms.get(socket.eventId);
        if (room) {
          room.participants.delete(socket.userId);
          io.to(`quiz-${socket.eventId}`).emit('participant-left', { userId: socket.userId, participantCount: room.participants.size });
        }
      }
    });
  });

  return io;
};

// Helper function to end a question and show results
function endQuestion(io, eventId, room, question) {
  room.questionInProgress = false;

  // Calculate results
  const results = {
    totalAnswers: Object.keys(room.answers).length,
    correctCount: 0,
    incorrectCount: 0,
    userResults: {}
  };

  for (const [userId, data] of Object.entries(room.answers)) {
    const isCorrect = data.answer === question.answer;
    results.userResults[userId] = {
      isCorrect,
      points: isCorrect ? 10 : 0
    };

    if (isCorrect) {
      results.correctCount++;
    } else {
      results.incorrectCount++;
    }
  }
}
