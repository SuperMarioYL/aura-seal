import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Film, Play, Share2, Trash2, X } from 'lucide-react';
import { deleteClip, listClips, type StoredClip } from '../recording/storage';
import { downloadBlob, shareBlob } from '../recording/capture';

interface WorksGalleryProps {
  open: boolean;
  reloadKey: number;
  onClose: () => void;
}

function ext(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

function clipName(clip: StoredClip): string {
  return `auraseal-${clip.createdAt}.${ext(clip.mimeType)}`;
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function WorksGallery({ open, reloadKey, onClose }: WorksGalleryProps) {
  const [clips, setClips] = useState<StoredClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    setLoading(true);
    listClips()
      .then((items) => {
        if (active) {
          setClips(items);
        }
      })
      .catch((err) => console.warn('[AuraSeal] failed to load works', err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, reloadKey]);

  useEffect(() => {
    if (!open) {
      revoke();
      setPlayingId(null);
      setPlayingUrl(null);
    }
  }, [open, revoke]);

  useEffect(() => revoke, [revoke]);

  if (!open) {
    return null;
  }

  const play = (clip: StoredClip) => {
    revoke();
    const url = URL.createObjectURL(clip.blob);
    urlRef.current = url;
    setPlayingUrl(url);
    setPlayingId(clip.id);
  };

  const remove = async (clip: StoredClip) => {
    await deleteClip(clip.id);
    if (playingId === clip.id) {
      revoke();
      setPlayingId(null);
      setPlayingUrl(null);
    }
    setClips((prev) => prev.filter((c) => c.id !== clip.id));
  };

  return (
    <div className="works-overlay" role="dialog" aria-modal="true" aria-label="我的作品">
      <div className="works-panel">
        <div className="works-head">
          <strong>
            <Film size={18} /> 我的作品
          </strong>
          <button className="screenshot-close" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="works-empty">加载中…</div>
        ) : clips.length === 0 ? (
          <div className="works-empty">
            还没有作品。录制一段带特效的成片,它会保存在这里(仅本地)。
          </div>
        ) : (
          <div className="works-grid">
            {clips.map((clip) => (
              <article className="work-card" key={clip.id}>
                <div className="work-media">
                  {playingId === clip.id && playingUrl ? (
                    <video src={playingUrl} controls autoPlay playsInline />
                  ) : (
                    <button
                      className="work-thumb"
                      type="button"
                      onClick={() => play(clip)}
                      aria-label="播放"
                    >
                      <img src={clip.thumbnail} alt="作品缩略图" />
                      <span className="work-play">
                        <Play size={20} />
                      </span>
                      <em>{formatDuration(clip.durationMs)}</em>
                    </button>
                  )}
                </div>
                <div className="work-actions">
                  <button
                    className="ghost-action"
                    type="button"
                    onClick={() => downloadBlob(clip.blob, clipName(clip))}
                  >
                    <Download size={15} />
                    下载
                  </button>
                  <button
                    className="ghost-action"
                    type="button"
                    onClick={() =>
                      shareBlob(
                        clip.blob,
                        clipName(clip),
                        '我用 AuraSeal 灵印引擎生成的能量特效成片',
                      )
                    }
                  >
                    <Share2 size={15} />
                    分享
                  </button>
                  <button className="ghost-action" type="button" onClick={() => remove(clip)}>
                    <Trash2 size={15} />
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
