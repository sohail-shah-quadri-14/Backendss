import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length >= 2; // At least 2 options
      },
      message: 'Questions must have at least 2 options'
    }
  },
  correctAnswer: {
    type: String,
    required: true
  },
  timer: {
    type: Number,
    default: 10  // 10 seconds per question
  }
});

// Static method to get random questions
QuestionSchema.statics.getRandomQuestions = async function(count = 50) {
  try {
    // Get random questions using MongoDB aggregation
    const questions = await this.aggregate([
      { $sample: { size: parseInt(count) } }
    ]);
    
    console.log(`Found ${questions.length} random questions`);
    return questions;
  } catch (error) {
    console.error('Error fetching random questions:', error);
    throw error;
  }
};

const Question = mongoose.model('Question', QuestionSchema);

export default Question; 