/**
 * elearningStore.js — storage for the Live E-Learning portal.
 *
 * Stores live class metadata (meeting links, resource links, schedule).
 * Data is stored in localStorage per school.
 */

const catalogKey = (schoolId) => `eduone_elearning_catalog_${schoolId || 'default'}`;

export function getCatalog(schoolId) {
  try {
    const raw = localStorage.getItem(catalogKey(schoolId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveCatalog(schoolId, list) {
  try { localStorage.setItem(catalogKey(schoolId), JSON.stringify(list)); } catch { /* quota */ }
}

export function seedDemoLessons() {
  const now = new Date().toISOString();
  // Scheduled for 1 hour from now
  const oneHourLater = new Date(Date.now() + 3600000).toISOString().slice(0, 16); 
  
  return [
    {
      id: 'demo-live-eng', subject: 'English', title: 'Live Essay Writing Workshop',
      description: 'Join this live interactive session to go over essay structures.',
      teacher: 'Sample Teacher', klass: 'All', 
      meetingLink: 'https://meet.google.com/demo-eng-link',
      resourceLink: 'https://docs.google.com/document/d/demo-notes/edit',
      scheduledTime: oneHourLater,
      createdAt: now, demo: true,
    },
    {
      id: 'demo-live-bio', subject: 'Biology', title: 'Cell Structure QA',
      description: 'Live Q&A covering plant and animal cells. Bring your questions.',
      teacher: 'Sample Teacher', klass: 'All', 
      meetingLink: 'https://zoom.us/j/demo123',
      resourceLink: '',
      scheduledTime: now.slice(0, 16),
      createdAt: now, demo: true,
    },
  ];
}

export function loadCatalog(schoolId) {
  const existing = getCatalog(schoolId);
  if (existing) return existing;
  const seeded = seedDemoLessons();
  saveCatalog(schoolId, seeded);
  return seeded;
}

export async function deleteClass(id, schoolId) {
  const catalog = getCatalog(schoolId) || [];
  const updated = catalog.filter((l) => l.id !== id);
  saveCatalog(schoolId, updated);
  return updated;
}
