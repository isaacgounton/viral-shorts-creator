import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import generateShorts from './shorts.js';
import generateShortsFromVideo from './shorts-video.js';
import { getAvailableVoices, detectLanguageFromCode, getVoicesForLanguage } from './util/voice-selector.js';
import { isDirectVideoUrl, handleVideoSource } from './util/video-handler.js';
import { isYouTubeUrl } from './util/gemini.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Job tracking system
const jobs = new Map();

const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Helper function to update job status
function updateJobStatus(jobId, status, data = {}) {
  const job = jobs.get(jobId);
  if (job) {
    job.status = status;
    job.updatedAt = new Date().toISOString();
    Object.assign(job, data);
    jobs.set(jobId, job);
  }
}

// Helper function to create job
function createJob(jobId, requestData) {
  const job = {
    id: jobId,
    status: JOB_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    request: requestData,
    progress: 0
  };
  jobs.set(jobId, job);
  return job;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

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

// Generate shorts from URL endpoint (async)
app.post('/api/generate-shorts', async (req, res) => {
  try {
    const { url, context = '', language = 'en', voice, cookies_url, format = 'portrait' } = req.body;

    // Validation
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Generate unique job ID
    const jobId = uuidv4();

    // Detect language and select voice
    const detectedLanguage = detectLanguageFromCode(language);
    let selectedVoice = voice;

    if (!selectedVoice) {
      // Default voice selection based on language
      const voices = await getAvailableVoices();
      const languageVoices = getVoicesForLanguage(voices, detectedLanguage);
      selectedVoice = languageVoices[0]?.name || 'en-US-AvaNeural';
    }

    // Validate format
    const validFormats = ['portrait', 'landscape', 'square'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Must be one of: portrait, landscape, square' 
      });
    }

    // Create job record
    createJob(jobId, {
      url,
      context,
      language: detectedLanguage,
      voice: selectedVoice,
      cookies_url,
      format
    });

    console.log(`Created job ${jobId} for URL: ${url}`);
    console.log(`Language: ${detectedLanguage}, Voice: ${selectedVoice}, Format: ${format}`);
    if (cookies_url) {
      console.log(`Using cookies from: ${cookies_url}`);
    }

    // Return job ID immediately
    res.json({ 
      success: true, 
      message: 'Job created successfully',
      jobId: jobId,
      statusUrl: `/api/jobs/${jobId}/status`,
      downloadUrl: `/api/jobs/${jobId}/download`,
      language: detectedLanguage,
      voice: selectedVoice,
      format: format
    });

    // Process job asynchronously
    processJobAsync(jobId);

  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ 
      error: 'Failed to create job', 
      details: error.message 
    });
  }
});

// Async job processing function
async function processJobAsync(jobId) {
  try {
    updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 0 });
    
    const job = jobs.get(jobId);
    const { url, context, language, voice, cookies_url, format } = job.request;

    console.log(`Starting async processing for job ${jobId}`);
    
    // Determine video source type and handle accordingly
    let outputFile;
    if (isDirectVideoUrl(url)) {
      console.log(`Processing direct video URL for job ${jobId}...`);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 25 });
      await handleVideoSource(url, 'direct_url', null, jobId);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 50 });
      outputFile = await generateShortsFromVideo(context ? `context: ${context}` : '', voice, language, jobId, format);
    } else {
      console.log(`Processing ${isYouTubeUrl(url) ? 'YouTube' : 'yt-dlp compatible'} URL for job ${jobId}...`);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 25 });
      outputFile = await generateShorts(url, context ? `context: ${context}` : '', voice, language, cookies_url, jobId, format);
    }

    if (outputFile && fs.existsSync(outputFile)) {
      updateJobStatus(jobId, JOB_STATUS.COMPLETED, { 
        progress: 100,
        outputFile: outputFile,
        completedAt: new Date().toISOString()
      });
      console.log(`Job ${jobId} completed successfully`);
    } else {
      throw new Error('Output file not generated');
    }

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    updateJobStatus(jobId, JOB_STATUS.FAILED, { 
      error: error.message,
      failedAt: new Date().toISOString()
    });
  }
}

// Generate shorts from uploaded video endpoint (async)
app.post('/api/generate-shorts-upload', upload.single('video'), async (req, res) => {
  try {
    const { context = '', language = 'en', voice, format = 'portrait' } = req.body;

    // Validation
    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    // Generate unique job ID
    const jobId = uuidv4();

    // Validate format
    const validFormats = ['portrait', 'landscape', 'square'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Must be one of: portrait, landscape, square' 
      });
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

    // Create job record
    createJob(jobId, {
      uploadedFile: req.file,
      context,
      language: detectedLanguage,
      voice: selectedVoice,
      originalFilename: req.file.originalname,
      format
    });

    console.log(`Created job ${jobId} for uploaded file: ${req.file.originalname}`);
    console.log(`Language: ${detectedLanguage}, Voice: ${selectedVoice}, Format: ${format}`);

    // Return job ID immediately
    res.json({ 
      success: true, 
      message: 'Job created successfully for uploaded video',
      jobId: jobId,
      statusUrl: `/api/jobs/${jobId}/status`,
      downloadUrl: `/api/jobs/${jobId}/download`,
      language: detectedLanguage,
      voice: selectedVoice,
      originalFilename: req.file.originalname,
      format: format
    });

    // Process job asynchronously
    processUploadJobAsync(jobId);

  } catch (error) {
    console.error('Error creating upload job:', error);
    res.status(500).json({ 
      error: 'Failed to create job for uploaded video', 
      details: error.message 
    });
  }
});

// Async job processing function for uploads
async function processUploadJobAsync(jobId) {
  try {
    updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 0 });
    
    const job = jobs.get(jobId);
    const { uploadedFile, context, language, voice, format } = job.request;

    console.log(`Starting async processing for upload job ${jobId}`);
    
    updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 25 });
    
    // Handle uploaded video
    await handleVideoSource(uploadedFile, 'upload', null, jobId);
    
    updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 50 });
    
    // Generate shorts from the processed video
    const outputFile = await generateShortsFromVideo(context ? `context: ${context}` : '', voice, language, jobId, format);

    if (outputFile && fs.existsSync(outputFile)) {
      updateJobStatus(jobId, JOB_STATUS.COMPLETED, { 
        progress: 100,
        outputFile: outputFile,
        completedAt: new Date().toISOString()
      });
      console.log(`Upload job ${jobId} completed successfully`);
    } else {
      throw new Error('Output file not generated');
    }

  } catch (error) {
    console.error(`Upload job ${jobId} failed:`, error);
    updateJobStatus(jobId, JOB_STATUS.FAILED, { 
      error: error.message,
      failedAt: new Date().toISOString()
    });
  }
}

// Job status endpoint
app.get('/api/jobs/:jobId/status', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Return job status without sensitive internal data
    const response = {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };

    // Add completion time if completed
    if (job.completedAt) {
      response.completedAt = job.completedAt;
    }

    // Add error details if failed
    if (job.status === JOB_STATUS.FAILED) {
      response.error = job.error;
      response.failedAt = job.failedAt;
    }

    // Add download URL if completed
    if (job.status === JOB_STATUS.COMPLETED) {
      response.downloadUrl = `/api/jobs/${jobId}/download`;
      response.videoUrl = `/api/jobs/${jobId}/download`;
      
      // Add hook and script if available
      if (job.hook) {
        response.hook = job.hook;
      }
      if (job.script) {
        response.script = job.script;
      }
    }

    res.json(response);

  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Job download endpoint
app.get('/api/jobs/:jobId/download', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({ 
        error: 'Job not completed', 
        status: job.status,
        progress: job.progress || 0
      });
    }

    const outputFile = job.outputFile;
    if (!outputFile || !fs.existsSync(outputFile)) {
      return res.status(404).json({ error: 'Video not found or expired' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="shorts_${jobId}.mp4"`);
    res.sendFile(path.resolve(outputFile));

    // Clean up job and file after sending
    setTimeout(() => {
      try {
        fs.unlinkSync(outputFile);
        jobs.delete(jobId);
        console.log(`Cleaned up job ${jobId} and output file`);
      } catch (err) {
        console.error(`Error cleaning up job ${jobId}:`, err);
      }
    }, 1000);

  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// Download generated video endpoint (legacy - kept for compatibility)
app.get('/api/download/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const outputFile = `./output_${jobId}.mp4`;

    if (!fs.existsSync(outputFile)) {
      return res.status(404).json({ error: 'Video not found or expired' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="shorts_${jobId}.mp4"`);
    res.sendFile(path.resolve(outputFile));

    // Clean up file after sending
    setTimeout(() => {
      try {
        fs.unlinkSync(outputFile);
      } catch (err) {
        console.error('Error cleaning up file:', err);
      }
    }, 1000);

  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'Failed to download video' });
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
  console.log(`🎬 Generate shorts (URL): POST http://localhost:${PORT}/api/generate-shorts`);
  console.log(`🎬 Generate shorts (Upload): POST http://localhost:${PORT}/api/generate-shorts-upload`);
  console.log(`📋 Job status: GET http://localhost:${PORT}/api/jobs/:jobId/status`);
  console.log(`📥 Download videos: GET http://localhost:${PORT}/api/jobs/:jobId/download`);
  console.log(`📥 Legacy download: GET http://localhost:${PORT}/api/download/:jobId`);
});

export default app;
export { updateJobStatus };