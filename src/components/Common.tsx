import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <section className={clsx('card', className)} {...props}>{children}</section>;
}

export function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export function Badge({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Metric({ label, value, note, onClick, tone = '' }: { label: string; value: ReactNode; note?: string; onClick?: () => void; tone?: string }) {
  return <button className={`metric ${tone}`} onClick={onClick} type="button"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}<i>{onClick ? '查看溯源 ↗' : ''}</i></button>;
}

export function Formula({ children, caption }: { children: ReactNode; caption?: string }) {
  return <div className="formula"><code>{children}</code>{caption && <span>{caption}</span>}</div>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="empty-note">{children}</div>;
}
