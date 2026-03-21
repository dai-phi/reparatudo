export function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin <= 1) return "Agora";
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h atrás`;
}
