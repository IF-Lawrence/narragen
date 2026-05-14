/**
 * @typedef {Object} Volume
 * @property {string} id - Volume ID (UUID)
 * @property {string} projectId - Project ID
 * @property {number} order - Volume number/order
 * @property {string} title - Volume title
 * @property {string} summary - Volume summary
 * @property {string} mainGoal - Main goal of this volume
 * @property {number} startChapter - Starting chapter number
 * @property {number} endChapter - Ending chapter number
 * @property {number} createdAt - Timestamp
 * @property {number} updatedAt - Timestamp
 */

export const VolumeSchema = {
  id: '',
  projectId: '',
  order: 1,
  title: '',
  summary: '',
  mainGoal: '',
  startChapter: 1,
  endChapter: 0,
  createdAt: Date.now(),
  updatedAt: Date.now()
};
