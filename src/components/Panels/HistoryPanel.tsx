import { useRef } from 'react';
import type { DocumentKind } from '@/types';
import { selectFilteredSessions, useMeasurementStore, useSessionStore, useUiStore } from '@/store';
import { useSessionPersistence } from '@/hooks';
import { Button, Icon, Select, TextInput } from '@/components/common';
import { formatDateTime } from '@/utils/format';
import { scaleLabel } from '@/utils/scale';
import { exportSessionsJson } from '@/utils/db';

const KIND_OPTIONS: { value: DocumentKind | 'all'; label: string }[] = [
  { value: 'all', label: 'ทุกชนิด' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'รูปภาพ' },
  { value: 'model3d', label: 'โมเดล 3D' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'แก้ไขล่าสุด' },
  { value: 'createdAt', label: 'วันที่สร้าง' },
  { value: 'name', label: 'ชื่อ' },
] as const;

export function HistoryPanel() {
  const sessions = useSessionStore(selectFilteredSessions);
  const filter = useSessionStore((s) => s.filter);
  const setFilter = useSessionStore((s) => s.setFilter);
  const loading = useSessionStore((s) => s.loading);
  const importJson = useSessionStore((s) => s.importJson);
  const clearHistory = useSessionStore((s) => s.clear);
  const allSessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useMeasurementStore((s) => s.sessionId);
  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);
  const { load, remove } = useSessionPersistence();
  const importRef = useRef<HTMLInputElement>(null);

  const handleExportJson = async () => {
    const { downloadJson } = await import('@/utils/export');
    downloadJson(await exportSessionsJson(), `measurement-history-${Date.now()}.json`);
    notify('ส่งออกประวัติเป็น JSON แล้ว', 'success');
  };

  const handleExportExcel = async () => {
    if (allSessions.length === 0) {
      notify('ยังไม่มีประวัติให้ส่งออก', 'error');
      return;
    }
    try {
      setBusy('กำลังสร้างไฟล์ Excel…');
      const { exportHistoryToExcel } = await import('@/utils/export');
      await exportHistoryToExcel(allSessions);
      notify('ส่งออกประวัติเป็น Excel แล้ว', 'success');
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const count = await importJson(await file.text());
      notify(`นำเข้า ${count} รายการแล้ว`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'นำเข้าไม่สำเร็จ', 'error');
    }
  };

  return (
    <div className="mt-panel-body mt-history">
      <div className="mt-history__filters">
        <div className="mt-search">
          <Icon name="search" size={16} />
          <TextInput
            value={filter.query}
            placeholder="ค้นหาชื่อ โครงการ ไฟล์ หรือแท็ก"
            onChange={(e) => setFilter({ query: e.target.value })}
          />
        </div>
        <div className="mt-history__filter-row">
          <Select
            value={filter.kind}
            options={KIND_OPTIONS}
            onValueChange={(kind) => setFilter({ kind })}
          />
          <Select
            value={filter.sortBy}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onValueChange={(sortBy) => setFilter({ sortBy })}
          />
          <Button
            size="sm"
            iconOnly
            icon={filter.sortDir === 'desc' ? 'chevronDown' : 'chevronRight'}
            title={filter.sortDir === 'desc' ? 'มากไปน้อย' : 'น้อยไปมาก'}
            onClick={() => setFilter({ sortDir: filter.sortDir === 'desc' ? 'asc' : 'desc' })}
          />
        </div>
        <div className="mt-history__filter-row">
          <TextInput
            type="date"
            aria-label="ตั้งแต่วันที่"
            onChange={(e) =>
              setFilter({ from: e.target.value ? new Date(e.target.value).getTime() : undefined })
            }
          />
          <TextInput
            type="date"
            aria-label="ถึงวันที่"
            onChange={(e) =>
              setFilter({
                to: e.target.value ? new Date(e.target.value).getTime() + 86_399_999 : undefined,
              })
            }
          />
        </div>
      </div>

      {loading && <p className="mt-muted">กำลังโหลด…</p>}

      {!loading && sessions.length === 0 ? (
        <div className="mt-empty">
          <Icon name="history" size={32} strokeWidth={1.2} />
          <p>ยังไม่มีประวัติการวัด</p>
          <span>กด &quot;บันทึก&quot; ที่แถบด้านบนเพื่อเก็บงานวัดไว้ในเครื่อง</span>
        </div>
      ) : (
        <ul className="mt-history__list">
          {sessions.map((session) => (
            <li
              key={session.id}
              className={`mt-history__card ${session.id === currentSessionId ? 'is-current' : ''}`}
            >
              {session.thumbnail ? (
                <img src={session.thumbnail} alt="" className="mt-history__thumb" />
              ) : (
                <div className="mt-history__thumb mt-history__thumb--empty">
                  <Icon name="file" size={20} />
                </div>
              )}
              <div className="mt-history__info">
                <strong>{session.name}</strong>
                <span>{session.documentName}</span>
                <span className="mt-muted">
                  {scaleLabel(session.scale)} · {session.measurements.length} รายการ ·{' '}
                  {formatDateTime(session.updatedAt)}
                </span>
              </div>
              <div className="mt-history__actions">
                <Button
                  size="sm"
                  icon="folder"
                  variant="ghost"
                  iconOnly
                  title="เปิดการวัดนี้"
                  onClick={() => load(session)}
                />
                <Button
                  size="sm"
                  icon="trash"
                  variant="ghost"
                  iconOnly
                  title="ลบ"
                  onClick={() => {
                    if (window.confirm(`ลบ "${session.name}" ?`)) void remove(session.id);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-panel-footer mt-panel-footer--wrap">
        <Button size="sm" icon="download" onClick={() => void handleExportJson()}>
          สำรอง JSON
        </Button>
        <Button size="sm" icon="excel" onClick={() => void handleExportExcel()}>
          ประวัติเป็น Excel
        </Button>
        <Button size="sm" icon="upload" onClick={() => importRef.current?.click()}>
          นำเข้า JSON
        </Button>
        <Button
          size="sm"
          icon="trash"
          variant="danger"
          onClick={() => {
            if (window.confirm('ลบประวัติการวัดทั้งหมด?')) void clearHistory();
          }}
        >
          ล้างประวัติ
        </Button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
