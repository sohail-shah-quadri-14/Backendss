import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Event from '../models/Event.js';
import UserEvent from '../models/UserEvents.js';

dotenv.config();

const quizRooms = new Map();

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

    socket.on('join-live-event', async ({ eventId }) => {
      try {
        const event = await Event.findByPk(eventId);
        if (!event || event.status !== 'Ongoing') {
          return socket.emit('error', { message: 'Invalid or inactive event' });
        }

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
        room.participants.add(socket.userId);

        if (socket.role === 'host' && socket.userId !== room.hostId) {
          socket.leave(`quiz-${eventId}`);
          return socket.emit('error', { message: 'Unauthorized host' });
        }

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
        if (!room || socket.userId !== room.hostId) {
          return socket.emit('error', { message: 'Unauthorized host' });
        }

        const event = await Event.findByPk(eventId);
        if (!event) return socket.emit('error', { message: 'Event not found' });

        if (event.status === 'Completed') {
          return socket.emit('error', { message: 'Cannot start quiz for a completed event' });
        }

        await event.update({ status: 'Ongoing' });


        console.log(`Quiz ${eventId} started by host ${socket.userId}`);
      } catch (error) {
        console.error('Start quiz error:', error);
        socket.emit('error', { message: 'Failed to start quiz' });
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

    socket.on('next-question', async ({ eventId }) => {
      try {
        const room = quizRooms.get(eventId);
        if (!room || socket.userId !== room.hostId) {
          return socket.emit('error', { message: 'Unauthorized host' });
        }
        if (!room.isActive) {
          return socket.emit('error', { message: 'Quiz not active' });
        }

        room.currentQuestionIndex++;
        if (room.currentQuestionIndex >= room.questions.length) {
          room.isActive = false;
          io.to(`quiz-${eventId}`).emit('quiz-ended', { message: 'Quiz completed!' });
          await Event.update({ status: 'Completed' }, { where: { id: eventId } });
          return;
        }

        const question = room.questions[room.currentQuestionIndex];
        room.questionInProgress = true;
        room.answers = {};

        io.to(`quiz-${eventId}`).emit('new-question', {
          questionId: question.id,
          questionText: question.question,
          options: question.options,
          timer: question.timer,
          questionNumber: room.currentQuestionIndex + 1,
          totalQuestions: room.questions.length
        });

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
          io.to(`quiz-${socket.eventId}`).emit('participant-left', { userId: socket.userId, participantCount: room.participants.size });
        }
      }
    });
  });

  return io;
};
