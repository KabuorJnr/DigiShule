import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Loader } from 'lucide-react';
import { listFiles, getSignedUrl } from '../lib/fileStore';

export default function GalleryViewer() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    try {
      const data = await listFiles('gallery');
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
      console.error('Failed to load gallery', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="card p-6" style={{ textAlign: 'center' }}><Loader className="spin" /></div>;

  return (
    <div className="card p-6">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <ImageIcon size={24} style={{ color: '#0ea5e9' }} />
          School Media Gallery
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Recent photos uploaded by the school administration.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {files.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
            No photos have been uploaded yet.
          </div>
        ) : (
          files.map(f => (
            <div key={f.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              {f.url ? (
                <img src={f.url} alt={f.description} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} loading="lazy" />
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
