import ServerClipAnalyzer from './util/clip-analysis.js';
import { handleVideoSource, isDirectVideoUrl } from './util/video-handler.js';
import downloadVideo from './download.js';
import { updateJobStatus } from './server.js';

/**
 * Generate clip candidates from video source
 * @param {string} source - Video URL or file path
 * @param {Object} config - Analysis configuration
 * @param {string} jobId - Job tracking ID
 * @returns {Array} Array of clip candidates
 */
export default async function generateClips(source, config = {}, jobId = null) {
  const videoFile = jobId ? `./video_${jobId}.mp4` : './video.mp4';
  
  try {
    console.log(`Starting clip generation for: ${source}`);
    
    if (jobId) {
      updateJobStatus(jobId, 'processing', { 
        progress: 10, 
        message: 'Downloading video...' 
      });
    }

    // Handle different video sources
    if (typeof source === 'string') {
      // URL source
      if (isDirectVideoUrl(source)) {
        await handleVideoSource(source, 'direct_url', null, jobId);
      } else {
        // YouTube or yt-dlp compatible URL
        await downloadVideo(source, null, jobId);
      }
    } else {
      // Uploaded file
      await handleVideoSource(source, 'upload', null, jobId);
    }

    if (jobId) {
      updateJobStatus(jobId, 'processing', { 
        progress: 30, 
        message: 'Video downloaded, starting analysis...' 
      });
    }

    // Initialize analyzer
    const analyzer = new ServerClipAnalyzer();
    
    try {
      // Analyze video
      const clips = await analyzer.analyzeVideo(videoFile, config);
      
      if (jobId) {
        updateJobStatus(jobId, 'processing', { 
          progress: 90, 
          message: 'Analysis complete, finalizing results...' 
        });
      }

      console.log(`Generated ${clips.length} clip candidates`);
      
      // Add additional metadata
      const enrichedClips = clips.map((clip, index) => ({
        ...clip,
        rank: index + 1,
        videoFile: videoFile,
        sourceUrl: typeof source === 'string' ? source : null,
        timestamp: new Date().toISOString()
      }));

      return {
        success: true,
        clips: enrichedClips,
        totalClips: enrichedClips.length,
        videoFile: videoFile,
        config: config
      };

    } finally {
      // Clean up analyzer resources
      analyzer.cleanup();
    }

  } catch (error) {
    console.error('Error generating clips:', error);
    
    if (jobId) {
      updateJobStatus(jobId, 'failed', { 
        error: error.message,
        failedAt: new Date().toISOString()
      });
    }
    
    throw error;
  }
}

/**
 * Extract a specific clip from video
 * @param {string} videoFile - Path to video file
 * @param {number} start - Start time in seconds
 * @param {number} end - End time in seconds
 * @param {string} outputFile - Output file path
 * @returns {Promise} Promise that resolves when clip is extracted
 */
export async function extractClip(videoFile, start, end, outputFile) {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoFile,
      '-ss', start.toString(),
      '-t', (end - start).toString(),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      '-y', // Overwrite output file
      outputFile
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Clip extracted: ${outputFile}`);
        resolve(outputFile);
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Generate multiple clips from candidates
 * @param {Array} candidates - Array of clip candidates
 * @param {string} videoFile - Path to source video
 * @param {Array} selectedIds - Array of clip IDs to extract (optional)
 * @param {string} jobId - Job tracking ID
 * @returns {Array} Array of extracted clip file paths
 */
export async function generateMultipleClips(candidates, videoFile, selectedIds = null, jobId = null) {
  const clips = selectedIds 
    ? candidates.filter(clip => selectedIds.includes(clip.id))
    : candidates;

  const extractedClips = [];
  
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const outputFile = jobId 
      ? `./clip_${jobId}_${clip.id}.mp4`
      : `./clip_${clip.id}.mp4`;
    
    try {
      if (jobId) {
        const progress = 70 + (i / clips.length) * 20;
        updateJobStatus(jobId, 'processing', { 
          progress, 
          message: `Extracting clip ${i + 1}/${clips.length}...` 
        });
      }

      await extractClip(videoFile, clip.start, clip.end, outputFile);
      extractedClips.push({
        ...clip,
        filePath: outputFile,
        fileName: outputFile.split('/').pop()
      });
    } catch (error) {
      console.error(`Failed to extract clip ${clip.id}:`, error);
      // Continue with other clips
    }
  }

  return extractedClips;
}