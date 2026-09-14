const { v4: uuidv4 } = require('uuid');

class JobQueue {
  constructor() {
    this.jobs = new Map();
  }

  createJob(originalName, options = {}) {
    const id = uuidv4();
    const job = {
      id,
      originalName,
      options,
      status: 'pending', // pending, processing, completed, failed
      progress: 0,
      currentStep: 'Job queued...',
      logs: [`[${new Date().toLocaleTimeString()}] Job ${id} created for ${originalName}`],
      createdTime: new Date(),
      completedTime: null,
      error: null,
      outputs: {}
    };

    this.jobs.set(id, job);
    return job;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  updateProgress(id, progress, stepDesc) {
    const job = this.jobs.get(id);
    if (!job) return;

    job.progress = Math.min(100, Math.max(0, progress));
    if (stepDesc) {
      job.currentStep = stepDesc;
      job.logs.push(`[${new Date().toLocaleTimeString()}] (${progress}%) ${stepDesc}`);
    }
  }

  completeJob(id, outputs = {}) {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.currentStep = 'Conversion complete!';
    job.completedTime = new Date();
    job.outputs = outputs;
    job.logs.push(`[${new Date().toLocaleTimeString()}] Conversion completed successfully.`);
  }

  failJob(id, errorMsg) {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = 'failed';
    job.error = errorMsg;
    job.currentStep = `Failed: ${errorMsg}`;
    job.logs.push(`[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`);
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdTime - a.createdTime);
  }
}

module.exports = new JobQueue();
