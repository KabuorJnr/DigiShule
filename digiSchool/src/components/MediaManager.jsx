import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Image as ImageIcon, Loader } from 'lucide-react';
import { saveFile, listFiles, deleteFile, getSignedUrl } from '../lib/fileStore';

// Assuming user is passed as prop or available from context.
// In our architecture, the parent view usually passes notify.
export default function MediaManager({ notify, user }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');



  const loadGallery = async () => {
    try {
      const data = await listFiles('gallery');
      
      // Fetch signed URLs for all images so they render instantly
      const withUrls = await Promise.all(data.map(async (f) => {
        try {
          const url = await getSignedUrl(f.storage_path);
          return { ...f, url };
        } catch {
          return { ...f, url: null };
        }
      }));
      
      setFiles(withUrls);
    } catch (e) {
      if (notify) notify('Failed to load gallery', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const handleUpload = async (e) => {
    const fileList = Array.from(e.target.files);
    if (!fileList.length) return;

    setUploading(true);
    let successCount = 0;

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) {
        if (notify) notify(`Skipped ${file.name} (not an image)`, 'warning');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        if (notify) notify(`Skipped ${file.name} (over 5MB limit)`, 'warning');
        continue;
      }

      try {
        await saveFile({
          id: crypto.randomUUID(),
          file,
          type: 'gallery',
          subject: 'Gallery',
          description: description || 'School Gallery Photo',
          uploadedBy: user?.id
        });
        successCount++;
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    if (successCount > 0) {
      if (notify) notify(`Uploaded ${successCount} images successfully`, 'success');
      setDescription('');
      loadGallery();
    } else {
      if (notify) notify('No images were uploaded', 'error');
    }
    setUploading(false);
    e.target.value = null; // reset input
  };

  const handleDelete = async (file) => {
    if (!window.confirm('Delete this image from the gallery?')) return;
    try {
      await deleteFile(file.id, file.storage_path);
      setFiles(files.filter(f => f.id !== file.id));
      if (notify) notify('Image deleted', 'success');
    } catch (e) {
      if (notify) notify('Failed to delete image', 'error');
    }
  };

  if (loading) return <div className="card p-6" style={{ textAlign: 'center' }}><Loader className="spin" /></div>;

  return (
    <div className="card p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={24} style={{ color: '#0ea5e9' }} />
            School Media Gallery
          </h2>
          <p style={{ color: '#64748b', fontSize: 14 }}>Upload photos to be viewed by parents and students.</p>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Caption (optional)" 
            className="input" 
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: 200 }}
          />
          <label className="btn btn-primary" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            {uploading ? <Loader size={16} className="spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading...' : 'Upload photos'}
            <input 
              type="file" 
              multiple 
              accept="image/jpeg, image/png, image/webp" 
              style={{ display: 'none' }} 
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {files.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
            No photos in the gallery yet.
          </div>
        ) : (
          files.map(f => (
            <div key={f.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {f.url ? (
                <img src={f.url} alt={f.description} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                  <ImageIcon size={32} />
                </div>
              )}
              <div style={{ padding: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#334155', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.description || f.name}
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0 0' }}>
                  {new Date(f.uploaded_at).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => handleDelete(f)}
                style={{ 
                  position: 'absolute', top: 8, right: 8, 
                  background: 'rgba(239, 68, 68, 0.9)', color: 'white', 
                  border: 'none', borderRadius: '50%', width: 28, height: 28, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Delete Photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}



