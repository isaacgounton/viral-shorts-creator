import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export class ServerClipAnalyzer {
  constructor() {
    this.tempDir = './temp-analysis';
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Main analysis function - analyzes video and returns clip candidates
   */
  async analyzeVideo(videoPath, config = {}) {
    const {
      clipDuration = 60,
      overlap = 30,
      minClipLength = 10,
      maxClips = 10,
      audioWeight = 0.4,
      visualWeight = 0.3,
      motionWeight = 0.3
    } = config;

    console.log(`Starting clip analysis for: ${videoPath}`);
    
    // Get video duration first
    const videoDuration = await this.getVideoDuration(videoPath);
    console.log(`Video duration: ${videoDuration} seconds`);

    if (videoDuration < minClipLength) {
      throw new Error(`Video too short: ${videoDuration}s (minimum: ${minClipLength}s)`);
    }

    const step = clipDuration - overlap;
    const candidates = [];

    // Generate analysis windows
    for (let start = 0; start < videoDuration - minClipLength; start += step) {
      const end = Math.min(start + clipDuration, videoDuration);
      
      if (end - start < minClipLength) continue;

      console.log(`Analyzing segment: ${start}s - ${end}s`);
      
      const candidate = await this.analyzeSegment(videoPath, start, end, videoDuration, {
        audioWeight,
        visualWeight,
        motionWeight
      });
      
      candidates.push(candidate);
    }

    // Sort by score and return top candidates
    const topCandidates = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxClips);

    console.log(`Analysis complete. Found ${topCandidates.length} top candidates`);
    return topCandidates;
  }

  /**
   * Analyze a specific video segment
   */
  async analyzeSegment(videoPath, start, end, totalDuration, weights) {
    const audioEnergy = await this.analyzeAudioEnergy(videoPath, start, end);
    const sceneChanges = await this.analyzeSceneChanges(videoPath, start, end);
    const motionLevel = await this.analyzeMotionLevel(videoPath, start, end);

    // Calculate composite score
    const score = this.calculateCompositeScore(audioEnergy, sceneChanges, motionLevel, weights);
    
    // Generate reasons
    const reasons = this.generateReasons(audioEnergy, sceneChanges, motionLevel, start, totalDuration);

    return {
      id: `clip_${Math.round(start)}_${Math.round(end)}`,
      start,
      end,
      duration: end - start,
      score,
      scoreLabel: this.getScoreLabel(score),
      metrics: {
        audioEnergy: Math.round(audioEnergy * 100) / 100,
        sceneChanges: Math.round(sceneChanges * 100) / 100,
        motionLevel: Math.round(motionLevel * 100) / 100
      },
      reasons
    };
  }

  /**
   * Get video duration using ffprobe
   */
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}`));
          return;
        }

        try {
          const metadata = JSON.parse(output);
          const duration = parseFloat(metadata.format.duration);
          resolve(duration);
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
        }
      });
    });
  }

  /**
   * Analyze audio energy using ffmpeg
   */
  async analyzeAudioEnergy(videoPath, start, end) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-ss', start.toString(),
        '-t', (end - start).toString(),
        '-af', 'astats=metadata=1:reset=1',
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        try {
          // Parse RMS values from ffmpeg output
          const rmsMatches = stderr.match(/RMS level dB: ([-\d.]+)/g);
          if (!rmsMatches || rmsMatches.length === 0) {
            resolve(0.3); // Default fallback
            return;
          }

          // Calculate average RMS
          const rmsValues = rmsMatches.map(match => {
            const value = parseFloat(match.split(': ')[1]);
            // Convert dB to linear scale (0-1)
            return Math.max(0, Math.min(1, (value + 60) / 60));
          });

          const avgRMS = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
          resolve(Math.max(0, Math.min(1, avgRMS)));
        } catch (error) {
          console.warn('Audio analysis failed, using fallback:', error.message);
          resolve(0.3); // Fallback value
        }
      });
    });
  }

  /**
   * Analyze scene changes using ffmpeg
   */
  async analyzeSceneChanges(videoPath, start, end) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-ss', start.toString(),
        '-t', (end - start).toString(),
        '-vf', 'select=gt(scene\\,0.3),showinfo',
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        try {
          // Count scene changes
          const sceneMatches = stderr.match(/pts_time:[\d.]+/g);
          const sceneCount = sceneMatches ? sceneMatches.length : 0;
          const duration = end - start;
          
          // Normalize scene changes per minute
          const sceneRate = (sceneCount / duration) * 60;
          const normalizedScore = Math.min(1, sceneRate / 10); // Normalize to 0-1
          
          resolve(normalizedScore);
        } catch (error) {
          console.warn('Scene analysis failed, using fallback:', error.message);
          resolve(0.3); // Fallback value
        }
      });
    });
  }

  /**
   * Analyze motion level using ffmpeg
   */
  async analyzeMotionLevel(videoPath, start, end) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-ss', start.toString(),
        '-t', (end - start).toString(),
        '-vf', 'select=gt(scene\\,0.1),metadata=print:key=lavfi.scene_score',
        '-f', 'null',
        '-'
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        try {
          // Parse motion scores
          const motionMatches = stderr.match(/lavfi\.scene_score=([\d.]+)/g);
          if (!motionMatches || motionMatches.length === 0) {
            resolve(0.3); // Default fallback
            return;
          }

          const motionValues = motionMatches.map(match => 
            parseFloat(match.split('=')[1])
          );

          const avgMotion = motionValues.reduce((a, b) => a + b, 0) / motionValues.length;
          const normalizedMotion = Math.min(1, avgMotion * 2); // Scale to 0-1
          
          resolve(normalizedMotion);
        } catch (error) {
          console.warn('Motion analysis failed, using fallback:', error.message);
          resolve(0.3); // Fallback value
        }
      });
    });
  }

  /**
   * Calculate composite score from all metrics
   */
  calculateCompositeScore(audioEnergy, sceneChanges, motionLevel, weights) {
    return (
      audioEnergy * weights.audioWeight +
      sceneChanges * weights.visualWeight +
      motionLevel * weights.motionWeight
    );
  }

  /**
   * Generate human-readable reasons for the score
   */
  generateReasons(audioEnergy, sceneChanges, motionLevel, start, totalDuration) {
    const reasons = [];
    const position = start / totalDuration;

    // Audio-based reasons
    if (audioEnergy > 0.7) reasons.push('High audio energy');
    else if (audioEnergy > 0.5) reasons.push('Good audio activity');
    else if (audioEnergy > 0.3) reasons.push('Moderate audio');

    // Visual-based reasons
    if (sceneChanges > 0.6) reasons.push('Dynamic scene changes');
    else if (sceneChanges > 0.4) reasons.push('Visual variety');

    // Motion-based reasons
    if (motionLevel > 0.6) reasons.push('High motion content');
    else if (motionLevel > 0.4) reasons.push('Active content');

    // Position-based reasons
    if (position < 0.15) reasons.push('Strong opening segment');
    else if (position > 0.8) reasons.push('Compelling ending');
    else if (position > 0.4 && position < 0.6) reasons.push('Peak content area');

    // Combination reasons
    if (audioEnergy > 0.6 && motionLevel > 0.5) {
      reasons.push('Engaging audio-visual content');
    }

    if (reasons.length === 0) reasons.push('Moderate activity');

    return reasons.slice(0, 4); // Limit to 4 reasons
  }

  /**
   * Get score label from numeric score
   */
  getScoreLabel(score) {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  }

  /**
   * Clean up temporary files
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }
}

export default ServerClipAnalyzer;