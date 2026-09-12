const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be)/i;
const LOOM_HOST_PATTERN = /loom\.com/i;

export const isYouTubeUrl = (url: string): boolean => YOUTUBE_HOST_PATTERN.test(url);

export const isLoomUrl = (url: string): boolean => LOOM_HOST_PATTERN.test(url);

export const isEmbeddableMediaUrl = (url: string): boolean => isYouTubeUrl(url) || isLoomUrl(url);

const extractYouTubeId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace(/^\//, "") || null;
    }
    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.split("/")[2] ?? null;
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/")[2] ?? null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
};

const extractLoomId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/share\/([^/?#]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

export const toYouTubeEmbedUrl = (url: string): string | null => {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return null;
  }
  return `https://www.youtube.com/embed/${videoId}`;
};

export const toLoomEmbedUrl = (url: string): string | null => {
  const videoId = extractLoomId(url);
  if (!videoId) {
    return null;
  }
  return `https://www.loom.com/embed/${videoId}`;
};

export const toMediaEmbedUrl = (url: string): string | null => {
  if (isYouTubeUrl(url)) {
    return toYouTubeEmbedUrl(url);
  }
  if (isLoomUrl(url)) {
    return toLoomEmbedUrl(url);
  }
  return null;
};
