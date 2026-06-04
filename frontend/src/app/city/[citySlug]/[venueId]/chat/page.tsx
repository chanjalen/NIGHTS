'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Paperclip, X, Flag } from 'lucide-react';
import { useAuth, getCsrfToken } from '@/contexts/AuthContext';
import {
  kindOf,
  validateFile,
  videoDuration,
  uploadMedia,
  CHAT_MAX_VIDEO_BYTES,
  CHAT_MAX_VIDEO_SECONDS,
} from '@/lib/upload';

interface ChatMedia {
  id: string;
  media_type: 'image' | 'video';
  status: 'processing' | 'ready';
  file_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

interface ChatMessage {
  id: string;
  user_id: number;
  user_display_name: string;
  text: string;
  created_at: string;
  media?: ChatMedia | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ChatPage() {
  const params = useParams<{ citySlug: string; venueId: string }>();
  const { citySlug, venueId } = params;
  const router = useRouter();
  const { user, loading } = useAuth();

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Connecting…');

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [reported, setReported] = useState<Record<string, boolean>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/signin');
      return;
    }

    const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      const ws = new WebSocket(`${WS_BASE}/ws/chat/${venueId}/`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setStatusMsg('');
        reconnectDelay.current = 1000;
      };

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'history') {
          setMessages(data.messages);
        } else if (data.type === 'message') {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === 'media_ready') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id
                ? { ...m, media: { ...data.media, status: 'ready' } }
                : m,
            ),
          );
        } else if (data.type === 'error') {
          if (data.code === 'checkin_expired') setStatusMsg('Your check-in has expired.');
          else if (data.code === 'rate_limited') setMediaError('Slow down a moment.');
          else if (data.code === 'media_invalid') setMediaError('That file could not be sent.');
        }
      };

      ws.onclose = (e) => {
        if (!mounted) return;
        setConnected(false);
        wsRef.current = null;

        if (e.code === 4001) {
          router.replace('/signin');
          return;
        }
        if (e.code === 4003) {
          setStatusMsg('You need to be checked in to join this chat.');
          return;
        }

        setStatusMsg('Reconnecting…');
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
          connect();
        }, reconnectDelay.current);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, loading, venueId, router]);

  const clearAttachment = () => {
    setAttachedPreview((p) => {
      if (p) URL.revokeObjectURL(p);
      return null;
    });
    setAttachedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPickFile = async (fileList: FileList | null) => {
    setMediaError('');
    const file = fileList?.[0];
    if (!file) return;
    const err = validateFile(file, { maxVideoBytes: CHAT_MAX_VIDEO_BYTES });
    if (err) {
      setMediaError(err);
      return;
    }
    if (kindOf(file) === 'video') {
      try {
        const dur = await videoDuration(file);
        if (dur > CHAT_MAX_VIDEO_SECONDS + 0.5) {
          setMediaError(`Videos must be ${CHAT_MAX_VIDEO_SECONDS} seconds or less.`);
          return;
        }
      } catch {
        setMediaError('Could not read that video.');
        return;
      }
    }
    clearAttachment();
    setAttachedFile(file);
    setAttachedPreview(URL.createObjectURL(file));
  };

  const sendMessage = async () => {
    const text = input.trim();
    const file = attachedFile;
    const ws = wsRef.current;
    if ((!text && !file) || !ws || ws.readyState !== WebSocket.OPEN || sending) return;

    setSending(true);
    setMediaError('');
    try {
      let mediaKey: string | undefined;
      if (file) {
        setUploadPct(0);
        const keys = await uploadMedia(API, [file], setUploadPct, 'chat');
        mediaKey = keys[0];
        setUploadPct(null);
      }
      ws.send(JSON.stringify({ text, media_key: mediaKey }));
      setInput('');
      clearAttachment();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed.');
      setUploadPct(null);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reportMedia = async (mediaId: string) => {
    if (reported[mediaId]) return;
    if (!confirm('Report this media as inappropriate?')) return;
    try {
      const res = await fetch(`${API}/api/v1/chat/media/${mediaId}/report/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) setReported((r) => ({ ...r, [mediaId]: true }));
    } catch {
      /* ignore */
    }
  };

  const renderMedia = (media: ChatMedia, canReport: boolean) => {
    if (media.status !== 'ready' || !media.file_url) {
      return <div className="chat-media-processing">Processing…</div>;
    }
    const inner =
      media.media_type === 'image' ? (
        <a href={media.file_url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.thumbnail_url || media.file_url}
            alt="Shared media"
            className="chat-media-el"
          />
        </a>
      ) : (
        <video
          src={media.file_url}
          poster={media.thumbnail_url || undefined}
          controls
          preload="none"
          className="chat-media-el"
        />
      );
    return (
      <div className="chat-media-item">
        {inner}
        {canReport && (
          <button
            type="button"
            className="chat-media-report"
            onClick={() => reportMedia(media.id)}
            title={reported[media.id] ? 'Reported' : 'Report'}
            aria-label="Report media"
          >
            <Flag size={12} fill={reported[media.id] ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <Link href={`/city/${citySlug}/${venueId}`} className="chat-back">
          <ArrowLeft size={18} />
        </Link>
        <div className="chat-header-info">
          <span className="chat-header-title">Venue Chat</span>
          {statusMsg ? (
            <span className="chat-status">{statusMsg}</span>
          ) : (
            <span className="chat-status connected">Live</span>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && connected && (
          <div className="chat-empty">No messages yet — say something!</div>
        )}
        {messages.map((msg) => {
          const isMe = user && msg.user_id === user.id;
          return (
            <div key={msg.id} className={`chat-row${isMe ? ' mine' : ''}`}>
              {!isMe && (
                <div className="chat-avatar">
                  {msg.user_display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="chat-bubble-wrap">
                {!isMe && <span className="chat-sender">{msg.user_display_name}</span>}
                {msg.media && <div className="chat-media">{renderMedia(msg.media, !isMe)}</div>}
                {msg.text && (
                  <div className={`chat-bubble${isMe ? ' mine' : ''}`}>{msg.text}</div>
                )}
                <span className="chat-time">{formatTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {(attachedPreview || mediaError || uploadPct !== null) && (
        <div className="chat-attach-bar">
          {attachedPreview && attachedFile && (
            <div className="chat-attach-chip">
              {kindOf(attachedFile) === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachedPreview} alt="" className="chat-attach-thumb" />
              ) : (
                <video src={attachedPreview} className="chat-attach-thumb" muted />
              )}
              <button className="chat-attach-remove" onClick={clearAttachment} aria-label="Remove">
                <X size={12} />
              </button>
            </div>
          )}
          {uploadPct !== null && <span className="chat-attach-status">Uploading… {uploadPct}%</span>}
          {mediaError && <span className="chat-attach-error">{mediaError}</span>}
        </div>
      )}

      <div className="chat-input-bar">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => onPickFile(e.target.files)}
        />
        <button
          className="chat-attach-btn"
          onClick={() => fileRef.current?.click()}
          disabled={!connected || sending || !!attachedFile}
          aria-label="Attach photo or video"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={connected ? 'Message…' : 'Connecting…'}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 280))}
          onKeyDown={handleKeyDown}
          disabled={!connected || sending}
          rows={1}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={!connected || sending || (!input.trim() && !attachedFile)}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
