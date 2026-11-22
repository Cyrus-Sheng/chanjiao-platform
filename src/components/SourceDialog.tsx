import * as Dialog from '@radix-ui/react-dialog';
import { X, FileSearch, Database } from 'lucide-react';
import type { Row } from '../types';

export interface SourceContent {
  title: string;
  file: string;
  formula?: string;
  rows: Row[];
  note?: string;
}

export function SourceDialog({ source, onClose }: { source: SourceContent | null; onClose: () => void }) {
  const rows = source?.rows ?? [];
  const keys = rows.length ? Object.keys(rows[0]).filter(key => !key.startsWith('__EMPTY')).slice(0, 7) : [];
  return <Dialog.Root open={!!source} onOpenChange={open => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content">
        <div className="dialog-head"><div className="dialog-icon"><FileSearch size={22} /></div><div><Dialog.Title>{source?.title}</Dialog.Title><Dialog.Description>公式、来源文件与原始记录样例</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="关闭"><X size={20} /></Dialog.Close></div>
        <div className="source-body">
          {source?.formula && <div className="source-formula"><span>计算口径</span><code>{source.formula}</code></div>}
          <div className="source-file"><Database size={16} /><div><span>来源文件</span><strong>{source?.file}</strong></div></div>
          {source?.note && <p className="source-note">{source.note}</p>}
          <h3>前 {Math.min(rows.length, 5)} 行原始记录</h3>
          {rows.length ? <div className="table-wrap"><table><thead><tr>{keys.map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, index) => <tr key={index}>{keys.map(key => <td key={key}>{String(row[key] ?? '—')}</td>)}</tr>)}</tbody></table></div> : <div className="empty-note">原始明细未随数据目录提供，不以模拟记录填充。</div>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
