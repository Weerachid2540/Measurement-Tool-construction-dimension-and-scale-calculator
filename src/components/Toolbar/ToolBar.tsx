import type { ToolId } from '@/types';
import { useAutoCountStore, useMeasurementStore, useUiStore } from '@/store';
import { Icon, type IconName } from '@/components/common';
import { PALETTE } from '@/utils/colors';

interface ToolDefinition {
  id: ToolId;
  icon: IconName;
  label: string;
  /** ชื่อสั้นใต้ไอคอนบนแถบด้านบน — ชื่อเต็มยังอยู่ใน tooltip */
  short?: string;
  shortcut: string;
}

const TOOL_GROUPS: ToolDefinition[][] = [
  [
    { id: 'select', icon: 'select', label: 'เลือก / แก้ไข', short: 'เลือก', shortcut: 'V' },
    { id: 'pan', icon: 'pan', label: 'เลื่อนภาพ', shortcut: 'H' },
  ],
  [
    { id: 'line', icon: 'line', label: 'ความยาว', shortcut: 'L' },
    { id: 'polyline', icon: 'polyline', label: 'เส้นต่อเนื่อง', shortcut: 'P' },
    { id: 'rectangle', icon: 'rectangle', label: 'สี่เหลี่ยม', shortcut: 'R' },
    { id: 'polygon', icon: 'polygon', label: 'พื้นที่', shortcut: 'G' },
    { id: 'circle', icon: 'circle', label: 'วงกลม', shortcut: 'C' },
    { id: 'angle', icon: 'angle', label: 'มุม / ความลาด', short: 'มุม', shortcut: 'A' },
    { id: 'count', icon: 'count', label: 'นับจำนวน', shortcut: 'N' },
    {
      id: 'autoCount',
      icon: 'search',
      label: 'นับสัญลักษณ์อัตโนมัติ',
      short: 'นับอัตโนมัติ',
      shortcut: 'M',
    },
  ],
  [
    {
      id: 'calibrate',
      icon: 'calibrate',
      label: 'ปรับเทียบมาตราส่วน',
      short: 'ปรับเทียบ',
      shortcut: 'K',
    },
  ],
];

export function ToolBar() {
  const activeTool = useMeasurementStore((s) => s.activeTool);
  const setTool = useMeasurementStore((s) => s.setTool);
  const activeColor = useMeasurementStore((s) => s.activeColor);
  const setActiveColor = useMeasurementStore((s) => s.setActiveColor);
  const hasDocument = useMeasurementStore((s) => s.page !== null);
  const beginSelection = useAutoCountStore((s) => s.beginSelection);
  const resetAutoCount = useAutoCountStore((s) => s.reset);
  const setPanelTab = useUiStore((s) => s.setPanelTab);

  // Auto-count needs its panel open to be usable, so picking the tool opens it.
  const selectTool = (id: ToolId) => {
    setTool(id);
    if (id === 'autoCount') {
      beginSelection();
      setPanelTab('autoCount');
    } else {
      resetAutoCount();
    }
  };

  return (
    <nav className="mt-toolbar" aria-label="เครื่องมือวัด">
      {TOOL_GROUPS.map((group, index) => (
        <div className="mt-toolbar__group" key={index}>
          {group.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`mt-tool ${activeTool === tool.id ? 'is-active' : ''}`}
              onClick={() => selectTool(tool.id)}
              disabled={!hasDocument && tool.id !== 'select'}
              title={`${tool.label} (${tool.shortcut})`}
              aria-pressed={activeTool === tool.id}
            >
              <Icon name={tool.icon} size={20} />
              <span className="mt-tool__label">{tool.label}</span>
              <span className="mt-tool__label--short">{tool.short ?? tool.label}</span>
            </button>
          ))}
        </div>
      ))}

      <div className="mt-toolbar__group mt-toolbar__group--colors">
        <span className="mt-toolbar__caption">สี</span>
        <div className="mt-swatches">
          <button
            type="button"
            className={`mt-swatch mt-swatch--auto ${activeColor === null ? 'is-active' : ''}`}
            onClick={() => setActiveColor(null)}
            title="ใช้สีตามชนิดเครื่องมือ"
          >
            <Icon name="check" size={12} />
          </button>
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`mt-swatch ${activeColor === color ? 'is-active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setActiveColor(color)}
              title={color}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
