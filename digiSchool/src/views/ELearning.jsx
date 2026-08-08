import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Modal from '../components/Modal';
import { PageHeader } from '../components/widgets';
import { Icon } from '../components/icons';
import { SUBJECTS, getSubjectMeta, expandClassesWithStreams } from '../data/seed';
import * as elearning from '../lib/elearningStore';

const MANAGER_ROLES = ['teacher', 'principal', 'deputy_academic', 'dos'];

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ELearning({ store, user }) {
  const canManage = MANAGER_ROLES.includes(user?.role);
  const schoolId = store?.schoolId || store?.settings?.school_id || 'default';
  const notify = store?.notify || (() => {});

  const classes = useMemo(() => {
    const list = expandClassesWithStreams(store?.settings?.classes || []);
    return ['All', ...list];
  }, [store?.settings]);

  // The viewer's own class/stream (students & parents), read from their RLS-scoped record.
  const viewerClass = useMemo(() => {
    if (canManage) return null;
    const list = store?.students || [];
    const id = user?.student_id || user?.studentId || user?.link || user?.id;
    const me = list.find((s) => s.id === id || s.adm === user?.username) || list[0];
    return me?.class || null;
  }, [canManage, store?.students, user]);

  const [catalog, setCatalog] = useState([]);
  const [cached, setCached] = useState(() => new Set());
  const [subject, setSubject] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refreshCached = useCallback(async () => {
    setCached(new Set(await elearning.cachedIds()));
    setEstimate(await elearning.storageEstimate());
  }, []);

  useEffect(() => {
    setCatalog(elearning.loadCatalog(schoolId));
    refreshCached();
  }, [schoolId, refreshCached]);

  const persist = useCallback((next) => {
    setCatalog(next);
    elearning.saveCatalog(schoolId, next);
  }, [schoolId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const forClass = (l) => !l.klass || l.klass === 'All'; // untargeted lessons reach everyone
    return catalog.filter((l) => {
      // Hard visibility scope: students/parents only see their own class + all-class lessons.
      if (viewerClass && !(forClass(l) || l.klass === viewerClass)) return false;
      // Optional class filter (managers browsing a specific stream).
      if (classFilter !== 'All' && !(forClass(l) || l.klass === classFilter)) return false;
      if (subject !== 'All' && l.subject !== subject) return false;
      if (downloadedOnly && !cached.has(l.id)) return false;
      if (q && !(`${l.title} ${l.description} ${l.teacher}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [catalog, subject, classFilter, viewerClass, query, downloadedOnly, cached]);

  const subjectsInUse = useMemo(() => {
    const s = new Set(catalog.map((l) => l.subject));
    return ['All', ...SUBJECTS.filter((sub) => s.has(sub))];
  }, [catalog]);

  async function handleAddLesson(lesson, file) {
    try {
      if (file) await elearning.putVideo(lesson.id, file);
      persist([lesson, ...catalog]);
      await refreshCached();
      setUploadOpen(false);
      notify('Lesson published to E-Learning', 'success', 'E-Learning');
    } catch (e) {
      notify(e.message || 'Could not save the lesson', 'error', 'E-Learning');
    }
  }

  async function handleDelete(lesson) {
    if (!window.confirm(`Delete "${lesson.title}"? This also removes any offline copy on this device.`)) return;
    try {
      await elearning.deleteVideo(lesson.id);
      persist(catalog.filter((l) => l.id !== lesson.id));
      await refreshCached();
      if (selected?.id === lesson.id) setSelected(null);
      notify('Lesson deleted', 'success', 'E-Learning');
    } catch (e) {
      notify(e.message || 'Delete failed', 'error', 'E-Learning');
    }
  }

  async function handleDownload(lesson) {
    setBusyId(lesson.id);
    try {
      const size = await elearning.downloadForOffline(lesson);
      await refreshCached();
      notify(`Saved for offline (${elearning.formatBytes(size)})`, 'success', 'E-Learning');
    } catch (e) {
      notify(e.message || 'Download failed (the video host may block cross-origin downloads)', 'error', 'E-Learning');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveOffline(lesson) {
    setBusyId(lesson.id);
    try {
      await elearning.deleteVideo(lesson.id);
      await refreshCached();
      notify('Offline copy removed', 'info', 'E-Learning');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="E-Learning"
        subtitle="Watch lessons anywhere — download once, then play fully offline"
        actions={canManage && (
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
            <Icon name="plus" size={16} /> Upload Lesson
          </button>
        )}
      />

      {/* Filters */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" placeholder="Search lessons…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        {canManage ? (
          <select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: 170 }} title="Filter by target class">
            {classes.map((c) => <option key={c} value={c}>{c === 'All' ? 'All classes' : `Grade ${c}`}</option>)}
          </select>
        ) : viewerClass && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 16, padding: '4px 12px' }}>
            Your class: Grade {viewerClass}
          </span>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={downloadedOnly} onChange={(e) => setDownloadedOnly(e.target.checked)} />
          Downloaded only
        </label>
        {estimate && (
          <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
            Offline storage: {elearning.formatBytes(estimate.usage)}{estimate.quota ? ` / ${elearning.formatBytes(estimate.quota)}` : ''}
          </span>
        )}
      </div>

      {/* Subject chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 20px' }}>
        {subjectsInUse.map((s) => {
          const active = subject === s;
          const color = s === 'All' ? '#0284c7' : getSubjectMeta(s).color;
          return (
            <button key={s} onClick={() => setSubject(s)}
              style={{
                border: `1px solid ${active ? color : '#e2e8f0'}`, background: active ? color : '#fff',
                color: active ? '#fff' : '#475569', borderRadius: 16, padding: '5px 14px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {catalog.length === 0
            ? (canManage ? <>No lessons yet. Click <strong>Upload Lesson</strong> to add your first one.</> : <>No lessons have been published yet. Check back soon.</>)
            : <>No lessons match your filters.</>}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isCached={cached.has(lesson.id)}
              busy={busyId === lesson.id}
              canManage={canManage}
              onPlay={() => setSelected(lesson)}
              onDownload={() => handleDownload(lesson)}
              onRemoveOffline={() => handleRemoveOffline(lesson)}
              onDelete={() => handleDelete(lesson)}
            />
          ))}
        </div>
      )}

      {selected && (
        <PlayerModal
          lesson={selected}
          isCached={cached.has(selected.id)}
          onClose={() => setSelected(null)}
          onDownload={() => handleDownload(selected)}
          onRemoveOffline={() => handleRemoveOffline(selected)}
          busy={busyId === selected.id}
        />
      )}

      {uploadOpen && (
        <UploadModal
          user={user}
          classes={classes}
          offlineAvailable={elearning.offlineAvailable}
          onClose={() => setUploadOpen(false)}
          onSave={handleAddLesson}
        />
      )}
    </div>
  );
}

function LessonCard({ lesson, isCached, busy, canManage, onPlay, onDownload, onRemoveOffline, onDelete }) {
  const meta = getSubjectMeta(lesson.subject);
  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Poster */}
      <button onClick={onPlay} title="Play lesson"
        style={{ position: 'relative', height: 140, border: 'none', cursor: 'pointer', padding: 0,
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill={meta.color}><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: 0.5 }}>{meta.initials}</span>
        {lesson.demo && <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)', color: meta.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>DEMO</span>}
        {isCached && <span title="Available offline" style={{ position: 'absolute', bottom: 10, right: 10, background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="download" size={11} /> Offline</span>}
      </button>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{lesson.title}</div>
        <div className="muted" style={{ fontSize: 12 }}>{lesson.subject}{lesson.klass && lesson.klass !== 'All' ? ` · Grade ${lesson.klass}` : ''} · {lesson.teacher}</div>
        {lesson.description && <div className="muted" style={{ fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lesson.description}</div>}

        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: 1, minWidth: 84, padding: '6px 10px', fontSize: 13 }} onClick={onPlay}>
            <Icon name="eye" size={14} /> Watch
          </button>
          {isCached ? (
            <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} disabled={busy} onClick={onRemoveOffline} title="Remove offline copy">
              <Icon name="close" size={14} />
            </button>
          ) : (lesson.url && (
            <button className="btn" style={{ padding: '6px 10px', fontSize: 13 }} disabled={busy} onClick={onDownload} title="Download for offline">
              {busy ? '…' : <Icon name="download" size={14} />}
            </button>
          ))}
          {canManage && (
            <button className="btn" style={{ padding: '6px 10px', fontSize: 13, color: '#dc2626' }} onClick={onDelete} title="Delete lesson">
              <Icon name="warning" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerModal({ lesson, isCached, onClose, onDownload, onRemoveOffline, busy }) {
  const [src, setSrc] = useState(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const revokeRef = useRef(() => {});

  useEffect(() => {
    let alive = true;
    setError('');
    setSrc(null);
    elearning.resolvePlayable(lesson).then(({ url, offline, revoke }) => {
      if (!alive) { revoke(); return; }
      revokeRef.current = revoke;
      setOffline(offline);
      if (url) setSrc(url); else setError('This lesson has no video attached yet.');
    });
    return () => { alive = false; revokeRef.current?.(); };
  }, [lesson]);

  // Resume from last position and remember progress.
  const onLoaded = () => {
    const pos = elearning.getProgress()[lesson.id];
    if (pos && videoRef.current && pos < (videoRef.current.duration || Infinity) - 5) {
      videoRef.current.currentTime = pos;
    }
  };
  const onTime = () => { if (videoRef.current) elearning.setProgress(lesson.id, videoRef.current.currentTime); };

  return (
    <Modal title={lesson.title} wide onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Close</button>
        {isCached ? (
          <button className="btn" disabled={busy} onClick={onRemoveOffline}><Icon name="close" size={14} /> Remove offline copy</button>
        ) : (lesson.url && (
          <button className="btn btn-primary" disabled={busy} onClick={onDownload}><Icon name="download" size={14} /> {busy ? 'Downloading…' : 'Download for offline'}</button>
        ))}
      </>
    }>
      <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          <video ref={videoRef} src={src} controls autoPlay playsInline onLoadedMetadata={onLoaded} onTimeUpdate={onTime}
            style={{ width: '100%', height: '100%' }} />
        ) : error ? (
          <div style={{ color: '#cbd5e1', fontSize: 14, padding: 20, textAlign: 'center' }}>{error}</div>
        ) : (
          <div style={{ color: '#cbd5e1', fontSize: 14 }}>Loading…</div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          {lesson.subject}{lesson.klass && lesson.klass !== 'All' ? ` · Grade ${lesson.klass}` : ''} · {lesson.teacher}
        </div>
        <span style={{ fontSize: 12, color: offline ? '#16a34a' : '#64748b', fontWeight: 600 }}>
          {offline ? '● Playing offline' : (src ? '● Streaming' : '')}
        </span>
      </div>
      {lesson.description && <p style={{ fontSize: 14, color: '#334155', marginTop: 10 }}>{lesson.description}</p>}
    </Modal>
  );
}

function UploadModal({ user, classes, offlineAvailable, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [klass, setKlass] = useState('All');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const sizeMB = file ? file.size / (1024 * 1024) : 0;
  const tooBig = sizeMB > 1024; // > 1GB — nudge to compress
  const canSave = title.trim() && file && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    const lesson = {
      id: (crypto.randomUUID ? crypto.randomUUID() : `l-${Date.now()}`),
      subject, title: title.trim(), description: description.trim(),
      teacher: user?.name || 'Teacher', teacherId: user?.id || null,
      klass, source: 'local', createdAt: new Date().toISOString(),
      sizeMB: Math.round(sizeMB),
    };
    await onSave(lesson, file);
    setSaving(false);
  }

  return (
    <Modal title="Upload Lesson" wide onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={submit}>{saving ? 'Saving…' : 'Publish Lesson'}</button>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <div>
            <label className="field-label">Lesson Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photosynthesis explained" autoFocus />
          </div>
          <div>
            <label className="field-label">Subject</label>
            <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <div>
            <label className="field-label">Class</label>
            <select className="select" value={klass} onChange={(e) => setKlass(e.target.value)}>
              {classes.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Classes' : `Grade ${c}`}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary (optional)" />
          </div>
        </div>

        <div>
          <label className="field-label">Video File *</label>
          <div className="dropzone" onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: 24, color: 'var(--primary)', marginBottom: 6 }}><Icon name="download" size={28} /></div>
            {file ? (
              <>
                <p style={{ margin: 0, fontWeight: 600 }}>{file.name}</p>
                <p className="muted" style={{ fontSize: 12 }}>{elearning.formatBytes(file.size)}</p>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}>Click to choose a video (MP4 recommended).</p>
                <p className="muted" style={{ fontSize: 12 }}>Saved on this device for offline playback.</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
        </div>

        {tooBig && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#92400e' }}>
            <strong>This file is large ({elearning.formatBytes(file.size)}).</strong> For a 15–20 min lesson, 720p H.264 at a moderate bitrate (≈500 MB–1 GB) plays fine on a phone or tablet and caches comfortably. Consider compressing before upload.
          </div>
        )}
        {!offlineAvailable && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#b91c1c' }}>
            Offline storage isn't available in this browser (private mode?), so uploaded videos can't be saved here.
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Lessons and their videos are stored on this device. Sharing across devices/users needs the optional Supabase Storage backend.
        </p>
      </div>
    </Modal>
  );
}
