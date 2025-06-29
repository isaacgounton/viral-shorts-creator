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
import generateClips, { generateMultipleClips, extractClip } from './generate-clips.js';
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

// Generate shorts endpoint (unified for URL and upload)
app.post('/api/generate-shorts', upload.single('video'), async (req, res) => {
  try {
    const { 
      video_url, 
      context = '', 
      language = 'en', 
      voice, 
      cookies_url, 
      format = 'portrait' 
    } = req.body;

    // Validation - must have either video_url or uploaded file
    if (!video_url && !req.file) {
      return res.status(400).json({ error: 'Either video_url or video file is required' });
    }

    if (video_url && req.file) {
      return res.status(400).json({ error: 'Provide either video_url or video file, not both' });
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
    const jobData = {
      context,
      language: detectedLanguage,
      voice: selectedVoice,
      cookies_url,
      format,
      type: 'shorts-generation'
    };

    if (video_url) {
      jobData.video_url = video_url;
      console.log(`Created shorts job ${jobId} for URL: ${video_url}`);
    } else {
      jobData.uploadedFile = req.file;
      jobData.originalFilename = req.file.originalname;
      console.log(`Created shorts job ${jobId} for uploaded file: ${req.file.originalname}`);
    }

    createJob(jobId, jobData);

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
    const { video_url, uploadedFile, context, language, voice, cookies_url, format } = job.request;

    console.log(`Starting async processing for job ${jobId}`);
    
    // Determine video source type and handle accordingly
    let outputFile;
    
    if (uploadedFile) {
      // Handle uploaded file
      console.log(`Processing uploaded file for job ${jobId}...`);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 25 });
      await handleVideoSource(uploadedFile, 'upload', null, jobId);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 50 });
      outputFile = await generateShortsFromVideo(context ? `context: ${context}` : '', voice, language, jobId, format);
    } else if (isDirectVideoUrl(video_url)) {
      // Handle direct video URL
      console.log(`Processing direct video URL for job ${jobId}...`);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 25 });
      await handleVideoSource(video_url, 'direct_url', null, jobId);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 50 });
      outputFile = await generateShortsFromVideo(context ? `context: ${context}` : '', voice, language, jobId, format);
    } else {
      // Handle YouTube or yt-dlp compatible URL
      console.log(`Processing ${isYouTubeUrl(video_url) ? 'YouTube' : 'yt-dlp compatible'} URL for job ${jobId}...`);
      updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 25 });
      outputFile = await generateShorts(video_url, context ? `context: ${context}` : '', voice, language, cookies_url, jobId, format);
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


// Async job processing function for clip analysis
async function processClipJobAsync(jobId) {
  try {
    updateJobStatus(jobId, JOB_STATUS.PROCESSING, { progress: 0 });
    
    const job = jobs.get(jobId);
    const { video_url, uploadedFile, clipDuration, maxClips, overlap, weights, cookies_url } = job.request;

    console.log(`Starting async clip analysis for job ${jobId}`);
    
    const config = {
      clipDuration,
      maxClips, 
      overlap,
      audioWeight: weights.audio,
      visualWeight: weights.visual,
      motionWeight: weights.motion
    };

    // Generate clips using the appropriate source
    let source;
    if (uploadedFile) {
      source = uploadedFile;
      console.log(`Analyzing uploaded file: ${uploadedFile.originalname}`);
    } else {
      source = video_url;
      console.log(`Analyzing video URL: ${video_url}`);
      if (cookies_url) {
        console.log(`Using cookies from: ${cookies_url}`);
      }
    }

    const result = await generateClips(source, config, jobId, cookies_url);

    if (result.success && result.clips) {
      updateJobStatus(jobId, JOB_STATUS.COMPLETED, { 
        progress: 100,
        clips: result.clips,
        totalClips: result.totalClips,
        completedAt: new Date().toISOString()
      });
      console.log(`Clip analysis job ${jobId} completed with ${result.totalClips} clips`);
    } else {
      throw new Error('No clips generated');
    }

  } catch (error) {
    console.error(`Clip analysis job ${jobId} failed:`, error);
    updateJobStatus(jobId, JOB_STATUS.FAILED, { 
      error: error.message,
      failedAt: new Date().toISOString()
    });
  }
}

// Async job processing function for clip extraction
async function processClipExtractionAsync(extractJobId, parentJob, clipIds) {
  try {
    updateJobStatus(extractJobId, JOB_STATUS.PROCESSING, { progress: 0 });
    
    console.log(`Starting clip extraction for job ${extractJobId}`);
    
    // Generate multiple clips based on selected IDs
    const extractedClips = await generateMultipleClips(
      parentJob.clips, 
      parentJob.videoFile || `./video_${parentJob.id}.mp4`, 
      clipIds, 
      extractJobId
    );

    if (extractedClips && extractedClips.length > 0) {
      updateJobStatus(extractJobId, JOB_STATUS.COMPLETED, { 
        progress: 100,
        extractedClips: extractedClips,
        totalExtracted: extractedClips.length,
        completedAt: new Date().toISOString()
      });
      console.log(`Clip extraction job ${extractJobId} completed with ${extractedClips.length} clips`);
    } else {
      throw new Error('No clips extracted');
    }

  } catch (error) {
    console.error(`Clip extraction job ${extractJobId} failed:`, error);
    updateJobStatus(extractJobId, JOB_STATUS.FAILED, { 
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

// Generate clips endpoint (unified for URL and upload)
app.post('/api/generate-clips', upload.single('video'), async (req, res) => {
  try {
    const { 
      video_url,
      cookies_url,
      clipDuration = 60, 
      maxClips = 10, 
      overlap = 30,
      weights = { audio: 0.4, visual: 0.3, motion: 0.3 }
    } = req.body;

    // Validation - must have either video_url or uploaded file
    if (!video_url && !req.file) {
      return res.status(400).json({ error: 'Either video_url or video file is required' });
    }

    if (video_url && req.file) {
      return res.status(400).json({ error: 'Provide either video_url or video file, not both' });
    }

    if (clipDuration < 10 || clipDuration > 300) {
      return res.status(400).json({ error: 'Clip duration must be between 10 and 300 seconds' });
    }

    if (maxClips < 1 || maxClips > 20) {
      return res.status(400).json({ error: 'Max clips must be between 1 and 20' });
    }

    // Generate unique job ID
    const jobId = uuidv4();

    // Create job record
    const jobData = {
      clipDuration,
      maxClips,
      overlap,
      weights,
      cookies_url,
      type: 'clip-analysis'
    };

    if (video_url) {
      jobData.video_url = video_url;
      console.log(`Created clip analysis job ${jobId} for URL: ${video_url}`);
    } else {
      jobData.uploadedFile = req.file;
      jobData.originalFilename = req.file.originalname;
      console.log(`Created clip analysis job ${jobId} for uploaded file: ${req.file.originalname}`);
    }

    createJob(jobId, jobData);

    // Return job ID immediately
    res.json({ 
      success: true, 
      message: 'Clip analysis job created successfully',
      jobId: jobId,
      statusUrl: `/api/jobs/${jobId}/status`,
      clipsUrl: `/api/jobs/${jobId}/clips`,
      config: {
        clipDuration,
        maxClips,
        overlap,
        weights
      }
    });

    // Process job asynchronously
    processClipJobAsync(jobId);

  } catch (error) {
    console.error('Error creating clip analysis job:', error);
    res.status(500).json({ 
      error: 'Failed to create clip analysis job', 
      details: error.message 
    });
  }
});


// Get clips from analysis job
app.get('/api/jobs/:jobId/clips', (req, res) => {
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

    if (!job.clips) {
      return res.status(404).json({ error: 'No clips found for this job' });
    }

    res.json({
      success: true,
      jobId: job.id,
      clips: job.clips,
      totalClips: job.clips.length,
      config: job.request
    });

  } catch (error) {
    console.error('Error getting clips:', error);
    res.status(500).json({ error: 'Failed to get clips' });
  }
});

// Download specific clip
app.get('/api/jobs/:jobId/clips/:clipId/download', (req, res) => {
  try {
    const { jobId, clipId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({ 
        error: 'Job not completed', 
        status: job.status 
      });
    }

    const clip = job.extractedClips?.find(c => c.id === clipId);
    if (!clip || !fs.existsSync(clip.filePath)) {
      return res.status(404).json({ error: 'Clip not found or expired' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="clip_${clipId}.mp4"`);
    res.sendFile(path.resolve(clip.filePath));

  } catch (error) {
    console.error('Error downloading clip:', error);
    res.status(500).json({ error: 'Failed to download clip' });
  }
});

// Extract and download multiple clips
app.post('/api/jobs/:jobId/extract-clips', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { clipIds } = req.body;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({ 
        error: 'Job not completed', 
        status: job.status 
      });
    }

    if (!job.clips) {
      return res.status(404).json({ error: 'No clips found for this job' });
    }

    // Validation
    if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
      return res.status(400).json({ error: 'clipIds array is required' });
    }

    // Create extraction job
    const extractJobId = uuidv4();
    createJob(extractJobId, {
      parentJobId: jobId,
      clipIds,
      type: 'clip-extraction'
    });

    // Return extraction job ID immediately
    res.json({ 
      success: true, 
      message: 'Clip extraction job created successfully',
      extractJobId: extractJobId,
      statusUrl: `/api/jobs/${extractJobId}/status`,
      downloadUrl: `/api/jobs/${extractJobId}/download-clips`,
      selectedClips: clipIds.length
    });

    // Process extraction asynchronously
    processClipExtractionAsync(extractJobId, job, clipIds);

  } catch (error) {
    console.error('Error creating clip extraction job:', error);
    res.status(500).json({ 
      error: 'Failed to create clip extraction job', 
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
  console.log(`🎯 Generate clips: POST http://localhost:${PORT}/api/generate-clips`);
  console.log(`📋 Job status: GET http://localhost:${PORT}/api/jobs/:jobId/status`);
  console.log(`🎞️  Get clips: GET http://localhost:${PORT}/api/jobs/:jobId/clips`);
  console.log(`📥 Download videos: GET http://localhost:${PORT}/api/jobs/:jobId/download`);
  console.log(`📥 Download clips: GET http://localhost:${PORT}/api/jobs/:jobId/clips/:clipId/download`);
  console.log(`📥 Legacy download: GET http://localhost:${PORT}/api/download/:jobId`);
});

export default app;
export { updateJobStatus };