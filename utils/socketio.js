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

        const questions = await Question.findAll({ limit: 50, order: Sequelize.literal('RAND()') });
        room.questions = questions;
        room.currentQuestionIndex = 0;
        room.isActive = true;

        io.to(`quiz-${eventId}`).emit('quiz-started', { message: 'Quiz started!', totalQuestions: questions.length });
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
