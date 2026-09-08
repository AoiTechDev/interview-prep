export const Check = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8.5L6.2 12 13 4" />
  </svg>
);

export const Chevron = () => (
  <svg className="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 4l7 6-7 6" />
  </svg>
);

export const Star = ({ filled }: { filled: boolean }) =>
  filled ? (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .74 4.3L8 11.6l-3.84 2-.73-4.3-3.1-3 4.3-.6z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .74 4.3L8 11.6l-3.84 2-.73-4.3-3.1-3 4.3-.6z" />
    </svg>
  );

export const Trash = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.8 4h10.4M6.4 4V2.6h3.2V4M4.2 4l.6 9h6.4l.6-9M6.6 6.4v4.2M9.4 6.4v4.2" />
  </svg>
);

export const Pencil = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11.2 2.4l2.4 2.4L5.6 12.8 2.4 13.6l.8-3.2z" />
  </svg>
);

export const Search = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13 13l4 4" />
  </svg>
);

export const Play = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M4.5 3.2v9.6c0 .5.55.8.96.53l7.2-4.8a.64.64 0 000-1.06l-7.2-4.8a.64.64 0 00-.96.53z" />
  </svg>
);

export const Close = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
