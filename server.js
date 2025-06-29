import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import generateShorts from './shorts.js';
import { getAvailableVoices, detectLanguageFromCode, getVoicesForLanguage } from './util/voice-selector.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'viral-shorts-creator'
  });
});

// Get available voices
app.get('/api/voices', async (req, res) => {
  try {
    const language = req.query.language;
    const voices = await getAvailableVoices();
    
    if (language) {
      const detectedLanguage = detectLanguageFromCode(language);
      const filteredVoices = getVoicesForLanguage(voices, detectedLanguage);
      res.json({ 
        language: detectedLanguage,
        voices: filteredVoices 
      });
    } else {
      res.json({ voices });
    }
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Generate shorts endpoint
app.post('/api/generate-shorts', async (req, res) => {
  try {
    const { url, context = '', language = 'en', voice } = req.body;

    // Validation
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Detect language and select voice
    const detectedLanguage = detectLanguageFromCode(language);
    let selectedVoice = voice;

    if (!selectedVoice) {
      // Default voice selection based on language
      const voices = await getAvailableVoices();
      const languageVoices = getVoicesForLanguage(voices, detectedLanguage);
      selectedVoice = languageVoices[0]?.name || 'en-US-AvaNeural';
    }

    console.log(`Starting shorts generation for URL: ${url}`);
    console.log(`Language: ${detectedLanguage}, Voice: ${selectedVoice}`);

    // Generate shorts (this is async and takes time)
    await generateShorts(url, context ? `context: ${context}` : '', selectedVoice, detectedLanguage);

    res.json({ 
      success: true, 
      message: 'Shorts generated successfully',
      language: detectedLanguage,
      voice: selectedVoice
    });

  } catch (error) {
    console.error('Error generating shorts:', error);
    res.status(500).json({ 
      error: 'Failed to generate shorts', 
      details: error.message 
    });
  }
});

// Status endpoint for monitoring
app.get('/api/status', (req, res) => {
  res.json({
    service: 'viral-shorts-creator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    edgeTtsUrl: process.env.EDGE_TTS_URL || 'http://localhost:5050'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Viral Shorts Creator API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Voices API: http://localhost:${PORT}/api/voices`);
  console.log(`🎬 Generate shorts: POST http://localhost:${PORT}/api/generate-shorts`);
});

export default app;