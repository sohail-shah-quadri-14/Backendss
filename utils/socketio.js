import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import User from '../models/User.js';
import Event from '../models/Event.js';
import UserEvent from '../models/UserEvents.js';
import Question from '../models/Question.js';

dotenv.config();

const quizRooms = new Map(); // Tracks active quiz rooms.
const participantData = new Map();

// Static questions for now
const staticQuestions = [
  { id: 1, question: 'What is the capital of France?', options: ['Paris', 'London', 'Berlin', 'Madrid'], answer: 'Paris' },
  { id: 2, question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answer: '4' },
  { id: 3, question: 'What is the largest planet in our solar system?', options: ['Earth', 'Mars', 'Jupiter', 'Venus'], answer: 'Jupiter' },
  { id: 4, question: 'What is the chemical symbol for water?', options: ['H2O', 'CO2', 'O2', 'N2'], answer: 'H2O' }
];

export const initSocketIO = (io) => {
  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) return next(new Error('Authentication error: No cookies found'));

      const token = cookies.split(';').map(c => c.trim().split('=')).find(([name]) => ['jwt', 'token', 'authToken'].includes(name))?.[1];
      if (!token) return next(new Error('Authentication error: Auth cookie not found'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const user = await User.findByPk(decoded.id);
      if (!user) return next(new Error('Authentication error: User not found'));

      socket.userId = user.id;
      socket.role = user.Role.toLowerCase();
      socket.userData = { id: user.id, name: user.FullName, email: user.Email, role: user.Role };

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id} (User: ${socket.userId})`);
    socket.emit('connected', { userId: socket.userId, role: socket.role });

    socket.on('join-live-quiz', async ({ eventId }) => {
      try {
        const event = await Event.findByPk(eventId);
        if (!event || event.status !== 'Ongoing') return socket.emit('error', { message: 'Invalid event' });

        if (socket.role === 'student') {
          const registration = await UserEvent.findOne({ where: { userId: socket.userId, eventId, status: 'Registered' } });
          if (!registration) return socket.emit('error', { message: 'Not registered for this event' });
          await registration.update({ status: 'Joined' });
        }

        if (socket.eventId) socket.leave(`quiz-${socket.eventId}`);
        socket.eventId = eventId;
        socket.join(`quiz-${eventId}`);

        if (!quizRooms.has(eventId)) {
          quizRooms.set(eventId, {
            hostId: event.hostID,
            participants: new Set(),
            questions: [],
            currentQuestionIndex: -1,
            questionInProgress: false,
            answers: {},
            isActive: false
          });
        }

        const room = quizRooms.get(eventId);
        if (socket.role === 'host' && socket.userId !== room.hostId) {
          socket.leave(`quiz-${eventId}`);
          return socket.emit('error', { message: 'Unauthorized host' });
        }
        room.participants.add(socket.userId);

        socket.emit('joined-quiz', { eventId, participantCount: room.participants.size });
        console.log(`User ${socket.userId} joined quiz ${eventId}`);
      } catch (error) {
        console.error('Join quiz error:', error);
        socket.emit('error', { message: 'Failed to join quiz' });
      }
    });

    socket.on('start-quiz', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) return socket.emit('error', { message: 'Unauthorized host' });

        // Use static questions instead of database query
        room.questions = staticQuestions;
        room.currentQuestionIndex = -1; // Start before first question
        room.isActive = true;

        io.to(`quiz-${eventId}`).emit('quiz-started', {
          message: 'Quiz started!',
          totalQuestions: room.questions.length
        });
        console.log(`Quiz ${eventId} started by host ${socket.userId}`);
      } catch (error) {
        console.error('Start quiz error:', error);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    socket.on('end-quiz', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) return socket.emit('error', { message: 'Unauthorized host' });

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

        // Record the answer with timestamp
        const timestamp = Date.now();
        room.answers[socket.userId] = { answer, timestamp };

        // Acknowledge receipt of answer
        socket.emit('answer-received', { questionId });

        // Notify host about the new answer (optional)
        socket.to(`user-${room.hostId}`).emit('answer-submitted', {
          userId: socket.userId,
          name: socket.userData?.name || 'Unknown User',
          questionId: questionId
        });

        console.log(`Answer received from ${socket.userId} for question ${questionId} in quiz ${eventId}`);
      } catch (error) {
        console.error('Submit answer error:', error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    socket.on('end-current-question', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) return socket.emit('error', { message: 'Unauthorized host' });
        if (!room.isActive || !room.questionInProgress) return socket.emit('error', { message: 'No question in progress' });

        const question = room.questions[room.currentQuestionIndex];
        endQuestion(io, eventId, room, question);

        console.log(`Question ${room.currentQuestionIndex + 1} manually ended by host ${socket.userId}`);
      } catch (error) {
        console.error('End question error:', error);
        socket.emit('error', { message: 'Failed to end question' });
      }
    });

    socket.on('next-question', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) return socket.emit('error', { message: 'Unauthorized host' });
        if (!room.isActive) return socket.emit('error', { message: 'Quiz not active' });

        room.currentQuestionIndex++;
        if (room.currentQuestionIndex >= room.questions.length) {
          // End of quiz
          room.isActive = false;
          io.to(`quiz-${eventId}`).emit('quiz-ended', {
            message: 'Quiz completed!',
            reason: 'All questions answered'
          });
          await Event.update({ status: 'Completed' }, { where: { id: eventId } });
          return;
        }

        const question = room.questions[room.currentQuestionIndex];
        room.questionInProgress = true;
        room.answers = {}; // Reset answers for new question

        // Send question to all participants (without correct answer)
        io.to(`quiz-${eventId}`).emit('new-question', {
          questionId: question.id,
          questionText: question.question,
          options: question.options,
          timer: question.timer,
          questionNumber: room.currentQuestionIndex + 1,
          totalQuestions: room.questions.length
        });

        // Set timer to automatically end question after specified time
        setTimeout(() => {
          if (room.questionInProgress && room.isActive) {
            endQuestion(io, eventId, room, question);
          }
        }, question.timer * 1000);

        console.log(`Question ${room.currentQuestionIndex + 1} sent for quiz ${eventId}`);
      } catch (error) {
        console.error('Next question error:', error);
        socket.emit('error', { message: 'Failed to send next question' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
      if (socket.eventId) {
        const room = quizRooms.get(socket.eventId);
        if (room) {
          room.participants.delete(socket.userId);
          socket.to(`quiz-${socket.eventId}`).emit('participant-left', { userId: socket.userId, participantCount: room.participants.size });
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
    const isCorrect = data.answer === question.correctAnswer;
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

  // Send results to all participants
  io.to(`quiz-${eventId}`).emit('question-ended', {
    questionId: question.id,
    correctAnswer: question.correctAnswer,
    results: results
  });
}
